/**
 * Gemini Rate Limiter
 * 
 * Provides:
 * 1. Global semaphore limiting concurrent Gemini calls to max 3
 * 2. Retry with exponential backoff specifically for 503 errors (2s, 4s, 8s)
 * 3. Wrapper function for all Gemini API calls
 */

const MAX_CONCURRENT_REQUESTS = 3;
const RETRY_DELAYS_503 = [2000, 4000, 8000]; // 2s, 4s, 8s for 503 errors
const MAX_RETRIES_503 = 3;

class GeminiSemaphore {
  private currentRequests = 0;
  private queue: Array<() => void> = [];

  async acquire(): Promise<void> {
    if (this.currentRequests < MAX_CONCURRENT_REQUESTS) {
      this.currentRequests++;
      console.log(`🔒 [Semaphore] Acquired slot (${this.currentRequests}/${MAX_CONCURRENT_REQUESTS} in use)`);
      return;
    }

    console.log(`⏳ [Semaphore] Queue position ${this.queue.length + 1}, waiting for slot...`);
    return new Promise((resolve) => {
      this.queue.push(() => {
        this.currentRequests++;
        console.log(`🔒 [Semaphore] Acquired slot from queue (${this.currentRequests}/${MAX_CONCURRENT_REQUESTS} in use)`);
        resolve();
      });
    });
  }

  release(): void {
    this.currentRequests--;
    console.log(`🔓 [Semaphore] Released slot (${this.currentRequests}/${MAX_CONCURRENT_REQUESTS} in use)`);

    const next = this.queue.shift();
    if (next) {
      next();
    }
  }

  getStatus(): { current: number; queued: number; max: number } {
    return {
      current: this.currentRequests,
      queued: this.queue.length,
      max: MAX_CONCURRENT_REQUESTS,
    };
  }
}

const globalSemaphore = new GeminiSemaphore();

/**
 * Check if an error is a 503 Service Unavailable error
 */
function is503Error(error: any): boolean {
  return (
    error.status === 503 ||
    error.code === 503 ||
    (error.error && error.error.code === 503) ||
    (error.message && error.message.includes('503')) ||
    (error.message && error.message.toLowerCase().includes('service unavailable')) ||
    (error.message && error.message.toLowerCase().includes('overloaded'))
  );
}

/**
 * Check if an error is a network/fetch failure (should also retry)
 */
function isFetchError(error: any): boolean {
  return (
    (error.message && error.message.toLowerCase().includes('fetch failed')) ||
    (error.message && error.message.toLowerCase().includes('network')) ||
    (error.message && error.message.toLowerCase().includes('econnrefused')) ||
    (error.message && error.message.toLowerCase().includes('timeout')) ||
    (error.cause && error.cause.code === 'ECONNREFUSED')
  );
}

/**
 * Check if error is retryable (503 or network errors)
 */
export function isRetryableGeminiError(error: any): boolean {
  return is503Error(error) || isFetchError(error);
}

/**
 * Sleep for a given number of milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface RateLimitedCallOptions {
  skipSemaphore?: boolean;
  skipRetry?: boolean;
  context?: string;
}

/**
 * Execute a Gemini API call with rate limiting and retry logic
 * 
 * @param operation - The async function that makes the Gemini API call
 * @param options - Optional configuration
 * @returns The result of the operation
 */
export async function rateLimitedGeminiCall<T>(
  operation: () => Promise<T>,
  options: RateLimitedCallOptions = {}
): Promise<T> {
  const context = options.context || 'Gemini call';
  
  if (!options.skipSemaphore) {
    await globalSemaphore.acquire();
  }

  try {
    return await executeWithRetry(operation, context, options.skipRetry);
  } finally {
    if (!options.skipSemaphore) {
      globalSemaphore.release();
    }
  }
}

/**
 * Execute operation with retry logic for 503 errors
 */
async function executeWithRetry<T>(
  operation: () => Promise<T>,
  context: string,
  skipRetry?: boolean
): Promise<T> {
  let lastError: any;

  for (let attempt = 0; attempt <= (skipRetry ? 0 : MAX_RETRIES_503 - 1); attempt++) {
    try {
      if (attempt > 0) {
        const delayMs = RETRY_DELAYS_503[attempt - 1];
        console.log(`⏳ [RateLimiter] ${context}: Retry ${attempt}/${MAX_RETRIES_503 - 1} after ${delayMs}ms delay...`);
        await sleep(delayMs);
      }

      const result = await operation();
      
      if (attempt > 0) {
        console.log(`✅ [RateLimiter] ${context}: Success on retry ${attempt}`);
      }
      
      return result;
    } catch (error: any) {
      lastError = error;
      
      if (isRetryableGeminiError(error) && attempt < MAX_RETRIES_503 - 1 && !skipRetry) {
        console.warn(`⚠️ [RateLimiter] ${context}: Retryable error on attempt ${attempt + 1}: ${error.message || error}`);
        continue;
      }
      
      console.error(`❌ [RateLimiter] ${context}: Non-retryable error or max retries reached: ${error.message || error}`);
      throw error;
    }
  }

  throw lastError || new Error(`${context}: Failed after ${MAX_RETRIES_503} attempts`);
}

/**
 * Get current semaphore status for monitoring
 */
export function getSemaphoreStatus(): { current: number; queued: number; max: number } {
  return globalSemaphore.getStatus();
}

/**
 * Execute multiple Gemini calls sequentially (for cron jobs)
 * This ensures calls are made one at a time, not in parallel
 */
export async function sequentialGeminiCalls<T, R>(
  items: T[],
  operation: (item: T, index: number) => Promise<R>,
  options: { context?: string; onProgress?: (completed: number, total: number) => void } = {}
): Promise<Array<{ success: boolean; result?: R; error?: string; item: T }>> {
  const context = options.context || 'Sequential Gemini calls';
  const results: Array<{ success: boolean; result?: R; error?: string; item: T }> = [];

  console.log(`🔄 [Sequential] ${context}: Processing ${items.length} items one by one...`);

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    
    try {
      const result = await rateLimitedGeminiCall(
        () => operation(item, i),
        { context: `${context} [${i + 1}/${items.length}]` }
      );
      
      results.push({ success: true, result, item });
      
      if (options.onProgress) {
        options.onProgress(i + 1, items.length);
      }
    } catch (error: any) {
      console.error(`❌ [Sequential] ${context} [${i + 1}/${items.length}]: Failed - ${error.message}`);
      results.push({ success: false, error: error.message, item });
    }
  }

  const successCount = results.filter(r => r.success).length;
  console.log(`✅ [Sequential] ${context}: Completed ${successCount}/${items.length} successfully`);

  return results;
}
