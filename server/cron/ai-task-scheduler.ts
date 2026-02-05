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
  // Calcola il numero del tentativo PRIMA di incrementare nel DB
  // così abbiamo un valore consistente da usare ovunque
  const attemptNumber = task.current_attempt + 1;
  
  console.log(`📞 [AI-SCHEDULER] Executing task ${task.id} for ${task.contact_phone} (attempt ${attemptNumber}/${task.max_attempts})`);
  
  // 1. Update status to in_progress and increment attempt counter
  await db.execute(sql`
    UPDATE ai_scheduled_tasks 
    SET status = 'in_progress',
        current_attempt = ${attemptNumber},
        last_attempt_at = NOW(),
        updated_at = NOW()
    WHERE id = ${task.id}
  `);
  
  // Aggiorna l'oggetto task locale con il nuovo valore
  const updatedTask = { ...task, current_attempt: attemptNumber };
  
  try {
    // 2. Attempt to make the call
    const callSuccess = await initiateVoiceCall(updatedTask);
    
    if (callSuccess.success) {
      await handleSuccess(updatedTask, callSuccess);
    } else {
      await handleFailure(updatedTask, callSuccess.reason || 'Unknown error');
    }
  } catch (error: any) {
    await handleFailure(updatedTask, error.message);
  }
}

/**
 * Generate unique ID for scheduled calls
 */
function generateScheduledCallId(): string {
  return `sc_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * Initiate voice call through existing outbound system
 * RIUTILIZZA lo stesso scheduled_voice_call durante i retry invece di crearne uno nuovo
 */
async function initiateVoiceCall(task: AIScheduledTask): Promise<{ success: boolean; reason?: string; callId?: string }> {
  try {
    // Get consultant's VPS settings and SIP caller ID from database
    const settingsResult = await db.execute(sql`
      SELECT 
        cas.vps_bridge_url,
        u.sip_caller_id,
        u.sip_gateway
      FROM consultant_availability_settings cas
      JOIN users u ON u.id = cas.consultant_id
      WHERE cas.consultant_id = ${task.consultant_id}
    `);
    
    const vpsUrl = (settingsResult.rows[0] as any)?.vps_bridge_url || process.env.VPS_BRIDGE_URL;
    const sipCallerId = (settingsResult.rows[0] as any)?.sip_caller_id;
    const sipGateway = (settingsResult.rows[0] as any)?.sip_gateway;
    
    if (!vpsUrl) {
      return { 
        success: false, 
        reason: 'VPS URL not configured for this consultant' 
      };
    }
    
    // Get service token
    const tokenResult = await db.execute(sql`
      SELECT token FROM voice_service_tokens 
      WHERE consultant_id = ${task.consultant_id} AND revoked_at IS NULL
      ORDER BY created_at DESC LIMIT 1
    `);
    
    const token = (tokenResult.rows[0] as any)?.token;
    if (!token) {
      return { 
        success: false, 
        reason: 'No service token configured' 
      };
    }
    
    // Check if a scheduled_voice_call already exists for this task (for retry reuse)
    const existingCallResult = await db.execute(sql`
      SELECT id FROM scheduled_voice_calls 
      WHERE source_task_id = ${task.id}
      ORDER BY created_at ASC
      LIMIT 1
    `);
    
    let scheduledCallId: string;
    const isRetry = existingCallResult.rows.length > 0;
    
    if (isRetry) {
      // REUSE existing scheduled_voice_call for retries
      scheduledCallId = (existingCallResult.rows[0] as any).id;
      console.log(`🔄 [AI-SCHEDULER] Reusing existing scheduled_voice_call ${scheduledCallId} for retry attempt ${task.current_attempt}`);
      
      // Update attempts count and status
      await db.execute(sql`
        UPDATE scheduled_voice_calls 
        SET status = 'calling',
            attempts = ${task.current_attempt},
            error_message = NULL,
            updated_at = NOW()
        WHERE id = ${scheduledCallId}
      `);
    } else {
      // FIRST ATTEMPT: Create new scheduled_voice_call
      scheduledCallId = generateScheduledCallId();
      
      await db.execute(sql`
        INSERT INTO scheduled_voice_calls (
          id, consultant_id, target_phone, scheduled_at, status, ai_mode,
          custom_prompt, call_instruction, instruction_type, attempts, max_attempts,
          priority, source_task_id, attempts_log, use_default_template, created_at, updated_at
        ) VALUES (
          ${scheduledCallId}, ${task.consultant_id}, ${task.contact_phone}, 
          ${task.scheduled_at}, 'calling', 'assistenza',
          ${task.ai_instruction}, ${task.ai_instruction}, 
          ${task.task_type === 'single_call' ? 'task' : 'reminder'},
          1, ${task.max_attempts || 3},
          1, ${task.id}, '[]'::jsonb, true, NOW(), NOW()
        )
      `);
      
      console.log(`📋 [AI-SCHEDULER] Created scheduled_voice_call ${scheduledCallId} for task ${task.id}`);
    }
    
    // Log this attempt in attempts_log
    const attemptLogEntry = {
      attempt: task.current_attempt,
      timestamp: new Date().toISOString(),
      status: 'initiated'
    };
    
    await db.execute(sql`
      UPDATE scheduled_voice_calls 
      SET attempts_log = COALESCE(attempts_log, '[]'::jsonb) || ${JSON.stringify(attemptLogEntry)}::jsonb
      WHERE id = ${scheduledCallId}
    `);
    
    // Also log in ai_scheduled_tasks
    await db.execute(sql`
      UPDATE ai_scheduled_tasks 
      SET attempts_log = COALESCE(attempts_log, '[]'::jsonb) || ${JSON.stringify(attemptLogEntry)}::jsonb
      WHERE id = ${task.id}
    `);
    
    // Call VPS outbound endpoint with the scheduled call ID
    const outboundUrl = `${vpsUrl.replace(/\/$/, '')}/outbound/call`;
    
    // Build payload matching executeOutboundCall format for VPS compatibility
    const vpsPayload: Record<string, any> = {
      targetPhone: task.contact_phone,
      callId: scheduledCallId,
      aiMode: 'assistenza', // Use 'assistenza' like executeOutboundCall (not 'ai')
      customPrompt: task.ai_instruction,
      callInstruction: task.ai_instruction,
      instructionType: task.task_type === 'single_call' ? 'task' : 'reminder',
      useDefaultTemplate: true, // Added: Required for VPS to use base template
      sourceTaskId: task.id,
      contactName: task.contact_name
    };
    // Add SIP settings if configured by consultant
    if (sipCallerId) {
      vpsPayload.sipCallerId = sipCallerId;
    }
    if (sipGateway) {
      vpsPayload.sipGateway = sipGateway;
    }
    
    console.log(`📋 [AI-SCHEDULER] VPS payload: aiMode=${vpsPayload.aiMode}, useDefaultTemplate=${vpsPayload.useDefaultTemplate}, instructionType=${vpsPayload.instructionType}`);
    
    const response = await fetch(outboundUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(vpsPayload)
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ [AI-SCHEDULER] VPS error: ${errorText}`);
      
      // Update the attempt log with failure
      const failureLogUpdate = {
        attempt: task.current_attempt,
        timestamp: new Date().toISOString(),
        status: 'failed',
        error: `VPS error: ${response.status}`
      };
      
      // Update last element in attempts_log with failure status
      await db.execute(sql`
        UPDATE scheduled_voice_calls 
        SET status = 'retry_pending',
            error_message = ${`VPS error: ${response.status}`},
            attempts_log = jsonb_set(
              COALESCE(attempts_log, '[]'::jsonb),
              ('{' || (jsonb_array_length(COALESCE(attempts_log, '[]'::jsonb)) - 1)::text || '}')::text[],
              ${JSON.stringify(failureLogUpdate)}::jsonb
            ),
            updated_at = NOW()
        WHERE id = ${scheduledCallId}
      `);
      
      await db.execute(sql`
        UPDATE ai_scheduled_tasks 
        SET attempts_log = jsonb_set(
              COALESCE(attempts_log, '[]'::jsonb),
              ('{' || (jsonb_array_length(COALESCE(attempts_log, '[]'::jsonb)) - 1)::text || '}')::text[],
              ${JSON.stringify(failureLogUpdate)}::jsonb
            )
        WHERE id = ${task.id}
      `);
      
      return { 
        success: false, 
        reason: `VPS error: ${response.status}`,
        callId: scheduledCallId
      };
    }
    
    const result = await response.json();
    
    console.log(`✅ [AI-SCHEDULER] Call initiated for task ${task.id} via scheduled call ${scheduledCallId}`);
    
    return { 
      success: true, 
      callId: scheduledCallId 
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
 * Handle successful task initiation (NOT completion - callback will handle final status)
 */
async function handleSuccess(task: AIScheduledTask, result: { callId?: string }): Promise<void> {
  console.log(`✅ [AI-SCHEDULER] Task ${task.id} call initiated successfully (callId: ${result.callId})`);
  
  // Keep status as 'in_progress' - the callback will update to 'completed' or 'failed'
  // Just save the callId reference so we can track it
  await db.execute(sql`
    UPDATE ai_scheduled_tasks 
    SET result_summary = 'Chiamata in corso...',
        voice_call_id = ${result.callId || null},
        updated_at = NOW()
    WHERE id = ${task.id}
  `);
  
  // Note: recurrence scheduling now happens in callback when call actually completes
  // This prevents creating next occurrence before current call finishes
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
    
    // Update associated scheduled_voice_call to retry_pending (NOT failed yet)
    await db.execute(sql`
      UPDATE scheduled_voice_calls 
      SET status = 'retry_pending',
          updated_at = NOW()
      WHERE source_task_id = ${task.id}
    `);
  } else {
    console.log(`❌ [AI-SCHEDULER] Task ${task.id} failed after ${task.current_attempt} attempts`);
    
    // Add final failure to attempts_log
    const finalFailureLog = {
      attempt: task.current_attempt,
      timestamp: new Date().toISOString(),
      status: 'final_failure',
      error: `Fallito dopo ${task.current_attempt} tentativi: ${reason}`
    };
    
    await db.execute(sql`
      UPDATE ai_scheduled_tasks 
      SET status = 'failed',
          result_summary = ${`Fallito dopo ${task.current_attempt} tentativi: ${reason}`},
          attempts_log = COALESCE(attempts_log, '[]'::jsonb) || ${JSON.stringify(finalFailureLog)}::jsonb,
          completed_at = NOW(),
          updated_at = NOW()
      WHERE id = ${task.id}
    `);
    
    // Mark associated scheduled_voice_call as FAILED (definitively)
    await db.execute(sql`
      UPDATE scheduled_voice_calls 
      SET status = 'failed',
          error_message = ${`Fallito dopo ${task.current_attempt} tentativi: ${reason}`},
          attempts_log = COALESCE(attempts_log, '[]'::jsonb) || ${JSON.stringify(finalFailureLog)}::jsonb,
          updated_at = NOW()
      WHERE source_task_id = ${task.id}
    `);
    
    // NOTE: Recurrence is NOT scheduled here on failure
    // The callback will handle recurrence when a call actually completes successfully
    // This prevents duplicate recurrence scheduling
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
 * Clean up stuck 'calling' status calls that have been in that state for too long
 * This handles cases where:
 * - VPS callback was never received
 * - Connection was lost during call
 * - VPS returned success but call never completed
 */
async function cleanupStuckCallingCalls(): Promise<void> {
  try {
    // Find calls stuck in 'calling' for more than 5 minutes
    const stuckCallsResult = await db.execute(sql`
      SELECT id, target_phone, updated_at, attempts, max_attempts 
      FROM scheduled_voice_calls 
      WHERE status = 'calling' 
        AND updated_at < NOW() - INTERVAL '5 minutes'
    `);
    
    const stuckCalls = stuckCallsResult.rows as any[];
    
    if (stuckCalls.length === 0) {
      return;
    }
    
    console.log(`🧹 [AI-SCHEDULER] Found ${stuckCalls.length} calls stuck in 'calling' status`);
    
    for (const call of stuckCalls) {
      // Convert updated_at to proper timestamp for SQL comparison (with defensive check)
      let updatedAtTimestamp: string;
      try {
        updatedAtTimestamp = call.updated_at ? new Date(call.updated_at).toISOString() : new Date().toISOString();
      } catch (e) {
        console.warn(`⚠️ [AI-SCHEDULER] Invalid updated_at for call ${call.id}, using current time`);
        updatedAtTimestamp = new Date().toISOString();
      }
      
      // Check if there's a matching completed call in voice_calls
      const voiceCallResult = await db.execute(sql`
        SELECT id, status, duration_seconds, outcome 
        FROM voice_calls 
        WHERE called_number = ${call.target_phone}
          AND created_at > ${updatedAtTimestamp}::timestamp - INTERVAL '2 minutes'
          AND created_at < ${updatedAtTimestamp}::timestamp + INTERVAL '10 minutes'
          AND status = 'completed'
        ORDER BY created_at DESC
        LIMIT 1
      `);
      
      // First get source_task_id for AI task sync
      const callDetailResult = await db.execute(sql`
        SELECT source_task_id FROM scheduled_voice_calls WHERE id = ${call.id}
      `);
      const sourceTaskId = (callDetailResult.rows[0] as any)?.source_task_id;
      
      if (voiceCallResult.rows.length > 0) {
        // Found matching completed call - sync status
        const voiceCall = voiceCallResult.rows[0] as any;
        console.log(`🔗 [AI-SCHEDULER] Syncing stuck call ${call.id} with voice_call ${voiceCall.id}`);
        
        await db.execute(sql`
          UPDATE scheduled_voice_calls 
          SET status = 'completed',
              voice_call_id = ${voiceCall.id},
              duration_seconds = ${voiceCall.duration_seconds || 0},
              hangup_cause = ${voiceCall.outcome || 'synced_from_voice_calls'},
              last_attempt_at = NOW(),
              updated_at = NOW()
          WHERE id = ${call.id}
        `);
        
        // Sync AI Task if this call originated from one
        if (sourceTaskId) {
          await db.execute(sql`
            UPDATE ai_scheduled_tasks 
            SET status = 'completed',
                result_summary = ${'Chiamata completata (sync automatico)' + (voiceCall.duration_seconds ? ` - ${voiceCall.duration_seconds}s` : '')},
                voice_call_id = ${voiceCall.id},
                completed_at = NOW(),
                updated_at = NOW()
            WHERE id = ${sourceTaskId}
          `);
          console.log(`🔗 [AI-SCHEDULER] Synced AI Task ${sourceTaskId} -> completed`);
        }
      } else {
        // No matching call found - check if should retry or fail
        if (call.attempts < call.max_attempts) {
          console.log(`🔄 [AI-SCHEDULER] Resetting stuck call ${call.id} for retry (attempt ${call.attempts + 1}/${call.max_attempts})`);
          await db.execute(sql`
            UPDATE scheduled_voice_calls 
            SET status = 'pending',
                scheduled_at = NOW() + INTERVAL '2 minutes',
                attempts = attempts + 1,
                last_attempt_at = NOW(),
                error_message = 'Call stuck in calling state - retrying',
                updated_at = NOW()
            WHERE id = ${call.id}
          `);
          
          // Also update AI task to retry_pending if applicable
          if (sourceTaskId) {
            await db.execute(sql`
              UPDATE ai_scheduled_tasks 
              SET status = 'retry_pending',
                  current_attempt = current_attempt + 1,
                  last_attempt_at = NOW(),
                  next_retry_at = NOW() + INTERVAL '2 minutes',
                  result_summary = 'Chiamata bloccata - tentativo di ripetizione',
                  updated_at = NOW()
              WHERE id = ${sourceTaskId}
            `);
          }
        } else {
          console.log(`❌ [AI-SCHEDULER] Marking stuck call ${call.id} as failed (max attempts reached)`);
          await db.execute(sql`
            UPDATE scheduled_voice_calls 
            SET status = 'failed',
                last_attempt_at = NOW(),
                error_message = 'Call stuck in calling state - no callback received',
                updated_at = NOW()
            WHERE id = ${call.id}
          `);
          
          // Also mark AI task as failed if applicable
          if (sourceTaskId) {
            await db.execute(sql`
              UPDATE ai_scheduled_tasks 
              SET status = 'failed',
                  result_summary = 'Chiamata fallita - nessuna risposta dal VPS',
                  completed_at = NOW(),
                  updated_at = NOW()
              WHERE id = ${sourceTaskId}
            `);
            console.log(`❌ [AI-SCHEDULER] Synced AI Task ${sourceTaskId} -> failed`);
          }
        }
      }
    }
  } catch (error: any) {
    console.error('❌ [AI-SCHEDULER] Error cleaning up stuck calls:', error.message);
  }
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
      // Also clean up stuck 'calling' calls
      await cleanupStuckCallingCalls();
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

/**
 * Export scheduleNextRecurrence for use by callback when call completes
 */
export { scheduleNextRecurrence, calculateNextDate };
