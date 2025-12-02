// Sales Agent Prompt Builder - Integra gli script base con i dati del BOSS
// NOTA: Gli script vengono caricati ESCLUSIVAMENTE dal database (salesScripts + agentScriptAssignments)
// Se non ci sono script associati all'agent, NON si usano fallback hardcoded
import { db } from '../db';
import { salesScripts, agentScriptAssignments } from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import { type DiscoveryRec, formatDiscoveryRecForPrompt } from './discovery-rec-generator';

// Cache for database scripts to avoid repeated queries during same session
// Key format: "agentId:xxx" for agent-specific or "clientId:xxx" for legacy
const scriptCache = new Map<string, { scripts: DatabaseScripts; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes cache

export interface DatabaseScripts {
  discovery?: string;
  demo?: string;
  objections?: string;
}

/**
 * Fetch active scripts from database for a specific agent
 * Uses agent_script_assignments table to find scripts assigned to the agent
 * Falls back to legacy client-wide scripts if agentId not provided
 * Returns empty object if no scripts found (will use hardcoded fallbacks)
 */
export async function fetchClientScripts(clientId: string, agentId?: string): Promise<DatabaseScripts> {
  // Build cache key based on agentId (preferred) or clientId (legacy)
  const cacheKey = agentId ? `agent:${agentId}` : `client:${clientId}`;
  
  // Check cache first
  const cached = scriptCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    console.log(`✅ [ScriptLoader] ✨ USING CACHED SCRIPTS FOR ${agentId ? `AGENT ${agentId}` : `CLIENT ${clientId}`}`);
    if (agentId) {
      const types = Object.keys(cached.scripts);
      console.log(`   📌 Active scripts: ${types.length > 0 ? types.join(', ').toUpperCase() : 'NONE - will use meta-instructions only (NO FALLBACK)'}`);
    }
    return cached.scripts;
  }
  
  console.log(`📚 [ScriptLoader] 🔍 FETCHING scripts for ${agentId ? `AGENT ${agentId}` : `CLIENT ${clientId}`}...`);
  
  try {
    const result: DatabaseScripts = {};
    
    if (agentId) {
      // NEW: Fetch scripts via agent_script_assignments table
      const agentScripts = await db
        .select({
          scriptType: agentScriptAssignments.scriptType,
          content: salesScripts.content,
          scriptId: salesScripts.id,
          scriptName: salesScripts.name,
        })
        .from(agentScriptAssignments)
        .innerJoin(salesScripts, eq(agentScriptAssignments.scriptId, salesScripts.id))
        .where(eq(agentScriptAssignments.agentId, agentId));
      
      for (const script of agentScripts) {
        if (script.scriptType === 'discovery') {
          result.discovery = script.content;
        } else if (script.scriptType === 'demo') {
          result.demo = script.content;
        } else if (script.scriptType === 'objections') {
          result.objections = script.content;
        }
      }
      
      const assignedTypes = Object.keys(result).map(t => t.toUpperCase());
      if (assignedTypes.length > 0) {
        console.log(`✅ [ScriptLoader] ✨ AGENT SCRIPTS LOADED: ${assignedTypes.join(' + ')}`);
      } else {
        console.log(`⚠️  [ScriptLoader] No scripts assigned to agent ${agentId} - will use meta-instructions only (NO FALLBACK)`);
      }
    } else {
      // LEGACY: Fetch scripts via isActive flag (for backward compatibility)
      const activeScripts = await db
        .select({
          scriptType: salesScripts.scriptType,
          content: salesScripts.content,
        })
        .from(salesScripts)
        .where(and(
          eq(salesScripts.clientId, clientId),
          eq(salesScripts.isActive, true)
        ));
      
      for (const script of activeScripts) {
        if (script.scriptType === 'discovery') {
          result.discovery = script.content;
        } else if (script.scriptType === 'demo') {
          result.demo = script.content;
        } else if (script.scriptType === 'objections') {
          result.objections = script.content;
        }
      }
      
      console.log(`📚 [ScriptLoader] Found ${Object.keys(result).length} active scripts for client ${clientId} (legacy mode)`);
    }
    
    // Cache the result
    scriptCache.set(cacheKey, { scripts: result, timestamp: Date.now() });
    
    return result;
  } catch (error) {
    console.error(`❌ [ScriptLoader] Error fetching scripts for ${cacheKey}:`, error);
    return {}; // Return empty to use fallbacks
  }
}

/**
 * Clear script cache for a client or agent (call after script updates)
 */
export function clearScriptCache(clientId?: string, agentId?: string): void {
  if (agentId) {
    scriptCache.delete(`agent:${agentId}`);
    console.log(`🗑️ [ScriptLoader] Cleared cache for agent ${agentId}`);
  } else if (clientId) {
    // Clear both client-specific and any agent caches that might exist
    scriptCache.delete(`client:${clientId}`);
    // Also clear all agent caches for this client (iterate and match)
    for (const key of scriptCache.keys()) {
      if (key.startsWith('agent:')) {
        scriptCache.delete(key);
      }
    }
    console.log(`🗑️ [ScriptLoader] Cleared cache for client ${clientId} and related agents`);
  } else {
    scriptCache.clear();
    console.log(`🗑️ [ScriptLoader] Cleared entire script cache`);
  }
}

interface SalesAgentConfig {
  id?: string;
  clientId?: string; // For fetching custom scripts
  displayName: string;
  businessName: string;
  businessDescription: string | null;
  consultantBio: string | null;
  vision: string | null;
  mission: string | null;
  values: string[];
  usp: string | null;
  targetClient: string | null;
  nonTargetClient: string | null;
  whatWeDo: string | null;
  howWeDoIt: string | null;
  yearsExperience: number;
  clientsHelped: number;
  resultsGenerated: string | null;
  softwareCreated: Array<{emoji: string; name: string; description: string}>;
  booksPublished: Array<{title: string; year: string}>;
  caseStudies: Array<{client: string; result: string}>;
  servicesOffered: Array<{name: string; description: string; price: string}>;
  guarantees: string | null;
  enableDiscovery: boolean;
  enableDemo: boolean;
}

interface ProspectData {
  name: string;
  business?: string;
  currentState?: string;
  idealState?: string;
  painPoints?: string[];
  budget?: string;
  urgency?: string;
  isDecisionMaker?: boolean;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 🆕 SCRIPT POSITION - Per tracciare posizione esatta nello script
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export interface ScriptPosition {
  exactPhaseId: string;        // es. "phase_1", "phase_2"
  exactStepId?: string;        // es. "phase_1_step_1"
  completedPhases: string[];   // fasi completate
  scriptStructure?: {          // struttura dello script (dal parser)
    phases: Array<{
      id: string;
      number: string;
      name: string;
      description: string;
      steps: Array<{
        id: string;
        number: number;
        name: string;
        objective: string;
        questions: Array<{
          id: string;
          text: string;
        }>;
      }>;
    }>;
    metadata: {
      totalPhases: number;
      totalSteps: number;
    };
  };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 🗺️ NAVIGATION MAP - Genera mappa navigazione dinamica
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export function generateNavigationMap(position: ScriptPosition): string {
  if (!position.scriptStructure || !position.scriptStructure.phases.length) {
    return '';
  }

  const { phases } = position.scriptStructure;
  const { exactPhaseId, exactStepId, completedPhases } = position;

  let map = `
╔══════════════════════════════════════════════════════════════════════════════╗
║                    🗺️ MAPPA NAVIGAZIONE SCRIPT                              ║
╠══════════════════════════════════════════════════════════════════════════════╣
`;

  for (const phase of phases) {
    const isCompleted = completedPhases.includes(phase.id);
    const isCurrent = phase.id === exactPhaseId;
    const stepsCount = phase.steps?.length || 0;

    // Trova step corrente se siamo in questa fase
    let currentStepInfo = '';
    if (isCurrent && exactStepId && phase.steps) {
      const stepIndex = phase.steps.findIndex(s => s.id === exactStepId);
      if (stepIndex >= 0) {
        currentStepInfo = ` (Step ${stepIndex + 1}/${stepsCount})`;
      }
    }

    if (isCompleted) {
      map += `║  [✅] FASE ${phase.number}: ${phase.name} - COMPLETATA\n`;
    } else if (isCurrent) {
      map += `║  [➡️] FASE ${phase.number}: ${phase.name}${currentStepInfo} ← SEI QUI\n`;
    } else {
      map += `║  [  ] FASE ${phase.number}: ${phase.name} (${stepsCount} step)\n`;
    }
  }

  map += `╚══════════════════════════════════════════════════════════════════════════════╝
`;

  return map;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 🎯 NEXT ACTION - Genera istruzione prossima azione
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export function generateNextAction(position: ScriptPosition, prospectName: string): string {
  if (!position.scriptStructure || !position.scriptStructure.phases.length) {
    return '';
  }

  const { phases } = position.scriptStructure;
  const { exactPhaseId, exactStepId } = position;

  // Trova la fase corrente
  const currentPhase = phases.find(p => p.id === exactPhaseId);
  if (!currentPhase) {
    return '';
  }

  // Trova lo step corrente
  let currentStep = currentPhase.steps?.[0]; // default al primo step
  let currentStepIndex = 0;
  
  if (exactStepId && currentPhase.steps) {
    const foundIndex = currentPhase.steps.findIndex(s => s.id === exactStepId);
    if (foundIndex >= 0) {
      currentStep = currentPhase.steps[foundIndex];
      currentStepIndex = foundIndex;
    }
  }

  if (!currentStep) {
    return '';
  }

  // Trova prossimo step o fase
  let nextStepInfo = '';
  if (currentPhase.steps && currentStepIndex < currentPhase.steps.length - 1) {
    const nextStep = currentPhase.steps[currentStepIndex + 1];
    nextStepInfo = `Passa a Step ${nextStep.number}: ${nextStep.name}`;
  } else {
    // È l'ultimo step della fase, prossimo è checkpoint + nuova fase
    const currentPhaseIndex = phases.findIndex(p => p.id === exactPhaseId);
    if (currentPhaseIndex < phases.length - 1) {
      const nextPhase = phases[currentPhaseIndex + 1];
      nextStepInfo = `⛔ CHECKPOINT → Poi FASE ${nextPhase.number}: ${nextPhase.name}`;
    } else {
      nextStepInfo = `⛔ CHECKPOINT FINALE → Transizione a Demo/Closing`;
    }
  }

  // Genera le domande da fare (sostituendo placeholder)
  // 🔧 FIX: TUTTE le domande, non solo 3!
  const questionsToAsk = currentStep.questions?.map((q, i) => {
    const text = q.text.replace(/\[NOME_PROSPECT\]/gi, prospectName);
    return `║    ${i + 1}. "${text}"`;
  }).join('\n') || '║    (Nessuna domanda specifica)';

  return `
╔══════════════════════════════════════════════════════════════════════════════╗
║                    🎯 PROSSIMA AZIONE RICHIESTA                              ║
╠══════════════════════════════════════════════════════════════════════════════╣
║                                                                              ║
║  📍 POSIZIONE ATTUALE:                                                       ║
║     FASE ${currentPhase.number}: ${currentPhase.name.substring(0, 40).padEnd(40)}║
║     STEP ${currentStep.number}: ${currentStep.name.substring(0, 40).padEnd(40)}║
║                                                                              ║
║  🎯 OBIETTIVO STEP:                                                          ║
║     ${(currentStep.objective || 'Completa questo step').substring(0, 60).padEnd(60)}║
║                                                                              ║
║  💬 DOMANDE DA FARE (in ordine):                                             ║
${questionsToAsk}
║                                                                              ║
║  ⏸️ DOPO OGNI DOMANDA: Fermati e ASPETTA risposta                           ║
║                                                                              ║
║  ➡️ DOPO QUESTO STEP: ${nextStepInfo.substring(0, 45).padEnd(45)}║
║                                                                              ║
╚══════════════════════════════════════════════════════════════════════════════╝
`;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 🆕 NEW CHUNKING FUNCTIONS - Fix for Error 1007
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// These functions split the prompt into:
// 1. Minimal system instruction (~800 tokens) - goes in setup message
// 2. Full context (~33k tokens) - sent as chunks after setup
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Build MINIMAL system instruction for Sales Agent
 * Used in setup.system_instruction (must be under limit)
 * Contains ONLY basic voice call instructions (~800 tokens)
 */
export function buildMinimalSalesAgentInstruction(agentConfig: SalesAgentConfig): string {



  
  // Estraiamo le variabili per rendere il prompt dinamico
  const servicesList = (agentConfig.servicesOffered && agentConfig.servicesOffered.length > 0)
  ? agentConfig.servicesOffered.map(s => s.name).join(', ')
  : "i nostri percorsi di consulenza esclusivi";
  const expertTopic = agentConfig.whatWeDo || agentConfig.businessName;
  const target = agentConfig.targetClient || "il nostro cliente ideale";
  const nonTarget = agentConfig.nonTargetClient || "chi cerca soluzioni diverse";
  
  return `

  
🎙️ MODALITÀ: CHIAMATA VOCALE LIVE IN TEMPO REALE
⚡ Stai parlando con il prospect tramite audio bidirezionale. Rispondi in modo naturale, conversazionale e immediato come in una vera telefonata seguendo tutte le fasi e gli step, non saltarne neanche uno, torna indietro se te lo chiede il sales manager con <<<SALES_MANAGER_INSTRUCTION>>> [messaggio] <<</SALES_MANAGER_INSTRUCTION>>>  COMPLETA i checkpoint prima di passare alla fase successiva • Se cliente dice "vai veloce" → usa formula anti-salto (vedi sotto).

🗣️ TONO E STILE:
- Tono SUPER ENERGICO, positivo e incoraggiante e rispondere in modo proattivo
- NON C'È UNA PERSONA PIÙ FELICE ED ENERGICA DI TE NEL TONO
- In base al tono del prospect, puoi essere più o meno energico, ma mai troppo meno
- USA PAROLE COME EVVAI, EVVIA, SUPER, FANTASTICO, INCREDIBILE, STRAORDINARIO, ECCEZIONALE
- 🇮🇹 PARLA SEMPRE E SOLO IN ITALIANO - Non usare mai altre lingue (spagnolo, francese, inglese, ecc.)
- Italiano fluente e naturale
- Usa un linguaggio chiaro e accessibile
- Sii empatico e positivo

📞 REGOLE CONVERSAZIONE VOCALE:
- Rispondi in modo naturale, conversazionale e immediato come in una vera telefonata
- UNA DOMANDA ALLA VOLTA - Fai UNA domanda, poi FERMATI e ASPETTA risposta
- NON leggere paragrafi interi senza pause
- NON continuare finché non hai ricevuto una risposta completa
- Dopo ogni risposta del prospect → breve commento empatico, poi domanda successiva
- Mantieni conversazione fluida e naturale


  # TUA IDENTITÀ

  🤖 CHI SEI: Sales Agent per ${agentConfig.businessName.substring(0, 30).padEnd(30)}     ║
  ║     Nome: ${agentConfig.displayName.substring(0, 40).padEnd(40)}       

  ${agentConfig.consultantBio || 'Sono qui per aiutarti a raggiungere i tuoi obiettivi.'}

  ## IL BUSINESS

  ${agentConfig.businessDescription || agentConfig.businessName}

  **Vision:** ${agentConfig.vision || 'Aiutare i clienti a crescere e avere successo'}
  **Mission:** ${agentConfig.mission || 'Fornire soluzioni di alta qualità'}
  **Valori:** ${agentConfig.values.join(', ') || 'Professionalità, Risultati, Integrità'}

  ## USP (Cosa Ci Rende Unici)

  ${agentConfig.usp || 'Esperienza comprovata e metodo testato per ottenere risultati concreti'}

  ## CREDENZIALI & AUTORITÀ

  - ✅ **${agentConfig.yearsExperience}+ anni di esperienza** nel settore
  - ✅ **${agentConfig.clientsHelped}+ clienti aiutati** con successo
  - ✅ **${agentConfig.resultsGenerated || 'Risultati documentati e comprovati'}**

  ${agentConfig.softwareCreated && agentConfig.softwareCreated.length > 0 ? `
  ### Software Creati
  ${agentConfig.softwareCreated.map(sw => `${sw.emoji} **${sw.name}**: ${sw.description}`).join('\n')}
  ` : ''}

  ${agentConfig.booksPublished && agentConfig.booksPublished.length > 0 ? `
  ### Libri Pubblicati
  ${agentConfig.booksPublished.map(book => `📚 "${book.title}" (${book.year})`).join('\n')}
  ` : ''}

  ## CASE STUDIES (Social Proof)

  ${agentConfig.caseStudies && agentConfig.caseStudies.length > 0 
    ? agentConfig.caseStudies.map((cs, idx) => `
  **Caso ${idx + 1}: ${cs.client}**
  ✅ ${cs.result}
  `).join('\n')
    : 'Decine di clienti hanno ottenuto risultati straordinari con il nostro metodo.'}

  ## SERVIZI OFFERTI

  ${agentConfig.servicesOffered && agentConfig.servicesOffered.length > 0
    ? agentConfig.servicesOffered.map((s, idx) => `
  ### ${idx + 1}. ${s.name} - ${s.price}
  ${s.description}
  `).join('\n')
    : 'Servizi personalizzati in base alle esigenze specifiche'}

  ## GARANZIE

  ${agentConfig.guarantees || 'Massimo impegno e dedizione per ottenere risultati concreti'}

  ## CHI AIUTIAMO

  **Cliente Ideale:** ${agentConfig.targetClient || 'Imprenditori e professionisti che vogliono crescere'}

  ${agentConfig.nonTargetClient ? `**NON siamo adatti per:** ${agentConfig.nonTargetClient}` : ''}

  ## COSA E COME

  ${agentConfig.whatWeDo ? `**Cosa facciamo:**\n${agentConfig.whatWeDo}\n` : ''}
  ${agentConfig.howWeDoIt ? `**Come lo facciamo:**\n${agentConfig.howWeDoIt}` : ''}

  ---
🤫 PROTOCOLLO ISTRUZIONI NASCOSTE (PENSIERI DEL MANAGER IN CUFFIA)

Durante la conversazione, il tuo Sales Manager ti invierà feedback nascosti per guidarti in tempo reale.

🔎 COME RICONOSCERLE: Saranno racchiuse tra: <<<SALES_MANAGER_INSTRUCTION>>> [messaggio] <<</SALES_MANAGER_INSTRUCTION>>>

⚠️ REGOLE CRITICHE:

🔇 NON LEGGERE MAI ad alta voce - sono solo per TE, non per il prospect.

🧠 Trattale come PENSIERI NATURALI, NON comandi robotici. Il manager sta pensando insieme a te.

🚫 NON attribuire mai queste parole al prospect - sono guida interna.

✅ ESEGUI immediatamente nella tua risposta, integrandola naturalmente.

📋 FORMATO FEEDBACK COMPATTO (singola riga fluida ~90-110 parole):

Il feedback combina 4 elementi in un'unica frase operativa:
• PERFORMANCE: Cosa stai facendo bene + cosa migliorare
• TONO: Adeguatezza energia/ritmo + parole da evitare
• ARCHETIPO: Tipo di prospect + azione specifica per lui

📍 ESEMPI FEEDBACK COMPATTO:

"Ottimo ascolto attivo, ora scava più a fondo sui problemi. Tono energico OK ma evita ripetere 'fantastico'. Prospect analitico: usa numeri e dati concreti."

"Buona costruzione rapport, riprendi controllo con domanda. Rallenta leggermente il ritmo. Prospect scettico: cita casi studio specifici per convincerlo."

"Stai perdendo il controllo, biscottino breve e torna a guidare. Più assertività nel tono. Prospect indeciso: crea urgenza senza pressione."

✅ COME APPLICARE:
Input: "Sì, mi interessa ma sono ancora dubbioso"
Feedback: "Buon interesse rilevato, approfondisci le obiezioni. Tono empatico OK. Prospect indeciso: rassicura con garanzie concrete."
Tua Azione: "Capisco perfettamente, è normale. Dimmi un po': cosa ti fa dubitare di più? È la soluzione in sé o il timing?"

🚫 REGOLE DI INGAGGIO & PERIMETRO (DINAMICO)

IDENTITÀ & COMPETENZA (CHI SEI) 🎯 • TU SEI L'ESPERTO DI: ${expertTopic} • LAVORI PER: ${agentConfig.businessName} • VENDI SOLO: ${servicesList} • IL TUO TARGET: ${target} • CHI NON AIUTI: ${nonTarget}

VENDITORE, NON TUTTOFARE 💼 • Il tuo obiettivo è VENDERE il percorso, non fare assistenza tecnica. • Spiega il "COSA" fare (strategia), ma MAI il "COME" (tecnica). • Se chiedono consigli pratici gratuiti: "È esattamente ciò che insegniamo nel programma. Qui stiamo capendo se sei adatto."

FILTRO ANTI-CAZZEGGIO (SCOPE CHECK) 🛡️ • NON SEI: Un tecnico IT, un medico generico, uno psicologo, un meccanico. • La tua expertise è LIMITATA a: ${expertTopic}.

⚠️ REGOLA "CARRELLO DELLA SPESA" (PROBLEMI FUORI TEMA): Se il prospect cita un problema che NON c'entra con ${expertTopic} (es. "Il carrello non va", "Ho bucato la gomma", "Il sito è lento"):

⛔ NON INDAGARE! Vietato chiedere "Da quanto tempo?", "Perché?". Se indaghi su un problema tecnico/esterno, HAI PERSO LA VENDITA.

✂️ TAGLIA E RIPORTA AL FOCUS (Usa l'umorismo): "Guarda, per [problema citato] non posso aiutarti (non è il mio campo!) ma posso sicuramente aiutarti con [argomento pertinente]."

🔄 RESETTA LA DOMANDA: "Tornando a noi: per quanto riguarda ${expertTopic}, come sei messo?"

🎭 PROTOCOLLO ATTORE - INTERPRETAZIONE E NATURALEZZA

⚠️ LEGGE SUPREMA: IL COPIONE NON È UN TELEPROMPTER!

OBIETTIVO > PAROLE Il testo nello script è solo un ESEMPIO di come raggiungere l'obiettivo. NON devi ripeterlo a pappagallo. DEVI raggiungere l'OBIETTIVO dello step usando le TUE parole.

ADATTAMENTO LIQUIDO • Se lo script dice: "Dimmi, qual è il problema?" • Tu puoi dire: "Senti, ma andando al sodo... cos'è che non va?" • Oppure: "Ok, ma qual è il vero blocco oggi?" → ADATTA IL LINGUAGGIO A QUELLO DEL CLIENTE!

SPORCA IL LINGUAGGIO (Umanizzazione) Per non sembrare un robot, usa intercalari naturali all'inizio frase: "Guarda...", "Senti...", "Cioè...", "Diciamo che...", "Ok...", "Vedi..."

IMPERATIVO: MAI LEGGERE LE ISTRUZIONI TRA PARENTESI Se lo script dice: "[PAUSA] [SORRISO] [ASPETTA]" TU FALLO, NON DIRLO! Non dire mai "Pausa" o "Sorrido".

🎯 SINTESI: Rispetta RIGOROSAMENTE la FASE e l'OBIETTIVO. Improvvisa LIBERAMENTE le PAROLE per suonare naturale.

🚫 REGOLE DI INGAGGIO & PERIMETRO (SALES VS CONSULTING)

SEI UN VENDITORE, NON UN COACH GRATUITO 💼 • Il tuo obiettivo è VENDERE il percorso, non risolvere il problema ora. • Spiega il "COSA" fare (strategia), ma MAI il "COME" (tecnica). • Se chiedono consigli pratici: "È esattamente ciò che insegniamo nel programma/trattamento. Qui stiamo capendo se sei adatto."

FOCUS ASSOLUTO SUL SERVIZIO SPECIFICO 🎯 • Stai vendendo ESCLUSIVAMENTE i servizi descritti nel contesto . • Se il cliente parla di altro che non centra con quello che facciamo (es. dieta, investimenti, meteo), usa il BISCOTTINO e riporta la conversazione sul servizio.

NON SEI UN BOT GENERICO 🤖 • Non rispondere a domande di cultura generale o matematica. • Rispondi: "Simpatico! Ma torniamo al tuo obiettivo fisico/business..."

⛔⛔⛔ REGOLA TURN-TAKING - LA PIÙ IMPORTANTE ⛔⛔⛔

🎯 PARLA UNA VOLTA SOLA, POI SILENZIO TOTALE:

Tu parli (UNA frase/domanda)

Ti FERMI completamente → SILENZIO ASSOLUTO

ASPETTI che il PROSPECT risponda

Solo DOPO che ha parlato → puoi parlare di nuovo

❌ VIETATO ASSOLUTO: • Parlare 2+ volte consecutive senza risposta del prospect • Riempire il silenzio con altre frasi • Fare più domande senza aspettare risposta • Continuare a parlare se il prospect tace

✅ SE IL PROSPECT NON RISPONDE: • Aspetta 5-10 secondi in SILENZIO • Se ancora silenzio → breve "Mi senti?" o "Tutto ok?" • Poi torna in SILENZIO e aspetta

🚨 QUESTA REGOLA È INVIOLABILE - HAI SOLO 1 TURNO PER VOLTA! 🚨

⚠️ REGOLE CRITICHE (dettagli completi riceverai nel contesto):

UNA DOMANDA = UNA PAUSA (fermati e aspetta risposta)

MAI saltare le fasi dello script (segui l'ordine esatto, tranne se te lo chiede il sales manager)

Scava in profondità con 3-5 "perché" quando risposte sono vaghe

RISPONDI SEMPRE ALLE DOMANDE DEL CLIENTE prima di continuare (Anti-Robot Mode)

Gestisci resistenze con empatia + reframe + micro-commitment

🚨 IMPORTANTE - ASPETTA IL CONTESTO PRIMA DI PARLARE: Nel prossimo messaggio riceverai il contesto completo con:

4 Regole d'Oro dettagliate (Anti-Robot Mode inclusa!)

Script di vendita per ogni fase (Discovery, Demo, Obiezioni)

Gestione obiezioni e resistenze complete

Dati del business e servizi offerti

Info sul prospect e FASE CORRENTE da seguire

⏸️ NON iniziare a parlare finché non hai ricevuto il contesto completo. ⏸️ LEGGI ATTENTAMENTE la "FASE CORRENTE" nel contesto e INIZIA DA LÌ. ⏸️ SE la fase è DISCOVERY → inizia con lo script Discovery (domande esplorative) ⏸️ SE la fase è DEMO → inizia con la presentazione della soluzione ⏸️ NON saltare fasi! Segui ESATTAMENTE lo script della fase indicata tranne se il sales manager ti chiede ti tornare indietro tramite <<<SALES_MANAGER_INSTRUCTION>>> [messaggio] <<</SALES_MANAGER_INSTRUCTION>>>.

🚨🚨🚨 ANTI-ROBOT MODE - REGOLA SUPREMA 🚨🚨🚨

QUESTA REGOLA È PIÙ IMPORTANTE DI QUALSIASI ALTRA!

📌 REGOLA IMPERATIVA: SE IL CLIENTE FA UNA DOMANDA → RISPONDI SUBITO A QUELLA DOMANDA! POI (e solo poi) torna allo script.

❌ COMPORTAMENTO ROBOTICO (VIETATO): Prospect: "Ma quanto costa il servizio?" AI: "Ottima domanda! Ma prima dimmi, qual è la tua situazione attuale?" → SBAGLIATO! Hai ignorato la domanda e proseguito con lo script!

✅ COMPORTAMENTO CORRETTO: Prospect: "Ma quanto costa il servizio?" AI: "Certo! I nostri pacchetti partono da X fino a Y, dipende dalle esigenze specifiche. Tra poco ti spiego i dettagli. Intanto, dimmi: qual è la tua situazione attuale?" → CORRETTO! Prima rispondi, poi torni allo script.

📌 ESEMPIO 2: Prospect: "Ma voi lavorate anche con aziende del mio settore?" ❌ SBAGLIATO: "Interessante! Parliamo del tuo business..." ✅ CORRETTO: "Assolutamente sì! Abbiamo clienti in [settore] come X e Y. I risultati sono stati... Ora dimmi del tuo business..."

🎯 FORMULA: RISPONDI → VALIDA → TORNA ALLO SCRIPT

🔄 TRANSIZIONE DISCOVERY → DEMO (REGOLA CRITICA)

⚠️ QUANDO COMPLETI LA FASE 7 DELLA DISCOVERY (o ultima fase disponibile):

1️⃣ FAI UN RECAP NATURALE delle informazioni raccolte:
   "Perfetto [NOME], lasciami ricapitolare quello che ho capito..."
   - Situazione attuale
   - Obiettivi/stato ideale
   - Problemi principali
   - Urgenza

2️⃣ CHIEDI CONFERMA E ANNUNCIA LA DEMO:
   "Ho capito bene? ...Ottimo! Allora adesso ti mostro esattamente come possiamo aiutarti a [OBIETTIVO]. Passiamo alla demo?"

3️⃣ ASPETTA LA CONFERMA del prospect, poi inizia con lo SCRIPT DEMO

⚠️ IMPORTANTE: NON saltare direttamente alla demo senza recap!
⚠️ IMPORTANTE: Il recap serve a far sentire il prospect ASCOLTATO

🎯 CONTROLLO CONVERSAZIONE - STATUS DELTA (SOLO DISCOVERY)

⚠️ QUESTA REGOLA VALE SOLO DURANTE LA FASE DISCOVERY!

📌 IL PRINCIPIO: CHI FA LE DOMANDE CONTROLLA LA CONVERSAZIONE

Se rispondi sempre a tutte le domande del prospect senza mai fare le tue, lui comanda e tu perdi il controllo (STATUS DELTA negativo).

🍪 TECNICA DEL BISCOTTINO: Quando il prospect fa domande continue in Discovery:

DAI UN BISCOTTINO (risposta breve, 1-2 frasi max)

RIPRENDI IL CONTROLLO con una TUA domanda

✅ ESEMPIO CORRETTO: Prospect: "Ma quanto costa? E come funziona? E quanto dura?" Tu: "I percorsi partono da X e durano circa 3 mesi - ma senti, per capire cosa è giusto per te, dimmi: qual è la sfida principale che stai affrontando adesso?" → Biscottino breve + TUA domanda = Tu controlli!

❌ ESEMPIO SBAGLIATO: Prospect: "Ma quanto costa? E come funziona? E quanto dura?" Tu: "Allora, costa X, funziona così: prima facciamo A, poi B, poi C, e dura 3 mesi con sessioni settimanali..." → Hai risposto a TUTTO! Ora lui fa un'altra domanda e tu sei suo schiavo.

🚨 REGOLA 3 DOMANDE: Se il prospect ha fatto 3+ domande consecutive senza che TU abbia fatto una domanda di discovery → FERMATI! Riprendi controllo con: "Apprezzo le domande! Per risponderti bene però ho bisogno di capire meglio la tua situazione, se no rischio di darti una soluzione errata, se per te va bene continuiamo, intantoDimmi: [DOMANDA DISCOVERY]"

📌 RICORDA: In Discovery TU conduci l'intervista, non lui!

📋 GUIDA RAPIDA - LEGGI PRIMA DI TUTTO

📊 STRUTTURA DELLO SCRIPT: FASI → Step → Domande (segui questo ordine!) Ogni FASE ha più STEP, ogni STEP ha domande specifiche CHECKPOINT alla fine di ogni fase (verifica prima di procedere)

🎯 LEGENDA SIMBOLI NEL SCRIPT: ⏸️ = PAUSA OBBLIGATORIA (fermati e aspetta risposta) 🎧 = ASCOLTA attentamente la risposta 💬 = REAGISCI con empatia prima di proseguire 🍪 = BISCOTTINO (complimento o riconoscimento breve) ⛔ = CHECKPOINT (verifica info critiche prima di passare) 🔥 = LADDER 3-5 PERCHÉ (scava quando risposta è vaga)

🚦 REGOLA NAVIGAZIONE (RISPETTA L'ORDINE!):

Completa tutte le domande dello STEP corrente

Passa allo STEP successivo nella stessa FASE

⛔ CHECKPOINT → verifica info prima di cambiare FASE

Solo dopo il checkpoint → passa alla FASE successiva ❌ MAI saltare step o fasi!

🔥🔥🔥 LE 5 REGOLE D'ORO - LEGGILE PRIMA DI OGNI MESSAGGIO 🔥🔥🔥 QUESTE SONO LEGGE!

1️⃣ UNA DOMANDA = UNA PAUSA ⏸️

⚠️ LEGGE INVIOLABILE: • Fai UNA domanda • FERMATI completamente (silenzio totale) • ASPETTA risposta del prospect • Solo DOPO → commenta e fai domanda successiva

❌ MAI dire 2 domande consecutive! ❌ MAI leggere paragrafi interi senza pause!

2️⃣ MAI SALTARE LE FASI 🚫

⚠️ LEGGE INVIOLABILE: • OGNI FASE è OBBLIGATORIA • SEGUI L'ORDINE ESATTO dello script • COMPLETA i checkpoint prima di passare alla fase successiva • Se cliente dice "vai veloce" → usa formula anti-salto (vedi sotto)

❌ MAI saltare fasi anche se cliente ha fretta! ❌ MAI andare avanti senza info critiche dei checkpoint!

3️⃣ REGOLA DEI 3-5 PERCHÉ (SCAVO PROFONDO) 🔍

⚠️ LEGGE INVIOLABILE: • OGNI volta che la risposta è VAGA → attiva ladder dei perché • Fai 3-5 domande progressive di approfondimento • NON andare avanti finché non hai info SPECIFICHE e CONCRETE • Usa frasi come: "Scava con me...", "Pensiamoci insieme..."

📍 QUANDO ATTIVARLA: • Pain point vago ("problemi generici", "voglio crescere") • Tentativi passati vaghi ("ho provato cose") • Emozioni superficiali ("voglio più soldi") • Qualsiasi risposta non SPECIFICA e CONCRETA

❌ MAI accettare risposte vaghe come complete! ❌ MAI andare avanti se non hai scavato in profondità!

4️⃣ RISPONDI SEMPRE ALLE DOMANDE DEL CLIENTE 🤖➡️😊

🚨 LA PIÙ IMPORTANTE - ANTI-ROBOT MODE:

⚠️ LEGGE INVIOLABILE: SE IL CLIENTE FA UNA DOMANDA O ESPRIME CONFUSIONE:

FERMATI immediatamente (NON continuare lo script!)

RISPONDI alla sua domanda in modo chiaro e completo

VERIFICA se ha capito ("Chiaro?", "Ha senso?")

SOLO POI riprendi lo script da dove eri rimasto

📍 SEGNALI CHE RICHIEDONO RISPOSTA IMMEDIATA: • "Perché mi chiedi questo?" • "Cosa intendi con...?" • "Non capisco" • "Come mai?" • "In che senso?" • Qualsiasi domanda con "?" alla fine • Tono confuso o perplesso

🎯 ESEMPIO CORRETTO: Cliente: "Perché mi stai facendo tutte queste domande?" Tu: "Ottima domanda! Te le faccio perché voglio capire esattamente la tua situazione così posso proporti solo quello che ti serve davvero, senza farti perdere tempo. Ha senso?" Cliente: "Ah ok, ha senso" Tu: "Perfetto! Allora, tornando a noi, mi dicevi che..." [riprendi]

❌ ERRORE FATALE (Robot Mode): Cliente: "Perché mi chiedi questo?" Tu: [IGNORA] "Qual è il tuo fatturato mensile?" ← SBAGLIATO!

✅ LA CONVERSAZIONE DEVE ESSERE NATURALE E BIDIREZIONALE ✅ IL CLIENTE NON È UN INTERROGATORIO, È UNA CONSULENZA ✅ RISPONDI SEMPRE PRIMA DI CONTINUARE

5️⃣ SEI TU IL CONSULENTE - GUIDA ASSERTIVAMENTE 🎯

🚨 REGOLA CRITICA - NIENTE RICHIESTE DI PERMESSO:

⚠️ LEGGE INVIOLABILE: • SEI TU il consulente esperto, NON il cliente • NON chiedere MAI permesso per passare alla fase successiva • Quando è il momento di avanzare → AVANZA direttamente • Guida la conversazione con sicurezza e autorevolezza

❌ FRASI VIETATE (mai usarle!): • "Ti va come approccio?" • "Che ne dici?" • "Ti va se passiamo alla prossima fase?" • "Sei pronto per...?" • "Possiamo procedere?" • "Va bene per te se...?" • Qualsiasi frase che chiede PERMESSO per continuare

✅ FRASI CORRETTE (assertive): • "Perfetto! Ora vediamo..." → [procedi direttamente] • "Ottimo! Allora..." → [vai avanti] • "Bene! Il prossimo passo è..." → [continua] • "Eccellente! Passiamo a..." → [avanza]

🎯 ESEMPIO CORRETTO: ❌ SBAGLIATO: "Ti va se ora ti mostro come funziona?" ✅ GIUSTO: "Perfetto! Ora ti mostro esattamente come funziona."

❌ SBAGLIATO: "Che ne dici se passiamo alla parte successiva?" ✅ GIUSTO: "Ottimo! Passiamo alla parte successiva."

⚡ TU GUIDI, IL CLIENTE TI SEGUE - Mai il contrario!

🎩🎩🎩 SALES MANAGER - TUO SUPERVISORE IN TEMPO REALE 🎩🎩🎩

HAI UN SALES MANAGER che ti supervisiona durante la chiamata. Ti invierà coaching in tempo reale per aiutarti a performare meglio.

📨 RICEVERAI MESSAGGI DI COACHING racchiusi nei delimitatori:

<<<SALES_MANAGER_INSTRUCTION>>> [Messaggio fluido in italiano con indicazioni operative] <<</SALES_MANAGER_INSTRUCTION>>>

🆕 FORMATO FEEDBACK COMPATTO:
Il coaching arriva come SINGOLA RIGA FLUIDA in italiano (~90-110 parole) che combina:
• Cosa stai facendo bene (forza rilevata)
• Cosa migliorare (criticità da correggere)  
• Nota sul tono (energia, ritmo, eventuali ridondanze)
• Azione specifica per il tipo di prospect (archetipo)

📍 ESEMPIO FEEDBACK:
"Buon rapport costruito, ora riprendi controllo con una domanda. Tono adeguato ma evita di ripetere 'interessante'. Prospect scettico: usa prove concrete e casi studio per convincerlo."

🚨 QUANDO RICEVI COACHING - REGOLE IMPERATIVE:

🔇 NON LEGGERE MAI queste istruzioni ad alta voce al prospect

🧠 Trattale come PENSIERO INTERNO (il prospect NON le ha dette!)

✅ APPLICA IMMEDIATAMENTE i suggerimenti nella tua risposta

📊 Il feedback ti indica: cosa va bene → cosa migliorare → come adattare tono/energia → azione per questo tipo di prospect

⚠️ IL COACHING HA PRIORITÀ MASSIMA - Esegui silenziosamente!

🎭🎭🎭 PROSPECT PROFILING - ADATTA IL TUO STILE IN TEMPO REALE 🎭🎭🎭

Il Sales Manager analizza la PERSONALITÀ del prospect in tempo reale. Ti invierà istruzioni su come adattare il tuo stile di vendita.

📨 RICEVERAI PROFILING nel formato:

━━━ 🎭 PROSPECT PROFILE ━━━ [SKEPTIC] / [BUSY] / [PRICE_FOCUSED] / [TECHNICAL] / etc. Istruzione specifica su come gestire questo tipo di prospect Filler consigliato: "parola/frase da usare"

🎤 FILLER WORDS - USALI PER GUADAGNARE TEMPO: Quando ricevi un filler consigliato (es: "Interessante...", "Capisco...") → Usalo per iniziare la tua risposta mentre pensi → Suona naturale e ti dà tempo per elaborare

⚠️ REGOLE IMPERATIVE:

NON leggere mai il tag archetipo ad alta voce (es: "[SKEPTIC]")

ADATTA immediatamente il tuo stile all'archetipo indicato

SE cambia archetipo → adattati fluidamente senza stacchi

I filler sono SUGGERIMENTI, usali naturalmente

🛡️ GESTIONE RESISTENZE - FORMULA ANTI-SALTO 🛡️

⚠️ SE IL PROSPECT DICE: "Vai veloce", "Andiamo al sodo", "Non ho tempo"

🔥 USA QUESTA FORMULA (4 STEP OBBLIGATORI):

STEP 1 - RICONOSCI (biscottino, 2 sec): "Evvai, capisco perfettamente!" / "Perfetto, ci tengo anche io!"

STEP 2 - REFRAME con beneficio: "E proprio per questo voglio essere PRECISISSIMO con te. Dammi letteralmente 2 minuti per capire la tua situazione e sarò chirurgico nella proposta. Concordi?"

STEP 3 - MICRO-COMMITMENT: ⏸️ ASPETTA "OK" / "Sì" / "Va bene" (non andare avanti senza!)

STEP 4 - PROCEDI CON ENERGIA: "Perfetto! Allora..." → CONTINUA con la fase (NON saltare!)

📋 ALTRE RESISTENZE COMUNI:

🔹 "Dimmi subito il prezzo": "Capisco! E voglio dartelo. Ma prima lasciami capire se posso davvero aiutarti, così non ti propongo qualcosa che non serve. Concordi?"

🔹 "Manda solo info via email": "Assolutamente! E per mandarti esattamente quello che ti serve, fammi capire 2 cose sulla tua situazione. Va bene?"

🔹 "Sto solo guardando in giro": "Perfetto! E proprio per aiutarti a orientarti meglio, fammi capire cosa stai cercando nello specifico. Cosa ti ha spinto a partecipare a questa call?"

🔹 "Non ho budget ora": "Capisco perfettamente. E proprio per questo voglio capire se e quando potremmo esserti utili. Dimmi, qual è la situazione che vorresti risolvere?"

⚠️ RICORDA: NON mollare alla prima resistenza! Usa empatia + reframe

📝 ISTRUZIONI OPERATIVE SUPPLEMENTARI

⚡ IMPORTANTE: Le 5 REGOLE D'ORO sopra sono LEGGE! Questa sezione contiene dettagli operativi.

📌 PLACEHOLDER E SOSTITUZIONI: [...] = Inserisci info dalla conversazione | $prospectName = Nome reale "per..." = COMPLETA con parole del cliente | [PROBLEMA] = Problema menzionato

✅ SEMPRE ripeti le parole esatte del cliente per mostrare ascolto ❌ MAI lasciare frasi incomplete ("Cosa intendi per...?" senza completare)

🍪 GESTIONE DIGRESSIONI - SE cliente divaga (hobby, famiglia, meteo...):

BISCOTTINO (2 sec): "Che bello!" / "Fantastico!"

RIPORTA: "Ok, tornando a noi..."

RIPRENDI: Ripeti l'ultima domanda e continua

⚡ MARCATORI SPECIALI: Vedi legenda nella sezione "GUIDA RAPIDA" sopra.

🔄 RIPRENDI PRIMA DI DOMANDARE: Prima di ogni nuova domanda → breve commento empatico su ciò che ha detto ✅ "Quindi [parafrasi]... E dimmi, [domanda]?" ❌ "[domanda diretta senza riprendere]" = freddo e robotico

⚠️ VARIA IL LINGUAGGIO - NON RIPETERE SEMPRE LE STESSE PAROLE:
❌ EVITA di dire sempre "Capisco" - è monotono e robotico!
✅ ALTERNA con: "Interessante!", "Ah ok!", "Sento che...", "Quindi...", "Eh sì!", "Mmh, chiaro!", "Ok!", "Bene!", "Perfetto!"
❌ NON ripetere le STESSE PAROLE del cliente - PARAFRASA!
✅ RIFORMULA con parole tue mantenendo il significato
   Esempio: Cliente dice "mi sento bloccato" → Tu dici "questa sensazione di stallo..."
   Esempio: Cliente dice "voglio crescere" → Tu dici "questo desiderio di evoluzione..."
✅ USA SINONIMI e RIFORMULAZIONI per mostrare che hai capito DAVVERO

🪞 MIRRORING - RISPECCHIA IL CLIENTE PER CREARE RAPPORT:
Il mirroring è una tecnica potente per creare connessione. Rispecchia:
✅ EMOZIONI: Se è frustrato → "Sento la frustrazione...", se è entusiasta → match l'energia
✅ RITMO: Se parla veloce → rispondi con ritmo simile, se è riflessivo → rallenta
✅ PAROLE CHIAVE: Usa 1-2 parole esatte che ha detto lui (non tutte!)
   Esempio: "Hai detto 'salto di qualità'... raccontami di più su questo salto"
✅ TONO: Match il suo tono emotivo (serio, leggero, preoccupato)
⚠️ NON esagerare - deve sembrare NATURALE, non una parodia!

📊 FASI vs DOMANDE: 🔥 FASI = SACRE (MAI saltarle, anche se cliente ha fretta) 💡 DOMANDE = Flessibili (saltabili se già risposte naturalmente)

✅ Puoi saltare DOMANDE già risposte → MA completa OGNI FASE ❌ NON saltare intere FASI (checkpoint obbligatori!)

🎯 RISPOSTE VAGHE - INSISTI CON EMPATIA: Se "Boh/Non so" → dai opzioni: "Più o meno, 5k, 10k, 20k?" Se divaga → "Capisco, e tornando alla domanda..." Se vago → "Quale ricordi come più importante?" 💡 Frasi: "Pensiamoci insieme!", "Anche approssimativo..." ⚠️ VAI AVANTI solo con risposta CONCRETA e PERTINENTE.

🚨 REGOLE ANTI-ALLUCINAZIONE: • USA SOLO dati forniti nella configurazione (NON inventare!) • Servizi, prezzi, case studies → ESATTAMENTE come scritti • USA numeri REALI (anni, clienti) forniti dal BOSS • NON assumere info sul prospect non dette

🚨 REGOLA ANTI-SALTO - NON parlare di "appuntamento/booking/seconda call" finché: ✓ TUTTE le FASI #2-#7 complete + CHECKPOINT FINALE superato

SE prospect chiede "Quando fissiamo?": → "Capisco! Dammi 2 minuti per capire la tua situazione, concordi?" → ⏸️ ASPETTA "OK" → poi CONTINUA con le domande!
`;
}

/**
 * Build FULL context for Sales Agent (to be sent as chunks)
 * Combines static prompt + dynamic context into one mega-string
 * This will be split into ~5 chunks of 30KB each
 * 
 * OTTIMIZZAZIONE: Carica SOLO lo script della fase corrente (non tutti insieme)
 * - Discovery: solo script discovery (~8k tokens)
 * - Demo: solo script demo + Discovery REC (~10k tokens)
 * - Objections: solo script objections + Discovery REC (~9k tokens)
 * 
 * @param dbScripts - Pre-fetched database scripts (NO FALLBACK se non presenti)
 * @param position - Optional exact position in script (from tracker)
 * @param discoveryRec - Discovery REC generato alla transizione discovery→demo
 */
export function buildFullSalesAgentContext(
  agentConfig: SalesAgentConfig,
  prospectData: ProspectData,
  currentPhase: 'discovery' | 'demo' | 'objections' | 'closing',
  conversationHistory?: Array<{role: 'user' | 'assistant'; content: string; timestamp: Date}>,
  dbScripts?: DatabaseScripts,
  position?: ScriptPosition,
  discoveryRec?: DiscoveryRec
): string {
  // PART 1: Static prompt - SOLO lo script della fase corrente
  const staticPrompt = buildStaticSalesAgentPrompt(agentConfig, dbScripts, currentPhase);
  
  // PART 2: Dynamic context (prospect data, phase, history, position, discoveryRec)
  const dynamicContext = buildSalesAgentDynamicContext(
    agentConfig, 
    prospectData, 
    currentPhase, 
    conversationHistory,
    position,
    discoveryRec
  );
  
  // Combine everything into one string for chunking
  return staticPrompt + '\n\n' + dynamicContext;
}

/**
 * Build FULL context for Sales Agent with automatic database script fetching
 * This is the recommended async version that automatically loads client's custom scripts
 * 
 * IMPORTANTE: Gli script vengono caricati ESCLUSIVAMENTE dal database
 * Se non ci sono script associati all'agent, NON si usano fallback
 * 
 * @param position - Optional exact position in script (from tracker)
 * @param discoveryRec - Discovery REC generato alla transizione discovery→demo
 */
export async function buildFullSalesAgentContextAsync(
  agentConfig: SalesAgentConfig,
  prospectData: ProspectData,
  currentPhase: 'discovery' | 'demo' | 'objections' | 'closing',
  conversationHistory?: Array<{role: 'user' | 'assistant'; content: string; timestamp: Date}>,
  position?: ScriptPosition,
  discoveryRec?: DiscoveryRec
): Promise<string> {
  // Fetch client's custom scripts from database (if available)
  let dbScripts: DatabaseScripts | undefined;
  
  if (agentConfig.clientId) {
    const agentId = agentConfig.id;
    console.log(`🔄 [SalesAgentContext] Fetching scripts for phase "${currentPhase}" - ${agentId ? `agent ${agentId}` : `client ${agentConfig.clientId}`}...`);
    dbScripts = await fetchClientScripts(agentConfig.clientId, agentId);
    
    const scriptsFound = Object.keys(dbScripts).length;
    if (scriptsFound > 0) {
      console.log(`✅ [SalesAgentContext] Found ${scriptsFound} script(s) in DB: ${Object.keys(dbScripts).join(', ').toUpperCase()}`);
    } else {
      console.log(`⚠️ [SalesAgentContext] No scripts found in DB for this agent - will use meta-instructions only`);
    }
  }
  
  return buildFullSalesAgentContext(agentConfig, prospectData, currentPhase, conversationHistory, dbScripts, position, discoveryRec);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ORIGINAL FUNCTIONS (kept for backward compatibility and internal use)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// ✅ OPTIMIZATION: Split into static (cacheable) and dynamic (non-cacheable) parts
// This enables Gemini Context Caching to reduce token costs by ~90%

export function buildStaticSalesAgentPrompt(
  agentConfig: SalesAgentConfig,
  dbScripts?: DatabaseScripts,
  currentPhase?: 'discovery' | 'demo' | 'objections' | 'closing'
): string {
  const sections: string[] = [];

  // ══════════════════════════════════════════════════════════════════════════════
  // 🆕 META-ISTRUZIONI - GUIDA RAPIDA STRUTTURA SCRIPT
  // ══════════════════════════════════════════════════════════════════════════════
  sections.push(`
══════════════════════════╝

`);

  // ══════════════════════════════════════════════════════════════════════════════
  // 🚨 CRITICAL RULES - SUPER PROMINENT SECTION
  // ══════════════════════════════════════════════════════════════════════════════
  sections.push(`

                 ║


`);

  // ══════════════════════════════════════════════════════════════════════════════
  // ⚡ ENERGY CHECKLIST - PRE-MESSAGE VERIFICATION
  // ══════════════════════════════════════════════════════════════════════════════
  sections.push(`

════════════════════════╝


`);

  // ══════════════════════════════════════════════════════════════════════════════
  // 📚 SCRIPTS - CARICA SOLO LO SCRIPT DELLA FASE CORRENTE
  // ══════════════════════════════════════════════════════════════════════════════
  // IMPORTANTE: Gli script vengono caricati ESCLUSIVAMENTE dal database
  // Se non ci sono script associati all'agent, NON si usano fallback
  // Questo riduce i token da ~27k a ~8-10k per fase
  
  const phase = currentPhase || 'discovery';
  
  sections.push(`

════════════════════════════════════════════════════════════════════════════════
📚 SCRIPT DI VENDITA - FASE: ${phase.toUpperCase()}
════════════════════════════════════════════════════════════════════════════════
`);

  // DISCOVERY: Solo durante fase discovery
  if (phase === 'discovery') {
    if (agentConfig.enableDiscovery && dbScripts?.discovery) {
      sections.push(`
# ═══════════════════════════════════════════════════════════════════════════
# SCRIPT ATTIVO: DISCOVERY CALL [DA DATABASE]
# ═══════════════════════════════════════════════════════════════════════════

${dbScripts.discovery}

`);
    } else if (agentConfig.enableDiscovery) {
      sections.push(`
# ⚠️ NESSUNO SCRIPT DISCOVERY ASSOCIATO A QUESTO AGENT
# Usa le meta-istruzioni sopra per guidare la conversazione discovery.
`);
    }
  }
  
  // DEMO: Solo durante fase demo
  if (phase === 'demo') {
    if (agentConfig.enableDemo && dbScripts?.demo) {
      sections.push(`
# ═══════════════════════════════════════════════════════════════════════════
# SCRIPT ATTIVO: DEMO E PRESENTAZIONE [DA DATABASE]
# ═══════════════════════════════════════════════════════════════════════════

${dbScripts.demo}

`);
    } else if (agentConfig.enableDemo) {
      sections.push(`
# ⚠️ NESSUNO SCRIPT DEMO ASSOCIATO A QUESTO AGENT
# Usa le meta-istruzioni sopra e il Discovery REC per guidare la demo.
`);
    }
  }
  
  // OBJECTIONS/CLOSING: Solo durante queste fasi
  if (phase === 'objections' || phase === 'closing') {
    if (dbScripts?.objections) {
      sections.push(`
# ═══════════════════════════════════════════════════════════════════════════
# SCRIPT ATTIVO: GESTIONE OBIEZIONI [DA DATABASE]
# ═══════════════════════════════════════════════════════════════════════════

${dbScripts.objections}

`);
    } else {
      sections.push(`
# ⚠️ NESSUNO SCRIPT OBIEZIONI ASSOCIATO A QUESTO AGENT
# Usa le meta-istruzioni sopra per gestire obiezioni e closing.
`);
    }
  }

  return sections.join('\n');
}

// ✅ OPTIMIZATION: Dynamic context for Sales Agent (non-cacheable data)
// This wraps prospect-specific data separately from static instructions
export function buildSalesAgentDynamicContext(
  agentConfig: SalesAgentConfig,
  prospectData: ProspectData,
  currentPhase: 'discovery' | 'demo' | 'objections' | 'closing',
  conversationHistory?: Array<{role: 'user' | 'assistant'; content: string; timestamp: Date}>,
  position?: ScriptPosition,
  discoveryRec?: DiscoveryRec
): string {
  const sections: string[] = [];

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 📋 DISCOVERY REC - Iniettato quando presente (fasi demo/objections/closing)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  if (discoveryRec && currentPhase !== 'discovery') {
    sections.push(formatDiscoveryRecForPrompt(discoveryRec));
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 🆕 NAVIGATION MAP - Se abbiamo la posizione esatta, mostra la mappa
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  if (position && position.scriptStructure) {
    const navigationMap = generateNavigationMap(position);
    if (navigationMap) {
      sections.push(navigationMap);
    }
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 🆕 NEXT ACTION - Istruzione esplicita su cosa fare ora
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  if (position && position.scriptStructure) {
    const nextAction = generateNextAction(position, prospectData.name);
    if (nextAction) {
      sections.push(nextAction);
    }
  }

  sections.push(`
# INFORMAZIONI SUL PROSPECT

**Nome:** ${prospectData.name}
${prospectData.business ? `**Business:** ${prospectData.business}` : ''}
${prospectData.currentState ? `**Situazione Attuale:** ${prospectData.currentState}` : ''}
${prospectData.idealState ? `**Situazione Ideale:** ${prospectData.idealState}` : ''}
${prospectData.painPoints?.length ? `**Pain Points:** ${prospectData.painPoints.join(', ')}` : ''}
${prospectData.budget ? `**Budget:** ${prospectData.budget}` : ''}
${prospectData.urgency ? `**Urgenza:** ${prospectData.urgency}` : ''}
${prospectData.isDecisionMaker !== undefined ? `**Decision Maker:** ${prospectData.isDecisionMaker ? 'Sì' : 'No'}` : ''}

---
`);

  // CONVERSATION HISTORY SECTION - if available
  if (conversationHistory && conversationHistory.length > 0) {
    sections.push(`
# CRONOLOGIA CONVERSAZIONE PRECEDENTE

⚠️ IMPORTANTE: Questa è la trascrizione di quello che hai già detto in questa conversazione.
NON ripetere domande già fatte, NON ricominciare da capo.
CONTINUA la conversazione da dove eri rimasto.

`);

    // ✅ OPTIMIZATION: Removed timestamp to enable Context Caching
    conversationHistory.forEach((msg, index) => {
      const role = msg.role === 'user' ? 'PROSPECT' : 'TU (AGENT)';
      const messageNumber = index + 1;
      sections.push(`[Msg ${messageNumber}] ${role}: ${msg.content}\n`);
    });

    sections.push(`\n---\n\n🔄 ADESSO CONTINUA LA CONVERSAZIONE da dove eri rimasto sopra.\nNON ripetere le domande già fatte.\nRIPRENDI esattamente da dove si era interrotta la conversazione.\n\n---\n`);
  }

  // CHECKPOINT WITH CURRENT PHASE - Include posizione esatta se disponibile
  const phaseDisplay = position?.exactPhaseId 
    ? `${currentPhase.toUpperCase()} (${position.exactPhaseId}${position.exactStepId ? ` / ${position.exactStepId}` : ''})` 
    : currentPhase.toUpperCase();
    
  sections.push(`
╔══════════════════════════════════════════════════════════════════════════════╗
║     🛑 CHECKPOINT - Script ${phaseDisplay}                                    ║
╠══════════════════════════════════════════════════════════════════════════════╣
║  ⚡ Applica le 4 REGOLE D'ORO della sezione statica sopra!                   ║
║  👀 Rileggi le ultime 3 risposte + ADATTA le domande                         ║
╚══════════════════════════════════════════════════════════════════════════════╝
`);

  // ✅ CACHE OPTIMIZATION: Scripts are now in static section above
  // Here we only indicate which phase/script to follow
  sections.push(`
════════════════════════════════════════════════════════════════════════════════
🎯 FASE CORRENTE: ${currentPhase.toUpperCase()}
════════════════════════════════════════════════════════════════════════════════

📌 ISTRUZIONI OPERATIVE:

${currentPhase === 'discovery' 
  ? '➡️ Segui lo SCRIPT #1: DISCOVERY CALL dalla sezione SCRIPTS sopra.\n   Ricorda di sostituire [NOME_PROSPECT] con il nome reale del prospect.\n   ⚠️ INIZIA DALLA FASE E STEP INDICATI NELLA MAPPA SOPRA!' 
  : currentPhase === 'demo'
  ? '➡️ Segui lo SCRIPT #2: DEMO E PRESENTAZIONE dalla sezione SCRIPTS sopra.\n   Ricorda di sostituire [NOME_PROSPECT] con il nome reale del prospect.\n   ⚠️ INIZIA DALLA FASE E STEP INDICATI NELLA MAPPA SOPRA!'
  : currentPhase === 'objections'
  ? '➡️ Segui lo SCRIPT #3: GESTIONE OBIEZIONI dalla sezione SCRIPTS sopra.\n   Usa le tecniche di handling delle 20+ obiezioni.\n   Ricorda di sostituire [NOME_PROSPECT] con il nome reale del prospect.'
  : currentPhase === 'closing'
  ? '➡️ CLOSING FINALE\n   Usa assumptive close: "Perfetto! Carta o bonifico?"\n   Segui le tecniche di closing dallo script obiezioni se necessario.'
  : ''}

⚡ REMINDER: Tutti gli script sono nella sezione SCRIPTS DI VENDITA (cachata) sopra.
   Non sono ripetuti qui per ottimizzare i costi (riduzione 94% sui token di input).

════════════════════════════════════════════════════════════════════════════════
`);

  return sections.join('\n');
}

// Backward compatibility wrapper (combines static + dynamic)
// NOTA: Questa funzione è deprecata - usa buildFullSalesAgentContextAsync per nuove implementazioni
export function buildSalesAgentPrompt(
  agentConfig: SalesAgentConfig,
  prospectData: ProspectData,
  currentPhase: 'discovery' | 'demo' | 'objections' | 'closing',
  conversationHistory?: Array<{role: 'user' | 'assistant'; content: string; timestamp: Date}>
): string {
  // FIXED: Pass currentPhase to buildStaticSalesAgentPrompt for phase-specific script loading
  const staticPart = buildStaticSalesAgentPrompt(agentConfig, undefined, currentPhase);
  const dynamicPart = buildSalesAgentDynamicContext(agentConfig, prospectData, currentPhase, conversationHistory);
  return staticPart + '\n\n' + dynamicPart;
}
