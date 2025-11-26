import { db } from '../server/db';
import { salesScripts } from '../shared/schema';
import { eq } from 'drizzle-orm';

// Copy of the parseScriptStructure function with corrected IDs
function parseScriptStructure(content: string, scriptType: string): any {
  const phases: any[] = [];
  
  try {
    // Parse phases from markdown-like content
    const phaseMatches = content.matchAll(/\*\*FASE #?(\d+(?:\s*e\s*#?\d+)?)\s*[-–]\s*([^*]+)\*\*/gi);
    
    for (const match of phaseMatches) {
      const phaseNumber = match[1].trim();
      const phaseName = match[2].trim();
      const phaseId = `phase_${phaseNumber.replace(/\s+/g, '_').replace('#', '')}`;
      
      phases.push({
        id: phaseId,
        number: phaseNumber,
        name: phaseName,
        description: '',
        semanticType: getSemanticType(phaseName),
        steps: [],
        checkpoints: [],
      });
    }
    
    // Parse steps within each phase
    const stepMatches = content.matchAll(/STEP\s+(\d+)\s*[-–]\s*([^:\n*]+)/gi);
    
    for (const match of stepMatches) {
      const stepNumber = parseInt(match[1]);
      let stepName = match[2].trim();
      stepName = stepName.replace(/\*\*.*$/, '').trim();
      stepName = stepName.replace(/\n.*$/, '').trim();
      
      const stepPosition = match.index || 0;
      let currentPhaseIndex = 0;
      
      for (let i = 0; i < phases.length; i++) {
        const phasePattern = new RegExp(`\\*\\*FASE\\s*#?${phases[i].number}`, 'i');
        const phaseMatch = content.match(phasePattern);
        const phasePosition = phaseMatch?.index || 0;
        
        const nextPhasePosition = i < phases.length - 1 
          ? (content.match(new RegExp(`\\*\\*FASE\\s*#?${phases[i + 1].number}`, 'i'))?.index || content.length)
          : content.length;
        
        if (stepPosition > phasePosition && stepPosition < nextPhasePosition) {
          currentPhaseIndex = i;
          break;
        }
      }
      
      if (phases[currentPhaseIndex]) {
        const phaseId = phases[currentPhaseIndex].id;
        const objectiveMatch = content.slice(match.index).match(/🎯\s*OBIETTIVO:\s*([^\n]+)/i);
        
        const questions: Array<{text: string; id: string}> = [];
        const stepContent = content.slice(match.index!, match.index! + 3000);
        
        const questionPatterns = [
          /📌\s*(?:DOMANDA[^:]*:)?\s*\n?\s*[""]([^""]+)[""]/gi,
          /"([^"]{20,})"/g,
        ];
        
        for (const pattern of questionPatterns) {
          const questionMatches = stepContent.matchAll(pattern);
          for (const q of questionMatches) {
            const questionText = q[1].trim();
            if (!questions.some(existing => existing.text === questionText)) {
              questions.push({ 
                id: `${phaseId}_step_${stepNumber}_q_${questions.length + 1}`,
                text: questionText 
              });
            }
          }
        }
        
        phases[currentPhaseIndex].steps.push({
          id: `${phaseId}_step_${stepNumber}`,
          number: stepNumber,
          name: stepName,
          objective: objectiveMatch ? objectiveMatch[1].trim() : '',
          questions,
          hasLadder: stepContent.toLowerCase().includes('ladder') || stepContent.toLowerCase().includes('perché'),
        });
      }
    }
    
  } catch (error) {
    console.error('Error parsing script structure:', error);
  }
  
  return {
    version: '1.0.0',
    scriptType,
    phases,
    parsedAt: new Date().toISOString(),
  };
}

function getSemanticType(phaseName: string): string {
  const name = phaseName.toLowerCase();
  if (name.includes('apertura') || name.includes('impostazione')) return 'opening';
  if (name.includes('pain') || name.includes('discovery')) return 'discovery';
  if (name.includes('business') || name.includes('info')) return 'business_info';
  if (name.includes('inquisitorio') || name.includes('gap')) return 'gap_stretching';
  if (name.includes('qualificazione')) return 'qualification';
  if (name.includes('serietà') || name.includes('urgenza')) return 'urgency_budget';
  if (name.includes('demo') || name.includes('presentazione')) return 'presentation';
  if (name.includes('obiezioni')) return 'objections';
  if (name.includes('closing') || name.includes('chiusura')) return 'closing';
  return 'general';
}

async function reparseAllScripts() {
  console.log('🔄 Starting script re-parsing...\n');
  
  const scripts = await db.select().from(salesScripts);
  
  console.log(`Found ${scripts.length} scripts to re-parse\n`);
  
  for (const script of scripts) {
    console.log(`\n📝 Re-parsing: ${script.name}`);
    console.log(`   ID: ${script.id}`);
    console.log(`   Type: ${script.scriptType}`);
    
    const newStructure = parseScriptStructure(script.content, script.scriptType);
    
    console.log(`   Phases: ${newStructure.phases?.length || 0}`);
    
    if (newStructure.phases?.length > 0) {
      for (const phase of newStructure.phases) {
        console.log(`   └─ ${phase.id}: ${phase.name}`);
        for (const step of phase.steps || []) {
          console.log(`      └─ ${step.id}: ${step.name} (${step.questions?.length || 0} questions)`);
        }
      }
    }
    
    await db.update(salesScripts)
      .set({ 
        structure: newStructure,
        updatedAt: new Date()
      })
      .where(eq(salesScripts.id, script.id));
    
    console.log(`   ✅ Updated!`);
  }
  
  console.log('\n✅ All scripts re-parsed successfully!');
  process.exit(0);
}

reparseAllScripts().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
