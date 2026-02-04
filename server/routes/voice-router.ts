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
import { consultantAvailabilitySettings, users } from "@shared/schema";
import { getActiveVoiceCallsForConsultant } from "../ai/gemini-live-ws-service";
import { getTemplateOptions, getTemplateById, INBOUND_TEMPLATES, OUTBOUND_TEMPLATES } from '../voice/voice-templates';

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
      SELECT voice_id, vps_bridge_url, voice_max_retry_attempts, voice_retry_interval_minutes 
      FROM consultant_availability_settings
      WHERE consultant_id = ${consultantId}
      LIMIT 1
    `);

    const row = result.rows[0] as any;
    const voiceId = row?.voice_id || 'achernar';
    const vpsBridgeUrl = row?.vps_bridge_url || '';
    const voiceMaxRetryAttempts = row?.voice_max_retry_attempts ?? 3;
    const voiceRetryIntervalMinutes = row?.voice_retry_interval_minutes ?? 5;

    res.json({ voiceId, vpsBridgeUrl, voiceMaxRetryAttempts, voiceRetryIntervalMinutes });
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

// PUT /api/voice/retry-settings - Aggiorna impostazioni retry chiamate in uscita
router.put("/retry-settings", authenticateToken, requireAnyRole(["consultant", "super_admin"]), async (req: AuthRequest, res: Response) => {
  try {
    const consultantId = req.user!.id;
    const { voiceMaxRetryAttempts, voiceRetryIntervalMinutes } = req.body;

    // Validate inputs
    const maxRetry = Math.max(1, Math.min(5, parseInt(voiceMaxRetryAttempts) || 3));
    const retryInterval = Math.max(1, Math.min(30, parseInt(voiceRetryIntervalMinutes) || 5));

    // Check if settings exist
    const existing = await db.execute(sql`
      SELECT id FROM consultant_availability_settings
      WHERE consultant_id = ${consultantId}
      LIMIT 1
    `);

    if (existing.rows.length > 0) {
      await db.execute(sql`
        UPDATE consultant_availability_settings
        SET voice_max_retry_attempts = ${maxRetry}, 
            voice_retry_interval_minutes = ${retryInterval},
            updated_at = NOW()
        WHERE consultant_id = ${consultantId}
      `);
    } else {
      await db.execute(sql`
        INSERT INTO consultant_availability_settings (
          id, consultant_id, voice_max_retry_attempts, voice_retry_interval_minutes,
          appointment_duration, buffer_before, buffer_after,
          morning_slot_start, morning_slot_end, afternoon_slot_start, afternoon_slot_end,
          max_days_ahead, min_hours_notice, timezone, is_active
        ) VALUES (
          gen_random_uuid(), ${consultantId}, ${maxRetry}, ${retryInterval},
          60, 15, 15,
          '09:00', '13:00', '14:00', '18:00',
          30, 24, 'Europe/Rome', true
        )
      `);
    }

    console.log(`🔄 [Voice] Retry settings updated for consultant ${consultantId}: max=${maxRetry}, interval=${retryInterval}min`);
    res.json({ success: true, voiceMaxRetryAttempts: maxRetry, voiceRetryIntervalMinutes: retryInterval });
  } catch (error) {
    console.error("[Voice] Error updating retry settings:", error);
    res.status(500).json({ error: "Errore nell'aggiornamento delle impostazioni retry" });
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

// Default voice directives template - using Google's Director's Notes framework
const DEFAULT_VOICE_DIRECTIVES = `🎙️ MODALITÀ: CHIAMATA VOCALE

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎬 DIRECTOR'S NOTES - MANTENERE ENERGIA TUTTA LA CHIAMATA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🎭 LA SCENA:
Sei in piedi in uno studio luminoso, ti muovi con energia.
C'è musica di sottofondo che ti carica.
Hai appena bevuto un caffè e sei al massimo dell'energia!

🎤 STILE VOCALE - "Vocal Smile":
- FAI SENTIRE IL SORRISO in ogni parola!
- Consonanti PUNCHY e decise
- Allunga le vocali sulle parole di entusiasmo ("Fantasticooo!")
- Tono ALTO e luminoso, mai monotono
- Proiezione alta senza urlare

⚡ ENERGIA - "Infectious Enthusiasm":
- Entusiasmo CONTAGIOSO dall'inizio alla fine
- Bouncing with energy - come se stessi saltellando!
- NON calare MAI il tono durante la conversazione
- Ogni risposta deve avere la STESSA carica della prima

🎵 RITMO:
- Pacing VELOCE ed energico
- Transizioni rapide tra argomenti
- Pause brevi e incisive, mai lunghe e noiose

🚫 TONO INFORMALE - REGOLE OBBLIGATORIE:
- USA SEMPRE "Ciao!" - MAI "Buongiorno" o "Buonasera"
- DAI SEMPRE DEL TU - MAI del Lei
- Parla come un AMICO carico di energia!

📏 LUNGHEZZA RISPOSTE - ADATTATI ALLA RICHIESTA:
- Se l'utente dice "parla tanto", "spiegami meglio", "dimmi di più", "vai nel dettaglio":
  → PARLA A LUNGO! Fai spiegazioni complete e approfondite (anche 2-3 minuti)
  → Non fermarti dopo 2 frasi, continua con esempi, dettagli, storie
- Se l'utente fa una domanda breve o vuole una risposta rapida:
  → Rispondi in modo più conciso
- REGOLA D'ORO: Dai all'utente quello che chiede!`;

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

    // Get current settings including inbound/outbound specific fields
    const result = await db.execute(sql`
      SELECT 
        voice_directives,
        non_client_prompt_source,
        non_client_agent_id,
        non_client_manual_prompt,
        inbound_prompt_source,
        inbound_template_id,
        inbound_agent_id,
        inbound_manual_prompt,
        inbound_brand_voice_enabled,
        inbound_brand_voice_agent_id,
        outbound_prompt_source,
        outbound_template_id,
        outbound_agent_id,
        outbound_manual_prompt,
        outbound_brand_voice_enabled,
        outbound_brand_voice_agent_id
      FROM consultant_availability_settings 
      WHERE consultant_id = ${consultantId}
    `);

    // Get available agents for dropdown with full Brand Voice data
    const agentsResult = await db.execute(sql`
      SELECT id, 
             COALESCE(agent_name, business_name) as name, 
             agent_type as persona, 
             agent_instructions,
             business_name,
             business_description,
             consultant_bio,
             vision,
             mission,
             values,
             usp,
             who_we_help,
             who_we_dont_help,
             what_we_do,
             how_we_do_it,
             years_experience,
             clients_helped,
             results_generated,
             services_offered,
             guarantees,
             ai_personality,
             CASE WHEN is_active THEN 'active' ELSE 'inactive' END as status
      FROM consultant_whatsapp_config 
      WHERE consultant_id = ${consultantId}
      ORDER BY COALESCE(agent_name, business_name) ASC
    `);

    const settings = result.rows[0] as any;
    
    // Build full prompt preview for each agent (including Brand Voice)
    const agentsWithFullPrompt = agentsResult.rows.map((agent: any) => {
      let fullPrompt = agent.agent_instructions || '';
      
      // Build Brand Voice section
      let brandVoice = '';
      
      if (agent.business_name) {
        brandVoice += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n🏢 BUSINESS & IDENTITÀ\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
        brandVoice += `• Business: ${agent.business_name}\n`;
        if (agent.business_description) brandVoice += `• Descrizione: ${agent.business_description}\n`;
        if (agent.consultant_bio) brandVoice += `• Bio: ${agent.consultant_bio}\n`;
      }
      
      if (agent.vision || agent.mission || agent.usp) {
        brandVoice += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n🎯 POSIZIONAMENTO\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
        if (agent.vision) brandVoice += `• Vision: ${agent.vision}\n`;
        if (agent.mission) brandVoice += `• Mission: ${agent.mission}\n`;
        const valuesArray = Array.isArray(agent.values) ? agent.values : (typeof agent.values === 'string' ? JSON.parse(agent.values || '[]') : []);
        if (valuesArray.length > 0) brandVoice += `• Valori: ${valuesArray.join(', ')}\n`;
        if (agent.usp) brandVoice += `• USP: ${agent.usp}\n`;
      }
      
      if (agent.who_we_help || agent.who_we_dont_help) {
        brandVoice += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n👥 TARGET\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
        if (agent.who_we_help) brandVoice += `• Chi aiutiamo: ${agent.who_we_help}\n`;
        if (agent.who_we_dont_help) brandVoice += `• Chi NON aiutiamo: ${agent.who_we_dont_help}\n`;
      }
      
      if (agent.what_we_do || agent.how_we_do_it) {
        brandVoice += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n🔧 METODO\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
        if (agent.what_we_do) brandVoice += `• Cosa facciamo: ${agent.what_we_do}\n`;
        if (agent.how_we_do_it) brandVoice += `• Come lo facciamo: ${agent.how_we_do_it}\n`;
      }
      
      if (agent.years_experience || agent.clients_helped || agent.results_generated) {
        brandVoice += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n🏆 CREDENZIALI\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
        if (agent.years_experience) brandVoice += `• Anni di esperienza: ${agent.years_experience}\n`;
        if (agent.clients_helped) brandVoice += `• Clienti aiutati: ${agent.clients_helped}\n`;
        if (agent.results_generated) brandVoice += `• Risultati: ${agent.results_generated}\n`;
      }
      
      const servicesArray = Array.isArray(agent.services_offered) ? agent.services_offered : (typeof agent.services_offered === 'string' ? JSON.parse(agent.services_offered || '[]') : []);
      if (servicesArray.length > 0 || agent.guarantees) {
        brandVoice += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n💼 SERVIZI\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
        for (const service of servicesArray) {
          if (service.name) {
            brandVoice += `• ${service.name}${service.price ? ` (${service.price})` : ''}\n`;
            if (service.description) brandVoice += `  ${service.description}\n`;
          }
        }
        if (agent.guarantees) brandVoice += `• Garanzie: ${agent.guarantees}\n`;
      }
      
      if (agent.ai_personality) {
        brandVoice += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n🤖 PERSONALITÀ AI\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
        brandVoice += agent.ai_personality + '\n';
      }
      
      // Combine instructions (PRIORITY) + Brand Voice (supplementary)
      if (fullPrompt && brandVoice) {
        fullPrompt = `⚡ ISTRUZIONI PRINCIPALI (PRIORITÀ ASSOLUTA)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${fullPrompt}

📋 CONTESTO SUPPLEMENTARE (informazioni di supporto)
${brandVoice}`;
      } else if (brandVoice && !fullPrompt) {
        fullPrompt = brandVoice;
      }
      
      return {
        id: agent.id,
        name: agent.name,
        persona: agent.persona,
        prompt: fullPrompt || '(Nessun prompt configurato)',
        status: agent.status
      };
    });
    
    res.json({
      voiceDirectives: settings?.voice_directives || DEFAULT_VOICE_DIRECTIVES,
      nonClientPromptSource: settings?.non_client_prompt_source || 'default',
      nonClientAgentId: settings?.non_client_agent_id,
      nonClientManualPrompt: settings?.non_client_manual_prompt || '',
      inboundPromptSource: settings?.inbound_prompt_source || 'template',
      inboundTemplateId: settings?.inbound_template_id || 'mini-discovery',
      inboundAgentId: settings?.inbound_agent_id,
      inboundManualPrompt: settings?.inbound_manual_prompt || '',
      inboundBrandVoiceEnabled: settings?.inbound_brand_voice_enabled || false,
      inboundBrandVoiceAgentId: settings?.inbound_brand_voice_agent_id || null,
      outboundPromptSource: settings?.outbound_prompt_source || 'template',
      outboundTemplateId: settings?.outbound_template_id || 'sales-orbitale',
      outboundAgentId: settings?.outbound_agent_id,
      outboundManualPrompt: settings?.outbound_manual_prompt || '',
      outboundBrandVoiceEnabled: settings?.outbound_brand_voice_enabled || false,
      outboundBrandVoiceAgentId: settings?.outbound_brand_voice_agent_id || null,
      defaultVoiceDirectives: DEFAULT_VOICE_DIRECTIVES,
      defaultNonClientPrompt: DEFAULT_NON_CLIENT_PROMPT,
      availableInboundTemplates: getTemplateOptions('inbound'),
      availableOutboundTemplates: getTemplateOptions('outbound'),
      agents: agentsWithFullPrompt,
      availableAgents: agentsWithFullPrompt // Legacy field for backwards compatibility
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
      inboundPromptSource,
      inboundTemplateId,
      inboundAgentId,
      inboundManualPrompt,
      inboundBrandVoiceEnabled,
      inboundBrandVoiceAgentId,
      outboundPromptSource,
      outboundTemplateId,
      outboundAgentId,
      outboundManualPrompt,
      outboundBrandVoiceEnabled,
      outboundBrandVoiceAgentId
    } = req.body;

    // Validate inbound promptSource
    if (inboundPromptSource && !['template', 'agent', 'manual'].includes(inboundPromptSource)) {
      return res.status(400).json({ error: "Invalid inboundPromptSource, must be 'template', 'agent', or 'manual'" });
    }

    // Validate outbound promptSource
    if (outboundPromptSource && !['template', 'agent', 'manual'].includes(outboundPromptSource)) {
      return res.status(400).json({ error: "Invalid outboundPromptSource, must be 'template', 'agent', or 'manual'" });
    }

    // If inbound agent source, validate agentId exists
    if (inboundPromptSource === 'agent' && inboundAgentId) {
      const agentCheck = await db.execute(sql`
        SELECT id FROM consultant_whatsapp_config WHERE id = ${inboundAgentId} AND consultant_id = ${consultantId}
      `);
      if (agentCheck.rows.length === 0) {
        return res.status(400).json({ error: "Inbound agent not found or does not belong to this consultant" });
      }
    }

    // If outbound agent source, validate agentId exists
    if (outboundPromptSource === 'agent' && outboundAgentId) {
      const agentCheck = await db.execute(sql`
        SELECT id FROM consultant_whatsapp_config WHERE id = ${outboundAgentId} AND consultant_id = ${consultantId}
      `);
      if (agentCheck.rows.length === 0) {
        return res.status(400).json({ error: "Outbound agent not found or does not belong to this consultant" });
      }
    }

    // If template source, validate template exists
    if (inboundPromptSource === 'template' && inboundTemplateId) {
      if (!INBOUND_TEMPLATES[inboundTemplateId]) {
        return res.status(400).json({ error: `Invalid inbound template ID: ${inboundTemplateId}` });
      }
    }

    if (outboundPromptSource === 'template' && outboundTemplateId) {
      if (!OUTBOUND_TEMPLATES[outboundTemplateId]) {
        return res.status(400).json({ error: `Invalid outbound template ID: ${outboundTemplateId}` });
      }
    }

    // Derive legacy fields from inbound settings for backwards compatibility
    const legacyPromptSource = inboundPromptSource === 'template' ? 'default' : inboundPromptSource;
    const legacyAgentId = inboundAgentId;
    const legacyManualPrompt = inboundManualPrompt;

    // Update or insert settings
    const existingResult = await db.execute(sql`
      SELECT id FROM consultant_availability_settings WHERE consultant_id = ${consultantId}
    `);

    if (existingResult.rows.length > 0) {
      await db.execute(sql`
        UPDATE consultant_availability_settings 
        SET 
          voice_directives = ${voiceDirectives || null},
          inbound_prompt_source = ${inboundPromptSource || 'template'},
          inbound_template_id = ${inboundTemplateId || null},
          inbound_agent_id = ${inboundAgentId || null},
          inbound_manual_prompt = ${inboundManualPrompt || null},
          inbound_brand_voice_enabled = ${inboundBrandVoiceEnabled || false},
          inbound_brand_voice_agent_id = ${inboundBrandVoiceAgentId || null},
          outbound_prompt_source = ${outboundPromptSource || 'template'},
          outbound_template_id = ${outboundTemplateId || null},
          outbound_agent_id = ${outboundAgentId || null},
          outbound_manual_prompt = ${outboundManualPrompt || null},
          outbound_brand_voice_enabled = ${outboundBrandVoiceEnabled || false},
          outbound_brand_voice_agent_id = ${outboundBrandVoiceAgentId || null},
          non_client_prompt_source = ${legacyPromptSource || 'default'},
          non_client_agent_id = ${legacyAgentId || null},
          non_client_manual_prompt = ${legacyManualPrompt || null},
          updated_at = NOW()
        WHERE consultant_id = ${consultantId}
      `);
    } else {
      await db.execute(sql`
        INSERT INTO consultant_availability_settings (
          id, consultant_id, voice_directives,
          inbound_prompt_source, inbound_template_id, inbound_agent_id, inbound_manual_prompt,
          inbound_brand_voice_enabled, inbound_brand_voice_agent_id,
          outbound_prompt_source, outbound_template_id, outbound_agent_id, outbound_manual_prompt,
          outbound_brand_voice_enabled, outbound_brand_voice_agent_id,
          non_client_prompt_source, non_client_agent_id, non_client_manual_prompt,
          voice_id, appointment_duration, buffer_before, buffer_after,
          morning_slot_start, morning_slot_end, afternoon_slot_start, afternoon_slot_end,
          max_days_ahead, min_hours_notice, timezone, is_active
        ) VALUES (
          gen_random_uuid(), ${consultantId}, ${voiceDirectives || null},
          ${inboundPromptSource || 'template'}, ${inboundTemplateId || 'mini-discovery'}, ${inboundAgentId || null}, ${inboundManualPrompt || null},
          ${inboundBrandVoiceEnabled || false}, ${inboundBrandVoiceAgentId || null},
          ${outboundPromptSource || 'template'}, ${outboundTemplateId || 'sales-orbitale'}, ${outboundAgentId || null}, ${outboundManualPrompt || null},
          ${outboundBrandVoiceEnabled || false}, ${outboundBrandVoiceAgentId || null},
          ${legacyPromptSource || 'default'}, ${legacyAgentId || null}, ${legacyManualPrompt || null},
          'Achernar', 60, 15, 15,
          '09:00', '13:00', '14:00', '18:00',
          30, 24, 'Europe/Rome', true
        )
      `);
    }

    console.log(`🎤 [Voice] Non-client settings updated for consultant ${consultantId}: inbound=${inboundPromptSource}, outbound=${outboundPromptSource}`);
    res.json({ success: true });
  } catch (error) {
    console.error("[Voice] Error updating non-client settings:", error);
    res.status(500).json({ error: "Errore nell'aggiornamento delle impostazioni" });
  }
});

// DELETE /api/voice/non-client-history - Delete call history for non-clients (for testing)
router.delete("/non-client-history", authenticateToken, requireAnyRole(["consultant", "super_admin"]), async (req: AuthRequest, res: Response) => {
  try {
    const consultantId = req.user?.role === "consultant" ? req.user.id : req.query.consultantId as string;
    
    if (!consultantId) {
      return res.status(400).json({ error: "consultantId required" });
    }

    // Delete all voice calls for this consultant where client_id is NULL (non-clients)
    const result = await db.execute(sql`
      DELETE FROM voice_calls 
      WHERE consultant_id = ${consultantId} 
        AND client_id IS NULL
      RETURNING id
    `);

    const deletedCount = result.rows.length;
    console.log(`🗑️ [Voice] Deleted ${deletedCount} non-client call records for consultant ${consultantId}`);
    
    res.json({ 
      success: true, 
      deletedCount,
      message: `Cancellate ${deletedCount} chiamate di non-clienti` 
    });
  } catch (error) {
    console.error("[Voice] Error deleting non-client history:", error);
    res.status(500).json({ error: "Errore nella cancellazione dello storico" });
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
    
    // 🔍 DEBUG: Log the FULL payload being sent to VPS
    const vpsPayload = {
      targetPhone: call.target_phone,
      callId: callId,
      aiMode: call.ai_mode,
      customPrompt: call.custom_prompt,
      callInstruction: call.call_instruction,
      instructionType: call.instruction_type,
      useDefaultTemplate: call.use_default_template
    };
    console.log(`📋 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`📋 [Outbound] FULL VPS PAYLOAD:`);
    console.log(`📋   targetPhone: ${vpsPayload.targetPhone}`);
    console.log(`📋   callId: ${vpsPayload.callId}`);
    console.log(`📋   aiMode: ${vpsPayload.aiMode}`);
    console.log(`📋   customPrompt: ${vpsPayload.customPrompt ? vpsPayload.customPrompt.substring(0, 100) + '...' : 'null'}`);
    console.log(`📋   callInstruction: ${vpsPayload.callInstruction || 'null'}`);
    console.log(`📋   instructionType: ${vpsPayload.instructionType || 'null'}`);
    console.log(`📋   useDefaultTemplate: ${vpsPayload.useDefaultTemplate}`);
    console.log(`📋 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    
    const response = await fetch(outboundUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(vpsPayload)
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
    
    const { targetPhone, aiMode = "assistenza", customPrompt, callInstruction, instructionType, useDefaultTemplate } = req.body;
    
    if (!targetPhone) {
      return res.status(400).json({ error: "targetPhone is required" });
    }
    
    // Validate instruction_type if provided
    if (instructionType && !['task', 'reminder'].includes(instructionType)) {
      return res.status(400).json({ error: "instructionType must be 'task' or 'reminder'" });
    }
    
    // Validate phone format (E.164 or internal extension)
    const cleanPhone = targetPhone.replace(/[\s\-\(\)]/g, '');
    // Accept: internal extensions (3-6 digits) OR international numbers (7-15 digits with optional +)
    if (!/^(\+?[1-9]\d{6,14}|\d{3,6})$/.test(cleanPhone)) {
      return res.status(400).json({ error: "Invalid phone number format. Use extension (1000) or international (+393331234567)" });
    }
    
    const callId = generateScheduledCallId();
    
    // Get consultant retry config
    const configResult = await db.execute(sql`
      SELECT voice_max_retry_attempts FROM consultant_availability_settings 
      WHERE consultant_id = ${consultantId}
    `);
    const maxAttempts = (configResult.rows[0] as any)?.voice_max_retry_attempts || 3;
    
    // Create record in DB with instruction fields
    // When task/reminder is set, use_default_template forces base template (ignores agent prompt)
    await db.execute(sql`
      INSERT INTO scheduled_voice_calls (
        id, consultant_id, target_phone, scheduled_at, status, ai_mode, custom_prompt, call_instruction, instruction_type, use_default_template, max_attempts
      ) VALUES (
        ${callId}, ${consultantId}, ${cleanPhone}, NOW(), 'calling', ${aiMode}, ${customPrompt || null}, ${callInstruction || null}, ${instructionType || null}, ${useDefaultTemplate || false}, ${maxAttempts}
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
    
    const { targetPhone, scheduledAt, aiMode = "assistenza", customPrompt, priority = 5, callInstruction, instructionType, useDefaultTemplate } = req.body;
    
    if (!targetPhone || !scheduledAt) {
      return res.status(400).json({ error: "targetPhone and scheduledAt are required" });
    }
    
    // Validate instruction_type if provided
    if (instructionType && !['task', 'reminder'].includes(instructionType)) {
      return res.status(400).json({ error: "instructionType must be 'task' or 'reminder'" });
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
    
    // Get consultant retry config
    const configResult = await db.execute(sql`
      SELECT voice_max_retry_attempts FROM consultant_availability_settings 
      WHERE consultant_id = ${consultantId}
    `);
    const maxAttempts = (configResult.rows[0] as any)?.voice_max_retry_attempts || 3;
    
    // Create record in DB with instruction fields
    // When task/reminder is set, use_default_template forces base template (ignores agent prompt)
    await db.execute(sql`
      INSERT INTO scheduled_voice_calls (
        id, consultant_id, target_phone, scheduled_at, status, ai_mode, custom_prompt, priority, call_instruction, instruction_type, use_default_template, max_attempts
      ) VALUES (
        ${callId}, ${consultantId}, ${cleanPhone}, ${scheduledDate.toISOString()}, 'pending', ${aiMode}, ${customPrompt || null}, ${priority}, ${callInstruction || null}, ${instructionType || null}, ${useDefaultTemplate || false}, ${maxAttempts}
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

// GET /api/voice/clients-with-phone - Lista clienti con telefono (attivi/inattivi)
router.get("/clients-with-phone", authenticateToken, requireAnyRole(["consultant", "super_admin"]), async (req: AuthRequest, res: Response) => {
  try {
    const consultantId = req.user?.id;
    if (!consultantId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Recupera tutti gli utenti che hanno questo consulente come riferimento
    // (indipendentemente dal ruolo, perché un consultant può essere cliente di un altro consultant)
    const allClients = await db.select({
      id: users.id,
      firstName: users.firstName,
      lastName: users.lastName,
      phoneNumber: users.phoneNumber,
      isActive: users.isActive,
      enrolledAt: users.enrolledAt,
    })
    .from(users)
    .where(eq(users.consultantId, consultantId))
    .orderBy(desc(users.enrolledAt));

    // Separa clienti attivi e inattivi
    const active = allClients
      .filter(c => c.isActive !== false)
      .map(c => ({
        id: c.id,
        firstName: c.firstName || "",
        lastName: c.lastName || "",
        phoneNumber: c.phoneNumber || "",
        lastContact: c.enrolledAt?.toISOString() || null,
      }));

    const inactive = allClients
      .filter(c => c.isActive === false)
      .map(c => ({
        id: c.id,
        firstName: c.firstName || "",
        lastName: c.lastName || "",
        phoneNumber: c.phoneNumber || "",
        lastContact: c.enrolledAt?.toISOString() || null,
      }));

    return res.json({ active, inactive });
  } catch (error: any) {
    console.error("[VOICE] Error fetching clients with phone:", error);
    return res.status(500).json({ error: "Failed to fetch clients" });
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

// ═══════════════════════════════════════════════════════════════════
// OUTBOUND CALLBACK - VPS reports call result
// ═══════════════════════════════════════════════════════════════════

// POST /api/voice/outbound/callback - VPS reports call result
router.post("/outbound/callback", async (req: Request, res: Response) => {
  try {
    // Verify service token from header
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      console.warn('📞 [Callback] Missing or invalid Authorization header');
      return res.status(401).json({ error: 'Unauthorized: Bearer token required' });
    }
    
    const token = authHeader.split(' ')[1];
    
    if (!JWT_SECRET) {
      console.error('❌ [Callback] JWT_SECRET not configured');
      return res.status(500).json({ error: 'Server configuration error' });
    }
    
    // Verify JWT token
    let decoded: any;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
      if (decoded.type !== 'phone_service') {
        return res.status(401).json({ error: 'Invalid token type' });
      }
    } catch (jwtError: any) {
      console.warn('📞 [Callback] Invalid JWT token:', jwtError.message);
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
    
    const consultantId = decoded.consultantId;
    const { callId, status, duration_seconds, hangup_cause } = req.body;
    
    if (!callId || !status) {
      return res.status(400).json({ error: 'callId and status are required' });
    }
    
    console.log(`📞 [Callback] Received for call ${callId}: status=${status}, duration=${duration_seconds}s, cause=${hangup_cause}`);
    
    // Check if call exists and belongs to this consultant
    const callResult = await db.execute(sql`
      SELECT id, attempts, max_attempts, consultant_id FROM scheduled_voice_calls 
      WHERE id = ${callId}
    `);
    
    if (callResult.rows.length === 0) {
      console.warn(`📞 [Callback] Call ${callId} not found`);
      return res.status(404).json({ error: 'Call not found' });
    }
    
    const call = callResult.rows[0] as any;
    
    // Verify consultant ownership
    if (call.consultant_id !== consultantId) {
      console.warn(`📞 [Callback] Consultant mismatch: expected ${call.consultant_id}, got ${consultantId}`);
      return res.status(403).json({ error: 'Forbidden: consultant mismatch' });
    }
    
    const currentAttempts = call.attempts || 1;
    const maxAttempts = call.max_attempts || 3;
    
    // Handle based on status
    const retryableStatuses = ['no_answer', 'busy', 'short_call'];
    
    if (status === 'completed') {
      // Call completed successfully - no retry needed
      await db.execute(sql`
        UPDATE scheduled_voice_calls 
        SET status = 'completed',
            duration_seconds = ${duration_seconds || 0},
            hangup_cause = ${hangup_cause || null},
            last_attempt_at = NOW(),
            updated_at = NOW()
        WHERE id = ${callId}
      `);
      
      console.log(`✅ [Callback] Call ${callId} completed successfully (duration: ${duration_seconds}s)`);
      return res.json({ success: true, message: 'Call marked as completed' });
    }
    
    if (status === 'failed') {
      // Hard failure - no retry
      await db.execute(sql`
        UPDATE scheduled_voice_calls 
        SET status = 'failed',
            duration_seconds = ${duration_seconds || 0},
            hangup_cause = ${hangup_cause || null},
            error_message = ${hangup_cause || 'Call failed'},
            last_attempt_at = NOW(),
            updated_at = NOW()
        WHERE id = ${callId}
      `);
      
      console.log(`❌ [Callback] Call ${callId} failed permanently: ${hangup_cause}`);
      return res.json({ success: true, message: 'Call marked as failed' });
    }
    
    if (retryableStatuses.includes(status)) {
      // Check if should retry
      if (currentAttempts < maxAttempts) {
        // Get consultant retry interval config
        const retryConfigResult = await db.execute(sql`
          SELECT voice_retry_interval_minutes FROM consultant_availability_settings 
          WHERE consultant_id = ${consultantId}
        `);
        const baseIntervalMinutes = (retryConfigResult.rows[0] as any)?.voice_retry_interval_minutes || 5;
        const baseIntervalMs = baseIntervalMinutes * 60 * 1000; // Convert to ms
        
        // Calculate retry delay with exponential backoff: baseInterval, 2x, 4x... max 30min
        const retryDelayMs = Math.min(baseIntervalMs * Math.pow(2, currentAttempts - 1), 1800000);
        const retryDelaySeconds = Math.floor(retryDelayMs / 1000);
        
        // Update status to retry_scheduled
        await db.execute(sql`
          UPDATE scheduled_voice_calls 
          SET status = 'retry_scheduled',
              retry_reason = ${status},
              attempts = ${currentAttempts + 1},
              duration_seconds = ${duration_seconds || 0},
              hangup_cause = ${hangup_cause || null},
              last_attempt_at = NOW(),
              next_retry_at = NOW() + INTERVAL '${sql.raw(String(retryDelaySeconds))} seconds',
              updated_at = NOW()
          WHERE id = ${callId}
        `);
        
        // Schedule timer for retry
        const timer = setTimeout(() => {
          scheduledCallTimers.delete(callId);
          console.log(`🔄 [Callback] Executing retry for call ${callId}`);
          executeOutboundCall(callId, consultantId);
        }, retryDelayMs);
        scheduledCallTimers.set(callId, timer);
        
        console.log(`🔄 [Callback] Call ${callId} scheduled for retry in ${retryDelaySeconds}s (attempt ${currentAttempts + 1}/${maxAttempts})`);
        return res.json({ 
          success: true, 
          message: 'Retry scheduled',
          nextRetryAt: new Date(Date.now() + retryDelayMs).toISOString(),
          attempt: currentAttempts + 1,
          maxAttempts
        });
      } else {
        // Max attempts reached - mark as failed
        await db.execute(sql`
          UPDATE scheduled_voice_calls 
          SET status = 'failed',
              retry_reason = ${status},
              duration_seconds = ${duration_seconds || 0},
              hangup_cause = ${hangup_cause || null},
              error_message = ${'Max attempts reached: ' + status},
              last_attempt_at = NOW(),
              updated_at = NOW()
          WHERE id = ${callId}
        `);
        
        console.log(`❌ [Callback] Call ${callId} failed after ${maxAttempts} attempts (reason: ${status})`);
        return res.json({ 
          success: true, 
          message: 'Call failed - max attempts reached',
          finalStatus: 'failed',
          reason: status
        });
      }
    }
    
    // Unknown status - just update and log
    await db.execute(sql`
      UPDATE scheduled_voice_calls 
      SET status = ${status},
          duration_seconds = ${duration_seconds || 0},
          hangup_cause = ${hangup_cause || null},
          last_attempt_at = NOW(),
          updated_at = NOW()
      WHERE id = ${callId}
    `);
    
    console.log(`📞 [Callback] Call ${callId} updated with status: ${status}`);
    return res.json({ success: true, message: `Call updated with status: ${status}` });
    
  } catch (error: any) {
    console.error('❌ [Callback] Error processing callback:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ═══════════════════════════════════════════════════════════════════
// AI SCHEDULED TASKS - Task queue per chiamate AI programmate
// ═══════════════════════════════════════════════════════════════════

// GET /api/voice/ai-tasks - Lista task con paginazione e filtri
router.get("/ai-tasks", authenticateToken, requireAnyRole(["consultant", "super_admin"]), async (req: AuthRequest, res: Response) => {
  try {
    const consultantId = req.user?.id;
    if (!consultantId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { status, page = "1", limit = "20", sort = "scheduled_at", order = "asc" } = req.query;
    const pageNum = Math.max(1, parseInt(page as string));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit as string)));
    const offset = (pageNum - 1) * limitNum;

    // Build query
    let whereClause = sql`consultant_id = ${consultantId}`;
    if (status && status !== 'all') {
      whereClause = sql`${whereClause} AND status = ${status}`;
    }

    // Get total count
    const countResult = await db.execute(sql`
      SELECT COUNT(*) as total FROM ai_scheduled_tasks WHERE ${whereClause}
    `);
    const total = parseInt((countResult.rows[0] as any)?.total || "0");

    // Get tasks with sorting
    const orderDir = order === 'desc' ? sql`DESC` : sql`ASC`;
    const tasks = await db.execute(sql`
      SELECT * FROM ai_scheduled_tasks 
      WHERE ${whereClause}
      ORDER BY 
        CASE WHEN status = 'in_progress' THEN 0
             WHEN status = 'retry_pending' THEN 1
             WHEN status = 'scheduled' THEN 2
             WHEN status = 'paused' THEN 3
             WHEN status = 'completed' THEN 4
             WHEN status = 'failed' THEN 5
             WHEN status = 'cancelled' THEN 6
             ELSE 7 END,
        scheduled_at ASC
      LIMIT ${limitNum} OFFSET ${offset}
    `);

    return res.json({
      tasks: tasks.rows,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum)
      }
    });
  } catch (error: any) {
    console.error("[AI-TASKS] Error fetching tasks:", error);
    return res.status(500).json({ error: "Failed to fetch AI tasks" });
  }
});

// GET /api/voice/ai-tasks/:id - Dettaglio singolo task
router.get("/ai-tasks/:id", authenticateToken, requireAnyRole(["consultant", "super_admin"]), async (req: AuthRequest, res: Response) => {
  try {
    const consultantId = req.user?.id;
    const { id } = req.params;

    const result = await db.execute(sql`
      SELECT * FROM ai_scheduled_tasks 
      WHERE id = ${id} AND consultant_id = ${consultantId}
    `);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Task not found" });
    }

    return res.json({ task: result.rows[0] });
  } catch (error: any) {
    console.error("[AI-TASKS] Error fetching task:", error);
    return res.status(500).json({ error: "Failed to fetch task" });
  }
});

// POST /api/voice/ai-tasks - Crea nuovo task
router.post("/ai-tasks", authenticateToken, requireAnyRole(["consultant", "super_admin"]), async (req: AuthRequest, res: Response) => {
  try {
    const consultantId = req.user?.id;
    if (!consultantId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const {
      contact_name,
      contact_phone,
      task_type = 'single_call',
      ai_instruction,
      scheduled_at,
      timezone = 'Europe/Rome',
      recurrence_type = 'once',
      recurrence_days,
      recurrence_end_date,
      max_attempts = 1,
      retry_delay_minutes = 15,
      voice_template_id
    } = req.body;

    // Validation
    if (!contact_phone) {
      return res.status(400).json({ error: "contact_phone is required" });
    }
    if (!ai_instruction) {
      return res.status(400).json({ error: "ai_instruction is required" });
    }
    if (!scheduled_at) {
      return res.status(400).json({ error: "scheduled_at is required" });
    }

    // Generate ID
    const taskId = `task_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;

    // Insert task
    const result = await db.execute(sql`
      INSERT INTO ai_scheduled_tasks (
        id, consultant_id, contact_name, contact_phone, task_type,
        ai_instruction, scheduled_at, timezone, recurrence_type,
        recurrence_days, recurrence_end_date, max_attempts,
        retry_delay_minutes, voice_template_id, status
      ) VALUES (
        ${taskId}, ${consultantId}, ${contact_name || null}, ${contact_phone},
        ${task_type}, ${ai_instruction}, ${scheduled_at}, ${timezone},
        ${recurrence_type}, ${recurrence_days ? JSON.stringify(recurrence_days) : null}::jsonb,
        ${recurrence_end_date || null}, ${max_attempts}, ${retry_delay_minutes},
        ${voice_template_id || null}, 'scheduled'
      )
      RETURNING *
    `);

    console.log(`📅 [AI-TASKS] Created task ${taskId} for ${contact_phone} at ${scheduled_at}`);

    return res.status(201).json({ 
      success: true,
      task: result.rows[0],
      message: "Task AI programmato con successo"
    });
  } catch (error: any) {
    console.error("[AI-TASKS] Error creating task:", error);
    return res.status(500).json({ error: "Failed to create AI task" });
  }
});

// PATCH /api/voice/ai-tasks/:id - Modifica task
router.patch("/ai-tasks/:id", authenticateToken, requireAnyRole(["consultant", "super_admin"]), async (req: AuthRequest, res: Response) => {
  try {
    const consultantId = req.user?.id;
    const { id } = req.params;
    const updates = req.body;

    // Verify ownership
    const existing = await db.execute(sql`
      SELECT * FROM ai_scheduled_tasks 
      WHERE id = ${id} AND consultant_id = ${consultantId}
    `);

    if (existing.rows.length === 0) {
      return res.status(404).json({ error: "Task not found" });
    }

    // Build dynamic update
    const allowedFields = [
      'contact_name', 'contact_phone', 'task_type', 'ai_instruction',
      'scheduled_at', 'timezone', 'recurrence_type', 'recurrence_days',
      'recurrence_end_date', 'max_attempts', 'retry_delay_minutes',
      'voice_template_id', 'status'
    ];

    const setClauses: string[] = ['updated_at = NOW()'];
    const values: any[] = [];
    let paramIndex = 1;

    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        if (field === 'recurrence_days') {
          setClauses.push(`${field} = $${paramIndex}::jsonb`);
          values.push(JSON.stringify(updates[field]));
        } else {
          setClauses.push(`${field} = $${paramIndex}`);
          values.push(updates[field]);
        }
        paramIndex++;
      }
    }

    values.push(id, consultantId);

    const updateQuery = `
      UPDATE ai_scheduled_tasks 
      SET ${setClauses.join(', ')}
      WHERE id = $${paramIndex} AND consultant_id = $${paramIndex + 1}
      RETURNING *
    `;

    const result = await db.execute(sql.raw(updateQuery, values));

    console.log(`📝 [AI-TASKS] Updated task ${id}`);

    return res.json({ 
      success: true,
      task: result.rows[0],
      message: "Task aggiornato"
    });
  } catch (error: any) {
    console.error("[AI-TASKS] Error updating task:", error);
    return res.status(500).json({ error: "Failed to update task" });
  }
});

// DELETE /api/voice/ai-tasks/:id - Elimina task
router.delete("/ai-tasks/:id", authenticateToken, requireAnyRole(["consultant", "super_admin"]), async (req: AuthRequest, res: Response) => {
  try {
    const consultantId = req.user?.id;
    const { id } = req.params;

    const result = await db.execute(sql`
      DELETE FROM ai_scheduled_tasks 
      WHERE id = ${id} AND consultant_id = ${consultantId}
      RETURNING id
    `);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Task not found" });
    }

    console.log(`🗑️ [AI-TASKS] Deleted task ${id}`);

    return res.json({ 
      success: true,
      message: "Task eliminato"
    });
  } catch (error: any) {
    console.error("[AI-TASKS] Error deleting task:", error);
    return res.status(500).json({ error: "Failed to delete task" });
  }
});

// POST /api/voice/ai-tasks/:id/execute - Esegui subito
router.post("/ai-tasks/:id/execute", authenticateToken, requireAnyRole(["consultant", "super_admin"]), async (req: AuthRequest, res: Response) => {
  try {
    const consultantId = req.user?.id;
    const { id } = req.params;

    // Get task
    const taskResult = await db.execute(sql`
      SELECT * FROM ai_scheduled_tasks 
      WHERE id = ${id} AND consultant_id = ${consultantId}
    `);

    if (taskResult.rows.length === 0) {
      return res.status(404).json({ error: "Task not found" });
    }

    const task = taskResult.rows[0] as any;

    // Update task to in_progress
    await db.execute(sql`
      UPDATE ai_scheduled_tasks 
      SET status = 'in_progress',
          current_attempt = current_attempt + 1,
          last_attempt_at = NOW(),
          updated_at = NOW()
      WHERE id = ${id}
    `);

    // TODO: Integrate with voice outbound system
    // For now, return success and let the scheduler handle it
    console.log(`🚀 [AI-TASKS] Executing task ${id} immediately for ${task.contact_phone}`);

    return res.json({ 
      success: true,
      message: "Task in esecuzione",
      task_id: id
    });
  } catch (error: any) {
    console.error("[AI-TASKS] Error executing task:", error);
    return res.status(500).json({ error: "Failed to execute task" });
  }
});

// POST /api/voice/ai-tasks/:id/pause - Metti in pausa
router.post("/ai-tasks/:id/pause", authenticateToken, requireAnyRole(["consultant", "super_admin"]), async (req: AuthRequest, res: Response) => {
  try {
    const consultantId = req.user?.id;
    const { id } = req.params;

    const result = await db.execute(sql`
      UPDATE ai_scheduled_tasks 
      SET status = 'paused', updated_at = NOW()
      WHERE id = ${id} AND consultant_id = ${consultantId}
        AND status IN ('scheduled', 'retry_pending')
      RETURNING *
    `);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Task not found or cannot be paused" });
    }

    console.log(`⏸️ [AI-TASKS] Paused task ${id}`);

    return res.json({ 
      success: true,
      message: "Task in pausa",
      task: result.rows[0]
    });
  } catch (error: any) {
    console.error("[AI-TASKS] Error pausing task:", error);
    return res.status(500).json({ error: "Failed to pause task" });
  }
});

// POST /api/voice/ai-tasks/:id/resume - Riprendi
router.post("/ai-tasks/:id/resume", authenticateToken, requireAnyRole(["consultant", "super_admin"]), async (req: AuthRequest, res: Response) => {
  try {
    const consultantId = req.user?.id;
    const { id } = req.params;

    const result = await db.execute(sql`
      UPDATE ai_scheduled_tasks 
      SET status = 'scheduled', updated_at = NOW()
      WHERE id = ${id} AND consultant_id = ${consultantId}
        AND status = 'paused'
      RETURNING *
    `);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Task not found or not paused" });
    }

    console.log(`▶️ [AI-TASKS] Resumed task ${id}`);

    return res.json({ 
      success: true,
      message: "Task ripreso",
      task: result.rows[0]
    });
  } catch (error: any) {
    console.error("[AI-TASKS] Error resuming task:", error);
    return res.status(500).json({ error: "Failed to resume task" });
  }
});

// POST /api/voice/ai-tasks/:id/cancel - Annulla
router.post("/ai-tasks/:id/cancel", authenticateToken, requireAnyRole(["consultant", "super_admin"]), async (req: AuthRequest, res: Response) => {
  try {
    const consultantId = req.user?.id;
    const { id } = req.params;

    const result = await db.execute(sql`
      UPDATE ai_scheduled_tasks 
      SET status = 'cancelled', updated_at = NOW(), completed_at = NOW()
      WHERE id = ${id} AND consultant_id = ${consultantId}
        AND status NOT IN ('completed', 'cancelled', 'in_progress')
      RETURNING *
    `);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Task not found or cannot be cancelled" });
    }

    console.log(`🚫 [AI-TASKS] Cancelled task ${id}`);

    return res.json({ 
      success: true,
      message: "Task annullato",
      task: result.rows[0]
    });
  } catch (error: any) {
    console.error("[AI-TASKS] Error cancelling task:", error);
    return res.status(500).json({ error: "Failed to cancel task" });
  }
});

// GET /api/voice/ai-tasks/stats - Statistiche task
router.get("/ai-tasks-stats", authenticateToken, requireAnyRole(["consultant", "super_admin"]), async (req: AuthRequest, res: Response) => {
  try {
    const consultantId = req.user?.id;
    if (!consultantId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const stats = await db.execute(sql`
      SELECT 
        status,
        COUNT(*) as count
      FROM ai_scheduled_tasks
      WHERE consultant_id = ${consultantId}
      GROUP BY status
    `);

    const statsMap: Record<string, number> = {};
    for (const row of stats.rows as any[]) {
      statsMap[row.status] = parseInt(row.count);
    }

    // Get upcoming tasks (next 24h)
    const upcoming = await db.execute(sql`
      SELECT COUNT(*) as count FROM ai_scheduled_tasks
      WHERE consultant_id = ${consultantId}
        AND status = 'scheduled'
        AND scheduled_at <= NOW() + INTERVAL '24 hours'
    `);

    return res.json({
      stats: {
        scheduled: statsMap.scheduled || 0,
        in_progress: statsMap.in_progress || 0,
        retry_pending: statsMap.retry_pending || 0,
        completed: statsMap.completed || 0,
        failed: statsMap.failed || 0,
        paused: statsMap.paused || 0,
        cancelled: statsMap.cancelled || 0,
        upcoming_24h: parseInt((upcoming.rows[0] as any)?.count || "0")
      }
    });
  } catch (error: any) {
    console.error("[AI-TASKS] Error fetching stats:", error);
    return res.status(500).json({ error: "Failed to fetch stats" });
  }
});

export default router;
