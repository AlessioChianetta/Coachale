import { db } from './server/db';
import { salesScripts } from './shared/schema';
import { parseTextToBlocks, blocksToText } from './shared/script-parser';

async function updateScripts() {
  console.log('🔄 Aggiornamento script con nuovo parser...\n');
  
  const scripts = await db.select().from(salesScripts);
  console.log(`📋 Trovati ${scripts.length} script\n`);
  
  for (const script of scripts) {
    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`📝 Script: ${script.name}`);
    
    const text = script.rawText || blocksToText(script.structure as any);
    const newStructure = parseTextToBlocks(text);
    
    const phase2 = newStructure.phases[1];
    if (phase2) {
      const step3 = phase2.steps[0];
      if (step3) {
        console.log(`\n📊 Step 3 - ${step3.name}:`);
        console.log(`   Domande: ${step3.questions.length}`);
        step3.questions.forEach((q, i) => {
          console.log(`   ${i+1}. "${q.text.substring(0, 50)}..."`);
        });
        
        if (step3.ladder) {
          console.log(`\n   🔍 Ladder: ${step3.ladder.levels.length} livelli`);
          step3.ladder.levels.forEach((l) => {
            console.log(`      Livello ${l.number}: "${l.question.substring(0, 40)}..."`);
          });
        }
      }
    }
    
    const phase1 = newStructure.phases[0];
    if (phase1?.checkpoint) {
      console.log(`\n⛔ Checkpoint Phase 1:`);
      console.log(`   Checks: ${phase1.checkpoint.checks.length}`);
      phase1.checkpoint.checks.forEach((c, i) => {
        console.log(`   ${i+1}. ${c.substring(0, 60)}...`);
      });
    }
    
    await db.update(salesScripts)
      .set({
        structure: newStructure as any,
        updatedAt: new Date()
      })
      .where(require('drizzle-orm').eq(salesScripts.id, script.id));
    
    console.log(`\n✅ Script aggiornato`);
  }
  
  console.log('\n\n✅ Tutti gli script sono stati aggiornati!');
  process.exit(0);
}

updateScripts().catch(console.error);
