/**
 * Query Planner using Gemini Function Calling
 * Analyzes user questions and plans which tools to use
 */

import { getAIProvider, getModelWithThinking } from "../provider-factory";
import { dataAnalysisTools, type ToolCall, type ExecutedToolResult, validateToolCall } from "./tool-definitions";
import { queryMetric, filterData, aggregateGroup, comparePeriods, getSchema, type QueryResult } from "../../services/client-data/query-executor";

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

const SYSTEM_PROMPT_IT = `Sei un assistente AI esperto in analisi dati. Il tuo compito è interpretare le domande dell'utente sui dati e decidere quali tool utilizzare per rispondere.

TOOL DISPONIBILI:
1. get_schema - Ottiene lo schema del dataset (colonne, tipi, metriche). USALO SEMPRE PRIMA se non conosci la struttura.
2. query_metric - Calcola metriche aggregate (SUM, AVG, COUNT, MIN, MAX) con filtri opzionali
3. compare_periods - Confronta una metrica tra due periodi temporali
4. filter_data - Filtra e restituisce righe specifiche
5. aggregate_group - Raggruppa dati e calcola aggregazioni per categoria

REGOLE:
- Se l'utente chiede informazioni sui dati senza specificare colonne, usa prima get_schema
- Per calcoli semplici (totale, media, conteggio) usa query_metric
- Per confronti temporali (mese scorso vs questo, anno su anno) usa compare_periods
- Per vedere dati filtrati usa filter_data
- Per analisi per categoria/gruppo usa aggregate_group
- Puoi chiamare più tool in sequenza se necessario

FORMATO DSL per query_metric:
- SUM(colonna) - somma
- AVG(colonna) - media
- COUNT(*) - conta righe
- MIN(colonna), MAX(colonna)
- Filtri: WHERE colonna = 'valore' AND colonna2 > 100
- Esempio: SUM(importo) WHERE data >= '2024-01-01' AND categoria = 'A'

Rispondi SOLO con le chiamate ai tool necessarie. Non aggiungere spiegazioni.`;

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
      contents: [
        { role: "user", parts: [{ text: userPrompt }] }
      ],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 2048,
      },
      tools: [{
        functionDeclarations: dataAnalysisTools
      }]
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
      steps.push({
        name: "get_schema",
        args: { datasetId: datasets[0].id }
      });
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
      return {
        steps: [{
          name: "get_schema",
          args: { datasetId: datasets[0].id }
        }],
        reasoning: "Fallback: ottenimento schema dataset",
        estimatedComplexity: "simple"
      };
    }

    return {
      steps: [],
      reasoning: `Errore nella pianificazione: ${error.message}`,
      estimatedComplexity: "simple"
    };
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

export async function askDataset(
  userQuestion: string,
  datasets: DatasetInfo[],
  consultantId?: string,
  userId?: string
): Promise<QueryExecutionResult> {
  console.log(`[QUERY-PLANNER] Processing question: "${userQuestion}" for ${datasets.length} datasets`);

  const plan = await planQuery(userQuestion, datasets, consultantId);
  console.log(`[QUERY-PLANNER] Plan: ${plan.steps.length} steps, complexity: ${plan.estimatedComplexity}`);

  const result = await executePlan(plan, userId);
  console.log(`[QUERY-PLANNER] Execution complete in ${result.totalExecutionTimeMs}ms, success: ${result.success}`);

  return result;
}
