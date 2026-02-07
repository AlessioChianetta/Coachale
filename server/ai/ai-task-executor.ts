import { GoogleGenAI } from "@google/genai";
import { getGeminiApiKeyForClassifier, GEMINI_LEGACY_MODEL } from "./provider-factory";
import { db } from "../db";
import { sql } from "drizzle-orm";
import { logActivity } from "../cron/ai-task-scheduler";
import { ExecutionStep } from "./autonomous-decision-engine";

const LOG_PREFIX = "⚙️ [TASK-EXECUTOR]";

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

function generateScheduledCallId(): string {
  return `sc_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

export async function executeStep(
  task: AITaskInfo,
  step: ExecutionStep,
  previousResults: Record<string, any>,
): Promise<StepExecutionResult> {
  const startTime = Date.now();
  console.log(`${LOG_PREFIX} Executing step ${step.step}: ${step.action} - ${step.description}`);

  try {
    let result: Record<string, any>;

    switch (step.action) {
      case "fetch_client_data":
        result = await handleFetchClientData(task, step, previousResults);
        break;
      case "analyze_patterns":
        result = await handleAnalyzePatterns(task, step, previousResults);
        break;
      case "generate_report":
        result = await handleGenerateReport(task, step, previousResults);
        break;
      case "prepare_call":
        result = await handlePrepareCall(task, step, previousResults);
        break;
      case "voice_call":
        result = await handleVoiceCall(task, step, previousResults);
        break;
      case "send_email":
        result = await handleSendEmail(task, step, previousResults);
        break;
      case "send_whatsapp":
        result = await handleSendWhatsapp(task, step, previousResults);
        break;
      case "web_search":
        result = await handleWebSearch(task, step, previousResults);
        break;
      default:
        throw new Error(`Unknown step action: ${step.action}`);
    }

    const duration_ms = Date.now() - startTime;
    console.log(`${LOG_PREFIX} Step ${step.step} (${step.action}) completed in ${duration_ms}ms`);

    await logActivity(task.consultant_id, {
      event_type: `step_${step.action}_completed`,
      title: `Step ${step.step} completato: ${step.action}`,
      description: step.description,
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

  console.log(`${LOG_PREFIX} Client data fetched: contact=${contactData ? "found" : "not found"}, recent_tasks=${recentTasks.length}`);

  return {
    contact: contactData || {
      phone_number: task.contact_phone,
      name: task.contact_name,
    },
    recent_tasks: recentTasks,
    contact_found: !!contactData,
  };
}

async function handleAnalyzePatterns(
  task: AITaskInfo,
  _step: ExecutionStep,
  previousResults: Record<string, any>,
): Promise<Record<string, any>> {
  const clientData = previousResults.fetch_client_data || previousResults;

  const prompt = `Sei un analista AI specializzato in consulenza commerciale italiana.

Analizza i seguenti dati del cliente e fornisci un'analisi dettagliata.

DATI CLIENTE:
${JSON.stringify(clientData.contact || {}, null, 2)}

TASK RECENTI:
${JSON.stringify(clientData.recent_tasks || [], null, 2)}

ISTRUZIONE ORIGINALE DEL TASK:
${task.ai_instruction}

CATEGORIA TASK: ${task.task_category}

Rispondi ESCLUSIVAMENTE in formato JSON valido con questa struttura:
{
  "insights": ["insight 1", "insight 2", ...],
  "risk_assessment": {
    "level": "low|medium|high",
    "factors": ["fattore 1", "fattore 2", ...],
    "description": "descrizione del rischio"
  },
  "recommendations": ["raccomandazione 1", "raccomandazione 2", ...],
  "engagement_score": 0-100,
  "suggested_approach": "descrizione dell'approccio suggerito",
  "key_topics": ["topic 1", "topic 2", ...]
}`;

  const apiKey = await getGeminiApiKeyForClassifier();
  if (!apiKey) throw new Error("No Gemini API key available");
  const ai = new GoogleGenAI({ apiKey });

  const response = await withRetry(async () => {
    return await ai.models.generateContent({
      model: GEMINI_LEGACY_MODEL,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: { temperature: 0.3, maxOutputTokens: 4096 },
    });
  });

  const text = response.text || "";
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
): Promise<Record<string, any>> {
  const analysisData = previousResults.analyze_patterns || previousResults;
  const clientData = previousResults.fetch_client_data || {};

  const prompt = `Sei un assistente AI per consulenti commerciali italiani.
Genera un report strutturato basato sull'analisi seguente.

ANALISI:
${JSON.stringify(analysisData, null, 2)}

DATI CLIENTE:
${JSON.stringify(clientData.contact || {}, null, 2)}

ISTRUZIONE ORIGINALE:
${task.ai_instruction}

Rispondi ESCLUSIVAMENTE in formato JSON valido con questa struttura:
{
  "title": "Titolo del report",
  "summary": "Riepilogo esecutivo in 2-3 frasi",
  "sections": [
    {
      "heading": "Titolo sezione",
      "content": "Contenuto della sezione"
    }
  ],
  "key_findings": ["risultato chiave 1", "risultato chiave 2", ...],
  "recommendations": [
    {
      "action": "azione consigliata",
      "priority": "high|medium|low",
      "rationale": "motivazione"
    }
  ],
  "next_steps": ["passo successivo 1", "passo successivo 2", ...]
}`;

  const apiKey = await getGeminiApiKeyForClassifier();
  if (!apiKey) throw new Error("No Gemini API key available");
  const ai = new GoogleGenAI({ apiKey });

  const response = await withRetry(async () => {
    return await ai.models.generateContent({
      model: GEMINI_LEGACY_MODEL,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: { temperature: 0.3, maxOutputTokens: 4096 },
    });
  });

  const text = response.text || "";
  console.log(`${LOG_PREFIX} Gemini report response length: ${text.length}`);

  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
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
): Promise<Record<string, any>> {
  const analysisData = previousResults.analyze_patterns || {};
  const reportData = previousResults.generate_report || {};
  const clientData = previousResults.fetch_client_data || {};

  const prompt = `Sei un assistente AI per consulenti commerciali italiani.
Prepara i punti chiave per una telefonata con il cliente.

DATI CLIENTE:
Nome: ${task.contact_name || clientData.contact?.first_name || "N/A"}
Telefono: ${task.contact_phone}

ANALISI PRECEDENTE:
${JSON.stringify(analysisData, null, 2)}

REPORT:
${JSON.stringify(reportData, null, 2)}

ISTRUZIONE ORIGINALE:
${task.ai_instruction}

CATEGORIA: ${task.task_category}

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
  "call_priority": "high|medium|low"
}`;

  const apiKey = await getGeminiApiKeyForClassifier();
  if (!apiKey) throw new Error("No Gemini API key available");
  const ai = new GoogleGenAI({ apiKey });

  const response = await withRetry(async () => {
    return await ai.models.generateContent({
      model: GEMINI_LEGACY_MODEL,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: { temperature: 0.4, maxOutputTokens: 4096 },
    });
  });

  const text = response.text || "";
  console.log(`${LOG_PREFIX} Gemini call prep response length: ${text.length}`);

  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (parseError: any) {
    console.warn(`${LOG_PREFIX} Failed to parse call prep JSON, returning raw text`);
  }

  return {
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
    raw_response: text,
  };
}

async function handleVoiceCall(
  task: AITaskInfo,
  _step: ExecutionStep,
  previousResults: Record<string, any>,
): Promise<Record<string, any>> {
  const callPrep = previousResults.prepare_call || {};

  const talkingPoints = callPrep.talking_points || [];
  const talkingPointsText = talkingPoints
    .map((tp: any) => `- ${tp.topic}: ${tp.key_message}`)
    .join("\n");

  const customPrompt = callPrep.opening_script
    ? `${callPrep.opening_script}\n\nPunti chiave:\n${talkingPointsText}\n\n${callPrep.closing_script || ""}`
    : task.ai_instruction;

  const scheduledCallId = generateScheduledCallId();

  console.log(`${LOG_PREFIX} Creating scheduled voice call ${scheduledCallId} for task ${task.id}`);

  await db.execute(sql`
    INSERT INTO scheduled_voice_calls (
      id, consultant_id, target_phone, scheduled_at, status, ai_mode,
      custom_prompt, call_instruction, instruction_type, attempts, max_attempts,
      priority, source_task_id, attempts_log, use_default_template, created_at, updated_at
    ) VALUES (
      ${scheduledCallId}, ${task.consultant_id}, ${task.contact_phone},
      NOW(), 'scheduled', 'assistenza',
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
      ${childTaskId}, ${task.consultant_id}, ${task.contact_phone},
      ${task.contact_name}, 'single_call', ${customPrompt},
      NOW(), ${task.timezone || "Europe/Rome"}, 'scheduled', ${task.priority || 1}, ${task.id},
      ${task.contact_id}, ${task.task_category}, ${scheduledCallId},
      3, 0, 5,
      NOW(), NOW()
    )
  `);

  console.log(`${LOG_PREFIX} Created child task ${childTaskId} with voice_call_id ${scheduledCallId}`);

  return {
    call_id: scheduledCallId,
    child_task_id: childTaskId,
    target_phone: task.contact_phone,
    custom_prompt: customPrompt,
    status: "scheduled",
  };
}

async function handleSendEmail(
  task: AITaskInfo,
  _step: ExecutionStep,
  previousResults: Record<string, any>,
): Promise<Record<string, any>> {
  console.log(`${LOG_PREFIX} [PLACEHOLDER] Email send requested for task ${task.id} to ${task.contact_name || task.contact_phone}`);

  const reportData = previousResults.generate_report || {};
  const analysisData = previousResults.analyze_patterns || {};

  await logActivity(task.consultant_id, {
    event_type: "send_email",
    title: `Email pianificata per ${task.contact_name || task.contact_phone}`,
    description: `Placeholder - integrazione email prevista in Phase 4. Categoria: ${task.task_category}`,
    icon: "📧",
    severity: "info",
    task_id: task.id,
    contact_name: task.contact_name,
    contact_id: task.contact_id,
    event_data: {
      report_title: reportData.title,
      key_findings_count: (reportData.key_findings || []).length,
      engagement_score: analysisData.engagement_score,
    },
  });

  return {
    status: "placeholder",
    message: "Email integration coming in Phase 4",
    intended_recipient: task.contact_name || task.contact_phone,
    task_category: task.task_category,
  };
}

async function handleSendWhatsapp(
  task: AITaskInfo,
  _step: ExecutionStep,
  previousResults: Record<string, any>,
): Promise<Record<string, any>> {
  console.log(`${LOG_PREFIX} [PLACEHOLDER] WhatsApp send requested for task ${task.id} to ${task.contact_name || task.contact_phone}`);

  const reportData = previousResults.generate_report || {};
  const analysisData = previousResults.analyze_patterns || {};

  await logActivity(task.consultant_id, {
    event_type: "send_whatsapp",
    title: `WhatsApp pianificato per ${task.contact_name || task.contact_phone}`,
    description: `Placeholder - integrazione WhatsApp prevista in Phase 4. Categoria: ${task.task_category}`,
    icon: "💬",
    severity: "info",
    task_id: task.id,
    contact_name: task.contact_name,
    contact_id: task.contact_id,
    event_data: {
      report_title: reportData.title,
      key_findings_count: (reportData.key_findings || []).length,
      engagement_score: analysisData.engagement_score,
    },
  });

  return {
    status: "placeholder",
    message: "WhatsApp integration coming in Phase 4",
    intended_recipient: task.contact_name || task.contact_phone,
    target_phone: task.contact_phone,
    task_category: task.task_category,
  };
}

async function handleWebSearch(
  task: AITaskInfo,
  step: ExecutionStep,
  previousResults: Record<string, any>,
): Promise<Record<string, any>> {
  const searchQuery = step.params?.search_query || task.ai_instruction || "ricerca generica";
  const analysisData = previousResults.analyze_patterns || {};
  const clientData = previousResults.fetch_client_data || {};
  const contactName = task.contact_name || clientData.contact?.first_name || "N/A";

  console.log(`${LOG_PREFIX} Esecuzione ricerca web: "${searchQuery}"`);

  const prompt = `Sei un ricercatore AI specializzato in consulenza finanziaria e commerciale italiana.

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
1. Normative e regolamenti italiani/europei rilevanti
2. Andamenti di mercato e trend finanziari
3. Notizie recenti pertinenti
4. Dati statistici e benchmark di settore
5. Best practice e raccomandazioni degli esperti

Fornisci una risposta strutturata e dettagliata con le informazioni trovate, citando le fonti quando possibile.`;

  const apiKey = await getGeminiApiKeyForClassifier();
  if (!apiKey) throw new Error("No Gemini API key available");
  const ai = new GoogleGenAI({ apiKey });

  const response = await withRetry(async () => {
    return await ai.models.generateContent({
      model: GEMINI_LEGACY_MODEL,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: {
        temperature: 0.3,
        maxOutputTokens: 8192,
        tools: [{ googleSearch: {} }],
      },
    });
  });

  const text = response.text || "";
  console.log(`${LOG_PREFIX} Risposta ricerca web, lunghezza: ${text.length}`);

  const groundingMetadata = (response as any).candidates?.[0]?.groundingMetadata;
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
