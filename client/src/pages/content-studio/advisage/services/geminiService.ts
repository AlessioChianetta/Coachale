
import { GoogleGenAI } from "@google/genai";
import { AdAnalysis, AppSettings, SocialPlatform } from "../types";
import { apiRequest } from "@/lib/queryClient";

export const analyzeAdText = async (text: string, platform: SocialPlatform, settings: AppSettings): Promise<AdAnalysis> => {
  const result = await apiRequest("POST", "/api/content/advisage/analyze", {
    text,
    platform,
    mood: settings.mood,
    stylePreference: settings.stylePreference,
    brandColor: settings.brandColor,
    brandFont: settings.brandFont,
  });
  
  if (!result.success) {
    throw new Error(result.error || "Analisi fallita");
  }
  
  return result.data;
};

export const generateImageConcept = async (prompt: string, aspectRatio: "1:1" | "3:4" | "4:3" | "9:16" | "16:9", settings: AppSettings): Promise<string> => {
  if (!settings.manualApiKey) {
    throw new Error("Inserisci la tua API Key di Google AI Studio nelle impostazioni per generare immagini.");
  }
  
  console.log('[AdVisage Image] Using API key:', settings.manualApiKey.substring(0, 10) + '...');
  console.log('[AdVisage Image] Model: gemini-2.5-flash-preview-04-17');
  console.log('[AdVisage Image] Aspect ratio:', aspectRatio);
  
  const ai = new GoogleGenAI({ apiKey: settings.manualApiKey });
  
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-preview-04-17',
      contents: prompt,
      config: { 
        responseModalities: ['Text', 'Image'],
      }
    });

    console.log('[AdVisage Image] Response received:', JSON.stringify(response).substring(0, 500));
    
    const part = response.candidates?.[0]?.content?.parts?.find((p: any) => p.inlineData);
    if (part?.inlineData) return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
    throw new Error("Nessuna immagine generata. Riprova.");
  } catch (error: any) {
    console.error('[AdVisage Image] Error:', error);
    if (error.message?.includes('quota') || error.message?.includes('RESOURCE_EXHAUSTED')) {
      throw new Error("Quota API esaurita. Attendi qualche minuto o controlla i limiti su Google AI Studio.");
    }
    throw new Error(error.message || "Generazione fallita. Controlla la tua API Key nelle impostazioni.");
  }
};
