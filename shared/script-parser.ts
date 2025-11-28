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

function extractEnergyBoxContent(text: string): string | undefined {
  const boxMatch = text.match(/╔[═╔╗\s\S]*?╚[═╚╝]+/);
  if (boxMatch) {
    return boxMatch[0]
      .replace(/[╔╠╚][═]+[╗╣╝]/g, '')
      .replace(/║/g, '')
      .trim();
  }
  return undefined;
}

function parseEnergySettings(text: string): EnergySettings | undefined {
  const boxContent = extractEnergyBoxContent(text);
  const searchText = boxContent || text;
  
  const hasEnergyHeader = /⚡\s*ENERGIA/i.test(searchText) || 
                          /Livello\s*:/i.test(searchText) ||
                          /Tono\s*:/i.test(searchText);
  
  if (!hasEnergyHeader) {
    const toneParenMatch = text.match(/\*\*\(TONO:\s*([^)]+)\)\*\*/i) ||
                            text.match(/\(TONO:\s*([^)]+)\)/i);
    if (!toneParenMatch) {
      return undefined;
    }
    return {
      level: '',
      tone: toneParenMatch[1].trim(),
      volume: '',
      rhythm: '',
      vocabulary: [],
    };
  }
  
  const levelMatch = searchText.match(/(?:⚡\s*)?(?:ENERGIA[^:]*|Livello)\s*:\s*([^\n]+)/i);
  const toneMatch = searchText.match(/(?:🎵\s*)?Tono\s*:\s*([^\n]+)/i);
  const volumeMatch = searchText.match(/(?:📢\s*)?Volume\s*:\s*([^\n]+)/i);
  const rhythmMatch = searchText.match(/(?:🏃\s*)?Ritmo\s*:\s*([^\n]+)/i);
  const inflectionMatch = searchText.match(/(?:📈|🎭)?\s*Inflessioni?\s*:\s*([^\n]+)/i);
  const vocabMatch = searchText.match(/(?:✅|📣)?\s*Lessico\s*:\s*([^\n]+(?:\n\s*(?:[^\n━⚡🎵📢🏃💪🎯]*"[^"]+[^\n]*))*)/i);
  const mindsetMatch = searchText.match(/(?:💪|🎯)?\s*Mindset\s*:\s*([^\n]+)/i);
  const exampleMatch = searchText.match(/(?:💬|🎬)?\s*Esempio[^:]*:\s*([\s\S]*?)(?=💪|🎯|Mindset|━{3,}|╚|$)/i);
  
  const exampleAltMatch = searchText.match(/Immagina\s+([^\n]+(?:\n[^\n━═]+)*)/i);

  let level = '';
  if (levelMatch) {
    level = levelMatch[1].trim();
  }

  let vocabulary: string[] = [];
  let negativeVocabulary: string[] = [];
  
  if (vocabMatch) {
    const vocabText = vocabMatch[1];
    const negativeMatch = vocabText.match(/\(NON\s+([^)]+)\)/i);
    if (negativeMatch) {
      negativeVocabulary = extractVocabulary(negativeMatch[1]);
    }
    const cleanVocabText = vocabText.replace(/\(NON\s+[^)]+\)/gi, '');
    vocabulary = extractVocabulary(cleanVocabText);
  }

  let example = exampleMatch?.[1]?.replace(/\n\s*║\s*/g, '\n').trim();
  if (!example && exampleAltMatch) {
    example = exampleAltMatch[0].trim();
  }

  return {
    level,
    tone: toneMatch?.[1]?.trim() || '',
    volume: volumeMatch?.[1]?.trim() || '',
    rhythm: rhythmMatch?.[1]?.trim() || '',
    inflections: inflectionMatch?.[1]?.trim(),
    vocabulary,
    negativeVocabulary: negativeVocabulary.length > 0 ? negativeVocabulary : undefined,
    mindset: mindsetMatch?.[1]?.trim(),
    example,
  };
}

function parseQuestionInstructions(text: string): QuestionInstructions {
  const hasWait = /⏸️\s*ASPETTA/i.test(text);
  
  const waitMatch = text.match(/⏸️\s*ASPETTA\s*(?:LA\s*RISPOSTA)?\s*[-–—]?\s*([^🎧💬📌\n]*)/i);
  let waitDetails = waitMatch?.[1]?.trim() || undefined;
  if (waitDetails && waitDetails.length === 0) waitDetails = undefined;
  
  const listenMatch = text.match(/🎧\s*ASCOLTA\s*([^\n]*)/i);
  
  const reactFullMatch = text.match(/💬\s*REAGISCI\s*([^:]+):\s*([\s\S]*?)(?=📌|⏸️|🎧|🍪|---|→|$)/i);
  let reactContext = '';
  const reactions: string[] = [];
  
  if (reactFullMatch) {
    const contextPart = reactFullMatch[1].trim();
    if (contextPart && contextPart.length > 0) {
      reactContext = contextPart;
    }
    
    const content = reactFullMatch[2];
    const firstLine = content.split('\n')[0].trim();
    const phrases = firstLine.split(/[\/\|]/).map(p => p.trim()).filter(p => p.length > 0);
    reactions.push(...phrases);
  } else {
    const simpleReactMatch = text.match(/💬\s*REAGISCI\s*:\s*([^\n]+)/i);
    if (simpleReactMatch) {
      const content = simpleReactMatch[1].trim();
      const phrases = content.split(/[\/\|]/).map(p => p.trim()).filter(p => p.length > 0);
      reactions.push(...phrases);
    }
  }

  const additionalInstructions: string[] = [];
  const arrowInstructions = text.match(/→\s*([^\n]+)/g);
  if (arrowInstructions) {
    arrowInstructions.forEach(instr => {
      const cleaned = instr.replace(/^→\s*/, '').trim();
      if (cleaned.length > 0 && !cleaned.match(/^(STEP|PASSA|SOLO\s*DOPO)/i)) {
        additionalInstructions.push(cleaned);
      }
    });
  }

  return {
    wait: hasWait,
    waitDetails: waitDetails,
    listen: listenMatch?.[1]?.trim(),
    react: reactions.length > 0 ? reactions : undefined,
    reactContext: reactContext && reactContext.length > 0 ? reactContext : undefined,
    additionalInstructions: additionalInstructions.length > 0 ? additionalInstructions : undefined,
  };
}

function parseQuestions(text: string): Question[] {
  const questions: Question[] = [];
  const questionBlocks = text.split(/(?=📌\s|💡\s*DOMANDA\s*CHIAVE)/i);

  for (const block of questionBlocks) {
    const startsWithPin = block.trim().startsWith('📌');
    const startsWithKey = /^💡\s*DOMANDA\s*CHIAVE/i.test(block.trim());
    
    if (!startsWithPin && !startsWithKey) continue;

    const lines = block.split('\n');
    let firstLine = lines[0];
    
    if (startsWithPin) {
      firstLine = firstLine.replace('📌', '').trim();
    } else if (startsWithKey) {
      firstLine = firstLine.replace(/💡\s*DOMANDA\s*CHIAVE\s*[-–—]?\s*/i, '').trim();
    }
    
    let condition = '';
    let marker = '';
    let questionText = firstLine;
    
    const conditionInMarkerMatch = firstLine.match(/^DOMANDA\s*\(([^)]+)\)\s*:\s*/i);
    if (conditionInMarkerMatch) {
      condition = conditionInMarkerMatch[1].trim();
      marker = 'DOMANDA';
      questionText = firstLine.replace(conditionInMarkerMatch[0], '').trim();
    } else {
      const markerMatch = firstLine.match(/^([A-Z\s]+(?:\s*[-–—]\s*[^\n:]+)?)\s*[:\-]\s*/i);
      if (markerMatch) {
        marker = markerMatch[1].trim();
        questionText = firstLine.replace(markerMatch[0], '').trim();
      }
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
        !l.startsWith('   →') &&
        !l.trim().startsWith('SE ')
      );
      if (contentLines.length > 0) {
        questionText = contentLines.join(' ').trim().replace(/^\s*"|"\s*$/g, '');
      }
    }

    if (!condition) {
      const conditionMatch = block.match(/SE\s+(?!DIVAGA)([^:\n]+)/i);
      condition = conditionMatch?.[1]?.trim() || '';
    }
    
    const isKey = startsWithKey || 
                  /CHIAVE|PRINCIPALE|KEY/i.test(marker) || 
                  /DOMANDA CHIAVE/i.test(block) ||
                  /💡/i.test(block.substring(0, 50));

    if (startsWithKey && !marker) {
      marker = 'DOMANDA CHIAVE';
    }

    questions.push({
      id: generateBlockId(),
      text: questionText,
      marker: marker || undefined,
      instructions: parseQuestionInstructions(block),
      isKey,
      condition: condition || undefined,
    });
  }

  return questions;
}

function parseLadder(text: string): Ladder | undefined {
  const titleMatch = text.match(/(?:🔍|📋|⚠️)\s*(?:LADDER\s*(?:DEI\s*)?(?:PERCHÉ\s*)?[-–—]?\s*)?([^\n]+)/i);
  if (!titleMatch && !/LIVELLO\s*\d+/i.test(text)) return undefined;

  const levels: LadderLevel[] = [];
  
  const levelSections = text.split(/(?=LIVELLO\s*\d+)/i);
  
  for (const section of levelSections) {
    const headerMatch = section.match(/LIVELLO\s*(\d+)(?:️⃣)?\s*[-–—:]\s*([A-ZÀÈÉÌÒÙ\s]+(?:\([^)]+\))?)?/i);
    if (!headerMatch) continue;
    
    const levelNum = parseInt(headerMatch[1]);
    let levelName = headerMatch[2]?.trim() || `Livello ${levelNum}`;
    levelName = levelName.replace(/^\s*[-–—:]\s*/, '').trim() || `Livello ${levelNum}`;
    
    const cleanSection = section.replace(/^LIVELLO\s*\d+(?:️⃣)?[^\n]*\n?/i, '');
    const withoutSeparators = cleanSection.replace(/^━+\s*\n?/gm, '');
    
    let objective = '';
    const objectiveMatch = withoutSeparators.match(/🎯\s*OBIETTIVO:\s*([^\n]+)/i);
    if (objectiveMatch) {
      objective = objectiveMatch[1].trim();
    }
    
    let question = '';
    const questionMatch = withoutSeparators.match(/📌\s*DOMANDA:\s*"([^"]+)"/i);
    if (questionMatch) {
      question = questionMatch[1].trim();
    } else {
      const quotedMatch = withoutSeparators.match(/"([^"]+)"/);
      if (quotedMatch) {
        question = quotedMatch[1].trim();
      } else {
        const contentLines = withoutSeparators.split('\n')
          .filter(l => l.trim() && 
                 !l.trim().startsWith('🎯') && 
                 !l.trim().startsWith('⏸️') &&
                 !l.trim().startsWith('📌') &&
                 !l.trim().startsWith('💡') &&
                 !l.trim().startsWith('📚') &&
                 !l.match(/^SE\s+(dice|DICE)/i) &&
                 !l.match(/^Cliente\s+dice:/i) &&
                 !l.match(/^✅\s*Tu\s+dici:/i))
          .slice(0, 2);
        if (contentLines.length > 0) {
          question = contentLines.join(' ').trim().replace(/^["']|["']$/g, '');
        }
      }
    }
    
    const examples: { clientSays: string; youSay: string }[] = [];
    const examplesMatch = section.match(/📚\s*ESEMPI\s*PRATICI:?\s*([\s\S]*?)(?=LIVELLO|🛑|💡\s*NOTA|---|$)/i);
    if (examplesMatch) {
      const examplePairs = examplesMatch[1].matchAll(/Cliente\s+dice:\s*"([^"]+)"[\s\S]*?✅\s*Tu\s+dici:\s*"([^"]+)"/gi);
      for (const pair of examplePairs) {
        examples.push({
          clientSays: pair[1].trim(),
          youSay: pair[2].trim(),
        });
      }
    }
    
    const notesMatch = section.match(/💡\s*(?:NOTA|NOTE)?:?\s*([^\n]+)/i);
    
    if (question) {
      levels.push({
        number: levelNum,
        name: levelName,
        objective: objective || undefined,
        question,
        examples: examples.length > 0 ? examples : undefined,
        notes: notesMatch?.[1]?.trim(),
      });
    }
  }

  if (levels.length === 0) {
    const simplePattern = /LIVELLO\s*(\d+)(?:️⃣)?[^"]*"([^"]+)"/gi;
    let match;
    while ((match = simplePattern.exec(text)) !== null) {
      levels.push({
        number: parseInt(match[1]),
        name: `Livello ${match[1]}`,
        question: match[2].trim(),
      });
    }
  }

  const whenToUse: string[] = [];
  const whenToUseMatch = text.match(/⚠️\s*QUANDO\s*(?:ATTIVARLA|ATTIVARLO|USARLO):?\s*([\s\S]*?)(?=❌|📋|LIVELLO)/i);
  if (whenToUseMatch) {
    const items = whenToUseMatch[1].match(/[✓✅•]\s*([^\n]+)/g);
    if (items) {
      whenToUse.push(...items.map(i => i.replace(/^[✓✅•]\s*/, '').trim()));
    }
  }

  const stopWhen: string[] = [];
  const stopMatch = text.match(/(?:🛑|✅)\s*(?:FERMATI\s*QUANDO|CRITERIO\s*DI\s*STOP):?\s*([\s\S]*?)(?=❌|💡|---|LIVELLO|$)/i);
  if (stopMatch) {
    const items = stopMatch[1].match(/[✓✅•]\s*([^\n]+)/g);
    if (items) {
      stopWhen.push(...items.map(i => i.replace(/^[✓✅•]\s*/, '').trim()));
    } else {
      const singleLine = stopMatch[1].trim().split('\n')[0];
      if (singleLine && singleLine.length > 5) {
        stopWhen.push(singleLine);
      }
    }
  }

  let title = 'Ladder dei Perché';
  if (titleMatch) {
    const rawTitle = titleMatch[1].trim();
    if (rawTitle.match(/SCAVO\s*PROFONDO/i)) {
      title = `LADDER DEI PERCHÉ - ${rawTitle}`;
    } else if (rawTitle && !rawTitle.match(/^LIVELLO/i)) {
      title = rawTitle;
    }
  }

  return {
    title,
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
  const titleMatch = text.match(/(?:⛔|🚨)\s*CHECKPOINT\s*(?:OBBLIGATORIO)?\s*(?:FASE\s*)?#?(\d+)?[^⛔🚨\n]*/i);
  if (!titleMatch) return undefined;

  const phaseNumber = titleMatch[1] || undefined;
  
  const checks: string[] = [];
  const checksMatches = text.match(/[✓✅]\s*([^\n?]+\??)/g);
  if (checksMatches) {
    const filteredChecks = checksMatches
      .map(c => c.replace(/^[✓✅]\s*/, '').trim())
      .filter(c => 
        !c.match(/SOLO\s*DOPO\s*QUESTO\s*CHECKPOINT/i) &&
        !c.match(/^PASSA\s+allo\s+Step/i) &&
        !c.match(/^Quando\s+la\s+risposta\s+è/i) &&
        !c.match(/^Quando\s+dice\s+concetti/i) &&
        !c.match(/^Tu\s+dici:/i)
      );
    checks.push(...filteredChecks);
  }

  let resistanceHandling: ResistanceHandling | undefined;
  
  const resistanceMatch = text.match(/(?:🛡️)\s*(?:SE\s*RESISTE|GESTIONE\s*RESISTENZA)[^:]*:?\s*"?([^"\n]+)"?\s*([\s\S]*?)(?=✅\s*(?:SOLO|SE)|🚨|📊|---|$)/i);
  if (resistanceMatch) {
    const trigger = resistanceMatch[1]?.trim() || 'Prospect resiste';
    const restContent = resistanceMatch[2];
    
    const responseMatch = restContent.match(/RISPOSTA\s*OBBLIGATORIA:?\s*(?:━+\s*)?"?([\s\S]*?)"?(?=⏸️|🚨|📊|---|$)/i);
    let response = '';
    if (responseMatch) {
      response = responseMatch[1].trim().replace(/^["']|["']$/g, '');
    }
    
    const steps: ResistanceStep[] = [];
    const stepMatches = restContent.match(/(?:STEP\s*\d+|→)\s*[-–—]?\s*([^:]+):\s*"?([^"\n]+)"?/gi);
    if (stepMatches) {
      stepMatches.forEach(s => {
        const parts = s.match(/(?:STEP\s*\d+|→)\s*[-–—]?\s*([^:]+):\s*"?([^"\n]+)"?/i);
        if (parts) {
          steps.push({
            action: parts[1].trim(),
            script: parts[2].trim().replace(/^["']|["']$/g, ''),
          });
        }
      });
    }

    resistanceHandling = {
      trigger,
      response,
      steps: steps.length > 0 ? steps : undefined,
    };
  }

  const warningMatch = text.match(/⚠️\s*SE\s*[^\n]+/gi);
  if (warningMatch && !resistanceHandling) {
    const warnings = warningMatch.map(w => w.replace(/^⚠️\s*/, '').trim());
    resistanceHandling = {
      trigger: 'Warning',
      response: warnings.join('\n'),
    };
  }

  const reminderMatch = text.match(/🚨\s*REMINDER\s*(?:CRITICO)?[^🚨\n]*🚨?\s*([\s\S]*?)(?=✅\s*SOLO|---|$)/i);
  
  const testFinaleMatch = text.match(/📊\s*TEST\s*FINALE[^:]*:\s*"?([^"\n]+)"?/i);

  let title = 'Checkpoint';
  if (phaseNumber) {
    title = `FASE #${phaseNumber}`;
  } else {
    const titleContentMatch = text.match(/CHECKPOINT\s*(?:OBBLIGATORIO)?\s*([^\n⛔🚨]+)/i);
    if (titleContentMatch && titleContentMatch[1].trim()) {
      title = titleContentMatch[1].trim();
    }
  }

  return {
    title,
    phaseNumber,
    checks,
    resistanceHandling,
    reminder: reminderMatch?.[1]?.trim(),
    testFinale: testFinaleMatch?.[1]?.trim(),
  };
}

function parseStep(text: string): Step | undefined {
  // Match both regular STEP N - NAME: and **STEP N - NAME** formats (with optional bold markers)
  const headerMatch = text.match(/(?:\*\*)?STEP\s*(\d+)\s*[-–—]\s*([^:\n*]+)(?:\*\*)?:?/i);
  if (!headerMatch) return undefined;

  const objectiveMatch = text.match(/🎯\s*OBIETTIVO:\s*([^\n]+)/i);
  
  // Extract text BEFORE ladder section for parsing questions
  // Ladder sections start with patterns like "🔍 - SCAVO", "📋 LADDER", "LIVELLO 1️⃣"
  const ladderStartPatterns = [
    /🔍\s*[-–—]?\s*SCAVO/i,
    /📋\s*LADDER/i,
    /⚠️\s*QUANDO\s*ATTIVARLA/i,
    /LIVELLO\s*1️⃣/i,
    /LIVELLO\s*1\s*[-–—:]/i,
  ];
  
  let textForQuestions = text;
  for (const pattern of ladderStartPatterns) {
    const match = text.match(pattern);
    if (match && match.index !== undefined) {
      textForQuestions = text.substring(0, match.index);
      break;
    }
  }
  
  return {
    id: generateBlockId(),
    number: parseInt(headerMatch[1]),
    name: headerMatch[2].trim(),
    objective: objectiveMatch?.[1]?.trim() || '',
    energy: parseEnergySettings(text),
    questions: parseQuestions(textForQuestions),
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

  const criticalMatch = text.match(/🚨🚨🚨\s*([^\n]+)\s*🚨🚨🚨\s*([\s\S]*?)(?=════|💎|🔄|$)/i);
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

  const goldenRegex = /💎\s*REGOLA\s*D['']ORO:?\s*([^\n]+(?:\n[^\n💎🚨═🔄]+)*)/gi;
  let goldenMatch;
  while ((goldenMatch = goldenRegex.exec(text)) !== null) {
    rules.push({
      id: generateBlockId(),
      type: 'golden',
      title: "REGOLA D'ORO",
      content: goldenMatch[1].trim(),
    });
  }

  const loopMatch = text.match(/🔄\s*GESTIONE\s*LOOP\s*(?:OBIEZIONI)?[^═\n]*\n[═]*\s*([\s\S]*?)(?=🚨\s*CHECKPOINT|════|$)/i);
  if (loopMatch) {
    const items: string[] = [];
    const itemMatches = loopMatch[1].match(/[✓✅⚠️•]\s*([^\n]+)/g);
    if (itemMatches) {
      items.push(...itemMatches.map(i => i.replace(/^[✓✅⚠️•]\s*/, '').trim()));
    }

    rules.push({
      id: generateBlockId(),
      type: 'reminder',
      title: 'GESTIONE LOOP OBIEZIONI',
      content: loopMatch[1].trim(),
      items: items.length > 0 ? items : undefined,
    });
  }

  const checkpointFinalMatch = text.match(/🚨\s*CHECKPOINT\s*FINALE[^═\n]*\n[═]*\s*([\s\S]*?)(?=════|$)/i);
  if (checkpointFinalMatch) {
    const items: string[] = [];
    const itemMatches = checkpointFinalMatch[1].match(/[✓✅❌]\s*([^\n]+)/g);
    if (itemMatches) {
      items.push(...itemMatches.map(i => i.replace(/^[✓✅❌]\s*/, '').trim()));
    }

    rules.push({
      id: generateBlockId(),
      type: 'critical',
      title: 'CHECKPOINT FINALE',
      content: checkpointFinalMatch[1].trim(),
      items: items.length > 0 ? items : undefined,
    });
  }

  const metaInstructionsMatch = text.match(/⚠️\s*RICORDA:?\s*([^\n]+(?:\n[^\n⚠️═]+)*)/i);
  if (metaInstructionsMatch) {
    rules.push({
      id: generateBlockId(),
      type: 'reminder',
      title: 'META-ISTRUZIONI',
      content: metaInstructionsMatch[1].trim(),
    });
  }

  return rules;
}

function parseObjections(text: string): Objection[] {
  const objections: Objection[] = [];
  
  // Support both formats:
  // 1. ### OBIEZIONE #X: "..."
  // 2. **FASE #X - OBIEZIONE "..."**
  const faseObjectionPattern = /═{3,}[^═]*\*\*FASE\s*#?(\d+)\s*[-–—]\s*OBIEZIONE\s*"([^"]+)"\*\*/gi;
  const hashObjectionPattern = /###\s*OBIEZIONE\s*#?(\d+):?\s*"?([^"\n]+)"?/gi;
  
  // First try FASE format (used in sales-scripts-base.ts)
  const faseMatches = [...text.matchAll(faseObjectionPattern)];
  
  if (faseMatches.length > 0) {
    // Split by FASE objection blocks
    const objectionBlocks = text.split(/(?=═{3,}[^═]*\*\*FASE\s*#?\d+\s*[-–—]\s*OBIEZIONE)/i);
    
    for (const block of objectionBlocks) {
      const headerMatch = block.match(/\*\*FASE\s*#?(\d+)\s*[-–—]\s*OBIEZIONE\s*"([^"]+)"\*\*/i);
      if (!headerMatch) continue;
      
      const objNum = parseInt(headerMatch[1]);
      const rawTitle = headerMatch[2].trim();
      
      // Extract objective
      const objectiveMatch = block.match(/🎯\s*OBIETTIVO:\s*([^\n]+)/i);
      
      // Extract energy settings
      const energy = parseEnergySettings(block);
      
      // Extract ladder from STEP 2 - LADDER section
      const ladder = parseLadder(block);
      
      // Extract reframe from STEP 3 - REFRAME section
      let reframe = '';
      const reframeSection = block.match(/\*\*STEP\s*3\s*[-–—]\s*REFRAME\*\*\s*([\s\S]*?)(?=\*\*STEP|\*\*FASE|═{3,}|$)/i);
      if (reframeSection) {
        // Extract the SCRIPT REFRAME content
        const scriptReframe = reframeSection[1].match(/📌\s*SCRIPT\s*REFRAME[^:]*:?\s*([\s\S]*?)(?=📌\s*DOMANDA|📌\s*CTA|---|\*\*|$)/i);
        if (scriptReframe) {
          reframe = scriptReframe[1].trim();
        } else {
          // Fallback: get content after "REFRAME" until next marker
          reframe = reframeSection[1].replace(/📌\s*SCRIPT\s*REFRAME[^:]*:?\s*/i, '').split(/📌\s*DOMANDA/i)[0].trim();
        }
      }
      
      // Extract key question
      let keyQuestion = '';
      const keyQ1 = block.match(/📌\s*DOMANDA\s*CHIAVE[^:]*:?\s*"([^"]+)"/i);
      const keyQ2 = block.match(/📌\s*DOMANDA\s*CHIAVE[^:]*:?\s*([\s\S]*?)(?=📌\s*CTA|---|\*\*STEP|\*\*FASE|═{3,}|$)/i);
      if (keyQ1) {
        keyQuestion = keyQ1[1].trim();
      } else if (keyQ2) {
        const content = keyQ2[1].trim();
        const quotedQ = content.match(/"([^"]+)"/);
        keyQuestion = quotedQ ? quotedQ[1] : content.split('\n')[0].replace(/^["']|["']$/g, '').trim();
      }
      
      // Extract CTA
      let cta = '';
      const ctaMatch = block.match(/📌\s*CTA:\s*"?([^"\n]+)"?/i);
      if (ctaMatch) {
        cta = ctaMatch[1].trim().replace(/^["']|["']$/g, '');
      }
      
      // Extract analogy if present
      let analogy = '';
      const analogyMatch = block.match(/\*\*ANALOGIA:?\*\*\s*([\s\S]*?)(?=📌|---|\*\*STEP|\*\*FASE|═{3,}|$)/i);
      if (analogyMatch) {
        analogy = analogyMatch[1].trim();
      }
      
      // Extract steps for this objection
      const steps: Step[] = [];
      const stepMatches = block.matchAll(/\*\*STEP\s*(\d+)\s*[-–—]\s*([^*\n]+)\*\*/gi);
      for (const stepMatch of stepMatches) {
        const stepNum = parseInt(stepMatch[1]);
        const stepName = stepMatch[2].trim();
        
        // Find content until next STEP or end
        const stepStart = stepMatch.index || 0;
        const stepContent = block.slice(stepStart).split(/\*\*STEP\s*\d+\s*[-–—]/i)[0];
        
        // Parse questions in this step
        const stepQuestions = parseQuestions(stepContent);
        
        steps.push({
          id: generateBlockId(),
          type: 'step',
          number: stepNum,
          name: stepName,
          objective: stepName,
          questions: stepQuestions,
        });
      }
      
      objections.push({
        id: generateBlockId(),
        type: 'objection',
        number: objNum,
        title: rawTitle,
        objective: objectiveMatch?.[1]?.trim() || '',
        energy,
        ladder,
        reframe,
        keyQuestion,
        cta,
        analogy: analogy || undefined,
        steps: steps.length > 0 ? steps : undefined,
      });
    }
    
    return objections;
  }
  
  // Fallback: try ### OBIEZIONE format
  const objectionBlocks = text.split(/(?=###\s*OBIEZIONE\s*#?\d+)/i);

  for (const block of objectionBlocks) {
    const headerMatch = block.match(/###\s*OBIEZIONE\s*#?(\d+):?\s*"?([^"\n]+)"?/i);
    if (!headerMatch) continue;

    const rawTitle = headerMatch[2].trim().replace(/^["']|["']$/g, '');
    const titleParts = rawTitle.split(/\s*\/\s*/);
    const mainTitle = titleParts[0].replace(/^["']|["']$/g, '').trim();
    
    const variants: string[] = [];
    if (titleParts.length > 1) {
      for (let i = 1; i < titleParts.length; i++) {
        const variant = titleParts[i].replace(/^["']|["']$/g, '').trim();
        if (variant) variants.push(variant);
      }
    }
    
    const bulletVariants = block.match(/^\s*[-•]\s*"([^"]+)"/gm);
    if (bulletVariants) {
      variants.push(...bulletVariants.map(v => 
        v.replace(/^\s*[-•]\s*"?/g, '').replace(/"$/g, '').trim()
      ));
    }

    const objectiveMatch = block.match(/🎯\s*OBIETTIVO:\s*([^\n]+)/i);

    const energy = parseEnergySettings(block);

    const ladder = parseLadder(block);

    let reframe = '';
    const reframeMatch1 = block.match(/\*\*REFRAME:?\*\*\s*([\s\S]*?)(?=\*\*DOMANDA|\*\*ANALOGIA|🔍|📌|---|###|$)/i);
    const reframeMatch2 = block.match(/📌\s*REFRAME\s*[-–—]?\s*[^:\n]*:?\s*([\s\S]*?)(?=\*\*DOMANDA|📌\s*(?!REFRAME)|🔍|---|###|$)/i);
    
    if (reframeMatch1) {
      reframe = reframeMatch1[1].trim();
    } else if (reframeMatch2) {
      reframe = reframeMatch2[1].trim();
    } else {
      const simpleReframe = block.match(/(?:Vedi|Capisco)[^.]*\.\s*([\s\S]*?)(?=\*\*DOMANDA|📌|---|###|$)/i);
      if (simpleReframe) {
        reframe = simpleReframe[0].trim();
      }
    }

    let keyQuestion = '';
    const keyQ1 = block.match(/\*\*DOMANDA\s*(?:CHIAVE|KEY)?:?\*\*\s*([\s\S]*?)(?=\*\*ANALOGIA|\*\*---|###|$)/i);
    const keyQ2 = block.match(/📌\s*DOMANDA\s*CHIAVE[^:\n]*:?\s*([\s\S]*?)(?=\*\*|---|###|$)/i);
    
    if (keyQ1) {
      const content = keyQ1[1].trim();
      const quotedQ = content.match(/"([^"]+)"/);
      keyQuestion = quotedQ ? quotedQ[1] : content.split('\n')[0].trim();
    } else if (keyQ2) {
      const content = keyQ2[1].trim();
      const quotedQ = content.match(/"([^"]+)"/);
      keyQuestion = quotedQ ? quotedQ[1] : content.split('\n')[0].trim();
    }

    let analogy = '';
    const analogyMatch = block.match(/\*\*ANALOGIA:?\*\*\s*([\s\S]*?)(?=\*\*|---|###|$)/i);
    if (analogyMatch) {
      analogy = analogyMatch[1].trim();
    }

    objections.push({
      id: generateBlockId(),
      type: 'objection',
      number: parseInt(headerMatch[1]),
      title: mainTitle,
      variants: variants.length > 0 ? variants : undefined,
      objective: objectiveMatch?.[1]?.trim() || '',
      energy,
      ladder,
      reframe,
      keyQuestion,
      analogy: analogy || undefined,
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
  // Check for objection-specific patterns (must be very specific to avoid false positives)
  // Pattern must match: **FASE #X - OBIEZIONE "..." (with the specific structure including quotes)
  const hasHashObjections = /###\s*OBIEZIONE\s*#?\d+/i.test(text);
  const hasFaseObjections = /\*\*FASE\s*#?\d+\s*[-–—]\s*OBIEZIONE\s*"/i.test(text);
  
  // Only parse objections if:
  // 1. Script type is explicitly 'objections', OR
  // 2. Text contains the specific objection markers (with quotes to ensure it's a real objection header)
  if (scriptType === 'objections' || hasHashObjections || hasFaseObjections) {
    objections = parseObjections(text);
    
    // For objections script, if we parsed objections successfully, 
    // filter out phases that are actually objections (avoid duplication)
    if (objections && objections.length > 0 && (scriptType === 'objections' || hasFaseObjections)) {
      // Clear phases if they were objection-phases (they're now in objections array)
      const nonObjectionPhases = phases.filter(p => {
        // Only filter out phases that match the exact objection pattern
        // This prevents filtering phases that just happen to contain "obiezione" in their name
        const isObjectionPhase = /^OBIEZIONE\s*"/i.test(p.name) || 
                                  /FASE\s*#?\d+\s*[-–—]\s*OBIEZIONE/i.test(p.name);
        return !isObjectionPhase;
      });
      phases.length = 0;
      phases.push(...nonObjectionPhases);
    }
  }

  const finalRules: GlobalRule[] = [];
  // Only parse finalRules for non-objection scripts, or when there's a clear "REGOLE FINALI" section
  // CRITICAL FIX: Don't include finalRules if they would contain objections (causes duplication)
  if (scriptType !== 'objections') {
    const finalRulesMatch = text.match(/(?:REGOLE?\s*FINAL[EI]|CONCLUSIONE|CHIUSURA)\s*:?\s*([\s\S]*?)$/i);
    if (finalRulesMatch) {
      // Don't include if it contains objection markers (prevents duplication)
      const content = finalRulesMatch[1].trim();
      if (!content.includes('### OBIEZIONE')) {
        const ruleItems = content.match(/[✓✅]\s*([^\n]+)/g);
        if (ruleItems && ruleItems.length > 0) {
          finalRules.push({
            id: generateBlockId(),
            type: 'reminder',
            title: 'Regole Finali',
            content: content,
            items: ruleItems.map(r => r.replace(/^[✓✅]\s*/, '').trim()),
          });
        }
      }
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
  lines.push('⚡ ENERGIA E TONALITÀ');
  lines.push('━'.repeat(60));
  
  if (energy.level) lines.push(`Livello: ${energy.level}`);
  if (energy.tone) lines.push(`Tono: ${energy.tone}`);
  if (energy.volume) lines.push(`Volume: ${energy.volume}`);
  if (energy.rhythm) lines.push(`Ritmo: ${energy.rhythm}`);
  if (energy.inflections) lines.push(`Inflessioni: ${energy.inflections}`);
  
  if (energy.vocabulary && energy.vocabulary.length > 0) {
    let vocabLine = `Lessico: ${energy.vocabulary.map(v => `"${v}"`).join(' / ')}`;
    if (energy.negativeVocabulary && energy.negativeVocabulary.length > 0) {
      vocabLine += `\n(NON ${energy.negativeVocabulary.map(v => `"${v}"`).join(' o ')} - troppo neutri!)`;
    }
    lines.push(vocabLine);
  }
  
  if (energy.mindset) {
    lines.push(`Mindset: ${energy.mindset}`);
  }
  
  if (energy.example) {
    lines.push(energy.example);
  }
  
  lines.push('━'.repeat(60));
  return lines.join('\n');
}

function formatQuestion(question: Question): string {
  const lines: string[] = [];
  
  let label = '';
  if (question.isKey) {
    label = 'DOMANDA CHIAVE';
  } else if (question.marker) {
    const markerUpper = question.marker.toUpperCase();
    if (markerUpper === 'DOMANDA' || markerUpper.includes('DOMANDA')) {
      label = question.marker;
    } else {
      label = `${question.marker}`;
    }
  } else {
    label = 'DOMANDA';
  }
  
  if (question.condition) {
    label = `${label} (${question.condition})`;
  }
  
  lines.push(`📌 ${label}: "${question.text}"`);
  
  if (question.instructions?.wait) {
    const waitText = question.instructions.waitDetails 
      ? `⏸️ ASPETTA LA RISPOSTA - ${question.instructions.waitDetails}`
      : '⏸️ ASPETTA LA RISPOSTA';
    lines.push(waitText);
  }
  
  if (question.instructions?.listen) {
    lines.push(`🎧 ASCOLTA ${question.instructions.listen}`);
  }
  
  if (question.instructions?.react && question.instructions.react.length > 0) {
    const reactPrefix = question.instructions.reactContext 
      ? `💬 REAGISCI ${question.instructions.reactContext}:`
      : '💬 REAGISCI:';
    lines.push(`${reactPrefix} ${question.instructions.react.join(' / ')}`);
  }
  
  if (question.instructions?.additionalInstructions && question.instructions.additionalInstructions.length > 0) {
    question.instructions.additionalInstructions.forEach(instr => {
      lines.push(`   → ${instr}`);
    });
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
    lines.push('');
    lines.push('❌ NON ANDARE AVANTI finché non hai RISPOSTE SPECIFICHE!');
  }
  
  lines.push('');
  
  for (const level of ladder.levels) {
    lines.push(`LIVELLO ${level.number}: ${level.name}`);
    if (level.objective) {
      lines.push(`🎯 OBIETTIVO: ${level.objective}`);
    }
    lines.push(`📌 DOMANDA: "${level.question}"`);
    lines.push('');
    lines.push('⏸️ ASPETTA LA RISPOSTA');
    
    if (level.examples && level.examples.length > 0) {
      lines.push('');
      lines.push('📚 ESEMPI PRATICI:');
      level.examples.forEach(ex => {
        lines.push(`Cliente dice: "${ex.clientSays}"`);
        lines.push(`✅ Tu dici: "${ex.youSay}"`);
      });
    }
    
    if (level.notes) {
      lines.push(`💡 NOTA: ${level.notes}`);
    }
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
  
  const title = checkpoint.phaseNumber 
    ? `CHECKPOINT FASE #${checkpoint.phaseNumber}`
    : `CHECKPOINT ${checkpoint.title}`;
  
  lines.push(`⛔ ${title}`);
  lines.push('━'.repeat(60));
  lines.push('PRIMA DI PASSARE ALLA FASE SUCCESSIVA VERIFICA:');
  lines.push('');
  
  checkpoint.checks.forEach(check => {
    lines.push(`✓ ${check}`);
  });
  
  lines.push('');
  lines.push('❌ SE ANCHE SOLO UNA RISPOSTA È "NO" → NON PUOI PROCEDERE!');
  
  if (checkpoint.resistanceHandling) {
    lines.push('');
    lines.push(`🛡️ SE RESISTE: "${checkpoint.resistanceHandling.trigger}"`);
    lines.push('RISPOSTA OBBLIGATORIA:');
    if (checkpoint.resistanceHandling.response) {
      lines.push(`"${checkpoint.resistanceHandling.response}"`);
    }
    
    if (checkpoint.resistanceHandling.steps) {
      checkpoint.resistanceHandling.steps.forEach((step, idx) => {
        lines.push(`STEP ${idx + 1} - ${step.action}: "${step.script}"`);
      });
    }
  }
  
  if (checkpoint.testFinale) {
    lines.push('');
    lines.push(`📊 TEST FINALE: "${checkpoint.testFinale}"`);
  }
  
  if (checkpoint.reminder) {
    lines.push('');
    lines.push('🚨 REMINDER CRITICO 🚨');
    lines.push(checkpoint.reminder);
  }
  
  lines.push('');
  lines.push('✅ SOLO DOPO QUESTO CHECKPOINT → PASSA ALLA FASE SUCCESSIVA');
  
  return lines.join('\n');
}

function formatStep(step: Step): string {
  const lines: string[] = [];
  
  lines.push(`**STEP ${step.number} - ${step.name}**`);
  if (step.objective) {
    lines.push(`🎯 OBIETTIVO: ${step.objective}`);
  }
  lines.push('');
  
  if (step.energy) {
    lines.push(formatEnergySettings(step.energy));
    lines.push('');
  }
  
  step.questions.forEach(question => {
    lines.push(formatQuestion(question));
    lines.push('');
  });
  
  if (step.transition) {
    lines.push(`✅ ${step.transition}`);
    lines.push('');
  }
  
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
  if (phase.description && !phase.description.toUpperCase().includes(phase.name.toUpperCase())) {
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
  
  const scriptName = structure.metadata?.name || 'Script';
  const scriptDescription = structure.metadata?.description;
  
  lines.push('═'.repeat(80));
  lines.push(`# ${scriptName.toUpperCase()}`);
  lines.push('═'.repeat(80));
  lines.push('');
  
  if (scriptDescription) {
    lines.push(scriptDescription);
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
  totalKeyQuestions: number;
  totalCheckpoints: number;
  totalLadders: number;
  totalEnergy: number;
  totalObjections: number;
  objectionsWithEnergy: number;
  objectionsWithLadder: number;
  hasGlobalRules: boolean;
} {
  let totalSteps = 0;
  let totalQuestions = 0;
  let totalKeyQuestions = 0;
  let totalCheckpoints = 0;
  let totalLadders = 0;
  let totalEnergy = 0;

  structure.phases?.forEach(phase => {
    totalSteps += phase.steps?.length || 0;
    if (phase.checkpoint) totalCheckpoints++;
    if (phase.energy) totalEnergy++;
    
    phase.steps?.forEach(step => {
      totalQuestions += step.questions?.length || 0;
      totalKeyQuestions += step.questions?.filter(q => q.isKey).length || 0;
      if (step.ladder) totalLadders++;
      if (step.energy) totalEnergy++;
    });
  });

  let objectionsWithEnergy = 0;
  let objectionsWithLadder = 0;
  structure.objections?.forEach(obj => {
    if (obj.energy) objectionsWithEnergy++;
    if (obj.ladder) objectionsWithLadder++;
  });

  return {
    totalPhases: structure.phases?.length || 0,
    totalSteps,
    totalQuestions,
    totalKeyQuestions,
    totalCheckpoints,
    totalLadders,
    totalEnergy,
    totalObjections: structure.objections?.length || 0,
    objectionsWithEnergy,
    objectionsWithLadder,
    hasGlobalRules: (structure.globalRules?.length || 0) > 0,
  };
}

export function logParsingResults(structure: ScriptBlockStructure, scriptType: string): void {
  const summary = extractScriptSummary(structure);
  console.log(`\n📊 PARSING RESULTS - ${scriptType.toUpperCase()}`);
  console.log('━'.repeat(50));
  console.log(`📁 Fasi: ${summary.totalPhases}`);
  console.log(`📝 Step: ${summary.totalSteps}`);
  console.log(`❓ Domande: ${summary.totalQuestions} (${summary.totalKeyQuestions} chiave)`);
  console.log(`⚡ Energy Settings: ${summary.totalEnergy}`);
  console.log(`🔍 Ladder: ${summary.totalLadders}`);
  console.log(`⛔ Checkpoint: ${summary.totalCheckpoints}`);
  console.log(`🛡️ Obiezioni: ${summary.totalObjections} (${summary.objectionsWithEnergy} con energy, ${summary.objectionsWithLadder} con ladder)`);
  console.log(`📋 Regole Globali: ${structure.globalRules?.length || 0}`);
  console.log('━'.repeat(50));
}
