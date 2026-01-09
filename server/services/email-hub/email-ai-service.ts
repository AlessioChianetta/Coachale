import { db } from "../../db";
import * as schema from "@shared/schema";
import { eq, and } from "drizzle-orm";
import { getAIProvider, getModelForProviderName } from "../../ai/provider-factory";
import { GoogleGenAI } from "@google/genai";
import { searchKnowledgeBase } from "./email-knowledge-service";
import { createTicketFromEmail, getTicketSettings } from "./ticket-webhook-service";
import { FileSearchService, fileSearchService } from "../../ai/file-search-service";

export interface EmailClassification {
  intent: "question" | "complaint" | "request" | "follow-up" | "spam" | "thank-you" | "information" | "other";
  urgency: "high" | "medium" | "low";
  sentiment: "positive" | "neutral" | "negative";
  category: "support" | "sales" | "inquiry" | "personal" | "newsletter" | "transactional" | "other";
  suggestedAction: "reply" | "forward" | "archive" | "ignore" | "escalate";
  confidence: number;
  reasoning?: string;
}

export interface EmailDraft {
  subject: string;
  bodyHtml: string;
  bodyText: string;
  confidence: number;
  modelUsed: string;
  tokensUsed?: number;
}

export interface AccountSettings {
  aiTone: "formal" | "friendly" | "professional";
  signature?: string | null;
  confidenceThreshold?: number;
}

export interface OriginalEmail {
  subject?: string | null;
  fromName?: string | null;
  fromEmail: string;
  bodyText?: string | null;
  bodyHtml?: string | null;
  threadHistory?: Array<{
    fromEmail: string;
    bodyText?: string | null;
    receivedAt: Date;
  }>;
}

const CLASSIFICATION_PROMPT = `Sei un assistente AI specializzato nell'analisi delle email per un consulente italiano.

Analizza l'email seguente e restituisci una classificazione JSON con questi campi:
- intent: tipo di email ("question", "complaint", "request", "follow-up", "spam", "thank-you", "information", "other")
- urgency: livello di urgenza ("high", "medium", "low")
- sentiment: tono emotivo ("positive", "neutral", "negative")
- category: categoria ("support", "sales", "inquiry", "personal", "newsletter", "transactional", "other")
- suggestedAction: azione consigliata ("reply", "forward", "archive", "ignore", "escalate")
- confidence: punteggio di confidenza da 0 a 1
- reasoning: breve spiegazione in italiano della classificazione

Rispondi SOLO con il JSON valido, senza markdown o altro testo.`;

interface DraftPromptOptions {
  tone: string;
  signature?: string | null;
  customInstructions?: string | null;
  knowledgeContext?: string | null;
  bookingLink?: string | null;
}

function buildDraftPrompt(options: DraftPromptOptions): string {
  const { tone, signature, customInstructions, knowledgeContext, bookingLink } = options;
  
  const toneInstructions: Record<string, string> = {
    formal: `Usa un tono formale e professionale. Utilizza il "Lei" come forma di cortesia. 
Evita colloquialismi e mantieni un registro alto. Inizia con "Gentile" o "Egregio/a".`,
    friendly: `Usa un tono cordiale e amichevole ma sempre professionale. 
Puoi usare il "tu" se appropriato. Sii caloroso ma non troppo informale.`,
    professional: `Usa un tono professionale e diretto. 
Mantieni un equilibrio tra formalità e accessibilità. Sii chiaro e conciso.`,
  };

  const signatureBlock = signature 
    ? `\n\nFirma da includere alla fine:\n${signature}`
    : "";

  const customBlock = customInstructions
    ? `\n\nISTRUZIONI PERSONALIZZATE DEL CONSULENTE:\n${customInstructions}`
    : "";

  const kbBlock = knowledgeContext
    ? `\n\nCONTESTO DALLA KNOWLEDGE BASE:\nUsa le seguenti informazioni per formulare una risposta accurata:\n${knowledgeContext}`
    : "";

  const bookingBlock = bookingLink
    ? `\n\nLink di prenotazione da includere se appropriato: ${bookingLink}`
    : "";

  return `Sei un assistente AI che aiuta un consulente italiano a rispondere alle email.

ISTRUZIONI SUL TONO:
${toneInstructions[tone] || toneInstructions.professional}
${customBlock}
${kbBlock}
${bookingBlock}

REGOLE:
1. Rispondi in italiano
2. Mantieni la risposta pertinente e utile
3. Utilizza le informazioni dalla Knowledge Base quando disponibili
4. Se l'email richiede informazioni specifiche che non hai, suggerisci di verificare o chiedere
5. Includi la firma alla fine se fornita
6. Se hai un link di prenotazione e il cliente chiede un appuntamento, proponilo
${signatureBlock}

Genera una risposta email appropriata. Restituisci SOLO un JSON valido con questi campi:
- subject: oggetto della risposta (includi "Re: " se appropriato)
- bodyText: corpo della risposta in testo semplice
- bodyHtml: corpo della risposta in HTML semplice (usa <p>, <br>, ecc.)
- confidence: punteggio di confidenza da 0 a 1 sulla qualità della risposta

Rispondi SOLO con il JSON valido, senza markdown o altro testo.`;
}

export async function classifyEmail(
  emailId: string,
  consultantId: string
): Promise<EmailClassification> {
  const [email] = await db
    .select()
    .from(schema.hubEmails)
    .where(eq(schema.hubEmails.id, emailId));

  if (!email) {
    throw new Error("Email not found");
  }

  const emailContent = `
Da: ${email.fromName || ""} <${email.fromEmail}>
Oggetto: ${email.subject || "(Nessun oggetto)"}

${email.bodyText || email.bodyHtml || "(Nessun contenuto)"}
`.trim();

  const provider = await getAIProvider(consultantId);
  const model = "gemini-2.5-flash";

  try {
    const result = await provider.client.generateContent({
      model,
      contents: [
        { role: "user", parts: [{ text: CLASSIFICATION_PROMPT }] },
        { role: "user", parts: [{ text: `EMAIL DA ANALIZZARE:\n\n${emailContent}` }] },
      ],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 1024,
      },
    });

    const responseText = result.response.text();
    const cleanedResponse = responseText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    
    const classification = JSON.parse(cleanedResponse) as EmailClassification;
    
    return {
      intent: classification.intent || "other",
      urgency: classification.urgency || "medium",
      sentiment: classification.sentiment || "neutral",
      category: classification.category || "other",
      suggestedAction: classification.suggestedAction || "reply",
      confidence: classification.confidence || 0.5,
      reasoning: classification.reasoning,
    };
  } catch (error: any) {
    console.error("[EMAIL-AI] Classification error:", error);
    return {
      intent: "other",
      urgency: "medium",
      sentiment: "neutral",
      category: "other",
      suggestedAction: "reply",
      confidence: 0.3,
      reasoning: `Errore durante la classificazione: ${error.message}`,
    };
  }
}

export interface ExtendedDraftOptions {
  customInstructions?: string | null;
  knowledgeContext?: string | null;
  bookingLink?: string | null;
  fileSearchStoreNames?: string[];
}

export async function generateEmailDraft(
  emailId: string,
  originalEmail: OriginalEmail,
  accountSettings: AccountSettings,
  consultantId: string,
  extendedOptions?: ExtendedDraftOptions
): Promise<EmailDraft> {
  const systemPrompt = buildDraftPrompt({
    tone: accountSettings.aiTone || "professional",
    signature: accountSettings.signature,
    customInstructions: extendedOptions?.customInstructions,
    knowledgeContext: extendedOptions?.knowledgeContext,
    bookingLink: extendedOptions?.bookingLink,
  });

  let threadContext = "";
  if (originalEmail.threadHistory && originalEmail.threadHistory.length > 0) {
    threadContext = "\n\nSTORICO CONVERSAZIONE:\n" + originalEmail.threadHistory
      .slice(-3)
      .map((msg, i) => `[${i + 1}] Da: ${msg.fromEmail}\n${msg.bodyText || "(vuoto)"}`)
      .join("\n---\n");
  }

  const emailContent = `
Da: ${originalEmail.fromName || ""} <${originalEmail.fromEmail}>
Oggetto: ${originalEmail.subject || "(Nessun oggetto)"}

${originalEmail.bodyText || originalEmail.bodyHtml || "(Nessun contenuto)"}
${threadContext}
`.trim();

  const provider = await getAIProvider(consultantId);
  // Use model based on provider type (Vertex AI vs Google AI Studio)
  const model = getModelForProviderName(provider.metadata?.name);
  console.log(`[EMAIL-AI] Using model ${model} (provider: ${provider.metadata?.name || 'unknown'})`);

  // Build FileSearch tool if store names are available
  const fileSearchTool = extendedOptions?.fileSearchStoreNames?.length 
    ? fileSearchService.buildFileSearchTool(extendedOptions.fileSearchStoreNames)
    : null;

  if (fileSearchTool) {
    console.log(`[EMAIL-AI] Using FileSearch RAG with ${extendedOptions?.fileSearchStoreNames?.length} stores`);
  }

  try {
    const result = await provider.client.generateContent({
      model,
      contents: [
        { role: "user", parts: [{ text: systemPrompt }] },
        { role: "user", parts: [{ text: `EMAIL A CUI RISPONDERE:\n\n${emailContent}` }] },
      ],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 4096,
      },
      ...(fileSearchTool && { tools: [fileSearchTool] }),
    });

    const responseText = result.response.text();
    let cleanedResponse = responseText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    
    // Attempt to repair truncated JSON (common with token limits)
    let draft: any;
    try {
      draft = JSON.parse(cleanedResponse);
    } catch (parseError) {
      console.warn("[EMAIL-AI] JSON parse failed, attempting repair...");
      
      // Try to extract fields manually if JSON is malformed
      const subjectMatch = cleanedResponse.match(/"subject"\s*:\s*"([^"]+)"/);
      const bodyTextMatch = cleanedResponse.match(/"bodyText"\s*:\s*"([\s\S]*?)(?:"|$)/);
      const bodyHtmlMatch = cleanedResponse.match(/"bodyHtml"\s*:\s*"([\s\S]*?)(?:"|$)/);
      const confidenceMatch = cleanedResponse.match(/"confidence"\s*:\s*([\d.]+)/);
      
      if (subjectMatch || bodyTextMatch || bodyHtmlMatch) {
        console.log("[EMAIL-AI] Recovered partial data from malformed JSON");
        draft = {
          subject: subjectMatch?.[1] || null,
          bodyText: bodyTextMatch?.[1]?.replace(/\\n/g, "\n").replace(/\\"/g, '"') || "",
          bodyHtml: bodyHtmlMatch?.[1]?.replace(/\\n/g, "\n").replace(/\\"/g, '"') || "",
          confidence: confidenceMatch ? parseFloat(confidenceMatch[1]) : 0.5,
        };
      } else {
        // Can't recover, rethrow original error
        throw parseError;
      }
    }
    
    const subject = draft.subject || (originalEmail.subject?.startsWith("Re:") 
      ? originalEmail.subject 
      : `Re: ${originalEmail.subject || "Senza oggetto"}`);

    return {
      subject,
      bodyHtml: draft.bodyHtml || `<p>${draft.bodyText || ""}</p>`,
      bodyText: draft.bodyText || "",
      confidence: draft.confidence || 0.7,
      modelUsed: model,
    };
  } catch (error: any) {
    console.error("[EMAIL-AI] Draft generation error:", error);
    
    const fallbackText = `Grazie per la sua email. La contatterò al più presto.${
      accountSettings.signature ? `\n\n${accountSettings.signature}` : ""
    }`;
    
    return {
      subject: originalEmail.subject?.startsWith("Re:") 
        ? originalEmail.subject 
        : `Re: ${originalEmail.subject || "Senza oggetto"}`,
      bodyHtml: `<p>${fallbackText.replace(/\n/g, "<br>")}</p>`,
      bodyText: fallbackText,
      confidence: 0.3,
      modelUsed: model,
    };
  }
}

export interface ExtendedAccountSettings extends AccountSettings {
  customInstructions?: string | null;
  aiLanguage?: string | null;
  escalationKeywords?: string[] | null;
  stopOnRisk?: boolean | null;
  bookingLink?: string | null;
}

export interface ClassifyAndGenerateResult {
  classification: EmailClassification;
  draft: EmailDraft | null;
  kbSearchResult?: {
    found: boolean;
    documentsCount: number;
  };
  ticketCreated?: boolean;
  ticketId?: string;
  stoppedByRisk?: boolean;
  riskReason?: string;
}

async function checkEscalationKeywords(
  text: string, 
  keywords: string[]
): Promise<{ found: boolean; matchedKeyword?: string }> {
  const normalizedText = text.toLowerCase();
  for (const keyword of keywords) {
    if (normalizedText.includes(keyword.toLowerCase().trim())) {
      return { found: true, matchedKeyword: keyword };
    }
  }
  return { found: false };
}

export async function classifyAndGenerateDraft(
  emailId: string,
  consultantId: string,
  accountSettings: AccountSettings,
  extendedSettings?: ExtendedAccountSettings
): Promise<ClassifyAndGenerateResult> {
  const [email] = await db
    .select()
    .from(schema.hubEmails)
    .where(eq(schema.hubEmails.id, emailId));

  if (!email) {
    throw new Error("Email not found");
  }

  const classification = await classifyEmail(emailId, consultantId);
  
  const originalEmail: OriginalEmail = {
    subject: email.subject,
    fromName: email.fromName,
    fromEmail: email.fromEmail,
    bodyText: email.bodyText,
    bodyHtml: email.bodyHtml,
  };

  const emailText = `${email.subject || ""} ${email.bodyText || ""}`;

  if (extendedSettings?.escalationKeywords && extendedSettings.escalationKeywords.length > 0) {
    const escalationCheck = await checkEscalationKeywords(
      emailText, 
      extendedSettings.escalationKeywords
    );
    
    if (escalationCheck.found && extendedSettings.stopOnRisk) {
      console.log(`[EMAIL-AI] Escalation keyword detected: "${escalationCheck.matchedKeyword}". Stopping AI processing.`);
      
      const ticket = await createTicketFromEmail(
        emailId,
        consultantId,
        email.accountId,
        "escalation_keyword",
        {
          reasonDetails: `Parola chiave rilevata: "${escalationCheck.matchedKeyword}"`,
          aiClassification: classification,
          priority: "high",
        }
      );
      
      return {
        classification,
        draft: null,
        stoppedByRisk: true,
        riskReason: `Parola chiave di escalation rilevata: "${escalationCheck.matchedKeyword}"`,
        ticketCreated: !!ticket,
        ticketId: ticket?.id,
      };
    }
  }

  const kbResult = await searchKnowledgeBase(consultantId, {
    subject: email.subject || "",
    fromEmail: email.fromEmail,
    fromName: email.fromName || undefined,
    bodyText: email.bodyText || "",
  });

  console.log(`[EMAIL-AI] Knowledge Base search: found=${kbResult.found}, stores=${kbResult.storeNames?.length || 0}, docs=${kbResult.totalDocuments || 0}`);

  // Use FileSearch store names for native RAG (no manual context extraction needed)
  const fileSearchStoreNames = kbResult.found ? kbResult.storeNames : [];
  
  if (fileSearchStoreNames.length > 0) {
    console.log(`[EMAIL-AI] FileSearch RAG enabled with ${kbResult.totalDocuments} documents in ${fileSearchStoreNames.length} stores`);
  }

  const ticketSettings = await getTicketSettings(consultantId);
  let ticketCreated = false;
  let ticketId: string | undefined;

  if (!kbResult.found && ticketSettings?.autoCreateTicketOnNoAnswer) {
    console.log(`[EMAIL-AI] No KB answer found, creating ticket...`);
    const ticket = await createTicketFromEmail(
      emailId,
      consultantId,
      email.accountId,
      "no_kb_answer",
      {
        reasonDetails: "L'AI non ha trovato informazioni pertinenti nella Knowledge Base",
        aiClassification: classification,
      }
    );
    ticketCreated = !!ticket;
    ticketId = ticket?.id;
  }

  if (classification.urgency === "high" && ticketSettings?.autoCreateTicketOnHighUrgency && !ticketCreated) {
    console.log(`[EMAIL-AI] High urgency detected, creating ticket...`);
    const ticket = await createTicketFromEmail(
      emailId,
      consultantId,
      email.accountId,
      "high_urgency",
      {
        reasonDetails: `Urgenza elevata rilevata: ${classification.reasoning || ""}`,
        aiClassification: classification,
        priority: "urgent",
      }
    );
    ticketCreated = !!ticket;
    ticketId = ticket?.id;
  }

  if (classification.sentiment === "negative" && ticketSettings?.autoCreateTicketOnNegativeSentiment && !ticketCreated) {
    console.log(`[EMAIL-AI] Negative sentiment detected, creating ticket...`);
    const ticket = await createTicketFromEmail(
      emailId,
      consultantId,
      email.accountId,
      "negative_sentiment",
      {
        reasonDetails: `Sentiment negativo rilevato: ${classification.reasoning || ""}`,
        aiClassification: classification,
        priority: "high",
      }
    );
    ticketCreated = !!ticket;
    ticketId = ticket?.id;
  }

  const draft = await generateEmailDraft(
    emailId,
    originalEmail,
    accountSettings,
    consultantId,
    {
      customInstructions: extendedSettings?.customInstructions,
      bookingLink: extendedSettings?.bookingLink,
      fileSearchStoreNames,
    }
  );

  return { 
    classification, 
    draft,
    kbSearchResult: {
      found: kbResult.found,
      documentsCount: kbResult.totalDocuments || 0,
    },
    ticketCreated,
    ticketId,
  };
}
