/**
 * Tool Definitions for Gemini Function Calling
 * These definitions describe the available data analysis tools for AI-driven queries
 * 
 * SECURITY: Gemini can ONLY use pre-defined metrics (execute_metric) - NO custom DSL allowed
 * This eliminates 70% of hallucination errors
 */

export interface GeminiFunctionDeclaration {
  name: string;
  description: string;
  parameters: {
    type: "object";
    properties: Record<string, {
      type: string;
      description: string;
      items?: { type: string };
      properties?: Record<string, any>;
      enum?: string[];
    }>;
    required: string[];
  };
}

export const METRIC_ENUM = [
  "revenue",
  "food_cost", 
  "food_cost_percent",
  "ticket_medio",
  "quantity_total",
  "order_count",
  "avg_unit_price",
  "gross_margin",
  "gross_margin_percent",
  "discount_total",
  "discount_percent_on_revenue",
] as const;

export type MetricName = typeof METRIC_ENUM[number];

export const MAX_GROUP_BY_LIMIT = 500;
export const MAX_FILTER_LIMIT = 1000;
export const SQL_TIMEOUT_MS = 3000;

export const dataAnalysisTools: GeminiFunctionDeclaration[] = [
  {
    name: "execute_metric",
    description: "PREFERITO: Calcola una metrica predefinita. USA SOLO metriche dall'elenco. NON inventare formule.",
    parameters: {
      type: "object",
      properties: {
        metricName: {
          type: "string",
          description: "Nome della metrica predefinita da calcolare",
          enum: [...METRIC_ENUM],
        },
        datasetId: {
          type: "string",
          description: "ID del dataset su cui eseguire la query"
        },
        filters: {
          type: "object",
          description: "Filtri opzionali: { colonna: { operator: '=', value: 'valore' } }"
        }
      },
      required: ["metricName", "datasetId"]
    }
  },
  {
    name: "query_metric",
    description: "[DEPRECATO - usa execute_metric] Calcola una metrica usando formula DSL. Solo per casi speciali non coperti da metriche predefinite.",
    parameters: {
      type: "object",
      properties: {
        dsl: {
          type: "string",
          description: "Formula DSL per calcolare la metrica. Esempi: 'SUM(importo)', 'AVG(prezzo) WHERE categoria = \"A\"', 'COUNT(*) WHERE data >= \"2024-01-01\"'"
        },
        datasetId: {
          type: "string",
          description: "ID del dataset su cui eseguire la query"
        }
      },
      required: ["dsl", "datasetId"]
    }
  },
  {
    name: "compare_periods",
    description: "Confronta una metrica tra due periodi temporali per analisi trend. Calcola differenza assoluta e percentuale.",
    parameters: {
      type: "object",
      properties: {
        dsl: {
          type: "string",
          description: "Formula DSL della metrica da confrontare (es: 'SUM(fatturato)')"
        },
        datasetId: {
          type: "string",
          description: "ID del dataset"
        },
        dateColumn: {
          type: "string",
          description: "Nome della colonna data da usare per il filtro temporale"
        },
        period1Start: {
          type: "string",
          description: "Data inizio primo periodo (formato YYYY-MM-DD)"
        },
        period1End: {
          type: "string",
          description: "Data fine primo periodo (formato YYYY-MM-DD)"
        },
        period2Start: {
          type: "string",
          description: "Data inizio secondo periodo (formato YYYY-MM-DD)"
        },
        period2End: {
          type: "string",
          description: "Data fine secondo periodo (formato YYYY-MM-DD)"
        }
      },
      required: ["dsl", "datasetId", "dateColumn", "period1Start", "period1End", "period2Start", "period2End"]
    }
  },
  {
    name: "filter_data",
    description: "Filtra e restituisce righe che matchano le condizioni specificate. Utile per esplorare dati specifici.",
    parameters: {
      type: "object",
      properties: {
        datasetId: {
          type: "string",
          description: "ID del dataset"
        },
        filters: {
          type: "object",
          description: "Oggetto con condizioni di filtro. Formato: { nomeColonna: { operator: '=', value: 'valore' } }. Operatori supportati: =, !=, >, <, >=, <="
        },
        columns: {
          type: "array",
          description: "Lista colonne da selezionare (opzionale, default: tutte)",
          items: { type: "string" }
        },
        limit: {
          type: "number",
          description: "Numero massimo di righe da restituire (default: 100, max: 1000)"
        }
      },
      required: ["datasetId", "filters"]
    }
  },
  {
    name: "aggregate_group",
    description: "Raggruppa dati per una o più colonne e calcola aggregazioni. LIMIT massimo 500 righe per performance. Per raggruppamenti temporali (per mese, per anno), usa SEMPRE timeGranularity invece di raggruppare per data grezza.",
    parameters: {
      type: "object",
      properties: {
        datasetId: {
          type: "string",
          description: "ID del dataset"
        },
        groupBy: {
          type: "array",
          description: "Colonne per raggruppamento (max 3 colonne). Per date, specifica anche timeGranularity.",
          items: { type: "string" }
        },
        timeGranularity: {
          type: "string",
          description: "OBBLIGATORIO per raggruppamenti temporali. Specifica la granularità: 'day', 'week', 'month', 'quarter', 'year'. Esempio: se utente chiede 'vendite per mese', usa timeGranularity='month'",
          enum: ["day", "week", "month", "quarter", "year"]
        },
        dateColumn: {
          type: "string",
          description: "Colonna data da usare con timeGranularity (es. 'order_date'). Richiesto se timeGranularity è specificato."
        },
        metricName: {
          type: "string",
          description: "Metrica predefinita da aggregare (preferito rispetto ad aggregations custom)",
          enum: [...METRIC_ENUM],
        },
        aggregations: {
          type: "array",
          description: "DEPRECATO: usa metricName. Lista di aggregazioni: [{ column: 'importo', function: 'SUM', alias: 'totale' }]",
          items: { type: "object" }
        },
        filters: {
          type: "object",
          description: "Filtri opzionali da applicare prima del raggruppamento"
        },
        orderBy: {
          type: "object",
          description: "Ordinamento: { column: 'totale', direction: 'DESC' }"
        },
        limit: {
          type: "number",
          description: "Numero massimo di gruppi (default: 100, MAX: 500)"
        }
      },
      required: ["datasetId", "groupBy"]
    }
  },
  {
    name: "get_schema",
    description: "Ottiene lo schema del dataset: colonne disponibili, tipi di dato, descrizioni e metriche pre-definite. Usa questo tool prima di fare query per conoscere la struttura dei dati.",
    parameters: {
      type: "object",
      properties: {
        datasetId: {
          type: "string",
          description: "ID del dataset di cui ottenere lo schema"
        }
      },
      required: ["datasetId"]
    }
  }
];

export interface ToolCall {
  name: string;
  args: Record<string, any>;
}

export interface ExecutedToolResult {
  toolName: string;
  args: Record<string, any>;
  result: any;
  success: boolean;
  error?: string;
  executionTimeMs?: number;
  // Auto-fallback metadata for high cardinality situations
  _fallbackApplied?: boolean;
  _originalDistinctCount?: number;
  _fallbackLimit?: number;
}

export function getToolByName(name: string): GeminiFunctionDeclaration | undefined {
  return dataAnalysisTools.find(t => t.name === name);
}

export function validateToolCall(toolCall: ToolCall): { valid: boolean; errors: string[] } {
  const tool = getToolByName(toolCall.name);
  if (!tool) {
    return { valid: false, errors: [`Tool non trovato: ${toolCall.name}`] };
  }

  const errors: string[] = [];
  for (const required of tool.parameters.required) {
    if (toolCall.args[required] === undefined || toolCall.args[required] === null) {
      errors.push(`Parametro obbligatorio mancante: ${required}`);
    }
  }

  return { valid: errors.length === 0, errors };
}
