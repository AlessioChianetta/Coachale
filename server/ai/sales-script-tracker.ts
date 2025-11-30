// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 🎯 SALES SCRIPT TRACKER SERVICE
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Tracks sales conversations in real-time by:
// 1. Loading script structure from DATABASE (Script Manager)
// 2. Classifying AI/User messages semantically
// 3. Identifying current phase, step, checkpoint
// 4. Detecting ladder activations (3-5 PERCHÉ rule)
// 5. Saving training data to database
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import { nanoid } from 'nanoid';
import { db } from '../db';
import { salesConversationTraining, salesAgentTrainingSummary, salesScripts, clientSalesAgents } from '@shared/schema';
import { eq, and, sql as drizzleSql } from 'drizzle-orm';
import { SalesScriptLogger } from './sales-script-logger';
// ❌ DEPRECATED: CheckpointDetector sostituito da StepAdvancementAgent (AI semantico)
// import { CheckpointDetector } from './checkpoint-detector';
import { parseScriptContentToStructure, ScriptStructure } from './sales-script-structure-parser';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TYPES (Question, Checkpoint, Step, Phase, ScriptStructure imported from parser)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// Info sullo script usato per questa conversazione
interface UsedScriptInfo {
  id: string;
  name: string;
  scriptType: 'discovery' | 'demo' | 'objections';
  version: string;
}

interface TrackingState {
  currentPhase: string;
  currentStep?: string;
  phasesReached: string[];
  phaseActivations: Array<{
    phase: string; // phaseId (e.g., "phase_3")
    timestamp: string;
    trigger: "semantic_match" | "keyword_match" | "exact_match" | "ai_agent_semantic";
    matchedQuestion?: string;
    keywordsMatched?: string[];
    similarity?: number;
    messageId?: string;
    excerpt?: string;
    reasoning?: string;
  }>;
  checkpointsCompleted: Array<{
    checkpointId: string;
    status: "completed" | "pending" | "failed";
    completedAt: string;
    verifications: Array<{
      requirement: string;
      status: "verified" | "pending" | "failed";
      evidence?: {
        messageId: string;
        excerpt: string;
        matchedKeywords: string[];
        timestamp: string;
      };
    }>;
  }>;
  semanticTypes: string[];
  ladderActivations: Array<{
    timestamp: string;
    phase: string;
    level: number;
    question: string;
    userResponse?: string;
    wasVague: boolean;
  }>;
  contextualResponses: Array<{
    timestamp: string;
    phase: string;
    prospectQuestion: string;
    aiResponse: string;
  }>;
  questionsAsked: Array<{
    timestamp: string;
    phase: string;
    stepId?: string;
    question: string;
    questionType?: string;
  }>;
  fullTranscript: Array<{
    messageId: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: string;
    phase?: string;
    checkpoint?: string;
  }>;
  aiReasoning: Array<{
    timestamp: string;
    phase: string;
    decision: string;
    reasoning: string;
  }>;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SALES SCRIPT TRACKER CLASS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export class SalesScriptTracker {
  private scriptStructure!: ScriptStructure;
  private conversationId: string;
  private agentId: string;
  private clientId?: string;
  private state!: TrackingState;
  private startTime: Date;
  private lastLadderLevel: number = 0;
  private logger: SalesScriptLogger | null = null;
  private scriptOutdated: boolean = false;
  private usedScriptInfo?: UsedScriptInfo; // Script dal database usato per questa conversazione
  
  // Ladder detection keywords
  private readonly LADDER_KEYWORDS = [
    'scava con me',
    'cosa intendi esattamente',
    'pensiamoci insieme',
    'anche solo un esempio',
    'aiutami a capire',
    'dimmi tutto',
    'e perché',
    'interessante! cosa intendi',
    'capisco. e perché',
    'cosa succede veramente'
  ];
  
  /**
   * Costruttore privato - NON usa più il JSON file
   * Lo script viene caricato obbligatoriamente dal database nel metodo create()
   */
  private constructor(conversationId: string, agentId: string, initialPhase: string = 'phase_1', logger?: SalesScriptLogger) {
    this.conversationId = conversationId;
    this.agentId = agentId;
    this.startTime = new Date();
    this.logger = logger || null;
    
    // Struttura placeholder - verrà sostituita dal create() con lo script dal DB
    this.scriptStructure = {
      version: '0.0.0',
      generatedAt: new Date().toISOString(),
      phases: [],
      metadata: {
        totalPhases: 0,
        totalSteps: 0,
        totalCheckpoints: 0
      }
    } as ScriptStructure;
    
    // Inizializza stato vuoto (verrà aggiornato dopo il caricamento dal DB)
    this.state = {
      currentPhase: initialPhase,
      currentStep: undefined,
      phasesReached: [initialPhase],
      phaseActivations: [],
      checkpointsCompleted: [],
      semanticTypes: [],
      ladderActivations: [],
      contextualResponses: [],
      questionsAsked: [],
      fullTranscript: [],
      aiReasoning: []
    };
  }
  
  /**
   * Factory method asincrono per creare il tracker
   * OBBLIGATORIO: Carica lo script dal database (Script Manager)
   * Se non trova uno script attivo, lancia un errore esplicito
   */
  static async create(
    conversationId: string, 
    agentId: string, 
    initialPhase: string = 'phase_1', 
    logger?: SalesScriptLogger,
    clientId?: string,
    scriptType: 'discovery' | 'demo' | 'objections' = 'discovery'
  ): Promise<SalesScriptTracker> {
    const tracker = new SalesScriptTracker(conversationId, agentId, initialPhase, logger);
    tracker.clientId = clientId;
    
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // OBBLIGATORIO: Carica lo script dal database (Script Manager)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    if (!clientId) {
      throw new Error(`❌ [TRACKER] clientId mancante - impossibile caricare lo script dal database. Verifica che l'agente abbia un clientId configurato.`);
    }
    
    const [activeScript] = await db.select()
      .from(salesScripts)
      .where(and(
        eq(salesScripts.clientId, clientId),
        eq(salesScripts.scriptType, scriptType),
        eq(salesScripts.isActive, true)
      ))
      .limit(1);
    
    if (!activeScript || !activeScript.content) {
      throw new Error(`❌ [TRACKER] Nessuno script attivo trovato per clientId ${clientId} (tipo: ${scriptType}). Vai nel Script Manager e attiva uno script prima di avviare una consulenza.`);
    }
    
    console.log(`📖 [TRACKER] Loading script from database: ${activeScript.name}`);
    
    // Parse il contenuto dello script per creare la struttura
    tracker.scriptStructure = parseScriptContentToStructure(activeScript.content, scriptType);
    
    // Memorizza info sullo script usato
    tracker.usedScriptInfo = {
      id: activeScript.id,
      name: activeScript.name,
      scriptType: activeScript.scriptType as 'discovery' | 'demo' | 'objections',
      version: activeScript.version || '1.0.0'
    };
    
    // Aggiorna currentStep con il primo step dello script caricato dal DB
    const firstStep = tracker.scriptStructure.phases[0]?.steps[0]?.id;
    if (firstStep) {
      tracker.state.currentStep = firstStep;
      tracker.state.currentPhase = tracker.scriptStructure.phases[0]?.id || initialPhase;
    }
    
    console.log(`✅ [TRACKER] Script loaded from DB: "${activeScript.name}" (ID: ${activeScript.id})`);
    console.log(`   Phases: ${tracker.scriptStructure.metadata.totalPhases}, Steps: ${tracker.scriptStructure.metadata.totalSteps}`);
    console.log(`   Starting phase: ${tracker.state.currentPhase}`);
    console.log(`   Starting step: ${firstStep || 'N/A'}`);
    
    if (tracker.logger) {
      const phase = tracker.getCurrentPhase();
      if (phase) {
        tracker.logger.logPhaseStart(phase.id, phase.name, phase.semanticType);
      }
    }
    
    return tracker;
  }
  
  /**
   * Getter per le info sullo script usato
   */
  getUsedScriptInfo(): UsedScriptInfo | undefined {
    return this.usedScriptInfo;
  }
  
  /**
   * Public typed getter for script structure
   * Used by gemini-live-ws-service.ts to access script metadata
   */
  getScriptStructure(): ScriptStructure {
    return this.scriptStructure;
  }
  
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // PUBLIC API
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  
  /**
   * Track AI message - classify and identify phase/step/checkpoint
   */
  async trackAIMessage(message: string): Promise<void> {
    const timestamp = new Date().toISOString();
    const messageId = nanoid();
    
    // Add to transcript with unique messageId
    this.state.fullTranscript.push({
      messageId,
      role: 'assistant',
      content: message,
      timestamp,
      phase: this.state.currentPhase
    });
    
    // Detect ladder activation
    const ladderDetected = this.detectLadder(message);
    if (ladderDetected) {
      this.lastLadderLevel = ladderDetected.level;
      this.state.ladderActivations.push({
        timestamp,
        phase: this.state.currentPhase,
        level: ladderDetected.level,
        question: message.substring(0, 200),
        wasVague: ladderDetected.wasVague
      });
      
      console.log(`🔍 [TRACKER] LADDER ACTIVATED - Level ${ladderDetected.level} in ${this.state.currentPhase}`);
      
      // Log ladder activation with structured logger
      if (this.logger) {
        this.logger.logLadderActivated(ladderDetected.level, this.state.currentPhase, message);
      }
    }
    
    // Match question to script
    const matchedQuestion = this.matchQuestionToScript(message);
    if (matchedQuestion) {
      const previousPhase = this.state.currentPhase;
      const previousStep = this.state.currentStep;
      
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      // 🛡️ STEP VALIDATION: Enforce sequential progression
      // Only allow moving to the immediate next step or staying at current
      // When previousStep is undefined, only first step of phase is valid
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      const validation = this.isValidStepTransition(
        previousPhase,                                    // current phase
        previousStep,                                     // current step (undefined means no step yet)
        matchedQuestion.phaseId,                          // target phase
        matchedQuestion.stepId                            // target step
      );
      
      if (!validation.valid) {
        // BLOCKED: AI tried to skip steps - keep tracker at current position
        console.log(`\n🚫 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        console.log(`🚫 [TRACKER] TRANSITION BLOCKED: ${validation.reason}`);
        console.log(`🚫 Current Position: ${previousPhase} / ${previousStep || 'no step'}`);
        console.log(`🚫 Attempted Target: ${matchedQuestion.phaseId} / ${matchedQuestion.stepId}`);
        console.log(`🚫 Action: Keeping tracker at current position`);
        console.log(`🚫 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
        
        // Still log the question as asked (for analytics) but don't change position
        this.state.questionsAsked.push({
          timestamp,
          phase: previousPhase, // Use current phase, not the skipped one
          stepId: previousStep,
          question: message.substring(0, 200),
          questionType: 'blocked_skip_attempt'
        });
        
        // Log with structured logger if available
        if (this.logger) {
          this.logger.logEvent('step_skip_blocked', {
            currentPhase: previousPhase,
            currentStep: previousStep,
            attemptedPhase: matchedQuestion.phaseId,
            attemptedStep: matchedQuestion.stepId,
            reason: validation.reason,
            message: message.substring(0, 100)
          });
        }
        
        // Don't update state - return early without changing position
        await this.saveToDatabase();
        return;
      }
      
      // Valid transition - proceed with update
      this.state.currentPhase = matchedQuestion.phaseId;
      this.state.currentStep = matchedQuestion.stepId;
      
      // Track phase reached
      const isNewPhase = !this.state.phasesReached.includes(matchedQuestion.phaseId);
      if (isNewPhase) {
        this.state.phasesReached.push(matchedQuestion.phaseId);
        console.log(`🟢 [TRACKER] NEW PHASE REACHED: ${matchedQuestion.phaseId} - ${matchedQuestion.phaseName}`);
        
        // Save phase activation with evidence (flat structure for UI compatibility)
        this.state.phaseActivations.push({
          phase: matchedQuestion.phaseId,
          timestamp,
          trigger: matchedQuestion.similarity >= 0.8 ? 'semantic_match' : 'keyword_match',
          matchedQuestion: matchedQuestion.matchedQuestion,
          keywordsMatched: matchedQuestion.keywordsMatched,
          similarity: matchedQuestion.similarity,
          messageId,
          excerpt: message.substring(0, 150),
          reasoning: `Ho attivato questa fase perché l'AI ha detto una frase simile (${Math.round(matchedQuestion.similarity * 100)}%) a una domanda dello script: "${matchedQuestion.matchedQuestion.substring(0, 100)}...". Keywords trovate: ${matchedQuestion.keywordsMatched.join(', ')}.`
        });
        
        console.log(`🎯 [TRACKER] PHASE ACTIVATION SAVED with evidence:`);
        console.log(`   Similarity: ${Math.round(matchedQuestion.similarity * 100)}%`);
        console.log(`   Keywords: ${matchedQuestion.keywordsMatched.join(', ')}`);
        
        // Log phase start with structured logger
        if (this.logger) {
          this.logger.logPhaseStart(matchedQuestion.phaseId, matchedQuestion.phaseName, matchedQuestion.semanticType);
        }
      } else if (previousPhase !== matchedQuestion.phaseId) {
        // Returned to previous phase - log progress
        if (this.logger) {
          this.logger.logPhaseProgress(matchedQuestion.phaseId, matchedQuestion.stepName, message.substring(0, 100));
        }
      }
      
      // Track semantic type
      if (!this.state.semanticTypes.includes(matchedQuestion.semanticType)) {
        this.state.semanticTypes.push(matchedQuestion.semanticType);
      }
      
      // Track question asked
      this.state.questionsAsked.push({
        timestamp,
        phase: matchedQuestion.phaseId,
        stepId: matchedQuestion.stepId,
        question: message.substring(0, 200),
        questionType: ladderDetected ? 'ladder' : matchedQuestion.semanticType
      });
      
      console.log(`📍 [TRACKER] Question matched:`);
      console.log(`   Phase: ${matchedQuestion.phaseId} - ${matchedQuestion.phaseName}`);
      console.log(`   Step: ${matchedQuestion.stepId} - ${matchedQuestion.stepName}`);
      console.log(`   Type: ${matchedQuestion.semanticType}`);
    }
    
    // Save to DB
    await this.saveToDatabase();
  }
  
  /**
   * Track user message - detect vague answers, checkpoint responses
   */
  async trackUserMessage(message: string): Promise<void> {
    const timestamp = new Date().toISOString();
    const messageId = nanoid();
    
    // Add to transcript with unique messageId
    this.state.fullTranscript.push({
      messageId,
      role: 'user',
      content: message,
      timestamp,
      phase: this.state.currentPhase
    });
    
    // If we recently activated ladder, store user response
    if (this.lastLadderLevel > 0 && this.state.ladderActivations.length > 0) {
      const lastLadder = this.state.ladderActivations[this.state.ladderActivations.length - 1];
      lastLadder.userResponse = message;
      
      // Check if response is still vague
      const isVague = this.isResponseVague(message);
      lastLadder.wasVague = isVague;
      
      if (isVague) {
        console.log(`⚠️  [TRACKER] User response still VAGUE - Ladder should continue`);
      } else {
        console.log(`✅ [TRACKER] User response SPECIFIC - Ladder can stop`);
        this.lastLadderLevel = 0; // Reset
      }
    }
    
    // Check for checkpoint verification keywords
    const checkpointProgress = this.detectCheckpointProgress(message);
    if (checkpointProgress) {
      console.log(`✓ [TRACKER] Checkpoint progress detected: ${checkpointProgress}`);
    }
    
    // 🎯 AUTO-DETECT CHECKPOINTS: Analyze transcript to auto-complete checkpoints
    await this.autoDetectCheckpoints();
    
    // Save to DB
    await this.saveToDatabase();
  }
  
  /**
   * Mark checkpoint as completed (legacy method - backward compatible)
   */
  async completeCheckpoint(checkpointId: string, verifications: string[]): Promise<void> {
    const existing = this.state.checkpointsCompleted.find(cp => cp.checkpointId === checkpointId);
    
    if (!existing) {
      // Convert old format to new structured format
      const structuredVerifications = verifications.map(v => ({
        requirement: v,
        status: "verified" as const,
        evidence: undefined
      }));
      
      this.state.checkpointsCompleted.push({
        checkpointId,
        status: "completed",
        completedAt: new Date().toISOString(),
        verifications: structuredVerifications
      });
      
      console.log(`✅ [TRACKER] CHECKPOINT COMPLETED: ${checkpointId}`);
      console.log(`   Verifications: ${verifications.join(', ')}`);
      
      await this.saveToDatabase();
    }
  }
  
  /**
   * Mark checkpoint as completed with structured evidence
   */
  async completeCheckpointWithEvidence(
    checkpointId: string,
    verifications: Array<{
      requirement: string;
      status: "verified" | "pending" | "failed";
      evidence?: {
        messageId: string;
        excerpt: string;
        matchedKeywords: string[];
        timestamp: string;
      };
    }>
  ): Promise<void> {
    const existing = this.state.checkpointsCompleted.find(cp => cp.checkpointId === checkpointId);
    
    if (!existing) {
      const allVerified = verifications.every(v => v.status === "verified");
      const anyFailed = verifications.some(v => v.status === "failed");
      
      const status = anyFailed ? "failed" : (allVerified ? "completed" : "pending");
      
      this.state.checkpointsCompleted.push({
        checkpointId,
        status,
        completedAt: new Date().toISOString(),
        verifications
      });
      
      console.log(`✅ [TRACKER] CHECKPOINT ${status.toUpperCase()}: ${checkpointId}`);
      console.log(`   Verifications: ${verifications.length} total`);
      verifications.forEach(v => {
        console.log(`   - ${v.requirement}: ${v.status}`);
        if (v.evidence) {
          console.log(`     Evidence: "${v.evidence.excerpt.substring(0, 60)}..." (${v.evidence.matchedKeywords.join(', ')})`);
        }
      });
      
      await this.saveToDatabase();
    }
  }
  
  /**
   * Auto-detect and complete checkpoints based on transcript evidence
   * Called after each user message to check if any checkpoint requirements are met
   */
  private async autoDetectCheckpoints(): Promise<void> {
    const currentPhase = this.getCurrentPhase();
    if (!currentPhase || !currentPhase.checkpoints || currentPhase.checkpoints.length === 0) {
      return; // No checkpoints in current phase
    }
    
    console.log(`\n🎯 [AUTO-DETECT] Checking ${currentPhase.checkpoints.length} checkpoint(s) for ${currentPhase.id}`);
    
    // Get checkpoints that haven't been completed yet
    const pendingCheckpoints = currentPhase.checkpoints.filter(cp => 
      !this.state.checkpointsCompleted.some(completed => completed.checkpointId === cp.id)
    );
    
    if (pendingCheckpoints.length === 0) {
      console.log(`   ✅ All checkpoints already completed for ${currentPhase.id}`);
      return;
    }
    
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // ❌ DEPRECATED: CheckpointDetector (keyword-based) sostituito da StepAdvancementAgent
    // Il nuovo sistema usa AI semantica per valutare l'avanzamento degli step
    // Vedi gemini-live-ws-service.ts per l'implementazione con StepAdvancementAgent
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    console.log(`   ℹ️ Checkpoint detection now handled by StepAdvancementAgent (AI semantico)`);
    console.log(`   ℹ️ Pending checkpoints: ${pendingCheckpoints.map(cp => cp.id).join(', ')}`);
    
    // NOTE: Non usiamo più CheckpointDetector.detectCheckpoints()
    // I checkpoint vengono ora gestiti tramite StepAdvancementAgent.analyze()
    // che valuta semanticamente se avanzare alla fase/step successivo
  }
  
  /**
   * Add AI reasoning entry
   */
  async addReasoning(decision: string, reasoning: string): Promise<void> {
    this.state.aiReasoning.push({
      timestamp: new Date().toISOString(),
      phase: this.state.currentPhase,
      decision,
      reasoning
    });
    
    await this.saveToDatabase();
  }
  
  /**
   * Add contextual response event (Anti-Robot Mode)
   * Called when AI responds to client's question before continuing script
   */
  async addContextualResponse(clientQuestion: string, aiAnswer: string): Promise<void> {
    const timestamp = new Date().toISOString();
    
    // Add to contextualResponses array
    this.state.contextualResponses.push({
      timestamp,
      phase: this.state.currentPhase,
      prospectQuestion: clientQuestion.substring(0, 300),
      aiResponse: aiAnswer.substring(0, 500)
    });
    
    // Also add to aiReasoning for visibility
    this.state.aiReasoning.push({
      timestamp,
      phase: this.state.currentPhase,
      decision: 'contextual_response',
      reasoning: `Prospect asked: "${clientQuestion.substring(0, 100)}..." - AI responded before continuing script (Anti-Robot Mode activated). Response: "${aiAnswer.substring(0, 150)}..."`
    });
    
    console.log(`🤖➡️😊 [TRACKER] CONTEXTUAL RESPONSE logged in ${this.state.currentPhase}`);
    console.log(`   Prospect Question: "${clientQuestion.substring(0, 80)}..."`);
    console.log(`   AI Response: "${aiAnswer.substring(0, 80)}..."`);
    
    // Log with structured logger if available
    if (this.logger) {
      this.logger.logEvent('contextual_response', {
        phase: this.state.currentPhase,
        prospectQuestion: clientQuestion.substring(0, 100),
        aiResponse: aiAnswer.substring(0, 100)
      });
    }
    
    await this.saveToDatabase();
  }
  
  /**
   * Get current tracking state
   */
  getState(): TrackingState {
    return { ...this.state };
  }
  
  /**
   * Get current phase info
   */
  getCurrentPhase(): Phase | undefined {
    return this.scriptStructure.phases.find(p => p.id === this.state.currentPhase);
  }
  
  /**
   * Get completion rate (0.0 to 1.0)
   * Filters phasesReached to only count phases that exist in the script,
   * deduplicates them, and caps the result at 1.0 (100%)
   */
  getCompletionRate(): number {
    const totalPhases = this.scriptStructure.metadata.totalPhases;
    if (totalPhases === 0) return 0;
    
    const scriptPhaseIds = new Set(this.scriptStructure.phases.map(p => p.id));
    const uniqueValidPhasesReached = new Set(
      this.state.phasesReached.filter(phaseId => scriptPhaseIds.has(phaseId))
    );
    const completionRate = uniqueValidPhasesReached.size / totalPhases;
    
    return Math.min(completionRate, 1.0);
  }
  
  /**
   * Check if script source file has been modified after JSON extraction
   */
  isScriptOutdated(): boolean {
    return this.scriptOutdated;
  }
  
  /**
   * 🎯 ADVANCE TO - Called by Step Advancement Agent to move to next step/phase
   * This is the semantic-based advancement that replaces keyword matching
   */
  async advanceTo(nextPhaseId: string, nextStepId: string, reasoning: string): Promise<void> {
    const timestamp = new Date().toISOString();
    const previousPhase = this.state.currentPhase;
    const previousStep = this.state.currentStep;
    
    // Update position
    this.state.currentPhase = nextPhaseId;
    this.state.currentStep = nextStepId;
    
    // Track phase if new
    const isNewPhase = !this.state.phasesReached.includes(nextPhaseId);
    if (isNewPhase) {
      this.state.phasesReached.push(nextPhaseId);
      
      // Find phase info for logging
      const phase = this.scriptStructure.phases.find(p => p.id === nextPhaseId);
      if (phase) {
        this.state.phaseActivations.push({
          phase: nextPhaseId,
          timestamp,
          trigger: 'ai_agent_semantic',
          matchedQuestion: reasoning,
          keywordsMatched: [],
          similarity: 1.0,
          messageId: `advancement-${Date.now()}`,
          excerpt: reasoning,
          reasoning: `Step Advancement Agent ha determinato semanticamente che siamo pronti per questa fase. ${reasoning}`
        });
        
        if (this.logger) {
          this.logger.logPhaseStart(phase.id, phase.name, phase.semanticType);
        }
      }
    }
    
    // Log the advancement with AI reasoning
    this.state.aiReasoning.push({
      timestamp,
      phase: nextPhaseId,
      decision: 'step_advancement',
      reasoning: `🎯 Advanced from ${previousPhase}/${previousStep || 'start'} to ${nextPhaseId}/${nextStepId}. ${reasoning}`
    });
    
    console.log(`\n🎯 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`🎯 [TRACKER] STEP ADVANCEMENT (AI-driven)`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`   📍 FROM: ${previousPhase} / ${previousStep || 'start'}`);
    console.log(`   📍 TO:   ${nextPhaseId} / ${nextStepId}`);
    console.log(`   💡 Reasoning: ${reasoning}`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
    
    // Save to database
    await this.saveToDatabase();
  }
  
  /**
   * Get current phase and step indices for Step Advancement Agent
   */
  getCurrentIndices(): { phaseIndex: number; stepIndex: number } {
    const phaseIndex = this.scriptStructure.phases.findIndex(p => p.id === this.state.currentPhase);
    const phase = this.scriptStructure.phases[phaseIndex];
    const stepIndex = phase?.steps.findIndex(s => s.id === this.state.currentStep) ?? -1;
    return { phaseIndex: Math.max(0, phaseIndex), stepIndex: Math.max(0, stepIndex) };
  }
  
  /**
   * 🆕 FORCE ADVANCE: Forza l'avanzamento al prossimo step (usato dal loop detector)
   * Questo metodo bypassa i controlli normali di sequenzialità per uscire da loop
   * @returns true se avanzato, false se già all'ultimo step
   */
  forceAdvanceToNextStep(): boolean {
    console.log(`\n🔴 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`🔴 [TRACKER] FORCE ADVANCE - Forzatura avanzamento step richiesta`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`   📍 Fase corrente: ${this.state.currentPhase}`);
    console.log(`   📍 Step corrente: ${this.state.currentStep || 'N/A'}`);
    
    const currentPhase = this.scriptStructure.phases.find(p => p.id === this.state.currentPhase);
    if (!currentPhase) {
      console.log(`   ❌ Fase non trovata!`);
      console.log(`🔴 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
      return false;
    }
    
    const currentStepIndex = currentPhase.steps.findIndex(s => s.id === this.state.currentStep);
    
    // Prova ad avanzare al prossimo step nella stessa fase
    if (currentStepIndex >= 0 && currentStepIndex < currentPhase.steps.length - 1) {
      const nextStep = currentPhase.steps[currentStepIndex + 1];
      const previousStep = this.state.currentStep;
      this.state.currentStep = nextStep.id;
      
      // Log l'avanzamento nel reasoning
      this.state.aiReasoning.push({
        timestamp: new Date().toISOString(),
        phase: this.state.currentPhase,
        decision: 'force_advance_step',
        reasoning: `🔴 FORCE ADVANCE: Loop detected, forced advancement from step "${previousStep}" to "${nextStep.id}"`
      });
      
      console.log(`   ✅ Avanzato a step: ${nextStep.id} (${nextStep.name})`);
      console.log(`🔴 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
      return true;
    }
    
    // Altrimenti prova ad avanzare alla prossima fase
    const currentPhaseIndex = this.scriptStructure.phases.findIndex(p => p.id === this.state.currentPhase);
    if (currentPhaseIndex >= 0 && currentPhaseIndex < this.scriptStructure.phases.length - 1) {
      const nextPhase = this.scriptStructure.phases[currentPhaseIndex + 1];
      const previousPhase = this.state.currentPhase;
      
      // Aggiungi fase corrente a completate
      if (!this.state.phasesReached.includes(currentPhase.id)) {
        this.state.phasesReached.push(currentPhase.id);
      }
      
      this.state.currentPhase = nextPhase.id;
      this.state.currentStep = nextPhase.steps[0]?.id || undefined;
      
      // Aggiungi anche la nuova fase a phasesReached
      if (!this.state.phasesReached.includes(nextPhase.id)) {
        this.state.phasesReached.push(nextPhase.id);
      }
      
      // Log l'avanzamento nel reasoning
      this.state.aiReasoning.push({
        timestamp: new Date().toISOString(),
        phase: nextPhase.id,
        decision: 'force_advance_phase',
        reasoning: `🔴 FORCE ADVANCE: Loop detected at last step of phase, forced advancement from phase "${previousPhase}" to "${nextPhase.id}"`
      });
      
      console.log(`   ✅ Avanzato a FASE: ${nextPhase.id} (${nextPhase.name})`);
      console.log(`   📍 Primo step: ${this.state.currentStep || 'N/A'}`);
      console.log(`🔴 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
      return true;
    }
    
    console.log(`   ⚠️ Già all'ultimo step dell'ultima fase - impossibile avanzare`);
    console.log(`🔴 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
    return false;
  }
  
  /**
   * Get current phase number (e.g., "phase_3" -> 3, "phase_1_2" -> 1)
   */
  private getCurrentPhaseNumber(): number {
    return this.getPhaseNumber(this.state.currentPhase);
  }
  
  /**
   * Extract phase number from phase ID (e.g., "phase_3" -> 3, "phase_1_2" -> 1)
   */
  private getPhaseNumber(phaseId: string): number {
    // Extract first number after "phase_"
    const match = phaseId.match(/phase_(\d+)/);
    return match ? parseInt(match[1], 10) : 0;
  }
  
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // PRIVATE METHODS - Detection & Matching
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  
  /**
   * Validate that a step transition is sequential (only allows moving to next step or staying at current)
   * This enforces strict sequential progression through the sales script
   * 
   * @param currentPhaseId - The current phase ID
   * @param currentStepId - The current step ID (e.g., "phase_1_2_step_1"), undefined if no step yet
   * @param newPhaseId - The proposed new phase ID
   * @param newStepId - The proposed new step ID
   * @returns object with valid boolean and reason string
   */
  private isValidStepTransition(
    currentPhaseId: string, 
    currentStepId: string | undefined, 
    newPhaseId: string, 
    newStepId: string
  ): { valid: boolean; reason: string } {
    
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 🎯 SPECIAL CASE: No step yet (start of conversation)
    // The ONLY valid match is the FIRST step of the current phase
    // Any other step should be blocked to enforce correct start
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    if (!currentStepId) {
      const currentPhase = this.scriptStructure.phases.find(p => p.id === currentPhaseId);
      if (!currentPhase || !currentPhase.steps?.length) {
        console.log(`🚫 [STEP-VALIDATION] Phase or steps not found for first utterance check: ${currentPhaseId}`);
        return { valid: false, reason: 'Phase or steps not found' };
      }
      
      const firstStepId = currentPhase.steps[0].id;
      
      // Must start from first step of current phase
      if (newStepId === firstStepId && newPhaseId === currentPhaseId) {
        console.log(`✅ [STEP-VALIDATION] First utterance correctly matched first step: ${newStepId}`);
        return { valid: true, reason: 'Starting at first step of phase (correct start)' };
      }
      
      // Blocked: Trying to skip to a later step without completing step 1
      console.log(`\n🚫 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`🚫 [STEP-VALIDATION] FIRST UTTERANCE BLOCKED`);
      console.log(`🚫 Must start from first step of phase.`);
      console.log(`🚫 Attempted: ${newPhaseId} / ${newStepId}`);
      console.log(`🚫 Required: ${currentPhaseId} / ${firstStepId}`);
      console.log(`🚫 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
      return { valid: false, reason: `Must start from first step of phase. Attempted: ${newStepId}, Required: ${firstStepId}` };
    }
    
    // If staying in same phase and step - always valid
    if (currentPhaseId === newPhaseId && currentStepId === newStepId) {
      console.log(`✅ [STEP-VALIDATION] Staying at current position: ${currentPhaseId} / ${currentStepId}`);
      return { valid: true, reason: 'Staying at current position' };
    }
    
    // If same phase, check step progression
    if (currentPhaseId === newPhaseId) {
      const phase = this.scriptStructure.phases.find(p => p.id === currentPhaseId);
      if (!phase) {
        console.log(`⚠️  [STEP-VALIDATION] Phase not found: ${currentPhaseId}`);
        return { valid: false, reason: 'Phase not found' };
      }
      
      const currentIdx = phase.steps.findIndex(s => s.id === currentStepId);
      const newIdx = phase.steps.findIndex(s => s.id === newStepId);
      
      // Handle case where current step is not found in phase
      if (currentIdx === -1) {
        // Allow transition to first step of phase
        if (newIdx === 0) {
          console.log(`✅ [STEP-VALIDATION] First step in phase: ${newStepId}`);
          return { valid: true, reason: 'Starting first step in phase' };
        }
        console.log(`🚫 [STEP-VALIDATION] Current step ${currentStepId} not in phase ${currentPhaseId} - blocking skip to non-first step`);
        return { valid: false, reason: `Cannot skip to step ${newStepId} when current step not found in phase` };
      }
      
      // Handle case where new step is not found in phase
      if (newIdx === -1) {
        console.log(`🚫 [STEP-VALIDATION] New step ${newStepId} not found in phase ${currentPhaseId}`);
        return { valid: false, reason: `Step ${newStepId} not found in phase` };
      }
      
      // Only allow next step (index + 1) or staying at same step
      if (newIdx === currentIdx + 1) {
        console.log(`✅ [STEP-VALIDATION] Valid step progression: Step ${currentIdx + 1} → Step ${newIdx + 1}`);
        return { valid: true, reason: 'Moving to next step in same phase' };
      }
      
      if (newIdx === currentIdx) {
        console.log(`✅ [STEP-VALIDATION] Staying at current step: ${currentStepId}`);
        return { valid: true, reason: 'Staying at current step' };
      }
      
      if (newIdx > currentIdx + 1) {
        console.log(`🚫 [STEP-VALIDATION] BLOCKED: Trying to skip from Step ${currentIdx + 1} to Step ${newIdx + 1}`);
        return { valid: false, reason: `Cannot skip from step ${currentIdx + 1} to step ${newIdx + 1}` };
      }
      
      console.log(`🚫 [STEP-VALIDATION] BLOCKED: Trying to go backwards from Step ${currentIdx + 1} to Step ${newIdx + 1}`);
      return { valid: false, reason: `Cannot go backwards from step ${currentIdx + 1} to step ${newIdx + 1}` };
    }
    
    // If different phase, check phase progression
    const currentPhaseIdx = this.scriptStructure.phases.findIndex(p => p.id === currentPhaseId);
    const newPhaseIdx = this.scriptStructure.phases.findIndex(p => p.id === newPhaseId);
    
    // Handle case where phases are not found
    if (currentPhaseIdx === -1) {
      console.log(`⚠️  [STEP-VALIDATION] Current phase ${currentPhaseId} not found - allowing transition`);
      return { valid: true, reason: 'Current phase not found - allowing transition' };
    }
    
    if (newPhaseIdx === -1) {
      console.log(`🚫 [STEP-VALIDATION] New phase ${newPhaseId} not found`);
      return { valid: false, reason: `Phase ${newPhaseId} not found` };
    }
    
    // Only allow moving to immediate next phase (and only if current phase's last step)
    if (newPhaseIdx === currentPhaseIdx + 1) {
      // Verify we're at the last step of current phase
      const currentPhase = this.scriptStructure.phases[currentPhaseIdx];
      const lastStepId = currentPhase.steps[currentPhase.steps.length - 1]?.id;
      
      if (currentStepId === lastStepId) {
        console.log(`✅ [STEP-VALIDATION] Valid phase transition: ${currentPhaseId} → ${newPhaseId} (completed last step)`);
        return { valid: true, reason: 'Moving to next phase after completing current' };
      }
      
      console.log(`🚫 [STEP-VALIDATION] BLOCKED: Cannot change phase without completing current phase steps`);
      console.log(`   Current step: ${currentStepId}, Last step required: ${lastStepId}`);
      return { valid: false, reason: 'Cannot change phase without completing current phase steps' };
    }
    
    if (newPhaseIdx > currentPhaseIdx + 1) {
      console.log(`🚫 [STEP-VALIDATION] BLOCKED: Trying to skip phases ${currentPhaseId} → ${newPhaseId}`);
      return { valid: false, reason: `Cannot jump from phase ${currentPhaseIdx + 1} to phase ${newPhaseIdx + 1}` };
    }
    
    // Going backwards
    console.log(`🚫 [STEP-VALIDATION] BLOCKED: Trying to go backwards ${currentPhaseId} → ${newPhaseId}`);
    return { valid: false, reason: `Cannot go backwards from phase ${currentPhaseIdx + 1} to phase ${newPhaseIdx + 1}` };
  }
  
  /**
   * Match AI message to a question in the script
   */
  private matchQuestionToScript(message: string): {
    phaseId: string;
    phaseName: string;
    stepId: string;
    stepName: string;
    semanticType: string;
    matchedQuestion: string;
    similarity: number;
    keywordsMatched: string[];
  } | null {
    const messageLower = message.toLowerCase().trim();
    
    // 🚫 GENERIC MESSAGE FILTER: Reject too short or generic messages
    if (this.isMessageTooGeneric(messageLower)) {
      console.log(`🚫 [GENERIC-FILTER] Message too generic/short - skipping match`);
      return null;
    }
    
    // 🛡️ ANTI-REGRESSION: Get current phase number to prevent going backwards
    const currentPhaseNum = this.getCurrentPhaseNumber();
    
    // Search through all phases and steps
    let bestMatch: {
      phaseId: string;
      phaseName: string;
      stepId: string;
      stepName: string;
      semanticType: string;
      matchedQuestion: string;
      similarity: number;
      keywordsMatched: string[];
    } | null = null;
    
    let bestSimilarity = 0;
    
    for (const phase of this.scriptStructure.phases) {
      // Extract phase number (e.g., "phase_1_2" -> 1)
      const phaseNum = this.getPhaseNumber(phase.id);
      
      for (const step of phase.steps) {
        for (const question of step.questions) {
          const questionLower = question.text.toLowerCase();
          
          // Remove placeholders for matching
          const cleanQuestion = questionLower
            .replace(/\[nome_prospect\]/gi, '')
            .replace(/\[.*?\]/g, '')
            .trim();
          
          const similarity = this.calculateSimilarity(messageLower, cleanQuestion);
          
          // 🎯 THRESHOLD INCREASED: From 0.6 to 0.85 for higher precision
          // 🛡️ ANTI-REGRESSION: Only accept matches that don't go backwards
          if (similarity > 0.85) {
            // Check if this is a regression (going to earlier phase)
            const isRegression = phaseNum < currentPhaseNum;
            
            if (isRegression) {
              console.log(`🛡️ [ANTI-REGRESSION] Blocked match to ${phase.id} (phase ${phaseNum}) - currently at phase ${currentPhaseNum}`);
              console.log(`   Similarity was ${(similarity * 100).toFixed(1)}% but rejected to prevent regression`);
              continue; // Skip this match
            }
            
            // Track best match
            if (similarity > bestSimilarity) {
              const messageWords = new Set(messageLower.split(/\s+/).filter(w => w.length > 3));
              const questionWords = new Set(cleanQuestion.split(/\s+/).filter(w => w.length > 3));
              const keywordsMatched = [...messageWords].filter(w => questionWords.has(w));
              
              bestSimilarity = similarity;
              bestMatch = {
                phaseId: phase.id,
                phaseName: phase.name,
                stepId: step.id,
                stepName: step.name,
                semanticType: phase.semanticType,
                matchedQuestion: question.text,
                similarity,
                keywordsMatched
              };
            }
          } else if (similarity > 0.6) {
            // Log rejected matches that would have passed old threshold
            console.log(`⚠️ [THRESHOLD] Rejected match (${(similarity * 100).toFixed(1)}%) - too low (need 85%+)`);
          }
        }
      }
    }
    
    // Return best match found (or null if none)
    if (bestMatch) {
      console.log(`✅ [MATCH] Found valid match with ${(bestMatch.similarity * 100).toFixed(1)}% similarity`);
    }
    
    return bestMatch;
  }
  
  /**
   * Detect ladder activation (3-5 PERCHÉ rule)
   */
  private detectLadder(message: string): { level: number; wasVague: boolean } | null {
    const messageLower = message.toLowerCase();
    
    // Check for ladder keywords
    const hasLadderKeyword = this.LADDER_KEYWORDS.some(keyword => 
      messageLower.includes(keyword.toLowerCase())
    );
    
    if (!hasLadderKeyword) {
      return null;
    }
    
    // Determine ladder level based on keywords
    let level = this.lastLadderLevel + 1;
    
    if (messageLower.includes('scava con me') || messageLower.includes('cosa intendi esattamente')) {
      level = 1; // LIVELLO 1 - Chiarificazione
    } else if (messageLower.includes('e perché') && messageLower.includes('ti preoccupa')) {
      level = 2; // LIVELLO 2 - Primo scavo
    } else if (messageLower.includes('cosa succede veramente')) {
      level = 3; // LIVELLO 3 - Scavo profondo emotivo
    } else if (messageLower.includes('livello pratico') || messageLower.includes('punto critico')) {
      level = 4; // LIVELLO 4 - Tecnico
    } else if (messageLower.includes('personalmente')) {
      level = 5; // LIVELLO 5 - Emotivo finale
    } else if (messageLower.includes('proprio adesso')) {
      level = 6; // LIVELLO 6 - Evento scatenante
    }
    
    // Cap at 6
    if (level > 6) level = 6;
    
    return {
      level,
      wasVague: false // Will be updated when user responds
    };
  }
  
  /**
   * Check if message is too generic to match (avoid false positives)
   */
  private isMessageTooGeneric(message: string): boolean {
    const messageLower = message.toLowerCase();
    
    // 1. Too short (less than 10 characters)
    if (message.length < 10) {
      return true;
    }
    
    // 2. Only contains generic greeting words
    const genericPhrases = [
      'ciao', 'buongiorno', 'buonasera', 'salve', 'piacere',
      'ok', 'va bene', 'perfetto', 'grazie', 'prego', 
      'sì', 'si', 'no', 'certo', 'esatto', 'capisco',
      'dimmi', 'come va', 'tutto bene'
    ];
    
    const words = messageLower.split(/\s+/).filter(w => w.length > 2);
    const meaningfulWords = words.filter(w => 
      !genericPhrases.some(phrase => phrase.includes(w) || w.includes(phrase))
    );
    
    // If less than 3 meaningful words, too generic
    if (meaningfulWords.length < 3) {
      return true;
    }
    
    // 3. Only filler words (interiezioni)
    const fillerWords = ['eh', 'ah', 'oh', 'uhm', 'mmm', 'beh', 'mah', 'boh'];
    const isOnlyFillers = words.every(w => fillerWords.includes(w));
    
    return isOnlyFillers;
  }
  
  /**
   * Detect if user response is vague (needs ladder continuation)
   */
  private isResponseVague(response: string): boolean {
    const responseLower = response.toLowerCase();
    
    // Vague indicators
    const vagueKeywords = [
      'non lo so',
      'boh',
      'non sono sicuro',
      'forse',
      'problemi',
      'cose',
      'roba',
      'tutto',
      'niente',
      'così così',
      'più o meno'
    ];
    
    const hasVagueKeyword = vagueKeywords.some(keyword => responseLower.includes(keyword));
    
    // Specific indicators
    const hasNumbers = /\d/.test(response);
    const hasSpecificNouns = /(facebook|google|instagram|vendita|cliente|soldi|euro|€)/.test(responseLower);
    const isLongEnough = response.split(' ').length > 5;
    
    // Vague if has vague keywords OR lacks specificity
    return hasVagueKeyword || !(hasNumbers || hasSpecificNouns || isLongEnough);
  }
  
  /**
   * Detect checkpoint progress based on user message
   */
  private detectCheckpointProgress(message: string): string | null {
    const messageLower = message.toLowerCase();
    
    // Common checkpoint confirmation keywords
    const confirmationKeywords = ['sì', 'si', 'ok', 'va bene', 'perfetto', 'd\'accordo', 'certo'];
    
    const hasConfirmation = confirmationKeywords.some(keyword => messageLower.includes(keyword));
    
    if (hasConfirmation) {
      return `User confirmed in ${this.state.currentPhase}`;
    }
    
    return null;
  }
  
  /**
   * Calculate similarity between two strings (simple Jaccard index)
   */
  private calculateSimilarity(str1: string, str2: string): number {
    const words1 = new Set(str1.split(/\s+/).filter(w => w.length > 2));
    const words2 = new Set(str2.split(/\s+/).filter(w => w.length > 2));
    
    const intersection = new Set([...words1].filter(w => words2.has(w)));
    const union = new Set([...words1, ...words2]);
    
    return union.size > 0 ? intersection.size / union.size : 0;
  }
  
  /**
   * Extract key phrases from question (for matching)
   */
  private extractKeyPhrases(question: string): string[] {
    const phrases: string[] = [];
    
    // Extract question words
    const questionWords = ['perché', 'come', 'cosa', 'quando', 'dove', 'quanto', 'chi'];
    questionWords.forEach(word => {
      if (question.includes(word)) {
        phrases.push(word);
      }
    });
    
    // Extract unique 3-word combinations
    const words = question.split(/\s+/).filter(w => w.length > 2);
    for (let i = 0; i < words.length - 2; i++) {
      const phrase = words.slice(i, i + 3).join(' ');
      if (phrase.length > 10) {
        phrases.push(phrase);
      }
    }
    
    return phrases;
  }
  
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // DATABASE PERSISTENCE
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  
  /**
   * Save current state to database (INSERT on first call, UPDATE after)
   */
  private async saveToDatabase(): Promise<void> {
    try {
      const duration = Math.floor((Date.now() - this.startTime.getTime()) / 1000);
      const completionRate = this.getCompletionRate();
      
      const data = {
        conversationId: this.conversationId,
        agentId: this.agentId,
        currentPhase: this.state.currentPhase,
        phasesReached: this.state.phasesReached,
        phaseActivations: this.state.phaseActivations,
        checkpointsCompleted: this.state.checkpointsCompleted,
        semanticTypes: this.state.semanticTypes,
        aiReasoning: this.state.aiReasoning,
        fullTranscript: this.state.fullTranscript,
        ladderActivations: this.state.ladderActivations,
        contextualResponses: this.state.contextualResponses,
        questionsAsked: this.state.questionsAsked,
        completionRate,
        totalDuration: duration,
        // Save script snapshot for historical comparison
        scriptSnapshot: this.scriptStructure,
        scriptVersion: this.scriptStructure.version,
        // ✅ Save used script info (from Script Manager database)
        usedScriptId: this.usedScriptInfo?.id || null,
        usedScriptName: this.usedScriptInfo?.name || null,
        usedScriptType: this.usedScriptInfo?.scriptType || null,
        updatedAt: new Date()
      };
      
      // PostgreSQL UPSERT: INSERT ... ON CONFLICT DO UPDATE
      await db.insert(salesConversationTraining)
        .values(data)
        .onConflictDoUpdate({
          target: salesConversationTraining.conversationId,
          set: data
        });
      
      // console.log(`💾 [TRACKER] Saved to database (${duration}s, ${(completionRate * 100).toFixed(0)}% complete)`);
    } catch (error: any) {
      console.error(`❌ [TRACKER] Failed to save to database:`, error.message);
    }
  }
  
  /**
   * Public method to save final state (called on disconnect)
   */
  public async saveFinalState(): Promise<void> {
    console.log(`💾 [TRACKER] Saving final state for conversation ${this.conversationId}...`);
    await this.saveToDatabase();
  }
  
  /**
   * Load existing state from database (called on reconnect)
   */
  public async loadFromDatabase(): Promise<boolean> {
    try {
      console.log(`📥 [TRACKER] Loading existing state from database for conversation ${this.conversationId}...`);
      
      const [existingData] = await db.select()
        .from(salesConversationTraining)
        .where(eq(salesConversationTraining.conversationId, this.conversationId))
        .limit(1);
      
      if (!existingData) {
        console.log(`ℹ️  [TRACKER] No existing data found - starting fresh`);
        return false;
      }
      
      // Restore state from database
      this.state = {
        currentPhase: existingData.currentPhase,
        phasesReached: (existingData.phasesReached as string[]) || [],
        phaseActivations: (existingData.phaseActivations as any[]) || [],
        checkpointsCompleted: (existingData.checkpointsCompleted as any[]) || [],
        semanticTypes: (existingData.semanticTypes as string[]) || [],
        ladderActivations: (existingData.ladderActivations as any[]) || [],
        contextualResponses: (existingData.contextualResponses as any[]) || [],
        questionsAsked: (existingData.questionsAsked as any[]) || [],
        fullTranscript: (existingData.fullTranscript as any[]) || [],
        aiReasoning: (existingData.aiReasoning as any[]) || []
      };
      
      console.log(`✅ [TRACKER] State restored successfully`);
      console.log(`   - Current Phase: ${this.state.currentPhase}`);
      console.log(`   - Phases Reached: ${this.state.phasesReached.length}`);
      console.log(`   - Checkpoints: ${this.state.checkpointsCompleted.length}`);
      console.log(`   - Ladder Activations: ${this.state.ladderActivations.length}`);
      console.log(`   - Transcript Messages: ${this.state.fullTranscript.length}`);
      
      return true;
    } catch (error: any) {
      console.error(`❌ [TRACKER] Failed to load from database:`, error.message);
      return false;
    }
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // AGGREGATION - Calculate training summary for agent
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  /**
   * Calculate aggregated training summary for an agent
   * Analyzes all conversations and computes statistics
   */
  static async calculateAgentSummary(agentId: string): Promise<void> {
    try {
      console.log(`\n📊 [AGGREGATOR] Calculating training summary for agent ${agentId}...`);

      // Fetch all conversations for this agent
      const conversations = await db
        .select()
        .from(salesConversationTraining)
        .where(eq(salesConversationTraining.agentId, agentId));

      if (conversations.length === 0) {
        console.log(`⚠️  [AGGREGATOR] No conversations found for agent ${agentId} - updating with zero metrics`);
        
        // Still upsert with zero metrics to keep summary table current
        const emptyData = {
          agentId,
          totalConversations: 0,
          avgConversionRate: 0,
          phaseCompletionRates: {} as any,
          commonFailPoints: [] as any,
          checkpointCompletionRates: {} as any,
          avgConversationDuration: 0,
          ladderActivationRate: 0,
          avgLadderDepth: 0,
          bestPerformingPhases: [] as any,
          worstPerformingPhases: [] as any,
          lastStructureCheck: new Date(),
          updatedAt: new Date(),
        };
        
        await db
          .insert(salesAgentTrainingSummary)
          .values(emptyData)
          .onConflictDoUpdate({
            target: salesAgentTrainingSummary.agentId,
            set: emptyData,
          });
        
        console.log(`✅ [AGGREGATOR] Zero metrics recorded for agent ${agentId}`);
        return;
      }

      console.log(`   Found ${conversations.length} conversation(s)`);

      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      // CALCULATE AGGREGATES
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

      const totalConversations = conversations.length;

      // Average completion rate
      const avgCompletionRate =
        conversations.reduce((sum, conv) => sum + (conv.completionRate || 0), 0) /
        totalConversations;

      // Average conversation duration
      const avgConversationDuration = Math.floor(
        conversations.reduce((sum, conv) => sum + (conv.totalDuration || 0), 0) /
          totalConversations
      );

      // Phase completion rates: { phase_id: completion_rate }
      // Defensive: Normalize phasesReached to array before counting
      const phaseReachCounts: Record<string, number> = {};
      conversations.forEach(conv => {
        const phases = Array.isArray(conv.phasesReached) ? conv.phasesReached as string[] : [];
        phases.forEach(phase => {
          if (typeof phase === 'string') {
            phaseReachCounts[phase] = (phaseReachCounts[phase] || 0) + 1;
          }
        });
      });

      const phaseCompletionRates: Record<string, number> = {};
      Object.keys(phaseReachCounts).forEach(phaseId => {
        phaseCompletionRates[phaseId] = phaseReachCounts[phaseId] / totalConversations;
      });

      // Checkpoint completion rates: { checkpoint_id: completion_rate }
      // Defensive: Normalize checkpointsCompleted to array before counting
      const checkpointCompleteCounts: Record<string, number> = {};
      conversations.forEach(conv => {
        const checkpoints = Array.isArray(conv.checkpointsCompleted)
          ? (conv.checkpointsCompleted as Array<{ checkpointId: string }>)
          : [];
        
        checkpoints.forEach(cp => {
          if (cp && typeof cp.checkpointId === 'string') {
            checkpointCompleteCounts[cp.checkpointId] =
              (checkpointCompleteCounts[cp.checkpointId] || 0) + 1;
          }
        });
      });

      const checkpointCompletionRates: Record<string, number> = {};
      Object.keys(checkpointCompleteCounts).forEach(cpId => {
        checkpointCompletionRates[cpId] = checkpointCompleteCounts[cpId] / totalConversations;
      });

      // Ladder metrics
      // Defensive: Normalize ladderActivations to array before counting
      let totalLadderActivations = 0;
      let totalLadderDepth = 0;
      let conversationsWithLadder = 0;

      conversations.forEach(conv => {
        const ladders = Array.isArray(conv.ladderActivations)
          ? (conv.ladderActivations as Array<{ level: number }>)
          : [];
        
        if (ladders.length > 0) {
          conversationsWithLadder++;
          totalLadderActivations += ladders.length;
          
          // Max level reached in this conversation
          const levels = ladders.map(l => l && typeof l.level === 'number' ? l.level : 0);
          if (levels.length > 0) {
            const maxLevel = Math.max(...levels);
            totalLadderDepth += maxLevel;
          }
        }
      });

      const ladderActivationRate = conversationsWithLadder / totalConversations;
      const avgLadderDepth = conversationsWithLadder > 0 
        ? totalLadderDepth / conversationsWithLadder 
        : 0;

      // Best/Worst performing phases (top 3 and bottom 3 by completion rate)
      const phaseRates = Object.entries(phaseCompletionRates)
        .map(([phaseId, rate]) => ({ phaseId, rate }))
        .sort((a, b) => b.rate - a.rate);

      const bestPerformingPhases = phaseRates.slice(0, 3).map(p => p.phaseId);
      const worstPerformingPhases = phaseRates.slice(-3).reverse().map(p => p.phaseId);

      // Common fail points (phases/checkpoints where conversations drop off)
      const failPoints: Array<{
        phaseId: string;
        checkpointId?: string;
        failureCount: number;
        failureRate: number;
      }> = [];

      // Count drop-offs at each phase (conversations that reached phase but didn't complete)
      Object.entries(phaseReachCounts).forEach(([phaseId, reachCount]) => {
        const notCompleted = totalConversations - reachCount;
        if (notCompleted > 0) {
          failPoints.push({
            phaseId,
            failureCount: notCompleted,
            failureRate: notCompleted / totalConversations,
          });
        }
      });

      // Sort by failure rate descending and take top 5
      failPoints.sort((a, b) => b.failureRate - a.failureRate);
      const commonFailPoints = failPoints.slice(0, 5);

      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      // UPSERT TO DATABASE
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

      const summaryData = {
        agentId,
        totalConversations,
        avgConversionRate: avgCompletionRate,
        phaseCompletionRates: phaseCompletionRates as any,
        commonFailPoints: commonFailPoints as any,
        checkpointCompletionRates: checkpointCompletionRates as any,
        avgConversationDuration,
        ladderActivationRate,
        avgLadderDepth,
        bestPerformingPhases: bestPerformingPhases as any,
        worstPerformingPhases: worstPerformingPhases as any,
        lastStructureCheck: new Date(),
        updatedAt: new Date(),
      };

      await db
        .insert(salesAgentTrainingSummary)
        .values(summaryData)
        .onConflictDoUpdate({
          target: salesAgentTrainingSummary.agentId,
          set: summaryData,
        });

      console.log(`✅ [AGGREGATOR] Training summary updated for agent ${agentId}`);
      console.log(`   Total Conversations: ${totalConversations}`);
      console.log(`   Avg Completion Rate: ${(avgCompletionRate * 100).toFixed(1)}%`);
      console.log(`   Avg Duration: ${Math.floor(avgConversationDuration / 60)}m`);
      console.log(`   Ladder Activation Rate: ${(ladderActivationRate * 100).toFixed(1)}%`);
      console.log(`   Best Phases: ${bestPerformingPhases.join(', ')}`);
    } catch (error: any) {
      console.error(`❌ [AGGREGATOR] Failed to calculate summary for agent ${agentId}:`, error.message);
    }
  }
}

/**
 * Create or get existing tracker for a conversation
 * @param conversationId - ID della conversazione
 * @param agentId - ID dell'agente
 * @param initialPhase - Fase iniziale (default: phase_1)
 * @param clientId - ID del cliente (opzionale, per caricare script dal DB)
 * @param scriptType - Tipo di script (default: discovery)
 */
const trackerInstances = new Map<string, SalesScriptTracker>();

export async function getOrCreateTracker(
  conversationId: string, 
  agentId: string, 
  initialPhase?: string,
  clientId?: string,
  scriptType: 'discovery' | 'demo' | 'objections' = 'discovery'
): Promise<SalesScriptTracker> {
  let tracker = trackerInstances.get(conversationId);
  
  if (!tracker) {
    // Usa il factory method asincrono per supportare caricamento da DB
    tracker = await SalesScriptTracker.create(
      conversationId, 
      agentId, 
      initialPhase || 'phase_1',
      undefined, // logger
      clientId,
      scriptType
    );
    
    // 🔄 RECONNECT FIX: Try to load existing state from database
    const loaded = await tracker.loadFromDatabase();
    if (loaded) {
      console.log(`🔄 [TRACKER] Reconnected - state restored from database for ${conversationId}`);
    } else {
      console.log(`🆕 [TRACKER] New conversation - starting fresh for ${conversationId}`);
    }
    
    trackerInstances.set(conversationId, tracker);
  }
  
  return tracker;
}

export function removeTracker(conversationId: string): void {
  trackerInstances.delete(conversationId);
}
