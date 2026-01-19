/**
 * Query Planner using Gemini Function Calling
 * Analyzes user questions and plans which tools to use
 */

import { getAIProvider, getModelWithThinking } from "../provider-factory";
import { dataAnalysisTools, type ToolCall, type ExecutedToolResult, validateToolCall, getToolByName } from "./tool-definitions";
import { queryMetric, filterData, aggregateGroup, comparePeriods, getSchema, type QueryResult } from "../../services/client-data/query-executor";
import { parseMetricExpression, validateMetricAgainstSchema } from "../../services/client-data/metric-dsl";
import { db } from "../../db";
import { clientDataDatasets } from "../../../shared/schema";
import { eq } from "drizzle-orm";

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

const SYSTEM_PROMPT_IT = `Sei un assistente AI esperto in analisi dati. Il tuo compito è interpretare le domande dell'utente e decidere quale tool usare per rispondere.

IMPORTANTE: Lo schema del dataset ti viene fornito nel messaggio. NON usare get_schema, hai già tutte le informazioni necessarie.

TOOL DISPONIBILI (in ordine di priorità):
1. aggregate_group - Per analisi raggruppate: "per mese", "per categoria", "per prodotto", "top 10", ecc.
2. query_metric - Per un singolo valore aggregato: "totale vendite", "media prezzi", "quanti ordini"
3. compare_periods - Per confronti temporali: "questo mese vs scorso", "anno su anno"
4. filter_data - Per vedere righe specifiche: "mostrami gli ordini di gennaio", "clienti con importo > 1000"
5. get_schema - SOLO se esplicitamente richiesto ("che colonne hai?", "mostrami la struttura")

REGOLE DI SCELTA:
- "totale/media/conteggio PER qualcosa" → aggregate_group (raggruppa per quella dimensione)
- "totale/media/conteggio" senza raggruppamento → query_metric
- "mostrami", "elenca", "quali sono" → filter_data o aggregate_group
- "confronta", "vs", "rispetto a" → compare_periods

ESEMPI PRATICI:
- "Mostrami il totale delle vendite per mese" → aggregate_group con groupBy: ["mese"] o colonna data
- "Quali sono i 10 prodotti più venduti?" → aggregate_group con groupBy: ["prodotto"], limit: 10
- "Qual è il fatturato totale?" → query_metric con dsl: "SUM(importo)"
- "Mostrami gli ordini di gennaio" → filter_data con filtro sulla data

Per aggregate_group, usa questo formato:
- groupBy: colonne per raggruppare (es: ["order_date"] per raggruppare per data)
- aggregations: [{ column: "importo", function: "SUM", alias: "totale" }]
- orderBy: { column: "totale", direction: "DESC" } per ordinare

Rispondi SOLO con le chiamate ai tool. Mai get_schema se lo schema è già fornito.`;

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

    case "compare_periods": {
      const dsl = toolCall.args.dsl;
      const dateColumn = toolCall.args.dateColumn;
      
      if (!dsl || typeof dsl !== "string") {
        errors.push("DSL expression is required");
      }
      if (!dateColumn || !schema.columns.includes(dateColumn)) {
        errors.push(`Invalid date column: ${dateColumn}. Available: ${schema.columns.slice(0, 5).join(", ")}...`);
      }
      if (dateColumn && schema.columnTypes[dateColumn] !== "DATE") {
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

    if (steps.length === 0 && datasets.length > 0) {
      console.log("[QUERY-PLANNER] No function calls returned, attempting intelligent fallback");
      const hasGroupingIntent = /per\s+(mese|anno|categoria|prodotto|cliente|giorno)|raggruppat|suddivi|top\s+\d+/i.test(userQuestion);
      const hasAggregationIntent = /totale|somma|media|average|conteggio|count|quant[io]|massimo|minimo/i.test(userQuestion);
      
      console.log("[QUERY-PLANNER] Fallback intent detection:", { hasGroupingIntent, hasAggregationIntent });
      console.log("[QUERY-PLANNER] Dataset columns:", datasets[0].columns.map(c => ({ name: c.name, type: c.dataType })));
      
      if (hasGroupingIntent || hasAggregationIntent) {
        const numericCols = datasets[0].columns.filter(c => 
          /^(NUMERIC|INTEGER|number|decimal)$/i.test(c.dataType)
        );
        const dateCols = datasets[0].columns.filter(c => 
          /^(DATE|datetime|timestamp)$/i.test(c.dataType)
        );
        const textCols = datasets[0].columns.filter(c => 
          /^(TEXT|varchar|string)$/i.test(c.dataType)
        );
        
        console.log("[QUERY-PLANNER] Column types found:", { 
          numericCols: numericCols.map(c => c.name), 
          dateCols: dateCols.map(c => c.name),
          textCols: textCols.map(c => c.name)
        });
        
        if (numericCols.length > 0) {
          let groupByCol: string | null = null;
          let groupByExpression: string | null = null;
          
          const wantsMonthGrouping = /per\s+mese|mensil|monthly/i.test(userQuestion);
          const wantsYearGrouping = /per\s+anno|annual|yearly/i.test(userQuestion);
          
          if (dateCols.length > 0) {
            const dateCol = dateCols[0].name;
            if (wantsMonthGrouping) {
              groupByExpression = `DATE_TRUNC('month', "${dateCol}")`;
              groupByCol = "mese";
            } else if (wantsYearGrouping) {
              groupByExpression = `DATE_TRUNC('year', "${dateCol}")`;
              groupByCol = "anno";
            } else {
              groupByCol = dateCol;
            }
          } else if (textCols.length > 0) {
            groupByCol = textCols[0].name;
          }
          
          const sumCol = numericCols.find(c => /total|importo|prezzo|price|net|revenue|amount/i.test(c.name)) || numericCols[0];
          
          if (groupByCol) {
            steps.push({
              name: "aggregate_group",
              args: {
                datasetId: String(datasets[0].id),
                groupBy: groupByExpression ? [groupByExpression] : [groupByCol],
                groupByAlias: groupByExpression ? groupByCol : undefined,
                aggregations: [{ column: sumCol.name, function: "SUM", alias: "totale" }],
                orderBy: { column: "totale", direction: "DESC" },
                limit: 20
              }
            });
            console.log("[QUERY-PLANNER] Using intelligent fallback: aggregate_group by", groupByExpression || groupByCol, "sum of", sumCol.name);
          }
        }
      }
      
      if (steps.length === 0) {
        steps.push({
          name: "filter_data",
          args: { datasetId: String(datasets[0].id), filters: {}, limit: 50 }
        });
        console.log("[QUERY-PLANNER] Using fallback: filter_data (show sample rows)");
      }
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
      const numericCols = datasets[0].columns.filter(c => c.dataType === "NUMERIC" || c.dataType === "INTEGER");
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

      case "aggregate_group":
        result = await aggregateGroup(
          toolCall.args.datasetId,
          toolCall.args.groupBy,
          toolCall.args.aggregations,
          toolCall.args.filters,
          toolCall.args.orderBy,
          toolCall.args.limit || 100,
          { userId }
        );
        break;

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
