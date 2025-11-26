import crypto from 'crypto';

// ========================================
// EXERCISE SCRAPE CACHE MODULE
// ========================================
// Intelligent caching system for scraped exercise content with:
// - Dynamic TTL based on conversational context
// - Auto-refresh detection (keywords: fatto, aggiunto, modificato, etc.)
// - Conversational context tracking (active work detection)

interface ExerciseCacheEntry {
  url: string;
  exerciseId: string;
  exerciseTitle: string;
  content: string;
  scrapedAt: Date;
  lastMentionedAt: Date;  // When exercise was last mentioned in conversation
  lastModificationHintAt: Date | null;  // When user hinted at modification (fatto, aggiunto, etc.)
  conversationId: string | null;  // Track which conversation is actively working on this
  expiresAt: Date;
  urlHash: string;  // For detecting URL changes
  hitCount: number;  // Cache hit statistics
  missCount: number;  // Cache miss statistics
}

interface ConversationalContext {
  conversationId: string;
  activeExercises: Set<string>;  // Exercise IDs actively discussed in last N messages
  lastMessageAt: Date;
  messageCount: number;  // Total messages in conversation about exercises
}

// Global cache storage
const exerciseCache = new Map<string, ExerciseCacheEntry>();
const conversationalContexts = new Map<string, ConversationalContext>();

// Cache statistics
let totalHits = 0;
let totalMisses = 0;
let totalRefreshes = 0;

// ========================================
// TTL CALCULATION - DYNAMIC BASED ON CONTEXT
// ========================================

const TTL_CONFIG = {
  ACTIVE_WORK: 5 * 60 * 1000,        // 5 minutes - currently working on it
  RECENT_MENTION: 10 * 60 * 1000,    // 10 minutes - mentioned recently
  STANDARD: 20 * 60 * 1000,          // 20 minutes - default
  INACTIVE: 60 * 60 * 1000,          // 60 minutes - not discussed for a while
};

function calculateDynamicTTL(entry: ExerciseCacheEntry, conversationId: string | null): number {
  const now = Date.now();
  
  // If user just hinted at modification (fatto, aggiunto, etc.) - VERY SHORT TTL
  if (entry.lastModificationHintAt) {
    const timeSinceHint = now - entry.lastModificationHintAt.getTime();
    if (timeSinceHint < 2 * 60 * 1000) {  // Within 2 minutes of modification hint
      return TTL_CONFIG.ACTIVE_WORK;  // 5 minutes
    }
  }
  
  // If actively working on this in current conversation
  if (conversationId && entry.conversationId === conversationId) {
    const timeSinceLastMention = now - entry.lastMentionedAt.getTime();
    if (timeSinceLastMention < 5 * 60 * 1000) {  // Mentioned in last 5 minutes
      return TTL_CONFIG.ACTIVE_WORK;  // 5 minutes
    }
  }
  
  // If mentioned recently (any conversation)
  const timeSinceLastMention = now - entry.lastMentionedAt.getTime();
  if (timeSinceLastMention < 10 * 60 * 1000) {  // Mentioned in last 10 minutes
    return TTL_CONFIG.RECENT_MENTION;  // 10 minutes
  }
  
  // If not discussed recently
  if (timeSinceLastMention < 30 * 60 * 1000) {  // Mentioned in last 30 minutes
    return TTL_CONFIG.STANDARD;  // 20 minutes
  }
  
  // Default for inactive exercises
  return TTL_CONFIG.INACTIVE;  // 60 minutes
}

// ========================================
// MODIFICATION HINT DETECTION
// ========================================

const MODIFICATION_KEYWORDS = [
  // Italian completion indicators
  'fatto', 'aggiunto', 'completato', 'modificato', 'ho scritto', 'inserito',
  'ok', 'done', 'finito', 'pronto', 'sistemato', 'corretto', 'cambiato',
  'ho messo', 'ho aggiunto', 'ho completato', 'ho modificato', 'ho inserito',
  'ho finito', 'ho sistemato', 'ho corretto', 'ho cambiato',
  
  // Action completion phrases
  'ho appena', 'appena fatto', 'appena aggiunto', 'appena completato',
  'appena modificato', 'appena inserito', 'appena finito',
  
  // Confirmation words
  'ecco fatto', 'fatto!', 'ok!', 'done!', 'pronto!',
];

export function detectModificationHint(message: string): boolean {
  const messageLower = message.toLowerCase();
  return MODIFICATION_KEYWORDS.some(keyword => messageLower.includes(keyword));
}

// ========================================
// EXERCISE MENTION DETECTION
// ========================================

export function detectMentionedExercises(
  message: string,
  allExercises: Array<{ id: string; title: string }>
): string[] {
  const messageLower = message.toLowerCase();
  const mentioned: string[] = [];
  
  for (const exercise of allExercises) {
    const titleLower = exercise.title.toLowerCase();
    
    // Direct title match
    if (messageLower.includes(titleLower)) {
      mentioned.push(exercise.id);
      continue;
    }
    
    // Match by keywords in title
    const titleWords = titleLower.split(/\s+/).filter(w => w.length > 3);
    for (const word of titleWords) {
      if (messageLower.includes(word) && 
          (messageLower.includes('esercizio') || messageLower.includes('exercise'))) {
        mentioned.push(exercise.id);
        break;
      }
    }
  }
  
  return mentioned;
}

// ========================================
// CONVERSATIONAL CONTEXT TRACKING
// ========================================

export function updateConversationalContext(
  conversationId: string,
  mentionedExerciseIds: string[],
  modificationHintDetected: boolean
): void {
  let context = conversationalContexts.get(conversationId);
  
  if (!context) {
    context = {
      conversationId,
      activeExercises: new Set(),
      lastMessageAt: new Date(),
      messageCount: 0,
    };
    conversationalContexts.set(conversationId, context);
  }
  
  // Add mentioned exercises to active set
  mentionedExerciseIds.forEach(id => context!.activeExercises.add(id));
  
  // Update context
  context.lastMessageAt = new Date();
  context.messageCount++;
  
  // If modification hint detected, mark all active exercises for refresh
  if (modificationHintDetected && context.activeExercises.size > 0) {
    console.log(`🔄 [EXERCISE CACHE] Modification hint detected in conversation ${conversationId}`);
    console.log(`   Active exercises will be refreshed: ${Array.from(context.activeExercises).join(', ')}`);
    
    // Mark all active exercises with modification hint
    context.activeExercises.forEach(exerciseId => {
      const cacheKey = getCacheKeyByExerciseId(exerciseId);
      if (cacheKey) {
        const entry = exerciseCache.get(cacheKey);
        if (entry) {
          entry.lastModificationHintAt = new Date();
          console.log(`   📝 Marked exercise "${entry.exerciseTitle}" for refresh`);
        }
      }
    });
  }
}

// ========================================
// CACHE OPERATIONS
// ========================================

function generateUrlHash(url: string): string {
  return crypto.createHash('md5').update(url).digest('hex').substring(0, 8);
}

function getCacheKey(url: string): string {
  return `exercise:${generateUrlHash(url)}`;
}

function getCacheKeyByExerciseId(exerciseId: string): string | null {
  for (const [key, entry] of exerciseCache.entries()) {
    if (entry.exerciseId === exerciseId) {
      return key;
    }
  }
  return null;
}

// Get cached exercise ignoring expiry (for fallback when refresh fails)
export function getStaleCachedExercise(
  url: string
): { content: string; age: number } | null {
  const cacheKey = getCacheKey(url);
  const entry = exerciseCache.get(cacheKey);
  
  if (!entry) {
    return null;
  }
  
  const now = new Date();
  const ageSeconds = Math.round((now.getTime() - entry.scrapedAt.getTime()) / 1000);
  
  console.log(`🔄 [EXERCISE CACHE] STALE RETRIEVE for "${entry.exerciseTitle}" (age: ${ageSeconds}s, expired: ${entry.expiresAt < now})`);
  
  return {
    content: entry.content,
    age: ageSeconds,
  };
}

export function getCachedExercise(
  url: string,
  exerciseId: string,
  conversationId: string | null
): { content: string; age: number; source: 'cache' } | null {
  const cacheKey = getCacheKey(url);
  const entry = exerciseCache.get(cacheKey);
  
  if (!entry) {
    return null;
  }
  
  const now = new Date();
  
  // CHECK EXPIRY FIRST (before modifying entry)
  if (entry.expiresAt < now) {
    entry.missCount++;
    totalMisses++;
    console.log(`❌ [EXERCISE CACHE] EXPIRED for "${entry.exerciseTitle}" (expired ${Math.round((now.getTime() - entry.expiresAt.getTime()) / 1000)}s ago)`);
    // DON'T delete - keep for fallback if refresh fails
    return null;
  }
  
  // Check if modification hint was detected recently (within last 2 minutes)
  if (entry.lastModificationHintAt) {
    const timeSinceHint = now.getTime() - entry.lastModificationHintAt.getTime();
    if (timeSinceHint < 2 * 60 * 1000) {  // Within 2 minutes
      console.log(`🔄 [EXERCISE CACHE] BYPASSING cache for "${entry.exerciseTitle}" - modification hint detected ${Math.round(timeSinceHint / 1000)}s ago`);
      entry.missCount++;
      totalMisses++;
      // DON'T delete - keep for fallback if refresh fails
      return null;
    }
  }
  
  // Update lastMentionedAt and conversationId
  entry.lastMentionedAt = now;
  if (conversationId) {
    entry.conversationId = conversationId;
  }
  
  // Recalculate and extend TTL based on current context
  const newTTL = calculateDynamicTTL(entry, conversationId);
  entry.expiresAt = new Date(Date.now() + newTTL);
  
  // Cache hit
  entry.hitCount++;
  totalHits++;
  
  const ageSeconds = Math.round((now.getTime() - entry.scrapedAt.getTime()) / 1000);
  const ttlSeconds = Math.round((entry.expiresAt.getTime() - now.getTime()) / 1000);
  
  console.log(`✅ [EXERCISE CACHE] HIT for "${entry.exerciseTitle}"`);
  console.log(`   Age: ${ageSeconds}s, TTL remaining: ${ttlSeconds}s (extended)`);
  console.log(`   Stats: ${entry.hitCount} hits, ${entry.missCount} misses`);
  
  return {
    content: entry.content,
    age: ageSeconds,
    source: 'cache',
  };
}

export function setCachedExercise(
  url: string,
  exerciseId: string,
  exerciseTitle: string,
  content: string,
  conversationId: string | null
): void {
  const cacheKey = getCacheKey(url);
  const now = new Date();
  
  // Check if updating existing entry
  const existing = exerciseCache.get(cacheKey);
  const hitCount = existing?.hitCount || 0;
  const missCount = existing?.missCount || 0;
  
  const entry: ExerciseCacheEntry = {
    url,
    exerciseId,
    exerciseTitle,
    content,
    scrapedAt: now,
    lastMentionedAt: now,
    lastModificationHintAt: null,  // RESET modification hint after successful scrape
    conversationId,
    expiresAt: new Date(now.getTime() + TTL_CONFIG.ACTIVE_WORK),  // Start with active work TTL
    urlHash: generateUrlHash(url),
    hitCount,
    missCount: missCount + 1,  // This is a miss (had to scrape)
  };
  
  exerciseCache.set(cacheKey, entry);
  totalRefreshes++;
  
  const wasModificationHint = existing?.lastModificationHintAt !== null;
  const ttlMinutes = Math.round(TTL_CONFIG.ACTIVE_WORK / 60000);
  console.log(`💾 [EXERCISE CACHE] STORED "${exerciseTitle}"${wasModificationHint ? ' (after modification hint)' : ''}`);
  console.log(`   Content length: ${content.length.toLocaleString()} chars`);
  console.log(`   Initial TTL: ${ttlMinutes} minutes (active work)`);
}

export function invalidateExercise(url: string): void {
  const cacheKey = getCacheKey(url);
  const entry = exerciseCache.get(cacheKey);
  
  if (entry) {
    console.log(`🗑️  [EXERCISE CACHE] INVALIDATED "${entry.exerciseTitle}"`);
    exerciseCache.delete(cacheKey);
  }
}

export function invalidateAllExercises(): void {
  const count = exerciseCache.size;
  exerciseCache.clear();
  console.log(`🗑️  [EXERCISE CACHE] CLEARED all ${count} entries`);
}

// ========================================
// CACHE STATISTICS
// ========================================

export function getCacheStats() {
  const totalRequests = totalHits + totalMisses;
  const hitRate = totalRequests > 0 ? (totalHits / totalRequests * 100).toFixed(1) : '0.0';
  
  return {
    totalEntries: exerciseCache.size,
    totalHits,
    totalMisses,
    totalRefreshes,
    hitRate: `${hitRate}%`,
    entries: Array.from(exerciseCache.values()).map(entry => ({
      exerciseTitle: entry.exerciseTitle,
      age: Math.round((Date.now() - entry.scrapedAt.getTime()) / 1000),
      ttl: Math.round((entry.expiresAt.getTime() - Date.now()) / 1000),
      hitCount: entry.hitCount,
      missCount: entry.missCount,
      conversationId: entry.conversationId,
    })),
  };
}

export function logCacheStats(): void {
  const stats = getCacheStats();
  
  console.log('\n📊 [EXERCISE CACHE] Statistics:');
  console.log(`   Total entries: ${stats.totalEntries}`);
  console.log(`   Hit rate: ${stats.hitRate} (${stats.totalHits} hits / ${stats.totalMisses} misses)`);
  console.log(`   Total refreshes: ${stats.totalRefreshes}`);
  
  if (stats.entries.length > 0) {
    console.log('\n   Cache entries:');
    stats.entries.forEach(entry => {
      const status = entry.ttl > 0 ? `valid, ${entry.ttl}s remaining` : 'expired';
      console.log(`   - "${entry.exerciseTitle}": ${status} (age: ${entry.age}s, hits: ${entry.hitCount})`);
    });
  }
  console.log('');
}

// ========================================
// CLEANUP (Remove stale conversational contexts)
// ========================================

export function cleanupStaleContexts(): void {
  const now = Date.now();
  const CONTEXT_TIMEOUT = 60 * 60 * 1000;  // 1 hour
  
  let removed = 0;
  for (const [conversationId, context] of conversationalContexts.entries()) {
    const age = now - context.lastMessageAt.getTime();
    if (age > CONTEXT_TIMEOUT) {
      conversationalContexts.delete(conversationId);
      removed++;
    }
  }
  
  if (removed > 0) {
    console.log(`🧹 [EXERCISE CACHE] Cleaned up ${removed} stale conversational contexts`);
  }
}

// Run cleanup every 10 minutes
setInterval(cleanupStaleContexts, 10 * 60 * 1000);
