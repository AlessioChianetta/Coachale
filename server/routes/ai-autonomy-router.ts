import { Router, Request, Response } from "express";
import { authenticateToken, requireAnyRole, type AuthRequest } from "../middleware/auth";
import { db } from "../db";
import { sql } from "drizzle-orm";
import { GoogleGenAI } from "@google/genai";
import { getGeminiApiKeyForClassifier, GEMINI_3_MODEL, trackedGenerateContent } from "../ai/provider-factory";
import { generateExecutionPlan, type ExecutionStep, getAutonomySettings, getEffectiveRoleLevel, isRoleWithinWorkingHours } from "../ai/autonomous-decision-engine";
import { executeStep, type AITaskInfo } from "../ai/ai-task-executor";
import { logActivity, triggerAutonomousGenerationForConsultant } from "../cron/ai-task-scheduler";
import { getTemplatesByDirection } from '../voice/voice-templates';
import { AI_ROLES } from "../cron/ai-autonomous-roles";
import { getRemainingLimits, getDailyUsage, getOutreachLimits } from "../services/outreach-rate-limiter";
import { upload } from "../middleware/upload";
import { addReasoningClient, removeReasoningClient } from "../sse/reasoning-stream";
import fs from 'fs';

if (!fs.existsSync('uploads')) fs.mkdirSync('uploads', { recursive: true });

const router = Router();

router.get("/reasoning-stream", async (req: Request, res: Response) => {
  const token = (req.query.token as string) || req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).end();

  try {
    const jwt = await import('jsonwebtoken');
    const JWT_SECRET = process.env.JWT_SECRET || process.env.SESSION_SECRET || 'your-secret-key';
    const decoded = jwt.default.verify(token, JWT_SECRET) as any;
    const consultantId = decoded.userId || decoded.id;
    if (!consultantId) return res.status(401).end();

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    res.write(`data: ${JSON.stringify({ type: 'connected', timestamp: Date.now() })}\n\n`);

    addReasoningClient(consultantId, res);

    const keepAlive = setInterval(() => {
      try { res.write(': ping\n\n'); } catch { clearInterval(keepAlive); }
    }, 30000);

    req.on('close', () => {
      clearInterval(keepAlive);
      removeReasoningClient(consultantId, res);
    });
  } catch (err) {
    console.error('📡 [SSE] Auth error:', err);
    return res.status(401).end();
  }
});

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
        allowed_task_categories: ["outreach", "reminder", "followup", "prospecting"],
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
        channels_enabled: { voice: true, email: false, whatsapp: false, lead_scraper: true },
        role_frequencies: {},
        role_autonomy_modes: {},
        role_working_hours: {},
        whatsapp_template_ids: [],
        reasoning_mode: 'structured',
        role_reasoning_modes: {},
        autonomy_model: 'gemini-3-flash-preview',
        autonomy_thinking_level: 'low',
        role_temperatures: {},
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
    const allowedCategories = JSON.stringify(body.allowed_task_categories ?? ["outreach", "reminder", "followup", "prospecting"]);
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
    const channelsEnabled = JSON.stringify(body.channels_enabled ?? { voice: true, email: false, whatsapp: false, lead_scraper: true });
    const roleFrequencies = JSON.stringify(body.role_frequencies ?? {});
    const roleAutonomyModes = JSON.stringify(body.role_autonomy_modes ?? {});
    const roleWorkingHours = JSON.stringify(body.role_working_hours ?? {});
    const whatsappTemplateIds = JSON.stringify(body.whatsapp_template_ids ?? []);
    const reasoningMode = body.reasoning_mode ?? 'structured';
    const roleReasoningModes = JSON.stringify(body.role_reasoning_modes ?? {});
    const outreachConfig = body.outreach_config !== undefined ? JSON.stringify(body.outreach_config) : null;
    const autonomyModel = body.autonomy_model ?? 'gemini-3-flash-preview';
    const autonomyThinkingLevel = body.autonomy_thinking_level ?? 'low';
    const roleTemperatures = JSON.stringify(body.role_temperatures ?? {});

    const result = await db.execute(sql`
      INSERT INTO ai_autonomy_settings (
        consultant_id, autonomy_level, default_mode, allowed_task_categories,
        always_approve_actions, working_hours_start, working_hours_end, working_days,
        max_daily_calls, max_daily_emails, max_daily_whatsapp, max_daily_analyses,
        proactive_check_interval_minutes, is_active, custom_instructions, channels_enabled,
        role_frequencies, role_autonomy_modes, role_working_hours, whatsapp_template_ids,
        reasoning_mode, role_reasoning_modes, outreach_config, autonomy_model, autonomy_thinking_level, role_temperatures
      ) VALUES (
        ${consultantId}, ${autonomyLevel}, ${defaultMode}, ${allowedCategories}::jsonb,
        ${alwaysApprove}::jsonb, ${hoursStart}::time, ${hoursEnd}::time, ARRAY[${sql.raw(days.join(','))}]::integer[],
        ${maxCalls}, ${maxEmails}, ${maxWhatsapp}, ${maxAnalyses},
        ${proactiveInterval}, ${isActive}, ${customInstructions}, ${channelsEnabled}::jsonb,
        ${roleFrequencies}::jsonb, ${roleAutonomyModes}::jsonb, ${roleWorkingHours}::jsonb, ${whatsappTemplateIds}::jsonb,
        ${reasoningMode}, ${roleReasoningModes}::jsonb, COALESCE(${outreachConfig}::jsonb, '{}'::jsonb), ${autonomyModel}, ${autonomyThinkingLevel}, ${roleTemperatures}::jsonb
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
        role_frequencies = EXCLUDED.role_frequencies,
        role_autonomy_modes = EXCLUDED.role_autonomy_modes,
        role_working_hours = EXCLUDED.role_working_hours,
        whatsapp_template_ids = EXCLUDED.whatsapp_template_ids,
        reasoning_mode = EXCLUDED.reasoning_mode,
        role_reasoning_modes = EXCLUDED.role_reasoning_modes,
        outreach_config = CASE WHEN ${outreachConfig}::jsonb IS NOT NULL THEN ${outreachConfig}::jsonb ELSE ai_autonomy_settings.outreach_config END,
        autonomy_model = EXCLUDED.autonomy_model,
        autonomy_thinking_level = EXCLUDED.autonomy_thinking_level,
        role_temperatures = EXCLUDED.role_temperatures,
        updated_at = now()
      RETURNING *
    `);

    return res.json(result.rows[0]);
  } catch (error: any) {
    console.error("[AI-AUTONOMY] Error upserting settings:", error);
    return res.status(500).json({ error: "Failed to update autonomy settings" });
  }
});

router.patch("/outreach-config", authenticateToken, requireAnyRole(["consultant", "super_admin"]), async (req: Request, res: Response) => {
  try {
    const consultantId = (req as AuthRequest).user?.id;
    if (!consultantId) return res.status(401).json({ error: "Unauthorized" });

    const outreachConfig = JSON.stringify(req.body.outreach_config ?? {});
    const result = await db.execute(sql`
      UPDATE ai_autonomy_settings
      SET outreach_config = ${outreachConfig}::jsonb, updated_at = now()
      WHERE consultant_id = ${consultantId}
      RETURNING *
    `);

    if (result.rows.length === 0) {
      await db.execute(sql`
        INSERT INTO ai_autonomy_settings (consultant_id, outreach_config)
        VALUES (${consultantId}, ${outreachConfig}::jsonb)
      `);
    }

    return res.json({ success: true });
  } catch (error: any) {
    console.error("[AI-AUTONOMY] Error updating outreach config:", error);
    return res.status(500).json({ error: "Failed to update outreach config" });
  }
});

router.get("/hunter/actions", authenticateToken, requireAnyRole(["consultant", "super_admin"]), async (req: Request, res: Response) => {
  try {
    const consultantId = (req as AuthRequest).user?.id;
    if (!consultantId) return res.status(401).json({ error: "Unauthorized" });

    const channel = (req.query.channel as string) || "all";
    const status = (req.query.status as string) || "all";
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);

    let channelFilter = sql``;
    if (channel === "voice") channelFilter = sql` AND (t.preferred_channel = 'voice' OR t.task_type = 'single_call')`;
    else if (channel === "whatsapp") channelFilter = sql` AND (t.preferred_channel = 'whatsapp' OR t.task_type = 'single_whatsapp')`;
    else if (channel === "email") channelFilter = sql` AND t.preferred_channel = 'email'`;

    let statusFilter = sql``;
    if (status === "scheduled") statusFilter = sql` AND t.status IN ('scheduled', 'waiting_approval')`;
    else if (status === "sent") statusFilter = sql` AND t.status = 'completed'`;
    else if (status === "failed") statusFilter = sql` AND t.status = 'failed'`;

    const [actionsResult, countResult] = await Promise.all([
      db.execute(sql`
        SELECT
          t.id,
          CASE
            WHEN t.task_type = 'single_call' OR t.preferred_channel = 'voice' THEN 'voice'
            WHEN t.task_type = 'single_whatsapp' OR t.preferred_channel = 'whatsapp' THEN 'whatsapp'
            WHEN t.preferred_channel = 'email' THEN 'email'
            ELSE t.preferred_channel
          END as channel,
          CASE
            WHEN t.status = 'completed' THEN 'sent'
            WHEN t.status = 'waiting_approval' THEN 'waiting_approval'
            ELSE t.status
          END as status,
          t.contact_name as lead_name,
          t.contact_phone as lead_phone,
          t.ai_instruction as message_preview,
          t.created_at,
          t.scheduled_at,
          t.completed_at as executed_at,
          t.result_summary as result_note,
          t.additional_context
        FROM ai_scheduled_tasks t
        WHERE t.consultant_id = ${consultantId}
          AND t.ai_role = 'hunter'
          ${channelFilter} ${statusFilter}
        ORDER BY t.created_at DESC
        LIMIT ${limit}
      `),
      db.execute(sql`
        SELECT COUNT(*)::int as total FROM ai_scheduled_tasks t
        WHERE t.consultant_id = ${consultantId}
          AND t.ai_role = 'hunter'
          ${channelFilter} ${statusFilter}
      `),
    ]);

    const actions = actionsResult.rows.map((row: any) => {
      let ctx: any = {};
      try {
        ctx = typeof row.additional_context === 'string' ? JSON.parse(row.additional_context) : (row.additional_context || {});
      } catch {}
      return {
        ...row,
        additional_context: undefined,
        lead_email: ctx.lead_email || null,
        lead_id: ctx.lead_id || null,
        business_name: ctx.business_name || row.lead_name || null,
        ai_score: ctx.ai_score || null,
        sector: ctx.sector || null,
        website: ctx.website || null,
        address: ctx.address || null,
        ai_reason: ctx.ai_reason || null,
        sales_summary: ctx.sales_summary || null,
        source: ctx.source || null,
        voice_template_name: ctx.voice_template_name || null,
        email_account_id: ctx.email_account_id || null,
        wa_template_name: ctx.wa_template_name || null,
        wa_template_sid: ctx.wa_template_sid || null,
        wa_template_body: ctx.wa_template_body || null,
        wa_template_filled: ctx.wa_template_filled || null,
        wa_template_variables: ctx.wa_template_variables || null,
        use_wa_template: ctx.use_wa_template || false,
        whatsapp_config_id: row.whatsapp_config_id || null,
      };
    });

    res.json({
      actions,
      total: (countResult.rows[0] as any)?.total || 0,
    });
  } catch (error: any) {
    console.error("❌ [HUNTER-ACTIONS] Error:", error.message);
    res.status(500).json({ error: "Failed to fetch hunter actions" });
  }
});

router.get("/hunter/uncontacted-leads", authenticateToken, requireAnyRole(["consultant", "super_admin"]), async (req: Request, res: Response) => {
  try {
    const consultantId = (req as AuthRequest).user?.id;
    if (!consultantId) return res.status(401).json({ error: "Unauthorized" });

    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);

    const settingsResult = await db.execute(sql`
      SELECT outreach_config FROM ai_autonomy_settings WHERE consultant_id::text = ${consultantId}::text LIMIT 1
    `);
    const outreachConfig = (settingsResult.rows[0] as any)?.outreach_config || {};
    const scoreThreshold = outreachConfig.score_threshold ?? 60;
    const leadSourceFilter = outreachConfig.lead_source_filter;
    const sourceCondition = leadSourceFilter && leadSourceFilter !== 'both'
      ? sql`AND ls.origin_role = ${leadSourceFilter}`
      : sql``;

    const result = await db.execute(sql`
      SELECT
        lr.id, lr.business_name, lr.phone, lr.email, lr.category, lr.website,
        lr.ai_compatibility_score, lr.ai_sales_summary, lr.lead_status,
        lr.created_at, lr.lead_notes,
        ls.origin_role as source,
        (
          SELECT MAX(la.created_at)
          FROM lead_scraper_activities la
          WHERE la.lead_id::text = lr.id::text
            AND la.type IN ('voice_call_answered','voice_call_completed','voice_call_no_answer',
                           'whatsapp_sent','email_sent','chiamata','whatsapp_inviato','email_inviata')
        ) as last_contact_at,
        (
          SELECT json_agg(json_build_object('channel', la2.type, 'date', to_char(la2.created_at AT TIME ZONE 'Europe/Rome', 'DD/MM/YY')))
          FROM (
            SELECT DISTINCT ON (la3.type) la3.type, la3.created_at
            FROM lead_scraper_activities la3
            WHERE la3.lead_id::text = lr.id::text
              AND la3.type IN ('voice_call_answered','voice_call_completed','voice_call_no_answer',
                               'whatsapp_sent','email_sent','chiamata','whatsapp_inviato','email_inviata')
            ORDER BY la3.type, la3.created_at DESC
          ) la2
        ) as last_contacts_by_channel
      FROM lead_scraper_results lr
      JOIN lead_scraper_searches ls ON lr.search_id = ls.id
      WHERE ls.consultant_id = ${consultantId}
        AND lr.lead_status IN ('nuovo','contattato','in_outreach')
        AND lr.ai_compatibility_score IS NOT NULL
        AND lr.ai_compatibility_score >= ${scoreThreshold}
        ${sourceCondition}
      ORDER BY lr.ai_compatibility_score DESC
      LIMIT ${limit}
    `);

    res.json({ leads: result.rows, total: result.rows.length });
  } catch (error: any) {
    console.error("[ai-autonomy] /hunter/uncontacted-leads error:", error.message);
    res.status(500).json({ error: error.message });
  }
});

router.post("/hunter/trigger-direct", authenticateToken, requireAnyRole(["consultant", "super_admin"]), async (req: Request, res: Response) => {
  try {
    const consultantId = (req as AuthRequest).user?.id;
    if (!consultantId) return res.status(401).json({ error: "Unauthorized" });

    const { runDirectHunterForConsultant } = await import("../ai/hunter-direct-executor");
    const result = await runDirectHunterForConsultant(consultantId);

    res.json(result);
  } catch (error: any) {
    console.error("❌ [HUNTER-TRIGGER-DIRECT] Error:", error.message);
    res.status(500).json({ success: false, reason: error.message });
  }
});

router.post("/hunter/check-followups", authenticateToken, requireAnyRole(["consultant", "super_admin"]), async (req: Request, res: Response) => {
  try {
    const consultantId = (req as AuthRequest).user?.id;
    if (!consultantId) return res.status(401).json({ error: "Unauthorized" });

    const settingsResult = await db.execute(sql`
      SELECT outreach_config FROM ai_autonomy_settings
      WHERE consultant_id = ${consultantId} LIMIT 1
    `);
    let fuConfig: Record<string, any> = {};
    if (settingsResult.rows.length > 0) {
      const oc = (settingsResult.rows[0] as any).outreach_config || {};
      const parsed = typeof oc === 'string' ? JSON.parse(oc) : oc;
      if (parsed.emailFollowUp) fuConfig = parsed.emailFollowUp;
    }

    const { checkEmailFollowUps } = await import("../cron/ai-task-scheduler");
    const result = await checkEmailFollowUps(consultantId, fuConfig);

    res.json({ success: true, ...result });
  } catch (error: any) {
    console.error("❌ [HUNTER-FOLLOWUPS] Error:", error.message);
    res.status(500).json({ success: false, reason: error.message });
  }
});

router.get("/hunter-pipeline", authenticateToken, requireAnyRole(["consultant", "super_admin"]), async (req: Request, res: Response) => {
  try {
    const consultantId = (req as AuthRequest).user?.id;
    if (!consultantId) return res.status(401).json({ error: "Unauthorized" });

    const [remaining, usage, limits] = await Promise.all([
      getRemainingLimits(consultantId),
      getDailyUsage(consultantId),
      getOutreachLimits(consultantId),
    ]);

    const statsResult = await db.execute(sql`
      SELECT
        COUNT(*) FILTER (WHERE lr.created_at >= CURRENT_DATE) as found_today,
        COUNT(*) FILTER (WHERE lr.ai_compatibility_score IS NOT NULL AND lr.created_at >= CURRENT_DATE) as scored_today,
        COUNT(*) FILTER (WHERE lr.lead_status = 'in_outreach') as in_outreach,
        COUNT(*) FILTER (WHERE lr.lead_status = 'contattato') as contacted,
        COUNT(*) FILTER (WHERE lr.lead_status = 'in_trattativa') as in_negotiation,
        COUNT(*) FILTER (WHERE lr.lead_status = 'non_interessato') as not_interested,
        COUNT(*) FILTER (WHERE lr.lead_status = 'nuovo' AND lr.ai_compatibility_score IS NOT NULL) as qualified_waiting
      FROM lead_scraper_results lr
      JOIN lead_scraper_searches ls ON lr.search_id = ls.id
      WHERE ls.consultant_id = ${consultantId}
    `);
    const statsRow = statsResult.rows[0] as any || {};

    const taskCountsResult = await db.execute(sql`
      SELECT
        status,
        preferred_channel,
        COUNT(*)::int as count
      FROM ai_scheduled_tasks
      WHERE consultant_id = ${consultantId}
        AND task_category = 'prospecting'
        AND preferred_channel IN ('voice', 'whatsapp', 'email')
        AND created_at >= CURRENT_DATE - INTERVAL '7 days'
      GROUP BY status, preferred_channel
    `);

    const channelTasks: Record<string, { tasks: any[]; byStatus: Record<string, number> }> = {
      voice: { tasks: [], byStatus: {} },
      whatsapp: { tasks: [], byStatus: {} },
      email: { tasks: [], byStatus: {} },
    };
    for (const row of taskCountsResult.rows as any[]) {
      if (channelTasks[row.preferred_channel]) {
        channelTasks[row.preferred_channel].byStatus[row.status] = row.count;
      }
    }

    function parseCtx(raw: any): Record<string, any> {
      if (!raw) return {};
      if (typeof raw === 'object') return raw;
      try { return JSON.parse(raw); } catch { return {}; }
    }

    const pendingTasksResult = await db.execute(sql`
      SELECT
        ast.id, ast.contact_name, ast.status, ast.preferred_channel, ast.origin_type,
        ast.scheduled_at, ast.created_at, ast.completed_at, ast.result_summary,
        ast.additional_context, ast.ai_instruction
      FROM ai_scheduled_tasks ast
      WHERE ast.consultant_id = ${consultantId}
        AND ast.task_category = 'prospecting'
        AND ast.preferred_channel IN ('voice', 'whatsapp', 'email')
        AND ast.status IN ('waiting_approval', 'scheduled', 'in_progress', 'approved')
      ORDER BY
        CASE ast.status
          WHEN 'in_progress' THEN 0
          WHEN 'waiting_approval' THEN 1
          WHEN 'approved' THEN 2
          WHEN 'scheduled' THEN 3
        END,
        ast.scheduled_at ASC
      LIMIT 30
    `);

    for (const task of pendingTasksResult.rows as any[]) {
      const ch = task.preferred_channel;
      if (channelTasks[ch]) {
        const ctx = parseCtx(task.additional_context);
        channelTasks[ch].tasks.push({
          id: task.id,
          title: task.contact_name || task.ai_instruction?.substring(0, 60) || 'Task',
          status: task.status,
          channel: ch,
          aiRole: task.origin_type,
          scheduledAt: task.scheduled_at,
          createdAt: task.created_at,
          completedAt: task.completed_at,
          resultSummary: task.result_summary,
          aiInstruction: task.ai_instruction || null,
          leadName: ctx.lead_count > 1 ? `${ctx.business_name || 'Lead'} (+${ctx.lead_count - 1})` : (ctx.business_name || task.contact_name || 'Lead'),
          leadScore: ctx.ai_score || null,
          leadSector: ctx.sector || null,
          leadId: ctx.lead_id || null,
          voiceTemplateName: ctx.voice_template_name || null,
          callInstruction: ctx.call_instruction || null,
          waTemplateName: ctx.wa_template_name || null,
          waPreviewMessage: ctx.wa_preview_message || null,
          waTemplateFilled: ctx.wa_template_filled || null,
          waTemplateBody: ctx.wa_template_body || null,
          waTemplateSid: ctx.wa_template_sid || null,
          emailTemplateName: ctx.email_template_name || null,
        });
      }
    }

    const recentCompletedResult = await db.execute(sql`
      SELECT
        ast.id, ast.contact_name, ast.status, ast.preferred_channel, ast.origin_type,
        ast.completed_at, ast.result_summary, ast.additional_context, ast.ai_instruction
      FROM ai_scheduled_tasks ast
      WHERE ast.consultant_id = ${consultantId}
        AND ast.task_category = 'prospecting'
        AND ast.preferred_channel IN ('voice', 'whatsapp', 'email')
        AND ast.status IN ('completed', 'failed')
        AND ast.completed_at >= CURRENT_DATE - INTERVAL '3 days'
      ORDER BY ast.completed_at DESC
      LIMIT 15
    `);

    for (const task of recentCompletedResult.rows as any[]) {
      const ch = task.preferred_channel;
      if (channelTasks[ch]) {
        const ctx = parseCtx(task.additional_context);
        channelTasks[ch].tasks.push({
          id: task.id,
          title: task.contact_name || task.ai_instruction?.substring(0, 60) || 'Task',
          status: task.status,
          channel: ch,
          aiRole: task.origin_type,
          scheduledAt: null,
          createdAt: null,
          completedAt: task.completed_at,
          resultSummary: task.result_summary,
          aiInstruction: task.ai_instruction || null,
          leadName: ctx.lead_count > 1 ? `${ctx.business_name || 'Lead'} (+${ctx.lead_count - 1})` : (ctx.business_name || task.contact_name || 'Lead'),
          leadScore: ctx.ai_score || null,
          leadSector: ctx.sector || null,
          leadId: ctx.lead_id || null,
          voiceTemplateName: ctx.voice_template_name || null,
          callInstruction: ctx.call_instruction || null,
          waTemplateName: ctx.wa_template_name || null,
          waPreviewMessage: ctx.wa_preview_message || null,
          waTemplateFilled: ctx.wa_template_filled || null,
          waTemplateBody: ctx.wa_template_body || null,
          waTemplateSid: ctx.wa_template_sid || null,
          emailTemplateName: ctx.email_template_name || null,
        });
      }
    }

    const activityResult = await db.execute(sql`
      SELECT id, type, title, description, metadata, created_at
      FROM lead_scraper_activities
      WHERE consultant_id = ${consultantId}
        AND created_at >= CURRENT_DATE - INTERVAL '3 days'
      ORDER BY created_at DESC
      LIMIT 30
    `);

    const kpiResult = await db.execute(sql`
      SELECT
        COUNT(*) FILTER (WHERE type IN ('voice_call_answered', 'voice_call_completed')) as voice_answered,
        COUNT(*) FILTER (WHERE type LIKE 'voice_call_%') as voice_total,
        COUNT(*) FILTER (WHERE type = 'whatsapp_sent') as wa_sent,
        COUNT(*) FILTER (WHERE type IN ('whatsapp_sent', 'whatsapp_failed')) as wa_total,
        COUNT(*) FILTER (WHERE type = 'email_sent') as email_sent,
        COUNT(*) FILTER (WHERE type IN ('email_sent', 'email_failed')) as email_total
      FROM lead_scraper_activities
      WHERE consultant_id = ${consultantId}
        AND created_at >= CURRENT_DATE - INTERVAL '7 days'
    `);
    const kpiRow = kpiResult.rows[0] as any || {};

    const convertedResult = await db.execute(sql`
      SELECT COUNT(*) as converted
      FROM lead_scraper_results lr
      JOIN lead_scraper_searches ls ON lr.search_id = ls.id
      WHERE ls.consultant_id = ${consultantId}
        AND lr.lead_status IN ('in_trattativa', 'chiuso_vinto')
        AND lr.created_at >= CURRENT_DATE - INTERVAL '7 days'
    `);
    const convertedCount = parseInt((convertedResult.rows[0] as any)?.converted || '0');

    const avgTimeResult = await db.execute(sql`
      SELECT AVG(EXTRACT(EPOCH FROM (la.created_at - lr.created_at)) / 3600) as avg_hours
      FROM lead_scraper_activities la
      JOIN lead_scraper_results lr ON la.lead_id::text = lr.id::text
      JOIN lead_scraper_searches ls ON lr.search_id = ls.id
      WHERE ls.consultant_id = ${consultantId}
        AND la.type IN ('voice_call_answered', 'voice_call_completed', 'voice_call_no_answer', 'whatsapp_sent', 'email_sent')
        AND la.created_at >= CURRENT_DATE - INTERVAL '7 days'
        AND la.created_at = (
          SELECT MIN(la2.created_at)
          FROM lead_scraper_activities la2
          WHERE la2.lead_id::text = lr.id::text
            AND la2.type IN ('voice_call_answered', 'voice_call_completed', 'voice_call_no_answer', 'whatsapp_sent', 'email_sent')
        )
    `);
    const avgTimeToFirstContact = parseFloat((avgTimeResult.rows[0] as any)?.avg_hours || '0');

    const voiceTotal = parseInt(kpiRow.voice_total || '0');
    const voiceAnswered = parseInt(kpiRow.voice_answered || '0');
    const waTotal = parseInt(kpiRow.wa_total || '0');
    const waSent = parseInt(kpiRow.wa_sent || '0');
    const emailTotal = parseInt(kpiRow.email_total || '0');
    const emailSent = parseInt(kpiRow.email_sent || '0');

    const kpis = {
      callResponseRate: voiceTotal > 0 ? Math.round((voiceAnswered / voiceTotal) * 100) : 0,
      waDeliveryRate: waTotal > 0 ? Math.round((waSent / waTotal) * 100) : 0,
      emailDeliveryRate: emailTotal > 0 ? Math.round((emailSent / emailTotal) * 100) : 0,
      leadsConvertedThisWeek: convertedCount,
      avgTimeToFirstContact: Math.round(avgTimeToFirstContact * 10) / 10,
    };

    return res.json({
      stats: {
        foundToday: parseInt(statsRow.found_today || '0'),
        scoredToday: parseInt(statsRow.scored_today || '0'),
        inOutreach: parseInt(statsRow.in_outreach || '0'),
        contacted: parseInt(statsRow.contacted || '0'),
        inNegotiation: parseInt(statsRow.in_negotiation || '0'),
        notInterested: parseInt(statsRow.not_interested || '0'),
        qualifiedWaiting: parseInt(statsRow.qualified_waiting || '0'),
      },
      channels: {
        voice: {
          used: usage.calls,
          limit: limits.maxCallsPerDay,
          remaining: remaining.calls,
          byStatus: channelTasks.voice.byStatus,
          tasks: channelTasks.voice.tasks,
        },
        whatsapp: {
          used: usage.whatsapp,
          limit: limits.maxWhatsappPerDay,
          remaining: remaining.whatsapp,
          byStatus: channelTasks.whatsapp.byStatus,
          tasks: channelTasks.whatsapp.tasks,
        },
        email: {
          used: usage.email,
          limit: limits.maxEmailsPerDay,
          remaining: remaining.email,
          byStatus: channelTasks.email.byStatus,
          tasks: channelTasks.email.tasks,
        },
      },
      searches: {
        used: usage.searches,
        limit: limits.maxSearchesPerDay,
        remaining: remaining.searches,
      },
      recentActivity: (activityResult.rows as any[]).map(a => ({
        id: a.id,
        type: a.type,
        title: a.title,
        description: a.description,
        metadata: a.metadata,
        createdAt: a.created_at,
      })),
      kpis,
    });
  } catch (error: any) {
    console.error("[AI-AUTONOMY] Error fetching hunter pipeline:", error);
    return res.status(500).json({ error: "Failed to fetch hunter pipeline" });
  }
});

const hunterPlansCache = new Map<string, { plan: any; createdAt: number; consultantId: string }>();
setInterval(() => {
  const now = Date.now();
  for (const [id, entry] of hunterPlansCache) {
    if (now - entry.createdAt > 30 * 60 * 1000) hunterPlansCache.delete(id);
  }
}, 5 * 60 * 1000);

async function getActionableCrmLeads(consultantId: string, scoreThreshold: number, outreachConfig?: any) {
  const leadSourceFilter = outreachConfig?.lead_source_filter;
  const sourceCondition = leadSourceFilter && leadSourceFilter !== 'both'
    ? sql`AND ls.origin_role = ${leadSourceFilter}`
    : sql``;

  const leadsResult = await db.execute(sql`
    SELECT
      lr.id, lr.business_name, lr.phone, lr.email, lr.category, lr.website, lr.address,
      lr.rating, lr.reviews_count, lr.ai_compatibility_score, lr.ai_sales_summary,
      lr.lead_status, lr.outreach_task_id, lr.website_data, lr.created_at,
      lr.lead_next_action, lr.lead_next_action_date, lr.lead_notes,
      (
        SELECT MAX(la.created_at)
        FROM lead_scraper_activities la
        WHERE la.lead_id::text = lr.id::text
          AND la.type IN ('voice_call_answered', 'voice_call_completed', 'voice_call_no_answer',
                         'whatsapp_sent', 'whatsapp_failed', 'email_sent', 'email_failed',
                         'outreach_assigned', 'crm_reanalysis',
                         'chiamata', 'whatsapp_inviato', 'email_inviata')
      ) as last_activity_at,
      (
        SELECT json_agg(
          json_build_object(
            'channel', la2.type,
            'date', to_char(la2.created_at AT TIME ZONE 'Europe/Rome', 'DD/MM/YY HH24:MI')
          ) ORDER BY la2.created_at DESC
        )
        FROM (
          SELECT DISTINCT ON (la3.type) la3.type, la3.created_at
          FROM lead_scraper_activities la3
          WHERE la3.lead_id::text = lr.id::text
            AND la3.type IN ('voice_call_answered', 'voice_call_completed', 'voice_call_no_answer',
                             'whatsapp_sent', 'email_sent', 'chiamata', 'whatsapp_inviato', 'email_inviata')
          ORDER BY la3.type, la3.created_at DESC
        ) la2
      ) as last_contacts_by_channel
    FROM lead_scraper_results lr
    JOIN lead_scraper_searches ls ON lr.search_id = ls.id
    WHERE ls.consultant_id = ${consultantId}
      AND lr.lead_status IN ('nuovo', 'contattato', 'in_outreach', 'in_trattativa')
      AND lr.ai_compatibility_score IS NOT NULL
      AND lr.ai_compatibility_score >= ${scoreThreshold}
      ${sourceCondition}
    ORDER BY lr.ai_compatibility_score DESC
    LIMIT 200
  `);

  const now = new Date();
  const actionableLeads: any[] = [];
  const skipReasons = {
    withActiveTask: 0,
    tooRecent: 0,
    recentlyContacted: 0,
    recentNegotiation: 0,
    inOutreachActive: 0,
  };

  for (const lead of leadsResult.rows as any[]) {
    const daysSinceCreated = (now.getTime() - new Date(lead.created_at).getTime()) / (1000 * 60 * 60 * 24);
    const daysSinceActivity = lead.last_activity_at
      ? (now.getTime() - new Date(lead.last_activity_at).getTime()) / (1000 * 60 * 60 * 24)
      : null;

    let hasActiveTask = false;
    if (lead.outreach_task_id) {
      const taskCheck = await db.execute(sql`
        SELECT status, created_at FROM ai_scheduled_tasks
        WHERE id = ${lead.outreach_task_id}
          AND (
            status IN ('scheduled', 'in_progress', 'approved')
            OR (status = 'waiting_approval' AND created_at > NOW() - INTERVAL '24 hours')
          )
        LIMIT 1
      `);
      hasActiveTask = taskCheck.rows.length > 0;
    }

    const cooldownNewDays = (outreachConfig?.cooldown_new_hours ?? 24) / 24;
    const cooldownContactedDays = outreachConfig?.cooldown_contacted_days ?? 5;
    const cooldownNegotiationDays = outreachConfig?.cooldown_negotiation_days ?? 7;

    let actionable = false;
    let reason = '';

    if (lead.lead_status === 'nuovo' && daysSinceCreated > cooldownNewDays && !hasActiveTask) {
      actionable = true;
      reason = `Lead nuovo con score ${lead.ai_compatibility_score}/100, creato ${Math.round(daysSinceCreated)} giorni fa, mai contattato`;
    } else if (lead.lead_status === 'nuovo' && daysSinceCreated <= cooldownNewDays) {
      skipReasons.tooRecent++;
    } else if (lead.lead_status === 'contattato' && daysSinceActivity !== null && daysSinceActivity > cooldownContactedDays && !hasActiveTask) {
      actionable = true;
      reason = `Lead contattato ${Math.round(daysSinceActivity)} giorni fa senza follow-up`;
    } else if (lead.lead_status === 'contattato' && daysSinceActivity !== null && daysSinceActivity <= cooldownContactedDays) {
      skipReasons.recentlyContacted++;
    } else if (lead.lead_status === 'in_trattativa' && daysSinceActivity !== null && daysSinceActivity > cooldownNegotiationDays && !hasActiveTask) {
      actionable = true;
      reason = `Lead in trattativa fermo da ${Math.round(daysSinceActivity)} giorni`;
    } else if (lead.lead_status === 'in_trattativa' && daysSinceActivity !== null && daysSinceActivity <= cooldownNegotiationDays) {
      skipReasons.recentNegotiation++;
    } else if (lead.lead_status === 'in_outreach' && lead.outreach_task_id && !hasActiveTask) {
      actionable = true;
      reason = `Lead rimasto in outreach con task completato/fallito — da ricontattare`;
    } else if (lead.lead_status === 'in_outreach' && hasActiveTask) {
      skipReasons.inOutreachActive++;
    } else if (hasActiveTask) {
      skipReasons.withActiveTask++;
    }

    if (actionable) {
      const lastContactsByChannel: any[] = lead.last_contacts_by_channel || [];
      const lastContactsSummary = lastContactsByChannel.length > 0
        ? lastContactsByChannel.map((c: any) => {
            const channelLabel: Record<string, string> = {
              'voice_call_answered': 'chiamata risposta',
              'voice_call_completed': 'chiamata',
              'voice_call_no_answer': 'chiamata non risposta',
              'whatsapp_sent': 'WhatsApp',
              'email_sent': 'email',
              'chiamata': 'chiamata',
              'whatsapp_inviato': 'WhatsApp',
              'email_inviata': 'email',
            };
            return `${channelLabel[c.channel] || c.channel} il ${c.date}`;
          }).join(', ')
        : 'mai contattato';

      actionableLeads.push({
        id: lead.id,
        businessName: lead.business_name,
        phone: lead.phone,
        email: lead.email,
        category: lead.category,
        website: lead.website,
        address: lead.address,
        rating: lead.rating,
        reviewsCount: lead.reviews_count,
        score: lead.ai_compatibility_score,
        salesSummary: lead.ai_sales_summary ? lead.ai_sales_summary.substring(0, 500) : null,
        consultantNotes: lead.lead_notes || '',
        leadStatus: lead.lead_status,
        daysSinceLastContact: daysSinceActivity !== null ? Math.round(daysSinceActivity) : null,
        daysSinceCreated: Math.round(daysSinceCreated),
        lastContacts: lastContactsSummary,
        reason,
      });
    }
  }

  return { totalAnalyzed: leadsResult.rows.length, actionableLeads, skipReasons };
}

interface WaTemplateForOutreach {
  sid: string;
  name: string;
  bodyText: string;
  variables: { position: number; variableKey: string; variableName: string }[];
}

function titleCaseName(name: string): string {
  return name.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
}

async function loadSelectedWaTemplates(consultantId: string, templateSids: string[]): Promise<WaTemplateForOutreach[]> {
  if (!templateSids || templateSids.length === 0) return [];
  try {
    const result = await db.execute(sql`
      SELECT t.template_name, v.twilio_content_sid, v.body_text, v.id as version_id
      FROM whatsapp_custom_templates t
      INNER JOIN whatsapp_template_versions v ON v.template_id = t.id AND v.is_active = true
      WHERE t.consultant_id = ${consultantId}
        AND v.twilio_content_sid IN ${sql`(${sql.join(templateSids.map(s => sql`${s}`), sql`, `)})`}
        AND v.twilio_content_sid IS NOT NULL AND v.twilio_content_sid != ''
    `);

    const templates: WaTemplateForOutreach[] = [];
    for (const row of result.rows as any[]) {
      let variables: { position: number; variableKey: string; variableName: string }[] = [];
      try {
        const varsResult = await db.execute(sql`
          SELECT tv.position, vc.variable_key, vc.variable_name
          FROM whatsapp_template_variables tv
          INNER JOIN whatsapp_variable_catalog vc ON vc.id = tv.variable_catalog_id
          WHERE tv.template_version_id = ${row.version_id}
          ORDER BY tv.position
        `);
        variables = (varsResult.rows as any[]).map(v => ({
          position: v.position,
          variableKey: v.variable_key,
          variableName: v.variable_name,
        }));
      } catch {}
      templates.push({
        sid: row.twilio_content_sid,
        name: row.template_name,
        bodyText: row.body_text || '',
        variables,
      });
    }
    console.log(`[HUNTER] Loaded ${templates.length} WA templates for outreach`);
    return templates;
  } catch (err: any) {
    console.error('[HUNTER] Failed to load WA templates:', err.message);
    return [];
  }
}

function buildLeadContext(lead: any, consultantName: string, salesCtx: any, talkingPoints?: string[], outreachConfig?: any): string {
  const lines = [
    `━━━ CONTESTO LEAD (da CRM Hunter) ━━━`,
    `Nome attività: ${lead.businessName || 'N/D'}`,
    lead.category ? `Settore: ${lead.category}` : '',
    lead.score ? `Score compatibilità: ${lead.score}/100` : '',
    lead.website ? `Sito web: ${lead.website}` : '',
    lead.address ? `Zona: ${lead.address}` : '',
    lead.phone ? `Telefono: ${lead.phone}` : '',
    lead.email ? `Email: ${lead.email}` : '',
    lead.salesSummary ? `Analisi AI del lead: ${lead.salesSummary}` : '',
    lead.aiReason || lead.reason ? `Motivo del contatto: ${lead.aiReason || lead.reason}` : '',
    talkingPoints?.length ? `Talking points suggeriti: ${talkingPoints.join('; ')}` : '',
    lead.consultantNotes ? `📝 Note personalizzate del consulente: ${lead.consultantNotes}` : '',
    `━━━ CONSULENTE ━━━`,
    `Nome consulente: ${consultantName}`,
    salesCtx.services_offered ? `Servizi offerti: ${salesCtx.services_offered}` : '',
    salesCtx.target_audience ? `Target: ${salesCtx.target_audience}` : '',
    salesCtx.value_proposition ? `Proposta di valore: ${salesCtx.value_proposition}` : '',
    salesCtx.competitive_advantages ? `Vantaggi competitivi: ${salesCtx.competitive_advantages}` : '',
    outreachConfig?.call_instruction_template ? `Istruzioni aggiuntive: ${outreachConfig.call_instruction_template}` : '',
    outreachConfig?.opening_hook ? `Approccio di apertura: ${outreachConfig.opening_hook}` : '',
  ].filter(Boolean).join('\n');
  return lines;
}

const DETERMINISTIC_VARS: Record<string, (lead: any, consultantName: string, consultantBusinessName?: string) => string> = {
  nome_lead: (lead) => lead.contactName || lead.businessName || 'Cliente',
  cognome_lead: (lead) => lead.lastName || '',
  nome_consulente: (_lead, consultantName) => consultantName,
  nome_azienda: (_lead, consultantName, consultantBusinessName) => consultantBusinessName || consultantName,
};

function extractTemplateVariables(bodyText: string): string[] {
  const vars: string[] = [];
  const regex = /\{([a-z_]+)\}/g;
  let match;
  while ((match = regex.exec(bodyText)) !== null) {
    if (!vars.includes(match[1])) vars.push(match[1]);
  }
  return vars;
}

async function resolveTemplateVariables(
  templateBodyText: string,
  lead: any,
  consultantName: string,
  consultantBusinessName?: string,
  outreachConfig?: any,
  templateSid?: string,
  consultantId?: string,
  salesCtx?: any
): Promise<{ resolved: Record<string, string>; sources: Record<string, string> }> {
  const neededVars = extractTemplateVariables(templateBodyText);
  const resolved: Record<string, string> = {};
  const sources: Record<string, string> = {};

  for (const varKey of neededVars) {
    const deterministicFn = DETERMINISTIC_VARS[varKey];
    if (deterministicFn) {
      resolved[varKey] = deterministicFn(lead, consultantName, consultantBusinessName);
      sources[varKey] = 'deterministic';
    }
  }

  const dynamicVars = neededVars.filter(v => !resolved[v]);

  if (dynamicVars.length === 0) {
    console.log(`[HUNTER] Template vars for "${lead.businessName}": all deterministic — ${JSON.stringify(resolved)}`);
    return { resolved, sources };
  }

  const salesSummaryStr = lead.salesSummary || '';
  const websiteDataStr = lead.websiteData ? (typeof lead.websiteData === 'string' ? lead.websiteData : JSON.stringify(lead.websiteData)) : '';
  const scrapeDataStr = lead.scrapeData ? (typeof lead.scrapeData === 'string' ? lead.scrapeData : JSON.stringify(lead.scrapeData)) : '';
  const hasAnyContext = salesSummaryStr.length > 20 || websiteDataStr.length > 20 || scrapeDataStr.length > 20 || (lead.website && lead.category);

  console.log(`[HUNTER] 🔍 Template vars agent for "${lead.businessName}": ${dynamicVars.length} vars to resolve [${dynamicVars.join(', ')}] | salesSummary=${salesSummaryStr.length}chars, websiteData=${websiteDataStr.length}chars, scrapeData=${scrapeDataStr.length}chars, website=${lead.website || 'N/D'}, category=${lead.category || 'N/D'}, hasAnyContext=${hasAnyContext}`);

  if (!hasAnyContext) {
    console.error(`[HUNTER] ⚠️ NESSUN CONTESTO DISPONIBILE per generare variabili AI per "${lead.businessName}" — le variabili [${dynamicVars.join(', ')}] NON saranno risolte.`);
    for (const v of dynamicVars) {
      resolved[v] = '';
      sources[v] = 'UNRESOLVED_NO_CONTEXT';
    }
    return { resolved, sources };
  }

  try {
    const { quickGenerate } = await import("../ai/provider-factory");

    const prefilledPreview = templateBodyText.replace(/\{([a-z_]+)\}/g, (match, key) => {
      return resolved[key] ? resolved[key] : match;
    });

    const contextBlocks = [
      `AZIENDA TARGET: "${lead.businessName}"`,
      lead.contactName ? `Referente/Proprietario: ${lead.contactName}` : '',
      lead.category ? `Settore: ${lead.category}` : '',
      lead.website ? `Sito web: ${lead.website}` : '',
      lead.address ? `Zona: ${lead.address}` : '',
      lead.rating ? `Rating Google: ${lead.rating}/5` : '',
      lead.reviewCount ? `Recensioni: ${lead.reviewCount}` : '',
      lead.phone ? `Telefono: ${lead.phone}` : '',
    ].filter(Boolean).join('\n');

    const consultantBlocks = [
      salesCtx?.services_offered ? `SERVIZI DEL CONSULENTE: ${salesCtx.services_offered}` : '',
      salesCtx?.value_proposition ? `PROPOSTA DI VALORE: ${salesCtx.value_proposition}` : '',
      salesCtx?.target_audience ? `TARGET DEL CONSULENTE: ${salesCtx.target_audience}` : '',
      salesCtx?.competitive_advantages ? `VANTAGGI COMPETITIVI: ${salesCtx.competitive_advantages}` : '',
    ].filter(Boolean).join('\n');

    const analysisBlocks = [
      salesSummaryStr ? `ANALISI COMMERCIALE (dal CRM di Hunter):\n${salesSummaryStr.substring(0, 500)}` : '',
      websiteDataStr ? `DATI ESTRATTI DAL SITO WEB:\n${websiteDataStr.substring(0, 400)}` : '',
      scrapeDataStr ? `DATI SCRAPING GOOGLE:\n${scrapeDataStr.substring(0, 300)}` : '',
    ].filter(Boolean).join('\n\n');

    const hookInstructions = outreachConfig?.opening_hook
      ? `\nNOTA: Il consulente preferisce questo approccio di apertura: "${outreachConfig.opening_hook}". Tienine conto quando generi i valori.`
      : '';

    const templateHookNote = templateSid && outreachConfig?.template_hooks?.[templateSid]
      ? `\nNOTA: Per questo template specifico il consulente ha suggerito: "${outreachConfig.template_hooks[templateSid]}". Usa questo come ispirazione.`
      : '';

    const uncinoInstruction = dynamicVars.includes('uncino')
      ? `\nREGOLA CRITICA PER {uncino}: L'uncino deve comunicare un BENEFICIO CONCRETO che il consulente può portare al lead — cosa può automatizzare, migliorare o risolvere nella loro operatività. NON deve essere un complimento sul loro modello di business o sulla loro attività. NON scrivere cose come "il vostro modello è rivoluzionario" o "la vostra innovazione". Scrivi invece cosa puoi fare PER LORO: risparmio di tempo, automazione di processi, aumento di efficienza operativa, più velocità. Usa i servizi e la proposta di valore del consulente come riferimento. Esempio corretto: "automatizzare la pre-qualifica dei candidati e la presa appuntamenti, liberando ore operative per ogni recruiter".`
      : '';

    const prompt = [
      `Sei un agente AI specializzato nella personalizzazione di messaggi WhatsApp commerciali.`,
      ``,
      `IL TUO COMPITO: Analizza il template qui sotto, capisci il contesto e il significato di OGNI variabile tra {}, e genera valori SPECIFICI e CONCRETI per questa azienda basandoti sull'analisi disponibile.`,
      ``,
      `TEMPLATE MESSAGGIO (le variabili tra {} vanno sostituite):`,
      `"${prefilledPreview}"`,
      ``,
      `VARIABILI DA GENERARE: ${dynamicVars.map(v => `{${v}}`).join(', ')}`,
      ``,
      contextBlocks,
      ``,
      consultantBlocks,
      ``,
      analysisBlocks,
      hookInstructions,
      templateHookNote,
      uncinoInstruction,
      ``,
      `OBIETTIVO DI HUNTER: Questo messaggio è il primo contatto con un lead trovato automaticamente. L'obiettivo è incuriosire il destinatario, dimostrare che conosci la sua attività, e ottenere una risposta.`,
      ``,
      `ISTRUZIONI PER L'AGENTE:`,
      `1. Leggi il template INTERO e capisci il contesto grammaticale e semantico di OGNI variabile`,
      `2. Per ogni variabile, il valore DEVE inserirsi naturalmente nella frase — rispetta genere, numero, preposizioni`,
      `3. Usa DETTAGLI REALI e SPECIFICI trovati nell'analisi: nomi di servizi, prodotti, numeri, contenuti pubblicati, tool usati`,
      `4. MAI frasi generiche tipo "l'innovazione nel settore", "la crescita della tua attività", "i tuoi obiettivi" — queste frasi sono VIETATE`,
      `5. Ogni valore deve essere breve (max 10-12 parole) e suonare naturale, come scritto da un umano`,
      `6. NON usare virgolette nei valori, NON ripetere il nome dell'azienda, NON usare punti finali`,
      `7. Scrivi in italiano naturale e professionale`,
      ``,
      `Rispondi SOLO con un JSON valido. Nessun testo prima o dopo. Esempio:`,
      `${JSON.stringify(Object.fromEntries(dynamicVars.map(v => [v, "valore specifico"])))}`,
    ].join('\n');

    const parseAiVarsResponse = (text: string): Record<string, string> | null => {
      if (!text) return null;
      let cleaned = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
      let jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try { return JSON.parse(jsonMatch[0]); } catch {}
      }
      const partialMatch = cleaned.match(/\{[\s\S]*/);
      if (partialMatch) {
        let partial = partialMatch[0];
        if (!partial.endsWith('}')) {
          const lastQuote = partial.lastIndexOf('"');
          if (lastQuote > 0) {
            partial = partial.substring(0, lastQuote + 1) + '}';
          } else {
            partial = partial + '"}';
          }
        }
        try { return JSON.parse(partial); } catch {}
        const kvMatch = partial.match(/"([^"]+)"\s*:\s*"([^"]*)"/g);
        if (kvMatch) {
          const result: Record<string, string> = {};
          for (const kv of kvMatch) {
            const m = kv.match(/"([^"]+)"\s*:\s*"([^"]*)"/);
            if (m) result[m[1]] = m[2];
          }
          if (Object.keys(result).length > 0) return result;
        }
      }
      return null;
    };

    let resultText: string | undefined;
    let parsed: Record<string, string> | null = null;

    for (let attempt = 1; attempt <= 2; attempt++) {
      const shortPrompt = attempt === 2
        ? [
          `Genera un JSON con i valori per queste variabili del template WhatsApp.`,
          `Template: "${prefilledPreview}"`,
          `Azienda: ${lead.businessName} (${lead.category || 'N/D'})`,
          salesSummaryStr ? `Analisi: ${salesSummaryStr.substring(0, 400)}` : '',
          `Variabili: ${dynamicVars.join(', ')}`,
          `Rispondi SOLO con JSON. Esempio: ${JSON.stringify(Object.fromEntries(dynamicVars.map(v => [v, "valore"])))}`,
        ].filter(Boolean).join('\n')
        : prompt;

      const aiResult = await quickGenerate({
        consultantId: consultantId || 'system',
        feature: 'hunter-template-vars',
        contents: [{ role: 'user', parts: [{ text: shortPrompt }] }],
        generationConfig: { maxOutputTokens: 5000, temperature: attempt === 1 ? 0.5 : 0.7 },
      });

      resultText = aiResult?.text;
      console.log(`[HUNTER] 🤖 AI agent attempt ${attempt} for "${lead.businessName}": "${resultText?.substring(0, 400) || 'NULL'}"`);

      parsed = parseAiVarsResponse(resultText || '');
      if (parsed && dynamicVars.some(v => parsed![v])) {
        console.log(`[HUNTER] ✅ AI agent parsed (attempt ${attempt}): ${JSON.stringify(parsed)}`);
        break;
      }

      if (attempt === 1) {
        console.warn(`[HUNTER] ⚠️ AI agent attempt 1 failed for "${lead.businessName}" — retrying with shorter prompt...`);
        parsed = null;
      }
    }

    if (parsed) {
      for (const v of dynamicVars) {
        const rawVal = parsed[v];
        if (rawVal) {
          const cleaned = String(rawVal).replace(/^["']|["']$/g, '').replace(/\.$/, '').replace(/\n/g, ' ').trim();
          if (cleaned.length > 2 && cleaned.length < 150) {
            resolved[v] = cleaned;
            sources[v] = 'ai_agent';
            console.log(`[HUNTER] ✅ {${v}} → "${cleaned}"`);
          } else {
            console.warn(`[HUNTER] ⚠️ {${v}} rejected (length=${cleaned.length}): "${cleaned}"`);
          }
        } else {
          console.warn(`[HUNTER] ⚠️ {${v}} not in AI response. Keys: [${Object.keys(parsed).join(', ')}]`);
        }
      }
    } else {
      console.error(`[HUNTER] ❌ AI agent failed for "${lead.businessName}" after 2 attempts. Raw: "${resultText?.substring(0, 300) || 'NULL'}"`);
    }
  } catch (err: any) {
    console.error(`[HUNTER] ❌ AI agent error for "${lead.businessName}": ${err.message}`);
  }

  for (const v of dynamicVars) {
    if (!resolved[v]) {
      console.error(`[HUNTER] ⚠️ VARIABILE {${v}} NON RISOLTA per lead "${lead.businessName}" — il messaggio conterrà un placeholder vuoto.`);
      resolved[v] = '';
      sources[v] = 'UNRESOLVED';
    }
  }

  const sourcesSummary = Object.entries(sources).map(([k, s]) => `${k}=${s}`).join(', ');
  console.log(`[HUNTER] Template vars for "${lead.businessName}": [${sourcesSummary}]`);
  console.log(`[HUNTER] Resolved values: ${JSON.stringify(resolved)}`);
  return { resolved, sources };
}

async function generateOutreachContent(
  consultantId: string,
  lead: any,
  channel: string,
  salesCtx: any,
  consultantName: string,
  talkingPoints?: string[],
  outreachConfig?: any,
  waTemplates?: WaTemplateForOutreach[],
  consultantBusinessName?: string
): Promise<{ channel: string; callScript?: string; callContext?: string; useTemplate?: boolean; whatsappMessage?: string; whatsappContext?: string; useWaTemplate?: boolean; wa_preview_message?: string; wa_template_name?: string; wa_template_sid?: string; wa_template_body?: string; wa_template_variables?: Record<string, string>; wa_template_filled?: string; emailSubject?: string; emailBody?: string; emailTemplateName?: string; leadId: string }> {

  const leadContext = buildLeadContext(lead, consultantName, salesCtx, talkingPoints, outreachConfig);

  if (channel === 'voice') {
    console.log(`[HUNTER] Voice: building lead context for ${lead.businessName} (no script generation, template will be used)`);
    return {
      channel,
      leadId: lead.id || lead.leadId,
      callContext: leadContext,
      useTemplate: true,
    };
  }

  if (channel === 'whatsapp' && (!waTemplates || waTemplates.length === 0)) {
    console.log(`[HUNTER] WhatsApp BLOCKED for "${lead.businessName}": no approved templates configured. Free-text WhatsApp is not allowed (risk of ban).`);
    throw new Error(`SKIP_CHANNEL:whatsapp:Nessun template WhatsApp approvato configurato. Configura almeno un template nelle impostazioni Hunter.`);
  }

  if (channel === 'whatsapp' && waTemplates && waTemplates.length > 0) {
    const selectedTemplate = waTemplates[Math.floor(Math.random() * waTemplates.length)];
    console.log(`[HUNTER] WhatsApp: template "${selectedTemplate.name}" selected for ${lead.businessName} (body: "${selectedTemplate.bodyText.substring(0, 120)}...")`);

    const { resolved: varMap, sources: varSources } = await resolveTemplateVariables(
      selectedTemplate.bodyText,
      lead,
      consultantName,
      consultantBusinessName,
      outreachConfig,
      selectedTemplate.sid,
      consultantId,
      salesCtx
    );

    let templateFilled = selectedTemplate.bodyText;
    for (const [key, val] of Object.entries(varMap)) {
      templateFilled = templateFilled.replace(new RegExp(`\\{${key}\\}`, 'g'), val);
    }

    const templateVariables: Record<string, string> = {};
    if (selectedTemplate.variables && selectedTemplate.variables.length > 0) {
      for (const v of selectedTemplate.variables) {
        const resolvedValue = varMap[v.variableKey] || '';
        templateVariables[String(v.position)] = resolvedValue;
        templateFilled = templateFilled.replace(new RegExp(`\\{\\{${v.position}\\}\\}`, 'g'), resolvedValue);
      }
    }

    console.log(`[HUNTER] WA template filled for "${lead.businessName}": "${templateFilled.substring(0, 200)}..." | Twilio vars: ${JSON.stringify(templateVariables)} | Sources: ${JSON.stringify(varSources)}`);

    return {
      channel,
      leadId: lead.id || lead.leadId,
      whatsappContext: leadContext,
      useWaTemplate: true,
      wa_preview_message: templateFilled,
      wa_template_name: selectedTemplate.name,
      wa_template_sid: selectedTemplate.sid,
      wa_template_body: selectedTemplate.bodyText,
      wa_template_variables: templateVariables,
      wa_template_filled: templateFilled,
    };
  }

  const { quickGenerate } = await import("../ai/provider-factory");

  const commStyle = outreachConfig?.communication_style || 'professionale';
  const customInstructions = outreachConfig?.custom_instructions || '';
  const emailSignature = outreachConfig?.email_signature || '';
  const openingHook = outreachConfig?.opening_hook || '';

  const styleMap: Record<string, string> = {
    formale: 'Tono FORMALE: usa il Lei, linguaggio istituzionale, zero emoji, frasi strutturate.',
    professionale: 'Tono PROFESSIONALE: cordiale ma competente, usa il Lei ma senza essere freddo. Linguaggio diretto.',
    informale: 'Tono INFORMALE: usa il tu, linguaggio colloquiale ma rispettoso. Puoi usare 1-2 emoji.',
    amichevole: 'Tono AMICHEVOLE: come un collega che scrive a un altro. Usa il tu, breve, diretto, umano.',
  };
  const styleInstruction = styleMap[commStyle] || styleMap.professionale;

  const leadInfo = [
    `LEAD: ${lead.businessName}`,
    lead.category ? `Settore: ${lead.category}` : '',
    lead.score ? `Score compatibilità: ${lead.score}/100` : '',
    lead.website ? `Sito: ${lead.website}` : '',
    lead.address ? `Zona: ${lead.address}` : '',
    lead.salesSummary ? `Note AI: ${lead.salesSummary}` : '',
    lead.aiReason || lead.reason ? `Motivo contatto: ${lead.aiReason || lead.reason}` : '',
    talkingPoints?.length ? `Talking points specifici: ${talkingPoints.join('; ')}` : '',
  ].filter(Boolean).join('\n');

  const contextInfo = [
    salesCtx.services_offered ? `SERVIZI DEL CONSULENTE: ${salesCtx.services_offered}` : '',
    salesCtx.target_audience ? `TARGET: ${salesCtx.target_audience}` : '',
    salesCtx.value_proposition ? `PROPOSTA DI VALORE: ${salesCtx.value_proposition}` : '',
    salesCtx.sales_approach ? `APPROCCIO: ${salesCtx.sales_approach}` : '',
    salesCtx.competitive_advantages ? `VANTAGGI: ${salesCtx.competitive_advantages}` : '',
    `NOME CONSULENTE: ${consultantName}`,
  ].filter(Boolean).join('\n');

  const customBlock = [
    styleInstruction,
    customInstructions ? `ISTRUZIONI PERSONALIZZATE DEL CONSULENTE (SEGUILE ATTENTAMENTE): ${customInstructions}` : '',
    openingHook ? `APPROCCIO DI APERTURA PREFERITO: Usa un approccio simile a: "${openingHook}"` : '',
  ].filter(Boolean).join('\n');

  const { selectBestTemplate, GOLDEN_RULES } = await import("../ai/email-templates-library");

  let emailTemplateBlock = '';
  let emailTemplateName: string | undefined;

  if (channel === 'email') {
    const hasWebsiteData = !!(lead.website || lead.websiteData || lead.scrapeData);
    const hasSpecificDetail = !!(lead.salesSummary || lead.aiReason || lead.reason || talkingPoints?.length);
    const scrapeStr = lead.scrapeData || lead.websiteData || lead.salesSummary || '';

    const emailTemplate = selectBestTemplate({
      stepNumber: 1,
      hasWebsiteData,
      hasSpecificDetail,
      sector: lead.category,
      scrapeData: scrapeStr,
      isReEngagement: false,
    });
    emailTemplateName = emailTemplate.name;

    emailTemplateBlock = [
      `\n📋 TEMPLATE DI RIFERIMENTO: "${emailTemplate.name}" (${emailTemplate.scenario})`,
      `Leva psicologica: ${emailTemplate.psychologicalLever}`,
      `Quando usarlo: ${emailTemplate.whenToUse}`,
      `\nOGGETTO DI ESEMPIO:\n${emailTemplate.subject}`,
      `\nCORPO DI ESEMPIO:\n${emailTemplate.body}`,
      `\n⚠️ ISTRUZIONI VINCOLANTI:`,
      `SEGUI ESATTAMENTE la struttura del template sopra.`,
      `Sostituisci TUTTI i placeholder ({contactName}, {businessName}, {sector}, {specificDetail}, {consultantName}, {consultantBusiness}, {serviceName}, {resultMetric}) con dati REALI del lead.`,
      `Puoi adattare singole frasi al contesto ma MANTIENI la struttura, il tono e la leva psicologica del template.`,
      `\n${GOLDEN_RULES}`,
    ].join('\n');

    console.log(`[HUNTER-CRM] Email template selected: "${emailTemplate.name}" (${emailTemplate.id}) for lead "${lead.businessName}"`);
  }

  const channelPrompts: Record<string, string> = {
    whatsapp: [
      `Genera un messaggio WhatsApp per ${lead.businessName}.`,
      `Rispondi SOLO con un JSON: { "whatsappMessage": "testo del messaggio" }`,
      `Il messaggio deve essere:`,
      `- Breve (max 3-4 frasi)`,
      `- Con un hook personalizzato che dimostri che HAI STUDIATO l'attività del lead`,
      `- CTA: proposta di breve chiamata o incontro`,
      `- NON generico, NON sembrare un bot. Scrivi come scriverebbe una persona vera.`,
      `NON usare emoji eccessivi, max 1-2.`,
    ].join('\n'),
    email: [
      `Genera un'email per ${lead.businessName}.`,
      `Rispondi SOLO con un JSON: { "emailSubject": "oggetto email", "emailBody": "corpo email in testo semplice" }`,
      emailTemplateBlock,
      `REGOLE AGGIUNTIVE:`,
      `- L'oggetto deve essere SPECIFICO per questo lead con un pattern interrupt (domanda, dato, riferimento specifico)`,
      `- Corpo: MINIMO 10 righe, MASSIMO 15 righe. Le email troppo corte (3-5 righe) sembrano spam automatizzato e non convertono.`,
      `- OBBLIGATORIO: includi almeno un NUMERO o PERCENTUALE concreto come social proof (es: "ridotto del 40%", "in 3 mesi", "recuperato il 35%"). Se non hai un dato reale, inventa un risultato plausibile per il settore.`,
      `- CTA con opzioni temporali concrete: "Preferisci giovedì mattina o venerdì pomeriggio?" — MAI "ti andrebbe una demo?" o CTA vaghi`,
      `- Prima riga: cita un DETTAGLIO SPECIFICO dell'attività del lead (non generico tipo "ho visto il vostro sito")`,
      `- NON iniziare con "Mi permetto di contattarLa" o frasi simili da telemarketing`,
      emailSignature ? `- FIRMA (aggiungi alla fine del corpo):\n${emailSignature}` : `- Firma: ${consultantName}`,
    ].join('\n'),
  };

  const aiResult = await quickGenerate({
    consultantId,
    feature: `hunter-outreach-${channel}`,
    thinkingLevel: 'low',
    systemInstruction: [
      `Sei Hunter, il copywriter commerciale di ${consultantName}. Scrivi come una PERSONA VERA — diretto, professionale, umano. NON come un software di marketing automation. Il tono è quello di un messaggio a un contatto LinkedIn che non conosci bene ma stimi. Niente frasi da brochure, niente complimenti esagerati, niente transizioni artificiali. Frasi corte e naturali, come le direbbe un collega a voce.`,
      contextInfo,
      customBlock,
      channelPrompts[channel] || channelPrompts.email,
    ].join('\n\n'),
    contents: [{ role: 'user', parts: [{ text: leadInfo }] }],
  });

  try {
    const cleaned = aiResult.text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const parsed = JSON.parse(cleaned);
    if (channel === 'email' && emailSignature && parsed.emailBody && !parsed.emailBody.includes(emailSignature.split('\n')[0])) {
      parsed.emailBody = parsed.emailBody.trimEnd() + '\n\n' + emailSignature;
    }
    return { channel, leadId: lead.id || lead.leadId, emailTemplateName, ...parsed };
  } catch {
    if (channel === 'whatsapp') return { channel, leadId: lead.id || lead.leadId, whatsappMessage: `Buongiorno! Sono ${consultantName}. Ho visto la vostra attività ${lead.businessName} e mi piacerebbe capire come posso esservi utile. Le va una breve chiamata?` };
    return { channel, leadId: lead.id || lead.leadId, emailTemplateName, emailSubject: `Proposta di collaborazione per ${lead.businessName}`, emailBody: `Buongiorno,\n\nMi chiamo ${consultantName} e mi occupo di consulenza finanziaria. Ho avuto modo di conoscere la vostra attività e credo di poter offrire valore concreto.\n\nLe andrebbe una breve chiamata per approfondire?\n\nCordiali saluti,\n${consultantName}` };
  }
}

async function findNextAvailableSlot(
  consultantId: string,
  channel: string,
  offsetIndex: number,
  timezone: string = 'Europe/Rome',
  outreachConfig?: any
): Promise<Date> {
  const now = new Date();

  const channelIntervals: Record<string, number> = {
    voice: outreachConfig?.voice_interval_minutes || 30,
    whatsapp: outreachConfig?.whatsapp_interval_minutes || 5,
    email: outreachConfig?.email_interval_minutes || 10,
  };
  const channelStartHours: Record<string, number> = {
    voice: parseInt((outreachConfig?.voice_start_hour || '09:00').split(':')[0]),
    whatsapp: parseInt((outreachConfig?.whatsapp_start_hour || '09:00').split(':')[0]),
    email: parseInt((outreachConfig?.email_start_hour || '08:00').split(':')[0]),
  };
  const channelEndHours: Record<string, number> = {
    voice: parseInt((outreachConfig?.voice_end_hour || '19:00').split(':')[0]),
    whatsapp: parseInt((outreachConfig?.whatsapp_end_hour || '20:00').split(':')[0]),
    email: parseInt((outreachConfig?.email_end_hour || '20:00').split(':')[0]),
  };

  const baseOffset = channelIntervals[channel] || 30;
  const slotDuration = baseOffset;
  const startHour = channelStartHours[channel] || 9;
  const endHour = channelEndHours[channel] || 19;

  const operatingDays: number[] = outreachConfig?.operating_days ?? [1, 2, 3, 4, 5];
  const operatingDaysSet = new Set(operatingDays.length > 0 ? operatingDays : [1, 2, 3, 4, 5]);

  const advanceToNextOperatingDay = (d: Date) => {
    for (let i = 0; i < 8; i++) {
      if (operatingDaysSet.has(d.getDay())) return;
      d.setDate(d.getDate() + 1);
      d.setHours(startHour, 0, 0, 0);
    }
  };

  let candidate = new Date(now.getTime() + (5 + offsetIndex * baseOffset) * 60000);

  const hour = candidate.getHours();
  if (hour < startHour) { candidate.setHours(startHour, 0, 0, 0); }
  else if (hour >= endHour) { candidate.setDate(candidate.getDate() + 1); candidate.setHours(startHour, 0, 0, 0); }

  advanceToNextOperatingDay(candidate);

  for (let attempt = 0; attempt < 20; attempt++) {
    const windowStart = new Date(candidate.getTime() - slotDuration * 60000);
    const windowEnd = new Date(candidate.getTime() + slotDuration * 60000);
    let hasConflict = false;

    try {
      if (channel === 'voice') {
        const conflict = await db.execute(sql`
          SELECT id FROM scheduled_voice_calls
          WHERE consultant_id = ${consultantId}
            AND status IN ('scheduled', 'pending')
            AND scheduled_at BETWEEN ${windowStart.toISOString()} AND ${windowEnd.toISOString()}
          LIMIT 1
        `);
        hasConflict = conflict.rows.length > 0;
      }

      if (!hasConflict) {
        const taskConflict = await db.execute(sql`
          SELECT id FROM ai_scheduled_tasks
          WHERE consultant_id = ${consultantId}
            AND preferred_channel = ${channel}
            AND status IN ('scheduled', 'waiting_approval', 'in_progress')
            AND scheduled_at BETWEEN ${windowStart.toISOString()} AND ${windowEnd.toISOString()}
          LIMIT 1
        `);
        hasConflict = taskConflict.rows.length > 0;
      }
    } catch { break; }

    if (!hasConflict) break;

    candidate = new Date(candidate.getTime() + slotDuration * 60000);
    const newHour = candidate.getHours();
    if (newHour >= endHour) { candidate.setDate(candidate.getDate() + 1); candidate.setHours(startHour, 0, 0, 0); }
    advanceToNextOperatingDay(candidate);
  }

  console.log(`[SLOT-FINDER] ${channel} → slot found: ${candidate.toISOString()} (offsetIndex=${offsetIndex})`);
  return candidate;
}

async function scheduleIndividualOutreach(
  consultantId: string,
  lead: any,
  channel: string,
  content: any,
  config: { voiceTemplateId: string | null; whatsappConfigId: string | null; emailAccountId: string | null; timezone: string; voiceTemplateName?: string; callInstructionTemplate?: string; outreachConfig?: any },
  mode: 'autonomous' | 'approval',
  slotIndex: number
): Promise<{ taskId: string; channel: string; leadName: string; status: string; scheduledAt: string; contentPreview: string }> {
  const leadName = lead.businessName || lead.business_name || 'Lead';
  const taskStatus = mode === 'autonomous' ? 'scheduled' : 'waiting_approval';
  console.log(`[HUNTER] Step 1/6: Finding slot for ${channel} → "${leadName}" (mode=${mode})`);
  const scheduledAt = await findNextAvailableSlot(consultantId, channel, slotIndex, config.timezone, config.outreachConfig);
  const scheduledAtIso = scheduledAt.toISOString();
  const taskId = `hunt_${channel.substring(0, 2)}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  console.log(`[HUNTER] Step 1/6: Slot found → ${scheduledAtIso} (taskId=${taskId}, status=${taskStatus})`);
  let contentPreview = '';

  if (channel === 'voice') {
    const callContext = content.callContext || content.callScript || '';
    const templateName = config.voiceTemplateName || 'Predefinito';
    contentPreview = `${leadName} — Template: ${templateName}`;
    const scheduledCallId = `svc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const voiceStatus = mode === 'autonomous' ? 'scheduled' : 'pending';

    await db.execute(sql`
      INSERT INTO scheduled_voice_calls (
        id, consultant_id, target_phone, scheduled_at, status, ai_mode,
        custom_prompt, call_instruction, instruction_type, attempts, max_attempts,
        priority, source_task_id, attempts_log, use_default_template, created_at, updated_at
      ) VALUES (
        ${scheduledCallId}, ${consultantId}, ${lead.phone || ''},
        ${scheduledAtIso}, ${voiceStatus}, 'outreach',
        ${null}, ${callContext},
        'task', 0, 3,
        2, ${taskId}, '[]'::jsonb, ${!config.voiceTemplateId}, NOW(), NOW()
      )
    `);
    console.log(`[HUNTER] Step 2/6: Created scheduled_voice_calls (id=${scheduledCallId}, status=${voiceStatus}, phone=${lead.phone || 'N/A'})`);

    const additionalContext = JSON.stringify({
      lead_id: lead.id || lead.leadId,
      business_name: leadName,
      ai_score: lead.score,
      sector: lead.category,
      website: lead.website || null,
      address: lead.address || null,
      ai_reason: lead.aiReason || lead.reason || null,
      sales_summary: lead.salesSummary || null,
      source: 'crm_analysis',
      voice_template_name: config.voiceTemplateName || null,
      voice_template_id: config.voiceTemplateId || null,
      call_instruction: config.callInstructionTemplate || null,
    });

    await db.execute(sql`
      INSERT INTO ai_scheduled_tasks (
        id, consultant_id, contact_phone, contact_name, task_type, ai_instruction,
        scheduled_at, timezone, status, priority, task_category, ai_role, preferred_channel,
        voice_call_id, additional_context, max_attempts, current_attempt, retry_delay_minutes,
        voice_template_id, created_at, updated_at
      ) VALUES (
        ${taskId}, ${consultantId}, ${lead.phone || ''}, ${leadName},
        'single_call', ${callContext},
        ${scheduledAtIso}, ${config.timezone}, ${taskStatus}, 2, 'prospecting', 'hunter', 'voice',
        ${scheduledCallId},
        ${additionalContext}::text,
        3, 0, 5, ${config.voiceTemplateId || null}, NOW(), NOW()
      )
    `);
    console.log(`[HUNTER] Step 3/6: Created ai_scheduled_task (id=${taskId}, type=single_call, status=${taskStatus})`);
  } else if (channel === 'whatsapp') {
    const isTemplateMode = content.useWaTemplate === true;
    const waInstruction = isTemplateMode ? (content.whatsappContext || '') : (content.whatsappMessage || '');
    contentPreview = isTemplateMode ? (content.wa_preview_message ? content.wa_preview_message.substring(0, 120) : `${leadName} — Template WA`) : waInstruction.substring(0, 120);

    const additionalContext = JSON.stringify({
      lead_id: lead.id || lead.leadId,
      business_name: leadName,
      ai_score: lead.score,
      sector: lead.category,
      website: lead.website || null,
      address: lead.address || null,
      ai_reason: lead.aiReason || lead.reason || null,
      sales_summary: lead.salesSummary || null,
      source: 'crm_analysis',
      use_wa_template: isTemplateMode,
      wa_preview_message: isTemplateMode ? (content.wa_preview_message || null) : null,
      wa_template_name: isTemplateMode ? (content.wa_template_name || null) : null,
      wa_template_sid: isTemplateMode ? (content.wa_template_sid || null) : null,
      wa_template_body: isTemplateMode ? (content.wa_template_body || null) : null,
      wa_template_variables: isTemplateMode ? (content.wa_template_variables || null) : null,
      wa_template_filled: isTemplateMode ? (content.wa_template_filled || null) : null,
    });

    await db.execute(sql`
      INSERT INTO ai_scheduled_tasks (
        id, consultant_id, contact_phone, contact_name, task_type, ai_instruction,
        scheduled_at, timezone, status, priority, task_category, ai_role, preferred_channel,
        whatsapp_config_id, additional_context, max_attempts, current_attempt, retry_delay_minutes,
        created_at, updated_at
      ) VALUES (
        ${taskId}, ${consultantId}, ${lead.phone || ''}, ${leadName},
        'single_whatsapp', ${waInstruction},
        ${scheduledAtIso}, ${config.timezone}, ${taskStatus}, 2, 'prospecting', 'hunter', 'whatsapp',
        ${config.whatsappConfigId},
        ${additionalContext}::text,
        1, 0, 5, NOW(), NOW()
      )
    `);
    console.log(`[HUNTER] Step 3/6: Created ai_scheduled_task (id=${taskId}, type=single_whatsapp, status=${taskStatus})`);
  } else if (channel === 'email') {
    const emailSubject = content.emailSubject || `Proposta per ${leadName}`;
    const emailBody = content.emailBody || '';
    contentPreview = emailSubject;

    let emailSent = false;
    if (mode === 'autonomous' && config.emailAccountId) {
      try {
        const smtpResult = await db.execute(sql`
          SELECT id, smtp_host, smtp_port, smtp_user, smtp_password, email_address, display_name
          FROM email_accounts
          WHERE id = ${config.emailAccountId} AND consultant_id = ${consultantId} AND smtp_host IS NOT NULL
          LIMIT 1
        `);
        const smtpConfig = smtpResult.rows[0] as any;
        if (smtpConfig && lead.email) {
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
          const sendResult = await transporter.sendMail({ from: fromField, to: lead.email, subject: emailSubject, html: htmlBody });
          emailSent = true;

          const hubEmailId = `hub_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
          await db.execute(sql`
            INSERT INTO hub_emails (
              id, account_id, consultant_id, message_id, subject, from_name, from_email,
              to_recipients, body_html, body_text, snippet, direction, folder,
              is_read, processing_status, sent_at, created_at, updated_at
            ) VALUES (
              ${hubEmailId}, ${config.emailAccountId}, ${consultantId},
              ${sendResult.messageId || hubEmailId},
              ${emailSubject}, ${smtpConfig.display_name || ''}, ${smtpConfig.email_address},
              ${JSON.stringify([{ email: lead.email, name: leadName }])}::jsonb,
              ${htmlBody}, ${emailBody}, ${emailBody.substring(0, 200)},
              'outbound', 'sent', true, 'sent', NOW(), NOW(), NOW()
            )
            ON CONFLICT (message_id) DO NOTHING
          `);
        }
      } catch (emailErr: any) {
        console.error(`[HUNTER-CRM] Email send failed for ${leadName}: ${emailErr.message}`);
      }
    }

    const emailTaskStatus = emailSent ? 'completed' : taskStatus;
    await db.execute(sql`
      INSERT INTO ai_scheduled_tasks (
        id, consultant_id, contact_phone, contact_name, task_type, ai_instruction,
        scheduled_at, timezone, status, priority, task_category, ai_role, preferred_channel,
        additional_context, max_attempts, current_attempt, retry_delay_minutes,
        created_at, updated_at
      ) VALUES (
        ${taskId}, ${consultantId}, ${lead.phone || ''}, ${leadName},
        'ai_task', ${`Oggetto: ${emailSubject}\n\n${emailBody}`},
        ${scheduledAtIso}, ${config.timezone},
        ${emailTaskStatus},
        2, 'prospecting', 'hunter', 'email',
        ${JSON.stringify({ lead_id: lead.id || lead.leadId, business_name: leadName, ai_score: lead.score, sector: lead.category, source: 'crm_analysis', email_account_id: config.emailAccountId, lead_email: lead.email || '', email_template_name: content.emailTemplateName || null })}::text,
        1, 0, 5, NOW(), NOW()
      )
    `);
    console.log(`[HUNTER] Step 3/6: Created ai_scheduled_task (id=${taskId}, type=ai_task/email, status=${emailTaskStatus}, emailSent=${emailSent})`);
  }

  const leadId = lead.id || lead.leadId;
  await db.execute(sql`
    UPDATE lead_scraper_results
    SET lead_status = 'in_outreach', outreach_task_id = ${taskId},
        lead_next_action = ${`${channel} outreach individuale`},
        lead_next_action_date = ${scheduledAtIso},
        contacted_channels = CASE
          WHEN ${channel} = ANY(COALESCE(contacted_channels, '{}'))
          THEN contacted_channels
          ELSE array_append(COALESCE(contacted_channels, '{}'), ${channel})
        END
    WHERE id = ${leadId}
  `);
  console.log(`[HUNTER] Step 4/6: Updated lead_scraper_results → in_outreach (leadId=${leadId})`);

  const activityTypeMap: Record<string, string> = {
    voice: 'chiamata',
    whatsapp: 'whatsapp_inviato',
    email: 'email_inviata',
  };
  const activityTitleMap: Record<string, string> = {
    voice: 'Hunter — Chiamata programmata',
    whatsapp: 'Hunter — WhatsApp programmato',
    email: 'Hunter — Email programmata',
  };
  const activityType = activityTypeMap[channel] || 'crm_reanalysis';
  const activityTitle = (activityTitleMap[channel] || 'Hunter → ' + channel) + ': ' + leadName;

  let activityDescription = 'Outreach personalizzato';
  if (channel === 'voice') {
    const templateName = config.voiceTemplateName || 'Predefinito';
    activityDescription = `Template voce: ${templateName}` + (content.callScript ? ` — ${content.callScript.substring(0, 150)}` : '');
  } else if (channel === 'whatsapp') {
    activityDescription = content.whatsappMessage?.substring(0, 200) || content.whatsappContext?.substring(0, 200) || 'Messaggio WhatsApp programmato';
  } else if (channel === 'email') {
    activityDescription = content.emailSubject ? `Oggetto: ${content.emailSubject}` : 'Email programmata';
  }

  await db.execute(sql`
    INSERT INTO lead_scraper_activities (lead_id, consultant_id, type, title, description, metadata)
    VALUES (
      ${lead.id || lead.leadId}, ${consultantId}, ${activityType},
      ${activityTitle},
      ${activityDescription},
      ${JSON.stringify({ taskId, channel, score: lead.score, source: 'crm_analysis', scheduledAt: scheduledAtIso })}::jsonb
    )
  `);
  console.log(`[HUNTER] Step 5/6: Logged activity in lead_scraper_activities`);

  const hunterActionStatus = taskStatus === 'scheduled' ? 'scheduled' : 'waiting_approval';
  await db.execute(sql`
    INSERT INTO hunter_actions (
      consultant_id, lead_id, lead_name, lead_phone, lead_email,
      channel, status, message_preview, scheduled_at, result_note
    ) VALUES (
      ${consultantId}, ${lead.id || lead.leadId}, ${leadName},
      ${lead.phone || null}, ${lead.email || null},
      ${channel}, ${hunterActionStatus}, ${contentPreview?.substring(0, 500) || null},
      ${scheduledAtIso}, ${mode === 'approval' ? 'In attesa di approvazione' : null}
    )
  `);
  console.log(`[HUNTER] Step 6/6: Done — ${channel} for "${leadName}" → ${taskStatus} at ${scheduledAtIso}`);

  return { taskId, channel, leadName, status: taskStatus, scheduledAt: scheduledAtIso, contentPreview };
}

router.post("/hunter-analyze-crm", authenticateToken, requireAnyRole(["consultant", "super_admin"]), async (req: Request, res: Response) => {
  try {
    const consultantId = (req as AuthRequest).user?.id;
    if (!consultantId) return res.status(401).json({ error: "Unauthorized" });

    const { mode = "execute" } = req.body || {};

    const settingsResult = await db.execute(sql`
      SELECT outreach_config, channels_enabled FROM ai_autonomy_settings
      WHERE consultant_id = ${consultantId} LIMIT 1
    `);
    const settings = settingsResult.rows[0] as any;
    if (!settings) return res.status(400).json({ error: "Impostazioni autonomia non trovate" });

    const outreachConfig = settings.outreach_config || {};
    const channelsEnabled = settings.channels_enabled || {};
    const scoreThreshold = outreachConfig.score_threshold ?? 60;
    const maxLeads = outreachConfig.max_leads_per_batch ?? 15;

    const { totalAnalyzed, actionableLeads, skipReasons } = await getActionableCrmLeads(consultantId, scoreThreshold, outreachConfig);

    console.log(`[HUNTER-CRM] Analyzed ${totalAnalyzed} leads, ${actionableLeads.length} actionable (mode=${mode}, maxLeads=${maxLeads}), skipReasons:`, skipReasons);

    if (mode === "plan") {
      return res.json({
        success: true,
        analyzed: totalAnalyzed,
        actionable: actionableLeads.length,
        leads: actionableLeads,
        skipReasons,
      });
    }

    if (actionableLeads.length === 0) {
      await logActivity(consultantId, {
        event_type: 'hunter_crm_analysis',
        severity: 'info',
        title: `Ho analizzato il CRM: tutti i lead sono aggiornati`,
        description: `Ho controllato ${totalAnalyzed} lead con score >= ${scoreThreshold}. Nessuno necessita di attenzione.`,
      });
      return res.json({ success: true, analyzed: totalAnalyzed, actionable: 0, results: [], skipReasons });
    }

    const { quickGenerate } = await import("../ai/provider-factory");

    const [salesCtxResult, consultantResult, waConfigResult] = await Promise.all([
      db.execute(sql`
        SELECT services_offered, target_audience, value_proposition, sales_approach,
               competitive_advantages, ideal_client_profile, additional_context
        FROM lead_scraper_sales_context WHERE consultant_id = ${consultantId} LIMIT 1
      `),
      db.execute(sql`SELECT first_name, last_name FROM users WHERE id = ${consultantId} LIMIT 1`),
      db.execute(sql`SELECT business_name, consultant_display_name FROM consultant_whatsapp_config WHERE consultant_id = ${consultantId} AND is_active = true LIMIT 1`),
    ]);
    const salesCtx = (salesCtxResult.rows[0] as any) || {};
    const cRow = consultantResult.rows[0] as any;
    const waConfigRow = waConfigResult.rows[0] as any;
    const consultantName = waConfigRow?.consultant_display_name || (cRow ? titleCaseName([cRow.first_name, cRow.last_name].filter(Boolean).join(' ')) || 'Consulente' : 'Consulente');
    const consultantBusinessName = waConfigRow?.business_name || null;

    const leadsForAI = actionableLeads.slice(0, maxLeads).map(l => ({
      id: l.id, name: l.businessName, score: l.score, status: l.leadStatus,
      category: l.category, phone: !!l.phone, email: !!l.email,
      daysSinceLastContact: l.daysSinceLastContact, daysSinceCreated: l.daysSinceCreated, reason: l.reason,
    }));

    const aiResult = await quickGenerate({
      consultantId,
      feature: 'hunter-crm-analysis',
      thinkingLevel: 'low',
      systemInstruction: [
        `Sei Hunter, il cervello commerciale. Analizza questi lead esistenti nel CRM e decidi per ciascuno l'azione migliore.`,
        salesCtx.services_offered ? `SERVIZI: ${salesCtx.services_offered}` : '',
        salesCtx.target_audience ? `TARGET: ${salesCtx.target_audience}` : '',
        `Canali disponibili: ${channelsEnabled.voice ? 'voice (chiamata)' : ''}${channelsEnabled.whatsapp ? ', whatsapp' : ''}${channelsEnabled.email ? ', email' : ''}`,
        `Rispondi SOLO con un JSON array. Per ogni lead: { "leadId": "uuid", "action": "call"|"whatsapp"|"email"|"skip", "reason": "motivo breve" }`,
        `Regole: se il lead ha solo email usa email, se ha solo telefono usa call o whatsapp. Preferisci la chiamata per lead ad alto score (>80). Usa "skip" solo se non ci sono dati di contatto.`,
      ].filter(Boolean).join('\n'),
      contents: [{ role: 'user', parts: [{ text: JSON.stringify(leadsForAI) }] }],
    });

    let aiDecisions: { leadId: string; action: string; reason: string }[] = [];
    try {
      const cleaned = aiResult.text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      aiDecisions = JSON.parse(cleaned);
    } catch {
      console.error('[HUNTER-CRM] Failed to parse AI decisions, using fallback channel assignment');
    }

    const channelPriority: string[] = outreachConfig.channel_priority ?? ['voice', 'whatsapp', 'email'];
    const whatsappConfigId = outreachConfig.whatsapp_config_id ?? null;
    const voiceTemplateId = outreachConfig.voice_template_id ?? null;
    const emailAccountId = outreachConfig.email_account_id ?? null;
    const hunterMode = outreachConfig.hunter_mode ?? (outreachConfig.require_approval !== false ? 'approval' : 'autonomous');
    const outreachMode = hunterMode === 'autonomous' ? 'autonomous' : 'approval';

    let whatsappConfigActive = false;
    if (whatsappConfigId) {
      try {
        const waCheck = await db.execute(sql`SELECT id FROM consultant_whatsapp_config WHERE id = ${whatsappConfigId} AND is_active = true LIMIT 1`);
        whatsappConfigActive = waCheck.rows.length > 0;
      } catch {}
    }

    const remainingLimits = await getRemainingLimits(consultantId);
    let voiceCount = 0, waCount = 0, emailCount = 0, skipped = 0;

    const leadsWithChannels: { lead: any; channel: string; aiReason: string }[] = [];

    const firstContactChannel = outreachConfig.first_contact_channel || 'auto';
    const highScoreChannel = outreachConfig.high_score_channel || 'voice';

    for (const lead of actionableLeads.slice(0, maxLeads)) {
      const aiDecision = aiDecisions.find(d => d.leadId === lead.id);
      let channel: string | null = null;

      const canUseChannel = (ch: string): boolean => {
        if (ch === 'voice') return !!(lead.phone && channelsEnabled.voice && voiceTemplateId && remainingLimits.calls > voiceCount);
        if (ch === 'whatsapp') return !!(lead.phone && channelsEnabled.whatsapp && whatsappConfigActive && remainingLimits.whatsapp > waCount);
        if (ch === 'email') return !!(lead.email && channelsEnabled.email && remainingLimits.email > emailCount);
        return false;
      };

      if (lead.leadStatus === 'nuovo' && firstContactChannel !== 'auto' && canUseChannel(firstContactChannel)) {
        channel = firstContactChannel;
      } else if (lead.score > 80 && highScoreChannel && canUseChannel(highScoreChannel)) {
        channel = highScoreChannel;
      } else if (aiDecision && aiDecision.action !== 'skip') {
        const actionMap: Record<string, string> = { call: 'voice', whatsapp: 'whatsapp', email: 'email' };
        const preferred = actionMap[aiDecision.action] || aiDecision.action;
        if (canUseChannel(preferred)) channel = preferred;
      }

      if (!channel) {
        for (const ch of channelPriority) {
          if (canUseChannel(ch)) { channel = ch; break; }
        }
      }

      if (!channel) { skipped++; continue; }

      lead.aiReason = aiDecision?.reason || lead.reason;
      leadsWithChannels.push({ lead, channel, aiReason: lead.aiReason });

      if (channel === 'voice') voiceCount++;
      else if (channel === 'whatsapp') waCount++;
      else if (channel === 'email') emailCount++;
    }

    const results: any[] = [];
    const callInstructionTemplate = outreachConfig.call_instruction_template || null;

    let resolvedVoiceTemplateName: string | null = null;
    if (voiceTemplateId) {
      try {
        const { getTemplateById } = await import("../voice/voice-templates");
        const tmpl = getTemplateById(voiceTemplateId);
        if (tmpl) resolvedVoiceTemplateName = tmpl.name;
      } catch {}
    }

    const waTemplateSids: string[] = outreachConfig.whatsapp_template_ids || [];
    const loadedWaTemplates = await loadSelectedWaTemplates(consultantId, waTemplateSids);

    const scheduleConfig = { voiceTemplateId, whatsappConfigId, emailAccountId, timezone: 'Europe/Rome', voiceTemplateName: resolvedVoiceTemplateName, callInstructionTemplate, outreachConfig };

    for (let i = 0; i < leadsWithChannels.length; i++) {
      const { lead, channel } = leadsWithChannels[i];
      try {
        const content = await generateOutreachContent(consultantId, lead, channel, salesCtx, consultantName, undefined, outreachConfig, loadedWaTemplates, consultantBusinessName);
        const result = await scheduleIndividualOutreach(consultantId, lead, channel, content, scheduleConfig, outreachMode as 'autonomous' | 'approval', i);
        results.push(result);
        console.log(`[HUNTER-CRM] ✓ ${result.leadName} → ${channel} (${result.status})`);
      } catch (err: any) {
        console.error(`[HUNTER-CRM] ✗ Failed ${lead.businessName} → ${channel}: ${err.message}`);
        results.push({ taskId: null, channel, leadName: lead.businessName, status: 'error', scheduledAt: null, contentPreview: err.message });
      }

      if (i < leadsWithChannels.length - 1) {
        await new Promise(r => setTimeout(r, 1500));
      }
    }

    const successCount = results.filter(r => r.status !== 'error').length;

    await logActivity(consultantId, {
      event_type: 'hunter_crm_analysis',
      severity: 'info',
      title: `Ho analizzato ${totalAnalyzed} lead nel CRM: ${successCount} task individuali creati`,
      description: `${voiceCount > 0 ? `${voiceCount} chiamate` : ''}${waCount > 0 ? ` ${waCount} WhatsApp` : ''}${emailCount > 0 ? ` ${emailCount} email` : ''}${skipped > 0 ? ` — ${skipped} saltati` : ''}. Ogni lead ha il suo task personalizzato.`,
    });

    return res.json({
      success: true,
      analyzed: totalAnalyzed,
      actionable: actionableLeads.length,
      results,
      skipReasons,
      voiceCount,
      waCount,
      emailCount,
      skipped,
    });
  } catch (error: any) {
    console.error("[HUNTER-CRM] Error analyzing CRM:", error);
    return res.status(500).json({ error: "Failed to analyze CRM" });
  }
});

router.post("/hunter-single-lead", authenticateToken, requireAnyRole(["consultant", "super_admin"]), async (req: Request, res: Response) => {
  try {
    const consultantId = (req as AuthRequest).user?.id;
    if (!consultantId) return res.status(401).json({ error: "Non autenticato" });

    const { leadId, channels, voiceTargetPhone } = req.body;
    if (!leadId || !channels || !Array.isArray(channels) || channels.length === 0) {
      return res.status(400).json({ error: "leadId e channels[] sono obbligatori" });
    }

    const validChannels = channels.filter((c: string) => ['voice', 'whatsapp', 'email'].includes(c));
    if (validChannels.length === 0) {
      return res.status(400).json({ error: "Nessun canale valido (voice, whatsapp, email)" });
    }

    const leadResult = await db.execute(sql`
      SELECT id, business_name, category, phone, email, website, address,
             ai_compatibility_score, ai_sales_summary, rating, reviews_count, lead_notes
      FROM lead_scraper_results WHERE id = ${leadId} LIMIT 1
    `);
    if (leadResult.rows.length === 0) {
      return res.status(404).json({ error: "Lead non trovato" });
    }
    const dbLead = leadResult.rows[0] as any;
    const lead = {
      id: dbLead.id, leadId: dbLead.id,
      businessName: dbLead.business_name, phone: dbLead.phone,
      email: dbLead.email, website: dbLead.website,
      address: dbLead.address, category: dbLead.category,
      score: dbLead.ai_compatibility_score,
      salesSummary: dbLead.ai_sales_summary,
      rating: dbLead.rating, reviewsCount: dbLead.reviews_count,
      consultantNotes: dbLead.lead_notes || '',
    };

    const settingsResult = await db.execute(sql`
      SELECT outreach_config FROM ai_autonomy_settings WHERE consultant_id = ${consultantId} LIMIT 1
    `);
    const settings = settingsResult.rows[0] as any;
    const outreachConfig = settings?.outreach_config || {};

    const voiceTemplateId = outreachConfig.voice_template_id || null;
    const whatsappConfigId = outreachConfig.whatsapp_config_id || null;
    const emailAccountId = outreachConfig.email_account_id || null;
    const callInstructionTemplate = outreachConfig.call_instruction_template || null;

    const [salesCtxResult, consultantResult, waConfigResult2] = await Promise.all([
      db.execute(sql`
        SELECT services_offered, target_audience, value_proposition, sales_approach,
               competitive_advantages, ideal_client_profile, additional_context
        FROM lead_scraper_sales_context WHERE consultant_id = ${consultantId} LIMIT 1
      `),
      db.execute(sql`SELECT first_name, last_name FROM users WHERE id = ${consultantId} LIMIT 1`),
      db.execute(sql`SELECT business_name, consultant_display_name FROM consultant_whatsapp_config WHERE consultant_id = ${consultantId} AND is_active = true LIMIT 1`),
    ]);
    const salesCtx = (salesCtxResult.rows[0] as any) || {};
    const cRow = consultantResult.rows[0] as any;
    const waConfigRow2 = waConfigResult2.rows[0] as any;
    const consultantName = waConfigRow2?.consultant_display_name || (cRow ? titleCaseName([cRow.first_name, cRow.last_name].filter(Boolean).join(' ')) || 'Consulente' : 'Consulente');
    const consultantBusinessName = waConfigRow2?.business_name || null;

    let resolvedVoiceTemplateName: string | null = null;
    if (voiceTemplateId) {
      try {
        const { getTemplateById } = await import("../voice/voice-templates");
        const tmpl = getTemplateById(voiceTemplateId);
        if (tmpl) resolvedVoiceTemplateName = tmpl.name;
      } catch {}
    }

    const waTemplateSids: string[] = outreachConfig.whatsapp_template_ids || [];
    const loadedWaTemplates = await loadSelectedWaTemplates(consultantId, waTemplateSids);

    const scheduleConfig = { voiceTemplateId, whatsappConfigId, emailAccountId, timezone: 'Europe/Rome', voiceTemplateName: resolvedVoiceTemplateName, callInstructionTemplate, outreachConfig };

    const results: any[] = [];
    for (let i = 0; i < validChannels.length; i++) {
      const channel = validChannels[i];
      try {
        const content = await generateOutreachContent(consultantId, lead, channel, salesCtx, consultantName, undefined, outreachConfig, loadedWaTemplates, consultantBusinessName);
        const result = await scheduleIndividualOutreach(consultantId, lead, channel, content, scheduleConfig, 'approval', i);

        if (channel === 'voice' && voiceTargetPhone && result.taskId) {
          const voiceCallIdResult = await db.execute(sql`
            SELECT voice_call_id FROM ai_scheduled_tasks WHERE id = ${result.taskId} LIMIT 1
          `);
          const voiceCallId = (voiceCallIdResult.rows[0] as any)?.voice_call_id;
          if (voiceCallId) {
            await db.execute(sql`
              UPDATE scheduled_voice_calls SET target_phone = ${voiceTargetPhone} WHERE id = ${voiceCallId}
            `);
          }
        }

        results.push(result);
        console.log(`[HUNTER-SINGLE] ✓ ${result.leadName} → ${channel} (${result.status})`);
      } catch (err: any) {
        console.error(`[HUNTER-SINGLE] ✗ Failed ${lead.businessName} → ${channel}: ${err.message}`);
        results.push({ taskId: null, channel, leadName: lead.businessName, status: 'error', scheduledAt: null, contentPreview: err.message });
      }

      if (i < validChannels.length - 1) {
        await new Promise(r => setTimeout(r, 1000));
      }
    }

    console.log(`[HUNTER-SINGLE] Completed: ${results.filter(r => r.status !== 'error').length}/${validChannels.length} tasks created for ${lead.businessName}`);
    return res.json({ success: true, results, leadName: lead.businessName });
  } catch (error: any) {
    console.error("[HUNTER-SINGLE] Error:", error);
    return res.status(500).json({ error: "Errore nel processamento del lead" });
  }
});

router.post("/hunter-plan/generate", authenticateToken, requireAnyRole(["consultant", "super_admin"]), async (req: Request, res: Response) => {
  try {
    const consultantId = (req as AuthRequest).user?.id;
    if (!consultantId) return res.status(401).json({ error: "Unauthorized" });

    const { source = "crm", leadIds } = req.body || {};

    const settingsResult = await db.execute(sql`
      SELECT outreach_config, channels_enabled FROM ai_autonomy_settings
      WHERE consultant_id = ${consultantId} LIMIT 1
    `);
    const settings = settingsResult.rows[0] as any;
    if (!settings) return res.status(400).json({ error: "Impostazioni non trovate" });

    const outreachConfig = settings.outreach_config || {};
    const channelsEnabled = settings.channels_enabled || {};
    const scoreThreshold = outreachConfig.score_threshold ?? 60;

    let leadsForPlan: any[] = [];

    let planSkipReasons: any = {};
    if (source === "crm") {
      const { actionableLeads, skipReasons } = await getActionableCrmLeads(consultantId, scoreThreshold, outreachConfig);
      leadsForPlan = actionableLeads;
      planSkipReasons = skipReasons;
    }

    if (leadIds && Array.isArray(leadIds) && leadIds.length > 0) {
      leadsForPlan = leadsForPlan.filter(l => leadIds.includes(l.id));
    }

    if (leadsForPlan.length === 0) {
      return res.json({ success: true, planId: null, leads: [], summary: "Nessun lead azionabile trovato nel CRM.", totalActions: 0, channels: { voice: 0, whatsapp: 0, email: 0 }, skipReasons: planSkipReasons });
    }

    const salesCtxResult = await db.execute(sql`
      SELECT services_offered, target_audience, value_proposition, sales_approach,
             competitive_advantages, ideal_client_profile, additional_context
      FROM lead_scraper_sales_context WHERE consultant_id = ${consultantId} LIMIT 1
    `);
    const salesCtx = (salesCtxResult.rows[0] as any) || {};

    const { quickGenerate } = await import("../ai/provider-factory");

    const leadsForPrompt = leadsForPlan.slice(0, 30).map(l => ({
      id: l.id, name: l.businessName, score: l.score, status: l.leadStatus,
      category: l.category, hasPhone: !!l.phone, hasEmail: !!l.email,
      daysSinceLastContact: l.daysSinceLastContact, daysSinceCreated: l.daysSinceCreated,
      reason: l.reason, summary: l.salesSummary,
    }));

    const availableChannels = [
      channelsEnabled.voice ? 'call (chiamata telefonica)' : '',
      channelsEnabled.whatsapp ? 'whatsapp' : '',
      channelsEnabled.email ? 'email' : '',
    ].filter(Boolean).join(', ');

    const aiResult = await quickGenerate({
      consultantId,
      feature: 'hunter-plan-generate',
      thinkingLevel: 'medium',
      systemInstruction: [
        `Sei Hunter, il cervello commerciale del consulente. Analizza i lead e prepara un piano d'azione strategico.`,
        salesCtx.services_offered ? `SERVIZI DEL CONSULENTE: ${salesCtx.services_offered}` : '',
        salesCtx.target_audience ? `TARGET IDEALE: ${salesCtx.target_audience}` : '',
        salesCtx.value_proposition ? `PROPOSTA DI VALORE: ${salesCtx.value_proposition}` : '',
        salesCtx.sales_approach ? `APPROCCIO VENDITA: ${salesCtx.sales_approach}` : '',
        `Canali disponibili: ${availableChannels}`,
        `Rispondi SOLO con un JSON valido con questa struttura:`,
        `{`,
        `  "leads": [{ "leadId": "uuid", "action": "call"|"whatsapp"|"email"|"skip", "reason": "perché questa azione", "priority": 1-5, "suggestedTiming": "mattina|pomeriggio|sera", "talkingPoints": ["punto1", "punto2"] }],`,
        `  "summary": "strategia generale e suggerimenti in 2-3 frasi"`,
        `}`,
        `Regole: ordina per priorità (5=massima). Se un lead non ha telefono, non proporre call/whatsapp. Sii specifico nei talking points.`,
      ].filter(Boolean).join('\n'),
      contents: [{ role: 'user', parts: [{ text: JSON.stringify(leadsForPrompt) }] }],
    });

    let planData: { leads: any[]; summary: string } = { leads: [], summary: '' };
    try {
      const cleaned = aiResult.text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      planData = JSON.parse(cleaned);
    } catch {
      console.error('[HUNTER-PLAN] Failed to parse AI plan');
      planData = {
        leads: leadsForPlan.map(l => ({
          leadId: l.id, action: l.phone ? 'call' : l.email ? 'email' : 'skip',
          reason: l.reason, priority: 3, suggestedTiming: 'mattina', talkingPoints: [],
        })),
        summary: 'Piano generato con fallback automatico.',
      };
    }

    const enrichedLeads = planData.leads.map(pl => {
      const original = leadsForPlan.find(l => l.id === pl.leadId);
      return {
        ...pl,
        businessName: original?.businessName || 'Lead',
        score: original?.score || null,
        category: original?.category || null,
        phone: original?.phone || null,
        email: original?.email || null,
        leadStatus: original?.leadStatus || 'nuovo',
        daysSinceLastContact: original?.daysSinceLastContact ?? null,
        included: pl.action !== 'skip',
      };
    });

    const planId = `plan_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const channels = {
      voice: enrichedLeads.filter(l => l.included && l.action === 'call').length,
      whatsapp: enrichedLeads.filter(l => l.included && l.action === 'whatsapp').length,
      email: enrichedLeads.filter(l => l.included && l.action === 'email').length,
    };

    hunterPlansCache.set(planId, {
      plan: { planId, leads: enrichedLeads, summary: planData.summary, totalActions: channels.voice + channels.whatsapp + channels.email, channels, outreachConfig },
      createdAt: Date.now(),
      consultantId,
    });

    return res.json({
      success: true,
      planId,
      leads: enrichedLeads,
      summary: planData.summary,
      totalActions: channels.voice + channels.whatsapp + channels.email,
      channels,
      skipReasons: planSkipReasons,
    });
  } catch (error: any) {
    console.error("[HUNTER-PLAN] Error generating plan:", error);
    return res.status(500).json({ error: "Failed to generate plan" });
  }
});

router.post("/hunter-plan/chat", authenticateToken, requireAnyRole(["consultant", "super_admin"]), async (req: Request, res: Response) => {
  try {
    const consultantId = (req as AuthRequest).user?.id;
    if (!consultantId) return res.status(401).json({ error: "Unauthorized" });

    const { planId, message, conversationHistory = [] } = req.body || {};
    if (!planId || !message) return res.status(400).json({ error: "planId e message richiesti" });

    const cached = hunterPlansCache.get(planId);
    if (!cached || cached.consultantId !== consultantId) {
      return res.status(404).json({ error: "Piano non trovato o scaduto" });
    }

    const currentPlan = cached.plan;

    const salesCtxResult = await db.execute(sql`
      SELECT services_offered, target_audience, value_proposition, sales_approach,
             competitive_advantages, ideal_client_profile, additional_context
      FROM lead_scraper_sales_context WHERE consultant_id = ${consultantId} LIMIT 1
    `);
    const salesCtx = (salesCtxResult.rows[0] as any) || {};

    const { quickGenerate } = await import("../ai/provider-factory");

    const planSummary = currentPlan.leads.map((l: any) => `- ${l.businessName} (score ${l.score}): ${l.included ? l.action : 'ESCLUSO'} — ${l.reason}`).join('\n');

    const contents = [
      ...conversationHistory.map((m: any) => ({
        role: m.role === 'user' ? 'user' : 'model',
        parts: [{ text: m.content }],
      })),
      { role: 'user', parts: [{ text: message }] },
    ];

    const aiResult = await quickGenerate({
      consultantId,
      feature: 'hunter-plan-chat',
      thinkingLevel: 'low',
      systemInstruction: [
        `Sei Hunter, il cervello commerciale. Il consulente sta discutendo un piano di outreach con te.`,
        `PIANO ATTUALE:\n${planSummary}`,
        `SUMMARY: ${currentPlan.summary}`,
        salesCtx.services_offered ? `SERVIZI: ${salesCtx.services_offered}` : '',
        `Se il consulente chiede modifiche al piano, rispondi con JSON: { "reply": "testo conversazionale", "updatedPlan": { "leads": [...], "summary": "..." } }`,
        `Se il consulente fa domande o vuole discutere (senza modifiche), rispondi con: { "reply": "testo conversazionale" }`,
        `Nella lista leads dell'updatedPlan, ogni lead ha: leadId, action (call/whatsapp/email/skip), reason, priority, suggestedTiming, talkingPoints, included (true/false), businessName, score, category, phone, email, leadStatus.`,
        `Rispondi SEMPRE in italiano. Sii conciso e pratico.`,
      ].filter(Boolean).join('\n'),
      contents,
    });

    let reply = aiResult.text;
    let updatedPlan: any = null;

    try {
      const cleaned = aiResult.text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const parsed = JSON.parse(cleaned);
      if (parsed.reply) {
        reply = parsed.reply;
        if (parsed.updatedPlan) {
          updatedPlan = parsed.updatedPlan;
          const cachedLeadIds = new Set(currentPlan.leads.map((l: any) => l.leadId));
          const validActions = new Set(['call', 'whatsapp', 'email', 'skip']);
          const rawLeads = updatedPlan.leads || currentPlan.leads;
          const validatedLeads = rawLeads
            .filter((l: any) => cachedLeadIds.has(l.leadId))
            .map((l: any) => {
              const original = currentPlan.leads.find((o: any) => o.leadId === l.leadId);
              return {
                ...original,
                ...l,
                action: validActions.has(l.action) ? l.action : original?.action || 'skip',
                businessName: original?.businessName || l.businessName,
                phone: original?.phone || l.phone,
                email: original?.email || l.email,
                score: original?.score ?? l.score,
                included: l.included !== undefined ? l.included : l.action !== 'skip',
              };
            });
          const missingLeads = currentPlan.leads.filter(
            (l: any) => !validatedLeads.some((v: any) => v.leadId === l.leadId)
          );
          const newLeads = [...validatedLeads, ...missingLeads];

          const channels = {
            voice: newLeads.filter((l: any) => l.included && l.action === 'call').length,
            whatsapp: newLeads.filter((l: any) => l.included && l.action === 'whatsapp').length,
            email: newLeads.filter((l: any) => l.included && l.action === 'email').length,
          };

          cached.plan = {
            ...currentPlan,
            leads: newLeads,
            summary: updatedPlan.summary || currentPlan.summary,
            totalActions: channels.voice + channels.whatsapp + channels.email,
            channels,
          };
          hunterPlansCache.set(planId, cached);

          updatedPlan = cached.plan;
        }
      }
    } catch {
      // AI returned plain text
    }

    return res.json({ reply, updatedPlan });
  } catch (error: any) {
    console.error("[HUNTER-PLAN-CHAT] Error:", error);
    return res.status(500).json({ error: "Failed to process chat" });
  }
});

router.post("/hunter-plan/execute", authenticateToken, requireAnyRole(["consultant", "super_admin"]), async (req: Request, res: Response) => {
  try {
    const consultantId = (req as AuthRequest).user?.id;
    if (!consultantId) return res.status(401).json({ error: "Unauthorized" });

    const { planId } = req.body || {};
    if (!planId) return res.status(400).json({ error: "planId richiesto" });

    const cached = hunterPlansCache.get(planId);
    if (!cached || cached.consultantId !== consultantId) {
      return res.status(404).json({ error: "Piano non trovato o scaduto" });
    }

    const plan = cached.plan;

    const settingsResult = await db.execute(sql`
      SELECT outreach_config, channels_enabled FROM ai_autonomy_settings
      WHERE consultant_id = ${consultantId} LIMIT 1
    `);
    const freshSettings = settingsResult.rows[0] as any;
    const outreachConfig = freshSettings?.outreach_config || plan.outreachConfig || {};
    const channelsEnabled = freshSettings?.channels_enabled || {};
    const hunterMode = outreachConfig.hunter_mode ?? (outreachConfig.require_approval !== false ? 'approval' : 'autonomous');
    const voiceTemplateId = outreachConfig.voice_template_id ?? null;
    const whatsappConfigId = outreachConfig.whatsapp_config_id ?? null;
    const emailAccountId = outreachConfig.email_account_id ?? null;
    const includedLeads = plan.leads.filter((l: any) => {
      if (!l.included || l.action === 'skip') return false;
      const channel = l.action === 'call' ? 'voice' : l.action;
      if (channelsEnabled[channel] === false) return false;
      if (l.action === 'call' && !l.phone) return false;
      if (l.action === 'whatsapp' && !l.phone) return false;
      if (l.action === 'email' && !l.email) return false;
      return true;
    });

    if (includedLeads.length === 0) {
      hunterPlansCache.delete(planId);
      return res.json({ success: true, results: [], voiceCount: 0, waCount: 0, emailCount: 0 });
    }

    const actionMap: Record<string, string> = { call: 'voice', whatsapp: 'whatsapp', email: 'email' };
    const outreachMode = hunterMode === 'autonomous' ? 'autonomous' : 'approval';
    const callInstructionTemplate2 = outreachConfig.call_instruction_template || null;

    let resolvedVoiceTemplateName2: string | null = null;
    if (voiceTemplateId) {
      try {
        const { getTemplateById } = await import("../voice/voice-templates");
        const tmpl = getTemplateById(voiceTemplateId);
        if (tmpl) resolvedVoiceTemplateName2 = tmpl.name;
      } catch {}
    }

    const waTemplateSids2: string[] = outreachConfig.whatsapp_template_ids || [];
    const loadedWaTemplates2 = await loadSelectedWaTemplates(consultantId, waTemplateSids2);

    const scheduleConfig = { voiceTemplateId, whatsappConfigId, emailAccountId, timezone: 'Europe/Rome', voiceTemplateName: resolvedVoiceTemplateName2, callInstructionTemplate: callInstructionTemplate2, outreachConfig };

    const [salesCtxResult, consultantResult, waConfigResult3] = await Promise.all([
      db.execute(sql`
        SELECT services_offered, target_audience, value_proposition, sales_approach,
               competitive_advantages, ideal_client_profile, additional_context
        FROM lead_scraper_sales_context WHERE consultant_id = ${consultantId} LIMIT 1
      `),
      db.execute(sql`SELECT first_name, last_name FROM users WHERE id = ${consultantId} LIMIT 1`),
      db.execute(sql`SELECT business_name, consultant_display_name FROM consultant_whatsapp_config WHERE consultant_id = ${consultantId} AND is_active = true LIMIT 1`),
    ]);
    const salesCtx = (salesCtxResult.rows[0] as any) || {};
    const cRow = consultantResult.rows[0] as any;
    const waConfigRow3 = waConfigResult3.rows[0] as any;
    const consultantName = waConfigRow3?.consultant_display_name || (cRow ? titleCaseName([cRow.first_name, cRow.last_name].filter(Boolean).join(' ')) || 'Consulente' : 'Consulente');
    const consultantBusinessName = waConfigRow3?.business_name || null;

    const results: any[] = [];
    let voiceCount = 0, waCount = 0, emailCount = 0;

    for (let i = 0; i < includedLeads.length; i++) {
      const planLead = includedLeads[i];
      const channel = actionMap[planLead.action] || planLead.action;
      let lead: any = {
        id: planLead.leadId, leadId: planLead.leadId,
        businessName: planLead.businessName, phone: planLead.phone,
        email: planLead.email, score: planLead.score,
        category: planLead.category, reason: planLead.reason,
        aiReason: planLead.reason,
        website: planLead.website || null,
        address: planLead.address || null,
        salesSummary: planLead.salesSummary || null,
      };
      if (planLead.leadId && (!lead.website && !lead.salesSummary)) {
        try {
          const fullLead = await db.execute(sql`
            SELECT website, address, sales_summary, rating, reviews_count
            FROM lead_scraper_leads WHERE id = ${planLead.leadId} LIMIT 1
          `);
          if (fullLead.rows[0]) {
            const fl = fullLead.rows[0] as any;
            lead.website = lead.website || fl.website || null;
            lead.address = lead.address || fl.address || null;
            lead.salesSummary = lead.salesSummary || fl.sales_summary || null;
          }
        } catch {}
      }

      try {
        const content = await generateOutreachContent(consultantId, lead, channel, salesCtx, consultantName, planLead.talkingPoints, outreachConfig, loadedWaTemplates2, consultantBusinessName);
        const result = await scheduleIndividualOutreach(consultantId, lead, channel, content, scheduleConfig, outreachMode as 'autonomous' | 'approval', i);
        results.push(result);
        if (channel === 'voice') voiceCount++;
        else if (channel === 'whatsapp') waCount++;
        else if (channel === 'email') emailCount++;
        console.log(`[HUNTER-PLAN-EXEC] ✓ ${result.leadName} → ${channel} (${result.status})`);
      } catch (err: any) {
        console.error(`[HUNTER-PLAN-EXEC] ✗ Failed ${lead.businessName} → ${channel}: ${err.message}`);
        results.push({ taskId: null, channel, leadName: lead.businessName, status: 'error', scheduledAt: null, contentPreview: err.message });
      }

      if (i < includedLeads.length - 1) {
        await new Promise(r => setTimeout(r, 1500));
      }
    }

    const successCount = results.filter(r => r.status !== 'error').length;

    await logActivity(consultantId, {
      event_type: 'hunter_plan_executed',
      severity: 'info',
      title: `Piano Hunter eseguito: ${successCount} task individuali creati`,
      description: `${voiceCount > 0 ? `${voiceCount} chiamate` : ''}${waCount > 0 ? ` ${waCount} WhatsApp` : ''}${emailCount > 0 ? ` ${emailCount} email` : ''}. Ogni lead ha il suo task personalizzato.`,
    });

    hunterPlansCache.delete(planId);

    return res.json({ success: true, results, voiceCount, waCount, emailCount });
  } catch (error: any) {
    console.error("[HUNTER-PLAN-EXEC] Error:", error);
    return res.status(500).json({ error: "Failed to execute plan" });
  }
});

router.post("/tasks/:id/reject", authenticateToken, requireAnyRole(["consultant", "super_admin"]), async (req: Request, res: Response) => {
  try {
    const consultantId = (req as AuthRequest).user?.id;
    if (!consultantId) return res.status(401).json({ error: "Unauthorized" });

    const { id } = req.params;

    const taskResult = await db.execute(sql`
      SELECT additional_context FROM ai_scheduled_tasks
      WHERE id = ${id} AND consultant_id = ${consultantId} AND status = 'waiting_approval'
    `);

    if (taskResult.rows.length === 0) {
      return res.status(400).json({ error: "Task non trovato o non in attesa di approvazione" });
    }

    await db.execute(sql`
      UPDATE ai_scheduled_tasks
      SET status = 'cancelled', updated_at = NOW(),
          result_summary = 'Rifiutato manualmente dal consulente'
      WHERE id = ${id} AND consultant_id = ${consultantId}
    `);

    const rawCtx = (taskResult.rows[0] as any)?.additional_context;
    const ctx = typeof rawCtx === 'string' ? (() => { try { return JSON.parse(rawCtx); } catch { return {}; } })() : (rawCtx || {});
    if (ctx?.lead_id) {
      await db.execute(sql`
        UPDATE lead_scraper_results
        SET lead_status = 'nuovo', outreach_task_id = NULL,
            lead_next_action = NULL, lead_next_action_date = NULL
        WHERE id = ${ctx.lead_id}
      `);
    }

    return res.json({ success: true });
  } catch (error: any) {
    console.error("[AI-AUTONOMY] Error rejecting task:", error);
    return res.status(500).json({ error: "Failed to reject task" });
  }
});

router.get("/roles/status", authenticateToken, requireAnyRole(["consultant", "super_admin"]), async (req: Request, res: Response) => {
  try {
    const consultantId = (req as AuthRequest).user?.id;
    if (!consultantId) return res.status(401).json({ error: "Non autorizzato" });

    const settings = await getAutonomySettings(consultantId);
    const enabledRolesResult = await db.execute(sql`
      SELECT enabled_roles FROM ai_autonomy_settings WHERE consultant_id::text = ${consultantId}::text LIMIT 1
    `);
    const enabledRoles: Record<string, boolean> = (enabledRolesResult.rows[0] as any)?.enabled_roles || {};

    const roleStatuses: Record<string, any> = {};

    for (const role of Object.values(AI_ROLES)) {
      const isEnabled = enabledRoles[role.id] !== false;
      const effectiveLevel = getEffectiveRoleLevel(settings, role.id);
      const isWithinHours = isRoleWithinWorkingHours(settings, role.id);
      const hasCustomLevel = settings.role_autonomy_modes?.[role.id] !== undefined && settings.role_autonomy_modes?.[role.id] !== null;

      const lastRunResult = await db.execute(sql`
        SELECT created_at, title, event_type FROM ai_activity_log
        WHERE consultant_id::text = ${consultantId}::text
          AND ai_role = ${role.id}
          AND event_type IN ('autonomous_analysis', 'autonomous_task_created', 'task_completed', 'task_started')
        ORDER BY created_at DESC
        LIMIT 1
      `);
      const lastRun = lastRunResult.rows[0] as any;

      let status: string;
      if (!settings.is_active) {
        status = 'sistema_spento';
      } else if (!isEnabled) {
        status = 'disabilitato';
      } else if (effectiveLevel === 0) {
        status = 'off';
      } else if (effectiveLevel < 2) {
        status = 'solo_manuale';
      } else if (!isWithinHours) {
        status = 'fuori_orario';
      } else {
        status = 'attivo';
      }

      roleStatuses[role.id] = {
        effectiveLevel,
        hasCustomLevel,
        customLevel: hasCustomLevel ? settings.role_autonomy_modes[role.id] : null,
        globalLevel: settings.autonomy_level,
        status,
        isEnabled,
        isWithinHours,
        lastExecution: lastRun ? {
          at: lastRun.created_at,
          title: lastRun.title,
          type: lastRun.event_type,
        } : null,
      };
    }

    return res.json(roleStatuses);
  } catch (error: any) {
    console.error("[AI-AUTONOMY] Error fetching roles status:", error);
    return res.status(500).json({ error: "Failed to fetch roles status" });
  }
});

router.get("/personalizza-config", authenticateToken, requireAnyRole(["consultant", "super_admin"]), async (req: Request, res: Response) => {
  try {
    const consultantId = (req as AuthRequest).user?.id;
    if (!consultantId) return res.status(401).json({ error: "Non autorizzato" });

    const result = await db.execute(sql`
      SELECT personalizza_config FROM ai_autonomy_settings 
      WHERE consultant_id::text = ${consultantId}::text LIMIT 1
    `);

    const config = (result.rows[0] as any)?.personalizza_config || {
      custom_name: "",
      detailed_instructions: "",
      preferred_channels: ["voice", "email", "whatsapp"],
      task_categories: ["outreach", "reminder", "followup", "analysis"],
      client_segments: "all",
      analysis_frequency: "every_cycle",
      tone_of_voice: "professionale",
      max_tasks_per_run: 3,
      priority_rules: "",
    };

    return res.json(config);
  } catch (error: any) {
    console.error("[AI-AUTONOMY] Error fetching personalizza config:", error.message);
    return res.status(500).json({ error: "Errore nel recupero della configurazione" });
  }
});

router.put("/personalizza-config", authenticateToken, requireAnyRole(["consultant", "super_admin"]), async (req: Request, res: Response) => {
  try {
    const consultantId = (req as AuthRequest).user?.id;
    if (!consultantId) return res.status(401).json({ error: "Non autorizzato" });

    const config = req.body;

    if (!config || typeof config !== 'object') {
      return res.status(400).json({ error: "Configurazione non valida" });
    }

    await db.execute(sql`
      INSERT INTO ai_autonomy_settings (consultant_id, personalizza_config)
      VALUES (${consultantId}::uuid, ${JSON.stringify(config)}::jsonb)
      ON CONFLICT (consultant_id) DO UPDATE
      SET personalizza_config = EXCLUDED.personalizza_config,
          updated_at = NOW()
    `);

    return res.json({ success: true, message: "Configurazione salvata" });
  } catch (error: any) {
    console.error("[AI-AUTONOMY] Error saving personalizza config:", error.message);
    return res.status(500).json({ error: "Errore nel salvataggio della configurazione" });
  }
});

router.get("/marco-context", authenticateToken, requireAnyRole(["consultant", "super_admin"]), async (req: Request, res: Response) => {
  try {
    const consultantId = (req as AuthRequest).user?.id;
    if (!consultantId) return res.status(401).json({ error: "Non autorizzato" });

    const result = await db.execute(sql`
      SELECT marco_context FROM ai_autonomy_settings 
      WHERE consultant_id::text = ${consultantId}::text LIMIT 1
    `);

    const context = (result.rows[0] as any)?.marco_context || {
      objectives: [],
      roadmap: "",
      linkedKbDocumentIds: [],
      reportStyle: "bilanciato",
      reportFocus: "",
      consultantPhone: "",
      consultantEmail: "",
      consultantWhatsapp: "",
    };

    return res.json(context);
  } catch (error: any) {
    console.error("[AI-AUTONOMY] Error fetching marco context:", error.message);
    return res.status(500).json({ error: "Errore nel recupero della configurazione" });
  }
});

router.put("/marco-context", authenticateToken, requireAnyRole(["consultant", "super_admin"]), async (req: Request, res: Response) => {
  try {
    const consultantId = (req as AuthRequest).user?.id;
    if (!consultantId) return res.status(401).json({ error: "Non autorizzato" });

    const context = req.body;

    if (!context || typeof context !== 'object') {
      return res.status(400).json({ error: "Configurazione non valida" });
    }

    await db.execute(sql`
      INSERT INTO ai_autonomy_settings (consultant_id, marco_context)
      VALUES (${consultantId}::uuid, ${JSON.stringify(context)}::jsonb)
      ON CONFLICT (consultant_id) DO UPDATE
      SET marco_context = EXCLUDED.marco_context,
          updated_at = NOW()
    `);

    if (Array.isArray(context.linkedKbDocumentIds)) {
      try {
        await db.execute(sql`
          DELETE FROM agent_knowledge_assignments
          WHERE consultant_id = ${consultantId} AND agent_id = 'marco'
        `);

        for (const docId of context.linkedKbDocumentIds) {
          if (docId && typeof docId === 'string') {
            const docExists = await db.execute(sql`
              SELECT id FROM consultant_knowledge_documents
              WHERE id = ${docId} AND consultant_id = ${consultantId}
              LIMIT 1
            `);
            if (docExists.rows?.length > 0) {
              await db.execute(sql`
                INSERT INTO agent_knowledge_assignments (consultant_id, agent_id, document_id)
                VALUES (${consultantId}, 'marco', ${docId})
                ON CONFLICT (consultant_id, agent_id, document_id) DO NOTHING
              `);
            }
          }
        }
      } catch (syncErr: any) {
        console.warn("[AI-AUTONOMY] Failed to sync marco KB assignments:", syncErr.message);
      }
    }

    return res.json({ success: true, message: "Configurazione salvata" });
  } catch (error: any) {
    console.error("[AI-AUTONOMY] Error saving marco context:", error.message);
    return res.status(500).json({ error: "Errore nel salvataggio della configurazione" });
  }
});

router.get("/agent-context/:agentId", authenticateToken, requireAnyRole(["consultant", "super_admin"]), async (req: Request, res: Response) => {
  try {
    const consultantId = (req as AuthRequest).user?.id;
    if (!consultantId) return res.status(401).json({ error: "Non autorizzato" });
    const { agentId } = req.params;

    const result = await db.execute(sql`
      SELECT agent_contexts, consultant_phone, consultant_email, consultant_whatsapp, marco_context 
      FROM ai_autonomy_settings 
      WHERE consultant_id::text = ${consultantId}::text LIMIT 1
    `);

    const row = result.rows[0] as any;
    const allContexts = row?.agent_contexts || {};
    let agentCtx = allContexts[agentId] || null;

    const isEmptyContext = (ctx: any) => {
      if (!ctx || typeof ctx !== 'object') return true;
      if (Object.keys(ctx).length === 0) return true;
      const hasPriorities = Array.isArray(ctx.focusPriorities) && ctx.focusPriorities.length > 0;
      const hasCustom = typeof ctx.customContext === 'string' && ctx.customContext.trim().length > 0;
      const hasKb = Array.isArray(ctx.linkedKbDocumentIds) && ctx.linkedKbDocumentIds.length > 0;
      return !hasPriorities && !hasCustom && !hasKb;
    };

    const oldMarco = row?.marco_context;
    const hasOldMarcoData = oldMarco && typeof oldMarco === 'object' && (
      (Array.isArray(oldMarco.objectives) && oldMarco.objectives.length > 0) ||
      (typeof oldMarco.roadmap === 'string' && oldMarco.roadmap.trim().length > 0) ||
      (Array.isArray(oldMarco.linkedKbDocumentIds) && oldMarco.linkedKbDocumentIds.length > 0)
    );

    if (isEmptyContext(agentCtx) && agentId === "marco" && hasOldMarcoData) {
      const old = oldMarco as any;
      const migratedPriorities: any[] = [];
      if (Array.isArray(old.objectives)) {
        old.objectives.forEach((obj: any, idx: number) => {
          if (obj.name?.trim()) {
            const label = obj.name + (obj.deadline ? ` (entro ${obj.deadline})` : "") + (obj.priority === "alta" ? " [ALTA]" : obj.priority === "bassa" ? " [BASSA]" : "");
            migratedPriorities.push({ id: obj.id || crypto.randomUUID(), text: label, order: idx + 1 });
          }
        });
      }
      agentCtx = {
        focusPriorities: migratedPriorities,
        customContext: old.roadmap || "",
        injectionMode: "system_prompt",
        linkedKbDocumentIds: Array.isArray(old.linkedKbDocumentIds) ? old.linkedKbDocumentIds : [],
        reportStyle: old.reportStyle || "bilanciato",
      };
    }

    if (!agentCtx) {
      agentCtx = {
        focusPriorities: [],
        customContext: "",
        injectionMode: "system_prompt",
        linkedKbDocumentIds: [],
        reportStyle: "bilanciato",
      };
    }

    let phone = row?.consultant_phone || "";
    let email = row?.consultant_email || "";
    let whatsapp = row?.consultant_whatsapp || "";
    if (agentId === "marco" && hasOldMarcoData) {
      const old = oldMarco as any;
      if (!phone && old.consultantPhone) phone = old.consultantPhone;
      if (!email && old.consultantEmail) email = old.consultantEmail;
      if (!whatsapp && old.consultantWhatsapp) whatsapp = old.consultantWhatsapp;
    }

    return res.json({
      context: agentCtx,
      consultantPhone: phone,
      consultantEmail: email,
      consultantWhatsapp: whatsapp,
    });
  } catch (error: any) {
    console.error("[AI-AUTONOMY] Error fetching agent context:", error.message);
    return res.status(500).json({ error: "Errore nel recupero del contesto" });
  }
});

router.put("/agent-context/:agentId", authenticateToken, requireAnyRole(["consultant", "super_admin"]), async (req: Request, res: Response) => {
  try {
    const consultantId = (req as AuthRequest).user?.id;
    if (!consultantId) return res.status(401).json({ error: "Non autorizzato" });
    const { agentId } = req.params;
    const { context, consultantPhone, consultantEmail, consultantWhatsapp } = req.body;

    if (!context || typeof context !== 'object') {
      return res.status(400).json({ error: "Contesto non valido" });
    }

    const existingResult = await db.execute(sql`
      SELECT agent_contexts FROM ai_autonomy_settings 
      WHERE consultant_id::text = ${consultantId}::text LIMIT 1
    `);
    const existingContexts = (existingResult.rows[0] as any)?.agent_contexts || {};
    existingContexts[agentId] = context;

    await db.execute(sql`
      INSERT INTO ai_autonomy_settings (consultant_id, agent_contexts, consultant_phone, consultant_email, consultant_whatsapp)
      VALUES (
        ${consultantId}::uuid,
        ${JSON.stringify(existingContexts)}::jsonb,
        ${consultantPhone || null},
        ${consultantEmail || null},
        ${consultantWhatsapp || null}
      )
      ON CONFLICT (consultant_id) DO UPDATE
      SET agent_contexts = EXCLUDED.agent_contexts,
          consultant_phone = EXCLUDED.consultant_phone,
          consultant_email = EXCLUDED.consultant_email,
          consultant_whatsapp = EXCLUDED.consultant_whatsapp,
          updated_at = NOW()
    `);

    if (Array.isArray(context.linkedKbDocumentIds)) {
      try {
        await db.execute(sql`
          DELETE FROM agent_knowledge_assignments
          WHERE consultant_id = ${consultantId} AND agent_id = ${agentId}
        `);

        for (const docId of context.linkedKbDocumentIds) {
          if (docId && typeof docId === 'string') {
            const docExists = await db.execute(sql`
              SELECT id FROM consultant_knowledge_documents
              WHERE id = ${docId} AND consultant_id = ${consultantId}
              LIMIT 1
            `);
            if (docExists.rows?.length > 0) {
              await db.execute(sql`
                INSERT INTO agent_knowledge_assignments (consultant_id, agent_id, document_id)
                VALUES (${consultantId}, ${agentId}, ${docId})
                ON CONFLICT (consultant_id, agent_id, document_id) DO NOTHING
              `);
            }
          }
        }
      } catch (syncErr: any) {
        console.warn(`[AI-AUTONOMY] Failed to sync ${agentId} KB assignments:`, syncErr.message);
      }
    }

    const kbInjMode = context.kbInjectionMode || context.injectionMode || 'system_prompt';
    const linkedKbCount = Array.isArray(context.linkedKbDocumentIds) ? context.linkedKbDocumentIds.length : 0;
    if (linkedKbCount > 0 && kbInjMode === 'file_search') {
      console.log(`📤 [AI-AUTONOMY] KB docs for ${agentId} set to File Search mode (${linkedKbCount} docs)`);
    }

    return res.json({ success: true, message: "Contesto agente salvato" });
  } catch (error: any) {
    console.error("[AI-AUTONOMY] Error saving agent context:", error.message);
    return res.status(500).json({ error: "Errore nel salvataggio" });
  }
});

router.get("/kb-documents-list", authenticateToken, requireAnyRole(["consultant", "super_admin"]), async (req: Request, res: Response) => {
  try {
    const consultantId = (req as AuthRequest).user?.id;
    if (!consultantId) return res.status(401).json({ error: "Non autorizzato" });

    const result = await db.execute(sql`
      SELECT id, title, category, file_type, status, file_size, created_at 
      FROM consultant_knowledge_documents 
      WHERE consultant_id = ${consultantId} AND status = 'indexed'
      ORDER BY title ASC
    `);

    return res.json({ documents: result.rows });
  } catch (error: any) {
    console.error("[AI-AUTONOMY] Error fetching kb documents list:", error.message);
    return res.status(500).json({ error: "Errore nel recupero dei documenti" });
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
    const aiRole = req.query.ai_role as string | undefined;
    const period = req.query.period as string | undefined;

    let whereConditions = [sql`consultant_id = ${consultantId}`];
    if (eventType) {
      whereConditions.push(sql`event_type = ${eventType}`);
    }
    if (severity) {
      whereConditions.push(sql`severity = ${severity}`);
    }
    if (aiRole && aiRole !== 'all') {
      whereConditions.push(sql`event_data->>'ai_role' = ${aiRole}`);
    }
    if (period && period !== 'all') {
      const now = new Date();
      let startDate: Date;
      switch (period) {
        case 'today':
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          break;
        case 'week':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case 'month':
          startDate = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
          break;
        default:
          startDate = new Date(0);
      }
      whereConditions.push(sql`created_at >= ${startDate.toISOString()}`);
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

    const activities = (itemsResult.rows as any[]).map(row => {
      if (row.event_data && typeof row.event_data === 'object' && row.event_data.full_prompt) {
        const { full_prompt, ...rest } = row.event_data;
        return { ...row, event_data: { ...rest, has_full_prompt: true } };
      }
      return row;
    });

    return res.json({
      activities,
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

router.get("/activity/:id/full-prompt", authenticateToken, requireAnyRole(["consultant", "super_admin"]), async (req: Request, res: Response) => {
  try {
    const consultantId = (req as AuthRequest).user?.id;
    if (!consultantId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { id } = req.params;

    const result = await db.execute(sql`
      SELECT event_data->>'full_prompt' as full_prompt, description, title
      FROM ai_activity_log
      WHERE id = ${id} AND consultant_id = ${consultantId}
        AND event_type = 'system_prompt_log'
      LIMIT 1
    `);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Not found" });
    }

    const row = result.rows[0] as any;
    const prompt = row.full_prompt || row.description || '';

    return res.json({ prompt, title: row.title });
  } catch (error: any) {
    console.error("[AI-AUTONOMY] Error fetching full prompt:", error);
    return res.status(500).json({ error: "Failed to fetch full prompt" });
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

router.delete("/activity/clear-old", authenticateToken, requireAnyRole(["consultant", "super_admin"]), async (req: Request, res: Response) => {
  try {
    const consultantId = (req as AuthRequest).user?.id;
    if (!consultantId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const result = await db.execute(sql`
      DELETE FROM ai_activity_log
      WHERE consultant_id = ${consultantId}
        AND (cycle_id IS NULL OR cycle_id = '')
    `);

    return res.json({ success: true, deleted: result.rowCount || 0 });
  } catch (error: any) {
    console.error("[AI-AUTONOMY] Error clearing old activities:", error);
    return res.status(500).json({ error: "Failed to clear old activities" });
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
      JOIN user_role_profiles urp ON u.id::text = urp.user_id
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
    const channelsEnabled = settings?.channels_enabled || { voice: true, email: false, whatsapp: false, lead_scraper: true };

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
    const { getGeminiApiKeyForClassifier, GEMINI_LEGACY_MODEL, trackedGenerateContent: trackedGen } = await import("../ai/provider-factory");

    const apiKey = await getGeminiApiKeyForClassifier();
    const genAI = new GoogleGenAI({ apiKey });

    const result = await trackedGen(genAI, {
      model: GEMINI_LEGACY_MODEL,
      contents: prompt,
      config: {
        temperature: 0.3,
        maxOutputTokens: 500,
      }
    } as any, { consultantId: req.user?.id || '', feature: 'decision-engine', keySource: 'classifier' });

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

    const { ai_instruction, task_category, priority, contact_name, contact_phone, client_id, preferred_channel, tone, urgency, scheduled_datetime, objective, additional_context, voice_template_suggestion, language, agent_config_id, execution_mode } = req.body;

    if (!ai_instruction || typeof ai_instruction !== "string" || !ai_instruction.trim()) {
      return res.status(400).json({ error: "ai_instruction is required" });
    }

    const validCategories = ["outreach", "reminder", "followup", "analysis", "report", "research", "preparation", "monitoring", "check_in"];
    if (!task_category || !validCategories.includes(task_category)) {
      return res.status(400).json({ error: `task_category must be one of: ${validCategories.join(", ")}` });
    }

    let sanitizedPhone = contact_phone ? String(contact_phone).replace(/[^0-9+\s\-()]/g, '').trim() : null;
    if (sanitizedPhone && !/^\+?[0-9\s\-()]{3,20}$/.test(sanitizedPhone)) {
      return res.status(400).json({ error: "Formato telefono non valido. Usa un numero di telefono o interno (es: +39 333 1234567, 1009)" });
    }
    if (sanitizedPhone && !sanitizedPhone.startsWith('+') && sanitizedPhone.replace(/[\s\-()]/g, '').length >= 9) {
      sanitizedPhone = '+39' + sanitizedPhone.replace(/[\s\-()]/g, '');
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
        preferred_channel, tone, urgency, scheduled_datetime, objective, additional_context, voice_template_suggestion, language, whatsapp_config_id, execution_mode
      ) VALUES (
        ${taskId}, ${consultantId}, 'ai_task', ${task_category}, ${ai_instruction.trim()}, 'scheduled',
        NOW(), 'Europe/Rome', 'manual', ${taskPriority}, ${contact_name || null}, ${sanitizedPhone || ''}, ${client_id || null},
        ${preferred_channel || null}, ${tone || null}, ${urgency || 'normal'}, ${scheduled_datetime ? new Date(scheduled_datetime) : null}, ${objective || null}, ${additional_context || null}, ${voice_template_suggestion || null}, ${language || 'it'}, ${agent_config_id || null}, ${execution_mode === 'assisted' ? 'assisted' : 'autonomous'}
      )
      RETURNING *
    `);

    if (sanitizedPhone) {
      try {
        const { ensureProactiveLead } = await import('../utils/ensure-proactive-lead');
        let additionalCtx: Record<string, any> = {};
        if (additional_context) {
          try { additionalCtx = JSON.parse(additional_context); } catch {}
        }
        await ensureProactiveLead({
          consultantId,
          phoneNumber: sanitizedPhone,
          contactName: contact_name || undefined,
          source: 'manual',
          status: 'pending',
          agentConfigId: agent_config_id || undefined,
          leadInfo: {
            fonte: `Task manuale (${preferred_channel || 'generico'})`,
            obiettivi: objective || undefined,
          },
          consultantNotes: additionalCtx.custom_context || undefined,
        });
      } catch (epErr: any) {
        console.error("[AI-AUTONOMY] ensureProactiveLead error (non-blocking):", epErr.message);
      }
    }

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
    const limit = Math.min(500, Math.max(1, parseInt(req.query.limit as string) || 10));
    const offset = (page - 1) * limit;
    const statusFilter = req.query.status as string | undefined;
    const categoryFilter = req.query.category as string | undefined;
    const originFilter = req.query.origin as string | undefined;
    const roleFilter = req.query.ai_role as string | undefined;

    const includeHunter = req.query.include_hunter === 'true';
    let conditions = [sql`consultant_id = ${consultantId}`, includeHunter ? sql`task_type IN ('ai_task', 'single_whatsapp', 'single_call')` : sql`task_type = 'ai_task'`];
    if (!statusFilter || statusFilter === 'all') {
      conditions.push(sql`status != 'cancelled'`);
    }
    if (statusFilter && statusFilter !== 'all') {
      if (statusFilter === 'active') {
        conditions.push(sql`status IN ('scheduled', 'in_progress', 'approved')`);
      } else if (statusFilter === 'paused') {
        conditions.push(sql`status IN ('paused', 'draft', 'waiting_input')`);
      } else if (statusFilter === 'cancelled') {
        conditions.push(sql`status = 'cancelled'`);
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
    if (roleFilter && roleFilter !== 'all') {
      if (roleFilter === '__manual__') {
        conditions.push(sql`(ai_role IS NULL OR ai_role = '')`);
      } else {
        conditions.push(sql`ai_role = ${roleFilter}`);
      }
    }

    const whereClause = sql.join(conditions, sql` AND `);

    const [tasksResult, countResult] = await Promise.all([
      db.execute(sql`
        SELECT id, consultant_id, contact_name, contact_phone, contact_id, task_type, task_category,
               ai_instruction, status, origin_type, priority, ai_reasoning, ai_confidence,
               execution_plan, result_summary, result_data, scheduled_at,
               completed_at, created_at, updated_at, call_after_task, ai_role,
               preferred_channel, tone, objective,
               scheduling_reason, scheduled_by, original_scheduled_at,
               parent_task_id, additional_context, whatsapp_config_id,
               current_attempt, max_attempts, error_message,
               (SELECT COUNT(*)::int FROM ai_activity_log al WHERE al.task_id = ai_scheduled_tasks.id AND (al.title ILIKE '%follow-up%' OR al.title ILIKE '%follow_up%' OR al.title ILIKE '%aggregat%')) as follow_up_count
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

    const [activityResult, followUpsResult, aggregatedFollowUpsResult] = await Promise.all([
      db.execute(sql`
        SELECT * FROM ai_activity_log
        WHERE task_id = ${id} AND consultant_id = ${consultantId}
        ORDER BY created_at ASC
      `),
      db.execute(sql`
        SELECT id, ai_instruction, task_category, status, contact_name, ai_role,
               scheduled_at, created_at, result_summary, priority, completed_at
        FROM ai_scheduled_tasks
        WHERE parent_task_id = ${id} AND consultant_id = ${consultantId}
        ORDER BY created_at ASC
      `),
      db.execute(sql`
        SELECT id, title, description, created_at
        FROM ai_activity_log
        WHERE task_id = ${id} AND consultant_id = ${consultantId}
          AND (title ILIKE '%follow-up%' OR title ILIKE '%follow_up%' OR title ILIKE '%aggregat%')
        ORDER BY created_at ASC
      `),
    ]);

    return res.json({
      task: result.rows[0],
      activity: activityResult.rows,
      follow_ups: followUpsResult.rows,
      aggregated_followups: aggregatedFollowUpsResult.rows,
    });
  } catch (error: any) {
    console.error("[AI-AUTONOMY] Error fetching task detail:", error);
    return res.status(500).json({ error: "Failed to fetch task detail" });
  }
});

router.get("/employee-profile/:roleId", authenticateToken, requireAnyRole(["consultant", "super_admin"]), async (req: Request, res: Response) => {
  try {
    const consultantId = (req as AuthRequest).user?.id;
    if (!consultantId) return res.status(401).json({ error: "Unauthorized" });
    const { roleId } = req.params;

    const [statsResult, recentTasksResult, activityResult, docsResult] = await Promise.all([
      db.execute(sql`
        SELECT 
          COUNT(*)::int as total,
          COUNT(*) FILTER (WHERE status = 'completed')::int as completed,
          COUNT(*) FILTER (WHERE status = 'failed')::int as failed,
          COUNT(*) FILTER (WHERE status IN ('scheduled', 'in_progress', 'approved'))::int as active,
          COUNT(*) FILTER (WHERE status = 'waiting_input')::int as waiting_input,
          ROUND(AVG(EXTRACT(EPOCH FROM (updated_at - created_at)) / 60) FILTER (WHERE status = 'completed'), 1) as avg_minutes,
          COUNT(*) FILTER (WHERE task_category = 'outreach')::int as outreach_count,
          COUNT(*) FILTER (WHERE task_category = 'followup')::int as followup_count,
          COUNT(*) FILTER (WHERE task_category = 'analysis')::int as analysis_count,
          COUNT(*) FILTER (WHERE task_category = 'monitoring')::int as monitoring_count,
          COUNT(*) FILTER (WHERE task_category = 'preparation')::int as preparation_count,
          COUNT(*) FILTER (WHERE task_category = 'reminder')::int as reminder_count
        FROM ai_scheduled_tasks
        WHERE consultant_id = ${consultantId} AND ai_role = ${roleId} AND task_type = 'ai_task' AND status != 'cancelled'
      `),
      db.execute(sql`
        SELECT id, status, task_category, contact_name, ai_instruction, created_at, updated_at, result_data, execution_mode
        FROM ai_scheduled_tasks
        WHERE consultant_id = ${consultantId} AND ai_role = ${roleId} AND task_type = 'ai_task' AND status != 'cancelled'
        ORDER BY created_at DESC
        LIMIT 20
      `),
      db.execute(sql`
        SELECT id, event_type, title, description, icon, severity, created_at, contact_name
        FROM ai_activity_log
        WHERE consultant_id = ${consultantId} AND ai_role = ${roleId}
        ORDER BY created_at DESC
        LIMIT 30
      `),
      db.execute(sql`
        SELECT COUNT(*)::int as count
        FROM ai_scheduled_tasks
        WHERE consultant_id = ${consultantId} AND ai_role = ${roleId} AND task_type = 'ai_task' AND status = 'completed'
          AND result_data::text LIKE '%formal_document%'
      `),
    ]);

    const stats = statsResult.rows[0] || {};
    const total = (stats as any).total || 0;
    const completed = (stats as any).completed || 0;
    const successRate = total > 0 ? Math.round((completed / total) * 100) : 0;

    return res.json({
      stats: { ...stats, success_rate: successRate },
      recent_tasks: recentTasksResult.rows,
      activity: activityResult.rows,
      documents_generated: (docsResult.rows[0] as any)?.count || 0,
    });
  } catch (error: any) {
    console.error("[AI-AUTONOMY] Error fetching employee profile:", error);
    return res.status(500).json({ error: "Failed to fetch employee profile" });
  }
});

router.get("/tasks-stats", authenticateToken, requireAnyRole(["consultant", "super_admin"]), async (req: Request, res: Response) => {
  try {
    const consultantId = (req as AuthRequest).user?.id;
    if (!consultantId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const [result, roleCountsResult, manualCountResult] = await Promise.all([
      db.execute(sql`
        SELECT 
          COUNT(*) FILTER (WHERE status != 'cancelled')::int as total,
          COUNT(*) FILTER (WHERE status IN ('scheduled', 'in_progress', 'approved'))::int as active,
          COUNT(*) FILTER (WHERE status = 'completed')::int as completed,
          COUNT(*) FILTER (WHERE status = 'failed')::int as failed,
          COUNT(*) FILTER (WHERE status IN ('paused', 'draft', 'waiting_approval', 'deferred', 'waiting_input'))::int as pending,
          COUNT(*) FILTER (WHERE status = 'waiting_approval')::int as waiting_approval,
          COUNT(*) FILTER (WHERE status = 'scheduled')::int as scheduled,
          COUNT(*) FILTER (WHERE status = 'in_progress')::int as in_progress,
          COUNT(*) FILTER (WHERE status = 'deferred')::int as deferred,
          COUNT(*) FILTER (WHERE status = 'cancelled')::int as cancelled
        FROM ai_scheduled_tasks
        WHERE consultant_id = ${consultantId} AND task_type = 'ai_task'
      `),
      db.execute(sql`
        SELECT ai_role as role, COUNT(*)::int as count
        FROM ai_scheduled_tasks
        WHERE consultant_id = ${consultantId} AND task_type = 'ai_task' AND status != 'cancelled' AND ai_role IS NOT NULL
        GROUP BY ai_role
      `),
      db.execute(sql`
        SELECT COUNT(*)::int as count
        FROM ai_scheduled_tasks
        WHERE consultant_id = ${consultantId} AND task_type = 'ai_task' AND status != 'cancelled' AND ai_role IS NULL
      `),
    ]);

    const stats = result.rows[0] || { total: 0, active: 0, completed: 0, failed: 0, pending: 0 };
    return res.json({
      ...stats,
      role_counts: roleCountsResult.rows,
      manual_count: (manualCountResult.rows[0] as any)?.count || 0,
    });
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
      db.execute(sql`SELECT u.id, u.first_name, u.last_name, u.email, u.phone_number FROM users u JOIN user_role_profiles urp ON u.id::text = urp.user_id WHERE urp.consultant_id = ${consultantId} AND urp.role = 'client' LIMIT 20`),
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
    const result = await trackedGenerateContent(ai, {
      model: GEMINI_3_MODEL,
      contents: chatHistory,
      config: {
        systemInstruction: systemPrompt,
        temperature: 0.7,
        maxOutputTokens: 2048,
        thinkingConfig: { thinkingBudget: 1024 },
      },
    } as any, { consultantId: req.user?.id || '', feature: 'decision-engine', keySource: 'classifier' });

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

router.post("/tasks/:taskId/resume", authenticateToken, requireAnyRole(["consultant", "super_admin"]), async (req: Request, res: Response) => {
  try {
    const consultantId = (req as AuthRequest).user?.id;
    if (!consultantId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const { taskId } = req.params;
    const { consultant_feedback } = req.body;

    if (!consultant_feedback?.trim()) {
      return res.status(400).json({ error: 'Feedback is required' });
    }

    const taskResult = await db.execute(sql`
      SELECT * FROM ai_scheduled_tasks 
      WHERE id = ${taskId} AND consultant_id::text = ${consultantId}::text AND status = 'waiting_input'
    `);

    if (taskResult.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found or not waiting for input' });
    }

    const task = taskResult.rows[0] as any;
    const interactionHistory = Array.isArray(task.interaction_history) ? task.interaction_history : [];
    const pausedAtStep = task.result_data?.paused_at_step || 0;

    interactionHistory.push({
      step: pausedAtStep,
      feedback: consultant_feedback,
      timestamp: new Date().toISOString()
    });

    const updatedContext = [
      task.additional_context || '',
      `\n\n[FEEDBACK CONSULENTE dopo step ${pausedAtStep}]: ${consultant_feedback}`
    ].join('');

    await db.execute(sql`
      UPDATE ai_scheduled_tasks 
      SET status = 'scheduled',
          scheduled_at = NOW(),
          interaction_history = ${JSON.stringify(interactionHistory)}::jsonb,
          additional_context = ${updatedContext},
          result_summary = ${'Ripresa esecuzione con il tuo feedback...'},
          updated_at = NOW()
      WHERE id = ${taskId}
    `);

    await logActivity(consultantId, {
      event_type: 'task_resumed',
      title: `Ricevuto! Riprendo da dove mi ero fermato`,
      description: `Ho letto il tuo feedback e ora continuo con le nuove indicazioni`,
      icon: '▶️',
      severity: 'info',
      task_id: taskId,
      contact_name: task.contact_name,
      contact_id: task.contact_id,
    });

    res.json({ success: true, message: 'Task resumed' });
  } catch (error: any) {
    console.error('Error resuming task:', error);
    res.status(500).json({ error: error.message });
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

    if (!['paused', 'scheduled', 'failed', 'completed'].includes(task.status)) {
      return res.status(400).json({ error: `Cannot execute task with status '${task.status}'. Only 'paused', 'scheduled', 'failed', or 'completed' tasks can be manually executed.` });
    }

    const isRetry = task.status === 'failed' || task.status === 'completed';

    await db.execute(sql`
      UPDATE ai_scheduled_tasks
      SET status = 'in_progress',
          current_attempt = COALESCE(current_attempt, 0) + 1,
          last_attempt_at = NOW(),
          error_message = NULL,
          execution_plan = ${isRetry ? sql`'[]'::jsonb` : sql`execution_plan`},
          result_data = COALESCE(result_data, '{}'::jsonb) || '{"skip_guardrails": true}'::jsonb,
          result_summary = ${isRetry ? sql`NULL` : sql`result_summary`},
          updated_at = NOW()
      WHERE id = ${id}
    `);

    const isCrmOutreach = task.preferred_channel === 'lead_crm' || (task.ai_instruction || '').includes('TIPO: crm_lead_outreach');
    if (isCrmOutreach) {
      console.log(`🎯 [CRM-OUTREACH-ROUTE] Task ${task.id} is crm_lead_outreach — calling handleCrmLeadOutreach directly`);
      res.json({ success: true, status: 'executing_crm_outreach' });
      const { handleCrmLeadOutreach } = await import("../cron/ai-task-scheduler");
      const freshTaskResult = await db.execute(sql`SELECT * FROM ai_scheduled_tasks WHERE id = ${id}`);
      if (freshTaskResult.rows.length > 0) {
        await handleCrmLeadOutreach(freshTaskResult.rows[0] as any);
      }
      return;
    }

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
            title: `Sto ragionando su come procedere...`,
            description: `Analizzo il contesto e preparo il piano migliore per "${task.ai_instruction?.substring(0, 60) || 'questo task'}"`,
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
          }, { isManual: true, skipGuardrails: true, roleId: task.ai_role || undefined });

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
              title: `Ho valutato e non serve procedere`,
              description: `Ho analizzato la situazione: ${decision.reasoning.substring(0, 300)}`,
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
                console.log(`🔄 [AI-AUTONOMY] [MANUAL-EXEC] [MARCO] Redirecting contact to consultant: ${consultantPhone}`);
                resolvedContactPhone = consultantPhone;
                resolvedContactName = 'Consulente (tu)';
                resolvedContactId = null;
              }
              const agentContexts = settingsRow.agent_contexts || {};
              const marcoCtx = agentContexts['marco'];
              if (marcoCtx?.defaultWhatsappAgentId && !resolvedWhatsappConfigId) {
                resolvedWhatsappConfigId = marcoCtx.defaultWhatsappAgentId;
                console.log(`📱 [AI-AUTONOMY] [MANUAL-EXEC] [MARCO] Using configured WhatsApp agent: ${resolvedWhatsappConfigId}`);
              }
            }
          } catch (err: any) {
            console.error(`⚠️ [AI-AUTONOMY] [MANUAL-EXEC] [MARCO] Failed to resolve consultant contacts: ${err.message}`);
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
                console.log(`📱 [AI-AUTONOMY] [MANUAL-EXEC] [${taskRole.toUpperCase()}] Using configured WhatsApp agent: ${resolvedWhatsappConfigId}`);
              }
            }
          } catch (err: any) {
            console.error(`⚠️ [AI-AUTONOMY] [MANUAL-EXEC] [${taskRole.toUpperCase()}] Failed to resolve WhatsApp agent: ${err.message}`);
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
            console.log(`💾 [AI-AUTONOMY] [MANUAL-EXEC] Persisted resolved contacts/agent for task ${task.id}`);
          } catch (persistErr: any) {
            console.warn(`⚠️ [AI-AUTONOMY] [MANUAL-EXEC] Failed to persist resolved contacts: ${persistErr.message}`);
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

        for (let i = 0; i < totalSteps; i++) {
          const step = executionPlan[i];
          const stepName = step.action || `step_${i + 1}`;

          console.log(`🧠 [AI-AUTONOMY] Executing step ${i + 1}/${totalSteps}: ${stepName}`);

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
              errorMessage: `Fallito allo step "${failedStep}" (${completedSteps}/${totalSteps})`,
              taskCategory: task.task_category,
            })
          ).catch(() => {});
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
              resultSummary: `${totalSteps} step completati con successo`,
              taskCategory: task.task_category,
            })
          ).catch(() => {});

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
        JOIN user_role_profiles urp ON u.id::text = urp.user_id
        WHERE urp.consultant_id = ${consultantId}
          AND urp.role = 'client'
          AND u.is_active = true
          AND u.id::text ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
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
        JOIN user_role_profiles urp ON u.id::text = urp.user_id
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

    const checkInterval = 30;
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

    const { AI_ROLES } = await import("../cron/ai-autonomous-roles");
    const enabledRolesData = settings.enabled_roles || { alessia: true, millie: true, echo: true, nova: true, stella: true };

    const lastTaskByRoleResult = await db.execute(sql`
      SELECT ai_role, MAX(created_at) as last_task_at, COUNT(*)::int as total_tasks
      FROM ai_scheduled_tasks
      WHERE consultant_id::text = ${consultantId}::text
        AND ai_role IS NOT NULL
        AND created_at > NOW() - INTERVAL '30 days'
      GROUP BY ai_role
    `);
    const roleStats: Record<string, any> = {};
    for (const row of lastTaskByRoleResult.rows as any[]) {
      if (row.ai_role) {
        roleStats[row.ai_role] = { last_task_at: row.last_task_at, total_tasks_30d: row.total_tasks };
      }
    }

    const rolesInfo = Object.entries(AI_ROLES).map(([id, role]) => ({
      id,
      name: role.name,
      displayName: role.displayName,
      avatar: role.avatar,
      accentColor: role.accentColor,
      description: role.description,
      shortDescription: role.shortDescription,
      categories: role.categories,
      preferredChannels: role.preferredChannels,
      enabled: enabledRolesData[id] !== false,
      last_task_at: roleStats[id]?.last_task_at || null,
      total_tasks_30d: roleStats[id]?.total_tasks_30d || 0,
    }));

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
      roles: rolesInfo,
      enabled_roles: enabledRolesData,
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

    const allowedEventTypes = ['autonomous_analysis', 'autonomous_task_created', 'autonomous_error', 'system_prompt_log'];
    const filterEventTypes = eventTypeFilter !== "all" && allowedEventTypes.includes(eventTypeFilter)
      ? [eventTypeFilter]
      : allowedEventTypes;

    const eventTypeSql = filterEventTypes.length === 1
      ? sql`AND event_type = ${filterEventTypes[0]}`
      : sql`AND event_type IN ('autonomous_analysis', 'autonomous_task_created', 'autonomous_error', 'system_prompt_log')`;

    const severitySql = severityFilter !== "all"
      ? sql`AND severity = ${severityFilter}`
      : sql``;

    const roleFilter = req.query.ai_role as string || "all";
    const roleSql = roleFilter !== "all" ? sql`AND ai_role = ${roleFilter}` : sql``;

    const [logsResult, totalResult] = await Promise.all([
      db.execute(sql`
        SELECT id, event_type, title, description, icon, severity, created_at, event_data, contact_name, task_id, ai_role
        FROM ai_activity_log
        WHERE consultant_id = ${consultantId}
          ${eventTypeSql}
          ${severitySql}
          ${roleSql}
        ORDER BY created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `),
      db.execute(sql`
        SELECT COUNT(*)::int as count FROM ai_activity_log
        WHERE consultant_id = ${consultantId}
          ${eventTypeSql}
          ${severitySql}
          ${roleSql}
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
      title: result.error ? `Non sono riuscito a completare l'analisi...` : `Analisi completata!`,
      description: result.error
        ? `Ho avuto un problema: ${result.error}`
        : `Ho analizzato la situazione e ho generato ${result.tasksGenerated} task da fare.`,
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

router.post("/trigger-role/:roleId", authenticateToken, requireAnyRole(["consultant", "super_admin"]), async (req: Request, res: Response) => {
  try {
    const consultantId = (req as AuthRequest).user?.id;
    if (!consultantId) return res.status(401).json({ error: "Unauthorized" });

    const { roleId } = req.params;

    const validRoleIds = ['alessia', 'millie', 'echo', 'nova', 'stella', 'marco', 'personalizza', 'hunter'];
    if (!validRoleIds.includes(roleId)) {
      return res.status(400).json({ error: "Ruolo non valido" });
    }

    const settingsCheck = await db.execute(sql`SELECT is_active, autonomy_level FROM ai_autonomy_settings WHERE consultant_id = ${consultantId} LIMIT 1`);
    const s = settingsCheck.rows[0] as any;
    if (!s || !s.is_active || s.autonomy_level < 2) {
      return res.status(400).json({ success: false, error: "Sistema non attivo o livello autonomia insufficiente (min. 2)" });
    }

    console.log(`🧠 [AI-AUTONOMY] Manual trigger for role ${roleId} by consultant ${consultantId}`);

    const result = await triggerAutonomousGenerationForConsultant(consultantId, roleId);

    const roleName = roleId.charAt(0).toUpperCase() + roleId.slice(1);
    await logActivity(consultantId, {
      event_type: 'autonomous_analysis',
      severity: result.error ? 'error' : 'info',
      title: result.error ? `Ho avuto un problema con l'avvio...` : `Eccomi! Ho finito la mia analisi`,
      description: result.error
        ? `Non sono riuscito a completare il lavoro: ${result.error}`
        : `Ho analizzato tutto e ho generato ${result.tasksGenerated} task.`,
      event_data: { manual: true, role_id: roleId, tasks_generated: result.tasksGenerated, error: result.error || null },
    });

    return res.json({
      success: !result.error,
      tasks_generated: result.tasksGenerated,
      role_id: roleId,
      error: result.error || null,
    });
  } catch (error: any) {
    console.error("[AI-AUTONOMY] Error triggering role:", error);
    return res.status(500).json({ error: "Failed to trigger role" });
  }
});

router.get("/roles", authenticateToken, requireAnyRole(["consultant", "super_admin"]), async (req: Request, res: Response) => {
  try {
    const consultantId = (req as AuthRequest).user?.id;
    if (!consultantId) return res.status(401).json({ error: "Unauthorized" });

    const { AI_ROLES } = await import("../cron/ai-autonomous-roles");

    const settingsResult = await db.execute(sql`
      SELECT enabled_roles FROM ai_autonomy_settings WHERE consultant_id = ${consultantId} LIMIT 1
    `);
    const enabledRoles = (settingsResult.rows[0] as any)?.enabled_roles || { alessia: true, millie: true, echo: true, nova: true, stella: true };

    const lastTaskByRoleResult = await db.execute(sql`
      SELECT ai_role, MAX(created_at) as last_task_at, COUNT(*)::int as total_tasks
      FROM ai_scheduled_tasks
      WHERE consultant_id::text = ${consultantId}::text AND ai_role IS NOT NULL AND created_at > NOW() - INTERVAL '30 days'
      GROUP BY ai_role
    `);
    const roleStats: Record<string, any> = {};
    for (const row of lastTaskByRoleResult.rows as any[]) {
      if (row.ai_role) roleStats[row.ai_role] = { last_task_at: row.last_task_at, total_tasks_30d: row.total_tasks };
    }

    const roles = Object.entries(AI_ROLES).map(([id, role]) => ({
      id,
      name: role.name,
      displayName: role.displayName,
      avatar: role.avatar,
      accentColor: role.accentColor,
      description: role.description,
      shortDescription: role.shortDescription,
      categories: role.categories,
      preferredChannels: role.preferredChannels,
      typicalPlan: role.typicalPlan,
      maxTasksPerRun: role.maxTasksPerRun,
      enabled: enabledRoles[id] !== false,
      last_task_at: roleStats[id]?.last_task_at || null,
      total_tasks_30d: roleStats[id]?.total_tasks_30d || 0,
    }));

    return res.json({ roles, enabled_roles: enabledRoles });
  } catch (error: any) {
    console.error("[AI-AUTONOMY] Error fetching roles:", error);
    return res.status(500).json({ error: "Failed to fetch roles" });
  }
});

router.put("/roles/toggle", authenticateToken, requireAnyRole(["consultant", "super_admin"]), async (req: Request, res: Response) => {
  try {
    const consultantId = (req as AuthRequest).user?.id;
    if (!consultantId) return res.status(401).json({ error: "Unauthorized" });

    const { roleId, enabled } = req.body;
    if (!roleId || typeof enabled !== 'boolean') {
      return res.status(400).json({ error: "roleId and enabled (boolean) are required" });
    }

    const { AI_ROLES } = await import("../cron/ai-autonomous-roles");
    if (!AI_ROLES[roleId]) {
      return res.status(400).json({ error: `Invalid role: ${roleId}` });
    }

    const settingsResult = await db.execute(sql`
      SELECT enabled_roles FROM ai_autonomy_settings WHERE consultant_id = ${consultantId} LIMIT 1
    `);
    const currentRoles = (settingsResult.rows[0] as any)?.enabled_roles || { alessia: true, millie: true, echo: true, nova: true, stella: true };
    currentRoles[roleId] = enabled;

    await db.execute(sql`
      INSERT INTO ai_autonomy_settings (consultant_id, enabled_roles)
      VALUES (${consultantId}::uuid, ${JSON.stringify(currentRoles)}::jsonb)
      ON CONFLICT (consultant_id) DO UPDATE
      SET enabled_roles = EXCLUDED.enabled_roles,
          updated_at = NOW()
    `);

    await logActivity(consultantId, {
      event_type: 'autonomous_analysis',
      title: enabled ? `Sono pronto a lavorare!` : `Mi fermo, sono stato messo in pausa`,
      description: enabled
        ? `${AI_ROLES[roleId].displayName} è stato attivato e pronto a dare il massimo!`
        : `${AI_ROLES[roleId].displayName} è stato messo in pausa. Quando vorrai, riattivami!`,
      icon: enabled ? '✅' : '⏸️',
      severity: 'info',
      ai_role: roleId,
    });

    return res.json({ success: true, enabled_roles: currentRoles });
  } catch (error: any) {
    console.error("[AI-AUTONOMY] Error toggling role:", error);
    return res.status(500).json({ error: "Failed to toggle role" });
  }
});

router.put("/roles/bulk-toggle", authenticateToken, requireAnyRole(["consultant", "super_admin"]), async (req: Request, res: Response) => {
  try {
    const consultantId = (req as AuthRequest).user?.id;
    if (!consultantId) return res.status(401).json({ error: "Unauthorized" });

    const { enabled_roles } = req.body;
    if (!enabled_roles || typeof enabled_roles !== 'object') {
      return res.status(400).json({ error: "enabled_roles object is required" });
    }

    const { AI_ROLES } = await import("../cron/ai-autonomous-roles");
    const validatedRoles: Record<string, boolean> = {};
    for (const [key, value] of Object.entries(enabled_roles)) {
      if (AI_ROLES[key] && typeof value === 'boolean') {
        validatedRoles[key] = value;
      }
    }

    for (const roleId of Object.keys(AI_ROLES)) {
      if (validatedRoles[roleId] === undefined) {
        validatedRoles[roleId] = true;
      }
    }

    await db.execute(sql`
      INSERT INTO ai_autonomy_settings (consultant_id, enabled_roles)
      VALUES (${consultantId}::uuid, ${JSON.stringify(validatedRoles)}::jsonb)
      ON CONFLICT (consultant_id) DO UPDATE
      SET enabled_roles = EXCLUDED.enabled_roles,
          updated_at = NOW()
    `);

    return res.json({ success: true, enabled_roles: validatedRoles });
  } catch (error: any) {
    console.error("[AI-AUTONOMY] Error bulk toggling roles:", error);
    return res.status(500).json({ error: "Failed to bulk toggle roles" });
  }
});

router.patch("/tasks/:id/approve", authenticateToken, requireAnyRole(["consultant", "super_admin"]), async (req: Request, res: Response) => {
  try {
    const consultantId = (req as AuthRequest).user?.id;
    if (!consultantId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { id } = req.params;

    const result = await db.execute(sql`
      UPDATE ai_scheduled_tasks
      SET status = 'scheduled',
          updated_at = NOW(),
          result_data = COALESCE(result_data, '{}'::jsonb) || '{"manually_approved": true, "skip_guardrails": true}'::jsonb
      WHERE id = ${id}
        AND consultant_id = ${consultantId}
        AND status = 'waiting_approval'
      RETURNING id, task_type, ai_role, preferred_channel, contact_name, contact_phone, ai_instruction, additional_context, scheduled_at
    `);

    if ((result.rowCount ?? 0) === 0) {
      return res.status(400).json({ error: "Task non trovato o non in attesa di approvazione" });
    }

    const approvedTask = result.rows[0] as any;

    if (approvedTask.ai_role === 'hunter') {
      console.log(`[HUNTER-APPROVE] Step 1/3: Task ${id} approved (type=${approvedTask.task_type}, channel=${approvedTask.preferred_channel}, contact=${approvedTask.contact_name})`);

      if (approvedTask.task_type === 'single_call') {
        const voiceResult = await db.execute(sql`
          UPDATE scheduled_voice_calls
          SET status = 'scheduled', updated_at = NOW()
          WHERE source_task_id = ${id} AND status = 'pending'
          RETURNING id
        `);
        const activatedCount = voiceResult.rowCount ?? 0;
        console.log(`[HUNTER-APPROVE] Step 2/3: Voice call activated (${activatedCount} entries updated, source_task_id=${id})`);
        console.log(`[HUNTER-APPROVE] Step 3/3: Done — voice call for "${approvedTask.contact_name}" now visible in /consultant/voice-calls`);
      }

      if (approvedTask.task_type === 'single_whatsapp') {
        const waScheduledAt = new Date(approvedTask.scheduled_at);
        if (waScheduledAt <= new Date()) {
          console.log(`[HUNTER-APPROVE] Step 2/3: WhatsApp scheduled_at is in the past (${waScheduledAt.toISOString()}) — will be picked up by cron immediately`);
        } else {
          console.log(`[HUNTER-APPROVE] Step 2/3: WhatsApp scheduled for ${waScheduledAt.toISOString()} — will be sent at calendar time`);
        }
        console.log(`[HUNTER-APPROVE] Step 3/3: Done — WA message for "${approvedTask.contact_name}" approved (status=scheduled)`);
      }

      if (approvedTask.preferred_channel === 'email' && approvedTask.ai_role === 'hunter') {
        const emailScheduledAt = new Date(approvedTask.scheduled_at);
        const now = new Date();

        if (emailScheduledAt > now) {
          console.log(`[HUNTER-APPROVE] Step 2/3: Email scheduled for ${emailScheduledAt.toISOString()} — will be sent by cron at calendar time`);
          console.log(`[HUNTER-APPROVE] Step 3/3: Done — Email for "${approvedTask.contact_name}" approved (status=scheduled, scheduled_at=${emailScheduledAt.toISOString()})`);
        } else {
          console.log(`[HUNTER-APPROVE] Step 2/3: Email scheduled_at is in the past (${emailScheduledAt.toISOString()}) — sending immediately...`);
          let additionalContextData: Record<string, any> = {};
          try { additionalContextData = JSON.parse(approvedTask.additional_context || '{}'); } catch {}
          const emailAccountId = additionalContextData.email_account_id;

          if (emailAccountId) {
            try {
              const smtpResult = await db.execute(sql`
                SELECT id, smtp_host, smtp_port, smtp_user, smtp_password, email_address, display_name
                FROM email_accounts
                WHERE id = ${emailAccountId} AND consultant_id = ${consultantId} AND smtp_host IS NOT NULL
                LIMIT 1
              `);
              const smtpConfig = smtpResult.rows[0] as any;
              const leadEmail = additionalContextData.lead_email || '';

              if (smtpConfig && leadEmail) {
                const instructionText = approvedTask.ai_instruction || '';
                const subjectMatch = instructionText.match(/^Oggetto:\s*(.+?)(?:\n|$)/);
                const emailSubject = subjectMatch ? subjectMatch[1].trim() : `Proposta per ${approvedTask.contact_name}`;
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
                    ${hubEmailId}, ${emailAccountId}, ${consultantId},
                    ${sendResult.messageId || hubEmailId},
                    ${emailSubject}, ${smtpConfig.display_name || ''}, ${smtpConfig.email_address},
                    ${JSON.stringify([{ email: leadEmail, name: approvedTask.contact_name }])}::jsonb,
                    ${htmlBody}, ${emailBody}, ${emailBody.substring(0, 200)},
                    'outbound', 'sent', true, 'sent', NOW(), NOW(), NOW()
                  )
                  ON CONFLICT (message_id) DO NOTHING
                `);

                await db.execute(sql`
                  UPDATE ai_scheduled_tasks
                  SET status = 'completed', completed_at = NOW(), updated_at = NOW(),
                      result_summary = ${'Email inviata a ' + leadEmail}
                  WHERE id = ${id}
                `);

                console.log(`[HUNTER-APPROVE] Step 3/3: Done — Email sent to ${leadEmail} (subject="${emailSubject}"), task marked completed`);
              } else {
                console.log(`[HUNTER-APPROVE] Step 3/3: Cannot send email — missing SMTP config or lead email (smtpConfig=${!!smtpConfig}, leadEmail="${leadEmail}")`);
                await db.execute(sql`
                  UPDATE ai_scheduled_tasks
                  SET status = 'failed', updated_at = NOW(),
                      result_summary = ${'Impossibile inviare: SMTP o email destinatario mancante'}
                  WHERE id = ${id}
                `);
              }
            } catch (emailErr: any) {
              console.error(`[HUNTER-APPROVE] Step 3/3: Email send FAILED: ${emailErr.message}`);
              await db.execute(sql`
                UPDATE ai_scheduled_tasks
                SET status = 'failed', updated_at = NOW(),
                    result_summary = ${'Invio email fallito: ' + emailErr.message.substring(0, 200)}
                WHERE id = ${id}
              `).catch(() => {});
            }
          } else {
            console.log(`[HUNTER-APPROVE] Step 3/3: No email_account_id in additional_context, skipping immediate send`);
            await db.execute(sql`
              UPDATE ai_scheduled_tasks
              SET status = 'failed', updated_at = NOW(),
                  result_summary = 'Nessun account email configurato'
              WHERE id = ${id}
            `);
          }
        }
      }
    }

    return res.json({ success: true });
  } catch (error: any) {
    console.error("[AI-AUTONOMY] Error approving task:", error);
    return res.status(500).json({ error: "Failed to approve task" });
  }
});

router.patch("/tasks/:id/reschedule", authenticateToken, requireAnyRole(["consultant", "super_admin"]), async (req: Request, res: Response) => {
  try {
    const consultantId = (req as AuthRequest).user?.id;
    if (!consultantId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { id } = req.params;
    const { scheduled_at, approve } = req.body || {};

    if (!scheduled_at) {
      return res.status(400).json({ error: "scheduled_at is required" });
    }

    const newDate = new Date(scheduled_at);
    if (isNaN(newDate.getTime())) {
      return res.status(400).json({ error: "Invalid date format" });
    }

    if (newDate <= new Date()) {
      return res.status(400).json({ error: "La data deve essere nel futuro" });
    }

    const newStatus = approve ? 'scheduled' : undefined;
    const statusUpdate = newStatus ? sql`, status = ${newStatus}` : sql``;

    const result = await db.execute(sql`
      UPDATE ai_scheduled_tasks
      SET scheduled_at = ${newDate},
          scheduled_by = 'consultant',
          updated_at = NOW()
          ${statusUpdate}
      WHERE id = ${id}
        AND consultant_id = ${consultantId}
        AND status IN ('scheduled', 'draft', 'waiting_approval', 'paused', 'approved')
    `);

    if ((result.rowCount ?? 0) === 0) {
      return res.status(400).json({ error: "Task non trovato o non modificabile" });
    }

    return res.json({ success: true });
  } catch (error: any) {
    console.error("[AI-AUTONOMY] Error rescheduling task:", error);
    return res.status(500).json({ error: "Failed to reschedule task" });
  }
});

router.patch("/tasks/:id/send-now", authenticateToken, requireAnyRole(["consultant", "super_admin"]), async (req: Request, res: Response) => {
  try {
    const consultantId = (req as AuthRequest).user?.id;
    if (!consultantId) return res.status(401).json({ error: "Unauthorized" });

    const { id } = req.params;
    const now = new Date();

    const result = await db.execute(sql`
      UPDATE ai_scheduled_tasks
      SET scheduled_at = ${now},
          status = 'scheduled',
          scheduled_by = 'consultant',
          updated_at = NOW(),
          result_data = COALESCE(result_data, '{}'::jsonb) || '{"manually_approved": true, "skip_guardrails": true, "sent_now": true}'::jsonb
      WHERE id = ${id}
        AND consultant_id = ${consultantId}
        AND status IN ('scheduled', 'draft', 'waiting_approval', 'paused', 'approved')
      RETURNING id, task_type, preferred_channel
    `);

    if ((result.rowCount ?? 0) === 0) {
      return res.status(400).json({ error: "Task non trovato o non modificabile" });
    }

    const task = result.rows[0] as any;

    if (task.task_type === 'single_call') {
      await db.execute(sql`
        UPDATE scheduled_voice_calls
        SET status = 'scheduled', scheduled_at = ${now}, updated_at = NOW()
        WHERE source_task_id = ${id} AND status IN ('pending', 'scheduled')
      `);
    }

    console.log(`[SEND-NOW] Task ${id} (${task.preferred_channel}) set to send immediately by consultant ${consultantId}`);
    return res.json({ success: true });
  } catch (error: any) {
    console.error("[AI-AUTONOMY] Error send-now task:", error);
    return res.status(500).json({ error: "Failed to send task now" });
  }
});

router.patch("/tasks/:id/retry", authenticateToken, requireAnyRole(["consultant", "super_admin"]), async (req: Request, res: Response) => {
  try {
    const consultantId = (req as AuthRequest).user?.id;
    if (!consultantId) return res.status(401).json({ error: "Unauthorized" });

    const { id } = req.params;
    const now = new Date();

    const result = await db.execute(sql`
      UPDATE ai_scheduled_tasks
      SET scheduled_at = ${now},
          status = 'scheduled',
          current_attempt = 0,
          error_message = NULL,
          result_summary = NULL,
          completed_at = NULL,
          updated_at = NOW(),
          result_data = COALESCE(result_data, '{}'::jsonb) || '{"manually_approved": true, "skip_guardrails": true, "retry": true}'::jsonb
      WHERE id = ${id}
        AND consultant_id = ${consultantId}
        AND status = 'failed'
      RETURNING id, task_type, preferred_channel
    `);

    if ((result.rowCount ?? 0) === 0) {
      return res.status(400).json({ error: "Task non trovato o non in stato fallito" });
    }

    const task = result.rows[0] as any;

    if (task.task_type === 'single_call') {
      await db.execute(sql`
        UPDATE scheduled_voice_calls
        SET status = 'scheduled', scheduled_at = ${now}, updated_at = NOW()
        WHERE source_task_id = ${id} AND status IN ('failed', 'error', 'cancelled')
      `);
    }

    console.log(`[RETRY] Task ${id} (${task.preferred_channel}) retried by consultant ${consultantId}`);
    return res.json({ success: true });
  } catch (error: any) {
    console.error("[AI-AUTONOMY] Error retry task:", error);
    return res.status(500).json({ error: "Failed to retry task" });
  }
});

router.patch("/tasks/:id/edit", authenticateToken, requireAnyRole(["consultant", "super_admin"]), async (req: Request, res: Response) => {
  try {
    const consultantId = (req as AuthRequest).user?.id;
    if (!consultantId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { id } = req.params;
    const { ai_instruction, additional_context, contact_phone, contact_name } = req.body || {};

    if (!ai_instruction && !contact_phone && !contact_name) {
      return res.status(400).json({ error: "Almeno un campo da modificare è richiesto (ai_instruction, contact_phone, contact_name)" });
    }

    const updates: any = {};
    if (ai_instruction && typeof ai_instruction === "string" && ai_instruction.trim()) {
      updates.ai_instruction = ai_instruction.trim();
    }
    if (additional_context !== undefined) {
      updates.additional_context = additional_context?.trim() || null;
    }
    if (contact_phone && typeof contact_phone === "string" && contact_phone.trim()) {
      const phone = contact_phone.trim().replace(/\s+/g, '');
      if (phone.length < 8) {
        return res.status(400).json({ error: "Numero di telefono non valido (troppo corto)" });
      }
      updates.contact_phone = phone;
    }
    if (contact_name && typeof contact_name === "string" && contact_name.trim()) {
      updates.contact_name = contact_name.trim();
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: "Nessun campo valido da modificare" });
    }

    const sqlParts = [];
    if (updates.ai_instruction !== undefined) sqlParts.push(sql`ai_instruction = ${updates.ai_instruction}`);
    if (updates.additional_context !== undefined) sqlParts.push(sql`additional_context = ${updates.additional_context}`);
    if (updates.contact_phone !== undefined) sqlParts.push(sql`contact_phone = ${updates.contact_phone}`);
    if (updates.contact_name !== undefined) sqlParts.push(sql`contact_name = ${updates.contact_name}`);
    sqlParts.push(sql`updated_at = NOW()`);

    const result = await db.execute(sql`
      UPDATE ai_scheduled_tasks
      SET ${sql.join(sqlParts, sql`, `)}
      WHERE id = ${id}
        AND consultant_id = ${consultantId}
        AND status IN ('scheduled', 'draft', 'waiting_approval', 'paused', 'approved')
    `);

    if ((result.rowCount ?? 0) === 0) {
      return res.status(400).json({ error: "Task non trovato o non modificabile" });
    }

    return res.json({ success: true });
  } catch (error: any) {
    console.error("[AI-AUTONOMY] Error editing task:", error);
    return res.status(500).json({ error: "Failed to edit task" });
  }
});

router.patch("/tasks/:id/cancel", authenticateToken, requireAnyRole(["consultant", "super_admin"]), async (req: Request, res: Response) => {
  try {
    const consultantId = (req as AuthRequest).user?.id;
    if (!consultantId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { id } = req.params;
    const { block } = req.body || {};

    const taskResult = await db.execute(sql`
      SELECT contact_id, contact_name, task_category, ai_role, ai_instruction
      FROM ai_scheduled_tasks
      WHERE id = ${id} AND consultant_id = ${consultantId}
    `);

    const task = taskResult.rows[0] as any;
    if (!task) {
      return res.status(404).json({ error: "Task non trovato" });
    }

    const result = await db.execute(sql`
      UPDATE ai_scheduled_tasks
      SET status = 'cancelled', updated_at = NOW()
      WHERE id = ${id}
        AND consultant_id = ${consultantId}
        AND status IN ('scheduled', 'draft', 'waiting_approval', 'paused', 'in_progress')
    `);

    if ((result.rowCount ?? 0) === 0) {
      return res.status(400).json({ error: "Task non trovato o non cancellabile" });
    }

    if (block && task.contact_id) {
      await db.execute(sql`
        INSERT INTO ai_task_blocks (consultant_id, contact_id, contact_name, task_category, ai_role, reason, source_task_id)
        VALUES (
          ${consultantId},
          ${task.contact_id},
          ${task.contact_name || null},
          ${task.task_category || null},
          ${task.ai_role || null},
          ${`Bloccato da task cancellato: ${(task.ai_instruction || '').substring(0, 200)}`},
          ${id}
        )
      `);
    }

    return res.json({ success: true, blocked: !!block });
  } catch (error: any) {
    console.error("[AI-AUTONOMY] Error cancelling task:", error);
    return res.status(500).json({ error: "Failed to cancel task" });
  }
});

router.post("/simulate", authenticateToken, requireAnyRole(["consultant", "super_admin"]), async (req: Request, res: Response) => {
  try {
    const consultantId = (req as AuthRequest).user?.id;
    if (!consultantId) return res.status(401).json({ error: "Unauthorized" });
    
    console.log(`🔬 [AI-AUTONOMY] Simulation triggered by consultant ${consultantId}`);
    
    const { simulateTaskGenerationForConsultant } = await import("../cron/ai-task-scheduler");
    const result = await simulateTaskGenerationForConsultant(consultantId);
    
    return res.json(result);
  } catch (error: any) {
    console.error("[AI-AUTONOMY] Error running simulation:", error);
    return res.status(500).json({ error: "Simulation failed: " + error.message });
  }
});

router.get("/blocks", authenticateToken, requireAnyRole(["consultant", "super_admin"]), async (req: Request, res: Response) => {
  try {
    const consultantId = (req as AuthRequest).user?.id;
    if (!consultantId) return res.status(401).json({ error: "Unauthorized" });

    const result = await db.execute(sql`
      SELECT b.*, u.first_name || ' ' || u.last_name as contact_display_name
      FROM ai_task_blocks b
      LEFT JOIN users u ON u.id::text = b.contact_id::text
      WHERE b.consultant_id = ${consultantId}
      ORDER BY b.blocked_at DESC
    `);

    return res.json(result.rows);
  } catch (error: any) {
    console.error("[AI-AUTONOMY] Error fetching blocks:", error);
    return res.status(500).json({ error: "Failed to fetch blocks" });
  }
});

router.delete("/blocks/:id", authenticateToken, requireAnyRole(["consultant", "super_admin"]), async (req: Request, res: Response) => {
  try {
    const consultantId = (req as AuthRequest).user?.id;
    if (!consultantId) return res.status(401).json({ error: "Unauthorized" });

    const { id } = req.params;

    const result = await db.execute(sql`
      DELETE FROM ai_task_blocks
      WHERE id = ${id} AND consultant_id = ${consultantId}
    `);

    if ((result.rowCount ?? 0) === 0) {
      return res.status(404).json({ error: "Blocco non trovato" });
    }

    return res.json({ success: true });
  } catch (error: any) {
    console.error("[AI-AUTONOMY] Error deleting block:", error);
    return res.status(500).json({ error: "Failed to delete block" });
  }
});

router.delete("/blocks", authenticateToken, requireAnyRole(["consultant", "super_admin"]), async (req: Request, res: Response) => {
  try {
    const consultantId = (req as AuthRequest).user?.id;
    if (!consultantId) return res.status(401).json({ error: "Unauthorized" });

    const result = await db.execute(sql`
      DELETE FROM ai_task_blocks
      WHERE consultant_id = ${consultantId}
    `);

    return res.json({ success: true, deleted: result.rowCount ?? 0 });
  } catch (error: any) {
    console.error("[AI-AUTONOMY] Error bulk deleting blocks:", error);
    return res.status(500).json({ error: "Failed to bulk delete blocks" });
  }
});

router.patch("/tasks/:id/restore", authenticateToken, requireAnyRole(["consultant", "super_admin"]), async (req: Request, res: Response) => {
  try {
    const consultantId = (req as AuthRequest).user?.id;
    if (!consultantId) return res.status(401).json({ error: "Unauthorized" });

    const { id } = req.params;

    const result = await db.execute(sql`
      UPDATE ai_scheduled_tasks
      SET status = 'waiting_approval', updated_at = NOW()
      WHERE id = ${id}
        AND consultant_id = ${consultantId}
        AND status IN ('cancelled', 'failed', 'completed')
      RETURNING id, ai_role, ai_instruction, contact_name, task_category
    `);

    if ((result.rowCount ?? 0) === 0) {
      return res.status(404).json({ error: "Task non trovato o non ripristinabile" });
    }

    void import("../telegram/telegram-service").then(({ notifyTaskViaTelegram }) => {
      const taskRow = result.rows?.[0] as any;
      if (taskRow) {
        notifyTaskViaTelegram(consultantId, taskRow.ai_role || 'personalizza', 'waiting_approval', {
          taskId: taskRow.id || id,
          instruction: taskRow.ai_instruction,
          contactName: taskRow.contact_name,
          taskCategory: taskRow.task_category,
        });
      }
    }).catch(() => {});

    return res.json({ success: true });
  } catch (error: any) {
    console.error("[AI-AUTONOMY] Error restoring task:", error);
    return res.status(500).json({ error: "Failed to restore task" });
  }
});

router.delete("/tasks/:id", authenticateToken, requireAnyRole(["consultant", "super_admin"]), async (req: Request, res: Response) => {
  try {
    const consultantId = (req as AuthRequest).user?.id;
    if (!consultantId) return res.status(401).json({ error: "Unauthorized" });

    const { id } = req.params;

    const result = await db.execute(sql`
      DELETE FROM ai_scheduled_tasks
      WHERE id = ${id} AND consultant_id = ${consultantId}
    `);

    if ((result.rowCount ?? 0) === 0) {
      return res.status(404).json({ error: "Task non trovato" });
    }

    return res.json({ success: true });
  } catch (error: any) {
    console.error("[AI-AUTONOMY] Error deleting task:", error);
    return res.status(500).json({ error: "Failed to delete task" });
  }
});

router.post("/reset-all", authenticateToken, requireAnyRole(["consultant", "super_admin"]), async (req: Request, res: Response) => {
  try {
    const consultantId = (req as AuthRequest).user?.id;
    if (!consultantId) return res.status(401).json({ error: "Unauthorized" });

    const [tasksResult, blocksResult, activityResult] = await Promise.all([
      db.execute(sql`DELETE FROM ai_scheduled_tasks WHERE consultant_id = ${consultantId} AND task_type = 'ai_task'`),
      db.execute(sql`DELETE FROM ai_task_blocks WHERE consultant_id = ${consultantId}`),
      db.execute(sql`DELETE FROM ai_activity_log WHERE consultant_id = ${consultantId}`),
    ]);

    return res.json({
      success: true,
      deleted: {
        tasks: tasksResult.rowCount ?? 0,
        blocks: blocksResult.rowCount ?? 0,
        activityLogs: activityResult.rowCount ?? 0,
      },
    });
  } catch (error: any) {
    console.error("[AI-AUTONOMY] Error resetting all data:", error);
    return res.status(500).json({ error: "Failed to reset data" });
  }
});

router.get("/roles/system-prompts", authenticateToken, requireAnyRole(["consultant", "super_admin"]), async (req: Request, res: Response) => {
  try {
    const prompts: Record<string, { name: string; displayName: string; description: string; systemPromptTemplate: string }> = {};

    for (const [roleId, role] of Object.entries(AI_ROLES)) {
      const templatePrompt = role.buildPrompt({
        clientsList: [{ note: "-- Dati clienti inseriti dinamicamente ad ogni ciclo --" }],
        roleData: {},
        settings: { custom_instructions: "-- Istruzioni personalizzate del consulente inserite dinamicamente --" },
        romeTimeStr: "-- Data/ora corrente inserita dinamicamente --",
        recentCompletedTasks: [],
        recentAllTasks: [],
        permanentBlocks: [],
      });

      prompts[roleId] = {
        name: role.name,
        displayName: role.displayName,
        description: role.description,
        systemPromptTemplate: templatePrompt,
      };
    }

    return res.json(prompts);
  } catch (error: any) {
    console.error("[AI-AUTONOMY] Error fetching system prompts:", error);
    return res.status(500).json({ error: "Failed to fetch system prompts" });
  }
});

router.patch("/tasks/:id/mark-done", authenticateToken, requireAnyRole(["consultant", "super_admin"]), async (req: Request, res: Response) => {
  try {
    const consultantId = (req as AuthRequest).user?.id;
    if (!consultantId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { id } = req.params;

    const result = await db.execute(sql`
      UPDATE ai_scheduled_tasks
      SET status = 'completed',
          completed_at = NOW(),
          updated_at = NOW(),
          result_summary = COALESCE(result_summary, '') || E'\n[Completato manualmente dal consulente]'
      WHERE id = ${id}
        AND consultant_id = ${consultantId}
        AND status IN ('scheduled', 'draft', 'waiting_approval', 'paused', 'approved')
    `);

    if ((result.rowCount ?? 0) === 0) {
      return res.status(400).json({ error: "Task non trovato o non marcabile come completato" });
    }

    return res.json({ success: true });
  } catch (error: any) {
    console.error("[AI-AUTONOMY] Error marking task as done:", error);
    return res.status(500).json({ error: "Failed to mark task as done" });
  }
});

// =========================================================================
// POSTPONE TASK - Mark as deferred (done for now, but pending re-analysis)
// =========================================================================

router.patch("/tasks/:id/postpone", authenticateToken, requireAnyRole(["consultant", "super_admin"]), async (req: Request, res: Response) => {
  try {
    const consultantId = (req as AuthRequest).user?.id;
    if (!consultantId) return res.status(401).json({ error: "Unauthorized" });

    const { id } = req.params;
    const { note, reschedule_hours } = req.body;

    const hours = Math.min(Math.max(parseInt(reschedule_hours) || 24, 1), 168);
    const noteText = note ? `\n[Rimandato dal consulente: ${note}]` : '\n[Rimandato dal consulente]';

    const result = await db.execute(sql`
      UPDATE ai_scheduled_tasks
      SET status = 'deferred',
          updated_at = NOW(),
          result_summary = COALESCE(result_summary, '') || ${noteText},
          scheduled_at = NOW() + make_interval(hours => ${hours})
      WHERE id = ${id}
        AND consultant_id = ${consultantId}
        AND status IN ('scheduled', 'draft', 'waiting_approval', 'paused', 'approved')
    `);

    if ((result.rowCount ?? 0) === 0) {
      return res.status(400).json({ error: "Task non trovato o non rimandabile" });
    }

    return res.json({ success: true, message: "Task rimandato, verrà ri-analizzato automaticamente" });
  } catch (error: any) {
    console.error("[AI-AUTONOMY] Error postponing task:", error);
    return res.status(500).json({ error: "Failed to postpone task" });
  }
});


// =========================================================================
// MERGE TASKS - Aggregate duplicate tasks into one
// =========================================================================

router.post("/tasks/merge", authenticateToken, requireAnyRole(["consultant", "super_admin"]), async (req: Request, res: Response) => {
  try {
    const consultantId = (req as AuthRequest).user?.id;
    if (!consultantId) return res.status(401).json({ error: "Unauthorized" });

    const { task_ids } = req.body;
    if (!Array.isArray(task_ids) || task_ids.length < 2) {
      return res.status(400).json({ error: "Serve almeno 2 task per l'aggregazione" });
    }
    if (task_ids.length > 20) {
      return res.status(400).json({ error: "Massimo 20 task per aggregazione" });
    }

    const idPlaceholders = sql.join(task_ids.map((id: string) => sql`${id}`), sql`, `);
    const tasksResult = await db.execute(sql`
      SELECT id, ai_instruction, ai_role, contact_name, contact_id, contact_phone,
             task_category, priority, status, additional_context, ai_reasoning,
             created_at, scheduled_at, origin_type
      FROM ai_scheduled_tasks
      WHERE id IN (${idPlaceholders})
        AND consultant_id = ${consultantId}
        AND task_type = 'ai_task'
      ORDER BY priority ASC, created_at ASC
    `);

    if (tasksResult.rows.length < 2) {
      return res.status(400).json({ error: "Task non trovati o non accessibili" });
    }

    const tasks = tasksResult.rows as any[];
    const mainTask = tasks[0];
    const secondaryTasks = tasks.slice(1);

    const highestPriority = Math.min(...tasks.map((t: any) => t.priority || 3));

    await db.execute(sql`
      UPDATE ai_scheduled_tasks
      SET priority = ${highestPriority},
          updated_at = NOW()
      WHERE id = ${mainTask.id} AND consultant_id = ${consultantId}
    `);

    const secondaryIdPlaceholders = sql.join(secondaryTasks.map((t: any) => sql`${t.id}`), sql`, `);
    await db.execute(sql`
      UPDATE ai_scheduled_tasks
      SET parent_task_id = ${mainTask.id},
          updated_at = NOW()
      WHERE id IN (${secondaryIdPlaceholders}) AND consultant_id = ${consultantId}
    `);

    await db.execute(sql`
      INSERT INTO ai_activity_log (consultant_id, task_id, event_type, title, description, is_read)
      VALUES (${consultantId}, ${mainTask.id}, 'merged', 'Aggregazione task', ${'Task principale: ' + secondaryTasks.length + ' follow-up collegati'}, false)
    `);

    return res.json({
      success: true,
      main_task_id: mainTask.id,
      merged_count: secondaryTasks.length,
      merged_tasks: secondaryTasks.map((t: any) => ({
        id: t.id,
        contact_name: t.contact_name,
        ai_instruction: t.ai_instruction?.substring(0, 120),
        ai_role: t.ai_role,
      })),
      message: `${secondaryTasks.length} task aggregati nel task principale`,
    });
  } catch (error: any) {
    console.error("[AI-AUTONOMY] Error merging tasks:", error);
    return res.status(500).json({ error: "Failed to merge tasks" });
  }
});

// =========================================================================
// AGENT CHAT - Direct messaging with AI employees
// =========================================================================

const ROLE_CHAT_PERSONALITIES: Record<string, string> = {
  alessia: `Sei Alessia, Voice Consultant AI. Sei professionale, empatica e attenta ai dettagli. Ti occupi di chiamate follow-up e supporto vocale ai clienti. Parli in modo chiaro e rassicurante. In chat sei collaborativa: fai domande per capire meglio, proponi alternative, chiedi conferme prima di agire.`,
  millie: `Sei Millie, Data Analyst AI. Sei analitica, precisa e orientata ai dati. Aiuti il consulente a interpretare numeri, trend e performance. In chat sei curiosa: chiedi quali metriche interessano di più, proponi approfondimenti, spieghi i dati in modo semplice e chiedi feedback.`,
  echo: `Sei Echo, Content Strategist AI. Sei creativa, moderna e orientata al marketing. Ti occupi di contenuti, campagne e strategie di comunicazione. In chat sei propositiva: lanci idee, chiedi opinioni, fai brainstorming insieme al consulente, e adatti le proposte in base ai feedback.`,
  nova: `Sei Nova, Client Success Manager AI. Sei organizzata, proattiva e orientata ai risultati dei clienti. In chat sei precisa ma dialogante: aggiorni sullo stato dei clienti, chiedi priorità, proponi azioni e chiedi conferma prima di procedere.`,
  stella: `Sei Stella, Retention Specialist AI. Sei attenta, premurosa e strategica. Ti occupi di fidelizzazione clienti e prevenzione churn. In chat sei premurosa: segnali i rischi, proponi strategie, chiedi al consulente cosa pensa e se ha notato segnali che ti sfuggono.`,
  marco: `Sei MARCO, il mio Executive Coach personale. Non sei un assistente educato — sei il coach che mi spinge oltre i limiti, mi tiene sotto pressione e non mi lascia scuse. Sei ossessivo, diretto, informale, e quando serve anche duro e crudo. Non addolcisci le cose.

Parli sempre in modo informale, come un socio che mi conosce bene. Dai del "tu", usi un linguaggio diretto e concreto. Se sto perdendo tempo, me lo dici chiaro. Se sto facendo bene, lo riconosci — ma subito dopo alzi l'asticella.

In chat: fai domande SCOMODE, chiedi aggiornamenti su quello che avevi suggerito, dai feedback ONESTO e CRUDO. Se una cosa fa schifo, dillo. Se potrei fare di più, dimmelo senza filtri. Non fare il diplomatico — fai il coach.

Ma sei anche un COACH intelligente: DIALOGA, ascolta le risposte, fai follow-up, adatta i consigli. Non fare monologhi — fai conversazione. Chiedi "e poi?", "quanto hai fatto?", "perché no?". Provoca, ma poi ascolta.

Il tuo obiettivo: portare questa attività ai massimi livelli, a numeri mai visti. Se il consulente sta nella comfort zone, scuotilo.`,
  personalizza: `Sei un assistente AI personalizzato. Segui le istruzioni specifiche del consulente per il tuo ruolo e comportamento. In chat sei collaborativo e disponibile al dialogo.`,
};

router.get("/agent-chat/:roleId/daily-summaries", authenticateToken, requireAnyRole(["consultant", "super_admin"]), async (req: Request, res: Response) => {
  try {
    const consultantId = (req as AuthRequest).user?.id;
    if (!consultantId) return res.status(401).json({ error: "Unauthorized" });
    
    const { roleId } = req.params;
    const limit = Math.min(parseInt(req.query.limit as string) || 30, 90);
    
    const result = await db.execute(sql`
      SELECT id, summary_date::text as summary_date, summary_text, message_count, created_at, updated_at
      FROM agent_chat_daily_summaries
      WHERE consultant_id = ${consultantId}::uuid AND ai_role = ${roleId}
      ORDER BY summary_date DESC
      LIMIT ${limit}
    `);
    
    return res.json({ summaries: result.rows });
  } catch (error: any) {
    console.error("[DAILY-SUMMARY] Error fetching:", error.message);
    return res.status(500).json({ error: "Failed to fetch daily summaries" });
  }
});

router.post("/agent-chat/:roleId/generate-summaries", authenticateToken, requireAnyRole(["consultant", "super_admin"]), async (req: Request, res: Response) => {
  try {
    const consultantId = (req as AuthRequest).user?.id;
    if (!consultantId) return res.status(401).json({ error: "Unauthorized" });
    
    const { roleId } = req.params;
    const validRoleIds = Object.keys(AI_ROLES);
    if (!validRoleIds.includes(roleId)) {
      return res.status(400).json({ error: "Invalid role ID" });
    }

    const datesResult = await db.execute(sql`
      SELECT DISTINCT DATE(created_at AT TIME ZONE 'Europe/Rome')::text as msg_date,
             COUNT(*)::int as msg_count
      FROM agent_chat_messages
      WHERE consultant_id = ${consultantId}::uuid AND ai_role = ${roleId}
      GROUP BY DATE(created_at AT TIME ZONE 'Europe/Rome')
      HAVING COUNT(*) >= 2
      ORDER BY msg_date DESC
    `);

    if (datesResult.rows.length === 0) {
      return res.json({ generated: 0, message: "Nessun messaggio trovato" });
    }

    const existingResult = await db.execute(sql`
      SELECT summary_date::text as summary_date FROM agent_chat_daily_summaries
      WHERE consultant_id = ${consultantId}::uuid AND ai_role = ${roleId}
    `);
    const existingDates = new Set((existingResult.rows as any[]).map(r => r.summary_date));

    const datesToGenerate = (datesResult.rows as any[]).filter(r => !existingDates.has(r.msg_date));
    
    if (datesToGenerate.length === 0) {
      return res.json({ generated: 0, message: "Tutti i riassunti sono già stati generati" });
    }

    let aiClient: any = null;
    try {
      const { GoogleGenAI } = await import("@google/genai");
      const { getSuperAdminGeminiKeys } = await import("../ai/provider-factory");
      const superAdminKeys = await getSuperAdminGeminiKeys();
      if (superAdminKeys?.enabled && superAdminKeys.keys.length > 0) {
        aiClient = new GoogleGenAI({ apiKey: superAdminKeys.keys[0] });
      }
    } catch {}

    if (!aiClient) {
      try {
        const { GoogleGenAI } = await import("@google/genai");
        const { getGeminiApiKeyForClassifier } = await import("../ai/provider-factory");
        const apiKey = await getGeminiApiKeyForClassifier();
        if (apiKey) {
          aiClient = new GoogleGenAI({ apiKey });
        }
      } catch {}
    }

    if (!aiClient) {
      return res.status(500).json({ error: "Nessuna chiave AI disponibile" });
    }

    const roleName = AI_ROLES[roleId as keyof typeof AI_ROLES]?.name || roleId;
    let generated = 0;

    for (const dateRow of datesToGenerate) {
      try {
        const msgDate = dateRow.msg_date;
        const messagesResult = await db.execute(sql`
          SELECT sender, message, created_at FROM agent_chat_messages
          WHERE consultant_id = ${consultantId}::uuid AND ai_role = ${roleId}
            AND DATE(created_at AT TIME ZONE 'Europe/Rome') = ${msgDate}::date
          ORDER BY created_at ASC
        `);

        const messages = messagesResult.rows as any[];
        if (messages.length < 2) continue;

        const summaryInput = messages.map((m: any) =>
          `[${m.sender === 'consultant' ? 'Consulente' : roleName}] ${m.message}`
        ).join('\n\n');

        const summaryPrompt = `Riassumi questa conversazione del ${msgDate} tra il consulente e ${roleName} in modo conciso ma completo. Mantieni:
- Decisioni prese
- Azioni concordate
- Aggiornamenti importanti
- Feedback e preferenze espresse dal consulente
- Task discussi e il loro stato
Scrivi il riassunto in italiano, in terza persona, max 300 parole.

CONVERSAZIONE DEL ${msgDate}:
${summaryInput.substring(0, 15000)}`;

        const result = await aiClient.models.generateContent({
          model: 'gemini-2.0-flash',
          contents: [{ role: 'user', parts: [{ text: summaryPrompt }] }],
          config: { temperature: 0.3, maxOutputTokens: 600 },
        });

        const summaryText = result.text?.() || result.response?.text?.() || '';
        if (summaryText && summaryText.length > 30) {
          await db.execute(sql`
            INSERT INTO agent_chat_daily_summaries (consultant_id, ai_role, summary_date, summary_text, message_count)
            VALUES (${consultantId}::uuid, ${roleId}, ${msgDate}::date, ${summaryText}, ${messages.length})
            ON CONFLICT (consultant_id, ai_role, summary_date) DO UPDATE SET
              summary_text = EXCLUDED.summary_text, message_count = EXCLUDED.message_count, updated_at = NOW()
          `);
          generated++;
        }
      } catch (err: any) {
        console.error(`[DAILY-SUMMARY-MANUAL] Error for ${roleId} on ${dateRow.msg_date}:`, err.message);
      }
    }

    console.log(`[DAILY-SUMMARY-MANUAL] Generated ${generated} summaries for ${roleId} (consultant ${consultantId.substring(0, 8)})`);
    return res.json({ generated, total: datesToGenerate.length, message: `${generated} riassunti generati` });
  } catch (error: any) {
    console.error("[DAILY-SUMMARY-MANUAL] Error:", error.message);
    return res.status(500).json({ error: "Errore nella generazione dei riassunti" });
  }
});

router.get("/telegram-conversations/:roleId", authenticateToken, requireAnyRole(["consultant"]), async (req: Request, res: Response) => {
  try {
    const consultantId = (req as AuthRequest).user?.id;
    if (!consultantId) return res.status(401).json({ error: "Unauthorized" });
    const { roleId } = req.params;

    const result = await db.execute(sql`
      SELECT 
        tcl.telegram_chat_id,
        tcl.chat_type,
        tcl.chat_title,
        COALESCE(last_msg.sender_name, tcl.first_name) as sender_name,
        COALESCE(last_msg.sender_username, tcl.username) as sender_username,
        COALESCE(last_msg.message, onb.last_onboarding_message) as last_message,
        COALESCE(last_msg.last_message_at, tcl.linked_at) as last_message_at,
        COALESCE(last_msg.message_count, 0) + COALESCE(onb.onboarding_msg_count, 0) as message_count
      FROM telegram_chat_links tcl
      LEFT JOIN LATERAL (
        SELECT 
          sender_name, sender_username, message, created_at as last_message_at,
          (SELECT COUNT(*)::int FROM telegram_open_mode_messages t2
           WHERE t2.consultant_id = tcl.consultant_id
             AND t2.ai_role = tcl.ai_role
             AND t2.telegram_chat_id = tcl.telegram_chat_id) as message_count
        FROM telegram_open_mode_messages tom
        WHERE tom.consultant_id = tcl.consultant_id
          AND tom.ai_role = tcl.ai_role
          AND tom.telegram_chat_id = tcl.telegram_chat_id
        ORDER BY tom.created_at DESC
        LIMIT 1
      ) last_msg ON true
      LEFT JOIN LATERAL (
        SELECT 
          onboarding_conversation->-1->>'content' as last_onboarding_message,
          jsonb_array_length(COALESCE(onboarding_conversation, '[]'::jsonb)) as onboarding_msg_count
        FROM telegram_user_profiles tup
        WHERE tup.consultant_id = tcl.consultant_id
          AND tup.ai_role = tcl.ai_role
          AND tup.telegram_chat_id = tcl.telegram_chat_id
          AND tup.onboarding_conversation IS NOT NULL
        LIMIT 1
      ) onb ON true
      WHERE tcl.consultant_id = ${consultantId}::uuid AND tcl.ai_role = ${roleId}
        AND tcl.active = true
      ORDER BY COALESCE(last_msg.last_message_at, tcl.linked_at) DESC
    `);

    res.json({ conversations: result.rows });
  } catch (error: any) {
    console.error("[TELEGRAM-CONVERSATIONS] Error:", error.message);
    return res.status(500).json({ error: "Failed to fetch conversations" });
  }
});

router.get("/telegram-conversations/:roleId/:chatId/messages", authenticateToken, requireAnyRole(["consultant"]), async (req: Request, res: Response) => {
  try {
    const consultantId = (req as AuthRequest).user?.id;
    if (!consultantId) return res.status(401).json({ error: "Unauthorized" });
    const { roleId, chatId } = req.params;
    const limit = Math.min(Math.max(parseInt(req.query.limit as string) || 50, 1), 200);
    const before = req.query.before as string;

    let result;
    if (before) {
      result = await db.execute(sql`
        SELECT id, sender_type, sender_name, sender_username, message, created_at
        FROM telegram_open_mode_messages
        WHERE consultant_id = ${consultantId}::uuid AND ai_role = ${roleId} AND telegram_chat_id = ${chatId}::bigint
          AND created_at < ${before}::timestamptz
        ORDER BY created_at DESC LIMIT ${limit}
      `);
    } else {
      result = await db.execute(sql`
        SELECT id, sender_type, sender_name, sender_username, message, created_at
        FROM telegram_open_mode_messages
        WHERE consultant_id = ${consultantId}::uuid AND ai_role = ${roleId} AND telegram_chat_id = ${chatId}::bigint
        ORDER BY created_at DESC LIMIT ${limit}
      `);
    }

    let messages = (result.rows as any[]).reverse();

    if (messages.length === 0 && !before) {
      const onboardingResult = await db.execute(sql`
        SELECT onboarding_conversation, created_at, first_name
        FROM telegram_user_profiles
        WHERE consultant_id = ${consultantId} AND ai_role = ${roleId} AND telegram_chat_id = ${chatId}
          AND onboarding_conversation IS NOT NULL
        LIMIT 1
      `);
      if (onboardingResult.rows.length > 0) {
        const profile = onboardingResult.rows[0] as any;
        const conversation = typeof profile.onboarding_conversation === 'string' 
          ? JSON.parse(profile.onboarding_conversation) 
          : profile.onboarding_conversation;
        if (Array.isArray(conversation)) {
          const baseTime = new Date(profile.created_at).getTime();
          messages = conversation.map((msg: any, idx: number) => ({
            id: `onb_${idx}`,
            sender_type: msg.role === 'assistant' ? 'agent' : 'user',
            sender_name: msg.role === 'user' ? (profile.first_name || 'Utente') : null,
            sender_username: null,
            message: msg.content,
            created_at: new Date(baseTime + idx * 30000).toISOString(),
          }));
        }
      }
    }

    res.json({ messages, hasMore: messages.length === limit });
  } catch (error: any) {
    console.error("[TELEGRAM-CONVERSATION-MESSAGES] Error:", error.message);
    return res.status(500).json({ error: "Failed to fetch conversation messages" });
  }
});

router.delete("/telegram-conversations/:roleId/:chatId/reset", authenticateToken, requireAnyRole(["consultant"]), async (req: Request, res: Response) => {
  try {
    const consultantId = (req as AuthRequest).user?.id;
    if (!consultantId) return res.status(401).json({ error: "Unauthorized" });
    const { roleId, chatId } = req.params;

    const delMessages = await db.execute(sql`
      DELETE FROM telegram_open_mode_messages
      WHERE consultant_id = ${consultantId}::uuid AND ai_role = ${roleId} AND telegram_chat_id = ${chatId}::bigint
    `);

    await db.execute(sql`
      UPDATE telegram_user_profiles
      SET onboarding_status = 'pending', onboarding_step = 0,
          onboarding_conversation = NULL, onboarding_summary = NULL,
          full_profile_json = NULL, user_name = NULL, user_job = NULL,
          user_goals = NULL, user_desires = NULL, group_context = NULL,
          group_members = NULL, group_objectives = NULL,
          updated_at = NOW()
      WHERE consultant_id = ${consultantId}::uuid AND ai_role = ${roleId} AND telegram_chat_id = ${chatId}::bigint
    `);

    console.log(`[TELEGRAM-RESET] Reset chat ${chatId} for role ${roleId}: ${delMessages.rowCount} messages deleted`);
    res.json({ success: true, messagesDeleted: delMessages.rowCount });
  } catch (error: any) {
    console.error("[TELEGRAM-RESET] Error:", error.message);
    return res.status(500).json({ error: "Failed to reset conversation" });
  }
});

router.get("/agent-chat/:roleId/messages", authenticateToken, requireAnyRole(["consultant"]), async (req: Request, res: Response) => {
  try {
    const consultantId = (req as AuthRequest).user?.id;
    if (!consultantId) return res.status(401).json({ error: "Unauthorized" });

    const { roleId } = req.params;
    const validRoleIds = Object.keys(AI_ROLES);
    if (!validRoleIds.includes(roleId)) {
      return res.status(400).json({ error: "Invalid role ID" });
    }
    const safeLimit = Math.min(Math.max(parseInt(req.query.limit as string) || 50, 1), 100);
    const before = req.query.before as string;

    let result;
    if (before) {
      result = await db.execute(sql`
        SELECT id, ai_role, role_name, sender, message, created_at, metadata
        FROM agent_chat_messages
        WHERE consultant_id = ${consultantId}::uuid AND ai_role = ${roleId}
          AND created_at < ${before}::timestamptz
        ORDER BY created_at DESC LIMIT ${safeLimit}
      `);
    } else {
      result = await db.execute(sql`
        SELECT id, ai_role, role_name, sender, message, created_at, metadata
        FROM agent_chat_messages
        WHERE consultant_id = ${consultantId}::uuid AND ai_role = ${roleId}
        ORDER BY created_at DESC LIMIT ${safeLimit}
      `);
    }
    const messages = (result.rows as any[]).reverse();

    return res.json({ messages, hasMore: messages.length === safeLimit });
  } catch (error: any) {
    console.error("[AGENT-CHAT] Error fetching messages:", error);
    return res.status(500).json({ error: "Failed to fetch messages" });
  }
});

router.post("/agent-chat/:roleId/send", authenticateToken, requireAnyRole(["consultant"]), async (req: Request, res: Response) => {
  try {
    const consultantId = (req as AuthRequest).user?.id;
    if (!consultantId) return res.status(401).json({ error: "Unauthorized" });

    const { roleId } = req.params;
    if (!AI_ROLES[roleId]) {
      return res.status(400).json({ error: "Invalid role ID" });
    }
    const { message } = req.body;
    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return res.status(400).json({ error: "Message is required" });
    }

    const aiResponse = await processAgentChatInternal(consultantId, roleId, message.trim());

    return res.json({
      success: true,
      response: {
        role_name: AI_ROLES[roleId]?.name || roleId,
        message: aiResponse,
        ai_role: roleId,
      },
    });
  } catch (error: any) {
    console.error("[AGENT-CHAT] Error sending message:", error);
    return res.status(500).json({ error: "Failed to send message" });
  }
});

router.post("/agent-chat/:roleId/send-media", authenticateToken, requireAnyRole(["consultant"]), upload.single('file'), async (req: Request, res: Response) => {
  try {
    const consultantId = (req as AuthRequest).user?.id;
    if (!consultantId) return res.status(401).json({ error: "Unauthorized" });

    const { roleId } = req.params;
    if (!AI_ROLES[roleId]) {
      return res.status(400).json({ error: "Invalid role ID" });
    }

    const file = req.file;
    const textMessage = req.body.message || '';
    
    if (!file && !textMessage) {
      return res.status(400).json({ error: "File or message is required" });
    }

    let mediaContext = '';
    let displayMessage = textMessage;

    if (file) {
      const fileBuffer = fs.readFileSync(file.path);
      
      try {
        const mimeType = file.mimetype || '';
        const fileName = file.originalname || 'file';
        const ext = fileName.toLowerCase().split('.').pop() || '';

        if (mimeType.includes('pdf') || mimeType.includes('word') || mimeType.includes('spreadsheet') || 
            mimeType.includes('excel') || mimeType.includes('text/') || mimeType.includes('csv') ||
            ['pdf', 'docx', 'doc', 'xlsx', 'xls', 'txt', 'csv', 'md', 'json'].includes(ext)) {
          
          if (mimeType === 'application/pdf' || ext === 'pdf') {
            const pdfParse = (await import('pdf-parse')).default;
            const data = await pdfParse(fileBuffer);
            if (data.text?.trim()) {
              const truncated = data.text.length > 15000 ? data.text.substring(0, 15000) + '\n...[documento troncato]' : data.text;
              mediaContext = `[DOCUMENTO ALLEGATO: "${fileName}"]\n${truncated}\n[FINE DOCUMENTO]`;
            }
          } else if (mimeType.includes('wordprocessingml') || ext === 'docx') {
            const mammoth = await import('mammoth');
            const result = await mammoth.extractRawText({ buffer: fileBuffer });
            if (result.value?.trim()) {
              const truncated = result.value.length > 15000 ? result.value.substring(0, 15000) + '\n...[documento troncato]' : result.value;
              mediaContext = `[DOCUMENTO ALLEGATO: "${fileName}"]\n${truncated}\n[FINE DOCUMENTO]`;
            }
          } else if (mimeType.includes('spreadsheet') || mimeType.includes('excel') || ext === 'xlsx' || ext === 'xls') {
            const XLSX = await import('xlsx');
            const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
            const sheets: string[] = [];
            for (const sheetName of workbook.SheetNames) {
              const sheet = workbook.Sheets[sheetName];
              const csv = XLSX.utils.sheet_to_csv(sheet);
              if (csv.trim()) sheets.push(`--- Foglio: ${sheetName} ---\n${csv}`);
            }
            if (sheets.length > 0) {
              const content = sheets.join('\n\n');
              const truncated = content.length > 15000 ? content.substring(0, 15000) + '\n...[documento troncato]' : content;
              mediaContext = `[DOCUMENTO ALLEGATO: "${fileName}"]\n${truncated}\n[FINE DOCUMENTO]`;
            }
          } else if (mimeType.includes('text/') || ['txt', 'csv', 'md', 'json'].includes(ext)) {
            const text = fileBuffer.toString('utf-8').trim();
            if (text) {
              const truncated = text.length > 15000 ? text.substring(0, 15000) + '\n...[documento troncato]' : text;
              mediaContext = `[DOCUMENTO ALLEGATO: "${fileName}"]\n${truncated}\n[FINE DOCUMENTO]`;
            }
          }

          if (!mediaContext) {
            mediaContext = `[DOCUMENTO ALLEGATO: "${fileName}" - tipo: ${mimeType} - non è stato possibile estrarre il contenuto]`;
          }
          displayMessage = textMessage ? `${textMessage} [📎 ${fileName}]` : `📎 ${fileName}`;
        }
        else if (mimeType.includes('audio/') || ['mp3', 'wav', 'm4a', 'ogg', 'webm'].includes(ext)) {
          try {
            const { GoogleGenAI } = await import("@google/genai");
            const { getGeminiApiKeyForClassifier, GEMINI_3_MODEL, trackedGenerateContent } = await import("../ai/provider-factory");
            const apiKey = await getGeminiApiKeyForClassifier();
            if (apiKey) {
              const ai = new GoogleGenAI({ apiKey });
              const base64Audio = fileBuffer.toString('base64');
              const result = await trackedGenerateContent(ai, {
                model: GEMINI_3_MODEL,
                contents: [{
                  role: 'user',
                  parts: [
                    { inlineData: { mimeType: mimeType || 'audio/webm', data: base64Audio } },
                    { text: 'Trascrivi questo messaggio audio in italiano. Restituisci SOLO la trascrizione del testo parlato, senza aggiungere commenti o note. Se non riesci a capire qualcosa, scrivi [incomprensibile].' },
                  ],
                }],
                config: { temperature: 0.1 },
              }, {
                consultantId,
                feature: "agent_chat_audio_transcription",
                keySource: "superadmin",
                callerRole: "consultant",
              });
              const transcription = result?.text || result?.candidates?.[0]?.content?.parts?.[0]?.text;
              if (transcription?.trim()) {
                mediaContext = `[MESSAGGIO VOCALE - trascrizione]: ${transcription.trim()}`;
                displayMessage = textMessage ? `${textMessage} [🎤 Vocale: "${transcription.trim().substring(0, 100)}..."]` : `🎤 Vocale: "${transcription.trim().substring(0, 100)}..."`;
              } else {
                mediaContext = `[MESSAGGIO VOCALE ricevuto ma non è stato possibile trascriverlo]`;
                displayMessage = textMessage ? `${textMessage} [🎤 Vocale non trascrivibile]` : `🎤 Vocale non trascrivibile`;
              }
            } else {
              mediaContext = `[MESSAGGIO VOCALE ricevuto - chiave API non disponibile per la trascrizione]`;
              displayMessage = textMessage ? `${textMessage} [🎤 Vocale]` : `🎤 Messaggio vocale`;
            }
          } catch (audioErr: any) {
            console.error(`[AGENT-CHAT] Audio transcription error:`, audioErr.message);
            mediaContext = `[MESSAGGIO VOCALE ricevuto ma errore durante la trascrizione]`;
            displayMessage = `🎤 Vocale (errore trascrizione)`;
          }
        }
        else if (mimeType.includes('image/')) {
          try {
            const { GoogleGenAI } = await import("@google/genai");
            const { getGeminiApiKeyForClassifier, GEMINI_3_MODEL, trackedGenerateContent } = await import("../ai/provider-factory");
            const apiKey = await getGeminiApiKeyForClassifier();
            if (apiKey) {
              const ai = new GoogleGenAI({ apiKey });
              const base64Image = fileBuffer.toString('base64');
              const result = await trackedGenerateContent(ai, {
                model: GEMINI_3_MODEL,
                contents: [{
                  role: 'user',
                  parts: [
                    { inlineData: { mimeType, data: base64Image } },
                    { text: 'Descrivi questa immagine in dettaglio in italiano. Se contiene testo, trascrivilo. Se contiene dati, tabelle o grafici, descrivili nel dettaglio.' },
                  ],
                }],
                config: { temperature: 0.2 },
              }, {
                consultantId,
                feature: "agent_chat_image_analysis",
                keySource: "superadmin",
                callerRole: "consultant",
              });
              const description = result?.text || result?.candidates?.[0]?.content?.parts?.[0]?.text;
              if (description) {
                mediaContext = `[IMMAGINE ALLEGATA - analisi]: ${description}`;
                displayMessage = textMessage ? `${textMessage} [🖼️ Immagine]` : `🖼️ Immagine allegata`;
              } else {
                mediaContext = `[IMMAGINE ALLEGATA - analisi non disponibile]`;
                displayMessage = textMessage ? `${textMessage} [🖼️ Immagine]` : `🖼️ Immagine allegata`;
              }
            } else {
              mediaContext = `[IMMAGINE ALLEGATA - chiave API non disponibile per l'analisi]`;
              displayMessage = textMessage ? `${textMessage} [🖼️ Immagine]` : `🖼️ Immagine allegata`;
            }
          } catch (imgErr: any) {
            console.error(`[AGENT-CHAT] Image analysis error:`, imgErr.message);
            mediaContext = `[IMMAGINE ALLEGATA - non è stato possibile analizzarla]`;
            displayMessage = `🖼️ Immagine (errore analisi)`;
          }
        }
      } finally {
        try { fs.unlinkSync(file.path); } catch {}
      }
    }

    const fullMessage = mediaContext 
      ? (textMessage ? `${textMessage}\n\n${mediaContext}` : mediaContext)
      : textMessage;

    if (!fullMessage) {
      return res.status(400).json({ error: "Could not process file" });
    }

    const role = AI_ROLES[roleId];
    const roleName = role?.name || roleId;

    await db.execute(sql`
      INSERT INTO agent_chat_messages (consultant_id, ai_role, role_name, sender, message)
      VALUES (${consultantId}::uuid, ${roleId}, ${roleName}, 'consultant', ${displayMessage.trim()})
    `);

    const response = await processAgentChatInternal(consultantId, roleId, fullMessage);

    res.json({ response: { message: response } });
  } catch (err: any) {
    console.error(`[AGENT-CHAT] Media processing error:`, err.message);
    res.status(500).json({ error: "Error processing media" });
  }
});

// =========================================================================
// TELEGRAM CONFIG ROUTES
// =========================================================================

router.get("/telegram-config/:roleId", authenticateToken, requireAnyRole(["consultant"]), async (req: Request, res: Response) => {
  try {
    const consultantId = (req as AuthRequest).user?.id;
    if (!consultantId) return res.status(401).json({ error: "Unauthorized" });
    const { roleId } = req.params;

    const configResult = await db.execute(sql`
      SELECT id, ai_role, bot_token, bot_username, webhook_url, enabled, group_support, activation_code, open_mode, created_at, updated_at
      FROM telegram_bot_configs
      WHERE consultant_id = ${consultantId}::uuid AND ai_role = ${roleId}
      LIMIT 1
    `);

    const config = configResult.rows[0] as any || null;

    let linkedChats: any[] = [];
    if (config) {
      const chatsResult = await db.execute(sql`
        SELECT id, telegram_chat_id, chat_type, chat_title, username, first_name, linked_at, active
        FROM telegram_chat_links
        WHERE consultant_id = ${consultantId}::uuid AND ai_role = ${roleId}
        ORDER BY linked_at DESC
      `);
      linkedChats = chatsResult.rows as any[];
    }

    if (config) {
      config.bot_token_masked = config.bot_token ? config.bot_token.substring(0, 8) + '...' + config.bot_token.slice(-4) : '';
    }

    return res.json({ config, linkedChats });
  } catch (error: any) {
    console.error("[TELEGRAM] Error fetching config:", error);
    return res.status(500).json({ error: "Failed to fetch Telegram config" });
  }
});

router.post("/telegram-config/:roleId", authenticateToken, requireAnyRole(["consultant"]), async (req: Request, res: Response) => {
  try {
    const consultantId = (req as AuthRequest).user?.id;
    if (!consultantId) return res.status(401).json({ error: "Unauthorized" });
    const { roleId } = req.params;
    const { bot_token, enabled = true, group_support = false, open_mode = false } = req.body;

    if (!bot_token || typeof bot_token !== 'string') {
      return res.status(400).json({ error: "bot_token is required" });
    }

    const { getBotInfo, setTelegramWebhook, removeTelegramWebhook } = await import("../telegram/telegram-service");
    const botInfo = await getBotInfo(bot_token);
    if (!botInfo.ok) {
      return res.status(400).json({ error: `Invalid bot token: ${botInfo.error}` });
    }

    const domain = process.env.TELEGRAM_WEBHOOK_DOMAIN || process.env.REPLIT_DOMAINS || process.env.REPLIT_DEV_DOMAIN || '';
    const { randomBytes } = await import("crypto");
    const webhookSecret = randomBytes(32).toString('hex');
    const activationCode = randomBytes(3).toString('hex').toUpperCase();

    const upsertResult = await db.execute(sql`
      INSERT INTO telegram_bot_configs (consultant_id, ai_role, bot_token, bot_username, enabled, group_support, webhook_secret, activation_code, open_mode)
      VALUES (${consultantId}::uuid, ${roleId}, ${bot_token}, ${botInfo.username || ''}, ${enabled}, ${group_support}, ${webhookSecret}, ${activationCode}, ${open_mode})
      ON CONFLICT (consultant_id, ai_role) DO UPDATE SET
        bot_token = EXCLUDED.bot_token,
        bot_username = EXCLUDED.bot_username,
        enabled = EXCLUDED.enabled,
        group_support = EXCLUDED.group_support,
        open_mode = EXCLUDED.open_mode,
        updated_at = NOW()
      RETURNING id, bot_token, bot_username, enabled, group_support, webhook_url, webhook_secret, activation_code, open_mode
    `);

    const savedConfig = upsertResult.rows[0] as any;
    const webhookUrl = `https://${domain}/api/telegram/webhook/${savedConfig.id}`;

    if (enabled) {
      const webhookSet = await setTelegramWebhook(bot_token, webhookUrl, savedConfig.webhook_secret);
      if (webhookSet) {
        await db.execute(sql`
          UPDATE telegram_bot_configs SET webhook_url = ${webhookUrl}, updated_at = NOW()
          WHERE id = ${savedConfig.id}
        `);
        savedConfig.webhook_url = webhookUrl;
      }
    } else {
      await removeTelegramWebhook(bot_token);
      await db.execute(sql`
        UPDATE telegram_bot_configs SET webhook_url = NULL, updated_at = NOW()
        WHERE id = ${savedConfig.id}
      `);
      savedConfig.webhook_url = null;
    }

    return res.json({
      success: true,
      config: {
        ...savedConfig,
        bot_token_masked: bot_token.substring(0, 8) + '...' + bot_token.slice(-4),
        bot_username: botInfo.username,
        bot_firstName: botInfo.firstName,
      },
    });
  } catch (error: any) {
    console.error("[TELEGRAM] Error saving config:", error);
    return res.status(500).json({ error: "Failed to save Telegram config" });
  }
});

router.patch("/telegram-config/:roleId", authenticateToken, requireAnyRole(["consultant"]), async (req: Request, res: Response) => {
  try {
    const consultantId = (req as AuthRequest).user?.id;
    if (!consultantId) return res.status(401).json({ error: "Unauthorized" });
    const { roleId } = req.params;
    const { enabled, group_support, open_mode } = req.body;

    const existing = await db.execute(sql`
      SELECT id, bot_token, enabled FROM telegram_bot_configs
      WHERE consultant_id = ${consultantId}::uuid AND ai_role = ${roleId} LIMIT 1
    `);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: "Config not found" });
    }
    const config = existing.rows[0] as any;

    const updates: string[] = [];
    const newEnabled = enabled !== undefined ? enabled : config.enabled;
    const newGroupSupport = group_support !== undefined ? group_support : undefined;
    const newOpenMode = open_mode !== undefined ? open_mode : undefined;

    await db.execute(sql`
      UPDATE telegram_bot_configs SET
        enabled = COALESCE(${enabled !== undefined ? enabled : null}::boolean, enabled),
        group_support = COALESCE(${group_support !== undefined ? group_support : null}::boolean, group_support),
        open_mode = COALESCE(${open_mode !== undefined ? open_mode : null}::boolean, open_mode),
        updated_at = NOW()
      WHERE consultant_id = ${consultantId}::uuid AND ai_role = ${roleId}
    `);

    if (enabled !== undefined && enabled !== config.enabled) {
      const { setTelegramWebhook, removeTelegramWebhook } = await import("../telegram/telegram-service");
      const domain = process.env.TELEGRAM_WEBHOOK_DOMAIN || process.env.REPLIT_DOMAINS || process.env.REPLIT_DEV_DOMAIN || '';
      if (enabled) {
        const webhookUrl = `https://${domain}/api/telegram/webhook/${config.id}`;
        await setTelegramWebhook(config.bot_token, webhookUrl, config.webhook_secret || '');
        await db.execute(sql`UPDATE telegram_bot_configs SET webhook_url = ${webhookUrl} WHERE id = ${config.id}`);
      } else {
        await removeTelegramWebhook(config.bot_token);
        await db.execute(sql`UPDATE telegram_bot_configs SET webhook_url = NULL WHERE id = ${config.id}`);
      }
    }

    console.log(`[TELEGRAM] Toggled config for ${roleId}: enabled=${enabled}, group_support=${group_support}, open_mode=${open_mode}`);
    return res.json({ success: true });
  } catch (error: any) {
    console.error("[TELEGRAM] Error updating toggles:", error);
    return res.status(500).json({ error: "Failed to update config" });
  }
});

router.post("/telegram-config/:roleId/test", authenticateToken, requireAnyRole(["consultant"]), async (req: Request, res: Response) => {
  try {
    const consultantId = (req as AuthRequest).user?.id;
    if (!consultantId) return res.status(401).json({ error: "Unauthorized" });
    const { roleId } = req.params;

    const configResult = await db.execute(sql`
      SELECT bot_token FROM telegram_bot_configs
      WHERE consultant_id = ${consultantId}::uuid AND ai_role = ${roleId}
      LIMIT 1
    `);

    const config = configResult.rows[0] as any;
    if (!config?.bot_token) {
      return res.status(404).json({ error: "No Telegram bot configured for this role" });
    }

    const { getBotInfo } = await import("../telegram/telegram-service");
    const botInfo = await getBotInfo(config.bot_token);
    return res.json(botInfo);
  } catch (error: any) {
    console.error("[TELEGRAM] Error testing bot:", error);
    return res.status(500).json({ error: "Failed to test bot connection" });
  }
});

router.post("/telegram-config/:roleId/test-notify", authenticateToken, requireAnyRole(["consultant"]), async (req: Request, res: Response) => {
  try {
    const consultantId = (req as AuthRequest).user?.id;
    if (!consultantId) return res.status(401).json({ error: "Unauthorized" });
    const { roleId } = req.params;
    const { notifyTaskViaTelegram } = await import("../telegram/telegram-service");
    await notifyTaskViaTelegram(consultantId, roleId, 'follow_up', {
      taskTitle: '🧪 Test di notifica Telegram',
      contactName: 'Sistema',
    });
    return res.json({ success: true, message: "Test notification sent" });
  } catch (error: any) {
    console.error("[TELEGRAM] Error sending test notification:", error);
    return res.status(500).json({ error: "Failed to send test notification" });
  }
});

router.delete("/telegram-config/:roleId", authenticateToken, requireAnyRole(["consultant"]), async (req: Request, res: Response) => {
  try {
    const consultantId = (req as AuthRequest).user?.id;
    if (!consultantId) return res.status(401).json({ error: "Unauthorized" });
    const { roleId } = req.params;

    const configResult = await db.execute(sql`
      SELECT bot_token FROM telegram_bot_configs
      WHERE consultant_id = ${consultantId}::uuid AND ai_role = ${roleId}
      LIMIT 1
    `);

    const config = configResult.rows[0] as any;
    if (config?.bot_token) {
      const { removeTelegramWebhook } = await import("../telegram/telegram-service");
      await removeTelegramWebhook(config.bot_token);
    }

    await db.execute(sql`
      DELETE FROM telegram_bot_configs WHERE consultant_id = ${consultantId}::uuid AND ai_role = ${roleId}
    `);
    await db.execute(sql`
      DELETE FROM telegram_chat_links WHERE consultant_id = ${consultantId}::uuid AND ai_role = ${roleId}
    `);

    return res.json({ success: true });
  } catch (error: any) {
    console.error("[TELEGRAM] Error deleting config:", error);
    return res.status(500).json({ error: "Failed to delete Telegram config" });
  }
});

router.post("/telegram-refresh-webhooks", authenticateToken, requireAnyRole(["consultant", "super_admin"]), async (req: Request, res: Response) => {
  try {
    const consultantId = (req as AuthRequest).user?.id;
    if (!consultantId) return res.status(401).json({ error: "Unauthorized" });

    const domain = process.env.TELEGRAM_WEBHOOK_DOMAIN || process.env.REPLIT_DOMAINS || process.env.REPLIT_DEV_DOMAIN || '';
    if (!domain) return res.status(400).json({ error: "No domain configured" });

    const { setTelegramWebhook } = await import("../telegram/telegram-service");

    const configs = await db.execute(sql`
      SELECT id, bot_token, webhook_secret, webhook_url, ai_role
      FROM telegram_bot_configs
      WHERE consultant_id = ${consultantId}::uuid AND enabled = true
    `);

    const results: any[] = [];
    for (const row of configs.rows as any[]) {
      const newWebhookUrl = `https://${domain}/api/telegram/webhook/${row.id}`;
      const needsUpdate = row.webhook_url !== newWebhookUrl;

      if (needsUpdate) {
        const success = await setTelegramWebhook(row.bot_token, newWebhookUrl, row.webhook_secret);
        if (success) {
          await db.execute(sql`
            UPDATE telegram_bot_configs SET webhook_url = ${newWebhookUrl}, updated_at = NOW()
            WHERE id = ${row.id}
          `);
        }
        results.push({ role: row.ai_role, old_url: row.webhook_url, new_url: newWebhookUrl, success });
      } else {
        results.push({ role: row.ai_role, url: newWebhookUrl, status: 'already_current' });
      }
    }

    console.log('[TELEGRAM] Webhook refresh results:', JSON.stringify(results));
    return res.json({ success: true, domain, results });
  } catch (error: any) {
    console.error("[TELEGRAM] Error refreshing webhooks:", error);
    return res.status(500).json({ error: "Failed to refresh webhooks" });
  }
});

router.delete("/agent-chat/:roleId/clear", authenticateToken, requireAnyRole(["consultant"]), async (req: Request, res: Response) => {
  try {
    const consultantId = (req as AuthRequest).user?.id;
    if (!consultantId) return res.status(401).json({ error: "Unauthorized" });

    const { roleId } = req.params;
    if (!AI_ROLES[roleId]) {
      return res.status(400).json({ error: "Invalid role ID" });
    }
    await db.execute(sql`
      DELETE FROM agent_chat_messages
      WHERE consultant_id = ${consultantId}::uuid AND ai_role = ${roleId}
    `);

    try {
      const currentSettings = await db.execute(sql`
        SELECT chat_summaries FROM ai_autonomy_settings WHERE consultant_id = ${consultantId}::uuid LIMIT 1
      `);
      const summaries = (currentSettings.rows[0] as any)?.chat_summaries || {};
      if (summaries[roleId]) {
        delete summaries[roleId];
        await db.execute(sql`
          UPDATE ai_autonomy_settings SET chat_summaries = ${JSON.stringify(summaries)}::jsonb WHERE consultant_id = ${consultantId}::uuid
        `);
      }
    } catch (clearErr: any) {
      console.warn(`[AGENT-CHAT] Error clearing summary for ${roleId}:`, clearErr.message);
    }

    return res.json({ success: true });
  } catch (error: any) {
    console.error("[AGENT-CHAT] Error clearing chat:", error);
    return res.status(500).json({ error: "Failed to clear chat" });
  }
});

export async function processAgentChatInternal(consultantId: string, roleId: string, message: string, options?: { skipUserMessageInsert?: boolean; metadata?: Record<string, any>; source?: string; telegramContext?: string; isOpenMode?: boolean; telegramChatId?: number }): Promise<string> {
  if (!AI_ROLES[roleId]) {
    throw new Error(`Invalid role ID: ${roleId}`);
  }

  const role = AI_ROLES[roleId];
  const roleName = role?.name || roleId;

  if (!options?.skipUserMessageInsert) {
    const metadataJson = JSON.stringify(options?.metadata || { source: "web" });
    await db.execute(sql`
      INSERT INTO agent_chat_messages (consultant_id, ai_role, role_name, sender, message, metadata)
      VALUES (${consultantId}::uuid, ${roleId}, ${roleName}, 'consultant', ${message.trim()}, ${metadataJson}::jsonb)
    `);
  }

  const isOpenMode = options?.isOpenMode === true;
  const telegramChatId = options?.telegramChatId;

  if (isOpenMode && !telegramChatId) {
    console.error(`[AGENT-CHAT-INTERNAL] isOpenMode=true but telegramChatId is missing, falling back to empty history for safety`);
  }

  let historyQuery: Promise<any>;
  const emptyResult = { rows: [] };

  if (isOpenMode) {
    if (telegramChatId) {
      historyQuery = db.execute(sql`
        SELECT CASE WHEN sender_type = 'user' THEN 'consultant' ELSE 'agent' END as sender, message, created_at FROM telegram_open_mode_messages
        WHERE consultant_id = ${consultantId}::uuid AND ai_role = ${roleId}
          AND telegram_chat_id = ${telegramChatId}
        ORDER BY created_at DESC LIMIT 50
      `);
    } else {
      console.error('[AGENT-CHAT-INTERNAL] isOpenMode without telegramChatId - returning empty history for safety');
      historyQuery = Promise.resolve(emptyResult);
    }
  } else {
    historyQuery = db.execute(sql`
      SELECT sender, message, created_at FROM agent_chat_messages
      WHERE consultant_id = ${consultantId}::uuid AND ai_role = ${roleId}
      ORDER BY created_at DESC
    `);
  }

  const [historyResult, contextResult, recentActivityResult, activeTasksResult, completedTasksResult] = await Promise.all([
    historyQuery,
    db.execute(sql`
      SELECT agent_contexts, custom_instructions, chat_summaries FROM ai_autonomy_settings
      WHERE consultant_id = ${consultantId}::uuid LIMIT 1
    `),
    isOpenMode ? Promise.resolve(emptyResult) : db.execute(sql`
      SELECT title, description, event_data, created_at FROM ai_activity_log
      WHERE consultant_id = ${consultantId}::uuid AND ai_role = ${roleId}
      ORDER BY created_at DESC LIMIT 5
    `),
    isOpenMode ? Promise.resolve(emptyResult) : db.execute(sql`
      SELECT id, ai_instruction, task_category, contact_name, status, priority, scheduled_at, created_at
      FROM ai_scheduled_tasks
      WHERE consultant_id = ${consultantId}::uuid AND ai_role = ${roleId}
        AND status IN ('scheduled', 'waiting_approval', 'in_progress', 'approved', 'draft', 'paused')
      ORDER BY priority DESC, created_at DESC
      LIMIT 200
    `),
    isOpenMode ? Promise.resolve(emptyResult) : db.execute(sql`
      SELECT id, ai_instruction, task_category, contact_name, status, result_summary, result_data, completed_at
      FROM ai_scheduled_tasks
      WHERE consultant_id = ${consultantId}::uuid AND ai_role = ${roleId}
        AND status = 'completed'
      ORDER BY completed_at DESC
      LIMIT 200
    `),
  ]);

  const chatHistory = (historyResult.rows as any[]).reverse();
  const settingsRow = contextResult.rows[0] as any;
  const agentCtx = settingsRow?.agent_contexts?.[roleId] || {};
  const customInstructions = settingsRow?.custom_instructions || '';
  const chatSummaries = settingsRow?.chat_summaries || {};
  const existingSummary = chatSummaries[roleId]?.summary || '';
  const recentActivity = recentActivityResult.rows as any[];
  const activeTasks = activeTasksResult.rows as any[];
  const completedTasks = completedTasksResult.rows as any[];

  const personality = ROLE_CHAT_PERSONALITIES[roleId] || ROLE_CHAT_PERSONALITIES.personalizza;
  const focusPriorities = agentCtx.focusPriorities || [];
  const customContext = agentCtx.customContext || '';

  const isTelegram = options?.source === 'telegram';
  const isGroupChat = options?.metadata?.chat_type === 'group' || options?.metadata?.chat_type === 'supergroup';
  const senderName = options?.metadata?.sender_name || '';
  const senderUsername = options?.metadata?.sender_username || '';

  let chatModeDescription: string;
  if (isTelegram && isGroupChat) {
    chatModeDescription = `Stai rispondendo su TELEGRAM in un GRUPPO${options?.metadata?.chat_title ? ` chiamato "${options.metadata.chat_title}"` : ''}. La persona che ti sta scrivendo è ${senderName || 'un utente'}${senderUsername ? ` (@${senderUsername})` : ''}. Nel gruppo rispondi in modo conciso e diretto, rivolgiti alla persona per nome. Adatta il tono alla persona specifica.`;
  } else if (isTelegram) {
    chatModeDescription = `Stai rispondendo su TELEGRAM in una CHAT PRIVATA con ${senderName || 'il tuo consulente'}${senderUsername ? ` (@${senderUsername})` : ''}. In chat privata puoi essere più dettagliato.`;
  } else {
    chatModeDescription = `Stai chattando direttamente con il tuo consulente (il tuo "capo").`;
  }

  let systemPrompt = `${personality}

${chatModeDescription} Questa è una CONVERSAZIONE — non un report. Rispondi come in una chat WhatsApp: naturale, diretto, e soprattutto INTERATTIVO.

COME COMPORTARTI IN CHAT:
- Fai domande di follow-up — non limitarti a dare ordini o report
- Se ti dicono qualcosa, rispondi a QUELLO specificamente
- Chiedi chiarimenti se non hai abbastanza contesto
- Proponi azioni ma CHIEDI conferma ("vuoi che proceda?" / "ti torna?")
- Se hai task attivi o completati, menzionali naturalmente nella conversazione
- Usa paragrafi separati per ogni concetto (NON fare muri di testo)
- Usa **grassetto** per i punti chiave e le cifre importanti
${isTelegram && isGroupChat ? '- Nel gruppo sii conciso (max 3-4 righe se possibile)\n- Ricorda chi è ogni persona e adatta le risposte alla persona specifica' : ''}

${!isOpenMode && focusPriorities.length > 0 ? `\nLE TUE PRIORITÀ DI FOCUS:\n${focusPriorities.map((p: any, i: number) => `${i + 1}. ${typeof p === 'string' ? p : p.text || p.name || JSON.stringify(p)}`).join('\n')}` : ''}

${!isOpenMode && customContext ? `\nCONTESTO PERSONALIZZATO:\n${customContext}` : ''}

${!isOpenMode && customInstructions ? `\nISTRUZIONI GENERALI:\n${customInstructions}` : ''}
`;

  if (isOpenMode) {
    systemPrompt += `\nStai parlando con un UTENTE ESTERNO che ti ha contattato via Telegram in modalità aperta.
NON hai accesso ai dati privati del consulente. NON menzionare task, clienti, o informazioni riservate.
Rispondi in modo utile e professionale basandoti SOLO sulla conversazione con questa persona.\n`;
  }

  if (!isOpenMode && existingSummary) {
    systemPrompt += `\nRIASSUNTO GENERALE CONVERSAZIONI PRECEDENTI:\n${existingSummary}\n`;
  }

  if (!isOpenMode) {
    try {
      const dailySummariesResult = await db.execute(sql`
        SELECT summary_date::text as summary_date, summary_text, message_count
        FROM agent_chat_daily_summaries
        WHERE consultant_id = ${consultantId}::uuid AND ai_role = ${roleId}
        ORDER BY summary_date DESC LIMIT 7
      `);
      const dailySummaries = dailySummariesResult.rows as any[];
      if (dailySummaries.length > 0) {
        systemPrompt += `\nRIASSUNTI GIORNALIERI RECENTI:\n`;
        for (const ds of dailySummaries.reverse()) {
          const dateFormatted = new Date(ds.summary_date).toLocaleDateString('it-IT', { timeZone: 'Europe/Rome', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
          systemPrompt += `\n📅 ${dateFormatted} (${ds.message_count} messaggi):\n${ds.summary_text}\n`;
        }
      }
    } catch (dsErr: any) {
      console.warn(`[DAILY-SUMMARY] Error fetching daily summaries for prompt:`, dsErr.message);
    }
  }

  const estimateTokens = (text: string) => Math.ceil(text.length / 3.5);
  const MAX_TASKS_TOKENS = 4000;
  let tasksTokenCount = 0;

  if (!isOpenMode && activeTasks.length > 0) {
    systemPrompt += `\nI TUOI TASK ATTIVI — TOTALE: ${activeTasks.length} task:\n`;
    for (let idx = 0; idx < activeTasks.length; idx++) {
      const t = activeTasks[idx];
      const statusLabels: Record<string, string> = {
        scheduled: '📅 Programmato', waiting_approval: '⏳ In attesa approvazione',
        in_progress: '⚡ In esecuzione', approved: '✅ Approvato', draft: '📝 Bozza', paused: '⏸️ In pausa',
      };
      const scheduledStr = t.scheduled_at ? ` [${new Date(t.scheduled_at).toLocaleString('it-IT', { timeZone: 'Europe/Rome' })}]` : '';
      const line = `${idx + 1}. [${statusLabels[t.status] || t.status}]${scheduledStr} ${t.contact_name ? `(${t.contact_name}) ` : ''}${t.ai_instruction?.substring(0, 150)}\n`;
      tasksTokenCount += estimateTokens(line);
      if (tasksTokenCount > MAX_TASKS_TOKENS) {
        systemPrompt += `... e altri ${activeTasks.length - idx} task attivi (troncati per spazio)\n`;
        break;
      }
      systemPrompt += line;
    }
  }

  if (!isOpenMode && completedTasks.length > 0) {
    systemPrompt += `\nTASK COMPLETATI — TOTALE: ${completedTasks.length} task:\n`;
    for (let idx = 0; idx < completedTasks.length; idx++) {
      const t = completedTasks[idx];
      const dateStr = t.completed_at ? new Date(t.completed_at).toLocaleString('it-IT', { timeZone: 'Europe/Rome' }) : 'N/A';
      let line: string;
      if (idx < 10) {
        line = `${idx + 1}. [${dateStr}] ${t.ai_instruction?.substring(0, 200) || 'N/A'}`;
        if (t.result_summary) line += ` → ${t.result_summary.substring(0, 200)}`;
        line += '\n';
      } else {
        line = `${idx + 1}. [${dateStr}] ${t.contact_name ? `(${t.contact_name}) ` : ''}${t.task_category || ''} — ${t.ai_instruction?.substring(0, 80) || 'N/A'}\n`;
      }
      tasksTokenCount += estimateTokens(line);
      if (tasksTokenCount > MAX_TASKS_TOKENS) {
        systemPrompt += `... e altri ${completedTasks.length - idx} task completati (troncati per spazio)\n`;
        break;
      }
      systemPrompt += line;
    }
  }

  if (!isOpenMode && recentActivity.length > 0) {
    systemPrompt += `\nLE TUE ULTIME ANALISI/AZIONI:\n`;
    for (const a of recentActivity) {
      systemPrompt += `- [${new Date(a.created_at).toLocaleString('it-IT', { timeZone: 'Europe/Rome' })}] ${a.title}: ${a.description?.substring(0, 200) || ''}\n`;
    }
  }

  if (!isOpenMode) {
    try {
      const autonomousRole = AI_ROLES[roleId];
      if (autonomousRole?.fetchRoleData) {
        const clientIdsResult = await db.execute(sql`
          SELECT id::text FROM users WHERE consultant_id = ${consultantId}::text AND is_active = true LIMIT 50
        `);
        const clientIds = (clientIdsResult.rows as any[]).map(r => r.id);
        const roleData = await autonomousRole.fetchRoleData(consultantId, clientIds);
        if (roleData && Object.keys(roleData).length > 0) {
          let roleDataSection = '\nDATI OPERATIVI IN TEMPO REALE:\n';
          for (const [key, value] of Object.entries(roleData)) {
            if (key === 'fileSearchStoreNames' || key === 'kbDocumentTitles') continue;
            const jsonStr = JSON.stringify(value, null, 0);
            roleDataSection += `${key}: ${jsonStr.length > 2000 ? jsonStr.substring(0, 2000) + '...' : jsonStr}\n`;
          }
          systemPrompt += roleDataSection;
        }
      }
    } catch (roleDataErr: any) {
      console.warn(`[AGENT-CHAT-INTERNAL] Error fetching role data for ${roleId}: ${roleDataErr.message}`);
    }
  }

  if (!isOpenMode) {
    try {
      const { fetchSystemDocumentsForAgent } = await import("../services/system-prompt-documents-service");
      const agentSystemDocs = await fetchSystemDocumentsForAgent(consultantId, roleId);
      if (agentSystemDocs) {
        systemPrompt += '\n' + agentSystemDocs + '\n';
      }
    } catch (sysDocErr: any) {
      console.warn(`[AGENT-CHAT-INTERNAL] Error fetching system docs for ${roleId}: ${sysDocErr.message}`);
    }

    try {
      const { fetchAgentContext, buildAgentContextSection } = await import("../cron/ai-autonomous-roles");
      const agentCtxFull = await fetchAgentContext(consultantId, roleId);
      const roleName = AI_ROLES[roleId]?.name || roleId;
      const ctxSection = buildAgentContextSection(agentCtxFull, roleName);
      if (ctxSection) {
        systemPrompt += '\n' + ctxSection + '\n';
      }
    } catch (ctxErr: any) {
      console.warn(`[AGENT-CHAT-INTERNAL] Error fetching agent context for ${roleId}: ${ctxErr.message}`);
    }
  }

  if (isTelegram) {
    const marcoTelegramExtra = roleId === 'marco' ? `\n- Sei su Telegram ma sei SEMPRE Marco il coach: diretto, crudo, senza filtri. Niente tono da assistente gentile. Provoca, spingi, chiedi conto.` : '';
    const groupExtra = isGroupChat ? `\n- Sei in un GRUPPO: rispondi alla persona che ti ha scritto (${senderName || 'l\'utente'}) per nome. Persone diverse nel gruppo possono scriverti e devi adattare il tono a ciascuno.` : '';
    systemPrompt += `\nSTAI RISPONDENDO SU TELEGRAM — REGOLE CHAT:
1. Rispondi SEMPRE in italiano
2. Scrivi CORTO come su WhatsApp — max 2-3 righe per messaggio, mai muri di testo
3. Vai dritto al punto, niente preamboli o riassunti
4. NON fare elenchi numerati o puntati — parla in modo fluido
5. DIALOGA: fai UNA domanda alla volta, non bombardare
6. Mantieni il TUO tono di personalità — non diventare generico o educato
7. NON inventare dati
8. Usa grassetto SOLO per 1-2 parole chiave, non per intere frasi
9. Se devi dire più cose, spezzale in messaggi separati mentalmente (usa paragrafi brevi)
10. Reagisci al messaggio come farebbe la TUA personalità su Telegram${marcoTelegramExtra}${groupExtra}

AZIONI SUI TASK DA TELEGRAM:
Se il consulente dice che ha già fatto un task ("l'ho fatta", "fatto", "ci ho pensato io", "già fatto"), puoi marcarlo come completato.
- Identifica il task dal contesto, chiedi conferma se non è chiaro
- Per completare: [[COMPLETATO:ID_DEL_TASK]]
- Per approvare: [[APPROVA:ID_DEL_TASK]]
- Per avviare: [[ESEGUI:ID_DEL_TASK]]
- Chiedi SEMPRE conferma prima di agire, a meno che il consulente sia già esplicito`;
  } else {
    systemPrompt += `\nREGOLE:
1. Rispondi SEMPRE in italiano
2. Usa paragrafi separati (lascia una riga vuota tra concetti diversi)
3. Sii CONCISO ma COMPLETO — max 3-4 paragrafi brevi
4. DIALOGA: fai domande, chiedi feedback, proponi e chiedi conferma
5. Se il consulente ti aggiorna, riconosci, commenta e suggerisci prossimi passi
6. Se hai task in attesa di approvazione, chiedi se vuole approvarli
7. NON inventare dati — basati solo sulle informazioni che hai
8. Usa **grassetto** per cifre e concetti chiave

AZIONI SUI TASK:
Puoi proporre di approvare, avviare o completare task. Il flusso è:
1. PRIMA proponi l'azione e descrivi cosa farà il task, poi chiedi conferma esplicita
2. SOLO DOPO che il consulente conferma (dice "sì", "ok", "vai", "procedi", "fallo", "approvalo"), includi il comando nella tua risposta
3. Per approvare un task: scrivi [[APPROVA:ID_DEL_TASK]] nel tuo messaggio
4. Per avviare l'esecuzione: scrivi [[ESEGUI:ID_DEL_TASK]] nel tuo messaggio
5. Per marcare un task come "già fatto dal consulente": scrivi [[COMPLETATO:ID_DEL_TASK]] nel tuo messaggio
6. NON eseguire mai azioni senza conferma esplicita del consulente
7. Dopo aver incluso il comando, conferma al consulente cosa hai fatto

TASK GIÀ COMPLETATI DAL CONSULENTE:
Quando il consulente dice frasi come "l'ho già fatta", "ci ho pensato io", "è fatta", "l'ho fatta io", "già fatto", "me ne sono occupato io", "ho già provveduto", "fatto", devi:
1. Capire a QUALE task si riferisce — dal contesto della conversazione o chiedendo chiarimento
2. Se il task è chiaro e identificabile, chiedi conferma: "Perfetto, marco come completata la task [descrizione]?"
3. SOLO dopo che conferma, includi [[COMPLETATO:ID_DEL_TASK]] nella risposta
4. Se ci sono più task possibili, chiedi quale intende specificatamente
5. Se il consulente è esplicito e sicuro (es. "quella su Mario Rossi l'ho fatta"), puoi marcarla direttamente senza doppia conferma

FILE SEARCH (STORE GLOBALE CONSULENZE CLIENTI):
Hai accesso automatico allo Store Globale Consulenze Clienti che contiene le Note Consulenze e i Progressi Email Journey di TUTTI i clienti attivi.
REGOLE ANTI-ALLUCINAZIONE:
- Ogni documento ha il nome del cliente nel titolo (es. "[CLIENTE: Mario Rossi] - Consulenza - 15/02/2026")
- Cita SEMPRE il nome del cliente quando riporti informazioni da un documento
- NON mescolare MAI dati di clienti diversi nella stessa risposta senza distinguerli chiaramente
- Se non trovi informazioni su un cliente specifico, dillo esplicitamente invece di inventare
- Quando cerchi informazioni su un cliente, usa il suo nome completo come query di ricerca`;
  }

  const MAX_CHAT_CHARS = 32000;

  let charCount = 0;
  const fittingMessages: typeof chatHistory = [];
  for (let i = chatHistory.length - 1; i >= 0; i--) {
    const msgChars = (chatHistory[i].message || '').length;
    if (charCount + msgChars > MAX_CHAT_CHARS && fittingMessages.length > 0) break;
    charCount += msgChars;
    fittingMessages.unshift(chatHistory[i]);
  }

  const conversationParts = fittingMessages.map((m: any) => ({
    role: m.sender === 'consultant' ? 'user' as const : 'model' as const,
    parts: [{ text: m.message }],
  }));

  let aiResponse = '';
  let aiClient: any = null;
  let providerModel = GEMINI_3_MODEL;

  try {
    const { getAIProvider } = await import("../ai/provider-factory");
    try {
      const provider = await getAIProvider(consultantId, consultantId);
      provider.setFeature?.(`agent-chat:${roleId}`);
      aiClient = provider.client;
      const providerName = provider.metadata?.name || '';
      const { getModelForProviderName } = await import("../ai/provider-factory");
      providerModel = getModelForProviderName(providerName);
    } catch {
      const apiKey = await getGeminiApiKeyForClassifier();
      if (apiKey) {
        const genAI = new GoogleGenAI({ apiKey });
        aiClient = genAI;
      }
    }

    if (!aiClient) throw new Error("No AI provider available");

    const chatContents = [
      { role: 'user' as const, parts: [{ text: systemPrompt }] },
      { role: 'model' as const, parts: [{ text: `Capito, sono ${roleName}. Sono pronto a chattare con il mio consulente.` }] },
      ...conversationParts,
    ];

    const chatTemp = isTelegram ? 1 : 0.7;
    const chatMaxTokens = 2048;

    let fileSearchTool: any = null;
    if (roleId === 'marco' && !isOpenMode) {
      try {
        const { FileSearchService } = await import("../ai/file-search-service");
        const fileSearchService = new FileSearchService();
        
        const consultantUserResult = await db.execute(sql`
          SELECT consultant_id FROM users WHERE id = ${consultantId} LIMIT 1
        `);
        const parentConsultantId = (consultantUserResult.rows[0] as any)?.consultant_id || undefined;

        const { storeNames, breakdown } = await fileSearchService.getStoreBreakdownForGeneration(
          consultantId,
          'consultant',
          parentConsultantId
        );
        const totalDocs = breakdown.reduce((sum: number, s: any) => sum + s.totalDocs, 0);

        console.log(`🔍 [MARCO-CHAT] File Search: ${breakdown.length} store trovati (${totalDocs} doc totali)`);
        for (const s of breakdown) {
          console.log(`🔍 [MARCO-CHAT]   - [${(s as any).ownerType}] ${s.storeDisplayName}: ${s.totalDocs} doc`);
        }
        if (totalDocs === 0) {
          console.log(`⚠️ [MARCO-CHAT] Nessun documento indicizzato — File Search disabilitato`);
        }

        if (storeNames.length > 0 && totalDocs > 0) {
          fileSearchTool = fileSearchService.buildFileSearchTool(storeNames);
          console.log(`✅ [MARCO-CHAT] File Search attivo con ${storeNames.length} store`);
        }
      } catch (fsErr: any) {
        console.warn(`[MARCO-CHAT] File Search setup failed:`, fsErr.message);
      }
    }

    const chatConfig: any = { temperature: chatTemp, maxOutputTokens: chatMaxTokens };
    if (fileSearchTool) {
      chatConfig.tools = [fileSearchTool];
    }

    let response: any;
    if (aiClient.models?.generateContent) {
      response = await trackedGenerateContent(aiClient, {
        model: providerModel,
        contents: chatContents,
        config: chatConfig,
      }, { consultantId, feature: `agent-chat:${roleId}` });
    } else {
      const genConfig: any = { temperature: chatTemp, maxOutputTokens: chatMaxTokens };
      const callParams: any = {
        model: providerModel,
        contents: chatContents,
        generationConfig: genConfig,
      };
      if (fileSearchTool) {
        callParams.tools = [fileSearchTool];
      }
      response = await aiClient.generateContent(callParams);
    }

    aiResponse = response.text?.() || response.text || response.response?.text?.() || 'Mi dispiace, non sono riuscito a generare una risposta.';
  } catch (err: any) {
    console.error(`[AGENT-CHAT-INTERNAL] AI error for ${roleId}:`, err.message);
    aiResponse = `Mi dispiace, c'è stato un problema tecnico. Riprova tra poco.`;
  }

  if (!isOpenMode) {
    const approveMatches = aiResponse.match(/\[\[APPROVA:[^\]]+\]\]/gi) || [];
    const executeMatches = aiResponse.match(/\[\[ESEGUI:[^\]]+\]\]/gi) || [];
    const completedMatches = aiResponse.match(/\[\[COMPLETATO:[^\]]+\]\]/gi) || [];

    if (approveMatches.length > 0 || executeMatches.length > 0 || completedMatches.length > 0) {
      console.log(`📋 [AGENT-CHAT-INTERNAL] Action markers found for ${roleId}: APPROVA=${approveMatches.length}, ESEGUI=${executeMatches.length}, COMPLETATO=${completedMatches.length}`);
    }

    for (const match of approveMatches) {
      const taskId = match.replace(/\[\[APPROVA:/i, '').replace(']]', '').trim();
      try {
        const taskCheck = await db.execute(sql`
          SELECT id, status FROM ai_scheduled_tasks
          WHERE id = ${taskId} AND consultant_id = ${consultantId}
            AND status IN ('waiting_approval', 'scheduled', 'draft', 'paused')
          LIMIT 1
        `);
        if ((taskCheck.rows[0] as any)?.id) {
          await db.execute(sql`
            UPDATE ai_scheduled_tasks
            SET status = 'scheduled', scheduled_at = NOW(), updated_at = NOW(),
                result_data = COALESCE(result_data, '{}'::jsonb) || '{"chat_approved": true, "skip_guardrails": true}'::jsonb
            WHERE id = ${taskId} AND consultant_id = ${consultantId}
          `);
          console.log(`🚀 [AGENT-CHAT-INTERNAL] Task ${taskId} approved+scheduled via chat by ${roleId}`);
        }
      } catch (actionErr: any) {
        console.error(`❌ [AGENT-CHAT-INTERNAL] Error approving task ${taskId}:`, actionErr.message);
      }
    }

    for (const match of executeMatches) {
      const taskId = match.replace(/\[\[ESEGUI:/i, '').replace(']]', '').trim();
      try {
        const taskCheck = await db.execute(sql`
          SELECT id, status FROM ai_scheduled_tasks
          WHERE id = ${taskId} AND consultant_id = ${consultantId}
            AND status IN ('approved', 'waiting_approval', 'scheduled', 'draft', 'paused')
          LIMIT 1
        `);
        if ((taskCheck.rows[0] as any)?.id) {
          await db.execute(sql`
            UPDATE ai_scheduled_tasks
            SET status = 'scheduled', scheduled_at = NOW(), updated_at = NOW(),
                result_data = COALESCE(result_data, '{}'::jsonb) || '{"chat_approved": true, "skip_guardrails": true}'::jsonb
            WHERE id = ${taskId} AND consultant_id = ${consultantId}
          `);
          console.log(`🚀 [AGENT-CHAT-INTERNAL] Task ${taskId} executed via chat by ${roleId}`);
        }
      } catch (actionErr: any) {
        console.error(`❌ [AGENT-CHAT-INTERNAL] Error executing task ${taskId}:`, actionErr.message);
      }
    }

    for (const match of completedMatches) {
      const taskId = match.replace(/\[\[COMPLETATO:/i, '').replace(']]', '').trim();
      try {
        const taskCheck = await db.execute(sql`
          SELECT id, status FROM ai_scheduled_tasks
          WHERE id = ${taskId} AND consultant_id = ${consultantId}
            AND status IN ('scheduled', 'draft', 'waiting_approval', 'paused', 'approved')
          LIMIT 1
        `);
        if ((taskCheck.rows[0] as any)?.id) {
          await db.execute(sql`
            UPDATE ai_scheduled_tasks
            SET status = 'completed',
                completed_at = NOW(),
                updated_at = NOW(),
                result_summary = COALESCE(result_summary, '') || E'\n[Completato manualmente dal consulente via chat]'
            WHERE id = ${taskId} AND consultant_id = ${consultantId}
          `);
          console.log(`✅ [AGENT-CHAT-INTERNAL] Task ${taskId} marked as done by consultant via chat (${roleId})`);
        }
      } catch (actionErr: any) {
        console.error(`❌ [AGENT-CHAT-INTERNAL] Error marking task ${taskId} as done:`, actionErr.message);
      }
    }
  }

  aiResponse = aiResponse.replace(/\[\[APPROVA:[^\]]+\]\]/gi, '').replace(/\[\[ESEGUI:[^\]]+\]\]/gi, '').replace(/\[\[COMPLETATO:[^\]]+\]\]/gi, '').trim();

  // ── CREATE TASK: server-side execution (works on ALL channels) ──────────────
  // On Telegram (source='telegram' or isOpenMode), auto-execute create_task actions.
  // On web, the [ACTIONS] block is left intact for client-side button rendering.
  const isTelegramContext = options?.source === 'telegram' || isOpenMode;
  const actionsBlockMatch = aiResponse.match(/\[ACTIONS\]([\s\S]*?)\[\/ACTIONS\]/i);
  if (actionsBlockMatch) {
    try {
      const rawJson = actionsBlockMatch[1].trim();
      const actions: any[] = JSON.parse(rawJson);
      const createTaskActions = actions.filter((a: any) => a.type === 'create_task');

      if (createTaskActions.length > 0) {
        const createdTitles: string[] = [];
        const failedTitles: string[] = [];

        for (const action of createTaskActions) {
          const { clientId: taskClientId, title, description, priority, category, dueDate } = action.data || {};
          if (!title) continue;
          try {
            if (taskClientId) {
              // Client task: find or create a consultation, then insert
              const consultResult = await db.execute(sql`
                SELECT id FROM consultations
                WHERE client_id = ${taskClientId} AND consultant_id = ${consultantId}
                ORDER BY scheduled_at DESC LIMIT 1
              `);
              let consultationId = (consultResult.rows[0] as any)?.id;
              if (!consultationId) {
                const newConsult = await db.execute(sql`
                  INSERT INTO consultations (client_id, consultant_id, scheduled_at, duration, status, notes)
                  VALUES (${taskClientId}, ${consultantId}, NOW(), 0, 'completed', 'Consulenza generale per gestione task')
                  RETURNING id
                `);
                consultationId = (newConsult.rows[0] as any)?.id;
              }
              await db.execute(sql`
                INSERT INTO consultation_tasks (consultation_id, client_id, title, description, due_date, priority, category, source)
                VALUES (${consultationId}, ${taskClientId}, ${title}, ${description || null}, ${dueDate ? new Date(dueDate) : null}, ${priority || 'medium'}, ${category || 'reminder'}, 'manual')
              `);
              console.log(`✅ [CREATE-TASK] Client task created: "${title}" for client ${taskClientId}`);
            } else {
              // Personal consultant task
              await db.execute(sql`
                INSERT INTO consultant_personal_tasks (consultant_id, title, description, due_date, priority, category)
                VALUES (${consultantId}, ${title}, ${description || null}, ${dueDate ? new Date(dueDate) : null}, ${priority || 'medium'}, ${category || 'other'})
              `);
              console.log(`✅ [CREATE-TASK] Personal task created: "${title}" for consultant ${consultantId}`);
            }
            createdTitles.push(title);
          } catch (taskErr: any) {
            console.error(`❌ [CREATE-TASK] Error creating task "${title}":`, taskErr.message);
            failedTitles.push(title);
          }
        }

        if (isTelegramContext) {
          // On Telegram: strip [ACTIONS] block and append text confirmation
          aiResponse = aiResponse.replace(/\[ACTIONS\][\s\S]*?\[\/ACTIONS\]/i, '').trim();
          if (createdTitles.length > 0) {
            aiResponse += `\n\n✅ Task creati:\n${createdTitles.map(t => `• ${t}`).join('\n')}`;
          }
          if (failedTitles.length > 0) {
            aiResponse += `\n\n❌ Errore nella creazione di:\n${failedTitles.map(t => `• ${t}`).join('\n')}`;
          }
        }
        // On web: [ACTIONS] block is left intact → client renders buttons
      }
    } catch (parseErr: any) {
      console.warn('[CREATE-TASK] Failed to parse [ACTIONS] block:', parseErr.message);
    }
  }
  // ────────────────────────────────────────────────────────────────────────────

  if (options?.isOpenMode && options?.telegramChatId) {
    await db.execute(sql`
      INSERT INTO telegram_open_mode_messages (consultant_id, ai_role, telegram_chat_id, sender_type, message)
      VALUES (${consultantId}::uuid, ${roleId}, ${options.telegramChatId}, 'agent', ${aiResponse})
    `);
  } else {
    const responseMetadata = options?.source === 'telegram' 
      ? JSON.stringify({ source: "telegram", telegram_chat_id: options?.metadata?.telegram_chat_id || null })
      : '{"source":"web"}';
    await db.execute(sql`
      INSERT INTO agent_chat_messages (consultant_id, ai_role, role_name, sender, message, metadata)
      VALUES (${consultantId}::uuid, ${roleId}, ${roleName}, 'agent', ${aiResponse}, ${responseMetadata}::jsonb)
    `);
  }

  if (!isOpenMode && options?.source !== 'telegram') {
    try {
      const telegramConfigResult = await db.execute(sql`
        SELECT tc.bot_token, tl.telegram_chat_id
        FROM telegram_bot_configs tc
        JOIN telegram_chat_links tl ON tc.consultant_id = tl.consultant_id AND tc.ai_role = tl.ai_role
        WHERE tc.consultant_id = ${consultantId}::uuid AND tc.ai_role = ${roleId} AND tc.enabled = true AND tl.active = true
      `);
      if (telegramConfigResult.rows.length > 0) {
        const { sendTelegramMessage } = await import("../telegram/telegram-service");
        for (const row of telegramConfigResult.rows as any[]) {
          sendTelegramMessage(row.bot_token, row.telegram_chat_id, aiResponse, "Markdown").catch(err =>
            console.warn("[TELEGRAM] Failed to forward to Telegram:", err.message)
          );
        }
      }
    } catch (tgErr: any) {
      console.warn("[TELEGRAM] Forward error:", tgErr.message);
    }
  }

  if (!isOpenMode) {
    const capturedConsultantId = consultantId;
    const capturedRoleId = roleId;
    (async () => {
      try {
        const totalCountResult = await db.execute(sql`
          SELECT COUNT(*)::int as cnt FROM agent_chat_messages
          WHERE consultant_id = ${capturedConsultantId}::uuid AND ai_role = ${capturedRoleId}
        `);
        const totalMessages = (totalCountResult.rows[0] as any)?.cnt || 0;
        if (totalMessages >= 60) {
          const allMsgsResult = await db.execute(sql`
            SELECT id, created_at FROM agent_chat_messages
            WHERE consultant_id = ${capturedConsultantId}::uuid AND ai_role = ${capturedRoleId}
            ORDER BY created_at ASC
          `);
          const allMsgs = allMsgsResult.rows as any[];
          const keepCount = 30;
          if (allMsgs.length > keepCount) {
            const firstKeptMsg = allMsgs[allMsgs.length - keepCount];
            if (firstKeptMsg?.created_at) {
              await db.execute(sql`
                DELETE FROM agent_chat_messages
                WHERE consultant_id = ${capturedConsultantId}::uuid AND ai_role = ${capturedRoleId}
                  AND created_at < ${firstKeptMsg.created_at}::timestamptz
              `);
              console.log(`[AGENT-CHAT-CLEANUP] Cleaned up old messages for ${capturedRoleId}, kept ${keepCount}`);
            }
          }
        }
      } catch (cleanupErr: any) {
        console.error(`[AGENT-CHAT-CLEANUP] Error:`, cleanupErr.message);
      }
    })();
  }

  return aiResponse;
}

router.get("/reasoning-logs", authenticateToken, requireAnyRole(["consultant", "super_admin"]), async (req: Request, res: Response) => {
  try {
    const consultantId = (req as AuthRequest).user?.id;
    if (!consultantId) return res.status(401).json({ error: "Unauthorized" });

    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
    const offset = (page - 1) * limit;
    const roleFilter = req.query.role as string || null;
    const modeFilter = req.query.mode as string || null;

    let whereClause = sql`WHERE consultant_id = ${consultantId}::uuid`;
    if (roleFilter) whereClause = sql`${whereClause} AND role_id = ${roleFilter}`;
    if (modeFilter) whereClause = sql`${whereClause} AND reasoning_mode = ${modeFilter}`;

    const countResult = await db.execute(sql`SELECT COUNT(*) as total FROM ai_reasoning_logs ${whereClause}`);
    const total = parseInt((countResult.rows[0] as any)?.total || '0');

    const result = await db.execute(sql`
      SELECT * FROM ai_reasoning_logs ${whereClause}
      ORDER BY created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `);

    return res.json({
      logs: result.rows,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
    });
  } catch (error: any) {
    console.error("[AI-REASONING] Error fetching logs:", error);
    return res.status(500).json({ error: "Failed to fetch reasoning logs" });
  }
});

router.get("/reasoning-logs/:id", authenticateToken, requireAnyRole(["consultant", "super_admin"]), async (req: Request, res: Response) => {
  try {
    const consultantId = (req as AuthRequest).user?.id;
    if (!consultantId) return res.status(401).json({ error: "Unauthorized" });

    const { id } = req.params;
    const result = await db.execute(sql`
      SELECT * FROM ai_reasoning_logs
      WHERE id = ${id}::uuid AND consultant_id = ${consultantId}::uuid
      LIMIT 1
    `);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Reasoning log not found" });
    }

    return res.json(result.rows[0]);
  } catch (error: any) {
    console.error("[AI-REASONING] Error fetching log:", error);
    return res.status(500).json({ error: "Failed to fetch reasoning log" });
  }
});

router.get("/reasoning-stats", authenticateToken, requireAnyRole(["consultant", "super_admin"]), async (req: Request, res: Response) => {
  try {
    const consultantId = (req as AuthRequest).user?.id;
    if (!consultantId) return res.status(401).json({ error: "Unauthorized" });

    const result = await db.execute(sql`
      SELECT role_id, role_name, reasoning_mode,
        COUNT(*) as total_runs,
        SUM(tasks_created) as total_tasks_created,
        SUM(tasks_rejected) as total_tasks_rejected,
        AVG(duration_ms) as avg_duration_ms,
        SUM(total_tokens) as total_tokens_used,
        MAX(created_at) as last_run
      FROM ai_reasoning_logs
      WHERE consultant_id = ${consultantId}::uuid
        AND created_at > NOW() - INTERVAL '30 days'
      GROUP BY role_id, role_name, reasoning_mode
      ORDER BY role_name
    `);

    return res.json({ stats: result.rows });
  } catch (error: any) {
    console.error("[AI-REASONING] Error fetching stats:", error);
    return res.status(500).json({ error: "Failed to fetch reasoning stats" });
  }
});

router.post("/tasks/bulk-action", authenticateToken, requireAnyRole(["consultant", "super_admin"]), async (req: Request, res: Response) => {
  try {
    const consultantId = (req as AuthRequest).user?.id;
    if (!consultantId) return res.status(401).json({ error: "Unauthorized" });

    const { action, taskIds } = req.body;
    if (!action || !taskIds || !Array.isArray(taskIds) || taskIds.length === 0) {
      return res.status(400).json({ error: "action and taskIds are required" });
    }

    if (taskIds.length > 100) {
      return res.status(400).json({ error: "Maximum 100 tasks per batch" });
    }

    let result;
    switch (action) {
      case 'approve':
        result = await db.execute(sql`
          UPDATE ai_scheduled_tasks 
          SET status = 'approved', updated_at = now()
          WHERE consultant_id = ${consultantId}
            AND id = ANY(${taskIds}::text[])
            AND status IN ('waiting_approval', 'scheduled')
        `);
        break;

      case 'reject':
        result = await db.execute(sql`
          UPDATE ai_scheduled_tasks 
          SET status = 'rejected', updated_at = now()
          WHERE consultant_id = ${consultantId}
            AND id = ANY(${taskIds}::text[])
            AND status IN ('waiting_approval', 'scheduled', 'approved')
        `);
        break;

      case 'delete':
        result = await db.execute(sql`
          DELETE FROM ai_scheduled_tasks 
          WHERE consultant_id = ${consultantId}
            AND id = ANY(${taskIds}::text[])
            AND status IN ('waiting_approval', 'scheduled', 'rejected')
        `);
        break;

      default:
        return res.status(400).json({ error: `Invalid action: ${action}` });
    }

    return res.json({ success: true, action, affected: taskIds.length });
  } catch (error: any) {
    console.error("[AI-BULK] Error:", error);
    return res.status(500).json({ error: "Failed to execute bulk action" });
  }
});

router.get("/lead-notes/:leadType/:leadId", authenticateToken, requireAnyRole(["consultant", "super_admin"]), async (req: Request, res: Response) => {
  try {
    const consultantId = (req as any).user?.id;
    const { leadType, leadId } = req.params;

    if (leadType === 'scraper') {
      const result = await db.execute(sql`
        SELECT lr.lead_notes
        FROM lead_scraper_results lr
        JOIN lead_scraper_searches ls ON lr.search_id = ls.id
        WHERE lr.id = ${leadId} AND ls.consultant_id = ${consultantId}
        LIMIT 1
      `);
      if (result.rows.length === 0) return res.status(404).json({ error: "Lead non trovato" });
      return res.json({ notes: (result.rows[0] as any).lead_notes || '' });
    } else if (leadType === 'proactive') {
      const result = await db.execute(sql`
        SELECT consultant_notes
        FROM proactive_leads
        WHERE id = ${leadId} AND consultant_id = ${consultantId}
        LIMIT 1
      `);
      if (result.rows.length === 0) return res.status(404).json({ error: "Lead non trovato" });
      return res.json({ notes: (result.rows[0] as any).consultant_notes || '' });
    } else {
      return res.status(400).json({ error: "leadType deve essere 'scraper' o 'proactive'" });
    }
  } catch (error: any) {
    console.error("[LEAD-NOTES] GET error:", error);
    return res.status(500).json({ error: "Errore nel recupero delle note" });
  }
});

router.patch("/lead-notes/:leadType/:leadId", authenticateToken, requireAnyRole(["consultant", "super_admin"]), async (req: Request, res: Response) => {
  try {
    const consultantId = (req as any).user?.id;
    const { leadType, leadId } = req.params;
    const { notes } = req.body;

    if (typeof notes !== 'string') {
      return res.status(400).json({ error: "Il campo 'notes' è obbligatorio (stringa)" });
    }

    const trimmedNotes = notes.trim() || null;

    if (leadType === 'scraper') {
      const result = await db.execute(sql`
        UPDATE lead_scraper_results
        SET lead_notes = ${trimmedNotes}
        WHERE id = ${leadId}
          AND search_id IN (SELECT id FROM lead_scraper_searches WHERE consultant_id = ${consultantId})
      `);
      if (result.rowCount === 0) return res.status(404).json({ error: "Lead non trovato" });
      return res.json({ success: true, notes: trimmedNotes || '' });
    } else if (leadType === 'proactive') {
      const result = await db.execute(sql`
        UPDATE proactive_leads
        SET consultant_notes = ${trimmedNotes}
        WHERE id = ${leadId} AND consultant_id = ${consultantId}
      `);
      if (result.rowCount === 0) return res.status(404).json({ error: "Lead non trovato" });
      return res.json({ success: true, notes: trimmedNotes || '' });
    } else {
      return res.status(400).json({ error: "leadType deve essere 'scraper' o 'proactive'" });
    }
  } catch (error: any) {
    console.error("[LEAD-NOTES] PATCH error:", error);
    return res.status(500).json({ error: "Errore nel salvataggio delle note" });
  }
});

export default router;
