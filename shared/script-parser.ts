import {
  ScriptBlockStructure,
  ScriptMetadata,
  GlobalRule,
  Phase,
  Step,
  Question,
  QuestionInstructions,
  EnergySettings,
  Checkpoint,
  ResistanceHandling,
  ResistanceStep,
  Ladder,
  LadderLevel,
  Biscottino,
  Objection,
} from './script-blocks';

let blockIdCounter = 0;

export function generateBlockId(): string {
  blockIdCounter++;
  return `block_${Date.now()}_${blockIdCounter}_${Math.random().toString(36).substr(2, 9)}`;
}

export function resetBlockIdCounter(): void {
  blockIdCounter = 0;
}

function extractVocabulary(text: string): string[] {
  const matches = text.match(/"([^"]+)"/g);
  if (matches) {
    return matches.map(m => m.replace(/"/g, '').trim()).filter(v => v.length > 0);
  }
  const slashMatches = text.match(/([A-Za-zÀ-ÿ!]+\s*\/\s*)+[A-Za-zÀ-ÿ!]+/g);
  if (slashMatches) {
    return slashMatches[0].split('/').map(v => v.trim()).filter(v => v.length > 0);
  }
  return [];
}

function parseEnergySettings(text: string): EnergySettings | undefined {
  // Match standard format ⚡ ENERGIA: or box format ║  ⚡ ENERGIA
  const energyMatch = text.match(/(?:║\s*)?⚡\s*(?:ENERGIA|RITMO)[^:]*:\s*([^\n║]+)/i);
  const toneMatch = text.match(/(?:║\s*)?🎵\s*TONO:\s*([^\n║]+)/i);
  const volumeMatch = text.match(/(?:║\s*)?📢\s*VOLUME:\s*([^\n║]+)/i);
  const rhythmMatch = text.match(/(?:║\s*)?🏃\s*RITMO:\s*([^\n║]+)/i);
  const inflectionMatch = text.match(/(?:║\s*)?(?:📈|🎭)\s*INFLESSIONI?[^:]*:\s*([^\n║]+)/i);
  const vocabMatch = text.match(/(?:║\s*)?(?:✅|📣)\s*LESSICO[^:]*:\s*([^\n║]+(?:\n\s+"[^"]+[^\n]+)*)/i);
  const mindsetMatch = text.match(/(?:║\s*)?💪\s*MINDSET:\s*([^\n║]+)/i);
  const exampleMatch = text.match(/(?:║\s*)?💬\s*ESEMPIO[^:]*:\s*([\s\S]*?)(?=(?:║\s*$|💪|━|╚|$))/i) ||
                       text.match(/(?:║\s*)?🎬\s*ESEMPIO[^:]*:\s*([\s\S]*?)(?=(?:║\s*$|💪|━|╚|$))/i);

  if (!energyMatch && !toneMatch) {
    return undefined;
  }

  return {
    level: energyMatch?.[1]?.trim() || '',
    tone: toneMatch?.[1]?.trim() || '',
    volume: volumeMatch?.[1]?.trim() || '',
    rhythm: rhythmMatch?.[1]?.trim() || '',
    inflections: inflectionMatch?.[1]?.trim(),
    vocabulary: vocabMatch ? extractVocabulary(vocabMatch[1]) : [],
    mindset: mindsetMatch?.[1]?.trim(),
    example: exampleMatch?.[1]?.trim(),
  };
}

function parseQuestionInstructions(text: string): QuestionInstructions {
  const hasWait = /⏸️\s*ASPETTA/i.test(text);
  const listenMatch = text.match(/🎧\s*ASCOLTA\s*([^\n]*)/i);
  const reactMatches = text.match(/💬\s*REAGISCI[^:]*:\s*([^\n]+)/gi);

  const reactions: string[] = [];
  if (reactMatches) {
    reactMatches.forEach(m => {
      const content = m.replace(/💬\s*REAGISCI[^:]*:\s*/i, '').trim();
      const phrases = content.split(/[\/\|]/).map(p => p.trim()).filter(p => p.length > 0);
      reactions.push(...phrases);
    });
  }

  return {
    wait: hasWait,
    listen: listenMatch?.[1]?.trim(),
    react: reactions.length > 0 ? reactions : undefined,
  };
}

function parseQuestions(text: string): Question[] {
  const questions: Question[] = [];
  const questionBlocks = text.split(/(?=📌\s)/);

  for (const block of questionBlocks) {
    if (!block.trim().startsWith('📌')) continue;

    const lines = block.split('\n');
    const firstLine = lines[0].replace('📌', '').trim();
    
    const markerMatch = firstLine.match(/^([A-Z\s]+(?:\s*-\s*[^\n:]+)?)\s*[:\-]\s*/i);
    let marker = '';
    let questionText = firstLine;

    if (markerMatch) {
      marker = markerMatch[1].trim();
      questionText = firstLine.replace(markerMatch[0], '').trim();
    }

    const fullBlock = block;
    const textMatch = fullBlock.match(/"([^"]+)"/);
    if (textMatch) {
      questionText = textMatch[1];
    } else if (!questionText || questionText.length < 5) {
      const contentLines = lines.slice(1).filter(l => 
        l.trim() && 
        !l.includes('⏸️') && 
        !l.includes('🎧') && 
        !l.includes('💬') &&
        !l.startsWith('   →')
      );
      if (contentLines.length > 0) {
        questionText = contentLines.join(' ').trim().replace(/^\s*"|"\s*$/g, '');
      }
    }

    const conditionMatch = block.match(/SE\s+([^:\n]+)/i);
    const isKey = /CHIAVE|PRINCIPALE|KEY/i.test(marker) || /DOMANDA CHIAVE/i.test(block);

    questions.push({
      id: generateBlockId(),
      text: questionText,
      marker: marker || undefined,
      instructions: parseQuestionInstructions(block),
      isKey,
      condition: conditionMatch?.[1]?.trim(),
    });
  }

  return questions;
}

function parseLadder(text: string): Ladder | undefined {
  const titleMatch = text.match(/(?:🔍|📋)\s*(?:LADDER|REGOLA)\s*(?:DEI\s*)?([^\n]+)/i);
  if (!titleMatch) return undefined;

  const levels: LadderLevel[] = [];
  const levelPattern = /LIVELLO\s*(\d+)️⃣\s*[-–—]\s*([^:\n]+):\s*(?:━+\s*)?"?([^"]*)"?\s*(?:\n\n|⏸️)/gi;
  
  let match;
  while ((match = levelPattern.exec(text)) !== null) {
    levels.push({
      number: parseInt(match[1]),
      name: match[2].trim(),
      question: match[3].trim().replace(/^["']|["']$/g, ''),
    });
  }

  if (levels.length === 0) {
    const simplePattern = /LIVELLO\s*(\d+)️⃣[^"]*"([^"]+)"/gi;
    while ((match = simplePattern.exec(text)) !== null) {
      levels.push({
        number: parseInt(match[1]),
        name: `Livello ${match[1]}`,
        question: match[2].trim(),
      });
    }
  }

  const whenToUse: string[] = [];
  const whenToUseMatch = text.match(/⚠️\s*QUANDO\s*ATTIVARLA:?\s*([\s\S]*?)(?=❌|📋|LIVELLO)/i);
  if (whenToUseMatch) {
    const items = whenToUseMatch[1].match(/[✓✅]\s*([^\n]+)/g);
    if (items) {
      whenToUse.push(...items.map(i => i.replace(/^[✓✅]\s*/, '').trim()));
    }
  }

  const stopWhen: string[] = [];
  const stopMatch = text.match(/🛑\s*FERMATI\s*QUANDO:?\s*([\s\S]*?)(?=❌|💡|---|$)/i);
  if (stopMatch) {
    const items = stopMatch[1].match(/[✓✅]\s*([^\n]+)/g);
    if (items) {
      stopWhen.push(...items.map(i => i.replace(/^[✓✅]\s*/, '').trim()));
    }
  }

  return {
    title: titleMatch[1].trim(),
    whenToUse: whenToUse.length > 0 ? whenToUse : undefined,
    levels,
    stopWhen: stopWhen.length > 0 ? stopWhen : undefined,
  };
}

function parseBiscottino(text: string): Biscottino | undefined {
  const match = text.match(/🍪\s*SE\s*DIVAGA:?\s*([^\n]+)/i);
  if (!match) return undefined;

  return {
    trigger: 'SE DIVAGA',
    phrase: match[1].trim(),
  };
}

function parseCheckpoint(text: string): Checkpoint | undefined {
  const titleMatch = text.match(/⛔\s*CHECKPOINT\s*(?:OBBLIGATORIO)?\s*(?:FASE\s*)?([^\n⛔]+)?/i);
  if (!titleMatch) return undefined;

  const checks: string[] = [];
  const checksMatches = text.match(/[✓✅]\s*([^\n?]+\??)/g);
  if (checksMatches) {
    checks.push(...checksMatches.map(c => c.replace(/^[✓✅]\s*/, '').trim()));
  }

  let resistanceHandling: ResistanceHandling | undefined;
  const resistanceMatch = text.match(/🛡️\s*GESTIONE\s*RESISTENZA[^:]*:?\s*([\s\S]*?)(?=✅\s*SOLO|---|$)/i);
  if (resistanceMatch) {
    const triggerMatch = resistanceMatch[1].match(/SE\s*(?:IL\s*PROSPECT\s*)?(?:DICE|CHIEDE)?:?\s*"?([^"\n]+)"?/i);
    const responseMatch = resistanceMatch[1].match(/RISPOSTA\s*(?:OBBLIGATORIA)?:?\s*(?:━+\s*)?([\s\S]*?)(?=⏸️|STEP|$)/i);
    
    const steps: ResistanceStep[] = [];
    const stepMatches = resistanceMatch[1].match(/STEP\s*\d+\s*[-–—]\s*([^:]+):\s*([^\n]+)/gi);
    if (stepMatches) {
      stepMatches.forEach(s => {
        const parts = s.match(/STEP\s*\d+\s*[-–—]\s*([^:]+):\s*(.+)/i);
        if (parts) {
          steps.push({
            action: parts[1].trim(),
            script: parts[2].trim().replace(/^["']|["']$/g, ''),
          });
        }
      });
    }

    resistanceHandling = {
      trigger: triggerMatch?.[1]?.trim() || 'Prospect resiste',
      response: responseMatch?.[1]?.trim() || '',
      steps: steps.length > 0 ? steps : undefined,
    };
  }

  const reminderMatch = text.match(/🚨\s*REMINDER[^:]*:?\s*([\s\S]*?)(?=---|$)/i);

  return {
    title: titleMatch[1]?.trim() || 'Checkpoint',
    checks,
    resistanceHandling,
    reminder: reminderMatch?.[1]?.trim(),
  };
}

function parseStep(text: string): Step | undefined {
  // Match both regular STEP N - NAME: and **STEP N - NAME** formats (with optional bold markers)
  const headerMatch = text.match(/(?:\*\*)?STEP\s*(\d+)\s*[-–—]\s*([^:\n*]+)(?:\*\*)?:?/i);
  if (!headerMatch) return undefined;

  const objectiveMatch = text.match(/🎯\s*OBIETTIVO:\s*([^\n]+)/i);
  
  return {
    id: generateBlockId(),
    number: parseInt(headerMatch[1]),
    name: headerMatch[2].trim(),
    objective: objectiveMatch?.[1]?.trim() || '',
    energy: parseEnergySettings(text),
    questions: parseQuestions(text),
    biscottino: parseBiscottino(text),
    ladder: parseLadder(text),
    notes: undefined,
  };
}

function parsePhase(text: string): Phase | undefined {
  const headerMatch = text.match(/\*\*FASE\s*#?([\d\w\s]+(?:\s*e\s*#?\d+)?)\s*[-–—]\s*([^*\n]+)\*\*/i);
  if (!headerMatch) {
    const altMatch = text.match(/FASE\s*#?([\d\w]+)\s*[-–—]\s*([^\n]+)/i);
    if (!altMatch) return undefined;
    headerMatch[1] = altMatch[1];
    headerMatch[2] = altMatch[2];
  }

  const descMatch = text.match(/\*\*([^*]+)\*\*\s*$/m);
  
  const steps: Step[] = [];
  // Split on both regular and bold STEP formats
  const stepSections = text.split(/(?=(?:\*\*)?STEP\s*\d+\s*[-–—])/i);
  
  for (const section of stepSections) {
    // Match both regular and bold step headers
    if (/^(?:\*\*)?STEP\s*\d+/i.test(section.trim())) {
      const step = parseStep(section);
      if (step) {
        steps.push(step);
      }
    }
  }

  return {
    id: generateBlockId(),
    number: headerMatch[1].trim(),
    name: headerMatch[2].trim(),
    description: descMatch?.[1]?.trim(),
    energy: parseEnergySettings(text.split(/(?:\*\*)?STEP\s*\d+/i)[0] || ''),
    steps,
    checkpoint: parseCheckpoint(text),
    transition: undefined,
  };
}

function parseGlobalRules(text: string): GlobalRule[] {
  const rules: GlobalRule[] = [];

  const criticalMatch = text.match(/🚨🚨🚨\s*([^\n]+)\s*🚨🚨🚨\s*([\s\S]*?)(?=════|💎|$)/i);
  if (criticalMatch) {
    const items: string[] = [];
    const itemMatches = criticalMatch[2].match(/[✓✅❌]\s*([^\n]+)/g);
    if (itemMatches) {
      items.push(...itemMatches.map(i => i.replace(/^[✓✅❌]\s*/, '').trim()));
    }

    rules.push({
      id: generateBlockId(),
      type: 'critical',
      title: criticalMatch[1].trim(),
      content: criticalMatch[2].trim(),
      items: items.length > 0 ? items : undefined,
    });
  }

  const goldenRegex = /💎\s*REGOLA\s*D['']ORO:?\s*([^\n]+(?:\n[^\n💎🚨═]+)*)/gi;
  let goldenMatch;
  while ((goldenMatch = goldenRegex.exec(text)) !== null) {
    rules.push({
      id: generateBlockId(),
      type: 'golden',
      title: "REGOLA D'ORO",
      content: goldenMatch[1].trim(),
    });
  }

  return rules;
}

function parseObjections(text: string): Objection[] {
  const objections: Objection[] = [];
  const objectionBlocks = text.split(/(?=###\s*OBIEZIONE\s*#?\d+)/i);

  for (const block of objectionBlocks) {
    const headerMatch = block.match(/###\s*OBIEZIONE\s*#?(\d+):?\s*"?([^"\n]+)"?/i);
    if (!headerMatch) continue;

    const objectiveMatch = block.match(/🎯\s*OBIETTIVO:\s*([^\n]+)/i);
    const reframeMatch = block.match(/\*\*REFRAME:\*\*\s*([\s\S]*?)(?=\*\*DOMANDA|🔍|---|$)/i);
    const keyQuestionMatch = block.match(/\*\*DOMANDA\s*(?:CHIAVE|KEY)?:?\*\*\s*([^\n]+)/i);
    const analogyMatch = block.match(/\*\*ANALOGIA:\*\*\s*([\s\S]*?)(?=\*\*|---|$)/i);

    const variants: string[] = [];
    const variantMatches = block.match(/^\s*[-•]\s*"([^"]+)"/gm);
    if (variantMatches) {
      variants.push(...variantMatches.map(v => v.replace(/^\s*[-•]\s*"?|"$/g, '').trim()));
    }

    objections.push({
      id: generateBlockId(),
      number: parseInt(headerMatch[1]),
      title: headerMatch[2].trim().replace(/^["']|["']$/g, ''),
      variants: variants.length > 0 ? variants : undefined,
      objective: objectiveMatch?.[1]?.trim() || '',
      energy: parseEnergySettings(block),
      ladder: parseLadder(block),
      reframe: reframeMatch?.[1]?.trim() || '',
      keyQuestion: keyQuestionMatch?.[1]?.trim() || '',
      analogy: analogyMatch?.[1]?.trim(),
    });
  }

  return objections;
}

export function parseTextToBlocks(
  text: string,
  scriptType: 'discovery' | 'demo' | 'objections'
): ScriptBlockStructure {
  resetBlockIdCounter();

  const metadata: ScriptMetadata = {
    name: scriptType === 'discovery' 
      ? 'Script Discovery Call' 
      : scriptType === 'demo' 
        ? 'Script Demo di Vendita' 
        : 'Script Gestione Obiezioni',
    type: scriptType,
    version: '1.0',
    description: scriptType === 'discovery'
      ? 'Script completo per la discovery call - seguire esattamente questo framework'
      : scriptType === 'demo'
        ? 'Script per la demo di vendita - presentazione e closing'
        : 'Script per la gestione delle obiezioni più comuni',
  };

  const globalRules = parseGlobalRules(text);

  const phases: Phase[] = [];
  const phaseSections = text.split(/(?=═{3,}[^═]*\*\*FASE\s*#?[\d\w])/i);
  
  for (const section of phaseSections) {
    if (/\*\*FASE\s*#?[\d\w]/i.test(section)) {
      const phase = parsePhase(section);
      if (phase) {
        phases.push(phase);
      }
    }
  }

  // Only create fallback phase if NO phases were parsed AND there are actual steps
  if (phases.length === 0) {
    // Split on both regular and bold STEP formats
    const stepSections = text.split(/(?=(?:\*\*)?STEP\s*\d+\s*[-–—])/i);
    const steps: Step[] = [];
    
    for (const section of stepSections) {
      // Match both regular and bold step headers
      if (/^(?:\*\*)?STEP\s*\d+/i.test(section.trim())) {
        const step = parseStep(section);
        if (step) {
          steps.push(step);
        }
      }
    }
    
    if (steps.length > 0) {
      phases.push({
        id: generateBlockId(),
        number: '1',
        name: 'Fase Principale',
        steps,
      });
    }
  }

  let objections: Objection[] | undefined;
  if (scriptType === 'objections' || text.includes('### OBIEZIONE')) {
    objections = parseObjections(text);
  }

  const finalRulesMatch = text.match(/(?:REGOLE?\s*FINAL[EI]|CONCLUSIONE|CHIUSURA)\s*:?\s*([\s\S]*?)$/i);
  const finalRules: GlobalRule[] = [];
  if (finalRulesMatch) {
    const ruleItems = finalRulesMatch[1].match(/[✓✅]\s*([^\n]+)/g);
    if (ruleItems && ruleItems.length > 0) {
      finalRules.push({
        id: generateBlockId(),
        type: 'reminder',
        title: 'Regole Finali',
        content: finalRulesMatch[1].trim(),
        items: ruleItems.map(r => r.replace(/^[✓✅]\s*/, '').trim()),
      });
    }
  }

  return {
    metadata,
    globalRules,
    phases,
    objections: objections && objections.length > 0 ? objections : undefined,
    finalRules: finalRules.length > 0 ? finalRules : undefined,
  };
}

function formatEnergySettings(energy: EnergySettings): string {
  const lines: string[] = [];
  lines.push('🎙️ ENERGIA E TONALITÀ');
  lines.push('━'.repeat(60));
  
  if (energy.level) lines.push(`⚡ ENERGIA: ${energy.level}`);
  if (energy.tone) lines.push(`🎵 TONO: ${energy.tone}`);
  if (energy.volume) lines.push(`📢 VOLUME: ${energy.volume}`);
  if (energy.rhythm) lines.push(`🏃 RITMO: ${energy.rhythm}`);
  if (energy.inflections) lines.push(`📈 INFLESSIONI: ${energy.inflections}`);
  
  if (energy.vocabulary && energy.vocabulary.length > 0) {
    lines.push(`✅ LESSICO OBBLIGATORIO DA USARE:`);
    lines.push(`   ${energy.vocabulary.map(v => `"${v}"`).join(' / ')}`);
  }
  
  if (energy.example) {
    lines.push('');
    lines.push(`🎬 ESEMPIO VOCALE:`);
    lines.push(`   ${energy.example}`);
  }
  
  if (energy.mindset) {
    lines.push('');
    lines.push(`💪 MINDSET: ${energy.mindset}`);
  }
  
  lines.push('━'.repeat(60));
  return lines.join('\n');
}

function formatQuestion(question: Question): string {
  const lines: string[] = [];
  
  const marker = question.marker ? `${question.marker} - ` : '';
  const keyLabel = question.isKey ? 'DOMANDA CHIAVE' : 'DOMANDA';
  
  lines.push(`📌 ${marker}${keyLabel}:`);
  lines.push(`   "${question.text}"`);
  
  if (question.instructions?.wait) {
    lines.push('   ');
    lines.push('   ⏸️ ASPETTA LA RISPOSTA');
  }
  
  if (question.instructions?.listen) {
    lines.push('   ');
    lines.push(`   🎧 ASCOLTA ${question.instructions.listen}`);
  }
  
  if (question.instructions?.react && question.instructions.react.length > 0) {
    lines.push('   ');
    lines.push(`   💬 REAGISCI: ${question.instructions.react.join(' / ')}`);
  }
  
  return lines.join('\n');
}

function formatLadder(ladder: Ladder): string {
  const lines: string[] = [];
  
  lines.push(`🔍 ${ladder.title}`);
  lines.push('━'.repeat(60));
  
  if (ladder.whenToUse && ladder.whenToUse.length > 0) {
    lines.push('');
    lines.push('⚠️ QUANDO ATTIVARLA:');
    ladder.whenToUse.forEach(item => {
      lines.push(`✓ ${item}`);
    });
  }
  
  lines.push('');
  lines.push('📋 LADDER DEI PERCHÉ:');
  lines.push('');
  
  for (const level of ladder.levels) {
    const emoji = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣'][level.number - 1] || `${level.number}️⃣`;
    lines.push(`LIVELLO ${emoji} - ${level.name}:`);
    lines.push('━'.repeat(60));
    lines.push(`"${level.question}"`);
    lines.push('');
    lines.push('⏸️ ASPETTA LA RISPOSTA');
    if (level.notes) {
      lines.push(`💡 NOTA: ${level.notes}`);
    }
    lines.push('━'.repeat(60));
    lines.push('');
  }
  
  if (ladder.stopWhen && ladder.stopWhen.length > 0) {
    lines.push('🛑 FERMATI QUANDO:');
    ladder.stopWhen.forEach(item => {
      lines.push(`✅ ${item}`);
    });
  }
  
  return lines.join('\n');
}

function formatBiscottino(biscottino: Biscottino): string {
  return `🍪 SE DIVAGA: ${biscottino.phrase}`;
}

function formatCheckpoint(checkpoint: Checkpoint): string {
  const lines: string[] = [];
  
  lines.push(`⛔ CHECKPOINT OBBLIGATORIO ${checkpoint.title} ⛔`);
  lines.push('━'.repeat(60));
  lines.push('PRIMA DI PASSARE VERIFICA:');
  lines.push('');
  
  checkpoint.checks.forEach(check => {
    lines.push(`✓ ${check}`);
  });
  
  lines.push('');
  lines.push('❌ SE ANCHE SOLO UNA RISPOSTA È "NO" → NON PUOI PROCEDERE!');
  
  if (checkpoint.resistanceHandling) {
    lines.push('');
    lines.push(`🛡️ GESTIONE RESISTENZA - SE IL PROSPECT DICE:`);
    lines.push(`"${checkpoint.resistanceHandling.trigger}"`);
    lines.push('');
    lines.push('RISPOSTA OBBLIGATORIA:');
    lines.push('━'.repeat(60));
    
    if (checkpoint.resistanceHandling.steps) {
      checkpoint.resistanceHandling.steps.forEach((step, idx) => {
        lines.push(`STEP ${idx + 1} - ${step.action}:`);
        lines.push(`"${step.script}"`);
        lines.push('');
      });
    } else {
      lines.push(checkpoint.resistanceHandling.response);
    }
    lines.push('━'.repeat(60));
  }
  
  if (checkpoint.reminder) {
    lines.push('');
    lines.push(`🚨 REMINDER: ${checkpoint.reminder}`);
  }
  
  lines.push('');
  lines.push('✅ SOLO DOPO QUESTO CHECKPOINT → PASSA ALLA FASE SUCCESSIVA');
  
  return lines.join('\n');
}

function formatStep(step: Step): string {
  const lines: string[] = [];
  
  lines.push(`STEP ${step.number} - ${step.name}:`);
  lines.push(`🎯 OBIETTIVO: ${step.objective}`);
  lines.push('');
  
  if (step.energy) {
    lines.push(formatEnergySettings(step.energy));
    lines.push('');
  }
  
  step.questions.forEach(question => {
    lines.push(formatQuestion(question));
    lines.push('');
  });
  
  if (step.ladder) {
    lines.push('---');
    lines.push('');
    lines.push(formatLadder(step.ladder));
    lines.push('');
  }
  
  if (step.biscottino) {
    lines.push(formatBiscottino(step.biscottino));
    lines.push('');
  }
  
  if (step.notes) {
    lines.push(`💡 NOTE: ${step.notes}`);
    lines.push('');
  }
  
  lines.push('---');
  
  return lines.join('\n');
}

function formatPhase(phase: Phase): string {
  const lines: string[] = [];
  
  lines.push('═'.repeat(80));
  lines.push(`**FASE #${phase.number} - ${phase.name}**`);
  if (phase.description) {
    lines.push(`**${phase.description}**`);
  }
  lines.push('═'.repeat(80));
  lines.push('');
  
  if (phase.energy) {
    lines.push(formatEnergySettings(phase.energy));
    lines.push('');
  }
  
  phase.steps.forEach(step => {
    lines.push(formatStep(step));
    lines.push('');
  });
  
  if (phase.checkpoint) {
    lines.push(formatCheckpoint(phase.checkpoint));
    lines.push('');
  }
  
  if (phase.transition) {
    lines.push(`➡️ TRANSIZIONE: ${phase.transition}`);
    lines.push('');
  }
  
  return lines.join('\n');
}

function formatGlobalRule(rule: GlobalRule): string {
  const lines: string[] = [];
  
  if (rule.type === 'critical') {
    lines.push(`🚨🚨🚨 ${rule.title} 🚨🚨🚨`);
    lines.push('━'.repeat(60));
  } else if (rule.type === 'golden') {
    lines.push(`💎 REGOLA D'ORO: ${rule.title}`);
    lines.push('━'.repeat(60));
  } else {
    lines.push(`📋 ${rule.title}`);
    lines.push('━'.repeat(60));
  }
  
  lines.push(rule.content);
  
  if (rule.items && rule.items.length > 0) {
    lines.push('');
    rule.items.forEach(item => {
      lines.push(`✓ ${item}`);
    });
  }
  
  lines.push('━'.repeat(60));
  
  return lines.join('\n');
}

function formatObjection(objection: Objection): string {
  const lines: string[] = [];
  
  lines.push(`### OBIEZIONE #${objection.number}: "${objection.title}"`);
  
  if (objection.objective) {
    lines.push(`🎯 OBIETTIVO: ${objection.objective}`);
  }
  lines.push('');
  
  if (objection.energy) {
    lines.push(formatEnergySettings(objection.energy));
    lines.push('');
  }
  
  if (objection.variants && objection.variants.length > 0) {
    lines.push('Varianti comuni:');
    objection.variants.forEach(v => {
      lines.push(`- "${v}"`);
    });
    lines.push('');
  }
  
  if (objection.ladder) {
    lines.push(formatLadder(objection.ladder));
    lines.push('');
  }
  
  if (objection.reframe) {
    lines.push('**REFRAME:**');
    lines.push(objection.reframe);
    lines.push('');
  }
  
  if (objection.keyQuestion) {
    lines.push('**DOMANDA CHIAVE:**');
    lines.push(objection.keyQuestion);
    lines.push('');
  }
  
  if (objection.analogy) {
    lines.push('**ANALOGIA:**');
    lines.push(objection.analogy);
    lines.push('');
  }
  
  lines.push('---');
  
  return lines.join('\n');
}

export function blocksToText(structure: ScriptBlockStructure): string {
  const lines: string[] = [];
  
  lines.push('═'.repeat(80));
  lines.push(`# ${structure.metadata.name.toUpperCase()}`);
  lines.push('═'.repeat(80));
  lines.push('');
  
  if (structure.metadata.description) {
    lines.push(structure.metadata.description);
    lines.push('');
  }
  
  if (structure.globalRules && structure.globalRules.length > 0) {
    structure.globalRules.forEach(rule => {
      lines.push(formatGlobalRule(rule));
      lines.push('');
    });
  }
  
  if (structure.phases && structure.phases.length > 0) {
    structure.phases.forEach(phase => {
      lines.push(formatPhase(phase));
      lines.push('');
    });
  }
  
  if (structure.objections && structure.objections.length > 0) {
    lines.push('═'.repeat(80));
    lines.push('# GESTIONE OBIEZIONI');
    lines.push('═'.repeat(80));
    lines.push('');
    
    structure.objections.forEach(objection => {
      lines.push(formatObjection(objection));
      lines.push('');
    });
  }
  
  if (structure.finalRules && structure.finalRules.length > 0) {
    lines.push('═'.repeat(80));
    lines.push('# REGOLE FINALI');
    lines.push('═'.repeat(80));
    lines.push('');
    
    structure.finalRules.forEach(rule => {
      lines.push(formatGlobalRule(rule));
      lines.push('');
    });
  }
  
  return lines.join('\n');
}

export function validateScriptStructure(structure: ScriptBlockStructure): {
  valid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!structure.metadata?.name) {
    errors.push('Metadata: nome mancante');
  }
  if (!structure.metadata?.type) {
    errors.push('Metadata: tipo mancante');
  }

  if (!structure.phases || structure.phases.length === 0) {
    if (!structure.objections || structure.objections.length === 0) {
      warnings.push('Nessuna fase o obiezione trovata');
    }
  }

  structure.phases?.forEach((phase, phaseIdx) => {
    if (!phase.name) {
      errors.push(`Fase ${phaseIdx + 1}: nome mancante`);
    }
    if (!phase.steps || phase.steps.length === 0) {
      warnings.push(`Fase "${phase.name || phaseIdx + 1}": nessuno step trovato`);
    }

    phase.steps?.forEach((step, stepIdx) => {
      if (!step.objective) {
        warnings.push(`Fase "${phase.name}", Step ${step.number}: obiettivo mancante`);
      }
      if (!step.questions || step.questions.length === 0) {
        warnings.push(`Fase "${phase.name}", Step ${step.number}: nessuna domanda trovata`);
      }
    });
  });

  structure.objections?.forEach((objection, idx) => {
    if (!objection.title) {
      errors.push(`Obiezione ${idx + 1}: titolo mancante`);
    }
    if (!objection.reframe && !objection.keyQuestion) {
      warnings.push(`Obiezione "${objection.title || idx + 1}": manca reframe o domanda chiave`);
    }
  });

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

export function extractScriptSummary(structure: ScriptBlockStructure): {
  totalPhases: number;
  totalSteps: number;
  totalQuestions: number;
  totalCheckpoints: number;
  totalLadders: number;
  totalObjections: number;
  hasGlobalRules: boolean;
} {
  let totalSteps = 0;
  let totalQuestions = 0;
  let totalCheckpoints = 0;
  let totalLadders = 0;

  structure.phases?.forEach(phase => {
    totalSteps += phase.steps?.length || 0;
    if (phase.checkpoint) totalCheckpoints++;
    
    phase.steps?.forEach(step => {
      totalQuestions += step.questions?.length || 0;
      if (step.ladder) totalLadders++;
    });
  });

  return {
    totalPhases: structure.phases?.length || 0,
    totalSteps,
    totalQuestions,
    totalCheckpoints,
    totalLadders,
    totalObjections: structure.objections?.length || 0,
    hasGlobalRules: (structure.globalRules?.length || 0) > 0,
  };
}
