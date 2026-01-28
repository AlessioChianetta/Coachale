
export type SocialPlatform = 'instagram' | 'facebook' | 'linkedin' | 'tiktok';

export interface PostInput {
  id: string;
  text: string;
  platform: SocialPlatform;
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
}

export interface VisualConcept {
  id: string;
  title: string;
  description: string;
  styleType: string;
  recommendedFormat: "1:1" | "4:5" | "9:16";
  promptClean: string;
  promptWithText: string;
  textContent: string;
  reasoning: string;
}

export interface GeneratedImage {
  conceptId: string;
  imageUrl: string;
  variant: 'clean' | 'text';
  timestamp: number;
}

export interface AppSettings {
  mood: 'professional' | 'energetic' | 'luxury' | 'minimalist' | 'playful';
  stylePreference: 'realistic' | '3d-render' | 'illustration' | 'cyberpunk' | 'lifestyle';
  brandColor?: string;
  brandFont?: string;
  manualApiKey?: string;
  externalSourceUrl?: string;
}
