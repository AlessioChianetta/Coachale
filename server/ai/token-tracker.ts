import { db } from "../db";
import { aiTokenUsage, users } from "../../shared/schema";
import { eq } from "drizzle-orm";

const PRICING: Record<string, { input: number; output: number; cachedInput: number }> = {
  'gemini-3-flash-preview': { input: 0.50, output: 3.00, cachedInput: 0.05 },
  'gemini-3-pro-preview': { input: 2.00, output: 12.00, cachedInput: 0.20 },
  'gemini-3-pro-image-preview': { input: 2.00, output: 12.00, cachedInput: 0.20 },
  'gemini-2.5-flash-tts': { input: 0.30, output: 2.50, cachedInput: 0.03 },
  'gemini-2.5-pro-tts': { input: 1.25, output: 10.00, cachedInput: 0.125 },
  'gemini-2.5-flash-native-audio-preview-12-2025': { input: 1.00, output: 3.00, cachedInput: 0.10 },
  'gemini-live-2.5-flash-native-audio': { input: 1.00, output: 3.00, cachedInput: 0.10 },
  'gemini-2.5-flash': { input: 0.30, output: 2.50, cachedInput: 0.03 },
  'gemini-2.5-flash-lite': { input: 0.10, output: 0.40, cachedInput: 0.01 },
  'gemini-2.0-flash-lite': { input: 0.10, output: 0.40, cachedInput: 0.01 },
  'gemini-2.5-pro': { input: 1.25, output: 10.00, cachedInput: 0.125 },
  'gemini-2.5-flash-preview-05-20': { input: 0.30, output: 2.50, cachedInput: 0.03 },
  'gemini-2.5-flash-preview-09-2025': { input: 0.30, output: 2.50, cachedInput: 0.03 },
};

const DEFAULT_PRICING = { input: 0.50, output: 3.00, cachedInput: 0.05 };

export interface TrackUsageParams {
  consultantId: string;
  clientId?: string;
  model: string;
  feature: string;
  requestType?: 'generate' | 'stream' | 'live';
  keySource?: string;
  thinkingLevel?: string;
  inputTokens?: number;
  outputTokens?: number;
  cachedTokens?: number;
  thinkingTokens?: number;
  totalTokens?: number;
  durationMs?: number;
  error?: boolean;
  hasTools?: boolean;
  hasFileSearch?: boolean;
  callerRole?: 'client' | 'consultant';
}

interface BufferEntry {
  consultantId: string;
  clientId: string | null;
  clientRole: string | null;
  keySource: string;
  model: string;
  feature: string;
  requestType: string;
  thinkingLevel: string | null;
  inputTokens: number;
  outputTokens: number;
  cachedTokens: number;
  totalTokens: number;
  thinkingTokens: number;
  inputCost: string;
  outputCost: string;
  cacheSavings: string;
  totalCost: string;
  hasFileSearch: boolean;
  hasTools: boolean;
  error: boolean;
  durationMs: number | null;
}

const roleCache = new Map<string, { role: string | null; fetchedAt: number }>();
const ROLE_CACHE_TTL = 300000;

async function resolveClientRole(clientId: string): Promise<string | null> {
  const cached = roleCache.get(clientId);
  if (cached && Date.now() - cached.fetchedAt < ROLE_CACHE_TTL) {
    return cached.role;
  }
  try {
    const [user] = await db
      .select({ role: users.role })
      .from(users)
      .where(eq(users.id, clientId))
      .limit(1);
    const role = user?.role || null;
    roleCache.set(clientId, { role, fetchedAt: Date.now() });
    return role;
  } catch (e) {
    console.error('[TokenTracker] Error resolving client role:', e);
    return null;
  }
}

function calcCost(model: string, inputTokens: number, outputTokens: number, cachedTokens: number): {
  inputCost: number; outputCost: number; cacheSavings: number; totalCost: number;
} {
  const pricing = PRICING[model] || DEFAULT_PRICING;
  const nonCachedInput = Math.max(0, inputTokens - cachedTokens);
  const inputCost = (nonCachedInput / 1_000_000) * pricing.input + (cachedTokens / 1_000_000) * pricing.cachedInput;
  const outputCost = (outputTokens / 1_000_000) * pricing.output;
  const cacheSavings = (cachedTokens / 1_000_000) * (pricing.input - pricing.cachedInput);
  const totalCost = inputCost + outputCost;
  return { inputCost, outputCost, cacheSavings, totalCost };
}

class TokenTracker {
  private buffer: BufferEntry[] = [];
  private flushTimer: NodeJS.Timeout | null = null;
  private isFlushing = false;
  private readonly MAX_BUFFER = 50;
  private readonly FLUSH_INTERVAL = 5000;

  constructor() {
    this.startFlushTimer();
    process.on('SIGTERM', () => this.flush());
    process.on('SIGINT', () => this.flush());
    process.on('beforeExit', () => this.flush());
  }

  private startFlushTimer() {
    this.flushTimer = setInterval(() => {
      if (this.buffer.length > 0) {
        this.flush();
      }
    }, this.FLUSH_INTERVAL);
    if (this.flushTimer.unref) {
      this.flushTimer.unref();
    }
  }

  async track(params: TrackUsageParams): Promise<void> {
    try {
      const inputTokens = params.inputTokens || 0;
      const outputTokens = params.outputTokens || 0;
      const cachedTokens = params.cachedTokens || 0;
      const thinkingTokens = params.thinkingTokens || 0;
      const totalTokens = params.totalTokens || (inputTokens + outputTokens);

      if (totalTokens === 0 && !params.error) {
        return;
      }

      const costs = calcCost(params.model, inputTokens, outputTokens, cachedTokens);

      let clientRole: string | null = params.callerRole || null;
      if (!clientRole) {
        const clientFeatures = ['chat-assistant', 'client-title-gen', 'data-analysis', 'client-chat', 'chat-text-response'];
        const consultantFeatures = ['consultant-chat', 'consultant-title-gen', 'ai-task-scheduler', 
          'ai-task-executor', 'ai-task-file-search', 'checkin-personalization', 'whatsapp-agent-response',
          'whatsapp-image-analysis', 'whatsapp-document-analysis', 'whatsapp-audio-transcription', 
          'whatsapp-sticker-analysis', 'tts', 'live-session', 'ai-autonomy-generate', 'ai-autonomy-task',
          'ai-autonomy-decision', 'document-processing', 'advisage', 'youtube-processing',
          'content-studio', 'email-generation', 'followup-decision', 'sales-report', 'onboarding'];
        
        if (clientFeatures.some(f => params.feature.startsWith(f))) {
          clientRole = 'client';
        } else if (consultantFeatures.some(f => params.feature.startsWith(f))) {
          clientRole = 'consultant';
        } else if (params.clientId && params.clientId !== params.consultantId) {
          clientRole = 'client';
        } else {
          clientRole = 'consultant';
        }
      }

      const entry: BufferEntry = {
        consultantId: params.consultantId,
        clientId: params.clientId || null,
        clientRole,
        keySource: params.keySource || 'unknown',
        model: params.model,
        feature: params.feature,
        requestType: params.requestType || 'generate',
        thinkingLevel: params.thinkingLevel || null,
        inputTokens,
        outputTokens,
        cachedTokens,
        totalTokens,
        thinkingTokens,
        inputCost: costs.inputCost.toFixed(6),
        outputCost: costs.outputCost.toFixed(6),
        cacheSavings: costs.cacheSavings.toFixed(6),
        totalCost: costs.totalCost.toFixed(6),
        hasFileSearch: params.hasFileSearch || false,
        hasTools: params.hasTools || false,
        error: params.error || false,
        durationMs: params.durationMs || null,
      };

      this.buffer.push(entry);
      console.log(`📊 [TokenTracker] Buffered: ${params.feature} | ${params.model} | ${totalTokens} tokens | $${costs.totalCost.toFixed(4)} | consultant=${params.consultantId} client=${params.clientId || 'self'}`);

      if (this.buffer.length >= this.MAX_BUFFER) {
        this.flush();
      }
    } catch (e) {
      console.error('[TokenTracker] Error in track():', e);
    }
  }

  private async flush(): Promise<void> {
    if (this.isFlushing || this.buffer.length === 0) return;
    this.isFlushing = true;

    const entries = [...this.buffer];
    this.buffer = [];

    try {
      await db.insert(aiTokenUsage).values(
        entries.map(e => ({
          consultantId: e.consultantId,
          clientId: e.clientId,
          clientRole: e.clientRole,
          keySource: e.keySource,
          model: e.model,
          feature: e.feature,
          requestType: e.requestType,
          thinkingLevel: e.thinkingLevel,
          inputTokens: e.inputTokens,
          outputTokens: e.outputTokens,
          cachedTokens: e.cachedTokens,
          totalTokens: e.totalTokens,
          thinkingTokens: e.thinkingTokens,
          inputCost: e.inputCost,
          outputCost: e.outputCost,
          cacheSavings: e.cacheSavings,
          totalCost: e.totalCost,
          hasFileSearch: e.hasFileSearch,
          hasTools: e.hasTools,
          error: e.error,
          durationMs: e.durationMs,
        }))
      );
      console.log(`✅ [TokenTracker] Flushed ${entries.length} entries to DB`);
    } catch (e) {
      console.error('[TokenTracker] Flush error:', e);
      this.buffer.unshift(...entries);
    } finally {
      this.isFlushing = false;
    }
  }

  getBufferSize(): number {
    return this.buffer.length;
  }
}

export const tokenTracker = new TokenTracker();
