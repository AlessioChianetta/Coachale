/**
 * Intent Router Agent
 * Classifies user intent using gemini-2.5-flash-lite for fast, cheap routing
 * 
 * This is Layer 1 of the 3-layer pipeline:
 * 1. Router Agent (this file) - Intent classification only
 * 2. Policy Engine - TypeScript rules for tool gating
 * 3. Execution Agent - Actual query execution
 */

import { getAIProvider } from "../provider-factory";

export type IntentType = "analytics" | "strategy" | "data_preview" | "conversational";

export interface IntentRouterOutput {
  intent: IntentType;
  requires_metrics: boolean;
  suggested_tools: string[];
  confidence: number;
}

const INTENT_ROUTER_MODEL = "gemini-2.5-flash-lite";

const ROUTER_PROMPT = `Sei un classificatore di intenti. NON fare analisi, NON generare numeri.

ANALIZZA la domanda dell'utente e restituisci SOLO un JSON con:
- intent: tipo di richiesta
- requires_metrics: se servono numeri dal database
- suggested_tools: tool consigliati (può essere vuoto)
- confidence: confidenza della classificazione (0.0-1.0)

========================
INTENT TYPES
========================

ANALYTICS (requires_metrics: true)
- Domande che chiedono numeri specifici
- Esempi: "Qual è il fatturato?", "Quanti ordini?", "Food cost %", "Ticket medio", "Margine"
- Parole chiave: quanto, quanti, totale, somma, media, percentuale, fatturato, revenue, vendite, costo, margine
- Tool: execute_metric, aggregate_group, compare_periods

STRATEGY (requires_metrics: false)
- Domande consulenziali/strategiche che chiedono consigli
- Esempi: "Come aumento il fatturato?", "Consigli per ridurre i costi", "Come posso migliorare?"
- Parole chiave: come posso, come fare, consigli, suggerimenti, strategie, migliorare, aumentare, ridurre
- Tool: NESSUNO - risposta qualitativa

DATA_PREVIEW (requires_metrics: false)
- Richieste di vedere righe raw del dataset
- Esempi: "Mostrami i dati", "Prime 10 righe", "Lista ordini", "Vedi tabella"
- Parole chiave: mostrami, visualizza, lista, tabella, righe, dati raw, anteprima
- Tool: filter_data SOLO

CONVERSATIONAL (requires_metrics: false)
- Saluti, ringraziamenti, conferme, domande su cosa puoi fare
- Esempi: "Grazie", "Ok", "Ciao", "Perfetto", "Cosa puoi fare?"
- Tool: NESSUNO

========================
REGOLE DI CLASSIFICAZIONE
========================

1. Se la domanda contiene "quanto", "quanti", "qual è il", "calcola" → ANALYTICS
2. Se la domanda contiene "come posso", "consigli", "suggerimenti" → STRATEGY  
3. Se la domanda contiene "mostrami", "visualizza", "lista", "tabella" → DATA_PREVIEW
4. Se è un saluto, ringraziamento o conferma breve → CONVERSATIONAL
5. In caso di dubbio tra ANALYTICS e STRATEGY, preferisci ANALYTICS

========================
OUTPUT FORMAT
========================

Rispondi SOLO con JSON valido, senza markdown o altro testo:
{"intent":"analytics","requires_metrics":true,"suggested_tools":["execute_metric"],"confidence":0.95}`;

function parseRouterResponse(responseText: string): IntentRouterOutput | null {
  try {
    let cleanText = responseText.trim();
    
    if (cleanText.startsWith("```json")) {
      cleanText = cleanText.slice(7);
    } else if (cleanText.startsWith("```")) {
      cleanText = cleanText.slice(3);
    }
    if (cleanText.endsWith("```")) {
      cleanText = cleanText.slice(0, -3);
    }
    cleanText = cleanText.trim();
    
    const jsonMatch = cleanText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.log(`[INTENT-ROUTER] No JSON found in response: "${responseText.substring(0, 100)}..."`);
      return null;
    }
    
    const parsed = JSON.parse(jsonMatch[0]);
    
    const validIntents: IntentType[] = ["analytics", "strategy", "data_preview", "conversational"];
    if (!validIntents.includes(parsed.intent)) {
      console.log(`[INTENT-ROUTER] Invalid intent type: ${parsed.intent}`);
      return null;
    }
    
    return {
      intent: parsed.intent as IntentType,
      requires_metrics: Boolean(parsed.requires_metrics),
      suggested_tools: Array.isArray(parsed.suggested_tools) ? parsed.suggested_tools : [],
      confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0.5,
    };
  } catch (error) {
    console.error(`[INTENT-ROUTER] JSON parse error:`, error);
    console.log(`[INTENT-ROUTER] Raw response: "${responseText.substring(0, 200)}..."`);
    return null;
  }
}

function getDefaultIntent(): IntentRouterOutput {
  return {
    intent: "analytics",
    requires_metrics: true,
    suggested_tools: ["execute_metric"],
    confidence: 0.3,
  };
}

/**
 * Route user intent using gemini-2.5-flash-lite
 * @param question - User's question to classify
 * @param consultantId - Optional consultant ID for AI client resolution
 * @returns IntentRouterOutput with classification result
 */
export async function routeIntent(
  question: string,
  consultantId?: string
): Promise<IntentRouterOutput> {
  const startTime = Date.now();
  console.log(`[INTENT-ROUTER] Classifying question: "${question.substring(0, 80)}${question.length > 80 ? '...' : ''}"`);
  
  try {
    const providerResult = await getAIProvider(consultantId || "system", consultantId);
    const client = providerResult.client;
    console.log(`[INTENT-ROUTER] Using provider: ${providerResult.metadata?.name || "unknown"}`);
    
    const result = await client.generateContent({
      model: INTENT_ROUTER_MODEL,
      contents: [
        {
          role: "user",
          parts: [{ text: question }],
        },
      ],
      generationConfig: {
        temperature: 0.0,
        maxOutputTokens: 256,
      },
      systemInstruction: {
        role: "system",
        parts: [{ text: ROUTER_PROMPT }],
      },
    });
    
    const responseText = result.response.text();
    const elapsed = Date.now() - startTime;
    console.log(`[INTENT-ROUTER] Raw response (${elapsed}ms): ${responseText.substring(0, 150)}${responseText.length > 150 ? '...' : ''}`);
    
    const parsed = parseRouterResponse(responseText);
    
    if (parsed) {
      console.log(`[INTENT-ROUTER] Classification result: intent=${parsed.intent}, requires_metrics=${parsed.requires_metrics}, confidence=${parsed.confidence.toFixed(2)}, tools=[${parsed.suggested_tools.join(', ')}]`);
      return parsed;
    }
    
    console.log(`[INTENT-ROUTER] Parse failed, using default (analytics)`);
    return getDefaultIntent();
    
  } catch (error) {
    const elapsed = Date.now() - startTime;
    console.error(`[INTENT-ROUTER] Error after ${elapsed}ms:`, error);
    console.log(`[INTENT-ROUTER] Falling back to default intent (analytics)`);
    return getDefaultIntent();
  }
}

export { INTENT_ROUTER_MODEL, ROUTER_PROMPT };
