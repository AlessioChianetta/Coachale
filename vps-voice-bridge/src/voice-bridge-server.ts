import { WebSocketServer, WebSocket } from 'ws';
import { createServer, type IncomingMessage } from 'http';
import express from 'express';
import { parse as parseUrl } from 'url';
import { config } from './config.js';
import { logger } from './logger.js';
import { sessionManager, syncOverflowAudio } from './session-manager.js';
import { ReplitWSClient } from './replit-ws-client.js';
import { convertForGemini, convertFromGemini } from './audio-converter.js';
import { fetchCallerContext, fetchNumberOwner, notifyCallStart, notifyCallEnd, fetchOverflowConfig } from './caller-context.js';
import { callMetadata, getEslConnection } from './esl-client.js';
import { handleOutboundCall } from './outbound-handler.js';
import {
  loadBackgroundAudio,
  isBackgroundLoaded,
  initSession as bgInitSession,
  destroySession as bgDestroySession,
  mixWithBackground,
  generateBackgroundChunk,
} from './background-mixer.js';

const log = logger.child('SERVER');

const bgTimers = new Map<string, NodeJS.Timeout>();
const recentlyDequeuedUuids = new Map<string, number>();

const audioOutputQueues = new Map<string, Buffer[]>();
const AUDIO_QUEUE_MAX = 2500;
const CHUNK_SIZE = 320;
const FADE_SAMPLES = 16;
const lastQueueHadAudio = new Map<string, boolean>();

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const blockedIps = new Map<string, number>();
const BLOCK_DURATION_MS = 10 * 60 * 1000;

function isAllowedIp(ip: string): boolean {
  return config.security.allowedIpPrefixes.some(prefix => ip.startsWith(prefix));
}

function normalizeIp(ip: string): string {
  if (ip.startsWith('::ffff:')) return ip.substring(7);
  return ip;
}

function checkRateLimit(ip: string): boolean {
  const now = Date.now();

  const blockedUntil = blockedIps.get(ip);
  if (blockedUntil && now < blockedUntil) {
    return false;
  } else if (blockedUntil) {
    blockedIps.delete(ip);
  }

  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + config.security.rateLimitWindowMs });
    return true;
  }

  entry.count++;
  if (entry.count > config.security.rateLimitMaxRequests) {
    blockedIps.set(ip, now + BLOCK_DURATION_MS);
    log.warn(`🚫 [SECURITY] IP ${ip} blocked for ${BLOCK_DURATION_MS / 1000}s — exceeded ${config.security.rateLimitMaxRequests} requests in ${config.security.rateLimitWindowMs / 1000}s`);
    return false;
  }
  return true;
}

setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of rateLimitMap) {
    if (now > entry.resetAt) rateLimitMap.delete(ip);
  }
  for (const [ip, until] of blockedIps) {
    if (now > until) blockedIps.delete(ip);
  }
}, 60000);

if (config.audio.backgroundEnabled) {
  loadBackgroundAudio();
  log.info('🎵 Background audio ENABLED');
} else {
  log.info('🔇 Background audio DISABLED (set BACKGROUND_AUDIO_ENABLED=true to enable)');
}

const pendingCalls = new Map<string, { callId: string; timer: NodeJS.Timeout }>();

export function setExpectedCallId(callId: string, freeswitchUuid?: string): void {
  const uuid = freeswitchUuid || callId;

  log.info(`📝 Setting expected call: callId=${callId}, uuid=${uuid}`);

  const existing = pendingCalls.get(uuid);
  if (existing) {
    clearTimeout(existing.timer);
    log.info(`🔄 Replacing existing pending call for uuid=${uuid}`);
  }

  const timer = setTimeout(() => {
    const deleted = pendingCalls.delete(uuid);
    if (deleted) {
      log.warn(`⏰ Pending call expired: callId=${callId}, uuid=${uuid} — killing FreeSWITCH call`);
      const eslConn = getEslConnection();
      if (eslConn) {
        (eslConn as any).bgapi(`uuid_kill ${uuid} NO_ANSWER`, (res: any) => {
          log.info(`⏰ [PENDING-EXPIRED] uuid_kill result for ${uuid}: ${res?.getBody?.() || 'no response'}`);
        });
      }
    }
  }, 120000);

  pendingCalls.set(uuid, { callId, timer });
  log.info(`✅ Pending calls count: ${pendingCalls.size}`);
}

function consumePendingCall(freeswitchUuid: string): string | null {
  const pending = pendingCalls.get(freeswitchUuid);
  if (pending) {
    clearTimeout(pending.timer);
    pendingCalls.delete(freeswitchUuid);
    log.info(`✅ Consumed pending call: callId=${pending.callId}, uuid=${freeswitchUuid}`);
    return pending.callId;
  }
  return null;
}

interface AudioStreamStartMessage {
  event: 'start';
  call_id: string;
  caller_id: string;
  called_number: string;
  codec: 'PCMU' | 'L16';
  sample_rate: number;
}

interface AudioStreamStopMessage {
  event: 'stop';
  call_id: string;
  reason: string;
}

type AudioStreamMessage = AudioStreamStartMessage | AudioStreamStopMessage;

function firstQueryValue(v: unknown): string {
  if (Array.isArray(v)) return typeof v[0] === 'string' ? v[0] : '';
  return typeof v === 'string' ? v : '';
}

function validateServiceToken(token: string | undefined): boolean {
  if (!token) return false;
  const expectedToken = config.serviceToken || process.env.REPLIT_SERVICE_TOKEN;
  return token === expectedToken;
}

const GHOST_CALL_MIN_SECS = 300;
const GHOST_WATCHDOG_INTERVAL_MS = 3 * 60 * 1000;

async function runGhostCallWatchdog(): Promise<void> {
  const eslConn = getEslConnection();
  if (!eslConn) return;

  try {
    const raw = await new Promise<string>((resolve) => {
      (eslConn as any).bgapi('show channels as json', (res: any) => {
        resolve(res?.getBody?.() || '{}');
      });
    });

    let parsed: any;
    try { parsed = JSON.parse(raw); } catch { return; }

    const rows: any[] = parsed?.rows || [];
    if (rows.length === 0) return;

    const activeFsUuids = new Set(
      sessionManager.getAllSessions().map((s) => s.fsUuid).filter(Boolean)
    );
    const overflowUuids = new Set(
      sessionManager.getOverflowDetails().entries.map((e) => e.uuid)
    );
    const pendingUuids = new Set(pendingCalls.keys());

    const nowSecs = Math.floor(Date.now() / 1000);
    let killed = 0;

    for (const row of rows) {
      const uuid: string = row.uuid;
      if (!uuid) continue;
      if (activeFsUuids.has(uuid)) continue;
      if (overflowUuids.has(uuid)) continue;
      if (pendingUuids.has(uuid)) continue;

      const createdEpoch: number = parseInt(row.created_epoch, 10) || 0;
      if (!createdEpoch) continue;
      const ageSecs = nowSecs - createdEpoch;

      if (ageSecs >= GHOST_CALL_MIN_SECS) {
        log.warn(`👻 [GHOST-WATCHDOG] Killing orphan channel uuid=${uuid} age=${ageSecs}s (no bridge session, not in overflow/pending)`);
        (eslConn as any).bgapi(`uuid_kill ${uuid} NORMAL_CLEARING`, (res: any) => {
          log.info(`👻 [GHOST-WATCHDOG] uuid_kill result for ${uuid}: ${res?.getBody?.() || 'no response'}`);
        });
        killed++;
      } else {
        log.info(`👻 [GHOST-WATCHDOG] Orphan channel uuid=${uuid} age=${ageSecs}s — under threshold (${GHOST_CALL_MIN_SECS}s), skipping`);
      }
    }

    if (killed > 0) {
      log.warn(`👻 [GHOST-WATCHDOG] Killed ${killed} ghost channel(s)`);
    }
  } catch (err: any) {
    log.error(`👻 [GHOST-WATCHDOG] Error: ${err.message}`);
  }
}

export function startVoiceBridgeServer(): void {
  sessionManager.setOnTimeoutCallback((sessionId, callId, fsUuid) => {
    log.warn(`⏰ [TIMEOUT-CALLBACK] Session ${sessionId.slice(0, 8)} timed out — cleaning up and hanging up FreeSWITCH call`, { callId, fsUuid });
    handleCallStop(callId, 'timeout');
    const eslConn = getEslConnection();
    if (eslConn) {
      (eslConn as any).bgapi(`uuid_kill ${fsUuid} NORMAL_CLEARING`, (res: any) => {
        log.info(`⏰ [TIMEOUT-CALLBACK] uuid_kill result for fsUuid=${fsUuid}: ${res?.getBody?.() || 'no response'}`);
      });
    }
  });

  setInterval(() => { runGhostCallWatchdog(); }, GHOST_WATCHDOG_INTERVAL_MS);
  log.info(`👻 [GHOST-WATCHDOG] Started — interval=${GHOST_WATCHDOG_INTERVAL_MS / 1000}s, threshold=${GHOST_CALL_MIN_SECS}s`);

  const app = express();
  app.use(express.json());

  app.use((req, res, next) => {
    const ip = normalizeIp(req.ip || req.socket.remoteAddress || 'unknown');
    if (!checkRateLimit(ip)) {
      log.warn(`🚫 [SECURITY] Rate limited HTTP request from ${ip}: ${req.method} ${req.path}`);
      return res.status(429).json({ error: 'Too many requests' });
    }
    next();
  });

  app.post('/outbound/call', async (req, res) => {
    const authHeader = req.headers.authorization;
    const token = authHeader?.replace('Bearer ', '');

    if (!validateServiceToken(token)) {
      const ip = normalizeIp(req.ip || req.socket.remoteAddress || 'unknown');
      log.warn(`🚫 [SECURITY] Unauthorized outbound request from ${ip}`);
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const { targetPhone, callId, aiMode, customPrompt, sipCallerId, sipGateway, amdEnabled } = req.body;

    if (!targetPhone || !callId) {
      return res.status(400).json({ success: false, error: 'Missing targetPhone or callId' });
    }

    const result = await handleOutboundCall({ targetPhone, callId, aiMode, customPrompt, sipCallerId, sipGateway, amdEnabled });

    if (result.success) {
      res.json(result);
    } else {
      res.status(500).json(result);
    }
  });

  app.get('/health', async (req, res) => {
    const overflow = sessionManager.getOverflowDetails();
    const stats = sessionManager.getStats();

    let freeswitchCalls: any[] = [];
    try {
      const eslConn = getEslConnection();
      if (eslConn) {
        const fsData = await new Promise<string>((resolve, reject) => {
          const timeout = setTimeout(() => reject(new Error('ESL timeout')), 3000);
          eslConn.api('show calls as json', (res: any) => {
            clearTimeout(timeout);
            resolve(res.getBody ? res.getBody() : String(res));
          });
        });
        try {
          const parsed = JSON.parse(fsData);
          const rows = parsed.rows || [];
          const nowEpoch = Math.floor(Date.now() / 1000);
          freeswitchCalls = rows.map((r: any) => ({
            uuid: r.uuid || r.call_uuid || '',
            direction: r.direction || '',
            callerNumber: r.cid_num || r.cid_name || '',
            calledNumber: r.dest || r.callee_num || '',
            state: r.state || '',
            callstate: r.callstate || '',
            createdEpoch: parseInt(r.created_epoch) || 0,
            durationSecs: nowEpoch - (parseInt(r.created_epoch) || nowEpoch),
          }));
        } catch {
          log.warn('Failed to parse FreeSWITCH show calls JSON');
        }
      }
    } catch (err: any) {
      log.warn(`FreeSWITCH show calls failed: ${err.message}`);
    }

    res.json({ 
      status: 'ok', 
      timestamp: new Date().toISOString(),
      pendingCalls: pendingCalls.size,
      blockedIps: blockedIps.size,
      activeSessions: stats.activeSessions,
      maxSessions: stats.maxSessions,
      activeByNumber: sessionManager.getActiveCountByNumber(),
      overflowCount: overflow.count,
      overflowEntries: overflow.entries,
      freeswitchCalls,
      freeswitchCallCount: freeswitchCalls.length,
    });
  });

  app.post('/freeswitch-kill', express.json(), (req, res) => {
    const authHeader = req.headers.authorization;
    const token = authHeader?.replace('Bearer ', '');

    if (!validateServiceToken(token)) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const { uuid } = req.body;
    if (!uuid || typeof uuid !== 'string') {
      return res.status(400).json({ success: false, error: 'Missing uuid' });
    }

    const eslConn = getEslConnection();
    if (!eslConn) {
      return res.status(503).json({ success: false, error: 'ESL not connected' });
    }

    log.info(`[FREESWITCH-KILL] Killing call uuid=${uuid}`);
    eslConn.bgapi(`uuid_kill ${uuid} NORMAL_CLEARING`, (result: any) => {
      const body = result.getBody ? result.getBody() : String(result);
      log.info(`[FREESWITCH-KILL] Result: ${body}`);
      if (body && body.startsWith('+OK')) {
        res.json({ success: true, result: body.trim() });
      } else {
        res.status(404).json({ success: false, error: body?.trim() || 'uuid_kill failed' });
      }
    });
  });

  const server = createServer(app);

  const wss = new WebSocketServer({ server });

  wss.on('connection', async (ws: WebSocket, req: IncomingMessage) => {
    const rawIp = req.socket.remoteAddress || 'unknown';
    const clientIp = normalizeIp(rawIp);

    if (!isAllowedIp(rawIp) && !isAllowedIp(clientIp)) {
      log.warn(`🚫 [SECURITY] Rejected WebSocket from unauthorized IP: ${clientIp}`);
      ws.close(1008, 'Unauthorized IP');
      return;
    }

    log.info(`New WebSocket connection`, { clientIp });

    let currentSessionId: string | null = null;
    let callId: string | null = null;

    const parsedUrl = parseUrl(req.url || '', true);
    const pathParts = (parsedUrl.pathname || '').split('/').filter(Boolean);
    const uuidFromUrl = pathParts.length >= 2 && pathParts[0] === 'stream' ? pathParts[1] : null;

    log.info('🔍 WEBSOCKET CONNECTION', { 
      path: parsedUrl.pathname,
      uuidFromUrl: uuidFromUrl || 'NOT PROVIDED',
      pendingCallsCount: pendingCalls.size,
      pendingIds: Array.from(pendingCalls.entries()).map(([uuid, p]) => ({ uuid, callId: p.callId })),
      timestamp: Date.now() 
    });

    if (uuidFromUrl) {
      callId = consumePendingCall(uuidFromUrl);

      if (callId) {
        if (uuidFromUrl.startsWith('outbound-')) {
          log.info(`📞 OUTBOUND call matched: callId=${callId}, uuid=${uuidFromUrl}`);
        } else {
          log.info(`📞 INBOUND call matched: callId=${callId} (same as uuid)`);
        }
      } else {
        log.warn(`⚠️ UUID ${uuidFromUrl} not found in pending calls - using UUID as callId`);
        callId = uuidFromUrl;
      }
    } else {
      log.warn('⚠️ No UUID in path - using FIFO fallback');
      if (pendingCalls.size > 0) {
        const firstEntry = pendingCalls.entries().next().value;
        if (firstEntry) {
          const [firstUuid] = firstEntry;
          callId = consumePendingCall(firstUuid);
          log.info(`📞 FIFO fallback: callId=${callId}, uuid=${firstUuid}`);
        }
      }
    }

    if (callId) {
      const metadata = callMetadata.get(uuidFromUrl || callId);
      const callerId = metadata?.callerIdNumber || 'unknown';
      const callerName = metadata?.callerIdName || '';
      const parkTime = metadata?.parkTime;
      const tWsConnect = Date.now();

      if (parkTime) {
        log.info(`⏱️ [VPS-TIMING] CHANNEL_PARK → WebSocket connection: ${tWsConnect - parkTime}ms (FreeSWITCH audio_stream setup + WS open)`, { callId });
      }

      log.info(`📞 Call detected: ID=${callId} | CallerId=${callerId} | CallerName=${callerName}`);

      const calledNumber = metadata?.calledNumber
        || firstQueryValue(parsedUrl.query.called_number)
        || 'unknown';

      const startMsg: AudioStreamStartMessage = {
        event: 'start',
        call_id: callId,
        caller_id: callerId,
        called_number: calledNumber,
        codec: 'L16',
        sample_rate: 8000,
      };

      log.info(`📊 [OVERFLOW-PRE-CHECK] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`, { callId });
      log.info(`📊 [OVERFLOW-PRE-CHECK] Checking limits for calledNumber=${calledNumber} uuid=${uuidFromUrl || callId}`, { callId });
      const overflowCfg = await fetchOverflowConfig(calledNumber);
      const perNumberMax = overflowCfg.max_concurrent_calls || 5;
      const perNumberCount = sessionManager.activeCountForNumber(calledNumber);
      const perNumberFull = !sessionManager.canAcceptCallForNumber(calledNumber, perNumberMax);
      const globalFull = !sessionManager.canAcceptNewCall();
      log.info(`📊 [OVERFLOW-PRE-CHECK] perNumber: ${perNumberCount}/${perNumberMax} (full=${perNumberFull}) | global: ${sessionManager.activeCount}/${sessionManager.maxConcurrent} (full=${globalFull})`, { callId });
      log.info(`📊 [OVERFLOW-PRE-CHECK] overflowCfg: enabled=${overflowCfg.overflow_enabled}, timeout=${overflowCfg.overflow_timeout_secs}s, auto_return=${overflowCfg.overflow_auto_return}, dtmf=${overflowCfg.overflow_dtmf_enabled}, fallback=${overflowCfg.fallback_number ? '***' : 'none'}, max_concurrent=${overflowCfg.max_concurrent_calls}`, { callId });
      const allSessions = sessionManager.getAllSessions();
      log.info(`📊 [OVERFLOW-PRE-CHECK] Active sessions (${allSessions.length}):`, { callId });
      for (const s of allSessions) {
        log.info(`📊 [OVERFLOW-PRE-CHECK]   → id=${s.id.slice(0,8)} | callId=${s.callId} | caller=${s.callerId} | called=${s.calledNumber} | state=${s.state} | fsUuid=${s.fsUuid?.slice(0,12)}`, { callId });
      }
      log.info(`📊 [OVERFLOW-PRE-CHECK] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`, { callId });

      if ((perNumberFull || globalFull) && uuidFromUrl) {
        const reason = perNumberFull
          ? `per-number limit (${perNumberCount}/${perNumberMax})`
          : `global limit (${sessionManager.activeCount}/${sessionManager.maxConcurrent})`;
        log.warn(`🔶 [OVERFLOW-PRE-CHECK] LIMIT REACHED (${reason}) — routing ${uuidFromUrl} to overflow queue (NOT connecting to Replit)`, { callId });
        ws.close(1011, 'Redirecting to overflow queue');
        await routeToOverflow(uuidFromUrl, calledNumber, overflowCfg);
        return;
      }
      log.info(`✅ [OVERFLOW-PRE-CHECK] Limits OK — proceeding to connect to Replit`, { callId });

      handleCallStart(ws, startMsg, uuidFromUrl || callId, overflowCfg).then((sid) => {
        currentSessionId = sid;
      }).catch(async (e) => {
          log.error(`Session init error: ${e.message}`);
          ws.close(1011, 'Session init failed');
          if (uuidFromUrl) {
            const isOutbound = uuidFromUrl.startsWith('outbound-');
            if (!isOutbound) {
              log.info(`📥 [OVERFLOW-FALLBACK] Inbound call ${uuidFromUrl} rejected by server — routing to overflow queue`);
              const rejOverflowCfg = await fetchOverflowConfig(calledNumber);
              await routeToOverflow(uuidFromUrl, calledNumber, rejOverflowCfg);
            } else {
              log.warn(`🔴 Outbound call ${uuidFromUrl} rejected by server — killing (callback retry will handle)`);
              const eslConn = getEslConnection();
              if (eslConn) {
                (eslConn as any).bgapi(`uuid_kill ${uuidFromUrl} CALL_REJECTED`, (res: any) => {
                  log.info(`uuid_kill result: ${res?.getBody?.() || 'no response'}`);
                });
              }
            }
          }
        });
    } else {
      log.warn('⚠️ No pending call found for this WebSocket connection');
    }

    ws.on('message', (data: Buffer, isBinary: boolean) => {
      if (isBinary && currentSessionId) {
        handleAudioData(currentSessionId, data);
      }
    });

    ws.on('close', () => {
      if (currentSessionId) {
        log.info(`WebSocket closed (Session: ${currentSessionId})`);
        const session = sessionManager.getSession(currentSessionId);
        if (session) handleCallStop(session.callId, 'websocket_closed');
      }
    });
  });

  server.listen(config.ws.port, config.ws.host, () => {
    log.info(`Voice Bridge Server started on port ${config.ws.port}`);
    log.info(`Outbound endpoint ready at POST /outbound/call`);
  });
}

async function handleCallStart(ws: WebSocket, message: AudioStreamStartMessage, fsUuid?: string, overflowCfg?: any): Promise<string> {
  const t0 = Date.now();

  const inactivityTimeoutMs = overflowCfg?.inactivity_timeout_secs
    ? overflowCfg.inactivity_timeout_secs * 1000
    : undefined;

  const session = sessionManager.createSession(
    message.call_id, message.caller_id, message.called_number,
    message.codec, message.sample_rate, ws, fsUuid, inactivityTimeoutMs
  );
  const tSession = Date.now();

  notifyCallStart(session.id, message.caller_id, message.called_number).catch(e => {
    log.warn(`⚠️ notifyCallStart failed (non-blocking)`, { error: e?.message });
  });

  fetchNumberOwner(message.called_number).then(ownerResult => {
    if (ownerResult?.found) {
      log.info(`📞 [NUMBER LOOKUP] Called number ${message.called_number} belongs to consultant=${ownerResult.consultant_id}, display=${ownerResult.display_name}`);
    } else {
      log.info(`📞 [NUMBER LOOKUP] Called number ${message.called_number} not found in voice_numbers`);
    }
  }).catch(e => {
    log.warn(`⚠️ fetchNumberOwner failed (non-blocking)`, { error: e?.message });
  });

  bgInitSession(session.id);

  audioOutputQueues.set(session.id, []);
  const tSetup = Date.now();

  log.info(`⏱️ [VPS-TIMING] handleCallStart setup: session=${tSession - t0}ms, bgInit+queue=${tSetup - tSession}ms`, {
    sessionId: session.id.slice(0, 8),
  });

  let lastTickNs = process.hrtime.bigint();
  const FRAME_NS = BigInt(20_000_000);
  const PREFILL_FRAMES = 4;

  function audioTick() {
    const s = sessionManager.getSession(session.id);
    if (!s || (s.state !== 'active' && s.state !== 'reconnecting') || !s.fsWebSocket || s.fsWebSocket.readyState !== WebSocket.OPEN) {
      bgTimers.set(session.id, setTimeout(audioTick, 10));
      return;
    }

    const now = process.hrtime.bigint();
    const elapsed = now - lastTickNs;
    const framesToSend = Number(elapsed / FRAME_NS);

    if (framesToSend >= 1) {
      lastTickNs += FRAME_NS * BigInt(framesToSend);

      const queue = audioOutputQueues.get(session.id);
      const maxCatchUp = Math.min(framesToSend, 5);

      for (let f = 0; f < maxCatchUp; f++) {
        if (queue && queue.length > 0) {
          const chunk = queue.shift()!;
          s.fsWebSocket.send(chunk, { binary: true });
          lastQueueHadAudio.set(session.id, true);
        } else if (config.audio.backgroundEnabled && isBackgroundLoaded()) {
          const bgChunk = generateBackgroundChunk(session.id, CHUNK_SIZE);
          if (bgChunk) {
            if (lastQueueHadAudio.get(session.id)) {
              lastQueueHadAudio.set(session.id, false);
              for (let si = 0; si < FADE_SAMPLES && si * 2 + 1 < bgChunk.length; si++) {
                const gain = (si + 1) / FADE_SAMPLES;
                const sample = bgChunk.readInt16LE(si * 2);
                bgChunk.writeInt16LE(Math.round(sample * gain), si * 2);
              }
            }
            s.fsWebSocket.send(bgChunk, { binary: true });
          }
        }
      }
    }

    const nextFrameAt = lastTickNs + FRAME_NS;
    const nowAfter = process.hrtime.bigint();
    const waitNs = nextFrameAt > nowAfter ? nextFrameAt - nowAfter : BigInt(1_000_000);
    const waitMs = Math.max(1, Math.min(15, Number(waitNs / BigInt(1_000_000))));

    bgTimers.set(session.id, setTimeout(audioTick, waitMs));
  }

  bgTimers.set(session.id, setTimeout(audioTick, 5));
  log.info(`🎵 Adaptive audio timer started (prefill=${PREFILL_FRAMES})`, { sessionId: session.id.slice(0, 8) });

  const tPreConnect = Date.now();
  log.info(`⏱️ [VPS-TIMING] Pre-connect overhead: ${tPreConnect - t0}ms`, { sessionId: session.id.slice(0, 8) });

  let firstAudioReceived = false;
  const tConnectStart = Date.now();

  try {
    const replitClient = new ReplitWSClient({
      sessionId: session.id,
      callerId: message.caller_id,
      calledNumber: message.called_number,
      callId: message.call_id,
      scheduledCallId: message.call_id.startsWith('sc_') ? message.call_id : undefined,
      onAudioResponse: (audio) => {
        if (!firstAudioReceived) {
          firstAudioReceived = true;
          const tFirstAudio = Date.now();
          log.info(`\n⏱️ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
          log.info(`⏱️ [VPS LATENCY REPORT] First audio from Replit`);
          log.info(`⏱️ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
          log.info(`⏱️  handleCallStart entry → Replit WS connect start:  ${tConnectStart - t0}ms (local setup)`);
          log.info(`⏱️  Replit WS connect (TLS handshake):                ${(replitClient as any).wsConnectTime ? ((replitClient as any).wsConnectTime - tConnectStart) : '?'}ms`);
          log.info(`⏱️  Replit WS open → First audio byte:               ${tFirstAudio - ((replitClient as any).wsConnectTime || tConnectStart)}ms (server-side processing)`);
          log.info(`⏱️  ─────────────────────────────────────────`);
          log.info(`⏱️  TOTAL handleCallStart → First audio:              ${tFirstAudio - t0}ms`);
          log.info(`⏱️ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
        }
        queueAudioForFreeSWITCH(session.id, audio);
      },
      onTextResponse: (text) => {
        log.info(`[AI]: "${text}"`);
      },
      onInterrupted: () => {
        const queue = audioOutputQueues.get(session.id);
        const flushed = queue?.length || 0;
        if (queue) queue.length = 0;
        log.info(`🛑 BARGE-IN: flushed ${flushed} chunks (${flushed * 20}ms audio)`, { sessionId: session.id.slice(0, 8) });
      },
      onError: (err) => {
        log.error(`Replit Error: ${err.message}`);
      },
      onReconnecting: () => {
        log.info(`🔄 Gemini session expired - entering reconnect state, keeping FreeSWITCH call alive`, { sessionId: session.id.slice(0, 8) });
        sessionManager.updateSessionState(session.id, 'reconnecting');
      },
      onReconnected: () => {
        log.info(`✅ Gemini session resumed - returning to active state`, { sessionId: session.id.slice(0, 8) });
        sessionManager.updateSessionState(session.id, 'active');
      },
      onClose: (code?: number, reason?: string) => {
        log.info(`📞 [REPLIT-ONCLOSE] Replit connection closed`, { sessionId: session.id.slice(0, 8), code, reason, fsUuid: session.fsUuid, callId: session.callId, calledNumber: message.called_number });

        if (code === 4429) {
          log.warn(`🔶 [OVERFLOW-4429] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`, { sessionId: session.id.slice(0, 8) });
          log.warn(`🔶 [OVERFLOW-4429] Replit rejected with 4429 CHANNELS_FULL`, { sessionId: session.id.slice(0, 8) });
          log.warn(`🔶 [OVERFLOW-4429] Session: fsUuid=${session.fsUuid} | callId=${session.callId} | caller=${session.callerId} | called=${message.called_number} | state=${session.state}`, { sessionId: session.id.slice(0, 8) });
          log.warn(`🔶 [OVERFLOW-4429] Active sessions: ${sessionManager.activeCount} | Overflow queue: ${sessionManager.overflowCount}`, { sessionId: session.id.slice(0, 8) });

          const wasDequeued = recentlyDequeuedUuids.has(session.fsUuid);
          log.warn(`🔶 [OVERFLOW-4429] wasDequeued=${wasDequeued} (recentlyDequeuedUuids has ${recentlyDequeuedUuids.size} entries)`, { sessionId: session.id.slice(0, 8) });

          if (wasDequeued) {
            log.error(`🔴 [OVERFLOW-4429] LOOP PREVENTION: Call ${session.fsUuid} was just dequeued but Replit rejected again → killing call`, { sessionId: session.id.slice(0, 8) });
            recentlyDequeuedUuids.delete(session.fsUuid);
            cleanupSession(session.id);
            sessionManager.endSession(session.id, 'channels_full_after_dequeue');
            const eslConn = getEslConnection();
            if (eslConn) {
              (eslConn as any).bgapi(`uuid_kill ${session.fsUuid} NORMAL_CLEARING`);
            }
            log.warn(`🔶 [OVERFLOW-4429] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`, { sessionId: session.id.slice(0, 8) });
            return;
          }

          log.warn(`🔶 [OVERFLOW-4429] Cleaning up session and routing to overflow queue...`, { sessionId: session.id.slice(0, 8) });
          cleanupSession(session.id);
          sessionManager.endSession(session.id, 'channels_full_overflow');
          routeToOverflow(session.fsUuid, message.called_number).then(ok => {
            if (ok) {
              log.info(`✅ [OVERFLOW-4429] Call ${session.fsUuid} successfully routed to overflow queue`, { sessionId: session.id.slice(0, 8) });
            } else {
              log.error(`❌ [OVERFLOW-4429] Failed to route ${session.fsUuid} to overflow — call will be dropped`, { sessionId: session.id.slice(0, 8) });
            }
            log.warn(`🔶 [OVERFLOW-4429] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`, { sessionId: session.id.slice(0, 8) });
          }).catch(err => {
            log.error(`❌ [OVERFLOW-4429] routeToOverflow error: ${err.message}`, { sessionId: session.id.slice(0, 8) });
          });
          return;
        }

        const s = sessionManager.getSession(session.id);
        if (s && (s.state === 'active' || s.state === 'reconnecting')) {
          log.info(`📞 Replit closed permanently - ending call`, { sessionId: session.id.slice(0, 8) });
          handleCallStop(session.callId, 'replit_disconnected');
        }
      },
    });

    await replitClient.connect();
    const tConnected = Date.now();
    log.info(`⏱️ [VPS-TIMING] Replit WS connected in ${tConnected - tConnectStart}ms (TLS handshake + HTTP upgrade)`, { sessionId: session.id.slice(0, 8) });

    sessionManager.setReplitClient(session.id, replitClient);
    sessionManager.updateSessionState(session.id, 'active');

    const tActive = Date.now();
    log.info(`⏱️ [VPS-TIMING] Total handleCallStart: ${tActive - t0}ms (setup=${tPreConnect - t0}ms, connect=${tConnected - tConnectStart}ms, post=${tActive - tConnected}ms)`, { sessionId: session.id.slice(0, 8) });

    return session.id;
  } catch (error) {
    cleanupSession(session.id);
    throw error;
  }
}

function isVoiceActivity(pcmData: Buffer): boolean {
  if (pcmData.length < 4) return false;
  let sumSquares = 0;
  const sampleCount = Math.floor(pcmData.length / 2);
  for (let i = 0; i < sampleCount; i++) {
    const sample = pcmData.readInt16LE(i * 2);
    sumSquares += sample * sample;
  }
  const rms = Math.sqrt(sumSquares / sampleCount);
  return rms > 200;
}

function handleAudioData(sessionId: string, audioData: Buffer): void {
  const session = sessionManager.getSession(sessionId);
  if (!session || (session.state !== 'active' && session.state !== 'reconnecting')) return;

  const pcm = convertForGemini(audioData, session.codec, session.sampleRate);
  if (isVoiceActivity(pcm)) {
    sessionManager.recordAudioIn(sessionId, audioData.length);
  }
  session.replitClient?.sendAudio(pcm);
}

function queueAudioForFreeSWITCH(sessionId: string, audio: Buffer): void {
  const session = sessionManager.getSession(sessionId);
  if (!session?.fsWebSocket || session.fsWebSocket.readyState !== WebSocket.OPEN) {
    return;
  }

  let pcmAudio = convertFromGemini(audio, 'L16', session.sampleRate);

  if (config.audio.backgroundEnabled && isBackgroundLoaded()) {
    pcmAudio = mixWithBackground(pcmAudio, sessionId);
  }

  const queue = audioOutputQueues.get(sessionId);
  if (!queue) return;

  const wasEmpty = queue.length === 0;

  for (let i = 0; i < pcmAudio.length; i += CHUNK_SIZE) {
    const end = Math.min(i + CHUNK_SIZE, pcmAudio.length);
    const chunk = pcmAudio.slice(i, end);
    if (chunk.length === CHUNK_SIZE) {
      queue.push(chunk);
    } else if (chunk.length > 0) {
      const padded = Buffer.alloc(CHUNK_SIZE, 0);
      chunk.copy(padded);
      queue.push(padded);
    }
  }

  if (queue.length > AUDIO_QUEUE_MAX) {
    const overflow = queue.length - AUDIO_QUEUE_MAX;
    queue.splice(0, overflow);
    log.warn(`Audio queue overflow, dropped ${overflow} old chunks`, { sessionId: sessionId.slice(0, 8) });
  }

  if (wasEmpty && queue.length > 0) {
    const PREFILL = 2;
    const prefillCount = Math.min(queue.length, PREFILL);
    for (let i = 0; i < prefillCount; i++) {
      const chunk = queue.shift()!;
      session.fsWebSocket.send(chunk, { binary: true });
    }
  }
}

function cleanupSession(sessionId: string): void {
  const timer = bgTimers.get(sessionId);
  if (timer) {
    clearTimeout(timer);
    bgTimers.delete(sessionId);
  }
  audioOutputQueues.delete(sessionId);
  lastQueueHadAudio.delete(sessionId);
  bgDestroySession(sessionId);
}

async function routeToOverflow(uuid: string, calledNumber: string, overflowCfg?: any): Promise<boolean> {
  try {
    log.info(`📥 [ROUTE-OVERFLOW] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    log.info(`📥 [ROUTE-OVERFLOW] Starting overflow routing for uuid=${uuid} calledNumber=${calledNumber}`);
    if (!overflowCfg) {
      log.info(`📥 [ROUTE-OVERFLOW] No overflowCfg provided — fetching from Replit API...`);
      overflowCfg = await fetchOverflowConfig(calledNumber);
    }
    log.info(`📥 [ROUTE-OVERFLOW] Config: enabled=${overflowCfg.overflow_enabled}, timeout=${overflowCfg.overflow_timeout_secs}s, auto_return=${overflowCfg.overflow_auto_return}, dtmf=${overflowCfg.overflow_dtmf_enabled}, fallback=${overflowCfg.fallback_number ? '***' : 'none'}, max_concurrent=${overflowCfg.max_concurrent_calls}`);

    if (!overflowCfg.overflow_enabled) {
      log.warn(`🔴 [ROUTE-OVERFLOW] Overflow DISABLED for ${calledNumber} — rejecting call ${uuid}`);
      const eslConn = getEslConnection();
      if (eslConn) {
        (eslConn as any).bgapi(`uuid_kill ${uuid} CALL_REJECTED`, (res: any) => {
          log.info(`[ROUTE-OVERFLOW] uuid_kill result: ${res?.getBody?.() || 'no response'}`);
        });
      }
      log.info(`📥 [ROUTE-OVERFLOW] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      return false;
    }

    const eslConn = getEslConnection();
    if (!eslConn) {
      log.error(`🔴 [ROUTE-OVERFLOW] No ESL connection — cannot transfer to overflow. Call ${uuid} will be dropped!`);
      log.info(`📥 [ROUTE-OVERFLOW] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      return false;
    }
    log.info(`📥 [ROUTE-OVERFLOW] ESL connection available ✅`);

    let overflowAudioDir = '/usr/share/freeswitch/sounds/overflow/default';
    // NOTE: syncOverflowAudio saves files to host path (/opt/alessia-voice/freeswitch-sounds/overflow/)
    // but returns the FreeSWITCH container path (/usr/share/freeswitch/sounds/overflow/)
    // because the host dir is bind-mounted into the container at that path
    if (overflowCfg.consultant_id) {
      try {
        overflowAudioDir = await syncOverflowAudio(overflowCfg.consultant_id);
        log.info(`📥 [ROUTE-OVERFLOW] Audio dir resolved: ${overflowAudioDir}`);
      } catch (syncErr: any) {
        log.warn(`⚠️ [ROUTE-OVERFLOW] Audio sync failed, using default: ${syncErr.message}`);
      }
    } else {
      log.info(`📥 [ROUTE-OVERFLOW] No consultant_id in overflow config — using default audio dir`);
    }

    const queuePosition = sessionManager.overflowCount + 1;
    const setVars: string[] = [
      `sip_gateway=${config.sip.gateway}`,
      `tech_prefix=${config.sip.techPrefix}`,
      `queue_position=${queuePosition}`,
      `overflow_audio_dir=${overflowAudioDir}`,
    ];
    if (overflowCfg.fallback_number && overflowCfg.overflow_dtmf_enabled) {
      setVars.push(`fallback_transfer_number=${overflowCfg.fallback_number}`);
      setVars.push(`overflow_dtmf_enabled=true`);
    } else {
      setVars.push(`overflow_dtmf_enabled=false`);
    }
    if (overflowCfg.overflow_message) {
      setVars.push(`overflow_custom_message=${overflowCfg.overflow_message.replace(/[;=]/g, ' ')}`);
    }
    log.info(`📥 [ROUTE-OVERFLOW] Setting vars on channel: ${setVars.join(' | ')}`, { uuid });

    (eslConn as any).bgapi(`uuid_setvar_multi ${uuid} ${setVars.join(';')}`, (res: any) => {
      const body = res?.getBody?.() || 'ok';
      log.info(`📥 [ROUTE-OVERFLOW] uuid_setvar_multi result: ${body}`, { uuid });
    });

    setTimeout(() => {
      log.info(`📥 [ROUTE-OVERFLOW] Transferring ${uuid} → overflow_queue XML default`, { uuid });
      (eslConn as any).bgapi(`uuid_transfer ${uuid} overflow_queue XML default`, (res: any) => {
        const body = res?.getBody?.() || '';
        if (body.includes('+OK')) {
          log.info(`✅ [ROUTE-OVERFLOW] Call ${uuid} transferred to overflow_queue SUCCESSFULLY`);
        } else {
          log.error(`❌ [ROUTE-OVERFLOW] Failed to transfer to overflow_queue: ${body} — killing call`);
          (eslConn as any).bgapi(`uuid_kill ${uuid} CALL_REJECTED`);
        }
      });
    }, 100);

    const timeoutSecs = overflowCfg.overflow_timeout_secs || 120;
    sessionManager.addToOverflow(uuid, calledNumber, timeoutSecs, (ovUuid) => {
      log.warn(`⏰ [ROUTE-OVERFLOW] Timeout reached (${timeoutSecs}s) — transferring call ${ovUuid} to timeout announcement`);
      const conn = getEslConnection();
      if (conn) {
        (conn as any).bgapi(`uuid_transfer ${ovUuid} overflow_timeout XML default`, (res: any) => {
          const body = res?.getBody?.() || '';
          if (!body.includes('+OK')) {
            log.warn(`⚠️ [ROUTE-OVERFLOW] Timeout transfer failed, killing call ${ovUuid}: ${body}`);
            (conn as any).bgapi(`uuid_kill ${ovUuid} NORMAL_CLEARING`);
          } else {
            log.info(`✅ [ROUTE-OVERFLOW] Timeout transfer OK for ${ovUuid}`);
          }
        });
      } else {
        log.error(`🔴 [ROUTE-OVERFLOW] No ESL connection for timeout transfer of ${ovUuid}`);
      }
    });

    log.info(`📥 [ROUTE-OVERFLOW] Call ${uuid} queued in overflow — position=${queuePosition}, timeout=${timeoutSecs}s, current queue size=${sessionManager.overflowCount}`);
    log.info(`📥 [ROUTE-OVERFLOW] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    return true;
  } catch (overflowErr: any) {
    log.error(`🔴 [ROUTE-OVERFLOW] EXCEPTION: ${overflowErr.message}`, { uuid, stack: overflowErr.stack?.slice(0, 300) });
    const eslConn = getEslConnection();
    if (eslConn) {
      (eslConn as any).bgapi(`uuid_kill ${uuid} CALL_REJECTED`);
    }
    log.info(`📥 [ROUTE-OVERFLOW] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    return false;
  }
}

function handleCallStop(callId: string, reason: string): void {
  const session = sessionManager.getSessionByCallId(callId);
  if (!session) {
    log.info(`📞 [CALL-STOP] No session found for callId=${callId} reason=${reason} — skipping`);
    return;
  }

  const duration = Date.now() - session.startTime.getTime();
  const fsUuid = session.fsUuid;
  log.info(`📞 [CALL-STOP] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  log.info(`📞 [CALL-STOP] callId=${callId} | reason=${reason} | duration=${Math.round(duration/1000)}s`);
  log.info(`📞 [CALL-STOP] session: id=${session.id.slice(0,8)} | caller=${session.callerId} | called=${session.calledNumber} | state=${session.state} | fsUuid=${fsUuid?.slice(0,12)}`);
  log.info(`📞 [CALL-STOP] Before cleanup: activeSessions=${sessionManager.activeCount} | overflowQueue=${sessionManager.overflowCount}`);

  cleanupSession(session.id);

  notifyCallEnd(session.id, duration, session.audioStats.bytesIn, session.audioStats.bytesOut, reason);
  sessionManager.endSession(session.id, reason);

  if (fsUuid) {
    const eslConn = getEslConnection();
    if (eslConn) {
      log.info(`📞 [CALL-STOP] Sending uuid_kill to FreeSWITCH: fsUuid=${fsUuid} reason=${reason}`);
      (eslConn as any).bgapi(`uuid_kill ${fsUuid} NORMAL_CLEARING`, (res: any) => {
        log.info(`📞 [CALL-STOP] uuid_kill result for ${fsUuid}: ${res?.getBody?.() || 'no response'}`);
      });
    } else {
      log.warn(`📞 [CALL-STOP] No ESL connection — cannot kill FreeSWITCH call ${fsUuid}`);
    }
  }

  log.info(`📞 [CALL-STOP] After cleanup: activeSessions=${sessionManager.activeCount} | overflowQueue=${sessionManager.overflowCount}`);
  if (sessionManager.overflowCount > 0) {
    log.info(`📞 [CALL-STOP] Overflow queue not empty — triggering tryDequeueOverflow...`);
  }
  log.info(`📞 [CALL-STOP] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

  tryDequeueOverflow();
}

async function tryDequeueOverflow(): Promise<void> {
  if (sessionManager.overflowCount === 0) {
    log.info(`🔄 [DEQUEUE] No overflow callers to dequeue`);
    return;
  }
  if (sessionManager.dequeueInProgress) {
    log.info(`🔄 [DEQUEUE] Dequeue already in progress — skipping`);
    return;
  }

  sessionManager.dequeueInProgress = true;
  log.info(`🔄 [DEQUEUE] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  log.info(`🔄 [DEQUEUE] Starting dequeue — overflow queue has ${sessionManager.overflowCount} callers`);

  try {
    while (sessionManager.overflowCount > 0) {
      const next = sessionManager.getNextOverflow();
      if (!next) {
        log.info(`🔄 [DEQUEUE] getNextOverflow returned null — queue empty`);
        break;
      }

      log.info(`🔄 [DEQUEUE] Processing: uuid=${next.uuid} | calledNumber=${next.calledNumber} | waitedMs=${Date.now() - next.enqueuedAt}`);

      const eslConn = getEslConnection();
      if (!eslConn) {
        log.error(`🔴 [DEQUEUE] No ESL connection for dequeue`);
        break;
      }

      const overflowCfg = await fetchOverflowConfig(next.calledNumber);
      const perNumberMax = overflowCfg.max_concurrent_calls || 5;
      const perNumberCount = sessionManager.activeCountForNumber(next.calledNumber);
      const originalTimeoutMs = (overflowCfg.overflow_timeout_secs || 120) * 1000;
      const elapsedMs = Date.now() - next.enqueuedAt;
      const remainingMs = Math.max(5000, originalTimeoutMs - elapsedMs);

      log.info(`🔄 [DEQUEUE] Limits check: perNumber=${perNumberCount}/${perNumberMax} | global=${sessionManager.activeCount}/${sessionManager.maxConcurrent} | auto_return=${overflowCfg.overflow_auto_return} | elapsed=${Math.round(elapsedMs/1000)}s | remainingTimeout=${Math.round(remainingMs/1000)}s`);

      const timeoutCallback = (uuid: string) => {
        log.warn(`⏰ [DEQUEUE] Overflow timeout — transferring call ${uuid} to timeout announcement`);
        const conn = getEslConnection();
        if (conn) {
          (conn as any).bgapi(`uuid_transfer ${uuid} overflow_timeout XML default`, (res: any) => {
            const body = res?.getBody?.() || '';
            if (!body.includes('+OK')) {
              log.warn(`⚠️ [DEQUEUE] Timeout transfer failed, killing call ${uuid}: ${body}`);
              (conn as any).bgapi(`uuid_kill ${uuid} NORMAL_CLEARING`);
            }
          });
        }
      };

      if (!sessionManager.canAcceptCallForNumber(next.calledNumber, perNumberMax)) {
        log.info(`⏭️ [DEQUEUE] Per-number limit STILL FULL for ${next.calledNumber} (${perNumberCount}/${perNumberMax}) — re-inserting ${next.uuid} at front`);
        sessionManager.reinsertAtFront(next, remainingMs, timeoutCallback);
        break;
      }

      if (!sessionManager.canAcceptNewCall()) {
        log.info(`⏭️ [DEQUEUE] Global limit STILL FULL (${sessionManager.activeCount}/${sessionManager.maxConcurrent}) — re-inserting ${next.uuid} at front`);
        sessionManager.reinsertAtFront(next, remainingMs, timeoutCallback);
        break;
      }

      if (!overflowCfg.overflow_auto_return) {
        log.info(`⏭️ [DEQUEUE] Auto-return DISABLED for ${next.calledNumber} — skipping dequeue of ${next.uuid}`);
        continue;
      }

      log.info(`🔄 [DEQUEUE] Checking if call ${next.uuid} still exists in FreeSWITCH...`);
      const exists = await new Promise<boolean>((resolve) => {
        (eslConn as any).bgapi(`uuid_exists ${next.uuid}`, (res: any) => {
          const body = res?.getBody?.() || '';
          const result = body.trim() === 'true';
          log.info(`🔄 [DEQUEUE] uuid_exists ${next.uuid} = ${result} (raw: "${body.trim()}")`, { uuid: next.uuid });
          resolve(result);
        });
      });

      if (!exists) {
        log.info(`📞 [DEQUEUE] Call ${next.uuid} no longer exists (caller hung up) — trying next in queue`);
        continue;
      }

      log.info(`🔄 [DEQUEUE] Call ${next.uuid} EXISTS — marking as recently dequeued and waiting 2s for DB sync...`);
      recentlyDequeuedUuids.set(next.uuid, Date.now());
      setTimeout(() => recentlyDequeuedUuids.delete(next.uuid), 30000);

      await new Promise(r => setTimeout(r, 2000));

      const stillExists = await new Promise<boolean>((resolve) => {
        (eslConn as any).bgapi(`uuid_exists ${next.uuid}`, (res: any) => {
          resolve((res?.getBody?.() || '').trim() === 'true');
        });
      });
      if (!stillExists) {
        log.info(`📞 [DEQUEUE] Call ${next.uuid} hung up during 2s delay — skipping`);
        recentlyDequeuedUuids.delete(next.uuid);
        continue;
      }

      const transferDest = next.calledNumber || '9999';
      log.info(`🔄 [DEQUEUE] Transferring ${next.uuid} back to AI → ${transferDest} XML public`);
      (eslConn as any).bgapi(`uuid_transfer ${next.uuid} ${transferDest} XML public`, (res: any) => {
        const body = res?.getBody?.() || '';
        if (body.includes('+OK')) {
          log.info(`✅ [DEQUEUE] Call ${next.uuid} transferred back to AI SUCCESSFULLY`);
        } else {
          log.error(`❌ [DEQUEUE] Failed to transfer overflow call ${next.uuid} back to AI: ${body}`);
        }
      });

      const remainingOverflow = sessionManager.getOverflowDetails();
      if (remainingOverflow.count > 0) {
        remainingOverflow.entries.forEach((entry, idx) => {
          const newPosition = idx + 1;
          (eslConn as any).bgapi(`uuid_setvar ${entry.uuid} queue_position ${newPosition}`, () => {});
        });
        log.info(`📊 [DEQUEUE] Updated queue_position for ${remainingOverflow.count} remaining overflow callers`);
      }

      break;
    }
  } catch (err: any) {
    log.error(`🔴 [DEQUEUE] Error: ${err.message}`, { stack: err.stack?.slice(0, 300) });
  } finally {
    sessionManager.dequeueInProgress = false;
    log.info(`🔄 [DEQUEUE] Finished — activeSessions=${sessionManager.activeCount} | overflowQueue=${sessionManager.overflowCount}`);
    log.info(`🔄 [DEQUEUE] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  }
}
