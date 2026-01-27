import { getAIProvider, getModelWithThinking, GEMINI_3_MODEL } from "../ai/provider-factory";
import { db } from "../db";
import { brandAssets } from "@shared/schema";
import { eq } from "drizzle-orm";

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
  postCategory?: "ads" | "valore" | "altri";
  postSchema?: string;
  schemaStructure?: string;
  schemaLabel?: string;
  charLimit?: number;
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

export { SECTION_GUIDELINES, getSectionGuideline };

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

export async function generateContentIdeas(params: GenerateIdeasParams): Promise<GenerateIdeasResult> {
  const { consultantId, niche, targetAudience, objective, additionalContext, count = 3, mediaType = "photo", copyType = "short", awarenessLevel = "problem_aware", sophisticationLevel = "level_3" } = params;
  const { targetPlatform, postCategory, postSchema, schemaStructure, schemaLabel, charLimit } = params;
  
  await rateLimitCheck(consultantId);
  
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
  if (targetPlatform || postSchema) {
    const platformNames: Record<string, string> = { instagram: "Instagram", x: "X (Twitter)", linkedin: "LinkedIn" };
    const categoryNames: Record<string, string> = { ads: "Inserzioni (Ads)", valore: "Post di Valore", altri: "Altri Post" };
    
    platformSchemaContext = `

📱 PIATTAFORMA TARGET: ${platformNames[targetPlatform || "instagram"] || targetPlatform}
📝 TIPO POST: ${categoryNames[postCategory || "valore"] || postCategory}
🔢 LIMITE CARATTERI: ${charLimit || 2200} caratteri MAX per il copy principale
${schemaLabel ? `📋 SCHEMA SELEZIONATO: ${schemaLabel}` : ""}`;
  }

  const getStructuredContentInstructions = () => {
    const imageFields = mediaType === "photo" ? `,
  "imageDescription": "Descrizione visiva dettagliata dell'immagine: soggetto, sfondo, colori, mood, stile fotografico",
  "imageOverlayText": "Testo breve e d'impatto da sovrapporre all'immagine (max 10 parole)"` : "";
    
    const effectiveCharLimit = charLimit || 2200;
    const isLongCopy = copyType === "long";
    const isVideo = mediaType === "video";
    
    // Calculate character ranges based on copyType and charLimit
    const minChars = isLongCopy ? Math.min(1500, Math.floor(effectiveCharLimit * 0.7)) : 200;
    const maxChars = isLongCopy ? Math.min(3000, effectiveCharLimit) : Math.min(500, effectiveCharLimit);
    
    // Style instructions based on copyType
    const styleInstructions = isLongCopy 
      ? `STILE COPY LUNGO:
- Ogni sezione deve essere sviluppata in modo narrativo e approfondito
- Il copy TOTALE deve essere tra ${minChars}-${maxChars} caratteri
- Usa emoji strategiche (max 5-7 per post) per rendere visivamente scorrevole
- Separa i pensieri all'interno di ogni blocco con righe vuote
- Il tono deve essere empatico, autorevole e persuasivo`
      : `STILE COPY CORTO:
- Il copy TOTALE deve essere tra ${minChars}-${maxChars} caratteri
- Dritto al punto, ogni parola deve contare
- Massimo 3-4 blocchi di testo totali`;

    // Generate dynamic structure based on schemaStructure if provided
    if (schemaStructure) {
      const schemaParts = schemaStructure.split("|").map(s => s.trim());
      const numSections = schemaParts.length;
      
      // Calculate per-section character requirements to guarantee total minimum
      // For long copy: distribute minChars across sections, ensuring sum >= minChars
      // For short copy: distribute based on minChars (200) to maxChars (500)
      const guaranteedMinPerSection = Math.ceil(minChars / numSections);
      const targetMaxPerSection = Math.ceil(maxChars / numSections);
      
      // For long copy: each section must contribute enough to reach 1500+ total
      // For short copy: align with overall 200-500 target
      const minPerSection = isLongCopy 
        ? Math.max(250, guaranteedMinPerSection) // At least 250 chars per section for long copy
        : Math.max(40, Math.floor(minChars / numSections)); // Proportional for short
      const maxPerSection = isLongCopy 
        ? Math.min(800, targetMaxPerSection * 1.5) // Cap at 800 to avoid one section dominating
        : Math.min(200, Math.ceil(maxChars / numSections)); // Proportional for short
      
      // Calculate what the guaranteed total would be
      const guaranteedTotal = minPerSection * numSections;
      
      // Create field names from schema parts
      const fieldNames = schemaParts.map((part, idx) => {
        return part.toLowerCase()
          .replace(/[^a-z0-9\s]/g, '')
          .replace(/\s+/g, '_')
          .replace(/_+/g, '_')
          .replace(/^_|_$/g, '') || `section_${idx + 1}`;
      });
      
      // Create detailed instructions for each section using SECTION_GUIDELINES
      const sectionInstructions = schemaParts.map((part, idx) => {
        const fieldName = fieldNames[idx];
        const guideline = getSectionGuideline(fieldName, part);
        
        const styleNote = isLongCopy 
          ? (guideline.style === "narrative" 
              ? "Sviluppa con storytelling, dettagli concreti, esempi reali"
              : guideline.style === "list"
                ? "Usa elenco puntato chiaro e specifico"
                : "Breve ma incisivo, ogni parola conta")
          : "Conciso e diretto, massima densità informativa";
        
        return `**${idx + 1}. Campo "${fieldName}" (sezione: ${part})**
   - ${guideline.instruction}
   - ${styleNote}`;
      }).join("\n\n");
      
      // Simple JSON structure with placeholder descriptions
      const dynamicFields = fieldNames.map((fieldName, idx) => {
        return `  "${fieldName}": "SCRIVI QUI il contenuto per: ${schemaParts[idx]}"`;
      }).join(",\n");
      
      const videoFields = isVideo ? `,
  "fullScript": "Lo script completo parlato fluido da registrare. USA [PAUSA] per indicare pause drammatiche."` : "";
      
      // Length enforcement block - focus on TOTAL only, let AI distribute freely
      const lengthEnforcement = isLongCopy ? `
⚠️⚠️⚠️ LIMITE CARATTERI OBBLIGATORIO ⚠️⚠️⚠️

LUNGHEZZA COPY TOTALE: tra ${minChars} e ${maxChars} caratteri

Il campo "captionCopy" DEVE essere:
- MINIMO ${minChars} caratteri (copy troppo corto = fallimento)
- MASSIMO ${maxChars} caratteri (limite piattaforma ${targetPlatform?.toUpperCase() || 'INSTAGRAM'})

Distribuisci liberamente il contenuto tra le ${numSections} sezioni dello schema.
Ogni sezione deve essere sviluppata con storytelling e dettagli concreti.

⛔ SE IL captionCopy SUPERA ${maxChars} CARATTERI, HAI FALLITO IL TASK.
⛔ SE IL captionCopy È SOTTO ${minChars} CARATTERI, HAI FALLITO IL TASK.

Conta i caratteri prima di rispondere.` : "";
      
      return `
🚨🚨🚨 REGOLA ASSOLUTA: SEGUI LO SCHEMA ESATTAMENTE 🚨🚨🚨

📋 SCHEMA SELEZIONATO: "${schemaLabel || 'Schema personalizzato'}"
📐 STRUTTURA OBBLIGATORIA: ${schemaParts.map((p, i) => `${i + 1}. ${p}`).join(" → ")}

⚠️ DEVI seguire questa struttura A PENNELLO:
- OGNI sezione dello schema DEVE essere presente nel tuo contenuto
- L'ORDINE delle sezioni DEVE essere esattamente quello indicato
- NON saltare sezioni, NON invertire l'ordine, NON aggiungere sezioni extra
- Il contenuto di captionCopy DEVE seguire questa sequenza: ${schemaParts.join(" → ")}

**ISTRUZIONI DETTAGLIATE PER OGNI SEZIONE:**

${sectionInstructions}

**structuredContent** (OBBLIGATORIO - oggetto JSON):
{
  "type": "${isVideo ? 'video_script' : (isLongCopy ? 'copy_long' : 'copy_short')}",
  "copyVariant": "${copyType}",
  "schemaUsed": "${postSchema}",
${dynamicFields},
  "captionCopy": "CONCATENA tutte le sezioni sopra in un unico testo formattato. DEVE essere ${minChars}-${maxChars} caratteri TOTALI.",
  "hashtags": ["hashtag1", "hashtag2", "hashtag3"]${imageFields}${videoFields}
}

${styleInstructions}
${lengthEnforcement}

LIMITE CARATTERI PIATTAFORMA: ${effectiveCharLimit} caratteri MAX
${isVideo ? `
IMPORTANTE per fullScript (video):
- Scritto per essere DETTO A VOCE, frasi corte e incisive
- Inserisci [PAUSA] dove vuoi pause drammatiche (1-2 secondi)
- Usa '...' per micro-pause di respiro` : ""}`;
    }
    
    // Fallback to default structure when no schemaStructure is provided (schema "originale")
    if (isVideo && isLongCopy) {
      return `
**structuredContent** (OBBLIGATORIO - oggetto JSON):
{
  "type": "video_script",
  "copyVariant": "long",
  "hook": "100-200 caratteri. La prima frase che ferma lo scroll - provocatoria, curiosa, o scioccante. Deve creare tensione emotiva immediata.",
  "chiCosaCome": "200-400 caratteri. Aiuto [CHI] a [FARE COSA] attraverso [COME] - il tuo posizionamento con storytelling. Racconta brevemente chi sei e cosa fai in modo narrativo.",
  "errore": "300-500 caratteri. L'errore comune che il tuo target sta commettendo senza saperlo. Sviluppa il problema con empatia, fai sentire al lettore che lo capisci.",
  "soluzione": "300-500 caratteri. La tua soluzione unica al problema - cosa offri e perché funziona. Descrivi i benefici concreti e il risultato trasformativo.",
  "riprovaSociale": "200-400 caratteri. Testimonianze, risultati concreti, numeri specifici che provano il valore. Usa storie brevi di clienti reali o dati d'impatto.",
  "cta": "100-200 caratteri. Call to action finale chiara e urgente. Crea scarsità o urgenza e indica l'azione esatta da compiere.",
  "captionCopy": "Il copy COMPLETO che concatena tutte le sezioni sopra in un unico testo formattato per Instagram. DEVE essere ${minChars}-${maxChars} caratteri.",
  "fullScript": "Lo script completo parlato fluido da registrare. USA [PAUSA] per indicare pause drammatiche. Usa '...' per micro-pause. Esempio: 'Il tuo telefono... [PAUSA] ...è diventato una catena.'",
  "hashtags": ["hashtag1", "hashtag2", "hashtag3"]
}

${styleInstructions}

IMPORTANTE per fullScript:
- Scritto per essere DETTO A VOCE, frasi corte e incisive
- Inserisci [PAUSA] dove vuoi pause drammatiche (1-2 secondi)
- Usa '...' per micro-pause di respiro`;
    } else if (isVideo && !isLongCopy) {
      return `
**structuredContent** (OBBLIGATORIO - oggetto JSON):
{
  "type": "video_script",
  "copyVariant": "short",
  "hook": "La prima frase d'impatto che cattura attenzione (50-100 caratteri)",
  "body": "Il corpo del messaggio - conciso, dritto al punto (100-300 caratteri)",
  "cta": "Call to action finale (50-100 caratteri)",
  "captionCopy": "Il copy COMPLETO che concatena hook+body+cta in un unico testo. DEVE essere ${minChars}-${maxChars} caratteri.",
  "fullScript": "Lo script completo parlato fluido da registrare. USA [PAUSA] per indicare pause drammatiche. Usa '...' per micro-pause.",
  "hashtags": ["hashtag1", "hashtag2", "hashtag3"]
}

${styleInstructions}

IMPORTANTE per fullScript:
- Scritto per essere DETTO A VOCE, frasi corte e incisive
- Inserisci [PAUSA] dove vuoi pause drammatiche (1-2 secondi)
- Usa '...' per micro-pause di respiro`;
    } else if (isLongCopy) {
      return `
**structuredContent** (OBBLIGATORIO - oggetto JSON):
{
  "type": "copy_long",
  "hook": "100-200 caratteri. La prima frase che ferma lo scroll - provocatoria, curiosa, o scioccante. Deve creare tensione emotiva immediata.",
  "chiCosaCome": "200-400 caratteri. Aiuto [CHI] a [FARE COSA] attraverso [COME] - il tuo posizionamento con storytelling. Racconta brevemente chi sei e cosa fai in modo narrativo.",
  "errore": "300-500 caratteri. L'errore comune che il tuo target sta commettendo senza saperlo. Sviluppa il problema con empatia, fai sentire al lettore che lo capisci.",
  "soluzione": "300-500 caratteri. La tua soluzione unica al problema - cosa offri e perché funziona. Descrivi i benefici concreti e il risultato trasformativo.",
  "riprovaSociale": "200-400 caratteri. Testimonianze, risultati concreti, numeri specifici che provano il valore. Usa storie brevi di clienti reali o dati d'impatto.",
  "cta": "100-200 caratteri. Call to action finale chiara e urgente. Crea scarsità o urgenza e indica l'azione esatta da compiere.",
  "hashtags": ["hashtag1", "hashtag2", "hashtag3"]${imageFields}
}

${styleInstructions}`;
    } else {
      return `
**structuredContent** (OBBLIGATORIO - oggetto JSON):
{
  "type": "copy_short",
  "hook": "La prima frase d'impatto che cattura attenzione (50-100 caratteri)",
  "body": "Il corpo del messaggio - conciso, dritto al punto (100-300 caratteri)",
  "cta": "Call to action finale (50-100 caratteri)",
  "hashtags": ["hashtag1", "hashtag2", "hashtag3"]${imageFields}
}

${styleInstructions}`;
    }
  };

  const structuredContentInstructions = getStructuredContentInstructions();

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
  console.log(`[CONTENT-AI DEBUG] ----------------------------------------`);
  console.log(`[CONTENT-AI DEBUG] Structured Content Instructions (first 2000 chars):`);
  console.log(`[CONTENT-AI DEBUG] ${structuredContentInstructions.substring(0, 2000)}`);
  console.log(`[CONTENT-AI DEBUG] ========================================`);

  const prompt = `Sei un esperto di content marketing italiano specializzato nella Piramide della Consapevolezza. Genera ${count} idee creative per contenuti COMPLETI.

CONTESTO:
- Nicchia/Settore: ${niche}
- Target Audience: ${targetAudience}
- Obiettivo: ${objective}
- Tipo Media: ${mediaType}
- Tipo Copy: ${copyType}
${additionalContext ? `- Contesto aggiuntivo: ${additionalContext}` : ''}
${brandContext}${brandVoiceContext}${kbContext}${platformSchemaContext}

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
5. suggestedHook: Un hook che cattura l'attenzione
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
        temperature: 0.8,
        maxOutputTokens: 8192,
      },
    });
    
    const responseText = result.response.text();
    const parsed = parseJsonResponse<{ ideas: ContentIdea[] }>(responseText, { ideas: [] });
    
    if (!parsed.ideas || parsed.ideas.length === 0) {
      return {
        ideas: [{
          title: "Contenuto di valore per il tuo pubblico",
          description: `Un contenuto che parla al tuo target di ${targetAudience} nel settore ${niche}`,
          aiScore: 70,
          aiReasoning: "Idea generica di fallback",
          suggestedHook: "Scopri come...",
          suggestedCta: "Scopri di più nel link in bio",
          mediaType,
          copyType,
          copyContent: "Contenuto di esempio per il tuo pubblico.",
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
      
      console.log(`[CONTENT-AI] Enriching idea "${idea.title}": mediaType=${idea.mediaType || mediaType}, structuredType=${sc?.type}, hasVideoScript=${!!videoScript}, hasImageDesc=${!!imageDescription}, hasCopyContent=${!!finalCopyContent}, copyLength=${copyLength}, lengthWarning=${lengthWarning || 'none'}`);
      
      return {
        ...idea,
        mediaType: idea.mediaType || mediaType,
        copyType: effectiveCopyType,
        videoScript: idea.videoScript || videoScript,
        imageDescription: idea.imageDescription || imageDescription,
        imageOverlayText: idea.imageOverlayText || imageOverlayText,
        copyContent: finalCopyContent,
        ...(lengthWarning && { lengthWarning }),
      };
    });
    
    return {
      ideas: enrichedIdeas,
      modelUsed: model,
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

  const platformGuidelines: Record<Platform, string> = {
    instagram: "Usa emoji moderati, hashtag (max 10), formato verticale. Max 2200 caratteri ma primo paragrafo cruciale.",
    facebook: "Testo più lungo accettato, meno hashtag, incoraggia commenti e condivisioni.",
    linkedin: "Tono professionale, focus su valore business, usa bullet points, no emoji eccessivi.",
    tiktok: "Ultra breve, diretto, trendy, usa riferimenti pop culture, hashtag trending.",
    youtube: "Descrizione SEO-friendly, timestamps, link, CTA per subscribe e like.",
    twitter: "Max 280 caratteri, conciso, usa thread se necessario, hashtag limitati.",
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
1. HOOK - Prima riga che cattura attenzione (pattern interrupt, curiosità, provocazione, domanda, statistica scioccante)
2. TARGET - "Aiuto [CHI] a [FARE COSA] [COME]" - Identifica il pubblico e il beneficio chiaro
3. PROBLEM - Il problema/pain point che il tuo target sta vivendo (rendi reale e specifico)
4. SOLUTION - La tua soluzione/offerta - cosa offri e perché funziona
5. PROOF - Riprova sociale: testimonianze, risultati, numeri, casi studio (anche struttura suggerita se non hai dati reali)
6. CTA - Call to action finale (chiara, urgente, specifica)

Genera tutti i 6 elementi + il fullCopy che li unisce in un post fluido e naturale.

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
- hook: Una frase d'impatto breve e incisiva (domanda provocatoria o affermazione forte)
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

1. HOOK - Domanda provocatoria o frase d'impatto che cattura subito l'attenzione
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

- 00-05s: HOOK - Frase d'impatto che ferma lo scroll
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

  const platformGuidelines: Record<Platform, string> = {
    instagram: "Usa emoji moderati, hashtag (max 10), formato verticale. Max 2200 caratteri ma primo paragrafo cruciale.",
    facebook: "Testo più lungo accettato, meno hashtag, incoraggia commenti e condivisioni.",
    linkedin: "Tono professionale, focus su valore business, usa bullet points, no emoji eccessivi.",
    tiktok: "Ultra breve, diretto, trendy, usa riferimenti pop culture, hashtag trending.",
    youtube: "Descrizione SEO-friendly, timestamps, link, CTA per subscribe e like.",
    twitter: "Max 280 caratteri, conciso, usa thread se necessario, hashtag limitati.",
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
