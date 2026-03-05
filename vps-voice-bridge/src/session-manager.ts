import { v4 as uuidv4 } from 'uuid';
import type { WebSocket } from 'ws';
import { logger, formatBytes, formatDuration } from './logger.js';
import { config } from './config.js';
import type { ReplitWSClient } from './replit-ws-client.js';

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
  state: 'connecting' | 'active' | 'reconnecting' | 'ending' | 'ended';
  fsWebSocket: WebSocket | null;
  replitClient: ReplitWSClient | null;
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

export interface OverflowEntry {
  uuid: string;
  calledNumber: string;
  enqueuedAt: number;
  timeoutHandle: NodeJS.Timeout | null;
}

class SessionManager {
  private sessions: Map<string, CallSession> = new Map();
  private callIdToSessionId: Map<string, string> = new Map();
  private _overflowQueue: OverflowEntry[] = [];
  private _dequeueInProgress = false;

  get activeCount(): number {
    return this.sessions.size;
  }

  get maxConcurrent(): number {
    return config.session.maxConcurrent;
  }

  canAcceptNewCall(): boolean {
    return this.sessions.size < config.session.maxConcurrent;
  }

  activeCountForNumber(calledNumber: string): number {
    const normalized = calledNumber.replace(/\D/g, '');
    let count = 0;
    for (const session of this.sessions.values()) {
      const sessNorm = session.calledNumber.replace(/\D/g, '');
      if (sessNorm === normalized || session.calledNumber === calledNumber) {
        count++;
      }
    }
    return count;
  }

  canAcceptCallForNumber(calledNumber: string, maxForNumber: number): boolean {
    return this.activeCountForNumber(calledNumber) < maxForNumber;
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
      replitClient: null,
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

  setReplitClient(sessionId: string, client: ReplitWSClient): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.replitClient = client;
      log.info(`Replit client attached`, { sessionId: sessionId.slice(0, 8) });
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

  pauseInactivityTimeout(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session && session.timeoutHandle) {
      clearTimeout(session.timeoutHandle);
      session.timeoutHandle = null;
      log.info(`Inactivity timeout paused (session resume)`, { sessionId: sessionId.slice(0, 8) });
    }
  }

  resumeInactivityTimeout(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      this.startInactivityTimeout(session);
      log.info(`Inactivity timeout resumed`, { sessionId: sessionId.slice(0, 8) });
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

    if (session.replitClient) {
      try {
        session.replitClient.close();
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

  get overflowCount(): number {
    return this._overflowQueue.length;
  }

  get dequeueInProgress(): boolean {
    return this._dequeueInProgress;
  }

  set dequeueInProgress(v: boolean) {
    this._dequeueInProgress = v;
  }

  addToOverflow(uuid: string, calledNumber: string, timeoutSecs: number, onTimeout: (uuid: string) => void): void {
    this.removeFromOverflow(uuid);

    const timeoutHandle = setTimeout(() => {
      log.warn(`⏰ Overflow timeout reached for ${uuid} after ${timeoutSecs}s`);
      this.removeFromOverflow(uuid);
      onTimeout(uuid);
    }, timeoutSecs * 1000);

    const entry: OverflowEntry = {
      uuid,
      calledNumber,
      enqueuedAt: Date.now(),
      timeoutHandle,
    };

    this._overflowQueue.push(entry);
    log.info(`📥 Added to overflow queue`, { uuid, calledNumber, queueSize: this._overflowQueue.length, timeoutSecs });
  }

  removeFromOverflow(uuid: string): void {
    const idx = this._overflowQueue.findIndex(e => e.uuid === uuid);
    if (idx >= 0) {
      const entry = this._overflowQueue[idx];
      if (entry.timeoutHandle) clearTimeout(entry.timeoutHandle);
      this._overflowQueue.splice(idx, 1);
      log.info(`📤 Removed from overflow queue`, { uuid, queueSize: this._overflowQueue.length });
    }
  }

  getNextOverflow(): OverflowEntry | null {
    if (this._overflowQueue.length === 0) return null;
    const entry = this._overflowQueue.shift()!;
    if (entry.timeoutHandle) clearTimeout(entry.timeoutHandle);
    log.info(`📤 Dequeued from overflow`, { uuid: entry.uuid, calledNumber: entry.calledNumber, remaining: this._overflowQueue.length });
    return entry;
  }

  reinsertAtFront(entry: OverflowEntry, remainingTimeoutMs: number, onTimeout: (uuid: string) => void): void {
    const timeoutHandle = setTimeout(() => {
      log.warn(`⏰ Overflow timeout reached for ${entry.uuid}`);
      this.removeFromOverflow(entry.uuid);
      onTimeout(entry.uuid);
    }, remainingTimeoutMs);
    entry.timeoutHandle = timeoutHandle;
    this._overflowQueue.unshift(entry);
    log.info(`🔄 Re-inserted at front of overflow queue`, { uuid: entry.uuid, calledNumber: entry.calledNumber, remainingMs: remainingTimeoutMs, queueSize: this._overflowQueue.length });
  }

  isInOverflow(uuid: string): boolean {
    return this._overflowQueue.some(e => e.uuid === uuid);
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
