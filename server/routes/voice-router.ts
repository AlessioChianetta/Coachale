/**
 * Voice Telephony API Routes
 * RDP Reference: Sezione 5.6
 * 
 * Gestisce:
 * - voice_calls: Lista, dettaglio, stats
 * - voice_numbers: Config numero consultant
 * - voice_rate_limits: Gestione blocchi
 */

import { Router, Request, Response } from "express";
import { authenticateToken, requireAnyRole, type AuthRequest } from "../middleware/auth";
import { db } from "../db";
import { sql, desc, eq, and, gte, lte, count } from "drizzle-orm";
import jwt from "jsonwebtoken";
import { consultantAvailabilitySettings } from "@shared/schema";

const JWT_SECRET = process.env.JWT_SECRET || process.env.SESSION_SECRET;
if (!JWT_SECRET) {
  console.error("❌ [VOICE ROUTER] JWT_SECRET or SESSION_SECRET environment variable is required");
}

const router = Router();

// ═══════════════════════════════════════════════════════════════════
// VOICE CALLS - Lista e dettaglio chiamate
// ═══════════════════════════════════════════════════════════════════

// GET /api/voice/calls - Lista chiamate con filtri
router.get("/calls", authenticateToken, requireAnyRole(["consultant", "super_admin"]), async (req: AuthRequest, res: Response) => {
  try {
    const { from, to, status, client_id, page = "1", limit = "20" } = req.query;
    const consultantId = req.user?.role === "super_admin" ? undefined : req.user?.id;
    
    const pageNum = parseInt(page as string, 10);
    const limitNum = Math.min(parseInt(limit as string, 10), 100);
    const offset = (pageNum - 1) * limitNum;

    let whereConditions = [];
    
    if (consultantId) {
      whereConditions.push(sql`vc.consultant_id = ${consultantId}`);
    }
    if (from) {
      whereConditions.push(sql`vc.started_at >= ${from}::timestamp`);
    }
    if (to) {
      whereConditions.push(sql`vc.started_at <= ${to}::timestamp`);
    }
    if (status) {
      whereConditions.push(sql`vc.status = ${status}`);
    }
    if (client_id) {
      whereConditions.push(sql`vc.client_id = ${client_id}`);
    }

    const whereClause = whereConditions.length > 0 
      ? sql`WHERE ${sql.join(whereConditions, sql` AND `)}`
      : sql``;

    const calls = await db.execute(sql`
      SELECT 
        vc.*,
        CONCAT(u.first_name, ' ', u.last_name) as client_name,
        u.phone_number as client_phone
      FROM voice_calls vc
      LEFT JOIN users u ON vc.client_id = u.id
      ${whereClause}
      ORDER BY vc.started_at DESC
      LIMIT ${limitNum} OFFSET ${offset}
    `);

    const totalResult = await db.execute(sql`
      SELECT COUNT(*) as total FROM voice_calls vc ${whereClause}
    `);
    const total = parseInt((totalResult.rows[0] as any)?.total || "0", 10);

    res.json({
      calls: calls.rows,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    console.error("[Voice] Error fetching calls:", error);
    res.status(500).json({ error: "Errore nel recupero delle chiamate" });
  }
});

// GET /api/voice/calls/:id - Dettaglio singola chiamata con eventi
router.get("/calls/:id", authenticateToken, requireAnyRole(["consultant", "super_admin"]), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const consultantId = req.user?.role === "super_admin" ? undefined : req.user?.id;

    let whereClause = sql`WHERE vc.id = ${id}`;
    if (consultantId) {
      whereClause = sql`WHERE vc.id = ${id} AND vc.consultant_id = ${consultantId}`;
    }

    const callResult = await db.execute(sql`
      SELECT 
        vc.*,
        CONCAT(u.first_name, ' ', u.last_name) as client_name,
        u.email as client_email,
        u.phone_number as client_phone
      FROM voice_calls vc
      LEFT JOIN users u ON vc.client_id = u.id
      ${whereClause}
    `);

    if (callResult.rows.length === 0) {
      return res.status(404).json({ error: "Chiamata non trovata" });
    }

    const eventsResult = await db.execute(sql`
      SELECT * FROM voice_call_events
      WHERE call_id = ${id}
      ORDER BY created_at ASC
    `);

    res.json({
      call: callResult.rows[0],
      events: eventsResult.rows
    });
  } catch (error) {
    console.error("[Voice] Error fetching call detail:", error);
    res.status(500).json({ error: "Errore nel recupero del dettaglio chiamata" });
  }
});

// GET /api/voice/stats - Statistiche aggregate
router.get("/stats", authenticateToken, requireAnyRole(["consultant", "super_admin"]), async (req: AuthRequest, res: Response) => {
  try {
    const { period = "day" } = req.query;
    const consultantId = req.user?.role === "super_admin" ? undefined : req.user?.id;

    let dateFilter;
    switch (period) {
      case "week":
        dateFilter = sql`started_at >= NOW() - INTERVAL '7 days'`;
        break;
      case "month":
        dateFilter = sql`started_at >= NOW() - INTERVAL '30 days'`;
        break;
      default: // day
        dateFilter = sql`started_at >= NOW() - INTERVAL '1 day'`;
    }

    const consultantFilter = consultantId 
      ? sql`AND consultant_id = ${consultantId}`
      : sql``;

    const statsResult = await db.execute(sql`
      SELECT 
        COUNT(*) as total_calls,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_calls,
        COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_calls,
        COUNT(CASE WHEN status = 'transferred' THEN 1 END) as transferred_calls,
        COALESCE(AVG(duration_seconds), 0) as avg_duration_seconds,
        COALESCE(SUM(telephony_minutes), 0) as total_minutes,
        COALESCE(SUM(ai_cost_estimate), 0) as total_cost_estimate,
        COALESCE(SUM(ai_tokens_used), 0) as total_tokens_used
      FROM voice_calls
      WHERE ${dateFilter} ${consultantFilter}
    `);

    const outcomeResult = await db.execute(sql`
      SELECT outcome, COUNT(*) as count
      FROM voice_calls
      WHERE ${dateFilter} ${consultantFilter} AND outcome IS NOT NULL
      GROUP BY outcome
    `);

    const activeCallsResult = await db.execute(sql`
      SELECT COUNT(*) as active
      FROM voice_calls
      WHERE status IN ('ringing', 'answered', 'talking')
      ${consultantFilter}
    `);

    res.json({
      period,
      stats: statsResult.rows[0],
      outcomes: outcomeResult.rows,
      activeCalls: parseInt((activeCallsResult.rows[0] as any)?.active || "0", 10)
    });
  } catch (error) {
    console.error("[Voice] Error fetching stats:", error);
    res.status(500).json({ error: "Errore nel recupero delle statistiche" });
  }
});

// ═══════════════════════════════════════════════════════════════════
// VOICE NUMBERS - Configurazione numeri
// ═══════════════════════════════════════════════════════════════════

// GET /api/voice/numbers - Lista numeri configurati
router.get("/numbers", authenticateToken, requireAnyRole(["consultant", "super_admin"]), async (req: AuthRequest, res: Response) => {
  try {
    const consultantId = req.user?.role === "super_admin" ? undefined : req.user?.id;

    const whereClause = consultantId 
      ? sql`WHERE consultant_id = ${consultantId}`
      : sql``;

    const numbersResult = await db.execute(sql`
      SELECT * FROM voice_numbers ${whereClause} ORDER BY created_at DESC
    `);

    res.json({ numbers: numbersResult.rows });
  } catch (error) {
    console.error("[Voice] Error fetching numbers:", error);
    res.status(500).json({ error: "Errore nel recupero dei numeri" });
  }
});

// GET /api/voice/numbers/:id - Dettaglio numero
router.get("/numbers/:id", authenticateToken, requireAnyRole(["consultant", "super_admin"]), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const consultantId = req.user?.role === "super_admin" ? undefined : req.user?.id;

    let whereClause = sql`WHERE id = ${id}`;
    if (consultantId) {
      whereClause = sql`WHERE id = ${id} AND consultant_id = ${consultantId}`;
    }

    const numberResult = await db.execute(sql`
      SELECT * FROM voice_numbers ${whereClause}
    `);

    if (numberResult.rows.length === 0) {
      return res.status(404).json({ error: "Numero non trovato" });
    }

    res.json({ number: numberResult.rows[0] });
  } catch (error) {
    console.error("[Voice] Error fetching number detail:", error);
    res.status(500).json({ error: "Errore nel recupero del numero" });
  }
});

// POST /api/voice/numbers - Crea nuovo numero
router.post("/numbers", authenticateToken, requireAnyRole(["consultant", "super_admin"]), async (req: AuthRequest, res: Response) => {
  try {
    const consultantId = req.user?.id;
    const {
      phone_number,
      display_name,
      greeting_text,
      ai_mode = "assistenza",
      fallback_number,
      active_days = ["mon", "tue", "wed", "thu", "fri"],
      active_hours_start = "09:00",
      active_hours_end = "18:00",
      timezone = "Europe/Rome",
      out_of_hours_action = "voicemail",
      max_concurrent_calls = 5,
      max_call_duration_minutes = 30
    } = req.body;

    if (!phone_number) {
      return res.status(400).json({ error: "Numero telefono obbligatorio" });
    }

    const result = await db.execute(sql`
      INSERT INTO voice_numbers (
        phone_number, display_name, consultant_id, greeting_text, ai_mode,
        fallback_number, active_days, active_hours_start, active_hours_end,
        timezone, out_of_hours_action, max_concurrent_calls, max_call_duration_minutes
      ) VALUES (
        ${phone_number}, ${display_name}, ${consultantId}, ${greeting_text}, ${ai_mode},
        ${fallback_number}, ${JSON.stringify(active_days)}::jsonb, ${active_hours_start}::time, ${active_hours_end}::time,
        ${timezone}, ${out_of_hours_action}, ${max_concurrent_calls}, ${max_call_duration_minutes}
      )
      RETURNING *
    `);

    res.status(201).json({ number: result.rows[0] });
  } catch (error: any) {
    console.error("[Voice] Error creating number:", error);
    if (error.code === "23505") {
      return res.status(409).json({ error: "Numero già esistente" });
    }
    res.status(500).json({ error: "Errore nella creazione del numero" });
  }
});

// PUT /api/voice/numbers/:id - Aggiorna numero
router.put("/numbers/:id", authenticateToken, requireAnyRole(["consultant", "super_admin"]), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const consultantId = req.user?.role === "super_admin" ? undefined : req.user?.id;
    const {
      display_name,
      greeting_text,
      ai_mode,
      fallback_number,
      active_days,
      active_hours_start,
      active_hours_end,
      timezone,
      out_of_hours_action,
      max_concurrent_calls,
      max_call_duration_minutes,
      is_active
    } = req.body;

    let ownerCheck = consultantId ? sql`AND consultant_id = ${consultantId}` : sql``;

    const result = await db.execute(sql`
      UPDATE voice_numbers SET
        display_name = COALESCE(${display_name}, display_name),
        greeting_text = COALESCE(${greeting_text}, greeting_text),
        ai_mode = COALESCE(${ai_mode}, ai_mode),
        fallback_number = COALESCE(${fallback_number}, fallback_number),
        active_days = COALESCE(${active_days ? JSON.stringify(active_days) : null}::jsonb, active_days),
        active_hours_start = COALESCE(${active_hours_start}::time, active_hours_start),
        active_hours_end = COALESCE(${active_hours_end}::time, active_hours_end),
        timezone = COALESCE(${timezone}, timezone),
        out_of_hours_action = COALESCE(${out_of_hours_action}, out_of_hours_action),
        max_concurrent_calls = COALESCE(${max_concurrent_calls}, max_concurrent_calls),
        max_call_duration_minutes = COALESCE(${max_call_duration_minutes}, max_call_duration_minutes),
        is_active = COALESCE(${is_active}, is_active),
        updated_at = NOW()
      WHERE id = ${id} ${ownerCheck}
      RETURNING *
    `);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Numero non trovato" });
    }

    res.json({ number: result.rows[0] });
  } catch (error) {
    console.error("[Voice] Error updating number:", error);
    res.status(500).json({ error: "Errore nell'aggiornamento del numero" });
  }
});

// DELETE /api/voice/numbers/:id - Elimina numero
router.delete("/numbers/:id", authenticateToken, requireAnyRole(["consultant", "super_admin"]), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const consultantId = req.user?.role === "super_admin" ? undefined : req.user?.id;

    let ownerCheck = consultantId ? sql`AND consultant_id = ${consultantId}` : sql``;

    const result = await db.execute(sql`
      DELETE FROM voice_numbers
      WHERE id = ${id} ${ownerCheck}
      RETURNING id
    `);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Numero non trovato" });
    }

    res.json({ success: true, deleted_id: id });
  } catch (error) {
    console.error("[Voice] Error deleting number:", error);
    res.status(500).json({ error: "Errore nell'eliminazione del numero" });
  }
});

// ═══════════════════════════════════════════════════════════════════
// RATE LIMITS - Gestione blocchi
// ═══════════════════════════════════════════════════════════════════

// GET /api/voice/rate-limits/:callerId - Stato rate limit per numero
router.get("/rate-limits/:callerId", authenticateToken, requireAnyRole(["consultant", "super_admin"]), async (req: AuthRequest, res: Response) => {
  try {
    const { callerId } = req.params;

    const result = await db.execute(sql`
      SELECT * FROM voice_rate_limits WHERE caller_id = ${callerId}
    `);

    if (result.rows.length === 0) {
      return res.json({
        caller_id: callerId,
        calls_last_minute: 0,
        calls_last_hour: 0,
        calls_today: 0,
        total_minutes_today: 0,
        is_blocked: false
      });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error("[Voice] Error fetching rate limit:", error);
    res.status(500).json({ error: "Errore nel recupero del rate limit" });
  }
});

// POST /api/voice/block/:callerId - Blocca numero manualmente
router.post("/block/:callerId", authenticateToken, requireAnyRole(["consultant", "super_admin"]), async (req: AuthRequest, res: Response) => {
  try {
    const { callerId } = req.params;
    const { reason, hours = 24 } = req.body;

    const blockedUntil = new Date(Date.now() + hours * 60 * 60 * 1000);

    const result = await db.execute(sql`
      INSERT INTO voice_rate_limits (caller_id, is_blocked, blocked_reason, blocked_until)
      VALUES (${callerId}, true, ${reason || 'Blocked manually'}, ${blockedUntil.toISOString()}::timestamp)
      ON CONFLICT (caller_id) 
      DO UPDATE SET 
        is_blocked = true,
        blocked_reason = ${reason || 'Blocked manually'},
        blocked_until = ${blockedUntil.toISOString()}::timestamp,
        updated_at = NOW()
      RETURNING *
    `);

    res.json({ success: true, rateLimit: result.rows[0] });
  } catch (error) {
    console.error("[Voice] Error blocking caller:", error);
    res.status(500).json({ error: "Errore nel blocco del numero" });
  }
});

// DELETE /api/voice/block/:callerId - Sblocca numero
router.delete("/block/:callerId", authenticateToken, requireAnyRole(["consultant", "super_admin"]), async (req: AuthRequest, res: Response) => {
  try {
    const { callerId } = req.params;

    const result = await db.execute(sql`
      UPDATE voice_rate_limits 
      SET is_blocked = false, blocked_reason = NULL, blocked_until = NULL, updated_at = NOW()
      WHERE caller_id = ${callerId}
      RETURNING *
    `);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Caller non trovato" });
    }

    res.json({ success: true, rateLimit: result.rows[0] });
  } catch (error) {
    console.error("[Voice] Error unblocking caller:", error);
    res.status(500).json({ error: "Errore nello sblocco del numero" });
  }
});

// GET /api/voice/blocked - Lista numeri bloccati
router.get("/blocked", authenticateToken, requireAnyRole(["consultant", "super_admin"]), async (req: AuthRequest, res: Response) => {
  try {
    const result = await db.execute(sql`
      SELECT * FROM voice_rate_limits 
      WHERE is_blocked = true
      ORDER BY blocked_until DESC
    `);

    res.json({ blocked: result.rows });
  } catch (error) {
    console.error("[Voice] Error fetching blocked numbers:", error);
    res.status(500).json({ error: "Errore nel recupero dei numeri bloccati" });
  }
});

// ═══════════════════════════════════════════════════════════════════
// HEALTH - Stato sistema (placeholder per VPS)
// ═══════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════
// SERVICE TOKEN - Token per VPS Voice Bridge
// ═══════════════════════════════════════════════════════════════════

// POST /api/voice/service-token - Genera token di servizio per VPS Bridge
router.post("/service-token", authenticateToken, requireAnyRole(["consultant", "super_admin"]), async (req: AuthRequest, res: Response) => {
  try {
    if (!JWT_SECRET) {
      return res.status(500).json({ error: "Server configuration error: JWT secret not set" });
    }

    const user = req.user;
    
    if (!user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const consultantId = user.role === "consultant" ? user.id : req.body.consultantId;
    
    if (!consultantId) {
      return res.status(400).json({ error: "consultantId required for super_admin" });
    }

    const consultantExists = await db.execute(sql`SELECT id FROM users WHERE id = ${consultantId} AND role = 'consultant' LIMIT 1`);
    if (consultantExists.rows.length === 0) {
      return res.status(404).json({ error: "Consultant not found" });
    }

    // Token without expiration - valid until manually revoked
    const token = jwt.sign(
      {
        type: "phone_service",
        consultantId: consultantId,
        createdAt: new Date().toISOString(),
      },
      JWT_SECRET
      // No expiresIn = token never expires
    );

    // Update token tracking in database
    await db.execute(sql`
      INSERT INTO consultant_availability_settings (consultant_id, voice_service_token_created_at, voice_service_token_count)
      VALUES (${consultantId}, NOW(), 1)
      ON CONFLICT (consultant_id) DO UPDATE SET
        voice_service_token_created_at = NOW(),
        voice_service_token_count = consultant_availability_settings.voice_service_token_count + 1,
        updated_at = NOW()
    `);

    // Get the updated count
    const countResult = await db.execute(sql`
      SELECT voice_service_token_count FROM consultant_availability_settings WHERE consultant_id = ${consultantId}
    `);
    const tokenCount = (countResult.rows[0] as any)?.voice_service_token_count || 1;

    console.log(`📞 [VOICE] Phone service token generated for consultant ${consultantId} (token #${tokenCount}, no expiration)`);

    res.json({
      token,
      consultantId,
      expiresIn: "never",
      tokenNumber: tokenCount,
      createdAt: new Date().toISOString(),
      usage: {
        wsUrl: "/ws/ai-voice",
        params: "?token=<TOKEN>&mode=phone_service&callerId=<PHONE_NUMBER>&voice=Puck",
        example: `wss://your-domain.repl.co/ws/ai-voice?token=${token.substring(0, 20)}...&mode=phone_service&callerId=+393331234567`,
      },
    });
  } catch (error) {
    console.error("[Voice] Error generating phone service token:", error);
    res.status(500).json({ error: "Failed to generate token" });
  }
});

// GET /api/voice/service-token/status - Stato del token di servizio
router.get("/service-token/status", authenticateToken, requireAnyRole(["consultant", "super_admin"]), async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const consultantId = user.role === "consultant" ? user.id : (req.query.consultantId as string);
    
    if (!consultantId) {
      return res.status(400).json({ error: "consultantId required for super_admin" });
    }

    const result = await db.execute(sql`
      SELECT voice_service_token_created_at, voice_service_token_count
      FROM consultant_availability_settings
      WHERE consultant_id = ${consultantId}
    `);

    if (result.rows.length === 0 || !(result.rows[0] as any).voice_service_token_created_at) {
      return res.json({
        hasToken: false,
        tokenCount: 0,
        lastGeneratedAt: null,
        message: "Nessun token generato"
      });
    }

    const row = result.rows[0] as any;
    res.json({
      hasToken: true,
      tokenCount: row.voice_service_token_count || 0,
      lastGeneratedAt: row.voice_service_token_created_at,
      revokedCount: Math.max(0, (row.voice_service_token_count || 1) - 1),
      message: row.voice_service_token_count > 1 
        ? `Token attivo (${row.voice_service_token_count - 1} token precedenti revocati)`
        : "Token attivo"
    });
  } catch (error) {
    console.error("[Voice] Error fetching token status:", error);
    res.status(500).json({ error: "Failed to fetch token status" });
  }
});

// GET /api/voice/service-token/validate - Valida token di servizio
router.get("/service-token/validate", async (req: Request, res: Response) => {
  try {
    if (!JWT_SECRET) {
      return res.status(500).json({ valid: false, error: "Server configuration error" });
    }

    const token = req.query.token as string;
    
    if (!token) {
      return res.status(400).json({ valid: false, error: "Token required" });
    }

    const decoded = jwt.verify(token, JWT_SECRET) as any;
    
    if (decoded.type !== "phone_service") {
      return res.status(400).json({ valid: false, error: "Invalid token type" });
    }

    res.json({
      valid: true,
      consultantId: decoded.consultantId,
      createdAt: decoded.createdAt,
      expiresAt: new Date((decoded.exp || 0) * 1000).toISOString(),
    });
  } catch (error: any) {
    res.status(400).json({ valid: false, error: error.message || "Invalid token" });
  }
});

// ═══════════════════════════════════════════════════════════════════
// VOICE SETTINGS - Impostazioni voce consultant
// ═══════════════════════════════════════════════════════════════════

const VALID_VOICES = ['Achernar', 'Puck', 'Charon', 'Kore', 'Fenrir', 'Aoede'];

// GET /api/voice/settings - Ottieni impostazioni voce
router.get("/settings", authenticateToken, requireAnyRole(["consultant", "super_admin"]), async (req: AuthRequest, res: Response) => {
  try {
    const consultantId = req.user!.id;

    const result = await db.execute(sql`
      SELECT voice_id FROM consultant_availability_settings
      WHERE consultant_id = ${consultantId}
      LIMIT 1
    `);

    const voiceId = (result.rows[0] as any)?.voice_id || 'achernar';

    res.json({ voiceId });
  } catch (error) {
    console.error("[Voice] Error fetching settings:", error);
    res.status(500).json({ error: "Errore nel recupero delle impostazioni" });
  }
});

// PUT /api/voice/settings - Aggiorna impostazioni voce
router.put("/settings", authenticateToken, requireAnyRole(["consultant", "super_admin"]), async (req: AuthRequest, res: Response) => {
  try {
    const consultantId = req.user!.id;
    const { voiceId } = req.body;

    if (!voiceId || !VALID_VOICES.includes(voiceId)) {
      return res.status(400).json({ 
        error: "Voce non valida", 
        validVoices: VALID_VOICES 
      });
    }

    // Check if settings exist
    const existing = await db.execute(sql`
      SELECT id FROM consultant_availability_settings
      WHERE consultant_id = ${consultantId}
      LIMIT 1
    `);

    if (existing.rows.length > 0) {
      // Update existing
      await db.execute(sql`
        UPDATE consultant_availability_settings
        SET voice_id = ${voiceId}, updated_at = NOW()
        WHERE consultant_id = ${consultantId}
      `);
    } else {
      // Insert new with defaults
      await db.execute(sql`
        INSERT INTO consultant_availability_settings (
          id, consultant_id, voice_id, 
          appointment_duration, buffer_before, buffer_after,
          morning_slot_start, morning_slot_end, afternoon_slot_start, afternoon_slot_end,
          max_days_ahead, min_hours_notice, timezone, is_active
        ) VALUES (
          gen_random_uuid(), ${consultantId}, ${voiceId},
          60, 15, 15,
          '09:00', '13:00', '14:00', '18:00',
          30, 24, 'Europe/Rome', true
        )
      `);
    }

    console.log(`🎤 [Voice] Voice updated for consultant ${consultantId}: ${voiceId}`);
    res.json({ success: true, voiceId });
  } catch (error) {
    console.error("[Voice] Error updating settings:", error);
    res.status(500).json({ error: "Errore nell'aggiornamento delle impostazioni" });
  }
});

// GET /api/voice/health - Health check (placeholder)
router.get("/health", authenticateToken, requireAnyRole(["consultant", "super_admin"]), async (req: AuthRequest, res: Response) => {
  try {
    // Verifica DB
    const dbCheck = await db.execute(sql`SELECT 1 as ok`);
    const dbOk = dbCheck.rows.length > 0;

    // Placeholder per VPS health
    res.json({
      overall: dbOk ? "healthy" : "degraded",
      components: {
        database: { status: dbOk ? "up" : "down", latencyMs: 0 },
        esl: { status: "unknown", note: "VPS component - check via VPS API" },
        freeswitch: { status: "unknown", note: "VPS component - check via VPS API" },
        gemini: { status: "unknown", note: "VPS component - check via VPS API" }
      },
      note: "ESL, FreeSWITCH, Gemini health managed by VPS backend"
    });
  } catch (error) {
    console.error("[Voice] Health check error:", error);
    res.status(500).json({
      overall: "unhealthy",
      error: "Database connection failed"
    });
  }
});

export default router;
