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
- Target Client: ${agentContext.targetClient || 'Non specificato'}
- USP (Unique Selling Proposition): ${agentContext.usp || 'Non specificato'}
- Valori aziendali: ${JSON.stringify(agentContext.values || [])}
- Mission: ${agentContext.mission || 'Non specificato'}
- Cosa facciamo: ${agentContext.whatWeDo || 'Non specificato'}
- Come lo facciamo: ${agentContext.howWeDoIt || 'Non specificato'}

${userComment ? `## COMMENTO UTENTE:\n${userComment}\n` : ''}

## SCRIPT DA PERSONALIZZARE (struttura completa):
${JSON.stringify(structure.phases?.map(phase => ({
  phase: phase.name,
  phaseNumber: phase.number,
  description: phase.description,
  energy: phase.energy ? {
    level: phase.energy.level,
    tone: phase.energy.tone,
    volume: phase.energy.volume,
    rhythm: phase.energy.rhythm,
    vocabulary: phase.energy.vocabulary,
    mindset: phase.energy.mindset
  } : null,
  steps: phase.steps?.map(step => ({
    stepNumber: step.number,
    name: step.name,
    objective: step.objective,
    energy: step.energy ? {
      level: step.energy.level,
      tone: step.energy.tone,
      vocabulary: step.energy.vocabulary,
      mindset: step.energy.mindset
    } : null,
    questions: step.questions?.map(q => ({
      text: q.text,
      marker: q.marker,
      isKey: q.isKey,
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
        examples: l.examples
      })),
      stopWhen: step.ladder.stopWhen,
      helpfulPhrases: step.ladder.helpfulPhrases
    } : null,
    biscottino: step.biscottino,
    transition: step.transition,
    notes: step.notes,
    resistanceHandling: step.resistanceHandling
  })),
  checkpoint: phase.checkpoint ? {
    title: phase.checkpoint.title,
    checks: phase.checkpoint.checks,
    resistanceHandling: phase.checkpoint.resistanceHandling,
    testFinale: phase.checkpoint.testFinale,
    reminder: phase.checkpoint.reminder
  } : null
})), null, 2)}

## REGOLE DI PERSONALIZZAZIONE:
1. MANTIENI ESATTAMENTE la struttura JSON: stesse fasi, step, numero di domande
2. PERSONALIZZA per il target client specifico:
   - Domande: adattale al settore e pain points del target
   - Vocabulary nelle energy settings: aggiungi termini specifici del settore
   - Ladder questions: rendi specifiche per i problemi del target
   - Biscottino phrases: adatta al tono del business
   - Checkpoint checks: personalizza per il settore
   - Examples nelle ladder: crea esempi realistici per il settore
3. SOSTITUISCI placeholder generici con riferimenti al business reale
4. MANTIENI lo stile e il tono professionale
5. NON modificare: numeri di step/fase, struttura delle istruzioni, marker

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
        model: 'gemini-3-pro-preview',
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 1.0,
          maxOutputTokens: 8192,
        },
      });
      
      const responseText = result.response.text();
      console.log('[ScriptBuilder] AI response received, parsing...');
      
      const jsonMatch = responseText.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const aiModifications = JSON.parse(jsonMatch[0]);
        
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
      }

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
