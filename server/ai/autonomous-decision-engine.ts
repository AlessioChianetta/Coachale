import { GoogleGenAI } from "@google/genai";
import { getGeminiApiKeyForClassifier, GEMINI_LEGACY_MODEL } from "./provider-factory";
import { db } from "../db";
import { sql } from "drizzle-orm";
import { logActivity } from "../cron/ai-task-scheduler";

const LOG_PREFIX = "🧠 [DECISION-ENGINE]";

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface ExecutionStep {
  step: number;
  action: "fetch_client_data" | "analyze_patterns" | "generate_report" | "prepare_call" | "voice_call" | "send_email" | "send_whatsapp" | "web_search";
  description: string;
  status: "pending" | "in_progress" | "completed" | "failed" | "skipped";
  params?: Record<string, any>;
}

export interface DecisionResult {
  should_execute: boolean;
  reasoning: string;
  confidence: number;
  execution_plan: ExecutionStep[];
  estimated_duration_minutes: number;
}

export interface AutonomySettings {
  autonomy_level: number;
  default_mode: string;
  allowed_task_categories: string[];
  always_approve_actions: string[];
  working_hours_start: string;
  working_hours_end: string;
  working_days: number[];
  max_daily_calls: number;
  max_daily_emails: number;
  max_daily_whatsapp: number;
  max_daily_analyses: number;
  is_active: boolean;
  custom_instructions: string | null;
  channels_enabled: Record<string, boolean>;
}

export interface DailyActionCounts {
  calls: number;
  emails: number;
  whatsapp: number;
  analyses: number;
}

export interface TaskContext {
  contact: {
    id?: string | null;
    name?: string;
    email?: string;
    phone?: string;
    role?: string;
  } | null;
  recent_tasks: Array<{
    id: string;
    task_type: string;
    task_category: string;
    status: string;
    ai_instruction: string;
    scheduled_at: string;
    result_summary?: string | null;
  }>;
  recent_activity: Array<{
    event_type: string;
    title: string;
    description?: string | null;
    created_at: string;
  }>;
  autonomy_settings: AutonomySettings;
  daily_counts: DailyActionCounts;
}

// ═══════════════════════════════════════════════════════════════════════════
// DEFAULT SETTINGS
// ═══════════════════════════════════════════════════════════════════════════

const DEFAULT_AUTONOMY_SETTINGS: AutonomySettings = {
  autonomy_level: 1,
  default_mode: "manual",
  allowed_task_categories: ["outreach", "reminder", "followup"],
  always_approve_actions: ["send_email", "make_call", "modify_data"],
  working_hours_start: "08:00",
  working_hours_end: "20:00",
  working_days: [1, 2, 3, 4, 5],
  max_daily_calls: 10,
  max_daily_emails: 20,
  max_daily_whatsapp: 30,
  max_daily_analyses: 50,
  is_active: false,
  custom_instructions: null,
  channels_enabled: { voice: true, email: false, whatsapp: false },
};

// ═══════════════════════════════════════════════════════════════════════════
// RETRY HELPER
// ═══════════════════════════════════════════════════════════════════════════

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

// ═══════════════════════════════════════════════════════════════════════════
// GET AUTONOMY SETTINGS
// ═══════════════════════════════════════════════════════════════════════════

export async function getAutonomySettings(consultantId: string): Promise<AutonomySettings> {
  try {
    const result = await db.execute(sql`
      SELECT * FROM ai_autonomy_settings WHERE consultant_id = ${consultantId} LIMIT 1
    `);

    if (result.rows.length === 0) {
      console.log(`${LOG_PREFIX} No autonomy settings for ${consultantId}, using defaults`);
      return { ...DEFAULT_AUTONOMY_SETTINGS };
    }

    const row = result.rows[0] as any;
    return {
      autonomy_level: row.autonomy_level ?? DEFAULT_AUTONOMY_SETTINGS.autonomy_level,
      default_mode: row.default_mode ?? DEFAULT_AUTONOMY_SETTINGS.default_mode,
      allowed_task_categories: row.allowed_task_categories ?? DEFAULT_AUTONOMY_SETTINGS.allowed_task_categories,
      always_approve_actions: row.always_approve_actions ?? DEFAULT_AUTONOMY_SETTINGS.always_approve_actions,
      working_hours_start: row.working_hours_start ?? DEFAULT_AUTONOMY_SETTINGS.working_hours_start,
      working_hours_end: row.working_hours_end ?? DEFAULT_AUTONOMY_SETTINGS.working_hours_end,
      working_days: row.working_days ?? DEFAULT_AUTONOMY_SETTINGS.working_days,
      max_daily_calls: row.max_daily_calls ?? DEFAULT_AUTONOMY_SETTINGS.max_daily_calls,
      max_daily_emails: row.max_daily_emails ?? DEFAULT_AUTONOMY_SETTINGS.max_daily_emails,
      max_daily_whatsapp: row.max_daily_whatsapp ?? DEFAULT_AUTONOMY_SETTINGS.max_daily_whatsapp,
      max_daily_analyses: row.max_daily_analyses ?? DEFAULT_AUTONOMY_SETTINGS.max_daily_analyses,
      is_active: row.is_active ?? DEFAULT_AUTONOMY_SETTINGS.is_active,
      custom_instructions: row.custom_instructions ?? null,
      channels_enabled: row.channels_enabled ?? DEFAULT_AUTONOMY_SETTINGS.channels_enabled,
    };
  } catch (error: any) {
    console.error(`${LOG_PREFIX} Error fetching autonomy settings:`, error.message);
    return { ...DEFAULT_AUTONOMY_SETTINGS };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// WORKING HOURS CHECK
// ═══════════════════════════════════════════════════════════════════════════

export function isWithinWorkingHours(settings: AutonomySettings): boolean {
  const now = new Date();
  const romeFormatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Rome",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const dayFormatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Rome",
    weekday: "short",
  });

  const timeParts = romeFormatter.format(now).split(":");
  const currentHour = parseInt(timeParts[0], 10);
  const currentMinute = parseInt(timeParts[1], 10);
  const currentTimeMinutes = currentHour * 60 + currentMinute;

  const dayStr = dayFormatter.format(now);
  const dayMap: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };
  const currentDay = dayMap[dayStr] ?? 1;

  if (!settings.working_days.includes(currentDay)) {
    return false;
  }

  const [startH, startM] = settings.working_hours_start.split(":").map(Number);
  const [endH, endM] = settings.working_hours_end.split(":").map(Number);
  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;

  return currentTimeMinutes >= startMinutes && currentTimeMinutes <= endMinutes;
}

// ═══════════════════════════════════════════════════════════════════════════
// DAILY ACTION COUNTS
// ═══════════════════════════════════════════════════════════════════════════

export async function getTodayActionCounts(consultantId: string): Promise<DailyActionCounts> {
  try {
    const result = await db.execute(sql`
      SELECT
        COALESCE(SUM(CASE WHEN event_type IN ('voice_call', 'call_completed', 'call_initiated') THEN 1 ELSE 0 END), 0) AS calls,
        COALESCE(SUM(CASE WHEN event_type IN ('email_sent', 'send_email') THEN 1 ELSE 0 END), 0) AS emails,
        COALESCE(SUM(CASE WHEN event_type IN ('whatsapp_sent', 'send_whatsapp') THEN 1 ELSE 0 END), 0) AS whatsapp,
        COALESCE(SUM(CASE WHEN event_type IN ('analysis_completed', 'analyze_patterns', 'generate_report') THEN 1 ELSE 0 END), 0) AS analyses
      FROM ai_activity_log
      WHERE consultant_id = ${consultantId}
        AND created_at >= (NOW() AT TIME ZONE 'Europe/Rome')::date
    `);

    const row = result.rows[0] as any;
    return {
      calls: parseInt(row?.calls ?? "0", 10),
      emails: parseInt(row?.emails ?? "0", 10),
      whatsapp: parseInt(row?.whatsapp ?? "0", 10),
      analyses: parseInt(row?.analyses ?? "0", 10),
    };
  } catch (error: any) {
    console.error(`${LOG_PREFIX} Error fetching daily action counts:`, error.message);
    return { calls: 0, emails: 0, whatsapp: 0, analyses: 0 };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// CAN EXECUTE AUTONOMOUSLY
// ═══════════════════════════════════════════════════════════════════════════

export async function canExecuteAutonomously(consultantId: string): Promise<{ allowed: boolean; reason?: string }> {
  const settings = await getAutonomySettings(consultantId);

  if (!settings.is_active) {
    return { allowed: false, reason: "Autonomia AI non attiva per questo consulente" };
  }

  if (settings.autonomy_level < 2) {
    return { allowed: false, reason: `Livello di autonomia troppo basso (${settings.autonomy_level}). Richiesto almeno 2 per esecuzione automatica` };
  }

  if (!isWithinWorkingHours(settings)) {
    return { allowed: false, reason: "Fuori dall'orario di lavoro configurato" };
  }

  const counts = await getTodayActionCounts(consultantId);

  if (counts.calls >= settings.max_daily_calls) {
    return { allowed: false, reason: `Limite giornaliero chiamate raggiunto (${counts.calls}/${settings.max_daily_calls})` };
  }
  if (counts.emails >= settings.max_daily_emails) {
    return { allowed: false, reason: `Limite giornaliero email raggiunto (${counts.emails}/${settings.max_daily_emails})` };
  }
  if (counts.whatsapp >= settings.max_daily_whatsapp) {
    return { allowed: false, reason: `Limite giornaliero WhatsApp raggiunto (${counts.whatsapp}/${settings.max_daily_whatsapp})` };
  }
  if (counts.analyses >= settings.max_daily_analyses) {
    return { allowed: false, reason: `Limite giornaliero analisi raggiunto (${counts.analyses}/${settings.max_daily_analyses})` };
  }

  return { allowed: true };
}

// ═══════════════════════════════════════════════════════════════════════════
// CAN EXECUTE MANUALLY (skips autonomy level check, keeps daily limits)
// ═══════════════════════════════════════════════════════════════════════════

export async function canExecuteManually(consultantId: string): Promise<{ allowed: boolean; reason?: string }> {
  const settings = await getAutonomySettings(consultantId);

  if (!settings.is_active) {
    return { allowed: false, reason: "Autonomia AI non attiva per questo consulente" };
  }

  const counts = await getTodayActionCounts(consultantId);

  if (counts.calls >= settings.max_daily_calls) {
    return { allowed: false, reason: `Limite giornaliero chiamate raggiunto (${counts.calls}/${settings.max_daily_calls})` };
  }
  if (counts.emails >= settings.max_daily_emails) {
    return { allowed: false, reason: `Limite giornaliero email raggiunto (${counts.emails}/${settings.max_daily_emails})` };
  }
  if (counts.whatsapp >= settings.max_daily_whatsapp) {
    return { allowed: false, reason: `Limite giornaliero WhatsApp raggiunto (${counts.whatsapp}/${settings.max_daily_whatsapp})` };
  }
  if (counts.analyses >= settings.max_daily_analyses) {
    return { allowed: false, reason: `Limite giornaliero analisi raggiunto (${counts.analyses}/${settings.max_daily_analyses})` };
  }

  return { allowed: true };
}

// ═══════════════════════════════════════════════════════════════════════════
// BUILD TASK CONTEXT
// ═══════════════════════════════════════════════════════════════════════════

export async function buildTaskContext(task: {
  consultant_id: string;
  contact_id?: string | null;
  contact_phone?: string;
  ai_instruction?: string;
}): Promise<TaskContext> {
  console.log(`${LOG_PREFIX} Building context for consultant=${task.consultant_id}, contact=${task.contact_id || task.contact_phone || "N/A"}`);

  const [contactResult, recentTasksResult, recentActivityResult, autonomySettings, dailyCounts] = await Promise.all([
    task.contact_id
      ? db.execute(sql`
          SELECT id, first_name, last_name, email, phone_number, role
          FROM users WHERE id = ${task.contact_id} LIMIT 1
        `)
      : task.contact_phone
        ? db.execute(sql`
            SELECT id, first_name, last_name, email, phone_number, role
            FROM users WHERE phone_number = ${task.contact_phone} LIMIT 1
          `)
        : Promise.resolve({ rows: [] }),

    db.execute(sql`
      SELECT id, task_type, task_category, status, ai_instruction, scheduled_at, result_summary
      FROM ai_scheduled_tasks
      WHERE consultant_id = ${task.consultant_id}
        ${task.contact_id ? sql`AND contact_id = ${task.contact_id}` : sql``}
      ORDER BY created_at DESC
      LIMIT 10
    `),

    db.execute(sql`
      SELECT event_type, title, description, created_at
      FROM ai_activity_log
      WHERE consultant_id = ${task.consultant_id}
        ${task.contact_id ? sql`AND contact_id = ${task.contact_id}` : sql``}
      ORDER BY created_at DESC
      LIMIT 15
    `),

    getAutonomySettings(task.consultant_id),

    getTodayActionCounts(task.consultant_id),
  ]);

  const contactRow = contactResult.rows[0] as any;
  const contact = contactRow
    ? {
        id: contactRow.id,
        name: [contactRow.first_name, contactRow.last_name].filter(Boolean).join(" ") || undefined,
        email: contactRow.email || undefined,
        phone: contactRow.phone_number || task.contact_phone || undefined,
        role: contactRow.role || undefined,
      }
    : task.contact_phone
      ? { phone: task.contact_phone }
      : null;

  const recent_tasks = (recentTasksResult.rows as any[]).map(r => ({
    id: r.id,
    task_type: r.task_type,
    task_category: r.task_category,
    status: r.status,
    ai_instruction: r.ai_instruction,
    scheduled_at: r.scheduled_at?.toISOString?.() ?? String(r.scheduled_at),
    result_summary: r.result_summary,
  }));

  const recent_activity = (recentActivityResult.rows as any[]).map(r => ({
    event_type: r.event_type,
    title: r.title,
    description: r.description,
    created_at: r.created_at?.toISOString?.() ?? String(r.created_at),
  }));

  console.log(`${LOG_PREFIX} Context built: contact=${contact?.name || contact?.phone || "none"}, tasks=${recent_tasks.length}, activities=${recent_activity.length}`);

  return {
    contact,
    recent_tasks,
    recent_activity,
    autonomy_settings: autonomySettings,
    daily_counts: dailyCounts,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// GENERATE EXECUTION PLAN (GEMINI)
// ═══════════════════════════════════════════════════════════════════════════

export async function generateExecutionPlan(task: {
  id: string;
  consultant_id: string;
  contact_id?: string | null;
  contact_phone?: string;
  contact_name?: string | null;
  ai_instruction?: string;
  task_category?: string;
  priority?: number;
}, options?: { isManual?: boolean }): Promise<DecisionResult> {
  console.log(`${LOG_PREFIX} Generating execution plan for task ${task.id}${options?.isManual ? ' (MANUAL)' : ''}`);

  const context = await buildTaskContext(task);

  const { allowed, reason } = options?.isManual
    ? await canExecuteManually(task.consultant_id)
    : await canExecuteAutonomously(task.consultant_id);
  if (!allowed) {
    console.log(`${LOG_PREFIX} Autonomous execution blocked: ${reason}`);
    await logActivity(task.consultant_id, {
      event_type: "autonomy_blocked",
      title: "Esecuzione autonoma bloccata",
      description: reason,
      icon: "🚫",
      severity: "warning",
      task_id: task.id,
      contact_name: task.contact_name,
      contact_id: task.contact_id,
    });
    return {
      should_execute: false,
      reasoning: reason!,
      confidence: 1.0,
      execution_plan: [],
      estimated_duration_minutes: 0,
    };
  }

  const channelsEnabled = context.autonomy_settings.channels_enabled;
  const channelsList = Object.entries(channelsEnabled)
    .filter(([, v]) => v)
    .map(([k]) => k)
    .join(", ");

  const prompt = `Sei un assistente intelligente di un consulente finanziario. Agisci come un dipendente esperto e affidabile.

CONTESTO TASK:
- ID Task: ${task.id}
- Categoria: ${task.task_category || "generico"}
- Priorità: ${task.priority ?? 3}/5
- Istruzione AI: "${task.ai_instruction || "Nessuna istruzione specifica"}"

CONTATTO:
- Nome: ${task.contact_name || context.contact?.name || "Sconosciuto"}
- Telefono: ${task.contact_phone || context.contact?.phone || "N/A"}
- Email: ${context.contact?.email || "N/A"}
- Ruolo: ${context.contact?.role || "N/A"}

CANALI ABILITATI: ${channelsList || "nessuno"}

LIMITI GIORNALIERI RIMANENTI:
- Chiamate: ${context.autonomy_settings.max_daily_calls - context.daily_counts.calls} rimanenti
- Email: ${context.autonomy_settings.max_daily_emails - context.daily_counts.emails} rimanenti
- WhatsApp: ${context.autonomy_settings.max_daily_whatsapp - context.daily_counts.whatsapp} rimanenti
- Analisi: ${context.autonomy_settings.max_daily_analyses - context.daily_counts.analyses} rimanenti

ISTRUZIONI PERSONALIZZATE DEL CONSULENTE:
${context.autonomy_settings.custom_instructions || "Nessuna istruzione personalizzata"}

TASK RECENTI PER QUESTO CONTATTO:
${context.recent_tasks.length > 0 ? context.recent_tasks.map(t => `- [${t.status}] ${t.task_category}: "${t.ai_instruction}" (${t.scheduled_at})`).join("\n") : "Nessun task recente"}

ATTIVITA' RECENTI:
${context.recent_activity.length > 0 ? context.recent_activity.slice(0, 5).map(a => `- ${a.event_type}: ${a.title} (${a.created_at})`).join("\n") : "Nessuna attività recente"}

ANALIZZA l'istruzione del task e decidi la migliore sequenza di azioni per portarlo a termine.

Le azioni disponibili sono:
- "fetch_client_data": Recupera dati aggiuntivi sul cliente
- "analyze_patterns": Analizza pattern e storico interazioni
- "generate_report": Genera un report o analisi
- "prepare_call": Prepara script e contesto per una chiamata
- "voice_call": Effettua una chiamata vocale
- "send_email": Invia un'email
- "send_whatsapp": Invia un messaggio WhatsApp
- "web_search": Cerca informazioni aggiornate su internet (normative, mercati, notizie, trend finanziari)

REGOLE:
1. Usa SOLO i canali abilitati (${channelsList || "nessuno"})
2. Non superare i limiti giornalieri rimanenti
3. Se non ci sono canali abilitati per l'azione richiesta, imposta should_execute a false
4. Assegna un punteggio di confidenza tra 0.0 e 1.0
5. Stima la durata in minuti
6. Evita azioni duplicate o ridondanti rispetto ai task recenti

Rispondi ESCLUSIVAMENTE con un JSON valido (senza markdown, senza backtick):
{
  "should_execute": true/false,
  "reasoning": "spiegazione dettagliata della decisione",
  "confidence": 0.0-1.0,
  "execution_plan": [
    {
      "step": 1,
      "action": "nome_azione",
      "description": "descrizione di cosa fare in questo step",
      "params": {}
    }
  ],
  "estimated_duration_minutes": numero
}`;

  try {
    const result = await withRetry(async () => {
      const apiKey = await getGeminiApiKeyForClassifier();
      if (!apiKey) throw new Error("No Gemini API key available");

      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: GEMINI_LEGACY_MODEL,
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        config: { temperature: 0.2, maxOutputTokens: 4096 },
      });

      const text = response.text;
      if (!text) throw new Error("Empty response from Gemini");

      const cleaned = text.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
      let parsed: any;
      try {
        parsed = JSON.parse(cleaned);
      } catch {
        const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          parsed = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error("Failed to parse Gemini JSON response");
        }
      }
      return parsed;
    });

    const plan: ExecutionStep[] = (result.execution_plan || []).map((step: any, idx: number) => ({
      step: step.step ?? idx + 1,
      action: step.action,
      description: step.description || "",
      status: "pending" as const,
      params: step.params || undefined,
    }));

    const decision: DecisionResult = {
      should_execute: result.should_execute ?? false,
      reasoning: result.reasoning || "Nessun ragionamento fornito",
      confidence: Math.max(0, Math.min(1, result.confidence ?? 0.5)),
      execution_plan: plan,
      estimated_duration_minutes: result.estimated_duration_minutes ?? 5,
    };

    console.log(`${LOG_PREFIX} Decision for task ${task.id}: execute=${decision.should_execute}, confidence=${decision.confidence}, steps=${decision.execution_plan.length}`);

    await logActivity(task.consultant_id, {
      event_type: "execution_plan_generated",
      title: `Piano di esecuzione generato (${decision.execution_plan.length} step)`,
      description: decision.reasoning,
      icon: "🧠",
      severity: "info",
      task_id: task.id,
      contact_name: task.contact_name,
      contact_id: task.contact_id,
      event_data: {
        should_execute: decision.should_execute,
        confidence: decision.confidence,
        steps_count: decision.execution_plan.length,
        estimated_duration: decision.estimated_duration_minutes,
      },
    });

    return decision;
  } catch (error: any) {
    console.error(`${LOG_PREFIX} Error generating execution plan for task ${task.id}:`, error.message);

    await logActivity(task.consultant_id, {
      event_type: "execution_plan_error",
      title: "Errore nella generazione del piano",
      description: error.message,
      icon: "❌",
      severity: "error",
      task_id: task.id,
      contact_name: task.contact_name,
      contact_id: task.contact_id,
    });

    return {
      should_execute: false,
      reasoning: `Errore nella generazione del piano: ${error.message}`,
      confidence: 0,
      execution_plan: [],
      estimated_duration_minutes: 0,
    };
  }
}
