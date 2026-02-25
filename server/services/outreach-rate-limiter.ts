import { db } from "../db";
import { sql } from "drizzle-orm";

const LOG_PREFIX = "🚦 [RATE-LIMITER]";

export interface OutreachLimits {
  maxSearchesPerDay: number;
  maxCallsPerDay: number;
  maxWhatsappPerDay: number;
  maxEmailsPerDay: number;
  cooldownHours: number;
}

export interface DailyUsageStats {
  searches: number;
  calls: number;
  whatsapp: number;
  email: number;
}

export interface RemainingLimits {
  searches: number;
  calls: number;
  whatsapp: number;
  email: number;
}

const DEFAULT_LIMITS: OutreachLimits = {
  maxSearchesPerDay: 5,
  maxCallsPerDay: 10,
  maxWhatsappPerDay: 15,
  maxEmailsPerDay: 20,
  cooldownHours: 48,
};

export async function getOutreachLimits(consultantId: string): Promise<OutreachLimits> {
  try {
    const result = await db.execute(sql`
      SELECT outreach_config FROM ai_autonomy_settings
      WHERE consultant_id::text = ${consultantId}::text LIMIT 1
    `);
    const config = (result.rows[0] as any)?.outreach_config || {};
    return {
      maxSearchesPerDay: config.max_searches_per_day ?? config.maxSearchesPerDay ?? DEFAULT_LIMITS.maxSearchesPerDay,
      maxCallsPerDay: config.max_calls_per_day ?? config.maxCallsPerDay ?? DEFAULT_LIMITS.maxCallsPerDay,
      maxWhatsappPerDay: config.max_whatsapp_per_day ?? config.maxWhatsappPerDay ?? DEFAULT_LIMITS.maxWhatsappPerDay,
      maxEmailsPerDay: config.max_emails_per_day ?? config.maxEmailsPerDay ?? DEFAULT_LIMITS.maxEmailsPerDay,
      cooldownHours: config.cooldown_hours ?? config.cooldownHours ?? DEFAULT_LIMITS.cooldownHours,
    };
  } catch (err: any) {
    console.warn(`${LOG_PREFIX} Failed to load outreach config for ${consultantId}: ${err.message}, using defaults`);
    return { ...DEFAULT_LIMITS };
  }
}

export async function getDailyUsage(consultantId: string): Promise<DailyUsageStats> {
  try {
    const result = await db.execute(sql`
      SELECT
        COUNT(*) FILTER (
          WHERE task_category = 'prospecting'
            AND preferred_channel = 'lead_scraper'
            AND created_at >= CURRENT_DATE
        ) as searches,
        COUNT(*) FILTER (
          WHERE preferred_channel = 'voice'
            AND task_category = 'prospecting'
            AND created_at >= CURRENT_DATE
        ) as calls,
        COUNT(*) FILTER (
          WHERE preferred_channel = 'whatsapp'
            AND task_category = 'prospecting'
            AND created_at >= CURRENT_DATE
        ) as whatsapp,
        COUNT(*) FILTER (
          WHERE preferred_channel = 'email'
            AND task_category = 'prospecting'
            AND created_at >= CURRENT_DATE
        ) as email
      FROM ai_scheduled_tasks
      WHERE consultant_id = ${consultantId}
        AND status NOT IN ('cancelled', 'failed')
    `);

    const row = result.rows[0] as any;
    return {
      searches: parseInt(row?.searches || '0'),
      calls: parseInt(row?.calls || '0'),
      whatsapp: parseInt(row?.whatsapp || '0'),
      email: parseInt(row?.email || '0'),
    };
  } catch (err: any) {
    console.warn(`${LOG_PREFIX} Failed to get daily usage for ${consultantId}: ${err.message}`);
    return { searches: 0, calls: 0, whatsapp: 0, email: 0 };
  }
}

export async function getRemainingLimits(consultantId: string): Promise<RemainingLimits> {
  const [limits, usage] = await Promise.all([
    getOutreachLimits(consultantId),
    getDailyUsage(consultantId),
  ]);

  return {
    searches: Math.max(0, limits.maxSearchesPerDay - usage.searches),
    calls: Math.max(0, limits.maxCallsPerDay - usage.calls),
    whatsapp: Math.max(0, limits.maxWhatsappPerDay - usage.whatsapp),
    email: Math.max(0, limits.maxEmailsPerDay - usage.email),
  };
}

export async function checkDailyLimits(consultantId: string, channel: 'voice' | 'whatsapp' | 'email' | 'lead_scraper'): Promise<boolean> {
  const remaining = await getRemainingLimits(consultantId);

  const channelMap: Record<string, keyof RemainingLimits> = {
    voice: 'calls',
    whatsapp: 'whatsapp',
    email: 'email',
    lead_scraper: 'searches',
  };

  const key = channelMap[channel];
  if (!key) return true;

  const allowed = remaining[key] > 0;
  if (!allowed) {
    console.log(`${LOG_PREFIX} Daily limit reached for ${channel} (consultant: ${consultantId})`);
  }
  return allowed;
}

export async function checkLeadCooldown(leadId: string, consultantId: string): Promise<boolean> {
  try {
    const limits = await getOutreachLimits(consultantId);
    const cooldownHours = limits.cooldownHours;

    const result = await db.execute(sql`
      SELECT lr.lead_contacted_at, lr.lead_status,
             lr.outreach_task_id
      FROM lead_scraper_results lr
      WHERE lr.id = ${leadId}
      LIMIT 1
    `);

    if (result.rows.length === 0) return true;

    const lead = result.rows[0] as any;

    if (lead.lead_status === 'non_interessato' || lead.lead_status === 'convertito') {
      console.log(`${LOG_PREFIX} Lead ${leadId} is ${lead.lead_status}, skipping`);
      return false;
    }

    if (lead.lead_contacted_at) {
      const contactedAt = new Date(lead.lead_contacted_at);
      const cooldownEnd = new Date(contactedAt.getTime() + cooldownHours * 60 * 60 * 1000);
      if (new Date() < cooldownEnd) {
        console.log(`${LOG_PREFIX} Lead ${leadId} in cooldown until ${cooldownEnd.toISOString()}`);
        return false;
      }
    }

    if (lead.outreach_task_id) {
      const taskResult = await db.execute(sql`
        SELECT status, created_at FROM ai_scheduled_tasks
        WHERE id = ${lead.outreach_task_id}
        LIMIT 1
      `);
      if (taskResult.rows.length > 0) {
        const task = taskResult.rows[0] as any;
        if (['pending', 'waiting_approval', 'in_progress', 'scheduled'].includes(task.status)) {
          console.log(`${LOG_PREFIX} Lead ${leadId} has pending outreach task ${lead.outreach_task_id}`);
          return false;
        }
      }
    }

    return true;
  } catch (err: any) {
    console.warn(`${LOG_PREFIX} Failed to check cooldown for lead ${leadId}: ${err.message}`);
    return true;
  }
}
