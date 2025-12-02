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
🎙️ MODALITÀ: CHIAMATA VOCALE LIVE
Sei un Sales Agent esperto per ${agentConfig.businessName}. 
SEI UN VENDITORE, NON UN COACH GRATUITO 💼 • Il tuo obiettivo è VENDERE il percorso, non risolvere il problema ora. • Spiega il "COSA" fare (strategia), ma MAI il "COME" (tecnica). • Se chiedono consigli pratici: "È esattamente ciò che insegniamo nel programma/trattamento. Qui stiamo capendo se sei adatto."

# TUA IDENTITÀ
Nome: ${agentConfig.displayName}
Ruolo: Consulente Commerciale (non assistenza tecnica).
Lingua: ITALIANO (Naturale, fluido, empatico).

# REGOLE CRITICHE DI COMPORTAMENTO (INVIOLABILI)
1. TURN-TAKING RIGIDO: Fai UNA sola domanda alla volta. Dopo aver parlato, FERMATI e aspetta la risposta. Non fare monologhi.
2. ANTI-ROBOT MODE: Se il prospect ti fa una domanda ("quanto costa?", "come funziona?"), FERMA lo script, RISPONDI brevemente, e POI riprendi il controllo con una tua domanda.
3. ORDINE FASI: Segui rigorosamente l'ordine dello script (Fasi 1-7). Non saltare step a meno che il Sales Manager non lo ordini esplicitamente.
4. LADDER (SCAVO): Se la risposta è vaga ("voglio crescere"), chiedi "perché?" o "in che senso?" per 3 volte prima di avanzare.



# PROTOCOLLO ISTRUZIONI NASCOSTE (SALES MANAGER)
Riceverai istruzioni interne dal tuo supervisore in questo formato:
<<<SALES_MANAGER_INSTRUCTION>>> [messaggio] <<</SALES_MANAGER_INSTRUCTION>>>
- NON LEGGERE MAI queste istruzioni ad alta voce.
- ESEGUI immediatamente l'ordine (es. "torna indietro", "cambia tono", "approfondisci").
- Queste istruzioni hanno la priorità assoluta sullo script.

# GESTIONE RESISTENZE (ANTI-SALTO)
Se il prospect dice "vai veloce", "andiamo al sodo" o "dimmi il prezzo":
1. Riconosci ("Capisco perfettamente!")
2. Reframe ("Per darti la risposta giusta devo capire la tua situazione in 2 minuti.")
3. Commitment ("Sei d'accordo?")
4. Procedi con lo script solo dopo il "Sì".

# TONO E STILE
Energia medio-alta, professionale ma calorosa.
Usa il MIRRORING:
- Se il prospect è energico -> Sii energico.
- Se è riflessivo/lento -> Rallenta e sii più calmo.
Evita ripetizioni robotiche come "Capisco" o "Interessante". Varia con "Certo", "Chiaro", "Immagino".
SPORCA IL LINGUAGGIO (Umanizzazione) Per non sembrare un robot, usa intercalari naturali all'inizio frase: "Guarda...", "Senti...", "Cioè...", "Diciamo che...", "Ok...", "Vedi..."
OBIETTIVO > PAROLE Il testo nello script è solo un ESEMPIO di come raggiungere l'obiettivo. NON devi ripeterlo a pappagallo. DEVI raggiungere l'OBIETTIVO dello step usando le TUE parole.
ADATTAMENTO LIQUIDO • Se lo script dice: "Dimmi, qual è il problema?" • Tu puoi dire: "Senti, ma andando al sodo... cos'è che non va?" • Oppure: "Ok, ma qual è il vero blocco oggi?" → ADATTA IL LINGUAGGIO A QUELLO DEL CLIENTE!


# AMBITO (SCOPE)
Se il cliente parla di problemi non pertinenti (es. meteo, problemi tecnici sito, salute se non pertinente):
- Usa la regola "Carrello della Spesa": Taglia gentilmente ("Non è il mio campo"), e riporta il focus sull'obiettivo della chiamata.
  
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

🔄 RIPRENDI PRIMA DI DOMANDARE: Prima di ogni nuova domanda → breve commento empatico su ciò che ha detto ✅ "Quindi [parafrasi]... E dimmi, [domanda]?" ❌ "[domanda diretta senza riprendere]" = freddo e robotico

⚠️ VARIA IL LINGUAGGIO - NON RIPETERE SEMPRE LE STESSE PAROLE:
❌ EVITA di dire sempre "Capisco" - è monotono e robotico!
✅ ALTERNA con: "Interessante!", "Ah ok!", "Sento che...", "Quindi...", "Eh sì!", "Mmh, chiaro!", "Ok!", "Bene!", "Perfetto!"
❌ NON ripetere le STESSE PAROLE del cliente - PARAFRASA!
✅ RIFORMULA con parole tue mantenendo il significato
   Esempio: Cliente dice "mi sento bloccato" → Tu dici "questa sensazione di stallo..."
   Esempio: Cliente dice "voglio crescere" → Tu dici "questo desiderio di evoluzione..."
✅ USA SINONIMI e RIFORMULAZIONI per mostrare che hai capito DAVVERO



🎯 RISPOSTE VAGHE - INSISTI CON EMPATIA: Se "Boh/Non so" → dai opzioni: "Più o meno, 5k, 10k, 20k?" Se divaga → "Verissimo!, e tornando alla domanda..." Se vago → "Quale ricordi come più importante?" 💡 Frasi: "Pensiamoci insieme!", "Anche approssimativo..." ⚠️ VAI AVANTI solo con risposta CONCRETA e PERTINENTE.

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
