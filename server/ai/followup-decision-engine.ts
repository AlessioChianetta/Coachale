/**
 * AI Follow-up Decision Engine
 * Servizio che usa Vertex AI (Gemini 2.5 Flash) per decidere intelligentemente
 * quando e come contattare i lead nel sistema di follow-up algoritmico WhatsApp.
 */

import { db } from "../db";
import { conversationStates, followupAiEvaluationLog } from "../../shared/schema";
import { eq } from "drizzle-orm";
import { GoogleGenAI } from "@google/genai";
import { createVertexGeminiClient, parseServiceAccountJson, getAIProvider } from "./provider-factory";
import { evaluateSystemRules, RuleEvaluationContext } from "./system-rules-config";

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
  hoursSinceLastInbound: number;
  followupCount: number;
  maxFollowupsAllowed: number;
  channel: string;
  agentType: string;
  lastMessages: Array<{ role: string; content: string; timestamp: string }>;
  lastMessageDirection: "inbound" | "outbound" | null;
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
  allowFreeformMessage?: boolean;
  matchedSystemRule?: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// Interfaces for Batch Evaluation
// ═══════════════════════════════════════════════════════════════════════════

export interface ConversationForEvaluation {
  conversationId: string;
  context: FollowupContext;
  consultantId: string;
  temperatureLevel?: string;
  currentState: string;
}

export interface BatchEvaluationResult {
  conversationId: string;
  decision: FollowupDecision;
  processingTimeMs: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// Main Function: evaluateFollowup
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Valuta se inviare un follow-up e come farlo usando AI
 */
export async function evaluateFollowup(
  context: FollowupContext,
  consultantId: string
): Promise<FollowupDecision> {
  const startTime = Date.now();
  
  try {
    console.log(`🤖 [FOLLOWUP-ENGINE] Evaluating follow-up for conversation ${context.conversationId}`);
    console.log(`   State: ${context.currentState}, Days silent: ${context.daysSilent}, Follow-ups: ${context.followupCount}/${context.maxFollowupsAllowed}`);

    // Pre-check: regole deterministiche di sistema prima dell'AI
    const ruleContext: RuleEvaluationContext = {
      daysSilent: context.daysSilent,
      hoursSinceLastInbound: context.hoursSinceLastInbound,
      followupCount: context.followupCount,
      maxFollowupsAllowed: context.maxFollowupsAllowed,
      currentState: context.currentState,
      lastMessageDirection: context.lastMessageDirection,
      signals: {
        hasSaidNoExplicitly: context.signals.hasSaidNoExplicitly
      }
    };
    
    const ruleResult = evaluateSystemRules(ruleContext);
    if (ruleResult.matched && ruleResult.decision) {
      console.log(`⚡ [FOLLOWUP-ENGINE] System rule matched: ${ruleResult.rule?.id} - ${ruleResult.reasoningIt}`);
      
      if (ruleResult.decision === "stop") {
        return {
          decision: "stop",
          urgency: "never",
          reasoning: ruleResult.reasoningIt,
          confidenceScore: 1.0,
          matchedSystemRule: ruleResult.rule?.id
        };
      }
      
      if (ruleResult.decision === "skip") {
        return {
          decision: "skip",
          urgency: undefined,
          reasoning: ruleResult.reasoningIt,
          confidenceScore: 0.9,
          matchedSystemRule: ruleResult.rule?.id
        };
      }
      
      if (ruleResult.decision === "send_now" && ruleResult.allowFreeformMessage) {
        console.log(`⚡ [FOLLOWUP-ENGINE] Pending short-window: AI will generate freeform message`);
        return {
          decision: "send_now",
          urgency: "now",
          reasoning: ruleResult.reasoningIt,
          confidenceScore: 0.95,
          allowFreeformMessage: true,
          matchedSystemRule: ruleResult.rule?.id
        };
      }
    }

    // Costruisci il prompt per l'AI
    const prompt = buildFollowupPrompt(context);
    
    // Get AI provider using the unified provider factory
    const aiProviderResult = await getAIProvider(consultantId, consultantId);
    console.log(`🚀 [FOLLOWUP-ENGINE] Using ${aiProviderResult.metadata.name} for evaluation`);
    
    const response = await aiProviderResult.client.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
      },
    });

    const resultText = response.response.text();
    
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
// Batch Evaluation Function
// ═══════════════════════════════════════════════════════════════════════════

const BATCH_SIZE = 15;

/**
 * Raggruppa conversazioni per stato e temperatura
 */
function groupConversationsByStateAndTemperature(
  conversations: ConversationForEvaluation[]
): Map<string, ConversationForEvaluation[]> {
  const groups = new Map<string, ConversationForEvaluation[]>();
  
  for (const conv of conversations) {
    const key = `${conv.currentState}:${conv.temperatureLevel || 'unknown'}`;
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(conv);
  }
  
  return groups;
}

/**
 * Costruisce un prompt batch per valutare multiple conversazioni
 */
function buildBatchPrompt(conversations: ConversationForEvaluation[]): string {
  const conversationsData = conversations.map((conv, index) => {
    const ctx = conv.context;
    const templatesInfo = ctx.availableTemplates.length > 0
      ? ctx.availableTemplates.slice(0, 3).map(t => `${t.id}: ${t.name}`).join(', ')
      : "Nessuno";
    
    const lastMsgs = ctx.lastMessages.slice(-3).map(m => `[${m.role}]: ${m.content.substring(0, 100)}`).join(' | ');
    
    return `
[CONV_${index + 1}] ID: ${conv.conversationId}
- Lead: ${ctx.leadName || "N/D"}
- Stato: ${ctx.currentState}, Temp: ${conv.temperatureLevel || 'N/D'}
- Silenzio: ${ctx.daysSilent}gg (${ctx.hoursSinceLastInbound}h)
- Follow-up: ${ctx.followupCount}/${ctx.maxFollowupsAllowed}
- Segnali: Prezzo=${ctx.signals.hasAskedPrice ? 'Sì' : 'No'}, Urgenza=${ctx.signals.hasMentionedUrgency ? 'Sì' : 'No'}, No=${ctx.signals.hasSaidNoExplicitly ? 'Sì' : 'No'}
- Engagement: ${ctx.engagementScore}/100, Conv: ${(ctx.conversionProbability * 100).toFixed(0)}%
- Templates: ${templatesInfo}
- Ultimi msg: ${lastMsgs}`;
  }).join('\n');

  return `Sei un esperto consulente di vendita italiano. Analizza TUTTE le conversazioni seguenti e decidi per ognuna se e come fare follow-up.

${conversationsData}

REGOLE DECISIONE:
- "send_now": Lead caldo con segnali positivi, momento ottimale
- "schedule": Troppo presto ma potenziale, programma per dopo
- "skip": Serve più tempo, dubbi, aspetta
- "stop": Lead non interessato, ferma definitivamente

RISPONDI IN JSON ARRAY (un oggetto per conversazione, IN ORDINE):
[
  {
    "conversationId": "id della conversazione",
    "decision": "send_now" | "schedule" | "skip" | "stop",
    "urgency": "now" | "tomorrow" | "next_week" | "never",
    "suggestedTemplateId": "id template o null",
    "suggestedMessage": "messaggio personalizzato se non usi template",
    "reasoning": "spiegazione breve in italiano",
    "confidenceScore": 0.0-1.0
  }
]`;
}

/**
 * Valuta un batch di conversazioni con una singola chiamata AI
 * Raggruppa per stato/temperatura e processa in batch di max 15 conversazioni
 */
export async function evaluateConversationsBatch(
  conversations: ConversationForEvaluation[]
): Promise<BatchEvaluationResult[]> {
  const startTime = Date.now();
  const results: BatchEvaluationResult[] = [];
  
  if (conversations.length === 0) {
    return results;
  }

  console.log(`🤖 [FOLLOWUP-ENGINE-BATCH] Evaluating ${conversations.length} conversations in batch mode`);

  // Pre-check: applica regole deterministiche prima dell'AI per ogni conversazione
  const needsAiEvaluation: ConversationForEvaluation[] = [];
  
  for (const conv of conversations) {
    const ruleContext: RuleEvaluationContext = {
      daysSilent: conv.context.daysSilent,
      hoursSinceLastInbound: conv.context.hoursSinceLastInbound,
      followupCount: conv.context.followupCount,
      maxFollowupsAllowed: conv.context.maxFollowupsAllowed,
      currentState: conv.context.currentState,
      lastMessageDirection: conv.context.lastMessageDirection,
      signals: {
        hasSaidNoExplicitly: conv.context.signals.hasSaidNoExplicitly
      }
    };
    
    const ruleResult = evaluateSystemRules(ruleContext);
    if (ruleResult.matched && ruleResult.decision) {
      if (ruleResult.decision === "stop") {
        results.push({
          conversationId: conv.conversationId,
          decision: {
            decision: "stop",
            urgency: "never",
            reasoning: ruleResult.reasoningIt,
            confidenceScore: 1.0,
            matchedSystemRule: ruleResult.rule?.id
          },
          processingTimeMs: Date.now() - startTime
        });
        continue;
      }
      
      if (ruleResult.decision === "skip") {
        results.push({
          conversationId: conv.conversationId,
          decision: {
            decision: "skip",
            urgency: undefined,
            reasoning: ruleResult.reasoningIt,
            confidenceScore: 0.9,
            matchedSystemRule: ruleResult.rule?.id
          },
          processingTimeMs: Date.now() - startTime
        });
        continue;
      }
      
      if (ruleResult.decision === "send_now" && ruleResult.allowFreeformMessage) {
        results.push({
          conversationId: conv.conversationId,
          decision: {
            decision: "send_now",
            urgency: "now",
            reasoning: ruleResult.reasoningIt,
            confidenceScore: 0.95,
            allowFreeformMessage: true,
            matchedSystemRule: ruleResult.rule?.id
          },
          processingTimeMs: Date.now() - startTime
        });
        continue;
      }
    }
    
    needsAiEvaluation.push(conv);
  }

  console.log(`⚡ [FOLLOWUP-ENGINE-BATCH] ${results.length} resolved by system rules, ${needsAiEvaluation.length} need AI evaluation`);

  if (needsAiEvaluation.length === 0) {
    return results;
  }

  // Raggruppa per stato/temperatura
  const groups = groupConversationsByStateAndTemperature(needsAiEvaluation);
  console.log(`📊 [FOLLOWUP-ENGINE-BATCH] Grouped into ${groups.size} state/temperature groups`);

  // Processa ogni gruppo (o batch all'interno del gruppo)
  const consultantId = needsAiEvaluation[0].consultantId;
  
  try {
    const aiProviderResult = await getAIProvider(consultantId, consultantId);
    console.log(`🚀 [FOLLOWUP-ENGINE-BATCH] Using ${aiProviderResult.metadata.name} for batch evaluation`);

    for (const [groupKey, groupConversations] of groups) {
      console.log(`📦 [FOLLOWUP-ENGINE-BATCH] Processing group "${groupKey}" with ${groupConversations.length} conversations`);
      
      // Process in batches of BATCH_SIZE
      for (let i = 0; i < groupConversations.length; i += BATCH_SIZE) {
        const batch = groupConversations.slice(i, i + BATCH_SIZE);
        const batchStartTime = Date.now();
        
        try {
          const prompt = buildBatchPrompt(batch);
          
          const response = await aiProviderResult.client.generateContent({
            model: "gemini-2.5-flash",
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: {
              responseMimeType: "application/json",
            },
          });

          const resultText = response.response.text();
          
          if (!resultText || resultText === 'undefined' || typeof resultText !== 'string') {
            console.warn(`⚠️ [FOLLOWUP-ENGINE-BATCH] Invalid AI response for batch`);
            for (const conv of batch) {
              results.push({
                conversationId: conv.conversationId,
                decision: createDefaultSkipDecision("Risposta AI batch non valida"),
                processingTimeMs: Date.now() - batchStartTime
              });
            }
            continue;
          }
          
          const batchResults = JSON.parse(resultText);
          const batchProcessingTime = Date.now() - batchStartTime;
          
          // Map results back to conversation IDs
          const resultMap = new Map<string, any>();
          for (const r of batchResults) {
            if (r.conversationId) {
              resultMap.set(r.conversationId, r);
            }
          }
          
          for (const conv of batch) {
            const aiResult = resultMap.get(conv.conversationId);
            if (aiResult) {
              results.push({
                conversationId: conv.conversationId,
                decision: {
                  decision: aiResult.decision || "skip",
                  urgency: aiResult.urgency || undefined,
                  suggestedTemplateId: aiResult.suggestedTemplateId || undefined,
                  suggestedMessage: aiResult.suggestedMessage || undefined,
                  reasoning: aiResult.reasoning || "Nessun reasoning fornito",
                  confidenceScore: aiResult.confidenceScore || 0.5,
                },
                processingTimeMs: batchProcessingTime / batch.length
              });
            } else {
              results.push({
                conversationId: conv.conversationId,
                decision: createDefaultSkipDecision("Risultato AI non trovato per questa conversazione"),
                processingTimeMs: batchProcessingTime / batch.length
              });
            }
          }
          
          console.log(`✅ [FOLLOWUP-ENGINE-BATCH] Batch processed: ${batch.length} conversations in ${batchProcessingTime}ms`);
          
        } catch (error) {
          console.error(`❌ [FOLLOWUP-ENGINE-BATCH] Error processing batch:`, error);
          for (const conv of batch) {
            results.push({
              conversationId: conv.conversationId,
              decision: createDefaultSkipDecision(`Errore batch: ${error}`),
              processingTimeMs: Date.now() - batchStartTime
            });
          }
        }
      }
    }
  } catch (error) {
    console.error(`❌ [FOLLOWUP-ENGINE-BATCH] Error getting AI provider:`, error);
    for (const conv of needsAiEvaluation) {
      results.push({
        conversationId: conv.conversationId,
        decision: createDefaultSkipDecision(`Errore provider AI: ${error}`),
        processingTimeMs: Date.now() - startTime
      });
    }
  }

  const totalTime = Date.now() - startTime;
  console.log(`📈 [FOLLOWUP-ENGINE-BATCH] Batch evaluation completed: ${results.length} results in ${totalTime}ms (avg ${(totalTime / results.length).toFixed(1)}ms/conv)`);

  // Persist evaluation logs for all batch results
  for (const result of results) {
    if (!result.conversationId || !result.decision) continue;
    
    const conv = conversations.find(c => c.conversationId === result.conversationId);
    if (!conv) continue;
    
    try {
      await db.insert(followupAiEvaluationLog).values({
        conversationId: result.conversationId,
        consultantId: conv.consultantId,
        decision: result.decision.decision,
        reasoning: result.decision.reasoning || "Batch evaluation",
        confidenceScore: String(result.decision.confidenceScore || 0.5),
        suggestedTemplateId: result.decision.suggestedTemplateId || null,
        suggestedMessage: result.decision.suggestedMessage || null,
        matchedRuleId: result.decision.matchedSystemRule || null,
        matchedRuleReason: result.decision.matchedSystemRule ? result.decision.reasoning : null,
        stateTransition: result.decision.stateTransition || null,
        inputContext: JSON.stringify({
          currentState: conv.context.currentState,
          daysSilent: conv.context.daysSilent,
          followupCount: conv.context.followupCount,
          engagementScore: conv.context.engagementScore,
          batchMode: true
        }),
      });
    } catch (logError) {
      console.warn(`⚠️ [FOLLOWUP-ENGINE-BATCH] Failed to persist log for ${result.conversationId}:`, logError);
    }
  }

  return results;
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
