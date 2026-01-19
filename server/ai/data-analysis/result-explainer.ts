/**
 * Result Explainer - Generates Italian explanations for query results
 * Uses Gemini to provide context, insights, and formatted explanations
 */

import { getAIProvider, getModelWithThinking } from "../provider-factory";
import type { ExecutedToolResult } from "./tool-definitions";

export interface ExplanationResult {
  summary: string;
  details: string[];
  insights: string[];
  formattedValues: Record<string, string>;
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
      details.push(`⚠️ Errore nell'esecuzione di ${res.toolName}: ${res.error}`);
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
    summary = results.every(r => r.success)
      ? "Query eseguita con successo"
      : "Si sono verificati errori durante l'esecuzione";
  }

  return {
    summary,
    details,
    insights,
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

STILE DI COMUNICAZIONE:
- Parla come un consulente esperto ("Analizzando i tuoi dati, ho notato che...", "Ti consiglio di...")
- Sii empatico e coinvolgente
- Usa un tono da mentore che guida, non da macchina che elenca
- Anticipa le domande che il cliente potrebbe avere

ANALISI CONSULENZIALE (sempre presente):
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
5. Non inventare dati, ma fai ipotesi ragionevoli quando appropriato
6. Concludi sempre con un suggerimento pratico o una domanda

ESEMPIO DI RISPOSTA CONSULENZIALE:
"Il totale delle vendite di gennaio è stato di **15.340 €**, con un aumento del 12% rispetto a dicembre. 

📈 **Pattern interessante**: Noto che i primi 10 giorni del mese concentrano il 60% delle vendite. Questo potrebbe indicare un effetto "inizio mese" legato agli stipendi dei clienti.

💡 **Suggerimento**: Potresti concentrare le promozioni nella seconda metà del mese per bilanciare le vendite.

**Vuoi che analizzi** quali prodotti trainano questo picco iniziale?"`;


export interface UserPreferences {
  model?: string;
  thinkingLevel?: string;
  writingStyle?: string;
  responseLength?: string;
  customInstructions?: string;
}

function getStyleInstructions(preferences: UserPreferences): string {
  const styleMap: Record<string, string> = {
    professional: "Mantieni un tono professionale, cortese e preciso. Usa un linguaggio formale.",
    friendly: "Sii amichevole, espansivo e accessibile. Usa un tono caldo e incoraggiante.",
    concise: "Sii estremamente conciso e diretto. Vai dritto al punto senza fronzoli.",
    detailed: "Fornisci spiegazioni dettagliate e complete. Approfondisci ogni aspetto.",
    default: "",
  };

  const lengthMap: Record<string, string> = {
    concise: "Rispondi in modo breve, massimo 2-3 frasi per punto.",
    medium: "Bilancia brevità e dettaglio.",
    detailed: "Fornisci risposte approfondite e complete con tutti i dettagli utili.",
  };

  let instructions = "";
  
  if (preferences.writingStyle && styleMap[preferences.writingStyle]) {
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
    
    let prompt: string;
    if (hasResults) {
      const resultsContext = results.map(r => ({
        tool: r.toolName,
        success: r.success,
        result: r.result,
        error: r.error
      }));

      prompt = `${EXPLAINER_SYSTEM_PROMPT}

${styleInstructions ? `\n--- STILE DI RISPOSTA ---\n${styleInstructions}` : ""}

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

    const response = await client.generateContent({
      model: modelName,
      contents: [
        { role: "user", parts: [{ text: prompt }] }
      ],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 4096,
      }
    });

    const aiExplanation = response.response.text();

    if (aiExplanation && aiExplanation.length > 10) {
      // For conversational responses, return the AI response directly
      if (!hasResults) {
        return {
          summary: aiExplanation,
          details: [],
          insights: [],
          formattedValues: {}
        };
      }
      
      const lines = aiExplanation.split("\n").filter(l => l.trim());
      const summary = lines[0] || basicExplanation.summary;
      const details = lines.slice(1).filter(l => !l.startsWith("Insight")).concat(basicExplanation.details);
      const insights = lines.filter(l => l.toLowerCase().includes("insight") || l.includes("📊") || l.includes("💡")).concat(basicExplanation.insights);

      return {
        summary,
        details: [...new Set(details)],
        insights: [...new Set(insights)],
        formattedValues: basicExplanation.formattedValues
      };
    }
  } catch (error: any) {
    console.warn("[RESULT-EXPLAINER] AI explanation failed, using basic:", error.message);
  }

  return basicExplanation;
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
    response += "\n\n**Dettagli:**\n" + explanation.details.map(d => `• ${d}`).join("\n");
  }

  if (explanation.insights.length > 0) {
    response += "\n\n**Osservazioni:**\n" + explanation.insights.map(i => `💡 ${i}`).join("\n");
  }

  return response;
}

export { formatItalianNumber, formatPercentage, formatDate };
