import { db } from "../../db";
import * as schema from "@shared/schema";
import { eq, and } from "drizzle-orm";
import { getGoogleAIStudioClientForFileSearch, GEMINI_3_MODEL } from "../../ai/provider-factory";
import { GoogleGenAI } from "@google/genai";
import { searchKnowledgeBase } from "./email-knowledge-service";
import { createTicketFromEmail, getTicketSettings } from "./ticket-webhook-service";
import { FileSearchService, fileSearchService } from "../../ai/file-search-service";
import { FileSearchSyncService } from "../file-search-sync-service";

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

export type AIResponseCategory = "info_request" | "complaint" | "billing" | "technical" | "booking" | "other";
export type AIResponseSentiment = "positive" | "neutral" | "negative";
export type AIResponseUrgency = "low" | "medium" | "high" | "critical";
export type AITicketPriority = "low" | "medium" | "high" | "urgent";
export type AIDecisionAction = "auto_sent" | "draft_created" | "ticket_created" | "escalated" | "ignored";

export interface AIStructuredResponse {
  response: string;
  confidence: number;
  category: AIResponseCategory;
  sentiment: AIResponseSentiment;
  urgency: AIResponseUrgency;
  createTicket: boolean;
  ticketReason: string | null;
  ticketPriority: AITicketPriority | null;
  suggestedActions: string[];
  documentCitations?: string[];
}

export interface DecisionEngineInput {
  aiResponse: AIStructuredResponse;
  autoSendEnabled: boolean;
}

export interface DecisionEngineResult {
  action: AIDecisionAction;
  confidenceThreshold: number;
  shouldAutoSend: boolean;
  shouldCreateTicket: boolean;
}

const CATEGORY_CONFIDENCE_THRESHOLDS: Record<AIResponseCategory, number> = {
  info_request: 0.75,
  other: 0.75,
  complaint: 0.85,
  billing: 0.90,
  technical: 0.90,
  booking: 0.80,
};

export function executeDecisionEngine(input: DecisionEngineInput): DecisionEngineResult {
  const { aiResponse, autoSendEnabled } = input;
  const { confidence, category, createTicket } = aiResponse;
  
  const threshold = CATEGORY_CONFIDENCE_THRESHOLDS[category] || 0.75;
  
  let action: AIDecisionAction;
  let shouldAutoSend = false;
  let shouldCreateTicket = false;
  
  if (confidence < 0.60 || createTicket === true) {
    action = "ticket_created";
    shouldCreateTicket = true;
  } else if (confidence >= threshold && autoSendEnabled) {
    action = "auto_sent";
    shouldAutoSend = true;
  } else if (confidence >= 0.60 && confidence < threshold) {
    action = "draft_created";
  } else {
    action = "draft_created";
  }
  
  return {
    action,
    confidenceThreshold: threshold,
    shouldAutoSend,
    shouldCreateTicket,
  };
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

const STRUCTURED_RESPONSE_PROMPT = `Sei un assistente AI specializzato nell'analisi e risposta alle email per un consulente italiano.

Analizza l'email e genera una risposta strutturata in JSON con questi campi ESATTI:

- response: string (testo della risposta email, professionale e pertinente)
- confidence: number (da 0 a 1, quanto sei sicuro della risposta)
- category: "info_request" | "complaint" | "billing" | "technical" | "booking" | "other"
- sentiment: "positive" | "neutral" | "negative" (tono percepito nell'email ricevuta)
- urgency: "low" | "medium" | "high" | "critical"
- createTicket: boolean (true se richiede intervento umano urgente)
- ticketReason: string | null (motivo per creare il ticket, se createTicket è true)
- ticketPriority: "low" | "medium" | "high" | "urgent" | null (priorità del ticket, se createTicket è true)
- suggestedActions: string[] (lista di azioni consigliate, es: ["Verificare disponibilità", "Chiamare cliente"])

CRITERI PER createTicket = true:
- Reclami gravi o clienti arrabbiati
- Richieste di rimborso o problemi di fatturazione complessi
- Situazioni che richiedono decisioni umane
- Informazioni mancanti critiche per rispondere
- Richieste di consulenza specifica non coperta dalla knowledge base

CRITERI PER confidence:
- 0.9-1.0: Risposta certa, informazioni complete dalla knowledge base
- 0.7-0.9: Risposta buona, alcune informazioni dalla KB
- 0.5-0.7: Risposta generica, poche informazioni specifiche
- 0.3-0.5: Risposta incerta, potrebbe richiedere revisione
- 0.0-0.3: Non sono sicuro, meglio creare un ticket

Rispondi SOLO con il JSON valido, senza markdown, commenti o altro testo.`;

function buildStructuredResponsePrompt(options: DraftPromptOptions): string {
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
    ? `\n\nFirma da includere alla fine della risposta:\n${signature}`
    : "";

  const customBlock = customInstructions
    ? `\n\nISTRUZIONI PERSONALIZZATE DEL CONSULENTE:\n${customInstructions}`
    : "";

  const kbBlock = knowledgeContext
    ? `\n\nCONTESTO DALLA KNOWLEDGE BASE:\nUsa le seguenti informazioni per formulare una risposta accurata:\n${knowledgeContext}`
    : "";

  const bookingBlock = bookingLink
    ? `\n\nLink di prenotazione da includere se il cliente chiede un appuntamento: ${bookingLink}`
    : "";

  return `${STRUCTURED_RESPONSE_PROMPT}

ISTRUZIONI SUL TONO:
${toneInstructions[tone] || toneInstructions.professional}
${customBlock}
${kbBlock}
${bookingBlock}
${signatureBlock}`;
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

  const studioClient = await getGoogleAIStudioClientForFileSearch(consultantId);
  if (!studioClient) {
    throw new Error("Google AI Studio non disponibile per la classificazione email");
  }
  const model = GEMINI_3_MODEL;
  console.log(`[EMAIL-AI] Classification using ${model} (Google AI Studio)`);

  try {
    const result = await studioClient.client.generateContent({
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

  const studioClient = await getGoogleAIStudioClientForFileSearch(consultantId);
  if (!studioClient) {
    throw new Error("Google AI Studio non disponibile per la generazione bozze email");
  }
  const model = GEMINI_3_MODEL;
  console.log(`[EMAIL-AI] Draft generation using ${model} (Google AI Studio)`);

  const fileSearchTool = extendedOptions?.fileSearchStoreNames?.length 
    ? fileSearchService.buildFileSearchTool(extendedOptions.fileSearchStoreNames)
    : null;

  if (fileSearchTool) {
    console.log(`[EMAIL-AI] Using FileSearch RAG with ${extendedOptions?.fileSearchStoreNames?.length} stores`);
  }

  try {
    const result = await studioClient.client.generateContent({
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
    
    let draft: any;
    try {
      draft = JSON.parse(cleanedResponse);
    } catch (parseError) {
      console.warn("[EMAIL-AI] JSON parse failed, attempting repair...");
      
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

export async function generateStructuredAIResponse(
  emailId: string,
  originalEmail: OriginalEmail,
  accountSettings: AccountSettings,
  consultantId: string,
  extendedOptions?: ExtendedDraftOptions
): Promise<AIStructuredResponse> {
  const systemPrompt = buildStructuredResponsePrompt({
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

  const studioClient = await getGoogleAIStudioClientForFileSearch(consultantId);
  if (!studioClient) {
    throw new Error("Google AI Studio non disponibile per la generazione risposta strutturata");
  }
  const model = GEMINI_3_MODEL;
  console.log(`[EMAIL-AI] Structured response generation using ${model} (Google AI Studio)`);

  const fileSearchTool = extendedOptions?.fileSearchStoreNames?.length 
    ? fileSearchService.buildFileSearchTool(extendedOptions.fileSearchStoreNames)
    : null;

  if (fileSearchTool) {
    console.log(`[EMAIL-AI] Using FileSearch RAG with ${extendedOptions?.fileSearchStoreNames?.length} stores`);
  }

  try {
    const result = await studioClient.client.generateContent({
      model,
      contents: [
        { role: "user", parts: [{ text: systemPrompt }] },
        { role: "user", parts: [{ text: `EMAIL DA ANALIZZARE E A CUI RISPONDERE:\n\n${emailContent}` }] },
      ],
      generationConfig: {
        temperature: 0.5,
        maxOutputTokens: 4096,
      },
      ...(fileSearchTool && { tools: [fileSearchTool] }),
    });

    // Parse citations from File Search response
    let documentCitations: string[] = [];
    if (extendedOptions?.fileSearchStoreNames?.length) {
      const citations = fileSearchService.parseCitations(result.response);
      documentCitations = citations.map(c => c.sourceTitle).filter(Boolean);
      if (documentCitations.length > 0) {
        console.log(`[EMAIL-AI] Parsed ${documentCitations.length} citations from File Search: ${documentCitations.join(', ')}`);
      }
    }

    const responseText = result.response.text();
    let cleanedResponse = responseText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    
    const parsed = JSON.parse(cleanedResponse) as AIStructuredResponse;
    
    return {
      response: parsed.response || "",
      confidence: Math.min(1, Math.max(0, parsed.confidence || 0.5)),
      category: parsed.category || "other",
      sentiment: parsed.sentiment || "neutral",
      urgency: parsed.urgency || "medium",
      createTicket: parsed.createTicket ?? false,
      ticketReason: parsed.ticketReason || null,
      ticketPriority: parsed.ticketPriority || null,
      suggestedActions: Array.isArray(parsed.suggestedActions) ? parsed.suggestedActions : [],
      documentCitations,
    };
  } catch (error: any) {
    console.error("[EMAIL-AI] Structured response generation error:", error);
    
    return {
      response: `Grazie per la sua email. La contatterò al più presto.${
        accountSettings.signature ? `\n\n${accountSettings.signature}` : ""
      }`,
      confidence: 0.3,
      category: "other",
      sentiment: "neutral",
      urgency: "medium",
      createTicket: true,
      ticketReason: `Errore nella generazione AI: ${error.message}`,
      ticketPriority: "medium",
      suggestedActions: ["Revisione manuale richiesta"],
    };
  }
}

async function logAIDecision(params: {
  consultantId: string;
  emailId: string;
  accountId: string;
  aiResponse: AIStructuredResponse;
  decisionResult: DecisionEngineResult;
  ticketId?: string | null;
  usedKnowledgeBase: boolean;
  sources?: string[];
  autoSendEnabled: boolean;
}): Promise<string> {
  const { consultantId, emailId, accountId, aiResponse, decisionResult, ticketId, usedKnowledgeBase, sources, autoSendEnabled } = params;
  
  const [inserted] = await db.insert(schema.emailAiDecisions).values({
    consultantId,
    emailId,
    accountId,
    response: aiResponse.response,
    confidence: aiResponse.confidence,
    category: aiResponse.category,
    sentiment: aiResponse.sentiment,
    urgency: aiResponse.urgency,
    createTicket: aiResponse.createTicket,
    ticketReason: aiResponse.ticketReason,
    ticketPriority: aiResponse.ticketPriority,
    ticketId: ticketId || null,
    usedKnowledgeBase,
    sources: sources || [],
    actionTaken: decisionResult.action,
    confidenceThreshold: decisionResult.confidenceThreshold,
    autoSendEnabled,
    suggestedActions: aiResponse.suggestedActions,
  }).returning({ id: schema.emailAiDecisions.id });
  
  console.log(`[EMAIL-AI] Logged AI decision ${inserted.id} for email ${emailId}: action=${decisionResult.action}, confidence=${aiResponse.confidence}`);
  
  return inserted.id;
}

export interface ExtendedAccountSettings extends AccountSettings {
  customInstructions?: string | null;
  aiLanguage?: string | null;
  escalationKeywords?: string[] | null;
  stopOnRisk?: boolean | null;
  bookingLink?: string | null;
  autoSendEnabled?: boolean;
}

export interface ClassifyAndGenerateResult {
  classification: EmailClassification;
  draft: EmailDraft | null;
  kbSearchResult?: {
    found: boolean;
    documentsCount: number;
    storeNamesUsed?: string[];
  };
  ticketCreated?: boolean;
  ticketId?: string;
  stoppedByRisk?: boolean;
  riskReason?: string;
  aiResponse?: AIStructuredResponse;
  decisionAction?: AIDecisionAction;
  decisionId?: string;
  documentCitationsUsed?: string[];
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

  let fileSearchStoreNames = kbResult.found ? kbResult.storeNames || [] : [];
  
  const emailAccountStore = await FileSearchSyncService.getEmailAccountStore(email.accountId);
  if (emailAccountStore) {
    console.log(`[EMAIL-AI] Adding email account store: ${emailAccountStore}`);
    fileSearchStoreNames = [...fileSearchStoreNames, emailAccountStore];
  }
  
  if (fileSearchStoreNames.length > 0) {
    console.log(`[EMAIL-AI] FileSearch RAG enabled with ${kbResult.totalDocuments || 0} documents in ${fileSearchStoreNames.length} stores`);
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

  const aiResponse = await generateStructuredAIResponse(
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

  const autoSendEnabled = extendedSettings?.autoSendEnabled ?? false;
  const decisionResult = executeDecisionEngine({
    aiResponse,
    autoSendEnabled,
  });

  if (decisionResult.shouldCreateTicket && !ticketCreated) {
    console.log(`[EMAIL-AI] Decision engine requests ticket creation: ${aiResponse.ticketReason}`);
    const ticket = await createTicketFromEmail(
      emailId,
      consultantId,
      email.accountId,
      "ai_low_confidence",
      {
        reasonDetails: aiResponse.ticketReason || `AI confidence troppo bassa: ${aiResponse.confidence}`,
        aiClassification: classification,
        priority: aiResponse.ticketPriority || "medium",
        suggestedResponse: aiResponse.response,
      }
    );
    ticketCreated = !!ticket;
    ticketId = ticket?.id;
  }

  const decisionId = await logAIDecision({
    consultantId,
    emailId,
    accountId: email.accountId,
    aiResponse,
    decisionResult,
    ticketId,
    usedKnowledgeBase: kbResult.found || !!emailAccountStore,
    sources: kbResult.storeNames,
    autoSendEnabled,
  });

  const draft: EmailDraft = {
    subject: originalEmail.subject?.startsWith("Re:") 
      ? originalEmail.subject 
      : `Re: ${originalEmail.subject || "Senza oggetto"}`,
    bodyHtml: `<p>${aiResponse.response.replace(/\n/g, "<br>")}</p>`,
    bodyText: aiResponse.response,
    confidence: aiResponse.confidence,
    modelUsed: GEMINI_3_MODEL,
  };

  return { 
    classification, 
    draft,
    kbSearchResult: {
      found: kbResult.found,
      documentsCount: kbResult.totalDocuments || 0,
      storeNamesUsed: fileSearchStoreNames,
    },
    ticketCreated,
    ticketId,
    aiResponse,
    decisionAction: decisionResult.action,
    decisionId,
    documentCitationsUsed: aiResponse.documentCitations,
  };
}

export { CATEGORY_CONFIDENCE_THRESHOLDS };
