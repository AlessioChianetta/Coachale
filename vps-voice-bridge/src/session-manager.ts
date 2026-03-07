import { v4 as uuidv4 } from 'uuid';
import type { WebSocket } from 'ws';
import fs from 'fs';
import path from 'path';
import { logger, formatBytes, formatDuration } from './logger.js';
import { config } from './config.js';
import type { ReplitWSClient } from './replit-ws-client.js';

const log = logger.child('SESSION');
const syncLog = logger.child('OVERFLOW-SYNC');

const OVERFLOW_BASE_DIR = '/opt/sounds/overflow';
const OVERFLOW_DEFAULT_DIR = path.join(OVERFLOW_BASE_DIR, 'default');
const SYNC_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const lastSyncTimes = new Map<string, number>();

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    syncLog.info(`📁 Created directory: ${dir}`);
  }
}

export async function syncOverflowAudio(consultantId: string): Promise<string> {
  const consultantDir = path.join(OVERFLOW_BASE_DIR, consultantId);

  const lastSync = lastSyncTimes.get(consultantId) || 0;
  const elapsed = Date.now() - lastSync;
  if (elapsed < SYNC_CACHE_TTL_MS && fs.existsSync(consultantDir)) {
    const files = fs.readdirSync(consultantDir).filter(f => f.endsWith('.wav'));
    if (files.length > 0) {
      syncLog.info(`⏩ [SYNC] Skipping sync for ${consultantId.slice(0, 8)} — cached (${Math.round(elapsed / 60000)}min ago, ${files.length} files)`);
      return consultantDir;
    }
  }

  if (!config.replit.apiUrl || !config.serviceToken) {
    syncLog.warn(`⚠️ [SYNC] Replit API or service token not configured — using default audio`);
    ensureDir(OVERFLOW_DEFAULT_DIR);
    return OVERFLOW_DEFAULT_DIR;
  }

  try {
    syncLog.info(`🔄 [SYNC] Fetching manifest for consultant ${consultantId.slice(0, 8)}...`);
    const manifestUrl = `${config.replit.apiUrl}/api/voice/overflow-audio/download/${consultantId}/manifest`;
    const manifestRes = await fetch(manifestUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${config.serviceToken}`,
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!manifestRes.ok) {
      throw new Error(`Manifest fetch failed: ${manifestRes.status} ${manifestRes.statusText}`);
    }

    const manifestData = await manifestRes.json() as { success: boolean; files: Array<{ slotName: string; fileName: string; size: number; updatedAt: string }> };

    if (!manifestData.success || !manifestData.files || manifestData.files.length === 0) {
      syncLog.info(`📭 [SYNC] No custom audio files for consultant ${consultantId.slice(0, 8)} — using default`);
      ensureDir(OVERFLOW_DEFAULT_DIR);
      return OVERFLOW_DEFAULT_DIR;
    }

    ensureDir(consultantDir);

    let downloaded = 0;
    let skipped = 0;

    for (const file of manifestData.files) {
      const localPath = path.join(consultantDir, file.fileName);

      if (fs.existsSync(localPath)) {
        const localStats = fs.statSync(localPath);
        const localMtime = localStats.mtime.getTime();
        const remoteMtime = new Date(file.updatedAt).getTime();
        if (localStats.size === file.size && localMtime >= remoteMtime - 1000) {
          skipped++;
          continue;
        }
      }

      try {
        const downloadUrl = `${config.replit.apiUrl}/api/voice/overflow-audio/download/${consultantId}/${file.fileName}`;
        const dlRes = await fetch(downloadUrl, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${config.serviceToken}`,
          },
          signal: AbortSignal.timeout(30000),
        });

        if (!dlRes.ok) {
          syncLog.warn(`⚠️ [SYNC] Failed to download ${file.fileName}: ${dlRes.status}`);
          continue;
        }

        const arrayBuffer = await dlRes.arrayBuffer();
        fs.writeFileSync(localPath, Buffer.from(arrayBuffer));
        downloaded++;
        syncLog.info(`✅ [SYNC] Downloaded ${file.fileName} (${file.size} bytes)`);
      } catch (dlErr: any) {
        syncLog.warn(`⚠️ [SYNC] Error downloading ${file.fileName}: ${dlErr.message}`);
      }
    }

    const manifestFileNames = new Set(manifestData.files.map(f => f.fileName));
    const localFiles = fs.readdirSync(consultantDir).filter(f => f.endsWith('.wav'));
    let removed = 0;
    for (const localFile of localFiles) {
      if (!manifestFileNames.has(localFile)) {
        try {
          fs.unlinkSync(path.join(consultantDir, localFile));
          removed++;
          syncLog.info(`🗑️ [SYNC] Removed stale file ${localFile}`);
        } catch {}
      }
    }

    lastSyncTimes.set(consultantId, Date.now());
    syncLog.info(`🔄 [SYNC] Sync complete for ${consultantId.slice(0, 8)}: ${downloaded} downloaded, ${skipped} skipped, ${removed} removed, ${manifestData.files.length} total`);
    return consultantDir;

  } catch (err: any) {
    syncLog.error(`❌ [SYNC] Sync failed for ${consultantId.slice(0, 8)}: ${err.message}`);
    ensureDir(OVERFLOW_DEFAULT_DIR);
    return OVERFLOW_DEFAULT_DIR;
  }
}

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
  fsUuid: string;
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
  private fsUuidToSessionId: Map<string, string> = new Map();
  private _overflowQueue: OverflowEntry[] = [];
  private _dequeueInProgress = false;
  private _onTimeoutCallback: ((sessionId: string, callId: string, fsUuid: string) => void) | null = null;

  setOnTimeoutCallback(cb: (sessionId: string, callId: string, fsUuid: string) => void): void {
    this._onTimeoutCallback = cb;
  }

  get activeCount(): number {
    return this.sessions.size;
  }

  get maxConcurrent(): number {
    return config.session.maxConcurrent;
  }

  canAcceptNewCall(): boolean {
    const can = this.sessions.size < config.session.maxConcurrent;
    log.info(`📊 [SM] canAcceptNewCall: ${this.sessions.size}/${config.session.maxConcurrent} → ${can ? 'YES' : 'NO'}`);
    return can;
  }

  activeCountForNumber(calledNumber: string): number {
    const normalized = calledNumber.replace(/\D/g, '');
    let count = 0;
    const matching: string[] = [];
    for (const session of this.sessions.values()) {
      const sessNorm = session.calledNumber.replace(/\D/g, '');
      if (sessNorm === normalized || session.calledNumber === calledNumber) {
        count++;
        matching.push(`${session.id.slice(0,8)}(${session.calledNumber},${session.state})`);
      }
    }
    if (matching.length > 0) {
      log.info(`📊 [SM] activeCountForNumber(${calledNumber}): ${count} sessions match → [${matching.join(', ')}]`);
    }
    return count;
  }

  canAcceptCallForNumber(calledNumber: string, maxForNumber: number): boolean {
    const activeCount = this.activeCountForNumber(calledNumber);
    const can = activeCount < maxForNumber;
    log.info(`📊 [SM] canAcceptCallForNumber(${calledNumber}, max=${maxForNumber}): active=${activeCount} → ${can ? 'YES' : 'NO'}`);
    return can;
  }

  createSession(
    callId: string,
    callerId: string,
    calledNumber: string,
    codec: 'PCMU' | 'L16' = 'PCMU',
    sampleRate: number = 8000,
    fsWebSocket: WebSocket,
    fsUuid?: string
  ): CallSession {
    if (!this.canAcceptNewCall()) {
      throw new Error(`Max concurrent calls reached (${config.session.maxConcurrent})`);
    }

    const sessionId = uuidv4();
    const now = new Date();
    const resolvedFsUuid = fsUuid || callId;

    const session: CallSession = {
      id: sessionId,
      callId,
      fsUuid: resolvedFsUuid,
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
    if (resolvedFsUuid !== callId) {
      this.fsUuidToSessionId.set(resolvedFsUuid, sessionId);
    }

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

  getSessionByFsUuid(fsUuid: string): CallSession | undefined {
    const sessionId = this.fsUuidToSessionId.get(fsUuid);
    if (sessionId) {
      return this.sessions.get(sessionId);
    }
    const sessionIdByCallId = this.callIdToSessionId.get(fsUuid);
    if (sessionIdByCallId) {
      return this.sessions.get(sessionIdByCallId);
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
    if (session.fsUuid !== session.callId) {
      this.fsUuidToSessionId.delete(session.fsUuid);
    }
  }

  private startInactivityTimeout(session: CallSession): void {
    if (session.timeoutHandle) {
      clearTimeout(session.timeoutHandle);
    }

    session.timeoutHandle = setTimeout(() => {
      log.warn(`Session timeout (no activity)`, {
        sessionId: session.id.slice(0, 8),
        callId: session.callId,
        timeoutMs: config.session.timeoutMs,
      });
      if (this._onTimeoutCallback) {
        this._onTimeoutCallback(session.id, session.callId, session.fsUuid);
      } else {
        this.endSession(session.id, 'timeout');
      }
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
    log.info(`📥 [SM-OVERFLOW] addToOverflow: uuid=${uuid} calledNumber=${calledNumber} timeoutSecs=${timeoutSecs} | queueBefore=${this._overflowQueue.length}`);
    this.removeFromOverflow(uuid);

    const timeoutHandle = setTimeout(() => {
      log.warn(`⏰ [SM-OVERFLOW] Timeout reached for ${uuid} after ${timeoutSecs}s — removing from queue and calling onTimeout`);
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
    log.info(`📥 [SM-OVERFLOW] Added to overflow queue — queueAfter=${this._overflowQueue.length}`, { uuid, calledNumber, timeoutSecs });
    this._logQueueState();
  }

  removeFromOverflow(uuid: string): void {
    const idx = this._overflowQueue.findIndex(e => e.uuid === uuid);
    if (idx >= 0) {
      const entry = this._overflowQueue[idx];
      if (entry.timeoutHandle) clearTimeout(entry.timeoutHandle);
      this._overflowQueue.splice(idx, 1);
      log.info(`📤 [SM-OVERFLOW] Removed from overflow queue: uuid=${uuid} calledNumber=${entry.calledNumber} | queueAfter=${this._overflowQueue.length}`);
    }
  }

  getNextOverflow(): OverflowEntry | null {
    if (this._overflowQueue.length === 0) {
      log.info(`📤 [SM-OVERFLOW] getNextOverflow: queue empty → null`);
      return null;
    }
    const entry = this._overflowQueue.shift()!;
    if (entry.timeoutHandle) clearTimeout(entry.timeoutHandle);
    const waitedSecs = Math.round((Date.now() - entry.enqueuedAt) / 1000);
    log.info(`📤 [SM-OVERFLOW] Dequeued: uuid=${entry.uuid} calledNumber=${entry.calledNumber} waitedSecs=${waitedSecs} | remaining=${this._overflowQueue.length}`);
    return entry;
  }

  reinsertAtFront(entry: OverflowEntry, remainingTimeoutMs: number, onTimeout: (uuid: string) => void): void {
    log.info(`🔄 [SM-OVERFLOW] Re-inserting at front: uuid=${entry.uuid} calledNumber=${entry.calledNumber} remainingTimeout=${Math.round(remainingTimeoutMs/1000)}s`);
    const timeoutHandle = setTimeout(() => {
      log.warn(`⏰ [SM-OVERFLOW] Timeout reached for ${entry.uuid} (after re-insert)`);
      this.removeFromOverflow(entry.uuid);
      onTimeout(entry.uuid);
    }, remainingTimeoutMs);
    entry.timeoutHandle = timeoutHandle;
    this._overflowQueue.unshift(entry);
    log.info(`🔄 [SM-OVERFLOW] Re-inserted — queueSize=${this._overflowQueue.length}`);
    this._logQueueState();
  }

  private _logQueueState(): void {
    if (this._overflowQueue.length === 0) return;
    const now = Date.now();
    log.info(`📊 [SM-OVERFLOW] Queue state (${this._overflowQueue.length} entries):`);
    for (let i = 0; i < this._overflowQueue.length; i++) {
      const e = this._overflowQueue[i];
      log.info(`📊 [SM-OVERFLOW]   [${i}] uuid=${e.uuid} | calledNumber=${e.calledNumber} | waiting=${Math.round((now - e.enqueuedAt) / 1000)}s`);
    }
  }

  isInOverflow(uuid: string): boolean {
    return this._overflowQueue.some(e => e.uuid === uuid);
  }

  getAllSessions(): CallSession[] {
    return Array.from(this.sessions.values());
  }

  getActiveCountByNumber(): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const session of this.sessions.values()) {
      const num = session.calledNumber || 'unknown';
      counts[num] = (counts[num] || 0) + 1;
    }
    return counts;
  }

  getOverflowDetails(): { count: number; entries: Array<{ calledNumber: string; waitingSecs: number; uuid: string }> } {
    const now = Date.now();
    return {
      count: this._overflowQueue.length,
      entries: this._overflowQueue.map(e => ({
        calledNumber: e.calledNumber,
        waitingSecs: Math.round((now - e.enqueuedAt) / 1000),
        uuid: e.uuid,
      })),
    };
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
