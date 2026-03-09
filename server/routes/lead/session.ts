import { Router, Response } from 'express';
import { db } from '../../db';
import { sql } from 'drizzle-orm';
import { authenticateToken, type AuthRequest } from '../../middleware/auth';

const router = Router();

router.get('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Non autenticato' });
    }

    const userRes = await db.execute(sql`
      SELECT is_lead_magnet FROM users WHERE id = ${userId} LIMIT 1
    `);
    if (!userRes.rows[0] || !(userRes.rows[0] as any).is_lead_magnet) {
      return res.status(403).json({ success: false, error: 'Accesso non autorizzato' });
    }

    const sessionRes = await db.execute(sql`
      SELECT id, public_token, status, mode, client_profile_json, created_at, updated_at
      FROM delivery_agent_sessions
      WHERE lead_user_id = ${userId} AND is_public = true
      ORDER BY created_at DESC
      LIMIT 1
    `);

    if (sessionRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Nessuna sessione trovata' });
    }

    const session = sessionRes.rows[0] as any;

    res.json({
      success: true,
      data: {
        publicToken: session.public_token,
        sessionId: session.id,
        status: session.status,
        mode: session.mode,
      },
    });
  } catch (err: any) {
    console.error('[LeadSession] Error:', err);
    res.status(500).json({ success: false, error: 'Errore interno' });
  }
});

export default router;
