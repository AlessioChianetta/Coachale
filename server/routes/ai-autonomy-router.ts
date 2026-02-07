import { Router, Request, Response } from "express";
import { authenticateToken, requireAnyRole, type AuthRequest } from "../middleware/auth";
import { db } from "../db";
import { sql } from "drizzle-orm";
import { GoogleGenAI } from "@google/genai";
import { getGeminiApiKeyForClassifier, GEMINI_3_MODEL } from "../ai/provider-factory";

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

    const whereClause = sql.join(conditions, sql` AND `);

    const [tasksResult, countResult] = await Promise.all([
      db.execute(sql`
        SELECT id, consultant_id, contact_name, contact_phone, task_type, task_category,
               ai_instruction, status, origin_type, priority, ai_reasoning, ai_confidence,
               execution_plan, result_summary, result_data, scheduled_at, started_at,
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
      db.execute(sql`SELECT id, first_name, last_name, email, phone FROM contacts WHERE consultant_id = ${consultantId} LIMIT 20`),
    ]);

    const settingsJson = settingsResult.rows.length > 0 ? JSON.stringify(settingsResult.rows[0]) : "Nessuna impostazione configurata";
    const tasksJson = tasksResult.rows.length > 0 ? JSON.stringify(tasksResult.rows) : "Nessun task recente";
    const activityJson = activityResult.rows.length > 0 ? JSON.stringify(activityResult.rows) : "Nessuna attività recente";
    const clientsSummary = clientsResult.rows.length > 0
      ? clientsResult.rows.map((c: any) => `${c.first_name || ""} ${c.last_name || ""} (${c.email || "no email"})`).join(", ")
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

export default router;
