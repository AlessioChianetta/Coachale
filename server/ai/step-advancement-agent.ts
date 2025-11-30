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
// 🆕 CHECKPOINT SEMANTIC ANALYSIS TYPES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Risultato dell'analisi semantica di un checkpoint
 */
export interface CheckpointAnalysisResult {
  isComplete: boolean;
  completedItems: string[];
  missingItems: string[];
  reasoning: string;
  confidence: number; // 0-1
  canAdvance: boolean;
}

/**
 * Parametri per l'analisi semantica del checkpoint
 */
export interface CheckpointAnalysisParams {
  checkpoint: {
    id: string;
    title: string;
    checks: string[];
  };
  recentMessages: ConversationMessage[];
  clientId: string;
  consultantId: string;
  phaseName: string;
  phaseId: string;
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

⚠️ REGOLA FONDAMENTALE - VERIFICA DOMANDE OBBLIGATORIE:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
L'agente DEVE fare le DOMANDE previste per questo step (vedi "DOMANDE DA FARE IN QUESTO STEP").

PRIMA di dire shouldAdvance=true, VERIFICA:
1. L'agente ha fatto le domande elencate sopra? (anche in forma diversa ma stesso significato)
2. Il prospect ha risposto a CIASCUNA domanda in modo ESAUSTIVO? (non "ok", "sì", "va bene")
3. Le risposte contengono le INFORMAZIONI CONCRETE che il venditore cerca?
4. Se MANCANO domande O risposte insufficienti → shouldAdvance = FALSE + feedback correttivo

🚨 REGOLA CRITICA - IGNORA LE EMOZIONI PER L'AVANZAMENTO:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
L'EMOZIONE del prospect (entusiasmo, interesse, positività) NON È MAI un criterio valido per avanzare!

ESEMPI DI ERRORE DA EVITARE:
❌ "Il prospect è entusiasta, possiamo avanzare" → SBAGLIATO! L'entusiasmo non è una risposta
❌ "Il prospect mostra interesse, obiettivo raggiunto" → SBAGLIATO! L'interesse non è un'informazione
❌ "Il prospect sembra convinto, passiamo oltre" → SBAGLIATO! La convinzione non risponde alle domande

ESEMPI CORRETTI:
✅ "Il prospect ha risposto 'Milano' alla domanda 'da dove chiami?' - info raccolta, possiamo avanzare"
✅ "Il prospect ha spiegato il suo problema principale nel dettaglio - obiettivo raggiunto"
✅ "Il prospect ha detto il suo budget approssimativo - checkpoint completato"

SCENARIO TIPICO DA GESTIRE:
Domanda: "Qual è la sfida principale che stai affrontando?"
Risposta: "Wow, fantastico! Questa tecnica mi piace molto!"
→ Il prospect ha espresso ENTUSIASMO ma NON ha risposto alla domanda!
→ shouldAdvance = FALSE
→ Feedback: "Il prospect non ha risposto alla domanda. Riformula: 'Sono contento che ti piaccia! Ma tornando a te, qual è il problema principale che vuoi risolvere?'"

⛔ NON AVANZARE SE:
- L'agente ha saltato domande fondamentali dello step
- L'agente è passato avanti senza fare le domande previste
- Il prospect ha risposto con EMOZIONE ma SENZA INFORMAZIONI CONCRETE
- Il prospect ha risposto ma l'agente NON ha fatto TUTTE le domande

✅ AVANZA SOLO SE:
- L'agente ha fatto TUTTE le domande dello step corrente
- Il prospect ha dato una risposta ESAUSTIVA CON INFORMAZIONI CONCRETE (non emozioni!)
- La risposta contiene i DATI/FATTI che il venditore cerca (luoghi, numeri, problemi specifici, nomi)
- L'obiettivo dello step è stato raggiunto con INFORMAZIONI VERIFICABILI

🚦 CHECKPOINT DI FASE (CONTROLLO INTERNO):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Se lo step corrente è l'ULTIMO della fase, PRIMA di avanzare alla fase successiva
devi verificare INTERNAMENTE che tutti i checkpoint della fase siano stati completati.

I checkpoint sono elencati nello script (es. "⛔ CHECKPOINT FASE #1").
Scorri la conversazione e verifica che OGNI punto del checkpoint sia stato coperto.

SE UN CHECKPOINT NON È SODDISFATTO:
→ shouldAdvance = FALSE
→ Genera feedback NATURALE (NON dire "manca checkpoint"!)

ESEMPI DI FEEDBACK NATURALE:
❌ SBAGLIATO: "Manca checkpoint: non hai chiesto da dove chiama"
✅ GIUSTO: "Prima di proseguire, chiedi al prospect da dove ti sta chiamando"

❌ SBAGLIATO: "Checkpoint fase 2 incompleto"  
✅ GIUSTO: "Approfondisci il problema principale prima di passare alla soluzione"

❌ SBAGLIATO: "Non hai completato il checkpoint sul budget"
✅ GIUSTO: "Cerca di capire meglio la sua situazione economica prima di presentare il prezzo"
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚠️ RISPOSTA INSUFFICIENTE:
Se il prospect risponde troppo brevemente (es. "ok", "sì", "bene", "capito"):
→ shouldAdvance = FALSE
→ Feedback: "Il prospect ha risposto troppo brevemente. Approfondisci: [domanda di follow-up]"

ESEMPIO:
Domanda: "Qual è la sfida principale che stai affrontando?"
Risposta: "Eh, vari problemi" ← INSUFFICIENTE! Non sappiamo QUALE problema
→ L'agente deve approfondire: "Capisco, ma quale di questi problemi ti preoccupa di più?"

ESEMPIO DI BLOCCO:
Step richiede: "Da dove chiami?" + "Cosa ti ha spinto a prenotare?"
Agente dice: "Ciao! Come stai? Parliamo del nostro metodo..."
→ L'agente ha SALTATO le domande! → shouldAdvance = FALSE
→ Feedback: "STOP! Devi prima chiedere: 'Da dove chiami?' e 'Cosa ti ha spinto a prenotare?'"
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

IMPORTANTE:
- NON avanzare troppo presto. Meglio rimanere uno step in più che saltare.
- Se l'agente salta domande → genera SEMPRE feedback correttivo con le domande mancanti.
- Se siamo all'ultimo step dell'ultima fase, NON si può avanzare.
- Il reasoning deve essere SPECIFICO: quali domande fatte, quali mancano, perché avanzare o no.

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

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 🆕 CHECKPOINT SEMANTIC ANALYSIS
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Analizza semanticamente il completamento dei checkpoint
  // usando AI invece di keyword matching
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  /**
   * 🎯 ANALISI SEMANTICA AI DEL CHECKPOINT
   * 
   * Sostituisce il vecchio keyword matching con analisi AI che capisce
   * il SIGNIFICATO della conversazione, non solo le parole chiave.
   * 
   * Esempio:
   * - Check: "Hai chiesto da dove chiama?"
   * - Keyword matching: cerca "dove", "chiama", "chiami"
   * - AI semantica: capisce che "Da quale città mi contatti?" ha lo stesso significato
   */
  static async analyzeCheckpointCompletion(
    params: CheckpointAnalysisParams
  ): Promise<CheckpointAnalysisResult> {
    const startTime = Date.now();
    
    console.log(`\n🔍 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`🔍 [CHECKPOINT-AI] Starting semantic analysis`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`   📍 Phase: ${params.phaseName} (${params.phaseId})`);
    console.log(`   🎯 Checkpoint: ${params.checkpoint.title}`);
    console.log(`   ✅ Checks to verify: ${params.checkpoint.checks.length}`);
    console.log(`   💬 Messages to analyze: ${params.recentMessages.length}`);
    
    try {
      // Ottieni il client AI
      const { client: aiClient, cleanup } = await getAIProvider(params.clientId, params.consultantId);
      
      try {
        // Costruisci il prompt per l'analisi semantica
        const prompt = this.buildCheckpointPrompt(params);
        
        // Log dei check da verificare
        console.log(`   📋 Checks to verify:`);
        params.checkpoint.checks.forEach((check, i) => {
          console.log(`      ${i + 1}. ${check}`);
        });
        
        // Chiama Gemini con timeout
        const response = await Promise.race([
          aiClient.generateContent({
            model: this.MODEL,
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0, // Deterministico per coerenza
              maxOutputTokens: 800,
            }
          }),
          this.timeout(this.TIMEOUT_MS)
        ]);
        
        if (!response || typeof response === 'string') {
          console.warn('⚠️ [CHECKPOINT-AI] Timeout or invalid response');
          return this.createDefaultCheckpointResult(params.checkpoint.checks, 'Timeout');
        }
        
        // Estrai e parse la risposta
        const responseText = response.response.text();
        console.log(`   📄 AI Response (first 300 chars): "${responseText.substring(0, 300)}${responseText.length > 300 ? '...' : ''}"`);
        
        const result = this.parseCheckpointResponse(responseText, params.checkpoint.checks);
        
        const elapsed = Date.now() - startTime;
        console.log(`\n🎯 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        console.log(`🎯 [CHECKPOINT-AI] Analysis completed in ${elapsed}ms`);
        console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        console.log(`   ✅ Completed: ${result.completedItems.length}/${params.checkpoint.checks.length}`);
        console.log(`   ❌ Missing: ${result.missingItems.length}`);
        console.log(`   🚦 Can advance: ${result.canAdvance}`);
        console.log(`   📊 Confidence: ${(result.confidence * 100).toFixed(0)}%`);
        console.log(`   📝 Reasoning: ${result.reasoning}`);
        if (result.missingItems.length > 0) {
          console.log(`   ⚠️ Missing items:`);
          result.missingItems.forEach((item, i) => {
            console.log(`      ${i + 1}. ${item}`);
          });
        }
        console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
        
        return result;
        
      } finally {
        if (cleanup) await cleanup();
      }
      
    } catch (error: any) {
      const elapsed = Date.now() - startTime;
      console.error(`❌ [CHECKPOINT-AI] Error after ${elapsed}ms:`, error.message);
      return this.createDefaultCheckpointResult(params.checkpoint.checks, `Error: ${error.message}`);
    }
  }
  
  /**
   * Costruisce il prompt per l'analisi semantica del checkpoint
   */
  private static buildCheckpointPrompt(params: CheckpointAnalysisParams): string {
    const { checkpoint, recentMessages, phaseName } = params;
    
    // Formatta la conversazione (tutti i messaggi rilevanti)
    const conversationText = recentMessages
      .map(m => `${m.role === 'user' ? 'PROSPECT' : 'AGENTE'}: ${m.content}`)
      .join('\n\n');
    
    // Formatta i check da verificare
    const checksFormatted = checkpoint.checks
      .map((check, i) => `${i + 1}. "${check}"`)
      .join('\n');
    
    return `Sei un analizzatore esperto di conversazioni di vendita.

═══════════════════════════════════════════════════════════════
🎯 IL TUO COMPITO
═══════════════════════════════════════════════════════════════
Analizza la conversazione e determina quali CHECKPOINT sono stati completati.

📍 CONTESTO:
- Fase: ${phaseName}
- Checkpoint: ${checkpoint.title}

📋 CHECKPOINT DA VERIFICARE:
${checksFormatted}

═══════════════════════════════════════════════════════════════
💬 CONVERSAZIONE DA ANALIZZARE
═══════════════════════════════════════════════════════════════
${conversationText}

═══════════════════════════════════════════════════════════════
📏 REGOLE DI VALUTAZIONE
═══════════════════════════════════════════════════════════════

🔍 ANALISI SEMANTICA (NON keyword matching!):
- Valuta il SIGNIFICATO, non le parole esatte
- "Da quale città mi contatti?" = "Da dove chiami?" ✅
- "Come va la giornata?" = "Come stai?" ✅  
- "Parlami del tuo lavoro" = "Di cosa ti occupi?" ✅

✅ CONSIDERA UN CHECK COMPLETATO SE:
1. L'agente ha fatto la domanda (anche con parole diverse)
2. Il prospect ha risposto con informazioni rilevanti
3. Il significato dell'obiettivo è stato raggiunto

❌ CONSIDERA UN CHECK NON COMPLETATO SE:
1. La domanda non è mai stata fatta
2. Il prospect non ha risposto
3. La risposta è troppo vaga per l'obiettivo

⚠️ CRITERI STRETTI:
- "Ok", "Sì", "Va bene" da soli NON completano check informativi
- Per check come "Sai il problema principale?" → deve esserci info specifica
- Per check come "Ha detto OK al processo?" → basta conferma esplicita

═══════════════════════════════════════════════════════════════
📤 FORMATO RISPOSTA (JSON VALIDO)
═══════════════════════════════════════════════════════════════
REGOLE DI OUTPUT:
- Rispondi SOLO con un oggetto JSON valido
- NON aggiungere testo, markdown o spiegazioni
- Il JSON deve essere parsabile con JSON.parse()

Schema JSON:
{
  "isComplete": boolean,           // true se TUTTI i check sono completati
  "completedItems": string[],      // array dei check completati (testo esatto)
  "missingItems": string[],        // array dei check mancanti (testo esatto)
  "reasoning": string,             // spiegazione breve della valutazione
  "confidence": number,            // 0-1, quanto sei sicuro
  "canAdvance": boolean            // true se si può passare alla fase successiva
}

ESEMPIO RISPOSTA:
{"isComplete":false,"completedItems":["Hai salutato e chiesto come stai?","Hai chiesto da dove chiama?"],"missingItems":["Hai spiegato il processo della call?","Il prospect ha detto OK al processo?"],"reasoning":"L'agente ha fatto le prime due domande ma non ha ancora spiegato il processo della call","confidence":0.85,"canAdvance":false}`;
  }
  
  /**
   * Parse la risposta JSON dall'analisi del checkpoint
   */
  private static parseCheckpointResponse(
    responseText: string, 
    originalChecks: string[]
  ): CheckpointAnalysisResult {
    try {
      // Pulisci la risposta
      let cleanText = responseText.trim();
      if (cleanText.startsWith('```json')) cleanText = cleanText.slice(7);
      if (cleanText.startsWith('```')) cleanText = cleanText.slice(3);
      if (cleanText.endsWith('```')) cleanText = cleanText.slice(0, -3);
      cleanText = cleanText.trim();
      
      // Trova il JSON nella risposta (potrebbe avere testo extra)
      const jsonMatch = cleanText.match(/\{[\s\S]*?"isComplete"[\s\S]*?\}/);
      if (jsonMatch) {
        cleanText = jsonMatch[0];
      }
      
      const parsed = JSON.parse(cleanText);
      
      // Valida e normalizza
      const completedItems = Array.isArray(parsed.completedItems) 
        ? parsed.completedItems.filter((item: any) => typeof item === 'string')
        : [];
      
      const missingItems = Array.isArray(parsed.missingItems)
        ? parsed.missingItems.filter((item: any) => typeof item === 'string')
        : originalChecks; // Fallback: tutti mancanti
      
      const isComplete = Boolean(parsed.isComplete) && missingItems.length === 0;
      
      return {
        isComplete,
        completedItems,
        missingItems,
        reasoning: String(parsed.reasoning || 'No reasoning provided'),
        confidence: Math.min(1, Math.max(0, Number(parsed.confidence) || 0.5)),
        canAdvance: Boolean(parsed.canAdvance) && isComplete
      };
      
    } catch (error: any) {
      console.warn('⚠️ [CHECKPOINT-AI] Failed to parse response:', responseText.substring(0, 200));
      return this.createDefaultCheckpointResult(originalChecks, `Parse failed: ${error.message}`);
    }
  }
  
  /**
   * Crea un risultato di default per il checkpoint (tutti non completati)
   */
  private static createDefaultCheckpointResult(
    checks: string[], 
    reasoning: string
  ): CheckpointAnalysisResult {
    return {
      isComplete: false,
      completedItems: [],
      missingItems: [...checks],
      reasoning,
      confidence: 0,
      canAdvance: false
    };
  }
}
