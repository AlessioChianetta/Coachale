// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 🎭 ARCHETYPE PLAYBOOKS - Strategie di vendita per archetipo
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Ogni playbook contiene:
// 1. filler: Risposta immediata (0ms) mentre il Manager pensa
// 2. ttsParams: Parametri per Text-To-Speech (velocità, stabilità)
// 3. instruction: Template istruzione per l'Agent
// 4. techniques: Tecniche di vendita da usare
// 5. avoid: Cosa NON fare con questo archetipo
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export type ArchetypeId = 
  | 'skeptic' 
  | 'enthusiast' 
  | 'indecisive' 
  | 'busy' 
  | 'price_focused' 
  | 'technical' 
  | 'defensive'
  | 'analytical'
  | 'decision_maker'
  | 'neutral';

export interface TTSParams {
  speed: number;      // 0.8 - 1.3 (1.0 = normale)
  stability: number;  // 0.3 - 0.8 (più basso = più variazione/emozione)
}

export interface ArchetypePlaybook {
  id: ArchetypeId;
  emoji: string;
  name: string;
  fillers: string[];
  ttsParams: TTSParams;
  instruction: string;
  techniques: string[];
  avoid: string[];
  mirroringTips: string;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ARCHETYPE DETECTION PATTERNS (Fast Reflexes - Regex)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export interface ArchetypePattern {
  archetype: ArchetypeId;
  patterns: RegExp[];
  weight: number;  // Peso per pattern match (0.2 - 0.4)
  negationPatterns?: RegExp[];  // Pattern che NEGANO questo archetipo
}

export const ARCHETYPE_PATTERNS: ArchetypePattern[] = [
  {
    archetype: 'skeptic',
    weight: 0.35,
    patterns: [
      /ho già provato|già visto|non ha funzionato/i,
      /come faccio a fidarmi|perché dovrei crederti|perché dovrei fidarmi/i,
      /prove|dimostrami|referenze|case study/i,
      /tutti dicono la stessa cosa|solita storia|sempre la stessa/i,
      /non mi convince|scettico|dubbioso|difficile crederci/i,
      /sì,?\s*certo|come no|figuriamoci/i,  // sarcasmo
      /e chi mi garantisce|chi garantisce/i,
    ],
    negationPatterns: [
      /mi hai convinto|sono convinto|mi fido/i,
    ]
  },
  {
    archetype: 'busy',
    weight: 0.35,
    patterns: [
      /non ho tempo|sono di fretta|velocemente|sbrigati/i,
      /vai al punto|in breve|senza giri di parole|al sodo/i,
      /ho solo \d+ minuti|devo andare|tra poco ho/i,
      /riassumendo|in sintesi|in due parole/i,
      /sì sì,?\s*vai avanti|ok ok,?\s*dimmi/i,
    ]
  },
  {
    archetype: 'price_focused',
    weight: 0.4,
    patterns: [
      /quanto costa|qual è il prezzo|che cifra|che prezzo/i,
      /troppo caro|non ho budget|fuori budget|costoso/i,
      /sconto|offerta|promozione|prezzo speciale/i,
      /la concorrenza costa meno|altri chiedono meno|più economico/i,
      /non posso permettermi|non me lo posso permettere/i,
    ],
    negationPatterns: [
      /il prezzo non (è un |mi |)problem|non (mi |)interessa il prezzo|i soldi non sono un problema/i,
      /non è una questione di prezzo|non parlo di prezzo/i,
    ]
  },
  {
    archetype: 'technical',
    weight: 0.35,
    patterns: [
      /come funziona tecnicamente|nel dettaglio|specifiche tecniche/i,
      /API|integrazione|stack|framework|metodologia|architettura/i,
      /KPI|metriche|dati|statistiche|benchmark/i,
      /processo|workflow|step operativi|procedura/i,
      /sicurezza|uptime|scalabilità|performance/i,
    ]
  },
  {
    archetype: 'enthusiast',
    weight: 0.3,
    patterns: [
      /fantastico|interessante|wow|incredibile|super/i,
      /dimmi di più|voglio sapere|sono curioso|raccontami/i,
      /mi piace|mi interessa molto|sembra perfetto|adoro/i,
      /non vedo l'ora|quando possiamo iniziare/i,
    ]
  },
  {
    archetype: 'indecisive',
    weight: 0.3,
    patterns: [
      /devo pensarci|non sono sicuro|forse|magari/i,
      /devo parlare con|chiedere a|consultare|sentire/i,
      /e se poi|ma cosa succede se|non so se/i,
      /non so se è il momento giusto|più avanti|non ora/i,
      /fammi pensare|ci devo riflettere/i,
    ]
  },
  {
    archetype: 'defensive',
    weight: 0.35,
    patterns: [
      /non voglio essere pressato|non mi pressare|niente pressioni/i,
      /ultimo fornitore mi ha fregato|brutte esperienze|scottato/i,
      /non firmo nulla oggi|non compro nulla oggi/i,
      /perché dovrei fidarmi di voi|state cercando di vendermi/i,
      /garanzie|clausola di uscita|rimborso/i,
    ]
  },
  {
    archetype: 'analytical',
    weight: 0.3,
    patterns: [
      /dati che supportano|statistiche|numeri reali/i,
      /case study dettagliati|metriche misurabili/i,
      /ricerche|studi|evidenze|prove scientifiche/i,
      /analisi|valutazione oggettiva|criteri/i,
    ]
  },
  {
    archetype: 'decision_maker',
    weight: 0.25,
    patterns: [
      /sono io che decido|decido io|è una mia decisione/i,
      /vantaggio competitivo|strategia|quadro generale/i,
      /perché scegliere voi|cosa vi differenzia/i,
      /sono l'amministratore|sono il CEO|sono il titolare/i,
    ]
  }
];

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ARCHETYPE PLAYBOOKS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const ARCHETYPE_PLAYBOOKS: Record<ArchetypeId, ArchetypePlaybook> = {
  skeptic: {
    id: 'skeptic',
    emoji: '🤨',
    name: 'Scettico',
    fillers: ['Mmh, capisco...', 'Interessante punto...', 'Capisco la tua posizione...'],
    ttsParams: { speed: 0.95, stability: 0.7 },
    instruction: `[SKEPTIC] Tono DISTACCATO e professionale. NON fare l'amicone. NON difendere il prodotto.
Usa NEGATIVE REVERSE SELLING: "Sembra che tu abbia già provato soluzioni che non hanno funzionato. Cosa esattamente ti ha deluso?"
Se insiste con scetticismo: "Forse hai ragione, forse non fa per te. Ma lasciami capire: cosa dovrebbe avere una soluzione per convincerti?"
NON cercare di convincerlo - lascia che si convinca da solo.`,
    techniques: ['Negative Reverse Selling', 'Frame Control', 'Pattern Interrupt'],
    avoid: ['Essere troppo entusiasta', 'Difendere il prodotto', 'Fare promesse', 'Essere insistente'],
    mirroringTips: 'Tono calmo, sicuro, leggermente distaccato. Pause più lunghe. Non riempire i silenzi.'
  },

  busy: {
    id: 'busy',
    emoji: '⏰',
    name: 'Frettoloso',
    fillers: ['Ok!', 'Sì!', 'Allora...', 'Subito!'],
    ttsParams: { speed: 1.3, stability: 0.5 },
    instruction: `[BUSY] Vai DRITTO al punto. ZERO convenevoli. Risposte BREVI.
BLUF (Bottom Line Up Front): "In 30 secondi: aiutiamo [X] a ottenere [Y]. Due domande veloci e ti dico se fa per te."
Se interrompe: "Perfetto, vado al sodo: [punto chiave]"
MAX 2-3 frasi per risposta.`,
    techniques: ['BLUF', 'Rispetto del tempo', 'Sintesi estrema'],
    avoid: ['Divagare', 'Storie lunghe', 'Dettagli non richiesti', 'Ripetizioni'],
    mirroringTips: 'Parla veloce, tono energico, frasi corte. Vai al punto immediatamente.'
  },

  price_focused: {
    id: 'price_focused',
    emoji: '💰',
    name: 'Focus Prezzo',
    fillers: ['Capisco...', 'Certo...', 'Giusto...'],
    ttsParams: { speed: 1.0, stability: 0.6 },
    instruction: `[PRICE] NON difendere il prezzo. NON giustificare. Fai REFRAME sul costo dell'inazione.
"Prima di parlare di numeri: quanto ti sta costando NON risolvere questo problema ogni mese?"
"Capisco che il budget sia importante. Aiutami a capire: se avessi la soluzione perfetta, quale valore economico avrebbe per te?"
Mai dire "è un investimento" o "costa poco" - lascia che calcoli lui il valore.`,
    techniques: ['Cost of Inaction', 'Value Reframe', 'ROI Discussion'],
    avoid: ['Difendere il prezzo', 'Offrire sconti subito', 'Dire "è economico"', 'Giustificarsi'],
    mirroringTips: 'Tono calmo e razionale. Non emotivo. Parla di numeri e valore.'
  },

  technical: {
    id: 'technical',
    emoji: '🔧',
    name: 'Tecnico',
    fillers: ['Ottima domanda...', 'Buon punto tecnico...', 'Interessante...'],
    ttsParams: { speed: 1.0, stability: 0.7 },
    instruction: `[TECHNICAL] Usa gergo tecnico appropriato. NIENTE marketing fluff.
Parla di dati, metriche, processi: "Il nostro metodo si basa su [framework/metodologia]. In pratica: step 1 [X], step 2 [Y], risultato [Z]."
Se non sai un dettaglio tecnico: "Ottima domanda, su quello specifico ti faccio avere la documentazione tecnica."
Sii preciso e specifico.`,
    techniques: ['Technical Depth', 'Process Clarity', 'Data-driven Arguments'],
    avoid: ['Marketing speak', 'Promesse vaghe', 'Generalizzazioni', 'Evitare domande tecniche'],
    mirroringTips: 'Tono professionale, preciso. Usa terminologia tecnica. Sii metodico.'
  },

  enthusiast: {
    id: 'enthusiast',
    emoji: '😊',
    name: 'Entusiasta',
    fillers: ['Fantastico!', 'Evvai!', 'Super interessante!', 'Bellissimo!'],
    ttsParams: { speed: 1.2, stability: 0.4 },
    instruction: `[ENTHUSIAST] Cavalca l'entusiasmo ma GUIDA verso il closing.
"Fantastico che ti piaccia! Cosa ti ha colpito di più?"
NON perdere tempo - l'entusiasmo può svanire. Porta verso la decisione:
"Vedo che ci siamo capiti! Allora facciamo così: [prossimo step concreto]"`,
    techniques: ['Momentum Building', 'Assumptive Close', 'Enthusiasm Matching'],
    avoid: ['Raffreddare l\'entusiasmo', 'Troppi dettagli', 'Rallentare', 'Dubbi non richiesti'],
    mirroringTips: 'Tono energico, vivace! Voce alta, ritmo veloce. Match l\'energia positiva.'
  },

  indecisive: {
    id: 'indecisive',
    emoji: '🤔',
    name: 'Indeciso',
    fillers: ['Sì, capisco...', 'È normale avere dubbi...', 'Comprendo...'],
    ttsParams: { speed: 0.95, stability: 0.65 },
    instruction: `[INDECISIVE] NON spingerlo a decidere - aumenteresti la paralisi.
Riduci le opzioni: "Semplifico: hai due strade. A oppure B. Quale senti più tua?"
Dai sicurezza: "Molti clienti avevano gli stessi dubbi. Poi hanno scoperto che [risultato]."
Togli pressione: "Non devi decidere oggi. Ma dimmi: cosa ti aiuterebbe a sentirti più sicuro?"`,
    techniques: ['Choice Reduction', 'Social Proof', 'Fear Removal'],
    avoid: ['Pressare', 'Troppe opzioni', 'Urgenza artificiale', 'Forzare decisioni'],
    mirroringTips: 'Tono rassicurante, calmo, paziente. Dai tempo. Non riempire i silenzi.'
  },

  defensive: {
    id: 'defensive',
    emoji: '🛡️',
    name: 'Difensivo',
    fillers: ['Capisco perfettamente...', 'Hai ragione a essere cauto...', 'Comprendo...'],
    ttsParams: { speed: 0.9, stability: 0.7 },
    instruction: `[DEFENSIVE] Prima VALIDA le sue paure, poi costruisci fiducia lentamente.
"Hai assolutamente ragione a essere cauto. Anch'io al tuo posto lo sarei dopo un'esperienza del genere."
NON vendere - informa: "Non ti chiedo di fidarti. Ti chiedo solo di valutare i fatti."
Offri controllo: "Sei tu che decidi. Nessuna pressione. Cosa vorresti sapere per sentirti più tranquillo?"`,
    techniques: ['Fear Validation', 'Control Giving', 'Transparency'],
    avoid: ['Minimizzare paure', 'Essere aggressivo', 'Promesse eccessive', 'Pressione'],
    mirroringTips: 'Tono molto calmo, basso, rassicurante. Movimenti lenti. Zero aggressività.'
  },

  analytical: {
    id: 'analytical',
    emoji: '📊',
    name: 'Analitico',
    fillers: ['Ottima osservazione...', 'Buon punto...', 'Interessante analisi...'],
    ttsParams: { speed: 1.0, stability: 0.7 },
    instruction: `[ANALYTICAL] Porta DATI, non opinioni. Numeri reali, case study con metriche.
"Ti porto i dati: cliente X, situazione simile alla tua, risultato Y in Z mesi. Ecco le metriche..."
Se non hai dati precisi: "Non ho il numero esatto qui, ma posso farti avere il report dettagliato."
Sii metodico e strutturato nella presentazione.`,
    techniques: ['Data Presentation', 'Logical Flow', 'Evidence-based Arguments'],
    avoid: ['Opinioni non supportate', 'Entusiasmo eccessivo', 'Promesse senza dati', 'Fretta'],
    mirroringTips: 'Tono razionale, calmo. Presenta informazioni in modo strutturato e logico.'
  },

  decision_maker: {
    id: 'decision_maker',
    emoji: '🎯',
    name: 'Decision Maker',
    fillers: ['Assolutamente...', 'Certamente...', 'Perfetto...'],
    ttsParams: { speed: 1.1, stability: 0.55 },
    instruction: `[DECISION_MAKER] Parla di VALORE STRATEGICO, non di feature.
"A livello strategico, questo impatta [area business] perché [motivo]."
Sii diretto e rispetta il suo tempo. Porta il quadro generale, non i dettagli operativi.
"I tuoi competitor stanno già [X]. La domanda è: vuoi essere leader o follower?"`,
    techniques: ['Strategic Framing', 'Competitive Positioning', 'Big Picture'],
    avoid: ['Dettagli operativi', 'Tecnicismi', 'Perdere tempo', 'Essere indeciso'],
    mirroringTips: 'Tono sicuro, autorevole. Parla da pari a pari. Sii conciso e diretto.'
  },

  neutral: {
    id: 'neutral',
    emoji: '😐',
    name: 'Neutro',
    fillers: ['Sì...', 'Capisco...', 'Ok...'],
    ttsParams: { speed: 1.05, stability: 0.55 },
    instruction: `[NEUTRAL] Segui lo script normale. Cerca di capire meglio chi hai davanti.
Fai domande aperte per far emergere la personalità: "Cosa ti ha portato a questa chiamata oggi?"
Osserva le reazioni per identificare l'archetipo reale.`,
    techniques: ['Active Listening', 'Open Questions', 'Observation'],
    avoid: ['Assumere un archetipo senza segnali', 'Essere robotico'],
    mirroringTips: 'Tono equilibrato, professionale. Adattati man mano che capisci meglio.'
  }
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ANTI-PATTERN DEFINITIONS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export interface AntiPatternDefinition {
  id: string;
  name: string;
  priority: 'critical' | 'high' | 'medium';
  prospectTriggers: RegExp[];  // Pattern nel messaggio del prospect
  instruction: string;
}

export const ANTI_PATTERNS: AntiPatternDefinition[] = [
  {
    id: 'repeated_question',
    name: 'Domanda Ripetuta',
    priority: 'critical',
    prospectTriggers: [
      /te l'ho già detto|già risposto|stessa domanda|già spiegato/i,
      /stiamo girando in tondo|ripetendo|già detto prima/i,
      /continui a chiedere|perché lo chiedi ancora/i,
    ],
    instruction: `🚨 STOP! Stai ripetendo la stessa domanda. Il prospect è frustrato.
Dì: "Hai ragione, scusa se mi sono ripetuto. Lasciami riformulare..." 
Poi fai una domanda COMPLETAMENTE DIVERSA o avanza nello script.`
  },
  {
    id: 'ignored_request',
    name: 'Richiesta Ignorata',
    priority: 'critical',
    prospectTriggers: [
      /non hai risposto|non mi hai detto|ignori la mia domanda/i,
      /sto chiedendo|ti ho chiesto|la mia domanda era/i,
      /rispondimi|puoi rispondere|mi ascolti/i,
    ],
    instruction: `🚨 HAI IGNORATO LA DOMANDA DEL PROSPECT! Fermati.
PRIMA rispondi alla sua domanda (anche brevemente).
POI puoi fare la tua domanda. Mai ignorare richieste dirette.`
  },
  {
    id: 'excessive_validation',
    name: 'Validazione Eccessiva',
    priority: 'high',
    prospectTriggers: [
      /capire non risolve|basta capire|azioni non parole/i,
      /cosa mi proponi|soluzione concreta|passiamo ai fatti/i,
      /meno parole più fatti/i,
    ],
    instruction: `🚨 BASTA VALIDAZIONE! Il prospect vuole azioni, non empatia.
Smetti di dire "capisco". Passa a:
"Ok, lascia che ti faccia una proposta concreta..." e proponi il prossimo step.`
  },
  {
    id: 'losing_prospect',
    name: 'Prospect in Fuga',
    priority: 'high',
    prospectTriggers: [
      /devo andare|chiudiamo qui|non ho più tempo/i,
      /ci sentiamo dopo|ti richiamo|fatti risentire/i,
      /ok basta|è sufficiente|ho capito/i,
    ],
    instruction: `⚠️ ATTENZIONE: Il prospect sta cercando di chiudere.
NON insistere. Fai UN ULTIMO tentativo breve:
"Prima di salutarti, una cosa veloce: [benefit principale]. Ti lascio il mio contatto?"
Se resiste → chiudi cordialmente senza insistere.`
  },
  
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 🆕 NUOVI ANTI-PATTERN ROBUSTI
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  
  {
    id: 'prospect_frustration',
    name: 'Frustrazione del Prospect',
    priority: 'critical',
    prospectTriggers: [
      /ma insomma|ancora\?|di nuovo\?|un'altra volta/i,
      /mi stai stressando|mi stai stancando|mi hai stancato/i,
      /basta così|non ne posso più|sono stufo|sono stanco/i,
      /che palle|che noia|ma dai|ma come|ma che/i,
      /irritato|arrabbiato|frustrato|infastidito/i,
      /non mi capisci|non capisco cosa vuoi|cosa vuoi da me/i,
    ],
    instruction: `🚨 ALERT: IL PROSPECT È FRUSTRATO! Fermati immediatamente.
1. RICONOSCI la frustrazione: "Sento che ti sto facendo perdere la pazienza, e me ne scuso."
2. FAI UN PASSO INDIETRO: "Lasciami capire meglio cosa ti serve veramente."
3. NON difenderti, NON giustificarti, NON continuare con lo script.
Obiettivo: Ricostruire il rapport prima di procedere.`
  },
  {
    id: 'repeated_objection',
    name: 'Obiezione Ripetuta',
    priority: 'critical',
    prospectTriggers: [
      /te l'ho già detto che|come ti ho detto prima|ribadisco che/i,
      /per l'ennesima volta|ti ripeto|te lo ripeto/i,
      /continuo a dirti|non cambia nulla|sempre la stessa cosa/i,
      /ho già detto che non|l'ho già detto/i,
    ],
    instruction: `🚨 OBIEZIONE RIPETUTA! Il prospect ti ha già detto questa cosa.
NON rispondere con la stessa risposta di prima!
Dì: "Hai ragione, mi hai già detto questo. Evidentemente la mia risposta non ti ha convinto. Cosa ti servirebbe per sentirti più tranquillo su questo punto?"
Obiettivo: Scoprire la VERA obiezione nascosta sotto quella di superficie.`
  },
  {
    id: 'conversation_derailing',
    name: 'Conversazione Deraglia',
    priority: 'high',
    prospectTriggers: [
      /ma questo cosa c'entra|non c'entra nulla|stiamo andando fuori tema/i,
      /torniamo al punto|ma di cosa stavamo parlando|persi/i,
      /non ho capito dove vuoi arrivare|il nesso|la connessione/i,
      /mi sono perso|dove eravamo|confuso/i,
    ],
    instruction: `⚠️ LA CONVERSAZIONE STA DERAGLIANDO! Riporta focus.
Dì: "Hai ragione, lasciami riportare tutto al punto centrale."
POI in UNA frase: ricorda l'obiettivo della chiamata.
"Stavamo parlando di [obiettivo]. Tornando a quello, [domanda diretta]."
NON divagare ulteriormente!`
  },
  {
    id: 'excessive_pressure',
    name: 'Pressione Eccessiva',
    priority: 'critical',
    prospectTriggers: [
      /mi stai pressando|non mi pressare|basta pressione/i,
      /non insistere|smettila di insistere|sei troppo insistente/i,
      /mi sento sotto pressione|mi sento forzato|mi stai forzando/i,
      /non voglio essere costretto|non mi piace essere pressato/i,
      /rallenta|calmati|prendila con calma/i,
    ],
    instruction: `🚨 STAI PRESSANDO TROPPO! Fai un passo indietro SUBITO.
1. SCUSATI: "Hai ragione, non voglio metterti fretta. Mi sono fatto prendere dall'entusiasmo."
2. DAI CONTROLLO: "Decidi tu i tempi. Non c'è nessuna pressione da parte mia."
3. ASPETTA: Lascia che sia lui a ripartire. Non riempire il silenzio.
Obiettivo: Rimuovere la pressione, lasciare che respiri.`
  },
  {
    id: 'trust_broken',
    name: 'Fiducia Compromessa',
    priority: 'critical',
    prospectTriggers: [
      /non mi fido|non ti credo|mi stai mentendo/i,
      /questa è una fregatura|mi stai fregando|truffa/i,
      /stai cercando solo di vendermi|pensi solo ai soldi/i,
      /sei come tutti gli altri|tutti uguali voi venditori/i,
      /non sei onesto|non sei sincero|non sei trasparente/i,
    ],
    instruction: `🚨 ALLARME: LA FIDUCIA È COMPROMESSA!
NON difenderti. NON giustificarti. NON contraddire.
1. VALIDA: "Capisco il tuo scetticismo. Hai tutto il diritto di essere diffidente."
2. TRASPARENZA: "Non ti chiedo di fidarti. Ti chiedo solo di valutare i fatti."
3. CONTROLLO: "Se in qualsiasi momento senti che non fa per te, dimmelo. Nessun problema."
Obiettivo: Ricostruire credibilità senza sembrare disperato.`
  }
];

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// UTILITY FUNCTIONS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export function getPlaybookById(id: ArchetypeId): ArchetypePlaybook {
  return ARCHETYPE_PLAYBOOKS[id] || ARCHETYPE_PLAYBOOKS.neutral;
}

export function getRandomFiller(archetype: ArchetypeId): string {
  const playbook = getPlaybookById(archetype);
  const fillers = playbook.fillers;
  return fillers[Math.floor(Math.random() * fillers.length)];
}

export function formatArchetypeTag(archetype: ArchetypeId): string {
  const playbook = getPlaybookById(archetype);
  return `${playbook.emoji} ${playbook.name.toUpperCase()}`;
}
