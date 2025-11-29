import WebSocket from 'ws';
import type { ProspectPersona } from '@shared/prospect-personas';
import { getAIProvider, type GeminiClient } from '../../ai/provider-factory';

type ResponseSpeed = 'fast' | 'normal' | 'slow' | 'disabled';

interface SalesAgentConfig {
  businessName: string;
  businessDescription?: string | null;
  displayName: string;
  consultantBio?: string | null;
  vision?: string | null;
  mission?: string | null;
  values?: string[];
  usp?: string | null;
  targetClient?: string | null;
  nonTargetClient?: string | null;
  whatWeDo?: string | null;
  howWeDoIt?: string | null;
  servicesOffered?: Array<{name: string; description: string; price: string}>;
  guarantees?: string | null;
  yearsExperience?: number;
  clientsHelped?: number;
  resultsGenerated?: string | null;
}

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
  agentConfig: SalesAgentConfig;
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
  responseSpeed?: ResponseSpeed;
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
  
  private isAgentSpeaking = false;
  private lastFragmentTime = 0;
  private fragmentCount = 0;
  private isProcessingResponse = false;
  private lastProcessedMessageHash = '';
  private lastProcessedTime = 0;
  
  private static readonly MESSAGE_COMPLETION_TIMEOUT = 3500;
  private static readonly MIN_SILENCE_GAP = 2000;
  private static readonly MIN_FRAGMENTS_FOR_COMPLETE = 1;
  private static readonly DEDUP_WINDOW_MS = 5000;

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
          this.handleAgentFragment(message.text, 'ai_transcript');
        }
        break;

      case 'user_transcript':
        break;

      case 'transcript':
        if (message.text) {
          const isFinal = message.isFinal !== false;
          
          if (message.role === 'model' || message.speaker === 'ai' || message.source === 'ai') {
            if (isFinal) {
              this.handleAgentFragment(message.text, 'transcript');
            }
          }
        }
        break;

      case 'ai_response':
        if (message.text || message.content) {
          const agentText = message.text || message.content;
          
          if (this.responseBuffer.length > 0) {
            console.log(`⏸️ [PROSPECT SIMULATOR] Ignoring ai_response - fragments already buffered (${this.responseBuffer.length} fragments)`);
            break;
          }
          
          if (this.isProcessingResponse) {
            console.log(`⏸️ [PROSPECT SIMULATOR] Ignoring ai_response - already processing`);
            break;
          }
          
          const messageHash = agentText.substring(0, 100);
          const now = Date.now();
          if (this.lastProcessedMessageHash === messageHash && 
              (now - this.lastProcessedTime) < ProspectSimulator.DEDUP_WINDOW_MS) {
            console.log(`⏸️ [PROSPECT SIMULATOR] Ignoring duplicate ai_response within ${ProspectSimulator.DEDUP_WINDOW_MS}ms window`);
            break;
          }
          
          this.lastProcessedMessageHash = messageHash;
          this.lastProcessedTime = now;
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

  private handleAgentFragment(text: string, source: string): void {
    if (this.isProcessingResponse) {
      console.log(`⏸️ [PROSPECT SIMULATOR] Ignoring fragment while processing response`);
      return;
    }
    
    const now = Date.now();
    this.isAgentSpeaking = true;
    this.lastFragmentTime = now;
    this.fragmentCount++;
    this.pendingAgentResponse = true;
    
    this.responseBuffer.push(text);
    
    console.log(`📝 [PROSPECT SIMULATOR] Fragment #${this.fragmentCount} from ${source}: "${text.substring(0, 60)}${text.length > 60 ? '...' : ''}"`);
    
    if (this.responseTimeout) {
      clearTimeout(this.responseTimeout);
    }
    
    this.scheduleMessageCompletion();
  }

  private scheduleMessageCompletion(): void {
    this.responseTimeout = setTimeout(async () => {
      const silenceGap = Date.now() - this.lastFragmentTime;
      
      if (silenceGap < ProspectSimulator.MIN_SILENCE_GAP) {
        console.log(`⏳ [PROSPECT SIMULATOR] Silence gap too short (${silenceGap}ms < ${ProspectSimulator.MIN_SILENCE_GAP}ms), rescheduling...`);
        this.scheduleMessageCompletion();
        return;
      }
      
      if (this.fragmentCount < ProspectSimulator.MIN_FRAGMENTS_FOR_COMPLETE) {
        console.log(`⏳ [PROSPECT SIMULATOR] Not enough fragments (${this.fragmentCount} < ${ProspectSimulator.MIN_FRAGMENTS_FOR_COMPLETE}), rescheduling...`);
        this.scheduleMessageCompletion();
        return;
      }
      
      if (this.responseBuffer.length > 0 && this.pendingAgentResponse && !this.isProcessingResponse) {
        this.isProcessingResponse = true;
        this.isAgentSpeaking = false;
        
        const fullResponse = this.responseBuffer.join(' ').trim();
        
        const cleanedResponse = fullResponse
          .replace(/\s+/g, ' ')
          .replace(/(\w)\s*\.\s*(\w)/g, '$1. $2')
          .trim();
        
        this.responseBuffer = [];
        this.pendingAgentResponse = false;
        this.fragmentCount = 0;
        
        const messageHash = cleanedResponse.substring(0, 100);
        this.lastProcessedMessageHash = messageHash;
        this.lastProcessedTime = Date.now();
        
        console.log(`🎯 [PROSPECT SIMULATOR] Message complete after ${silenceGap}ms silence (${cleanedResponse.length} chars)`);
        
        try {
          await this.handleAgentMessage(cleanedResponse);
        } finally {
          this.isProcessingResponse = false;
        }
      }
    }, ProspectSimulator.MESSAGE_COMPLETION_TIMEOUT);
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

  private getResponseDelay(): number {
    const speed = this.options.responseSpeed || 'normal';
    switch (speed) {
      case 'fast':
        return 800 + Math.random() * 400;
      case 'normal':
        return 1500 + Math.random() * 1500;
      case 'slow':
        return 4000 + Math.random() * 2000;
      case 'disabled':
        return -1;
      default:
        return 1500 + Math.random() * 1500;
    }
  }

  private async generateAndSendResponse(agentMessage: string): Promise<void> {
    this.currentTurn++;
    
    if (this.currentTurn >= this.maxTurns) {
      console.log(`🏁 [PROSPECT SIMULATOR] Max turns reached (${this.maxTurns}), completing session`);
      await this.completeSession();
      return;
    }

    const delay = this.getResponseDelay();
    
    if (delay < 0) {
      console.log(`⏸️ [PROSPECT SIMULATOR] Response disabled - waiting for manual trigger`);
      this.pendingAgentResponse = true;
      return;
    }

    try {
      console.log(`⏱️ [PROSPECT SIMULATOR] Waiting ${Math.round(delay)}ms before responding (speed: ${this.options.responseSpeed || 'normal'})`);
      await new Promise(resolve => setTimeout(resolve, delay));

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
    const config = this.options.agentConfig;
    
    const servicesText = config.servicesOffered && config.servicesOffered.length > 0
      ? config.servicesOffered.map(s => `- ${s.name}: ${s.description}`).join('\n')
      : 'Non specificati';
    
    const targetDescription = config.targetClient || 'imprenditori e professionisti';
    const businessPurpose = config.whatWeDo || config.businessDescription || 'aiutare i clienti a raggiungere i loro obiettivi';
    
    return `Sei un prospect in una conversazione con un sales agent. ${persona.systemPrompt}

═══════════════════════════════════════════════════════
📋 CHI SEI TU (IL PROSPECT)
═══════════════════════════════════════════════════════
- Nome: ${this.options.prospectData.name}
- Email: ${this.options.prospectData.email}
- Personalità: ${persona.name} - ${persona.description}

🎯 IMPORTANTE - TU SEI PARTE DEL TARGET DEL SALES AGENT:
Tu fai parte di: "${targetDescription}"
Hai problemi che ${config.businessName} può risolvere.
Il tuo ruolo è testare la capacità del Sales Agent di qualificarti e guidarti.

═══════════════════════════════════════════════════════
🏢 CHI È IL SALES AGENT CHE TI STA PARLANDO
═══════════════════════════════════════════════════════
- Rappresenta: ${config.businessName}
- Nome agente: ${config.displayName}
- Cosa fa l'azienda: ${businessPurpose}
- Chi aiutano: ${targetDescription}
${config.nonTargetClient ? `- Chi NON aiutano: ${config.nonTargetClient}` : ''}
${config.mission ? `- Mission: ${config.mission}` : ''}
${config.usp ? `- USP: ${config.usp}` : ''}

📦 SERVIZI OFFERTI:
${servicesText}

${config.yearsExperience ? `⏳ Anni di esperienza: ${config.yearsExperience}` : ''}
${config.clientsHelped ? `👥 Clienti aiutati: ${config.clientsHelped}` : ''}
${config.resultsGenerated ? `📈 Risultati generati: ${config.resultsGenerated}` : ''}

═══════════════════════════════════════════════════════
🎭 COME DEVI COMPORTARTI
═══════════════════════════════════════════════════════
1. SEI UN PROSPECT REALISTICO che rientra nel target "${targetDescription}"
2. Hai problemi PERTINENTI a quello che ${config.businessName} risolve
3. Mantieni la personalità "${persona.name}" per tutta la conversazione
4. Stile comunicativo: ${persona.communicationStyle}
5. Il tuo obiettivo: ${persona.goal}

═══════════════════════════════════════════════════════
💬 OBIEZIONI CONTESTUALI DA USARE
═══════════════════════════════════════════════════════
Quando sollevi obiezioni, ADATTALE al contesto di ${config.businessName}.
Le tue obiezioni tipiche sono: ${persona.typicalObjections.join(', ')}

Ma devi RIFORMULARLE in modo pertinente. Esempi:
- Se l'azienda fa coaching → chiedi "Come faccio a sapere che funzionerà per la mia situazione?"
- Se l'azienda fa consulenza → chiedi "Qual è il ROI concreto che posso aspettarmi?"
- Se l'azienda fa servizi → chiedi "Quanto tempo ci vuole per vedere risultati?"

I TUOI PROBLEMI devono essere coerenti con "${targetDescription}":
- Se sei un imprenditore → problemi di tempo, team, crescita, processi
- Se sei un professionista → problemi di clienti, posizionamento, fatturato
- Se sei un manager → problemi di produttività, obiettivi, leadership

📏 REGOLE RIGIDE:
- Rispondi SOLO come il prospect, MAI come l'agente o con meta-commenti
- Rispondi sempre in italiano
- Sii realistico - non troppo facile né troppo difficile
- Le risposte devono essere naturali, come in una vera telefonata
- MASSIMO 2-3 frasi per risposta
- I tuoi problemi e desideri devono essere COERENTI con il target del Sales Agent
- NON rispondere MAI a messaggi parziali o incompleti dell'agente`;
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
