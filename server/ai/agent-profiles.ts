/**
 * Agent Behavior Profiles
 * Defines how each agent type should behave in the follow-up strategy
 * 
 * Part of the "AI Director" system for intelligent annual relationship management
 */

// ═══════════════════════════════════════════════════════════════════════════
// Type Definitions
// ═══════════════════════════════════════════════════════════════════════════

export type AgentType =
    | "reactive_lead"       // Lead commerciale reattivo (risponde a richieste inbound)
    | "proactive_setter"    // Setter proattivo (outbound, fissa appuntamenti)
    | "informative_advisor" // Advisor informativo (supporto/consulenza)
    | "receptionist"        // Receptionist (gestione appuntamenti e info base)
    | "onboarding_coach";   // Coach onboarding (accompagna nuovi clienti)

export type FollowupStrategy = "aggressive" | "balanced" | "reactive" | "minimal";

export type ScheduleDecision =
    | "send_now"              // Invia subito
    | "schedule_hours"        // Schedula tra alcune ore
    | "schedule_tomorrow"     // Domani
    | "schedule_2_weeks"      // Fra 2 settimane
    | "schedule_1_month"      // Fra 1 mese
    | "nurturing_quarterly"   // Check ogni 3 mesi (piano annuale)
    | "silence_temporary"     // Silenzio temporaneo (ha già tutto)
    | "silence_permanent";    // Mai più contattare (ha detto no)

export type ConversationCompletionSignal =
    | "explicit_no"           // Ha detto no esplicitamente
    | "got_all_info"          // Ha ottenuto tutte le info
    | "appointment_booked"    // Appuntamento fissato
    | "issue_resolved"        // Problema risolto (supporto)
    | "competitor_mentioned"  // Ha menzionato competitor/altra scelta
    | "wrong_target"          // Non è il target giusto
    | "no_budget"             // Non ha budget
    | "not_now"               // Non ora, magari in futuro
    | "ghosting";             // Non risponde da molto tempo

export interface AgentProfile {
    name: string;
    description: string;
    followupStrategy: FollowupStrategy;

    // Timing configuration
    shortIntervalHours: number;        // Intervallo breve tra follow-up
    mediumIntervalDays: number;        // Intervallo medio (dopo silenzio)
    longIntervalDays: number;          // Intervallo lungo (dopo pause)
    nurturingIntervalDays: number;     // Check periodici nurturing

    // Limits
    maxFollowupsBeforePause: number;   // Quanti tentativi prima di pausa lunga
    maxTotalFollowups: number;         // Massimo follow-up totali

    // Behavior
    silenceConditions: ConversationCompletionSignal[];  // Quando stare in silenzio
    canSendFreeformMessages: boolean;  // Può inviare messaggi liberi
    requiresHumanEscalation: boolean;  // Richiede escalation umana in casi dubbi

    // AI Personality prompt addition
    personalityPrompt: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// Agent Profiles Definition
// ═══════════════════════════════════════════════════════════════════════════

export const AGENT_PROFILES: Record<AgentType, AgentProfile> = {

    // ─────────────────────────────────────────────────────────────────────────
    // LEAD REATTIVO (Commerciale Inbound)
    // ─────────────────────────────────────────────────────────────────────────
    "reactive_lead": {
        name: "Lead Reattivo (Commerciale)",
        description: "Gestisce lead commerciali che hanno mostrato interesse. Obiettivo: conversione.",
        followupStrategy: "balanced",

        shortIntervalHours: 24,          // Primo follow-up dopo 24h
        mediumIntervalDays: 3,           // Se non risponde, 3 giorni
        longIntervalDays: 14,            // Dopo 3 tentativi, 2 settimane
        nurturingIntervalDays: 60,       // Check ogni 2 mesi

        maxFollowupsBeforePause: 3,
        maxTotalFollowups: 8,

        silenceConditions: ["explicit_no", "competitor_mentioned", "no_budget"],
        canSendFreeformMessages: true,
        requiresHumanEscalation: false,

        personalityPrompt: `Sei un consulente commerciale strategico e rispettoso.
- NON tempestare il lead con messaggi frequenti
- Ogni messaggio DEVE portare valore nuovo (info, offerta, insight)
- Se il lead ha già tutte le info, aspetta che sia lui a farsi vivo
- Obiettivo: costruire relazione, non pressare
- Schedula check di cortesia dopo 2-4 settimane se conversazione ferma`
    },

    // ─────────────────────────────────────────────────────────────────────────
    // SETTER PROATTIVO (Outbound)
    // ─────────────────────────────────────────────────────────────────────────
    "proactive_setter": {
        name: "Setter Proattivo (Outbound)",
        description: "Contatta lead freddi per generare interesse e fissare appuntamenti.",
        followupStrategy: "aggressive",

        shortIntervalHours: 48,          // 2 giorni tra tentativi
        mediumIntervalDays: 7,           // 1 settimana
        longIntervalDays: 21,            // 3 settimane
        nurturingIntervalDays: 90,       // Check ogni 3 mesi

        maxFollowupsBeforePause: 2,      // Solo 2 tentativi per lead freddi
        maxTotalFollowups: 5,

        silenceConditions: ["explicit_no", "wrong_target", "not_now"],
        canSendFreeformMessages: false,  // Solo template approvati
        requiresHumanEscalation: false,

        personalityPrompt: `Sei un professionista che fa outreach mirato.
- I lead NON ti conoscono, sii rispettoso del loro tempo
- Massimo 2 tentativi iniziali, poi pausa lunga
- Se non rispondono, NON insistere - passa al nurturing trimestrale
- Un "non risponde" dopo 2 tentativi = passa a modalità nurturing
- Obiettivo: qualificare rapidamente, non stalkerare`
    },

    // ─────────────────────────────────────────────────────────────────────────
    // ADVISOR INFORMATIVO (Supporto/Consulenza)
    // ─────────────────────────────────────────────────────────────────────────
    "informative_advisor": {
        name: "Advisor Informativo (Supporto)",
        description: "Fornisce supporto, informazioni e consulenza ai clienti.",
        followupStrategy: "reactive",

        shortIntervalHours: 4,           // Supporto veloce
        mediumIntervalDays: 1,           // 1 giorno
        longIntervalDays: 7,             // 1 settimana
        nurturingIntervalDays: 30,       // Check mensile

        maxFollowupsBeforePause: 2,
        maxTotalFollowups: 4,

        silenceConditions: ["issue_resolved", "got_all_info"],
        canSendFreeformMessages: true,
        requiresHumanEscalation: true,   // Escalation per problemi complessi

        personalityPrompt: `Sei un assistente di supporto competente e discreto.
- Rispondi SOLO se c'è un problema aperto o una domanda pendente
- Se hai risolto il problema, NON inviare altri messaggi
- Un "grazie" o conferma positiva = conversazione CHIUSA
- Check solo se necessario dopo 1 settimana
- Obiettivo: risolvere, non disturbare`
    },

    // ─────────────────────────────────────────────────────────────────────────
    // RECEPTIONIST (Gestione Appuntamenti)
    // ─────────────────────────────────────────────────────────────────────────
    "receptionist": {
        name: "Receptionist Digitale",
        description: "Gestisce prenotazioni, conferme appuntamenti e info pratiche.",
        followupStrategy: "minimal",

        shortIntervalHours: 2,           // Conferme rapide
        mediumIntervalDays: 1,
        longIntervalDays: 3,
        nurturingIntervalDays: 60,       // Reminder periodici

        maxFollowupsBeforePause: 2,
        maxTotalFollowups: 3,

        silenceConditions: ["appointment_booked", "got_all_info"],
        canSendFreeformMessages: true,
        requiresHumanEscalation: false,

        personalityPrompt: `Sei un receptionist efficiente e cortese.
- Conferma appuntamenti, fornisci info pratiche
- Dopo conferma, STOP messaggi fino a reminder pre-appuntamento
- Non hai scopo commerciale, solo organizzativo
- Obiettivo: coordinamento pratico, zero spam`
    },

    // ─────────────────────────────────────────────────────────────────────────
    // ONBOARDING COACH (Nuovi Clienti)
    // ─────────────────────────────────────────────────────────────────────────
    "onboarding_coach": {
        name: "Coach Onboarding",
        description: "Accompagna nuovi clienti nei primi passi con il servizio.",
        followupStrategy: "balanced",

        shortIntervalHours: 24,
        mediumIntervalDays: 3,
        longIntervalDays: 7,
        nurturingIntervalDays: 30,

        maxFollowupsBeforePause: 5,      // Più tentativi per onboarding
        maxTotalFollowups: 10,

        silenceConditions: ["explicit_no", "issue_resolved"],
        canSendFreeformMessages: true,
        requiresHumanEscalation: true,

        personalityPrompt: `Sei un coach che accompagna i nuovi clienti.
- Prima settimana: più presente per assicurarti che tutto vada bene
- Dopo prima settimana: riduci frequenza, check settimanali
- Se cliente è autonomo, passa a check mensili
- Obiettivo: onboarding completo, poi passaggio a nurturing`
    }
};

// ═══════════════════════════════════════════════════════════════════════════
// Helper Functions
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Get agent profile by type, with fallback to reactive_lead
 */
export function getAgentProfile(agentType: string): AgentProfile {
    return AGENT_PROFILES[agentType as AgentType] || AGENT_PROFILES.reactive_lead;
}

/**
 * Check if a conversation should go silent based on signals
 */
export function shouldGoSilent(
    agentType: string,
    detectedSignals: ConversationCompletionSignal[]
): boolean {
    const profile = getAgentProfile(agentType);
    return detectedSignals.some(signal => profile.silenceConditions.includes(signal));
}

/**
 * Get recommended next contact interval based on current state
 */
export function getRecommendedInterval(
    agentType: string,
    consecutiveNoReply: number,
    isConversationComplete: boolean
): { hours?: number; days?: number; decision: ScheduleDecision } {
    const profile = getAgentProfile(agentType);

    if (isConversationComplete) {
        return {
            days: profile.nurturingIntervalDays,
            decision: "nurturing_quarterly"
        };
    }

    if (consecutiveNoReply === 0) {
        return {
            hours: profile.shortIntervalHours,
            decision: "schedule_hours"
        };
    }

    if (consecutiveNoReply < profile.maxFollowupsBeforePause) {
        return {
            days: profile.mediumIntervalDays,
            decision: "schedule_tomorrow"
        };
    }

    // Exceeded short-term attempts, go to long pause
    return {
        days: profile.longIntervalDays,
        decision: "schedule_2_weeks"
    };
}

/**
 * Build personality prompt section for AI
 */
export function buildAgentPersonalityPrompt(agentType: string): string {
    const profile = getAgentProfile(agentType);
    return `
## PROFILO AGENTE: ${profile.name}

**Strategia:** ${profile.followupStrategy}
**Descrizione:** ${profile.description}

**Limiti:**
- Max follow-up prima di pausa lunga: ${profile.maxFollowupsBeforePause}
- Max follow-up totali: ${profile.maxTotalFollowups}
- Intervallo breve: ${profile.shortIntervalHours}h
- Intervallo lungo: ${profile.longIntervalDays} giorni
- Nurturing: ogni ${profile.nurturingIntervalDays} giorni

**Condizioni di silenzio:** ${profile.silenceConditions.join(", ")}

**Personalità AI:**
${profile.personalityPrompt}
`;
}
