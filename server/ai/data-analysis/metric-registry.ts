/**
 * Metric Registry - Semantic Layer for Canonical Metrics
 * 
 * Gemini can ONLY select from these pre-defined metrics.
 * NO custom DSL allowed - eliminates 70% of errors.
 */

import { db } from "../../db";
import { clientDataMetrics, clientDataDatasets } from "../../../shared/schema";
import { eq, and } from "drizzle-orm";

export interface MetricDefinition {
  id: number;
  name: string;
  displayName: string;
  description?: string;
  sqlExpression: string;
  unit: "currency" | "percentage" | "number" | "count";
  validationRules: ValidationRules;
  dependsOn?: string[];
  isPrimary: boolean;
  version: number;
}

export interface ValidationRules {
  minValue?: number;
  maxValue?: number;
  mustBePositive?: boolean;
  mustBeInteger?: boolean;
  warningThreshold?: number;
  warningMessage?: string;
}

export interface ColumnDefinition {
  name: string;
  displayName: string;
  dataType: "TEXT" | "NUMERIC" | "INTEGER" | "DATE" | "BOOLEAN";
  allowedAggregations: ("SUM" | "AVG" | "COUNT" | "MIN" | "MAX")[];
  isNumeric: boolean;
  description?: string;
}

const STANDARD_METRICS: Record<string, Omit<MetricDefinition, "id">> = {
  revenue: {
    name: "revenue",
    displayName: "Fatturato",
    description: "Somma totale delle vendite",
    sqlExpression: 'SUM(CAST("total_net" AS NUMERIC))',
    unit: "currency",
    validationRules: {
      mustBePositive: true,
      minValue: 0,
    },
    isPrimary: true,
    version: 1,
  },
  food_cost: {
    name: "food_cost",
    displayName: "Food Cost",
    description: "Costo totale delle materie prime",
    sqlExpression: 'SUM(CAST("unit_cost" AS NUMERIC) * CAST("quantity" AS NUMERIC))',
    unit: "currency",
    validationRules: {
      mustBePositive: true,
      minValue: 0,
    },
    isPrimary: true,
    version: 1,
  },
  food_cost_percent: {
    name: "food_cost_percent",
    displayName: "Food Cost %",
    description: "Percentuale food cost su fatturato",
    sqlExpression: '(SUM(CAST("unit_cost" AS NUMERIC) * CAST("quantity" AS NUMERIC)) / NULLIF(SUM(CAST("total_net" AS NUMERIC)), 0)) * 100',
    unit: "percentage",
    validationRules: {
      minValue: 0,
      maxValue: 100,
      warningThreshold: 60,
      warningMessage: "Food cost superiore al 60% - verificare margini",
    },
    dependsOn: ["food_cost", "revenue"],
    isPrimary: true,
    version: 1,
  },
  ticket_medio: {
    name: "ticket_medio",
    displayName: "Ticket Medio",
    description: "Valore medio per ordine",
    sqlExpression: 'AVG(CAST("total_net" AS NUMERIC))',
    unit: "currency",
    validationRules: {
      mustBePositive: true,
      minValue: 0,
    },
    isPrimary: true,
    version: 1,
  },
  quantity_total: {
    name: "quantity_total",
    displayName: "Quantità Totale",
    description: "Numero totale di articoli venduti",
    sqlExpression: 'SUM(CAST("quantity" AS NUMERIC))',
    unit: "count",
    validationRules: {
      mustBePositive: true,
      mustBeInteger: true,
      minValue: 0,
    },
    isPrimary: true,
    version: 1,
  },
  order_count: {
    name: "order_count",
    displayName: "Numero Ordini",
    description: "Conteggio ordini unici",
    sqlExpression: 'COUNT(DISTINCT "order_id")',
    unit: "count",
    validationRules: {
      mustBePositive: true,
      mustBeInteger: true,
      minValue: 0,
    },
    isPrimary: true,
    version: 1,
  },
  avg_unit_price: {
    name: "avg_unit_price",
    displayName: "Prezzo Medio Unitario",
    description: "Prezzo medio per unità venduta",
    sqlExpression: 'AVG(CAST("unit_price" AS NUMERIC))',
    unit: "currency",
    validationRules: {
      mustBePositive: true,
      minValue: 0,
    },
    isPrimary: false,
    version: 1,
  },
  gross_margin: {
    name: "gross_margin",
    displayName: "Margine Lordo",
    description: "Fatturato meno food cost",
    sqlExpression: 'SUM(CAST("total_net" AS NUMERIC)) - SUM(CAST("unit_cost" AS NUMERIC) * CAST("quantity" AS NUMERIC))',
    unit: "currency",
    validationRules: {},
    dependsOn: ["revenue", "food_cost"],
    isPrimary: true,
    version: 1,
  },
  gross_margin_percent: {
    name: "gross_margin_percent",
    displayName: "Margine Lordo %",
    description: "Percentuale margine lordo su fatturato",
    sqlExpression: '((SUM(CAST("total_net" AS NUMERIC)) - SUM(CAST("unit_cost" AS NUMERIC) * CAST("quantity" AS NUMERIC))) / NULLIF(SUM(CAST("total_net" AS NUMERIC)), 0)) * 100',
    unit: "percentage",
    validationRules: {
      minValue: 0,
      maxValue: 100,
    },
    dependsOn: ["gross_margin", "revenue"],
    isPrimary: false,
    version: 1,
  },
  discount_total: {
    name: "discount_total",
    displayName: "Sconti Totali",
    description: "Somma degli sconti applicati",
    sqlExpression: 'SUM(CAST("total_net" AS NUMERIC) * (CAST("discount_percent" AS NUMERIC) / 100))',
    unit: "currency",
    validationRules: {
      mustBePositive: true,
      minValue: 0,
    },
    isPrimary: false,
    version: 1,
  },
};

export function getStandardMetrics(): Record<string, Omit<MetricDefinition, "id">> {
  return STANDARD_METRICS;
}

export function getStandardMetricNames(): string[] {
  return Object.keys(STANDARD_METRICS);
}

export function isValidMetricName(name: string): boolean {
  return name in STANDARD_METRICS;
}

export function getMetricDefinition(name: string): Omit<MetricDefinition, "id"> | null {
  return STANDARD_METRICS[name] || null;
}

export async function getMetricsForDataset(datasetId: string | number): Promise<MetricDefinition[]> {
  const numericId = typeof datasetId === 'string' ? parseInt(datasetId, 10) : datasetId;
  
  const dbMetrics = await db
    .select()
    .from(clientDataMetrics)
    .where(and(
      eq(clientDataMetrics.datasetId, numericId),
      eq(clientDataMetrics.isActive, true)
    ));
  
  if (dbMetrics.length > 0) {
    return dbMetrics.map(m => ({
      id: m.id,
      name: m.name,
      displayName: m.displayName || m.name,
      description: m.displayName || undefined,
      sqlExpression: m.formulaSql || m.formulaDsl,
      unit: (m.resultType as any) || "number",
      validationRules: {},
      isPrimary: !m.isAutoGenerated,
      version: 1,
    }));
  }
  
  return Object.entries(STANDARD_METRICS).map(([name, def], idx) => ({
    id: idx + 1,
    ...def,
  }));
}

export async function getDatasetColumns(datasetId: string | number): Promise<ColumnDefinition[]> {
  const numericId = typeof datasetId === 'string' ? parseInt(datasetId, 10) : datasetId;
  
  const [dataset] = await db
    .select()
    .from(clientDataDatasets)
    .where(eq(clientDataDatasets.id, numericId))
    .limit(1);
  
  if (!dataset || !dataset.columnMapping) {
    return [];
  }
  
  return Object.entries(dataset.columnMapping as Record<string, { displayName: string; dataType: string; description?: string }>).map(([name, info]) => {
    const dataType = (info.dataType?.toUpperCase() || "TEXT") as ColumnDefinition["dataType"];
    const isNumeric = ["NUMERIC", "INTEGER", "NUMBER", "DECIMAL"].includes(dataType);
    
    return {
      name,
      displayName: info.displayName || name,
      dataType,
      isNumeric,
      description: info.description,
      allowedAggregations: isNumeric 
        ? ["SUM", "AVG", "COUNT", "MIN", "MAX"] as const
        : ["COUNT"] as const,
    };
  });
}

export function validateColumnForAggregation(
  column: ColumnDefinition,
  aggregation: string
): { valid: boolean; error?: string } {
  const agg = aggregation.toUpperCase() as "SUM" | "AVG" | "COUNT" | "MIN" | "MAX";
  
  if (!column.allowedAggregations.includes(agg)) {
    return {
      valid: false,
      error: `Colonna "${column.name}" (${column.dataType}) non supporta ${agg}. Aggregazioni permesse: ${column.allowedAggregations.join(", ")}`,
    };
  }
  
  return { valid: true };
}

export async function initializeMetricsForDataset(datasetId: number, consultantId: string): Promise<void> {
  const existingMetrics = await db
    .select()
    .from(clientDataMetrics)
    .where(eq(clientDataMetrics.datasetId, datasetId))
    .limit(1);
  
  if (existingMetrics.length > 0) {
    console.log(`[METRIC-REGISTRY] Dataset ${datasetId} already has metrics`);
    return;
  }
  
  const standardMetrics = Object.entries(STANDARD_METRICS);
  
  for (const [name, def] of standardMetrics) {
    try {
      await db.insert(clientDataMetrics).values({
        datasetId,
        name: def.name,
        displayName: def.displayName,
        formulaDsl: def.sqlExpression,
        formulaSql: def.sqlExpression,
        resultType: def.unit,
        formatPattern: def.unit === "currency" ? "#,##0.00 €" : 
                       def.unit === "percentage" ? "#,##0.00%" : 
                       "#,##0",
        isAutoGenerated: true,
        isActive: true,
      });
    } catch (error: any) {
      console.error(`[METRIC-REGISTRY] Failed to insert metric ${name}:`, error.message);
    }
  }
  
  console.log(`[METRIC-REGISTRY] Initialized ${standardMetrics.length} standard metrics for dataset ${datasetId}`);
}

export function resolveMetricToSQL(metricName: string, tableName: string): { sql: string; valid: boolean; error?: string } {
  const metric = STANDARD_METRICS[metricName];
  
  if (!metric) {
    return {
      sql: "",
      valid: false,
      error: `Metrica "${metricName}" non trovata. Metriche disponibili: ${Object.keys(STANDARD_METRICS).join(", ")}`,
    };
  }
  
  const sql = `SELECT ${metric.sqlExpression} AS result FROM "${tableName}"`;
  
  return {
    sql,
    valid: true,
  };
}

export function getMetricEnumForGemini(): string[] {
  return Object.keys(STANDARD_METRICS);
}

export function getMetricDescriptionsForPrompt(): string {
  return Object.entries(STANDARD_METRICS)
    .map(([name, def]) => `- ${name}: ${def.displayName} (${def.description || "nessuna descrizione"})`)
    .join("\n");
}
