import { getDiscoveryScript, getDemoScript, getObjectionsScript } from '../server/ai/sales-scripts-base';
import { parseTextToBlocks, blocksToText, extractScriptSummary, validateScriptStructure, logParsingResults } from '../shared/script-parser';

async function testParserCycle() {
  console.log('\n' + '═'.repeat(80));
  console.log('🧪 TEST PARSER CYCLE - Verifica Duplicazioni');
  console.log('═'.repeat(80));

  const scripts = [
    { name: 'Discovery', content: getDiscoveryScript([]), type: 'discovery' as const },
    { name: 'Demo', content: getDemoScript({} as any), type: 'demo' as const },
    { name: 'Obiezioni', content: getObjectionsScript(), type: 'objections' as const },
  ];

  for (const script of scripts) {
    console.log(`\n${'─'.repeat(60)}`);
    console.log(`📋 Testing: ${script.name}`);
    console.log('─'.repeat(60));

    // STEP 1: Parse original text
    console.log('\n📥 STEP 1: Parsing original text...');
    const parsed1 = parseTextToBlocks(script.content, script.type);
    const summary1 = extractScriptSummary(parsed1);
    const validation1 = validateScriptStructure(parsed1);
    
    console.log(`   Fasi: ${summary1.totalPhases}`);
    console.log(`   Step: ${summary1.totalSteps}`);
    console.log(`   Domande: ${summary1.totalQuestions} (${summary1.totalKeyQuestions} chiave)`);
    console.log(`   Energy: ${summary1.totalEnergy}`);
    console.log(`   Ladder: ${summary1.totalLadders}`);
    console.log(`   Obiezioni: ${summary1.totalObjections}`);
    console.log(`   Errori: ${validation1.errors.length}, Warning: ${validation1.warnings.length}`);

    // STEP 2: Convert blocks to text
    console.log('\n📤 STEP 2: Converting blocks to text...');
    const text2 = blocksToText(parsed1);
    console.log(`   Lunghezza testo: ${text2.length} caratteri`);

    // STEP 3: Re-parse the generated text
    console.log('\n📥 STEP 3: Re-parsing generated text...');
    const parsed2 = parseTextToBlocks(text2, script.type);
    const summary2 = extractScriptSummary(parsed2);
    const validation2 = validateScriptStructure(parsed2);

    console.log(`   Fasi: ${summary2.totalPhases}`);
    console.log(`   Step: ${summary2.totalSteps}`);
    console.log(`   Domande: ${summary2.totalQuestions} (${summary2.totalKeyQuestions} chiave)`);
    console.log(`   Energy: ${summary2.totalEnergy}`);
    console.log(`   Ladder: ${summary2.totalLadders}`);
    console.log(`   Obiezioni: ${summary2.totalObjections}`);

    // STEP 4: Compare
    console.log('\n🔍 STEP 4: Comparing results...');
    const differences: string[] = [];

    if (summary1.totalPhases !== summary2.totalPhases) {
      differences.push(`❌ Fasi: ${summary1.totalPhases} → ${summary2.totalPhases}`);
    }
    if (summary1.totalSteps !== summary2.totalSteps) {
      differences.push(`❌ Step: ${summary1.totalSteps} → ${summary2.totalSteps}`);
    }
    if (summary1.totalQuestions !== summary2.totalQuestions) {
      differences.push(`❌ Domande: ${summary1.totalQuestions} → ${summary2.totalQuestions}`);
    }
    if (summary1.totalEnergy !== summary2.totalEnergy) {
      differences.push(`⚠️ Energy: ${summary1.totalEnergy} → ${summary2.totalEnergy}`);
    }
    if (summary1.totalLadders !== summary2.totalLadders) {
      differences.push(`⚠️ Ladder: ${summary1.totalLadders} → ${summary2.totalLadders}`);
    }
    if (summary1.totalObjections !== summary2.totalObjections) {
      differences.push(`❌ Obiezioni: ${summary1.totalObjections} → ${summary2.totalObjections}`);
    }

    if (differences.length === 0) {
      console.log('   ✅ Nessuna duplicazione rilevata!');
    } else {
      console.log('   ⚠️ DIFFERENZE RILEVATE:');
      differences.forEach(d => console.log(`      ${d}`));
    }

    // Show validation warnings
    if (validation1.warnings.length > 0 || validation2.warnings.length > 0) {
      console.log('\n⚠️ Warning di validazione:');
      validation1.warnings.slice(0, 5).forEach(w => console.log(`   Parse 1: ${w}`));
      validation2.warnings.slice(0, 5).forEach(w => console.log(`   Parse 2: ${w}`));
    }
  }

  console.log('\n' + '═'.repeat(80));
  console.log('🏁 TEST COMPLETATO');
  console.log('═'.repeat(80) + '\n');
}

testParserCycle().catch(console.error);
