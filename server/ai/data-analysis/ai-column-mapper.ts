/**
 * AI Column Mapper
 * Intelligent column mapping using AI analysis of actual data values
 * 
 * This module analyzes sample data from columns to suggest semantic mappings,
 * going beyond simple pattern matching on column names.
 */

import { db } from "../../db";
import { sql, eq } from "drizzle-orm";
import { LOGICAL_COLUMNS, COLUMN_AUTO_DETECT_PATTERNS, getLogicalColumnDisplayName } from "./logical-columns";
import { getAIProvider } from "../ai-provider";
import { CRITICAL_ROLES, type SemanticLogicalRole, semanticColumnMappings } from "../../../shared/schema";
import { safeTableName, safeColumnName } from "./sql-utils";

export interface ColumnStatistics {
  min: number | null;
  max: number | null;
  avg: number | null;
  nullCount: number;
  distinctCount: number;
  totalCount: number;
}

export interface ColumnAnalysis {
  physicalColumn: string;
  sampleValues: any[];
  detectedType: 'currency' | 'percentage' | 'integer' | 'decimal' | 'text' | 'date' | 'boolean';
  statistics: ColumnStatistics | null;
  suggestedLogicalRole: SemanticLogicalRole | null;
  confidence: number;
  reasoning: string;
  anomalies: string[];
  isCritical: boolean;
}

export interface AIMappingSuggestion {
  suggestions: ColumnAnalysis[];
  warnings: string[];
  unmappedColumns: string[];
  analysisTime: number;
}

const SAMPLE_SIZE = 100;

export async function getSampleData(
  tableName: string,
  columns: string[],
  limit: number = SAMPLE_SIZE
): Promise<Record<string, any[]>> {
  const result: Record<string, any[]> = {};
  
  for (const col of columns) {
    try {
      const query = sql.raw(`
        SELECT DISTINCT ${safeColumnName(col)} as value 
        FROM ${safeTableName(tableName)} 
        WHERE ${safeColumnName(col)} IS NOT NULL 
        LIMIT ${limit}
      `);
      const rows = await db.execute(query);
      result[col] = (rows.rows as any[]).map(r => r.value);
    } catch (error) {
      console.error(`[AI-MAPPER] Failed to sample column ${col}:`, error);
      result[col] = [];
    }
  }
  
  return result;
}

export async function getColumnStatistics(
  tableName: string,
  column: string
): Promise<ColumnStatistics | null> {
  try {
    const query = sql.raw(`
      SELECT 
        MIN(CAST(${safeColumnName(column)} AS NUMERIC)) as min_val,
        MAX(CAST(${safeColumnName(column)} AS NUMERIC)) as max_val,
        AVG(CAST(${safeColumnName(column)} AS NUMERIC)) as avg_val,
        COUNT(*) FILTER (WHERE ${safeColumnName(column)} IS NULL) as null_count,
        COUNT(DISTINCT ${safeColumnName(column)}) as distinct_count,
        COUNT(*) as total_count
      FROM ${safeTableName(tableName)}
    `);
    const rows = await db.execute(query);
    const row = (rows.rows as any[])[0];
    
    return {
      min: row.min_val !== null ? parseFloat(row.min_val) : null,
      max: row.max_val !== null ? parseFloat(row.max_val) : null,
      avg: row.avg_val !== null ? parseFloat(row.avg_val) : null,
      nullCount: parseInt(row.null_count) || 0,
      distinctCount: parseInt(row.distinct_count) || 0,
      totalCount: parseInt(row.total_count) || 0,
    };
  } catch (error) {
    return null;
  }
}

function detectDataType(values: any[]): 'currency' | 'percentage' | 'integer' | 'decimal' | 'text' | 'date' | 'boolean' {
  if (values.length === 0) return 'text';
  
  const nonNullValues = values.filter(v => v !== null && v !== undefined && v !== '');
  if (nonNullValues.length === 0) return 'text';
  
  const allBooleans = nonNullValues.every(v => 
    v === true || v === false || v === 0 || v === 1 || 
    v === '0' || v === '1' || v === 'true' || v === 'false'
  );
  if (allBooleans) return 'boolean';
  
  const allNumbers = nonNullValues.every(v => !isNaN(parseFloat(v)));
  if (allNumbers) {
    const nums = nonNullValues.map(v => parseFloat(v));
    const allIntegers = nums.every(n => Number.isInteger(n));
    
    if (allIntegers) return 'integer';
    
    const allPercentage = nums.every(n => n >= 0 && n <= 100);
    const avgValue = nums.reduce((a, b) => a + b, 0) / nums.length;
    if (allPercentage && avgValue < 50) return 'percentage';
    
    return 'decimal';
  }
  
  const datePatterns = [
    /^\d{4}-\d{2}-\d{2}/,
    /^\d{2}\/\d{2}\/\d{4}/,
    /^\d{2}-\d{2}-\d{4}/,
  ];
  const allDates = nonNullValues.every(v => 
    datePatterns.some(p => p.test(String(v))) || !isNaN(Date.parse(String(v)))
  );
  if (allDates) return 'date';
  
  return 'text';
}

function detectAnomalies(
  column: string,
  values: any[],
  stats: ColumnStatistics | null,
  detectedType: string
): string[] {
  const anomalies: string[] = [];
  
  if (stats) {
    if (stats.nullCount > stats.totalCount * 0.5) {
      anomalies.push(`Oltre il 50% dei valori sono NULL (${stats.nullCount}/${stats.totalCount})`);
    }
    
    if (detectedType === 'decimal' || detectedType === 'currency') {
      if (stats.min !== null && stats.min < 0) {
        anomalies.push(`Contiene valori negativi (min: ${stats.min})`);
      }
      
      if (stats.max !== null && stats.avg !== null) {
        if (stats.max > stats.avg * 100) {
          anomalies.push(`Possibili outlier: max (${stats.max.toFixed(2)}) molto maggiore della media (${stats.avg.toFixed(2)})`);
        }
      }
    }
    
    if (stats.distinctCount === 1 && stats.totalCount > 10) {
      anomalies.push(`Tutti i valori sono uguali - potrebbe essere inutile`);
    }
  }
  
  const colLower = column.toLowerCase();
  if ((colLower.includes('prezzo') || colLower.includes('price')) && stats?.avg && stats.avg < 5) {
    anomalies.push(`Colonna "prezzo" con media ${stats.avg.toFixed(2)}€ - verificare se non sia un costo`);
  }
  if ((colLower.includes('costo') || colLower.includes('cost')) && stats?.avg && stats.avg > 50) {
    anomalies.push(`Colonna "costo" con media ${stats.avg.toFixed(2)}€ - verificare se non sia un prezzo di vendita`);
  }
  
  return anomalies;
}

function suggestLogicalRoleFromName(column: string): { role: SemanticLogicalRole | null; confidence: number } {
  const nameLower = column.toLowerCase().trim();
  
  for (const [logical, patterns] of Object.entries(COLUMN_AUTO_DETECT_PATTERNS)) {
    for (let i = 0; i < patterns.length; i++) {
      if (patterns[i].test(nameLower)) {
        return {
          role: logical as SemanticLogicalRole,
          confidence: i === 0 ? 0.90 : 0.75,
        };
      }
    }
  }
  
  return { role: null, confidence: 0 };
}

function suggestLogicalRoleFromData(
  column: string,
  values: any[],
  stats: ColumnStatistics | null,
  detectedType: string
): { role: SemanticLogicalRole | null; confidence: number; reasoning: string } {
  const colLower = column.toLowerCase();
  
  if (detectedType === 'decimal' || detectedType === 'currency') {
    if (stats) {
      if (stats.avg !== null && stats.avg > 0 && stats.avg < 10 && stats.max !== null && stats.max < 50) {
        if (colLower.includes('cost') || colLower.includes('costo') || colLower.includes('acquisto')) {
          return {
            role: 'cost',
            confidence: 0.85,
            reasoning: `Valori bassi (media €${stats.avg.toFixed(2)}, max €${stats.max.toFixed(2)}) tipici di costi materia prima, nome contiene riferimento a costo`,
          };
        }
      }
      
      if (stats.avg !== null && stats.avg > 5 && stats.avg < 100) {
        if (colLower.includes('prezz') || colLower.includes('price') || colLower.includes('pvp')) {
          return {
            role: 'price',
            confidence: 0.85,
            reasoning: `Valori tipici di prezzi vendita (media €${stats.avg.toFixed(2)}), nome contiene riferimento a prezzo`,
          };
        }
        if (colLower.includes('final') || colLower.includes('total') || colLower.includes('importo')) {
          return {
            role: 'revenue_amount',
            confidence: 0.80,
            reasoning: `Nome suggerisce importo finale/totale, valori in range tipico`,
          };
        }
      }
    }
  }
  
  if (detectedType === 'integer') {
    if (stats && stats.distinctCount && stats.distinctCount < 20 && stats.avg !== null && stats.avg < 10) {
      if (colLower.includes('quant') || colLower.includes('qty') || colLower.includes('pezz')) {
        return {
          role: 'quantity',
          confidence: 0.85,
          reasoning: `Valori interi piccoli (media ${stats.avg.toFixed(1)}), tipici di quantità vendute`,
        };
      }
    }
  }
  
  if (detectedType === 'date') {
    if (colLower.includes('data') || colLower.includes('date') || colLower.includes('time')) {
      return {
        role: 'order_date',
        confidence: 0.80,
        reasoning: `Colonna di tipo data con nome che suggerisce data ordine/transazione`,
      };
    }
  }
  
  if (detectedType === 'text') {
    if (colLower.includes('categ') || colLower.includes('tipo') || colLower.includes('group')) {
      return {
        role: 'category',
        confidence: 0.75,
        reasoning: `Nome suggerisce categorizzazione prodotti`,
      };
    }
    if (colLower.includes('prod') || colLower.includes('item') || colLower.includes('descr')) {
      return {
        role: 'product_name',
        confidence: 0.70,
        reasoning: `Nome suggerisce descrizione prodotto`,
      };
    }
    if (colLower.includes('pagam') || colLower.includes('payment') || colLower.includes('paga')) {
      return {
        role: 'payment_method',
        confidence: 0.75,
        reasoning: `Nome suggerisce metodo di pagamento`,
      };
    }
  }
  
  return { role: null, confidence: 0, reasoning: '' };
}

export async function analyzeColumnsWithAI(
  datasetId: number,
  tableName: string,
  physicalColumns: string[]
): Promise<AIMappingSuggestion> {
  const startTime = Date.now();
  console.log(`[AI-MAPPER] Analyzing ${physicalColumns.length} columns for dataset ${datasetId}`);
  
  const suggestions: ColumnAnalysis[] = [];
  const warnings: string[] = [];
  const unmappedColumns: string[] = [];
  const suggestedRoles = new Map<string, string[]>();
  
  const sampleData = await getSampleData(tableName, physicalColumns);
  
  for (const column of physicalColumns) {
    const values = sampleData[column] || [];
    const detectedType = detectDataType(values);
    
    let stats: ColumnStatistics | null = null;
    if (detectedType === 'decimal' || detectedType === 'currency' || detectedType === 'integer' || detectedType === 'percentage') {
      stats = await getColumnStatistics(tableName, column);
    }
    
    const anomalies = detectAnomalies(column, values, stats, detectedType);
    
    const nameMatch = suggestLogicalRoleFromName(column);
    const dataMatch = suggestLogicalRoleFromData(column, values, stats, detectedType);
    
    let finalRole: SemanticLogicalRole | null = null;
    let finalConfidence = 0;
    let reasoning = '';
    
    if (nameMatch.role && dataMatch.role && nameMatch.role === dataMatch.role) {
      finalRole = nameMatch.role;
      finalConfidence = Math.min(0.95, nameMatch.confidence + 0.10);
      reasoning = `Nome colonna e analisi dati concordano: ${dataMatch.reasoning}`;
    } else if (dataMatch.confidence >= nameMatch.confidence && dataMatch.role) {
      finalRole = dataMatch.role;
      finalConfidence = dataMatch.confidence;
      reasoning = dataMatch.reasoning;
      if (nameMatch.role && nameMatch.role !== dataMatch.role) {
        warnings.push(`Conflitto per "${column}": nome suggerisce ${nameMatch.role}, ma dati suggeriscono ${dataMatch.role}`);
      }
    } else if (nameMatch.role) {
      finalRole = nameMatch.role;
      finalConfidence = nameMatch.confidence;
      reasoning = `Rilevato da pattern nome colonna`;
    }
    
    if (finalRole) {
      if (!suggestedRoles.has(finalRole)) {
        suggestedRoles.set(finalRole, []);
      }
      suggestedRoles.get(finalRole)!.push(column);
    } else {
      unmappedColumns.push(column);
    }
    
    const isCritical = finalRole ? CRITICAL_ROLES.includes(finalRole) : false;
    
    suggestions.push({
      physicalColumn: column,
      sampleValues: values.slice(0, 5),
      detectedType,
      statistics: stats,
      suggestedLogicalRole: finalRole,
      confidence: finalConfidence,
      reasoning,
      anomalies,
      isCritical,
    });
  }
  
  for (const [role, columns] of suggestedRoles.entries()) {
    if (columns.length > 1) {
      const displayName = getLogicalColumnDisplayName(role, 'it');
      warnings.push(`Trovate ${columns.length} potenziali colonne per "${displayName}": ${columns.join(', ')}. Seleziona quale usare.`);
    }
  }
  
  const analysisTime = Date.now() - startTime;
  console.log(`[AI-MAPPER] Analysis complete in ${analysisTime}ms: ${suggestions.filter(s => s.suggestedLogicalRole).length} suggestions, ${warnings.length} warnings`);
  
  return {
    suggestions,
    warnings,
    unmappedColumns,
    analysisTime,
  };
}

export async function generateAIMappingSuggestions(
  datasetId: number,
  tableName: string
): Promise<AIMappingSuggestion> {
  if (!/^cdd_[a-z0-9_]+$/i.test(tableName)) {
    throw new Error(`Invalid table name format: ${tableName}`);
  }
  
  const columnsQuery = sql`
    SELECT column_name 
    FROM information_schema.columns 
    WHERE table_name = ${tableName}
    ORDER BY ordinal_position
  `;
  
  const columnsResult = await db.execute(columnsQuery);
  const allPhysicalColumns = (columnsResult.rows as any[]).map(r => r.column_name);
  
  const confirmedMappings = await db
    .select({ physicalColumn: semanticColumnMappings.physicalColumn })
    .from(semanticColumnMappings)
    .where(eq(semanticColumnMappings.datasetId, datasetId));
  
  const confirmedColumnSet = new Set(confirmedMappings.map(m => m.physicalColumn));
  
  const physicalColumns = allPhysicalColumns.filter(col => !confirmedColumnSet.has(col));
  
  console.log(`[AI-MAPPER] Dataset ${datasetId}: ${allPhysicalColumns.length} total columns, ${confirmedColumnSet.size} already confirmed, analyzing ${physicalColumns.length}`);
  
  return analyzeColumnsWithAI(datasetId, tableName, physicalColumns);
}
