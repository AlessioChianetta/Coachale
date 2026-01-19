/**
 * Tool Definitions for Gemini Function Calling
 * These definitions describe the available data analysis tools for AI-driven queries
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

export const dataAnalysisTools: GeminiFunctionDeclaration[] = [
  {
    name: "query_metric",
    description: "Calcola una metrica usando la formula DSL. Supporta SUM, AVG, COUNT, MIN, MAX su colonne numeriche con filtri opzionali.",
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
    description: "Raggruppa dati per una o più colonne e calcola aggregazioni. Ideale per analisi per categoria, periodo, ecc.",
    parameters: {
      type: "object",
      properties: {
        datasetId: {
          type: "string",
          description: "ID del dataset"
        },
        groupBy: {
          type: "array",
          description: "Colonne per raggruppamento",
          items: { type: "string" }
        },
        aggregations: {
          type: "array",
          description: "Lista di aggregazioni: [{ column: 'importo', function: 'SUM', alias: 'totale' }]. Funzioni: SUM, AVG, COUNT, MIN, MAX",
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
          description: "Numero massimo di gruppi da restituire (default: 100)"
        }
      },
      required: ["datasetId", "groupBy", "aggregations"]
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
