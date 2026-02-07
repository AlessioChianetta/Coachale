import { Router, Request, Response } from "express";
import { authenticateToken, requireAnyRole, type AuthRequest } from "../middleware/auth";
import { db } from "../db";
import { sql } from "drizzle-orm";

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

export default router;
