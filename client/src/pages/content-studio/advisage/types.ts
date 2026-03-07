
export type SocialPlatform = 'instagram' | 'facebook' | 'linkedin' | 'tiktok' | 'twitter';

export interface PostInput {
  id: string;
  text: string;
  platform: SocialPlatform;
  sourcePostId?: string;  // ID del post originale se importato
  sourcePostTitle?: string; // Titolo del post per riferimento
  sourceScheduledDate?: string; // Data programmata del post originale
  sourceStatus?: string; // Stato del post originale (draft, scheduled, published)
  sourceMediaType?: string; // Tipo media del post originale
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
  status: 'pending' | 'analyzing' | 'completed' | 'error';
  sourcePostId?: string;  // ID del post originale se importato
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
}

export type AdImageFormat = '1:1' | '4:5' | '9:16' | '16:9' | '4:3';

export interface AppSettings {
  mood: 'professional' | 'energetic' | 'luxury' | 'minimalist' | 'playful';
  stylePreference: 'realistic' | '3d-render' | 'illustration' | 'cyberpunk' | 'lifestyle';
  imageFormat: AdImageFormat;
  brandColor?: string;
  brandFont?: string;
  externalSourceUrl?: string;
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
