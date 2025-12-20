/**
 * Sales Agent Context Builder
 * Uses AI to automatically extract sales agent configuration from client data
 * Powers the "Magic Button" feature
 */

import { db } from "../db";
import { users, consultations, exercises, exerciseAssignments, libraryDocuments, clientLibraryProgress, userFinanceSettings } from "../../shared/schema";
import { eq, and, desc } from "drizzle-orm";
import { getAIProvider, getModelWithThinking, GEMINI_3_THINKING_LEVEL } from "./provider-factory";
import { retryWithBackoff, AiRetryContext } from "./retry-manager";

export interface ExtractedSalesContext {
  displayName?: string;
  businessName?: string;
  businessDescription?: string;
  consultantBio?: string;
  vision?: string;
  mission?: string;
  values?: string[];
  usp?: string;
  targetClient?: string;
  nonTargetClient?: string;
  whatWeDo?: string;
  howWeDoIt?: string;
  yearsExperience?: number;
  clientsHelped?: number;
  resultsGenerated?: string;
  softwareCreated?: Array<{emoji: string; name: string; description: string}>;
  booksPublished?: Array<{title: string; year: string}>;
  caseStudies?: Array<{client: string; result: string}>;
  servicesOffered?: Array<{name: string; description: string; price: string}>;
  guarantees?: string;
}

/**
 * Gather all available client data for context extraction
 * CRITICAL: All queries MUST filter by consultantId to prevent multi-tenant data leaks
 */
async function gatherClientData(clientId: string, consultantId: string): Promise<string> {
  const sections: string[] = [];

  // 1. User profile (verify consultant ownership)
  const user = await db
    .select()
    .from(users)
    .where(eq(users.id, clientId))
    .limit(1);

  if (user.length === 0 || !user[0]) {
    throw new Error(`Client ${clientId} not found`);
  }

  // SECURITY: Verify client belongs to this consultant
  if (user[0].consultantId !== consultantId) {
    throw new Error(`Client ${clientId} does not belong to consultant ${consultantId}`);
  }

  sections.push(`=== PROFILO CLIENTE ===`);
  sections.push(`Nome: ${user[0].firstName} ${user[0].lastName}`);
  sections.push(`Email: ${user[0].email || 'N/A'}`);
  if (user[0].phoneNumber) sections.push(`Telefono: ${user[0].phoneNumber}`);
  sections.push('');

  // 2. Consultations (MUST filter by consultantId for tenant isolation)
  const clientConsultations = await db
    .select()
    .from(consultations)
    .where(and(
      eq(consultations.clientId, clientId),
      eq(consultations.consultantId, consultantId)
    ))
    .orderBy(desc(consultations.scheduledAt));

  if (clientConsultations.length > 0) {
    sections.push(`=== CONSULENZE (${clientConsultations.length}) ===`);
    clientConsultations.forEach((consultation, idx) => {
      sections.push(`\n--- Consulenza ${idx + 1} ---`);
      sections.push(`Data: ${consultation.scheduledAt}`);
      sections.push(`Tipo: ${consultation.consultationType}`);
      if (consultation.notes) {
        sections.push(`Note:\n${consultation.notes}`);
      }
      if (consultation.summary) {
        sections.push(`Riepilogo:\n${consultation.summary}`);
      }
      if (consultation.actionItems && consultation.actionItems.length > 0) {
        sections.push(`Action Items: ${consultation.actionItems.join(', ')}`);
      }
      if (consultation.transcript) {
        sections.push(`Trascrizione (estratto): ${consultation.transcript.substring(0, 500)}...`);
      }
    });
    sections.push('');
  }

  // 3. Exercises (completed ones - MUST filter by consultantId)
  const assignments = await db
    .select({
      exercise: exercises,
      assignment: exerciseAssignments,
    })
    .from(exerciseAssignments)
    .innerJoin(exercises, eq(exerciseAssignments.exerciseId, exercises.id))
    .where(and(
      eq(exerciseAssignments.clientId, clientId),
      eq(exerciseAssignments.consultantId, consultantId)
    ));

  const completedExercises = assignments.filter(a => a.assignment.status === 'completed');

  if (completedExercises.length > 0) {
    sections.push(`=== ESERCIZI COMPLETATI (${completedExercises.length}) ===`);
    completedExercises.forEach((item, idx) => {
      sections.push(`\n--- Esercizio ${idx + 1}: ${item.exercise.title} ---`);
      if (item.exercise.description) {
        sections.push(`Descrizione: ${item.exercise.description}`);
      }
      sections.push(`Status: ${item.assignment.status}`);
      if (item.assignment.score) {
        sections.push(`Punteggio: ${item.assignment.score}`);
      }
    });
    sections.push('');
  }

  // 4. Library Documents (documents that client has accessed/completed)
  const clientDocs = await db
    .select({
      document: libraryDocuments,
      progress: clientLibraryProgress,
    })
    .from(clientLibraryProgress)
    .innerJoin(libraryDocuments, eq(clientLibraryProgress.documentId, libraryDocuments.id))
    .where(and(
      eq(clientLibraryProgress.clientId, clientId),
      eq(libraryDocuments.createdBy, consultantId)
    ));
  const completedDocs = clientDocs.filter(d => d.progress.isRead === true);
  if (completedDocs.length > 0) {
    sections.push(`=== DOCUMENTI COMPLETATI (${completedDocs.length}) ===`);
    completedDocs.forEach((item, idx) => {
      sections.push(`\n--- Documento ${idx + 1}: ${item.document.title} ---`);
      if (item.document.description) {
        sections.push(`Descrizione: ${item.document.description}`);
      }
      if (item.document.content) {
        const preview = item.document.content.substring(0, 300);
        sections.push(`Contenuto (estratto): ${preview}...`);
      }
    });
    sections.push('');
  }
  // 5. Financial Settings (NOTE: Full financial data from Software Orbitale/Percorso Capitale not available in DB)
  // Currently only configuration available, not actual financial metrics
  const financeSettings = await db
    .select()
    .from(userFinanceSettings)
    .where(eq(userFinanceSettings.clientId, clientId))
    .limit(1);
  if (financeSettings.length > 0 && financeSettings[0].isEnabled) {
    sections.push(`=== INTEGRAZIONE FINANZIARIA ===`);
    sections.push(`Sistema: Percorso Capitale (attivo)`);
    sections.push(`Email: ${financeSettings[0].percorsoCapitaleEmail}`);
    sections.push(`Nota: Dati finanziari dettagliati (revenue, expenses, etc.) non disponibili nel database.`);
    sections.push('');
  }

  const combinedData = sections.join('\n');

  if (combinedData.trim().length === 0) {
    return "Nessun dato disponibile per questo cliente.";
  }

  return combinedData;
}

/**
 * Extract sales agent context using AI
 */
export async function extractSalesAgentContext(
  clientId: string,
  consultantId: string
): Promise<ExtractedSalesContext> {
  console.log(`[MagicButton] Extracting context for client ${clientId}...`);

  // Gather all client data (with consultant validation)
  const clientData = await gatherClientData(clientId, consultantId);

  console.log(`[MagicButton] Gathered ${clientData.length} characters of client data`);

  // Get AI provider
  const providerResult = await getAIProvider(clientId, consultantId);
  const client = providerResult.client;
  const provider = providerResult.provider;

  // Build extraction prompt
  const systemPrompt = `Sei un esperto analista di business che aiuta consulenti a configurare agenti di vendita AI.

Il tuo compito è analizzare i dati di un cliente (imprenditore) e estrarre informazioni chiave per configurare un assistente di vendita AI efficace.

Analizza attentamente tutti i dati forniti e rispondi SOLO con un oggetto JSON valido nel seguente formato:

{
  "displayName": "Nome completo del consulente/imprenditore (es: Marco Rossi)",
  "businessName": "Nome dell'attività/business (es: Momentum Coaching)",
  "businessDescription": "Breve descrizione di cosa fa il business in 2-3 frasi",
  "consultantBio": "Bio/presentazione del consulente - chi è, background, esperienza",
  "vision": "Vision del business - dove vuole arrivare nel futuro",
  "mission": "Mission del business - perché esiste, quale problema risolve",
  "values": ["Valore 1", "Valore 2", "Valore 3"],
  "usp": "Unique Selling Proposition - cosa rende unico questo business rispetto ai competitor",
  "targetClient": "Chi aiutiamo - descrizione del cliente ideale (es: imprenditori 35-50 anni con locale fisico)",
  "nonTargetClient": "Chi NON aiutiamo - chi non è il target ideale",
  "whatWeDo": "Cosa facciamo - paragrafo descrittivo dei servizi principali offerti (STRINGA, non array)",
  "howWeDoIt": "Come lo facciamo - paragrafo che spiega il metodo/processo utilizzato (STRINGA, non array)",
  "yearsExperience": 5,
  "clientsHelped": 100,
  "resultsGenerated": "Risultati quantificabili generati (es: €10M+ fatturato clienti)",
  "softwareCreated": [{"emoji": "💻", "name": "Nome Software", "description": "Cosa fa"}],
  "booksPublished": [{"title": "Titolo Libro", "year": "2023"}],
  "caseStudies": [{"client": "Ristorante Da Mario", "result": "+40% fatturato in 6 mesi"}],
  "servicesOffered": [{"name": "Consulenza 1-to-1", "description": "Descrizione servizio", "price": "€5.000"}],
  "guarantees": "Garanzie offerte ai clienti"
}

REGOLE IMPORTANTI:
- Se un campo non può essere determinato dai dati, omettilo completamente dal JSON
- Sii specifico e concreto basandoti sui dati reali forniti
- Non inventare informazioni non presenti nei dati
- Per array vuoti, ometti il campo invece di restituire []
- Restituisci SOLO il JSON, senza testo aggiuntivo prima o dopo`;

  const userPrompt = `Analizza i seguenti dati del cliente ed estrai le informazioni per configurare l'agente di vendita AI:

${clientData}

Ricorda: rispondi SOLO con il JSON richiesto, nient'altro.`;

  // Call AI with retry
  const retryContext: AiRetryContext = {
    conversationId: `magic-button-${clientId}`,
    provider,
    emit: () => {}, // No-op for non-streaming calls
  };

  const { model, useThinking, thinkingLevel } = getModelWithThinking(providerResult.metadata.name);
  console.log(`[AI] Using model: ${model} with thinking: ${useThinking ? thinkingLevel : 'disabled'}`);

  const result = await retryWithBackoff(
    async (attemptCtx) => {
      console.log(`[MagicButton] Calling AI (attempt ${attemptCtx.attempt})...`);
      
      const response = await client.generateContent({
        model,
        contents: [
          {
            role: "user",
            parts: [{ text: userPrompt }],
          },
        ],
        generationConfig: {
          systemInstruction: systemPrompt,
          temperature: 0.3, // Low temperature for more consistent JSON output
          maxOutputTokens: 8192, // Increased to prevent truncation
          ...(useThinking && { thinkingConfig: { thinkingLevel } }),
        },
      });

      return response.response.text();
    },
    retryContext
  );

  console.log(`[MagicButton] AI response received: ${result.length} characters`);

  // Parse JSON response
  let extracted: ExtractedSalesContext;
  try {
    // Remove markdown code blocks if present (```json ... ``` or ``` ... ```)
    let cleanedResult = result.trim();
    cleanedResult = cleanedResult.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
    
    // Try to extract JSON from cleaned response
    const jsonMatch = cleanedResult.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("No JSON found in AI response");
    }
    
    let jsonString = jsonMatch[0];
    
    // Try to fix truncated JSON by completing incomplete arrays/objects
    try {
      extracted = JSON.parse(jsonString);
      console.log(`[MagicButton] Successfully parsed AI response`);
    } catch (parseError) {
      console.warn(`[MagicButton] First parse attempt failed, trying to fix truncated JSON...`);
      
      // Try to fix common truncation issues
      // 1. Incomplete string value at the end
      jsonString = jsonString.replace(/,\s*"[^"]*$/, '');
      
      // 2. Incomplete array at the end
      if (jsonString.match(/\[\s*\{[^\]]*$/)) {
        jsonString = jsonString.replace(/,\s*\{[^\]]*$/, '');
        jsonString += ']';
      }
      
      // 3. Incomplete object at the end
      if (!jsonString.endsWith('}')) {
        const openBraces = (jsonString.match(/\{/g) || []).length;
        const closeBraces = (jsonString.match(/\}/g) || []).length;
        const missingBraces = openBraces - closeBraces;
        
        // Remove last incomplete property
        jsonString = jsonString.replace(/,\s*"[^"]*"\s*:\s*[^,}]*$/, '');
        
        // Close missing braces
        for (let i = 0; i < missingBraces; i++) {
          jsonString += '}';
        }
      }
      
      // Try parsing the fixed JSON
      extracted = JSON.parse(jsonString);
      console.log(`[MagicButton] Successfully parsed AI response after fixing truncation`);
    }
  } catch (error) {
    console.error(`[MagicButton] Failed to parse AI response:`, error);
    console.error(`[MagicButton] Raw response:`, result.substring(0, 1000));
    throw new Error("Failed to parse AI response as JSON");
  }

  // Normalize data: convert arrays to strings for string-only fields
  // This handles cases where AI mistakenly returns arrays instead of strings
  if (Array.isArray(extracted.whatWeDo)) {
    console.warn(`[MagicButton] Converting whatWeDo from array to string`);
    extracted.whatWeDo = (extracted.whatWeDo as string[]).join(', ');
  }
  if (Array.isArray(extracted.howWeDoIt)) {
    console.warn(`[MagicButton] Converting howWeDoIt from array to string`);
    extracted.howWeDoIt = (extracted.howWeDoIt as string[]).join(', ');
  }

  return extracted;
}
