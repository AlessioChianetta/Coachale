import { GoogleGenAI } from "@google/genai";
import { randomUUID } from "crypto";

export type ConsultationIntent = 
  | 'consultations_status'
  | 'booking_request'
  | 'availability_check'
  | 'booking_confirm'
  | 'booking_cancel'
  | 'informational'
  | 'other';

export type ConfidenceLevel = 'high' | 'medium' | 'low';

export interface IntentClassification {
  intent: ConsultationIntent;
  confidence: number;
  confidenceLevel: ConfidenceLevel;
  reasoning?: string;
  traceId: string;
}

export interface ClassifierContext {
  userId?: string;
  sessionId?: string;
  pendingBookingToken?: string;
  hasPendingBooking?: boolean;
}

const SYSTEM_PROMPT = `You are a STRICT intent classifier for a consultation booking system.

RULES:
- Output MUST be valid JSON wrapped in <json></json> tags
- Do NOT add ANY text outside the JSON tags
- Choose ONE intent only
- If uncertain, return "other" with confidence < 0.5

INTENTS:

1. consultations_status - User asks about consultation count, history, limits, usage
   Examples: "quante consulenze ho fatto?", "ho raggiunto il limite?", "quanti incontri?"

2. booking_request - User wants to book/schedule a new consultation OR selects a specific date/time slot
   INCLUDES: any message mentioning day + time for booking (slot selection is a booking request!)
   Examples: "voglio prenotare", "posso fissare un appuntamento?", "giovedi 5 alle 9", "lunedi alle 15", 
   "martedì 3 febbraio alle 10:00", "va bene giovedi 5 alle 9?", "preferirei venerdi pomeriggio alle 16"

3. availability_check - User asks about available time slots (without specifying one)
   Examples: "quando sei disponibile?", "quali slot hai liberi?"

4. booking_confirm - User confirms a PREVIOUSLY proposed booking (REQUIRES pending booking context)
   Examples: "confermo", "va bene", "sì prenota", "ok"
   NOTE: If user specifies a new date/time, that's booking_request, NOT booking_confirm

5. booking_cancel - User wants to cancel a booking
   Examples: "annulla", "disdici l'appuntamento"

6. informational - General questions about consultations (no DB lookup needed)
   Examples: "cos'è una consulenza?", "come funziona?"

7. other - Message is not about consultations
   Examples: "che tempo fa?", "parlami degli esercizi"

IMPORTANT: If the message contains a day name (lunedi, martedi, etc.) AND a time (09:00, alle 9, pomeriggio), 
classify as booking_request with high confidence. This is a slot selection.

OUTPUT FORMAT (wrap in <json></json>):
{
  "intent": "<intent_name>",
  "confidence": <0.0-1.0>,
  "reasoning": "<brief explanation>"
}`;

export async function classifyConsultationIntent(
  message: string,
  apiKey: string,
  context?: ClassifierContext
): Promise<IntentClassification> {
  const traceId = randomUUID().slice(0, 8);
  const startTime = Date.now();
  
  try {
    const ai = new GoogleGenAI({ apiKey });
    
    const requestContents = [
      {
        role: 'user',
        parts: [{ text: SYSTEM_PROMPT }]
      },
      {
        role: 'model',
        parts: [{ text: 'Understood. I will classify intents strictly and output JSON wrapped in <json></json> tags.' }]
      },
      {
        role: 'user',
        parts: [{ 
          text: context?.hasPendingBooking 
            ? `Context: hasPendingBooking=true (there is an active booking proposal waiting for confirmation)\nClassify this message: "${message}"`
            : `Classify this message: "${message}"` 
        }]
      }
    ];
    
    console.log(`\n${'─'.repeat(60)}`);
    console.log(`🔍 [Intent:${traceId}] CLASSIFIER REQUEST`);
    console.log(`${'─'.repeat(60)}`);
    console.log(`   Model: gemini-2.5-flash-lite`);
    console.log(`   Message: "${message.substring(0, 80)}${message.length > 80 ? '...' : ''}"`);
    console.log(`   Context: hasPendingBooking=${context?.hasPendingBooking || false}`);
    console.log(`   Contents structure: ${requestContents.length} turns`);
    console.log(`${'─'.repeat(60)}`);
    
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-lite',
      contents: requestContents,
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 200,
      }
    });

    const latencyMs = Date.now() - startTime;
    
    // Handle different SDK response structures
    let text = '';
    if (response.response?.text) {
      // Standard SDK structure
      text = response.response.text() || '';
    } else if (response.candidates && response.candidates[0]?.content?.parts) {
      // Direct candidates structure (some SDK versions)
      text = response.candidates[0].content.parts.map((p: any) => p.text || '').join('');
    } else if ((response as any).text) {
      // Direct text property
      text = (response as any).text() || '';
    }
    
    console.log(`\n${'─'.repeat(60)}`);
    console.log(`📤 [Intent:${traceId}] CLASSIFIER RESPONSE`);
    console.log(`${'─'.repeat(60)}`);
    console.log(`   Latency: ${latencyMs}ms`);
    console.log(`   Response length: ${text.length} chars`);
    console.log(`   Raw response: "${text.substring(0, 200)}${text.length > 200 ? '...' : ''}"`);
    console.log(`   Response object keys: ${Object.keys(response).join(', ')}`);
    if (response.candidates) {
      console.log(`   Candidates count: ${response.candidates.length}`);
      if (response.candidates[0]?.content?.parts) {
        console.log(`   First candidate parts: ${response.candidates[0].content.parts.length}`);
      }
    }
    console.log(`${'─'.repeat(60)}`);
    
    
    const jsonMatch = text.match(/<json>([\s\S]*?)<\/json>/);
    if (!jsonMatch) {
      const fallbackMatch = text.match(/\{[\s\S]*?\}/);
      if (!fallbackMatch) {
        console.warn(`⚠️ [Intent:${traceId}] No JSON found in response: ${text.substring(0, 100)}`);
        return createResult('other', 0.5, 'Parse error - no JSON block', traceId);
      }
      console.warn(`⚠️ [Intent:${traceId}] Using fallback regex (no <json> tags)`);
      return parseAndValidate(fallbackMatch[0], traceId, latencyMs, context);
    }

    return parseAndValidate(jsonMatch[1], traceId, latencyMs, context);

  } catch (error) {
    console.error(`❌ [Intent:${traceId}] Classification error:`, error);
    return createResult('other', 0.5, `Error: ${error}`, traceId);
  }
}

function parseAndValidate(
  jsonStr: string, 
  traceId: string, 
  latencyMs: number,
  context?: ClassifierContext
): IntentClassification {
  try {
    const parsed = JSON.parse(jsonStr.trim());
    
    if (!parsed.intent || typeof parsed.confidence !== 'number') {
      console.warn(`⚠️ [Intent:${traceId}] Invalid structure: ${jsonStr}`);
      return createResult('other', 0.5, 'Invalid response structure', traceId);
    }

    const confidenceLevel = getConfidenceLevel(parsed.confidence);
    
    console.log(`\n${'─'.repeat(60)}`);
    console.log(`🎯 [Intent:${traceId}] Classification Result`);
    console.log(`${'─'.repeat(60)}`);
    console.log(`   Intent: ${parsed.intent}`);
    console.log(`   Confidence: ${(parsed.confidence * 100).toFixed(0)}% (${confidenceLevel})`);
    console.log(`   Latency: ${latencyMs}ms`);
    if (parsed.reasoning) {
      console.log(`   Reasoning: ${parsed.reasoning}`);
    }
    if (context?.userId) {
      console.log(`   User: ${context.userId}`);
    }
    if (context?.sessionId) {
      console.log(`   Session: ${context.sessionId}`);
    }
    console.log(`${'─'.repeat(60)}\n`);

    return {
      intent: parsed.intent as ConsultationIntent,
      confidence: parsed.confidence,
      confidenceLevel,
      reasoning: parsed.reasoning,
      traceId
    };

  } catch (e) {
    console.warn(`⚠️ [Intent:${traceId}] JSON parse error: ${e}`);
    return createResult('other', 0.5, 'JSON parse error', traceId);
  }
}

function createResult(
  intent: ConsultationIntent, 
  confidence: number, 
  reasoning: string,
  traceId: string
): IntentClassification {
  return {
    intent,
    confidence,
    confidenceLevel: getConfidenceLevel(confidence),
    reasoning,
    traceId
  };
}

function getConfidenceLevel(confidence: number): ConfidenceLevel {
  if (confidence >= 0.8) return 'high';
  if (confidence >= 0.5) return 'medium';
  return 'low';
}

export function shouldUseConsultationTools(
  classification: IntentClassification,
  context?: ClassifierContext
): boolean {
  const actionableIntents: ConsultationIntent[] = [
    'consultations_status',
    'booking_request', 
    'availability_check',
    'booking_confirm',
    'booking_cancel'
  ];
  
  if (!actionableIntents.includes(classification.intent)) {
    return false;
  }

  if (classification.intent === 'booking_confirm') {
    if (!context?.hasPendingBooking && !context?.pendingBookingToken) {
      console.log(`🚫 [Intent:${classification.traceId}] booking_confirm blocked - no pending booking in context`);
      return false;
    }
  }

  if (classification.confidenceLevel === 'high') {
    return true;
  }
  
  if (classification.confidenceLevel === 'medium') {
    console.log(`⚠️ [Intent:${classification.traceId}] Medium confidence (${(classification.confidence * 100).toFixed(0)}%) - should ask clarification`);
    return true;
  }
  
  console.log(`🚫 [Intent:${classification.traceId}] Low confidence - ignoring tools`);
  return false;
}

export function getToolsForIntent(
  classification: IntentClassification,
  context?: ClassifierContext
): string[] {
  switch (classification.intent) {
    case 'consultations_status':
      return ['getClientConsultationStatus'];
      
    case 'availability_check':
      return ['getAvailableSlots'];
      
    case 'booking_request':
      return ['getAvailableSlots', 'proposeBooking'];
      
    case 'booking_confirm':
      if (!context?.pendingBookingToken) {
        console.log(`🚫 [Intent:${classification.traceId}] confirmBooking blocked - no pendingBookingToken`);
        return [];
      }
      return ['confirmBooking'];
      
    case 'booking_cancel':
      return ['cancelBooking'];
      
    default:
      return [];
  }
}

export function shouldAskClarification(classification: IntentClassification): boolean {
  return classification.confidenceLevel === 'medium';
}

export function getClarificationPrompt(classification: IntentClassification): string | null {
  if (classification.confidenceLevel !== 'medium') {
    return null;
  }
  
  switch (classification.intent) {
    case 'booking_request':
      return 'Vuoi prenotare una consulenza?';
    case 'availability_check':
      return 'Vuoi vedere gli slot disponibili per una consulenza?';
    case 'consultations_status':
      return 'Vuoi sapere quante consulenze hai fatto questo mese?';
    case 'booking_confirm':
      return 'Vuoi confermare la prenotazione proposta?';
    case 'booking_cancel':
      return 'Vuoi annullare una prenotazione esistente?';
    default:
      return null;
  }
}
