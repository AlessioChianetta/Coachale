/**
 * Outbound Call Handler for VPS Voice Bridge
 * 
 * Gestisce le chiamate in uscita ricevute da Replit.
 * Comunica con FreeSWITCH per originare la chiamata.
 */

import { logger } from './logger.js';
import { config } from './config.js';

const log = logger.child('OUTBOUND');

interface OutboundCallRequest {
  targetPhone: string;
  callId: string;
  aiMode: string;
  customPrompt?: string;
}

interface OutboundCallResponse {
  success: boolean;
  callId?: string;
  freeswitchUuid?: string;
  error?: string;
}

/**
 * Valida il numero di telefono
 */
function validatePhoneNumber(phone: string): boolean {
  const cleanPhone = phone.replace(/[\s\-\(\)]/g, '');
  return /^\+?[1-9]\d{6,14}$/.test(cleanPhone);
}

/**
 * Esegue il comando originate su FreeSWITCH via ESL
 * 
 * NOTA: Richiede connessione ESL a FreeSWITCH
 * Il formato del comando originate dipende dalla configurazione del trunk SIP
 */
async function originateCall(targetPhone: string, callId: string): Promise<{ uuid: string }> {
  // TODO: Implementare connessione ESL a FreeSWITCH
  // 
  // Esempio comando originate:
  // originate {origination_caller_id_number=NUMERO_CENTRALINO}sofia/gateway/TRUNK/${targetPhone} &bridge(user/ai-bridge)
  //
  // Dove:
  // - TRUNK è il nome del gateway SIP configurato in FreeSWITCH
  // - ai-bridge è l'estensione che connette al WebSocket bridge
  //
  // Per ora, simuliamo la risposta per test
  
  log.info('Originate call requested', { targetPhone, callId });
  
  // Placeholder - in produzione questo userà ESL
  throw new Error('ESL connection not implemented yet. Configure FreeSWITCH ESL connection.');
}

/**
 * Handler per richieste di chiamata in uscita
 */
export async function handleOutboundCall(req: OutboundCallRequest): Promise<OutboundCallResponse> {
  const { targetPhone, callId, aiMode } = req;
  
  log.info('Received outbound call request', { callId, targetPhone, aiMode });
  
  // Validazione
  if (!validatePhoneNumber(targetPhone)) {
    log.warn('Invalid phone number', { targetPhone });
    return { success: false, error: 'Invalid phone number format' };
  }
  
  if (!callId) {
    return { success: false, error: 'Missing callId' };
  }
  
  try {
    // Esegui originate su FreeSWITCH
    const result = await originateCall(targetPhone, callId);
    
    log.info('Call originated successfully', { callId, uuid: result.uuid });
    
    return {
      success: true,
      callId,
      freeswitchUuid: result.uuid,
    };
  } catch (error: any) {
    log.error('Failed to originate call', { callId, error: error.message });
    return {
      success: false,
      callId,
      error: error.message,
    };
  }
}

/**
 * Setup dell'endpoint HTTP per chiamate in uscita
 * Da aggiungere al server principale
 */
export function setupOutboundEndpoint(server: any): void {
  // POST /outbound/call
  // Body: { targetPhone, callId, aiMode, customPrompt? }
  // Headers: Authorization: Bearer <service_token>
  
  log.info('Outbound endpoint ready at POST /outbound/call');
}
