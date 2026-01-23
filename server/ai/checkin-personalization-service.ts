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
 * Build a rich context string from UserContext for the AI prompt
 */
function buildContextFromUserContext(userContext: UserContext): string {
  const sections: string[] = [];
  
  // 1. CONSULENZE (PRIMA) - Passate e prossime
  if (userContext.consultations?.recent && userContext.consultations.recent.length > 0) {
    const recentConsultations = userContext.consultations.recent.slice(0, 5);
    const consultationList = recentConsultations.map(c => {
      let line = `- ${new Date(c.scheduledAt).toLocaleDateString('it-IT')}`;
      if (c.notes) {
        // Mostra più contenuto delle note (300 chars)
        const notesPreview = c.notes.substring(0, 300).replace(/\n/g, ' ');
        line += `:\n  "${notesPreview}${c.notes.length > 300 ? '...' : ''}"`;
      }
      if (c.summaryEmail) {
        const summaryPreview = c.summaryEmail.substring(0, 200).replace(/\n/g, ' ');
        line += `\n  Riepilogo: ${summaryPreview}${c.summaryEmail.length > 200 ? '...' : ''}`;
      }
      return line;
    }).join('\n\n');
    
    sections.push(`1. CONSULENZE PASSATE (${userContext.consultations.recent.length} recenti):
${consultationList}`);
  }
  
  // Prossime consulenze
  if (userContext.consultations?.upcoming && userContext.consultations.upcoming.length > 0) {
    const upcomingList = userContext.consultations.upcoming.slice(0, 3).map(c => {
      const date = new Date(c.scheduledAt);
      return `- ${date.toLocaleDateString('it-IT')} ore ${date.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })} (${c.duration} min)${c.consultantType ? ` - ${c.consultantType}` : ''}`;
    }).join('\n');
    
    sections.push(`PROSSIME CONSULENZE:
${upcomingList}`);
  }
  
  // 2. TASK DA CONSULENZE (compiti assegnati)
  if (userContext.consultationTasks && userContext.consultationTasks.length > 0) {
    const taskList = userContext.consultationTasks.slice(0, 5).map(t => {
      const done = t.completed ? '[COMPLETATO]' : '[DA FARE]';
      const priority = t.priority === 'high' ? ' [PRIORITA ALTA]' : '';
      const due = t.dueDate ? ` | Scadenza: ${new Date(t.dueDate).toLocaleDateString('it-IT')}` : '';
      return `${done}${priority} ${t.title}${due}${t.description ? `\n  ${t.description}` : ''}`;
    }).join('\n');
    
    sections.push(`2. TASK ASSEGNATI DA CONSULENZE (${userContext.consultationTasks.length} totali):
${taskList}`);
  }
  
  // 3. ESERCIZI
  if (userContext.exercises?.all && userContext.exercises.all.length > 0) {
    const exerciseList = userContext.exercises.all.slice(0, 10).map(e => {
      const status = e.status === 'completed' ? '[COMPLETATO]' : e.status === 'in_progress' ? '[IN CORSO]' : '[DA FARE]';
      let line = `${status} ${e.title} (${e.category})`;
      if (e.dueDate) {
        line += ` | Scadenza: ${new Date(e.dueDate).toLocaleDateString('it-IT')}`;
      }
      if (e.score) {
        line += ` | Punteggio: ${e.score}`;
      }
      if (e.consultantFeedback && e.consultantFeedback.length > 0) {
        const lastFeedback = e.consultantFeedback[e.consultantFeedback.length - 1];
        line += `\n  Feedback: "${lastFeedback.feedback.substring(0, 100)}${lastFeedback.feedback.length > 100 ? '...' : ''}"`;
      }
      return line;
    }).join('\n');
    
    sections.push(`3. ESERCIZI (${userContext.exercises.all.length} totali):
${exerciseList}`);
  }
  
  // 4. OBIETTIVI
  if (userContext.goals && userContext.goals.length > 0) {
    const goalList = userContext.goals.slice(0, 5).map(g => {
      const status = g.status === 'completed' ? '[RAGGIUNTO]' : '[IN CORSO]';
      const target = g.targetDate ? ` | Target: ${new Date(g.targetDate).toLocaleDateString('it-IT')}` : '';
      return `${status} ${g.title} (${g.currentValue}/${g.targetValue})${target}`;
    }).join('\n');
    
    sections.push(`4. OBIETTIVI:
${goalList}`);
  }
  
  // 5. MOMENTUM E PROGRESSI
  if (userContext.momentum) {
    const stats = userContext.momentum.stats || userContext.momentum;
    sections.push(`5. MOMENTUM E PROGRESSI:
- Streak attuale: ${stats.currentStreak || 0} giorni consecutivi
- Check-in produttivi: ${stats.productiveCheckins || 0}/${stats.totalCheckins || 0}
- Tasso produttivita: ${stats.productivityRate || 0}%`);
  }
  
  // 6. RIEPILOGO DASHBOARD
  if (userContext.dashboard) {
    sections.push(`6. RIEPILOGO:
- Esercizi in sospeso: ${userContext.dashboard.pendingExercises || 0}
- Esercizi completati: ${userContext.dashboard.completedExercises || 0}
- Task di oggi: ${userContext.dashboard.todayTasks || 0}
- Prossime consulenze: ${userContext.dashboard.upcomingConsultations || 0}`);
  }
  
  return sections.join('\n\n');
}

/**
 * Generate AI-personalized message for weekly check-in
 * 
 * NOW uses buildUserContext() for REAL data (like ai-service.ts)
 * plus File Search as supplemental source.
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

    // Build File Search tool if client has stores with documents (as supplemental source)
    let fileSearchTool: any = null;
    if (context.hasFileSearchStore && context.storeNames.length > 0) {
      fileSearchTool = fileSearchService.buildFileSearchTool(context.storeNames);
      console.log(`[CHECKIN-AI] File Search enabled as supplement with ${context.storeNames.length} stores (${context.totalDocs} docs)`);
    }

    const consultantRef = context.consultantName 
      ? `Sei ${context.consultantName}, consulente finanziario di ${context.clientName}.`
      : `Sei il consulente finanziario personale di ${context.clientName}.`;

    // Build rich context from userContext (PRIMARY DATA SOURCE)
    let clientDataContext = '';
    if (context.userContext) {
      clientDataContext = buildContextFromUserContext(context.userContext);
      console.log(`[CHECKIN-AI] Built rich context from userContext (${clientDataContext.length} chars)`);
    } else {
      console.log(`[CHECKIN-AI] ⚠️ No userContext available, relying only on File Search`);
    }

    const systemPrompt = `${consultantRef}

Stai per inviare un messaggio WhatsApp di check-in settimanale al tuo cliente.

${clientDataContext ? `
═══════════════════════════════════════════════════════════════════
📊 DATI REALI DEL CLIENTE - USA QUESTI PER PERSONALIZZARE IL MESSAGGIO
═══════════════════════════════════════════════════════════════════

${clientDataContext}

═══════════════════════════════════════════════════════════════════
` : ''}

ISTRUZIONI PER IL MESSAGGIO DI CHECK-IN:

Basandoti sui DATI REALI sopra, genera un messaggio di check-in PERSONALIZZATO che:

1. RIFERISCI A QUALCOSA DI SPECIFICO - un esercizio che sta facendo, un obiettivo su cui lavora, una consulenza recente
2. MOSTRA CHE LO CONOSCI BENE - menziona un dettaglio concreto dai dati
3. CHIEDI COME STA ANDANDO in modo naturale e genuino
4. SII MOTIVANTE se ha raggiunto traguardi o sta facendo progressi
5. SII DI SUPPORTO se ha esercizi in ritardo o difficoltà

Il messaggio deve essere:
- COMPLETO E DETTAGLIATO
- CALDO e PERSONALE, come se scrivessi a un cliente che conosci bene
- SPECIFICO - DEVI menzionare TUTTI i dettagli rilevanti dai dati:
  * Esercizi completati o in sospeso (titoli specifici!)
  * Progressi fatti e traguardi raggiunti
  * Riferimenti a consulenze passate se presenti
  * Obiettivi su cui sta lavorando
  * Consigli pratici e incoraggiamento
- In italiano naturale e colloquiale
- SENZA emoji, SENZA saluti formali (Ciao, Buongiorno), SENZA firma

ESEMPIO BUONO (dettagliato e personalizzato):
"Ho dato un'occhiata ai tuoi progressi e vedo che hai ancora tre esercizi in sospeso: l'analisi del budget mensile, la pianificazione degli obiettivi trimestrali e l'esercizio sulle abitudini di risparmio. So che a volte il tempo e' poco, ma completare questi esercizi ti aiutera' davvero a fare chiarezza sulla tua situazione finanziaria.

Dalla nostra ultima consulenza mi e' rimasto impresso quanto tenevi a migliorare la gestione delle spese - questi esercizi sono proprio pensati per quello. Se hai difficolta' con qualcuno di questi o hai bisogno di chiarimenti, scrivimi pure e ne parliamo insieme.

Come sta andando questa settimana? C'e' qualcosa in particolare su cui vorresti concentrarti?"

ESEMPIO CATTIVO (troppo generico o corto):
- "Ho visto che hai esercizi in sospeso, come va?"
- "Spero che tu stia bene. Come procede tutto?"

IMPORTANTE: Rispondi SOLO con il messaggio finale, senza virgolette, senza spiegazioni, senza prefissi.`;

    // User message - simpler since we already have context in system prompt
    const userMessage = context.userContext 
      ? `Genera ora il messaggio di check-in personalizzato per ${context.clientName} basandoti sui dati forniti.`
      : `Genera un messaggio di check-in settimanale per ${context.clientName}. Cerca nei documenti tutto quello che sai su questo cliente per personalizzare il messaggio.`;

    console.log(`[CHECKIN-AI] Generating message for ${context.clientName} using ${metadata.name}`);
    console.log(`[CHECKIN-AI]   - UserContext: ${!!context.userContext}`);
    console.log(`[CHECKIN-AI]   - FileSearch: ${!!fileSearchTool}`);

    const result = await client.generateContent({
      model,
      contents: [{ role: 'user', parts: [{ text: userMessage }] }],
      systemInstruction: { role: 'system', parts: [{ text: systemPrompt }] },
      generationConfig: {
        temperature: 1, // Slightly lower for more focused output
        maxOutputTokens: 10000, // Increased for detailed, personalized messages
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
