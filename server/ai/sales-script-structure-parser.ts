import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { fileURLToPath } from 'url';

interface Question {
  text: string;
  marker?: string;
}

interface Checkpoint {
  id: string;
  description: string;
  verifications: string[];
  lineNumber: number;
}

interface Step {
  id: string;
  number: number;
  name: string;
  objective: string;
  questions: Question[];
  hasLadder: boolean;
  ladderLevels?: number;
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
  lineNumber: number;
}

interface ScriptStructure {
  version: string;
  lastExtracted: string;
  sourceFile: string;
  sourceContentHash: string; // SHA-256 hash of source file content for version detection
  totalLines: number;
  phases: Phase[];
  metadata: {
    totalPhases: number;
    totalSteps: number;
    totalCheckpoints: number;
    scriptTypes: string[];
  };
}

export function parseScriptStructure(filePath: string): ScriptStructure {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  
  // Calculate SHA-256 hash of source content for version detection
  const contentHash = crypto.createHash('sha256').update(content).digest('hex');
  
  const structure: ScriptStructure = {
    version: '1.0.0',
    lastExtracted: new Date().toISOString(),
    sourceFile: filePath,
    sourceContentHash: contentHash,
    totalLines: lines.length,
    phases: [],
    metadata: {
      totalPhases: 0,
      totalSteps: 0,
      totalCheckpoints: 0,
      scriptTypes: ['discovery', 'demo', 'objections']
    }
  };

  let currentPhase: Phase | null = null;
  let currentStep: Step | null = null;
  let insideLadder = false;
  let ladderLevel = 0;

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
      // Save previous phase if exists
      if (currentPhase) {
        structure.phases.push(currentPhase);
      }

      const phaseNumber = phaseMatch[1];
      const phaseName = phaseMatch[2];
      
      // Extract description from next lines
      let description = '';
      if (i + 1 < lines.length) {
        const nextLine = lines[i + 1].trim();
        if (nextLine.startsWith('**') && !nextLine.includes('FASE')) {
          description = nextLine.replace(/^\*\*|\*\*$/g, '');
        }
      }

      // Determine semantic type based on phase name
      const semanticType = getSemanticType(phaseName);

      currentPhase = {
        id: `phase_${phaseNumber.replace(/\s+e\s+#/g, '_')}`,
        number: phaseNumber,
        name: phaseName,
        description,
        semanticType,
        steps: [],
        checkpoints: [],
        lineNumber: i + 1
      };
      
      currentStep = null;
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
      const stepNumber = parseInt(stepMatch[1]);
      const stepName = stepMatch[2];
      
      // Extract objective from next lines
      let objective = '';
      if (i + 1 < lines.length) {
        const nextLine = lines[i + 1].trim();
        const objectiveMatch = nextLine.match(/^🎯\s*OBIETTIVO:\s*(.+)/);
        if (objectiveMatch) {
          objective = objectiveMatch[1];
        }
      }

      currentStep = {
        id: `step_${stepNumber}`,
        number: stepNumber,
        name: stepName,
        objective,
        questions: [],
        hasLadder: false,
        lineNumber: i + 1
      };
      
      currentPhase.steps.push(currentStep);
      insideLadder = false;
      ladderLevel = 0;
      continue;
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // PATTERN 3: Detect LADDER (3-5 PERCHÉ)
    // Examples:
    // 🔍 REGOLA DEI 3-5 PERCHÉ - SCAVO PROFONDO (OBBLIGATORIO)
    // 🔥 LADDER EMOTIVO (OBBLIGATORIO - 3-5 PERCHÉ)
    // LIVELLO 1️⃣ - CHIARIFICAZIONE:
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    if (trimmed.includes('3-5 PERCHÉ') || trimmed.includes('LADDER')) {
      if (currentStep) {
        currentStep.hasLadder = true;
      }
      insideLadder = true;
      ladderLevel = 0;
      continue;
    }

    // Detect ladder levels
    const ladderLevelMatch = trimmed.match(/^LIVELLO\s+(\d+)(?:️⃣)?\s*-/);
    if (ladderLevelMatch && insideLadder) {
      ladderLevel = parseInt(ladderLevelMatch[1]);
      if (currentStep && (!currentStep.ladderLevels || currentStep.ladderLevels < ladderLevel)) {
        currentStep.ladderLevels = ladderLevel;
      }
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // PATTERN 4: Detect CHECKPOINT
    // Examples:
    // ⛔ CHECKPOINT OBBLIGATORIO FASE #1-2 ⛔
    // ⛔ CHECKPOINT OBBLIGATORIO FASE #3 ⛔
    // 🚨 CHECKPOINT OBBLIGATORIO #3 - STRUMENTI:
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    if (trimmed.includes('⛔ CHECKPOINT') || trimmed.includes('🚨 CHECKPOINT')) {
      const checkpointMatch = trimmed.match(/(?:⛔|🚨)\s*CHECKPOINT\s+(?:OBBLIGATORIO\s+)?(?:FASE\s+)?(?:#)?(\d+(?:\s*-\s*\d+)?|\w+)/i);
      if (checkpointMatch && currentPhase) {
        const checkpointId = checkpointMatch[1];
        
        // Extract verifications from following lines
        const verifications: string[] = [];
        for (let j = i + 1; j < Math.min(i + 30, lines.length); j++) {
          const verificationLine = lines[j].trim();
          
          // Stop at next section
          if (verificationLine.startsWith('**STEP') || 
              verificationLine.startsWith('STEP') ||
              verificationLine.startsWith('**FASE') ||
              verificationLine.includes('━━━━━━━') && lines[j + 1]?.trim().startsWith('**')) {
            break;
          }
          
          // Extract verification items (✓, ✅, or bullet points)
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
    // Questions are in quotes and followed by ⏸️ ASPETTA LA RISPOSTA
    // Examples:
    // "Ciao [NOME_PROSPECT]! Benvenuto/a in questa consulenza, come stai?"
    // "Dimmi, perché hai deciso di partecipare a questa call?"
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    const questionMatch = trimmed.match(/^"(.+?)"$/);
    if (questionMatch && currentStep) {
      // Check if next line has pause marker
      const nextLine = i + 1 < lines.length ? lines[i + 1].trim() : '';
      const hasPauseMarker = nextLine.includes('⏸️') || nextLine.includes('ASPETTA');
      
      if (hasPauseMarker || trimmed.includes('?')) {
        currentStep.questions.push({
          text: questionMatch[1],
          marker: hasPauseMarker ? 'pause_required' : undefined
        });
      }
    }
  }

  // Add last phase
  if (currentPhase) {
    structure.phases.push(currentPhase);
  }

  // Calculate metadata
  structure.metadata.totalPhases = structure.phases.length;
  structure.metadata.totalSteps = structure.phases.reduce((sum, p) => sum + p.steps.length, 0);
  structure.metadata.totalCheckpoints = structure.phases.reduce((sum, p) => sum + p.checkpoints.length, 0);

  return structure;
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

// Main execution
async function main() {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const scriptPath = path.join(__dirname, 'sales-scripts-base.ts');
  const outputPath = path.join(__dirname, 'sales-script-structure.json');
  
  console.log('🔍 Parsing sales script structure...');
  console.log(`   Source: ${scriptPath}`);
  
  try {
    const structure = parseScriptStructure(scriptPath);
    
    // Save to JSON file
    fs.writeFileSync(
      outputPath,
      JSON.stringify(structure, null, 2),
      'utf-8'
    );
    
    console.log('\n✅ Script structure extracted successfully!');
    console.log(`   Output: ${outputPath}`);
    console.log('\n📊 Statistics:');
    console.log(`   Total Phases: ${structure.metadata.totalPhases}`);
    console.log(`   Total Steps: ${structure.metadata.totalSteps}`);
    console.log(`   Total Checkpoints: ${structure.metadata.totalCheckpoints}`);
    console.log(`   Total Lines: ${structure.totalLines}`);
    
    console.log('\n📋 Phase Summary:');
    structure.phases.forEach(phase => {
      console.log(`   ${phase.id}: ${phase.name}`);
      console.log(`      Steps: ${phase.steps.length}, Checkpoints: ${phase.checkpoints.length}`);
      console.log(`      Semantic Type: ${phase.semanticType}`);
    });
    
  } catch (error: any) {
    console.error('❌ Error parsing script:', error.message);
    process.exit(1);
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export default parseScriptStructure;
