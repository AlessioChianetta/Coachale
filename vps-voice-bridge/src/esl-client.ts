import { config } from './config.js';
import { logger } from './logger.js';
import { setExpectedCallId } from './voice-bridge-server.js';
import esl from 'modesl';

const log = logger.child('ESL');

export const callMetadata = new Map<string, { callerIdNumber: string, callerIdName: string, calledNumber?: string, parkTime?: number }>();

export const outboundCallIdMap = new Map<string, string>();

let eslConn: any = null;

export function getEslConnection(): any {
  return eslConn;
}

export function originateOutboundCall(dialString: string): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!eslConn) {
      return reject(new Error('ESL connection not available'));
    }
    log.info(`[OUTBOUND] Executing originate: ${dialString}`);
    (eslConn as any).bgapi(`originate ${dialString}`, (res: any) => {
      const body: string = res.getBody ? res.getBody() : String(res);
      log.info(`[OUTBOUND] Originate result response=${body}`);
      if (body && body.startsWith('+OK')) {
        const uuid = body.replace('+OK ', '').trim();
        resolve(uuid);
      } else {
        reject(new Error(`FreeSWITCH error: ${body}`));
      }
    });
  });
}

export function startESLController(): void {
  log.info(`Connecting to FreeSWITCH ESL at ${config.esl.host}:${config.esl.port}...`);

  const conn = new esl.Connection(config.esl.host, config.esl.port, config.esl.password, () => {
    log.info('✅ Connected to FreeSWITCH Event Socket!');
    eslConn = conn;
    conn.subscribe(['CHANNEL_PARK', 'CHANNEL_HANGUP']);
  });

  conn.on('esl::event::CHANNEL_PARK::*', (event: any) => {
    const tPark = Date.now();
    const uuid = event.getHeader('Unique-ID');
    const dest = event.getHeader('Caller-Destination-Number');
    const isOutbound = uuid.startsWith('outbound-');

    if (!isOutbound) {
      const isInbound = /^(\+?3[0-9]{8,12}|[0-9]{4,12})$/.test(dest || '');
      if (!isInbound) return;
    }

    const callerIdNumber = event.getHeader('Caller-Caller-ID-Number') || 'unknown';
    const callerIdName = event.getHeader('Caller-Caller-ID-Name') || '';

    log.info(`🅿️  Call parked type=${isOutbound ? 'OUTBOUND' : 'INBOUND'}`, { uuid, callerIdNumber, calledNumber: dest });
    log.info(`⏱️ [ESL-TIMING] CHANNEL_PARK at ${tPark}`, { uuid });

    callMetadata.set(uuid, { callerIdNumber, callerIdName, calledNumber: dest, parkTime: tPark });

    if (isOutbound) {
      const callId = outboundCallIdMap.get(uuid);
      if (callId) {
        log.info(`📞 OUTBOUND call parked — linking callId=${callId} to uuid=${uuid}`);
        setExpectedCallId(callId, uuid);
        outboundCallIdMap.delete(uuid);
      } else {
        log.warn(`📞 OUTBOUND call parked but no callId mapping found for uuid=${uuid}`);
        setExpectedCallId(uuid, uuid);
      }
    } else {
      setExpectedCallId(uuid);
      log.info(`📞 INBOUND call parked — uuid=${uuid}`);
    }

    (conn as any).bgapi(`uuid_setvar_multi ${uuid} STREAM_PLAYBACK=true;STREAM_SAMPLE_RATE=8000;mod_audio_stream_bidirectional=true;jitterbuffer_msec=60:120`);

    const wsUrl = `ws://172.17.0.1:${config.ws.port}/stream/${uuid}`;
    const streamCmd = `uuid_audio_stream ${uuid} start ${wsUrl} mono 8000`;

    const tStreamCmd = Date.now();
    log.info(`⏱️ [ESL-TIMING] Executing uuid_audio_stream after ${tStreamCmd - tPark}ms`, { uuid });

    (conn as any).bgapi(streamCmd, (res: any) => {
        const tStreamDone = Date.now();
        const body = res.getBody();
        if (body && body.includes('+OK')) {
            log.info(`✅ Audio stream started in ${tStreamDone - tStreamCmd}ms (total: ${tStreamDone - tPark}ms)`, { uuid });
        } else {
            log.error(`❌ Failed to start audio stream`, { uuid, error: body || 'Unknown error' });
        }
    });
  });

  conn.on('esl::event::CHANNEL_HANGUP::*', (event: any) => {
    const uuid = event.getHeader('Unique-ID');
    if (callMetadata.has(uuid)) {
      log.debug(`🛑 Call ended`, { uuid });
      callMetadata.delete(uuid);
    }
    outboundCallIdMap.delete(uuid);
  });

  conn.on('error', (err: any) => {
    log.error('❌ ESL Connection Error', { error: err?.message || err });
    eslConn = null;
    setTimeout(() => startESLController(), 5000);
  });
}
