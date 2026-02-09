import { Router, Request, Response } from "express";
import { authenticateToken, requireAnyRole, type AuthRequest } from "../middleware/auth";
import { db } from "../db";
import { sql } from "drizzle-orm";
import { GoogleGenAI } from "@google/genai";
import { getGeminiApiKeyForClassifier, GEMINI_3_MODEL } from "../ai/provider-factory";
import { generateExecutionPlan, type ExecutionStep } from "../ai/autonomous-decision-engine";
import { executeStep, type AITaskInfo } from "../ai/ai-task-executor";
import { logActivity, triggerAutonomousGenerationForConsultant } from "../cron/ai-task-scheduler";
import { getTemplatesByDirection } from '../voice/voice-templates';

const router = Router();

router.get("/settings", authenticateToken, requireAnyRole(["consultant", "super_admin"]), async (req: Request, res: Response) => {
  try {
    const consultantId = (req as AuthRequest).user?.id;
    if (!consultantId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const result = await db.execute(sql`
      SELECT * FROM ai_autonomy_settings WHERE consultant_id = ${consultantId}
    `);

    if (result.rows.length === 0) {
      return res.json({
        consultant_id: consultantId,
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
        proactive_check_interval_minutes: 60,
        is_active: false,
        custom_instructions: null,
        channels_enabled: { voice: true, email: false, whatsapp: false },
      });
    }

    return res.json(result.rows[0]);
  } catch (error: any) {
    console.error("[AI-AUTONOMY] Error fetching settings:", error);
    return res.status(500).json({ error: "Failed to fetch autonomy settings" });
  }
});

router.put("/settings", authenticateToken, requireAnyRole(["consultant", "super_admin"]), async (req: Request, res: Response) => {
  try {
    const consultantId = (req as AuthRequest).user?.id;
    if (!consultantId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const body = req.body;
    const autonomyLevel = body.autonomy_level ?? 1;
    const defaultMode = body.default_mode ?? 'manual';
    const allowedCategories = JSON.stringify(body.allowed_task_categories ?? ["outreach", "reminder", "followup"]);
    const alwaysApprove = JSON.stringify(body.always_approve_actions ?? ["send_email", "make_call", "modify_data"]);
    const hoursStart = body.working_hours_start ?? '08:00';
    const hoursEnd = body.working_hours_end ?? '20:00';
    const days = (body.working_days || [1,2,3,4,5]).map(Number).filter((n: number) => n >= 1 && n <= 7);
    const maxCalls = body.max_daily_calls ?? 10;
    const maxEmails = body.max_daily_emails ?? 20;
    const maxWhatsapp = body.max_daily_whatsapp ?? 30;
    const maxAnalyses = body.max_daily_analyses ?? 50;
    const proactiveInterval = body.proactive_check_interval_minutes ?? 60;
    const isActive = body.is_active ?? false;
    const customInstructions = body.custom_instructions || null;
    const channelsEnabled = JSON.stringify(body.channels_enabled ?? { voice: true, email: false, whatsapp: false });

    const result = await db.execute(sql`
      INSERT INTO ai_autonomy_settings (
        consultant_id, autonomy_level, default_mode, allowed_task_categories,
        always_approve_actions, working_hours_start, working_hours_end, working_days,
        max_daily_calls, max_daily_emails, max_daily_whatsapp, max_daily_analyses,
        proactive_check_interval_minutes, is_active, custom_instructions, channels_enabled
      ) VALUES (
        ${consultantId}, ${autonomyLevel}, ${defaultMode}, ${allowedCategories}::jsonb,
        ${alwaysApprove}::jsonb, ${hoursStart}::time, ${hoursEnd}::time, ARRAY[${sql.raw(days.join(','))}]::integer[],
        ${maxCalls}, ${maxEmails}, ${maxWhatsapp}, ${maxAnalyses},
        ${proactiveInterval}, ${isActive}, ${customInstructions}, ${channelsEnabled}::jsonb
      )
      ON CONFLICT (consultant_id) DO UPDATE SET
        autonomy_level = EXCLUDED.autonomy_level,
        default_mode = EXCLUDED.default_mode,
        allowed_task_categories = EXCLUDED.allowed_task_categories,
        always_approve_actions = EXCLUDED.always_approve_actions,
        working_hours_start = EXCLUDED.working_hours_start,
        working_hours_end = EXCLUDED.working_hours_end,
        working_days = EXCLUDED.working_days,
        max_daily_calls = EXCLUDED.max_daily_calls,
        max_daily_emails = EXCLUDED.max_daily_emails,
        max_daily_whatsapp = EXCLUDED.max_daily_whatsapp,
        max_daily_analyses = EXCLUDED.max_daily_analyses,
        proactive_check_interval_minutes = EXCLUDED.proactive_check_interval_minutes,
        is_active = EXCLUDED.is_active,
        custom_instructions = EXCLUDED.custom_instructions,
        channels_enabled = EXCLUDED.channels_enabled,
        updated_at = now()
      RETURNING *
    `);

    return res.json(result.rows[0]);
  } catch (error: any) {
    console.error("[AI-AUTONOMY] Error upserting settings:", error);
    return res.status(500).json({ error: "Failed to update autonomy settings" });
  }
});

router.get("/activity", authenticateToken, requireAnyRole(["consultant", "super_admin"]), async (req: Request, res: Response) => {
  try {
    const consultantId = (req as AuthRequest).user?.id;
    if (!consultantId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const offset = (page - 1) * limit;
    const eventType = req.query.event_type as string | undefined;
    const severity = req.query.severity as string | undefined;

    let whereConditions = [sql`consultant_id = ${consultantId}`];
    if (eventType) {
      whereConditions.push(sql`event_type = ${eventType}`);
    }
    if (severity) {
      whereConditions.push(sql`severity = ${severity}`);
    }

    const whereClause = sql.join(whereConditions, sql` AND `);

    const [itemsResult, countResult] = await Promise.all([
      db.execute(sql`
        SELECT * FROM ai_activity_log
        WHERE ${whereClause}
        ORDER BY created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `),
      db.execute(sql`
        SELECT COUNT(*)::int as total FROM ai_activity_log
        WHERE ${whereClause}
      `),
    ]);

    const total = (countResult.rows[0] as any)?.total || 0;

    return res.json({
      activities: itemsResult.rows,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error: any) {
    console.error("[AI-AUTONOMY] Error fetching activity log:", error);
    return res.status(500).json({ error: "Failed to fetch activity log" });
  }
});

router.post("/activity/:id/read", authenticateToken, requireAnyRole(["consultant", "super_admin"]), async (req: Request, res: Response) => {
  try {
    const consultantId = (req as AuthRequest).user?.id;
    if (!consultantId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { id } = req.params;

    await db.execute(sql`
      UPDATE ai_activity_log SET is_read = true
      WHERE id = ${id} AND consultant_id = ${consultantId}
    `);

    return res.json({ success: true });
  } catch (error: any) {
    console.error("[AI-AUTONOMY] Error marking activity as read:", error);
    return res.status(500).json({ error: "Failed to mark activity as read" });
  }
});

router.post("/activity/read-all", authenticateToken, requireAnyRole(["consultant", "super_admin"]), async (req: Request, res: Response) => {
  try {
    const consultantId = (req as AuthRequest).user?.id;
    if (!consultantId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const result = await db.execute(sql`
      UPDATE ai_activity_log SET is_read = true
      WHERE consultant_id = ${consultantId} AND is_read = false
    `);

    return res.json({ success: true, updated: result.rowCount || 0 });
  } catch (error: any) {
    console.error("[AI-AUTONOMY] Error marking all activities as read:", error);
    return res.status(500).json({ error: "Failed to mark all activities as read" });
  }
});

router.post("/tasks/analyze", authenticateToken, requireAnyRole(["consultant", "super_admin"]), async (req: Request, res: Response) => {
  try {
    const consultantId = (req as AuthRequest).user?.id;
    if (!consultantId) return res.status(401).json({ error: "Unauthorized" });

    const { ai_instruction } = req.body;
    if (!ai_instruction || typeof ai_instruction !== "string" || !ai_instruction.trim()) {
      return res.status(400).json({ error: "ai_instruction is required" });
    }

    const clientsResult = await db.execute(sql`
      SELECT u.id, u.first_name, u.last_name, u.email, u.phone_number, u.is_active
      FROM users u
      JOIN user_role_profiles urp ON u.id = urp.user_id
      WHERE urp.consultant_id = ${consultantId} AND urp.role = 'client'
      ORDER BY u.first_name
    `);
    const clients = clientsResult.rows;

    const outboundTemplates = getTemplatesByDirection('outbound');
    const templateOptions = outboundTemplates.map(t => ({ id: t.id, name: t.name, description: t.shortDescription || t.description }));

    const settingsResult = await db.execute(sql`
      SELECT channels_enabled, allowed_task_categories FROM ai_autonomy_settings WHERE consultant_id = ${consultantId} LIMIT 1
    `);
    const settings = settingsResult.rows[0] as any || {};
    const channelsEnabled = settings?.channels_enabled || { voice: true, email: false, whatsapp: false };

    const clientNames = clients.map((c: any) => `${c.first_name} ${c.last_name} (ID: ${c.id})`).join('\n');
    const templateList = templateOptions.map(t => `${t.id}: ${t.name} - ${t.description}`).join('\n');
    const enabledChannels = Object.entries(channelsEnabled).filter(([_, v]) => v).map(([k]) => k).join(', ');

    const prompt = `Sei un assistente AI per consulenti finanziari italiani. Analizza questa istruzione e suggerisci i campi del task.

ISTRUZIONE: "${ai_instruction.trim()}"

CLIENTI DISPONIBILI:
${clientNames || 'Nessun cliente registrato'}

TEMPLATE VOCALI DISPONIBILI:
${templateList}

CANALI ABILITATI: ${enabledChannels}

CATEGORIE VALIDE: outreach, reminder, followup, analysis, report, research, preparation, monitoring

Rispondi SOLO con un JSON valido (no markdown, no backticks):
{
  "task_category": "una delle categorie valide",
  "priority": numero 1-4 (1=alta, 4=bassa),
  "client_id": "UUID del cliente se menzionato nel testo, altrimenti null",
  "client_name": "Nome Cognome se trovato, altrimenti null",
  "contact_phone": "numero telefono se menzionato, altrimenti null",
  "preferred_channel": "voice|email|whatsapp|none",
  "tone": "formale|informale|empatico|professionale|persuasivo",
  "urgency": "immediata|oggi|settimana|programmata|normale",
  "objective": "informare|vendere|fidelizzare|raccogliere_info|supporto|followup",
  "voice_template_suggestion": "ID template se canale è voice, altrimenti null",
  "language": "it|en",
  "reasoning": "breve spiegazione delle scelte fatte"
}`;

    const { GoogleGenAI } = await import("@google/genai");
    const { getGeminiApiKeyForClassifier, GEMINI_LEGACY_MODEL } = await import("../ai/provider-factory");

    const apiKey = await getGeminiApiKeyForClassifier();
    const genAI = new GoogleGenAI({ apiKey });

    const result = await genAI.models.generateContent({
      model: GEMINI_LEGACY_MODEL,
      contents: prompt,
      config: {
        temperature: 0.3,
        maxOutputTokens: 500,
      }
    });

    const responseText = result.text?.trim() || '';

    let parsed;
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("No JSON found");
      }
    } catch (parseErr) {
      console.error("[AI-AUTONOMY] Failed to parse AI response:", responseText);
      return res.status(200).json({
        success: true,
        suggestions: {
          task_category: "analysis",
          priority: 3,
          preferred_channel: "none",
          tone: "professionale",
          urgency: "normale",
          objective: "informare",
          language: "it",
          reasoning: "Analisi automatica non riuscita, valori predefiniti applicati"
        }
      });
    }

    if (parsed.client_id) {
      const clientExists = clients.some((c: any) => c.id === parsed.client_id);
      if (!clientExists) {
        parsed.client_id = null;
        parsed.client_name = null;
      }
    }

    if (parsed.client_id) {
      const matchedClient = clients.find((c: any) => c.id === parsed.client_id) as any;
      if (matchedClient && !parsed.contact_phone) {
        parsed.contact_phone = matchedClient.phone_number || null;
      }
      if (matchedClient && !parsed.client_name) {
        parsed.client_name = `${matchedClient.first_name} ${matchedClient.last_name}`;
      }
    }

    return res.json({ success: true, suggestions: parsed });
  } catch (error: any) {
    console.error("[AI-AUTONOMY] Error analyzing task:", error);
    return res.status(500).json({ error: "Failed to analyze task" });
  }
});

router.post("/tasks", authenticateToken, requireAnyRole(["consultant", "super_admin"]), async (req: Request, res: Response) => {
  try {
    const consultantId = (req as AuthRequest).user?.id;
    if (!consultantId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { ai_instruction, task_category, priority, contact_name, contact_phone, client_id, preferred_channel, tone, urgency, scheduled_datetime, objective, additional_context, voice_template_suggestion, language } = req.body;

    if (!ai_instruction || typeof ai_instruction !== "string" || !ai_instruction.trim()) {
      return res.status(400).json({ error: "ai_instruction is required" });
    }

    const validCategories = ["outreach", "reminder", "followup", "analysis", "report", "research", "preparation", "monitoring"];
    if (!task_category || !validCategories.includes(task_category)) {
      return res.status(400).json({ error: `task_category must be one of: ${validCategories.join(", ")}` });
    }

    const sanitizedPhone = contact_phone ? String(contact_phone).replace(/[^0-9+\s\-()]/g, '') : null;
    if (sanitizedPhone && !/^\+?[0-9\s\-()]{3,20}$/.test(sanitizedPhone)) {
      return res.status(400).json({ error: "Formato telefono non valido. Usa un numero di telefono o interno (es: +39 333 1234567, 1009)" });
    }

    if (client_id) {
      const clientCheck = await db.execute(sql`
        SELECT urp.id FROM user_role_profiles urp
        WHERE urp.user_id = ${client_id} AND urp.consultant_id = ${consultantId} AND urp.role = 'client'
        LIMIT 1
      `);
      if (clientCheck.rows.length === 0) {
        return res.status(400).json({ error: "Il cliente selezionato non è associato al tuo account" });
      }
    }

    const taskId = `task_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
    const taskPriority = priority ?? 3;

    const result = await db.execute(sql`
      INSERT INTO ai_scheduled_tasks (
        id, consultant_id, task_type, task_category, ai_instruction, status,
        scheduled_at, timezone, origin_type, priority, contact_name, contact_phone, contact_id,
        preferred_channel, tone, urgency, scheduled_datetime, objective, additional_context, voice_template_suggestion, language
      ) VALUES (
        ${taskId}, ${consultantId}, 'ai_task', ${task_category}, ${ai_instruction.trim()}, 'scheduled',
        NOW(), 'Europe/Rome', 'manual', ${taskPriority}, ${contact_name || null}, ${sanitizedPhone || ''}, ${client_id || null},
        ${preferred_channel || null}, ${tone || null}, ${urgency || 'normal'}, ${scheduled_datetime ? new Date(scheduled_datetime) : null}, ${objective || null}, ${additional_context || null}, ${voice_template_suggestion || null}, ${language || 'it'}
      )
      RETURNING *
    `);

    return res.status(201).json({ success: true, task: result.rows[0] });
  } catch (error: any) {
    console.error("[AI-AUTONOMY] Error creating task:", error);
    return res.status(500).json({ error: "Failed to create task" });
  }
});

router.get("/tasks", authenticateToken, requireAnyRole(["consultant", "super_admin"]), async (req: Request, res: Response) => {
  try {
    const consultantId = (req as AuthRequest).user?.id;
    if (!consultantId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 10));
    const offset = (page - 1) * limit;
    const statusFilter = req.query.status as string | undefined;
    const categoryFilter = req.query.category as string | undefined;
    const originFilter = req.query.origin as string | undefined;

    let conditions = [sql`consultant_id = ${consultantId}`, sql`task_type = 'ai_task'`];
    if (statusFilter && statusFilter !== 'all') {
      if (statusFilter === 'active') {
        conditions.push(sql`status IN ('scheduled', 'in_progress', 'approved')`);
      } else if (statusFilter === 'paused') {
        conditions.push(sql`status IN ('paused', 'draft', 'waiting_approval')`);
      } else {
        conditions.push(sql`status = ${statusFilter}`);
      }
    }
    if (categoryFilter && categoryFilter !== 'all') {
      conditions.push(sql`task_category = ${categoryFilter}`);
    }
    if (originFilter && originFilter !== 'all') {
      conditions.push(sql`origin_type = ${originFilter}`);
    }

    const whereClause = sql.join(conditions, sql` AND `);

    const [tasksResult, countResult] = await Promise.all([
      db.execute(sql`
        SELECT id, consultant_id, contact_name, contact_phone, contact_id, task_type, task_category,
               ai_instruction, status, origin_type, priority, ai_reasoning, ai_confidence,
               execution_plan, result_summary, result_data, scheduled_at,
               completed_at, created_at, updated_at, call_after_task
        FROM ai_scheduled_tasks
        WHERE ${whereClause}
        ORDER BY created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `),
      db.execute(sql`
        SELECT COUNT(*)::int as total FROM ai_scheduled_tasks
        WHERE ${whereClause}
      `),
    ]);

    const total = (countResult.rows[0] as any)?.total || 0;

    return res.json({
      tasks: tasksResult.rows,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error: any) {
    console.error("[AI-AUTONOMY] Error fetching tasks:", error);
    return res.status(500).json({ error: "Failed to fetch tasks" });
  }
});

router.get("/tasks/:id", authenticateToken, requireAnyRole(["consultant", "super_admin"]), async (req: Request, res: Response) => {
  try {
    const consultantId = (req as AuthRequest).user?.id;
    if (!consultantId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { id } = req.params;

    const result = await db.execute(sql`
      SELECT * FROM ai_scheduled_tasks
      WHERE id = ${id} AND consultant_id = ${consultantId}
    `);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Task not found" });
    }

    const activityResult = await db.execute(sql`
      SELECT * FROM ai_activity_log
      WHERE task_id = ${id} AND consultant_id = ${consultantId}
      ORDER BY created_at ASC
    `);

    return res.json({
      task: result.rows[0],
      activity: activityResult.rows,
    });
  } catch (error: any) {
    console.error("[AI-AUTONOMY] Error fetching task detail:", error);
    return res.status(500).json({ error: "Failed to fetch task detail" });
  }
});

router.get("/tasks-stats", authenticateToken, requireAnyRole(["consultant", "super_admin"]), async (req: Request, res: Response) => {
  try {
    const consultantId = (req as AuthRequest).user?.id;
    if (!consultantId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const result = await db.execute(sql`
      SELECT 
        COUNT(*)::int as total,
        COUNT(*) FILTER (WHERE status IN ('scheduled', 'in_progress', 'approved'))::int as active,
        COUNT(*) FILTER (WHERE status = 'completed')::int as completed,
        COUNT(*) FILTER (WHERE status = 'failed')::int as failed,
        COUNT(*) FILTER (WHERE status IN ('paused', 'draft', 'waiting_approval'))::int as pending
      FROM ai_scheduled_tasks
      WHERE consultant_id = ${consultantId} AND task_type = 'ai_task'
    `);

    return res.json(result.rows[0] || { total: 0, active: 0, completed: 0, failed: 0, pending: 0 });
  } catch (error: any) {
    console.error("[AI-AUTONOMY] Error fetching task stats:", error);
    return res.status(500).json({ error: "Failed to fetch task stats" });
  }
});

router.get("/activity/unread-count", authenticateToken, requireAnyRole(["consultant", "super_admin"]), async (req: Request, res: Response) => {
  try {
    const consultantId = (req as AuthRequest).user?.id;
    if (!consultantId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const result = await db.execute(sql`
      SELECT COUNT(*)::int as count FROM ai_activity_log
      WHERE consultant_id = ${consultantId} AND is_read = false
    `);

    return res.json({ count: (result.rows[0] as any)?.count || 0 });
  } catch (error: any) {
    console.error("[AI-AUTONOMY] Error fetching unread count:", error);
    return res.status(500).json({ error: "Failed to fetch unread count" });
  }
});

router.post("/chat", authenticateToken, requireAnyRole(["consultant", "super_admin"]), async (req: Request, res: Response) => {
  try {
    const consultantId = (req as AuthRequest).user?.id;
    if (!consultantId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { message } = req.body;
    if (!message || typeof message !== "string") {
      return res.status(400).json({ error: "Message is required" });
    }

    await db.execute(sql`
      INSERT INTO ai_employee_chat_messages (consultant_id, role, content)
      VALUES (${consultantId}, 'user', ${message})
    `);

    const historyResult = await db.execute(sql`
      SELECT role, content FROM ai_employee_chat_messages
      WHERE consultant_id = ${consultantId}
      ORDER BY created_at DESC
      LIMIT 20
    `);
    const chatHistory = historyResult.rows.reverse().map((row: any) => ({
      role: row.role === "assistant" ? "model" : "user",
      parts: [{ text: row.content }],
    }));

    const [settingsResult, tasksResult, activityResult, clientsResult] = await Promise.all([
      db.execute(sql`SELECT * FROM ai_autonomy_settings WHERE consultant_id = ${consultantId} LIMIT 1`),
      db.execute(sql`SELECT id, ai_instruction, status, task_category, scheduled_at, result_summary FROM ai_scheduled_tasks WHERE consultant_id = ${consultantId} AND task_type = 'ai_task' ORDER BY created_at DESC LIMIT 10`),
      db.execute(sql`SELECT event_type, title, description, created_at FROM ai_activity_log WHERE consultant_id = ${consultantId} ORDER BY created_at DESC LIMIT 10`),
      db.execute(sql`SELECT u.id, u.first_name, u.last_name, u.email, u.phone_number FROM users u JOIN user_role_profiles urp ON u.id = urp.user_id WHERE urp.consultant_id = ${consultantId} AND urp.role = 'client' LIMIT 20`),
    ]);

    const settingsJson = settingsResult.rows.length > 0 ? JSON.stringify(settingsResult.rows[0]) : "Nessuna impostazione configurata";
    const tasksJson = tasksResult.rows.length > 0 ? JSON.stringify(tasksResult.rows) : "Nessun task recente";
    const activityJson = activityResult.rows.length > 0 ? JSON.stringify(activityResult.rows) : "Nessuna attività recente";
    const clientsSummary = clientsResult.rows.length > 0
      ? clientsResult.rows.map((c: any) => `${c.first_name || ""} ${c.last_name || ""} (${c.email || "no email"}, tel: ${c.phone_number || "N/A"})`).join(", ")
      : "Nessun cliente trovato";

    const systemPrompt = `Sei Alessia, il Dipendente AI di questo consulente finanziario. Comunichi in italiano.

Il tuo ruolo è quello di un assistente intelligente e proattivo che lavora per il consulente. Puoi:
- Analizzare i dati dei clienti e fornire insight
- Proporre azioni da intraprendere (chiamate, email, follow-up)
- Rispondere a domande sul portafoglio clienti
- Suggerire strategie basate sui dati disponibili
- Dare aggiornamenti sulle attività in corso

Contesto attuale del consulente:
- Impostazioni autonomia: ${settingsJson}
- Task recenti: ${tasksJson}
- Attività recente: ${activityJson}
- Lista clienti: ${clientsSummary}

Rispondi in modo conciso, professionale ma amichevole. Quando proponi azioni, sii specifico.
Se non hai informazioni sufficienti, chiedi chiarimenti.
Non inventare dati sui clienti - usa solo quelli disponibili nel contesto.`;

    const apiKey = await getGeminiApiKeyForClassifier();
    if (!apiKey) {
      return res.status(500).json({ error: "AI service not configured" });
    }

    const ai = new GoogleGenAI({ apiKey });
    const result = await ai.models.generateContent({
      model: GEMINI_3_MODEL,
      contents: chatHistory,
      config: {
        systemInstruction: systemPrompt,
        temperature: 0.7,
        maxOutputTokens: 2048,
        thinkingConfig: { thinkingBudget: 1024 },
      },
    });

    let responseText = "";
    if (result.text) {
      responseText = result.text;
    } else if ((result as any).response?.text) {
      responseText = (result as any).response.text();
    } else if ((result as any).candidates?.[0]?.content?.parts?.[0]?.text) {
      responseText = (result as any).candidates[0].content.parts[0].text;
    } else {
      responseText = "Mi dispiace, non sono riuscita a generare una risposta. Riprova.";
    }

    const saveResult = await db.execute(sql`
      INSERT INTO ai_employee_chat_messages (consultant_id, role, content)
      VALUES (${consultantId}, 'assistant', ${responseText})
      RETURNING id, role, content, created_at
    `);

    const savedMsg = saveResult.rows[0] as any;
    return res.json({
      message: {
        id: savedMsg.id,
        role: "assistant",
        content: savedMsg.content,
        created_at: savedMsg.created_at,
      },
    });
  } catch (error: any) {
    console.error("[AI-AUTONOMY] Error in chat:", error);
    return res.status(500).json({ error: "Failed to process chat message" });
  }
});

router.get("/chat/history", authenticateToken, requireAnyRole(["consultant", "super_admin"]), async (req: Request, res: Response) => {
  try {
    const consultantId = (req as AuthRequest).user?.id;
    if (!consultantId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 50));

    const result = await db.execute(sql`
      SELECT id, role, content, metadata, created_at FROM ai_employee_chat_messages
      WHERE consultant_id = ${consultantId}
      ORDER BY created_at ASC
      LIMIT ${limit}
    `);

    return res.json({ messages: result.rows });
  } catch (error: any) {
    console.error("[AI-AUTONOMY] Error fetching chat history:", error);
    return res.status(500).json({ error: "Failed to fetch chat history" });
  }
});

router.delete("/chat/history", authenticateToken, requireAnyRole(["consultant", "super_admin"]), async (req: Request, res: Response) => {
  try {
    const consultantId = (req as AuthRequest).user?.id;
    if (!consultantId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    await db.execute(sql`
      DELETE FROM ai_employee_chat_messages WHERE consultant_id = ${consultantId}
    `);

    return res.json({ success: true });
  } catch (error: any) {
    console.error("[AI-AUTONOMY] Error clearing chat history:", error);
    return res.status(500).json({ error: "Failed to clear chat history" });
  }
});

router.post("/tasks/:id/execute", authenticateToken, requireAnyRole(["consultant", "super_admin"]), async (req: Request, res: Response) => {
  try {
    const consultantId = (req as AuthRequest).user?.id;
    if (!consultantId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { id } = req.params;

    const taskResult = await db.execute(sql`
      SELECT * FROM ai_scheduled_tasks
      WHERE id = ${id} AND consultant_id = ${consultantId}
    `);

    if (taskResult.rows.length === 0) {
      return res.status(404).json({ error: "Task not found" });
    }

    const task = taskResult.rows[0] as any;

    if (!['paused', 'scheduled', 'failed'].includes(task.status)) {
      return res.status(400).json({ error: `Cannot execute task with status '${task.status}'. Only 'paused', 'scheduled', or 'failed' tasks can be manually executed.` });
    }

    const isRetry = task.status === 'failed';

    await db.execute(sql`
      UPDATE ai_scheduled_tasks
      SET status = 'in_progress',
          current_attempt = COALESCE(current_attempt, 0) + 1,
          last_attempt_at = NOW(),
          error_message = NULL,
          execution_plan = ${isRetry ? sql`'[]'::jsonb` : sql`execution_plan`},
          result_data = ${isRetry ? sql`NULL` : sql`result_data`},
          result_summary = ${isRetry ? sql`NULL` : sql`result_summary`},
          updated_at = NOW()
      WHERE id = ${id}
    `);

    res.json({ success: true, status: 'executing' });

    const runExecution = async () => {
      try {
        let executionPlan: ExecutionStep[] = Array.isArray(task.execution_plan) && task.execution_plan.length > 0
          ? task.execution_plan as ExecutionStep[]
          : [];

        if (executionPlan.length === 0) {
          console.log(`🧠 [AI-AUTONOMY] Task ${task.id} has no execution plan, generating via Decision Engine...`);

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
          }, { isManual: true });

          if (!decision.should_execute) {
            console.log(`🛑 [AI-AUTONOMY] Decision Engine says skip task ${task.id}: ${decision.reasoning}`);

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

          console.log(`🧠 [AI-AUTONOMY] Generated ${executionPlan.length}-step plan for task ${task.id} (confidence: ${decision.confidence})`);
        }

        const totalSteps = executionPlan.length;

        await logActivity(task.consultant_id, {
          event_type: 'task_started',
          title: `Task avviato (manuale): ${task.ai_instruction?.substring(0, 60) || 'Task AI'}`,
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

          console.log(`🧠 [AI-AUTONOMY] Executing step ${i + 1}/${totalSteps}: ${stepName}`);

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

            console.log(`✅ [AI-AUTONOMY] Step ${i + 1}/${totalSteps} completed in ${stepResult.duration_ms}ms`);
          } else {
            executionPlan[i] = { ...executionPlan[i], status: 'failed' };
            failedStep = stepName;

            console.error(`❌ [AI-AUTONOMY] Step ${i + 1}/${totalSteps} failed: ${stepResult.error}`);

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
            console.log(`📞 [AI-AUTONOMY] Task ${task.id} requires post-task call to ${task.contact_phone}`);
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
            console.log(`📞 [AI-AUTONOMY] Created follow-up call task ${callTaskId}`);
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

          console.log(`✅ [AI-AUTONOMY] Manual task execution ${task.id} completed (${totalSteps} steps)`);
        }
      } catch (error: any) {
        console.error(`❌ [AI-AUTONOMY] Manual task execution ${task.id} failed:`, error.message);

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
    };

    runExecution();

  } catch (error: any) {
    console.error("[AI-AUTONOMY] Error starting task execution:", error);
    if (!res.headersSent) {
      return res.status(500).json({ error: "Failed to start task execution" });
    }
  }
});

router.get("/system-status", authenticateToken, requireAnyRole(["consultant", "super_admin"]), async (req: Request, res: Response) => {
  try {
    const consultantId = (req as AuthRequest).user?.id;
    if (!consultantId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const [settingsResult, lastAutonomousCheckResult, todayCountsResult, eligibleClientsResult, totalClientsResult, pendingTasksResult] = await Promise.all([
      db.execute(sql`SELECT * FROM ai_autonomy_settings WHERE consultant_id = ${consultantId} LIMIT 1`),
      db.execute(sql`
        SELECT created_at, event_data FROM ai_activity_log
        WHERE consultant_id = ${consultantId}
          AND event_type IN ('autonomous_task_created', 'autonomous_analysis')
        ORDER BY created_at DESC LIMIT 1
      `),
      db.execute(sql`
        SELECT
          COALESCE(SUM(CASE WHEN event_type IN ('voice_call', 'call_completed', 'call_initiated') THEN 1 ELSE 0 END), 0) AS calls,
          COALESCE(SUM(CASE WHEN event_type IN ('email_sent', 'send_email') THEN 1 ELSE 0 END), 0) AS emails,
          COALESCE(SUM(CASE WHEN event_type IN ('whatsapp_sent', 'send_whatsapp') THEN 1 ELSE 0 END), 0) AS whatsapp,
          COALESCE(SUM(CASE WHEN event_type IN ('analysis_completed', 'analyze_patterns', 'generate_report') THEN 1 ELSE 0 END), 0) AS analyses
        FROM ai_activity_log
        WHERE consultant_id = ${consultantId}
          AND created_at >= (NOW() AT TIME ZONE 'Europe/Rome')::date
      `),
      db.execute(sql`
        SELECT COUNT(*)::int as count FROM users u
        JOIN user_role_profiles urp ON u.id = urp.user_id
        WHERE urp.consultant_id = ${consultantId}
          AND urp.role = 'client'
          AND u.is_active = true
          AND u.id ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
          AND NOT EXISTS (
            SELECT 1 FROM ai_scheduled_tasks ast
            WHERE ast.consultant_id::text = ${consultantId}
              AND ast.contact_id::text = u.id::text
              AND ast.status IN ('scheduled', 'in_progress', 'retry_pending', 'waiting_approval', 'approved')
          )
          AND NOT EXISTS (
            SELECT 1 FROM ai_scheduled_tasks ast2
            WHERE ast2.consultant_id::text = ${consultantId}
              AND ast2.contact_id::text = u.id::text
              AND ast2.status = 'completed'
              AND ast2.completed_at > NOW() - INTERVAL '24 hours'
          )
      `),
      db.execute(sql`
        SELECT COUNT(*)::int as count FROM users u
        JOIN user_role_profiles urp ON u.id = urp.user_id
        WHERE urp.consultant_id = ${consultantId} AND urp.role = 'client' AND u.is_active = true
      `),
      db.execute(sql`
        SELECT COUNT(*)::int as count FROM ai_scheduled_tasks
        WHERE consultant_id = ${consultantId}
          AND status IN ('scheduled', 'in_progress', 'retry_pending', 'waiting_approval', 'approved')
      `),
    ]);

    const settings = settingsResult.rows[0] as any || {};
    const lastCheck = lastAutonomousCheckResult.rows[0] as any || null;
    const counts = todayCountsResult.rows[0] as any || {};
    const eligibleCount = (eligibleClientsResult.rows[0] as any)?.count || 0;
    const totalClients = (totalClientsResult.rows[0] as any)?.count || 0;
    const pendingTasks = (pendingTasksResult.rows[0] as any)?.count || 0;

    const checkInterval = settings.proactive_check_interval_minutes || 60;
    let nextCheckEstimate: string | null = null;
    if (lastCheck?.created_at) {
      const lastCheckTime = new Date(lastCheck.created_at);
      const nextCheck = new Date(lastCheckTime.getTime() + checkInterval * 60 * 1000);
      nextCheckEstimate = nextCheck.toISOString();
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

    const workingDays = settings.working_days || [1, 2, 3, 4, 5];
    const [startH, startM] = (settings.working_hours_start || "08:00").toString().split(":").map(Number);
    const [endH, endM] = (settings.working_hours_end || "20:00").toString().split(":").map(Number);
    const startMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;
    const isWorkingDay = workingDays.includes(currentDay);
    const isWithinHours = currentTimeMinutes >= startMinutes && currentTimeMinutes <= endMinutes;
    const isInWorkingHours = isWorkingDay && isWithinHours;

    const lastErrorResult = await db.execute(sql`
      SELECT created_at, title, description, event_data FROM ai_activity_log
      WHERE consultant_id = ${consultantId}
        AND severity = 'error'
        AND event_type LIKE '%autonomous%'
      ORDER BY created_at DESC LIMIT 1
    `);
    const lastError = lastErrorResult.rows[0] as any || null;

    return res.json({
      is_active: settings.is_active || false,
      autonomy_level: settings.autonomy_level || 0,
      is_in_working_hours: isInWorkingHours,
      is_working_day: isWorkingDay,
      is_within_hours: isWithinHours,
      current_time_rome: `${String(currentHour).padStart(2, '0')}:${String(currentMinute).padStart(2, '0')}`,
      today_counts: {
        calls: parseInt(counts.calls || "0"),
        emails: parseInt(counts.emails || "0"),
        whatsapp: parseInt(counts.whatsapp || "0"),
        analyses: parseInt(counts.analyses || "0"),
      },
      limits: {
        max_calls: settings.max_daily_calls || 10,
        max_emails: settings.max_daily_emails || 20,
        max_whatsapp: settings.max_daily_whatsapp || 30,
        max_analyses: settings.max_daily_analyses || 50,
      },
      last_autonomous_check: lastCheck?.created_at || null,
      last_check_data: lastCheck?.event_data || null,
      next_check_estimate: nextCheckEstimate,
      check_interval_minutes: checkInterval,
      eligible_clients: eligibleCount,
      total_clients: totalClients,
      pending_tasks: pendingTasks,
      cron_schedule: "ogni 30 minuti",
      task_execution_schedule: "ogni minuto",
      last_error: lastError ? {
        created_at: lastError.created_at,
        title: lastError.title,
        description: lastError.description,
        data: lastError.event_data,
      } : null,
    });
  } catch (error: any) {
    console.error("[AI-AUTONOMY] Error fetching system status:", error);
    return res.status(500).json({ error: "Failed to fetch system status" });
  }
});

router.get("/autonomous-logs", authenticateToken, requireAnyRole(["consultant", "super_admin"]), async (req: Request, res: Response) => {
  try {
    const consultantId = (req as AuthRequest).user?.id;
    if (!consultantId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 50);
    const offset = (page - 1) * limit;
    const eventTypeFilter = req.query.event_type as string || "all";
    const severityFilter = req.query.severity as string || "all";

    const allowedEventTypes = ['autonomous_analysis', 'autonomous_task_created', 'autonomous_error'];
    const filterEventTypes = eventTypeFilter !== "all" && allowedEventTypes.includes(eventTypeFilter)
      ? [eventTypeFilter]
      : allowedEventTypes;

    const eventTypeSql = filterEventTypes.length === 1
      ? sql`AND event_type = ${filterEventTypes[0]}`
      : sql`AND event_type IN ('autonomous_analysis', 'autonomous_task_created', 'autonomous_error')`;

    const severitySql = severityFilter !== "all"
      ? sql`AND severity = ${severityFilter}`
      : sql``;

    const [logsResult, totalResult] = await Promise.all([
      db.execute(sql`
        SELECT id, event_type, title, description, icon, severity, created_at, event_data, contact_name, task_id
        FROM ai_activity_log
        WHERE consultant_id = ${consultantId}
          ${eventTypeSql}
          ${severitySql}
        ORDER BY created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `),
      db.execute(sql`
        SELECT COUNT(*)::int as count FROM ai_activity_log
        WHERE consultant_id = ${consultantId}
          ${eventTypeSql}
          ${severitySql}
      `),
    ]);

    return res.json({
      logs: logsResult.rows,
      total: (totalResult.rows[0] as any)?.count || 0,
      page,
      limit,
    });
  } catch (error: any) {
    console.error("[AI-AUTONOMY] Error fetching autonomous logs:", error);
    return res.status(500).json({ error: "Failed to fetch autonomous logs" });
  }
});

router.post("/trigger-analysis", authenticateToken, requireAnyRole(["consultant", "super_admin"]), async (req: Request, res: Response) => {
  try {
    const consultantId = (req as AuthRequest).user?.id;
    if (!consultantId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const settingsCheck = await db.execute(sql`SELECT is_active, autonomy_level FROM ai_autonomy_settings WHERE consultant_id = ${consultantId} LIMIT 1`);
    const s = settingsCheck.rows[0] as any;
    if (!s || !s.is_active || s.autonomy_level < 2) {
      return res.status(400).json({ success: false, error: "Sistema non attivo o livello autonomia insufficiente (min. 2)" });
    }

    console.log(`🧠 [AI-AUTONOMY] Manual trigger by consultant ${consultantId}`);

    const result = await triggerAutonomousGenerationForConsultant(consultantId);

    await logActivity(consultantId, {
      event_type: 'autonomous_analysis',
      severity: result.error ? 'error' : 'info',
      title: result.error ? 'Analisi manuale fallita' : `Analisi manuale completata`,
      description: result.error
        ? `Errore durante l'analisi manuale: ${result.error}`
        : `Analisi manuale avviata. ${result.tasksGenerated} task generati.`,
      event_data: { manual: true, tasks_generated: result.tasksGenerated, error: result.error || null },
    });

    return res.json({
      success: !result.error,
      tasks_generated: result.tasksGenerated,
      error: result.error || null,
    });
  } catch (error: any) {
    console.error("[AI-AUTONOMY] Error triggering analysis:", error);
    return res.status(500).json({ error: "Failed to trigger analysis" });
  }
});

export default router;
