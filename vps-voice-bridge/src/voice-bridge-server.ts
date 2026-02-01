import { WebSocketServer, WebSocket } from 'ws';
import { createServer, type IncomingMessage } from 'http';
import { parse as parseUrl } from 'url';
import { config } from './config.js';
import { logger } from './logger.js';
import { sessionManager } from './session-manager.js';
import { ReplitWSClient } from './replit-ws-client.js';
import { convertForGemini, convertFromGemini } from './audio-converter.js';
import { fetchCallerContext, notifyCallStart, notifyCallEnd } from './caller-context.js';

const log = logger.child('SERVER');

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

function isAuthorized(req: IncomingMessage): boolean {
  if (!config.ws.authToken) return true;
  
  const clientIp = req.socket.remoteAddress || '';
  const isLocalhost = clientIp === '127.0.0.1' || clientIp === '::1' || clientIp === '::ffff:127.0.0.1';
  if (isLocalhost) return true;
  
  const url = parseUrl(req.url || '', true);
  return url.query.token === config.ws.authToken;
}

export function startVoiceBridgeServer(): void {
  const server = createServer((req, res) => {
    if (req.url?.startsWith('/health')) {
      if (!isAuthorized(req)) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Unauthorized' }));
        return;
      }
      const stats = sessionManager.getStats();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: 'ok',
        activeSessions: stats.activeSessions,
        maxSessions: stats.maxSessions,
        uptime: process.uptime(),
      }));
      return;
    }

    if (req.url?.startsWith('/stats')) {
      if (!isAuthorized(req)) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Unauthorized' }));
        return;
      }
      const stats = sessionManager.getStats();
      const sessions = sessionManager.getAllSessions().map(s => ({
        id: s.id.slice(0, 8),
        callId: s.callId,
        callerId: s.callerId.slice(0, 6) + '***',
        state: s.state,
        duration: Date.now() - s.startTime.getTime(),
        bytesIn: s.audioStats.bytesIn,
        bytesOut: s.audioStats.bytesOut,
      }));
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ stats, sessions }));
      return;
    }

    res.writeHead(404);
    res.end('Not Found');
  });

  const wss = new WebSocketServer({ server });

  wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
    const clientIp = req.socket.remoteAddress || 'unknown';
    const url = parseUrl(req.url || '', true);

    if (config.ws.authToken) {
      const token = url.query.token;
      const isLocalNetwork = 
        clientIp === '127.0.0.1' || 
        clientIp === '::1' || 
        clientIp === '::ffff:127.0.0.1' ||
        clientIp.startsWith('172.17.') ||
        clientIp.startsWith('::ffff:172.17.') ||
        clientIp.startsWith('172.18.') ||
        clientIp.startsWith('::ffff:172.18.') ||
        clientIp.startsWith('10.') ||
        clientIp.startsWith('::ffff:10.');

      if (!isLocalNetwork && token !== config.ws.authToken) {
        log.warn(`Unauthorized connection attempt`, { clientIp });
        ws.close(4001, 'Unauthorized');
        return;
      }
      
      if (isLocalNetwork) {
        log.debug(`Allowing local network connection without token`, { clientIp });
      }
    }

    log.info(`New WebSocket connection`, { clientIp });

    if (!sessionManager.canAcceptNewCall()) {
      log.warn(`Rejecting connection: max concurrent calls reached`);
      ws.close(4003, 'Server busy');
      return;
    }

    let currentSessionId: string | null = null;

    ws.on('message', async (data: Buffer, isBinary: boolean) => {
      if (isBinary) {
        if (currentSessionId) {
          handleAudioData(currentSessionId, data);
        }
        return;
      }

      try {
        const message = JSON.parse(data.toString()) as AudioStreamMessage;
        
        if (message.event === 'start') {
          currentSessionId = await handleCallStart(ws, message);
        } else if (message.event === 'stop') {
          handleCallStop(message.call_id, message.reason);
          currentSessionId = null;
        }
      } catch (error) {
        log.error(`Error parsing message`, {
          error: error instanceof Error ? error.message : 'Unknown',
        });
      }
    });

    ws.on('close', (code, reason) => {
      log.info(`WebSocket closed`, { code, reason: reason.toString() });
      if (currentSessionId) {
        const session = sessionManager.getSession(currentSessionId);
        if (session) {
          handleCallStop(session.callId, 'websocket_closed');
        }
      }
    });

    ws.on('error', (error) => {
      log.error(`WebSocket error`, { error: error.message });
    });
  });

  server.listen(config.ws.port, config.ws.host, () => {
    log.info(`Voice Bridge Server started`, {
      host: config.ws.host,
      port: config.ws.port,
      authRequired: !!config.ws.authToken,
      maxConcurrent: config.session.maxConcurrent,
    });
    log.info(`Health check: http://${config.ws.host}:${config.ws.port}/health`);
  });

  process.on('SIGTERM', () => {
    log.info('Received SIGTERM, shutting down...');
    gracefulShutdown(server, wss);
  });

  process.on('SIGINT', () => {
    log.info('Received SIGINT, shutting down...');
    gracefulShutdown(server, wss);
  });
}

async function handleCallStart(
  fsWebSocket: WebSocket,
  message: AudioStreamStartMessage
): Promise<string> {
  log.info(`Call started`, {
    callId: message.call_id,
    callerId: message.caller_id,
    calledNumber: message.called_number,
    codec: message.codec,
    sampleRate: message.sample_rate,
  });

  const session = sessionManager.createSession(
    message.call_id,
    message.caller_id,
    message.called_number,
    message.codec,
    message.sample_rate,
    fsWebSocket
  );

  const clientContext = await fetchCallerContext(message.caller_id);
  if (clientContext) {
    sessionManager.setClientContext(session.id, clientContext);
  }

  await notifyCallStart(session.id, message.caller_id, message.called_number);

  try {
    const replitClient = new ReplitWSClient({
      sessionId: session.id,
      callerId: message.caller_id,
      onAudioResponse: (audioData: Buffer) => {
        sendAudioToFreeSWITCH(session.id, audioData);
      },
      onTextResponse: (text: string) => {
        log.debug(`AI text`, { sessionId: session.id.slice(0, 8), text: text.slice(0, 100) });
      },
      onError: (error: Error) => {
        log.error(`Replit WS error`, { sessionId: session.id.slice(0, 8), error: error.message });
      },
      onClose: () => {
        log.info(`Replit connection closed`, { sessionId: session.id.slice(0, 8) });
      },
    });

    await replitClient.connect();
    sessionManager.setReplitClient(session.id, replitClient);

    sessionManager.updateSessionState(session.id, 'active');
    log.info(`Call active - Replit connected`, { sessionId: session.id.slice(0, 8) });

  } catch (error) {
    log.error(`Failed to connect to Replit`, {
      sessionId: session.id.slice(0, 8),
      error: error instanceof Error ? error.message : 'Unknown',
    });
    sessionManager.endSession(session.id, 'replit_connection_failed');
  }

  return session.id;
}

function handleAudioData(sessionId: string, audioData: Buffer): void {
  const session = sessionManager.getSession(sessionId);
  if (!session || session.state !== 'active') {
    return;
  }

  sessionManager.recordAudioIn(sessionId, audioData.length);

  const pcmData = convertForGemini(audioData, session.codec, session.sampleRate);

  if (session.replitClient && session.replitClient.connected) {
    session.replitClient.sendAudio(pcmData);
  }
}

function sendAudioToFreeSWITCH(sessionId: string, geminiAudio: Buffer): void {
  const session = sessionManager.getSession(sessionId);
  if (!session || !session.fsWebSocket) {
    return;
  }

  const fsAudio = convertFromGemini(geminiAudio, session.codec, session.sampleRate);
  
  sessionManager.recordAudioOut(sessionId, fsAudio.length);

  if (session.fsWebSocket.readyState === WebSocket.OPEN) {
    session.fsWebSocket.send(fsAudio);
  }
}

function handleCallStop(callId: string, reason: string): void {
  const session = sessionManager.getSessionByCallId(callId);
  if (!session) {
    return;
  }

  const duration = Date.now() - session.startTime.getTime();

  notifyCallEnd(
    session.id,
    duration,
    session.audioStats.bytesIn,
    session.audioStats.bytesOut,
    reason
  );

  sessionManager.endSession(session.id, reason);
}

function gracefulShutdown(server: ReturnType<typeof createServer>, wss: WebSocketServer): void {
  log.info('Starting graceful shutdown...');

  for (const session of sessionManager.getAllSessions()) {
    sessionManager.endSession(session.id, 'server_shutdown');
  }

  wss.close(() => {
    log.info('WebSocket server closed');
    server.close(() => {
      log.info('HTTP server closed');
      process.exit(0);
    });
  });

  setTimeout(() => {
    log.warn('Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
}
