/**
 * Query Planner using Gemini Function Calling
 * Analyzes user questions and plans which tools to use
 */

import { getAIProvider, getModelWithThinking } from "../provider-factory";
import { dataAnalysisTools, type ToolCall, type ExecutedToolResult, validateToolCall, getToolByName } from "./tool-definitions";
import { queryMetric, filterData, aggregateGroup, comparePeriods, getSchema, executeMetricSQL, type QueryResult } from "../../services/client-data/query-executor";
import { parseMetricExpression, validateMetricAgainstSchema } from "../../services/client-data/metric-dsl";
import { db } from "../../db";
import { clientDataDatasets } from "../../../shared/schema";
import { eq } from "drizzle-orm";
import { classifyIntent, ForceToolRetryError, requiresNumericAnswer, getConversationalReply } from "./intent-classifier";
import { routeIntent, type IntentRouterOutput } from "./intent-router";
import { enforcePolicyOnToolCalls, getPolicyForIntent, POLICY_RULES, type IntentType } from "./policy-engine";
import { getMetricDefinition, getMetricDescriptionsForPrompt, isValidMetricName, resolveMetricSQLForDataset } from "./metric-registry";
import { MAX_GROUP_BY_LIMIT, METRIC_ENUM as TOOL_METRIC_ENUM } from "./tool-definitions";
import { forceMetricFromTerms } from "./term-mapper";
import { validateMetricForDataset } from "./pre-validator";
import { checkAnalyticsEnabled } from "../../services/client-data/semantic-mapping-service";

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

3) SOLO METRICHE REGISTRATE
- Usa ESCLUSIVAMENTE metriche predefinite.
- NON inventare formule DSL se esiste una metrica ufficiale.

METRICHE PREDEFINITE (execute_metric):
- revenue → Fatturato totale
- food_cost → Costo materie prime
- food_cost_percent → Food cost %
- ticket_medio → Valore medio per ordine
- quantity_total → Quantità totale articoli
- order_count → Numero ordini
- gross_margin → Margine lordo
- gross_margin_percent → Margine lordo %
- discount_total → Sconti totali

4) TOOL PRIORITY
1. execute_metric → metriche singole
2. aggregate_group → breakdown (MAX 500 righe)
3. compare_periods → confronti temporali
4. filter_data → righe raw (MAX 1000 righe)

5) QUERY OBBLIGATORIE
- "fatturato", "vendite", "revenue" → execute_metric(metricName: revenue)
- "food cost" → execute_metric(food_cost o food_cost_percent)
- "ticket medio" → execute_metric(ticket_medio)

========================
NARRATIVA E CONSULENZA
========================

6) MODALITÀ DEFAULT = DATA MODE
Di default:
- Riporta numeri
- Descrivi differenze matematiche
- NON inventare cause
- NON fare consulenza strategica
- NON fare assunzioni esterne (inflazione, mercato, stagionalità)

7) ADVISOR MODE (SOLO SU RICHIESTA)
Puoi fornire interpretazioni SOLO se l’utente chiede esplicitamente:
- "analizza"
- "dammi consigli"
- "interpretazione"

Anche in advisor mode:
- NON generare nuovi numeri
- Le ipotesi devono essere dichiarate come tali

========================
GESTIONE INPUT CONVERSAZIONALI
========================

8) Se il messaggio è solo:
- grazie / ok / perfetto / capito / conferme simili

NON chiamare tool.
Rispondi brevemente: "Dimmi cosa vuoi analizzare."

========================
ERROR HANDLING
========================

9) Se una metrica non è calcolabile:
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

  // Intent classification - check if this requires tool calling
  const intentClassification = classifyIntent(userQuestion);
  console.log(`[QUERY-PLANNER] Intent: ${intentClassification.type}, requiresToolCall: ${intentClassification.requiresToolCall}`);

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

    // BLOCCO HARD: Se intent analitico e nessun tool chiamato, forza retry
    if (steps.length === 0 && intentClassification.requiresToolCall) {
      console.warn("[QUERY-PLANNER] FORCE RETRY: Analytical question but no tool called");
      throw new ForceToolRetryError(
        "La domanda richiede dati ma nessun tool è stato chiamato. Forzo retry.",
        userQuestion,
        intentClassification
      );
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
  userId?: string
): Promise<QueryExecutionResult> {
  console.log(`[QUERY-PLANNER] Processing question: "${userQuestion}" for ${datasets.length} datasets`);
  const startTime = Date.now();

  // ====== LAYER 1: INTENT ROUTER (AI - gemini-2.5-flash-lite) ======
  // Fast, cheap classification of user intent
  const routerOutput = await routeIntent(userQuestion, consultantId);
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
  }

  const result = await executePlanWithValidation(plan, datasets, consultantId, userId, userQuestion);
  console.log(`[QUERY-PLANNER] Execution complete in ${result.totalExecutionTimeMs}ms, success: ${result.success}`);

  return result;
}

/**
 * Generate a qualitative strategy response without any tool calls or numbers
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

REGOLE ASSOLUTE:
1. NON citare numeri specifici (€, %, quantità)
2. NON fare proiezioni numeriche
3. NON inventare dati
4. Fornisci consigli strategici generali

APPROCCIO:
- Identifica le leve strategiche (pricing, costi, volume, mix prodotti)
- Suggerisci framework di analisi
- Proponi azioni concrete senza quantificarle
- Se servono numeri per una risposta precisa, suggerisci di chiedere analytics specifici

ESEMPIO:
Domanda: "Come posso aumentare il fatturato?"
Risposta: "Per aumentare il fatturato puoi lavorare su tre leve principali:
1. **Volume**: Aumentare il numero di clienti o la frequenza degli ordini
2. **Prezzo**: Rivedere il pricing dei prodotti più venduti
3. **Mix**: Promuovere prodotti ad alto margine

Vuoi che analizzi i dati attuali per identificare le opportunità specifiche?"`;

  const datasetContext = datasets.length > 0 
    ? `\n\nDataset disponibile: "${datasets[0].name}" con ${datasets[0].rowCount} righe.`
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

    return response.response.text() || "Non ho potuto generare una risposta strategica. Prova a riformulare la domanda.";
  } catch (error: any) {
    console.error("[QUERY-PLANNER] Strategy response error:", error.message);
    return "Per rispondere a questa domanda strategica, ho bisogno di analizzare prima i dati. Vuoi che calcoli le metriche rilevanti?";
  }
}
