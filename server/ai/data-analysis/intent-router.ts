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

export interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
  toolCalls?: Array<{ toolName: string }>;
}

const INTENT_ROUTER_MODEL = "gemini-2.5-flash-lite";

const ROUTER_PROMPT = `Sei un classificatore di intenti INTELLIGENTE. NON fare analisi, NON generare numeri.

========================
IL TUO COMPITO
========================

RAGIONA sul CONTESTO della conversazione, poi classifica l'intento.
Non basarti solo sulle parole chiave - usa il ragionamento logico.

========================
RAGIONAMENTO INTERNO (NON OUTPUT)
========================

Ragiona INTERNAMENTE prima di classificare:
1. L'utente ha appena ricevuto numeri/aggregazioni? (es: "945 piatti", "fatturato 21.000€")
2. Sta chiedendo dettagli, drill-down, o analisi approfondita di quei numeri?
3. È una continuazione logica dell'analisi precedente?
4. Qual è l'OBIETTIVO REALE dell'utente?

REGOLA D'ORO:
Se l'utente ha appena visto numeri aggregati e chiede "analizzami", "dettagli", "uno per uno", "quali sono", "elenca" → è SEMPRE ANALYTICS (drill-down analitico), MAI data_preview.

IMPORTANTE: Non scrivere il tuo ragionamento. Output SOLO JSON.

========================
INTENT TYPES
========================

ANALYTICS (requires_metrics: true)
- Domande che chiedono numeri specifici o dettagli su numeri già visti
- DRILL-DOWN: dopo aver visto aggregazioni, chiede dettagli → ANALYTICS
- CONFRONTI/RANKING: chi fa più/meno, quale X è il migliore/peggiore → ANALYTICS
- Esempi: "Qual è il fatturato?", "Quanti ordini?", "Analizzami i 945 piatti", "Quali piatti?"
- Parole chiave: quanto, quanti, totale, somma, media, analizzami, dettagli, quali sono
- Pattern RANKING (SEMPRE analytics!):
  * "Chi [verbo] più/meno [qualcosa]?" → aggregazione + ranking
  * "Chi applica più sconti?" → SUM(sconti) GROUP BY operatore ORDER BY DESC
  * "Chi vende di più?" → SUM(vendite) GROUP BY venditore ORDER BY DESC
  * "Quale prodotto costa di più?" → MAX(prezzo) o ranking prezzi
  * "Qual è il piatto più venduto?" → ranking per quantità
- Tool: execute_metric, aggregate_group, compare_periods, filter_data

⚠️ REGOLA CRITICA - ANALYTICS vs STRATEGY:
ANALYTICS = la risposta dipende dai DATI SPECIFICI del cliente
STRATEGY = la risposta sarebbe uguale per qualsiasi business

Se una domanda strategica richiede analizzare i dati del cliente per rispondere, classificala come ANALYTICS perché servono i dati PRIMA del consiglio.

Pattern comuni che richiedono DATI (→ ANALYTICS, NON strategy!):
- "Vale la pena X?" (aprire a pranzo, aggiungere un piatto, fare delivery...)
- "Dovrei eliminare/togliere X?" (un piatto, una categoria, un servizio...)
- "Conviene X?" (fare promozioni, alzare i prezzi, assumere...)
- "È meglio X o Y?" (puntare su Food o Drink, pranzo o cena...)
- "Qual è il mio punto debole/forte?" (richiede analisi comparativa)
- "Come sta andando X?" (il menu, le vendite, i margini...)
- "Cosa funziona/non funziona?" (richiede dati per valutare)

STRATEGY (requires_metrics: false)
- SOLO domande teoriche generiche che NON richiedono dati specifici
- Esempi: "Come si calcola il food cost?", "Quali sono le best practice per un ristorante?"
- Tool: NESSUNO - risposta qualitativa teorica

DATA_PREVIEW (requires_metrics: false)
- SOLO richieste iniziali di vedere dati raw SENZA contesto analitico
- Esempi: "Mostrami le prime 10 righe", "Che dati ci sono?", "Anteprima tabella"
- NON usare se l'utente sta facendo drill-down su numeri precedenti!
- Tool: filter_data, get_schema

CONVERSATIONAL (requires_metrics: false)
- Saluti, ringraziamenti, conferme brevi
- Esempi: "Grazie", "Ok", "Ciao"
- Tool: NESSUNO

========================
ESEMPI DI RAGIONAMENTO
========================

ESEMPIO 1 - DRILL-DOWN ANALITICO:
Contesto: Assistant mostrò "categoria Food: 945 piatti"
Utente: "analizzami uno per uno i 945 piatti della categoria food"
Ragionamento: L'utente ha visto un aggregato (945) e vuole i DETTAGLI. È un drill-down analitico.
→ ANALYTICS (NON data_preview!)

ESEMPIO 2 - PREVIEW INIZIALE:
Contesto: Nessuna conversazione precedente
Utente: "mostrami i dati"
Ragionamento: Prima richiesta, vuole solo vedere cosa c'è. Nessun contesto numerico.
→ DATA_PREVIEW

ESEMPIO 3 - CONTINUAZIONE ANALITICA:
Contesto: Assistant mostrò il fatturato totale
Utente: "ora fammi vedere per mese"
Ragionamento: Sta continuando l'analisi, vuole breakdown temporale.
→ ANALYTICS

ESEMPIO 4 - RANKING/CONFRONTO:
Contesto: Qualsiasi
Utente: "Chi applica più sconti?"
Ragionamento: "Chi [fa] più [X]?" richiede aggregazione + ranking → SEMPRE ANALYTICS.
→ ANALYTICS (requires_metrics: true)

========================
OUTPUT FORMAT
========================

Rispondi SOLO con JSON valido:
{"intent":"analytics","requires_metrics":true,"suggested_tools":["aggregate_group"],"confidence":0.95}`;

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
 * Format conversation history for the router prompt
 */
function formatConversationContext(history: ConversationMessage[]): string {
  if (!history || history.length === 0) {
    return "Nessuna conversazione precedente.";
  }
  
  const formattedMessages = history.slice(-5).map((msg, idx) => {
    const role = msg.role === "user" ? "UTENTE" : "ASSISTANT";
    const toolInfo = msg.toolCalls?.length 
      ? ` [usò: ${msg.toolCalls.map(t => t.toolName).join(", ")}]`
      : "";
    const contentPreview = msg.content.length > 200 
      ? msg.content.substring(0, 200) + "..." 
      : msg.content;
    return `${idx + 1}. ${role}${toolInfo}: ${contentPreview}`;
  });
  
  return formattedMessages.join("\n");
}

/**
 * Pre-classification patterns that are ALWAYS analytics (no AI needed)
 * These patterns require aggregation + ranking and should never be classified as data_preview
 */
const FORCE_ANALYTICS_PATTERNS = [
  /chi\s+(applica|fa|vende|guadagna|spende|perde|incassa|sconta)\s+(più|meno|di più|di meno)/i,
  /chi\s+ha\s+(più|meno|il maggior|il minor)\s+/i,
  /quale?\s+(prodotto|piatto|articolo|cliente|operatore)\s+(costa|vende|rende|guadagna)\s+(di più|di meno|più|meno)/i,
  /qual\s+è\s+il\s+(piatto|prodotto|articolo)\s+(più|meno)\s+(venduto|costoso|redditizio)/i,
  /(top|migliori|peggiori)\s+\d+\s+(prodotti|piatti|clienti|venditori)/i,
  /classifica\s+(dei|delle|di)/i,
  /ranking\s+/i,
];

function preClassifyAnalytics(question: string): IntentRouterOutput | null {
  const questionLower = question.toLowerCase();
  
  for (const pattern of FORCE_ANALYTICS_PATTERNS) {
    if (pattern.test(question)) {
      console.log(`[INTENT-ROUTER] PRE-CLASSIFICATION: Matched analytics pattern: ${pattern}`);
      return {
        intent: "analytics",
        requires_metrics: true,
        suggested_tools: ["aggregate_group"],
        confidence: 0.98,
      };
    }
  }
  
  return null;
}

/**
 * Route user intent using gemini-2.5-flash-lite
 * @param question - User's question to classify
 * @param consultantId - Optional consultant ID for AI client resolution
 * @param conversationHistory - Previous messages for context-aware classification
 * @returns IntentRouterOutput with classification result
 */
export async function routeIntent(
  question: string,
  consultantId?: string,
  conversationHistory?: ConversationMessage[]
): Promise<IntentRouterOutput> {
  const startTime = Date.now();
  console.log(`[INTENT-ROUTER] Classifying question: "${question.substring(0, 80)}${question.length > 80 ? '...' : ''}"`);
  console.log(`[INTENT-ROUTER] Conversation context: ${conversationHistory?.length || 0} messages`);
  
  // FAST PATH: Pre-classify obvious analytics patterns without AI
  const preClassified = preClassifyAnalytics(question);
  if (preClassified) {
    console.log(`[INTENT-ROUTER] Using pre-classification (no AI call needed)`);
    return preClassified;
  }
  
  try {
    const providerResult = await getAIProvider(consultantId || "system", consultantId);
    const client = providerResult.client;
    console.log(`[INTENT-ROUTER] Using provider: ${providerResult.metadata?.name || "unknown"}`);
    
    const contextSection = formatConversationContext(conversationHistory || []);
    const fullPrompt = `========================
CONTESTO CONVERSAZIONE PRECEDENTE
========================
${contextSection}

========================
NUOVA DOMANDA DA CLASSIFICARE
========================
${question}`;
    
    const result = await client.generateContent({
      model: INTENT_ROUTER_MODEL,
      contents: [
        {
          role: "user",
          parts: [{ text: fullPrompt }],
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
