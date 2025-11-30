// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 🎯 SALES MANAGER AGENT
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Il Sales Manager supervisiona l'AI venditore in tempo reale.
// Sostituisce il StepAdvancementAgent con capacità espanse:
//
// 1. 📈 STEP ADVANCEMENT - decide quando avanzare allo step successivo
// 2. 💰 BUY SIGNAL DETECTION - rileva segnali di acquisto
// 3. 🛡️ OBJECTION DETECTION - rileva e suggerisce risposte alle obiezioni
// 4. ⛔ CHECKPOINT VALIDATION - valida checkpoint prima di avanzare
// 5. 🎭 TONE MONITORING - corregge tono robotico
//
// Usa Vertex AI con le credenziali del consultant
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import { getAIProvider } from "./provider-factory";
import { StepAdvancementAgent, type CheckpointAnalysisResult } from "./step-advancement-agent";

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TYPES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export type BuySignalType = 'price_inquiry' | 'timeline' | 'interest' | 'commitment' | 'comparison';
export type ObjectionType = 'no_time' | 'need_to_think' | 'too_expensive' | 'not_interested' | 'competitor' | 'timing' | 'authority' | 'other';
export type FeedbackPriority = 'critical' | 'high' | 'medium' | 'low';
export type FeedbackType = 'correction' | 'buy_signal' | 'objection' | 'checkpoint' | 'tone' | 'advancement' | 'out_of_scope' | 'control_loss';

export interface BuySignal {
  type: BuySignalType;
  phrase: string;
  confidence: number;
  suggestedAction: string;
}

export interface DetectedObjection {
  type: ObjectionType;
  phrase: string;
  suggestedResponse: string;
  fromScript: boolean;
}

export interface CheckpointStatus {
  checkpointId: string;
  checkpointName: string;
  isComplete: boolean;
  missingItems: string[];
  completedItems: string[];
  canAdvance: boolean;
}

export interface ToneAnalysis {
  isRobotic: boolean;
  consecutiveQuestions: number;
  lastMessageTooLong: boolean;
  energyMismatch: boolean;
  issues: string[];
}

export interface ControlAnalysis {
  isLosingControl: boolean;
  consecutiveProspectQuestions: number;
  salesQuestionsInWindow: number;
  isDiscoveryPhase: boolean;
}

export interface FeedbackForAgent {
  shouldInject: boolean;
  priority: FeedbackPriority;
  type: FeedbackType;
  message: string;
  toneReminder?: string;
}

export interface SalesManagerAnalysis {
  // Step advancement (like before)
  stepAdvancement: {
    shouldAdvance: boolean;
    nextPhaseId: string | null;
    nextStepId: string | null;
    confidence: number;
    reasoning: string;
  };
  
  // Buy signals detected
  buySignals: {
    detected: boolean;
    signals: BuySignal[];
  };
  
  // Objections detected
  objections: {
    detected: boolean;
    objections: DetectedObjection[];
  };
  
  // Checkpoint status
  checkpointStatus: CheckpointStatus | null;
  
  // Tone analysis
  toneAnalysis: ToneAnalysis;
  
  // Prioritized feedback for agent
  feedbackForAgent: FeedbackForAgent | null;
  
  // Analysis metadata
  analysisTimeMs: number;
  modelUsed: string;
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
  questions: Array<{ text: string; marker?: string }>;
}

export interface ScriptCheckpoint {
  id: string;
  title: string;
  checks: string[];
}

export interface ScriptPhase {
  id: string;
  number: string;
  name: string;
  description?: string;
  steps: ScriptStep[];
  checkpoint?: ScriptCheckpoint;
}

export interface ScriptObjection {
  id: string;
  type: string;
  title: string;
  triggers: string[];
  response: string;
  ladderQuestions?: string[];
}

export interface ScriptStructureForManager {
  phases: ScriptPhase[];
  objections?: ScriptObjection[];
}

// 🆕 Business Context per rilevamento fuori scope
export interface BusinessContext {
  businessName: string;
  whatWeDo: string;
  servicesOffered: string[];
  targetClient: string;
  nonTargetClient: string;
}

export interface SalesManagerParams {
  recentMessages: ConversationMessage[];
  script: ScriptStructureForManager;
  currentPhaseId: string;
  currentStepId: string | undefined;
  currentPhaseIndex: number;
  currentStepIndex: number;
  clientId: string;
  consultantId: string;
  currentPhaseEnergy?: PhaseEnergy;
  // 🆕 Business context per rilevamento fuori scope
  businessContext?: BusinessContext;
  // Additional context
  conversationStartTime?: Date;
  totalMessages?: number;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// BUY SIGNAL PATTERNS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const BUY_SIGNAL_PATTERNS: Record<BuySignalType, { patterns: RegExp[]; action: string }> = {
  price_inquiry: {
    patterns: [
      /quanto\s+cost[aio]/i,
      /qual\s*[èe']\s*(il\s+)?prezzo/i,
      /che\s+prezzo/i,
      /l['']?investimento/i,
      /quanto\s+devo\s+(?:pagare|spendere|investire)/i,
      /che\s+cifra/i,
      /budget/i,
    ],
    action: "Non rispondere subito al prezzo! Prima qualifica il valore: 'Prima di parlare di numeri, lasciami capire meglio cosa stai cercando...'"
  },
  timeline: {
    patterns: [
      /quando\s+(?:possiamo|potremmo)\s+(?:iniziare|partire|cominciare)/i,
      /da\s+quando\s+[èe']\s+disponibile/i,
      /in\s+quanto\s+tempo/i,
      /quanto\s+ci\s+vuole/i,
      /tempistic[ah]e?/i,
      /entro\s+quando/i,
    ],
    action: "Segnale forte! Il prospect pensa già all'implementazione. Conferma l'interesse e procedi verso il closing."
  },
  interest: {
    patterns: [
      /mi\s+interessa/i,
      /sembra\s+interessante/i,
      /dimmi\s+di\s+più/i,
      /vorrei\s+(?:sapere|capire)\s+(?:di\s+)?più/i,
      /come\s+funziona\s+(?:esattamente|nel\s+dettaglio)/i,
      /spiegami\s+meglio/i,
    ],
    action: "Interesse dichiarato! Approfondisci cosa lo ha colpito e costruisci su quello."
  },
  commitment: {
    patterns: [
      /(?:ok|okay),?\s+facciamolo/i,
      /sono\s+(?:convinto|deciso|pronto)/i,
      /mi\s+hai\s+convinto/i,
      /ci\s+sto/i,
      /va\s+bene,?\s+(?:procediamo|andiamo)/i,
      /quando\s+(?:firmo|firmiamo)/i,
      /dove\s+devo\s+(?:firmare|pagare)/i,
    ],
    action: "CLOSING NOW! Il prospect è pronto. Non aggiungere altre informazioni, procedi subito alla chiusura."
  },
  comparison: {
    patterns: [
      /(?:rispetto|confronto)\s+(?:a|con)\s+(?:altri|la\s+concorrenza)/i,
      /cosa\s+vi\s+differenzia/i,
      /perch[eé]\s+dovrei\s+scegliere\s+voi/i,
      /cosa\s+avete\s+(?:di\s+)?(?:più|diverso|meglio)/i,
    ],
    action: "Il prospect sta valutando attivamente. Evidenzia i differenziatori chiave senza parlare male della concorrenza."
  }
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// OBJECTION PATTERNS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const OBJECTION_PATTERNS: Record<ObjectionType, { patterns: RegExp[]; defaultResponse: string }> = {
  no_time: {
    patterns: [
      /non\s+ho\s+tempo/i,
      /sono\s+(?:molto\s+)?(?:impegnato|occupato)/i,
      /(?:richiamami|risentiamoci)\s+(?:tra|fra|dopo)/i,
      /adesso\s+non\s+(?:posso|riesco)/i,
      /ho\s+(?:troppo|molto)\s+da\s+fare/i,
    ],
    defaultResponse: "Capisco perfettamente. Proprio per questo ti chiedo: cosa ti sta portando via più tempo in questo momento? (Ladder dei perché)"
  },
  need_to_think: {
    patterns: [
      /devo\s+pensarci/i,
      /ci\s+devo\s+(?:pensare|riflettere)/i,
      /(?:ne\s+)?parlo\s+con\s+(?:il\s+mio\s+)?(?:socio|partner|moglie|marito)/i,
      /ti\s+faccio\s+sapere/i,
      /fammi\s+(?:pensare|riflettere)/i,
      /devo\s+valutare/i,
    ],
    defaultResponse: "Certo, è una decisione importante. Aiutami a capire: cosa vorresti valutare esattamente? (Ladder dei perché per scoprire la vera obiezione)"
  },
  too_expensive: {
    patterns: [
      /(?:costa|è)\s+troppo/i,
      /non\s+(?:ho|abbiamo)\s+(?:il\s+)?budget/i,
      /[èe']\s+(?:fuori|oltre)\s+(?:la\s+mia\s+)?portata/i,
      /troppo\s+(?:caro|costoso)/i,
      /non\s+(?:posso|possiamo)\s+permetterci?lo/i,
    ],
    defaultResponse: "Capisco. Prima di parlare di investimento, lasciami capire: quanto ti sta costando NON risolvere questo problema oggi? (Reframe sul costo dell'inazione)"
  },
  not_interested: {
    patterns: [
      /non\s+(?:mi\s+)?interessa/i,
      /non\s+fa\s+per\s+me/i,
      /lascia\s+(?:stare|perdere)/i,
      /non\s+sono\s+interessato/i,
      /no\s+grazie/i,
    ],
    defaultResponse: "Capisco. Solo per curiosità: cosa ti ha portato ad accettare questa chiamata inizialmente? (Riportare all'interesse originale)"
  },
  competitor: {
    patterns: [
      /(?:uso|usiamo|stiamo\s+(?:già\s+)?usando)\s+(?:già\s+)?(?:un\s+altro|qualcos['']?altro)/i,
      /abbiamo\s+già\s+(?:un|qualcosa)/i,
      /lavoriamo\s+(?:già\s+)?con/i,
      /(?:ho|abbiamo)\s+già\s+(?:un|il)\s+(?:fornitore|consulente|partner)/i,
    ],
    defaultResponse: "Ottimo che stiate già investendo in questo. Cosa vorreste che facesse di diverso o meglio?"
  },
  timing: {
    patterns: [
      /non\s+[èe']\s+il\s+momento/i,
      /(?:forse\s+)?(?:più\s+)?(?:avanti|dopo|in\s+futuro)/i,
      /(?:tra|fra)\s+qualche\s+mese/i,
      /l['']anno\s+prossimo/i,
      /quando\s+(?:sarò|saremo)\s+(?:pronto|pronti)/i,
    ],
    defaultResponse: "Capisco. Cosa dovrebbe cambiare perché diventi il momento giusto? (Scoprire il vero blocco)"
  },
  authority: {
    patterns: [
      /non\s+(?:sono|decido)\s+io/i,
      /devo\s+(?:parlare|chiedere)\s+(?:al\s+)?(?:capo|titolare|responsabile)/i,
      /non\s+(?:ho|abbiamo)\s+(?:l['']?)?autorità/i,
      /decide\s+(?:qualcun\s+)?altro/i,
    ],
    defaultResponse: "Certo. Chi è la persona che prende questa decisione? Potremmo coinvolgerla nella prossima chiamata?"
  },
  other: {
    patterns: [],
    defaultResponse: "Capisco la tua preoccupazione. Aiutami a capire meglio: cosa ti frena esattamente?"
  }
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SALES MANAGER AGENT
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export class SalesManagerAgent {
  private static readonly MODEL = "gemini-2.0-flash-lite";
  private static readonly TIMEOUT_MS = 6000; // 6 secondi max
  
  /**
   * Analisi completa della conversazione con tutte le funzionalità del Sales Manager
   */
  static async analyze(params: SalesManagerParams): Promise<SalesManagerAnalysis> {
    const startTime = Date.now();
    // 🔥 INIZIO: OVERRIDE TEST CRITICO (ABILITATO DA VARIABILE D'AMBIENTE) 🔥
        if (process.env.ENABLE_CIPOLLA_TEST === 'true') {
            const cipollaInstruction = `
    ⚠️ TEST CRITICO: Ricorda al venditore di essere SEMPRE ALLEGRO ED ENTUSIASTA, AI MASSIMI LIVELLI.`;

            const structuredFeedback = `<<<SALES_MANAGER_INSTRUCTION>>>\n${cipollaInstruction}\n<<</SALES_MANAGER_INSTRUCTION>>>`;

            console.log(`🚨 [CIPULLA TEST] OVERRIDE ATTIVO! Forzando istruzione critica.`);

            // Simula il risultato di un'analisi che inietta immediatamente il feedback
            return {
                stepAdvancement: {
                    shouldAdvance: false,
                    nextPhaseId: null,
                    nextStepId: null,
                    confidence: 1,
                    reasoning: 'TEST CIPULLA ATTIVO - Sospendo logica normale'
                },
                buySignals: { detected: false, signals: [] },
                objections: { detected: false, objections: [] },
                checkpointStatus: null,
                toneAnalysis: { isRobotic: false, consecutiveQuestions: 0, lastMessageTooLong: false, energyMismatch: false, issues: [] },
                feedbackForAgent: {
                    shouldInject: true,
                    type: 'system_override',
                    priority: 'critical',
                    message: structuredFeedback, // Contiene i delimitatori e l'ordine
                },
                analysisTimeMs: Date.now() - startTime,
                modelUsed: this.MODEL
            } as SalesManagerAnalysis; 
        }
    console.log(`\n🎩 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`🎩 [SALES-MANAGER] Starting comprehensive analysis`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`   📍 Current: ${params.currentPhaseId} / ${params.currentStepId || 'N/A'}`);
    console.log(`   💬 Messages: ${params.recentMessages.length}`);
    
    // 1. Quick local analysis (no AI call needed) + AI checkpoint validation
    const buySignals = this.detectBuySignals(params.recentMessages);
    const objections = this.detectObjections(params.recentMessages, params.script.objections);
    const toneAnalysis = this.analyzeTone(params.recentMessages, params.currentPhaseEnergy);
    // 🆕 Control analysis - detect if sales is losing control (only in Discovery)
    const controlAnalysis = this.analyzeConversationControl(params.recentMessages, params.currentPhaseId);
    
    // 🆕 CHECKPOINT: Ora usa AI SEMANTIC ANALYSIS invece di keyword matching
    const checkpointStatus = await this.validateCheckpointWithAI(params);
    // 🆕 Business context per feedback (Gemini decide semanticamente se qualcosa è fuori scope)
    const businessCtx = this.getBusinessContextForFeedback(params.businessContext);
    
    console.log(`   💰 Buy signals: ${buySignals.detected ? buySignals.signals.length : 0}`);
    console.log(`   🛡️ Objections: ${objections.detected ? objections.objections.length : 0}`);
    console.log(`   🎭 Tone issues: ${toneAnalysis.issues.length}`);
    console.log(`   🎯 Control: ${controlAnalysis.isLosingControl ? `LOSING (${controlAnalysis.consecutiveProspectQuestions} prospect Q)` : 'OK'}`);
    console.log(`   ⛔ Checkpoint: ${checkpointStatus?.isComplete ? 'COMPLETE' : checkpointStatus?.missingItems.length + ' missing' || 'N/A'}`);
    console.log(`   👤 Business: ${businessCtx?.identity || 'N/A'}`);
    
    // 2. AI analysis for step advancement (only if needed)
    let stepAdvancement = {
      shouldAdvance: false,
      nextPhaseId: null as string | null,
      nextStepId: null as string | null,
      confidence: 0,
      reasoning: 'Pending AI analysis'
    };
    
    // 3. Determine priority feedback
    let feedbackForAgent: FeedbackForAgent | null = null;
    
    // Priority order: Objections > Buy signals > Tone > Checkpoint > Advancement
    // 🆕 L'identità business (chi sei, cosa fai, cosa NON fai) viene SEMPRE inclusa nel feedbackContent
    // e Gemini decide semanticamente se una richiesta è fuori scope
    if (objections.detected && objections.objections.length > 0) {
      // High priority: objection needs handling
      const topObjection = objections.objections[0];
      feedbackForAgent = {
        shouldInject: true,
        priority: 'high',
        type: 'objection',
        message: `🛡️ OBIEZIONE RILEVATA: "${topObjection.phrase}"\n→ Risposta suggerita: ${topObjection.suggestedResponse}`,
        toneReminder: params.currentPhaseEnergy ? 
          `Mantieni tono ${params.currentPhaseEnergy.tone}, energia ${params.currentPhaseEnergy.level}` : undefined
      };
    } else if (buySignals.detected && buySignals.signals.length > 0) {
      const topSignal = buySignals.signals[0];
      
      // 🆕 PAYMENT GATING LOGIC: Blocca discussioni prezzo se checkpoint incompleti
      // Se il prospect chiede del prezzo MA i checkpoint non sono completi → BLOCCA
      if (topSignal.type === 'price_inquiry') {
        // Verifica se ci sono checkpoint incompleti
        const hasIncompleteCheckpoint = checkpointStatus && !checkpointStatus.isComplete;
        
        // Definisci le fasi essenziali che devono essere complete prima di parlare di prezzo
        // Tipicamente: discovery, qualificazione, value building
        const essentialPhases = ['phase_1', 'phase_2', 'phase_3', 'phase_4', 'phase_5'];
        const currentPhaseNum = parseInt(params.currentPhaseId.replace('phase_', ''), 10) || 1;
        const isInEarlyPhase = currentPhaseNum <= 4; // Se siamo nelle prime 4 fasi, è troppo presto
        
        if (hasIncompleteCheckpoint || isInEarlyPhase) {
          // 🚫 PAYMENT GATING ATTIVO: Blocca discussione prezzo
          console.log(`\n🚫 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
          console.log(`🚫 [PAYMENT GATING] BLOCCATA discussione prezzo prematura!`);
          console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
          console.log(`   📍 Current phase: ${params.currentPhaseId} (early: ${isInEarlyPhase})`);
          console.log(`   ⛔ Checkpoint incomplete: ${hasIncompleteCheckpoint}`);
          if (checkpointStatus?.missingItems) {
            console.log(`   ❌ Missing items: ${checkpointStatus.missingItems.length}`);
            checkpointStatus.missingItems.slice(0, 3).forEach((item, i) => {
              console.log(`      ${i + 1}. ${item}`);
            });
          }
          console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
          
          // Genera feedback di blocco con priorità CRITICAL
          const missingInfo = checkpointStatus?.missingItems?.slice(0, 2).join(', ') || 'informazioni sulla situazione del prospect';
          
          feedbackForAgent = {
            shouldInject: true,
            priority: 'critical',
            type: 'correction',
            message: `🚫 STOP! Il prospect chiede del prezzo ma NON HAI ANCORA COMPLETATO LA DISCOVERY!

⛔ NON parlare di prezzi, investimento o costi adesso!

📋 COSA DEVI FARE:
1. Riconosci l'interesse: "Ottima domanda! Prima di parlare di numeri voglio essere sicuro di proporti la soluzione giusta..."
2. Torna alla discovery: "Permettimi di capire meglio: ${missingInfo}"
3. Solo DOPO aver completato il checkpoint → potrai parlare di investimento

🎯 SCRIPT DA SEGUIRE:
"Apprezzo che tu voglia capire l'investimento! È una domanda importante.
Per poterti dare numeri PRECISI e non sparare nel mucchio, ho bisogno di capire ancora alcune cose sulla tua situazione.
Dimmi: [DOMANDA DAL CHECKPOINT MANCANTE]"

⚠️ SE INSISTE: "Capisco l'urgenza! Ma senza queste info rischierei di proporti qualcosa che non fa per te. 2 minuti e ti do numeri precisi."`,
            toneReminder: 'Tono empatico ma fermo. NON cedere alla pressione sul prezzo!'
          };
        } else {
          // ✅ Checkpoint completi, può parlare di prezzo (segnale normale)
          feedbackForAgent = {
            shouldInject: true,
            priority: 'high',
            type: 'buy_signal',
            message: `💰 SEGNALE DI ACQUISTO: "${topSignal.phrase}" (${topSignal.type})\n→ ${topSignal.suggestedAction}\n\n✅ Checkpoint completato - puoi procedere a discutere l'investimento!`,
          };
        }
      } else {
        // Altri buy signals (timeline, interest, commitment, comparison)
        feedbackForAgent = {
          shouldInject: true,
          priority: 'high',
          type: 'buy_signal',
          message: `💰 SEGNALE DI ACQUISTO: "${topSignal.phrase}" (${topSignal.type})\n→ ${topSignal.suggestedAction}`,
        };
      }
    } else if (controlAnalysis.isLosingControl) {
      // 🆕 HIGH PRIORITY: Sales is losing control during Discovery
      // Il prospect sta facendo troppe domande consecutive senza che il sales faccia le sue domande
      feedbackForAgent = {
        shouldInject: true,
        priority: 'high',
        type: 'control_loss',
        message: `🎯 ATTENZIONE: STAI PERDENDO IL CONTROLLO DELLA CONVERSAZIONE!

Il prospect ha fatto ${controlAnalysis.consecutiveProspectQuestions} domande consecutive senza che tu facessi le tue domande di discovery.

⚠️ REGOLA "BISCOTTINO + RIPRENDI CONTROLLO":
1. Dai una risposta BREVE alla domanda del prospect (max 1-2 frasi, il "biscottino")
2. SUBITO DOPO, fai TU una domanda di discovery per riprendere il controllo

📋 ESEMPIO:
Prospect: "Ma quanto costa?"
Tu: "Dipende dalla situazione specifica, ma posso dirti che è un investimento molto accessibile.
     Piuttosto dimmi, qual è il problema principale che stai cercando di risolvere?"

🎯 RICORDA: Sei TU che devi guidare la conversazione, non il prospect!`,
        toneReminder: 'Tono sicuro e direttivo. Riprendi il controllo con una domanda!'
      };
    } else if (toneAnalysis.isRobotic || toneAnalysis.issues.length > 0) {
      // Medium priority: tone correction
      feedbackForAgent = {
        shouldInject: true,
        priority: 'medium',
        type: 'tone',
        message: `🎭 CORREZIONE TONO: ${toneAnalysis.issues.join('. ')}`,
        toneReminder: params.currentPhaseEnergy ? 
          `Ricorda: tono ${params.currentPhaseEnergy.tone}, energia ${params.currentPhaseEnergy.level}, ritmo ${params.currentPhaseEnergy.pace}` : undefined
      };
    } else if (checkpointStatus && !checkpointStatus.canAdvance && checkpointStatus.missingItems.length > 0) {
      // Medium priority: checkpoint not complete
      feedbackForAgent = {
        shouldInject: true,
        priority: 'medium',
        type: 'checkpoint',
        message: `⛔ CHECKPOINT INCOMPLETO: Mancano ${checkpointStatus.missingItems.length} verifiche\n→ ${checkpointStatus.missingItems.slice(0, 2).join('\n→ ')}`,
      };
    }
    
    // 4. Call AI for step advancement analysis (if no critical issues)
    if (!feedbackForAgent || feedbackForAgent.priority !== 'critical') {
      try {
        stepAdvancement = await this.analyzeStepAdvancement(params);
        
        // 🆕 FIX: Check if reasoning mentions out-of-scope and generate feedback
        if (!feedbackForAgent) {
          const reasoningLower = stepAdvancement.reasoning.toLowerCase();
          const outOfScopeKeywords = ['fuori scope', 'fuori dall\'offerta', 'non rientra', 'non offriamo', 'non vendiamo', 'non forniamo', 'scooter', 'monopattini', 'fisico', 'prodotto fisico'];
          
          const isOutOfScope = outOfScopeKeywords.some(keyword => reasoningLower.includes(keyword));
          
          if (isOutOfScope) {
            feedbackForAgent = {
              shouldInject: true,
              priority: 'high',
              type: 'out_of_scope',
              message: `⛔ RICHIESTA FUORI SCOPE RILEVATA: Il prospect sta chiedendo qualcosa che NON rientra nella nostra offerta.\n→ Guida gentilmente verso i nostri servizi reali`
            };
            console.log(`\n⛔ [OUT-OF-SCOPE] Rilevato nel reasoning - generando feedback out_of_scope`);
          } else if (stepAdvancement.reasoning.includes('PROBLEMA')) {
            feedbackForAgent = {
              shouldInject: true,
              priority: 'medium',
              type: 'advancement',
              message: stepAdvancement.reasoning,
              toneReminder: params.currentPhaseEnergy ? 
                `Tono ${params.currentPhaseEnergy.tone}` : undefined
            };
          }
        }
      } catch (error: any) {
        console.warn(`⚠️ [SALES-MANAGER] AI analysis failed: ${error.message}`);
        stepAdvancement.reasoning = `AI analysis failed: ${error.message}`;
      }
    }
    
    const analysisTimeMs = Date.now() - startTime;
    
    console.log(`\n🎩 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`🎩 [SALES-MANAGER] Analysis complete in ${analysisTimeMs}ms`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`   → Step advance: ${stepAdvancement.shouldAdvance} (${(stepAdvancement.confidence * 100).toFixed(0)}%)`);
    console.log(`   → Feedback: ${feedbackForAgent ? `${feedbackForAgent.type} (${feedbackForAgent.priority})` : 'none'}`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
    
    return {
      stepAdvancement,
      buySignals,
      objections,
      checkpointStatus,
      toneAnalysis,
      feedbackForAgent,
      analysisTimeMs,
      modelUsed: this.MODEL
    };
  }
  
  /**
   * Detect buy signals in recent messages (local, fast)
   */
  private static detectBuySignals(messages: ConversationMessage[]): { detected: boolean; signals: BuySignal[] } {
    const signals: BuySignal[] = [];
    
    // Only check user (prospect) messages
    const prospectMessages = messages.filter(m => m.role === 'user');
    
    for (const message of prospectMessages) {
      for (const [type, config] of Object.entries(BUY_SIGNAL_PATTERNS)) {
        for (const pattern of config.patterns) {
          const match = message.content.match(pattern);
          if (match) {
            signals.push({
              type: type as BuySignalType,
              phrase: match[0],
              confidence: 0.9,
              suggestedAction: config.action
            });
            break; // One signal per type per message
          }
        }
      }
    }
    
    return {
      detected: signals.length > 0,
      signals
    };
  }
  
  /**
   * Detect objections in recent messages (local, fast)
   */
  private static detectObjections(
    messages: ConversationMessage[], 
    scriptObjections?: ScriptObjection[]
  ): { detected: boolean; objections: DetectedObjection[] } {
    const detectedObjections: DetectedObjection[] = [];
    
    // Only check user (prospect) messages
    const prospectMessages = messages.filter(m => m.role === 'user');
    
    for (const message of prospectMessages) {
      // Check against script objections first (if available)
      if (scriptObjections) {
        for (const scriptObj of scriptObjections) {
          for (const trigger of scriptObj.triggers || []) {
            if (message.content.toLowerCase().includes(trigger.toLowerCase())) {
              detectedObjections.push({
                type: 'other',
                phrase: message.content.substring(0, 100),
                suggestedResponse: scriptObj.response,
                fromScript: true
              });
              break;
            }
          }
        }
      }
      
      // Check against generic patterns
      for (const [type, config] of Object.entries(OBJECTION_PATTERNS)) {
        if (type === 'other') continue; // Skip generic fallback
        
        for (const pattern of config.patterns) {
          const match = message.content.match(pattern);
          if (match) {
            // Check if we already have this objection from script
            const alreadyDetected = detectedObjections.some(
              o => o.phrase === message.content.substring(0, 100)
            );
            
            if (!alreadyDetected) {
              detectedObjections.push({
                type: type as ObjectionType,
                phrase: match[0],
                suggestedResponse: config.defaultResponse,
                fromScript: false
              });
            }
            break;
          }
        }
      }
    }
    
    return {
      detected: detectedObjections.length > 0,
      objections: detectedObjections
    };
  }
  
  /**
   * 🆕 Get business context for feedback
   * Restituisce il contesto business completo da includere nel feedback per Gemini
   * NON fa keyword extraction - passa il testo completo e lascia che l'AI capisca semanticamente
   */
  private static getBusinessContextForFeedback(
    businessContext?: BusinessContext
  ): { identity: string; whatWeDo: string; whatWeDontDo: string } | null {
    if (!businessContext) return null;
    
    return {
      identity: businessContext.businessName || 'Il consulente',
      whatWeDo: businessContext.whatWeDo || 'Offriamo servizi specializzati',
      whatWeDontDo: businessContext.nonTargetClient || ''
    };
  }
  
  /**
   * 🆕 Analyze conversation control - detect if sales is losing control
   * Only applies during Discovery phase (phase_1 to phase_4)
   * 
   * Rileva quando il prospect fa troppe domande consecutive
   * senza che il sales faccia le sue domande di discovery
   */
  private static analyzeConversationControl(
    messages: ConversationMessage[],
    currentPhaseId: string
  ): ControlAnalysis {
    // Check if we're in Discovery phase (phase_1 to phase_4)
    const phaseNum = parseInt(currentPhaseId.replace('phase_', ''), 10) || 0;
    const isDiscoveryPhase = phaseNum >= 1 && phaseNum <= 4;
    
    if (!isDiscoveryPhase) {
      return {
        isLosingControl: false,
        consecutiveProspectQuestions: 0,
        salesQuestionsInWindow: 0,
        isDiscoveryPhase: false
      };
    }
    
    // Analyze last 10 messages
    const recentMessages = messages.slice(-10);
    
    // Count consecutive prospect questions without sales asking a question
    let consecutiveProspectQuestions = 0;
    let salesQuestionsInWindow = 0;
    
    // Go backwards from most recent message
    for (let i = recentMessages.length - 1; i >= 0; i--) {
      const msg = recentMessages[i];
      
      if (msg.role === 'user') {
        // Check if prospect message contains a question
        const hasQuestion = msg.content.includes('?') || 
          /^(cosa|come|quando|perché|perche|quanto|chi|dove|quale)/i.test(msg.content.trim());
        
        if (hasQuestion) {
          consecutiveProspectQuestions++;
        }
      } else if (msg.role === 'assistant') {
        // Check if sales made a question
        const hasQuestion = msg.content.includes('?');
        
        if (hasQuestion) {
          salesQuestionsInWindow++;
          // Sales made a question, reset the counter
          break;
        }
        // If sales didn't ask a question, continue counting
      }
    }
    
    // Losing control if 3+ consecutive prospect questions without sales asking any
    const isLosingControl = consecutiveProspectQuestions >= 3 && salesQuestionsInWindow === 0;
    
    if (isLosingControl) {
      console.log(`\n🎯 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`🎯 [CONTROL ANALYSIS] Sales is LOSING CONTROL!`);
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`   📍 Phase: ${currentPhaseId} (Discovery: ${isDiscoveryPhase})`);
      console.log(`   ❓ Consecutive prospect questions: ${consecutiveProspectQuestions}`);
      console.log(`   📋 Sales questions in window: ${salesQuestionsInWindow}`);
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
    }
    
    return {
      isLosingControl,
      consecutiveProspectQuestions,
      salesQuestionsInWindow,
      isDiscoveryPhase
    };
  }
  
  /**
   * Analyze tone and detect robotic behavior (local, fast)
   */
  private static analyzeTone(
    messages: ConversationMessage[],
    expectedEnergy?: PhaseEnergy
  ): ToneAnalysis {
    const issues: string[] = [];
    let consecutiveQuestions = 0;
    let lastMessageTooLong = false;
    let isRobotic = false;
    let energyMismatch = false;
    
    // Get last 4 AI messages
    const aiMessages = messages
      .filter(m => m.role === 'assistant')
      .slice(-4);
    
    if (aiMessages.length === 0) {
      return { isRobotic: false, consecutiveQuestions: 0, lastMessageTooLong: false, energyMismatch: false, issues: [] };
    }
    
    // Check consecutive questions (no waiting for response)
    let questionsInRow = 0;
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i];
      if (msg.role === 'assistant') {
        const questionCount = (msg.content.match(/\?/g) || []).length;
        if (questionCount > 0) {
          questionsInRow += questionCount;
        }
      } else {
        break; // Stop at first user message going backwards
      }
    }
    
    if (questionsInRow >= 3) {
      consecutiveQuestions = questionsInRow;
      issues.push(`${questionsInRow} domande consecutive senza aspettare risposta`);
      isRobotic = true;
    }
    
    // Check last message length (800 caratteri per chiamate vocali, non 500)
    const lastAiMessage = aiMessages[aiMessages.length - 1];
    if (lastAiMessage && lastAiMessage.content.length > 800) {
      lastMessageTooLong = true;
      issues.push(`Messaggio troppo lungo (${lastAiMessage.content.length} caratteri, max 800)`);
      isRobotic = true;
    }
    
    // Check if AI is not responding to user questions
    // FIXED: Only flag if AI message comes AFTER user question and doesn't acknowledge it
    const lastUserIdx = messages.map((m, i) => m.role === 'user' ? i : -1).filter(i => i >= 0).pop() ?? -1;
    const lastAiIdx = messages.map((m, i) => m.role === 'assistant' ? i : -1).filter(i => i >= 0).pop() ?? -1;
    
    if (lastUserIdx >= 0 && lastAiIdx > lastUserIdx) {
      // AI spoke AFTER user - check if user asked question and AI acknowledged
      const lastUserMessage = messages[lastUserIdx];
      const aiAfterUser = messages[lastAiIdx];
      const hasQuestion = lastUserMessage.content.includes('?');
      
      // Expanded list of acknowledgment words in Italian
      const aiContent = aiAfterUser.content.toLowerCase();
      const acknowledgmentWords = [
        'sì', 'si', 'no', 'certo', 'capisco', 'esatto', 'perfetto', 'ottimo',
        'bene', 'benissimo', 'assolutamente', 'chiaro', 'ok', 'okay', 'd\'accordo',
        'giusto', 'vero', 'infatti', 'certamente', 'ovviamente', 'naturalmente',
        'bella domanda', 'buona domanda', 'ottima domanda', 'interessante',
        'ecco', 'allora', 'dunque', 'quindi', 'perché', 'perchè'
      ];
      const hasAcknowledgment = acknowledgmentWords.some(word => aiContent.includes(word));
      
      if (hasQuestion && !hasAcknowledgment) {
        issues.push('Il prospect ha fatto una domanda ma l\'AI non sembra rispondere');
        isRobotic = true;
      }
    }
    
    // Energy mismatch check (simplified)
    if (expectedEnergy) {
      // Check for emotional cues in last AI message
      const lastMsg = lastAiMessage?.content.toLowerCase() || '';
      
      if (expectedEnergy.level === 'ALTO' && 
          !lastMsg.includes('!') && 
          !lastMsg.includes('fantastico') && 
          !lastMsg.includes('ottimo') &&
          !lastMsg.includes('perfetto')) {
        energyMismatch = true;
        issues.push(`Energia troppo bassa per questa fase (richiesta: ${expectedEnergy.level})`);
      }
      
      if (expectedEnergy.tone === 'ENTUSIASTA' && 
          lastMsg.length > 0 &&
          (lastMsg.match(/\!/g) || []).length < 1) {
        energyMismatch = true;
        issues.push(`Tono non abbastanza entusiasta`);
      }
    }
    
    return {
      isRobotic,
      consecutiveQuestions,
      lastMessageTooLong,
      energyMismatch,
      issues
    };
  }
  
  /**
   * 🆕 Validate checkpoint completion using AI SEMANTIC ANALYSIS
   * 
   * CAMBIAMENTO CRITICO:
   * - PRIMA: keyword matching locale (matchRatio >= 0.5)
   * - ADESSO: analisi semantica AI via StepAdvancementAgent.analyzeCheckpointCompletion()
   * 
   * L'AI capisce il SIGNIFICATO, non solo le parole:
   * - "Da quale città mi contatti?" = "Da dove chiami?" ✅
   * - "Come va la giornata?" = "Come stai?" ✅
   */
  private static async validateCheckpointWithAI(params: SalesManagerParams): Promise<CheckpointStatus | null> {
    const currentPhase = params.script.phases.find(p => p.id === params.currentPhaseId);
    if (!currentPhase?.checkpoint) return null;
    
    const checkpoint = currentPhase.checkpoint;
    
    console.log(`\n🔄 [SALES-MANAGER] Delegating checkpoint validation to AI semantic analysis...`);
    console.log(`   📍 Phase: ${currentPhase.name} (${currentPhase.id})`);
    console.log(`   🎯 Checkpoint: ${checkpoint.title}`);
    console.log(`   📋 Checks to validate: ${checkpoint.checks.length}`);
    
    try {
      // Usa l'analisi semantica AI del StepAdvancementAgent
      const aiResult = await StepAdvancementAgent.analyzeCheckpointCompletion({
        checkpoint: {
          id: checkpoint.id,
          title: checkpoint.title,
          checks: checkpoint.checks
        },
        recentMessages: params.recentMessages,
        clientId: params.clientId,
        consultantId: params.consultantId,
        phaseName: currentPhase.name,
        phaseId: currentPhase.id
      });
      
      console.log(`✅ [SALES-MANAGER] AI checkpoint analysis complete`);
      console.log(`   🟢 Completed: ${aiResult.completedItems.length}`);
      console.log(`   🔴 Missing: ${aiResult.missingItems.length}`);
      console.log(`   📊 Confidence: ${(aiResult.confidence * 100).toFixed(0)}%`);
      
      return {
        checkpointId: checkpoint.id,
        checkpointName: checkpoint.title,
        isComplete: aiResult.isComplete,
        missingItems: aiResult.missingItems,
        completedItems: aiResult.completedItems,
        canAdvance: aiResult.canAdvance
      };
      
    } catch (error: any) {
      console.error(`❌ [SALES-MANAGER] AI checkpoint validation failed:`, error.message);
      console.log(`⚠️ [SALES-MANAGER] Falling back to keyword-based validation`);
      
      // FALLBACK: keyword matching (vecchio metodo) se AI fallisce
      return this.validateCheckpointKeywordFallback(params, checkpoint, currentPhase.name);
    }
  }
  
  /**
   * FALLBACK: keyword-based checkpoint validation (usato solo se AI fallisce)
   */
  private static validateCheckpointKeywordFallback(
    params: SalesManagerParams, 
    checkpoint: ScriptCheckpoint,
    phaseName: string
  ): CheckpointStatus {
    console.log(`⚠️ [SALES-MANAGER] Using FALLBACK keyword validation for ${checkpoint.title}`);
    
    const completedItems: string[] = [];
    const missingItems: string[] = [];
    const allMessages = params.recentMessages.map(m => m.content.toLowerCase()).join(' ');
    
    for (const check of checkpoint.checks) {
      const keywords = check.toLowerCase()
        .replace(/[?¿!¡.,;:]/g, '')
        .split(' ')
        .filter(w => w.length > 3);
      
      const matchedKeywords = keywords.filter(kw => allMessages.includes(kw));
      const matchRatio = keywords.length > 0 ? matchedKeywords.length / keywords.length : 0;
      
      if (matchRatio >= 0.5) {
        completedItems.push(check);
      } else {
        missingItems.push(check);
      }
    }
    
    return {
      checkpointId: checkpoint.id,
      checkpointName: checkpoint.title,
      isComplete: missingItems.length === 0,
      missingItems,
      completedItems,
      canAdvance: missingItems.length === 0
    };
  }
  
  /**
   * AI-powered step advancement analysis
   */
  private static async analyzeStepAdvancement(params: SalesManagerParams): Promise<{
    shouldAdvance: boolean;
    nextPhaseId: string | null;
    nextStepId: string | null;
    confidence: number;
    reasoning: string;
  }> {
    const { client: aiClient, cleanup } = await getAIProvider(params.clientId, params.consultantId);
    
    try {
      const prompt = this.buildAdvancementPrompt(params);
      
      const response = await Promise.race([
        aiClient.generateContent({
          model: this.MODEL,
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0,
            maxOutputTokens: 800,
          }
        }),
        this.timeout(this.TIMEOUT_MS)
      ]);
      
      if (!response || typeof response === 'string') {
        return { shouldAdvance: false, nextPhaseId: null, nextStepId: null, confidence: 0, reasoning: 'Timeout' };
      }
      
      const responseText = response.response.text();
      return this.parseAdvancementResponse(responseText, params);
      
    } finally {
      if (cleanup) await cleanup();
    }
  }
  
  /**
   * Build prompt for step advancement analysis
   */
  private static buildAdvancementPrompt(params: SalesManagerParams): string {
    const { recentMessages, script, currentPhaseId, currentStepId, currentPhaseIndex, currentStepIndex } = params;
    
    const currentPhase = script.phases.find(p => p.id === currentPhaseId);
    const currentStep = currentPhase?.steps.find(s => s.id === currentStepId);
    
    const { nextPhase, nextStep, isLastStepOfPhase, isLastPhase } = this.getNextPosition(
      script, currentPhaseId, currentStepId, currentPhaseIndex, currentStepIndex
    );
    
    const messagesText = recentMessages
      .slice(-6)
      .map(m => `${m.role === 'user' ? 'PROSPECT' : 'AGENTE'}: ${m.content}`)
      .join('\n');
    
    const nextPhaseIdValue = nextPhase?.id || null;
    const nextStepIdValue = nextStep?.id || null;
    
    return `Sei un analizzatore di conversazioni di vendita.

📍 POSIZIONE ATTUALE:
- Fase: ${currentPhase?.name || currentPhaseId} (ID: ${currentPhaseId})
- Step: ${currentStep?.name || 'N/A'} (ID: ${currentStepId || 'null'})
- Obiettivo: ${currentStep?.objective || 'Non specificato'}

📍 PROSSIMA POSIZIONE (da usare se shouldAdvance=true):
${isLastPhase && isLastStepOfPhase ? '⚠️ ULTIMO STEP - non avanzare, usa shouldAdvance=false' : 
  `- Fase: ${nextPhase?.name || 'N/A'} (ID: "${nextPhaseIdValue}")
- Step: ${nextStep?.name || 'N/A'} (ID: "${nextStepIdValue}")`}

💬 ULTIMI MESSAGGI:
${messagesText}

🎯 DOMANDA: L'obiettivo dello step corrente è stato completato?

REGOLE:
1. DEVI vedere un messaggio PROSPECT dopo la domanda dell'agente
2. Se vedi solo messaggi AGENTE → shouldAdvance = false
3. Non assumere risposte non presenti
4. Se shouldAdvance=true, USA ESATTAMENTE questi IDs: nextPhaseId="${nextPhaseIdValue}", nextStepId="${nextStepIdValue}"

📤 RISPONDI SOLO JSON:
{"shouldAdvance":boolean,"nextPhaseId":"${nextPhaseIdValue}"|null,"nextStepId":"${nextStepIdValue}"|null,"reasoning":"string","confidence":number}`;
  }
  
  /**
   * Parse AI response for step advancement
   */
  private static parseAdvancementResponse(responseText: string, params: SalesManagerParams): {
    shouldAdvance: boolean;
    nextPhaseId: string | null;
    nextStepId: string | null;
    confidence: number;
    reasoning: string;
  } {
    console.log(`🤖 [SALES-MANAGER] Raw AI response (${responseText.length} chars):`, 
      responseText.substring(0, 300) + (responseText.length > 300 ? '...' : ''));
    
    try {
      let jsonText: string | null = null;
      
      const jsonMatch = responseText.match(/\{[\s\S]*?"shouldAdvance"[\s\S]*?\}/);
      if (jsonMatch) {
        jsonText = jsonMatch[0];
        console.log(`✅ [SALES-MANAGER] Extracted JSON via regex`);
      } else {
        let cleanText = responseText.trim();
        if (cleanText.startsWith('```json')) cleanText = cleanText.slice(7);
        if (cleanText.startsWith('```')) cleanText = cleanText.slice(3);
        if (cleanText.endsWith('```')) cleanText = cleanText.slice(0, -3);
        jsonText = cleanText.trim();
      }
      
      const parsed = JSON.parse(jsonText);
      
      const result = {
        shouldAdvance: Boolean(parsed.shouldAdvance),
        nextPhaseId: parsed.shouldAdvance ? (parsed.nextPhaseId || null) : null,
        nextStepId: parsed.shouldAdvance ? (parsed.nextStepId || null) : null,
        reasoning: String(parsed.reasoning || 'No reasoning'),
        confidence: Math.min(1, Math.max(0, Number(parsed.confidence) || 0.5))
      };
      
      console.log(`✅ [SALES-MANAGER] Parsed successfully: shouldAdvance=${result.shouldAdvance}, confidence=${result.confidence}`);
      return result;
      
    } catch (error: any) {
      console.error(`❌ [SALES-MANAGER] Parse error:`, error.message);
      console.error(`❌ [SALES-MANAGER] Full response was:`, responseText);
      
      const advanceMatch = responseText.match(/shouldAdvance["\s:]+(\w+)/i);
      const hasAdvance = advanceMatch && advanceMatch[1].toLowerCase() === 'true';
      
      if (advanceMatch) {
        console.log(`⚠️ [SALES-MANAGER] Fallback extraction: shouldAdvance=${hasAdvance}`);
        return {
          shouldAdvance: hasAdvance,
          nextPhaseId: null,
          nextStepId: null,
          reasoning: 'Extracted via fallback (JSON parse failed)',
          confidence: 0.3
        };
      }
      
      return {
        shouldAdvance: false,
        nextPhaseId: null,
        nextStepId: null,
        reasoning: `Failed to parse response: ${error.message}`,
        confidence: 0
      };
    }
  }
  
  /**
   * Get next position in script
   */
  private static getNextPosition(
    script: ScriptStructureForManager,
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
      if (isLastPhase) {
        return { nextPhase: null, nextStep: null, isLastStepOfPhase: true, isLastPhase: true };
      }
      const nextPhase = script.phases[currentPhaseIndex + 1];
      const nextStep = nextPhase?.steps[0] || null;
      return { nextPhase, nextStep, isLastStepOfPhase: true, isLastPhase: false };
    } else {
      const nextStep = currentPhase.steps[currentStepIndex + 1];
      return { nextPhase: currentPhase, nextStep, isLastStepOfPhase: false, isLastPhase: false };
    }
  }
  
  /**
   * Timeout promise
   */
  private static timeout(ms: number): Promise<string> {
    return new Promise((resolve) => {
      setTimeout(() => resolve('timeout'), ms);
    });
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// BACKWARDS COMPATIBILITY - Export for existing code
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export type { SalesManagerParams as StepAdvancementParams };
export type StepAdvancementResult = SalesManagerAnalysis['stepAdvancement'] & {
  feedbackForAgent?: {
    shouldInject: boolean;
    correctionMessage: string;
    toneReminder?: string;
    priority: 'low' | 'medium' | 'high';
  };
};
