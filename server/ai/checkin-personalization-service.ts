/**
 * Check-in Personalization Service
 * 
 * Generates AI-personalized messages for weekly check-in using File Search.
 * Uses Gemini 3 with the client's PRIVATE File Search store to access
 * ALL their data: consultations, exercises, documents, conversation history.
 * 
 * The AI acts as the consultant's personal assistant, generating messages
 * as if the consultant themselves is reaching out to the client.
 */

import { db } from "../db";
import { users } from "../../shared/schema";
import { eq } from "drizzle-orm";
import { getGoogleAIStudioClientForFileSearch } from "./provider-factory";
import { fileSearchService } from "./file-search-service";

export interface ClientCheckinContext {
  clientName: string;
  clientId: string;
  consultantId: string;
  consultantName?: string;
  hasFileSearchStore: boolean;
  storeNames: string[];
  totalDocs: number;
}

export interface PersonalizedCheckinResult {
  success: boolean;
  aiMessage?: string;
  context?: ClientCheckinContext;
  error?: string;
  model?: string;
  usedFileSearch?: boolean;
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
    
    if (!fileSearchEnabled) {
      console.log(`[CHECKIN-AI] File Search disabled for client ${clientId}`);
      return {
        clientName,
        clientId,
        consultantId,
        consultantName,
        hasFileSearchStore: false,
        storeNames: [],
        totalDocs: 0,
      };
    }

    // Get store breakdown for client - this includes their private store + consultant's stores
    const { storeNames, breakdown } = await fileSearchService.getStoreBreakdownForGeneration(
      clientId,
      'client',
      consultantId
    );
    
    // Calculate total docs across all stores
    const totalDocs = breakdown.reduce((sum, store) => sum + store.totalDocs, 0);
    
    console.log(`[CHECKIN-AI] File Search stores for ${clientName}: ${storeNames.length} stores, ${totalDocs} total docs`);
    if (breakdown.length > 0) {
      breakdown.forEach(store => {
        console.log(`  - ${store.storeDisplayName}: ${store.totalDocs} docs`);
      });
    }
    
    return {
      clientName,
      clientId,
      consultantId,
      consultantName,
      hasFileSearchStore: storeNames.length > 0 && totalDocs > 0,
      storeNames,
      totalDocs,
    };
  } catch (error) {
    console.error('[CHECKIN-AI] Error fetching client context:', error);
    return null;
  }
}

/**
 * Generate AI-personalized message for weekly check-in using File Search
 * 
 * This uses the client's File Search stores to access ALL their data:
 * - Consultations and notes
 * - Exercises assigned and completed
 * - Documents uploaded
 * - Conversation history (WhatsApp, etc)
 * - Financial goals and progress
 * 
 * The AI generates a message as if the consultant themselves is reaching out.
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
    const model = 'gemini-2.5-flash';

    // Build File Search tool if client has stores with documents
    let fileSearchTool: any = null;
    if (context.hasFileSearchStore && context.storeNames.length > 0) {
      fileSearchTool = fileSearchService.buildFileSearchTool(context.storeNames);
      console.log(`[CHECKIN-AI] File Search enabled with ${context.storeNames.length} stores (${context.totalDocs} docs)`);
    } else {
      console.log(`[CHECKIN-AI] File Search NOT available (stores: ${context.storeNames.length}, docs: ${context.totalDocs})`);
    }

    const consultantRef = context.consultantName 
      ? `Sei ${context.consultantName}, consulente finanziario di ${context.clientName}.`
      : `Sei il consulente finanziario personale di ${context.clientName}.`;

    const systemPrompt = `${consultantRef}

Stai per inviare un messaggio WhatsApp di check-in settimanale al tuo cliente.
Hai accesso a TUTTI i dati del cliente: consulenze fatte insieme, esercizi assegnati, documenti, obiettivi finanziari, progressi, conversazioni passate.

ANALIZZA tutto quello che sai su ${context.clientName} e genera un messaggio di check-in PERSONALIZZATO che:

1. RIFERISCI A QUALCOSA DI SPECIFICO che avete discusso o su cui sta lavorando
2. MOSTRA CHE LO CONOSCI BENE - menziona un dettaglio personale o un obiettivo
3. CHIEDI COME STA ANDANDO in modo naturale e genuino
4. SII MOTIVANTE se ha raggiunto traguardi o sta facendo progressi
5. SII DI SUPPORTO se ha difficoltà o è rimasto indietro

Il messaggio deve essere:
- BREVE (2-3 frasi, max 50 parole)
- CALDO e PERSONALE, come se scrivessi a un amico che stai seguendo
- SPECIFICO - evita frasi generiche tipo "come stai?"
- In italiano naturale e colloquiale
- SENZA emoji, SENZA saluti formali (Ciao, Buongiorno)

ESEMPIO BUONO: "Ho visto che hai completato l'esercizio sul budget - ottimo lavoro! Come ti senti con la gestione delle spese questa settimana?"

ESEMPIO CATTIVO: "Spero che tu stia bene. Come procede tutto?"

Rispondi SOLO con il messaggio, senza virgolette o spiegazioni.`;

    // The user message that triggers File Search to retrieve client data
    const userMessage = `Genera un messaggio di check-in settimanale per ${context.clientName}. 
Cerca nei documenti tutto quello che sai su questo cliente: le ultime consulenze, gli esercizi assegnati, i progressi, gli obiettivi finanziari, le conversazioni passate.
Basandoti su questi dati, scrivi un messaggio personalizzato e specifico.`;

    console.log(`[CHECKIN-AI] Generating message for ${context.clientName} using ${metadata.name} (FileSearch: ${!!fileSearchTool})`);

    const result = await client.generateContent({
      model,
      contents: [{ role: 'user', parts: [{ text: userMessage }] }],
      config: {
        systemInstruction: systemPrompt,
        temperature: 0.9,
        maxOutputTokens: 500,
      },
      ...(fileSearchTool && { tools: [fileSearchTool] }),
    });

    const aiMessage = result.text?.trim();

    if (!aiMessage) {
      return {
        success: false,
        error: 'AI returned empty response',
      };
    }

    // Log File Search citations if available
    if (fileSearchTool) {
      const citations = fileSearchService.parseCitations(result);
      if (citations.length > 0) {
        console.log(`[CHECKIN-AI] File Search used ${citations.length} citations:`);
        citations.forEach((c, i) => {
          console.log(`  ${i + 1}. ${c.sourceTitle}`);
        });
      } else {
        console.log(`[CHECKIN-AI] File Search enabled but no citations in response`);
      }
    }

    // Clean up response
    const cleanedMessage = aiMessage
      .replace(/^["']|["']$/g, '')
      .replace(/^\.+|\.+$/g, '')
      .trim();

    console.log(`[CHECKIN-AI] Generated for ${context.clientName}: "${cleanedMessage}"`);

    return {
      success: true,
      aiMessage: cleanedMessage,
      context,
      model,
      usedFileSearch: !!fileSearchTool,
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
    // Fallback to generic message
    return {
      name: context.clientName,
      aiMessage: 'spero che questa settimana stia andando bene per te',
    };
  }

  return {
    name: context.clientName,
    aiMessage: result.aiMessage,
  };
}
