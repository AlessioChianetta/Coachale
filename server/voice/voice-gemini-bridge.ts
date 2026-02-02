import { GoogleGenAI, Modality, Session } from '@google/genai';
import { buildSystemPrompt } from '../ai-prompts';
import { EventEmitter } from 'events';
import { voiceConfig } from './config';

interface LiveServerMessage {
  serverContent?: {
    modelTurn?: {
      parts?: Array<{
        inlineData?: {
          mimeType?: string;
          data: string;
        };
        text?: string;
      }>;
    };
    turnComplete?: boolean;
  };
}

interface GeminiBridgeConfig {
  model: string;
  voiceId: string;
  sampleRate: number;
}

interface ConversationContext {
  callerInfo: any;
  userContext: any;
  greeting: string;
  consultantId: string;
}

type SessionState = 'idle' | 'connecting' | 'active' | 'closing' | 'closed' | 'error';

export class VoiceGeminiBridge extends EventEmitter {
  private session: Session | null = null;
  private config: GeminiBridgeConfig;
  private context: ConversationContext | null = null;
  private state: SessionState = 'idle';
  private audioBuffer: Buffer[] = [];
  private transcriptBuffer: string[] = [];

  constructor(config?: Partial<GeminiBridgeConfig>) {
    super();
    this.config = {
      model: config?.model || voiceConfig.gemini.model,
      voiceId: config?.voiceId || voiceConfig.gemini.voiceId,
      sampleRate: config?.sampleRate || voiceConfig.audio.sampleRateIn,
    };
  }

  async initialize(context: ConversationContext): Promise<void> {
    this.context = context;
    this.state = 'connecting';

    console.log('[GeminiBridge] Initializing session...');

    try {
      const apiKey = process.env.GOOGLE_AI_API_KEY || process.env.AI_INTEGRATIONS_GOOGLE_AI_API_KEY;
      if (!apiKey) {
        throw new Error('Gemini API key not configured');
      }

      const genAI = new GoogleGenAI({ apiKey });

      const systemPrompt = await this.buildVoiceSystemPrompt(context);

      this.session = await genAI.live.connect({
        model: this.config.model,
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: this.config.voiceId,
              },
            },
          },
          systemInstruction: systemPrompt,
        },
      });

      this.setupSessionHandlers();
      this.state = 'active';

      console.log('[GeminiBridge] Session initialized successfully');
      this.emit('ready');
    } catch (error) {
      this.state = 'error';
      console.error('[GeminiBridge] Initialization error:', error);
      this.emit('error', error);
      throw error;
    }
  }

  private async buildVoiceSystemPrompt(context: ConversationContext): Promise<string> {
    let basePrompt = '';

    if (context.userContext) {
      basePrompt = await buildSystemPrompt(
        context.userContext,
        context.consultantId,
        'general'
      );
    } else {
      basePrompt = `Sei Alessia, un'assistente AI professionale e amichevole.
Parli in italiano con un tono caldo e naturale.
Sei paziente, chiara e concisa nelle tue risposte.`;
    }

    const voiceInstructions = `

## ISTRUZIONI VOCALI CRITICHE

Stai parlando al telefono. Segui queste regole:

1. **Brevità**: Risposte massimo 2-3 frasi. Evita muri di testo.
2. **Naturalezza**: Usa linguaggio colloquiale, non formale.
3. **Pause**: Usa "..." per pause naturali nel parlato.
4. **Conferme**: Usa "Perfetto", "Capisco", "Certo" per confermare.
5. **Domande**: Fai una domanda alla volta, aspetta risposta.
6. **Numeri**: Pronuncia cifra per cifra (es: "tre quattro cinque" non "trecentoquarantacinque").
7. **Evita**: Markdown, elenchi puntati, formattazioni scritte.
8. **Empatia**: Mostra comprensione se il chiamante sembra confuso o frustrato.

## CONTESTO CHIAMANTE
${context.callerInfo.isClient 
  ? `Conosci questo cliente: ${context.callerInfo.name}. Usa il suo nome occasionalmente.`
  : `NUOVO CONTATTO - non è un cliente esistente${context.callerInfo.isRecognized ? ` (ma conosci ${context.callerInfo.name})` : ''}.

Questo è un POTENZIALE CLIENTE. Usa lo STESSO TONO amichevole, energico e informale che useresti con un cliente!

OBIETTIVO: Mini discovery e proposta appuntamento.
Accoglilo con calore genuino. Chiedi con curiosità perché sta chiamando. Ascolta attivamente e fai domande di approfondimento. Capisci cosa cerca, che problemi ha, cosa lo ha spinto a chiamare. Se appropriato, proponi una consulenza conoscitiva in modo naturale, tipo: "Ti va se fissiamo una chiacchierata più approfondita?"

Sii energico come sempre. NON essere formale. NON fare subito pitch commerciali. NON parlare di prezzi senza aver capito le esigenze.`
}`;

    return basePrompt + voiceInstructions;
  }

  private setupSessionHandlers(): void {
    if (!this.session) return;

    this.session.on('message', (message: LiveServerMessage) => {
      if (message.serverContent) {
        if (message.serverContent.modelTurn) {
          const parts = message.serverContent.modelTurn.parts || [];
          
          for (const part of parts) {
            if (part.inlineData?.mimeType?.startsWith('audio/')) {
              const audioData = Buffer.from(part.inlineData.data, 'base64');
              this.emit('audio', audioData);
              this.audioBuffer.push(audioData);
            }
            
            if (part.text) {
              this.emit('text', part.text);
              this.transcriptBuffer.push(part.text);
            }
          }
        }

        if (message.serverContent.turnComplete) {
          this.emit('turnComplete');
        }
      }
    });

    this.session.on('error', (error: Error) => {
      console.error('[GeminiBridge] Session error:', error);
      this.state = 'error';
      this.emit('error', error);
    });

    this.session.on('close', () => {
      console.log('[GeminiBridge] Session closed');
      this.state = 'closed';
      this.emit('close');
    });
  }

  async sendAudio(audioData: Buffer): Promise<void> {
    if (!this.session || this.state !== 'active') {
      console.warn('[GeminiBridge] Cannot send audio: session not active');
      return;
    }

    try {
      const base64Audio = audioData.toString('base64');
      
      await this.session.sendRealtimeInput({
        audio: {
          data: base64Audio,
          mimeType: 'audio/pcm;rate=16000',
        },
      });
    } catch (error) {
      console.error('[GeminiBridge] Error sending audio:', error);
      this.emit('error', error);
    }
  }

  async sendText(text: string): Promise<void> {
    if (!this.session || this.state !== 'active') {
      console.warn('[GeminiBridge] Cannot send text: session not active');
      return;
    }

    try {
      await this.session.sendClientContent({
        turns: [{
          role: 'user',
          parts: [{ text }],
        }],
        turnComplete: true,
      });

      this.transcriptBuffer.push(`[User]: ${text}`);
    } catch (error) {
      console.error('[GeminiBridge] Error sending text:', error);
      this.emit('error', error);
    }
  }

  async playGreeting(): Promise<void> {
    if (!this.context?.greeting) return;

    await this.sendText(this.context.greeting);
  }

  async interrupt(): Promise<void> {
    if (!this.session || this.state !== 'active') return;

    try {
      console.log('[GeminiBridge] Interrupting current response');
      this.emit('interrupted');
    } catch (error) {
      console.error('[GeminiBridge] Error interrupting:', error);
    }
  }

  async close(): Promise<void> {
    if (this.state === 'closed' || this.state === 'closing') return;

    this.state = 'closing';
    console.log('[GeminiBridge] Closing session...');

    if (this.session) {
      try {
        await this.session.close();
      } catch (error) {
        console.error('[GeminiBridge] Error closing session:', error);
      }
      this.session = null;
    }

    this.state = 'closed';
    this.emit('close');
  }

  getTranscript(): string[] {
    return [...this.transcriptBuffer];
  }

  getState(): SessionState {
    return this.state;
  }

  isActive(): boolean {
    return this.state === 'active';
  }

  clearBuffers(): void {
    this.audioBuffer = [];
    this.transcriptBuffer = [];
  }
}

export function createGeminiBridge(config?: Partial<GeminiBridgeConfig>): VoiceGeminiBridge {
  return new VoiceGeminiBridge(config);
}
