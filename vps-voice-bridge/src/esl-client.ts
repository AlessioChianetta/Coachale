import { config } from './config.js';
import { logger } from './logger.js';
import { setExpectedCallId } from './voice-bridge-server.js';
import esl from 'modesl';

const log = logger.child('ESL');

// Mappa per memorizzare caller info per UUID
export const callMetadata = new Map<string, { callerIdNumber: string, callerIdName: string, parkTime?: number }>();

export function startESLController(): void {
  log.info(`Connecting to FreeSWITCH ESL at ${config.esl.host}:${config.esl.port}...`);

  const conn = new esl.Connection(config.esl.host, config.esl.port, config.esl.password, () => {
    log.info('✅ Connected to FreeSWITCH Event Socket!');
    conn.subscribe(['CHANNEL_PARK', 'CHANNEL_HANGUP']);
  });

  conn.on('esl::event::CHANNEL_PARK::*', (event: any) => {
    const tPark = Date.now();
    const uuid = event.getHeader('Unique-ID');
    const dest = event.getHeader('Caller-Destination-Number');

    if (dest !== '9999') return;

    const callerIdNumber = event.getHeader('Caller-Caller-ID-Number') || 'unknown';
    const callerIdName = event.getHeader('Caller-Caller-ID-Name') || '';

    log.info(`🅿️  Detected call to 9999 (Parked)`, { uuid, callerIdNumber, callerIdName });
    log.info(`⏱️ [ESL-TIMING] CHANNEL_PARK event received at ${tPark}`, { uuid });

    callMetadata.set(uuid, { callerIdNumber, callerIdName, parkTime: tPark });

    if (uuid.startsWith('outbound-')) {
      log.info(`📞 OUTBOUND call detected - using existing scheduled call ID`, { uuid });
    } else {
      setExpectedCallId(uuid);
      log.info(`📞 INBOUND call - setting UUID as call ID`, { uuid });
    }

    (conn as any).bgapi(`uuid_setvar_multi ${uuid} STREAM_PLAYBACK=true;STREAM_SAMPLE_RATE=8000;mod_audio_stream_bidirectional=true;jitterbuffer_msec=60:120`);

    const wsUrl = `ws://172.17.0.1:${config.ws.port}/stream/${uuid}`;
    const streamCmd = `uuid_audio_stream ${uuid} start ${wsUrl} mono 8000`;

    log.debug(`🚀 Executing stream command on PARKED call`, { cmd: streamCmd, wsUrl });

    const tStreamCmd = Date.now();
    log.info(`⏱️ [ESL-TIMING] bgapi commands setup: ${tStreamCmd - tPark}ms, now executing uuid_audio_stream`, { uuid });

    (conn as any).bgapi(streamCmd, (res: any) => {
        const tStreamDone = Date.now();
        const body = res.getBody();
        if (body && body.includes('+OK')) {
            log.info(`✅ Audio stream initiated successfully in ${tStreamDone - tStreamCmd}ms (total from PARK: ${tStreamDone - tPark}ms)`, { uuid });
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