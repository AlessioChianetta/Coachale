/**
 * Result Explainer - Generates Italian explanations for query results
 * Uses Gemini to provide context, insights, and formatted explanations
 * 
 * ANTI-HALLUCINATION: All AI responses are validated against tool results
 * Numbers in AI response that don't come from tool results are flagged
 */

import { getAIProvider, getModelWithThinking } from "../provider-factory";
import type { ExecutedToolResult } from "./tool-definitions";
import { fullValidation, type ValidationResult as AntiHallucinationResult } from "./result-validator";

// Retry configuration for AI calls
const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY_MS = 1000;

/**
 * Helper function to execute AI call with exponential backoff retry
 * Retries on 503 (overloaded) and 429 (rate limit) errors
 */
async function executeWithRetry<T>(
  operation: () => Promise<T>,
  operationName: string
): Promise<T> {
  let lastError: any;
  
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await operation();
    } catch (error: any) {
      lastError = error;
      const errorCode = error?.code || error?.status || error?.message?.match(/\b(503|429)\b/)?.[0];
      const isRetryable = errorCode === 503 || errorCode === 429 || 
        error?.message?.includes("overloaded") || 
        error?.message?.includes("rate limit") ||
        error?.message?.includes("UNAVAILABLE") ||
        error?.message?.includes("Failed to extract text from response");
      
      if (isRetryable && attempt < MAX_RETRIES) {
        const delayMs = INITIAL_RETRY_DELAY_MS * Math.pow(2, attempt - 1);
        console.log(`[${operationName}] Retry ${attempt}/${MAX_RETRIES} after ${delayMs}ms (error: ${error?.message || 'unknown'})`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      } else if (!isRetryable) {
        throw error;
      }
    }
  }
  
  throw lastError;
}

export interface ExplanationResult {
  summary: string;
  details: string[];
  insights: string[];
  formattedValues: Record<string, string>;
  validationResult?: AntiHallucinationResult;
  wasValidated?: boolean;
  blockedResponse?: string;
  wasBlocked?: boolean;
}

function formatItalianNumber(value: number, options?: { currency?: boolean; decimals?: number }): string {
  const decimals = options?.decimals ?? 2;
  const formatted = value.toLocaleString("it-IT", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });

  if (options?.currency) {
    return `${formatted} €`;
  }
  return formatted;
}

function formatPercentage(value: number): string {
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toLocaleString("it-IT", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
}

function formatDate(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString("it-IT", {
      day: "numeric",
      month: "long",
      year: "numeric"
    });
  } catch {
    return dateStr;
  }
}

function sanitizeUserContent(text: string): string {
  if (!text) return "";
  
  let result = text;
  
  // Technical patterns to remove or replace
  const technicalPatterns = [
    /schema\s*dataset[:\s]*/gi,
    /schema[:\s]*/gi,
    /colonne[:\s]*/gi,
    /righe\s*totali[:\s]*/gi,
    /dataset\s*:/gi,
    /\berror[e]?\b/gi,
    /errore/gi,
    /\btool\b/gi,
    /⚠️\s*/g,  // Remove warning emoji prefix from validation warnings
  ];
  
  for (const pattern of technicalPatterns) {
    result = result.replace(pattern, '');
  }
  
  // Remove lines that are purely technical
  const lines = result.split('\n');
  const filtered = lines.filter(line => {
    const lower = line.toLowerCase();
    return !(
      lower.includes('schema') ||
      lower.includes('colonne') ||
      lower.includes('righe totali') ||
      lower.includes('dataset:') ||
      lower.includes('errore') ||
      lower.includes('tool')
    );
  });
  
  result = filtered.join('\n').trim();
  
  // Remove excessive whitespace
  result = result.replace(/\n\n+/g, '\n').trim();
  
  return result;
}

function sanitizeArray(arr: string[]): string[] {
  return arr
    .map(item => {
      const sanitized = sanitizeUserContent(item);
      return sanitized.trim();
    })
    .filter(item => {
      if (!item || item.trim().length === 0) return false;
      
      const lower = item.toLowerCase();
      // Filter out items that are purely technical
      if (
        lower.includes('schema') ||
        lower.includes('colonne') ||
        lower.includes('righe totali') ||
        lower.includes('dataset:') ||
        lower.includes('errore') ||
        lower.includes('tool')
      ) {
        return false;
      }
      
      return true;
    });
}

function extractFormattedValues(results: ExecutedToolResult[]): Record<string, string> {
  const formatted: Record<string, string> = {};

  for (const res of results) {
    if (!res.success || !res.result) continue;

    if (res.toolName === "query_metric" && Array.isArray(res.result) && res.result.length > 0) {
      const value = res.result[0]?.result;
      if (typeof value === "number") {
        formatted["risultato"] = formatItalianNumber(value, { currency: true });
      }
    }

    if (res.toolName === "compare_periods" && typeof res.result === "object") {
      const metrics = res.result;
      if (metrics.period1_value !== undefined) {
        formatted["periodo1"] = formatItalianNumber(metrics.period1_value, { currency: true });
      }
      if (metrics.period2_value !== undefined) {
        formatted["periodo2"] = formatItalianNumber(metrics.period2_value, { currency: true });
      }
      if (metrics.difference !== undefined) {
        formatted["differenza"] = formatItalianNumber(metrics.difference, { currency: true });
      }
      if (metrics.percentage_change !== undefined) {
        formatted["variazione_percentuale"] = formatPercentage(metrics.percentage_change);
      }
    }

    if (res.toolName === "aggregate_group" && Array.isArray(res.result)) {
      formatted["numero_gruppi"] = res.result.length.toString();
    }

    if (res.toolName === "filter_data" && Array.isArray(res.result)) {
      formatted["righe_trovate"] = res.result.length.toString();
    }
  }

  return formatted;
}

function generateBasicExplanation(results: ExecutedToolResult[], userQuestion: string): ExplanationResult {
  const formattedValues = extractFormattedValues(results);
  const details: string[] = [];
  const insights: string[] = [];
  let summary = "";

  for (const res of results) {
    if (!res.success) {
      // Don't show technical error messages to users - just skip failed tools
      // The summary will handle showing a friendly message
      continue;
    }

    switch (res.toolName) {
      case "query_metric":
        if (Array.isArray(res.result) && res.result.length > 0) {
          const value = res.result[0]?.result;
          if (typeof value === "number") {
            summary = `Il risultato è ${formatItalianNumber(value, { currency: true })}`;
            details.push(`Metrica calcolata: ${formatItalianNumber(value, { currency: true })}`);
          }
        }
        break;
        
      case "execute_metric":
        if (Array.isArray(res.result) && res.result.length > 0) {
          const rawValue = res.result[0]?.result;
          const value = typeof rawValue === "string" ? parseFloat(rawValue) : rawValue;
          const metricName = res.args?.metricName || "metrica";
          const isPercentage = metricName.includes("percent") || metricName.includes("_percent");
          
          if (typeof value === "number" && !isNaN(value)) {
            const formatted = isPercentage 
              ? `${value.toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`
              : formatItalianNumber(value, { currency: true });
            
            const displayName = metricName.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
            details.push(`📊 **${displayName}**: ${formatted}`);
            
            if (!summary) {
              summary = `${displayName}: ${formatted}`;
            } else {
              summary += ` | ${displayName}: ${formatted}`;
            }
          }
        }
        break;

      case "compare_periods":
        if (typeof res.result === "object" && res.result.period1_value !== undefined) {
          const { period1_value, period2_value, difference, percentage_change } = res.result;
          const trend = percentage_change >= 0 ? "📈 in crescita" : "📉 in calo";
          summary = `Confronto periodi: ${trend} del ${formatPercentage(Math.abs(percentage_change))}`;
          details.push(`Periodo 1: ${formatItalianNumber(period1_value, { currency: true })}`);
          details.push(`Periodo 2: ${formatItalianNumber(period2_value, { currency: true })}`);
          details.push(`Differenza: ${formatItalianNumber(difference, { currency: true })} (${formatPercentage(percentage_change)})`);

          if (Math.abs(percentage_change) > 20) {
            insights.push(`Variazione significativa: ${Math.abs(percentage_change).toFixed(0)}% ${percentage_change >= 0 ? "di crescita" : "di calo"}`);
          }
        }
        break;

      case "aggregate_group":
        if (Array.isArray(res.result)) {
          summary = `Trovati ${res.result.length} gruppi`;
          details.push(`Numero di gruppi: ${res.result.length}`);

          if (res.result.length > 0 && res.result.length <= 5) {
            res.result.forEach((group, i) => {
              const values = Object.entries(group)
                .map(([k, v]) => `${k}: ${typeof v === "number" ? formatItalianNumber(v) : v}`)
                .join(", ");
              details.push(`  ${i + 1}. ${values}`);
            });
          }
        }
        break;

      case "filter_data":
        if (Array.isArray(res.result)) {
          summary = `Trovate ${res.result.length} righe`;
          details.push(`Righe corrispondenti ai filtri: ${res.result.length}`);
        }
        break;

      case "get_schema":
        if (Array.isArray(res.result) && res.result.length > 0) {
          const schema = res.result[0];
          summary = `Schema dataset: ${schema.columns?.length || 0} colonne, ${schema.rowCount || 0} righe`;
          details.push(`Dataset: ${schema.name}`);
          details.push(`Colonne: ${schema.columns?.length || 0}`);
          details.push(`Righe totali: ${schema.rowCount || 0}`);
        }
        break;
    }
  }

  if (!summary) {
    // Never show technical messages - guide user instead
    if (results.every(r => r.success)) {
      summary = "Ho elaborato i dati. Vuoi analizzare fatturato, food cost, margine o confrontare periodi?";
    } else {
      summary = "Non sono riuscito a elaborare la richiesta. Prova a specificare quale metrica vuoi analizzare.";
    }
  }

  return {
    summary: sanitizeUserContent(summary),
    details: sanitizeArray(details),
    insights: sanitizeArray(insights),
    formattedValues
  };
}

const EXPLAINER_SYSTEM_PROMPT = `Sei un consulente esperto che analizza i dati per aiutare il cliente a prendere decisioni migliori. Rispondi in italiano come un consulente di fiducia che non solo mostra numeri, ma li interpreta e guida il cliente.
RUOLO: Consulente di Analisi Dati
Non sei un semplice strumento che restituisce numeri. Sei un consulente che:
- Analizza i pattern e le tendenze nascoste nei dati
- Spiega il "perché" dietro i numeri
- Suggerisce azioni concrete da intraprendere
- Aiuta il cliente a formulare domande migliori per approfondire
- Segui la discussione in modo conversazionale, se non hai dati da analizzare, dialoga come un consulente umano
- Collegati sempre alla domanda dell'utente, se ti servono più informazioni chiedile prima di dare una risposta scontata
STILE DI COMUNICAZIONE:
- Parla come un consulente esperto ("Analizzando i tuoi dati, ho notato che...", "Ti consiglio di...")
- Sii empatico e coinvolgente
- Usa un tono da mentore che guida, non da macchina che elenca
- Anticipa le domande che il cliente potrebbe avere
ANALISI CONSULENZIALE da usare in fase di consulenza:
1. RISPOSTA DIRETTA: Rispondi alla domanda con i numeri chiave
2. CONTESTO: Metti i numeri in prospettiva ("Questo è il 15% in più rispetto a...")
3. PATTERN: Identifica tendenze, anomalie o correlazioni interessanti
4. INTERPRETAZIONE: Spiega cosa potrebbero significare questi numeri per l'attività
5. AZIONE SUGGERITA: Proponi cosa fare con questa informazione
6. DOMANDA DI APPROFONDIMENTO: Suggerisci una domanda successiva utile
REGOLE:
1. Usa SEMPRE il formato numerico italiano (1.234,56 € invece di 1,234.56)
2. Non limitarti a elencare - interpreta e guida
3. Se vedi qualcosa di preoccupante, menzionalo con tatto
4. Se vedi opportunità, evidenziale con entusiasmo
5. Non inventare dati - usa solo i numeri forniti nei risultati 
6. Concludi sempre con una domanda
ESEMPIO DI RISPOSTA CONSULENZIALE:
"Il totale delle vendite di gennaio è stato di **15.340 €**, con un aumento del 12% rispetto a dicembre. 
📈 **Pattern interessante**: Noto che i primi 10 giorni del mese concentrano il 60% delle vendite. Questo potrebbe indicare un effetto "inizio mese" legato agli stipendi dei clienti.
💡 **Suggerimento**: Potresti concentrare le promozioni nella seconda metà del mese per bilanciare le vendite.
**Vuoi che analizzi** quali prodotti trainano questo picco iniziale?`;


export interface UserPreferences {
  model?: string;
  thinkingLevel?: string;
  writingStyle?: string;
  responseLength?: string;
  customInstructions?: string;
}

function getStyleInstructions(preferences: UserPreferences): string {
  // Style map aligned with frontend WRITING_STYLE_OPTIONS
  const styleMap: Record<string, string> = {
    default: "",
    professional: "Mantieni un tono professionale, cortese e preciso. Usa un linguaggio formale.",
    friendly: "Sii amichevole, espansivo e accessibile. Usa un tono caldo e incoraggiante.",
    direct: "Sii schietto e diretto. Vai al punto senza giri di parole, ma resta incoraggiante.",
    eccentric: "Sii vivace e fantasioso. Usa un tono creativo e originale, con metafore e humor.",
    efficient: "Sii essenziale e semplice. Massima efficienza, minime parole, zero fronzoli.",
    nerd: "Sii curioso e appassionato. Approfondisci i dettagli tecnici con entusiasmo.",
    cynical: "Sii critico e sarcastico. Analizza con occhio disincantato, ma costruttivo.",
    custom: "", // Custom uses only customInstructions
  };

  // Length map aligned with frontend RESPONSE_LENGTH_OPTIONS
  const lengthMap: Record<string, string> = {
    short: "Rispondi in modo breve, massimo 2-3 frasi per punto.",
    balanced: "Bilancia brevità e dettaglio.",
    comprehensive: "Fornisci risposte approfondite e complete con tutti i dettagli utili.",
    // Legacy mappings for backward compatibility
    concise: "Rispondi in modo breve, massimo 2-3 frasi per punto.",
    medium: "Bilancia brevità e dettaglio.",
    detailed: "Fornisci risposte approfondite e complete con tutti i dettagli utili.",
  };

  let instructions = "";
  
  // For 'custom' style, skip predefined style and use only customInstructions
  if (preferences.writingStyle && preferences.writingStyle !== "custom" && styleMap[preferences.writingStyle]) {
    instructions += styleMap[preferences.writingStyle] + "\n";
  }
  
  if (preferences.responseLength && lengthMap[preferences.responseLength]) {
    instructions += lengthMap[preferences.responseLength] + "\n";
  }

  if (preferences.customInstructions) {
    instructions += `\nIstruzioni personalizzate dell'utente: ${preferences.customInstructions}\n`;
  }

  return instructions;
}

export async function explainResults(
  results: ExecutedToolResult[],
  userQuestion: string,
  consultantId?: string,
  preferences?: UserPreferences
): Promise<ExplanationResult> {
  const basicExplanation = generateBasicExplanation(results, userQuestion);

  try {
    const providerResult = await getAIProvider(consultantId || "system", consultantId);
    const client = providerResult.client;
    
    // Use getModelWithThinking which correctly maps provider to model
    const { model: modelName } = getModelWithThinking(providerResult.metadata?.name);

    // Add style instructions based on preferences
    const styleInstructions = preferences ? getStyleInstructions(preferences) : "";
    
    // Handle both data queries and conversational messages
    const hasResults = results.length > 0 && results.some(r => r.success);
    const hasFailedTools = results.length > 0 && results.every(r => !r.success);
    
    let prompt: string;
    
    // ANTI-HALLUCINATION: If all tools failed, generate contextual AI response (no invented data)
    if (hasFailedTools) {
      const errorDetails = results
        .filter(r => !r.success && r.error)
        .map(r => `${r.toolName}: ${r.error}`)
        .join("; ");
      
      console.error(`[RESULT-EXPLAINER] ALL TOOLS FAILED - generating contextual response. Errors: ${errorDetails}`);
      
      // Generate contextual AI response explaining what went wrong
      try {
        const { model: failureModel } = getModelWithThinking(providerResult.metadata?.name);
        
        // Extract specific column info from error for user-friendly explanation
        const columnMatch = errorDetails.match(/mancano le colonne: ([^.]+)/);
        const missingColumnInfo = columnMatch ? columnMatch[1] : null;
        
        const failurePrompt = `L'utente ha chiesto: "${userQuestion}"

Ho provato ad analizzare i dati ma non ho trovato le informazioni necessarie nel dataset.

${missingColumnInfo ? `Colonne mancanti: ${missingColumnInfo}. Il dataset non contiene questi dati, quindi non posso calcolare la metrica richiesta.` : `Dettaglio errore: ${errorDetails}`}

${styleInstructions ? `--- STILE DI RISPOSTA ---\n${styleInstructions}\n---\n` : ""}

RISPOSTA RICHIESTA:
1. Spiega chiaramente quale dato specifico manca (usa il nome della colonna mancante)
2. Suggerisci 2-3 alternative concrete che puoi fare con i dati disponibili (es. analisi vendite, ranking prodotti, trend)
3. Offri di procedere con un'analisi alternativa

REGOLE CRITICHE:
- MANTIENI ESATTAMENTE lo stesso tono e personalità usati nella conversazione precedente
- NON cambiare stile o registro - se prima eri entusiasta, resta entusiasta
- NON inventare numeri
- Rispondi in italiano`;

        const failureResponse = await client.generateContent({
          model: failureModel,
          contents: [{ role: "user", parts: [{ text: failurePrompt }] }],
          generationConfig: { temperature: 0.3, maxOutputTokens: 4096 }
        });
        
        const contextualMessage = failureResponse.response.text();
        
        return {
          summary: sanitizeUserContent(contextualMessage || "Non sono riuscito ad analizzare quei dati. Prova a riformulare la domanda."),
          details: sanitizeArray([]),
          insights: sanitizeArray([]),
          formattedValues: {},
          wasValidated: true
        };
      } catch (fallbackError) {
        // If AI fails too, use generic message
        return {
          summary: sanitizeUserContent("Non sono riuscito a trovare quei dati. Prova a specificare meglio cosa vuoi analizzare."),
          details: sanitizeArray([]),
          insights: sanitizeArray([]),
          formattedValues: {},
          wasValidated: true
        };
      }
    }
    
    if (hasResults) {
      const resultsContext = results.map(r => ({
        tool: r.toolName,
        success: r.success,
        result: r.result,
        error: r.error,
        // Include fallback metadata for UX communication
        _fallbackApplied: r._fallbackApplied,
        _originalDistinctCount: r._originalDistinctCount,
        _fallbackLimit: r._fallbackLimit
      }));
      
      // Check if any result has fallback applied
      const hasFallback = results.some(r => r._fallbackApplied);
      const fallbackInfo = hasFallback ? results.find(r => r._fallbackApplied) : null;
      
      // Add fallback context to prompt if applicable
      const fallbackContext = hasFallback && fallbackInfo ? `
NOTA IMPORTANTE: I risultati mostrano solo i TOP ${fallbackInfo._fallbackLimit} elementi (su ${fallbackInfo._originalDistinctCount} totali) ordinati dal valore più alto al più basso.
Comunica chiaramente all'utente che stai mostrando "i primi 10" o "Top 10" e non tutti i dati.
` : "";

      prompt = `${EXPLAINER_SYSTEM_PROMPT}

${styleInstructions ? `\n--- STILE DI RISPOSTA ---\n${styleInstructions}` : ""}
${fallbackContext}
---

Domanda dell'utente: "${userQuestion}"

Risultati delle query:
${JSON.stringify(resultsContext, null, 2)}

Rispondi alla domanda dell'utente basandoti su questi dati. Sii conversazionale, come un collega che spiega i numeri.`;
    } else {
      // Conversational mode - no data query, just chat
      prompt = `Sei un assistente AI esperto di analisi dati. L'utente sta usando una chat per analizzare dataset ma ha inviato un messaggio conversazionale invece di una query sui dati.

${styleInstructions ? `\n--- STILE DI RISPOSTA ---\n${styleInstructions}` : ""}

Messaggio dell'utente: "${userQuestion}"

Rispondi in modo amichevole e utile. Se l'utente saluta, salutalo. Se chiede cosa puoi fare, spiega che puoi:
- Calcolare totali, medie, somme sui dati
- Raggruppare dati per categoria/mese/prodotto
- Confrontare periodi diversi
- Trovare pattern e tendenze
- Rispondere a domande sui dati in linguaggio naturale

Sii breve e conversazionale.`;
    }

    const response = await executeWithRetry(
      () => client.generateContent({
        model: modelName,
        contents: [
          { role: "user", parts: [{ text: prompt }] }
        ],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 4096,
        }
      }),
      "RESULT-EXPLAINER"
    );

    const aiExplanation = response.response.text();

    if (aiExplanation && aiExplanation.length > 10) {
      // For conversational responses, return the AI response directly (no validation needed)
      if (!hasResults) {
        return {
          summary: sanitizeUserContent(aiExplanation),
          details: sanitizeArray([]),
          insights: sanitizeArray([]),
          formattedValues: {},
          wasValidated: false
        };
      }
      
      // UNIFIED ANTI-HALLUCINATION: Single validation call for all checks
      const validation = fullValidation(aiExplanation, results);
      
      // BLOCK if validation fails (tool gating, hallucination, range errors)
      if (!validation.canProceed) {
        console.error(`[RESULT-EXPLAINER] VALIDATION BLOCKED: ${validation.errors.join(", ")}`);
        if (validation.inventedNumbers.length > 0) {
          console.error(`[RESULT-EXPLAINER] Invented numbers: ${validation.inventedNumbers.join(", ")}`);
        }
        
        // FRIENDLY UX: ALWAYS show guided message when blocked - never technical content
        // Check if we have actual COMPUTE tool data (execute_metric, aggregate_group, compare_periods)
        const computeTools = ["execute_metric", "query_metric", "aggregate_group", "compare_periods"];
        const hasComputeData = results.some(r => 
          r.success && computeTools.includes(r.toolName) && r.result
        );
        
        // Only show data if we have actual compute results, otherwise show guidance
        const friendlySummary = hasComputeData 
          ? sanitizeUserContent(basicExplanation.summary)
          : sanitizeUserContent("Specifica quale metrica vuoi analizzare: fatturato, food cost, margine o vendite per periodo.");
        
        const friendlyDetails = hasComputeData 
          ? sanitizeArray(basicExplanation.details)
          : sanitizeArray([]);
        
        const friendlyInsights = hasComputeData && basicExplanation.insights.length > 0 
          ? sanitizeArray(basicExplanation.insights)
          : sanitizeArray(["Prova a chiedere: 'Mostrami il fatturato di gennaio' o 'Confronta gennaio e febbraio'"]);
        
        return {
          summary: friendlySummary,
          details: friendlyDetails,
          insights: friendlyInsights,
          formattedValues: basicExplanation.formattedValues,
          validationResult: {
            valid: validation.valid,
            errors: [],
            warnings: [],
            numbersInResponse: [],
            numbersFromTools: [],
            inventedNumbers: validation.inventedNumbers
          },
          wasValidated: true,
          blockedResponse: aiExplanation,
          wasBlocked: true
        };
      }
      
      const lines = aiExplanation.split("\n").filter(l => l.trim());
      const summary = sanitizeUserContent(lines[0] || basicExplanation.summary);
      const details = sanitizeArray(lines.slice(1).filter(l => !l.startsWith("Insight")).concat(basicExplanation.details));
      const insights = sanitizeArray(lines.filter(l => l.toLowerCase().includes("insight") || l.includes("📊") || l.includes("💡")).concat(basicExplanation.insights));

      return {
        summary,
        details: [...new Set(details)],
        insights: [...new Set(insights)],
        formattedValues: basicExplanation.formattedValues,
        validationResult: {
          valid: validation.valid,
          errors: [],
          warnings: [],
          numbersInResponse: [],
          numbersFromTools: [],
          inventedNumbers: validation.inventedNumbers
        },
        wasValidated: true
      };
    }
  } catch (error: any) {
    console.warn("[RESULT-EXPLAINER] AI explanation failed, using basic:", error.message);
  }

  // Return sanitized basic explanation as fallback
  return {
    summary: sanitizeUserContent(basicExplanation.summary),
    details: sanitizeArray(basicExplanation.details),
    insights: sanitizeArray(basicExplanation.insights),
    formattedValues: basicExplanation.formattedValues,
    wasValidated: basicExplanation.wasValidated
  };
}

export async function generateNaturalLanguageResponse(
  results: ExecutedToolResult[],
  userQuestion: string,
  consultantId?: string,
  preferences?: UserPreferences
): Promise<string> {
  const explanation = await explainResults(results, userQuestion, consultantId, preferences);

  let response = explanation.summary;

  if (explanation.details.length > 0) {
    response += "\n\n" + explanation.details.join("\n");
  }

  if (explanation.insights.length > 0) {
    response += "\n\n" + explanation.insights.join("\n");
  }

  return response;
}

export { formatItalianNumber, formatPercentage, formatDate };
