import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

interface Question {
  id: string;
  text: string;
  marker?: string;
  type?: 'opening' | 'discovery' | 'ladder' | 'closing' | 'objection' | 'general';
  order: number;
}

interface Checkpoint {
  id: string;
  description: string;
  verifications: string[];
  lineNumber: number;
}

interface EnergySettings {
  level: 'BASSO' | 'MEDIO' | 'ALTO';
  tone: 'CALMO' | 'SICURO' | 'CONFIDENZIALE' | 'ENTUSIASTA';
  volume: 'SOFT' | 'NORMAL' | 'LOUD';
  pace: 'LENTO' | 'MODERATO' | 'VELOCE';
  vocabulary: 'FORMALE' | 'COLLOQUIALE' | 'TECNICO';
  reason?: string;
}

interface LadderLevel {
  level: number; // 1-5
  name: string; // es. "CHIARIFICAZIONE", "CONSEGUENZE"
  text: string; // Domanda o istruzione per questo livello
  purpose: string; // Scopo del livello
}

interface Biscottino {
  text: string;
  type: 'rapport' | 'value' | 'agreement' | 'other';
}

interface Step {
  id: string;
  number: number;
  name: string;
  objective: string;
  questions: Question[];
  hasLadder: boolean;
  ladderLevels: LadderLevel[]; // Array dei 5 livelli dettagliati
  energy?: EnergySettings;
  biscottini: Biscottino[];
  lineNumber: number;
}

interface Phase {
  id: string;
  number: string;
  name: string;
  description: string;
  semanticType: string;
  steps: Step[];
  checkpoints: Checkpoint[];
  energy?: EnergySettings; // Energy settings a livello di fase
  lineNumber: number;
}

interface ScriptStructure {
  version: string;
  lastExtracted: string;
  sourceFile: string;
  sourceContentHash: string;
  totalLines: number;
  phases: Phase[];
  metadata: {
    totalPhases: number;
    totalSteps: number;
    totalCheckpoints: number;
    totalQuestions: number;
    totalLadderSteps: number;
    totalBiscottini: number;
    scriptTypes: string[];
    hasEnergySettings: boolean;
  };
}

export type { Question, Checkpoint, EnergySettings, LadderLevel, Biscottino, Step, Phase, ScriptStructure };

export function parseScriptContentToStructure(content: string, scriptType: string = 'discovery'): ScriptStructure {
  const lines = content.split('\n');
  const contentHash = crypto.createHash('sha256').update(content).digest('hex');
  
  const structure: ScriptStructure = {
    version: '2.0.0',
    lastExtracted: new Date().toISOString(),
    sourceFile: `database:${scriptType}`,
    sourceContentHash: contentHash,
    totalLines: lines.length,
    phases: [],
    metadata: {
      totalPhases: 0,
      totalSteps: 0,
      totalCheckpoints: 0,
      totalQuestions: 0,
      totalLadderSteps: 0,
      totalBiscottini: 0,
      scriptTypes: [scriptType],
      hasEnergySettings: false
    }
  };

  return parseContentLines(lines, structure);
}

export function parseScriptStructure(filePath: string): ScriptStructure {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  
  const contentHash = crypto.createHash('sha256').update(content).digest('hex');
  
  const structure: ScriptStructure = {
    version: '2.0.0',
    lastExtracted: new Date().toISOString(),
    sourceFile: filePath,
    sourceContentHash: contentHash,
    totalLines: lines.length,
    phases: [],
    metadata: {
      totalPhases: 0,
      totalSteps: 0,
      totalCheckpoints: 0,
      totalQuestions: 0,
      totalLadderSteps: 0,
      totalBiscottini: 0,
      scriptTypes: ['discovery', 'demo', 'objections'],
      hasEnergySettings: false
    }
  };

  return parseContentLines(lines, structure);
}

function parseContentLines(lines: string[], structure: ScriptStructure): ScriptStructure {
  let currentPhase: Phase | null = null;
  let currentStep: Step | null = null;
  let insideLadder = false;
  let currentLadderLevels: LadderLevel[] = [];
  let questionCounter = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // PATTERN 1: Detect PHASE
    // Examples: 
    // **FASE #1 e #2 - APERTURA ED IMPOSTAZIONE**
    // **FASE #3 - PAIN POINT DISCOVERY**
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    const phaseMatch = trimmed.match(/^\*\*FASE\s+#(\d+(?:\s+e\s+#\d+)?)\s*-\s*(.+?)\*\*/i);
    if (phaseMatch) {
      // Before switching phases, assign any collected ladder levels to the current step
      if (currentStep && currentLadderLevels.length > 0) {
        currentStep.ladderLevels = [...currentLadderLevels];
      }
      
      if (currentPhase) {
        structure.phases.push(currentPhase);
      }

      const phaseNumber = phaseMatch[1];
      const phaseName = phaseMatch[2];
      
      let description = '';
      if (i + 1 < lines.length) {
        const nextLine = lines[i + 1].trim();
        if (nextLine.startsWith('**') && !nextLine.includes('FASE')) {
          description = nextLine.replace(/^\*\*|\*\*$/g, '');
        }
      }

      const semanticType = getSemanticType(phaseName);
      const phaseEnergy = extractEnergyFromContext(lines, i, 20);

      currentPhase = {
        id: `phase_${phaseNumber.replace(/\s+e\s+#/g, '_')}`,
        number: phaseNumber,
        name: phaseName,
        description,
        semanticType,
        steps: [],
        checkpoints: [],
        energy: phaseEnergy,
        lineNumber: i + 1
      };
      
      currentStep = null;
      insideLadder = false;
      currentLadderLevels = [];
      continue;
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // PATTERN 2: Detect STEP
    // Examples:
    // STEP 1 - APERTURA ENTUSIASTA:
    // STEP 3 - TROVA IL PAIN POINT PRINCIPALE:
    // **STEP 5 - CHECK**
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    const stepMatch = trimmed.match(/^(?:\*\*)?STEP\s+(\d+)\s*-\s*(.+?)(?:\*\*)?:?$/i);
    if (stepMatch && currentPhase) {
      if (currentStep && currentLadderLevels.length > 0) {
        currentStep.ladderLevels = [...currentLadderLevels];
      }

      const stepNumber = parseInt(stepMatch[1]);
      const stepName = stepMatch[2];
      
      let objective = '';
      if (i + 1 < lines.length) {
        const nextLine = lines[i + 1].trim();
        const objectiveMatch = nextLine.match(/^🎯\s*OBIETTIVO:\s*(.+)/);
        if (objectiveMatch) {
          objective = objectiveMatch[1];
        }
      }

      const stepEnergy = extractEnergyFromContext(lines, i, 15);

      currentStep = {
        id: `${currentPhase.id}_step_${stepNumber}`,
        number: stepNumber,
        name: stepName,
        objective,
        questions: [],
        hasLadder: false,
        ladderLevels: [],
        energy: stepEnergy,
        biscottini: [],
        lineNumber: i + 1
      };
      
      currentPhase.steps.push(currentStep);
      insideLadder = false;
      currentLadderLevels = [];
      continue;
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // PATTERN 3: Detect LADDER (3-5 PERCHÉ)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    if (trimmed.includes('3-5 PERCHÉ') || trimmed.includes('LADDER')) {
      if (currentStep) {
        currentStep.hasLadder = true;
      }
      insideLadder = true;
      currentLadderLevels = [];
      continue;
    }

    // Extract detailed ladder levels (LIVELLO 1-5)
    // Pattern più flessibile che supporta:
    // LIVELLO 1: NOME (con : diretto dopo numero)
    // LIVELLO 1 - NOME: (con - e nome seguito da :)
    // LIVELLO 2A: NOME (con lettera dopo numero)
    // LIVELLO 1️⃣ - NOME: (con emoji)
    // LIVELLO 3: SCAVO PROFONDO (emotivo) (con parentesi)
    const ladderLevelMatch = trimmed.match(/^LIVELLO\s+(\d+)([A-Z])?(?:️⃣)?\s*[-:]\s*(.+?)(?::)?$/i);
    if (ladderLevelMatch && insideLadder && currentStep) {
      const levelNum = parseInt(ladderLevelMatch[1]);
      const levelSuffix = ladderLevelMatch[2] || ''; // optional suffix like A, B
      const levelName = ladderLevelMatch[3].trim();
      
      let levelText = '';
      let levelPurpose = '';
      
      for (let j = i + 1; j < Math.min(i + 10, lines.length); j++) {
        const nextLine = lines[j].trim();
        if (nextLine.startsWith('LIVELLO') || nextLine.startsWith('**STEP') || 
            nextLine.startsWith('STEP') || nextLine.startsWith('⛔') || 
            nextLine.startsWith('🚨')) {
          break;
        }
        
        const questionInLevel = nextLine.match(/^"(.+?)"$/);
        if (questionInLevel && !levelText) {
          levelText = questionInLevel[1];
        }
        
        if (nextLine.includes('SCOPO:') || nextLine.includes('OBIETTIVO:')) {
          const purposeMatch = nextLine.match(/(?:SCOPO|OBIETTIVO):\s*(.+)/i);
          if (purposeMatch) {
            levelPurpose = purposeMatch[1];
          }
        }
      }

      const ladderLevel: LadderLevel = {
        level: levelNum,
        name: levelName,
        text: levelText || `Domanda livello ${levelNum}`,
        purpose: levelPurpose || getLadderPurpose(levelNum, levelName)
      };
      
      currentLadderLevels.push(ladderLevel);
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // PATTERN 4: Detect CHECKPOINT
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    if (trimmed.includes('⛔ CHECKPOINT') || trimmed.includes('🚨 CHECKPOINT')) {
      const checkpointMatch = trimmed.match(/(?:⛔|🚨)\s*CHECKPOINT\s+(?:OBBLIGATORIO\s+)?(?:FASE\s+)?(?:#)?(\d+(?:\s*-\s*\d+)?|\w+)/i);
      if (checkpointMatch && currentPhase) {
        const checkpointId = checkpointMatch[1];
        
        const verifications: string[] = [];
        for (let j = i + 1; j < Math.min(i + 30, lines.length); j++) {
          const verificationLine = lines[j].trim();
          
          if (verificationLine.startsWith('**STEP') || 
              verificationLine.startsWith('STEP') ||
              verificationLine.startsWith('**FASE') ||
              (verificationLine.includes('━━━━━━━') && lines[j + 1]?.trim().startsWith('**'))) {
            break;
          }
          
          const verificationMatch = verificationLine.match(/^(?:✓|✅|\*)\s*(.+)/);
          if (verificationMatch) {
            verifications.push(verificationMatch[1].replace(/\?$/, ''));
          }
        }

        const checkpoint: Checkpoint = {
          id: `checkpoint_${checkpointId.replace(/\s+/g, '_')}`,
          description: trimmed,
          verifications,
          lineNumber: i + 1
        };
        
        currentPhase.checkpoints.push(checkpoint);
      }
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // PATTERN 5: Extract QUESTIONS
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    const questionMatch = trimmed.match(/^"(.+?)"$/);
    if (questionMatch && currentStep) {
      const nextLine = i + 1 < lines.length ? lines[i + 1].trim() : '';
      const hasPauseMarker = nextLine.includes('⏸️') || nextLine.includes('ASPETTA');
      
      if (hasPauseMarker || trimmed.includes('?')) {
        questionCounter++;
        const questionType = determineQuestionType(currentPhase, currentStep, insideLadder);
        
        currentStep.questions.push({
          id: `q_${questionCounter}`,
          text: questionMatch[1],
          marker: hasPauseMarker ? 'pause_required' : undefined,
          type: questionType,
          order: currentStep.questions.length + 1
        });
      }
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // PATTERN 6: Extract BISCOTTINI (cookies/rapport builders)
    // Examples: 🍪 BISCOTTINO, 🎁 REGALO, ✨ COMPLIMENTO
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    const biscottinoMatch = trimmed.match(/^(?:🍪|🎁|✨)\s*(?:BISCOTTINO|REGALO|COMPLIMENTO)?\s*:?\s*"?(.+?)"?$/i);
    if (biscottinoMatch && currentStep) {
      const biscottinoText = biscottinoMatch[1].replace(/^"|"$/g, '');
      const biscottinoType = determineBiscottinoType(biscottinoText);
      
      currentStep.biscottini.push({
        text: biscottinoText,
        type: biscottinoType
      });
    }
  }

  if (currentStep && currentLadderLevels.length > 0) {
    currentStep.ladderLevels = [...currentLadderLevels];
  }

  if (currentPhase) {
    structure.phases.push(currentPhase);
  }

  // Calculate metadata
  structure.metadata.totalPhases = structure.phases.length;
  structure.metadata.totalSteps = structure.phases.reduce((sum, p) => sum + p.steps.length, 0);
  structure.metadata.totalCheckpoints = structure.phases.reduce((sum, p) => sum + p.checkpoints.length, 0);
  structure.metadata.totalQuestions = structure.phases.reduce((sum, p) => 
    p.steps.reduce((stepSum, s) => stepSum + s.questions.length, 0) + sum, 0);
  structure.metadata.totalLadderSteps = structure.phases.reduce((sum, p) => 
    p.steps.filter(s => s.hasLadder).length + sum, 0);
  structure.metadata.totalBiscottini = structure.phases.reduce((sum, p) => 
    p.steps.reduce((stepSum, s) => stepSum + s.biscottini.length, 0) + sum, 0);
  structure.metadata.hasEnergySettings = structure.phases.some(p => 
    p.energy !== undefined || p.steps.some(s => s.energy !== undefined));

  return structure;
}

function extractEnergyFromContext(lines: string[], startIndex: number, range: number): EnergySettings | undefined {
  const searchLines = lines.slice(startIndex, Math.min(startIndex + range, lines.length));
  const context = searchLines.join('\n');
  
  let level: EnergySettings['level'] | undefined;
  let tone: EnergySettings['tone'] | undefined;
  let volume: EnergySettings['volume'] | undefined;
  let pace: EnergySettings['pace'] | undefined;
  let vocabulary: EnergySettings['vocabulary'] | undefined;

  const energyMatch = context.match(/(?:🔊|ENERGY|ENERGIA)[\s:]*(\w+)/i);
  if (energyMatch) {
    const val = energyMatch[1].toUpperCase();
    if (['BASSO', 'MEDIO', 'ALTO'].includes(val)) {
      level = val as EnergySettings['level'];
    }
  }

  const toneMatch = context.match(/TONO[\s:]*(\w+)/i);
  if (toneMatch) {
    const val = toneMatch[1].toUpperCase();
    if (['CALMO', 'SICURO', 'CONFIDENZIALE', 'ENTUSIASTA'].includes(val)) {
      tone = val as EnergySettings['tone'];
    }
  }

  const volumeMatch = context.match(/VOLUME[\s:]*(\w+)/i);
  if (volumeMatch) {
    const val = volumeMatch[1].toUpperCase();
    if (['SOFT', 'NORMAL', 'LOUD'].includes(val)) {
      volume = val as EnergySettings['volume'];
    }
  }

  const paceMatch = context.match(/(?:RITMO|PACE)[\s:]*(\w+)/i);
  if (paceMatch) {
    const val = paceMatch[1].toUpperCase();
    if (['LENTO', 'MODERATO', 'VELOCE'].includes(val)) {
      pace = val as EnergySettings['pace'];
    }
  }

  const vocabMatch = context.match(/(?:LESSICO|VOCABULARY)[\s:]*(\w+)/i);
  if (vocabMatch) {
    const val = vocabMatch[1].toUpperCase();
    if (['FORMALE', 'COLLOQUIALE', 'TECNICO'].includes(val)) {
      vocabulary = val as EnergySettings['vocabulary'];
    }
  }

  if (level || tone || volume || pace || vocabulary) {
    return {
      level: level || 'MEDIO',
      tone: tone || 'SICURO',
      volume: volume || 'NORMAL',
      pace: pace || 'MODERATO',
      vocabulary: vocabulary || 'COLLOQUIALE'
    };
  }

  return undefined;
}

function determineQuestionType(phase: Phase | null, step: Step | null, insideLadder: boolean): Question['type'] {
  if (insideLadder) return 'ladder';
  if (!phase) return 'general';
  
  const semanticType = phase.semanticType;
  if (semanticType === 'opening') return 'opening';
  if (semanticType === 'discovery') return 'discovery';
  if (semanticType === 'closing') return 'closing';
  if (semanticType === 'objection_handling') return 'objection';
  
  return 'general';
}

function determineBiscottinoType(text: string): Biscottino['type'] {
  const lowerText = text.toLowerCase();
  if (lowerText.includes('compliment') || lowerText.includes('bravo') || lowerText.includes('ottimo')) {
    return 'rapport';
  }
  if (lowerText.includes('valore') || lowerText.includes('benefic') || lowerText.includes('vantaggi')) {
    return 'value';
  }
  if (lowerText.includes('esatto') || lowerText.includes('giusto') || lowerText.includes('accord')) {
    return 'agreement';
  }
  return 'other';
}

function getLadderPurpose(level: number, name: string): string {
  const purposes: Record<number, string> = {
    1: 'Chiarificare il problema iniziale e confermare la comprensione',
    2: 'Esplorare le conseguenze pratiche del problema',
    3: 'Scoprire l\'impatto emotivo e personale',
    4: 'Trovare la motivazione profonda del cambiamento',
    5: 'Visualizzare il futuro ideale e la trasformazione desiderata'
  };
  return purposes[level] || `Approfondimento livello ${level}`;
}

function getSemanticType(phaseName: string): string {
  const name = phaseName.toLowerCase();
  
  if (name.includes('apertura') || name.includes('impostazione')) {
    return 'opening';
  }
  if (name.includes('pain') || name.includes('discovery')) {
    return 'discovery';
  }
  if (name.includes('info business') || name.includes('business')) {
    return 'business_info';
  }
  if (name.includes('stretch') || name.includes('gap')) {
    return 'gap_stretching';
  }
  if (name.includes('qualificazione')) {
    return 'qualification';
  }
  if (name.includes('urgenza') || name.includes('budget') || name.includes('serietà')) {
    return 'urgency_budget';
  }
  if (name.includes('demo') || name.includes('presentazione')) {
    return 'demo';
  }
  if (name.includes('obiezioni')) {
    return 'objection_handling';
  }
  if (name.includes('closing') || name.includes('chiusura')) {
    return 'closing';
  }
  
  return 'other';
}

export default parseScriptStructure;
