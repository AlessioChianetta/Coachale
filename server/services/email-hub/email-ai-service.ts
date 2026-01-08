import { db } from "../../db";
import * as schema from "@shared/schema";
import { eq } from "drizzle-orm";
import { getAIProvider } from "../../ai/provider-factory";
import { GoogleGenAI } from "@google/genai";

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

function buildDraftPrompt(tone: string, signature?: string | null): string {
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

  return `Sei un assistente AI che aiuta un consulente italiano a rispondere alle email.

ISTRUZIONI SUL TONO:
${toneInstructions[tone] || toneInstructions.professional}

REGOLE:
1. Rispondi in italiano
2. Mantieni la risposta pertinente e utile
3. Non inventare informazioni che non conosci
4. Se l'email richiede informazioni specifiche che non hai, suggerisci di verificare o chiedere
5. Includi la firma alla fine se fornita
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

export async function generateEmailDraft(
  emailId: string,
  originalEmail: OriginalEmail,
  accountSettings: AccountSettings,
  consultantId: string
): Promise<EmailDraft> {
  const systemPrompt = buildDraftPrompt(
    accountSettings.aiTone || "professional",
    accountSettings.signature
  );

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
  const model = "gemini-2.5-flash";

  try {
    const result = await provider.client.generateContent({
      model,
      contents: [
        { role: "user", parts: [{ text: systemPrompt }] },
        { role: "user", parts: [{ text: `EMAIL A CUI RISPONDERE:\n\n${emailContent}` }] },
      ],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 2048,
      },
    });

    const responseText = result.response.text();
    const cleanedResponse = responseText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    
    const draft = JSON.parse(cleanedResponse);
    
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

export async function classifyAndGenerateDraft(
  emailId: string,
  consultantId: string,
  accountSettings: AccountSettings
): Promise<{
  classification: EmailClassification;
  draft: EmailDraft;
}> {
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

  const draft = await generateEmailDraft(
    emailId,
    originalEmail,
    accountSettings,
    consultantId
  );

  return { classification, draft };
}
