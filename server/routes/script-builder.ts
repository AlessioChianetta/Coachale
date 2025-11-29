import { Router, Response } from 'express';
import { db } from '../db';
import { clientSalesAgents, users } from '../../shared/schema';
import { eq, and } from 'drizzle-orm';
import { getDiscoveryScript, getDemoScript, getObjectionsScript } from '../ai/sales-scripts-base';
import { getDiscoveryScript as getDiscoveryScriptB2C, getDemoScript as getDemoScriptB2C, getObjectionsScript as getObjectionsScriptB2C } from '../ai/sales-scripts-base-B2C';
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
    const { templateId, agentId, userComment, targetType } = req.body;
    const isB2C = targetType === 'b2c';

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
        content = isB2C ? getDiscoveryScriptB2C() : getDiscoveryScript();
        break;
      case 'demo':
        content = isB2C 
          ? getDemoScriptB2C(
              agent.businessName || 'Il Tuo Business',
              agent.displayName || 'Consulente',
              [],
              [],
              null
            )
          : getDemoScript(
              agent.businessName || 'Il Tuo Business',
              agent.displayName || 'Consulente',
              [],
              [],
              null
            );
        break;
      case 'objections':
        content = isB2C ? getObjectionsScriptB2C() : getObjectionsScript();
        break;
      default:
        return res.status(400).json({ error: 'Tipo template non valido' });
    }
    
    console.log(`[ScriptBuilder] Using ${isB2C ? 'B2C' : 'B2B'} template for ${template.type}`);

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

      const targetTypeLabel = isB2C ? 'B2C (Individui: atleti, studenti, pazienti, professionisti)' : 'B2B (Business: imprenditori, aziende)';
      
      const b2cSpecificInstructions = isB2C ? `
## 🚨 ISTRUZIONI SPECIFICHE B2C - QUESTO È UN TARGET INDIVIDUALE! 🚨
Stai personalizzando uno script per INDIVIDUI (atleti, studenti, pazienti, privati), NON per imprenditori!

⛔ NON USARE MAI questi concetti B2B:
- Fatturato, revenue, margini
- Clienti, lead, CAC, LTV
- Marketing, advertising, funnel
- Team, dipendenti, collaboratori
- B2B, B2C come modello di business
- Ticket medio, scontrino

✅ USA INVECE questi concetti B2C:
- Obiettivi personali, traguardi, sogni
- Livello attuale (1-10), performance, progressi
- Tempo libero, ore dedicate, costanza
- Famiglia, partner, supporto sociale
- Stress, emozioni, autostima, relazioni
- Ostacoli quotidiani, blocchi mentali
- Motivazione, disciplina, abitudini

📝 ESEMPIO TRASFORMAZIONE:
- ❌ "Qual è il tuo fatturato mensile?" → ✅ "A che livello sei ora da 1 a 10?"
- ❌ "Quanti clienti hai?" → ✅ "Quante ore dedichi a settimana a questo?"
- ❌ "Problemi con il marketing?" → ✅ "Dove ti blocchi di più nel quotidiano?"
` : '';

      const prompt = `Sei un esperto coach di vendita telefonica che sa ADATTARSI COMPLETAMENTE al contesto del cliente target.
Il tuo compito è personalizzare uno script in modo che sia PERFETTAMENTE RILEVANTE per il target specifico.

## 🎯 TIPO DI TARGET SELEZIONATO: ${targetTypeLabel}
${b2cSpecificInstructions}
## ⚠️ ANALIZZA IL TARGET:
Leggi attentamente "Target Client" e "Cosa facciamo". Chiediti:
- Questo target gestisce un BUSINESS? → Domande su fatturato, clienti, marketing sono appropriate
- Questo target è un INDIVIDUO (atleta, studente, paziente)? → Domande su obiettivi personali, performance, situazione

QUESTA ANALISI DETERMINA COMPLETAMENTE COME PERSONALIZZARE LE DOMANDE!

## CONTEXT:
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

## 🔥 REGOLE DI PERSONALIZZAZIONE CRITICHE:

### 1. PERSONALIZZARE = SOSTITUIRE SE NON PERTINENTE
NON "adattare le parole" ma CAMBIARE IL CONCETTO se non ha senso per il target.
- Se il target NON gestisce un business → ELIMINA domande su fatturato, clienti, marketing, B2B/B2C, CAC
- Se il target è un atleta → SOSTITUISCI con domande su performance, obiettivi sportivi, allenamento
- Se il target è uno studente → SOSTITUISCI con domande su studio, esami, obiettivi accademici

### 2. FASE #3 (INFO BUSINESS/PERSONALI) - ATTENZIONE SPECIALE:
Questa fase raccoglie info sul CONTESTO del prospect.
- TARGET BUSINESS: domande su modello, clienti, fatturato, team, marketing → OK
- TARGET INDIVIDUO: domande sulla SUA situazione personale, obiettivi, livello, risorse → SOSTITUISCI COMPLETAMENTE

### 3. STEP 9 (STATO ATTUALE) - CAMBIA LA METRICA:
Questa fase raccoglie un NUMERO per capire il punto di partenza.
- TARGET BUSINESS: fatturato mensile/annuale → OK
- TARGET INDIVIDUO: livello su 10, tempo dedicato, performance attuale → SOSTITUISCI

### 4. ESEMPI NELLE LADDER - RISCRIVILI:
Gli esempi devono essere PERTINENTI al target:
- TARGET BUSINESS: "Ho problemi con il marketing", "Non trovo clienti" → OK
- TARGET INDIVIDUO: "Non miglioro i risultati", "Sono in stallo", "Non raggiungo gli obiettivi" → SOSTITUISCI

### 5. USA "COSA FACCIAMO" E "COME LO FACCIAMO":
Questi dati ti dicono ESATTAMENTE in che ambito opera l'agente.
Le domande devono essere COERENTI con questo ambito!

### 6. USA LA CREDIBILITÀ:
- Inserisci riferimenti agli anni di esperienza quando opportuno
- Cita il numero di clienti aiutati
- Usa i case studies come esempi concreti nelle ladder

### 7. USA SERVIZI E GARANZIE:
- Adatta le domande ai servizi specifici offerti
- Includi le garanzie nelle fasi di chiusura/obiezioni

### 8. ESCLUDI il NON-TARGET CLIENT:
- Le domande dovrebbero qualificare OUT chi non è il cliente ideale

### 9. MANTIENI LA STRUTTURA TECNICA:
- NON modificare: numeri di step/fase, marker, struttura JSON
- SÌ modificare: testo domande, esempi, vocabulary, objective, mindset

### 10. CHAIN OF THOUGHT - RAGIONA COSÌ PER OGNI STEP:
Prima di personalizzare, chiediti:
1. Chi è il target? (business owner o individuo?)
2. Questa domanda ha senso per lui?
3. Se NO → qual è la domanda equivalente nel suo contesto?
4. Scrivi la domanda modificata

## ⚠️ OUTPUT OBBLIGATORIO - TUTTE LE FASI:
Devi restituire TUTTE le fasi dello script, non solo alcune.
Se lo script ha 7 fasi, devi restituire 7 fasi modificate.

Rispondi SOLO con un JSON array delle fasi modificate. Ogni fase deve contenere:
- phaseName: nome fase originale
- phaseNumber: numero fase
- energy: oggetto energy se presente (con vocabulary personalizzato per il target)
- steps: array di step modificati, ognuno con:
  - stepNumber, name, objective (personalizzato per il target)
  - energy: con vocabulary e mindset personalizzati
  - questions: array di oggetti {text, marker, isKey, instructions} - DOMANDE RISCRITTE per il target!
  - ladder: se presente, con levels personalizzati (question, examples PERTINENTI al target)
  - biscottino: {trigger, phrase} personalizzato
  - resistanceHandling: se presente, personalizzato
- checkpoint: se presente, con checks e resistanceHandling personalizzati

Rispondi SOLO con il JSON array, nessun testo prima o dopo.`;

      const result = await aiProvider.client.generateContent({
        model: 'gemini-2.5-pro',
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 65536,
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
      return res.status(500).json({
        success: false,
        error: 'Errore nella generazione AI. Riprova.',
        details: aiError.message,
      });
    }

  } catch (error) {
    console.error('Error in AI generation:', error);
    res.status(500).json({ error: 'Errore nella generazione AI' });
  }
});

export default router;
