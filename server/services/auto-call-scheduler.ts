import { db } from '../db';
import { sql } from 'drizzle-orm';

interface AutoCallParams {
  consultantId: string;
  phoneNumber: string;
  leadName: string;
  callInstruction?: string;
  leadInfo?: {
    obiettivi?: string;
    desideri?: string;
    uncino?: string;
    fonte?: string;
  };
  source?: string;
  delayMinutes?: number;
}

interface AutoCallResult {
  success: boolean;
  callId?: string;
  scheduledAt?: Date;
  skipped?: boolean;
  skipReason?: string;
}

function generateAutoCallId(): string {
  const ts = Date.now();
  const rand = Math.random().toString(36).substring(2, 7);
  return `autocall_${ts}_${rand}`;
}

function buildLeadContext(leadName: string, leadInfo?: AutoCallParams['leadInfo']): string | null {
  const parts: string[] = [];

  parts.push(`Nome: ${leadName}`);

  if (leadInfo?.obiettivi) {
    parts.push(`Obiettivi: ${leadInfo.obiettivi}`);
  }
  if (leadInfo?.desideri) {
    parts.push(`Desideri: ${leadInfo.desideri}`);
  }
  if (leadInfo?.uncino) {
    parts.push(`Angolo conversazione: ${leadInfo.uncino}`);
  }
  if (leadInfo?.fonte) {
    parts.push(`Fonte: ${leadInfo.fonte}`);
  }

  return parts.length > 1 ? parts.join('\n') : null;
}

export async function scheduleAutoCall(params: AutoCallParams): Promise<AutoCallResult> {
  const {
    consultantId,
    phoneNumber,
    leadName,
    callInstruction,
    leadInfo,
    source = 'auto',
    delayMinutes = 0,
  } = params;

  try {
    const existingResult = await db.execute(sql`
      SELECT id FROM scheduled_voice_calls
      WHERE consultant_id = ${consultantId}
        AND target_phone = ${phoneNumber}
        AND status IN ('pending', 'scheduled', 'calling', 'retry_scheduled')
      LIMIT 1
    `);

    if (existingResult.rows.length > 0) {
      const existingId = (existingResult.rows[0] as any).id;
      console.log(`📞 [AUTO-CALL] Skipped: call already exists for ${phoneNumber} (${existingId})`);
      return { success: false, skipped: true, skipReason: `Call already scheduled: ${existingId}` };
    }

    const sipCheck = await db.execute(sql`
      SELECT sip_caller_id, use_vps_number FROM users WHERE id = ${consultantId}
    `);
    const sipRow = sipCheck.rows[0] as any;
    if (!sipRow?.use_vps_number && !sipRow?.sip_caller_id) {
      console.log(`📞 [AUTO-CALL] Skipped: consultant ${consultantId.substring(0, 8)} has no SIP configured`);
      return { success: false, skipped: true, skipReason: 'No SIP caller ID configured' };
    }

    const callId = generateAutoCallId();
    const leadContext = buildLeadContext(leadName, leadInfo);

    const delaySeconds = Math.max(delayMinutes * 60, 30);
    const scheduledAt = new Date(Date.now() + delaySeconds * 1000);

    await db.execute(sql`
      INSERT INTO scheduled_voice_calls (
        id, consultant_id, target_phone, scheduled_at, status, ai_mode,
        custom_prompt, call_instruction, instruction_type, attempts, max_attempts,
        priority
      ) VALUES (
        ${callId}, ${consultantId}, ${phoneNumber}, ${scheduledAt.toISOString()},
        'pending', 'outreach',
        ${leadContext}, ${callInstruction || null}, ${callInstruction ? 'task' : null}, 0, 3,
        5
      )
    `);

    const { getCallTimerManager } = await import('./call-timer-manager');
    const timerManager = getCallTimerManager();
    if (timerManager) {
      timerManager.scheduleTimer(callId, consultantId, scheduledAt);
    } else {
      console.warn(`📞 [AUTO-CALL] Timer manager not ready, call ${callId} will be picked up by reloadPendingCalls`);
    }

    console.log(`📞 [AUTO-CALL] Scheduled ${callId} for ${leadName} (${phoneNumber}) at ${scheduledAt.toISOString()} [source: ${source}]`);

    return { success: true, callId, scheduledAt };
  } catch (error: any) {
    console.error(`📞 [AUTO-CALL] Error scheduling call for ${phoneNumber}:`, error.message);
    return { success: false, skipped: false, skipReason: error.message };
  }
}

export async function scheduleAutoCallBatch(
  leads: AutoCallParams[],
  delayBetweenMinutes: number = 5
): Promise<{ total: number; scheduled: number; skipped: number; results: AutoCallResult[] }> {
  const results: AutoCallResult[] = [];
  let scheduled = 0;
  let skipped = 0;

  for (let i = 0; i < leads.length; i++) {
    const lead = leads[i];
    const adjustedLead = {
      ...lead,
      delayMinutes: (lead.delayMinutes || 0) + (i * delayBetweenMinutes),
    };

    const result = await scheduleAutoCall(adjustedLead);
    results.push(result);

    if (result.success) {
      scheduled++;
    } else {
      skipped++;
    }
  }

  console.log(`📞 [AUTO-CALL BATCH] ${scheduled} scheduled, ${skipped} skipped out of ${leads.length} leads`);
  return { total: leads.length, scheduled, skipped, results };
}
