import { getAIProvider, getModelWithThinking, GEMINI_3_MODEL } from "../ai/provider-factory";
import { db } from "../db";
import { brandAssets } from "@shared/schema";
import { eq } from "drizzle-orm";

export type ContentType = "post" | "carosello" | "reel" | "video" | "story" | "articolo";
export type ContentObjective = "awareness" | "engagement" | "leads" | "sales" | "education";
export type Platform = "instagram" | "facebook" | "linkedin" | "tiktok" | "youtube" | "twitter";
export type ImageStyle = "realistic" | "illustration" | "minimal" | "bold" | "professional" | "playful";

export interface GenerateIdeasParams {
  consultantId: string;
  niche: string;
  targetAudience: string;
  contentType: ContentType;
  objective: ContentObjective;
  additionalContext?: string;
  count?: number;
}

export interface ContentIdea {
  title: string;
  description: string;
  aiScore: number;
  aiReasoning: string;
  suggestedHook: string;
  suggestedCta: string;
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

function parseJsonResponse<T>(text: string, fallback: T): T {
  try {
    const cleanedText = text
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();
    return JSON.parse(cleanedText) as T;
  } catch (error) {
    console.error("[CONTENT-AI] Failed to parse JSON response:", error);
    console.error("[CONTENT-AI] Raw text:", text.substring(0, 500));
    return fallback;
  }
}

export async function generateContentIdeas(params: GenerateIdeasParams): Promise<GenerateIdeasResult> {
  const { consultantId, niche, targetAudience, contentType, objective, additionalContext, count = 5 } = params;
  
  await rateLimitCheck(consultantId);
  
  const assets = await getBrandAssets(consultantId);
  const brandContext = assets ? `
Brand Voice: ${assets.brandVoice || 'professional'}
Tono: ${assets.toneOfVoice || 'friendly professional'}
Colori: ${JSON.stringify(assets.primaryColors || [])}
` : '';

  const prompt = `Sei un esperto di content marketing italiano. Genera ${count} idee creative per contenuti.

CONTESTO:
- Nicchia/Settore: ${niche}
- Target Audience: ${targetAudience}
- Tipo di contenuto: ${contentType}
- Obiettivo: ${objective}
${additionalContext ? `- Contesto aggiuntivo: ${additionalContext}` : ''}
${brandContext}

Per ogni idea, fornisci:
1. title: Titolo accattivante (max 60 caratteri)
2. description: Descrizione del contenuto (2-3 frasi)
3. aiScore: Punteggio di efficacia stimata (1-100)
4. aiReasoning: Motivazione del punteggio
5. suggestedHook: Un hook che cattura l'attenzione
6. suggestedCta: Call to action suggerita

RISPONDI SOLO con un JSON valido nel formato:
{
  "ideas": [
    {
      "title": "...",
      "description": "...",
      "aiScore": 85,
      "aiReasoning": "...",
      "suggestedHook": "...",
      "suggestedCta": "..."
    }
  ]
}`;

  try {
    const { client, metadata } = await getAIProvider(consultantId, "content-ideas");
    const { model } = getModelWithThinking(metadata?.provider);
    
    const result = await client.generateContent({
      model,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.8,
        maxOutputTokens: 4096,
      },
    });
    
    const responseText = result.response.text();
    const parsed = parseJsonResponse<{ ideas: ContentIdea[] }>(responseText, { ideas: [] });
    
    if (!parsed.ideas || parsed.ideas.length === 0) {
      return {
        ideas: [{
          title: "Contenuto di valore per il tuo pubblico",
          description: `Un ${contentType} che parla al tuo target di ${targetAudience} nel settore ${niche}`,
          aiScore: 70,
          aiReasoning: "Idea generica di fallback",
          suggestedHook: "Scopri come...",
          suggestedCta: "Scopri di più nel link in bio"
        }],
        modelUsed: model,
      };
    }
    
    return {
      ideas: parsed.ideas.slice(0, count),
      modelUsed: model,
    };
  } catch (error: any) {
    console.error("[CONTENT-AI] Error generating ideas:", error);
    throw new Error(`Failed to generate content ideas: ${error.message}`);
  }
}

export async function generatePostCopy(params: GeneratePostCopyParams): Promise<GeneratePostCopyResult> {
  const { consultantId, idea, platform, brandVoice, keywords, tone, maxLength } = params;
  
  await rateLimitCheck(consultantId);
  
  const assets = await getBrandAssets(consultantId);
  const effectiveBrandVoice = brandVoice || assets?.brandVoice || 'professional';
  const effectiveTone = tone || assets?.toneOfVoice || 'friendly professional';

  const platformGuidelines: Record<Platform, string> = {
    instagram: "Usa emoji moderati, hashtag (max 10), formato verticale. Max 2200 caratteri ma primo paragrafo cruciale.",
    facebook: "Testo più lungo accettato, meno hashtag, incoraggia commenti e condivisioni.",
    linkedin: "Tono professionale, focus su valore business, usa bullet points, no emoji eccessivi.",
    tiktok: "Ultra breve, diretto, trendy, usa riferimenti pop culture, hashtag trending.",
    youtube: "Descrizione SEO-friendly, timestamps, link, CTA per subscribe e like.",
    twitter: "Max 280 caratteri, conciso, usa thread se necessario, hashtag limitati.",
  };

  const prompt = `Sei un copywriter esperto di social media italiano. Crea il copy completo per un post usando il FRAMEWORK PERSUASIVO a 6 step.

IDEA DEL CONTENUTO:
${idea}

PIATTAFORMA: ${platform}
${platformGuidelines[platform]}

BRAND VOICE: ${effectiveBrandVoice}
TONO: ${effectiveTone}
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
    const { model } = getModelWithThinking(metadata?.provider);
    
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

export interface PostCopyVariation {
  hook: string;
  target: string;
  problem: string;
  solution: string;
  proof: string;
  cta: string;
  hashtags?: string[];
}

export interface GeneratePostCopyVariationsResult {
  variations: PostCopyVariation[];
  modelUsed: string;
  tokensUsed?: number;
}

export async function generatePostCopyVariations(params: GeneratePostCopyParams): Promise<GeneratePostCopyVariationsResult> {
  const { consultantId, idea, platform, brandVoice, keywords, tone, maxLength } = params;
  
  await rateLimitCheck(consultantId);
  
  const assets = await getBrandAssets(consultantId);
  const effectiveBrandVoice = brandVoice || assets?.brandVoice || 'professional';
  const effectiveTone = tone || assets?.toneOfVoice || 'friendly professional';

  const platformGuidelines: Record<Platform, string> = {
    instagram: "Usa emoji moderati, hashtag (max 10), formato verticale. Max 2200 caratteri ma primo paragrafo cruciale.",
    facebook: "Testo più lungo accettato, meno hashtag, incoraggia commenti e condivisioni.",
    linkedin: "Tono professionale, focus su valore business, usa bullet points, no emoji eccessivi.",
    tiktok: "Ultra breve, diretto, trendy, usa riferimenti pop culture, hashtag trending.",
    youtube: "Descrizione SEO-friendly, timestamps, link, CTA per subscribe e like.",
    twitter: "Max 280 caratteri, conciso, usa thread se necessario, hashtag limitati.",
  };

  const prompt = `Sei un copywriter esperto di social media italiano. Crea 3 VARIAZIONI DIVERSE del copy per un post usando il FRAMEWORK PERSUASIVO a 6 step.

IDEA DEL CONTENUTO:
${idea}

PIATTAFORMA: ${platform}
${platformGuidelines[platform]}

BRAND VOICE: ${effectiveBrandVoice}
TONO: ${effectiveTone}
${keywords?.length ? `KEYWORDS DA INCLUDERE: ${keywords.join(', ')}` : ''}
${maxLength ? `LUNGHEZZA MASSIMA: ${maxLength} caratteri` : ''}

FRAMEWORK PERSUASIVO (6 STEP) per ogni variazione:
1. HOOK - Prima riga che cattura attenzione (usa approcci DIVERSI: curiosità, provocazione, domanda, statistica)
2. TARGET - "Aiuto [CHI] a [FARE COSA] [COME]" - Identifica il pubblico e il beneficio
3. PROBLEM - Il problema/pain point che il target sta vivendo
4. SOLUTION - La tua soluzione/offerta
5. PROOF - Riprova sociale: testimonianze, risultati, numeri
6. CTA - Call to action finale (varia tra urgenza, beneficio, curiosità)

IMPORTANTE: Le 3 variazioni devono essere SIGNIFICATIVAMENTE diverse tra loro in tono e approccio.

RISPONDI SOLO con un JSON valido:
{
  "variations": [
    {
      "hook": "...",
      "target": "Aiuto [chi] a [cosa] [come]",
      "problem": "...",
      "solution": "...",
      "proof": "...",
      "cta": "...",
      "hashtags": ["..."]
    },
    {
      "hook": "...",
      "target": "Aiuto [chi] a [cosa] [come]",
      "problem": "...",
      "solution": "...",
      "proof": "...",
      "cta": "...",
      "hashtags": ["..."]
    },
    {
      "hook": "...",
      "target": "Aiuto [chi] a [cosa] [come]",
      "problem": "...",
      "solution": "...",
      "proof": "...",
      "cta": "...",
      "hashtags": ["..."]
    }
  ]
}`;

  try {
    const { client, metadata } = await getAIProvider(consultantId, "post-copy-variations");
    const { model } = getModelWithThinking(metadata?.provider);
    
    const result = await client.generateContent({
      model,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.9,
        maxOutputTokens: 4096,
      },
    });
    
    const responseText = result.response.text();
    const parsed = parseJsonResponse<{ variations: PostCopyVariation[] }>(responseText, {
      variations: [
        { hook: "Scopri qualcosa di nuovo oggi!", target: "Aiuto professionisti a crescere online", problem: "Molti non sanno da dove iniziare", solution: "Il mio metodo in 3 step", proof: "100+ clienti soddisfatti", cta: "Scopri di più nel link in bio", hashtags: [] },
        { hook: "Non crederai a quello che sto per dirti...", target: "Aiuto imprenditori a scalare", problem: "Sei bloccato nella routine quotidiana", solution: "Ecco la strategia che funziona", proof: "Risultati in 30 giorni garantiti", cta: "Commenta qui sotto!", hashtags: [] },
        { hook: "Ecco cosa devi sapere:", target: "Aiuto freelancer a trovare clienti", problem: "Fatichi a trovare clienti costanti", solution: "Un sistema automatizzato per lead", proof: "Media di 10 lead a settimana", cta: "Salva questo post per dopo!", hashtags: [] },
      ]
    });
    
    return {
      variations: parsed.variations.slice(0, 3),
      modelUsed: model,
    };
  } catch (error: any) {
    console.error("[CONTENT-AI] Error generating post copy variations:", error);
    throw new Error(`Failed to generate post copy variations: ${error.message}`);
  }
}

export async function generateCampaignContent(params: GenerateCampaignParams): Promise<GenerateCampaignResult> {
  const { consultantId, productOrService, targetAudience, objective, budget, duration, uniqueSellingPoints, brandVoice } = params;
  
  await rateLimitCheck(consultantId);
  
  const assets = await getBrandAssets(consultantId);
  const effectiveBrandVoice = brandVoice || assets?.brandVoice || 'professional';

  const prompt = `Sei un esperto di marketing e advertising italiano. Crea una strategia di campagna completa seguendo la struttura a 6 step.

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
    const { model } = getModelWithThinking(metadata?.provider);
    
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
  const effectiveColors = brandColors || assets?.primaryColors || [];

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

DESCRIZIONE CONTENUTO: ${contentDescription}
STILE: ${style} - ${styleDescriptions[style]}
PIATTAFORMA: ${platform}
ASPECT RATIO: ${specs.ratio}
${effectiveColors.length ? `COLORI BRAND: ${effectiveColors.join(', ')}` : ''}
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
    const { model } = getModelWithThinking(metadata?.provider);
    
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
