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
import { classifyIntent, ForceToolRetryError, requiresNumericAnswer } from "./intent-classifier";
import { getMetricDefinition, getMetricDescriptionsForPrompt, isValidMetricName } from "./metric-registry";
import { MAX_GROUP_BY_LIMIT, METRIC_ENUM as TOOL_METRIC_ENUM } from "./tool-definitions";

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

const SYSTEM_PROMPT_IT = `Sei un assistente AI esperto in analisi dati. Il tuo compito è chiamare i tool corretti per rispondere alle domande.

REGOLA FONDAMENTALE: Per qualsiasi domanda su numeri/metriche, DEVI chiamare un tool. NON rispondere mai con numeri senza aver chiamato un tool.

METRICHE PREDEFINITE (usa execute_metric):
- revenue: Fatturato totale
- food_cost: Costo delle materie prime
- food_cost_percent: Percentuale food cost su fatturato
- ticket_medio: Valore medio per ordine
- quantity_total: Quantità totale articoli
- order_count: Numero ordini
- gross_margin: Margine lordo
- gross_margin_percent: Margine lordo percentuale
- discount_total: Sconti totali

TOOL DISPONIBILI (in ordine di priorità):
1. execute_metric - PREFERITO per metriche singole. Usa metricName dall'elenco sopra.
2. aggregate_group - Per breakdown: "per mese", "per categoria". Max 500 righe.
3. compare_periods - Per confronti temporali: "vs mese scorso"
4. filter_data - Per vedere righe specifiche. Max 1000 righe.

REGOLE OBBLIGATORIE:
- Domanda su fatturato/revenue → execute_metric con metricName: "revenue"
- Domanda su food cost → execute_metric con metricName: "food_cost" o "food_cost_percent"
- MAI inventare formule DSL se esiste una metrica predefinita
- MAI rispondere con numeri senza chiamare tool
- LIMIT obbligatorio su aggregate_group (max 500)

Rispondi SEMPRE con almeno una chiamata tool per domande analitiche.`;

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
        const metric = getMetricDefinition(toolCall.args.metricName);
        if (!metric) {
          console.error(`[EXECUTE-METRIC] Metric NOT FOUND: "${toolCall.args.metricName}"`);
          return {
            toolName: toolCall.name,
            args: toolCall.args,
            result: null,
            success: false,
            error: `Metrica non trovata: ${toolCall.args.metricName}`,
            executionTimeMs: Date.now() - startTime
          };
        }
        console.log(`[EXECUTE-METRIC] Found metric: ${metric.name}, SQL: ${metric.sqlExpression}`);
        // Use executeMetricSQL which executes raw SQL without DSL parser
        result = await executeMetricSQL(
          toolCall.args.datasetId, 
          metric.sqlExpression, 
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
          const metric = getMetricDefinition(toolCall.args.metricName);
          if (metric) {
            // Use the FULL SQL expression from the metric definition
            // This ensures complex formulas like SUM(unit_price * quantity) work correctly
            useRawSqlExpression = metric.sqlExpression;
            console.log(`[AGGREGATE-GROUP] Using raw SQL expression for "${toolCall.args.metricName}": ${useRawSqlExpression}`);
          } else {
            // Default fallback for unknown metrics
            aggregations = [{ column: "total_net", function: "SUM", alias: "totale" }];
            console.log(`[AGGREGATE-GROUP] Unknown metric, using default SUM(total_net)`);
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

  const plan = await planQuery(userQuestion, datasets, consultantId);
  console.log(`[QUERY-PLANNER] Plan: ${plan.steps.length} steps, complexity: ${plan.estimatedComplexity}`);

  const result = await executePlanWithValidation(plan, datasets, consultantId, userId, userQuestion);
  console.log(`[QUERY-PLANNER] Execution complete in ${result.totalExecutionTimeMs}ms, success: ${result.success}`);

  return result;
}
