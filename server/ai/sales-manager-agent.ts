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

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TYPES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export type BuySignalType = 'price_inquiry' | 'timeline' | 'interest' | 'commitment' | 'comparison';
export type ObjectionType = 'no_time' | 'need_to_think' | 'too_expensive' | 'not_interested' | 'competitor' | 'timing' | 'authority' | 'other';
export type FeedbackPriority = 'critical' | 'high' | 'medium' | 'low';
export type FeedbackType = 'correction' | 'buy_signal' | 'objection' | 'checkpoint' | 'tone' | 'advancement';

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
    
    console.log(`\n🎩 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`🎩 [SALES-MANAGER] Starting comprehensive analysis`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`   📍 Current: ${params.currentPhaseId} / ${params.currentStepId || 'N/A'}`);
    console.log(`   💬 Messages: ${params.recentMessages.length}`);
    
    // 1. Quick local analysis (no AI call needed)
    const buySignals = this.detectBuySignals(params.recentMessages);
    const objections = this.detectObjections(params.recentMessages, params.script.objections);
    const toneAnalysis = this.analyzeTone(params.recentMessages, params.currentPhaseEnergy);
    const checkpointStatus = this.validateCheckpoint(params);
    
    console.log(`   💰 Buy signals: ${buySignals.detected ? buySignals.signals.length : 0}`);
    console.log(`   🛡️ Objections: ${objections.detected ? objections.objections.length : 0}`);
    console.log(`   🎭 Tone issues: ${toneAnalysis.issues.length}`);
    console.log(`   ⛔ Checkpoint: ${checkpointStatus?.isComplete ? 'COMPLETE' : checkpointStatus?.missingItems.length + ' missing' || 'N/A'}`);
    
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
    
    // Priority order: Critical corrections > Buy signals > Objections > Tone > Checkpoint > Advancement
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
      // High priority: buy signal to capitalize
      const topSignal = buySignals.signals[0];
      feedbackForAgent = {
        shouldInject: true,
        priority: 'high',
        type: 'buy_signal',
        message: `💰 SEGNALE DI ACQUISTO: "${topSignal.phrase}" (${topSignal.type})\n→ ${topSignal.suggestedAction}`,
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
        
        // If AI suggests feedback and we don't have higher priority feedback
        if (!feedbackForAgent && stepAdvancement.reasoning.includes('PROBLEMA')) {
          feedbackForAgent = {
            shouldInject: true,
            priority: 'medium',
            type: 'advancement',
            message: stepAdvancement.reasoning,
            toneReminder: params.currentPhaseEnergy ? 
              `Tono ${params.currentPhaseEnergy.tone}` : undefined
          };
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
    
    // Check last message length
    const lastAiMessage = aiMessages[aiMessages.length - 1];
    if (lastAiMessage && lastAiMessage.content.length > 500) {
      lastMessageTooLong = true;
      issues.push(`Messaggio troppo lungo (${lastAiMessage.content.length} caratteri)`);
      isRobotic = true;
    }
    
    // Check if AI is not responding to user questions
    const lastUserMessage = messages.filter(m => m.role === 'user').pop();
    if (lastUserMessage) {
      const hasQuestion = lastUserMessage.content.includes('?');
      const lastAiDoesntAnswer = lastAiMessage && 
        !lastAiMessage.content.toLowerCase().includes('sì') &&
        !lastAiMessage.content.toLowerCase().includes('no') &&
        !lastAiMessage.content.toLowerCase().includes('certo') &&
        !lastAiMessage.content.toLowerCase().includes('capisco');
      
      if (hasQuestion && lastAiDoesntAnswer) {
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
   * Validate checkpoint completion (local, fast)
   */
  private static validateCheckpoint(params: SalesManagerParams): CheckpointStatus | null {
    const currentPhase = params.script.phases.find(p => p.id === params.currentPhaseId);
    if (!currentPhase?.checkpoint) return null;
    
    const checkpoint = currentPhase.checkpoint;
    const completedItems: string[] = [];
    const missingItems: string[] = [];
    
    // Simple keyword-based check for checkpoint items
    const allMessages = params.recentMessages.map(m => m.content.toLowerCase()).join(' ');
    
    for (const check of checkpoint.checks) {
      // Extract keywords from check
      const keywords = check.toLowerCase()
        .replace(/[?¿!¡.,;:]/g, '')
        .split(' ')
        .filter(w => w.length > 3);
      
      // Check if at least 50% of keywords are mentioned
      const matchedKeywords = keywords.filter(kw => allMessages.includes(kw));
      const matchRatio = matchedKeywords.length / keywords.length;
      
      if (matchRatio >= 0.5) {
        completedItems.push(check);
      } else {
        missingItems.push(check);
      }
    }
    
    const isComplete = missingItems.length === 0;
    
    return {
      checkpointId: checkpoint.id,
      checkpointName: checkpoint.title,
      isComplete,
      missingItems,
      completedItems,
      canAdvance: isComplete
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
