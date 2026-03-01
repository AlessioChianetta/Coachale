/**
 * AI Task Scheduler CRON Job — BUILD 20260228_0330
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
import { checkOutreachSafety } from '../services/outreach-safety-guard';
import { generateExecutionPlan, canExecuteAutonomously, canExecuteManually, type ExecutionStep, isWithinWorkingHours, isRoleWithinWorkingHours, getTaskStatusForRole, getAutonomySettings, getEffectiveRoleLevel, canRoleAutoCall } from '../ai/autonomous-decision-engine';
import { executeStep, type AITaskInfo } from '../ai/ai-task-executor';
import { getAIProvider, getModelForProviderName, getGeminiApiKeyForClassifier, GEMINI_3_MODEL, trackedGenerateContent, type GeminiClient } from '../ai/provider-factory';
import { GoogleGenAI } from '@google/genai';
import { FileSearchService } from '../ai/file-search-service';
import { fetchSystemDocumentsForAgent } from '../services/system-prompt-documents-service';
import { emitReasoningEvent } from '../sse/reasoning-stream';

function isDuplicateTask(newInstruction: string, existingInstruction: string, newContactId?: string, existingContactId?: string): { isDuplicate: boolean; similarity: number; reason: string } {
  if (newContactId && existingContactId && newContactId !== existingContactId) {
    return { isDuplicate: false, similarity: 0, reason: '' };
  }

  const stopWords = new Set(['che', 'per', 'con', 'del', 'della', 'delle', 'dei', 'degli', 'una', 'uno', 'sono', 'come', 'questo', 'questa', 'anche', 'loro', 'più', 'alla', 'alle', 'allo', 'agli', 'nella', 'nelle', 'nello', 'negli', 'dalla', 'dalle', 'dallo', 'dagli', 'sulla', 'sulle', 'sullo', 'sugli', 'cliente', 'task', 'email', 'chiamata', 'contatto', 'messaggio', 'inviare', 'creare', 'fare']);

  const extractKeywords = (text: string): Set<string> => {
    return new Set(
      text.toLowerCase()
        .replace(/[^\w\sàèéìòù]/g, ' ')
        .split(/\s+/)
        .filter(w => w.length > 3 && !stopWords.has(w))
    );
  };

  const newKw = extractKeywords(newInstruction);
  const existKw = extractKeywords(existingInstruction);

  if (newKw.size === 0 || existKw.size === 0) {
    return { isDuplicate: false, similarity: 0, reason: '' };
  }

  const intersection = new Set([...newKw].filter(k => existKw.has(k)));
  const union = new Set([...newKw, ...existKw]);
  const similarity = intersection.size / union.size;

  const sameContact = newContactId && existingContactId && newContactId === existingContactId;
  const threshold = sameContact ? 0.35 : 0.55;

  if (similarity >= threshold) {
    return {
      isDuplicate: true,
      similarity,
      reason: `Keyword overlap ${(similarity * 100).toFixed(0)}% con task esistente (${sameContact ? 'stesso cliente' : 'cliente diverso'}). Keywords comuni: ${[...intersection].slice(0, 5).join(', ')}`
    };
  }

  return { isDuplicate: false, similarity, reason: '' };
}

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
  ai_role?: string | null;
  preferred_channel?: string | null;
  tone?: string | null;
  urgency?: string | null;
  scheduled_datetime?: string | null;
  additional_context?: string | null;
  objective?: string | null;
  whatsapp_config_id?: string | null;
  language?: string | null;
  voice_template_suggestion?: string | null;
}

/**
 * Process pending AI tasks
 */
async function processAITasks(): Promise<void> {
  const result = await withCronLock(CRON_JOB_NAME, async () => {
    console.log('🤖 [AI-SCHEDULER] ══════ STEP 1: Starting task processing cycle ══════');
    
    const approvedMoveResult = await db.execute(sql`
      UPDATE ai_scheduled_tasks 
      SET status = 'scheduled',
          result_data = COALESCE(result_data, '{}'::jsonb) || '{"from_approval": true}'::jsonb,
          updated_at = NOW()
      WHERE status = 'approved' AND scheduled_at <= NOW()
      RETURNING id, ai_role, task_type
    `);
    if (approvedMoveResult.rows.length > 0) {
      console.log(`🤖 [AI-SCHEDULER] STEP 1: Moved ${approvedMoveResult.rows.length} approved→scheduled:`, approvedMoveResult.rows.map((r: any) => `${r.id}(${r.ai_role},${r.task_type})`));
    } else {
      console.log('🤖 [AI-SCHEDULER] STEP 1: No approved tasks to move');
    }

    const deferredMoveResult = await db.execute(sql`
      UPDATE ai_scheduled_tasks
      SET status = 'waiting_approval', updated_at = NOW()
      WHERE status = 'deferred' AND scheduled_at <= NOW()
      RETURNING id, ai_role, task_type, consultant_id, ai_instruction, contact_name, task_category
    `);
    if (deferredMoveResult.rows.length > 0) {
      console.log(`🤖 [AI-SCHEDULER] STEP 1b: Re-queued ${deferredMoveResult.rows.length} deferred→waiting_approval:`, deferredMoveResult.rows.map((r: any) => `${r.id}(${r.ai_role})`));
      for (const dTask of deferredMoveResult.rows as any[]) {
        void import("../telegram/telegram-service").then(({ notifyTaskViaTelegram }) =>
          notifyTaskViaTelegram(dTask.consultant_id, dTask.ai_role || 'personalizza', 'waiting_approval', {
            taskId: dTask.id,
            instruction: dTask.ai_instruction,
            contactName: dTask.contact_name,
            taskCategory: dTask.task_category,
          })
        ).catch(() => {});
      }
    }

    const zombieResult = await db.execute(sql`
      UPDATE ai_scheduled_tasks 
      SET status = 'scheduled',
          scheduled_at = NOW() + interval '30 seconds',
          started_at = NULL,
          current_attempt = LEAST(current_attempt + 1, max_attempts),
          result_summary = 'Task bloccato in esecuzione - riprogrammato automaticamente',
          result_data = COALESCE(result_data, '{}'::jsonb) || '{"zombie_recovered": true}'::jsonb,
          updated_at = NOW()
      WHERE status = 'in_progress' 
        AND updated_at < NOW() - interval '10 minutes'
        AND current_attempt < max_attempts
      RETURNING id, ai_role, current_attempt, max_attempts
    `);
    if (zombieResult.rows.length > 0) {
      console.log(`🧟 [AI-SCHEDULER] Recovered ${zombieResult.rows.length} zombie tasks (stuck in_progress >10min):`);
      zombieResult.rows.forEach((r: any) => {
        console.log(`   🔄 ${r.id} (${r.ai_role}) - attempt ${r.current_attempt}/${r.max_attempts}`);
      });
    }

    const zombieFailedResult = await db.execute(sql`
      UPDATE ai_scheduled_tasks 
      SET status = 'failed',
          result_summary = 'Task bloccato in esecuzione troppo a lungo - tentativi esauriti',
          error_message = 'Zombie task: stuck in in_progress state, max attempts reached',
          completed_at = NOW(),
          updated_at = NOW()
      WHERE status = 'in_progress' 
        AND updated_at < NOW() - interval '10 minutes'
        AND current_attempt >= max_attempts
      RETURNING id, ai_role
    `);
    if (zombieFailedResult.rows.length > 0) {
      console.log(`💀 [AI-SCHEDULER] Failed ${zombieFailedResult.rows.length} zombie tasks (max attempts reached):`);
      zombieFailedResult.rows.forEach((r: any) => {
        console.log(`   ❌ ${r.id} (${r.ai_role})`);
      });
    }

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
      console.log('🤖 [AI-SCHEDULER] STEP 2: No tasks to process');
      return { processed: 0 };
    }
    
    console.log(`🤖 [AI-SCHEDULER] ══════ STEP 2: Found ${tasks.length} tasks to process ══════`);
    tasks.forEach((t: any, i: number) => {
      console.log(`   📋 Task ${i+1}: id=${t.id}, task_type=${t.task_type}, ai_role=${t.ai_role}, status=${t.status}, result_data=${JSON.stringify(t.result_data)}`);
    });
    
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
  const attemptNumber = task.current_attempt + 1;
  
  const taskType = task.task_type || (task as any).taskType || '';
  const channel = task.preferred_channel || (task as any).preferredChannel || '';
  const aiRole = task.ai_role || (task as any).aiRole || '';

  console.log(`🤖 [AI-SCHEDULER] ══════ STEP 3: executeTask ══════`);
  console.log(`   📋 id=${task.id}, task_type="${taskType}", preferred_channel="${channel}", ai_role="${aiRole}", attempt=${attemptNumber}/${task.max_attempts}`);
  console.log(`   📋 contact=${task.contact_phone || task.contact_name || 'N/A'}, result_data=${JSON.stringify(task.result_data)}`);
  console.log(`   📋 RAW KEYS: ${JSON.stringify(Object.keys(task))}`);
  
  console.log(`🤖 [AI-SCHEDULER] STEP 3a: Setting status to in_progress...`);
  await db.execute(sql`
    UPDATE ai_scheduled_tasks 
    SET status = 'in_progress',
        current_attempt = ${attemptNumber},
        last_attempt_at = NOW(),
        updated_at = NOW()
    WHERE id = ${task.id}
  `);
  
  const updatedTask = { ...task, current_attempt: attemptNumber };
  
  try {
    if (aiRole === 'hunter' && ['voice', 'whatsapp', 'email'].includes(channel) && channel !== 'lead_crm') {
      const fromApproval = task.result_data && typeof task.result_data === 'object' && (task.result_data as any).from_approval === true;
      const skipGuardrails = task.result_data && typeof task.result_data === 'object' && (task.result_data as any).skip_guardrails === true;
      if (!fromApproval && !skipGuardrails) {
        const safetyCfgResult = await db.execute(sql`SELECT outreach_config FROM ai_autonomy_settings WHERE consultant_id::text = ${task.consultant_id}::text LIMIT 1`);
        const safetyCfg = (safetyCfgResult.rows[0] as any)?.outreach_config || {};
        const hunterModeSafety = safetyCfg.hunter_mode ?? 'approval';
        if (hunterModeSafety === 'approval') {
          console.warn(`🚨 [SAFETY-BLOCK] Hunter outreach task ${task.id} (channel=${channel}) blocked — hunter_mode=approval but no from_approval flag. Re-queuing as waiting_approval.`);
          await db.execute(sql`UPDATE ai_scheduled_tasks SET status='waiting_approval', result_summary='[SAFETY-BLOCK] Task rimesso in attesa di approvazione (mancava from_approval)', updated_at=NOW() WHERE id=${task.id}`);
          return;
        }
      }
    }

    if (channel === 'lead_crm' || taskType === 'crm_lead_outreach') {
      console.log(`🤖 [AI-SCHEDULER] STEP 3b: lead_crm/crm_lead_outreach → handleCrmLeadOutreach`);
      await handleCrmLeadOutreach(updatedTask);
      return;
    }

    if (taskType === 'ai_task' && task.result_data && typeof task.result_data === 'object' && (task.result_data as any).crmLeadOutreach === true && (task.result_data as any).parent_crm_outreach_task) {
      console.log(`🎯 [CRM-DIRECT-ROUTE] Sub-task CRM outreach → direct ${channel} handler (bypassing Decision Engine)`);
      if (channel === 'voice') {
        const callResult = await initiateVoiceCall(updatedTask);
        if (callResult.success) {
          await handleSuccess(updatedTask, callResult);
        } else {
          await handleFailure(updatedTask, callResult.reason || 'Errore chiamata CRM outreach');
        }
        return;
      }
      if (channel === 'whatsapp') {
        await executeSingleWhatsApp(updatedTask);
        return;
      }
      if (channel === 'email') {
        await executeSingleEmail(updatedTask);
        return;
      }
      console.warn(`🎯 [CRM-DIRECT-ROUTE] Unknown channel "${channel}" for CRM outreach task ${task.id}, falling through`);
    }

    if (taskType === 'ai_task' && channel === 'email' && aiRole === 'hunter') {
      const skipGuardrails = task.result_data && typeof task.result_data === 'object' && (task.result_data as any).skip_guardrails === true;
      if (skipGuardrails) {
        console.log(`🤖 [AI-SCHEDULER] STEP 3b: Hunter email (manually approved) → direct send`);
        await executeSingleEmail(updatedTask);
        return;
      }
    }

    if (taskType === 'ai_task') {
      console.log(`🤖 [AI-SCHEDULER] STEP 3b: task_type=ai_task → calling executeAutonomousTask`);
      await executeAutonomousTask(updatedTask);
      return;
    }

    if (taskType === 'single_whatsapp' || (channel === 'whatsapp' && taskType !== 'ai_task')) {
      console.log(`🤖 [AI-SCHEDULER] STEP 3b: task_type=${taskType}, channel=${channel} → direct WA send`);
      await executeSingleWhatsApp(updatedTask);
      return;
    }

    if (taskType === 'single_call' || channel === 'voice') {
      console.log(`🤖 [AI-SCHEDULER] STEP 3b: task_type=${taskType}, channel=${channel} → calling initiateVoiceCall`);
      const callSuccess = await initiateVoiceCall(updatedTask);
      if (callSuccess.success) {
        await handleSuccess(updatedTask, callSuccess);
      } else {
        await handleFailure(updatedTask, callSuccess.reason || 'Unknown error');
      }
      return;
    }

    if (channel === 'email' && aiRole === 'hunter') {
      console.log(`🤖 [AI-SCHEDULER] STEP 3b: Fallback email handler for channel=${channel} → direct email send`);
      await executeSingleEmail(updatedTask);
      return;
    }

    console.error(`🤖 [AI-SCHEDULER] STEP 3b: UNKNOWN task_type="${taskType}" channel="${channel}" — falling back to voice call`);
    const callSuccess = await initiateVoiceCall(updatedTask);
    if (callSuccess.success) {
      await handleSuccess(updatedTask, callSuccess);
    } else {
      await handleFailure(updatedTask, callSuccess.reason || 'Unknown error');
    }
  } catch (error: any) {
    console.error(`❌ [AI-SCHEDULER] STEP 3 ERROR: ${error.message}`);
    await handleFailure(updatedTask, error.message);
  }
}

function selectBestPhone(lead: any, websiteData: any, forWhatsApp: boolean): string | null {
  const mainPhone = lead.phone || null;
  const wdPhones: string[] = (websiteData.phones || []).filter((p: string) => p && p.trim());
  const allPhones = [mainPhone, ...wdPhones].filter(Boolean) as string[];
  if (allPhones.length === 0) return null;

  if (forWhatsApp) {
    const mobileRegex = /^(\+?39\s?)?3\d{2}/;
    const mobile = allPhones.find(p => mobileRegex.test(p.replace(/[\s\-().]/g, '')));
    if (mobile) return mobile;
    return allPhones[0];
  }

  return mainPhone || allPhones[0];
}

function selectBestEmail(lead: any, websiteData: any): string | null {
  const genericPrefixes = ['info', 'noreply', 'no-reply', 'admin', 'contatti', 'segreteria', 'postmaster', 'webmaster', 'support', 'help', 'contact', 'sales'];
  const mainEmail = lead.email || null;
  const wdEmails: string[] = (websiteData.emails || []).filter((e: string) => e && e.trim());
  const allEmails = [...new Set([mainEmail, ...wdEmails].filter(Boolean) as string[])];
  if (allEmails.length === 0) return null;

  const isGeneric = (email: string) => {
    const prefix = email.split('@')[0].toLowerCase();
    return genericPrefixes.some(gp => prefix === gp || prefix.startsWith(gp + '.'));
  };

  const nonGeneric = allEmails.filter(e => !isGeneric(e));
  return nonGeneric.length > 0 ? nonGeneric[0] : allEmails[0];
}

export async function handleCrmLeadOutreach(task: AIScheduledTask): Promise<void> {
  const LOG = '🎯 [CRM-LEAD-OUTREACH]';
  const instruction = task.ai_instruction || '';

  const leadIdMatch = instruction.match(/LEAD_ID:\s*([^\n]+)/i);
  const leadId = leadIdMatch ? leadIdMatch[1].trim() : null;

  if (!leadId) {
    console.error(`${LOG} No LEAD_ID found in instruction for task ${task.id}`);
    await db.execute(sql`UPDATE ai_scheduled_tasks SET status='failed', result_summary='LEAD_ID mancante nell\'istruzione', updated_at=NOW() WHERE id=${task.id}`);
    return;
  }

  console.log(`${LOG} Processing lead ${leadId} for task ${task.id}`);

  const leadResult = await db.execute(sql`
    SELECT lr.*, ls.consultant_id as ls_consultant_id
    FROM lead_scraper_results lr
    JOIN lead_scraper_searches ls ON lr.search_id = ls.id
    WHERE lr.id = ${leadId} AND ls.consultant_id = ${task.consultant_id}
    LIMIT 1
  `);

  if (leadResult.rows.length === 0) {
    console.error(`${LOG} Lead ${leadId} not found for consultant ${task.consultant_id}`);
    await db.execute(sql`UPDATE ai_scheduled_tasks SET status='failed', result_summary='Lead non trovato nel CRM', updated_at=NOW() WHERE id=${task.id}`);
    return;
  }

  const lead = leadResult.rows[0] as any;
  const wd = (typeof lead.website_data === 'string' ? JSON.parse(lead.website_data) : lead.website_data) || {};
  const leadName = lead.business_name || 'Lead sconosciuto';

  const settingsResult = await db.execute(sql`
    SELECT outreach_config FROM ai_autonomy_settings WHERE consultant_id::text = ${task.consultant_id}::text LIMIT 1
  `);
  const outreachConfig = (settingsResult.rows[0] as any)?.outreach_config || {};
  const whatsappConfigId = outreachConfig.whatsapp_config_id ?? outreachConfig.whatsappConfigId ?? null;
  const voiceTemplateId = outreachConfig.voice_template_id ?? outreachConfig.voiceTemplateId ?? null;
  const emailAccountId = outreachConfig.email_account_id ?? outreachConfig.emailAccountId ?? null;
  const hunterMode = outreachConfig.hunter_mode ?? 'approval';
  const outreachStatus = hunterMode === 'autonomous' ? 'scheduled' : 'waiting_approval';
  const safetyCooldown = outreachConfig.cooldown_hours ?? 24;

  let whatsappConfigActive = false;
  if (whatsappConfigId) {
    try {
      const waResult = await db.execute(sql`SELECT id FROM consultant_whatsapp_config WHERE id=${whatsappConfigId} AND is_active=true LIMIT 1`);
      whatsappConfigActive = waResult.rows.length > 0;
    } catch {}
  }

  const autonomySettings = await getAutonomySettings(task.consultant_id);
  const channelsEnabled = autonomySettings.channels_enabled || {};

  const phoneForVoice = selectBestPhone(lead, wd, false);
  const phoneForWA = selectBestPhone(lead, wd, true);
  const emailForOutreach = selectBestEmail(lead, wd);

  const availableChannels: { channel: string; contactValue: string; configId: string | null }[] = [];

  if (phoneForVoice && channelsEnabled.voice && voiceTemplateId) {
    availableChannels.push({ channel: 'voice', contactValue: phoneForVoice, configId: voiceTemplateId });
  }
  if (phoneForWA && channelsEnabled.whatsapp && whatsappConfigActive) {
    availableChannels.push({ channel: 'whatsapp', contactValue: phoneForWA, configId: whatsappConfigId });
  }
  if (emailForOutreach && channelsEnabled.email) {
    availableChannels.push({ channel: 'email', contactValue: emailForOutreach, configId: emailAccountId });
  }

  if (availableChannels.length === 0) {
    console.warn(`${LOG} No valid channels for lead ${leadId} (voicePhone=${!!phoneForVoice}, waPhone=${!!phoneForWA}, email=${!!emailForOutreach})`);
    await db.execute(sql`UPDATE ai_scheduled_tasks SET status='failed', result_summary='Nessun canale disponibile per questo lead (telefono o email mancante, o canali disabilitati)', updated_at=NOW() WHERE id=${task.id}`);
    return;
  }

  console.log(`${LOG} Available channels for ${leadName}: ${availableChannels.map(c => `${c.channel}(${c.contactValue})`).join(', ')}`);

  const { generateOutreachContent, scheduleIndividualOutreach, loadSelectedWaTemplates, titleCaseName } = await import('../routes/ai-autonomy-router');

  const [salesCtxResult, consultantResult, waConfigResult2] = await Promise.all([
    db.execute(sql`
      SELECT services_offered, target_audience, value_proposition, sales_approach,
             competitive_advantages, ideal_client_profile, additional_context
      FROM lead_scraper_sales_context WHERE consultant_id = ${task.consultant_id} LIMIT 1
    `),
    db.execute(sql`SELECT first_name, last_name FROM users WHERE id = ${task.consultant_id} LIMIT 1`),
    db.execute(sql`SELECT business_name, consultant_display_name FROM consultant_whatsapp_config WHERE consultant_id = ${task.consultant_id} AND is_active = true LIMIT 1`),
  ]);
  const salesCtx = (salesCtxResult.rows[0] as any) || {};
  const cRow = consultantResult.rows[0] as any;
  const waConfigRow2 = waConfigResult2.rows[0] as any;
  const consultantName = waConfigRow2?.consultant_display_name || (cRow ? titleCaseName([cRow.first_name, cRow.last_name].filter(Boolean).join(' ')) || 'Consulente' : 'Consulente');
  const consultantBusinessName = waConfigRow2?.business_name || null;

  let resolvedVoiceTemplateName: string | null = null;
  if (voiceTemplateId) {
    try {
      const { getTemplateById } = await import('../voice/voice-templates');
      const tmpl = getTemplateById(voiceTemplateId);
      if (tmpl) resolvedVoiceTemplateName = tmpl.name;
    } catch {}
  }

  const waTemplateSids: string[] = outreachConfig.whatsapp_template_ids || [];
  const loadedWaTemplates = await loadSelectedWaTemplates(task.consultant_id, waTemplateSids);

  const callInstructionTemplate = outreachConfig.call_instruction_template || null;
  const scheduleConfig = { voiceTemplateId, whatsappConfigId, emailAccountId, timezone: task.timezone || 'Europe/Rome', voiceTemplateName: resolvedVoiceTemplateName, callInstructionTemplate, outreachConfig };

  const leadObj = {
    id: leadId, leadId: leadId,
    businessName: leadName, phone: phoneForVoice || phoneForWA || lead.phone,
    email: emailForOutreach || lead.email, website: lead.website,
    address: lead.address, category: lead.category,
    score: lead.ai_compatibility_score,
    salesSummary: lead.ai_sales_summary,
    consultantNotes: lead.lead_notes || '',
  };

  const createdSubTasks: string[] = [];
  const blockedChannels: string[] = [];

  for (let i = 0; i < availableChannels.length; i++) {
    const ch = availableChannels[i];
    const safetyCheck = await checkOutreachSafety(leadId, ch.channel, task.consultant_id, safetyCooldown);
    if (!safetyCheck.allowed) {
      console.warn(`${LOG} Safety check blocked lead ${leadId} channel=${ch.channel}: ${safetyCheck.reason}`);
      blockedChannels.push(`${ch.channel}: ${safetyCheck.reason}`);
      continue;
    }

    try {
      const channelLead = { ...leadObj, phone: ch.contactValue, email: ch.channel === 'email' ? ch.contactValue : leadObj.email };
      const content = await generateOutreachContent(task.consultant_id, channelLead, ch.channel, salesCtx, consultantName, undefined, outreachConfig, loadedWaTemplates, consultantBusinessName);
      const result = await scheduleIndividualOutreach(task.consultant_id, channelLead, ch.channel, content, scheduleConfig, hunterMode === 'autonomous' ? 'autonomous' : 'approval', i);

      if (result.taskId) {
        await db.execute(sql`UPDATE ai_scheduled_tasks SET parent_task_id=${task.id} WHERE id=${result.taskId}`);
        createdSubTasks.push(`${ch.channel}:${result.taskId}`);
        console.log(`${LOG} Created ${ch.channel} sub-task ${result.taskId} for lead ${leadId} (${leadName}) → ${ch.contactValue}`);
      }
    } catch (err: any) {
      if (err.message?.startsWith('SKIP_CHANNEL:')) {
        console.warn(`${LOG} Channel ${ch.channel} skipped for lead ${leadId}: ${err.message}`);
        blockedChannels.push(`${ch.channel}: ${err.message.split(':').slice(2).join(':')}`);
      } else {
        console.error(`${LOG} Failed to create ${ch.channel} sub-task for lead ${leadId}: ${err.message}`);
        blockedChannels.push(`${ch.channel}: errore generazione contenuto`);
      }
    }

    if (i < availableChannels.length - 1) {
      await new Promise(r => setTimeout(r, 1000));
    }
  }

  if (createdSubTasks.length === 0) {
    const reasons = blockedChannels.join('; ');
    await db.execute(sql`UPDATE ai_scheduled_tasks SET status='failed', result_summary=${`[SAFETY-GUARD] Tutti i canali bloccati: ${reasons}`}, updated_at=NOW() WHERE id=${task.id}`);
    return;
  }

  await db.execute(sql`
    UPDATE lead_scraper_results SET lead_status='in_outreach', outreach_task_id=${createdSubTasks[0].split(':')[1]}, lead_next_action=${`Outreach multi-canale da Hunter CRM (${createdSubTasks.map(s => s.split(':')[0]).join(', ')})`}, lead_next_action_date=NOW() + INTERVAL '2 minutes'
    WHERE id=${leadId}
  `);

  const channelsSummary = createdSubTasks.map(s => s.split(':')[0]).join(', ');
  await db.execute(sql`
    INSERT INTO lead_scraper_activities (lead_id, consultant_id, type, title, description, metadata, created_at)
    VALUES (${leadId}, ${task.consultant_id}, 'outreach_assigned', ${`Outreach multi-canale schedulato da Hunter: ${channelsSummary}`}, ${`Hunter ha selezionato questo lead dal CRM per outreach su ${createdSubTasks.length} canali (${channelsSummary}). Score: ${lead.ai_compatibility_score || 'N/A'}/100`}, ${JSON.stringify({ taskIds: createdSubTasks, channels: createdSubTasks.map(s => s.split(':')[0]), score: lead.ai_compatibility_score, assigned_by: 'hunter_crm_autonomous' })}::jsonb, NOW())
  `);

  await logActivity(task.consultant_id, {
    event_type: 'crm_lead_outreach_scheduled',
    title: `🎯 Hunter CRM: ${createdSubTasks.length} canali schedulati per ${leadName}`,
    description: `Hunter ha selezionato autonomamente questo lead CRM (score ${lead.ai_compatibility_score || 'N/A'}/100) e ha schedulato outreach su: ${channelsSummary}${blockedChannels.length > 0 ? `. Bloccati: ${blockedChannels.join(', ')}` : ''}`,
    icon: '🎯',
    severity: 'info',
    task_id: task.id,
  });

  await db.execute(sql`UPDATE ai_scheduled_tasks SET status='completed', result_summary=${`${createdSubTasks.length} canali outreach schedulati per ${leadName} (${channelsSummary})`}, completed_at=NOW(), updated_at=NOW() WHERE id=${task.id}`);
}

async function executeSingleWhatsApp(task: AIScheduledTask): Promise<void> {
  const LOG = '📱 [SINGLE-WA]';
  let additionalContextData: Record<string, any> = {};
  if (task.additional_context) {
    try { additionalContextData = JSON.parse(task.additional_context); } catch {}
  }

  const resolvedPhone = task.contact_phone || '';
  const resolvedName = task.contact_name || additionalContextData.business_name || 'Cliente';
  const messageText = task.ai_instruction || `Buongiorno ${resolvedName}, la contatto per aggiornarla.`;

  if (!resolvedPhone) {
    console.error(`${LOG} No phone number for task ${task.id}, marking failed`);
    await handleFailure(task, 'Numero di telefono mancante');
    return;
  }

  console.log(`${LOG} Sending WA to ${resolvedPhone} (${resolvedName})`);
  console.log(`${LOG} Message (${messageText.length} chars): "${messageText.substring(0, 150)}..."`);
  console.log(`${LOG} Template mode: ${additionalContextData.use_wa_template ? 'YES' : 'NO'}`);

  try {
    const { sendWhatsAppMessage } = await import('../whatsapp/twilio-client');
    const agentOpts = task.whatsapp_config_id ? { agentConfigId: task.whatsapp_config_id } : {};

    let messageSid: string;

    if (additionalContextData.use_wa_template && additionalContextData.wa_template_sid) {
      const contentVariables: Record<string, string> = {};
      if (additionalContextData.wa_template_variables) {
        const vars = additionalContextData.wa_template_variables;
        for (const [k, v] of Object.entries(vars)) {
          contentVariables[k] = String(v);
        }
      }
      if (!contentVariables['1']) contentVariables['1'] = resolvedName;

      console.log(`${LOG} Sending via template ${additionalContextData.wa_template_sid}`);
      messageSid = await sendWhatsAppMessage(
        task.consultant_id,
        resolvedPhone,
        additionalContextData.wa_preview_message || messageText,
        undefined,
        { ...agentOpts, contentSid: additionalContextData.wa_template_sid, contentVariables },
      );
    } else {
      console.log(`${LOG} Sending free-text message`);
      messageSid = await sendWhatsAppMessage(
        task.consultant_id,
        resolvedPhone,
        messageText,
        undefined,
        agentOpts,
      );
    }

    console.log(`${LOG} ✅ Sent! SID: ${messageSid}`);

    await db.execute(sql`
      UPDATE ai_scheduled_tasks
      SET status = 'completed', result_data = ${JSON.stringify({ messageSid, channel: 'whatsapp', sentAt: new Date().toISOString() })}::jsonb, updated_at = NOW()
      WHERE id = ${task.id}
    `);

    await logActivity(task.consultant_id, {
      event_type: 'whatsapp_sent',
      title: `Messaggio WhatsApp inviato a ${resolvedName}`,
      description: `"${messageText.substring(0, 100)}..."`,
      icon: '💬',
      severity: 'info',
      task_id: task.id,
    });

    const leadId = additionalContextData.lead_id;
    if (leadId) {
      await db.execute(sql`
        UPDATE lead_scraper_results
        SET lead_status = 'in_outreach', lead_next_action_date = NOW() + INTERVAL '7 days'
        WHERE id = ${leadId}
      `);
    }

    try {
      const { ensureProactiveLead } = await import('../utils/ensure-proactive-lead');
      await ensureProactiveLead({
        consultantId: task.consultant_id,
        phoneNumber: resolvedPhone,
        contactName: resolvedName !== 'Cliente' ? resolvedName : undefined,
        source: task.ai_role === 'hunter' ? 'hunter' : 'manual',
        agentConfigId: task.whatsapp_config_id || undefined,
        leadInfo: {
          fonte: `WhatsApp ${task.ai_role || 'outbound'}`,
          companyName: additionalContextData.business_name || undefined,
        },
      });
    } catch (epErr: any) {
      console.error(`${LOG} ensureProactiveLead error (non-blocking):`, epErr.message);
    }

    if (task.ai_role === 'hunter') {
      try {
        const { findOrCreateConversation } = await import('../whatsapp/webhook-handler');
        const conversation = await findOrCreateConversation(
          resolvedPhone,
          task.consultant_id,
          task.whatsapp_config_id || undefined,
          true,
        );
        if (conversation && conversation.id) {
          await db.execute(sql`
            UPDATE whatsapp_conversations
            SET is_proactive_lead = true, is_lead = true,
                last_message_at = NOW(), last_message_from = 'ai',
                message_count = message_count + 1, updated_at = NOW()
            WHERE id = ${conversation.id}
          `);
          const previewText = additionalContextData.wa_preview_message || messageText;
          const msgId = `hunter_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
          await db.execute(sql`
            INSERT INTO whatsapp_messages (
              id, conversation_id, message_text, direction, sender,
              media_type, twilio_sid, twilio_status, sent_at, created_at, updated_at
            ) VALUES (
              ${msgId}, ${conversation.id}, ${previewText}, 'outbound', 'ai',
              'text', ${messageSid}, 'sent', NOW(), NOW(), NOW()
            )
          `);
          console.log(`${LOG} 📋 Hunter conversation ${conversation.id} marked isProactiveLead=true, message saved`);
        }
      } catch (convErr: any) {
        console.error(`${LOG} Failed to ensure Hunter conversation record (non-blocking):`, convErr.message);
      }
    }
  } catch (err: any) {
    console.error(`${LOG} ✗ Send failed: ${err.message}`);
    await handleFailure(task, err.message);
  }
}

const BLOCKED_EMAIL_DOMAINS = ['example.com', 'test.com', 'placeholder.com', 'fake.com', 'domain.com', 'example.org', 'test.org', 'fakeemail.com'];
const EMAIL_REGEX = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/;

function isValidEmail(email: string): { valid: boolean; reason?: string } {
  if (!email || !email.includes('@')) return { valid: false, reason: 'Email vuota o formato non valido' };
  if (!EMAIL_REGEX.test(email)) return { valid: false, reason: `Email con formato non valido: ${email}` };
  const domain = email.split('@')[1]?.toLowerCase();
  if (domain && BLOCKED_EMAIL_DOMAINS.includes(domain)) {
    return { valid: false, reason: `Dominio email bloccato (test/placeholder): ${domain}` };
  }
  return { valid: true };
}

async function executeSingleEmail(task: AIScheduledTask): Promise<void> {
  const LOG = '📧 [SINGLE-EMAIL]';
  let additionalContextData: Record<string, any> = {};
  if (task.additional_context) {
    try { additionalContextData = JSON.parse(task.additional_context); } catch {}
  }

  const emailAccountId = additionalContextData.email_account_id;
  const leadEmail = additionalContextData.lead_email || '';
  const resolvedName = task.contact_name || additionalContextData.business_name || 'Cliente';

  if (!emailAccountId) {
    console.error(`${LOG} No email_account_id for task ${task.id}, marking failed`);
    await handleFailure(task, 'Nessun account email configurato');
    return;
  }

  if (!leadEmail) {
    console.error(`${LOG} No lead email for task ${task.id}, marking failed`);
    await handleFailure(task, 'Email destinatario mancante');
    return;
  }

  const emailValidation = isValidEmail(leadEmail);
  if (!emailValidation.valid) {
    console.error(`${LOG} [EMAIL-BLOCKED] Task ${task.id}: ${emailValidation.reason}`);
    await handleFailure(task, `[EMAIL-BLOCKED] ${emailValidation.reason}`);
    return;
  }

  console.log(`${LOG} Sending email to ${leadEmail} (${resolvedName})`);

  try {
    const smtpResult = await db.execute(sql`
      SELECT id, smtp_host, smtp_port, smtp_user, smtp_password, email_address, display_name
      FROM email_accounts
      WHERE id = ${emailAccountId} AND consultant_id = ${task.consultant_id} AND smtp_host IS NOT NULL
      LIMIT 1
    `);
    const smtpConfig = smtpResult.rows[0] as any;

    if (!smtpConfig) {
      console.error(`${LOG} SMTP config not found for account ${emailAccountId}`);
      await handleFailure(task, 'Configurazione SMTP non trovata');
      return;
    }

    const instructionText = task.ai_instruction || '';
    const subjectMatch = instructionText.match(/^Oggetto:\s*(.+?)(?:\n|$)/);
    const emailSubject = subjectMatch ? subjectMatch[1].trim() : `Proposta per ${resolvedName}`;
    const emailBody = subjectMatch ? instructionText.replace(/^Oggetto:\s*.+?\n\n?/, '').trim() : instructionText;

    const nodemailer = await import('nodemailer');
    const transporter = nodemailer.createTransport({
      host: smtpConfig.smtp_host,
      port: smtpConfig.smtp_port || 587,
      secure: (smtpConfig.smtp_port || 587) === 465,
      auth: { user: smtpConfig.smtp_user, pass: smtpConfig.smtp_password },
      tls: { rejectUnauthorized: false },
    });

    const htmlBody = emailBody.replace(/\n/g, '<br>');
    const fromField = smtpConfig.display_name ? `"${smtpConfig.display_name}" <${smtpConfig.email_address}>` : smtpConfig.email_address;
    const sendResult = await transporter.sendMail({ from: fromField, to: leadEmail, subject: emailSubject, html: htmlBody });

    const hubEmailId = `hub_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    await db.execute(sql`
      INSERT INTO hub_emails (
        id, account_id, consultant_id, message_id, subject, from_name, from_email,
        to_recipients, body_html, body_text, snippet, direction, folder,
        is_read, processing_status, sent_at, created_at, updated_at
      ) VALUES (
        ${hubEmailId}, ${emailAccountId}, ${task.consultant_id},
        ${sendResult.messageId || hubEmailId},
        ${emailSubject}, ${smtpConfig.display_name || ''}, ${smtpConfig.email_address},
        ${JSON.stringify([{ email: leadEmail, name: resolvedName }])}::jsonb,
        ${htmlBody}, ${emailBody}, ${emailBody.substring(0, 200)},
        'outbound', 'sent', true, 'sent', NOW(), NOW(), NOW()
      )
      ON CONFLICT (message_id) DO NOTHING
    `);

    await db.execute(sql`
      UPDATE ai_scheduled_tasks
      SET status = 'completed', completed_at = NOW(), updated_at = NOW(),
          result_summary = ${'Email inviata a ' + leadEmail}
      WHERE id = ${task.id}
    `);

    console.log(`${LOG} ✅ Email sent to ${leadEmail} (subject="${emailSubject}")`);

    await logActivity(task.consultant_id, {
      event_type: 'email_sent',
      title: `Email inviata a ${resolvedName}`,
      description: `Oggetto: "${emailSubject}" → ${leadEmail}`,
      icon: '📧',
      severity: 'info',
      task_id: task.id,
    });

    try {
      const { ensureProactiveLead } = await import('../utils/ensure-proactive-lead');
      await ensureProactiveLead({
        consultantId: task.consultant_id,
        phoneNumber: task.contact_phone || '',
        contactName: resolvedName !== 'Cliente' ? resolvedName : undefined,
        email: leadEmail,
        source: 'hunter',
        leadInfo: {
          fonte: 'Email Hunter',
          companyName: additionalContextData.business_name || undefined,
        },
      });
    } catch (epErr: any) {
      console.error(`${LOG} ensureProactiveLead error (non-blocking):`, epErr.message);
    }

    const leadId = additionalContextData.lead_id;
    if (leadId) {
      await db.execute(sql`
        UPDATE lead_scraper_results
        SET lead_status = 'in_outreach', lead_next_action_date = NOW() + INTERVAL '7 days'
        WHERE id = ${leadId}
      `);
    }
  } catch (err: any) {
    console.error(`${LOG} ✗ Send failed: ${err.message}`);
    await handleFailure(task, err.message);
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
    // Get VPS URL and service token from global superadmin config
    const globalVoiceResult = await db.execute(sql`
      SELECT vps_bridge_url, service_token FROM superadmin_voice_config WHERE id = 'default' AND enabled = true LIMIT 1
    `);
    const globalVoice = globalVoiceResult.rows[0] as any;
    const vpsUrl = globalVoice?.vps_bridge_url || process.env.VPS_BRIDGE_URL;
    const token = globalVoice?.service_token;

    // Get SIP settings from consultant
    const sipResult = await db.execute(sql`
      SELECT sip_caller_id, sip_gateway FROM users WHERE id::text = ${task.consultant_id}::text
    `);
    const sipCallerId = (sipResult.rows[0] as any)?.sip_caller_id;
    const sipGateway = (sipResult.rows[0] as any)?.sip_gateway;
    
    if (!vpsUrl) {
      return { 
        success: false, 
        reason: 'VPS URL not configured' 
      };
    }
    
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
  
  await db.execute(sql`
    UPDATE ai_scheduled_tasks 
    SET result_summary = 'Chiamata in corso...',
        voice_call_id = ${result.callId || null},
        updated_at = NOW()
    WHERE id = ${task.id}
  `);
  
  if (task.contact_phone) {
    try {
      const { ensureProactiveLead } = await import('../utils/ensure-proactive-lead');
      await ensureProactiveLead({
        consultantId: task.consultant_id,
        phoneNumber: task.contact_phone,
        contactName: task.contact_name || undefined,
        source: task.ai_role === 'hunter' ? 'hunter' : 'manual',
        agentConfigId: task.whatsapp_config_id || undefined,
        leadInfo: {
          fonte: `Chiamata vocale ${task.ai_role || 'outbound'}`,
        },
      });
    } catch (epErr: any) {
      console.error(`[AI-SCHEDULER] ensureProactiveLead error (non-blocking):`, epErr.message);
    }
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
    
    void import("../telegram/telegram-service").then(({ notifyTaskViaTelegram }) =>
      notifyTaskViaTelegram(task.consultant_id, task.ai_role || 'personalizza', 'failed', {
        taskId: task.id,
        instruction: task.ai_instruction,
        contactName: task.contact_name,
        errorMessage: `${reason}`,
        taskCategory: task.task_category,
      })
    ).catch(() => {});
    
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
  console.log(`🤖 [AI-SCHEDULER] ══════ STEP 4: executeAutonomousTask ══════`);
  console.log(`   📋 id=${task.id}, category=${task.task_category}, ai_role=${task.ai_role}`);
  console.log(`   📋 result_data=${JSON.stringify(task.result_data)}`);
  
  try {
    const taskMeta = await db.execute(sql`
      SELECT execution_mode FROM ai_scheduled_tasks WHERE id = ${task.id}
    `);
    const executionMode = (taskMeta.rows[0] as any)?.execution_mode || 'autonomous';

    const skipGuardrails = task.result_data && typeof task.result_data === 'object' && (task.result_data as any).skip_guardrails === true;
    
    console.log(`🤖 [AI-SCHEDULER] STEP 4a: skip_guardrails=${skipGuardrails}, ai_role=${task.ai_role}, execution_mode=${executionMode}`);
    
    if (skipGuardrails) {
      console.log(`🔓 [AI-SCHEDULER] STEP 4a: Using canExecuteManually (skips working hours + autonomy level)`);
    } else {
      console.log(`🔒 [AI-SCHEDULER] STEP 4a: Using canExecuteAutonomously with roleId=${task.ai_role || 'none'}`);
    }
    
    const guardrailCheck = skipGuardrails 
      ? await canExecuteManually(task.consultant_id)
      : await canExecuteAutonomously(task.consultant_id, task.ai_role || undefined);
    
    console.log(`🤖 [AI-SCHEDULER] STEP 4b: Guardrail result: allowed=${guardrailCheck.allowed}, reason=${guardrailCheck.reason || 'OK'}`);
    
    if (!guardrailCheck.allowed) {
      console.log(`🛑 [AI-SCHEDULER] STEP 4b: Task ${task.id} BLOCKED by guardrails: ${guardrailCheck.reason}`);
      
      await db.execute(sql`
        UPDATE ai_scheduled_tasks 
        SET status = 'paused',
            result_summary = ${`In pausa: ${guardrailCheck.reason}`},
            updated_at = NOW()
        WHERE id = ${task.id}
      `);
      
      await logActivity(task.consultant_id, {
        event_type: 'task_paused',
        title: `Devo fermarmi un attimo...`,
        description: `Non posso procedere ora: ${guardrailCheck.reason || 'ci sono dei vincoli che me lo impediscono'}`,
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
        title: `Sto ragionando su come procedere...`,
        description: `Analizzo il contesto e preparo il piano migliore per "${task.ai_instruction?.substring(0, 60) || 'questo task'}"`,
        icon: 'brain',
        severity: 'info',
        task_id: task.id,
        contact_name: task.contact_name,
        contact_id: task.contact_id,
      });
      
      const autonomySettings = await getAutonomySettings(task.consultant_id);
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
        result_data: task.result_data,
      }, { 
        skipGuardrails: skipGuardrails, 
        roleId: task.ai_role || undefined,
        autonomyModel: autonomySettings?.autonomy_model,
        autonomyThinkingLevel: autonomySettings?.autonomy_thinking_level,
      });
      
      if (!decision.should_execute) {
        const isError = decision.reasoning.toLowerCase().includes('errore') || 
                        decision.reasoning.toLowerCase().includes('error') || 
                        decision.confidence === 0;
        
        if (isError) {
          console.log(`❌ [AI-SCHEDULER] Decision Engine ERROR for task ${task.id}: ${decision.reasoning}`);
          await db.execute(sql`
            UPDATE ai_scheduled_tasks 
            SET status = 'failed',
                ai_reasoning = ${decision.reasoning},
                ai_confidence = ${decision.confidence},
                result_summary = ${`Errore: ${decision.reasoning.substring(0, 200)}`},
                error_message = ${decision.reasoning.substring(0, 500)},
                result_data = COALESCE(result_data, '{}'::jsonb) || ${JSON.stringify({ decision: 'error', reasoning: decision.reasoning })}::jsonb,
                completed_at = NOW(),
                updated_at = NOW()
            WHERE id = ${task.id}
          `);
          
          await logActivity(task.consultant_id, {
            event_type: 'task_error',
            title: `Non ci sono riuscito... c'è stato un errore`,
            description: `Ho provato ma qualcosa è andato storto: ${decision.reasoning.substring(0, 300)}`,
            icon: '❌',
            severity: 'error',
            task_id: task.id,
            contact_name: task.contact_name,
            contact_id: task.contact_id,
            event_data: { confidence: decision.confidence }
          });
          
          void import("../telegram/telegram-service").then(({ notifyTaskViaTelegram }) =>
            notifyTaskViaTelegram(task.consultant_id, task.ai_role || 'personalizza', 'failed', {
              taskId: task.id,
              instruction: task.ai_instruction,
              contactName: task.contact_name,
              errorMessage: decision.reasoning.substring(0, 300),
              taskCategory: task.task_category,
            })
          ).catch(() => {});
        } else {
          console.log(`🛑 [AI-SCHEDULER] Decision Engine says skip task ${task.id}: ${decision.reasoning}`);
          await db.execute(sql`
            UPDATE ai_scheduled_tasks 
            SET status = 'completed',
                ai_reasoning = ${decision.reasoning},
                ai_confidence = ${decision.confidence},
                result_summary = ${`AI ha deciso di non eseguire: ${decision.reasoning.substring(0, 200)}`},
                result_data = COALESCE(result_data, '{}'::jsonb) || ${JSON.stringify({ decision: 'skip', reasoning: decision.reasoning })}::jsonb,
                completed_at = NOW(),
                updated_at = NOW()
            WHERE id = ${task.id}
          `);
          
          await logActivity(task.consultant_id, {
            event_type: 'decision_made',
            title: `Ho valutato e non serve procedere`,
            description: `Ho analizzato la situazione: ${decision.reasoning.substring(0, 300)}`,
            icon: 'brain',
            severity: 'info',
            task_id: task.id,
            contact_name: task.contact_name,
            contact_id: task.contact_id,
            event_data: { confidence: decision.confidence }
          });
        }
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
      title: `Ci sono! Inizio a lavorare`,
      description: `Ho ${totalSteps} step da fare — mi metto subito all'opera`,
      icon: 'brain',
      severity: 'info',
      task_id: task.id,
      contact_name: task.contact_name,
      contact_id: task.contact_id,
    });
    
    let resolvedContactPhone = task.contact_phone;
    let resolvedContactName = task.contact_name;
    let resolvedContactId = task.contact_id;
    let resolvedWhatsappConfigId = task.whatsapp_config_id || null;

    const taskRole = task.ai_role || null;

    if (taskRole === 'marco') {
      try {
        const settingsResult = await db.execute(sql`
          SELECT consultant_phone, consultant_whatsapp, consultant_email, agent_contexts
          FROM ai_autonomy_settings
          WHERE consultant_id::text = ${task.consultant_id}::text
          LIMIT 1
        `);
        const settingsRow = settingsResult.rows[0] as any;
        if (settingsRow) {
          const consultantPhone = settingsRow.consultant_whatsapp || settingsRow.consultant_phone;
          if (consultantPhone) {
            console.log(`🔄 [AI-SCHEDULER] [MARCO] Redirecting contact from ${resolvedContactPhone} to consultant: ${consultantPhone}`);
            resolvedContactPhone = consultantPhone;
            resolvedContactName = 'Consulente (tu)';
            resolvedContactId = null;
          } else {
            console.warn(`⚠️ [AI-SCHEDULER] [MARCO] No consultant phone configured, keeping original contact`);
          }
          const agentContexts = settingsRow.agent_contexts || {};
          const marcoCtx = agentContexts['marco'];
          if (marcoCtx?.defaultWhatsappAgentId && !resolvedWhatsappConfigId) {
            resolvedWhatsappConfigId = marcoCtx.defaultWhatsappAgentId;
            console.log(`📱 [AI-SCHEDULER] [MARCO] Using configured WhatsApp agent: ${resolvedWhatsappConfigId}`);
          }
        }
      } catch (err: any) {
        console.error(`⚠️ [AI-SCHEDULER] [MARCO] Failed to resolve consultant contacts: ${err.message}`);
      }
    } else if (taskRole && taskRole !== 'marco') {
      try {
        const settingsResult = await db.execute(sql`
          SELECT agent_contexts FROM ai_autonomy_settings
          WHERE consultant_id::text = ${task.consultant_id}::text
          LIMIT 1
        `);
        const settingsRow = settingsResult.rows[0] as any;
        if (settingsRow) {
          const agentContexts = settingsRow.agent_contexts || {};
          const roleCtx = agentContexts[taskRole];
          if (roleCtx?.defaultWhatsappAgentId && !resolvedWhatsappConfigId) {
            resolvedWhatsappConfigId = roleCtx.defaultWhatsappAgentId;
            console.log(`📱 [AI-SCHEDULER] [${taskRole.toUpperCase()}] Using configured WhatsApp agent: ${resolvedWhatsappConfigId}`);
          }
        }
      } catch (err: any) {
        console.error(`⚠️ [AI-SCHEDULER] [${taskRole.toUpperCase()}] Failed to resolve WhatsApp agent: ${err.message}`);
      }
    }

    if (resolvedContactPhone !== task.contact_phone || resolvedWhatsappConfigId) {
      try {
        await db.execute(sql`
          UPDATE ai_scheduled_tasks
          SET contact_phone = ${resolvedContactPhone},
              contact_name = ${resolvedContactName},
              contact_id = ${resolvedContactId ? sql`${resolvedContactId}::uuid` : sql`NULL`},
              whatsapp_config_id = ${resolvedWhatsappConfigId},
              updated_at = NOW()
          WHERE id = ${task.id}
        `);
        console.log(`💾 [AI-SCHEDULER] Persisted resolved contacts/agent for task ${task.id}`);
      } catch (persistErr: any) {
        console.warn(`⚠️ [AI-SCHEDULER] Failed to persist resolved contacts: ${persistErr.message}`);
      }
    }

    const taskInfo: AITaskInfo = {
      id: task.id,
      consultant_id: task.consultant_id,
      contact_id: resolvedContactId,
      contact_phone: resolvedContactPhone,
      contact_name: resolvedContactName,
      ai_instruction: task.ai_instruction,
      task_category: task.task_category,
      priority: task.priority,
      timezone: task.timezone || 'Europe/Rome',
      additional_context: task.additional_context,
      ai_role: taskRole,
      whatsapp_config_id: resolvedWhatsappConfigId,
    };
    
    const allResults: Record<string, any> = {};
    let completedSteps = 0;
    let failedStep: string | null = null;
    
    let startStepIndex = 0;
    const existingResults = task.result_data?.results || {};
    if (Object.keys(existingResults).length > 0 && task.result_data?.paused_at_step) {
      startStepIndex = task.result_data.paused_at_step;
      Object.assign(allResults, existingResults);
      completedSteps = startStepIndex;
      console.log(`▶️ [AI-SCHEDULER] ASSISTED MODE RESUME: Continuing from step ${startStepIndex + 1}/${totalSteps}`);
    }

    for (let i = startStepIndex; i < totalSteps; i++) {
      const step = executionPlan[i];
      const stepName = step.action || `step_${i + 1}`;
      
      console.log(`🧠 [AI-SCHEDULER] Executing step ${i + 1}/${totalSteps}: ${stepName}`);
      
      executionPlan[i] = { ...executionPlan[i], status: 'in_progress' };
      const stepProgressMsg = `Sto lavorando allo step ${i + 1}/${totalSteps}: ${step.description || stepName}`;
      await db.execute(sql`
        UPDATE ai_scheduled_tasks 
        SET execution_plan = ${JSON.stringify(executionPlan)}::jsonb,
            result_summary = ${stepProgressMsg},
            updated_at = NOW()
        WHERE id = ${task.id}
      `);

      await logActivity(taskInfo.consultant_id, {
        event_type: `step_${stepName}_started`,
        title: `Passo allo step ${i + 1}/${totalSteps}: ${step.description || stepName}`,
        description: `Ora mi occupo di: ${step.description || stepName}`,
        icon: "🔄",
        severity: "info",
        task_id: task.id,
        contact_name: taskInfo.contact_name,
        contact_id: taskInfo.contact_id,
      });
      
      const stepAutonomySettings = await getAutonomySettings(task.consultant_id);
      const stepResult = await executeStep(taskInfo, step, allResults, stepAutonomySettings?.autonomy_model, stepAutonomySettings?.autonomy_thinking_level);
      
      if (stepResult.success) {
        executionPlan[i] = { ...executionPlan[i], status: 'completed' };
        allResults[stepName] = stepResult.result;
        allResults[`step_${i + 1}`] = stepResult.result;
        completedSteps++;
        
        console.log(`✅ [AI-SCHEDULER] Step ${i + 1}/${totalSteps} completed in ${stepResult.duration_ms}ms`);

        if (executionMode === 'assisted' && i < totalSteps - 1) {
          await db.execute(sql`
            UPDATE ai_scheduled_tasks 
            SET status = 'waiting_input',
                execution_plan = ${JSON.stringify(executionPlan)}::jsonb,
                result_data = COALESCE(result_data, '{}'::jsonb) || ${JSON.stringify({ steps_completed: completedSteps, total_steps: totalSteps, results: allResults, paused_at_step: i + 1 })}::jsonb,
                result_summary = ${'In attesa del tuo input dopo lo step ' + (i + 1) + '/' + totalSteps + ': ' + stepName},
                updated_at = NOW()
            WHERE id = ${task.id}
          `);
          
          await logActivity(task.consultant_id, {
            event_type: 'task_waiting_input',
            title: `Ho bisogno del tuo parere prima di andare avanti`,
            description: `Ho completato lo step ${i + 1}/${totalSteps} (${stepName}). Dai un'occhiata ai risultati e dimmi come vuoi che proceda.`,
            icon: '⏸️',
            severity: 'warning',
            task_id: task.id,
            contact_name: task.contact_name,
            contact_id: task.contact_id,
          });

          void import("../telegram/telegram-service").then(({ notifyTaskViaTelegram }) => 
            notifyTaskViaTelegram(task.consultant_id, task.ai_role || 'personalizza', 'waiting_input', {
              taskId: task.id,
              instruction: task.ai_instruction,
              contactName: task.contact_name,
              stepInfo: stepName,
              taskCategory: task.task_category,
            })
          ).catch(() => {});
          
          console.log(`⏸️ [AI-SCHEDULER] ASSISTED MODE: Task ${task.id} paused after step ${i + 1}/${totalSteps}, waiting for consultant input`);
          return;
        }
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
            result_data = COALESCE(result_data, '{}'::jsonb) || ${JSON.stringify({ steps_completed: completedSteps, total_steps: totalSteps, results: allResults })}::jsonb,
            completed_at = NOW(),
            updated_at = NOW()
        WHERE id = ${task.id}
      `);
      
      await logActivity(task.consultant_id, {
        event_type: 'task_failed',
        title: `Non ci sono riuscito...`,
        description: `Mi sono bloccato allo step "${failedStep}" — avevo completato ${completedSteps}/${totalSteps} step`,
        icon: 'alert',
        severity: 'error',
        task_id: task.id,
        contact_name: task.contact_name,
        contact_id: task.contact_id,
        event_data: { steps_completed: completedSteps, failed_step: failedStep }
      });
      
      void import("../telegram/telegram-service").then(({ notifyTaskViaTelegram }) =>
        notifyTaskViaTelegram(task.consultant_id, task.ai_role || 'personalizza', 'failed', {
          taskId: task.id,
          instruction: task.ai_instruction,
          contactName: task.contact_name,
          errorMessage: `Fallito allo step "${failedStep}"`,
          taskCategory: task.task_category,
        })
      ).catch(() => {});
    } else {
      await db.execute(sql`
        UPDATE ai_scheduled_tasks 
        SET status = 'completed',
            execution_plan = ${JSON.stringify(executionPlan)}::jsonb,
            result_summary = ${`Completato: ${totalSteps} step eseguiti con successo`},
            result_data = COALESCE(result_data, '{}'::jsonb) || ${JSON.stringify({ steps_completed: totalSteps, total_steps: totalSteps, results: allResults })}::jsonb,
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
        title: `Tutto fatto!`,
        description: `Ho completato tutti i ${totalSteps} step con successo`,
        icon: 'check',
        severity: 'success',
        task_id: task.id,
        contact_name: task.contact_name,
        contact_id: task.contact_id,
        event_data: { steps_completed: totalSteps }
      });
      
      void import("../telegram/telegram-service").then(({ notifyTaskViaTelegram }) =>
        notifyTaskViaTelegram(task.consultant_id, task.ai_role || 'personalizza', 'completed', {
          taskId: task.id,
          instruction: task.ai_instruction,
          contactName: task.contact_name,
          resultSummary: `Completato: ${totalSteps} step eseguiti con successo`,
          taskCategory: task.task_category,
        })
      ).catch(() => {});
      
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
      title: `Non ci sono riuscito... c'è stato un errore`,
      description: `Qualcosa è andato storto: ${error.message}`,
      icon: 'alert',
      severity: 'error',
      task_id: task.id,
      contact_name: task.contact_name,
      contact_id: task.contact_id,
    });
    
    void import("../telegram/telegram-service").then(({ notifyTaskViaTelegram }) =>
      notifyTaskViaTelegram(task.consultant_id, task.ai_role || 'personalizza', 'failed', {
        taskId: task.id,
        instruction: task.ai_instruction,
        contactName: task.contact_name,
        errorMessage: error.message,
        taskCategory: task.task_category,
      })
    ).catch(() => {});
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
      SELECT id, target_phone, updated_at, attempts, max_attempts, consultant_id 
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
      
      // Check if there's a matching completed call in voice_calls (filtered by consultant)
      const voiceCallResult = await db.execute(sql`
        SELECT id, status, duration_seconds, outcome 
        FROM voice_calls 
        WHERE called_number = ${call.target_phone}
          AND created_at > ${updatedAtTimestamp}::timestamp - INTERVAL '2 minutes'
          AND created_at < ${updatedAtTimestamp}::timestamp + INTERVAL '10 minutes'
          AND status = 'completed'
          ${call.consultant_id ? sql`AND consultant_id = ${call.consultant_id}` : sql``}
        ORDER BY created_at DESC
        LIMIT 1
      `);
      
      // First get source_task_id for AI task sync and task details
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
          
          // Fetch task details for notification
          const taskDetailResult = await db.execute(sql`
            SELECT consultant_id, ai_role, ai_instruction, contact_name, task_category 
            FROM ai_scheduled_tasks WHERE id = ${sourceTaskId}
          `);
          const taskDetail = (taskDetailResult.rows[0] as any);
          if (taskDetail) {
            void import("../telegram/telegram-service").then(({ notifyTaskViaTelegram }) =>
              notifyTaskViaTelegram(taskDetail.consultant_id, taskDetail.ai_role || 'personalizza', 'completed', {
                taskId: sourceTaskId,
                instruction: taskDetail.ai_instruction,
                contactName: taskDetail.contact_name,
                resultSummary: `Chiamata completata (sync automatico)${voiceCall.duration_seconds ? ` - ${voiceCall.duration_seconds}s` : ''}`,
                taskCategory: taskDetail.task_category,
              })
            ).catch(() => {});

            if (taskDetail.ai_role === 'alessia') {
              const transcriptResult = await db.execute(sql`
                SELECT full_transcript, client_id FROM voice_calls WHERE id = ${voiceCall.id}
              `);
              const vcData = transcriptResult.rows[0] as any;
              if (vcData?.full_transcript && vcData?.client_id) {
                void import("../voice/voice-feedback-loop").then(({ processCallFeedback }) => {
                  processCallFeedback({
                    callId: voiceCall.id,
                    consultantId: taskDetail.consultant_id,
                    clientId: vcData.client_id,
                    transcript: vcData.full_transcript,
                    duration: voiceCall.duration_seconds || 0,
                    outcome: voiceCall.outcome || 'completed',
                  });
                }).catch(() => {});
              }
            }
          }
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
            
            // Fetch task details for notification
            const taskDetailResult = await db.execute(sql`
              SELECT consultant_id, ai_role, ai_instruction, contact_name, task_category 
              FROM ai_scheduled_tasks WHERE id = ${sourceTaskId}
            `);
            const taskDetail = (taskDetailResult.rows[0] as any);
            if (taskDetail) {
              void import("../telegram/telegram-service").then(({ notifyTaskViaTelegram }) =>
                notifyTaskViaTelegram(taskDetail.consultant_id, taskDetail.ai_role || 'personalizza', 'failed', {
                  taskId: sourceTaskId,
                  instruction: taskDetail.ai_instruction,
                  contactName: taskDetail.contact_name,
                  errorMessage: 'Chiamata fallita - nessuna risposta dal VPS',
                  taskCategory: taskDetail.task_category,
                })
              ).catch(() => {});
            }
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
  follow_up_of?: string;
  scheduled_for?: string;
  scheduling_reason?: string;
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

      try {
        const { runDirectHunterForConsultant } = await import('../ai/hunter-direct-executor');
        await runDirectHunterForConsultant(consultant_id);
      } catch (hunterErr: any) {
        console.error(`❌ [HUNTER-DIRECT] Error for ${consultant_id}:`, hunterErr.message);
      }
    }

    console.log(`🧠 [AUTONOMOUS-GEN] Completed. Total tasks generated: ${totalGenerated}`);
    return { generated: totalGenerated };
  }, { lockDurationMs: AUTONOMOUS_LOCK_DURATION_MS });

  if (result === null) {
    return;
  }
}

interface DeepThinkStep {
  step: number;
  type: string;
  title: string;
  content: string;
  durationMs: number;
  tokens: number;
}

interface DeepThinkResult {
  parsed: { tasks: any[]; overall_reasoning?: string };
  rawResponse: string;
  steps: DeepThinkStep[];
  overallReasoning: string;
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
  durationMs: number;
}

async function executeDeepThinkLoop(
  aiClient: any,
  model: string,
  provider: string,
  basePrompt: string,
  role: any,
  clientsList: any[],
  roleData: Record<string, any>,
  recentTasks: any[],
  consultantId: string,
  cycleId: string,
  fileSearchTool: any,
  useFileSearch: boolean
): Promise<DeepThinkResult> {
  const steps: DeepThinkStep[] = [];
  let totalTokens = 0, inputTokens = 0, outputTokens = 0;
  const startTime = Date.now();
  const conversationHistory: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> = [];

  console.log(`🧠 [DEEP-THINK] [${role.name}] Starting multi-step reasoning loop...`);
  console.log(`🧠 [DEEP-THINK] [${role.name}] Clients count: ${clientsList.length}, Recent tasks: ${recentTasks.length}, Model: ${model}, Provider: ${provider}`);

  const step1Start = Date.now();
  const step1Prompt = `${basePrompt}

--- ISTRUZIONE STEP 1: ANALISI DATI ---
Questo è il primo step del tuo processo di ragionamento approfondito.
Analizza TUTTI i dati che ti ho fornito e produci un'analisi strutturata:
1. Quali pattern noti nei dati dei clienti?
2. Chi mostra segnali di bisogno di attenzione (e perché)?
3. Quali opportunità di contatto/azione hai identificato?
4. Ci sono rischi o situazioni critiche?

NON generare ancora task. Concentrati solo sull'analisi.
Rispondi in formato libero (testo), non JSON.`;

  conversationHistory.push({ role: 'user', parts: [{ text: step1Prompt }] });

  emitReasoningEvent(consultantId, {
    type: 'step_start',
    cycleId,
    roleId: role.id,
    roleName: role.name,
    stepNumber: 1,
    stepTitle: 'Analisi Dati',
    stepType: 'data_analysis',
    totalSteps: 4,
    timestamp: Date.now(),
  });

  let step1Response = '';
  try {
    const resp = await aiClient.generateContent({
      model,
      contents: conversationHistory,
      generationConfig: { temperature: 0.4, maxOutputTokens: 4096 },
    });
    step1Response = resp.response?.text?.() || '';
  } catch (e: any) {
    step1Response = `Errore nell'analisi: ${e.message}`;
  }

  conversationHistory.push({ role: 'model', parts: [{ text: step1Response }] });
  steps.push({
    step: 1,
    type: 'data_analysis',
    title: 'Analisi Dati',
    content: step1Response,
    durationMs: Date.now() - step1Start,
    tokens: 0,
  });
  emitReasoningEvent(consultantId, {
    type: 'step_complete',
    cycleId,
    roleId: role.id,
    roleName: role.name,
    stepNumber: 1,
    stepTitle: 'Analisi Dati',
    stepType: 'data_analysis',
    stepContent: step1Response.substring(0, 300),
    stepDurationMs: Date.now() - step1Start,
    totalSteps: 4,
    timestamp: Date.now(),
  });
  console.log(`🧠 [DEEP-THINK] [${role.name}] Step 1 (Analysis) done: ${step1Response.length} chars, duration: ${Date.now() - step1Start}ms`);
  console.log(`🧠 [DEEP-THINK] [${role.name}] Step 1 preview: ${step1Response.substring(0, 200)}...`);

  const step2Start = Date.now();
  conversationHistory.push({ role: 'user', parts: [{ text: `--- STEP 2: VALUTAZIONE PRIORITÀ ---
Basandoti sulla tua analisi precedente, ora ordina per priorità i clienti/situazioni che richiedono azione.
Per ogni cliente da contattare, spiega:
- Perché è prioritario
- Che tipo di azione suggeriresti
- Quanto è urgente (1-5)
- Quale canale sarebbe più appropriato

Rispondi in formato libero (testo), non JSON.` }] });

  emitReasoningEvent(consultantId, {
    type: 'step_start',
    cycleId,
    roleId: role.id,
    roleName: role.name,
    stepNumber: 2,
    stepTitle: 'Valutazione Priorità',
    stepType: 'priority_assessment',
    totalSteps: 4,
    timestamp: Date.now(),
  });

  let step2Response = '';
  try {
    const resp = await aiClient.generateContent({
      model,
      contents: conversationHistory,
      generationConfig: { temperature: 0.3, maxOutputTokens: 4096 },
    });
    step2Response = resp.response?.text?.() || '';
  } catch (e: any) {
    step2Response = `Errore nella prioritizzazione: ${e.message}`;
  }

  conversationHistory.push({ role: 'model', parts: [{ text: step2Response }] });
  steps.push({
    step: 2,
    type: 'priority_assessment',
    title: 'Valutazione Priorità',
    content: step2Response,
    durationMs: Date.now() - step2Start,
    tokens: 0,
  });
  emitReasoningEvent(consultantId, {
    type: 'step_complete',
    cycleId,
    roleId: role.id,
    roleName: role.name,
    stepNumber: 2,
    stepTitle: 'Valutazione Priorità',
    stepType: 'priority_assessment',
    stepContent: step2Response.substring(0, 300),
    stepDurationMs: Date.now() - step2Start,
    totalSteps: 4,
    timestamp: Date.now(),
  });
  console.log(`🧠 [DEEP-THINK] [${role.name}] Step 2 (Priorities) done: ${step2Response.length} chars, duration: ${Date.now() - step2Start}ms`);
  console.log(`🧠 [DEEP-THINK] [${role.name}] Step 2 preview: ${step2Response.substring(0, 200)}...`);

  const step3Start = Date.now();
  conversationHistory.push({ role: 'user', parts: [{ text: `--- STEP 3: GENERAZIONE TASK ---
Ora genera i task concreti basati sulla tua analisi e prioritizzazione.
Rispondi ESCLUSIVAMENTE con JSON valido nel seguente formato (senza markdown):
{
  "tasks": [
    {
      "contact_id": "uuid del cliente",
      "contact_name": "Nome",
      "ai_instruction": "Istruzione dettagliata...",
      "task_category": "categoria",
      "priority": 3,
      "reasoning": "Motivazione basata sulla tua analisi precedente",
      "preferred_channel": "canale",
      "urgency": "normale|oggi|settimana",
      "scheduled_for": "YYYY-MM-DDTHH:MM",
      "scheduling_reason": "Motivo orario",
      "tone": "professionale|informale|empatico"
    }
  ]
}

Genera SOLO task che hai realmente giustificato nei passaggi precedenti. Non inventare task nuovi che non hai analizzato.` }] });

  emitReasoningEvent(consultantId, {
    type: 'step_start',
    cycleId,
    roleId: role.id,
    roleName: role.name,
    stepNumber: 3,
    stepTitle: 'Generazione Task',
    stepType: 'task_generation',
    totalSteps: 4,
    timestamp: Date.now(),
  });

  let step3Response = '';
  try {
    const resp = await aiClient.generateContent({
      model,
      contents: conversationHistory,
      generationConfig: { temperature: 0.2, maxOutputTokens: 8192, responseMimeType: useFileSearch ? undefined : 'application/json' },
    });
    step3Response = resp.response?.text?.() || '';
  } catch (e: any) {
    step3Response = `{"tasks": []}`;
  }

  conversationHistory.push({ role: 'model', parts: [{ text: step3Response }] });
  steps.push({
    step: 3,
    type: 'task_generation',
    title: 'Generazione Task',
    content: step3Response,
    durationMs: Date.now() - step3Start,
    tokens: 0,
  });
  emitReasoningEvent(consultantId, {
    type: 'step_complete',
    cycleId,
    roleId: role.id,
    roleName: role.name,
    stepNumber: 3,
    stepTitle: 'Generazione Task',
    stepType: 'task_generation',
    stepContent: step3Response.substring(0, 300),
    stepDurationMs: Date.now() - step3Start,
    totalSteps: 4,
    timestamp: Date.now(),
  });
  console.log(`🧠 [DEEP-THINK] [${role.name}] Step 3 (Generation) done: ${step3Response.length} chars`);

  const step4Start = Date.now();
  conversationHistory.push({ role: 'user', parts: [{ text: `--- STEP 4: AUTO-REVISIONE ---
Rivedi criticamente i task che hai appena generato. Per ciascuno, rispondi:
1. È davvero necessario o è ridondante con task esistenti?
2. L'istruzione è sufficientemente specifica e actionable?
3. Il timing e il canale sono appropriati?
4. C'è rischio di duplicazione con task già in coda?

Se qualche task non supera la tua revisione, rimuovilo e spiega perché.

Rispondi con il JSON finale pulito:
{
  "review_notes": "Le tue note di revisione...",
  "tasks": [ ... (solo i task che superano la revisione) ]
}` }] });

  emitReasoningEvent(consultantId, {
    type: 'step_start',
    cycleId,
    roleId: role.id,
    roleName: role.name,
    stepNumber: 4,
    stepTitle: 'Auto-Revisione',
    stepType: 'self_review',
    totalSteps: 4,
    timestamp: Date.now(),
  });

  let step4Response = '';
  try {
    const resp = await aiClient.generateContent({
      model,
      contents: conversationHistory,
      generationConfig: { temperature: 0.2, maxOutputTokens: 8192, responseMimeType: useFileSearch ? undefined : 'application/json' },
    });
    step4Response = resp.response?.text?.() || '';
  } catch (e: any) {
    step4Response = step3Response;
  }

  steps.push({
    step: 4,
    type: 'self_review',
    title: 'Auto-Revisione',
    content: step4Response,
    durationMs: Date.now() - step4Start,
    tokens: 0,
  });
  emitReasoningEvent(consultantId, {
    type: 'step_complete',
    cycleId,
    roleId: role.id,
    roleName: role.name,
    stepNumber: 4,
    stepTitle: 'Auto-Revisione',
    stepType: 'self_review',
    stepContent: step4Response.substring(0, 300),
    stepDurationMs: Date.now() - step4Start,
    totalSteps: 4,
    timestamp: Date.now(),
  });
  console.log(`🧠 [DEEP-THINK] [${role.name}] Step 4 (Review) done: ${step4Response.length} chars`);

  let finalParsed: { tasks: any[]; overall_reasoning?: string; review_notes?: string } = { tasks: [] };
  for (const responseToTry of [step4Response, step3Response]) {
    try {
      let cleaned = responseToTry.replace(/^\uFEFF/, '').replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '').trim();
      if (cleaned.startsWith('```json')) cleaned = cleaned.slice(7);
      else if (cleaned.startsWith('```')) cleaned = cleaned.slice(3);
      if (cleaned.endsWith('```')) cleaned = cleaned.slice(0, -3);
      cleaned = cleaned.trim();

      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        finalParsed = JSON.parse(jsonMatch[0]);
        if (finalParsed.tasks && Array.isArray(finalParsed.tasks)) break;
      }
    } catch {}
  }

  const overallReasoning = [
    `**Analisi Dati:** ${step1Response.substring(0, 500)}`,
    `**Priorità:** ${step2Response.substring(0, 500)}`,
    finalParsed.review_notes ? `**Revisione:** ${finalParsed.review_notes}` : '',
  ].filter(Boolean).join('\n\n');

  const durationMs = Date.now() - startTime;
  console.log(`🧠 [DEEP-THINK] [${role.name}] Completed in ${durationMs}ms with ${steps.length} steps, ${finalParsed.tasks?.length || 0} final tasks`);

  return {
    parsed: { tasks: finalParsed.tasks || [], overall_reasoning: overallReasoning },
    rawResponse: step4Response || step3Response,
    steps,
    overallReasoning,
    totalTokens: 0,
    inputTokens: 0,
    outputTokens: 0,
    durationMs,
  };
}

async function generateTasksForConsultant(consultantId: string, options?: { dryRun?: boolean; onlyRoleId?: string; forceRun?: boolean }): Promise<number | SimulationResult> {
  const dryRun = options?.dryRun || false;
  const onlyRoleId = options?.onlyRoleId || null;
  const forceRun = options?.forceRun || false;
  console.log(`🧠 [AUTONOMOUS-GEN] Starting generateTasksForConsultant for ${consultantId} (dryRun=${dryRun})`);
  const settings = await getAutonomySettings(consultantId);
  console.log(`🧠 [AUTONOMOUS-GEN] Settings loaded OK for ${consultantId}`);

  if (!dryRun) {
    if (!settings.is_active || settings.autonomy_level < 2) {
      return 0;
    }
  }

  const simulationRoles: SimulationRoleResult[] = [];

  const cId = safeTextParam(consultantId);

  // Check if this consultant is also a client of another consultant
  // If so, their personal client store (email_journey, daily_reflection, consultation) will be
  // included in file search by fetchAgentKbContext, and we need the instruction in each agent's prompt
  let consultantParentId: string | null = null;
  try {
    const parentLookup = await db.execute(sql`SELECT consultant_id FROM users WHERE id = ${consultantId} LIMIT 1`);
    const parentId = (parentLookup.rows[0] as any)?.consultant_id;
    if (parentId && parentId !== consultantId) {
      consultantParentId = parentId;
      console.log(`🔗 [AUTONOMOUS-GEN] Consultant ${consultantId} is also a client of ${consultantParentId} — personal store will be included`);
    }
  } catch (err: any) {
    console.warn(`⚠️ [AUTONOMOUS-GEN] Failed to check parent consultant: ${err.message}`);
  }

  const enabledRolesResult = await db.execute(sql`
    SELECT enabled_roles FROM ai_autonomy_settings WHERE consultant_id::text = ${cId} LIMIT 1
  `);
  const enabledRoles: Record<string, boolean> = (enabledRolesResult.rows[0] as any)?.enabled_roles || 
    { alessia: true, millie: true, echo: true, nova: true, stella: true };

  const { getActiveRoles } = await import("./ai-autonomous-roles");
  let activeRoles = getActiveRoles(enabledRoles);

  if (onlyRoleId) {
    activeRoles = activeRoles.filter(r => r.id === onlyRoleId);
    if (activeRoles.length === 0) {
      const allRolesModule = await import("./ai-autonomous-roles");
      const allRoles = Object.values(allRolesModule.AI_ROLES);
      const forcedRole = allRoles.find((r: any) => r.id === onlyRoleId);
      if (forcedRole) {
        activeRoles = [forcedRole];
        console.log(`🧠 [AUTONOMOUS-GEN] Manual trigger: forcing role ${onlyRoleId} even if disabled`);
      }
    }
  }

  if (!dryRun && !onlyRoleId) {
    const globalWithinHours = isWithinWorkingHours(settings);
    const anyRoleHasCustomHours = activeRoles.some(r => settings.role_working_hours?.[r.id]?.start);
    const anyRoleWithinHours = anyRoleHasCustomHours && activeRoles.some(r => isRoleWithinWorkingHours(settings, r.id));

    if (!globalWithinHours && !anyRoleWithinHours) {
      console.log(`🧠 [AUTONOMOUS-GEN] Consultant ${consultantId} outside all working hours (global + per-role), skipping`);
      return 0;
    }
  }
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
    SELECT contact_id::text as contact_id, ai_role FROM ai_scheduled_tasks
    WHERE consultant_id::text = ${cId}
      AND status IN ('scheduled', 'in_progress', 'retry_pending', 'waiting_approval', 'approved')
      AND contact_id IS NOT NULL
  `);
  const pendingTasksByRole: Record<string, Set<string>> = {};
  for (const r of pendingTasksResult.rows as any[]) {
    const role = r.ai_role || '__global__';
    if (!pendingTasksByRole[role]) pendingTasksByRole[role] = new Set();
    pendingTasksByRole[role].add(r.contact_id);
  }

  const recentCompletedResult = await db.execute(sql`
    SELECT contact_id::text as contact_id, ai_role FROM ai_scheduled_tasks
    WHERE consultant_id::text = ${cId}
      AND status = 'completed'
      AND completed_at > NOW() - INTERVAL '24 hours'
      AND contact_id IS NOT NULL
  `);
  const completedTasksByRole: Record<string, Set<string>> = {};
  for (const r of recentCompletedResult.rows as any[]) {
    const role = r.ai_role || '__global__';
    if (!completedTasksByRole[role]) completedTasksByRole[role] = new Set();
    completedTasksByRole[role].add(r.contact_id);
  }

  function getEligibleClientsForRole(roleId: string) {
    const rolePending = pendingTasksByRole[roleId] || new Set();
    const roleCompleted = completedTasksByRole[roleId] || new Set();
    return clients.filter(c => {
      const clientId = c.id?.toString();
      if (!clientId) return false;
      if (rolePending.has(clientId)) return false;
      if (roleCompleted.has(clientId)) return false;
      return true;
    });
  }

  function buildClientsList(filteredClients: any[]) {
    return filteredClients.map(c => ({
      id: c.id,
      name: [c.first_name, c.last_name].filter(Boolean).join(' '),
      email: c.email || 'N/A',
      phone: c.phone_number || 'N/A',
      last_consultation: c.last_consultation_date ? new Date(c.last_consultation_date).toISOString() : 'Mai',
      last_task: c.last_task_date ? new Date(c.last_task_date).toISOString() : 'Mai',
    }));
  }

  function buildAllClientsList(roleId: string) {
    const rolePending = pendingTasksByRole[roleId] || new Set();
    const roleCompleted = completedTasksByRole[roleId] || new Set();
    return clients.map(c => ({
      id: c.id,
      name: [c.first_name, c.last_name].filter(Boolean).join(' '),
      email: c.email || 'N/A',
      phone: c.phone_number || 'N/A',
      last_consultation: c.last_consultation_date ? new Date(c.last_consultation_date).toISOString() : 'Mai',
      last_task: c.last_task_date ? new Date(c.last_task_date).toISOString() : 'Mai',
      has_pending_tasks: rolePending.has(c.id?.toString()),
      recently_completed: roleCompleted.has(c.id?.toString()),
    }));
  }

  const allClientIds = clients.map((c: any) => c.id?.toString()).filter(Boolean);

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
    SELECT t.id, t.contact_id::text as contact_id, t.contact_name, t.task_category, 
           t.ai_instruction, t.status, t.ai_role, t.created_at,
           t.completed_at, t.result_summary
    FROM ai_scheduled_tasks t
    WHERE t.consultant_id::text = ${cId}
      AND t.created_at > NOW() - INTERVAL '7 days'
      AND t.status IN ('scheduled', 'waiting_approval', 'approved', 'cancelled', 'completed', 'failed', 'deferred')
    ORDER BY t.created_at DESC
    LIMIT 40
  `);
  const recentAllTasksSummary = (allRecentTasksResult.rows as any[]).map(t => ({
    id: t.id,
    contact: t.contact_name || t.contact_id || 'N/A',
    category: t.task_category,
    instruction: t.ai_instruction || '',
    status: t.status,
    role: t.ai_role || 'generic',
    created: t.created_at ? new Date(t.created_at).toISOString() : 'N/A',
    result: t.result_summary || null,
  }));

  const recentReasoningResult = await db.execute(sql`
    SELECT description, ai_role, created_at
    FROM ai_activity_log
    WHERE consultant_id = ${cId}
      AND event_type = 'autonomous_analysis'
      AND description IS NOT NULL
      AND description != ''
      AND created_at > NOW() - INTERVAL '3 days'
    ORDER BY created_at DESC
    LIMIT 16
  `);
  const recentReasoningByRole: Record<string, any[]> = {};
  for (const r of recentReasoningResult.rows as any[]) {
    const role = r.ai_role || 'unknown';
    if (!recentReasoningByRole[role]) recentReasoningByRole[role] = [];
    if (recentReasoningByRole[role].length < 2 && r.description) {
      const ts = r.created_at ? new Date(r.created_at).toLocaleString('it-IT', { timeZone: 'Europe/Rome', dateStyle: 'short', timeStyle: 'short' }) : '';
      recentReasoningByRole[role].push({ text: r.description, timestamp: ts });
    }
  }

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
    provider.setFeature?.('ai-task-scheduler');
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
    const fallbackTrackingFeature = { current: 'ai-task-scheduler' };
    aiClient = {
      generateContent: async (params: any) => {
        const result = await trackedGenerateContent(genAI, {
          model: params.model,
          contents: params.contents,
          config: {
            ...params.generationConfig,
          },
        }, { consultantId, feature: fallbackTrackingFeature.current, keySource: 'classifier' });
        const text = typeof result.text === 'function' ? result.text() : (result as any).text;
        return { response: { text: () => text || '', candidates: [] } };
      },
      generateContentStream: async () => { throw new Error('Not supported'); },
      _fallbackTrackingFeature: fallbackTrackingFeature,
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
  const scheduledAt = computeNextWorkingSlot(settings);

  let totalCreated = 0;

  const cycleId = `cycle_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

  console.log(`🧠 [AUTONOMOUS-GEN] Running ${activeRoles.length} AI roles for consultant ${consultantId}: ${activeRoles.map(r => r.name).join(', ')}${dryRun ? ' [DRY-RUN]' : ''} (cycle: ${cycleId})`);

  if (!dryRun) {
    await logActivity(consultantId, {
      event_type: 'autonomous_analysis',
      title: `Siamo in ${activeRoles.length} e ci mettiamo al lavoro!`,
      description: `Io e i colleghi (${activeRoles.map(r => r.name).join(', ')}) iniziamo ad analizzare ${clients.length} clienti`,
      icon: '🧠',
      severity: 'info',
      cycle_id: cycleId,
      event_data: {
        total_clients: clients.length,
        active_roles: activeRoles.map(r => r.id),
        provider_name: providerName,
        provider_model: providerModel,
        recent_tasks_summary: recentTasksSummary.slice(0, 10),
        filter_mode: 'per-role',
      },
    });
  }

  const roleFrequencies: Record<string, string> = settings.role_frequencies || {};

  emitReasoningEvent(consultantId, {
    type: 'cycle_start',
    cycleId: cycleId || `cycle_${Date.now()}`,
    timestamp: Date.now(),
    totalSteps: activeRoles.length,
  });

  for (const role of activeRoles) {
    try {
      const roleEligibleClients = getEligibleClientsForRole(role.id);
      const roleClientsList = buildClientsList(roleEligibleClients);
      const roleAllClientsList = buildAllClientsList(role.id);
      const roleClientIds = roleEligibleClients.map((c: any) => c.id?.toString()).filter(Boolean);
      const rolePendingCount = (pendingTasksByRole[role.id] || new Set()).size;
      const roleCompletedCount = (completedTasksByRole[role.id] || new Set()).size;

      if (role.id !== 'nova' && role.id !== 'marco' && roleEligibleClients.length === 0) {
        console.log(`🧠 [AUTONOMOUS-GEN] [${role.name}] No eligible clients for this role (pending: ${rolePendingCount}, completed24h: ${roleCompletedCount}), skipping`);
        if (dryRun) {
          simulationRoles.push({
            roleId: role.id,
            roleName: role.name,
            skipped: true,
            skipReason: `Nessun cliente idoneo per ${role.name} (${rolePendingCount} con task pendenti di questo ruolo, ${roleCompletedCount} completati <24h)`,
            dataAnalyzed: { totalClients: clients.length, eligibleClients: 0, clientsWithPendingTasks: rolePendingCount, clientsWithRecentCompletion: roleCompletedCount, clientsList: [], roleSpecificData: {} },
            promptSent: '',
            aiResponse: null,
            providerUsed: providerName,
            modelUsed: providerModel,
          });
        }
        continue;
      }

      if (!onlyRoleId && !isRoleWithinWorkingHours(settings, role.id)) {
        console.log(`🧠 [AUTONOMOUS-GEN] [${role.name}] Outside role-specific working hours, skipping`);
        if (dryRun) {
          simulationRoles.push({
            roleId: role.id,
            roleName: role.name,
            skipped: true,
            skipReason: 'Fuori dall\'orario di lavoro specifico del ruolo',
            dataAnalyzed: { totalClients: clients.length, eligibleClients: roleEligibleClients.length, clientsWithPendingTasks: rolePendingCount, clientsWithRecentCompletion: roleCompletedCount, clientsList: [], roleSpecificData: {} },
            promptSent: '',
            aiResponse: null,
            providerUsed: providerName,
            modelUsed: providerModel,
          });
        }
        continue;
      }

      // Per-role autonomy level check
      const effectiveRoleLevel = getEffectiveRoleLevel(settings, role.id);
      if (effectiveRoleLevel < 2) {
        console.log(`🧠 [AUTONOMOUS-GEN] [${role.name}] Role autonomy level too low (${effectiveRoleLevel}), skipping generation`);
        if (dryRun) {
          simulationRoles.push({
            roleId: role.id,
            roleName: role.name,
            skipped: true,
            skipReason: `Livello di autonomia del ruolo troppo basso (${effectiveRoleLevel}/10). Serve almeno livello 2 per generare task.`,
            dataAnalyzed: { totalClients: clients.length, eligibleClients: roleEligibleClients.length, clientsWithPendingTasks: rolePendingCount, clientsWithRecentCompletion: roleCompletedCount, clientsList: [], roleSpecificData: {} },
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
            dataAnalyzed: { totalClients: clients.length, eligibleClients: roleEligibleClients.length, clientsWithPendingTasks: rolePendingCount, clientsWithRecentCompletion: roleCompletedCount, clientsList: roleClientsList, roleSpecificData: {} },
            promptSent: '',
            aiResponse: null,
            providerUsed: providerName,
            modelUsed: providerModel,
          });
        } else {
          await logActivity(consultantId, {
            event_type: 'autonomous_analysis',
            title: `Non posso lavorare — il mio canale è spento`,
            description: `Avrei bisogno del canale "${channelRequired}" ma è disabilitato nelle impostazioni. Attivalo e ci penso io!`,
            icon: '⏭️',
            severity: 'info',
            ai_role: role.id,
            cycle_id: cycleId,
          });
        }
        continue;
      }

      const configuredFrequencyMinutes = parseInt(roleFrequencies[role.id] || '30', 10);
      if (!dryRun && !forceRun && role.id !== 'marco') {
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

      const rolesWithFullClientList = ['marco', 'nova'];
      const useFullClientList = rolesWithFullClientList.includes(role.id);
      const effectiveClientsList = useFullClientList ? roleAllClientsList : roleClientsList;
      const effectiveClientIds = useFullClientList ? allClientIds : roleClientIds;

      console.log(`🧠 [AUTONOMOUS-GEN] [${role.name}] Fetching role-specific data... (clients: ${effectiveClientIds.length}/${clients.length}${useFullClientList ? ' [FULL]' : ' [FILTERED]'})`);
      let roleData: Record<string, any>;
      try {
        roleData = await role.fetchRoleData(consultantId, effectiveClientIds);
        console.log(`🧠 [AUTONOMOUS-GEN] [${role.name}] Role data fetched OK (keys: ${Object.keys(roleData).join(', ')})`);
      } catch (fetchErr: any) {
        console.error(`❌ [AUTONOMOUS-GEN] [${role.name}] fetchRoleData FAILED: ${fetchErr.message}`);
        throw fetchErr;
      }

      const freshAllTasksResult = await db.execute(sql`
        SELECT t.id, t.contact_id::text as contact_id, t.contact_name, t.task_category, 
               t.ai_instruction, t.status, t.ai_role, t.created_at,
               t.completed_at, t.result_summary
        FROM ai_scheduled_tasks t
        WHERE t.consultant_id::text = ${cId}
          AND t.created_at > NOW() - INTERVAL '7 days'
          AND t.status IN ('scheduled', 'waiting_approval', 'approved', 'cancelled', 'completed', 'failed', 'deferred', 'in_progress')
        ORDER BY t.created_at DESC
        LIMIT 40
      `);
      const freshAllTasksSummary = (freshAllTasksResult.rows as any[]).map(t => ({
        id: t.id,
        contact: t.contact_name || t.contact_id || 'N/A',
        category: t.task_category,
        instruction: t.ai_instruction || '',
        status: t.status,
        role: t.ai_role || 'generic',
        created: t.created_at ? new Date(t.created_at).toISOString() : 'N/A',
        result: t.result_summary || null,
      }));

      let prompt = role.buildPrompt({
        clientsList: effectiveClientsList,
        roleData,
        settings,
        romeTimeStr,
        recentCompletedTasks: recentTasksSummary,
        recentAllTasks: freshAllTasksSummary,
        permanentBlocks,
        recentReasoningByRole,
      });

      const reasoningMode = settings.reasoning_mode || 'structured';
      const roleReasoningMode = settings.role_reasoning_modes?.[role.id] || reasoningMode;
      console.log(`🧠 [AUTONOMOUS-GEN] [${role.name}] Reasoning mode: roleSpecific=${settings.role_reasoning_modes?.[role.id] || 'NOT SET'}, global=${reasoningMode}, effective=${roleReasoningMode}`);
      console.log(`🧠 [AUTONOMOUS-GEN] [${role.name}] role_reasoning_modes object:`, JSON.stringify(settings.role_reasoning_modes || {}));
      emitReasoningEvent(consultantId, {
        type: 'role_start',
        cycleId: cycleId || '',
        roleId: role.id,
        roleName: role.name,
        reasoningMode: roleReasoningMode,
        timestamp: Date.now(),
      });
      if (roleReasoningMode === 'structured') {
        const { wrapPromptWithStructuredReasoning } = await import('./ai-autonomous-roles');
        prompt = wrapPromptWithStructuredReasoning(prompt, role.name);
      }

      const activeTasksForRole = freshAllTasksSummary.filter(t => 
        t.role === role.id && ['scheduled', 'waiting_approval', 'approved', 'deferred', 'in_progress'].includes(t.status)
      );
      if (activeTasksForRole.length > 0) {
        prompt += `\n\n--- ISTRUZIONE FOLLOW-UP (OBBLIGATORIA) ---
Hai ${activeTasksForRole.length} task ATTIVI. Se il task che vuoi creare riguarda lo STESSO OBIETTIVO o ARGOMENTO di uno dei tuoi task attivi, NON creare un task nuovo. Usa invece il campo "follow_up_of" nel JSON con l'ID del task esistente.

COME DECIDERE:
- Stesso cliente + stesso argomento → follow_up_of
- Stesso argomento anche se categoria diversa (es. "ADS" in monitoring vs preparation) → follow_up_of
- Argomento completamente diverso → nuovo task (senza follow_up_of)

FORMATO JSON quando è un follow-up:
{
  "follow_up_of": "ID_DEL_TASK_ESISTENTE",
  "ai_instruction": "La nuova istruzione aggiornata (sostituirà quella vecchia)",
  "priority": 2,
  "reasoning": "Perché aggiorno questo task invece di crearne uno nuovo"
}

FORMATO JSON quando è un task nuovo (come prima):
{
  "contact_id": "...",
  "contact_name": "...",
  ... (tutti i campi normali, SENZA follow_up_of)
}
--- FINE ISTRUZIONE FOLLOW-UP ---`;
      }

      // Inject per-agent context: focus priorities + custom context always in system prompt; KB docs follow kbInjectionMode
      try {
        const { fetchAgentContext: fetchCtx, buildAgentContextSection: buildCtxSection } = await import('./ai-autonomous-roles');
        const agentCtx = await fetchCtx(consultantId, role.id);
        const ctxSection = buildCtxSection(agentCtx, role.name);
        if (ctxSection) {
          prompt = prompt + '\n\n' + ctxSection;
          console.log(`🎯 [AUTONOMOUS-GEN] [${role.name}] Injected agent context (${agentCtx?.focusPriorities.length || 0} priorities, KB mode: ${agentCtx?.kbInjectionMode}${agentCtx?.kbForcedFileSearch ? ' [FORCED]' : ''})`);
        }
      } catch (ctxErr: any) {
        console.warn(`⚠️ [AUTONOMOUS-GEN] [${role.name}] Error injecting agent context: ${ctxErr.message}`);
      }

      // Inject chat context (recent conversations + summary) into autonomous analysis
      // Target: ~8k tokens of chat context (roughly 32k chars). Full messages, no truncation.
      try {
        const chatSettingsResult = await db.execute(sql`
          SELECT chat_summaries FROM ai_autonomy_settings WHERE consultant_id::text = ${cId} LIMIT 1
        `);
        const chatSummaries = (chatSettingsResult.rows[0] as any)?.chat_summaries || {};
        const roleChatSummary = chatSummaries[role.id]?.summary || '';

        const recentChatResult = await db.execute(sql`
          SELECT sender, message, created_at FROM agent_chat_messages
          WHERE consultant_id::text = ${cId} AND ai_role = ${role.id}
          ORDER BY created_at DESC LIMIT 80
        `);
        const allChatMsgs = (recentChatResult.rows as any[]).reverse();

        if (roleChatSummary || allChatMsgs.length > 0) {
          let chatSection = '\n\n--- CONTESTO CHAT CON IL CONSULENTE ---\n';
          chatSection += 'Il consulente comunica con te anche via chat diretta. Queste conversazioni sono FONDAMENTALI: contengono richieste, feedback, decisioni e istruzioni dirette. Leggile attentamente e tienine conto in ogni analisi e decisione.\n';

          if (roleChatSummary) {
            chatSection += `\nRIASSUNTO STORICO CONVERSAZIONI:\n${roleChatSummary}\n`;
          }

          let includedCount = 0;
          if (allChatMsgs.length > 0) {
            const TOKEN_CHAR_LIMIT = 32000;
            let msgsText = '';

            for (const m of allChatMsgs) {
              const sender = m.sender === 'consultant' ? 'Consulente' : role.name;
              const time = new Date(m.created_at).toLocaleString('it-IT', { timeZone: 'Europe/Rome', dateStyle: 'short', timeStyle: 'short' });
              const line = `[${time}] ${sender}: ${m.message}\n`;

              if (msgsText.length + line.length > TOKEN_CHAR_LIMIT) break;
              msgsText += line;
              includedCount++;
            }

            chatSection += `\nMESSAGGI RECENTI (${includedCount} messaggi):\n${msgsText}`;

            if (includedCount < allChatMsgs.length) {
              chatSection += `\n(${allChatMsgs.length - includedCount} messaggi più vecchi omessi — vedi il riassunto storico sopra)\n`;
            }
          }

          chatSection += '\nUSA QUESTE INFORMAZIONI per:\n- Evitare di duplicare richieste già discusse in chat\n- Rispettare le preferenze e decisioni espresse dal consulente\n- Dare MASSIMA priorità a ciò che il consulente ti ha chiesto direttamente\n- Se il consulente ti ha dato un compito in chat, QUEL compito ha priorità su tutto il resto\n';
          chatSection += '--- FINE CONTESTO CHAT ---\n';

          prompt = prompt + chatSection;
          console.log(`💬 [AUTONOMOUS-GEN] [${role.name}] Injected chat context (summary: ${roleChatSummary ? 'yes' : 'no'}, recent msgs: ${includedCount}/${allChatMsgs.length}, chars: ${chatSection.length})`);
        }
      } catch (chatCtxErr: any) {
        console.warn(`⚠️ [AUTONOMOUS-GEN] [${role.name}] Error injecting chat context: ${chatCtxErr.message}`);
      }

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

      // T005: If consultant is also a client of another consultant, inject personal store filtering instruction
      // The personal client store (email_journey, daily_reflection, consultation) is already included
      // in fileSearchStoreNames by fetchAgentKbContext — here we add the prompt-level filter instruction
      if (consultantParentId) {
        prompt = prompt + `\n\n--- NOTA SUL TUO STORE PERSONALE DA CLIENTE ---
Il consulente per cui lavori è anche cliente di un altro consulente e ha accesso al suo store privato personale.
Da quello store, usa ESCLUSIVAMENTE documenti di questi tipi:
- Progressi Email Journey (percorso email personale del consulente)
- Riflessioni giornaliere (journaling personale del consulente)
- Note consulenze personali (sessioni del consulente come cliente)
Non utilizzare altri tipi di documento da quel store privato.
--- FINE NOTA STORE PERSONALE ---`;
        console.log(`🔗 [AUTONOMOUS-GEN] [${role.name}] Injected personal client store filter instruction`);
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

      const roleFeature = `ai-task-${role.id}`;
      if ((aiClient as any)?.trackingContext) {
        (aiClient as any).trackingContext.feature = roleFeature;
      }
      if ((aiClient as any)?._fallbackTrackingFeature) {
        (aiClient as any)._fallbackTrackingFeature.current = roleFeature;
      }

      try {
        await logActivity(consultantId, {
          event_type: 'system_prompt_log',
          title: `System Prompt: ${role.name}`,
          description: prompt.substring(0, 8000),
          ai_role: role.id,
          severity: 'debug',
          event_data: {
            prompt_length: prompt.length,
            model: providerModel,
            provider: providerName,
            file_search: !!agentFileSearchTool,
            clients_in_prompt: effectiveClientsList.length,
            total_clients: clients.length,
            uses_full_client_list: useFullClientList,
            full_prompt: prompt,
          },
        });
        console.log(`📝 [AUTONOMOUS-GEN] [${role.name}] System prompt logged (${prompt.length} chars)`);
        console.log(`\n${'═'.repeat(80)}\n📋 SYSTEM PROMPT — ${role.name.toUpperCase()} (${prompt.length} chars)\n${'═'.repeat(80)}\n${prompt}\n${'═'.repeat(80)}\n`);
      } catch (logErr: any) {
        console.warn(`⚠️ [AUTONOMOUS-GEN] [${role.name}] Failed to log system prompt: ${logErr.message}`);
      }

      let responseText: string | undefined;
      let parsed: { tasks: AutonomousSuggestedTask[], overall_reasoning?: string } = { tasks: [] };
      const useFileSearch = !!agentFileSearchTool;
      let deepThinkUsed = false;
      const reasoningRunId = cycleId || `run_${Date.now()}`;

      if (roleReasoningMode === 'deep_think') {
        deepThinkUsed = true;
        try {
          const deepResult = await executeDeepThinkLoop(
            aiClient!, providerModel, providerName, prompt, role,
            effectiveClientsList, roleData, recentTasksSummary,
            consultantId, cycleId || `cycle_${Date.now()}`,
            agentFileSearchTool, useFileSearch
          );

          parsed = deepResult.parsed;
          responseText = deepResult.rawResponse;

          try {
            await db.execute(sql`
              INSERT INTO ai_reasoning_logs (consultant_id, role_id, role_name, reasoning_mode, run_id,
                overall_reasoning, thinking_steps,
                total_tokens, input_tokens, output_tokens, duration_ms,
                model_used, provider_used, status)
              VALUES (${consultantId}::uuid, ${role.id}, ${role.name}, 'deep_think', ${reasoningRunId},
                ${deepResult.overallReasoning || null},
                ${JSON.stringify(deepResult.steps)}::jsonb,
                ${deepResult.totalTokens}, ${deepResult.inputTokens}, ${deepResult.outputTokens},
                ${deepResult.durationMs},
                ${providerModel}, ${providerName}, 'completed')
            `);
          } catch (logErr: any) {
            console.warn(`⚠️ [AUTONOMOUS-GEN] [${role.name}] Failed to save deep think reasoning log: ${logErr.message}`);
          }
          emitReasoningEvent(consultantId, {
            type: 'role_complete',
            cycleId: cycleId || '',
            roleId: role.id,
            roleName: role.name,
            reasoningMode: roleReasoningMode,
            tasksGenerated: parsed.tasks?.length || 0,
            timestamp: Date.now(),
          });
        } catch (deepErr: any) {
          console.error(`❌ [AUTONOMOUS-GEN] [${role.name}] Deep Think failed: ${deepErr.message}`);
          deepThinkUsed = false;
        }
      }

      if (!deepThinkUsed) {
      for (let attempt = 0; attempt <= 2; attempt++) {
        try {
          const response = await aiClient!.generateContent({
            model: providerModel,
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.3,
              maxOutputTokens: 16384,
              ...(useFileSearch ? {} : { responseMimeType: 'application/json' }),
            },
            ...(useFileSearch ? { tools: [agentFileSearchTool] } : {}),
          });
          try {
            responseText = response.response.text();
          } catch {
            const parts = response.response.candidates?.[0]?.content?.parts || [];
            responseText = parts.filter((p: any) => p.text).map((p: any) => p.text).join('');
          }
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

      const toolCodePattern = /tool_code\s*\n?\s*google[_:]file_search\s*\{/i;
      if (useFileSearch && toolCodePattern.test(responseText)) {
        console.log(`🔄 [AUTONOMOUS-GEN] [${role.name}] Detected tool_code google file_search in text response — executing File Search grounding`);
        const searchQueries = [...responseText.matchAll(/google[_:]file_search\s*\{?\s*query\s*[:=]\s*(?:<[^>]*>|[<«"'])?([^>»"'\n}]+)/gi)]
          .map(m => m[1].replace(/<[^>]*>/g, '').trim()).filter(q => q.length > 3);
        if (searchQueries.length === 0) {
          searchQueries.push('informazioni principali documenti consulente');
        }
        console.log(`🔍 [AUTONOMOUS-GEN] [${role.name}] Extracted ${searchQueries.length} search queries: ${searchQueries.map(q => `"${q}"`).join(', ')}`);

        try {
          let groundedContent = '';
          for (const query of searchQueries.slice(0, 3)) {
            try {
              const searchResponse = await aiClient!.generateContent({
                model: providerModel,
                contents: [{ role: 'user', parts: [{ text: `Cerca nei documenti e riassumi le informazioni rilevanti per: ${query}. Rispondi con un riassunto conciso.` }] }],
                generationConfig: { temperature: 0.1, maxOutputTokens: 4096 },
                tools: [agentFileSearchTool],
              });
              let searchResult = '';
              try { searchResult = searchResponse.response.text(); } catch {
                const parts = searchResponse.response.candidates?.[0]?.content?.parts || [];
                searchResult = parts.filter((p: any) => p.text).map((p: any) => p.text).join('');
              }
              if (searchResult && !toolCodePattern.test(searchResult)) {
                groundedContent += `\n\n--- Risultati ricerca: "${query}" ---\n${searchResult.substring(0, 3000)}`;
                console.log(`✅ [AUTONOMOUS-GEN] [${role.name}] File Search for "${query}": ${searchResult.length} chars`);
              } else {
                console.warn(`⚠️ [AUTONOMOUS-GEN] [${role.name}] File Search for "${query}" returned empty or tool_code`);
              }
            } catch (searchErr: any) {
              console.warn(`⚠️ [AUTONOMOUS-GEN] [${role.name}] File Search query failed: ${searchErr.message}`);
            }
          }

          const enrichedPrompt = groundedContent.length > 50
            ? `${prompt}\n\n${'═'.repeat(60)}\nCONTESTO DAI DOCUMENTI (File Search)\n${'═'.repeat(60)}${groundedContent}\n${'═'.repeat(60)}\n\nBasandoti su TUTTE le informazioni sopra (clienti, contesto operativo E documenti), genera i task nel formato JSON richiesto.`
            : prompt;

          const hasGroundedResults = groundedContent.length > 50;
          if (!hasGroundedResults) {
            console.warn(`⚠️ [AUTONOMOUS-GEN] [${role.name}] File Search grounding returned no usable results — falling back with File Search tool on final call`);
          }
          console.log(`🧠 [AUTONOMOUS-GEN] [${role.name}] Re-calling Gemini with ${hasGroundedResults ? 'enriched context from File Search' : 'original prompt + File Search tool fallback'} for JSON output`);
          const jsonResponse = await aiClient!.generateContent({
            model: providerModel,
            contents: [{ role: 'user', parts: [{ text: enrichedPrompt + '\n\nRispondi ESCLUSIVAMENTE con JSON valido nel formato: {"tasks": [...], "overall_reasoning": "..."}. NON usare tool_code.' }] }],
            generationConfig: {
              temperature: 0.3,
              maxOutputTokens: 16384,
              ...(!hasGroundedResults ? {} : { responseMimeType: 'application/json' }),
            },
            ...(!hasGroundedResults ? { tools: [agentFileSearchTool] } : {}),
          });
          try {
            responseText = jsonResponse.response.text();
          } catch {
            const parts = jsonResponse.response.candidates?.[0]?.content?.parts || [];
            responseText = parts.filter((p: any) => p.text).map((p: any) => p.text).join('');
          }
          console.log(`✅ [AUTONOMOUS-GEN] [${role.name}] JSON response after File Search grounding (${responseText?.length || 0} chars)`);
        } catch (followUpErr: any) {
          console.error(`❌ [AUTONOMOUS-GEN] [${role.name}] File Search grounding failed: ${followUpErr.message}`);
          continue;
        }

        if (!responseText) {
          console.error(`❌ [AUTONOMOUS-GEN] [${role.name}] Empty response after File Search grounding`);
          continue;
        }
      }

      let cleaned = responseText!.replace(/^\uFEFF/, '').replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '').trim();
      if (cleaned.startsWith('```json')) cleaned = cleaned.slice(7);
      else if (cleaned.startsWith('```')) cleaned = cleaned.slice(3);
      if (cleaned.endsWith('```')) cleaned = cleaned.slice(0, -3);
      cleaned = cleaned.trim();

      const repairTruncatedJson = (text: string): any | null => {
        try { return JSON.parse(text); } catch {}
        let tasksArr: any[] | null = null;
        let reasoning = '';
        const tasksMatch = text.match(/"tasks"\s*:\s*\[/);
        if (tasksMatch) {
          const startIdx = tasksMatch.index! + tasksMatch[0].length;
          let depth = 1;
          let i = startIdx;
          let lastCompleteObj = startIdx;
          for (; i < text.length && depth > 0; i++) {
            const ch = text[i];
            if (ch === '"') {
              i++;
              while (i < text.length && text[i] !== '"') { if (text[i] === '\\') i++; i++; }
            } else if (ch === '{' || ch === '[') {
              depth++;
            } else if (ch === '}' || ch === ']') {
              depth--;
              if (depth === 1 && ch === '}') lastCompleteObj = i + 1;
              if (depth === 0 && ch === ']') lastCompleteObj = i + 1;
            }
          }
          const arrContent = text.substring(startIdx, depth > 0 ? lastCompleteObj : i - 1);
          try {
            tasksArr = JSON.parse(`[${arrContent}]`);
          } catch {
            const trimmed = arrContent.replace(/,\s*$/, '');
            try { tasksArr = JSON.parse(`[${trimmed}]`); } catch {}
          }
        }
        const reasoningMatch = text.match(/"reasoning"\s*:\s*\{/);
        if (reasoningMatch) {
          const rStart = reasoningMatch.index! + reasoningMatch[0].length;
          let depth = 1;
          let i = rStart;
          for (; i < text.length && depth > 0; i++) {
            const ch = text[i];
            if (ch === '"') { i++; while (i < text.length && text[i] !== '"') { if (text[i] === '\\') i++; i++; } }
            else if (ch === '{') depth++;
            else if (ch === '}') depth--;
          }
          if (depth === 0) {
            try {
              const rObj = JSON.parse(`{${text.substring(rStart, i - 1)}}`);
              reasoning = [rObj.observation, rObj.reflection, rObj.decision].filter(Boolean).join('\n\n');
            } catch {}
          }
        }
        const overallMatch = text.match(/"overall_reasoning"\s*:\s*"((?:[^"\\]|\\.)*)"/);
        if (overallMatch) reasoning = overallMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"') || reasoning;
        if (tasksArr !== null) {
          console.log(`🔧 [JSON-REPAIR] Recovered ${tasksArr.length} tasks from truncated JSON (original ${text.length} chars)`);
          return { tasks: tasksArr, overall_reasoning: reasoning || 'Reasoning troncato dal modello', _repaired: true };
        }
        return null;
      };

      const escapeNewlinesInStrings = (text: string): string => {
        return text.replace(/"(?:[^"\\]|\\.)*"/g, (match) => {
          return match.replace(/\r\n/g, '\\n').replace(/\r/g, '\\r').replace(/\n/g, '\\n').replace(/\t/g, '\\t');
        });
      };

      try {
        parsed = JSON.parse(cleaned);
      } catch (e1) {
        try {
          const preFixed = escapeNewlinesInStrings(cleaned);
          parsed = JSON.parse(preFixed);
        } catch {
          const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            try {
              const repaired = escapeNewlinesInStrings(jsonMatch[0]);
              parsed = JSON.parse(repaired);
            } catch {
              try {
                const fixed = escapeNewlinesInStrings(jsonMatch[0]).replace(/,\s*([}\]])/g, '$1');
                parsed = JSON.parse(fixed);
              } catch {
                if (useFileSearch && /google[_:]file_search/i.test(responseText)) {
                  console.warn(`⚠️ [AUTONOMOUS-GEN] [${role.name}] Response is tool_code file_search (not JSON) — doing grounding retry`);
                  const retryQueries = [...responseText.matchAll(/google[_:]file_search\s*\{?\s*query\s*[:=]\s*(?:<[^>]*>|[<«"'])?([^>»"'\n}]+)/gi)]
                    .map(m => m[1].replace(/<[^>]*>/g, '').trim()).filter(q => q.length > 3);
                  if (retryQueries.length === 0) retryQueries.push('informazioni principali documenti consulente');
                  console.log(`🔍 [AUTONOMOUS-GEN] [${role.name}] Retry queries: ${retryQueries.map(q => `"${q}"`).join(', ')}`);
                  let retryContext = '';
                  for (const rq of retryQueries.slice(0, 3)) {
                    try {
                      const sr = await aiClient!.generateContent({
                        model: providerModel,
                        contents: [{ role: 'user', parts: [{ text: `Cerca nei documenti: ${rq}. Rispondi con un riassunto conciso.` }] }],
                        generationConfig: { temperature: 0.1, maxOutputTokens: 4096 },
                        tools: [agentFileSearchTool],
                      });
                      let srText = '';
                      try { srText = sr.response.text(); } catch { srText = (sr.response.candidates?.[0]?.content?.parts || []).filter((p: any) => p.text).map((p: any) => p.text).join(''); }
                      if (srText && !/google[_:]file_search/i.test(srText)) {
                        retryContext += `\n--- ${rq} ---\n${srText.substring(0, 3000)}`;
                      }
                    } catch {}
                  }
                  const retryPrompt = retryContext.length > 50
                    ? `${prompt}\n\nCONTESTO DAI DOCUMENTI:\n${retryContext}\n\nGenera i task in JSON.`
                    : prompt;
                  try {
                    const retryResp = await aiClient!.generateContent({
                      model: providerModel,
                      contents: [{ role: 'user', parts: [{ text: retryPrompt + '\n\nRispondi SOLO con JSON valido: {"tasks": [...], "overall_reasoning": "..."}. NON usare tool_code.' }] }],
                      generationConfig: { temperature: 0.3, maxOutputTokens: 16384, responseMimeType: 'application/json' },
                    });
                    let retryText = '';
                    try { retryText = retryResp.response.text(); } catch { retryText = (retryResp.response.candidates?.[0]?.content?.parts || []).filter((p: any) => p.text).map((p: any) => p.text).join(''); }
                    if (retryText) {
                      const retryClean = retryText.replace(/^\uFEFF/, '').replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '').trim();
                      parsed = JSON.parse(retryClean);
                      console.log(`✅ [AUTONOMOUS-GEN] [${role.name}] Grounding retry succeeded: ${parsed.tasks?.length || 0} tasks`);
                    } else {
                      console.error(`❌ [AUTONOMOUS-GEN] [${role.name}] Grounding retry returned empty`);
                      continue;
                    }
                  } catch (retryErr: any) {
                    console.error(`❌ [AUTONOMOUS-GEN] [${role.name}] Grounding retry failed: ${retryErr.message}`);
                    continue;
                  }
                } else {
                  const repaired = repairTruncatedJson(escapeNewlinesInStrings(cleaned));
                  if (repaired) {
                    parsed = repaired;
                    console.log(`🔧 [AUTONOMOUS-GEN] [${role.name}] Recovered truncated JSON: ${parsed.tasks?.length || 0} tasks`);
                  } else {
                    console.error(`❌ [AUTONOMOUS-GEN] [${role.name}] Could not parse Gemini JSON response`);
                    console.error(`❌ [AUTONOMOUS-GEN] [${role.name}] Raw first 800 chars: ${responseText.substring(0, 800)}`);
                    console.error(`❌ [AUTONOMOUS-GEN] [${role.name}] Raw last 200 chars: ${responseText.substring(responseText.length - 200)}`);
                    console.error(`❌ [AUTONOMOUS-GEN] [${role.name}] First char code: ${responseText.charCodeAt(0)}, length: ${responseText.length}, hasFileSearch: ${useFileSearch}`);
                    continue;
                  }
                }
              }
            }
          } else {
            const arrayMatch = cleaned.match(/\[[\s\S]*\]/);
            if (arrayMatch) {
              try {
                const arr = JSON.parse(arrayMatch[0]);
                parsed = { tasks: Array.isArray(arr) ? arr : [] };
              } catch {
                console.error(`❌ [AUTONOMOUS-GEN] [${role.name}] Could not parse array response`);
                console.error(`❌ [AUTONOMOUS-GEN] [${role.name}] Raw first 800 chars: ${responseText.substring(0, 800)}`);
                continue;
              }
            } else {
              const repaired2 = repairTruncatedJson(escapeNewlinesInStrings(cleaned));
              if (repaired2) {
                parsed = repaired2;
                console.log(`🔧 [AUTONOMOUS-GEN] [${role.name}] Recovered truncated JSON (no-match path): ${parsed.tasks?.length || 0} tasks`);
              } else {
                console.error(`❌ [AUTONOMOUS-GEN] [${role.name}] No JSON found in response (length: ${responseText.length}, firstCharCode: ${responseText.charCodeAt(0)})`);
                console.error(`❌ [AUTONOMOUS-GEN] [${role.name}] Raw first 800 chars: ${responseText.substring(0, 800)}`);
                console.error(`❌ [AUTONOMOUS-GEN] [${role.name}] Raw last 200 chars: ${responseText.substring(responseText.length - 200)}`);
                continue;
              }
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

      const reasoningData = (parsed as any).reasoning || {};
      let overallReasoning = parsed.overall_reasoning || 
        [reasoningData.observation, reasoningData.reflection, reasoningData.decision].filter(Boolean).join('\n\n');
      if (!parsed.overall_reasoning && overallReasoning) {
        parsed.overall_reasoning = overallReasoning;
      }

      if (role.id === 'marco') {
        const hasMarcoEmojis = overallReasoning && /📊|⚠️|💡|🎯/.test(overallReasoning);
        if (!hasMarcoEmojis && reasoningData.observation) {
          const marcoOverall = [
            reasoningData.observation ? `📊 Quadro generale\n${reasoningData.observation}` : '',
            reasoningData.reflection ? `⚠️ Criticità e problemi\n${reasoningData.reflection}` : '',
            reasoningData.decision ? `💡 Opportunità e leve strategiche\n${reasoningData.decision}` : '',
            reasoningData.self_review ? `🎯 Cosa devi fare\n${reasoningData.self_review}` : '',
          ].filter(Boolean).join('\n\n');
          if (marcoOverall) {
            overallReasoning = marcoOverall;
            parsed.overall_reasoning = marcoOverall;
            console.log(`🔄 [AUTONOMOUS-GEN] [Marco] Rebuilt overall_reasoning with 📊/⚠️/💡/🎯 sections from structured reasoning`);
          }
        } else if (hasMarcoEmojis) {
          console.log(`✅ [AUTONOMOUS-GEN] [Marco] overall_reasoning already has 📊/⚠️/💡/🎯 sections — preserved`);
        }
      }

      try {
        await db.execute(sql`
          INSERT INTO ai_reasoning_logs (consultant_id, role_id, role_name, reasoning_mode, run_id,
            observation, reflection, decision, self_review, overall_reasoning,
            model_used, provider_used, status)
          VALUES (${consultantId}::uuid, ${role.id}, ${role.name}, ${roleReasoningMode}, ${reasoningRunId},
            ${reasoningData.observation || null}, ${reasoningData.reflection || null}, 
            ${reasoningData.decision || null}, ${reasoningData.self_review || null},
            ${overallReasoning || null},
            ${providerModel}, ${providerName}, 'completed')
        `);
      } catch (reasoningLogErr: any) {
        console.warn(`⚠️ [AUTONOMOUS-GEN] [${role.name}] Failed to save reasoning log: ${reasoningLogErr.message}`);
      }
      emitReasoningEvent(consultantId, {
        type: 'role_complete',
        cycleId: cycleId || '',
        roleId: role.id,
        roleName: role.name,
        reasoningMode: roleReasoningMode,
        tasksGenerated: parsed.tasks?.length || 0,
        timestamp: Date.now(),
      });
      } // end if (!deepThinkUsed)

      let totalCreatedForRole = 0;
      let totalRejectedForRole = 0;
      const rejectedReasons: Array<{ contact_name: string; reason: string }> = [];
      const createdTasksData: Array<{ task_id: string; contact_name: string; category: string; channel: string }> = [];

      if (!dryRun) {
        await logActivity(consultantId, {
          event_type: 'autonomous_analysis',
          title: parsed.tasks && parsed.tasks.length > 0
            ? `Ho analizzato tutto e ho ${parsed.tasks.length} cose da fare!`
            : `Ho dato un'occhiata... per ora è tutto a posto`,
          description: parsed.overall_reasoning || 
            (parsed.tasks && parsed.tasks.length > 0
              ? `Ho studiato i dati e suggerisco ${parsed.tasks.length} azioni da intraprendere.`
              : `Ho controllato la situazione ma non ci sono interventi urgenti al momento.`),
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
            clients_list: roleClientsList.slice(0, 20),
            role_specific_data: roleData,
            excluded_clients: {
              with_pending_tasks: rolePendingCount,
              with_recent_completion: roleCompletedCount,
            },
            recent_tasks_summary: recentTasksSummary.slice(0, 10),
            total_clients: clients.length,
            eligible_clients: roleEligibleClients.length,
          },
        });
      }

      const tasksToProcess = (parsed.tasks && Array.isArray(parsed.tasks)) ? parsed.tasks.slice(0, role.maxTasksPerRun) : [];

      const existingRoleTasks = await db.execute(sql`
        SELECT id, ai_instruction, task_category, contact_id, 
               contact_name, status, created_at
        FROM ai_scheduled_tasks 
        WHERE consultant_id = ${sql.raw(`'${consultantId}'::uuid`)}
          AND ai_role = ${role.id}
          AND status IN ('scheduled', 'waiting_approval', 'approved', 'deferred', 'in_progress')
        ORDER BY created_at DESC
        LIMIT 50
      `);
      const existingTasks = existingRoleTasks.rows as any[];

      if (dryRun) {
        const tasksWouldCreate = tasksToProcess
          .filter(t => t.ai_instruction)
          .filter(t => !(t.contact_id && ((pendingTasksByRole[role.id] || new Set()).has(t.contact_id) || (completedTasksByRole[role.id] || new Set()).has(t.contact_id))))
          .filter(t => {
            if (!t.contact_id || permanentBlocks.length === 0) return true;
            return !permanentBlocks.some(b => {
              if (b.contactId !== t.contact_id) return false;
              if (b.role && b.role !== role.id) return false;
              if (b.category && b.category !== (t.task_category || role.categories[0])) return false;
              return true;
            });
          })
          .filter(t => {
            const cat = t.task_category || role.categories[0] || 'followup';
            if (settings.allowed_task_categories && settings.allowed_task_categories.length > 0 && !settings.allowed_task_categories.includes(cat)) return false;
            return true;
          })
          .filter(t => {
            if (!t.ai_instruction || existingTasks.length === 0) return true;
            const dupResult = existingTasks.map(et => isDuplicateTask(
              t.ai_instruction,
              et.ai_instruction || '',
              t.contact_id,
              et.contact_id
            )).find(r => r.isDuplicate);
            if (dupResult) return false;
            return true;
          })
          .map(t => ({
            contactName: t.contact_name || 'N/A',
            contactId: t.contact_id || null,
            category: t.task_category || role.categories[0] || 'followup',
            instruction: t.ai_instruction,
            reasoning: t.reasoning || '',
            channel: t.preferred_channel || role.preferredChannels[0] || 'none',
            priority: Math.min(Math.max(t.priority || 3, 1), 4),
            followUpOf: t.follow_up_of || null,
            urgency: t.urgency || 'normale',
            wouldBeStatus: getTaskStatusForRole(settings, role.id),
          }));

        simulationRoles.push({
          roleId: role.id,
          roleName: role.name,
          skipped: false,
          dataAnalyzed: {
            totalClients: clients.length,
            eligibleClients: roleEligibleClients.length,
            clientsWithPendingTasks: rolePendingCount,
            clientsWithRecentCompletion: roleCompletedCount,
            clientsList: roleClientsList,
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
        totalCreatedForRole = tasksWouldCreate.length;
        try {
          await db.execute(sql`
            UPDATE ai_reasoning_logs 
            SET tasks_created = ${totalCreatedForRole}, tasks_rejected = ${totalRejectedForRole},
                rejected_reasons = ${JSON.stringify(rejectedReasons)}::jsonb,
                tasks_data = ${JSON.stringify(tasksWouldCreate.map((t: any) => ({ contact_name: t.contactName, category: t.category, channel: t.channel })))}::jsonb
            WHERE run_id = ${reasoningRunId} AND role_id = ${role.id} AND consultant_id = ${consultantId}::uuid
          `);
        } catch {}
      } else {
        if (!parsed.tasks || !Array.isArray(parsed.tasks) || parsed.tasks.length === 0) {
          console.log(`🧠 [AUTONOMOUS-GEN] [${role.name}] No tasks suggested`);
          try {
            await db.execute(sql`
              UPDATE ai_reasoning_logs 
              SET tasks_created = 0, tasks_rejected = 0,
                  rejected_reasons = '[]'::jsonb,
                  tasks_data = '[]'::jsonb
              WHERE run_id = ${reasoningRunId} AND role_id = ${role.id} AND consultant_id = ${consultantId}::uuid
            `);
          } catch {}
          continue;
        }

        for (const suggestedTask of tasksToProcess) {
          try {
            if (!suggestedTask.ai_instruction) {
              totalRejectedForRole++;
              rejectedReasons.push({ contact_name: suggestedTask.contact_name || 'N/A', reason: 'missing ai_instruction' });
              continue;
            }

            // Check if task category is in allowed categories
            const taskCat = suggestedTask.task_category || role.categories[0] || 'followup';
            if (settings.allowed_task_categories && settings.allowed_task_categories.length > 0 && !settings.allowed_task_categories.includes(taskCat)) {
              console.log(`🚫 [AUTONOMOUS-GEN] [${role.name}] Task category "${taskCat}" not in allowed categories, skipping`);
              totalRejectedForRole++;
              rejectedReasons.push({ contact_name: suggestedTask.contact_name || 'N/A', reason: `category "${taskCat}" not allowed` });
              continue;
            }

            const rolePendingSet = pendingTasksByRole[role.id] || new Set();
            const roleCompletedSet = completedTasksByRole[role.id] || new Set();
            if (suggestedTask.contact_id && (rolePendingSet.has(suggestedTask.contact_id) || roleCompletedSet.has(suggestedTask.contact_id))) {
              totalRejectedForRole++;
              rejectedReasons.push({ contact_name: suggestedTask.contact_name || 'N/A', reason: 'pending or recently completed task exists' });
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
                totalRejectedForRole++;
                rejectedReasons.push({ contact_name: suggestedTask.contact_name || 'N/A', reason: 'permanent block rule' });
                continue;
              }
            }

            if (suggestedTask.ai_instruction && existingTasks.length > 0) {
              const dupResult = existingTasks.map(et => isDuplicateTask(
                suggestedTask.ai_instruction,
                et.ai_instruction || '',
                suggestedTask.contact_id,
                et.contact_id
              )).find(r => r.isDuplicate);

              if (dupResult) {
                console.log(`🔄 [AUTONOMOUS-GEN] [${role.name}] Duplicate task skipped for ${suggestedTask.contact_name}: ${dupResult.reason}`);
                totalRejectedForRole++;
                rejectedReasons.push({ contact_name: suggestedTask.contact_name || 'N/A', reason: `Duplicato: ${dupResult.reason}` });
                continue;
              }
            }

            // === FOLLOW-UP HANDLING ===
            // 1. Explicit follow_up_of from Gemini (AI decided it's a follow-up)
            // Aggregates into the existing task: appends context, updates instruction, bumps priority
            if (suggestedTask.follow_up_of) {
              const followUpId = suggestedTask.follow_up_of;
              const existingCheck = await db.execute(sql`
                SELECT id, status, ai_instruction, task_category
                FROM ai_scheduled_tasks
                WHERE id = ${followUpId}
                  AND consultant_id = ${consultantId}::uuid
                  AND status IN ('scheduled', 'waiting_approval', 'approved', 'deferred', 'in_progress')
                LIMIT 1
              `);

              if (existingCheck.rows.length > 0) {
                const existing = existingCheck.rows[0] as any;
                console.log(`🔄 [AUTONOMOUS-GEN] [${role.name}] AI follow_up_of=${followUpId}. Aggregating into existing task (status: ${existing.status}).`);

                const previousInstruction = existing.ai_instruction || '';
                const followUpNote = `\n\n--- Follow-up ${new Date().toLocaleString('it-IT', { timeZone: 'Europe/Rome' })} ---\nIstruzione precedente: ${previousInstruction.substring(0, 300)}\nAggiornamento: ${suggestedTask.ai_instruction?.substring(0, 500) || 'Aggiornamento'}`;
                const newInstruction = suggestedTask.ai_instruction || previousInstruction;
                await db.execute(sql`
                  UPDATE ai_scheduled_tasks
                  SET ai_instruction = ${newInstruction},
                      additional_context = COALESCE(additional_context, '') || ${followUpNote},
                      updated_at = NOW(),
                      priority = GREATEST(priority, ${Math.min(Math.max(suggestedTask.priority || 3, 1), 4)})
                  WHERE id = ${followUpId}
                `);

                await logActivity(consultantId, {
                  event_type: 'autonomous_task_created',
                  title: `Ho aggiornato un task esistente con nuove info`,
                  description: `Ho aggiunto contesto aggiornato al task che avevo già creato. Le nuove informazioni arricchiscono quello che c'era prima.`,
                  icon: '🔄',
                  severity: 'info',
                  task_id: followUpId,
                  contact_name: suggestedTask.contact_name,
                  ai_role: role.id,
                  cycle_id: cycleId,
                });
                void import("../telegram/telegram-service").then(({ notifyTaskViaTelegram }) =>
                  notifyTaskViaTelegram(consultantId, role.id, 'follow_up', {
                    taskId: followUpId,
                    instruction: suggestedTask.ai_instruction,
                    contactName: suggestedTask.contact_name,
                    taskCategory: suggestedTask.task_category || existing.task_category,
                  })
                ).catch(() => {});
                continue;
              } else {
                console.warn(`⚠️ [AUTONOMOUS-GEN] [${role.name}] follow_up_of=${followUpId} not found or not active. Creating as new task.`);
              }
            }

            // 2. Automatic similarity check (safety net - broader than before: no category constraint, 7-day window)
            const contactIdValue = suggestedTask.contact_id || null;
            const hasValidContactId = contactIdValue && /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(contactIdValue);

            const similarCheck = await db.execute(sql`
              SELECT id, status, ai_instruction, task_category, scheduled_at
              FROM ai_scheduled_tasks
              WHERE consultant_id = ${sql.raw(`'${consultantId}'::uuid`)}
                AND ai_role = ${role.id}
                AND status IN ('scheduled', 'waiting_approval', 'approved', 'deferred', 'in_progress')
                AND (
                  (${hasValidContactId ? sql`contact_id = ${contactIdValue}::text::uuid` : sql`FALSE`})
                  OR (${suggestedTask.contact_name ? sql`contact_name = ${suggestedTask.contact_name}` : sql`FALSE`})
                )
                AND created_at > NOW() - interval '7 days'
              ORDER BY created_at DESC
              LIMIT 3
            `);

            if (similarCheck.rows.length > 0) {
              const candidates = similarCheck.rows as any[];
              let matchedExisting: any = null;

              const stopWords = new Set(['questo', 'quella', 'quelli', 'delle', 'della', 'degli', 'nelle', 'nella', 'sulla', 'sulle', 'senza', 'essere', 'avere', 'anche', 'ancora', 'perché', 'quando', 'come', 'dove', 'molto', 'tutti', 'tutto', 'ogni', 'altro', 'altri', 'prima', 'dopo', 'contro', 'verso', 'sotto', 'sopra', 'dentro', 'fuori', 'subito', 'devi', 'deve', 'devono', 'stai', 'sono', 'hanno', 'fatto', 'fare', 'farlo', 'farsi', 'vuoi', 'vuole', 'puoi', 'potenziale', 'cliente', 'clienti', 'consulente', 'consulenza', 'consulenze', 'livello', 'mese', 'month']);
              for (const candidate of candidates) {
                const existingWords = new Set((candidate.ai_instruction || '').toLowerCase().split(/\s+/).filter((w: string) => w.length > 5 && !stopWords.has(w)));
                const newWords = new Set((suggestedTask.ai_instruction || '').toLowerCase().split(/\s+/).filter((w: string) => w.length > 5 && !stopWords.has(w)));
                if (newWords.size < 3) continue;
                let overlap = 0;
                for (const w of newWords) {
                  if (existingWords.has(w)) overlap++;
                }
                const similarity = newWords.size > 0 ? overlap / newWords.size : 0;
                if (similarity >= 0.4) {
                  matchedExisting = candidate;
                  console.log(`🔍 [AUTONOMOUS-GEN] [${role.name}] Word similarity ${(similarity * 100).toFixed(0)}% with task ${candidate.id} (${overlap}/${newWords.size} words)`);
                  break;
                }
              }

              if (matchedExisting) {
                console.log(`🔄 [AUTONOMOUS-GEN] [${role.name}] Similar task detected (${matchedExisting.id}, status=${matchedExisting.status}). Aggregating as follow-up.`);

                const followUpNote = `\n\n--- Follow-up auto ${new Date().toLocaleString('it-IT', { timeZone: 'Europe/Rome' })} ---\n${suggestedTask.ai_instruction?.substring(0, 500) || 'Aggiornamento'}`;
                await db.execute(sql`
                  UPDATE ai_scheduled_tasks
                  SET additional_context = COALESCE(additional_context, '') || ${followUpNote},
                      updated_at = NOW(),
                      priority = GREATEST(priority, ${Math.min(Math.max(suggestedTask.priority || 3, 1), 4)})
                  WHERE id = ${matchedExisting.id}
                `);

                await logActivity(consultantId, {
                  event_type: 'autonomous_task_created',
                  title: `Ho trovato un task simile, aggiungo le nuove info`,
                  description: `C'era già un task aperto per ${suggestedTask.contact_name || 'questo contatto'} — ho aggiunto il nuovo contesto invece di crearne un duplicato`,
                  icon: '🔄',
                  severity: 'info',
                  task_id: matchedExisting.id,
                  contact_name: suggestedTask.contact_name,
                  ai_role: role.id,
                  cycle_id: cycleId,
                });
                void import("../telegram/telegram-service").then(({ notifyTaskViaTelegram }) =>
                  notifyTaskViaTelegram(consultantId, role.id, 'follow_up', {
                    taskId: matchedExisting.id,
                    instruction: suggestedTask.ai_instruction,
                    contactName: suggestedTask.contact_name,
                    taskCategory: suggestedTask.task_category || matchedExisting.task_category,
                  })
                ).catch(() => {});
                continue;
              }
            }

            const taskId = `auto_${role.id}_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

            const taskScheduledAt = computeTaskScheduledAt(suggestedTask.scheduled_for, suggestedTask.urgency, settings, scheduledAt);
            const schedulingReason = suggestedTask.scheduling_reason || null;

            await db.execute(sql`
              INSERT INTO ai_scheduled_tasks (
                id, consultant_id, contact_name, contact_phone, task_type,
                ai_instruction, scheduled_at, timezone, status,
                origin_type, task_category, contact_id, ai_reasoning,
                priority, preferred_channel, tone, urgency,
                max_attempts, recurrence_type, ai_role,
                scheduling_reason, scheduled_by, original_scheduled_at
              ) VALUES (
                ${taskId}, ${sql.raw(`'${consultantId}'::uuid`)}, ${suggestedTask.contact_name || null},
                ${suggestedTask.contact_phone || 'N/A'}, 'ai_task',
                ${suggestedTask.ai_instruction}, ${taskScheduledAt}, 'Europe/Rome',
                ${getTaskStatusForRole(settings, role.id)}, 'autonomous',
                ${suggestedTask.task_category || role.categories[0] || 'followup'},
                ${hasValidContactId ? sql`${contactIdValue}::text::uuid` : sql`NULL`},
                ${suggestedTask.reasoning || null},
                ${Math.min(Math.max(suggestedTask.priority || 3, 1), 4)},
                ${suggestedTask.preferred_channel || role.preferredChannels[0] || 'none'},
                ${suggestedTask.tone || 'professionale'},
                ${suggestedTask.urgency || 'normale'},
                1, 'once', ${role.id},
                ${schedulingReason}, 'ai', ${taskScheduledAt}
              )
            `);

            await logActivity(consultantId, {
              event_type: 'autonomous_task_created',
              title: `Ho creato un nuovo task per ${suggestedTask.contact_name || 'un contatto'}`,
              description: suggestedTask.reasoning || `Ho valutato la situazione e credo sia importante occuparsi di questo`,
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

            const createdStatus = getTaskStatusForRole(settings, role.id);
            const notifyEvent = createdStatus === 'waiting_approval' ? 'waiting_approval' : 'created';
            void import("../telegram/telegram-service").then(({ notifyTaskViaTelegram }) =>
              notifyTaskViaTelegram(consultantId, role.id, notifyEvent as any, {
                taskId,
                instruction: suggestedTask.ai_instruction,
                contactName: suggestedTask.contact_name,
                taskCategory: suggestedTask.task_category || role.categories[0] || 'followup',
              })
            ).catch(() => {});

            if (suggestedTask.contact_id) {
              if (!pendingTasksByRole[role.id]) pendingTasksByRole[role.id] = new Set();
              pendingTasksByRole[role.id].add(suggestedTask.contact_id);
            }
            totalCreated++;
            totalCreatedForRole++;
            createdTasksData.push({
              task_id: taskId,
              contact_name: suggestedTask.contact_name || 'N/A',
              category: suggestedTask.task_category || role.categories[0] || 'followup',
              channel: suggestedTask.preferred_channel || role.preferredChannels[0] || 'none',
            });

            console.log(`✅ [AUTONOMOUS-GEN] [${role.name}] Created task ${taskId} for ${suggestedTask.contact_name} (${suggestedTask.task_category})`);
          } catch (error: any) {
            console.error(`❌ [AUTONOMOUS-GEN] [${role.name}] Failed to create task for ${suggestedTask.contact_name}:`, error.message);
          }
        }
      }

      try {
        await db.execute(sql`
          UPDATE ai_reasoning_logs 
          SET tasks_created = ${totalCreatedForRole}, tasks_rejected = ${totalRejectedForRole},
              rejected_reasons = ${JSON.stringify(rejectedReasons)}::jsonb,
              tasks_data = ${JSON.stringify(createdTasksData)}::jsonb
          WHERE run_id = ${reasoningRunId} AND role_id = ${role.id} AND consultant_id = ${consultantId}::uuid
        `);
      } catch {}

    } catch (error: any) {
      console.error(`❌ [AUTONOMOUS-GEN] [${role.name}] Error:`, error.message);
      if (dryRun) {
        simulationRoles.push({
          roleId: role.id,
          roleName: role.name,
          skipped: false,
          dataAnalyzed: { totalClients: clients?.length || 0, eligibleClients: 0, clientsWithPendingTasks: rolePendingCount, clientsWithRecentCompletion: roleCompletedCount, clientsList: [], roleSpecificData: {} },
          promptSent: '',
          aiResponse: null,
          error: error.message,
          providerUsed: providerName,
          modelUsed: providerModel,
        });
      } else {
        await logActivity(consultantId, {
          event_type: 'autonomous_analysis',
          title: `Ho avuto un problema durante l'analisi...`,
          description: `Non sono riuscito a completare il mio lavoro: ${error.message}`,
          icon: '❌',
          severity: 'error',
          ai_role: role.id,
          cycle_id: cycleId,
        });
      }
    }
  }

  emitReasoningEvent(consultantId, {
    type: 'cycle_complete',
    cycleId: cycleId || '',
    tasksGenerated: totalCreated,
    timestamp: Date.now(),
  });

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

function computeTaskScheduledAt(
  aiScheduledFor: string | undefined,
  urgency: string | undefined,
  settings: { working_hours_start: string; working_hours_end: string; working_days: number[] },
  fallbackDate: Date
): Date {
  if (aiScheduledFor && typeof aiScheduledFor === 'string') {
    try {
      const match = aiScheduledFor.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
      if (match) {
        const [, year, month, day, hour, minute] = match.map(Number);

        const romeOffset = (() => {
          const jan = new Date(year, 0, 1).toLocaleString('en-US', { timeZone: 'Europe/Rome', timeZoneName: 'shortOffset' });
          const jul = new Date(year, 6, 1).toLocaleString('en-US', { timeZone: 'Europe/Rome', timeZoneName: 'shortOffset' });
          const testDate = new Date(year, month - 1, day);
          const testStr = testDate.toLocaleString('en-US', { timeZone: 'Europe/Rome', timeZoneName: 'shortOffset' });
          const offsetMatch = testStr.match(/GMT([+-]\d+)/);
          return offsetMatch ? parseInt(offsetMatch[1]) : 1;
        })();

        const proposed = new Date(Date.UTC(year, month - 1, day, hour - romeOffset, minute, 0, 0));

        const now = new Date();
        if (proposed > now) {
          const [startH] = settings.working_hours_start.split(':').map(Number);
          const [endH] = settings.working_hours_end.split(':').map(Number);
          const proposedRomeDay = new Date(proposed.toLocaleString('en-US', { timeZone: 'Europe/Rome' }));
          const proposedDayOfWeek = proposedRomeDay.getDay() === 0 ? 7 : proposedRomeDay.getDay();
          const isWorkingDay = settings.working_days.includes(proposedDayOfWeek);
          if (isWorkingDay && hour >= Math.max(startH, 8) && hour < Math.min(endH, 19)) {
            console.log(`📅 [SCHEDULING] AI suggested time accepted: ${aiScheduledFor} (Rome) → UTC: ${proposed.toISOString()}`);
            return proposed;
          }
          console.log(`⚠️ [SCHEDULING] AI suggested time ${aiScheduledFor} outside working hours/days (${startH}-${endH}, days: ${settings.working_days}), using fallback`);
        } else {
          console.log(`⚠️ [SCHEDULING] AI suggested time ${aiScheduledFor} is in the past, using fallback`);
        }
      }
    } catch (e) {
      console.log(`⚠️ [SCHEDULING] Failed to parse AI scheduled_for: ${aiScheduledFor}`);
    }
  }

  if (urgency === 'oggi') {
    const offset = Math.floor(Math.random() * 60) + 15;
    return new Date(Date.now() + offset * 60 * 1000);
  }

  const now = new Date();
  if (fallbackDate <= now) {
    console.log(`⚠️ [SCHEDULING] Fallback date ${fallbackDate.toISOString()} is in the past, computing next working slot`);
    return computeNextWorkingSlot(settings);
  }

  return fallbackDate;
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

export interface FollowUpConfig {
  enabled: boolean;
  followUp1Days: number;
  followUp2Days: number;
  maxFollowUps: number;
  followUp1TemplateId: string;
  followUp2TemplateId: string;
  autoApprove: boolean;
}

const FOLLOWUP_DEFAULTS: FollowUpConfig = {
  enabled: true,
  followUp1Days: 3,
  followUp2Days: 7,
  maxFollowUps: 2,
  followUp1TemplateId: 'template_2',
  followUp2TemplateId: 'template_3',
  autoApprove: false,
};

export async function checkEmailFollowUps(consultantId: string, configOverride?: Partial<FollowUpConfig>): Promise<{ followUpsCreated: number }> {
  const LOG = '📧 [EMAIL-FOLLOWUP]';
  let followUpsCreated = 0;

  const cfg: FollowUpConfig = { ...FOLLOWUP_DEFAULTS, ...configOverride };

  if (!cfg.enabled) {
    console.log(`${LOG} Follow-ups disabled for consultant ${consultantId}`);
    return { followUpsCreated: 0 };
  }

  console.log(`${LOG} Config for ${consultantId}: FU1 after ${cfg.followUp1Days}d (tpl: ${cfg.followUp1TemplateId}), FU2 after ${cfg.followUp2Days}d (tpl: ${cfg.followUp2TemplateId}), max: ${cfg.maxFollowUps}, autoApprove: ${cfg.autoApprove}`);

  try {
    const outboundEmails = await db.execute(sql`
      SELECT
        he.id, he.account_id, he.consultant_id, he.message_id, he.thread_id,
        he.subject, he.from_email, he.to_recipients, he.sent_at, he.created_at,
        he.body_text, he.snippet
      FROM hub_emails he
      WHERE he.consultant_id = ${consultantId}
        AND he.direction = 'outbound'
        AND he.processing_status = 'sent'
        AND he.sent_at IS NOT NULL
        AND he.sent_at < NOW() - INTERVAL '1 day' * ${cfg.followUp1Days}
        AND he.sent_at > NOW() - INTERVAL '30 days'
      ORDER BY he.sent_at DESC
      LIMIT 100
    `);

    if (outboundEmails.rows.length === 0) {
      console.log(`${LOG} No outbound emails to check for ${consultantId}`);
      return { followUpsCreated: 0 };
    }

    console.log(`${LOG} Checking ${outboundEmails.rows.length} outbound emails for follow-ups (consultant: ${consultantId})`);

    for (const outEmail of outboundEmails.rows as any[]) {
      try {
        let toRecipients: any[] = [];
        if (typeof outEmail.to_recipients === 'string') {
          try { toRecipients = JSON.parse(outEmail.to_recipients); } catch {}
        } else if (Array.isArray(outEmail.to_recipients)) {
          toRecipients = outEmail.to_recipients;
        }
        const recipientEmail = toRecipients[0]?.email || '';
        if (!recipientEmail) continue;

        const replyCheck = await db.execute(sql`
          SELECT id FROM hub_emails
          WHERE consultant_id = ${consultantId}
            AND direction = 'inbound'
            AND from_email = ${recipientEmail}
            AND (
              in_reply_to = ${outEmail.message_id}
              OR thread_id = ${outEmail.thread_id || ''}
              OR created_at > ${outEmail.sent_at}
            )
          LIMIT 1
        `);

        if (replyCheck.rows.length > 0) {
          await db.execute(sql`
            UPDATE lead_scraper_results
            SET lead_status = 'responded'
            WHERE consultant_id = ${consultantId}
              AND email = ${recipientEmail}
              AND lead_status IN ('nuovo', 'in_outreach', 'contattato')
          `);
          console.log(`${LOG} Reply found for ${recipientEmail} - marking as responded`);
          continue;
        }

        const existingFollowUps = await db.execute(sql`
          SELECT id, result_data FROM ai_scheduled_tasks
          WHERE consultant_id = ${consultantId}
            AND ai_role = 'hunter'
            AND preferred_channel = 'email'
            AND status IN ('scheduled', 'waiting_approval', 'approved', 'in_progress', 'completed')
            AND result_data::text LIKE ${'%' + outEmail.id + '%'}
          ORDER BY created_at ASC
        `);

        let followUpCount = 0;
        let hasCompletedFollowUp1 = false;
        let hasPendingFollowUp = false;

        for (const fu of existingFollowUps.rows as any[]) {
          const rd = typeof fu.result_data === 'string' ? JSON.parse(fu.result_data) : (fu.result_data || {});
          if (rd.follow_up_sequence) {
            followUpCount = Math.max(followUpCount, rd.follow_up_sequence);
            if (rd.follow_up_sequence === 1 && fu.status === 'completed') {
              hasCompletedFollowUp1 = true;
            }
            if (['scheduled', 'waiting_approval', 'approved', 'in_progress'].includes(fu.status)) {
              hasPendingFollowUp = true;
            }
          }
        }

        if (hasPendingFollowUp) continue;
        if (followUpCount >= cfg.maxFollowUps) continue;

        const sentAt = new Date(outEmail.sent_at);
        const now = new Date();
        const daysSinceSent = (now.getTime() - sentAt.getTime()) / (1000 * 60 * 60 * 24);

        let followUpSequence = 0;
        let templateId: string | null = null;

        if (followUpCount === 0 && daysSinceSent >= cfg.followUp1Days) {
          followUpSequence = 1;
          templateId = cfg.followUp1TemplateId;
        } else if (followUpCount === 1 && hasCompletedFollowUp1 && daysSinceSent >= cfg.followUp2Days) {
          followUpSequence = 2;
          templateId = cfg.followUp2TemplateId;
        }

        if (!templateId || followUpSequence === 0) continue;

        const { getTemplateById, selectTemplateForScenario } = await import('../ai/email-templates-library');
        const template = getTemplateById(templateId) || selectTemplateForScenario(followUpSequence === 1 ? 'follow_up_1' : 'follow_up_2');

        const recipientName = toRecipients[0]?.name || recipientEmail.split('@')[0];
        const taskId = `followup_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

        const smtpResult = await db.execute(sql`
          SELECT id FROM email_accounts
          WHERE id = ${outEmail.account_id} AND consultant_id = ${consultantId} AND smtp_host IS NOT NULL
          LIMIT 1
        `);
        if (smtpResult.rows.length === 0) {
          console.log(`${LOG} No SMTP config for account ${outEmail.account_id}, skipping`);
          continue;
        }

        const additionalCtx = JSON.stringify({
          hunter_direct: true,
          follow_up_sequence: followUpSequence,
          original_email_id: outEmail.id,
          lead_email: recipientEmail,
          email_account_id: outEmail.account_id,
          business_name: recipientName,
          template_id: template.id,
          template_name: template.name,
          original_subject: outEmail.subject,
        });

        const resultData = JSON.stringify({
          follow_up_sequence: followUpSequence,
          original_email_id: outEmail.id,
          template_scenario: templateScenario,
          skip_guardrails: false,
        });

        const instruction = `Oggetto: Re: ${outEmail.subject || 'Proposta'}\n\n[Follow-up ${followUpSequence}] Template: ${template.name}\nDestinatario: ${recipientName} <${recipientEmail}>\n\nUsa il template "${template.name}" per generare un follow-up all'email originale.\n\nTemplate di riferimento:\n${template.body}`;

        await db.execute(sql`
          INSERT INTO ai_scheduled_tasks (
            id, consultant_id, contact_phone, contact_name,
            task_type, ai_instruction, scheduled_at, timezone,
            status, priority, task_category, ai_role,
            preferred_channel, additional_context, result_data,
            max_attempts, current_attempt, retry_delay_minutes,
            created_at, updated_at
          ) VALUES (
            ${taskId}, ${consultantId}, '', ${recipientName},
            'ai_task', ${instruction},
            NOW() + INTERVAL '30 minutes',
            'Europe/Rome', ${cfg.autoApprove ? 'approved' : 'waiting_approval'}, 2, 'prospecting', 'hunter',
            'email', ${additionalCtx}::text, ${resultData}::jsonb,
            1, 0, 5,
            NOW(), NOW()
          )
        `);

        followUpsCreated++;
        console.log(`${LOG} Created follow-up ${followUpSequence} for ${recipientEmail} (template: ${template.name}, task: ${taskId})`);

        await logActivity(consultantId, {
          event_type: 'email_followup_scheduled',
          title: `Follow-up ${followUpSequence} schedulato per ${recipientName}`,
          description: `Template: ${template.name} — ${recipientEmail}`,
          icon: '📧',
          severity: 'info',
          task_id: taskId,
          ai_role: 'hunter',
        });
      } catch (emailErr: any) {
        console.error(`${LOG} Error processing email ${outEmail.id}: ${emailErr.message}`);
      }
    }

    console.log(`${LOG} Completed follow-up check for ${consultantId}: ${followUpsCreated} follow-ups created`);
    return { followUpsCreated };
  } catch (error: any) {
    console.error(`${LOG} Error checking follow-ups for ${consultantId}: ${error.message}`);
    return { followUpsCreated: 0 };
  }
}

async function runEmailFollowUpChecks(): Promise<void> {
  const result = await withCronLock('email-followup-checker', async () => {
    console.log('📧 [EMAIL-FOLLOWUP] Starting email follow-up check cycle...');

    const consultantsResult = await db.execute(sql`
      SELECT DISTINCT aas.consultant_id, aas.outreach_config
      FROM ai_autonomy_settings aas
      WHERE aas.is_active = true
        AND (aas.channels_enabled->>'email')::boolean = true
    `);

    const consultants = consultantsResult.rows as { consultant_id: string; outreach_config: any }[];

    if (consultants.length === 0) {
      console.log('📧 [EMAIL-FOLLOWUP] No consultants with email enabled');
      return { checked: 0 };
    }

    let totalFollowUps = 0;

    for (const row of consultants) {
      try {
        let fuConfig: Partial<FollowUpConfig> = {};
        const oc = typeof row.outreach_config === 'string' ? JSON.parse(row.outreach_config) : (row.outreach_config || {});
        if (oc.emailFollowUp) {
          const efu = oc.emailFollowUp;
          fuConfig = {
            enabled: efu.enabled ?? undefined,
            followUp1Days: efu.followUp1Days ?? undefined,
            followUp2Days: efu.followUp2Days ?? undefined,
            maxFollowUps: efu.maxFollowUps ?? undefined,
            followUp1TemplateId: efu.followUp1TemplateId ?? undefined,
            followUp2TemplateId: efu.followUp2TemplateId ?? undefined,
            autoApprove: efu.autoApprove ?? undefined,
          };
        }
        const result = await checkEmailFollowUps(row.consultant_id, fuConfig);
        totalFollowUps += result.followUpsCreated;
      } catch (error: any) {
        console.error(`📧 [EMAIL-FOLLOWUP] Error for consultant ${row.consultant_id}: ${error.message}`);
      }
    }

    console.log(`📧 [EMAIL-FOLLOWUP] Completed. Total follow-ups created: ${totalFollowUps}`);
    return { checked: consultants.length, followUps: totalFollowUps };
  }, { lockDurationMs: 3 * 60 * 1000 });

  if (result === null) {
    return;
  }
}

/**
 * Initialize the AI Task Scheduler CRON job
 */
export function initAITaskScheduler(): void {
  console.log('🤖 [AI-SCHEDULER] Initializing AI Task Scheduler... (BUILD 20260228_0330)');
  
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
  
  cron.schedule('0,30 * * * *', async () => {
    try {
      await runAutonomousTaskGeneration();
    } catch (error: any) {
      console.error('❌ [AUTONOMOUS-GEN] Cron error:', error.message);
    }
  }, {
    timezone: 'Europe/Rome'
  });

  cron.schedule('0 9,14,18 * * *', async () => {
    try {
      await runEmailFollowUpChecks();
    } catch (error: any) {
      console.error('❌ [EMAIL-FOLLOWUP] Cron error:', error.message);
    }
  }, {
    timezone: 'Europe/Rome'
  });
  
  console.log('✅ [AI-SCHEDULER] AI Task Scheduler started (runs every minute)');
  console.log('✅ [AUTONOMOUS-GEN] Autonomous Task Generation started (fixed schedule: XX:00 and XX:30)');
  console.log('✅ [EMAIL-FOLLOWUP] Email Follow-up Checker started (runs at 09:00, 14:00, 18:00)');
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

export async function triggerAutonomousGenerationForConsultant(consultantId: string, roleId?: string): Promise<{ tasksGenerated: number; error?: string }> {
  try {
    const tasksGenerated = await generateTasksForConsultant(consultantId, { onlyRoleId: roleId, forceRun: true }) as number;
    return { tasksGenerated };
  } catch (error: any) {
    console.error(`❌ [AUTONOMOUS-GEN] Manual trigger error for ${consultantId}:`, error.message);
    return { tasksGenerated: 0, error: error.message };
  }
}

export async function simulateTaskGenerationForConsultant(consultantId: string): Promise<SimulationResult> {
  return generateTasksForConsultant(consultantId, { dryRun: true }) as Promise<SimulationResult>;
}
