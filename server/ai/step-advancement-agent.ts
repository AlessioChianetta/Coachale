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
 * Dettaglio di ogni singola verifica del checkpoint
 */
export interface CheckpointItemDetail {
  check: string;                    // Il testo originale del check
  status: 'validated' | 'missing' | 'vague';  // Stato della verifica
  infoCollected?: string;           // Informazione specifica raccolta (se validata)
  reason?: string;                  // Motivo se mancante o vago
  evidenceQuote?: string;           // Citazione dalla conversazione
  suggestedNextAction?: string;     // 🆕 Suggerimento AI su cosa fare per completare il check
}

/**
 * Quality Score per valutare la qualità delle informazioni raccolte
 */
export interface CheckpointQualityScore {
  specificity: number;      // 0-10: Quanto sono specifiche le info (non vaghe)
  completeness: number;     // 0-10: Quante verifiche sono complete
  actionability: number;    // 0-10: Le info sono utilizzabili per la vendita?
  overall: number;          // 0-10: Media pesata
}

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
  // 🆕 Nuovi campi per logging dettagliato
  itemDetails: CheckpointItemDetail[];  // Dettaglio per ogni check
  qualityScore: CheckpointQualityScore; // Punteggio qualità
  phaseNumber: string;                  // Numero fase per logging
  totalChecks: number;                  // Totale verifiche
  validatedCount: number;               // Verifiche validate
  missingCount: number;                 // Verifiche mancanti
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
  private static readonly MODEL = "gemini-3.1-flash-lite-preview";
  private static readonly TIMEOUT_MS = 10000; // 5 secondi max
  
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
      const { client: aiClient, cleanup, setFeature } = await getAIProvider(params.clientId, params.consultantId);
      setFeature?.('step-advancement');
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
              temperature: 0,
              maxOutputTokens: 1000,
              thinkingConfig: { thinkingBudget: 1024 },
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
      .slice(-60000)
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

✅ VALUTAZIONE CONTESTUALE - APPROCCIO COACH INTELLIGENTE:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Valuta la risposta in base al TIPO di step e all'OBIETTIVO, non in modo rigido.

🎯 TIPOLOGIE DI STEP E CRITERI DI AVANZAMENTO:

1. STEP DI APERTURA/RAPPORT (saluti, "come stai", rompere il ghiaccio):
   → Obiettivo: creare connessione, mettere a suo agio il prospect
   → Risposte VALIDE per avanzare:
      ✅ "Bene, grazie!" - risposta amichevole = rapport creato
      ✅ "Tutto ok!" - risposta positiva = connessione stabilita  
      ✅ "Ciao!" - saluto reciproco = ghiaccio rotto
      ✅ Qualsiasi risposta che mostri apertura e disponibilità
   → L'emozione positiva QUI È il segnale di successo!
   → NON serve "informazione concreta" per un saluto

2. STEP INFORMATIVI (raccolta dati: provenienza, motivo call, situazione):
   → Obiettivo: raccogliere informazione UTILE per la vendita
   → Risposte VALIDE per avanzare:
      ✅ "Milano" - info precisa, perfetto
      ✅ "Nord Italia" - info sufficiente per ora
      ✅ "Ho visto il tuo video su X e mi ha incuriosito" - spiega il motivo
   → Risposte INSUFFICIENTI (suggerisci di approfondire):
      ⚠️ "Curiosità!" - troppo vaga, chiedi COSA lo ha incuriosito
      ⚠️ "Boh, non so" - vago, cerca di capire meglio
   → Se risposta vaga → avanza ma con suggerimento: "Approfondisci cosa lo ha incuriosito"

3. STEP DI QUALIFICA/CRITICI (problema principale, budget, decision maker, urgenza):
   → Obiettivo: capire se il prospect è qualificato - INFO ESSENZIALE
   → QUI serve dettaglio, NON avanzare senza info
   → Se la risposta è vaga o mancante → shouldAdvance = FALSE
   → Feedback amichevole per guidare l'approfondimento
   
   🔴 IL PROBLEMA PRINCIPALE È LA COSA PIÙ IMPORTANTE:
   → Devi capire ESATTAMENTE quale problema vuole risolvere il prospect
   → Non basta "ho vari problemi" - serve IL problema specifico
   → Non basta "voglio migliorare" - serve COSA vuole migliorare e PERCHÉ
   → Senza capire il problema, non puoi proporre la soluzione giusta!
   
   → ESEMPI di info critica mancante che BLOCCA l'avanzamento:
      ❌ "Qual è il problema?" → "Vari problemi" → NON avanzare, approfondisci
      ❌ "Qual è il problema?" → "Voglio migliorare" → NON avanzare, chiedi COSA
      ❌ "Qual è il problema?" → "Curiosità" → NON avanzare, non è un problema
      ❌ "Qual è il budget?" → "Vedremo" → NON avanzare
      ❌ "Chi decide?" → nessuna risposta → NON avanzare
   
   → ESEMPI di risposta SUFFICIENTE per avanzare:
      ✅ "Il mio problema è che non riesco a chiudere abbastanza clienti"
      ✅ "Faccio fatica a trovare nuovi lead qualificati"
      ✅ "Ho un budget di circa 2000€ al mese"

📝 FILOSOFIA: COACH AMICHEVOLE, NON POLIZIOTTO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- GUIDA invece di punire
- SUGGERISCI invece di bloccare
- SUPPORTA il flusso naturale della conversazione
- Il venditore è un professionista, aiutalo non ostacolarlo

🚦 REGOLA DI AVANZAMENTO BILANCIATA:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
L'avanzamento dipende dal TIPO DI STEP e dalla QUALITÀ della risposta:

📗 STEP APERTURA/RAPPORT → AVANZA FACILMENTE
   - "Bene grazie!" è sufficiente per avanzare
   - L'obiettivo è creare connessione, non raccogliere dati

📙 STEP INFORMATIVI → AVANZA CON CONTENUTO
   - Se la risposta ha contenuto utile (anche parziale) → AVANZA
   - Se la risposta è troppo vaga ("Curiosità!", "Boh") → AVANZA ma con suggerimento coaching
   - Esempio: "Potresti approfondire cosa lo ha incuriosito"

📕 STEP CRITICI (budget, decision maker, problema principale) → RICHIEDI INFO
   - Se manca informazione ESSENZIALE → shouldAdvance = FALSE
   - Ma feedback AMICHEVOLE, non punitivo
   - Esempio: "Prima di proseguire, cerca di capire il suo budget approssimativo"

⚠️ QUANDO NON AVANZARE:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. Il prospect NON ha risposto (solo messaggi AGENTE)
2. Step CRITICO e manca informazione essenziale (budget, decision maker, problema)
3. Il prospect ha chiaramente evitato la domanda su info critica

⚠️ QUANDO AVANZARE CON SUGGERIMENTO:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. Risposta parziale su step informativo → AVANZA + suggerisci approfondimento
2. Checkpoint mancanti ma non critici → AVANZA + ricorda al venditore
3. Risposta vaga ma conversazione fluida → AVANZA + suggerimento amichevole

📝 TONO DEL FEEDBACK: COACH AMICHEVOLE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
❌ MAI dire: "STOP!", "BLOCCO!", "NON puoi avanzare!"
✅ Usa: "Suggerimento:", "Potresti...", "Prima di proseguire..."

✅ REGOLA: DEVI VEDERE UNA RISPOSTA DEL PROSPECT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Se vedi SOLO messaggi AGENTE senza risposta PROSPECT → shouldAdvance = FALSE
Devi vedere almeno un messaggio PROSPECT dopo la domanda dell'agente.

ESEMPIO:
Messaggi: [AGENTE] "Ciao! Come stai?" [PROSPECT] "Bene grazie!"
→ Prospect ha risposto → AVANZA (è un saluto, "Bene grazie" è perfetto!)

Messaggi: [AGENTE] "Ciao!" [AGENTE] "Come stai?" [AGENTE] "Da dove chiami?"
→ Solo messaggi AGENTE → NON avanzare, manca risposta prospect
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

Esempio se avanzare con suggerimento coaching:
{"shouldAdvance":true,"nextPhaseId":"${nextPhase?.id || 'phase_1'}","nextStepId":"${nextStep?.id || 'step_1'}","reasoning":"Prospect ha risposto, possiamo avanzare","confidence":0.8,"feedbackForAgent":{"shouldInject":true,"correctionMessage":"Suggerimento: approfondisci cosa lo ha incuriosito prima di proseguire","toneReminder":"","priority":"low"}}

Esempio se NON avanzare (manca risposta prospect):
{"shouldAdvance":false,"nextPhaseId":null,"nextStepId":null,"reasoning":"Il prospect non ha ancora risposto alla domanda dell'agente","confidence":0.9,"feedbackForAgent":{"shouldInject":false,"correctionMessage":"","toneReminder":"","priority":"low"}}`;
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
      const { client: aiClient, cleanup, setFeature } = await getAIProvider(params.clientId, params.consultantId);
      setFeature?.('step-advancement');
      
      try {
        // Costruisci il prompt per l'analisi semantica
        const prompt = this.buildCheckpointPrompt(params);
        
        // Log dei check da verificare
        console.log(`   📋 Checks to verify:`);
        params.checkpoint.checks.forEach((check, i) => {
          console.log(`      ${i + 1}. ${check}`);
        });
        
        // Chiama Gemini con timeout
        // 🔧 FIX: maxOutputTokens aumentato a 4000 per evitare troncamento JSON
        // Con 9+ check per fase, ogni itemDetail richiede ~100-150 token
        // 4000 token garantisce spazio abbondante per qualsiasi numero di check
        const response = await Promise.race([
          aiClient.generateContent({
            model: this.MODEL,
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0,
              maxOutputTokens: 4000,
              thinkingConfig: { thinkingBudget: 1024 },
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
        
        // 🆕 Estrai phaseNumber dal phaseId
        const phaseNumber = params.phaseId.replace('phase_', '').replace(/_/g, '-');
        
        const result = this.parseCheckpointResponse(responseText, params.checkpoint.checks, phaseNumber);
        
        const elapsed = Date.now() - startTime;
        console.log(`\n🎯 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        console.log(`🎯 [CHECKPOINT-AI] Analysis completed in ${elapsed}ms`);
        console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        
        // 🆕 Log strutturato nel formato richiesto
        this.logCheckpointStatus(result, params.checkpoint.title);
        
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
   * 🆕 VERSIONE 2.0: Validazione RIGOROSA sulla QUALITÀ delle informazioni
   * 🚀 OTTIMIZZAZIONE: Filtra solo messaggi rilevanti per la fase corrente
   */
  private static buildCheckpointPrompt(params: CheckpointAnalysisParams): string {
    const { checkpoint, recentMessages, phaseName, phaseId } = params;
    
    // Estrai numero fase
    const phaseNumber = phaseId.replace('phase_', '').replace(/_/g, '-');
    
    // 🚀 OTTIMIZZAZIONE: Filtra messaggi rilevanti per ridurre contesto
    // Usa solo gli ultimi 20 messaggi + quelli che contengono keyword dei check
    const checkKeywords = checkpoint.checks.flatMap(check => 
      check.toLowerCase().split(/\s+/).filter(w => w.length > 4)
    );
    
    const filteredMessages = recentMessages.filter((msg, idx) => {
      // Sempre includi gli ultimi 20 messaggi per contesto
      if (idx >= recentMessages.length - 20) return true;
      
      // Includi se contiene keyword dei check
      const msgLower = msg.content.toLowerCase();
      return checkKeywords.some(kw => msgLower.includes(kw));
    });
    
    console.log(`   🚀 [CHECKPOINT-AI] Filtered ${recentMessages.length} → ${filteredMessages.length} messages`);
    
    // Formatta la conversazione filtrata
    const conversationText = filteredMessages
      .map(m => `${m.role === 'user' ? 'PROSPECT' : 'AGENTE'}: ${m.content}`)
      .join('\n\n');
    
    // Formatta i check da verificare
    const checksFormatted = checkpoint.checks
      .map((check, i) => `${i + 1}. "${check}"`)
      .join('\n');
    
    return `Sei un COACH di vendita che valuta i checkpoint in modo EQUILIBRATO e RAGIONEVOLE.
Il tuo compito è verificare se le INFORMAZIONI RICHIESTE dal checkpoint sono state 
acquisite durante la conversazione in modo SUFFICIENTE per procedere.

⚠️ APPROCCIO EQUILIBRATO: Valuta se l'agente ha ottenuto informazioni UTILI.
NON serve perfezione - serve che il prospect abbia dato indicazioni sufficienti
per capire la sua situazione e procedere con la vendita.

═══════════════════════════════════════════════════════════════
📍 CONTESTO FASE
═══════════════════════════════════════════════════════════════
- Fase: ${phaseName} (Numero: ${phaseNumber})
- Checkpoint: ${checkpoint.title}
- Totale verifiche: ${checkpoint.checks.length}

📋 VERIFICHE DA VALIDARE:
${checksFormatted}

═══════════════════════════════════════════════════════════════
💬 CONVERSAZIONE DA ANALIZZARE
═══════════════════════════════════════════════════════════════
${conversationText}

═══════════════════════════════════════════════════════════════
🎯 CRITERI DI VALIDAZIONE EQUILIBRATI
═══════════════════════════════════════════════════════════════

✅ VALIDATED (Informazione Acquisita) - Criteri:
1. L'agente ha posto la domanda (anche in forma diversa)
2. Il prospect ha risposto con CONTENUTO pertinente (non solo "sì/no/ok")
3. La risposta fornisce un'INFORMAZIONE UTILIZZABILE
4. C'è una citazione dalla conversazione che lo dimostra (evidenceQuote obbligatorio)

🎯 ECCEZIONE IMPORTANTE per check di CONFERMA/PROSEGUIMENTO:
Per verifiche tipo "Il prospect ha detto che vuole proseguire" o "Ok finale":
- Una risposta ENTUSIASTA con approvazione implicita È VALIDA!
- "Ottimo!", "Perfetto!", "Fantastico!" + qualsiasi indicazione positiva = ✅ VALIDATED
- "Sono prontissimo", "Sono pronto", "Procediamo" = ✅ VALIDATED
- NON serve una conferma letterale "Sì, voglio proseguire"
- Basta che il tono sia CHIARAMENTE POSITIVO e di APPROVAZIONE

Esempi di risposte VALIDE:
- "Il mio problema è che non riesco a chiudere più di 3 clienti al mese" ✅ SPECIFICO
- "Sono un consulente marketing per ristoranti da 5 anni" ✅ SPECIFICO
- "Ho un budget di circa 2000-3000 euro" ✅ SPECIFICO
- "Decido io, mia moglie non c'entra" ✅ SPECIFICO
- "Ottimo, approccio super chiaro, sono prontissimo!" ✅ CONFERMA IMPLICITA VALIDA
- "Perfetto, mi sembra tutto ok, andiamo!" ✅ CONFERMA IMPLICITA VALIDA

❌ MISSING (Non Chiesto) - La domanda NON è mai stata fatta dall'agente

⚠️ VAGUE (Risposta Vaga) - USA CON PARSIMONIA! Solo se:
- Risposta totalmente evasiva: "poi ne parliamo", "vedremo", "boh"
- Cambio argomento completo senza rispondere
- Silenzio o "non so" secco

🟢 ESEMPI DI RISPOSTE VALIDE per il PROBLEMA PRINCIPALE:
- "Non riesco a chiudere più di 2 clienti al mese" → VALIDATED (problema SPECIFICO)
- "Perdo troppo tempo a cercare lead che non comprano" → VALIDATED (problema SPECIFICO)
- "I miei commerciali non sanno gestire le obiezioni" → VALIDATED (problema SPECIFICO)
- "Vorrei fatturare il doppio ma non so come scalare" → VALIDATED (obiettivo + ostacolo)
- "Il mio problema è che non ho abbastanza tempo per le vendite" → VALIDATED (problema specifico)

🟢 ESEMPI DI RISPOSTE VALIDE per altri check:
- "Ne devo parlare con mia moglie" → VALIDATED (info sul decision maker)
- "Ho un budget di 2000-3000€ al mese" → VALIDATED (budget specifico)
- "Decido io insieme al mio socio" → VALIDATED (decision maker chiaro)

⚠️ ESEMPI DI RISPOSTE VAGUE per il PROBLEMA (richiedono approfondimento):
- "Ho diversi problemi con i clienti" → VAGUE (quali problemi esattamente?)
- "Voglio migliorare le vendite" → VAGUE (migliorare come? cosa non funziona ora?)
- "Il mio problema principale è il tempo" → VAGUE (tempo per cosa? cosa vorresti fare?)
- "Curiosità" → VAGUE (non è un problema, approfondisci)
- "Vorrei crescere" → VAGUE (crescere come? cosa ti blocca?)

⚠️ ESEMPI DI RISPOSTE VAGUE GENERALI:
- "Boh" / "Non so" → VAGUE
- "Dipende" (senza spiegazione) → VAGUE
- "Vedremo" / "Poi ne parliamo" → VAGUE (evasivo)
- Solo "Sì" / "Ok" / "Va bene" per domande informative → VAGUE

💡 CRITERIO: La risposta deve contenere INFORMAZIONE CONCRETA, non solo conferma o vaghezza.

═══════════════════════════════════════════════════════════════
📊 QUALITY SCORE (0-10 per ogni metrica)
═══════════════════════════════════════════════════════════════
- specificity: Quanto sono SPECIFICHE le informazioni (numeri, nomi, dettagli concreti)?
- completeness: Quante verifiche sono state completate su totale?
- actionability: Le info raccolte sono UTILIZZABILI per proseguire la vendita?
- overall: Media pesata (specificity*0.4 + completeness*0.3 + actionability*0.3)

═══════════════════════════════════════════════════════════════
📤 FORMATO RISPOSTA JSON
═══════════════════════════════════════════════════════════════
Rispondi SOLO con JSON valido, NO testo aggiuntivo:

{
  "isComplete": boolean,
  "completedItems": ["check validato 1", "check validato 2"],
  "missingItems": ["check mancante/vago 1"],
  "reasoning": "spiegazione sintetica",
  "confidence": 0.0-1.0,
  "canAdvance": boolean,
  "itemDetails": [
    {
      "check": "testo originale del check",
      "status": "validated|missing|vague",
      "infoCollected": "informazione specifica raccolta (se validated)",
      "reason": "motivo se missing/vague",
      "evidenceQuote": "citazione breve dalla conversazione",
      "suggestedNextAction": "OBBLIGATORIO se missing/vague: descrivi l'OBIETTIVO da raggiungere, NON la domanda letterale da fare. Es: 'Devi capire quale ostacolo specifico blocca il prospect' oppure 'Ottieni un esempio concreto del problema'. NON scrivere MAI 'Chiedi:...' - l'agente sa già come fare domande!"
    }
  ],
  "qualityScore": {
    "specificity": 0-10,
    "completeness": 0-10,
    "actionability": 0-10,
    "overall": 0-10
  }
}

⚠️ REGOLE FINALI:
- canAdvance = true SE isComplete = true E qualityScore.overall >= 4
- I check "vague" BLOCCANO l'avanzamento - serve risposta con CONTENUTO
- MISSING = domanda mai fatta, VAGUE = risposta senza contenuto → entrambi bloccano
- Ogni check VALIDATED deve avere evidenceQuote con citazione reale dalla conversazione
- NON validare senza evidenza concreta.`;
  }
  
  /**
   * Parse la risposta JSON dall'analisi del checkpoint
   * 🆕 VERSIONE 2.0: Supporta itemDetails e qualityScore
   */
  private static parseCheckpointResponse(
    responseText: string, 
    originalChecks: string[],
    phaseNumber: string = '0'
  ): CheckpointAnalysisResult {
    try {
      // 🔍 Debug: Log raw response
      console.log(`   📥 Raw AI response length: ${responseText.length} chars`);
      console.log(`   📥 First 200 chars: ${responseText.substring(0, 200).replace(/\n/g, '\\n')}`);
      
      // Pulisci la risposta
      let cleanText = responseText.trim();
      if (cleanText.startsWith('```json')) cleanText = cleanText.slice(7);
      if (cleanText.startsWith('```')) cleanText = cleanText.slice(3);
      if (cleanText.endsWith('```')) cleanText = cleanText.slice(0, -3);
      cleanText = cleanText.trim();
      
      // Trova il JSON nella risposta (potrebbe avere testo extra)
      // 🆕 Migliorato regex per essere più robusto
      let jsonMatch = cleanText.match(/\{[\s\S]*?"isComplete"[\s\S]*\}/);
      if (jsonMatch) {
        cleanText = jsonMatch[0];
      }
      
      // 🆕 FIX: Tenta di riparare JSON troncato o malformato
      // Rimuovi eventuali caratteri non validi alla fine
      cleanText = cleanText.replace(/[\x00-\x1F\x7F]/g, ' '); // Rimuovi caratteri di controllo
      
      // Se il JSON sembra troncato, prova a chiuderlo
      const openBraces = (cleanText.match(/\{/g) || []).length;
      const closeBraces = (cleanText.match(/\}/g) || []).length;
      const openBrackets = (cleanText.match(/\[/g) || []).length;
      const closeBrackets = (cleanText.match(/\]/g) || []).length;
      
      // Aggiungi parentesi mancanti
      for (let i = 0; i < openBrackets - closeBrackets; i++) {
        cleanText += ']';
      }
      for (let i = 0; i < openBraces - closeBraces; i++) {
        cleanText += '}';
      }
      
      // 🆕 Fix stringhe non terminate: trova l'ultima stringa non chiusa e chiudila
      // Conta le virgolette (escludendo quelle escaped)
      const quoteMatches = cleanText.match(/(?<!\\)"/g) || [];
      if (quoteMatches.length % 2 !== 0) {
        // Numero dispari di virgolette - aggiungi una virgoletta alla fine
        // Prima rimuovi eventuali caratteri parziali dopo l'ultima virgoletta
        const lastQuoteIndex = cleanText.lastIndexOf('"');
        const afterLastQuote = cleanText.substring(lastQuoteIndex + 1);
        // Se dopo l'ultima virgoletta c'è testo senza virgoletta di chiusura, chiudi la stringa
        if (!afterLastQuote.includes('"')) {
          cleanText = cleanText.substring(0, lastQuoteIndex + 1) + '"' + afterLastQuote;
        }
      }
      
      console.log(`   📥 Cleaned JSON length: ${cleanText.length} chars`);
      
      const parsed = JSON.parse(cleanText);
      
      // Valida e normalizza completedItems e missingItems
      const completedItems = Array.isArray(parsed.completedItems) 
        ? parsed.completedItems.filter((item: any) => typeof item === 'string')
        : [];
      
      const missingItems = Array.isArray(parsed.missingItems)
        ? parsed.missingItems.filter((item: any) => typeof item === 'string')
        : originalChecks;
      
      // 🆕 Parse itemDetails con validazione evidenceQuote
      const itemDetails: CheckpointItemDetail[] = Array.isArray(parsed.itemDetails)
        ? parsed.itemDetails.map((item: any) => {
            let status = ['validated', 'missing', 'vague'].includes(item.status) ? item.status : 'missing';
            const evidenceQuote = item.evidenceQuote ? String(item.evidenceQuote).trim() : undefined;
            const infoCollected = item.infoCollected ? String(item.infoCollected).trim() : undefined;
            
            // 🆕 VALIDAZIONE PROGRAMMATICA: se "validated" ma senza evidence/info → degrada a "vague"
            if (status === 'validated') {
              const hasEvidence = evidenceQuote && evidenceQuote.length > 5;
              const hasInfo = infoCollected && infoCollected.length > 5;
              if (!hasEvidence && !hasInfo) {
                console.log(`   ⚠️ [CHECKPOINT] Degrading "${item.check?.substring(0, 30)}..." from validated to vague (no evidence)`);
                status = 'vague';
              }
            }
            
            return {
              check: String(item.check || ''),
              status: status as 'validated' | 'missing' | 'vague',
              infoCollected,
              reason: item.reason ? String(item.reason) : undefined,
              evidenceQuote,
              suggestedNextAction: item.suggestedNextAction ? String(item.suggestedNextAction) : undefined
            };
          })
        : originalChecks.map(check => ({
            check,
            status: 'missing' as const,
            reason: 'Dettaglio non disponibile'
          }));
      
      // 🆕 Parse qualityScore
      const rawQuality = parsed.qualityScore || {};
      const qualityScore: CheckpointQualityScore = {
        specificity: Math.min(10, Math.max(0, Number(rawQuality.specificity) || 0)),
        completeness: Math.min(10, Math.max(0, Number(rawQuality.completeness) || 0)),
        actionability: Math.min(10, Math.max(0, Number(rawQuality.actionability) || 0)),
        overall: Math.min(10, Math.max(0, Number(rawQuality.overall) || 0))
      };
      
      // Conta validati e mancanti
      const validatedCount = itemDetails.filter(i => i.status === 'validated').length;
      const missingCount = itemDetails.filter(i => i.status !== 'validated').length;
      const hasVague = itemDetails.some(i => i.status === 'vague');
      
      // 🆕 Logica EQUILIBRATA: tutti i check devono essere validated, ma con criteri più ragionevoli
      // vague BLOCCA ancora (il prospect deve dare risposta sostanziale)
      // Soglia qualityScore abbassata da 6 a 4 per essere meno punitivi
      const isComplete = validatedCount === originalChecks.length && !hasVague;
      const canAdvance = isComplete && qualityScore.overall >= 4;
      
      return {
        isComplete,
        completedItems,
        missingItems,
        reasoning: String(parsed.reasoning || 'No reasoning provided'),
        confidence: Math.min(1, Math.max(0, Number(parsed.confidence) || 0.5)),
        canAdvance,
        itemDetails,
        qualityScore,
        phaseNumber,
        totalChecks: originalChecks.length,
        validatedCount,
        missingCount
      };
      
    } catch (error: any) {
      console.warn('⚠️ [CHECKPOINT-AI] Failed to parse response:', responseText.substring(0, 200));
      return this.createDefaultCheckpointResult(originalChecks, `Parse failed: ${error.message}`, phaseNumber);
    }
  }
  
  /**
   * Crea un risultato di default per il checkpoint (tutti non completati)
   * 🆕 VERSIONE 2.0: Include itemDetails e qualityScore
   */
  private static createDefaultCheckpointResult(
    checks: string[], 
    reasoning: string,
    phaseNumber: string = '0'
  ): CheckpointAnalysisResult {
    return {
      isComplete: false,
      completedItems: [],
      missingItems: [...checks],
      reasoning,
      confidence: 0,
      canAdvance: false,
      itemDetails: checks.map(check => ({
        check,
        status: 'missing' as const,
        reason: reasoning
      })),
      qualityScore: {
        specificity: 0,
        completeness: 0,
        actionability: 0,
        overall: 0
      },
      phaseNumber,
      totalChecks: checks.length,
      validatedCount: 0,
      missingCount: checks.length
    };
  }
  
  /**
   * Log strutturato nel formato ESATTO richiesto:
   * [FASE X] - Checkpoint Totali: Y | Validati: Z | Mancanti: K
   */
  static logCheckpointStatus(result: CheckpointAnalysisResult, checkpointTitle: string): void {
    const { phaseNumber, totalChecks, validatedCount, missingCount, itemDetails, qualityScore, canAdvance } = result;
    
    // LINEA PRINCIPALE nel formato esatto richiesto (senza emoji)
    console.log(`[FASE ${phaseNumber}] - Checkpoint Totali: ${totalChecks} | Validati: ${validatedCount} | Mancanti: ${missingCount}`);
    
    // Dettaglio per ogni check (indentato sotto)
    itemDetails.forEach((item, idx) => {
      const statusLabel = item.status === 'validated' ? 'VALIDATO' : item.status === 'vague' ? 'VAGO' : 'MANCANTE';
      console.log(`  CHECK ${idx + 1}: [${statusLabel}] "${item.check.substring(0, 60)}${item.check.length > 60 ? '...' : ''}"`);
      
      if (item.status === 'validated' && item.infoCollected) {
        console.log(`    Info: ${item.infoCollected.substring(0, 70)}${item.infoCollected.length > 70 ? '...' : ''}`);
      } else if (item.reason) {
        console.log(`    Motivo: ${item.reason.substring(0, 70)}${item.reason.length > 70 ? '...' : ''}`);
      }
    });
    
    // Quality Score e stato finale
    const progressPercent = totalChecks > 0 ? Math.round((validatedCount / totalChecks) * 100) : 0;
    console.log(`  Quality Score: ${qualityScore.overall}/10 | Progress: ${progressPercent}%`);
    console.log(`  Stato: ${canAdvance ? 'PASSAGGIO CONSENTITO' : 'BLOCCO ATTIVO - Non puoi passare alla fase successiva'}`);
  }
}
