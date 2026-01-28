
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
  
  const ai = new GoogleGenAI({ apiKey: settings.manualApiKey });
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: { parts: [{ text: prompt }] },
    config: { imageConfig: { aspectRatio } }
  });

  const part = response.candidates?.[0]?.content?.parts?.find((p: any) => p.inlineData);
  if (part?.inlineData) return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
  throw new Error("Generazione fallita. Controlla la tua API Key nelle impostazioni.");
};
