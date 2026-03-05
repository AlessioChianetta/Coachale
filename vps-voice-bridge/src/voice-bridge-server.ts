import { WebSocketServer, WebSocket } from 'ws';
import { createServer, type IncomingMessage } from 'http';
import express from 'express';
import { parse as parseUrl } from 'url';
import { config } from './config.js';
import { logger } from './logger.js';
import { sessionManager } from './session-manager.js';
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
      log.warn(`⏰ Pending call expired: callId=${callId}, uuid=${uuid}`);
    }
  }, 30000);

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

  app.get('/health', (req, res) => {
    const overflow = sessionManager.getOverflowDetails();
    const stats = sessionManager.getStats();
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

      const overflowCfg = await fetchOverflowConfig(calledNumber);
      const perNumberMax = overflowCfg.max_concurrent_calls || 5;
      const perNumberFull = !sessionManager.canAcceptCallForNumber(calledNumber, perNumberMax);
      const globalFull = !sessionManager.canAcceptNewCall();

      if ((perNumberFull || globalFull) && uuidFromUrl) {
        const reason = perNumberFull
          ? `per-number limit (${sessionManager.activeCountForNumber(calledNumber)}/${perNumberMax})`
          : `global limit (${sessionManager.activeCount}/${sessionManager.maxConcurrent})`;
        log.warn(`🔶 Max concurrent reached (${reason}) — attempting overflow for ${uuidFromUrl}`);
        ws.close(1011, 'Redirecting to overflow queue');
        await routeToOverflow(uuidFromUrl, calledNumber, overflowCfg);
        return;
      }

      handleCallStart(ws, startMsg, uuidFromUrl || callId).then((sid) => {
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

async function handleCallStart(ws: WebSocket, message: AudioStreamStartMessage, fsUuid?: string): Promise<string> {
  const t0 = Date.now();

  const session = sessionManager.createSession(
    message.call_id, message.caller_id, message.called_number,
    message.codec, message.sample_rate, ws, fsUuid
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
        sessionManager.pauseInactivityTimeout(session.id);
      },
      onReconnected: () => {
        log.info(`✅ Gemini session resumed - returning to active state`, { sessionId: session.id.slice(0, 8) });
        sessionManager.updateSessionState(session.id, 'active');
        sessionManager.resumeInactivityTimeout(session.id);
      },
      onClose: () => {
        log.info(`Replit connection closed`, { sessionId: session.id.slice(0, 8) });
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

function handleAudioData(sessionId: string, audioData: Buffer): void {
  const session = sessionManager.getSession(sessionId);
  if (!session || (session.state !== 'active' && session.state !== 'reconnecting')) return;

  const pcm = convertForGemini(audioData, session.codec, session.sampleRate);
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
    if (!overflowCfg) {
      overflowCfg = await fetchOverflowConfig(calledNumber);
    }

    if (!overflowCfg.overflow_enabled) {
      log.warn(`🔴 Overflow disabled for ${calledNumber} — rejecting call ${uuid}`);
      const eslConn = getEslConnection();
      if (eslConn) {
        (eslConn as any).bgapi(`uuid_kill ${uuid} CALL_REJECTED`, (res: any) => {
          log.info(`uuid_kill result: ${res?.getBody?.() || 'no response'}`);
        });
      }
      return false;
    }

    const eslConn = getEslConnection();
    if (!eslConn) {
      log.error(`🔴 No ESL connection — cannot transfer to overflow`);
      return false;
    }

    const queuePosition = sessionManager.overflowCount + 1;
    const setVars: string[] = [
      `sip_gateway=${config.sip.gateway}`,
      `tech_prefix=${config.sip.techPrefix}`,
      `queue_position=${queuePosition}`,
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

    (eslConn as any).bgapi(`uuid_setvar_multi ${uuid} ${setVars.join(';')}`, (res: any) => {
      log.info(`Overflow vars set: ${res?.getBody?.() || 'ok'}`);
    });

    setTimeout(() => {
      (eslConn as any).bgapi(`uuid_transfer ${uuid} overflow_queue XML default`, (res: any) => {
        const body = res?.getBody?.() || '';
        if (body.includes('+OK')) {
          log.info(`✅ Call ${uuid} transferred to overflow_queue`);
        } else {
          log.error(`❌ Failed to transfer to overflow_queue: ${body}`);
          (eslConn as any).bgapi(`uuid_kill ${uuid} CALL_REJECTED`);
        }
      });
    }, 100);

    const timeoutSecs = overflowCfg.overflow_timeout_secs || 120;
    sessionManager.addToOverflow(uuid, calledNumber, timeoutSecs, (ovUuid) => {
      log.warn(`⏰ Overflow timeout — transferring call ${ovUuid} to timeout announcement`);
      const conn = getEslConnection();
      if (conn) {
        (conn as any).bgapi(`uuid_transfer ${ovUuid} overflow_timeout XML default`, (res: any) => {
          const body = res?.getBody?.() || '';
          if (!body.includes('+OK')) {
            log.warn(`⚠️ Timeout transfer failed, killing call ${ovUuid}: ${body}`);
            (conn as any).bgapi(`uuid_kill ${ovUuid} NORMAL_CLEARING`);
          }
        });
      }
    });

    log.info(`📥 Call ${uuid} queued in overflow (timeout=${timeoutSecs}s, dtmf=${overflowCfg.overflow_dtmf_enabled}, fallback=${overflowCfg.fallback_number ? '***' : 'none'})`);
    return true;
  } catch (overflowErr: any) {
    log.error(`🔴 Overflow handling failed: ${overflowErr.message}`);
    const eslConn = getEslConnection();
    if (eslConn) {
      (eslConn as any).bgapi(`uuid_kill ${uuid} CALL_REJECTED`);
    }
    return false;
  }
}

function handleCallStop(callId: string, reason: string): void {
  const session = sessionManager.getSessionByCallId(callId);
  if (!session) return;

  cleanupSession(session.id);

  const duration = Date.now() - session.startTime.getTime();
  notifyCallEnd(session.id, duration, session.audioStats.bytesIn, session.audioStats.bytesOut, reason);
  sessionManager.endSession(session.id, reason);

  tryDequeueOverflow();
}

async function tryDequeueOverflow(): Promise<void> {
  if (sessionManager.overflowCount === 0) return;
  if (sessionManager.dequeueInProgress) return;

  sessionManager.dequeueInProgress = true;

  try {
    while (sessionManager.overflowCount > 0) {
      const next = sessionManager.getNextOverflow();
      if (!next) break;

      const eslConn = getEslConnection();
      if (!eslConn) {
        log.error(`🔴 No ESL connection for dequeue`);
        break;
      }

      const overflowCfg = await fetchOverflowConfig(next.calledNumber);
      const perNumberMax = overflowCfg.max_concurrent_calls || 5;
      const originalTimeoutMs = (overflowCfg.overflow_timeout_secs || 120) * 1000;
      const elapsedMs = Date.now() - next.enqueuedAt;
      const remainingMs = Math.max(5000, originalTimeoutMs - elapsedMs);

      const timeoutCallback = (uuid: string) => {
        log.warn(`⏰ Overflow timeout — transferring call ${uuid} to timeout announcement`);
        const conn = getEslConnection();
        if (conn) {
          (conn as any).bgapi(`uuid_transfer ${uuid} overflow_timeout XML default`, (res: any) => {
            const body = res?.getBody?.() || '';
            if (!body.includes('+OK')) {
              log.warn(`⚠️ Timeout transfer failed, killing call ${uuid}: ${body}`);
              (conn as any).bgapi(`uuid_kill ${uuid} NORMAL_CLEARING`);
            }
          });
        }
      };

      if (!sessionManager.canAcceptCallForNumber(next.calledNumber, perNumberMax)) {
        log.info(`⏭️ Per-number limit still full for ${next.calledNumber} (${sessionManager.activeCountForNumber(next.calledNumber)}/${perNumberMax}) — re-inserting ${next.uuid} at front`);
        sessionManager.reinsertAtFront(next, remainingMs, timeoutCallback);
        break;
      }

      if (!sessionManager.canAcceptNewCall()) {
        log.info(`⏭️ Global limit full — re-inserting ${next.uuid} at front`);
        sessionManager.reinsertAtFront(next, remainingMs, timeoutCallback);
        break;
      }

      if (!overflowCfg.overflow_auto_return) {
        log.info(`⏭️ Auto-return disabled for ${next.calledNumber} — skipping dequeue of ${next.uuid}`);
        continue;
      }

      const exists = await new Promise<boolean>((resolve) => {
        (eslConn as any).bgapi(`uuid_exists ${next.uuid}`, (res: any) => {
          const body = res?.getBody?.() || '';
          resolve(body.trim() === 'true');
        });
      });

      if (!exists) {
        log.info(`📞 Overflow call ${next.uuid} no longer exists (hung up) — trying next`);
        continue;
      }

      log.info(`🔄 Dequeuing overflow call ${next.uuid} → transferring back to AI`);

      (eslConn as any).bgapi(`uuid_transfer ${next.uuid} alessia_ai_9999_public XML public`, (res: any) => {
        const body = res?.getBody?.() || '';
        if (body.includes('+OK')) {
          log.info(`✅ Overflow call ${next.uuid} transferred back to AI`);
        } else {
          log.error(`❌ Failed to transfer overflow call ${next.uuid} back to AI: ${body}`);
        }
      });

      const remainingOverflow = sessionManager.getOverflowDetails();
      if (remainingOverflow.count > 0) {
        remainingOverflow.entries.forEach((entry, idx) => {
          const newPosition = idx + 1;
          (eslConn as any).bgapi(`uuid_setvar ${entry.uuid} queue_position ${newPosition}`, () => {});
        });
        log.info(`📊 Updated queue_position for ${remainingOverflow.count} remaining overflow callers`);
      }

      break;
    }
  } catch (err: any) {
    log.error(`🔴 Dequeue overflow error: ${err.message}`);
  } finally {
    sessionManager.dequeueInProgress = false;
  }
}
