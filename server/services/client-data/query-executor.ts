import { pool, db } from "../../db";
import { clientDataDatasets, clientDataQueryLog, clientDataMetrics } from "../../../shared/schema";
import { eq } from "drizzle-orm";
import { parseMetricExpression, translateToSQL, validateMetricAgainstSchema, computeQueryHash, type ValidatedMetric } from "./metric-dsl";
import { getCachedResult, cacheResult, cacheError, acquireCacheLock, waitForCacheResult, type CacheEntry } from "./cache-manager";

export interface QueryOptions {
  timeoutMs?: number;
  useCache?: boolean;
  cacheTtlSeconds?: number;
  userId?: string;
}

export interface QueryResult {
  success: boolean;
  data?: any[];
  metrics?: Record<string, number>;
  period?: { start: string; end: string };
  filters?: Record<string, any>;
  rowCount?: number;
  executionTimeMs?: number;
  error?: string;
  cached?: boolean;
}

const DEFAULT_TIMEOUT_MS = 3000; // Reduced from 30s to 3s for AI queries (query cost guard)
const AI_QUERY_TIMEOUT_MS = 3000; // Hard limit for AI-triggered queries
const DEFAULT_CACHE_TTL_AGGREGATION = 3600;
const DEFAULT_CACHE_TTL_FILTER = 300;
const MAX_GROUP_BY_LIMIT = 500; // Hard limit for GROUP BY queries
const MAX_FILTER_LIMIT = 1000; // Hard limit for filter queries

export async function executeQuery(
  sql: string,
  params: (string | number)[] = [],
  options: QueryOptions = {}
): Promise<QueryResult> {
  const startTime = Date.now();
  const timeoutMs = options.timeoutMs || DEFAULT_TIMEOUT_MS;
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await client.query(`SET LOCAL statement_timeout = '${timeoutMs}ms'`);

    const result = await client.query(sql, params);

    await client.query("COMMIT");

    const executionTimeMs = Date.now() - startTime;

    return {
      success: true,
      data: result.rows,
      rowCount: result.rowCount || 0,
      executionTimeMs,
      cached: false,
    };
  } catch (error: any) {
    await client.query("ROLLBACK").catch(() => {});

    const executionTimeMs = Date.now() - startTime;
    console.error("[QUERY-EXECUTOR] Query execution error:", error.message);

    return {
      success: false,
      error: error.message,
      executionTimeMs,
    };
  } finally {
    client.release();
  }
}

async function logQuery(
  datasetId: string | number,
  toolName: string,
  sql: string,
  params: Record<string, any>,
  executionTimeMs: number,
  rowCount: number,
  success: boolean,
  errorMessage?: string,
  userId?: string
): Promise<void> {
  try {
    const numericDatasetId = typeof datasetId === 'number' ? datasetId : parseInt(datasetId, 10);
    if (isNaN(numericDatasetId) || numericDatasetId <= 0) {
      console.warn("[QUERY-EXECUTOR] Invalid datasetId for logging:", datasetId);
      return;
    }
    await db.insert(clientDataQueryLog).values({
      datasetId: numericDatasetId,
      toolName,
      sqlExecuted: sql,
      toolParams: params,
      executionTimeMs,
      rowCount,
      fromCache: false,
      errorMessage: success ? null : errorMessage,
      userId,
    });
  } catch (error: any) {
    console.error("[QUERY-EXECUTOR] Failed to log query:", error.message);
  }
}

async function getDatasetInfo(datasetId: string): Promise<{ 
  tableName: string; 
  columns: string[]; 
  columnMapping: Record<string, { displayName: string; dataType: string }>;
} | null> {
  const [dataset] = await db
    .select()
    .from(clientDataDatasets)
    .where(eq(clientDataDatasets.id, datasetId))
    .limit(1);

  if (!dataset || dataset.status !== "ready") {
    return null;
  }

  const columns = Object.keys(dataset.columnMapping);
  return { 
    tableName: dataset.tableName, 
    columns,
    columnMapping: dataset.columnMapping as Record<string, { displayName: string; dataType: string }>,
  };
}

/**
 * Execute a pre-defined metric using raw SQL expression
 * This bypasses the DSL parser - used by execute_metric tool
 * @param datasetId - Dataset ID
 * @param sqlExpression - Raw SQL aggregation expression (e.g., 'SUM(CAST("Total Net" AS NUMERIC))')
 * @param options - Query options including timeout
 */
export async function executeMetricSQL(
  datasetId: string,
  sqlExpression: string,
  metricName: string,
  options: QueryOptions = {}
): Promise<QueryResult> {
  const startTime = Date.now();
  const datasetInfo = await getDatasetInfo(datasetId);

  if (!datasetInfo) {
    return { success: false, error: "Dataset not found or not ready" };
  }

  const sql = `SELECT ${sqlExpression} AS result FROM "${datasetInfo.tableName}"`;
  const queryHash = computeQueryHash(sql, []);

  if (options.useCache !== false) {
    const cached = await getCachedResult(queryHash, datasetId);
    if (cached && cached.status === "ready") {
      return {
        success: true,
        data: cached.resultJson?.data,
        metrics: cached.resultJson?.metrics,
        rowCount: 1,
        executionTimeMs: Date.now() - startTime,
        cached: true,
      };
    }
  }

  const result = await executeQuery(sql, [], { 
    ...options, 
    timeoutMs: options.timeoutMs || AI_QUERY_TIMEOUT_MS 
  });

  await logQuery(
    datasetId,
    "execute_metric",
    sql,
    { metricName, sqlExpression },
    result.executionTimeMs || 0,
    1,
    result.success,
    result.error,
    options.userId
  );

  if (result.success && options.useCache !== false) {
    const metricValue = result.data?.[0]?.result;
    await cacheResult(queryHash, datasetId, {
      data: result.data,
      metrics: { [metricName]: metricValue },
      rowCount: 1,
    }, DEFAULT_CACHE_TTL_AGGREGATION);
  }

  return {
    ...result,
    metrics: result.success ? { [metricName]: result.data?.[0]?.result } : undefined,
  };
}

export async function queryMetric(
  datasetId: string,
  dslExpression: string,
  options: QueryOptions = {}
): Promise<QueryResult> {
  const startTime = Date.now();
  const datasetInfo = await getDatasetInfo(datasetId);

  if (!datasetInfo) {
    return { success: false, error: "Dataset not found or not ready" };
  }

  const metric = parseMetricExpression(dslExpression);
  const validation = validateMetricAgainstSchema(metric, datasetInfo.columns);

  if (!validation.valid) {
    return { success: false, error: validation.errors.join("; ") };
  }

  const { sql, parameters } = translateToSQL(metric, datasetInfo.tableName);
  const queryHash = computeQueryHash(sql, parameters);

  if (options.useCache !== false) {
    const cached = await getCachedResult(queryHash, datasetId);
    if (cached && cached.status === "ready") {
      return {
        success: true,
        data: cached.resultJson?.data,
        metrics: cached.resultJson?.metrics,
        rowCount: cached.resultJson?.rowCount || 0,
        executionTimeMs: Date.now() - startTime,
        cached: true,
      };
    }

    const lockAcquired = await acquireCacheLock(queryHash, datasetId);
    if (!lockAcquired) {
      const waitedCache = await waitForCacheResult(queryHash, datasetId, options.timeoutMs || DEFAULT_TIMEOUT_MS);
      if (waitedCache) {
        if (waitedCache.status === "ready") {
          return {
            success: true,
            data: waitedCache.resultJson?.data,
            metrics: waitedCache.resultJson?.metrics,
            rowCount: waitedCache.resultJson?.rowCount || 0,
            executionTimeMs: Date.now() - startTime,
            cached: true,
          };
        }
        if (waitedCache.status === "error") {
          return {
            success: false,
            error: waitedCache.errorMessage || "Cache computation failed",
            executionTimeMs: Date.now() - startTime,
          };
        }
      }
      return {
        success: false,
        error: "Timeout waiting for cache computation",
        executionTimeMs: Date.now() - startTime,
      };
    }
  }

  const result = await executeQuery(sql, parameters, options);

  await logQuery(
    datasetId,
    "query_metric",
    sql,
    { params: parameters },
    result.executionTimeMs || 0,
    result.rowCount || 0,
    result.success,
    result.error,
    options.userId
  );

  if (options.useCache !== false) {
    const ttl = options.cacheTtlSeconds || DEFAULT_CACHE_TTL_AGGREGATION;
    if (result.success) {
      await cacheResult(queryHash, datasetId, {
        data: result.data,
        metrics: result.data?.[0]?.result !== undefined ? { result: result.data[0].result } : undefined,
        rowCount: result.rowCount,
      }, ttl);
    } else {
      await cacheError(queryHash, datasetId, result.error || "Query execution failed");
    }
  }

  if (result.success && result.data?.length === 1 && "result" in result.data[0]) {
    result.metrics = { result: result.data[0].result };
  }

  return result;
}

export async function comparePeriods(
  datasetId: string,
  dslExpression: string,
  dateColumn: string,
  period1: { start: string; end: string },
  period2: { start: string; end: string },
  options: QueryOptions = {}
): Promise<QueryResult> {
  const datasetInfo = await getDatasetInfo(datasetId);

  if (!datasetInfo) {
    return { success: false, error: "Dataset not found or not ready" };
  }

  const dsl1 = `${dslExpression} WHERE ${dateColumn} >= '${period1.start}' AND ${dateColumn} <= '${period1.end}'`;
  const dsl2 = `${dslExpression} WHERE ${dateColumn} >= '${period2.start}' AND ${dateColumn} <= '${period2.end}'`;

  const [result1, result2] = await Promise.all([
    queryMetric(datasetId, dsl1, { ...options, useCache: false }),
    queryMetric(datasetId, dsl2, { ...options, useCache: false }),
  ]);

  if (!result1.success) {
    return { success: false, error: `Period 1 query failed: ${result1.error}` };
  }

  if (!result2.success) {
    return { success: false, error: `Period 2 query failed: ${result2.error}` };
  }

  const value1 = result1.data?.[0]?.result ?? 0;
  const value2 = result2.data?.[0]?.result ?? 0;

  const difference = value1 - value2;
  const percentageChange = value2 !== 0 ? ((value1 - value2) / Math.abs(value2)) * 100 : value1 !== 0 ? 100 : 0;

  return {
    success: true,
    metrics: {
      period1_value: value1,
      period2_value: value2,
      difference,
      percentage_change: parseFloat(percentageChange.toFixed(2)),
    },
    period: {
      start: `${period1.start} vs ${period2.start}`,
      end: `${period1.end} vs ${period2.end}`,
    },
    executionTimeMs: (result1.executionTimeMs || 0) + (result2.executionTimeMs || 0),
  };
}

export async function filterData(
  datasetId: string,
  filters: Record<string, { operator: string; value: string | number }>,
  columns?: string[],
  limit: number = 100,
  offset: number = 0,
  options: QueryOptions = {}
): Promise<QueryResult> {
  const startTime = Date.now();
  
  // HARD LIMIT: Enforce maximum limit for filter queries (query cost guard)
  const enforcedLimit = Math.min(limit, MAX_FILTER_LIMIT);
  if (limit > MAX_FILTER_LIMIT) {
    console.warn(`[QUERY-EXECUTOR] Filter limit ${limit} exceeds max ${MAX_FILTER_LIMIT}, enforcing hard limit`);
  }
  
  const datasetInfo = await getDatasetInfo(datasetId);

  if (!datasetInfo) {
    return { success: false, error: "Dataset not found or not ready" };
  }

  const selectCols = columns && columns.length > 0
    ? columns.filter(c => datasetInfo.columns.includes(c)).map(c => `"${c}"`).join(", ")
    : "*";

  const whereClauses: string[] = [];
  const params: (string | number)[] = [];
  let paramIndex = 1;

  for (const [column, condition] of Object.entries(filters)) {
    if (!datasetInfo.columns.includes(column)) {
      return { success: false, error: `Invalid column: ${column}` };
    }

    whereClauses.push(`"${column}" ${condition.operator} $${paramIndex}`);
    params.push(condition.value);
    paramIndex++;
  }

  let sql = `SELECT ${selectCols} FROM "${datasetInfo.tableName}"`;
  if (whereClauses.length > 0) {
    sql += ` WHERE ${whereClauses.join(" AND ")}`;
  }
  sql += ` LIMIT ${enforcedLimit} OFFSET ${offset}`;

  const queryHash = computeQueryHash(sql, params);

  if (options.useCache !== false) {
    const cached = await getCachedResult(queryHash, datasetId);
    if (cached && cached.status === "ready") {
      return {
        success: true,
        data: cached.resultJson?.data,
        rowCount: cached.resultJson?.rowCount || 0,
        filters,
        executionTimeMs: Date.now() - startTime,
        cached: true,
      };
    }
  }

  const result = await executeQuery(sql, params, options);

  await logQuery(
    datasetId,
    "filter_data",
    sql,
    { params, filters },
    result.executionTimeMs || 0,
    result.rowCount || 0,
    result.success,
    result.error,
    options.userId
  );

  if (result.success && options.useCache !== false) {
    await cacheResult(queryHash, datasetId, {
      data: result.data,
      rowCount: result.rowCount,
    }, DEFAULT_CACHE_TTL_FILTER);
  }

  return {
    ...result,
    filters,
  };
}

export async function aggregateGroup(
  datasetId: string,
  groupByColumns: string[],
  aggregations: { column: string; function: string; alias?: string }[] | { column: string; function: string; alias?: string },
  filters?: Record<string, { operator: string; value: string | number }>,
  orderBy?: { column: string; direction: "ASC" | "DESC" },
  limit: number = 100,
  options: QueryOptions = {}
): Promise<QueryResult> {
  const startTime = Date.now();
  
  // Normalize aggregations to array (AI might pass single object)
  let normalizedAggregations: { column: string; function: string; alias?: string }[];
  if (!aggregations) {
    return { success: false, error: "Aggregations parameter is required" };
  }
  if (Array.isArray(aggregations)) {
    normalizedAggregations = aggregations;
  } else if (typeof aggregations === 'object') {
    normalizedAggregations = [aggregations];
  } else {
    return { success: false, error: `Invalid aggregations format: expected array or object, got ${typeof aggregations}` };
  }
  
  if (normalizedAggregations.length === 0) {
    return { success: false, error: "At least one aggregation is required" };
  }
  
  // HARD LIMIT: Enforce maximum limit for GROUP BY queries (query cost guard)
  const enforcedLimit = Math.min(limit, MAX_GROUP_BY_LIMIT);
  if (limit > MAX_GROUP_BY_LIMIT) {
    console.warn(`[QUERY-EXECUTOR] Limit ${limit} exceeds max ${MAX_GROUP_BY_LIMIT}, enforcing hard limit`);
  }
  
  // HARD LIMIT: Max 3 columns in GROUP BY to prevent query explosion
  if (groupByColumns.length > 3) {
    return { success: false, error: `Troppe colonne in GROUP BY (max 3): ${groupByColumns.length}` };
  }
  
  const datasetInfo = await getDatasetInfo(datasetId);

  if (!datasetInfo) {
    return { success: false, error: "Dataset not found or not ready" };
  }

  for (const col of groupByColumns) {
    if (!datasetInfo.columns.includes(col)) {
      return { success: false, error: `Invalid group by column: ${col}` };
    }
  }

  const selectParts: string[] = groupByColumns.map(c => `"${c}"`);
  const validFunctions = ["SUM", "AVG", "COUNT", "MIN", "MAX"];

  for (const agg of normalizedAggregations) {
    if (!agg.function) {
      return { success: false, error: `Missing aggregate function for column: ${agg.column}` };
    }
    const func = agg.function.toUpperCase();
    if (!validFunctions.includes(func)) {
      return { success: false, error: `Invalid aggregate function: ${agg.function}` };
    }

    if (agg.column !== "*" && !datasetInfo.columns.includes(agg.column)) {
      return { success: false, error: `Invalid aggregate column: ${agg.column}` };
    }

    let col: string;
    if (agg.column === "*") {
      col = "*";
    } else {
      const colMapping = datasetInfo.columnMapping[agg.column];
      const isNumericType = colMapping && /^(number|numeric|integer|decimal)$/i.test(colMapping.dataType);
      const needsCast = isNumericType && ["SUM", "AVG", "MIN", "MAX"].includes(func);
      col = needsCast 
        ? `CAST("${agg.column}" AS NUMERIC)` 
        : `"${agg.column}"`;
    }
    const alias = agg.alias || `${func.toLowerCase()}_${agg.column}`;
    selectParts.push(`${func}(${col}) AS "${alias}"`);
  }

  const params: (string | number)[] = [];
  let paramIndex = 1;
  const whereClauses: string[] = [];

  if (filters) {
    for (const [column, condition] of Object.entries(filters)) {
      if (!datasetInfo.columns.includes(column)) {
        return { success: false, error: `Invalid filter column: ${column}` };
      }
      whereClauses.push(`"${column}" ${condition.operator} $${paramIndex}`);
      params.push(condition.value);
      paramIndex++;
    }
  }

  let sql = `SELECT ${selectParts.join(", ")} FROM "${datasetInfo.tableName}"`;

  if (whereClauses.length > 0) {
    sql += ` WHERE ${whereClauses.join(" AND ")}`;
  }

  sql += ` GROUP BY ${groupByColumns.map(c => `"${c}"`).join(", ")}`;

  if (orderBy) {
    if (!groupByColumns.includes(orderBy.column) && !normalizedAggregations.some(a => a.alias === orderBy.column)) {
      const aggCol = normalizedAggregations.find(a => `${a.function.toLowerCase()}_${a.column}` === orderBy.column);
      if (!aggCol) {
        return { success: false, error: `Invalid order by column: ${orderBy.column}` };
      }
    }
    sql += ` ORDER BY "${orderBy.column}" ${orderBy.direction}`;
  }

  sql += ` LIMIT ${enforcedLimit}`;

  const queryHash = computeQueryHash(sql, params);

  if (options.useCache !== false) {
    const cached = await getCachedResult(queryHash, datasetId);
    if (cached && cached.status === "ready") {
      return {
        success: true,
        data: cached.resultJson?.data,
        rowCount: cached.resultJson?.rowCount || 0,
        executionTimeMs: Date.now() - startTime,
        cached: true,
      };
    }
  }

  const result = await executeQuery(sql, params, options);

  await logQuery(
    datasetId,
    "aggregate_group",
    sql,
    { params, groupBy: groupByColumns, aggregations: normalizedAggregations },
    result.executionTimeMs || 0,
    result.rowCount || 0,
    result.success,
    result.error,
    options.userId
  );

  if (result.success && options.useCache !== false) {
    await cacheResult(queryHash, datasetId, {
      data: result.data,
      rowCount: result.rowCount,
    }, DEFAULT_CACHE_TTL_AGGREGATION);
  }

  return result;
}

export async function getSchema(datasetId: string): Promise<QueryResult> {
  const [dataset] = await db
    .select()
    .from(clientDataDatasets)
    .where(eq(clientDataDatasets.id, datasetId))
    .limit(1);

  if (!dataset) {
    return { success: false, error: "Dataset not found" };
  }

  const columns = Object.entries(dataset.columnMapping).map(([name, info]) => ({
    name,
    displayName: info.displayName,
    dataType: info.dataType,
    description: info.description,
  }));

  const metrics = await db
    .select()
    .from(clientDataMetrics)
    .where(eq(clientDataMetrics.datasetId, datasetId));

  return {
    success: true,
    data: [{
      datasetId: dataset.id,
      name: dataset.name,
      tableName: dataset.tableName,
      rowCount: dataset.rowCount,
      status: dataset.status,
      columns,
      metrics: metrics.map(m => ({
        name: m.name,
        dslFormula: m.dslFormula,
        description: m.description,
      })),
    }],
    rowCount: 1,
    executionTimeMs: 0,
  };
}

export const aiTools = {
  query_metric: {
    name: "query_metric",
    description: "Calculate a metric using DSL expression (e.g., SUM(sales), AVG(price) * COUNT(*))",
    parameters: {
      datasetId: { type: "string", required: true, description: "Dataset ID" },
      dsl: { type: "string", required: true, description: "DSL expression (e.g., SUM(amount) WHERE status = 'completed')" },
    },
    execute: async (params: { datasetId: string; dsl: string }, options?: QueryOptions) => {
      return queryMetric(params.datasetId, params.dsl, options);
    },
  },

  compare_periods: {
    name: "compare_periods",
    description: "Compare a metric between two time periods",
    parameters: {
      datasetId: { type: "string", required: true },
      dsl: { type: "string", required: true, description: "Metric DSL (e.g., SUM(revenue))" },
      dateColumn: { type: "string", required: true, description: "Date column name" },
      period1Start: { type: "string", required: true, description: "Period 1 start (YYYY-MM-DD)" },
      period1End: { type: "string", required: true, description: "Period 1 end (YYYY-MM-DD)" },
      period2Start: { type: "string", required: true, description: "Period 2 start (YYYY-MM-DD)" },
      period2End: { type: "string", required: true, description: "Period 2 end (YYYY-MM-DD)" },
    },
    execute: async (params: {
      datasetId: string;
      dsl: string;
      dateColumn: string;
      period1Start: string;
      period1End: string;
      period2Start: string;
      period2End: string;
    }, options?: QueryOptions) => {
      return comparePeriods(
        params.datasetId,
        params.dsl,
        params.dateColumn,
        { start: params.period1Start, end: params.period1End },
        { start: params.period2Start, end: params.period2End },
        options
      );
    },
  },

  filter_data: {
    name: "filter_data",
    description: "Filter and return rows matching conditions",
    parameters: {
      datasetId: { type: "string", required: true },
      filters: { type: "object", required: true, description: "Filter conditions: { column: { operator: '=', value: 'x' } }" },
      columns: { type: "array", required: false, description: "Columns to select" },
      limit: { type: "number", required: false, description: "Max rows to return (default 100)" },
    },
    execute: async (params: {
      datasetId: string;
      filters: Record<string, { operator: string; value: string | number }>;
      columns?: string[];
      limit?: number;
    }, options?: QueryOptions) => {
      return filterData(params.datasetId, params.filters, params.columns, params.limit || 100, 0, options);
    },
  },

  aggregate_group: {
    name: "aggregate_group",
    description: "Group data and calculate aggregations",
    parameters: {
      datasetId: { type: "string", required: true },
      groupBy: { type: "array", required: true, description: "Columns to group by" },
      aggregations: { type: "array", required: true, description: "Aggregations: [{ column, function, alias }]" },
      orderBy: { type: "object", required: false, description: "{ column, direction: 'ASC'|'DESC' }" },
      limit: { type: "number", required: false },
    },
    execute: async (params: {
      datasetId: string;
      groupBy: string[];
      aggregations: { column: string; function: string; alias?: string }[];
      filters?: Record<string, { operator: string; value: string | number }>;
      orderBy?: { column: string; direction: "ASC" | "DESC" };
      limit?: number;
    }, options?: QueryOptions) => {
      return aggregateGroup(
        params.datasetId,
        params.groupBy,
        params.aggregations,
        params.filters,
        params.orderBy,
        params.limit || 100,
        options
      );
    },
  },

  get_schema: {
    name: "get_schema",
    description: "Get dataset schema including columns, types, and defined metrics",
    parameters: {
      datasetId: { type: "string", required: true },
    },
    execute: async (params: { datasetId: string }) => {
      return getSchema(params.datasetId);
    },
  },
};

export type AITool = keyof typeof aiTools;
