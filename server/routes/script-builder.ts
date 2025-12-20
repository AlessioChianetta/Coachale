import { Router, Response } from 'express';
import { db } from '../db';
import { clientSalesAgents, users } from '../../shared/schema';
import { eq, and } from 'drizzle-orm';
import { getDiscoveryScript, getDemoScript, getObjectionsScript } from '../ai/sales-scripts-base';
import { getDiscoveryScript as getDiscoveryScriptB2C, getDemoScript as getDemoScriptB2C, getObjectionsScript as getObjectionsScriptB2C } from '../ai/sales-scripts-base-B2C';
import { AuthRequest, requireRole } from '../middleware/auth';
import { parseTextToBlocks } from '../../shared/script-parser';
import type { ScriptBlockStructure } from '../../shared/script-blocks';
import { getAIProvider, getModelForProviderName } from '../ai/provider-factory';
import { randomBytes } from 'crypto';

const router = Router();

const requireClient = requireRole('client');

// In-memory storage for generation progress (polling-based approach)
interface GenerationState {
  clientId: string;
  status: 'connecting' | 'generating' | 'completed' | 'error';
  totalPhases: number;
  currentPhaseIndex: number;
  phases: Array<{
    index: number;
    name: string;
    number: string;
    stepsCount: number;
    hasCheckpoint: boolean;
    status: 'pending' | 'in_progress' | 'completed' | 'failed';
    stats?: {
      stepsModified: number;
      totalSteps: number;
      questionsModified: number;
      timeMs: number;
    };
    error?: string;
  }>;
  completedCount: number;
  failedCount: number;
  structure?: any;
  errorMessage?: string;
  createdAt: number;
  updatedAt: number;
}

const generationStates = new Map<string, GenerationState>();

// Cleanup old generation states (older than 30 minutes)
setInterval(() => {
  const now = Date.now();
  for (const [id, state] of generationStates.entries()) {
    if (now - state.createdAt > 30 * 60 * 1000) {
      generationStates.delete(id);
    }
  }
}, 5 * 60 * 1000);

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
    const targetType = req.query.targetType as string || 'b2b';
    const isB2C = targetType === 'b2c';
    
    console.log(`📄 [ScriptBuilder] Loading template: ${templateId}, targetType: ${targetType}`);
    
    const template = AVAILABLE_TEMPLATES.find(t => t.id === templateId);
    if (!template) {
      return res.status(404).json({ error: 'Template non trovato' });
    }

    let content: string;
    switch (template.type) {
      case 'discovery':
        content = isB2C ? getDiscoveryScriptB2C() : getDiscoveryScript();
        break;
      case 'demo':
        content = isB2C 
          ? getDemoScriptB2C('Il Tuo Business', 'Il Tuo Nome', [], [], null)
          : getDemoScript('Il Tuo Business', 'Il Tuo Nome', [], [], null);
        break;
      case 'objections':
        content = isB2C ? getObjectionsScriptB2C() : getObjectionsScript();
        break;
      default:
        return res.status(400).json({ error: 'Tipo template non valido' });
    }

    const structure = parseTextToBlocks(content, template.type);
    
    console.log(`✅ [ScriptBuilder] Template loaded: ${template.type} (${isB2C ? 'B2C' : 'B2B'}), phases: ${structure.phases?.length || 0}`);

    res.json({
      ...template,
      content,
      structure,
      targetType,
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

// Polling endpoint for generation progress
router.get('/generation-status/:generationId', requireClient, async (req: AuthRequest, res: Response) => {
  try {
    const { generationId } = req.params;
    const clientId = req.user!.id;
    
    const state = generationStates.get(generationId);
    
    if (!state) {
      return res.status(404).json({ error: 'Generazione non trovata' });
    }
    
    if (state.clientId !== clientId) {
      return res.status(403).json({ error: 'Non autorizzato' });
    }
    
    res.json({
      status: state.status,
      totalPhases: state.totalPhases,
      currentPhaseIndex: state.currentPhaseIndex,
      phases: state.phases,
      completedCount: state.completedCount,
      failedCount: state.failedCount,
      structure: state.structure,
      errorMessage: state.errorMessage,
    });
  } catch (error) {
    console.error('Error fetching generation status:', error);
    res.status(500).json({ error: 'Errore nel recupero dello stato' });
  }
});

router.post('/ai-generate', requireClient, async (req: AuthRequest, res: Response) => {
  try {
    const clientId = req.user!.id;
    const { templateId, agentId, userComment, targetType, usePolling } = req.body;
    const isB2C = targetType === 'b2c';

    // Generate a unique ID for this generation
    const generationId = randomBytes(16).toString('hex');
    
    console.log('\n' + '═'.repeat(80));
    console.log('🚀 [ScriptBuilder] INIZIO GENERAZIONE AI FASE-PER-FASE');
    console.log('═'.repeat(80));
    console.log(`🆔 Generation ID: ${generationId}`);
    console.log(`📋 Template: ${templateId}`);
    console.log(`👤 Agent ID: ${agentId}`);
    console.log(`🎯 Target Type: ${isB2C ? 'B2C (Individui)' : 'B2B (Business)'}`);
    console.log(`💬 User Comment: ${userComment || 'Nessuno'}`);
    console.log(`📡 Polling Mode: ${usePolling ? 'Sì' : 'No'}`);
    console.log('─'.repeat(80));

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

    console.log(`✅ Agent trovato: ${agent.displayName || agent.agentName}`);
    console.log(`   Business: ${agent.businessName}`);
    console.log(`   Target: ${agent.targetClient}`);

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
    
    console.log(`📜 Template ${isB2C ? 'B2C' : 'B2B'} caricato per: ${template.type}`);

    const structure = parseTextToBlocks(content, template.type);
    const totalPhases = structure.phases?.length || 0;
    console.log(`📊 Script parsato: ${totalPhases} fasi trovate`);

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

    // Initialize generation state for polling
    const initialPhases = structure.phases?.map((p, idx) => ({
      index: idx,
      name: p.name,
      number: p.number || String(idx + 1),
      stepsCount: p.steps?.length || 0,
      hasCheckpoint: !!p.checkpoint,
      status: 'pending' as const,
    })) || [];

    const generationState: GenerationState = {
      clientId,
      status: 'connecting',
      totalPhases,
      currentPhaseIndex: -1,
      phases: initialPhases,
      completedCount: 0,
      failedCount: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    
    generationStates.set(generationId, generationState);
    
    // Respond immediately with generationId - client will poll for updates
    res.json({ generationId, totalPhases });
    
    // Update state helper
    const updateState = (updates: Partial<GenerationState>) => {
      const state = generationStates.get(generationId);
      if (state) {
        Object.assign(state, updates, { updatedAt: Date.now() });
      }
    };

    // Run generation in background (not awaited)
    (async () => {
      try {
        console.log('\n🔌 Connessione AI Provider...');
        const aiProvider = await getAIProvider(clientId, consultantId);
        
        if (!aiProvider) {
          console.log('⚠️ Nessun AI provider disponibile, ritorno template base');
          updateState({
            status: 'completed',
            structure,
          });
          return;
        }

        console.log(`✅ AI Provider: ${aiProvider.metadata.name} (${aiProvider.source})`);

      const targetTypeLabel = isB2C ? 'B2C (Individui: atleti, studenti, pazienti, professionisti)' : 'B2B (Business: imprenditori, aziende)';
      
      const targetSpecificInstructions = isB2C ? `
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
` : `
## 🚨 ISTRUZIONI SPECIFICHE B2B - QUESTO È UN TARGET BUSINESS! 🚨
Stai personalizzando uno script per IMPRENDITORI e AZIENDE, NON per individui privati!

⛔ NON USARE questi concetti personali/B2C:
- Obiettivi personali generici, sogni vaghi
- Livello personale 1-10
- Tempo libero, hobby
- Famiglia come supporto decisionale
- Emozioni personali, autostima
- Blocchi mentali personali

✅ USA INVECE questi concetti B2B:
- Fatturato mensile/annuale, revenue, margini
- Numero clienti, lead, CAC, LTV, ticket medio
- Marketing, advertising, funnel, conversioni
- Team, dipendenti, collaboratori, struttura aziendale
- Modello di business (B2B, B2C, servizi, prodotti)
- ROI, investimenti, budget aziendale
- Crescita aziendale, scalabilità, automazione

📝 DOMANDE TIPICHE B2B:
- "Qual è il tuo fatturato mensile attuale?"
- "Quanti clienti acquisisci al mese?"
- "Come funziona il tuo marketing attualmente?"
- "Quante persone hai nel team?"
- "Qual è il tuo ticket medio?"
- "Dove investi di più: acquisizione o fidelizzazione?"
- "Chi prende le decisioni di investimento nella tua azienda?"
`;

      const baseContextPrompt = `## CONTEXT AGENTE:
- Nome Business: ${agentContext.businessName || 'Non specificato'}
- Display Name: ${agentContext.displayName || 'Consulente'}
- Descrizione Business: ${agentContext.businessDescription || 'Non specificata'}
- Target Client: ${agentContext.targetClient || 'Non specificato'}
- NON Target Client: ${agentContext.nonTargetClient || 'Non specificato'}
- USP: ${agentContext.usp || 'Non specificato'}
- Valori: ${JSON.stringify(agentContext.values || [])}
- Cosa facciamo: ${agentContext.whatWeDo || 'Non specificato'}
- Come lo facciamo: ${agentContext.howWeDoIt || 'Non specificato'}
- Anni esperienza: ${agentContext.yearsExperience || 0}
- Clienti aiutati: ${agentContext.clientsHelped || 0}
- Servizi: ${JSON.stringify(agentContext.servicesOffered || [])}

${userComment ? `## ISTRUZIONI AGGIUNTIVE UTENTE:\n${userComment}\n` : ''}`;

      console.log('\n' + '═'.repeat(80));
      console.log('🔄 INIZIO GENERAZIONE FASE-PER-FASE');
      console.log('═'.repeat(80));

      let successfulPhases = 0;
      let failedPhases = 0;
      const phaseResults: { phase: string; success: boolean; error?: string; stepsModified?: number; questionsModified?: number }[] = [];

      // Update state to generating
      updateState({ status: 'generating' });

      if (structure.phases) {
        for (let phaseIndex = 0; phaseIndex < structure.phases.length; phaseIndex++) {
          const phase = structure.phases[phaseIndex];
          const phaseStartTime = Date.now();
          
          console.log('\n' + '─'.repeat(60));
          console.log(`📍 FASE ${phaseIndex + 1}/${totalPhases}: ${phase.name}`);
          console.log('─'.repeat(60));
          console.log(`   📌 Numero fase: #${phase.number}`);
          console.log(`   📝 Steps: ${phase.steps?.length || 0}`);
          console.log(`   ✓ Checkpoint: ${phase.checkpoint ? 'Sì' : 'No'}`);

          // Update phase to in_progress
          const currentState = generationStates.get(generationId);
          if (currentState) {
            currentState.currentPhaseIndex = phaseIndex;
            currentState.phases = currentState.phases.map((p, idx) =>
              idx === phaseIndex ? { ...p, status: 'in_progress' as const } : p
            );
            currentState.updatedAt = Date.now();
          }

          const phasePrompt = `Sei un esperto coach di vendita telefonica. Devi personalizzare UNA SINGOLA FASE di uno script di vendita.

## 🎯 TIPO DI TARGET: ${targetTypeLabel}
${targetSpecificInstructions}

${baseContextPrompt}

## ⚠️ REGOLE CRITICHE PER QUESTA FASE:

### CHECKPOINT - MANTIENI I CONTROLLI ORIGINALI!
Il checkpoint di ogni fase deve verificare SOLO le azioni di QUELLA fase:
- FASE #1 (Apertura): verifica saluto, "da dove chiami", spiegazione processo
- FASE #2 (Pain Point): verifica problema principale, tentativi passati, persistenza
- FASE #3 (Info Personali): verifica situazione personale, contesto
- FASE #4 (Inquisitorio): verifica domande diagnostiche
- FASE #5 (Stretch The Gap): verifica obiettivo e emozioni
- FASE #6 (Qualificazione): verifica bisogno aiuto esterno
- FASE #7 (Serietà): verifica urgenza, budget, decision maker

❌ NON MESCOLARE i controlli di fasi diverse nel checkpoint!
❌ NON mettere controlli su budget/urgenza nella FASE #1!

### PERSONALIZZAZIONE DOMANDE:
- Personalizza il TESTO delle domande per il target B2C/B2B
- Mantieni la STRUTTURA e i MARKER originali
- NON aggiungere o rimuovere domande, solo modifica il testo

## FASE DA PERSONALIZZARE:
${JSON.stringify({
  phaseName: phase.name,
  phaseNumber: phase.number,
  description: phase.description,
  energy: phase.energy,
  steps: phase.steps?.map(step => ({
    stepNumber: step.number,
    name: step.name,
    objective: step.objective,
    energy: step.energy,
    questions: step.questions?.map(q => ({
      text: q.text,
      marker: q.marker,
      isKey: q.isKey,
      condition: q.condition,
      instructions: q.instructions
    })),
    ladder: step.ladder,
    biscottino: step.biscottino,
    resistanceHandling: step.resistanceHandling
  })),
  checkpoint: phase.checkpoint
}, null, 2)}

## OUTPUT RICHIESTO:
Restituisci UN SINGOLO oggetto JSON (NON un array) con la fase personalizzata:
{
  "phaseName": "${phase.name}",
  "phaseNumber": "${phase.number}",
  "energy": { vocabulary, mindset personalizzati },
  "steps": [
    {
      "stepNumber": numero,
      "name": "nome step",
      "objective": "obiettivo personalizzato per target",
      "questions": [{ "text": "domanda personalizzata", "marker": "marker originale" }],
      "ladder": { levels con question/examples personalizzati },
      "resistanceHandling": personalizzato
    }
  ],
  "checkpoint": {
    "checks": [lista controlli CORRETTI per QUESTA fase],
    "resistanceHandling": personalizzato
  }
}

Rispondi SOLO con il JSON, nessun testo prima o dopo.`;

          try {
            console.log(`   🤖 Invio richiesta AI per FASE #${phase.number}...`);
            console.log(`   📏 Lunghezza prompt: ${phasePrompt.length} caratteri`);

            const result = await aiProvider.client.generateContent({
              model: getModelForProviderName(aiProvider.metadata.name),
              contents: [{ role: 'user', parts: [{ text: phasePrompt }] }],
              generationConfig: {
                temperature: 0.5,
                maxOutputTokens: 20384,
                responseMimeType: 'application/json',
              },
            });
            
            const responseText = result.response.text();
            const responseTime = Date.now() - phaseStartTime;
            
            console.log(`   ✅ Risposta ricevuta in ${responseTime}ms`);
            console.log(`   📏 Lunghezza risposta: ${responseText.length} caratteri`);

            let cleanedResponse = responseText
              .replace(/```json\s*/gi, '')
              .replace(/```\s*/gi, '')
              .replace(/^\s*[\r\n]+/, '')
              .replace(/[\r\n]+\s*$/, '')
              .trim();

            let phaseModification;
            try {
              phaseModification = JSON.parse(cleanedResponse);
              console.log(`   ✅ JSON parsato correttamente`);
            } catch (parseError) {
              console.log(`   ⚠️ Parse diretto fallito, provo estrazione...`);
              const jsonMatch = cleanedResponse.match(/\{[\s\S]*\}/);
              if (jsonMatch) {
                phaseModification = JSON.parse(jsonMatch[0]);
                console.log(`   ✅ JSON estratto con regex`);
              } else {
                throw new Error('Nessun JSON valido trovato nella risposta');
              }
            }

            let stepsModified = 0;
            let questionsModified = 0;

            if (phaseModification.energy && phase.energy) {
              if (phaseModification.energy.vocabulary) {
                phase.energy.vocabulary = phaseModification.energy.vocabulary;
              }
              if (phaseModification.energy.mindset) {
                phase.energy.mindset = phaseModification.energy.mindset;
              }
            }

            if (phaseModification.checkpoint && phase.checkpoint) {
              if (phaseModification.checkpoint.checks) {
                console.log(`   📋 Checkpoint: ${phaseModification.checkpoint.checks.length} controlli`);
                phase.checkpoint.checks = phaseModification.checkpoint.checks;
              }
              if (phaseModification.checkpoint.resistanceHandling) {
                phase.checkpoint.resistanceHandling = phaseModification.checkpoint.resistanceHandling;
              }
              if (phaseModification.checkpoint.testFinale) {
                phase.checkpoint.testFinale = phaseModification.checkpoint.testFinale;
              }
            }

            if (phaseModification.steps && phase.steps) {
              for (const stepMod of phaseModification.steps) {
                const step = phase.steps.find(s => 
                  s.number === stepMod.stepNumber ||
                  s.name?.toLowerCase().includes(stepMod.name?.toLowerCase() || '')
                );
                
                if (!step) continue;
                stepsModified++;

                if (stepMod.objective) {
                  step.objective = stepMod.objective;
                }

                if (stepMod.energy && step.energy) {
                  if (stepMod.energy.vocabulary) step.energy.vocabulary = stepMod.energy.vocabulary;
                  if (stepMod.energy.mindset) step.energy.mindset = stepMod.energy.mindset;
                }

                if (stepMod.questions && step.questions) {
                  for (let i = 0; i < Math.min(step.questions.length, stepMod.questions.length); i++) {
                    const qMod = stepMod.questions[i];
                    if (qMod) {
                      if (typeof qMod === 'string') {
                        step.questions[i].text = qMod;
                        questionsModified++;
                      } else if (qMod.text) {
                        step.questions[i].text = qMod.text;
                        questionsModified++;
                        if (qMod.instructions) {
                          step.questions[i].instructions = { ...step.questions[i].instructions, ...qMod.instructions };
                        }
                      }
                    }
                  }
                }

                if (stepMod.ladder && step.ladder && stepMod.ladder.levels) {
                  for (let i = 0; i < Math.min(step.ladder.levels.length, stepMod.ladder.levels.length); i++) {
                    const levelMod = stepMod.ladder.levels[i];
                    if (levelMod) {
                      if (levelMod.question) step.ladder.levels[i].question = levelMod.question;
                      if (levelMod.objective) step.ladder.levels[i].objective = levelMod.objective;
                      if (levelMod.examples) step.ladder.levels[i].examples = levelMod.examples;
                    }
                  }
                  if (stepMod.ladder.helpfulPhrases) {
                    step.ladder.helpfulPhrases = stepMod.ladder.helpfulPhrases;
                  }
                }

                if (stepMod.biscottino && step.biscottino) {
                  if (stepMod.biscottino.phrase) step.biscottino.phrase = stepMod.biscottino.phrase;
                }

                if (stepMod.resistanceHandling && step.resistanceHandling) {
                  step.resistanceHandling = { ...step.resistanceHandling, ...stepMod.resistanceHandling };
                }

                if (stepMod.notes) step.notes = stepMod.notes;
              }
            }

            console.log(`   ✅ FASE #${phase.number} COMPLETATA`);
            console.log(`      → Steps modificati: ${stepsModified}/${phase.steps?.length || 0}`);
            console.log(`      → Domande modificate: ${questionsModified}`);
            console.log(`      → Tempo totale: ${responseTime}ms`);

            successfulPhases++;
            phaseResults.push({
              phase: phase.name,
              success: true,
              stepsModified,
              questionsModified
            });

            // Update phase to completed
            const stateAfterComplete = generationStates.get(generationId);
            if (stateAfterComplete) {
              stateAfterComplete.completedCount = successfulPhases;
              stateAfterComplete.phases = stateAfterComplete.phases.map((p, idx) =>
                idx === phaseIndex ? {
                  ...p,
                  status: 'completed' as const,
                  stats: {
                    stepsModified,
                    totalSteps: phase.steps?.length || 0,
                    questionsModified,
                    timeMs: responseTime
                  }
                } : p
              );
              stateAfterComplete.updatedAt = Date.now();
            }

          } catch (phaseError: any) {
            console.log(`   ❌ ERRORE FASE #${phase.number}: ${phaseError.message}`);
            failedPhases++;
            phaseResults.push({
              phase: phase.name,
              success: false,
              error: phaseError.message
            });

            // Update phase to failed
            const stateAfterFail = generationStates.get(generationId);
            if (stateAfterFail) {
              stateAfterFail.failedCount = failedPhases;
              stateAfterFail.phases = stateAfterFail.phases.map((p, idx) =>
                idx === phaseIndex ? { ...p, status: 'failed' as const, error: phaseError.message } : p
              );
              stateAfterFail.updatedAt = Date.now();
            }
          }

          if (phaseIndex < structure.phases.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        }
      }

      console.log('\n' + '═'.repeat(80));
      console.log('📊 RIEPILOGO GENERAZIONE');
      console.log('═'.repeat(80));
      console.log(`✅ Fasi completate: ${successfulPhases}/${totalPhases}`);
      console.log(`❌ Fasi fallite: ${failedPhases}/${totalPhases}`);
      console.log('\n📋 Dettaglio per fase:');
      phaseResults.forEach((result, idx) => {
        if (result.success) {
          console.log(`   ${idx + 1}. ${result.phase}: ✅ OK (${result.stepsModified} steps, ${result.questionsModified} domande)`);
        } else {
          console.log(`   ${idx + 1}. ${result.phase}: ❌ ERRORE - ${result.error}`);
        }
      });
      console.log('═'.repeat(80) + '\n');

      if (aiProvider.cleanup) {
        await aiProvider.cleanup();
      }

      // Update final state to completed
      updateState({
        status: 'completed',
        structure,
        completedCount: successfulPhases,
        failedCount: failedPhases,
      });

      console.log(`✅ [ScriptBuilder] Generation ${generationId} completed`);

    } catch (aiError: any) {
      console.error('\n❌ [ScriptBuilder] ERRORE CRITICO:', aiError.message);
      console.error(aiError.stack);
      
      updateState({
        status: 'error',
        errorMessage: aiError.message || 'Errore nella generazione AI',
      });
    }
    })().catch(err => {
      console.error('[ScriptBuilder] Background generation error:', err);
      updateState({
        status: 'error',
        errorMessage: err.message || 'Errore nella generazione AI',
      });
    });

  } catch (error: any) {
    console.error('\n❌ [ScriptBuilder] Errore generale:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Errore nella generazione AI' });
    }
  }
});

export default router;
