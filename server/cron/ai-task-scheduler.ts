/**
 * AI Task Scheduler CRON Job
 * Processa task AI programmati per chiamate outbound.
 * 
 * CRON: ogni minuto controlla task da eseguire
 * - Lock mutex per evitare doppia esecuzione
 * - Gestione retry automatici
 * - Integrazione con sistema voice call esistente
 */

import cron from 'node-cron';
import { db } from '../db';
import { sql } from 'drizzle-orm';
import { withCronLock } from './cron-lock-manager';

const CRON_JOB_NAME = 'ai-task-scheduler';
const LOCK_DURATION_MS = 2 * 60 * 1000; // 2 minutes

interface AIScheduledTask {
  id: string;
  consultant_id: string;
  contact_name: string | null;
  contact_phone: string;
  task_type: string;
  ai_instruction: string;
  scheduled_at: Date;
  timezone: string;
  recurrence_type: string;
  recurrence_days: number[] | null;
  recurrence_end_date: string | null;
  max_attempts: number;
  current_attempt: number;
  retry_delay_minutes: number;
  last_attempt_at: Date | null;
  next_retry_at: Date | null;
  status: string;
  result_summary: string | null;
  voice_call_id: string | null;
  voice_template_id: string | null;
  voice_direction: string;
}

/**
 * Process pending AI tasks
 */
async function processAITasks(): Promise<void> {
  const result = await withCronLock(CRON_JOB_NAME, async () => {
    console.log('🤖 [AI-SCHEDULER] Processing AI tasks...');
    
    // Find tasks ready to execute:
    // 1. Scheduled tasks whose time has come
    // 2. Retry-pending tasks whose retry time has come
    const tasksResult = await db.execute(sql`
      SELECT * FROM ai_scheduled_tasks 
      WHERE (
        (status = 'scheduled' AND scheduled_at <= NOW())
        OR 
        (status = 'retry_pending' AND next_retry_at <= NOW())
      )
      ORDER BY scheduled_at ASC
      LIMIT 10
      FOR UPDATE SKIP LOCKED
    `);
    
    const tasks = tasksResult.rows as AIScheduledTask[];
    
    if (tasks.length === 0) {
      console.log('🤖 [AI-SCHEDULER] No tasks to process');
      return { processed: 0 };
    }
    
    console.log(`🤖 [AI-SCHEDULER] Found ${tasks.length} tasks to process`);
    
    let processed = 0;
    let succeeded = 0;
    let failed = 0;
    
    for (const task of tasks) {
      try {
        await executeTask(task);
        processed++;
        succeeded++;
      } catch (error: any) {
        console.error(`❌ [AI-SCHEDULER] Error executing task ${task.id}:`, error.message);
        processed++;
        failed++;
      }
    }
    
    console.log(`🤖 [AI-SCHEDULER] Processed ${processed} tasks (${succeeded} succeeded, ${failed} failed)`);
    return { processed, succeeded, failed };
  }, { lockDurationMs: LOCK_DURATION_MS });
  
  if (result === null) {
    // Lock not acquired, another instance is processing
    return;
  }
}

/**
 * Execute a single AI task
 */
async function executeTask(task: AIScheduledTask): Promise<void> {
  console.log(`📞 [AI-SCHEDULER] Executing task ${task.id} for ${task.contact_phone}`);
  
  // 1. Update status to in_progress
  await db.execute(sql`
    UPDATE ai_scheduled_tasks 
    SET status = 'in_progress',
        current_attempt = current_attempt + 1,
        last_attempt_at = NOW(),
        updated_at = NOW()
    WHERE id = ${task.id}
  `);
  
  try {
    // 2. Attempt to make the call
    // For now, we simulate success - actual integration will be added
    // TODO: Integrate with VPS voice bridge for actual call initiation
    
    const callSuccess = await initiateVoiceCall(task);
    
    if (callSuccess.success) {
      await handleSuccess(task, callSuccess);
    } else {
      await handleFailure(task, callSuccess.reason || 'Unknown error');
    }
  } catch (error: any) {
    await handleFailure(task, error.message);
  }
}

/**
 * Initiate voice call through existing outbound system
 */
async function initiateVoiceCall(task: AIScheduledTask): Promise<{ success: boolean; reason?: string; callId?: string }> {
  try {
    // Get consultant's VPS settings
    const settingsResult = await db.execute(sql`
      SELECT 
        voice_vps_host,
        voice_vps_port,
        voice_service_token
      FROM consultant_voice_settings
      WHERE consultant_id = ${task.consultant_id}
    `);
    
    const settings = settingsResult.rows[0] as any;
    
    if (!settings?.voice_vps_host || !settings?.voice_service_token) {
      return { 
        success: false, 
        reason: 'VPS not configured for this consultant' 
      };
    }
    
    // Create the outbound call via VPS
    const vpsUrl = `http://${settings.voice_vps_host}:${settings.voice_vps_port || 3000}/outbound/call`;
    
    const response = await fetch(vpsUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${settings.voice_service_token}`
      },
      body: JSON.stringify({
        phone: task.contact_phone,
        consultantId: task.consultant_id,
        contactName: task.contact_name,
        customInstruction: task.ai_instruction,
        templateId: task.voice_template_id,
        sourceTaskId: task.id
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ [AI-SCHEDULER] VPS error: ${errorText}`);
      return { 
        success: false, 
        reason: `VPS error: ${response.status}` 
      };
    }
    
    const result = await response.json();
    
    console.log(`✅ [AI-SCHEDULER] Call initiated for task ${task.id}: ${result.callId}`);
    
    return { 
      success: true, 
      callId: result.callId 
    };
    
  } catch (error: any) {
    console.error(`❌ [AI-SCHEDULER] Failed to initiate call:`, error.message);
    return { 
      success: false, 
      reason: error.message 
    };
  }
}

/**
 * Handle successful task execution
 */
async function handleSuccess(task: AIScheduledTask, result: { callId?: string }): Promise<void> {
  console.log(`✅ [AI-SCHEDULER] Task ${task.id} completed successfully`);
  
  await db.execute(sql`
    UPDATE ai_scheduled_tasks 
    SET status = 'completed',
        result_summary = 'Chiamata avviata con successo',
        voice_call_id = ${result.callId || null},
        completed_at = NOW(),
        updated_at = NOW()
    WHERE id = ${task.id}
  `);
  
  // If recurrent, schedule next occurrence
  if (task.recurrence_type !== 'once') {
    await scheduleNextRecurrence(task);
  }
}

/**
 * Handle failed task execution with retry logic
 */
async function handleFailure(task: AIScheduledTask, reason: string): Promise<void> {
  const canRetry = task.current_attempt < task.max_attempts;
  
  if (canRetry) {
    const nextRetryMs = task.retry_delay_minutes * 60 * 1000;
    const nextRetryAt = new Date(Date.now() + nextRetryMs);
    
    console.log(`🔄 [AI-SCHEDULER] Task ${task.id} failed, scheduling retry ${task.current_attempt + 1}/${task.max_attempts} at ${nextRetryAt.toISOString()}`);
    
    await db.execute(sql`
      UPDATE ai_scheduled_tasks 
      SET status = 'retry_pending',
          next_retry_at = ${nextRetryAt},
          result_summary = ${`Tentativo ${task.current_attempt} fallito: ${reason}`},
          updated_at = NOW()
      WHERE id = ${task.id}
    `);
  } else {
    console.log(`❌ [AI-SCHEDULER] Task ${task.id} failed after ${task.current_attempt} attempts`);
    
    await db.execute(sql`
      UPDATE ai_scheduled_tasks 
      SET status = 'failed',
          result_summary = ${`Fallito dopo ${task.current_attempt} tentativi: ${reason}`},
          completed_at = NOW(),
          updated_at = NOW()
      WHERE id = ${task.id}
    `);
    
    // If recurrent, still schedule next occurrence even if this one failed
    if (task.recurrence_type !== 'once') {
      await scheduleNextRecurrence(task);
    }
  }
}

/**
 * Schedule next recurrence of a recurring task
 */
async function scheduleNextRecurrence(task: AIScheduledTask): Promise<void> {
  const nextDate = calculateNextDate(task);
  
  if (!nextDate) {
    console.log(`📅 [AI-SCHEDULER] No next recurrence for task ${task.id}`);
    return;
  }
  
  // Check if past end date
  if (task.recurrence_end_date) {
    const endDate = new Date(task.recurrence_end_date);
    if (nextDate > endDate) {
      console.log(`📅 [AI-SCHEDULER] Task ${task.id} past end date, no more recurrences`);
      return;
    }
  }
  
  // Create new task for next occurrence
  const newTaskId = `task_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
  
  await db.execute(sql`
    INSERT INTO ai_scheduled_tasks (
      id, consultant_id, contact_name, contact_phone, task_type,
      ai_instruction, scheduled_at, timezone, recurrence_type,
      recurrence_days, recurrence_end_date, max_attempts,
      retry_delay_minutes, voice_template_id, voice_direction, status
    ) VALUES (
      ${newTaskId}, ${task.consultant_id}, ${task.contact_name}, ${task.contact_phone},
      ${task.task_type}, ${task.ai_instruction}, ${nextDate}, ${task.timezone},
      ${task.recurrence_type}, ${task.recurrence_days ? JSON.stringify(task.recurrence_days) : null}::jsonb,
      ${task.recurrence_end_date}, ${task.max_attempts}, ${task.retry_delay_minutes},
      ${task.voice_template_id}, ${task.voice_direction}, 'scheduled'
    )
  `);
  
  console.log(`📅 [AI-SCHEDULER] Created next recurrence ${newTaskId} for ${nextDate.toISOString()}`);
}

/**
 * Calculate next date based on recurrence type
 */
function calculateNextDate(task: AIScheduledTask): Date | null {
  const current = new Date(task.scheduled_at);
  
  switch (task.recurrence_type) {
    case 'daily':
      current.setDate(current.getDate() + 1);
      return current;
      
    case 'weekly':
      if (!task.recurrence_days || task.recurrence_days.length === 0) {
        // No specific days, just add 7 days
        current.setDate(current.getDate() + 7);
        return current;
      }
      // Find next weekday in the list
      return findNextWeekday(current, task.recurrence_days);
      
    case 'custom':
      // Custom logic not yet implemented
      return null;
      
    default:
      return null;
  }
}

/**
 * Find the next occurrence of a weekday from a list
 * Days are 1=Monday through 7=Sunday (ISO format)
 */
function findNextWeekday(fromDate: Date, days: number[]): Date {
  const sortedDays = [...days].sort((a, b) => a - b);
  const currentDay = fromDate.getDay() === 0 ? 7 : fromDate.getDay(); // Convert Sunday from 0 to 7
  
  // Find next day in the list after current day
  for (const day of sortedDays) {
    if (day > currentDay) {
      const daysToAdd = day - currentDay;
      const nextDate = new Date(fromDate);
      nextDate.setDate(nextDate.getDate() + daysToAdd);
      return nextDate;
    }
  }
  
  // Wrap around to first day of next week
  const firstDay = sortedDays[0];
  const daysToAdd = 7 - currentDay + firstDay;
  const nextDate = new Date(fromDate);
  nextDate.setDate(nextDate.getDate() + daysToAdd);
  return nextDate;
}

/**
 * Initialize the AI Task Scheduler CRON job
 */
export function initAITaskScheduler(): void {
  console.log('🤖 [AI-SCHEDULER] Initializing AI Task Scheduler...');
  
  // Run every minute
  cron.schedule('* * * * *', async () => {
    try {
      await processAITasks();
    } catch (error: any) {
      console.error('❌ [AI-SCHEDULER] Cron error:', error.message);
    }
  }, {
    timezone: 'Europe/Rome'
  });
  
  console.log('✅ [AI-SCHEDULER] AI Task Scheduler started (runs every minute)');
}

/**
 * Manual trigger for testing
 */
export async function triggerAITaskProcessing(): Promise<void> {
  await processAITasks();
}
