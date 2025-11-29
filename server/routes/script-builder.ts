import { Router, Response } from 'express';
import { db } from '../db';
import { clientSalesAgents, users } from '../../shared/schema';
import { eq, and } from 'drizzle-orm';
import { getDiscoveryScript, getDemoScript, getObjectionsScript } from '../ai/sales-scripts-base';
import { AuthRequest, requireRole } from '../middleware/auth';
import { parseTextToBlocks } from '../../shared/script-parser';
import type { ScriptBlockStructure } from '../../shared/script-blocks';
import { getAIProvider } from '../ai/provider-factory';

const router = Router();

const requireClient = requireRole('client');

interface TemplateInfo {
  id: string;
  name: string;
  description: string;
  type: 'discovery' | 'demo' | 'objections';
  phasesCount: number;
}

const AVAILABLE_TEMPLATES: TemplateInfo[] = [
  {
    id: 'discovery-base',
    name: 'Discovery Call Base',
    description: 'Script completo per qualificare i prospect e capire i loro pain point',
    type: 'discovery',
    phasesCount: 5,
  },
  {
    id: 'demo-base',
    name: 'Demo Call Base',
    description: 'Script per presentare l\'offerta e chiudere la vendita',
    type: 'demo',
    phasesCount: 6,
  },
  {
    id: 'objections-base',
    name: 'Gestione Obiezioni Base',
    description: 'Script per rispondere alle obiezioni comuni',
    type: 'objections',
    phasesCount: 10,
  },
];

router.get('/templates', requireClient, async (req: AuthRequest, res: Response) => {
  try {
    res.json(AVAILABLE_TEMPLATES);
  } catch (error) {
    console.error('Error fetching templates:', error);
    res.status(500).json({ error: 'Errore nel recupero dei templates' });
  }
});

router.get('/templates/:templateId', requireClient, async (req: AuthRequest, res: Response) => {
  try {
    const { templateId } = req.params;
    
    const template = AVAILABLE_TEMPLATES.find(t => t.id === templateId);
    if (!template) {
      return res.status(404).json({ error: 'Template non trovato' });
    }

    let content: string;
    switch (template.type) {
      case 'discovery':
        content = getDiscoveryScript();
        break;
      case 'demo':
        content = getDemoScript('Il Tuo Business', 'Il Tuo Nome', [], [], null);
        break;
      case 'objections':
        content = getObjectionsScript();
        break;
      default:
        return res.status(400).json({ error: 'Tipo template non valido' });
    }

    const structure = parseTextToBlocks(content, template.type);

    res.json({
      ...template,
      content,
      structure,
    });
  } catch (error) {
    console.error('Error fetching template:', error);
    res.status(500).json({ error: 'Errore nel recupero del template' });
  }
});

router.get('/agents', requireClient, async (req: AuthRequest, res: Response) => {
  try {
    const clientId = req.user!.id;

    const agents = await db
      .select({
        id: clientSalesAgents.id,
        agentName: clientSalesAgents.agentName,
        displayName: clientSalesAgents.displayName,
        businessName: clientSalesAgents.businessName,
        businessDescription: clientSalesAgents.businessDescription,
        targetClient: clientSalesAgents.targetClient,
        usp: clientSalesAgents.usp,
        values: clientSalesAgents.values,
        mission: clientSalesAgents.mission,
        vision: clientSalesAgents.vision,
        whatWeDo: clientSalesAgents.whatWeDo,
        howWeDoIt: clientSalesAgents.howWeDoIt,
      })
      .from(clientSalesAgents)
      .where(eq(clientSalesAgents.clientId, clientId));

    res.json(agents);
  } catch (error) {
    console.error('Error fetching agents for builder:', error);
    res.status(500).json({ error: 'Errore nel recupero degli agenti' });
  }
});

router.post('/ai-generate', requireClient, async (req: AuthRequest, res: Response) => {
  try {
    const clientId = req.user!.id;
    const { templateId, agentId, userComment } = req.body;

    if (!templateId || !agentId) {
      return res.status(400).json({ error: 'templateId e agentId sono obbligatori' });
    }

    const template = AVAILABLE_TEMPLATES.find(t => t.id === templateId);
    if (!template) {
      return res.status(404).json({ error: 'Template non trovato' });
    }

    const [agent] = await db
      .select()
      .from(clientSalesAgents)
      .where(and(
        eq(clientSalesAgents.id, agentId),
        eq(clientSalesAgents.clientId, clientId)
      ));

    if (!agent) {
      return res.status(404).json({ error: 'Agente non trovato' });
    }

    const consultantId = agent.consultantId;

    let content: string;
    switch (template.type) {
      case 'discovery':
        content = getDiscoveryScript();
        break;
      case 'demo':
        content = getDemoScript(
          agent.businessName || 'Il Tuo Business',
          agent.displayName || 'Consulente',
          [],
          [],
          null
        );
        break;
      case 'objections':
        content = getObjectionsScript();
        break;
      default:
        return res.status(400).json({ error: 'Tipo template non valido' });
    }

    const structure = parseTextToBlocks(content, template.type);

    const agentContext = {
      businessName: agent.businessName,
      displayName: agent.displayName,
      targetClient: agent.targetClient,
      usp: agent.usp,
      values: agent.values,
      mission: agent.mission,
      whatWeDo: agent.whatWeDo,
      howWeDoIt: agent.howWeDoIt,
      businessDescription: agent.businessDescription,
      consultantBio: agent.consultantBio,
      vision: agent.vision,
      nonTargetClient: agent.nonTargetClient,
      yearsExperience: agent.yearsExperience,
      clientsHelped: agent.clientsHelped,
      resultsGenerated: agent.resultsGenerated,
      softwareCreated: agent.softwareCreated,
      booksPublished: agent.booksPublished,
      caseStudies: agent.caseStudies,
      servicesOffered: agent.servicesOffered,
      guarantees: agent.guarantees,
    };

    try {
      console.log('[ScriptBuilder] Getting AI provider for client:', clientId, 'consultant:', consultantId);
      const aiProvider = await getAIProvider(clientId, consultantId);
      
      if (!aiProvider) {
        console.log('[ScriptBuilder] No AI provider available, returning base template');
        return res.json({
          success: true,
          structure,
          message: 'Template base caricato (AI non disponibile)',
        });
      }

      console.log(`[ScriptBuilder] Using AI provider: ${aiProvider.metadata.name} (${aiProvider.source})`);

      const prompt = `Sei un esperto coach di vendita telefonica B2B e devi personalizzare uno script per un business specifico.

## BUSINESS CONTEXT:
- Nome Business: ${agentContext.businessName || 'Non specificato'}
- Display Name: ${agentContext.displayName || 'Consulente'}
- Descrizione Business: ${agentContext.businessDescription || 'Non specificata'}
- Bio Consulente: ${agentContext.consultantBio || 'Non specificata'}
- Vision: ${agentContext.vision || 'Non specificata'}
- Mission: ${agentContext.mission || 'Non specificata'}
- Target Client: ${agentContext.targetClient || 'Non specificato'}
- NON Target Client: ${agentContext.nonTargetClient || 'Non specificato'}
- USP: ${agentContext.usp || 'Non specificato'}
- Valori: ${JSON.stringify(agentContext.values || [])}
- Cosa facciamo: ${agentContext.whatWeDo || 'Non specificato'}
- Come lo facciamo: ${agentContext.howWeDoIt || 'Non specificato'}

## CREDIBILITÀ E PROVA SOCIALE:
- Anni di esperienza: ${agentContext.yearsExperience || 0}
- Clienti aiutati: ${agentContext.clientsHelped || 0}
- Risultati generati: ${agentContext.resultsGenerated || 'Non specificati'}
- Software creati: ${JSON.stringify(agentContext.softwareCreated || [])}
- Libri pubblicati: ${JSON.stringify(agentContext.booksPublished || [])}
- Case Studies: ${JSON.stringify(agentContext.caseStudies || [])}

## SERVIZI E GARANZIE:
- Servizi offerti: ${JSON.stringify(agentContext.servicesOffered || [])}
- Garanzie: ${agentContext.guarantees || 'Non specificate'}

${userComment ? `## COMMENTO UTENTE:\n${userComment}\n` : ''}

## METADATA SCRIPT:
${JSON.stringify(structure.metadata || {}, null, 2)}

## REGOLE GLOBALI (da rispettare SEMPRE):
${JSON.stringify(structure.globalRules || [], null, 2)}

${structure.finalRules?.length ? `## REGOLE FINALI:\n${JSON.stringify(structure.finalRules, null, 2)}` : ''}

## SCRIPT DA PERSONALIZZARE (struttura completa):
${JSON.stringify({
  phases: structure.phases?.map(phase => ({
    phase: phase.name,
    phaseNumber: phase.number,
    description: phase.description,
    transition: phase.transition,
    energy: phase.energy ? {
      level: phase.energy.level,
      tone: phase.energy.tone,
      volume: phase.energy.volume,
      rhythm: phase.energy.rhythm,
      inflections: phase.energy.inflections,
      vocabulary: phase.energy.vocabulary,
      negativeVocabulary: phase.energy.negativeVocabulary,
      mindset: phase.energy.mindset,
      example: phase.energy.example
    } : null,
    steps: phase.steps?.map(step => ({
      stepNumber: step.number,
      name: step.name,
      objective: step.objective,
      energy: step.energy ? {
        level: step.energy.level,
        tone: step.energy.tone,
        volume: step.energy.volume,
        rhythm: step.energy.rhythm,
        inflections: step.energy.inflections,
        vocabulary: step.energy.vocabulary,
        negativeVocabulary: step.energy.negativeVocabulary,
        mindset: step.energy.mindset,
        example: step.energy.example
      } : null,
      questions: step.questions?.map(q => ({
        text: q.text,
        marker: q.marker,
        isKey: q.isKey,
        condition: q.condition,
        instructions: q.instructions
      })),
      ladder: step.ladder ? {
        title: step.ladder.title,
        whenToUse: step.ladder.whenToUse,
        levels: step.ladder.levels?.map(l => ({
          number: l.number,
          name: l.name,
          objective: l.objective,
          question: l.question,
          tone: l.tone,
          examples: l.examples,
          notes: l.notes
        })),
        stopWhen: step.ladder.stopWhen,
        dontStopWhen: step.ladder.dontStopWhen,
        helpfulPhrases: step.ladder.helpfulPhrases,
        goldSignals: step.ladder.goldSignals,
        resistanceHandling: step.ladder.resistanceHandling
      } : null,
      biscottino: step.biscottino,
      transition: step.transition,
      notes: step.notes,
      resistanceHandling: step.resistanceHandling
    })),
    checkpoint: phase.checkpoint ? {
      title: phase.checkpoint.title,
      phaseNumber: phase.checkpoint.phaseNumber,
      checks: phase.checkpoint.checks,
      resistanceHandling: phase.checkpoint.resistanceHandling,
      testFinale: phase.checkpoint.testFinale,
      testFinaleExamples: phase.checkpoint.testFinaleExamples,
      reminder: phase.checkpoint.reminder
    } : null
  })),
  objections: structure.objections?.map(obj => ({
    number: obj.number,
    title: obj.title,
    variants: obj.variants,
    objective: obj.objective,
    energy: obj.energy,
    ladder: obj.ladder,
    reframe: obj.reframe,
    keyQuestion: obj.keyQuestion,
    cta: obj.cta,
    analogy: obj.analogy,
    steps: obj.steps
  }))
}, null, 2)}

## REGOLE DI PERSONALIZZAZIONE:
1. MANTIENI ESATTAMENTE la struttura JSON: stesse fasi, step, numero di domande
2. PERSONALIZZA usando i dati del business:
   - Domande: adattale al settore e pain points del TARGET CLIENT
   - Vocabulary: usa termini dal settore del business
   - Ladder questions: rendi specifiche per i problemi del TARGET CLIENT
   - Biscottino: adatta al tono e personalità del consulente
   - Examples nelle ladder: USA I CASE STUDIES REALI se disponibili
   - Checkpoint checks: personalizza per il settore
3. USA LA CREDIBILITÀ:
   - Inserisci riferimenti agli anni di esperienza
   - Cita il numero di clienti aiutati quando opportuno
   - Fai riferimento ai risultati generati
   - Usa i case studies come esempi concreti nelle ladder
4. USA SERVIZI E GARANZIE:
   - Adatta le domande ai servizi specifici offerti
   - Includi le garanzie nelle fasi di chiusura/obiezioni
5. ESCLUDI il NON-TARGET CLIENT:
   - Le domande dovrebbero qualificare OUT chi non è il cliente ideale
6. NON modificare: numeri di step/fase, struttura delle istruzioni, marker

## OUTPUT RICHIESTO:
Rispondi SOLO con un JSON array delle fasi modificate. Ogni fase deve contenere:
- phaseName: nome fase originale
- phaseNumber: numero fase
- energy: oggetto energy se presente (con vocabulary personalizzato)
- steps: array di step modificati, ognuno con:
  - stepNumber, name, objective (personalizzato)
  - energy: con vocabulary e mindset personalizzati
  - questions: array di oggetti {text, marker, isKey, instructions}
  - ladder: se presente, con levels personalizzati (question, examples)
  - biscottino: {trigger, phrase} personalizzato
  - resistanceHandling: se presente, personalizzato
- checkpoint: se presente, con checks e resistanceHandling personalizzati

Rispondi SOLO con il JSON array, nessun testo prima o dopo.`;

      const result = await aiProvider.client.generateContent({
        model: 'gemini-2.5-pro',
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 1.0,
          maxOutputTokens: 8192,
          responseMimeType: 'application/json',
        },
      });
      
      const responseText = result.response.text();
      console.log('[ScriptBuilder] AI response received, length:', responseText.length);

      let cleanedResponse = responseText
        .replace(/```json\s*/gi, '')
        .replace(/```\s*/gi, '')
        .replace(/^\s*[\r\n]+/, '')
        .replace(/[\r\n]+\s*$/, '')
        .trim();

      let aiModifications;
      try {
        aiModifications = JSON.parse(cleanedResponse);
      } catch (directError) {
        console.log('[ScriptBuilder] Direct parse failed, trying regex extraction...');
        const jsonMatch = cleanedResponse.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          try {
            aiModifications = JSON.parse(jsonMatch[0]);
          } catch (regexError) {
            console.error('[ScriptBuilder] Regex extraction also failed:', regexError);
            console.log('[ScriptBuilder] Raw response (first 500 chars):', cleanedResponse.substring(0, 500));
            throw new Error('Failed to parse AI response as JSON');
          }
        } else {
          console.error('[ScriptBuilder] No JSON array found in response');
          console.log('[ScriptBuilder] Raw response (first 500 chars):', cleanedResponse.substring(0, 500));
          throw new Error('No JSON array found in AI response');
        }
      }

      if (!Array.isArray(aiModifications)) {
        console.error('[ScriptBuilder] Parsed result is not an array');
        throw new Error('AI response is not a valid array');
      }

      console.log('[ScriptBuilder] Successfully parsed', aiModifications.length, 'phase modifications');
        
      if (structure.phases) {
        for (const modification of aiModifications) {
            const phase = structure.phases.find(p => 
              p.number === modification.phaseNumber || 
              p.name.toLowerCase().includes(modification.phaseName?.toLowerCase() || '')
            );
            
            if (!phase) continue;

            if (modification.energy && phase.energy) {
              if (modification.energy.vocabulary) {
                phase.energy.vocabulary = modification.energy.vocabulary;
              }
              if (modification.energy.mindset) {
                phase.energy.mindset = modification.energy.mindset;
              }
            }

            if (modification.checkpoint && phase.checkpoint) {
              if (modification.checkpoint.checks) {
                phase.checkpoint.checks = modification.checkpoint.checks;
              }
              if (modification.checkpoint.resistanceHandling) {
                phase.checkpoint.resistanceHandling = modification.checkpoint.resistanceHandling;
              }
              if (modification.checkpoint.testFinale) {
                phase.checkpoint.testFinale = modification.checkpoint.testFinale;
              }
            }
            
            if (modification.steps && phase.steps) {
              for (const stepMod of modification.steps) {
                const step = phase.steps.find(s => 
                  s.number === stepMod.stepNumber ||
                  s.name.toLowerCase().includes(stepMod.name?.toLowerCase() || '')
                );
                
                if (!step) continue;

                if (stepMod.objective) {
                  step.objective = stepMod.objective;
                }

                if (stepMod.energy && step.energy) {
                  if (stepMod.energy.vocabulary) {
                    step.energy.vocabulary = stepMod.energy.vocabulary;
                  }
                  if (stepMod.energy.mindset) {
                    step.energy.mindset = stepMod.energy.mindset;
                  }
                }

                if (stepMod.questions && step.questions) {
                  for (let i = 0; i < Math.min(step.questions.length, stepMod.questions.length); i++) {
                    const qMod = stepMod.questions[i];
                    if (qMod) {
                      if (typeof qMod === 'string') {
                        step.questions[i].text = qMod;
                      } else if (qMod.text) {
                        step.questions[i].text = qMod.text;
                        if (qMod.instructions) {
                          step.questions[i].instructions = { ...step.questions[i].instructions, ...qMod.instructions };
                        }
                      }
                    }
                  }
                }

                if (stepMod.ladder && step.ladder) {
                  if (stepMod.ladder.levels) {
                    for (let i = 0; i < Math.min(step.ladder.levels.length, stepMod.ladder.levels.length); i++) {
                      const levelMod = stepMod.ladder.levels[i];
                      if (levelMod) {
                        if (levelMod.question) step.ladder.levels[i].question = levelMod.question;
                        if (levelMod.objective) step.ladder.levels[i].objective = levelMod.objective;
                        if (levelMod.examples) step.ladder.levels[i].examples = levelMod.examples;
                      }
                    }
                  }
                  if (stepMod.ladder.helpfulPhrases) {
                    step.ladder.helpfulPhrases = stepMod.ladder.helpfulPhrases;
                  }
                }

                if (stepMod.biscottino && step.biscottino) {
                  if (stepMod.biscottino.phrase) {
                    step.biscottino.phrase = stepMod.biscottino.phrase;
                  }
                }

                if (stepMod.resistanceHandling && step.resistanceHandling) {
                  step.resistanceHandling = { ...step.resistanceHandling, ...stepMod.resistanceHandling };
                }

                if (stepMod.notes) {
                  step.notes = stepMod.notes;
                }
              }
            }
          }
        }
      
      console.log('[ScriptBuilder] AI modifications applied successfully');

      if (aiProvider.cleanup) {
        await aiProvider.cleanup();
      }

      res.json({
        success: true,
        structure,
        message: `Script personalizzato con ${aiProvider.metadata.name}`,
      });

    } catch (aiError: any) {
      console.error('[ScriptBuilder] AI generation error:', aiError.message);
      res.json({
        success: true,
        structure,
        message: 'Template base caricato (errore AI)',
      });
    }

  } catch (error) {
    console.error('Error in AI generation:', error);
    res.status(500).json({ error: 'Errore nella generazione AI' });
  }
});

export default router;
