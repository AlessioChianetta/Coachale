import { getAIProvider, getModelWithThinking, getSuperAdminGeminiKeys, trackedGenerateContent } from "../ai/provider-factory";
import { GoogleGenAI } from "@google/genai";
import { db } from "../db";
import * as schema from "@shared/schema";
import { eq } from "drizzle-orm";

export interface AdvisageSettings {
  mood: 'professional' | 'energetic' | 'luxury' | 'minimalist' | 'playful';
  stylePreference: 'realistic' | '3d-render' | 'illustration' | 'cyberpunk' | 'lifestyle';
  brandColor?: string;
  brandFont?: string;
}

export interface VisualConcept {
  id: string;
  title: string;
  description: string;
  styleType: string;
  recommendedFormat: '1:1' | '4:5' | '9:16' | '16:9' | '3:4';
  promptClean: string;
  promptWithText: string;
  textContent: string;
  reasoning: string;
}

export interface AdvisageAnalysis {
  id: string;
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
  socialCaptions: Array<{
    tone: string;
    text: string;
    hashtags: string[];
  }>;
  competitiveEdge: string;
  originalText: string;
  socialNetwork: string;
  status: string;
}

export async function analyzeAdTextServerSide(
  consultantId: string,
  text: string,
  platform: string,
  settings: AdvisageSettings
): Promise<AdvisageAnalysis> {
  console.log(`[ADVISAGE-SERVER] Analyzing text for ${platform}, consultantId: ${consultantId}`);
  
  const { client, metadata, setFeature } = await getAIProvider(consultantId, consultantId);
  setFeature?.('advisage');
  const modelConfig = getModelWithThinking(metadata.name);
  
  const brandInfo = settings.brandColor 
    ? `BRAND COLOR: ${settings.brandColor}. BRAND FONT: ${settings.brandFont || 'Modern Sans'}.` 
    : '';
  
  const prompt = `Sei un direttore creativo esperto in advertising digitale ad alta conversione. Analizza questo copy pubblicitario per ${platform.toUpperCase()}.
FACTORY SETTINGS: Mood: ${settings.mood}, Style: ${settings.stylePreference}. ${brandInfo}

TEXT: "${text}"

TASK: 
1. Crea 3 concept visuali ottimizzati per generazione immagini AI pubblicitarie ad alta conversione.
2. Crea 3 caption social (Emozionale, Tecnico, Diretto) con hashtag strategici.
3. Fornisci un breve vantaggio competitivo.

REGOLE PER I PROMPT IMMAGINE (promptClean e promptWithText):
- I prompt devono descrivere visual che FERMANO LO SCROLL: alto contrasto, colori vividi, composizione dinamica.
- Usa la REGOLA DEI TERZI per posizionare gli elementi chiave.
- Prevedi SPAZIO NEGATIVO (almeno 25% dell'immagine) per overlay di testo pubblicitario.
- Applica PSICOLOGIA DEI COLORI: rosso/arancio per urgenza, blu per fiducia, verde per crescita.
- Includi un PATTERN INTERRUPT: un elemento visivo inaspettato che rompe la monotonia del feed.
- GERARCHIA VISIVA: guida l'occhio dall'hook (alto) → soggetto (centro) → area CTA (basso).
- Illuminazione drammatica e direzionale, mai piatta. Profondità di campo ridotta per look premium.
- NON includere MAI testo, loghi o watermark nell'immagine — solo visual puro.
- Qualità fotorealistica, standard da fotografia pubblicitaria commerciale.

OUTPUT JSON VALIDO con questa struttura esatta:
{
  "tone": "string",
  "objective": "string", 
  "emotion": "string",
  "cta": "string",
  "context": { "sector": "string", "product": "string", "target": "string" },
  "concepts": [{ "id": "string", "title": "string", "description": "string", "styleType": "string", "recommendedFormat": "1:1|4:5|9:16", "promptClean": "string (prompt dettagliato per visual puro senza testo, ottimizzato per ads)", "promptWithText": "string (prompt con indicazioni per spazio testo overlay)", "textContent": "string", "reasoning": "string (spiega perché questo visual converte)" }],
  "socialCaptions": [{ "tone": "string", "text": "string", "hashtags": ["string"] }],
  "competitiveEdge": "string"
}`;
  
  console.log("[ADVISAGE-SERVER] Calling AI provider with model:", modelConfig.model);
  
  const response = await client.generateContent({
    model: modelConfig.model,
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: {
      responseMimeType: "application/json",
      temperature: 0.7,
    }
  });
  
  const responseText = (response.response?.text?.() || response.text?.() || "").trim();
  console.log("[ADVISAGE-SERVER] Response length:", responseText.length);
  
  if (!responseText) {
    throw new Error("La risposta AI è vuota. Riprova.");
  }
  
  let parsed;
  try {
    parsed = JSON.parse(responseText);
  } catch (parseError) {
    console.error("[ADVISAGE-SERVER] JSON parse error. Response:", responseText.substring(0, 500));
    throw new Error("Errore nel parsing della risposta AI. Riprova.");
  }
  
  const postId = Math.random().toString(36).substr(2, 9);
  const result: AdvisageAnalysis = {
    ...parsed,
    id: postId,
    concepts: (parsed.concepts || []).map((c: any, idx: number) => ({ 
      ...c, 
      id: `${postId}_concept_${idx}` 
    })),
    originalText: text,
    socialNetwork: platform,
    status: 'completed'
  };
  
  console.log(`[ADVISAGE-SERVER] Analysis complete: ${result.concepts.length} concepts generated`);
  
  return result;
}

function buildAdImagePrompt(basePrompt: string, aspectRatio: string): string {
  const formatGuide: Record<string, string> = {
    '1:1': 'Square format (Instagram Feed). Center the focal point. Leave 20% margins for text overlay.',
    '3:4': 'Portrait format (Instagram Post 4:5). Vertical composition, subject in upper 2/3, lower 1/3 free for caption overlay.',
    '4:3': 'Landscape format. Wide composition, subject off-center using rule of thirds.',
    '9:16': 'Vertical Story/Reel format. Full-height vertical composition. Key visual hook in top 40%. Leave bottom 25% clean for swipe-up CTA area.',
    '16:9': 'Widescreen format (Facebook/LinkedIn). Panoramic composition, subject positioned at left or right third.',
  };

  const formatInstruction = formatGuide[aspectRatio] || formatGuide['1:1'];

  return `You are an elite advertising creative director generating a high-converting ad visual.

FORMAT: ${formatInstruction}

ADVERTISING VISUAL RULES (follow strictly):
- HIGH CONTRAST: Use bold color contrasts to stop the scroll. The image must pop against white/dark feed backgrounds.
- RULE OF THIRDS: Position the hero element at a power point intersection, never dead center.
- NEGATIVE SPACE: Reserve at least 25% of the image as clean space for text overlay — no busy patterns in text areas.
- COLOR PSYCHOLOGY: Use warm tones (red, orange) for urgency/action, cool tones (blue, teal) for trust/calm, green for growth/health.
- PATTERN INTERRUPT: Include one unexpected or eye-catching element that breaks the visual monotony of a social feed.
- VISUAL HIERARCHY: Guide the viewer's eye from the hook (top) → product/subject (center) → CTA area (bottom).
- LIGHTING: Use dramatic, directional lighting (not flat). Rim lighting, golden hour, or studio lighting for product shots.
- DEPTH OF FIELD: Shallow depth of field to isolate the subject and create a professional, premium look.
- NO TEXT IN IMAGE: Do NOT render any text, typography, logos, or watermarks in the image. The image is purely visual.
- PROFESSIONAL QUALITY: Photorealistic, 8K quality, commercial advertising photography standard.

CONCEPT TO VISUALIZE:
${basePrompt}`;
}

async function getGeminiApiKeyForImage(consultantId: string): Promise<string | null> {
  try {
    const [user] = await db.select()
      .from(schema.users)
      .where(eq(schema.users.id, consultantId))
      .limit(1);

    if (!user) return null;

    if (user.useSuperadminGemini !== false) {
      const superAdminKeys = await getSuperAdminGeminiKeys();
      if (superAdminKeys && superAdminKeys.keys.length > 0) {
        const index = Math.floor(Math.random() * superAdminKeys.keys.length);
        console.log(`🔑 [ADVISAGE-SERVER] Using SuperAdmin Gemini key (${index + 1}/${superAdminKeys.keys.length})`);
        return superAdminKeys.keys[index];
      }
    }

    const userApiKeys = (user.geminiApiKeys as string[]) || [];
    if (userApiKeys.length > 0) {
      const currentIndex = user.geminiApiKeyIndex || 0;
      const validIndex = currentIndex % userApiKeys.length;
      console.log(`🔑 [ADVISAGE-SERVER] Using consultant's Gemini key (${validIndex + 1}/${userApiKeys.length})`);
      return userApiKeys[validIndex];
    }

    console.error("[ADVISAGE-SERVER] No Gemini API keys available");
    return null;
  } catch (error) {
    console.error("[ADVISAGE-SERVER] Error fetching API key:", error);
    return null;
  }
}

export async function generateImageServerSide(
  consultantId: string,
  prompt: string,
  aspectRatio: '1:1' | '3:4' | '4:3' | '9:16' | '16:9' = '1:1'
): Promise<{ imageUrl: string; error?: string }> {
  console.log(`[ADVISAGE-SERVER] Generating image for consultantId: ${consultantId}`);
  console.log(`[ADVISAGE-SERVER] Prompt: ${prompt.substring(0, 100)}...`);
  console.log(`[ADVISAGE-SERVER] Aspect ratio: ${aspectRatio}`);
  
  try {
    const apiKey = await getGeminiApiKeyForImage(consultantId);
    if (!apiKey) {
      return { 
        imageUrl: "", 
        error: "Nessuna chiave API Gemini disponibile" 
      };
    }
    
    const ai = new GoogleGenAI({ apiKey });
    
    const IMAGE_MODEL = 'gemini-3.1-flash-image-preview';
    console.log(`[ADVISAGE-SERVER] Using model: ${IMAGE_MODEL}`);
    
    const adOptimizedPrompt = buildAdImagePrompt(prompt, aspectRatio);
    
    const response = await trackedGenerateContent(ai, {
      model: IMAGE_MODEL,
      contents: [{ role: 'user', parts: [{ text: adOptimizedPrompt }] }] as any,
      config: { imageConfig: { aspectRatio } } as any
    }, { consultantId, feature: 'advisage' });
    
    const part = response.candidates?.[0]?.content?.parts?.find((p: any) => p.inlineData);
    
    if (!part?.inlineData) {
      console.error("[ADVISAGE-SERVER] No image data in response");
      throw new Error("Generazione immagine fallita - nessun dato immagine nella risposta");
    }
    
    const imageUrl = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
    
    console.log(`[ADVISAGE-SERVER] Image generated successfully, size: ${part.inlineData.data.length} bytes`);
    
    return { imageUrl };
    
  } catch (error: any) {
    console.error("[ADVISAGE-SERVER] Image generation error:", error.message);
    
    if (error.message?.includes("503") || error.message?.includes("overloaded")) {
      return { 
        imageUrl: "", 
        error: "Servizio temporaneamente non disponibile. Riprova tra qualche secondo." 
      };
    }
    
    return { 
      imageUrl: "", 
      error: error.message || "Generazione immagine fallita" 
    };
  }
}

export async function analyzeAndGenerateImage(
  consultantId: string,
  text: string,
  platform: string,
  settings: AdvisageSettings = { mood: 'professional', stylePreference: 'realistic' }
): Promise<{
  analysis: AdvisageAnalysis | null;
  imageUrl: string;
  error?: string;
}> {
  console.log(`[ADVISAGE-SERVER] Full pipeline: analyze + generate for ${platform}`);
  
  try {
    const analysis = await analyzeAdTextServerSide(consultantId, text, platform, settings);
    
    if (!analysis.concepts?.length) {
      console.log("[ADVISAGE-SERVER] No concepts generated, skipping image generation");
      return { analysis, imageUrl: "", error: "Nessun concept visuale generato" };
    }
    
    const firstConcept = analysis.concepts[0];
    const promptToUse = firstConcept.promptClean || firstConcept.description;
    
    let aspectRatio: '1:1' | '3:4' | '4:3' | '9:16' | '16:9' = '1:1';
    const format = firstConcept.recommendedFormat;
    if (format === '4:5' || format === '3:4') {
      aspectRatio = '3:4';
    } else if (format === '9:16') {
      aspectRatio = '9:16';
    } else if (format === '16:9') {
      aspectRatio = '16:9';
    }
    
    const { imageUrl, error: imageError } = await generateImageServerSide(
      consultantId,
      promptToUse,
      aspectRatio
    );
    
    if (imageError) {
      console.log(`[ADVISAGE-SERVER] Image generation failed: ${imageError}`);
      return { analysis, imageUrl: "", error: imageError };
    }
    
    console.log(`[ADVISAGE-SERVER] Full pipeline complete!`);
    return { analysis, imageUrl };
    
  } catch (error: any) {
    console.error("[ADVISAGE-SERVER] Pipeline error:", error.message);
    return { 
      analysis: null, 
      imageUrl: "", 
      error: error.message || "Errore nella pipeline AdVisage" 
    };
  }
}
