import { db } from '../db';
import { sql } from 'drizzle-orm';

export interface EnsureProactiveLeadParams {
  consultantId: string;
  phoneNumber: string;
  contactName?: string;
  email?: string;
  source?: string;
  agentConfigId?: string;
  leadInfo?: Record<string, any>;
  consultantNotes?: string;
  status?: 'pending' | 'contacted';
}

export async function ensureProactiveLead(params: EnsureProactiveLeadParams): Promise<{ id: string; created: boolean }> {
  const LOG = '📋 [ENSURE-LEAD]';
  const { consultantId, phoneNumber, contactName, email, source, agentConfigId, leadInfo, consultantNotes, status = 'contacted' } = params;

  if (!phoneNumber || phoneNumber.length < 5) {
    console.log(`${LOG} Skipping — invalid phone: "${phoneNumber}"`);
    return { id: '', created: false };
  }

  let normalizedPhone = phoneNumber.replace(/[\s\-()]/g, '');
  if (!normalizedPhone.startsWith('+') && normalizedPhone.length >= 9) {
    normalizedPhone = '+39' + normalizedPhone;
  }

  const nameParts = (contactName || 'Contatto').split(' ');
  const firstName = nameParts[0] || 'Contatto';
  const lastName = nameParts.slice(1).join(' ') || '';
  const resolvedSource = source || 'manual';
  const leadInfoJson = leadInfo ? JSON.stringify(leadInfo) : '{}';

  try {
    const result = await db.execute(sql`
      INSERT INTO proactive_leads (
        consultant_id, agent_config_id,
        first_name, last_name, phone_number, email,
        source, status, contact_schedule,
        lead_info, consultant_notes,
        created_at, updated_at
      ) VALUES (
        ${consultantId},
        ${agentConfigId || null},
        ${firstName}, ${lastName}, ${normalizedPhone}, ${email || null},
        ${resolvedSource}, ${status},
        NOW(),
        ${leadInfoJson}::jsonb,
        ${consultantNotes || null},
        NOW(), NOW()
      )
      ON CONFLICT (consultant_id, phone_number) DO UPDATE
        SET updated_at = NOW(),
            last_contacted_at = CASE WHEN ${status} = 'contacted' THEN NOW() ELSE proactive_leads.last_contacted_at END
      RETURNING id, (xmax = 0) AS is_new
    `);

    const row = result.rows[0] as any;
    const created = row.is_new === true;
    console.log(`${LOG} ${created ? '✅ Created' : '↩ Existing'} proactive lead ${row.id} for ${normalizedPhone} (${contactName || 'N/A'}, source: ${resolvedSource})`);
    return { id: row.id, created };
  } catch (err: any) {
    console.error(`${LOG} Error for ${normalizedPhone}:`, err.message);
    return { id: '', created: false };
  }
}
