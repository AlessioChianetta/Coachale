import { WebSocket } from 'ws';
import { config } from './config.js';
import { logger } from './logger.js';
import { base64ToPcm } from './audio-converter.js';

const log = logger.child('REPLIT-WS');

export interface ReplitClientOptions {
  sessionId: string;
  callerId: string;
scheduledCallId?: string;
  mode?: string;
  voice?: string;
  onAudioResponse: (audioData: Buffer) => void;
  onTextResponse?: (text: string) => void;
  onInterrupted?: () => void;
  onError: (error: Error) => void;
  onClose: () => void;
  onReconnecting?: () => void;
  onReconnected?: () => void;
}

export class ReplitWSClient {
  private ws: WebSocket | null = null;
  private sessionId: string;
  private callerId: string;
private scheduledCallId?: string;
  private options: ReplitClientOptions;
  private isConnected = false;
  private audioSequence = 0;

  private _isReconnecting = false;
  private pendingResumeHandle: string | null = null;
  private pendingSilentStreak = 0;
  private reconnectAttempt = 0;

  private latestResumeHandle: string | null = null;
  private wsConnectTime = 0;
  private lastAudioActivityTime = 0;
  private proactiveRestartInterval: ReturnType<typeof setInterval> | null = null;
  private isProactiveRestarting = false;

  constructor(options: ReplitClientOptions) {
    this.sessionId = options.sessionId;
    this.callerId = options.callerId;

this.scheduledCallId = options.scheduledCallId; 
    this.options = options;
  }

  get connected(): boolean {
    return this.isConnected;
  }

  get reconnecting(): boolean {
    return this._isReconnecting;
  }

  async connect(resumeHandle?: string, silentStreak?: number): Promise<void> {
    const mode = this.options.mode || 'phone_service';
    const voice = this.options.voice || config.voice.voiceId;

    let wsUrl = `${config.replit.wsUrl}?token=${config.replit.apiToken}&mode=${mode}&useFullPrompt=false&voice=${voice}&source=phone&callerId=${encodeURIComponent(this.callerId)}`;

if (this.scheduledCallId) {
    wsUrl += `&scheduledCallId=${encodeURIComponent(this.scheduledCallId)}`;
  }

    if (resumeHandle) {
      wsUrl += `&resumeHandle=${encodeURIComponent(resumeHandle)}`;
      if (silentStreak && silentStreak > 0) {
        wsUrl += `&silentStreak=${silentStreak}`;
      }
      log.info(`🔄 Connecting with resumeHandle for session resume`, {
        sessionId: this.sessionId.slice(0, 8),
        handlePreview: resumeHandle.substring(0, 20) + '...',
        silentStreak: silentStreak || 0,
      });
    }

    log.info(`Connecting to Replit WebSocket`, {
      sessionId: this.sessionId.slice(0, 8),
      url: config.replit.wsUrl,
      voice,
      isResume: !!resumeHandle,
    });

    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(wsUrl);

      const connectionTimeout = setTimeout(() => {
        if (!this.isConnected) {
          this.ws?.close();
          reject(new Error('Replit WebSocket connection timeout'));
        }
      }, 15000);

      this.ws.on('open', () => {
        log.info(`Replit WebSocket connected`, {
          sessionId: this.sessionId.slice(0, 8),
          resumed: !!resumeHandle,
        });
        this.isConnected = true;
        this.wsConnectTime = Date.now();
        this.lastAudioActivityTime = Date.now();
        this.isProactiveRestarting = false;
        this.startProactiveRestartTimer();
        if (this._isReconnecting) {
          this._isReconnecting = false;
          this.options.onReconnected?.();
          log.info(`✅ Session resumed successfully!`, {
            sessionId: this.sessionId.slice(0, 8),
            attempt: this.reconnectAttempt,
          });
        }
        clearTimeout(connectionTimeout);
        resolve();
      });

      this.ws.on('message', (data: any, isBinary: boolean) => {
        this.handleMessage(data, isBinary);
      });

      this.ws.on('error', (error) => {
        log.error(`Replit WebSocket error`, {
          sessionId: this.sessionId.slice(0, 8),
          error: error.message,
          isReconnecting: this._isReconnecting,
        });
        clearTimeout(connectionTimeout);
        this.options.onError(error);
        if (!this.isConnected) {
          reject(error);
        }
      });

      this.ws.on('close', (code, reason) => {
        log.info(`Replit WebSocket closed`, {
          sessionId: this.sessionId.slice(0, 8),
          code,
          reason: reason.toString(),
          hasPendingResume: !!this.pendingResumeHandle,
        });
        this.isConnected = false;

        if (this.pendingResumeHandle) {
          const handle = this.pendingResumeHandle;
          this.pendingResumeHandle = null;
          log.info(`🔄 Old connection closed → executing reconnect with resume handle`, { sessionId: this.sessionId.slice(0, 8) });
          this.executeReconnect(handle);
          return;
        }

        if (this._isReconnecting) {
          log.warn(`🔄 Connection closed during reconnect flow - will retry via executeReconnect`, { sessionId: this.sessionId.slice(0, 8) });
          return;
        }

        this.options.onClose();
      });
    });
  }

  private handleMessage(data: any, isBinary: boolean): void {
    if (isBinary) {
      this.lastAudioActivityTime = Date.now();
      this.options.onAudioResponse(data);
      return;
    }

    try {
      const text = data.toString();
      const message = JSON.parse(text);

      if ((message.type === 'audio' || message.type === 'audio_output') && message.data) {
        const audioData = base64ToPcm(message.data);
        this.options.onAudioResponse(audioData);
      }

      if ((message.type === 'text' || message.type === 'ai_transcript') && (message.text || message.message)) {
        const txt = message.text || message.message;
        log.info(`[AI DICE]: ${txt}`);
        this.options.onTextResponse?.(txt);
      }

      if (message.type === 'barge_in_detected') {
        log.info(`🛑 BARGE-IN received from Replit`, { sessionId: this.sessionId.slice(0, 8) });
        this.options.onInterrupted?.();
        return;
      }

      if (message.type === 'session_resumption_update' && message.handle) {
        this.latestResumeHandle = message.handle;
        log.info(`🔄 [SESSION HANDLE] Saved resume handle for proactive restart`, {
          sessionId: this.sessionId.slice(0, 8),
          handlePreview: message.handle.substring(0, 25) + '...',
        });
        return;
      }

      if (message.type === 'call_terminated') {
        log.info(`\n🚫 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        log.info(`🚫 [CALL TERMINATED] ${message.reason}: ${message.message}`);
        log.info(`🚫  Silent for ~${message.silentMinutes} minutes - abandoned call detected`);
        log.info(`🚫 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
        this.pendingResumeHandle = null;
        this._isReconnecting = false;
        this.options.onClose();
        return;
      }

      if (message.type === 'gemini_reconnecting') {
        this.handleGeminiReconnecting(message);
        return;
      }

      if (message.type === 'error') {
        if (message.errorType === 'RESOURCE_EXHAUSTED') {
          log.error(`🚨 RESOURCE_EXHAUSTED - stopping reconnect attempts`);
          this.pendingResumeHandle = null;
          this._isReconnecting = false;
        }
        log.error(`[REPLIT ERROR]: ${message.error || message.message}`);
      }

    } catch (error) {
      if (Buffer.isBuffer(data) && data.length > 0) {
        try {
          this.options.onAudioResponse(data);
        } catch (e) {
          log.error(`Error handling binary message`, { error: e instanceof Error ? e.message : 'Unknown' });
        }
      }
    }
  }

  private handleGeminiReconnecting(message: any): void {
    const { resumeHandle, attempt, maxAttempts, silentStreak } = message;
    this.pendingSilentStreak = silentStreak || 0;

    log.info(`\n🔄 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    log.info(`🔄 [SESSION RESUME] Gemini session timeout - reconnecting`);
    log.info(`🔄 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    log.info(`🔄  Session: ${this.sessionId.slice(0, 8)}`);
    log.info(`🔄  Resume handle: ${resumeHandle?.substring(0, 30)}...`);
    log.info(`🔄  Attempt: ${attempt}/${maxAttempts}`);
    log.info(`🔄  Action: Keep FreeSWITCH call alive, open new Replit WebSocket`);
    log.info(`🔄 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

    if (!resumeHandle) {
      log.error(`🔄 No resume handle provided - cannot reconnect`);
      return;
    }

    if (attempt > maxAttempts) {
      log.error(`🔄 Max reconnect attempts exceeded (${attempt}/${maxAttempts})`);
      return;
    }

    this._isReconnecting = true;
    this.reconnectAttempt = attempt;
    this.pendingResumeHandle = resumeHandle;
    this.options.onReconnecting?.();

    log.info(`🔄 Closing old WebSocket, will reconnect on close event...`, { sessionId: this.sessionId.slice(0, 8) });
    if (this.ws) {
      try {
        this.ws.close(1000, 'Reconnecting with resume handle');
      } catch (e) {
        log.warn(`🔄 Error closing old WS, forcing reconnect directly`, { sessionId: this.sessionId.slice(0, 8) });
        this.ws = null;
        this.isConnected = false;
        const handle = this.pendingResumeHandle;
        this.pendingResumeHandle = null;
        if (handle) this.executeReconnect(handle);
      }
    }
  }

  private async executeReconnect(resumeHandle: string): Promise<void> {
    log.info(`🔄 Executing reconnect with resume handle...`, {
      sessionId: this.sessionId.slice(0, 8),
      attempt: this.reconnectAttempt,
      silentStreak: this.pendingSilentStreak,
    });

    const RECONNECT_DELAY_MS = 500;
    await new Promise(resolve => setTimeout(resolve, RECONNECT_DELAY_MS));

    try {
      await this.connect(resumeHandle, this.pendingSilentStreak);
    } catch (error) {
      log.error(`❌ Reconnect failed`, {
        sessionId: this.sessionId.slice(0, 8),
        error: error instanceof Error ? error.message : 'Unknown',
        attempt: this.reconnectAttempt,
      });
      this._isReconnecting = false;
      this.options.onClose();
    }
  }

  sendAudio(pcmData: Buffer): void {
    if (!this.isConnected || !this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.lastAudioActivityTime = Date.now();
    this.ws.send(pcmData, { binary: true });
  }

  sendText(text: string): void {
    if (!this.isConnected || !this.ws) return;
    const message = { type: 'text', text };
    this.send(message);
  }

  private send(message: object): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  private startProactiveRestartTimer(): void {
    this.stopProactiveRestartTimer();
    this.proactiveRestartInterval = setInterval(() => {
      this.checkProactiveRestart();
    }, 5000);
  }

  private stopProactiveRestartTimer(): void {
    if (this.proactiveRestartInterval) {
      clearInterval(this.proactiveRestartInterval);
      this.proactiveRestartInterval = null;
    }
  }

  private checkProactiveRestart(): void {
    if (this.isProactiveRestarting || this._isReconnecting || !this.isConnected) return;
    if (!this.latestResumeHandle) return;

    const elapsedMs = Date.now() - this.wsConnectTime;
    const elapsedMinutes = elapsedMs / 1000 / 60;

    if (elapsedMinutes < 7) return;

    const silenceSec = (Date.now() - this.lastAudioActivityTime) / 1000;
    const isSilent = silenceSec > 2;

    if (isSilent) {
      log.info(`\n♻️ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      log.info(`♻️ [PROACTIVE RESTART] WebSocket age: ${elapsedMinutes.toFixed(1)}m, silence: ${silenceSec.toFixed(0)}s`);
      log.info(`♻️  Handle available: ${this.latestResumeHandle.substring(0, 25)}...`);
      log.info(`♻️  Action: Close + reconnect with resume handle`);
      log.info(`♻️ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
      this.triggerProactiveRestart();
    } else if (elapsedMinutes > 9) {
      log.warn(`\n⚠️ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      log.warn(`⚠️ [FORCE RESTART] WebSocket age: ${elapsedMinutes.toFixed(1)}m - forcing to avoid Gemini timeout`);
      log.warn(`⚠️ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
      this.triggerProactiveRestart();
    }
  }

  private triggerProactiveRestart(): void {
    if (this.isProactiveRestarting) return;
    this.isProactiveRestarting = true;
    this.stopProactiveRestartTimer();

    const handle = this.latestResumeHandle;
    if (!handle) {
      this.isProactiveRestarting = false;
      return;
    }

    this._isReconnecting = true;
    this.pendingResumeHandle = handle;
    this.latestResumeHandle = null;
    this.options.onReconnecting?.();

    if (this.ws) {
      try {
        this.ws.close(1000, 'Proactive Client Restart');
      } catch (e) {
        log.warn(`♻️ Error closing WS for proactive restart, forcing reconnect`);
        this.ws = null;
        this.isConnected = false;
        this.pendingResumeHandle = null;
        this.executeReconnect(handle);
      }
    }
  }

  close(): void {
    this.stopProactiveRestartTimer();
    this.pendingResumeHandle = null;
    this.latestResumeHandle = null;
    this._isReconnecting = false;
    this.isProactiveRestarting = false;
    if (this.ws) {
      try {
        this.ws.close(1000, 'Session ended');
      } catch (e) {}
      this.ws = null;
    }
    this.isConnected = false;
  }
}
