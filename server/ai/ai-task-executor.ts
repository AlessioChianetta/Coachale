import { GoogleGenAI } from "@google/genai";
import { getAIProvider, getModelForProviderName, getGeminiApiKeyForClassifier, GEMINI_3_MODEL, trackedGenerateContent, quickGenerate, type GeminiClient } from "./provider-factory";
import { db } from "../db";
import { sql, eq } from "drizzle-orm";
import { logActivity } from "../cron/ai-task-scheduler";
import { ExecutionStep, getAutonomySettings, buildRolePersonality, getThinkingBudgetForLevel } from "./autonomous-decision-engine";
import { fetchAgentContext, buildAgentContextSection } from "../cron/ai-autonomous-roles";
import { fileSearchService } from "./file-search-service";
import { fileSearchSyncService } from "../services/file-search-sync-service";
import { searchGoogleMaps, searchGoogleWeb, enrichSearchResults, generateBatchSalesSummaries } from "../services/lead-scraper-service";
import { leadScraperSearches, leadScraperResults, leadScraperActivities, superadminLeadScraperConfig } from "../../shared/schema";
import { checkDailyLimits, checkLeadCooldown, getRemainingLimits } from "../services/outreach-rate-limiter";
import { decrypt } from "../encryption";
import { selectBestTemplate, GOLDEN_RULES, type EmailTemplate } from "./email-templates-library";

const LOG_PREFIX = "⚙️ [TASK-EXECUTOR]";
const _agentDocsLoggedPerTask = new Set<string>();

export interface AITaskInfo {
  id: string;
  consultant_id: string;
  contact_id: string | null;
  contact_phone: string;
  contact_name: string | null;
  ai_instruction: string;
  task_category: string;
  priority: number;
  timezone: string;
  additional_context?: string | null;
  ai_role?: string | null;
  whatsapp_config_id?: string | null;
}

export interface StepExecutionResult {
  success: boolean;
  result: Record<string, any>;
  error?: string;
  duration_ms: number;
}

async function withRetry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      if (attempt === maxRetries) throw err;
      const delay = Math.min(1000 * Math.pow(2, attempt), 10000);
      console.log(`${LOG_PREFIX} Retry ${attempt + 1}/${maxRetries} after ${delay}ms (${err.message})`);
      await new Promise(r => setTimeout(r, delay));
    }
  }
  throw new Error("Unreachable");
}

interface ResolvedProvider {
  client: GeminiClient;
  model: string;
  providerName: string;
}

async function resolveProviderForTask(consultantId: string, aiRole?: string | null): Promise<ResolvedProvider> {
  const featureKey = aiRole ? `ai-task-${aiRole}` : 'ai-task-executor';
  try {
    const provider = await getAIProvider(consultantId, consultantId);
    provider.setFeature?.(featureKey);
    const providerName = provider.metadata?.name || 'Unknown';
    const model = getModelForProviderName(providerName);
    console.log(`${LOG_PREFIX} Provider resolved: ${providerName} (source: ${provider.source}, model: ${model}, feature: ${featureKey})`);
    return { client: provider.client, model, providerName };
  } catch (err: any) {
    console.warn(`${LOG_PREFIX} Provider resolution failed: ${err.message}, using fallback`);
    const apiKey = await getGeminiApiKeyForClassifier();
    if (!apiKey) throw new Error("No Gemini API key available");
    const ai = new GoogleGenAI({ apiKey });
    const fallbackClient: GeminiClient = {
      generateContent: async (params: any) => {
        const result = await trackedGenerateContent(ai, {
          model: params.model,
          contents: params.contents,
          config: {
            ...params.generationConfig,
            ...(params.tools && { tools: params.tools }),
          },
        }, { consultantId, feature: featureKey, keySource: 'classifier' });
        const text = typeof result.text === 'function' ? result.text() : (result as any).text || '';
        return { response: { text: () => text, candidates: [] } };
      },
      generateContentStream: async () => { throw new Error('Not supported in fallback'); },
    };
    return { client: fallbackClient, model: GEMINI_3_MODEL, providerName: 'Google AI Studio (fallback)' };
  }
}

function generateScheduledCallId(): string {
  return `sc_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

function buildFollowUpSection(previousResults: Record<string, any>): string {
  const followUps = previousResults.fetch_client_data?.follow_up_tasks;
  if (!followUps || followUps.length === 0) return "";
  const items = followUps.map((f: any) =>
    `- [${f.ai_role || 'N/A'}] (${f.status}) ${f.contact_name || 'N/A'}: ${f.ai_instruction}${f.result_summary ? ` → Risultato: ${f.result_summary}` : ''}`
  ).join('\n');
  return `\n=== FOLLOW-UP COLLEGATI A QUESTO TASK (${followUps.length}) ===\nQuesti sono sotto-task collegati allo stesso obiettivo. Tienili in considerazione per avere il quadro completo:\n${items}\n`;
}

export interface AgentDocuments {
  systemPromptDocs: { id: string; title: string; content: string; source: 'system_prompt_document' | 'kb_document'; injection_mode: string }[];
  fileSearchStoreNames: string[];
  fileSearchDocTitles: string[];
}

export async function loadAgentDocuments(consultantId: string, agentId: string, taskId: string): Promise<AgentDocuments> {
  const cacheKey = `${taskId}_${agentId}`;
  const result: AgentDocuments = { systemPromptDocs: [], fileSearchStoreNames: [], fileSearchDocTitles: [] };

  try {
    const spdResult = await db.execute(sql`
      SELECT id, title, content, injection_mode
      FROM system_prompt_documents
      WHERE consultant_id = ${consultantId}
        AND is_active = true
        AND jsonb_extract_path_text(target_autonomous_agents, ${agentId}) = 'true'
    `);
    for (const row of spdResult.rows as any[]) {
      if (row.injection_mode === 'system_prompt') {
        result.systemPromptDocs.push({
          id: row.id,
          title: row.title,
          content: row.content,
          source: 'system_prompt_document',
          injection_mode: 'system_prompt',
        });
        console.log(`📄 [AGENT-DOCS] [${agentId.toUpperCase()}] System Prompt doc loaded: "${row.title}" (${row.content.length} chars) [source: Documenti di Sistema]`);
      } else if (row.injection_mode === 'file_search') {
        result.fileSearchDocTitles.push(row.title);
        console.log(`🔍 [AGENT-DOCS] [${agentId.toUpperCase()}] File Search doc: "${row.title}" [source: Documenti di Sistema, mode: file_search]`);
      }
    }

    const kbResult = await db.execute(sql`
      SELECT d.id, d.title, d.file_size, d.status,
        spd.injection_mode as spd_mode, spd.content as spd_content
      FROM agent_knowledge_assignments aka
      JOIN consultant_knowledge_documents d ON d.id = aka.document_id
      LEFT JOIN system_prompt_documents spd ON spd.id = d.id AND spd.consultant_id = ${consultantId}
      WHERE aka.consultant_id = ${consultantId}
        AND aka.agent_id = ${agentId}
        AND d.status = 'indexed'
    `);
    for (const row of kbResult.rows as any[]) {
      const fileSize = Number(row.file_size || 0);
      const alreadyLoaded = result.systemPromptDocs.some(d => d.id === row.id);

      if (row.spd_mode === 'system_prompt' && row.spd_content && !alreadyLoaded) {
        result.systemPromptDocs.push({
          id: row.id,
          title: row.title,
          content: row.spd_content,
          source: 'kb_document',
          injection_mode: 'system_prompt',
        });
        console.log(`📄 [AGENT-DOCS] [${agentId.toUpperCase()}] KB doc loaded inline: "${row.title}" (${row.spd_content.length} chars) [source: Knowledge Base, mode: system_prompt]`);
      } else if (!alreadyLoaded) {
        result.fileSearchDocTitles.push(row.title);
        console.log(`🔍 [AGENT-DOCS] [${agentId.toUpperCase()}] KB doc in File Search: "${row.title}" (${(fileSize / 1024 / 1024).toFixed(1)}MB) [source: Knowledge Base, status: ${row.status}]`);
      }
    }

    if (result.fileSearchDocTitles.length > 0) {
      try {
        const agentStore = await fileSearchSyncService.getAutonomousAgentStore(agentId, consultantId);
        if (agentStore?.googleStoreName) {
          result.fileSearchStoreNames.push(agentStore.googleStoreName);
          console.log(`🗂️ [AGENT-DOCS] [${agentId.toUpperCase()}] Dedicated agent File Search store loaded: ${agentStore.googleStoreName}`);
        }
        const consultantStores = await fileSearchService.getConsultantOwnStores(consultantId);
        for (const storeName of consultantStores) {
          if (!result.fileSearchStoreNames.includes(storeName)) {
            result.fileSearchStoreNames.push(storeName);
          }
        }
        console.log(`🗂️ [AGENT-DOCS] [${agentId.toUpperCase()}] File Search stores loaded: ${result.fileSearchStoreNames.length} stores (agent+consultant) for ${result.fileSearchDocTitles.length} docs`);
      } catch (storeErr: any) {
        console.warn(`⚠️ [AGENT-DOCS] [${agentId.toUpperCase()}] Failed to load stores: ${storeErr.message}`);
      }
    }

    if (!_agentDocsLoggedPerTask.has(cacheKey)) {
      _agentDocsLoggedPerTask.add(cacheKey);
      await logActivity(consultantId, {
        event_type: "agent_documents_loaded",
        title: `Ho ${result.systemPromptDocs.length} documenti caricati e ${result.fileSearchDocTitles.length} pronti per la ricerca`,
        description: [
          ...result.systemPromptDocs.map(d => `📄 "${d.title}" — ce l'ho in memoria`),
          ...result.fileSearchDocTitles.map(t => `🔍 "${t}" — posso cercarlo quando serve`),
        ].join('\n') || 'Non ho documenti assegnati al momento',
        icon: "📚",
        severity: "info",
        task_id: taskId,
      });
    }

  } catch (err: any) {
    console.error(`⚠️ [AGENT-DOCS] [${agentId?.toUpperCase()}] Failed to load documents: ${err.message}`);
  }

  return result;
}

async function updateLeadStatusAfterOutreach(
  task: AITaskInfo,
  stepAction: string,
  result: Record<string, any>,
): Promise<void> {
  let additionalContextData: Record<string, any> = {};
  if (task.additional_context) {
    try { additionalContextData = JSON.parse(task.additional_context); } catch {}
  }

  const leadId = additionalContextData.lead_id;
  if (!leadId) return;

  const isProspecting = task.task_category === 'prospecting' || !!leadId;
  if (!isProspecting) return;

  console.log(`${LOG_PREFIX} [FEEDBACK-LOOP] Updating lead ${leadId} after ${stepAction} (status: ${result.status})`);

  let newLeadStatus: string;
  let activityType: string;
  let activityTitle: string;
  let activityOutcome: string;
  let scheduleRetry = false;

  let detailedType: string;

  if (stepAction === 'voice_call') {
    if (result.status === 'scheduled' || result.call_id) {
      const callStatus = result.call_status || result.status;
      if (callStatus === 'completed' || callStatus === 'answered') {
        newLeadStatus = 'in_trattativa';
        activityType = 'chiamata';
        detailedType = 'voice_call_answered';
        activityTitle = 'Chiamata completata con risposta';
        activityOutcome = 'answered';
      } else if (callStatus === 'no_answer' || callStatus === 'failed' || callStatus === 'busy') {
        newLeadStatus = 'contattato';
        activityType = 'chiamata';
        detailedType = 'voice_call_no_answer';
        activityTitle = 'Chiamata senza risposta';
        activityOutcome = 'no_answer';
        scheduleRetry = true;
      } else if (callStatus === 'rejected' || callStatus === 'not_interested') {
        newLeadStatus = 'non_interessato';
        activityType = 'chiamata';
        detailedType = 'voice_call_rejected';
        activityTitle = 'Lead non interessato (chiamata)';
        activityOutcome = 'not_interested';
      } else {
        newLeadStatus = 'contattato';
        activityType = 'chiamata';
        detailedType = 'voice_call_scheduled';
        activityTitle = 'Chiamata programmata';
        activityOutcome = 'scheduled';
      }
    } else if (result.success === false || result.error) {
      newLeadStatus = 'contattato';
      activityType = 'chiamata';
      detailedType = 'voice_call_failed';
      activityTitle = 'Chiamata fallita';
      activityOutcome = 'failed';
      scheduleRetry = true;
    } else {
      newLeadStatus = 'contattato';
      activityType = 'chiamata';
      detailedType = 'voice_call_attempted';
      activityTitle = 'Tentativo di chiamata';
      activityOutcome = 'attempted';
    }
  } else if (stepAction === 'send_whatsapp') {
    if (result.status === 'sent') {
      newLeadStatus = 'contattato';
      activityType = 'whatsapp_inviato';
      detailedType = 'whatsapp_sent';
      activityTitle = 'WhatsApp inviato con successo';
      activityOutcome = 'sent';
    } else if (result.status === 'failed') {
      newLeadStatus = 'in_outreach';
      activityType = 'whatsapp_inviato';
      detailedType = 'whatsapp_failed';
      activityTitle = 'WhatsApp invio fallito';
      activityOutcome = 'failed';
      scheduleRetry = true;
    } else {
      newLeadStatus = 'in_outreach';
      activityType = 'whatsapp_inviato';
      detailedType = 'whatsapp_skipped';
      activityTitle = 'WhatsApp saltato';
      activityOutcome = 'skipped';
    }
  } else if (stepAction === 'send_email') {
    if (result.status === 'sent') {
      newLeadStatus = 'contattato';
      activityType = 'email_inviata';
      detailedType = 'email_sent';
      activityTitle = 'Email inviata con successo';
      activityOutcome = 'sent';
    } else if (result.status === 'failed') {
      newLeadStatus = 'in_outreach';
      activityType = 'email_inviata';
      detailedType = 'email_failed';
      activityTitle = 'Email invio fallita';
      activityOutcome = 'failed';
      scheduleRetry = true;
    } else {
      newLeadStatus = 'in_outreach';
      activityType = 'email_inviata';
      detailedType = 'email_skipped';
      activityTitle = 'Email saltata';
      activityOutcome = 'skipped';
    }
  } else {
    return;
  }

  try {
    const updateData: Record<string, any> = {
      leadStatus: newLeadStatus,
    };
    if (newLeadStatus === 'contattato' || newLeadStatus === 'in_trattativa') {
      updateData.leadContactedAt = new Date();
    }
    await db
      .update(leadScraperResults)
      .set(updateData)
      .where(eq(leadScraperResults.id, leadId));

    let enrichedDescription: string;
    const enrichedMetadata: Record<string, any> = {
      taskId: task.id,
      aiRole: task.ai_role,
      channel: stepAction === 'voice_call' ? 'voice' : stepAction === 'send_whatsapp' ? 'whatsapp' : 'email',
      detailedType,
      resultStatus: result.status,
      searchId: additionalContextData.search_id,
      businessName: additionalContextData.business_name,
      employee_name: result.employee_name || task.ai_role || 'N/A',
    };

    if (stepAction === 'voice_call') {
      const transcript = result.transcript || result.call_summary || '';
      enrichedDescription = transcript
        ? `Trascrizione/Riepilogo chiamata:\n${transcript}`
        : `Chiamata ${result.call_status || result.status || 'unknown'}. ${result.error ? `Errore: ${result.error}` : ''} ${result.call_id ? `Call ID: ${result.call_id}` : ''}`.trim();
      enrichedMetadata.call_duration = result.call_duration || result.duration || null;
      enrichedMetadata.call_outcome = result.call_status || result.call_outcome || activityOutcome;
      if (result.call_id) enrichedMetadata.call_id = result.call_id;
      if (result.template_used) enrichedMetadata.template_used = result.template_used;
    } else if (stepAction === 'send_whatsapp') {
      const messageContent = result.message_content || result.message_body || result.message_preview || '';
      enrichedDescription = messageContent
        ? `Messaggio WhatsApp inviato:\n${messageContent}`
        : `WhatsApp ${result.status || 'unknown'}. ${result.error ? `Errore: ${result.error}` : ''}`.trim();
      enrichedMetadata.template_name = result.template_name || result.template_used || null;
      if (result.message_preview) enrichedMetadata.message_preview = result.message_preview;
    } else {
      const emailSubject = result.subject || result.email_subject || '';
      const emailBody = result.body || result.body_html || result.email_body || '';
      enrichedDescription = (emailSubject || emailBody)
        ? `Subject: ${emailSubject}\n\n${emailBody}`
        : `Email ${result.status || 'unknown'}. ${result.error ? `Errore: ${result.error}` : ''}`.trim();
      enrichedMetadata.from = result.from || result.from_email || null;
      enrichedMetadata.to = result.to || result.to_email || task.contact_phone || null;
      if (emailSubject) enrichedMetadata.subject = emailSubject;
      if (result.account_name) enrichedMetadata.account_name = result.account_name;
    }

    await db.insert(leadScraperActivities).values({
      leadId,
      consultantId: task.consultant_id,
      type: activityType,
      title: activityTitle,
      description: enrichedDescription,
      outcome: activityOutcome,
      completedAt: new Date(),
      metadata: enrichedMetadata,
    });

    console.log(`${LOG_PREFIX} [FEEDBACK-LOOP] Lead ${leadId} updated: status=${newLeadStatus}, activity=${activityType}${scheduleRetry ? ', retry scheduled' : ''}`);

    const leadDisplayName = additionalContextData.business_name || task.contact_name || 'N/A';
    const channelLabel = stepAction === 'voice_call' ? 'chiamata' : stepAction === 'send_whatsapp' ? 'WhatsApp' : 'email';
    const feedbackMsg = newLeadStatus === 'in_trattativa'
      ? `${leadDisplayName} ha risposto, siamo in trattativa!`
      : newLeadStatus === 'non_interessato'
      ? `${leadDisplayName} non è interessato`
      : newLeadStatus === 'contattato'
      ? `${leadDisplayName} contattato via ${channelLabel}${scheduleRetry ? ', riproverò più avanti' : ''}`
      : `Aggiornamento: ${leadDisplayName} → ${newLeadStatus}`;
    await logActivity(task.consultant_id, {
      event_type: 'outreach_feedback',
      title: `${newLeadStatus === 'in_trattativa' ? '🔥' : newLeadStatus === 'non_interessato' ? '🚫' : '📋'} Aggiornamento: ${leadDisplayName} → ${newLeadStatus === 'in_trattativa' ? 'in trattativa' : newLeadStatus === 'non_interessato' ? 'non interessato' : 'contattato'}`,
      description: feedbackMsg,
      icon: newLeadStatus === 'in_trattativa' ? '🔥' : newLeadStatus === 'non_interessato' ? '🚫' : '📋',
      severity: newLeadStatus === 'in_trattativa' ? 'success' : newLeadStatus === 'non_interessato' ? 'warning' : 'info',
      task_id: task.id,
      contact_name: task.contact_name,
    });

    if (scheduleRetry) {
      try {
        await scheduleFollowUpFromSequence(task, leadId, stepAction, additionalContextData);
      } catch (followUpErr: any) {
        console.warn(`${LOG_PREFIX} [FOLLOW-UP-SEQUENCE] Failed to schedule follow-up: ${followUpErr.message}`);
      }
    }
  } catch (updateErr: any) {
    console.error(`${LOG_PREFIX} [FEEDBACK-LOOP] DB update failed for lead ${leadId}: ${updateErr.message}`);
  }
}

const DEFAULT_FOLLOW_UP_SEQUENCE = [
  { day: 0, channel: "voice" },
  { day: 2, channel: "email" },
  { day: 5, channel: "whatsapp" },
  { day: 10, channel: "voice" },
];

async function scheduleFollowUpFromSequence(
  task: AITaskInfo,
  leadId: string,
  lastStepAction: string,
  additionalContextData: Record<string, any>,
): Promise<void> {
  const settingsResult = await db.execute(sql`
    SELECT outreach_config FROM ai_autonomy_settings
    WHERE consultant_id::text = ${task.consultant_id}::text LIMIT 1
  `);
  const outreachCfg = (settingsResult.rows[0] as any)?.outreach_config || {};
  const followUpSequence: { day: number; channel: string }[] =
    Array.isArray(outreachCfg.follow_up_sequence) && outreachCfg.follow_up_sequence.length > 0
      ? outreachCfg.follow_up_sequence
      : DEFAULT_FOLLOW_UP_SEQUENCE;

  const activitiesResult = await db.execute(sql`
    SELECT COUNT(*)::int as count
    FROM lead_scraper_activities
    WHERE lead_id::text = ${leadId}::text
      AND consultant_id = ${task.consultant_id}
      AND type IN (
        'voice_call_answered', 'voice_call_no_answer', 'voice_call_rejected', 'voice_call_failed',
        'voice_call_attempted', 'voice_call_scheduled',
        'whatsapp_sent', 'whatsapp_failed', 'whatsapp_skipped',
        'email_sent', 'email_failed', 'email_skipped'
      )
  `);
  const outreachAttempts = (activitiesResult.rows[0] as any)?.count || 0;

  const nextStepIndex = Math.max(0, outreachAttempts - 1);
  console.log(`${LOG_PREFIX} [FOLLOW-UP-SEQUENCE] Lead ${leadId}: ${outreachAttempts} total attempts, nextStepIndex=${nextStepIndex}/${followUpSequence.length}`);
  const leadDisplayName = additionalContextData.business_name || task.contact_name || 'N/A';

  if (nextStepIndex >= followUpSequence.length) {
    console.log(`${LOG_PREFIX} [FOLLOW-UP-SEQUENCE] All ${followUpSequence.length} steps exhausted for lead ${leadId}, marking as non_raggiungibile`);

    await db
      .update(leadScraperResults)
      .set({
        leadStatus: 'non_raggiungibile',
        leadNextAction: null,
        leadNextActionDate: null,
      })
      .where(eq(leadScraperResults.id, leadId));

    await db.insert(leadScraperActivities).values({
      leadId,
      consultantId: task.consultant_id,
      type: 'sequence_exhausted',
      title: 'Sequenza follow-up completata senza risposta',
      description: `Tutti i ${followUpSequence.length} tentativi di contatto sono stati esauriti per ${leadDisplayName}. Lead marcato come non raggiungibile.`,
      outcome: 'exhausted',
      completedAt: new Date(),
      metadata: {
        taskId: task.id,
        totalAttempts: outreachAttempts,
        sequenceLength: followUpSequence.length,
      },
    });

    await logActivity(task.consultant_id, {
      event_type: 'follow_up_sequence_exhausted',
      title: `🔚 Sequenza completata per ${leadDisplayName}`,
      description: `Ho provato ${followUpSequence.length} volte a contattare ${leadDisplayName} senza successo. Lo marco come non raggiungibile.`,
      icon: '🔚',
      severity: 'warning',
      task_id: task.id,
      contact_name: task.contact_name,
    });

    return;
  }

  const nextStep = followUpSequence[nextStepIndex];
  const delayMs = nextStep.day * 24 * 60 * 60 * 1000;
  const scheduledAt = new Date(Date.now() + delayMs);

  const channelToAction: Record<string, string> = {
    voice: 'voice',
    whatsapp: 'whatsapp',
    email: 'email',
  };
  const preferredChannel = channelToAction[nextStep.channel] || 'voice';

  const channelLabelMap: Record<string, string> = {
    voice: 'chiamata',
    whatsapp: 'WhatsApp',
    email: 'email',
  };
  const nextChannelLabel = channelLabelMap[nextStep.channel] || nextStep.channel;

  const followUpTaskId = `task_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const followUpInstruction = `Follow-up #${nextStepIndex + 1} per ${leadDisplayName}. Tentativo precedente (${lastStepAction}) non ha avuto successo. Contattare via ${nextChannelLabel}.${additionalContextData.ai_summary ? `\nAnalisi: ${additionalContextData.ai_summary}` : ''}${additionalContextData.sector ? `\nSettore: ${additionalContextData.sector}` : ''}`;

  await db.execute(sql`
    INSERT INTO ai_scheduled_tasks (
      id, consultant_id, contact_phone, contact_name, task_type, ai_instruction,
      scheduled_at, timezone, status, priority, parent_task_id,
      task_category, ai_role, preferred_channel,
      additional_context,
      max_attempts, current_attempt, retry_delay_minutes,
      created_at, updated_at
    ) VALUES (
      ${followUpTaskId}, ${task.consultant_id}, ${task.contact_phone},
      ${task.contact_name || leadDisplayName}, 'ai_task', ${followUpInstruction},
      ${scheduledAt},
      ${task.timezone || 'Europe/Rome'}, 'scheduled', 2, ${task.id},
      'prospecting', ${task.ai_role || 'hunter'}, ${preferredChannel},
      ${JSON.stringify({
        lead_id: leadId,
        search_id: additionalContextData.search_id,
        business_name: leadDisplayName,
        sector: additionalContextData.sector || null,
        ai_summary: additionalContextData.ai_summary || null,
        ai_score: additionalContextData.ai_score || null,
        follow_up_step: nextStepIndex,
        follow_up_total: followUpSequence.length,
        origin_task_id: task.id,
      })},
      1, 0, 5,
      NOW(), NOW()
    )
  `);

  await db
    .update(leadScraperResults)
    .set({
      leadNextAction: `follow_up_${nextStep.channel}`,
      leadNextActionDate: scheduledAt,
    })
    .where(eq(leadScraperResults.id, leadId));

  console.log(`${LOG_PREFIX} [FOLLOW-UP-SEQUENCE] Scheduled step ${nextStepIndex + 1}/${followUpSequence.length} (${nextStep.channel}) for lead ${leadId} in ${nextStep.day} days`);

  await logActivity(task.consultant_id, {
    event_type: 'follow_up_scheduled',
    title: `🔁 Follow-up #${nextStepIndex + 1} per ${leadDisplayName}`,
    description: `Programmo ${nextChannelLabel} tra ${nextStep.day === 0 ? 'poco' : `${nextStep.day} giorni`} (step ${nextStepIndex + 1}/${followUpSequence.length})`,
    icon: '🔁',
    severity: 'info',
    task_id: task.id,
    contact_name: task.contact_name,
  });
}

async function analyzeCallTranscriptAndAct(
  task: AITaskInfo,
  result: Record<string, any>,
): Promise<void> {
  const callStatus = result.call_status || result.status;
  if (callStatus !== 'answered' && callStatus !== 'completed') {
    return;
  }

  const transcript = result.transcript || result.call_summary || '';
  if (!transcript || transcript.length < 20) {
    console.log(`${LOG_PREFIX} [TRANSCRIPT-ANALYSIS] No transcript available for analysis (length: ${transcript.length})`);
    return;
  }

  let additionalContextData: Record<string, any> = {};
  if (task.additional_context) {
    try { additionalContextData = JSON.parse(task.additional_context); } catch {}
  }

  const leadId = additionalContextData.lead_id;
  if (!leadId) {
    console.log(`${LOG_PREFIX} [TRANSCRIPT-ANALYSIS] No lead_id found, skipping transcript analysis`);
    return;
  }

  console.log(`${LOG_PREFIX} [TRANSCRIPT-ANALYSIS] Analyzing transcript for lead ${leadId} (${transcript.length} chars)`);

  try {
    const classificationPrompt = `Analizza questa trascrizione di una chiamata commerciale e classifica l'esito.
Rispondi SOLO con un JSON valido: { "classification": "...", "next_action": "...", "notes": "..." }

Classificazioni possibili:
- wants_info: Il lead ha chiesto informazioni, dettagli, prezzi o materiale informativo
- wants_appointment: Il lead vuole fissare un appuntamento o incontro
- interested_later: Il lead è interessato ma non ora, vuole essere ricontattato più avanti
- not_interested: Il lead non è interessato e non vuole essere ricontattato
- callback_later: Il lead ha chiesto di essere richiamato in un momento specifico
- already_client: Il lead è già cliente o ha già il servizio

Per next_action, descrivi brevemente cosa fare dopo (es: "Inviare email con catalogo", "Fissare appuntamento per giovedì", "Richiamare tra 3 ore", ecc.)
Per notes, riassumi i punti salienti della conversazione.

=== TRASCRIZIONE ===
${transcript}`;

    const apiKey = await getGeminiApiKeyForClassifier();
    if (!apiKey) {
      console.warn(`${LOG_PREFIX} [TRANSCRIPT-ANALYSIS] No API key available, skipping analysis`);
      return;
    }

    const ai = new GoogleGenAI({ apiKey });
    const classificationResult = await trackedGenerateContent(ai, {
      model: GEMINI_3_MODEL,
      contents: [{ role: "user", parts: [{ text: classificationPrompt }] }],
      config: {
        temperature: 0.1,
        maxOutputTokens: 1024,
        thinkingConfig: { thinkingBudget: 0 },
      },
    }, { consultantId: task.consultant_id, feature: 'hunter-transcript-analysis', keySource: 'classifier' });

    const responseText = typeof classificationResult.text === 'function' ? classificationResult.text() : (classificationResult as any).text || '';
    console.log(`${LOG_PREFIX} [TRANSCRIPT-ANALYSIS] Classification response: ${responseText.substring(0, 200)}`);

    let classification: { classification: string; next_action: string; notes: string } = {
      classification: 'interested_later',
      next_action: '',
      notes: '',
    };

    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        classification = JSON.parse(jsonMatch[0]);
      }
    } catch (parseErr: any) {
      console.warn(`${LOG_PREFIX} [TRANSCRIPT-ANALYSIS] Failed to parse classification JSON: ${parseErr.message}`);
      return;
    }

    console.log(`${LOG_PREFIX} [TRANSCRIPT-ANALYSIS] Classification: ${classification.classification}, next_action: ${classification.next_action}`);

    await db.insert(leadScraperActivities).values({
      leadId,
      consultantId: task.consultant_id,
      type: 'ai_transcript_analysis',
      title: `Analisi trascrizione: ${classification.classification}`,
      description: classification.notes || transcript.substring(0, 500),
      outcome: classification.classification,
      completedAt: new Date(),
      metadata: {
        ai_classification: classification.classification,
        ai_next_action: classification.next_action,
        ai_notes: classification.notes,
        transcript_length: transcript.length,
        source_task_id: task.id,
        channel: 'voice',
      },
    });

    let newLeadStatus: string;
    let activityTitle: string;

    switch (classification.classification) {
      case 'wants_info': {
        newLeadStatus = 'in_trattativa';
        activityTitle = 'Lead vuole informazioni — preparo email';

        const emailTaskId = `task_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        const emailInstruction = `[FOLLOW-UP POST-CHIAMATA] Il lead ${task.contact_name || 'Sconosciuto'} ha risposto alla chiamata e vuole informazioni.
Note dalla chiamata: ${classification.notes}
Azione richiesta: ${classification.next_action}

Componi un'email professionale con le informazioni richieste dal lead. Sii specifico e rispondi ai punti emersi nella conversazione.`;

        await db.execute(sql`
          INSERT INTO ai_scheduled_tasks (
            id, consultant_id, contact_phone, contact_name, task_type, ai_instruction,
            scheduled_at, timezone, status, priority, parent_task_id,
            contact_id, task_category, preferred_channel,
            additional_context,
            max_attempts, current_attempt, retry_delay_minutes,
            created_at, updated_at
          ) VALUES (
            ${emailTaskId}, ${task.consultant_id}, ${task.contact_phone},
            ${task.contact_name}, 'follow_up', ${emailInstruction},
            NOW() + interval '30 minutes', ${task.timezone || "Europe/Rome"}, 'scheduled', ${Math.max((task.priority || 1) + 1, 2)}, ${task.id},
            ${task.contact_id}, 'prospecting', 'email',
            ${JSON.stringify({ ...additionalContextData, origin_type: 'hunter_transcript_analysis', ai_classification: classification.classification })},
            3, 0, 5,
            NOW(), NOW()
          )
        `);
        console.log(`${LOG_PREFIX} [TRANSCRIPT-ANALYSIS] Created email follow-up task ${emailTaskId} for wants_info`);
        break;
      }

      case 'wants_appointment': {
        newLeadStatus = 'in_trattativa';
        activityTitle = 'Lead vuole appuntamento';

        await db.insert(leadScraperActivities).values({
          leadId,
          consultantId: task.consultant_id,
          type: 'appointment_requested',
          title: `Appuntamento richiesto dal lead`,
          description: `Il lead ha chiesto un appuntamento durante la chiamata. ${classification.next_action || ''}\nNote: ${classification.notes || ''}`,
          outcome: 'appointment',
          completedAt: new Date(),
          metadata: {
            source_task_id: task.id,
            channel: 'voice',
            ai_classification: classification.classification,
            suggested_date: classification.next_action,
          },
        });
        console.log(`${LOG_PREFIX} [TRANSCRIPT-ANALYSIS] Created appointment activity for lead ${leadId}`);
        break;
      }

      case 'interested_later': {
        newLeadStatus = 'in_trattativa';
        activityTitle = 'Lead interessato — follow-up programmato';

        const followUpTaskId = `task_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        const followUpInstruction = `[FOLLOW-UP] Il lead ${task.contact_name || 'Sconosciuto'} è interessato ma ha chiesto di essere ricontattato più avanti.
Note dalla chiamata: ${classification.notes}
Azione suggerita: ${classification.next_action}

Ricontatta il lead con un messaggio cortese, ricordando la conversazione precedente e chiedendo se è un buon momento.`;

        await db.execute(sql`
          INSERT INTO ai_scheduled_tasks (
            id, consultant_id, contact_phone, contact_name, task_type, ai_instruction,
            scheduled_at, timezone, status, priority, parent_task_id,
            contact_id, task_category,
            additional_context,
            max_attempts, current_attempt, retry_delay_minutes,
            created_at, updated_at
          ) VALUES (
            ${followUpTaskId}, ${task.consultant_id}, ${task.contact_phone},
            ${task.contact_name}, 'follow_up', ${followUpInstruction},
            NOW() + interval '3 days', ${task.timezone || "Europe/Rome"}, 'scheduled', ${task.priority || 1}, ${task.id},
            ${task.contact_id}, 'prospecting',
            ${JSON.stringify({ ...additionalContextData, origin_type: 'hunter_transcript_analysis', ai_classification: classification.classification })},
            3, 0, 5,
            NOW(), NOW()
          )
        `);
        console.log(`${LOG_PREFIX} [TRANSCRIPT-ANALYSIS] Created follow-up task ${followUpTaskId} for interested_later (3 days)`);
        break;
      }

      case 'not_interested': {
        newLeadStatus = 'non_interessato';
        activityTitle = 'Lead non interessato — nessun follow-up';
        console.log(`${LOG_PREFIX} [TRANSCRIPT-ANALYSIS] Lead ${leadId} marked as not interested, no follow-up`);
        break;
      }

      case 'callback_later': {
        newLeadStatus = 'contattato';
        activityTitle = 'Lead chiede richiamata — programmata tra 3 ore';

        const callbackTaskId = `task_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        const callbackInstruction = `[RICHIAMATA] Il lead ${task.contact_name || 'Sconosciuto'} ha chiesto di essere richiamato.
Note dalla chiamata precedente: ${classification.notes}
Azione: ${classification.next_action}

Richiama il lead come richiesto. Ricorda la conversazione precedente e procedi con l'obiettivo commerciale.`;

        await db.execute(sql`
          INSERT INTO ai_scheduled_tasks (
            id, consultant_id, contact_phone, contact_name, task_type, ai_instruction,
            scheduled_at, timezone, status, priority, parent_task_id,
            contact_id, task_category, preferred_channel,
            additional_context,
            max_attempts, current_attempt, retry_delay_minutes,
            created_at, updated_at
          ) VALUES (
            ${callbackTaskId}, ${task.consultant_id}, ${task.contact_phone},
            ${task.contact_name}, 'follow_up', ${callbackInstruction},
            NOW() + interval '3 hours', ${task.timezone || "Europe/Rome"}, 'scheduled', ${Math.max((task.priority || 1) + 1, 2)}, ${task.id},
            ${task.contact_id}, 'prospecting', 'voice',
            ${JSON.stringify({ ...additionalContextData, origin_type: 'hunter_transcript_analysis', ai_classification: classification.classification })},
            3, 0, 5,
            NOW(), NOW()
          )
        `);
        console.log(`${LOG_PREFIX} [TRANSCRIPT-ANALYSIS] Created callback task ${callbackTaskId} for callback_later (3 hours)`);
        break;
      }

      case 'already_client': {
        newLeadStatus = 'già_cliente';
        activityTitle = 'Lead è già cliente — nessun follow-up';
        console.log(`${LOG_PREFIX} [TRANSCRIPT-ANALYSIS] Lead ${leadId} marked as already_client, no follow-up`);
        break;
      }

      default: {
        newLeadStatus = 'contattato';
        activityTitle = `Classificazione: ${classification.classification}`;
        console.log(`${LOG_PREFIX} [TRANSCRIPT-ANALYSIS] Unknown classification: ${classification.classification}`);
      }
    }

    const updateData: Record<string, any> = {
      leadStatus: newLeadStatus,
    };
    if (newLeadStatus === 'in_trattativa' || newLeadStatus === 'contattato') {
      updateData.leadContactedAt = new Date();
    }
    if (classification.next_action) {
      updateData.leadNextAction = classification.next_action;
    }

    await db
      .update(leadScraperResults)
      .set(updateData)
      .where(eq(leadScraperResults.id, leadId));

    await logActivity(task.consultant_id, {
      event_type: 'transcript_analysis_completed',
      title: `🧠 ${activityTitle}`,
      description: `Classificazione: ${classification.classification}. ${classification.notes || ''}\nProssima azione: ${classification.next_action || 'Nessuna'}`,
      icon: '🧠',
      severity: newLeadStatus === 'in_trattativa' ? 'success' : newLeadStatus === 'non_interessato' ? 'warning' : 'info',
      task_id: task.id,
      contact_name: task.contact_name,
    });

    console.log(`${LOG_PREFIX} [TRANSCRIPT-ANALYSIS] Completed: lead ${leadId} → ${newLeadStatus}, classification=${classification.classification}`);

  } catch (err: any) {
    console.error(`${LOG_PREFIX} [TRANSCRIPT-ANALYSIS] Failed to analyze transcript for lead ${leadId}: ${err.message}`);
  }
}

export async function executeStep(
  task: AITaskInfo,
  step: ExecutionStep,
  previousResults: Record<string, any>,
  autonomyModelOverride?: string,
  autonomyThinkingLevelOverride?: string,
): Promise<StepExecutionResult> {
  const startTime = Date.now();
  console.log(`${LOG_PREFIX} Executing step ${step.step}: ${step.action} - ${step.description}`);

  try {
    // Channel enforcement: check if the channel is enabled before executing
    const channelActions = ['voice_call', 'send_email', 'send_whatsapp'];
    if (channelActions.includes(step.action)) {
      const autonomySettings = await getAutonomySettings(task.consultant_id);
      const channelMap: Record<string, string> = {
        'voice_call': 'voice',
        'send_email': 'email',
        'send_whatsapp': 'whatsapp',
      };
      const channelKey = channelMap[step.action];
      const channelName = channelKey.charAt(0).toUpperCase() + channelKey.slice(1);
      if (autonomySettings.channels_enabled && !autonomySettings.channels_enabled[channelKey]) {
        console.log(`${LOG_PREFIX} Channel ${channelKey} disabled, blocking step ${step.action}`);
        return { success: false, result: {}, error: `Canale ${channelName} disabilitato nelle impostazioni di autonomia`, duration_ms: Date.now() - startTime };
      }
    }

    let rolePersonality: string | null = null;
    let agentContextSection = '';
    let agentDocs: AgentDocuments | null = null;
    if (task.ai_role) {
      rolePersonality = await buildRolePersonality(task.consultant_id, task.ai_role);
      try {
        const agentCtx = await fetchAgentContext(task.consultant_id, task.ai_role);
        agentContextSection = buildAgentContextSection(agentCtx, task.ai_role);
        if (agentContextSection) {
          console.log(`${LOG_PREFIX} Loaded agent context for role ${task.ai_role} (${agentContextSection.length} chars)`);
        }
      } catch (ctxErr: any) {
        console.warn(`${LOG_PREFIX} Failed to load agent context for ${task.ai_role}: ${ctxErr.message}`);
      }

      try {
        agentDocs = await loadAgentDocuments(task.consultant_id, task.ai_role, task.id);
        if (agentDocs.systemPromptDocs.length > 0) {
          const docsSection = agentDocs.systemPromptDocs.map(d =>
            `\n=== DOCUMENTO: ${d.title} (${d.source === 'system_prompt_document' ? 'Istruzione di Sistema' : 'Knowledge Base'}) ===\n${d.content}`
          ).join('\n');
          agentContextSection += `\n\n📚 DOCUMENTI ASSEGNATI AL DIPENDENTE (${agentDocs.systemPromptDocs.length} documenti in memoria):${docsSection}`;
          console.log(`${LOG_PREFIX} Injected ${agentDocs.systemPromptDocs.length} system prompt docs into context (${docsSection.length} chars added)`);
        }
        if (agentDocs.fileSearchDocTitles.length > 0) {
          console.log(`${LOG_PREFIX} ${agentDocs.fileSearchDocTitles.length} docs available for File Search: ${agentDocs.fileSearchDocTitles.join(', ')}`);
        }
      } catch (docsErr: any) {
        console.warn(`${LOG_PREFIX} Failed to load agent documents for ${task.ai_role}: ${docsErr.message}`);
      }
    }

    let taskModel = autonomyModelOverride;
    let taskThinkingLevel = autonomyThinkingLevelOverride;
    let taskTemperature: number | undefined;
    try {
      const autonomySettingsForModel = await getAutonomySettings(task.consultant_id);
      taskModel = taskModel || autonomySettingsForModel.autonomy_model;
      taskThinkingLevel = taskThinkingLevel || autonomySettingsForModel.autonomy_thinking_level;
      if (task.ai_role && autonomySettingsForModel.role_temperatures) {
        const roleTemps = typeof autonomySettingsForModel.role_temperatures === 'string'
          ? JSON.parse(autonomySettingsForModel.role_temperatures)
          : (autonomySettingsForModel.role_temperatures || {});
        if (roleTemps[task.ai_role] !== undefined && roleTemps[task.ai_role] !== null) {
          taskTemperature = Number(roleTemps[task.ai_role]);
        }
      }
    } catch { /* use defaults */ }
    taskModel = taskModel || GEMINI_3_MODEL;
    taskThinkingLevel = taskThinkingLevel || 'low';
    if (taskTemperature === undefined || isNaN(taskTemperature)) taskTemperature = 0.3;
    console.log(`${LOG_PREFIX} Using autonomy model=${taskModel}, thinkingLevel=${taskThinkingLevel}, temperature=${taskTemperature} for step ${step.step} (role: ${task.ai_role || 'none'})`);

    let result: Record<string, any>;

    switch (step.action) {
      case "fetch_client_data":
        result = await handleFetchClientData(task, step, previousResults);
        break;
      case "search_private_stores":
        result = await handleSearchPrivateStores(task, step, previousResults, rolePersonality, agentContextSection, agentDocs, taskModel, taskThinkingLevel, taskTemperature);
        break;
      case "analyze_patterns":
        result = await handleAnalyzePatterns(task, step, previousResults, rolePersonality, agentContextSection, taskModel, taskThinkingLevel, taskTemperature);
        break;
      case "generate_report":
        result = await handleGenerateReport(task, step, previousResults, rolePersonality, agentContextSection, taskModel, taskThinkingLevel, taskTemperature);
        break;
      case "prepare_call":
        result = await handlePrepareCall(task, step, previousResults, rolePersonality, agentContextSection, taskModel, taskThinkingLevel, taskTemperature);
        break;
      case "voice_call":
        result = await handleVoiceCall(task, step, previousResults);
        break;
      case "send_email":
        result = await handleSendEmail(task, step, previousResults, agentContextSection, taskModel, taskThinkingLevel, taskTemperature);
        break;
      case "send_whatsapp":
        result = await handleSendWhatsapp(task, step, previousResults, agentContextSection, taskModel, taskThinkingLevel, taskTemperature);
        break;
      case "web_search":
        result = await handleWebSearch(task, step, previousResults, taskModel, taskThinkingLevel, taskTemperature);
        break;
      case "lead_scraper_search":
        result = await handleLeadScraperSearch(task, step, previousResults);
        break;
      case "lead_qualify_and_assign":
        result = await handleLeadQualifyAndAssign(task, step, previousResults);
        break;
      case "batch_outreach":
        result = await handleBatchOutreach(task, step, previousResults, agentContextSection, taskModel, taskThinkingLevel);
        break;
      default:
        throw new Error(`Unknown step action: ${step.action}`);
    }

    const duration_ms = Date.now() - startTime;
    console.log(`${LOG_PREFIX} Step ${step.step} (${step.action}) completed in ${duration_ms}ms`);

    if (['voice_call', 'send_email', 'send_whatsapp'].includes(step.action)) {
      try {
        await updateLeadStatusAfterOutreach(task, step.action, result);
      } catch (feedbackErr: any) {
        console.warn(`${LOG_PREFIX} [FEEDBACK-LOOP] Failed to update lead status: ${feedbackErr.message}`);
      }

      if (step.action === 'voice_call') {
        try {
          await analyzeCallTranscriptAndAct(task, result);
        } catch (transcriptErr: any) {
          console.warn(`${LOG_PREFIX} [TRANSCRIPT-ANALYSIS] Failed to analyze call transcript: ${transcriptErr.message}`);
        }
      }
    }

    let enrichedDescription = step.description;

    if (step.action === 'fetch_client_data' && result) {
      enrichedDescription = `Ho trovato le info su ${result.contact?.first_name || 'N/A'} ${result.contact?.last_name || ''}. Ho ${result.recent_tasks?.length || 0} task recenti da consultare`;
    } else if (step.action === 'search_private_stores' && result) {
      enrichedDescription = `Ho trovato ${result.documents_found || 0} documenti in ${result.stores_searched || 0} archivi. ${result.findings_summary?.substring(0, 200) || ''}`;
    } else if (step.action === 'analyze_patterns' && result) {
      enrichedDescription = `Analisi fatta! Engagement: ${result.engagement_score || 'N/A'}/100, rischio: ${result.risk_assessment?.level || 'N/A'}. Ho ${result.insights?.length || 0} insight e ${result.recommendations?.length || 0} raccomandazioni. ${result.suggested_approach?.substring(0, 150) || ''}`;
    } else if (step.action === 'web_search' && result) {
      enrichedDescription = `Ho cercato "${result.search_query?.substring(0, 80) || 'N/A'}" e trovato ${result.sources?.length || 0} fonti utili. ${result.findings?.substring(0, 200) || ''}`;
    } else if (step.action === 'generate_report' && result) {
      enrichedDescription = `Report pronto: "${result.title || 'N/A'}" — ${result.sections?.length || 0} sezioni, ${result.key_findings?.length || 0} risultati chiave, ${result.recommendations?.length || 0} raccomandazioni`;
    } else if (step.action === 'prepare_call' && result) {
      enrichedDescription = `Script pronto! Ho preparato ${result.talking_points?.length || 0} punti di discussione. Priorità: ${result.call_priority || 'N/A'}, durata stimata: ${result.call_duration_estimate_minutes || 'N/A'} min`;
    } else if (step.action === 'voice_call' && result) {
      enrichedDescription = `Chiamata programmata a ${result.target_phone || 'N/A'} — è tutto pronto!`;
    } else if (step.action === 'send_email' && result) {
      enrichedDescription = result.status === 'sent' ? `Email inviata a ${result.recipient || task.contact_name || 'N/A'}! ${result.subject ? `Oggetto: "${result.subject}"` : ''} ${result.has_attachment ? 'Con PDF allegato.' : ''}` : result.status === 'skipped' ? `Email saltata per ${result.recipient || task.contact_name || 'N/A'}: non c'erano le condizioni` : `Non sono riuscito/a a inviare l'email a ${result.recipient || task.contact_name || 'N/A'}`;
    } else if (step.action === 'send_whatsapp' && result) {
      enrichedDescription = result.status === 'sent' ? `WhatsApp inviato a ${result.target_phone || task.contact_name || 'N/A'}! ${result.message_preview ? `"${result.message_preview}"` : ''}` : result.status === 'skipped' ? `WhatsApp saltato per ${result.target_phone || task.contact_name || 'N/A'}: mancano le condizioni` : `Non sono riuscito/a a inviare su WhatsApp a ${result.target_phone || task.contact_name || 'N/A'}`;
    } else if (step.action === 'lead_scraper_search' && result) {
      enrichedDescription = `Ho cercato '${result.query || 'N/A'}' e trovato ${result.results_count || 0} aziende${result.enrichment_stats ? `. Ho analizzato ${result.enrichment_stats.enriched} siti web${result.enrichment_stats.cached > 0 ? `, ${result.enrichment_stats.cached} già in memoria` : ''}` : ''}`;
    } else if (step.action === 'lead_qualify_and_assign' && result) {
      enrichedDescription = `Ho analizzato ${result.total_leads || 0} aziende: ${result.qualified_count || 0} sono in target (soglia: ${result.score_threshold || 60}). Ho creato ${result.batch_tasks_created || 0} campagne outreach${result.voice_leads ? ` (📞 ${result.voice_leads})` : ''}${result.whatsapp_leads ? ` (💬 ${result.whatsapp_leads})` : ''}${result.email_leads ? ` (📧 ${result.email_leads})` : ''}`;
    } else if (step.action === 'batch_outreach' && result) {
      enrichedDescription = `Campagna finita! ${result.contacted || 0}/${result.total_leads || 0} contattati via ${result.channel || 'N/A'}, ${result.failed || 0} non raggiunti${result.follow_up_created ? `. Programmo follow-up per ${result.follow_up_count || 0} lead` : ''}`;
    }

    const stepActionLabels: Record<string, string> = {
      'lead_scraper_search': '🔍 Ricerca lead',
      'lead_qualify_and_assign': '🧠 Qualifica lead',
      'batch_outreach': '📋 Campagna outreach',
      'fetch_client_data': '📊 Dati cliente',
      'search_private_stores': '🔍 Ricerca documenti',
      'analyze_patterns': '📈 Analisi',
      'generate_report': '📝 Report',
      'prepare_call': '📞 Preparazione chiamata',
      'voice_call': '📞 Chiamata',
      'send_email': '📧 Email',
      'send_whatsapp': '💬 WhatsApp',
      'web_search': '🌐 Ricerca web',
    };
    const stepLabel = stepActionLabels[step.action] || step.action;

    await logActivity(task.consultant_id, {
      event_type: `step_${step.action}_completed`,
      title: `Fatto! ${stepLabel} completato`,
      description: enrichedDescription,
      icon: "✅",
      severity: "info",
      task_id: task.id,
      contact_name: task.contact_name,
      contact_id: task.contact_id,
    });

    return { success: true, result, duration_ms };
  } catch (error: any) {
    const duration_ms = Date.now() - startTime;
    console.error(`${LOG_PREFIX} Step ${step.step} (${step.action}) failed after ${duration_ms}ms:`, error.message);

    await logActivity(task.consultant_id, {
      event_type: `step_${step.action}_failed`,
      title: `❌ Non ci sono riuscito... (step ${step.step}: ${step.action})`,
      description: `Errore: ${error.message}`,
      icon: "❌",
      severity: "error",
      task_id: task.id,
      contact_name: task.contact_name,
      contact_id: task.contact_id,
    });

    return { success: false, result: {}, error: error.message, duration_ms };
  }
}

async function handleFetchClientData(
  task: AITaskInfo,
  _step: ExecutionStep,
  _previousResults: Record<string, any>,
): Promise<Record<string, any>> {
  console.log(`${LOG_PREFIX} Fetching client data for contact_id=${task.contact_id}, phone=${task.contact_phone}`);

  await logActivity(task.consultant_id, {
    event_type: 'step_fetch_client_data_started',
    title: `Sto recuperando le info su ${task.contact_name || 'questo contatto'}... vediamo lo storico`,
    description: `Cerco profilo, consulenze passate, task recenti e conversazioni`,
    icon: '📊',
    severity: 'info',
    task_id: task.id,
    contact_name: task.contact_name,
    contact_id: task.contact_id,
  });

  let contactData: Record<string, any> | null = null;

  if (task.contact_id) {
    const contactResult = await db.execute(sql`
      SELECT id, first_name, last_name, email, phone_number, role, level,
             consultant_id, is_active, enrolled_at, created_at
      FROM users
      WHERE id = ${task.contact_id}
      LIMIT 1
    `);
    if (contactResult.rows.length > 0) {
      const row = contactResult.rows[0] as any;
      contactData = {
        id: row.id,
        first_name: row.first_name,
        last_name: row.last_name,
        email: row.email,
        phone_number: row.phone_number,
        role: row.role,
        level: row.level,
        is_active: row.is_active,
        enrolled_at: row.enrolled_at,
        created_at: row.created_at,
      };
    }
  }

  if (!contactData && task.contact_phone) {
    const phoneResult = await db.execute(sql`
      SELECT id, first_name, last_name, email, phone_number, role, level,
             consultant_id, is_active, enrolled_at, created_at
      FROM users
      WHERE phone_number = ${task.contact_phone}
      LIMIT 1
    `);
    if (phoneResult.rows.length > 0) {
      const row = phoneResult.rows[0] as any;
      contactData = {
        id: row.id,
        first_name: row.first_name,
        last_name: row.last_name,
        email: row.email,
        phone_number: row.phone_number,
        role: row.role,
        level: row.level,
        is_active: row.is_active,
        enrolled_at: row.enrolled_at,
        created_at: row.created_at,
      };
    }
  }

  const contactIdForQuery = contactData?.id || task.contact_id;
  let recentTasks: any[] = [];

  if (contactIdForQuery) {
    const tasksResult = await db.execute(sql`
      SELECT id, task_type, task_category, status, ai_instruction,
             scheduled_at, result_summary, priority
      FROM ai_scheduled_tasks
      WHERE contact_id = ${contactIdForQuery}
      ORDER BY scheduled_at DESC
      LIMIT 10
    `);
    recentTasks = tasksResult.rows.map((row: any) => ({
      id: row.id,
      task_type: row.task_type,
      task_category: row.task_category,
      status: row.status,
      ai_instruction: row.ai_instruction,
      scheduled_at: row.scheduled_at,
      result_summary: row.result_summary,
      priority: row.priority,
    }));
  }

  let followUpTasks: any[] = [];
  try {
    const followUpResult = await db.execute(sql`
      SELECT id, ai_instruction, task_category, status, contact_name, ai_role,
             scheduled_at, created_at, result_summary, priority
      FROM ai_scheduled_tasks
      WHERE parent_task_id = ${task.id} AND consultant_id = ${task.consultant_id}
      ORDER BY created_at ASC
    `);
    followUpTasks = followUpResult.rows.map((row: any) => ({
      id: row.id,
      ai_instruction: row.ai_instruction,
      task_category: row.task_category,
      status: row.status,
      contact_name: row.contact_name,
      ai_role: row.ai_role,
      scheduled_at: row.scheduled_at,
      created_at: row.created_at,
      result_summary: row.result_summary,
      priority: row.priority,
    }));
  } catch (err: any) {
    console.warn(`${LOG_PREFIX} Failed to fetch follow-up tasks: ${err.message}`);
  }

  if (!contactData) {
    const [consultantResult, autonomyResult] = await Promise.all([
      db.execute(sql`
        SELECT id, first_name, last_name, email, phone_number, role
        FROM users WHERE id = ${task.consultant_id} LIMIT 1
      `),
      db.execute(sql`
        SELECT consultant_phone, consultant_email, consultant_whatsapp
        FROM ai_autonomy_settings WHERE consultant_id = ${task.consultant_id} LIMIT 1
      `),
    ]);
    if (consultantResult.rows.length > 0) {
      const row = consultantResult.rows[0] as any;
      const autonomy = autonomyResult.rows[0] as any || {};
      contactData = {
        id: row.id,
        first_name: row.first_name,
        last_name: row.last_name,
        email: autonomy.consultant_email || row.email,
        phone_number: autonomy.consultant_phone || row.phone_number || task.contact_phone,
        whatsapp: autonomy.consultant_whatsapp || autonomy.consultant_phone || row.phone_number,
        role: row.role,
        is_consultant_self: true,
      };
      console.log(`${LOG_PREFIX} No contact found, using consultant data: ${row.first_name} ${row.last_name} (email: ${contactData.email}, phone: ${contactData.phone_number}, whatsapp: ${contactData.whatsapp})`);
    }
  }

  console.log(`${LOG_PREFIX} Client data fetched: contact=${contactData ? "found" : "not found"}, email=${contactData?.email || 'N/A'}, recent_tasks=${recentTasks.length}, follow_ups=${followUpTasks.length}`);

  return {
    contact: contactData || {
      phone_number: task.contact_phone,
      name: task.contact_name,
    },
    recent_tasks: recentTasks,
    follow_up_tasks: followUpTasks,
    contact_found: !!contactData,
  };
}

async function handleSearchPrivateStores(
  task: AITaskInfo,
  _step: ExecutionStep,
  previousResults: Record<string, any>,
  rolePersonality?: string | null,
  agentContextSection?: string,
  agentDocs?: AgentDocuments | null,
  autonomyModel?: string,
  autonomyThinkingLevel?: string,
  roleTemperature?: number,
): Promise<Record<string, any>> {
  console.log(`${LOG_PREFIX} Searching private stores for consultant=${task.consultant_id}, contact=${task.contact_id || 'N/A'}, agent_file_search_docs=${agentDocs?.fileSearchDocTitles?.length || 0}`);

  await logActivity(task.consultant_id, {
    event_type: 'step_search_stores_started',
    title: `Cerco nei tuoi documenti qualcosa su ${task.contact_name || 'questo contatto'}...`,
    description: `Sfoglio archivi privati e knowledge base per trovare info utili`,
    icon: '🔎',
    severity: 'info',
    task_id: task.id,
    contact_name: task.contact_name,
    contact_id: task.contact_id,
  });

  let storeNames: string[] = [];

  if (task.contact_id) {
    try {
      const clientStores = await fileSearchService.getStoreNamesForClient(task.contact_id, task.consultant_id);
      storeNames.push(...clientStores);
      if (clientStores.length > 0) {
        console.log(`${LOG_PREFIX} Found ${clientStores.length} client stores`);
      }
    } catch (err: any) {
      console.warn(`${LOG_PREFIX} Failed to get client stores: ${err.message}`);
    }
  }

  if (agentDocs && agentDocs.fileSearchStoreNames.length > 0) {
    storeNames.push(...agentDocs.fileSearchStoreNames);
    console.log(`${LOG_PREFIX} Added ${agentDocs.fileSearchStoreNames.length} agent File Search stores (for docs: ${agentDocs.fileSearchDocTitles.join(', ')})`);
    
    await logActivity(task.consultant_id, {
      event_type: "step_search_agent_docs",
      title: `Trovati ${agentDocs.fileSearchDocTitles.length} documenti utili! Li sto consultando...`,
      description: `Sto leggendo: ${agentDocs.fileSearchDocTitles.join(', ')}`,
      icon: "🔍",
      severity: "info",
      task_id: task.id,
      contact_name: task.contact_name,
      contact_id: task.contact_id,
    });
  } else if (!task.contact_id) {
    try {
      const consultantStores = await fileSearchService.getConsultantOwnStores(task.consultant_id);
      if (consultantStores.length > 0) {
        storeNames.push(...consultantStores);
        console.log(`${LOG_PREFIX} Added ${consultantStores.length} consultant own stores (no contact_id, fallback)`);
      }
    } catch (err: any) {
      console.warn(`${LOG_PREFIX} Failed to get consultant stores: ${err.message}`);
    }
  }

  // T006: If consultant is also a client of another consultant, include their personal client store
  // (email_journey, daily_reflection, consultation — enforced at prompt level)
  let consultantParentId: string | null = null;
  try {
    const parentLookup = await db.execute(sql`SELECT consultant_id FROM users WHERE id = ${task.consultant_id} LIMIT 1`);
    const parentId = (parentLookup.rows[0] as any)?.consultant_id;
    if (parentId && parentId !== task.consultant_id) {
      consultantParentId = parentId;
      const clientStoreResult = await db.execute(sql`
        SELECT google_store_name FROM file_search_stores
        WHERE owner_type = 'client' AND owner_id = ${task.consultant_id} AND is_active = true
        LIMIT 1
      `);
      const clientStoreName = (clientStoreResult.rows[0] as any)?.google_store_name;
      if (clientStoreName && !storeNames.includes(clientStoreName)) {
        storeNames.push(clientStoreName);
        console.log(`${LOG_PREFIX} Added personal client store (consultant is also a client of ${consultantParentId})`);
      }
    }
  } catch (err: any) {
    console.warn(`${LOG_PREFIX} Failed to check consultant parent: ${err.message}`);
  }

  storeNames = [...new Set(storeNames)];

  if (storeNames.length === 0) {
    console.log(`${LOG_PREFIX} No private stores found, skipping file search`);
    return {
      documents_found: 0,
      stores_searched: 0,
      store_breakdown: [],
      findings_summary: "Nessun archivio privato disponibile per questo consulente/contatto.",
      citations: [],
      search_query: task.ai_instruction,
    };
  }

  let breakdown: any[] = [];
  try {
    const breakdownResult = await fileSearchService.getStoreBreakdownForGeneration(task.consultant_id, 'consultant', consultantParentId || undefined);
    breakdown = breakdownResult.breakdown;
  } catch (err: any) {
    console.warn(`${LOG_PREFIX} Failed to get store breakdown: ${err.message}`);
  }

  const storeProgressMessages = [
    { message: "Sfoglio le consulenze passate...", icon: "📋" },
    { message: "Controllo gli esercizi del cliente...", icon: "📝" },
    { message: "Do un'occhiata alla knowledge base...", icon: "📚" },
    { message: "Cerco nella tua libreria...", icon: "🗂️" },
  ];

  for (const progress of storeProgressMessages.slice(0, Math.min(storeNames.length, storeProgressMessages.length))) {
    await logActivity(task.consultant_id, {
      event_type: "step_search_store_progress",
      title: progress.message,
      description: `Ricerca in ${storeNames.length} archivi privati`,
      icon: progress.icon,
      severity: "info",
      task_id: task.id,
      contact_name: task.contact_name,
      contact_id: task.contact_id,
    });
  }

  const fileSearchTool = fileSearchService.buildFileSearchTool(storeNames);
  if (!fileSearchTool) {
    console.log(`${LOG_PREFIX} buildFileSearchTool returned null, no valid stores`);
    return {
      documents_found: 0,
      stores_searched: storeNames.length,
      store_breakdown: breakdown,
      findings_summary: "Nessun archivio valido trovato dopo la validazione.",
      citations: [],
      search_query: task.ai_instruction,
    };
  }

  let ai = await fileSearchService.getClientForUser(task.consultant_id);
  if (!ai) {
    const fallbackKey = await getGeminiApiKeyForClassifier();
    if (!fallbackKey) throw new Error("No Gemini API key available for file search");
    ai = new GoogleGenAI({ apiKey: fallbackKey, apiVersion: 'v1beta' });
    console.log(`${LOG_PREFIX} Using fallback API key for file search`);
  }

  const searchIdentity = rolePersonality
    ? `${rolePersonality}\nCerca nei documenti privati informazioni rilevanti per questo task.`
    : `Sei un assistente AI per consulenti. Cerca nei documenti privati informazioni rilevanti per questo task.`;

  const personalClientStoreNote = consultantParentId
    ? `\n\nNOTA IMPORTANTE SULLO STORE PERSONALE:
Il consulente è anche cliente di un altro consulente e ha un store privato personale.
Da quello store, considera ESCLUSIVAMENTE documenti di questi tipi:
- Progressi Email Journey (percorso email personale del consulente)
- Riflessioni giornaliere (journaling personale del consulente)
- Note consulenze personali (sessioni del consulente come cliente)
Non usare altri tipi di documento da quel store privato.`
    : '';

  const searchPrompt = `${searchIdentity}

ISTRUZIONE TASK: ${task.ai_instruction}
${task.additional_context ? `\nIstruzioni aggiuntive e contesto, segui attentamente o tieni a memoria:\n${task.additional_context}` : ''}${buildFollowUpSection(previousResults)}
CATEGORIA: ${task.task_category}
CONTATTO: ${task.contact_name || 'N/A'}${personalClientStoreNote}

Cerca specificamente:
1. Note di consulenze passate con questo contatto
2. Esercizi assegnati e risposte
3. Documenti della knowledge base pertinenti
4. Contesto dalla libreria del consulente

Riassumi le informazioni trovate in modo strutturato.`;

  const searchModel = autonomyModel || GEMINI_3_MODEL;
  const searchThinkingBudget = getThinkingBudgetForLevel(autonomyThinkingLevel || 'low');
  const response = await withRetry(async () => {
    return await trackedGenerateContent(ai!, {
      model: searchModel,
      contents: [{ role: "user", parts: [{ text: searchPrompt }] }],
      config: {
        temperature: roleTemperature ?? 0.3,
        maxOutputTokens: 8192,
        tools: [fileSearchTool],
        thinkingConfig: { thinkingBudget: searchThinkingBudget },
      },
    } as any, { consultantId: task.consultant_id, feature: 'ai-task-file-search', keySource: 'superadmin' });
  });

  const text = response.text || "";
  console.log(`${LOG_PREFIX} File search response length: ${text.length}`);

  const citations = fileSearchService.parseCitations(response);
  console.log(`${LOG_PREFIX} File search completed: ${citations.length} citations from ${storeNames.length} stores`);

  return {
    documents_found: citations.length,
    stores_searched: storeNames.length,
    store_breakdown: breakdown,
    findings_summary: text,
    citations: citations.map(c => ({ source: c.sourceTitle, content: c.content })),
    search_query: task.ai_instruction,
  };
}

async function handleAnalyzePatterns(
  task: AITaskInfo,
  _step: ExecutionStep,
  previousResults: Record<string, any>,
  rolePersonality?: string | null,
  agentContextSection?: string,
  autonomyModel?: string,
  autonomyThinkingLevel?: string,
  roleTemperature?: number,
): Promise<Record<string, any>> {
  await logActivity(task.consultant_id, {
    event_type: 'step_analyze_patterns_started',
    title: `Analizzo ${task.contact_name || 'questo contatto'} in dettaglio... cerco pattern e opportunità`,
    description: `Guardo comportamenti, esigenze, rischi e opportunità dai dati che ho raccolto`,
    icon: '🧠',
    severity: 'info',
    task_id: task.id,
    contact_name: task.contact_name,
    contact_id: task.contact_id,
  });

  const clientData = previousResults.fetch_client_data || previousResults;

  const privateStoreData = previousResults.search_private_stores;
  const privateStoreSection = privateStoreData
    ? `\nDOCUMENTI PRIVATI TROVATI:\n${privateStoreData.findings_summary || "Nessun documento privato trovato"}\n\nCITAZIONI:\n${privateStoreData.citations?.map((c: any) => `- ${c.source}: ${c.content}`).join('\n') || "Nessuna citazione"}\n`
    : "";

  const analyzerIdentity = rolePersonality
    ? `${rolePersonality}\nAnalizza in modo DETTAGLIATO e APPROFONDITO la situazione del cliente basandoti esclusivamente sui dati e documenti disponibili.`
    : `Sei un analista AI senior. Il tuo compito è analizzare in modo DETTAGLIATO e APPROFONDITO la situazione del cliente basandoti esclusivamente sui dati e documenti disponibili.`;

  const prompt = `${analyzerIdentity}
${agentContextSection || ''}

IMPORTANTE: La tua analisi deve essere COMPLETA e DETTAGLIATA (almeno 2000 caratteri totali nel JSON). Analizza TUTTI i dati disponibili, incluse TUTTE le citazioni dai documenti privati. Non essere generico - fornisci insight specifici con esempi concreti dai dati.

=== DATI CLIENTE ===
${JSON.stringify(clientData.contact || {}, null, 2)}

=== TASK RECENTI DEL CLIENTE ===
${JSON.stringify(clientData.recent_tasks || [], null, 2)}
${privateStoreSection}
=== ISTRUZIONE ORIGINALE DEL TASK ===
${task.ai_instruction}
${buildFollowUpSection(previousResults)}
=== CATEGORIA TASK ===
${task.task_category}

ANALIZZA IN DETTAGLIO LE SEGUENTI AREE:
1. **Profilo Cliente**: Chi è questo cliente? Qual è la sua situazione complessiva? Da quanto tempo è seguito? Livello di engagement?
2. **Punti di Forza**: Quali sono i punti di forza del cliente emersi dai dati? Cosa fa bene? Dove mostra impegno?
3. **Punti di Debolezza**: Dove il cliente mostra difficoltà? Quali aree necessitano miglioramento? Ci sono pattern negativi?
4. **Opportunità**: Quali opportunità di crescita esistono? Come può il consulente aiutare meglio?
5. **Pattern Comportamentali**: Come si comporta il cliente nelle consulenze? Completa gli esercizi? È puntuale? È proattivo?
6. **Insight dalle Consulenze Passate**: Cosa emerge dalle note delle consulenze precedenti? Quali temi ricorrono? Quali progressi sono stati fatti?
7. **Valutazione del Rischio**: C'è rischio di abbandono? Il cliente è soddisfatto? Ci sono segnali di allarme?
8. **Raccomandazioni Operative**: Cosa dovrebbe fare concretamente il consulente? Con quali priorità?

USA TUTTI i dati delle citazioni dei documenti privati per supportare ogni insight con esempi specifici.

Rispondi ESCLUSIVAMENTE in formato JSON valido con questa struttura:
{
  "client_profile_summary": "riassunto completo della situazione del cliente, almeno 300 caratteri, includendo background, situazione attuale, e contesto generale",
  "strengths": ["punto di forza 1 con spiegazione dettagliata ed esempio dai dati", "punto di forza 2 con spiegazione..."],
  "weaknesses": ["debolezza 1 con spiegazione dettagliata ed esempio dai dati", "debolezza 2 con spiegazione..."],
  "opportunities": ["opportunità 1 con spiegazione dettagliata e come sfruttarla", "opportunità 2 con spiegazione..."],
  "behavioral_patterns": ["pattern comportamentale 1 osservato nei dati", "pattern 2..."],
  "past_consultation_insights": ["insight dalla consulenza passata 1 con dettagli specifici", "insight 2..."],
  "insights": ["insight dettagliato e actionable 1", "insight dettagliato 2", ...],
  "risk_assessment": {
    "level": "low|medium|high",
    "factors": ["fattore di rischio 1 con spiegazione", "fattore 2..."],
    "description": "descrizione dettagliata del livello di rischio, almeno 200 caratteri, con motivazioni specifiche basate sui dati"
  },
  "recommendations": ["raccomandazione operativa dettagliata 1 con azione concreta", "raccomandazione 2..."],
  "engagement_score": 0-100,
  "suggested_approach": "descrizione dettagliata dell'approccio suggerito per il prossimo contatto con il cliente, almeno 300 caratteri, includendo tono, argomenti da trattare, e obiettivi specifici",
  "key_topics": ["argomento chiave 1", "argomento 2", ...]
}`;

  const { client, model: resolvedModel, providerName } = await resolveProviderForTask(task.consultant_id, task.ai_role);
  const effectiveModel = autonomyModel || resolvedModel;
  console.log(`${LOG_PREFIX} analyze_patterns using ${providerName} (${effectiveModel})`);

  const response = await withRetry(async () => {
    return await client.generateContent({
      model: effectiveModel,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { temperature: roleTemperature ?? 0.3, maxOutputTokens: 16384, thinkingConfig: { thinkingBudget: getThinkingBudgetForLevel(autonomyThinkingLevel || 'low') } },
    });
  });

  const text = response.response.text() || "";
  console.log(`${LOG_PREFIX} Gemini analysis response length: ${text.length}`);

  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (parseError: any) {
    console.warn(`${LOG_PREFIX} Failed to parse analysis JSON, returning raw text`);
  }

  return {
    client_profile_summary: text.substring(0, 500),
    strengths: [],
    weaknesses: [],
    opportunities: [],
    behavioral_patterns: [],
    past_consultation_insights: [],
    insights: ["Analisi completata - risultato in formato testo"],
    risk_assessment: { level: "medium", factors: [], description: text.substring(0, 500) },
    recommendations: [],
    engagement_score: 50,
    suggested_approach: text.substring(0, 300),
    key_topics: [],
    raw_response: text,
  };
}

async function handleGenerateReport(
  task: AITaskInfo,
  _step: ExecutionStep,
  previousResults: Record<string, any>,
  rolePersonality?: string | null,
  agentContextSection?: string,
  autonomyModel?: string,
  autonomyThinkingLevel?: string,
  roleTemperature?: number,
): Promise<Record<string, any>> {
  await logActivity(task.consultant_id, {
    event_type: 'step_generate_report_started',
    title: `Preparo il report${task.contact_name ? ` per ${task.contact_name}` : ''}... ci metto tutto quello che ho trovato`,
    description: `Sto scrivendo un documento dettagliato con analisi e raccomandazioni`,
    icon: '📝',
    severity: 'info',
    task_id: task.id,
    contact_name: task.contact_name,
    contact_id: task.contact_id,
  });

  const analysisData = previousResults.analyze_patterns || previousResults;
  const clientData = previousResults.fetch_client_data || {};

  const privateStoreData = previousResults.search_private_stores;
  const privateStoreSection = privateStoreData
    ? `\nDOCUMENTI PRIVATI TROVATI:\n${privateStoreData.findings_summary || "Nessun documento privato trovato"}\n\nCITAZIONI:\n${privateStoreData.citations?.map((c: any) => `- ${c.source}: ${c.content}`).join('\n') || "Nessuna citazione"}\n`
    : "";

  const webSearchData = previousResults.web_search;
  const webSearchSection = webSearchData
    ? `\nRICERCA WEB:\n${webSearchData.findings || "Nessun risultato dalla ricerca web"}\n\nFONTI WEB:\n${webSearchData.sources?.map((s: any) => `- ${s.title}: ${s.url}`).join('\n') || "Nessuna fonte"}\n`
    : "";

  const reportIdentity = rolePersonality
    ? `${rolePersonality}\nGenera un report COMPLETO, DETTAGLIATO e APPROFONDITO.`
    : `Sei un assistente AI senior specializzato in consulenza. Genera un report COMPLETO, DETTAGLIATO e APPROFONDITO.`;

  const prompt = `${reportIdentity}
${agentContextSection || ''}

CLASSIFICAZIONE DOCUMENTO - Analizza ATTENTAMENTE l'istruzione del task. Scegli il tipo CORRETTO in base al CONTENUTO richiesto, NON alle parole chiave superficiali:
- "contract": SOLO se si richiede esplicitamente un CONTRATTO, accordo legale, NDA, termini e condizioni, lettera di incarico. Deve avere natura GIURIDICA VINCOLANTE.
- "market_research": Ricerche di mercato, analisi competitiva, benchmark di settore, analisi trend → Executive summary, dati/statistiche, grafici testuali, fonti
- "guide": Guide pratiche, scalette, tutorial, percorsi formativi, procedure operative, programmi di formazione, academy, onboarding → Step numerati, prerequisiti, note, consigli pratici
- "strategic_report": Report strategici, business plan, piani d'azione, roadmap, strategie di crescita → Sommario esecutivo, analisi SWOT, KPI, timeline
- "dossier": Dossier informativi, schede tecniche, profili dettagliati → Sezioni tematiche strutturate, riferimenti, allegati
- "brief": Brief creativi, brief di progetto, specifiche di progetto → Obiettivi, target, deliverables, vincoli, timeline
- "analysis": Analisi generiche, valutazioni, audit, assessment → Metodologia, risultati, conclusioni, raccomandazioni

⚠️ ATTENZIONE alla classificazione: Se il task chiede di "progettare una struttura", "creare una scaletta", "definire un percorso" → è una "guide" o "strategic_report", NON un "contract". Un contratto è SOLO un documento legale con obblighi vincolanti tra parti. Se il task menziona "partner" o "accordo" ma chiede di progettare contenuti/strutture, NON è un contratto.

REGOLE SPECIFICHE PER IL formal_document in base al tipo:

1. "contract" (SOLO documenti legali vincolanti):
   - Body: type="article", numerazione Art. 1, Art. 2..., linguaggio giuridico italiano
   - Footer: OBBLIGATORIO signatures con spazi firma di entrambe le parti
   - Footer: OBBLIGATORIO location_date per luogo e data firma

2. "market_research":
   - Body: type="section", ALMENO 8 sezioni con dati numerici concreti, percentuali, fonti citate
   - Ogni sezione: minimo 600 caratteri di contenuto con cifre e statistiche reali
   - NO firme nel footer (non è un contratto)

3. "guide" (include scalette, percorsi formativi, academy, programmi di onboarding):
   - Body: type="step" per passi sequenziali, type="section" per moduli tematici
   - Ogni step/sezione: minimo 600 caratteri con istruzioni DETTAGLIATE, concrete e operative
   - Per ogni modulo formativo: includi obiettivi di apprendimento, contenuti specifici, deliverables, durata, materiali necessari
   - Usa subsections per sotto-argomenti di ogni modulo
   - NO firme nel footer (non è un contratto)

4. "strategic_report":
   - Body: type="section" con analisi approfondite, KPI misurabili, timeline
   - Ogni sezione: minimo 600 caratteri con metriche concrete, previsioni, scenari
   - NO firme nel footer (non è un contratto)

5. "dossier", "brief", "analysis":
   - Body: type="section" con contenuti tematici strutturati
   - Ogni sezione: minimo 500 caratteri di contenuto dettagliato
   - NO firme nel footer (non è un contratto)

REGOLA CRITICA SUL FORMAL_DOCUMENT:
- Il formal_document è il DELIVERABLE FINALE da consegnare al cliente/partner
- Deve essere COMPLETO, AUTONOMO e leggibile senza il riepilogo
- Deve avere ALMENO 8-12 body items per un documento professionale
- OGNI body item deve avere contenuto di ALMENO 500-800 caratteri
- Il documento totale deve essere ALMENO 5-8 pagine quando stampato
- Il "summary" (sections, key_findings) è per il consulente (dashboard), il "formal_document" è il PDF professionale per il destinatario
- Le firme nel footer vanno inserite SOLO per documenti tipo "contract". Per tutti gli altri tipi, usa footer.notes per note/disclaimer generali

REGOLA FONDAMENTALE: Il report deve essere ESAUSTIVO e LUNGO. Ogni sezione deve contenere ALMENO 500 caratteri di contenuto ricco e dettagliato. USA SEMPRE I DATI REALI E SPECIFICI estratti dai documenti privati: numeri, percentuali, nomi, date, importi concreti. NON usare MAI riferimenti generici come "[CONSULENZA PRIVATA]" o "[DOCUMENTO]" - integra i dati direttamente nel testo con cifre e fatti reali. NON abbreviare MAI il contenuto - il consulente ha bisogno di un dossier completo con dati concreti, non di un riassunto generico.

${_step.params?.custom_sections && Array.isArray(_step.params.custom_sections) && _step.params.custom_sections.length > 0
  ? `STRUTTURA PERSONALIZZATA - Usa ESATTAMENTE queste sezioni:
${_step.params.custom_sections.map((s: string, i: number) => `${i+1}. ${s}`).join('\n')}

ATTENZIONE: Anche con struttura personalizzata, OGNI sezione deve essere scritta con la STESSA profondità e lunghezza di un report standard. Minimo 500 caratteri per sezione con DATI REALI SPECIFICI (numeri, importi, percentuali, date concrete) estratti dai documenti. NON usare mai tag generici come [CONSULENZA PRIVATA]. NON fare riassunti brevi.`
  : `STRUTTURA DEL REPORT - Includi TUTTE le seguenti sezioni:
1. Panoramica Cliente - Background completo, situazione attuale, contesto (minimo 500 caratteri)
2. Analisi della Situazione - Dettagli approfonditi su cosa emerge dai dati (minimo 500 caratteri)
3. Punti di Forza e Debolezza - Con esempi specifici dai documenti (minimo 500 caratteri)
4. Pattern e Tendenze - Comportamenti ricorrenti, trend osservati (minimo 500 caratteri)
5. Valutazione del Rischio - Analisi dettagliata dei fattori di rischio (minimo 500 caratteri)
6. Piano d'Azione - Raccomandazioni operative concrete e prioritizzate (minimo 500 caratteri)
7. Prossimi Passi - Azioni immediate con timeline suggerita (minimo 500 caratteri)`}

OBBLIGATORIO - Genera SEMPRE queste sezioni aggiuntive indipendentemente dalla struttura scelta:
- "key_findings": ALMENO 5 risultati chiave dettagliati (ogni item almeno 80 caratteri)
- "recommendations": ALMENO 4 raccomandazioni con action, priority e rationale dettagliati
- "next_steps": ALMENO 4 passi successivi concreti con timeline

=== ANALISI COMPLETA ===
${JSON.stringify(analysisData, null, 2)}

=== DATI CLIENTE ===
${JSON.stringify(clientData.contact || {}, null, 2)}
${privateStoreSection}${webSearchSection}
=== ISTRUZIONE ORIGINALE ===
${task.ai_instruction}
${buildFollowUpSection(previousResults)}
Rispondi ESCLUSIVAMENTE in formato JSON valido con questa struttura:
{
  "title": "Titolo descrittivo del report",
  "summary": "Riepilogo esecutivo dettagliato in 4-6 frasi che cattura i punti essenziali (minimo 300 caratteri)",
  "sections": [
    {
      "heading": "Titolo sezione",
      "content": "Contenuto DETTAGLIATO della sezione (MINIMO 500 caratteri per sezione, con DATI REALI: numeri, importi, percentuali, date specifiche estratte dai documenti)"
    }
  ],
  "key_findings": ["risultato chiave dettagliato 1 (almeno 80 caratteri)", "risultato chiave 2", "risultato chiave 3", "risultato chiave 4", "risultato chiave 5"],
  "recommendations": [
    {
      "action": "azione consigliata dettagliata e specifica",
      "priority": "high|medium|low",
      "rationale": "motivazione dettagliata basata sui dati e citazioni"
    }
  ],
  "next_steps": ["passo successivo concreto 1 con timeline", "passo successivo 2", "passo successivo 3", "passo successivo 4"],
  "document_type": "contract|market_research|guide|strategic_report|dossier|brief|analysis",
  "formal_document": {
    "type": "contract|market_research|guide|strategic_report|dossier|brief|analysis",
    "header": {
      "title": "Titolo formale del documento",
      "subtitle": "Sottotitolo descrittivo del contenuto",
      "parties": ["Solo per contract - Parte 1", "Solo per contract - Parte 2"],
      "date": "Data del documento",
      "reference": "Riferimento documento (opzionale)"
    },
    "body": [
      {
        "type": "article (SOLO per contract) | section (per tutti gli altri) | step (per guide)",
        "number": "1",
        "title": "Titolo della sezione/articolo/step (OBBLIGATORIO)",
        "content": "Contenuto DETTAGLIATO e COMPLETO - MINIMO 500-800 caratteri per item. Deve essere esaustivo, professionale, con dati concreti. NON riassumere, NON abbreviare. Scrivi come se fosse un documento professionale a pagamento.",
        "subsections": [
          {
            "number": "1.1",
            "title": "Sotto-sezione (usa per dettagli aggiuntivi)",
            "content": "Contenuto dettagliato della sotto-sezione - almeno 200 caratteri"
          }
        ]
      }
    ],
    "footer": {
      "signatures": "SOLO PER type=contract - Array di firme: [{role, name, line: true}]. Per TUTTI gli altri tipi: NON includere signatures o impostare a []",
      "notes": "Note informative, disclaimer, copyright, confidenzialità - SEMPRE presente per tutti i tipi",
      "location_date": "SOLO per contract - Luogo e data per firma"
    }
  }
}

⚠️ REGOLA TASSATIVA SUL NUMERO DI BODY ITEMS:
- Il formal_document.body DEVE contenere ALMENO 8 items per qualsiasi tipo di documento
- Per guide/academy/percorsi formativi: ALMENO 10-15 items (1 per ogni modulo + sotto-argomenti)
- Per strategic_report: ALMENO 10 items (executive summary + analisi + piano + metriche)
- Per market_research: ALMENO 10 items (overview + dati + analisi + conclusioni)
- Se il task chiede N elementi specifici (es. "5 video tutorial"), OGNI elemento deve essere un body item con ALMENO 3-4 subsections ciascuno che dettaglino il contenuto
- RICORDA: Il cliente PAGA per questo documento. Un documento di 1-2 pagine è INACCETTABILE. Il target è 5-10 pagine di contenuto professionale.
- Le firme (signatures) nel footer vanno incluse ESCLUSIVAMENTE quando document_type è "contract". Per guide, strategic_report, market_research, brief, dossier, analysis: footer.signatures DEVE essere un array vuoto [] o non presente.`;

  const { client, model: resolvedModel, providerName } = await resolveProviderForTask(task.consultant_id, task.ai_role);
  const effectiveReportModel = autonomyModel || resolvedModel;
  console.log(`${LOG_PREFIX} generate_report using ${providerName} (${effectiveReportModel})`);

  const response = await withRetry(async () => {
    return await client.generateContent({
      model: effectiveReportModel,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { temperature: roleTemperature ?? 0.3, maxOutputTokens: 65536, thinkingConfig: { thinkingBudget: getThinkingBudgetForLevel(autonomyThinkingLevel || 'low') } },
    });
  });

  const text = response.response.text() || "";
  console.log(`${LOG_PREFIX} Gemini report response length: ${text.length}`);

  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (parsed.formal_document && parsed.formal_document.type !== 'contract' && parsed.document_type !== 'contract') {
        if (parsed.formal_document.footer?.signatures && parsed.formal_document.footer.signatures.length > 0) {
          console.log(`${LOG_PREFIX} Removing signatures from non-contract document (type: ${parsed.formal_document.type || parsed.document_type})`);
          parsed.formal_document.footer.signatures = [];
        }
        if (parsed.formal_document.footer?.location_date) {
          delete parsed.formal_document.footer.location_date;
        }
      }
      return parsed;
    }
  } catch (parseError: any) {
    console.warn(`${LOG_PREFIX} Failed to parse report JSON, returning raw text`);
  }

  return {
    title: "Report Analisi Cliente",
    summary: text.substring(0, 300),
    sections: [{ heading: "Analisi", content: text }],
    key_findings: [],
    recommendations: [],
    next_steps: [],
    raw_response: text,
  };
}

async function handlePrepareCall(
  task: AITaskInfo,
  _step: ExecutionStep,
  previousResults: Record<string, any>,
  rolePersonality?: string | null,
  agentContextSection?: string,
  autonomyModel?: string,
  autonomyThinkingLevel?: string,
  roleTemperature?: number,
): Promise<Record<string, any>> {
  await logActivity(task.consultant_id, {
    event_type: 'step_prepare_call_started',
    title: `Sto preparando lo script per chiamare ${task.contact_name || 'il contatto'}...`,
    description: `Definisco i punti chiave, gli obiettivi e la strategia per la conversazione`,
    icon: '📋',
    severity: 'info',
    task_id: task.id,
    contact_name: task.contact_name,
    contact_id: task.contact_id,
  });

  const analysisData = previousResults.analyze_patterns || {};
  const reportData = previousResults.generate_report || {};
  const clientData = previousResults.fetch_client_data || {};

  const isOutreachCall = task.task_category === 'prospecting' || 
    (task.additional_context && (() => { try { return JSON.parse(task.additional_context!).lead_id; } catch { return false; } })());

  let additionalContextData: Record<string, any> = {};
  if (task.additional_context) {
    try { additionalContextData = JSON.parse(task.additional_context); } catch {}
  }

  let callIdentity: string;
  let promptBody: string;

  if (isOutreachCall) {
    callIdentity = rolePersonality
      ? `${rolePersonality}\nStai preparando una chiamata OUTBOUND verso un lead cold/warm trovato dalla ricerca automatica. Il tuo ruolo è preparare l'AI vocale (Alessia) per questa chiamata outbound, fornendole contesto sul lead, obiettivi della chiamata, e strategia di approccio.`
      : `Sei un assistente AI che prepara chiamate outbound verso lead.\nPrepara i punti chiave per una chiamata outbound a un potenziale cliente.`;

    promptBody = `${callIdentity}
${agentContextSection || ''}

IMPORTANT: Questa è una chiamata OUTBOUND verso un LEAD (non un cliente esistente). Il lead NON ci conosce o ci conosce poco.

ISTRUZIONE DEL TASK (obiettivo della chiamata):
${task.ai_instruction}
${buildFollowUpSection(previousResults)}
CATEGORIA: ${task.task_category}

DATI LEAD:
Nome/Azienda: ${task.contact_name || "N/A"}
Telefono: ${task.contact_phone}
${additionalContextData.lead_id ? `Lead ID: ${additionalContextData.lead_id}` : ''}
${additionalContextData.voice_template_id ? `Template voce: ${additionalContextData.voice_template_id}` : ''}

REGOLE PER CHIAMATA OUTBOUND A LEAD:
- Il lead NON ci conosce: presentati brevemente e spiega il motivo della chiamata
- Sii diretto ma cordiale, rispetta il tempo del lead
- Obiettivo: qualificare l'interesse e proporre un appuntamento con il consulente
- NON dare prezzi, NON fare promesse specifiche
- Se il lead non è interessato, ringrazia e chiudi con professionalità

Rispondi ESCLUSIVAMENTE in formato JSON valido con questa struttura:
{
  "talking_points": [
    {
      "topic": "argomento",
      "key_message": "messaggio principale",
      "supporting_details": "dettagli di supporto",
      "tone": "professionale|empatico|urgente|informativo"
    }
  ],
  "opening_script": "script di apertura per l'AI vocale verso il lead",
  "closing_script": "script di chiusura per l'AI vocale",
  "objection_responses": [
    {
      "objection": "possibile obiezione del lead",
      "response": "risposta suggerita"
    }
  ],
  "call_duration_estimate_minutes": 5,
  "call_priority": "high|medium|low",
  "preferred_call_time": "HH:MM",
  "preferred_call_date": "YYYY-MM-DD",
  "timing_reasoning": "spiegazione del perché questo orario è ottimale",
  "call_topic_summary": "brief summary of what this call is about"
}`;
  } else {
    callIdentity = rolePersonality
      ? `${rolePersonality}\nPrepara i punti chiave e il briefing per il CONSULENTE in vista della sua telefonata/consulenza con il cliente. Il tuo ruolo è preparare il consulente, fornendogli contesto, strategie, domande chiave da porre, e obiettivi per la chiamata. NON stai chiamando il cliente direttamente — stai facendo coaching al consulente su come condurre al meglio la conversazione.`
      : `Sei un assistente AI per consulenti.\nPrepara i punti chiave per una telefonata con il cliente, adattandoti al suo contesto specifico.`;

    promptBody = `${callIdentity}
${agentContextSection || ''}

IMPORTANT: The talking points and script MUST be about the CURRENT task instruction below, NOT about any previous task or report from a different context. Focus EXCLUSIVELY on what the current task asks.

NOTA: Stai preparando un BRIEFING PER IL CONSULENTE. I talking points sono per il consulente, non per il cliente. Lo script di apertura e chiusura sono suggerimenti per come il consulente dovrebbe condurre la chiamata. Le obiezioni sono quelle che il CLIENTE potrebbe fare, e le risposte sono quelle che il CONSULENTE dovrebbe dare.

ISTRUZIONE DEL TASK CORRENTE (questa è la PRIORITÀ ASSOLUTA - la chiamata DEVE riguardare QUESTO argomento):
${task.ai_instruction}
${buildFollowUpSection(previousResults)}
CATEGORIA: ${task.task_category}

DATI CLIENTE:
Nome: ${task.contact_name || clientData.contact?.first_name || "N/A"}
Telefono: ${task.contact_phone}

CONTESTO SUPPLEMENTARE DA QUESTA ESECUZIONE (usa solo come supporto, NON come argomento principale della chiamata):

Analisi di supporto:
${JSON.stringify(analysisData, null, 2)}

Report di supporto:
${JSON.stringify(reportData, null, 2)}

Rispondi ESCLUSIVAMENTE in formato JSON valido con questa struttura:
{
  "talking_points": [
    {
      "topic": "argomento",
      "key_message": "messaggio principale",
      "supporting_details": "dettagli di supporto",
      "tone": "professionale|empatico|urgente|informativo"
    }
  ],
  "opening_script": "frase di apertura suggerita per il consulente",
  "closing_script": "frase di chiusura suggerita per il consulente",
  "objection_responses": [
    {
      "objection": "possibile obiezione",
      "response": "risposta suggerita"
    }
  ],
  "call_duration_estimate_minutes": 5,
  "call_priority": "high|medium|low",
  "preferred_call_time": "HH:MM",
  "preferred_call_date": "YYYY-MM-DD",
  "timing_reasoning": "spiegazione del perché questo orario è ottimale",
  "call_topic_summary": "brief summary of what this call is about"
}`;
  }

  const prompt = promptBody;

  const { client, model: resolvedModel, providerName } = await resolveProviderForTask(task.consultant_id, task.ai_role);
  const effectiveCallModel = autonomyModel || resolvedModel;
  console.log(`${LOG_PREFIX} prepare_call using ${providerName} (${effectiveCallModel})`);

  const response = await withRetry(async () => {
    return await client.generateContent({
      model: effectiveCallModel,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { temperature: roleTemperature ?? 0.4, maxOutputTokens: 4096, thinkingConfig: { thinkingBudget: getThinkingBudgetForLevel(autonomyThinkingLevel || 'low') } },
    });
  });

  const text = response.response.text() || "";
  console.log(`${LOG_PREFIX} Gemini call prep response length: ${text.length}`);

  let parsed: Record<string, any> | null = null;

  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      parsed = JSON.parse(jsonMatch[0]);
      if (_step.params?.preferred_time && !parsed!.preferred_call_time) {
        parsed!.preferred_call_time = _step.params.preferred_time;
      }
      if (_step.params?.preferred_date && !parsed!.preferred_call_date) {
        parsed!.preferred_call_date = _step.params.preferred_date;
      }
    }
  } catch (parseError: any) {
    console.warn(`${LOG_PREFIX} Failed to parse call prep JSON, returning raw text`);
  }

  const result = parsed || {
    talking_points: [
      {
        topic: task.task_category,
        key_message: task.ai_instruction,
        supporting_details: "",
        tone: "professionale",
      },
    ],
    opening_script: `Buongiorno, sono il suo consulente. La chiamo per ${task.ai_instruction}`,
    closing_script: "La ringrazio per il suo tempo. Restiamo in contatto.",
    objection_responses: [],
    call_duration_estimate_minutes: 5,
    call_priority: "medium",
    preferred_call_time: _step.params?.preferred_time || null,
    preferred_call_date: _step.params?.preferred_date || null,
    raw_response: text,
  };

  const callDate = result.preferred_call_date;
  const callTime = result.preferred_call_time;
  if (callDate || callTime) {
    try {
      let resolvedPhone = task.contact_phone;
      let resolvedName = task.contact_name;
      if (!resolvedPhone || resolvedPhone === 'N/A' || resolvedPhone.trim() === '') {
        if (task.ai_role === 'marco') {
          const settingsResult = await db.execute(sql`
            SELECT consultant_phone, consultant_whatsapp FROM ai_autonomy_settings
            WHERE consultant_id::text = ${task.consultant_id}::text LIMIT 1
          `);
          const s = settingsResult.rows[0] as any;
          const consultantPhone = s?.consultant_whatsapp || s?.consultant_phone;
          if (consultantPhone) {
            resolvedPhone = consultantPhone;
            resolvedName = 'Consulente (tu)';
          }
        }
        if ((!resolvedPhone || resolvedPhone === 'N/A') && task.contact_id) {
          const contactResult = await db.execute(sql`
            SELECT phone_number, first_name, last_name FROM users WHERE id::text = ${task.contact_id}::text LIMIT 1
          `);
          const c = contactResult.rows[0] as any;
          if (c?.phone_number) {
            resolvedPhone = c.phone_number;
            resolvedName = resolvedName || `${c.first_name || ''} ${c.last_name || ''}`.trim();
          }
        }
      }

      if (resolvedPhone && resolvedPhone !== 'N/A') {
        const existingCallResult = await db.execute(sql`
          SELECT id FROM scheduled_voice_calls
          WHERE source_task_id = ${task.id}
            AND status IN ('scheduled', 'pending')
          LIMIT 1
        `);
        if (existingCallResult.rows.length > 0) {
          console.log(`${LOG_PREFIX} [PREPARE_CALL] Skipping auto-schedule: voice call already exists for task ${task.id} (voice_call step will handle it)`);
          result.auto_schedule_skipped = 'existing_call_found';
        } else {
          const scheduledCallId = generateScheduledCallId();
          let targetDateTimeStr = callDate && callTime
            ? `${callDate} ${callTime}:00`
            : callDate
              ? `${callDate} 10:00:00`
              : null;

          if (targetDateTimeStr) {
            const nowRomeResult = await db.execute(sql`
              SELECT to_char(NOW() AT TIME ZONE 'Europe/Rome', 'YYYY-MM-DD HH24:MI:SS') as now_rome
            `);
            const nowRomeStr = (nowRomeResult.rows[0] as any).now_rome as string;
            if (targetDateTimeStr < nowRomeStr) {
              const nextSlotResult = await db.execute(sql`
                SELECT to_char(
                  CASE 
                    WHEN EXTRACT(DOW FROM (NOW() AT TIME ZONE 'Europe/Rome')) = 5 THEN (NOW() AT TIME ZONE 'Europe/Rome')::date + 3
                    WHEN EXTRACT(DOW FROM (NOW() AT TIME ZONE 'Europe/Rome')) = 6 THEN (NOW() AT TIME ZONE 'Europe/Rome')::date + 2
                    ELSE (NOW() AT TIME ZONE 'Europe/Rome')::date + 1
                  END, 'YYYY-MM-DD'
                ) as next_day
              `);
              const nextDay = (nextSlotResult.rows[0] as any).next_day;
              targetDateTimeStr = `${nextDay} ${callTime || '10:00'}:00`;
            }

            let currentCheckStr = targetDateTimeStr;
            for (let attempt = 0; attempt < 10; attempt++) {
              const conflictResult = await db.execute(sql`
                SELECT scheduled_at FROM scheduled_voice_calls
                WHERE consultant_id = ${task.consultant_id}
                  AND status IN ('scheduled', 'pending')
                  AND ABS(EXTRACT(EPOCH FROM (scheduled_at - (${currentCheckStr}::timestamp AT TIME ZONE 'Europe/Rome')))) < 1800
                LIMIT 1
              `);
              if (conflictResult.rows.length === 0) break;
              console.log(`${LOG_PREFIX} [PREPARE_CALL] Conflict at ${currentCheckStr}, shifting +30 minutes`);
              const shiftedResult = await db.execute(sql`
                SELECT to_char((${currentCheckStr}::timestamp + interval '30 minutes'), 'YYYY-MM-DD HH24:MI:SS') as shifted
              `);
              currentCheckStr = (shiftedResult.rows[0] as any).shifted;
            }
            targetDateTimeStr = currentCheckStr;

            const talkingPoints = result.talking_points || [];
            const talkingPointsText = talkingPoints
              .map((tp: any) => `- ${tp.topic}: ${tp.key_message}`)
              .join("\n");
            const customPrompt = result.opening_script
              ? `${result.opening_script}\n\nPunti chiave:\n${talkingPointsText}\n\n${result.closing_script || ""}`
              : task.ai_instruction;

            await db.execute(sql`
              INSERT INTO scheduled_voice_calls (
                id, consultant_id, target_phone, scheduled_at, status, ai_mode,
                custom_prompt, call_instruction, instruction_type, attempts, max_attempts,
                priority, source_task_id, attempts_log, use_default_template, created_at, updated_at
              ) VALUES (
                ${scheduledCallId}, ${task.consultant_id}, ${resolvedPhone},
                ${sql`${targetDateTimeStr}::timestamp AT TIME ZONE 'Europe/Rome'`}, 'scheduled', 'assistenza',
                ${customPrompt}, ${customPrompt},
                'task', 0, 3,
                ${task.priority || 1}, ${task.id}, '[]'::jsonb, true, NOW(), NOW()
              )
            `);

            result.auto_scheduled_call_id = scheduledCallId;
            result.auto_scheduled_at = targetDateTimeStr;
            console.log(`${LOG_PREFIX} [PREPARE_CALL] Auto-scheduled voice call ${scheduledCallId} at ${targetDateTimeStr} for ${resolvedPhone}`);

            await logActivity(task.consultant_id, {
              event_type: "voice_call_auto_scheduled",
              title: `Chiamata programmata per ${targetDateTimeStr}, ci siamo!`,
              description: `Ho fissato la chiamata a ${resolvedName || resolvedPhone} — è tutto pronto`,
              icon: "📅",
              severity: "info",
              task_id: task.id,
              contact_name: resolvedName,
              contact_id: task.contact_id,
            });
          }
        }
      } else {
        console.log(`${LOG_PREFIX} [PREPARE_CALL] No valid phone for auto-scheduling, skipping`);
      }
    } catch (schedErr: any) {
      console.warn(`${LOG_PREFIX} [PREPARE_CALL] Failed to auto-schedule call: ${schedErr.message}`);
      result.auto_schedule_error = schedErr.message;
    }
  }

  return result;
}

async function handleVoiceCall(
  task: AITaskInfo,
  _step: ExecutionStep,
  previousResults: Record<string, any>,
): Promise<Record<string, any>> {
  await logActivity(task.consultant_id, {
    event_type: 'step_voice_call_started',
    title: `Preparo la chiamata${task.contact_name ? ` a ${task.contact_name}` : ''}...`,
    description: `Configuro tutto per la chiamata, un attimo e ci siamo`,
    icon: '📞',
    severity: 'info',
    task_id: task.id,
    contact_name: task.contact_name,
    contact_id: task.contact_id,
  });

  const callPrep = previousResults.prepare_call || {};

  let resolvedPhone = task.contact_phone;
  let resolvedName = task.contact_name;

  if (!resolvedPhone || resolvedPhone === 'N/A' || resolvedPhone.trim() === '') {
    if (task.ai_role === 'marco') {
      const settingsResult = await db.execute(sql`
        SELECT consultant_phone, consultant_whatsapp FROM ai_autonomy_settings
        WHERE consultant_id::text = ${task.consultant_id}::text LIMIT 1
      `);
      const s = settingsResult.rows[0] as any;
      const consultantPhone = s?.consultant_phone || s?.consultant_whatsapp;
      if (consultantPhone) {
        resolvedPhone = consultantPhone;
        resolvedName = resolvedName || 'Consulente (tu)';
        console.log(`${LOG_PREFIX} [MARCO] Resolved consultant phone: ${resolvedPhone}`);
      }
    }

    if (!resolvedPhone || resolvedPhone === 'N/A') {
      if (task.contact_id) {
        const contactResult = await db.execute(sql`
          SELECT phone_number, first_name, last_name FROM users WHERE id::text = ${task.contact_id}::text LIMIT 1
        `);
        const c = contactResult.rows[0] as any;
        if (c?.phone_number) {
          resolvedPhone = c.phone_number;
          resolvedName = resolvedName || `${c.first_name || ''} ${c.last_name || ''}`.trim();
          console.log(`${LOG_PREFIX} Resolved contact phone from DB: ${resolvedPhone}`);
        }
      }
    }

    if (!resolvedPhone || resolvedPhone === 'N/A') {
      console.warn(`${LOG_PREFIX} ⚠️ Cannot schedule voice_call: no valid phone number found for task ${task.id}`);
      return {
        success: false,
        error: 'Nessun numero di telefono valido disponibile per la chiamata',
        scheduled_call_id: null,
      };
    }
  }

  const talkingPoints = callPrep.talking_points || [];
  const talkingPointsText = talkingPoints
    .map((tp: any) => `- ${tp.topic}: ${tp.key_message}`)
    .join("\n");

  const customPrompt = callPrep.opening_script
    ? `${callPrep.opening_script}\n\nPunti chiave:\n${talkingPointsText}\n\n${callPrep.closing_script || ""}`
    : task.ai_instruction;

  let additionalContextData: Record<string, any> = {};
  if (task.additional_context) {
    try { additionalContextData = JSON.parse(task.additional_context); } catch {}
  }
  const isOutreachCall = task.task_category === 'prospecting' || !!additionalContextData.lead_id;
  const voiceTemplateId = additionalContextData.voice_template_id || task.voice_template_suggestion || null;
  const useDefaultTemplate = isOutreachCall ? false : true;
  const aiMode = isOutreachCall ? 'outreach' : 'assistenza';

  const callInstruction = isOutreachCall
    ? `[OUTREACH CALL] Lead: ${resolvedName || 'Sconosciuto'} | Tel: ${resolvedPhone}\n${task.ai_instruction}\n\nPunti chiave:\n${talkingPointsText}`
    : customPrompt;

  console.log(`${LOG_PREFIX} Voice call config: isOutreach=${isOutreachCall}, aiMode=${aiMode}, useDefaultTemplate=${useDefaultTemplate}, voiceTemplateId=${voiceTemplateId || 'none'}`);

  const scheduledCallId = generateScheduledCallId();

  const preferredDate = callPrep.preferred_call_date || _step.params?.preferred_date;
  const preferredTime = callPrep.preferred_call_time || _step.params?.preferred_time;
  let scheduledAtSql = sql`NOW()`;

  console.log(`${LOG_PREFIX} Creating scheduled voice call ${scheduledCallId} for task ${task.id}, phone=${resolvedPhone}, preferred: ${preferredDate || 'none'} ${preferredTime || 'none'}`);

  let targetDateTimeStr: string | null = null;
  if (preferredDate && preferredTime) {
    targetDateTimeStr = `${preferredDate} ${preferredTime}:00`;
  } else if (preferredDate) {
    targetDateTimeStr = `${preferredDate} 10:00:00`;
  }

  if (targetDateTimeStr) {
    const nowRomeResult = await db.execute(sql`
      SELECT to_char(NOW() AT TIME ZONE 'Europe/Rome', 'YYYY-MM-DD HH24:MI:SS') as now_rome
    `);
    const nowRomeStr = (nowRomeResult.rows[0] as any).now_rome as string;
    if (targetDateTimeStr < nowRomeStr) {
      console.log(`${LOG_PREFIX} ⚠️ AI proposed past date ${targetDateTimeStr}, now is ${nowRomeStr}. Shifting to next business day 10:00`);
      const nextSlotResult = await db.execute(sql`
        SELECT to_char(
          CASE 
            WHEN EXTRACT(DOW FROM (NOW() AT TIME ZONE 'Europe/Rome')) = 5 THEN (NOW() AT TIME ZONE 'Europe/Rome')::date + 3
            WHEN EXTRACT(DOW FROM (NOW() AT TIME ZONE 'Europe/Rome')) = 6 THEN (NOW() AT TIME ZONE 'Europe/Rome')::date + 2
            ELSE (NOW() AT TIME ZONE 'Europe/Rome')::date + 1
          END, 'YYYY-MM-DD'
        ) as next_day
      `);
      const nextDay = (nextSlotResult.rows[0] as any).next_day;
      targetDateTimeStr = `${nextDay} ${preferredTime || '10:00'}:00`;
      console.log(`${LOG_PREFIX} Shifted call to ${targetDateTimeStr}`);
    }
  }

  let timeWasShifted = false;
  let shiftAttempts = 0;
  const MAX_SHIFT_ATTEMPTS = 10;

  if (targetDateTimeStr) {
    let currentCheckStr = targetDateTimeStr;
    for (let attempt = 0; attempt < MAX_SHIFT_ATTEMPTS; attempt++) {
      const conflictResult = await db.execute(sql`
        SELECT scheduled_at FROM scheduled_voice_calls
        WHERE consultant_id = ${task.consultant_id}
          AND status IN ('scheduled', 'pending')
          AND ABS(EXTRACT(EPOCH FROM (scheduled_at - (${currentCheckStr}::timestamp AT TIME ZONE 'Europe/Rome')))) < 1800
        LIMIT 1
      `);
      if (conflictResult.rows.length === 0) {
        break;
      }
      console.log(`${LOG_PREFIX} Conflict found at ${currentCheckStr} (Rome), shifting +30 minutes (attempt ${attempt + 1}/${MAX_SHIFT_ATTEMPTS})`);
      const shiftedResult = await db.execute(sql`
        SELECT to_char((${currentCheckStr}::timestamp + interval '30 minutes'), 'YYYY-MM-DD HH24:MI:SS') as shifted
      `);
      currentCheckStr = (shiftedResult.rows[0] as any).shifted;
      timeWasShifted = true;
      shiftAttempts = attempt + 1;
    }
    scheduledAtSql = sql`${currentCheckStr}::timestamp AT TIME ZONE 'Europe/Rome'`;
    if (timeWasShifted) {
      console.log(`${LOG_PREFIX} Call time shifted to ${currentCheckStr} (Rome) after ${shiftAttempts} conflict resolution(s)`);
    }
  } else {
    const nowResult = await db.execute(sql`
      SELECT to_char(NOW() AT TIME ZONE 'Europe/Rome', 'YYYY-MM-DD HH24:MI:SS') as now_rome
    `);
    let currentCheckStr = (nowResult.rows[0] as any).now_rome as string;
    for (let attempt = 0; attempt < MAX_SHIFT_ATTEMPTS; attempt++) {
      const conflictResult = await db.execute(sql`
        SELECT scheduled_at FROM scheduled_voice_calls
        WHERE consultant_id = ${task.consultant_id}
          AND status IN ('scheduled', 'pending')
          AND ABS(EXTRACT(EPOCH FROM (scheduled_at - (${currentCheckStr}::timestamp AT TIME ZONE 'Europe/Rome')))) < 1800
        LIMIT 1
      `);
      if (conflictResult.rows.length === 0) {
        break;
      }
      console.log(`${LOG_PREFIX} Conflict found at NOW+offset, shifting +30 minutes (attempt ${attempt + 1}/${MAX_SHIFT_ATTEMPTS})`);
      const shiftedResult = await db.execute(sql`
        SELECT to_char((${currentCheckStr}::timestamp + interval '30 minutes'), 'YYYY-MM-DD HH24:MI:SS') as shifted
      `);
      currentCheckStr = (shiftedResult.rows[0] as any).shifted;
      timeWasShifted = true;
      shiftAttempts = attempt + 1;
    }
    scheduledAtSql = sql`${currentCheckStr}::timestamp AT TIME ZONE 'Europe/Rome'`;
    if (timeWasShifted) {
      console.log(`${LOG_PREFIX} Call time shifted from NOW to ${currentCheckStr} (Rome) after ${shiftAttempts} conflict resolution(s)`);
    }
  }

  await db.execute(sql`
    INSERT INTO scheduled_voice_calls (
      id, consultant_id, target_phone, scheduled_at, status, ai_mode,
      custom_prompt, call_instruction, instruction_type, attempts, max_attempts,
      priority, source_task_id, attempts_log, use_default_template, voice_template_id, created_at, updated_at
    ) VALUES (
      ${scheduledCallId}, ${task.consultant_id}, ${resolvedPhone},
      ${scheduledAtSql}, 'scheduled', ${aiMode},
      ${customPrompt}, ${callInstruction},
      'task', 0, 3,
      ${task.priority || 1}, ${task.id}, '[]'::jsonb, ${useDefaultTemplate}, ${voiceTemplateId}, NOW(), NOW()
    )
  `);

  const childTaskId = `task_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

  await db.execute(sql`
    INSERT INTO ai_scheduled_tasks (
      id, consultant_id, contact_phone, contact_name, task_type, ai_instruction,
      scheduled_at, timezone, status, priority, parent_task_id,
      contact_id, task_category, voice_call_id,
      max_attempts, current_attempt, retry_delay_minutes,
      created_at, updated_at
    ) VALUES (
      ${childTaskId}, ${task.consultant_id}, ${resolvedPhone},
      ${resolvedName}, 'single_call', ${customPrompt},
      ${scheduledAtSql}, ${task.timezone || "Europe/Rome"}, 'scheduled', ${task.priority || 1}, ${task.id},
      ${task.contact_id}, ${task.task_category}, ${scheduledCallId},
      3, 0, 5,
      NOW(), NOW()
    )
  `);

  console.log(`${LOG_PREFIX} Created child task ${childTaskId} with voice_call_id ${scheduledCallId}`);

  const insertedResult = await db.execute(sql`
    SELECT to_char(scheduled_at AT TIME ZONE 'Europe/Rome', 'DD/MM/YYYY') as display_date,
           to_char(scheduled_at AT TIME ZONE 'Europe/Rome', 'HH24:MI') as display_time,
           to_char(scheduled_at AT TIME ZONE 'Europe/Rome', 'YYYY-MM-DD HH24:MI') as return_at
    FROM scheduled_voice_calls WHERE id = ${scheduledCallId} LIMIT 1
  `);
  const inserted = insertedResult.rows[0] as any;
  const shiftNote = timeWasShifted ? ' (spostata per evitare conflitti)' : '';
  const scheduledDisplay = inserted
    ? `${inserted.display_date} alle ${inserted.display_time}${shiftNote}`
    : "il prima possibile";
  const scheduledAtReturn = inserted?.return_at || "now";

  await logActivity(task.consultant_id, {
    event_type: "voice_call_scheduled",
    title: `Tutto pronto, chiamata fissata per ${scheduledDisplay}`,
    description: `Ho programmato la chiamata a ${resolvedName || resolvedPhone} — ci penso io`,
    icon: "📅",
    severity: "info",
    task_id: task.id,
    contact_name: resolvedName,
    contact_id: task.contact_id,
  });

  return {
    call_id: scheduledCallId,
    child_task_id: childTaskId,
    target_phone: resolvedPhone,
    custom_prompt: customPrompt,
    status: "scheduled",
    scheduled_at: scheduledAtReturn,
    time_was_shifted: timeWasShifted,
    shift_attempts: shiftAttempts,
  };
}

async function generatePdfBuffer(report: any, analysis: any, task: AITaskInfo): Promise<Buffer> {
  const PDFDocument = (await import('pdfkit')).default;

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ 
      size: 'A4', 
      margins: { top: 50, bottom: 50, left: 50, right: 50 },
      bufferPages: true,
    });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const drawDivider = (y: number) => {
      doc.save();
      doc.moveTo(50, y).lineTo(545, y).strokeColor('#dcdce0').lineWidth(0.4).stroke();
      doc.restore();
    };

    doc.fontSize(18).font('Helvetica-Bold').text(report.title || 'Report AI', { align: 'center' });
    doc.moveDown(0.3);
    doc.fontSize(10).font('Helvetica').fillColor('#666666')
      .text(`Cliente: ${task.contact_name || 'N/A'}  |  Data: ${new Date().toLocaleDateString('it-IT')}`, { align: 'center' });
    doc.moveDown(0.5);
    drawDivider(doc.y);
    doc.moveDown(1);

    if (report.summary) {
      const summaryY = doc.y;
      doc.fillColor('#333333').fontSize(9).font('Helvetica-Oblique')
        .text(report.summary, 65, summaryY, { width: 480, align: 'justify' });
      const summaryEndY = doc.y;
      doc.save();
      doc.rect(50, summaryY - 2, 3, summaryEndY - summaryY + 4).fill('#1450A0');
      doc.restore();
      doc.y = summaryEndY;
      doc.moveDown(1);
      drawDivider(doc.y);
      doc.moveDown(1);
    }

    if (report.sections && Array.isArray(report.sections)) {
      report.sections.forEach((section: any, idx: number) => {
        if (doc.y > 700) doc.addPage();
        doc.fillColor('#1a1a1a').fontSize(13).font('Helvetica-Bold')
          .text(`${idx + 1}. ${section.heading}`, { align: 'left' });
        doc.moveDown(0.5);
        doc.fillColor('#333333').fontSize(10).font('Helvetica')
          .text(section.content, { align: 'justify', lineGap: 3 });
        doc.moveDown(0.6);
        if (idx < report.sections.length - 1) {
          drawDivider(doc.y);
        }
        doc.moveDown(0.6);
      });
    }

    if (report.key_findings && Array.isArray(report.key_findings) && report.key_findings.length > 0) {
      if (doc.y > 650) doc.addPage();
      drawDivider(doc.y);
      doc.moveDown(0.8);
      doc.fillColor('#1a1a1a').fontSize(13).font('Helvetica-Bold').text('Risultati Chiave');
      doc.moveDown(0.5);
      for (const f of report.key_findings) {
        if (doc.y > 720) doc.addPage();
        const findingY = doc.y;
        doc.save();
        doc.rect(55, findingY, 2.5, 12).fill('#228B22');
        doc.restore();
        doc.fillColor('#333333').fontSize(10).font('Helvetica')
          .text(f, 65, findingY, { width: 475, lineGap: 2 });
        doc.moveDown(0.5);
      }
      doc.moveDown(0.8);
    }

    if (report.recommendations && Array.isArray(report.recommendations) && report.recommendations.length > 0) {
      if (doc.y > 650) doc.addPage();
      drawDivider(doc.y);
      doc.moveDown(0.8);
      doc.fillColor('#1a1a1a').fontSize(13).font('Helvetica-Bold').text('Raccomandazioni');
      doc.moveDown(0.5);
      for (const r of report.recommendations) {
        if (doc.y > 700) doc.addPage();
        const recY = doc.y;
        doc.save();
        let badgeColor: [number, number, number];
        let badgeText: string;
        let badgeW: number;
        if (r.priority === 'high') {
          badgeColor = [220, 40, 40]; badgeText = 'ALTA'; badgeW = 38;
        } else if (r.priority === 'medium') {
          badgeColor = [230, 160, 30]; badgeText = 'MEDIA'; badgeW = 42;
        } else {
          badgeColor = [40, 170, 70]; badgeText = 'BASSA'; badgeW = 44;
        }
        doc.roundedRect(60, recY, badgeW, 15, 3).fill(badgeColor[0], badgeColor[1], badgeColor[2]);
        doc.fillColor('#ffffff').fontSize(7).font('Helvetica-Bold')
          .text(badgeText, 60, recY + 3, { width: badgeW, align: 'center' });
        doc.restore();
        doc.fillColor('#1a1a1a').fontSize(10).font('Helvetica-Bold')
          .text(r.action, 60 + badgeW + 8, recY + 1, { width: 485 - badgeW - 8 });
        if (r.rationale) {
          doc.moveDown(0.2);
          doc.fillColor('#555555').fontSize(9).font('Helvetica')
            .text(`→ ${r.rationale}`, 68 + badgeW, undefined as any, { width: 477 - badgeW, lineGap: 2 });
        }
        doc.moveDown(0.5);
      }
      doc.moveDown(0.8);
    }

    if (report.next_steps && Array.isArray(report.next_steps) && report.next_steps.length > 0) {
      if (doc.y > 650) doc.addPage();
      drawDivider(doc.y);
      doc.moveDown(0.8);
      doc.fillColor('#1a1a1a').fontSize(13).font('Helvetica-Bold').text('Prossimi Passi');
      doc.moveDown(0.5);
      report.next_steps.forEach((s: string, i: number) => {
        if (doc.y > 720) doc.addPage();
        const stepY = doc.y;
        doc.save();
        doc.rect(60, stepY, 11, 11).lineWidth(0.8).strokeColor('#1450A0').stroke();
        doc.restore();
        doc.fillColor('#333333').fontSize(10).font('Helvetica')
          .text(s, 78, stepY, { width: 467, lineGap: 2 });
        doc.moveDown(0.4);
      });
    }

    doc.end();
  });
}

async function generateFormalDocumentPdfBuffer(formalDoc: any, reportData: any, task: AITaskInfo): Promise<Buffer> {
  const PDFDocument = (await import('pdfkit')).default;

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: 50, bottom: 60, left: 55, right: 55 },
      bufferPages: true,
    });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const pageWidth = doc.page.width;
    const contentWidth = pageWidth - 110;
    const header = formalDoc.header || {};
    const body = formalDoc.body || [];
    const footer = formalDoc.footer || {};
    const docType = formalDoc.type || reportData.document_type || 'analysis';

    const DARK_BLUE = '#1a2744';
    const ACCENT_BLUE = '#2d4a7c';
    const TEXT_PRIMARY = '#222222';
    const TEXT_SECONDARY = '#444444';
    const TEXT_MUTED = '#666666';
    const BORDER_LIGHT = '#d0d0d0';

    const checkPageBreak = (needed: number = 80) => {
      if (doc.y > doc.page.height - doc.page.margins.bottom - needed) {
        doc.addPage();
      }
    };

    const drawDivider = (y: number) => {
      doc.save();
      doc.moveTo(55, y).lineTo(pageWidth - 55, y).strokeColor('#dcdce0').lineWidth(0.4).stroke();
      doc.restore();
    };

    doc.save();
    doc.rect(0, 0, pageWidth, 110).fill(DARK_BLUE);
    doc.restore();

    const headerTitle = header.title || reportData.title || 'Documento';
    doc.fillColor('#ffffff').fontSize(22).font('Helvetica-Bold')
      .text(headerTitle, 55, 20, { align: 'center', width: contentWidth });

    const titleBottom = doc.y;
    if (header.subtitle) {
      doc.fillColor('#b0c4de').fontSize(11).font('Helvetica')
        .text(header.subtitle, 55, Math.min(titleBottom + 5, 60), { align: 'center', width: contentWidth });
    }

    if (header.date) {
      doc.fillColor('#8899aa').fontSize(9).font('Helvetica')
        .text(header.date, 55, 92, { align: 'center', width: contentWidth });
    }

    doc.y = 125;

    if (header.reference_number || header.reference) {
      doc.fillColor(TEXT_MUTED).fontSize(9).font('Helvetica')
        .text(`Rif: ${header.reference_number || header.reference}`, { align: 'right' });
    }

    if (header.parties && Array.isArray(header.parties) && header.parties.length > 0) {
      doc.moveDown(0.3);
      doc.fillColor(TEXT_PRIMARY).fontSize(10).font('Helvetica-Bold').text('Parti coinvolte:');
      for (const party of header.parties) {
        doc.fillColor(TEXT_SECONDARY).fontSize(9.5).font('Helvetica').text(`  •  ${party}`);
      }
    }

    doc.moveDown(0.8);
    doc.moveTo(55, doc.y).lineTo(pageWidth - 55, doc.y).strokeColor(DARK_BLUE).lineWidth(1.5).stroke();
    doc.moveDown(1);

    let lastStepBottomY = -1;

    for (let idx = 0; idx < body.length; idx++) {
      const item = body[idx];
      checkPageBreak(40);

      const itemType = item.type || 'paragraph';
      const itemNumber = item.number || `${idx + 1}`;
      const itemTitle = item.title || '';
      const itemContent = item.content || '';

      if (itemType === 'article') {
        doc.fillColor(DARK_BLUE).fontSize(13).font('Helvetica-Bold')
          .text(`Art. ${itemNumber} — ${itemTitle}`, 55, doc.y, { width: contentWidth });
        doc.moveDown(0.2);
        doc.moveTo(55, doc.y).lineTo(200, doc.y).strokeColor(ACCENT_BLUE).lineWidth(0.5).stroke();
      } else if (itemType === 'step') {
        const stepY = doc.y;
        if (lastStepBottomY > 0 && lastStepBottomY < stepY && (stepY - lastStepBottomY) < 200) {
          doc.save();
          doc.moveTo(70, lastStepBottomY).lineTo(70, stepY).strokeColor('#c0d0e8').lineWidth(1).stroke();
          doc.restore();
        }
        doc.save();
        doc.rect(55, stepY, 30, 22).fill(DARK_BLUE);
        doc.fillColor('#ffffff').fontSize(11).font('Helvetica-Bold')
          .text(itemNumber, 55, stepY + 5, { width: 30, align: 'center' });
        doc.restore();
        doc.fillColor(DARK_BLUE).fontSize(12).font('Helvetica-Bold')
          .text(itemTitle, 95, stepY + 3, { width: contentWidth - 40 });
        doc.y = Math.max(doc.y, stepY + 26);
        lastStepBottomY = doc.y;
      } else {
        lastStepBottomY = -1;
        const sectionPrefix = itemNumber ? `${itemNumber}. ` : '';
        doc.fillColor(DARK_BLUE).fontSize(12).font('Helvetica-Bold')
          .text(`${sectionPrefix}${itemTitle}`, 55, doc.y, { width: contentWidth });
        doc.moveDown(0.2);
        doc.moveTo(55, doc.y).lineTo(180, doc.y).strokeColor(BORDER_LIGHT).lineWidth(0.5).stroke();
      }

      if (itemContent) {
        doc.moveDown(0.4);
        checkPageBreak(30);
        doc.fillColor(TEXT_PRIMARY).fontSize(10).font('Helvetica')
          .text(itemContent, 55, doc.y, { width: contentWidth, align: 'justify', lineGap: 3.5 });
      }

      if (item.items && Array.isArray(item.items)) {
        doc.moveDown(0.3);
        for (const listItem of item.items) {
          checkPageBreak(35);
          const bulletText = typeof listItem === 'string' ? listItem : (listItem.content || listItem.text || JSON.stringify(listItem));
          const cardY = doc.y;
          doc.save();
          const cardTextH = doc.heightOfString(bulletText, { width: contentWidth - 40, fontSize: 9.5 });
          const cardH = Math.max(cardTextH + 10, 22);
          doc.rect(65, cardY, contentWidth - 20, cardH).lineWidth(0.5).fillAndStroke('#FAFAFA', '#D0D8E8');
          doc.fillColor(TEXT_SECONDARY).fontSize(9.5).font('Helvetica')
            .text(bulletText, 72, cardY + 5, { width: contentWidth - 34, lineGap: 2 });
          doc.restore();
          doc.y = cardY + cardH + 4;
        }
      }

      if (item.subsections && Array.isArray(item.subsections)) {
        for (const sub of item.subsections) {
          doc.moveDown(0.4);
          checkPageBreak(50);
          const subStartY = doc.y;
          if (sub.title) {
            const subPrefix = sub.number ? `${sub.number}  ` : '';
            doc.fillColor(ACCENT_BLUE).fontSize(10).font('Helvetica-Bold')
              .text(`${subPrefix}${sub.title}`, 75, doc.y, { width: contentWidth - 30 });
          }
          if (sub.content) {
            doc.moveDown(0.2);
            doc.fillColor(TEXT_SECONDARY).fontSize(9.5).font('Helvetica')
              .text(sub.content, 75, doc.y, { width: contentWidth - 30, align: 'justify', lineGap: 2.5 });
          }
          if (sub.items && Array.isArray(sub.items)) {
            doc.moveDown(0.2);
            for (const si of sub.items) {
              checkPageBreak(25);
              const siText = typeof si === 'string' ? si : (si.content || si.text || '');
              doc.fillColor(TEXT_MUTED).fontSize(9).font('Helvetica')
                .text(`    ◦  ${siText}`, 80, doc.y, { width: contentWidth - 35, lineGap: 2 });
            }
          }
          const subEndY = doc.y;
          doc.save();
          doc.moveTo(68, subStartY).lineTo(68, subEndY).strokeColor(ACCENT_BLUE).lineWidth(1.5).stroke();
          doc.restore();
        }
      }

      doc.moveDown(0.6);
      if (idx < body.length - 1) {
        drawDivider(doc.y);
      }
      doc.moveDown(0.6);
    }

    if (footer.notes) {
      checkPageBreak(40);
      doc.moveDown(1);
      doc.moveTo(55, doc.y).lineTo(pageWidth - 55, doc.y).strokeColor(BORDER_LIGHT).lineWidth(0.5).stroke();
      doc.moveDown(0.5);
      const notesY = doc.y;
      doc.fillColor(TEXT_MUTED).fontSize(8).font('Helvetica-Oblique')
        .text(footer.notes, 68, notesY, { width: contentWidth - 13, align: 'left', lineGap: 2 });
      const notesEndY = doc.y;
      doc.save();
      doc.rect(55, notesY - 2, 6, notesEndY - notesY + 4).fill(ACCENT_BLUE);
      doc.restore();
      doc.y = notesEndY;
      doc.moveDown(1);
    }

    if (footer.signatures && Array.isArray(footer.signatures) && footer.signatures.length > 0 && docType === 'contract') {
      checkPageBreak(60);
      doc.moveDown(1.5);
      drawDivider(doc.y);
      doc.moveDown(0.8);
      doc.fillColor(DARK_BLUE).fontSize(11).font('Helvetica-Bold').text('FIRME', { align: 'center' });
      doc.moveDown(1);

      const sigWidth = 200;
      const sigSpacing = (contentWidth - sigWidth * Math.min(footer.signatures.length, 2)) / Math.max(footer.signatures.length - 1, 1);

      for (let i = 0; i < footer.signatures.length; i++) {
        const sig = footer.signatures[i];
        if (i > 0 && i % 2 === 0) {
          doc.moveDown(3);
        }
        const xPos = 55 + (i % 2) * (sigWidth + sigSpacing);
        const yPos = doc.y;

        doc.fillColor(TEXT_PRIMARY).fontSize(9).font('Helvetica-Bold')
          .text(sig.role || '', xPos, yPos, { width: sigWidth });
        doc.moveDown(2);
        doc.moveTo(xPos, doc.y).lineTo(xPos + sigWidth - 20, doc.y).strokeColor(TEXT_PRIMARY).lineWidth(0.5).stroke();
        doc.moveDown(0.3);
        doc.fillColor(TEXT_MUTED).fontSize(8).font('Helvetica')
          .text(sig.name || '', xPos, doc.y, { width: sigWidth });
        if (i % 2 === 0 && i + 1 < footer.signatures.length) {
          doc.y = yPos;
        }
      }
    }

    if (footer.location_date && docType === 'contract') {
      doc.moveDown(2);
      doc.fillColor(TEXT_MUTED).fontSize(9).font('Helvetica')
        .text(footer.location_date, { align: 'right' });
    }

    const pages = doc.bufferedPageRange();
    for (let i = pages.start; i < pages.start + pages.count; i++) {
      doc.switchToPage(i);
      doc.save();
      doc.rect(0, doc.page.height - 40, pageWidth, 40).fill('#f5f5f5');
      doc.restore();
      doc.fillColor(TEXT_MUTED).fontSize(7.5).font('Helvetica')
        .text(`${headerTitle}`, 55, doc.page.height - 32, { width: contentWidth * 0.6, align: 'left' });
      doc.fillColor('#999999').fontSize(7.5).font('Helvetica')
        .text(`Pagina ${i + 1} di ${pages.count}`, 55, doc.page.height - 32, { width: contentWidth, align: 'right' });
    }

    doc.end();
  });
}

async function handleSendEmail(
  task: AITaskInfo,
  _step: ExecutionStep,
  previousResults: Record<string, any>,
  agentContextSection?: string,
  autonomyModel?: string,
  autonomyThinkingLevel?: string,
  roleTemperature?: number,
): Promise<Record<string, any>> {
  await logActivity(task.consultant_id, {
    event_type: 'step_send_email_started',
    title: `Sto scrivendo l'email${task.contact_name ? ` per ${task.contact_name}` : ''}...`,
    description: `Preparo il contenuto personalizzato e poi la invio`,
    icon: '📧',
    severity: 'info',
    task_id: task.id,
    contact_name: task.contact_name,
    contact_id: task.contact_id,
  });

  const clientData = previousResults.fetch_client_data || {};
  const reportData = previousResults.generate_report || {};
  const analysisData = previousResults.analyze_patterns || {};
  let contactEmail = clientData.contact?.email;

  if (!contactEmail) {
    const [autonomyResult, userResult] = await Promise.all([
      db.execute(sql`
        SELECT consultant_email FROM ai_autonomy_settings
        WHERE consultant_id = ${task.consultant_id} LIMIT 1
      `),
      db.execute(sql`
        SELECT email FROM users WHERE id = ${task.consultant_id} LIMIT 1
      `),
    ]);
    const autonomyEmail = (autonomyResult.rows[0] as any)?.consultant_email;
    const userEmail = (userResult.rows[0] as any)?.email;
    contactEmail = autonomyEmail || userEmail;
    console.log(`${LOG_PREFIX} No contact email, using ${autonomyEmail ? 'autonomy settings' : 'account'} email: ${contactEmail}`);
  }

  if (!contactEmail) {
    return { status: "skipped", reason: "Nessun indirizzo email disponibile per il contatto né per il consulente" };
  }

  let additionalCtx: Record<string, any> = {};
  if (task.additional_context) {
    try { additionalCtx = JSON.parse(task.additional_context); } catch {}
  }
  const preferredEmailAccountId = additionalCtx.email_account_id || null;

  const smtpResult = await db.execute(sql`
    SELECT id, smtp_host, smtp_port, smtp_user, smtp_password, email_address, display_name
    FROM email_accounts
    WHERE consultant_id = ${task.consultant_id} AND smtp_host IS NOT NULL
    ${preferredEmailAccountId ? sql`AND id = ${preferredEmailAccountId}` : sql``}
    ORDER BY ${preferredEmailAccountId ? sql`CASE WHEN id = ${preferredEmailAccountId} THEN 0 ELSE 1 END` : sql`created_at`}
    LIMIT 1
  `);

  if (smtpResult.rows.length === 0) {
    return { status: "skipped", reason: "Nessun account email SMTP configurato per il consulente" };
  }

  const smtpConfig = smtpResult.rows[0] as any;
  const emailAccountId = smtpConfig.id;

  const emailSubject = _step.params?.subject || `Report: ${reportData.title || task.task_category}`;
  let emailBody = _step.params?.message_summary || "";

  if (!emailBody) {
    try {
      let emailStepNumber = 1;
      let emailTemplateSection = '';
      const isProspecting = task.task_category === 'prospecting' || !!additionalCtx.lead_id;

      if (isProspecting && additionalCtx.lead_id) {
        try {
          const prevEmailCount = await db.execute(sql`
            SELECT COUNT(*) as cnt FROM lead_scraper_activities
            WHERE lead_id = ${additionalCtx.lead_id}::uuid
              AND type IN ('email_inviata', 'email_sent')
          `);
          emailStepNumber = parseInt((prevEmailCount.rows[0] as any)?.cnt || '0') + 1;
        } catch {}

        const followUpTemplate = selectBestTemplate({
          stepNumber: emailStepNumber,
          hasWebsiteData: !!additionalCtx.website_data,
          sector: additionalCtx.sector || undefined,
        });

        emailTemplateSection = `\n\nSEGUI ESATTAMENTE la struttura del seguente template. Sostituisci TUTTI i placeholder con dati reali. Puoi adattare singole frasi al contesto ma MANTIENI la struttura, il tono e la leva psicologica.

--- TEMPLATE DA SEGUIRE: "${followUpTemplate.name}" ---
SCENARIO: ${followUpTemplate.whenToUse}
LEVA PSICOLOGICA: ${followUpTemplate.psychologicalLever}
CORPO:
${followUpTemplate.body}
--- FINE TEMPLATE ---

${GOLDEN_RULES}`;

        console.log(`${LOG_PREFIX} Email follow-up step ${emailStepNumber}, using template: ${followUpTemplate.name}`);
      }

      const { client, model: resolvedModel, providerName } = await resolveProviderForTask(task.consultant_id, task.ai_role);
      const effectiveEmailModel = autonomyModel || resolvedModel;
      console.log(`${LOG_PREFIX} send_email body generation using ${providerName} (${effectiveEmailModel})`);
      const emailPrompt = `Scrivi un'email BREVE (massimo 4-5 frasi) e professionale per il cliente ${task.contact_name || 'N/A'}.
${agentContextSection || ''}
Contesto: ${task.ai_instruction}
${task.additional_context ? `\nIstruzioni aggiuntive e contesto, segui attentamente o tieni a memoria:\n${task.additional_context}` : ''}${buildFollowUpSection(previousResults)}
${reportData.title ? `Report allegato: "${reportData.title}"` : ''}
${reportData.summary ? `Riepilogo: ${reportData.summary.substring(0, 200)}` : ''}${emailTemplateSection}

REGOLE IMPORTANTI:
1. Scrivi l'INTERA email completa: saluto iniziale, corpo, e chiusura. Il tono deve essere COERENTE dall'inizio alla fine.
2. NON dare per scontato che azioni programmate (chiamate, incontri) siano già avvenute. Se è stata programmata una chiamata futura, scrivi "la contatterò" o "ci sentiremo", NON "come anticipato a voce".
3. NON scrivere un papiro. Il dettaglio è nel report allegato.
4. Sii diretto e professionale.`;

      const resp = await withRetry(() => client.generateContent({
        model: effectiveEmailModel,
        contents: [{ role: "user", parts: [{ text: emailPrompt }] }],
        generationConfig: { temperature: roleTemperature ?? 0.4, maxOutputTokens: 512, thinkingConfig: { thinkingBudget: getThinkingBudgetForLevel(autonomyThinkingLevel || 'low') } },
      }));
      emailBody = resp.response.text() || "";
    } catch (provErr: any) {
      console.warn(`${LOG_PREFIX} Could not resolve provider for email body: ${provErr.message}`);
    }
  }

  const hasFormalDoc = !!(reportData.formal_document?.body);
  const htmlBody = `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <p>${emailBody.replace(/\n/g, '</p><p>')}</p>
    ${reportData.title ? `<p><em>In allegato ${hasFormalDoc ? 'trova i report dettagliati' : 'trova il report dettagliato'}.</em></p>` : ''}
  </div>`;

  let attachments: any[] = [];
  if (reportData && reportData.title) {
    const safeName = (task.contact_name || 'cliente').replace(/[^a-zA-Z0-9]/g, '_');
    try {
      const summaryPdf = await generatePdfBuffer(reportData, analysisData, task);
      attachments.push({
        filename: `riepilogo_${safeName}.pdf`,
        content: summaryPdf,
        contentType: 'application/pdf',
      });
      console.log(`${LOG_PREFIX} Summary PDF generated: ${summaryPdf.length} bytes`);
    } catch (pdfErr: any) {
      console.error(`${LOG_PREFIX} Summary PDF generation failed: ${pdfErr.message}`);
    }

    if (hasFormalDoc) {
      try {
        const formalPdf = await generateFormalDocumentPdfBuffer(reportData.formal_document, reportData, task);
        attachments.push({
          filename: `documento_${safeName}.pdf`,
          content: formalPdf,
          contentType: 'application/pdf',
        });
        console.log(`${LOG_PREFIX} Formal document PDF generated: ${formalPdf.length} bytes`);
      } catch (formalErr: any) {
        console.error(`${LOG_PREFIX} Formal document PDF generation failed: ${formalErr.message}`);
      }
    }
  }

  try {
    const nodemailer = await import('nodemailer');
    const transporter = nodemailer.createTransport({
      host: smtpConfig.smtp_host,
      port: smtpConfig.smtp_port || 587,
      secure: (smtpConfig.smtp_port || 587) === 465,
      auth: { user: smtpConfig.smtp_user, pass: smtpConfig.smtp_password },
      tls: { rejectUnauthorized: false },
    });

    const mailOptions: any = {
      from: smtpConfig.display_name ? `"${smtpConfig.display_name}" <${smtpConfig.email_address}>` : smtpConfig.email_address,
      to: contactEmail,
      subject: emailSubject,
      html: htmlBody,
    };

    if (attachments.length > 0) {
      mailOptions.attachments = attachments;
    }

    const sendResult = await transporter.sendMail(mailOptions);
    console.log(`${LOG_PREFIX} ✅ Email sent successfully via SMTP. MessageId: ${sendResult.messageId}, To: ${contactEmail}, Attachments: ${attachments.length}`);

    try {
      const hubEmailId = `hub_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      await db.execute(sql`
        INSERT INTO hub_emails (
          id, account_id, consultant_id, message_id, subject, from_name, from_email,
          to_recipients, body_html, body_text, snippet, direction, folder,
          is_read, processing_status, sent_at, created_at, updated_at
        ) VALUES (
          ${hubEmailId}, ${emailAccountId}, ${task.consultant_id},
          ${sendResult.messageId || hubEmailId},
          ${emailSubject}, ${smtpConfig.display_name || ''}, ${smtpConfig.email_address},
          ${JSON.stringify([{ email: contactEmail, name: task.contact_name || '' }])}::jsonb,
          ${htmlBody}, ${emailBody}, ${emailBody.substring(0, 200)},
          'outbound', 'sent', true, 'sent', NOW(), NOW(), NOW()
        )
        ON CONFLICT (message_id) DO NOTHING
      `);
      console.log(`${LOG_PREFIX} Email tracked in hub_emails: ${hubEmailId}`);
    } catch (hubErr: any) {
      console.warn(`${LOG_PREFIX} Failed to track email in hub_emails: ${hubErr.message}`);
    }

    await logActivity(task.consultant_id, {
      event_type: "email_sent",
      title: `Email inviata! Oggetto: "${emailSubject}"`,
      description: `Ho scritto e inviato a ${task.contact_name || contactEmail}. ${attachments.length > 0 ? `${attachments.length} PDF allegat${attachments.length === 1 ? 'o' : 'i'}.` : 'Senza allegati.'}`,
      icon: "📧",
      severity: "info",
      task_id: task.id,
      contact_name: task.contact_name,
      contact_id: task.contact_id,
    });

    return {
      status: "sent",
      message_id: sendResult.messageId,
      recipient: contactEmail,
      subject: emailSubject,
      from_email: smtpConfig.email_address,
      account_name: smtpConfig.display_name || smtpConfig.email_address,
      has_attachment: attachments.length > 0,
      attachment_count: attachments.length,
      body: emailBody,
      body_html: htmlBody,
    };
  } catch (error: any) {
    console.error(`${LOG_PREFIX} Email send failed:`, error.message);

    await logActivity(task.consultant_id, {
      event_type: "email_failed",
      title: `Non sono riuscito/a a inviare l'email a ${task.contact_name || contactEmail}...`,
      description: `Ho provato ma c'è stato un problema: ${error.message}`,
      icon: "❌",
      severity: "error",
      task_id: task.id,
      contact_name: task.contact_name,
      contact_id: task.contact_id,
    });

    return {
      status: "failed",
      error: error.message,
      recipient: contactEmail,
      subject: emailSubject,
    };
  }
}

async function handleSendWhatsapp(
  task: AITaskInfo,
  _step: ExecutionStep,
  previousResults: Record<string, any>,
  agentContextSection?: string,
  autonomyModel?: string,
  autonomyThinkingLevel?: string,
  roleTemperature?: number,
): Promise<Record<string, any>> {
  await logActivity(task.consultant_id, {
    event_type: 'step_send_whatsapp_started',
    title: `Scrivo a ${task.contact_name || 'il contatto'} su WhatsApp...`,
    description: `Scelgo il template giusto e personalizzo il messaggio`,
    icon: '💬',
    severity: 'info',
    task_id: task.id,
    contact_name: task.contact_name,
    contact_id: task.contact_id,
  });

  const reportData = previousResults.generate_report || {};

  let resolvedPhone = task.contact_phone;
  let resolvedName = task.contact_name;

  if (!resolvedPhone || resolvedPhone === 'N/A' || resolvedPhone.trim() === '') {
    if (task.ai_role === 'marco') {
      const settingsResult = await db.execute(sql`
        SELECT consultant_phone, consultant_whatsapp FROM ai_autonomy_settings
        WHERE consultant_id::text = ${task.consultant_id}::text LIMIT 1
      `);
      const s = settingsResult.rows[0] as any;
      const consultantPhone = s?.consultant_whatsapp || s?.consultant_phone;
      if (consultantPhone) {
        resolvedPhone = consultantPhone;
        resolvedName = resolvedName || 'Consulente (tu)';
        console.log(`${LOG_PREFIX} [MARCO] WhatsApp: resolved consultant phone: ${resolvedPhone}`);
      }
    }

    if (!resolvedPhone || resolvedPhone === 'N/A') {
      if (task.contact_id) {
        const contactResult = await db.execute(sql`
          SELECT phone_number, first_name, last_name FROM users WHERE id::text = ${task.contact_id}::text LIMIT 1
        `);
        const c = contactResult.rows[0] as any;
        if (c?.phone_number) {
          resolvedPhone = c.phone_number;
          resolvedName = resolvedName || `${c.first_name || ''} ${c.last_name || ''}`.trim();
        }
      }
    }
  }

  if (!resolvedPhone || resolvedPhone === 'N/A') {
    return { status: "skipped", reason: "Nessun numero di telefono disponibile" };
  }

  let selectedTemplateId: string | null = null;
  try {
    const templateSettings = await db.execute(sql`
      SELECT whatsapp_template_ids FROM ai_autonomy_settings
      WHERE consultant_id::text = ${task.consultant_id}::text LIMIT 1
    `);
    const templateIds = (templateSettings.rows[0] as any)?.whatsapp_template_ids || [];
    if (templateIds.length > 0) {
      selectedTemplateId = templateIds[Math.floor(Math.random() * templateIds.length)];
      console.log(`📋 ${LOG_PREFIX} WhatsApp template selezionato: ${selectedTemplateId} (da ${templateIds.length} configurati)`);
    } else {
      console.log(`⚠️ ${LOG_PREFIX} Nessun template WhatsApp configurato, invio come testo libero`);
    }
  } catch (err: any) {
    console.warn(`${LOG_PREFIX} Errore nel recupero template WhatsApp:`, err.message);
  }

  let templateVariableCount = 0;
  let templateBodyText = '';
  if (selectedTemplateId) {
    try {
      const whatsappConfigResult = await db.execute(sql`
        SELECT twilio_account_sid, twilio_auth_token FROM consultant_whatsapp_config
        WHERE consultant_id::text = ${task.consultant_id}::text AND is_active = true
        ${task.whatsapp_config_id ? sql`AND id::text = ${task.whatsapp_config_id}::text` : sql``}
        LIMIT 1
      `);
      const waCfg = whatsappConfigResult.rows[0] as any;
      if (waCfg?.twilio_account_sid && waCfg?.twilio_auth_token) {
        const twilio = (await import('twilio')).default;
        const twilioClient = twilio(waCfg.twilio_account_sid, waCfg.twilio_auth_token);
        const content = await twilioClient.content.v1.contents(selectedTemplateId).fetch();

        if (content.variables && typeof content.variables === 'object') {
          templateVariableCount = Object.keys(content.variables).length;
        }

        const whatsappTemplate = (content.types as any)?.['twilio/whatsapp']?.template;
        if (whatsappTemplate?.components) {
          const bodyComponent = whatsappTemplate.components.find((comp: any) => comp.type === 'BODY');
          templateBodyText = bodyComponent?.text || '';
        }
        if (!templateBodyText) {
          templateBodyText = (content.types as any)?.['twilio/text']?.body || '';
        }

        console.log(`📋 ${LOG_PREFIX} Template ${selectedTemplateId}: ${templateVariableCount} variabili, body: "${templateBodyText.substring(0, 80)}..."`);
      }
    } catch (tplErr: any) {
      console.warn(`${LOG_PREFIX} Errore nel recupero struttura template: ${tplErr.message}`);
      console.warn(`⚠️ ${LOG_PREFIX} Template verrà inviato senza variabili personalizzate (Twilio userà i valori di default)`);
    }
  }

  let messageText = _step.params?.message_summary || "";

  let contentVariables: Record<string, string> | undefined;
  let usedPreGeneratedVars = false;

  if (task.additional_context) {
    try {
      const ctxData = JSON.parse(task.additional_context);
      if (ctxData.wa_template_variables && typeof ctxData.wa_template_variables === 'object') {
        contentVariables = ctxData.wa_template_variables as Record<string, string>;
        usedPreGeneratedVars = true;

        if (ctxData.wa_template_sid) {
          selectedTemplateId = ctxData.wa_template_sid;
          console.log(`✅ ${LOG_PREFIX} [TEMPLATE VARS] Usando variabili PRE-GENERATE + SID pre-salvato: ${selectedTemplateId} | vars: ${JSON.stringify(contentVariables)}`);
        } else {
          console.log(`✅ ${LOG_PREFIX} [TEMPLATE VARS] Usando variabili PRE-GENERATE (no SID): ${JSON.stringify(contentVariables)}`);
        }
      }
    } catch {}
  }

  if (selectedTemplateId && templateVariableCount > 0 && !usedPreGeneratedVars) {
    try {
      const { client, model: resolvedModel, providerName } = await resolveProviderForTask(task.consultant_id, task.ai_role);
      const effectiveWaModel = autonomyModel || resolvedModel;
      console.log(`${LOG_PREFIX} Generating template variables using ${providerName} (${effectiveWaModel})`);

      let additionalLeadContext = '';
      if (task.additional_context) {
        try {
          const ctxData = JSON.parse(task.additional_context);
          if (ctxData.lead_id) {
            additionalLeadContext = `\n- TIPO: Messaggio OUTREACH a lead (NON cliente esistente)`;
            if (ctxData.business_name) additionalLeadContext += `\n- Azienda lead: ${ctxData.business_name}`;
            if (ctxData.sector) additionalLeadContext += `\n- Settore: ${ctxData.sector}`;
            if (ctxData.ai_summary) additionalLeadContext += `\n- Profilo AI: ${ctxData.ai_summary}`;
          }
        } catch {}
      }

      const variablePrompt = `Devi generare i valori per le variabili di un template WhatsApp.

Template: "${templateBodyText}"
Numero variabili: ${templateVariableCount}

Contesto:
- Nome: ${resolvedName || 'Cliente'}
- Istruzione: ${task.ai_instruction}
${task.additional_context ? `- Contesto aggiuntivo: ${task.additional_context}` : ''}${additionalLeadContext}
${agentContextSection || ''}
${reportData.title ? `- Report preparato: "${reportData.title}"` : ''}
${reportData.summary ? `- Riepilogo report: ${reportData.summary.substring(0, 200)}` : ''}

REGOLE:
- La variabile {{1}} è SEMPRE il nome del destinatario: "${resolvedName || 'Cliente'}"
- Le altre variabili ({{2}}, {{3}}, ecc.) sono messaggi brevi e personalizzati basati sul contesto
- ${reportData.title ? 'È stato preparato un documento/report che verrà inviato via EMAIL (non su WhatsApp). Menziona brevemente cosa è stato preparato e che lo troverà nella sua casella email.' : 'Non menzionare report o email.'}
- Ogni variabile deve essere BREVE (massimo 1-2 frasi)
- NON usare newline (\\n) nei valori
- Sii professionale e cordiale
- Spiega brevemente il MOTIVO del messaggio e cosa è stato fatto (basandoti sull'istruzione del task)
${additionalLeadContext ? '- Per un lead outreach: sii diretto, cordiale e spiega il valore che puoi offrire' : ''}

Rispondi SOLO con un JSON valido nel formato:
${templateVariableCount === 1 ? '{"1": "valore"}' : templateVariableCount === 2 ? '{"1": "valore", "2": "valore"}' : `{${Array.from({length: templateVariableCount}, (_, i) => `"${i+1}": "valore"`).join(', ')}}`}`;

      const resp = await withRetry(() => client.generateContent({
        model: effectiveWaModel,
        contents: [{ role: "user", parts: [{ text: variablePrompt }] }],
        generationConfig: { temperature: roleTemperature ?? 0.4, maxOutputTokens: 512, thinkingConfig: { thinkingBudget: getThinkingBudgetForLevel(autonomyThinkingLevel || 'low') } },
      }));

      const responseText = resp.response.text() || '';
      console.log(`📋 ${LOG_PREFIX} [TEMPLATE VARS] Risposta Gemini raw (${responseText.length} chars): "${responseText.substring(0, 300)}"`);
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        console.log(`📋 ${LOG_PREFIX} [TEMPLATE VARS] JSON estratto: ${jsonMatch[0]}`);
        const parsed = JSON.parse(jsonMatch[0]);
        contentVariables = {};
        contentVariables['1'] = resolvedName || 'Cliente';
        for (let i = 2; i <= templateVariableCount; i++) {
          const val = parsed[String(i)] || parsed[i];
          if (val) {
            contentVariables[String(i)] = String(val).replace(/[\n\r\t]/g, ' ').trim();
          } else {
            console.warn(`⚠️ ${LOG_PREFIX} [TEMPLATE VARS] Variabile ${i} mancante nel JSON di Gemini, uso fallback`);
            contentVariables[String(i)] = task.ai_instruction?.substring(0, 100) || 'la contatto per aggiornarla';
          }
        }
        console.log(`✅ ${LOG_PREFIX} [TEMPLATE VARS] Variabili finali: ${JSON.stringify(contentVariables)}`);
      } else {
        console.error(`❌ ${LOG_PREFIX} [TEMPLATE VARS] Nessun JSON trovato nella risposta Gemini! Risposta: "${responseText.substring(0, 200)}"`);
        contentVariables = { '1': resolvedName || 'Cliente' };
        if (templateVariableCount >= 2) {
          contentVariables['2'] = task.ai_instruction?.substring(0, 100) || 'la contatto per aggiornarla';
        }
        console.log(`⚠️ ${LOG_PREFIX} [TEMPLATE VARS] Fallback variabili (no JSON): ${JSON.stringify(contentVariables)}`);
      }
    } catch (varErr: any) {
      console.error(`❌ ${LOG_PREFIX} [TEMPLATE VARS] ECCEZIONE: ${varErr.message}`);
      console.error(`   Stack: ${varErr.stack?.substring(0, 300)}`);
      contentVariables = { '1': resolvedName || 'Cliente' };
      if (templateVariableCount >= 2) {
        contentVariables['2'] = task.ai_instruction?.substring(0, 100) || 'la contatto per aggiornarla';
      }
      console.log(`⚠️ ${LOG_PREFIX} [TEMPLATE VARS] Fallback variabili (eccezione): ${JSON.stringify(contentVariables)}`);
    }
  }
  
  if (selectedTemplateId && !contentVariables) {
    console.error(`❌ ${LOG_PREFIX} [TEMPLATE VARS] ANOMALIA: template selezionato ma contentVariables è undefined! templateVariableCount=${templateVariableCount}`);
    if (templateVariableCount > 0) {
      contentVariables = { '1': resolvedName || 'Cliente' };
      if (templateVariableCount >= 2) {
        contentVariables['2'] = task.ai_instruction?.substring(0, 100) || 'la contatto per aggiornarla';
      }
      console.log(`🔧 ${LOG_PREFIX} [TEMPLATE VARS] Forzatura fallback: ${JSON.stringify(contentVariables)}`);
    }
  }

  let waAgentInstructions = '';
  if (task.whatsapp_config_id) {
    try {
      const waAgentResult = await db.execute(sql`
        SELECT agent_name, agent_instructions, agent_instructions_enabled, ai_personality
        FROM consultant_whatsapp_config
        WHERE id::text = ${task.whatsapp_config_id}::text AND is_active = true LIMIT 1
      `);
      const waAgent = waAgentResult.rows[0] as any;
      if (waAgent?.agent_instructions_enabled && waAgent?.agent_instructions) {
        waAgentInstructions = `\n\n[ISTRUZIONI DIPENDENTE WA "${waAgent.agent_name || 'Agente WA'}"]:
${waAgent.agent_instructions}
Personalità: ${waAgent.ai_personality || 'professionale'}`;
        console.log(`${LOG_PREFIX} [HUNTER→WA] Loaded WA agent instructions from "${waAgent.agent_name}" (${waAgent.agent_instructions.length} chars)`);
      }
    } catch (agentErr: any) {
      console.warn(`${LOG_PREFIX} Failed to load WA agent instructions: ${agentErr.message}`);
    }
  }

  if (!messageText) {
    try {
      const { client, model: resolvedModel, providerName } = await resolveProviderForTask(task.consultant_id, task.ai_role);
      const effectiveWaMsgModel = autonomyModel || resolvedModel;
      console.log(`${LOG_PREFIX} send_whatsapp body generation using ${providerName} (${effectiveWaMsgModel})`);
      const whatsappPrompt = `Scrivi un messaggio WhatsApp informativo e professionale per ${resolvedName || 'il cliente'}.
${agentContextSection || ''}${waAgentInstructions}

ISTRUZIONE DEL TASK (cosa ti è stato chiesto di fare):
${task.ai_instruction}
${task.additional_context ? `\nCONTESTO AGGIUNTIVO:\n${task.additional_context}` : ''}${buildFollowUpSection(previousResults)}

${reportData.title ? `DOCUMENTO PREPARATO: "${reportData.title}"
${reportData.summary ? `Riepilogo: ${reportData.summary.substring(0, 300)}` : ''}
Il documento è stato inviato via EMAIL (NON su WhatsApp).` : ''}

REGOLE PER IL MESSAGGIO:
- Spiega COSA hai fatto e PERCHÉ (basandoti sull'istruzione del task)
- Se c'è un documento, menziona brevemente il contenuto e che lo troverà via email
- Massimo 4-5 frasi, non di più
- Sii diretto, cordiale e professionale
- NON menzionare allegati WhatsApp o PDF in chat
- NON usare asterischi per il grassetto`;

      const resp = await withRetry(() => client.generateContent({
        model: effectiveWaMsgModel,
        contents: [{ role: "user", parts: [{ text: whatsappPrompt }] }],
        generationConfig: { temperature: roleTemperature ?? 0.5, maxOutputTokens: 512, thinkingConfig: { thinkingBudget: getThinkingBudgetForLevel(autonomyThinkingLevel || 'low') } },
      }));
      messageText = resp.response.text() || `Buongiorno ${task.contact_name || ''}, la contatto per aggiornarla.`;
    } catch (provErr: any) {
      console.warn(`${LOG_PREFIX} Could not resolve provider for whatsapp body: ${provErr.message}`);
    }
  }

  try {
    const { sendWhatsAppMessage } = await import('../whatsapp/twilio-client');
    const agentOpts = task.whatsapp_config_id ? { agentConfigId: task.whatsapp_config_id } : {};

    console.log(`\n📱 ═══════════════════════════════════════════════════════════`);
    console.log(`📱 ${LOG_PREFIX} [WHATSAPP SEND] Inizio invio WhatsApp`);
    console.log(`📱 ═══════════════════════════════════════════════════════════`);
    console.log(`📱 ${LOG_PREFIX} Destinatario: ${resolvedPhone} (${resolvedName || 'N/A'})`);
    console.log(`📱 ${LOG_PREFIX} Template configurato: ${selectedTemplateId || 'NESSUNO (testo libero)'}`);
    console.log(`📱 ${LOG_PREFIX} Variabili template: ${contentVariables ? JSON.stringify(contentVariables) : 'N/A'}`);
    console.log(`📱 ${LOG_PREFIX} Testo messaggio (${messageText.length} chars): "${messageText.substring(0, 150)}..."`);
    console.log(`📱 ${LOG_PREFIX} Report disponibile: ${reportData?.title ? `SÌ - "${reportData.title}"` : 'NO'}`);
    console.log(`📱 ${LOG_PREFIX} Formal document: ${reportData?.formal_document?.body ? 'SÌ' : 'NO'}`);
    console.log(`📱 ${LOG_PREFIX} Agent config ID: ${task.whatsapp_config_id || 'auto-detect'}`);

    let messageSid: string;

    const hasReport = !!(reportData && reportData.title);
    console.log(`\n📤 ${LOG_PREFIX} [TWILIO CALL] Preparazione chiamata Twilio API...`);
    console.log(`📤 ${LOG_PREFIX} [TWILIO CALL] Modalità: ${selectedTemplateId ? 'TEMPLATE' : 'TESTO LIBERO'}`);
    console.log(`📤 ${LOG_PREFIX} [TWILIO CALL] Report presente: ${hasReport ? `SÌ - "${reportData.title}" (PDF inviato via email)` : 'NO'}`);
    console.log(`📤 ${LOG_PREFIX} [TWILIO CALL] Variabili: ${contentVariables ? JSON.stringify(contentVariables) : 'N/A'}`);

    if (selectedTemplateId) {
      const sendOpts = {
        ...agentOpts,
        contentSid: selectedTemplateId,
        ...(contentVariables ? { contentVariables } : {}),
      };
      console.log(`📤 ${LOG_PREFIX} [TWILIO CALL] Payload template: ${JSON.stringify({ contentSid: sendOpts.contentSid, variabili: sendOpts.contentVariables || 'N/A', agentConfigId: sendOpts.agentConfigId || 'auto' })}`);

      messageSid = await sendWhatsAppMessage(
        task.consultant_id,
        resolvedPhone,
        messageText,
        undefined,
        sendOpts,
      );
      console.log(`✅ ${LOG_PREFIX} [TWILIO CALL] Template WhatsApp inviato: ${messageSid}`);
    } else {
      console.log(`📤 ${LOG_PREFIX} [TWILIO CALL] Invio messaggio testo libero (${messageText.length} chars)`);

      messageSid = await sendWhatsAppMessage(
        task.consultant_id,
        resolvedPhone,
        messageText,
        undefined,
        agentOpts,
      );
      console.log(`✅ ${LOG_PREFIX} [TWILIO CALL] Messaggio testo libero inviato: ${messageSid}`);
    }

    console.log(`📱 ═══════════════════════════════════════════════════════════`);
    console.log(`📱 ${LOG_PREFIX} [WHATSAPP SEND] COMPLETATO`);
    console.log(`📱   SID: ${messageSid}`);
    console.log(`📱   Destinatario: ${resolvedPhone} (${resolvedName || 'N/A'})`);
    console.log(`📱   Template: ${selectedTemplateId || 'nessuno'}`);
    console.log(`📱   Variabili: ${contentVariables ? JSON.stringify(contentVariables) : 'nessuna'}`);
    console.log(`📱   Report: ${hasReport ? 'SÌ (inviato via email)' : 'NO'}`);
    console.log(`📱 ═══════════════════════════════════════════════════════════\n`);

    await logActivity(task.consultant_id, {
      event_type: "whatsapp_sent",
      title: `Messaggio WhatsApp inviato a ${resolvedName || resolvedPhone}!`,
      description: `"${messageText.substring(0, 100)}..."${selectedTemplateId ? ' (con template)' : ''}${hasReport ? ' — il documento lo troverà via email' : ''}`,
      icon: "💬",
      severity: "info",
      task_id: task.id,
      contact_name: resolvedName,
      contact_id: task.contact_id,
    });

    return {
      status: "sent",
      message_sid: messageSid,
      target_phone: resolvedPhone,
      message_preview: messageText.substring(0, 100),
      template_used: selectedTemplateId || 'plain_text',
      variables_filled: contentVariables ? Object.keys(contentVariables).length : 0,
      report_sent_via_email: hasReport,
    };
  } catch (error: any) {
    console.error(`\n❌ ═══════════════════════════════════════════════════════════`);
    console.error(`❌ ${LOG_PREFIX} [WHATSAPP SEND] FALLITO`);
    console.error(`❌ ═══════════════════════════════════════════════════════════`);
    console.error(`❌ ${LOG_PREFIX} Errore: ${error.message}`);
    console.error(`❌ ${LOG_PREFIX} Codice Twilio: ${error.code || 'N/A'}`);
    console.error(`❌ ${LOG_PREFIX} Status: ${error.status || 'N/A'}`);
    console.error(`❌ ${LOG_PREFIX} Destinatario: ${resolvedPhone} (${resolvedName || 'N/A'})`);
    console.error(`❌ ${LOG_PREFIX} Template: ${selectedTemplateId || 'nessuno'}`);
    console.error(`❌ ${LOG_PREFIX} Stack: ${error.stack?.substring(0, 400)}`);
    console.error(`❌ ═══════════════════════════════════════════════════════════\n`);

    await logActivity(task.consultant_id, {
      event_type: "whatsapp_failed",
      title: `Non riesco a raggiungere ${task.contact_name || task.contact_phone} su WhatsApp...`,
      description: `Ho provato a inviare ma c'è stato un problema: ${error.message}${error.code ? ` (codice: ${error.code})` : ''}`,
      icon: "❌",
      severity: "error",
      task_id: task.id,
      contact_name: task.contact_name,
      contact_id: task.contact_id,
    });

    return {
      status: "failed",
      error: error.message,
      error_code: error.code || undefined,
      target_phone: task.contact_phone,
    };
  }
}

async function handleWebSearch(
  task: AITaskInfo,
  step: ExecutionStep,
  previousResults: Record<string, any>,
  autonomyModel?: string,
  autonomyThinkingLevel?: string,
  roleTemperature?: number,
): Promise<Record<string, any>> {
  await logActivity(task.consultant_id, {
    event_type: 'step_web_search_started',
    title: `Faccio una ricerca online... vediamo cosa trovo`,
    description: `Cerco informazioni aggiornate${task.contact_name ? ` su ${task.contact_name}` : ''} sul web`,
    icon: '🌐',
    severity: 'info',
    task_id: task.id,
    contact_name: task.contact_name,
    contact_id: task.contact_id,
  });

  let searchQuery = step.params?.search_topic || step.params?.search_query || "";
  const analysisData = previousResults.analyze_patterns || {};
  const clientData = previousResults.fetch_client_data || {};
  const contactName = task.contact_name || clientData.contact?.first_name || "N/A";

  if (!searchQuery || searchQuery.length < 10) {
    searchQuery = task.ai_instruction || "ricerca generica";
  }

  if (searchQuery.length > 100) {
    console.log(`${LOG_PREFIX} Search query too long (${searchQuery.length} chars), generating focused queries with Gemini`);
    try {
      const { client: queryGenClient, model: queryModel, providerName: queryProvider } = await resolveProviderForTask(task.consultant_id, task.ai_role);
      const effectiveQueryModel = autonomyModel || queryModel;
      console.log(`${LOG_PREFIX} web_search query generation using ${queryProvider} (${effectiveQueryModel})`);
      const keyTopics = analysisData.key_topics || [];
      const queryGenPrompt = `Based on the following task context, generate 2-3 concise, focused web search queries (each max 10 words) that would find the most relevant information. Return ONLY the queries, one per line.

Task instruction: ${task.ai_instruction.substring(0, 300)}
Client name: ${contactName}
Task category: ${task.task_category}
${keyTopics.length > 0 ? `Key topics: ${keyTopics.join(', ')}` : ''}
${step.description ? `Step description: ${step.description}` : ''}`;

      const queryGenResponse = await withRetry(async () => {
        return await queryGenClient.generateContent({
          model: effectiveQueryModel,
          contents: [{ role: "user", parts: [{ text: queryGenPrompt }] }],
          generationConfig: { temperature: roleTemperature ?? 0.3, maxOutputTokens: 256, thinkingConfig: { thinkingBudget: getThinkingBudgetForLevel(autonomyThinkingLevel || 'low') } },
        });
      });

      const generatedQueries = (queryGenResponse.response.text() || "").trim().split('\n').filter((q: string) => q.trim().length > 0);
      if (generatedQueries.length > 0) {
        searchQuery = generatedQueries[0].trim().replace(/^\d+[\.\)]\s*/, '');
        console.log(`${LOG_PREFIX} Generated focused search query: "${searchQuery}" (from ${generatedQueries.length} candidates)`);
      }
    } catch (queryGenErr: any) {
      console.warn(`${LOG_PREFIX} Failed to generate focused query, using truncated original: ${queryGenErr.message}`);
      searchQuery = searchQuery.substring(0, 100);
    }
  }

  console.log(`${LOG_PREFIX} Esecuzione ricerca web: "${searchQuery}"`);

  const prompt = `Sei un ricercatore AI. Cerca informazioni pertinenti al contesto del cliente e della sua attività.

RICERCA RICHIESTA:
${searchQuery}

CONTESTO CLIENTE:
Nome: ${contactName}
Categoria task: ${task.task_category}

${analysisData.key_topics ? `ARGOMENTI CORRELATI: ${JSON.stringify(analysisData.key_topics)}` : ""}

ISTRUZIONE ORIGINALE:
${task.ai_instruction}

Cerca informazioni aggiornate e pertinenti su internet riguardo alla ricerca richiesta.
Concentrati su:
1. Informazioni rilevanti per il settore e l'attività del cliente
2. Andamenti di mercato e trend del settore
3. Notizie recenti pertinenti
4. Dati statistici e benchmark utili
5. Best practice e strategie raccomandate dagli esperti

IMPORTANTE: Riporta SOLO informazioni che trovi realmente dalla ricerca. NON inventare dati, statistiche, o fonti. Se non trovi informazioni pertinenti, dillo chiaramente.

Fornisci una risposta strutturata e dettagliata con le informazioni trovate, citando le fonti quando possibile.`;

  const { client, model: resolvedModel, providerName } = await resolveProviderForTask(task.consultant_id, task.ai_role);
  const effectiveSearchModel = autonomyModel || resolvedModel;
  console.log(`${LOG_PREFIX} web_search using ${providerName} (${effectiveSearchModel})`);

  const response = await withRetry(async () => {
    return await client.generateContent({
      model: effectiveSearchModel,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { temperature: roleTemperature ?? 0.3, maxOutputTokens: 8192, thinkingConfig: { thinkingBudget: getThinkingBudgetForLevel(autonomyThinkingLevel || 'low') } },
      tools: [{ googleSearch: {} }],
    });
  });

  const text = response.response.text() || "";
  console.log(`${LOG_PREFIX} Risposta ricerca web, lunghezza: ${text.length}`);

  const groundingMetadata = (response as any).response?.candidates?.[0]?.groundingMetadata;
  const groundingChunks = groundingMetadata?.groundingChunks || [];
  const searchQueries = groundingMetadata?.webSearchQueries || [];

  const sources = groundingChunks
    .filter((chunk: any) => chunk.web)
    .map((chunk: any) => ({
      url: chunk.web.uri,
      title: chunk.web.title || "Fonte web",
    }));

  console.log(`${LOG_PREFIX} Ricerca web completata: ${sources.length} fonti trovate, ${searchQueries.length} query eseguite`);

  return {
    search_query: searchQuery,
    findings: text,
    sources,
    search_queries_used: searchQueries,
    grounding_metadata: groundingMetadata ? {
      queries: searchQueries,
      sources_count: sources.length,
    } : null,
  };
}

async function getLeadScraperKeys(): Promise<{ serpApiKey: string | null; firecrawlKey: string | null }> {
  try {
    const [config] = await db.select().from(superadminLeadScraperConfig).limit(1);
    if (config && config.enabled) {
      return {
        serpApiKey: config.serpapiKeyEncrypted ? decrypt(config.serpapiKeyEncrypted) : null,
        firecrawlKey: config.firecrawlKeyEncrypted ? decrypt(config.firecrawlKeyEncrypted) : null,
      };
    }
  } catch (e) {
    console.error(`${LOG_PREFIX} Error reading lead scraper keys from DB, falling back to env:`, e);
  }
  return {
    serpApiKey: process.env.SERPAPI_KEY || null,
    firecrawlKey: process.env.FIRECRAWL_API_KEY || null,
  };
}

async function handleBatchOutreach(
  task: AITaskInfo,
  step: ExecutionStep,
  previousResults: Record<string, any>,
  agentContextSection?: string,
  autonomyModel?: string,
  autonomyThinkingLevel?: string,
): Promise<Record<string, any>> {
  let resultData: any = {};
  if (task.additional_context) {
    try { const ac = JSON.parse(task.additional_context); if (ac.batch_outreach) resultData = {}; } catch {}
  }
  const taskResult = await db.execute(sql`
    SELECT result_data FROM ai_scheduled_tasks WHERE id = ${task.id} LIMIT 1
  `);
  const rdRaw = (taskResult.rows[0] as any)?.result_data;
  if (rdRaw) {
    resultData = typeof rdRaw === 'string' ? JSON.parse(rdRaw) : rdRaw;
  }

  if (!resultData.batchOutreach || !resultData.leads) {
    throw new Error('batch_outreach: task non contiene dati batch (result_data.batchOutreach mancante)');
  }

  const channel: string = resultData.channel || step.params?.channel || 'email';
  const leads: any[] = resultData.leads;
  const searchQuery = resultData.searchQuery || 'Ricerca';
  const pendingLeads = leads.filter((l: any) => l.status === 'pending');

  console.log(`${LOG_PREFIX} [BATCH-OUTREACH] Starting batch ${channel} outreach: ${pendingLeads.length}/${leads.length} pending leads`);

  await logActivity(task.consultant_id, {
    event_type: 'batch_outreach_started',
    title: `📋 Inizio la campagna... ${pendingLeads.length} lead da contattare via ${channel}`,
    description: `Ho ${pendingLeads.length} lead da raggiungere per "${searchQuery}", parto subito!`,
    icon: '📋',
    severity: 'info',
    task_id: task.id,
  });

  let contacted = 0;
  let failed = 0;
  let skipped = 0;

  for (let i = 0; i < leads.length; i++) {
    const lead = leads[i];
    if (lead.status !== 'pending') {
      if (lead.status === 'done') contacted++;
      else if (lead.status === 'failed') failed++;
      else if (lead.status === 'skipped') skipped++;
      continue;
    }

    const leadName = lead.businessName || 'Lead sconosciuto';
    const leadIndex = leads.filter((l: any, idx: number) => idx <= i && (l.status === 'pending' || l.status === 'done' || l.status === 'failed')).length;
    const totalPending = pendingLeads.length;

    await logActivity(task.consultant_id, {
      event_type: 'batch_outreach_lead_start',
      title: `🔄 Passo a ${leadName}... (${leadIndex}/${totalPending})`,
      description: `Score: ${lead.score || 'N/A'}/100 — ${channel === 'voice' ? 'Lo chiamo adesso...' : channel === 'whatsapp' ? 'Gli scrivo su WhatsApp...' : 'Gli mando un\'email...'}`,
      icon: '🔄',
      severity: 'info',
      task_id: task.id,
      contact_name: leadName,
    });

    try {
      let stepResult: Record<string, any>;

      const leadTask: AITaskInfo = {
        ...task,
        contact_phone: lead.phone || task.contact_phone,
        contact_name: leadName,
        ai_instruction: `Contatto outreach per ${leadName}. Score: ${lead.score || 'N/A'}/100.\n${lead.category ? `Categoria: ${lead.category}` : ''}${lead.website ? `\nSito: ${lead.website}` : ''}${lead.address ? `\nIndirizzo: ${lead.address}` : ''}${lead.salesSummary ? `\nAnalisi: ${lead.salesSummary}` : ''}`,
        additional_context: JSON.stringify({
          lead_id: lead.leadId,
          search_id: resultData.searchId,
          voice_template_id: resultData.voiceTemplateId || null,
          email_account_id: resultData.emailAccountId || null,
          business_name: leadName,
          sector: lead.category || null,
          ai_summary: lead.salesSummary || null,
          batch_outreach: true,
        }),
        task_category: 'prospecting',
      };

      if (channel === 'voice') {
        stepResult = await handleVoiceCall(leadTask, step, previousResults);
      } else if (channel === 'whatsapp') {
        leadTask.whatsapp_config_id = resultData.whatsappConfigId || task.whatsapp_config_id;
        stepResult = await handleSendWhatsapp(leadTask, step, previousResults, agentContextSection);
      } else {
        stepResult = await handleSendEmail(leadTask, step, previousResults, agentContextSection);
      }

      const success = stepResult.status === 'sent' || stepResult.status === 'scheduled' || !!stepResult.call_id || stepResult.success !== false;

      leads[i].status = success ? 'done' : 'failed';
      leads[i].resultNote = success
        ? (stepResult.status || 'completato')
        : (stepResult.error || stepResult.reason || 'Errore sconosciuto');

      if (success) {
        contacted++;
        await logActivity(task.consultant_id, {
          event_type: 'batch_outreach_lead_done',
          title: `✅ Fatto! ${leadName} contattato`,
          description: `Score: ${lead.score || 'N/A'}/100. Siamo a ${contacted}/${totalPending} completati`,
          icon: '✅',
          severity: 'info',
          task_id: task.id,
          contact_name: leadName,
        });
      } else {
        failed++;
        await logActivity(task.consultant_id, {
          event_type: 'batch_outreach_lead_failed',
          title: `❌ ${leadName} non raggiunto, ${leads[i].resultNote}`,
          description: `Score: ${lead.score || 'N/A'}/100. Non sono riuscito a contattarlo: ${leads[i].resultNote}`,
          icon: '❌',
          severity: 'warning',
          task_id: task.id,
          contact_name: leadName,
        });
      }

      try {
        await updateLeadStatusAfterOutreach(leadTask, channel === 'voice' ? 'voice_call' : channel === 'whatsapp' ? 'send_whatsapp' : 'send_email', stepResult);
      } catch (feedbackErr: any) {
        console.warn(`${LOG_PREFIX} [BATCH-OUTREACH] Failed to update lead status for "${leadName}": ${feedbackErr.message}`);
      }

      if (channel === 'voice') {
        try {
          await analyzeCallTranscriptAndAct(leadTask, stepResult);
        } catch (transcriptErr: any) {
          console.warn(`${LOG_PREFIX} [BATCH-OUTREACH] Failed to analyze transcript for "${leadName}": ${transcriptErr.message}`);
        }
      }

    } catch (leadErr: any) {
      console.error(`${LOG_PREFIX} [BATCH-OUTREACH] Error processing lead "${leadName}": ${leadErr.message}`);
      leads[i].status = 'failed';
      leads[i].resultNote = leadErr.message;
      failed++;

      await logActivity(task.consultant_id, {
        event_type: 'batch_outreach_lead_error',
        title: `❌ ${leadName} non raggiunto, ${leadErr.message.substring(0, 100)}`,
        description: `C'è stato un problema con ${leadName}, passo al prossimo lead.`,
        icon: '❌',
        severity: 'warning',
        task_id: task.id,
        contact_name: leadName,
      });
    }

    resultData.leads = leads;
    await db.execute(sql`
      UPDATE ai_scheduled_tasks
      SET result_data = ${JSON.stringify(resultData)}::jsonb, updated_at = NOW()
      WHERE id = ${task.id}
    `);

    if (i < leads.length - 1 && leads[i + 1]?.status === 'pending') {
      const paceDelay = channel === 'voice' ? 10000 : 3000;
      console.log(`${LOG_PREFIX} [BATCH-OUTREACH] Pacing delay: ${paceDelay}ms before next lead`);
      await new Promise(r => setTimeout(r, paceDelay));
    }
  }

  const permanentFailures = ['invalido', 'non disponibile', 'invalid', 'no phone', 'no email', 'not_found', 'blocked', 'opt_out'];
  const followUpLeads = leads.filter((l: any) => {
    if (l.status !== 'failed') return false;
    const note = (l.resultNote || '').toLowerCase();
    return !permanentFailures.some(pf => note.includes(pf));
  });

  await logActivity(task.consultant_id, {
    event_type: 'batch_outreach_completed',
    title: `🎯 Campagna finita! ${contacted}/${leads.length} contattati`,
    description: `Ho finito la campagna: ${contacted} contattati con successo, ${failed} non raggiunti, ${skipped} saltati${followUpLeads.length > 0 ? `. Riproverò ${followUpLeads.length} lead più avanti.` : ''}`,
    icon: '🎯',
    severity: contacted > 0 ? 'info' : 'warning',
    task_id: task.id,
  });

  if (followUpLeads.length > 0) {
    try {
      const followUpTaskId = `task_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      const followUpResultData = {
        batchOutreach: true,
        searchId: resultData.searchId,
        searchQuery: resultData.searchQuery,
        channel: channel,
        voiceTemplateId: resultData.voiceTemplateId || null,
        whatsappConfigId: resultData.whatsappConfigId || null,
        isFollowUp: true,
        originalTaskId: task.id,
        leads: followUpLeads.map((l: any) => ({ ...l, status: 'pending', resultNote: null })),
      };

      const outreachConfig = await db.execute(sql`
        SELECT outreach_config FROM ai_autonomy_settings
        WHERE consultant_id::text = ${task.consultant_id}::text LIMIT 1
      `);
      const followUpDays = ((outreachConfig.rows[0] as any)?.outreach_config as any)?.followUpDays ?? 3;

      await db.execute(sql`
        INSERT INTO ai_scheduled_tasks (
          id, consultant_id, contact_phone, contact_name, task_type, ai_instruction,
          scheduled_at, timezone, status, priority, parent_task_id,
          task_category, ai_role, preferred_channel,
          result_data,
          additional_context,
          max_attempts, current_attempt, retry_delay_minutes,
          created_at, updated_at
        ) VALUES (
          ${followUpTaskId}, ${task.consultant_id}, ${followUpLeads[0]?.phone || ''},
          ${`Follow-up: ${searchQuery}`}, 'ai_task', ${`Follow-up campagna: ${followUpLeads.length} lead da ricontattare via ${channel}`},
          NOW() + ${sql.raw(`INTERVAL '${followUpDays} days'`)},
          ${task.timezone || 'Europe/Rome'}, 'waiting_approval', 2, ${task.id},
          'outreach', ${task.ai_role || 'alessia'}, ${channel},
          ${JSON.stringify(followUpResultData)}::jsonb,
          ${JSON.stringify({ batch_outreach: true, is_follow_up: true })},
          1, 0, 5,
          NOW(), NOW()
        )
      `);

      await logActivity(task.consultant_id, {
        event_type: 'batch_outreach_followup_created',
        title: `🔁 Programmo follow-up tra ${followUpDays} giorni per ${followUpLeads.length} lead`,
        description: `Ho programmato un follow-up per ricontattare i lead che non sono riuscito a raggiungere via ${channel}`,
        icon: '🔁',
        severity: 'info',
        task_id: task.id,
      });

      console.log(`${LOG_PREFIX} [BATCH-OUTREACH] Created follow-up task ${followUpTaskId} for ${followUpLeads.length} leads in ${followUpDays} days`);
    } catch (followUpErr: any) {
      console.error(`${LOG_PREFIX} [BATCH-OUTREACH] Failed to create follow-up task: ${followUpErr.message}`);
    }
  }

  return {
    status: 'completed',
    channel,
    search_query: searchQuery,
    total_leads: leads.length,
    contacted,
    failed,
    skipped,
    follow_up_created: followUpLeads.length > 0,
    follow_up_count: followUpLeads.length,
    leads: leads.map(l => ({ businessName: l.businessName, status: l.status, resultNote: l.resultNote })),
  };
}

async function reformulateQueryWithGemini(
  originalQuery: string,
  location: string,
  consultantId: string,
): Promise<string | null> {
  try {
    let salesContextHint = "";
    try {
      const scResult = await db.execute(sql`
        SELECT services_offered, target_audience FROM lead_scraper_sales_context
        WHERE consultant_id = ${consultantId} LIMIT 1
      `);
      const sc = scResult.rows[0] as any;
      if (sc) {
        if (sc.services_offered) salesContextHint += `Servizi venduti: ${sc.services_offered}. `;
        if (sc.target_audience) salesContextHint += `Target: ${sc.target_audience}. `;
      }
    } catch { }

    const result = await quickGenerate({
      consultantId,
      feature: 'lead-scraper-query-reformulation',
      contents: [{
        role: 'user',
        parts: [{
          text: `La query "${originalQuery}" cercata su Google${location ? ` nella zona "${location}"` : ''} non ha trovato NESSUN risultato.
${salesContextHint ? `Contesto: ${salesContextHint}` : ''}
Riscrivi la query usando termini COMMERCIALI ITALIANI che le aziende reali usano nei loro siti web e nelle schede Google Maps. Evita acronimi inglesi, definizioni accademiche, e termini tecnici che nessuna azienda usa per descriversi.

Esempi di riscrittura corretta:
- "Software as a Service SaaS" → "software gestionale cloud"
- "Business Process Outsourcing" → "servizi esternalizzazione aziendale"
- "Digital Marketing Agency" → "agenzia marketing digitale"
- "Managed Service Provider" → "assistenza informatica aziende"

Rispondi SOLO con la nuova query, massimo 5 parole, senza virgolette.`
        }]
      }],
      thinkingLevel: 'minimal',
    });

    const newQuery = result.text?.trim().replace(/^["']|["']$/g, '').trim();
    if (newQuery && newQuery.length > 2 && newQuery.length < 100 && newQuery.toLowerCase() !== originalQuery.toLowerCase()) {
      console.log(`${LOG_PREFIX} [LEAD-SCRAPER-SEARCH] Query reformulated: "${originalQuery}" → "${newQuery}"`);
      return newQuery;
    }
    return null;
  } catch (err: any) {
    console.warn(`${LOG_PREFIX} [LEAD-SCRAPER-SEARCH] Query reformulation failed: ${err.message}`);
    return null;
  }
}

async function handleLeadScraperSearch(
  task: AITaskInfo,
  step: ExecutionStep,
  _previousResults: Record<string, any>,
): Promise<Record<string, any>> {
  const params = step.params || {};
  const query = params.query || params.search_query;
  const location = params.location || '';
  const searchEngine = params.searchEngine || params.search_engine || 'google_maps';
  const limit = params.limit || 20;

  if (!query) {
    throw new Error('lead_scraper_search: parametro "query" mancante');
  }

  console.log(`${LOG_PREFIX} [LEAD-SCRAPER-SEARCH] query="${query}", location="${location}", engine=${searchEngine}, limit=${limit}`);

  await logActivity(task.consultant_id, {
    event_type: 'lead_scraper_search_started',
    title: `🔍 Cerco '${query}'... vediamo cosa esce`,
    description: `Uso ${searchEngine === 'google_maps' ? 'Google Maps' : 'Google Search'}${location ? ` in zona ${location}` : ''}, cerco fino a ${limit} risultati`,
    icon: '🔍',
    severity: 'info',
    task_id: task.id,
  });

  const keys = await getLeadScraperKeys();
  if (!keys.serpApiKey) {
    throw new Error('SERPAPI_KEY non configurata. Impossibile eseguire la ricerca lead.');
  }

  const [search] = await db
    .insert(leadScraperSearches)
    .values({
      consultantId: task.consultant_id,
      query,
      location: location || '',
      status: 'running',
      metadata: { params: { limit, searchEngine, source: 'hunter_task', taskId: task.id } },
      originRole: 'hunter',
    })
    .returning();

  const searchId = search.id;
  console.log(`${LOG_PREFIX} [LEAD-SCRAPER-SEARCH] Created search record ${searchId}`);

  let resultsCount = 0;

  try {
    const existingLeadsResult = await db.execute(sql`
      SELECT business_name, phone, website, email, google_place_id
      FROM lead_scraper_results
      WHERE search_id IN (SELECT id FROM lead_scraper_searches WHERE consultant_id = ${task.consultant_id})
    `);
    const existingNames = new Set<string>();
    const existingPhones = new Set<string>();
    const existingDomains = new Set<string>();
    const existingPlaceIds = new Set<string>();
    for (const row of existingLeadsResult.rows as any[]) {
      if (row.business_name) existingNames.add(row.business_name.toLowerCase().trim());
      if (row.phone) existingPhones.add(row.phone.replace(/[\s\-()\.]/g, ''));
      if (row.website) {
        const domain = row.website.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0].toLowerCase();
        if (domain) existingDomains.add(domain);
      }
      if (row.email) {
        const emailDomain = row.email.split('@')[1]?.toLowerCase();
        if (emailDomain) existingDomains.add(emailDomain);
      }
      if (row.google_place_id) existingPlaceIds.add(row.google_place_id);
    }

    console.log(`${LOG_PREFIX} [LEAD-SCRAPER-SEARCH] Dedup sets loaded: ${existingNames.size} names, ${existingPhones.size} phones, ${existingDomains.size} domains, ${existingPlaceIds.size} place_ids`);

    const isDuplicate = (name: string | null, phone: string | null, website: string | null, placeId?: string | null): string | null => {
      if (placeId && existingPlaceIds.has(placeId)) return `place_id "${placeId}"`;
      if (name && existingNames.has(name.toLowerCase().trim())) return `nome "${name}"`;
      if (phone) {
        const normalized = phone.replace(/[\s\-()\.]/g, '');
        if (existingPhones.has(normalized)) return `telefono "${phone}"`;
      }
      if (website) {
        const domain = website.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0].toLowerCase();
        if (domain && existingDomains.has(domain)) return `dominio "${domain}"`;
      }
      return null;
    };

    let duplicatesSkipped = 0;
    let retryQuery: string | null = null;

    const MAX_EXTRA_PAGES = 10;

    const executeSearch = async (activeQuery: string, isRetry: boolean = false) => {
      let searchDuplicates = 0;
      let searchNew = 0;

      const WEB_PAGE_SIZE = 10;
      const MAPS_PAGE_SIZE = 20;

      if (searchEngine === 'google_search') {
        const domainExclusions = Array.from(existingDomains).slice(0, 30);
        let effectiveQuery = activeQuery;
        if (domainExclusions.length > 0) {
          const exclusionStr = domainExclusions.map(d => `-site:${d}`).join(' ');
          effectiveQuery = `${activeQuery} ${exclusionStr}`;
          console.log(`${LOG_PREFIX} [LEAD-SCRAPER-SEARCH] Excluded ${domainExclusions.length} domains from Search query`);
        }

        let offset = 0;
        let pagesUsed = 0;
        let noMoreResults = false;
        while (searchNew < limit && pagesUsed <= MAX_EXTRA_PAGES && !noMoreResults) {
          const webResults = await searchGoogleWeb(effectiveQuery, location, WEB_PAGE_SIZE, keys.serpApiKey!, offset);
          if (webResults.length === 0) { noMoreResults = true; break; }

          for (const result of webResults) {
            if (searchNew >= limit) break;
            const dupReason = isDuplicate(result.title || null, null, result.website || null);
            if (dupReason) {
              console.log(`${LOG_PREFIX} [LEAD-SCRAPER-SEARCH] Duplicato skippato: ${dupReason}`);
              searchDuplicates++;
              continue;
            }
            await db.insert(leadScraperResults).values({
              searchId,
              businessName: result.title || null,
              address: null,
              phone: null,
              website: result.website || null,
              rating: null,
              reviewsCount: null,
              category: null,
              latitude: null,
              longitude: null,
              hours: null,
              websiteData: result.snippet ? { description: result.snippet, emails: [], phones: [], socialLinks: {}, services: [] } : null,
              scrapeStatus: result.website ? 'pending' : 'no_website',
              source: 'google_search',
            });
            searchNew++;
            if (result.title) existingNames.add(result.title.toLowerCase().trim());
            if (result.website) {
              const domain = result.website.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0].toLowerCase();
              if (domain) existingDomains.add(domain);
            }
          }

          if (webResults.length < WEB_PAGE_SIZE) noMoreResults = true;
          offset += WEB_PAGE_SIZE;
          pagesUsed++;
          console.log(`${LOG_PREFIX} [LEAD-SCRAPER-SEARCH] Page ${pagesUsed}: ${searchNew} new, ${searchDuplicates} dups, offset=${offset}`);
        }
      } else {
        console.log(`${LOG_PREFIX} [LEAD-SCRAPER-SEARCH] Maps dedup: ${existingPlaceIds.size} place_ids noti`);

        let offset = 0;
        let pagesUsed = 0;
        let noMoreResults = false;
        while (searchNew < limit && pagesUsed <= MAX_EXTRA_PAGES && !noMoreResults) {
          const mapsResults = await searchGoogleMaps(activeQuery, location, MAPS_PAGE_SIZE, keys.serpApiKey!, offset);
          if (mapsResults.length === 0) { noMoreResults = true; break; }

          for (const result of mapsResults) {
            if (searchNew >= limit) break;
            const dupReason = isDuplicate(result.title || null, result.phone || null, result.website || null, result.place_id || null);
            if (dupReason) {
              console.log(`${LOG_PREFIX} [LEAD-SCRAPER-SEARCH] Duplicato skippato: ${dupReason}`);
              searchDuplicates++;
              continue;
            }
            await db.insert(leadScraperResults).values({
              searchId,
              businessName: result.title || null,
              address: result.address || null,
              phone: result.phone || null,
              website: result.website || null,
              rating: result.rating || null,
              reviewsCount: result.reviews || null,
              category: result.type || null,
              latitude: result.gps_coordinates?.latitude || null,
              longitude: result.gps_coordinates?.longitude || null,
              hours: result.operating_hours || null,
              googlePlaceId: result.place_id || null,
              businessTypes: result.types || null,
              priceRange: result.price || null,
              openState: result.open_state || null,
              mapsDescription: result.description || null,
              scrapeStatus: result.website ? 'pending' : 'no_website',
              source: 'google_maps',
            });
            searchNew++;
            if (result.title) existingNames.add(result.title.toLowerCase().trim());
            if (result.phone) existingPhones.add(result.phone.replace(/[\s\-()\.]/g, ''));
            if (result.place_id) existingPlaceIds.add(result.place_id);
            if (result.website) {
              const domain = result.website.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0].toLowerCase();
              if (domain) existingDomains.add(domain);
            }
          }

          if (mapsResults.length < MAPS_PAGE_SIZE) noMoreResults = true;
          offset += MAPS_PAGE_SIZE;
          pagesUsed++;
          console.log(`${LOG_PREFIX} [LEAD-SCRAPER-SEARCH] Page ${pagesUsed}: ${searchNew} new, ${searchDuplicates} dups, offset=${offset}`);
        }
      }

      duplicatesSkipped += searchDuplicates;
      return searchNew;
    };

    resultsCount = await executeSearch(query);

    const noNewLeads = resultsCount === 0;
    const allDuplicatesNoNew = resultsCount === 0 && duplicatesSkipped > 0;

    if (noNewLeads && !retryQuery) {
      const reason = allDuplicatesNoNew
        ? `tutte le ${duplicatesSkipped} aziende trovate erano già nel sistema`
        : 'nessun risultato trovato';
      console.log(`${LOG_PREFIX} [LEAD-SCRAPER-SEARCH] 0 new results for "${query}" (${reason}) — attempting AI reformulation`);

      await logActivity(task.consultant_id, {
        event_type: 'lead_scraper_retry',
        title: allDuplicatesNoNew ? `🔄 Tutte aziende già note, provo una variante...` : `🔄 Nessun risultato, riprovo con una query diversa...`,
        description: allDuplicatesNoNew
          ? `"${query}" ha trovato solo aziende già nel sistema (${duplicatesSkipped}), provo con termini diversi`
          : `"${query}" non ha trovato niente, chiedo all'AI di riformulare con termini più efficaci`,
        icon: '🔄',
        severity: 'info',
        task_id: task.id,
      });

      retryQuery = await reformulateQueryWithGemini(query, location, task.consultant_id);

      if (retryQuery) {
        console.log(`${LOG_PREFIX} [LEAD-SCRAPER-SEARCH] Retrying with reformulated query: "${retryQuery}"`);

        await logActivity(task.consultant_id, {
          event_type: 'lead_scraper_retry_query',
          title: `🔄 Riprovo con: "${retryQuery}"`,
          description: `Query originale "${query}" → riformulata in "${retryQuery}"`,
          icon: '🔄',
          severity: 'info',
          task_id: task.id,
        });

        resultsCount = await executeSearch(retryQuery, true);

        if (resultsCount === 0) {
          await logActivity(task.consultant_id, {
            event_type: 'lead_scraper_no_results',
            title: `⚠️ Nessun risultato anche dopo il retry`,
            description: `Né "${query}" né "${retryQuery}" hanno trovato risultati${location ? ` in ${location}` : ''}. Suggerimento: prova con termini più specifici o una zona diversa`,
            icon: '⚠️',
            severity: 'warning',
            task_id: task.id,
          });
        }
      }
    }

    if (duplicatesSkipped > 0) {
      console.log(`${LOG_PREFIX} [LEAD-SCRAPER-SEARCH] ${resultsCount} nuovi lead inseriti, ${duplicatesSkipped} duplicati skippati`);
    }

    const allDuplicates = resultsCount === 0 && duplicatesSkipped > 0;
    if (allDuplicates && !retryQuery) {
      console.log(`${LOG_PREFIX} [LEAD-SCRAPER-SEARCH] ALL results were duplicates (${duplicatesSkipped} skipped, no retry helped)`);
    }

    await db
      .update(leadScraperSearches)
      .set({
        status: keys.firecrawlKey ? 'enriching' : 'completed',
        resultsCount,
      })
      .where(eq(leadScraperSearches.id, searchId));

    console.log(`${LOG_PREFIX} [LEAD-SCRAPER-SEARCH] Inserted ${resultsCount} results for search ${searchId}`);

    const resultDescription = allDuplicates
      ? `Tutte le ${duplicatesSkipped} aziende trovate erano già nel sistema — nessun nuovo lead aggiunto`
      : `Trovate ${resultsCount + duplicatesSkipped} aziende (${resultsCount} nuove, ${duplicatesSkipped} già nel sistema)${retryQuery ? ` [query riformulata: "${retryQuery}"]` : ''}`;

    await logActivity(task.consultant_id, {
      event_type: 'lead_scraper_results_found',
      title: allDuplicates ? `♻️ Tutte aziende già note` : `📋 Trovate ${resultsCount} nuove aziende!`,
      description: resultDescription,
      icon: allDuplicates ? '♻️' : '📋',
      severity: allDuplicates ? 'warning' : 'info',
      task_id: task.id,
    });

    let enrichmentStats = { enriched: 0, failed: 0, cached: 0 };
    if (keys.firecrawlKey && resultsCount > 0) {
      await logActivity(task.consultant_id, {
        event_type: 'lead_scraper_enrichment_started',
        title: `🌐 Adesso analizzo i loro siti...`,
        description: `Sto visitando ${resultsCount} siti web per raccogliere email, telefoni e info utili (batch mode)`,
        icon: '🌐',
        severity: 'info',
        task_id: task.id,
      });

      try {
        enrichmentStats = await enrichSearchResults(searchId, keys.firecrawlKey);
        console.log(`${LOG_PREFIX} [LEAD-SCRAPER-SEARCH] Enrichment complete: ${enrichmentStats.enriched} scraped, ${enrichmentStats.cached} cached, ${enrichmentStats.failed} failed`);
      } catch (enrichErr: any) {
        console.error(`${LOG_PREFIX} [LEAD-SCRAPER-SEARCH] Enrichment error: ${enrichErr.message}`);
      }

      await db
        .update(leadScraperSearches)
        .set({ status: 'completed' })
        .where(eq(leadScraperSearches.id, searchId));

      await logActivity(task.consultant_id, {
        event_type: 'lead_scraper_enrichment_completed',
        title: `✅ Siti analizzati, ho raccolto tutte le info`,
        description: `Ho analizzato ${enrichmentStats.enriched} siti web, ${enrichmentStats.cached} li avevo già in memoria, ${enrichmentStats.failed} non raggiungibili`,
        icon: '🌐',
        severity: 'info',
        task_id: task.id,
      });
    }

    await logActivity(task.consultant_id, {
      event_type: 'lead_scraper_search_completed',
      title: `🔍 Ricerca completata per '${retryQuery || query}'`,
      description: `Ho trovato ${resultsCount} nuove aziende${duplicatesSkipped > 0 ? ` (${duplicatesSkipped} già note)` : ''}${enrichmentStats.enriched > 0 ? `, analizzato ${enrichmentStats.enriched} siti web` : ''}${enrichmentStats.cached > 0 ? `, ${enrichmentStats.cached} già in memoria` : ''}${retryQuery ? ` [query riformulata da "${query}"]` : ''}. Tutto pronto!`,
      icon: '🔍',
      severity: 'info',
      task_id: task.id,
    });

    return {
      search_id: searchId,
      query: retryQuery || query,
      original_query: retryQuery ? query : undefined,
      retry_query: retryQuery || undefined,
      location,
      search_engine: searchEngine,
      results_count: resultsCount,
      duplicates_skipped: duplicatesSkipped,
      enrichment_stats: enrichmentStats,
      status: 'completed',
    };
  } catch (error: any) {
    await db
      .update(leadScraperSearches)
      .set({ status: 'failed' })
      .where(eq(leadScraperSearches.id, searchId));

    throw error;
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
  return allPhones[0];
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

  const personal = allEmails.find(e => !isGeneric(e));
  if (personal) return personal;
  return allEmails[0];
}

async function handleLeadQualifyAndAssign(
  task: AITaskInfo,
  step: ExecutionStep,
  previousResults: Record<string, any>,
): Promise<Record<string, any>> {
  const params = step.params || {};
  const searchId = params.search_id || params.searchId || previousResults.lead_scraper_search?.search_id;

  if (!searchId) {
    throw new Error('lead_qualify_and_assign: parametro "search_id" mancante e nessun risultato di ricerca precedente trovato');
  }

  console.log(`${LOG_PREFIX} [LEAD-QUALIFY] Starting qualification for search ${searchId}`);

  const settingsResult = await db.execute(sql`
    SELECT outreach_config FROM ai_autonomy_settings
    WHERE consultant_id::text = ${task.consultant_id}::text LIMIT 1
  `);
  const outreachConfig = (settingsResult.rows[0] as any)?.outreach_config || {};
  const scoreThreshold = outreachConfig.score_threshold ?? outreachConfig.minScoreThreshold ?? 60;
  const channelPriority: string[] = outreachConfig.channel_priority ?? outreachConfig.channelPriority ?? ['voice', 'whatsapp', 'email'];
  const whatsappConfigId = outreachConfig.whatsapp_config_id ?? outreachConfig.whatsappConfigId ?? null;
  const voiceTemplateId = outreachConfig.voice_template_id ?? outreachConfig.voiceTemplateId ?? null;
  const emailAccountId = outreachConfig.email_account_id ?? outreachConfig.emailAccountId ?? null;
  const hunterMode = outreachConfig.hunter_mode ?? (outreachConfig.require_approval !== false ? 'approval' : 'autonomous');
  const outreachTaskStatus = hunterMode === 'autonomous' ? 'scheduled' : 'waiting_approval';

  await logActivity(task.consultant_id, {
    event_type: 'lead_qualify_batch_started',
    title: `🧠 Analizzo le aziende trovate... soglia: ${scoreThreshold}`,
    description: `Guardo ogni azienda una per una per capire quali sono davvero in target (soglia: ${scoreThreshold}/100)`,
    icon: '🧠',
    severity: 'info',
    task_id: task.id,
  });

  let summariesGenerated = 0;
  let summariesFailed = 0;
  try {
    const batchResult = await generateBatchSalesSummaries(searchId, task.consultant_id, async (progress) => {
      if (progress.status === 'analyzing') {
        await logActivity(task.consultant_id, {
          event_type: 'lead_qualify_analyzing',
          title: `🔎 Sto guardando ${progress.businessName}... (${progress.index}/${progress.total})`,
          description: `Analizzo il profilo e calcolo quanto è in target...`,
          icon: '🔎',
          severity: 'info',
          task_id: task.id,
        });
      } else if (progress.status === 'done') {
        const scoreLabel = progress.score !== null ? `${progress.score}/100` : 'non estratto';
        const qualified = progress.score !== null && progress.score >= scoreThreshold;
        await logActivity(task.consultant_id, {
          event_type: 'lead_qualify_scored',
          title: `${qualified ? '✅' : '⬜'} ${progress.businessName}: score ${scoreLabel}${qualified ? ', ottimo match!' : ', non in target'}`,
          description: qualified
            ? `Score ${scoreLabel}, sopra la soglia di ${scoreThreshold} — lo aggiungo alla lista outreach!`
            : `Score ${scoreLabel}, sotto la soglia di ${scoreThreshold} — non è il profilo giusto`,
          icon: qualified ? '✅' : '⬜',
          severity: 'info',
          task_id: task.id,
        });
      }
    });
    summariesGenerated = batchResult.generated;
    summariesFailed = batchResult.failed;
    console.log(`${LOG_PREFIX} [LEAD-QUALIFY] AI summaries: ${summariesGenerated} generated, ${summariesFailed} failed`);
  } catch (summaryErr: any) {
    console.error(`${LOG_PREFIX} [LEAD-QUALIFY] Batch summary error: ${summaryErr.message}`);
  }

  const allLeads = await db
    .select()
    .from(leadScraperResults)
    .where(eq(leadScraperResults.searchId, searchId));

  const qualifiedLeads = allLeads.filter(lead => {
    if (!lead.aiCompatibilityScore || lead.aiCompatibilityScore < scoreThreshold) return false;
    if (lead.leadStatus && lead.leadStatus !== 'nuovo') return false;
    return true;
  });

  console.log(`${LOG_PREFIX} [LEAD-QUALIFY] ${allLeads.length} total leads, ${qualifiedLeads.length} qualified (score >= ${scoreThreshold})`);

  await logActivity(task.consultant_id, {
    event_type: 'lead_qualify_summary',
    title: `📊 Analisi fatta: ${qualifiedLeads.length}/${allLeads.length} sono buoni match!`,
    description: `Ho analizzato ${summariesGenerated} aziende${summariesFailed > 0 ? ` (${summariesFailed} non riuscite)` : ''}. ${qualifiedLeads.length} superano la soglia di ${scoreThreshold}/100`,
    icon: '📊',
    severity: qualifiedLeads.length > 0 ? 'info' : 'warning',
    task_id: task.id,
  });

  let whatsappConfigActive = false;
  if (whatsappConfigId) {
    try {
      const waConfigResult = await db.execute(sql`
        SELECT id, is_active FROM consultant_whatsapp_config
        WHERE id = ${whatsappConfigId} AND is_active = true LIMIT 1
      `);
      whatsappConfigActive = waConfigResult.rows.length > 0;
    } catch (e) {
      console.warn(`${LOG_PREFIX} [LEAD-QUALIFY] Failed to check WA config: ${(e as Error).message}`);
    }
  }

  const autonomySettings = await getAutonomySettings(task.consultant_id);
  const channelsEnabled = autonomySettings.channels_enabled || {};

  const remainingLimits = await getRemainingLimits(task.consultant_id);
  console.log(`${LOG_PREFIX} [LEAD-QUALIFY] Remaining daily limits — calls: ${remainingLimits.calls}, whatsapp: ${remainingLimits.whatsapp}, email: ${remainingLimits.email}`);

  let voiceLeadCount = 0;
  let whatsappLeadCount = 0;
  let emailLeadCount = 0;
  let skippedCooldown = 0;
  let skippedRateLimit = 0;

  const batchVoice: any[] = [];
  const batchWhatsapp: any[] = [];
  const batchEmail: any[] = [];

  for (let i = 0; i < qualifiedLeads.length; i++) {
    const lead = qualifiedLeads[i];
    const wd = (lead.websiteData as any) || {};
    const leadPhone = lead.phone || (wd.phones && wd.phones[0]) || null;
    const leadEmail = lead.email || (wd.emails && wd.emails[0]) || null;
    const leadName = lead.businessName || 'Lead sconosciuto';

    const cooldownOk = await checkLeadCooldown(lead.id, task.consultant_id);
    if (!cooldownOk) {
      console.log(`${LOG_PREFIX} [LEAD-QUALIFY] Skipping lead "${leadName}": cooldown active or already in pipeline`);
      skippedCooldown++;
      continue;
    }

    const phoneForVoice = selectBestPhone(lead, wd, false) || leadPhone;
    const phoneForWA = selectBestPhone(lead, wd, true) || leadPhone;
    const emailForOutreach = selectBestEmail(lead, wd) || leadEmail;

    let channelsAssigned = 0;

    const allLimitsReached = remainingLimits.calls <= voiceLeadCount && remainingLimits.whatsapp <= whatsappLeadCount && remainingLimits.email <= emailLeadCount;
    if (allLimitsReached) {
      console.log(`${LOG_PREFIX} [LEAD-QUALIFY] All daily rate limits reached, stopping assignment`);
      skippedRateLimit += (qualifiedLeads.length - i);
      break;
    }

    const leadEntry = {
      leadId: lead.id,
      businessName: leadName,
      phone: phoneForVoice || phoneForWA,
      email: emailForOutreach,
      score: lead.aiCompatibilityScore,
      category: lead.category || null,
      website: lead.website || null,
      address: lead.address || null,
      rating: lead.rating || null,
      reviewsCount: lead.reviewsCount || 0,
      salesSummary: lead.aiSalesSummary ? lead.aiSalesSummary.substring(0, 500) : null,
      status: 'pending' as const,
      resultNote: null as string | null,
    };

    if (phoneForVoice && channelsEnabled.voice && voiceTemplateId && remainingLimits.calls > voiceLeadCount) {
      batchVoice.push({ ...leadEntry, phone: phoneForVoice });
      voiceLeadCount++;
      channelsAssigned++;
    }
    if (phoneForWA && channelsEnabled.whatsapp && whatsappConfigActive && remainingLimits.whatsapp > whatsappLeadCount) {
      batchWhatsapp.push({ ...leadEntry, phone: phoneForWA });
      whatsappLeadCount++;
      channelsAssigned++;
    }
    if (emailForOutreach && channelsEnabled.email && remainingLimits.email > emailLeadCount) {
      batchEmail.push({ ...leadEntry, email: emailForOutreach });
      emailLeadCount++;
      channelsAssigned++;
    }

    if (channelsAssigned === 0) {
      console.log(`${LOG_PREFIX} [LEAD-QUALIFY] Skipping lead "${leadName}": no valid channel (phone=${!!phoneForVoice}, mobile=${!!phoneForWA}, email=${!!emailForOutreach}) or limits reached`);
      skippedRateLimit++;
      continue;
    }
  }

  const searchQuery = task.ai_instruction?.match(/[""]([^""]+)[""]|cercando\s+(.+?)(?:\s+in\s+|\s*$)/i)?.[1] || 'Ricerca lead';
  let individualTasksCreated = 0;

  const allAssignedLeads: { lead: any; channel: string }[] = [];
  for (const lead of batchVoice) allAssignedLeads.push({ lead, channel: 'voice' });
  for (const lead of batchWhatsapp) allAssignedLeads.push({ lead, channel: 'whatsapp' });
  for (const lead of batchEmail) allAssignedLeads.push({ lead, channel: 'email' });

  if (allAssignedLeads.length > 0) {
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

    let slotIndex = 0;
    for (const { lead, channel } of allAssignedLeads) {
      const leadName = lead.businessName || 'Lead sconosciuto';
      try {
        const leadObj = {
          id: lead.leadId, leadId: lead.leadId,
          businessName: leadName, phone: lead.phone,
          email: lead.email, website: lead.website,
          address: lead.address, category: lead.category,
          score: lead.score,
          salesSummary: lead.salesSummary,
        };

        await logActivity(task.consultant_id, {
          event_type: 'lead_outreach_generating',
          title: `✍️ Genero contenuto ${channel} per ${leadName}...`,
          description: `Score: ${lead.score || 'N/A'}/100 — Preparo il messaggio personalizzato`,
          icon: '✍️',
          severity: 'info',
          task_id: task.id,
        });

        const content = await generateOutreachContent(task.consultant_id, leadObj, channel, salesCtx, consultantName, undefined, outreachConfig, loadedWaTemplates, consultantBusinessName);
        const result = await scheduleIndividualOutreach(task.consultant_id, leadObj, channel, content, scheduleConfig, hunterMode === 'autonomous' ? 'autonomous' : 'approval', slotIndex);

        if (result.taskId) {
          await db.execute(sql`UPDATE ai_scheduled_tasks SET parent_task_id=${task.id} WHERE id=${result.taskId}`);

          await db
            .update(leadScraperResults)
            .set({
              leadStatus: 'in_outreach',
              outreachTaskId: result.taskId,
              leadNextAction: `${channel} outreach individuale`,
              leadNextActionDate: new Date(result.scheduledAt),
            })
            .where(eq(leadScraperResults.id, lead.leadId));

          await db.insert(leadScraperActivities).values({
            leadId: lead.leadId,
            consultantId: task.consultant_id,
            type: 'outreach_assigned',
            title: `Outreach ${channel} schedulato da Hunter per ${leadName}`,
            description: `Ricerca "${searchQuery}" — Score: ${lead.score || 'N/A'}/100. Contenuto generato con AI.`,
            metadata: { taskId: result.taskId, channel, score: lead.score, assigned_by: 'hunter', search_query: searchQuery },
          });

          individualTasksCreated++;
          slotIndex++;
          console.log(`${LOG_PREFIX} [LEAD-QUALIFY] Created ${channel} task ${result.taskId} for ${leadName} (score: ${lead.score})`);
        }
      } catch (err: any) {
        if (err.message?.startsWith('SKIP_CHANNEL:')) {
          console.warn(`${LOG_PREFIX} [LEAD-QUALIFY] Channel ${channel} skipped for ${leadName}: ${err.message}`);
        } else {
          console.error(`${LOG_PREFIX} [LEAD-QUALIFY] Failed to create ${channel} task for ${leadName}: ${err.message}`);
        }
      }

      if (slotIndex < allAssignedLeads.length) {
        await new Promise(r => setTimeout(r, 1500));
      }
    }

    await logActivity(task.consultant_id, {
      event_type: 'lead_outreach_all_created',
      title: `🚀 ${individualTasksCreated} task outreach creati per ${searchQuery}`,
      description: `${voiceLeadCount > 0 ? `📞 ${voiceLeadCount} chiamate` : ''}${whatsappLeadCount > 0 ? ` 💬 ${whatsappLeadCount} WhatsApp` : ''}${emailLeadCount > 0 ? ` 📧 ${emailLeadCount} email` : ''} — tutti con contenuto personalizzato generato da AI`,
      icon: '🚀',
      severity: 'info',
      task_id: task.id,
    });
  }

  const totalTasksCreated = voiceLeadCount + whatsappLeadCount + emailLeadCount;
  const uniqueLeadIds = new Set([...batchVoice.map(l => l.leadId), ...batchWhatsapp.map(l => l.leadId), ...batchEmail.map(l => l.leadId)]);

  await logActivity(task.consultant_id, {
    event_type: 'lead_qualify_and_assign_completed',
    title: `Qualifica completata: ${individualTasksCreated} task outreach creati per ${uniqueLeadIds.size} lead`,
    description: `${qualifiedLeads.length}/${allLeads.length} qualificati (soglia: ${scoreThreshold}). ${uniqueLeadIds.size} lead → ${individualTasksCreated} task: ${voiceLeadCount > 0 ? `📞 ${voiceLeadCount} chiamate` : ''}${whatsappLeadCount > 0 ? ` 💬 ${whatsappLeadCount} WhatsApp` : ''}${emailLeadCount > 0 ? ` 📧 ${emailLeadCount} email` : ''}. Skippati: ${skippedCooldown} cooldown, ${skippedRateLimit} rate limit.`,
    icon: '🎯',
    severity: 'info',
    task_id: task.id,
  });

  return {
    search_id: searchId,
    total_leads: allLeads.length,
    qualified_count: qualifiedLeads.length,
    score_threshold: scoreThreshold,
    summaries_generated: summariesGenerated,
    summaries_failed: summariesFailed,
    batch_tasks_created: individualTasksCreated,
    tasks_created: totalTasksCreated,
    leads_assigned: uniqueLeadIds.size,
    unique_leads_assigned: uniqueLeadIds.size,
    voice_leads: voiceLeadCount,
    whatsapp_leads: whatsappLeadCount,
    email_leads: emailLeadCount,
    skipped_cooldown: skippedCooldown,
    skipped_rate_limit: skippedRateLimit,
    channel_priority: channelPriority,
    qualified_leads: qualifiedLeads.map(l => ({
      id: l.id,
      business_name: l.businessName,
      score: l.aiCompatibilityScore,
      status: l.leadStatus,
    })),
  };
}
