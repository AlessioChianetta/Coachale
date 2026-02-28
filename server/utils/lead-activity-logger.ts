import { db } from "../db";
import { sql } from "drizzle-orm";

const LOG_PREFIX = "📋 [LEAD-ACTIVITY]";

export async function logLeadActivity(
  leadId: string,
  consultantId: string,
  type: string,
  title: string,
  description: string,
  metadata: Record<string, any> = {}
): Promise<void> {
  try {
    await db.execute(sql`
      INSERT INTO lead_scraper_activities (
        lead_id, consultant_id, type, title, description,
        metadata, created_at, updated_at
      ) VALUES (
        ${leadId}::uuid, ${consultantId}, ${type},
        ${title}, ${description},
        ${JSON.stringify(metadata)}::jsonb,
        NOW(), NOW()
      )
    `);
    console.log(`${LOG_PREFIX} Logged activity: ${type} for lead ${leadId}`);
  } catch (err: any) {
    console.warn(`${LOG_PREFIX} Failed to log activity: ${err.message}`);
  }
}

export async function updateLeadStatusOnReply(
  leadId: string,
  channel: string
): Promise<void> {
  try {
    const result = await db.execute(sql`
      UPDATE lead_scraper_results
      SET lead_status = 'replied',
          lead_contacted_at = COALESCE(lead_contacted_at, NOW()),
          lead_next_action = ${"Lead ha risposto via " + channel + " - verificare e seguire"},
          lead_next_action_date = NOW()
      WHERE id = ${leadId}::uuid
        AND (lead_status IN ('in_outreach', 'contacted', 'contattato', 'nuovo') OR lead_status IS NULL)
      RETURNING id, lead_status
    `);
    if (result.rows.length > 0) {
      console.log(`${LOG_PREFIX} Lead ${leadId} status updated to 'replied' (channel: ${channel})`);
    }
  } catch (err: any) {
    console.warn(`${LOG_PREFIX} Failed to update lead status: ${err.message}`);
  }
}

export async function findLeadIdFromProactiveLead(
  proactiveLeadId: string
): Promise<string | null> {
  try {
    const result = await db.execute(sql`
      SELECT lead_id FROM hunter_actions
      WHERE proactive_lead_id = ${proactiveLeadId}
      ORDER BY created_at DESC
      LIMIT 1
    `);
    if (result.rows.length > 0) {
      return (result.rows[0] as any).lead_id;
    }

    const metaResult = await db.execute(sql`
      SELECT metadata->>'hunter_lead_id' as lead_id
      FROM proactive_leads
      WHERE id = ${proactiveLeadId}
      AND metadata->>'hunter_lead_id' IS NOT NULL
      LIMIT 1
    `);
    if (metaResult.rows.length > 0 && (metaResult.rows[0] as any).lead_id) {
      return (metaResult.rows[0] as any).lead_id;
    }

    return null;
  } catch (err: any) {
    console.warn(`${LOG_PREFIX} Failed to find leadId from proactiveLeadId ${proactiveLeadId}: ${err.message}`);
    return null;
  }
}

export async function findLeadIdByPhone(
  phone: string,
  consultantId: string
): Promise<string | null> {
  try {
    const normalized = phone.replace(/\s+/g, '').replace(/^00/, '+');
    const result = await db.execute(sql`
      SELECT id FROM lead_scraper_results
      WHERE consultant_id = ${consultantId}
        AND (phone = ${phone} OR phone = ${normalized} OR phone LIKE ${'%' + phone.slice(-8)})
      ORDER BY created_at DESC
      LIMIT 1
    `);
    if (result.rows.length > 0) {
      return (result.rows[0] as any).id;
    }
    return null;
  } catch (err: any) {
    console.warn(`${LOG_PREFIX} Failed to find leadId by phone: ${err.message}`);
    return null;
  }
}

export async function findLeadIdByEmail(
  email: string,
  consultantId: string
): Promise<string | null> {
  try {
    const result = await db.execute(sql`
      SELECT id FROM lead_scraper_results
      WHERE consultant_id = ${consultantId}
        AND LOWER(email) = LOWER(${email})
      ORDER BY created_at DESC
      LIMIT 1
    `);
    if (result.rows.length > 0) {
      return (result.rows[0] as any).id;
    }
    return null;
  } catch (err: any) {
    console.warn(`${LOG_PREFIX} Failed to find leadId by email: ${err.message}`);
    return null;
  }
}
