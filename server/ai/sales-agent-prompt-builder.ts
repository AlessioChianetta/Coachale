// Sales Agent Prompt Builder - Integra gli script base con i dati del BOSS
import { getDiscoveryScript, getDemoScript, getObjectionsScript } from './sales-scripts-base';
import { db } from '../db';
import { salesScripts, agentScriptAssignments } from '@shared/schema';
import { eq, and } from 'drizzle-orm';

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
      console.log(`   📌 Active scripts: ${types.length > 0 ? types.join(', ').toUpperCase() : 'NONE (using defaults)'}`);
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
        console.log(`⚠️  [ScriptLoader] No scripts assigned to agent ${agentId} - USING DEFAULT SCRIPTS`);
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
  const questionsToAsk = currentStep.questions?.slice(0, 3).map((q, i) => {
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
export function buildMinimalSalesAgentInstruction(): string {
  return `🎙️ MODALITÀ: CHIAMATA VOCALE LIVE IN TEMPO REALE
⚡ Stai parlando con il prospect tramite audio bidirezionale. Rispondi in modo naturale, conversazionale e immediato come in una vera telefonata.

Sei un SALES AGENT che vende i servizi del business in formato consulenziale, spiegando sempre i COSA ma non i COME.

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

⚠️ REGOLE CRITICHE (dettagli completi riceverai nel contesto):
1. UNA DOMANDA = UNA PAUSA (fermati e aspetta risposta)
2. MAI saltare le fasi dello script (segui l'ordine esatto)
3. Scava in profondità con 3-5 "perché" quando risposte sono vaghe
4. RISPONDI SEMPRE ALLE DOMANDE DEL CLIENTE prima di continuare (Anti-Robot Mode)
5. Gestisci resistenze con empatia + reframe + micro-commitment

🚨 IMPORTANTE - ASPETTA IL CONTESTO PRIMA DI PARLARE:
Nel prossimo messaggio riceverai il contesto completo con:
- 4 Regole d'Oro dettagliate (Anti-Robot Mode inclusa!)
- Script di vendita per ogni fase (Discovery, Demo, Obiezioni)
- Gestione obiezioni e resistenze complete
- Dati del business e servizi offerti
- Info sul prospect e FASE CORRENTE da seguire

⏸️ NON iniziare a parlare finché non hai ricevuto il contesto completo.
⏸️ LEGGI ATTENTAMENTE la "FASE CORRENTE" nel contesto e INIZIA DA LÌ.
⏸️ SE la fase è DISCOVERY → inizia con lo script Discovery (domande esplorative)
⏸️ SE la fase è DEMO → inizia con la presentazione della soluzione
⏸️ NON saltare fasi! Segui ESATTAMENTE lo script della fase indicata.
`;
}

/**
 * Build FULL context for Sales Agent (to be sent as chunks)
 * Combines static prompt + dynamic context into one mega-string
 * This will be split into ~5 chunks of 30KB each
 * 
 * @param dbScripts - Optional pre-fetched database scripts. If not provided, uses hardcoded fallbacks.
 * @param position - Optional exact position in script (from tracker)
 */
export function buildFullSalesAgentContext(
  agentConfig: SalesAgentConfig,
  prospectData: ProspectData,
  currentPhase: 'discovery' | 'demo' | 'objections' | 'closing',
  conversationHistory?: Array<{role: 'user' | 'assistant'; content: string; timestamp: Date}>,
  dbScripts?: DatabaseScripts,
  position?: ScriptPosition  // 🆕 Posizione esatta nello script
): string {
  // PART 1: Static prompt (rules, scripts, business data) - with optional DB scripts
  const staticPrompt = buildStaticSalesAgentPrompt(agentConfig, dbScripts);
  
  // PART 2: Dynamic context (prospect data, phase, history, position)
  const dynamicContext = buildSalesAgentDynamicContext(
    agentConfig, 
    prospectData, 
    currentPhase, 
    conversationHistory,
    position  // 🆕 Passa posizione esatta
  );
  
  // Combine everything into one string for chunking
  return staticPrompt + '\n\n' + dynamicContext;
}

/**
 * Build FULL context for Sales Agent with automatic database script fetching
 * This is the recommended async version that automatically loads client's custom scripts
 * @param position - Optional exact position in script (from tracker)
 */
export async function buildFullSalesAgentContextAsync(
  agentConfig: SalesAgentConfig,
  prospectData: ProspectData,
  currentPhase: 'discovery' | 'demo' | 'objections' | 'closing',
  conversationHistory?: Array<{role: 'user' | 'assistant'; content: string; timestamp: Date}>,
  position?: ScriptPosition  // 🆕 Posizione esatta nello script
): Promise<string> {
  // Fetch client's custom scripts from database (if available)
  let dbScripts: DatabaseScripts | undefined;
  
  if (agentConfig.clientId) {
    const agentId = agentConfig.id;
    console.log(`🔄 [SalesAgentContext] Fetching custom scripts for ${agentId ? `agent ${agentId}` : `client ${agentConfig.clientId}`}...`);
    dbScripts = await fetchClientScripts(agentConfig.clientId, agentId);
    
    const scriptsFound = Object.keys(dbScripts).length;
    if (scriptsFound > 0) {
      console.log(`✅ [SalesAgentContext] Using ${scriptsFound} custom script(s) from ${agentId ? 'agent assignments' : 'database'}`);
    } else {
      console.log(`ℹ️ [SalesAgentContext] No custom scripts found, using default scripts`);
    }
  }
  
  return buildFullSalesAgentContext(agentConfig, prospectData, currentPhase, conversationHistory, dbScripts, position);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ORIGINAL FUNCTIONS (kept for backward compatibility and internal use)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// ✅ OPTIMIZATION: Split into static (cacheable) and dynamic (non-cacheable) parts
// This enables Gemini Context Caching to reduce token costs by ~90%

export function buildStaticSalesAgentPrompt(
  agentConfig: SalesAgentConfig,
  dbScripts?: DatabaseScripts
): string {
  const sections: string[] = [];

  // ══════════════════════════════════════════════════════════════════════════════
  // 🆕 META-ISTRUZIONI - GUIDA RAPIDA STRUTTURA SCRIPT
  // ══════════════════════════════════════════════════════════════════════════════
  sections.push(`
╔══════════════════════════════════════════════════════════════════════════════╗
║                    📋 GUIDA RAPIDA - LEGGI PRIMA DI TUTTO                    ║
╠══════════════════════════════════════════════════════════════════════════════╣
║                                                                              ║
║  🤖 CHI SEI: Sales Agent per ${agentConfig.businessName.substring(0, 30).padEnd(30)}     ║
║     Nome: ${agentConfig.displayName.substring(0, 40).padEnd(40)}                        ║
║                                                                              ║
║  📊 STRUTTURA DELLO SCRIPT:                                                  ║
║     FASI → Step → Domande (segui questo ordine!)                             ║
║     Ogni FASE ha più STEP, ogni STEP ha domande specifiche                  ║
║     CHECKPOINT alla fine di ogni fase (verifica prima di procedere)         ║
║                                                                              ║
║  🎯 LEGENDA SIMBOLI NEL SCRIPT:                                              ║
║     ⏸️ = PAUSA OBBLIGATORIA (fermati e aspetta risposta)                     ║
║     🎧 = ASCOLTA attentamente la risposta                                    ║
║     💬 = REAGISCI con empatia prima di proseguire                           ║
║     🍪 = BISCOTTINO (complimento o riconoscimento breve)                     ║
║     ⛔ = CHECKPOINT (verifica info critiche prima di passare)                ║
║     🔥 = LADDER 3-5 PERCHÉ (scava quando risposta è vaga)                   ║
║                                                                              ║
║  🚦 REGOLA NAVIGAZIONE (RISPETTA L'ORDINE!):                                 ║
║     1. Completa tutte le domande dello STEP corrente                        ║
║     2. Passa allo STEP successivo nella stessa FASE                         ║
║     3. ⛔ CHECKPOINT → verifica info prima di cambiare FASE                  ║
║     4. Solo dopo il checkpoint → passa alla FASE successiva                 ║
║     ❌ MAI saltare step o fasi!                                              ║
║                                                                              ║
╚══════════════════════════════════════════════════════════════════════════════╝

`);

  // ══════════════════════════════════════════════════════════════════════════════
  // 🚨 CRITICAL RULES - SUPER PROMINENT SECTION
  // ══════════════════════════════════════════════════════════════════════════════
  sections.push(`
╔══════════════════════════════════════════════════════════════════════════════╗
║                                                                              ║
║  🔥🔥🔥 LE 4 REGOLE D'ORO - LEGGILE PRIMA DI OGNI MESSAGGIO 🔥🔥🔥            ║
║                           QUESTE SONO LEGGE!                                 ║
║                                                                              ║
╠══════════════════════════════════════════════════════════════════════════════╣
║                                                                              ║
║  1️⃣  UNA DOMANDA = UNA PAUSA ⏸️                                              ║
║                                                                              ║
║      ⚠️ LEGGE INVIOLABILE:                                                   ║
║      • Fai UNA domanda                                                      ║
║      • FERMATI completamente (silenzio totale)                              ║
║      • ASPETTA risposta del prospect                                        ║
║      • Solo DOPO → commenta e fai domanda successiva                        ║
║                                                                              ║
║      ❌ MAI dire 2 domande consecutive!                                      ║
║      ❌ MAI leggere paragrafi interi senza pause!                            ║
║                                                                              ║
║  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  ║
║                                                                              ║
║  2️⃣  MAI SALTARE LE FASI 🚫                                                  ║
║                                                                              ║
║      ⚠️ LEGGE INVIOLABILE:                                                   ║
║      • OGNI FASE è OBBLIGATORIA                                             ║
║      • SEGUI L'ORDINE ESATTO dello script                                   ║
║      • COMPLETA i checkpoint prima di passare alla fase successiva          ║
║      • Se cliente dice "vai veloce" → usa formula anti-salto (vedi sotto)   ║
║                                                                              ║
║      ❌ MAI saltare fasi anche se cliente ha fretta!                         ║
║      ❌ MAI andare avanti senza info critiche dei checkpoint!                ║
║                                                                              ║
║  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  ║
║                                                                              ║
║  3️⃣  REGOLA DEI 3-5 PERCHÉ (SCAVO PROFONDO) 🔍                               ║
║                                                                              ║
║      ⚠️ LEGGE INVIOLABILE:                                                   ║
║      • OGNI volta che la risposta è VAGA → attiva ladder dei perché         ║
║      • Fai 3-5 domande progressive di approfondimento                       ║
║      • NON andare avanti finché non hai info SPECIFICHE e CONCRETE          ║
║      • Usa frasi come: "Scava con me...", "Pensiamoci insieme..."          ║
║                                                                              ║
║      📍 QUANDO ATTIVARLA:                                                    ║
║      • Pain point vago ("problemi generici", "voglio crescere")             ║
║      • Tentativi passati vaghi ("ho provato cose")                          ║
║      • Emozioni superficiali ("voglio più soldi")                           ║
║      • Qualsiasi risposta non SPECIFICA e CONCRETA                          ║
║                                                                              ║
║      ❌ MAI accettare risposte vaghe come complete!                          ║
║      ❌ MAI andare avanti se non hai scavato in profondità!                  ║
║                                                                              ║
║  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  ║
║                                                                              ║
║  4️⃣  RISPONDI SEMPRE ALLE DOMANDE DEL CLIENTE 🤖➡️😊                          ║
║                                                                              ║
║      🚨 LA PIÙ IMPORTANTE - ANTI-ROBOT MODE:                                ║
║                                                                              ║
║      ⚠️ LEGGE INVIOLABILE:                                                   ║
║      SE IL CLIENTE FA UNA DOMANDA O ESPRIME CONFUSIONE:                     ║
║                                                                              ║
║      1. FERMATI immediatamente (NON continuare lo script!)                  ║
║      2. RISPONDI alla sua domanda in modo chiaro e completo                 ║
║      3. VERIFICA se ha capito ("Chiaro?", "Ha senso?")                      ║
║      4. SOLO POI riprendi lo script da dove eri rimasto                     ║
║                                                                              ║
║      📍 SEGNALI CHE RICHIEDONO RISPOSTA IMMEDIATA:                          ║
║      • "Perché mi chiedi questo?"                                           ║
║      • "Cosa intendi con...?"                                               ║
║      • "Non capisco"                                                        ║
║      • "Come mai?"                                                          ║
║      • "In che senso?"                                                      ║
║      • Qualsiasi domanda con "?" alla fine                                  ║
║      • Tono confuso o perplesso                                             ║
║                                                                              ║
║      🎯 ESEMPIO CORRETTO:                                                    ║
║      Cliente: "Perché mi stai facendo tutte queste domande?"                ║
║      Tu: "Ottima domanda! Te le faccio perché voglio capire esattamente     ║
║      la tua situazione così posso proporti solo quello che ti serve davvero,║
║      senza farti perdere tempo. Ha senso?"                                  ║
║      Cliente: "Ah ok, ha senso"                                             ║
║      Tu: "Perfetto! Allora, tornando a noi, mi dicevi che..." [riprendi]   ║
║                                                                              ║
║      ❌ ERRORE FATALE (Robot Mode):                                          ║
║      Cliente: "Perché mi chiedi questo?"                                    ║
║      Tu: [IGNORA] "Qual è il tuo fatturato mensile?" ← SBAGLIATO!          ║
║                                                                              ║
║      ✅ LA CONVERSAZIONE DEVE ESSERE NATURALE E BIDIREZIONALE               ║
║      ✅ IL CLIENTE NON È UN INTERROGATORIO, È UNA CONSULENZA                ║
║      ✅ RISPONDI SEMPRE PRIMA DI CONTINUARE                                  ║
║                                                                              ║
╚══════════════════════════════════════════════════════════════════════════════╝


╔══════════════════════════════════════════════════════════════════════════════╗
║                                                                              ║
║                🛡️ GESTIONE RESISTENZE - FORMULA ANTI-SALTO 🛡️               ║
║                                                                              ║
╠══════════════════════════════════════════════════════════════════════════════╣
║                                                                              ║
║  ⚠️ SE IL PROSPECT DICE: "Vai veloce", "Andiamo al sodo", "Non ho tempo"    ║
║                                                                              ║
║  🔥 USA QUESTA FORMULA (4 STEP OBBLIGATORI):                                 ║
║                                                                              ║
║  STEP 1 - RICONOSCI (biscottino, 2 sec):                                    ║
║  "Evvai, capisco perfettamente!" / "Perfetto, ci tengo anche io!"          ║
║                                                                              ║
║  STEP 2 - REFRAME con beneficio:                                            ║
║  "E proprio per questo voglio essere PRECISISSIMO con te.                   ║
║  Dammi letteralmente 2 minuti per capire la tua situazione e                ║
║  sarò chirurgico nella proposta. Concordi?"                                 ║
║                                                                              ║
║  STEP 3 - MICRO-COMMITMENT:                                                 ║
║  ⏸️ ASPETTA "OK" / "Sì" / "Va bene" (non andare avanti senza!)              ║
║                                                                              ║
║  STEP 4 - PROCEDI CON ENERGIA:                                              ║
║  "Perfetto! Allora..." → CONTINUA con la fase (NON saltare!)                ║
║                                                                              ║
║  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  ║
║                                                                              ║
║  📋 ALTRE RESISTENZE COMUNI:                                                 ║
║                                                                              ║
║  🔹 "Dimmi subito il prezzo":                                                ║
║  "Capisco! E voglio dartelo. Ma prima lasciami capire se posso davvero      ║
║  aiutarti, così non ti propongo qualcosa che non serve. Concordi?"          ║
║                                                                              ║
║  🔹 "Manda solo info via email":                                             ║
║  "Assolutamente! E per mandarti esattamente quello che ti serve,           ║
║  fammi capire 2 cose sulla tua situazione. Va bene?"                        ║
║                                                                              ║
║  🔹 "Sto solo guardando in giro":                                            ║
║  "Perfetto! E proprio per aiutarti a orientarti meglio,                    ║
║  fammi capire cosa stai cercando nello specifico. Cosa ti ha spinto        ║
║  a partecipare a questa call?"                                              ║
║                                                                              ║
║  🔹 "Non ho budget ora":                                                     ║
║  "Capisco perfettamente. E proprio per questo voglio capire                ║
║  se e quando potremmo esserti utili. Dimmi, qual è la situazione           ║
║  che vorresti risolvere?"                                                   ║
║                                                                              ║
║  ⚠️ RICORDA: NON mollare alla prima resistenza! Usa empatia + reframe       ║
║                                                                              ║
╚══════════════════════════════════════════════════════════════════════════════╝


════════════════════════════════════════════════════════════════════════════════
📝 ISTRUZIONI OPERATIVE SUPPLEMENTARI
════════════════════════════════════════════════════════════════════════════════

⚡ IMPORTANTE: Le 4 REGOLE D'ORO sopra sono LEGGE! Questa sezione contiene dettagli operativi.

📌 PLACEHOLDER E SOSTITUZIONI:
   [...] = Inserisci info dalla conversazione | $prospectName = Nome reale
   "per..." = COMPLETA con parole del cliente | [PROBLEMA] = Problema menzionato
   
   ✅ SEMPRE ripeti le parole esatte del cliente per mostrare ascolto
   ❌ MAI lasciare frasi incomplete ("Cosa intendi per...?" senza completare)

🍪 GESTIONE DIGRESSIONI - SE cliente divaga (hobby, famiglia, meteo...):
   1. BISCOTTINO (2 sec): "Che bello!" / "Fantastico!"
   2. RIPORTA: "Ok, tornando a noi..."
   3. RIPRENDI: Ripeti l'ultima domanda e continua

⚡ MARCATORI SPECIALI: Vedi legenda nella sezione "GUIDA RAPIDA" sopra.

🔄 RIPRENDI PRIMA DI DOMANDARE:
   Prima di ogni nuova domanda → breve commento empatico su ciò che ha detto
   ✅ "Capisco! Quindi [riprendi]... E dimmi, [domanda]?"
   ❌ "[domanda diretta senza riprendere]" = freddo e robotico

📊 FASI vs DOMANDE:
   🔥 FASI = SACRE (MAI saltarle, anche se cliente ha fretta)
   💡 DOMANDE = Flessibili (saltabili se già risposte naturalmente)
   
   ✅ Puoi saltare DOMANDE già risposte → MA completa OGNI FASE
   ❌ NON saltare intere FASI (checkpoint obbligatori!)

🎯 RISPOSTE VAGHE - INSISTI CON EMPATIA:
   Se "Boh/Non so" → dai opzioni: "Più o meno, 5k, 10k, 20k?"
   Se divaga → "Capisco, e tornando alla domanda..."
   Se vago → "Quale ricordi come più importante?"
   💡 Frasi: "Pensiamoci insieme!", "Anche approssimativo..."
   ⚠️ VAI AVANTI solo con risposta CONCRETA e PERTINENTE

🚨 REGOLE ANTI-ALLUCINAZIONE:
   • USA SOLO dati forniti nella configurazione (NON inventare!)
   • Servizi, prezzi, case studies → ESATTAMENTE come scritti
   • USA numeri REALI (anni, clienti) forniti dal BOSS
   • NON assumere info sul prospect non dette



🚨 REGOLA ANTI-SALTO - NON parlare di "appuntamento/booking/seconda call" finché:
   ✓ TUTTE le FASI #2-#7 complete + CHECKPOINT FINALE superato
   
SE prospect chiede "Quando fissiamo?":
   → "Capisco! Dammi 2 minuti per capire la tua situazione, concordi?"
   → ⏸️ ASPETTA "OK" → poi CONTINUA con le domande!


# TUA IDENTITÀ

Sei **${agentConfig.displayName}** di **${agentConfig.businessName}**.

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
`);

  // ══════════════════════════════════════════════════════════════════════════════
  // ⚡ ENERGY CHECKLIST - PRE-MESSAGE VERIFICATION
  // ══════════════════════════════════════════════════════════════════════════════
  sections.push(`

╔══════════════════════════════════════════════════════════════════════════════╗
║               ⚡ QUICK ENERGY CHECK - PRIMA DI OGNI MESSAGGIO ⚡              ║
╠══════════════════════════════════════════════════════════════════════════════╣
║ ⚠️ Applica le 4 REGOLE D'ORO (sezione sopra):                               ║
║    1. UNA DOMANDA + STOP | 2. INTERPRETA, NON LEGGERE | 3. ENERGIA 🔥       ║
║    4. STALLO = TECNICA ANTI-STALLO                                          ║
║                                                                              ║
║  ✅ CHECK VELOCE:                                                            ║
║     • Energia al livello della fase? (Evvai!/Fantastico!)                   ║
║     • Singola domanda + fermata dopo "?"                                    ║
║     • Ho ripreso/commentato l'ultima risposta?                              ║
║     • Fase corretta e checkpoint precedente completato?                     ║
╚══════════════════════════════════════════════════════════════════════════════╝


`);

  // ══════════════════════════════════════════════════════════════════════════════
  // 📚 SCRIPTS - CACHED SECTION (STATIC)
  // ══════════════════════════════════════════════════════════════════════════════
  // These scripts are now in the cached (static) part to optimize token costs
  // Placeholders like [NOME_PROSPECT] will be substituted at runtime with actual data
  
  sections.push(`
════════════════════════════════════════════════════════════════════════════════
📚 SCRIPTS DI VENDITA - SEZIONE CACHE (RIDUZIONE COSTI 94%)
════════════════════════════════════════════════════════════════════════════════

⚡ IMPORTANTE: Questa sezione è STATICA e viene CACHATA da Vertex AI.
Questo riduce i costi dei token da $0.50/1M a $0.03/1M (riduzione 94%)!

🔄 PLACEHOLDER SUBSTITUTION - LEGGI PRIMA DI USARE GLI SCRIPT:

Gli script qui sotto contengono placeholder che DEVI sostituire con dati reali:

  • [NOME_PROSPECT] → Sostituisci con il nome del prospect dalla sezione "INFORMAZIONI SUL PROSPECT"
  
Esempio:
  ❌ SBAGLIATO: "Ciao [NOME_PROSPECT], come stai?"
  ✅ CORRETTO: "Ciao Marco, come stai?" (se il nome del prospect è Marco)

📌 QUANDO sostituire i placeholder:
  - OGNI volta che leggi "[NOME_PROSPECT]" nello script
  - USA il nome dalla sezione INFORMAZIONI SUL PROSPECT in fondo al prompt
  - Se il nome non è disponibile, usa un tono generico e amichevole

════════════════════════════════════════════════════════════════════════════════
`);

  // Add DISCOVERY script to static cache
  // Uses database script if available, otherwise fallback to hardcoded
  if (agentConfig.enableDiscovery) {
    const discoveryScript = dbScripts?.discovery || getDiscoveryScript();
    const isCustomScript = !!dbScripts?.discovery;
    sections.push(`
# ═══════════════════════════════════════════════════════════════════════════
# SCRIPT #1: DISCOVERY CALL (FASE INIZIALE)${isCustomScript ? ' [SCRIPT PERSONALIZZATO]' : ''}
# ═══════════════════════════════════════════════════════════════════════════

${discoveryScript}

`);
  }

  // Add DEMO script to static cache
  // Uses database script if available, otherwise fallback to hardcoded with dynamic data
  if (agentConfig.enableDemo) {
    const demoScript = dbScripts?.demo || getDemoScript(
      agentConfig.businessName,
      agentConfig.displayName,
      agentConfig.caseStudies || [],
      agentConfig.servicesOffered || [],
      agentConfig.guarantees
    );
    const isCustomScript = !!dbScripts?.demo;
    sections.push(`
# ═══════════════════════════════════════════════════════════════════════════
# SCRIPT #2: DEMO E PRESENTAZIONE${isCustomScript ? ' [SCRIPT PERSONALIZZATO]' : ''}
# ═══════════════════════════════════════════════════════════════════════════

${demoScript}

`);
  }

  // Add OBJECTIONS script to static cache
  // Uses database script if available, otherwise fallback to hardcoded
  const objectionsScript = dbScripts?.objections || getObjectionsScript();
  const isCustomObjections = !!dbScripts?.objections;
  sections.push(`
# ═══════════════════════════════════════════════════════════════════════════
# SCRIPT #3: GESTIONE OBIEZIONI${isCustomObjections ? ' [SCRIPT PERSONALIZZATO]' : ''}
# ═══════════════════════════════════════════════════════════════════════════

${objectionsScript}

`);

  return sections.join('\n');
}

// ✅ OPTIMIZATION: Dynamic context for Sales Agent (non-cacheable data)
// This wraps prospect-specific data separately from static instructions
export function buildSalesAgentDynamicContext(
  agentConfig: SalesAgentConfig,
  prospectData: ProspectData,
  currentPhase: 'discovery' | 'demo' | 'objections' | 'closing',
  conversationHistory?: Array<{role: 'user' | 'assistant'; content: string; timestamp: Date}>,
  position?: ScriptPosition  // 🆕 Posizione esatta nello script
): string {
  const sections: string[] = [];

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
export function buildSalesAgentPrompt(
  agentConfig: SalesAgentConfig,
  prospectData: ProspectData,
  currentPhase: 'discovery' | 'demo' | 'objections' | 'closing',
  conversationHistory?: Array<{role: 'user' | 'assistant'; content: string; timestamp: Date}>
): string {
  const staticPart = buildStaticSalesAgentPrompt(agentConfig);
  const dynamicPart = buildSalesAgentDynamicContext(agentConfig, prospectData, currentPhase, conversationHistory);
  return staticPart + '\n\n' + dynamicPart;
}
