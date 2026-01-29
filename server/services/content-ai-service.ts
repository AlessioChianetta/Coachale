import { getAIProvider, getModelWithThinking, GEMINI_3_MODEL } from "../ai/provider-factory";
import { db } from "../db";
import { brandAssets, contentIdeas, contentPosts, contentTopics } from "@shared/schema";
import { eq, desc, and, inArray } from "drizzle-orm";

export type ContentType = "post" | "carosello" | "reel" | "video" | "story" | "articolo";
export type ContentObjective = "awareness" | "engagement" | "leads" | "sales" | "education";
export type Platform = "instagram" | "facebook" | "linkedin" | "tiktok" | "youtube" | "twitter";
export type ImageStyle = "realistic" | "illustration" | "minimal" | "bold" | "professional" | "playful";

export type AwarenessLevel = "unaware" | "problem_aware" | "solution_aware" | "product_aware" | "most_aware";
export type SophisticationLevel = "level_1" | "level_2" | "level_3" | "level_4" | "level_5";

export interface GenerateIdeasParams {
  consultantId: string;
  niche: string;
  targetAudience: string;
  objective: ContentObjective | "authority";
  additionalContext?: string;
  count?: number;
  mediaType?: "video" | "photo";
  copyType?: "short" | "long";
  awarenessLevel?: AwarenessLevel;
  sophisticationLevel?: SophisticationLevel;
  targetPlatform?: "instagram" | "x" | "linkedin";
  postCategory?: "ads" | "valore" | "formazione" | "altri";
  postSchema?: string;
  schemaStructure?: string;
  schemaLabel?: string;
  charLimit?: number;
  writingStyle?: string;
  customWritingInstructions?: string;
  topicId?: string;
  brandVoiceData?: {
    consultantDisplayName?: string;
    businessName?: string;
    businessDescription?: string;
    consultantBio?: string;
    vision?: string;
    mission?: string;
    values?: string[];
    usp?: string;
    whoWeHelp?: string;
    whatWeDo?: string;
    howWeDoIt?: string;
    yearsExperience?: number;
    clientsHelped?: number;
    resultsGenerated?: string;
    caseStudies?: { client: string; result: string }[];
    servicesOffered?: { name: string; price: string; description: string }[];
    guarantees?: string;
  };
  kbContent?: string;
}

export interface StructuredCopyShort {
  type: "copy_short";
  hook: string;
  body: string;
  cta: string;
  captionCopy?: string; // AI-generated complete copy
  hashtags?: string[];
  imageDescription?: string;
  imageOverlayText?: string;
}

export interface StructuredCopyLong {
  type: "copy_long";
  hook: string;
  chiCosaCome: string;
  errore: string;
  soluzione: string;
  riprovaSociale: string;
  cta: string;
  captionCopy?: string; // AI-generated complete copy
  hashtags?: string[];
  imageDescription?: string;
  imageOverlayText?: string;
}

export interface StructuredVideoScript {
  type: "video_script";
  hook: string;
  problema: string;
  soluzione: string;
  cta: string;
  fullScript: string;
  hashtags?: string[];
}

export interface StructuredImageCopy {
  type: "image_copy";
  imageText: string;
  subtitle: string;
  conceptDescription: string;
  hashtags?: string[];
}

export type StructuredContent = StructuredCopyShort | StructuredCopyLong | StructuredVideoScript | StructuredImageCopy;

const SECTION_GUIDELINES: Record<string, { instruction: string; style: "narrative" | "concise" | "list" }> = {
  "hook": {
    instruction: "Cattura l'attenzione nei primi 3 secondi. Usa domanda provocatoria, statistica sorprendente, o affermazione controintuitiva. Deve fermare lo scroll.",
    style: "concise"
  },
  "hot_take": {
    instruction: "Afferma qualcosa che va contro il pensiero comune. Deve far pensare 'Non sono d'accordo!' o 'Finalmente qualcuno lo dice!'",
    style: "concise"
  },
  "opinione": {
    instruction: "Esprimi un punto di vista deciso e potenzialmente controverso. Prendi posizione netta.",
    style: "concise"
  },
  "mito": {
    instruction: "Presenta una credenza comune nel settore che in realtà è falsa o limitante.",
    style: "concise"
  },
  "pain": {
    instruction: "Descrivi il problema specifico che il target vive quotidianamente. Usa dettagli concreti, emozioni negative (frustrazione, ansia, stress). Il lettore deve pensare 'Parla proprio di me!'",
    style: "narrative"
  },
  "problema": {
    instruction: "Esponi il problema centrale con esempi reali e conseguenze tangibili. Mostra empatia.",
    style: "narrative"
  },
  "errore": {
    instruction: "Mostra l'errore comune che il target commette senza saperlo. Usa 'Molti pensano che... ma in realtà...'",
    style: "narrative"
  },
  "costo": {
    instruction: "Quantifica il costo del problema: tempo perso, soldi bruciati, opportunità mancate.",
    style: "narrative"
  },
  "agitazione": {
    instruction: "Amplifica il dolore: cosa perdono se non agiscono? Cosa rischiano? Cosa lasciano sul tavolo?",
    style: "narrative"
  },
  "obiezione": {
    instruction: "Presenta l'obiezione più comune del target, formulata esattamente come la penserebbe lui.",
    style: "narrative"
  },
  "cosa_odiavo": {
    instruction: "Racconta cosa ti frustrava prima di trovare la soluzione. Sii autentico sulla tua esperienza.",
    style: "narrative"
  },
  "prima": {
    instruction: "Dipingi la situazione attuale del target: problemi quotidiani, frustrazioni, cosa non funziona. Crea empatia.",
    style: "narrative"
  },
  "punto_di_partenza": {
    instruction: "Descrivi da dove è partito il cliente: situazione iniziale, sfide, limiti.",
    style: "narrative"
  },
  "situazione": {
    instruction: "Presenta il contesto iniziale: chi, dove, quando, cosa stava succedendo.",
    style: "narrative"
  },
  "contesto": {
    instruction: "Fornisci il background necessario per capire il resto. Conciso ma completo.",
    style: "narrative"
  },
  "dopo": {
    instruction: "Mostra il risultato ideale con dettagli sensoriali: come si sente, cosa fa di diverso, quali risultati ottiene.",
    style: "narrative"
  },
  "risultato": {
    instruction: "Presenta i risultati concreti: numeri specifici, trasformazioni misurabili, benefici tangibili.",
    style: "narrative"
  },
  "benefit": {
    instruction: "Presenta un vantaggio specifico e misurabile. Descrivi l'impatto concreto sulla vita/business.",
    style: "narrative"
  },
  "soluzione": {
    instruction: "Spiega come si risolve il problema. Rendi il processo credibile, semplice e raggiungibile.",
    style: "narrative"
  },
  "ponte": {
    instruction: "Collega il 'prima' al 'dopo'. Spiega il meccanismo che rende possibile la trasformazione.",
    style: "narrative"
  },
  "nuovo_modo": {
    instruction: "Presenta l'approccio alternativo. Differenzialo dai metodi tradizionali che non funzionano.",
    style: "narrative"
  },
  "cosa_fare": {
    instruction: "Dai indicazioni pratiche e actionable su cosa fare concretamente.",
    style: "concise"
  },
  "confutazione": {
    instruction: "Smonta l'obiezione con logica, prove concrete, esempi reali o testimonianze.",
    style: "narrative"
  },
  "perche_falso": {
    instruction: "Spiega perché il mito è sbagliato con fatti, dati o ragionamento logico.",
    style: "narrative"
  },
  "regola_vera": {
    instruction: "Presenta la verità che sostituisce il mito. Rendila memorabile e applicabile.",
    style: "concise"
  },
  "cosa_ho_cambiato": {
    instruction: "Descrivi il cambiamento specifico: azione, mentalità, processo.",
    style: "narrative"
  },
  "come_farlo": {
    instruction: "Spiega i passaggi pratici per replicare il risultato. Sii actionable.",
    style: "concise"
  },
  "chi_cosa_come": {
    instruction: "Spiega chi sei, cosa fai e come lo fai in modo unico. Differenziati dalla concorrenza.",
    style: "narrative"
  },
  "chi_sono": {
    instruction: "Presentati in modo autentico: chi sei, cosa fai, perché sei credibile.",
    style: "narrative"
  },
  "riprova_sociale": {
    instruction: "Inserisci prove di credibilità: numeri di clienti, risultati ottenuti, testimonianze.",
    style: "narrative"
  },
  "prova": {
    instruction: "Fornisci prove concrete: numeri, case study, screenshot, testimonianze verificabili.",
    style: "concise"
  },
  "dimostrazione": {
    instruction: "Mostra che funziona: esempio pratico, prima/dopo, demo del risultato.",
    style: "narrative"
  },
  "esempio": {
    instruction: "Illustra con un esempio concreto e specifico. Rendi tangibile il concetto.",
    style: "narrative"
  },
  "caso_reale": {
    instruction: "Racconta un caso reale: cliente, problema, processo, risultato.",
    style: "narrative"
  },
  "step": {
    instruction: "Descrivi questo passaggio in modo chiaro e actionable. Cosa fare e perché.",
    style: "concise"
  },
  "leva": {
    instruction: "Presenta una leva strategica chiave. Spiega cosa è e perché funziona.",
    style: "concise"
  },
  "azioni": {
    instruction: "Elenca le azioni concrete intraprese. Sii specifico.",
    style: "list"
  },
  "ostacolo": {
    instruction: "Presenta l'ostacolo incontrato: cosa ha reso difficile il percorso.",
    style: "narrative"
  },
  "tensione": {
    instruction: "Crea tensione narrativa: il momento critico, la sfida da superare.",
    style: "narrative"
  },
  "decisione": {
    instruction: "Racconta la scelta cruciale fatta. Cosa hai deciso e perché.",
    style: "narrative"
  },
  "lezione": {
    instruction: "Condividi l'insight chiave appreso. Rendilo memorabile e applicabile.",
    style: "concise"
  },
  "regola": {
    instruction: "Formula una regola chiara e memorabile che il lettore può applicare.",
    style: "concise"
  },
  "cosa_ho_imparato": {
    instruction: "Condividi l'apprendimento più importante. Sii genuino e specifico.",
    style: "narrative"
  },
  "principio": {
    instruction: "Enuncia un principio universale o una verità fondamentale del tuo campo.",
    style: "concise"
  },
  "claim": {
    instruction: "Fai un'affermazione forte e difendibile. Prendi posizione.",
    style: "concise"
  },
  "offerta": {
    instruction: "Presenta cosa offri in modo chiaro. Sottolinea il valore unico e cosa è incluso.",
    style: "narrative"
  },
  "cosa_ottieni": {
    instruction: "Elenca i benefici concreti che il cliente riceve. Sii specifico.",
    style: "list"
  },
  "per_chi": {
    instruction: "Specifica chi è il cliente ideale. Aiuta a pre-qualificare.",
    style: "concise"
  },
  "bullet": {
    instruction: "Presenta un beneficio chiave in modo conciso e d'impatto.",
    style: "concise"
  },
  "titolo_asset": {
    instruction: "Scrivi il titolo del lead magnet/risorsa in modo attraente e specifico.",
    style: "concise"
  },
  "urgenza": {
    instruction: "Crea scarsità legittima: posti limitati, deadline, bonus temporanei. Motiva ad agire ORA.",
    style: "narrative"
  },
  "vincolo": {
    instruction: "Presenta il limite: tempo, quantità, condizioni. Rendi credibile l'urgenza.",
    style: "concise"
  },
  "cta": {
    instruction: "Invito all'azione chiaro e diretto. Dì esattamente cosa fare e cosa succede dopo.",
    style: "concise"
  },
  "cta_soft": {
    instruction: "CTA morbida: invita a salvare, commentare, o riflettere. Non vendita diretta.",
    style: "concise"
  },
  "domanda": {
    instruction: "Poni una domanda che invita alla risposta/commento. Genera engagement.",
    style: "concise"
  },
  "cosa_analizziamo": {
    instruction: "Presenta cosa stai analizzando e perché è interessante/rilevante.",
    style: "concise"
  },
  "cose_fatte_bene": {
    instruction: "Evidenzia gli aspetti positivi con specifiche. Sii costruttivo.",
    style: "list"
  },
  "da_migliorare": {
    instruction: "Indica le aree di miglioramento con suggerimenti pratici.",
    style: "list"
  },
  "punti_forti": {
    instruction: "Elenca i punti di forza con esempi specifici.",
    style: "list"
  },
  "template": {
    instruction: "Fornisci un template pronto all'uso che il lettore può copiare.",
    style: "concise"
  },
  "checklist": {
    instruction: "Elenca i punti da verificare in modo chiaro e sequenziale.",
    style: "list"
  },
  "punto": {
    instruction: "Presenta un item della lista in modo chiaro e actionable.",
    style: "concise"
  },
  "recap": {
    instruction: "Riassumi i punti chiave in modo memorabile.",
    style: "concise"
  },
  "cosa_hai_fatto": {
    instruction: "Racconta cosa hai fatto oggi/di recente. Sii specifico e autentico.",
    style: "narrative"
  },
  "prossima_mossa": {
    instruction: "Condividi il prossimo step. Crea aspettativa.",
    style: "concise"
  },
  "cosa_stai_facendo": {
    instruction: "Descrivi l'attività in corso. Porta il lettore nel tuo processo.",
    style: "narrative"
  },
  "perche": {
    instruction: "Spiega la motivazione dietro la scelta o l'azione.",
    style: "narrative"
  },
  "motivo": {
    instruction: "Presenta un argomento a supporto della tua tesi. Sii specifico.",
    style: "concise"
  },
  "mini_storia": {
    instruction: "Racconta una breve storia esemplificativa. Usa personaggio, conflitto, risoluzione.",
    style: "narrative"
  },
  "grafico_numero": {
    instruction: "Presenta un dato numerico impattante che dimostra il risultato.",
    style: "concise"
  },
  "condizione_vera": {
    instruction: "Specifica quando/come la soluzione funziona davvero.",
    style: "concise"
  },
  "promessa": {
    instruction: "Fai una promessa chiara e specifica. Cosa otterrà il lettore?",
    style: "concise"
  },
  "titolo": {
    instruction: "Scrivi un titolo chiaro che prometta valore immediato. Usa numeri se possibile.",
    style: "concise"
  },
  "framework": {
    instruction: "Presenta il framework o metodo in modo strutturato e memorabile.",
    style: "concise"
  },
  "applicazione": {
    instruction: "Spiega come applicare concretamente il concetto nella pratica.",
    style: "concise"
  },
  "quando_usarlo": {
    instruction: "Specifica in quali situazioni usare questo template/metodo.",
    style: "concise"
  },
  "obiettivo": {
    instruction: "Definisci chiaramente l'obiettivo da raggiungere.",
    style: "concise"
  }
};

function getSectionGuideline(fieldName: string, sectionLabel: string): { instruction: string; style: string } {
  const normalizedField = fieldName.toLowerCase().replace(/[_\d]+/g, '_').replace(/^_|_$/g, '');
  const normalizedLabel = sectionLabel.toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
  
  const searchTerms = [
    normalizedField,
    normalizedLabel,
    ...normalizedField.split('_').filter(s => s.length > 2),
    ...normalizedLabel.split('_').filter(s => s.length > 2)
  ];
  
  for (const term of searchTerms) {
    if (SECTION_GUIDELINES[term]) {
      return SECTION_GUIDELINES[term];
    }
  }
  
  for (const key of Object.keys(SECTION_GUIDELINES)) {
    for (const term of searchTerms) {
      if (key.includes(term) || term.includes(key)) {
        return SECTION_GUIDELINES[key];
      }
    }
  }
  
  return {
    instruction: "Sviluppa questa sezione in modo chiaro, coinvolgente e rilevante per il target.",
    style: "narrative"
  };
}

/**
 * Get a RANDOM section guideline from SECTION_INSTRUCTION_VARIANTS.
 * Falls back to static SECTION_GUIDELINES if no variant exists.
 * Used for custom schemas to add variety to AI-generated content.
 */
function getRandomSectionGuideline(fieldName: string, sectionLabel: string): { instruction: string; style: string } {
  const normalizedField = fieldName.toLowerCase().replace(/[_\d]+/g, '_').replace(/^_|_$/g, '');
  const normalizedLabel = sectionLabel.toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
  
  const searchTerms = [
    fieldName,
    normalizedField,
    normalizedLabel,
    ...normalizedField.split('_').filter(s => s.length > 2),
    ...normalizedLabel.split('_').filter(s => s.length > 2)
  ];
  
  // Try exact match first in SECTION_INSTRUCTION_VARIANTS
  for (const term of searchTerms) {
    if (SECTION_INSTRUCTION_VARIANTS[term] && SECTION_INSTRUCTION_VARIANTS[term].length > 0) {
      const variants = SECTION_INSTRUCTION_VARIANTS[term];
      const randomVariant = variants[Math.floor(Math.random() * variants.length)];
      return {
        instruction: randomVariant,
        style: "Mantieni coerenza con il resto"
      };
    }
  }
  
  // Try partial match in SECTION_INSTRUCTION_VARIANTS keys
  for (const key of Object.keys(SECTION_INSTRUCTION_VARIANTS)) {
    for (const term of searchTerms) {
      if (key.toLowerCase().includes(term.toLowerCase()) || term.toLowerCase().includes(key.toLowerCase())) {
        const variants = SECTION_INSTRUCTION_VARIANTS[key];
        if (variants && variants.length > 0) {
          const randomVariant = variants[Math.floor(Math.random() * variants.length)];
          return {
            instruction: randomVariant,
            style: "Mantieni coerenza con il resto"
          };
        }
      }
    }
  }
  
  // Fallback to static SECTION_GUIDELINES
  return getSectionGuideline(fieldName, sectionLabel);
}

export { SECTION_GUIDELINES, getSectionGuideline, getRandomSectionGuideline };

/**
 * Dynamic Section Instruction Variants
 * Each section has 3-5 variants to reduce repetitive AI output
 */
const SECTION_INSTRUCTION_VARIANTS: Record<string, string[]> = {
  hook: [
    "La prima frase che ferma lo scroll - provocatoria, curiosa, o scioccante.",
    "L'apertura che cattura l'attenzione immediatamente - domanda diretta o affermazione audace.",
    "Il gancio iniziale che fa pensare 'Devo leggere di più' - sorprendente o controintuitivo.",
    "La frase d'impatto che interrompe lo scrolling - statistica shock o verità scomoda.",
    "L'hook che crea curiosità irresistibile - promessa intrigante o sfida al lettore."
  ],
  chiCosaCome: [
    "Aiuto [CHI] a [FARE COSA] attraverso [COME] - il tuo posizionamento unico.",
    "Chi servi, quale trasformazione offri e con quale metodo distintivo.",
    "Il tuo elevator pitch: target + risultato + approccio in una formula chiara.",
    "La tua proposta di valore: a chi parli, cosa ottengono, come ci arrivi.",
    "Posizionamento cristallino: cliente ideale + beneficio principale + metodo proprietario."
  ],
  errore: [
    "L'errore comune che il tuo target sta commettendo senza saperlo.",
    "Il problema nascosto che blocca i tuoi potenziali clienti dal raggiungere i risultati.",
    "La trappola mentale in cui cade chi non ha ancora capito il vero ostacolo.",
    "Quello che tutti sbagliano nel tuo settore (e perché costa caro).",
    "L'errore invisibile che sabota i risultati - e quasi nessuno ne parla."
  ],
  soluzione: [
    "La tua soluzione unica al problema - cosa offri e perché funziona.",
    "Il metodo che hai sviluppato per risolvere questo problema specifico.",
    "La via d'uscita che proponi - perché è diversa dalle alternative sul mercato.",
    "Il sistema/approccio che funziona quando tutto il resto ha fallito.",
    "La tua formula proprietaria per ottenere il risultato desiderato."
  ],
  riprovaSociale: [
    "Testimonianze, risultati concreti, numeri specifici che dimostrano credibilità.",
    "Prove sociali che validano la tua expertise: clienti serviti, trasformazioni reali.",
    "Credibilità tangibile: case study, numeri, feedback verificabili.",
    "Risultati misurabili e storie di successo che parlano da sole.",
    "Social proof potente: dati, testimonianze, riconoscimenti che costruiscono fiducia."
  ],
  cta: [
    "Call to action finale chiara e urgente.",
    "Invito all'azione specifico: cosa fare adesso e cosa succede dopo.",
    "Il passo successivo immediato - semplice, chiaro, irresistibile.",
    "CTA che crea urgenza senza essere aggressiva - azione + beneficio.",
    "L'azione concreta da compiere ORA per ottenere il risultato promesso."
  ],
  body: [
    "Il corpo del messaggio che sviluppa l'idea principale con valore concreto.",
    "Contenuto centrale che approfondisce il tema e mantiene l'attenzione.",
    "Il cuore del post: insight, valore pratico, connessione emotiva.",
    "Sviluppo del messaggio con esempi, dettagli e punti chiave.",
    "La parte centrale che trasforma curiosità in interesse genuino."
  ],
  problema: [
    "Esponi il problema centrale con esempi reali e conseguenze tangibili.",
    "Descrivi la frustrazione quotidiana che il tuo target vive sulla propria pelle.",
    "Il pain point specifico raccontato con empatia e dettagli concreti.",
    "La sfida che il tuo pubblico affronta - e perché le soluzioni comuni non funzionano."
  ],
  fullScript: [
    "Lo script completo parlato fluido. USA [PAUSA] per pause drammatiche.",
    "Il copione video naturale, come parleresti a un amico. Includi [PAUSA] per enfasi.",
    "Script conversazionale per video - ritmo naturale con [PAUSA] nei momenti chiave.",
    "Testo parlato coinvolgente con transizioni fluide. [PAUSA] dove serve impatto."
  ],
  // === ADS-RELATED SECTIONS ===
  pain: [
    "Il dolore specifico che il target vive ogni giorno - frustrazioni, ansie, problemi reali.",
    "Descrivi il problema emotivo del target con dettagli vividi: cosa lo tiene sveglio la notte?",
    "Il pain point principale espresso come lo direbbe il cliente stesso.",
    "La frustrazione quotidiana raccontata con empatia - il lettore deve pensare 'Parla di me!'",
    "Il problema che brucia: descrivilo con parole che il target usa davvero."
  ],
  pain1: [
    "Primo pain point specifico - il problema più immediato e tangibile.",
    "La prima frustrazione concreta: cosa non funziona nella situazione attuale?",
    "Pain point #1: il disagio più evidente che il target riconosce subito.",
    "Il primo problema da affrontare - quello che il cliente ammette facilmente."
  ],
  pain2: [
    "Secondo pain point - il problema nascosto sotto la superficie.",
    "La frustrazione che emerge dopo: cosa peggiora se non agisci?",
    "Pain point #2: l'ostacolo meno ovvio ma altrettanto doloroso.",
    "Il secondo livello di dolore - quello che il target scopre solo riflettendo."
  ],
  pain3: [
    "Terzo pain point - la conseguenza a lungo termine del problema.",
    "Il dolore futuro: cosa succederà se non risolvi adesso?",
    "Pain point #3: l'impatto profondo sulla vita/business del target.",
    "La terza frustrazione - quella che tocca valori più profondi."
  ],
  benefit: [
    "Il beneficio concreto e misurabile che il cliente ottiene.",
    "Vantaggio tangibile: cosa cambia nella vita/business dopo la trasformazione?",
    "Il risultato specifico che il target desidera ardentemente.",
    "Beneficio chiaro espresso in termini che il cliente può visualizzare.",
    "Il guadagno reale: tempo risparmiato, soldi guadagnati, stress eliminato."
  ],
  benefit1: [
    "Primo beneficio principale - il risultato più desiderato.",
    "Vantaggio #1: la trasformazione più immediata e visibile.",
    "Il beneficio primario che giustifica l'investimento.",
    "Prima promessa di valore: cosa ottieni subito?"
  ],
  benefit2: [
    "Secondo beneficio - il valore aggiunto che sorprende.",
    "Vantaggio #2: quello che non ti aspettavi di ottenere.",
    "Il beneficio secondario che aumenta il valore percepito.",
    "Secondo risultato positivo: cosa migliora oltre al problema principale?"
  ],
  benefit3: [
    "Terzo beneficio - l'impatto a lungo termine.",
    "Vantaggio #3: come cambia la tua vita/business nel tempo.",
    "Il beneficio duraturo che continua a dare valore.",
    "Terza trasformazione: il cambiamento profondo e permanente."
  ],
  obiezione: [
    "L'obiezione più comune che il target ha in mente prima di agire.",
    "Il dubbio principale che blocca la decisione - formulalo come lo penserebbe lui.",
    "La resistenza tipica del mercato: 'Sì, ma...' - qual è il 'ma' più frequente?",
    "L'obiezione silenziosa che il potenziale cliente non dice ma pensa.",
    "Il freno mentale che impedisce di passare all'azione."
  ],
  confutazione: [
    "Smonta l'obiezione con logica, prove ed esempi concreti.",
    "La risposta che dissolve il dubbio - argomentazione + evidenza.",
    "Come ribattere all'obiezione in modo convincente senza essere aggressivo.",
    "Confutazione elegante: perché quel dubbio non regge alla prova dei fatti.",
    "Demolisci l'obiezione con casi reali, numeri o ragionamento inattaccabile."
  ],
  offerta: [
    "Presenta la tua offerta in modo chiaro: cosa è incluso, cosa ottiene il cliente.",
    "La proposta di valore completa: servizio/prodotto + benefici + unicità.",
    "Descrivi l'offerta come un'opportunità imperdibile, non come una vendita.",
    "Cosa offri esattamente: componenti, bonus, supporto - tutto ciò che riceve.",
    "L'offerta irresistibile: valore percepito superiore al prezzo richiesto."
  ],
  urgenza: [
    "Crea urgenza legittima: perché agire ORA e non domani?",
    "Scarsità reale: posti limitati, deadline, bonus temporanei.",
    "Il motivo per cui rimandare costa caro - urgenza basata su fatti.",
    "Pressione temporale credibile: cosa perdi se aspetti?",
    "Urgenza senza manipolazione: la ragione vera per cui il tempo conta."
  ],
  promessa: [
    "La promessa chiara e specifica che fai al lettore.",
    "Cosa garantisci: il risultato concreto che può aspettarsi.",
    "La tua promessa in una frase: trasformazione + tempistica + condizioni.",
    "Impegno diretto: 'Se fai X, otterrai Y' - sii specifico.",
    "La promessa che differenzia la tua offerta da tutte le altre."
  ],
  prova: [
    "Prove concrete che supportano le tue affermazioni: numeri, dati, risultati.",
    "Evidenze verificabili: case study, screenshot, testimonianze reali.",
    "I numeri che parlano: statistiche, percentuali, risultati misurabili.",
    "Prove inconfutabili: fatti che il lettore può verificare.",
    "Credibilità attraverso i dati: cosa dimostrano i risultati ottenuti?"
  ],
  dimostrazione: [
    "Mostra che funziona: esempio pratico, demo, prima/dopo visibile.",
    "Dimostrazione tangibile del risultato: come appare la trasformazione?",
    "Prova visiva o narrativa: racconta/mostra un caso specifico.",
    "Il 'vedere per credere': esempio concreto che elimina ogni dubbio.",
    "Demo del metodo: un assaggio di come funziona nella pratica."
  ],
  miniDimostrazione: [
    "Mini-demo veloce: un esempio rapido che prova il concetto.",
    "Dimostrazione lampo: in 30 secondi mostra che funziona.",
    "Piccola prova immediata: il 'quick win' che convince.",
    "Assaggio del risultato: un micro-esempio che vale mille parole."
  ],
  nuovoModo: [
    "L'approccio alternativo che cambia le regole del gioco.",
    "Il nuovo metodo che rende obsoleti i vecchi sistemi.",
    "Perché il tuo modo è diverso: cosa fai che gli altri non fanno?",
    "L'innovazione nel tuo approccio: il 'segreto' che fa la differenza.",
    "Il paradigma nuovo: dimentica quello che sapevi, ecco come funziona davvero."
  ],
  nuovo_modo: [
    "La via alternativa che porta risultati dove i metodi tradizionali falliscono.",
    "Nuovo approccio: perché le soluzioni comuni non funzionano e questa sì.",
    "Il metodo controintuitivo che produce risultati superiori.",
    "L'innovazione che semplifica: meno sforzo, più risultati."
  ],
  provaSociale: [
    "Social proof: testimonianze, numeri di clienti, riconoscimenti.",
    "Prova sociale potente: cosa dicono gli altri che hanno già provato?",
    "La voce dei clienti: feedback reali che costruiscono fiducia.",
    "Numeri che parlano: quanti clienti, quali risultati, che feedback.",
    "Credibilità attraverso gli altri: chi ti ha già scelto e perché."
  ],
  prova_sociale: [
    "Testimonianze e risultati di chi ha già fatto il passo.",
    "Social proof concreto: nomi, numeri, storie verificabili.",
    "La prova che viene dagli altri: recensioni, case study, endorsement.",
    "Fiducia attraverso la community: cosa dice chi è già dentro."
  ],
  prima: [
    "La situazione PRIMA della trasformazione: problemi, frustrazioni, limiti.",
    "Come era la vita/business prima: dipingi il quadro negativo con empatia.",
    "Lo stato attuale del target: cosa non funziona, cosa manca, cosa fa male.",
    "Il 'prima' vivido: dettagli specifici della situazione problematica.",
    "Punto di partenza: dove si trova chi non ha ancora la soluzione."
  ],
  dopo: [
    "La situazione DOPO la trasformazione: risultati, emozioni, nuova realtà.",
    "Come sarà la vita/business dopo: dipingi il quadro positivo con dettagli.",
    "Lo stato futuro desiderato: cosa funziona, cosa hai ottenuto, come ti senti.",
    "Il 'dopo' irresistibile: la visione che il target vuole realizzare.",
    "Punto di arrivo: dove arriva chi implementa la soluzione."
  ],
  ponte: [
    "Il ponte tra PRIMA e DOPO: il processo, il metodo, i passi.",
    "Come si passa da A a B: spiega la trasformazione in modo credibile.",
    "Il percorso che collega problema e soluzione: cosa succede nel mezzo?",
    "La strada da percorrere: step, fasi, tappe del cambiamento.",
    "Il meccanismo che rende possibile la trasformazione."
  ],
  vincolo: [
    "Il limite o la condizione dell'offerta: cosa la rende esclusiva.",
    "Vincolo reale: perché non tutti possono accedere o perché è limitata.",
    "La condizione che filtra: per chi è e per chi NON è questa offerta.",
    "Limite di disponibilità: tempo, quantità, requisiti di accesso.",
    "Il vincolo che aumenta il valore: scarsità legittima e motivata."
  ],
  // === VALORE (VALUE CONTENT) SECTIONS ===
  mito: [
    "La credenza comune nel settore che in realtà è completamente falsa.",
    "Il mito diffuso che tutti credono vero ma che limita i risultati.",
    "La convinzione popolare che devi sfatare - quella che tiene il target bloccato.",
    "L'idea sbagliata che circola nel mercato e che i tuoi clienti credono vera.",
    "La falsità accettata da tutti: cosa crede il target che invece è sbagliato?"
  ],
  percheFalso: [
    "Spiega con logica e prove perché questa credenza è sbagliata.",
    "Demolisci il mito con fatti concreti: dati, esempi, ragionamento.",
    "Perché il mito non regge: la verità che emerge quando analizzi bene.",
    "L'argomentazione che smonta la falsità - evidenze e logica.",
    "La confutazione definitiva: ecco perché quel mito è sbagliato."
  ],
  perche_falso: [
    "Argomenta perché la credenza comune è errata con prove concrete.",
    "La spiegazione razionale che dimostra l'errore del pensiero comune.",
    "Fatti e logica che smontano il mito - perché la verità è diversa.",
    "L'evidenza che contraddice la credenza popolare."
  ],
  regolaVera: [
    "La verità che sostituisce il mito: la regola che funziona davvero.",
    "Cosa è vero invece: la nuova credenza da adottare.",
    "La regola corretta da seguire una volta capito l'errore.",
    "Il principio vero che porta risultati - l'opposto del mito.",
    "La verità funzionale: cosa fare invece di seguire il mito."
  ],
  regola_vera: [
    "Il principio corretto che rimpiazza la falsità comune.",
    "La nuova verità da interiorizzare: cosa funziona davvero.",
    "Regola sostitutiva: il modo giusto di vedere le cose.",
    "La credenza aggiornata basata su fatti e risultati reali."
  ],
  comeApplicarla: [
    "Come mettere in pratica questa regola nella vita quotidiana.",
    "Passi concreti per applicare il principio: cosa fare domani.",
    "L'implementazione pratica: trasforma la teoria in azione.",
    "Come usare questa verità per ottenere risultati tangibili.",
    "Applicazione immediata: i primi passi per mettere in pratica."
  ],
  come_applicarla: [
    "Istruzioni pratiche per implementare la regola vera.",
    "Da teoria a pratica: come tradurre il principio in azioni.",
    "Il percorso di applicazione: step concreti per iniziare.",
    "Come integrare questa verità nel tuo processo quotidiano."
  ],
  cosaAnalizziamo: [
    "Presenta cosa stai analizzando e perché è rilevante per il target.",
    "L'oggetto dell'analisi: cosa esaminiamo e cosa cercheremo.",
    "Introduzione all'analisi: il soggetto e il motivo dell'esame.",
    "Cosa mettiamo sotto la lente: contesto e obiettivo dell'analisi.",
    "Il focus dell'analisi: cosa guarderemo e perché è interessante."
  ],
  cosa_analizziamo: [
    "L'argomento dell'analisi presentato con contesto chiaro.",
    "Cosa stiamo per esaminare: soggetto e aspettative.",
    "Introduzione chiara: ecco cosa analizzeremo insieme.",
    "Il punto focale: cosa osserveremo e quali insight cercheremo."
  ],
  coseFatteBene: [
    "I punti di forza emersi dall'analisi - cosa funziona bene.",
    "Aspetti positivi: cosa è stato fatto correttamente e perché.",
    "Le cose giuste: elementi da mantenere e replicare.",
    "Punti di merito: cosa funziona e merita riconoscimento.",
    "I successi identificati: cosa vale la pena celebrare."
  ],
  cose_fatte_bene: [
    "Gli elementi positivi dell'analisi con specifiche.",
    "Cosa funziona: i punti di forza da preservare.",
    "Le best practice identificate: cosa continuare a fare.",
    "Aspetti vincenti: le decisioni corrette emerse."
  ],
  puntiFoRti: [
    "I punti di forza principali emersi dall'esame.",
    "Elementi di eccellenza: cosa distingue in positivo.",
    "Le qualità evidenti: punti che creano vantaggio.",
    "Aree di forza: dove si eccelle e perché conta."
  ],
  punti_forti: [
    "Le caratteristiche positive identificate nell'analisi.",
    "Dove si eccelle: i punti di forza concreti.",
    "Elementi distintivi positivi: cosa funziona bene.",
    "I vantaggi emersi: qualità e competenze forti."
  ],
  daMigliorare: [
    "Le aree che necessitano attenzione e miglioramento.",
    "Punti deboli identificati: cosa correggere e come.",
    "Opportunità di miglioramento: dove intervenire per crescere.",
    "Aspetti da ottimizzare: le aree che frenano i risultati.",
    "Criticità emerse: cosa richiede intervento prioritario."
  ],
  da_migliorare: [
    "Le debolezze emerse con suggerimenti pratici.",
    "Aree di intervento: cosa cambiare per migliorare.",
    "Punti critici: dove concentrare gli sforzi di ottimizzazione.",
    "Margini di miglioramento: le opportunità di crescita."
  ],
  template: [
    "Un template pronto all'uso che il lettore può copiare e adattare.",
    "Modello replicabile: la struttura da seguire passo dopo passo.",
    "Il format da usare: copia, personalizza, applica.",
    "Template pratico: la formula pronta per essere utilizzata.",
    "Schema operativo: il modello che semplifica l'esecuzione."
  ],
  checklist: [
    "Lista di controllo completa: tutti i punti da verificare.",
    "Checklist operativa: spunta ogni elemento prima di procedere.",
    "Verifica sequenziale: i passaggi da controllare uno per uno.",
    "Lista di verifica pratica: assicurati di non dimenticare nulla.",
    "Elenco di controllo: i checkpoint essenziali del processo."
  ],
  step: [
    "Descrivi questo passaggio in modo chiaro e actionable.",
    "Il passo da compiere: cosa fare e perché è importante.",
    "Istruzione specifica: l'azione concreta di questo step.",
    "Passaggio operativo: cosa eseguire e come farlo bene.",
    "Fase del processo: l'azione da completare prima di proseguire."
  ],
  step1: [
    "Il primo passo fondamentale: da dove iniziare.",
    "Step iniziale: l'azione che avvia tutto il processo.",
    "Primo passaggio: cosa fare per partire nel modo giusto.",
    "L'inizio del percorso: il primo step essenziale."
  ],
  step2: [
    "Il secondo passaggio: cosa fare dopo aver completato il primo.",
    "Step successivo: la naturale prosecuzione del processo.",
    "Secondo passo: l'azione che costruisce sul precedente.",
    "Fase 2: cosa eseguire per continuare l'avanzamento."
  ],
  step3: [
    "Il terzo passaggio: il momento centrale del processo.",
    "Step intermedio: l'azione che porta verso il risultato.",
    "Terzo passo: cosa fare per consolidare il progresso.",
    "Fase 3: la tappa che connette inizio e conclusione."
  ],
  step4: [
    "Il quarto passaggio: ci avviciniamo alla conclusione.",
    "Step avanzato: l'azione che perfeziona il lavoro.",
    "Quarto passo: cosa fare per completare quasi tutto.",
    "Fase 4: il passaggio che prepara al finale."
  ],
  step5: [
    "L'ultimo passaggio: come concludere il processo.",
    "Step finale: l'azione che chiude il cerchio.",
    "Quinto passo: cosa fare per completare tutto.",
    "Fase conclusiva: il passaggio che sigilla il risultato."
  ],
  casoReale: [
    "Un caso studio concreto: cliente, problema, soluzione, risultato.",
    "Storia vera di trasformazione: da dove è partito e dove è arrivato.",
    "Esempio reale: come ha funzionato nella pratica con risultati misurabili.",
    "Case study specifico: i dettagli di un successo documentato.",
    "Testimonianza concreta: la storia completa di un cliente reale."
  ],
  caso_reale: [
    "Un esempio documentato con dati e risultati verificabili.",
    "La storia di un cliente: problema, processo, trasformazione.",
    "Case study dettagliato: cosa è successo e cosa ha funzionato.",
    "Caso pratico: la dimostrazione reale del metodo in azione."
  ],
  lezione: [
    "L'insight chiave appreso: la verità emersa dall'esperienza.",
    "La lezione fondamentale: cosa abbiamo imparato da questa situazione.",
    "L'apprendimento più importante: il takeaway da portare via.",
    "Insight memorabile: la lezione che cambia il modo di vedere le cose.",
    "La morale della storia: cosa insegna questa esperienza."
  ],
  principio: [
    "Un principio universale che si applica sempre in questo contesto.",
    "La verità fondamentale: il principio che guida le decisioni corrette.",
    "Regola generale: il principio da tenere sempre a mente.",
    "Fondamento invariabile: ciò che rimane vero in ogni situazione.",
    "Il principio cardine: la base su cui costruire tutto il resto."
  ],
  regola: [
    "Una regola chiara e memorabile che il lettore può applicare subito.",
    "La formula da ricordare: semplice, diretta, efficace.",
    "Regola pratica: il principio operativo da seguire.",
    "La regola d'oro: cosa fare sempre in questa situazione.",
    "Linea guida essenziale: la regola che non tradisce mai."
  ],
  contesto: [
    "Il background necessario per comprendere il resto del contenuto.",
    "Contesto essenziale: le informazioni preliminari per capire.",
    "Lo scenario di partenza: situazione, condizioni, elementi chiave.",
    "Il quadro generale: cosa devi sapere prima di andare avanti.",
    "Premesse importanti: il contesto che rende tutto più chiaro."
  ],
  // === FORMAZIONE (EDUCATIONAL CONTENT) SECTIONS ===
  obiettivo: [
    "Obiettivo didattico: comprendere il principio fondamentale e saperlo riconoscere nella pratica.",
    "Questa sezione spiega un concetto essenziale che costituisce la base teorica dell'argomento.",
    "Al termine della lettura, il concetto sarà chiaro e applicabile in contesti reali.",
    "L'obiettivo è trasmettere una conoscenza che rimane valida indipendentemente dal contesto specifico.",
    "Focus dell'apprendimento: acquisire una comprensione profonda del principio trattato."
  ],
  concettoChiave: [
    "Questo concetto spiega il meccanismo fondamentale alla base dell'argomento trattato.",
    "Il principio centrale: l'idea teorica che governa questo fenomeno.",
    "La nozione fondamentale che permette di comprendere tutti gli aspetti correlati.",
    "Il concetto cardine su cui si basa l'intera comprensione dell'argomento."
  ],
  concetto_chiave: [
    "Il principio teorico essenziale: ciò che rende comprensibile l'intero argomento.",
    "Questa è la nozione base da cui derivano tutte le applicazioni pratiche.",
    "Il fondamento concettuale: l'idea che spiega perché le cose funzionano così.",
    "La definizione chiave: il concetto senza il quale il resto non ha senso."
  ],
  percheImportante: [
    "Questo argomento è rilevante perché influenza direttamente la qualità dei risultati ottenibili.",
    "L'importanza di questo concetto: spiega fenomeni che altrimenti sembrerebbero casuali.",
    "Capire questo principio permette di evitare errori comuni e prendere decisioni più informate.",
    "La rilevanza pratica: questo concetto ha applicazioni concrete in molteplici situazioni."
  ],
  perche_importante: [
    "Questo principio è importante perché costituisce la base di molte decisioni pratiche.",
    "Comprendere questo concetto aiuta a interpretare correttamente situazioni complesse.",
    "La conoscenza di questo argomento previene errori che derivano da incomprensioni comuni.",
    "L'utilità di questo concetto: fornisce un framework per analizzare situazioni simili."
  ],
  esempio: [
    "Esempio pratico: ecco come si manifesta questo principio in una situazione reale.",
    "Per illustrare il concetto, consideriamo questo caso concreto.",
    "Un'applicazione pratica che rende visibile il principio appena descritto.",
    "Scenario esemplificativo: come il concetto si traduce nella pratica.",
    "Per capire meglio, osserviamo questo esempio tratto dalla realtà."
  ],
  esempio1: [
    "Primo esempio: un caso semplice che illustra il principio base.",
    "Per iniziare, consideriamo questa situazione elementare.",
    "Esempio introduttivo: il concetto nella sua forma più immediata.",
    "Caso base: come appare il principio in una situazione semplice."
  ],
  esempio2: [
    "Secondo esempio: lo stesso principio in un contesto leggermente diverso.",
    "Un'altra applicazione: il concetto si manifesta anche in questa situazione.",
    "Variante pratica: stesso principio, contesto differente.",
    "Per consolidare, ecco un altro caso in cui il principio è visibile."
  ],
  comeApplicarlo: [
    "Per applicare questa conoscenza, seguire questi passaggi fondamentali.",
    "Traduzione pratica: ecco come mettere in pratica il principio appreso.",
    "Passaggi per l'applicazione: dalla comprensione teorica all'uso concreto.",
    "Come utilizzare questa conoscenza: le fasi operative essenziali.",
    "Guida all'applicazione pratica del concetto appena illustrato."
  ],
  come_applicarlo: [
    "I passaggi per tradurre la teoria in pratica.",
    "Come procedere: le azioni concrete per applicare il principio.",
    "Istruzioni operative: dalla conoscenza all'implementazione.",
    "Per mettere in pratica questo concetto, considerare questi step."
  ],
  erroreComune: [
    "Un errore frequente è confondere questo principio con concetti simili ma diversi.",
    "Attenzione: molti commettono l'errore di applicare questo concetto in modo troppo rigido.",
    "Errore tipico: sottovalutare l'importanza del contesto nell'applicazione.",
    "Una trappola comune è pensare che questo principio sia universale senza eccezioni."
  ],
  errore_comune: [
    "L'errore più diffuso riguarda l'applicazione meccanica senza considerare le variabili.",
    "Un malinteso frequente: credere che il principio funzioni sempre allo stesso modo.",
    "Attenzione a non confondere questo concetto con altri apparentemente simili.",
    "Errore ricorrente: ignorare le condizioni necessarie per l'applicazione corretta."
  ],
  modulo: [
    "Questo modulo tratta: i concetti fondamentali e le loro applicazioni pratiche.",
    "Contenuto della sezione: principi teorici ed esempi illustrativi.",
    "In questo modulo vengono esplorati i fondamenti dell'argomento.",
    "Focus tematico: gli elementi essenziali per comprendere l'argomento."
  ],
  modulo1: [
    "Modulo 1 - Fondamenti: i concetti base necessari per la comprensione.",
    "Primo modulo: introduzione ai principi teorici essenziali.",
    "Base teorica: le nozioni fondamentali da cui partire.",
    "Fondamenti: i concetti introduttivi che costituiscono le basi."
  ],
  modulo2: [
    "Modulo 2 - Approfondimento: espansione dei concetti introdotti.",
    "Secondo modulo: esplorazione più dettagliata dei principi.",
    "Sviluppo tematico: ampliamento della comprensione teorica.",
    "Approfondimento: connessioni tra i concetti e casi più complessi."
  ],
  modulo3: [
    "Modulo 3 - Applicazioni avanzate: casi complessi e integrazioni.",
    "Terzo modulo: sintesi dei concetti e applicazioni sofisticate.",
    "Livello avanzato: integrazione dei principi in scenari articolati.",
    "Completamento: le nozioni che permettono una padronanza completa dell'argomento."
  ],
  cosaImparerai: [
    "Questa sezione trasmette: conoscenze teoriche e capacità di applicazione pratica.",
    "Al termine, il concetto sarà chiaro nella teoria e riconoscibile nella pratica.",
    "Conoscenze trattate: principi fondamentali e metodi di applicazione.",
    "Gli argomenti coperti includono: definizioni, esempi e modalità d'uso.",
    "Contenuto formativo: teoria, esempi illustrativi e indicazioni pratiche."
  ],
  cosa_imparerai: [
    "Questa sezione copre: concetti teorici e loro traduzione operativa.",
    "Argomenti trattati: principi base, esempi e applicazioni concrete.",
    "La comprensione acquisita permetterà di riconoscere e applicare il principio.",
    "Contenuti: fondamenti teorici accompagnati da casi esemplificativi."
  ],
  materiali: [
    "Materiali utili: risorse consigliate per approfondire l'argomento.",
    "Strumenti e risorse: elementi che facilitano la comprensione pratica.",
    "Risorse suggerite: materiali di supporto per l'approfondimento.",
    "Per la pratica, possono essere utili i seguenti strumenti.",
    "Risorse complementari: materiali consigliati per l'esercitazione."
  ],
  istruzioni: [
    "Istruzioni: i passaggi da seguire per completare l'esercitazione.",
    "Come procedere: indicazioni passo-passo per l'attività pratica.",
    "Guida operativa: sequenza di azioni per l'esercizio.",
    "Passaggi: le fasi da seguire nell'ordine indicato.",
    "Procedura: le istruzioni dettagliate per l'attività."
  ],
  erroriDaEvitare: [
    "Errori da evitare: gli sbagli più comuni nell'applicazione del concetto.",
    "Attenzione: questi sono gli errori tipici che compromettono i risultati.",
    "Trappole frequenti: situazioni in cui è facile sbagliare.",
    "Per ottenere risultati corretti, evitare questi errori ricorrenti."
  ],
  errori_da_evitare: [
    "Gli sbagli più frequenti riguardano l'applicazione senza verificare le condizioni.",
    "Errori tipici: incomprensioni che portano a risultati non corretti.",
    "Attenzione a queste trappole comuni nell'applicazione pratica.",
    "Criticità da evitare: gli errori che invalidano il processo."
  ],
  risultatoAtteso: [
    "Risultato atteso: ecco cosa si ottiene applicando correttamente il principio.",
    "Esito previsto: il risultato che indica un'applicazione corretta.",
    "Se il procedimento è corretto, il risultato dovrebbe apparire così.",
    "Parametro di verifica: questo è l'esito che conferma la corretta esecuzione."
  ],
  risultato_atteso: [
    "Il risultato corretto indica che il principio è stato applicato propriamente.",
    "Esito di riferimento: ciò che dovrebbe emergere dall'applicazione.",
    "Benchmark: il risultato che indica successo nell'esecuzione.",
    "Verifica: questo è l'esito che conferma la comprensione del concetto."
  ],
  perChiE: [
    "Questa conoscenza è utile a chi lavora con questi argomenti o contesti.",
    "Rilevante per: professionisti e studenti che si occupano di questo ambito.",
    "Questa sezione è particolarmente utile per chi desidera approfondire l'argomento.",
    "Chi beneficia di questa conoscenza: chiunque operi in contesti dove il principio è applicabile."
  ],
  per_chi_e: [
    "Utile per chi vuole comprendere a fondo questo argomento.",
    "Questa sezione è pensata per chi ha bisogno di basi solide sull'argomento.",
    "Rilevante per: chi si occupa professionalmente o accademicamente di questi temi.",
    "Indicato per chi desidera una comprensione approfondita del principio."
  ],
  perChi: [
    "Questa conoscenza è rilevante per chi opera in ambiti dove il principio si applica.",
    "Utile per chiunque voglia comprendere meglio l'argomento trattato.",
    "Indicato per chi cerca una comprensione solida dei fondamenti.",
    "Rilevante per professionisti, studenti e appassionati dell'argomento."
  ],
  domanda: [
    "Domanda di riflessione: come si applica questo concetto nel caso descritto?",
    "Quesito: quale principio spiega il fenomeno presentato?",
    "Per verificare la comprensione: in quale situazione si applica questo concetto?",
    "Riflessione: come si manifesterebbe questo principio in un contesto diverso?"
  ],
  domanda1: [
    "Prima domanda: qual è il principio fondamentale trattato?",
    "Quesito 1: come si definisce il concetto chiave di questa sezione?",
    "Per iniziare: quale elemento distingue questo concetto da altri simili?",
    "Domanda introduttiva: qual è la caratteristica principale del principio?"
  ],
  domanda2: [
    "Seconda domanda: come si applica il principio nell'esempio presentato?",
    "Quesito 2: quale condizione è necessaria per l'applicazione corretta?",
    "Per approfondire: in che modo il contesto influenza l'applicazione?",
    "Domanda di analisi: quali variabili determinano l'esito?"
  ],
  domanda3: [
    "Terza domanda: come si riconosce un'applicazione corretta del principio?",
    "Quesito 3: quale errore comune è associato a questo concetto?",
    "Per completare: come si integra questo principio con quelli precedenti?",
    "Domanda conclusiva: quali sono le implicazioni pratiche del concetto?"
  ],
  risposte: [
    "Risposte: ecco le soluzioni corrette con le relative spiegazioni.",
    "Soluzioni: le risposte e il ragionamento che le supporta.",
    "Chiave di lettura: le risposte corrette e perché sono tali.",
    "Verifica: confronta le tue risposte con queste soluzioni."
  ],
  spiegazione: [
    "Spiegazione: il ragionamento che porta alla risposta corretta.",
    "Perché questa è la risposta: la logica sottostante alla soluzione.",
    "Il ragionamento: come si arriva alla conclusione corretta.",
    "Analisi della risposta: i passaggi logici che la giustificano.",
    "Chiarimento: cosa rende questa la risposta appropriata."
  ],
  takeaway: [
    "Concetto chiave da ricordare: il principio fondamentale di questa sezione.",
    "Sintesi: l'idea centrale che riassume l'intero argomento.",
    "Il punto essenziale: ciò che rimane dopo aver compreso l'argomento.",
    "Principio da ricordare: la nozione che sintetizza la sezione.",
    "In sintesi: il concetto fondamentale da portare via."
  ],
  // === STORYTELLING SECTIONS ===
  situazione: [
    "Il contesto iniziale della storia: dove, quando, chi è coinvolto.",
    "Lo scenario di partenza: la situazione che ha dato origine a tutto.",
    "Il punto di partenza narrativo: come inizia questa storia.",
    "La cornice iniziale: l'ambiente e le circostanze che fanno da sfondo.",
    "L'inizio della storia: presenta il quadro iniziale con dettagli vividi."
  ],
  tensione: [
    "Il momento di tensione: la sfida che ha messo tutto in discussione.",
    "Il punto critico: quando la situazione si è fatta difficile.",
    "La crisi che ha cambiato le carte in tavola: cosa è andato storto.",
    "Il momento di svolta negativo: l'ostacolo che sembrava insormontabile.",
    "La tensione narrativa: il conflitto che tiene il lettore incollato."
  ],
  decisione: [
    "La scelta cruciale: il bivio che ha determinato tutto il resto.",
    "Il momento della decisione: cosa hai scelto e perché.",
    "La svolta decisiva: l'azione che ha cambiato il corso degli eventi.",
    "Il punto di non ritorno: la decisione coraggiosa che hai preso.",
    "La scelta fondamentale: cosa ti ha portato a decidere così."
  ],
  risultato: [
    "Il risultato ottenuto: numeri, fatti, trasformazioni concrete.",
    "L'esito finale: cosa è successo dopo aver agito.",
    "Il risultato tangibile: la prova che il metodo funziona.",
    "La conseguenza positiva: il cambiamento misurabile ottenuto.",
    "Il traguardo raggiunto: i benefici concreti della decisione."
  ],
  ostacolo: [
    "L'ostacolo incontrato: cosa ha reso difficile il percorso.",
    "La sfida da superare: il problema che sembrava bloccare tutto.",
    "L'impedimento principale: cosa si frapponeva tra te e l'obiettivo.",
    "La barriera da abbattere: l'ostacolo che hai dovuto affrontare.",
    "Il problema critico: la difficoltà che ha messo alla prova tutto."
  ],
  puntoPartenza: [
    "La situazione iniziale del cliente: da dove è partito.",
    "Il punto di partenza: le condizioni prima della trasformazione.",
    "Lo stato iniziale: problemi, frustrazioni, limiti di partenza.",
    "Da dove siamo partiti: la fotografia della situazione precedente."
  ],
  punto_di_partenza: [
    "Il punto di partenza del percorso: la situazione originale.",
    "La condizione iniziale: cosa c'era prima del cambiamento.",
    "Lo scenario precedente: i problemi e le sfide di partenza.",
    "La situazione di base: dove tutto ha avuto inizio."
  ],
  azioni: [
    "Le azioni intraprese: cosa è stato fatto concretamente.",
    "I passi compiuti: le mosse strategiche che hanno fatto la differenza.",
    "Le attività svolte: cosa abbiamo implementato passo dopo passo.",
    "Le azioni chiave: le decisioni operative messe in pratica.",
    "Gli interventi realizzati: cosa è stato fatto per ottenere il risultato."
  ],
  cosaOdiavo: [
    "Cosa odiavo prima: le frustrazioni quotidiane che mi consumavano.",
    "Quello che non sopportavo più: il problema che mi tormentava.",
    "La cosa più frustrante: ciò che mi spingeva a cercare una soluzione.",
    "Cosa mi faceva impazzire: la situazione insostenibile di prima."
  ],
  cosa_odiavo: [
    "Cosa mi frustrava profondamente: il problema che volevo eliminare.",
    "La mia fonte di stress: ciò che rendeva tutto difficile.",
    "Quello che non funzionava: la situazione che doveva cambiare.",
    "Il disagio principale: cosa mi spingeva a cercare alternative."
  ],
  cosaCambiato: [
    "Cosa è cambiato: la trasformazione concreta avvenuta.",
    "Il cambiamento realizzato: prima vs dopo in modo tangibile.",
    "La differenza fondamentale: cosa è diverso adesso.",
    "La trasformazione ottenuta: il nuovo stato raggiunto."
  ],
  cosa_ho_cambiato: [
    "Cosa ho modificato: le azioni specifiche che hanno fatto la differenza.",
    "I cambiamenti implementati: cosa ho fatto diversamente.",
    "Le modifiche chiave: cosa ho cambiato nel mio approccio.",
    "La svolta nel metodo: cosa ho iniziato a fare in modo nuovo."
  ],
  comeFarlo: [
    "Come replicare il risultato: i passi da seguire per ottenere lo stesso.",
    "Come puoi farlo anche tu: la guida pratica per applicarlo.",
    "Il metodo per ottenerlo: le istruzioni concrete da seguire.",
    "Come arrivarci: la strada pratica verso lo stesso risultato."
  ],
  come_farlo: [
    "Come mettere in pratica: le azioni specifiche da compiere.",
    "Il percorso da seguire: come replicare questo successo.",
    "Le istruzioni operative: cosa fare per ottenere lo stesso.",
    "I passi pratici: come procedere concretamente."
  ],
  chiSono: [
    "Chi sono e perché puoi fidarti: la mia storia in breve.",
    "La mia presentazione: chi sono, cosa faccio, perché sono credibile.",
    "Il mio background: esperienza e risultati che mi qualificano.",
    "La mia storia: da dove vengo e cosa ho costruito."
  ],
  chi_sono: [
    "Chi sono: la mia identità professionale e il mio percorso.",
    "La mia presentazione personale: esperienza e credibilità.",
    "Il mio profilo: chi sono e perché posso aiutarti.",
    "La mia storia in sintesi: da dove vengo e dove ti porto."
  ],
  cosaHoImparato: [
    "La lezione che ho appreso: l'insight più importante.",
    "Cosa ho capito: la verità emersa dall'esperienza.",
    "L'apprendimento chiave: cosa so adesso che prima ignoravo.",
    "La scoperta fondamentale: ciò che ha cambiato la mia prospettiva."
  ],
  cosa_ho_imparato: [
    "Cosa mi ha insegnato questa esperienza: la lezione principale.",
    "L'insight emerso: la comprensione che ha cambiato tutto.",
    "La lezione appresa: cosa porto via da questa situazione.",
    "Quello che ho capito: la verità che adesso è chiara."
  ],
  miniStoria: [
    "Una mini-storia esemplificativa: il racconto breve che illustra il concetto.",
    "Un esempio narrativo: la storia che rende tutto più chiaro.",
    "Una breve storia reale: l'aneddoto che dimostra il punto.",
    "Il racconto che spiega: una storia concisa ma potente."
  ],
  mini_storia: [
    "Una piccola storia che chiarisce: l'esempio narrativo del concetto.",
    "Il micro-racconto illustrativo: una storia breve ma efficace.",
    "L'aneddoto esplicativo: la storia che fa capire meglio.",
    "Una storia in miniatura: il racconto che rende tangibile l'idea."
  ],
  // === ENGAGEMENT SECTIONS ===
  hotTake: [
    "L'opinione controversa: il punto di vista che divide le opinioni.",
    "La provocazione: l'affermazione che fa discutere.",
    "Il pensiero controcorrente: la tesi che sfida il senso comune.",
    "La posizione audace: l'idea che non tutti condivideranno.",
    "L'hot take: l'opinione forte che scatena reazioni."
  ],
  hot_take: [
    "Un'opinione che fa discutere: la posizione che polarizza.",
    "La tesi provocatoria: l'affermazione che non lascia indifferenti.",
    "Il punto di vista controverso: quello che molti pensano ma pochi dicono.",
    "L'opinione scomoda: la verità che disturba qualcuno."
  ],
  opinione: [
    "Il mio punto di vista deciso: cosa penso davvero su questo tema.",
    "La mia posizione netta: l'opinione che difendo con convinzione.",
    "Quello che credo fermamente: il mio pensiero senza mezzi termini.",
    "La mia visione: come vedo le cose e perché.",
    "Il mio parere forte: l'opinione che mi distingue."
  ],
  claim: [
    "L'affermazione audace: la tesi forte che sostengo.",
    "La dichiarazione coraggiosa: il claim che sfida lo status quo.",
    "L'affermazione potente: la verità che proclamo.",
    "Il mio claim: la posizione netta che prendo.",
    "La tesi principale: l'idea centrale che difendo."
  ],
  motivo: [
    "L'argomento a supporto: perché questa affermazione è vera.",
    "Il motivo fondamentale: la ragione principale dietro la tesi.",
    "L'argomentazione chiave: il ragionamento che sostiene tutto.",
    "La prova logica: perché questo è vero e verificabile."
  ],
  motivo1: [
    "Primo motivo: la ragione principale che supporta la tesi.",
    "Argomento #1: il primo pilastro della mia argomentazione.",
    "La prima ragione: perché questo è vero - parte 1.",
    "Il motivo iniziale: la base del ragionamento."
  ],
  motivo2: [
    "Secondo motivo: un'altra ragione che rafforza la tesi.",
    "Argomento #2: il secondo pilastro dell'argomentazione.",
    "La seconda ragione: un altro elemento a supporto.",
    "Ulteriore motivazione: cosa rinforza ancora il punto."
  ],
  perche: [
    "La motivazione profonda: perché questo è importante.",
    "La spiegazione: il ragionamento dietro l'affermazione.",
    "Il perché fondamentale: la ragione che sta alla base.",
    "La motivazione: cosa giustifica questa posizione.",
    "Il senso profondo: perché tutto questo conta."
  ],
  domandaFinale: [
    "La domanda che fa riflettere: l'interrogativo che resta in mente.",
    "La domanda per te: cosa ne pensi? Come la vedi?",
    "L'invito alla riflessione: la domanda che stimola il dialogo.",
    "La questione aperta: la domanda che invita alla risposta."
  ],
  domanda_finale: [
    "La domanda conclusiva: l'interrogativo che chiude e apre.",
    "La domanda per il lettore: cosa farai con questa informazione?",
    "L'ultima domanda: la riflessione finale da condividere.",
    "La domanda che chiude: l'invito al commento e alla discussione."
  ],
  recap: [
    "Riepilogo dei punti chiave: le idee principali in sintesi.",
    "In sintesi: i concetti fondamentali riassunti.",
    "I takeaway principali: cosa ricordare di questo contenuto.",
    "Ricapitolando: le lezioni più importanti in breve.",
    "Il riassunto finale: i punti salienti da portare via."
  ],
  ctaSoft: [
    "Una CTA morbida: invita a salvare, commentare o condividere.",
    "L'invito gentile: cosa puoi fare se questo ti è stato utile.",
    "CTA leggera: il passo successivo senza pressione.",
    "L'azione suggerita: cosa fare se vuoi approfondire."
  ],
  cta_soft: [
    "Invito discreto all'azione: se ti è piaciuto, ecco cosa puoi fare.",
    "CTA non invasiva: il modo gentile per restare in contatto.",
    "L'azione facile: un piccolo gesto se hai apprezzato.",
    "Suggerimento finale: cosa fare per non perderti i prossimi."
  ],
  prossimaMossa: [
    "Il prossimo step: cosa farai dopo aver letto questo?",
    "La mossa successiva: l'azione che ti consiglio di compiere.",
    "Il passo immediato: cosa puoi fare già da oggi.",
    "L'azione seguente: il primo passo verso il cambiamento."
  ],
  prossima_mossa: [
    "Cosa fare adesso: il prossimo passo concreto.",
    "L'azione da compiere: il movimento che ti porta avanti.",
    "Il passo da fare: cosa implementare subito.",
    "La mossa strategica: l'azione che fa la differenza."
  ],
  cosaStaiFacendo: [
    "Cosa sto facendo in questo momento: l'attività in corso.",
    "Il mio lavoro attuale: su cosa sto lavorando adesso.",
    "L'attività del momento: cosa mi impegna in questo periodo.",
    "Cosa sto costruendo: il progetto su cui sono concentrato."
  ],
  cosa_stai_facendo: [
    "L'attività in corso: cosa occupa il mio tempo adesso.",
    "Su cosa sto lavorando: il focus del momento.",
    "Il mio impegno attuale: cosa sto creando o sviluppando.",
    "L'attività corrente: il lavoro che mi coinvolge ora."
  ],
  cosaHaiFatto: [
    "Cosa ho fatto di recente: l'attività o risultato appena completato.",
    "L'azione compiuta: cosa ho realizzato ultimamente.",
    "Il risultato recente: cosa ho ottenuto in questo periodo.",
    "L'ultimo traguardo: cosa ho portato a termine di recente."
  ],
  cosa_hai_fatto: [
    "L'attività recente: cosa ho completato ultimamente.",
    "Il lavoro svolto: cosa ho realizzato nel periodo recente.",
    "L'azione portata a termine: cosa ho fatto e quali risultati.",
    "Il progresso fatto: cosa ho costruito o raggiunto di recente."
  ]
};

/**
 * Returns randomly selected instruction variants for each section
 * This creates variety in AI-generated content by varying the prompts
 */
function getRandomSectionInstructions(): Record<string, string> {
  const selected: Record<string, string> = {};
  
  for (const [section, variants] of Object.entries(SECTION_INSTRUCTION_VARIANTS)) {
    const randomIndex = Math.floor(Math.random() * variants.length);
    selected[section] = variants[randomIndex];
  }
  
  return selected;
}

export { SECTION_INSTRUCTION_VARIANTS, getRandomSectionInstructions };

/**
 * AI Compression - Shortens content that exceeds character limits while preserving meaning
 * @param content The original content to compress
 * @param targetLimit The target character limit
 * @param currentLength Current content length
 * @param consultantId The consultant ID for AI provider lookup
 * @returns Compressed content or original if compression fails
 */
async function compressContentWithAI(
  content: string,
  targetLimit: number,
  currentLength: number,
  consultantId: string
): Promise<{ compressed: string; success: boolean }> {
  try {
    const reductionPercent = Math.ceil(((currentLength - targetLimit) / currentLength) * 100);
    
    console.log(`[CONTENT-AI COMPRESS] Starting compression: ${currentLength} → ${targetLimit} chars (reduce by ${reductionPercent}%)`);
    
    const compressPrompt = `Riduci questo testo a MASSIMO ${targetLimit} caratteri (attualmente ${currentLength}, riduzione necessaria: ${reductionPercent}%).

REGOLE FONDAMENTALI:
- Mantieni il SIGNIFICATO e l'IMPATTO del messaggio
- Mantieni la STRUTTURA (hook → corpo → CTA)
- NON aggiungere nuove informazioni
- NON cambiare il tono o lo stile
- Rimuovi ripetizioni, frasi ridondanti, parole superflue
- Accorcia le frasi senza perdere chiarezza

TESTO DA COMPRIMERE:
${content}

RISPONDI SOLO con il testo compresso, nessuna spiegazione.`;

    const { model, generateContent } = await getAIProvider(consultantId, "content-compress");
    
    const result = await generateContent({
      contents: [{ role: "user", parts: [{ text: compressPrompt }] }],
      generationConfig: {
        temperature: 0.3, // Low temperature for consistent output
        maxOutputTokens: Math.ceil(targetLimit / 3),
      },
    });

    const response = result.response;
    const compressedText = response.text().trim();
    
    console.log(`[CONTENT-AI COMPRESS] Result: ${compressedText.length} chars (target: ${targetLimit})`);
    
    if (compressedText.length <= targetLimit) {
      console.log(`[CONTENT-AI COMPRESS] ✅ Success! Compressed from ${currentLength} to ${compressedText.length} chars`);
      return { compressed: compressedText, success: true };
    } else {
      console.log(`[CONTENT-AI COMPRESS] ⚠️ Still over limit: ${compressedText.length}/${targetLimit}`);
      return { compressed: compressedText, success: false };
    }
  } catch (error) {
    console.error("[CONTENT-AI COMPRESS] Error:", error);
    return { compressed: content, success: false };
  }
}

export interface ContentIdea {
  title: string;
  description: string;
  aiScore: number;
  aiReasoning: string;
  suggestedHook: string;
  suggestedCta: string;
  videoScript?: string;
  imageDescription?: string;
  imageOverlayText?: string;
  copyContent?: string;
  mediaType?: "video" | "photo";
  copyType?: "short" | "long";
  structuredContent?: StructuredContent;
  lengthWarning?: string;
}

export interface GenerateIdeasResult {
  ideas: ContentIdea[];
  modelUsed: string;
  tokensUsed?: number;
  topicId?: string;
}

export interface GeneratePostCopyParams {
  consultantId: string;
  idea: string;
  platform: Platform;
  brandVoice?: string;
  brandVoiceData?: {
    consultantDisplayName?: string;
    businessName?: string;
    businessDescription?: string;
    consultantBio?: string;
    vision?: string;
    mission?: string;
    values?: string[];
    usp?: string;
    whoWeHelp?: string;
    whoWeDontHelp?: string;
    whatWeDo?: string;
    howWeDoIt?: string;
    yearsExperience?: number;
    clientsHelped?: number;
    resultsGenerated?: string;
    softwareCreated?: { emoji: string; name: string; description: string }[];
    booksPublished?: { title: string; year: string }[];
    caseStudies?: { client: string; result: string }[];
    servicesOffered?: { name: string; price: string; description: string }[];
    guarantees?: string;
  };
  keywords?: string[];
  tone?: string;
  maxLength?: number;
}

export interface PostCopy {
  hook: string;
  target: string;
  problem: string;
  solution: string;
  proof: string;
  cta: string;
  fullCopy: string;
  hashtags?: string[];
  emojiLevel?: "none" | "minimal" | "moderate" | "heavy";
}

export interface GeneratePostCopyResult {
  copy: PostCopy;
  modelUsed: string;
  tokensUsed?: number;
}

export interface GenerateCampaignParams {
  consultantId: string;
  productOrService: string;
  targetAudience: string;
  objective: ContentObjective;
  budget?: string;
  duration?: string;
  uniqueSellingPoints?: string[];
  brandVoice?: string;
  brandVoiceData?: {
    consultantDisplayName?: string;
    businessName?: string;
    businessDescription?: string;
    consultantBio?: string;
    vision?: string;
    mission?: string;
    values?: string[];
    usp?: string;
    whoWeHelp?: string;
    whoWeDontHelp?: string;
    whatWeDo?: string;
    howWeDoIt?: string;
    yearsExperience?: number;
    clientsHelped?: number;
    resultsGenerated?: string;
    softwareCreated?: { emoji: string; name: string; description: string }[];
    booksPublished?: { title: string; year: string }[];
    caseStudies?: { client: string; result: string }[];
    servicesOffered?: { name: string; price: string; description: string }[];
    guarantees?: string;
  };
}

export interface CampaignHook {
  who: string;
  what: string;
  how: string;
  copy: string;
}

export interface CampaignTarget {
  demographics: {
    ageRange: string;
    gender: string;
    location: string;
    language: string;
  };
  interests: string[];
  behaviors: string[];
}

export interface CampaignProblem {
  mainProblem: string;
  consequences: string[];
  emotionalImpact: string;
}

export interface CampaignSolution {
  offer: string;
  benefits: string[];
  differentiators: string[];
}

export interface CampaignProof {
  testimonialStructure: string;
  numbers: string[];
  socialProof: string[];
}

export interface CampaignCTA {
  text: string;
  urgency: string;
  secondaryCta?: string;
}

export interface CampaignContent {
  hook: CampaignHook;
  target: CampaignTarget;
  problem: CampaignProblem;
  solution: CampaignSolution;
  proof: CampaignProof;
  cta: CampaignCTA;
  adCreative: {
    primaryText: string;
    headline: string;
    description: string;
  };
}

export interface GenerateCampaignResult {
  campaign: CampaignContent;
  modelUsed: string;
  tokensUsed?: number;
}

export interface GenerateImagePromptParams {
  consultantId: string;
  contentDescription: string;
  brandColors?: string[];
  style: ImageStyle;
  platform: Platform;
  aspectRatio?: "1:1" | "4:5" | "9:16" | "16:9";
  mood?: string;
  includeText?: boolean;
  textToInclude?: string;
}

export interface ImagePromptResult {
  prompt: string;
  negativePrompt: string;
  styleNotes: string;
  technicalSpecs: {
    aspectRatio: string;
    resolution: string;
    format: string;
  };
  modelUsed: string;
}

const lastCallTimestamps: Map<string, number> = new Map();
const MIN_CALL_INTERVAL_MS = 1000;

async function rateLimitCheck(consultantId: string): Promise<void> {
  const lastCall = lastCallTimestamps.get(consultantId) || 0;
  const now = Date.now();
  const timeSinceLastCall = now - lastCall;
  
  if (timeSinceLastCall < MIN_CALL_INTERVAL_MS) {
    const waitTime = MIN_CALL_INTERVAL_MS - timeSinceLastCall;
    await new Promise(resolve => setTimeout(resolve, waitTime));
  }
  
  lastCallTimestamps.set(consultantId, Date.now());
}

async function getBrandAssets(consultantId: string) {
  try {
    const [assets] = await db.select()
      .from(brandAssets)
      .where(eq(brandAssets.consultantId, consultantId))
      .limit(1);
    return assets || null;
  } catch (error) {
    console.error("[CONTENT-AI] Error fetching brand assets:", error);
    return null;
  }
}

// Helper function to build brand voice context from brandVoiceData
function buildBrandVoiceContext(brandVoiceData?: GenerateContentIdeasParams["brandVoiceData"]): string {
  if (!brandVoiceData) return "";
  
  const bv = brandVoiceData;
  const parts: string[] = [];
  
  if (bv.businessName) parts.push(`Azienda: ${bv.businessName}`);
  if (bv.consultantDisplayName) parts.push(`Consulente: ${bv.consultantDisplayName}`);
  if (bv.businessDescription) parts.push(`Descrizione: ${bv.businessDescription}`);
  if (bv.usp) parts.push(`USP: ${bv.usp}`);
  if (bv.vision) parts.push(`Vision: ${bv.vision}`);
  if (bv.mission) parts.push(`Mission: ${bv.mission}`);
  if (bv.values?.length) parts.push(`Valori: ${bv.values.join(", ")}`);
  if (bv.whoWeHelp) parts.push(`Target: ${bv.whoWeHelp}`);
  if (bv.whatWeDo) parts.push(`Servizi: ${bv.whatWeDo}`);
  if (bv.howWeDoIt) parts.push(`Metodo: ${bv.howWeDoIt}`);
  if (bv.yearsExperience) parts.push(`Esperienza: ${bv.yearsExperience} anni`);
  if (bv.clientsHelped) parts.push(`Clienti aiutati: ${bv.clientsHelped}+`);
  if (bv.resultsGenerated) parts.push(`Risultati: ${bv.resultsGenerated}`);
  if (bv.caseStudies?.length) {
    parts.push(`Case Studies: ${bv.caseStudies.map(cs => `${cs.client} - ${cs.result}`).join("; ")}`);
  }
  if (bv.servicesOffered?.length) {
    parts.push(`Offerta: ${bv.servicesOffered.map(s => `${s.name} (${s.price})`).join(", ")}`);
  }
  if (bv.guarantees) parts.push(`Garanzie: ${bv.guarantees}`);
  
  if (parts.length > 0) {
    return `\n\n🏢 BRAND VOICE & IDENTITÀ:\n${parts.join("\n")}`;
  }
  return "";
}

function buildCompleteBrandContext(assets: Awaited<ReturnType<typeof getBrandAssets>>): string {
  if (!assets) return '';
  
  const sections: string[] = [];
  
  if (assets.chiSono) {
    sections.push(`🧑‍💼 CHI SONO (usa queste informazioni per personalizzare il contenuto):
${assets.chiSono}`);
  }
  
  if (assets.noteForAi) {
    sections.push(`📝 ISTRUZIONI SPECIALI DELL'UTENTE (SEGUI RIGOROSAMENTE):
${assets.noteForAi}`);
  }
  
  if (assets.brandVoice) {
    sections.push(`🎤 TONO DI VOCE DEL BRAND:
${assets.brandVoice}`);
  }
  
  const keywords = assets.keywords as string[] | null;
  if (keywords && keywords.length > 0) {
    sections.push(`✅ PAROLE CHIAVE DA USARE: ${keywords.join(', ')}`);
  }
  
  const avoidWords = assets.avoidWords as string[] | null;
  if (avoidWords && avoidWords.length > 0) {
    sections.push(`❌ PAROLE DA EVITARE ASSOLUTAMENTE: ${avoidWords.join(', ')}`);
  }
  
  const colors: string[] = [];
  if (assets.primaryColor) colors.push(`Primario: ${assets.primaryColor}`);
  if (assets.secondaryColor) colors.push(`Secondario: ${assets.secondaryColor}`);
  if (assets.accentColor) colors.push(`Accento: ${assets.accentColor}`);
  if (colors.length > 0) {
    sections.push(`🎨 COLORI DEL BRAND (per descrizioni immagini): ${colors.join(', ')}`);
  }
  
  const socials: string[] = [];
  if (assets.instagramHandle) socials.push(`Instagram: @${assets.instagramHandle.replace('@', '')}`);
  if (assets.facebookPage) socials.push(`Facebook: ${assets.facebookPage}`);
  if (assets.linkedinPage) socials.push(`LinkedIn: ${assets.linkedinPage}`);
  if (socials.length > 0) {
    sections.push(`📱 SOCIAL HANDLES: ${socials.join(', ')}`);
  }
  
  if (sections.length === 0) return '';
  
  return `
═══════════════════════════════════════════════════════════
🔷 BRAND IDENTITY DEL CONSULENTE (ADATTA IL CONTENUTO A QUESTO)
═══════════════════════════════════════════════════════════

${sections.join('\n\n')}

═══════════════════════════════════════════════════════════
`;
}

function parseJsonResponse<T>(text: string, fallback: T): T {
  // Step 1: Basic cleanup
  let cleanedText = text
    .replace(/```json\n?/g, '')
    .replace(/```\n?/g, '')
    .trim();
  
  // Step 2: Try direct parse first
  try {
    return JSON.parse(cleanedText) as T;
  } catch (firstError) {
    console.log("[CONTENT-AI] Direct parse failed, trying cleanup strategies...");
  }
  
  // Step 3: Fix unescaped newlines inside string values
  try {
    const escapedText = cleanedText.replace(
      /"([^"\\]*(?:\\.[^"\\]*)*)"/g,
      (match) => {
        return match
          .replace(/\r\n/g, '\\n')
          .replace(/\n/g, '\\n')
          .replace(/\r/g, '\\n')
          .replace(/\t/g, '\\t');
      }
    );
    return JSON.parse(escapedText) as T;
  } catch {
    console.log("[CONTENT-AI] Escaped newlines parse failed, trying truncation repair...");
  }
  
  // Step 4: Handle truncated JSON (response cut off mid-stream)
  try {
    let repairedText = cleanedText;
    
    // Count open braces/brackets
    const openBraces = (repairedText.match(/{/g) || []).length;
    const closeBraces = (repairedText.match(/}/g) || []).length;
    const openBrackets = (repairedText.match(/\[/g) || []).length;
    const closeBrackets = (repairedText.match(/]/g) || []).length;
    
    // If truncated (more opens than closes), try to repair
    if (openBraces > closeBraces || openBrackets > closeBrackets) {
      console.log(`[CONTENT-AI] Detected truncation: braces ${openBraces}/${closeBraces}, brackets ${openBrackets}/${closeBrackets}`);
      
      // Find last complete object in ideas array
      const ideasMatch = repairedText.match(/"ideas"\s*:\s*\[/);
      if (ideasMatch) {
        // Find all complete idea objects
        const ideaObjects: string[] = [];
        let depth = 0;
        let currentStart = -1;
        let inString = false;
        let escapeNext = false;
        
        const startIdx = repairedText.indexOf('[', ideasMatch.index || 0);
        
        for (let i = startIdx + 1; i < repairedText.length; i++) {
          const char = repairedText[i];
          
          if (escapeNext) {
            escapeNext = false;
            continue;
          }
          
          if (char === '\\') {
            escapeNext = true;
            continue;
          }
          
          if (char === '"' && !escapeNext) {
            inString = !inString;
            continue;
          }
          
          if (inString) continue;
          
          if (char === '{') {
            if (depth === 0) currentStart = i;
            depth++;
          } else if (char === '}') {
            depth--;
            if (depth === 0 && currentStart !== -1) {
              ideaObjects.push(repairedText.substring(currentStart, i + 1));
              currentStart = -1;
            }
          }
        }
        
        if (ideaObjects.length > 0) {
          console.log(`[CONTENT-AI] Extracted ${ideaObjects.length} complete idea objects from truncated response`);
          const reconstructed = `{"ideas": [${ideaObjects.join(',')}]}`;
          return JSON.parse(reconstructed) as T;
        }
      }
    }
  } catch (repairError) {
    console.log("[CONTENT-AI] Truncation repair failed:", repairError);
  }
  
  // Step 5: Final aggressive cleanup
  try {
    let aggressiveClean = cleanedText
      .replace(/(?<!\\)\n/g, '\\n')
      .replace(/(?<!\\)\r/g, '')
      .replace(/[\x00-\x1F\x7F]/g, ''); // Remove control characters
    
    return JSON.parse(aggressiveClean) as T;
  } catch {
    console.error("[CONTENT-AI] All parsing strategies failed, returning fallback");
    console.error("[CONTENT-AI] Raw text (first 800 chars):", text.substring(0, 800));
    return fallback;
  }
}

const SOPHISTICATION_LEVEL_INSTRUCTIONS: Record<SophisticationLevel, { name: string; strategy: string; tone: string; focus: string }> = {
  level_1: {
    name: "Beneficio Diretto",
    strategy: "Sei il PRIMO sul mercato. Il pubblico non conosce soluzioni al problema. Comunica un claim semplice e diretto: 'Questo prodotto fa X'. Non servono prove elaborate, basta il beneficio chiaro.",
    tone: "Diretto, semplice, promettente, chiaro",
    focus: "Comunica il beneficio principale in modo diretto e immediato. Usa frasi come 'Finalmente puoi...', 'Ora è possibile...', 'Il primo metodo per...'."
  },
  level_2: {
    name: "Amplifica la Promessa",
    strategy: "Sei il SECONDO sul mercato. I competitor hanno già fatto claim simili. Devi amplificare la promessa: 'Più veloce', 'Più efficace', 'Risultati 2x'. Aggiungi prove e numeri specifici.",
    tone: "Competitivo, specifico, quantificato, provato",
    focus: "Amplifica con numeri, percentuali, confronti impliciti. Usa 'Il 47% più veloce', '3x i risultati', 'In soli 7 giorni invece di mesi'."
  },
  level_3: {
    name: "Meccanismo Unico",
    strategy: "Il mercato è SATURO di promesse amplificate. Tutti dicono 'il migliore'. Devi introdurre e spiegare il tuo MECCANISMO UNICO: perché il tuo metodo funziona quando gli altri falliscono.",
    tone: "Educativo, differenziante, tecnico ma accessibile, rivelatorio",
    focus: "Presenta il tuo meccanismo unico, il 'perché' funziona. Usa 'Il Metodo X', 'La Formula Y', 'Il Sistema Z che nessun altro usa'. Spiega COME funziona."
  },
  level_4: {
    name: "Meccanismo Migliorato",
    strategy: "La CONCORRENZA ha copiato meccanismi simili. Devi espandere e rendere più specifico il tuo meccanismo. Aggiungi dettagli, casi d'uso specifici, personalizzazione.",
    tone: "Esperto, dettagliato, personalizzato, evoluto",
    focus: "Espandi il meccanismo con dettagli specifici: 'Il Metodo X versione 3.0 per [target specifico]', 'Ora con 5 nuove tecniche per...'. Mostra evoluzione e specializzazione."
  },
  level_5: {
    name: "Identità e Brand",
    strategy: "Il mercato è SCETTICO. Hanno visto tutto, promesse, meccanismi, prove. L'unica differenziazione è l'IDENTITÀ e il BRAND. Vendi chi sei, i tuoi valori, la connessione emotiva.",
    tone: "Autentico, emotivo, valoriale, esclusivo, identitario",
    focus: "Focus su chi sei, i tuoi valori, la community. Usa 'Per chi crede in...', 'Se sei uno di noi...', 'La famiglia di [brand]'. Crea appartenenza, non solo benefici."
  }
};

const AWARENESS_LEVEL_INSTRUCTIONS: Record<AwarenessLevel, { name: string; strategy: string; tone: string; focus: string }> = {
  unaware: {
    name: "Non Consapevole",
    strategy: "Il pubblico NON sa di avere un problema. Devi risvegliare la consapevolezza con contenuti che fanno riflettere, storie di trasformazione, e 'aha moments' che illuminano un problema nascosto.",
    tone: "Curioso, provocatorio, educativo, storytelling",
    focus: "Fai emergere il problema che non sanno di avere. Usa domande retoriche, statistiche sorprendenti, storie di chi era nella stessa situazione."
  },
  problem_aware: {
    name: "Consapevole del Problema",
    strategy: "Il pubblico SENTE un disagio ma non conosce soluzioni. Devi amplificare il dolore, validare i loro sentimenti, e introdurre l'idea che esiste una via d'uscita.",
    tone: "Empatico, comprensivo, agitante, speranzoso",
    focus: "Valida il problema, amplifica le conseguenze di non risolverlo, accenna che una soluzione esiste. Usa 'Anche tu ti senti così?' e 'Sai cosa significa quando...'."
  },
  solution_aware: {
    name: "Consapevole della Soluzione",
    strategy: "Il pubblico conosce le soluzioni ma NON la tua. Devi differenziarti dalla concorrenza, mostrare il tuo approccio unico, e posizionarti come la scelta migliore.",
    tone: "Autoritario, differenziante, educativo, comparativo",
    focus: "Evidenzia cosa rende il tuo metodo/prodotto DIVERSO. Usa case study, confronti (senza nominare competitor), e il tuo Unique Selling Point."
  },
  product_aware: {
    name: "Consapevole del Prodotto",
    strategy: "Il pubblico conosce il tuo prodotto ma NON è ancora convinto. Devi rimuovere obiezioni, costruire fiducia, e mostrare prove sociali concrete.",
    tone: "Rassicurante, testimonial-driven, FAQ-style, trust-building",
    focus: "Rispondi alle obiezioni comuni, mostra testimonianze e risultati, offri garanzie. Usa 'Ecco cosa dicono i clienti...' e 'La domanda più comune è...'."
  },
  most_aware: {
    name: "Più Consapevole (Pronto all'Acquisto)",
    strategy: "Il pubblico DESIDERA il tuo prodotto e aspetta l'offerta giusta. Devi creare urgenza, presentare offerte irresistibili, e facilitare l'azione immediata.",
    tone: "Urgente, diretto, offerta-focused, action-oriented",
    focus: "Crea scarsità e urgenza, presenta offerte speciali, bonus esclusivi, deadline. Usa 'Solo per oggi...', 'Ultimi posti...', 'Bonus esclusivo se agisci ora...'."
  }
};

// ============================================================
// HOOK PATTERN ROTATION SYSTEM
// ============================================================

export type HookPatternType = 
  | "domanda" 
  | "statistica" 
  | "storia" 
  | "controintuitivo" 
  | "problema" 
  | "curiosita" 
  | "social_proof" 
  | "us_vs_them" 
  | "urgenza" 
  | "provocazione";

interface HookPatternInfo {
  pattern: HookPatternType;
  name: string;
  instruction: string;
  example: string;
}

const HOOK_PATTERNS: HookPatternInfo[] = [
  {
    pattern: "domanda",
    name: "Domanda Provocatoria",
    instruction: "Inizia con una DOMANDA che sfida le convinzioni del lettore. La domanda deve provocare una reazione emotiva immediata: 'Non ci avevo pensato!' o 'Aspetta, davvero?'. Evita domande banali - punta a quelle che fanno riflettere.",
    example: "Stai davvero lavorando per il tuo sogno, o per quello di qualcun altro?"
  },
  {
    pattern: "statistica",
    name: "Statistica Scioccante",
    instruction: "Apri con un NUMERO o DATO statistico che sorprende. I numeri fermano lo scroll perché sono concreti. Usa percentuali, cifre specifiche, tempi. Il dato deve sembrare quasi incredibile ma credibile.",
    example: "Il 73% degli imprenditori fallisce entro 5 anni. E sai qual è l'errore #1?"
  },
  {
    pattern: "storia",
    name: "Mini Storia (Apertura)",
    instruction: "Inizia con l'apertura di una STORIA personale o di un cliente. Crea tensione e curiosità: inizia in medias res, nel momento critico. Il lettore deve voler sapere come finisce.",
    example: "3 anni fa stavo per chiudere tutto. Poi ho scoperto una cosa."
  },
  {
    pattern: "controintuitivo",
    name: "Affermazione Controintuitiva",
    instruction: "Fai un'affermazione che va CONTRO il pensiero comune del settore. Deve far pensare 'Impossibile!' o 'Finalmente qualcuno lo dice!'. Sfida i luoghi comuni e le best practice accettate.",
    example: "Lavorare meno ti fa guadagnare di più. Ecco perché."
  },
  {
    pattern: "problema",
    name: "Pain Point Diretto",
    instruction: "Colpisci subito il DOLORE specifico del target. Descrivi il problema con parole che il lettore usa nella sua testa. Deve pensare 'Parla proprio di me!'. Sii specifico, non generico.",
    example: "Ogni mattina ti svegli già stanco pensando a quel cliente impossibile."
  },
  {
    pattern: "curiosita",
    name: "Curiosity Gap",
    instruction: "Crea un GAP di curiosità che il lettore vuole colmare. Prometti una rivelazione, un segreto, qualcosa di nascosto. Non svelare tutto subito - fai venire voglia di leggere.",
    example: "C'è una cosa che i consulenti di successo non dicono mai ad alta voce."
  },
  {
    pattern: "social_proof",
    name: "Social Proof / Testimonianza",
    instruction: "Apri con un RISULTATO concreto o una testimonianza. Numeri specifici, nomi (anche inventati come struttura), trasformazioni misurabili. La prova sociale immediata costruisce credibilità.",
    example: "Marco ha triplicato i suoi clienti in 60 giorni. Ecco come."
  },
  {
    pattern: "us_vs_them",
    name: "Us vs Them (Contrasto)",
    instruction: "Crea un CONTRASTO netto tra due gruppi: chi capisce vs chi no, chi agisce vs chi aspetta, vecchio modo vs nuovo modo. Fai sentire il lettore parte del gruppo 'giusto'.",
    example: "Alcuni imprenditori lavorano 12 ore. Altri 4. La differenza? Non è il talento."
  },
  {
    pattern: "urgenza",
    name: "Urgenza / FOMO",
    instruction: "Crea senso di URGENZA o paura di perdere qualcosa (FOMO). Il tempo stringe, l'opportunità sta scappando, il mercato sta cambiando. Motiva ad agire ORA, non domani.",
    example: "Tra 6 mesi sarà troppo tardi. Ecco perché."
  },
  {
    pattern: "provocazione",
    name: "Affermazione Bold / Provocazione",
    instruction: "Fai un'affermazione AUDACE che prende posizione forte. Può essere controversa, può dividere - ma non lascia indifferenti. Mostra autorità e sicurezza nel tuo punto di vista.",
    example: "Il marketing digitale è morto. E chi non lo capisce sta perdendo soldi."
  }
];

/**
 * Returns a random hook pattern with Italian instructions
 * Use this to add variety to generated hooks
 */
export function getRandomHookPattern(): HookPatternInfo {
  const randomIndex = Math.floor(Math.random() * HOOK_PATTERNS.length);
  return HOOK_PATTERNS[randomIndex];
}

/**
 * Returns all available hook patterns
 */
export function getAllHookPatterns(): HookPatternInfo[] {
  return HOOK_PATTERNS;
}

// ============================================================
// CONTENT ANGLE ROTATION SYSTEM
// ============================================================

export interface ContentAngle {
  levaEmotiva: "paura" | "desiderio";
  approccio: "logico" | "emotivo";
  prospettiva: "prima_persona" | "terza_persona";
  stileNarrativo: "diretto" | "storytelling";
}

interface AngleDescription {
  levaEmotiva: { value: string; instruction: string };
  approccio: { value: string; instruction: string };
  prospettiva: { value: string; instruction: string };
  stileNarrativo: { value: string; instruction: string };
}

const ANGLE_OPTIONS = {
  levaEmotiva: [
    { value: "paura", instruction: "Usa la PAURA come leva: perdita, rischio, cosa succede se non agiscono, conseguenze negative dell'inazione." },
    { value: "desiderio", instruction: "Usa il DESIDERIO come leva: guadagno, opportunità, cosa ottengono se agiscono, visione positiva del futuro." }
  ],
  approccio: [
    { value: "logico", instruction: "Approccio LOGICO: usa dati, numeri, ragionamenti, prove concrete, step-by-step, argomentazioni razionali." },
    { value: "emotivo", instruction: "Approccio EMOTIVO: usa storie, emozioni, immagini vivide, connessione personale, empatia, sentimenti." }
  ],
  prospettiva: [
    { value: "prima_persona", instruction: "Scrivi in PRIMA PERSONA: 'Io ho scoperto...', 'La mia esperienza...', racconta dal tuo punto di vista, sii personale." },
    { value: "terza_persona", instruction: "Scrivi in TERZA PERSONA: 'I professionisti che...', 'Chi vuole...', parla del target o di casi esterni, sii osservatore." }
  ],
  stileNarrativo: [
    { value: "diretto", instruction: "Stile DIRETTO: vai al punto, niente giri di parole, frasi corte, affermazioni chiare, no storytelling." },
    { value: "storytelling", instruction: "Stile STORYTELLING: racconta una storia, crea tensione narrativa, usa personaggi, conflitto e risoluzione." }
  ]
};

/**
 * Returns a random combination of content angles
 * Creates unique perspective combinations for variety
 */
export function getRandomAngle(): { angle: ContentAngle; description: AngleDescription } {
  const randomPick = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
  
  const levaEmotiva = randomPick(ANGLE_OPTIONS.levaEmotiva);
  const approccio = randomPick(ANGLE_OPTIONS.approccio);
  const prospettiva = randomPick(ANGLE_OPTIONS.prospettiva);
  const stileNarrativo = randomPick(ANGLE_OPTIONS.stileNarrativo);
  
  return {
    angle: {
      levaEmotiva: levaEmotiva.value as "paura" | "desiderio",
      approccio: approccio.value as "logico" | "emotivo",
      prospettiva: prospettiva.value as "prima_persona" | "terza_persona",
      stileNarrativo: stileNarrativo.value as "diretto" | "storytelling"
    },
    description: {
      levaEmotiva: { value: levaEmotiva.value, instruction: levaEmotiva.instruction },
      approccio: { value: approccio.value, instruction: approccio.instruction },
      prospettiva: { value: prospettiva.value, instruction: prospettiva.instruction },
      stileNarrativo: { value: stileNarrativo.value, instruction: stileNarrativo.instruction }
    }
  };
}

/**
 * Builds a prompt section describing the selected hook pattern and angle
 */
export function buildHookPatternAndAnglePrompt(): { 
  hookPattern: HookPatternInfo; 
  angle: ReturnType<typeof getRandomAngle>;
  promptSection: string;
} {
  const hookPattern = getRandomHookPattern();
  const angle = getRandomAngle();
  
  const promptSection = `
🎣 PATTERN HOOK DA USARE: ${hookPattern.name}
${hookPattern.instruction}
📝 Esempio: "${hookPattern.example}"
⚠️ IMPORTANTE: L'hook DEVE essere MASSIMO 125 caratteri (limite Meta Ads - dopo 125 char appare "...Altro")

🎯 ANGOLI DEL CONTENUTO:
- Leva emotiva: ${angle.description.levaEmotiva.value.toUpperCase()} → ${angle.description.levaEmotiva.instruction}
- Approccio: ${angle.description.approccio.value.toUpperCase()} → ${angle.description.approccio.instruction}
- Prospettiva: ${angle.description.prospettiva.value.toUpperCase()} → ${angle.description.prospettiva.instruction}
- Stile: ${angle.description.stileNarrativo.value.toUpperCase()} → ${angle.description.stileNarrativo.instruction}

Combina il pattern hook "${hookPattern.name}" con gli angoli sopra per creare contenuto unico e variegato.
`;

  return { hookPattern, angle, promptSection };
}

// ============================================================
// MAX HOOK CHARACTER LIMIT (Meta Ads visibility)
// ============================================================
const MAX_HOOK_CHARS = 125; // Meta Ads shows only 125 chars before "...Altro"

function validateAndEnrichCopyLength(
  copyType: string | undefined,
  copyLength: number,
  platformCharLimit?: number
): string | undefined {
  // Use platform-specific limit, default to sensible fallbacks
  const longMaxLimit = platformCharLimit || 2200; // Instagram default
  const shortMaxLimit = Math.min(500, platformCharLimit || 500);
  
  if (copyType === "long") {
    if (copyLength < 1500) {
      return "Copy troppo corto (min 1500 caratteri)";
    }
    if (copyLength > longMaxLimit) {
      return `Copy troppo lungo (max ${longMaxLimit} caratteri)`;
    }
  } else if (copyType === "short") {
    if (copyLength < 200) {
      return "Copy troppo corto (min 200 caratteri)";
    }
    if (copyLength > shortMaxLimit) {
      return `Copy troppo lungo (max ${shortMaxLimit} caratteri)`;
    }
  }
  return undefined;
}

// ============================================================
// SISTEMA ANTI-RIPETIZIONE (come Email Nurturing 365)
// ============================================================

interface PreviousIdea {
  title: string;
  hook: string | null;
  description: string | null;
  platform: string | null;
}

interface PreviousPost {
  title: string | null;
  hook: string | null;
  fullCopy: string | null;
  platform: string | null;
}

async function fetchPreviousContent(consultantId: string): Promise<{
  ideas: PreviousIdea[];
  posts: PreviousPost[];
}> {
  try {
    // Recupera ultime 50 idee
    const ideas = await db.select({
      title: contentIdeas.title,
      hook: contentIdeas.suggestedHook,
      description: contentIdeas.description,
      platform: contentIdeas.targetPlatform,
    })
      .from(contentIdeas)
      .where(eq(contentIdeas.consultantId, consultantId))
      .orderBy(desc(contentIdeas.createdAt))
      .limit(50);

    // Recupera ultimi 30 post (draft, scheduled, published)
    const posts = await db.select({
      title: contentPosts.title,
      hook: contentPosts.hook,
      fullCopy: contentPosts.fullCopy,
      platform: contentPosts.platform,
    })
      .from(contentPosts)
      .where(and(
        eq(contentPosts.consultantId, consultantId),
        inArray(contentPosts.status, ['draft', 'scheduled', 'published'])
      ))
      .orderBy(desc(contentPosts.createdAt))
      .limit(30);

    return { ideas, posts };
  } catch (error) {
    console.error("[CONTENT-AI] Error fetching previous content:", error);
    return { ideas: [], posts: [] };
  }
}

// ============================================================
// PATTERN DETECTION SYSTEM - Analyze hook patterns for variety
// ============================================================

interface PatternAnalysis {
  pattern: string;
  count: number;
  percentage: number;
  examples: string[];
}

interface AngleAnalysis {
  angle: string;
  count: number;
  percentage: number;
}

interface ContentFingerprint {
  totalHooks: number;
  patterns: PatternAnalysis[];
  angles: AngleAnalysis[];
  overusedPatterns: string[];
  underusedPatterns: string[];
  overusedAngles: string[];
  underusedAngles: string[];
}

/**
 * Detects the pattern type of a hook based on heuristics
 */
function detectHookPattern(hook: string): string[] {
  const patterns: string[] = [];
  const hookLower = hook.toLowerCase().trim();
  
  // Pattern: Domanda (ends with ?)
  if (hook.trim().endsWith("?")) {
    patterns.push("domanda");
  }
  
  // Pattern: Statistica (contains numbers)
  if (/\d+/.test(hook)) {
    patterns.push("statistica");
  }
  
  // Pattern: Storia (narrative opening)
  if (/^(quando|c'era|era|un giorno|quella volta|ricordo|anni fa|tempo fa)/i.test(hookLower)) {
    patterns.push("storia");
  }
  
  // Pattern: Problema (negative/error focus)
  if (/(non|sbagliato|sbaglia|errore|errori|problema|problemi|fallimento|fallisci|perdere|perdi|evita)/i.test(hookLower)) {
    patterns.push("problema");
  }
  
  // Pattern: Provocazione (controversial/bold statement)
  if (/(smetti|basta|stop|la verità|nessuno ti dice|pochi sanno|segreto|quello che non|mai più)/i.test(hookLower)) {
    patterns.push("provocazione");
  }
  
  // Pattern: Social Proof (results/testimonials)
  if (/(clienti|risultati|testimonianza|ho aiutato|abbiamo|successo|trasformato|fatturato|cresciuto)/i.test(hookLower)) {
    patterns.push("social_proof");
  }
  
  // Pattern: Curiosità (intrigue/mystery)
  if (/(scopri|impara|ecco|il motivo|perché|come|cosa succede|sai che|sapevi)/i.test(hookLower)) {
    patterns.push("curiosita");
  }
  
  // Pattern: Lista/Numeri (numbered lists)
  if (/^(\d+|tre|quattro|cinque|sei|sette|otto|nove|dieci)\s/i.test(hookLower) || 
      /(i \d+ |le \d+ |gli \d+ )/i.test(hookLower)) {
    patterns.push("lista");
  }
  
  // Pattern: Comando diretto (imperative)
  if (/^(fai|smetti|inizia|prova|usa|crea|costruisci|evita|leggi|guarda|ascolta)/i.test(hookLower)) {
    patterns.push("comando");
  }
  
  // Pattern: Confessione (personal admission)
  if (/(confesso|ammetto|devo dire|non volevo|ho sbagliato|il mio errore)/i.test(hookLower)) {
    patterns.push("confessione");
  }
  
  // Default if no pattern detected
  if (patterns.length === 0) {
    patterns.push("generico");
  }
  
  return patterns;
}

/**
 * Detects the angle/perspective used in content
 */
function detectContentAngle(text: string): string[] {
  const angles: string[] = [];
  const textLower = text.toLowerCase();
  
  // Angle: Prima persona (personal experience)
  if (/(^io |ho |mio |mia |la mia |il mio |i miei |le mie |mi sono |quando ho )/i.test(textLower)) {
    angles.push("prima_persona");
  }
  
  // Angle: Terza persona (others' stories)
  if (/(lui |lei |i clienti|il cliente|un imprenditore|un professionista|molti |alcuni |chi )/i.test(textLower)) {
    angles.push("terza_persona");
  }
  
  // Angle: Leva paura (fear-based)
  if (/(paura|rischio|pericolo|attenzione|stai perdendo|non perdere|prima che|troppo tardi)/i.test(textLower)) {
    angles.push("leva_paura");
  }
  
  // Angle: Leva desiderio (desire-based)
  if (/(sogno|obiettivo|risultato|trasforma|immagina|finalmente|libero|libertà|successo)/i.test(textLower)) {
    angles.push("leva_desiderio");
  }
  
  // Angle: Educativo (teaching)
  if (/(ecco come|ti spiego|impara|passaggi|step|metodo|strategia|sistema|processo)/i.test(textLower)) {
    angles.push("educativo");
  }
  
  // Angle: Contrario (contrarian)
  if (/(contrario|opposto|invece|non è vero|mito|falso|credono che|pensano che)/i.test(textLower)) {
    angles.push("contrario");
  }
  
  // Angle: Urgente (urgency)
  if (/(adesso|ora|subito|oggi|non aspettare|urgente|ultimo|limitato|solo \d+)/i.test(textLower)) {
    angles.push("urgente");
  }
  
  return angles;
}

/**
 * Analyzes all hooks and content to create a fingerprint
 */
function analyzeContentFingerprint(hooks: string[]): ContentFingerprint {
  const ALL_PATTERNS = ["domanda", "statistica", "storia", "problema", "provocazione", 
                        "social_proof", "curiosita", "lista", "comando", "confessione", "generico"];
  const ALL_ANGLES = ["prima_persona", "terza_persona", "leva_paura", "leva_desiderio", 
                      "educativo", "contrario", "urgente"];
  
  const patternCounts: Record<string, { count: number; examples: string[] }> = {};
  const angleCounts: Record<string, number> = {};
  
  // Initialize counters
  ALL_PATTERNS.forEach(p => patternCounts[p] = { count: 0, examples: [] });
  ALL_ANGLES.forEach(a => angleCounts[a] = 0);
  
  // Analyze each hook
  for (const hook of hooks) {
    if (!hook) continue;
    
    const detectedPatterns = detectHookPattern(hook);
    const detectedAngles = detectContentAngle(hook);
    
    for (const pattern of detectedPatterns) {
      if (patternCounts[pattern]) {
        patternCounts[pattern].count++;
        if (patternCounts[pattern].examples.length < 2) {
          patternCounts[pattern].examples.push(hook.substring(0, 60) + (hook.length > 60 ? "..." : ""));
        }
      }
    }
    
    for (const angle of detectedAngles) {
      if (angleCounts[angle] !== undefined) {
        angleCounts[angle]++;
      }
    }
  }
  
  const totalHooks = hooks.filter(h => h).length;
  
  // Calculate percentages and sort patterns
  const patterns: PatternAnalysis[] = Object.entries(patternCounts)
    .map(([pattern, data]) => ({
      pattern,
      count: data.count,
      percentage: totalHooks > 0 ? Math.round((data.count / totalHooks) * 100) : 0,
      examples: data.examples
    }))
    .sort((a, b) => b.count - a.count);
  
  const angles: AngleAnalysis[] = Object.entries(angleCounts)
    .map(([angle, count]) => ({
      angle,
      count,
      percentage: totalHooks > 0 ? Math.round((count / totalHooks) * 100) : 0
    }))
    .sort((a, b) => b.count - a.count);
  
  // Determine overused (>30%) and underused (<10%) patterns
  const overusedPatterns = patterns
    .filter(p => p.percentage > 30 && p.pattern !== "generico")
    .map(p => p.pattern);
  
  const underusedPatterns = patterns
    .filter(p => p.percentage < 10 && p.pattern !== "generico")
    .map(p => p.pattern);
  
  const overusedAngles = angles
    .filter(a => a.percentage > 40)
    .map(a => a.angle);
  
  const underusedAngles = angles
    .filter(a => a.percentage < 15)
    .map(a => a.angle);
  
  return {
    totalHooks,
    patterns,
    angles,
    overusedPatterns,
    underusedPatterns,
    overusedAngles,
    underusedAngles
  };
}

/**
 * Translates pattern names to Italian descriptions
 */
function getPatternDescription(pattern: string): string {
  const descriptions: Record<string, string> = {
    domanda: "Domande dirette al lettore",
    statistica: "Numeri e statistiche",
    storia: "Aperture narrative/storytelling",
    problema: "Focus su errori e problemi",
    provocazione: "Affermazioni provocatorie",
    social_proof: "Prove sociali e risultati",
    curiosita: "Ganci di curiosità",
    lista: "Liste numerate",
    comando: "Comandi diretti/imperativi",
    confessione: "Confessioni personali",
    generico: "Hook generici"
  };
  return descriptions[pattern] || pattern;
}

/**
 * Translates angle names to Italian descriptions
 */
function getAngleDescription(angle: string): string {
  const descriptions: Record<string, string> = {
    prima_persona: "Prospettiva in prima persona (io, la mia esperienza)",
    terza_persona: "Prospettiva terza persona (i clienti, altri)",
    leva_paura: "Leva emotiva paura/rischio",
    leva_desiderio: "Leva emotiva desiderio/aspirazione",
    educativo: "Angolo educativo/didattico",
    contrario: "Angolo contrarian/sfida credenze",
    urgente: "Leva urgenza/scarsità"
  };
  return descriptions[angle] || angle;
}

function buildAntiRepetitionContext(
  ideas: PreviousIdea[],
  posts: PreviousPost[]
): string {
  if (ideas.length === 0 && posts.length === 0) {
    return "";
  }

  // Collect all hooks for pattern analysis
  const allHooks: string[] = [
    ...ideas.filter(i => i.hook).map(i => i.hook!),
    ...posts.filter(p => p.hook).map(p => p.hook!)
  ];
  
  // Analyze content fingerprint
  const fingerprint = analyzeContentFingerprint(allHooks);

  let context = `

=== ⚠️ CONTENUTI GIÀ ESISTENTI - VIETATO RIPETERE! ===
Questi contenuti sono GIÀ stati creati. Le nuove idee DEVONO essere COMPLETAMENTE DIVERSE.

`;

  // Elenco titoli idee (tutti)
  if (ideas.length > 0) {
    context += `📋 TITOLI IDEE GIÀ USATI (${ideas.length}):\n`;
    for (const idea of ideas) {
      context += `- "${idea.title}"${idea.platform ? ` [${idea.platform}]` : ''}\n`;
    }
    context += "\n";
  }

  // Elenco hook idee (primi 20)
  const hooksIdeas = ideas.filter(i => i.hook).slice(0, 20);
  if (hooksIdeas.length > 0) {
    context += `🎣 HOOK GIÀ USATI (${hooksIdeas.length}):\n`;
    for (const idea of hooksIdeas) {
      context += `- "${idea.hook}"\n`;
    }
    context += "\n";
  }

  // Elenco post pubblicati/schedulati
  const postsWithTitle = posts.filter(p => p.title);
  if (postsWithTitle.length > 0) {
    context += `📱 POST GIÀ CREATI/PUBBLICATI (${postsWithTitle.length}):\n`;
    for (const post of postsWithTitle) {
      context += `- "${post.title}"${post.platform ? ` [${post.platform}]` : ''}\n`;
    }
    context += "\n";
  }

  // Hook dai post (primi 15)
  const hooksFromPosts = posts.filter(p => p.hook).slice(0, 15);
  if (hooksFromPosts.length > 0) {
    context += `🎣 HOOK DAI POST (${hooksFromPosts.length}):\n`;
    for (const post of hooksFromPosts) {
      context += `- "${post.hook}"\n`;
    }
    context += "\n";
  }

  // ============================================================
  // NEW: Pattern Analysis & Variation Fingerprint
  // ============================================================
  if (fingerprint.totalHooks >= 3) {
    context += `
═══════════════════════════════════════════════════════════
🔬 ANALISI PATTERN CONTENUTI PRECEDENTI (${fingerprint.totalHooks} hook analizzati)
═══════════════════════════════════════════════════════════

`;
    
    // Show top 5 most used patterns
    const topPatterns = fingerprint.patterns.filter(p => p.count > 0).slice(0, 5);
    if (topPatterns.length > 0) {
      context += `📊 PATTERN PIÙ UTILIZZATI:\n`;
      for (const p of topPatterns) {
        const bar = "█".repeat(Math.min(10, Math.round(p.percentage / 10))) + "░".repeat(10 - Math.min(10, Math.round(p.percentage / 10)));
        context += `   ${bar} ${p.percentage}% - ${getPatternDescription(p.pattern)} (${p.count}x)\n`;
      }
      context += "\n";
    }
    
    // Show top angles used
    const topAngles = fingerprint.angles.filter(a => a.count > 0).slice(0, 4);
    if (topAngles.length > 0) {
      context += `🎯 ANGOLI/PROSPETTIVE PIÙ USATI:\n`;
      for (const a of topAngles) {
        context += `   • ${getAngleDescription(a.angle)} (${a.percentage}%)\n`;
      }
      context += "\n";
    }

    // ============================================================
    // Variation Fingerprint - What to avoid and prefer
    // ============================================================
    context += `
═══════════════════════════════════════════════════════════
🎲 FINGERPRINT VARIAZIONE - ISTRUZIONI SPECIFICHE
═══════════════════════════════════════════════════════════

`;

    // Overused patterns warning
    if (fingerprint.overusedPatterns.length > 0) {
      context += `⛔ PATTERN SOVRA-UTILIZZATI (EVITA!):\n`;
      for (const pattern of fingerprint.overusedPatterns) {
        const patternData = fingerprint.patterns.find(p => p.pattern === pattern);
        context += `   ❌ ${getPatternDescription(pattern).toUpperCase()} - Usato nel ${patternData?.percentage}% dei contenuti\n`;
        if (patternData?.examples && patternData.examples.length > 0) {
          context += `      Esempi già usati: "${patternData.examples[0]}"\n`;
        }
      }
      context += "\n";
    }

    // Underused patterns suggestion
    if (fingerprint.underusedPatterns.length > 0) {
      context += `✅ PATTERN SOTTO-UTILIZZATI (USA QUESTI!):\n`;
      for (const pattern of fingerprint.underusedPatterns.slice(0, 4)) {
        context += `   ✓ ${getPatternDescription(pattern)} - Quasi mai usato, PERFETTO per varietà!\n`;
      }
      context += "\n";
    }

    // Angle recommendations
    if (fingerprint.overusedAngles.length > 0 || fingerprint.underusedAngles.length > 0) {
      context += `🎭 RACCOMANDAZIONI ANGOLI/PROSPETTIVE:\n`;
      
      if (fingerprint.overusedAngles.length > 0) {
        for (const angle of fingerprint.overusedAngles) {
          context += `   ❌ EVITA: ${getAngleDescription(angle)} (troppo usato)\n`;
        }
      }
      
      if (fingerprint.underusedAngles.length > 0) {
        for (const angle of fingerprint.underusedAngles.slice(0, 3)) {
          context += `   ✓ PROVA: ${getAngleDescription(angle)} (raramente usato)\n`;
        }
      }
      context += "\n";
    }

    // Generate specific actionable instructions based on analysis
    context += `
💡 ISTRUZIONI SPECIFICHE PER QUESTA GENERAZIONE:
`;
    
    // Pattern-specific instructions
    if (fingerprint.patterns[0]?.pattern === "domanda" && fingerprint.patterns[0]?.percentage > 40) {
      context += `   → Gli ultimi hook usavano principalmente DOMANDE - USA affermazioni audaci, statistiche o storie!\n`;
    }
    if (fingerprint.patterns.find(p => p.pattern === "problema")?.percentage ?? 0 > 35) {
      context += `   → Molti hook parlano di ERRORI/PROBLEMI - PROVA hook di curiosità, social proof o lista!\n`;
    }
    if (fingerprint.patterns.find(p => p.pattern === "statistica")?.percentage ?? 0 > 30) {
      context += `   → Troppi hook con NUMERI - USA storytelling, provocazioni o confessioni personali!\n`;
    }
    
    // Angle-specific instructions  
    if ((fingerprint.angles.find(a => a.angle === "prima_persona")?.percentage ?? 0) > 50) {
      context += `   → Predomina la PRIMA PERSONA - PASSA a terza persona (parla dei tuoi clienti)!\n`;
    }
    if ((fingerprint.angles.find(a => a.angle === "leva_paura")?.percentage ?? 0) > 40) {
      context += `   → Troppa LEVA PAURA - USA leva desiderio, aspirazione e risultati positivi!\n`;
    }
    if ((fingerprint.angles.find(a => a.angle === "educativo")?.percentage ?? 0) > 45) {
      context += `   → Troppo contenuto EDUCATIVO - PROVA storie personali, provocazioni o social proof!\n`;
    }

    context += "\n";
  }

  // Regole anti-ripetizione (come Email Nurturing 365)
  context += `
═══════════════════════════════════════════════════════════
⛔ REGOLE ANTI-RIPETIZIONE OBBLIGATORIE
═══════════════════════════════════════════════════════════

1. TITOLI COMPLETAMENTE DIVERSI - NON usare parole chiave già presenti nei titoli sopra
2. HOOK DIVERSI - Nessun hook simile a quelli già usati (cambia struttura, domande, affermazioni)
3. ANGOLI NUOVI - Affronta l'argomento da prospettive NON ancora trattate
4. STRUTTURE VARIATE - Se le idee precedenti usano domande, usa affermazioni e viceversa
5. METAFORE ORIGINALI - NON riutilizzare analogie/esempi già presenti
6. PATTERN ROTATION - Alterna tra i pattern elencati sopra per massima varietà

🎯 OBIETTIVO: Ogni nuova idea deve sembrare FRESCA e ORIGINALE, come se fosse la prima volta che ne parli.
`;

  return context;
}

export async function generateContentIdeas(params: GenerateIdeasParams): Promise<GenerateIdeasResult> {
  const { consultantId, niche, targetAudience, objective, additionalContext, count = 3, mediaType = "photo", copyType = "short", awarenessLevel = "problem_aware", sophisticationLevel = "level_3" } = params;
  const { targetPlatform, postCategory, postSchema, schemaStructure, schemaLabel, charLimit, writingStyle = "default", customWritingInstructions } = params;
  
  // ==================== DEBUG COMPLETO - INIZIO ====================
  console.log(`\n[CONTENT-AI] ╔══════════════════════════════════════════════════════════════╗`);
  console.log(`[CONTENT-AI] ║         generateContentIdeas CALLED - FULL PARAMS            ║`);
  console.log(`[CONTENT-AI] ╠══════════════════════════════════════════════════════════════╣`);
  console.log(`[CONTENT-AI] ║ consultantId: ${consultantId}`);
  console.log(`[CONTENT-AI] ║ count: ${count}`);
  console.log(`[CONTENT-AI] ╠═══════════ PARAMETRI CRITICI ═══════════════════════════════╣`);
  console.log(`[CONTENT-AI] ║ mediaType: "${mediaType}" (default: "photo")`);
  console.log(`[CONTENT-AI] ║ copyType: "${copyType}" (default: "short")`);
  console.log(`[CONTENT-AI] ║ targetPlatform: "${targetPlatform}"`);
  console.log(`[CONTENT-AI] ║ charLimit: ${charLimit}`);
  console.log(`[CONTENT-AI] ║ writingStyle: "${writingStyle}"`);
  console.log(`[CONTENT-AI] ╠═══════════ SCHEMA ══════════════════════════════════════════╣`);
  console.log(`[CONTENT-AI] ║ postCategory: "${postCategory}"`);
  console.log(`[CONTENT-AI] ║ postSchema: "${postSchema}"`);
  console.log(`[CONTENT-AI] ║ schemaLabel: "${schemaLabel}"`);
  console.log(`[CONTENT-AI] ║ schemaStructure: ${schemaStructure ? `"${schemaStructure.substring(0, 100)}..."` : "undefined"}`);
  console.log(`[CONTENT-AI] ╠═══════════ AWARENESS & SOPHISTICATION ══════════════════════╣`);
  console.log(`[CONTENT-AI] ║ awarenessLevel: "${awarenessLevel}"`);
  console.log(`[CONTENT-AI] ║ sophisticationLevel: "${sophisticationLevel}"`);
  console.log(`[CONTENT-AI] ╠═══════════ CUSTOM ══════════════════════════════════════════╣`);
  console.log(`[CONTENT-AI] ║ customWritingInstructions: ${customWritingInstructions ? `"${customWritingInstructions.substring(0, 50)}..."` : "undefined"}`);
  console.log(`[CONTENT-AI] ║ brandVoiceData: ${params.brandVoiceData ? "PRESENT" : "undefined"}`);
  console.log(`[CONTENT-AI] ║ kbContent: ${params.kbContent ? `${params.kbContent.length} chars` : "undefined"}`);
  console.log(`[CONTENT-AI] ╚══════════════════════════════════════════════════════════════╝\n`);
  // ==================== DEBUG COMPLETO - FINE ====================
  
  await rateLimitCheck(consultantId);
  
  // SISTEMA ANTI-RIPETIZIONE: Recupera contenuti precedenti
  const { ideas: previousIdeas, posts: previousPosts } = await fetchPreviousContent(consultantId);
  const antiRepetitionContext = buildAntiRepetitionContext(previousIdeas, previousPosts);
  console.log(`[CONTENT-AI] Anti-ripetizione: ${previousIdeas.length} idee + ${previousPosts.length} post caricati`);
  
  // Fetch topic details if topicId is provided
  let topicContext = "";
  let fetchedTopicId: string | undefined;
  if (params.topicId) {
    try {
      const [topic] = await db
        .select()
        .from(contentTopics)
        .where(eq(contentTopics.id, params.topicId))
        .limit(1);
      
      if (topic) {
        fetchedTopicId = topic.id;
        const keywordsStr = topic.keywords && topic.keywords.length > 0 
          ? topic.keywords.join(", ") 
          : "Non specificate";
        
        topicContext = `

🎯 ARGOMENTO SPECIFICO DA SVILUPPARE:
- Nome: ${topic.name}
- Categoria: ${topic.pillar || "Non specificata"}
- Descrizione: ${topic.description || "Non specificata"}
- Keywords: ${keywordsStr}
- Note: ${topic.notes || "Nessuna"}

IMPORTANTE: Sviluppa il contenuto ESCLUSIVAMENTE su questo argomento specifico. Ogni idea generata deve essere focalizzata su "${topic.name}" e seguire le indicazioni del topic.`;
        
        console.log(`[CONTENT-AI] Topic selezionato: "${topic.name}" (ID: ${topic.id})`);
      } else {
        console.log(`[CONTENT-AI] Topic con ID ${params.topicId} non trovato`);
      }
    } catch (error) {
      console.error(`[CONTENT-AI] Errore nel recupero del topic:`, error);
    }
  }
  
  const assets = await getBrandAssets(consultantId);
  const brandContext = buildCompleteBrandContext(assets);

  const brandVoiceContext = buildBrandVoiceContext(params.brandVoiceData);

  let kbContext = "";
  if (params.kbContent && params.kbContent.trim().length > 0) {
    kbContext = `\n\n📚 KNOWLEDGE BASE (usa questi contenuti come riferimento):\n${params.kbContent}`;
  }

  const awarenessInfo = AWARENESS_LEVEL_INSTRUCTIONS[awarenessLevel];
  const sophisticationInfo = SOPHISTICATION_LEVEL_INSTRUCTIONS[sophisticationLevel];

  // Build platform context (schema structure is now handled dynamically in getStructuredContentInstructions)
  let platformSchemaContext = "";
  // Detect educational mode for formazione category
  const isEducationalMode = postCategory === "formazione";
  
  if (targetPlatform || postSchema) {
    const platformNames: Record<string, string> = { instagram: "Instagram", x: "X (Twitter)", linkedin: "LinkedIn" };
    const categoryNames: Record<string, string> = { ads: "Inserzioni (Ads)", valore: "Post di Valore", formazione: "Contenuto Formativo", altri: "Altri Post" };
    
    // Educational mode instructions - removes all sales language
    const educationalModeInstructions = isEducationalMode ? `

🎓 MODALITÀ EDUCATIVA ATTIVA - REGOLE FONDAMENTALI:
⚠️ QUESTO È UN CONTENUTO FORMATIVO PURO - NON È UN POST DI VENDITA

COSA FARE:
- Insegna un concetto, una tecnica o un principio UNIVERSALE
- Condividi conoscenza che il lettore può applicare SUBITO, indipendentemente da te
- Spiega il "perché" dietro le cose, non solo il "cosa"
- Usa esempi pratici e replicabili da chiunque
- Offri valore GRATUITO senza aspettarti nulla in cambio
- Tono da insegnante generoso che vuole davvero aiutare

COSA NON FARE:
- MAI menzionare "il mio metodo", "la mia tecnica", "il mio sistema"
- MAI fare riferimento ai tuoi servizi, corsi o offerte
- MAI usare linguaggio di vendita mascherato da educazione
- MAI creare scarsità o urgenza ("solo per pochi", "prima che sia tardi")
- MAI posizionarti come "l'unico che può aiutarti"
- EVITA CTA commerciali - se serve una CTA, usa solo "Salva questo post" o "Condividi con chi ne ha bisogno"

TONO CORRETTO:
"Ecco come funziona..." invece di "Ecco come io faccio..."
"Questo principio spiega..." invece di "Il mio metodo si basa su..."
"Un errore comune è..." invece di "I miei clienti prima sbagliavano..."
"Prova a fare così..." invece di "Contattami per sapere come..."
` : "";
    
    platformSchemaContext = `

📱 PIATTAFORMA TARGET: ${platformNames[targetPlatform || "instagram"] || targetPlatform}
📝 TIPO POST: ${categoryNames[postCategory || "valore"] || postCategory}
🔢 LIMITE CARATTERI: ${charLimit || 2200} caratteri MAX per il copy principale
${schemaLabel ? `📋 SCHEMA SELEZIONATO: ${schemaLabel}` : ""}${educationalModeInstructions}`;
  }

  // Generate writing style prompt section - prominently placed in main prompt
  const getWritingStylePromptSection = (): string => {
    // REGOLA UNIVERSALE per tutti gli stili
    const universalRule = `
🎯 REGOLA FONDAMENTALE (VALE PER TUTTI GLI STILI):
Scrivi come parla una persona normale. Il testo deve SCORRERE naturalmente, essere FACILE da leggere e PIACEVOLE da seguire.
- MAI suonare robotico, forzato o artificiale
- Le frasi devono fluire l'una nell'altra come in una conversazione
- Evita costruzioni rigide che spezzano il ritmo
- Se rileggendo il testo "suona strano", riscrivilo più semplice

📝 FORMATTAZIONE OBBLIGATORIA:
- NON creare muri di testo! Il copy deve essere ARIOSO e facile da leggere
- Separa i concetti con RIGHE VUOTE (\\n\\n) ogni 2-3 frasi
- Inserisci "pattern interrupts" ogni tanto: frasi brevissime tipo "E sai cosa?", "Ma aspetta.", "Ecco il punto."
- Usa frecce → per elenchi o punti chiave invece di paragrafi densi
- Le sezioni devono respirare: hook separato, problema separato, soluzione separata
- Il risultato finale deve essere un post FLUIDO e NATURALE, non robotico

⚠️ LIMITE CARATTERI - USALO BENE:
- Per copy LUNGO: usa ALMENO il 70-80% dello spazio (es. 1500-1800 char su 2200)
- Per copy CORTO: 150-400 caratteri sono sufficienti
- NON superare il limite massimo della piattaforma
- Ma NON essere troppo stringato - sviluppa le idee, racconta storie, dai valore
`;
    
    const styleMap: Record<string, { name: string; instructions: string }> = {
      default: {
        name: "Predefinito",
        instructions: `Scrivi in modo naturale e scorrevole, come se stessi spiegando qualcosa a un collega.
- Tono professionale ma accessibile, mai pomposo
- Frasi che scorrono naturalmente, alternate tra brevi e medie
- Emoji solo dove aggiungono valore (non più di 4-5)
- Vai dritto al punto ma con garbo`
      },
      conversational: {
        name: "Conversazionale (Nurturing)",
        instructions: `Scrivi come se stessi raccontando qualcosa a un amico. Naturale, personale, coinvolgente.

=== FORMATO OBBLIGATORIO: UNA FRASE PER RIGA ===
Ogni frase va a capo (usa \\n dopo ogni frase).
Non scrivere paragrafi lunghi - il testo deve "respirare".

TONO: Caldo e diretto, come una chiacchierata tra persone che si conoscono.

COME SCRIVERE:
- Storytelling personale: racconta esperienze vere, aneddoti, errori
- Fai domande che il lettore si sta già facendo
- Usa il "tu" e il "io" liberamente
- Inserisci pensieri tra virgolette ("E lì ho capito una cosa...")
- Pattern interrupt naturali: "Pensaci un attimo.", "E sai cosa?", "Ecco il punto."
- Usa → per mini-elenchi (non elenchi puntati tradizionali)

STRUTTURA:
1. Hook: inizia con qualcosa di personale o inaspettato
2. Sviluppo: racconta come lo spiegheresti a voce, riga per riga
3. Chiusura: CTA semplice e diretta

ESEMPIO DI FORMATO CORRETTO:
Ti racconto una cosa che mi è successa.

Stavo parlando con un cliente.

Mi dice: "Ma come faccio a sapere se funziona?"

E lì ho capito.

Il problema non era il metodo.

Era la fiducia.

Perché quando non hai mai visto risultati, è normale dubitare.

Pensaci un attimo.

Se qualcuno ti promette qualcosa senza mostrarti i numeri...

...perché dovresti credergli?

→ La differenza è smettere di sperare
→ E iniziare a misurare

Ti faccio vedere come.

EVITA:
- Paragrafi lunghi (più frasi sulla stessa riga)
- Tono formale o accademico
- Pattern troppo ripetitivi che suonano robotici`
      },
      direct: {
        name: "Diretto",
        instructions: `Vai al sodo. Niente giri di parole, niente premesse infinite.
- Frasi chiare e concise
- Punti chiave ben evidenziati
- Tono sicuro ma non arrogante
- Meno parole, più sostanza
- Ogni frase deve avere un motivo per esistere`
      },
      persuasive: {
        name: "Copy Persuasivo",
        instructions: `Copywriting che convince senza sembrare "da venditore".
- Evidenzia il problema che risolvi
- Mostra i benefici concreti, non le caratteristiche
- Usa prove sociali in modo naturale (risultati, testimonianze)
- Crea senso di opportunità, non di urgenza forzata
- Chiudi con una call-to-action chiara
- Evita toni aggressivi o "da televendita"`
      },
      custom: {
        name: "Personalizzato",
        instructions: customWritingInstructions || "Segui le istruzioni personalizzate dell'utente."
      }
    };

    const style = styleMap[writingStyle] || styleMap.default;
    
    return `${universalRule}
✍️ STILE DI SCRITTURA SELEZIONATO: ${style.name}
${style.instructions}
`;
  };

  const writingStyleSection = getWritingStylePromptSection();

  const getStructuredContentInstructions = () => {
    const imageFields = mediaType === "photo" ? `,
  "imageDescription": "Descrizione visiva dettagliata dell'immagine: soggetto, sfondo, colori, mood, stile fotografico",
  "imageOverlayText": "Testo breve e d'impatto da sovrapporre all'immagine (max 10 parole)"` : "";
    
    const effectiveCharLimit = charLimit || 2200;
    const isLongCopy = copyType === "long";
    const isVideo = mediaType === "video";
    
    // Target with 10% safety margin - AI aims for this, validation uses real limit
    const targetCharLimit = Math.floor(effectiveCharLimit * 0.90);
    
    // Get dynamic section instructions for variety in AI output
    const sectionVariants = getRandomSectionInstructions();
    console.log(`[CONTENT-AI VARIANTS] Using dynamic section variants:`, Object.keys(sectionVariants).map(k => `${k}: "${sectionVariants[k].substring(0, 40)}..."`).join(", "));
    
    // Calculate character ranges based on copyType and charLimit (for display only, no strict minimum)
    const minChars = isLongCopy ? Math.floor(targetCharLimit * 0.5) : 100; // Soft minimum, much lower
    const maxChars = targetCharLimit; // Use target, not full limit
    
    // Writing style instructions based on selected style - SIMPLIFIED for natural flow
    const writingStyleInstructions: Record<string, string> = {
      default: `STILE PREDEFINITO:
- Scrivi in modo naturale e scorrevole
- Tono professionale ma accessibile
- Emoji solo dove aggiungono valore`,
      conversational: `STILE CONVERSAZIONALE (RIGA PER RIGA):
- UNA FRASE PER RIGA (vai a capo dopo ogni frase)
- Storytelling personale, racconta esperienze
- Pattern interrupt: "Pensaci.", "E sai cosa?"
- Usa → per mini-elenchi
- Tono naturale, mai robotico`,
      direct: `STILE DIRETTO:
- Vai al sodo, niente giri di parole
- Frasi chiare e concise
- Tono sicuro ma non arrogante`,
      persuasive: `STILE PERSUASIVO:
- Evidenzia benefici concreti
- Usa prove e risultati
- Chiudi con call-to-action chiara
- Evita toni "da televendita"`,
      custom: customWritingInstructions || "Segui le istruzioni personalizzate dell'utente."
    };

    // Style instructions based on copyType + writingStyle
    const styleInstructions = isLongCopy 
      ? `STILE COPY LUNGO:
- Ogni sezione deve essere sviluppata in modo narrativo e approfondito
- Il copy TOTALE deve essere tra ${minChars}-${maxChars} caratteri
- Separa i pensieri all'interno di ogni blocco con righe vuote

${writingStyleInstructions[writingStyle] || writingStyleInstructions.default}`
      : `STILE COPY CORTO:
- Il copy TOTALE deve essere tra ${minChars}-${maxChars} caratteri
- Dritto al punto, ogni parola deve contare
- Massimo 3-4 blocchi di testo totali

${writingStyleInstructions[writingStyle] || writingStyleInstructions.default}`;

    // Generate dynamic structure based on schemaStructure if provided
    if (schemaStructure) {
      const schemaParts = schemaStructure.split("|").map(s => s.trim());
      const numSections = schemaParts.length;
      
      // DEBUG: Log schema dinamico - STRATEGIA SEMPLIFICATA (solo limite totale)
      console.log(`[CONTENT-AI SCHEMA DEBUG] ========================================`);
      console.log(`[CONTENT-AI SCHEMA DEBUG] Schema dinamico - SOLO LIMITE TOTALE`);
      console.log(`[CONTENT-AI SCHEMA DEBUG]   schemaStructure: "${schemaStructure}"`);
      console.log(`[CONTENT-AI SCHEMA DEBUG]   numSections: ${numSections}`);
      console.log(`[CONTENT-AI SCHEMA DEBUG]   charLimit: ${effectiveCharLimit}`);
      console.log(`[CONTENT-AI SCHEMA DEBUG]   copyType: ${copyType}`);
      console.log(`[CONTENT-AI SCHEMA DEBUG] ========================================`);
      
      // Create field names from schema parts - ENSURE UNIQUE NAMES
      const usedNames: Record<string, number> = {};
      const fieldNames = schemaParts.map((part, idx) => {
        let baseName = part.toLowerCase()
          .replace(/[^a-z0-9\s]/g, '')
          .replace(/\s+/g, '_')
          .replace(/_+/g, '_')
          .replace(/^_|_$/g, '') || `section_${idx + 1}`;
        
        if (usedNames[baseName] !== undefined) {
          usedNames[baseName]++;
          baseName = `${baseName}_${usedNames[baseName]}`;
        } else {
          usedNames[baseName] = 1;
        }
        return baseName;
      });
      
      // Istruzioni SEMPLICI per ogni sezione - NO limiti per sezione
      const sectionInstructions = schemaParts.map((part, idx) => {
        const fieldName = fieldNames[idx];
        const guideline = getRandomSectionGuideline(fieldName, part);
        return `**${idx + 1}. ${fieldName}** (${part}): ${guideline.instruction}`;
      }).join("\n");
      
      // Simple JSON structure
      const dynamicFields = fieldNames.map((fieldName, idx) => {
        return `  "${fieldName}": "Contenuto per: ${schemaParts[idx]}"`;
      }).join(",\n");
      
      const videoFields = isVideo ? `,
  "fullScript": "Script parlato fluido. USA [PAUSA] per pause drammatiche."` : "";
      
      // Use targetCharLimit (90% margin) for AI instructions, effectiveCharLimit for validation
      const aiTargetLimit = targetCharLimit;
      
      return `
📋 SCHEMA: "${schemaLabel || 'Schema personalizzato'}"
📐 STRUTTURA: ${schemaParts.join(" → ")}

SEZIONI DA COMPILARE:
${sectionInstructions}

**structuredContent** (JSON):
{
  "type": "${isVideo ? 'video_script' : (isLongCopy ? 'copy_long' : 'copy_short')}",
  "copyVariant": "${copyType}",
  "schemaUsed": "${postSchema}",
${dynamicFields},
  "captionCopy": "Testo completo che unisce tutte le sezioni sopra",
  "hashtags": ["hashtag1", "hashtag2", "hashtag3"]${imageFields}${videoFields}
}

${styleInstructions}

📏 LUNGHEZZA TARGET: circa ${aiTargetLimit} caratteri
- Per copy ${isLongCopy ? 'LUNGO' : 'CORTO'}: punta a ${aiTargetLimit} caratteri per "captionCopy"
- Non superare MAI ${effectiveCharLimit} caratteri (limite ${targetPlatform?.toUpperCase() || 'INSTAGRAM'})
${isVideo ? `
IMPORTANTE per fullScript (video):
- Scritto per essere DETTO A VOCE, frasi corte e incisive
- Inserisci [PAUSA] dove vuoi pause drammatiche` : ""}`;
    }
    
    // Fallback to default structure when no schemaStructure is provided (schema "originale")
    // DEBUG: Log quando usa schema Originale
    console.log(`[CONTENT-AI ORIGINALE DEBUG] ========================================`);
    console.log(`[CONTENT-AI ORIGINALE DEBUG] Usando schema ORIGINALE (no schemaStructure)`);
    console.log(`[CONTENT-AI ORIGINALE DEBUG]   charLimit (input): ${charLimit}`);
    console.log(`[CONTENT-AI ORIGINALE DEBUG]   effectiveCharLimit: ${effectiveCharLimit}`);
    console.log(`[CONTENT-AI ORIGINALE DEBUG]   isLongCopy: ${isLongCopy}`);
    console.log(`[CONTENT-AI ORIGINALE DEBUG]   isVideo: ${isVideo}`);
    console.log(`[CONTENT-AI ORIGINALE DEBUG]   minChars: ${minChars}`);
    console.log(`[CONTENT-AI ORIGINALE DEBUG]   maxChars: ${maxChars}`);
    console.log(`[CONTENT-AI ORIGINALE DEBUG] ========================================`);
    
    if (isVideo && isLongCopy) {
      // Use targetCharLimit (90% margin) for AI guidance
      const aiLimit = targetCharLimit;
      // Hook is capped at MAX_HOOK_CHARS (125) for Meta Ads visibility
      const hookMax = Math.min(MAX_HOOK_CHARS, Math.floor(aiLimit * 0.10));
      const chiCosaComeMax = Math.floor(aiLimit * 0.15);
      const erroreMax = Math.floor(aiLimit * 0.25);
      const soluzioneMax = Math.floor(aiLimit * 0.25);
      const riprovaSocialeMax = Math.floor(aiLimit * 0.15);
      const ctaMax = Math.floor(aiLimit * 0.10);
      
      return `
**structuredContent** (OBBLIGATORIO - oggetto JSON):
{
  "type": "video_script",
  "copyVariant": "long",
  "hook": "MASSIMO ${MAX_HOOK_CHARS} caratteri (limite Meta Ads). ${sectionVariants.hook}",
  "chiCosaCome": "~${chiCosaComeMax} caratteri. ${sectionVariants.chiCosaCome}",
  "errore": "~${erroreMax} caratteri. ${sectionVariants.errore}",
  "soluzione": "~${soluzioneMax} caratteri. ${sectionVariants.soluzione}",
  "riprovaSociale": "~${riprovaSocialeMax} caratteri. ${sectionVariants.riprovaSociale}",
  "cta": "~${ctaMax} caratteri. ${sectionVariants.cta}",
  "captionCopy": "Il copy COMPLETO. Punta a circa ${aiLimit} caratteri.",
  "fullScript": "${sectionVariants.fullScript}",
  "hashtags": ["hashtag1", "hashtag2", "hashtag3"]
}

📏 LUNGHEZZA TARGET: circa ${aiLimit} caratteri totali
- Non superare MAI ${effectiveCharLimit} caratteri (limite piattaforma)

${styleInstructions}

IMPORTANTE per fullScript:
- Scritto per essere DETTO A VOCE, frasi corte e incisive
- Inserisci [PAUSA] dove vuoi pause drammatiche`;
    } else if (isVideo && !isLongCopy) {
      return `
**structuredContent** (OBBLIGATORIO - oggetto JSON):
{
  "type": "video_script",
  "copyVariant": "short",
  "hook": "MASSIMO ${MAX_HOOK_CHARS} caratteri (limite Meta Ads). ${sectionVariants.hook}",
  "body": "${sectionVariants.body} (100-200 caratteri)",
  "cta": "${sectionVariants.cta} (50-80 caratteri)",
  "captionCopy": "Il copy COMPLETO. Punta a circa ${targetCharLimit} caratteri.",
  "fullScript": "${sectionVariants.fullScript}",
  "hashtags": ["hashtag1", "hashtag2", "hashtag3"]
}

📏 LUNGHEZZA TARGET: circa ${targetCharLimit} caratteri
- Non superare MAI ${effectiveCharLimit} caratteri (limite piattaforma)

${styleInstructions}

IMPORTANTE per fullScript:
- Scritto per essere DETTO A VOCE, frasi corte e incisive
- Inserisci [PAUSA] dove vuoi pause drammatiche`;
    } else if (isLongCopy) {
      // Use targetCharLimit (90% margin) for AI guidance
      const aiLimit = targetCharLimit;
      // Hook is capped at MAX_HOOK_CHARS (125) for Meta Ads visibility
      const hookMax = Math.min(MAX_HOOK_CHARS, Math.floor(aiLimit * 0.10));
      const chiCosaComeMax = Math.floor(aiLimit * 0.15);
      const erroreMax = Math.floor(aiLimit * 0.25);
      const soluzioneMax = Math.floor(aiLimit * 0.25);
      const riprovaSocialeMax = Math.floor(aiLimit * 0.15);
      const ctaMax = Math.floor(aiLimit * 0.10);
      
      return `
**structuredContent** (OBBLIGATORIO - oggetto JSON):
{
  "type": "copy_long",
  "hook": "MASSIMO ${MAX_HOOK_CHARS} caratteri (limite Meta Ads). ${sectionVariants.hook}",
  "chiCosaCome": "~${chiCosaComeMax} caratteri. ${sectionVariants.chiCosaCome}",
  "errore": "~${erroreMax} caratteri. ${sectionVariants.errore}",
  "soluzione": "~${soluzioneMax} caratteri. ${sectionVariants.soluzione}",
  "riprovaSociale": "~${riprovaSocialeMax} caratteri. ${sectionVariants.riprovaSociale}",
  "cta": "~${ctaMax} caratteri. ${sectionVariants.cta}",
  "hashtags": ["hashtag1", "hashtag2", "hashtag3"]${imageFields}
}

📏 LUNGHEZZA TARGET: circa ${aiLimit} caratteri totali (somma sezioni)
- Non superare MAI ${effectiveCharLimit} caratteri (limite piattaforma)

${styleInstructions}`;
    } else {
      return `
**structuredContent** (OBBLIGATORIO - oggetto JSON):
{
  "type": "copy_short",
  "hook": "MASSIMO ${MAX_HOOK_CHARS} caratteri (limite Meta Ads). ${sectionVariants.hook}",
  "body": "${sectionVariants.body} (80-150 caratteri)",
  "cta": "${sectionVariants.cta} (40-70 caratteri)",
  "hashtags": ["hashtag1", "hashtag2", "hashtag3"]${imageFields}
}

📏 LUNGHEZZA TARGET: circa ${targetCharLimit} caratteri totali
- Non superare MAI ${effectiveCharLimit} caratteri (limite piattaforma)

${styleInstructions}`;
    }
  };

  const structuredContentInstructions = getStructuredContentInstructions();
  
  // Generate random hook pattern and angle for variety
  const { hookPattern, angle, promptSection: hookPatternAndAngleSection } = buildHookPatternAndAnglePrompt();

  // DEBUG: Log the parameters and generated instructions
  console.log(`[CONTENT-AI DEBUG] ========================================`);
  console.log(`[CONTENT-AI DEBUG] Generation Parameters:`);
  console.log(`[CONTENT-AI DEBUG]   copyType: "${copyType}"`);
  console.log(`[CONTENT-AI DEBUG]   mediaType: "${mediaType}"`);
  console.log(`[CONTENT-AI DEBUG]   charLimit: ${charLimit}`);
  console.log(`[CONTENT-AI DEBUG]   postSchema: "${postSchema || 'none'}"`);
  console.log(`[CONTENT-AI DEBUG]   schemaLabel: "${schemaLabel || 'none'}"`);
  console.log(`[CONTENT-AI DEBUG]   schemaStructure: "${schemaStructure || 'none'}"`);
  console.log(`[CONTENT-AI DEBUG]   targetPlatform: "${targetPlatform || 'none'}"`);
  console.log(`[CONTENT-AI DEBUG]   writingStyle: "${writingStyle}"`);
  console.log(`[CONTENT-AI DEBUG]   customWritingInstructions: "${customWritingInstructions ? 'provided' : 'none'}"`);
  console.log(`[CONTENT-AI DEBUG]   hookPattern: "${hookPattern.name}" (${hookPattern.pattern})`);
  console.log(`[CONTENT-AI DEBUG]   angle: leva=${angle.angle.levaEmotiva}, approccio=${angle.angle.approccio}, prospettiva=${angle.angle.prospettiva}, stile=${angle.angle.stileNarrativo}`);
  console.log(`[CONTENT-AI DEBUG] ----------------------------------------`);
  console.log(`[CONTENT-AI DEBUG] Structured Content Instructions (full, ${structuredContentInstructions.length} chars):`);
  console.log(`[CONTENT-AI DEBUG] ${structuredContentInstructions}`);
  console.log(`[CONTENT-AI DEBUG] ========================================`);

  const prompt = `Sei un esperto di content marketing italiano specializzato nella Piramide della Consapevolezza. Genera ${count} idee creative per contenuti COMPLETI.

CONTESTO:
- Nicchia/Settore: ${niche}
- Target Audience: ${targetAudience}
- Obiettivo: ${objective}
- Tipo Media: ${mediaType}
- Tipo Copy: ${copyType}
${additionalContext ? `- Contesto aggiuntivo: ${additionalContext}` : ''}
${brandContext}${brandVoiceContext}${kbContext}${platformSchemaContext}${topicContext}
${antiRepetitionContext}
${writingStyleSection}
${hookPatternAndAngleSection}

🎯 LIVELLO DI CONSAPEVOLEZZA DEL PUBBLICO: ${awarenessInfo.name}
STRATEGIA CONSAPEVOLEZZA: ${awarenessInfo.strategy}
TONO CONSAPEVOLEZZA: ${awarenessInfo.tone}
FOCUS CONSAPEVOLEZZA: ${awarenessInfo.focus}

📊 LIVELLO DI SOFISTICAZIONE DEL MERCATO: ${sophisticationInfo.name}
STRATEGIA MERCATO: ${sophisticationInfo.strategy}
TONO MERCATO: ${sophisticationInfo.tone}
FOCUS MERCATO: ${sophisticationInfo.focus}

È FONDAMENTALE che ogni idea sia perfettamente calibrata per ENTRAMBI i livelli:
- La CONSAPEVOLEZZA determina COSA dire al pubblico (quanto sanno del problema)
- La SOFISTICAZIONE determina COME dirlo (quanto è saturo il mercato)
Il copy, l'hook, e tutto il contenuto devono combinare entrambe le strategie in modo armonico.

Per ogni idea, fornisci TUTTI questi elementi:

1. title: Titolo accattivante (max 60 caratteri)
2. description: Descrizione breve del contenuto (2-3 frasi)
3. aiScore: Punteggio di efficacia stimata (1-100)
4. aiReasoning: Motivazione del punteggio
5. suggestedHook: MASSIMO ${MAX_HOOK_CHARS} caratteri! Hook con pattern "${hookPattern.name}" che cattura l'attenzione
6. suggestedCta: Call to action suggerita
7. mediaType: "${mediaType}"
8. copyType: "${copyType}"
9. structuredContent: Contenuto strutturato COMPLETO (vedi formato sotto) - TUTTI i campi devono essere dentro questo oggetto

${structuredContentInstructions}

RISPONDI SOLO con un JSON valido nel formato:
{
  "ideas": [
    {
      "title": "...",
      "description": "...",
      "aiScore": 85,
      "aiReasoning": "...",
      "suggestedHook": "...",
      "suggestedCta": "...",
      "mediaType": "${mediaType}",
      "copyType": "${copyType}",
      "structuredContent": { /* oggetto JSON COMPLETO secondo il formato sopra */ }
    }
  ]
}`;

  try {
    const { client, metadata } = await getAIProvider(consultantId, "content-ideas");
    const { model } = getModelWithThinking(metadata?.name);
    
    const result = await client.generateContent({
      model,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 1.0,  // Aumentata da 0.8 a 1.0 per maggiore varietà (come Email Nurturing 365)
        maxOutputTokens: 8192,
      },
    });
    
    const responseText = result.response.text();
    const parsed = parseJsonResponse<{ ideas: ContentIdea[] }>(responseText, { ideas: [] });
    
    if (!parsed.ideas || parsed.ideas.length === 0) {
      // Try to extract useful content from the raw response text instead of using placeholder
      // This happens when JSON parsing fails but the AI generated valid content
      console.log("[CONTENT-AI FALLBACK] JSON parsing failed, attempting to extract content from raw response");
      
      // Try to extract title from the response
      const titleMatch = responseText.match(/"title"\s*:\s*"([^"]+)"/);
      const extractedTitle = titleMatch ? titleMatch[1] : "Contenuto di valore per il tuo pubblico";
      
      // Try to extract description
      const descMatch = responseText.match(/"description"\s*:\s*"([^"]+)"/);
      const extractedDesc = descMatch ? descMatch[1] : `Un contenuto che parla al tuo target di ${targetAudience} nel settore ${niche}`;
      
      // Try to extract hook
      const hookMatch = responseText.match(/"(?:suggestedHook|hook)"\s*:\s*"([^"]+)"/);
      const extractedHook = hookMatch ? hookMatch[1] : "Scopri come...";
      
      // Try to extract CTA
      const ctaMatch = responseText.match(/"(?:suggestedCta|cta)"\s*:\s*"([^"]+)"/);
      const extractedCta = ctaMatch ? ctaMatch[1] : "Scopri di più nel link in bio";
      
      // Try to extract any long text content - look for chiCosaCome, errore, soluzione, riprovaSociale
      const contentParts: string[] = [];
      const contentPatterns = [
        /"hook"\s*:\s*"([^"]{50,})"/,
        /"chiCosaCome"\s*:\s*"([^"]{50,})"/,
        /"errore"\s*:\s*"([^"]{50,})"/,
        /"soluzione"\s*:\s*"([^"]{50,})"/,
        /"riprovaSociale"\s*:\s*"([^"]{50,})"/,
        /"cta"\s*:\s*"([^"]{20,})"/,
        /"captionCopy"\s*:\s*"([^"]{100,})"/,
        /"body"\s*:\s*"([^"]{50,})"/,
      ];
      
      for (const pattern of contentPatterns) {
        const match = responseText.match(pattern);
        if (match && match[1]) {
          // Unescape the content
          const unescaped = match[1]
            .replace(/\\n/g, '\n')
            .replace(/\\"/g, '"')
            .replace(/\\\\/g, '\\');
          contentParts.push(unescaped);
        }
      }
      
      let extractedCopyContent = "";
      if (contentParts.length > 0) {
        extractedCopyContent = contentParts.join("\n\n");
        console.log(`[CONTENT-AI FALLBACK] Extracted ${contentParts.length} content sections, total ${extractedCopyContent.length} chars`);
      } else {
        // Absolute fallback - but mark it so we know it failed
        extractedCopyContent = "Contenuto di esempio per il tuo pubblico.";
        console.log("[CONTENT-AI FALLBACK] No content sections found, using placeholder");
      }
      
      return {
        ideas: [{
          title: extractedTitle,
          description: extractedDesc,
          aiScore: 70,
          aiReasoning: "Idea estratta da risposta non-JSON",
          suggestedHook: extractedHook,
          suggestedCta: extractedCta,
          mediaType,
          copyType,
          copyContent: extractedCopyContent,
        }],
        modelUsed: model,
      };
    }
    
    const enrichedIdeas = parsed.ideas.slice(0, count).map(idea => {
      const sc = idea.structuredContent as any;
      
      let videoScript: string | undefined;
      let imageDescription: string | undefined;
      let imageOverlayText: string | undefined;
      let copyContent: string | undefined;
      let copyLength: number = 0;
      
      if (sc) {
        if (sc.type === "video_script") {
          videoScript = sc.fullScript;
          if (!videoScript && (sc.hook || sc.problema || sc.soluzione || sc.cta)) {
            videoScript = [sc.hook, sc.problema, sc.soluzione, sc.cta].filter(Boolean).join("\n\n");
          }
          if (sc.captionCopy) {
            copyContent = sc.captionCopy;
            copyLength = sc.captionCopy.length;
          } else if (sc.copyVariant === "long") {
            // Fallback: concatenate structured fields for long video copy
            const copyParts = [sc.hook, sc.chiCosaCome, sc.errore, sc.soluzione, sc.riprovaSociale, sc.cta].filter(Boolean);
            if (copyParts.length > 0) {
              copyContent = copyParts.join("\n\n");
              copyLength = copyContent.length;
            }
          } else if (sc.copyVariant === "short") {
            // Fallback: concatenate structured fields for short video copy
            const copyParts = [sc.hook, sc.body, sc.cta].filter(Boolean);
            if (copyParts.length > 0) {
              copyContent = copyParts.join("\n\n");
              copyLength = copyParts.join("").length; // For validation, no separators
            }
          }
        } else if (sc.type === "copy_long") {
          // PRIORITY 1: Use captionCopy if available (AI should always generate this)
          if (sc.captionCopy && typeof sc.captionCopy === 'string' && sc.captionCopy.length > 0) {
            copyContent = sc.captionCopy;
            copyLength = sc.captionCopy.length;
          } else {
            // PRIORITY 2: Try original schema fields (backwards compatibility)
            const originalSchemaParts = [sc.hook, sc.chiCosaCome, sc.errore, sc.soluzione, sc.riprovaSociale, sc.cta].filter(Boolean);
            if (originalSchemaParts.length > 0) {
              copyContent = originalSchemaParts.join("\n\n");
              copyLength = copyContent.length;
            } else {
              // PRIORITY 3: Dynamic fallback - collect ALL text fields from any schema
              const excludedFields = ['type', 'copyVariant', 'schemaUsed', 'hashtags', 'imageDescription', 'imageOverlayText', 'captionCopy'];
              const dynamicParts: string[] = [];
              for (const key of Object.keys(sc)) {
                if (!excludedFields.includes(key) && typeof sc[key] === 'string' && sc[key].length > 0) {
                  dynamicParts.push(sc[key]);
                }
              }
              if (dynamicParts.length > 0) {
                copyContent = dynamicParts.join("\n\n");
                copyLength = copyContent.length;
              }
            }
          }
          imageDescription = sc.imageDescription;
          imageOverlayText = sc.imageOverlayText;
        } else if (sc.type === "copy_short") {
          // PRIORITY 1: Use captionCopy if available
          if (sc.captionCopy && typeof sc.captionCopy === 'string' && sc.captionCopy.length > 0) {
            copyContent = sc.captionCopy;
            copyLength = sc.captionCopy.length;
          } else {
            // PRIORITY 2: Try original schema fields
            const copyParts = [sc.hook, sc.body, sc.cta].filter(Boolean);
            if (copyParts.length > 0) {
              copyContent = copyParts.join("\n\n");
              copyLength = copyParts.join("").length;
            } else {
              // PRIORITY 3: Dynamic fallback
              const excludedFields = ['type', 'copyVariant', 'schemaUsed', 'hashtags', 'imageDescription', 'imageOverlayText', 'captionCopy'];
              const dynamicParts: string[] = [];
              for (const key of Object.keys(sc)) {
                if (!excludedFields.includes(key) && typeof sc[key] === 'string' && sc[key].length > 0) {
                  dynamicParts.push(sc[key]);
                }
              }
              if (dynamicParts.length > 0) {
                copyContent = dynamicParts.join("\n\n");
                copyLength = dynamicParts.join("").length;
              }
            }
          }
          imageDescription = sc.imageDescription;
          imageOverlayText = sc.imageOverlayText;
        } else if (sc.type === "image_copy") {
          imageDescription = sc.conceptDescription;
          imageOverlayText = sc.imageText;
          if (sc.subtitle) {
            copyContent = sc.subtitle;
          }
        }
      }
      
      const finalCopyContent = idea.copyContent || copyContent;
      const effectiveCopyType = (idea.copyType || copyType) as "short" | "long";
      const lengthWarning = validateAndEnrichCopyLength(effectiveCopyType, copyLength, charLimit);
      
      // ==================== DEBUG RISULTATO DETTAGLIATO ====================
      console.log(`\n[CONTENT-AI RESULT] ╔══════════════════════════════════════════════════════════════╗`);
      console.log(`[CONTENT-AI RESULT] ║           RISULTATO GENERAZIONE CONTENUTO                    ║`);
      console.log(`[CONTENT-AI RESULT] ╠══════════════════════════════════════════════════════════════╣`);
      console.log(`[CONTENT-AI RESULT] ║ Idea: "${idea.title}"`);
      console.log(`[CONTENT-AI RESULT] ║ structuredContent.type: "${sc?.type || 'UNDEFINED'}"`);
      console.log(`[CONTENT-AI RESULT] ╠═══════════ LUNGHEZZA ═══════════════════════════════════════╣`);
      console.log(`[CONTENT-AI RESULT] ║ copyLength TOTALE: ${copyLength} caratteri`);
      console.log(`[CONTENT-AI RESULT] ║ charLimit: ${charLimit || 'UNDEFINED'}`);
      console.log(`[CONTENT-AI RESULT] ║ copyType: ${effectiveCopyType}`);
      console.log(`[CONTENT-AI RESULT] ║ ⚠️  SUPERA LIMITE: ${charLimit && copyLength > charLimit ? `❌ SI! (${copyLength}/${charLimit} = +${copyLength - charLimit} eccedenti)` : '✅ NO'}`);
      console.log(`[CONTENT-AI RESULT] ║ lengthWarning: ${lengthWarning || 'none'}`);
      
      // LOG DETTAGLIATO PER OGNI SEZIONE dello structuredContent
      if (sc && typeof sc === 'object') {
        console.log(`[CONTENT-AI RESULT] ╠═══════════ SEZIONI SINGOLE ═════════════════════════════════╣`);
        const excludedFields = ['type', 'copyVariant', 'schemaUsed', 'hashtags'];
        let totalFromSections = 0;
        for (const [key, value] of Object.entries(sc)) {
          if (!excludedFields.includes(key) && typeof value === 'string') {
            const len = value.length;
            totalFromSections += len;
            const warning = len > 300 ? ' ⚠️ LUNGA!' : (len > 200 ? ' ⚡' : '');
            console.log(`[CONTENT-AI RESULT] ║   ${key}: ${len} chars${warning}`);
          }
        }
        console.log(`[CONTENT-AI RESULT] ║   ─────────────────────────────────────────`);
        console.log(`[CONTENT-AI RESULT] ║   TOTALE SEZIONI: ${totalFromSections} chars`);
      }
      console.log(`[CONTENT-AI RESULT] ╚══════════════════════════════════════════════════════════════╝\n`);
      // ==================== FINE DEBUG RISULTATO ====================
      
      console.log(`[CONTENT-AI] Enriching idea "${idea.title}": mediaType=${idea.mediaType || mediaType}, structuredType=${sc?.type}, hasVideoScript=${!!videoScript}, hasImageDesc=${!!imageDescription}, hasCopyContent=${!!finalCopyContent}, copyLength=${copyLength}, lengthWarning=${lengthWarning || 'none'}`);
      
      return {
        ...idea,
        mediaType: idea.mediaType || mediaType,
        copyType: effectiveCopyType,
        videoScript: idea.videoScript || videoScript,
        imageDescription: idea.imageDescription || imageDescription,
        imageOverlayText: idea.imageOverlayText || imageOverlayText,
        copyContent: finalCopyContent,
        structuredContent: sc,
        ...(lengthWarning && { lengthWarning }),
      };
    });
    
    // POST-PROCESSING: Compress ideas that exceed character limit
    const finalIdeas: ContentIdea[] = [];
    
    for (const idea of enrichedIdeas) {
      // Calculate current copy length
      const currentContent = idea.copyContent || "";
      const currentLength = currentContent.length;
      
      // Check if compression is needed
      if (charLimit && currentLength > charLimit && currentContent) {
        console.log(`[CONTENT-AI COMPRESS] Idea "${idea.title}" exceeds limit: ${currentLength}/${charLimit}`);
        
        const { compressed, success } = await compressContentWithAI(
          currentContent,
          charLimit,
          currentLength,
          consultantId
        );
        
        if (success) {
          // Recompute length warning with new compressed length
          const newLengthWarning = validateAndEnrichCopyLength(
            idea.copyType || "long", 
            compressed.length, 
            charLimit
          );
          
          // Update structuredContent.captionCopy only if it exists
          let updatedSc = idea.structuredContent;
          if (updatedSc && 'captionCopy' in updatedSc) {
            updatedSc = { ...updatedSc, captionCopy: compressed };
          }
          
          console.log(`[CONTENT-AI COMPRESS] ✅ Compressed "${idea.title}": ${currentLength} → ${compressed.length} chars`);
          
          finalIdeas.push({
            ...idea,
            copyContent: compressed,
            structuredContent: updatedSc,
            lengthWarning: newLengthWarning || undefined,
          });
          continue;
        }
      }
      
      // No compression needed or failed - add as-is
      finalIdeas.push(idea);
    }
    
    return {
      ideas: finalIdeas,
      modelUsed: model,
      ...(fetchedTopicId && { topicId: fetchedTopicId }),
    };
  } catch (error: any) {
    console.error("[CONTENT-AI] Error generating ideas:", error);
    throw new Error(`Failed to generate content ideas: ${error.message}`);
  }
}

export async function generatePostCopy(params: GeneratePostCopyParams): Promise<GeneratePostCopyResult> {
  const { consultantId, idea, platform, brandVoice, brandVoiceData, keywords, tone, maxLength } = params;
  
  await rateLimitCheck(consultantId);
  
  const assets = await getBrandAssets(consultantId);
  const brandContext = buildCompleteBrandContext(assets);
  const brandVoiceContext = buildBrandVoiceContext(brandVoiceData);
  const effectiveBrandVoice = brandVoice || assets?.brandVoice || 'professional';

  const xCharLimit = assets?.xPremiumSubscription ? 4000 : 280;
  const xGuideline = assets?.xPremiumSubscription 
    ? `Account X Premium: puoi usare fino a ${xCharLimit} caratteri per post lunghi e long-form content. Sfrutta lo spazio per contenuti approfonditi.`
    : `Max ${xCharLimit} caratteri, conciso, usa thread se necessario, hashtag limitati.`;

  const platformGuidelines: Record<Platform, string> = {
    instagram: "Usa emoji moderati, hashtag (max 10), formato verticale. Max 2200 caratteri ma primo paragrafo cruciale.",
    facebook: "Testo più lungo accettato, meno hashtag, incoraggia commenti e condivisioni.",
    linkedin: "Max 3000 caratteri. Tono professionale, focus su valore business, usa bullet points, no emoji eccessivi.",
    tiktok: "Ultra breve, diretto, trendy, usa riferimenti pop culture, hashtag trending.",
    youtube: "Descrizione SEO-friendly, timestamps, link, CTA per subscribe e like.",
    twitter: xGuideline,
  };

  const prompt = `Sei un copywriter esperto di social media italiano. Crea il copy completo per un post usando il FRAMEWORK PERSUASIVO a 6 step.
${brandContext}${brandVoiceContext}
IDEA DEL CONTENUTO:
${idea}

PIATTAFORMA: ${platform}
${platformGuidelines[platform]}

BRAND VOICE: ${effectiveBrandVoice}
${keywords?.length ? `KEYWORDS DA INCLUDERE: ${keywords.join(', ')}` : ''}
${maxLength ? `LUNGHEZZA MASSIMA: ${maxLength} caratteri` : ''}

FRAMEWORK PERSUASIVO (6 STEP):
1. HOOK - MASSIMO 125 caratteri! Prima riga che cattura attenzione (pattern interrupt, curiosità, provocazione, domanda, statistica scioccante)
2. TARGET - "Aiuto [CHI] a [FARE COSA] [COME]" - Identifica il pubblico e il beneficio chiaro
3. PROBLEM - Il problema/pain point che il tuo target sta vivendo (rendi reale e specifico)
4. SOLUTION - La tua soluzione/offerta - cosa offri e perché funziona
5. PROOF - Riprova sociale: testimonianze, risultati, numeri, casi studio (anche struttura suggerita se non hai dati reali)
6. CTA - Call to action finale (chiara, urgente, specifica)

Genera tutti i 6 elementi + il fullCopy che li unisce in un post fluido, naturale e ben formattato.

RISPONDI SOLO con un JSON valido:
{
  "hook": "...",
  "target": "Aiuto [chi] a [cosa] [come]",
  "problem": "...",
  "solution": "...",
  "proof": "...",
  "cta": "...",
  "fullCopy": "Testo completo che unisce tutti i 6 step in modo naturale",
  "hashtags": ["..."],
  "emojiLevel": "minimal"
}`;

  try {
    const { client, metadata } = await getAIProvider(consultantId, "post-copy");
    const { model } = getModelWithThinking(metadata?.name);
    
    const result = await client.generateContent({
      model,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 2048,
      },
    });
    
    const responseText = result.response.text();
    const parsed = parseJsonResponse<PostCopy>(responseText, {
      hook: "Scopri qualcosa di nuovo oggi!",
      target: "Aiuto professionisti a raggiungere i loro obiettivi attraverso strategie mirate",
      problem: "Molti si sentono bloccati senza una direzione chiara",
      solution: "Il mio metodo ti guida passo dopo passo verso il risultato",
      proof: "Oltre 100 clienti hanno già ottenuto risultati concreti",
      cta: "Scopri di più nel link in bio",
      fullCopy: `Scopri qualcosa di nuovo oggi!\n\n${idea}\n\nScopri di più nel link in bio`,
    });
    
    return {
      copy: parsed,
      modelUsed: model,
    };
  } catch (error: any) {
    console.error("[CONTENT-AI] Error generating post copy:", error);
    throw new Error(`Failed to generate post copy: ${error.message}`);
  }
}

export type CopyOutputType = "copy_short" | "copy_long" | "video_script" | "image_copy";

export interface VideoScriptSegment {
  timing: string;
  visual: string;
  voiceover: string;
}

export interface ShortCopyVariation {
  outputType: "copy_short";
  hook: string;
  cta: string;
  hashtags?: string[];
}

export interface LongCopyVariation {
  outputType: "copy_long";
  hook: string;
  chiCosaCome: string;
  errore: string;
  soluzione: string;
  riprovaSociale: string;
  cta: string;
  hashtags?: string[];
}

export interface VideoScriptVariation {
  outputType: "video_script";
  segments: VideoScriptSegment[];
  hashtags?: string[];
}

export interface ImageCopyVariation {
  outputType: "image_copy";
  imageText: string;
  subtitle: string;
  conceptDescription: string;
  hashtags?: string[];
}

export type PostCopyVariation = ShortCopyVariation | LongCopyVariation | VideoScriptVariation | ImageCopyVariation;

export interface GeneratePostCopyVariationsParams extends GeneratePostCopyParams {
  outputType?: CopyOutputType;
}

export interface GeneratePostCopyVariationsResult {
  variations: PostCopyVariation[];
  outputType: CopyOutputType;
  modelUsed: string;
  tokensUsed?: number;
}

function getPromptForOutputType(
  outputType: CopyOutputType,
  idea: string,
  platform: Platform,
  platformGuidelines: Record<Platform, string>,
  effectiveBrandVoice: string,
  effectiveTone: string,
  keywords?: string[],
  maxLength?: number,
  brandVoiceContext?: string
): string {
  const baseContext = `Sei un copywriter esperto di social media italiano.
${brandVoiceContext || ''}
IDEA DEL CONTENUTO:
${idea}

PIATTAFORMA: ${platform}
${platformGuidelines[platform]}

BRAND VOICE: ${effectiveBrandVoice}
TONO: ${effectiveTone}
${keywords?.length ? `KEYWORDS DA INCLUDERE: ${keywords.join(', ')}` : ''}
${maxLength ? `LUNGHEZZA MASSIMA: ${maxLength} caratteri` : ''}`;

  switch (outputType) {
    case "copy_short":
      return `${baseContext}

Genera 3 VARIAZIONI di CAPTION BREVI per social media. Ogni variazione deve avere solo:
- hook: MASSIMO 125 caratteri! Una frase d'impatto breve e incisiva (domanda provocatoria o affermazione forte)
- cta: Chiamata all'azione chiara e diretta

Le variazioni devono essere significativamente diverse tra loro.

RISPONDI SOLO con un JSON valido:
{
  "variations": [
    { "hook": "...", "cta": "...", "hashtags": ["..."] },
    { "hook": "...", "cta": "...", "hashtags": ["..."] },
    { "hook": "...", "cta": "...", "hashtags": ["..."] }
  ]
}`;

    case "copy_long":
      return `${baseContext}

Genera 3 VARIAZIONI di INSERZIONI COMPLETE usando il FRAMEWORK PERSUASIVO a 6 STEP:

1. HOOK - MASSIMO 125 caratteri! Domanda provocatoria o frase d'impatto che cattura subito l'attenzione
2. CHI-COSA-COME - Presentazione personale con autorità: "Ciao, sono [Nome]. Se frequenti [contesto], ci siamo già visti a [evento]. Aiuto [chi] a [cosa] attraverso [metodo unico]"
3. ERRORE - L'errore SPECIFICO che fanno le persone: "L'errore più grande? Considerare X come Y..." (sii specifico e concreto)
4. SOLUZIONE - Il metodo unico con nome proprio: "Il mio metodo [Nome] non è [cosa comune], è [cosa unica che lo differenzia]"
5. RIPROVA SOCIALE - Storie concrete con nomi, eventi specifici, risultati misurabili (anche struttura suggerita)
6. CTA - Azione specifica con urgenza chiara

IMPORTANTE: Le 3 variazioni devono essere SIGNIFICATIVAMENTE diverse tra loro in tono e approccio.

RISPONDI SOLO con un JSON valido:
{
  "variations": [
    {
      "hook": "...",
      "chiCosaCome": "Ciao, sono [Nome]. Aiuto [chi] a [cosa] attraverso [metodo]...",
      "errore": "L'errore più grande? ...",
      "soluzione": "Il mio metodo [Nome] non è..., è...",
      "riprovaSociale": "Solo la settimana scorsa, [Nome] ha...",
      "cta": "...",
      "hashtags": ["..."]
    },
    { ... },
    { ... }
  ]
}`;

    case "video_script":
      return `${baseContext}

Genera 3 VARIAZIONI di SCRIPT VIDEO con timing precisi. Ogni variazione deve seguire questa struttura temporale:

- 00-05s: HOOK - MASSIMO 125 caratteri! Frase d'impatto che ferma lo scroll
- 05-20s: CHI-COSA-COME - Presentazione con autorità
- 20-35s: ERRORE - L'errore specifico che fa il target
- 35-50s: SOLUZIONE + RIPROVA SOCIALE - Metodo unico + storie concrete
- 50-60s: CTA - Azione urgente finale

Per ogni segmento temporale, fornisci:
- visual: Descrizione dell'inquadratura/cosa si vede
- voiceover: Testo da pronunciare/sottotitolare

RISPONDI SOLO con un JSON valido:
{
  "variations": [
    {
      "segments": [
        { "timing": "00-05s", "visual": "Close-up sul volto, sguardo diretto in camera", "voiceover": "[HOOK qui]" },
        { "timing": "05-20s", "visual": "Piano medio, ambiente professionale", "voiceover": "Ciao, sono [Nome]..." },
        { "timing": "20-35s", "visual": "B-roll o gesture che enfatizza il problema", "voiceover": "L'errore più grande?..." },
        { "timing": "35-50s", "visual": "Mostra risultati, testimonial, o dimostrazione", "voiceover": "Il mio metodo..." },
        { "timing": "50-60s", "visual": "Call to action visiva, testo su schermo", "voiceover": "[CTA urgente]" }
      ],
      "hashtags": ["..."]
    },
    { ... },
    { ... }
  ]
}`;

    case "image_copy":
      return `${baseContext}

Genera 3 VARIAZIONI di COPY PER IMMAGINE. Ogni variazione deve avere:
- imageText: Testo BREVE da mettere SULL'immagine (massimo 10 parole, deve essere leggibile e d'impatto)
- subtitle: Sottotitolo/caption da mettere SOTTO l'immagine (più lungo, può includere dettagli)
- conceptDescription: Descrizione del concept visivo dell'immagine (cosa dovrebbe mostrare l'immagine per accompagnare il testo)

Il testo sull'immagine deve essere d'impatto immediato, il sottotitolo può espandere il messaggio.

RISPONDI SOLO con un JSON valido:
{
  "variations": [
    {
      "imageText": "Massimo 10 parole d'impatto",
      "subtitle": "Sottotitolo più lungo che espande il messaggio...",
      "conceptDescription": "Immagine che mostra...",
      "hashtags": ["..."]
    },
    { ... },
    { ... }
  ]
}`;

    default:
      return getPromptForOutputType("copy_long", idea, platform, platformGuidelines, effectiveBrandVoice, effectiveTone, keywords, maxLength);
  }
}

function getDefaultVariationsForType(outputType: CopyOutputType): PostCopyVariation[] {
  switch (outputType) {
    case "copy_short":
      return [
        { outputType: "copy_short", hook: "Stai facendo questo errore?", cta: "Scopri di più nel link in bio", hashtags: [] },
        { outputType: "copy_short", hook: "Ecco cosa nessuno ti dice...", cta: "Commenta 'INFO' per saperne di più", hashtags: [] },
        { outputType: "copy_short", hook: "3 secondi per cambiare tutto.", cta: "Salva questo post!", hashtags: [] },
      ];
    case "copy_long":
      return [
        { 
          outputType: "copy_long",
          hook: "Stai perdendo clienti ogni giorno senza saperlo?",
          chiCosaCome: "Ciao, sono [Nome]. Aiuto professionisti a trasformare il loro business attraverso strategie di marketing personalizzate.",
          errore: "L'errore più grande? Pensare che basti 'essere sui social' per avere risultati.",
          soluzione: "Il mio Metodo 3P non è il solito corso, è un sistema pratico testato su oltre 100 aziende.",
          riprovaSociale: "Solo il mese scorso, Marco ha triplicato i suoi contatti in 30 giorni applicando questo metodo.",
          cta: "Commenta 'VOGLIO' per ricevere la guida gratuita!",
          hashtags: []
        },
        { 
          outputType: "copy_long",
          hook: "Perché il 90% dei business fallisce online?",
          chiCosaCome: "Ciao, sono [Nome]. Se frequenti eventi di settore, probabilmente ci siamo già visti. Aiuto imprenditori a scalare online.",
          errore: "L'errore più grande? Copiare quello che fanno gli altri senza una strategia.",
          soluzione: "Il mio Framework Unico parte dai tuoi punti di forza, non dalle mode del momento.",
          riprovaSociale: "Laura ha raddoppiato il fatturato in 6 mesi partendo da zero follower.",
          cta: "Prenota una call gratuita - link in bio!",
          hashtags: []
        },
        { 
          outputType: "copy_long",
          hook: "Sai qual è la differenza tra chi cresce e chi resta fermo?",
          chiCosaCome: "Ciao, sono [Nome]. Aiuto freelancer e consulenti a costruire un business sostenibile.",
          errore: "L'errore più grande? Lavorare 12 ore al giorno pensando che sia l'unico modo.",
          soluzione: "Il mio Sistema Libertà ti insegna a lavorare meno ma meglio, automatizzando ciò che ti ruba tempo.",
          riprovaSociale: "Giorgio ora lavora 5 ore al giorno e guadagna il doppio. Vero story.",
          cta: "Scrivi 'LIBERTÀ' nei commenti per il primo step gratuito!",
          hashtags: []
        },
      ];
    case "video_script":
      return [
        {
          outputType: "video_script",
          segments: [
            { timing: "00-05s", visual: "Close-up, sguardo in camera", voiceover: "Stai perdendo soldi ogni giorno?" },
            { timing: "05-20s", visual: "Piano medio, ambiente professionale", voiceover: "Ciao, sono [Nome]. Aiuto professionisti a crescere online." },
            { timing: "20-35s", visual: "B-roll con grafiche", voiceover: "L'errore più grande? Pensare di non aver bisogno di una strategia." },
            { timing: "35-50s", visual: "Mostra risultati", voiceover: "Il mio metodo ha aiutato 100+ persone a triplicare i risultati." },
            { timing: "50-60s", visual: "CTA su schermo", voiceover: "Link in bio per iniziare gratis!" },
          ],
          hashtags: []
        },
        {
          outputType: "video_script",
          segments: [
            { timing: "00-05s", visual: "Hook visivo forte", voiceover: "Fermati. Questo ti riguarda." },
            { timing: "05-20s", visual: "Presentazione personale", voiceover: "Sono [Nome] e quello che sto per dirti cambierà tutto." },
            { timing: "20-35s", visual: "Problema visualizzato", voiceover: "Stai facendo questo errore senza saperlo..." },
            { timing: "35-50s", visual: "Soluzione in azione", voiceover: "Ecco la soluzione che ha funzionato per tutti." },
            { timing: "50-60s", visual: "Azione finale", voiceover: "Commenta ORA per sapere come!" },
          ],
          hashtags: []
        },
        {
          outputType: "video_script",
          segments: [
            { timing: "00-05s", visual: "Inquadratura dinamica", voiceover: "3 secondi per cambiare la tua vita." },
            { timing: "05-20s", visual: "Chi sono io", voiceover: "Ciao, sono [Nome]. Aiuto [chi] a [cosa]." },
            { timing: "20-35s", visual: "Il problema comune", voiceover: "L'errore che tutti fanno? Questo." },
            { timing: "35-50s", visual: "La mia soluzione", voiceover: "Il mio metodo è diverso perché..." },
            { timing: "50-60s", visual: "CTA visiva", voiceover: "Segui per altri consigli come questo!" },
          ],
          hashtags: []
        },
      ];
    case "image_copy":
      return [
        {
          outputType: "image_copy",
          imageText: "Smetti di fare questo errore",
          subtitle: "Il 90% delle persone sbaglia questo passaggio fondamentale. Scopri come evitarlo e ottenere risultati 3x più velocemente.",
          conceptDescription: "Immagine con sfondo pulito, testo grande e leggibile, colori contrastanti che catturano l'attenzione",
          hashtags: []
        },
        {
          outputType: "image_copy",
          imageText: "La verità che nessuno ti dice",
          subtitle: "Dopo anni di esperienza ho capito una cosa: il successo non è questione di fortuna, è questione di strategia.",
          conceptDescription: "Ritratto professionale o scena di lavoro, atmosfera autentica e credibile",
          hashtags: []
        },
        {
          outputType: "image_copy",
          imageText: "Risultati in 30 giorni",
          subtitle: "Non prometto magie, ma un metodo testato su oltre 100 persone. Funziona. Punto.",
          conceptDescription: "Grafica con numeri/statistiche, visual che comunica crescita e successo",
          hashtags: []
        },
      ];
    default:
      return getDefaultVariationsForType("copy_long");
  }
}

function parseVariationsResponse(responseText: string, outputType: CopyOutputType): PostCopyVariation[] {
  const fallback = getDefaultVariationsForType(outputType);
  
  try {
    const cleanedText = responseText
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();
    const parsed = JSON.parse(cleanedText);
    
    if (!parsed.variations || !Array.isArray(parsed.variations)) {
      return fallback;
    }
    
    return parsed.variations.slice(0, 3).map((v: any) => {
      switch (outputType) {
        case "copy_short":
          return {
            outputType: "copy_short",
            hook: v.hook || "",
            cta: v.cta || "",
            hashtags: v.hashtags || [],
          } as ShortCopyVariation;
        case "copy_long":
          return {
            outputType: "copy_long",
            hook: v.hook || "",
            chiCosaCome: v.chiCosaCome || v.target || "",
            errore: v.errore || v.problem || "",
            soluzione: v.soluzione || v.solution || "",
            riprovaSociale: v.riprovaSociale || v.proof || "",
            cta: v.cta || "",
            hashtags: v.hashtags || [],
          } as LongCopyVariation;
        case "video_script":
          return {
            outputType: "video_script",
            segments: (v.segments || []).map((s: any) => ({
              timing: s.timing || "",
              visual: s.visual || "",
              voiceover: s.voiceover || "",
            })),
            hashtags: v.hashtags || [],
          } as VideoScriptVariation;
        case "image_copy":
          return {
            outputType: "image_copy",
            imageText: v.imageText || "",
            subtitle: v.subtitle || "",
            conceptDescription: v.conceptDescription || "",
            hashtags: v.hashtags || [],
          } as ImageCopyVariation;
        default:
          return v;
      }
    });
  } catch (error) {
    console.error("[CONTENT-AI] Failed to parse variations response:", error);
    return fallback;
  }
}

export async function generatePostCopyVariations(params: GeneratePostCopyVariationsParams): Promise<GeneratePostCopyVariationsResult> {
  const { consultantId, idea, platform, brandVoice, brandVoiceData, keywords, tone, maxLength, outputType = "copy_long" } = params;
  
  await rateLimitCheck(consultantId);
  
  const assets = await getBrandAssets(consultantId);
  const brandContext = buildCompleteBrandContext(assets);
  const brandVoiceContext = buildBrandVoiceContext(brandVoiceData);
  const effectiveBrandVoice = brandVoice || assets?.brandVoice || 'professional';
  const effectiveTone = tone || 'friendly professional';

  const xCharLimit = assets?.xPremiumSubscription ? 4000 : 280;
  const xGuideline = assets?.xPremiumSubscription 
    ? `Account X Premium: puoi usare fino a ${xCharLimit} caratteri per post lunghi e long-form content. Sfrutta lo spazio per contenuti approfonditi.`
    : `Max ${xCharLimit} caratteri, conciso, usa thread se necessario, hashtag limitati.`;

  const platformGuidelines: Record<Platform, string> = {
    instagram: "Usa emoji moderati, hashtag (max 10), formato verticale. Max 2200 caratteri ma primo paragrafo cruciale.",
    facebook: "Testo più lungo accettato, meno hashtag, incoraggia commenti e condivisioni.",
    linkedin: "Max 3000 caratteri. Tono professionale, focus su valore business, usa bullet points, no emoji eccessivi.",
    tiktok: "Ultra breve, diretto, trendy, usa riferimenti pop culture, hashtag trending.",
    youtube: "Descrizione SEO-friendly, timestamps, link, CTA per subscribe e like.",
    twitter: xGuideline,
  };

  const prompt = getPromptForOutputType(
    outputType,
    idea,
    platform,
    platformGuidelines,
    effectiveBrandVoice,
    effectiveTone,
    keywords,
    maxLength,
    brandVoiceContext
  );

  try {
    const { client, metadata } = await getAIProvider(consultantId, "post-copy-variations");
    const { model } = getModelWithThinking(metadata?.name);
    
    const result = await client.generateContent({
      model,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.9,
        maxOutputTokens: 4096,
      },
    });
    
    const responseText = result.response.text();
    const variations = parseVariationsResponse(responseText, outputType);
    
    return {
      variations,
      outputType,
      modelUsed: model,
    };
  } catch (error: any) {
    console.error("[CONTENT-AI] Error generating post copy variations:", error);
    throw new Error(`Failed to generate post copy variations: ${error.message}`);
  }
}

export async function generateCampaignContent(params: GenerateCampaignParams): Promise<GenerateCampaignResult> {
  const { consultantId, productOrService, targetAudience, objective, budget, duration, uniqueSellingPoints, brandVoice, brandVoiceData } = params;
  
  await rateLimitCheck(consultantId);
  
  const assets = await getBrandAssets(consultantId);
  const brandContext = buildCompleteBrandContext(assets);
  const brandVoiceContext = buildBrandVoiceContext(brandVoiceData);
  const effectiveBrandVoice = brandVoice || assets?.brandVoice || 'professional';

  const prompt = `Sei un esperto di marketing e advertising italiano. Crea una strategia di campagna completa seguendo la struttura a 6 step.
${brandContext}${brandVoiceContext}
PRODOTTO/SERVIZIO: ${productOrService}
TARGET AUDIENCE: ${targetAudience}
OBIETTIVO: ${objective}
${budget ? `BUDGET: ${budget}` : ''}
${duration ? `DURATA: ${duration}` : ''}
${uniqueSellingPoints?.length ? `USP: ${uniqueSellingPoints.join(', ')}` : ''}
BRAND VOICE: ${effectiveBrandVoice}

Genera una strategia completa con:

1. HOOK - Chi è il target, cosa offriamo, come lo comunichiamo
2. TARGET - Demografia, interessi e comportamenti
3. PROBLEM - Problema principale e conseguenze
4. SOLUTION - Offerta e benefici
5. PROOF - Struttura testimonial e numeri
6. CTA - Testo e urgenza

Più creativi per ads:
- primaryText: Testo principale dell'ad
- headline: Titolo dell'ad
- description: Descrizione breve

RISPONDI SOLO con un JSON valido:
{
  "hook": {
    "who": "...",
    "what": "...",
    "how": "...",
    "copy": "..."
  },
  "target": {
    "demographics": {
      "ageRange": "25-45",
      "gender": "all",
      "location": "Italia",
      "language": "Italiano"
    },
    "interests": ["..."],
    "behaviors": ["..."]
  },
  "problem": {
    "mainProblem": "...",
    "consequences": ["..."],
    "emotionalImpact": "..."
  },
  "solution": {
    "offer": "...",
    "benefits": ["..."],
    "differentiators": ["..."]
  },
  "proof": {
    "testimonialStructure": "...",
    "numbers": ["..."],
    "socialProof": ["..."]
  },
  "cta": {
    "text": "...",
    "urgency": "...",
    "secondaryCta": "..."
  },
  "adCreative": {
    "primaryText": "...",
    "headline": "...",
    "description": "..."
  }
}`;

  try {
    const { client, metadata } = await getAIProvider(consultantId, "campaign-content");
    const { model } = getModelWithThinking(metadata?.name);
    
    const result = await client.generateContent({
      model,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 4096,
      },
    });
    
    const responseText = result.response.text();
    const parsed = parseJsonResponse<CampaignContent>(responseText, getDefaultCampaign(productOrService, targetAudience));
    
    return {
      campaign: parsed,
      modelUsed: model,
    };
  } catch (error: any) {
    console.error("[CONTENT-AI] Error generating campaign:", error);
    throw new Error(`Failed to generate campaign content: ${error.message}`);
  }
}

function getDefaultCampaign(product: string, audience: string): CampaignContent {
  return {
    hook: {
      who: audience,
      what: product,
      how: "Comunicazione diretta e chiara",
      copy: `Scopri ${product} - la soluzione per ${audience}`,
    },
    target: {
      demographics: {
        ageRange: "25-55",
        gender: "all",
        location: "Italia",
        language: "Italiano",
      },
      interests: ["Business", "Innovazione", "Crescita personale"],
      behaviors: ["Acquisti online", "Ricerca attiva di soluzioni"],
    },
    problem: {
      mainProblem: "Difficoltà a raggiungere i propri obiettivi",
      consequences: ["Perdita di tempo", "Frustrazione", "Risultati insufficienti"],
      emotionalImpact: "Senso di stallo e insoddisfazione",
    },
    solution: {
      offer: product,
      benefits: ["Risparmio di tempo", "Risultati migliori", "Supporto dedicato"],
      differentiators: ["Approccio personalizzato", "Esperienza comprovata"],
    },
    proof: {
      testimonialStructure: "Situazione iniziale → Soluzione → Risultato ottenuto",
      numbers: ["100+ clienti soddisfatti", "95% tasso di successo"],
      socialProof: ["Recensioni verificate", "Case study documentati"],
    },
    cta: {
      text: "Inizia ora",
      urgency: "Posti limitati - Prenota la tua consulenza gratuita",
      secondaryCta: "Scopri di più",
    },
    adCreative: {
      primaryText: `${audience}, è il momento di cambiare. ${product} ti aspetta.`,
      headline: `Trasforma il tuo ${product}`,
      description: "Scopri come centinaia di persone hanno già raggiunto i loro obiettivi.",
    },
  };
}

export async function generateImagePrompt(params: GenerateImagePromptParams): Promise<ImagePromptResult> {
  const { consultantId, contentDescription, brandColors, style, platform, aspectRatio, mood, includeText, textToInclude } = params;
  
  await rateLimitCheck(consultantId);
  
  const assets = await getBrandAssets(consultantId);
  const brandContext = buildCompleteBrandContext(assets);
  const effectiveColors: string[] = [];
  if (brandColors && brandColors.length > 0) {
    effectiveColors.push(...brandColors);
  } else {
    if (assets?.primaryColor) effectiveColors.push(assets.primaryColor);
    if (assets?.secondaryColor) effectiveColors.push(assets.secondaryColor);
    if (assets?.accentColor) effectiveColors.push(assets.accentColor);
  }

  const platformSpecs: Record<Platform, { ratio: string; resolution: string }> = {
    instagram: { ratio: aspectRatio || "1:1", resolution: "1080x1080" },
    facebook: { ratio: "1.91:1", resolution: "1200x628" },
    linkedin: { ratio: "1.91:1", resolution: "1200x627" },
    tiktok: { ratio: "9:16", resolution: "1080x1920" },
    youtube: { ratio: "16:9", resolution: "1280x720" },
    twitter: { ratio: "16:9", resolution: "1200x675" },
  };

  const styleDescriptions: Record<ImageStyle, string> = {
    realistic: "fotorealistico, dettagli naturali, illuminazione cinematica",
    illustration: "illustrazione digitale, colori vivaci, stile moderno",
    minimal: "design minimalista, spazi bianchi, elementi essenziali",
    bold: "colori forti, contrasti elevati, impatto visivo forte",
    professional: "aspetto corporate, pulito, affidabile, elegante",
    playful: "giocoso, colorato, friendly, accessibile",
  };

  const specs = platformSpecs[platform] || platformSpecs.instagram;

  const prompt = `Sei un esperto di prompt engineering per generazione immagini AI. Crea un prompt ottimizzato.
${brandContext}
DESCRIZIONE CONTENUTO: ${contentDescription}
STILE: ${style} - ${styleDescriptions[style]}
PIATTAFORMA: ${platform}
ASPECT RATIO: ${specs.ratio}
${effectiveColors.length ? `COLORI BRAND DA USARE: ${effectiveColors.join(', ')}` : ''}
${mood ? `MOOD: ${mood}` : ''}
${includeText && textToInclude ? `TESTO DA INCLUDERE: "${textToInclude}"` : ''}

Genera:
1. prompt: Il prompt completo ottimizzato per DALL-E/Midjourney/Stable Diffusion
2. negativePrompt: Elementi da evitare
3. styleNotes: Note aggiuntive sullo stile

RISPONDI SOLO con un JSON valido:
{
  "prompt": "...",
  "negativePrompt": "...",
  "styleNotes": "..."
}`;

  try {
    const { client, metadata } = await getAIProvider(consultantId, "image-prompt");
    const { model } = getModelWithThinking(metadata?.name);
    
    const result = await client.generateContent({
      model,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.6,
        maxOutputTokens: 1024,
      },
    });
    
    const responseText = result.response.text();
    const parsed = parseJsonResponse<{ prompt: string; negativePrompt: string; styleNotes: string }>(responseText, {
      prompt: `${styleDescriptions[style]} image of ${contentDescription}`,
      negativePrompt: "blurry, low quality, distorted, watermark, text unless specified",
      styleNotes: `Optimized for ${platform}`,
    });
    
    return {
      prompt: parsed.prompt,
      negativePrompt: parsed.negativePrompt,
      styleNotes: parsed.styleNotes,
      technicalSpecs: {
        aspectRatio: specs.ratio,
        resolution: specs.resolution,
        format: "PNG",
      },
      modelUsed: model,
    };
  } catch (error: any) {
    console.error("[CONTENT-AI] Error generating image prompt:", error);
    throw new Error(`Failed to generate image prompt: ${error.message}`);
  }
}

// Shorten copy to fit character limit
export interface ShortenCopyParams {
  consultantId: string;
  originalCopy: string;
  targetLimit: number;
  platform: string;
}

export interface ShortenCopyResult {
  shortenedCopy: string;
  originalLength: number;
  newLength: number;
  modelUsed: string;
  withinLimit: boolean;
}

export async function shortenCopy(params: ShortenCopyParams): Promise<ShortenCopyResult> {
  const { consultantId, originalCopy, targetLimit, platform } = params;
  
  await rateLimitCheck(consultantId);
  
  const safeLimit = Math.floor(targetLimit * 0.95); // 5% margin for safety
  
  const prompt = `Sei un editor esperto. Devi ACCORCIARE il seguente testo per farlo stare nel limite di ${safeLimit} caratteri.

TESTO ORIGINALE (${originalCopy.length} caratteri):
---
${originalCopy}
---

REGOLE:
1. Il testo accorciato DEVE essere MASSIMO ${safeLimit} caratteri
2. Mantieni il MESSAGGIO PRINCIPALE e la CTA
3. Rimuovi ripetizioni e frasi superflue
4. Mantieni il tono e lo stile originale
5. Mantieni la formattazione (righe vuote, emoji, frecce →)
6. Se ci sono elenchi, riducili ai punti essenziali
7. L'hook iniziale deve rimanere d'impatto

PIATTAFORMA: ${platform.toUpperCase()}

RISPONDI SOLO con il testo accorciato, niente altro. Non aggiungere spiegazioni.`;

  try {
    const { client, metadata } = await getAIProvider(consultantId, "shorten-copy");
    const { model } = getModelWithThinking(metadata?.name);
    
    const result = await client.generateContent({
      model,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.3, // Low temperature for more focused editing
        maxOutputTokens: 2048,
      },
    });
    
    let shortenedCopy = result.response.text().trim();
    
    // If still over limit, try to trim intelligently - never cut mid-sentence
    if (shortenedCopy.length > targetLimit) {
      console.log(`[CONTENT-AI] First attempt still over limit (${shortenedCopy.length}/${targetLimit}), trimming...`);
      
      // Strategy 1: Try to keep complete paragraphs
      const paragraphs = shortenedCopy.split('\n\n');
      let trimmedByParagraph = '';
      for (const para of paragraphs) {
        if ((trimmedByParagraph + (trimmedByParagraph ? '\n\n' : '') + para).length <= targetLimit) {
          trimmedByParagraph += (trimmedByParagraph ? '\n\n' : '') + para;
        } else {
          break;
        }
      }
      
      // Strategy 2: If paragraph trimming leaves too little, try sentence-level trimming
      if (trimmedByParagraph.length < targetLimit * 0.6) {
        // Find the last complete sentence that fits within the limit
        const sentences = shortenedCopy.match(/[^.!?]*[.!?]+/g) || [];
        let trimmedBySentence = '';
        for (const sentence of sentences) {
          if ((trimmedBySentence + sentence).length <= targetLimit) {
            trimmedBySentence += sentence;
          } else {
            break;
          }
        }
        
        // Use sentence trimming if it gives more content
        if (trimmedBySentence.length > trimmedByParagraph.length) {
          trimmedByParagraph = trimmedBySentence.trim();
        }
      }
      
      // Use trimmed version if we have meaningful content (at least 40% of original)
      if (trimmedByParagraph.length > originalCopy.length * 0.4) {
        shortenedCopy = trimmedByParagraph;
      }
    }
    
    console.log(`[CONTENT-AI] Shortened copy: ${originalCopy.length} -> ${shortenedCopy.length} chars (limit: ${targetLimit})`);
    
    return {
      shortenedCopy,
      originalLength: originalCopy.length,
      newLength: shortenedCopy.length,
      modelUsed: model,
      withinLimit: shortenedCopy.length <= targetLimit,
    };
  } catch (error: any) {
    console.error("[CONTENT-AI] Error shortening copy:", error);
    throw new Error(`Failed to shorten copy: ${error.message}`);
  }
}
