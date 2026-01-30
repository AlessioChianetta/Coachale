import { GoogleGenAI } from "@google/genai";
import { randomUUID } from "crypto";

export type ConsultationIntent = 
  | 'consultations_status'
  | 'booking_request'
  | 'availability_check'
  | 'booking_confirm'
  | 'booking_cancel'
  | 'booking_reschedule'
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
  recentMessages?: Array<{ role: 'user' | 'assistant'; content: string }>;
}

const SYSTEM_PROMPT = `You are a STRICT intent classifier for a consultation booking system.

CRITICAL: You will receive RECENT CONVERSATION HISTORY before the current message.
USE THE CONTEXT to understand what the user REALLY wants. Follow-up messages must be interpreted in context.

RULES:
- Output MUST be valid JSON wrapped in <json></json> tags
- Do NOT add ANY text outside the JSON tags
- Choose ONE intent only
- ANALYZE THE FULL CONVERSATION before deciding
- If the previous message was about booking/scheduling and current message is a confirmation or insistence, classify accordingly

CONTEXT REASONING:
- If user previously asked to book/schedule and now says "sì", "certo", "puoi farlo", "fallo", "procedi" → booking_request
- If user previously asked to cancel and now insists → booking_cancel  
- If user previously asked about availability and now specifies a preference → booking_request
- If user says the AI CAN do something after AI said it cannot → maintain the original intent from context

INTENTS:

1. consultations_status - User asks about consultation count, history, limits, usage
   Examples: "quante consulenze ho fatto?", "ho raggiunto il limite?", "quanti incontri?"

2. booking_request - User wants to book/schedule a new consultation OR selects a specific date/time slot
   INCLUDES: 
   - Any message mentioning day + time for booking (slot selection is a booking request!)
   - Follow-up confirmations after a booking request: "sì fallo", "certo che puoi", "procedi", "ok schedula"
   Examples: "voglio prenotare", "posso fissare un appuntamento?", "giovedi 5 alle 9", "lunedi alle 15", 
   "martedì 3 febbraio alle 10:00", "va bene giovedi 5 alle 9?", "preferirei venerdi pomeriggio alle 16",
   "me ne scheduli una per giorno 10", "sì che puoi farlo"

3. availability_check - User asks about available time slots (without specifying one)
   Examples: "quando sei disponibile?", "quali slot hai liberi?"

4. booking_confirm - User confirms a PREVIOUSLY proposed booking (REQUIRES pending booking context)
   Examples: "confermo", "va bene", "sì prenota", "ok"
   NOTE: If user specifies a new date/time, that's booking_request, NOT booking_confirm

5. booking_cancel - User wants to cancel a booking
   Examples: "annulla", "disdici l'appuntamento", "cancella la consulenza", "rimuovi l'appuntamento"
   INCLUDES: Follow-up insistence after a cancel request

6. booking_reschedule - User wants to MOVE/CHANGE an existing booking to a different time (NOT cancel + new)
   Examples: "non posso più venire alle 10, spostiamo alle 11?", "posso cambiare orario?", 
   "devo spostare l'appuntamento", "possiamo riprogrammare?", "c'è posto alle 11 invece delle 10?"
   KEY DIFFERENCE FROM booking_cancel: User still wants the consultation, just at a different time
   KEY DIFFERENCE FROM booking_request: User already HAS a booking and wants to MODIFY it

7. informational - General questions about consultations (no DB lookup needed)
   Examples: "cos'è una consulenza?", "come funziona?"

8. other - Message is CLEARLY not about consultations AND no relevant context exists
   Examples: "che tempo fa?", "parlami degli esercizi"
   WARNING: Do NOT use "other" if recent context was about consultations!

IMPORTANT: If the message contains a day name (lunedi, martedi, etc.) AND a time (09:00, alle 9, pomeriggio), 
classify as booking_request with high confidence. This is a slot selection.

OUTPUT FORMAT (wrap in <json></json>):
{
  "intent": "<intent_name>",
  "confidence": <0.0-1.0>,
  "reasoning": "<detailed explanation of WHY you chose this intent, including analysis of conversation context>"
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
    
    // Build conversation context string from recent messages - NO TRUNCATION
    let conversationContextStr = '';
    if (context?.recentMessages && context.recentMessages.length > 0) {
      conversationContextStr = '\n\n=== RECENT CONVERSATION (analyze for context) ===\n';
      for (const msg of context.recentMessages) {
        const roleLabel = msg.role === 'user' ? 'USER' : 'ASSISTANT';
        // FULL content - no truncation for accurate context analysis
        conversationContextStr += `${roleLabel}: ${msg.content}\n`;
      }
      conversationContextStr += '=== END CONVERSATION ===\n\n';
    }
    
    // Build the classification request with full context
    let classificationRequest = '';
    if (context?.hasPendingBooking) {
      classificationRequest += 'CONTEXT FLAG: hasPendingBooking=true (there is an active booking proposal waiting for confirmation)\n';
    }
    classificationRequest += conversationContextStr;
    classificationRequest += `NOW CLASSIFY THIS NEW MESSAGE: "${message}"`;
    
    const requestContents = [
      {
        role: 'user',
        parts: [{ text: SYSTEM_PROMPT }]
      },
      {
        role: 'model',
        parts: [{ text: 'Understood. I will analyze the conversation context and classify the intent, providing detailed reasoning.' }]
      },
      {
        role: 'user',
        parts: [{ text: classificationRequest }]
      }
    ];
    
    // FULL LOGGING - no truncation
    console.log(`\n${'═'.repeat(80)}`);
    console.log(`🔍 [Intent:${traceId}] CLASSIFIER REQUEST - FULL CONTEXT`);
    console.log(`${'═'.repeat(80)}`);
    console.log(`   Model: gemini-2.5-flash-lite`);
    console.log(`   Current Message: "${message}"`);
    console.log(`   hasPendingBooking: ${context?.hasPendingBooking || false}`);
    console.log(`   Recent Messages Count: ${context?.recentMessages?.length || 0}`);
    if (context?.recentMessages && context.recentMessages.length > 0) {
      console.log(`   ${'─'.repeat(60)}`);
      console.log(`   📜 CONVERSATION HISTORY SENT TO CLASSIFIER (FULL - NO TRUNCATION):`);
      for (let i = 0; i < context.recentMessages.length; i++) {
        const msg = context.recentMessages[i];
        const roleEmoji = msg.role === 'user' ? '👤' : '🤖';
        // FULL content logged - no truncation
        console.log(`   ${roleEmoji} [${i + 1}] ${msg.role.toUpperCase()}: ${msg.content}`);
      }
      console.log(`   ${'─'.repeat(60)}`);
    }
    console.log(`${'═'.repeat(80)}`);
    
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
    
    // FULL RESPONSE LOGGING - no truncation
    console.log(`\n${'═'.repeat(80)}`);
    console.log(`📤 [Intent:${traceId}] CLASSIFIER RESPONSE - FULL`);
    console.log(`${'═'.repeat(80)}`);
    console.log(`   Latency: ${latencyMs}ms`);
    console.log(`   Response length: ${text.length} chars`);
    console.log(`   ${'─'.repeat(60)}`);
    console.log(`   📝 FULL RAW RESPONSE:`);
    console.log(`   ${text}`);
    console.log(`   ${'─'.repeat(60)}`);
    console.log(`${'═'.repeat(80)}`);
    
    
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
    'booking_cancel',
    'booking_reschedule'
  ];
  
  if (!actionableIntents.includes(classification.intent)) {
    return false;
  }

  // Note: booking_confirm without pending booking is allowed now
  // getToolsForIntent will return proposeBooking tools instead of confirmBooking
  // This handles cases like "alle 15" where user specifies a new slot

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
      return ['getConsultationStatus'];
      
    case 'availability_check':
      return ['getAvailableSlots'];
      
    case 'booking_request':
      return ['getAvailableSlots', 'proposeBooking'];
      
    case 'booking_confirm':
      if (!context?.pendingBookingToken) {
        // No pending booking - user might be specifying a new time slot (e.g. "alle 15")
        // Treat as booking request to allow proposeBooking
        console.log(`📋 [Intent:${classification.traceId}] No pendingBookingToken - treating as slot selection`);
        return ['getAvailableSlots', 'proposeBooking'];
      }
      return ['confirmBooking'];
      
    case 'booking_cancel':
      return ['cancelBooking'];
      
    case 'booking_reschedule':
      return ['rescheduleBooking'];
      
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
