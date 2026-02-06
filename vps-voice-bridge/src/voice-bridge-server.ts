import { WebSocketServer, WebSocket } from 'ws';
import { createServer, type IncomingMessage } from 'http';
import express from 'express';
import { parse as parseUrl } from 'url';
import { config } from './config.js';
import { logger } from './logger.js';
import { sessionManager } from './session-manager.js';
import { ReplitWSClient } from './replit-ws-client.js';
import { convertForGemini, convertFromGemini } from './audio-converter.js';
import { fetchCallerContext, notifyCallStart, notifyCallEnd } from './caller-context.js';
import { callMetadata } from './esl-client.js';
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
const AUDIO_QUEUE_MAX = 500;
const CHUNK_SIZE = 320;

loadBackgroundAudio();

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
  const app = express();
  app.use(express.json());

  app.post('/outbound/call', async (req, res) => {
    const authHeader = req.headers.authorization;
    const token = authHeader?.replace('Bearer ', '');

    if (!validateServiceToken(token)) {
      log.warn('Unauthorized outbound request');
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const { targetPhone, callId, aiMode, customPrompt } = req.body;

    if (!targetPhone || !callId) {
      return res.status(400).json({ success: false, error: 'Missing targetPhone or callId' });
    }

    const result = await handleOutboundCall({ targetPhone, callId, aiMode, customPrompt });

    if (result.success) {
      res.json(result);
    } else {
      res.status(500).json(result);
    }
  });

  app.get('/health', (req, res) => {
    res.json({ 
      status: 'ok', 
      timestamp: new Date().toISOString(),
      pendingCalls: pendingCalls.size 
    });
  });

  const server = createServer(app);

  const wss = new WebSocketServer({ server });

  wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
    const clientIp = req.socket.remoteAddress || 'unknown';
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

      log.info(`📞 Call detected: ID=${callId} | CallerId=${callerId} | CallerName=${callerName}`);

      const startMsg: AudioStreamStartMessage = {
        event: 'start',
        call_id: callId,
        caller_id: callerId,
        called_number: '9999',
        codec: 'L16',
        sample_rate: 8000,
      };

      handleCallStart(ws, startMsg).then((sid) => {
        currentSessionId = sid;
      }).catch((e) => {
        log.error(`Session init error: ${e.message}`);
        ws.close(1011, 'Session init failed');
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

async function handleCallStart(ws: WebSocket, message: AudioStreamStartMessage): Promise<string> {
  const session = sessionManager.createSession(
    message.call_id, message.caller_id, message.called_number,
    message.codec, message.sample_rate, ws
  );

  await notifyCallStart(session.id, message.caller_id, message.called_number);

  bgInitSession(session.id);

  audioOutputQueues.set(session.id, []);

  const pacedInterval = setInterval(() => {
    const s = sessionManager.getSession(session.id);
    if (!s || s.state !== 'active' || !s.fsWebSocket || s.fsWebSocket.readyState !== WebSocket.OPEN) {
      return;
    }

    const queue = audioOutputQueues.get(session.id);

    if (queue && queue.length > 0) {
      const chunk = queue.shift()!;
      s.fsWebSocket.send(chunk, { binary: true });
    } else if (isBackgroundLoaded()) {
      const bgChunk = generateBackgroundChunk(session.id, CHUNK_SIZE);
      if (bgChunk) {
        s.fsWebSocket.send(bgChunk, { binary: true });
      }
    }
  }, 20);

  bgTimers.set(session.id, pacedInterval);
  log.info(`🎵 Paced audio timer started (jitter buffer)`, { sessionId: session.id.slice(0, 8) });

  try {
    const replitClient = new ReplitWSClient({
      sessionId: session.id,
      callerId: message.caller_id,
      scheduledCallId: message.call_id,
      onAudioResponse: (audio) => {
        queueAudioForFreeSWITCH(session.id, audio);
      },
      onTextResponse: (text) => {
        log.info(`[AI]: "${text}"`);
      },
      onError: (err) => {
        log.error(`Replit Error: ${err.message}`);
      },
      onClose: () => log.info(`Replit connection closed`),
    });

    await replitClient.connect();
    sessionManager.setReplitClient(session.id, replitClient);
    sessionManager.updateSessionState(session.id, 'active');

    return session.id;
  } catch (error) {
    cleanupSession(session.id);
    throw error;
  }
}

function handleAudioData(sessionId: string, audioData: Buffer): void {
  const session = sessionManager.getSession(sessionId);
  if (!session || session.state !== 'active') return;

  const pcm = convertForGemini(audioData, session.codec, session.sampleRate);
  session.replitClient?.sendAudio(pcm);
}

function queueAudioForFreeSWITCH(sessionId: string, audio: Buffer): void {
  const session = sessionManager.getSession(sessionId);
  if (!session?.fsWebSocket || session.fsWebSocket.readyState !== WebSocket.OPEN) {
    return;
  }

  let pcmAudio = convertFromGemini(audio, 'L16', session.sampleRate);

  if (isBackgroundLoaded()) {
    pcmAudio = mixWithBackground(pcmAudio, sessionId);
  }

  let queue = audioOutputQueues.get(sessionId);
  if (!queue) {
    queue = [];
    audioOutputQueues.set(sessionId, queue);
  }

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
    const firstChunk = queue.shift()!;
    session.fsWebSocket.send(firstChunk, { binary: true });
  }
}

function cleanupSession(sessionId: string): void {
  const timer = bgTimers.get(sessionId);
  if (timer) {
    clearInterval(timer);
    bgTimers.delete(sessionId);
  }
  audioOutputQueues.delete(sessionId);
  bgDestroySession(sessionId);
}

function handleCallStop(callId: string, reason: string): void {
  const session = sessionManager.getSessionByCallId(callId);
  if (!session) return;

  cleanupSession(session.id);

  const duration = Date.now() - session.startTime.getTime();
  notifyCallEnd(session.id, duration, session.audioStats.bytesIn, session.audioStats.bytesOut, reason);
  sessionManager.endSession(session.id, reason);
}
