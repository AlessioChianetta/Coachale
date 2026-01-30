import { GoogleGenAI } from "@google/genai";

export type ConsultationIntent = 
  | 'consultations_status'    // Quante consulenze ho fatto?
  | 'booking_request'         // Voglio prenotare una consulenza
  | 'availability_check'      // Quando sei disponibile?
  | 'booking_confirm'         // Confermo la prenotazione
  | 'booking_cancel'          // Annulla la prenotazione
  | 'informational'           // Cos'è una consulenza? (no tool needed)
  | 'other';                  // Non riguarda consulenze

export interface IntentClassification {
  intent: ConsultationIntent;
  confidence: number;
  reasoning?: string;
}

const INTENT_CLASSIFICATION_PROMPT = `You are an intent classifier for a consultation booking system.

Classify the user message into ONE of these intents:

1. consultations_status - User asks about their consultation count, history, limits, or usage
   Examples: "quante consulenze ho fatto?", "ho raggiunto il limite?", "quanti incontri ho completato?"

2. booking_request - User wants to book/schedule a new consultation
   Examples: "voglio prenotare", "posso fissare un appuntamento?", "prenota una consulenza"

3. availability_check - User asks about available time slots
   Examples: "quando sei disponibile?", "quali slot hai liberi?", "che orari hai?"

4. booking_confirm - User confirms a proposed booking
   Examples: "confermo", "va bene quell'orario", "sì prenota"

5. booking_cancel - User wants to cancel a booking
   Examples: "annulla", "disdici l'appuntamento", "cancella la prenotazione"

6. informational - User asks general questions about consultations (no database lookup needed)
   Examples: "cos'è una consulenza?", "come funziona?", "quanto dura una sessione?"

7. other - Message is not about consultations at all
   Examples: "che tempo fa?", "parlami degli esercizi", "come stai?"

Respond with JSON only:
{
  "intent": "<intent_name>",
  "confidence": <0.0-1.0>,
  "reasoning": "<brief explanation>"
}`;

export async function classifyConsultationIntent(
  message: string,
  apiKey: string
): Promise<IntentClassification> {
  try {
    const ai = new GoogleGenAI({ apiKey });
    
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-lite-preview-06-17',
      contents: [
        {
          role: 'user',
          parts: [{ text: `${INTENT_CLASSIFICATION_PROMPT}\n\nUser message: "${message}"` }]
        }
      ],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 200,
      }
    });

    const text = response.response?.text() || '';
    
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.warn(`⚠️ [Intent Classifier] Could not parse JSON from response: ${text}`);
      return { intent: 'other', confidence: 0.5 };
    }

    const parsed = JSON.parse(jsonMatch[0]) as IntentClassification;
    
    if (!parsed.intent || typeof parsed.confidence !== 'number') {
      console.warn(`⚠️ [Intent Classifier] Invalid response structure: ${JSON.stringify(parsed)}`);
      return { intent: 'other', confidence: 0.5 };
    }

    console.log(`🎯 [Intent Classifier] "${message.substring(0, 50)}..." → ${parsed.intent} (${(parsed.confidence * 100).toFixed(0)}%)`);
    if (parsed.reasoning) {
      console.log(`   Reasoning: ${parsed.reasoning}`);
    }

    return parsed;

  } catch (error) {
    console.error(`❌ [Intent Classifier] Error:`, error);
    return { intent: 'other', confidence: 0.5 };
  }
}

export function shouldUseConsultationTools(classification: IntentClassification): boolean {
  const toolIntents: ConsultationIntent[] = [
    'consultations_status',
    'booking_request', 
    'availability_check',
    'booking_confirm',
    'booking_cancel'
  ];
  
  return toolIntents.includes(classification.intent) && classification.confidence >= 0.7;
}

export function getToolsForIntent(classification: IntentClassification): string[] {
  switch (classification.intent) {
    case 'consultations_status':
      return ['getConsultationStatus'];
    case 'availability_check':
      return ['getAvailableSlots'];
    case 'booking_request':
      return ['getAvailableSlots', 'proposeBooking'];
    case 'booking_confirm':
      return ['confirmBooking'];
    case 'booking_cancel':
      return ['cancelBooking'];
    default:
      return [];
  }
}
