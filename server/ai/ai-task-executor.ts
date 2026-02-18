import { GoogleGenAI } from "@google/genai";
import { getAIProvider, getModelForProviderName, getGeminiApiKeyForClassifier, GEMINI_3_MODEL, trackedGenerateContent, type GeminiClient } from "./provider-factory";
import { db } from "../db";
import { sql } from "drizzle-orm";
import { logActivity } from "../cron/ai-task-scheduler";
import { ExecutionStep, getAutonomySettings, buildRolePersonality } from "./autonomous-decision-engine";
import { fetchAgentContext, buildAgentContextSection } from "../cron/ai-autonomous-roles";
import { fileSearchService } from "./file-search-service";
import { fileSearchSyncService } from "../services/file-search-sync-service";

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
        title: `📚 ${agentId}: ${result.systemPromptDocs.length} doc in memoria, ${result.fileSearchDocTitles.length} doc in ricerca`,
        description: [
          ...result.systemPromptDocs.map(d => `📄 "${d.title}" (${d.source === 'system_prompt_document' ? 'Doc Sistema' : 'Knowledge Base'}) → System Prompt`),
          ...result.fileSearchDocTitles.map(t => `🔍 "${t}" → File Search/RAG`),
        ].join('\n') || 'Nessun documento assegnato',
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

export async function executeStep(
  task: AITaskInfo,
  step: ExecutionStep,
  previousResults: Record<string, any>,
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

    let result: Record<string, any>;

    switch (step.action) {
      case "fetch_client_data":
        result = await handleFetchClientData(task, step, previousResults);
        break;
      case "search_private_stores":
        result = await handleSearchPrivateStores(task, step, previousResults, rolePersonality, agentContextSection, agentDocs);
        break;
      case "analyze_patterns":
        result = await handleAnalyzePatterns(task, step, previousResults, rolePersonality, agentContextSection);
        break;
      case "generate_report":
        result = await handleGenerateReport(task, step, previousResults, rolePersonality, agentContextSection);
        break;
      case "prepare_call":
        result = await handlePrepareCall(task, step, previousResults, rolePersonality, agentContextSection);
        break;
      case "voice_call":
        result = await handleVoiceCall(task, step, previousResults);
        break;
      case "send_email":
        result = await handleSendEmail(task, step, previousResults, agentContextSection);
        break;
      case "send_whatsapp":
        result = await handleSendWhatsapp(task, step, previousResults, agentContextSection);
        break;
      case "web_search":
        result = await handleWebSearch(task, step, previousResults);
        break;
      default:
        throw new Error(`Unknown step action: ${step.action}`);
    }

    const duration_ms = Date.now() - startTime;
    console.log(`${LOG_PREFIX} Step ${step.step} (${step.action}) completed in ${duration_ms}ms`);

    let enrichedDescription = step.description;

    if (step.action === 'fetch_client_data' && result) {
      enrichedDescription = `Dati recuperati per ${result.contact?.first_name || 'N/A'} ${result.contact?.last_name || ''}. Task recenti: ${result.recent_tasks?.length || 0}`;
    } else if (step.action === 'search_private_stores' && result) {
      enrichedDescription = `Trovati ${result.documents_found || 0} documenti in ${result.stores_searched || 0} archivi. ${result.findings_summary?.substring(0, 200) || ''}`;
    } else if (step.action === 'analyze_patterns' && result) {
      enrichedDescription = `Analisi completata. Score: ${result.engagement_score || 'N/A'}/100. Rischio: ${result.risk_assessment?.level || 'N/A'}. ${result.insights?.length || 0} insight, ${result.recommendations?.length || 0} raccomandazioni. Approccio: ${result.suggested_approach?.substring(0, 150) || ''}`;
    } else if (step.action === 'web_search' && result) {
      enrichedDescription = `Ricerca web: "${result.search_query?.substring(0, 80) || 'N/A'}". ${result.sources?.length || 0} fonti trovate. ${result.findings?.substring(0, 200) || ''}`;
    } else if (step.action === 'generate_report' && result) {
      enrichedDescription = `Report: "${result.title || 'N/A'}". ${result.sections?.length || 0} sezioni, ${result.key_findings?.length || 0} risultati chiave, ${result.recommendations?.length || 0} raccomandazioni.`;
    } else if (step.action === 'prepare_call' && result) {
      enrichedDescription = `Chiamata preparata: ${result.talking_points?.length || 0} punti di discussione. Priorità: ${result.call_priority || 'N/A'}. Durata stimata: ${result.call_duration_estimate_minutes || 'N/A'} min.`;
    } else if (step.action === 'voice_call' && result) {
      enrichedDescription = `Chiamata programmata a ${result.target_phone || 'N/A'}. ID: ${result.call_id || 'N/A'}. Status: ${result.status || 'N/A'}.`;
    } else if (step.action === 'send_email' && result) {
      enrichedDescription = `Email ${result.status === 'sent' ? 'inviata' : result.status === 'skipped' ? 'saltata' : 'fallita'} a ${result.recipient || task.contact_name || 'N/A'}. ${result.subject ? `Oggetto: "${result.subject}"` : ''} ${result.has_attachment ? 'Con PDF allegato.' : ''}`;
    } else if (step.action === 'send_whatsapp' && result) {
      enrichedDescription = `WhatsApp ${result.status === 'sent' ? 'inviato' : result.status === 'skipped' ? 'saltato' : 'fallito'} a ${result.target_phone || task.contact_name || 'N/A'}. ${result.message_preview ? `"${result.message_preview}"` : ''}`;
    }

    await logActivity(task.consultant_id, {
      event_type: `step_${step.action}_completed`,
      title: `Step ${step.step} completato: ${step.action}`,
      description: enrichedDescription,
      icon: "⚙️",
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
      title: `Step ${step.step} fallito: ${step.action}`,
      description: error.message,
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
): Promise<Record<string, any>> {
  console.log(`${LOG_PREFIX} Searching private stores for consultant=${task.consultant_id}, contact=${task.contact_id || 'N/A'}, agent_file_search_docs=${agentDocs?.fileSearchDocTitles?.length || 0}`);

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
      title: `🔍 Ricerca nei documenti assegnati: ${agentDocs.fileSearchDocTitles.join(', ')}`,
      description: `File Search RAG in ${agentDocs.fileSearchStoreNames.length} archivi del consulente`,
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
    const breakdownResult = await fileSearchService.getStoreBreakdownForGeneration(task.consultant_id, 'consultant');
    breakdown = breakdownResult.breakdown;
  } catch (err: any) {
    console.warn(`${LOG_PREFIX} Failed to get store breakdown: ${err.message}`);
  }

  const storeProgressMessages = [
    { message: "Cerco nelle consulenze passate...", icon: "📋" },
    { message: "Analizzo esercizi del cliente...", icon: "📝" },
    { message: "Consulto la knowledge base...", icon: "📚" },
    { message: "Cerco nella libreria del consulente...", icon: "🗂️" },
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

  const searchPrompt = `${searchIdentity}

ISTRUZIONE TASK: ${task.ai_instruction}
${task.additional_context ? `\nIstruzioni aggiuntive e contesto, segui attentamente o tieni a memoria:\n${task.additional_context}` : ''}${buildFollowUpSection(previousResults)}
CATEGORIA: ${task.task_category}
CONTATTO: ${task.contact_name || 'N/A'}

Cerca specificamente:
1. Note di consulenze passate con questo contatto
2. Esercizi assegnati e risposte
3. Documenti della knowledge base pertinenti
4. Contesto dalla libreria del consulente

Riassumi le informazioni trovate in modo strutturato.`;

  const response = await withRetry(async () => {
    return await trackedGenerateContent(ai!, {
      model: GEMINI_3_MODEL,
      contents: [{ role: "user", parts: [{ text: searchPrompt }] }],
      config: {
        temperature: 0.3,
        maxOutputTokens: 8192,
        tools: [fileSearchTool],
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
): Promise<Record<string, any>> {
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
  console.log(`${LOG_PREFIX} analyze_patterns using ${providerName} (${resolvedModel})`);

  const response = await withRetry(async () => {
    return await client.generateContent({
      model: resolvedModel,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.3, maxOutputTokens: 16384 },
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
): Promise<Record<string, any>> {
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
  console.log(`${LOG_PREFIX} generate_report using ${providerName} (${resolvedModel})`);

  const response = await withRetry(async () => {
    return await client.generateContent({
      model: resolvedModel,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.3, maxOutputTokens: 65536 },
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
): Promise<Record<string, any>> {
  const analysisData = previousResults.analyze_patterns || {};
  const reportData = previousResults.generate_report || {};
  const clientData = previousResults.fetch_client_data || {};

  const callIdentity = rolePersonality
    ? `${rolePersonality}\nPrepara i punti chiave per una telefonata con il cliente, adattandoti al suo contesto specifico.`
    : `Sei un assistente AI per consulenti.\nPrepara i punti chiave per una telefonata con il cliente, adattandoti al suo contesto specifico.`;

  const prompt = `${callIdentity}
${agentContextSection || ''}

IMPORTANT: The talking points and script MUST be about the CURRENT task instruction below, NOT about any previous task or report from a different context. Focus EXCLUSIVELY on what the current task asks.

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
  "opening_script": "frase di apertura suggerita",
  "closing_script": "frase di chiusura suggerita",
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

  const { client, model: resolvedModel, providerName } = await resolveProviderForTask(task.consultant_id, task.ai_role);
  console.log(`${LOG_PREFIX} prepare_call using ${providerName} (${resolvedModel})`);

  const response = await withRetry(async () => {
    return await client.generateContent({
      model: resolvedModel,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.4, maxOutputTokens: 4096 },
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
              title: `Chiamata auto-programmata per ${resolvedName || resolvedPhone}`,
              description: `Programmata per ${targetDateTimeStr}. ID: ${scheduledCallId}`,
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
      priority, source_task_id, attempts_log, use_default_template, created_at, updated_at
    ) VALUES (
      ${scheduledCallId}, ${task.consultant_id}, ${resolvedPhone},
      ${scheduledAtSql}, 'scheduled', 'assistenza',
      ${customPrompt}, ${customPrompt},
      'task', 0, 3,
      ${task.priority || 1}, ${task.id}, '[]'::jsonb, true, NOW(), NOW()
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
    title: `Chiamata programmata per ${resolvedName || resolvedPhone}`,
    description: `Programmata per ${scheduledDisplay}. ID chiamata: ${scheduledCallId}`,
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
): Promise<Record<string, any>> {
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

  const smtpResult = await db.execute(sql`
    SELECT smtp_host, smtp_port, smtp_user, smtp_password, email_address, display_name
    FROM email_accounts
    WHERE consultant_id = ${task.consultant_id} AND smtp_host IS NOT NULL
    LIMIT 1
  `);

  if (smtpResult.rows.length === 0) {
    return { status: "skipped", reason: "Nessun account email SMTP configurato per il consulente" };
  }

  const smtpConfig = smtpResult.rows[0] as any;

  const emailSubject = _step.params?.subject || `Report: ${reportData.title || task.task_category}`;
  let emailBody = _step.params?.message_summary || "";

  if (!emailBody) {
    try {
      const { client, model: resolvedModel, providerName } = await resolveProviderForTask(task.consultant_id, task.ai_role);
      console.log(`${LOG_PREFIX} send_email body generation using ${providerName}`);
      const emailPrompt = `Scrivi un'email BREVE (massimo 4-5 frasi) e professionale per il cliente ${task.contact_name || 'N/A'}.
${agentContextSection || ''}
Contesto: ${task.ai_instruction}
${task.additional_context ? `\nIstruzioni aggiuntive e contesto, segui attentamente o tieni a memoria:\n${task.additional_context}` : ''}${buildFollowUpSection(previousResults)}
${reportData.title ? `Report allegato: "${reportData.title}"` : ''}
${reportData.summary ? `Riepilogo: ${reportData.summary.substring(0, 200)}` : ''}

REGOLE IMPORTANTI:
1. Scrivi l'INTERA email completa: saluto iniziale, corpo, e chiusura. Il tono deve essere COERENTE dall'inizio alla fine.
2. NON dare per scontato che azioni programmate (chiamate, incontri) siano già avvenute. Se è stata programmata una chiamata futura, scrivi "la contatterò" o "ci sentiremo", NON "come anticipato a voce".
3. NON scrivere un papiro. Il dettaglio è nel report allegato.
4. Sii diretto e professionale.`;

      const resp = await withRetry(() => client.generateContent({
        model: resolvedModel,
        contents: [{ role: "user", parts: [{ text: emailPrompt }] }],
        generationConfig: { temperature: 0.4, maxOutputTokens: 512 },
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

    await logActivity(task.consultant_id, {
      event_type: "email_sent",
      title: `Email inviata a ${task.contact_name || contactEmail}`,
      description: `Oggetto: "${emailSubject}". ${attachments.length > 0 ? `${attachments.length} PDF allegat${attachments.length === 1 ? 'o' : 'i'}.` : 'Senza allegati.'}`,
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
      has_attachment: attachments.length > 0,
      attachment_count: attachments.length,
    };
  } catch (error: any) {
    console.error(`${LOG_PREFIX} Email send failed:`, error.message);

    await logActivity(task.consultant_id, {
      event_type: "email_failed",
      title: `Email fallita per ${task.contact_name || contactEmail}`,
      description: error.message,
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
): Promise<Record<string, any>> {
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

  if (selectedTemplateId && templateVariableCount > 0) {
    try {
      const { client, model: resolvedModel, providerName } = await resolveProviderForTask(task.consultant_id, task.ai_role);
      console.log(`${LOG_PREFIX} Generating template variables using ${providerName}`);

      const variablePrompt = `Devi generare i valori per le variabili di un template WhatsApp.

Template: "${templateBodyText}"
Numero variabili: ${templateVariableCount}

Contesto cliente:
- Nome: ${resolvedName || 'Cliente'}
- Istruzione: ${task.ai_instruction}
${task.additional_context ? `- Contesto aggiuntivo: ${task.additional_context}` : ''}
${agentContextSection || ''}
${reportData.title ? `- Report preparato: "${reportData.title}"` : ''}
${reportData.summary ? `- Riepilogo report: ${reportData.summary.substring(0, 200)}` : ''}

REGOLE:
- La variabile {{1}} è SEMPRE il nome del cliente: "${resolvedName || 'Cliente'}"
- Le altre variabili ({{2}}, {{3}}, ecc.) sono messaggi brevi e personalizzati basati sul contesto
- ${reportData.title ? 'C\'è un report che verrà allegato come PDF nella chat. Menziona che troverà il report allegato qui in chat.' : 'Non menzionare report o email.'}
- Ogni variabile deve essere BREVE (massimo 1-2 frasi)
- NON usare newline (\\n) nei valori
- Sii professionale e cordiale

Rispondi SOLO con un JSON valido nel formato:
${templateVariableCount === 1 ? '{"1": "valore"}' : templateVariableCount === 2 ? '{"1": "valore", "2": "valore"}' : `{${Array.from({length: templateVariableCount}, (_, i) => `"${i+1}": "valore"`).join(', ')}}`}`;

      const resp = await withRetry(() => client.generateContent({
        model: resolvedModel,
        contents: [{ role: "user", parts: [{ text: variablePrompt }] }],
        generationConfig: { temperature: 0.4, maxOutputTokens: 512 },
      }));

      const responseText = resp.response.text() || '';
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        contentVariables = {};
        contentVariables['1'] = resolvedName || 'Cliente';
        for (let i = 2; i <= templateVariableCount; i++) {
          const val = parsed[String(i)] || parsed[i];
          if (val) {
            contentVariables[String(i)] = String(val).replace(/[\n\r\t]/g, ' ').trim();
          }
        }
        console.log(`✅ ${LOG_PREFIX} Template variables generated: ${JSON.stringify(contentVariables)}`);
      }
    } catch (varErr: any) {
      console.warn(`${LOG_PREFIX} Failed to generate template variables: ${varErr.message}`);
      contentVariables = { '1': resolvedName || 'Cliente' };
      if (templateVariableCount >= 2) {
        contentVariables['2'] = task.ai_instruction?.substring(0, 100) || 'la contatto per aggiornarla';
      }
      console.log(`⚠️ ${LOG_PREFIX} Using fallback variables: ${JSON.stringify(contentVariables)}`);
    }
  }

  if (!messageText) {
    try {
      const { client, model: resolvedModel, providerName } = await resolveProviderForTask(task.consultant_id, task.ai_role);
      console.log(`${LOG_PREFIX} send_whatsapp body generation using ${providerName}`);
      const whatsappPrompt = `Scrivi un messaggio WhatsApp BREVE (massimo 2-3 frasi) e professionale per ${resolvedName || 'il cliente'}.
${agentContextSection || ''}
Contesto: ${task.ai_instruction}
${task.additional_context ? `\nIstruzioni aggiuntive e contesto, segui attentamente o tieni a memoria:\n${task.additional_context}` : ''}${buildFollowUpSection(previousResults)}
${reportData.title ? `Report preparato: "${reportData.title}" - verrà allegato come PDF nella chat WhatsApp.` : ''}
${reportData.summary ? `Riepilogo: ${reportData.summary.substring(0, 150)}` : ''}
NON fare un papiro. Massimo 2-3 frasi. Sii diretto e cordiale.${reportData.title ? ' Menziona che troverà il report allegato qui in chat.' : ''}`;

      const resp = await withRetry(() => client.generateContent({
        model: resolvedModel,
        contents: [{ role: "user", parts: [{ text: whatsappPrompt }] }],
        generationConfig: { temperature: 0.5, maxOutputTokens: 256 },
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

    let pdfMediaUrl: string | null = null;
    let pdfCount = 0;
    let pdfType = '';

    if (reportData && reportData.title) {
      console.log(`📎 ${LOG_PREFIX} [PDF PREP] Inizio generazione PDF per allegato WhatsApp...`);
      const crypto = await import('crypto');
      const fs = await import('fs/promises');
      const pathMod = await import('path');
      const rawDomain = process.env.REPLIT_DOMAINS || process.env.REPLIT_DEV_DOMAIN || '';
      const domain = rawDomain.split(',')[0].trim();
      console.log(`📎 ${LOG_PREFIX} [PDF PREP] Dominio per URL pubblico: "${domain}"`);
      if (!domain) {
        console.error(`❌ ${LOG_PREFIX} [PDF PREP] ERRORE CRITICO: Nessun dominio disponibile (REPLIT_DOMAINS e REPLIT_DEV_DOMAIN vuoti). Twilio non potrà scaricare il PDF!`);
      }
      const tmpDir = '/tmp/wa-media';
      await fs.mkdir(tmpDir, { recursive: true });

      const saveTempPdf = async (buffer: Buffer, label: string): Promise<string> => {
        const token = crypto.randomBytes(16).toString('hex');
        const filePath = pathMod.join(tmpDir, `${token}.pdf`);
        await fs.writeFile(filePath, buffer);
        const url = `https://${domain}/api/temp-media/${token}`;
        const stat = await fs.stat(filePath);
        console.log(`📎 ${LOG_PREFIX} [PDF PREP] ${label} PDF salvato su disco:`);
        console.log(`   📁 Path: ${filePath}`);
        console.log(`   📏 Size buffer: ${buffer.length} bytes`);
        console.log(`   📏 Size file: ${stat.size} bytes`);
        console.log(`   🔗 URL pubblico: ${url}`);
        console.log(`   ⏰ Auto-cleanup: 10 minuti`);
        setTimeout(async () => { try { await fs.unlink(filePath); console.log(`🧹 ${LOG_PREFIX} Cleaned up temp PDF: ${filePath}`); } catch {} }, 10 * 60 * 1000);
        return url;
      };

      const analysisData = previousResults.analyze_patterns || {};
      const hasFormalDoc = !!(reportData.formal_document?.body);

      try {
        if (hasFormalDoc) {
          console.log(`📎 ${LOG_PREFIX} [PDF PREP] Generazione PDF documento formale (formal_document.body items: ${reportData.formal_document.body?.length || 0})...`);
          const formalPdf = await generateFormalDocumentPdfBuffer(reportData.formal_document, reportData, task);
          pdfMediaUrl = await saveTempPdf(formalPdf, 'Documento formale');
          pdfType = 'formal_document';
          pdfCount++;
        } else {
          console.log(`📎 ${LOG_PREFIX} [PDF PREP] Generazione PDF riepilogo (sections: ${reportData.sections?.length || 0})...`);
          const summaryPdf = await generatePdfBuffer(reportData, analysisData, task);
          pdfMediaUrl = await saveTempPdf(summaryPdf, 'Riepilogo');
          pdfType = 'summary';
          pdfCount++;
        }
        console.log(`✅ ${LOG_PREFIX} [PDF PREP] PDF pronto per allegato WhatsApp: ${pdfMediaUrl}`);
      } catch (pdfErr: any) {
        console.error(`❌ ${LOG_PREFIX} [PDF PREP] FALLITO: ${pdfErr.message}`);
        console.error(`   Stack: ${pdfErr.stack?.substring(0, 300)}`);
      }
    } else {
      console.log(`📎 ${LOG_PREFIX} [PDF PREP] Nessun report da allegare (reportData.title assente)`);
    }

    let messageSid: string;

    console.log(`\n📤 ${LOG_PREFIX} [TWILIO CALL] Preparazione chiamata Twilio API...`);
    console.log(`📤 ${LOG_PREFIX} [TWILIO CALL] Modalità: ${selectedTemplateId ? 'TEMPLATE' : 'TESTO LIBERO'}`);
    console.log(`📤 ${LOG_PREFIX} [TWILIO CALL] PDF allegato: ${pdfMediaUrl ? `SÌ (${pdfType})` : 'NO'}`);

    if (selectedTemplateId) {
      const sendOpts = {
        ...agentOpts,
        contentSid: selectedTemplateId,
        ...(contentVariables ? { contentVariables } : {}),
        ...(pdfMediaUrl ? { mediaUrl: pdfMediaUrl } : {}),
      };
      console.log(`📤 ${LOG_PREFIX} [TWILIO CALL] Opzioni invio template: ${JSON.stringify({ contentSid: sendOpts.contentSid, hasVariables: !!sendOpts.contentVariables, hasMediaUrl: !!sendOpts.mediaUrl, mediaUrl: sendOpts.mediaUrl || 'N/A', agentConfigId: sendOpts.agentConfigId || 'auto' })}`);

      messageSid = await sendWhatsAppMessage(
        task.consultant_id,
        resolvedPhone,
        messageText,
        undefined,
        sendOpts,
      );
      console.log(`✅ ${LOG_PREFIX} [TWILIO CALL] Template WhatsApp inviato con successo!`);
      console.log(`   📋 SID: ${messageSid}`);
      console.log(`   📎 PDF allegato: ${pdfMediaUrl ? 'SÌ' : 'NO'}`);
    } else {
      const sendOpts = { ...agentOpts, ...(pdfMediaUrl ? { mediaUrl: pdfMediaUrl } : {}) };
      console.log(`📤 ${LOG_PREFIX} [TWILIO CALL] Opzioni invio testo libero: ${JSON.stringify({ hasMediaUrl: !!sendOpts.mediaUrl, mediaUrl: sendOpts.mediaUrl || 'N/A', agentConfigId: sendOpts.agentConfigId || 'auto' })}`);

      messageSid = await sendWhatsAppMessage(
        task.consultant_id,
        resolvedPhone,
        messageText,
        undefined,
        sendOpts,
      );
      console.log(`✅ ${LOG_PREFIX} [TWILIO CALL] Messaggio testo libero inviato con successo!`);
      console.log(`   📋 SID: ${messageSid}`);
      console.log(`   📎 PDF allegato: ${pdfMediaUrl ? 'SÌ' : 'NO'}`);
    }

    console.log(`📱 ═══════════════════════════════════════════════════════════`);
    console.log(`📱 ${LOG_PREFIX} [WHATSAPP SEND] COMPLETATO`);
    console.log(`📱   SID: ${messageSid}`);
    console.log(`📱   Destinatario: ${resolvedPhone}`);
    console.log(`📱   Template: ${selectedTemplateId || 'nessuno'}`);
    console.log(`📱   PDF: ${pdfCount > 0 ? `SÌ (${pdfType})` : 'NO'}`);
    console.log(`📱 ═══════════════════════════════════════════════════════════\n`);

    await logActivity(task.consultant_id, {
      event_type: "whatsapp_sent",
      title: `WhatsApp inviato a ${resolvedName || resolvedPhone}`,
      description: `Messaggio: "${messageText.substring(0, 100)}..."${selectedTemplateId ? ' (template)' : ' (corpo libero)'}${pdfCount > 0 ? ` | PDF ${pdfType} allegato` : ''}`,
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
      pdf_attached: pdfCount > 0,
      pdf_type: pdfType || undefined,
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
      title: `WhatsApp fallito per ${task.contact_name || task.contact_phone}`,
      description: `${error.message}${error.code ? ` (codice: ${error.code})` : ''}`,
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
): Promise<Record<string, any>> {
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
      console.log(`${LOG_PREFIX} web_search query generation using ${queryProvider}`);
      const keyTopics = analysisData.key_topics || [];
      const queryGenPrompt = `Based on the following task context, generate 2-3 concise, focused web search queries (each max 10 words) that would find the most relevant information. Return ONLY the queries, one per line.

Task instruction: ${task.ai_instruction.substring(0, 300)}
Client name: ${contactName}
Task category: ${task.task_category}
${keyTopics.length > 0 ? `Key topics: ${keyTopics.join(', ')}` : ''}
${step.description ? `Step description: ${step.description}` : ''}`;

      const queryGenResponse = await withRetry(async () => {
        return await queryGenClient.generateContent({
          model: queryModel,
          contents: [{ role: "user", parts: [{ text: queryGenPrompt }] }],
          generationConfig: { temperature: 0.3, maxOutputTokens: 256 },
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
  console.log(`${LOG_PREFIX} web_search using ${providerName} (${resolvedModel})`);

  const response = await withRetry(async () => {
    return await client.generateContent({
      model: resolvedModel,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.3, maxOutputTokens: 8192 },
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
