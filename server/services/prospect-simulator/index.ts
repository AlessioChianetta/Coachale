import WebSocket from 'ws';
import type { ProspectPersona } from '@shared/prospect-personas';
import { getAIProvider, type GeminiClient } from '../../ai/provider-factory';

interface ProspectSimulatorOptions {
  sessionId: string;
  agentId: string;
  clientId: string;
  consultantId: string;
  agent: {
    id: string;
    agentName: string;
    shareToken: string;
    clientId: string;
  };
  script: {
    id: string;
    name: string;
    scriptType: string;
  };
  persona: ProspectPersona;
  prospectData: {
    name: string;
    email: string;
  };
  onStatusUpdate: (status: StatusUpdate) => Promise<void>;
  onSessionEnd?: () => Promise<void>;
}

interface StatusUpdate {
  status: 'running' | 'completed' | 'stopped';
  currentPhase?: string;
  completionRate?: number;
  ladderActivations?: number;
  messageCount?: number;
  lastMessage?: string;
  conversationId?: string;
}

interface TranscriptMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export class ProspectSimulator {
  private options: ProspectSimulatorOptions;
  private ws: WebSocket | null = null;
  private aiClient: GeminiClient | null = null;
  private aiCleanup?: () => Promise<void>;
  private transcript: TranscriptMessage[] = [];
  private isRunning = false;
  private messageCount = 0;
  private currentPhase = 'starting';
  private completionRate = 0;
  private ladderActivations = 0;
  private conversationHistory: { role: 'user' | 'model'; parts: { text: string }[] }[] = [];
  private maxTurns = 30;
  private currentTurn = 0;
  private sessionToken: string | null = null;
  private conversationId: string | null = null;
  private pendingAgentResponse = false;
  private responseBuffer: string[] = [];
  private responseTimeout: NodeJS.Timeout | null = null;

  constructor(options: ProspectSimulatorOptions) {
    this.options = options;
  }

  async start(): Promise<void> {
    console.log(`\n🤖 [PROSPECT SIMULATOR] Starting session ${this.options.sessionId}`);
    console.log(`   Persona: ${this.options.persona.emoji} ${this.options.persona.name}`);
    console.log(`   Prospect: ${this.options.prospectData.name}`);
    console.log(`   ShareToken: ${this.options.agent.shareToken}`);
    console.log(`   ClientId: ${this.options.clientId}`);
    console.log(`   ConsultantId: ${this.options.consultantId}`);
    
    this.isRunning = true;

    try {
      const providerResult = await getAIProvider(this.options.clientId, this.options.consultantId);
      this.aiClient = providerResult.client;
      this.aiCleanup = providerResult.cleanup;
      
      console.log(`✅ [PROSPECT SIMULATOR] AI Provider initialized: ${providerResult.metadata.name} (source: ${providerResult.source})`);

      await this.createSalesSession();
      await this.connectToWebSocket();

    } catch (error) {
      console.error(`❌ [PROSPECT SIMULATOR] Failed to start:`, error);
      this.isRunning = false;
      await this.options.onStatusUpdate({
        status: 'stopped',
        currentPhase: 'error',
        messageCount: this.messageCount,
      });
      throw error;
    }
  }

  private async createSalesSession(): Promise<void> {
    const shareToken = this.options.agent.shareToken;
    
    const baseUrl = process.env.REPLIT_DEV_DOMAIN 
      ? `https://${process.env.REPLIT_DEV_DOMAIN}`
      : 'http://localhost:5000';
    
    const url = `${baseUrl}/api/public/sales-agent/${shareToken}/session`;
    
    console.log(`📡 [PROSPECT SIMULATOR] Creating session via API: ${url}`);
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prospectName: this.options.prospectData.name,
        prospectEmail: this.options.prospectData.email,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to create session: ${response.status} ${error}`);
    }

    const data = await response.json();
    this.sessionToken = data.sessionToken;
    this.conversationId = data.conversationId;

    console.log(`✅ [PROSPECT SIMULATOR] Session created!`);
    console.log(`   ConversationId: ${this.conversationId}`);
    console.log(`   SessionToken: ${this.sessionToken?.substring(0, 20)}...`);

    await this.options.onStatusUpdate({
      status: 'running',
      conversationId: this.conversationId || undefined,
    });
  }

  private async connectToWebSocket(): Promise<void> {
    const wsUrl = this.buildWebSocketUrl();
    console.log(`🔌 [PROSPECT SIMULATOR] Connecting to WebSocket: ${wsUrl.substring(0, 80)}...`);
    
    this.ws = new WebSocket(wsUrl);

    this.ws.on('open', () => {
      console.log(`✅ [PROSPECT SIMULATOR] WebSocket connected!`);
      this.pendingAgentResponse = true;
    });

    this.ws.on('message', async (data) => {
      try {
        const message = JSON.parse(data.toString());
        await this.handleServerMessage(message);
      } catch (error) {
        console.error(`❌ [PROSPECT SIMULATOR] Error parsing message:`, error);
      }
    });

    this.ws.on('close', (code, reason) => {
      console.log(`🔌 [PROSPECT SIMULATOR] WebSocket closed: ${code} - ${reason}`);
      this.isRunning = false;
    });

    this.ws.on('error', (error) => {
      console.error(`❌ [PROSPECT SIMULATOR] WebSocket error:`, error);
    });
  }

  private buildWebSocketUrl(): string {
    const protocol = process.env.REPLIT_DEV_DOMAIN ? 'wss' : 'ws';
    const host = process.env.REPLIT_DEV_DOMAIN || 'localhost:5000';
    
    const params = new URLSearchParams({
      mode: 'sales_agent',
      sessionToken: this.sessionToken!,
      shareToken: this.options.agent.shareToken,
    });
    
    return `${protocol}://${host}/ws/ai-voice?${params.toString()}`;
  }

  private async handleServerMessage(message: any): Promise<void> {
    switch (message.type) {
      case 'connected':
      case 'session_ready':
        console.log(`✅ [PROSPECT SIMULATOR] Session ready, waiting for agent greeting...`);
        break;

      case 'audio':
      case 'audio_output':
        break;

      case 'ai_transcript':
        if (message.text) {
          console.log(`📝 [PROSPECT SIMULATOR] AI transcript received: "${message.text.substring(0, 60)}${message.text.length > 60 ? '...' : ''}"`);
          
          this.responseBuffer.push(message.text);
          this.pendingAgentResponse = true;
          
          if (this.responseTimeout) {
            clearTimeout(this.responseTimeout);
          }
          
          this.responseTimeout = setTimeout(async () => {
            if (this.responseBuffer.length > 0 && this.pendingAgentResponse) {
              const fullResponse = this.responseBuffer.join(' ');
              this.responseBuffer = [];
              this.pendingAgentResponse = false;
              console.log(`🎯 [PROSPECT SIMULATOR] Processing full AI message (${fullResponse.length} chars)`);
              await this.handleAgentMessage(fullResponse);
            }
          }, 2000);
        }
        break;

      case 'user_transcript':
        break;

      case 'transcript':
        if (message.text) {
          const isFinal = message.isFinal !== false;
          
          if (message.role === 'model' || message.speaker === 'ai' || message.source === 'ai') {
            if (isFinal) {
              this.responseBuffer.push(message.text);
              
              if (this.responseTimeout) {
                clearTimeout(this.responseTimeout);
              }
              
              this.responseTimeout = setTimeout(async () => {
                if (this.responseBuffer.length > 0 && this.pendingAgentResponse) {
                  const fullResponse = this.responseBuffer.join(' ');
                  this.responseBuffer = [];
                  this.pendingAgentResponse = false;
                  await this.handleAgentMessage(fullResponse);
                }
              }, 2000);
            }
          }
        }
        break;

      case 'ai_response':
        if (message.text || message.content) {
          const agentText = message.text || message.content;
          await this.handleAgentMessage(agentText);
        }
        break;

      case 'phase_change':
      case 'phase_update':
        this.currentPhase = message.phase || message.currentPhase || this.currentPhase;
        if (typeof message.completionRate === 'number') {
          this.completionRate = message.completionRate;
        }
        if (message.ladderActivation) {
          this.ladderActivations++;
        }
        console.log(`📊 [PROSPECT SIMULATOR] Phase update: ${this.currentPhase} (${Math.round(this.completionRate * 100)}%)`);
        await this.updateStatus();
        break;

      case 'conversation_end':
      case 'session_end':
        console.log(`🏁 [PROSPECT SIMULATOR] Conversation ended by agent`);
        await this.completeSession();
        break;

      case 'error':
        console.error(`❌ [PROSPECT SIMULATOR] Server error:`, message.message || message.error);
        break;

      default:
        break;
    }
  }

  private async handleAgentMessage(agentText: string): Promise<void> {
    console.log(`🤖 [SALES AGENT] "${agentText.substring(0, 100)}${agentText.length > 100 ? '...' : ''}"`);
    
    this.transcript.push({
      role: 'assistant',
      content: agentText,
      timestamp: new Date().toISOString(),
    });

    this.conversationHistory.push({
      role: 'model',
      parts: [{ text: agentText }]
    });

    if (this.isRunning) {
      await this.generateAndSendResponse(agentText);
    }
  }

  private async generateAndSendResponse(agentMessage: string): Promise<void> {
    this.currentTurn++;
    
    if (this.currentTurn >= this.maxTurns) {
      console.log(`🏁 [PROSPECT SIMULATOR] Max turns reached (${this.maxTurns}), completing session`);
      await this.completeSession();
      return;
    }

    try {
      await new Promise(resolve => setTimeout(resolve, 1500 + Math.random() * 1500));

      const systemPrompt = this.buildSystemPrompt();
      const conversationContext = this.conversationHistory
        .map(msg => `${msg.role === 'user' ? 'Prospect' : 'Sales Agent'}: ${msg.parts[0].text}`)
        .join('\n\n');

      const prompt = `${systemPrompt}

CONVERSAZIONE FINORA:
${conversationContext}

ULTIMA RISPOSTA DEL SALES AGENT:
"${agentMessage}"

Genera la tua risposta come prospect. Rispondi in modo naturale e coerente con la tua personalità.
Se ritieni che la conversazione possa concludersi naturalmente (hai ottenuto le informazioni, sei convinto, o vuoi terminare), puoi indicarlo con [FINE_CONVERSAZIONE] alla fine.
Rispondi in italiano, in modo colloquiale e naturale.

LA TUA RISPOSTA:`;

      const response = await this.aiClient!.generateContent({
        model: 'gemini-2.5-flash',
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
      });

      let prospectResponse = response.response.text() || '';
      
      const shouldEnd = prospectResponse.includes('[FINE_CONVERSAZIONE]');
      prospectResponse = prospectResponse.replace('[FINE_CONVERSAZIONE]', '').trim();

      if (prospectResponse) {
        await this.sendProspectMessage(prospectResponse);
      }

      if (shouldEnd) {
        console.log(`🏁 [PROSPECT SIMULATOR] Prospect ended conversation naturally`);
        await new Promise(resolve => setTimeout(resolve, 3000));
        await this.completeSession();
      } else {
        this.pendingAgentResponse = true;
      }

    } catch (error) {
      console.error(`❌ [PROSPECT SIMULATOR] Error generating response:`, error);
      await this.completeSession();
    }
  }

  private buildSystemPrompt(): string {
    const persona = this.options.persona;
    return `Sei un prospect in una conversazione con un sales agent. ${persona.systemPrompt}

CONTESTO:
- Ti chiami: ${this.options.prospectData.name}
- Email: ${this.options.prospectData.email}
- Stai parlando con "${this.options.agent.agentName}"
- Lo script di vendita è: ${this.options.script.name}

REGOLE:
1. Rispondi SOLO come il prospect, mai come l'agente o con meta-commenti
2. Mantieni la personalità "${persona.name}" per tutta la conversazione
3. Usa le obiezioni tipiche quando appropriato: ${persona.typicalObjections.join(', ')}
4. Stile comunicativo: ${persona.communicationStyle}
5. Il tuo obiettivo: ${persona.goal}
6. Rispondi sempre in italiano
7. Sii realistico - non troppo facile né troppo difficile
8. Le risposte devono essere naturali, come in una vera telefonata
9. Evita risposte troppo lunghe - massimo 2-3 frasi per volta`;
  }

  private async sendProspectMessage(text: string): Promise<void> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.error(`❌ [PROSPECT SIMULATOR] WebSocket not connected`);
      return;
    }

    console.log(`👤 [PROSPECT] "${text.substring(0, 100)}${text.length > 100 ? '...' : ''}"`);

    this.transcript.push({
      role: 'user',
      content: text,
      timestamp: new Date().toISOString(),
    });

    this.conversationHistory.push({
      role: 'user',
      parts: [{ text }]
    });

    this.messageCount++;

    const message = {
      type: 'text_input',
      text: text,
    };

    this.ws.send(JSON.stringify(message));
    await this.updateStatus();
  }

  private async updateStatus(): Promise<void> {
    await this.options.onStatusUpdate({
      status: 'running',
      currentPhase: this.currentPhase,
      completionRate: this.completionRate,
      ladderActivations: this.ladderActivations,
      messageCount: this.messageCount,
      lastMessage: this.transcript.length > 0 
        ? this.transcript[this.transcript.length - 1].content.substring(0, 100)
        : undefined,
      conversationId: this.conversationId || undefined,
    });
  }

  private async completeSession(): Promise<void> {
    this.isRunning = false;
    
    if (this.responseTimeout) {
      clearTimeout(this.responseTimeout);
      this.responseTimeout = null;
    }
    
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify({ type: 'end_session' }));
      } catch (e) {}
      this.ws.close();
    }

    if (this.aiCleanup) {
      try {
        await this.aiCleanup();
      } catch (e) {}
    }

    await this.options.onStatusUpdate({
      status: 'completed',
      currentPhase: this.currentPhase,
      completionRate: this.completionRate,
      ladderActivations: this.ladderActivations,
      messageCount: this.messageCount,
      lastMessage: this.transcript.length > 0 
        ? this.transcript[this.transcript.length - 1].content.substring(0, 100)
        : undefined,
      conversationId: this.conversationId || undefined,
    });

    if (this.options.onSessionEnd) {
      await this.options.onSessionEnd();
    }

    console.log(`\n✅ [PROSPECT SIMULATOR] Session completed`);
    console.log(`   ConversationId: ${this.conversationId}`);
    console.log(`   Messages: ${this.messageCount}`);
    console.log(`   Final Phase: ${this.currentPhase}`);
    console.log(`   Completion: ${Math.round(this.completionRate * 100)}%`);
    console.log(`   Ladder Activations: ${this.ladderActivations}`);
  }

  async stop(): Promise<void> {
    console.log(`🛑 [PROSPECT SIMULATOR] Stopping session ${this.options.sessionId}`);
    this.isRunning = false;
    
    if (this.responseTimeout) {
      clearTimeout(this.responseTimeout);
      this.responseTimeout = null;
    }
    
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify({ type: 'end_session' }));
      } catch (e) {}
      this.ws.close();
    }

    if (this.aiCleanup) {
      try {
        await this.aiCleanup();
      } catch (e) {}
    }

    await this.options.onStatusUpdate({
      status: 'stopped',
      currentPhase: this.currentPhase,
      completionRate: this.completionRate,
      ladderActivations: this.ladderActivations,
      messageCount: this.messageCount,
      conversationId: this.conversationId || undefined,
    });

    if (this.options.onSessionEnd) {
      await this.options.onSessionEnd();
    }
  }

  getTranscript(): TranscriptMessage[] {
    return [...this.transcript];
  }

  getConversationId(): string | null {
    return this.conversationId;
  }
}
