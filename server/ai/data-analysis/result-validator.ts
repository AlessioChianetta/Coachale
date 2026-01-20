/**
 * Result Validator - Anti-Hallucination Layer
 * 
 * Validates AI responses to ensure:
 * 1. All numbers in response come from tool results (no invention)
 * 2. Results fall within valid ranges
 * 3. Reconciliation checks pass
 * 4. Outliers are flagged with warnings
 */

import { getMetricDefinition, type ValidationRules, type MetricDefinition } from "./metric-registry";
import type { ExecutedToolResult } from "./tool-definitions";

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  numbersInResponse: number[];
  numbersFromTools: number[];
  inventedNumbers: number[];
}

export interface RangeCheckResult {
  valid: boolean;
  value: number;
  metricName: string;
  error?: string;
  warning?: string;
}

export interface ReconciliationResult {
  valid: boolean;
  expectedTotal: number;
  actualSum: number;
  difference: number;
  percentageDiff: number;
  warning?: string;
}

export interface OutlierResult {
  isOutlier: boolean;
  value: number;
  metricName: string;
  threshold?: number;
  warning?: string;
}

function extractNumbersFromText(text: string): number[] {
  const numbers: number[] = [];
  
  const patterns = [
    /[\d.,]+\s*[€$£¥%]/g,
    /[€$£¥]\s*[\d.,]+/g,
    /\b\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{1,2})?\b/g,
    /\b\d+(?:[.,]\d+)?\b/g,
  ];
  
  const excludePatterns = [
    /\b(19|20)\d{2}\b/g,
    /\b\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}\b/g,
    /\b(0[1-9]|1[0-2])[\/\-](0[1-9]|[12]\d|3[01])\b/g,
  ];
  
  let cleanedText = text;
  for (const pattern of excludePatterns) {
    cleanedText = cleanedText.replace(pattern, " ");
  }
  
  for (const pattern of patterns) {
    const matches = cleanedText.match(pattern);
    if (matches) {
      for (const match of matches) {
        const cleaned = match.replace(/[€$£¥%\s]/g, "");
        const normalized = cleaned.replace(/\.(\d{3})/g, "$1").replace(",", ".");
        const num = parseFloat(normalized);
        if (!isNaN(num) && isFinite(num) && num !== 0) {
          numbers.push(num);
        }
      }
    }
  }
  
  return [...new Set(numbers)];
}

function extractNumbersFromToolResults(results: ExecutedToolResult[]): number[] {
  const numbers: number[] = [];
  
  for (const result of results) {
    console.log(`[RESULT-VALIDATOR] Processing tool result: toolName=${result.toolName}, success=${result.success}, result=`, JSON.stringify(result.result)?.substring(0, 200));
    if (!result.success || !result.result) continue;
    
    const extractFromObject = (obj: any, path: string = "root") => {
      if (typeof obj === "number" && isFinite(obj)) {
        console.log(`[RESULT-VALIDATOR] Found number at ${path}: ${obj}`);
        numbers.push(obj);
      } else if (typeof obj === "string") {
        // Try to parse string numbers
        const parsed = parseFloat(obj);
        if (!isNaN(parsed) && isFinite(parsed)) {
          console.log(`[RESULT-VALIDATOR] Parsed number from string at ${path}: ${parsed}`);
          numbers.push(parsed);
        }
      } else if (Array.isArray(obj)) {
        for (let i = 0; i < obj.length; i++) {
          extractFromObject(obj[i], `${path}[${i}]`);
        }
      } else if (typeof obj === "object" && obj !== null) {
        for (const [key, value] of Object.entries(obj)) {
          extractFromObject(value, `${path}.${key}`);
        }
      }
    };
    
    extractFromObject(result.result);
  }
  
  console.log(`[RESULT-VALIDATOR] Total numbers extracted: ${numbers.length}`, numbers);
  return [...new Set(numbers)];
}

function numbersAreClose(a: number, b: number, tolerance: number = 0.01): boolean {
  if (a === b) return true;
  if (a === 0 || b === 0) return Math.abs(a - b) < tolerance;
  return Math.abs(a - b) / Math.max(Math.abs(a), Math.abs(b)) < tolerance;
}

/**
 * Generate all plausible derived numbers from base numbers
 * This includes: differences, percentages, averages, sums, ratios
 */
function generateDerivedNumbers(baseNumbers: number[]): Set<number> {
  const derived = new Set<number>();
  
  // Add all base numbers
  for (const num of baseNumbers) {
    derived.add(num);
    derived.add(Math.round(num));
    derived.add(Math.round(num * 100) / 100);
  }
  
  // Sum of all numbers
  const total = baseNumbers.reduce((a, b) => a + b, 0);
  derived.add(total);
  derived.add(Math.round(total));
  derived.add(Math.round(total * 100) / 100);
  
  // Average
  if (baseNumbers.length > 0) {
    const avg = total / baseNumbers.length;
    derived.add(avg);
    derived.add(Math.round(avg));
    derived.add(Math.round(avg * 100) / 100);
    derived.add(Math.round(avg * 10) / 10);
  }
  
  // Pairwise calculations
  for (let i = 0; i < baseNumbers.length; i++) {
    for (let j = 0; j < baseNumbers.length; j++) {
      if (i !== j) {
        const a = baseNumbers[i];
        const b = baseNumbers[j];
        
        // Difference
        const diff = Math.abs(a - b);
        derived.add(diff);
        derived.add(Math.round(diff));
        derived.add(Math.round(diff * 100) / 100);
        
        // Percentage change: ((new - old) / old) * 100
        if (b !== 0) {
          const pctChange = ((a - b) / b) * 100;
          derived.add(Math.abs(pctChange));
          derived.add(Math.round(Math.abs(pctChange)));
          derived.add(Math.round(Math.abs(pctChange) * 10) / 10);
          derived.add(Math.round(Math.abs(pctChange) * 100) / 100);
          
          // Ratio
          const ratio = a / b;
          derived.add(ratio);
          derived.add(Math.round(ratio * 100) / 100);
          derived.add(Math.round(ratio * 10) / 10);
        }
        
        // Percentage of total
        if (total !== 0) {
          const pctOfTotal = (a / total) * 100;
          derived.add(pctOfTotal);
          derived.add(Math.round(pctOfTotal));
          derived.add(Math.round(pctOfTotal * 10) / 10);
          derived.add(Math.round(pctOfTotal * 100) / 100);
        }
      }
    }
  }
  
  return derived;
}

export function validateResponseNumbers(
  aiResponse: string,
  toolResults: ExecutedToolResult[]
): ValidationResult {
  const numbersInResponse = extractNumbersFromText(aiResponse);
  const numbersFromTools = extractNumbersFromToolResults(toolResults);
  
  const inventedNumbers: number[] = [];
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // BUG FIX: Check if ALL tool results returned 0 rows - this means the filter matched nothing
  // If rowCount=0 for all compute tools, ANY numbers in the response are INVENTED
  const computeToolResults = toolResults.filter(r => 
    COMPUTE_TOOLS.includes(r.toolName) && r.success
  );
  
  const allToolsReturnedZeroRows = computeToolResults.length > 0 && computeToolResults.every(r => {
    const rowCount = r.result?.rowCount ?? r.result?.data?.length ?? 
                     (Array.isArray(r.result) ? r.result.length : null);
    return rowCount === 0;
  });
  
  // If tools returned 0 rows and response has numbers, those are INVENTED
  if (allToolsReturnedZeroRows && numbersInResponse.length > 0) {
    const significantNumbers = numbersInResponse.filter(n => n > 10 || (n > 0 && n < 1));
    if (significantNumbers.length > 0) {
      console.error(`[RESULT-VALIDATOR] ZERO ROWS GUARD: All queries returned 0 rows but AI response contains numbers: ${significantNumbers.join(", ")}`);
      errors.push(`ERRORE CRITICO - NUMERI INVENTATI: La query non ha trovato dati (0 righe), ma la risposta contiene numeri (${significantNumbers.slice(0, 3).join(", ")}${significantNumbers.length > 3 ? '...' : ''}). L'AI ha inventato dati inesistenti.`);
      return {
        valid: false,
        errors,
        warnings,
        numbersInResponse,
        numbersFromTools: [],
        inventedNumbers: significantNumbers,
      };
    }
  }
  
  // NEW APPROACH: Check that the IMPORTANT numbers from the database are PRESENT in the response
  // Don't block for extra context numbers the AI uses for consulting (benchmarks, percentages, etc.)
  
  // Find which tool numbers are missing from the response
  const missingToolNumbers: number[] = [];
  const presentToolNumbers: number[] = [];
  
  for (const toolNum of numbersFromTools) {
    // Check if this tool number (or a rounded version) appears in the response
    const foundInResponse = numbersInResponse.some(respNum => {
      if (numbersAreClose(respNum, toolNum, 0.05)) return true;
      // Check rounded versions
      const rounded = Math.round(toolNum);
      const roundedTo2 = Math.round(toolNum * 100) / 100;
      const roundedTo1 = Math.round(toolNum * 10) / 10;
      return numbersAreClose(respNum, rounded, 0.02) ||
             numbersAreClose(respNum, roundedTo2, 0.02) ||
             numbersAreClose(respNum, roundedTo1, 0.02);
    });
    
    if (foundInResponse) {
      presentToolNumbers.push(toolNum);
    } else {
      missingToolNumbers.push(toolNum);
    }
  }
  
  // Calculate coverage: what percentage of database numbers are mentioned?
  // BUG FIX: If there are NO numbers from tools (empty results), do NOT give 100% coverage bypass
  const coveragePercent = numbersFromTools.length > 0 
    ? (presentToolNumbers.length / numbersFromTools.length) * 100 
    : 0; // Changed from 100 to 0 - no numbers from tools means 0% coverage, not 100%
  
  console.log(`[RESULT-VALIDATOR] Coverage: ${coveragePercent.toFixed(0)}% (${presentToolNumbers.length}/${numbersFromTools.length} tool numbers found in response)`);
  
  // BLOCK only if:
  // 1. Coverage is very low (< 20%) - AI is ignoring the database numbers
  // 2. AND the response has numbers (AI is making up its own)
  const hasSignificantNumbers = numbersInResponse.length > 0;
  
  if (numbersFromTools.length > 0 && coveragePercent < 20 && hasSignificantNumbers) {
    errors.push(`HALLUCINATION DETECTED: Solo ${coveragePercent.toFixed(0)}% dei numeri dal database presenti nella risposta`);
  }
  
  const toolsUsed = toolResults.map(r => r.toolName);
  const hasComputeTool = toolsUsed.some(t => COMPUTE_TOOLS.includes(t));
  
  // Generate derived numbers (differences, percentages, averages, etc.) from tool results
  const derivedNumbers = generateDerivedNumbers(numbersFromTools);
  console.log(`[RESULT-VALIDATOR] Generated ${derivedNumbers.size} derived numbers from ${numbersFromTools.length} base numbers`);
  
  for (const num of numbersInResponse) {
    // Check against original tool numbers
    const foundInTools = numbersFromTools.some(toolNum => numbersAreClose(num, toolNum, 0.05));
    if (!foundInTools) {
      // Check against rounded versions
      const isRounded = numbersFromTools.some(toolNum => {
        return numbersAreClose(num, Math.round(toolNum), 0.02);
      });
      if (!isRounded) {
        // Check against derived numbers (percentages, differences, sums, averages)
        let isDerived = false;
        for (const derivedNum of derivedNumbers) {
          if (numbersAreClose(num, derivedNum, 0.1)) {
            isDerived = true;
            console.log(`[RESULT-VALIDATOR] Number ${num} is a valid derived calculation (close to ${derivedNum.toFixed(2)})`);
            break;
          }
        }
        if (!isDerived) {
          inventedNumbers.push(num);
        }
      }
    }
  }
  
  // COVERAGE BYPASS: If all database numbers are present in the response (100% coverage),
  // allow the response to pass - the AI is correctly using real data and any extra numbers
  // are legitimate derived calculations or context for consulting purposes
  const fullCoverage = coveragePercent >= 100;
  
  // Track extra numbers for informational purposes
  const extraNumbers = [...inventedNumbers];
  
  if (inventedNumbers.length > 0) {
    if (fullCoverage) {
      // Full coverage: all database numbers are present, extra numbers are just analysis
      console.log(`[RESULT-VALIDATOR] COVERAGE BYPASS: 100% coverage, allowing ${inventedNumbers.length} derived/extra numbers`);
      if (extraNumbers.length > 0) {
        warnings.push(`📊 Analisi AI: ${extraNumbers.join(", ")} (calcoli derivati dai dati reali)`);
      }
      // CLEAR invented numbers when coverage bypass is active - this prevents fullValidation from blocking
      inventedNumbers.length = 0;
    } else {
      // Partial coverage: some database numbers are missing, be more strict
      const significantInvented = inventedNumbers.filter(n => n > 10 || (n > 0 && n < 1));
      if (hasComputeTool && significantInvented.length > 2 && coveragePercent < 50) {
        errors.push(`ERRORE CRITICO - NUMERI INVENTATI: Questi numeri (${significantInvented.join(", ")}) non provengono dai risultati dei tool. L'AI ha inventato dati. Risposta bloccata.`);
      } else if (inventedNumbers.length > 0) {
        warnings.push(`📊 Calcoli AI: ${inventedNumbers.join(", ")} (analisi derivate dai dati)`);
        // Also clear for partial coverage when no error is generated
        inventedNumbers.length = 0;
      }
    }
  }
  
  const valid = errors.length === 0;
  
  console.log(`[RESULT-VALIDATOR] Response numbers: ${numbersInResponse.length}, Tool numbers: ${numbersFromTools.length}, Extra: ${extraNumbers.length}, Final invented: ${inventedNumbers.length}`);
  
  return {
    valid,
    errors,
    warnings,
    numbersInResponse,
    numbersFromTools,
    inventedNumbers,
  };
}

export function validateRange(
  value: number,
  metricName: string,
  rules?: ValidationRules
): RangeCheckResult {
  const metricDef = getMetricDefinition(metricName);
  const validationRules = rules || metricDef?.validationRules || {};
  
  const result: RangeCheckResult = {
    valid: true,
    value,
    metricName,
  };
  
  if (validationRules.mustBePositive && value < 0) {
    result.valid = false;
    result.error = `${metricName} deve essere positivo, ricevuto: ${value}`;
  }
  
  if (validationRules.mustBeInteger && !Number.isInteger(value)) {
    result.valid = false;
    result.error = `${metricName} deve essere un intero, ricevuto: ${value}`;
  }
  
  if (validationRules.minValue !== undefined && value < validationRules.minValue) {
    result.valid = false;
    result.error = `${metricName} sotto il minimo (${validationRules.minValue}), ricevuto: ${value}`;
  }
  
  if (validationRules.maxValue !== undefined && value > validationRules.maxValue) {
    result.valid = false;
    result.error = `${metricName} sopra il massimo (${validationRules.maxValue}), ricevuto: ${value}`;
  }
  
  return result;
}

export function checkReconciliation(
  parts: number[],
  expectedTotal: number,
  tolerancePercent: number = 1
): ReconciliationResult {
  const actualSum = parts.reduce((sum, p) => sum + p, 0);
  const difference = Math.abs(actualSum - expectedTotal);
  const percentageDiff = expectedTotal !== 0 ? (difference / expectedTotal) * 100 : 0;
  
  const result: ReconciliationResult = {
    valid: percentageDiff <= tolerancePercent,
    expectedTotal,
    actualSum,
    difference,
    percentageDiff,
  };
  
  if (!result.valid) {
    result.warning = `Reconciliation failed: somma parti (${actualSum.toFixed(2)}) != totale (${expectedTotal.toFixed(2)}), diff: ${percentageDiff.toFixed(2)}%`;
  }
  
  return result;
}

export function detectOutlier(
  value: number,
  metricName: string
): OutlierResult {
  const metricDef = getMetricDefinition(metricName);
  const rules = metricDef?.validationRules;
  
  const result: OutlierResult = {
    isOutlier: false,
    value,
    metricName,
  };
  
  if (rules?.warningThreshold !== undefined && value > rules.warningThreshold) {
    result.isOutlier = true;
    result.threshold = rules.warningThreshold;
    result.warning = rules.warningMessage || `${metricName} (${value}) supera la soglia di warning (${rules.warningThreshold})`;
  }
  
  const outlierThresholds: Record<string, { min?: number; max?: number; warning: string }> = {
    food_cost_percent: { max: 60, warning: "Food cost superiore al 60% - margini bassi" },
    gross_margin_percent: { min: 30, warning: "Margine lordo sotto il 30% - verificare prezzi" },
  };
  
  const threshold = outlierThresholds[metricName];
  if (threshold) {
    if (threshold.max !== undefined && value > threshold.max) {
      result.isOutlier = true;
      result.threshold = threshold.max;
      result.warning = threshold.warning;
    }
    if (threshold.min !== undefined && value < threshold.min) {
      result.isOutlier = true;
      result.threshold = threshold.min;
      result.warning = threshold.warning;
    }
  }
  
  return result;
}

export function validateToolResults(
  toolResults: ExecutedToolResult[]
): { valid: boolean; errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  for (const result of toolResults) {
    if (!result.success) {
      errors.push(`Tool ${result.toolName} failed: ${result.error}`);
      continue;
    }
    
    if (result.toolName === "execute_metric" || result.toolName === "query_metric") {
      const metricName = result.args?.metricName || result.args?.metric_name;
      const value = result.result?.result ?? result.result?.[0]?.result;
      
      if (typeof value === "number" && metricName) {
        const rangeCheck = validateRange(value, metricName);
        if (!rangeCheck.valid && rangeCheck.error) {
          errors.push(rangeCheck.error);
        }
        
        const outlierCheck = detectOutlier(value, metricName);
        if (outlierCheck.isOutlier && outlierCheck.warning) {
          warnings.push(`⚠️ ${outlierCheck.warning}`);
        }
      }
    }
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

const COMPUTE_TOOLS = ["execute_metric", "aggregate_group", "compare_periods", "filter_data", "query_metric"];
const METADATA_ONLY_TOOLS = ["get_schema"];

const KPI_KEYWORDS = [
  /fatturato/i, /revenue/i, /vendite/i, /sales/i,
  /costo/i, /cost/i, /margine/i, /margin/i,
  /profitto/i, /profit/i, /utile/i,
  /food[\s_]?cost/i, /cogs/i,
  /ticket\s*medio/i, /scontrino/i,
  /percentuale/i,
  /totale\s+(netto|lordo|vendite|costi|fatturato)/i,
];

function extractSignificantNumbers(text: string): number[] {
  const numbers: number[] = [];
  const patterns = [
    /\b\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{1,2})?\s*[€$£¥%]/g,
    /[€$£¥]\s*\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{1,2})?/g,
    /\b\d+(?:[.,]\d+)?\b/g,
  ];
  
  const datePatterns = [
    /\b(19|20)\d{2}\b/g,
    /\b\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}\b/g,
  ];
  
  const listNumberPatterns = [
    /^\s*\d{1,2}[.):\s]/gm,
    /\b\d{1,2}\.\s+[A-Z]/g,
  ];
  
  let cleanedText = text;
  for (const pattern of datePatterns) {
    cleanedText = cleanedText.replace(pattern, " ");
  }
  for (const pattern of listNumberPatterns) {
    cleanedText = cleanedText.replace(pattern, " ");
  }
  
  for (const pattern of patterns) {
    const matches = cleanedText.match(pattern);
    if (matches) {
      for (const match of matches) {
        const cleaned = match.replace(/[€$£¥%\s]/g, "");
        const normalized = cleaned.replace(/\.(\d{3})/g, "$1").replace(",", ".");
        const num = parseFloat(normalized);
        if (!isNaN(num) && isFinite(num) && num !== 0 && num > 10) {
          numbers.push(num);
        }
      }
    }
  }
  
  return [...new Set(numbers)];
}

const STRICT_METADATA_PATTERNS = [
  /\b(\d+)\s*(righe|colonne|record)\b/i,
  /\b(righe|colonne|record)\s*[:=]?\s*(\d+)\b/i,
];

function hasKpiKeywordsNearNumbers(text: string): boolean {
  for (const kpiPattern of KPI_KEYWORDS) {
    if (kpiPattern.test(text)) {
      const significantNumbers = extractSignificantNumbers(text);
      if (significantNumbers.length > 0) {
        return true;
      }
    }
  }
  return false;
}

function isMetadataContext(text: string): boolean {
  const hasMetadataPattern = STRICT_METADATA_PATTERNS.some(pattern => pattern.test(text));
  if (!hasMetadataPattern) return false;
  
  const hasCurrencyOrPercent = /[€$£¥%]/.test(text);
  if (hasCurrencyOrPercent) return false;
  
  const hasAnyKpiKeyword = KPI_KEYWORDS.some(pattern => pattern.test(text));
  if (hasAnyKpiKeyword) return false;
  
  return true;
}

function hasNumericClaims(text: string): boolean {
  const significantNumbers = extractSignificantNumbers(text);
  if (significantNumbers.length === 0) return false;
  
  const hasCurrencyOrPercent = /[€$£¥%]/.test(text);
  if (hasCurrencyOrPercent) return true;
  
  return significantNumbers.length > 0;
}

export function validateToolGating(
  aiResponse: string,
  toolResults: ExecutedToolResult[]
): { valid: boolean; error?: string } {
  const toolsUsed = toolResults.map(r => r.toolName);
  const hasComputeTool = toolsUsed.some(t => COMPUTE_TOOLS.includes(t));
  
  // Check if this is a conversational response (fixed response, no data analysis needed)
  const hasConversationalTool = toolsUsed.includes("conversational_response");
  const isConversationalResult = toolResults.some(r => 
    r.toolName === "conversational_response" || 
    (r.result && typeof r.result === "object" && (r.result as any).isFixedResponse === true)
  );
  
  // Skip validation for conversational responses - they don't need compute tools
  if (hasConversationalTool || isConversationalResult) {
    console.log(`[TOOL-GATING] CONVERSATIONAL BYPASS: Skipping validation for conversational response`);
    return { valid: true };
  }
  
  const hasNumericClaimsInResponse = hasNumericClaims(aiResponse);
  const isOnlyMetadata = isMetadataContext(aiResponse);
  
  console.log(`[TOOL-GATING] Tools used: ${toolsUsed.join(", ")}, hasComputeTool: ${hasComputeTool}, hasNumericClaims: ${hasNumericClaimsInResponse}, isOnlyMetadata: ${isOnlyMetadata}`);
  
  if (hasNumericClaimsInResponse && !isOnlyMetadata && !hasComputeTool) {
    const significantNumbers = extractSignificantNumbers(aiResponse);
    return {
      valid: false,
      error: `HALLUCINATION BLOCKED: La risposta contiene numeri significativi (${significantNumbers.slice(0, 3).join(", ")}${significantNumbers.length > 3 ? '...' : ''}) ma non è stato usato nessun tool di calcolo (execute_metric, aggregate_group, etc.). I numeri devono provenire dal database.`
    };
  }
  
  return { valid: true };
}

/**
 * Label/Metric Alignment Validator
 * Ensures that labels in the response match the metrics actually called
 * 
 * CRITICAL: Prevents confusing revenue with gross_margin
 */
function validateLabelMetricAlignment(
  aiResponse: string,
  toolResults: ExecutedToolResult[]
): { valid: boolean; errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  const responseLower = aiResponse.toLowerCase();
  
  // Extract metric names from tool calls - use args.metricName as primary source
  const metricsUsed = new Set<string>();
  for (const result of toolResults) {
    if (!result.success) continue;
    
    // Primary source: args.metricName (canonical)
    const argsMetric = (result as any).args?.metricName;
    if (argsMetric) metricsUsed.add(argsMetric.toLowerCase());
    
    // Fallback sources
    const resultMetric = (result.result as any)?.metricName;
    if (resultMetric) metricsUsed.add(resultMetric.toLowerCase());
    
    // Also check nested metric names in aggregate results
    if (result.result?.data && Array.isArray(result.result.data)) {
      for (const row of result.result.data) {
        for (const key of Object.keys(row)) {
          metricsUsed.add(key.toLowerCase());
        }
      }
    }
  }
  
  console.log(`[LABEL-VALIDATOR] Metrics used in tools: ${[...metricsUsed].join(", ")}`);
  
  // CRITICAL CHECK 1: "margine lordo" + € amount requires gross_margin
  const marginPatterns = [
    /margine\s+lordo\s+(?:di\s+)?[\d.,]+\s*[€]/i,
    /margine\s+lordo[:\s]+[\d.,]+\s*[€]/i,
    /margine[:\s]+[\d.,]+\s*[€]/i,
    /profitto\s+(?:di\s+)?[\d.,]+\s*[€]/i,
  ];
  
  const hasMarginWithEuro = marginPatterns.some(p => p.test(aiResponse));
  const hasGrossMarginMetric = metricsUsed.has("gross_margin") || 
                                metricsUsed.has("gross_margin_percent") ||
                                [...metricsUsed].some(m => m.includes("gross_margin"));
  
  if (hasMarginWithEuro && !hasGrossMarginMetric) {
    const hasRevenueMetric = metricsUsed.has("revenue") || 
                             [...metricsUsed].some(m => m.includes("revenue"));
    
    if (hasRevenueMetric) {
      errors.push(`ERRORE CRITICO - CONFUSIONE REVENUE/MARGINE: La risposta menziona "margine lordo €" ma il tool chiamato era "revenue". Il revenue (fatturato) NON è il margine lordo. Per calcolare il margine lordo in euro serve execute_metric(gross_margin).`);
    } else {
      warnings.push(`ATTENZIONE: La risposta menziona "margine lordo €" ma non è stato chiamato execute_metric(gross_margin). Verificare che il valore sia corretto.`);
    }
  }
  
  // CRITICAL CHECK 2: Detect value confusion using number parsing
  // This checks BOTH cases: when gross_margin is missing AND when it's present but wrong value is used
  let revenueFromTools: number | null = null;
  let grossMarginFromTools: number | null = null;
  
  for (const result of toolResults) {
    if (!result.success || !result.result) continue;
    const metricName = ((result as any).args?.metricName || "").toLowerCase();
    const resultValue = result.result?.value ?? result.result?.result;
    
    if (metricName === "revenue" && typeof resultValue === "number") {
      revenueFromTools = resultValue;
    }
    if (metricName === "gross_margin" && typeof resultValue === "number") {
      grossMarginFromTools = resultValue;
    }
  }
  
  // Extract numbers from response near "margine lordo" mentions
  const marginMentioned = responseLower.includes("margine lordo") || responseLower.includes("margine:");
  if (marginMentioned && revenueFromTools) {
    // Extract euro amounts from response
    const responseNumbers: number[] = [];
    const numPatterns = [/[\d.,]+\s*[€]/g, /[€]\s*[\d.,]+/g];
    for (const pattern of numPatterns) {
      const matches = aiResponse.match(pattern) || [];
      for (const m of matches) {
        const cleaned = m.replace(/[€\s]/g, "").replace(/\.(\d{3})/g, "$1").replace(",", ".");
        const num = parseFloat(cleaned);
        if (!isNaN(num) && num > 100) responseNumbers.push(num);
      }
    }
    
    // Find number closest to "margine lordo" in text
    const marginIdx = responseLower.indexOf("margine lordo");
    if (marginIdx >= 0) {
      // Find the first € amount after "margine lordo"
      const textAfterMargin = aiResponse.substring(marginIdx, marginIdx + 100);
      const euroMatch = textAfterMargin.match(/[\d.,]+\s*[€]/);
      if (euroMatch) {
        const cleaned = euroMatch[0].replace(/[€\s]/g, "").replace(/\.(\d{3})/g, "$1").replace(",", ".");
        const marginValueInResponse = parseFloat(cleaned);
        
        if (!isNaN(marginValueInResponse)) {
          // Check if this value matches revenue (WRONG) or gross_margin (CORRECT)
          const matchesRevenue = Math.abs(marginValueInResponse - revenueFromTools) / revenueFromTools < 0.02;
          const matchesGrossMargin = grossMarginFromTools && Math.abs(marginValueInResponse - grossMarginFromTools) / grossMarginFromTools < 0.02;
          
          if (matchesRevenue && !matchesGrossMargin) {
            errors.push(`ERRORE CRITICO - CONFUSIONE VALORI: "${marginValueInResponse.toFixed(2)}€" etichettato come "margine lordo" ma è il valore di REVENUE. ${grossMarginFromTools ? `Il margine lordo corretto è ${grossMarginFromTools.toFixed(2)}€.` : 'Serve execute_metric(gross_margin) per ottenere il margine.'}`);
          }
        }
      }
    }
  }
  
  // CHECK 3: Detect narrative tokens (benchmarks, storytelling) - WARNING ONLY (not blocking)
  // Only block invented percentages/benchmarks, allow consulting language
  const blockingPatterns = [
    { pattern: /68[\-–]70\s*%/i, reason: "benchmark percentuale inventato" },
    { pattern: /gold\s+standard/i, reason: "benchmark esterno non verificabile" },
  ];
  
  const warningPatterns = [
    { pattern: /triangolo\s+d['']?oro/i, reason: "storytelling" },
    { pattern: /psicologia\s+del\s+prezzo/i, reason: "concetto esterno" },
    { pattern: /piano\s+d['']?attacco/i, reason: "linguaggio consulenziale" },
    { pattern: /leader\s+di\s+profitto/i, reason: "linguaggio consulenziale" },
    { pattern: /strategia\s+d['']?[eé]lite/i, reason: "linguaggio consulenziale" },
    { pattern: /markup\s+costante/i, reason: "inferenza" },
  ];
  
  // Only block invented benchmarks
  for (const { pattern, reason } of blockingPatterns) {
    if (pattern.test(aiResponse)) {
      errors.push(`BENCHMARK INVENTATO: "${pattern.source.replace(/\\/g, "")}" - ${reason}. I numeri devono provenire dai dati.`);
    }
  }
  
  // Allow consulting language with just a warning
  for (const { pattern, reason } of warningPatterns) {
    if (pattern.test(aiResponse)) {
      warnings.push(`Nota: "${pattern.source.replace(/\\/g, "")}" - ${reason}.`);
    }
  }
  
  return { valid: errors.length === 0, errors, warnings };
}

export function fullValidation(
  aiResponse: string,
  toolResults: ExecutedToolResult[]
): {
  valid: boolean;
  canProceed: boolean;
  errors: string[];
  warnings: string[];
  inventedNumbers: number[];
} {
  const toolGating = validateToolGating(aiResponse, toolResults);
  const responseValidation = validateResponseNumbers(aiResponse, toolResults);
  const toolValidation = validateToolResults(toolResults);
  const labelValidation = validateLabelMetricAlignment(aiResponse, toolResults);
  
  const allErrors = [...responseValidation.errors, ...toolValidation.errors, ...labelValidation.errors];
  const allWarnings = [...responseValidation.warnings, ...toolValidation.warnings, ...labelValidation.warnings];
  
  if (!toolGating.valid && toolGating.error) {
    allErrors.unshift(toolGating.error);
  }
  
  const hasHallucination = responseValidation.inventedNumbers.length > 0;
  const hasRangeErrors = toolValidation.errors.some(e => 
    e.includes("sotto il minimo") || e.includes("sopra il massimo") || e.includes("deve essere")
  );
  const hasToolGatingError = !toolGating.valid;
  const hasLabelError = !labelValidation.valid;
  
  return {
    valid: allErrors.length === 0,
    canProceed: !hasHallucination && !hasRangeErrors && !hasToolGatingError && !hasLabelError,
    errors: allErrors,
    warnings: allWarnings,
    inventedNumbers: responseValidation.inventedNumbers,
  };
}
