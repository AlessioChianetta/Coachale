/**
 * Outbound Call Handler for VPS Voice Bridge
 *
 * Gestisce le chiamate in uscita ricevute da Replit.
 * Comunica con FreeSWITCH via ESL per originare la chiamata.
 * Supporta caller ID per-tenant: ogni consulente usa il suo numero Telnyx.
 */

import { logger } from './logger.js';
import { config } from './config.js';
import { originateOutboundCall, outboundCallIdMap, callMetadata } from './esl-client.js';

const log = logger.child('OUTBOUND');

interface OutboundCallRequest {
  targetPhone: string;
  callId: string;
  aiMode: string;
  customPrompt?: string;
  sipCallerId?: string;
  sipGateway?: string;
  amdEnabled?: boolean;
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
  const { targetPhone, callId, aiMode, sipCallerId, sipGateway, amdEnabled } = req;

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

  const normalizeForCompare = (p: string) => p.replace(/[\s\-\(\)\+]/g, '').replace(/^00/, '').replace(/^39/, '');
  if (normalizeForCompare(targetPhone) === normalizeForCompare(callerId)) {
    log.error(`[BRIDGE:OUTBOUND] SELF-CALL BLOCKED: target ${targetPhone} matches caller ${callerId}`);
    return { success: false, error: 'Self-call loop blocked: target matches caller ID' };
  }

  const isLocalExtension = /^\d{3,4}$/.test(targetPhone) && !targetPhone.startsWith('+');

  const uuid = `outbound-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  let dialString: string;

  if (isLocalExtension) {
    log.info(`[BRIDGE:OUTBOUND] Calling LOCAL extension ${targetPhone} (no gateway, no tech prefix) amdEnabled=${!!amdEnabled}`);
    dialString = `{origination_caller_id_number=${callerId},effective_caller_id_number=${callerId},originate_timeout=30,origination_uuid=${uuid}}user/${targetPhone} &park()`;
  } else {
    log.info(`[BRIDGE:OUTBOUND] Calling PSTN number via gateway phone=${targetPhone} gateway=${gateway} callerId=${callerId} amdEnabled=${!!amdEnabled}`);
    const techPrefix = config.sip.techPrefix || '';
    const dialTarget = techPrefix ? `${techPrefix}${targetPhone}` : targetPhone;
    dialString = `{origination_caller_id_number=${callerId},effective_caller_id_number=${callerId},originate_timeout=30,origination_uuid=${uuid}}sofia/gateway/${gateway}/${dialTarget} &park()`;
  }

  log.info(`[BRIDGE:OUTBOUND] Executing originate command uuid=${uuid} dialString=${dialString}`);

  outboundCallIdMap.set(uuid, callId);
  callMetadata.set(uuid, { callerIdNumber: callerId, callerIdName: '', calledNumber: targetPhone, amdEnabled: !!amdEnabled });
  log.info(`[BRIDGE:OUTBOUND] Pre-registered uuid=${uuid} → callId=${callId} + metadata (before originate)`);

  try {
    const resultUuid = await originateOutboundCall(dialString);
    const finalUuid = resultUuid || uuid;

    if (finalUuid !== uuid) {
      outboundCallIdMap.set(finalUuid, callId);
      const existingMeta = callMetadata.get(uuid);
      if (existingMeta) {
        callMetadata.set(finalUuid, existingMeta);
      }
      log.info(`[BRIDGE:OUTBOUND] FreeSWITCH returned different uuid=${finalUuid}, re-mapped from pre-registered uuid=${uuid}`);
    }

    log.info(`[BRIDGE:OUTBOUND] Call originated callId=${callId} uuid=${finalUuid}`);

    return {
      success: true,
      callId,
      freeswitchUuid: finalUuid,
    };
  } catch (error: any) {
    outboundCallIdMap.delete(uuid);
    callMetadata.delete(uuid);
    log.error(`[BRIDGE:OUTBOUND] Failed to originate call callId=${callId} error=${error.message}`);
    return {
      success: false,
      callId,
      error: error.message,
    };
  }
}
