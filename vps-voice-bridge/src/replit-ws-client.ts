import WebSocket from 'ws';
import { config } from './config.js';
import { logger } from './logger.js';
import { pcmToBase64, base64ToPcm } from './audio-converter.js';
import type { ClientContext } from './session-manager.js';

const log = logger.child('REPLIT-WS');

export interface ReplitClientOptions {
  sessionId: string;
  callerId: string;
  scheduledCallId?: string;
  mode?: string;
  voice?: string;
  onAudioResponse: (audioData: Buffer) => void;
  onTextResponse?: (text: string) => void;
  onError: (error: Error) => void;
  onClose: () => void;
}

export class ReplitWSClient {
  private ws: WebSocket | null = null;
  private sessionId: string;
  private callerId: string;
  private scheduledCallId: string | undefined;
  private options: ReplitClientOptions;
  private isConnected = false;
  private audioSequence = 0;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 3;

  constructor(options: ReplitClientOptions) {
    this.sessionId = options.sessionId;
    this.callerId = options.callerId;
    this.scheduledCallId = options.scheduledCallId;
    this.options = options;
  }

  async connect(): Promise<void> {
    const mode = this.options.mode || 'phone_service';
    const voice = this.options.voice || config.voice.voiceId;
    
    let wsUrl = `${config.replit.wsUrl}?token=${config.replit.apiToken}&mode=${mode}&useFullPrompt=false&voice=${voice}&source=phone&callerId=${encodeURIComponent(this.callerId)}`;
    
    if (this.scheduledCallId) {
      wsUrl += `&scheduledCallId=${encodeURIComponent(this.scheduledCallId)}`;
    }

    log.info(`Connecting to Replit WebSocket`, { 
      sessionId: this.sessionId.slice(0, 8),
      url: config.replit.wsUrl,
      mode,
      voice,
      scheduledCallId: this.scheduledCallId || 'none',
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
        log.info(`Replit WebSocket connected`, { sessionId: this.sessionId.slice(0, 8) });
        this.isConnected = true;
        this.reconnectAttempts = 0;
        clearTimeout(connectionTimeout);
        resolve();
      });

      this.ws.on('message', (data: Buffer, isBinary: boolean) => {
        this.handleMessage(data, isBinary);
      });

      this.ws.on('error', (error) => {
        log.error(`Replit WebSocket error`, {
          sessionId: this.sessionId.slice(0, 8),
          error: error.message,
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
        });
        this.isConnected = false;
        this.options.onClose();
      });
    });
  }

  private handleMessage(data: Buffer, isBinary: boolean): void {
    if (isBinary) {
      this.options.onAudioResponse(data);
      return;
    }

    try {
      const message = JSON.parse(data.toString());

      if (message.type === 'audio' && message.data) {
        const audioData = base64ToPcm(message.data);
        this.options.onAudioResponse(audioData);
      }

      if (message.type === 'text' && message.text) {
        this.options.onTextResponse?.(message.text);
      }

      if (message.type === 'turn_complete') {
        log.debug(`Turn complete`, { sessionId: this.sessionId.slice(0, 8) });
      }

      if (message.type === 'error') {
        log.error(`Replit error message`, {
          sessionId: this.sessionId.slice(0, 8),
          error: message.error || message.message,
        });
      }

      if (message.type === 'connected' || message.type === 'setup_complete') {
        log.info(`Replit session ready`, { sessionId: this.sessionId.slice(0, 8) });
      }

    } catch (error) {
      if (Buffer.isBuffer(data) && data.length > 0) {
        try {
          this.options.onAudioResponse(data);
        } catch (e) {
          log.error(`Error handling binary message`, {
            sessionId: this.sessionId.slice(0, 8),
            error: e instanceof Error ? e.message : 'Unknown',
          });
        }
      }
    }
  }

  sendAudio(pcmData: Buffer): void {
    if (!this.isConnected || !this.ws) {
      return;
    }

    const message = {
      type: 'audio',
      data: pcmToBase64(pcmData),
      sequence: this.audioSequence++,
    };

    this.send(message);
  }

  sendText(text: string): void {
    if (!this.isConnected || !this.ws) {
      return;
    }

    const message = {
      type: 'text',
      text,
    };

    this.send(message);
  }

  private send(message: object): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  close(): void {
    if (this.ws) {
      try {
        this.ws.close(1000, 'Session ended');
      } catch (e) {}
      this.ws = null;
    }
    this.isConnected = false;
  }

  get connected(): boolean {
    return this.isConnected;
  }
}
