/**
 * Outbound Call Handler for VPS Voice Bridge
 *
 * Gestisce le chiamate in uscita ricevute da Replit.
 * Comunica con FreeSWITCH via ESL per originare la chiamata.
 * Supporta caller ID per-tenant: ogni consulente usa il suo numero Telnyx.
 */

import { logger } from './logger.js';
import { config } from './config.js';
import { originateOutboundCall } from './esl-client.js';

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

  // Caller ID: usa quello del consulente (per-tenant), fallback al default di config
  const callerId = sipCallerId || config.sip.callerId;
  // Gateway: usa quello specificato, fallback al default di config (telnyx-ip)
  const gateway = sipGateway || config.sip.gateway;

  log.info(`[BRIDGE:OUTBOUND] Calling external number via gateway phone=${targetPhone} gateway=${gateway} callerId=${callerId}`);

  // Telnyx richiede tech prefix (0312) per identificare la connessione su sip.telnyx.com
  const techPrefix = config.sip.techPrefix || '';
  const dialTarget = techPrefix ? `${techPrefix}${targetPhone}` : targetPhone;

  const uuid = `outbound-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const dialString = `{origination_caller_id_number=${callerId},effective_caller_id_number=${callerId},originate_timeout=30,origination_uuid=${uuid}}sofia/gateway/${gateway}/${dialTarget} &park()`;

  log.info(`[BRIDGE:OUTBOUND] Executing originate command uuid=${uuid} dialString=${dialString}`);

  try {
    const resultUuid = await originateOutboundCall(dialString);

    log.info(`[BRIDGE:OUTBOUND] Call originated successfully callId=${callId} uuid=${resultUuid || uuid}`);

    return {
      success: true,
      callId,
      freeswitchUuid: resultUuid || uuid,
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
