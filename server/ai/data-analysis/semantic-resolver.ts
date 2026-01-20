/**
 * Semantic Resolver
 * Translates metric templates with {placeholder} into actual SQL with physical column names
 * 
 * UNIVERSAL BI SEMANTIC LAYER
 * Supports aliases: document_id ↔ order_id are interchangeable
 */

import { db } from "../../db";
import { datasetColumnSemantics, clientDataDatasets } from "../../../shared/schema";
import { eq, and } from "drizzle-orm";
import { 
  LOGICAL_COLUMNS, 
  getLogicalColumnDisplayName, 
  COLUMN_AUTO_DETECT_PATTERNS,
  LOGICAL_COLUMN_ALIASES,
  resolveWithAliases
} from "./logical-columns";

export interface ResolveResult {
  sql: string;
  valid: boolean;
  missingColumns?: { logical: string; displayName: string }[];
  error?: string;
  resolvedAliases?: { original: string; resolvedTo: string; physicalColumn: string }[];
}

export interface ColumnMappingLookup {
  [logicalColumn: string]: string;
}

export async function getColumnMappingsForDataset(datasetId: number): Promise<ColumnMappingLookup> {
  const mappings = await db
    .select()
    .from(datasetColumnSemantics)
    .where(
      and(
        eq(datasetColumnSemantics.datasetId, datasetId),
        eq(datasetColumnSemantics.status, "confirmed")
      )
    );
  
  const lookup: ColumnMappingLookup = {};
  for (const mapping of mappings) {
    lookup[mapping.logicalRole] = mapping.physicalColumn;
  }
  
  return lookup;
}

export function extractPlaceholders(sqlTemplate: string): string[] {
  const regex = /\{(\w+)\}/g;
  const placeholders: string[] = [];
  let match;
  
  while ((match = regex.exec(sqlTemplate)) !== null) {
    if (!placeholders.includes(match[1])) {
      placeholders.push(match[1]);
    }
  }
  
  return placeholders;
}

export function resolvePlaceholdersWithAliases(
  sqlTemplate: string,
  mappings: ColumnMappingLookup
): ResolveResult {
  const placeholders = extractPlaceholders(sqlTemplate);
  const missing: { logical: string; displayName: string }[] = [];
  const resolvedAliases: { original: string; resolvedTo: string; physicalColumn: string }[] = [];
  const resolvedMappings: ColumnMappingLookup = {};
  
  for (const placeholder of placeholders) {
    const physicalColumn = resolveWithAliases(placeholder, mappings);
    
    if (!physicalColumn) {
      missing.push({
        logical: placeholder,
        displayName: getLogicalColumnDisplayName(placeholder, "it"),
      });
    } else {
      resolvedMappings[placeholder] = physicalColumn;
      
      if (!mappings[placeholder] && physicalColumn) {
        const aliases = LOGICAL_COLUMN_ALIASES[placeholder] || [];
        for (const alias of aliases) {
          if (mappings[alias]) {
            resolvedAliases.push({
              original: placeholder,
              resolvedTo: alias,
              physicalColumn
            });
            break;
          }
        }
      }
    }
  }
  
  if (missing.length > 0) {
    return {
      sql: "",
      valid: false,
      missingColumns: missing,
      error: `Colonne mancanti: ${missing.map(m => m.displayName).join(", ")}`,
    };
  }
  
  let resolvedSql = sqlTemplate;
  for (const [logical, physical] of Object.entries(resolvedMappings)) {
    const regex = new RegExp(`\\{${logical}\\}`, "g");
    resolvedSql = resolvedSql.replace(regex, `"${physical}"`);
  }
  
  if (resolvedAliases.length > 0) {
    console.log(`[SEMANTIC-RESOLVER] Resolved aliases: ${resolvedAliases.map(a => `${a.original} → ${a.resolvedTo} (${a.physicalColumn})`).join(", ")}`);
  }
  
  return {
    sql: resolvedSql,
    valid: true,
    resolvedAliases: resolvedAliases.length > 0 ? resolvedAliases : undefined,
  };
}

export function resolvePlaceholders(
  sqlTemplate: string,
  mappings: ColumnMappingLookup
): ResolveResult {
  return resolvePlaceholdersWithAliases(sqlTemplate, mappings);
}

export async function resolveMetricSQL(
  sqlTemplate: string,
  datasetId: number
): Promise<ResolveResult> {
  const mappings = await getColumnMappingsForDataset(datasetId);
  return resolvePlaceholdersWithAliases(sqlTemplate, mappings);
}

export async function checkMetricAvailabilityWithAliases(
  requiredLogicalColumns: string[],
  datasetId: number
): Promise<{
  available: boolean;
  missingColumns: { logical: string; displayName: string }[];
  resolvedAliases: { original: string; resolvedTo: string }[];
}> {
  const mappings = await getColumnMappingsForDataset(datasetId);
  const missing: { logical: string; displayName: string }[] = [];
  const resolvedAliases: { original: string; resolvedTo: string }[] = [];
  
  for (const logical of requiredLogicalColumns) {
    const physicalColumn = resolveWithAliases(logical, mappings);
    
    if (!physicalColumn) {
      missing.push({
        logical,
        displayName: getLogicalColumnDisplayName(logical, "it"),
      });
    } else if (!mappings[logical]) {
      const aliases = LOGICAL_COLUMN_ALIASES[logical] || [];
      for (const alias of aliases) {
        if (mappings[alias]) {
          resolvedAliases.push({ original: logical, resolvedTo: alias });
          break;
        }
      }
    }
  }
  
  return {
    available: missing.length === 0,
    missingColumns: missing,
    resolvedAliases,
  };
}

export async function checkMetricAvailability(
  requiredLogicalColumns: string[],
  datasetId: number
): Promise<{
  available: boolean;
  missingColumns: { logical: string; displayName: string }[];
}> {
  const result = await checkMetricAvailabilityWithAliases(requiredLogicalColumns, datasetId);
  return {
    available: result.available,
    missingColumns: result.missingColumns,
  };
}

export async function getAvailableMetricsForDataset(
  datasetId: number,
  metricTemplates: Record<string, { requiredLogicalColumns: string[] }>
): Promise<{
  available: string[];
  unavailable: { name: string; missingColumns: string[] }[];
}> {
  const mappings = await getColumnMappingsForDataset(datasetId);
  
  const available: string[] = [];
  const unavailable: { name: string; missingColumns: string[] }[] = [];
  
  for (const [metricName, template] of Object.entries(metricTemplates)) {
    const missingCols: string[] = [];
    
    for (const col of template.requiredLogicalColumns) {
      const physicalColumn = resolveWithAliases(col, mappings);
      if (!physicalColumn) {
        missingCols.push(getLogicalColumnDisplayName(col, "it"));
      }
    }
    
    if (missingCols.length === 0) {
      available.push(metricName);
    } else {
      unavailable.push({
        name: metricName,
        missingColumns: missingCols,
      });
    }
  }
  
  return { available, unavailable };
}

/**
 * MONETARY COLUMN WARNING SYSTEM
 * Detects when dataset has monetary columns that aren't mapped to revenue_amount
 * This prevents using price * quantity when a better column exists
 */
export interface MonetaryColumnWarning {
  hasWarning: boolean;
  message?: string;
  unmappedMonetaryColumns: string[];
  currentRevenueSource?: string;
  suggestedMapping?: { physical: string; logical: string };
}

const MONETARY_COLUMN_PATTERNS = [
  /prezzo_?finale/i,
  /prezzofinale/i,
  /importo_?riga/i,
  /importo2/i,
  /line_?total/i,
  /totale_?riga/i,
  /importo_?fatturato/i,
  /net_?amount/i,
  /final_?price/i,
  /totale_?netto/i,
  /total_?net/i,
];

export async function checkMonetaryColumnWarnings(
  datasetId: number
): Promise<MonetaryColumnWarning> {
  const mappings = await getColumnMappingsForDataset(datasetId);
  
  const [dataset] = await db
    .select()
    .from(clientDataDatasets)
    .where(eq(clientDataDatasets.id, datasetId))
    .limit(1);
  
  if (!dataset || !dataset.columnMapping) {
    return { hasWarning: false, unmappedMonetaryColumns: [] };
  }
  
  const physicalColumns = Object.keys(dataset.columnMapping as Record<string, any>);
  const unmappedMonetaryColumns: string[] = [];
  
  for (const col of physicalColumns) {
    const isMapped = Object.values(mappings).includes(col);
    if (isMapped) continue;
    
    for (const pattern of MONETARY_COLUMN_PATTERNS) {
      if (pattern.test(col)) {
        unmappedMonetaryColumns.push(col);
        break;
      }
    }
  }
  
  if (unmappedMonetaryColumns.length === 0) {
    return { hasWarning: false, unmappedMonetaryColumns: [] };
  }
  
  const hasRevenueAmount = !!mappings["revenue_amount"];
  const hasPriceQuantity = !!mappings["price"] && !!mappings["quantity"];
  
  let currentRevenueSource: string | undefined;
  if (hasRevenueAmount) {
    currentRevenueSource = `revenue_amount (${mappings["revenue_amount"]})`;
  } else if (hasPriceQuantity) {
    currentRevenueSource = `price × quantity (${mappings["price"]} × ${mappings["quantity"]})`;
  }
  
  const suggestedMapping = unmappedMonetaryColumns.length > 0 && !hasRevenueAmount
    ? { physical: unmappedMonetaryColumns[0], logical: "revenue_amount" }
    : undefined;
  
  const message = hasRevenueAmount
    ? undefined
    : `⚠️ ATTENZIONE: Il dataset contiene colonne monetarie non mappate: ${unmappedMonetaryColumns.join(", ")}. ` +
      `Attualmente il fatturato viene calcolato come ${currentRevenueSource || "non configurato"}. ` +
      `Considera di mappare "${unmappedMonetaryColumns[0]}" come "Importo Fatturato" per calcoli più accurati.`;
  
  if (message) {
    console.warn(`[SEMANTIC-RESOLVER] ${message}`);
  }
  
  return {
    hasWarning: !!message,
    message,
    unmappedMonetaryColumns,
    currentRevenueSource,
    suggestedMapping,
  };
}

/**
 * Log which column is being used for revenue calculation
 */
export async function logRevenueColumnUsage(
  datasetId: number,
  metricName: string
): Promise<void> {
  if (!metricName.includes("revenue") && !metricName.includes("fatturato")) {
    return;
  }
  
  const mappings = await getColumnMappingsForDataset(datasetId);
  
  if (mappings["revenue_amount"]) {
    console.log(`[REVENUE-TRACKING] Dataset ${datasetId} - Using revenue_amount: "${mappings["revenue_amount"]}" for ${metricName}`);
  } else if (mappings["price"] && mappings["quantity"]) {
    console.log(`[REVENUE-TRACKING] Dataset ${datasetId} - Using price×quantity: "${mappings["price"]}" × "${mappings["quantity"]}" for ${metricName}`);
    
    const warnings = await checkMonetaryColumnWarnings(datasetId);
    if (warnings.hasWarning) {
      console.warn(`[REVENUE-TRACKING] ${warnings.message}`);
    }
  } else {
    console.warn(`[REVENUE-TRACKING] Dataset ${datasetId} - No revenue mapping configured for ${metricName}`);
  }
}

/**
 * Get a human-readable summary of dataset semantic mappings
 */
export async function getDatasetSemanticSummary(datasetId: number): Promise<{
  mappedColumns: { logical: string; displayName: string; physical: string }[];
  availableMetrics: string[];
  missingForFullAnalytics: string[];
}> {
  const mappings = await getColumnMappingsForDataset(datasetId);
  
  const mappedColumns = Object.entries(mappings).map(([logical, physical]) => ({
    logical,
    displayName: getLogicalColumnDisplayName(logical, "it"),
    physical
  }));
  
  const coreRoles = ["document_id", "revenue_amount", "quantity", "product_name", "order_date"];
  const missingForFullAnalytics = coreRoles.filter(role => !resolveWithAliases(role, mappings));
  
  const { METRIC_TEMPLATES } = require("./metric-templates");
  const { available } = await getAvailableMetricsForDataset(datasetId, METRIC_TEMPLATES);
  
  return {
    mappedColumns,
    availableMetrics: available,
    missingForFullAnalytics: missingForFullAnalytics.map(r => getLogicalColumnDisplayName(r, "it")),
  };
}
