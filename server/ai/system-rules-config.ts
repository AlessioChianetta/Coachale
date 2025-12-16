/**
 * REGOLE DETERMINISTICHE DI SISTEMA
 * 
 * Queste regole vengono valutate PRIMA dell'AI in ordine di priorità.
 * Sono visibili nella UI in modalità read-only.
 * 
 * FLUSSO DECISIONALE:
 * 1. Valuta regole in ordine di priorità (100 = massima)
 * 2. Se una regola matcha → restituisce decisione
 * 3. Se nessuna regola matcha → passa all'AI
 */

export type SystemRuleDecision = "stop" | "skip" | "send_now";

export interface SystemRule {
  id: string;
  priority: number;
  label: string;
  labelIt: string;
  description: string;
  descriptionIt: string;
  decision: SystemRuleDecision;
  icon: string;
  reasoning: string;
  reasoningIt: string;
}

export const SYSTEM_RULES: SystemRule[] = [
  {
    id: "explicit_rejection",
    priority: 100,
    label: "Explicit Rejection",
    labelIt: "Rifiuto Esplicito",
    description: "Lead has explicitly said NO. We respect their decision.",
    descriptionIt: "Il lead ha detto esplicitamente NO. Rispettiamo la sua decisione.",
    decision: "stop",
    icon: "🚫",
    reasoning: "Lead has expressed explicit rejection. Respecting their decision.",
    reasoningIt: "Il lead ha espresso un rifiuto esplicito. Rispettiamo la sua decisione."
  },
  {
    id: "max_followups_reached",
    priority: 99,
    label: "Maximum Follow-ups Reached",
    labelIt: "Limite Follow-up Raggiunto",
    description: "Maximum number of follow-ups reached. No more messages sent.",
    descriptionIt: "Raggiunto il limite massimo di follow-up. Non inviamo ulteriori messaggi.",
    decision: "stop",
    icon: "📊",
    reasoning: "Reached maximum follow-up limit. No more messages sent.",
    reasoningIt: "Raggiunto il limite massimo di follow-up. Non inviamo ulteriori messaggi."
  },
  {
    id: "conversation_won",
    priority: 98,
    label: "Conversation Won",
    labelIt: "Conversazione Vinta",
    description: "Conversation successfully closed. No follow-up needed.",
    descriptionIt: "Conversazione conclusa con successo. Non serve follow-up.",
    decision: "stop",
    icon: "✅",
    reasoning: "Conversation successfully closed. No follow-up needed.",
    reasoningIt: "Conversazione conclusa con successo. Non serve follow-up."
  },
  {
    id: "conversation_lost",
    priority: 97,
    label: "Conversation Lost",
    labelIt: "Conversazione Persa",
    description: "Lead lost. No more messages sent.",
    descriptionIt: "Lead perso. Non inviamo ulteriori messaggi.",
    decision: "stop",
    icon: "❌",
    reasoning: "Lead lost. No more messages sent.",
    reasoningIt: "Lead perso. Non inviamo ulteriori messaggi."
  },
  {
    id: "pending_short_window",
    priority: 96,
    label: "Pending Response (Short Window)",
    labelIt: "In Attesa Risposta (Finestra Breve)",
    description: "Within 24h, last message was outbound with no reply. AI can send a free-form follow-up message.",
    descriptionIt: "Entro 24h, ultimo messaggio inviato da noi senza risposta. L'AI può inviare un messaggio di follow-up libero.",
    decision: "send_now",
    icon: "⚡",
    reasoning: "Within 24h window, awaiting response. AI generates free-form follow-up.",
    reasoningIt: "Entro finestra 24h, in attesa risposta. L'AI genera messaggio di follow-up libero."
  },
  {
    id: "recent_response_24h",
    priority: 95,
    label: "Recent Response (24h)",
    labelIt: "Risposta Recente (24h)",
    description: "Lead responded recently (within 24h). Waiting before follow-up.",
    descriptionIt: "Il lead ha risposto di recente (entro 24h). Attendiamo prima di fare follow-up.",
    decision: "skip",
    icon: "⏰",
    reasoning: "Lead responded recently. Waiting before follow-up.",
    reasoningIt: "Il lead ha risposto di recente. Attendiamo prima di fare follow-up."
  }
];

export interface RuleEvaluationContext {
  daysSilent: number;
  hoursSinceLastInbound: number;
  followupCount: number;
  maxFollowupsAllowed: number;
  currentState: string;
  lastMessageDirection: "inbound" | "outbound" | null;
  signals: {
    hasSaidNoExplicitly: boolean;
  };
}

export interface RuleEvaluationResult {
  matched: boolean;
  rule: SystemRule | null;
  decision: SystemRuleDecision | null;
  reasoning: string;
  reasoningIt: string;
  allowFreeformMessage: boolean;
}

export function evaluateSystemRules(context: RuleEvaluationContext): RuleEvaluationResult {
  const sortedRules = [...SYSTEM_RULES].sort((a, b) => b.priority - a.priority);
  
  for (const rule of sortedRules) {
    const matchResult = checkRuleCondition(rule, context);
    if (matchResult.matched) {
      console.log(`⚡ [SYSTEM-RULES] Rule matched: ${rule.id} (priority ${rule.priority})`);
      return {
        matched: true,
        rule,
        decision: rule.decision,
        reasoning: rule.reasoning,
        reasoningIt: rule.reasoningIt,
        allowFreeformMessage: rule.id === "pending_short_window"
      };
    }
  }
  
  return {
    matched: false,
    rule: null,
    decision: null,
    reasoning: "No deterministic rule matched. Passing to AI.",
    reasoningIt: "Nessuna regola deterministica applicata. Passaggio all'AI.",
    allowFreeformMessage: false
  };
}

function checkRuleCondition(rule: SystemRule, context: RuleEvaluationContext): { matched: boolean } {
  switch (rule.id) {
    case "explicit_rejection":
      return { matched: context.signals.hasSaidNoExplicitly };
    
    case "max_followups_reached":
      return { matched: context.followupCount >= context.maxFollowupsAllowed };
    
    case "conversation_won":
      return { matched: context.currentState === "closed_won" };
    
    case "conversation_lost":
      return { matched: context.currentState === "closed_lost" };
    
    case "pending_short_window":
      return { 
        matched: context.hoursSinceLastInbound < 24 && 
                 context.lastMessageDirection === "outbound"
      };
    
    case "recent_response_24h":
      return { 
        matched: context.hoursSinceLastInbound < 24 && 
                 context.lastMessageDirection === "inbound"
      };
    
    default:
      return { matched: false };
  }
}

export function getSystemRulesForDisplay(): Array<{
  id: string;
  priority: number;
  label: string;
  description: string;
  decision: string;
  icon: string;
}> {
  return SYSTEM_RULES
    .sort((a, b) => b.priority - a.priority)
    .map(rule => ({
      id: rule.id,
      priority: rule.priority,
      label: rule.labelIt,
      description: rule.descriptionIt,
      decision: rule.decision === "stop" ? "STOP" : 
                rule.decision === "skip" ? "ATTENDI" : 
                "INVIA ORA",
      icon: rule.icon
    }));
}
