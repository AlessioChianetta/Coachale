
import { GoogleGenAI, Type } from "@google/genai";
import { AdAnalysis, AppSettings, SocialPlatform } from "../types";

const getClient = (settings: AppSettings) => {
  // Se l'utente ha inserito una chiave manuale nelle impostazioni, usa quella.
  // Altrimenti usa quella d'ambiente (se disponibile).
  const key = settings.manualApiKey || process.env.API_KEY || "";
  return new GoogleGenAI({ apiKey: key });
};

export const analyzeAdText = async (text: string, platform: SocialPlatform, settings: AppSettings): Promise<AdAnalysis> => {
  const ai = getClient(settings);
  const postId = Math.random().toString(36).substr(2, 9);
  
  const brandInfo = settings.brandColor ? `BRAND COLOR: ${settings.brandColor}. BRAND FONT: ${settings.brandFont || 'Modern Sans'}.` : '';

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Analizza questo copy pubblicitario per ${platform.toUpperCase()}.
    FACTORY SETTINGS: Mood: ${settings.mood}, Style: ${settings.stylePreference}. ${brandInfo}
    
    TEXT: "${text}"
    
    TASK: 
    1. Crea 3 concept visuali per generazione immagini AI.
    2. Crea 3 caption social (Emozionale, Tecnico, Diretto) con hashtag.
    3. Fornisci un breve vantaggio competitivo.
    
    REGOLE TESTO: Il testo nell'immagine deve stare in una "SAFE ZONE" centrale (15% di margine dai bordi).
    
    OUTPUT JSON:
    - socialCaptions: array di {tone, text, hashtags}
    - competitiveEdge: stringa descrittiva.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          tone: { type: Type.STRING },
          objective: { type: Type.STRING },
          emotion: { type: Type.STRING },
          cta: { type: Type.STRING },
          context: {
            type: Type.OBJECT,
            properties: {
              sector: { type: Type.STRING },
              product: { type: Type.STRING },
              target: { type: Type.STRING },
            },
            required: ["sector", "product", "target"]
          },
          concepts: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING },
                title: { type: Type.STRING },
                description: { type: Type.STRING },
                styleType: { type: Type.STRING },
                recommendedFormat: { type: Type.STRING, enum: ["1:1", "4:5", "9:16"] },
                promptClean: { type: Type.STRING },
                promptWithText: { type: Type.STRING },
                textContent: { type: Type.STRING },
                reasoning: { type: Type.STRING }
              }
            }
          },
          socialCaptions: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                tone: { type: Type.STRING },
                text: { type: Type.STRING },
                hashtags: { type: Type.ARRAY, items: { type: Type.STRING } }
              }
            }
          },
          competitiveEdge: { type: Type.STRING }
        },
        required: ["tone", "objective", "emotion", "cta", "context", "concepts", "socialCaptions", "competitiveEdge"]
      }
    }
  });

  const parsed = JSON.parse(response.text.trim());
  return {
    ...parsed,
    id: postId,
    concepts: parsed.concepts.map((c: any) => ({ ...c, id: `${postId}_${c.id}` })),
    originalText: text,
    socialNetwork: platform,
    status: 'completed'
  };
};

export const generateImageConcept = async (prompt: string, aspectRatio: "1:1" | "3:4" | "4:3" | "9:16" | "16:9", settings: AppSettings): Promise<string> => {
  const ai = getClient(settings);
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: { parts: [{ text: prompt }] },
    config: { imageConfig: { aspectRatio } }
  });

  const part = response.candidates?.[0]?.content?.parts.find(p => p.inlineData);
  if (part?.inlineData) return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
  throw new Error("Generazione fallita. Controlla la tua API Key nelle impostazioni.");
};
