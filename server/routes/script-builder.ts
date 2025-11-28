import { Router, Response } from 'express';
import { db } from '../db';
import { clientSalesAgents, users } from '../../shared/schema';
import { eq, and } from 'drizzle-orm';
import { getDiscoveryScript, getDemoScript, getObjectionsScript } from '../ai/sales-scripts-base';
import { AuthRequest, requireRole } from '../middleware/auth';
import { parseTextToBlocks } from '../../shared/script-parser';
import type { ScriptBlockStructure } from '../../shared/script-blocks';

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
      const { GoogleGenerativeAI } = await import('@google/genai');
      const apiKey = process.env.GEMINI_API_KEY || process.env.AI_INTEGRATIONS_GOOGLE_GEMINI_API_KEY;
      
      if (!apiKey) {
        console.log('[ScriptBuilder] No Gemini API key, returning base template');
        return res.json({
          success: true,
          structure,
          message: 'Template base caricato (AI non disponibile)',
        });
      }

      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

      const prompt = `Sei un esperto di vendita telefonica.

Hai questo script di vendita con domande generiche:
${JSON.stringify(structure.phases?.map(p => ({
  phase: p.name,
  steps: p.steps?.map(s => ({
    step: s.name,
    questions: s.questions?.map(q => q.text)
  }))
})), null, 2)}

Devi PERSONALIZZARE le domande per questo specifico business:
- Nome Business: ${agentContext.businessName}
- Target Client: ${agentContext.targetClient || 'Non specificato'}
- USP: ${agentContext.usp || 'Non specificato'}
- Valori: ${JSON.stringify(agentContext.values || [])}
- Cosa facciamo: ${agentContext.whatWeDo || 'Non specificato'}
- Come lo facciamo: ${agentContext.howWeDoIt || 'Non specificato'}

${userComment ? `Commento aggiuntivo dell'utente: ${userComment}` : ''}

REGOLE:
1. NON cambiare la struttura (fasi, step)
2. Modifica SOLO il testo delle domande
3. Rendi le domande più specifiche per il target client
4. Mantieni lo stesso tono professionale ma adattato al settore
5. Includi riferimenti specifici al business quando appropriato

Rispondi SOLO con un JSON array delle fasi modificate nel formato:
[
  {
    "phaseName": "nome fase",
    "steps": [
      {
        "stepName": "nome step",
        "questions": ["domanda 1 modificata", "domanda 2 modificata"]
      }
    ]
  }
]`;

      const result = await model.generateContent(prompt);
      const responseText = result.response.text();
      
      const jsonMatch = responseText.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const aiModifications = JSON.parse(jsonMatch[0]);
        
        if (structure.phases) {
          for (const modification of aiModifications) {
            const phase = structure.phases.find(p => 
              p.name.toLowerCase().includes(modification.phaseName?.toLowerCase() || '')
            );
            
            if (phase && modification.steps) {
              for (const stepMod of modification.steps) {
                const step = phase.steps?.find(s => 
                  s.name.toLowerCase().includes(stepMod.stepName?.toLowerCase() || '')
                );
                
                if (step && step.questions && stepMod.questions) {
                  for (let i = 0; i < Math.min(step.questions.length, stepMod.questions.length); i++) {
                    if (stepMod.questions[i]) {
                      step.questions[i].text = stepMod.questions[i];
                    }
                  }
                }
              }
            }
          }
        }
      }

      res.json({
        success: true,
        structure,
        message: 'Script personalizzato con AI',
      });

    } catch (aiError) {
      console.error('[ScriptBuilder] AI generation error:', aiError);
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
