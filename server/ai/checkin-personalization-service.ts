/**
 * Check-in Personalization Service
 * 
 * Generates AI-personalized messages for weekly check-in.
 * Uses File Search (client's PRIVATE store only) + Brand Voice + last 2 consultations.
 * 
 * PRIVACY: Each message generation loads ONLY the target client's private store.
 * Never loads other clients' data. Brand Voice comes from the consultant's config (shared).
 * 
 * The AI acts as the consultant, generating messages with a compelling hook + CTA.
 */

import { db } from "../db";
import { users, leadNurturingConfig } from "../../shared/schema";
import { eq } from "drizzle-orm";
import { getRawGoogleGenAIForFileSearch, getModelWithThinking, trackedGenerateContent } from "./provider-factory";
import { tokenTracker } from "./token-tracker";
import { fileSearchService } from "./file-search-service";
import { buildUserContext, UserContext } from "../ai-context-builder";

export interface BrandVoiceData {
  consultantDisplayName?: string;
  businessName?: string;
  businessDescription?: string;
  consultantBio?: string;
  vision?: string;
  mission?: string;
  values?: string[];
  usp?: string;
  whoWeHelp?: string;
  whatWeDo?: string;
  howWeDoIt?: string;
  yearsExperience?: number;
  clientsHelped?: number;
  resultsGenerated?: string;
  servicesOffered?: { name: string; price: string; description: string }[];
  guarantees?: string;
  personalTone?: string;
  contentPersonality?: string;
  audienceLanguage?: string;
  writingExamples?: string[];
  signaturePhrases?: string[];
  avoidPatterns?: string;
}

export interface ClientCheckinContext {
  clientName: string;
  clientId: string;
  consultantId: string;
  consultantName?: string;
  hasFileSearchStore: boolean;
  storeNames: string[];
  totalDocs: number;
  userContext?: UserContext;
  brandVoice?: BrandVoiceData;
  hasBrandVoice: boolean;
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
 * Shared validator: does a BrandVoiceData object contain enough meaningful content?
 * Used by both fetchClientContext and checkBrandVoiceStatus for consistency.
 */
function hasMeaningfulBrandVoice(bv: BrandVoiceData): boolean {
  const checks = [
    !!bv.personalTone,
    !!(bv.writingExamples?.length),
    !!(bv.signaturePhrases?.length),
    !!bv.businessName,
    !!bv.usp,
    !!bv.consultantDisplayName,
  ];
  return checks.some(Boolean);
}

/**
 * Build brand voice context string from consultant's brand voice data
 * Reuses the pattern from content-ai-service.ts but adapted for WhatsApp tone
 */
function buildBrandVoiceForCheckin(bv: BrandVoiceData): string {
  const sections: string[] = [];

  const identityParts: string[] = [];
  if (bv.businessName) identityParts.push(`Azienda: ${bv.businessName}`);
  if (bv.consultantDisplayName) identityParts.push(`Nome: ${bv.consultantDisplayName}`);
  if (bv.businessDescription) identityParts.push(`Descrizione: ${bv.businessDescription}`);
  if (bv.usp) identityParts.push(`USP: ${bv.usp}`);
  if (bv.whatWeDo) identityParts.push(`Servizi: ${bv.whatWeDo}`);
  if (bv.howWeDoIt) identityParts.push(`Metodo: ${bv.howWeDoIt}`);

  if (identityParts.length > 0) {
    sections.push(`IDENTITÀ CONSULENTE:\n${identityParts.join("\n")}`);
  }

  if (bv.personalTone) {
    sections.push(`TONO DI COMUNICAZIONE (IMITA QUESTO STILE):\n${bv.personalTone}`);
  }

  if (bv.audienceLanguage) {
    sections.push(`REGISTRO LINGUISTICO DEL TARGET:\n${bv.audienceLanguage}`);
  }

  const writingExamples = bv.writingExamples?.filter((ex: string) => ex && ex.trim().length > 0);
  if (writingExamples && writingExamples.length > 0) {
    const examplesText = writingExamples.slice(0, 2).map((ex: string, i: number) => `--- ESEMPIO ${i + 1} ---\n${ex.trim()}`).join("\n\n");
    sections.push(`ESEMPI DI SCRITTURA REALE (REPLICA questo ritmo, vocabolario e struttura):\n${examplesText}`);
  }

  if (bv.signaturePhrases?.length) {
    sections.push(`FRASI FIRMA (integra naturalmente 1 di queste):\n${bv.signaturePhrases.join(" | ")}`);
  }

  if (bv.avoidPatterns) {
    sections.push(`NON FARE MAI:\n${bv.avoidPatterns}`);
  }

  return sections.length > 0 ? sections.join("\n\n") : "";
}

/**
 * Fetch client context + brand voice for check-in message generation
 * PRIVACY: Loads ONLY the target client's private File Search store
 */
export async function fetchClientContext(
  clientId: string,
  consultantId: string
): Promise<ClientCheckinContext | null> {
  try {
    console.log(`[CHECKIN-AI] 🔒 Loading context ONLY for client ${clientId} (consultant: ${consultantId})`);

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

    console.log(`[CHECKIN-AI] 🔒 Target client: ${clientName} (${clientId}) — loading ONLY this client's data`);

    // Load Brand Voice from consultant's lead_nurturing_config
    let brandVoice: BrandVoiceData | undefined;
    let hasBrandVoice = false;
    try {
      const [nurturingConfig] = await db
        .select({ brandVoiceData: leadNurturingConfig.brandVoiceData })
        .from(leadNurturingConfig)
        .where(eq(leadNurturingConfig.consultantId, consultantId))
        .limit(1);

      if (nurturingConfig?.brandVoiceData && Object.keys(nurturingConfig.brandVoiceData).length > 0) {
        brandVoice = nurturingConfig.brandVoiceData as BrandVoiceData;
        hasBrandVoice = hasMeaningfulBrandVoice(brandVoice);
        console.log(`[CHECKIN-AI] ${hasBrandVoice ? '✅' : '⚠️'} Brand Voice ${hasBrandVoice ? 'loaded' : 'exists but incomplete'} for consultant ${consultantId} (${consultantName})`);
      } else {
        console.log(`[CHECKIN-AI] ⚠️ No Brand Voice configured for consultant ${consultantId} — messages will use generic tone`);
      }
    } catch (err) {
      console.log(`[CHECKIN-AI] ⚠️ Failed to load Brand Voice:`, err);
    }

    // PRIVACY: Get File Search store info — scoped to this specific client + consultant's shared knowledge
    // getStoreBreakdownForGeneration returns: client's private stores + consultant's system stores
    // System stores contain general consultant methodology (NOT other clients' data) — this is intentional
    const fileSearchEnabled = client.fileSearchEnabled !== false;
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

        console.log(`[CHECKIN-AI] 🔒 File Search stores for ${clientName} ONLY: ${storeNames.length} stores, ${totalDocs} docs`);
        if (breakdown.length > 0) {
          breakdown.forEach(store => {
            console.log(`  - ${store.storeDisplayName}: ${store.totalDocs} docs (owner: ${store.ownerType})`);
          });
        }
      } catch (err) {
        console.log(`[CHECKIN-AI] File Search not available for ${clientName}, will use userContext only`);
      }
    }

    // PRIVACY: Load user context for THIS client ONLY
    let userContext: UserContext | undefined;
    try {
      console.log(`[CHECKIN-AI] 🔒 Loading userContext for client ${clientId} (${clientName}) ONLY...`);
      userContext = await buildUserContext(clientId, {
        intent: 'general',
        useFileSearch: false,
      });
      console.log(`[CHECKIN-AI] ✅ UserContext loaded for ${clientName}: ${userContext.consultations?.recent?.length || 0} consultations, ${userContext.goals?.length || 0} goals`);
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
      brandVoice,
      hasBrandVoice,
    };
  } catch (error) {
    console.error('[CHECKIN-AI] Error fetching client context:', error);
    return null;
  }
}

/**
 * Build context string from UserContext — focused on consultations + client profile
 * NO exercises (the consultant doesn't talk about "exercises" with clients)
 */
function buildFullContextForFallback(userContext: UserContext): string {
  const sections: string[] = [];

  // 1. LAST 2 CONSULTATIONS — PRIMARY CONTEXT
  if (userContext.consultations?.recent && userContext.consultations.recent.length > 0) {
    const lastTwo = userContext.consultations.recent.slice(0, 2);
    const consultationList = lastTwo.map(c => {
      let line = `- Data: ${new Date(c.scheduledAt).toLocaleDateString('it-IT')}`;
      if (c.notes) {
        line += `\n  NOTE: "${c.notes}"`;
      }
      if (c.summaryEmail) {
        line += `\n  RIEPILOGO: "${c.summaryEmail}"`;
      }
      return line;
    }).join('\n\n');

    sections.push(`ULTIME CONSULENZE (${lastTwo.length}):
${consultationList}`);
  }

  // 2. UPCOMING CONSULTATIONS
  if (userContext.consultations?.upcoming && userContext.consultations.upcoming.length > 0) {
    const upcomingList = userContext.consultations.upcoming.slice(0, 2).map(c => {
      const date = new Date(c.scheduledAt);
      return `- ${date.toLocaleDateString('it-IT')} ore ${date.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}${c.consultantType ? ` - ${c.consultantType}` : ''}`;
    }).join('\n');

    sections.push(`PROSSIME CONSULENZE:
${upcomingList}`);
  }

  // 3. TASKS FROM CONSULTATIONS
  if (userContext.consultationTasks && userContext.consultationTasks.length > 0) {
    const pendingTasks = userContext.consultationTasks.filter(t => !t.completed);
    if (pendingTasks.length > 0) {
      const taskList = pendingTasks.slice(0, 5).map(t => {
        const priority = t.priority === 'high' ? ' [PRIORITA ALTA]' : '';
        return `- ${t.title}${priority}`;
      }).join('\n');

      sections.push(`TASK IN SOSPESO (${pendingTasks.length}):
${taskList}`);
    }
  }

  // 4. GOALS
  if (userContext.goals && userContext.goals.length > 0) {
    const goalList = userContext.goals.map(g => {
      const status = g.status === 'completed' ? '[RAGGIUNTO]' : '[IN CORSO]';
      return `${status} ${g.title} (${g.currentValue}/${g.targetValue})`;
    }).join('\n');

    sections.push(`OBIETTIVI:
${goalList}`);
  }

  // 5. MOMENTUM (brief)
  if (userContext.momentum) {
    const stats = userContext.momentum.stats || userContext.momentum;
    if (stats.currentStreak > 0) {
      sections.push(`MOMENTUM: ${stats.currentStreak} giorni consecutivi, produttivita ${stats.productivityRate || 0}%`);
    }
  }

  return sections.join('\n\n');
}

/**
 * Common message instructions shared between both prompt modes
 */
function getMessageInstructions(context: ClientCheckinContext): string {
  return `STRUTTURA OBBLIGATORIA DEL MESSAGGIO:

1. HOOK (prima riga) — Cattura l'attenzione subito. Deve essere specifico e personale.
   Esempi di hook efficaci:
   - "Mi e' rimasta in mente una cosa dalla nostra ultima call..."
   - "Ho riflettuto su quello che mi hai detto riguardo a [tema specifico]..."
   - "Stavo pensando al tuo percorso con [obiettivo specifico]..."
   - "Sai cosa mi ha colpito dell'ultimo periodo?"

2. CORPO — 2-3 frasi che dimostrano che conosci il cliente. Cita 1-2 dettagli SPECIFICI dalle consulenze recenti o dal suo profilo (cosa fa, i suoi obiettivi, le sue sfide). MAI parlare di "esercizi" — il cliente non li chiama cosi.

3. CTA (ultima riga) — Chiudi con una domanda o proposta specifica che invita a rispondere.
   Esempi di CTA efficaci:
   - "Ti va di sentirci questa settimana per fare il punto?"
   - "C'e' qualcosa su cui ti piacerebbe lavorare nel prossimo incontro?"
   - "Hai 5 minuti per aggiornarmi su come sta andando con [tema]?"
   - "Dimmi, come ti senti rispetto a [obiettivo]?"

REGOLE TASSATIVE:
- Lunghezza: 600-1000 caratteri (un vero messaggio WhatsApp sostanzioso ma non un muro)
- Tono: CONVERSAZIONALE, come un messaggio reale tra due persone che si conoscono
- NESSUN emoji
- NESSUN saluto formale (Ciao, Buongiorno, Gentile) — parti diretto con l'hook
- NESSUNA firma
- Italiano naturale e colloquiale — frasi brevi, ritmo scorrevole
- Il messaggio deve sembrare scritto da un umano, NON da un'AI
- NON usare MAI la parola "esercizi" o "esercizio" — parla di "attivita", "lavoro", "percorso", "quello che stiamo facendo"

IMPORTANTE: Rispondi SOLO con il messaggio finale, senza virgolette, spiegazioni o prefissi.`;
}

/**
 * Build FILE SEARCH mode prompt
 * PRIVACY: storeNames contain ONLY the target client's stores
 */
function buildFileSearchModePrompt(context: ClientCheckinContext): string {
  const consultantRef = context.consultantName
    ? `Sei ${context.consultantName}, consulente di ${context.clientName}.`
    : `Sei il consulente personale di ${context.clientName}.`;

  const brandVoiceSection = context.brandVoice
    ? `\n═══════════════════════════════════════════════════════════════════
IL TUO STILE DI COMUNICAZIONE (Brand Voice)
═══════════════════════════════════════════════════════════════════

${buildBrandVoiceForCheckin(context.brandVoice)}
`
    : '';

  const lastTwoConsultations = context.userContext?.consultations?.recent?.slice(0, 2);
  let consultationContext = '';
  if (lastTwoConsultations && lastTwoConsultations.length > 0) {
    const entries = lastTwoConsultations.map(c => {
      let line = `- ${new Date(c.scheduledAt).toLocaleDateString('it-IT')}`;
      if (c.notes) line += `: "${c.notes.substring(0, 500)}"`;
      if (c.summaryEmail) line += `\n  Riepilogo: "${c.summaryEmail.substring(0, 500)}"`;
      return line;
    }).join('\n');
    consultationContext = `\nULTIME 2 CONSULENZE (usa questi dettagli nel messaggio):\n${entries}\n`;
  }

  return `${consultantRef}
${brandVoiceSection}
═══════════════════════════════════════════════════════════════════
PROFILO CLIENTE via File Search (${context.totalDocs} documenti PRIVATI di ${context.clientName})
═══════════════════════════════════════════════════════════════════

Hai accesso al profilo PRIVATO di ${context.clientName} tramite file_search:
- Consulenze passate, note e riepiloghi
- Obiettivi e progressi
- Profilo personale e attivita
${consultationContext}
USA file_search per cercare:
- "consulenze recenti ${context.clientName}" — per trovare note specifiche
- "obiettivi ${context.clientName}" — per trovare su cosa sta lavorando
- "profilo ${context.clientName}" — per capire cosa fa e le sue sfide

═══════════════════════════════════════════════════════════════════

${getMessageInstructions(context)}`;
}

/**
 * Build FALLBACK mode prompt — full context injection
 * PRIVACY: context contains ONLY the target client's data
 */
function buildFallbackModePrompt(context: ClientCheckinContext, fullContext: string): string {
  const consultantRef = context.consultantName
    ? `Sei ${context.consultantName}, consulente di ${context.clientName}.`
    : `Sei il consulente personale di ${context.clientName}.`;

  const brandVoiceSection = context.brandVoice
    ? `\n═══════════════════════════════════════════════════════════════════
IL TUO STILE DI COMUNICAZIONE (Brand Voice)
═══════════════════════════════════════════════════════════════════

${buildBrandVoiceForCheckin(context.brandVoice)}
`
    : '';

  return `${consultantRef}
${brandVoiceSection}
═══════════════════════════════════════════════════════════════════
DATI DEL CLIENTE ${context.clientName.toUpperCase()} — USA QUESTI PER PERSONALIZZARE
═══════════════════════════════════════════════════════════════════

${fullContext}

═══════════════════════════════════════════════════════════════════

${getMessageInstructions(context)}

ESEMPIO DI MESSAGGIO EFFICACE:

"Mi e' rimasta in mente una cosa dalla nostra ultima call — quando mi hai parlato di come stai gestendo [tema specifico dalla consulenza]. Ho notato che stai facendo progressi importanti, soprattutto su [dettaglio specifico].

Pero' c'e' un aspetto che secondo me meriterebbe un po' piu' di attenzione: [task o obiettivo specifico]. Non e' urgente, ma potrebbe davvero fare la differenza nel prossimo mese.

Ti va di dedicarci 15 minuti la prossima volta che ci sentiamo? Oppure se preferisci, scrivimi qui cosa ne pensi e ne parliamo."

ESEMPIO CATTIVO (generico — NON fare cosi):
- "Come stai? Come procede tutto?"
- "Volevo farti un check-in veloce, spero tutto bene"`;
}

/**
 * Generate AI-personalized message for weekly check-in
 * 
 * DUAL MODE:
 * 1. FILE SEARCH MODE — when client has private store with docs
 * 2. FALLBACK MODE — full context injection when File Search unavailable
 * 
 * PRIVACY: Both modes load ONLY the target client's data
 */
export async function generateCheckinAiMessage(
  context: ClientCheckinContext
): Promise<PersonalizedCheckinResult> {
  try {
    const providerResult = await getRawGoogleGenAIForFileSearch(context.consultantId);

    if (!providerResult) {
      console.log('[CHECKIN-AI] No AI provider available for File Search');
      return {
        success: false,
        error: 'No AI provider available',
      };
    }

    const { ai, metadata } = providerResult;
    const { model } = getModelWithThinking(metadata.name);

    const useFileSearchMode = context.hasFileSearchStore && context.storeNames.length > 0 && context.totalDocs > 0;

    let systemPrompt: string;
    let fileSearchTool: any = null;
    let userMessage: string;

    if (useFileSearchMode) {
      console.log(`[CHECKIN-AI] 🔍 FILE SEARCH MODE: ${context.storeNames.length} stores, ${context.totalDocs} docs (client ${context.clientId} ONLY)`);
      console.log(`[CHECKIN-AI] 🔒 Store names: ${context.storeNames.join(', ')}`);

      systemPrompt = buildFileSearchModePrompt(context);
      fileSearchTool = fileSearchService.buildFileSearchTool(context.storeNames);
      userMessage = `Genera un messaggio WhatsApp di check-in per ${context.clientName}. USA file_search per cercare il profilo e le consulenze recenti del cliente, poi scrivi un messaggio con hook iniziale + dettagli personali + CTA finale.`;

      console.log(`[CHECKIN-AI]   System prompt size: ${systemPrompt.length} chars`);
      console.log(`[CHECKIN-AI]   Brand Voice: ${context.hasBrandVoice ? 'YES' : 'NO'}`);

    } else {
      console.log(`[CHECKIN-AI] 📋 FALLBACK MODE: Full context injection (client ${context.clientId} ONLY)`);

      if (context.userContext) {
        const fullContext = buildFullContextForFallback(context.userContext);
        systemPrompt = buildFallbackModePrompt(context, fullContext);
        userMessage = `Genera un messaggio WhatsApp di check-in per ${context.clientName} basandoti sui dati forniti. Il messaggio deve avere: hook personale all'inizio, 1-2 dettagli specifici dal suo percorso, e una CTA che invita a rispondere.`;

        console.log(`[CHECKIN-AI]   Full context size: ${fullContext.length} chars`);
        console.log(`[CHECKIN-AI]   System prompt size: ${systemPrompt.length} chars`);
        console.log(`[CHECKIN-AI]   Brand Voice: ${context.hasBrandVoice ? 'YES' : 'NO'}`);
      } else {
        console.error(`[CHECKIN-AI] ❌ userContext non disponibile per ${context.clientName}`);
        return {
          success: false,
          error: 'UserContext non disponibile',
        };
      }
    }

    console.log(`[CHECKIN-AI] Generating message for ${context.clientName} using ${metadata.name}`);

    const response = await trackedGenerateContent(ai, {
      model,
      contents: [{ role: 'user', parts: [{ text: userMessage }] }],
      config: {
        systemInstruction: systemPrompt,
        temperature: 0.9,
        maxOutputTokens: 10000,
        ...(fileSearchTool && { tools: [fileSearchTool] }),
      },
    } as any, { consultantId: context.consultantId, feature: 'checkin-personalization', keySource: 'superadmin' });

    const aiMessage = response.text?.trim() || '';

    if (!aiMessage) {
      console.log(`[CHECKIN-AI] AI returned empty response for ${context.clientName}`);
      return {
        success: false,
        error: 'AI returned empty response',
      };
    }

    if (fileSearchTool) {
      try {
        const citations = fileSearchService.parseCitations(response);
        if (citations.length > 0) {
          console.log(`[CHECKIN-AI] File Search used ${citations.length} citations:`);
          citations.forEach((c, i) => {
            console.log(`  ${i + 1}. ${c.sourceTitle}`);
          });
        }
      } catch (err) {
        // Ignore citation parsing errors
      }
    }

    let cleanedMessage = aiMessage
      .replace(/^["']|["']$/g, '')
      .replace(/^\.+|\.+$/g, '')
      .replace(/^(Messaggio:|Check-in:|Ecco il messaggio:)/i, '')
      .replace(/^(Ciao|Buongiorno|Buonasera|Salve)[,!]?\s*/i, '')
      .trim();

    if (cleanedMessage.length < 50) {
      console.log(`[CHECKIN-AI] ⚠️ Message too short (${cleanedMessage.length} chars)`);
    }

    console.log(`[CHECKIN-AI] ✅ Generated for ${context.clientName} (${cleanedMessage.length} chars): "${cleanedMessage.substring(0, 100)}..."`);

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
    console.log(`[CHECKIN-AI] ⚠️ Fallback triggered for ${context.clientName}:`);
    console.log(`  success: ${result.success}, aiMessage: ${!!result.aiMessage}`);
    console.log(`  usedUserContext: ${result.usedUserContext}, usedFileSearch: ${result.usedFileSearch}`);
    if (result.error) {
      console.log(`  error: ${result.error}`);
    }
    return {
      name: context.clientName,
      aiMessage: 'spero che questa settimana stia andando bene per te',
    };
  }

  console.log(`[CHECKIN-AI] ✅ AI generated message for ${context.clientName}: "${result.aiMessage.substring(0, 100)}..."`);
  console.log(`[CHECKIN-AI]   Sources: userContext=${result.usedUserContext}, fileSearch=${result.usedFileSearch}, brandVoice=${context.hasBrandVoice}`);

  return {
    name: context.clientName,
    aiMessage: result.aiMessage,
  };
}

/**
 * Check if a consultant has Brand Voice configured
 * Used by frontend to show warning when missing
 */
export async function checkBrandVoiceStatus(consultantId: string): Promise<{
  hasBrandVoice: boolean;
  fields: string[];
}> {
  try {
    const [config] = await db
      .select({ brandVoiceData: leadNurturingConfig.brandVoiceData })
      .from(leadNurturingConfig)
      .where(eq(leadNurturingConfig.consultantId, consultantId))
      .limit(1);

    if (!config?.brandVoiceData || Object.keys(config.brandVoiceData).length === 0) {
      return { hasBrandVoice: false, fields: [] };
    }

    const bv = config.brandVoiceData as BrandVoiceData;
    const populatedFields: string[] = [];
    if (bv.personalTone) populatedFields.push('personalTone');
    if (bv.writingExamples?.length) populatedFields.push('writingExamples');
    if (bv.signaturePhrases?.length) populatedFields.push('signaturePhrases');
    if (bv.businessName) populatedFields.push('businessName');
    if (bv.usp) populatedFields.push('usp');
    if (bv.consultantDisplayName) populatedFields.push('consultantDisplayName');

    return {
      hasBrandVoice: hasMeaningfulBrandVoice(bv),
      fields: populatedFields,
    };
  } catch (error) {
    console.error('[CHECKIN-AI] Error checking brand voice status:', error);
    return { hasBrandVoice: false, fields: [] };
  }
}
