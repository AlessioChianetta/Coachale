/**
 * AI-ONLY DECISION ENGINE ("Dipendente Umano")
 * 
 * Questo modulo rimpiazza il vecchio sistema basato su regole codificate.
 * L'AI analizza TUTTO il contesto della conversazione come farebbe un
 * dipendente umano esperto, senza regole predefinite rigide.
 * 
 * L'AI riceve:
 * - Storico completo della chat
 * - Tipo di ogni messaggio (Template, Libero, Risposta Lead)
 * - Timing preciso
 * - Segnali dal lead
 * - Storico delle valutazioni AI precedenti
 * 
 * E decide autonomamente cosa fare.
 */

import { db } from "../db";
import { conversationStates, followupAiEvaluationLog, whatsappMessages, consultantAiPreferences } from "../../shared/schema";
import { eq, desc, and } from "drizzle-orm";
import { getAIProvider } from "./provider-factory";

// ═══════════════════════════════════════════════════════════════════════════
// CONSULTANT AI PREFERENCES
// ═══════════════════════════════════════════════════════════════════════════

export interface ConsultantPreferences {
  maxFollowupsTotal: number;
  minHoursBetweenFollowups: number;
  aggressivenessLevel: number;
  persistenceLevel: number;
  firstFollowupDelayHours: number;
  templateNoResponseDelayHours: number;
  customInstructions: string | null;
  stopOnFirstNo: boolean;
}

export async function getConsultantPreferences(consultantId: string): Promise<ConsultantPreferences> {
  const [prefs] = await db
    .select()
    .from(consultantAiPreferences)
    .where(eq(consultantAiPreferences.consultantId, consultantId))
    .limit(1);
  
  // Return defaults if no preferences set
  return {
    maxFollowupsTotal: prefs?.maxFollowupsTotal ?? 5,
    minHoursBetweenFollowups: prefs?.minHoursBetweenFollowups ?? 24,
    aggressivenessLevel: prefs?.aggressivenessLevel ?? 5,
    persistenceLevel: prefs?.persistenceLevel ?? 5,
    firstFollowupDelayHours: prefs?.firstFollowupDelayHours ?? 24,
    templateNoResponseDelayHours: prefs?.templateNoResponseDelayHours ?? 48,
    customInstructions: prefs?.customInstructions ?? null,
    stopOnFirstNo: prefs?.stopOnFirstNo ?? true,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// INTERFACES
// ═══════════════════════════════════════════════════════════════════════════

export type MessageType = 
  | "template_outbound"      // Template WhatsApp inviato automaticamente
  | "freeform_outbound"      // Messaggio libero inviato dall'agente
  | "lead_response"          // Risposta del lead
  | "system_notification"    // Notifica di sistema
  | "unknown";

export interface EnrichedMessage {
  id: string;
  role: "lead" | "agent" | "system";
  content: string;
  timestamp: string;
  messageType: MessageType;
  isTemplate: boolean;
  templateName?: string;
}

export interface ConversationContext {
  conversationId: string;
  leadName?: string;
  leadPhone: string;
  
  // Stato attuale
  currentState: string;
  agentType: string;
  channel: string;
  
  // Timing preciso
  hoursSinceLastMessage: number;
  hoursSinceLastLeadResponse: number | null;
  daysSilent: number;
  
  // Storico messaggi arricchito
  messages: EnrichedMessage[];
  totalMessages: number;
  messagesFromLead: number;
  messagesFromAgent: number;
  templatessSent: number;
  
  // Follow-up info
  followupCount: number;
  maxFollowupsAllowed: number;
  
  // Segnali rilevati
  signals: {
    hasAskedPrice: boolean;
    hasMentionedUrgency: boolean;
    hasSaidNoExplicitly: boolean;
    discoveryCompleted: boolean;
    demoPresented: boolean;
    leadNeverResponded: boolean;
  };
  
  // Metriche
  engagementScore: number;
  conversionProbability: number;
  temperatureLevel: "hot" | "warm" | "cold" | "ghost";
  
  // Template disponibili
  availableTemplates: Array<{
    id: string;
    name: string;
    useCase: string;
    bodyPreview: string;
  }>;
  
  // Valutazioni AI precedenti
  previousEvaluations: Array<{
    decision: string;
    reasoning: string;
    timestamp: string;
    confidenceScore: number;
  }>;
  
  // Finestra 24h WhatsApp
  window24hExpiresAt: Date | null;
  canSendFreeformNow: boolean;
  
  // Preferenze consulente (se disponibili)
  consultantPreferences?: ConsultantPreferences;
}

export interface HumanLikeDecision {
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
  internalThinking?: string; // Il "pensiero" dell'AI per debug
}

// ═══════════════════════════════════════════════════════════════════════════
// MESSAGE TYPE DETECTION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Rileva il tipo di messaggio basandosi sul contenuto e metadata
 */
export function detectMessageType(
  role: string,
  content: string,
  metadata?: any
): MessageType {
  // Se il metadata indica esplicitamente un template
  if (metadata?.isTemplate || metadata?.templateSid || metadata?.templateId) {
    return "template_outbound";
  }
  
  // Messaggio dal lead
  if (role === "lead" || role === "user" || role === "customer") {
    return "lead_response";
  }
  
  // Messaggio di sistema
  if (role === "system" || role === "notification") {
    return "system_notification";
  }
  
  // Euristica per rilevare template
  // I template WhatsApp hanno pattern riconoscibili
  const templatePatterns = [
    /\{\{[0-9]+\}\}/,           // Variabili template {{1}}, {{2}}
    /^Ciao \{\{1\}\}/i,          // Pattern comune di apertura
    /^Gentile/i,                 // Saluti formali tipici di template
    /^Buongiorno \{\{/i,
  ];
  
  const isLikelyTemplate = templatePatterns.some(pattern => pattern.test(content));
  
  if (role === "agent" || role === "assistant" || role === "bot") {
    return isLikelyTemplate ? "template_outbound" : "freeform_outbound";
  }
  
  return "unknown";
}

/**
 * Arricchisce i messaggi con il tipo rilevato
 */
export function enrichMessages(
  rawMessages: Array<{ 
    id?: string;
    role: string; 
    content: string; 
    timestamp?: string;
    createdAt?: Date;
    metadata?: any;
    isTemplate?: boolean;
    templateName?: string;
  }>
): EnrichedMessage[] {
  return rawMessages.map((msg, index) => {
    const messageType = detectMessageType(msg.role, msg.content, msg.metadata);
    const isTemplate = messageType === "template_outbound" || msg.isTemplate === true;
    
    // Normalizza il ruolo
    let normalizedRole: "lead" | "agent" | "system" = "agent";
    if (msg.role === "lead" || msg.role === "user" || msg.role === "customer") {
      normalizedRole = "lead";
    } else if (msg.role === "system" || msg.role === "notification") {
      normalizedRole = "system";
    }
    
    return {
      id: msg.id || `msg_${index}`,
      role: normalizedRole,
      content: msg.content,
      timestamp: msg.timestamp || msg.createdAt?.toISOString() || new Date().toISOString(),
      messageType,
      isTemplate,
      templateName: msg.templateName,
    };
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// PREVIOUS EVALUATIONS
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
    confidenceScore: typeof e.confidenceScore === 'string' 
      ? parseFloat(e.confidenceScore) 
      : (e.confidenceScore || 0),
  }));
}

// ═══════════════════════════════════════════════════════════════════════════
// AI PROMPT BUILDER
// ═══════════════════════════════════════════════════════════════════════════

function buildHumanLikePrompt(context: ConversationContext): string {
  // Prepara lo storico messaggi con indicazione del tipo
  const messagesHistory = context.messages.length > 0
    ? context.messages.map(m => {
        let typeLabel = "";
        switch (m.messageType) {
          case "template_outbound":
            typeLabel = "[TEMPLATE WHATSAPP]";
            break;
          case "freeform_outbound":
            typeLabel = "[MESSAGGIO AGENTE]";
            break;
          case "lead_response":
            typeLabel = "[RISPOSTA LEAD]";
            break;
          case "system_notification":
            typeLabel = "[SISTEMA]";
            break;
          default:
            typeLabel = "";
        }
        return `${m.timestamp} | ${m.role.toUpperCase()} ${typeLabel}: ${m.content}`;
      }).join('\n')
    : "Nessun messaggio nella conversazione";

  // Template disponibili
  const templatesInfo = context.availableTemplates.length > 0
    ? context.availableTemplates.map(t => 
        `- ID: "${t.id}", Nome: "${t.name}", Uso: ${t.useCase}`
      ).join('\n')
    : "Nessun template configurato";

  // Valutazioni precedenti
  const previousEvaluationsText = context.previousEvaluations.length > 0
    ? context.previousEvaluations.map(e => 
        `[${e.timestamp}] Decisione: ${e.decision} (${Math.round(e.confidenceScore * 100)}%) - ${e.reasoning.substring(0, 150)}...`
      ).join('\n')
    : "Prima valutazione per questa conversazione";

  return `# SEI UN CONSULENTE COMMERCIALE ESPERTO

Tu sei Marco, un consulente commerciale italiano con 15 anni di esperienza. Il tuo compito è analizzare questa conversazione WhatsApp e decidere COSA FARE con questo lead.

NON HAI REGOLE PREDEFINITE. Usa il tuo giudizio umano per decidere, proprio come faresti se fossi un dipendente in ufficio.

---

## INFORMAZIONI LEAD

**Nome:** ${context.leadName || "Non specificato"}
**Telefono:** ${context.leadPhone}
**Stato Attuale:** ${context.currentState}
**Temperatura:** ${context.temperatureLevel.toUpperCase()}
**Tipo Agente:** ${context.agentType}

---

## STATISTICHE CONVERSAZIONE

- **Totale messaggi:** ${context.totalMessages}
- **Messaggi dal lead:** ${context.messagesFromLead}
- **Messaggi nostri:** ${context.messagesFromAgent}
- **Template WhatsApp inviati:** ${context.templatessSent}
- **Follow-up già fatti:** ${context.followupCount} di ${context.maxFollowupsAllowed} massimi

---

## TIMING

- **Ore dall'ultimo messaggio (qualsiasi):** ${context.hoursSinceLastMessage.toFixed(1)}h
- **Ore dall'ultima risposta del LEAD:** ${context.hoursSinceLastLeadResponse !== null ? context.hoursSinceLastLeadResponse.toFixed(1) + 'h' : 'MAI RISPOSTO'}
- **Giorni senza attività:** ${context.daysSilent}

---

## SEGNALI RILEVATI

- Il lead ha MAI risposto? ${context.signals.leadNeverResponded ? "❌ NO, MAI RISPOSTO" : "✅ Sì, ha risposto almeno una volta"}
- Ha chiesto il prezzo? ${context.signals.hasAskedPrice ? "✅ Sì" : "❌ No"}
- Ha menzionato urgenza? ${context.signals.hasMentionedUrgency ? "✅ Sì" : "❌ No"}
- Ha detto NO esplicitamente? ${context.signals.hasSaidNoExplicitly ? "⚠️ SÌ!" : "❌ No"}
- Discovery completata? ${context.signals.discoveryCompleted ? "✅ Sì" : "❌ No"}
- Demo presentata? ${context.signals.demoPresented ? "✅ Sì" : "❌ No"}

---

## METRICHE

- **Engagement Score:** ${context.engagementScore}/100
- **Probabilità Conversione:** ${(context.conversionProbability * 100).toFixed(0)}%

---

## FINESTRA 24H WHATSAPP

${context.canSendFreeformNow 
  ? `✅ POSSIAMO inviare messaggi liberi (finestra aperta fino a ${context.window24hExpiresAt?.toISOString() || 'N/A'})` 
  : `⚠️ FUORI FINESTRA 24H - Possiamo usare SOLO template approvati`}

---

## STORICO CHAT COMPLETO
(Leggi attentamente ogni messaggio, nota se sono TEMPLATE o messaggi liberi)

${messagesHistory}

---

## LE TUE VALUTAZIONI PRECEDENTI

${previousEvaluationsText}

---

## TEMPLATE DISPONIBILI

${templatesInfo}

---

## PREFERENZE DEL CONSULENTE

${context.consultantPreferences ? `
Il consulente ha impostato queste preferenze per guidare le tue decisioni:

- **Max follow-up consentiti:** ${context.consultantPreferences.maxFollowupsTotal}
- **Attesa minima tra follow-up:** ${context.consultantPreferences.minHoursBetweenFollowups} ore
- **Ritardo primo follow-up:** ${context.consultantPreferences.firstFollowupDelayHours} ore
- **Attesa dopo template senza risposta:** ${context.consultantPreferences.templateNoResponseDelayHours} ore
- **Aggressività (1-10):** ${context.consultantPreferences.aggressivenessLevel} ${context.consultantPreferences.aggressivenessLevel <= 3 ? '(molto paziente)' : context.consultantPreferences.aggressivenessLevel >= 8 ? '(molto insistente)' : '(equilibrato)'}
- **Persistenza su lead freddi (1-10):** ${context.consultantPreferences.persistenceLevel}
- **Fermarsi al primo NO:** ${context.consultantPreferences.stopOnFirstNo ? 'Sì' : 'No, posso insistere gentilmente'}

${context.consultantPreferences.customInstructions ? `### ISTRUZIONI PERSONALIZZATE DAL CONSULENTE:
"${context.consultantPreferences.customInstructions}"

⚠️ IMPORTANTE: Rispetta queste istruzioni come se fossero ordini dal tuo capo!
` : ''}
` : 'Il consulente non ha impostato preferenze personalizzate. Usa le impostazioni predefinite.'}

---

## COME DEVI RAGIONARE

1. **LEGGI TUTTA LA CHAT** - Capiscila contestualmente
2. **IDENTIFICA IL PATTERN** - Il lead sta ignorando? Sta rispondendo? Ha detto no?
3. **NOTA I TEMPLATE** - Se abbiamo inviato un template e non ha risposto, potrebbe servire più tempo
4. **USA IL BUON SENSO** - Come ti comporteresti tu in ufficio?

### LINEE GUIDA (non regole rigide):

- **Se il lead NON ha MAI risposto** dopo il primo messaggio (template):
  - Non tempestarlo subito. Aspetta almeno 24-48h prima del primo follow-up
  - Se dopo 2-3 follow-up ancora non risponde, considera di fermarti
  
- **Se il lead HA risposto** ma ora è silenzioso:
  - Più interesse aveva mostrato, più vale la pena insistere
  - Ma se ha risposto freddo/disinteressato, non insistere troppo

- **Se l'ultimo messaggio è NOSTRO** (template o libero):
  - Non mandare subito un altro messaggio, dai tempo di rispondere
  - Aspetta almeno qualche ora per messaggi liberi, 24h+ per template

- **Se l'ultimo messaggio è DEL LEAD**:
  - Se è positivo/interessato: rispondi subito!
  - Se è una domanda: rispondi subito!
  - Se è negativo/"no grazie": fermati e rispetta la scelta

- **Template vs Messaggio Libero**:
  - I template sono più "freddi", se non risponde ad un template, il prossimo follow-up dovrebbe essere più personale
  - I messaggi liberi sono più "caldi", danno un tocco personale

---

## COSA DEVI DECIDERE

Rispondi con UNA delle seguenti azioni:

1. **send_now** - Invia SUBITO (il momento è perfetto)
2. **schedule** - PROGRAMMA per dopo (domani, settimana prossima)
3. **skip** - NON FARE NULLA adesso (la conversazione è attiva, il lead sta rispondendo)
4. **stop** - FERMATI DEFINITIVAMENTE (il lead non è interessato o ha detto no)

⚠️ IMPORTANTE: 
- Se vuoi ASPETTARE prima di mandare un follow-up, usa "schedule" con urgency "tomorrow" o "next_week", NON "skip"!
- "skip" significa che NON programmi nulla perché non serve (es: il lead sta già rispondendo attivamente)
- Se decidi "send_now" o "schedule", suggerisci quale template usare O scrivi un messaggio personalizzato

---

## FORMATO RISPOSTA (JSON)

\`\`\`json
{
  "internalThinking": "Il mio ragionamento passo-passo su questa situazione...",
  "decision": "send_now | schedule | skip | stop",
  "urgency": "now | tomorrow | next_week | never",
  "suggestedTemplateId": "id del template o null se messaggio libero",
  "suggestedMessage": "messaggio personalizzato se non uso template",
  "reasoning": "Spiegazione chiara in italiano per il consulente",
  "confidenceScore": 0.0-1.0,
  "updatedEngagementScore": numero 0-100 o null,
  "updatedConversionProbability": numero 0-1 o null,
  "stateTransition": "nuovo stato suggerito o null"
}
\`\`\`

Ora analizza la situazione e decidi come Marco, il consulente esperto.`;
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN EVALUATION FUNCTION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Valuta un lead con l'AI come "dipendente umano" - SENZA regole predefinite
 */
export async function evaluateWithHumanLikeAI(
  context: ConversationContext,
  consultantId: string
): Promise<HumanLikeDecision> {
  const startTime = Date.now();
  
  try {
    console.log(`🧑‍💼 [HUMAN-AI] Evaluating conversation ${context.conversationId} with human-like AI`);
    console.log(`   Lead: ${context.leadName || 'N/A'}, State: ${context.currentState}, Temp: ${context.temperatureLevel}`);
    console.log(`   Messages: ${context.totalMessages} total, ${context.messagesFromLead} from lead, ${context.templatessSent} templates`);
    console.log(`   Hours since last lead response: ${context.hoursSinceLastLeadResponse ?? 'NEVER'}`);

    // Recupera preferenze consulente
    const consultantPrefs = await getConsultantPreferences(consultantId);
    context.consultantPreferences = consultantPrefs;
    console.log(`⚙️ [HUMAN-AI] Loaded consultant preferences: maxFollowups=${consultantPrefs.maxFollowupsTotal}, minHours=${consultantPrefs.minHoursBetweenFollowups}`);
    if (consultantPrefs.customInstructions) {
      console.log(`📝 [HUMAN-AI] Custom instructions: "${consultantPrefs.customInstructions.substring(0, 100)}..."`);
    }

    // Recupera valutazioni precedenti
    const previousEvaluations = await getPreviousEvaluations(context.conversationId, 5);
    context.previousEvaluations = previousEvaluations;
    
    console.log(`📜 [HUMAN-AI] Found ${previousEvaluations.length} previous evaluations`);

    // Costruisci il prompt
    const prompt = buildHumanLikePrompt(context);
    
    // Ottieni AI provider
    const aiProviderResult = await getAIProvider(consultantId, consultantId);
    console.log(`🚀 [HUMAN-AI] Using ${aiProviderResult.metadata.name} for evaluation`);
    
    const response = await aiProviderResult.client.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.7, // Un po' di variabilità per decisioni più "umane"
      },
    });

    const resultText = response.response.text();
    
    if (!resultText || resultText === 'undefined' || typeof resultText !== 'string') {
      console.warn(`⚠️ [HUMAN-AI] Invalid AI response`);
      return createDefaultDecision("Risposta AI non valida");
    }
    
    let result;
    try {
      result = JSON.parse(resultText);
    } catch (jsonError) {
      console.error(`❌ [HUMAN-AI] JSON PARSE ERROR for ${context.conversationId}:`);
      console.error(`   Error: ${jsonError}`);
      console.error(`   Raw response length: ${resultText.length} chars`);
      console.error(`   Raw response (first 1000 chars): ${resultText.substring(0, 1000)}`);
      console.error(`   Raw response (last 500 chars): ${resultText.substring(Math.max(0, resultText.length - 500))}`);
      
      // Try to extract JSON from markdown code blocks
      const jsonMatch = resultText.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        try {
          result = JSON.parse(jsonMatch[1].trim());
          console.log(`✅ [HUMAN-AI] Recovered JSON from markdown code block`);
        } catch (recoveryError) {
          console.error(`❌ [HUMAN-AI] Recovery also failed: ${recoveryError}`);
          return createDefaultDecision(`Errore JSON: ${jsonError}`);
        }
      } else {
        return createDefaultDecision(`Errore JSON: ${jsonError}`);
      }
    }
    const latencyMs = Date.now() - startTime;
    
    console.log(`✅ [HUMAN-AI] Decision: ${result.decision} (confidence: ${result.confidenceScore})`);
    console.log(`   Reasoning: ${result.reasoning}`);
    if (result.internalThinking) {
      console.log(`   Thinking: ${result.internalThinking.substring(0, 200)}...`);
    }
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
      allowFreeformMessage: context.canSendFreeformNow,
      internalThinking: result.internalThinking,
    };
  } catch (error) {
    console.error("❌ [HUMAN-AI] Error in human-like evaluation:", error);
    return createDefaultDecision(`Errore: ${error}`);
  }
}

function createDefaultDecision(reason: string): HumanLikeDecision {
  return {
    decision: "skip",
    reasoning: reason,
    confidenceScore: 0,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// LOGGING
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Salva la decisione AI nel log
 */
export async function logHumanLikeDecision(
  conversationId: string,
  context: ConversationContext,
  decision: HumanLikeDecision,
  modelUsed: string = "gemini-2.5-flash",
  latencyMs?: number
): Promise<void> {
  try {
    console.log(`📝 [HUMAN-AI] Logging decision for conversation ${conversationId}`);

    await db.insert(followupAiEvaluationLog).values({
      conversationId,
      conversationContext: {
        lastMessages: context.messages.slice(-10),
        currentState: context.currentState,
        daysSilent: context.daysSilent,
        followupCount: context.followupCount,
        channel: context.channel,
        agentType: context.agentType,
        signals: context.signals,
        // Nuovi campi per il sistema human-like
        totalMessages: context.totalMessages,
        messagesFromLead: context.messagesFromLead,
        templatesSent: context.templatessSent,
        hoursSinceLastLeadResponse: context.hoursSinceLastLeadResponse,
        canSendFreeformNow: context.canSendFreeformNow,
        evaluationType: "human_like_ai", // Marca questo come nuovo sistema
      },
      decision: decision.decision,
      urgency: decision.urgency || null,
      selectedTemplateId: decision.suggestedTemplateId || null,
      reasoning: decision.reasoning,
      confidenceScore: decision.confidenceScore,
      modelUsed,
      latencyMs: latencyMs || null,
      wasExecuted: false,
    });

    console.log(`✅ [HUMAN-AI] Decision logged successfully`);
  } catch (error) {
    console.error("❌ [HUMAN-AI] Error logging decision:", error);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// BATCH EVALUATION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Valuta multiple conversazioni in batch con AI human-like
 */
export async function evaluateBatchWithHumanLikeAI(
  contexts: ConversationContext[],
  consultantId: string
): Promise<Array<{ conversationId: string; decision: HumanLikeDecision; processingTimeMs: number }>> {
  const results: Array<{ conversationId: string; decision: HumanLikeDecision; processingTimeMs: number }> = [];
  
  if (contexts.length === 0) {
    return results;
  }

  console.log(`🧑‍💼 [HUMAN-AI-BATCH] Evaluating ${contexts.length} conversations with human-like AI`);

  // Per ora valutiamo uno alla volta per massima qualità
  // In futuro si può ottimizzare con batch prompts
  for (const context of contexts) {
    const startTime = Date.now();
    const decision = await evaluateWithHumanLikeAI(context, consultantId);
    results.push({
      conversationId: context.conversationId,
      decision,
      processingTimeMs: Date.now() - startTime,
    });
  }

  console.log(`✅ [HUMAN-AI-BATCH] Completed ${results.length} evaluations`);
  return results;
}
