import WebSocket from 'ws';
import { config } from './config.js';
import { logger } from './logger.js';
import { pcmToBase64, base64ToPcm } from './audio-converter.js';
import type { ClientContext } from './session-manager.js';

const log = logger.child('GEMINI');

export interface GeminiClientOptions {
  sessionId: string;
  callerId: string;
  clientContext?: ClientContext | null;
  onAudioResponse: (audioData: Buffer) => void;
  onTextResponse?: (text: string) => void;
  onError: (error: Error) => void;
  onClose: () => void;
}

export class GeminiClient {
  private ws: WebSocket | null = null;
  private sessionId: string;
  private callerId: string;
  private clientContext: ClientContext | null;
  private options: GeminiClientOptions;
  private isConnected = false;
  private setupComplete = false;

  constructor(options: GeminiClientOptions) {
    this.sessionId = options.sessionId;
    this.callerId = options.callerId;
    this.clientContext = options.clientContext || null;
    this.options = options;
  }

  async connect(): Promise<void> {
    const wsUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${config.gemini.apiKey}`;

    log.info(`Connecting to Gemini Live API`, { sessionId: this.sessionId.slice(0, 8) });

    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(wsUrl);

      const connectionTimeout = setTimeout(() => {
        if (!this.isConnected) {
          this.ws?.close();
          reject(new Error('Gemini connection timeout'));
        }
      }, 10000);

      this.ws.on('open', () => {
        log.info(`Gemini WebSocket connected`, { sessionId: this.sessionId.slice(0, 8) });
        this.isConnected = true;
        clearTimeout(connectionTimeout);
        this.sendSetupMessage();
      });

      this.ws.on('message', (data: Buffer) => {
        this.handleMessage(data);
        if (!this.setupComplete) {
          this.setupComplete = true;
          resolve();
        }
      });

      this.ws.on('error', (error) => {
        log.error(`Gemini WebSocket error`, {
          sessionId: this.sessionId.slice(0, 8),
          error: error.message,
        });
        clearTimeout(connectionTimeout);
        this.options.onError(error);
        if (!this.setupComplete) {
          reject(error);
        }
      });

      this.ws.on('close', (code, reason) => {
        log.info(`Gemini WebSocket closed`, {
          sessionId: this.sessionId.slice(0, 8),
          code,
          reason: reason.toString(),
        });
        this.isConnected = false;
        this.options.onClose();
      });
    });
  }

  private sendSetupMessage(): void {
    const systemPrompt = this.buildSystemPrompt();

    const setupMessage = {
      setup: {
        model: `models/${config.gemini.model}`,
        generationConfig: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: config.gemini.voiceId,
              },
            },
          },
        },
        systemInstruction: {
          parts: [{ text: systemPrompt }],
        },
      },
    };

    this.send(setupMessage);
    log.info(`Gemini setup message sent`, {
      sessionId: this.sessionId.slice(0, 8),
      model: config.gemini.model,
      voice: config.gemini.voiceId,
    });
  }

  private buildSystemPrompt(): string {
    let prompt = `Sei Alessia, un'assistente AI vocale professionale. Stai rispondendo a una chiamata telefonica.

REGOLE FONDAMENTALI:
- Rispondi SEMPRE in italiano
- Sii cordiale, professionale e concisa
- Usa un tono conversazionale naturale
- Non usare emoji o formattazione - stai parlando al telefono
- Rispondi in modo breve e diretto (massimo 2-3 frasi per risposta)
- Se non capisci, chiedi gentilmente di ripetere`;

    if (this.clientContext) {
      prompt += `\n\nINFORMAZIONI CLIENTE:`;
      if (this.clientContext.userName) {
        prompt += `\n- Nome: ${this.clientContext.userName}`;
      }
      if (this.clientContext.consultantName) {
        prompt += `\n- Consulente: ${this.clientContext.consultantName}`;
      }
      prompt += `\n\nUsa queste informazioni per personalizzare la conversazione.`;
    } else {
      prompt += `\n\nQuesto è un chiamante non riconosciuto. Chiedi cortesemente chi sono e come puoi aiutarli.`;
    }

    prompt += `\n\nNumero chiamante: ${this.callerId}`;

    return prompt;
  }

  private handleMessage(data: Buffer): void {
    try {
      const message = JSON.parse(data.toString());

      if (message.serverContent?.modelTurn?.parts) {
        for (const part of message.serverContent.modelTurn.parts) {
          if (part.inlineData?.data) {
            const audioData = base64ToPcm(part.inlineData.data);
            this.options.onAudioResponse(audioData);
          }
          if (part.text) {
            this.options.onTextResponse?.(part.text);
          }
        }
      }

      if (message.setupComplete) {
        log.info(`Gemini setup complete`, { sessionId: this.sessionId.slice(0, 8) });
      }

      if (message.serverContent?.turnComplete) {
        log.debug(`Gemini turn complete`, { sessionId: this.sessionId.slice(0, 8) });
      }

    } catch (error) {
      log.error(`Error parsing Gemini message`, {
        sessionId: this.sessionId.slice(0, 8),
        error: error instanceof Error ? error.message : 'Unknown',
      });
    }
  }

  sendAudio(pcmData: Buffer): void {
    if (!this.isConnected || !this.ws) {
      return;
    }

    const message = {
      realtimeInput: {
        mediaChunks: [
          {
            mimeType: 'audio/pcm;rate=16000',
            data: pcmToBase64(pcmData),
          },
        ],
      },
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

  getWebSocket(): WebSocket | null {
    return this.ws;
  }
}
