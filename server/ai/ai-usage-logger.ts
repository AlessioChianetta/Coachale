import { db } from "../db";
import { aiUsageLog } from "../../shared/schema";

const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  'gemini-2.5-flash': { input: 0.15, output: 0.60 },
  'gemini-2.5-flash-preview-05-20': { input: 0.15, output: 0.60 },
  'gemini-2.5-pro': { input: 1.25, output: 10.00 },
  'gemini-2.5-pro-preview-05-06': { input: 1.25, output: 10.00 },
  'gemini-2.0-flash': { input: 0.10, output: 0.40 },
  'gemini-2.0-flash-lite': { input: 0.075, output: 0.30 },
  'gemini-1.5-flash': { input: 0.075, output: 0.30 },
  'gemini-1.5-pro': { input: 1.25, output: 5.00 },
};

function getModelPricing(model: string): { input: number; output: number } {
  if (MODEL_PRICING[model]) return MODEL_PRICING[model];
  for (const [key, pricing] of Object.entries(MODEL_PRICING)) {
    if (model.startsWith(key) || key.startsWith(model)) return pricing;
  }
  return { input: 0.15, output: 0.60 };
}

function calculateCost(model: string, promptTokens: number, completionTokens: number): number {
  const pricing = getModelPricing(model);
  const inputCost = (promptTokens / 1_000_000) * pricing.input;
  const outputCost = (completionTokens / 1_000_000) * pricing.output;
  return Math.round((inputCost + outputCost) * 1_000_000) / 1_000_000;
}

export interface AiUsageEntry {
  consultantId: string;
  clientId?: string | null;
  feature: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  durationMs?: number;
  metadata?: Record<string, any>;
}

export function logAiUsage(entry: AiUsageEntry): void {
  const estimatedCostUsd = calculateCost(entry.model, entry.promptTokens, entry.completionTokens);
  
  db.insert(aiUsageLog).values({
    consultantId: entry.consultantId,
    clientId: entry.clientId || null,
    feature: entry.feature,
    model: entry.model,
    promptTokens: entry.promptTokens,
    completionTokens: entry.completionTokens,
    totalTokens: entry.totalTokens,
    estimatedCostUsd,
    durationMs: entry.durationMs || null,
    metadata: entry.metadata || null,
  }).then(() => {
  }).catch((error) => {
    console.error(`⚠️ [AI-USAGE] Failed to log usage:`, error.message);
  });
}

export function extractTokenUsage(response: any): { promptTokens: number; completionTokens: number; totalTokens: number } {
  try {
    const usage = response?.usageMetadata || response?.response?.usageMetadata;
    if (usage) {
      return {
        promptTokens: usage.promptTokenCount || usage.promptTokens || 0,
        completionTokens: usage.candidatesTokenCount || usage.completionTokens || usage.generatedTokenCount || 0,
        totalTokens: usage.totalTokenCount || usage.totalTokens || 0,
      };
    }
    
    if (response?.candidates?.[0]) {
      const meta = response.usageMetadata;
      if (meta) {
        return {
          promptTokens: meta.promptTokenCount || 0,
          completionTokens: meta.candidatesTokenCount || 0,
          totalTokens: meta.totalTokenCount || 0,
        };
      }
    }
  } catch {}
  
  return { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
}
