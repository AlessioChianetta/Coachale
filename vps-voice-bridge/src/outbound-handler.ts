/**
 * Outbound Call Handler for VPS Voice Bridge
 *
 * Gestisce le chiamate in uscita ricevute da Replit.
 * Comunica con FreeSWITCH via ESL per originare la chiamata.
 * Supporta caller ID per-tenant: ogni consulente usa il suo numero Telnyx.
 */

import { logger } from './logger.js';
import { config } from './config.js';
import { originateOutboundCall, outboundCallIdMap } from './esl-client.js';

const log = logger.child('OUTBOUND');

interface OutboundCallRequest {
  targetPhone: string;
  callId: string;
  aiMode: string;
  customPrompt?: string;
  sipCallerId?: string;
  sipGateway?: string;
}

interface OutboundCallResponse {
  success: boolean;
  callId?: string;
  freeswitchUuid?: string;
  error?: string;
}

function validatePhoneNumber(phone: string): boolean {
  const cleanPhone = phone.replace(/[\s\-\(\)]/g, '');
  return /^(\+?[1-9]\d{6,14}|\d{3,6})$/.test(cleanPhone);
}

export async function handleOutboundCall(req: OutboundCallRequest): Promise<OutboundCallResponse> {
  const { targetPhone, callId, aiMode, sipCallerId, sipGateway } = req;

  log.info(`[BRIDGE:OUTBOUND] Received outbound call request callId=${callId} targetPhone=${targetPhone} aiMode=${aiMode}`);

  if (!validatePhoneNumber(targetPhone)) {
    log.warn('Invalid phone number', { targetPhone });
    return { success: false, error: 'Invalid phone number format' };
  }

  if (!callId) {
    return { success: false, error: 'Missing callId' };
  }

  const callerId = sipCallerId || config.sip.callerId;
  const gateway = sipGateway || config.sip.gateway;

  const isLocalExtension = /^\d{3,4}$/.test(targetPhone) && !targetPhone.startsWith('+');

  const uuid = `outbound-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  let dialString: string;

  if (isLocalExtension) {
    log.info(`[BRIDGE:OUTBOUND] Calling LOCAL extension ${targetPhone} (no gateway, no tech prefix)`);
    dialString = `{origination_caller_id_number=${callerId},effective_caller_id_number=${callerId},originate_timeout=30,origination_uuid=${uuid}}user/${targetPhone} &park()`;
  } else {
    log.info(`[BRIDGE:OUTBOUND] Calling PSTN number via gateway phone=${targetPhone} gateway=${gateway} callerId=${callerId}`);
    const techPrefix = config.sip.techPrefix || '';
    const dialTarget = techPrefix ? `${techPrefix}${targetPhone}` : targetPhone;
    dialString = `{origination_caller_id_number=${callerId},effective_caller_id_number=${callerId},originate_timeout=30,origination_uuid=${uuid}}sofia/gateway/${gateway}/${dialTarget} &park()`;
  }

  log.info(`[BRIDGE:OUTBOUND] Executing originate command uuid=${uuid} dialString=${dialString}`);

  try {
    const resultUuid = await originateOutboundCall(dialString);
    const finalUuid = resultUuid || uuid;

    outboundCallIdMap.set(finalUuid, callId);
    log.info(`[BRIDGE:OUTBOUND] Call originated callId=${callId} uuid=${finalUuid} — callId mapped for CHANNEL_PARK`);

    return {
      success: true,
      callId,
      freeswitchUuid: finalUuid,
    };
  } catch (error: any) {
    log.error(`[BRIDGE:OUTBOUND] Failed to originate call callId=${callId} error=${error.message}`);
    return {
      success: false,
      callId,
      error: error.message,
    };
  }
}
