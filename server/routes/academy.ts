import { Router, Response } from 'express';
import { authenticateToken, requireRole, type AuthRequest } from '../middleware/auth';
import { db } from '../db';
import { sql } from 'drizzle-orm';

const router = Router();

const VALID_STEP_IDS = new Set([
  'twilio', 'smtp', 'vertex_ai', 'lead_import',
  'whatsapp_template', 'agent_inbound', 'first_campaign', 'agent_outbound', 'stripe_connect',
  'knowledge_base', 'google_calendar', 'google_calendar_agents', 'voice_calls',
  'agent_consultative', 'email_journey', 'nurturing_emails',
  'ai_autonomo', 'summary_email', 'email_hub', 'agent_public_link', 'instagram',
  'turn_config', 'agent_ideas', 'more_templates', 'first_course', 'first_exercise', 'whatsapp_ai',
]);

async function ensureTable() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS consultant_academy_completions (
      id SERIAL PRIMARY KEY,
      consultant_id VARCHAR NOT NULL,
      step_id VARCHAR NOT NULL,
      completed_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(consultant_id, step_id)
    )
  `);
}

ensureTable().catch(err => console.error('[Academy] Table init error:', err));

router.get('/completions', authenticateToken, requireRole('consultant'), async (req: AuthRequest, res: Response) => {
  try {
    const consultantId = req.user!.id;
    const rows = await db.execute(sql`
      SELECT step_id FROM consultant_academy_completions
      WHERE consultant_id = ${consultantId}
    `);
    const stepIds = (rows.rows as { step_id: string }[]).map(r => r.step_id);
    res.json({ success: true, data: stepIds });
  } catch (err: any) {
    console.error('[Academy] GET completions error:', err);
    res.status(500).json({ success: false, error: 'Errore nel recupero completamenti' });
  }
});

router.post('/completions/:stepId', authenticateToken, requireRole('consultant'), async (req: AuthRequest, res: Response) => {
  try {
    const consultantId = req.user!.id;
    const { stepId } = req.params;
    if (!VALID_STEP_IDS.has(stepId)) {
      return res.status(400).json({ success: false, error: 'Step non valido' });
    }
    await db.execute(sql`
      INSERT INTO consultant_academy_completions (consultant_id, step_id)
      VALUES (${consultantId}, ${stepId})
      ON CONFLICT (consultant_id, step_id) DO NOTHING
    `);
    res.json({ success: true });
  } catch (err: any) {
    console.error('[Academy] POST completion error:', err);
    res.status(500).json({ success: false, error: 'Errore nel salvataggio' });
  }
});

router.delete('/completions/:stepId', authenticateToken, requireRole('consultant'), async (req: AuthRequest, res: Response) => {
  try {
    const consultantId = req.user!.id;
    const { stepId } = req.params;
    await db.execute(sql`
      DELETE FROM consultant_academy_completions
      WHERE consultant_id = ${consultantId} AND step_id = ${stepId}
    `);
    res.json({ success: true });
  } catch (err: any) {
    console.error('[Academy] DELETE completion error:', err);
    res.status(500).json({ success: false, error: 'Errore nella rimozione' });
  }
});

export default router;
