/**
 * Query Planner using Gemini Function Calling
 * Analyzes user questions and plans which tools to use
 */

import { getAIProvider, getModelWithThinking } from "../provider-factory";
import { dataAnalysisTools, type ToolCall, type ExecutedToolResult, validateToolCall, getToolByName } from "./tool-definitions";
import { queryMetric, filterData, aggregateGroup, comparePeriods, getSchema, executeMetricSQL, getDistinctCount, checkCardinalityBeforeAggregate, validateFiltersApplied, MAX_GROUP_BY_LIMIT, type QueryResult, type CardinalityCheckResult } from "../../services/client-data/query-executor";
import { parseMetricExpression, validateMetricAgainstSchema } from "../../services/client-data/metric-dsl";
import { db } from "../../db";
import { clientDataDatasets } from "../../../shared/schema";
import { eq } from "drizzle-orm";
// NOTE: classifyIntent and ForceToolRetryError are deprecated - using Router Agent instead
import { getConversationalReply } from "./intent-classifier";
import { routeIntent, type IntentRouterOutput, type ConversationMessage } from "./intent-router";
import { enforcePolicyOnToolCalls, getPolicyForIntent, POLICY_RULES, validateAnalyticsToolCalls, COMPUTE_TOOLS as POLICY_COMPUTE_TOOLS, type IntentType } from "./policy-engine";
import { getMetricDefinition, getMetricDescriptionsForPrompt, isValidMetricName, resolveMetricSQLForDataset } from "./metric-registry";
import { METRIC_ENUM as TOOL_METRIC_ENUM } from "./tool-definitions";
import { forceMetricFromTerms } from "./term-mapper";
import { validateMetricForDataset } from "./pre-validator";
import { checkAnalyticsEnabled } from "../../services/client-data/semantic-mapping-service";

/**
 * TASK 2: Semantic Contract Detection
 * Detects if user requests "ALL items" vs "top N"
 */
export interface SemanticContract {
  requestsAll: boolean;
  requestsTopN: boolean;
  topNValue?: number;
  detectedKeywords: string[];
  detectedFilters: { column: string; value: string }[];
}

const ALL_KEYWORDS = [
  "uno per uno", "tutti", "ogni", "ciascun", "ognuno", "singolarmente",
  "each", "all", "one by one", "every", "all of them", "complete list",
  "lista completa", "elenco completo", "tutti quanti", "nel dettaglio"
];

const TOP_N_PATTERNS = [
  /\btop\s*(\d+)\b/i,
  /\bprimi?\s*(\d+)\b/i,
  /\bmigliori?\s*(\d+)\b/i,
  /\bpeggiori?\s*(\d+)\b/i,
  /\bultimi?\s*(\d+)\b/i,
  /\bmax(?:imum)?\s*(\d+)\b/i,
];

const FILTER_PATTERNS = [
  { pattern: /\bcategoria\s+["']?(\w+)["']?\b/i, column: "categoria" },
  { pattern: /\bcat(?:egory)?\s*[=:]\s*["']?(\w+)["']?\b/i, column: "category" },
  { pattern: /\btipo\s+["']?(\w+)["']?\b/i, column: "tipo" },
  { pattern: /\btype\s+["']?(\w+)["']?\b/i, column: "type" },
  { pattern: /\bdella\s+categoria\s+["']?(\w+)["']?\b/i, column: "categoria" },
];

export function detectSemanticContract(userQuestion: string): SemanticContract {
  const questionLower = userQuestion.toLowerCase();
  const detectedKeywords: string[] = [];
  const detectedFilters: { column: string; value: string }[] = [];
  let requestsAll = false;
  let requestsTopN = false;
  let topNValue: number | undefined;

  for (const keyword of ALL_KEYWORDS) {
    if (questionLower.includes(keyword.toLowerCase())) {
      detectedKeywords.push(keyword);
      requestsAll = true;
    }
  }

  for (const pattern of TOP_N_PATTERNS) {
    const match = questionLower.match(pattern);
    if (match) {
      requestsTopN = true;
      topNValue = parseInt(match[1], 10);
      detectedKeywords.push(match[0]);
      break;
    }
  }

  for (const { pattern, column } of FILTER_PATTERNS) {
    const match = userQuestion.match(pattern);
    if (match && match[1]) {
      detectedFilters.push({ column, value: match[1] });
    }
  }

  if (requestsAll && detectedKeywords.length > 0) {
    console.log(`[SEMANTIC-CONTRACT] Detected "ALL items" request: keywords=[${detectedKeywords.join(", ")}]`);
  }
  if (requestsTopN && topNValue) {
    console.log(`[SEMANTIC-CONTRACT] Detected "top N" request: N=${topNValue}`);
  }
  if (detectedFilters.length > 0) {
    console.log(`[SEMANTIC-CONTRACT] Detected filters: ${JSON.stringify(detectedFilters)}`);
  }

  return {
    requestsAll,
    requestsTopN,
    topNValue,
    detectedKeywords,
    detectedFilters,
  };
}

/**
 * TASK 4: Extract mentioned filters from user question
 * Used to inject missing filters before execution
 */
export function extractFiltersFromQuestion(
  userQuestion: string,
  availableColumns: string[]
): Record<string, { operator: string; value: string }> {
  const filters: Record<string, { operator: string; value: string }> = {};
  const questionLower = userQuestion.toLowerCase();

  const columnAliases: Record<string, string[]> = {
    "categoria": ["categoria", "category", "cat"],
    "tipo": ["tipo", "type"],
    "status": ["stato", "status"],
  };

  for (const { pattern, column } of FILTER_PATTERNS) {
    const match = userQuestion.match(pattern);
    if (match && match[1]) {
      const actualColumn = availableColumns.find(c => {
        const cLower = c.toLowerCase();
        if (cLower === column.toLowerCase()) return true;
        const aliases = columnAliases[column.toLowerCase()] || [];
        return aliases.some(alias => cLower.includes(alias));
      });

      if (actualColumn) {
        filters[actualColumn] = { operator: "=", value: match[1] };
        console.log(`[FILTER-EXTRACT] Found filter: ${actualColumn} = "${match[1]}"`);
      }
    }
  }

  return filters;
}

interface DatasetInfo {
  id: string;
  name: string;
  columns: { name: string; displayName: string; dataType: string; description?: string }[];
  rowCount: number;
  metrics?: { name: string; dslFormula: string; description?: string }[];
}

export interface QueryPlan {
  steps: ToolCall[];
  reasoning: string;
  estimatedComplexity: "simple" | "medium" | "complex";
}

export interface QueryExecutionResult {
  plan: QueryPlan;
  results: ExecutedToolResult[];
  success: boolean;
  totalExecutionTimeMs: number;
}

interface ToolCallValidationResult {
  valid: boolean;
  errors: string[];
  repairedToolCall?: ToolCall;
}

const MAX_PLANNING_RETRIES = 2;

const SYSTEM_PROMPT_IT = `Sei un assistente AI specializzato in analytics deterministici su database.

Il tuo compito è:
1) Pianificare le query
2) Chiamare i tool corretti
3) Restituire SOLO risultati verificabili dai tool

========================
REGOLE FONDAMENTALI
========================

1) VERITÀ NUMERICA (OBBLIGATORIA)
- Se la risposta contiene numeri, valute (€), percentuali (%) o KPI:
  DEVI chiamare almeno un tool compute (execute_metric / aggregate_group / compare_periods).
- NON generare MAI numeri autonomamente.
- NON fare stime, proiezioni o arrotondamenti creativi.

2) NO SOSTITUZIONE METRICHE
- Se una metrica richiesta non è disponibile (es: manca customer_id):
  NON sostituirla con un’altra metrica simile.
  Rispondi: "Impossibile calcolare: dati insufficienti."


========================
DATI MANCANTI - ONESTÀ OBBLIGATORIA
========================

PRIMA di rispondere, verifica che le colonne necessarie ESISTANO nel dataset.
Se la domanda richiede dati che NON sono presenti nelle colonne:
- NON inventare risposte
- NON fare assunzioni
- Rispondi ONESTAMENTE: "Per rispondere mi servirebbero i dati di [X], che non sono presenti nel dataset."

Esempi OBBLIGATORI:
- "Vendite a pranzo/cena/notte?" → Se non c'è colonna orario/timestamp: "Non ho i dati degli orari"
- "Vendite weekend vs settimana?" → Se non c'è colonna data: "Non ho le date degli ordini"
- "Quanto costa il personale?" → Se non c'è labor_cost: "Non ho i costi del personale"
- "Prime Cost?" → Richiede food_cost + labor_cost. Se manca labor: "Per il Prime Cost mi serve anche il costo del personale, che non è nel dataset"
- "Quanti clienti unici?" → Se non c'è customer_id univoco: "Non ho un identificativo cliente affidabile"

REGOLA D'ORO: Se non hai la colonna, NON PUOI rispondere. Dillo chiaramente.

3) SOLO METRICHE REGISTRATE
- Usa ESCLUSIVAMENTE metriche predefinite.
- NON inventare formule DSL se esiste una metrica ufficiale.

METRICHE PREDEFINITE (execute_metric / aggregate_group):
- revenue → Fatturato totale
- food_cost → Costo materie prime
- food_cost_percent → Food cost %
- ticket_medio → Valore medio per ordine
- quantity_total → Quantità totale articoli
- order_count → Numero ordini
- avg_unit_price → Prezzo medio unitario
- gross_margin → Margine lordo
- gross_margin_percent → Margine lordo %
- discount_total → Sconti totali
- discount_percent_on_revenue → Incidenza sconti %

4) DIVIETO METRICHE DERIVATE INTERNE
- NON calcolare MAI internamente: "revenue / quantity = prezzo medio"
- NON fare divisioni tra output di tool diversi
- Se vuoi "prezzo medio per categoria" → aggregate_group(category, avg_unit_price)
- Se vuoi "conversion rate" → la metrica DEVE esistere, altrimenti dire "metrica non disponibile"
- Ogni numero nella risposta DEVE provenire DIRETTAMENTE da un tool output

5) TOOL PRIORITY
1. execute_metric → metriche singole
2. aggregate_group → breakdown (MAX 500 righe)
3. compare_periods → confronti temporali
4. filter_data → righe raw (MAX 1000 righe)

6) QUERY OBBLIGATORIE - MATCHING ESATTO
- "fatturato", "vendite", "revenue" → execute_metric(metricName: revenue)
- "food cost" → execute_metric(food_cost o food_cost_percent)
- "ticket medio" → execute_metric(ticket_medio)
- "prezzo medio" → execute_metric o aggregate_group(avg_unit_price)
- "margine lordo €", "margine in euro", "profitto €" → execute_metric(gross_margin) - MAI usare revenue!
- "margine lordo %", "margine percentuale" → execute_metric(gross_margin_percent)

ATTENZIONE CRITICA - CONFUSIONE REVENUE/MARGINE:
- revenue = FATTURATO (quanto incassi)
- gross_margin = MARGINE LORDO € (fatturato MENO costi)
- NON sono la stessa cosa!
- Se dici "margine lordo di X €" il valore X DEVE venire da gross_margin, MAI da revenue
- Errore tipico: dire "margine lordo 21.956€" quando 21.956€ è il revenue. Il margine è ~14.267€


========================
STRUTTURA OUTPUT (3 LAYER)
========================

7) LAYER 1: DATA FACTS (OBBLIGATORIO)
- SOLO numeri provenienti da tool output
- SOLO etichette corrette (revenue ≠ margine)
- Esempio: "Revenue: 21.956,62€ | Gross Margin: 14.267,01€ | Gross Margin %: 64,98%"

8) LAYER 2: INTERPRETATION (LIMITATA)
Consentito:
- "Il margine è uniforme tra le categorie"
- "Food e Drink hanno marginalità simili"
- "Il food cost è sotto/sopra la media del dataset"

VIETATO:
- "Markup costante" (non verificabile)
- "Strategia d'élite" (giudizio soggettivo)
- "Psicologia del prezzo" (concetto esterno)
- Benchmark esterni (es. "gold standard 68-70%")
- "Best practice" o "standard di settore" senza dati

9) LAYER 3: STRATEGY (SOLO SU RICHIESTA ESPLICITA)
Attiva SOLO se l'utente chiede:
- "dammi consigli" / "cosa mi suggerisci" / "strategia"

VIETATO in default mode:
- "triangolo d'oro del menu"
- "leader di profitto"
- "piano d'attacco"
- Menu engineering non richiesto
- Upselling suggestions
- Azioni suggerite

Anche in strategy mode:
- NON generare nuovi numeri
- NO benchmark esterni non verificabili

========================
MAPPING SEMANTICO COLONNE
========================

10) INTERPRETAZIONE COLONNE - REGOLE OBBLIGATORIE:

COLONNE TIPICHE E LORO SIGNIFICATO:
- item_name / product_name / nome_prodotto → Nome del singolo prodotto/piatto (Pizza Margherita, Birra, etc.)
- category / categoria → Macro-categoria (Food, Drink, Dessert)
- unit_price / prezzo → Prezzo unitario
- quantity / quantità → Quantità venduta
- order_id / id_ordine → Identificativo ordine

REGOLA CRITICA - QUANDO L'UTENTE CHIEDE ELENCHI:
- "che pizze abbiamo", "quali piatti", "elenco prodotti" → groupBy: [item_name], filters: {category: "Food"}
- "che bevande", "drink disponibili" → groupBy: [item_name], filters: {category: "Drink"}
- "che dolci", "dessert" → groupBy: [item_name], filters: {category: "Dessert"}

MAI raggruppare per "category" se l'utente chiede il DETTAGLIO dei prodotti!
- SBAGLIATO: "che pizze abbiamo" → groupBy: [category] (restituisce solo Food/Drink/Dessert)
- CORRETTO: "che pizze abbiamo" → groupBy: [item_name], filters: {category: "Food"}

QUANDO USARE category vs item_name:
- "confronto categorie", "Food vs Drink" → groupBy: [category]
- "quali prodotti", "che piatti", "elenco articoli" → groupBy: [item_name]

========================
GESTIONE INPUT CONVERSAZIONALI
========================

11) Se il messaggio è solo:
- grazie / ok / perfetto / capito / conferme simili

NON chiamare tool.
Rispondi brevemente: "Dimmi cosa vuoi analizzare."

========================
ERROR HANDLING
========================

11) Se una metrica non è calcolabile:
- Spiega il motivo (colonna mancante, dati insufficienti)
- NON improvvisare risultati

========================
OBIETTIVO
========================

Il tuo obiettivo NON è sembrare creativo.
Il tuo obiettivo è essere:
- deterministico
- verificabile
- affidabile
`;

async function getDatasetSchema(datasetId: string): Promise<{ columns: string[]; columnTypes: Record<string, string> } | null> {
  try {
    const [dataset] = await db
      .select()
      .from(clientDataDatasets)
      .where(eq(clientDataDatasets.id, datasetId))
      .limit(1);

    if (!dataset || dataset.status !== "ready") {
      return null;
    }

    const columns = Object.keys(dataset.columnMapping);
    const columnTypes: Record<string, string> = {};
    for (const [name, info] of Object.entries(dataset.columnMapping)) {
      columnTypes[name] = (info as any).dataType || "TEXT";
    }

    return { columns, columnTypes };
  } catch (error) {
    console.error("[QUERY-PLANNER] Error fetching dataset schema:", error);
    return null;
  }
}

function validateToolCallAgainstSchema(
  toolCall: ToolCall,
  schema: { columns: string[]; columnTypes: Record<string, string> }
): ToolCallValidationResult {
  const errors: string[] = [];

  const basicValidation = validateToolCall(toolCall);
  if (!basicValidation.valid) {
    return { valid: false, errors: basicValidation.errors };
  }

  switch (toolCall.name) {
    case "query_metric": {
      const dsl = toolCall.args.dsl;
      if (!dsl || typeof dsl !== "string") {
        errors.push("DSL expression is required and must be a string");
        break;
      }
      
      // DEPRECATION WARNING: Check if a predefined metric could be used instead
      const dslLower = dsl.toLowerCase();
      const predefinedMetrics = ["revenue", "food_cost", "ticket_medio", "order_count", "quantity_total"];
      for (const metric of predefinedMetrics) {
        if (dslLower.includes(metric.replace("_", " ")) || 
            (metric === "revenue" && (dslLower.includes("sum") && dslLower.includes("net"))) ||
            (metric === "order_count" && dslLower.includes("count"))) {
          console.warn(`[QUERY-PLANNER] DEPRECATION: query_metric used for "${dsl}" but execute_metric with "${metric}" should be preferred`);
        }
      }
      
      try {
        const parsed = parseMetricExpression(dsl);
        const validation = validateMetricAgainstSchema(parsed, schema.columns);
        if (!validation.valid) {
          errors.push(...validation.errors);
        }
      } catch (parseError: any) {
        errors.push(`Invalid DSL syntax: ${parseError.message}`);
      }
      break;
    }

    case "execute_metric": {
      const metricName = toolCall.args.metricName;
      if (!metricName || !isValidMetricName(metricName)) {
        errors.push(`Metrica non valida: "${metricName}". Metriche disponibili: ${TOOL_METRIC_ENUM.join(", ")}`);
      }
      break;
    }

    case "compare_periods": {
      const dsl = toolCall.args.dsl;
      const dateColumn = toolCall.args.dateColumn;
      
      if (!dsl || typeof dsl !== "string") {
        errors.push("DSL expression is required");
      }
      if (!dateColumn || !schema.columns.includes(dateColumn)) {
        errors.push(`Invalid date column: ${dateColumn}. Available: ${schema.columns.slice(0, 5).join(", ")}...`);
      }
      if (dateColumn && schema.columnTypes[dateColumn]?.toUpperCase() !== "DATE") {
        errors.push(`Column ${dateColumn} is not a DATE type`);
      }

      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      for (const field of ["period1Start", "period1End", "period2Start", "period2End"]) {
        const value = toolCall.args[field];
        if (!value || !dateRegex.test(value)) {
          errors.push(`Invalid date format for ${field}: expected YYYY-MM-DD`);
        }
      }
      break;
    }

    case "filter_data": {
      const filters = toolCall.args.filters;
      if (filters && typeof filters === "object") {
        for (const column of Object.keys(filters)) {
          if (!schema.columns.includes(column)) {
            errors.push(`Invalid filter column: ${column}`);
          }
        }
      }
      const columns = toolCall.args.columns;
      if (columns && Array.isArray(columns)) {
        for (const col of columns) {
          if (!schema.columns.includes(col)) {
            errors.push(`Invalid select column: ${col}`);
          }
        }
      }
      break;
    }

    case "aggregate_group": {
      const groupBy = toolCall.args.groupBy;
      if (groupBy && Array.isArray(groupBy)) {
        for (const col of groupBy) {
          if (!schema.columns.includes(col)) {
            errors.push(`Invalid groupBy column: ${col}`);
          }
        }
      }
      const aggregations = toolCall.args.aggregations;
      if (aggregations && Array.isArray(aggregations)) {
        for (const agg of aggregations) {
          if (agg.column && agg.column !== "*" && !schema.columns.includes(agg.column)) {
            errors.push(`Invalid aggregation column: ${agg.column}`);
          }
        }
      }
      break;
    }

    case "get_schema":
      break;
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export async function planQuery(
  userQuestion: string,
  datasets: DatasetInfo[],
  consultantId?: string
): Promise<QueryPlan> {
  const providerResult = await getAIProvider(consultantId || "system", consultantId);
  const client = providerResult.client;
  const { model: modelName } = getModelWithThinking(providerResult.metadata?.name);

  const datasetsContext = datasets.map(d => {
    const cols = d.columns.map(c => `${c.name} (${c.dataType}): ${c.description || c.displayName}`).join("\n    ");
    const metrics = d.metrics?.map(m => `${m.name}: ${m.dslFormula}`).join("\n    ") || "Nessuna metrica pre-definita";
    return `Dataset "${d.name}" (ID: ${d.id}, ${d.rowCount} righe):
  Colonne:
    ${cols}
  Metriche:
    ${metrics}`;
  }).join("\n\n");

  const userPrompt = `Dataset disponibili:
${datasetsContext}

Domanda dell'utente: "${userQuestion}"

Quali tool devo usare per rispondere? Se servono più step, elencali in ordine.`;

  // NOTE: Intent classification is now handled by Router Agent in askDataset()
  // The legacy classifyIntent() is deprecated - Router Agent is the single source of truth
  console.log(`[QUERY-PLANNER] Using Router Agent classification (legacy classifier disabled)`);

  try {
    const response = await client.generateContent({
      model: modelName,
      systemInstruction: {
        role: "system",
        parts: [{ text: SYSTEM_PROMPT_IT }]
      },
      contents: [
        { role: "user", parts: [{ text: userPrompt }] }
      ],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 2048,
      },
      tools: [{
        functionDeclarations: dataAnalysisTools
      }],
      toolConfig: {
        functionCallingConfig: {
          mode: "ANY"
        }
      }
    });

    const responseText = response.response.text();
    const steps: ToolCall[] = [];

    const candidates = (response.response as any).candidates;
    if (candidates && candidates[0]?.content?.parts) {
      for (const part of candidates[0].content.parts) {
        if (part.functionCall) {
          steps.push({
            name: part.functionCall.name,
            args: part.functionCall.args || {}
          });
        }
      }
    }

    // NOTE: Force retry logic is now handled by Policy Engine in askDataset()
    // If Router Agent classifies as "analytics" but no tools are called, 
    // the Policy Engine will handle this case
    if (steps.length === 0) {
      console.log("[QUERY-PLANNER] No tools planned - Policy Engine will handle this");
    }

    const complexity = steps.length <= 1 ? "simple" : steps.length <= 3 ? "medium" : "complex";

    return {
      steps,
      reasoning: responseText || "Piano generato automaticamente",
      estimatedComplexity: complexity
    };
  } catch (error: any) {
    console.error("[QUERY-PLANNER] Error planning query:", error.message);

    if (datasets.length > 0) {
      const numericCols = datasets[0].columns.filter(c => {
        const t = c.dataType?.toUpperCase();
        return t === "NUMERIC" || t === "INTEGER" || t === "NUMBER";
      });
      if (numericCols.length > 0) {
        return {
          steps: [{
            name: "filter_data",
            args: { datasetId: String(datasets[0].id), filters: {}, limit: 50 }
          }],
          reasoning: "Fallback: mostra campione di dati",
          estimatedComplexity: "simple"
        };
      }
    }

    return {
      steps: [],
      reasoning: `Errore nella pianificazione: ${error.message}`,
      estimatedComplexity: "simple"
    };
  }
}

async function retryPlanWithFeedback(
  userQuestion: string,
  datasets: DatasetInfo[],
  validationErrors: string[],
  consultantId?: string,
  attempt: number = 1
): Promise<QueryPlan | null> {
  if (attempt > MAX_PLANNING_RETRIES) {
    console.error(`[QUERY-PLANNER] Max retries (${MAX_PLANNING_RETRIES}) exceeded`);
    return null;
  }

  const providerResult = await getAIProvider(consultantId || "system", consultantId);
  const client = providerResult.client;
  const { model: modelName } = getModelWithThinking(providerResult.metadata?.name);

  const datasetsContext = datasets.map(d => {
    const cols = d.columns.map(c => `${c.name} (${c.dataType}): ${c.description || c.displayName}`).join("\n    ");
    return `Dataset "${d.name}" (ID: ${d.id}):
  Colonne disponibili:
    ${cols}`;
  }).join("\n\n");

  const errorFeedback = validationErrors.join("\n- ");

  const retryPrompt = `La tua risposta precedente conteneva errori di validazione:
- ${errorFeedback}

Dataset disponibili:
${datasetsContext}

Domanda originale: "${userQuestion}"

Per favore correggi gli errori e genera nuove chiamate ai tool valide. Usa SOLO colonne che esistono nel dataset.`;

  console.log(`[QUERY-PLANNER] Retry attempt ${attempt} with feedback`);

  try {
    const response = await client.generateContent({
      model: modelName,
      contents: [
        { role: "user", parts: [{ text: retryPrompt }] }
      ],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 2048,
      },
      tools: [{
        functionDeclarations: dataAnalysisTools
      }]
    });

    const steps: ToolCall[] = [];
    const candidates = (response.response as any).candidates;
    if (candidates && candidates[0]?.content?.parts) {
      for (const part of candidates[0].content.parts) {
        if (part.functionCall) {
          steps.push({
            name: part.functionCall.name,
            args: part.functionCall.args || {}
          });
        }
      }
    }

    if (steps.length === 0) {
      return null;
    }

    return {
      steps,
      reasoning: `Piano corretto dopo retry ${attempt}`,
      estimatedComplexity: steps.length <= 1 ? "simple" : steps.length <= 3 ? "medium" : "complex"
    };
  } catch (error: any) {
    console.error(`[QUERY-PLANNER] Retry ${attempt} failed:`, error.message);
    return null;
  }
}

export async function executeToolCall(
  toolCall: ToolCall,
  userId?: string
): Promise<ExecutedToolResult> {
  const startTime = Date.now();

  const validation = validateToolCall(toolCall);
  if (!validation.valid) {
    return {
      toolName: toolCall.name,
      args: toolCall.args,
      result: null,
      success: false,
      error: validation.errors.join("; "),
      executionTimeMs: Date.now() - startTime
    };
  }

  try {
    let result: QueryResult;

    switch (toolCall.name) {
      case "query_metric":
        result = await queryMetric(toolCall.args.datasetId, toolCall.args.dsl, { userId });
        break;

      case "execute_metric": {
        console.log(`[EXECUTE-METRIC] Called with metricName: "${toolCall.args.metricName}", datasetId: ${toolCall.args.datasetId}`);
        
        // Step 1: Pre-validate that required columns exist for this metric
        const preValidation = await validateMetricForDataset(toolCall.args.metricName, toolCall.args.datasetId);
        if (!preValidation.valid) {
          const businessError = preValidation.error || `Metrica "${toolCall.args.metricName}" non disponibile per questo dataset.`;
          console.error(`[EXECUTE-METRIC] Pre-validation failed: ${businessError}`);
          return {
            toolName: toolCall.name,
            args: toolCall.args,
            result: null,
            success: false,
            error: businessError,
            executionTimeMs: Date.now() - startTime
          };
        }
        
        // Step 2: Resolve template SQL with dataset-specific column mappings
        const resolveResult = await resolveMetricSQLForDataset(toolCall.args.metricName, toolCall.args.datasetId);
        if (!resolveResult.valid) {
          console.error(`[EXECUTE-METRIC] Could not resolve SQL for metric: "${toolCall.args.metricName}", error: ${resolveResult.error}`);
          return {
            toolName: toolCall.name,
            args: toolCall.args,
            result: null,
            success: false,
            error: resolveResult.error || `Metrica non trovata: ${toolCall.args.metricName}`,
            executionTimeMs: Date.now() - startTime
          };
        }
        console.log(`[EXECUTE-METRIC] Resolved SQL: ${resolveResult.sql}`);
        
        // Step 3: Execute the resolved SQL
        result = await executeMetricSQL(
          toolCall.args.datasetId, 
          resolveResult.sql, 
          toolCall.args.metricName,
          { userId, timeoutMs: 3000 }
        );
        console.log(`[EXECUTE-METRIC] Result: success=${result.success}, error=${result.error || 'none'}`);
        break;
      }

      case "compare_periods":
        result = await comparePeriods(
          toolCall.args.datasetId,
          toolCall.args.dsl,
          toolCall.args.dateColumn,
          { start: toolCall.args.period1Start, end: toolCall.args.period1End },
          { start: toolCall.args.period2Start, end: toolCall.args.period2End },
          { userId }
        );
        break;

      case "filter_data":
        result = await filterData(
          toolCall.args.datasetId,
          toolCall.args.filters,
          toolCall.args.columns,
          toolCall.args.limit || 100,
          0,
          { userId }
        );
        break;

      case "aggregate_group": {
        // DETAILED LOGGING - show exactly what Gemini passed
        console.log(`[AGGREGATE-GROUP] Full args from Gemini:`, JSON.stringify(toolCall.args, null, 2));
        console.log(`[AGGREGATE-GROUP] datasetId: ${toolCall.args.datasetId}`);
        console.log(`[AGGREGATE-GROUP] groupBy: ${JSON.stringify(toolCall.args.groupBy)}`);
        console.log(`[AGGREGATE-GROUP] metricName: ${toolCall.args.metricName}`);
        console.log(`[AGGREGATE-GROUP] aggregations: ${JSON.stringify(toolCall.args.aggregations)}`);
        console.log(`[AGGREGATE-GROUP] orderBy: ${JSON.stringify(toolCall.args.orderBy)}`);
        console.log(`[AGGREGATE-GROUP] filters: ${JSON.stringify(toolCall.args.filters)}`);
        
        // TASK 1: Cardinality check BEFORE executing aggregate_group
        const groupByColumns = toolCall.args.groupBy || [];
        if (groupByColumns.length > 0) {
          console.log(`[WIRING-CHECK] checkCardinalityBeforeAggregate called for columns: ${JSON.stringify(groupByColumns)}`);
          const cardinalityCheck = await checkCardinalityBeforeAggregate(
            toolCall.args.datasetId,
            groupByColumns,
            toolCall.args.filters
          );
          
          if (cardinalityCheck.needsConfirmation) {
            console.warn(`[AGGREGATE-GROUP] CARDINALITY BLOCK: ${cardinalityCheck.distinctCount} distinct values exceeds limit`);
            return {
              toolName: toolCall.name,
              args: toolCall.args,
              result: {
                needsConfirmation: true,
                cardinality: {
                  distinctCount: cardinalityCheck.distinctCount,
                  totalRows: cardinalityCheck.totalRows,
                  column: groupByColumns[0],
                  limit: MAX_GROUP_BY_LIMIT,
                },
                message: cardinalityCheck.message,
                options: cardinalityCheck.options,
              },
              success: false,
              error: cardinalityCheck.message,
              executionTimeMs: Date.now() - startTime
            };
          }
        }
        
        // Convert metricName to aggregations if provided
        let aggregations = toolCall.args.aggregations;
        let useRawSqlExpression: string | null = null;
        
        if (!aggregations && toolCall.args.metricName) {
          // Step 1: Pre-validate that required columns exist for this metric
          const preValidation = await validateMetricForDataset(toolCall.args.metricName, toolCall.args.datasetId);
          if (!preValidation.valid) {
            const businessError = preValidation.error || `Metrica "${toolCall.args.metricName}" non disponibile per questo dataset.`;
            console.error(`[AGGREGATE-GROUP] Pre-validation failed: ${businessError}`);
            result = { success: false, error: businessError };
            break;
          }
          
          // Step 2: Resolve template SQL with dataset-specific column mappings
          const resolveResult = await resolveMetricSQLForDataset(toolCall.args.metricName, toolCall.args.datasetId);
          if (resolveResult.valid) {
            useRawSqlExpression = resolveResult.sql;
            console.log(`[AGGREGATE-GROUP] Using resolved SQL expression for "${toolCall.args.metricName}": ${useRawSqlExpression}`);
          } else {
            // STRICT: No fallback - return error if metric cannot be resolved
            const errorMsg = resolveResult.error || `Metrica "${toolCall.args.metricName}" non risolvibile per questo dataset.`;
            console.error(`[AGGREGATE-GROUP] ${errorMsg}`);
            result = { success: false, error: errorMsg };
            break;
          }
        }
        
        // Sanitize orderBy - skip if column is undefined/null
        let sanitizedOrderBy = toolCall.args.orderBy;
        if (sanitizedOrderBy && (!sanitizedOrderBy.column || sanitizedOrderBy.column === "undefined")) {
          console.log(`[AGGREGATE-GROUP] Skipping invalid orderBy (column is undefined)`);
          sanitizedOrderBy = undefined;
        }
        
        if (!aggregations && !useRawSqlExpression) {
          result = { success: false, error: "Either aggregations or metricName is required" };
        } else {
          // Log time granularity if specified
          if (toolCall.args.timeGranularity) {
            console.log(`[AGGREGATE-GROUP] Time granularity: ${toolCall.args.timeGranularity}, dateColumn: ${toolCall.args.dateColumn}`);
          }
          
          result = await aggregateGroup(
            toolCall.args.datasetId,
            toolCall.args.groupBy,
            aggregations || [],  // Pass empty array when using raw SQL
            toolCall.args.filters,
            sanitizedOrderBy,
            toolCall.args.limit || 100,
            { userId },
            toolCall.args.timeGranularity,
            toolCall.args.dateColumn,
            useRawSqlExpression ? { sql: useRawSqlExpression, alias: toolCall.args.metricName } : undefined
          );
          console.log(`[AGGREGATE-GROUP] Result: success=${result.success}, rowCount=${result.rowCount}, error=${result.error || 'none'}`);
        }
        break;
      }

      case "get_schema":
        result = await getSchema(toolCall.args.datasetId);
        break;

      default:
        return {
          toolName: toolCall.name,
          args: toolCall.args,
          result: null,
          success: false,
          error: `Tool non supportato: ${toolCall.name}`,
          executionTimeMs: Date.now() - startTime
        };
    }

    return {
      toolName: toolCall.name,
      args: toolCall.args,
      result: result.success ? (result.data || result.metrics) : null,
      success: result.success,
      error: result.error,
      executionTimeMs: Date.now() - startTime
    };
  } catch (error: any) {
    return {
      toolName: toolCall.name,
      args: toolCall.args,
      result: null,
      success: false,
      error: error.message,
      executionTimeMs: Date.now() - startTime
    };
  }
}

export async function executePlan(
  plan: QueryPlan,
  userId?: string
): Promise<QueryExecutionResult> {
  const startTime = Date.now();
  const results: ExecutedToolResult[] = [];
  let allSuccess = true;

  for (const step of plan.steps) {
    const result = await executeToolCall(step, userId);
    results.push(result);

    if (!result.success) {
      allSuccess = false;
      console.warn(`[QUERY-PLANNER] Tool ${step.name} failed:`, result.error);
    }
  }

  return {
    plan,
    results,
    success: allSuccess,
    totalExecutionTimeMs: Date.now() - startTime
  };
}

export async function executePlanWithValidation(
  plan: QueryPlan,
  datasets: DatasetInfo[],
  consultantId?: string,
  userId?: string,
  userQuestion?: string
): Promise<QueryExecutionResult> {
  const startTime = Date.now();
  const results: ExecutedToolResult[] = [];
  let allSuccess = true;
  let currentPlan = plan;

  const datasetsMap = new Map(datasets.map(d => [d.id, d]));

  for (let i = 0; i < currentPlan.steps.length; i++) {
    const step = currentPlan.steps[i];
    const datasetId = step.args.datasetId;

    if (datasetId && step.name !== "get_schema") {
      const schema = await getDatasetSchema(datasetId);
      if (schema) {
        const validation = validateToolCallAgainstSchema(step, schema);
        if (!validation.valid) {
          console.warn(`[QUERY-PLANNER] Tool call validation failed:`, validation.errors);

          const retryPlan = await retryPlanWithFeedback(
            userQuestion || currentPlan.reasoning,
            datasets,
            validation.errors,
            consultantId,
            1
          );

          if (retryPlan) {
            currentPlan = retryPlan;
            i = -1;
            results.length = 0;
            allSuccess = true;
            continue;
          } else {
            results.push({
              toolName: step.name,
              args: step.args,
              result: null,
              success: false,
              error: `Validation failed: ${validation.errors.join("; ")}`,
              executionTimeMs: 0
            });
            allSuccess = false;
            continue;
          }
        }
      }
    }

    const result = await executeToolCall(step, userId);
    results.push(result);

    if (!result.success) {
      allSuccess = false;
      console.warn(`[QUERY-PLANNER] Tool ${step.name} failed:`, result.error);
    }
  }

  return {
    plan: currentPlan,
    results,
    success: allSuccess,
    totalExecutionTimeMs: Date.now() - startTime
  };
}

export async function askDataset(
  userQuestion: string,
  datasets: DatasetInfo[],
  consultantId?: string,
  userId?: string,
  conversationHistory?: ConversationMessage[]
): Promise<QueryExecutionResult> {
  console.log(`[QUERY-PLANNER] Processing question: "${userQuestion}" for ${datasets.length} datasets`);
  console.log(`[QUERY-PLANNER] Conversation history: ${conversationHistory?.length || 0} messages`);
  const startTime = Date.now();

  // ====== TASK 2: SEMANTIC CONTRACT DETECTION ======
  // Detect if user requests "ALL items" vs "top N"
  const semanticContract = detectSemanticContract(userQuestion);
  console.log(`[WIRING-CHECK] semantic contract detected - requestsAll=${semanticContract.requestsAll}, requestsTopN=${semanticContract.requestsTopN}, keywords=[${semanticContract.detectedKeywords.join(",")}]`);

  // TASK 3: Extract mentioned filters from user question  
  const availableColumns = datasets.length > 0 
    ? datasets[0].columns.map(c => c.name) 
    : [];
  const extractedFilters = extractFiltersFromQuestion(userQuestion, availableColumns);
  console.log(`[WIRING-CHECK] extractFiltersFromQuestion called - found ${Object.keys(extractedFilters).length} filters: ${JSON.stringify(extractedFilters)}`);

  // ====== LAYER 1: INTENT ROUTER (AI - gemini-2.5-flash-lite) ======
  // Fast, cheap classification of user intent WITH conversation context
  const routerOutput = await routeIntent(userQuestion, consultantId, conversationHistory);
  console.log(`[QUERY-PLANNER] Router result: intent=${routerOutput.intent}, requires_metrics=${routerOutput.requires_metrics}, confidence=${routerOutput.confidence.toFixed(2)}`);

  // ====== LAYER 2: POLICY ENGINE (TypeScript - no AI) ======
  // Gate keeper for tool access based on intent
  const policy = getPolicyForIntent(routerOutput.intent);
  console.log(`[QUERY-PLANNER] Policy: allowedTools=[${policy.allowedTools.join(',')}], requireToolCall=${policy.requireToolCall}`);

  // CONVERSATIONAL: Return fixed response without ANY tool calls
  if (routerOutput.intent === "conversational") {
    const friendlyReply = getConversationalReply(userQuestion);
    console.log(`[QUERY-PLANNER] CONVERSATIONAL - returning friendly response: "${friendlyReply.substring(0, 50)}..."`);
    return {
      plan: {
        steps: [],
        reasoning: "Intent: conversational - risposta fissa senza AI",
        estimatedComplexity: "simple"
      },
      results: [{
        toolName: "conversational_response",
        args: { intent: "conversational" },
        result: { message: friendlyReply, isFixedResponse: true },
        success: true
      }],
      success: true,
      totalExecutionTimeMs: Date.now() - startTime
    };
  }

  // STRATEGY: Return qualitative response WITHOUT any tool calls
  if (routerOutput.intent === "strategy") {
    console.log(`[QUERY-PLANNER] STRATEGY - generating qualitative response without tools`);
    const strategyResponse = await generateStrategyResponse(userQuestion, datasets, consultantId);
    return {
      plan: {
        steps: [],
        reasoning: "Intent: strategy - risposta qualitativa senza numeri inventati",
        estimatedComplexity: "simple"
      },
      results: [{
        toolName: "strategy_response",
        args: { intent: "strategy" },
        result: { message: strategyResponse, isQualitative: true },
        success: true
      }],
      success: true,
      totalExecutionTimeMs: Date.now() - startTime
    };
  }

  // CHECK: Analytics must be enabled (semantic mapping confirmed) for analytical queries
  if (datasets.length > 0 && (routerOutput.intent === "analytics" || routerOutput.requires_metrics)) {
    const datasetId = parseInt(datasets[0].id);
    if (!isNaN(datasetId)) {
      const analyticsCheck = await checkAnalyticsEnabled(datasetId);
      if (!analyticsCheck.enabled) {
        console.log(`[QUERY-PLANNER] ANALYTICS BLOCKED - semantic mapping not confirmed for dataset ${datasetId}`);
        return {
          plan: {
            steps: [],
            reasoning: "BLOCK: Analytics disabled - semantic mapping confirmation required",
            estimatedComplexity: "simple"
          },
          results: [{
            toolName: "analytics_blocked",
            args: { datasetId },
            result: { 
              blocked: true, 
              message: analyticsCheck.message || "Per analizzare questo dataset, conferma prima il mapping delle colonne chiave.",
              pendingColumns: analyticsCheck.pendingColumns || []
            },
            success: false
          }],
          success: false,
          totalExecutionTimeMs: Date.now() - startTime
        };
      }
    }
  }

  // ====== LAYER 3: EXECUTION AGENT (AI - gemini-2.5-flash) ======
  // Plan and execute tools based on policy
  const plan = await planQuery(userQuestion, datasets, consultantId);
  console.log(`[QUERY-PLANNER] Plan: ${plan.steps.length} steps, complexity: ${plan.estimatedComplexity}`);

  // Apply policy enforcement to planned tool calls
  if (plan.steps.length > 0) {
    const policyResult = enforcePolicyOnToolCalls(routerOutput.intent, plan.steps);
    
    if (policyResult.violations.length > 0) {
      console.warn(`[QUERY-PLANNER] POLICY VIOLATIONS: ${policyResult.violations.join('; ')}`);
      // Replace blocked tools, keep only allowed
      plan.steps = policyResult.allowed;
      
      if (plan.steps.length === 0 && policy.requireToolCall) {
        return {
          plan: {
            steps: [],
            reasoning: `Policy violation: ${policyResult.violations.join('; ')}`,
            estimatedComplexity: "simple"
          },
          results: [{
            toolName: "policy_violation",
            args: { intent: routerOutput.intent, violations: policyResult.violations },
            result: { 
              blocked: true, 
              message: `La richiesta non può essere elaborata: ${policyResult.violations[0]}`
            },
            success: false
          }],
          success: false,
          totalExecutionTimeMs: Date.now() - startTime
        };
      }
    }
    
    // NEW: Validate analytics intent with requires_metrics=true has at least one compute tool
    // RULE: get_schema can PRECEDE compute tools, but cannot SUBSTITUTE them
    // ENFORCED: If only metadata tools, BLOCK and require re-plan
    if (routerOutput.intent === "analytics" && routerOutput.requiresMetrics) {
      const analyticsValidation = validateAnalyticsToolCalls(plan.steps, routerOutput.requiresMetrics);
      if (!analyticsValidation.valid) {
        console.warn(`[QUERY-PLANNER] ANALYTICS VALIDATION FAILED: ${analyticsValidation.reason}`);
        console.log(`[QUERY-PLANNER] BLOCKING metadata-only call - forcing compute tool requirement`);
        return {
          plan: {
            steps: [],
            reasoning: `Analytics validation failed: ${analyticsValidation.reason}`,
            estimatedComplexity: "simple"
          },
          results: [{
            toolName: "analytics_requires_compute",
            args: { 
              intent: routerOutput.intent, 
              requiresMetrics: routerOutput.requiresMetrics,
              attemptedTools: plan.steps.map(s => s.name)
            },
            result: { 
              blocked: true, 
              message: "La domanda richiede calcoli sui dati. Usa aggregate_group o execute_metric per analizzare i numeri del dataset."
            },
            success: false
          }],
          success: false,
          totalExecutionTimeMs: Date.now() - startTime
        };
      }
    }
    
    // TASK 2: Check semantic contract - if user requests ALL but AI set a limit, BLOCK
    for (const step of plan.steps) {
      if (step.name === "aggregate_group" || step.name === "filter_data") {
        const limit = step.args.limit;
        
        if (semanticContract.requestsAll && limit && limit < MAX_GROUP_BY_LIMIT) {
          console.log(`[WIRING-CHECK] semantic contract enforced - requestsAll=${semanticContract.requestsAll}, aiLimit=${limit}`);
          console.warn(`[SEMANTIC-CONTRACT] BLOCK: User requested ALL items (keywords: ${semanticContract.detectedKeywords.join(", ")}) but AI set limit=${limit}`);
          return {
            plan: {
              steps: [],
              reasoning: `Semantic contract violation: user requested ALL items but AI would truncate to ${limit}`,
              estimatedComplexity: "simple"
            },
            results: [{
              toolName: "semantic_contract_violation",
              args: { 
                requestedAll: true, 
                aiLimit: limit,
                keywords: semanticContract.detectedKeywords 
              },
              result: { 
                needsConfirmation: true,
                message: `Hai chiesto di vedere TUTTI gli elementi (${semanticContract.detectedKeywords.join(", ")}), ma potrebbero essere molti. Vuoi procedere comunque o preferisci vedere solo i primi ${limit}?`,
                options: [
                  { action: "show_all", description: "Mostra tutti gli elementi" },
                  { action: "top_n", description: `Mostra i primi ${limit}` },
                  { action: "export", description: "Esporta in CSV" },
                ]
              },
              success: false
            }],
            success: false,
            totalExecutionTimeMs: Date.now() - startTime
          };
        }
        
        // TASK 4: Inject missing filters into tool calls
        if (Object.keys(extractedFilters).length > 0) {
          const existingFilters = step.args.filters || {};
          let injected = false;
          
          for (const [col, filter] of Object.entries(extractedFilters)) {
            if (!existingFilters[col]) {
              console.log(`[WIRING-CHECK] filters injected - ${col} = "${filter.value}"`);
              console.log(`[FILTER-INJECT] Injecting missing filter: ${col} = "${filter.value}"`);
              existingFilters[col] = filter;
              injected = true;
            }
          }
          
          if (injected) {
            step.args.filters = existingFilters;
            console.log(`[FILTER-INJECT] Updated filters: ${JSON.stringify(step.args.filters)}`);
          }
        }
      }
    }
  }

  const result = await executePlanWithValidation(plan, datasets, consultantId, userId, userQuestion);
  console.log(`[QUERY-PLANNER] Execution complete in ${result.totalExecutionTimeMs}ms, success: ${result.success}`);

  // BUG FIX: Check for zero results and return clear message instead of letting AI generate analysis
  const COMPUTE_TOOLS = ["execute_metric", "aggregate_group", "compare_periods", "filter_data", "query_metric"];
  const computeResults = result.results.filter(r => COMPUTE_TOOLS.includes(r.toolName) && r.success);
  
  if (computeResults.length > 0) {
    const allZeroRows = computeResults.every(r => {
      const rowCount = r.result?.rowCount ?? r.result?.data?.length ?? 
                       (Array.isArray(r.result) ? r.result.length : null);
      return rowCount === 0;
    });
    
    if (allZeroRows) {
      console.log(`[QUERY-PLANNER] ZERO RESULTS DETECTED - All compute tools returned 0 rows`);
      
      // Extract filter info for helpful message
      const appliedFilters: string[] = [];
      for (const r of computeResults) {
        if (r.args?.filters) {
          for (const [col, filter] of Object.entries(r.args.filters)) {
            const f = filter as { operator: string; value: string | number };
            appliedFilters.push(`${col} ${f.operator} "${f.value}"`);
          }
        }
      }
      
      const filterInfo = appliedFilters.length > 0 
        ? `\n\n**Filtri applicati:** ${appliedFilters.join(", ")}`
        : "";
      
      const zeroResultsMessage = `## ⚠️ La query non ha trovato dati

La ricerca non ha restituito risultati con i filtri applicati.${filterInfo}

**Possibili cause:**
- Il valore del filtro potrebbe contenere un errore di battitura
- Il valore potrebbe non esistere nel dataset (verifica i valori disponibili)
- Prova a riformulare la domanda con valori diversi

**Suggerimento:** Chiedi "quali sono i valori unici di [colonna]?" per vedere i valori disponibili.`;

      return {
        plan: result.plan,
        results: [{
          toolName: "zero_results_handler",
          args: { appliedFilters },
          result: { 
            message: zeroResultsMessage, 
            isZeroResults: true,
            rowCount: 0
          },
          success: true
        }],
        success: true,
        totalExecutionTimeMs: Date.now() - startTime
      };
    }
  }

  return result;
}

const STRATEGY_FALLBACK = `Per rispondere a questa domanda strategica in modo accurato, dovrei prima analizzare i tuoi dati reali.

Posso suggerirti queste aree di focus:
- **Analisi del volume**: Capire trend di vendita e opportunità di crescita
- **Ottimizzazione prezzi**: Identificare prodotti con margine migliorabile
- **Mix prodotti**: Valutare la composizione del fatturato

Vuoi che calcoli i numeri reali per una di queste aree?`;

const ITALIAN_NUMERAL_WORDS = [
  "zero", "un[oa]?", "due", "tre", "quattro", "cinque", "sei", "sette", "otto", "nove",
  "dieci", "undici", "dodici", "tredici", "quattordici", "quindici", "sedici",
  "diciassette", "diciotto", "diciannove",
  "vent[io]?", "trent[ao]?", "quarant[ao]?", "cinquant[ao]?", "sessant[ao]?",
  "settant[ao]?", "ottant[ao]?", "novant[ao]?",
  "cent[oi]?", "mille", "mila", "milion[ei]?", "miliard[io]?",
  "prim[oa]?", "second[oa]?", "terz[oa]?", "quart[oa]?", "quint[oa]?",
  "sest[oa]?", "settim[oa]?", "ottav[oa]?", "non[oa]?", "decim[oa]?",
  "dozzin[ae]", "mezz[oa]", "doppi[oa]", "tripl[oa]", "quadrupl[oa]"
];
const COMPOUND_PREFIX = "(vent|trent|quarant|cinquant|sessant|settant|ottant|novant|cent|duecent|trecent)";
const COMPOUND_SUFFIX = "(uno|due|tre|quattro|cinque|sei|sette|otto|nove)";
const ITALIAN_NUMERALS = new RegExp(`\\b(${ITALIAN_NUMERAL_WORDS.join("|")}|${COMPOUND_PREFIX}${COMPOUND_SUFFIX})\\b`, "i");
const ROMAN_NUMERALS = /\b[IVXLCDM]{2,}\b/;

function hasAnyDigit(text: string): boolean {
  return /\d/.test(text);
}

function hasNumericContent(text: string): boolean {
  if (/\d/.test(text)) return true;
  if (ITALIAN_NUMERALS.test(text)) return true;
  if (ROMAN_NUMERALS.test(text)) return true;
  if (/\b[QqVv]\d+\b/.test(text)) return true;
  if (/[\u0660-\u0669\u06F0-\u06F9\u0966-\u096F]/.test(text)) return true;
  return false;
}

function convertListNumbersToBullets(text: string): string {
  return text.replace(/^\s*(\d+)[\.\)]\s*/gm, "- ");
}

function removeAllNumbers(text: string): string {
  let cleaned = text;
  
  cleaned = cleaned.replace(/[€$£]\s*[\d,.]+|[\d,.]+\s*[€$£]/g, "");
  cleaned = cleaned.replace(/[+-]?\d+\s*%/g, "");
  cleaned = cleaned.replace(/\b\d{4}\b/g, "");
  cleaned = cleaned.replace(/\b\d{1,3}(?:[.,]\d{3})+/g, "");
  cleaned = cleaned.replace(/\b\d+[.,]\d+\b/g, "");
  cleaned = cleaned.replace(/\d+\s*[-–:]\s*\d+/g, "");
  cleaned = cleaned.replace(/\d+[°º]/g, "");
  cleaned = cleaned.replace(/\d+\s*(?:mesi|anni|giorni|ore|settimane)/gi, "un certo periodo");
  
  cleaned = convertListNumbersToBullets(cleaned);
  
  cleaned = cleaned.replace(/\b\d+\b/g, "");
  cleaned = cleaned.replace(ROMAN_NUMERALS, "");
  cleaned = cleaned.replace(ITALIAN_NUMERALS, "alcuni");
  cleaned = cleaned.replace(new RegExp(COMPOUND_PREFIX + COMPOUND_SUFFIX, 'gi'), "alcuni");
  cleaned = cleaned.replace(/\s{2,}/g, " ");
  cleaned = cleaned.replace(/^\s+/gm, "");
  
  return cleaned.trim();
}

/**
 * Generate a qualitative strategy response without any tool calls or numbers
 * Hard numeric guard: if AI still returns numbers, scrub them or fallback
 */
async function generateStrategyResponse(
  userQuestion: string,
  datasets: DatasetInfo[],
  consultantId?: string
): Promise<string> {
  const providerResult = await getAIProvider(consultantId || "system", consultantId);
  const client = providerResult.client;
  const { model: modelName } = getModelWithThinking(providerResult.metadata?.name);

  const STRATEGY_PROMPT = `Sei un consulente strategico. Rispondi a domande di business in modo QUALITATIVO.

REGOLE ASSOLUTE - VIOLAZIONE = ERRORE CRITICO:
- NON citare MAI numeri specifici (€, %, quantità, importi)
- NON fare MAI proiezioni numeriche o stime
- NON inventare MAI dati o percentuali
- NON usare numeri scritti in lettere (es. "dieci", "venti")
- Fornisci SOLO consigli strategici generali
- USA SEMPRE bullet points (-) invece di liste numerate

APPROCCIO:
- Identifica le leve strategiche (pricing, costi, volume, mix prodotti)
- Suggerisci framework di analisi
- Proponi azioni concrete senza quantificarle
- Se servono numeri per una risposta precisa, suggerisci di chiedere analytics specifici

ESEMPIO CORRETTO:
Domanda: "Come posso aumentare molto il fatturato?"
Risposta: "Per aumentare significativamente il fatturato puoi lavorare su queste leve principali:
- **Volume**: Aumentare il numero di clienti o la frequenza degli ordini
- **Prezzo**: Rivedere il pricing dei prodotti più venduti
- **Mix**: Promuovere prodotti ad alto margine

Vuoi che analizzi i dati attuali per identificare le opportunità specifiche?"

VIETATO (MAI FARE):
- Percentuali inventate
- Proiezioni numeriche
- Importi stimati
- Numeri in lettere`;

  const datasetContext = datasets.length > 0 
    ? `\n\nDataset disponibile: "${datasets[0].name}".`
    : "";

  try {
    const response = await client.generateContent({
      model: modelName,
      systemInstruction: {
        role: "system",
        parts: [{ text: STRATEGY_PROMPT }]
      },
      contents: [
        { role: "user", parts: [{ text: userQuestion + datasetContext }] }
      ],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 1024,
      }
    });

    let aiResponse = response.response.text() || "";
    
    if (hasNumericContent(aiResponse)) {
      console.warn(`[STRATEGY-GUARD] AI response contains numeric content, applying hard guard...`);
      aiResponse = removeAllNumbers(aiResponse);
      aiResponse = aiResponse.replace(ITALIAN_NUMERALS, "alcuni");
      
      if (hasNumericContent(aiResponse)) {
        console.error(`[STRATEGY-GUARD] HARD BLOCK: numeric content still present after scrubbing, using fallback`);
        return STRATEGY_FALLBACK;
      }
    }
    
    return aiResponse;
  } catch (error: any) {
    console.error("[QUERY-PLANNER] Strategy response error:", error.message);
    return "Per rispondere a questa domanda strategica, ho bisogno di analizzare prima i dati. Vuoi che calcoli le metriche rilevanti?";
  }
}
