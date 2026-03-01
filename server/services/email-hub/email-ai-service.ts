import { db } from "../../db";
import * as schema from "@shared/schema";
import { eq, and, sql } from "drizzle-orm";
import { getGoogleAIStudioClientForFileSearch, GEMINI_3_MODEL } from "../../ai/provider-factory";
import { GoogleGenAI } from "@google/genai";
import { searchKnowledgeBase } from "./email-knowledge-service";
import { createTicketFromEmail, getTicketSettings } from "./ticket-webhook-service";
import { FileSearchService, fileSearchService } from "../../ai/file-search-service";
import { FileSearchSyncService } from "../file-search-sync-service";
import { resolveHunterContext, formatHunterContextForPrompt } from "../hunter-context-resolver";


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
  studioClient.setFeature?.('email-hub-ai');
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
  studioClient.setFeature?.('email-hub-ai');
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
  studioClient.setFeature?.('email-hub-ai');
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
  skipTicketCreation?: boolean;
}

export interface SkipAutoResponseResult {
  shouldSkip: boolean;
  reason?: string;
}

export function shouldSkipAutoResponse(email: {
  subject?: string | null;
  fromEmail: string;
  direction: string;
  bodyText?: string | null;
  bodyHtml?: string | null;
}): SkipAutoResponseResult {
  const subject = (email.subject || "").toLowerCase();
  const fromEmail = email.fromEmail.toLowerCase();
  const bodyText = (email.bodyText || "").toLowerCase();
  const bodyHtml = (email.bodyHtml || "").toLowerCase();

  if (email.direction === "outbound") {
    return { shouldSkip: true, reason: "outbound_email" };
  }

  const smtpTestPatterns = ["test connessione", "test smtp", "smtp test", "test email"];
  for (const pattern of smtpTestPatterns) {
    if (subject.includes(pattern)) {
      return { shouldSkip: true, reason: `smtp_test: subject contains "${pattern}"` };
    }
  }

  const noReplyPatterns = ["noreply@", "no-reply@", "mailer-daemon", "postmaster"];
  for (const pattern of noReplyPatterns) {
    if (fromEmail.includes(pattern)) {
      return { shouldSkip: true, reason: `auto_confirmation: from contains "${pattern}"` };
    }
  }

  const marketingFromPatterns = ["newsletter@", "marketing@"];
  for (const pattern of marketingFromPatterns) {
    if (fromEmail.includes(pattern)) {
      return { shouldSkip: true, reason: `newsletter_marketing: from contains "${pattern}"` };
    }
  }

  if (bodyHtml.includes("list-unsubscribe") || bodyText.includes("list-unsubscribe")) {
    return { shouldSkip: true, reason: "newsletter_marketing: List-Unsubscribe header detected" };
  }
  if (bodyHtml.includes("precedence: bulk") || bodyText.includes("precedence: bulk")) {
    return { shouldSkip: true, reason: "newsletter_marketing: Precedence bulk detected" };
  }

  const bouncePatterns = ["delivery failed", "undeliverable", "mail delivery", "delivery status"];
  for (const pattern of bouncePatterns) {
    if (subject.includes(pattern)) {
      return { shouldSkip: true, reason: `bounce_delivery: subject contains "${pattern}"` };
    }
  }

  const oooPatterns = ["fuori ufficio", "out of office", "automatic reply", "auto-submitted", "auto-reply"];
  for (const pattern of oooPatterns) {
    if (subject.includes(pattern)) {
      return { shouldSkip: true, reason: `auto_reply_ooo: subject contains "${pattern}"` };
    }
  }

  if (bodyText.includes("auto-submitted: auto-replied") || bodyHtml.includes("auto-submitted: auto-replied")) {
    return { shouldSkip: true, reason: "auto_reply_ooo: Auto-Submitted header detected" };
  }

  return { shouldSkip: false };
}

export interface MillieActionResult {
  type: "mark_interested" | "create_reminder" | "mark_lost" | "cancel_followups" | "suppress_response" | "mark_needs_review";
  success: boolean;
  details: string;
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
  skippedByFilter?: boolean;
  skipReason?: string;
  aiResponse?: AIStructuredResponse;
  decisionAction?: AIDecisionAction;
  decisionId?: string;
  documentCitationsUsed?: string[];
  emailType?: EmailType;
  responseIntent?: ResponseIntent;
  millieActions?: MillieActionResult[];
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

export interface ContactContext {
  source: "lead_scraper" | "proactive_lead" | "client" | "unknown";
  summary: string;
  data?: Record<string, any>;
  crossChannelContext?: string;
}

async function buildCrossChannelContext(
  fromEmail: string,
  consultantId: string,
  phoneNumber?: string | null
): Promise<string> {
  const sections: string[] = [];
  const MAX_TOTAL_CHARS = 20000;

  try {
    if (phoneNumber) {
      const cleanPhone = phoneNumber.replace(/\s+/g, "").replace(/^\+/, "");

      const waConversations = await db.execute(
        sql`SELECT wc.id, wc.phone_number, wc.last_message_at,
                   COALESCE(pl.first_name || ' ' || pl.last_name, u.first_name || ' ' || u.last_name, '') as resolved_name
            FROM whatsapp_conversations wc
            LEFT JOIN proactive_leads pl ON pl.phone_number = wc.phone_number AND pl.consultant_id = wc.consultant_id
            LEFT JOIN users u ON u.id = wc.user_id
            WHERE wc.consultant_id = ${consultantId}
            AND (wc.phone_number LIKE ${'%' + cleanPhone} OR wc.phone_number LIKE ${'%' + cleanPhone.slice(-10)})
            ORDER BY wc.last_message_at DESC NULLS LAST
            LIMIT 1`
      );

      if (waConversations.rows && waConversations.rows.length > 0) {
        const conv = waConversations.rows[0] as any;
        const convId = conv.id;
        const contactName = (conv.resolved_name || '').trim();
        const lastMsgAt = conv.last_message_at ? new Date(conv.last_message_at).toLocaleDateString("it-IT") : '';

        const waMessages = await db.execute(
          sql`SELECT message_text, direction, sender, created_at, message_type
              FROM whatsapp_messages
              WHERE conversation_id = ${convId}
              ORDER BY created_at DESC
              LIMIT 8`
        );

        if (waMessages.rows && waMessages.rows.length > 0) {
          const msgs = (waMessages.rows as any[]).reverse().map((m: any) => {
            const date = m.created_at ? new Date(m.created_at).toLocaleDateString("it-IT", { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : "";
            const dir = m.direction === "inbound" ? "←" : "→";
            const text = (m.message_text || "").substring(0, 150);
            const typeTag = m.message_type && m.message_type !== 'text' ? ` [${m.message_type}]` : '';
            return `  ${dir} [${date}] ${text}${typeTag}`;
          });
          const header = contactName ? `- WhatsApp con ${contactName} (ultimi ${msgs.length} msg, ultimo: ${lastMsgAt}):` : `- WhatsApp (ultimi ${msgs.length} msg):`;
          sections.push(`${header}\n${msgs.join("\n")}`);
        }
      }

      const voiceCalls = await db.execute(
        sql`SELECT started_at, duration_seconds, outcome, full_transcript, caller_id, called_number
            FROM voice_calls
            WHERE consultant_id = ${consultantId}
            AND (caller_id LIKE ${'%' + cleanPhone} OR called_number LIKE ${'%' + cleanPhone}
                 OR caller_id LIKE ${'%' + cleanPhone.slice(-10)} OR called_number LIKE ${'%' + cleanPhone.slice(-10)})
            ORDER BY started_at DESC
            LIMIT 3`
      );

      if (voiceCalls.rows && voiceCalls.rows.length > 0) {
        const calls = (voiceCalls.rows as any[]).map((c: any) => {
          const date = c.started_at ? new Date(c.started_at).toLocaleDateString("it-IT", { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : "N/D";
          const duration = c.duration_seconds ? `${Math.round(c.duration_seconds / 60)} min` : "N/D";
          const outcome = c.outcome || "N/D";
          const isOutbound = (c.called_number || '').includes(cleanPhone.slice(-10));
          const callDir = isOutbound ? '📞→' : '📞←';
          const transcript = c.full_transcript ? (c.full_transcript as string).substring(0, 200) : '';
          return `  ${callDir} [${date}] Durata: ${duration} - Esito: ${outcome}${transcript ? `\n    Riassunto: ${transcript}` : ""}`;
        });
        sections.push(`- Chiamate vocali (ultime ${calls.length}):\n${calls.join("\n")}`);
      }
    }

    const normalizedEmail = fromEmail.toLowerCase().trim();
    const previousEmails = await db.execute(
      sql`SELECT subject, direction, received_at, sent_at, snippet, processing_status, email_type
          FROM hub_emails
          WHERE consultant_id = ${consultantId}
          AND (LOWER(from_email) = ${normalizedEmail} OR LOWER(to_recipients::text) LIKE ${'%' + normalizedEmail + '%'})
          ORDER BY COALESCE(received_at, sent_at, created_at) DESC
          LIMIT 15`
    );

    if (previousEmails.rows && previousEmails.rows.length > 0) {
      const emails = (previousEmails.rows as any[]).map((e: any) => {
        const date = (e.received_at || e.sent_at) ? new Date(e.received_at || e.sent_at).toLocaleDateString("it-IT", { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : "N/D";
        const dir = e.direction === "inbound" ? "←" : "→";
        const subj = (e.subject || "(Senza oggetto)").substring(0, 80);
        const snippet = e.snippet ? ` — ${(e.snippet as string).substring(0, 80)}` : '';
        const statusTag = e.processing_status === 'sent' ? '' : e.processing_status === 'ignored' ? ' [ignorata]' : '';
        return `  ${dir} [${date}] ${subj}${snippet}${statusTag}`;
      });
      sections.push(`- Email precedenti (${emails.length} nel thread bidirezionale):\n${emails.join("\n")}`);
    }

    const aiTasks = await db.execute(
      sql`SELECT task_type, ai_instruction, status, scheduled_at, result_data, ai_role, preferred_channel
          FROM ai_scheduled_tasks
          WHERE consultant_id = ${consultantId}
          AND (
            contact_name ILIKE ${'%' + normalizedEmail.split('@')[0] + '%'}
            OR additional_context::text ILIKE ${'%' + normalizedEmail + '%'}
          )
          AND created_at > NOW() - INTERVAL '60 days'
          ORDER BY created_at DESC
          LIMIT 5`
    );

    if (aiTasks.rows && aiTasks.rows.length > 0) {
      const tasks = (aiTasks.rows as any[]).map((t: any) => {
        const date = t.scheduled_at ? new Date(t.scheduled_at).toLocaleDateString("it-IT") : "N/D";
        const role = t.ai_role || 'ai';
        const channel = t.preferred_channel || '';
        const status = t.status || '';
        const instruction = (t.ai_instruction || "").substring(0, 100);
        return `  [${date}] ${role}/${channel} — ${status} — ${instruction}`;
      });
      sections.push(`- Task AI recenti per questo contatto (${tasks.length}):\n${tasks.join("\n")}`);
    }

    if (phoneNumber || normalizedEmail) {
      const hunterActions = await db.execute(
        sql`SELECT lead_name, channel, status, result_note, created_at
            FROM hunter_actions
            WHERE consultant_id = ${consultantId}
            AND (
              lead_email ILIKE ${normalizedEmail}
              OR (lead_phone IS NOT NULL AND lead_phone LIKE ${'%' + (phoneNumber || '___NOMATCH___').replace(/\s+/g, "").replace(/^\+/, "").slice(-10)})
            )
            ORDER BY created_at DESC
            LIMIT 5`
      );

      if (hunterActions.rows && hunterActions.rows.length > 0) {
        const actions = (hunterActions.rows as any[]).map((a: any) => {
          const date = a.created_at ? new Date(a.created_at).toLocaleDateString("it-IT") : "N/D";
          const note = (a.result_note || "").substring(0, 100);
          const name = a.lead_name || '';
          return `  [${date}] ${name} via ${a.channel} — ${a.status}${note ? `: ${note}` : ''}`;
        });
        sections.push(`- Azioni Hunter su questo lead (${actions.length}):\n${actions.join("\n")}`);
      }
    }

  } catch (error: any) {
    console.error(`[EMAIL-AI] Error building cross-channel context:`, error.message);
  }

  if (sections.length === 0) {
    return "";
  }

  let result = "STORICO COMUNICAZIONI CON QUESTO CONTATTO:\n" + sections.join("\n");

  if (result.length > MAX_TOTAL_CHARS) {
    result = result.substring(0, MAX_TOTAL_CHARS - 3) + "...";
  }

  return result;
}

export async function buildContactContext(fromEmail: string, consultantId: string): Promise<ContactContext> {
  let contactResult: ContactContext;
  let phoneNumber: string | null = null;

  try {
    const normalizedEmail = fromEmail.toLowerCase().trim();

    const leadResults = await db.execute(
      sql`SELECT r.business_name, r.category, r.ai_compatibility_score, r.ai_sales_summary, r.lead_status, r.website, r.email, r.phone
          FROM lead_scraper_results r
          JOIN lead_scraper_searches s ON r.search_id = s.id
          WHERE s.consultant_id = ${consultantId}
          AND LOWER(r.email) = ${normalizedEmail}
          LIMIT 1`
    );

    if (leadResults.rows && leadResults.rows.length > 0) {
      const lead = leadResults.rows[0] as any;
      const parts: string[] = [];
      if (lead.business_name) parts.push(`Attività: ${lead.business_name}`);
      if (lead.category) parts.push(`Settore: ${lead.category}`);
      if (lead.ai_compatibility_score) parts.push(`Compatibilità AI: ${lead.ai_compatibility_score}/100`);
      if (lead.lead_status) parts.push(`Stato lead: ${lead.lead_status}`);
      if (lead.website) parts.push(`Sito web: ${lead.website}`);
      if (lead.ai_sales_summary) parts.push(`Analisi AI: ${lead.ai_sales_summary}`);

      phoneNumber = lead.phone || null;

      console.log(`[EMAIL-AI] Contact context found in lead_scraper_results for ${normalizedEmail}`);
      contactResult = {
        source: "lead_scraper",
        summary: parts.length > 0 ? parts.join("\n") : "Lead trovato nel CRM ma senza dettagli aggiuntivi",
        data: lead,
      };
    } else {
      const proactiveResults = await db
        .select()
        .from(schema.proactiveLeads)
        .where(and(
          eq(schema.proactiveLeads.consultantId, consultantId),
          sql`LOWER(${schema.proactiveLeads.email}) = ${normalizedEmail}`
        ))
        .limit(1);

      if (proactiveResults.length > 0) {
        const lead = proactiveResults[0];
        const parts: string[] = [];
        parts.push(`Nome: ${lead.firstName} ${lead.lastName}`);
        if (lead.phoneNumber) parts.push(`Telefono: ${lead.phoneNumber}`);
        if (lead.status) parts.push(`Stato: ${lead.status}`);
        if (lead.metadata && typeof lead.metadata === 'object' && (lead.metadata as any).notes) {
          parts.push(`Note: ${(lead.metadata as any).notes}`);
        }
        const leadInfo = lead.leadInfo as any;
        if (leadInfo?.email) parts.push(`Email lead: ${leadInfo.email}`);
        if (leadInfo?.companyName) parts.push(`Azienda: ${leadInfo.companyName}`);

        phoneNumber = lead.phoneNumber || null;

        console.log(`[EMAIL-AI] Contact context found in proactive_leads for ${normalizedEmail}`);

        const hunterCtx = await resolveHunterContext({
          consultantId,
          email: normalizedEmail,
          proactiveLeadId: lead.id,
          phoneNumber: lead.phoneNumber || undefined,
        });
        if (hunterCtx) {
          if (hunterCtx.businessName) parts.push(`Attività: ${hunterCtx.businessName}`);
          if (hunterCtx.sector) parts.push(`Settore: ${hunterCtx.sector}`);
          if (hunterCtx.score) parts.push(`Compatibilità AI: ${hunterCtx.score}/100`);
          if (hunterCtx.website) parts.push(`Sito web: ${hunterCtx.website}`);
          if (hunterCtx.aiSalesSummary) parts.push(`Analisi AI: ${hunterCtx.aiSalesSummary}`);
          console.log(`🔍 [EMAIL-AI] Enriched proactive_lead with Hunter context: ${hunterCtx.businessName}`);
        }

        contactResult = {
          source: "proactive_lead",
          summary: parts.join("\n"),
          data: {
            firstName: lead.firstName,
            lastName: lead.lastName,
            phoneNumber: lead.phoneNumber,
            status: lead.status,
            notes: (lead.metadata as any)?.notes,
          },
        };
      } else {
        const clientResults = await db
          .select()
          .from(schema.users)
          .where(and(
            eq(schema.users.role, "client"),
            sql`LOWER(${schema.users.email}) = ${normalizedEmail}`
          ))
          .limit(1);

        if (clientResults.length > 0) {
          const client = clientResults[0];
          const parts: string[] = [];
          parts.push(`Nome: ${client.firstName} ${client.lastName}`);
          if (client.level) parts.push(`Livello: ${client.level}`);
          if (client.createdAt) parts.push(`Registrato il: ${new Date(client.createdAt).toLocaleDateString("it-IT")}`);

          phoneNumber = client.phoneNumber || null;

          console.log(`[EMAIL-AI] Contact context found in users (client) for ${normalizedEmail}`);
          contactResult = {
            source: "client",
            summary: parts.join("\n"),
            data: {
              userId: client.id,
              firstName: client.firstName,
              lastName: client.lastName,
              level: client.level,
              createdAt: client.createdAt,
            },
          };
        } else {
          console.log(`[EMAIL-AI] No contact context found for ${normalizedEmail}`);
          contactResult = {
            source: "unknown",
            summary: "Contatto sconosciuto - nessun dato CRM disponibile",
          };
        }
      }
    }

    const crossChannel = await buildCrossChannelContext(fromEmail, consultantId, phoneNumber);
    if (crossChannel) {
      contactResult.crossChannelContext = crossChannel;
      console.log(`[EMAIL-AI] Cross-channel context added (${crossChannel.length} chars) for ${fromEmail}`);
    }

    return contactResult;
  } catch (error: any) {
    console.error(`[EMAIL-AI] Error building contact context for ${fromEmail}:`, error.message);
    return {
      source: "unknown",
      summary: "Contatto sconosciuto - errore nel recupero dati CRM",
    };
  }
}

export async function syncSalesAgentToEmailKB(consultantId: string, accountId: string): Promise<{ synced: boolean; error?: string }> {
  try {
    const [salesContext] = await db
      .select()
      .from(schema.leadScraperSalesContext)
      .where(eq(schema.leadScraperSalesContext.consultantId, consultantId))
      .limit(1);

    if (!salesContext) {
      console.log(`[EMAIL-AI] No Sales Agent context found for consultant ${consultantId}`);
      return { synced: false, error: "No sales context found" };
    }

    const contentParts: string[] = ["=== SALES AGENT CONTEXT ===\n"];
    if (salesContext.servicesOffered) contentParts.push(`SERVIZI OFFERTI:\n${salesContext.servicesOffered}\n`);
    if (salesContext.targetAudience) contentParts.push(`TARGET AUDIENCE:\n${salesContext.targetAudience}\n`);
    if (salesContext.valueProposition) contentParts.push(`PROPOSTA DI VALORE:\n${salesContext.valueProposition}\n`);
    if (salesContext.pricingInfo) contentParts.push(`INFORMAZIONI PREZZI:\n${salesContext.pricingInfo}\n`);
    if (salesContext.competitiveAdvantages) contentParts.push(`VANTAGGI COMPETITIVI:\n${salesContext.competitiveAdvantages}\n`);
    if (salesContext.idealClientProfile) contentParts.push(`PROFILO CLIENTE IDEALE:\n${salesContext.idealClientProfile}\n`);
    if (salesContext.salesApproach) contentParts.push(`APPROCCIO COMMERCIALE:\n${salesContext.salesApproach}\n`);
    if (salesContext.caseStudies) contentParts.push(`CASI STUDIO:\n${salesContext.caseStudies}\n`);
    if (salesContext.additionalContext) contentParts.push(`CONTESTO AGGIUNTIVO:\n${salesContext.additionalContext}\n`);

    const content = contentParts.join("\n");

    const [existing] = await db
      .select()
      .from(schema.emailAccountKnowledgeItems)
      .where(and(
        eq(schema.emailAccountKnowledgeItems.accountId, accountId),
        eq(schema.emailAccountKnowledgeItems.consultantId, consultantId),
        eq(schema.emailAccountKnowledgeItems.sourceType, "sales_agent_context")
      ))
      .limit(1);

    if (existing) {
      await db
        .update(schema.emailAccountKnowledgeItems)
        .set({
          content,
          title: "Sales Agent Context (Auto-Sync)",
          updatedAt: new Date(),
        })
        .where(eq(schema.emailAccountKnowledgeItems.id, existing.id));
      console.log(`[EMAIL-AI] Updated Sales Agent context in email KB for account ${accountId}`);
    } else {
      await db
        .insert(schema.emailAccountKnowledgeItems)
        .values({
          accountId,
          consultantId,
          title: "Sales Agent Context (Auto-Sync)",
          type: "text",
          content,
          sourceType: "sales_agent_context",
          order: 999,
        });
      console.log(`[EMAIL-AI] Created Sales Agent context in email KB for account ${accountId}`);
    }

    return { synced: true };
  } catch (error: any) {
    console.error(`[EMAIL-AI] Error syncing Sales Agent to email KB:`, error.message);
    return { synced: false, error: error.message };
  }
}

export type ResponseIntent =
  | "lead_info_request"
  | "lead_call_accept"
  | "lead_not_interested"
  | "lead_callback_later"
  | "client_problem"
  | "enthusiastic_response"
  | "generic";

export interface SmartSkipResult {
  shouldSkip: boolean;
  reason?: string;
  leadAction?: "mark_lost" | null;
}

const MINIMAL_REPLY_PATTERNS = [
  /^\s*(ok|okay|va bene|ricevuto|grazie|thanks|thank you|perfetto|capito)\s*[.!]?\s*$/i,
];

const UNSUBSCRIBE_PATTERNS = [
  "non mi contattare",
  "non contattatemi",
  "rimuovetemi",
  "rimuovimi",
  "cancella il mio contatto",
  "non voglio essere contattato",
  "stop",
  "unsubscribe",
  "remove me",
  "do not contact",
  "non mi scrivere più",
  "non scrivetemi più",
  "basta email",
  "non voglio più ricevere",
];

export function detectSmartSkip(email: {
  bodyText?: string | null;
  direction: string;
  threadHistory?: Array<{ fromEmail: string; bodyText?: string | null }>;
  fromEmail: string;
  accountEmail?: string | null;
}): SmartSkipResult {
  const bodyText = (email.bodyText || "").trim();

  for (const pattern of MINIMAL_REPLY_PATTERNS) {
    if (pattern.test(bodyText)) {
      return { shouldSkip: true, reason: `minimal_reply: body matches "${bodyText}"` };
    }
  }

  const bodyLower = bodyText.toLowerCase();
  for (const pattern of UNSUBSCRIBE_PATTERNS) {
    if (bodyLower.includes(pattern)) {
      return { shouldSkip: true, reason: `lead_unsubscribe: "${pattern}"`, leadAction: "mark_lost" };
    }
  }

  if (email.threadHistory && email.threadHistory.length > 0) {
    const lastMsg = email.threadHistory[email.threadHistory.length - 1];
    const accountEmail = (email.accountEmail || "").toLowerCase().trim();
    if (accountEmail && lastMsg.fromEmail.toLowerCase().trim() === accountEmail) {
      return { shouldSkip: true, reason: "last_message_is_ours: the last message in the thread is from us" };
    }
  }

  return { shouldSkip: false };
}

export function detectResponseIntent(email: {
  bodyText?: string | null;
  subject?: string | null;
}, contactSource: "lead_scraper" | "proactive_lead" | "client" | "unknown", emailType: EmailType): ResponseIntent {
  const bodyLower = (email.bodyText || "").toLowerCase();
  const subjectLower = (email.subject || "").toLowerCase();
  const text = `${subjectLower} ${bodyLower}`;

  const isLead = contactSource === "lead_scraper" || contactSource === "proactive_lead" || emailType === "hunter_reply" || emailType === "lead_inquiry";
  const isClient = contactSource === "client" || emailType === "client_inquiry";

  const callAcceptPatterns = [
    "ok per una call", "sì per la call", "ci vediamo", "fissiamo", "quando possiamo sentirci",
    "va bene per un incontro", "organizziamo una chiamata", "sono disponibile",
    "sentiamoci", "chiamiamoci", "facciamo una call", "prenoto", "prenotiamo",
    "ok per l'appuntamento", "confermo l'appuntamento", "ok, quando",
  ];
  for (const p of callAcceptPatterns) {
    if (text.includes(p)) return "lead_call_accept";
  }

  const notInterestedPatterns = [
    "non mi interessa", "non sono interessato", "non sono interessata",
    "non fa per me", "non è il momento", "lasciate perdere",
    "non mi contattare più", "non voglio", "non ho bisogno",
  ];
  for (const p of notInterestedPatterns) {
    if (text.includes(p)) return "lead_not_interested";
  }

  const callbackPatterns = [
    "richiamami", "richiamatemi", "tra una settimana", "tra qualche giorno",
    "sentiamoci più avanti", "non è il momento ma", "magari più avanti",
    "ricontattami", "ricontattatemi", "dopo le ferie", "dopo natale",
    "dopo pasqua", "a settembre", "il prossimo mese",
  ];
  for (const p of callbackPatterns) {
    if (text.includes(p)) return "lead_callback_later";
  }

  if (isClient) {
    const problemPatterns = [
      "problema", "non funziona", "errore", "aiuto", "urgente", "bloccato",
      "non riesco", "rotto", "bug", "difetto", "guasto", "reclamo",
      "lamentela", "insoddisfatto", "deluso",
    ];
    for (const p of problemPatterns) {
      if (text.includes(p)) return "client_problem";
    }
  }

  const enthusiasticPatterns = [
    "fantastico", "perfetto", "ottimo", "grandioso", "eccellente",
    "non vedo l'ora", "entusiasta", "sono pronto", "partiamo",
    "facciamo", "iniziamo", "wow", "stupendo", "meraviglioso",
    "ci sto", "andiamo", "procediamo",
  ];
  for (const p of enthusiasticPatterns) {
    if (text.includes(p)) return "enthusiastic_response";
  }

  if (isLead) {
    const infoPatterns = [
      "informazioni", "info", "saperne di più", "come funziona",
      "quanto costa", "prezzi", "dettagli", "listino", "preventivo",
      "offerta", "proposta", "catalogo", "brochure", "documentazione",
    ];
    for (const p of infoPatterns) {
      if (text.includes(p)) return "lead_info_request";
    }
  }

  return "generic";
}

const ADAPTIVE_RESPONSE_STRATEGIES: Record<ResponseIntent, string> = {
  lead_info_request: `STRATEGIA DI RISPOSTA: LEAD CHIEDE INFORMAZIONI
- Tono: Commerciale, propositivo, entusiasta ma professionale
- Obiettivo: Fornire info chiave e spingere verso una call/appuntamento conoscitivo
- Usa i dati del Sales Agent (servizi, pricing, vantaggi competitivi) per rispondere
- Includi il booking link se disponibile: "Le propongo una breve call conoscitiva di 15 minuti per approfondire"
- NON essere evasivo: rispondi alla domanda e poi proponi il passo successivo
- Chiudi con una call-to-action chiara`,

  lead_call_accept: `STRATEGIA DI RISPOSTA: LEAD ACCETTA UNA CALL
- Tono: Entusiasta, professionale, risolutivo
- Obiettivo: Confermare l'appuntamento e proporre slot
- Includi SEMPRE il booking link per prenotare
- Espressioni tipo: "Ottimo! Sono felice che possiamo approfondire insieme."
- Proponi 2-3 slot orari concreti se non c'è booking link
- Conferma cosa verrà discusso nella call
- Chiudi con entusiasmo: "Non vedo l'ora di sentirla!"`,

  lead_not_interested: `STRATEGIA DI RISPOSTA: LEAD NON INTERESSATO
- Tono: Rispettoso, professionale, NON insistente
- Obiettivo: Lasciare la porta aperta senza pressione
- NON cercare di convincere o insistere
- Ringrazia per il tempo: "La ringrazio per la risposta diretta"
- Lascia porta aperta: "Se in futuro dovesse avere bisogno, saremo qui"
- Risposta BREVE (max 3-4 righe)
- NON proporre alternative, sconti o urgenze`,

  lead_callback_later: `STRATEGIA DI RISPOSTA: LEAD CHIEDE DI RICONTATTARE PIÙ TARDI
- Tono: Comprensivo, paziente, professionale
- Obiettivo: Confermare il follow-up e fissare un promemoria
- Conferma: "Perfetto, la ricontatterò [periodo indicato]"
- Se indica una data specifica, confermala
- Se vago ("più avanti"), proponi: "Le va bene se la ricontatto tra 2 settimane?"
- NON aggiungere pressione o urgenza
- Chiudi con: "Le auguro una buona giornata, a presto!"`,

  client_problem: `STRATEGIA DI RISPOSTA: CLIENTE CON PROBLEMA
- Tono: Empatico, risolutivo, rassicurante
- Obiettivo: Risolvere o escalare il problema velocemente
- Inizia con empatia: "Mi dispiace per il disagio" / "Capisco la situazione"
- Proponi soluzione immediata se possibile
- Se non puoi risolvere: "Ho segnalato la situazione e verrà gestita con priorità"
- Dai un tempo di risoluzione stimato se possibile
- Chiudi con rassicurazione: "Resto a disposizione per qualsiasi aggiornamento"
- Se grave: suggerisci di creare un ticket`,

  enthusiastic_response: `STRATEGIA DI RISPOSTA: RISPOSTA ENTUSIASTA
- Tono: Energico, propositivo, accelerante
- Obiettivo: Capitalizzare l'entusiasmo e proporre azione concreta immediata
- Rispondi con uguale entusiasmo: "Perfetto! Sono felicissimo/a!"
- Proponi SUBITO il passo successivo concreto
- Se c'è booking link, includilo: "Prenotiamo subito una call!"
- NON perdere tempo con convenevoli lunghi
- Vai dritto al punto: cosa fare ORA
- Crea senso di momentum: "Non perdiamo tempo, ecco i prossimi passi..."`,

  generic: `STRATEGIA DI RISPOSTA: GENERICA
- Tono: Professionale e cortese
- Obiettivo: Rispondere in modo pertinente e utile
- Analizza il contenuto e rispondi alla domanda/richiesta specifica
- Se non hai info sufficienti, chiedi chiarimenti
- Proponi un passo successivo se appropriato`,
};

export function getAdaptiveResponseStrategy(intent: ResponseIntent): string {
  return ADAPTIVE_RESPONSE_STRATEGIES[intent] || ADAPTIVE_RESPONSE_STRATEGIES.generic;
}

export type EmailType = "hunter_reply" | "system_notification" | "client_inquiry" | "lead_inquiry" | "unknown";

export async function determineEmailType(
  email: { fromEmail: string; direction: string; inReplyTo?: string | null; subject?: string | null; bodyText?: string | null; bodyHtml?: string | null },
  consultantId: string,
  skipResult?: SkipAutoResponseResult,
  contactContext?: ContactContext
): Promise<EmailType> {
  if (skipResult?.shouldSkip) {
    return "system_notification";
  }

  if (email.inReplyTo) {
    const outboundMatch = await db
      .select({ id: schema.hubEmails.id })
      .from(schema.hubEmails)
      .where(
        and(
          eq(schema.hubEmails.consultantId, consultantId),
          eq(schema.hubEmails.direction, "outbound"),
          eq(schema.hubEmails.messageId, email.inReplyTo)
        )
      )
      .limit(1);

    if (outboundMatch.length > 0) {
      return "hunter_reply";
    }
  }

  if (contactContext) {
    if (contactContext.source === "client") return "client_inquiry";
    if (contactContext.source === "lead_scraper" || contactContext.source === "proactive_lead") return "lead_inquiry";
    return "unknown";
  }

  const normalizedEmail = email.fromEmail.toLowerCase().trim();

  const clientMatch = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(and(
      eq(schema.users.role, "client"),
      sql`LOWER(${schema.users.email}) = ${normalizedEmail}`
    ))
    .limit(1);

  if (clientMatch.length > 0) return "client_inquiry";

  const leadMatch = await db.execute(
    sql`SELECT r.id FROM lead_scraper_results r
        JOIN lead_scraper_searches s ON r.search_id = s.id
        WHERE s.consultant_id = ${consultantId}
        AND LOWER(r.email) = ${normalizedEmail}
        LIMIT 1`
  );

  if (leadMatch.rows && leadMatch.rows.length > 0) return "lead_inquiry";

  const proactiveMatch = await db
    .select({ id: schema.proactiveLeads.id })
    .from(schema.proactiveLeads)
    .where(and(
      eq(schema.proactiveLeads.consultantId, consultantId),
      sql`LOWER(${schema.proactiveLeads.email}) = ${normalizedEmail}`
    ))
    .limit(1);

  if (proactiveMatch.length > 0) return "lead_inquiry";

  return "unknown";
}

export async function executeMillieActions(params: {
  responseIntent: ResponseIntent;
  emailType: EmailType;
  contactContext: ContactContext;
  fromEmail: string;
  consultantId: string;
  accountId: string;
  emailId: string;
  aiConfidence: number;
  bookingLink?: string | null;
}): Promise<{ actions: MillieActionResult[]; suppressDraft: boolean }> {
  const { responseIntent, contactContext, fromEmail, consultantId, accountId, emailId, aiConfidence, bookingLink } = params;
  const actions: MillieActionResult[] = [];
  let suppressDraft = false;
  const normalizedEmail = fromEmail.toLowerCase().trim();

  try {
    if (responseIntent === "lead_call_accept") {
      console.log(`[MILLIE-ACTION] Lead ${fromEmail} - action: mark_interested - details: Lead accepted call`);
      try {
        await db.execute(
          sql`UPDATE lead_scraper_results SET lead_status = 'interested'
              WHERE id IN (
                SELECT r.id FROM lead_scraper_results r
                JOIN lead_scraper_searches s ON r.search_id = s.id
                WHERE s.consultant_id = ${consultantId}
                AND LOWER(r.email) = ${normalizedEmail}
              )`
        );
        await db.execute(
          sql`UPDATE proactive_leads SET status = 'interested'
              WHERE consultant_id = ${consultantId}
              AND LOWER(email) = ${normalizedEmail}`
        );
        actions.push({ type: "mark_interested", success: true, details: `Lead ${fromEmail} marked as interested (accepted call)` });
      } catch (err: any) {
        console.error(`[MILLIE-ACTION] Error marking lead as interested:`, err.message);
        actions.push({ type: "mark_interested", success: false, details: err.message });
      }
    }

    if (responseIntent === "lead_callback_later") {
      console.log(`[MILLIE-ACTION] Lead ${fromEmail} - action: create_reminder - details: Lead asked to be called back later`);
      try {
        const existingReminder = await db.execute(
          sql`SELECT id FROM ai_scheduled_tasks
              WHERE consultant_id = ${consultantId}
              AND status IN ('pending', 'scheduled', 'waiting_approval', 'deferred')
              AND result_data->>'source' = 'millie_reminder'
              AND result_data->>'target_email' = ${normalizedEmail}
              LIMIT 1`
        );

        if (existingReminder.rows.length === 0) {
          const reminderDate = new Date();
          reminderDate.setDate(reminderDate.getDate() + 14);

          await db.execute(
            sql`INSERT INTO ai_scheduled_tasks (
              id, consultant_id, contact_name, contact_phone, task_type,
              ai_instruction, scheduled_at, timezone, status, max_attempts,
              current_attempt, retry_delay_minutes, voice_direction,
              origin_type, task_category, ai_role, preferred_channel, priority,
              result_data, created_at, updated_at
            ) VALUES (
              ${'millie_rem_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7)},
              ${consultantId},
              ${contactContext.data?.business_name || contactContext.data?.firstName || fromEmail},
              ${contactContext.data?.phone || contactContext.data?.phoneNumber || ''},
              'ai_task',
              ${'Ricontattare ' + (contactContext.data?.business_name || contactContext.data?.firstName || fromEmail) + ' come richiesto via email. Il lead ha chiesto di essere ricontattato più avanti.'},
              ${reminderDate.toISOString()},
              'Europe/Rome',
              'waiting_approval',
              1,
              0,
              0,
              'outbound',
              'millie_auto',
              'follow_up',
              'millie',
              'email',
              5,
              ${JSON.stringify({ source: 'millie_reminder', target_email: normalizedEmail, original_email_id: emailId })}::jsonb,
              NOW(),
              NOW()
            )`
          );

          await db.execute(
            sql`UPDATE lead_scraper_results SET lead_status = 'callback_later', lead_next_action_date = ${reminderDate.toISOString()}
                WHERE id IN (
                  SELECT r.id FROM lead_scraper_results r
                  JOIN lead_scraper_searches s ON r.search_id = s.id
                  WHERE s.consultant_id = ${consultantId}
                  AND LOWER(r.email) = ${normalizedEmail}
                )`
          );

          actions.push({ type: "create_reminder", success: true, details: `Reminder created for ${reminderDate.toLocaleDateString('it-IT')} for lead ${fromEmail}` });
        } else {
          actions.push({ type: "create_reminder", success: true, details: `Reminder already exists for lead ${fromEmail}, skipping` });
        }
      } catch (err: any) {
        console.error(`[MILLIE-ACTION] Error creating reminder:`, err.message);
        actions.push({ type: "create_reminder", success: false, details: err.message });
      }
    }

    if (responseIntent === "lead_not_interested") {
      console.log(`[MILLIE-ACTION] Lead ${fromEmail} - action: mark_lost - details: Lead not interested`);
      try {
        await db.execute(
          sql`UPDATE lead_scraper_results SET lead_status = 'lost'
              WHERE id IN (
                SELECT r.id FROM lead_scraper_results r
                JOIN lead_scraper_searches s ON r.search_id = s.id
                WHERE s.consultant_id = ${consultantId}
                AND LOWER(r.email) = ${normalizedEmail}
              )`
        );
        await db.execute(
          sql`UPDATE proactive_leads SET status = 'lost'
              WHERE consultant_id = ${consultantId}
              AND LOWER(email) = ${normalizedEmail}`
        );
        actions.push({ type: "mark_lost", success: true, details: `Lead ${fromEmail} marked as lost (not interested)` });
      } catch (err: any) {
        console.error(`[MILLIE-ACTION] Error marking lead as lost:`, err.message);
        actions.push({ type: "mark_lost", success: false, details: err.message });
      }

      try {
        const cancelled = await db.execute(
          sql`UPDATE ai_scheduled_tasks
              SET status = 'cancelled', updated_at = NOW(),
                  result_summary = 'Cancelled: lead not interested'
              WHERE consultant_id = ${consultantId}
              AND status IN ('pending', 'scheduled', 'waiting_approval', 'deferred')
              AND (
                result_data->>'target_email' = ${normalizedEmail}
                OR additional_context::text LIKE ${'%' + normalizedEmail + '%'}
              )
              RETURNING id`
        );
        const cancelledCount = cancelled.rows.length;
        if (cancelledCount > 0) {
          console.log(`[MILLIE-ACTION] Lead ${fromEmail} - action: cancel_followups - cancelled ${cancelledCount} scheduled tasks`);
        }
        actions.push({ type: "cancel_followups", success: true, details: `Cancelled ${cancelledCount} follow-up tasks for ${fromEmail}` });
      } catch (err: any) {
        console.error(`[MILLIE-ACTION] Error cancelling follow-ups:`, err.message);
        actions.push({ type: "cancel_followups", success: false, details: err.message });
      }

      suppressDraft = true;
      actions.push({ type: "suppress_response", success: true, details: `Response suppressed for not-interested lead ${fromEmail}` });
      console.log(`[MILLIE-ACTION] Lead ${fromEmail} - action: suppress_response - details: Lead not interested, no auto-reply`);
    }

    if (aiConfidence < 0.5) {
      console.log(`[MILLIE-ACTION] Lead ${fromEmail} - action: mark_needs_review - details: Low AI confidence ${aiConfidence}`);
      try {
        await db
          .update(schema.hubEmails)
          .set({ processingStatus: "needs_review", updatedAt: new Date() })
          .where(eq(schema.hubEmails.id, emailId));
        actions.push({ type: "mark_needs_review", success: true, details: `Email marked needs_review (confidence: ${aiConfidence})` });
      } catch (err: any) {
        console.error(`[MILLIE-ACTION] Error marking needs_review:`, err.message);
        actions.push({ type: "mark_needs_review", success: false, details: err.message });
      }
    }

  } catch (error: any) {
    console.error(`[MILLIE-ACTION] Unexpected error in executeMillieActions:`, error.message);
  }

  return { actions, suppressDraft };
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

  const skipResult = shouldSkipAutoResponse({
    subject: email.subject,
    fromEmail: email.fromEmail,
    direction: email.direction,
    bodyText: email.bodyText,
    bodyHtml: email.bodyHtml,
  });

  if (skipResult.shouldSkip) {
    console.log(`[EMAIL-FILTER] Skipping auto-response for email "${email.subject}" - reason: ${skipResult.reason}`);
    
    const emailType = "system_notification" as EmailType;
    
    await db
      .update(schema.hubEmails)
      .set({ processingStatus: "ignored", emailType, updatedAt: new Date() })
      .where(eq(schema.hubEmails.id, emailId));

    return {
      classification: {
        intent: "other" as const,
        urgency: "low" as const,
        sentiment: "neutral" as const,
        category: "other" as const,
        suggestedAction: "ignore" as const,
        confidence: 1.0,
        reasoning: `Filtered by auto-response skip: ${skipResult.reason}`,
      },
      draft: null,
      skippedByFilter: true,
      skipReason: skipResult.reason,
      emailType,
    };
  }

  const [account] = await db
    .select({ emailAddress: schema.emailAccounts.emailAddress })
    .from(schema.emailAccounts)
    .where(eq(schema.emailAccounts.id, email.accountId))
    .limit(1);

  const accountEmail = account?.emailAddress || null;

  let threadHistory: Array<{ fromEmail: string; bodyText?: string | null }> = [];
  const contactEmail = email.fromEmail.toLowerCase().trim();
  {
    const threadEmails = await db
      .select({
        fromEmail: schema.hubEmails.fromEmail,
        bodyText: schema.hubEmails.bodyText,
        direction: schema.hubEmails.direction,
      })
      .from(schema.hubEmails)
      .where(and(
        eq(schema.hubEmails.consultantId, consultantId),
        eq(schema.hubEmails.accountId, email.accountId),
        sql`${schema.hubEmails.id} != ${emailId}`,
        sql`(
          LOWER(${schema.hubEmails.fromEmail}) = ${contactEmail}
          OR (
            ${schema.hubEmails.direction} = 'outbound'
            AND ${schema.hubEmails.toRecipients}::text ILIKE ${'%' + contactEmail + '%'}
          )
        )`
      ))
      .orderBy(sql`COALESCE(${schema.hubEmails.receivedAt}, ${schema.hubEmails.sentAt}, ${schema.hubEmails.createdAt}) DESC`)
      .limit(5);
    threadHistory = threadEmails;
    console.log(`[MILLIE-THREAD] Storico per ${contactEmail}: trovate ${threadEmails.length} email bidirezionali (account: ${email.accountId})`);
  }

  const smartSkip = detectSmartSkip({
    bodyText: email.bodyText,
    direction: email.direction,
    threadHistory,
    fromEmail: email.fromEmail,
    accountEmail,
  });

  if (smartSkip.shouldSkip) {
    console.log(`[EMAIL-FILTER] Smart skip for email "${email.subject}" - reason: ${smartSkip.reason}`);

    await db
      .update(schema.hubEmails)
      .set({ processingStatus: "ignored", updatedAt: new Date() })
      .where(eq(schema.hubEmails.id, emailId));

    if (smartSkip.leadAction === "mark_lost") {
      console.log(`[MILLIE-ACTION] Lead ${email.fromEmail} - action: mark_lost - reason: ${smartSkip.reason}`);
      try {
        const normalizedEmail = email.fromEmail.toLowerCase().trim();
        await db.execute(
          sql`UPDATE lead_scraper_results SET lead_status = 'lost'
              WHERE id IN (
                SELECT r.id FROM lead_scraper_results r
                JOIN lead_scraper_searches s ON r.search_id = s.id
                WHERE s.consultant_id = ${consultantId}
                AND LOWER(r.email) = ${normalizedEmail}
              )`
        );
        await db.execute(
          sql`DELETE FROM ai_scheduled_tasks
              WHERE consultant_id = ${consultantId}
              AND status IN ('pending', 'scheduled')
              AND metadata->>'targetEmail' = ${normalizedEmail}`
        );
      } catch (err: any) {
        console.error(`[MILLIE-ACTION] Error marking lead as lost:`, err.message);
      }
    }

    return {
      classification: {
        intent: "other" as const,
        urgency: "low" as const,
        sentiment: "neutral" as const,
        category: "other" as const,
        suggestedAction: "ignore" as const,
        confidence: 1.0,
        reasoning: `Smart skip: ${smartSkip.reason}`,
      },
      draft: null,
      skippedByFilter: true,
      skipReason: smartSkip.reason,
    };
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
      
      let ticket = null;
      if (!extendedSettings.skipTicketCreation) {
        ticket = await createTicketFromEmail(
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
      }
      
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

  const [contactContext, kbResult] = await Promise.all([
    buildContactContext(email.fromEmail, consultantId),
    searchKnowledgeBase(consultantId, {
      subject: email.subject || "",
      fromEmail: email.fromEmail,
      fromName: email.fromName || undefined,
      bodyText: email.bodyText || "",
    }),
  ]);

  const emailType = await determineEmailType(email, consultantId, undefined, contactContext);

  await db
    .update(schema.hubEmails)
    .set({ emailType, updatedAt: new Date() })
    .where(eq(schema.hubEmails.id, emailId));

  let salesContextBlock = "";
  let salesFieldCount = 0;
  try {
    const [accountData] = await db
      .select({ salesContext: schema.emailAccounts.salesContext })
      .from(schema.emailAccounts)
      .where(eq(schema.emailAccounts.id, email.accountId));
    
    const sc = accountData?.salesContext as any;
    if (sc && typeof sc === "object") {
      const fields: [string, string][] = [
        ["Servizi", sc.servicesOffered],
        ["Target", sc.targetAudience],
        ["Proposta di valore", sc.valueProposition],
        ["Pricing", sc.pricingInfo],
        ["Vantaggi competitivi", sc.competitiveAdvantages],
        ["Cliente ideale", sc.idealClientProfile],
        ["Approccio vendita", sc.salesApproach],
        ["Casi di successo", sc.caseStudies],
        ["Contesto aggiuntivo", sc.additionalContext],
      ];
      const filledFields = fields.filter(([, v]) => v && v.trim());
      salesFieldCount = filledFields.length;
      if (filledFields.length > 0) {
        salesContextBlock = `\n\nPROFILO COMMERCIALE (usa queste info per rispondere in modo informato):\n` +
          filledFields.map(([label, value]) => `- ${label}: ${value}`).join("\n");
        console.log(`[MILLIE-SALES] Profilo commerciale caricato da account ${email.accountId} (${filledFields.length}/9 campi compilati)`);
      } else {
        console.log(`[MILLIE-SALES] Nessun profilo commerciale configurato per account ${email.accountId}`);
      }
    } else {
      console.log(`[MILLIE-SALES] Nessun profilo commerciale configurato per account ${email.accountId}`);
    }
  } catch (err: any) {
    console.error(`[MILLIE-SALES] Errore caricamento profilo commerciale:`, err.message);
  }

  const EXCLUDED_STORE_PATTERNS = ["knowledge-base-consulente", "store-globale-consulenze"];
  const filterStores = (stores: string[]) => stores.filter(s => !EXCLUDED_STORE_PATTERNS.some(p => s.includes(p)));

  let fileSearchStoreNames = kbResult.found ? filterStores(kbResult.storeNames || []) : [];
  const excludedCount = (kbResult.storeNames?.length || 0) - fileSearchStoreNames.length;
  
  const emailAccountStore = await FileSearchSyncService.getEmailAccountStore(email.accountId);
  if (emailAccountStore) {
    fileSearchStoreNames = [...fileSearchStoreNames, emailAccountStore];
  }
  
  let clientName = "";
  if (contactContext.source === "client" && contactContext.data?.userId) {
    const clientUserId = contactContext.data.userId;
    clientName = `${contactContext.data.firstName || ""} ${contactContext.data.lastName || ""}`.trim();
    console.log(`[MILLIE-FILESEARCH] Cliente riconosciuto: ${clientName} (ID: ${clientUserId}) — cercando nei suoi documenti...`);
    try {
      const clientStores = await fileSearchService.getStoreNamesForGeneration(clientUserId, 'client');
      if (clientStores && clientStores.length > 0) {
        fileSearchStoreNames = [...fileSearchStoreNames, ...clientStores];
        console.log(`[MILLIE-FILESEARCH] Trovati ${clientStores.length} store per il cliente ${clientName}: [${clientStores.join(", ")}]`);
      } else {
        console.log(`[MILLIE-FILESEARCH] Nessun documento privato trovato per il cliente ${clientName}`);
      }
    } catch (err: any) {
      console.error(`[MILLIE-FILESEARCH] Errore ricerca documenti per cliente ${clientName}:`, err.message);
    }
  } else {
    console.log(`[MILLIE-FILESEARCH] Contatto non-cliente (${contactContext.source}) — skip FileSearch privato`);
  }

  let contactContextBlock = `\n\nCONTESTO CONTATTO (dal CRM):\n${contactContext.summary}`;
  if (contactContext.crossChannelContext) {
    contactContextBlock += `\n\n${contactContext.crossChannelContext}`;
  }

  const contactLabel = contactContext.source === "client" ? `👤 CLIENTE: ${clientName}` :
    contactContext.source === "lead_scraper" ? `🎯 LEAD (Hunter/CRM): ${contactContext.data?.business_name || email.fromEmail}` :
    contactContext.source === "proactive_lead" ? `📋 LEAD PROATTIVO: ${contactContext.data?.firstName || ""} ${contactContext.data?.lastName || ""}`.trim() :
    `❓ CONTATTO SCONOSCIUTO: ${email.fromEmail}`;

  console.log(`\n📧 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`📧 [MILLIE] ELABORAZIONE EMAIL: ${email.subject || "(Nessun oggetto)"}`);
  console.log(`📧 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`📧   Email ID:       ${emailId}`);
  console.log(`📧   Account ID:     ${email.accountId}`);
  console.log(`📧   Da:             ${email.fromName || ""} <${email.fromEmail}>`);
  console.log(`📧   Oggetto:        ${email.subject || "(vuoto)"}`);
  console.log(`📧   Email Type:     ${emailType}`);
  console.log(`📧 ──────────────────────────────────────────────────────────────────`);
  console.log(`📧   CONTATTO:       ${contactLabel}`);
  console.log(`📧   Source:         ${contactContext.source}`);
  if (contactContext.source === "lead_scraper" && contactContext.data) {
    console.log(`📧   Attività:       ${contactContext.data.business_name || "N/A"}`);
    console.log(`📧   Settore:        ${contactContext.data.category || "N/A"}`);
    console.log(`📧   Score AI:       ${contactContext.data.ai_compatibility_score || "N/A"}/100`);
    console.log(`📧   Stato lead:     ${contactContext.data.lead_status || "N/A"}`);

    try {
      const { logLeadActivity, updateLeadStatusOnReply } = await import("../../utils/lead-activity-logger");
      const leadId = contactContext.data.id;
      const consultantId = contactContext.data.consultant_id || email.accountId;
      if (leadId && consultantId) {
        const bodyPreview = (email.bodyText || email.bodyHtml || "").substring(0, 500);
        await logLeadActivity(
          leadId,
          consultantId,
          'email_ricevuta',
          `Email ricevuta da ${contactContext.data.business_name || email.fromEmail}`,
          `Subject: ${email.subject || "(vuoto)"}\n\n${bodyPreview}`,
          {
            from: email.fromEmail,
            fromName: email.fromName,
            subject: email.subject,
            emailId: emailId,
            accountId: email.accountId,
          }
        );
        await updateLeadStatusOnReply(leadId, 'email');
        console.log(`📧   Timeline:       ✅ Attività email_ricevuta aggiunta per lead ${leadId}`);
      }
    } catch (logErr: any) {
      console.warn(`📧   Timeline:       ❌ Errore logging: ${logErr.message}`);
    }
  }
  if (contactContext.source === "client" && contactContext.data) {
    console.log(`📧   User ID:        ${contactContext.data.userId}`);
    console.log(`📧   Livello:        ${contactContext.data.level || "N/A"}`);
  }
  if (contactContext.source === "proactive_lead" && contactContext.data) {
    console.log(`📧   Stato:          ${contactContext.data.status || "N/A"}`);
  }
  console.log(`📧   Cross-channel:  ${contactContext.crossChannelContext ? `✅ (${contactContext.crossChannelContext.length} chars)` : "❌ nessuno"}`);
  console.log(`📧 ──────────────────────────────────────────────────────────────────`);
  console.log(`📧   IMPOSTAZIONI ACCOUNT:`);
  console.log(`📧   Tono:           ${accountSettings.aiTone || "professional"}`);
  console.log(`📧   Lingua:         ${extendedSettings?.aiLanguage || "it"}`);
  console.log(`📧   Auto-reply:     ${extendedSettings?.autoReplyMode || "review"}`);
  console.log(`📧   Soglia conf.:   ${accountSettings.confidenceThreshold ?? 0.8}`);
  console.log(`📧   Booking link:   ${extendedSettings?.bookingLink ? "✅ " + extendedSettings.bookingLink : "❌ non configurato"}`);
  console.log(`📧   Istruzioni:     ${extendedSettings?.customInstructions ? `✅ (${extendedSettings.customInstructions.length} chars)` : "❌ nessuna"}`);
  console.log(`📧   Firma:          ${accountSettings.signature ? `✅ (${accountSettings.signature.length} chars)` : "❌ nessuna"}`);
  console.log(`📧   Stop on risk:   ${extendedSettings?.stopOnRisk !== false ? "✅" : "❌"}`);
  console.log(`📧   Escalation kw:  ${(extendedSettings?.escalationKeywords as string[])?.length ? `✅ [${(extendedSettings.escalationKeywords as string[]).join(", ")}]` : "❌ nessuna"}`);
  console.log(`📧 ──────────────────────────────────────────────────────────────────`);
  console.log(`📧   PROFILO COMMERCIALE: ${salesFieldCount > 0 ? `✅ ${salesFieldCount}/9 campi compilati` : "❌ non configurato"}`);
  console.log(`📧 ──────────────────────────────────────────────────────────────────`);
  console.log(`📧   FILESEARCH:`);
  console.log(`📧   KB consulente:  ${kbResult.found ? `✅ ${kbResult.totalDocuments || 0} docs, ${kbResult.storeNames?.length || 0} stores` : "❌ nessun store"}`);
  if (excludedCount > 0) {
    console.log(`📧   Esclusi:        ⛔ ${excludedCount} store generici (knowledge-base-consulente, store-globale-consulenze)`);
  }
  console.log(`📧   Email account:  ${emailAccountStore ? `✅ ${emailAccountStore}` : "❌ nessuno"}`);
  if (contactContext.source === "client" && contactContext.data?.userId) {
    const clientStoreCount = fileSearchStoreNames.filter(s => !kbResult.storeNames?.includes(s) && s !== emailAccountStore).length;
    console.log(`📧   Docs cliente:   ${clientStoreCount > 0 ? `✅ ${clientStoreCount} store privati` : "❌ nessun documento"}`);
  }
  console.log(`📧   Totale stores:  ${fileSearchStoreNames.length} → [${fileSearchStoreNames.join(", ")}]`);
  console.log(`📧 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

  const ticketSettings = await getTicketSettings(consultantId);
  let ticketCreated = false;
  let ticketId: string | undefined;

  if (!kbResult.found && ticketSettings?.autoCreateTicketOnNoAnswer && !extendedSettings?.skipTicketCreation) {
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

  if (classification.urgency === "high" && ticketSettings?.autoCreateTicketOnHighUrgency && !ticketCreated && !extendedSettings?.skipTicketCreation) {
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

  if (classification.sentiment === "negative" && ticketSettings?.autoCreateTicketOnNegativeSentiment && !ticketCreated && !extendedSettings?.skipTicketCreation) {
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

  const responseIntent = detectResponseIntent(
    { bodyText: email.bodyText, subject: email.subject },
    contactContext.source,
    emailType
  );
  const adaptiveStrategy = getAdaptiveResponseStrategy(responseIntent);

  const enrichedCustomInstructions = [
    extendedSettings?.customInstructions || "",
    contactContextBlock,
    salesContextBlock,
    `\n\n${adaptiveStrategy}`,
  ].filter(Boolean).join("\n");

  const fullSystemPrompt = buildStructuredResponsePrompt({
    tone: accountSettings.aiTone || "professional",
    signature: accountSettings.signature,
    customInstructions: enrichedCustomInstructions,
    knowledgeContext: undefined,
    bookingLink: extendedSettings?.bookingLink,
  });

  console.log(`📧 ──────────────────────────────────────────────────────────────────`);
  console.log(`📧 [MILLIE] CLASSIFICAZIONE:`);
  console.log(`📧   Intent:         ${classification.intent}`);
  console.log(`📧   Urgenza:        ${classification.urgency}`);
  console.log(`📧   Sentiment:      ${classification.sentiment}`);
  console.log(`📧   Categoria:      ${classification.category}`);
  console.log(`📧   Azione:         ${classification.suggestedAction}`);
  console.log(`📧   Confidenza:     ${classification.confidence}`);
  console.log(`📧   Response intent:${responseIntent}`);
  console.log(`📧 ──────────────────────────────────────────────────────────────────`);
  console.log(`📧 [MILLIE] SYSTEM PROMPT COMPLETO INVIATO A GEMINI:`);
  console.log(`📧 ──────────────────────────────────────────────────────────────────`);
  console.log(fullSystemPrompt);
  console.log(`📧 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

  const aiResponse = await generateStructuredAIResponse(
    emailId,
    originalEmail,
    accountSettings,
    consultantId,
    {
      customInstructions: enrichedCustomInstructions,
      bookingLink: extendedSettings?.bookingLink,
      fileSearchStoreNames,
    }
  );

  const autoSendEnabled = extendedSettings?.autoSendEnabled ?? false;
  const decisionResult = executeDecisionEngine({
    aiResponse,
    autoSendEnabled,
  });

  if (decisionResult.shouldCreateTicket && !ticketCreated && !extendedSettings?.skipTicketCreation) {
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

  const millieResult = await executeMillieActions({
    responseIntent,
    emailType,
    contactContext,
    fromEmail: email.fromEmail,
    consultantId,
    accountId: email.accountId,
    emailId,
    aiConfidence: aiResponse.confidence,
    bookingLink: extendedSettings?.bookingLink,
  });

  if (millieResult.actions.length > 0) {
    console.log(`[MILLIE-ACTION] Executed ${millieResult.actions.length} actions for email ${emailId}:`, millieResult.actions.map(a => `${a.type}(${a.success ? 'ok' : 'fail'})`).join(', '));
  }

  let draft: EmailDraft | null = null;
  if (millieResult.suppressDraft) {
    console.log(`[MILLIE-ACTION] Draft suppressed for email ${emailId} (lead not interested)`);
    await db
      .update(schema.hubEmails)
      .set({ processingStatus: "ignored", updatedAt: new Date() })
      .where(eq(schema.hubEmails.id, emailId));
  } else {
    draft = {
      subject: originalEmail.subject?.startsWith("Re:") 
        ? originalEmail.subject 
        : `Re: ${originalEmail.subject || "Senza oggetto"}`,
      bodyHtml: `<p>${aiResponse.response.replace(/\n/g, "<br>")}</p>`,
      bodyText: aiResponse.response,
      confidence: aiResponse.confidence,
      modelUsed: GEMINI_3_MODEL,
    };
  }

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
    emailType,
    responseIntent,
    millieActions: millieResult.actions,
  };
}

export { CATEGORY_CONFIDENCE_THRESHOLDS };
