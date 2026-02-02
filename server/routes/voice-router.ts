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
import { getActiveVoiceCallsForConsultant } from "../ai/gemini-live-ws-service";

const JWT_SECRET = process.env.JWT_SECRET || process.env.SESSION_SECRET;
if (!JWT_SECRET) {
  console.error("❌ [VOICE ROUTER] JWT_SECRET or SESSION_SECRET environment variable is required");
}

const router = Router();

// ═══════════════════════════════════════════════════════════════════
// VOICE CALLS - Lista e dettaglio chiamate
// ═══════════════════════════════════════════════════════════════════

// GET /api/voice/calls/active - Chiamate attive in tempo reale
router.get("/calls/active", authenticateToken, requireAnyRole(["consultant", "super_admin"]), async (req: AuthRequest, res: Response) => {
  try {
    const consultantId = req.user?.id;
    if (!consultantId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    
    const activeCalls = getActiveVoiceCallsForConsultant(consultantId);
    
    return res.json({
      success: true,
      activeCalls: activeCalls,
      count: activeCalls.length,
    });
  } catch (error: any) {
    console.error("[VOICE] Error fetching active calls:", error);
    return res.status(500).json({ error: "Failed to fetch active calls" });
  }
});

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

    const call = callResult.rows[0] as any;
    
    // Fallback: if no full_transcript but has ai_conversation_id, fetch from ai_messages
    if (!call.full_transcript && call.ai_conversation_id) {
      try {
        const messagesResult = await db.execute(sql`
          SELECT role, content FROM ai_messages 
          WHERE conversation_id = ${call.ai_conversation_id}
          ORDER BY created_at ASC
        `);
        if (messagesResult.rows.length > 0) {
          call.full_transcript = (messagesResult.rows as any[])
            .map(m => `[${m.role === 'user' ? 'Utente' : 'Alessia'}] ${m.content}`)
            .join('\n');
          console.log(`[Voice] Fallback: loaded ${messagesResult.rows.length} messages from ai_messages for call ${id}`);
        }
      } catch (e) {
        console.warn(`[Voice] Could not fetch transcript fallback for call ${id}`);
      }
    }

    const eventsResult = await db.execute(sql`
      SELECT * FROM voice_call_events
      WHERE call_id = ${id}
      ORDER BY created_at ASC
    `);

    res.json({
      call: call,
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

// PUT /api/voice/service-token - Salva token esistente nel database
router.put("/service-token", authenticateToken, requireAnyRole(["consultant", "super_admin"]), async (req: AuthRequest, res: Response) => {
  try {
    const consultantId = req.user!.id;
    const { token } = req.body;

    if (!token || typeof token !== 'string' || token.length < 50) {
      return res.status(400).json({ error: "Token non valido (deve essere un JWT)" });
    }

    // Revoke existing tokens
    await db.execute(sql`
      UPDATE voice_service_tokens 
      SET revoked_at = NOW(), revoked_reason = 'Replaced by manual token'
      WHERE consultant_id = ${consultantId} AND revoked_at IS NULL
    `);

    // Insert new token
    await db.execute(sql`
      INSERT INTO voice_service_tokens (id, consultant_id, token, created_at)
      VALUES (gen_random_uuid(), ${consultantId}, ${token}, NOW())
    `);

    // Update tracking
    await db.execute(sql`
      UPDATE consultant_availability_settings 
      SET voice_service_token_created_at = NOW(), 
          voice_service_token_count = COALESCE(voice_service_token_count, 0) + 1
      WHERE consultant_id = ${consultantId}
    `);

    console.log(`📞 [VOICE] Manual service token saved for consultant ${consultantId}`);
    res.json({ success: true, message: "Token salvato" });
  } catch (error) {
    console.error("[Voice] Error saving service token:", error);
    res.status(500).json({ error: "Errore nel salvataggio del token" });
  }
});

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
      SELECT voice_id, vps_bridge_url FROM consultant_availability_settings
      WHERE consultant_id = ${consultantId}
      LIMIT 1
    `);

    const row = result.rows[0] as any;
    const voiceId = row?.voice_id || 'achernar';
    const vpsBridgeUrl = row?.vps_bridge_url || '';

    res.json({ voiceId, vpsBridgeUrl });
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

// PUT /api/voice/vps-url - Aggiorna URL del VPS Bridge
router.put("/vps-url", authenticateToken, requireAnyRole(["consultant", "super_admin"]), async (req: AuthRequest, res: Response) => {
  try {
    const consultantId = req.user!.id;
    const { vpsBridgeUrl } = req.body;

    if (vpsBridgeUrl && typeof vpsBridgeUrl !== 'string') {
      return res.status(400).json({ error: "URL non valido" });
    }

    // Check if settings exist
    const existing = await db.execute(sql`
      SELECT id FROM consultant_availability_settings
      WHERE consultant_id = ${consultantId}
      LIMIT 1
    `);

    if (existing.rows.length > 0) {
      await db.execute(sql`
        UPDATE consultant_availability_settings
        SET vps_bridge_url = ${vpsBridgeUrl || null}, updated_at = NOW()
        WHERE consultant_id = ${consultantId}
      `);
    } else {
      await db.execute(sql`
        INSERT INTO consultant_availability_settings (
          id, consultant_id, vps_bridge_url,
          appointment_duration, buffer_before, buffer_after,
          morning_slot_start, morning_slot_end, afternoon_slot_start, afternoon_slot_end,
          max_days_ahead, min_hours_notice, timezone, is_active
        ) VALUES (
          gen_random_uuid(), ${consultantId}, ${vpsBridgeUrl || null},
          60, 15, 15,
          '09:00', '13:00', '14:00', '18:00',
          30, 24, 'Europe/Rome', true
        )
      `);
    }

    console.log(`🌐 [Voice] VPS URL updated for consultant ${consultantId}: ${vpsBridgeUrl}`);
    res.json({ success: true, vpsBridgeUrl });
  } catch (error) {
    console.error("[Voice] Error updating VPS URL:", error);
    res.status(500).json({ error: "Errore nell'aggiornamento dell'URL VPS" });
  }
});

// ═══════════════════════════════════════════════════════════════════
// NON-CLIENT SETTINGS - Configurazione prompt per non-clienti
// ═══════════════════════════════════════════════════════════════════

// Default voice directives template
const DEFAULT_VOICE_DIRECTIVES = `🎙️ MODALITÀ: CHIAMATA VOCALE

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🗣️ TONO E STILE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

- Tono MOLTO ENERGICO e VIVACE! Parla con entusiasmo e carica!
- La tua voce deve trasmettere energia e positività
- Sii entusiasta in modo naturale, come un amico esperto
- Scherza ogni tanto per alleggerire la conversazione

🚫 TONO INFORMALE - REGOLE OBBLIGATORIE:
- USA SEMPRE "Ciao!" - MAI "Buongiorno" o "Buonasera"
- DAI SEMPRE DEL TU - MAI del Lei
- Parla come un AMICO, non come un centralinista
- Esempio CORRETTO: "Ciao! Come posso aiutarti?"
- Esempio SBAGLIATO: "Buongiorno, come posso esserle utile?"`;

// Default non-client prompt template (without voice directives)
const DEFAULT_NON_CLIENT_PROMPT = `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎯 IL TUO RUOLO E IDENTITÀ
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Sei Alessia, l'assistente AI vocale di {{consultantName}}{{businessName}}.
Chi ti chiama NON è un cliente registrato.
Il tuo obiettivo è:
1. Capire chi sta chiamando e cosa cerca
2. Fare una mini-discovery per capire le sue esigenze
3. Se appropriato, proporre un appuntamento con {{consultantName}}

⚠️ LA TUA IDENTITÀ (usa questa frase se ti chiedono chi sei):
"Sono Alessia, l'assistente digitale di {{consultantName}}. Faccio parte del suo team e aiuto i clienti nel loro percorso."

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🚀 COMPORTAMENTO INIZIALE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Quando rispondi, fai un saluto caloroso e chiedi chi è:
- "Ciao! Sono Alessia, l'assistente di {{consultantName}}. Con chi ho il piacere di parlare?"
- "Ehi, ciao! Benvenuto! Dimmi, come ti chiami?"
- "Ciao! Che bello sentirti! Come posso chiamarti?"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔍 MINI-DISCOVERY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Dopo il saluto, fai domande per capire:
1. Come hanno trovato il numero (referral, web, passaparola?)
2. Cosa cercano o di cosa hanno bisogno
3. Se hanno già lavorato con un consulente

Esempi di domande:
- "Come hai trovato il nostro numero?"
- "Raccontami un po', cosa ti ha spinto a chiamare oggi?"
- "C'è qualcosa di specifico su cui vorresti lavorare?"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📅 PROPORRE APPUNTAMENTO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Quando appropriato, proponi di fissare una consulenza:
- "Sai cosa? Mi sembra che potresti beneficiare di una chiacchierata con {{consultantName}}. Che ne dici se fissiamo un appuntamento?"
- "Questo è proprio il tipo di cosa in cui possiamo aiutarti! Ti va di prenotare una consulenza per approfondire?"

Se accettano, chiedi:
- Email per il contatto
- Preferenza di giorno/orario
- Numero di telefono se diverso da quello che stanno usando

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🧠 SEI ANCHE UN'AI GENERALISTA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Puoi rispondere anche a domande generali.
Non devi rifiutarti di aiutare - dai valore anche senza dati specifici!`;

// GET /api/voice/non-client-settings - Get non-client prompt configuration
router.get("/non-client-settings", authenticateToken, requireAnyRole(["consultant", "super_admin"]), async (req: AuthRequest, res: Response) => {
  try {
    const consultantId = req.user?.role === "consultant" ? req.user.id : req.query.consultantId as string;
    
    if (!consultantId) {
      return res.status(400).json({ error: "consultantId required" });
    }

    // Get current settings
    const result = await db.execute(sql`
      SELECT 
        voice_directives,
        non_client_prompt_source,
        non_client_agent_id,
        non_client_manual_prompt
      FROM consultant_availability_settings 
      WHERE consultant_id = ${consultantId}
    `);

    // Get available agents for dropdown (from live_sales_agents table)
    const agentsResult = await db.execute(sql`
      SELECT id, agent_name as name, agent_type as persona, system_prompt_override as prompt, 
             CASE WHEN is_active THEN 'active' ELSE 'inactive' END as status
      FROM live_sales_agents 
      WHERE consultant_id = ${consultantId}
      ORDER BY agent_name ASC
    `);

    const settings = result.rows[0] as any;
    
    res.json({
      voiceDirectives: settings?.voice_directives || DEFAULT_VOICE_DIRECTIVES,
      nonClientPromptSource: settings?.non_client_prompt_source || 'default',
      nonClientAgentId: settings?.non_client_agent_id,
      nonClientManualPrompt: settings?.non_client_manual_prompt || '',
      defaultVoiceDirectives: DEFAULT_VOICE_DIRECTIVES,
      defaultNonClientPrompt: DEFAULT_NON_CLIENT_PROMPT,
      availableAgents: agentsResult.rows
    });
  } catch (error) {
    console.error("[Voice] Error fetching non-client settings:", error);
    res.status(500).json({ error: "Errore nel recupero delle impostazioni" });
  }
});

// PUT /api/voice/non-client-settings - Update non-client prompt configuration
router.put("/non-client-settings", authenticateToken, requireAnyRole(["consultant", "super_admin"]), async (req: AuthRequest, res: Response) => {
  try {
    const consultantId = req.user?.role === "consultant" ? req.user.id : req.body.consultantId;
    
    if (!consultantId) {
      return res.status(400).json({ error: "consultantId required" });
    }

    const { 
      voiceDirectives, 
      nonClientPromptSource, 
      nonClientAgentId, 
      nonClientManualPrompt 
    } = req.body;

    // Validate promptSource
    if (!['agent', 'manual', 'default'].includes(nonClientPromptSource)) {
      return res.status(400).json({ error: "Invalid nonClientPromptSource, must be 'agent', 'manual', or 'default'" });
    }

    // If agent source, validate agentId exists (using live_sales_agents table)
    if (nonClientPromptSource === 'agent' && nonClientAgentId) {
      const agentCheck = await db.execute(sql`
        SELECT id FROM live_sales_agents WHERE id = ${nonClientAgentId} AND consultant_id = ${consultantId}
      `);
      if (agentCheck.rows.length === 0) {
        return res.status(400).json({ error: "Agent not found or does not belong to this consultant" });
      }
    }

    // Update or insert settings
    const existingResult = await db.execute(sql`
      SELECT id FROM consultant_availability_settings WHERE consultant_id = ${consultantId}
    `);

    if (existingResult.rows.length > 0) {
      await db.execute(sql`
        UPDATE consultant_availability_settings 
        SET 
          voice_directives = ${voiceDirectives || null},
          non_client_prompt_source = ${nonClientPromptSource},
          non_client_agent_id = ${nonClientAgentId || null},
          non_client_manual_prompt = ${nonClientManualPrompt || null},
          updated_at = NOW()
        WHERE consultant_id = ${consultantId}
      `);
    } else {
      await db.execute(sql`
        INSERT INTO consultant_availability_settings (
          id, consultant_id, voice_directives, non_client_prompt_source, 
          non_client_agent_id, non_client_manual_prompt, voice_id,
          appointment_duration, buffer_before, buffer_after,
          morning_slot_start, morning_slot_end, afternoon_slot_start, afternoon_slot_end,
          max_days_ahead, min_hours_notice, timezone, is_active
        ) VALUES (
          gen_random_uuid(), ${consultantId}, ${voiceDirectives || null}, ${nonClientPromptSource},
          ${nonClientAgentId || null}, ${nonClientManualPrompt || null}, 'Achernar',
          60, 15, 15,
          '09:00', '13:00', '14:00', '18:00',
          30, 24, 'Europe/Rome', true
        )
      `);
    }

    console.log(`🎤 [Voice] Non-client settings updated for consultant ${consultantId}: source=${nonClientPromptSource}`);
    res.json({ success: true });
  } catch (error) {
    console.error("[Voice] Error updating non-client settings:", error);
    res.status(500).json({ error: "Errore nell'aggiornamento delle impostazioni" });
  }
});

// ═══════════════════════════════════════════════════════════════════
// OUTBOUND CALLS - Chiamate in uscita programmate
// ═══════════════════════════════════════════════════════════════════

// In-memory timer map for scheduled calls (scalable: replace with Redis/Bull later)
const scheduledCallTimers = new Map<string, NodeJS.Timeout>();

// Generate unique ID for scheduled calls
function generateScheduledCallId(): string {
  return `sc_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

// Execute outbound call - contacts VPS to initiate call
async function executeOutboundCall(callId: string, consultantId: string): Promise<{ success: boolean; error?: string }> {
  try {
    // Get call details from DB
    const callResult = await db.execute(sql`
      SELECT * FROM scheduled_voice_calls WHERE id = ${callId}
    `);
    
    if (callResult.rows.length === 0) {
      return { success: false, error: "Call not found" };
    }
    
    const call = callResult.rows[0] as any;
    
    if (call.status === 'cancelled' || call.status === 'completed') {
      return { success: false, error: `Call already ${call.status}` };
    }
    
    // Update status to 'calling'
    await db.execute(sql`
      UPDATE scheduled_voice_calls 
      SET status = 'calling', 
          attempts = attempts + 1,
          last_attempt_at = NOW(),
          updated_at = NOW()
      WHERE id = ${callId}
    `);
    
    // Get VPS URL from database or environment variable
    const vpsResult = await db.execute(sql`
      SELECT vps_bridge_url FROM consultant_availability_settings 
      WHERE consultant_id = ${consultantId}
    `);
    const vpsUrl = (vpsResult.rows[0] as any)?.vps_bridge_url || process.env.VPS_BRIDGE_URL;
    if (!vpsUrl) {
      await db.execute(sql`
        UPDATE scheduled_voice_calls 
        SET status = 'failed', error_message = 'VPS URL not configured', updated_at = NOW()
        WHERE id = ${callId}
      `);
      return { success: false, error: "VPS URL not configured. Set it in Voice Settings → VPS tab" };
    }
    
    // Get service token
    const tokenResult = await db.execute(sql`
      SELECT token FROM voice_service_tokens 
      WHERE consultant_id = ${consultantId} AND revoked_at IS NULL
      ORDER BY created_at DESC LIMIT 1
    `);
    
    const token = (tokenResult.rows[0] as any)?.token;
    if (!token) {
      await db.execute(sql`
        UPDATE scheduled_voice_calls 
        SET status = 'failed', error_message = 'No service token', updated_at = NOW()
        WHERE id = ${callId}
      `);
      return { success: false, error: "No service token configured" };
    }
    
    // Call VPS outbound endpoint
    const outboundUrl = `${vpsUrl.replace(/\/$/, '')}/outbound/call`;
    console.log(`📞 [Outbound] Calling VPS: ${outboundUrl} for ${call.target_phone}`);
    
    const response = await fetch(outboundUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        targetPhone: call.target_phone,
        callId: callId,
        aiMode: call.ai_mode,
        customPrompt: call.custom_prompt
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`VPS error: ${response.status} - ${errorText}`);
    }
    
    const result = await response.json();
    console.log(`✅ [Outbound] VPS accepted call:`, result);
    
    return { success: true };
  } catch (error: any) {
    console.error(`❌ [Outbound] Failed to execute call ${callId}:`, error);
    
    // Check if should retry
    const callResult = await db.execute(sql`
      SELECT attempts, max_attempts FROM scheduled_voice_calls WHERE id = ${callId}
    `);
    const call = callResult.rows[0] as any;
    
    if (call && call.attempts < call.max_attempts) {
      // Schedule retry with exponential backoff
      const retryDelayMs = Math.min(60000 * Math.pow(2, call.attempts - 1), 900000); // 1min, 2min, 4min... max 15min
      
      await db.execute(sql`
        UPDATE scheduled_voice_calls 
        SET status = 'pending', 
            scheduled_at = NOW() + INTERVAL '${sql.raw(String(retryDelayMs / 1000))} seconds',
            error_message = ${error.message},
            updated_at = NOW()
        WHERE id = ${callId}
      `);
      
      // Set timer for retry
      const timer = setTimeout(() => executeOutboundCall(callId, consultantId), retryDelayMs);
      scheduledCallTimers.set(callId, timer);
      
      return { success: false, error: `Retry scheduled in ${retryDelayMs / 1000}s` };
    } else {
      // Max attempts reached
      await db.execute(sql`
        UPDATE scheduled_voice_calls 
        SET status = 'failed', error_message = ${error.message}, updated_at = NOW()
        WHERE id = ${callId}
      `);
      return { success: false, error: error.message };
    }
  }
}

// Schedule a call timer
function scheduleCallTimer(callId: string, consultantId: string, scheduledAt: Date): void {
  const now = new Date();
  const delayMs = scheduledAt.getTime() - now.getTime();
  
  if (delayMs <= 0) {
    // Execute immediately
    executeOutboundCall(callId, consultantId);
  } else {
    // Schedule for later
    const timer = setTimeout(() => {
      scheduledCallTimers.delete(callId);
      executeOutboundCall(callId, consultantId);
    }, delayMs);
    scheduledCallTimers.set(callId, timer);
    console.log(`⏰ [Outbound] Scheduled call ${callId} for ${scheduledAt.toISOString()} (in ${Math.round(delayMs / 1000)}s)`);
  }
}

// Cancel a scheduled timer
function cancelCallTimer(callId: string): void {
  const timer = scheduledCallTimers.get(callId);
  if (timer) {
    clearTimeout(timer);
    scheduledCallTimers.delete(callId);
    console.log(`🚫 [Outbound] Cancelled timer for ${callId}`);
  }
}

// POST /api/voice/outbound/trigger - Chiamata immediata
router.post("/outbound/trigger", authenticateToken, requireAnyRole(["consultant", "super_admin"]), async (req: AuthRequest, res: Response) => {
  try {
    const consultantId = req.user?.id;
    if (!consultantId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    
    const { targetPhone, aiMode = "assistenza", customPrompt } = req.body;
    
    if (!targetPhone) {
      return res.status(400).json({ error: "targetPhone is required" });
    }
    
    // Validate phone format (E.164 or internal extension)
    const cleanPhone = targetPhone.replace(/[\s\-\(\)]/g, '');
    // Accept: internal extensions (3-6 digits) OR international numbers (7-15 digits with optional +)
    if (!/^(\+?[1-9]\d{6,14}|\d{3,6})$/.test(cleanPhone)) {
      return res.status(400).json({ error: "Invalid phone number format. Use extension (1000) or international (+393331234567)" });
    }
    
    const callId = generateScheduledCallId();
    
    // Create record in DB
    await db.execute(sql`
      INSERT INTO scheduled_voice_calls (
        id, consultant_id, target_phone, scheduled_at, status, ai_mode, custom_prompt
      ) VALUES (
        ${callId}, ${consultantId}, ${cleanPhone}, NOW(), 'calling', ${aiMode}, ${customPrompt || null}
      )
    `);
    
    console.log(`📞 [Outbound] Trigger immediate call ${callId} to ${cleanPhone}`);
    
    // Execute call asynchronously
    executeOutboundCall(callId, consultantId).then(result => {
      if (!result.success) {
        console.error(`[Outbound] Call ${callId} failed:`, result.error);
      }
    });
    
    res.json({
      success: true,
      callId,
      message: "Chiamata in corso...",
      targetPhone: cleanPhone
    });
  } catch (error: any) {
    console.error("[Outbound] Trigger error:", error);
    res.status(500).json({ error: "Errore nell'avvio della chiamata" });
  }
});

// POST /api/voice/outbound/schedule - Programma chiamata futura
router.post("/outbound/schedule", authenticateToken, requireAnyRole(["consultant", "super_admin"]), async (req: AuthRequest, res: Response) => {
  try {
    const consultantId = req.user?.id;
    if (!consultantId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    
    const { targetPhone, scheduledAt, aiMode = "assistenza", customPrompt, priority = 5 } = req.body;
    
    if (!targetPhone || !scheduledAt) {
      return res.status(400).json({ error: "targetPhone and scheduledAt are required" });
    }
    
    // Validate phone format (E.164 or internal extension)
    const cleanPhone = targetPhone.replace(/[\s\-\(\)]/g, '');
    // Accept: internal extensions (3-6 digits) OR international numbers (7-15 digits with optional +)
    if (!/^(\+?[1-9]\d{6,14}|\d{3,6})$/.test(cleanPhone)) {
      return res.status(400).json({ error: "Invalid phone number format. Use extension (1000) or international (+393331234567)" });
    }
    
    const scheduledDate = new Date(scheduledAt);
    if (isNaN(scheduledDate.getTime())) {
      return res.status(400).json({ error: "Invalid scheduledAt date" });
    }
    
    if (scheduledDate <= new Date()) {
      return res.status(400).json({ error: "scheduledAt must be in the future" });
    }
    
    const callId = generateScheduledCallId();
    
    // Create record in DB
    await db.execute(sql`
      INSERT INTO scheduled_voice_calls (
        id, consultant_id, target_phone, scheduled_at, status, ai_mode, custom_prompt, priority
      ) VALUES (
        ${callId}, ${consultantId}, ${cleanPhone}, ${scheduledDate.toISOString()}, 'pending', ${aiMode}, ${customPrompt || null}, ${priority}
      )
    `);
    
    // Schedule timer
    scheduleCallTimer(callId, consultantId, scheduledDate);
    
    console.log(`📅 [Outbound] Scheduled call ${callId} to ${cleanPhone} at ${scheduledDate.toISOString()}`);
    
    res.json({
      success: true,
      callId,
      scheduledAt: scheduledDate.toISOString(),
      targetPhone: cleanPhone
    });
  } catch (error: any) {
    console.error("[Outbound] Schedule error:", error);
    res.status(500).json({ error: "Errore nella programmazione della chiamata" });
  }
});

// GET /api/voice/outbound/scheduled - Lista chiamate programmate
router.get("/outbound/scheduled", authenticateToken, requireAnyRole(["consultant", "super_admin"]), async (req: AuthRequest, res: Response) => {
  try {
    const consultantId = req.user?.role === "super_admin" ? undefined : req.user?.id;
    const { status } = req.query;
    
    let whereConditions = [];
    if (consultantId) {
      whereConditions.push(sql`consultant_id = ${consultantId}`);
    }
    if (status) {
      whereConditions.push(sql`status = ${status}`);
    }
    
    const whereClause = whereConditions.length > 0 
      ? sql`WHERE ${sql.join(whereConditions, sql` AND `)}`
      : sql``;
    
    const result = await db.execute(sql`
      SELECT * FROM scheduled_voice_calls
      ${whereClause}
      ORDER BY 
        CASE WHEN status = 'pending' THEN 0 ELSE 1 END,
        scheduled_at ASC
    `);
    
    res.json({
      calls: result.rows,
      count: result.rows.length,
      activeTimers: scheduledCallTimers.size
    });
  } catch (error: any) {
    console.error("[Outbound] List error:", error);
    res.status(500).json({ error: "Errore nel recupero delle chiamate programmate" });
  }
});

// DELETE /api/voice/outbound/:id - Cancella chiamata programmata
router.delete("/outbound/:id", authenticateToken, requireAnyRole(["consultant", "super_admin"]), async (req: AuthRequest, res: Response) => {
  try {
    const consultantId = req.user?.role === "super_admin" ? undefined : req.user?.id;
    const { id } = req.params;
    
    // Check ownership
    let whereClause = sql`WHERE id = ${id}`;
    if (consultantId) {
      whereClause = sql`WHERE id = ${id} AND consultant_id = ${consultantId}`;
    }
    
    const existing = await db.execute(sql`
      SELECT status FROM scheduled_voice_calls ${whereClause}
    `);
    
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: "Chiamata non trovata" });
    }
    
    const call = existing.rows[0] as any;
    if (call.status === 'calling' || call.status === 'talking') {
      return res.status(400).json({ error: "Impossibile cancellare una chiamata in corso" });
    }
    
    // Cancel timer if exists
    cancelCallTimer(id);
    
    // Update status
    await db.execute(sql`
      UPDATE scheduled_voice_calls 
      SET status = 'cancelled', updated_at = NOW()
      WHERE id = ${id}
    `);
    
    console.log(`🚫 [Outbound] Cancelled call ${id}`);
    
    res.json({ success: true, message: "Chiamata cancellata" });
  } catch (error: any) {
    console.error("[Outbound] Cancel error:", error);
    res.status(500).json({ error: "Errore nella cancellazione" });
  }
});

// Reload pending calls on server restart
async function reloadPendingCalls(): Promise<void> {
  try {
    const result = await db.execute(sql`
      SELECT sc.id, sc.consultant_id, sc.scheduled_at 
      FROM scheduled_voice_calls sc
      WHERE sc.status = 'pending' AND sc.scheduled_at IS NOT NULL
    `);
    
    for (const call of result.rows as any[]) {
      const scheduledAt = new Date(call.scheduled_at);
      scheduleCallTimer(call.id, call.consultant_id, scheduledAt);
    }
    
    console.log(`🔄 [Outbound] Reloaded ${result.rows.length} pending calls`);
  } catch (error) {
    console.error("[Outbound] Failed to reload pending calls:", error);
  }
}

// Call reload on module load (deferred to avoid blocking)
setTimeout(() => reloadPendingCalls(), 5000);

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
