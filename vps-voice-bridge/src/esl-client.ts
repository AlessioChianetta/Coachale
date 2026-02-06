import { config } from './config.js';
import { logger } from './logger.js';
import { setExpectedCallId } from './voice-bridge-server.js';
import esl from 'modesl';

const log = logger.child('ESL');

// Mappa per memorizzare caller info per UUID
export const callMetadata = new Map<string, { callerIdNumber: string, callerIdName: string }>();

export function startESLController(): void {
  log.info(`Connecting to FreeSWITCH ESL at ${config.esl.host}:${config.esl.port}...`);

  const conn = new esl.Connection(config.esl.host, config.esl.port, config.esl.password, () => {
    log.info('✅ Connected to FreeSWITCH Event Socket!');
    conn.subscribe(['CHANNEL_PARK', 'CHANNEL_HANGUP']);
  });

  conn.on('esl::event::CHANNEL_PARK::*', (event: any) => {
    const uuid = event.getHeader('Unique-ID');
    const dest = event.getHeader('Caller-Destination-Number');

    if (dest !== '9999') return;

    const callerIdNumber = event.getHeader('Caller-Caller-ID-Number') || 'unknown';
    const callerIdName = event.getHeader('Caller-Caller-ID-Name') || '';

    log.info(`🅿️  Detected call to 9999 (Parked)`, { uuid, callerIdNumber, callerIdName });

    // Salva metadata per questo UUID
    callMetadata.set(uuid, { callerIdNumber, callerIdName });

    // 🎯 FIX: Per chiamate OUTBOUND, l'outbound-handler ha già impostato il callId corretto (sc_xxx)
    // Per chiamate INBOUND, usiamo l'UUID come callId
    if (uuid.startsWith('outbound-')) {
      log.info(`📞 OUTBOUND call detected - using existing scheduled call ID`, { uuid });
    } else {
      // INBOUND: imposta l'UUID come pending call
      setExpectedCallId(uuid);
      log.info(`📞 INBOUND call - setting UUID as call ID`, { uuid });
    }

    // 1. Configurazione Audio Base
    (conn as any).bgapi(`uuid_setvar ${uuid} STREAM_PLAYBACK true`);
    (conn as any).bgapi(`uuid_setvar ${uuid} STREAM_SAMPLE_RATE 8000`);
    (conn as any).bgapi(`uuid_setvar ${uuid} mod_audio_stream_bidirectional true`);

    // 2. JITTERBUFFER (Elimina il packet loss iniziale e i "salti" audio)
    (conn as any).bgapi(`uuid_setvar ${uuid} jitterbuffer_msec 60:120`);

    // 3. Background audio: gestito da Node.js background-mixer (NON da FreeSWITCH)
    // uuid_displace rimosso: causava 30% packet loss per conflitto media bug con mod_audio_stream

    // 4. 🎯 FIX: Passa l'UUID come PATH nell'URL WebSocket (non query param!)
    const wsUrl = `ws://172.17.0.1:${config.ws.port}/stream/${uuid}`;
    const streamCmd = `uuid_audio_stream ${uuid} start ${wsUrl} mono 8000`;

    log.debug(`🚀 Executing stream command on PARKED call`, { cmd: streamCmd, wsUrl });

    (conn as any).bgapi(streamCmd, (res: any) => {
        const body = res.getBody();
        if (body && body.includes('+OK')) {
            log.info(`✅ Audio stream initiated successfully`, { uuid });
        } else {
            log.error(`❌ Failed to start audio stream`, { uuid, error: body || 'Unknown error' });
        }
    });
  });

  conn.on('esl::event::CHANNEL_HANGUP::*', (event: any) => {
    const uuid = event.getHeader('Unique-ID');
    const dest = event.getHeader('Caller-Destination-Number');
    if (dest === '9999') {
      log.debug(`🛑 Call 9999 ended`, { uuid });
      callMetadata.delete(uuid);
    }
  });

  conn.on('error', (err: any) => {
    log.error('❌ ESL Connection Error', { error: err?.message || err });
    setTimeout(() => startESLController(), 5000);
  });
}