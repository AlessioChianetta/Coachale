/**
 * AI Follow-up Decision Engine
 * Servizio che usa Vertex AI (Gemini 2.5 Flash) per decidere intelligentemente
 * quando e come contattare i lead nel sistema di follow-up algoritmico WhatsApp.
 */

import { db } from "../db";
import { conversationStates, followupAiEvaluationLog } from "../../shared/schema";
import { eq } from "drizzle-orm";
import { GoogleGenAI } from "@google/genai";
import { createVertexGeminiClient, parseServiceAccountJson } from "./provider-factory";

// ═══════════════════════════════════════════════════════════════════════════
// Interfaces
// ═══════════════════════════════════════════════════════════════════════════

export interface AIProvider {
  type: 'vertex' | 'studio';
  projectId?: string;
  location?: string;
  credentials?: any;
  apiKey?: string;
}

export interface FollowupContext {
  conversationId: string;
  leadName?: string;
  currentState: string;
  daysSilent: number;
  followupCount: number;
  maxFollowupsAllowed: number;
  channel: string;
  agentType: string;
  lastMessages: Array<{ role: string; content: string; timestamp: string }>;
  signals: {
    hasAskedPrice: boolean;
    hasMentionedUrgency: boolean;
    hasSaidNoExplicitly: boolean;
    discoveryCompleted: boolean;
    demoPresented: boolean;
  };
  engagementScore: number;
  conversionProbability: number;
  availableTemplates: Array<{ id: string; name: string; useCase: string; bodyText: string }>;
}

export interface FollowupDecision {
  decision: "send_now" | "schedule" | "skip" | "stop";
  urgency?: "now" | "tomorrow" | "next_week" | "never";
  suggestedTemplateId?: string;
  suggestedMessage?: string;
  reasoning: string;
  confidenceScore: number;
  updatedEngagementScore?: number;
  updatedConversionProbability?: number;
  stateTransition?: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// Main Function: evaluateFollowup
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Valuta se inviare un follow-up e come farlo usando AI
 */
export async function evaluateFollowup(
  context: FollowupContext,
  provider: AIProvider
): Promise<FollowupDecision> {
  const startTime = Date.now();
  
  try {
    console.log(`🤖 [FOLLOWUP-ENGINE] Evaluating follow-up for conversation ${context.conversationId}`);
    console.log(`   State: ${context.currentState}, Days silent: ${context.daysSilent}, Follow-ups: ${context.followupCount}/${context.maxFollowupsAllowed}`);

    // Pre-check: regole deterministiche prima dell'AI
    const preCheck = checkDeterministicRules(context);
    if (preCheck) {
      console.log(`⚡ [FOLLOWUP-ENGINE] Deterministic decision: ${preCheck.decision} - ${preCheck.reasoning}`);
      return preCheck;
    }

    // Costruisci il prompt per l'AI
    const prompt = buildFollowupPrompt(context);
    
    let response: any;
    
    // Validate Vertex AI credentials if vertex provider
    const hasVertexCredentials = provider.type === 'vertex' && 
                                  provider.projectId && 
                                  provider.location && 
                                  provider.credentials;
    
    if (provider.type === 'vertex' && hasVertexCredentials) {
      console.log(`🚀 [FOLLOWUP-ENGINE] Using Vertex AI`);
      
      // Parse credentials if they are a string (encrypted or JSON)
      let parsedCredentials = provider.credentials;
      if (typeof provider.credentials === 'string') {
        parsedCredentials = await parseServiceAccountJson(provider.credentials);
        if (!parsedCredentials) {
          console.warn(`⚠️ [FOLLOWUP-ENGINE] Failed to parse Vertex credentials, falling back to AI Studio`);
          // Fall through to else block by setting hasVertexCredentials to false
          if (provider.apiKey) {
            const ai = new GoogleGenAI({ apiKey: provider.apiKey });
            response = await ai.models.generateContent({
              model: "gemini-2.5-flash",
              config: { responseMimeType: "application/json" },
              contents: [{ role: "user", parts: [{ text: prompt }] }],
            });
          } else {
            return createDefaultSkipDecision("Credenziali Vertex non valide e nessuna API key di fallback");
          }
        }
      }
      
      if (parsedCredentials) {
        const vertexClient = createVertexGeminiClient(
          provider.projectId!,
          provider.location!,
          parsedCredentials
        );
        
        response = await vertexClient.generateContent({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: "application/json",
          },
        });
      }
    } else {
      console.log(`🌐 [FOLLOWUP-ENGINE] Using Google AI Studio`);
      if (provider.type === 'vertex' && !hasVertexCredentials) {
        console.warn('⚠️ [FOLLOWUP-ENGINE] Vertex AI requested but credentials missing');
        if (!provider.apiKey) {
          throw new Error('No API key available for fallback to Google AI Studio');
        }
      }
      
      const ai = new GoogleGenAI({ apiKey: provider.apiKey! });
      response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        config: {
          responseMimeType: "application/json",
        },
        contents: [
          {
            role: "user",
            parts: [{ text: prompt }],
          },
        ],
      });
    }

    const resultText = typeof response.text === 'function' ? response.text() : response.text;
    
    // Validate response before parsing
    if (!resultText || resultText === 'undefined' || typeof resultText !== 'string') {
      console.warn(`⚠️ [FOLLOWUP-ENGINE] Invalid AI response: ${resultText}`);
      return createDefaultSkipDecision("Risposta AI non valida");
    }
    
    const result = JSON.parse(resultText);
    const latencyMs = Date.now() - startTime;
    
    console.log(`✅ [FOLLOWUP-ENGINE] Decision: ${result.decision} (confidence: ${result.confidenceScore})`);
    console.log(`   Reasoning: ${result.reasoning}`);
    console.log(`   Latency: ${latencyMs}ms`);

    return {
      decision: result.decision || "skip",
      urgency: result.urgency || undefined,
      suggestedTemplateId: result.suggestedTemplateId || undefined,
      suggestedMessage: result.suggestedMessage || undefined,
      reasoning: result.reasoning || "Nessun reasoning fornito",
      confidenceScore: result.confidenceScore || 0.5,
      updatedEngagementScore: result.updatedEngagementScore || undefined,
      updatedConversionProbability: result.updatedConversionProbability || undefined,
      stateTransition: result.stateTransition || undefined,
    };
  } catch (error) {
    console.error("❌ [FOLLOWUP-ENGINE] Error evaluating follow-up:", error);
    return createDefaultSkipDecision(`Errore durante la valutazione: ${error}`);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Helper: Deterministic Rules Check
// ═══════════════════════════════════════════════════════════════════════════

function checkDeterministicRules(context: FollowupContext): FollowupDecision | null {
  // Regola 1: Se il lead ha detto esplicitamente NO → STOP
  if (context.signals.hasSaidNoExplicitly) {
    return {
      decision: "stop",
      urgency: "never",
      reasoning: "Il lead ha espresso un rifiuto esplicito. Rispettiamo la sua decisione.",
      confidenceScore: 1.0,
    };
  }

  // Regola 2: Se raggiunto il massimo di follow-up → STOP
  if (context.followupCount >= context.maxFollowupsAllowed) {
    return {
      decision: "stop",
      urgency: "never",
      reasoning: `Raggiunto il limite massimo di follow-up (${context.maxFollowupsAllowed}). Non inviamo ulteriori messaggi.`,
      confidenceScore: 1.0,
    };
  }

  // Regola 3: Se conversazione conclusa positivamente → STOP
  if (context.currentState === "closed_won") {
    return {
      decision: "stop",
      urgency: "never",
      reasoning: "Conversazione conclusa con successo. Non serve follow-up.",
      confidenceScore: 1.0,
    };
  }

  // Regola 4: Se conversazione persa → STOP
  if (context.currentState === "closed_lost") {
    return {
      decision: "stop",
      urgency: "never",
      reasoning: "Lead perso. Non inviamo ulteriori messaggi.",
      confidenceScore: 1.0,
    };
  }

  // Regola 5: Se risposta recente (meno di 24h) → SKIP
  if (context.daysSilent < 1) {
    return {
      decision: "skip",
      urgency: undefined,
      reasoning: "Il lead ha risposto di recente. Attendiamo prima di fare follow-up.",
      confidenceScore: 0.9,
    };
  }

  // Nessuna regola deterministica applicata, passare all'AI
  return null;
}

// ═══════════════════════════════════════════════════════════════════════════
// Helper: Build AI Prompt (in Italian)
// ═══════════════════════════════════════════════════════════════════════════

function buildFollowupPrompt(context: FollowupContext): string {
  const templatesInfo = context.availableTemplates.length > 0
    ? context.availableTemplates.map(t => `- ID: ${t.id}, Nome: "${t.name}", Uso: ${t.useCase}, Testo: "${t.bodyText.substring(0, 100)}..."`).join('\n')
    : "Nessun template disponibile";

  const messagesHistory = context.lastMessages.length > 0
    ? context.lastMessages.map(m => `[${m.timestamp}] ${m.role}: ${m.content}`).join('\n')
    : "Nessun messaggio precedente";

  return `Sei un esperto consulente di vendita italiano. Analizza questa situazione e decidi se e come fare follow-up con un lead.

CONTESTO CONVERSAZIONE:
- ID Conversazione: ${context.conversationId}
- Nome Lead: ${context.leadName || "Non specificato"}
- Stato Attuale: ${context.currentState}
- Giorni senza risposta: ${context.daysSilent}
- Follow-up già inviati: ${context.followupCount} di ${context.maxFollowupsAllowed} massimi
- Canale: ${context.channel}
- Tipo Agente: ${context.agentType}

SEGNALI RILEVATI:
- Ha chiesto il prezzo: ${context.signals.hasAskedPrice ? "Sì" : "No"}
- Ha menzionato urgenza: ${context.signals.hasMentionedUrgency ? "Sì" : "No"}
- Ha detto NO esplicitamente: ${context.signals.hasSaidNoExplicitly ? "Sì" : "No"}
- Discovery completata: ${context.signals.discoveryCompleted ? "Sì" : "No"}
- Demo presentata: ${context.signals.demoPresented ? "Sì" : "No"}

METRICHE:
- Engagement Score: ${context.engagementScore}/100
- Probabilità Conversione: ${(context.conversionProbability * 100).toFixed(0)}%

ULTIMI MESSAGGI:
${messagesHistory}

TEMPLATE DISPONIBILI:
${templatesInfo}

ISTRUZIONI:
1. Analizza il contesto e i segnali del lead
2. Considera il timing ottimale per un follow-up
3. Valuta se il lead è ancora interessato o se è meglio fermarsi
4. Se decidi di inviare, scegli il template più appropriato o suggerisci un messaggio personalizzato

REGOLE DI DECISIONE:
- "send_now": Invia subito se il momento è ottimale (lead caldo, segnali positivi)
- "schedule": Programma per dopo se è troppo presto ma c'è potenziale
- "skip": Salta questo ciclo se serve più tempo o ci sono dubbi
- "stop": Ferma definitivamente i follow-up se il lead non è interessato

RISPONDI IN FORMATO JSON:
{
  "decision": "send_now" | "schedule" | "skip" | "stop",
  "urgency": "now" | "tomorrow" | "next_week" | "never",
  "suggestedTemplateId": "id del template consigliato o null",
  "suggestedMessage": "messaggio personalizzato se non usi template",
  "reasoning": "spiegazione dettagliata in italiano della decisione",
  "confidenceScore": 0.0-1.0,
  "updatedEngagementScore": numero 0-100 o null,
  "updatedConversionProbability": numero 0-1 o null,
  "stateTransition": "nuovo stato suggerito o null"
}`;
}

// ═══════════════════════════════════════════════════════════════════════════
// Helper: Default Skip Decision
// ═══════════════════════════════════════════════════════════════════════════

function createDefaultSkipDecision(reason: string): FollowupDecision {
  return {
    decision: "skip",
    reasoning: reason,
    confidenceScore: 0,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Function: logFollowupDecision
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Salva la decisione AI nel log per apprendimento e analytics
 */
export async function logFollowupDecision(
  conversationId: string,
  context: FollowupContext,
  decision: FollowupDecision,
  modelUsed: string = "gemini-2.5-flash",
  tokensUsed?: number,
  latencyMs?: number
): Promise<void> {
  try {
    console.log(`📝 [FOLLOWUP-ENGINE] Logging decision for conversation ${conversationId}`);

    await db.insert(followupAiEvaluationLog).values({
      conversationId,
      conversationContext: {
        lastMessages: context.lastMessages,
        currentState: context.currentState,
        daysSilent: context.daysSilent,
        followupCount: context.followupCount,
        channel: context.channel,
        agentType: context.agentType,
        signals: {
          hasAskedPrice: context.signals.hasAskedPrice,
          hasMentionedUrgency: context.signals.hasMentionedUrgency,
          hasSaidNoExplicitly: context.signals.hasSaidNoExplicitly,
          discoveryCompleted: context.signals.discoveryCompleted,
          demoPresented: context.signals.demoPresented,
        },
      },
      decision: decision.decision,
      urgency: decision.urgency || null,
      selectedTemplateId: decision.suggestedTemplateId || null,
      reasoning: decision.reasoning,
      confidenceScore: decision.confidenceScore,
      modelUsed,
      tokensUsed: tokensUsed || null,
      latencyMs: latencyMs || null,
      wasExecuted: false,
    });

    console.log(`✅ [FOLLOWUP-ENGINE] Decision logged successfully`);
  } catch (error) {
    console.error("❌ [FOLLOWUP-ENGINE] Error logging decision:", error);
    // Non rilanciare l'errore - il logging non deve bloccare il flusso principale
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Function: updateConversationState
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Aggiorna lo stato della conversazione nel database
 */
export async function updateConversationState(
  conversationId: string,
  updates: Partial<{
    currentState: string;
    previousState: string;
    hasAskedPrice: boolean;
    hasMentionedUrgency: boolean;
    hasSaidNoExplicitly: boolean;
    discoveryCompleted: boolean;
    demoPresented: boolean;
    followupCount: number;
    lastFollowupAt: Date;
    nextFollowupScheduledAt: Date;
    engagementScore: number;
    conversionProbability: number;
    lastAiEvaluationAt: Date;
    aiRecommendation: string;
  }>
): Promise<void> {
  try {
    console.log(`🔄 [FOLLOWUP-ENGINE] Updating conversation state for ${conversationId}`);
    console.log(`   Updates:`, JSON.stringify(updates, null, 2));

    // Prima trova il record dello stato per questa conversazione
    const existingStates = await db
      .select()
      .from(conversationStates)
      .where(eq(conversationStates.conversationId, conversationId))
      .limit(1);

    if (existingStates.length === 0) {
      console.warn(`⚠️ [FOLLOWUP-ENGINE] No conversation state found for ${conversationId}`);
      return;
    }

    const stateId = existingStates[0].id;
    
    // Prepara l'oggetto di aggiornamento
    const updateData: any = {
      updatedAt: new Date(),
    };

    // Mappa i campi
    if (updates.currentState !== undefined) {
      updateData.currentState = updates.currentState;
      if (existingStates[0].currentState !== updates.currentState) {
        updateData.previousState = existingStates[0].currentState;
        updateData.stateChangedAt = new Date();
      }
    }
    if (updates.hasAskedPrice !== undefined) updateData.hasAskedPrice = updates.hasAskedPrice;
    if (updates.hasMentionedUrgency !== undefined) updateData.hasMentionedUrgency = updates.hasMentionedUrgency;
    if (updates.hasSaidNoExplicitly !== undefined) updateData.hasSaidNoExplicitly = updates.hasSaidNoExplicitly;
    if (updates.discoveryCompleted !== undefined) updateData.discoveryCompleted = updates.discoveryCompleted;
    if (updates.demoPresented !== undefined) updateData.demoPresented = updates.demoPresented;
    if (updates.followupCount !== undefined) updateData.followupCount = updates.followupCount;
    if (updates.lastFollowupAt !== undefined) updateData.lastFollowupAt = updates.lastFollowupAt;
    if (updates.nextFollowupScheduledAt !== undefined) updateData.nextFollowupScheduledAt = updates.nextFollowupScheduledAt;
    if (updates.engagementScore !== undefined) updateData.engagementScore = updates.engagementScore;
    if (updates.conversionProbability !== undefined) updateData.conversionProbability = updates.conversionProbability;
    if (updates.lastAiEvaluationAt !== undefined) updateData.lastAiEvaluationAt = updates.lastAiEvaluationAt;
    if (updates.aiRecommendation !== undefined) updateData.aiRecommendation = updates.aiRecommendation;

    await db
      .update(conversationStates)
      .set(updateData)
      .where(eq(conversationStates.id, stateId));

    console.log(`✅ [FOLLOWUP-ENGINE] Conversation state updated successfully`);
  } catch (error) {
    console.error("❌ [FOLLOWUP-ENGINE] Error updating conversation state:", error);
    throw error;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Utility Exports
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Utility per creare un provider Vertex AI dal contesto
 */
export function createVertexProvider(
  projectId: string,
  location: string,
  credentials: any
): AIProvider {
  return {
    type: 'vertex',
    projectId,
    location,
    credentials,
  };
}

/**
 * Utility per creare un provider Google AI Studio
 */
export function createStudioProvider(apiKey: string): AIProvider {
  return {
    type: 'studio',
    apiKey,
  };
}
