/**
 * Query Planner using Gemini Function Calling
 * Analyzes user questions and plans which tools to use
 */

import { getAIProvider, getModelWithThinking } from "../provider-factory";
import { dataAnalysisTools, type ToolCall, type ExecutedToolResult, validateToolCall, getToolByName } from "./tool-definitions";
import { queryMetric, filterData, aggregateGroup, comparePeriods, getSchema, executeMetricSQL, getDistinctCount, checkCardinalityBeforeAggregate, validateFiltersApplied, MAX_GROUP_BY_LIMIT, type QueryResult, type CardinalityCheckResult, type IsSellableConfig, type ProductIlikeConfig } from "../../services/client-data/query-executor";
import { parseMetricExpression, validateMetricAgainstSchema } from "../../services/client-data/metric-dsl";
import { db } from "../../db";
import { clientDataDatasets, datasetColumnMappings } from "../../../shared/schema";
import { eq } from "drizzle-orm";
// NOTE: classifyIntent and ForceToolRetryError are deprecated - using Router Agent instead
import { getConversationalReply } from "./intent-classifier";
import { routeIntent, type IntentRouterOutput, type ConversationMessage } from "./intent-router";
import { enforcePolicyOnToolCalls, getPolicyForIntent, POLICY_RULES, validateAnalyticsToolCalls, COMPUTE_TOOLS as POLICY_COMPUTE_TOOLS, type IntentType } from "./policy-engine";
import { getMetricDefinition, getMetricDescriptionsForPrompt, isValidMetricName, resolveMetricSQLForDataset } from "./metric-registry";
import { METRIC_ENUM as TOOL_METRIC_ENUM } from "./tool-definitions";
import { forceMetricFromTerms } from "./term-mapper";
import { validateMetricForDataset } from "./pre-validator";
import { checkAnalyticsEnabled } from "../../services/client-data/semantic-mapping-service";
import { logRevenueColumnUsage, checkMonetaryColumnWarnings, getAvailableMetricsForDataset, getColumnMappingsForDataset } from "./semantic-resolver";
import { METRIC_TEMPLATES } from "./metric-templates";
import { applyQueryEnhancements, enhanceSqlWithRules, detectOrderByFromQuestion } from "./query-engine-rules";

// Retry configuration for AI calls
const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY_MS = 1000;

/**
 * Helper function to execute AI call with exponential backoff retry
 * Retries on 503 (overloaded) and 429 (rate limit) errors
 */
async function executeWithRetry<T>(
  operation: () => Promise<T>,
  operationName: string
): Promise<T> {
  let lastError: any;
  
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await operation();
    } catch (error: any) {
      lastError = error;
      const errorMessage = error?.message || JSON.stringify(error);
      const isRetryable = 
        errorMessage.includes("503") || 
        errorMessage.includes("429") ||
        errorMessage.includes("overloaded") || 
        errorMessage.includes("rate limit") ||
        errorMessage.includes("UNAVAILABLE") ||
        errorMessage.includes("RESOURCE_EXHAUSTED");
      
      if (isRetryable && attempt < MAX_RETRIES) {
        const delayMs = INITIAL_RETRY_DELAY_MS * Math.pow(2, attempt - 1);
        console.log(`[${operationName}] Retry ${attempt}/${MAX_RETRIES} after ${delayMs}ms (error: ${errorMessage.substring(0, 100)})`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      } else if (!isRetryable) {
        throw error;
      }
    }
  }
  
  throw lastError;
}

/**
 * TASK 2: Semantic Contract Detection
 * Detects if user requests "ALL items" vs "top N"
 */
export interface SemanticContract {
  requestsAll: boolean;
  requestsTopN: boolean;
  topNValue?: number;
  detectedKeywords: string[];
  detectedFilters: { column: string; value: string }[];
}

const ALL_KEYWORDS = [
  "uno per uno", "tutti", "ogni", "ciascun", "ognuno", "singolarmente",
  "each", "all", "one by one", "every", "all of them", "complete list",
  "lista completa", "elenco completo", "tutti quanti", "nel dettaglio"
];

const TOP_N_PATTERNS = [
  /\btop\s*(\d+)\b/i,
  /\bprimi?\s*(\d+)\b/i,
  /\bmigliori?\s*(\d+)\b/i,
  /\bpeggiori?\s*(\d+)\b/i,
  /\bultimi?\s*(\d+)\b/i,
  /\bmax(?:imum)?\s*(\d+)\b/i,
];

const FILTER_PATTERNS = [
  { pattern: /\bcategoria\s+["']?(\w+)["']?\b/i, column: "categoria" },
  { pattern: /\bcat(?:egory)?\s*[=:]\s*["']?(\w+)["']?\b/i, column: "category" },
  { pattern: /\btipo\s+["']?(\w+)["']?\b/i, column: "tipo" },
  { pattern: /\btype\s+["']?(\w+)["']?\b/i, column: "type" },
  { pattern: /\bdella\s+categoria\s+["']?(\w+)["']?\b/i, column: "categoria" },
];

export function detectSemanticContract(userQuestion: string): SemanticContract {
  const questionLower = userQuestion.toLowerCase();
  const detectedKeywords: string[] = [];
  const detectedFilters: { column: string; value: string }[] = [];
  let requestsAll = false;
  let requestsTopN = false;
  let topNValue: number | undefined;

  for (const keyword of ALL_KEYWORDS) {
    if (questionLower.includes(keyword.toLowerCase())) {
      detectedKeywords.push(keyword);
      requestsAll = true;
    }
  }

  for (const pattern of TOP_N_PATTERNS) {
    const match = questionLower.match(pattern);
    if (match) {
      requestsTopN = true;
      topNValue = parseInt(match[1], 10);
      detectedKeywords.push(match[0]);
      break;
    }
  }

  for (const { pattern, column } of FILTER_PATTERNS) {
    const match = userQuestion.match(pattern);
    if (match && match[1]) {
      detectedFilters.push({ column, value: match[1] });
    }
  }

  if (requestsAll && detectedKeywords.length > 0) {
    console.log(`[SEMANTIC-CONTRACT] Detected "ALL items" request: keywords=[${detectedKeywords.join(", ")}]`);
  }
  if (requestsTopN && topNValue) {
    console.log(`[SEMANTIC-CONTRACT] Detected "top N" request: N=${topNValue}`);
  }
  if (detectedFilters.length > 0) {
    console.log(`[SEMANTIC-CONTRACT] Detected filters: ${JSON.stringify(detectedFilters)}`);
  }

  return {
    requestsAll,
    requestsTopN,
    topNValue,
    detectedKeywords,
    detectedFilters,
  };
}

/**
 * TASK 4: Extract mentioned filters from user question
 * Used to inject missing filters before execution
 */
export function extractFiltersFromQuestion(
  userQuestion: string,
  availableColumns: string[]
): Record<string, { operator: string; value: string }> {
  const filters: Record<string, { operator: string; value: string }> = {};
  const questionLower = userQuestion.toLowerCase();

  const columnAliases: Record<string, string[]> = {
    "categoria": ["categoria", "category", "cat"],
    "tipo": ["tipo", "type"],
    "status": ["stato", "status"],
  };

  for (const { pattern, column } of FILTER_PATTERNS) {
    const match = userQuestion.match(pattern);
    if (match && match[1]) {
      const actualColumn = availableColumns.find(c => {
        const cLower = c.toLowerCase();
        if (cLower === column.toLowerCase()) return true;
        const aliases = columnAliases[column.toLowerCase()] || [];
        return aliases.some(alias => cLower.includes(alias));
      });

      if (actualColumn) {
        filters[actualColumn] = { operator: "=", value: match[1] };
        console.log(`[FILTER-EXTRACT] Found filter: ${actualColumn} = "${match[1]}"`);
      }
    }
  }

  return filters;
}

/**
 * TASK 4.5: Detect Quantitative Metric with Category Filter
 * Recognizes "quante pizze ho venduto" as a METRIC with FILTER, not a ranking
 * Returns: metric to use + filter to apply (category or product_name ILIKE)
 */
export interface QuantitativeMetricFilter {
  isQuantitativeWithFilter: boolean;
  metricName: string;  // e.g., 'quantity_total' or 'items_sold'
  categoryTerm: string | null;  // e.g., 'pizza', 'bevande', 'coperti'
  filterType: 'category' | 'product_ilike' | 'exact_match' | null;
}

const QUANTITATIVE_KEYWORDS = [
  'quant[ei]', 'total[ei]?', 'volume', 'pezzi', 'numero di', 'conteggio',
  'how many', 'total', 'count of', 'number of'
];

/**
 * CATEGORY_TERMS: Semantic category mapping
 * 
 * DESIGN DECISION: When user says "pizze", we filter by category='Pizza' (not ILIKE on product names)
 * - categoryValue: The exact value to filter in the 'category' column (preferred)
 * - searchPatterns: Legacy patterns for text search (fallback)
 * - productIlike: ILIKE patterns for product_name (only if no category column available)
 */
const CATEGORY_TERMS: Record<string, { 
  categoryValue: string;  // PREFERRED: Exact category filter value (e.g., 'Pizza')
  searchPatterns: string[];
  productIlike: string[]; 
}> = {
  'pizza': { categoryValue: 'Pizza', searchPatterns: ['pizz'], productIlike: ['%margherit%', '%diavol%', '%capriccio%', '%4 stagion%', '%marinara%', '%napole%', '%roman%'] },
  'pizze': { categoryValue: 'Pizza', searchPatterns: ['pizz'], productIlike: ['%margherit%', '%diavol%', '%capriccio%', '%4 stagion%', '%marinara%', '%napole%', '%roman%'] },
  'bevande': { categoryValue: 'Bevande', searchPatterns: ['bevand', 'drink'], productIlike: ['%acqua%', '%coca%', '%fanta%', '%sprite%', '%birra%', '%vino%'] },
  'bevanda': { categoryValue: 'Bevande', searchPatterns: ['bevand', 'drink'], productIlike: ['%acqua%', '%coca%', '%fanta%', '%sprite%', '%birra%', '%vino%'] },
  'birre': { categoryValue: 'Birre', searchPatterns: ['birr'], productIlike: ['%birra%', '%bionda%', '%rossa%', '%ipa%', '%lager%'] },
  'birra': { categoryValue: 'Birre', searchPatterns: ['birr'], productIlike: ['%birra%', '%bionda%', '%rossa%', '%ipa%', '%lager%'] },
  'dolci': { categoryValue: 'Dolci', searchPatterns: ['dolc', 'dessert'], productIlike: ['%tiramisu%', '%torta%', '%gelato%', '%panna cotta%', '%sorbetto%'] },
  'dolce': { categoryValue: 'Dolci', searchPatterns: ['dolc', 'dessert'], productIlike: ['%tiramisu%', '%torta%', '%gelato%', '%panna cotta%', '%sorbetto%'] },
  'dessert': { categoryValue: 'Dessert', searchPatterns: ['dolc', 'dessert'], productIlike: ['%tiramisu%', '%torta%', '%gelato%', '%panna cotta%', '%sorbetto%'] },
  'coperti': { categoryValue: 'Coperti', searchPatterns: ['copert'], productIlike: ['%coperto%'] },
  'coperto': { categoryValue: 'Coperti', searchPatterns: ['copert'], productIlike: ['%coperto%'] },
  'caffè': { categoryValue: 'Caffè', searchPatterns: ['caff'], productIlike: ['%caff%', '%espresso%', '%cappuccino%'] },
  'caffe': { categoryValue: 'Caffè', searchPatterns: ['caff'], productIlike: ['%caff%', '%espresso%', '%cappuccino%'] },
  'antipasti': { categoryValue: 'Antipasti', searchPatterns: ['antipast'], productIlike: ['%bruschett%', '%frittur%', '%affettat%'] },
  'antipasto': { categoryValue: 'Antipasti', searchPatterns: ['antipast'], productIlike: ['%bruschett%', '%frittur%', '%affettat%'] },
  'primi': { categoryValue: 'Primi', searchPatterns: ['prim'], productIlike: ['%pasta%', '%risotto%', '%gnocchi%', '%lasagn%'] },
  'primo': { categoryValue: 'Primi', searchPatterns: ['prim'], productIlike: ['%pasta%', '%risotto%', '%gnocchi%', '%lasagn%'] },
  'secondi': { categoryValue: 'Secondi', searchPatterns: ['second'], productIlike: ['%carne%', '%pesce%', '%grigliata%', '%tagliata%'] },
  'secondo': { categoryValue: 'Secondi', searchPatterns: ['second'], productIlike: ['%carne%', '%pesce%', '%grigliata%', '%tagliata%'] },
  'contorni': { categoryValue: 'Contorni', searchPatterns: ['contorn'], productIlike: ['%insalat%', '%patatine%', '%verdur%'] },
  'contorno': { categoryValue: 'Contorni', searchPatterns: ['contorn'], productIlike: ['%insalat%', '%patatine%', '%verdur%'] },
  'vini': { categoryValue: 'Vini', searchPatterns: ['vin'], productIlike: ['%vino%', '%rosso%', '%bianco%', '%rosato%'] },
  'vino': { categoryValue: 'Vini', searchPatterns: ['vin'], productIlike: ['%vino%', '%rosso%', '%bianco%', '%rosato%'] },
};

/**
 * CATEGORY TERM DETECTION (ALWAYS, not just ranking)
 * Detects when user mentions a category term like "pizze", "bevande", "dolci"
 * This should trigger semantic category filtering regardless of query type
 */
interface CategoryTermDetection {
  hasCategoryTerm: boolean;
  categoryTerm: string | null;
  categoryValue: string | null;  // The value to filter (e.g., 'Pizza')
}

export function detectCategoryTermInQuestion(userQuestion: string): CategoryTermDetection {
  const questionLower = userQuestion.toLowerCase();
  
  // Check all CATEGORY_TERMS for presence in question
  for (const [term, config] of Object.entries(CATEGORY_TERMS)) {
    // Use word boundary to avoid false positives (e.g., "primi" in "primissimi")
    const termRegex = new RegExp(`\\b${term}\\b`, 'i');
    if (termRegex.test(questionLower)) {
      console.log(`[CATEGORY-DETECT] Found category term "${term}" → categoryValue="${config.categoryValue}"`);
      return {
        hasCategoryTerm: true,
        categoryTerm: term,
        categoryValue: config.categoryValue
      };
    }
  }
  
  return { hasCategoryTerm: false, categoryTerm: null, categoryValue: null };
}

/**
 * SEMANTIC ORDER BY METRIC DETECTION
 * Maps user intent keywords to the correct metric for ordering
 * Example: "più profittevoli" → gross_margin, "più venduti" → quantity
 */
interface SemanticOrderByMetric {
  hasSemanticMetric: boolean;
  metricName: string | null;      // The metric to order by (e.g., 'gross_margin')
  direction: 'ASC' | 'DESC';      // Sort direction
  displayColumn: string | null;   // Column alias for display (e.g., 'margine_lordo')
}

const SEMANTIC_METRIC_KEYWORDS: Record<string, { metric: string; direction: 'ASC' | 'DESC'; displayColumn: string }> = {
  // Profitability keywords → gross_margin
  'profittevol': { metric: 'gross_margin', direction: 'DESC', displayColumn: 'margine_lordo' },
  'profitto': { metric: 'gross_margin', direction: 'DESC', displayColumn: 'margine_lordo' },
  'margine': { metric: 'gross_margin', direction: 'DESC', displayColumn: 'margine_lordo' },
  'guadagno': { metric: 'gross_margin', direction: 'DESC', displayColumn: 'margine_lordo' },
  'redditizi': { metric: 'gross_margin', direction: 'DESC', displayColumn: 'margine_lordo' },
  'redditivit': { metric: 'gross_margin', direction: 'DESC', displayColumn: 'margine_lordo' },
  
  // Revenue keywords → revenue
  'fatturato': { metric: 'revenue', direction: 'DESC', displayColumn: 'fatturato' },
  'incasso': { metric: 'revenue', direction: 'DESC', displayColumn: 'fatturato' },
  'ricavo': { metric: 'revenue', direction: 'DESC', displayColumn: 'fatturato' },
  'vendite valore': { metric: 'revenue', direction: 'DESC', displayColumn: 'fatturato' },
  
  // Quantity keywords → quantity
  'vendut': { metric: 'quantity', direction: 'DESC', displayColumn: 'quantita_venduta' },
  'quantità': { metric: 'quantity', direction: 'DESC', displayColumn: 'quantita_venduta' },
  'volum': { metric: 'quantity', direction: 'DESC', displayColumn: 'quantita_venduta' },
  'popolar': { metric: 'quantity', direction: 'DESC', displayColumn: 'quantita_venduta' },
  'richiest': { metric: 'quantity', direction: 'DESC', displayColumn: 'quantita_venduta' },
  
  // Cost keywords → cost (for "most expensive" type queries)
  'costoso': { metric: 'cost', direction: 'DESC', displayColumn: 'costo' },
  'caro': { metric: 'cost', direction: 'DESC', displayColumn: 'costo' },
  'economico': { metric: 'cost', direction: 'ASC', displayColumn: 'costo' },
  
  // Low performers (ASC)
  'peggior': { metric: 'gross_margin', direction: 'ASC', displayColumn: 'margine_lordo' },
  'meno vendut': { metric: 'quantity', direction: 'ASC', displayColumn: 'quantita_venduta' },
};

export function detectSemanticOrderByMetric(userQuestion: string): SemanticOrderByMetric {
  const questionLower = userQuestion.toLowerCase();
  
  // Check for semantic keywords
  for (const [keyword, config] of Object.entries(SEMANTIC_METRIC_KEYWORDS)) {
    if (questionLower.includes(keyword)) {
      console.log(`[SEMANTIC-ORDERBY] Detected "${keyword}" → metric="${config.metric}", direction=${config.direction}`);
      return {
        hasSemanticMetric: true,
        metricName: config.metric,
        direction: config.direction,
        displayColumn: config.displayColumn
      };
    }
  }
  
  return { hasSemanticMetric: false, metricName: null, direction: 'DESC', displayColumn: null };
}

/**
 * RANKING WITH CATEGORY FILTER DETECTION
 * Detects queries like "Top 5 pizze", "i 10 drink più venduti"
 * These MUST apply category filter BEFORE ranking
 */
interface RankingWithCategoryFilter {
  isRankingWithFilter: boolean;
  limit: number;
  categoryTerm: string | null;
  metricType: 'quantity' | 'revenue';
}

const RANKING_PATTERNS = [
  /top\s*(\d+)\s+(\w+)/i,                           // "Top 5 pizze"
  /(?:i|le|gli)\s+(\d+)\s+(\w+)\s+(?:più|piu)/i,   // "i 5 prodotti più venduti"
  /(?:prime|primi)\s+(\d+)\s+(\w+)/i,              // "prime 5 pizze"
  /classifica\s+(?:top\s*)?(\d+)?\s*(\w+)/i,       // "classifica pizze", "classifica top 10 pizze"
  /(?:migliori|peggiori)\s+(\d+)\s+(\w+)/i,        // "migliori 5 pizze"
];

export function detectRankingWithCategoryFilter(userQuestion: string): RankingWithCategoryFilter {
  const questionLower = userQuestion.toLowerCase();
  
  // IMPROVED: First check if any CATEGORY_TERMS are present in the question
  // This is more robust than regex capture groups
  let detectedCategory: string | null = null;
  for (const [term, config] of Object.entries(CATEGORY_TERMS)) {
    if (questionLower.includes(term)) {
      detectedCategory = term;
      break;
    }
  }
  
  // If no category found, this is not a ranking-with-filter query
  if (!detectedCategory) {
    return { isRankingWithFilter: false, limit: 10, categoryTerm: null, metricType: 'quantity' };
  }
  
  // Check if this is a ranking query (has Top N, migliori, classifica, etc.)
  const isRankingQuery = /top\s*\d+|migliori\s*\d*|peggiori\s*\d*|classifica|prime\s*\d+|primi\s*\d+|più\s*(vendut|popolar|richiest)/i.test(questionLower);
  
  if (!isRankingQuery) {
    return { isRankingWithFilter: false, limit: 10, categoryTerm: null, metricType: 'quantity' };
  }
  
  // Extract limit from query (default 10)
  const limitMatch = questionLower.match(/top\s*(\d+)|migliori\s*(\d+)|peggiori\s*(\d+)|prime\s*(\d+)|primi\s*(\d+)/i);
  let limit = 10;
  if (limitMatch) {
    const matchedNumber = limitMatch[1] || limitMatch[2] || limitMatch[3] || limitMatch[4] || limitMatch[5];
    if (matchedNumber) {
      limit = parseInt(matchedNumber);
    }
  }
  
  // Detect if asking for revenue or quantity
  const isRevenueQuery = /fatturato|revenue|incasso|vendite|ricavo/i.test(questionLower);
  
  console.log(`[RANKING-FILTER] Detected ranking with category: "${detectedCategory}", limit=${limit}, metric=${isRevenueQuery ? 'revenue' : 'quantity'}`);
  
  return {
    isRankingWithFilter: true,
    limit,
    categoryTerm: detectedCategory,
    metricType: isRevenueQuery ? 'revenue' : 'quantity'
  };
}

export function detectQuantitativeMetricWithFilter(userQuestion: string): QuantitativeMetricFilter {
  const questionLower = userQuestion.toLowerCase();
  
  // Check for quantitative keywords
  const hasQuantitativeKeyword = QUANTITATIVE_KEYWORDS.some(kw => {
    const regex = new RegExp(`\\b${kw}\\b`, 'i');
    return regex.test(questionLower);
  });
  
  if (!hasQuantitativeKeyword) {
    return { isQuantitativeWithFilter: false, metricName: '', categoryTerm: null, filterType: null };
  }
  
  // Look for category terms in the question
  for (const [term, config] of Object.entries(CATEGORY_TERMS)) {
    if (questionLower.includes(term)) {
      console.log(`[QUANTITATIVE-FILTER] Detected quantitative query with category: "${term}"`);
      return {
        isQuantitativeWithFilter: true,
        metricName: 'quantity_total',
        categoryTerm: term,
        filterType: 'product_ilike',  // Default to product ILIKE since category columns often have codes
      };
    }
  }
  
  return { isQuantitativeWithFilter: false, metricName: '', categoryTerm: null, filterType: null };
}

/**
 * Build ILIKE filter conditions for a category term
 * Returns SQL WHERE clause patterns for product_name column
 */
export function buildCategoryIlikeFilters(categoryTerm: string, productColumn: string): string[] {
  const termConfig = CATEGORY_TERMS[categoryTerm.toLowerCase()];
  if (!termConfig) {
    // Fallback: use the term itself as ILIKE pattern
    return [`"${productColumn}" ILIKE '%${categoryTerm}%'`];
  }
  
  // Build OR conditions for all patterns
  return termConfig.productIlike.map(pattern => `"${productColumn}" ILIKE '${pattern}'`);
}

/**
 * Execute a quantitative metric (like quantity_total) with category filter
 * Uses ILIKE on product_name column to filter by category
 */
interface QuantitativeMetricResult {
  success: boolean;
  data?: { result: string; categoryTerm: string; matchedRows?: number };
  error?: string;
  executionTimeMs?: number;
}

async function executeQuantitativeMetricWithFilter(
  datasetId: string,
  categoryTerm: string,
  metricName: string
): Promise<QuantitativeMetricResult> {
  const startTime = Date.now();
  
  try {
    // Get dataset info and semantic mappings
    const datasetIdNum = parseInt(datasetId);
    if (isNaN(datasetIdNum)) {
      return { success: false, error: "Invalid dataset ID" };
    }
    
    // Get dataset table name
    const dataset = await db.query.clientDataDatasets.findFirst({
      where: eq(clientDataDatasets.id, datasetIdNum)
    });
    
    if (!dataset || !dataset.tableName) {
      return { success: false, error: "Dataset not found" };
    }
    
    // Get semantic mappings
    const mappings = await db.query.datasetColumnMappings.findMany({
      where: eq(datasetColumnMappings.datasetId, datasetIdNum)
    });
    
    // Find product_name and quantity columns
    const productMapping = mappings.find(m => m.logicalColumn === 'product_name');
    const quantityMapping = mappings.find(m => m.logicalColumn === 'quantity');
    
    if (!productMapping) {
      return { success: false, error: "No product_name column mapped for this dataset" };
    }
    
    const productColumn = productMapping.physicalColumn;
    const quantityColumn = quantityMapping?.physicalColumn || null;
    
    // Build ILIKE conditions for category
    const ilikeConditions = buildCategoryIlikeFilters(categoryTerm, productColumn);
    const whereClause = ilikeConditions.length > 0 
      ? `WHERE (${ilikeConditions.join(' OR ')})` 
      : '';
    
    // Build metric SQL based on metricName
    let metricSql: string;
    if (metricName === 'quantity_total' && quantityColumn) {
      metricSql = `SUM(CAST("${quantityColumn}" AS NUMERIC))`;
    } else if (metricName === 'items_sold') {
      metricSql = `COUNT(*)`;
    } else {
      // Fallback to COUNT for unknown metrics
      metricSql = `COUNT(*)`;
    }
    
    // Execute query
    const sql = `SELECT ${metricSql} AS result, COUNT(*) AS matched_rows FROM "${dataset.tableName}" ${whereClause}`;
    console.log(`[QUANTITATIVE-FILTER] Executing SQL: ${sql}`);
    
    const { pool } = await import("../../db");
    const result = await pool.query(sql);
    
    if (result.rows.length === 0) {
      return { 
        success: true, 
        data: { result: "0", categoryTerm, matchedRows: 0 },
        executionTimeMs: Date.now() - startTime
      };
    }
    
    const row = result.rows[0];
    const value = row.result || "0";
    const matchedRows = parseInt(row.matched_rows) || 0;
    
    console.log(`[QUANTITATIVE-FILTER] Result: ${value} (matched ${matchedRows} rows for "${categoryTerm}")`);
    
    return { 
      success: true, 
      data: { 
        result: String(value), 
        categoryTerm,
        matchedRows
      },
      executionTimeMs: Date.now() - startTime
    };
    
  } catch (error: any) {
    console.error(`[QUANTITATIVE-FILTER] Error: ${error.message}`);
    return { success: false, error: error.message, executionTimeMs: Date.now() - startTime };
  }
}

/**
 * TASK 5: Detect if user is asking for product listing vs category comparison
 * Returns the correct column to use for groupBy AND the search term for ILIKE filter
 */
interface GroupByValidation {
  isProductListing: boolean;
  isCategoryComparison: boolean;
  productColumn: string | null;
  categoryColumn: string | null;
  detectedPatterns: string[];
  searchTerm: string | null;
  categoryFilter: string | null;
  quantityColumn: string | null;
}

const PRODUCT_COLUMN_NAMES = [
  'item_name', 'product_name', 'nome_prodotto', 'dish_name', 'menu_item', 
  'article', 'articolo', 'piatto', 'prodotto', 'product', 'item'
];

const CATEGORY_COLUMN_NAMES = [
  'category', 'categoria', 'type', 'tipo', 'group', 'gruppo', 
  'department', 'reparto', 'class', 'classe'
];

const QUANTITY_COLUMN_NAMES = [
  'quantity', 'quantità', 'qty', 'amount', 'count', 'numero'
];

const PRODUCT_SEARCH_PATTERNS: { pattern: RegExp; searchGroup: number; categoryHint?: string }[] = [
  { pattern: /che\s+(pizze?)\s+(abbiamo|ci sono|sono|vendiamo|disponibili|offriamo)/i, searchGroup: 1, categoryHint: 'Food' },
  { pattern: /che\s+(birre?|vini?|cocktail|bevande?|drink)\s+(abbiamo|ci sono|sono|vendiamo|disponibili)/i, searchGroup: 1, categoryHint: 'Drink' },
  { pattern: /che\s+(dolci?|dessert)\s+(abbiamo|ci sono|sono|vendiamo|disponibili)/i, searchGroup: 1, categoryHint: 'Dessert' },
  { pattern: /che\s+(antipasti?|primi?|secondi?|contorni?|piatti?)\s+(abbiamo|ci sono|sono|vendiamo|disponibili)/i, searchGroup: 1, categoryHint: 'Food' },
  { pattern: /quali\s+(pizze?|birre?|vini?|piatti?|prodotti?|articoli?)/i, searchGroup: 1 },
  { pattern: /elenco\s+(dei|delle|di|delle)?\s*(pizze?|birre?|vini?|prodotti?|piatti?)/i, searchGroup: 2 },
  { pattern: /mostrami\s+(tutti|tutte|le|i|gli)?\s*(pizze?|birre?|vini?|prodotti?|piatti?)/i, searchGroup: 2 },
  { pattern: /lista\s+(dei|delle|di|delle)?\s*(pizze?|birre?|vini?|prodotti?|piatti?)/i, searchGroup: 2 },
  { pattern: /(pizze?|birre?|vini?|cocktail)\s+(più\s+vendut[ei]|vendute|venduti|migliori|top)/i, searchGroup: 1 },
  { pattern: /(pizze?|birre?|prodotti?)\s+(disponibili|a\s+menu|in\s+menu)/i, searchGroup: 1 },
  { pattern: /vorrei\s+(le\s+)?(pizze?|birre?|prodotti?)/i, searchGroup: 2 },
  { pattern: /(menu|menù)\s+(pizze?|birre?)/i, searchGroup: 2 },
];

const CATEGORY_COMPARISON_PATTERNS = [
  /confronto\s+(tra\s+)?(categorie|tipi|gruppi)/i,
  /per\s+categoria/i,
  /breakdown\s+(per|by)\s+(categoria|tipo|category)/i,
  /food\s+vs\s+drink/i,
  /(raggruppato|raggruppa|raggruppare)\s+per\s+(categoria|tipo)/i,
];

const SEARCH_TERM_TO_CATEGORY: Record<string, string> = {
  'pizza': 'Food', 'pizze': 'Food',
  'piatto': 'Food', 'piatti': 'Food',
  'antipasto': 'Food', 'antipasti': 'Food',
  'primo': 'Food', 'primi': 'Food',
  'secondo': 'Food', 'secondi': 'Food',
  'contorno': 'Food', 'contorni': 'Food',
  'birra': 'Drink', 'birre': 'Drink',
  'vino': 'Drink', 'vini': 'Drink',
  'cocktail': 'Drink',
  'bevanda': 'Drink', 'bevande': 'Drink',
  'drink': 'Drink',
  'dolce': 'Dessert', 'dolci': 'Dessert',
  'dessert': 'Dessert',
};

function normalizeSearchTerm(term: string): string {
  const normalized = term.toLowerCase()
    .replace(/pizze$/i, 'pizza')
    .replace(/birre$/i, 'birra')
    .replace(/vini$/i, 'vino')
    .replace(/piatti$/i, '')
    .replace(/prodotti$/i, '')
    .replace(/articoli$/i, '');
  return normalized;
}

export function detectGroupByIntent(
  userQuestion: string,
  availableColumns: string[]
): GroupByValidation {
  const questionLower = userQuestion.toLowerCase();
  const detectedPatterns: string[] = [];
  
  let isProductListing = false;
  let isCategoryComparison = false;
  let searchTerm: string | null = null;
  let categoryFilter: string | null = null;
  
  for (const { pattern, searchGroup, categoryHint } of PRODUCT_SEARCH_PATTERNS) {
    const match = userQuestion.match(pattern);
    if (match) {
      isProductListing = true;
      detectedPatterns.push(match[0]);
      
      const rawTerm = match[searchGroup];
      if (rawTerm && rawTerm.length > 2) {
        searchTerm = normalizeSearchTerm(rawTerm);
        // FIX 1: Prefer CATEGORY_TERMS.categoryValue (specific like 'Pizza') over SEARCH_TERM_TO_CATEGORY (generic like 'Food')
        const categoryTermDef = CATEGORY_TERMS[rawTerm.toLowerCase()];
        categoryFilter = categoryTermDef?.categoryValue || categoryHint || SEARCH_TERM_TO_CATEGORY[rawTerm.toLowerCase()] || null;
        console.log(`[GROUPBY-VALIDATION] Extracted searchTerm="${searchTerm}", categoryFilter="${categoryFilter}" (from CATEGORY_TERMS: ${!!categoryTermDef})`);
      }
      break;
    }
  }
  
  for (const pattern of CATEGORY_COMPARISON_PATTERNS) {
    if (pattern.test(userQuestion)) {
      isCategoryComparison = true;
      isProductListing = false;
      searchTerm = null;
      categoryFilter = null;
      const match = userQuestion.match(pattern);
      if (match) detectedPatterns.push(match[0]);
    }
  }
  
  const productColumn = availableColumns.find(col => 
    PRODUCT_COLUMN_NAMES.some(name => col.toLowerCase().includes(name.toLowerCase()))
  ) || null;
  
  const categoryColumn = availableColumns.find(col => 
    CATEGORY_COLUMN_NAMES.some(name => col.toLowerCase() === name.toLowerCase())
  ) || null;

  const quantityColumn = availableColumns.find(col =>
    QUANTITY_COLUMN_NAMES.some(name => col.toLowerCase().includes(name.toLowerCase()))
  ) || null;
  
  if (detectedPatterns.length > 0) {
    console.log(`[GROUPBY-VALIDATION] Detected patterns: ${detectedPatterns.join(', ')}`);
    console.log(`[GROUPBY-VALIDATION] isProductListing=${isProductListing}, isCategoryComparison=${isCategoryComparison}`);
    console.log(`[GROUPBY-VALIDATION] productColumn=${productColumn}, categoryColumn=${categoryColumn}, quantityColumn=${quantityColumn}`);
    console.log(`[GROUPBY-VALIDATION] searchTerm=${searchTerm}, categoryFilter=${categoryFilter}`);
  }
  
  return {
    isProductListing,
    isCategoryComparison,
    productColumn,
    categoryColumn,
    detectedPatterns,
    searchTerm,
    categoryFilter,
    quantityColumn,
  };
}

/**
 * TASK 5: Auto-correct groupBy AND inject complete query structure for product listing
 * 
 * CORRECT QUERY PATTERN for "che pizze abbiamo":
 * - filter: category = 'Food' AND item_name ILIKE '%pizza%'
 * - groupBy: [item_name]
 * - metric: SUM(quantity)
 * - orderBy: quantity DESC
 */
interface ToolCallCorrection {
  corrected: boolean;
  originalGroupBy: string[];
  newGroupBy: string[];
  injectedFilters: Record<string, any>;
  injectedAggregations: any[];
  injectedOrderBy: any;
}

/**
 * Detect if user is asking for "best" (DESC) or "worst" (ASC) ranking
 */
function detectRankingDirection(userQuestion: string): 'DESC' | 'ASC' {
  const worstPatterns = [
    /peggio/i, /peggiore/i, /peggiori/i,
    /meno\s+(vendut|vendit)/i,
    /minor[ei]?\s+(fatturato|vendite|revenue)/i,
    /performato?\s+peggio/i,
    /ultim[oi]/i,
    /fondo\s+(classifica|lista)/i,
    /flop/i,
    /scarso/i, /scarse/i,
  ];
  
  for (const pattern of worstPatterns) {
    if (pattern.test(userQuestion)) {
      console.log(`[RANKING-DIRECTION] Detected WORST pattern: ${pattern}`);
      return 'ASC';
    }
  }
  
  return 'DESC'; // Default: best = highest value
}

export function validateAndCorrectGroupBy(
  toolCall: ToolCall,
  groupByIntent: GroupByValidation,
  userQuestion?: string
): ToolCallCorrection {
  const result: ToolCallCorrection = {
    corrected: false,
    originalGroupBy: [],
    newGroupBy: [],
    injectedFilters: {},
    injectedAggregations: [],
    injectedOrderBy: null,
  };

  if (toolCall.name !== 'aggregate_group' && toolCall.name !== 'filter_data') {
    return result;
  }
  
  // Detect ranking direction from user question
  const rankingDirection = userQuestion ? detectRankingDirection(userQuestion) : 'DESC';
  
  const groupBy = toolCall.args.groupBy as string[] || [];
  result.originalGroupBy = [...groupBy];
  result.newGroupBy = [...groupBy];
  
  if (!groupByIntent.isProductListing || !groupByIntent.productColumn) {
    return result;
  }

  // Initialize filters if not present
  if (!toolCall.args.filters) {
    toolCall.args.filters = {};
  }
  const filters = toolCall.args.filters as Record<string, any>;
  
  // 1. CORRECT GROUPBY: Use product column instead of category
  const usesCategory = groupBy.some(col => 
    CATEGORY_COLUMN_NAMES.some(catName => col.toLowerCase() === catName.toLowerCase())
  );
  
  const usesProduct = groupBy.some(col =>
    PRODUCT_COLUMN_NAMES.some(prodName => col.toLowerCase().includes(prodName.toLowerCase()))
  );
  
  if ((usesCategory && !usesProduct) || groupBy.length === 0) {
    console.log(`[GROUPBY-CORRECTION] Correcting groupBy for product listing`);
    console.log(`[GROUPBY-CORRECTION] Original: ${JSON.stringify(groupBy)} → [${groupByIntent.productColumn}]`);
    toolCall.args.groupBy = [groupByIntent.productColumn];
    result.newGroupBy = [groupByIntent.productColumn];
    result.corrected = true;
  }

  // 2. INJECT/OVERRIDE CATEGORY FILTER: category = 'Food' (if detected)
  // FORCE override even if AI set different category
  if (groupByIntent.categoryFilter && groupByIntent.categoryColumn) {
    const existingCatFilter = filters[groupByIntent.categoryColumn];
    const needsOverride = !existingCatFilter || existingCatFilter.value !== groupByIntent.categoryFilter;
    
    if (needsOverride) {
      if (existingCatFilter) {
        console.log(`[FILTER-OVERRIDE] Overriding category: ${existingCatFilter.value} → ${groupByIntent.categoryFilter}`);
      }
      filters[groupByIntent.categoryColumn] = { 
        operator: '=', 
        value: groupByIntent.categoryFilter 
      };
      result.injectedFilters[groupByIntent.categoryColumn] = groupByIntent.categoryFilter;
      result.corrected = true;
      console.log(`[FILTER-INJECTION] category filter: ${groupByIntent.categoryColumn} = '${groupByIntent.categoryFilter}'`);
    }
  }

  // 3. INJECT/OVERRIDE ILIKE FILTER: item_name ILIKE '%pizza%' (if searchTerm is specific)
  // FIX 4: SKIP ILIKE when we have a precise category filter from CATEGORY_TERMS
  // If categoryFilter came from CATEGORY_TERMS (e.g., 'Pizza'), the category filter is sufficient
  const searchTermLower = groupByIntent.searchTerm?.toLowerCase() || '';
  const hasPreciseCategoryFilter = CATEGORY_TERMS[searchTermLower]?.categoryValue === groupByIntent.categoryFilter;
  
  if (hasPreciseCategoryFilter) {
    console.log(`[FILTER-INJECTION] SKIP ILIKE: Using precise category filter '${groupByIntent.categoryFilter}' instead of ILIKE '%${groupByIntent.searchTerm}%'`);
  } else if (groupByIntent.searchTerm && groupByIntent.productColumn) {
    const genericTerms = ['piatto', 'prodotto', 'articolo', 'piatti', 'prodotti', 'articoli', ''];
    if (!genericTerms.includes(groupByIntent.searchTerm)) {
      const existingProdFilter = filters[groupByIntent.productColumn];
      const ilikeValue = `%${groupByIntent.searchTerm}%`;
      const needsOverride = !existingProdFilter || 
                            existingProdFilter.operator !== 'ILIKE' || 
                            existingProdFilter.value !== ilikeValue;
      
      if (needsOverride) {
        if (existingProdFilter) {
          console.log(`[FILTER-OVERRIDE] Overriding product filter: ${JSON.stringify(existingProdFilter)} → ILIKE '${ilikeValue}'`);
        }
        filters[groupByIntent.productColumn] = {
          operator: 'ILIKE',
          value: ilikeValue
        };
        result.injectedFilters[groupByIntent.productColumn] = ilikeValue;
        result.corrected = true;
        console.log(`[FILTER-INJECTION] ILIKE filter: ${groupByIntent.productColumn} ILIKE '${ilikeValue}'`);
      }
    }
  }

  // 4. INJECT AGGREGATION: SUM(quantity) if aggregate_group and quantity column exists
  if (toolCall.name === 'aggregate_group' && groupByIntent.quantityColumn) {
    const aggregations = (toolCall.args.aggregations as any[]) || [];
    const hasQuantityAgg = aggregations.some(agg => 
      agg.column?.toLowerCase() === groupByIntent.quantityColumn?.toLowerCase()
    );
    
    if (!hasQuantityAgg) {
      aggregations.push({
        function: 'SUM',
        column: groupByIntent.quantityColumn,
        alias: 'totale_venduto'
      });
      toolCall.args.aggregations = aggregations;
      result.injectedAggregations.push({ function: 'SUM', column: groupByIntent.quantityColumn });
      result.corrected = true;
      console.log(`[AGGREGATION-INJECTION] SUM(${groupByIntent.quantityColumn}) as totale_venduto`);
    }

    // 5. INJECT ORDER BY: Use detected ranking direction (DESC for "best", ASC for "worst")
    if (!toolCall.args.orderBy || !toolCall.args.orderBy.column) {
      toolCall.args.orderBy = {
        column: 'totale_venduto',
        direction: rankingDirection
      };
      result.injectedOrderBy = { column: 'totale_venduto', direction: rankingDirection };
      result.corrected = true;
      console.log(`[ORDERBY-INJECTION] ORDER BY totale_venduto ${rankingDirection}`);
    } else if (toolCall.args.orderBy.column) {
      // Override direction if orderBy exists but direction might be wrong
      const existingDirection = toolCall.args.orderBy.direction;
      if (rankingDirection !== existingDirection) {
        console.log(`[ORDERBY-OVERRIDE] Changing direction: ${existingDirection} → ${rankingDirection}`);
        toolCall.args.orderBy.direction = rankingDirection;
        result.injectedOrderBy = toolCall.args.orderBy;
        result.corrected = true;
      }
    }
  }

  toolCall.args.filters = filters;

  if (result.corrected) {
    console.log(`[GROUPBY-CORRECTION] Final tool call args: ${JSON.stringify(toolCall.args)}`);
  }
  
  return result;
}

interface DatasetInfo {
  id: string;
  name: string;
  columns: { name: string; displayName: string; dataType: string; description?: string }[];
  rowCount: number;
  metrics?: { name: string; dslFormula: string; description?: string }[];
}

export interface QueryPlan {
  steps: ToolCall[];
  reasoning: string;
  estimatedComplexity: "simple" | "medium" | "complex";
}

export interface QueryExecutionResult {
  plan: QueryPlan;
  results: ExecutedToolResult[];
  success: boolean;
  totalExecutionTimeMs: number;
}

interface ToolCallValidationResult {
  valid: boolean;
  errors: string[];
  repairedToolCall?: ToolCall;
}

const MAX_PLANNING_RETRIES = 2;

const SYSTEM_PROMPT_IT = `Sei un assistente AI specializzato in analytics deterministici su database.

Il tuo compito è:
1) Pianificare le query
2) Chiamare i tool corretti
3) Restituire SOLO risultati verificabili dai tool

========================
REGOLE FONDAMENTALI
========================

1) VERITÀ NUMERICA (OBBLIGATORIA)
- Se la risposta contiene numeri, valute (€), percentuali (%) o KPI:
  DEVI chiamare almeno un tool compute (execute_metric / aggregate_group / compare_periods).
- NON generare MAI numeri autonomamente.
- NON fare stime, proiezioni o arrotondamenti creativi.

2) NO SOSTITUZIONE METRICHE
- Se una metrica richiesta non è disponibile (es: manca customer_id):
  NON sostituirla con un’altra metrica simile.
  Rispondi: "Impossibile calcolare: dati insufficienti."


========================
DATI MANCANTI - ONESTÀ OBBLIGATORIA
========================

PRIMA di rispondere, verifica che le colonne necessarie ESISTANO nel dataset.
Se la domanda richiede dati che NON sono presenti nelle colonne:
- NON inventare risposte
- NON fare assunzioni
- Rispondi ONESTAMENTE: "Per rispondere mi servirebbero i dati di [X], che non sono presenti nel dataset."

Esempi OBBLIGATORI:
- "Vendite a pranzo/cena/notte?" → Se non c'è colonna orario/timestamp: "Non ho i dati degli orari"
- "Vendite weekend vs settimana?" → Se non c'è colonna data: "Non ho le date degli ordini"
- "Quanto costa il personale?" → Se non c'è labor_cost: "Non ho i costi del personale"
- "Prime Cost?" → Richiede food_cost + labor_cost. Se manca labor: "Per il Prime Cost mi serve anche il costo del personale, che non è nel dataset"
- "Quanti clienti unici?" → Se non c'è customer_id univoco: "Non ho un identificativo cliente affidabile"

REGOLA D'ORO: Se non hai la colonna, NON PUOI rispondere. Dillo chiaramente.

3) SOLO METRICHE REGISTRATE
- Usa ESCLUSIVAMENTE metriche predefinite.
- NON inventare formule DSL se esiste una metrica ufficiale.

METRICHE PREDEFINITE (execute_metric / aggregate_group):
- revenue → Fatturato totale
- food_cost → Costo materie prime
- food_cost_percent → Food cost %
- ticket_medio → Valore medio per ordine
- quantity_total → Quantità totale articoli
- order_count → Numero ordini
- avg_unit_price → Prezzo medio unitario
- gross_margin → Margine lordo
- gross_margin_percent → Margine lordo %
- discount_total → Sconti totali
- discount_percent_on_revenue → Incidenza sconti %

4) DIVIETO METRICHE DERIVATE INTERNE
- NON calcolare MAI internamente: "revenue / quantity = prezzo medio"
- NON fare divisioni tra output di tool diversi
- Se vuoi "prezzo medio per categoria" → aggregate_group(category, avg_unit_price)
- Se vuoi "conversion rate" → la metrica DEVE esistere, altrimenti dire "metrica non disponibile"
- Ogni numero nella risposta DEVE provenire DIRETTAMENTE da un tool output

5) TOOL PRIORITY
1. execute_metric → metriche singole
2. aggregate_group → breakdown (MAX 500 righe)
3. compare_periods → confronti temporali
4. filter_data → righe raw (MAX 1000 righe)

6) QUERY OBBLIGATORIE - MATCHING ESATTO
- "fatturato", "vendite", "revenue" → execute_metric(metricName: revenue)
- "food cost" → execute_metric(food_cost o food_cost_percent)
- "ticket medio" → execute_metric(ticket_medio)
- "prezzo medio" → execute_metric o aggregate_group(avg_unit_price)
- "margine lordo €", "margine in euro", "profitto €" → execute_metric(gross_margin) - MAI usare revenue!
- "margine lordo %", "margine percentuale" → execute_metric(gross_margin_percent)
- "margine medio per scontrino", "margine per ordine" → execute_metric(gross_margin_per_document)

REGOLA CRITICA - FILTRI FASCIA ORARIA (time_slot):
- "a pranzo", "pranzo" → filtra con time_slot = 'lunch' (oppure estrai ora 11:00-15:00 da order_date)
- "a cena", "cena" → filtra con time_slot = 'dinner' (oppure estrai ora 18:00-23:00 da order_date)
- "colazione" → filtra con time_slot = 'breakfast' (oppure estrai ora 06:00-11:00 da order_date)
- Se il dataset HA la colonna time_slot, USALA direttamente come filtro!
- Esempio: "revenue a cena" → execute_metric(revenue, filters: {time_slot: {operator: '=', value: 'dinner'}})

REGOLA CRITICA - CONTEGGIO RIGHE:
- "quante righe", "quanti record", "numero di righe" con condizione → execute_metric(order_count) con filters
- "quante righe con X negativo/positivo/maggiore/minore" → MAI usare filter_data!
- Esempio: "quante righe revenue negative?" → execute_metric(order_count, filters: [{column: revenue_amount, operator: <, value: 0}])
- filter_data mostra le righe, NON le conta. Per CONTARE usa sempre execute_metric o aggregate_group.

ATTENZIONE CRITICA - CONFUSIONE REVENUE/MARGINE:
- revenue = FATTURATO (quanto incassi)
- gross_margin = MARGINE LORDO € (fatturato MENO costi)
- NON sono la stessa cosa!
- Se dici "margine lordo di X €" il valore X DEVE venire da gross_margin, MAI da revenue
- Errore tipico: dire "margine lordo 21.956€" quando 21.956€ è il revenue. Il margine è ~14.267€


========================
STRUTTURA OUTPUT (3 LAYER)
========================

7) LAYER 1: DATA FACTS (OBBLIGATORIO)
- SOLO numeri provenienti da tool output
- SOLO etichette corrette (revenue ≠ margine)
- Esempio: "Revenue: 21.956,62€ | Gross Margin: 14.267,01€ | Gross Margin %: 64,98%"

8) LAYER 2: INTERPRETATION (LIMITATA)
Consentito:
- "Il margine è uniforme tra le categorie"
- "Food e Drink hanno marginalità simili"
- "Il food cost è sotto/sopra la media del dataset"

VIETATO:
- "Markup costante" (non verificabile)
- "Strategia d'élite" (giudizio soggettivo)
- "Psicologia del prezzo" (concetto esterno)
- Benchmark esterni (es. "gold standard 68-70%")
- "Best practice" o "standard di settore" senza dati

9) LAYER 3: STRATEGY (SOLO SU RICHIESTA ESPLICITA)
Attiva SOLO se l'utente chiede:
- "dammi consigli" / "cosa mi suggerisci" / "strategia"

VIETATO in default mode:
- "triangolo d'oro del menu"
- "leader di profitto"
- "piano d'attacco"
- Menu engineering non richiesto
- Upselling suggestions
- Azioni suggerite

Anche in strategy mode:
- NON generare nuovi numeri
- NO benchmark esterni non verificabili

========================
MAPPING SEMANTICO COLONNE (DINAMICO)
========================

10) INTERPRETAZIONE COLONNE - USA LO SCHEMA DEL DATASET

LEGGI SEMPRE le colonne fornite nel contesto del dataset.
Identifica le colonne per RUOLO SEMANTICO:

COLONNA PRODOTTO (per elenchi singoli articoli):
- Nomi tipici: item_name, product_name, nome_prodotto, dish_name, menu_item, article, articolo, piatto, prodotto
- Contiene: nomi specifici (Pizza Margherita, Birra Moretti, Tiramisù)

COLONNA CATEGORIA (per raggruppamenti macro):
- Nomi tipici: category, categoria, type, tipo, group, gruppo, department, reparto
- Contiene: macro-gruppi (Food, Drink, Dessert, Antipasti, Primi, Secondi)

REGOLA CRITICA - PATTERN UTENTE:

Quando l'utente chiede ELENCO/DETTAGLIO prodotti:
- "che pizze/piatti/prodotti/articoli abbiamo"
- "quali sono i/le..."
- "elenco dei/delle..."
- "mostrami tutti i..."
- "lista dei..."
→ USA la colonna PRODOTTO (non categoria!)
→ Aggiungi filtro categoria se specificato ("pizze" = Food, "drink" = Drink)

Quando l'utente chiede CONFRONTO macro:
- "confronto categorie"
- "Food vs Drink"
- "per categoria"
- "breakdown per tipo"
→ USA la colonna CATEGORIA

ESEMPI PRATICI (adatta ai nomi reali del dataset):
- "che pizze abbiamo" → groupBy: [colonna_prodotto], filters: {colonna_categoria: "Food"}
- "antipasti disponibili" → groupBy: [colonna_prodotto], filters: {colonna_categoria: "Antipasti"}
- "primi piatti" → groupBy: [colonna_prodotto], filters: {colonna_categoria: "Primi"}
- "cocktail" → groupBy: [colonna_prodotto], filters: {colonna_categoria: "Drink" o "Cocktail"}
- "birre" → groupBy: [colonna_prodotto], filters: {colonna_categoria: "Drink" o "Birre"}

ERRORE DA EVITARE:
- SBAGLIATO: "che pizze abbiamo" → groupBy: [category] → restituisce Food/Drink/Dessert
- CORRETTO: "che pizze abbiamo" → groupBy: [item_name] → restituisce Margherita, Diavola...

========================
GESTIONE INPUT CONVERSAZIONALI
========================

11) Se il messaggio è solo:
- grazie / ok / perfetto / capito / conferme simili

NON chiamare tool.
Rispondi brevemente: "Dimmi cosa vuoi analizzare."

========================
FOLLOW-UP E CONTESTO (CRITICO!)
========================

12) EREDITÀ DEL CONTESTO - REGOLA D'ORO

Quando l'utente fa una domanda di FOLLOW-UP che si riferisce a qualcosa menzionato PRIMA:
- "E la migliore?" → si riferisce all'argomento precedente (es: pizze, prodotti, categorie)
- "Quali vendono di più?" → mantieni i filtri della query precedente
- "Mostrami i dettagli" → drill-down sul gruppo precedente
- "E per categoria?" → cambia solo il groupBy, mantieni altri filtri

REGOLA: Se la conversazione precedente parlava di un SUBSET di dati (es: "pizze"), 
la domanda successiva DEVE mantenere quel filtro anche se non lo ripete!

ESEMPIO CRITICO:
- Utente: "Che pizze abbiamo?" → groupBy: item_name, filters: {category: "Food", item_name: ILIKE "%pizza%"}
- Utente: "E la migliore?" → MANTIENI i filtri! → groupBy: item_name, filters: {item_name: ILIKE "%pizza%"}, orderBy DESC

SBAGLIATO: "E la migliore?" → groupBy: item_name, filters: {} ← perde il contesto delle pizze!
CORRETTO: "E la migliore?" → groupBy: item_name, filters: {item_name: ILIKE "%pizza%"}, limit: 1, orderBy: revenue DESC

Pattern di follow-up da riconoscere:
- "E il/la [superlativo]?" → ranking con filtri precedenti
- "Quale è il migliore/peggiore?" → ranking con filtri precedenti
- "Mostrami per [dimensione]" → cambia groupBy, mantieni filtri
- "E se filtro per..." → modifica solo il filtro specificato

========================
ERROR HANDLING
========================

11) Se una metrica non è calcolabile:
- Spiega il motivo (colonna mancante, dati insufficienti)
- NON improvvisare risultati

========================
OBIETTIVO
========================

Il tuo obiettivo NON è sembrare creativo.
Il tuo obiettivo è essere:
- deterministico
- verificabile
- affidabile
`;

async function getDatasetSchema(datasetId: string): Promise<{ columns: string[]; columnTypes: Record<string, string> } | null> {
  try {
    const [dataset] = await db
      .select()
      .from(clientDataDatasets)
      .where(eq(clientDataDatasets.id, datasetId))
      .limit(1);

    if (!dataset || dataset.status !== "ready") {
      return null;
    }

    const columns = Object.keys(dataset.columnMapping);
    const columnTypes: Record<string, string> = {};
    for (const [name, info] of Object.entries(dataset.columnMapping)) {
      columnTypes[name] = (info as any).dataType || "TEXT";
    }

    return { columns, columnTypes };
  } catch (error) {
    console.error("[QUERY-PLANNER] Error fetching dataset schema:", error);
    return null;
  }
}

function validateToolCallAgainstSchema(
  toolCall: ToolCall,
  schema: { columns: string[]; columnTypes: Record<string, string> }
): ToolCallValidationResult {
  const errors: string[] = [];

  const basicValidation = validateToolCall(toolCall);
  if (!basicValidation.valid) {
    return { valid: false, errors: basicValidation.errors };
  }

  switch (toolCall.name) {
    case "query_metric": {
      const dsl = toolCall.args.dsl;
      if (!dsl || typeof dsl !== "string") {
        errors.push("DSL expression is required and must be a string");
        break;
      }
      
      // DEPRECATION WARNING: Check if a predefined metric could be used instead
      const dslLower = dsl.toLowerCase();
      const predefinedMetrics = ["revenue", "food_cost", "ticket_medio", "order_count", "quantity_total"];
      for (const metric of predefinedMetrics) {
        if (dslLower.includes(metric.replace("_", " ")) || 
            (metric === "revenue" && (dslLower.includes("sum") && dslLower.includes("net"))) ||
            (metric === "order_count" && dslLower.includes("count"))) {
          console.warn(`[QUERY-PLANNER] DEPRECATION: query_metric used for "${dsl}" but execute_metric with "${metric}" should be preferred`);
        }
      }
      
      try {
        const parsed = parseMetricExpression(dsl);
        const validation = validateMetricAgainstSchema(parsed, schema.columns);
        if (!validation.valid) {
          errors.push(...validation.errors);
        }
      } catch (parseError: any) {
        errors.push(`Invalid DSL syntax: ${parseError.message}`);
      }
      break;
    }

    case "execute_metric": {
      const metricName = toolCall.args.metricName;
      if (!metricName || !isValidMetricName(metricName)) {
        errors.push(`Metrica non valida: "${metricName}". Metriche disponibili: ${TOOL_METRIC_ENUM.join(", ")}`);
      }
      break;
    }

    case "compare_periods": {
      const dsl = toolCall.args.dsl;
      const dateColumn = toolCall.args.dateColumn;
      
      if (!dsl || typeof dsl !== "string") {
        errors.push("DSL expression is required");
      }
      if (!dateColumn || !schema.columns.includes(dateColumn)) {
        errors.push(`Invalid date column: ${dateColumn}. Available: ${schema.columns.slice(0, 5).join(", ")}...`);
      }
      if (dateColumn && schema.columnTypes[dateColumn]?.toUpperCase() !== "DATE") {
        errors.push(`Column ${dateColumn} is not a DATE type`);
      }

      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      for (const field of ["period1Start", "period1End", "period2Start", "period2End"]) {
        const value = toolCall.args[field];
        if (!value || !dateRegex.test(value)) {
          errors.push(`Invalid date format for ${field}: expected YYYY-MM-DD`);
        }
      }
      break;
    }

    case "filter_data": {
      const filters = toolCall.args.filters;
      if (filters && typeof filters === "object") {
        for (const column of Object.keys(filters)) {
          if (!schema.columns.includes(column)) {
            errors.push(`Invalid filter column: ${column}`);
          }
        }
      }
      const columns = toolCall.args.columns;
      if (columns && Array.isArray(columns)) {
        for (const col of columns) {
          if (!schema.columns.includes(col)) {
            errors.push(`Invalid select column: ${col}`);
          }
        }
      }
      break;
    }

    case "aggregate_group": {
      const groupBy = toolCall.args.groupBy;
      if (groupBy && Array.isArray(groupBy)) {
        for (const col of groupBy) {
          if (!schema.columns.includes(col)) {
            errors.push(`Invalid groupBy column: ${col}`);
          }
        }
      }
      const aggregations = toolCall.args.aggregations;
      if (aggregations && Array.isArray(aggregations)) {
        for (const agg of aggregations) {
          if (agg.column && agg.column !== "*" && !schema.columns.includes(agg.column)) {
            errors.push(`Invalid aggregation column: ${agg.column}`);
          }
        }
      }
      break;
    }

    case "get_schema":
      break;
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export async function planQuery(
  userQuestion: string,
  datasets: DatasetInfo[],
  consultantId?: string,
  conversationHistory?: ConversationMessage[],
  allowedTools?: string[]
): Promise<QueryPlan> {
  const providerResult = await getAIProvider(consultantId || "system", consultantId);
  const client = providerResult.client;
  const { model: modelName } = getModelWithThinking(providerResult.metadata?.name);

  // Build enriched dataset context with semantic mappings and available metrics
  const datasetsContextParts = await Promise.all(datasets.map(async (d) => {
    const cols = d.columns.map(c => `${c.name} (${c.dataType}): ${c.description || c.displayName}`).join("\n    ");
    const metrics = d.metrics?.map(m => `${m.name}: ${m.dslFormula}`).join("\n    ") || "Nessuna metrica pre-definita";
    
    // Get available metrics dynamically from semantic layer
    let availableMetricsInfo = "";
    let semanticMappingInfo = "";
    
    try {
      const datasetId = parseInt(d.id);
      if (!isNaN(datasetId)) {
        // Get available metrics
        const { available, unavailable } = await getAvailableMetricsForDataset(datasetId, METRIC_TEMPLATES);
        if (available.length > 0) {
          availableMetricsInfo = `\n  METRICHE CALCOLABILI (usa execute_metric):
    ${available.map(m => {
      const template = METRIC_TEMPLATES[m];
      return `${m}: ${template?.displayName || m}`;
    }).join("\n    ")}`;
        }
        if (unavailable.length > 0) {
          availableMetricsInfo += `\n  METRICHE NON DISPONIBILI (mancano colonne):
    ${unavailable.slice(0, 5).map(u => `${u.name}: manca ${u.missingColumns.join(", ")}`).join("\n    ")}`;
        }
        
        // Get semantic column mapping
        const mappings = await getColumnMappingsForDataset(datasetId);
        if (Object.keys(mappings).length > 0) {
          const mappingEntries = Object.entries(mappings)
            .filter(([logical, physical]) => physical) // Only show mapped columns
            .map(([logical, physical]) => `${logical} → "${physical}"`)
            .slice(0, 15); // Limit to avoid token overload
          semanticMappingInfo = `\n  MAPPING SEMANTICO (colonna logica → fisica):
    ${mappingEntries.join("\n    ")}`;
          
          // Add time_slot filter info if available
          if (mappings["time_slot"]) {
            semanticMappingInfo += `\n  FILTRI FASCIA ORARIA (time_slot):
    "a pranzo" / "pranzo" → filtra time_slot = 'lunch' o estrai ora 11:00-15:00
    "a cena" / "cena" → filtra time_slot = 'dinner' o estrai ora 18:00-23:00
    "colazione" → filtra time_slot = 'breakfast' o estrai ora 06:00-11:00`;
          }
        }
      }
    } catch (e) {
      console.warn(`[QUERY-PLANNER] Failed to enrich dataset context: ${e}`);
    }
    
    return `Dataset "${d.name}" (ID: ${d.id}, ${d.rowCount} righe):
  Colonne:
    ${cols}
  Metriche DSL:
    ${metrics}${availableMetricsInfo}${semanticMappingInfo}`;
  }));
  
  const datasetsContext = datasetsContextParts.join("\n\n");

  const conversationContext = conversationHistory && conversationHistory.length > 0
    ? `\n\n=== CONTESTO CONVERSAZIONE PRECEDENTE ===\n${conversationHistory.map(m => {
        let toolResultsInfo = "";
        // Include tool results for assistant messages (numerical data context)
        if (m.role === 'assistant' && (m as any).toolResults && (m as any).toolResults.length > 0) {
          const results = (m as any).toolResults as Array<{ tool: string; data: any }>;
          const resultsPreview = results
            .filter((r: any) => r.data)
            .map((r: any) => {
              const data = r.data;
              if (Array.isArray(data) && data.length > 0) {
                const preview = data.slice(0, 5).map((item: any) => JSON.stringify(item)).join(", ");
                return `${r.tool}: [${preview}${data.length > 5 ? `, ... (${data.length} total)` : ""}]`;
              } else if (typeof data === "object" && data !== null) {
                return `${r.tool}: ${JSON.stringify(data)}`;
              }
              return `${r.tool}: ${data}`;
            });
          if (resultsPreview.length > 0) {
            toolResultsInfo = `\n   [DATI RESTITUITI: ${resultsPreview.join("; ")}]`;
          }
        }
        return `${m.role === 'user' ? 'UTENTE' : 'ASSISTENTE'}: ${m.content}${toolResultsInfo}`;
      }).join('\n')}\n=== FINE CONTESTO ===\n\n⚠️ REGOLA CRITICA CONTESTO: Se la domanda precedente parlava di un SUBSET (es: "pizze", "drink", "Food"), e la domanda attuale è un follow-up (es: "E la migliore?", "Quale vende di più?"), DEVI mantenere gli stessi filtri della query precedente!`
    : '';

  console.log(`[QUERY-PLANNER] Conversation context for planner: ${conversationHistory?.length || 0} messages`);

  // Filter available tools based on policy
  const availableToolsForAI = allowedTools && allowedTools.length > 0
    ? dataAnalysisTools.filter(tool => allowedTools.includes(tool.name))
    : dataAnalysisTools;
  
  const toolConstraint = allowedTools && allowedTools.length > 0
    ? `\n\n⚠️ TOOL CONSENTITI: Puoi usare SOLO questi tool: [${allowedTools.join(', ')}]. NON usare altri tool.`
    : '';

  console.log(`[QUERY-PLANNER] Allowed tools for AI: [${availableToolsForAI.map(t => t.name).join(', ')}]`);

  const userPrompt = `Dataset disponibili:
${datasetsContext}
${conversationContext}
${toolConstraint}

Domanda dell'utente: "${userQuestion}"

Quali tool devo usare per rispondere? Se servono più step, elencali in ordine.`;

  // NOTE: Intent classification is now handled by Router Agent in askDataset()
  // The legacy classifyIntent() is deprecated - Router Agent is the single source of truth
  console.log(`[QUERY-PLANNER] Using Router Agent classification (legacy classifier disabled)`);

  try {
    const response = await executeWithRetry(
      () => client.generateContent({
        model: modelName,
        systemInstruction: {
          role: "system",
          parts: [{ text: SYSTEM_PROMPT_IT }]
        },
        contents: [
          { role: "user", parts: [{ text: userPrompt }] }
        ],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 2048,
        },
        tools: [{
          functionDeclarations: availableToolsForAI
        }],
        toolConfig: {
          functionCallingConfig: {
            mode: "ANY"
          }
        }
      }),
      "QUERY-PLANNER"
    );

    const responseText = response.response.text();
    const steps: ToolCall[] = [];

    const candidates = (response.response as any).candidates;
    if (candidates && candidates[0]?.content?.parts) {
      for (const part of candidates[0].content.parts) {
        if (part.functionCall) {
          steps.push({
            name: part.functionCall.name,
            args: part.functionCall.args || {}
          });
        }
      }
    }

    // NOTE: Force retry logic is now handled by Policy Engine in askDataset()
    // If Router Agent classifies as "analytics" but no tools are called, 
    // the Policy Engine will handle this case
    if (steps.length === 0) {
      console.log("[QUERY-PLANNER] No tools planned - Policy Engine will handle this");
    }

    const complexity = steps.length <= 1 ? "simple" : steps.length <= 3 ? "medium" : "complex";

    return {
      steps,
      reasoning: responseText || "Piano generato automaticamente",
      estimatedComplexity: complexity
    };
  } catch (error: any) {
    console.error("[QUERY-PLANNER] Error planning query:", error.message);

    if (datasets.length > 0) {
      const numericCols = datasets[0].columns.filter(c => {
        const t = c.dataType?.toUpperCase();
        return t === "NUMERIC" || t === "INTEGER" || t === "NUMBER";
      });
      if (numericCols.length > 0) {
        return {
          steps: [{
            name: "filter_data",
            args: { datasetId: String(datasets[0].id), filters: {}, limit: 50 }
          }],
          reasoning: "Fallback: mostra campione di dati",
          estimatedComplexity: "simple"
        };
      }
    }

    return {
      steps: [],
      reasoning: `Errore nella pianificazione: ${error.message}`,
      estimatedComplexity: "simple"
    };
  }
}

async function retryPlanWithFeedback(
  userQuestion: string,
  datasets: DatasetInfo[],
  validationErrors: string[],
  consultantId?: string,
  attempt: number = 1
): Promise<QueryPlan | null> {
  if (attempt > MAX_PLANNING_RETRIES) {
    console.error(`[QUERY-PLANNER] Max retries (${MAX_PLANNING_RETRIES}) exceeded`);
    return null;
  }

  const providerResult = await getAIProvider(consultantId || "system", consultantId);
  const client = providerResult.client;
  const { model: modelName } = getModelWithThinking(providerResult.metadata?.name);

  const datasetsContext = datasets.map(d => {
    const cols = d.columns.map(c => `${c.name} (${c.dataType}): ${c.description || c.displayName}`).join("\n    ");
    return `Dataset "${d.name}" (ID: ${d.id}):
  Colonne disponibili:
    ${cols}`;
  }).join("\n\n");

  const errorFeedback = validationErrors.join("\n- ");

  const retryPrompt = `La tua risposta precedente conteneva errori di validazione:
- ${errorFeedback}

Dataset disponibili:
${datasetsContext}

Domanda originale: "${userQuestion}"

Per favore correggi gli errori e genera nuove chiamate ai tool valide. Usa SOLO colonne che esistono nel dataset.`;

  console.log(`[QUERY-PLANNER] Retry attempt ${attempt} with feedback`);

  try {
    const response = await executeWithRetry(
      () => client.generateContent({
        model: modelName,
        contents: [
          { role: "user", parts: [{ text: retryPrompt }] }
        ],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 2048,
        },
        tools: [{
          functionDeclarations: dataAnalysisTools
        }]
      }),
      "QUERY-PLANNER-RETRY"
    );

    const steps: ToolCall[] = [];
    const candidates = (response.response as any).candidates;
    if (candidates && candidates[0]?.content?.parts) {
      for (const part of candidates[0].content.parts) {
        if (part.functionCall) {
          steps.push({
            name: part.functionCall.name,
            args: part.functionCall.args || {}
          });
        }
      }
    }

    if (steps.length === 0) {
      return null;
    }

    return {
      steps,
      reasoning: `Piano corretto dopo retry ${attempt}`,
      estimatedComplexity: steps.length <= 1 ? "simple" : steps.length <= 3 ? "medium" : "complex"
    };
  } catch (error: any) {
    console.error(`[QUERY-PLANNER] Retry ${attempt} failed:`, error.message);
    return null;
  }
}

export async function executeToolCall(
  toolCall: ToolCall,
  userId?: string,
  userQuestion?: string
): Promise<ExecutedToolResult> {
  const startTime = Date.now();

  const validation = validateToolCall(toolCall);
  if (!validation.valid) {
    return {
      toolName: toolCall.name,
      args: toolCall.args,
      result: null,
      success: false,
      error: validation.errors.join("; "),
      executionTimeMs: Date.now() - startTime
    };
  }

  try {
    let result: QueryResult;

    switch (toolCall.name) {
      case "query_metric":
        result = await queryMetric(toolCall.args.datasetId, toolCall.args.dsl, { userId });
        break;

      case "execute_metric": {
        console.log(`[EXECUTE-METRIC] Called with metricName: "${toolCall.args.metricName}", datasetId: ${toolCall.args.datasetId}`);
        
        // Log which column is being used for revenue calculations
        await logRevenueColumnUsage(
          parseInt(toolCall.args.datasetId, 10),
          toolCall.args.metricName
        );
        
        // Step 1: Pre-validate that required columns exist for this metric
        const preValidation = await validateMetricForDataset(toolCall.args.metricName, toolCall.args.datasetId);
        if (!preValidation.valid) {
          const businessError = preValidation.error || `Metrica "${toolCall.args.metricName}" non disponibile per questo dataset.`;
          console.error(`[EXECUTE-METRIC] Pre-validation failed: ${businessError}`);
          return {
            toolName: toolCall.name,
            args: toolCall.args,
            result: null,
            success: false,
            error: businessError,
            executionTimeMs: Date.now() - startTime
          };
        }
        
        // Step 2: Resolve template SQL with dataset-specific column mappings
        const resolveResult = await resolveMetricSQLForDataset(toolCall.args.metricName, toolCall.args.datasetId);
        if (!resolveResult.valid) {
          console.error(`[EXECUTE-METRIC] Could not resolve SQL for metric: "${toolCall.args.metricName}", error: ${resolveResult.error}`);
          return {
            toolName: toolCall.name,
            args: toolCall.args,
            result: null,
            success: false,
            error: resolveResult.error || `Metrica non trovata: ${toolCall.args.metricName}`,
            executionTimeMs: Date.now() - startTime
          };
        }
        console.log(`[EXECUTE-METRIC] Resolved SQL: ${resolveResult.sql}`);
        
        // Step 2.5: Apply query engine rules (document_type filter, ORDER BY, etc.)
        // Pass enhancements separately to executeMetricSQL instead of modifying the SQL expression
        let queryEnhancements: { whereClause?: string; orderByClause?: string } | undefined;
        if (userQuestion) {
          try {
            const datasetIdNum = parseInt(toolCall.args.datasetId, 10);
            const enhancement = await applyQueryEnhancements(
              datasetIdNum,
              toolCall.args.metricName,
              userQuestion,
              toolCall.args.filters
            );
            if (enhancement.appliedRules.length > 0) {
              queryEnhancements = {
                whereClause: enhancement.additionalWhereClause,
                orderByClause: enhancement.orderByClause
              };
              console.log(`[EXECUTE-METRIC] Query rules applied: ${enhancement.appliedRules.join(", ")}`);
              console.log(`[EXECUTE-METRIC] Enhancements: WHERE=${enhancement.additionalWhereClause || 'none'}, ORDER BY=${enhancement.orderByClause || 'none'}`);
            }
          } catch (ruleError) {
            console.warn(`[EXECUTE-METRIC] Query rule enhancement failed (using original SQL):`, ruleError);
          }
        }
        
        // Step 3: Execute the resolved SQL with optional WHERE/ORDER BY enhancements
        result = await executeMetricSQL(
          toolCall.args.datasetId, 
          resolveResult.sql, 
          toolCall.args.metricName,
          { userId, timeoutMs: 3000 },
          queryEnhancements
        );
        console.log(`[EXECUTE-METRIC] Result: success=${result.success}, error=${result.error || 'none'}`);
        break;
      }

      case "compare_periods":
        result = await comparePeriods(
          toolCall.args.datasetId,
          toolCall.args.dsl,
          toolCall.args.dateColumn,
          { start: toolCall.args.period1Start, end: toolCall.args.period1End },
          { start: toolCall.args.period2Start, end: toolCall.args.period2End },
          { userId }
        );
        break;

      case "filter_data":
        result = await filterData(
          toolCall.args.datasetId,
          toolCall.args.filters,
          toolCall.args.columns,
          toolCall.args.limit || 100,
          0,
          { userId }
        );
        break;

      case "aggregate_group": {
        // DETAILED LOGGING - show exactly what Gemini passed
        console.log(`[AGGREGATE-GROUP] Full args from Gemini:`, JSON.stringify(toolCall.args, null, 2));
        console.log(`[AGGREGATE-GROUP] datasetId: ${toolCall.args.datasetId}`);
        console.log(`[AGGREGATE-GROUP] groupBy: ${JSON.stringify(toolCall.args.groupBy)}`);
        console.log(`[AGGREGATE-GROUP] metricName: ${toolCall.args.metricName}`);
        console.log(`[AGGREGATE-GROUP] aggregations: ${JSON.stringify(toolCall.args.aggregations)}`);
        console.log(`[AGGREGATE-GROUP] orderBy: ${JSON.stringify(toolCall.args.orderBy)}`);
        console.log(`[AGGREGATE-GROUP] filters: ${JSON.stringify(toolCall.args.filters)}`);
        
        // TASK 1: Cardinality check BEFORE executing aggregate_group
        // AUTO-FALLBACK: If too many distinct values, automatically apply Top-10 instead of blocking
        const groupByColumns = toolCall.args.groupBy || [];
        let fallbackApplied = false;
        let originalDistinctCount = 0;
        
        if (groupByColumns.length > 0) {
          console.log(`[WIRING-CHECK] checkCardinalityBeforeAggregate called for columns: ${JSON.stringify(groupByColumns)}`);
          const cardinalityCheck = await checkCardinalityBeforeAggregate(
            toolCall.args.datasetId,
            groupByColumns,
            toolCall.args.filters
          );
          
          if (cardinalityCheck.needsConfirmation) {
            // AUTO-FALLBACK: Apply Top-10 with ORDER BY DESC instead of blocking
            console.log(`[AGGREGATE-GROUP] HIGH CARDINALITY DETECTED: ${cardinalityCheck.distinctCount} values - applying AUTO Top-10 fallback`);
            fallbackApplied = true;
            originalDistinctCount = cardinalityCheck.distinctCount;
            
            // Force limit to 10
            toolCall.args.limit = 10;
            
            // Force orderBy DESC on the metric (will be applied after metric resolution)
            // We'll set a flag and apply it after we know the metric alias
            toolCall.args._autoFallbackOrderDesc = true;
            
            console.log(`[AGGREGATE-GROUP] AUTO-FALLBACK applied: limit=10, orderBy=DESC`);
          }
        }
        
        // Convert metricName to aggregations if provided
        let aggregations = toolCall.args.aggregations;
        let useRawSqlExpression: string | null = null;
        
        // FIX 3: Resolve metricName even when aggregations exist (for orderBy usage)
        // If metricName is provided AND it's used for orderBy, we need to resolve it as additional column
        const metricUsedForOrderBy = toolCall.args.metricName && 
          toolCall.args.orderBy?.column === toolCall.args.metricName;
        
        if (toolCall.args.metricName && (!aggregations || metricUsedForOrderBy)) {
          // Step 1: Pre-validate that required columns exist for this metric
          const preValidation = await validateMetricForDataset(toolCall.args.metricName, toolCall.args.datasetId);
          if (!preValidation.valid) {
            const businessError = preValidation.error || `Metrica "${toolCall.args.metricName}" non disponibile per questo dataset.`;
            console.error(`[AGGREGATE-GROUP] Pre-validation failed: ${businessError}`);
            result = { success: false, error: businessError };
            break;
          }
          
          // Step 2: Resolve template SQL with dataset-specific column mappings
          const resolveResult = await resolveMetricSQLForDataset(toolCall.args.metricName, toolCall.args.datasetId);
          if (resolveResult.valid) {
            useRawSqlExpression = resolveResult.sql;
            console.log(`[AGGREGATE-GROUP] Using resolved SQL expression for "${toolCall.args.metricName}": ${useRawSqlExpression}`);
            if (metricUsedForOrderBy && aggregations) {
              console.log(`[AGGREGATE-GROUP] FIX 3: Metric "${toolCall.args.metricName}" resolved for orderBy alongside existing aggregations`);
            }
          } else {
            // STRICT: No fallback - return error if metric cannot be resolved
            const errorMsg = resolveResult.error || `Metrica "${toolCall.args.metricName}" non risolvibile per questo dataset.`;
            console.error(`[AGGREGATE-GROUP] ${errorMsg}`);
            result = { success: false, error: errorMsg };
            break;
          }
        }
        
        // Sanitize orderBy - skip if column is undefined/null
        let sanitizedOrderBy = toolCall.args.orderBy;
        if (sanitizedOrderBy && (!sanitizedOrderBy.column || sanitizedOrderBy.column === "undefined")) {
          console.log(`[AGGREGATE-GROUP] Skipping invalid orderBy (column is undefined)`);
          sanitizedOrderBy = undefined;
        }
        
        // AUTO-FALLBACK: Apply ORDER BY DESC on the metric when fallback is active
        if (toolCall.args._autoFallbackOrderDesc && toolCall.args.metricName) {
          sanitizedOrderBy = {
            column: toolCall.args.metricName,
            direction: "DESC" as const
          };
          console.log(`[AGGREGATE-GROUP] AUTO-FALLBACK orderBy applied: ${toolCall.args.metricName} DESC`);
        }
        
        if (!aggregations && !useRawSqlExpression) {
          result = { success: false, error: "Either aggregations or metricName is required" };
        } else {
          // Log time granularity if specified
          if (toolCall.args.timeGranularity) {
            console.log(`[AGGREGATE-GROUP] Time granularity: ${toolCall.args.timeGranularity}, dateColumn: ${toolCall.args.dateColumn}`);
          }
          
          // TASK: Generate is_sellable filter for ALL SALES ANALYTICS
          // Auto-filter out notes/modifiers for revenue/quantity/product queries
          let isSellableConfig: IsSellableConfig | undefined;
          const groupBy = toolCall.args.groupBy || [];
          
          // Check if this is a SALES metric based on:
          // 1. metricName contains sales-related terms
          // 2. OR uses SQL expression with revenue/quantity patterns
          const salesMetrics = ['revenue', 'quantity', 'quantity_total', 'revenue_net', 'revenue_gross', 'avg_unit_price', 'ticket_medio'];
          const metricName = toolCall.args.metricName?.toLowerCase() || '';
          const isSalesMetricByName = salesMetrics.some(sm => metricName.includes(sm));
          
          // Also check if the resolved SQL uses revenue_amount or quantity logical roles
          const sqlExpression = useRawSqlExpression?.toLowerCase() || '';
          const isSalesMetricBySQL = sqlExpression.includes('sum') || sqlExpression.includes('avg') || sqlExpression.includes('count');
          
          const isSalesQuery = isSalesMetricByName || isSalesMetricBySQL;
          
          // Get dataset to check semantic mappings
          const dataset = await db.select().from(clientDataDatasets)
            .where(eq(clientDataDatasets.id, toolCall.args.datasetId))
            .limit(1);
          
          if (dataset.length > 0) {
            // Read semantic mappings from the dedicated table (not from dataset record)
            const semanticMappingsRows = await db.select()
              .from(datasetColumnMappings)
              .where(eq(datasetColumnMappings.datasetId, parseInt(toolCall.args.datasetId)));
            
            // Convert to format { physical_column: logical_role }
            const mappings: Record<string, string> = {};
            for (const row of semanticMappingsRows) {
              mappings[row.physicalColumn] = row.logicalColumn;
            }
            console.log(`[AGGREGATE-GROUP] Loaded ${semanticMappingsRows.length} semantic mappings from database`);
            
            // Get dataset columns from column_mapping keys (column_mapping has physical column names as keys)
            const columnMapping = (dataset[0].columnMapping || {}) as Record<string, any>;
            const datasetColumns = Object.keys(columnMapping);
            
            // ====== RESOLVE SEMANTIC CATEGORY FILTER ======
            // If _semanticCategoryFilter is set, resolve to physical column
            // FIX 2: HARD OVERRIDE - remove any conflicting category filters before applying semantic one
            // DESIGN: We apply categoryValue to the 'category' logical role ONLY
            // because category values like "Pizza" are category-level, not subcategory-level
            if (toolCall.args._semanticCategoryFilter) {
              const { value } = toolCall.args._semanticCategoryFilter;
              const categoryTerm = toolCall.args._detectedCategoryTerm || toolCall.args._rankingCategoryFilter;
              
              // First try: Find 'category' column (the logical role matching our category values)
              const categoryPhysical = Object.entries(mappings)
                .find(([_, logical]) => logical === 'category')?.[0];
              
              if (categoryPhysical && datasetColumns.includes(categoryPhysical)) {
                if (!toolCall.args.filters) toolCall.args.filters = {};
                
                // FIX 2: HARD OVERRIDE - Remove any existing filter on this column with different value
                const existingFilter = toolCall.args.filters[categoryPhysical];
                if (existingFilter && existingFilter.value !== value) {
                  console.log(`[SEMANTIC-FILTER] HARD OVERRIDE: Removing existing filter ${categoryPhysical}='${existingFilter.value}' → '${value}'`);
                }
                
                // Also remove filters on common category column names that might conflict
                const categoryColumnNames = ['category', 'categoria', 'type', 'tipo', 'group', 'gruppo'];
                for (const colName of categoryColumnNames) {
                  if (colName !== categoryPhysical && toolCall.args.filters[colName]) {
                    console.log(`[SEMANTIC-FILTER] HARD OVERRIDE: Removing conflicting filter on "${colName}"`);
                    delete toolCall.args.filters[colName];
                  }
                }
                
                toolCall.args.filters[categoryPhysical] = { operator: '=', value: value };
                console.log(`[SEMANTIC-FILTER] RESOLVED: category → "${categoryPhysical}" = '${value}'`);
              } else {
                // Second try: Look for subcategory (might have same values)
                const subcategoryPhysical = Object.entries(mappings)
                  .find(([_, logical]) => logical === 'subcategory')?.[0];
                
                if (subcategoryPhysical && datasetColumns.includes(subcategoryPhysical)) {
                  if (!toolCall.args.filters) toolCall.args.filters = {};
                  
                  // FIX 2: Also apply hard override for subcategory
                  const existingFilter = toolCall.args.filters[subcategoryPhysical];
                  if (existingFilter && existingFilter.value !== value) {
                    console.log(`[SEMANTIC-FILTER] HARD OVERRIDE: Removing existing filter ${subcategoryPhysical}='${existingFilter.value}' → '${value}'`);
                  }
                  
                  toolCall.args.filters[subcategoryPhysical] = { operator: '=', value: value };
                  console.log(`[SEMANTIC-FILTER] RESOLVED via subcategory: "${subcategoryPhysical}" = '${value}'`);
                } else {
                  // LAST FALLBACK: No category/subcategory column, use ILIKE on product names
                  const categoryDef = CATEGORY_TERMS[categoryTerm?.toLowerCase()];
                  if (categoryDef?.productIlike?.length > 0 && !toolCall.args.productIlikePatterns) {
                    toolCall.args.productIlikePatterns = categoryDef.productIlike;
                    console.log(`[SEMANTIC-FILTER] FALLBACK ILIKE: No category column, using ${categoryDef.productIlike.length} patterns`);
                  } else {
                    console.warn(`[SEMANTIC-FILTER] No category column mapped and no ILIKE patterns for "${categoryTerm}"`);
                  }
                }
              }
            }
            
            // PRIORITY 1: Check if dataset has explicit is_sellable column
            const isSellablePhysical = Object.entries(mappings)
              .find(([_, logical]) => logical === 'is_sellable')?.[0];
            
            if (isSellablePhysical && datasetColumns.includes(isSellablePhysical)) {
              // Use dedicated is_sellable column - add as structured filter
              // This will be handled by the standard filter system
              if (!toolCall.args.filters) toolCall.args.filters = {};
              toolCall.args.filters[isSellablePhysical] = { operator: '=', value: 1 };
              console.log(`[AGGREGATE-GROUP] Using dedicated is_sellable column: ${isSellablePhysical}`);
            } else {
              // PRIORITY 2: Use heuristic filter for product-level queries or sales metrics
              const productNamePhysical = Object.entries(mappings)
                .find(([_, logical]) => logical === 'product_name')?.[0];
              
              // Check if groupBy contains product column or if this is a sales query
              let hasProductGroupBy = productNamePhysical && groupBy.includes(productNamePhysical);
              let productCol = productNamePhysical;
              
              // Fallback pattern matching for product detection
              if (!hasProductGroupBy && !productCol) {
                const productPatterns = ['product_name', 'descrprod', 'descr_prod', 'prodotto', 'articolo', 'nome_prodotto'];
                productCol = groupBy.find((col: string) => 
                  productPatterns.some(pc => col.toLowerCase().includes(pc.toLowerCase()))
                );
                hasProductGroupBy = !!productCol;
              }
              
              // Apply filter if: product groupBy OR sales metric
              const shouldApplyFilter = hasProductGroupBy || isSalesQuery;
              
              if (shouldApplyFilter) {
                if (productCol && datasetColumns.includes(productCol)) {
                  console.log(`[AGGREGATE-GROUP] Sales analytics detected - generating is_sellable filter`);
                  console.log(`[AGGREGATE-GROUP] Reason: ${hasProductGroupBy ? 'product groupBy' : 'sales metric'}`);
                  
                  // Find revenue column for more robust filtering
                  const revenueCol = Object.entries(mappings)
                    .find(([_, logical]) => logical === 'revenue_amount')?.[0];
                  
                  // STRUCTURED CONFIG: Pass to aggregateGroup for internal validation
                  isSellableConfig = {
                    productNameColumn: productCol,
                    revenueColumn: revenueCol
                  };
                  console.log(`[AGGREGATE-GROUP] is_sellable config: productCol=${productCol}, revenueCol=${revenueCol || 'none'}`);
                } else if (hasProductGroupBy) {
                  // FAIL CLOSED: Product groupBy detected but no valid product_name column
                  console.error(`[AGGREGATE-GROUP] FAIL CLOSED: Product groupBy detected but product_name column not mapped`);
                  result = { 
                    success: false, 
                    error: "Dataset non configurato per analisi prodotti. Configura il mapping per 'product_name' nelle impostazioni del dataset." 
                  };
                  break;
                }
                // Note: If only isSalesQuery but no product column, we proceed without is_sellable filter
                // This allows general sales metrics (e.g., total revenue) without product breakdown
              }
            }
          }
          
          // BUILD productIlikeConfig from injected patterns (for category ranking like "Top 5 pizze")
          let productIlikeConfig: ProductIlikeConfig | undefined;
          if (toolCall.args.productIlikePatterns && toolCall.args.productIlikePatterns.length > 0) {
            const productColumn = toolCall.args.groupBy?.[0];
            if (productColumn) {
              productIlikeConfig = {
                productNameColumn: productColumn,
                patterns: toolCall.args.productIlikePatterns
              };
              console.log(`[AGGREGATE-GROUP] productIlikeConfig built: ${toolCall.args.productIlikePatterns.length} patterns on column "${productColumn}"`);
            }
          }
          
          result = await aggregateGroup(
            toolCall.args.datasetId,
            toolCall.args.groupBy,
            aggregations || [],  // Pass empty array when using raw SQL
            toolCall.args.filters,
            sanitizedOrderBy,
            toolCall.args.limit || 100,
            { userId },
            toolCall.args.timeGranularity,
            toolCall.args.dateColumn,
            useRawSqlExpression ? { sql: useRawSqlExpression, alias: toolCall.args.metricName } : undefined,
            isSellableConfig,  // Structured is_sellable config (validated internally)
            productIlikeConfig  // ILIKE patterns for category ranking (e.g., "Top 5 pizze")
          );
          console.log(`[AGGREGATE-GROUP] Result: success=${result.success}, rowCount=${result.rowCount}, error=${result.error || 'none'}`);
          
          // Add fallback metadata to result for UX communication
          if (fallbackApplied && result.success) {
            result._fallbackApplied = true;
            result._originalDistinctCount = originalDistinctCount;
            result._fallbackLimit = 10;
            console.log(`[AGGREGATE-GROUP] Fallback metadata added: originalCount=${originalDistinctCount}, limit=10`);
          }
        }
        break;
      }

      case "get_schema":
        result = await getSchema(toolCall.args.datasetId);
        break;

      default:
        return {
          toolName: toolCall.name,
          args: toolCall.args,
          result: null,
          success: false,
          error: `Tool non supportato: ${toolCall.name}`,
          executionTimeMs: Date.now() - startTime
        };
    }

    // Include fallback metadata in the result for UX communication
    const executedResult: ExecutedToolResult = {
      toolName: toolCall.name,
      args: toolCall.args,
      result: result.success ? (result.data || result.metrics) : null,
      success: result.success,
      error: result.error,
      executionTimeMs: Date.now() - startTime
    };
    
    // Propagate fallback metadata if present
    if (result._fallbackApplied) {
      executedResult._fallbackApplied = true;
      executedResult._originalDistinctCount = result._originalDistinctCount;
      executedResult._fallbackLimit = result._fallbackLimit;
    }
    
    return executedResult;
  } catch (error: any) {
    return {
      toolName: toolCall.name,
      args: toolCall.args,
      result: null,
      success: false,
      error: error.message,
      executionTimeMs: Date.now() - startTime
    };
  }
}

export async function executePlan(
  plan: QueryPlan,
  userId?: string,
  userQuestion?: string
): Promise<QueryExecutionResult> {
  const startTime = Date.now();
  const results: ExecutedToolResult[] = [];
  let allSuccess = true;

  for (const step of plan.steps) {
    const result = await executeToolCall(step, userId, userQuestion);
    results.push(result);

    if (!result.success) {
      allSuccess = false;
      console.warn(`[QUERY-PLANNER] Tool ${step.name} failed:`, result.error);
    }
  }

  return {
    plan,
    results,
    success: allSuccess,
    totalExecutionTimeMs: Date.now() - startTime
  };
}

export async function executePlanWithValidation(
  plan: QueryPlan,
  datasets: DatasetInfo[],
  consultantId?: string,
  userId?: string,
  userQuestion?: string
): Promise<QueryExecutionResult> {
  const startTime = Date.now();
  const results: ExecutedToolResult[] = [];
  let allSuccess = true;
  let currentPlan = plan;

  const datasetsMap = new Map(datasets.map(d => [d.id, d]));

  for (let i = 0; i < currentPlan.steps.length; i++) {
    const step = currentPlan.steps[i];
    const datasetId = step.args.datasetId;

    if (datasetId && step.name !== "get_schema") {
      const schema = await getDatasetSchema(datasetId);
      if (schema) {
        const validation = validateToolCallAgainstSchema(step, schema);
        if (!validation.valid) {
          console.warn(`[QUERY-PLANNER] Tool call validation failed:`, validation.errors);

          const retryPlan = await retryPlanWithFeedback(
            userQuestion || currentPlan.reasoning,
            datasets,
            validation.errors,
            consultantId,
            1
          );

          if (retryPlan) {
            currentPlan = retryPlan;
            i = -1;
            results.length = 0;
            allSuccess = true;
            continue;
          } else {
            results.push({
              toolName: step.name,
              args: step.args,
              result: null,
              success: false,
              error: `Validation failed: ${validation.errors.join("; ")}`,
              executionTimeMs: 0
            });
            allSuccess = false;
            continue;
          }
        }
      }
    }

    const result = await executeToolCall(step, userId, userQuestion);
    results.push(result);

    if (!result.success) {
      allSuccess = false;
      console.warn(`[QUERY-PLANNER] Tool ${step.name} failed:`, result.error);
    }
  }

  return {
    plan: currentPlan,
    results,
    success: allSuccess,
    totalExecutionTimeMs: Date.now() - startTime
  };
}

/**
 * Extract category context from conversation history
 * If user previously asked about "pizze", "bevande", etc. and now asks a follow-up,
 * we should maintain that filter context
 */
function extractCategoryContextFromHistory(
  conversationHistory: ConversationMessage[] | undefined
): { categoryTerm: string | null; fromMessageIndex: number } {
  if (!conversationHistory || conversationHistory.length === 0) {
    return { categoryTerm: null, fromMessageIndex: -1 };
  }
  
  // Look at recent user messages for category terms
  const categoryTermsToCheck = Object.keys(CATEGORY_TERMS);
  
  for (let i = conversationHistory.length - 1; i >= 0; i--) {
    const msg = conversationHistory[i];
    if (msg.role === 'user') {
      const msgLower = msg.content.toLowerCase();
      for (const term of categoryTermsToCheck) {
        if (msgLower.includes(term)) {
          console.log(`[CONTEXT-MEMORY] Found category "${term}" in conversation history at index ${i}`);
          return { categoryTerm: term, fromMessageIndex: i };
        }
      }
    }
  }
  
  return { categoryTerm: null, fromMessageIndex: -1 };
}

/**
 * Detect if current question is a follow-up that should inherit context
 * E.g., "mi elenchi tutte le tipologie" after "quante pizze ho venduto"
 */
const FOLLOWUP_PATTERNS = [
  /^(mi\s+)?elenc[aoi]/i,           // "mi elenchi", "elenca"
  /^(mi\s+)?mostr[aoi]/i,           // "mi mostri", "mostra"
  /^quali\s+sono/i,                 // "quali sono"
  /^dimmi/i,                        // "dimmi"
  /^e\s+(le|i|la|il|quali|quanti)/i, // "e le...", "e quali..."
  /^intendevo/i,                    // "intendevo..."
  /^volevo\s+(dire|sapere)/i,       // "volevo dire", "volevo sapere"
  /^(solo\s+)?(le|i|la|il)\s+\w+$/i, // "le tipologie", "i prodotti"
];

function isFollowUpQuery(question: string): boolean {
  const questionTrimmed = question.trim();
  return FOLLOWUP_PATTERNS.some(pattern => pattern.test(questionTrimmed));
}

export async function askDataset(
  userQuestion: string,
  datasets: DatasetInfo[],
  consultantId?: string,
  userId?: string,
  conversationHistory?: ConversationMessage[]
): Promise<QueryExecutionResult> {
  console.log(`[QUERY-PLANNER] Processing question: "${userQuestion}" for ${datasets.length} datasets`);
  console.log(`[QUERY-PLANNER] Conversation history: ${conversationHistory?.length || 0} messages`);
  const startTime = Date.now();
  
  // ====== CONTEXT MEMORY: Extract category filter from conversation history ======
  const isFollowUp = isFollowUpQuery(userQuestion);
  const contextCategory = extractCategoryContextFromHistory(conversationHistory);
  
  if (isFollowUp && contextCategory.categoryTerm) {
    console.log(`[CONTEXT-MEMORY] Follow-up detected! Inheriting category filter: "${contextCategory.categoryTerm}"`);
  }

  // ====== TASK 2: SEMANTIC CONTRACT DETECTION ======
  // Detect if user requests "ALL items" vs "top N"
  const semanticContract = detectSemanticContract(userQuestion);
  console.log(`[WIRING-CHECK] semantic contract detected - requestsAll=${semanticContract.requestsAll}, requestsTopN=${semanticContract.requestsTopN}, keywords=[${semanticContract.detectedKeywords.join(",")}]`);

  // TASK 3: Extract mentioned filters from user question  
  const availableColumns = datasets.length > 0 
    ? datasets[0].columns.map(c => c.name) 
    : [];
  const extractedFilters = extractFiltersFromQuestion(userQuestion, availableColumns);
  console.log(`[WIRING-CHECK] extractFiltersFromQuestion called - found ${Object.keys(extractedFilters).length} filters: ${JSON.stringify(extractedFilters)}`);

  // ====== TASK 5: GROUPBY INTENT DETECTION ======
  // Detect if user is asking for product listing vs category comparison
  const groupByIntent = detectGroupByIntent(userQuestion, availableColumns);
  console.log(`[WIRING-CHECK] groupByIntent - isProductListing=${groupByIntent.isProductListing}, productColumn=${groupByIntent.productColumn}`);

  // ====== LAYER 1: INTENT ROUTER (AI - gemini-2.5-flash-lite) ======
  // Fast, cheap classification of user intent WITH conversation context
  const routerOutput = await routeIntent(userQuestion, consultantId, conversationHistory);
  console.log(`[QUERY-PLANNER] Router result: intent=${routerOutput.intent}, requires_metrics=${routerOutput.requires_metrics}, confidence=${routerOutput.confidence.toFixed(2)}`);

  // ====== LAYER 2: POLICY ENGINE (TypeScript - no AI) ======
  // Gate keeper for tool access based on intent
  const policy = getPolicyForIntent(routerOutput.intent);
  console.log(`[QUERY-PLANNER] Policy: allowedTools=[${policy.allowedTools.join(',')}], requireToolCall=${policy.requireToolCall}`);

  // CONVERSATIONAL: Return fixed response without ANY tool calls
  if (routerOutput.intent === "conversational") {
    const friendlyReply = getConversationalReply(userQuestion);
    console.log(`[QUERY-PLANNER] CONVERSATIONAL - returning friendly response: "${friendlyReply.substring(0, 50)}..."`);
    return {
      plan: {
        steps: [],
        reasoning: "Intent: conversational - risposta fissa senza AI",
        estimatedComplexity: "simple"
      },
      results: [{
        toolName: "conversational_response",
        args: { intent: "conversational" },
        result: { message: friendlyReply, isFixedResponse: true },
        success: true
      }],
      success: true,
      totalExecutionTimeMs: Date.now() - startTime
    };
  }

  // STRATEGY: Return qualitative response WITHOUT any tool calls
  if (routerOutput.intent === "strategy") {
    console.log(`[QUERY-PLANNER] STRATEGY - generating qualitative response without tools`);
    const strategyResponse = await generateStrategyResponse(userQuestion, datasets, consultantId);
    return {
      plan: {
        steps: [],
        reasoning: "Intent: strategy - risposta qualitativa senza numeri inventati",
        estimatedComplexity: "simple"
      },
      results: [{
        toolName: "strategy_response",
        args: { intent: "strategy" },
        result: { message: strategyResponse, isQualitative: true },
        success: true
      }],
      success: true,
      totalExecutionTimeMs: Date.now() - startTime
    };
  }

  // CHECK: Analytics must be enabled (semantic mapping confirmed) for analytical queries
  if (datasets.length > 0 && (routerOutput.intent === "analytics" || routerOutput.requires_metrics)) {
    const datasetId = parseInt(datasets[0].id);
    if (!isNaN(datasetId)) {
      const analyticsCheck = await checkAnalyticsEnabled(datasetId);
      if (!analyticsCheck.enabled) {
        console.log(`[QUERY-PLANNER] ANALYTICS BLOCKED - semantic mapping not confirmed for dataset ${datasetId}`);
        return {
          plan: {
            steps: [],
            reasoning: "BLOCK: Analytics disabled - semantic mapping confirmation required",
            estimatedComplexity: "simple"
          },
          results: [{
            toolName: "analytics_blocked",
            args: { datasetId },
            result: { 
              blocked: true, 
              message: analyticsCheck.message || "Per analizzare questo dataset, conferma prima il mapping delle colonne chiave.",
              pendingColumns: analyticsCheck.pendingColumns || []
            },
            success: false
          }],
          success: false,
          totalExecutionTimeMs: Date.now() - startTime
        };
      }
    }
  }

  // ====== RANKING WITH CATEGORY FILTER DETECTION ======
  // CRITICAL: "Top 5 pizze" must apply FILTER FIRST, then RANK
  // Order: FILTER → GROUP → AGGREGATE → ORDER → LIMIT (never the reverse!)
  // NOTE: We detect the ranking pattern here but inject filters AFTER planning (see below)
  const rankingFilter = detectRankingWithCategoryFilter(userQuestion);
  if (rankingFilter.isRankingWithFilter) {
    console.log(`[QUERY-PLANNER] RANKING WITH FILTER DETECTED: category="${rankingFilter.categoryTerm}", limit=${rankingFilter.limit}, metric=${rankingFilter.metricType}`);
    // We'll inject the filter into aggregate_group tool args AFTER planning (see deterministic injection section)
  }
  
  // ====== CATEGORY TERM DETECTION (ALWAYS, not just ranking) ======
  // Detect category terms like "pizze", "bevande" in ANY query type
  // This triggers semantic filtering even for questions like "Quali pizze sono più profittevoli"
  const categoryDetection = detectCategoryTermInQuestion(userQuestion);
  if (categoryDetection.hasCategoryTerm) {
    console.log(`[QUERY-PLANNER] CATEGORY TERM DETECTED: term="${categoryDetection.categoryTerm}", value="${categoryDetection.categoryValue}"`);
  }
  
  // ====== SEMANTIC ORDER BY METRIC DETECTION ======
  // Detect semantic keywords to determine correct ORDER BY metric
  // Example: "più profittevoli" → ORDER BY gross_margin DESC (not quantity!)
  const semanticOrderBy = detectSemanticOrderByMetric(userQuestion);
  if (semanticOrderBy.hasSemanticMetric) {
    console.log(`[QUERY-PLANNER] SEMANTIC ORDERBY DETECTED: metric="${semanticOrderBy.metricName}", direction=${semanticOrderBy.direction}`);
  }

  // ====== QUANTITATIVE METRIC WITH FILTER DETECTION ======
  // Intercept "quante pizze ho venduto" as execute_metric with ILIKE filter (not aggregate_group)
  const quantitativeFilter = detectQuantitativeMetricWithFilter(userQuestion);
  if (quantitativeFilter.isQuantitativeWithFilter && datasets.length > 0 && routerOutput.intent === "analytics") {
    console.log(`[QUERY-PLANNER] QUANTITATIVE FILTER DETECTED: term="${quantitativeFilter.categoryTerm}", metric="${quantitativeFilter.metricName}"`);
    
    const datasetId = datasets[0].id;
    const quantityResult = await executeQuantitativeMetricWithFilter(
      datasetId,
      quantitativeFilter.categoryTerm || '',
      quantitativeFilter.metricName
    );
    
    if (quantityResult.success) {
      console.log(`[QUERY-PLANNER] Quantitative metric executed successfully: ${JSON.stringify(quantityResult.data)}`);
      return {
        plan: {
          steps: [{
            name: "execute_metric_filtered",
            args: { 
              datasetId, 
              metricName: quantitativeFilter.metricName, 
              categoryFilter: quantitativeFilter.categoryTerm 
            }
          }],
          reasoning: `Metrica quantitativa con filtro categoria: ${quantitativeFilter.categoryTerm}`,
          estimatedComplexity: "simple"
        },
        results: [{
          toolName: "execute_metric",
          args: { 
            datasetId, 
            metricName: quantitativeFilter.metricName, 
            filters: { category_ilike: quantitativeFilter.categoryTerm }
          },
          result: quantityResult.data,
          success: true,
          executionTimeMs: quantityResult.executionTimeMs
        }],
        success: true,
        totalExecutionTimeMs: Date.now() - startTime
      };
    } else {
      console.log(`[QUERY-PLANNER] Quantitative metric failed: ${quantityResult.error}, falling back to standard planning`);
      // Fall through to standard planning if quantitative metric fails
    }
  }

  // ====== CONTEXT MEMORY: Enhance user question with inherited context ======
  // Instead of bypassing the pipeline, we enhance the question for the AI planner
  // This is safer as it goes through normal tool validation
  let enhancedQuestion = userQuestion;
  if (isFollowUp && contextCategory.categoryTerm) {
    // Build ILIKE patterns for the category to pass to the planner
    const categoryPatterns = CATEGORY_TERMS[contextCategory.categoryTerm.toLowerCase()]?.productIlike || [`%${contextCategory.categoryTerm}%`];
    const contextHint = `[CONTESTO: La domanda precedente riguardava "${contextCategory.categoryTerm}". Applica un filtro ILIKE sul nome prodotto con questi pattern: ${categoryPatterns.join(', ')}]`;
    enhancedQuestion = `${userQuestion} ${contextHint}`;
    console.log(`[CONTEXT-MEMORY] Enhanced question with context: "${contextCategory.categoryTerm}"`);
  }

  // ====== LAYER 3: EXECUTION AGENT (AI - gemini-2.5-flash) ======
  // Plan and execute tools based on policy WITH conversation context
  // Use enhancedQuestion if context was added, otherwise use original userQuestion
  const plan = await planQuery(enhancedQuestion, datasets, consultantId, conversationHistory);
  console.log(`[QUERY-PLANNER] Plan: ${plan.steps.length} steps, complexity: ${plan.estimatedComplexity}`);

  // Apply policy enforcement to planned tool calls
  if (plan.steps.length > 0) {
    const policyResult = enforcePolicyOnToolCalls(routerOutput.intent, plan.steps);
    
    if (policyResult.violations.length > 0) {
      console.warn(`[QUERY-PLANNER] POLICY VIOLATIONS: ${policyResult.violations.join('; ')}`);
      
      // RETRY WITH FEEDBACK: Re-plan with explicit tool constraints
      if (policyResult.allowed.length === 0) {
        console.log(`[QUERY-PLANNER] All tools blocked - retrying with explicit constraints`);
        
        const retryPlan = await planQuery(
          userQuestion, 
          datasets, 
          consultantId, 
          conversationHistory,
          policy.allowedTools // Pass allowed tools to constrain AI
        );
        
        if (retryPlan.steps.length > 0) {
          // Validate retry plan
          const retryPolicyResult = enforcePolicyOnToolCalls(routerOutput.intent, retryPlan.steps);
          if (retryPolicyResult.allowed.length > 0) {
            console.log(`[QUERY-PLANNER] Retry successful - got ${retryPolicyResult.allowed.length} valid tools`);
            plan.steps = retryPolicyResult.allowed;
          } else {
            console.warn(`[QUERY-PLANNER] Retry also failed - no valid tools generated`);
            plan.steps = [];
          }
        } else {
          plan.steps = [];
        }
      } else {
        // Some tools were allowed, use those
        plan.steps = policyResult.allowed;
      }
      
      if (plan.steps.length === 0 && policy.requireToolCall) {
        return {
          plan: {
            steps: [],
            reasoning: `Policy violation: ${policyResult.violations.join('; ')}`,
            estimatedComplexity: "simple"
          },
          results: [{
            toolName: "policy_violation",
            args: { intent: routerOutput.intent, violations: policyResult.violations },
            result: { 
              blocked: true, 
              message: `La richiesta non può essere elaborata: ${policyResult.violations[0]}`
            },
            success: false
          }],
          success: false,
          totalExecutionTimeMs: Date.now() - startTime
        };
      }
    }
    
    // NEW: Validate analytics intent with requires_metrics=true has at least one compute tool
    // RULE: get_schema can PRECEDE compute tools, but cannot SUBSTITUTE them
    // ENFORCED: If only metadata tools, BLOCK and require re-plan
    // FIX: Use requires_metrics (underscore) to match router output format
    if (routerOutput.intent === "analytics" && routerOutput.requires_metrics) {
      const analyticsValidation = validateAnalyticsToolCalls(plan.steps, routerOutput.requires_metrics);
      if (!analyticsValidation.valid) {
        console.warn(`[QUERY-PLANNER] ANALYTICS VALIDATION FAILED: ${analyticsValidation.reason}`);
        console.log(`[QUERY-PLANNER] BLOCKING metadata-only call - forcing compute tool requirement`);
        return {
          plan: {
            steps: [],
            reasoning: `Analytics validation failed: ${analyticsValidation.reason}`,
            estimatedComplexity: "simple"
          },
          results: [{
            toolName: "analytics_requires_compute",
            args: { 
              intent: routerOutput.intent, 
              requires_metrics: routerOutput.requires_metrics,
              attemptedTools: plan.steps.map(s => s.name)
            },
            result: { 
              blocked: true, 
              message: "La domanda richiede calcoli sui dati. Usa aggregate_group o execute_metric per analizzare i numeri del dataset."
            },
            success: false
          }],
          success: false,
          totalExecutionTimeMs: Date.now() - startTime
        };
      }
    }
    
    // TASK 2: Check semantic contract - if user requests ALL but AI set a limit, BLOCK
    for (const step of plan.steps) {
      if (step.name === "aggregate_group" || step.name === "filter_data") {
        const limit = step.args.limit;
        
        if (semanticContract.requestsAll && limit && limit < MAX_GROUP_BY_LIMIT) {
          console.log(`[WIRING-CHECK] semantic contract enforced - requestsAll=${semanticContract.requestsAll}, aiLimit=${limit}`);
          console.warn(`[SEMANTIC-CONTRACT] BLOCK: User requested ALL items (keywords: ${semanticContract.detectedKeywords.join(", ")}) but AI set limit=${limit}`);
          return {
            plan: {
              steps: [],
              reasoning: `Semantic contract violation: user requested ALL items but AI would truncate to ${limit}`,
              estimatedComplexity: "simple"
            },
            results: [{
              toolName: "semantic_contract_violation",
              args: { 
                requestedAll: true, 
                aiLimit: limit,
                keywords: semanticContract.detectedKeywords 
              },
              result: { 
                needsConfirmation: true,
                message: `Hai chiesto di vedere TUTTI gli elementi (${semanticContract.detectedKeywords.join(", ")}), ma potrebbero essere molti. Vuoi procedere comunque o preferisci vedere solo i primi ${limit}?`,
                options: [
                  { action: "show_all", description: "Mostra tutti gli elementi" },
                  { action: "top_n", description: `Mostra i primi ${limit}` },
                  { action: "export", description: "Esporta in CSV" },
                ]
              },
              success: false
            }],
            success: false,
            totalExecutionTimeMs: Date.now() - startTime
          };
        }
        
        // TASK 5: Auto-correct groupBy if user asks for product listing but AI used category
        // Also detect ranking direction (DESC for "best", ASC for "worst")
        const groupByCorrection = validateAndCorrectGroupBy(step, groupByIntent, userQuestion);
        if (groupByCorrection.corrected) {
          console.log(`[WIRING-CHECK] groupBy auto-corrected: ${JSON.stringify(groupByCorrection.originalGroupBy)} → ${JSON.stringify(groupByCorrection.newGroupBy)}`);
        }

        // TASK 4: Inject missing filters into tool calls
        if (Object.keys(extractedFilters).length > 0) {
          const existingFilters = step.args.filters || {};
          let injected = false;
          
          for (const [col, filter] of Object.entries(extractedFilters)) {
            if (!existingFilters[col]) {
              console.log(`[WIRING-CHECK] filters injected - ${col} = "${filter.value}"`);
              console.log(`[FILTER-INJECT] Injecting missing filter: ${col} = "${filter.value}"`);
              existingFilters[col] = filter;
              injected = true;
            }
          }
          
          if (injected) {
            step.args.filters = existingFilters;
            console.log(`[FILTER-INJECT] Updated filters: ${JSON.stringify(step.args.filters)}`);
          }
        }
        
        // ====== CONTEXT MEMORY: Deterministic ILIKE injection for follow-ups ======
        // If this is a follow-up with inherited category context, inject ILIKE filter into tool args
        if (isFollowUp && contextCategory.categoryTerm && !step.args.productIlikePatterns) {
          const categoryDef = CATEGORY_TERMS[contextCategory.categoryTerm.toLowerCase()];
          if (categoryDef && categoryDef.productIlike && categoryDef.productIlike.length > 0) {
            step.args.productIlikePatterns = categoryDef.productIlike;
            step.args._inheritedCategoryContext = contextCategory.categoryTerm;
            console.log(`[CONTEXT-MEMORY] DETERMINISTIC FILTER INJECTION: Injected ${categoryDef.productIlike.length} ILIKE patterns for "${contextCategory.categoryTerm}" into ${step.name}`);
          }
        }
        
        // ====== SEMANTIC CATEGORY FILTER INJECTION (ALWAYS, not just ranking) ======
        // CRITICAL: When user mentions a category (pizze, bevande, etc.), apply semantic filter
        // This works for ANY query: "Top 5 pizze", "Quali pizze sono più profittevoli", etc.
        // The _semanticCategoryFilter will be resolved to physical column name in aggregateGroup
        
        // Determine which category to use: ranking detection or general category detection
        const effectiveCategoryTerm = rankingFilter.categoryTerm || categoryDetection.categoryTerm;
        const effectiveCategoryValue = rankingFilter.categoryTerm 
          ? CATEGORY_TERMS[rankingFilter.categoryTerm.toLowerCase()]?.categoryValue
          : categoryDetection.categoryValue;
        
        if (effectiveCategoryTerm && effectiveCategoryValue && !step.args._semanticCategoryFilter) {
          // Inject semantic category filter - will be resolved to physical column in aggregateGroup
          step.args._semanticCategoryFilter = {
            logicalRole: 'category',  // Will try: subcategory → category → tags
            value: effectiveCategoryValue
          };
          step.args._detectedCategoryTerm = effectiveCategoryTerm;
          step.args._applyIsSellable = true;
          
          console.log(`[SEMANTIC-CATEGORY] INJECTION: category='${effectiveCategoryValue}' for term "${effectiveCategoryTerm}"`);
          
          // If this is a ranking query, also enforce the limit
          if (rankingFilter.isRankingWithFilter && rankingFilter.limit) {
            if (!step.args.limit || step.args.limit > rankingFilter.limit) {
              step.args.limit = rankingFilter.limit;
            }
            console.log(`[SEMANTIC-CATEGORY] Ranking limit enforced: ${step.args.limit}`);
          }
        }
        
        // ====== SEMANTIC ORDER BY INJECTION ======
        // Override AI's orderBy with semantically correct metric
        // ONLY for ranking/top-N queries or explicit "più/meno" intent
        // Example: "più profittevoli" → ORDER BY gross_margin DESC (not totale_venduto!)
        const hasRankingIntent = rankingFilter.isRankingWithFilter || 
          /più|meno|migliori|peggiori|top\s*\d+|classifica/i.test(userQuestion);
        
        if (semanticOrderBy.hasSemanticMetric && semanticOrderBy.metricName && hasRankingIntent) {
          // CRITICAL: Validate metric availability BEFORE injection
          // If dataset lacks required columns (e.g., cost for gross_margin), skip injection
          const datasetIdForValidation = step.args.datasetId;
          let metricIsAvailable = false;
          
          if (datasetIdForValidation) {
            const metricValidation = await validateMetricForDataset(
              semanticOrderBy.metricName, 
              datasetIdForValidation
            );
            metricIsAvailable = metricValidation.valid;
            
            if (!metricIsAvailable) {
              console.log(`[SEMANTIC-ORDERBY] SKIP: Metric "${semanticOrderBy.metricName}" not available for dataset ${datasetIdForValidation}`);
              console.log(`[SEMANTIC-ORDERBY] Reason: ${metricValidation.error || 'Missing required columns'}`);
              
              // CRITICAL: Clear any metricName that AI may have set to prevent downstream errors
              if (step.args.metricName === semanticOrderBy.metricName) {
                delete step.args.metricName;
                console.log(`[SEMANTIC-ORDERBY] Cleared invalid metricName: ${semanticOrderBy.metricName}`);
              }
              
              // FALLBACK: Use existing aggregation alias for orderBy
              // This ensures the query still has a valid orderBy even if semantic metric unavailable
              if (step.args.aggregations && step.args.aggregations.length > 0) {
                const firstAggAlias = step.args.aggregations[0].alias;
                if (firstAggAlias) {
                  // Override AI's orderBy with valid aggregation alias + semantic direction
                  step.args.orderBy = {
                    column: firstAggAlias,
                    direction: semanticOrderBy.direction
                  };
                  console.log(`[SEMANTIC-ORDERBY] FALLBACK: Using aggregation "${firstAggAlias}" ${semanticOrderBy.direction} for orderBy`);
                }
              } else if (step.args.orderBy) {
                // Verify AI's orderBy column exists in groupBy, otherwise remove it
                const groupByCols = step.args.groupBy || [];
                if (groupByCols.includes(step.args.orderBy.column)) {
                  step.args.orderBy.direction = semanticOrderBy.direction;
                  console.log(`[SEMANTIC-ORDERBY] FALLBACK: Keeping AI orderBy "${step.args.orderBy.column}" with semantic direction ${semanticOrderBy.direction}`);
                } else {
                  // Invalid orderBy column - remove to prevent error
                  delete step.args.orderBy;
                  console.log(`[SEMANTIC-ORDERBY] FALLBACK: Removed invalid orderBy (column not in groupBy)`);
                }
              }
            }
          } else {
            // No datasetId - cannot validate, skip semantic injection entirely
            console.log(`[SEMANTIC-ORDERBY] SKIP: No datasetId available for validation`);
          }
          
          if (metricIsAvailable) {
            // Set metricName to the semantic metric
            step.args.metricName = semanticOrderBy.metricName;
            console.log(`[SEMANTIC-ORDERBY] Injecting metricName: ${semanticOrderBy.metricName}`);
            
            // IMPORTANT: Set orderBy to use the METRIC NAME, not a display alias
            // The metric will be resolved and aggregated in executeToolCall
            // The aggregation will create the column with the metric name
            step.args.orderBy = {
              column: semanticOrderBy.metricName, // Use metric name, will be aggregated
              direction: semanticOrderBy.direction
            };
            step.args._semanticOrderByApplied = true;
            console.log(`[SEMANTIC-ORDERBY] Injecting orderBy: ${step.args.orderBy.column} ${step.args.orderBy.direction}`);
          }
        }
      }
    }
  }

  const result = await executePlanWithValidation(plan, datasets, consultantId, userId, userQuestion);
  console.log(`[QUERY-PLANNER] Execution complete in ${result.totalExecutionTimeMs}ms, success: ${result.success}`);

  // BUG FIX: Check for zero results and return clear message instead of letting AI generate analysis
  const COMPUTE_TOOLS = ["execute_metric", "aggregate_group", "compare_periods", "filter_data", "query_metric"];
  const computeResults = result.results.filter(r => COMPUTE_TOOLS.includes(r.toolName) && r.success);
  
  if (computeResults.length > 0) {
    const allZeroRows = computeResults.every(r => {
      const rowCount = r.result?.rowCount ?? r.result?.data?.length ?? 
                       (Array.isArray(r.result) ? r.result.length : null);
      return rowCount === 0;
    });
    
    if (allZeroRows) {
      console.log(`[QUERY-PLANNER] ZERO RESULTS DETECTED - All compute tools returned 0 rows`);
      
      // Extract filter info for helpful message
      const appliedFilters: string[] = [];
      for (const r of computeResults) {
        if (r.args?.filters) {
          for (const [col, filter] of Object.entries(r.args.filters)) {
            const f = filter as { operator: string; value: string | number };
            appliedFilters.push(`${col} ${f.operator} "${f.value}"`);
          }
        }
      }
      
      const filterInfo = appliedFilters.length > 0 
        ? `\n\n**Filtri applicati:** ${appliedFilters.join(", ")}`
        : "";
      
      const zeroResultsMessage = `## ⚠️ La query non ha trovato dati

La ricerca non ha restituito risultati con i filtri applicati.${filterInfo}

**Possibili cause:**
- Il valore del filtro potrebbe contenere un errore di battitura
- Il valore potrebbe non esistere nel dataset (verifica i valori disponibili)
- Prova a riformulare la domanda con valori diversi

**Suggerimento:** Chiedi "quali sono i valori unici di [colonna]?" per vedere i valori disponibili.`;

      return {
        plan: result.plan,
        results: [{
          toolName: "zero_results_handler",
          args: { appliedFilters },
          result: { 
            message: zeroResultsMessage, 
            isZeroResults: true,
            rowCount: 0
          },
          success: true
        }],
        success: true,
        totalExecutionTimeMs: Date.now() - startTime
      };
    }
  }

  return result;
}

const STRATEGY_FALLBACK = `Per rispondere a questa domanda strategica in modo accurato, dovrei prima analizzare i tuoi dati reali.

Posso suggerirti queste aree di focus:
- **Analisi del volume**: Capire trend di vendita e opportunità di crescita
- **Ottimizzazione prezzi**: Identificare prodotti con margine migliorabile
- **Mix prodotti**: Valutare la composizione del fatturato

Vuoi che calcoli i numeri reali per una di queste aree?`;

const ITALIAN_NUMERAL_WORDS = [
  "zero", "un[oa]?", "due", "tre", "quattro", "cinque", "sei", "sette", "otto", "nove",
  "dieci", "undici", "dodici", "tredici", "quattordici", "quindici", "sedici",
  "diciassette", "diciotto", "diciannove",
  "vent[io]?", "trent[ao]?", "quarant[ao]?", "cinquant[ao]?", "sessant[ao]?",
  "settant[ao]?", "ottant[ao]?", "novant[ao]?",
  "cent[oi]?", "mille", "mila", "milion[ei]?", "miliard[io]?",
  "prim[oa]?", "second[oa]?", "terz[oa]?", "quart[oa]?", "quint[oa]?",
  "sest[oa]?", "settim[oa]?", "ottav[oa]?", "non[oa]?", "decim[oa]?",
  "dozzin[ae]", "mezz[oa]", "doppi[oa]", "tripl[oa]", "quadrupl[oa]"
];
const COMPOUND_PREFIX = "(vent|trent|quarant|cinquant|sessant|settant|ottant|novant|cent|duecent|trecent)";
const COMPOUND_SUFFIX = "(uno|due|tre|quattro|cinque|sei|sette|otto|nove)";
const ITALIAN_NUMERALS = new RegExp(`\\b(${ITALIAN_NUMERAL_WORDS.join("|")}|${COMPOUND_PREFIX}${COMPOUND_SUFFIX})\\b`, "i");
const ROMAN_NUMERALS = /\b[IVXLCDM]{2,}\b/;

function hasAnyDigit(text: string): boolean {
  return /\d/.test(text);
}

function hasNumericContent(text: string): boolean {
  if (/\d/.test(text)) return true;
  if (ITALIAN_NUMERALS.test(text)) return true;
  if (ROMAN_NUMERALS.test(text)) return true;
  if (/\b[QqVv]\d+\b/.test(text)) return true;
  if (/[\u0660-\u0669\u06F0-\u06F9\u0966-\u096F]/.test(text)) return true;
  return false;
}

function convertListNumbersToBullets(text: string): string {
  return text.replace(/^\s*(\d+)[\.\)]\s*/gm, "- ");
}

function removeAllNumbers(text: string): string {
  let cleaned = text;
  
  cleaned = cleaned.replace(/[€$£]\s*[\d,.]+|[\d,.]+\s*[€$£]/g, "");
  cleaned = cleaned.replace(/[+-]?\d+\s*%/g, "");
  cleaned = cleaned.replace(/\b\d{4}\b/g, "");
  cleaned = cleaned.replace(/\b\d{1,3}(?:[.,]\d{3})+/g, "");
  cleaned = cleaned.replace(/\b\d+[.,]\d+\b/g, "");
  cleaned = cleaned.replace(/\d+\s*[-–:]\s*\d+/g, "");
  cleaned = cleaned.replace(/\d+[°º]/g, "");
  cleaned = cleaned.replace(/\d+\s*(?:mesi|anni|giorni|ore|settimane)/gi, "un certo periodo");
  
  cleaned = convertListNumbersToBullets(cleaned);
  
  cleaned = cleaned.replace(/\b\d+\b/g, "");
  cleaned = cleaned.replace(ROMAN_NUMERALS, "");
  cleaned = cleaned.replace(ITALIAN_NUMERALS, "alcuni");
  cleaned = cleaned.replace(new RegExp(COMPOUND_PREFIX + COMPOUND_SUFFIX, 'gi'), "alcuni");
  cleaned = cleaned.replace(/\s{2,}/g, " ");
  cleaned = cleaned.replace(/^\s+/gm, "");
  
  return cleaned.trim();
}

/**
 * Generate a qualitative strategy response without any tool calls or numbers
 * Hard numeric guard: if AI still returns numbers, scrub them or fallback
 */
async function generateStrategyResponse(
  userQuestion: string,
  datasets: DatasetInfo[],
  consultantId?: string
): Promise<string> {
  const providerResult = await getAIProvider(consultantId || "system", consultantId);
  const client = providerResult.client;
  const { model: modelName } = getModelWithThinking(providerResult.metadata?.name);

  const STRATEGY_PROMPT = `Sei un consulente strategico. Rispondi a domande di business in modo QUALITATIVO.

REGOLE ASSOLUTE - VIOLAZIONE = ERRORE CRITICO:
- NON citare MAI numeri specifici (€, %, quantità, importi)
- NON fare MAI proiezioni numeriche o stime
- NON inventare MAI dati o percentuali
- NON usare numeri scritti in lettere (es. "dieci", "venti")
- Fornisci SOLO consigli strategici generali
- USA SEMPRE bullet points (-) invece di liste numerate

APPROCCIO:
- Identifica le leve strategiche (pricing, costi, volume, mix prodotti)
- Suggerisci framework di analisi
- Proponi azioni concrete senza quantificarle
- Se servono numeri per una risposta precisa, suggerisci di chiedere analytics specifici

ESEMPIO CORRETTO:
Domanda: "Come posso aumentare molto il fatturato?"
Risposta: "Per aumentare significativamente il fatturato puoi lavorare su queste leve principali:
- **Volume**: Aumentare il numero di clienti o la frequenza degli ordini
- **Prezzo**: Rivedere il pricing dei prodotti più venduti
- **Mix**: Promuovere prodotti ad alto margine

Vuoi che analizzi i dati attuali per identificare le opportunità specifiche?"

VIETATO (MAI FARE):
- Percentuali inventate
- Proiezioni numeriche
- Importi stimati
- Numeri in lettere`;

  const datasetContext = datasets.length > 0 
    ? `\n\nDataset disponibile: "${datasets[0].name}".`
    : "";

  try {
    const response = await executeWithRetry(
      () => client.generateContent({
        model: modelName,
        systemInstruction: {
          role: "system",
          parts: [{ text: STRATEGY_PROMPT }]
        },
        contents: [
          { role: "user", parts: [{ text: userQuestion + datasetContext }] }
        ],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 1024,
        }
      }),
      "QUERY-PLANNER-STRATEGY"
    );

    let aiResponse = response.response.text() || "";
    
    if (hasNumericContent(aiResponse)) {
      console.warn(`[STRATEGY-GUARD] AI response contains numeric content, applying hard guard...`);
      aiResponse = removeAllNumbers(aiResponse);
      aiResponse = aiResponse.replace(ITALIAN_NUMERALS, "alcuni");
      
      if (hasNumericContent(aiResponse)) {
        console.error(`[STRATEGY-GUARD] HARD BLOCK: numeric content still present after scrubbing, using fallback`);
        return STRATEGY_FALLBACK;
      }
    }
    
    return aiResponse;
  } catch (error: any) {
    console.error("[QUERY-PLANNER] Strategy response error:", error.message);
    return "Per rispondere a questa domanda strategica, ho bisogno di analizzare prima i dati. Vuoi che calcoli le metriche rilevanti?";
  }
}
