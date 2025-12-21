/**
 * Default WhatsApp Templates Seed Data - OPTIMIZED VERSION
 * 
 * Contains 10 templates for each of the 5 agent types:
 * - receptionist
 * - proactive_setter
 * - informative_advisor
 * - customer_success
 * - intake_coordinator
 * 
 * Structure per agent:
 * - 1 APERTURA (opening) - uses {nome_lead}, {nome_consulente}, {nome_azienda}
 * - 8 RIPRESA (follow-up) - uses only {nome_lead}
 * - 1 CHIUSURA (closing) - uses only {nome_lead}
 */

export type AgentType = "receptionist" | "proactive_setter" | "informative_advisor" | "customer_success" | "intake_coordinator";

export type TemplateUseCase = 
    | "apertura"
    | "ripresa_24h"
    | "ripresa_48h"
    | "ripresa_valore"
    | "ripresa_domanda"
    | "ripresa_social_proof"
    | "ripresa_urgenza"
    | "ripresa_ultimo_tentativo"
    | "ripresa_riattivazione"
    | "chiusura";

export interface DefaultTemplate {
    templateName: string;
    description: string;
    body: string;
    useCase: TemplateUseCase;
    targetAgentType: AgentType;
}

export const AGENT_TYPE_LABELS: Record<AgentType, string> = {
    receptionist: "📞 Receptionist (Inbound)",
    proactive_setter: "🎯 Setter (Outbound)",
    informative_advisor: "📚 Consulente Educativo",
    customer_success: "❤️ Customer Success",
    intake_coordinator: "📋 Intake Coordinator",
};

export const USE_CASE_LABELS: Record<TemplateUseCase, string> = {
    apertura: "🟢 Apertura",
    ripresa_24h: "🔄 Ripresa 24h",
    ripresa_48h: "🔄 Ripresa 48h",
    ripresa_valore: "💎 Offerta Valore",
    ripresa_domanda: "❓ Domanda Aperta",
    ripresa_social_proof: "⭐ Social Proof",
    ripresa_urgenza: "⏰ Urgenza Soft",
    ripresa_ultimo_tentativo: "🙏 Ultimo Tentativo",
    ripresa_riattivazione: "🔔 Riattivazione",
    chiusura: "🏁 Chiusura",
};

// ═══════════════════════════════════════════════════════════════════════════
// RECEPTIONIST TEMPLATES (10)
// Tone: Welcoming, helpful, service-oriented
// ═══════════════════════════════════════════════════════════════════════════

const receptionistTemplates: DefaultTemplate[] = [
    {
        templateName: "Benvenuto Receptionist",
        description: "Primo messaggio di benvenuto - apertura conversazione",
        body: "Ciao {nome_lead}! Sono {nome_consulente} di {nome_azienda}. Benvenuto/a! Come posso aiutarti oggi?",
        useCase: "apertura",
        targetAgentType: "receptionist",
    },
    {
        templateName: "Ripresa 24h Receptionist",
        description: "Follow-up dopo 24h senza risposta",
        body: "Ciao {nome_lead}! Ti scrivo per sapere se hai ricevuto il mio messaggio. Posso esserti utile in qualche modo?",
        useCase: "ripresa_24h",
        targetAgentType: "receptionist",
    },
    {
        templateName: "Ripresa 48h Receptionist",
        description: "Follow-up gentile dopo 48h",
        body: "{nome_lead}, capisco che sei impegnato/a. Resto a disposizione quando hai un momento libero!",
        useCase: "ripresa_48h",
        targetAgentType: "receptionist",
    },
    {
        templateName: "Offerta Valore Receptionist",
        description: "Messaggio con offerta di valore/risorsa",
        body: "{nome_lead}, ho preparato una guida utile per te. Vuoi che te la invii? Potrebbe rispondere alle tue domande.",
        useCase: "ripresa_valore",
        targetAgentType: "receptionist",
    },
    {
        templateName: "Domanda Aperta Receptionist",
        description: "Messaggio con domanda aperta per riattivare",
        body: "{nome_lead}, c'è qualcosa di specifico che vorresti sapere sui nostri servizi? Sono qui per aiutarti.",
        useCase: "ripresa_domanda",
        targetAgentType: "receptionist",
    },
    {
        templateName: "Social Proof Receptionist",
        description: "Messaggio con prova sociale",
        body: "{nome_lead}, molti clienti come te ci hanno scelto per la nostra disponibilità. Posso mostrarti come li abbiamo aiutati?",
        useCase: "ripresa_social_proof",
        targetAgentType: "receptionist",
    },
    {
        templateName: "Urgenza Soft Receptionist",
        description: "Messaggio con urgenza leggera",
        body: "{nome_lead}, volevo avvisarti che ho ancora qualche slot disponibile questa settimana. Preferisci prenotare ora?",
        useCase: "ripresa_urgenza",
        targetAgentType: "receptionist",
    },
    {
        templateName: "Ultimo Tentativo Receptionist",
        description: "Ultimo messaggio rispettoso",
        body: "{nome_lead}, non voglio disturbarti ulteriormente. Se hai bisogno, sai dove trovarmi. Ti auguro una buona giornata!",
        useCase: "ripresa_ultimo_tentativo",
        targetAgentType: "receptionist",
    },
    {
        templateName: "Riattivazione Receptionist",
        description: "Riattivazione dopo lungo silenzio",
        body: "Ciao {nome_lead}! È passato un po' di tempo. Volevo sapere se posso esserti utile con qualcosa di nuovo.",
        useCase: "ripresa_riattivazione",
        targetAgentType: "receptionist",
    },
    {
        templateName: "Chiusura Receptionist",
        description: "Messaggio di chiusura positivo",
        body: "Grazie {nome_lead}! È stato un piacere assisterti. Ti auguro il meglio e resto sempre a disposizione!",
        useCase: "chiusura",
        targetAgentType: "receptionist",
    },
];

// ═══════════════════════════════════════════════════════════════════════════
// PROACTIVE SETTER TEMPLATES (10)
// Tone: Proactive, appointment-focused, persuasive
// ═══════════════════════════════════════════════════════════════════════════

const setterTemplates: DefaultTemplate[] = [
    {
        templateName: "Primo Contatto Setter",
        description: "Primo messaggio proattivo per fissare appuntamento",
        body: "Ciao {nome_lead}! Sono {nome_consulente} di {nome_azienda}. Ho 2 minuti per spiegarti come possiamo aiutarti?",
        useCase: "apertura",
        targetAgentType: "proactive_setter",
    },
    {
        templateName: "Ripresa 24h Setter",
        description: "Follow-up deciso dopo 24h",
        body: "{nome_lead}, volevo assicurarmi che avessi visto il mio messaggio. Quando hai 5 minuti per una breve chiamata?",
        useCase: "ripresa_24h",
        targetAgentType: "proactive_setter",
    },
    {
        templateName: "Ripresa 48h Setter",
        description: "Follow-up comprensivo dopo 48h",
        body: "Ciao {nome_lead}! So che sei occupato/a. Ti propongo una chiamata veloce di 10 minuti. Quando ti fa comodo?",
        useCase: "ripresa_48h",
        targetAgentType: "proactive_setter",
    },
    {
        templateName: "Offerta Valore Setter",
        description: "Proposta di valore concreta",
        body: "{nome_lead}, ho un'idea che potrebbe interessarti molto. Posso mostrartela in una breve chiamata?",
        useCase: "ripresa_valore",
        targetAgentType: "proactive_setter",
    },
    {
        templateName: "Domanda Aperta Setter",
        description: "Domanda per capire le esigenze",
        body: "{nome_lead}, cosa ti impedisce di fare il prossimo passo? Forse posso aiutarti a superare questo ostacolo.",
        useCase: "ripresa_domanda",
        targetAgentType: "proactive_setter",
    },
    {
        templateName: "Social Proof Setter",
        description: "Leva sociale per convincere",
        body: "{nome_lead}, altre persone nella tua situazione hanno ottenuto risultati incredibili. Vuoi sapere come?",
        useCase: "ripresa_social_proof",
        targetAgentType: "proactive_setter",
    },
    {
        templateName: "Urgenza Soft Setter",
        description: "Creare senso di urgenza",
        body: "{nome_lead}, ho solo 2 slot liberi questa settimana. Ti prenoto uno prima che finiscano?",
        useCase: "ripresa_urgenza",
        targetAgentType: "proactive_setter",
    },
    {
        templateName: "Ultimo Tentativo Setter",
        description: "Ultimo tentativo rispettoso",
        body: "{nome_lead}, questo è il mio ultimo messaggio. Se non è il momento giusto, nessun problema. Ti auguro il meglio!",
        useCase: "ripresa_ultimo_tentativo",
        targetAgentType: "proactive_setter",
    },
    {
        templateName: "Riattivazione Setter",
        description: "Riattivazione lead dormiente",
        body: "Ciao {nome_lead}! È passato un po' di tempo. Ho novità interessanti da condividere. Hai 5 minuti?",
        useCase: "ripresa_riattivazione",
        targetAgentType: "proactive_setter",
    },
    {
        templateName: "Chiusura Setter",
        description: "Chiusura positiva e professionale",
        body: "Grazie {nome_lead}! È stato un piacere conoscerti. Se cambi idea, sai dove trovarmi. In bocca al lupo!",
        useCase: "chiusura",
        targetAgentType: "proactive_setter",
    },
];

// ═══════════════════════════════════════════════════════════════════════════
// INFORMATIVE ADVISOR TEMPLATES (10)
// Tone: Educational, value-driven, informative
// ═══════════════════════════════════════════════════════════════════════════

const advisorTemplates: DefaultTemplate[] = [
    {
        templateName: "Benvenuto Advisor",
        description: "Primo messaggio educativo",
        body: "Ciao {nome_lead}! Sono {nome_consulente} di {nome_azienda}. Sono qui per rispondere a tutte le tue domande!",
        useCase: "apertura",
        targetAgentType: "informative_advisor",
    },
    {
        templateName: "Ripresa 24h Advisor",
        description: "Follow-up informativo dopo 24h",
        body: "{nome_lead}, hai avuto modo di leggere le informazioni? Sono qui se hai domande o vuoi approfondire.",
        useCase: "ripresa_24h",
        targetAgentType: "informative_advisor",
    },
    {
        templateName: "Ripresa 48h Advisor",
        description: "Follow-up gentile dopo 48h",
        body: "Ciao {nome_lead}! Capisco che stai valutando. Resto a disposizione per qualsiasi chiarimento ti serva.",
        useCase: "ripresa_48h",
        targetAgentType: "informative_advisor",
    },
    {
        templateName: "Offerta Valore Advisor",
        description: "Condivisione risorsa educativa",
        body: "{nome_lead}, ho preparato una guida gratuita su questo argomento. Vuoi che te la invii?",
        useCase: "ripresa_valore",
        targetAgentType: "informative_advisor",
    },
    {
        templateName: "Domanda Aperta Advisor",
        description: "Domanda per capire interessi",
        body: "{nome_lead}, qual è l'aspetto che ti interessa approfondire di più? Così posso aiutarti meglio.",
        useCase: "ripresa_domanda",
        targetAgentType: "informative_advisor",
    },
    {
        templateName: "Social Proof Advisor",
        description: "Esempio di successo educativo",
        body: "{nome_lead}, molti hanno avuto i tuoi stessi dubbi. Ecco come li hanno risolti grazie alle nostre informazioni.",
        useCase: "ripresa_social_proof",
        targetAgentType: "informative_advisor",
    },
    {
        templateName: "Urgenza Soft Advisor",
        description: "Invito ad agire con consapevolezza",
        body: "{nome_lead}, prima inizi a informarti, prima potrai prendere una decisione consapevole. Posso aiutarti?",
        useCase: "ripresa_urgenza",
        targetAgentType: "informative_advisor",
    },
    {
        templateName: "Ultimo Tentativo Advisor",
        description: "Ultimo messaggio rispettoso",
        body: "{nome_lead}, non voglio essere invadente. Se hai bisogno di informazioni, sai dove trovarmi. Buon percorso!",
        useCase: "ripresa_ultimo_tentativo",
        targetAgentType: "informative_advisor",
    },
    {
        templateName: "Riattivazione Advisor",
        description: "Riattivazione con nuovi contenuti",
        body: "Ciao {nome_lead}! Ho nuovi contenuti formativi che potrebbero interessarti. Vuoi che ti aggiorni?",
        useCase: "ripresa_riattivazione",
        targetAgentType: "informative_advisor",
    },
    {
        templateName: "Chiusura Advisor",
        description: "Chiusura con augurio formativo",
        body: "Grazie {nome_lead}! Spero di averti dato informazioni utili. Ti auguro un ottimo percorso di crescita!",
        useCase: "chiusura",
        targetAgentType: "informative_advisor",
    },
];

// ═══════════════════════════════════════════════════════════════════════════
// CUSTOMER SUCCESS TEMPLATES (10)
// Tone: Empathetic, post-sale support, caring
// ═══════════════════════════════════════════════════════════════════════════

const customerSuccessTemplates: DefaultTemplate[] = [
    {
        templateName: "Benvenuto Customer Success",
        description: "Primo messaggio post-acquisto",
        body: "Ciao {nome_lead}! Sono {nome_consulente} di {nome_azienda}. Benvenuto/a! Sono qui per supportarti nel tuo percorso.",
        useCase: "apertura",
        targetAgentType: "customer_success",
    },
    {
        templateName: "Ripresa 24h CS",
        description: "Check-in dopo 24h",
        body: "{nome_lead}, volevo sapere come sta andando. Hai bisogno di aiuto con qualcosa?",
        useCase: "ripresa_24h",
        targetAgentType: "customer_success",
    },
    {
        templateName: "Ripresa 48h CS",
        description: "Follow-up empatico dopo 48h",
        body: "Ciao {nome_lead}! Non ti sento da un po'. Tutto bene? Sono qui se hai bisogno di supporto.",
        useCase: "ripresa_48h",
        targetAgentType: "customer_success",
    },
    {
        templateName: "Offerta Valore CS",
        description: "Condivisione risorsa esclusiva",
        body: "{nome_lead}, ho un consiglio esclusivo per te che potrebbe migliorare la tua esperienza. Posso condividerlo?",
        useCase: "ripresa_valore",
        targetAgentType: "customer_success",
    },
    {
        templateName: "Domanda Aperta CS",
        description: "Domanda per capire soddisfazione",
        body: "{nome_lead}, come ti trovi finora? C'è qualcosa che potremmo fare meglio per te?",
        useCase: "ripresa_domanda",
        targetAgentType: "customer_success",
    },
    {
        templateName: "Social Proof CS",
        description: "Condivisione successi altri clienti",
        body: "{nome_lead}, ecco cosa stanno ottenendo altri clienti come te. Vuoi qualche suggerimento per replicare?",
        useCase: "ripresa_social_proof",
        targetAgentType: "customer_success",
    },
    {
        templateName: "Urgenza Soft CS",
        description: "Invito a sfruttare opportunità",
        body: "{nome_lead}, ci sono alcune risorse che scadono presto. Vuoi che ti aiuti a sfruttarle al meglio?",
        useCase: "ripresa_urgenza",
        targetAgentType: "customer_success",
    },
    {
        templateName: "Ultimo Tentativo CS",
        description: "Ultimo check-in rispettoso",
        body: "{nome_lead}, non voglio disturbarti. Sappi che sono sempre qui per te. Un abbraccio!",
        useCase: "ripresa_ultimo_tentativo",
        targetAgentType: "customer_success",
    },
    {
        templateName: "Riattivazione CS",
        description: "Riattivazione cliente inattivo",
        body: "Ciao {nome_lead}! È passato un po' di tempo. Mi manchi! C'è qualcosa che posso fare per aiutarti?",
        useCase: "ripresa_riattivazione",
        targetAgentType: "customer_success",
    },
    {
        templateName: "Chiusura CS",
        description: "Chiusura con calore",
        body: "Grazie {nome_lead}! È stato un piacere supportarti. Siamo sempre qui per te. A presto!",
        useCase: "chiusura",
        targetAgentType: "customer_success",
    },
];

// ═══════════════════════════════════════════════════════════════════════════
// INTAKE COORDINATOR TEMPLATES (10)
// Tone: Practical, document-focused, efficient
// ═══════════════════════════════════════════════════════════════════════════

const intakeTemplates: DefaultTemplate[] = [
    {
        templateName: "Benvenuto Intake",
        description: "Primo messaggio pratico per raccolta documenti",
        body: "Ciao {nome_lead}! Sono {nome_consulente} di {nome_azienda}. Ti guido nella raccolta dei documenti necessari.",
        useCase: "apertura",
        targetAgentType: "intake_coordinator",
    },
    {
        templateName: "Ripresa 24h Intake",
        description: "Promemoria documenti dopo 24h",
        body: "{nome_lead}, ti ricordo di inviarmi i documenti richiesti. Manca poco per completare la pratica!",
        useCase: "ripresa_24h",
        targetAgentType: "intake_coordinator",
    },
    {
        templateName: "Ripresa 48h Intake",
        description: "Follow-up comprensivo dopo 48h",
        body: "Ciao {nome_lead}! Capisco che reperire i documenti richiede tempo. Posso aiutarti in qualche modo?",
        useCase: "ripresa_48h",
        targetAgentType: "intake_coordinator",
    },
    {
        templateName: "Offerta Valore Intake",
        description: "Invio checklist documenti",
        body: "{nome_lead}, ti invio la checklist completa dei documenti. Così puoi procedere con ordine. La vuoi?",
        useCase: "ripresa_valore",
        targetAgentType: "intake_coordinator",
    },
    {
        templateName: "Domanda Aperta Intake",
        description: "Domanda su difficoltà documenti",
        body: "{nome_lead}, c'è qualche documento che fai fatica a reperire? Posso suggerirti come ottenerlo.",
        useCase: "ripresa_domanda",
        targetAgentType: "intake_coordinator",
    },
    {
        templateName: "Social Proof Intake",
        description: "Rassicurazione su processo",
        body: "{nome_lead}, molti clienti completano la documentazione in pochi giorni. Sei quasi al traguardo!",
        useCase: "ripresa_social_proof",
        targetAgentType: "intake_coordinator",
    },
    {
        templateName: "Urgenza Soft Intake",
        description: "Promemoria scadenza gentile",
        body: "{nome_lead}, i documenti servono entro breve per procedere. Riesci a inviarli questa settimana?",
        useCase: "ripresa_urgenza",
        targetAgentType: "intake_coordinator",
    },
    {
        templateName: "Ultimo Tentativo Intake",
        description: "Ultimo promemoria rispettoso",
        body: "{nome_lead}, questo è il mio ultimo promemoria. Se hai difficoltà, fammelo sapere. Sono qui per aiutarti.",
        useCase: "ripresa_ultimo_tentativo",
        targetAgentType: "intake_coordinator",
    },
    {
        templateName: "Riattivazione Intake",
        description: "Riattivazione pratica sospesa",
        body: "Ciao {nome_lead}! La tua pratica è ancora in sospeso. Posso aiutarti a completarla velocemente?",
        useCase: "ripresa_riattivazione",
        targetAgentType: "intake_coordinator",
    },
    {
        templateName: "Chiusura Intake",
        description: "Conferma documenti completi",
        body: "Grazie {nome_lead}! Documentazione completa! Sei pronto/a per il prossimo step. A presto!",
        useCase: "chiusura",
        targetAgentType: "intake_coordinator",
    },
];

// ═══════════════════════════════════════════════════════════════════════════
// COMBINED EXPORT
// ═══════════════════════════════════════════════════════════════════════════

export const DEFAULT_TEMPLATES: DefaultTemplate[] = [
    ...receptionistTemplates,
    ...setterTemplates,
    ...advisorTemplates,
    ...customerSuccessTemplates,
    ...intakeTemplates,
];

export const DEFAULT_TEMPLATES_BY_AGENT: Record<AgentType, DefaultTemplate[]> = {
    receptionist: receptionistTemplates,
    proactive_setter: setterTemplates,
    informative_advisor: advisorTemplates,
    customer_success: customerSuccessTemplates,
    intake_coordinator: intakeTemplates,
};

/**
 * Get all default templates for a specific agent type
 */
export function getDefaultTemplatesForAgent(agentType: AgentType): DefaultTemplate[] {
    return DEFAULT_TEMPLATES_BY_AGENT[agentType] || [];
}

/**
 * Get the opening template (apertura) for an agent type
 */
export function getOpeningTemplateForAgent(agentType: AgentType): DefaultTemplate | undefined {
    const templates = getDefaultTemplatesForAgent(agentType);
    return templates.find(t => t.useCase === "apertura");
}

/**
 * Get follow-up templates (ripresa) for an agent type
 */
export function getFollowUpTemplatesForAgent(agentType: AgentType): DefaultTemplate[] {
    const templates = getDefaultTemplatesForAgent(agentType);
    return templates.filter(t => t.useCase.startsWith("ripresa_"));
}

/**
 * Get the closing template (chiusura) for an agent type
 */
export function getClosingTemplateForAgent(agentType: AgentType): DefaultTemplate | undefined {
    const templates = getDefaultTemplatesForAgent(agentType);
    return templates.find(t => t.useCase === "chiusura");
}

/**
 * Get template by specific use case for an agent type
 */
export function getTemplateByUseCase(agentType: AgentType, useCase: TemplateUseCase): DefaultTemplate | undefined {
    const templates = getDefaultTemplatesForAgent(agentType);
    return templates.find(t => t.useCase === useCase);
}
