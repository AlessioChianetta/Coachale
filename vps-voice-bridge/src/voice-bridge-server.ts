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
const bgLastAISend = new Map<string, number>();

loadBackgroundAudio();

// 🎯 FIX: Usa una Map invece di una singola variabile
const pendingCalls = new Map<string, { callId: string; timer: NodeJS.Timeout }>();

export function setExpectedCallId(callId: string, freeswitchUuid?: string): void {
  // Per chiamate INBOUND, l'UUID è anche il callId
  const uuid = freeswitchUuid || callId;

  log.info(`📝 Setting expected call: callId=${callId}, uuid=${uuid}`);

  // Pulisci eventuali timer esistenti per questo UUID
  const existing = pendingCalls.get(uuid);
  if (existing) {
    clearTimeout(existing.timer);
    log.info(`🔄 Replacing existing pending call for uuid=${uuid}`);
  }

  // Timer di 30 secondi
  const timer = setTimeout(() => {
    const deleted = pendingCalls.delete(uuid);
    if (deleted) {
      log.warn(`⏰ Pending call expired: callId=${callId}, uuid=${uuid}`);
    }
  }, 30000);

  pendingCalls.set(uuid, { callId, timer });
  log.info(`✅ Pending calls count: ${pendingCalls.size}`);
}

// Funzione per consumare un pending call (rimuovendolo dalla Map)
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

// Valida il service token (ricevuto da Replit)
function validateServiceToken(token: string | undefined): boolean {
  if (!token) return false;
  const expectedToken = config.serviceToken || process.env.REPLIT_SERVICE_TOKEN;
  return token === expectedToken;
}

export function startVoiceBridgeServer(): void {
  const app = express();
  app.use(express.json());

  // =============================================
  // ENDPOINT OUTBOUND: Riceve richieste da Replit
  // =============================================
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

  // Health check
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

    // 🎯 FIX: Leggi l'UUID dal PATH (es: /stream/uuid-here)
    const parsedUrl = parseUrl(req.url || '', true);
    const pathParts = (parsedUrl.pathname || '').split('/').filter(Boolean);
    // Path format: /stream/{uuid}
    const uuidFromUrl = pathParts.length >= 2 && pathParts[0] === 'stream' ? pathParts[1] : null;

    log.info('🔍 WEBSOCKET CONNECTION', { 
      path: parsedUrl.pathname,
      uuidFromUrl: uuidFromUrl || 'NOT PROVIDED',
      pendingCallsCount: pendingCalls.size,
      pendingIds: Array.from(pendingCalls.entries()).map(([uuid, p]) => ({ uuid, callId: p.callId })),
      timestamp: Date.now() 
    });

    // 🎯 FIX: Cerca nella Map usando l'UUID dal path
    if (uuidFromUrl) {
      // Abbiamo l'UUID dal path - cerca nella Map
      callId = consumePendingCall(uuidFromUrl);

      if (callId) {
        // Determina se è INBOUND o OUTBOUND
        if (uuidFromUrl.startsWith('outbound-')) {
          log.info(`📞 OUTBOUND call matched: callId=${callId}, uuid=${uuidFromUrl}`);
        } else {
          log.info(`📞 INBOUND call matched: callId=${callId} (same as uuid)`);
        }
      } else {
        log.warn(`⚠️ UUID ${uuidFromUrl} not found in pending calls - using UUID as callId`);
        callId = uuidFromUrl; // Fallback: usa l'UUID stesso
      }
    } else {
      // Fallback vecchio comportamento (FIFO) - per retrocompatibilità
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
        sample_rate: 16000,
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

  if (isBackgroundLoaded()) {
    const bgInterval = setInterval(() => {
      const s = sessionManager.getSession(session.id);
      if (!s || s.state !== 'active' || !s.fsWebSocket || s.fsWebSocket.readyState !== WebSocket.OPEN) {
        return;
      }

      const now = Date.now();
      const lastAI = bgLastAISend.get(session.id) || 0;

      if (now - lastAI >= 20) {
        const bgChunk = generateBackgroundChunk(session.id, 640);
        if (bgChunk) {
          s.fsWebSocket.send(bgChunk, { binary: true });
        }
      }
    }, 20);

    bgTimers.set(session.id, bgInterval);
    log.info(`🎵 Background audio timer started`, { sessionId: session.id.slice(0, 8) });
  }

  try {
    const replitClient = new ReplitWSClient({
      sessionId: session.id,
      callerId: message.caller_id,
      scheduledCallId: message.call_id,
      onAudioResponse: (audio) => {
        sendAudioToFreeSWITCH(session.id, audio);
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
    cleanupBackgroundTimer(session.id);
    throw error;
  }
}

function handleAudioData(sessionId: string, audioData: Buffer): void {
  const session = sessionManager.getSession(sessionId);
  if (!session || session.state !== 'active') return;

  const pcm = convertForGemini(audioData, session.codec, session.sampleRate);
  session.replitClient?.sendAudio(pcm);
}

function sendAudioToFreeSWITCH(sessionId: string, audio: Buffer): void {
  const session = sessionManager.getSession(sessionId);
  if (!session?.fsWebSocket || session.fsWebSocket.readyState !== WebSocket.OPEN) {
    return;
  }

  let fsAudio = convertFromGemini(audio, session.codec, session.sampleRate);

  if (session.codec === 'L16' && isBackgroundLoaded()) {
    fsAudio = mixWithBackground(fsAudio, sessionId);
  }

  bgLastAISend.set(sessionId, Date.now());

  const CHUNK_SIZE = 640;
  for (let i = 0; i < fsAudio.length; i += CHUNK_SIZE) {
    const chunk = fsAudio.slice(i, i + CHUNK_SIZE);
    session.fsWebSocket.send(chunk, { binary: true });
  }
}

function cleanupBackgroundTimer(sessionId: string): void {
  const timer = bgTimers.get(sessionId);
  if (timer) {
    clearInterval(timer);
    bgTimers.delete(sessionId);
  }
  bgLastAISend.delete(sessionId);
  bgDestroySession(sessionId);
}

function handleCallStop(callId: string, reason: string): void {
  const session = sessionManager.getSessionByCallId(callId);
  if (!session) return;

  cleanupBackgroundTimer(session.id);

  const duration = Date.now() - session.startTime.getTime();
  notifyCallEnd(session.id, duration, session.audioStats.bytesIn, session.audioStats.bytesOut, reason);
  sessionManager.endSession(session.id, reason);
}