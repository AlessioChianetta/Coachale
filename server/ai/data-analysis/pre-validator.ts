/**
 * Pre-Query Validator
 * Validates that required columns exist BEFORE executing a query
 * Returns business-friendly error messages instead of SQL errors
 */

import { getColumnMappingsForDataset } from "./semantic-resolver";
import { LOGICAL_COLUMNS, getLogicalColumnDisplayName } from "./logical-columns";
import { METRIC_TEMPLATES, type MetricTemplate } from "./metric-templates";

export interface PreValidationResult {
  valid: boolean;
  metricName?: string;
  availableMetrics: string[];
  unavailableMetrics: { name: string; displayName: string; reason: string }[];
  error?: string;
  suggestedAction?: string;
}

export interface MetricValidationResult {
  valid: boolean;
  missingColumns: { logical: string; displayName: string }[];
  error?: string;
  suggestedAction?: string;
}

export async function validateMetricForDataset(
  metricName: string,
  datasetId: number | string
): Promise<MetricValidationResult> {
  const numericDatasetId = typeof datasetId === 'string' ? parseInt(datasetId, 10) : datasetId;
  if (isNaN(numericDatasetId)) {
    return {
      valid: false,
      missingColumns: [],
      error: `ID dataset non valido: ${datasetId}`,
    };
  }
  const template = METRIC_TEMPLATES[metricName];
  
  if (!template) {
    return {
      valid: false,
      missingColumns: [],
      error: `Metrica "${metricName}" non trovata nel sistema.`,
    };
  }
  
  const mappings = await getColumnMappingsForDataset(numericDatasetId);
  const missing: { logical: string; displayName: string }[] = [];
  
  for (const logical of template.requiredLogicalColumns) {
    if (!mappings[logical]) {
      missing.push({
        logical,
        displayName: getLogicalColumnDisplayName(logical, "it"),
      });
    }
  }
  
  if (missing.length > 0) {
    const missingNames = missing.map((m) => m.displayName).join(", ");
    return {
      valid: false,
      missingColumns: missing,
      error: `Non posso calcolare "${template.displayName}" perché mancano le colonne: ${missingNames}.`,
      suggestedAction: "Vai in Impostazioni Dataset per configurare le colonne mancanti.",
    };
  }
  
  return {
    valid: true,
    missingColumns: [],
  };
}

export async function validateDatasetCapabilities(
  datasetId: number | string
): Promise<PreValidationResult> {
  const numericDatasetId = typeof datasetId === 'string' ? parseInt(datasetId, 10) : datasetId;
  if (isNaN(numericDatasetId)) {
    return {
      valid: false,
      availableMetrics: [],
      unavailableMetrics: [],
      error: `ID dataset non valido: ${datasetId}`,
    };
  }
  const mappings = await getColumnMappingsForDataset(numericDatasetId);
  const availableLogical = new Set(Object.keys(mappings));
  
  const available: string[] = [];
  const unavailable: { name: string; displayName: string; reason: string }[] = [];
  
  for (const [name, template] of Object.entries(METRIC_TEMPLATES)) {
    const missing = template.requiredLogicalColumns.filter(
      (col) => !availableLogical.has(col)
    );
    
    if (missing.length === 0) {
      available.push(name);
    } else {
      const missingNames = missing
        .map((col) => getLogicalColumnDisplayName(col, "it"))
        .join(", ");
      unavailable.push({
        name,
        displayName: template.displayName,
        reason: `Manca: ${missingNames}`,
      });
    }
  }
  
  const hasMappings = Object.keys(mappings).length > 0;
  
  return {
    valid: available.length > 0,
    availableMetrics: available,
    unavailableMetrics: unavailable,
    error: !hasMappings
      ? "Questo dataset non ha colonne configurate. Configura le colonne per abilitare le metriche."
      : available.length === 0
      ? "Nessuna metrica disponibile con le colonne attuali."
      : undefined,
    suggestedAction: unavailable.length > 0
      ? "Vai in Impostazioni Dataset per configurare le colonne mancanti."
      : undefined,
  };
}

export async function getBusinessFriendlyError(
  metricName: string,
  datasetId: number | string
): Promise<string | null> {
  const validation = await validateMetricForDataset(metricName, datasetId);
  
  if (validation.valid) {
    return null;
  }
  
  let message = validation.error || "Errore nella validazione della metrica.";
  if (validation.suggestedAction) {
    message += ` ${validation.suggestedAction}`;
  }
  
  return message;
}

export function getRequiredColumnsForMetric(metricName: string): string[] {
  const template = METRIC_TEMPLATES[metricName];
  return template?.requiredLogicalColumns || [];
}
