/**
 * Smart Questions Generator
 * Generates intelligent questions based on actual data availability
 * 
 * Questions are VERIFIED against available metrics and dimensions
 */

import { db } from "../../db";
import { sql } from "drizzle-orm";
import { getSemanticMappings, type SemanticMapping } from "../../services/client-data/semantic-mapping-service";
import { METRIC_TEMPLATES, type MetricTemplate } from "./metric-templates";
import { LOGICAL_COLUMNS, getLogicalColumnDisplayName } from "./logical-columns";
import { getAIProvider } from "../ai-provider";
import { clientDataDatasets } from "../../../shared/schema";
import { eq } from "drizzle-orm";
import { safeTableName, safeColumnName } from "./sql-utils";

export interface SmartQuestionsResult {
  questions: string[];
  availableMetrics: string[];
  unavailableMetrics: string[];
  dimensions: Record<string, string[]>;
  dateRange: { min: string | null; max: string | null } | null;
  generatedAt: string;
  analysisTime: number;
  fromCache: boolean;
}

interface DatasetContext {
  datasetId: number;
  datasetName: string;
  tableName: string;
  rowCount: number;
  confirmedMappings: Map<string, string>;
  availableMetrics: string[];
  unavailableMetrics: string[];
  dimensions: Record<string, string[]>;
  dateRange: { min: string | null; max: string | null } | null;
}

const DIMENSION_COLUMNS = ['category', 'product_name', 'payment_method', 'customer_name', 'supplier_name', 'status', 'warehouse'];
const MAX_DIMENSION_VALUES = 20;

export function getAvailableMetrics(confirmedMappings: Map<string, string>): { available: string[]; unavailable: string[] } {
  const available: string[] = [];
  const unavailable: string[] = [];
  
  for (const [metricName, template] of Object.entries(METRIC_TEMPLATES)) {
    const hasAllColumns = template.requiredLogicalColumns.every(col => {
      if (confirmedMappings.has(col)) return true;
      if (col === 'document_id' && confirmedMappings.has('order_id')) return true;
      if (col === 'order_id' && confirmedMappings.has('document_id')) return true;
      return false;
    });
    
    if (hasAllColumns) {
      available.push(metricName);
    } else {
      unavailable.push(metricName);
    }
  }
  
  return { available, unavailable };
}

export async function exploreDimensions(
  tableName: string,
  confirmedMappings: Map<string, string>
): Promise<Record<string, string[]>> {
  const dimensions: Record<string, string[]> = {};
  
  for (const dimColumn of DIMENSION_COLUMNS) {
    const physicalColumn = confirmedMappings.get(dimColumn);
    if (!physicalColumn) continue;
    
    try {
      const query = sql.raw(`
        SELECT DISTINCT ${safeColumnName(physicalColumn)} as value, COUNT(*) as cnt
        FROM ${safeTableName(tableName)}
        WHERE ${safeColumnName(physicalColumn)} IS NOT NULL AND ${safeColumnName(physicalColumn)} != ''
        GROUP BY ${safeColumnName(physicalColumn)}
        ORDER BY cnt DESC
        LIMIT ${MAX_DIMENSION_VALUES}
      `);
      const result = await db.execute(query);
      const values = (result.rows as any[]).map(r => String(r.value));
      if (values.length > 0) {
        dimensions[dimColumn] = values;
      }
    } catch (error) {
      console.error(`[SMART-QUESTIONS] Failed to explore dimension ${dimColumn}:`, error);
    }
  }
  
  const waiterColumn = confirmedMappings.get('waiter') || 
    Array.from(confirmedMappings.entries()).find(([k, v]) => 
      v.toLowerCase().includes('waiter') || v.toLowerCase().includes('camerier')
    )?.[1];
  
  if (waiterColumn && !dimensions['waiter']) {
    try {
      const query = sql.raw(`
        SELECT DISTINCT ${safeColumnName(waiterColumn)} as value, COUNT(*) as cnt
        FROM ${safeTableName(tableName)}
        WHERE ${safeColumnName(waiterColumn)} IS NOT NULL AND ${safeColumnName(waiterColumn)} != ''
        GROUP BY ${safeColumnName(waiterColumn)}
        ORDER BY cnt DESC
        LIMIT ${MAX_DIMENSION_VALUES}
      `);
      const result = await db.execute(query);
      const values = (result.rows as any[]).map(r => String(r.value));
      if (values.length > 0) {
        dimensions['waiter'] = values;
      }
    } catch (error) {
    }
  }
  
  return dimensions;
}

export async function getDateRange(
  tableName: string,
  confirmedMappings: Map<string, string>
): Promise<{ min: string | null; max: string | null } | null> {
  const dateColumn = confirmedMappings.get('order_date');
  if (!dateColumn) return null;
  
  try {
    const query = sql.raw(`
      SELECT 
        MIN(${safeColumnName(dateColumn)})::text as min_date,
        MAX(${safeColumnName(dateColumn)})::text as max_date
      FROM ${safeTableName(tableName)}
      WHERE ${safeColumnName(dateColumn)} IS NOT NULL
    `);
    const result = await db.execute(query);
    const row = (result.rows as any[])[0];
    return {
      min: row?.min_date || null,
      max: row?.max_date || null,
    };
  } catch (error) {
    console.error(`[SMART-QUESTIONS] Failed to get date range:`, error);
    return null;
  }
}

async function buildDatasetContext(datasetId: number): Promise<DatasetContext> {
  const [dataset] = await db
    .select()
    .from(clientDataDatasets)
    .where(eq(clientDataDatasets.id, datasetId))
    .limit(1);
  
  if (!dataset || !dataset.tableName) {
    throw new Error(`Dataset ${datasetId} not found or has no table`);
  }
  
  const mappingResult = await getSemanticMappings(datasetId);
  const confirmedMappings = new Map<string, string>();
  
  for (const mapping of mappingResult.mappings) {
    if (mapping.status === 'confirmed') {
      confirmedMappings.set(mapping.logicalRole, mapping.physicalColumn);
    }
  }
  
  const { available, unavailable } = getAvailableMetrics(confirmedMappings);
  const dimensions = await exploreDimensions(dataset.tableName, confirmedMappings);
  const dateRange = await getDateRange(dataset.tableName, confirmedMappings);
  
  return {
    datasetId,
    datasetName: dataset.name,
    tableName: dataset.tableName,
    rowCount: dataset.rowCount || 0,
    confirmedMappings,
    availableMetrics: available,
    unavailableMetrics: unavailable,
    dimensions,
    dateRange,
  };
}

function generateQuestionsFromContext(context: DatasetContext): string[] {
  const questions: string[] = [];
  
  if (context.availableMetrics.includes('revenue')) {
    questions.push("Qual è il fatturato totale del periodo?");
    
    if (context.dimensions['category']) {
      const cats = context.dimensions['category'].slice(0, 3).join(', ');
      questions.push(`Come si distribuisce il fatturato per categoria (${cats}...)?`);
    }
    
    if (context.dateRange?.min && context.dateRange?.max) {
      questions.push("Come è andato il trend del fatturato nel tempo?");
    }
  }
  
  if (context.availableMetrics.includes('ticket_medio')) {
    questions.push("Qual è il ticket medio per ordine?");
  }
  
  if (context.availableMetrics.includes('document_count') || context.availableMetrics.includes('order_count')) {
    questions.push("Quanti ordini/scontrini sono stati registrati?");
  }
  
  if (context.availableMetrics.includes('quantity_total')) {
    questions.push("Quali sono i 10 prodotti più venduti per quantità?");
  }
  
  if (context.availableMetrics.includes('food_cost')) {
    questions.push("Qual è il food cost totale?");
  }
  
  if (context.availableMetrics.includes('food_cost_percent')) {
    questions.push("Qual è la percentuale di food cost sul fatturato?");
    
    if (context.dimensions['category']) {
      questions.push("Qual è il food cost % per ogni categoria?");
    }
  }
  
  if (context.availableMetrics.includes('gross_margin')) {
    questions.push("Quali sono i 10 prodotti con il margine lordo più alto?");
    questions.push("Quali prodotti hanno il margine più basso (da ottimizzare)?");
  }
  
  if (context.dimensions['waiter'] && context.dimensions['waiter'].length > 1) {
    const waiters = context.dimensions['waiter'].slice(0, 3).join(', ');
    questions.push(`Come si confrontano le performance dei camerieri (${waiters}...)?`);
  }
  
  if (context.dimensions['payment_method'] && context.dimensions['payment_method'].length > 1) {
    const methods = context.dimensions['payment_method'].join(', ');
    questions.push(`Come si distribuiscono i pagamenti per metodo (${methods})?`);
  }
  
  if (context.dimensions['category'] && context.availableMetrics.includes('revenue')) {
    questions.push("Qual è l'analisi ABC dei prodotti per fatturato?");
  }
  
  return questions.slice(0, 10);
}

export async function generateSmartQuestions(
  datasetId: number,
  consultantId: string
): Promise<SmartQuestionsResult> {
  const startTime = Date.now();
  console.log(`[SMART-QUESTIONS] Generating questions for dataset ${datasetId}`);
  
  try {
    const context = await buildDatasetContext(datasetId);
    
    const questions = generateQuestionsFromContext(context);
    
    const analysisTime = Date.now() - startTime;
    console.log(`[SMART-QUESTIONS] Generated ${questions.length} questions in ${analysisTime}ms`);
    
    return {
      questions,
      availableMetrics: context.availableMetrics,
      unavailableMetrics: context.unavailableMetrics,
      dimensions: context.dimensions,
      dateRange: context.dateRange,
      generatedAt: new Date().toISOString(),
      analysisTime,
      fromCache: false,
    };
  } catch (error) {
    console.error(`[SMART-QUESTIONS] Error generating questions:`, error);
    throw error;
  }
}
