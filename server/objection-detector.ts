import { db } from "./db";
import { objectionTracking, clientObjectionProfile } from "../shared/schema";
import { eq, and, desc } from "drizzle-orm";
import { quickGenerate } from "./ai/provider-factory";

export type ObjectionType = "price" | "time" | "trust" | "competitor" | "value" | "other";

export interface ObjectionDetectionResult {
  hasObjection: boolean;
  objectionType?: ObjectionType;
  objectionText?: string;
  sentimentScore?: number;
  confidence: number;
}

export async function detectObjection(
  messageText: string,
  consultantId: string
): Promise<ObjectionDetectionResult> {
  try {
    const prompt = `Analizza il seguente messaggio di un potenziale cliente e classifica se contiene un'obiezione.

MESSAGGIO:
"${messageText}"

ISTRUZIONI:
1. Determina se il messaggio contiene un'obiezione (hasObjection: true/false)
2. Se c'è un'obiezione, classificala in una di queste categorie:
   - "price": obiezioni sul prezzo, costo troppo alto, budget limitato
   - "time": mancanza di tempo, troppo impegnato, "più tardi"
   - "trust": dubbi, perplessità, mancanza di fiducia, "devo pensarci"
   - "competitor": ha già un consulente, sta valutando altre opzioni
   - "value": non vede il valore, non capisce i benefici, "perché dovrei"
   - "other": altre obiezioni non classificabili nelle categorie sopra

3. Analizza il sentiment del messaggio su una scala da -1 a 1:
   - -1: molto negativo
   - 0: neutrale
   - 1: molto positivo

4. Assegna un confidence score (0-1) basato sulla chiarezza dell'obiezione

Rispondi in formato JSON con questa struttura:
{
  "hasObjection": boolean,
  "objectionType": "price" | "time" | "trust" | "competitor" | "value" | "other" | null,
  "sentimentScore": number,
  "confidence": number,
  "reasoning": "breve spiegazione"
}`;

    const response = await quickGenerate({
      consultantId,
      feature: 'objection-detector',
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
      },
      thinkingLevel: 'minimal',
    });

    const resultText = response.text;
    
    if (!resultText || resultText === 'undefined' || typeof resultText !== 'string') {
      console.warn(`⚠️ [OBJECTION-DETECTOR] Invalid AI response: ${resultText}`);
      return {
        hasObjection: false,
        confidence: 0,
      };
    }
    
    const result = JSON.parse(resultText);

    return {
      hasObjection: result.hasObjection || false,
      objectionType: result.objectionType || undefined,
      objectionText: result.hasObjection ? messageText.substring(0, 500) : undefined,
      sentimentScore: result.sentimentScore || 0,
      confidence: result.confidence || 0,
    };
  } catch (error) {
    console.error("❌ Error detecting objection with Gemini AI:", error);
    
    return {
      hasObjection: false,
      confidence: 0,
    };
  }
}

export async function trackObjection(
  conversationId: string,
  messageId: string | null,
  detection: ObjectionDetectionResult,
  aiResponse?: string
): Promise<void> {
  if (!detection.hasObjection || !detection.objectionType || !detection.objectionText) {
    return;
  }

  await db.insert(objectionTracking).values({
    conversationId,
    messageId,
    objectionType: detection.objectionType,
    objectionText: detection.objectionText,
    aiResponse: aiResponse || null,
    wasResolved: false,
    sentimentScore: detection.sentimentScore || 0,
  });
}

export async function getConversationObjections(conversationId: string) {
  return await db
    .select()
    .from(objectionTracking)
    .where(eq(objectionTracking.conversationId, conversationId))
    .orderBy(desc(objectionTracking.detectedAt));
}

export async function updateObjectionResolution(
  objectionId: string,
  wasResolved: boolean,
  strategy?: string
): Promise<void> {
  await db
    .update(objectionTracking)
    .set({
      wasResolved,
      resolutionStrategy: strategy,
      resolvedAt: wasResolved ? new Date() : null,
    })
    .where(eq(objectionTracking.id, objectionId));
}
