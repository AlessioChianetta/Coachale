// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 🎯 STEP ADVANCEMENT AGENT
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Analizza semanticamente la conversazione di vendita in tempo reale
// e decide quando avanzare allo step/fase successiva.
// 
// Sostituisce il vecchio CheckpointDetector basato su keyword matching
// con un'analisi AI intelligente che capisce il contesto.
// 
// Usa Vertex AI con le credenziali del consultant (come gli altri servizi)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import { getAIProvider, GeminiClient } from "./provider-factory";

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TYPES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export interface StepAdvancementResult {
  shouldAdvance: boolean;
  nextPhaseId: string | null;
  nextStepId: string | null;
  reasoning: string;
  confidence: number; // 0-1
  // 🆕 FEEDBACK INJECTION: messaggio correttivo per l'agente primario
  feedbackForAgent?: {
    shouldInject: boolean;           // true se c'è un problema da correggere
    correctionMessage: string;       // messaggio di correzione per l'agente
    toneReminder?: string;           // reminder sulla tonalità della fase
    priority: 'low' | 'medium' | 'high'; // urgenza del feedback
  };
}

// Energy settings per il tone reminder
export interface PhaseEnergy {
  level: 'BASSO' | 'MEDIO' | 'ALTO';
  tone: 'CALMO' | 'SICURO' | 'CONFIDENZIALE' | 'ENTUSIASTA';
  pace: 'LENTO' | 'MODERATO' | 'VELOCE';
}

export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: string;
}

export interface ScriptStep {
  id: string;
  number: number;
  name: string;
  objective: string;
  questions: Array<{ text: string }>;
}

export interface ScriptPhase {
  id: string;
  number: string;
  name: string;
  description?: string;
  steps: ScriptStep[];
}

export interface ScriptStructureForAgent {
  phases: ScriptPhase[];
}

export interface StepAdvancementParams {
  recentMessages: ConversationMessage[];
  script: ScriptStructureForAgent;
  currentPhaseId: string;
  currentStepId: string | undefined;
  currentPhaseIndex: number;
  currentStepIndex: number;
  clientId: string;
  consultantId: string;
  // 🆕 Energy settings della fase corrente per tone reminder
  currentPhaseEnergy?: PhaseEnergy;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// STEP ADVANCEMENT AGENT
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export class StepAdvancementAgent {
  private static readonly MODEL = "gemini-2.5-flash";
  private static readonly TIMEOUT_MS = 5000; // 5 secondi max
  
  /**
   * Analizza la conversazione e decide se avanzare allo step/fase successiva
   * Usa Vertex AI con le credenziali del consultant (come getAIProvider)
   */
  static async analyze(params: StepAdvancementParams): Promise<StepAdvancementResult> {
    const startTime = Date.now();
    
    console.log(`\n🤖 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`🤖 [STEP-AGENT] Starting analysis`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`   📍 Current: ${params.currentPhaseId} / ${params.currentStepId || 'N/A'}`);
    console.log(`   💬 Recent messages: ${params.recentMessages.length}`);
    console.log(`   🔑 Using clientId: ${params.clientId?.substring(0, 8)}...`);
    
    try {
      // Ottieni il client AI usando il sistema a 3 livelli (Vertex client -> Vertex admin -> Google AI Studio)
      console.log(`   📡 Getting AI provider...`);
      const providerStart = Date.now();
      const { client: aiClient, cleanup } = await getAIProvider(params.clientId, params.consultantId);
      console.log(`   ✅ AI provider obtained in ${Date.now() - providerStart}ms`);
      
      try {
        // Costruisci il prompt
        const prompt = this.buildPrompt(params);
        console.log(`   📝 Prompt length: ${prompt.length} chars`);
        
        // Log recent messages being analyzed
        console.log(`   💬 Recent messages being analyzed:`);
        params.recentMessages.slice(-4).forEach((msg, i) => {
          const role = msg.role === 'user' ? 'PROSPECT' : 'AGENTE';
          console.log(`      ${i + 1}. [${role}] "${msg.content.substring(0, 80)}${msg.content.length > 80 ? '...' : ''}"`);
        });
        
        // Chiama Gemini con timeout
        console.log(`   🚀 Calling Gemini ${this.MODEL}...`);
        const geminiStart = Date.now();
        const response = await Promise.race([
          aiClient.generateContent({
            model: this.MODEL,
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0, // Deterministico
              maxOutputTokens: 500,
            }
          }),
          this.timeout(this.TIMEOUT_MS)
        ]);
        console.log(`   ⏱️ Gemini responded in ${Date.now() - geminiStart}ms`);
        
        if (!response || typeof response === 'string') {
          console.warn('⚠️ [STEP-AGENT] Timeout or invalid response');
          console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
          return this.createDefaultResult('Timeout');
        }
        
        // Estrai il testo dalla risposta
        let responseText = '';
        try {
          responseText = response.response.text();
          console.log(`   📄 Raw response (first 300 chars): "${responseText.substring(0, 300)}${responseText.length > 300 ? '...' : ''}"`);
        } catch (extractError: any) {
          console.warn(`⚠️ [STEP-AGENT] Failed to extract text: ${extractError.message}`);
          console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
          return this.createDefaultResult('Failed to extract response text');
        }
        
        // Parse la risposta JSON
        console.log(`   🔍 Parsing JSON response...`);
        const result = this.parseResponse(responseText, params);
        
        const elapsed = Date.now() - startTime;
        console.log(`\n🎯 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        console.log(`🎯 [STEP-AGENT] Analysis completed in ${elapsed}ms`);
        console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        console.log(`   → shouldAdvance: ${result.shouldAdvance}`);
        console.log(`   → nextPhase: ${result.nextPhaseId || 'same'}`);
        console.log(`   → nextStep: ${result.nextStepId || 'same'}`);
        console.log(`   → confidence: ${(result.confidence * 100).toFixed(0)}%`);
        console.log(`   → reasoning: ${result.reasoning}`);
        console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
        
        return result;
        
      } finally {
        // Cleanup risorse del provider
        if (cleanup) {
          await cleanup();
        }
      }
      
    } catch (error: any) {
      const elapsed = Date.now() - startTime;
      console.error(`❌ [STEP-AGENT] Error after ${elapsed}ms:`, error.message);
      return this.createDefaultResult(`Error: ${error.message}`);
    }
  }
  
  /**
   * Costruisce il prompt per l'analisi
   */
  private static buildPrompt(params: StepAdvancementParams): string {
    const { recentMessages, script, currentPhaseId, currentStepId, currentPhaseIndex, currentStepIndex, currentPhaseEnergy } = params;
    
    // Trova fase e step correnti
    const currentPhase = script.phases.find(p => p.id === currentPhaseId);
    const currentStep = currentPhase?.steps.find(s => s.id === currentStepId);
    
    // Trova step/fase successivi
    const { nextPhase, nextStep, isLastStepOfPhase, isLastPhase } = this.getNextPosition(
      script, currentPhaseId, currentStepId, currentPhaseIndex, currentStepIndex
    );
    
    // Formatta i messaggi recenti (ultimi 6)
    const messagesText = recentMessages
      .slice(-6)
      .map(m => `${m.role === 'user' ? 'PROSPECT' : 'AGENTE'}: ${m.content}`)
      .join('\n');
    
    // Estrai l'obiettivo dello step corrente
    const currentObjective = currentStep?.objective || 'Non specificato';
    const currentQuestions = currentStep?.questions?.map(q => q.text).join('\n- ') || 'Nessuna';
    
    // 🆕 Tonalità della fase corrente
    const toneInfo = currentPhaseEnergy 
      ? `\n🔊 TONALITÀ FASE CORRENTE:\n- Energia: ${currentPhaseEnergy.level}\n- Tono: ${currentPhaseEnergy.tone}\n- Ritmo: ${currentPhaseEnergy.pace}`
      : '';
    
    return `Sei un analizzatore esperto di conversazioni di vendita E un coach per l'agente.

═══════════════════════════════════════════════════════════════
📍 POSIZIONE ATTUALE NELLO SCRIPT
═══════════════════════════════════════════════════════════════
FASE CORRENTE: ${currentPhase?.name || currentPhaseId} (${currentPhaseId})
STEP CORRENTE: ${currentStep?.name || 'N/A'} (${currentStepId || 'N/A'})
OBIETTIVO DELLO STEP: ${currentObjective}
DOMANDE DA FARE IN QUESTO STEP:
- ${currentQuestions}
${toneInfo}

═══════════════════════════════════════════════════════════════
📍 POSIZIONE SUCCESSIVA (se avanziamo)
═══════════════════════════════════════════════════════════════
${isLastPhase && isLastStepOfPhase ? '⚠️ ULTIMO STEP DELL\'ULTIMA FASE - non si può più avanzare' : 
  isLastStepOfPhase ? 
    `PROSSIMA FASE: ${nextPhase?.name} (${nextPhase?.id})\nPROSSIMO STEP: ${nextStep?.name} (${nextStep?.id})` :
    `STESSA FASE: ${currentPhase?.name}\nPROSSIMO STEP: ${nextStep?.name} (${nextStep?.id})`
}

═══════════════════════════════════════════════════════════════
💬 ULTIMI MESSAGGI DELLA CONVERSAZIONE
═══════════════════════════════════════════════════════════════
${messagesText}

═══════════════════════════════════════════════════════════════
🎯 IL TUO COMPITO
═══════════════════════════════════════════════════════════════
Analizza la conversazione e rispondi a questa domanda:

"L'obiettivo dello step corrente è stato COMPLETATO?"

Per decidere, considera:
1. L'agente ha fatto la domanda o le domande previste per questo step?
2. Il prospect ha risposto in modo che permette di andare avanti?
3. L'obiettivo dello step è stato raggiunto?

⚠️ REGOLA CRITICA - DOMANDE MULTIPLE IN UNA FRASE:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
L'agente potrebbe fare PIÙ DOMANDE o coprire PIÙ STEP in una singola frase!

ESEMPIO: "Ciao Luigi! Benvenuto alla nostra consulenza. Come stai? E dimmi, da dove mi chiami?"
→ Questa frase copre STEP 1 (benvenuto) + STEP 2 (come stai) + STEP 3 (da dove chiami)
→ Se il prospect risponde, TUTTI e 3 gli step sono completati!

COME VALUTARE:
1. Conta TUTTE le domande/azioni fatte dall'agente nella frase
2. Verifica che il prospect abbia risposto a ciascuna
3. Se ha risposto a tutto → l'agente è già avanti di N step
4. shouldAdvance = true verso lo step SUCCESSIVO a quelli coperti

NON dire "l'agente non sta seguendo lo script" se ha fatto TUTTO insieme!
Se l'agente ha combinato step 1+2+3 in una frase e il prospect ha risposto,
l'obiettivo è COMPLETATO e si deve avanzare allo step 4.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

IMPORTANTE:
- NON avanzare troppo presto. Meglio rimanere uno step in più che saltare.
- Se il prospect ha risposto brevemente (es. "ok", "sì", "va bene") dopo che l'agente ha fatto la domanda, probabilmente si può avanzare.
- Se l'agente sta ancora esplorando o il prospect non ha risposto alla domanda, NON avanzare.
- Se siamo all'ultimo step dell'ultima fase, NON si può avanzare.
- CONTA le domande fatte dall'agente in ogni messaggio - potrebbero coprire più step!

⛔ REGOLA FONDAMENTALE - MAI ASSUMERE RISPOSTE DEL PROSPECT:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DEVI vedere ESPLICITAMENTE un messaggio "PROSPECT: ..." nella conversazione.

❌ VIETATO DIRE: "assumiamo che il prospect abbia risposto"
❌ VIETATO DIRE: "anche se non lo vediamo, il prospect deve aver risposto"
❌ VIETATO ASSUMERE risposte che non sono presenti nei messaggi

✅ Se vedi SOLO messaggi AGENTE → shouldAdvance = FALSE
✅ Devi vedere ALMENO UN messaggio PROSPECT dopo la domanda dell'agente
✅ Se non c'è risposta del prospect → "NON avanzare - manca risposta del prospect"

ESEMPIO DI ERRORE DA EVITARE:
Messaggi: [AGENTE] "Ciao! Come stai?" [AGENTE] "Benvenuto!" [AGENTE] "Da dove chiami?"
→ Qui ci sono SOLO messaggi AGENTE = il prospect NON ha parlato = NON AVANZARE!

ESEMPIO CORRETTO:
Messaggi: [AGENTE] "Ciao! Come stai?" [PROSPECT] "Bene grazie" [AGENTE] "Perfetto!"
→ Qui c'è un messaggio PROSPECT = il prospect HA risposto = puoi valutare se avanzare
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

═══════════════════════════════════════════════════════════════
🔧 FEEDBACK INJECTION (COACHING PER L'AGENTE)
═══════════════════════════════════════════════════════════════
Se rilevi PROBLEMI nel comportamento dell'agente, genera un feedback correttivo:

PROBLEMI DA RILEVARE:
1. L'agente NON risponde alle domande del prospect prima di continuare lo script
2. L'agente ha un tono sbagliato per la fase (es. troppo freddo in fase empatica)
3. L'agente salta step senza completare l'obiettivo
4. L'agente fa troppe domande insieme senza aspettare risposta
5. L'agente ignora segnali importanti del prospect

SE RILEVI UN PROBLEMA → genera feedbackForAgent con:
- shouldInject: true
- correctionMessage: messaggio breve e diretto per correggere l'agente
- toneReminder: ricorda la tonalità corretta (es. "Ricorda: tono ${currentPhaseEnergy?.tone || 'SICURO'}, energia ${currentPhaseEnergy?.level || 'MEDIA'}")
- priority: "high" se grave, "medium" se importante, "low" se suggerimento

SE TUTTO OK → feedbackForAgent.shouldInject = false

═══════════════════════════════════════════════════════════════
📤 FORMATO RISPOSTA (JSON VALIDO)
═══════════════════════════════════════════════════════════════
REGOLE DI OUTPUT STRETTE:
- Rispondi ESCLUSIVAMENTE con un oggetto JSON valido
- NON aggiungere testo, spiegazioni, o markdown prima o dopo il JSON
- NON usare \`\`\`json o altri code blocks
- Il JSON deve essere parsabile direttamente con JSON.parse()

Schema JSON richiesto:
{
  "shouldAdvance": boolean,
  "nextPhaseId": string | null,
  "nextStepId": string | null,
  "reasoning": string,
  "confidence": number,
  "feedbackForAgent": {
    "shouldInject": boolean,
    "correctionMessage": string,
    "toneReminder": string,
    "priority": "low" | "medium" | "high"
  }
}

Esempio se si deve avanzare (tutto ok):
{"shouldAdvance":true,"nextPhaseId":"${nextPhase?.id || 'phase_1'}","nextStepId":"${nextStep?.id || 'step_1'}","reasoning":"Obiettivo completato","confidence":0.8,"feedbackForAgent":{"shouldInject":false,"correctionMessage":"","toneReminder":"","priority":"low"}}

Esempio se NON avanzare + feedback correttivo:
{"shouldAdvance":false,"nextPhaseId":null,"nextStepId":null,"reasoning":"Agente non risponde alla domanda del prospect","confidence":0.9,"feedbackForAgent":{"shouldInject":true,"correctionMessage":"STOP! Il prospect ha fatto una domanda. Rispondi PRIMA di continuare lo script.","toneReminder":"Ricorda: tono EMPATICO, energia MEDIA","priority":"high"}}`;
  }
  
  /**
   * Trova lo step/fase successivi
   */
  private static getNextPosition(
    script: ScriptStructureForAgent,
    currentPhaseId: string,
    currentStepId: string | undefined,
    currentPhaseIndex: number,
    currentStepIndex: number
  ): {
    nextPhase: ScriptPhase | null;
    nextStep: ScriptStep | null;
    isLastStepOfPhase: boolean;
    isLastPhase: boolean;
  } {
    const currentPhase = script.phases[currentPhaseIndex];
    if (!currentPhase) {
      return { nextPhase: null, nextStep: null, isLastStepOfPhase: false, isLastPhase: false };
    }
    
    const isLastStepOfPhase = currentStepIndex >= currentPhase.steps.length - 1;
    const isLastPhase = currentPhaseIndex >= script.phases.length - 1;
    
    if (isLastStepOfPhase) {
      // Passa alla fase successiva
      if (isLastPhase) {
        return { nextPhase: null, nextStep: null, isLastStepOfPhase: true, isLastPhase: true };
      }
      const nextPhase = script.phases[currentPhaseIndex + 1];
      const nextStep = nextPhase?.steps[0] || null;
      return { nextPhase, nextStep, isLastStepOfPhase: true, isLastPhase: false };
    } else {
      // Passa allo step successivo nella stessa fase
      const nextStep = currentPhase.steps[currentStepIndex + 1];
      return { nextPhase: currentPhase, nextStep, isLastStepOfPhase: false, isLastPhase: false };
    }
  }
  
  /**
   * Parse la risposta JSON da Gemini
   */
  private static parseResponse(responseText: string, params: StepAdvancementParams): StepAdvancementResult {
    try {
      // Pulisci la risposta (rimuovi markdown code blocks se presenti)
      let cleanText = responseText.trim();
      if (cleanText.startsWith('```json')) {
        cleanText = cleanText.slice(7);
      }
      if (cleanText.startsWith('```')) {
        cleanText = cleanText.slice(3);
      }
      if (cleanText.endsWith('```')) {
        cleanText = cleanText.slice(0, -3);
      }
      cleanText = cleanText.trim();
      
      const parsed = JSON.parse(cleanText);
      
      // 🆕 Estrai feedbackForAgent se presente
      let feedbackForAgent: StepAdvancementResult['feedbackForAgent'] = undefined;
      if (parsed.feedbackForAgent && parsed.feedbackForAgent.shouldInject) {
        feedbackForAgent = {
          shouldInject: true,
          correctionMessage: String(parsed.feedbackForAgent.correctionMessage || ''),
          toneReminder: String(parsed.feedbackForAgent.toneReminder || ''),
          priority: (['low', 'medium', 'high'].includes(parsed.feedbackForAgent.priority) 
            ? parsed.feedbackForAgent.priority 
            : 'medium') as 'low' | 'medium' | 'high'
        };
        
        console.log(`\n🔧 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        console.log(`🔧 [STEP-AGENT] FEEDBACK FOR AGENT DETECTED!`);
        console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        console.log(`   📢 Priority: ${feedbackForAgent.priority.toUpperCase()}`);
        console.log(`   📝 Correction: ${feedbackForAgent.correctionMessage}`);
        console.log(`   🎵 Tone Reminder: ${feedbackForAgent.toneReminder}`);
        console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
      }
      
      // Valida e normalizza la risposta
      return {
        shouldAdvance: Boolean(parsed.shouldAdvance),
        nextPhaseId: parsed.shouldAdvance ? (parsed.nextPhaseId || null) : null,
        nextStepId: parsed.shouldAdvance ? (parsed.nextStepId || null) : null,
        reasoning: String(parsed.reasoning || 'No reasoning provided'),
        confidence: Math.min(1, Math.max(0, Number(parsed.confidence) || 0.5)),
        feedbackForAgent
      };
      
    } catch (error) {
      console.warn('⚠️ [STEP-AGENT] Failed to parse response:', responseText.substring(0, 200));
      return this.createDefaultResult('Failed to parse response');
    }
  }
  
  /**
   * Crea un risultato di default (non avanzare)
   */
  private static createDefaultResult(reasoning: string): StepAdvancementResult {
    return {
      shouldAdvance: false,
      nextPhaseId: null,
      nextStepId: null,
      reasoning,
      confidence: 0,
      feedbackForAgent: undefined
    };
  }
  
  /**
   * Promise che si risolve dopo un timeout
   */
  private static timeout(ms: number): Promise<string> {
    return new Promise((resolve) => {
      setTimeout(() => resolve('timeout'), ms);
    });
  }
}
