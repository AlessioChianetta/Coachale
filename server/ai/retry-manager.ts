/**
 * Unified retry manager for AI service calls (streaming and non-streaming)
 * Provides consistent retry logic, heartbeat events, and provider metadata propagation
 */

// Single source of truth for retry delays
export const RETRY_DELAYS_MS = [3000, 5000, 10000, 15000, 30000]; // 3s, 5s, 10s, 15s, 30s
export const MAX_RETRY_ATTEMPTS = RETRY_DELAYS_MS.length + 1; // 6 total (1 initial + 5 retries)

/**
 * AI provider metadata included in all events
 */
export interface AiProviderMetadata {
  name: 'Vertex AI (tuo)' | 'Vertex AI (admin)' | 'Google AI Studio';
  managedBy?: 'admin' | 'self';
  expiresAt?: Date;
}

/**
 * Context for retry operations
 */
export interface AiRetryContext {
  conversationId: string;
  provider: AiProviderMetadata;
  emit: (event: AiRetryEvent) => void | Promise<void>;
}

/**
 * Usage metadata from Gemini API (real token counts)
 */
export interface GeminiUsageMetadata {
  promptTokenCount?: number;
  candidatesTokenCount?: number;
  totalTokenCount?: number;
  cachedContentTokenCount?: number;
}

/**
 * Events emitted during retry process
 */
export type AiRetryEvent =
  | {
      type: 'retry';
      conversationId: string;
      provider: AiProviderMetadata;
      attempt: number;
      maxAttempts: number;
      delayMs: number;
      nextRetryAt: Date;
      message: string;
    }
  | {
      type: 'heartbeat';
      conversationId: string;
      provider: AiProviderMetadata;
      remainingMs: number;
    }
  | {
      type: 'start';
      conversationId: string;
      provider: AiProviderMetadata;
    }
  | {
      type: 'delta';
      conversationId: string;
      provider: AiProviderMetadata;
      content: string;
    }
  | {
      type: 'thinking';
      conversationId: string;
      provider: AiProviderMetadata;
      content: string;
    }
  | {
      type: 'complete';
      conversationId: string;
      provider: AiProviderMetadata;
      content: string;
      usageMetadata?: GeminiUsageMetadata;
    }
  | {
      type: 'error';
      conversationId: string;
      provider: AiProviderMetadata;
      error: string;
    };

/**
 * Options for retry operations
 */
export interface RetryOptions {
  maxAttempts?: number;
  delays?: number[];
  retryableErrorCheck?: (error: any) => boolean;
  signal?: AbortSignal;
}

/**
 * Operation context passed to retryable functions
 */
export interface OperationAttemptContext {
  attempt: number;
  maxAttempts: number;
  signal?: AbortSignal;
}

/**
 * Default check for retryable errors (503, UNAVAILABLE, overloaded)
 */
export function isRetryableError(error: any): boolean {
  return (
    error.status === 500 ||
    error.status === 503 ||
    error.status === 'UNAVAILABLE' ||
    error.status === 'SERVICE_UNAVAILABLE' ||
    error.status === 'INTERNAL' ||
    (error.error && error.error.status === 'UNAVAILABLE') ||
    (error.error && error.error.code === 500) ||
    (error.error && error.error.code === 503) ||
    (error.message && error.message.includes('500')) ||
    (error.message && error.message.includes('503')) ||
    (error.message && error.message.toLowerCase().includes('overloaded')) ||
    (error.message && error.message.toLowerCase().includes('unavailable')) ||
    (error.message && error.message.toLowerCase().includes('internal'))
  );
}

/**
 * Emit retry and heartbeat events during delay
 */
async function emitRetryWithHeartbeat(
  context: AiRetryContext,
  attempt: number,
  maxAttempts: number,
  delayMs: number
): Promise<void> {
  const nextRetryAt = new Date(Date.now() + delayMs);

  // Emit retry event
  await context.emit({
    type: 'retry',
    conversationId: context.conversationId,
    provider: context.provider,
    attempt,
    maxAttempts,
    delayMs,
    nextRetryAt,
    message: `Riprovo tra ${Math.ceil(delayMs / 1000)}s...`,
  });

  // Wait with heartbeat every 2s to keep connection alive
  const startWait = Date.now();
  while (Date.now() - startWait < delayMs) {
    const remainingMs = delayMs - (Date.now() - startWait);
    const heartbeatInterval = Math.min(2000, remainingMs);

    await new Promise(resolve => setTimeout(resolve, heartbeatInterval));

    // Emit heartbeat if still waiting
    if (Date.now() - startWait < delayMs) {
      await context.emit({
        type: 'heartbeat',
        conversationId: context.conversationId,
        provider: context.provider,
        remainingMs: Math.max(0, delayMs - (Date.now() - startWait)),
      });
    }
  }
}

/**
 * Non-streaming retry with backoff
 * For REST-style AI calls (generateContent, etc.)
 */
export async function retryWithBackoff<T>(
  operation: (ctx: OperationAttemptContext) => Promise<T>,
  context: AiRetryContext,
  options: RetryOptions = {}
): Promise<T> {
  const delays = options.delays || RETRY_DELAYS_MS;
  const maxAttempts = options.maxAttempts || MAX_RETRY_ATTEMPTS;
  const isRetryable = options.retryableErrorCheck || isRetryableError;

  let lastError: any;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      // Check for abort signal
      if (options.signal?.aborted) {
        throw new Error('Operation aborted');
      }

      // Wait and emit events before retry (skip on first attempt)
      if (attempt > 0) {
        const delayMs = delays[attempt - 1];
        console.log(`⏳ Retry attempt ${attempt + 1}/${maxAttempts} after ${delayMs}ms delay...`);
        await emitRetryWithHeartbeat(context, attempt + 1, maxAttempts, delayMs);
      }

      console.log(`🔄 AI operation attempt ${attempt + 1}/${maxAttempts}...`);

      const result = await operation({
        attempt,
        maxAttempts,
        signal: options.signal,
      });

      console.log(`✅ AI operation successful on attempt ${attempt + 1}`);
      return result;
    } catch (error: any) {
      lastError = error;

      // Check if error is retryable
      if (isRetryable(error) && attempt < maxAttempts - 1) {
        console.warn(`⚠️ Retryable error on attempt ${attempt + 1}. Will retry...`);
        continue;
      } else {
        console.error(`❌ AI operation error on attempt ${attempt + 1}:`, error.message || error);
        throw error;
      }
    }
  }

  throw lastError || new Error('Failed to complete operation after retries');
}

/**
 * Gemini chunk part with thinking support
 */
export interface GeminiPart {
  text?: string;
  thought?: boolean;
}

/**
 * Gemini chunk with candidates structure (for thinking support)
 */
export interface GeminiStreamChunk {
  text?: string;
  usageMetadata?: GeminiUsageMetadata;
  candidates?: Array<{
    content?: {
      parts?: GeminiPart[];
    };
  }>;
}

/**
 * Streaming retry with backoff
 * For streaming AI calls (generateContentStream, etc.)
 */
export async function* streamWithBackoff<TChunk extends GeminiStreamChunk>(
  streamFactory: (ctx: OperationAttemptContext) => Promise<AsyncIterable<TChunk>>,
  context: AiRetryContext,
  options: RetryOptions = {}
): AsyncGenerator<AiRetryEvent> {
  const delays = options.delays || RETRY_DELAYS_MS;
  const maxAttempts = options.maxAttempts || MAX_RETRY_ATTEMPTS;
  const isRetryable = options.retryableErrorCheck || isRetryableError;

  let accumulatedMessage = '';
  let streamSuccess = false;
  let lastError: any;
  let lastUsageMetadata: GeminiUsageMetadata | undefined;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      // Check for abort signal
      if (options.signal?.aborted) {
        throw new Error('Stream aborted');
      }

      // Wait and emit events before retry (skip on first attempt)
      if (attempt > 0) {
        const delayMs = delays[attempt - 1];
        console.log(`⏳ Retry stream attempt ${attempt + 1}/${maxAttempts} after ${delayMs}ms delay...`);

        // Emit retry event
        yield {
          type: 'retry',
          conversationId: context.conversationId,
          provider: context.provider,
          attempt: attempt + 1,
          maxAttempts,
          delayMs,
          nextRetryAt: new Date(Date.now() + delayMs),
          message: `Riprovo tra ${Math.ceil(delayMs / 1000)}s...`,
        };

        // Wait with heartbeat
        const startWait = Date.now();
        while (Date.now() - startWait < delayMs) {
          const remainingMs = delayMs - (Date.now() - startWait);
          const heartbeatInterval = Math.min(2000, remainingMs);

          await new Promise(resolve => setTimeout(resolve, heartbeatInterval));

          if (Date.now() - startWait < delayMs) {
            yield {
              type: 'heartbeat',
              conversationId: context.conversationId,
              provider: context.provider,
              remainingMs: Math.max(0, delayMs - (Date.now() - startWait)),
            };
          }
        }

        // Reset accumulated message and usage metadata on retry
        accumulatedMessage = '';
        lastUsageMetadata = undefined;
      }

      console.log(`🔄 AI stream attempt ${attempt + 1}/${maxAttempts}...`);
      const streamResponse = await streamFactory({
        attempt,
        maxAttempts,
        signal: options.signal,
      });

      // Emit start event
      if (attempt === 0 || accumulatedMessage === '') {
        yield {
          type: 'start',
          conversationId: context.conversationId,
          provider: context.provider,
        };
      }

      // Stream chunks to client
      let chunkIndex = 0;
      let thinkingChunksCount = 0;
      let deltaChunksCount = 0;
      let fallbackChunksCount = 0;
      
      for await (const chunk of streamResponse) {
        chunkIndex++;
        
        // DEBUG: Log chunk structure on first few chunks
        if (chunkIndex <= 3) {
          console.log(`🔍 [CHUNK DEBUG #${chunkIndex}] Keys:`, Object.keys(chunk));
          console.log(`   - has candidates: ${!!chunk.candidates}`);
          console.log(`   - has text(): ${typeof chunk.text === 'function'}`);
          console.log(`   - has text (string): ${typeof chunk.text === 'string'}`);
          if (chunk.candidates?.[0]) {
            console.log(`   - candidate[0] keys:`, Object.keys(chunk.candidates[0]));
            if (chunk.candidates[0].content) {
              console.log(`   - content keys:`, Object.keys(chunk.candidates[0].content));
              if (chunk.candidates[0].content.parts) {
                console.log(`   - parts count:`, chunk.candidates[0].content.parts.length);
                chunk.candidates[0].content.parts.forEach((p: any, i: number) => {
                  console.log(`     - part[${i}]: thought=${p.thought}, hasText=${!!p.text}, textPreview="${(p.text || '').substring(0, 50)}..."`);
                });
              }
            }
          }
        }
        
        // Check if chunk has candidates with parts (Gemini thinking format)
        const parts = chunk.candidates?.[0]?.content?.parts;
        
        if (parts && parts.length > 0) {
          // Process each part - thinking parts have thought: true
          for (const part of parts) {
            if (part.text) {
              if (part.thought === true) {
                thinkingChunksCount++;
                // This is a thinking/reasoning part
                yield {
                  type: 'thinking',
                  conversationId: context.conversationId,
                  provider: context.provider,
                  content: part.text,
                };
              } else {
                deltaChunksCount++;
                // This is a regular response part
                accumulatedMessage += part.text;
                yield {
                  type: 'delta',
                  conversationId: context.conversationId,
                  provider: context.provider,
                  content: part.text,
                };
              }
            }
          }
        } else {
          // Fallback to legacy chunk.text format (backward compatibility)
          let chunkText = '';
          if (typeof chunk.text === 'function') {
            chunkText = chunk.text();
          } else if (typeof chunk.text === 'string') {
            chunkText = chunk.text;
          }
          
          if (chunkText) {
            fallbackChunksCount++;
            if (fallbackChunksCount === 1) {
              console.log(`⚠️ [FALLBACK MODE] Using legacy chunk.text - thinking separation NOT available`);
            }
            accumulatedMessage += chunkText;
            yield {
              type: 'delta',
              conversationId: context.conversationId,
              provider: context.provider,
              content: chunkText,
            };
          }
        }
        
        // Capture usageMetadata from chunks (typically available in final chunk)
        if (chunk.usageMetadata) {
          lastUsageMetadata = chunk.usageMetadata;
        }
      }

      // Success - streaming completed
      streamSuccess = true;
      console.log(`✅ AI streaming completed successfully on attempt ${attempt + 1}`);
      console.log(`📊 [STREAM STATS] Total chunks: ${chunkIndex}, Thinking: ${thinkingChunksCount}, Delta: ${deltaChunksCount}, Fallback: ${fallbackChunksCount}`);
      break;
    } catch (error: any) {
      lastError = error;

      // Check if error is retryable
      if (isRetryable(error) && attempt < maxAttempts - 1) {
        console.warn(`⚠️ Retryable stream error on attempt ${attempt + 1}. Will retry...`);
        continue;
      } else {
        console.error(`❌ AI streaming error on attempt ${attempt + 1}:`, error.message || error);
        throw error;
      }
    }
  }

  if (!streamSuccess) {
    throw lastError || new Error('Failed to complete AI streaming after retries');
  }

  // Emit complete event with usageMetadata if available
  yield {
    type: 'complete',
    conversationId: context.conversationId,
    provider: context.provider,
    content: accumulatedMessage,
    usageMetadata: lastUsageMetadata,
  };

  return accumulatedMessage;
}
