
export type SocialPlatform = 'instagram' | 'facebook' | 'linkedin' | 'tiktok' | 'twitter';

export interface PostInput {
  id: string;
  text: string;
  platform: SocialPlatform;
  sourcePostId?: string;
  sourcePostTitle?: string;
  sourceScheduledDate?: string;
  sourceStatus?: string;
  sourceMediaType?: string;
}

export interface RecommendedSettings {
  mood?: string;
  stylePreference?: string;
  lightingStyle?: string;
  colorGrading?: string;
  cameraAngle?: string;
  backgroundStyle?: string;
  imageFormat?: string;
  reasoning?: string;
}

export interface AdAnalysis {
  id: string;
  originalText: string;
  socialNetwork: SocialPlatform;
  tone: string;
  objective: string;
  emotion: string;
  cta: string;
  context: {
    sector: string;
    product: string;
    target: string;
  };
  concepts: VisualConcept[];
  socialCaptions: {
    tone: string;
    text: string;
    hashtags: string[];
  }[];
  competitiveEdge: string;
  recommendedSettings?: RecommendedSettings;
  status: 'pending' | 'analyzing' | 'completed' | 'error';
  sourcePostId?: string;
  sourcePostTitle?: string;
}

export interface PromptVisual {
  layout: {
    tipo: string;
    divisione?: string;
  };
  sezioni: Array<{
    nome: string;
    sfondo: string;
    soggetto: string;
    illuminazione?: string;
    box_testi?: string[];
    stile_box?: string;
  }>;
  elemento_centrale?: string;
  hook_text?: {
    testo: string;
    posizione: string;
    stile: string;
  };
  stile_fotografico: string;
  colori_brand?: string;
  note_aggiuntive?: string;
}

export interface VisualConcept {
  id: string;
  title: string;
  description: string;
  styleType: string;
  recommendedFormat: "1:1" | "4:5" | "9:16" | "16:9" | "4:3" | "3:4";
  promptClean: string;
  promptWithText: string;
  promptVisual?: PromptVisual;
  textContent: string;
  reasoning: string;
}

export interface GeneratedImage {
  conceptId: string;
  imageUrl: string;
  variant: 'clean' | 'text';
  timestamp: number;
  savedToSession?: 'pending' | 'saved' | 'failed';
  savedFilePath?: string;
  linkedToPost?: boolean;
}

export type AdImageFormat = '1:1' | '4:5' | '9:16' | '16:9' | '4:3' | '2:3' | '3:2' | '5:4' | '21:9';

export type LightingStyle = 'studio' | 'natural' | 'dramatic' | 'neon' | 'soft';
export type ColorGrading = 'neutral' | 'warm' | 'cold' | 'cinematic' | 'vintage' | 'vibrant';
export type CameraAngle = 'standard' | 'closeup' | 'wideshot' | 'flatlay' | 'lowangle' | 'aerial';
export type BackgroundStyle = 'studio' | 'outdoor' | 'gradient' | 'blur' | 'contextual';
export type ImageQuality = 'standard' | 'high';

export interface AppSettings {
  mood: 'professional' | 'energetic' | 'luxury' | 'minimalist' | 'playful';
  stylePreference: 'realistic' | '3d-render' | 'illustration' | 'cyberpunk' | 'lifestyle';
  imageFormat: AdImageFormat;
  brandColor?: string;
  brandFont?: string;
  externalSourceUrl?: string;
  lightingStyle?: LightingStyle;
  colorGrading?: ColorGrading;
  cameraAngle?: CameraAngle;
  backgroundStyle?: BackgroundStyle;
  imageQuality?: ImageQuality;
}

export interface ConceptTypeOption {
  id: string;
  label: string;
  description: string;
  referenceImage?: string;
}

export const CONCEPT_TYPES: ConceptTypeOption[] = [
  {
    id: 'call-out-benefici',
    label: 'Call Out Benefici',
    description: 'Immagine che evidenzia i benefici principali con frecce e callout',
    referenceImage: '/images/advisage/call-out-benefici.png',
  },
  {
    id: 'social-proof-avatar',
    label: 'Social Proof Avatar',
    description: 'Immagine con avatar cliente e testimonianza sovrapposta al prodotto',
    referenceImage: '/images/advisage/social-proof-avatar.png',
  },
  {
    id: 'x-ragioni-acquistare',
    label: 'X Ragioni per Acquistare',
    description: 'Visual con elenco numerato dei motivi per acquistare',
  },
  {
    id: 'offerta-headline-usp',
    label: 'Offerta / Headline USP',
    description: 'Immagine focalizzata sull\'offerta principale o USP con headline bold',
    referenceImage: '/images/advisage/offerta-headline-usp.png',
  },
  {
    id: 'noi-vs-competitor',
    label: 'Noi vs Competitor',
    description: 'Visual comparativo split-screen tra brand e concorrenza',
    referenceImage: '/images/advisage/noi-vs-competitor.png',
  },
  {
    id: 'risultato-desiderabile',
    label: 'Risultato Desiderabile',
    description: 'Visual aspirazionale che mostra il risultato finale per il cliente',
  },
];

export const PROMPT_MAPPINGS = {
  mood: {
    luxury: 'Atmosfera di lusso sofisticato, materiali premium, finiture eleganti, palette toni caldi dorati e neutri profondi',
    energetic: 'Atmosfera dinamica e vibrante, colori saturi e contrastati, composizione diagonale che comunica movimento ed energia',
    professional: 'Atmosfera corporate e autorevole, colori sobri e raffinati, composizione pulita e ordinata',
    minimalist: 'Atmosfera zen e essenziale, ampi spazi negativi, palette monocromatica, composizione centrata e simmetrica',
    playful: 'Atmosfera giocosa e fresca, colori pastello vivaci, composizione asimmetrica e dinamica',
  },
  stylePreference: {
    realistic: 'Fotografia professionale da studio. Obiettivo 85mm f/1.8, profondità di campo selettiva. Illuminazione da set a tre punti. Texture fisiche autentiche, resa materiali fotorealistica.',
    '3d-render': 'Rendering 3D fotorealistico con materiali PBR (Physically Based Rendering), ombre ray-traced precise, ambiente HDRI, superfici con riflessi e rifrazione accurati.',
    illustration: 'Illustrazione flat design professionale con colori solidi e ben bilanciati, linee pulite e definite, forme geometriche semplificate, stile editoriale moderno.',
    cyberpunk: 'Estetica cyber/neon futuristica, luci al neon blu elettrico e magenta, riflessi bagnati su superfici, atmosfera notturna urbana, effetti lens flare.',
    lifestyle: 'Fotografia lifestyle naturale, luce ambiente morbida, ambientazione quotidiana autentica, colori caldi e naturali, composizione spontanea ma curata.',
  },
  lightingStyle: {
    studio: 'Illuminazione da studio a tre punti: luce principale softbox a 45° per modellare il soggetto, fill light morbida per le ombre, rim light per separazione dal fondo.',
    natural: 'Luce naturale golden hour, raggi caldi e morbidi, ombre lunghe e delicate, atmosfera calda e accogliente.',
    dramatic: 'Chiaroscuro drammatico, contrasto estremo tra luci e ombre, ombre nette e profonde, atmosfera intensa e cinematografica.',
    neon: 'Illuminazione neon colorata con riflessi cromatici multipli, atmosfera da club/urbana notturna, colori vividi che si riflettono sulle superfici.',
    soft: 'Luce diffusa ultra-morbida, zero ombre dure, atmosfera eterea e sognante, come luce filtrata da tende bianche.',
  },
  colorGrading: {
    neutral: 'Color grading cinematografico naturale — colori saturi ma credibili, mai artificiali o plastici.',
    warm: 'Color grading caldo, tonalità ambrate e dorate, highlights caldi, atmosfera accogliente e invitante.',
    cold: 'Color grading freddo, tonalità blu e ciano dominanti, atmosfera invernale o tecnologica, contrasto pulito.',
    cinematic: 'Color grading cinematografico orange & teal (arancione nelle pelli, teal nelle ombre), contrasto profondo, look da film hollywoodiano.',
    vintage: 'Color grading vintage film analogico, grana leggera, colori leggermente desaturati con toni seppia, neri rialzati.',
    vibrant: 'Colori ultra-saturi e vivaci, contrasto alto, look pop commerciale d\'impatto, ogni colore spinto al massimo della vivacità.',
  },
  cameraAngle: {
    standard: 'Inquadratura a livello degli occhi, composizione classica con regola dei terzi.',
    closeup: 'Close-up ravvicinato, dettaglio del soggetto con bokeh estremo, intimo e d\'impatto.',
    wideshot: 'Inquadratura ampia che include ambiente e contesto, il soggetto nel suo spazio.',
    flatlay: 'Flat lay dall\'alto (90°), oggetti disposti con cura su superficie piatta, composizione geometrica ordinata.',
    lowangle: 'Inquadratura dal basso verso l\'alto, effetto eroico e imponente, il soggetto domina la scena.',
    aerial: 'Vista aerea/drone, prospettiva dall\'alto che rivela pattern e composizione.',
  },
  backgroundStyle: {
    studio: 'Sfondo studio fotografico con fondale infinito (cyclorama), pulito e professionale.',
    outdoor: 'Ambientazione esterna naturale, location reale con elementi ambientali autentici.',
    gradient: 'Sfondo gradiente morbido professionale, transizione cromatica elegante, nessun elemento di distrazione.',
    blur: 'Sfondo fortemente sfocato (bokeh f/1.4), soggetto completamente isolato e protagonista assoluto.',
    contextual: 'Sfondo contestuale che racconta una storia (ufficio, casa, negozio, palestra) — coerente con il messaggio dell\'inserzione.',
  },
} as const;
