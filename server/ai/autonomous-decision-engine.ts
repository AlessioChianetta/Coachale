import { GoogleGenAI } from "@google/genai";
import { getGeminiApiKeyForClassifier, GEMINI_3_MODEL, trackedGenerateContent } from "./provider-factory";
import { tokenTracker } from "./token-tracker";
import { db } from "../db";
import { sql, eq } from "drizzle-orm";
import { consultantDetailedProfiles } from "@shared/schema";
import { logActivity } from "../cron/ai-task-scheduler";
import { getRoleById, fetchAgentContext, buildAgentContextSection } from "../cron/ai-autonomous-roles";

const LOG_PREFIX = "🧠 [DECISION-ENGINE]";

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface ExecutionStep {
  step: number;
  action: "fetch_client_data" | "search_private_stores" | "analyze_patterns" | "generate_report" | "prepare_call" | "voice_call" | "send_email" | "send_whatsapp" | "web_search" | "lead_scraper_search" | "lead_qualify_and_assign";
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
  role_frequencies: Record<string, string>;
  role_autonomy_modes: Record<string, number>;
  role_working_hours: Record<string, { start: string; end: string; days: number[] }>;
  reasoning_mode: string;
  role_reasoning_modes: Record<string, string>;
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
  upcoming_calls: Array<{
    id: string;
    target_phone: string;
    scheduled_at: string;
    status: string;
    custom_prompt?: string | null;
  }>;
  role_completed_tasks?: Array<{
    id: string;
    ai_instruction: string;
    contact_name?: string | null;
    result_summary?: string | null;
    completed_at: string;
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
  role_frequencies: {},
  role_autonomy_modes: {},
  role_working_hours: {},
  reasoning_mode: 'structured',
  role_reasoning_modes: {},
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
      role_frequencies: row.role_frequencies ?? DEFAULT_AUTONOMY_SETTINGS.role_frequencies,
      role_autonomy_modes: row.role_autonomy_modes ?? DEFAULT_AUTONOMY_SETTINGS.role_autonomy_modes,
      role_working_hours: row.role_working_hours ?? DEFAULT_AUTONOMY_SETTINGS.role_working_hours,
      reasoning_mode: row.reasoning_mode ?? DEFAULT_AUTONOMY_SETTINGS.reasoning_mode,
      role_reasoning_modes: row.role_reasoning_modes ?? DEFAULT_AUTONOMY_SETTINGS.role_reasoning_modes,
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

export function isRoleWithinWorkingHours(settings: AutonomySettings, roleId: string): boolean {
  const roleHours = settings.role_working_hours?.[roleId];
  if (!roleHours || !roleHours.start || !roleHours.end) {
    return isWithinWorkingHours(settings);
  }

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

  const roleDays = roleHours.days && roleHours.days.length > 0 ? roleHours.days : settings.working_days;
  if (!roleDays.includes(currentDay)) {
    return false;
  }

  const [startH, startM] = roleHours.start.split(":").map(Number);
  const [endH, endM] = roleHours.end.split(":").map(Number);
  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;

  return currentTimeMinutes >= startMinutes && currentTimeMinutes <= endMinutes;
}

export function getTaskStatusForRole(settings: AutonomySettings, roleId: string): string {
  const roleLevel = settings.role_autonomy_modes?.[roleId];
  // If no per-role level set (null/undefined), use global level
  const effectiveLevel = (roleLevel !== undefined && roleLevel !== null) ? roleLevel : settings.autonomy_level;
  // Same logic as global: >= 4 means auto-execute, < 4 means needs approval
  return effectiveLevel >= 4 ? 'scheduled' : 'waiting_approval';
}

export function getEffectiveRoleLevel(settings: AutonomySettings, roleId: string): number {
  const roleLevel = settings.role_autonomy_modes?.[roleId];
  return (roleLevel !== undefined && roleLevel !== null) ? roleLevel : settings.autonomy_level;
}

export function canRoleAutoCall(settings: AutonomySettings, roleId: string): boolean {
  const level = getEffectiveRoleLevel(settings, roleId);
  return level >= 7;
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

export async function canExecuteAutonomously(consultantId: string, roleId?: string): Promise<{ allowed: boolean; reason?: string }> {
  const settings = await getAutonomySettings(consultantId);

  if (!settings.is_active) {
    return { allowed: false, reason: "Autonomia AI non attiva per questo consulente" };
  }

  const effectiveLevel = roleId ? getEffectiveRoleLevel(settings, roleId) : settings.autonomy_level;
  console.log(`${LOG_PREFIX} canExecuteAutonomously: roleId=${roleId || 'none'}, globalLevel=${settings.autonomy_level}, effectiveLevel=${effectiveLevel}`);
  
  if (effectiveLevel === 0) {
    return { allowed: false, reason: roleId 
      ? `${roleId} è spento (livello 0)` 
      : "Autonomia AI disattivata (livello 0)" };
  }

  if (effectiveLevel < 2) {
    return { allowed: false, reason: roleId 
      ? `Livello di autonomia di ${roleId} troppo basso (${effectiveLevel}). Richiesto almeno 2 per esecuzione automatica` 
      : `Livello di autonomia troppo basso (${effectiveLevel}). Richiesto almeno 2 per esecuzione automatica` };
  }

  const withinHours = roleId 
    ? isRoleWithinWorkingHours(settings, roleId) 
    : isWithinWorkingHours(settings);
  
  if (!withinHours) {
    return { allowed: false, reason: roleId 
      ? `Fuori dall'orario di lavoro configurato per ${roleId}` 
      : "Fuori dall'orario di lavoro configurato" };
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
}, roleId?: string): Promise<TaskContext> {
  console.log(`${LOG_PREFIX} Building context for consultant=${task.consultant_id}, contact=${task.contact_id || task.contact_phone || "N/A"}`);

  const [contactResult, recentTasksResult, recentActivityResult, upcomingCallsResult, autonomySettings, dailyCounts] = await Promise.all([
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

    db.execute(sql`
      SELECT id, target_phone, scheduled_at, status, custom_prompt
      FROM scheduled_voice_calls
      WHERE consultant_id = ${task.consultant_id}::text
        AND status IN ('scheduled', 'pending')
        AND scheduled_at > NOW()
      ORDER BY scheduled_at ASC
      LIMIT 10
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

  const upcoming_calls = (upcomingCallsResult.rows as any[]).map(r => ({
    id: r.id,
    target_phone: r.target_phone,
    scheduled_at: r.scheduled_at?.toISOString?.() ?? String(r.scheduled_at),
    status: r.status,
    custom_prompt: r.custom_prompt,
  }));

  let role_completed_tasks: TaskContext['role_completed_tasks'] = [];
  if (roleId) {
    try {
      const completedResult = await db.execute(sql`
        SELECT id, ai_instruction, contact_name, result_summary, 
               to_char(completed_at AT TIME ZONE 'Europe/Rome', 'DD/MM/YYYY HH24:MI') as completed_at
        FROM ai_scheduled_tasks
        WHERE consultant_id::text = ${task.consultant_id}::text AND ai_role = ${roleId}
          AND status = 'completed' AND completed_at > NOW() - INTERVAL '7 days'
        ORDER BY completed_at DESC LIMIT 10
      `);
      role_completed_tasks = (completedResult.rows as any[]).map(r => ({
        id: r.id,
        ai_instruction: r.ai_instruction?.substring(0, 150) || '',
        contact_name: r.contact_name,
        result_summary: r.result_summary?.substring(0, 200) || null,
        completed_at: r.completed_at,
      }));
    } catch (err: any) {
      console.warn(`${LOG_PREFIX} Failed to load role completed tasks: ${err.message}`);
    }
  }

  console.log(`${LOG_PREFIX} Context built: contact=${contact?.name || contact?.phone || "none"}, tasks=${recent_tasks.length}, activities=${recent_activity.length}, upcoming_calls=${upcoming_calls.length}, role_completed=${role_completed_tasks.length}`);

  return {
    contact,
    recent_tasks,
    recent_activity,
    upcoming_calls,
    role_completed_tasks,
    autonomy_settings: autonomySettings,
    daily_counts: dailyCounts,
  };
}

function buildDetailedProfileSection(dp: any): string {
  if (!dp) return '';

  const fields: Array<{ label: string; key: string }> = [
    { label: 'Titolo', key: 'professionalTitle' },
    { label: 'Tagline', key: 'tagline' },
    { label: 'Bio', key: 'bio' },
    { label: 'Anni di esperienza', key: 'yearsOfExperience' },
    { label: 'Certificazioni', key: 'certifications' },
    { label: 'Formazione', key: 'education' },
    { label: 'Lingue parlate', key: 'languagesSpoken' },
    { label: 'Business', key: 'businessName' },
    { label: 'Tipo business', key: 'businessType' },
    { label: 'P.IVA', key: 'vatNumber' },
    { label: 'Indirizzo', key: 'businessAddress' },
    { label: 'Sito web', key: 'websiteUrl' },
    { label: 'LinkedIn', key: 'linkedinUrl' },
    { label: 'Instagram', key: 'instagramUrl' },
    { label: 'Servizi', key: 'servicesOffered' },
    { label: 'Specializzazioni', key: 'specializations' },
    { label: 'Metodologia', key: 'methodology' },
    { label: 'Strumenti', key: 'toolsUsed' },
    { label: 'Cliente ideale', key: 'idealClientDescription' },
    { label: 'Settori', key: 'industriesServed' },
    { label: 'Fascia età clienti', key: 'clientAgeRange' },
    { label: 'Focus geografico', key: 'geographicFocus' },
    { label: 'Stile consulenza', key: 'consultationStyle' },
    { label: 'Processo iniziale', key: 'initialProcess' },
    { label: 'Durata sessione', key: 'sessionDuration' },
    { label: 'Approccio follow-up', key: 'followUpApproach' },
    { label: 'Valori', key: 'coreValues' },
    { label: 'Mission', key: 'missionStatement' },
    { label: 'Vision', key: 'visionStatement' },
    { label: 'USP', key: 'uniqueSellingProposition' },
    { label: '⚙️ Tono di voce', key: 'toneOfVoice' },
    { label: '📝 Contesto aggiuntivo', key: 'additionalContext' },
    { label: '🚫 Argomenti da evitare', key: 'topicsToAvoid' },
  ];

  const lines: string[] = [];
  for (const f of fields) {
    const val = dp[f.key];
    if (val !== null && val !== undefined && val !== '') {
      const strVal = typeof val === 'object' ? JSON.stringify(val) : String(val);
      if (strVal.trim()) {
        lines.push(`${f.label}: ${strVal}`);
      }
    }
  }

  if (lines.length === 0) return '';

  return `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 PROFILO DETTAGLIATO DEL CONSULENTE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${lines.join('\n')}
`;
}

export async function buildRolePersonality(consultantId: string, roleId: string): Promise<string | null> {
  try {
    const role = getRoleById(roleId);
    if (!role) {
      console.log(`${LOG_PREFIX} Role ${roleId} not found, using generic personality`);
      return null;
    }

    const settingsResult = await db.execute(sql`
      SELECT consultant_phone, consultant_whatsapp, consultant_email, custom_instructions
      FROM ai_autonomy_settings
      WHERE consultant_id::text = ${consultantId}::text LIMIT 1
    `);
    const settingsRow = settingsResult.rows[0] as any;

    const agentCtx = await fetchAgentContext(consultantId, roleId);
    const ctxSection = buildAgentContextSection(agentCtx, role.name);

    let personality = `Sei ${role.name} (${role.displayName}). ${role.description}\n`;
    personality += `Il tuo stile: ${role.shortDescription}\n\n`;
    
    if (settingsRow) {
      personality += `CONTATTI DIRETTI DEL CONSULENTE (per raggiungerlo personalmente):\n`;
      personality += `Telefono: ${settingsRow.consultant_phone || 'Non configurato'}\n`;
      personality += `Email: ${settingsRow.consultant_email || 'Non configurato'}\n`;
      personality += `WhatsApp: ${settingsRow.consultant_whatsapp || 'Non configurato'}\n\n`;
      
      if (settingsRow.custom_instructions) {
        personality += `ISTRUZIONI PERSONALIZZATE DEL CONSULENTE:\n${settingsRow.custom_instructions}\n\n`;
      }
    }

    if (ctxSection) {
      personality += ctxSection + '\n\n';
    }

    try {
      const detailedProfileResult = await db.select().from(consultantDetailedProfiles).where(eq(consultantDetailedProfiles.consultantId, consultantId));
      const dp = detailedProfileResult[0];
      const profileSection = buildDetailedProfileSection(dp);
      if (profileSection) {
        personality += profileSection + '\n';
        console.log(`${LOG_PREFIX} Added detailed profile to personality (${profileSection.length} chars)`);
      }
    } catch (dpErr: any) {
      console.warn(`${LOG_PREFIX} Failed to load detailed profile: ${dpErr.message}`);
    }

    console.log(`${LOG_PREFIX} Built personality for ${role.name} (${roleId}), length=${personality.length}`);
    return personality;
  } catch (err: any) {
    console.warn(`${LOG_PREFIX} Failed to build role personality for ${roleId}: ${err.message}`);
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// PARSE HUNTER INSTRUCTION
// ═══════════════════════════════════════════════════════════════════════════

function parseHunterInstruction(instruction: string): { query: string; engine: string; location: string; limit: number } {
  const queryMatch = instruction.match(/QUERY:\s*(.+)/i);
  const engineMatch = instruction.match(/ENGINE:\s*(maps|search)/i);
  const locationMatch = instruction.match(/LOCATION:\s*(.+)/i);
  const limitMatch = instruction.match(/LIMIT:\s*(\d+)/i);

  return {
    query: queryMatch?.[1]?.trim() || 'ricerca lead',
    engine: engineMatch?.[1]?.trim().toLowerCase() || 'maps',
    location: locationMatch?.[1]?.trim() || 'Italia',
    limit: limitMatch ? parseInt(limitMatch[1], 10) : 10,
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
  preferred_channel?: string | null;
  tone?: string | null;
  urgency?: string | null;
  scheduled_datetime?: string | null;
  objective?: string | null;
  additional_context?: string | null;
  voice_template_suggestion?: string | null;
  language?: string | null;
}, options?: { isManual?: boolean; skipGuardrails?: boolean; roleId?: string }): Promise<DecisionResult> {
  console.log(`${LOG_PREFIX} Generating execution plan for task ${task.id}${options?.isManual ? ' (MANUAL)' : ''}${options?.skipGuardrails ? ' (SKIP_GUARDRAILS)' : ''} roleId=${options?.roleId || 'none'}`);

  if (options?.roleId === 'hunter' && task.preferred_channel === 'lead_scraper' && task.task_category === 'prospecting') {
    console.log(`${LOG_PREFIX} [HUNTER-PIPELINE] Auto-generating 2-step execution plan for Hunter task ${task.id}`);

    const searchParams = parseHunterInstruction(task.ai_instruction || '');

    const hunterPlan: DecisionResult = {
      should_execute: true,
      reasoning: `Hunter pipeline automatica: Step 1 — ricerca "${searchParams.query}" su ${searchParams.engine} in ${searchParams.location} (limit ${searchParams.limit}). Step 2 — qualifica AI dei risultati e assegnazione ai dipendenti (Alessia/Stella/Millie) in base ai canali disponibili.`,
      confidence: 0.9,
      execution_plan: [
        {
          step: 1,
          action: "lead_scraper_search",
          description: `Ricerca lead: "${searchParams.query}" su ${searchParams.engine} in ${searchParams.location}`,
          status: "pending",
          params: {
            query: searchParams.query,
            searchEngine: searchParams.engine,
            location: searchParams.location,
            limit: searchParams.limit,
          },
        },
        {
          step: 2,
          action: "lead_qualify_and_assign",
          description: `Qualifica lead trovati (score >= soglia) e assegna ai dipendenti AI per outreach`,
          status: "pending",
          params: {
            source: "hunter_pipeline",
          },
        },
      ],
      estimated_duration_minutes: 5,
    };

    await logActivity(task.consultant_id, {
      event_type: "execution_plan_generated",
      title: `Piano Hunter 2-step generato (ricerca + qualifica)`,
      description: hunterPlan.reasoning,
      icon: "🎯",
      severity: "info",
      task_id: task.id,
      contact_name: task.contact_name,
      contact_id: task.contact_id,
      event_data: {
        should_execute: true,
        confidence: 0.9,
        steps_count: 2,
        estimated_duration: 5,
        search_query: searchParams.query,
        search_engine: searchParams.engine,
        search_location: searchParams.location,
      },
    });

    return hunterPlan;
  }

  const context = await buildTaskContext(task, options?.roleId);

  let allowed = true;
  let reason: string | undefined;
  
  if (options?.skipGuardrails) {
    console.log(`${LOG_PREFIX} skip_guardrails=true → using canExecuteManually (no working hours/autonomy check)`);
    const check = await canExecuteManually(task.consultant_id);
    allowed = check.allowed;
    reason = check.reason;
  } else if (options?.isManual) {
    const check = await canExecuteManually(task.consultant_id);
    allowed = check.allowed;
    reason = check.reason;
  } else {
    const check = await canExecuteAutonomously(task.consultant_id, options?.roleId);
    allowed = check.allowed;
    reason = check.reason;
  }
  
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

  let rolePersonality: string | null = null;
  if (options?.roleId) {
    rolePersonality = await buildRolePersonality(task.consultant_id, options.roleId);
  }

  const identityBlock = rolePersonality 
    ? `${rolePersonality}\nADATTA il tuo piano d'azione al settore reale del cliente basandoti sull'istruzione del task e sui dati disponibili.`
    : `Sei un assistente intelligente di un consulente. Agisci come un dipendente esperto e affidabile. NON assumere che il consulente lavori in un settore specifico (finanziario, legale, etc.) — il settore lo devi capire ESCLUSIVAMENTE dall'istruzione del task, dal nome del contatto e dai dati disponibili. Adatta il tuo ragionamento e il tuo piano d'azione al settore reale del cliente.`;

  const nowRome = new Date().toLocaleString('it-IT', { 
    timeZone: 'Europe/Rome', 
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
  const todayISO = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Rome' });

  const prompt = `${identityBlock}

DATA E ORA CORRENTE: ${nowRome} (Europe/Rome)
DATA ODIERNA ISO: ${todayISO}
REGOLA CRITICA SULLE DATE: TUTTE le date che proponi (preferred_date, chiamate, appuntamenti) DEVONO essere UGUALI o SUCCESSIVE a ${todayISO}. NON proporre MAI date nel passato.

CONTESTO TASK:
- ID Task: ${task.id}
- Categoria: ${task.task_category || "generico"}
- Priorità: ${task.priority ?? 3}/5
- Istruzione AI: "${task.ai_instruction || "Nessuna istruzione specifica"}"
- Canale preferito: ${task.preferred_channel || "nessuno"}
- Tono richiesto: ${task.tone || "professionale"}
- Urgenza: ${task.urgency || "normale"}
- Obiettivo: ${task.objective || "informare"}
- Lingua: ${task.language || "it"}
${task.additional_context ? `- Contesto aggiuntivo: "${task.additional_context}"` : ""}
${task.voice_template_suggestion ? `- Template vocale suggerito: ${task.voice_template_suggestion}` : ""}
${task.scheduled_datetime ? `- Data/ora programmata: ${task.scheduled_datetime}` : ""}

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

${context.role_completed_tasks && context.role_completed_tasks.length > 0 ? `I TUOI TASK GIA' COMPLETATI (cose che HAI GIA' FATTO — NON ripeterle inutilmente):
${context.role_completed_tasks.map(t => `- [✅ ${t.completed_at}] ${t.contact_name ? `(${t.contact_name}) ` : ''}${t.ai_instruction}${t.result_summary ? ` → ${t.result_summary}` : ''}`).join("\n")}
REGOLA: NON duplicare task identici a quelli già completati sopra. Se un'azione è già stata fatta, non riprogrammarla.` : ''}

ATTIVITA' RECENTI:
${context.recent_activity.length > 0 ? context.recent_activity.slice(0, 5).map(a => `- ${a.event_type}: ${a.title} (${a.created_at})`).join("\n") : "Nessuna attività recente"}

CHIAMATE GIÀ PROGRAMMATE (NON sovrapporre nuove chiamate a questi orari):
${context.upcoming_calls.length > 0 ? context.upcoming_calls.map(c => `- ${c.scheduled_at}: ${c.target_phone} [${c.status}]`).join('\n') : 'Nessuna chiamata programmata'}

ANALIZZA l'istruzione del task e decidi la migliore sequenza di azioni per portarlo a termine.

Le azioni disponibili si dividono in due categorie:

AZIONI INTERNE (sempre disponibili, non richiedono canali di comunicazione):
- "fetch_client_data": Recupera dati aggiuntivi sul cliente dal database
- "search_private_stores": Cerca nei documenti privati del cliente e del consulente (consulenze, esercizi, knowledge base, libreria) usando ricerca semantica AI
- "analyze_patterns": Analizza pattern e storico interazioni
- "generate_report": Genera un report scritto dettagliato. HAI PIENA LIBERTÀ DI DECIDERE LA STRUTTURA DEL REPORT. Analizza l'obiettivo del task e crea le sezioni più appropriate. La struttura predefinita (Panoramica Cliente, Analisi Situazione, Punti di Forza/Debolezza, Pattern, Rischio, Piano d'Azione, Prossimi Passi) è solo un SUGGERIMENTO, NON un obbligo. Usa il parametro "custom_sections" (array di titoli sezione) per definire la TUA struttura ideale. Esempi: per un task "preparazione incontro" potresti usare ["Agenda Proposta", "Punti da Discutere", "Obiettivi dell'Incontro", "Materiale da Preparare"]. Per un task "analisi investimenti" potresti usare ["Portafoglio Attuale", "Opportunità di Mercato", "Analisi Rischio/Rendimento", "Strategia Consigliata"]. Sii creativo e specifico per l'obiettivo del task.
- "web_search": Cerca informazioni aggiornate su internet su un ARGOMENTO SPECIFICO. Specifica sempre il parametro "search_topic" con l'argomento preciso da ricercare (es. "strategie marketing massoterapia sportiva", "normative fiscali partita IVA 2026"). NON fare ricerche generiche.

AZIONI DI COMUNICAZIONE (richiedono canale abilitato E contatto valido):
- "prepare_call": Prepara script e contesto per una chiamata E decide l'orario migliore per effettuarla. Specifica il parametro "preferred_time" (formato HH:MM) e "preferred_date" (formato YYYY-MM-DD). IMPORTANTE: Se la preparazione è per una consulenza futura, preferred_date DEVE essere PRIMA della data della consulenza (idealmente 1-2 giorni prima). NON programmare preparazioni dopo la data dell'evento.
- "voice_call": Effettua una chiamata vocale. L'AI decide autonomamente il contenuto della chiamata in base alla situazione: può spiegare, dare consigli, far fare azioni al cliente, etc. La chiamata è flessibile e adattata al contesto.
- "send_email": Invia un'email al cliente. Scrivi un messaggio BREVE e professionale. Se è disponibile un report, viene allegato come PDF. Specifica parametro "subject" per l'oggetto e "message_summary" per il contenuto (max 3-4 frasi).
- "send_whatsapp": Invia un messaggio WhatsApp al cliente. Scrivi un messaggio BREVE (max 2-3 frasi). Se è disponibile un report, viene allegato il PDF. Specifica parametro "message_summary".

REGOLE:
1. Le azioni INTERNE sono SEMPRE disponibili indipendentemente dai canali abilitati
2. Le azioni di COMUNICAZIONE richiedono sia il canale abilitato (${channelsList || "nessuno"}) sia i dati di contatto validi (telefono/email)
3. Se il contatto è "Sconosciuto" o non ha dati di contatto validi (telefono N/A, email N/A), NON usare azioni di comunicazione
4. Per task di tipo "analysis" o che richiedono report/analisi, PREFERISCI le azioni interne (fetch_client_data, analyze_patterns, generate_report, web_search)
5. Non superare i limiti giornalieri rimanenti
6. Assegna un punteggio di confidenza tra 0.0 e 1.0
7. Stima la durata in minuti
8. Evita azioni duplicate o ridondanti rispetto ai task recenti
9. Se l'istruzione chiede esplicitamente un report o un'analisi, genera il report come documento scritto tramite generate_report, NON tramite chiamata
10. Per task che riguardano un contatto specifico, USA SEMPRE "search_private_stores" dopo "fetch_client_data" per arricchire il contesto con documenti privati (consulenze, esercizi, KB)
11. Per web_search, specifica SEMPRE un "search_topic" specifico nel params - non usare l'istruzione generica del task
12. Per prepare_call, specifica SEMPRE "preferred_time" e "preferred_date" nel params
13. Per send_email e send_whatsapp, specifica "subject" (solo email) e "message_summary" nel params - i messaggi devono essere BREVI, il dettaglio è nel PDF allegato
14. Per prepare_call, CONTROLLA le chiamate già programmate e scegli un orario che NON si sovrapponga (almeno 30 minuti di distanza)
15. REGOLA CRITICA TEMPORALE: Quando crei task di preparazione per una consulenza futura, il task DEVE essere programmato PRIMA della data della consulenza, idealmente 1-2 giorni prima. NON ha senso preparare una consulenza DOPO che è già avvenuta. Controlla le date in 'CONSULENZE IN PROGRAMMA' e assicurati che preferred_date sia ANTERIORE alla data della consulenza.

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
    const taskConsultantId = task.consultant_id;
    console.log(`${LOG_PREFIX} [PLAN-GEN] Starting plan generation for task=${task.id}, consultant=${taskConsultantId}, instruction="${(task.ai_instruction || '').substring(0, 80)}..."`);
    
    const result = await withRetry(async () => {
      const apiKey = await getGeminiApiKeyForClassifier();
      if (!apiKey) throw new Error("No Gemini API key available");
      console.log(`${LOG_PREFIX} [PLAN-GEN] API key obtained, calling Gemini for task=${task.id}`);

      const ai = new GoogleGenAI({ apiKey });
      const response = await trackedGenerateContent(ai, {
        model: GEMINI_3_MODEL,
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        config: { temperature: 0.2, maxOutputTokens: 4096 },
      }, { consultantId: taskConsultantId, feature: 'decision-engine', keySource: 'classifier' });

      const text = response.text;
      console.log(`${LOG_PREFIX} [PLAN-GEN] Gemini responded for task=${task.id}, response length=${text?.length || 0}`);
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

    console.log(`${LOG_PREFIX} [PLAN-GEN] ✅ Decision for task ${task.id}: execute=${decision.should_execute}, confidence=${decision.confidence}, steps=${decision.execution_plan.length}, reasoning="${decision.reasoning.substring(0, 100)}..."`);

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
