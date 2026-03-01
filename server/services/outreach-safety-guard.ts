import { db } from '../db';
import { sql } from 'drizzle-orm';

const LOG = '🛡️ [OUTREACH-SAFETY]';

export interface OutreachSafetyResult {
  allowed: boolean;
  reason?: string;
  lastContactAt?: Date;
  lastContactChannel?: string;
}

export async function checkOutreachSafety(
  leadId: string,
  channel: string,
  consultantId: string,
  windowHours = 24,
): Promise<OutreachSafetyResult> {
  try {
    const channelActivityTypes: Record<string, string[]> = {
      voice: ['voice_call_answered', 'voice_call_completed', 'voice_call_no_answer', 'chiamata'],
      whatsapp: ['whatsapp_sent', 'whatsapp_inviato'],
      email: ['email_sent', 'email_inviata'],
    };

    const relevantTypes = channelActivityTypes[channel] || [];

    if (relevantTypes.length === 0) {
      return { allowed: true };
    }

    const windowStart = new Date(Date.now() - windowHours * 60 * 60 * 1000);

    const typePlaceholders = relevantTypes.map(t => sql`${t}`);
    const recentContactResult = await db.execute(sql`
      SELECT type, created_at
      FROM lead_scraper_activities
      WHERE lead_id::text = ${leadId}::text
        AND type IN (${sql.join(typePlaceholders, sql`, `)})
        AND created_at >= ${windowStart.toISOString()}
      ORDER BY created_at DESC
      LIMIT 1
    `);

    if (recentContactResult.rows.length > 0) {
      const lastContact = recentContactResult.rows[0] as any;
      const hoursSince = (Date.now() - new Date(lastContact.created_at).getTime()) / (1000 * 60 * 60);
      console.warn(`${LOG} BLOCKED: lead ${leadId} channel=${channel} already contacted ${hoursSince.toFixed(1)}h ago (type=${lastContact.type})`);
      return {
        allowed: false,
        reason: `Lead già contattato via ${channel} ${hoursSince.toFixed(1)} ore fa — finestra di sicurezza ${windowHours}h`,
        lastContactAt: new Date(lastContact.created_at),
        lastContactChannel: lastContact.type,
      };
    }

    const pendingTaskResult = await db.execute(sql`
      SELECT id, preferred_channel, status
      FROM ai_scheduled_tasks
      WHERE consultant_id::text = ${consultantId}::text
        AND preferred_channel = ${channel}
        AND status IN ('scheduled', 'waiting_approval', 'approved', 'in_progress')
        AND (
          additional_context::text LIKE ${'%' + leadId + '%'}
          OR result_data::text LIKE ${'%' + leadId + '%'}
        )
        AND created_at >= ${windowStart.toISOString()}
      LIMIT 1
    `);

    if (pendingTaskResult.rows.length > 0) {
      const pending = pendingTaskResult.rows[0] as any;
      console.warn(`${LOG} BLOCKED: lead ${leadId} channel=${channel} already has pending task ${pending.id} (status=${pending.status})`);
      return {
        allowed: false,
        reason: `Esiste già un task ${channel} in coda per questo lead (status: ${pending.status})`,
      };
    }

    const leadPhoneResult = await db.execute(sql`
      SELECT phone FROM lead_scraper_results WHERE id::text = ${leadId}::text LIMIT 1
    `);
    const leadPhone = (leadPhoneResult.rows[0] as any)?.phone;
    if (leadPhone) {
      const normalizedPhone = leadPhone.replace(/[\s\-()\.]/g, '');
      const proactiveResult = await db.execute(sql`
        SELECT id, status, phone_number
        FROM proactive_leads
        WHERE consultant_id::text = ${consultantId}::text
          AND REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(phone_number, ' ', ''), '-', ''), '(', ''), ')', ''), '.', '') = ${normalizedPhone}
          AND status NOT IN ('nuovo', 'new')
        LIMIT 1
      `);
      if (proactiveResult.rows.length > 0) {
        const pl = proactiveResult.rows[0] as any;
        console.warn(`${LOG} BLOCKED: lead ${leadId} phone ${leadPhone} already in proactive_leads (id=${pl.id}, status=${pl.status})`);
        return {
          allowed: false,
          reason: `Lead già in gestione come proactive lead (status: ${pl.status})`,
        };
      }
    }

    return { allowed: true };
  } catch (error: any) {
    console.error(`${LOG} Safety check error for lead ${leadId}: ${error.message}`);
    return { allowed: true };
  }
}

export async function checkBulkOutreachSafety(
  contacts: Array<{ leadId?: string; phone?: string; email?: string; channel: string }>,
  consultantId: string,
  windowHours = 24,
): Promise<Map<string, OutreachSafetyResult>> {
  const results = new Map<string, OutreachSafetyResult>();

  for (const contact of contacts) {
    const key = contact.leadId || contact.phone || contact.email || '';
    if (!key) continue;

    if (contact.leadId) {
      results.set(key, await checkOutreachSafety(contact.leadId, contact.channel, consultantId, windowHours));
    } else {
      results.set(key, { allowed: true });
    }
  }

  return results;
}
