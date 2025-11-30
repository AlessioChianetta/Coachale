// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 🎭 ARCHETYPE PLAYBOOKS - Feedback SOLO sul TONO per archetipo
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Ogni playbook contiene:
// 1. filler: Risposta immediata (0ms) mentre il Manager pensa
// 2. ttsParams: Parametri per Text-To-Speech (velocità, stabilità)
// 3. instruction: Feedback SOLO sul TONO (energia, voce, ritmo, stile)
//    ⚠️ MAI istruzioni su cosa fare o dove andare nello script!
// 4. techniques: Tecniche di vendita (per reference)
// 5. avoid: Cosa NON fare con questo archetipo
// 
// 🚨 REGOLA CRITICA: Le instruction contengono SOLO indicazioni su
// come COMUNICARE (tono, energia, velocità), MAI su cosa CHIEDERE
// o quando AVANZARE nello script. L'avanzamento è controllato
// separatamente dal step-advancement-agent.
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
  instruction: string;  // 🆕 Ora contiene SOLO feedback sul tono, MAI istruzioni script
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
    instruction: `🎭 TONO: Scettico
🎤 Energia: MEDIA | Ritmo: LENTO
🗣️ Voce: Calmo, sicuro, leggermente distaccato
🪞 Stile: Professionale e non difensivo. Pause più lunghe. Non riempire i silenzi.`,
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
    instruction: `🎭 TONO: Frettoloso
🎤 Energia: ALTA | Ritmo: VELOCE
🗣️ Voce: Diretto, conciso, rispettoso del tempo
🪞 Stile: Risposte brevi e incisive. Zero convenevoli. Vai al punto.`,
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
    instruction: `🎭 TONO: Focus Prezzo
🎤 Energia: MEDIA | Ritmo: MODERATO
🗣️ Voce: Calmo, razionale, non emotivo
🪞 Stile: Parla di numeri e valore. Tono business-like.`,
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
    instruction: `🎭 TONO: Tecnico
🎤 Energia: MEDIA | Ritmo: MODERATO
🗣️ Voce: Professionale, preciso, metodico
🪞 Stile: Usa terminologia appropriata. Sii strutturato e logico.`,
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
    instruction: `🎭 TONO: Entusiasta
🎤 Energia: ALTA | Ritmo: VELOCE
🗣️ Voce: Energico, vivace, entusiasta
🪞 Stile: Match l'energia positiva. Voce alta, ritmo veloce.`,
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
    instruction: `🎭 TONO: Indeciso
🎤 Energia: BASSA | Ritmo: LENTO
🗣️ Voce: Rassicurante, calmo, paziente
🪞 Stile: Dai tempo. Non riempire i silenzi. Sii paziente.`,
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
    instruction: `🎭 TONO: Difensivo
🎤 Energia: BASSA | Ritmo: LENTO
🗣️ Voce: Molto calmo, basso, rassicurante
🪞 Stile: Movimenti lenti. Zero aggressività. Rispetta i suoi confini.`,
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
    instruction: `🎭 TONO: Analitico
🎤 Energia: MEDIA | Ritmo: MODERATO
🗣️ Voce: Razionale, calmo, strutturato
🪞 Stile: Presenta informazioni in modo logico e ordinato.`,
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
    instruction: `🎭 TONO: Decision Maker
🎤 Energia: ALTA | Ritmo: MODERATO
🗣️ Voce: Sicuro, autorevole, diretto
🪞 Stile: Parla da pari a pari. Sii conciso e rispetta il suo ruolo.`,
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
    instruction: `🎭 TONO: Neutro
🎤 Energia: MEDIA | Ritmo: MODERATO
🗣️ Voce: Equilibrato, professionale, adattabile
🪞 Stile: Tono standard. Osserva e adattati man mano.`,
    techniques: ['Active Listening', 'Open Questions', 'Observation'],
    avoid: ['Assumere un archetipo senza segnali', 'Essere robotico'],
    mirroringTips: 'Tono equilibrato, professionale. Adattati man mano che capisci meglio.'
  }
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 🆕 TONE-ONLY INSTRUCTIONS (Nessuna istruzione script!)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Questi template contengono SOLO indicazioni su:
// - Tono vocale
// - Energia
// - Stile comunicativo
// MAI istruzioni su cosa chiedere o dove andare nello script!
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export interface ToneOnlyInstruction {
  archetype: ArchetypeId;
  emoji: string;
  name: string;
  voiceEnergy: 'BASSA' | 'MEDIA' | 'ALTA';
  voicePace: 'LENTO' | 'MODERATO' | 'VELOCE';
  voiceTone: string;
  communicationStyle: string;
  emotionalCue: string;
}

export const TONE_ONLY_INSTRUCTIONS: Record<ArchetypeId, ToneOnlyInstruction> = {
  skeptic: {
    archetype: 'skeptic',
    emoji: '🤨',
    name: 'Scettico',
    voiceEnergy: 'MEDIA',
    voicePace: 'LENTO',
    voiceTone: 'Calmo, sicuro, leggermente distaccato',
    communicationStyle: 'Professionale e non difensivo. Pause più lunghe. Non riempire i silenzi.',
    emotionalCue: 'Trasmetti sicurezza tranquilla, non cercare approvazione'
  },
  
  enthusiast: {
    archetype: 'enthusiast',
    emoji: '😊',
    name: 'Entusiasta',
    voiceEnergy: 'ALTA',
    voicePace: 'VELOCE',
    voiceTone: 'Energico, vivace, entusiasta',
    communicationStyle: 'Match l\'energia positiva. Voce alta, ritmo veloce.',
    emotionalCue: 'Trasmetti entusiasmo genuino, condividi la positività'
  },
  
  busy: {
    archetype: 'busy',
    emoji: '⏰',
    name: 'Frettoloso',
    voiceEnergy: 'ALTA',
    voicePace: 'VELOCE',
    voiceTone: 'Diretto, conciso, rispettoso del tempo',
    communicationStyle: 'Risposte brevi e incisive. Zero convenevoli. Vai al punto.',
    emotionalCue: 'Trasmetti efficienza e rispetto per il suo tempo'
  },
  
  price_focused: {
    archetype: 'price_focused',
    emoji: '💰',
    name: 'Focus Prezzo',
    voiceEnergy: 'MEDIA',
    voicePace: 'MODERATO',
    voiceTone: 'Calmo, razionale, non emotivo',
    communicationStyle: 'Parla di numeri e valore. Tono business-like.',
    emotionalCue: 'Trasmetti competenza e comprensione delle sue priorità economiche'
  },
  
  technical: {
    archetype: 'technical',
    emoji: '🔧',
    name: 'Tecnico',
    voiceEnergy: 'MEDIA',
    voicePace: 'MODERATO',
    voiceTone: 'Professionale, preciso, metodico',
    communicationStyle: 'Usa terminologia appropriata. Sii strutturato e logico.',
    emotionalCue: 'Trasmetti competenza tecnica e precisione'
  },
  
  indecisive: {
    archetype: 'indecisive',
    emoji: '🤔',
    name: 'Indeciso',
    voiceEnergy: 'BASSA',
    voicePace: 'LENTO',
    voiceTone: 'Rassicurante, calmo, paziente',
    communicationStyle: 'Dai tempo. Non riempire i silenzi. Sii paziente.',
    emotionalCue: 'Trasmetti tranquillità e assenza di pressione'
  },
  
  defensive: {
    archetype: 'defensive',
    emoji: '🛡️',
    name: 'Difensivo',
    voiceEnergy: 'BASSA',
    voicePace: 'LENTO',
    voiceTone: 'Molto calmo, basso, rassicurante',
    communicationStyle: 'Movimenti lenti. Zero aggressività. Rispetta i suoi confini.',
    emotionalCue: 'Trasmetti sicurezza e rispetto, non minaccia'
  },
  
  analytical: {
    archetype: 'analytical',
    emoji: '📊',
    name: 'Analitico',
    voiceEnergy: 'MEDIA',
    voicePace: 'MODERATO',
    voiceTone: 'Razionale, calmo, strutturato',
    communicationStyle: 'Presenta informazioni in modo logico e ordinato.',
    emotionalCue: 'Trasmetti competenza e approccio basato sui fatti'
  },
  
  decision_maker: {
    archetype: 'decision_maker',
    emoji: '🎯',
    name: 'Decision Maker',
    voiceEnergy: 'ALTA',
    voicePace: 'MODERATO',
    voiceTone: 'Sicuro, autorevole, diretto',
    communicationStyle: 'Parla da pari a pari. Sii conciso e rispetta il suo ruolo.',
    emotionalCue: 'Trasmetti autorevolezza e visione strategica'
  },
  
  neutral: {
    archetype: 'neutral',
    emoji: '😐',
    name: 'Neutro',
    voiceEnergy: 'MEDIA',
    voicePace: 'MODERATO',
    voiceTone: 'Equilibrato, professionale, adattabile',
    communicationStyle: 'Tono standard. Osserva e adattati man mano.',
    emotionalCue: 'Trasmetti professionalità e apertura'
  }
};

export function getToneOnlyFeedback(archetype: ArchetypeId): string {
  const tone = TONE_ONLY_INSTRUCTIONS[archetype];
  return `🎭 TONO: ${tone.name}
🎤 Energia: ${tone.voiceEnergy} | Ritmo: ${tone.voicePace}
🗣️ Voce: ${tone.voiceTone}
🪞 Stile: ${tone.communicationStyle}`;
}

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
