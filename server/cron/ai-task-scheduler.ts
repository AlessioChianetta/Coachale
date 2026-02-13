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

function safeTextParam(value: string) {
  const sanitized = value.replace(/'/g, "''");
  return sql.raw(`'${sanitized}'`);
}
import { withCronLock } from './cron-lock-manager';
import { generateExecutionPlan, canExecuteAutonomously, type ExecutionStep, isWithinWorkingHours, getAutonomySettings } from '../ai/autonomous-decision-engine';
import { executeStep, type AITaskInfo } from '../ai/ai-task-executor';
import { getAIProvider, getModelForProviderName, getGeminiApiKeyForClassifier, GEMINI_3_MODEL, type GeminiClient } from '../ai/provider-factory';
import { GoogleGenAI } from '@google/genai';
import { FileSearchService } from '../ai/file-search-service';
import { fetchSystemDocumentsForAgent } from '../services/system-prompt-documents-service';

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
  origin_type: string;
  task_category: string;
  contact_id: string | null;
  ai_reasoning: string | null;
  ai_confidence: number | null;
  execution_plan: any[];
  result_data: any;
  priority: number;
  parent_task_id: string | null;
  call_after_task: boolean;
  post_actions: any[];
}

/**
 * Process pending AI tasks
 */
async function processAITasks(): Promise<void> {
  const result = await withCronLock(CRON_JOB_NAME, async () => {
    console.log('🤖 [AI-SCHEDULER] Processing AI tasks...');
    
    await db.execute(sql`
      UPDATE ai_scheduled_tasks 
      SET status = 'scheduled', updated_at = NOW()
      WHERE status = 'approved' AND scheduled_at <= NOW()
    `);
    
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
    if (task.task_type === 'ai_task') {
      await executeAutonomousTask(updatedTask);
      return;
    }

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
      JOIN users u ON u.id::text = cas.consultant_id::text
      WHERE cas.consultant_id::text = ${task.consultant_id}::text
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
      WHERE consultant_id = ${task.consultant_id}::text AND revoked_at IS NULL
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
          NOW(), 'calling', 'assistenza',
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
 * Execute an autonomous multi-step AI task
 * Phase 2: Real execution with Decision Engine (plan generation via Gemini),
 * Task Executor (step-by-step execution), and guardrails enforcement
 */
async function executeAutonomousTask(task: AIScheduledTask): Promise<void> {
  console.log(`🧠 [AI-SCHEDULER] Executing autonomous task ${task.id} (category: ${task.task_category})`);
  
  try {
    const guardrailCheck = await canExecuteAutonomously(task.consultant_id);
    if (!guardrailCheck.allowed) {
      console.log(`🛑 [AI-SCHEDULER] Task ${task.id} blocked by guardrails: ${guardrailCheck.reason}`);
      
      await db.execute(sql`
        UPDATE ai_scheduled_tasks 
        SET status = 'paused',
            result_summary = ${`In pausa: ${guardrailCheck.reason}`},
            updated_at = NOW()
        WHERE id = ${task.id}
      `);
      
      await logActivity(task.consultant_id, {
        event_type: 'task_paused',
        title: `Task in pausa: ${task.ai_instruction?.substring(0, 60) || 'Task AI'}`,
        description: guardrailCheck.reason || 'Guardrails bloccanti',
        icon: 'alert',
        severity: 'warning',
        task_id: task.id,
        contact_name: task.contact_name,
        contact_id: task.contact_id,
      });
      return;
    }
    
    let executionPlan: ExecutionStep[] = Array.isArray(task.execution_plan) && task.execution_plan.length > 0
      ? task.execution_plan as ExecutionStep[]
      : [];
    
    if (executionPlan.length === 0) {
      console.log(`🧠 [AI-SCHEDULER] Task ${task.id} has no execution plan, generating via Decision Engine...`);
      
      await logActivity(task.consultant_id, {
        event_type: 'decision_made',
        title: `Generazione piano per: ${task.ai_instruction?.substring(0, 60) || 'Task AI'}`,
        description: 'Decision Engine sta analizzando il contesto e creando un piano di esecuzione',
        icon: 'brain',
        severity: 'info',
        task_id: task.id,
        contact_name: task.contact_name,
        contact_id: task.contact_id,
      });
      
      const decision = await generateExecutionPlan({
        id: task.id,
        consultant_id: task.consultant_id,
        contact_id: task.contact_id,
        contact_phone: task.contact_phone,
        contact_name: task.contact_name,
        ai_instruction: task.ai_instruction,
        task_category: task.task_category,
        priority: task.priority,
        preferred_channel: task.preferred_channel,
        tone: task.tone,
        urgency: task.urgency,
        scheduled_datetime: task.scheduled_datetime,
        objective: task.objective,
        additional_context: task.additional_context,
        voice_template_suggestion: task.voice_template_suggestion,
        language: task.language,
      });
      
      if (!decision.should_execute) {
        console.log(`🛑 [AI-SCHEDULER] Decision Engine says skip task ${task.id}: ${decision.reasoning}`);
        
        await db.execute(sql`
          UPDATE ai_scheduled_tasks 
          SET status = 'completed',
              ai_reasoning = ${decision.reasoning},
              ai_confidence = ${decision.confidence},
              result_summary = ${`AI ha deciso di non eseguire: ${decision.reasoning.substring(0, 200)}`},
              result_data = ${JSON.stringify({ decision: 'skip', reasoning: decision.reasoning })}::jsonb,
              completed_at = NOW(),
              updated_at = NOW()
          WHERE id = ${task.id}
        `);
        
        await logActivity(task.consultant_id, {
          event_type: 'decision_made',
          title: `Task non necessario: ${task.ai_instruction?.substring(0, 60) || 'Task AI'}`,
          description: decision.reasoning.substring(0, 300),
          icon: 'brain',
          severity: 'info',
          task_id: task.id,
          contact_name: task.contact_name,
          contact_id: task.contact_id,
          event_data: { confidence: decision.confidence }
        });
        return;
      }
      
      executionPlan = decision.execution_plan;
      
      await db.execute(sql`
        UPDATE ai_scheduled_tasks 
        SET execution_plan = ${JSON.stringify(executionPlan)}::jsonb,
            ai_reasoning = ${decision.reasoning},
            ai_confidence = ${decision.confidence},
            started_at = NOW(),
            updated_at = NOW()
        WHERE id = ${task.id}
      `);
      
      console.log(`🧠 [AI-SCHEDULER] Generated ${executionPlan.length}-step plan for task ${task.id} (confidence: ${decision.confidence})`);
    }
    
    const totalSteps = executionPlan.length;
    
    await logActivity(task.consultant_id, {
      event_type: 'task_started',
      title: `Task avviato: ${task.ai_instruction?.substring(0, 60) || 'Task AI'}`,
      description: `${totalSteps} step da eseguire. Categoria: ${task.task_category}`,
      icon: 'brain',
      severity: 'info',
      task_id: task.id,
      contact_name: task.contact_name,
      contact_id: task.contact_id,
    });
    
    const taskInfo: AITaskInfo = {
      id: task.id,
      consultant_id: task.consultant_id,
      contact_id: task.contact_id,
      contact_phone: task.contact_phone,
      contact_name: task.contact_name,
      ai_instruction: task.ai_instruction,
      task_category: task.task_category,
      priority: task.priority,
      timezone: task.timezone || 'Europe/Rome',
    };
    
    const allResults: Record<string, any> = {};
    let completedSteps = 0;
    let failedStep: string | null = null;
    
    for (let i = 0; i < totalSteps; i++) {
      const step = executionPlan[i];
      const stepName = step.action || `step_${i + 1}`;
      
      console.log(`🧠 [AI-SCHEDULER] Executing step ${i + 1}/${totalSteps}: ${stepName}`);
      
      executionPlan[i] = { ...executionPlan[i], status: 'in_progress' };
      const stepProgressMsg = `Eseguendo step ${i + 1}/${totalSteps}: ${step.description || stepName}`;
      await db.execute(sql`
        UPDATE ai_scheduled_tasks 
        SET execution_plan = ${JSON.stringify(executionPlan)}::jsonb,
            result_summary = ${stepProgressMsg},
            updated_at = NOW()
        WHERE id = ${task.id}
      `);

      await logActivity(taskInfo.consultant_id, {
        event_type: `step_${stepName}_started`,
        title: `Eseguendo step ${i + 1}/${totalSteps}: ${stepName}`,
        description: step.description || stepName,
        icon: "🔄",
        severity: "info",
        task_id: task.id,
        contact_name: taskInfo.contact_name,
        contact_id: taskInfo.contact_id,
      });
      
      const stepResult = await executeStep(taskInfo, step, allResults);
      
      if (stepResult.success) {
        executionPlan[i] = { ...executionPlan[i], status: 'completed' };
        allResults[stepName] = stepResult.result;
        allResults[`step_${i + 1}`] = stepResult.result;
        completedSteps++;
        
        console.log(`✅ [AI-SCHEDULER] Step ${i + 1}/${totalSteps} completed in ${stepResult.duration_ms}ms`);
      } else {
        executionPlan[i] = { ...executionPlan[i], status: 'failed' };
        failedStep = stepName;
        
        console.error(`❌ [AI-SCHEDULER] Step ${i + 1}/${totalSteps} failed: ${stepResult.error}`);
        
        for (let j = i + 1; j < totalSteps; j++) {
          executionPlan[j] = { ...executionPlan[j], status: 'skipped' };
        }
        break;
      }
      
      await db.execute(sql`
        UPDATE ai_scheduled_tasks 
        SET execution_plan = ${JSON.stringify(executionPlan)}::jsonb,
            updated_at = NOW()
        WHERE id = ${task.id}
      `);
    }
    
    if (failedStep) {
      await db.execute(sql`
        UPDATE ai_scheduled_tasks 
        SET status = 'failed',
            execution_plan = ${JSON.stringify(executionPlan)}::jsonb,
            result_summary = ${`Fallito allo step "${failedStep}" (${completedSteps}/${totalSteps} completati)`},
            result_data = ${JSON.stringify({ steps_completed: completedSteps, total_steps: totalSteps, results: allResults })}::jsonb,
            completed_at = NOW(),
            updated_at = NOW()
        WHERE id = ${task.id}
      `);
      
      await logActivity(task.consultant_id, {
        event_type: 'task_failed',
        title: `Task fallito: ${task.ai_instruction?.substring(0, 60) || 'Task AI'}`,
        description: `Errore nello step "${failedStep}" (${completedSteps}/${totalSteps} completati)`,
        icon: 'alert',
        severity: 'error',
        task_id: task.id,
        contact_name: task.contact_name,
        contact_id: task.contact_id,
        event_data: { steps_completed: completedSteps, failed_step: failedStep }
      });
    } else {
      await db.execute(sql`
        UPDATE ai_scheduled_tasks 
        SET status = 'completed',
            execution_plan = ${JSON.stringify(executionPlan)}::jsonb,
            result_summary = ${`Completato: ${totalSteps} step eseguiti con successo`},
            result_data = ${JSON.stringify({ steps_completed: totalSteps, total_steps: totalSteps, results: allResults })}::jsonb,
            completed_at = NOW(),
            updated_at = NOW()
        WHERE id = ${task.id}
      `);
      
      if (task.call_after_task && task.contact_phone) {
        console.log(`📞 [AI-SCHEDULER] Task ${task.id} requires post-task call to ${task.contact_phone}`);
        const callTaskId = `task_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
        
        const talkingPoints = allResults['prepare_call']?.talking_points;
        const callInstruction = talkingPoints
          ? `Punti da discutere:\n${talkingPoints.map((tp: any, idx: number) => `${idx + 1}. ${typeof tp === 'string' ? tp : tp.topic || tp.point || JSON.stringify(tp)}`).join('\n')}`
          : task.ai_instruction;
        
        await db.execute(sql`
          INSERT INTO ai_scheduled_tasks (
            id, consultant_id, contact_name, contact_phone, task_type,
            ai_instruction, scheduled_at, timezone, status, origin_type,
            task_category, parent_task_id, priority
          ) VALUES (
            ${callTaskId}, ${task.consultant_id}, ${task.contact_name}, ${task.contact_phone},
            'single_call', ${callInstruction}, NOW() + INTERVAL '1 minute', 
            ${task.timezone || 'Europe/Rome'}, 'scheduled', 'autonomous',
            'followup', ${task.id}, ${task.priority}
          )
        `);
        console.log(`📞 [AI-SCHEDULER] Created follow-up call task ${callTaskId}`);
      }
      
      await logActivity(task.consultant_id, {
        event_type: 'task_completed',
        title: `Task completato: ${task.ai_instruction?.substring(0, 60) || 'Task AI'}`,
        description: `${totalSteps} step completati con successo`,
        icon: 'check',
        severity: 'success',
        task_id: task.id,
        contact_name: task.contact_name,
        contact_id: task.contact_id,
        event_data: { steps_completed: totalSteps }
      });
      
      console.log(`✅ [AI-SCHEDULER] Autonomous task ${task.id} completed (${totalSteps} steps)`);
    }
    
  } catch (error: any) {
    console.error(`❌ [AI-SCHEDULER] Autonomous task ${task.id} failed:`, error.message);
    
    await db.execute(sql`
      UPDATE ai_scheduled_tasks 
      SET status = 'failed',
          result_summary = ${`Errore: ${error.message}`},
          completed_at = NOW(),
          updated_at = NOW()
      WHERE id = ${task.id}
    `);
    
    await logActivity(task.consultant_id, {
      event_type: 'task_failed',
      title: `Task fallito: ${task.ai_instruction?.substring(0, 80) || 'Task AI'}`,
      description: `Errore: ${error.message}`,
      icon: 'alert',
      severity: 'error',
      task_id: task.id,
      contact_name: task.contact_name,
      contact_id: task.contact_id,
    });
  }
}

/**
 * Log an activity entry in ai_activity_log
 */
export async function logActivity(consultantId: string, data: {
  event_type: string;
  title: string;
  description?: string;
  icon?: string;
  severity?: string;
  task_id?: string;
  contact_name?: string | null;
  contact_id?: string | null;
  event_data?: Record<string, any>;
  ai_role?: string;
  cycle_id?: string;
}): Promise<void> {
  try {
    await db.execute(sql`
      INSERT INTO ai_activity_log (
        consultant_id, event_type, title, description, icon, severity,
        task_id, contact_name, contact_id, event_data, ai_role, cycle_id
      ) VALUES (
        ${consultantId}, ${data.event_type}, ${data.title},
        ${data.description || null}, ${data.icon || null}, ${data.severity || 'info'},
        ${data.task_id || null}, ${data.contact_name || null}, ${(data.contact_id && data.contact_id !== 'null') ? data.contact_id : null},
        ${JSON.stringify(data.event_data || {})}::jsonb, ${data.ai_role || null},
        ${data.cycle_id || null}
      )
    `);
  } catch (error: any) {
    console.error(`⚠️ [AI-SCHEDULER] Failed to log activity:`, error.message);
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

const AUTONOMOUS_GENERATION_LOCK = 'ai-autonomous-generation';
const AUTONOMOUS_LOCK_DURATION_MS = 5 * 60 * 1000;
const MAX_AUTONOMOUS_TASKS_PER_RUN = 3;

interface AutonomousSuggestedTask {
  contact_id: string;
  contact_name: string;
  contact_phone: string;
  ai_instruction: string;
  task_category: string;
  priority: number;
  reasoning: string;
  preferred_channel: string;
  urgency: string;
  tone: string;
}

interface SimulationRoleResult {
  roleId: string;
  roleName: string;
  skipped: boolean;
  skipReason?: string;
  dataAnalyzed: {
    totalClients: number;
    eligibleClients: number;
    clientsWithPendingTasks: number;
    clientsWithRecentCompletion: number;
    clientsList: any[];
    roleSpecificData: Record<string, any>;
  };
  promptSent: string;
  aiResponse: {
    raw: string;
    parsed: any;
    overallReasoning: string;
    tasksWouldCreate: Array<{
      contactName: string;
      contactId: string | null;
      category: string;
      instruction: string;
      reasoning: string;
      channel: string;
      priority: number;
      urgency: string;
      wouldBeStatus: string;
    }>;
  } | null;
  error?: string;
  providerUsed: string;
  modelUsed: string;
}

interface SimulationResult {
  consultantId: string;
  simulatedAt: string;
  totalRolesAnalyzed: number;
  totalTasksWouldCreate: number;
  providerName: string;
  modelName: string;
  settings: {
    autonomyLevel: number;
    isActive: boolean;
    workingHoursStart: string;
    workingHoursEnd: string;
  };
  roles: SimulationRoleResult[];
}

async function runAutonomousTaskGeneration(): Promise<void> {
  const result = await withCronLock(AUTONOMOUS_GENERATION_LOCK, async () => {
    console.log('🧠 [AUTONOMOUS-GEN] Starting autonomous task generation...');

    const consultantsResult = await db.execute(sql`
      SELECT DISTINCT aas.consultant_id
      FROM ai_autonomy_settings aas
      WHERE aas.autonomy_level >= 2
        AND aas.is_active = true
    `);

    const consultants = consultantsResult.rows as { consultant_id: string }[];

    if (consultants.length === 0) {
      console.log('🧠 [AUTONOMOUS-GEN] No eligible consultants found');
      return { generated: 0 };
    }

    console.log(`🧠 [AUTONOMOUS-GEN] Found ${consultants.length} eligible consultant(s)`);

    let totalGenerated = 0;

    for (const { consultant_id } of consultants) {
      try {
        const count = await generateTasksForConsultant(consultant_id);
        totalGenerated += count;
      } catch (error: any) {
        console.error(`❌ [AUTONOMOUS-GEN] Error for consultant ${consultant_id}:`, error.message);
      }
    }

    console.log(`🧠 [AUTONOMOUS-GEN] Completed. Total tasks generated: ${totalGenerated}`);
    return { generated: totalGenerated };
  }, { lockDurationMs: AUTONOMOUS_LOCK_DURATION_MS });

  if (result === null) {
    return;
  }
}

async function generateTasksForConsultant(consultantId: string, options?: { dryRun?: boolean }): Promise<number | SimulationResult> {
  const dryRun = options?.dryRun || false;
  console.log(`🧠 [AUTONOMOUS-GEN] Starting generateTasksForConsultant for ${consultantId} (dryRun=${dryRun})`);
  const settings = await getAutonomySettings(consultantId);
  console.log(`🧠 [AUTONOMOUS-GEN] Settings loaded OK for ${consultantId}`);

  if (!dryRun) {
    if (!settings.is_active || settings.autonomy_level < 2) {
      return 0;
    }

    if (!isWithinWorkingHours(settings)) {
      console.log(`🧠 [AUTONOMOUS-GEN] Consultant ${consultantId} outside working hours, skipping`);
      return 0;
    }
  }

  const simulationRoles: SimulationRoleResult[] = [];

  const cId = safeTextParam(consultantId);
  const enabledRolesResult = await db.execute(sql`
    SELECT enabled_roles FROM ai_autonomy_settings WHERE consultant_id::text = ${cId} LIMIT 1
  `);
  const enabledRoles: Record<string, boolean> = (enabledRolesResult.rows[0] as any)?.enabled_roles || 
    { alessia: true, millie: true, echo: true, nova: true, stella: true, iris: true };

  const { getActiveRoles } = await import("./ai-autonomous-roles");
  const activeRoles = getActiveRoles(enabledRoles);
  console.log(`🧠 [AUTONOMOUS-GEN] Active roles: ${activeRoles.map(r => r.id).join(', ')} for ${consultantId}`);

  if (activeRoles.length === 0) {
    console.log(`🧠 [AUTONOMOUS-GEN] No active roles for consultant ${consultantId}`);
    return 0;
  }

  console.log(`🧠 [AUTONOMOUS-GEN] Fetching clients for ${consultantId}...`);
  const clientsBaseResult = await db.execute(sql`
    SELECT 
      u.id::text as id,
      u.first_name,
      u.last_name,
      u.email,
      u.phone_number
    FROM users u
    JOIN user_role_profiles urp ON u.id::text = urp.user_id
    WHERE urp.consultant_id = ${cId} AND urp.role = 'client'
      AND u.is_active = true
    ORDER BY u.first_name ASC
    LIMIT 50
  `);
  const clientRows = clientsBaseResult.rows as any[];
  console.log(`🧠 [AUTONOMOUS-GEN] Found ${clientRows.length} clients, enriching with dates...`);
  
  const clients: any[] = [];
  for (const client of clientRows) {
    try {
      const clientIdRaw = safeTextParam(String(client.id));
      const [lcResult, ltResult] = await Promise.all([
        db.execute(sql`SELECT MAX(c.created_at) as d FROM consultations c WHERE c.client_id = ${clientIdRaw} AND c.consultant_id = ${cId}`),
        db.execute(sql`SELECT MAX(t.scheduled_at) as d FROM ai_scheduled_tasks t WHERE t.contact_id::text = ${clientIdRaw} AND t.consultant_id::text = ${cId}`)
      ]);
      clients.push({
        ...client,
        last_consultation_date: (lcResult.rows[0] as any)?.d || null,
        last_task_date: (ltResult.rows[0] as any)?.d || null,
      });
    } catch (enrichErr: any) {
      console.error(`❌ [AUTONOMOUS-GEN] Enrichment failed for client ${client.id}:`, enrichErr.message);
      clients.push({ ...client, last_consultation_date: null, last_task_date: null });
    }
  }
  console.log(`🧠 [AUTONOMOUS-GEN] Enriched ${clients.length} clients, proceeding to pending tasks...`);

  const pendingTasksResult = await db.execute(sql`
    SELECT contact_id::text as contact_id FROM ai_scheduled_tasks
    WHERE consultant_id::text = ${cId}
      AND status IN ('scheduled', 'in_progress', 'retry_pending', 'waiting_approval', 'approved')
      AND contact_id IS NOT NULL
  `);
  const clientsWithPendingTasks = new Set(
    (pendingTasksResult.rows as any[]).map(r => r.contact_id)
  );

  const recentCompletedResult = await db.execute(sql`
    SELECT contact_id::text as contact_id FROM ai_scheduled_tasks
    WHERE consultant_id::text = ${cId}
      AND status = 'completed'
      AND completed_at > NOW() - INTERVAL '24 hours'
      AND contact_id IS NOT NULL
  `);
  const clientsWithRecentCompletion = new Set(
    (recentCompletedResult.rows as any[]).map(r => r.contact_id)
  );

  const eligibleClients = clients.filter(c => {
    const clientId = c.id?.toString();
    if (!clientId) return false;
    if (clientsWithPendingTasks.has(clientId)) return false;
    if (clientsWithRecentCompletion.has(clientId)) return false;
    return true;
  });

  const clientsList = eligibleClients.map(c => ({
    id: c.id,
    name: [c.first_name, c.last_name].filter(Boolean).join(' '),
    email: c.email || 'N/A',
    phone: c.phone_number || 'N/A',
    last_consultation: c.last_consultation_date ? new Date(c.last_consultation_date).toISOString() : 'Mai',
    last_task: c.last_task_date ? new Date(c.last_task_date).toISOString() : 'Mai',
  }));

  const clientIds = eligibleClients.map((c: any) => c.id?.toString()).filter(Boolean);

  const recentTasksResult = await db.execute(sql`
    SELECT t.contact_id::text as contact_id, t.contact_name, t.task_category, t.ai_instruction, t.status, t.completed_at, t.ai_role
    FROM ai_scheduled_tasks t
    WHERE t.consultant_id::text = ${cId}
      AND t.completed_at > NOW() - INTERVAL '7 days'
      AND t.status = 'completed'
    ORDER BY t.completed_at DESC
    LIMIT 20
  `);
  const recentCompletedTasks = recentTasksResult.rows as any[];
  const recentTasksSummary = recentCompletedTasks.map(t => ({
    contact: t.contact_name || t.contact_id,
    category: t.task_category,
    instruction: t.ai_instruction?.substring(0, 100),
    completed: t.completed_at ? new Date(t.completed_at).toISOString() : 'N/A',
    role: t.ai_role || 'generic',
  }));

  const allRecentTasksResult = await db.execute(sql`
    SELECT t.contact_id::text as contact_id, t.contact_name, t.task_category, 
           t.ai_instruction, t.status, t.ai_role, t.created_at,
           t.completed_at
    FROM ai_scheduled_tasks t
    WHERE t.consultant_id::text = ${cId}
      AND t.created_at > NOW() - INTERVAL '7 days'
      AND t.status IN ('scheduled', 'waiting_approval', 'approved', 'cancelled', 'completed', 'failed')
    ORDER BY t.created_at DESC
    LIMIT 40
  `);
  const recentAllTasksSummary = (allRecentTasksResult.rows as any[]).map(t => ({
    contact: t.contact_name || t.contact_id || 'N/A',
    category: t.task_category,
    instruction: t.ai_instruction?.substring(0, 120),
    status: t.status,
    role: t.ai_role || 'generic',
    created: t.created_at ? new Date(t.created_at).toISOString() : 'N/A',
  }));

  const blocksResult = await db.execute(sql`
    SELECT b.contact_id::text, b.task_category, b.ai_role,
           COALESCE(u.first_name || ' ' || u.last_name, b.contact_id::text) as contact_name
    FROM ai_task_blocks b
    LEFT JOIN users u ON u.id::text = b.contact_id::text
    WHERE b.consultant_id::text = ${cId}
  `);
  const permanentBlocks = (blocksResult.rows as any[]).map(b => ({
    contactId: b.contact_id,
    contactName: b.contact_name,
    category: b.task_category,
    role: b.ai_role,
  }));

  let aiClient: GeminiClient | null = null;
  let providerModel = GEMINI_3_MODEL;
  let providerName = 'Google AI Studio';

  try {
    const provider = await getAIProvider(consultantId, consultantId);
    aiClient = provider.client;
    providerName = provider.metadata?.name || 'Unknown';
    providerModel = getModelForProviderName(providerName);
    console.log(`🧠 [AUTONOMOUS-GEN] Using provider: ${providerName} (model: ${providerModel})`);
  } catch (providerError: any) {
    console.warn(`⚠️ [AUTONOMOUS-GEN] Provider factory failed: ${providerError.message}, falling back to classifier key`);
    const apiKey = await getGeminiApiKeyForClassifier();
    if (!apiKey) {
      console.error('❌ [AUTONOMOUS-GEN] No Gemini API key available');
      if (dryRun) {
        return {
          consultantId,
          simulatedAt: new Date().toISOString(),
          totalRolesAnalyzed: 0,
          totalTasksWouldCreate: 0,
          providerName: 'N/A',
          modelName: 'N/A',
          settings: {
            autonomyLevel: settings.autonomy_level,
            isActive: settings.is_active,
            workingHoursStart: settings.working_hours_start,
            workingHoursEnd: settings.working_hours_end,
          },
          roles: [],
        } as SimulationResult;
      }
      return 0;
    }
    const genAI = new GoogleGenAI({ apiKey });
    aiClient = {
      generateContent: async (params: any) => {
        const result = await genAI.models.generateContent({
          model: params.model,
          contents: params.contents,
          config: {
            ...params.generationConfig,
          },
        });
        const text = typeof result.text === 'function' ? result.text() : (result as any).text;
        return { response: { text: () => text || '', candidates: [] } };
      },
      generateContentStream: async () => { throw new Error('Not supported'); },
    } as any;
  }

  if (!aiClient) {
    console.error('❌ [AUTONOMOUS-GEN] No AI client available');
    if (dryRun) {
      return {
        consultantId,
        simulatedAt: new Date().toISOString(),
        totalRolesAnalyzed: 0,
        totalTasksWouldCreate: 0,
        providerName: 'N/A',
        modelName: 'N/A',
        settings: {
          autonomyLevel: settings.autonomy_level,
          isActive: settings.is_active,
          workingHoursStart: settings.working_hours_start,
          workingHoursEnd: settings.working_hours_end,
        },
        roles: [],
      } as SimulationResult;
    }
    return 0;
  }

  const now = new Date();
  const romeTimeStr = now.toLocaleString('it-IT', { timeZone: 'Europe/Rome' });
  const taskStatus = settings.autonomy_level >= 4 ? 'scheduled' : 'waiting_approval';
  const scheduledAt = computeNextWorkingSlot(settings);

  let totalCreated = 0;

  const cycleId = `cycle_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

  console.log(`🧠 [AUTONOMOUS-GEN] Running ${activeRoles.length} AI roles for consultant ${consultantId}: ${activeRoles.map(r => r.name).join(', ')}${dryRun ? ' [DRY-RUN]' : ''} (cycle: ${cycleId})`);

  if (!dryRun) {
    await logActivity(consultantId, {
      event_type: 'autonomous_analysis',
      title: `Analisi multi-ruolo avviata: ${activeRoles.length} dipendenti AI attivi`,
      description: `Ruoli attivi: ${activeRoles.map(r => r.name).join(', ')}. ${eligibleClients.length} clienti idonei su ${clients.length} totali.`,
      icon: '🧠',
      severity: 'info',
      cycle_id: cycleId,
      event_data: {
        total_clients: clients.length,
        eligible_clients: eligibleClients.length,
        clients_with_pending_tasks: clientsWithPendingTasks.size,
        clients_with_recent_completion: clientsWithRecentCompletion.size,
        active_roles: activeRoles.map(r => r.id),
        provider_name: providerName,
        provider_model: providerModel,
        clients_list: clientsList.slice(0, 20),
        recent_tasks_summary: recentTasksSummary.slice(0, 10),
        excluded_clients: {
          with_pending_tasks: clientsWithPendingTasks.size,
          with_recent_completion: clientsWithRecentCompletion.size,
        },
      },
    });
  }

  const roleFrequencies: Record<string, string> = settings.role_frequencies || {};

  for (const role of activeRoles) {
    try {
      if (role.id !== 'nova' && role.id !== 'marco' && eligibleClients.length === 0) {
        console.log(`🧠 [AUTONOMOUS-GEN] [${role.name}] No eligible clients, skipping`);
        if (dryRun) {
          simulationRoles.push({
            roleId: role.id,
            roleName: role.name,
            skipped: true,
            skipReason: 'Nessun cliente idoneo disponibile',
            dataAnalyzed: { totalClients: clients.length, eligibleClients: 0, clientsWithPendingTasks: clientsWithPendingTasks.size, clientsWithRecentCompletion: clientsWithRecentCompletion.size, clientsList: [], roleSpecificData: {} },
            promptSent: '',
            aiResponse: null,
            providerUsed: providerName,
            modelUsed: providerModel,
          });
        }
        continue;
      }

      const channelRequired = role.preferredChannels[0];
      if (channelRequired && channelRequired !== 'none' && settings.channels_enabled && !settings.channels_enabled[channelRequired]) {
        console.log(`🧠 [AUTONOMOUS-GEN] [${role.name}] Channel "${channelRequired}" disabled, skipping`);
        if (dryRun) {
          simulationRoles.push({
            roleId: role.id,
            roleName: role.name,
            skipped: true,
            skipReason: `Il canale "${channelRequired}" è disabilitato nelle impostazioni`,
            dataAnalyzed: { totalClients: clients.length, eligibleClients: eligibleClients.length, clientsWithPendingTasks: clientsWithPendingTasks.size, clientsWithRecentCompletion: clientsWithRecentCompletion.size, clientsList, roleSpecificData: {} },
            promptSent: '',
            aiResponse: null,
            providerUsed: providerName,
            modelUsed: providerModel,
          });
        } else {
          await logActivity(consultantId, {
            event_type: 'autonomous_analysis',
            title: `${role.name}: canale disabilitato`,
            description: `Il ruolo ${role.name} richiede il canale "${channelRequired}" che è disabilitato nelle impostazioni.`,
            icon: '⏭️',
            severity: 'info',
            ai_role: role.id,
            cycle_id: cycleId,
          });
        }
        continue;
      }

      const configuredFrequencyMinutes = parseInt(roleFrequencies[role.id] || '30', 10);
      if (!dryRun && role.id !== 'marco') {
        const lastRunResult = await db.execute(sql`
          SELECT created_at FROM ai_activity_log
          WHERE consultant_id::text = ${cId}
            AND ai_role = ${role.id}
            AND event_type = 'autonomous_analysis'
            AND title NOT LIKE '%canale disabilitato%'
            AND title NOT LIKE '%frequenza non raggiunta%'
            AND title NOT LIKE '%nessun cliente idoneo%'
          ORDER BY created_at DESC
          LIMIT 1
        `);
        const lastRunRow = lastRunResult.rows[0] as any;
        if (lastRunRow?.created_at) {
          const lastRunTime = new Date(lastRunRow.created_at);
          const minutesSinceLastRun = (Date.now() - lastRunTime.getTime()) / (1000 * 60);
          if (minutesSinceLastRun < configuredFrequencyMinutes) {
            const remainingMinutes = Math.ceil(configuredFrequencyMinutes - minutesSinceLastRun);
            console.log(`🧠 [AUTONOMOUS-GEN] [${role.name}] Frequency not reached (${configuredFrequencyMinutes}min configured, last run ${Math.round(minutesSinceLastRun)}min ago, next in ~${remainingMinutes}min), skipping`);
            continue;
          }
        }
      }

      console.log(`🧠 [AUTONOMOUS-GEN] [${role.name}] Fetching role-specific data...`);
      let roleData: Record<string, any>;
      try {
        roleData = await role.fetchRoleData(consultantId, clientIds);
        console.log(`🧠 [AUTONOMOUS-GEN] [${role.name}] Role data fetched OK (keys: ${Object.keys(roleData).join(', ')})`);
      } catch (fetchErr: any) {
        console.error(`❌ [AUTONOMOUS-GEN] [${role.name}] fetchRoleData FAILED: ${fetchErr.message}`);
        throw fetchErr;
      }

      let prompt = role.buildPrompt({
        clientsList,
        roleData,
        settings,
        romeTimeStr,
        recentCompletedTasks: recentTasksSummary,
        recentAllTasks: recentAllTasksSummary,
        permanentBlocks,
      });

      // Inject system prompt documents and KB assignments for this agent
      try {
        const agentSystemDocs = await fetchSystemDocumentsForAgent(consultantId, role.id);
        if (agentSystemDocs) {
          prompt = prompt + '\n\n' + agentSystemDocs;
          console.log(`📌 [AUTONOMOUS-GEN] [${role.name}] Injected system docs into prompt`);
        }
      } catch (sysDocErr: any) {
        console.warn(`⚠️ [AUTONOMOUS-GEN] [${role.name}] Error fetching system docs: ${sysDocErr.message}`);
      }

      let agentFileSearchTool: any = null;
      if (roleData.fileSearchStoreNames?.length > 0) {
        try {
          const fileSearchService = new FileSearchService();
          agentFileSearchTool = fileSearchService.buildFileSearchTool(roleData.fileSearchStoreNames);
          if (agentFileSearchTool) {
            console.log(`🧠 [AUTONOMOUS-GEN] [${role.name}] File Search enabled with ${roleData.fileSearchStoreNames.length} stores`);
          }
        } catch (err: any) {
          console.warn(`⚠️ [AUTONOMOUS-GEN] [${role.name}] Failed to build file search tool: ${err.message}`);
        }
      }

      console.log(`🧠 [AUTONOMOUS-GEN] [${role.name}] Calling Gemini (${providerName}, ${providerModel})...`);

      let responseText: string | undefined;
      for (let attempt = 0; attempt <= 2; attempt++) {
        try {
          const response = await aiClient!.generateContent({
            model: providerModel,
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.3,
              maxOutputTokens: 4096,
              responseMimeType: 'application/json',
            },
            ...(agentFileSearchTool ? { tools: [agentFileSearchTool] } : {}),
          });
          responseText = response.response.text();
          break;
        } catch (retryErr: any) {
          const isRetryable = retryErr.message?.includes('503') || retryErr.message?.includes('overloaded') || retryErr.message?.includes('UNAVAILABLE') || retryErr.status === 503;
          if (isRetryable && attempt < 2) {
            const delay = Math.min(1000 * Math.pow(2, attempt), 8000);
            console.warn(`⚠️ [AUTONOMOUS-GEN] [${role.name}] Retry ${attempt + 1}/2 after ${delay}ms: ${retryErr.message}`);
            await new Promise(r => setTimeout(r, delay));
            continue;
          }
          throw retryErr;
        }
      }
      if (!responseText) {
        console.error(`❌ [AUTONOMOUS-GEN] [${role.name}] Empty response from Gemini`);
        continue;
      }

      let parsed: { tasks: AutonomousSuggestedTask[], overall_reasoning?: string };
      try {
        parsed = JSON.parse(responseText);
      } catch {
        let cleaned = responseText.trim();
        if (cleaned.startsWith('```json')) cleaned = cleaned.slice(7);
        if (cleaned.startsWith('```')) cleaned = cleaned.slice(3);
        if (cleaned.endsWith('```')) cleaned = cleaned.slice(0, -3);
        cleaned = cleaned.trim();

        try {
          parsed = JSON.parse(cleaned);
        } catch {
          const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            try {
              parsed = JSON.parse(jsonMatch[0]);
            } catch {
              try {
                const fixed = jsonMatch[0].replace(/,\s*([}\]])/g, '$1');
                parsed = JSON.parse(fixed);
              } catch {
                console.error(`❌ [AUTONOMOUS-GEN] [${role.name}] Could not parse Gemini JSON response`);
                console.error(`❌ [AUTONOMOUS-GEN] [${role.name}] Raw response (first 500 chars): ${responseText.substring(0, 500)}`);
                continue;
              }
            }
          } else {
            const arrayMatch = cleaned.match(/\[[\s\S]*\]/);
            if (arrayMatch) {
              try {
                const arr = JSON.parse(arrayMatch[0]);
                parsed = { tasks: Array.isArray(arr) ? arr : [] };
              } catch {
                console.error(`❌ [AUTONOMOUS-GEN] [${role.name}] Could not parse Gemini response`);
                console.error(`❌ [AUTONOMOUS-GEN] [${role.name}] Raw response (first 500 chars): ${responseText.substring(0, 500)}`);
                continue;
              }
            } else {
              console.error(`❌ [AUTONOMOUS-GEN] [${role.name}] Could not parse Gemini response - no JSON found`);
              console.error(`❌ [AUTONOMOUS-GEN] [${role.name}] Raw response (first 500 chars): ${responseText.substring(0, 500)}`);
              continue;
            }
          }
        }
      }

      if (!parsed.tasks) {
        if (Array.isArray((parsed as any).suggestions)) {
          parsed = { ...parsed, tasks: (parsed as any).suggestions };
        } else {
          parsed = { ...parsed, tasks: [] };
        }
      }

      if (!dryRun) {
        await logActivity(consultantId, {
          event_type: 'autonomous_analysis',
          title: `${role.name}: ${parsed.tasks?.length || 0} task suggeriti`,
          description: parsed.overall_reasoning || 
            (parsed.tasks && parsed.tasks.length > 0
              ? `${role.name} ha analizzato i dati e suggerito ${parsed.tasks.length} task.`
              : `${role.name} ha analizzato i dati ma non ha identificato task necessari.`),
          icon: '🤖',
          severity: 'info',
          ai_role: role.id,
          cycle_id: cycleId,
          event_data: {
            role_name: role.name,
            overall_reasoning: parsed.overall_reasoning || null,
            tasks_suggested: parsed.tasks?.length || 0,
            suggestions: (parsed.tasks || []).map(t => ({
              client_name: t.contact_name,
              category: t.task_category,
              instruction: t.ai_instruction?.substring(0, 150),
              reasoning: t.reasoning,
              channel: t.preferred_channel,
              priority: t.priority,
            })),
            clients_list: clientsList.slice(0, 20),
            role_specific_data: roleData,
            excluded_clients: {
              with_pending_tasks: clientsWithPendingTasks.size,
              with_recent_completion: clientsWithRecentCompletion.size,
            },
            recent_tasks_summary: recentTasksSummary.slice(0, 10),
            total_clients: clients.length,
            eligible_clients: eligibleClients.length,
          },
        });
      }

      const tasksToProcess = (parsed.tasks && Array.isArray(parsed.tasks)) ? parsed.tasks.slice(0, role.maxTasksPerRun) : [];

      if (dryRun) {
        const tasksWouldCreate = tasksToProcess
          .filter(t => t.ai_instruction)
          .filter(t => !(t.contact_id && (clientsWithPendingTasks.has(t.contact_id) || clientsWithRecentCompletion.has(t.contact_id))))
          .filter(t => {
            if (!t.contact_id || permanentBlocks.length === 0) return true;
            return !permanentBlocks.some(b => {
              if (b.contactId !== t.contact_id) return false;
              if (b.role && b.role !== role.id) return false;
              if (b.category && b.category !== (t.task_category || role.categories[0])) return false;
              return true;
            });
          })
          .map(t => ({
            contactName: t.contact_name || 'N/A',
            contactId: t.contact_id || null,
            category: t.task_category || role.categories[0] || 'followup',
            instruction: t.ai_instruction,
            reasoning: t.reasoning || '',
            channel: t.preferred_channel || role.preferredChannels[0] || 'none',
            priority: Math.min(Math.max(t.priority || 3, 1), 4),
            urgency: t.urgency || 'normale',
            wouldBeStatus: taskStatus,
          }));

        simulationRoles.push({
          roleId: role.id,
          roleName: role.name,
          skipped: false,
          dataAnalyzed: {
            totalClients: clients.length,
            eligibleClients: eligibleClients.length,
            clientsWithPendingTasks: clientsWithPendingTasks.size,
            clientsWithRecentCompletion: clientsWithRecentCompletion.size,
            clientsList,
            roleSpecificData: roleData,
          },
          promptSent: prompt,
          aiResponse: {
            raw: responseText || '',
            parsed,
            overallReasoning: parsed.overall_reasoning || '',
            tasksWouldCreate,
          },
          providerUsed: providerName,
          modelUsed: providerModel,
        });

        totalCreated += tasksWouldCreate.length;
      } else {
        if (!parsed.tasks || !Array.isArray(parsed.tasks) || parsed.tasks.length === 0) {
          console.log(`🧠 [AUTONOMOUS-GEN] [${role.name}] No tasks suggested`);
          continue;
        }

        for (const suggestedTask of tasksToProcess) {
          try {
            if (!suggestedTask.ai_instruction) continue;

            if (suggestedTask.contact_id && (clientsWithPendingTasks.has(suggestedTask.contact_id) || clientsWithRecentCompletion.has(suggestedTask.contact_id))) {
              continue;
            }

            if (suggestedTask.contact_id && permanentBlocks.length > 0) {
              const isBlocked = permanentBlocks.some(b => {
                if (b.contactId !== suggestedTask.contact_id) return false;
                if (b.role && b.role !== role.id) return false;
                if (b.category && b.category !== (suggestedTask.task_category || role.categories[0])) return false;
                return true;
              });
              if (isBlocked) {
                console.log(`🚫 [AUTONOMOUS-GEN] [${role.name}] Task for ${suggestedTask.contact_name} blocked by permanent block rule`);
                continue;
              }
            }

            const taskId = `auto_${role.id}_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

            const contactIdValue = suggestedTask.contact_id || null;
            const hasValidContactId = contactIdValue && /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(contactIdValue);

            await db.execute(sql`
              INSERT INTO ai_scheduled_tasks (
                id, consultant_id, contact_name, contact_phone, task_type,
                ai_instruction, scheduled_at, timezone, status,
                origin_type, task_category, contact_id, ai_reasoning,
                priority, preferred_channel, tone, urgency,
                max_attempts, recurrence_type, ai_role
              ) VALUES (
                ${taskId}, ${sql.raw(`'${consultantId}'::uuid`)}, ${suggestedTask.contact_name || null},
                ${suggestedTask.contact_phone || 'N/A'}, 'ai_task',
                ${suggestedTask.ai_instruction}, ${scheduledAt}, 'Europe/Rome',
                ${taskStatus}, 'autonomous',
                ${suggestedTask.task_category || role.categories[0] || 'followup'},
                ${hasValidContactId ? sql`${contactIdValue}::text::uuid` : sql`NULL`},
                ${suggestedTask.reasoning || null},
                ${Math.min(Math.max(suggestedTask.priority || 3, 1), 4)},
                ${suggestedTask.preferred_channel || role.preferredChannels[0] || 'none'},
                ${suggestedTask.tone || 'professionale'},
                ${suggestedTask.urgency || 'normale'},
                1, 'once', ${role.id}
              )
            `);

            await logActivity(consultantId, {
              event_type: 'autonomous_task_created',
              title: `[${role.name}] Task creato: ${suggestedTask.ai_instruction?.substring(0, 55) || 'Task AI'}`,
              description: suggestedTask.reasoning || `Task generato da ${role.name}`,
              icon: '🤖',
              severity: 'info',
              task_id: taskId,
              contact_name: suggestedTask.contact_name,
              contact_id: suggestedTask.contact_id,
              ai_role: role.id,
              cycle_id: cycleId,
              event_data: {
                task_category: suggestedTask.task_category,
                priority: suggestedTask.priority,
                preferred_channel: suggestedTask.preferred_channel,
                autonomy_level: settings.autonomy_level,
                role_name: role.name,
              },
            });

            if (suggestedTask.contact_id) {
              clientsWithPendingTasks.add(suggestedTask.contact_id);
            }
            totalCreated++;

            console.log(`✅ [AUTONOMOUS-GEN] [${role.name}] Created task ${taskId} for ${suggestedTask.contact_name} (${suggestedTask.task_category})`);
          } catch (error: any) {
            console.error(`❌ [AUTONOMOUS-GEN] [${role.name}] Failed to create task for ${suggestedTask.contact_name}:`, error.message);
          }
        }
      }
    } catch (error: any) {
      console.error(`❌ [AUTONOMOUS-GEN] [${role.name}] Error:`, error.message);
      if (dryRun) {
        simulationRoles.push({
          roleId: role.id,
          roleName: role.name,
          skipped: false,
          dataAnalyzed: { totalClients: clients?.length || 0, eligibleClients: 0, clientsWithPendingTasks: clientsWithPendingTasks.size, clientsWithRecentCompletion: clientsWithRecentCompletion.size, clientsList: [], roleSpecificData: {} },
          promptSent: '',
          aiResponse: null,
          error: error.message,
          providerUsed: providerName,
          modelUsed: providerModel,
        });
      } else {
        await logActivity(consultantId, {
          event_type: 'autonomous_analysis',
          title: `${role.name}: errore durante l'analisi`,
          description: error.message,
          icon: '❌',
          severity: 'error',
          ai_role: role.id,
          cycle_id: cycleId,
        });
      }
    }
  }

  console.log(`🧠 [AUTONOMOUS-GEN] Total: ${totalCreated} tasks ${dryRun ? 'would be' : ''} created across ${activeRoles.length} roles for consultant ${consultantId}`);

  if (dryRun) {
    return {
      consultantId,
      simulatedAt: new Date().toISOString(),
      totalRolesAnalyzed: simulationRoles.length,
      totalTasksWouldCreate: totalCreated,
      providerName,
      modelName: providerModel,
      settings: {
        autonomyLevel: settings.autonomy_level,
        isActive: settings.is_active,
        workingHoursStart: settings.working_hours_start,
        workingHoursEnd: settings.working_hours_end,
      },
      roles: simulationRoles,
    } as SimulationResult;
  }

  return totalCreated;
}

function computeNextWorkingSlot(settings: { working_hours_start: string; working_hours_end: string; working_days: number[] }): Date {
  const now = new Date();
  const romeNow = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Rome' }));

  const [startH, startM] = settings.working_hours_start.split(':').map(Number);
  const [endH, endM] = settings.working_hours_end.split(':').map(Number);

  const currentHour = romeNow.getHours();
  const currentMinute = romeNow.getMinutes();
  const currentDay = romeNow.getDay() === 0 ? 7 : romeNow.getDay();

  const currentMinutes = currentHour * 60 + currentMinute;
  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;

  if (settings.working_days.includes(currentDay) && currentMinutes >= startMinutes && currentMinutes < endMinutes - 30) {
    const offset = Math.floor(Math.random() * 30) + 10;
    return new Date(now.getTime() + offset * 60 * 1000);
  }

  const result = new Date(now);
  for (let dayOffset = 0; dayOffset <= 7; dayOffset++) {
    const candidate = new Date(result.getTime() + dayOffset * 24 * 60 * 60 * 1000);
    const candidateDay = candidate.getDay() === 0 ? 7 : candidate.getDay();
    if (settings.working_days.includes(candidateDay)) {
      candidate.setHours(startH, startM + Math.floor(Math.random() * 30) + 10, 0, 0);
      if (candidate > now) {
        return candidate;
      }
    }
  }

  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  tomorrow.setHours(startH, startM + 15, 0, 0);
  return tomorrow;
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
  
  // Run autonomous task generation every 30 minutes
  cron.schedule('*/30 * * * *', async () => {
    try {
      await runAutonomousTaskGeneration();
    } catch (error: any) {
      console.error('❌ [AUTONOMOUS-GEN] Cron error:', error.message);
    }
  }, {
    timezone: 'Europe/Rome'
  });
  
  console.log('✅ [AI-SCHEDULER] AI Task Scheduler started (runs every minute)');
  console.log('✅ [AUTONOMOUS-GEN] Autonomous Task Generation started (runs every 30 minutes)');
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

export async function triggerAutonomousGenerationForConsultant(consultantId: string): Promise<{ tasksGenerated: number; error?: string }> {
  try {
    const tasksGenerated = await generateTasksForConsultant(consultantId) as number;
    return { tasksGenerated };
  } catch (error: any) {
    console.error(`❌ [AUTONOMOUS-GEN] Manual trigger error for ${consultantId}:`, error.message);
    return { tasksGenerated: 0, error: error.message };
  }
}

export async function simulateTaskGenerationForConsultant(consultantId: string): Promise<SimulationResult> {
  return generateTasksForConsultant(consultantId, { dryRun: true }) as Promise<SimulationResult>;
}
