/**
 * AI Follow-up Decision Engine
 * Servizio che usa Vertex AI (Gemini 2.5 Flash) per decidere intelligentemente
 * quando e come contattare i lead nel sistema di follow-up algoritmico WhatsApp.
 * 
 * AGGIORNAMENTO: Ora usa il nuovo sistema "Human-Like AI" che decide tutto
 * senza regole codificate predefinite. L'AI analizza il contesto completo
 * come farebbe un dipendente umano esperto.
 */

import { db } from "../db";
import { conversationStates, followupAiEvaluationLog } from "../../shared/schema";
import { eq, desc } from "drizzle-orm";
import { getAIProvider, getModelWithThinking, GEMINI_3_THINKING_LEVEL } from "./provider-factory";
import { getAgentProfile, buildAgentPersonalityPrompt } from "./agent-profiles";
// Le regole di sistema NON vengono più usate - l'AI decide tutto
// import { evaluateSystemRules, RuleEvaluationContext } from "./system-rules-config";

// Flag per abilitare il nuovo sistema AI-only (Human-Like)
export const USE_HUMAN_LIKE_AI = true;

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

export type MessageType = 'template' | 'freeform' | 'inbound';

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
  lastMessages: Array<{ role: string; content: string; timestamp: string; messageType?: MessageType }>;
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
  // Tempo preciso per AI
  hoursSilent: number;
  minutesSilent: number;
  secondsSilent: number;
  // Flag se il lead non ha mai risposto
  leadNeverResponded: boolean;
  // Flag se l'ultimo messaggio outbound era un template (per TASK 3)
  lastOutboundWasTemplate?: boolean;
  // Valutazioni AI precedenti
  previousEvaluations?: Array<{
    decision: string;
    reasoning: string;
    timestamp: string;
    confidenceScore: number;
  }>;
}

export interface FollowupDecision {
  decision: "send_now" | "schedule" | "skip" | "stop" | "silence" | "nurturing";
  urgency?: "now" | "hours" | "tomorrow" | "days" | "weeks" | "months" | "never";
  scheduledHour?: number;
  scheduledMinute?: number;
  scheduledDays?: number;           // For long-term scheduling (e.g., 14 = 2 weeks)
  suggestedTemplateId?: string;
  suggestedMessage?: string;
  reasoning: string;
  confidenceScore: number;
  updatedEngagementScore?: number;
  updatedConversionProbability?: number;
  stateTransition?: string;
  allowFreeformMessage?: boolean;
  matchedSystemRule?: string;
  // New fields for AI Director
  isConversationComplete?: boolean;  // AI detected conversation has reached its goal
  completionReason?: string;         // Why AI thinks conversation is complete
  silenceReason?: string;            // Why AI chose to go silent
  longTermScheduleType?: "nurturing" | "reactivation" | "seasonal";
  // Model name used for the decision (for logging)
  modelName?: string;
  // Next Evaluation Time - when to re-evaluate this conversation (ISO 8601)
  nextEvaluationAt?: string;
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
// Helper: Get Previous AI Evaluations
// ═══════════════════════════════════════════════════════════════════════════

async function getPreviousEvaluations(conversationId: string, limit: number = 5): Promise<Array<{
  decision: string;
  reasoning: string;
  timestamp: string;
  confidenceScore: number;
}>> {
  const evaluations = await db
    .select({
      decision: followupAiEvaluationLog.decision,
      reasoning: followupAiEvaluationLog.reasoning,
      createdAt: followupAiEvaluationLog.createdAt,
      confidenceScore: followupAiEvaluationLog.confidenceScore,
    })
    .from(followupAiEvaluationLog)
    .where(eq(followupAiEvaluationLog.conversationId, conversationId))
    .orderBy(desc(followupAiEvaluationLog.createdAt))
    .limit(limit);

  return evaluations.map(e => ({
    decision: e.decision,
    reasoning: e.reasoning || '',
    timestamp: e.createdAt?.toISOString() || '',
    confidenceScore: e.confidenceScore || 0,
  }));
}

// ═══════════════════════════════════════════════════════════════════════════
// Main Function: evaluateFollowup
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Valuta se inviare un follow-up e come farlo usando AI
 * 
 * NUOVO SISTEMA: L'AI decide TUTTO senza regole predefinite.
 * L'AI analizza il contesto completo come un dipendente umano esperto.
 */
export async function evaluateFollowup(
  context: FollowupContext,
  consultantId: string
): Promise<FollowupDecision> {
  const startTime = Date.now();

  try {
    console.log(`🧑‍💼 [FOLLOWUP-ENGINE] Human-Like AI evaluation for conversation ${context.conversationId}`);
    console.log(`   State: ${context.currentState}, Days silent: ${context.daysSilent}, Follow-ups: ${context.followupCount}/${context.maxFollowupsAllowed}`);
    console.log(`   Mode: AI-ONLY (no hardcoded rules)`);

    // NUOVO: Nessuna regola deterministica! L'AI analizza tutto.
    // Le vecchie regole (explicit_rejection, max_followups, etc.) 
    // ora vengono considerate dall'AI nel suo ragionamento.

    // Recupera valutazioni AI precedenti per dare contesto storico all'AI
    const previousEvaluations = await getPreviousEvaluations(context.conversationId, 5);
    console.log(`📜 [FOLLOWUP-ENGINE] Found ${previousEvaluations.length} previous evaluations for context`);

    // Arricchisci il context con le valutazioni precedenti
    const enrichedContext: FollowupContext = {
      ...context,
      previousEvaluations
    };

    // Costruisci il prompt per l'AI
    const prompt = buildFollowupPrompt(enrichedContext);

    // Get AI provider using the unified provider factory
    const aiProviderResult = await getAIProvider(consultantId, consultantId);
    const { model, useThinking, thinkingLevel } = getModelWithThinking(aiProviderResult.metadata.name);
    console.log(`🚀 [FOLLOWUP-ENGINE] Using ${aiProviderResult.metadata.name} for evaluation`);
    console.log(`[AI] Using model: ${model} with thinking: ${useThinking ? thinkingLevel : 'disabled'}`);

    const response = await aiProviderResult.client.generateContent({
      model,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
        ...(useThinking && { thinkingConfig: { thinkingLevel } }),
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

    // Determina se possiamo inviare messaggi liberi (finestra 24h WhatsApp)
    // Se il lead ha risposto nelle ultime 24h, possiamo usare messaggi liberi
    // Altrimenti dobbiamo usare template approvati
    const canSendFreeform = !context.leadNeverResponded && context.hoursSinceLastInbound < 24;

    // Se l'AI ha suggerito un messaggio libero ma non siamo nella finestra 24h,
    // e non ha specificato un template, forziamo l'uso di un template
    let allowFreeformMessage = canSendFreeform;
    let finalSuggestedTemplateId = result.suggestedTemplateId || undefined;
    let finalDecision = result.decision || "skip";
    let finalReasoning = result.reasoning || "Nessun reasoning fornito";

    // TASK 1: Forzare template fuori 24h window
    // BUG 3 FIX: Filter only approved templates in auto-selection
    if (result.decision === "send_now" && !canSendFreeform && !result.suggestedTemplateId) {
      console.log(`⚠️ [FOLLOWUP-ENGINE] TASK 1: AI suggested send_now but outside 24h window without template - attempting auto-selection`);

      // BUG 3 FIX: Filter for approved templates only (HX prefix for Twilio or twilioStatus === 'approved')
      const approvedTemplates = (context.availableTemplates || []).filter(t => {
        // Twilio templates with HX prefix are pre-approved
        if (t.id.startsWith('HX')) {
          return true;
        }
        // For custom templates, check if twilioStatus is 'approved' (if available in the template object)
        // Since availableTemplates may include twilioStatus from getAvailableTemplates function
        const templateWithStatus = t as { id: string; name: string; useCase: string; bodyText: string; twilioStatus?: string };
        return templateWithStatus.twilioStatus === 'approved';
      });

      if (approvedTemplates.length > 0) {
        // Seleziona il primo template APPROVATO disponibile
        const autoSelectedTemplate = approvedTemplates[0];
        finalSuggestedTemplateId = autoSelectedTemplate.id;
        finalReasoning = `${result.reasoning} [AUTO-CORREZIONE: Fuori finestra 24h, auto-selezionato template approvato "${autoSelectedTemplate.name}"]`;
        console.log(`🔧 [FOLLOWUP-ENGINE] TASK 1: Auto-selected APPROVED template: ${autoSelectedTemplate.id} (${autoSelectedTemplate.name})`);
      } else {
        // Nessun template APPROVATO disponibile - cambiare decision a 'skip'
        finalDecision = "skip";
        finalReasoning = `Impossibile inviare: fuori finestra 24h WhatsApp e nessun template APPROVATO disponibile. Configurare almeno un template approvato per questo agente. [AI originale: ${result.reasoning}]`;
        console.log(`🚫 [FOLLOWUP-ENGINE] TASK 1: No APPROVED templates available outside 24h window - changing decision to 'skip'`);
      }
    }

    // Log nextEvaluationAt if provided by AI
    if (result.nextEvaluationAt) {
      console.log(`📅 [FOLLOWUP-ENGINE] AI suggested nextEvaluationAt: ${result.nextEvaluationAt}`);
    }

    return {
      decision: finalDecision,
      urgency: result.urgency || undefined,
      suggestedTemplateId: finalSuggestedTemplateId,
      suggestedMessage: result.suggestedMessage || undefined,
      reasoning: finalReasoning,
      confidenceScore: result.confidenceScore || 0.5,
      updatedEngagementScore: result.updatedEngagementScore || undefined,
      updatedConversionProbability: result.updatedConversionProbability || undefined,
      stateTransition: result.stateTransition || undefined,
      allowFreeformMessage,
      modelName: model,
      nextEvaluationAt: result.nextEvaluationAt || undefined, // Pass through for scheduler to save
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
    ? context.lastMessages.map(m => {
      const typeLabel = m.messageType
        ? (m.messageType === 'template' ? ' [TEMPLATE]' : m.messageType === 'freeform' ? ' [FREEFORM]' : ' [INBOUND]')
        : '';
      return `[${m.timestamp}]${typeLabel} ${m.role}: ${m.content}`;
    }).join('\n')
    : "Nessun messaggio precedente";

  // Calcola se siamo nella finestra 24h per messaggi liberi
  const canSendFreeform = !context.leadNeverResponded && context.hoursSinceLastInbound < 24;
  const window24hStatus = context.leadNeverResponded
    ? "❌ FUORI FINESTRA - Il lead non ha mai risposto, DEVI usare un Template approvato"
    : context.hoursSinceLastInbound < 24
      ? `✅ NELLA FINESTRA 24H - Puoi inviare messaggi liberi (il lead ha risposto ${context.hoursSinceLastInbound.toFixed(1)}h fa)`
      : `⚠️ FUORI FINESTRA 24H - Ultima risposta ${context.hoursSinceLastInbound.toFixed(1)}h fa, DEVI usare un Template approvato`;

  // Get agent profile for personality
  const agentProfilePrompt = buildAgentPersonalityPrompt(context.agentType);

  return `# SISTEMA AI DIRECTOR - VALUTAZIONE FOLLOW-UP INTELLIGENTE

${agentProfilePrompt}

---

Analizza questa conversazione WhatsApp e decidi COSA FARE con questo lead.
Agisci come un "AI Director" che gestisce relazioni nel lungo periodo (annuale).

**PRINCIPI FONDAMENTALI:**
- NON tempestare il lead con messaggi frequenti - ogni messaggio DEVE portare valore
- Se la conversazione ha raggiunto il suo obiettivo, VAI IN SILENZIO
- Programma check di cortesia a lungo termine invece di follow-up ravvicinati
- Rispetta i limiti del tuo profilo agente

---

## CONTESTO CONVERSAZIONE

- **ID Conversazione:** ${context.conversationId}
- **Nome Lead:** ${context.leadName || "Non specificato"}
- **Stato Attuale:** ${context.currentState}
- **Tempo trascorso:** ${context.daysSilent} giorni, ${context.hoursSilent % 24} ore, ${context.minutesSilent % 60} minuti
- **Il lead ha mai risposto:** ${context.leadNeverResponded ? "❌ NO (mai risposto)" : "✅ Sì"}
- **Follow-up già inviati:** ${context.followupCount} di ${context.maxFollowupsAllowed} massimi
- **Canale:** ${context.channel}
- **Tipo Agente:** ${context.agentType}

---

## ⚠️ FINESTRA 24H WHATSAPP (IMPORTANTE!)

${window24hStatus}

**Regola WhatsApp:** Puoi inviare messaggi liberi SOLO se il lead ha risposto nelle ultime 24 ore.
Altrimenti DEVI selezionare un template dalla lista sotto.

---

## SEGNALI RILEVATI DAL LEAD

- **Ha chiesto il prezzo:** ${context.signals.hasAskedPrice ? "✅ Sì (segnale positivo!)" : "❌ No"}
- **Ha menzionato urgenza:** ${context.signals.hasMentionedUrgency ? "✅ Sì (lead caldo!)" : "❌ No"}
- **Ha detto NO esplicitamente:** ${context.signals.hasSaidNoExplicitly ? "⚠️ SÌ! Rispetta la sua scelta!" : "❌ No"}
- **Discovery completata:** ${context.signals.discoveryCompleted ? "✅ Sì" : "❌ No"}
- **Demo presentata:** ${context.signals.demoPresented ? "✅ Sì" : "❌ No"}

---

## METRICHE

- **Engagement Score:** ${context.engagementScore}/100
- **Probabilità Conversione:** ${(context.conversionProbability * 100).toFixed(0)}%

---

## STORICO MESSAGGI

${messagesHistory}

---

## VALUTAZIONI PRECEDENTI

${context.previousEvaluations && context.previousEvaluations.length > 0
      ? context.previousEvaluations.map(e => `[${e.timestamp}] Decisione: ${e.decision} (${Math.round(e.confidenceScore * 100)}%) - ${e.reasoning.substring(0, 150)}...`).join('\n')
      : "Nessuna valutazione precedente"}

---

## TEMPLATE DISPONIBILI

${templatesInfo}

---

## TIPO DI CONVERSAZIONE

Analizza i messaggi e determina il tipo di conversazione:
- **VENDITA**: Il lead è interessato a comprare qualcosa
- **ASSISTENZA**: Il lead ha bisogno di supporto tecnico o aiuto  
- **INFO**: Il lead chiede informazioni generali
- **PRENOTAZIONE**: Il lead vuole prenotare un appuntamento
- **ALTRO**: Conversazione generica o sociale

Considera il tipo di conversazione per determinare l'azione appropriata.

---

## LINEE GUIDA DI VALUTAZIONE

### Criteri di decisione:

**Lead senza risposta:**
- Se followupCount = 0 e c'è già un messaggio nella chat → il lead ha già ricevuto il primo contatto
- Attendere 24-48h dopo il primo messaggio prima di un follow-up
- Dopo 2-3 tentativi senza risposta, considerare di fermarsi

**Lead che ha risposto ma ora è silenzioso:**
- Valutare il livello di interesse mostrato nelle risposte
- Lead interessato → insistere con follow-up
- Lead freddo → limitare i follow-up

**Ultimo messaggio outbound:**
- Se l'ultimo messaggio è nostro, attendere risposta del lead
- Intervallo minimo consigliato: qualche ora

**Rifiuto esplicito:**
- Se il lead ha detto "no" o simili → decisione = "stop"

**Limite follow-up raggiunto:**
- Massimo tentativi: ${context.maxFollowupsAllowed}

---

## COSA DEVI DECIDERE

Rispondi con UNA delle seguenti azioni:

### AZIONI IMMEDIATE
1. **send_now** - Invia SUBITO (il lead è caldo, c'è urgenza)
2. **schedule** - PROGRAMMA per dopo con urgency specifica

### AZIONI DI PAUSA STRATEGICA  
3. **silence** - VAI IN SILENZIO TEMPORANEO (la conversazione è completa, il lead ha ottenuto ciò che cercava)
4. **nurturing** - PASSA A MODALITÀ NURTURING (check periodici ogni settimane/mesi)
5. **skip** - NON fare nulla ora (il lead sta già rispondendo, non serve follow-up)
6. **stop** - FERMATI DEFINITIVAMENTE (il lead ha detto no esplicitamente)

### URGENCY OPTIONS
- "now" → invia subito
- "hours" → tra alcune ore (usa scheduledHour)
- "tomorrow" → domani
- "days" → tra X giorni (usa scheduledDays)
- "weeks" → tra 1-2 settimane (scheduledDays = 7 o 14)
- "months" → tra 1+ mesi (scheduledDays = 30, 60, 90)
- "never" → mai più

⚠️ **PRINCIPIO CHIAVE:**
- Se il lead ha già tutte le informazioni necessarie → **silence** + programma check tra 2 settimane
- Se non risponde da 3+ tentativi → **nurturing** con scheduledDays = 30-90
- Ogni messaggio DEVE portare valore nuovo, altrimenti → **silence**

---

## RILEVAMENTO CONVERSAZIONE COMPLETATA

Prima di decidere, analizza se la conversazione ha raggiunto il suo obiettivo naturale:

✅ **SEGNALI DI COMPLETAMENTO:**
- Il lead ha ottenuto le informazioni che cercava
- È stata fissata una call/appuntamento
- Il problema è stato risolto (per supporto)
- Il lead ha detto "grazie, ho capito tutto" o simili
- Il lead ha preso una decisione (positiva o negativa)

⚠️ **SE LA CONVERSAZIONE È COMPLETA:**
- Imposta isConversationComplete = true
- Usa decision = "silence" o "nurturing"
- Programma un check di cortesia tra 2-4 settimane (non un follow-up aggressivo!)

---

## FORMATO RISPOSTA (JSON)

{
  "decision": "send_now" | "schedule" | "silence" | "nurturing" | "skip" | "stop",
  "urgency": "now" | "hours" | "tomorrow" | "days" | "weeks" | "months" | "never",
  "scheduledHour": 9-18,
  "scheduledMinute": 0-59,
  "scheduledDays": numero di giorni (es: 7 = 1 settimana, 14 = 2 settimane, 30 = 1 mese, 90 = 3 mesi),
  "suggestedTemplateId": "ID template o null",
  "suggestedMessage": "messaggio libero solo se in finestra 24h",
  "reasoning": "Tempo dall'ultimo messaggio: X ore. [Analisi oggettiva]",
  "confidenceScore": 0.0-1.0,
  "isConversationComplete": true/false,
  "completionReason": "motivo per cui la conversazione è completa (se applicabile)",
  "silenceReason": "motivo per cui hai scelto di stare in silenzio (se applicabile)",
  "longTermScheduleType": "nurturing" | "reactivation" | null,
  "updatedEngagementScore": 0-100 o null,
  "updatedConversionProbability": 0-1 o null,
  "stateTransition": "nuovo stato o null",
  "nextEvaluationAt": "ISO 8601 timestamp - QUANDO rivalutare (OBBLIGATORIO se skip/silence/nurturing)"
}

---

## NEXT EVALUATION TIME (IMPORTANTE!)

Quando decidi **skip**, **silence**, o **nurturing**, DEVI specificare **nextEvaluationAt**:
- Formato: ISO 8601 con timezone (es: "2026-01-20T09:00:00+01:00")
- Solo orari lavorativi: 07:00-22:00
- Rispetta i giorni: venerdì sera → lunedì mattina

**ESEMPI:**
- È sera (22:00) → nextEvaluationAt: domani 09:00
- Sabato pomeriggio → nextEvaluationAt: lunedì 09:00
- Ha bisogno di tempo per decidere → nextEvaluationAt: tra 24 ore
- Nurturing lungo termine → nextEvaluationAt: tra 48-72 ore

**RANGE VALIDI:** minimo 30 minuti, massimo 72 ore

---

⚠️ RICORDA: 
- Se fuori finestra 24h, DEVI specificare suggestedTemplateId
- Se conversazione completata, imposta isConversationComplete = true
- Il reasoning DEVE iniziare con "Tempo dall'ultimo messaggio: X ore"
- Rispetta i limiti del tuo profilo agente
- **Se decision è skip/silence/nurturing, nextEvaluationAt è OBBLIGATORIO**`;
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
// Function: selectBestTemplateWithAI
// AI-powered template selection based on conversation context
// ═══════════════════════════════════════════════════════════════════════════

export interface TemplateForSelection {
  id: string;
  name: string;
  goal: string;
  tone: string;
  bodyText: string;
  priority: number;
}

export interface TemplateSelectionResult {
  selectedTemplateId: string | null;
  reasoning: string;
  confidence: number;
}

/**
 * Uses AI to select the best template based on conversation context.
 * Analyzes the conversation history and available templates to pick the most appropriate one.
 * 
 * @param conversationContext - Summary of the conversation
 * @param templates - Available templates for selection
 * @param consultantId - The consultant ID for AI provider lookup
 * @param maxRetries - Maximum retry attempts on error
 */
export async function selectBestTemplateWithAI(
  conversationContext: {
    leadName: string;
    currentState: string;
    daysSilent: number;
    lastMessages: Array<{ role: string; content: string }>;
  },
  templates: TemplateForSelection[],
  consultantId: string,
  maxRetries: number = 3
): Promise<TemplateSelectionResult> {
  console.log(`🎯 [TEMPLATE-AI] Selecting best template for conversation with ${templates.length} options`);

  if (templates.length === 0) {
    console.log(`⚠️ [TEMPLATE-AI] No templates available for selection`);
    return {
      selectedTemplateId: null,
      reasoning: "Nessun template disponibile per la selezione",
      confidence: 0
    };
  }

  if (templates.length === 1) {
    console.log(`✅ [TEMPLATE-AI] Only one template available, using it directly: ${templates[0].id}`);
    return {
      selectedTemplateId: templates[0].id,
      reasoning: "Unico template disponibile",
      confidence: 1.0
    };
  }

  // Build template summaries for the prompt - show full content for AI to analyze
  // NOTE: We explicitly do NOT show priority to the AI - selection must be content-based
  const templateSummaries = templates.map((t, index) =>
    `${index + 1}. ID: "${t.id}"
   Nome: "${t.name}"
   Obiettivo: ${t.goal || 'Non specificato'}
   Tono: ${t.tone || 'Professionale'}
   Testo Completo: "${t.bodyText}"`
  ).join('\n\n');

  // Build conversation summary - NO truncation to avoid AI seeing incomplete messages
  const recentMessages = conversationContext.lastMessages
    .slice(-5) // Only last 5 messages
    .map(m => `[${m.role}]: ${m.content}`)
    .join('\n');

  const prompt = `Sei un esperto di vendita. Devi scegliere il MIGLIOR template per fare follow-up con questo lead.

CONTESTO LEAD:
- Nome: ${conversationContext.leadName || 'Non specificato'}
- Stato: ${conversationContext.currentState}
- Giorni senza risposta: ${conversationContext.daysSilent}

ULTIMI MESSAGGI (LEGGI ATTENTAMENTE):
${recentMessages || 'Nessun messaggio precedente'}

TEMPLATE DISPONIBILI:
${templateSummaries}

ISTRUZIONI IMPORTANTI:
1. LEGGI ATTENTAMENTE la cronologia dei messaggi per capire il contesto
2. Scegli il template il cui CONTENUTO si adatta meglio alla situazione attuale
3. Considera: cosa è stato già detto? Di cosa ha bisogno il lead ora?
4. NON scegliere in base all'ordine o alla posizione del template
5. Valuta tono, obiettivo e contenuto del messaggio rispetto al contesto

RISPONDI SOLO IN JSON:
{
  "selectedTemplateId": "ID del template scelto",
  "reasoning": "Breve spiegazione in italiano del perché questo template è il più adatto AL CONTESTO DELLA CONVERSAZIONE",
  "confidence": 0.0-1.0
}`;

  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`🔄 [TEMPLATE-AI] Attempt ${attempt}/${maxRetries}`);

      // getAIProvider restituisce un client già pronto da usare
      const aiProvider = await getAIProvider(consultantId, consultantId);

      if (!aiProvider || !aiProvider.client) {
        throw new Error("No AI provider available");
      }

      console.log(`🤖 [TEMPLATE-AI] Using AI provider: ${aiProvider.metadata?.name || aiProvider.source}`);

      const { model: templateModel, useThinking: templateUseThinking, thinkingLevel: templateThinkingLevel } = getModelWithThinking(aiProvider.metadata.name);
      console.log(`[AI] Using model: ${templateModel} with thinking: ${templateUseThinking ? templateThinkingLevel : 'disabled'}`);

      // Usa direttamente il client già configurato con il formato corretto
      const aiResponse = await aiProvider.client.generateContent({
        model: templateModel,
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          ...(templateUseThinking && { thinkingConfig: { thinkingLevel: templateThinkingLevel } }),
        },
      });
      const responseText = aiResponse.response?.text() || "";

      // Parse JSON response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("No JSON found in AI response");
      }

      const parsedResult = JSON.parse(jsonMatch[0]);

      // Validate the selected template exists
      const selectedTemplate = templates.find(t => t.id === parsedResult.selectedTemplateId);
      if (!selectedTemplate) {
        console.warn(`⚠️ [TEMPLATE-AI] AI selected unknown template ID: ${parsedResult.selectedTemplateId}, falling back to first`);
        return {
          selectedTemplateId: templates[0].id,
          reasoning: `AI ha suggerito un template non valido. Usando il template prioritario: ${templates[0].name}`,
          confidence: 0.5
        };
      }

      console.log(`✅ [TEMPLATE-AI] Selected template: ${parsedResult.selectedTemplateId} (confidence: ${parsedResult.confidence})`);
      console.log(`   Reasoning: ${parsedResult.reasoning}`);

      return {
        selectedTemplateId: parsedResult.selectedTemplateId,
        reasoning: parsedResult.reasoning || "Template selezionato dall'AI",
        confidence: parsedResult.confidence || 0.8
      };

    } catch (error) {
      lastError = error as Error;
      console.error(`❌ [TEMPLATE-AI] Attempt ${attempt} failed:`, error);

      if (attempt < maxRetries) {
        // Wait before retry with exponential backoff
        const waitMs = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
        console.log(`⏳ [TEMPLATE-AI] Waiting ${waitMs}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, waitMs));
      }
    }
  }

  // All retries failed - throw error (no fallback to priority as requested)
  throw new Error(`Template AI selection failed after ${maxRetries} attempts: ${lastError?.message}`);
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
    followupCount: number | any; // Allow SQL expressions
    consecutiveNoReplyCount: number | any; // Allow SQL expressions
    lastFollowupAt: Date;
    nextFollowupScheduledAt: Date;
    engagementScore: number;
    conversionProbability: number;
    lastAiEvaluationAt: Date;
    aiRecommendation: string;
    dormantUntil: Date | null;
    permanentlyExcluded: boolean;
    dormantReason: string | null;
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
    if (updates.consecutiveNoReplyCount !== undefined) updateData.consecutiveNoReplyCount = updates.consecutiveNoReplyCount;
    if (updates.lastFollowupAt !== undefined) updateData.lastFollowupAt = updates.lastFollowupAt;
    if (updates.nextFollowupScheduledAt !== undefined) updateData.nextFollowupScheduledAt = updates.nextFollowupScheduledAt;
    if (updates.engagementScore !== undefined) updateData.engagementScore = updates.engagementScore;
    if (updates.conversionProbability !== undefined) updateData.conversionProbability = updates.conversionProbability;
    if (updates.lastAiEvaluationAt !== undefined) updateData.lastAiEvaluationAt = updates.lastAiEvaluationAt;
    if (updates.aiRecommendation !== undefined) updateData.aiRecommendation = updates.aiRecommendation;
    if (updates.dormantUntil !== undefined) updateData.dormantUntil = updates.dormantUntil;
    if (updates.permanentlyExcluded !== undefined) updateData.permanentlyExcluded = updates.permanentlyExcluded;
    if (updates.dormantReason !== undefined) updateData.dormantReason = updates.dormantReason;

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

    const lastMsgs = ctx.lastMessages.slice(-3).map(m => `[${m.role}]: ${m.content}`).join(' | ');

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
- "send_now": Lead caldo con segnali positivi, momento ottimale per inviare ORA
- "schedule": PROGRAMMA per dopo (domani/settimana). USA QUESTO quando vuoi mandare follow-up ma NON ora (es: "oggi è troppo presto" = schedule + tomorrow)
- "skip": NON programmare nulla. USA SOLO se lead sta rispondendo attivamente o non serve follow-up
- "stop": Lead non interessato, ferma DEFINITIVAMENTE

⚠️ Se primo messaggio inviato oggi e vuoi aspettare = USA "schedule" + "tomorrow", MAI "skip"!

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

  console.log(`🧑‍💼 [FOLLOWUP-ENGINE-BATCH] Evaluating ${conversations.length} conversations with Human-Like AI (no hardcoded rules)`);

  // NUOVO: Nessuna regola deterministica! Tutte le conversazioni vanno all'AI
  // L'AI analizza il contesto completo come un dipendente umano esperto
  const needsAiEvaluation: ConversationForEvaluation[] = [...conversations];

  console.log(`🧠 [FOLLOWUP-ENGINE-BATCH] All ${needsAiEvaluation.length} conversations will be evaluated by AI (no pre-filtering with rules)`);

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
    const { model: batchModel, useThinking: batchUseThinking, thinkingLevel: batchThinkingLevel } = getModelWithThinking(aiProviderResult.metadata.name);
    console.log(`🚀 [FOLLOWUP-ENGINE-BATCH] Using ${aiProviderResult.metadata.name} for batch evaluation`);
    console.log(`[AI] Using model: ${batchModel} with thinking: ${batchUseThinking ? batchThinkingLevel : 'disabled'}`);

    for (const [groupKey, groupConversations] of groups) {
      console.log(`📦 [FOLLOWUP-ENGINE-BATCH] Processing group "${groupKey}" with ${groupConversations.length} conversations`);

      // Process in batches of BATCH_SIZE
      for (let i = 0; i < groupConversations.length; i += BATCH_SIZE) {
        const batch = groupConversations.slice(i, i + BATCH_SIZE);
        const batchStartTime = Date.now();

        try {
          const prompt = buildBatchPrompt(batch);

          const response = await aiProviderResult.client.generateContent({
            model: batchModel,
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: {
              responseMimeType: "application/json",
              ...(batchUseThinking && { thinkingConfig: { thinkingLevel: batchThinkingLevel } }),
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
