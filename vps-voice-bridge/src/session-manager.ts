import { v4 as uuidv4 } from 'uuid';
import type { WebSocket } from 'ws';
import { logger, formatBytes, formatDuration } from './logger.js';
import { config } from './config.js';
import type { GeminiClient } from './gemini-client.js';

const log = logger.child('SESSION');

export interface ClientContext {
  userId?: string;
  userName?: string;
  consultantId?: string;
  consultantName?: string;
  role?: string;
  phoneNumber?: string;
}

export interface CallSession {
  id: string;
  callId: string;
  callerId: string;
  calledNumber: string;
  codec: 'PCMU' | 'L16';
  sampleRate: number;
  startTime: Date;
  state: 'connecting' | 'active' | 'ending' | 'ended';
  fsWebSocket: WebSocket | null;
  geminiClient: GeminiClient | null;
  clientContext: ClientContext | null;
  audioStats: {
    bytesIn: number;
    bytesOut: number;
    packetsIn: number;
    packetsOut: number;
    lastActivityTime: Date;
  };
  timeoutHandle: NodeJS.Timeout | null;
}

class SessionManager {
  private sessions: Map<string, CallSession> = new Map();
  private callIdToSessionId: Map<string, string> = new Map();

  get activeCount(): number {
    return this.sessions.size;
  }

  get maxConcurrent(): number {
    return config.session.maxConcurrent;
  }

  canAcceptNewCall(): boolean {
    return this.sessions.size < config.session.maxConcurrent;
  }

  createSession(
    callId: string,
    callerId: string,
    calledNumber: string,
    codec: 'PCMU' | 'L16' = 'PCMU',
    sampleRate: number = 8000,
    fsWebSocket: WebSocket
  ): CallSession {
    if (!this.canAcceptNewCall()) {
      throw new Error(`Max concurrent calls reached (${config.session.maxConcurrent})`);
    }

    const sessionId = uuidv4();
    const now = new Date();

    const session: CallSession = {
      id: sessionId,
      callId,
      callerId,
      calledNumber,
      codec,
      sampleRate,
      startTime: now,
      state: 'connecting',
      fsWebSocket,
      geminiClient: null,
      clientContext: null,
      audioStats: {
        bytesIn: 0,
        bytesOut: 0,
        packetsIn: 0,
        packetsOut: 0,
        lastActivityTime: now,
      },
      timeoutHandle: null,
    };

    this.sessions.set(sessionId, session);
    this.callIdToSessionId.set(callId, sessionId);

    this.startInactivityTimeout(session);

    log.info(`Session created`, {
      sessionId: sessionId.slice(0, 8),
      callId,
      callerId,
      calledNumber,
      codec,
      sampleRate,
      activeSessions: this.sessions.size,
    });

    return session;
  }

  getSession(sessionId: string): CallSession | undefined {
    return this.sessions.get(sessionId);
  }

  getSessionByCallId(callId: string): CallSession | undefined {
    const sessionId = this.callIdToSessionId.get(callId);
    if (sessionId) {
      return this.sessions.get(sessionId);
    }
    return undefined;
  }

  updateSessionState(sessionId: string, state: CallSession['state']): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      const oldState = session.state;
      session.state = state;
      log.info(`Session state change`, {
        sessionId: sessionId.slice(0, 8),
        from: oldState,
        to: state,
      });
    }
  }

  setGeminiClient(sessionId: string, client: GeminiClient): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.geminiClient = client;
      log.info(`Gemini client attached`, { sessionId: sessionId.slice(0, 8) });
    }
  }

  setClientContext(sessionId: string, context: ClientContext): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.clientContext = context;
      log.info(`Client context set`, {
        sessionId: sessionId.slice(0, 8),
        userId: context.userId?.slice(0, 8),
        userName: context.userName,
      });
    }
  }

  recordAudioIn(sessionId: string, bytes: number): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.audioStats.bytesIn += bytes;
      session.audioStats.packetsIn++;
      session.audioStats.lastActivityTime = new Date();
      this.resetInactivityTimeout(session);
    }
  }

  recordAudioOut(sessionId: string, bytes: number): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.audioStats.bytesOut += bytes;
      session.audioStats.packetsOut++;
      session.audioStats.lastActivityTime = new Date();
    }
  }

  endSession(sessionId: string, reason: string = 'normal'): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return;
    }

    if (session.timeoutHandle) {
      clearTimeout(session.timeoutHandle);
    }

    session.state = 'ended';

    if (session.geminiClient) {
      try {
        session.geminiClient.close();
      } catch (e) {}
    }

    const duration = Date.now() - session.startTime.getTime();

    log.info(`Session ended`, {
      sessionId: sessionId.slice(0, 8),
      callId: session.callId,
      reason,
      duration,
      bytesIn: session.audioStats.bytesIn,
      bytesOut: session.audioStats.bytesOut,
      packetsIn: session.audioStats.packetsIn,
      packetsOut: session.audioStats.packetsOut,
    });

    this.sessions.delete(sessionId);
    this.callIdToSessionId.delete(session.callId);
  }

  private startInactivityTimeout(session: CallSession): void {
    if (session.timeoutHandle) {
      clearTimeout(session.timeoutHandle);
    }

    session.timeoutHandle = setTimeout(() => {
      log.warn(`Session timeout (no activity)`, {
        sessionId: session.id.slice(0, 8),
        timeoutMs: config.session.timeoutMs,
      });
      this.endSession(session.id, 'timeout');
    }, config.session.timeoutMs);
  }

  private resetInactivityTimeout(session: CallSession): void {
    this.startInactivityTimeout(session);
  }

  getAllSessions(): CallSession[] {
    return Array.from(this.sessions.values());
  }

  getStats(): {
    activeSessions: number;
    maxSessions: number;
    totalBytesIn: number;
    totalBytesOut: number;
  } {
    let totalBytesIn = 0;
    let totalBytesOut = 0;

    for (const session of this.sessions.values()) {
      totalBytesIn += session.audioStats.bytesIn;
      totalBytesOut += session.audioStats.bytesOut;
    }

    return {
      activeSessions: this.sessions.size,
      maxSessions: config.session.maxConcurrent,
      totalBytesIn,
      totalBytesOut,
    };
  }
}

export const sessionManager = new SessionManager();
