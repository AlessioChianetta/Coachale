/**
 * Semantic Resolver
 * Translates metric templates with {placeholder} into actual SQL with physical column names
 */

import { db } from "../../db";
import { datasetColumnMappings } from "../../../shared/schema";
import { eq } from "drizzle-orm";
import { LOGICAL_COLUMNS, getLogicalColumnDisplayName } from "./logical-columns";

export interface ResolveResult {
  sql: string;
  valid: boolean;
  missingColumns?: { logical: string; displayName: string }[];
  error?: string;
}

export interface ColumnMappingLookup {
  [logicalColumn: string]: string;
}

export async function getColumnMappingsForDataset(datasetId: number): Promise<ColumnMappingLookup> {
  const mappings = await db
    .select()
    .from(datasetColumnMappings)
    .where(eq(datasetColumnMappings.datasetId, datasetId));
  
  const lookup: ColumnMappingLookup = {};
  for (const mapping of mappings) {
    lookup[mapping.logicalColumn] = mapping.physicalColumn;
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

export function resolvePlaceholders(
  sqlTemplate: string,
  mappings: ColumnMappingLookup
): ResolveResult {
  const placeholders = extractPlaceholders(sqlTemplate);
  const missing: { logical: string; displayName: string }[] = [];
  
  for (const placeholder of placeholders) {
    if (!mappings[placeholder]) {
      missing.push({
        logical: placeholder,
        displayName: getLogicalColumnDisplayName(placeholder, "it"),
      });
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
  for (const [logical, physical] of Object.entries(mappings)) {
    const regex = new RegExp(`\\{${logical}\\}`, "g");
    resolvedSql = resolvedSql.replace(regex, `"${physical}"`);
  }
  
  return {
    sql: resolvedSql,
    valid: true,
  };
}

export async function resolveMetricSQL(
  sqlTemplate: string,
  datasetId: number
): Promise<ResolveResult> {
  const mappings = await getColumnMappingsForDataset(datasetId);
  return resolvePlaceholders(sqlTemplate, mappings);
}

export async function checkMetricAvailability(
  requiredLogicalColumns: string[],
  datasetId: number
): Promise<{
  available: boolean;
  missingColumns: { logical: string; displayName: string }[];
}> {
  const mappings = await getColumnMappingsForDataset(datasetId);
  const missing: { logical: string; displayName: string }[] = [];
  
  for (const logical of requiredLogicalColumns) {
    if (!mappings[logical]) {
      missing.push({
        logical,
        displayName: getLogicalColumnDisplayName(logical, "it"),
      });
    }
  }
  
  return {
    available: missing.length === 0,
    missingColumns: missing,
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
  const availableLogical = new Set(Object.keys(mappings));
  
  const available: string[] = [];
  const unavailable: { name: string; missingColumns: string[] }[] = [];
  
  for (const [metricName, template] of Object.entries(metricTemplates)) {
    const missing = template.requiredLogicalColumns.filter(
      (col) => !availableLogical.has(col)
    );
    
    if (missing.length === 0) {
      available.push(metricName);
    } else {
      unavailable.push({
        name: metricName,
        missingColumns: missing.map((col) => getLogicalColumnDisplayName(col, "it")),
      });
    }
  }
  
  return { available, unavailable };
}
