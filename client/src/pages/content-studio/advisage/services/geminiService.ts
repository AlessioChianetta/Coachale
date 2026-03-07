
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

export const generateImageConcept = async (
  prompt: string, 
  aspectRatio: "1:1" | "3:4" | "4:3" | "9:16" | "16:9", 
  settings: AppSettings
): Promise<string> => {
  const result = await apiRequest("POST", "/api/content/advisage/generate-image-server", {
    prompt,
    aspectRatio,
  });
  
  if (!result.success) {
    throw new Error(result.error || "Generazione immagine fallita");
  }
  
  return result.data.imageUrl;
};
