import { GoogleGenAI } from "@google/genai";
import { db } from "../db";
import { sql } from "drizzle-orm";

const MAX_BULK_TASKS = 3;
const MAX_CREATE_TASKS = 2;
const SUPERVISOR_TIMEOUT_MS = 8000;
const VALID_PRIORITIES = ['low', 'medium', 'high', 'urgent'];
const VALID_CATEGORIES = ['reminder', 'follow_up', 'outreach', 'content', 'admin', 'meeting', 'call', 'email', 'social', 'other'];

export interface SupervisorParams {
  consultantId: string;
  roleId: string;
  userMessage: string;
  aiResponse: string;
  recentMessages: { sender: string; message: string }[];
  activeTasks: {
    id: string;
    ai_instruction: string;
    status: string;
    contact_name?: string;
    task_category?: string;
    scheduled_at?: string;
    priority?: string;
  }[];
}

export interface SupervisorResult {
  confirmation: string | null;
  actionsExecuted: number;
}

function isValidDate(dateStr: string): boolean {
  const d = new Date(dateStr);
  return !isNaN(d.getTime()) && d.getFullYear() > 2020 && d.getFullYear() < 2040;
}

function buildSupervisorPrompt(params: SupervisorParams): string {
  const taskList = params.activeTasks.length > 0
    ? params.activeTasks.map(t =>
      `- ID: ${t.id} | "${t.ai_instruction?.substring(0, 100)}" | stato: ${t.status}${t.contact_name ? ` | contatto: ${t.contact_name}` : ''}${t.scheduled_at ? ` | schedulato: ${new Date(t.scheduled_at).toLocaleString('it-IT', { timeZone: 'Europe/Rome' })}` : ''}`
    ).join('\n')
    : 'Nessun task attivo.';

  const recentChat = params.recentMessages.slice(-20).map(m =>
    `${m.sender === 'consultant' ? 'UTENTE' : 'DIPENDENTE'}: ${m.message.substring(0, 300)}`
  ).join('\n');

  return `Sei un supervisor che analizza conversazioni tra un consulente (UTENTE) e il suo dipendente AI (DIPENDENTE).
Il tuo compito è capire se l'utente vuole eseguire un'azione sui task.

TASK ATTIVI:
${taskList}

CONVERSAZIONE RECENTE:
${recentChat}

ULTIMO MESSAGGIO UTENTE: ${params.userMessage}
RISPOSTA DIPENDENTE: ${params.aiResponse.substring(0, 500)}

REGOLE IMPORTANTI:
1. Se l'utente NON sta chiaramente parlando di task o azioni sui task, rispondi SEMPRE con {"action":"no_action"}
2. Se l'intento è ambiguo o non è chiaro quale task, rispondi con {"action":"needs_clarification","question":"..."}
3. Per operazioni su task esistenti, usa SOLO gli ID dalla lista task sopra — NON inventare ID
4. Max ${MAX_BULK_TASKS} task per operazione
5. Max ${MAX_CREATE_TASKS} task creati per volta
6. Conferme generiche ("sì", "ok", "vai") sono valide SOLO se il dipendente ha ESPLICITAMENTE proposto un'azione specifica nel messaggio precedente
7. Frasi come "l'ho fatta", "fatto", "ci ho pensato io" significano completamento — identifica il task dal contesto
8. Se hai dubbi, usa "no_action" — meglio non agire che agire sbagliato
9. Per scheduledAt usa SEMPRE formato ISO 8601 (es: "2026-03-15T10:00:00+01:00")
10. Per priority usa SOLO: low, medium, high, urgent
11. Per category usa SOLO: reminder, follow_up, outreach, content, admin, meeting, call, email, social, other

Rispondi SOLO con un JSON valido.`;
}

const SUPERVISOR_SCHEMA = {
  type: "OBJECT" as const,
  properties: {
    action: {
      type: "STRING" as const,
      enum: ["no_action", "approve_task", "reject_task", "complete_task", "execute_now", "create_task", "modify_task", "schedule_task", "needs_clarification"],
    },
    taskIds: {
      type: "ARRAY" as const,
      items: { type: "STRING" as const },
    },
    reason: {
      type: "STRING" as const,
    },
    question: {
      type: "STRING" as const,
    },
    tasks: {
      type: "ARRAY" as const,
      items: {
        type: "OBJECT" as const,
        properties: {
          instruction: { type: "STRING" as const },
          contactName: { type: "STRING" as const },
          channel: { type: "STRING" as const },
          scheduledAt: { type: "STRING" as const },
          category: { type: "STRING" as const },
        },
        required: ["instruction"],
      },
    },
    taskId: {
      type: "STRING" as const,
    },
    changes: {
      type: "OBJECT" as const,
      properties: {
        scheduledAt: { type: "STRING" as const },
        instruction: { type: "STRING" as const },
        priority: { type: "STRING" as const },
      },
    },
    scheduledAt: {
      type: "STRING" as const,
    },
  },
  required: ["action"],
};

function validateAction(parsed: any, activeTasks: SupervisorParams['activeTasks']): boolean {
  if (!parsed || !parsed.action) return false;
  const validActions = ['no_action', 'approve_task', 'reject_task', 'complete_task', 'execute_now', 'create_task', 'modify_task', 'schedule_task', 'needs_clarification'];
  if (!validActions.includes(parsed.action)) return false;

  if (['approve_task', 'reject_task', 'complete_task', 'execute_now'].includes(parsed.action)) {
    if (!Array.isArray(parsed.taskIds) || parsed.taskIds.length === 0) return false;
    const validIds = new Set(activeTasks.map(t => t.id));
    if (!parsed.taskIds.every((id: string) => validIds.has(id))) return false;
  }

  if (parsed.action === 'create_task') {
    if (!Array.isArray(parsed.tasks) || parsed.tasks.length === 0) return false;
    if (!parsed.tasks.every((t: any) => t && typeof t.instruction === 'string' && t.instruction.length > 0)) return false;
  }

  if (parsed.action === 'modify_task' || parsed.action === 'schedule_task') {
    if (!parsed.taskId) return false;
    const validIds = new Set(activeTasks.map(t => t.id));
    if (!validIds.has(parsed.taskId)) return false;
  }

  if (parsed.action === 'schedule_task' && parsed.scheduledAt) {
    if (!isValidDate(parsed.scheduledAt)) return false;
  }

  if (parsed.action === 'modify_task' && parsed.changes) {
    if (parsed.changes.scheduledAt && !isValidDate(parsed.changes.scheduledAt)) return false;
    if (parsed.changes.priority && !VALID_PRIORITIES.includes(parsed.changes.priority)) return false;
  }

  if (parsed.action === 'create_task' && parsed.tasks) {
    for (const t of parsed.tasks) {
      if (t.category && !VALID_CATEGORIES.includes(t.category)) t.category = 'reminder';
      if (t.scheduledAt && !isValidDate(t.scheduledAt)) delete t.scheduledAt;
    }
  }

  return true;
}

async function executeAction(
  action: any,
  consultantId: string,
  roleId: string,
): Promise<string | null> {
  try {
    switch (action.action) {
      case 'no_action':
        return null;

      case 'needs_clarification':
        if (action.question && typeof action.question === 'string' && action.question.length > 0) {
          return `\n\n${action.question}`;
        }
        return null;

      case 'approve_task': {
        const ids = (action.taskIds || []).slice(0, MAX_BULK_TASKS);
        if (ids.length === 0) return null;
        const approved: string[] = [];
        for (const taskId of ids) {
          const check = await db.execute(sql`
            SELECT id, ai_instruction FROM ai_scheduled_tasks
            WHERE id = ${taskId} AND consultant_id = ${consultantId}
              AND status IN ('waiting_approval', 'scheduled', 'draft', 'paused')
            LIMIT 1
          `);
          if ((check.rows[0] as any)?.id) {
            await db.execute(sql`
              UPDATE ai_scheduled_tasks
              SET status = 'scheduled', scheduled_at = NOW(), updated_at = NOW(),
                  result_data = COALESCE(result_data, '{}'::jsonb) || '{"chat_approved": true, "skip_guardrails": true}'::jsonb
              WHERE id = ${taskId} AND consultant_id = ${consultantId}
            `);
            const instr = (check.rows[0] as any).ai_instruction?.substring(0, 60) || taskId;
            approved.push(instr);
            console.log(`🚀 [SUPERVISOR] Task ${taskId} approved via chat by ${roleId}`);
          }
        }
        if (approved.length === 0) return null;
        const extra = (action.taskIds || []).length > MAX_BULK_TASKS
          ? ` (primi ${MAX_BULK_TASKS} — vuoi che proceda con gli altri?)`
          : '';
        return `\n\n---\n✅ Task approvato: "${approved[0]}"${approved.length > 1 ? ` (+${approved.length - 1} altri)` : ''}${extra}`;
      }

      case 'reject_task': {
        const ids = (action.taskIds || []).slice(0, MAX_BULK_TASKS);
        if (ids.length === 0) return null;
        const rejected: string[] = [];
        for (const taskId of ids) {
          const check = await db.execute(sql`
            SELECT id, ai_instruction FROM ai_scheduled_tasks
            WHERE id = ${taskId} AND consultant_id = ${consultantId}
              AND status IN ('waiting_approval', 'scheduled', 'draft', 'paused', 'approved')
            LIMIT 1
          `);
          if ((check.rows[0] as any)?.id) {
            await db.execute(sql`
              UPDATE ai_scheduled_tasks
              SET status = 'rejected', updated_at = NOW(),
                  result_summary = COALESCE(result_summary, '') || E'\n[Rifiutato via chat]'
              WHERE id = ${taskId} AND consultant_id = ${consultantId}
            `);
            const instr = (check.rows[0] as any).ai_instruction?.substring(0, 60) || taskId;
            rejected.push(instr);
            console.log(`❌ [SUPERVISOR] Task ${taskId} rejected via chat by ${roleId}`);
          }
        }
        if (rejected.length === 0) return null;
        return `\n\n---\n❌ Task rifiutato: "${rejected[0]}"${rejected.length > 1 ? ` (+${rejected.length - 1} altri)` : ''}`;
      }

      case 'complete_task': {
        const ids = (action.taskIds || []).slice(0, MAX_BULK_TASKS);
        if (ids.length === 0) return null;
        const completed: string[] = [];
        for (const taskId of ids) {
          const check = await db.execute(sql`
            SELECT id, ai_instruction FROM ai_scheduled_tasks
            WHERE id = ${taskId} AND consultant_id = ${consultantId}
              AND status IN ('scheduled', 'draft', 'waiting_approval', 'paused', 'approved', 'in_progress')
            LIMIT 1
          `);
          if ((check.rows[0] as any)?.id) {
            await db.execute(sql`
              UPDATE ai_scheduled_tasks
              SET status = 'completed', completed_at = NOW(), updated_at = NOW(),
                  result_summary = COALESCE(result_summary, '') || E'\n[Completato manualmente dal consulente via chat]'
              WHERE id = ${taskId} AND consultant_id = ${consultantId}
            `);
            const instr = (check.rows[0] as any).ai_instruction?.substring(0, 60) || taskId;
            completed.push(instr);
            console.log(`✅ [SUPERVISOR] Task ${taskId} completed via chat by ${roleId}`);
          }
        }
        if (completed.length === 0) return null;
        return `\n\n---\n✅ Task completato: "${completed[0]}"${completed.length > 1 ? ` (+${completed.length - 1} altri)` : ''}`;
      }

      case 'execute_now': {
        const ids = (action.taskIds || []).slice(0, MAX_BULK_TASKS);
        if (ids.length === 0) return null;
        const executed: string[] = [];
        for (const taskId of ids) {
          const check = await db.execute(sql`
            SELECT id, ai_instruction FROM ai_scheduled_tasks
            WHERE id = ${taskId} AND consultant_id = ${consultantId}
              AND status IN ('approved', 'waiting_approval', 'scheduled', 'draft', 'paused')
            LIMIT 1
          `);
          if ((check.rows[0] as any)?.id) {
            await db.execute(sql`
              UPDATE ai_scheduled_tasks
              SET status = 'scheduled', scheduled_at = NOW(), updated_at = NOW(),
                  result_data = COALESCE(result_data, '{}'::jsonb) || '{"chat_approved": true, "skip_guardrails": true}'::jsonb
              WHERE id = ${taskId} AND consultant_id = ${consultantId}
            `);
            const instr = (check.rows[0] as any).ai_instruction?.substring(0, 60) || taskId;
            executed.push(instr);
            console.log(`🚀 [SUPERVISOR] Task ${taskId} executed now via chat by ${roleId}`);
          }
        }
        if (executed.length === 0) return null;
        return `\n\n---\n🚀 Task avviato: "${executed[0]}"${executed.length > 1 ? ` (+${executed.length - 1} altri)` : ''}`;
      }

      case 'create_task': {
        const tasksToCreate = (action.tasks || []).slice(0, MAX_CREATE_TASKS);
        if (tasksToCreate.length === 0) return null;
        const created: string[] = [];
        for (const task of tasksToCreate) {
          if (!task.instruction) continue;
          const category = (task.category && VALID_CATEGORIES.includes(task.category)) ? task.category : 'reminder';
          try {
            await db.execute(sql`
              INSERT INTO ai_scheduled_tasks (
                consultant_id, ai_role, ai_instruction, task_category,
                contact_name, status, priority, task_type, created_at, updated_at
              ) VALUES (
                ${consultantId}::uuid, ${roleId}, ${task.instruction},
                ${category}, ${task.contactName || null},
                'waiting_approval', 'medium', 'ai_task', NOW(), NOW()
              )
            `);
            created.push(task.instruction.substring(0, 60));
            console.log(`📝 [SUPERVISOR] Task created via chat: "${task.instruction.substring(0, 60)}" by ${roleId}`);
          } catch (err: any) {
            console.error(`❌ [SUPERVISOR] Error creating task:`, err.message);
          }
        }
        if (created.length === 0) return null;
        const extra = (action.tasks || []).length > MAX_CREATE_TASKS
          ? ` (creati ${MAX_CREATE_TASKS} — vuoi che crei anche gli altri?)`
          : '';
        return `\n\n---\n📝 Task creato: "${created[0]}"${created.length > 1 ? ` (+${created.length - 1} altri)` : ''}${extra}`;
      }

      case 'modify_task': {
        const taskId = action.taskId;
        if (!taskId || !action.changes) return null;
        const check = await db.execute(sql`
          SELECT id, ai_instruction FROM ai_scheduled_tasks
          WHERE id = ${taskId} AND consultant_id = ${consultantId}
          LIMIT 1
        `);
        if (!(check.rows[0] as any)?.id) return null;

        const updates: string[] = [];
        if (action.changes.instruction) {
          await db.execute(sql`
            UPDATE ai_scheduled_tasks SET ai_instruction = ${action.changes.instruction}, updated_at = NOW()
            WHERE id = ${taskId} AND consultant_id = ${consultantId}
          `);
          updates.push('istruzione aggiornata');
        }
        if (action.changes.priority && VALID_PRIORITIES.includes(action.changes.priority)) {
          await db.execute(sql`
            UPDATE ai_scheduled_tasks SET priority = ${action.changes.priority}, updated_at = NOW()
            WHERE id = ${taskId} AND consultant_id = ${consultantId}
          `);
          updates.push(`priorità: ${action.changes.priority}`);
        }
        if (action.changes.scheduledAt && isValidDate(action.changes.scheduledAt)) {
          await db.execute(sql`
            UPDATE ai_scheduled_tasks SET scheduled_at = ${new Date(action.changes.scheduledAt)}, updated_at = NOW()
            WHERE id = ${taskId} AND consultant_id = ${consultantId}
          `);
          updates.push('data aggiornata');
        }
        if (updates.length === 0) return null;
        const instr = (check.rows[0] as any).ai_instruction?.substring(0, 60) || taskId;
        console.log(`✏️ [SUPERVISOR] Task ${taskId} modified via chat: ${updates.join(', ')}`);
        return `\n\n---\n✏️ Task "${instr}" modificato: ${updates.join(', ')}`;
      }

      case 'schedule_task': {
        const taskId = action.taskId;
        if (!taskId || !action.scheduledAt || !isValidDate(action.scheduledAt)) return null;
        const check = await db.execute(sql`
          SELECT id, ai_instruction FROM ai_scheduled_tasks
          WHERE id = ${taskId} AND consultant_id = ${consultantId}
          LIMIT 1
        `);
        if (!(check.rows[0] as any)?.id) return null;
        await db.execute(sql`
          UPDATE ai_scheduled_tasks
          SET scheduled_at = ${new Date(action.scheduledAt)}, status = 'scheduled', updated_at = NOW()
          WHERE id = ${taskId} AND consultant_id = ${consultantId}
        `);
        const instr = (check.rows[0] as any).ai_instruction?.substring(0, 60) || taskId;
        const dateStr = new Date(action.scheduledAt).toLocaleString('it-IT', { timeZone: 'Europe/Rome' });
        console.log(`📅 [SUPERVISOR] Task ${taskId} scheduled to ${dateStr} via chat by ${roleId}`);
        return `\n\n---\n📅 Task "${instr}" schedulato per ${dateStr}`;
      }

      default:
        return null;
    }
  } catch (err: any) {
    console.error(`❌ [SUPERVISOR] Error executing action ${action.action}:`, err.message);
    return null;
  }
}

function extractResponseText(response: any): string {
  try {
    if (typeof response.text === 'function') return response.text() || '';
    if (typeof response.text === 'string') return response.text;
  } catch {}
  try {
    if (response.candidates?.[0]?.content?.parts?.[0]?.text) {
      return response.candidates[0].content.parts[0].text;
    }
  } catch {}
  return '';
}

export async function runTaskSupervisor(params: SupervisorParams): Promise<SupervisorResult> {
  try {
    const { getGeminiApiKeyForClassifier } = await import("../ai/provider-factory");
    const apiKey = await getGeminiApiKeyForClassifier();
    if (!apiKey) {
      console.warn('[SUPERVISOR] No Gemini API key available');
      return { confirmation: null, actionsExecuted: 0 };
    }

    const ai = new GoogleGenAI({ apiKey });
    const prompt = buildSupervisorPrompt(params);

    console.log(`🔍 [SUPERVISOR] Running for ${params.roleId}, user: "${params.userMessage.substring(0, 80)}..."`);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), SUPERVISOR_TIMEOUT_MS);

    let response: any;
    try {
      response = await ai.models.generateContent({
        model: 'gemini-2.0-flash-lite',
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: {
          responseMimeType: 'application/json',
          responseSchema: SUPERVISOR_SCHEMA,
          temperature: 0.1,
          maxOutputTokens: 500,
          abortSignal: controller.signal,
        },
      });
    } finally {
      clearTimeout(timeout);
    }

    const responseText = extractResponseText(response);
    if (!responseText) {
      console.warn('[SUPERVISOR] Empty response');
      return { confirmation: null, actionsExecuted: 0 };
    }

    let parsed: any;
    try {
      parsed = JSON.parse(responseText);
    } catch {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          parsed = JSON.parse(jsonMatch[0]);
        } catch {
          console.warn('[SUPERVISOR] Failed to parse extracted JSON:', jsonMatch[0].substring(0, 200));
          return { confirmation: null, actionsExecuted: 0 };
        }
      } else {
        console.warn('[SUPERVISOR] Failed to parse response:', responseText.substring(0, 200));
        return { confirmation: null, actionsExecuted: 0 };
      }
    }

    if (!validateAction(parsed, params.activeTasks)) {
      console.log(`🔍 [SUPERVISOR] Decision: ${parsed?.action || 'invalid'} — validation failed, skipping`);
      return { confirmation: null, actionsExecuted: 0 };
    }

    console.log(`🔍 [SUPERVISOR] Decision: ${parsed.action}${parsed.taskIds ? ` (${parsed.taskIds.length} tasks)` : ''}`);

    const confirmation = await executeAction(parsed, params.consultantId, params.roleId);
    return {
      confirmation,
      actionsExecuted: confirmation ? 1 : 0,
    };
  } catch (err: any) {
    if (err.name === 'AbortError') {
      console.warn(`⏱️ [SUPERVISOR] Timeout after ${SUPERVISOR_TIMEOUT_MS}ms — skipping`);
      return { confirmation: null, actionsExecuted: 0 };
    }
    console.error(`❌ [SUPERVISOR] Error:`, err.message);
    return { confirmation: null, actionsExecuted: 0 };
  }
}
