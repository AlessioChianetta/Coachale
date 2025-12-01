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
// 6. 🎭 PROSPECT PROFILING - classifica archetipi e adatta strategia (NEW!)
//
// Usa Vertex AI con le credenziali del consultant
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import { getAIProvider } from "./provider-factory";
import { StepAdvancementAgent, type CheckpointAnalysisResult } from "./step-advancement-agent";
import { 
  type ArchetypeId, 
  type TTSParams,
  type ArchetypePlaybook,
  ARCHETYPE_PATTERNS, 
  ARCHETYPE_PLAYBOOKS, 
  ANTI_PATTERNS,
  getPlaybookById,
  getRandomFiller,
  formatArchetypeTag,
  getToneOnlyFeedback
} from "@shared/archetype-playbooks";

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

/**
 * Dettaglio di ogni singola verifica del checkpoint (importato da step-advancement-agent)
 */
export interface CheckpointItemDetail {
  check: string;
  status: 'validated' | 'missing' | 'vague';
  infoCollected?: string;
  reason?: string;
  evidenceQuote?: string;
}

/**
 * Quality Score per valutare la qualità delle informazioni raccolte
 */
export interface CheckpointQualityScore {
  specificity: number;
  completeness: number;
  actionability: number;
  overall: number;
}

export interface CheckpointStatus {
  checkpointId: string;
  checkpointName: string;
  isComplete: boolean;
  missingItems: string[];
  completedItems: string[];
  canAdvance: boolean;
  // 🆕 Nuovi campi per checkpoint semantici
  itemDetails?: CheckpointItemDetail[];
  qualityScore?: CheckpointQualityScore;
  phaseNumber?: string;
  totalChecks?: number;
  validatedCount?: number;
  missingCount?: number;
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

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 🎭 PROSPECT PROFILING TYPES (NEW!)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export interface ArchetypeState {
  current: ArchetypeId;
  confidence: number;
  consecutiveSignals: number;
  lastUpdatedAtTurn: number;
  turnsSinceUpdate: number;
  lastSignalType: ArchetypeId | null;
  regexSignals: ArchetypeId[];  // Segnali da regex (Fast Reflexes)
  aiIntuition: ArchetypeId | null;  // Intuizione AI (Slow Brain)
  lastInjectionTurn: number;  // Ultimo turno in cui l'archetipo è stato iniettato (per throttling)
  lastInjectedArchetype: ArchetypeId | null;  // 🆕 Ultimo archetipo iniettato (per evitare ripetizioni)
}

export interface ProspectProfilingResult {
  archetype: ArchetypeId;
  confidence: number;
  regexSignals: { archetype: ArchetypeId; patterns: string[]; score: number }[];
  aiIntuition: { archetype: ArchetypeId; reasoning: string } | null;
  filler: string;
  instruction: string;
  ttsParams: TTSParams;
  antiPatternDetected: { id: string; instruction: string } | null;
}

export interface AgentInstruction {
  filler: string;
  instruction: string;
  priority: 'critical' | 'high' | 'normal';
  archetypeTag: string;
}

export interface ProfilingLog {
  archetype: ArchetypeId;
  confidence: number;
  regexSignals: string[];
  aiIntuition: string | null;
  antiPatterns: string[];
  analysisTimeMs: number;
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
  
  // 🆕 Prospect Profiling Result
  profilingResult: ProspectProfilingResult | null;
  
  // 🆕 Updated archetype state (for persistence)
  archetypeState: ArchetypeState | null;
  
  // 🆕 TTS Parameters (separate output for voice engine)
  ttsParams: TTSParams | null;
  
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
  // 🆕 Archetype state persistente (per sticky archetype logic)
  archetypeState?: ArchetypeState;
  // 🆕 Current turn number (per decidere se ricalcolare archetipo)
  currentTurn?: number;
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
// 🎭 PROSPECT PROFILING FUNCTIONS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Approccio "Fast Reflexes, Slow Brain":
// - Regex: Scansione istantanea per segnali preliminari (~5ms)
// - AI Intuition: Conferma/smentisce basandosi sul contesto (nel prompt)
// - AI > Regex quando c'è conflitto (l'AI capisce negazioni/sarcasmo)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * 🚀 FAST REFLEXES: Rileva segnali archetipo via regex (istantaneo)
 * Ritorna tutti i pattern matchati con il loro peso
 */
function detectArchetypeSignalsRegex(messages: ConversationMessage[]): { 
  archetype: ArchetypeId; 
  patterns: string[]; 
  score: number 
}[] {
  const signals: Map<ArchetypeId, { patterns: string[]; score: number }> = new Map();
  
  const prospectMessages = messages
    .filter(m => m.role === 'user')
    .slice(-4)
    .map(m => m.content);
  
  const allProspectText = prospectMessages.join(' ');
  
  for (const patternDef of ARCHETYPE_PATTERNS) {
    let matchedPatterns: string[] = [];
    let isNegated = false;
    
    if (patternDef.negationPatterns) {
      for (const negPattern of patternDef.negationPatterns) {
        if (negPattern.test(allProspectText)) {
          isNegated = true;
          break;
        }
      }
    }
    
    if (isNegated) continue;
    
    for (const pattern of patternDef.patterns) {
      const match = allProspectText.match(pattern);
      if (match) {
        matchedPatterns.push(match[0]);
      }
    }
    
    if (matchedPatterns.length > 0) {
      const score = Math.min(1, matchedPatterns.length * patternDef.weight);
      signals.set(patternDef.archetype, {
        patterns: matchedPatterns,
        score
      });
    }
  }
  
  return Array.from(signals.entries())
    .map(([archetype, data]) => ({ archetype, ...data }))
    .sort((a, b) => b.score - a.score);
}

/**
 * 🔍 Rileva anti-pattern critici (domande ripetute, richieste ignorate, etc.)
 * Ritorna l'anti-pattern più critico trovato, se presente
 */
function detectAntiPatterns(
  messages: ConversationMessage[]
): { id: string; name: string; priority: 'critical' | 'high' | 'medium'; instruction: string } | null {
  const prospectMessages = messages.filter(m => m.role === 'user');
  const lastProspectMessage = prospectMessages[prospectMessages.length - 1];
  
  if (!lastProspectMessage) return null;
  
  for (const antiPattern of ANTI_PATTERNS) {
    for (const trigger of antiPattern.prospectTriggers) {
      if (trigger.test(lastProspectMessage.content)) {
        console.log(`\n🚨 [ANTI-PATTERN] Detected: ${antiPattern.name}`);
        console.log(`   Trigger: "${lastProspectMessage.content.substring(0, 50)}..."`);
        return {
          id: antiPattern.id,
          name: antiPattern.name,
          priority: antiPattern.priority,
          instruction: antiPattern.instruction
        };
      }
    }
  }
  
  const agentMessages = messages.filter(m => m.role === 'assistant').slice(-4);
  if (agentMessages.length >= 2) {
    const questions = agentMessages
      .map(m => {
        const match = m.content.match(/[^.!?]*\?/g);
        return match ? match.join(' ') : '';
      })
      .filter(q => q.length > 10);
    
    if (questions.length >= 2) {
      for (let i = 0; i < questions.length - 1; i++) {
        for (let j = i + 1; j < questions.length; j++) {
          const similarity = calculateJaccardSimilarity(questions[i], questions[j]);
          if (similarity > 0.65) {
            console.log(`\n🚨 [ANTI-PATTERN] Detected: REPEATED_QUESTION (similarity: ${(similarity * 100).toFixed(0)}%)`);
            console.log(`   Q1: "${questions[i].substring(0, 40)}..."`);
            console.log(`   Q2: "${questions[j].substring(0, 40)}..."`);
            return {
              id: 'repeated_question_detected',
              name: 'Domanda Ripetuta (Auto-detected)',
              priority: 'critical',
              instruction: `🚨 STOP! Stai ripetendo domande simili. Il prospect potrebbe sentirsi non ascoltato.
Riformula COMPLETAMENTE la tua prossima domanda o avanza nello script.
VIETATO fare la stessa domanda con parole diverse!`
            };
          }
        }
      }
    }
  }
  
  return null;
}

/**
 * Calcola similarità Jaccard tra due stringhe (per rilevare domande ripetute)
 */
function calculateJaccardSimilarity(str1: string, str2: string): number {
  const words1 = new Set(str1.toLowerCase().replace(/[?.,!]/g, '').split(/\s+/).filter(w => w.length > 2));
  const words2 = new Set(str2.toLowerCase().replace(/[?.,!]/g, '').split(/\s+/).filter(w => w.length > 2));
  
  const intersection = new Set([...words1].filter(x => words2.has(x)));
  const union = new Set([...words1, ...words2]);
  
  return union.size > 0 ? intersection.size / union.size : 0;
}

/**
 * 🧠 STICKY ARCHETYPE: Aggiorna lo stato dell'archetipo con logica di inerzia
 * Evita cambi troppo frequenti (anti-schizofrenia)
 * 
 * Regole:
 * - Cambio permesso SE: confidence > 0.8 OPPURE 2+ segnali consecutivi
 * - Altrimenti: mantieni archetipo precedente
 * - Ricalcola solo ogni 3-4 turni O se anomalia forte
 * 
 * 🆕 FALLBACK MODE: Quando forceRegexFallback=true (AI non chiamata per feedback critico),
 * le soglie vengono abbassate per permettere update con solo regex signals
 */
function updateArchetypeState(
  currentState: ArchetypeState | undefined,
  regexSignals: { archetype: ArchetypeId; patterns: string[]; score: number }[],
  aiIntuition: ArchetypeId | null,
  currentTurn: number,
  forceRegexFallback: boolean = false
): ArchetypeState {
  const defaultState: ArchetypeState = {
    current: 'neutral',
    confidence: 0.5,
    consecutiveSignals: 0,
    lastUpdatedAtTurn: currentTurn,
    turnsSinceUpdate: 0,
    lastSignalType: null,
    regexSignals: [],
    aiIntuition: null,
    lastInjectionTurn: 0,
    lastInjectedArchetype: null  // 🆕 Per evitare ripetizioni feedback
  };
  
  if (!currentState) {
    currentState = defaultState;
  }
  
  const turnsSinceUpdate = currentTurn - currentState.lastUpdatedAtTurn;
  
  if (turnsSinceUpdate < 3 && regexSignals.length === 0 && !aiIntuition && !forceRegexFallback) {
    return {
      ...currentState,
      turnsSinceUpdate
    };
  }
  
  let detectedArchetype: ArchetypeId = 'neutral';
  let confidence = 0.5;
  
  if (aiIntuition) {
    detectedArchetype = aiIntuition;
    confidence = 0.85;
    
    if (regexSignals.length > 0 && regexSignals[0].archetype === aiIntuition) {
      confidence = Math.min(0.98, confidence + regexSignals[0].score * 0.15);
    }
    
    console.log(`   🧠 AI Intuition WINS: ${aiIntuition} (confidence: ${(confidence * 100).toFixed(0)}%)`);
  } else if (regexSignals.length > 0) {
    detectedArchetype = regexSignals[0].archetype;
    confidence = regexSignals[0].score;
    
    // 🆕 FALLBACK: Se AI saltata, aumenta confidence dei regex signals (1.5x)
    if (forceRegexFallback) {
      confidence = Math.min(0.85, confidence * 1.5);
      console.log(`   ⚡ REGEX FALLBACK (AI skipped): ${detectedArchetype} (boosted score: ${(confidence * 100).toFixed(0)}%)`);
    } else {
      console.log(`   ⚡ Regex Signal: ${detectedArchetype} (score: ${(confidence * 100).toFixed(0)}%)`);
    }
  }
  
  let consecutiveSignals = currentState.consecutiveSignals;
  if (detectedArchetype === currentState.lastSignalType) {
    consecutiveSignals++;
  } else {
    consecutiveSignals = 1;
  }
  
  // 🆕 FALLBACK: Soglie ridotte quando AI non disponibile
  const confidenceThreshold = forceRegexFallback ? 0.6 : 0.8;
  const consecutiveThreshold = forceRegexFallback ? 1 : 2;
  
  const shouldChange = 
    (confidence > confidenceThreshold) || 
    (consecutiveSignals >= consecutiveThreshold && confidence > 0.5);
  
  if (shouldChange && detectedArchetype !== currentState.current) {
    console.log(`   🔄 ARCHETYPE CHANGE: ${currentState.current} → ${detectedArchetype}`);
    console.log(`      Reason: confidence=${(confidence * 100).toFixed(0)}%, consecutive=${consecutiveSignals}${forceRegexFallback ? ' (FALLBACK MODE)' : ''}`);
    
    return {
      current: detectedArchetype,
      confidence,
      consecutiveSignals,
      lastUpdatedAtTurn: currentTurn,
      turnsSinceUpdate: 0,
      lastSignalType: detectedArchetype,
      regexSignals: regexSignals.map(s => s.archetype),
      aiIntuition,
      lastInjectionTurn: currentState.lastInjectionTurn,
      lastInjectedArchetype: currentState.lastInjectedArchetype  // 🆕 Preserva per evitare ripetizioni
    };
  }
  
  return {
    ...currentState,
    confidence: Math.max(currentState.confidence, confidence * 0.7),
    consecutiveSignals,
    turnsSinceUpdate,
    lastSignalType: detectedArchetype !== 'neutral' ? detectedArchetype : currentState.lastSignalType,
    regexSignals: regexSignals.map(s => s.archetype),
    aiIntuition,
    lastInjectionTurn: currentState.lastInjectionTurn,
    lastInjectedArchetype: currentState.lastInjectedArchetype  // 🆕 Preserva per evitare ripetizioni
  };
}

/**
 * 📝 Genera l'istruzione per l'Agent basata sull'archetipo
 * 🆕 FIX: Ora usa SOLO feedback sul TONO - ZERO istruzioni su cosa fare o dove andare nello script!
 * Il feedback contiene solo: energia vocale, tono, ritmo, stile comunicativo
 */
function generateArchetypeInstruction(
  archetype: ArchetypeId,
  antiPattern: { id: string; instruction: string } | null
): { filler: string; instruction: string; ttsParams: TTSParams } {
  const playbook = getPlaybookById(archetype);
  const filler = getRandomFiller(archetype);
  
  // 🆕 USA SOLO feedback sul TONO - MAI istruzioni script!
  // Questo previene che l'AI salti fasi o avanzi prematuramente
  const toneOnlyFeedback = getToneOnlyFeedback(archetype);
  
  // AntiPattern ha SEMPRE priorità (sono correzioni critiche di comportamento)
  // Gli antipattern riguardano errori comportamentali, non flow dello script
  if (antiPattern) {
    return {
      filler,
      instruction: antiPattern.instruction,
      ttsParams: playbook.ttsParams
    };
  }
  
  // 🆕 Ritorna SOLO feedback sul tono, MAI istruzioni su cosa chiedere
  return {
    filler,
    instruction: toneOnlyFeedback,
    ttsParams: playbook.ttsParams
  };
}

/**
 * 🧠 Genera il prompt di intuizione psicologica per il Manager
 * Questo viene incluso nel prompt standard del Manager, NON è una chiamata extra
 */
function getAIIntuitionPrompt(): string {
  return `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🧠 INTUIZIONE PSICOLOGICA (Analizza il Prospect)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Mentre analizzi lo script, usa la tua INTUIZIONE PSICOLOGICA.
IGNORA le keyword se il CONTESTO suggerisce altro.

ESEMPI DI SOVRASCRITTURA (AI > Regex):
- "Il prezzo non è un problema" → È ENTUSIASTA, non PRICE_FOCUSED
- "Non ho tempo di ascoltare sciocchezze" → È SCETTICO, non solo FRETTOLOSO
- "Sì, certo..." (sarcastico) → È SCETTICO, non ENTUSIASTA
- "Devo pensarci... ma mi interessa molto!" → È ENTUSIASTA, non INDECISO

ARCHETIPI DISPONIBILI:
- SKEPTIC (Scettico): Diffidente, vuole prove, ha avuto brutte esperienze
- BUSY (Frettoloso): Non ha tempo, vuole sintesi estrema
- PRICE_FOCUSED (Focus Prezzo): Tutto ruota intorno al costo
- TECHNICAL (Tecnico): Vuole dettagli tecnici e specifiche
- ENTHUSIAST (Entusiasta): Positivo, interessato, va guidato al closing
- INDECISIVE (Indeciso): Tentenna, ha paura di sbagliare
- DEFENSIVE (Difensivo): È stato scottato, alza barriere
- NEUTRAL (Neutro): Non ci sono segnali chiari

Nel tuo output JSON, includi:
"detected_archetype": "skeptic|busy|price_focused|technical|enthusiast|indecisive|defensive|neutral",
"archetype_reasoning": "Breve spiegazione del perché (max 20 parole)"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SALES MANAGER AGENT
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export class SalesManagerAgent {
  private static readonly MODEL = "gemini-2.5-flash-lite";
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
    
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 🎭 PROSPECT PROFILING - FAST REFLEXES (Regex Detection)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    const currentTurn = params.currentTurn || params.recentMessages.length;
    
    // 🚀 FAST REFLEXES: Regex detection (istantaneo, ~5ms)
    const regexSignals = detectArchetypeSignalsRegex(params.recentMessages);
    
    // 🔍 ANTI-PATTERN CHECK: Priorità massima
    const antiPatternDetected = detectAntiPatterns(params.recentMessages);
    
    // L'AI intuition verrà estratta dalla risposta dell'analyzeStepAdvancement (Slow Brain)
    // Inizializziamo come null, verrà aggiornato dopo la chiamata AI
    let aiIntuition: ArchetypeId | null = null;
    let aiIntuitionReasoning: string | null = null;
    
    // Placeholder per variabili che verranno aggiornate dopo la chiamata AI
    let updatedArchetypeState: ArchetypeState;
    let archetypeInstruction: { filler: string; instruction: string; ttsParams: TTSParams };
    let profilingResult: ProspectProfilingResult;
    
    console.log(`   💰 Buy signals: ${buySignals.detected ? buySignals.signals.length : 0}`);
    console.log(`   🛡️ Objections: ${objections.detected ? objections.objections.length : 0}`);
    console.log(`   🎭 Tone issues: ${toneAnalysis.issues.length}`);
    console.log(`   🎯 Control: ${controlAnalysis.isLosingControl ? `LOSING (${controlAnalysis.consecutiveProspectQuestions} prospect Q)` : 'OK'}`);
    console.log(`   👤 Business: ${businessCtx?.identity || 'N/A'}`);
    
    // 🆕 LOG CHECKPOINT DETTAGLIATO nel formato richiesto
    if (checkpointStatus) {
      const phaseNum = params.currentPhaseId.replace('phase_', '').replace(/_/g, '');
      const totalChecks = checkpointStatus.totalChecks || (checkpointStatus.completedItems.length + checkpointStatus.missingItems.length);
      const validatedCount = checkpointStatus.validatedCount || checkpointStatus.completedItems.length;
      const missingCount = checkpointStatus.missingCount || checkpointStatus.missingItems.length;
      
      console.log(`\n   ⛔ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`   ⛔ CHECKPOINT FASE #${phaseNum}: "${checkpointStatus.checkpointName}"`);
      console.log(`   ⛔ DOMANDE DA FARE: ${validatedCount}/${totalChecks} completate`);
      console.log(`   ⛔ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      
      // Mostra dettaglio di ogni check
      if (checkpointStatus.itemDetails && checkpointStatus.itemDetails.length > 0) {
        checkpointStatus.itemDetails.forEach((item, idx) => {
          const icon = item.status === 'validated' ? '✓' : item.status === 'vague' ? '◐' : '✗';
          const color = item.status === 'validated' ? '🟢' : item.status === 'vague' ? '🟡' : '🔴';
          console.log(`   ${color} ${icon} [${idx + 1}] ${item.check}`);
          if (item.reason && item.status !== 'validated') {
            console.log(`        └─ Motivo: ${item.reason.substring(0, 60)}${item.reason.length > 60 ? '...' : ''}`);
          }
        });
      } else {
        // Fallback: mostra completati e mancanti separatamente
        checkpointStatus.completedItems.forEach((item, idx) => {
          console.log(`   🟢 ✓ [${idx + 1}] ${item}`);
        });
        checkpointStatus.missingItems.forEach((item, idx) => {
          console.log(`   🔴 ✗ [${checkpointStatus.completedItems.length + idx + 1}] ${item}`);
        });
      }
      
      console.log(`   ⛔ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`   ⛔ STATO: ${checkpointStatus.canAdvance ? '✅ PUÒ AVANZARE' : '🚫 BLOCCO ATTIVO - NON PUÒ AVANZARE'}`);
      console.log(`   ⛔ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
    } else {
      console.log(`   ⛔ Checkpoint: N/A (nessun checkpoint definito per questa fase)`);
    }
    if (regexSignals.length > 0) {
      console.log(`   ⚡ Regex Signals: ${regexSignals.map(s => `${s.archetype}(${(s.score * 100).toFixed(0)}%)`).join(', ')}`);
    }
    if (antiPatternDetected) {
      console.log(`   🚨 Anti-Pattern: ${antiPatternDetected.name} (${antiPatternDetected.priority})`);
    }
    
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
    
    // Priority order: Tone > Checkpoint > Advancement
    // 🆕 L'identità business (chi sei, cosa fai, cosa NON fai) viene SEMPRE inclusa nel feedbackContent
    // e Gemini decide semanticamente se una richiesta è fuori scope
    // 🚨 RIMOSSO: Feedback "OBIEZIONE RILEVATA" - non guidiamo lo script con suggerimenti!
    // 🚨 RIMOSSO: Feedback "SEGNALE DI ACQUISTO" - non guidiamo lo script con suggerimenti!
    // Buy signals e Obiezioni vengono ancora RILEVATE per logging/analytics ma NON generano feedback all'agent
    if (controlAnalysis.isLosingControl) {
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
      // 🆕 Genera suggerimenti CONCRETI basati sui check mancanti
      const missingChecks = checkpointStatus.itemDetails
        ?.filter(item => item.status !== 'validated')
        .slice(0, 3) || [];
      
      // Crea suggerimenti actionable basati sui check mancanti
      const suggestions = missingChecks.map(item => {
        const check = item.check.toLowerCase();
        // Genera suggerimento concreto basato sul tipo di check
        if (check.includes('salutato') || check.includes('come stai')) {
          return '→ Chiedi al prospect come sta e da dove chiama';
        } else if (check.includes('problema') || check.includes('difficoltà')) {
          return '→ Scava più a fondo: "Qual è il problema SPECIFICO che vuoi risolvere?"';
        } else if (check.includes('budget') || check.includes('investimento')) {
          return '→ Chiedi: "Hai già un\'idea del budget che vorresti investire?"';
        } else if (check.includes('decisore') || check.includes('decide')) {
          return '→ Chiedi: "Sei tu a decidere o devi consultare qualcuno?"';
        } else if (check.includes('urgenza') || check.includes('quando')) {
          return '→ Chiedi: "Quanto è urgente per te risolvere questa situazione?"';
        } else if (check.includes('obiettivo') || check.includes('risultato')) {
          return '→ Chiedi: "Qual è il risultato specifico che vuoi raggiungere?"';
        } else if (check.includes('tentato') || check.includes('provato')) {
          return '→ Chiedi: "Cosa hai già provato finora per risolvere questo problema?"';
        } else if (check.includes('processo') || check.includes('call')) {
          return '→ Spiega cosa farete insieme in questa chiamata';
        } else if (check.includes('ok') || check.includes('sì') || check.includes('va bene')) {
          return '→ Ottieni conferma dal prospect prima di procedere';
        } else {
          // Fallback: usa il check originale come suggerimento
          return `→ ${item.check.substring(0, 60)}${item.check.length > 60 ? '...' : ''}`;
        }
      });
      
      const uniqueSuggestions = [...new Set(suggestions)].slice(0, 3);
      
      feedbackForAgent = {
        shouldInject: true,
        priority: 'medium',
        type: 'checkpoint',
        message: `🎯 PROSSIMI PASSI:\n${uniqueSuggestions.join('\n')}`,
      };
    }
    
    // 4. Call AI for step advancement analysis (if no critical issues)
    // 🆕 L'AI ora rileva anche l'archetipo del prospect (Slow Brain)
    if (!feedbackForAgent || feedbackForAgent.priority !== 'critical') {
      try {
        const aiAnalysis = await this.analyzeStepAdvancement(params);
        
        stepAdvancement = {
          shouldAdvance: aiAnalysis.shouldAdvance,
          nextPhaseId: aiAnalysis.nextPhaseId,
          nextStepId: aiAnalysis.nextStepId,
          confidence: aiAnalysis.confidence,
          reasoning: aiAnalysis.reasoning
        };
        
        // 🧠 SLOW BRAIN: Estrai l'archetipo rilevato dall'AI
        if (aiAnalysis.detectedArchetype) {
          aiIntuition = aiAnalysis.detectedArchetype;
          aiIntuitionReasoning = aiAnalysis.archetypeReasoning;
          console.log(`   🧠 AI Intuition: ${aiIntuition} - "${aiIntuitionReasoning || 'no reasoning'}"`);
        }
        
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
    
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 🚫 GATEKEEPING LOGIC - CHECKPOINT SEMANTICI BLOCCANTI
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // Questa logica blocca FORZATAMENTE l'avanzamento alla fase successiva
    // se il checkpoint della fase corrente non è stato validato.
    // Il blocco si applica SOLO alla transizione di FASE (non tra step)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    
    const currentPhase = params.script.phases.find(p => p.id === params.currentPhaseId);
    const currentStepIndex = currentPhase?.steps.findIndex(s => s.id === params.currentStepId) ?? -1;
    const isLastStepOfPhase = currentStepIndex >= (currentPhase?.steps.length ?? 0) - 1;
    const isPhaseTransition = stepAdvancement.shouldAdvance && isLastStepOfPhase && 
                              stepAdvancement.nextPhaseId !== params.currentPhaseId;
    
    if (isPhaseTransition && checkpointStatus && !checkpointStatus.canAdvance) {
      // 🚫 BLOCCO FORZATO: L'AI vuole avanzare ma il checkpoint non è completo
      const phaseNum = params.currentPhaseId.replace('phase_', '').replace(/_/g, '');
      const totalChecks = checkpointStatus.completedItems.length + checkpointStatus.missingItems.length;
      const validatedCount = checkpointStatus.completedItems.length;
      const missingCount = checkpointStatus.missingItems.length;
      
      // Log BLOCCO nel formato visibile
      console.log(`\n🚫🚫🚫🚫🚫🚫🚫🚫🚫🚫🚫🚫🚫🚫🚫🚫🚫🚫🚫🚫🚫🚫🚫🚫🚫🚫🚫🚫🚫🚫`);
      console.log(`🚫 BLOCCO TRANSIZIONE FASE #${phaseNum} → ${stepAdvancement.nextPhaseId}`);
      console.log(`🚫 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`🚫 CHECKPOINT NON COMPLETATO: "${checkpointStatus.checkpointName}"`);
      console.log(`🚫 Progress: ${validatedCount}/${totalChecks} verifiche completate`);
      console.log(`🚫 Mancanti: ${missingCount} verifiche obbligatorie`);
      if (checkpointStatus.missingItems.length > 0) {
        console.log(`🚫 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        checkpointStatus.missingItems.slice(0, 5).forEach((item, i) => {
          console.log(`🚫 ✗ ${i + 1}. ${item}`);
        });
        if (checkpointStatus.missingItems.length > 5) {
          console.log(`🚫   ... e altre ${checkpointStatus.missingItems.length - 5} verifiche`);
        }
      }
      console.log(`🚫🚫🚫🚫🚫🚫🚫🚫🚫🚫🚫🚫🚫🚫🚫🚫🚫🚫🚫🚫🚫🚫🚫🚫🚫🚫🚫🚫🚫🚫\n`);
      
      // 🚫 FORZA IL BLOCCO COMPLETO
      // Reimposta tutto sulla FASE/STEP CORRENTE per impedire qualsiasi avanzamento
      stepAdvancement.shouldAdvance = false;
      stepAdvancement.nextPhaseId = params.currentPhaseId;     // Rimani nella fase corrente
      stepAdvancement.nextStepId = params.currentStepId || null; // Rimani nello step corrente
      stepAdvancement.reasoning = `BLOCCATO DA CHECKPOINT: "${checkpointStatus.checkpointName}" non completato. Mancano ${missingCount} informazioni obbligatorie.`;
      stepAdvancement.confidence = 1; // 100% sicuri del blocco
      
      // Genera feedback dettagliato per l'agente
      const missingInfo = checkpointStatus.missingItems.slice(0, 3).map((item, i) => `${i+1}. ${item}`).join('\n');
      feedbackForAgent = {
        shouldInject: true,
        priority: 'critical',
        type: 'checkpoint',
        message: `BLOCCO CHECKPOINT FASE ${phaseNum} - NON PUOI PROCEDERE!

Progress: ${validatedCount}/${totalChecks} verifiche completate

INFORMAZIONI MANCANTI:
${missingInfo}${missingCount > 3 ? `\n... e altre ${missingCount - 3}` : ''}

AZIONE RICHIESTA:
Rimani nella conversazione attuale e ottieni queste informazioni PRIMA di poter passare alla fase successiva.`,
        toneReminder: 'Fai domande specifiche per raccogliere le informazioni mancanti!'
      };
    }
    
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 🎭 PROSPECT PROFILING - SLOW BRAIN (AI Intuition + State Update)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // Ora che abbiamo l'AI intuition, aggiorniamo lo stato dell'archetipo
    
    // 🆕 FALLBACK: Rileva se AI è stata saltata per feedback critico
    const aiWasSkipped = feedbackForAgent && feedbackForAgent.priority === 'critical' && !aiIntuition;
    if (aiWasSkipped && regexSignals.length > 0) {
      console.log(`   ⚠️ AI SKIPPED (critical feedback) - activating REGEX FALLBACK mode`);
    }
    
    // 🧠 STICKY ARCHETYPE: Aggiorna stato con logica di inerzia
    // Passa forceRegexFallback=true se AI saltata ma ci sono segnali regex
    updatedArchetypeState = updateArchetypeState(
      params.archetypeState,
      regexSignals,
      aiIntuition,
      currentTurn,
      aiWasSkipped && regexSignals.length > 0  // 🆕 forceRegexFallback
    );
    
    // 📝 GENERA ISTRUZIONE per l'Agent
    archetypeInstruction = generateArchetypeInstruction(
      updatedArchetypeState.current,
      antiPatternDetected ? { id: antiPatternDetected.id, instruction: antiPatternDetected.instruction } : null
    );
    
    // Build profiling result
    profilingResult = {
      archetype: updatedArchetypeState.current,
      confidence: updatedArchetypeState.confidence,
      regexSignals,
      aiIntuition: aiIntuition ? { archetype: aiIntuition, reasoning: aiIntuitionReasoning || 'From AI analysis' } : null,
      filler: archetypeInstruction.filler,
      instruction: archetypeInstruction.instruction,
      ttsParams: archetypeInstruction.ttsParams,
      antiPatternDetected: antiPatternDetected ? { id: antiPatternDetected.id, instruction: antiPatternDetected.instruction } : null
    };
    
    console.log(`   🎭 Final Archetype: ${formatArchetypeTag(updatedArchetypeState.current)} (${(updatedArchetypeState.confidence * 100).toFixed(0)}%)`);
    if (aiIntuition && aiIntuition !== regexSignals[0]?.archetype) {
      console.log(`      ⚡ Regex suggested: ${regexSignals[0]?.archetype || 'neutral'} → 🧠 AI overrode to: ${aiIntuition}`);
    }
    
    const analysisTimeMs = Date.now() - startTime;
    
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 🎭 TONE-ONLY FEEDBACK: Inietta SOLO quando archetipo CAMBIA
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // Regole FIX:
    // 1. AntiPattern critico → inietta SEMPRE (priorità massima)
    // 2. Archetype → inietta SOLO SE è CAMBIATO rispetto all'ultimo iniettato
    // 3. NON iniettare periodicamente se è lo stesso archetipo!
    // 4. Il feedback contiene SOLO indicazioni sul TONO, MAI istruzioni script
    
    const archetypeJustChanged = updatedArchetypeState.turnsSinceUpdate === 0;
    const isDifferentFromLastInjected = updatedArchetypeState.current !== (updatedArchetypeState.lastInjectedArchetype || 'neutral');
    
    // 🆕 FIX: Inietta SOLO SE archetipo è cambiato O è diverso dall'ultimo iniettato
    const shouldInjectArchetype = archetypeJustChanged || isDifferentFromLastInjected;
    
    if (antiPatternDetected && antiPatternDetected.priority === 'critical') {
      feedbackForAgent = {
        shouldInject: true,
        priority: 'critical',
        type: 'correction',
        message: `${archetypeInstruction.instruction}`,
        toneReminder: `Filler: "${archetypeInstruction.filler}"`
      };
    } else if (shouldInjectArchetype && updatedArchetypeState.current !== 'neutral' && updatedArchetypeState.confidence > 0.6) {
      const archetypeTag = formatArchetypeTag(updatedArchetypeState.current);
      const existingMessage = feedbackForAgent?.message || '';
      
      // 🆕 Feedback SOLO-TONO (nessuna istruzione script!)
      const profilingHeader = `🎭 ARCHETIPO: ${archetypeTag}
${archetypeInstruction.instruction}`;
      
      console.log(`   📢 ARCHETYPE INJECTION at turn ${currentTurn} (${archetypeJustChanged ? 'archetype just changed' : `different from last injected (${updatedArchetypeState.lastInjectedArchetype || 'none'})`})`);
      
      // 🆕 Aggiorna tracking dopo iniezione
      updatedArchetypeState.lastInjectionTurn = currentTurn;
      updatedArchetypeState.lastInjectedArchetype = updatedArchetypeState.current;  // 🆕 Traccia quale archetipo è stato iniettato
      
      if (feedbackForAgent) {
        feedbackForAgent.message = `${existingMessage}\n\n${profilingHeader}`;
        feedbackForAgent.toneReminder = `Adatta il tuo stile a ${archetypeTag}`;
      } else {
        feedbackForAgent = {
          shouldInject: true,
          priority: 'medium',
          type: 'tone',
          message: profilingHeader,
          toneReminder: `Adatta il tuo stile a ${archetypeTag}`
        };
      }
    } else if (updatedArchetypeState.current !== 'neutral') {
      // 🆕 Log: stesso archetipo già iniettato, skip
      console.log(`   🔇 ARCHETYPE SKIPPED at turn ${currentTurn} (stesso archetipo "${updatedArchetypeState.current}" già iniettato)`);
    }
    
    console.log(`\n🎩 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`🎩 [SALES-MANAGER] Analysis complete in ${analysisTimeMs}ms`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`   → Step advance: ${stepAdvancement.shouldAdvance} (${(stepAdvancement.confidence * 100).toFixed(0)}%)`);
    console.log(`   → Feedback: ${feedbackForAgent ? `${feedbackForAgent.type} (${feedbackForAgent.priority})` : 'none'}`);
    console.log(`   → Archetype: ${formatArchetypeTag(updatedArchetypeState.current)}`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
    
    return {
      stepAdvancement,
      buySignals,
      objections,
      checkpointStatus,
      toneAnalysis,
      feedbackForAgent,
      profilingResult,
      archetypeState: updatedArchetypeState,
      ttsParams: archetypeInstruction.ttsParams,
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
      console.log(`   📈 Quality Score: ${aiResult.qualityScore?.overall || 0}/10`);
      
      // 🆕 Ritorna tutti i nuovi campi per logging dettagliato
      return {
        checkpointId: checkpoint.id,
        checkpointName: checkpoint.title,
        isComplete: aiResult.isComplete,
        missingItems: aiResult.missingItems,
        completedItems: aiResult.completedItems,
        canAdvance: aiResult.canAdvance,
        itemDetails: aiResult.itemDetails,
        qualityScore: aiResult.qualityScore,
        phaseNumber: aiResult.phaseNumber,
        totalChecks: aiResult.totalChecks,
        validatedCount: aiResult.validatedCount,
        missingCount: aiResult.missingCount
      };
      
    } catch (error: any) {
      console.error(`❌ [SALES-MANAGER] AI checkpoint validation failed:`, error.message);
      
      // 🚫 NESSUN FALLBACK KEYWORD - Se AI fallisce, blocchiamo per sicurezza
      console.log(`🚫 [SALES-MANAGER] NO FALLBACK - Blocking advancement due to AI failure`);
      
      const phaseNumber = currentPhase.id.replace('phase_', '').replace(/_/g, '-');
      return {
        checkpointId: checkpoint.id,
        checkpointName: checkpoint.title,
        isComplete: false,
        missingItems: checkpoint.checks,
        completedItems: [],
        canAdvance: false, // BLOCCO per sicurezza
        itemDetails: checkpoint.checks.map(check => ({
          check,
          status: 'missing' as const,
          reason: `Validazione AI fallita: ${error.message}`
        })),
        qualityScore: { specificity: 0, completeness: 0, actionability: 0, overall: 0 },
        phaseNumber,
        totalChecks: checkpoint.checks.length,
        validatedCount: 0,
        missingCount: checkpoint.checks.length
      };
    }
  }
  
  // 🚫 KEYWORD FALLBACK RIMOSSO PER DESIGN
  // Per requisito utente, la validazione deve essere ESCLUSIVAMENTE semantica via AI.
  // Se l'AI fallisce, il sistema blocca l'avanzamento per sicurezza.
  // Nessun fallback keyword matching.
  
  
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
   * 🆕 Include anche l'intuizione psicologica per il Prospect Profiling
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
    
    return `Sei un analizzatore di conversazioni di vendita con intuizione psicologica.

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

${getAIIntuitionPrompt()}

🎯 COMPITI:
1. L'obiettivo dello step corrente è stato raggiunto O il prospect ha fornito una risposta (anche negativa/scettica)?
2. Qual è l'ARCHETIPO PSICOLOGICO del prospect basandoti sul CONTESTO e TONO?

REGOLE STEP (IMPORTANTE - LEGGI BENE):
1. DEVI vedere un messaggio PROSPECT dopo la domanda dell'agente
2. Se vedi solo messaggi AGENTE → shouldAdvance = false
3. Non assumere risposte non presenti
4. Se shouldAdvance=true, USA ESATTAMENTE questi IDs: nextPhaseId="${nextPhaseIdValue}", nextStepId="${nextStepIdValue}"

⚠️ REGOLA FONDAMENTALE - VERIFICA DOMANDE E QUALITÀ RISPOSTE:
- L'agente DEVE fare le domande previste per lo step corrente (vedi Obiettivo)
- Se l'agente SALTA domande fondamentali → shouldAdvance = FALSE
- La risposta del prospect deve essere ESAUSTIVA (non solo "ok", "sì", "va bene")
- Se la risposta è troppo breve o vaga → shouldAdvance = FALSE + feedback per approfondire
- Il reasoning deve essere SPECIFICO: quali domande fatte, quali mancano, qualità risposte
- Solo se TUTTE le domande fatte + risposte ESAUSTIVE → shouldAdvance = true

🚦 CHECKPOINT DI FASE (prima di passare a nuova fase):
- Se è l'ultimo step della fase, verifica INTERNAMENTE i checkpoint dello script
- Se manca qualcosa → shouldAdvance = FALSE + feedback NATURALE
- Feedback naturale: "Approfondisci questo aspetto" (NON dire "manca checkpoint"!)

REGOLE ARCHETIPO (IMPORTANTE):
- IGNORA le keyword se il CONTESTO suggerisce altro
- "Il prezzo non è un problema" → ENTHUSIAST, non PRICE_FOCUSED
- "Non ho tempo per queste sciocchezze" → SKEPTIC, non solo BUSY
- Sarcasmo ("sì, certo...") → SKEPTIC
- Se non sei sicuro → usa "neutral"

📤 RISPONDI SOLO JSON:
{"shouldAdvance":boolean,"nextPhaseId":"${nextPhaseIdValue}"|null,"nextStepId":"${nextStepIdValue}"|null,"reasoning":"string","confidence":number,"detected_archetype":"skeptic|busy|price_focused|technical|enthusiast|indecisive|defensive|neutral","archetype_reasoning":"breve spiegazione"}`;
  }
  
  /**
   * Parse AI response for step advancement
   * 🆕 Ora estrae anche l'archetipo rilevato dall'AI (Slow Brain)
   */
  private static parseAdvancementResponse(responseText: string, params: SalesManagerParams): {
    shouldAdvance: boolean;
    nextPhaseId: string | null;
    nextStepId: string | null;
    confidence: number;
    reasoning: string;
    detectedArchetype: ArchetypeId | null;
    archetypeReasoning: string | null;
  } {
    console.log(`🤖 [SALES-MANAGER] Raw AI response (${responseText.length} chars):`, 
      responseText.substring(0, 300) + (responseText.length > 300 ? '...' : ''));
    
    try {
      let jsonText: string | null = null;
      
      const startIdx = responseText.indexOf('{');
      const endIdx = responseText.lastIndexOf('}');
      
      if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
        jsonText = responseText.substring(startIdx, endIdx + 1);
        console.log(`✅ [SALES-MANAGER] Extracted JSON (${jsonText.length} chars)`);
      } else {
        let cleanText = responseText.trim();
        if (cleanText.startsWith('```json')) cleanText = cleanText.slice(7);
        if (cleanText.startsWith('```')) cleanText = cleanText.slice(3);
        if (cleanText.endsWith('```')) cleanText = cleanText.slice(0, -3);
        jsonText = cleanText.trim();
      }
      
      const parsed = JSON.parse(jsonText);
      
      const validArchetypes: ArchetypeId[] = ['skeptic', 'busy', 'price_focused', 'technical', 'enthusiast', 'indecisive', 'defensive', 'analytical', 'decision_maker', 'neutral'];
      let detectedArchetype: ArchetypeId | null = null;
      
      const rawArchetype = parsed.detected_archetype?.toLowerCase?.() || parsed.detectedArchetype?.toLowerCase?.();
      if (rawArchetype && validArchetypes.includes(rawArchetype)) {
        detectedArchetype = rawArchetype as ArchetypeId;
      }
      
      // Estrai l'archetype_reasoning dalla risposta AI
      const archetypeReasoningRaw = parsed.archetype_reasoning || parsed.archetypeReasoning || null;
      
      const result = {
        shouldAdvance: Boolean(parsed.shouldAdvance),
        nextPhaseId: parsed.shouldAdvance ? (parsed.nextPhaseId || null) : null,
        nextStepId: parsed.shouldAdvance ? (parsed.nextStepId || null) : null,
        reasoning: String(parsed.reasoning || 'No reasoning'),
        confidence: Math.min(1, Math.max(0, Number(parsed.confidence) || 0.5)),
        detectedArchetype,
        archetypeReasoning: archetypeReasoningRaw ? String(archetypeReasoningRaw) : null
      };
      
      console.log(`✅ [SALES-MANAGER] Parsed successfully: shouldAdvance=${result.shouldAdvance}, confidence=${result.confidence}`);
      if (detectedArchetype) {
        console.log(`   🧠 AI Archetype Intuition: ${detectedArchetype} - "${result.archetypeReasoning || 'no reason'}"`);
      }
      return result;
      
    } catch (error: any) {
      console.error(`❌ [SALES-MANAGER] Parse error:`, error.message);
      console.error(`❌ [SALES-MANAGER] Full response was:`, responseText);
      
      const advanceMatch = responseText.match(/shouldAdvance["\s:]+(\w+)/i);
      const hasAdvance = advanceMatch && advanceMatch[1].toLowerCase() === 'true';
      
      const archetypeMatch = responseText.match(/detected_archetype["\s:]+["']?(\w+)["']?/i);
      const extractedArchetype = archetypeMatch ? archetypeMatch[1].toLowerCase() as ArchetypeId : null;
      
      if (advanceMatch) {
        console.log(`⚠️ [SALES-MANAGER] Fallback extraction: shouldAdvance=${hasAdvance}`);
        return {
          shouldAdvance: hasAdvance,
          nextPhaseId: null,
          nextStepId: null,
          reasoning: 'Extracted via fallback (JSON parse failed)',
          confidence: 0.3,
          detectedArchetype: extractedArchetype,
          archetypeReasoning: null
        };
      }
      
      return {
        shouldAdvance: false,
        nextPhaseId: null,
        nextStepId: null,
        reasoning: `Failed to parse response: ${error.message}`,
        confidence: 0,
        detectedArchetype: null,
        archetypeReasoning: null
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
