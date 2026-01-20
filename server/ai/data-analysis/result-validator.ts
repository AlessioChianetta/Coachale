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

export function validateResponseNumbers(
  aiResponse: string,
  toolResults: ExecutedToolResult[]
): ValidationResult {
  const numbersInResponse = extractNumbersFromText(aiResponse);
  const numbersFromTools = extractNumbersFromToolResults(toolResults);
  
  const inventedNumbers: number[] = [];
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Numbers that are commonly used in context (list numbers, common percentages, etc.)
  const ALLOWED_CONTEXT_NUMBERS = new Set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 15, 20, 25, 30, 35, 40, 50, 60, 70, 80, 90, 100]);
  
  // Calculate aggregates for validation (sum, average, count)
  const toolSum = numbersFromTools.reduce((a, b) => a + b, 0);
  const toolAvg = numbersFromTools.length > 0 ? toolSum / numbersFromTools.length : 0;
  const toolMax = Math.max(...numbersFromTools, 0);
  const toolMin = Math.min(...numbersFromTools, Infinity);
  
  console.log(`[RESULT-VALIDATOR] Aggregates: sum=${toolSum.toFixed(2)}, avg=${toolAvg.toFixed(2)}, max=${toolMax}, min=${toolMin}, count=${numbersFromTools.length}`);
  
  for (const num of numbersInResponse) {
    // Skip common context numbers (list items, common percentages)
    if (ALLOWED_CONTEXT_NUMBERS.has(num)) {
      continue;
    }
    
    const foundInTools = numbersFromTools.some(toolNum => numbersAreClose(num, toolNum, 0.05));
    
    if (!foundInTools) {
      const isRoundedVersion = numbersFromTools.some(toolNum => {
        const rounded = Math.round(toolNum);
        const roundedTo2 = Math.round(toolNum * 100) / 100;
        const roundedTo1 = Math.round(toolNum * 10) / 10;
        return numbersAreClose(num, rounded, 0.01) || 
               numbersAreClose(num, roundedTo2, 0.01) ||
               numbersAreClose(num, roundedTo1, 0.01);
      });
      
      // Check if this could be a valid aggregate (sum, partial sum, average)
      const isValidAggregate = 
        numbersAreClose(num, toolSum, 0.02) ||           // Total sum
        numbersAreClose(num, toolAvg, 0.02) ||           // Average
        numbersAreClose(num, Math.round(toolSum), 0.01) || // Rounded sum
        numbersAreClose(num, Math.round(toolAvg), 0.01) || // Rounded average
        (num > toolMax && num <= toolSum * 1.05);         // Likely a partial sum (within total)
      
      if (!isRoundedVersion && !isValidAggregate) {
        inventedNumbers.push(num);
      } else if (isValidAggregate) {
        console.log(`[RESULT-VALIDATOR] Number ${num} accepted as valid aggregate (sum=${toolSum.toFixed(2)}, avg=${toolAvg.toFixed(2)})`);
      }
    }
  }
  
  if (inventedNumbers.length > 0) {
    errors.push(`HALLUCINATION DETECTED: Numeri non provenienti dai tool: ${inventedNumbers.join(", ")}`);
  }
  
  const valid = inventedNumbers.length === 0;
  
  console.log(`[RESULT-VALIDATOR] Response numbers: ${numbersInResponse.length}, Tool numbers: ${numbersFromTools.length}, Invented: ${inventedNumbers.length}`);
  
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
  const responseValidation = validateResponseNumbers(aiResponse, toolResults);
  const toolValidation = validateToolResults(toolResults);
  
  const allErrors = [...responseValidation.errors, ...toolValidation.errors];
  const allWarnings = [...responseValidation.warnings, ...toolValidation.warnings];
  
  const hasHallucination = responseValidation.inventedNumbers.length > 0;
  const hasRangeErrors = toolValidation.errors.some(e => 
    e.includes("sotto il minimo") || e.includes("sopra il massimo") || e.includes("deve essere")
  );
  
  return {
    valid: allErrors.length === 0,
    canProceed: !hasHallucination && !hasRangeErrors,
    errors: allErrors,
    warnings: allWarnings,
    inventedNumbers: responseValidation.inventedNumbers,
  };
}
