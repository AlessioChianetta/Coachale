import { db } from "../db";
import { sql } from "drizzle-orm";

export interface LeadImportContext {
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  companyName: string | null;
  website: string | null;
  address: string | null;
  city: string | null;
  fonte: string | null;
  obiettivi: string | null;
  desideri: string | null;
  uncino: string | null;
  idealState: string | null;
  tags: string[];
  customFields: Record<string, any>;
  formAnswers: Record<string, string>;
  campaignName: string | null;
  extraFields: Record<string, any>;
  rawPayloadSnapshot: Record<string, any> | null;
}

function safeString(val: any): string | null {
  if (val === undefined || val === null || val === '') return null;
  if (typeof val === 'object') return JSON.stringify(val);
  return String(val);
}

function safeJsonParse(val: any): any {
  if (!val) return {};
  if (typeof val === 'object') return val;
  try {
    return JSON.parse(val);
  } catch {
    return {};
  }
}

function extractFormAnswers(leadInfo: any): Record<string, string> {
  const answers: Record<string, string> = {};
  if (!leadInfo) return answers;

  for (let i = 1; i <= 10; i++) {
    const key = `question${i}`;
    if (leadInfo[key]) {
      answers[key] = String(leadInfo[key]);
    }
  }

  if (leadInfo.formAnswers && typeof leadInfo.formAnswers === 'object') {
    for (const [k, v] of Object.entries(leadInfo.formAnswers)) {
      if (v !== null && v !== undefined && v !== '') {
        answers[k] = String(v);
      }
    }
  }

  return answers;
}

function extractCustomFields(leadInfo: any): Record<string, any> {
  const result: Record<string, any> = {};
  if (!leadInfo) return result;

  const cf = leadInfo.customFields || leadInfo.customData;
  if (!cf) return result;

  if (Array.isArray(cf)) {
    for (const item of cf) {
      if (item && typeof item === 'object') {
        const key = item.field || item.id || item.key || item.name;
        const value = item.value ?? item.val;
        if (key && value !== undefined && value !== null && value !== '') {
          result[String(key)] = value;
        }
      }
    }
  } else if (typeof cf === 'object') {
    for (const [k, v] of Object.entries(cf)) {
      if (v !== null && v !== undefined && v !== '') {
        result[k] = v;
      }
    }
  }

  return result;
}

function extractExtraFields(leadInfo: any): Record<string, any> {
  if (!leadInfo || typeof leadInfo !== 'object') return {};

  const knownKeys = new Set([
    'obiettivi', 'desideri', 'uncino', 'fonte', 'email', 'companyName',
    'website', 'address', 'city', 'state', 'postalCode', 'country',
    'customFields', 'customData', 'tags', 'dnd', 'dndSettings',
    'ghlContactId', 'ghlLocationId', 'assignedTo', 'dateAdded',
    'dateOfBirth', 'acContactId', 'list', 'firstName', 'lastName',
    'name', 'phone', 'phoneNumber',
    'question1', 'question2', 'question3', 'question4',
    'question5', 'question6', 'question7', 'question8', 'question9', 'question10',
    'formAnswers', 'rawPayloadSnapshot', 'idealState', 'currentState', 'mainObstacle',
  ]);

  const extra: Record<string, any> = {};
  for (const [k, v] of Object.entries(leadInfo)) {
    if (!knownKeys.has(k) && v !== null && v !== undefined && v !== '') {
      extra[k] = v;
    }
  }
  return extra;
}

export async function resolveLeadImportContext(params: {
  consultantId: string;
  proactiveLeadId?: string | null;
  phoneNumber?: string | null;
  email?: string | null;
}): Promise<LeadImportContext | null> {
  const { consultantId, proactiveLeadId, phoneNumber, email } = params;

  try {
    let lead: any = null;

    if (proactiveLeadId) {
      const result = await db.execute(sql`
        SELECT id, first_name, last_name, phone_number, email, lead_info,
               ideal_state, campaign_snapshot, metadata, status
        FROM proactive_leads
        WHERE id = ${proactiveLeadId}
          AND consultant_id = ${consultantId}
        LIMIT 1
      `);
      if (result.rows.length > 0) {
        lead = result.rows[0];
      }
    }

    if (!lead && phoneNumber) {
      const phoneDigits = phoneNumber.replace(/\D/g, '');
      const phoneNoPlus = phoneNumber.replace(/^\+/, '');
      const result = await db.execute(sql`
        SELECT id, first_name, last_name, phone_number, email, lead_info,
               ideal_state, campaign_snapshot, metadata, status
        FROM proactive_leads
        WHERE consultant_id = ${consultantId}
          AND (
            phone_number = ${phoneNumber}
            OR phone_number = ${phoneNoPlus}
            OR ('+' || phone_number) = ${phoneNumber}
            OR regexp_replace(phone_number, '[^0-9]', '', 'g') = ${phoneDigits}
          )
        ORDER BY created_at DESC
        LIMIT 1
      `);
      if (result.rows.length > 0) {
        lead = result.rows[0];
      }
    }

    if (!lead && email) {
      const normalizedEmail = email.toLowerCase().trim();
      const result = await db.execute(sql`
        SELECT id, first_name, last_name, phone_number, email, lead_info,
               ideal_state, campaign_snapshot, metadata, status
        FROM proactive_leads
        WHERE consultant_id = ${consultantId}
          AND LOWER(email) = ${normalizedEmail}
        ORDER BY created_at DESC
        LIMIT 1
      `);
      if (result.rows.length > 0) {
        lead = result.rows[0];
      }
    }

    if (!lead) {
      return null;
    }

    const leadInfo = safeJsonParse(lead.lead_info);
    const campaignSnapshot = safeJsonParse(lead.campaign_snapshot);

    const ctx: LeadImportContext = {
      firstName: lead.first_name || leadInfo.firstName || '',
      lastName: lead.last_name || leadInfo.lastName || '',
      email: lead.email || leadInfo.email || null,
      phone: lead.phone_number || null,
      companyName: leadInfo.companyName || null,
      website: leadInfo.website || null,
      address: [leadInfo.address, leadInfo.city, leadInfo.state, leadInfo.postalCode, leadInfo.country]
        .filter(Boolean).join(', ') || null,
      city: leadInfo.city || null,
      fonte: leadInfo.fonte || null,
      obiettivi: leadInfo.obiettivi || campaignSnapshot.obiettivi || null,
      desideri: leadInfo.desideri || campaignSnapshot.desideri || null,
      uncino: leadInfo.uncino || campaignSnapshot.uncino || null,
      idealState: lead.ideal_state || campaignSnapshot.statoIdeale || leadInfo.idealState || null,
      tags: Array.isArray(leadInfo.tags) ? leadInfo.tags : (typeof leadInfo.tags === 'string' ? leadInfo.tags.split(',').map((t: string) => t.trim()) : []),
      customFields: extractCustomFields(leadInfo),
      formAnswers: extractFormAnswers(leadInfo),
      campaignName: campaignSnapshot.name || null,
      extraFields: extractExtraFields(leadInfo),
      rawPayloadSnapshot: leadInfo.rawPayloadSnapshot || null,
    };

    console.log(`📦 [LEAD-IMPORT-CTX] Resolved context for lead ${lead.id}: fonte=${ctx.fonte}, campaign=${ctx.campaignName}, customFields=${Object.keys(ctx.customFields).length}, formAnswers=${Object.keys(ctx.formAnswers).length}, extraFields=${Object.keys(ctx.extraFields).length}`);

    return ctx;
  } catch (error: any) {
    console.error(`⚠️ [LEAD-IMPORT-CTX] Error resolving lead import context: ${error.message}`);
    return null;
  }
}

function flattenSnapshotForPrompt(snapshot: Record<string, any>, prefix = '', depth = 0): string[] {
  if (depth > 3) return [];
  const entries: string[] = [];
  const skipKeys = new Set(['rawPayloadSnapshot', 'dndSettings', 'dnd']);

  for (const [key, value] of Object.entries(snapshot)) {
    if (skipKeys.has(key)) continue;
    if (value === null || value === undefined || value === '') continue;

    const fullKey = prefix ? `${prefix}.${key}` : key;

    if (typeof value === 'object' && !Array.isArray(value)) {
      const nested = flattenSnapshotForPrompt(value, fullKey, depth + 1);
      entries.push(...nested);
    } else if (Array.isArray(value)) {
      const arrStr = value.map(v => typeof v === 'object' ? JSON.stringify(v) : String(v)).join(', ');
      if (arrStr.length < 400) {
        entries.push(`${fullKey}: ${arrStr}`);
      }
    } else {
      const strVal = String(value);
      if (strVal.length < 400) {
        entries.push(`${fullKey}: ${strVal}`);
      }
    }
  }

  return entries.slice(0, 30);
}

export function formatLeadImportContextForPrompt(ctx: LeadImportContext): string {
  const lines: string[] = [];

  lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  lines.push('📦 CONTESTO LEAD IMPORTATO');
  lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  lines.push('');
  lines.push('Hai a disposizione le seguenti informazioni su questo lead.');
  lines.push('Usale per personalizzare la conversazione e mostrare che conosci già la sua situazione.');
  lines.push('NON elencare tutti questi dati al lead. Usali in modo naturale nella conversazione.');
  lines.push('');

  if (ctx.firstName || ctx.lastName) {
    lines.push(`👤 Nome: ${ctx.firstName} ${ctx.lastName}`.trim());
  }
  if (ctx.email) lines.push(`📧 Email: ${ctx.email}`);
  if (ctx.companyName) lines.push(`🏢 Azienda: ${ctx.companyName}`);
  if (ctx.website) lines.push(`🌐 Sito web: ${ctx.website}`);
  if (ctx.address) lines.push(`📍 Indirizzo: ${ctx.address}`);
  if (ctx.fonte) lines.push(`📡 Fonte: ${ctx.fonte}`);
  if (ctx.campaignName) lines.push(`📣 Campagna: ${ctx.campaignName}`);

  if (ctx.tags.length > 0) {
    lines.push(`🏷️ Tag: ${ctx.tags.join(', ')}`);
  }

  if (ctx.obiettivi) lines.push(`🎯 Obiettivi: ${ctx.obiettivi}`);
  if (ctx.desideri) lines.push(`💫 Desideri: ${ctx.desideri}`);
  if (ctx.uncino) lines.push(`🪝 Uncino: ${ctx.uncino}`);
  if (ctx.idealState) lines.push(`⭐ Stato ideale: ${ctx.idealState}`);

  const answerKeys = Object.keys(ctx.formAnswers);
  if (answerKeys.length > 0) {
    lines.push('');
    lines.push('📝 RISPOSTE AL MODULO:');
    for (const [key, value] of Object.entries(ctx.formAnswers)) {
      const label = key.startsWith('question') ? `Domanda ${key.replace('question', '')}` : key;
      lines.push(`   • ${label}: ${value}`);
    }
  }

  const cfKeys = Object.keys(ctx.customFields);
  if (cfKeys.length > 0) {
    lines.push('');
    lines.push('📋 CAMPI PERSONALIZZATI:');
    for (const [key, value] of Object.entries(ctx.customFields)) {
      lines.push(`   • ${key}: ${typeof value === 'object' ? JSON.stringify(value) : value}`);
    }
  }

  const extraKeys = Object.keys(ctx.extraFields);
  if (extraKeys.length > 0) {
    lines.push('');
    lines.push('📎 DATI AGGIUNTIVI:');
    for (const [key, value] of Object.entries(ctx.extraFields)) {
      const displayValue = typeof value === 'object' ? JSON.stringify(value) : String(value);
      if (displayValue.length < 500) {
        lines.push(`   • ${key}: ${displayValue}`);
      }
    }
  }

  if (ctx.rawPayloadSnapshot && typeof ctx.rawPayloadSnapshot === 'object') {
    const snapshotEntries = flattenSnapshotForPrompt(ctx.rawPayloadSnapshot);
    if (snapshotEntries.length > 0) {
      lines.push('');
      lines.push('📎 DATI RAW IMPORTAZIONE (payload originale):');
      for (const entry of snapshotEntries) {
        lines.push(`   • ${entry}`);
      }
    }
  }

  lines.push('');
  lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  return lines.join('\n');
}
