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
  users
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
import { sendWhatsAppMessage } from '../whatsapp/twilio-client';

let evaluationJob: cron.ScheduledTask | null = null;
let processingJob: cron.ScheduledTask | null = null;
let coldLeadsJob: cron.ScheduledTask | null = null;
let ghostLeadsJob: cron.ScheduledTask | null = null;
let isEvaluationRunning = false;
let isProcessingRunning = false;
let isColdLeadsRunning = false;
let isGhostLeadsRunning = false;

const EVALUATION_INTERVAL = '*/5 * * * *'; // Every 5 minutes - HOT/WARM leads
const PROCESSING_INTERVAL = '* * * * *';   // Every minute
const COLD_LEADS_INTERVAL = '0 */2 * * *'; // Every 2 hours - COLD leads
const GHOST_LEADS_INTERVAL = '0 10 * * *'; // Daily at 10:00 - GHOST leads
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
export function calculateTemperature(hoursSinceLastInbound: number): TemperatureLevel {
  if (hoursSinceLastInbound < 2) return "hot";        // < 2 ore: lead molto attivo
  if (hoursSinceLastInbound < 24) return "warm";      // < 24 ore: ancora dentro finestra WhatsApp
  if (hoursSinceLastInbound < 168) return "cold";     // < 7 giorni: lead freddo
  return "ghost";                                      // > 7 giorni: fantasma
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

  console.log('✅ [FOLLOWUP-SCHEDULER] Scheduler initialized successfully');
  console.log(`   🔥 HOT/WARM: ${EVALUATION_INTERVAL} (every 5 minutes)`);
  console.log(`   ❄️  COLD: ${COLD_LEADS_INTERVAL} (every 2 hours)`);
  console.log(`   👻 GHOST: ${GHOST_LEADS_INTERVAL} (daily at 10:00)`);
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
      try {
        metrics.processed++;
        
        // Calculate and update temperature if changed
        const newTemperature = calculateTemperature(conversation.hoursSinceLastInbound);
        if (conversation.temperatureLevel !== newTemperature) {
          await db.update(conversationStates)
            .set({ 
              temperatureLevel: newTemperature,
              updatedAt: new Date()
            })
            .where(eq(conversationStates.conversationId, conversation.conversationId));
          
          console.log(`🌡️ [TEMPERATURE] Conversazione ${conversation.conversationId}: ${conversation.temperatureLevel || 'N/A'} → ${newTemperature}`);
          temperatureUpdates++;
          
          // Update the candidate object for accurate processing
          conversation.temperatureLevel = newTemperature;
        }

        const result = await evaluateConversation(conversation);
        processed++;
        
        switch (result) {
          case 'scheduled':
            scheduled++;
            metrics.success++;
            break;
          case 'skipped':
            skipped++;
            metrics.skipped++;
            break;
          case 'stopped':
            stopped++;
            metrics.success++;
            break;
        }
      } catch (error) {
        errors++;
        metrics.errors++;
        console.error(`❌ [FOLLOWUP-SCHEDULER] Error evaluating conversation ${conversation.conversationId}:`, error);
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

    for (const conversation of candidateConversations) {
      try {
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
      }
    }

    const duration = Date.now() - startTime;
    console.log(`📈 [FOLLOWUP-SCHEDULER] COLD leads evaluation completed in ${duration}ms`);
    console.log(`   📊 Processed: ${processed}, Scheduled: ${scheduled}, Temp updates: ${temperatureUpdates}`);
    
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

    for (const conversation of candidateConversations) {
      try {
        // For ghost leads, we primarily want to mark them or attempt reactivation
        const result = await evaluateConversation(conversation);
        processed++;
        if (result === 'scheduled') scheduled++;
      } catch (error) {
        console.error(`❌ [FOLLOWUP-SCHEDULER] Error evaluating ghost conversation ${conversation.conversationId}:`, error);
      }
    }

    const duration = Date.now() - startTime;
    console.log(`📈 [FOLLOWUP-SCHEDULER] GHOST leads evaluation completed in ${duration}ms`);
    console.log(`   📊 Processed: ${processed}, Scheduled: ${scheduled}`);
    
  } finally {
    isGhostLeadsRunning = false;
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

        await sendFollowupMessage(message);
        
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

    if (state.nextFollowupScheduledAt && new Date(state.nextFollowupScheduledAt) > now) {
      continue;
    }

    if (state.followupCount >= state.maxFollowupsAllowed) {
      continue;
    }

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
    });
  }

  return candidates;
}

async function evaluateConversation(
  candidate: CandidateConversation
): Promise<'scheduled' | 'skipped' | 'stopped'> {
  console.log(`🔍 [FOLLOWUP-SCHEDULER] Evaluating conversation ${candidate.conversationId}`);
  console.log(`   State: ${candidate.currentState}, Days silent: ${candidate.daysSilent}, Hours silent: ${candidate.hoursSilent.toFixed(1)}, Follow-ups: ${candidate.followupCount}/${candidate.maxFollowupsAllowed}`);
  
  // TASK 6: Safety net - check max follow-ups at the very beginning
  if (candidate.followupCount >= candidate.maxFollowupsAllowed) {
    console.log(`🛑 [SAFETY-NET] Max follow-ups reached (${candidate.followupCount}/${candidate.maxFollowupsAllowed}), stopping`);
    
    await updateConversationState(candidate.conversationId, {
      currentState: 'ghost',
      previousState: candidate.currentState,
      lastAiEvaluationAt: new Date(),
      aiRecommendation: `[SAFETY-NET] Max follow-ups reached (${candidate.followupCount}/${candidate.maxFollowupsAllowed})`,
    });
    
    return 'stopped';
  }
  
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
      
      return 'skipped';
    }
    
    await db.insert(scheduledFollowupMessages).values({
      conversationId: candidate.conversationId,
      ruleId: timeBasedRule.id,
      templateId: windowCheck.selectedTemplateId || timeBasedRule.templateId,
      scheduledFor,
      status: 'pending',
      templateVariables: {},
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
    id: 'ai-virtual-rule',
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

  const lastMessages = await getLastMessages(candidate.conversationId, 10);
  const availableTemplates = await getAvailableTemplates(candidate.consultantId, candidate.agentConfigId);

  // FIX: Use the LAST message (most recent) not the first one
  const lastMessage = lastMessages.length > 0 ? lastMessages[lastMessages.length - 1] : null;
  const lastMessageDirection: "inbound" | "outbound" | null = 
    lastMessage 
      ? (lastMessage.role === 'lead' ? 'inbound' : 'outbound')
      : null;

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

  const decision = await evaluateFollowup(context, candidate.consultantId);

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

  await logFollowupDecision(
    candidate.conversationId,
    context,
    decision,
    'gemini-2.5-flash'
  );

  if (decision.decision === 'send_now' || decision.decision === 'schedule') {
    const scheduledFor = calculateScheduledTime(decision);
    
    // 🔍 DEBUG LOG: Traccia agentConfigId passato alla validazione
    console.log(`🔍 [TEMPLATE-TRACE] ═══ CHIAMATA 2: AI decision ═══`);
    console.log(`🔍 [TEMPLATE-TRACE] candidate.agentConfigId: ${candidate.agentConfigId || 'NULL/UNDEFINED'}`);
    console.log(`🔍 [TEMPLATE-TRACE] candidate.conversationId: ${candidate.conversationId}`);
    console.log(`🔍 [TEMPLATE-TRACE] candidate.leadName: ${candidate.leadName}`);
    console.log(`🔍 [TEMPLATE-TRACE] decision.decision: ${decision.decision}`);
    
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
      
      return 'skipped';
    }
    
    // Use the template found during validation, or fall back to rule template
    let templateIdToUse: string | null = windowCheck.selectedTemplateId || null;
    let fallbackMessageToUse: string | null = null;
    
    if (decision.allowFreeformMessage) {
      // CRITICAL FIX: Se il lead non ha mai risposto, NON usare freeform, DEVE usare template
      if (candidate.leadNeverResponded) {
        console.log(`🔒 [FOLLOWUP-SCHEDULER] Freeform BLOCKED: leadNeverResponded=true - using validated template instead`);
        // Keep templateIdToUse from windowCheck validation
        templateIdToUse = windowCheck.selectedTemplateId;
        fallbackMessageToUse = null;
      } else {
        console.log(`⚡ [FOLLOWUP-SCHEDULER] Freeform message mode (pending short-window rule)`);
        fallbackMessageToUse = await generateFreeformFollowupMessage(context, candidate.consultantId);
        templateIdToUse = null;
      }
    } else if (windowCheck.willBeOutside24h && windowCheck.selectedTemplateId) {
      // CRITICAL: Outside 24h window - MUST use the pre-validated approved template from windowCheck
      // This template was already validated for 24h compliance, do not override with AI
      templateIdToUse = windowCheck.selectedTemplateId;
      fallbackMessageToUse = effectiveAiRule.fallbackMessage || decision.suggestedMessage || null;
      console.log(`🔒 [FOLLOWUP-SCHEDULER] Outside 24h window - using pre-validated template: ${templateIdToUse}`);
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
    
    await db.insert(scheduledFollowupMessages).values({
      conversationId: candidate.conversationId,
      ruleId: effectiveAiRule.id,
      templateId: templateIdToUse,
      scheduledFor,
      status: 'pending',
      templateVariables: {},
      fallbackMessage: fallbackMessageToUse,
      aiDecisionReasoning: decision.allowFreeformMessage 
        ? `Pending short-window: AI generated freeform message` 
        : decision.reasoning,
      aiConfidenceScore: decision.confidenceScore,
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
async function getLastMessages(
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
  
  // STEP 1: Get Twilio templates (HX prefix) assigned to this agent
  const twilioTemplates = await db
    .select({ 
      templateId: whatsappTemplateAssignments.templateId,
      priority: whatsappTemplateAssignments.priority,
      templateType: whatsappTemplateAssignments.templateType,
      templateName: whatsappTemplateAssignments.templateName
    })
    .from(whatsappTemplateAssignments)
    .where(eq(whatsappTemplateAssignments.agentConfigId, agentConfigId))
    .orderBy(desc(whatsappTemplateAssignments.priority));
  
  // Filter for Twilio templates (HX prefix)
  const approvedTwilioTemplates = twilioTemplates.filter(t => 
    t.templateId.startsWith('HX') && t.templateType === 'twilio'
  );
  
  for (const t of approvedTwilioTemplates) {
    templates.push({
      id: t.templateId,
      name: t.templateName || `Template ${t.templateId.substring(0, 8)}`,
      goal: 'Follow-up WhatsApp', // Default goal for Twilio templates
      tone: 'Professionale',
      bodyText: `Template Twilio pre-approvato (Priority: ${t.priority})`,
      priority: t.priority
    });
  }
  
  // STEP 2: Get custom templates with full details
  const customTemplates = await db
    .select({
      templateId: whatsappCustomTemplates.id,
      name: whatsappCustomTemplates.name,
      description: whatsappCustomTemplates.description,
      bodyText: whatsappCustomTemplates.bodyText,
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
    templates.push({
      id: templateIdToUse,
      name: t.name || 'Template personalizzato',
      goal: t.useCase || t.description || 'Follow-up',
      tone: 'Personalizzato',
      bodyText: t.bodyText || '',
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

async function getAvailableTemplates(
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
  
  switch (decision.urgency) {
    case 'now':
      return now;
    case 'tomorrow':
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(10, 0, 0, 0);
      return tomorrow;
    case 'next_week':
      const nextWeek = new Date(now);
      nextWeek.setDate(nextWeek.getDate() + 7);
      nextWeek.setHours(10, 0, 0, 0);
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

  // 🔍 DEBUG LOG: Mostra quale agentConfigId stiamo cercando
  console.log(`🔍 [TEMPLATE-DEBUG] ══════════════════════════════════════════════`);
  console.log(`🔍 [TEMPLATE-DEBUG] Cercando template per agentConfigId: ${agentConfigId}`);
  console.log(`🔍 [TEMPLATE-DEBUG] Conversation: ${conversationId}`);

  // STEP 1: Check for Twilio templates (HX prefix) assigned to this agent
  // Twilio templates with HX prefix that are assigned are considered pre-approved
  // They go through Twilio's approval process before being available in the Content API
  const twilioTemplates = await db
    .select({ 
      templateId: whatsappTemplateAssignments.templateId,
      priority: whatsappTemplateAssignments.priority,
      templateType: whatsappTemplateAssignments.templateType
    })
    .from(whatsappTemplateAssignments)
    .where(eq(whatsappTemplateAssignments.agentConfigId, agentConfigId))
    .orderBy(desc(whatsappTemplateAssignments.priority));

  // 🔍 DEBUG LOG: Mostra TUTTI i template trovati dalla query (PRIMA del filtro)
  console.log(`🔍 [TEMPLATE-DEBUG] Template TROVATI dalla query (tutti): ${twilioTemplates.length}`);
  twilioTemplates.forEach((t, i) => {
    console.log(`🔍 [TEMPLATE-DEBUG]   ${i + 1}. templateId: ${t.templateId}, type: ${t.templateType}, priority: ${t.priority}`);
    console.log(`🔍 [TEMPLATE-DEBUG]      - Inizia con HX? ${t.templateId.startsWith('HX')}`);
    console.log(`🔍 [TEMPLATE-DEBUG]      - templateType === 'twilio'? ${t.templateType === 'twilio'}`);
  });

  // Filter for Twilio templates (HX prefix) - these are pre-approved by Twilio when they have the HX ContentSID format
  // Only templates that have been synced to Twilio and approved will have an HX prefix
  const approvedTwilioTemplates = twilioTemplates.filter(t => 
    t.templateId.startsWith('HX') && t.templateType === 'twilio'
  );

  // 🔍 DEBUG LOG: Mostra template DOPO il filtro
  console.log(`🔍 [TEMPLATE-DEBUG] Template DOPO filtro (HX + twilio): ${approvedTwilioTemplates.length}`);
  approvedTwilioTemplates.forEach((t, i) => {
    console.log(`🔍 [TEMPLATE-DEBUG]   ${i + 1}. ${t.templateId} (priority: ${t.priority})`);
  });
  console.log(`🔍 [TEMPLATE-DEBUG] ══════════════════════════════════════════════`);
  
  if (approvedTwilioTemplates.length > 0) {
    const selectedTemplate = approvedTwilioTemplates[0];
    console.log(`✅ [FOLLOWUP-SCHEDULER] Template Twilio approvato SELEZIONATO: ${selectedTemplate.templateId} (priority: ${selectedTemplate.priority}, type: ${selectedTemplate.templateType})`);
    return { canSchedule: true, window24hExpiresAt, willBeOutside24h, leadNeverResponded, selectedTemplateId: selectedTemplate.templateId };
  }

  // STEP 2: Check for custom templates with approved status
  const approvedCustomTemplate = await db
    .select({ 
      id: whatsappTemplateVersions.id,
      templateId: whatsappTemplateVersions.templateId,
      twilioContentSid: whatsappTemplateVersions.twilioContentSid
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
    .orderBy(desc(whatsappTemplateAssignments.priority))
    .limit(1);

  if (approvedCustomTemplate.length > 0) {
    const selectedTemplate = approvedCustomTemplate[0];
    const templateIdToUse = selectedTemplate.twilioContentSid || selectedTemplate.templateId;
    console.log(`✅ [FOLLOWUP-SCHEDULER] Template custom approvato trovato: ${templateIdToUse}`);
    return { canSchedule: true, window24hExpiresAt, willBeOutside24h, leadNeverResponded, selectedTemplateId: templateIdToUse };
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
      // Check if template has approved version
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
  
  await sendWhatsAppMessage(
    consultantId,
    phoneNumber,
    messageText,
    undefined,
    {
      agentConfigId: agentConfigId || undefined,
      conversationId: message.conversationId,
      twilioContentSid: twilioContentSid || undefined,
    }
  );
  
  console.log(`✅ [FOLLOWUP-SCHEDULER] Message sent successfully to ${phoneNumber}`);

  await updateConversationState(message.conversationId, {
    followupCount: sql`followup_count + 1` as any,
    lastFollowupAt: new Date(),
    nextFollowupScheduledAt: undefined,
  });
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
