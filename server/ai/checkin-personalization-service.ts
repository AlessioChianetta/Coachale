/**
 * Check-in Personalization Service
 * 
 * Generates AI-personalized messages for weekly check-in.
 * NOW uses buildUserContext() to load REAL client data (like ai-service.ts)
 * plus File Search as a supplemental source.
 * 
 * The AI acts as the consultant's personal assistant, generating messages
 * as if the consultant themselves is reaching out to the client.
 */

import { db } from "../db";
import { users } from "../../shared/schema";
import { eq } from "drizzle-orm";
import { getGoogleAIStudioClientForFileSearch, getModelWithThinking } from "./provider-factory";
import { fileSearchService } from "./file-search-service";
import { buildUserContext, UserContext } from "../ai-context-builder";

export interface ClientCheckinContext {
  clientName: string;
  clientId: string;
  consultantId: string;
  consultantName?: string;
  hasFileSearchStore: boolean;
  storeNames: string[];
  totalDocs: number;
  userContext?: UserContext; // NEW: Full user context from buildUserContext
}

export interface PersonalizedCheckinResult {
  success: boolean;
  aiMessage?: string;
  context?: ClientCheckinContext;
  error?: string;
  model?: string;
  usedFileSearch?: boolean;
  usedUserContext?: boolean;
}

/**
 * Fetch basic client info and check for File Search stores with documents
 */
export async function fetchClientContext(
  clientId: string,
  consultantId: string
): Promise<ClientCheckinContext | null> {
  try {
    const [client] = await db
      .select({
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        fileSearchEnabled: users.fileSearchEnabled,
      })
      .from(users)
      .where(eq(users.id, clientId))
      .limit(1);

    if (!client) {
      console.log(`[CHECKIN-AI] Client ${clientId} not found`);
      return null;
    }

    const [consultant] = await db
      .select({
        firstName: users.firstName,
        lastName: users.lastName,
      })
      .from(users)
      .where(eq(users.id, consultantId))
      .limit(1);

    const clientName = `${client.firstName || ''} ${client.lastName || ''}`.trim() || 'Cliente';
    const consultantName = consultant ? `${consultant.firstName || ''} ${consultant.lastName || ''}`.trim() : undefined;

    // Check if File Search is enabled for this client (default: true)
    const fileSearchEnabled = client.fileSearchEnabled !== false;
    
    // Get File Search store info
    let storeNames: string[] = [];
    let totalDocs = 0;
    
    if (fileSearchEnabled) {
      try {
        const { storeNames: stores, breakdown } = await fileSearchService.getStoreBreakdownForGeneration(
          clientId,
          'client',
          consultantId
        );
        storeNames = stores;
        totalDocs = breakdown.reduce((sum, store) => sum + store.totalDocs, 0);
        
        console.log(`[CHECKIN-AI] File Search stores for ${clientName}: ${storeNames.length} stores, ${totalDocs} total docs`);
        if (breakdown.length > 0) {
          breakdown.forEach(store => {
            console.log(`  - ${store.storeDisplayName}: ${store.totalDocs} docs`);
          });
        }
      } catch (err) {
        console.log(`[CHECKIN-AI] File Search not available for ${clientName}, will use userContext only`);
      }
    }

    // NEW: Load FULL user context (like ai-service.ts does)
    let userContext: UserContext | undefined;
    try {
      console.log(`[CHECKIN-AI] Loading full userContext for ${clientName}...`);
      userContext = await buildUserContext(clientId, {
        intent: 'general', // Load everything
        useFileSearch: false, // We want the actual data, not just metadata
      });
      console.log(`[CHECKIN-AI] ✅ UserContext loaded: ${userContext.exercises?.all?.length || 0} exercises, ${userContext.consultations?.recent?.length || 0} consultations, ${userContext.goals?.length || 0} goals`);
    } catch (err) {
      console.error(`[CHECKIN-AI] ⚠️ Failed to load userContext for ${clientName}:`, err);
    }
    
    return {
      clientName,
      clientId,
      consultantId,
      consultantName,
      hasFileSearchStore: storeNames.length > 0 && totalDocs > 0,
      storeNames,
      totalDocs,
      userContext,
    };
  } catch (error) {
    console.error('[CHECKIN-AI] Error fetching client context:', error);
    return null;
  }
}

/**
 * Build FULL context string from UserContext - NO TRUNCATION
 * Used only in FALLBACK mode (when File Search is not available)
 */
function buildFullContextForFallback(userContext: UserContext): string {
  const sections: string[] = [];
  
  // 1. CONSULENZE COMPLETE - NESSUN TRONCAMENTO - TUTTE
  if (userContext.consultations?.recent && userContext.consultations.recent.length > 0) {
    const consultationList = userContext.consultations.recent.map(c => {
      let line = `- Data: ${new Date(c.scheduledAt).toLocaleDateString('it-IT')}`;
      if (c.notes) {
        line += `\n  NOTE COMPLETE: "${c.notes}"`;
      }
      if (c.summaryEmail) {
        line += `\n  RIEPILOGO EMAIL COMPLETO: "${c.summaryEmail}"`;
      }
      if (c.transcript) {
        line += `\n  TRASCRIZIONE: "${c.transcript}"`;
      }
      return line;
    }).join('\n\n');
    
    sections.push(`1. CONSULENZE PASSATE (${userContext.consultations.recent.length} totali - TUTTE INCLUSE):
${consultationList}`);
  }
  
  // Prossime consulenze - TUTTE
  if (userContext.consultations?.upcoming && userContext.consultations.upcoming.length > 0) {
    const upcomingList = userContext.consultations.upcoming.map(c => {
      const date = new Date(c.scheduledAt);
      return `- ${date.toLocaleDateString('it-IT')} ore ${date.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })} (${c.duration} min)${c.consultantType ? ` - ${c.consultantType}` : ''}${c.notes ? `\n  Note: ${c.notes}` : ''}`;
    }).join('\n');
    
    sections.push(`PROSSIME CONSULENZE (${userContext.consultations.upcoming.length} totali):
${upcomingList}`);
  }
  
  // 2. TASK DA CONSULENZE - TUTTI
  if (userContext.consultationTasks && userContext.consultationTasks.length > 0) {
    const taskList = userContext.consultationTasks.map(t => {
      const done = t.completed ? '[COMPLETATO]' : '[DA FARE]';
      const priority = t.priority === 'high' ? ' [PRIORITA ALTA]' : '';
      const due = t.dueDate ? ` | Scadenza: ${new Date(t.dueDate).toLocaleDateString('it-IT')}` : '';
      return `${done}${priority} ${t.title}${due}${t.description ? `\n  Descrizione: ${t.description}` : ''}`;
    }).join('\n');
    
    sections.push(`2. TASK ASSEGNATI DA CONSULENZE (${userContext.consultationTasks.length} totali - TUTTI):
${taskList}`);
  }
  
  // 3. ESERCIZI - TUTTI CON FEEDBACK COMPLETO
  if (userContext.exercises?.all && userContext.exercises.all.length > 0) {
    const exerciseList = userContext.exercises.all.map(e => {
      const status = e.status === 'completed' ? '[COMPLETATO]' : e.status === 'in_progress' ? '[IN CORSO]' : '[DA FARE]';
      let line = `${status} ${e.title} (${e.category})`;
      if (e.dueDate) {
        line += ` | Scadenza: ${new Date(e.dueDate).toLocaleDateString('it-IT')}`;
      }
      if (e.score) {
        line += ` | Punteggio: ${e.score}`;
      }
      if (e.completedAt) {
        line += ` | Completato: ${new Date(e.completedAt).toLocaleDateString('it-IT')}`;
      }
      if (e.clientNotes) {
        line += `\n  Note cliente: "${e.clientNotes}"`;
      }
      if (e.consultantFeedback && e.consultantFeedback.length > 0) {
        e.consultantFeedback.forEach((f, i) => {
          line += `\n  Feedback ${i + 1}: "${f.feedback}"`;
        });
      }
      return line;
    }).join('\n\n');
    
    sections.push(`3. ESERCIZI (${userContext.exercises.all.length} totali - TUTTI CON FEEDBACK COMPLETO):
${exerciseList}`);
  }
  
  // 4. OBIETTIVI - TUTTI
  if (userContext.goals && userContext.goals.length > 0) {
    const goalList = userContext.goals.map(g => {
      const status = g.status === 'completed' ? '[RAGGIUNTO]' : '[IN CORSO]';
      const target = g.targetDate ? ` | Target: ${new Date(g.targetDate).toLocaleDateString('it-IT')}` : '';
      return `${status} ${g.title} (Progresso: ${g.currentValue}/${g.targetValue})${target}`;
    }).join('\n');
    
    sections.push(`4. OBIETTIVI (${userContext.goals.length} totali):
${goalList}`);
  }
  
  // 5. TASK GIORNALIERI
  if (userContext.dailyActivity?.todayTasks && userContext.dailyActivity.todayTasks.length > 0) {
    const taskList = userContext.dailyActivity.todayTasks.map(t => {
      const done = t.completed ? '[FATTO]' : '[DA FARE]';
      return `${done} ${t.description}`;
    }).join('\n');
    
    sections.push(`5. TASK DI OGGI (${userContext.dailyActivity.todayTasks.length} totali):
${taskList}`);
  }
  
  // 6. MOMENTUM E PROGRESSI
  if (userContext.momentum) {
    const stats = userContext.momentum.stats || userContext.momentum;
    sections.push(`6. MOMENTUM E PROGRESSI:
- Streak attuale: ${stats.currentStreak || 0} giorni consecutivi
- Check-in produttivi: ${stats.productiveCheckins || 0}/${stats.totalCheckins || 0}
- Tasso produttivita: ${stats.productivityRate || 0}%`);
  }
  
  // 7. RIEPILOGO DASHBOARD
  if (userContext.dashboard) {
    sections.push(`7. RIEPILOGO DASHBOARD:
- Esercizi in sospeso: ${userContext.dashboard.pendingExercises || 0}
- Esercizi completati: ${userContext.dashboard.completedExercises || 0}
- Task di oggi: ${userContext.dashboard.todayTasks || 0}
- Prossime consulenze: ${userContext.dashboard.upcomingConsultations || 0}`);
  }
  
  return sections.join('\n\n');
}

/**
 * Build FILE SEARCH mode prompt - Minimal system prompt, AI uses file_search tool
 */
function buildFileSearchModePrompt(context: ClientCheckinContext): string {
  const consultantRef = context.consultantName 
    ? `Sei ${context.consultantName}, consulente finanziario di ${context.clientName}.`
    : `Sei il consulente finanziario personale di ${context.clientName}.`;

  // Get summary stats from userContext if available
  const stats = context.userContext ? {
    exercises: context.userContext.exercises?.all?.length || 0,
    pendingExercises: context.userContext.dashboard?.pendingExercises || 0,
    completedExercises: context.userContext.dashboard?.completedExercises || 0,
    consultations: context.userContext.consultations?.recent?.length || 0,
    upcomingConsultations: context.userContext.consultations?.upcoming?.length || 0,
    goals: context.userContext.goals?.length || 0,
    tasks: context.userContext.consultationTasks?.length || 0,
  } : null;

  return `${consultantRef}

Stai per inviare un messaggio WhatsApp di check-in settimanale al tuo cliente ${context.clientName}.

═══════════════════════════════════════════════════════════════════
DATI DISPONIBILI VIA FILE SEARCH (${context.totalDocs} documenti indicizzati)
═══════════════════════════════════════════════════════════════════

Hai accesso COMPLETO ai seguenti dati tramite ricerca semantica:
- Tutte le consulenze passate (note complete, riepiloghi, trascrizioni)
- Tutti gli esercizi assegnati (risposte, feedback, punteggi)
- Progressi email journey
- Obiettivi e task
- Documenti della libreria

${stats ? `STATISTICHE RAPIDE:
- Esercizi: ${stats.exercises} totali (${stats.pendingExercises} in sospeso, ${stats.completedExercises} completati)
- Consulenze: ${stats.consultations} passate, ${stats.upcomingConsultations} prossime
- Obiettivi: ${stats.goals}
- Task da consulenze: ${stats.tasks}
` : ''}

IMPORTANTE - USA IL TOOL file_search PER CERCARE I DETTAGLI!
Esempi di query da fare:
- "consulenze recenti ${context.clientName}" per trovare le note delle consulenze
- "esercizi ${context.clientName}" per trovare progressi e feedback
- "obiettivi ${context.clientName}" per trovare gli obiettivi
- "note consulenza ${context.clientName}" per dettagli specifici

═══════════════════════════════════════════════════════════════════

ISTRUZIONI PER IL MESSAGGIO:

1. USA file_search per cercare informazioni SPECIFICHE sul cliente
2. Cita dettagli REALI dalle consulenze e dagli esercizi trovati
3. Genera un messaggio COMPLETO e PERSONALIZZATO (150-300 parole)

Il messaggio deve:
- Riferirsi a DETTAGLI SPECIFICI trovati con file_search
- Menzionare esercizi per NOME
- Citare note delle consulenze passate
- Essere caldo, personale e motivante
- NON avere emoji, saluti formali, o firma

IMPORTANTE: Rispondi SOLO con il messaggio finale, senza virgolette, spiegazioni o prefissi.`;
}

/**
 * Build FALLBACK mode prompt - Full context in system prompt (when File Search not available)
 */
function buildFallbackModePrompt(context: ClientCheckinContext, fullContext: string): string {
  const consultantRef = context.consultantName 
    ? `Sei ${context.consultantName}, consulente finanziario di ${context.clientName}.`
    : `Sei il consulente finanziario personale di ${context.clientName}.`;

  return `${consultantRef}

Stai per inviare un messaggio WhatsApp di check-in settimanale al tuo cliente ${context.clientName}.

═══════════════════════════════════════════════════════════════════
DATI COMPLETI DEL CLIENTE - USA QUESTI PER PERSONALIZZARE IL MESSAGGIO
═══════════════════════════════════════════════════════════════════

${fullContext}

═══════════════════════════════════════════════════════════════════

ISTRUZIONI PER IL MESSAGGIO:

Basandoti sui DATI COMPLETI sopra, genera un messaggio PERSONALIZZATO che:

1. RIFERISCI a dettagli SPECIFICI - esercizi per nome, note delle consulenze, obiettivi
2. MOSTRA che conosci bene il cliente - cita qualcosa di concreto dai dati
3. CHIEDI come sta andando in modo naturale
4. SII MOTIVANTE per i progressi fatti
5. SII DI SUPPORTO per eventuali difficolta

Il messaggio deve essere:
- COMPLETO E DETTAGLIATO (150-300 parole)
- CALDO e PERSONALE
- SPECIFICO - menziona esercizi per NOME, cita note consulenze
- In italiano naturale e colloquiale
- SENZA emoji, SENZA saluti formali, SENZA firma

ESEMPIO BUONO (dettagliato e personalizzato):
"Ho dato un'occhiata ai tuoi progressi e vedo che hai ancora tre esercizi in sospeso: l'analisi del budget mensile, la pianificazione degli obiettivi trimestrali e l'esercizio sulle abitudini di risparmio. So che a volte il tempo e' poco, ma completare questi esercizi ti aiutera' davvero a fare chiarezza sulla tua situazione finanziaria.

Dalla nostra ultima consulenza mi e' rimasto impresso quanto tenevi a migliorare la gestione delle spese - questi esercizi sono proprio pensati per quello. Se hai difficolta' con qualcuno di questi o hai bisogno di chiarimenti, scrivimi pure e ne parliamo insieme.

Come sta andando questa settimana? C'e' qualcosa in particolare su cui vorresti concentrarti?"

ESEMPIO CATTIVO (troppo generico o corto):
- "Ho visto che hai esercizi in sospeso, come va?"
- "Spero che tu stia bene. Come procede tutto?"

IMPORTANTE: Rispondi SOLO con il messaggio finale, senza virgolette, spiegazioni o prefissi.`;
}

/**
 * Generate AI-personalized message for weekly check-in
 * 
 * DUAL MODE ARCHITECTURE (aligned with ai-service.ts):
 * 
 * 1. FILE SEARCH MODE (Primary - when hasFileSearchStore=true):
 *    - Minimal system prompt with statistics only
 *    - AI uses file_search tool to find specific details
 *    - ~90% token savings
 * 
 * 2. FALLBACK MODE (when File Search not available):
 *    - Full context injection (NO TRUNCATION)
 *    - All data included in system prompt
 */
export async function generateCheckinAiMessage(
  context: ClientCheckinContext
): Promise<PersonalizedCheckinResult> {
  try {
    // Get AI provider using proper credential resolution (respects user preferences)
    const providerResult = await getGoogleAIStudioClientForFileSearch(context.consultantId);
    
    if (!providerResult) {
      console.log('[CHECKIN-AI] No AI provider available for File Search');
      return {
        success: false,
        error: 'No AI provider available',
      };
    }

    const { client, metadata } = providerResult;
    
    // Get correct model based on provider (Gemini 3 for Google AI Studio)
    const { model } = getModelWithThinking(metadata.name);

    // DUAL MODE: Determine which mode to use
    const useFileSearchMode = context.hasFileSearchStore && context.storeNames.length > 0 && context.totalDocs > 0;
    
    let systemPrompt: string;
    let fileSearchTool: any = null;
    let userMessage: string;

    if (useFileSearchMode) {
      // ═══════════════════════════════════════════════════════════════════
      // FILE SEARCH MODE: AI uses file_search tool to find details
      // ═══════════════════════════════════════════════════════════════════
      console.log(`[CHECKIN-AI] 🔍 FILE SEARCH MODE: ${context.storeNames.length} stores, ${context.totalDocs} docs`);
      
      systemPrompt = buildFileSearchModePrompt(context);
      fileSearchTool = fileSearchService.buildFileSearchTool(context.storeNames);
      userMessage = `Genera il messaggio di check-in per ${context.clientName}. USA file_search per cercare dettagli specifici sul cliente (consulenze, esercizi, obiettivi) prima di scrivere il messaggio.`;
      
      console.log(`[CHECKIN-AI]   System prompt size: ${systemPrompt.length} chars (minimal - AI will search)`);
      
    } else {
      // ═══════════════════════════════════════════════════════════════════
      // FALLBACK MODE: Full context injection (NO TRUNCATION)
      // ═══════════════════════════════════════════════════════════════════
      console.log(`[CHECKIN-AI] 📋 FALLBACK MODE: Full context injection (File Search not available)`);
      
      if (context.userContext) {
        const fullContext = buildFullContextForFallback(context.userContext);
        systemPrompt = buildFallbackModePrompt(context, fullContext);
        userMessage = `Genera ora il messaggio di check-in personalizzato per ${context.clientName} basandoti sui dati completi forniti sopra.`;
        
        console.log(`[CHECKIN-AI]   Full context size: ${fullContext.length} chars (NO TRUNCATION)`);
        console.log(`[CHECKIN-AI]   System prompt size: ${systemPrompt.length} chars`);
      } else {
        // Questo non dovrebbe mai succedere - userContext viene sempre caricato
        console.error(`[CHECKIN-AI] ❌ ERRORE: userContext non disponibile per ${context.clientName} - questo non dovrebbe mai accadere`);
        return {
          success: false,
          error: 'UserContext non disponibile - impossibile generare messaggio personalizzato',
        };
      }
    }

    console.log(`[CHECKIN-AI] Generating message for ${context.clientName} using ${metadata.name}`);
    console.log(`[CHECKIN-AI]   Mode: ${useFileSearchMode ? 'FILE_SEARCH' : 'FALLBACK'}`);

    const result = await client.generateContent({
      model,
      contents: [{ role: 'user', parts: [{ text: userMessage }] }],
      systemInstruction: { role: 'system', parts: [{ text: systemPrompt }] },
      generationConfig: {
        temperature: 0.9,
        maxOutputTokens: 10000,
      },
      ...(fileSearchTool && { tools: [fileSearchTool] }),
    });

    // Extract text from response
    const aiMessage = result.response.text()?.trim();

    if (!aiMessage) {
      console.log(`[CHECKIN-AI] AI returned empty response for ${context.clientName}`);
      return {
        success: false,
        error: 'AI returned empty response',
      };
    }

    // Log File Search citations if available
    if (fileSearchTool) {
      try {
        const citations = fileSearchService.parseCitations(result);
        if (citations.length > 0) {
          console.log(`[CHECKIN-AI] File Search used ${citations.length} citations:`);
          citations.forEach((c, i) => {
            console.log(`  ${i + 1}. ${c.sourceTitle}`);
          });
        } else {
          console.log(`[CHECKIN-AI] File Search enabled but no citations (using userContext data instead)`);
        }
      } catch (err) {
        // Ignore citation parsing errors
      }
    }

    // Clean up response - remove any quotes, prefixes, or formatting
    let cleanedMessage = aiMessage
      .replace(/^["']|["']$/g, '') // Remove surrounding quotes
      .replace(/^\.+|\.+$/g, '') // Remove leading/trailing dots
      .replace(/^(Messaggio:|Check-in:|Ecco il messaggio:)/i, '') // Remove common prefixes
      .replace(/^(Ciao|Buongiorno|Buonasera|Salve)[,!]?\s*/i, '') // Remove greetings
      .trim();

    // Validate message length - if too short, it might be truncated
    if (cleanedMessage.length < 20) {
      console.log(`[CHECKIN-AI] ⚠️ Message too short (${cleanedMessage.length} chars), might be truncated`);
    }

    console.log(`[CHECKIN-AI] ✅ Generated for ${context.clientName} (${cleanedMessage.length} chars): "${cleanedMessage}"`);

    return {
      success: true,
      aiMessage: cleanedMessage,
      context,
      model,
      usedFileSearch: !!fileSearchTool,
      usedUserContext: !!context.userContext,
    };
  } catch (error: any) {
    console.error('[CHECKIN-AI] Error generating AI message:', error);
    return {
      success: false,
      error: error.message || 'AI generation failed',
    };
  }
}

/**
 * Generate personalized check-in message for a client
 * Returns both the AI phrase and client name for template variables
 */
export async function generateCheckinVariables(
  clientId: string,
  consultantId: string
): Promise<{ name: string; aiMessage: string } | null> {
  const context = await fetchClientContext(clientId, consultantId);
  
  if (!context) {
    return null;
  }

  const result = await generateCheckinAiMessage(context);

  if (!result.success || !result.aiMessage) {
    // Log why we're using fallback
    console.log(`[CHECKIN-AI] ⚠️ Fallback triggered for ${context.clientName}:`);
    console.log(`  success: ${result.success}, aiMessage: ${!!result.aiMessage}`);
    console.log(`  usedUserContext: ${result.usedUserContext}, usedFileSearch: ${result.usedFileSearch}`);
    if (result.error) {
      console.log(`  error: ${result.error}`);
    }
    // Fallback to generic message
    return {
      name: context.clientName,
      aiMessage: 'spero che questa settimana stia andando bene per te',
    };
  }
  
  console.log(`[CHECKIN-AI] ✅ AI generated message for ${context.clientName}: "${result.aiMessage}"`);
  console.log(`[CHECKIN-AI]   Sources: userContext=${result.usedUserContext}, fileSearch=${result.usedFileSearch}`);

  return {
    name: context.clientName,
    aiMessage: result.aiMessage,
  };
}
