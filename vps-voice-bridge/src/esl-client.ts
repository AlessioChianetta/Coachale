import { config } from './config.js';
import { logger } from './logger.js';
import { setExpectedCallId } from './voice-bridge-server.js';
import { notifyAmdResult } from './caller-context.js';
import { sessionManager } from './session-manager.js';
import esl from 'modesl';

const log = logger.child('ESL');

export const callMetadata = new Map<string, { callerIdNumber: string, callerIdName: string, calledNumber?: string, parkTime?: number, amdEnabled?: boolean }>();

export const outboundCallIdMap = new Map<string, string>();

const pendingAnswers = new Map<string, number>();

const amdDetectedCalls = new Set<string>();

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

function startAmdViaEsl(conn: any, uuid: string, source: string): void {
  log.info(`🤖 [AMD] Starting AMD detection via ESL (${source}) for uuid=${uuid}`);
  (conn as any).bgapi(`uuid_execute ${uuid} amd`, (res: any) => {
    const body = res?.getBody?.() || String(res);
    log.info(`🤖 [AMD] uuid_execute result uuid=${uuid} response=${body}`);
  });
}

function startAudioStream(conn: any, uuid: string, tStart: number): void {
  (conn as any).bgapi(`uuid_setvar_multi ${uuid} STREAM_PLAYBACK=true;STREAM_SAMPLE_RATE=8000;mod_audio_stream_bidirectional=true;jitterbuffer_msec=60:120`);

  const wsUrl = `ws://172.17.0.1:${config.ws.port}/stream/${uuid}`;
  const streamCmd = `uuid_audio_stream ${uuid} start ${wsUrl} mono 8000`;

  const tStreamCmd = Date.now();
  log.info(`⏱️ [ESL-TIMING] Executing uuid_audio_stream after ${tStreamCmd - tStart}ms`, { uuid });

  (conn as any).bgapi(streamCmd, (res: any) => {
    const tStreamDone = Date.now();
    const body = res.getBody();
    if (body && body.includes('+OK')) {
      log.info(`✅ Audio stream started in ${tStreamDone - tStreamCmd}ms (total: ${tStreamDone - tStart}ms)`, { uuid });
    } else {
      log.error(`❌ Failed to start audio stream`, { uuid, error: body || 'Unknown error' });
    }
  });
}

export function startESLController(): void {
  log.info(`Connecting to FreeSWITCH ESL at ${config.esl.host}:${config.esl.port}...`);

  const conn = new esl.Connection(config.esl.host, config.esl.port, config.esl.password, () => {
    log.info('✅ Connected to FreeSWITCH Event Socket!');
    eslConn = conn;
    conn.subscribe(['CHANNEL_PARK', 'CHANNEL_ANSWER', 'CHANNEL_HANGUP', 'CUSTOM']);
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

    const techPrefix = config.sip.techPrefix || '';
    const cleanDest = techPrefix && dest?.startsWith(techPrefix) ? dest.slice(techPrefix.length) : dest;
    const cleanCallerId = techPrefix && callerIdNumber?.startsWith(techPrefix) ? callerIdNumber.slice(techPrefix.length) : callerIdNumber;

    log.info(`🅿️  Call parked type=${isOutbound ? 'OUTBOUND' : 'INBOUND'}`, { uuid, callerIdNumber: cleanCallerId, calledNumber: cleanDest });
    log.info(`⏱️ [ESL-TIMING] CHANNEL_PARK at ${tPark}`, { uuid });

    const existingMeta = callMetadata.get(uuid);
    if (existingMeta) {
      existingMeta.callerIdNumber = cleanCallerId;
      existingMeta.callerIdName = callerIdName;
      existingMeta.calledNumber = cleanDest;
      existingMeta.parkTime = tPark;
    } else {
      callMetadata.set(uuid, { callerIdNumber: cleanCallerId, callerIdName, calledNumber: cleanDest, parkTime: tPark });
    }

    if (isOutbound) {
      const callId = outboundCallIdMap.get(uuid);
      if (callId) {
        log.info(`📞 OUTBOUND call parked — linking callId=${callId} to uuid=${uuid}`, { uuid });
        setExpectedCallId(callId, uuid);
        outboundCallIdMap.delete(uuid);
      } else {
        log.warn(`📞 OUTBOUND call parked but no callId mapping found for uuid=${uuid}`);
        setExpectedCallId(uuid, uuid);
      }

      if (pendingAnswers.has(uuid)) {
        const tAnswer = pendingAnswers.get(uuid)!;
        pendingAnswers.delete(uuid);
        log.info(`🔄 [CHANNEL_PARK] CHANNEL_ANSWER already arrived for uuid=${uuid} — starting audio stream now`);
        startAudioStream(conn, uuid, tAnswer);
        const parkMeta = callMetadata.get(uuid);
        if (parkMeta?.amdEnabled) {
          startAmdViaEsl(conn, uuid, 'PARK-pendingAnswer');
        }
      }
    } else {
      setExpectedCallId(uuid);
      log.info(`📞 INBOUND call parked — uuid=${uuid}`);

      startAudioStream(conn, uuid, tPark);
    }
  });

  conn.on('esl::event::CHANNEL_ANSWER::*', (event: any) => {
    const uuid = event.getHeader('Unique-ID');
    const otherLegUuid = event.getHeader('Other-Leg-Unique-ID') || '';
    const direction = event.getHeader('Call-Direction') || '';
    const dest = event.getHeader('Caller-Destination-Number') || '';
    const callerNum = event.getHeader('Caller-Caller-ID-Number') || '';
    const isOutbound = uuid.startsWith('outbound-');

    log.info(`🔍 [CHANNEL_ANSWER DEBUG] uuid=${uuid} otherLeg=${otherLegUuid} direction=${direction} dest=${dest} caller=${callerNum} isOutbound=${isOutbound}`);

    let resolvedUuid = uuid;
    if (!isOutbound && otherLegUuid?.startsWith('outbound-')) {
      resolvedUuid = otherLegUuid;
      log.info(`🔄 [CHANNEL_ANSWER] B-leg answered, resolving to A-leg uuid=${resolvedUuid}`);
    } else if (!isOutbound) {
      return;
    }

    const meta = callMetadata.get(resolvedUuid);
    if (!meta) {
      log.info(`⏳ [CHANNEL_ANSWER] No metadata yet for uuid=${resolvedUuid} — CHANNEL_PARK may arrive later, queuing for retry`);
      pendingAnswers.set(resolvedUuid, Date.now());

      setTimeout(() => {
        if (pendingAnswers.has(resolvedUuid)) {
          const retryMeta = callMetadata.get(resolvedUuid);
          if (retryMeta) {
            pendingAnswers.delete(resolvedUuid);
            log.info(`🔄 [CHANNEL_ANSWER] Retry found metadata for uuid=${resolvedUuid} — starting audio stream`);
            startAudioStream(conn, resolvedUuid, Date.now());
            if (retryMeta.amdEnabled) {
              startAmdViaEsl(conn, resolvedUuid, 'ANSWER-retry');
            }
          } else {
            log.warn(`⚠️ [CHANNEL_ANSWER] Retry still no metadata for uuid=${resolvedUuid} after 200ms`);
            pendingAnswers.delete(resolvedUuid);
            const preRegistered = outboundCallIdMap.get(resolvedUuid);
            if (preRegistered) {
              log.info(`🔄 [CHANNEL_ANSWER] Using pre-registered callId=${preRegistered}, starting audio stream anyway`);
              setExpectedCallId(preRegistered, resolvedUuid);
              startAudioStream(conn, resolvedUuid, Date.now());
              const fallbackMeta = callMetadata.get(resolvedUuid);
              if (fallbackMeta?.amdEnabled) {
                startAmdViaEsl(conn, resolvedUuid, 'ANSWER-preRegistered');
              }
            }
          }
        }
      }, 200);
      return;
    }

    const tAnswer = Date.now();
    const ringTime = meta.parkTime ? tAnswer - meta.parkTime : 0;

    if (amdDetectedCalls.has(resolvedUuid)) {
      log.info(`📵 [CHANNEL_ANSWER] Skipping audio stream — AMD detected machine for uuid=${resolvedUuid}`);
      return;
    }

    log.info(`📞 OUTBOUND call ANSWERED — starting audio stream`, { uuid: resolvedUuid, ringTimeMs: ringTime });

    startAudioStream(conn, resolvedUuid, tAnswer);

    if (meta.amdEnabled) {
      startAmdViaEsl(conn, resolvedUuid, 'ANSWER-direct');
    }
  });

  conn.on('esl::event::CHANNEL_HANGUP::*', (event: any) => {
    const uuid = event.getHeader('Unique-ID');
    if (callMetadata.has(uuid)) {
      log.debug(`🛑 Call ended`, { uuid });
      callMetadata.delete(uuid);
    }
    outboundCallIdMap.delete(uuid);
    pendingAnswers.delete(uuid);
    amdDetectedCalls.delete(uuid);

    if (sessionManager.isInOverflow(uuid)) {
      log.info(`📤 [OVERFLOW] Call ${uuid} hung up while in overflow queue — removing`);
      sessionManager.removeFromOverflow(uuid);
    }
  });

  conn.on('esl::event::CUSTOM::*', (event: any) => {
    const subclass = event.getHeader('Event-Subclass') || '';
    if (subclass !== 'amd::resolve') return;

    const uuid = event.getHeader('Unique-ID');
    const amdResult = event.getHeader('variable_amd_result') || event.getHeader('amd_result') || 'unknown';
    const amdCause = event.getHeader('variable_amd_cause') || event.getHeader('amd_cause') || '';

    log.info(`🤖 [AMD] Detection result uuid=${uuid} result=${amdResult} cause=${amdCause}`);

    if (!uuid?.startsWith('outbound-')) return;

    if (amdResult.toLowerCase() === 'machine') {
      amdDetectedCalls.add(uuid);
      log.info(`📵 [AMD] Machine/voicemail detected — hanging up call uuid=${uuid}`);

      const callId = outboundCallIdMap.get(uuid);
      if (callId) {
        notifyAmdResult(callId, amdResult).catch(err => {
          log.warn(`[AMD] Failed to notify Replit about AMD result`, { error: err?.message });
        });
      }

      if (eslConn) {
        (eslConn as any).bgapi(`uuid_kill ${uuid} NORMAL_CLEARING`, (res: any) => {
          log.info(`[AMD] Hangup sent for uuid=${uuid} response=${res?.getBody?.() || res}`);
        });
      }
    } else {
      log.info(`✅ [AMD] Human detected uuid=${uuid} — proceeding with audio stream`);
    }
  });

  conn.on('error', (err: any) => {
    log.error('❌ ESL Connection Error', { error: err?.message || err });
    eslConn = null;
    setTimeout(() => startESLController(), 5000);
  });
}
