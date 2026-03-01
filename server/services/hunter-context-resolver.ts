import { db } from "../db";
import { sql } from "drizzle-orm";

export interface HunterLeadContext {
  businessName: string | null;
  sector: string | null;
  score: number | null;
  website: string | null;
  aiSalesSummary: string | null;
  leadStatus: string | null;
  leadId: string | null;
}

function normalizePhoneDigits(phone: string): string {
  return phone.replace(/\D/g, '');
}

export async function resolveHunterContext(params: {
  consultantId: string;
  phoneNumber?: string | null;
  email?: string | null;
  proactiveLeadId?: string | null;
}): Promise<HunterLeadContext | null> {
  const { consultantId, phoneNumber, email, proactiveLeadId } = params;

  console.log(`🔍 [HUNTER-CTX] resolveHunterContext called: consultantId=${consultantId.substring(0, 8)}... phone=${phoneNumber || 'N/A'} email=${email || 'N/A'} proactiveLeadId=${proactiveLeadId || 'N/A'}`);

  try {
    let hunterLeadId: string | null = null;

    if (proactiveLeadId) {
      const plResult = await db.execute(sql`
        SELECT metadata->>'hunter_lead_id' as hunter_lead_id
        FROM proactive_leads
        WHERE id = ${proactiveLeadId}
          AND consultant_id = ${consultantId}
          AND metadata->>'hunter_lead_id' IS NOT NULL
        LIMIT 1
      `);
      if (plResult.rows.length > 0) {
        hunterLeadId = (plResult.rows[0] as any).hunter_lead_id;
        console.log(`🔍 [HUNTER-CTX] Step 1: Found hunter_lead_id=${hunterLeadId} via proactiveLeadId`);
      } else {
        console.log(`🔍 [HUNTER-CTX] Step 1: No hunter_lead_id in proactive lead metadata`);
      }
    }

    if (!hunterLeadId && phoneNumber) {
      const normalized = phoneNumber.replace(/^\+/, '');
      const digitsOnly = normalizePhoneDigits(phoneNumber);
      console.log(`🔍 [HUNTER-CTX] Step 2: Searching proactive_leads by phone ${phoneNumber} / ${normalized} / digits=${digitsOnly}`);
      const plResult = await db.execute(sql`
        SELECT metadata->>'hunter_lead_id' as hunter_lead_id
        FROM proactive_leads
        WHERE consultant_id = ${consultantId}
          AND metadata->>'hunter_lead_id' IS NOT NULL
          AND (
            phone_number = ${phoneNumber}
            OR phone_number = ${normalized}
            OR ('+' || phone_number) = ${phoneNumber}
            OR regexp_replace(phone_number, '[^0-9]', '', 'g') = ${digitsOnly}
          )
        ORDER BY created_at DESC
        LIMIT 1
      `);
      if (plResult.rows.length > 0) {
        hunterLeadId = (plResult.rows[0] as any).hunter_lead_id;
        console.log(`🔍 [HUNTER-CTX] Step 2: Found hunter_lead_id=${hunterLeadId} via phone in proactive_leads`);
      } else {
        console.log(`🔍 [HUNTER-CTX] Step 2: No proactive_lead with hunter_lead_id for this phone`);
      }
    }

    if (hunterLeadId) {
      const lsr = await db.execute(sql`
        SELECT r.id, r.business_name, r.category, r.ai_compatibility_score,
               r.ai_sales_summary, r.website, r.lead_status
        FROM lead_scraper_results r
        JOIN lead_scraper_searches s ON r.search_id = s.id
        WHERE r.id = ${hunterLeadId}
          AND s.consultant_id = ${consultantId}
        LIMIT 1
      `);
      if (lsr.rows.length > 0) {
        const row = lsr.rows[0] as any;
        console.log(`🔍 [HUNTER-CTX] Found via proactive_leads link → ${row.business_name} (score: ${row.ai_compatibility_score})`);
        return mapRow(row);
      }
    }

    console.log(`🔍 [HUNTER-CTX] Step 3: hunterLeadId=${hunterLeadId || 'null'}, trying email/phone fallbacks`);

    if (email) {
      console.log(`🔍 [HUNTER-CTX] Step 4: Searching lead_scraper_results by email=${email}`);
      const normalizedEmail = email.toLowerCase().trim();
      const lsr = await db.execute(sql`
        SELECT r.id, r.business_name, r.category, r.ai_compatibility_score,
               r.ai_sales_summary, r.website, r.lead_status
        FROM lead_scraper_results r
        JOIN lead_scraper_searches s ON r.search_id = s.id
        WHERE s.consultant_id = ${consultantId}
          AND LOWER(r.email) = ${normalizedEmail}
        ORDER BY r.created_at DESC
        LIMIT 1
      `);
      if (lsr.rows.length > 0) {
        const row = lsr.rows[0] as any;
        console.log(`🔍 [HUNTER-CTX] Found via email match → ${row.business_name} (score: ${row.ai_compatibility_score})`);
        return mapRow(row);
      }
    }

    if (phoneNumber) {
      const normalized = phoneNumber.replace(/^\+/, '');
      const digitsOnly = normalizePhoneDigits(phoneNumber);
      console.log(`🔍 [HUNTER-CTX] Step 5: Searching lead_scraper_results by phone=${phoneNumber} / normalized=${normalized} / digits=${digitsOnly}`);
      const lsr = await db.execute(sql`
        SELECT r.id, r.business_name, r.category, r.ai_compatibility_score,
               r.ai_sales_summary, r.website, r.lead_status
        FROM lead_scraper_results r
        JOIN lead_scraper_searches s ON r.search_id = s.id
        WHERE s.consultant_id = ${consultantId}
          AND (
            r.phone = ${phoneNumber}
            OR r.phone = ${normalized}
            OR ('+' || r.phone) = ${phoneNumber}
            OR regexp_replace(r.phone, '[^0-9]', '', 'g') = ${digitsOnly}
          )
        ORDER BY r.created_at DESC
        LIMIT 1
      `);
      console.log(`🔍 [HUNTER-CTX] Step 5: Query returned ${lsr.rows.length} rows`);
      if (lsr.rows.length > 0) {
        const row = lsr.rows[0] as any;
        console.log(`🔍 [HUNTER-CTX] Found via direct phone match → ${row.business_name} (score: ${row.ai_compatibility_score})`);
        return mapRow(row);
      }
    }

    console.log(`🔍 [HUNTER-CTX] No Hunter context found for consultant=${consultantId.substring(0, 8)}... phone=${phoneNumber || 'N/A'} email=${email || 'N/A'}`);
    return null;
  } catch (err: any) {
    console.error(`⚠️ [HUNTER-CTX] Error resolving context: ${err.message}`, err.stack);
    return null;
  }
}

function mapRow(row: any): HunterLeadContext {
  return {
    businessName: row.business_name || null,
    sector: row.category || null,
    score: row.ai_compatibility_score || null,
    website: row.website || null,
    aiSalesSummary: row.ai_sales_summary || null,
    leadStatus: row.lead_status || null,
    leadId: row.id || null,
  };
}

export function formatHunterContextForPrompt(ctx: HunterLeadContext): string {
  const parts: string[] = [];
  parts.push(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  parts.push(`📋 CONTESTO BUSINESS (da CRM Hunter)`);
  parts.push(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  if (ctx.businessName) parts.push(`• Azienda: ${ctx.businessName}`);
  if (ctx.sector) parts.push(`• Settore: ${ctx.sector}`);
  if (ctx.score) parts.push(`• Score compatibilità: ${ctx.score}/100`);
  if (ctx.website) parts.push(`• Sito web: ${ctx.website}`);
  if (ctx.leadStatus) parts.push(`• Stato lead: ${ctx.leadStatus}`);
  if (ctx.aiSalesSummary) {
    const summary = ctx.aiSalesSummary.length > 1500
      ? ctx.aiSalesSummary.substring(0, 1500) + '...'
      : ctx.aiSalesSummary;
    parts.push(`\n📊 Analisi AI:\n${summary}`);
  }
  parts.push(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  return parts.join('\n');
}
