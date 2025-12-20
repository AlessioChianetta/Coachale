/**
 * Follow-up Scheduler CRON Job
 * Sistema di scheduling proattivo per follow-up WhatsApp.
 * 
 * CRON 1 (ogni 5 minuti): Valuta conversazioni candidate per follow-up
 * CRON 2 (ogni minuto): Processa messaggi schedulati pendenti
 */

import cron from 'node-cron';
import { db } from '../db';
import { 
  conversationStates,
  scheduledFollowupMessages,
  followupRules,
  whatsappConversations,
  whatsappMessages,
  whatsappCustomTemplates,
  whatsappTemplateAssignments,
  whatsappTemplateVersions,
  consultantWhatsappConfig,
  consultantAiPreferences,
  users,
  proactiveLeads
} from '../../shared/schema';
import { eq, and, ne, lte, inArray, isNotNull, desc, sql } from 'drizzle-orm';
import { 
  evaluateFollowup, 
  logFollowupDecision, 
  updateConversationState,
  selectBestTemplateWithAI,
  type FollowupContext,
  type FollowupDecision,
  type AIProvider,
  type TemplateForSelection,
  createStudioProvider
} from '../ai/followup-decision-engine';
import { getAIProvider } from '../ai/provider-factory';
import { sendWhatsAppMessage, fetchMultipleTwilioTemplateBodies, fetchTwilioTemplateBody } from '../whatsapp/twilio-client';
import { decryptForConsultant } from '../encryption';

let evaluationJob: cron.ScheduledTask | null = null;
let processingJob: cron.ScheduledTask | null = null;
let coldLeadsJob: cron.ScheduledTask | null = null;
let ghostLeadsJob: cron.ScheduledTask | null = null;
let engagedColdLeadsJob: cron.ScheduledTask | null = null;
let isEvaluationRunning = false;
let isProcessingRunning = false;
let isColdLeadsRunning = false;
let isGhostLeadsRunning = false;
let isEngagedColdLeadsRunning = false;

// ═══════════════════════════════════════════════════════════════════════════
// In-Memory Evaluation Locks (prevents race conditions in parallel evaluations)
// ═══════════════════════════════════════════════════════════════════════════
const evaluationLocks = new Map<string, { timestamp: number; caller: string; cycleId: string }>();
const EVALUATION_LOCK_TIMEOUT_MS = 60000; // 1 minute timeout

// Track evaluation calls for debugging multiple evaluations
let globalEvalCounter = 0;
const recentEvalCalls = new Map<string, { count: number; timestamps: number[]; callers: string[] }>();

function trackEvaluationCall(conversationId: string, caller: string): void {
  globalEvalCounter++;
  const now = Date.now();
  const existing = recentEvalCalls.get(conversationId) || { count: 0, timestamps: [], callers: [] };
  
  // Keep only last 5 minutes of data
  const fiveMinutesAgo = now - 5 * 60 * 1000;
  const recentTimestamps = existing.timestamps.filter(t => t > fiveMinutesAgo);
  const recentCallers = existing.callers.slice(-10);
  
  recentTimestamps.push(now);
  recentCallers.push(`${caller}@${new Date(now).toISOString()}`);
  
  recentEvalCalls.set(conversationId, {
    count: existing.count + 1,
    timestamps: recentTimestamps,
    callers: recentCallers
  });
  
  // Alert if more than 2 evaluations in 5 minutes for same conversation
  if (recentTimestamps.length > 2) {
    console.warn(`⚠️ [EVAL-TRACKER] MULTIPLE EVALUATIONS DETECTED for ${conversationId}:`);
    console.warn(`   Total: ${recentTimestamps.length} in last 5 minutes`);
    console.warn(`   Callers: ${recentCallers.join(' → ')}`);
    console.warn(`   Stack: ${new Error().stack?.split('\n').slice(2, 6).join('\n')}`);
  }
}

function cleanupEvaluationTracking(conversationId: string): void {
  // Remove tracking for completed evaluations after 10 minutes
  const entry = recentEvalCalls.get(conversationId);
  if (entry) {
    const now = Date.now();
    const tenMinutesAgo = now - 10 * 60 * 1000;
    const recentTimestamps = entry.timestamps.filter(t => t > tenMinutesAgo);
    
    if (recentTimestamps.length === 0) {
      recentEvalCalls.delete(conversationId);
    } else {
      entry.timestamps = recentTimestamps;
    }
  }
}

// Periodic cleanup of stale tracking data (every 10 minutes)
setInterval(() => {
  const now = Date.now();
  const tenMinutesAgo = now - 10 * 60 * 1000;
  
  for (const [convId, entry] of recentEvalCalls.entries()) {
    const recentTimestamps = entry.timestamps.filter(t => t > tenMinutesAgo);
    if (recentTimestamps.length === 0) {
      recentEvalCalls.delete(convId);
    } else {
      entry.timestamps = recentTimestamps;
    }
  }
  
  if (recentEvalCalls.size > 0) {
    console.log(`🧹 [EVAL-TRACKER] Cleanup: ${recentEvalCalls.size} active tracking entries`);
  }
}, 10 * 60 * 1000);

const EVALUATION_INTERVAL = '*/5 * * * *'; // Every 5 minutes - HOT/WARM leads
const PROCESSING_INTERVAL = '* * * * *';   // Every minute
const COLD_LEADS_INTERVAL = '0 */2 * * *'; // Every 2 hours - COLD leads
const GHOST_LEADS_INTERVAL = '0 10 * * *'; // Daily at 10:00 - GHOST leads
const ENGAGED_COLD_LEADS_INTERVAL = '*/30 * * * *'; // Every 30 minutes - engaged leads that went cold
const TIMEZONE = 'Europe/Rome';

// ═══════════════════════════════════════════════════════════════════════════
// Rate Limiting Configuration
// ═══════════════════════════════════════════════════════════════════════════

const RATE_LIMIT_MAX_MESSAGES_PER_HOUR = 50;

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const rateLimitMap = new Map<string, RateLimitEntry>();

// ═══════════════════════════════════════════════════════════════════════════
// Error Classification & Retry Configuration
// ═══════════════════════════════════════════════════════════════════════════

const PERMANENT_ERROR_CODES = ["invalid_number", "blocked", "template_rejected"] as const;
const RETRYABLE_ERROR_CODES = ["rate_limit", "network", "timeout", "unknown"] as const;

/**
 * Classify error message to error code
 */
function classifyErrorCode(errorMessage: string): string {
  const msg = errorMessage.toLowerCase();
  
  if (msg.includes('invalid') && msg.includes('number')) return 'invalid_number';
  if (msg.includes('blocked') || msg.includes('unsubscribed') || msg.includes('opt-out')) return 'blocked';
  if (msg.includes('template') && (msg.includes('reject') || msg.includes('not approved'))) return 'template_rejected';
  if (msg.includes('rate') || msg.includes('limit') || msg.includes('throttl')) return 'rate_limit';
  if (msg.includes('network') || msg.includes('connection') || msg.includes('econnrefused')) return 'network';
  if (msg.includes('timeout') || msg.includes('timed out')) return 'timeout';
  
  return 'unknown';
}

/**
 * Get retry backoff in minutes using exponential backoff
 * Attempt 1: 5 min, Attempt 2: 15 min, Attempt 3+: 60 min
 */
function getRetryBackoffMinutes(attemptCount: number): number {
  if (attemptCount <= 1) return 5;
  if (attemptCount === 2) return 15;
  return 60;
}

/**
 * Controlla se il consulente può inviare un messaggio (rate limit)
 * @param consultantId - ID del consulente
 * @returns true se può inviare, false se ha raggiunto il limite
 */
export function canSendMessage(consultantId: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(consultantId);
  
  if (!entry) {
    return true;
  }
  
  if (now > entry.resetAt) {
    rateLimitMap.delete(consultantId);
    return true;
  }
  
  return entry.count < RATE_LIMIT_MAX_MESSAGES_PER_HOUR;
}

/**
 * Registra un messaggio inviato per il rate limiting
 * @param consultantId - ID del consulente
 */
function recordMessageSent(consultantId: string): void {
  const now = Date.now();
  const oneHourFromNow = now + 60 * 60 * 1000;
  
  const entry = rateLimitMap.get(consultantId);
  
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(consultantId, {
      count: 1,
      resetAt: oneHourFromNow
    });
  } else {
    entry.count++;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Consultant AI Preferences Cache
// ═══════════════════════════════════════════════════════════════════════════

interface ConsultantRetryConfig {
  maxNoReplyBeforeDormancy: number;
  dormancyDurationDays: number;
  finalAttemptAfterDormancy: boolean;
  maxWarmFollowups: number;
  warmFollowupDelayHours: number;
  engagedGhostThresholdDays: number;
  prioritizeEngagedLeads: boolean;
}

const DEFAULT_RETRY_CONFIG: ConsultantRetryConfig = {
  maxNoReplyBeforeDormancy: 3,
  dormancyDurationDays: 90,
  finalAttemptAfterDormancy: true,
  maxWarmFollowups: 2,
  warmFollowupDelayHours: 4,
  engagedGhostThresholdDays: 14,
  prioritizeEngagedLeads: true,
};

// Cache preferences per consultant for 5 minutes
const preferencesCache = new Map<string, { config: ConsultantRetryConfig; expiresAt: number }>();
const PREFERENCES_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Get consultant's retry configuration from database or use defaults
 */
async function getConsultantRetryConfig(consultantId: string): Promise<ConsultantRetryConfig> {
  // Check cache first
  const cached = preferencesCache.get(consultantId);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.config;
  }
  
  try {
    const [prefs] = await db
      .select({
        maxNoReplyBeforeDormancy: consultantAiPreferences.maxNoReplyBeforeDormancy,
        dormancyDurationDays: consultantAiPreferences.dormancyDurationDays,
        finalAttemptAfterDormancy: consultantAiPreferences.finalAttemptAfterDormancy,
        maxWarmFollowups: consultantAiPreferences.maxWarmFollowups,
        warmFollowupDelayHours: consultantAiPreferences.warmFollowupDelayHours,
        engagedGhostThresholdDays: consultantAiPreferences.engagedGhostThresholdDays,
        prioritizeEngagedLeads: consultantAiPreferences.prioritizeEngagedLeads,
      })
      .from(consultantAiPreferences)
      .where(eq(consultantAiPreferences.consultantId, consultantId))
      .limit(1);
    
    const config: ConsultantRetryConfig = {
      maxNoReplyBeforeDormancy: prefs?.maxNoReplyBeforeDormancy ?? DEFAULT_RETRY_CONFIG.maxNoReplyBeforeDormancy,
      dormancyDurationDays: prefs?.dormancyDurationDays ?? DEFAULT_RETRY_CONFIG.dormancyDurationDays,
      finalAttemptAfterDormancy: prefs?.finalAttemptAfterDormancy ?? DEFAULT_RETRY_CONFIG.finalAttemptAfterDormancy,
      maxWarmFollowups: prefs?.maxWarmFollowups ?? DEFAULT_RETRY_CONFIG.maxWarmFollowups,
      warmFollowupDelayHours: prefs?.warmFollowupDelayHours ?? DEFAULT_RETRY_CONFIG.warmFollowupDelayHours,
      engagedGhostThresholdDays: prefs?.engagedGhostThresholdDays ?? DEFAULT_RETRY_CONFIG.engagedGhostThresholdDays,
      prioritizeEngagedLeads: prefs?.prioritizeEngagedLeads ?? DEFAULT_RETRY_CONFIG.prioritizeEngagedLeads,
    };
    
    // Cache the result
    preferencesCache.set(consultantId, {
      config,
      expiresAt: Date.now() + PREFERENCES_CACHE_TTL_MS,
    });
    
    return config;
  } catch (error) {
    console.error(`[RETRY-CONFIG] Error fetching preferences for consultant ${consultantId}:`, error);
    return DEFAULT_RETRY_CONFIG;
  }
}

/**
 * Ottiene informazioni sul rate limit per un consulente
 * @param consultantId - ID del consulente
 */
export function getRateLimitInfo(consultantId: string): { remaining: number; resetAt: Date | null } {
  const now = Date.now();
  const entry = rateLimitMap.get(consultantId);
  
  if (!entry || now > entry.resetAt) {
    return { remaining: RATE_LIMIT_MAX_MESSAGES_PER_HOUR, resetAt: null };
  }
  
  return {
    remaining: Math.max(0, RATE_LIMIT_MAX_MESSAGES_PER_HOUR - entry.count),
    resetAt: new Date(entry.resetAt)
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Monitoring & Metrics
// ═══════════════════════════════════════════════════════════════════════════

const EXECUTION_WARNING_THRESHOLD_MS = 2 * 60 * 1000; // 2 minutes
const ERROR_RATE_ALERT_THRESHOLD = 0.10; // 10%

interface CycleMetrics {
  cycleId: string;
  type: string;
  startTime: Date;
  endTime?: Date;
  durationMs?: number;
  processed: number;
  success: number;
  errors: number;
  skipped: number;
  rateLimited: number;
}

/**
 * Log strutturato per l'esecuzione di un ciclo CRON
 */
function logCycleMetrics(metrics: CycleMetrics): void {
  const timestamp = new Date().toISOString();
  const errorRate = metrics.processed > 0 ? metrics.errors / metrics.processed : 0;
  
  console.log(`📊 [FOLLOWUP-SCHEDULER] ═══════════════════════════════════════`);
  console.log(`📊 [FOLLOWUP-SCHEDULER] Cycle Metrics Report`);
  console.log(`📊 [FOLLOWUP-SCHEDULER] ───────────────────────────────────────`);
  console.log(`📊 [FOLLOWUP-SCHEDULER] Timestamp: ${timestamp}`);
  console.log(`📊 [FOLLOWUP-SCHEDULER] Cycle ID: ${metrics.cycleId}`);
  console.log(`📊 [FOLLOWUP-SCHEDULER] Type: ${metrics.type}`);
  console.log(`📊 [FOLLOWUP-SCHEDULER] Duration: ${metrics.durationMs}ms`);
  console.log(`📊 [FOLLOWUP-SCHEDULER] Processed: ${metrics.processed}`);
  console.log(`📊 [FOLLOWUP-SCHEDULER] Success: ${metrics.success}`);
  console.log(`📊 [FOLLOWUP-SCHEDULER] Errors: ${metrics.errors}`);
  console.log(`📊 [FOLLOWUP-SCHEDULER] Skipped: ${metrics.skipped}`);
  console.log(`📊 [FOLLOWUP-SCHEDULER] Rate Limited: ${metrics.rateLimited}`);
  console.log(`📊 [FOLLOWUP-SCHEDULER] Error Rate: ${(errorRate * 100).toFixed(1)}%`);
  console.log(`📊 [FOLLOWUP-SCHEDULER] ═══════════════════════════════════════`);
  
  if (metrics.durationMs && metrics.durationMs > EXECUTION_WARNING_THRESHOLD_MS) {
    console.log(`[FOLLOWUP-SCHEDULER] WARNING: Execution exceeded 2 minutes (${(metrics.durationMs / 1000 / 60).toFixed(1)} min)`);
  }
  
  if (errorRate > ERROR_RATE_ALERT_THRESHOLD) {
    console.log(`[FOLLOWUP-SCHEDULER] ALERT: Error rate exceeded 10% (${(errorRate * 100).toFixed(1)}%)`);
  }
}

/**
 * Genera un ID univoco per il ciclo
 */
function generateCycleId(): string {
  return `cycle_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}

export type TemperatureLevel = "hot" | "warm" | "cold" | "ghost";

/**
 * Calcola la temperatura del lead basata sulle ore dall'ultimo messaggio inbound
 * @param hoursSinceLastInbound - Ore trascorse dall'ultimo messaggio del lead
 * @returns TemperatureLevel - hot, warm, cold, o ghost
 */
export function calculateTemperature(hoursSinceLastInbound: number, hasEverReplied: boolean = false, engagedGhostThresholdDays: number = 14): TemperatureLevel {
  if (hoursSinceLastInbound < 2) return "hot";        // < 2 ore: lead molto attivo
  if (hoursSinceLastInbound < 24) return "warm";      // < 24 ore: ancora dentro finestra WhatsApp
  
  // Lead engaged (ha risposto almeno 1 volta) ha threshold più alto per diventare ghost
  const ghostThresholdHours = hasEverReplied ? (engagedGhostThresholdDays * 24) : 168; // 14 giorni vs 7 giorni
  
  if (hoursSinceLastInbound < ghostThresholdHours) return "cold";
  return "ghost";
}

export function initFollowupScheduler(): void {
  console.log('🚀 [FOLLOWUP-SCHEDULER] Initializing follow-up scheduler...');
  
  if (evaluationJob || processingJob || coldLeadsJob || ghostLeadsJob) {
    console.log('⚠️ [FOLLOWUP-SCHEDULER] Scheduler already initialized, stopping existing jobs first...');
    stopFollowupScheduler();
  }

  // HOT/WARM leads evaluation - every 5 minutes
  evaluationJob = cron.schedule(EVALUATION_INTERVAL, async () => {
    console.log('⏰ [FOLLOWUP-SCHEDULER] HOT/WARM evaluation cycle triggered');
    try {
      await runFollowupEvaluation(['hot', 'warm']);
    } catch (error) {
      console.error('❌ [FOLLOWUP-SCHEDULER] Error in HOT/WARM evaluation cycle:', error);
    }
  }, {
    scheduled: true,
    timezone: TIMEZONE
  });

  // Message processing - every minute
  processingJob = cron.schedule(PROCESSING_INTERVAL, async () => {
    console.log('⏰ [FOLLOWUP-SCHEDULER] Processing cycle triggered');
    try {
      await processScheduledMessages();
    } catch (error) {
      console.error('❌ [FOLLOWUP-SCHEDULER] Error in processing cycle:', error);
    }
  }, {
    scheduled: true,
    timezone: TIMEZONE
  });

  // COLD leads evaluation - every 2 hours
  coldLeadsJob = cron.schedule(COLD_LEADS_INTERVAL, async () => {
    console.log('⏰ [FOLLOWUP-SCHEDULER] COLD leads evaluation cycle triggered');
    try {
      await runColdLeadsEvaluation();
    } catch (error) {
      console.error('❌ [FOLLOWUP-SCHEDULER] Error in COLD leads evaluation cycle:', error);
    }
  }, {
    scheduled: true,
    timezone: TIMEZONE
  });

  // GHOST leads evaluation - daily at 10:00
  ghostLeadsJob = cron.schedule(GHOST_LEADS_INTERVAL, async () => {
    console.log('⏰ [FOLLOWUP-SCHEDULER] GHOST leads evaluation cycle triggered');
    try {
      await runGhostLeadsEvaluation();
    } catch (error) {
      console.error('❌ [FOLLOWUP-SCHEDULER] Error in GHOST leads evaluation cycle:', error);
    }
  }, {
    scheduled: true,
    timezone: TIMEZONE
  });

  // ENGAGED COLD leads evaluation - every 30 minutes (high priority leads that went cold)
  engagedColdLeadsJob = cron.schedule(ENGAGED_COLD_LEADS_INTERVAL, async () => {
    console.log('⏰ [FOLLOWUP-SCHEDULER] ENGAGED COLD leads evaluation cycle triggered');
    try {
      await runEngagedColdLeadsEvaluation();
    } catch (error) {
      console.error('❌ [FOLLOWUP-SCHEDULER] Error in ENGAGED COLD leads evaluation cycle:', error);
    }
  }, {
    scheduled: true,
    timezone: TIMEZONE
  });

  console.log('✅ [FOLLOWUP-SCHEDULER] Scheduler initialized successfully');
  console.log(`   🔥 HOT/WARM: ${EVALUATION_INTERVAL} (every 5 minutes)`);
  console.log(`   ❄️  COLD: ${COLD_LEADS_INTERVAL} (every 2 hours)`);
  console.log(`   👻 GHOST: ${GHOST_LEADS_INTERVAL} (daily at 10:00)`);
  console.log(`   🔥❄️ ENGAGED COLD: ${ENGAGED_COLD_LEADS_INTERVAL} (every 30 minutes)`);
  console.log(`   📋 Processing: ${PROCESSING_INTERVAL} (every minute)`);
}

export function stopFollowupScheduler(): void {
  console.log('🛑 [FOLLOWUP-SCHEDULER] Stopping follow-up scheduler...');
  
  if (evaluationJob) {
    evaluationJob.stop();
    evaluationJob = null;
    console.log('   ✅ HOT/WARM evaluation job stopped');
  }
  
  if (processingJob) {
    processingJob.stop();
    processingJob = null;
    console.log('   ✅ Processing job stopped');
  }
  
  if (coldLeadsJob) {
    coldLeadsJob.stop();
    coldLeadsJob = null;
    console.log('   ✅ COLD leads job stopped');
  }
  
  if (ghostLeadsJob) {
    ghostLeadsJob.stop();
    ghostLeadsJob = null;
    console.log('   ✅ GHOST leads job stopped');
  }
  
  if (engagedColdLeadsJob) {
    engagedColdLeadsJob.stop();
    engagedColdLeadsJob = null;
    console.log('   ✅ ENGAGED COLD leads job stopped');
  }
  
  console.log('✅ [FOLLOWUP-SCHEDULER] Scheduler stopped');
}

export async function runFollowupEvaluation(temperatureFilter?: TemperatureLevel[]): Promise<void> {
  if (isEvaluationRunning) {
    console.log('⚠️ [FOLLOWUP-SCHEDULER] Evaluation already running, skipping...');
    return;
  }

  isEvaluationRunning = true;
  const cycleId = generateCycleId();
  const startTime = Date.now();
  const filterLabel = temperatureFilter ? temperatureFilter.join('/').toUpperCase() : 'ALL';
  console.time(`[FOLLOWUP-SCHEDULER] Evaluation Cycle ${cycleId}`);
  
  const metrics: CycleMetrics = {
    cycleId,
    type: `evaluation_${filterLabel.toLowerCase()}`,
    startTime: new Date(),
    processed: 0,
    success: 0,
    errors: 0,
    skipped: 0,
    rateLimited: 0
  };
  
  try {
    console.log(`🔍 [FOLLOWUP-SCHEDULER] Starting ${filterLabel} follow-up evaluation cycle...`);
    
    const candidateConversations = await findCandidateConversations(undefined, temperatureFilter);
    
    console.log(`📊 [FOLLOWUP-SCHEDULER] Found ${candidateConversations.length} ${filterLabel} candidate conversations`);
    
    if (candidateConversations.length === 0) {
      console.log(`💤 [FOLLOWUP-SCHEDULER] No ${filterLabel} conversations to evaluate`);
      return;
    }

    let processed = 0;
    let scheduled = 0;
    let skipped = 0;
    let stopped = 0;
    let errors = 0;
    let temperatureUpdates = 0;

    for (const conversation of candidateConversations) {
      const lockKey = conversation.conversationId;
      try {
        metrics.processed++;
        
        console.log(`📋 [EVAL-STEP 1] ${conversation.conversationId}: Checking lock status`);
        // LOCK CHECK: Prevent parallel evaluations of the same conversation
        const existingLock = evaluationLocks.get(lockKey);
        const now = Date.now();
        if (existingLock && (now - existingLock.timestamp) < EVALUATION_LOCK_TIMEOUT_MS) {
          console.log(`📋 [EVAL-STEP 1] ${conversation.conversationId}: FAILED - Lock held by ${existingLock.caller} (cycle: ${existingLock.cycleId}, started ${((now - existingLock.timestamp)/1000).toFixed(1)}s ago)`);
          console.log(`🔒 [LOCK] ${lockKey}: SKIPPED - Evaluation already in progress`);
          skipped++;
          metrics.skipped++;
          continue;
        }
        console.log(`📋 [EVAL-STEP 1] ${conversation.conversationId}: PASSED - No lock held`);
        
        // SMART WAIT CHECK: Skip if nextEvaluationAt is in the future
        console.log(`📋 [EVAL-STEP 1.5] ${conversation.conversationId}: Checking smart wait (nextEvaluationAt: ${conversation.nextEvaluationAt || 'not set'})`);
        if (conversation.nextEvaluationAt) {
          const nowCheck = new Date();
          if (nowCheck < new Date(conversation.nextEvaluationAt)) {
            const hoursUntilNextEval = (new Date(conversation.nextEvaluationAt).getTime() - nowCheck.getTime()) / (1000 * 60 * 60);
            console.log(`📋 [EVAL-STEP 1.5] ${conversation.conversationId}: SKIPPED - Smart wait active, next eval in ${hoursUntilNextEval.toFixed(1)}h (type: ${conversation.waitType || 'unknown'})`);
            skipped++;
            metrics.skipped++;
            continue;
          }
        }
        console.log(`📋 [EVAL-STEP 1.5] ${conversation.conversationId}: PASSED - No smart wait or wait expired`);
        
        console.log(`📋 [EVAL-STEP 2] ${conversation.conversationId}: Checking debounce (last eval: ${conversation.lastAiEvaluationAt || 'never'})`);
        // DEBOUNCE: Skip if conversation was evaluated recently (within 5 minutes)
        const DEBOUNCE_MINUTES = 5;
        if (conversation.lastAiEvaluationAt) {
          const minutesSinceLastEval = (Date.now() - new Date(conversation.lastAiEvaluationAt).getTime()) / (1000 * 60);
          if (minutesSinceLastEval < DEBOUNCE_MINUTES) {
            console.log(`📋 [EVAL-STEP 2] ${conversation.conversationId}: FAILED - Debounce active (${minutesSinceLastEval.toFixed(1)} min ago)`);
            console.log(`⏭️ [DEBOUNCE] ${conversation.conversationId}: SKIPPED - Evaluated ${minutesSinceLastEval.toFixed(1)} min ago (debounce: ${DEBOUNCE_MINUTES} min)`);
            skipped++;
            metrics.skipped++;
            continue;
          }
        }
        console.log(`📋 [EVAL-STEP 2] ${conversation.conversationId}: PASSED - Debounce cleared`);
        
        // Track this evaluation call for debugging
        trackEvaluationCall(lockKey, `${filterLabel}-cycle-${cycleId}`);
        
        // Set lock before evaluation
        evaluationLocks.set(lockKey, { timestamp: Date.now(), caller: `${filterLabel}-cycle`, cycleId });
        console.log(`📋 [EVAL-STEP 3] ${conversation.conversationId}: Lock acquired (caller: ${filterLabel}-cycle-${cycleId}), checking temperature (hours since inbound: ${conversation.hoursSinceLastInbound.toFixed(1)})`);
        
        // Calculate and update temperature if changed
        const newTemperature = calculateTemperature(conversation.hoursSinceLastInbound);
        if (conversation.temperatureLevel !== newTemperature) {
          await db.update(conversationStates)
            .set({ 
              temperatureLevel: newTemperature,
              updatedAt: new Date()
            })
            .where(eq(conversationStates.conversationId, conversation.conversationId));
          
          console.log(`📋 [EVAL-STEP 3] ${conversation.conversationId}: Temperature CHANGED: ${conversation.temperatureLevel || 'N/A'} → ${newTemperature}`);
          console.log(`🌡️ [TEMPERATURE] Conversazione ${conversation.conversationId}: ${conversation.temperatureLevel || 'N/A'} → ${newTemperature}`);
          temperatureUpdates++;
          
          // Update the candidate object for accurate processing
          conversation.temperatureLevel = newTemperature;
        } else {
          console.log(`📋 [EVAL-STEP 3] ${conversation.conversationId}: Temperature unchanged (${conversation.temperatureLevel})`);
        }

        console.log(`📋 [EVAL-STEP 4] ${conversation.conversationId}: Calling AI evaluation...`);
        const result = await evaluateConversation(conversation);
        console.log(`📋 [EVAL-STEP 5] ${conversation.conversationId}: AI decision = ${result}`);
        processed++;
        
        switch (result) {
          case 'scheduled':
            scheduled++;
            metrics.success++;
            console.log(`📋 [EVAL-STEP 6] ${conversation.conversationId}: Result processed → SCHEDULED`);
            break;
          case 'skipped':
            skipped++;
            metrics.skipped++;
            console.log(`📋 [EVAL-STEP 6] ${conversation.conversationId}: Result processed → SKIPPED`);
            break;
          case 'stopped':
            stopped++;
            metrics.success++;
            console.log(`📋 [EVAL-STEP 6] ${conversation.conversationId}: Result processed → STOPPED`);
            break;
        }
      } catch (error) {
        errors++;
        metrics.errors++;
        console.error(`📋 [EVAL-STEP ERROR] ${conversation.conversationId}: Exception caught`);
        console.error(`❌ [FOLLOWUP-SCHEDULER] Error evaluating conversation ${conversation.conversationId}:`, error);
      } finally {
        // Release lock after evaluation completes
        evaluationLocks.delete(lockKey);
        console.log(`📋 [EVAL-STEP 7] ${conversation.conversationId}: Lock released, evaluation complete`);
      }
    }

    const duration = Date.now() - startTime;
    metrics.endTime = new Date();
    metrics.durationMs = duration;
    
    console.timeEnd(`[FOLLOWUP-SCHEDULER] Evaluation Cycle ${cycleId}`);
    
    console.log(`📈 [FOLLOWUP-SCHEDULER] ${filterLabel} evaluation cycle completed`);
    console.log(`   ⏱️  Duration: ${duration}ms`);
    console.log(`   📊 Processed: ${processed}/${candidateConversations.length}`);
    console.log(`   🌡️  Temperature updates: ${temperatureUpdates}`);
    console.log(`   📅 Scheduled: ${scheduled}`);
    console.log(`   ⏭️  Skipped: ${skipped}`);
    console.log(`   🛑 Stopped: ${stopped}`);
    console.log(`   ❌ Errors: ${errors}`);
    
    logCycleMetrics(metrics);
    
  } finally {
    isEvaluationRunning = false;
  }
}

/**
 * Run evaluation for COLD leads only (every 2 hours)
 */
export async function runColdLeadsEvaluation(): Promise<void> {
  if (isColdLeadsRunning) {
    console.log('⚠️ [FOLLOWUP-SCHEDULER] Cold leads evaluation already running, skipping...');
    return;
  }

  isColdLeadsRunning = true;
  const startTime = Date.now();
  
  try {
    console.log('❄️ [FOLLOWUP-SCHEDULER] Starting COLD leads evaluation cycle...');
    
    const candidateConversations = await findCandidateConversations(undefined, ['cold']);
    
    console.log(`📊 [FOLLOWUP-SCHEDULER] Found ${candidateConversations.length} COLD candidate conversations`);
    
    if (candidateConversations.length === 0) {
      console.log('💤 [FOLLOWUP-SCHEDULER] No COLD conversations to evaluate');
      return;
    }

    let processed = 0;
    let scheduled = 0;
    let temperatureUpdates = 0;
    let skipped = 0;

    const coldCycleId = `cold_${Date.now()}`;
    for (const conversation of candidateConversations) {
      const lockKey = conversation.conversationId;
      try {
        // LOCK CHECK: Prevent parallel evaluations of the same conversation
        const existingLock = evaluationLocks.get(lockKey);
        const now = Date.now();
        if (existingLock && (now - existingLock.timestamp) < EVALUATION_LOCK_TIMEOUT_MS) {
          console.log(`🔒 [LOCK] ${lockKey}: SKIPPED - Evaluation already in progress by ${existingLock.caller} (cycle: ${existingLock.cycleId}, started ${((now - existingLock.timestamp)/1000).toFixed(1)}s ago)`);
          skipped++;
          continue;
        }
        
        // SMART WAIT CHECK: Skip if nextEvaluationAt is in the future
        if (conversation.nextEvaluationAt) {
          const nowCheck = new Date();
          if (nowCheck < new Date(conversation.nextEvaluationAt)) {
            const hoursUntilNextEval = (new Date(conversation.nextEvaluationAt).getTime() - nowCheck.getTime()) / (1000 * 60 * 60);
            console.log(`⏭️ [SMART-WAIT] Cold ${conversation.conversationId}: SKIPPED - Next eval in ${hoursUntilNextEval.toFixed(1)}h (type: ${conversation.waitType || 'unknown'})`);
            skipped++;
            continue;
          }
        }
        
        // DEBOUNCE: Skip if conversation was evaluated recently (within 5 minutes)
        const DEBOUNCE_MINUTES = 5;
        if (conversation.lastAiEvaluationAt) {
          const minutesSinceLastEval = (Date.now() - new Date(conversation.lastAiEvaluationAt).getTime()) / (1000 * 60);
          if (minutesSinceLastEval < DEBOUNCE_MINUTES) {
            console.log(`⏭️ [DEBOUNCE] ${conversation.conversationId}: SKIPPED - Evaluated ${minutesSinceLastEval.toFixed(1)} min ago`);
            skipped++;
            continue;
          }
        }
        
        // Track and set lock before evaluation
        trackEvaluationCall(lockKey, "cold-leads-cycle");
        evaluationLocks.set(lockKey, { timestamp: Date.now(), caller: "cold-leads-cycle", cycleId: coldCycleId });
        
        // Calculate and update temperature if changed
        const newTemperature = calculateTemperature(conversation.hoursSinceLastInbound);
        if (conversation.temperatureLevel !== newTemperature) {
          await db.update(conversationStates)
            .set({ 
              temperatureLevel: newTemperature,
              updatedAt: new Date()
            })
            .where(eq(conversationStates.conversationId, conversation.conversationId));
          
          console.log(`🌡️ [TEMPERATURE] Cold lead ${conversation.conversationId}: ${conversation.temperatureLevel || 'cold'} → ${newTemperature}`);
          temperatureUpdates++;
          conversation.temperatureLevel = newTemperature;
        }

        const result = await evaluateConversation(conversation);
        processed++;
        if (result === 'scheduled') scheduled++;
      } catch (error) {
        console.error(`❌ [FOLLOWUP-SCHEDULER] Error evaluating cold conversation ${conversation.conversationId}:`, error);
      } finally {
        // Release lock after evaluation completes
        evaluationLocks.delete(lockKey);
      }
    }

    const duration = Date.now() - startTime;
    console.log(`📈 [FOLLOWUP-SCHEDULER] COLD leads evaluation completed in ${duration}ms`);
    console.log(`   📊 Processed: ${processed}, Scheduled: ${scheduled}, Temp updates: ${temperatureUpdates}, Skipped (debounce/lock): ${skipped}`);
    
  } finally {
    isColdLeadsRunning = false;
  }
}

/**
 * Run evaluation for GHOST leads only (daily at 10:00)
 */
export async function runGhostLeadsEvaluation(): Promise<void> {
  if (isGhostLeadsRunning) {
    console.log('⚠️ [FOLLOWUP-SCHEDULER] Ghost leads evaluation already running, skipping...');
    return;
  }

  isGhostLeadsRunning = true;
  const startTime = Date.now();
  
  try {
    console.log('👻 [FOLLOWUP-SCHEDULER] Starting GHOST leads evaluation cycle...');
    
    const candidateConversations = await findCandidateConversations(undefined, ['ghost']);
    
    console.log(`📊 [FOLLOWUP-SCHEDULER] Found ${candidateConversations.length} GHOST candidate conversations`);
    
    if (candidateConversations.length === 0) {
      console.log('💤 [FOLLOWUP-SCHEDULER] No GHOST conversations to evaluate');
      return;
    }

    let processed = 0;
    let scheduled = 0;
    let skipped = 0;

    const ghostCycleId = `ghost_${Date.now()}`;
    for (const conversation of candidateConversations) {
      const lockKey = conversation.conversationId;
      try {
        // LOCK CHECK: Prevent parallel evaluations of the same conversation
        const existingLock = evaluationLocks.get(lockKey);
        const now = Date.now();
        if (existingLock && (now - existingLock.timestamp) < EVALUATION_LOCK_TIMEOUT_MS) {
          console.log(`🔒 [LOCK] ${lockKey}: SKIPPED - Evaluation already in progress by ${existingLock.caller} (cycle: ${existingLock.cycleId}, started ${((now - existingLock.timestamp)/1000).toFixed(1)}s ago)`);
          skipped++;
          continue;
        }
        
        // SMART WAIT CHECK: Skip if nextEvaluationAt is in the future
        if (conversation.nextEvaluationAt) {
          const nowCheck = new Date();
          if (nowCheck < new Date(conversation.nextEvaluationAt)) {
            const hoursUntilNextEval = (new Date(conversation.nextEvaluationAt).getTime() - nowCheck.getTime()) / (1000 * 60 * 60);
            console.log(`⏭️ [SMART-WAIT] Ghost ${conversation.conversationId}: SKIPPED - Next eval in ${hoursUntilNextEval.toFixed(1)}h (type: ${conversation.waitType || 'unknown'})`);
            skipped++;
            continue;
          }
        }
        
        // DEBOUNCE: Skip if conversation was evaluated recently (within 5 minutes)
        const DEBOUNCE_MINUTES = 5;
        if (conversation.lastAiEvaluationAt) {
          const minutesSinceLastEval = (Date.now() - new Date(conversation.lastAiEvaluationAt).getTime()) / (1000 * 60);
          if (minutesSinceLastEval < DEBOUNCE_MINUTES) {
            console.log(`⏭️ [DEBOUNCE] ${conversation.conversationId}: SKIPPED - Evaluated ${minutesSinceLastEval.toFixed(1)} min ago`);
            skipped++;
            continue;
          }
        }
        
        // Track and set lock before evaluation
        trackEvaluationCall(lockKey, "ghost-leads-cycle");
        evaluationLocks.set(lockKey, { timestamp: Date.now(), caller: "ghost-leads-cycle", cycleId: ghostCycleId });
        
        // For ghost leads, we primarily want to mark them or attempt reactivation
        const result = await evaluateConversation(conversation);
        processed++;
        if (result === 'scheduled') scheduled++;
      } catch (error) {
        console.error(`❌ [FOLLOWUP-SCHEDULER] Error evaluating ghost conversation ${conversation.conversationId}:`, error);
      } finally {
        // Release lock after evaluation completes
        evaluationLocks.delete(lockKey);
      }
    }

    const duration = Date.now() - startTime;
    console.log(`📈 [FOLLOWUP-SCHEDULER] GHOST leads evaluation completed in ${duration}ms`);
    console.log(`   📊 Processed: ${processed}, Scheduled: ${scheduled}, Skipped (debounce/lock): ${skipped}`);
    
  } finally {
    isGhostLeadsRunning = false;
  }
}

/**
 * Run evaluation for ENGAGED COLD leads only (every 30 minutes)
 * These are leads that responded at least once but are now cold - they deserve more attention
 */
export async function runEngagedColdLeadsEvaluation(): Promise<void> {
  if (isEngagedColdLeadsRunning) {
    console.log('⚠️ [FOLLOWUP-SCHEDULER] Engaged cold leads evaluation already running, skipping...');
    return;
  }

  isEngagedColdLeadsRunning = true;
  const startTime = Date.now();
  
  try {
    console.log('🔥❄️ [FOLLOWUP-SCHEDULER] Starting ENGAGED COLD leads evaluation cycle...');
    
    // Find cold leads that have ever replied (high priority)
    const candidateConversations = await findEngagedColdCandidates();
    
    console.log(`📊 [FOLLOWUP-SCHEDULER] Found ${candidateConversations.length} ENGAGED COLD candidate conversations`);
    
    if (candidateConversations.length === 0) {
      console.log('💤 [FOLLOWUP-SCHEDULER] No ENGAGED COLD conversations to evaluate');
      return;
    }

    let processed = 0;
    let scheduled = 0;
    let skipped = 0;

    const engagedColdCycleId = `engaged_cold_${Date.now()}`;
    for (const conversation of candidateConversations) {
      const lockKey = conversation.conversationId;
      try {
        // LOCK CHECK: Prevent parallel evaluations of the same conversation
        const existingLock = evaluationLocks.get(lockKey);
        const now = Date.now();
        if (existingLock && (now - existingLock.timestamp) < EVALUATION_LOCK_TIMEOUT_MS) {
          console.log(`🔒 [LOCK] ${lockKey}: SKIPPED - Evaluation already in progress by ${existingLock.caller} (cycle: ${existingLock.cycleId}, started ${((now - existingLock.timestamp)/1000).toFixed(1)}s ago)`);
          skipped++;
          continue;
        }
        
        // SMART WAIT CHECK: Skip if nextEvaluationAt is in the future
        if (conversation.nextEvaluationAt) {
          const nowCheck = new Date();
          if (nowCheck < new Date(conversation.nextEvaluationAt)) {
            const hoursUntilNextEval = (new Date(conversation.nextEvaluationAt).getTime() - nowCheck.getTime()) / (1000 * 60 * 60);
            console.log(`⏭️ [SMART-WAIT] EngagedCold ${conversation.conversationId}: SKIPPED - Next eval in ${hoursUntilNextEval.toFixed(1)}h (type: ${conversation.waitType || 'unknown'})`);
            skipped++;
            continue;
          }
        }
        
        // DEBOUNCE: Skip if conversation was evaluated recently (within 5 minutes)
        const DEBOUNCE_MINUTES = 5;
        if (conversation.lastAiEvaluationAt) {
          const minutesSinceLastEval = (Date.now() - new Date(conversation.lastAiEvaluationAt).getTime()) / (1000 * 60);
          if (minutesSinceLastEval < DEBOUNCE_MINUTES) {
            console.log(`⏭️ [DEBOUNCE] ${conversation.conversationId}: SKIPPED - Evaluated ${minutesSinceLastEval.toFixed(1)} min ago`);
            skipped++;
            continue;
          }
        }
        
        // Track and set lock before evaluation
        trackEvaluationCall(lockKey, "engaged-cold-cycle");
        evaluationLocks.set(lockKey, { timestamp: Date.now(), caller: "engaged-cold-cycle", cycleId: engagedColdCycleId });
        
        const result = await evaluateConversation(conversation);
        processed++;
        if (result === 'scheduled') scheduled++;
      } catch (error) {
        console.error(`❌ [FOLLOWUP-SCHEDULER] Error evaluating engaged cold conversation ${conversation.conversationId}:`, error);
      } finally {
        // Release lock after evaluation completes
        evaluationLocks.delete(lockKey);
      }
    }

    const duration = Date.now() - startTime;
    console.log(`📈 [FOLLOWUP-SCHEDULER] ENGAGED COLD leads evaluation completed in ${duration}ms`);
    console.log(`   ⏭️ Skipped (debounce/lock): ${skipped}`);
    console.log(`   📊 Processed: ${processed}, Scheduled: ${scheduled}`);
    
  } finally {
    isEngagedColdLeadsRunning = false;
  }
}

export async function processScheduledMessages(messageIds?: string[]): Promise<void> {
  if (isProcessingRunning) {
    console.log('⚠️ [FOLLOWUP-SCHEDULER] Message processing already running, skipping...');
    return;
  }

  isProcessingRunning = true;
  const cycleId = generateCycleId();
  const startTime = Date.now();
  console.time(`[FOLLOWUP-SCHEDULER] Processing Cycle ${cycleId}`);
  
  const metrics: CycleMetrics = {
    cycleId,
    type: 'message_processing',
    startTime: new Date(),
    processed: 0,
    success: 0,
    errors: 0,
    skipped: 0,
    rateLimited: 0
  };
  
  try {
    const isManualSend = messageIds && messageIds.length > 0;
    console.log(`📤 [FOLLOWUP-SCHEDULER] Processing scheduled messages...${isManualSend ? ' (MANUAL SEND NOW)' : ''}`);
    
    const now = new Date();
    let pendingMessages;
    
    if (isManualSend) {
      pendingMessages = await db
        .select()
        .from(scheduledFollowupMessages)
        .where(
          and(
            eq(scheduledFollowupMessages.status, 'pending'),
            inArray(scheduledFollowupMessages.id, messageIds)
          )
        )
        .limit(50);
    } else {
      pendingMessages = await db
        .select()
        .from(scheduledFollowupMessages)
        .where(
          and(
            eq(scheduledFollowupMessages.status, 'pending'),
            lte(scheduledFollowupMessages.scheduledFor, now)
          )
        )
        .limit(50);
    }

    console.log(`📬 [FOLLOWUP-SCHEDULER] Found ${pendingMessages.length} pending messages to send`);

    if (pendingMessages.length === 0) {
      console.log('💤 [FOLLOWUP-SCHEDULER] No pending messages');
      return;
    }

    let sent = 0;
    let failed = 0;
    let cancelled = 0;
    let rateLimited = 0;

    for (const message of pendingMessages) {
      try {
        metrics.processed++;
        
        const conversation = await db
          .select({ consultantId: whatsappConversations.consultantId })
          .from(whatsappConversations)
          .where(eq(whatsappConversations.id, message.conversationId))
          .limit(1);
        
        const consultantId = conversation[0]?.consultantId;
        
        if (consultantId && !canSendMessage(consultantId)) {
          const rescheduleTime = new Date(Date.now() + 60 * 60 * 1000);
          await db
            .update(scheduledFollowupMessages)
            .set({
              scheduledFor: rescheduleTime
            })
            .where(eq(scheduledFollowupMessages.id, message.id));
          
          rateLimited++;
          metrics.rateLimited++;
          const info = getRateLimitInfo(consultantId);
          console.log(`⏳ [FOLLOWUP-SCHEDULER] Message ${message.id} rate limited - rescheduled (${info.remaining} remaining, resets ${info.resetAt?.toISOString()})`);
          continue;
        }
        
        const shouldSend = await checkIfShouldStillSend(message.conversationId);
        
        if (!shouldSend) {
          await db
            .update(scheduledFollowupMessages)
            .set({
              status: 'cancelled',
              cancelledAt: new Date(),
              cancelReason: 'user_replied'
            })
            .where(eq(scheduledFollowupMessages.id, message.id));
          
          cancelled++;
          metrics.skipped++;
          console.log(`⏭️ [FOLLOWUP-SCHEDULER] Message ${message.id} cancelled - user replied`);
          continue;
        }

        // ATOMIC CLAIM: Mark as 'sending' before sending to prevent race conditions
        // This prevents duplicate sends if the scheduler runs twice before completion
        const claimedResult = await db
          .update(scheduledFollowupMessages)
          .set({
            status: 'sending',
            lastAttemptAt: new Date()
          })
          .where(
            and(
              eq(scheduledFollowupMessages.id, message.id),
              eq(scheduledFollowupMessages.status, 'pending')
            )
          )
          .returning();
        
        if (claimedResult.length === 0) {
          console.log(`⏭️ [FOLLOWUP-SCHEDULER] Message ${message.id} already claimed by another process`);
          metrics.skipped++;
          continue;
        }

        // Use the claimed result which has updated status, not the stale message object
        await sendFollowupMessage(claimedResult[0]);
        
        if (consultantId) {
          recordMessageSent(consultantId);
        }
        
        await db
          .update(scheduledFollowupMessages)
          .set({
            status: 'sent',
            sentAt: new Date(),
            attemptCount: (message.attemptCount || 0) + 1,
            lastAttemptAt: new Date()
          })
          .where(eq(scheduledFollowupMessages.id, message.id));
        
        sent++;
        metrics.success++;
        console.log(`✅ [FOLLOWUP-SCHEDULER] Message ${message.id} sent successfully`);
        
      } catch (error: any) {
        const attemptCount = (message.attemptCount || 0) + 1;
        const maxAttempts = message.maxAttempts || 3;
        
        // Classify error type
        const errorCode = classifyErrorCode(error.message);
        const isPermanent = PERMANENT_ERROR_CODES.includes(errorCode as any);
        
        if (isPermanent) {
          // Permanent error - mark as failed immediately
          await db
            .update(scheduledFollowupMessages)
            .set({
              status: 'failed',
              attemptCount,
              lastAttemptAt: new Date(),
              errorMessage: error.message,
              lastErrorCode: errorCode,
              failureReason: errorCode === 'blocked' ? 'user_blocked' : 
                            errorCode === 'invalid_number' ? 'invalid_recipient' : 'permanent_error'
            })
            .where(eq(scheduledFollowupMessages.id, message.id));
          
          console.error(`❌ [FOLLOWUP-SCHEDULER] Message ${message.id} failed permanently (${errorCode}):`, error.message);
        } else if (attemptCount >= maxAttempts) {
          // Max retries exceeded
          await db
            .update(scheduledFollowupMessages)
            .set({
              status: 'failed',
              attemptCount,
              lastAttemptAt: new Date(),
              errorMessage: error.message,
              lastErrorCode: errorCode,
              failureReason: 'max_retries_exceeded'
            })
            .where(eq(scheduledFollowupMessages.id, message.id));
          
          console.error(`❌ [FOLLOWUP-SCHEDULER] Message ${message.id} failed after ${attemptCount} attempts:`, error.message);
        } else {
          // Retryable error - schedule retry with exponential backoff
          const backoffMinutes = getRetryBackoffMinutes(attemptCount);
          const nextRetryAt = new Date(Date.now() + backoffMinutes * 60 * 1000);
          
          await db
            .update(scheduledFollowupMessages)
            .set({
              status: 'pending', // Reset to pending so it can be picked up again
              attemptCount,
              lastAttemptAt: new Date(),
              errorMessage: error.message,
              lastErrorCode: errorCode,
              nextRetryAt,
              scheduledFor: nextRetryAt // Update scheduledFor so it gets picked up
            })
            .where(eq(scheduledFollowupMessages.id, message.id));
          
          console.warn(`⚠️ [FOLLOWUP-SCHEDULER] Message ${message.id} will retry in ${backoffMinutes}min (attempt ${attemptCount}/${maxAttempts}):`, error.message);
        }
        
        failed++;
        metrics.errors++;
      }
    }

    const duration = Date.now() - startTime;
    metrics.endTime = new Date();
    metrics.durationMs = duration;
    
    console.timeEnd(`[FOLLOWUP-SCHEDULER] Processing Cycle ${cycleId}`);
    
    console.log('📈 [FOLLOWUP-SCHEDULER] Message processing completed');
    console.log(`   ⏱️  Duration: ${duration}ms`);
    console.log(`   ✅ Sent: ${sent}`);
    console.log(`   ⏭️  Cancelled: ${cancelled}`);
    console.log(`   ⏳ Rate Limited: ${rateLimited}`);
    console.log(`   ❌ Failed: ${failed}`);
    
    logCycleMetrics(metrics);
    
  } finally {
    isProcessingRunning = false;
  }
}

interface ApplicableRule {
  id: string;
  name: string;
  priority: number;
  triggerType: string;
  templateId: string | null;
  fallbackMessage: string | null;
  maxAttempts: number;
  cooldownHours: number;
}

interface CandidateConversation {
  conversationId: string;
  stateId: string;
  currentState: string;
  daysSilent: number;
  hoursSilent: number;
  hoursSinceLastInbound: number;
  followupCount: number;
  maxFollowupsAllowed: number;
  engagementScore: number;
  conversionProbability: number;
  signals: {
    hasAskedPrice: boolean;
    hasMentionedUrgency: boolean;
    hasSaidNoExplicitly: boolean;
    discoveryCompleted: boolean;
    demoPresented: boolean;
  };
  consultantId: string;
  agentConfigId: string | null;
  agentType: string;
  phoneNumber: string;
  leadName?: string;
  applicableRules: ApplicableRule[];
  lastFollowupAt?: Date | null;
  temperatureLevel?: TemperatureLevel;
  leadNeverResponded: boolean;
  minutesSilent: number;
  secondsSilent: number;
  lastInboundMessageAt: Date | null;
  // NEW: Intelligent retry logic fields
  consecutiveNoReplyCount: number;
  lastReplyAt: Date | null;
  dormantUntil: Date | null;
  permanentlyExcluded: boolean;
  dormantReason: string | null;
  // NEW: Engaged lead priority fields
  hasEverReplied?: boolean;
  warmFollowupCount?: number;
  lastWarmFollowupAt?: Date | null;
  // NEW: Debounce field to prevent duplicate AI evaluations
  lastAiEvaluationAt?: Date | null;
  // NEW: Smart Wait State fields - prevent excessive AI evaluations
  nextEvaluationAt?: Date | null;
  waitType?: string | null;
}

/**
 * Build template variables for follow-up messages
 * Retrieves lead data from proactiveLeads and agent config to populate template placeholders
 */
async function buildFollowupTemplateVariables(
  conversationId: string,
  consultantId: string,
  agentConfigId: string | null,
  leadName?: string
): Promise<Record<string, string>> {
  try {
    // Get conversation to find proactiveLeadId
    const conversation = await db
      .select({
        proactiveLeadId: whatsappConversations.proactiveLeadId,
      })
      .from(whatsappConversations)
      .where(eq(whatsappConversations.id, conversationId))
      .limit(1);

    let firstName = leadName || 'Cliente';
    let consultantName = '';
    let businessName = '';
    let idealState = 'i tuoi obiettivi';

    // If there's a proactive lead, get its data
    if (conversation.length > 0 && conversation[0].proactiveLeadId) {
      const lead = await db
        .select({
          firstName: proactiveLeads.firstName,
          idealState: proactiveLeads.idealState,
          leadInfo: proactiveLeads.leadInfo,
        })
        .from(proactiveLeads)
        .where(eq(proactiveLeads.id, conversation[0].proactiveLeadId))
        .limit(1);

      if (lead.length > 0) {
        firstName = lead[0].firstName || firstName;
        idealState = lead[0].idealState || (lead[0].leadInfo as any)?.obiettivi || idealState;
      }
    }

    // Get agent config for consultant name and business
    if (agentConfigId) {
      const agentConfig = await db
        .select({
          consultantDisplayName: consultantWhatsappConfig.consultantDisplayName,
          agentName: consultantWhatsappConfig.agentName,
          businessName: consultantWhatsappConfig.businessName,
        })
        .from(consultantWhatsappConfig)
        .where(eq(consultantWhatsappConfig.id, agentConfigId))
        .limit(1);

      if (agentConfig.length > 0) {
        consultantName = agentConfig[0].consultantDisplayName || agentConfig[0].agentName || '';
        businessName = agentConfig[0].businessName || '';
      }
    }

    // If no consultant name from agent config, get from users table
    if (!consultantName) {
      const consultant = await db
        .select({
          firstName: users.firstName,
          lastName: users.lastName,
        })
        .from(users)
        .where(eq(users.id, consultantId))
        .limit(1);

      if (consultant.length > 0) {
        consultantName = `${consultant[0].firstName || ''} ${consultant[0].lastName || ''}`.trim();
      }
    }

    // Build variables object - keys match template placeholders
    const variables: Record<string, string> = {
      "1": firstName,
      "2": consultantName || 'il tuo consulente',
      "3": businessName || 'la nostra azienda',
      "4": idealState,
      "5": idealState, // Some templates use {{5}} for the same purpose
    };

    console.log(`📋 [TEMPLATE-VARS] Built variables for ${conversationId}:`, JSON.stringify(variables));
    return variables;

  } catch (error) {
    console.error(`❌ [TEMPLATE-VARS] Error building variables for ${conversationId}:`, error);
    // Return minimal fallback
    return {
      "1": leadName || 'Cliente',
      "2": 'il tuo consulente',
      "3": 'la nostra azienda',
      "4": 'i tuoi obiettivi',
      "5": 'i tuoi obiettivi',
    };
  }
}

async function findApplicableRules(
  consultantId: string,
  agentConfigId: string | null,
  currentState: string,
  agentType: string,
  engagementScore: number,
  hoursSilent: number,
  lastFollowupAt?: Date | null
): Promise<ApplicableRule[]> {
  const allRules = await db
    .select()
    .from(followupRules)
    .where(
      and(
        eq(followupRules.consultantId, consultantId),
        eq(followupRules.isActive, true)
      )
    )
    .orderBy(desc(followupRules.priority));

  const applicable: ApplicableRule[] = [];

  for (const rule of allRules) {
    const applicableToStates = (rule.applicableToStates as string[] | null) || [];
    if (applicableToStates.length > 0 && !applicableToStates.includes(currentState)) {
      continue;
    }

    const applicableToAgentTypes = (rule.applicableToAgentTypes as string[] | null) || [];
    if (applicableToAgentTypes.length > 0 && !applicableToAgentTypes.includes(agentType)) {
      continue;
    }

    if (rule.agentId && rule.agentId !== agentConfigId) {
      continue;
    }

    const condition = rule.triggerCondition as {
      hoursWithoutReply?: number;
      daysWithoutReply?: number;
      afterState?: string;
      minEngagementScore?: number;
      maxEngagementScore?: number;
    } | null;

    if (condition) {
      if (condition.hoursWithoutReply !== undefined) {
        if (hoursSilent < condition.hoursWithoutReply) {
          continue;
        }
      }

      if (condition.daysWithoutReply !== undefined) {
        const requiredHours = condition.daysWithoutReply * 24;
        if (hoursSilent < requiredHours) {
          continue;
        }
      }

      if (condition.minEngagementScore !== undefined) {
        if (engagementScore < condition.minEngagementScore) {
          continue;
        }
      }

      if (condition.maxEngagementScore !== undefined) {
        if (engagementScore > condition.maxEngagementScore) {
          continue;
        }
      }

      if (condition.afterState !== undefined) {
        if (currentState !== condition.afterState) {
          continue;
        }
      }
    }

    if (lastFollowupAt && rule.cooldownHours > 0) {
      const hoursSinceLastFollowup = (Date.now() - new Date(lastFollowupAt).getTime()) / (1000 * 60 * 60);
      if (hoursSinceLastFollowup < rule.cooldownHours) {
        console.log(`⏰ [FOLLOWUP-SCHEDULER] Rule "${rule.name}" skipped due to cooldown (${hoursSinceLastFollowup.toFixed(1)}h < ${rule.cooldownHours}h)`);
        continue;
      }
    }

    applicable.push({
      id: rule.id,
      name: rule.name,
      priority: rule.priority,
      triggerType: rule.triggerType,
      templateId: rule.templateId,
      fallbackMessage: rule.fallbackMessage,
      maxAttempts: rule.maxAttempts,
      cooldownHours: rule.cooldownHours,
    });
  }

  return applicable;
}

export async function findCandidateConversations(
  consultantId?: string,
  temperatureFilter?: TemperatureLevel[]
): Promise<CandidateConversation[]> {
  const closedStates = ['closed_won', 'closed_lost'];
  
  // NEW SYSTEM: L'AI è sempre attiva come "regola hardcoded".
  // Non richiediamo più regole DB - ogni consulente con configurazione WhatsApp attiva viene valutato.
  // Le preferenze AI personalizzano il comportamento dell'AI, ma l'AI funziona sempre.
  
  let consultantIds: string[] = [];
  
  if (consultantId) {
    // Specific consultant requested
    consultantIds = [consultantId];
    console.log(`🧑‍💼 [FOLLOWUP-SCHEDULER] Evaluating specific consultant: ${consultantId}`);
  } else {
    // Get all consultants with active WhatsApp configs
    const consultantsWithWhatsapp = await db
      .selectDistinct({ consultantId: consultantWhatsappConfig.consultantId })
      .from(consultantWhatsappConfig)
      .where(eq(consultantWhatsappConfig.isActive, true));
    
    consultantIds = consultantsWithWhatsapp.map(c => c.consultantId).filter((id): id is string => id !== null);
    
    if (consultantIds.length === 0) {
      console.log('⚠️ [FOLLOWUP-SCHEDULER] No consultants with active WhatsApp configuration');
      return [];
    }
    
    console.log(`🧠 [FOLLOWUP-SCHEDULER] AI-ONLY mode: Found ${consultantIds.length} consultants with active WhatsApp configs`);
  }

  // Build dynamic where conditions
  // TASK 7: Confirmation log - we filter out closed conversations here
  console.log(`✅ [FILTER-CHECK] Excluding closed states: 'closed_won', 'closed_lost' from candidate search`);
  const whereConditions = [
    sql`${conversationStates.currentState} NOT IN ('closed_won', 'closed_lost')`,
    inArray(whatsappConversations.consultantId, consultantIds),
    eq(whatsappConversations.isActive, true)
  ];

  // Add temperature filter if specified
  if (temperatureFilter && temperatureFilter.length > 0) {
    whereConditions.push(inArray(conversationStates.temperatureLevel, temperatureFilter));
    console.log(`🌡️ [FOLLOWUP-SCHEDULER] Filtering by temperature: ${temperatureFilter.join(', ')}`);
  }

  const candidateStates = await db
    .select({
      stateId: conversationStates.id,
      conversationId: conversationStates.conversationId,
      currentState: conversationStates.currentState,
      followupCount: conversationStates.followupCount,
      maxFollowupsAllowed: conversationStates.maxFollowupsAllowed,
      engagementScore: conversationStates.engagementScore,
      conversionProbability: conversationStates.conversionProbability,
      hasAskedPrice: conversationStates.hasAskedPrice,
      hasMentionedUrgency: conversationStates.hasMentionedUrgency,
      hasSaidNoExplicitly: conversationStates.hasSaidNoExplicitly,
      discoveryCompleted: conversationStates.discoveryCompleted,
      demoPresented: conversationStates.demoPresented,
      nextFollowupScheduledAt: conversationStates.nextFollowupScheduledAt,
      lastFollowupAt: conversationStates.lastFollowupAt,
      temperatureLevel: conversationStates.temperatureLevel,
      // NEW: Engaged lead priority fields
      hasEverReplied: conversationStates.hasEverReplied,
      warmFollowupCount: conversationStates.warmFollowupCount,
      lastWarmFollowupAt: conversationStates.lastWarmFollowupAt,
      // NEW: Debounce field
      lastAiEvaluationAt: conversationStates.lastAiEvaluationAt,
      // NEW: Smart Wait State fields
      nextEvaluationAt: conversationStates.nextEvaluationAt,
      waitType: conversationStates.waitType,
      // NEW: Intelligent retry logic fields
      consecutiveNoReplyCount: conversationStates.consecutiveNoReplyCount,
      lastReplyAt: conversationStates.lastReplyAt,
      dormantUntil: conversationStates.dormantUntil,
      permanentlyExcluded: conversationStates.permanentlyExcluded,
      dormantReason: conversationStates.dormantReason,
      conversation: {
        consultantId: whatsappConversations.consultantId,
        agentConfigId: whatsappConversations.agentConfigId,
        phoneNumber: whatsappConversations.phoneNumber,
        lastMessageAt: whatsappConversations.lastMessageAt,
        isActive: whatsappConversations.isActive,
      }
    })
    .from(conversationStates)
    .innerJoin(
      whatsappConversations,
      eq(conversationStates.conversationId, whatsappConversations.id)
    )
    .where(and(...whereConditions));

  const now = new Date();
  const candidates: CandidateConversation[] = [];

  for (const state of candidateStates) {
    const lastMessageAt = state.conversation.lastMessageAt;
    const msSilent = lastMessageAt 
      ? (now.getTime() - new Date(lastMessageAt).getTime())
      : 999 * 24 * 60 * 60 * 1000;
    const hoursSilent = msSilent / (1000 * 60 * 60);
    const daysSilent = Math.floor(hoursSilent / 24);

    const lastInboundMessage = await db
      .select({ createdAt: whatsappMessages.createdAt })
      .from(whatsappMessages)
      .where(
        and(
          eq(whatsappMessages.conversationId, state.conversationId),
          eq(whatsappMessages.sender, 'client')
        )
      )
      .orderBy(desc(whatsappMessages.createdAt))
      .limit(1);

    const hoursSinceLastInbound = lastInboundMessage.length > 0 && lastInboundMessage[0].createdAt
      ? (now.getTime() - new Date(lastInboundMessage[0].createdAt).getTime()) / (1000 * 60 * 60)
      : 999;

    const leadNeverResponded = lastInboundMessage.length === 0;
    const lastInboundMessageAt = lastInboundMessage.length > 0 && lastInboundMessage[0].createdAt
      ? new Date(lastInboundMessage[0].createdAt)
      : null;
    const minutesSilent = Math.floor((msSilent / (1000 * 60)) % 60);
    const secondsSilent = Math.floor((msSilent / 1000) % 60);
    
    // Log dettagliato per debugging
    console.log(`📊 [CANDIDATE] ${state.conversationId}: leadNeverResponded=${leadNeverResponded}, hoursSinceLastInbound=${hoursSinceLastInbound.toFixed(1)}h, lastInbound=${lastInboundMessageAt?.toISOString() || 'NULL'}`);

    // RACE CONDITION FIX: Verify that at least one outbound message exists in the chat
    // This prevents the followup-scheduler from evaluating conversations where
    // the proactive-outreach hasn't sent the first message yet
    const outboundMessageCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(whatsappMessages)
      .where(
        and(
          eq(whatsappMessages.conversationId, state.conversationId),
          inArray(whatsappMessages.sender, ['consultant', 'ai', 'system'])
        )
      );
    
    const hasOutboundMessages = outboundMessageCount[0]?.count > 0;
    
    if (!hasOutboundMessages) {
      console.log(`⏭️ [CANDIDATE] ${state.conversationId}: SKIPPED - No outbound messages yet (proactive-outreach not completed)`);
      continue;
    }

    if (state.nextFollowupScheduledAt && new Date(state.nextFollowupScheduledAt) > now) {
      continue;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // NEW INTELLIGENT RETRY LOGIC - Replaces fixed maxFollowupsAllowed check
    // ═══════════════════════════════════════════════════════════════════════════
    
    // 1. Skip permanently excluded leads (never contact again)
    if (state.permanentlyExcluded) {
      console.log(`🚫 [CANDIDATE] ${state.conversationId}: SKIPPED - Permanently excluded (${state.dormantReason || 'no reason'})`);
      continue;
    }
    
    // 2. Skip leads currently in dormancy period
    if (state.dormantUntil && new Date(state.dormantUntil) > now) {
      const daysUntilWakeup = Math.ceil((new Date(state.dormantUntil).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      console.log(`😴 [CANDIDATE] ${state.conversationId}: SKIPPED - Dormant until ${state.dormantUntil.toISOString()} (${daysUntilWakeup} days left)`);
      continue;
    }
    
    // 3. Check if reached consecutive no-reply threshold (trigger dormancy)
    // Note: actual threshold is loaded from consultant preferences in evaluateConversation
    if (state.consecutiveNoReplyCount >= 3 && !state.dormantUntil) {
      console.log(`⏸️ [CANDIDATE] ${state.conversationId}: High consecutive no-reply count (${state.consecutiveNoReplyCount}), will check dormancy threshold`);
      // This will be handled in evaluateConversation with consultant-specific threshold
    }
    
    // LEGACY CHECK RIMOSSO: ora usa solo la logica intelligente (consecutiveNoReplyCount + dormancy)

    let agentType = 'reactive_lead';
    if (state.conversation.agentConfigId) {
      const agentConfig = await db
        .select({ agentType: consultantWhatsappConfig.agentType })
        .from(consultantWhatsappConfig)
        .where(eq(consultantWhatsappConfig.id, state.conversation.agentConfigId))
        .limit(1);
      
      if (agentConfig.length > 0) {
        agentType = agentConfig[0].agentType;
      }
    }

    const applicableRules = await findApplicableRules(
      state.conversation.consultantId,
      state.conversation.agentConfigId,
      state.currentState,
      agentType,
      state.engagementScore,
      hoursSilent,
      state.lastFollowupAt
    );

    candidates.push({
      conversationId: state.conversationId,
      stateId: state.stateId,
      currentState: state.currentState,
      daysSilent,
      hoursSilent,
      hoursSinceLastInbound,
      followupCount: state.followupCount,
      maxFollowupsAllowed: state.maxFollowupsAllowed,
      engagementScore: state.engagementScore,
      conversionProbability: state.conversionProbability ?? 0.5,
      signals: {
        hasAskedPrice: state.hasAskedPrice,
        hasMentionedUrgency: state.hasMentionedUrgency,
        hasSaidNoExplicitly: state.hasSaidNoExplicitly,
        discoveryCompleted: state.discoveryCompleted,
        demoPresented: state.demoPresented,
      },
      consultantId: state.conversation.consultantId,
      agentConfigId: state.conversation.agentConfigId,
      agentType,
      phoneNumber: state.conversation.phoneNumber,
      applicableRules,
      lastFollowupAt: state.lastFollowupAt,
      temperatureLevel: state.temperatureLevel as TemperatureLevel | undefined,
      leadNeverResponded,
      minutesSilent,
      secondsSilent,
      lastInboundMessageAt,
      // NEW: Intelligent retry logic fields
      consecutiveNoReplyCount: state.consecutiveNoReplyCount,
      lastReplyAt: state.lastReplyAt ? new Date(state.lastReplyAt) : null,
      dormantUntil: state.dormantUntil ? new Date(state.dormantUntil) : null,
      permanentlyExcluded: state.permanentlyExcluded,
      dormantReason: state.dormantReason,
      // NEW: Engaged lead priority fields
      hasEverReplied: state.hasEverReplied,
      warmFollowupCount: state.warmFollowupCount,
      lastWarmFollowupAt: state.lastWarmFollowupAt ? new Date(state.lastWarmFollowupAt) : null,
      // NEW: Debounce field
      lastAiEvaluationAt: state.lastAiEvaluationAt ? new Date(state.lastAiEvaluationAt) : null,
    });
  }

  return candidates;
}

async function findEngagedColdCandidates(): Promise<CandidateConversation[]> {
  console.log('🔍 [FOLLOWUP-SCHEDULER] Finding engaged cold candidates (hasEverReplied=true, temp=cold)...');
  
  // Use findCandidateConversations but filter for hasEverReplied=true after
  const coldCandidates = await findCandidateConversations(undefined, ['cold']);
  
  // Filter only those that have ever replied
  const engagedColdCandidates = coldCandidates.filter(c => c.hasEverReplied === true);
  
  console.log(`🔥❄️ [FOLLOWUP-SCHEDULER] Filtered to ${engagedColdCandidates.length} engaged cold leads (from ${coldCandidates.length} total cold)`);
  
  return engagedColdCandidates;
}

async function evaluateConversation(
  candidate: CandidateConversation
): Promise<'scheduled' | 'skipped' | 'stopped'> {
  console.log(`🧠 [AI-STEP 1] ${candidate.conversationId}: Loading retry configuration`);
  // Load consultant's retry configuration from database
  const retryConfig = await getConsultantRetryConfig(candidate.consultantId);
  console.log(`🧠 [AI-STEP 1] ${candidate.conversationId}: Config loaded (maxNoReply: ${retryConfig.maxNoReplyBeforeDormancy}, dormancy: ${retryConfig.dormancyDurationDays}d)`);
  
  console.log(`🔍 [FOLLOWUP-SCHEDULER] Evaluating conversation ${candidate.conversationId}`);
  console.log(`   State: ${candidate.currentState}, Days silent: ${candidate.daysSilent}, Hours silent: ${candidate.hoursSilent.toFixed(1)}`);
  console.log(`   📊 Follow-ups: ${candidate.followupCount} total | 🆕 Consecutive no-reply: ${candidate.consecutiveNoReplyCount}/${retryConfig.maxNoReplyBeforeDormancy} → Dormancy`);
  console.log(`   😴 Status: ${candidate.permanentlyExcluded ? '🚫 PERMANENTLY EXCLUDED' : candidate.dormantUntil && new Date(candidate.dormantUntil) > new Date() ? `DORMANT until ${candidate.dormantUntil.toISOString()}` : 'ACTIVE'}`);
  
  // ═══════════════════════════════════════════════════════════════════════════
  // NEW INTELLIGENT RETRY LOGIC (uses consultant's configurable preferences)
  // ═══════════════════════════════════════════════════════════════════════════
  
  console.log(`🧠 [AI-STEP 2] ${candidate.conversationId}: Checking exclusion/dormancy status`);
  
  // 1. Check if permanently excluded
  if (candidate.permanentlyExcluded) {
    console.log(`🧠 [AI-STEP 2] ${candidate.conversationId}: BLOCKED - Permanently excluded`);
    console.log(`🚫 [INTELLIGENT-RETRY] Lead permanently excluded: ${candidate.dormantReason || 'No reason provided'}`);
    return 'stopped';
  }
  
  // 2. Check if still in dormancy
  const now = new Date();
  if (candidate.dormantUntil && candidate.dormantUntil > now) {
    const daysLeft = Math.ceil((candidate.dormantUntil.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    console.log(`🧠 [AI-STEP 2] ${candidate.conversationId}: BLOCKED - In dormancy (${daysLeft} days left)`);
    console.log(`😴 [INTELLIGENT-RETRY] Lead still dormant for ${daysLeft} more days. Reason: ${candidate.dormantReason}`);
    return 'skipped';
  }
  console.log(`🧠 [AI-STEP 2] ${candidate.conversationId}: PASSED - No exclusion or active dormancy`);

  
  // 3. Check if dormancy just ended (was dormant, now it's time to try once more)
  const maxNoReply = retryConfig.maxNoReplyBeforeDormancy;
  if (candidate.dormantUntil && candidate.dormantUntil <= now && candidate.consecutiveNoReplyCount >= maxNoReply) {
    // Check if this is the final attempt after dormancy (consecutiveNoReplyCount >= maxNoReply+1 means we already tried once after dormancy)
    if (candidate.consecutiveNoReplyCount >= maxNoReply + 1) {
      console.log(`🚫 [INTELLIGENT-RETRY] Final attempt after dormancy already sent. Lead did not reply. PERMANENT EXCLUSION.`);
      
      await updateConversationState(candidate.conversationId, {
        permanentlyExcluded: true,
        dormantReason: `Nessuna risposta dopo tentativo finale post-dormienza (${candidate.consecutiveNoReplyCount}+ tentativi totali)`,
        lastAiEvaluationAt: new Date(),
        aiRecommendation: `[INTELLIGENT-RETRY] Esclusione permanente: nessuna risposta dopo il tentativo finale post-dormienza`,
      } as any);
      
      console.log(`🚫 [INTELLIGENT-RETRY] Lead ${candidate.conversationId} PERMANENTLY EXCLUDED`);
      return 'stopped';
    }
    
    console.log(`⏰ [INTELLIGENT-RETRY] Dormancy period ended! This is the FINAL attempt after ${retryConfig.dormancyDurationDays}-day break.`);
    // Allow one more attempt, consecutiveNoReplyCount will increment
    // Next evaluation will trigger permanent exclusion if no reply
  }
  
  // 4. Check if reached consecutive no-replies threshold (should enter dormancy)
  if (candidate.consecutiveNoReplyCount >= maxNoReply && !candidate.dormantUntil) {
    console.log(`⏸️ [INTELLIGENT-RETRY] Reached ${maxNoReply} consecutive no-reply attempts. Entering ${retryConfig.dormancyDurationDays}-day dormancy.`);
    
    const dormantUntilDate = new Date();
    dormantUntilDate.setDate(dormantUntilDate.getDate() + retryConfig.dormancyDurationDays);
    
    await updateConversationState(candidate.conversationId, {
      currentState: 'ghost',
      previousState: candidate.currentState,
      lastAiEvaluationAt: new Date(),
      aiRecommendation: `[INTELLIGENT-RETRY] ${maxNoReply} tentativi senza risposta. Dormienza attivata fino a ${dormantUntilDate.toLocaleDateString('it-IT')}`,
      dormantUntil: dormantUntilDate,
      dormantReason: `Nessuna risposta dopo ${maxNoReply} tentativi consecutivi`,
    } as any);
    
    console.log(`😴 [INTELLIGENT-RETRY] Lead ${candidate.conversationId} now dormant until ${dormantUntilDate.toISOString()}`);
    return 'stopped';
  }
  
  // Uses consultant's configurable preferences:
  // maxNoReply tentativi senza risposta → dormienza N giorni → 1 tentativo finale → esclusione permanente
  
  // Bug 3 Fix: Safety check for applicableRules that could be undefined
  const applicableRules = candidate.applicableRules;
  if (!applicableRules || !Array.isArray(applicableRules)) {
    console.log(`⚠️ [FOLLOWUP-SCHEDULER] applicableRules is undefined or not an array for ${candidate.conversationId}, skipping`);
    return 'skipped';
  }
  
  console.log(`   📋 Applicable rules: ${applicableRules.length} (Sistema AI attivo - le regole sono opzionali)`);

  // NUOVO: Invece di saltare quando non ci sono regole, passiamo direttamente all'AI
  // Il sistema AI "Marco" decide autonomamente senza bisogno di regole predefinite
  
  // Bug 1 Fix: Check for existing pending messages before scheduling
  const existingPending = await db
    .select({ id: scheduledFollowupMessages.id })
    .from(scheduledFollowupMessages)
    .where(
      and(
        eq(scheduledFollowupMessages.conversationId, candidate.conversationId),
        eq(scheduledFollowupMessages.status, 'pending')
      )
    )
    .limit(1);
  
  if (existingPending.length > 0) {
    console.log(`⏭️ [FOLLOWUP-SCHEDULER] Pending message already exists for ${candidate.conversationId} (id: ${existingPending[0].id}), skipping duplicate scheduling`);
    return 'skipped';
  }

  const timeBasedRule = applicableRules.find(r => r.triggerType === 'time_based');
  
  if (timeBasedRule) {
    console.log(`⚡ [FOLLOWUP-SCHEDULER] Using deterministic time_based rule: "${timeBasedRule.name}" (priority: ${timeBasedRule.priority})`);
    
    if (candidate.followupCount >= timeBasedRule.maxAttempts) {
      console.log(`🛑 [FOLLOWUP-SCHEDULER] Max attempts reached for rule "${timeBasedRule.name}" (${candidate.followupCount}/${timeBasedRule.maxAttempts})`);
      
      await updateConversationState(candidate.conversationId, {
        currentState: 'ghost',
        previousState: candidate.currentState,
        lastAiEvaluationAt: new Date(),
        aiRecommendation: `Max follow-up attempts reached (${timeBasedRule.maxAttempts}) for rule "${timeBasedRule.name}"`,
      });
      
      return 'stopped';
    }

    const scheduledFor = new Date();
    
    // 🔍 DEBUG LOG: Traccia agentConfigId passato alla validazione
    console.log(`🔍 [TEMPLATE-TRACE] ═══ CHIAMATA 1: time_based rule ═══`);
    console.log(`🔍 [TEMPLATE-TRACE] candidate.agentConfigId: ${candidate.agentConfigId || 'NULL/UNDEFINED'}`);
    console.log(`🔍 [TEMPLATE-TRACE] candidate.conversationId: ${candidate.conversationId}`);
    console.log(`🔍 [TEMPLATE-TRACE] candidate.leadName: ${candidate.leadName}`);
    
    const windowCheck = await validate24hWindowForScheduling(
      candidate.conversationId,
      scheduledFor,
      candidate.agentConfigId
    );
    
    if (!windowCheck.canSchedule) {
      const skipContext: FollowupContext = {
        conversationId: candidate.conversationId,
        leadName: candidate.leadName,
        currentState: candidate.currentState,
        daysSilent: candidate.daysSilent,
        hoursSinceLastInbound: candidate.hoursSinceLastInbound,
        followupCount: candidate.followupCount,
        maxFollowupsAllowed: candidate.maxFollowupsAllowed,
        channel: 'whatsapp',
        agentType: candidate.agentType,
        lastMessages: [],
        lastMessageDirection: null,
        signals: candidate.signals,
        engagementScore: candidate.engagementScore,
        conversionProbability: candidate.conversionProbability,
        availableTemplates: [],
        hoursSilent: candidate.hoursSilent,
        minutesSilent: candidate.minutesSilent,
        secondsSilent: candidate.secondsSilent,
        leadNeverResponded: candidate.leadNeverResponded,
      };
      
      const reasoningMessage = windowCheck.leadNeverResponded
        ? `Il lead non ha ancora risposto - finestra 24h non aperta. Nessun template Twilio approvato assegnato a questo agente. Configura template nella sezione Template WhatsApp.`
        : `Impossibile schedulare: saremo fuori finestra 24h (scade ${windowCheck.window24hExpiresAt.toISOString()}) e nessun template approvato disponibile. Configura template per questo agente.`;
      
      await logFollowupDecision(
        candidate.conversationId,
        skipContext,
        {
          decision: 'skip',
          reasoning: reasoningMessage,
          confidenceScore: 1.0,
          matchedSystemRule: 'no_template_outside_24h'
        },
        'system-validation',
        0, 0
      );
      
      await updateConversationState(candidate.conversationId, {
        lastAiEvaluationAt: new Date(),
        aiRecommendation: reasoningMessage,
      });
      
      return 'skipped';
    }
    
    // Build template variables before scheduling
    const templateVariables = await buildFollowupTemplateVariables(
      candidate.conversationId,
      candidate.consultantId,
      candidate.agentConfigId,
      candidate.leadName
    );
    
    await db.insert(scheduledFollowupMessages).values({
      conversationId: candidate.conversationId,
      ruleId: timeBasedRule.id,
      templateId: timeBasedRule.templateId,
      scheduledFor,
      status: 'pending',
      templateVariables,
      fallbackMessage: timeBasedRule.fallbackMessage,
      aiDecisionReasoning: `Deterministic time_based rule: "${timeBasedRule.name}"`,
      aiConfidenceScore: 1.0,
      attemptCount: 0,
      maxAttempts: timeBasedRule.maxAttempts,
    });

    await updateConversationState(candidate.conversationId, {
      nextFollowupScheduledAt: scheduledFor,
      lastAiEvaluationAt: new Date(),
      aiRecommendation: `Applied rule "${timeBasedRule.name}" - time_based trigger`,
    });

    console.log(`📅 [FOLLOWUP-SCHEDULER] Scheduled follow-up for ${candidate.conversationId} using rule "${timeBasedRule.name}"`);
    return 'scheduled';
  }

  const aiDecisionRule = applicableRules.find(r => r.triggerType === 'ai_decision');
  
  // NUOVO: Creiamo una regola virtuale AI se non esiste una regola esplicita
  // Il sistema AI "Marco" funziona autonomamente senza regole predefinite
  const effectiveAiRule = aiDecisionRule || {
    id: null as string | null, // null perché ruleId è una foreign key e non esiste una regola esplicita
    name: 'Sistema AI Marco',
    triggerType: 'ai_decision' as const,
    maxAttempts: candidate.maxFollowupsAllowed,
    fallbackMessage: null,
    priority: 100,
  };
  
  if (!aiDecisionRule) {
    console.log(`🤖 [FOLLOWUP-SCHEDULER] Nessuna regola esplicita - Sistema AI "Marco" attivo per ${candidate.conversationId}`);
  } else {
    console.log(`🤖 [FOLLOWUP-SCHEDULER] Using AI decision for rule: "${aiDecisionRule.name}"`);
  }

  console.log(`🧠 [AI-STEP 3] ${candidate.conversationId}: Loading conversation context (messages + templates)`);
  const lastMessages = await getLastMessages(candidate.conversationId, 10);
  const availableTemplates = await getAvailableTemplates(candidate.consultantId, candidate.agentConfigId);
  console.log(`🧠 [AI-STEP 3] ${candidate.conversationId}: Loaded ${lastMessages.length} messages, ${availableTemplates.length} templates available`);

  // FIX: Use the LAST message (most recent) not the first one
  const lastMessage = lastMessages.length > 0 ? lastMessages[lastMessages.length - 1] : null;
  const lastMessageDirection: "inbound" | "outbound" | null = 
    lastMessage 
      ? (lastMessage.role === 'lead' ? 'inbound' : 'outbound')
      : null;

  console.log(`🧠 [AI-STEP 4] ${candidate.conversationId}: Building AI prompt context`);
  const context: FollowupContext = {
    conversationId: candidate.conversationId,
    leadName: candidate.leadName,
    currentState: candidate.currentState,
    daysSilent: candidate.daysSilent,
    hoursSinceLastInbound: candidate.hoursSinceLastInbound,
    followupCount: candidate.followupCount,
    maxFollowupsAllowed: candidate.maxFollowupsAllowed,
    channel: 'whatsapp',
    agentType: candidate.agentType,
    lastMessages,
    lastMessageDirection,
    signals: candidate.signals,
    engagementScore: candidate.engagementScore,
    conversionProbability: candidate.conversionProbability,
    availableTemplates,
    hoursSilent: candidate.hoursSilent,
    minutesSilent: candidate.minutesSilent,
    secondsSilent: candidate.secondsSilent,
    leadNeverResponded: candidate.leadNeverResponded,
  };
  console.log(`🧠 [AI-STEP 4] ${candidate.conversationId}: Context built (state: ${context.currentState}, engagement: ${context.engagementScore}, silent: ${context.hoursSilent.toFixed(1)}h)`);

  console.log(`🧠 [AI-STEP 5] ${candidate.conversationId}: Calling Gemini API for evaluation...`);
  const decision = await evaluateFollowup(context, candidate.consultantId);
  console.log(`🧠 [AI-STEP 5] ${candidate.conversationId}: AI decision received: ${decision.decision} (confidence: ${(decision.confidenceScore * 100).toFixed(0)}%)`);


  console.log(`🧠 [AI-STEP 6] ${candidate.conversationId}: Processing AI response and applying updates`);
  // TASK 8: Apply AI-suggested updates to conversationStates
  // BUG 4 FIX: aiUpdates is already a local const, validated with range checks
  const aiUpdates: Record<string, any> = {};
  const appliedUpdates: string[] = [];

  // BUG 4 FIX: Validate engagementScore is in range 0-100
  if (decision.updatedEngagementScore !== undefined && decision.updatedEngagementScore !== null) {
    const score = Number(decision.updatedEngagementScore);
    if (!isNaN(score) && score >= 0 && score <= 100) {
      aiUpdates.engagementScore = score;
      appliedUpdates.push(`engagementScore: ${candidate.engagementScore} → ${score}`);
    } else {
      console.log(`⚠️ [FOLLOWUP-SCHEDULER] Invalid engagementScore from AI: ${decision.updatedEngagementScore} (must be 0-100) - ignoring`);
    }
  }

  // BUG 4 FIX: Validate conversionProbability is in range 0-1
  if (decision.updatedConversionProbability !== undefined && decision.updatedConversionProbability !== null) {
    const prob = Number(decision.updatedConversionProbability);
    if (!isNaN(prob) && prob >= 0 && prob <= 1) {
      aiUpdates.conversionProbability = prob;
      appliedUpdates.push(`conversionProbability: ${candidate.conversionProbability.toFixed(2)} → ${prob.toFixed(2)}`);
    } else {
      console.log(`⚠️ [FOLLOWUP-SCHEDULER] Invalid conversionProbability from AI: ${decision.updatedConversionProbability} (must be 0-1) - ignoring`);
    }
  }

  // BUG 4 FIX: Validate stateTransition is a valid state
  if (decision.stateTransition && typeof decision.stateTransition === 'string' && decision.stateTransition !== candidate.currentState) {
    const validStates = ['new', 'engaged', 'qualified', 'proposal', 'negotiation', 'closed_won', 'closed_lost', 'stalled', 'ghost'];
    if (validStates.includes(decision.stateTransition)) {
      aiUpdates.currentState = decision.stateTransition;
      aiUpdates.previousState = candidate.currentState;
      appliedUpdates.push(`currentState: ${candidate.currentState} → ${decision.stateTransition}`);
    } else {
      console.log(`⚠️ [FOLLOWUP-SCHEDULER] Invalid stateTransition suggested by AI: "${decision.stateTransition}" - ignoring`);
    }
  }

  if (appliedUpdates.length > 0) {
    console.log(`📝 [AI-UPDATES] Applying ${appliedUpdates.length} AI-suggested update(s) for ${candidate.conversationId}:`);
    for (const update of appliedUpdates) {
      console.log(`   • ${update}`);
    }
    await updateConversationState(candidate.conversationId, aiUpdates);
    console.log(`🧠 [AI-STEP 6] ${candidate.conversationId}: Applied ${appliedUpdates.length} state updates`);
  } else {
    console.log(`🧠 [AI-STEP 6] ${candidate.conversationId}: No state updates needed`);
  }

  // TASK 3b: Check if last outbound was template and block freeform if lead hasn't responded AFTER template
  // BUG 1 FIX: Block freeform ALWAYS until lead responds after template (not just based on hours)
  const lastOutboundWasTemplate = await checkLastOutboundWasTemplate(candidate.conversationId);
  if (lastOutboundWasTemplate) {
    const hasInboundAfterTemplate = await checkHasInboundAfterLastOutbound(candidate.conversationId);
    if (!hasInboundAfterTemplate) {
      decision.allowFreeformMessage = false;
      console.log(`🔒 [FOLLOWUP-SCHEDULER] Freeform blocked: last outbound was template and no inbound response after it`);
    }
  }

  console.log(`🧠 [AI-STEP 7] ${candidate.conversationId}: Saving decision to database`);
  await logFollowupDecision(
    candidate.conversationId,
    context,
    decision,
    'gemini-2.5-flash'
  );
  console.log(`🧠 [AI-STEP 7] ${candidate.conversationId}: Decision logged (${decision.decision})`);

  // SMART WAIT: Set nextEvaluationAt based on AI decision to prevent excessive evaluations
  if (decision.waitHours && decision.waitHours > 0) {
    const nextEvalTime = new Date(Date.now() + decision.waitHours * 60 * 60 * 1000);
    await db.update(conversationStates)
      .set({
        nextEvaluationAt: nextEvalTime,
        waitType: decision.waitType || null,
        waitReason: decision.waitReason || decision.reasoning?.substring(0, 500) || null,
        updatedAt: new Date(),
      })
      .where(eq(conversationStates.conversationId, candidate.conversationId));
    console.log(`⏰ [SMART-WAIT] Set nextEvaluationAt to ${nextEvalTime.toISOString()} (${decision.waitHours}h), type: ${decision.waitType}`);
  }

  if (decision.decision === 'send_now' || decision.decision === 'schedule') {
    const scheduledFor = calculateScheduledTime(decision);
    
    const windowCheck = await validate24hWindowForScheduling(
      candidate.conversationId,
      scheduledFor,
      candidate.agentConfigId
    );
    
    if (!windowCheck.canSchedule) {
      const aiDecisionReasoningMessage = windowCheck.leadNeverResponded
        ? `Il lead non ha ancora risposto - finestra 24h non aperta. Nessun template Twilio approvato assegnato a questo agente. Configura template nella sezione Template WhatsApp.`
        : `Impossibile schedulare: saremo fuori finestra 24h (scade ${windowCheck.window24hExpiresAt.toISOString()}) e nessun template approvato disponibile. Configura template per questo agente.`;
      
      await logFollowupDecision(
        candidate.conversationId,
        context,
        {
          decision: 'skip',
          reasoning: aiDecisionReasoningMessage,
          confidenceScore: 1.0,
          matchedSystemRule: 'no_template_outside_24h'
        },
        'system-validation',
        0, 0
      );
      
      await updateConversationState(candidate.conversationId, {
        lastAiEvaluationAt: new Date(),
        aiRecommendation: aiDecisionReasoningMessage,
      });
      
      return 'skipped';
    }
    
    // Template verrà selezionato dall'AI
    let templateIdToUse: string | null = null;
    let fallbackMessageToUse: string | null = null;
    let messagePreview: string | null = null;
    let aiSelectedTemplateReasoning: string | null = null;
    
    if (decision.allowFreeformMessage && !candidate.leadNeverResponded && !windowCheck.willBeOutside24h) {
      // Freeform solo se il lead ha risposto E siamo dentro la finestra 24h
      console.log(`⚡ [FOLLOWUP-SCHEDULER] Freeform message mode (inside 24h window)`);
      fallbackMessageToUse = await generateFreeformFollowupMessage(context, candidate.consultantId);
      templateIdToUse = null;
    } else if (windowCheck.willBeOutside24h || candidate.leadNeverResponded) {
      // Outside 24h window OR lead never responded - use AI to select best template from approved Twilio templates
      console.log(`🎯 [FOLLOWUP-SCHEDULER] Outside 24h/Lead never responded - using AI to select best template`);
      
      try {
        const allTemplates = await getAllApprovedTemplatesForAgent(candidate.agentConfigId);
        
        if (allTemplates.length === 0) {
          throw new Error("No approved templates available for AI selection");
        }
        
        const aiSelection = await selectBestTemplateWithAI(
          {
            leadName: candidate.leadName || 'Lead',
            currentState: candidate.currentState,
            daysSilent: candidate.daysSilent,
            lastMessages: context.lastMessages
          },
          allTemplates,
          candidate.consultantId
        );
        
        if (aiSelection.selectedTemplateId) {
          templateIdToUse = aiSelection.selectedTemplateId;
          aiSelectedTemplateReasoning = aiSelection.reasoning;
          const selectedTemplate = allTemplates.find(t => t.id === aiSelection.selectedTemplateId);
          messagePreview = selectedTemplate?.bodyText || null;
          console.log(`🤖 [FOLLOWUP-SCHEDULER] AI selected template (outside 24h): ${templateIdToUse}`);
          console.log(`   Reasoning: ${aiSelection.reasoning}`);
          console.log(`   Confidence: ${(aiSelection.confidence * 100).toFixed(0)}%`);
        } else {
          // AI MUST select a template - no fallback to priority
          console.error(`❌ [FOLLOWUP-SCHEDULER] CRITICAL: AI returned no selection`);
          throw new Error('AI template selection returned no result - cannot schedule without AI decision');
        }
        
        fallbackMessageToUse = effectiveAiRule.fallbackMessage || decision.suggestedMessage || null;
        
      } catch (aiError) {
        // NO FALLBACK TO PRIORITY - AI selection is mandatory
        console.error(`❌ [FOLLOWUP-SCHEDULER] AI template selection failed - NOT using priority fallback:`, aiError);
        throw aiError; // Propagate error - do not schedule without AI decision
      }
    } else {
      // Inside 24h window - use AI to select best template from all available approved templates
      console.log(`🎯 [FOLLOWUP-SCHEDULER] Inside 24h window - using AI to select best template`);
      
      try {
        // Get all available approved templates for this agent
        const allTemplates = await getAllApprovedTemplatesForAgent(candidate.agentConfigId);
        
        if (allTemplates.length === 0) {
          // No templates available - this shouldn't happen as validate24hWindow already checked
          throw new Error("No approved templates available for AI selection");
        }
        
        // Use AI to select the best template based on conversation context
        const aiSelection = await selectBestTemplateWithAI(
          {
            leadName: candidate.leadName || 'Lead',
            currentState: candidate.currentState,
            daysSilent: candidate.daysSilent,
            lastMessages: context.lastMessages
          },
          allTemplates,
          candidate.consultantId
        );
        
        if (aiSelection.selectedTemplateId) {
          templateIdToUse = aiSelection.selectedTemplateId;
          aiSelectedTemplateReasoning = aiSelection.reasoning;
          const selectedTemplate = allTemplates.find(t => t.id === aiSelection.selectedTemplateId);
          messagePreview = selectedTemplate?.bodyText || null;
          console.log(`🤖 [FOLLOWUP-SCHEDULER] AI selected template: ${templateIdToUse}`);
          console.log(`   Reasoning: ${aiSelection.reasoning}`);
          console.log(`   Confidence: ${(aiSelection.confidence * 100).toFixed(0)}%`);
        } else {
          throw new Error("AI returned no template selection");
        }
        
        fallbackMessageToUse = effectiveAiRule.fallbackMessage || decision.suggestedMessage || null;
        
      } catch (aiError) {
        // AI selection failed - throw error (no fallback to priority as requested)
        console.error(`❌ [FOLLOWUP-SCHEDULER] AI template selection failed:`, aiError);
        throw aiError;
      }
    }
    
    // Log strutturato per debugging template selection
    console.log(`📋 [TEMPLATE-FINAL] Conversation ${candidate.conversationId}:`);
    console.log(`   leadNeverResponded: ${candidate.leadNeverResponded}`);
    console.log(`   allowFreeformMessage: ${decision.allowFreeformMessage}`);
    console.log(`   templateIdToUse: ${templateIdToUse || 'NULL'}`);
    console.log(`   fallbackMessageToUse: ${fallbackMessageToUse ? 'SET' : 'NULL'}`);
    
    // Validazione finale: se leadNeverResponded e templateId è null, è un errore
    if (candidate.leadNeverResponded && !templateIdToUse) {
      console.error(`❌ [TEMPLATE-FINAL] CRITICAL ERROR: leadNeverResponded=true but templateId is NULL!`);
      throw new Error('Cannot schedule message without approved template when lead has never responded');
    }
    
    // Build template variables before scheduling
    const templateVariables = await buildFollowupTemplateVariables(
      candidate.conversationId,
      candidate.consultantId,
      candidate.agentConfigId,
      candidate.leadName
    );
    
    await db.insert(scheduledFollowupMessages).values({
      conversationId: candidate.conversationId,
      ruleId: effectiveAiRule.id,
      templateId: templateIdToUse,
      scheduledFor,
      status: 'pending',
      templateVariables,
      fallbackMessage: fallbackMessageToUse,
      aiDecisionReasoning: decision.allowFreeformMessage 
        ? `Pending short-window: AI generated freeform message` 
        : decision.reasoning,
      aiConfidenceScore: decision.confidenceScore,
      messagePreview: messagePreview || fallbackMessageToUse,
      aiSelectedTemplateReasoning: aiSelectedTemplateReasoning,
      attemptCount: 0,
      maxAttempts: effectiveAiRule.maxAttempts,
    });

    await updateConversationState(candidate.conversationId, {
      nextFollowupScheduledAt: scheduledFor,
      lastAiEvaluationAt: new Date(),
      aiRecommendation: decision.reasoning,
      ...(decision.updatedEngagementScore && { engagementScore: decision.updatedEngagementScore }),
      ...(decision.updatedConversionProbability && { conversionProbability: decision.updatedConversionProbability }),
    });

    console.log(`📅 [FOLLOWUP-SCHEDULER] Scheduled follow-up for ${candidate.conversationId} at ${scheduledFor.toISOString()} (AI: "${effectiveAiRule.name}")`);
    return 'scheduled';
  }

  if (decision.decision === 'stop') {
    const newState = decision.stateTransition || 
      (candidate.currentState === 'stalled' ? 'ghost' : 'closed_lost');
    
    await updateConversationState(candidate.conversationId, {
      currentState: newState,
      previousState: candidate.currentState,
      lastAiEvaluationAt: new Date(),
      aiRecommendation: decision.reasoning,
    });

    console.log(`🛑 [FOLLOWUP-SCHEDULER] Stopped follow-ups for ${candidate.conversationId}, new state: ${newState}`);
    return 'stopped';
  }

  await updateConversationState(candidate.conversationId, {
    lastAiEvaluationAt: new Date(),
    aiRecommendation: decision.reasoning,
  });

  console.log(`⏭️ [FOLLOWUP-SCHEDULER] Skipped follow-up for ${candidate.conversationId}: ${decision.reasoning}`);
  return 'skipped';
}

/**
 * TASK 3: Helper to check if the last outbound message was a template
 * BUG 2 FIX: Use twilioSid matching instead of sentAt (which can be null)
 * Checks cross-reference with scheduledFollowupMessages to determine if the last 
 * outbound message was sent using a template or freeform.
 */
async function checkLastOutboundWasTemplate(conversationId: string): Promise<boolean> {
  const lastOutbound = await db
    .select({
      id: whatsappMessages.id,
      createdAt: whatsappMessages.createdAt,
      twilioSid: whatsappMessages.twilioSid,
    })
    .from(whatsappMessages)
    .where(
      and(
        eq(whatsappMessages.conversationId, conversationId),
        inArray(whatsappMessages.sender, ['consultant', 'ai', 'system'])
      )
    )
    .orderBy(desc(whatsappMessages.createdAt))
    .limit(1);

  if (lastOutbound.length === 0) {
    return false;
  }

  const outboundMsg = lastOutbound[0];
  
  // BUG 2 FIX: Primary method - use twilioSid to match against scheduledFollowupMessages
  if (outboundMsg.twilioSid) {
    const scheduledByTwilioSid = await db
      .select({ id: scheduledFollowupMessages.id, templateId: scheduledFollowupMessages.templateId })
      .from(scheduledFollowupMessages)
      .where(
        and(
          eq(scheduledFollowupMessages.conversationId, conversationId),
          isNotNull(scheduledFollowupMessages.templateId),
          eq(scheduledFollowupMessages.status, 'sent'),
          eq(scheduledFollowupMessages.twilioMessageSid, outboundMsg.twilioSid)
        )
      )
      .limit(1);

    if (scheduledByTwilioSid.length > 0) {
      console.log(`🔍 [TEMPLATE-CHECK] Last outbound for ${conversationId} was a template (matched by twilioSid)`);
      return true;
    }
  }
  
  // BUG 2 FIX: Fallback method - check for any sent scheduled message with template for this conversation
  // Match by createdAt timestamp within a small window (only if twilioSid didn't match)
  const outboundTime = outboundMsg.createdAt;
  if (outboundTime) {
    const timeWindowStart = new Date(outboundTime.getTime() - 60000);
    const timeWindowEnd = new Date(outboundTime.getTime() + 60000);

    const scheduledWithTemplate = await db
      .select({ id: scheduledFollowupMessages.id, templateId: scheduledFollowupMessages.templateId })
      .from(scheduledFollowupMessages)
      .where(
        and(
          eq(scheduledFollowupMessages.conversationId, conversationId),
          isNotNull(scheduledFollowupMessages.templateId),
          eq(scheduledFollowupMessages.status, 'sent'),
          sql`${scheduledFollowupMessages.scheduledFor} >= ${timeWindowStart}`,
          sql`${scheduledFollowupMessages.scheduledFor} <= ${timeWindowEnd}`
        )
      )
      .limit(1);

    if (scheduledWithTemplate.length > 0) {
      console.log(`🔍 [TEMPLATE-CHECK] Last outbound for ${conversationId} was a template (matched by scheduledFor time window)`);
      return true;
    }
  }

  return false;
}

/**
 * BUG 1 FIX: Check if there's an inbound message AFTER the last outbound message
 * This is used to determine if the lead has responded after we sent a template
 */
async function checkHasInboundAfterLastOutbound(conversationId: string): Promise<boolean> {
  // Find the last outbound message
  const lastOutbound = await db
    .select({
      createdAt: whatsappMessages.createdAt,
    })
    .from(whatsappMessages)
    .where(
      and(
        eq(whatsappMessages.conversationId, conversationId),
        inArray(whatsappMessages.sender, ['consultant', 'ai', 'system'])
      )
    )
    .orderBy(desc(whatsappMessages.createdAt))
    .limit(1);

  if (lastOutbound.length === 0 || !lastOutbound[0].createdAt) {
    // No outbound message found - allow freeform
    return true;
  }

  const lastOutboundTime = lastOutbound[0].createdAt;

  // Check if there's an inbound message after the last outbound
  const inboundAfterOutbound = await db
    .select({ id: whatsappMessages.id })
    .from(whatsappMessages)
    .where(
      and(
        eq(whatsappMessages.conversationId, conversationId),
        eq(whatsappMessages.sender, 'client'),
        sql`${whatsappMessages.createdAt} > ${lastOutboundTime}`
      )
    )
    .limit(1);

  const hasInbound = inboundAfterOutbound.length > 0;
  console.log(`🔍 [INBOUND-CHECK] Conversation ${conversationId}: hasInboundAfterLastOutbound=${hasInbound}`);
  
  return hasInbound;
}

/**
 * TASK 5: Get last messages with messageType classification
 * BUG 2 FIX: Use twilioSid matching instead of sentAt (which can be null)
 * Each message is classified as 'template', 'freeform', or 'inbound'
 */
export async function getLastMessages(
  conversationId: string, 
  limit: number = 10
): Promise<Array<{ role: string; content: string; timestamp: string; messageType: 'template' | 'freeform' | 'inbound' }>> {
  const messages = await db
    .select({
      id: whatsappMessages.id,
      sender: whatsappMessages.sender,
      messageText: whatsappMessages.messageText,
      createdAt: whatsappMessages.createdAt,
      twilioSid: whatsappMessages.twilioSid,
    })
    .from(whatsappMessages)
    .where(eq(whatsappMessages.conversationId, conversationId))
    .orderBy(desc(whatsappMessages.createdAt))
    .limit(limit);

  const result: Array<{ role: string; content: string; timestamp: string; messageType: 'template' | 'freeform' | 'inbound' }> = [];

  for (const m of messages.reverse()) {
    const timestamp = m.createdAt?.toISOString() || new Date().toISOString();
    const role = m.sender === 'client' ? 'lead' : (m.sender === 'consultant' ? 'consultant' : 'ai');

    if (m.sender === 'client') {
      result.push({ role, content: m.messageText, timestamp, messageType: 'inbound' });
    } else {
      let isTemplate = false;

      // BUG 2 FIX: Primary method - use twilioSid to match against scheduledFollowupMessages
      if (m.twilioSid) {
        const scheduledByTwilioSid = await db
          .select({ id: scheduledFollowupMessages.id })
          .from(scheduledFollowupMessages)
          .where(
            and(
              eq(scheduledFollowupMessages.conversationId, conversationId),
              isNotNull(scheduledFollowupMessages.templateId),
              eq(scheduledFollowupMessages.status, 'sent'),
              eq(scheduledFollowupMessages.twilioMessageSid, m.twilioSid)
            )
          )
          .limit(1);

        isTemplate = scheduledByTwilioSid.length > 0;
      }
      
      // BUG 2 FIX: Fallback method - match by scheduledFor time window (not sentAt)
      if (!isTemplate && m.createdAt) {
        const timeWindowStart = new Date(m.createdAt.getTime() - 60000);
        const timeWindowEnd = new Date(m.createdAt.getTime() + 60000);

        const scheduledWithTemplate = await db
          .select({ id: scheduledFollowupMessages.id })
          .from(scheduledFollowupMessages)
          .where(
            and(
              eq(scheduledFollowupMessages.conversationId, conversationId),
              isNotNull(scheduledFollowupMessages.templateId),
              eq(scheduledFollowupMessages.status, 'sent'),
              sql`${scheduledFollowupMessages.scheduledFor} >= ${timeWindowStart}`,
              sql`${scheduledFollowupMessages.scheduledFor} <= ${timeWindowEnd}`
            )
          )
          .limit(1);

        isTemplate = scheduledWithTemplate.length > 0;
      }

      result.push({ 
        role, 
        content: m.messageText, 
        timestamp, 
        messageType: isTemplate ? 'template' : 'freeform' 
      });
    }
  }

  return result;
}

/**
 * Gets all approved templates for an agent with full details for AI selection.
 * Returns templates with name, goal, tone, and body text for context-aware selection.
 * 
 * UPDATED: Now fetches real body text from Twilio API for HX templates,
 * so the AI can make content-based decisions instead of priority-based.
 */
async function getAllApprovedTemplatesForAgent(
  agentConfigId: string | null
): Promise<TemplateForSelection[]> {
  if (!agentConfigId) {
    console.log(`⚠️ [TEMPLATE-AI] No agentConfigId provided`);
    return [];
  }
  
  console.log(`📋 [TEMPLATE-AI] Fetching all approved templates for agent: ${agentConfigId}`);
  
  const templates: TemplateForSelection[] = [];
  
  // Get agent's Twilio credentials for fetching template bodies
  const [agentConfig] = await db
    .select({
      twilioAccountSid: consultantWhatsappConfig.twilioAccountSid,
      twilioAuthToken: consultantWhatsappConfig.twilioAuthToken,
    })
    .from(consultantWhatsappConfig)
    .where(eq(consultantWhatsappConfig.id, agentConfigId))
    .limit(1);
  
  // STEP 1: Get Twilio templates (HX prefix) assigned to this agent
  const twilioTemplates = await db
    .select({ 
      templateId: whatsappTemplateAssignments.templateId,
      priority: whatsappTemplateAssignments.priority,
      templateType: whatsappTemplateAssignments.templateType
    })
    .from(whatsappTemplateAssignments)
    .where(eq(whatsappTemplateAssignments.agentConfigId, agentConfigId))
    .orderBy(desc(whatsappTemplateAssignments.priority));
  
  // Filter for Twilio templates (HX prefix)
  const approvedTwilioTemplates = twilioTemplates.filter(t => 
    t.templateId.startsWith('HX') && t.templateType === 'twilio'
  );
  
  // Fetch real body text from Twilio API for all HX templates
  let twilioTemplateBodies = new Map<string, string>();
  if (approvedTwilioTemplates.length > 0 && agentConfig?.twilioAccountSid && agentConfig?.twilioAuthToken) {
    console.log(`📥 [TEMPLATE-AI] Fetching body text from Twilio for ${approvedTwilioTemplates.length} HX templates...`);
    twilioTemplateBodies = await fetchMultipleTwilioTemplateBodies(
      agentConfig.twilioAccountSid,
      agentConfig.twilioAuthToken,
      approvedTwilioTemplates.map(t => t.templateId)
    );
    console.log(`✅ [TEMPLATE-AI] Successfully fetched ${twilioTemplateBodies.size}/${approvedTwilioTemplates.length} template bodies from Twilio`);
  }
  
  for (const t of approvedTwilioTemplates) {
    const realBodyText = twilioTemplateBodies.get(t.templateId);
    // Only include templates where we successfully fetched the body text
    // Skip templates without body to prevent AI from seeing priority-based placeholders
    if (realBodyText) {
      templates.push({
        id: t.templateId,
        name: `Template Twilio ${t.templateId.substring(2, 10)}`,
        goal: 'Follow-up WhatsApp',
        tone: 'Professionale',
        bodyText: realBodyText,
        priority: t.priority
      });
    } else {
      console.warn(`⚠️ [TEMPLATE-AI] Skipping template ${t.templateId} - could not fetch body text from Twilio`);
    }
  }
  
  // STEP 2: Get custom templates with full details
  // NOTE: Using correct field names from schema:
  // - whatsappCustomTemplates.templateName (not .name)
  // - whatsappCustomTemplates.body (not .bodyText)
  // - whatsappTemplateVersions.bodyText for versioned content
  const customTemplates = await db
    .select({
      templateId: whatsappCustomTemplates.id,
      templateName: whatsappCustomTemplates.templateName,
      description: whatsappCustomTemplates.description,
      templateBody: whatsappCustomTemplates.body,
      versionBodyText: whatsappTemplateVersions.bodyText,
      useCase: whatsappCustomTemplates.useCase,
      priority: whatsappTemplateAssignments.priority,
      twilioStatus: whatsappTemplateVersions.twilioStatus,
      twilioContentSid: whatsappTemplateVersions.twilioContentSid
    })
    .from(whatsappCustomTemplates)
    .innerJoin(
      whatsappTemplateAssignments,
      eq(whatsappCustomTemplates.id, whatsappTemplateAssignments.templateId)
    )
    .leftJoin(
      whatsappTemplateVersions,
      and(
        eq(whatsappTemplateVersions.templateId, whatsappCustomTemplates.id),
        eq(whatsappTemplateVersions.isActive, true)
      )
    )
    .where(
      and(
        eq(whatsappTemplateAssignments.agentConfigId, agentConfigId),
        eq(whatsappTemplateVersions.twilioStatus, 'approved')
      )
    )
    .orderBy(desc(whatsappTemplateAssignments.priority));
  
  for (const t of customTemplates) {
    const templateIdToUse = t.twilioContentSid || t.templateId;
    // Use versioned body text if available, otherwise fall back to template body
    const bodyText = t.versionBodyText || t.templateBody || '';
    templates.push({
      id: templateIdToUse,
      name: t.templateName || 'Template personalizzato',
      goal: t.useCase || t.description || 'Follow-up',
      tone: 'Personalizzato',
      bodyText: bodyText,
      priority: t.priority || 0
    });
  }
  
  console.log(`📋 [TEMPLATE-AI] Found ${templates.length} templates for AI selection`);
  
  return templates;
}

async function generateFreeformFollowupMessage(
  context: FollowupContext, 
  consultantId: string
): Promise<string> {
  console.log(`🤖 [FOLLOWUP-SCHEDULER] Generating freeform follow-up message for ${context.conversationId}`);
  
  const messagesHistory = context.lastMessages
    .map(m => `[${m.role}]: ${m.content}`)
    .join('\n');
  
  const prompt = `Sei un consulente esperto italiano. Devi generare un messaggio di follow-up WhatsApp per continuare questa conversazione.

CONTESTO:
- Nome Lead: ${context.leadName || "Cliente"}
- Stato: ${context.currentState}
- Giorni silenzio: ${context.daysSilent}

CRONOLOGIA MESSAGGI (più recenti alla fine):
${messagesHistory}

ISTRUZIONI:
1. L'ultimo messaggio è stato inviato da noi e stiamo aspettando una risposta
2. Genera un messaggio breve, cordiale e professionale
3. Non essere invadente, ma mantieni l'interesse vivo
4. Il messaggio deve sembrare naturale, non un template
5. Adatta il tono in base al contesto della conversazione
6. NON usare formule tipo "Gentile Cliente" - usa il nome se disponibile
7. Massimo 2-3 frasi

RISPONDI CON SOLO IL TESTO DEL MESSAGGIO (niente JSON, niente formattazione, solo il testo pronto per essere inviato).`;

  try {
    const aiProviderResult = await getAIProvider(consultantId, consultantId);
    console.log(`🚀 [FOLLOWUP-SCHEDULER] Using ${aiProviderResult.metadata.name} for freeform message generation`);
    
    const response = await aiProviderResult.client.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
    });
    
    const messageText = response.response.text();
    
    if (!messageText || typeof messageText !== 'string') {
      console.warn(`⚠️ [FOLLOWUP-SCHEDULER] Invalid AI response for freeform message`);
      return `Ciao${context.leadName ? ` ${context.leadName}` : ''}, volevo solo assicurarmi che avessi ricevuto il mio ultimo messaggio. Fammi sapere se hai domande!`;
    }
    
    console.log(`✅ [FOLLOWUP-SCHEDULER] Generated freeform message: "${messageText.substring(0, 50)}..."`);
    return messageText.trim();
  } catch (error) {
    console.error(`❌ [FOLLOWUP-SCHEDULER] Error generating freeform message:`, error);
    return `Ciao${context.leadName ? ` ${context.leadName}` : ''}, volevo solo assicurarmi che avessi ricevuto il mio ultimo messaggio. Fammi sapere se hai domande!`;
  }
}

export async function getAvailableTemplates(
  consultantId: string,
  agentConfigId: string | null
): Promise<Array<{ id: string; name: string; useCase: string; bodyText: string; twilioStatus: string }>> {
  
  if (agentConfigId) {
    // First, get all assignments for this agent
    const allAssignments = await db
      .select({
        templateId: whatsappTemplateAssignments.templateId,
        templateType: whatsappTemplateAssignments.templateType,
        priority: whatsappTemplateAssignments.priority,
      })
      .from(whatsappTemplateAssignments)
      .where(eq(whatsappTemplateAssignments.agentConfigId, agentConfigId))
      .orderBy(desc(whatsappTemplateAssignments.priority));

    const results: Array<{ id: string; name: string; useCase: string; bodyText: string; twilioStatus: string }> = [];
    
    for (const assignment of allAssignments) {
      const isTwilioTemplate = assignment.templateId.startsWith('HX');
      
      if (isTwilioTemplate) {
        // For Twilio templates, add with the SID as ID
        // The AI will use this SID to send the template via Twilio
        results.push({
          id: assignment.templateId,
          name: assignment.templateId, // Use SID as name for now
          useCase: assignment.templateType || 'twilio',
          bodyText: '', // Body will be fetched from Twilio when sending
          twilioStatus: 'approved', // If assigned, assume approved
        });
      } else {
        // For custom templates, get details from the custom templates table
        const customTemplate = await db
          .select({
            id: whatsappCustomTemplates.id,
            name: whatsappCustomTemplates.templateName,
            useCase: whatsappCustomTemplates.useCase,
            bodyText: whatsappCustomTemplates.body,
            twilioStatus: whatsappTemplateVersions.twilioStatus,
          })
          .from(whatsappCustomTemplates)
          .leftJoin(
            whatsappTemplateVersions,
            and(
              eq(whatsappTemplateVersions.templateId, whatsappCustomTemplates.id),
              eq(whatsappTemplateVersions.isActive, true)
            )
          )
          .where(
            and(
              eq(whatsappCustomTemplates.id, assignment.templateId),
              eq(whatsappCustomTemplates.isActive, true)
            )
          )
          .limit(1);
        
        if (customTemplate.length > 0) {
          const t = customTemplate[0];
          results.push({
            id: t.id,
            name: t.name,
            useCase: t.useCase || 'generale',
            bodyText: t.bodyText || '',
            twilioStatus: t.twilioStatus || 'not_synced',
          });
        }
      }
    }
    
    return results;
  }

  // Fallback: get all active custom templates for consultant
  const templates = await db
    .select({
      id: whatsappCustomTemplates.id,
      name: whatsappCustomTemplates.templateName,
      useCase: whatsappCustomTemplates.useCase,
      bodyText: whatsappCustomTemplates.body,
      twilioStatus: whatsappTemplateVersions.twilioStatus,
    })
    .from(whatsappCustomTemplates)
    .leftJoin(
      whatsappTemplateVersions,
      and(
        eq(whatsappTemplateVersions.templateId, whatsappCustomTemplates.id),
        eq(whatsappTemplateVersions.isActive, true)
      )
    )
    .where(
      and(
        eq(whatsappCustomTemplates.consultantId, consultantId),
        eq(whatsappCustomTemplates.isActive, true)
      )
    );

  return templates.map(t => ({
    id: t.id,
    name: t.name,
    useCase: t.useCase || 'generale',
    bodyText: t.bodyText || '',
    twilioStatus: t.twilioStatus || 'not_synced',
  }));
}

function calculateScheduledTime(decision: FollowupDecision): Date {
  const now = new Date();
  
  const hour = decision.scheduledHour !== undefined ? decision.scheduledHour : 10;
  const minute = decision.scheduledMinute !== undefined ? decision.scheduledMinute : 0;
  
  const validHour = Math.max(9, Math.min(18, hour));
  const validMinute = Math.max(0, Math.min(59, minute));
  
  switch (decision.urgency) {
    case 'now':
      return now;
    case 'tomorrow':
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(validHour, validMinute, 0, 0);
      return tomorrow;
    case 'next_week':
      const nextWeek = new Date(now);
      nextWeek.setDate(nextWeek.getDate() + 7);
      nextWeek.setHours(validHour, validMinute, 0, 0);
      return nextWeek;
    default:
      return now;
  }
}

async function validate24hWindowForScheduling(
  conversationId: string,
  scheduledFor: Date,
  agentConfigId: string | null
): Promise<{ canSchedule: boolean; window24hExpiresAt: Date; willBeOutside24h: boolean; leadNeverResponded: boolean; selectedTemplateId?: string }> {
  const lastLeadMessage = await db
    .select({ createdAt: whatsappMessages.createdAt })
    .from(whatsappMessages)
    .where(
      and(
        eq(whatsappMessages.conversationId, conversationId),
        eq(whatsappMessages.sender, 'client')
      )
    )
    .orderBy(desc(whatsappMessages.createdAt))
    .limit(1);

  const leadNeverResponded = lastLeadMessage.length === 0;
  const window24hExpiresAt = lastLeadMessage.length > 0 && lastLeadMessage[0].createdAt
    ? new Date(new Date(lastLeadMessage[0].createdAt).getTime() + 24 * 60 * 60 * 1000)
    : new Date(0);

  const willBeOutside24h = scheduledFor > window24hExpiresAt;

  if (!willBeOutside24h) {
    return { canSchedule: true, window24hExpiresAt, willBeOutside24h, leadNeverResponded };
  }

  if (leadNeverResponded) {
    console.log(`⚠️ [FOLLOWUP-SCHEDULER] Lead mai risposto - finestra 24h non ancora aperta, richiesto template approvato`);
  } else {
    console.log(`⚠️ [FOLLOWUP-SCHEDULER] Messaggio schedulato per ${scheduledFor.toISOString()} sarà FUORI finestra 24h (scade ${window24hExpiresAt.toISOString()})`);
  }

  if (!agentConfigId) {
    console.log(`❌ [FOLLOWUP-SCHEDULER] Nessun agentConfigId - impossibile verificare template approvati`);
    return { canSchedule: false, window24hExpiresAt, willBeOutside24h, leadNeverResponded };
  }

  // Verifica solo che esistano template approvati (la selezione viene fatta dall'AI dopo)
  // STEP 1: Check for Twilio templates (HX prefix) assigned to this agent
  const twilioTemplates = await db
    .select({ 
      templateId: whatsappTemplateAssignments.templateId,
      templateType: whatsappTemplateAssignments.templateType
    })
    .from(whatsappTemplateAssignments)
    .where(eq(whatsappTemplateAssignments.agentConfigId, agentConfigId));

  const approvedTwilioTemplates = twilioTemplates.filter(t => 
    t.templateId.startsWith('HX') && t.templateType === 'twilio'
  );
  
  if (approvedTwilioTemplates.length > 0) {
    console.log(`✅ [FOLLOWUP-SCHEDULER] Trovati ${approvedTwilioTemplates.length} template Twilio approvati - AI selezionerà il migliore`);
    return { canSchedule: true, window24hExpiresAt, willBeOutside24h, leadNeverResponded };
  }

  // STEP 2: Check for custom templates with approved status
  const approvedCustomTemplate = await db
    .select({ 
      id: whatsappTemplateVersions.id
    })
    .from(whatsappTemplateVersions)
    .innerJoin(
      whatsappTemplateAssignments,
      eq(whatsappTemplateVersions.templateId, whatsappTemplateAssignments.templateId)
    )
    .where(
      and(
        eq(whatsappTemplateAssignments.agentConfigId, agentConfigId),
        eq(whatsappTemplateVersions.isActive, true),
        eq(whatsappTemplateVersions.twilioStatus, 'approved')
      )
    )
    .limit(1);

  if (approvedCustomTemplate.length > 0) {
    console.log(`✅ [FOLLOWUP-SCHEDULER] Trovati template custom approvati - AI selezionerà il migliore`);
    return { canSchedule: true, window24hExpiresAt, willBeOutside24h, leadNeverResponded };
  }

  console.log(`❌ [FOLLOWUP-SCHEDULER] NESSUN template approvato disponibile (né Twilio né custom) per fuori 24h - NON schedulo`);
  return { canSchedule: false, window24hExpiresAt, willBeOutside24h, leadNeverResponded };
}

async function generateAIFollowupMessage(
  conversationId: string,
  consultantId: string,
  agentConfigId: string | null,
  reasoning?: string
): Promise<string | null> {
  console.log(`🤖 [FOLLOWUP-AI] Generating intelligent follow-up message for conversation ${conversationId}`);
  
  // Get agent configuration for context
  let agentContext = {
    agentName: 'Assistente',
    instructions: '',
    personality: '',
    whoWeHelp: '',
    whatWeDo: '',
    usp: '',
  };
  
  if (agentConfigId) {
    const agentConfig = await db
      .select({
        agentName: consultantWhatsappConfig.agentName,
        instructions: consultantWhatsappConfig.instructions,
        personality: consultantWhatsappConfig.personality,
        whoWeHelp: consultantWhatsappConfig.whoWeHelp,
        whatWeDo: consultantWhatsappConfig.whatWeDo,
        usp: consultantWhatsappConfig.usp,
      })
      .from(consultantWhatsappConfig)
      .where(eq(consultantWhatsappConfig.id, agentConfigId))
      .limit(1);
    
    if (agentConfig.length > 0) {
      agentContext = {
        agentName: agentConfig[0].agentName || 'Assistente',
        instructions: agentConfig[0].instructions || '',
        personality: agentConfig[0].personality || '',
        whoWeHelp: agentConfig[0].whoWeHelp || '',
        whatWeDo: agentConfig[0].whatWeDo || '',
        usp: agentConfig[0].usp || '',
      };
    }
  }
  
  // Get recent chat history
  const chatHistory = await db
    .select({
      content: whatsappMessages.content,
      sender: whatsappMessages.sender,
      createdAt: whatsappMessages.createdAt,
    })
    .from(whatsappMessages)
    .where(eq(whatsappMessages.conversationId, conversationId))
    .orderBy(desc(whatsappMessages.createdAt))
    .limit(15);
  
  if (chatHistory.length === 0) {
    console.log(`⚠️ [FOLLOWUP-AI] No chat history found`);
    return null;
  }
  
  // Reverse to get chronological order
  const orderedHistory = chatHistory.reverse();
  
  // Format chat history
  const formattedChat = orderedHistory.map(msg => {
    const role = msg.sender === 'client' ? 'LEAD' : 'AGENTE';
    return `[${role}]: ${msg.content}`;
  }).join('\n');
  
  // Get AI provider
  const aiProvider = await getAIProvider(consultantId, 'consultant');
  
  if (!aiProvider) {
    console.log(`⚠️ [FOLLOWUP-AI] No AI provider available`);
    return null;
  }
  
  const systemPrompt = `Sei ${agentContext.agentName}, un assistente AI professionale per follow-up WhatsApp.

CONTESTO AGENTE:
${agentContext.personality ? `- Personalità: ${agentContext.personality}` : ''}
${agentContext.whoWeHelp ? `- Chi aiutiamo: ${agentContext.whoWeHelp}` : ''}
${agentContext.whatWeDo ? `- Cosa facciamo: ${agentContext.whatWeDo}` : ''}
${agentContext.usp ? `- Valore unico: ${agentContext.usp}` : ''}
${agentContext.instructions ? `\nISTRUZIONI SPECIFICHE:\n${agentContext.instructions}` : ''}

IL TUO COMPITO:
Scrivi un messaggio di follow-up breve e naturale per ricontattare il lead che non ha risposto.
Devi:
1. Leggere la cronologia della chat per capire il contesto
2. Scrivere un messaggio BREVE (max 2-3 frasi) che:
   - Sia naturale e colloquiale
   - Faccia riferimento alla conversazione precedente se pertinente
   - Spinga gentilmente verso una risposta o azione
   - NON sia invadente o aggressivo
   - NON contenga emoji a meno che l'agente li usi normalmente

IMPORTANTE:
- Rispondi SOLO con il testo del messaggio da inviare
- NESSUN prefisso, nessuna spiegazione, solo il messaggio`;

  const userPrompt = `CRONOLOGIA CHAT:
${formattedChat}

${reasoning ? `CONTESTO DECISIONE: ${reasoning}` : ''}

Genera il messaggio di follow-up:`;

  try {
    const result = await aiProvider.client.generateContent({
      model: 'gemini-2.5-flash',
      systemInstruction: systemPrompt,
      contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 200,
      },
    });
    
    const responseText = result.response?.text?.() || 
      result.response?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    
    const cleanedMessage = responseText
      .trim()
      .replace(/^["']|["']$/g, '')
      .replace(/^(Messaggio:|Risposta:|Follow-up:)\s*/i, '');
    
    if (cleanedMessage && cleanedMessage.length > 10 && cleanedMessage.length < 500) {
      console.log(`✅ [FOLLOWUP-AI] Generated message: "${cleanedMessage.substring(0, 50)}..."`);
      return cleanedMessage;
    }
    
    console.log(`⚠️ [FOLLOWUP-AI] Generated message invalid or too short/long`);
    return null;
  } catch (error) {
    console.error(`❌ [FOLLOWUP-AI] Error generating message:`, error);
    return null;
  }
}

async function checkIfShouldStillSend(conversationId: string): Promise<boolean> {
  const recentMessages = await db
    .select({
      sender: whatsappMessages.sender,
      createdAt: whatsappMessages.createdAt,
    })
    .from(whatsappMessages)
    .where(eq(whatsappMessages.conversationId, conversationId))
    .orderBy(desc(whatsappMessages.createdAt))
    .limit(1);

  if (recentMessages.length === 0) {
    return true;
  }

  const lastMessage = recentMessages[0];
  
  if (lastMessage.sender === 'client') {
    const hoursSinceMessage = lastMessage.createdAt 
      ? (Date.now() - new Date(lastMessage.createdAt).getTime()) / (1000 * 60 * 60)
      : 0;
    
    if (hoursSinceMessage < 24) {
      return false;
    }
  }

  return true;
}

async function sendFollowupMessage(
  message: typeof scheduledFollowupMessages.$inferSelect
): Promise<void> {
  console.log(`📤 [FOLLOWUP-SCHEDULER] Sending follow-up message ${message.id}`);
  
  const conversation = await db
    .select({
      phoneNumber: whatsappConversations.phoneNumber,
      consultantId: whatsappConversations.consultantId,
      agentConfigId: whatsappConversations.agentConfigId,
      lastMessageAt: whatsappConversations.lastMessageAt,
    })
    .from(whatsappConversations)
    .where(eq(whatsappConversations.id, message.conversationId))
    .limit(1);

  if (conversation.length === 0) {
    throw new Error(`Conversation ${message.conversationId} not found`);
  }

  const { phoneNumber, consultantId, agentConfigId, lastMessageAt } = conversation[0];

  // WhatsApp 24h Rule: Check if last lead message was within 24 hours
  const lastLeadMessage = await db
    .select({ createdAt: whatsappMessages.createdAt })
    .from(whatsappMessages)
    .where(
      and(
        eq(whatsappMessages.conversationId, message.conversationId),
        eq(whatsappMessages.sender, 'client')
      )
    )
    .orderBy(desc(whatsappMessages.createdAt))
    .limit(1);

  const hoursSinceLastLeadMessage = lastLeadMessage.length > 0 && lastLeadMessage[0].createdAt
    ? (Date.now() - new Date(lastLeadMessage[0].createdAt).getTime()) / (1000 * 60 * 60)
    : 999; // Assume > 24h if no messages

  const isWithin24Hours = hoursSinceLastLeadMessage < 24;
  console.log(`⏰ [FOLLOWUP-SCHEDULER] Hours since last lead message: ${hoursSinceLastLeadMessage.toFixed(1)}, within 24h: ${isWithin24Hours}`);

  let messageText = '';
  let useTemplate = false;
  let twilioContentSid: string | null = null;

  // If > 24h, MUST use approved Twilio template
  if (!isWithin24Hours) {
    console.log(`📋 [FOLLOWUP-SCHEDULER] Outside 24h window - MUST use approved template`);
    
    if (message.templateId) {
      // Check if templateId is already a Twilio Content SID (starts with HX)
      if (message.templateId.startsWith('HX')) {
        // This is a Twilio-imported template - use it directly
        twilioContentSid = message.templateId;
        useTemplate = true;
        
        // Fetch the template body from Twilio for logging/variable replacement
        try {
          const user = await db
            .select({
              twilioAccountSid: users.twilioAccountSid,
              twilioAuthToken: users.twilioAuthToken,
              encryptionSalt: users.encryptionSalt,
            })
            .from(users)
            .where(eq(users.id, consultantId))
            .limit(1);
          
          if (user.length > 0 && user[0].twilioAccountSid && user[0].twilioAuthToken && user[0].encryptionSalt) {
            const decryptedAuthToken = decryptForConsultant(user[0].twilioAuthToken, user[0].encryptionSalt);
            const templateBody = await fetchTwilioTemplateBody(
              user[0].twilioAccountSid,
              decryptedAuthToken,
              message.templateId
            );
            if (templateBody) {
              messageText = templateBody;
              console.log(`✅ [FOLLOWUP-SCHEDULER] Using Twilio HX template directly: ${twilioContentSid}`);
            }
          }
        } catch (fetchError) {
          console.warn(`⚠️ [FOLLOWUP-SCHEDULER] Could not fetch HX template body, will send without preview: ${fetchError}`);
        }
        
        // Even if we couldn't fetch the body, we can still send using the ContentSid
        if (!messageText) {
          messageText = '[Template Twilio]'; // Placeholder - Twilio will use the actual template
          console.log(`✅ [FOLLOWUP-SCHEDULER] Using Twilio HX template (ContentSid only): ${twilioContentSid}`);
        }
      } else {
        // Check if template has approved version in local database
        const templateVersion = await db
          .select({
            bodyText: whatsappTemplateVersions.bodyText,
            twilioStatus: whatsappTemplateVersions.twilioStatus,
            twilioContentSid: whatsappTemplateVersions.twilioContentSid,
          })
          .from(whatsappTemplateVersions)
          .where(
            and(
              eq(whatsappTemplateVersions.templateId, message.templateId),
              eq(whatsappTemplateVersions.isActive, true)
            )
          )
          .limit(1);

        if (templateVersion.length > 0 && templateVersion[0].twilioStatus === 'approved') {
          messageText = templateVersion[0].bodyText;
          twilioContentSid = templateVersion[0].twilioContentSid;
          useTemplate = true;
          console.log(`✅ [FOLLOWUP-SCHEDULER] Using approved template with ContentSid: ${twilioContentSid}`);
        } else {
          // Try fallback to template body
          const template = await db
            .select({ body: whatsappCustomTemplates.body })
            .from(whatsappCustomTemplates)
            .where(eq(whatsappCustomTemplates.id, message.templateId))
            .limit(1);

          if (template.length > 0 && template[0].body) {
            messageText = template[0].body;
          }
        }
      }
    }

    // If no approved template available, find one from agent's assigned templates
    if (!messageText && agentConfigId) {
      const approvedTemplate = await db
        .select({
          bodyText: whatsappTemplateVersions.bodyText,
          twilioContentSid: whatsappTemplateVersions.twilioContentSid,
        })
        .from(whatsappTemplateAssignments)
        .innerJoin(
          whatsappTemplateVersions,
          and(
            eq(whatsappTemplateVersions.templateId, whatsappTemplateAssignments.templateId),
            eq(whatsappTemplateVersions.isActive, true),
            eq(whatsappTemplateVersions.twilioStatus, 'approved')
          )
        )
        .where(eq(whatsappTemplateAssignments.agentConfigId, agentConfigId))
        .orderBy(desc(whatsappTemplateAssignments.priority))
        .limit(1);

      if (approvedTemplate.length > 0) {
        messageText = approvedTemplate[0].bodyText;
        twilioContentSid = approvedTemplate[0].twilioContentSid;
        useTemplate = true;
        console.log(`✅ [FOLLOWUP-SCHEDULER] Found approved template from agent assignments`);
      }
    }

    if (!messageText) {
      throw new Error('No approved template available for follow-up outside 24h window');
    }
  } else {
    // Within 24h - use AI-generated intelligent message based on chat context
    console.log(`💬 [FOLLOWUP-SCHEDULER] Within 24h window - generating AI message from chat context`);
    
    // Try to generate AI message by reading the chat
    try {
      const aiMessage = await generateAIFollowupMessage(
        message.conversationId,
        consultantId,
        agentConfigId,
        message.aiDecisionReasoning || undefined
      );
      
      if (aiMessage) {
        messageText = aiMessage;
        console.log(`🤖 [FOLLOWUP-SCHEDULER] AI generated follow-up: "${messageText.substring(0, 80)}..."`);
      }
    } catch (aiError) {
      console.error(`⚠️ [FOLLOWUP-SCHEDULER] AI message generation failed:`, aiError);
    }
    
    // Fall back to template if AI failed
    if (!messageText && message.templateId) {
      const template = await db
        .select({ body: whatsappCustomTemplates.body })
        .from(whatsappCustomTemplates)
        .where(eq(whatsappCustomTemplates.id, message.templateId))
        .limit(1);
      
      if (template.length > 0 && template[0].body) {
        messageText = template[0].body;
        console.log(`📋 [FOLLOWUP-SCHEDULER] Using template as fallback`);
      }
    }

    // Final fallback to static message
    if (!messageText) {
      messageText = message.fallbackMessage || '';
      console.log(`📝 [FOLLOWUP-SCHEDULER] Using fallback message`);
    }
  }

  // Apply template variables
  if (messageText) {
    const variables = message.templateVariables as Record<string, string> || {};
    for (const [key, value] of Object.entries(variables)) {
      messageText = messageText.replace(`{{${key}}}`, value);
    }
  }

  if (!messageText) {
    throw new Error('No message text available');
  }

  // Send message via Twilio
  console.log(`📱 [FOLLOWUP-SCHEDULER] Sending follow-up to ${phoneNumber}: "${messageText.substring(0, 50)}..."`);
  
  // Prepare content variables for Twilio template (as object, not string - twilio-client will stringify)
  const templateVars = message.templateVariables as Record<string, string> || {};
  const contentVariablesObj = Object.keys(templateVars).length > 0 
    ? templateVars
    : undefined;
  
  if (contentVariablesObj) {
    console.log(`📋 [FOLLOWUP-SCHEDULER] Passing contentVariables to Twilio: ${JSON.stringify(contentVariablesObj)}`);
  }

  console.log(`🔍 [DEBUG] Step 1: About to check DRY RUN mode for consultant ${consultantId}`);
  
  // Check if this is DRY RUN mode (field is isDryRun in schema, not dryRunMode)
  const config = await db
    .select({ isDryRun: consultantWhatsappConfig.isDryRun })
    .from(consultantWhatsappConfig)
    .where(eq(consultantWhatsappConfig.consultantId, consultantId))
    .limit(1);
  
  console.log(`🔍 [DEBUG] Step 2: Config query result: ${JSON.stringify(config)}`);
  
  const isDryRun = config.length > 0 && config[0].isDryRun === true;
  
  console.log(`🔍 [DEBUG] Step 3: isDryRun = ${isDryRun}, twilioContentSid = ${twilioContentSid}`);
  console.log(`🔍 [DEBUG] Step 4: messageText length = ${messageText?.length}, templateVars = ${JSON.stringify(templateVars)}`);
  console.log(`🔍 [DEBUG] Step 5: message.conversationId = ${message.conversationId}`);
  
  // ═══════════════════════════════════════════════════════════════════════════
  // FIX: Save message to whatsappMessages BEFORE sending (like proactive-outreach)
  // This ensures the message appears in the chat interface
  // ═══════════════════════════════════════════════════════════════════════════
  
  // Build the message text for display (with DRY RUN prefix if applicable)
  const displayMessageText = isDryRun 
    ? `🧪 DRY RUN - Anteprima Follow-up\n\n${messageText}\n\n───────────────────\nTemplate ID: ${twilioContentSid || 'N/A'}`
    : messageText;
  
  console.log(`💾 [FOLLOWUP-SCHEDULER] Saving message to whatsappMessages BEFORE sending...`);
  
  const [savedMessage] = await db
    .insert(whatsappMessages)
    .values({
      conversationId: message.conversationId,
      messageText: displayMessageText,
      direction: 'outbound',
      sender: 'ai',
      mediaType: 'text',
      twilioStatus: isDryRun ? 'sent' : 'queued',
      twilioSid: isDryRun ? `DRY_RUN_FOLLOWUP_${Date.now()}_${Math.random().toString(36).substring(2, 6)}` : undefined,
      sentAt: isDryRun ? new Date() : undefined,
      metadata: {
        isDryRun: isDryRun,
        dryRun: isDryRun,
        messageType: 'followup',
        templateSid: twilioContentSid,
        templateMode: !!twilioContentSid,
        templateVariables: templateVars,
        templateBody: messageText,
        scheduledMessageId: message.id,
      },
    })
    .returning();
  
  console.log(`✅ [FOLLOWUP-SCHEDULER] Message saved to whatsappMessages with ID: ${savedMessage.id}`);
  
  // Update conversation with last message info
  await db
    .update(whatsappConversations)
    .set({
      lastMessageAt: new Date(),
      lastMessageFrom: 'ai',
      messageCount: sql`message_count + 1`,
      updatedAt: new Date(),
    })
    .where(eq(whatsappConversations.id, message.conversationId));
  
  // Now send via Twilio (passing the savedMessageId for status updates)
  await sendWhatsAppMessage(
    consultantId,
    phoneNumber,
    messageText,
    savedMessage.id, // Pass the saved message ID for Twilio status callback updates
    {
      agentConfigId: agentConfigId || undefined,
      conversationId: message.conversationId,
      contentSid: twilioContentSid || undefined,
      contentVariables: contentVariablesObj,
    }
  );
  
  console.log(`✅ [FOLLOWUP-SCHEDULER] Message sent successfully to ${phoneNumber} (saved as ${savedMessage.id})`);

  // ═══════════════════════════════════════════════════════════════════════════
  // UPDATE: Increment consecutiveNoReplyCount when sending follow-up
  // This will be reset to 0 when lead replies (in webhook-handler)
  // ═══════════════════════════════════════════════════════════════════════════
  
  // FIX PROBLEMA 2: Usa cooldownHours dalla regola invece di un valore fisso di 24h
  let cooldownHours = 24; // Default fallback
  
  if (message.ruleId) {
    const rule = await db
      .select({ cooldownHours: followupRules.cooldownHours })
      .from(followupRules)
      .where(eq(followupRules.id, message.ruleId))
      .limit(1);
    
    if (rule.length > 0 && rule[0].cooldownHours) {
      cooldownHours = rule[0].cooldownHours;
      console.log(`⏰ [FOLLOWUP-SCHEDULER] Using rule cooldown: ${cooldownHours}h (from rule ${message.ruleId})`);
    }
  }
  
  const nextCheckDate = new Date();
  nextCheckDate.setHours(nextCheckDate.getHours() + cooldownHours);
  
  // FIX: Cap consecutiveNoReplyCount to max 3 to prevent values like 4/3
  await updateConversationState(message.conversationId, {
    followupCount: sql`followup_count + 1` as any,
    consecutiveNoReplyCount: sql`LEAST(COALESCE(consecutive_no_reply_count, 0) + 1, 3)` as any,
    lastFollowupAt: new Date(),
    nextFollowupScheduledAt: nextCheckDate,
  });
  
  console.log(`📊 [FOLLOWUP-SCHEDULER] Updated state: followupCount+1, consecutiveNoReplyCount+1 (capped at 3), nextCheck=${nextCheckDate.toISOString()} (cooldown: ${cooldownHours}h)`);
}

export function isSchedulerRunning(): boolean {
  return evaluationJob !== null && processingJob !== null;
}

export function getSchedulerStatus(): {
  evaluationRunning: boolean;
  processingRunning: boolean;
  isEvaluating: boolean;
  isProcessing: boolean;
} {
  return {
    evaluationRunning: evaluationJob !== null,
    processingRunning: processingJob !== null,
    isEvaluating: isEvaluationRunning,
    isProcessing: isProcessingRunning,
  };
}
