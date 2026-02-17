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
        role_frequencies: {},
        role_autonomy_modes: {},
        role_working_hours: {},
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
    const roleFrequencies = JSON.stringify(body.role_frequencies ?? {});
    const roleAutonomyModes = JSON.stringify(body.role_autonomy_modes ?? {});
    const roleWorkingHours = JSON.stringify(body.role_working_hours ?? {});

    const result = await db.execute(sql`
      INSERT INTO ai_autonomy_settings (
        consultant_id, autonomy_level, default_mode, allowed_task_categories,
        always_approve_actions, working_hours_start, working_hours_end, working_days,
        max_daily_calls, max_daily_emails, max_daily_whatsapp, max_daily_analyses,
        proactive_check_interval_minutes, is_active, custom_instructions, channels_enabled,
        role_frequencies, role_autonomy_modes, role_working_hours
      ) VALUES (
        ${consultantId}, ${autonomyLevel}, ${defaultMode}, ${allowedCategories}::jsonb,
        ${alwaysApprove}::jsonb, ${hoursStart}::time, ${hoursEnd}::time, ARRAY[${sql.raw(days.join(','))}]::integer[],
        ${maxCalls}, ${maxEmails}, ${maxWhatsapp}, ${maxAnalyses},
        ${proactiveInterval}, ${isActive}, ${customInstructions}, ${channelsEnabled}::jsonb,
        ${roleFrequencies}::jsonb, ${roleAutonomyModes}::jsonb, ${roleWorkingHours}::jsonb
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
        updated_at = now()
      RETURNING *
    `);

    return res.json(result.rows[0]);
  } catch (error: any) {
    console.error("[AI-AUTONOMY] Error upserting settings:", error);
    return res.status(500).json({ error: "Failed to update autonomy settings" });
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
      UPDATE ai_autonomy_settings 
      SET personalizza_config = ${JSON.stringify(config)}::jsonb,
          updated_at = NOW()
      WHERE consultant_id::text = ${consultantId}::text
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
      UPDATE ai_autonomy_settings 
      SET marco_context = ${JSON.stringify(context)}::jsonb,
          updated_at = NOW()
      WHERE consultant_id::text = ${consultantId}::text
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
      UPDATE ai_autonomy_settings 
      SET agent_contexts = ${JSON.stringify(existingContexts)}::jsonb,
          consultant_phone = ${consultantPhone || null},
          consultant_email = ${consultantEmail || null},
          consultant_whatsapp = ${consultantWhatsapp || null},
          updated_at = NOW()
      WHERE consultant_id::text = ${consultantId}::text
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

    const { ai_instruction, task_category, priority, contact_name, contact_phone, client_id, preferred_channel, tone, urgency, scheduled_datetime, objective, additional_context, voice_template_suggestion, language, agent_config_id } = req.body;

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
        preferred_channel, tone, urgency, scheduled_datetime, objective, additional_context, voice_template_suggestion, language, whatsapp_config_id
      ) VALUES (
        ${taskId}, ${consultantId}, 'ai_task', ${task_category}, ${ai_instruction.trim()}, 'scheduled',
        NOW(), 'Europe/Rome', 'manual', ${taskPriority}, ${contact_name || null}, ${sanitizedPhone || ''}, ${client_id || null},
        ${preferred_channel || null}, ${tone || null}, ${urgency || 'normal'}, ${scheduled_datetime ? new Date(scheduled_datetime) : null}, ${objective || null}, ${additional_context || null}, ${voice_template_suggestion || null}, ${language || 'it'}, ${agent_config_id || null}
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
    const roleFilter = req.query.ai_role as string | undefined;

    let conditions = [sql`consultant_id = ${consultantId}`, sql`task_type = 'ai_task'`];
    if (!statusFilter || statusFilter === 'all') {
      conditions.push(sql`status != 'cancelled'`);
    }
    if (statusFilter && statusFilter !== 'all') {
      if (statusFilter === 'active') {
        conditions.push(sql`status IN ('scheduled', 'in_progress', 'approved')`);
      } else if (statusFilter === 'paused') {
        conditions.push(sql`status IN ('paused', 'draft')`);
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
               parent_task_id, additional_context
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

    const [activityResult, followUpsResult] = await Promise.all([
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
    ]);

    return res.json({
      task: result.rows[0],
      activity: activityResult.rows,
      follow_ups: followUpsResult.rows,
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

    const [result, roleCountsResult, manualCountResult] = await Promise.all([
      db.execute(sql`
        SELECT 
          COUNT(*) FILTER (WHERE status != 'cancelled')::int as total,
          COUNT(*) FILTER (WHERE status IN ('scheduled', 'in_progress', 'approved'))::int as active,
          COUNT(*) FILTER (WHERE status = 'completed')::int as completed,
          COUNT(*) FILTER (WHERE status = 'failed')::int as failed,
          COUNT(*) FILTER (WHERE status IN ('paused', 'draft', 'waiting_approval', 'deferred'))::int as pending,
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
    const enabledRolesData = settings.enabled_roles || { alessia: true, millie: true, echo: true, nova: true, stella: true, iris: true };

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

router.post("/trigger-role/:roleId", authenticateToken, requireAnyRole(["consultant", "super_admin"]), async (req: Request, res: Response) => {
  try {
    const consultantId = (req as AuthRequest).user?.id;
    if (!consultantId) return res.status(401).json({ error: "Unauthorized" });

    const { roleId } = req.params;

    const validRoleIds = ['alessia', 'millie', 'echo', 'nova', 'stella', 'iris', 'marco', 'personalizza'];
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
      title: result.error ? `${roleName}: avvio manuale fallito` : `${roleName}: avvio manuale completato`,
      description: result.error
        ? `Errore durante l'avvio manuale di ${roleName}: ${result.error}`
        : `${roleName} avviato manualmente. ${result.tasksGenerated} task generati.`,
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
    const enabledRoles = (settingsResult.rows[0] as any)?.enabled_roles || { alessia: true, millie: true, echo: true, nova: true, stella: true, iris: true };

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
    const currentRoles = (settingsResult.rows[0] as any)?.enabled_roles || { alessia: true, millie: true, echo: true, nova: true, stella: true, iris: true };
    currentRoles[roleId] = enabled;

    await db.execute(sql`
      UPDATE ai_autonomy_settings
      SET enabled_roles = ${JSON.stringify(currentRoles)}::jsonb,
          updated_at = NOW()
      WHERE consultant_id = ${consultantId}
    `);

    await logActivity(consultantId, {
      event_type: 'autonomous_analysis',
      title: `Ruolo ${AI_ROLES[roleId].name} ${enabled ? 'attivato' : 'disattivato'}`,
      description: `Il consulente ha ${enabled ? 'attivato' : 'disattivato'} il dipendente AI "${AI_ROLES[roleId].displayName}".`,
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
      UPDATE ai_autonomy_settings
      SET enabled_roles = ${JSON.stringify(validatedRoles)}::jsonb,
          updated_at = NOW()
      WHERE consultant_id = ${consultantId}
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
    `);

    if ((result.rowCount ?? 0) === 0) {
      return res.status(400).json({ error: "Task non trovato o non in attesa di approvazione" });
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

    const romeTime = new Date(newDate.toLocaleString('en-US', { timeZone: 'Europe/Rome' }));
    const romeHour = romeTime.getHours();
    if (romeHour < 8 || romeHour >= 20) {
      return res.status(400).json({ error: "L'orario deve essere tra le 08:00 e le 20:00 (ora italiana)" });
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

router.patch("/tasks/:id/edit", authenticateToken, requireAnyRole(["consultant", "super_admin"]), async (req: Request, res: Response) => {
  try {
    const consultantId = (req as AuthRequest).user?.id;
    if (!consultantId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { id } = req.params;
    const { ai_instruction, additional_context } = req.body || {};

    if (!ai_instruction || typeof ai_instruction !== "string" || !ai_instruction.trim()) {
      return res.status(400).json({ error: "ai_instruction is required" });
    }

    const result = await db.execute(sql`
      UPDATE ai_scheduled_tasks
      SET ai_instruction = ${ai_instruction.trim()},
          additional_context = ${additional_context?.trim() || null},
          updated_at = NOW()
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
    `);

    if ((result.rowCount ?? 0) === 0) {
      return res.status(404).json({ error: "Task non trovato o non ripristinabile" });
    }

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
  iris: `Sei Iris, Revenue Optimizer AI. Sei diretta, strategica e focalizzata sui ricavi. In chat sei concreta: presenti opportunità con numeri, chiedi al consulente cosa ne pensa, proponi azioni e discuti le priorità di business.`,
  marco: `Sei Marco, Executive Coach personale. Sei diretto, informale, e a volte anche duro — ma sei un COACH, non un dittatore. Dai del "tu", usi un linguaggio concreto. In chat: fai domande scomode ma utili, chiedi aggiornamenti su quello che avevi suggerito, dai feedback onesto ma DIALOGA — ascolta le risposte, fai follow-up, adatta i consigli in base a quello che il consulente ti dice. Non fare monologhi, fai conversazione.`,
  personalizza: `Sei un assistente AI personalizzato. Segui le istruzioni specifiche del consulente per il tuo ruolo e comportamento. In chat sei collaborativo e disponibile al dialogo.`,
};

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

    const role = AI_ROLES[roleId];
    const roleName = role?.name || roleId;

    await db.execute(sql`
      INSERT INTO agent_chat_messages (consultant_id, ai_role, role_name, sender, message)
      VALUES (${consultantId}::uuid, ${roleId}, ${roleName}, 'consultant', ${message.trim()})
    `);

    const [historyResult, contextResult, recentActivityResult, activeTasksResult, completedTasksResult] = await Promise.all([
      db.execute(sql`
        SELECT sender, message, created_at FROM agent_chat_messages
        WHERE consultant_id = ${consultantId}::uuid AND ai_role = ${roleId}
        ORDER BY created_at DESC LIMIT 20
      `),
      db.execute(sql`
        SELECT agent_contexts, custom_instructions, chat_summaries FROM ai_autonomy_settings
        WHERE consultant_id = ${consultantId}::uuid LIMIT 1
      `),
      db.execute(sql`
        SELECT title, description, event_data, created_at FROM ai_activity_log
        WHERE consultant_id = ${consultantId}::uuid AND ai_role = ${roleId}
        ORDER BY created_at DESC LIMIT 5
      `),
      db.execute(sql`
        SELECT id, ai_instruction, task_category, contact_name, status, priority, scheduled_at, created_at
        FROM ai_scheduled_tasks
        WHERE consultant_id = ${consultantId}::uuid AND ai_role = ${roleId}
          AND status IN ('scheduled', 'waiting_approval', 'in_progress', 'approved', 'draft', 'paused')
        ORDER BY priority DESC, created_at DESC LIMIT 10
      `),
      db.execute(sql`
        SELECT id, ai_instruction, task_category, contact_name, status, result_summary, result_data, completed_at
        FROM ai_scheduled_tasks
        WHERE consultant_id = ${consultantId}::uuid AND ai_role = ${roleId}
          AND status = 'completed' AND completed_at > NOW() - INTERVAL '7 days'
        ORDER BY completed_at DESC LIMIT 8
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

    let systemPrompt = `${personality}

Stai chattando direttamente con il tuo consulente (il tuo "capo"). Questa è una CONVERSAZIONE — non un report. Rispondi come in una chat WhatsApp: naturale, diretto, e soprattutto INTERATTIVO.

COME COMPORTARTI IN CHAT:
- Fai domande di follow-up — non limitarti a dare ordini o report
- Se il consulente ti dice qualcosa, rispondi a QUELLO specificamente
- Chiedi chiarimenti se non hai abbastanza contesto
- Proponi azioni ma CHIEDI conferma ("vuoi che proceda?" / "ti torna?")
- Se hai task attivi o completati, menzionali naturalmente nella conversazione
- Usa paragrafi separati per ogni concetto (NON fare muri di testo)
- Usa **grassetto** per i punti chiave e le cifre importanti

${focusPriorities.length > 0 ? `\nLE TUE PRIORITÀ DI FOCUS:\n${focusPriorities.map((p: string, i: number) => `${i + 1}. ${p}`).join('\n')}` : ''}

${customContext ? `\nCONTESTO PERSONALIZZATO:\n${customContext}` : ''}

${customInstructions ? `\nISTRUZIONI GENERALI:\n${customInstructions}` : ''}
`;

    if (existingSummary) {
      systemPrompt += `\nRIASSUNTO CONVERSAZIONI PRECEDENTI CON IL CONSULENTE:\n${existingSummary}\n`;
    }

    if (activeTasks.length > 0) {
      systemPrompt += `\nI TUOI TASK ATTIVI — TOTALE: ${activeTasks.length} task (che devi ancora completare):\n`;
      for (let idx = 0; idx < activeTasks.length; idx++) {
        const t = activeTasks[idx];
        const statusLabels: Record<string, string> = {
          scheduled: '📅 Programmato', waiting_approval: '⏳ In attesa approvazione',
          in_progress: '⚡ In esecuzione', approved: '✅ Approvato', draft: '📝 Bozza', paused: '⏸️ In pausa',
        };
        systemPrompt += `${idx + 1}. [ID: ${t.id}] [${statusLabels[t.status] || t.status}] ${t.contact_name ? `(${t.contact_name}) ` : ''}${t.ai_instruction?.substring(0, 150)}${t.scheduled_at ? ` — programmato: ${new Date(t.scheduled_at).toLocaleString('it-IT', { timeZone: 'Europe/Rome' })}` : ''}\n`;
      }
      systemPrompt += `IMPORTANTE: Hai esattamente ${activeTasks.length} task attivi. Quando li menzioni, riporta il numero corretto.\n`;
      systemPrompt += `Puoi menzionare questi task nella conversazione, chiedere se procedere, o suggerire modifiche.\n`;
    }

    if (completedTasks.length > 0) {
      systemPrompt += `\nTASK CHE HAI COMPLETATO DI RECENTE (questi sono i TUOI risultati, li hai fatti TU):\n`;
      for (const t of completedTasks) {
        systemPrompt += `\n--- TASK COMPLETATO ---\n`;
        systemPrompt += `Data: ${new Date(t.completed_at).toLocaleString('it-IT', { timeZone: 'Europe/Rome' })}\n`;
        systemPrompt += `Istruzione: ${t.ai_instruction?.substring(0, 200) || 'N/A'}\n`;
        systemPrompt += `Categoria: ${t.task_category || 'N/A'}${t.contact_name ? ` | Contatto: ${t.contact_name}` : ''}\n`;
        if (t.result_summary) {
          systemPrompt += `Risultato: ${t.result_summary.substring(0, 300)}\n`;
        }
        if (t.result_data) {
          const rd = typeof t.result_data === 'string' ? JSON.parse(t.result_data) : t.result_data;
          if (rd.generate_report?.report_text) {
            systemPrompt += `Report generato:\n${rd.generate_report.report_text.substring(0, 800)}\n`;
          }
          if (rd.search_private_stores?.findings_summary) {
            systemPrompt += `Documenti trovati: ${rd.search_private_stores.findings_summary.substring(0, 300)}\n`;
          }
          if (rd.analyze_patterns?.suggested_approach) {
            systemPrompt += `Analisi: ${rd.analyze_patterns.suggested_approach.substring(0, 300)}\n`;
          }
          if (rd.send_email?.sent) {
            systemPrompt += `Email inviata: ${rd.send_email.subject || 'N/A'}\n`;
          }
          if (rd.send_whatsapp?.sent) {
            systemPrompt += `WhatsApp inviato: ${rd.send_whatsapp.message_preview?.substring(0, 150) || 'messaggio inviato'}\n`;
          }
          if (rd.voice_call?.scheduled_call_id) {
            systemPrompt += `Chiamata programmata: ID ${rd.voice_call.scheduled_call_id}\n`;
          }
          const stepLog = rd.step_log || rd.execution_log;
          if (Array.isArray(stepLog) && stepLog.length > 0) {
            systemPrompt += `Step eseguiti: ${stepLog.map((s: any) => `${s.action || s.step}(${s.status || 'done'})`).join(' → ')}\n`;
          }
        }
      }
      systemPrompt += `\nQUANDO IL CONSULENTE TI CHIEDE COSA HAI FATTO: Rispondi con i dettagli concreti dai task sopra. Cita numeri, nomi, risultati specifici.\n`;
    }

    if (recentActivity.length > 0) {
      systemPrompt += `\nLE TUE ULTIME ANALISI/AZIONI:\n`;
      for (const a of recentActivity) {
        systemPrompt += `- [${new Date(a.created_at).toLocaleString('it-IT', { timeZone: 'Europe/Rome' })}] ${a.title}: ${a.description?.substring(0, 200) || ''}\n`;
      }
    }

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
Puoi proporre di approvare o avviare task. Il flusso è:
1. PRIMA proponi l'azione e descrivi cosa farà il task, poi chiedi conferma esplicita
2. SOLO DOPO che il consulente conferma (dice "sì", "ok", "vai", "procedi", "fallo", "approvalo"), includi il comando nella tua risposta
3. Per approvare un task: scrivi [[APPROVA:ID_DEL_TASK]] nel tuo messaggio
4. Per avviare l'esecuzione: scrivi [[ESEGUI:ID_DEL_TASK]] nel tuo messaggio
5. NON eseguire mai azioni senza conferma esplicita del consulente
6. Dopo aver incluso il comando, conferma al consulente cosa hai fatto

Esempio di flusso corretto:
- Tu: "Ho il task X in attesa. Vuoi che lo approvi?"
- Consulente: "Sì, vai"
- Tu: "Perfetto, approvo il task. [[APPROVA:uuid-del-task]] Fatto! Il task è stato approvato e verrà eseguito."`;


    console.log(`\n${'='.repeat(80)}\n[AGENT-CHAT] System prompt completo per ${roleId.toUpperCase()} (${new Date().toLocaleString('it-IT', { timeZone: 'Europe/Rome' })}):\n${'='.repeat(80)}\n${systemPrompt}\n${'='.repeat(80)}\n`);

    const historyLimit = existingSummary ? 15 : 20;
    const relevantHistory = chatHistory.slice(-historyLimit);
    const conversationParts = relevantHistory.map((m: any) => ({
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
        provider.setFeature?.('decision-engine');
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

      if (!aiClient) {
        throw new Error("No AI provider available");
      }

      const chatContents = [
        { role: 'user' as const, parts: [{ text: systemPrompt }] },
        { role: 'model' as const, parts: [{ text: `Capito, sono ${roleName}. Sono pronto a chattare con il mio consulente.` }] },
        ...conversationParts,
      ];

      let response: any;
      if (aiClient.models?.generateContent) {
        response = await trackedGenerateContent(aiClient, {
          model: providerModel,
          contents: chatContents,
          config: {
            temperature: 0.7,
            maxOutputTokens: 2048,
          },
        } as any, { consultantId, feature: 'decision-engine' });
      } else {
        response = await aiClient.generateContent({
          model: providerModel,
          contents: chatContents,
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 2048,
          },
        });
      }

      aiResponse = response.text?.() || response.text || response.response?.text?.() || 'Mi dispiace, non sono riuscito a generare una risposta.';
    } catch (err: any) {
      console.error(`[AGENT-CHAT] AI error for ${roleId}:`, err.message);
      aiResponse = `Mi dispiace, c'è stato un problema tecnico. Riprova tra poco. (${err.message?.substring(0, 100)})`;
    }

    const actionResults: { type: string; taskId: string; success: boolean; error?: string }[] = [];
    const approveMatches = aiResponse.match(/\[\[APPROVA:[^\]]+\]\]/gi) || [];
    const executeMatches = aiResponse.match(/\[\[ESEGUI:[^\]]+\]\]/gi) || [];

    console.log(`📋 [AGENT-CHAT] Parsing action markers from AI response for ${roleId}:`);
    console.log(`   Raw AI response length: ${aiResponse.length}`);
    console.log(`   APPROVA markers found: ${approveMatches.length}`, approveMatches);
    console.log(`   ESEGUI markers found: ${executeMatches.length}`, executeMatches);

    for (const match of approveMatches) {
      const taskId = match.replace(/\[\[APPROVA:/i, '').replace(']]', '').trim();
      console.log(`🔍 [AGENT-CHAT] Processing APPROVA for taskId: "${taskId}"`);
      try {
        const taskCheck = await db.execute(sql`
          SELECT id, status, ai_instruction, scheduled_at FROM ai_scheduled_tasks
          WHERE id = ${taskId} AND consultant_id = ${consultantId}
            AND status IN ('waiting_approval', 'scheduled', 'draft', 'paused')
          LIMIT 1
        `);
        console.log(`   DB query result: ${taskCheck.rows.length} rows found`, taskCheck.rows.length > 0 ? { id: (taskCheck.rows[0] as any).id, status: (taskCheck.rows[0] as any).status, scheduled_at: (taskCheck.rows[0] as any).scheduled_at } : 'NONE');
        if ((taskCheck.rows[0] as any)?.id) {
          const task = taskCheck.rows[0] as any;
          const scheduledAt = task.scheduled_at ? new Date(task.scheduled_at) : null;
          const isPast = !scheduledAt || scheduledAt <= new Date();

          if (isPast) {
            const updateResult = await db.execute(sql`
              UPDATE ai_scheduled_tasks
              SET status = 'scheduled',
                  scheduled_at = NOW(),
                  updated_at = NOW(),
                  result_data = COALESCE(result_data, '{}'::jsonb) || '{"chat_approved": true, "skip_guardrails": true}'::jsonb
              WHERE id = ${taskId} AND consultant_id = ${consultantId}
            `);
            console.log(`   scheduled_at was in the past (${scheduledAt?.toISOString() || 'NULL'}) -> status='scheduled' + scheduled_at=NOW() + skip_guardrails=true`);
            console.log(`   UPDATE result: ${updateResult.rowCount} rows updated`);
            actionResults.push({ type: 'approve_and_execute', taskId, success: true });
            console.log(`🚀 [AGENT-CHAT] Task ${taskId} approved+scheduled for immediate execution via chat by ${roleId} (guardrails bypassed)`);
          } else {
            const updateResult = await db.execute(sql`
              UPDATE ai_scheduled_tasks
              SET status = 'approved',
                  updated_at = NOW(),
                  result_data = COALESCE(result_data, '{}'::jsonb) || '{"chat_approved": true, "skip_guardrails": true}'::jsonb
              WHERE id = ${taskId} AND consultant_id = ${consultantId}
            `);
            console.log(`   scheduled_at is in the future (${scheduledAt.toISOString()}) -> status='approved' + skip_guardrails=true, will run at scheduled time`);
            console.log(`   UPDATE result: ${updateResult.rowCount} rows updated`);
            actionResults.push({ type: 'approve', taskId, success: true });
            console.log(`✅ [AGENT-CHAT] Task ${taskId} approved via chat by ${roleId}, will execute at ${scheduledAt.toISOString()}`);
          }
        } else {
          const allTaskCheck = await db.execute(sql`
            SELECT id, status FROM ai_scheduled_tasks
            WHERE id = ${taskId}
            LIMIT 1
          `);
          console.log(`   ⚠️ Task not found with matching consultant. Global check: ${allTaskCheck.rows.length > 0 ? `found with status=${(allTaskCheck.rows[0] as any).status}` : 'NOT FOUND IN DB'}`);
          actionResults.push({ type: 'approve', taskId, success: false, error: 'Task non trovato o non in stato approvabile' });
        }
      } catch (actionErr: any) {
        actionResults.push({ type: 'approve', taskId, success: false, error: actionErr.message });
        console.error(`❌ [AGENT-CHAT] Error approving task ${taskId}:`, actionErr.message);
      }
    }

    for (const match of executeMatches) {
      const taskId = match.replace(/\[\[ESEGUI:/i, '').replace(']]', '').trim();
      console.log(`🔍 [AGENT-CHAT] Processing ESEGUI for taskId: "${taskId}"`);
      try {
        const taskCheck = await db.execute(sql`
          SELECT id, status FROM ai_scheduled_tasks
          WHERE id = ${taskId} AND consultant_id = ${consultantId}
            AND status IN ('approved', 'waiting_approval', 'scheduled', 'draft', 'paused')
          LIMIT 1
        `);
        console.log(`   DB query result: ${taskCheck.rows.length} rows found`, taskCheck.rows.length > 0 ? { id: (taskCheck.rows[0] as any).id, status: (taskCheck.rows[0] as any).status } : 'NONE');
        if ((taskCheck.rows[0] as any)?.id) {
          const updateResult = await db.execute(sql`
            UPDATE ai_scheduled_tasks
            SET status = 'scheduled',
                scheduled_at = NOW(),
                updated_at = NOW(),
                result_data = COALESCE(result_data, '{}'::jsonb) || '{"chat_approved": true, "skip_guardrails": true}'::jsonb
            WHERE id = ${taskId} AND consultant_id = ${consultantId}
          `);
          console.log(`   UPDATE result: ${updateResult.rowCount} rows updated`);
          actionResults.push({ type: 'execute', taskId, success: true });
          console.log(`🚀 [AGENT-CHAT] Task ${taskId} set for immediate execution via chat by ${roleId} (guardrails bypassed)`);
        } else {
          const allTaskCheck = await db.execute(sql`
            SELECT id, status FROM ai_scheduled_tasks
            WHERE id = ${taskId}
            LIMIT 1
          `);
          console.log(`   ⚠️ Task not found with matching consultant. Global check: ${allTaskCheck.rows.length > 0 ? `found with status=${(allTaskCheck.rows[0] as any).status}` : 'NOT FOUND IN DB'}`);
          actionResults.push({ type: 'execute', taskId, success: false, error: 'Task non trovato o non in stato eseguibile' });
        }
      } catch (actionErr: any) {
        actionResults.push({ type: 'execute', taskId, success: false, error: actionErr.message });
        console.error(`❌ [AGENT-CHAT] Error executing task ${taskId}:`, actionErr.message);
      }
    }

    console.log(`📊 [AGENT-CHAT] Action results summary:`, JSON.stringify(actionResults));

    aiResponse = aiResponse.replace(/\[\[APPROVA:[^\]]+\]\]/gi, '').replace(/\[\[ESEGUI:[^\]]+\]\]/gi, '').trim();

    await db.execute(sql`
      INSERT INTO agent_chat_messages (consultant_id, ai_role, role_name, sender, message)
      VALUES (${consultantId}::uuid, ${roleId}, ${roleName}, 'agent', ${aiResponse})
    `);

    const totalCountResult = await db.execute(sql`
      SELECT COUNT(*)::int as cnt FROM agent_chat_messages
      WHERE consultant_id = ${consultantId}::uuid AND ai_role = ${roleId}
    `);
    const totalMessages = (totalCountResult.rows[0] as any)?.cnt || 0;

    const capturedAiClient = aiClient;
    const capturedModel = providerModel;
    const capturedConsultantId = consultantId;
    const capturedRoleId = roleId;
    const capturedRoleName = roleName;

    if (totalMessages >= 40 && capturedAiClient) {
      (async () => {
        try {
          const allMsgsResult = await db.execute(sql`
            SELECT sender, message, created_at FROM agent_chat_messages
            WHERE consultant_id = ${capturedConsultantId}::uuid AND ai_role = ${capturedRoleId}
            ORDER BY created_at ASC
          `);
          const allMsgs = allMsgsResult.rows as any[];

          const keepCount = 15;
          if (allMsgs.length <= keepCount + 10) return;
          const msgsToSummarize = allMsgs.slice(0, -keepCount);

          const summaryInput = msgsToSummarize.map((m: any) =>
            `[${m.sender === 'consultant' ? 'Consulente' : capturedRoleName}] ${m.message}`
          ).join('\n\n');

          const freshSettingsResult = await db.execute(sql`
            SELECT chat_summaries FROM ai_autonomy_settings WHERE consultant_id = ${capturedConsultantId}::uuid LIMIT 1
          `);
          const freshSummaries = (freshSettingsResult.rows[0] as any)?.chat_summaries || {};
          const priorSummary = freshSummaries[capturedRoleId]?.summary || '';

          const summaryPrompt = `Riassumi questa conversazione tra il consulente e ${capturedRoleName} in modo conciso ma completo. Mantieni:
- Decisioni prese
- Azioni concordate
- Aggiornamenti importanti
- Feedback e preferenze espresse dal consulente
- Task discussi e il loro stato
${priorSummary ? `\nRIASSUNTO PRECEDENTE (integra con le nuove informazioni):\n${priorSummary}\n` : ''}
Scrivi il riassunto in italiano, in terza persona, max 500 parole.

CONVERSAZIONE DA RIASSUMERE:
${summaryInput}`;

          const summaryResult = await capturedAiClient.generateContent({
            model: capturedModel,
            contents: [{ role: 'user' as const, parts: [{ text: summaryPrompt }] }],
            generationConfig: { temperature: 0.3, maxOutputTokens: 800 },
          });

          const summaryText = summaryResult.text?.() || summaryResult.response?.text?.() || '';
          if (summaryText && summaryText.length > 50) {
            const reFetchResult = await db.execute(sql`
              SELECT chat_summaries FROM ai_autonomy_settings WHERE consultant_id = ${capturedConsultantId}::uuid LIMIT 1
            `);
            const latestSummaries = (reFetchResult.rows[0] as any)?.chat_summaries || {};
            latestSummaries[capturedRoleId] = { summary: summaryText, updatedAt: new Date().toISOString(), messagesSummarized: msgsToSummarize.length };

            await db.execute(sql`
              UPDATE ai_autonomy_settings
              SET chat_summaries = ${JSON.stringify(latestSummaries)}::jsonb
              WHERE consultant_id = ${capturedConsultantId}::uuid
            `);

            const firstKeptMsg = allMsgs[allMsgs.length - keepCount];
            if (firstKeptMsg?.created_at) {
              await db.execute(sql`
                DELETE FROM agent_chat_messages
                WHERE consultant_id = ${capturedConsultantId}::uuid AND ai_role = ${capturedRoleId}
                  AND created_at < ${firstKeptMsg.created_at}::timestamptz
              `);
            }
            console.log(`📝 [AGENT-CHAT] Auto-summary generated for ${capturedRoleId}, summarized ${msgsToSummarize.length} messages, kept last ${keepCount}`);
          }
        } catch (sumErr: any) {
          console.error(`[AGENT-CHAT] Auto-summary error for ${capturedRoleId}:`, sumErr.message);
        }
      })();
    }

    return res.json({
      success: true,
      response: {
        role_name: roleName,
        message: aiResponse,
        ai_role: roleId,
        actions_executed: actionResults.length > 0 ? actionResults : undefined,
      },
    });
  } catch (error: any) {
    console.error("[AGENT-CHAT] Error sending message:", error);
    return res.status(500).json({ error: "Failed to send message" });
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

export default router;
