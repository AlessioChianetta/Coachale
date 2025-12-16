/**
 * Follow-up Cache System
 * Sistema di caching in-memory per ottimizzare query frequenti del sistema follow-up.
 * 
 * TTL default: 5 minuti
 * Auto-invalidazione quando arrivano nuovi messaggi
 */

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
  createdAt: number;
}

const cache = new Map<string, CacheEntry<any>>();

const DEFAULT_TTL_MS = 5 * 60 * 1000; // 5 minuti

/**
 * Recupera un valore dalla cache
 * @param key - Chiave cache (es: "dashboard-stats:consultant123")
 * @returns Valore cached o undefined se scaduto/non presente
 */
export function getFromCache<T>(key: string): T | undefined {
  const entry = cache.get(key);
  
  if (!entry) {
    return undefined;
  }
  
  const now = Date.now();
  if (now > entry.expiresAt) {
    cache.delete(key);
    console.log(`🗑️ [FOLLOWUP-CACHE] Expired entry removed: ${key}`);
    return undefined;
  }
  
  console.log(`✅ [FOLLOWUP-CACHE] Cache hit: ${key} (age: ${((now - entry.createdAt) / 1000).toFixed(1)}s)`);
  return entry.value as T;
}

/**
 * Salva un valore nella cache
 * @param key - Chiave cache
 * @param value - Valore da salvare
 * @param ttlMs - Time-to-live in millisecondi (default 5 minuti)
 */
export function setCache<T>(key: string, value: T, ttlMs: number = DEFAULT_TTL_MS): void {
  const now = Date.now();
  
  cache.set(key, {
    value,
    expiresAt: now + ttlMs,
    createdAt: now
  });
  
  console.log(`💾 [FOLLOWUP-CACHE] Cached: ${key} (TTL: ${(ttlMs / 1000).toFixed(0)}s)`);
}

/**
 * Invalida entries della cache che matchano un pattern
 * @param pattern - Pattern da matchare (supporta * come wildcard)
 * @returns Numero di entries invalidate
 */
export function invalidateCache(pattern: string): number {
  let invalidated = 0;
  const regexPattern = pattern.replace(/\*/g, '.*');
  const regex = new RegExp(`^${regexPattern}$`);
  
  for (const key of cache.keys()) {
    if (regex.test(key)) {
      cache.delete(key);
      invalidated++;
    }
  }
  
  if (invalidated > 0) {
    console.log(`🗑️ [FOLLOWUP-CACHE] Invalidated ${invalidated} entries matching pattern: ${pattern}`);
  }
  
  return invalidated;
}

/**
 * Invalida tutta la cache per un consultante
 * Da chiamare quando arriva un nuovo messaggio
 * @param consultantId - ID del consulente
 */
export function invalidateCacheForConsultant(consultantId: string): void {
  const patterns = [
    `dashboard-stats:${consultantId}`,
    `activity-log:${consultantId}:*`,
    `conversation-state:${consultantId}:*`,
    `pending-messages:${consultantId}`
  ];
  
  let totalInvalidated = 0;
  for (const pattern of patterns) {
    totalInvalidated += invalidateCache(pattern);
  }
  
  console.log(`🔄 [FOLLOWUP-CACHE] Consultant ${consultantId}: invalidated ${totalInvalidated} cache entries`);
}

/**
 * Genera una chiave cache per le statistiche dashboard
 * @param consultantId - ID del consulente
 */
export function getDashboardStatsKey(consultantId: string): string {
  return `dashboard-stats:${consultantId}`;
}

/**
 * Genera una chiave cache per il log attività
 * @param consultantId - ID del consulente
 * @param filters - Filtri applicati (serializzati)
 */
export function getActivityLogKey(consultantId: string, filters: Record<string, any> = {}): string {
  const filterHash = Object.entries(filters)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('&') || 'default';
  return `activity-log:${consultantId}:${filterHash}`;
}

/**
 * Pulisce entries scadute dalla cache
 * Da eseguire periodicamente
 */
export function cleanupExpiredEntries(): number {
  const now = Date.now();
  let cleaned = 0;
  
  for (const [key, entry] of cache.entries()) {
    if (now > entry.expiresAt) {
      cache.delete(key);
      cleaned++;
    }
  }
  
  if (cleaned > 0) {
    console.log(`🧹 [FOLLOWUP-CACHE] Cleanup: removed ${cleaned} expired entries`);
  }
  
  return cleaned;
}

/**
 * Statistiche della cache
 */
export function getCacheStats(): { size: number; keys: string[] } {
  return {
    size: cache.size,
    keys: Array.from(cache.keys())
  };
}

/**
 * Svuota completamente la cache
 */
export function clearCache(): void {
  const size = cache.size;
  cache.clear();
  console.log(`🗑️ [FOLLOWUP-CACHE] Cache cleared: ${size} entries removed`);
}

setInterval(() => {
  cleanupExpiredEntries();
}, 60 * 1000);
