/**
 * Query Engine Rules
 * Implements the 7 semantic rules for automatic query enhancement
 * 
 * RULE 1: Revenue Priority (already implemented in semantic-resolver)
 * RULE 2: Document Type Filter - auto-inject WHERE document_type='sale' for revenue metrics
 * RULE 3: Sales Channel Default - default to ALL channels if not specified
 * RULE 4: Time Slot Resolver - calculate from order_date hour if time_slot not present
 * RULE 5: Category Semantic (already implemented)
 * RULE 6: ORDER BY Semantic - map keywords to appropriate ordering
 * RULE 7: Safe Divisions with NULLIF (already implemented)
 */

import { getColumnMappingsForDataset, ColumnMappingLookup } from "./semantic-resolver";

export interface QueryEnhancement {
  additionalWhereClause?: string;
  orderByClause?: string;
  selectAdjustments?: string[];
  appliedRules: string[];
  warnings?: string[];
}

const REVENUE_METRICS = [
  "revenue", "fatturato", "gross_margin", "margine", "margin",
  "food_cost", "profit", "profitto", "utile", "incasso"
];

const TIME_SLOT_HOURS: Record<string, { start: number; end: number }> = {
  breakfast: { start: 6, end: 11 },
  lunch: { start: 11, end: 15 },
  dinner: { start: 18, end: 23 },
  late: { start: 23, end: 4 },
};

const ORDER_BY_KEYWORDS: Record<string, { column: string; direction: "ASC" | "DESC" }> = {
  "profittevoli": { column: "gross_margin", direction: "DESC" },
  "più profittevoli": { column: "gross_margin", direction: "DESC" },
  "meno profittevoli": { column: "gross_margin", direction: "ASC" },
  "più venduti": { column: "quantity", direction: "DESC" },
  "più venduto": { column: "quantity", direction: "DESC" },
  "venduti": { column: "quantity", direction: "DESC" },
  "meno venduti": { column: "quantity", direction: "ASC" },
  "fatturato": { column: "revenue", direction: "DESC" },
  "ricavi": { column: "revenue", direction: "DESC" },
  "più cari": { column: "avg_unit_price", direction: "DESC" },
  "più costosi": { column: "avg_unit_price", direction: "DESC" },
  "più economici": { column: "avg_unit_price", direction: "ASC" },
  "meno cari": { column: "avg_unit_price", direction: "ASC" },
  "recenti": { column: "order_date", direction: "DESC" },
  "più recenti": { column: "order_date", direction: "DESC" },
  "più vecchi": { column: "order_date", direction: "ASC" },
};

const SALES_CHANNEL_VALUES = ["dine_in", "takeaway", "delivery"];
const DOCUMENT_TYPE_VALUES = ["sale", "refund", "void", "staff_meal"];

export function isRevenueMetric(metricName: string): boolean {
  const lowerName = metricName.toLowerCase();
  return REVENUE_METRICS.some(rm => lowerName.includes(rm));
}

export function detectOrderByFromQuestion(question: string): { column: string; direction: "ASC" | "DESC" } | null {
  const lowerQuestion = question.toLowerCase();
  
  for (const [keyword, order] of Object.entries(ORDER_BY_KEYWORDS)) {
    if (lowerQuestion.includes(keyword)) {
      console.log(`[QUERY-RULES] Detected ORDER BY keyword: "${keyword}" → ${order.column} ${order.direction}`);
      return order;
    }
  }
  
  return null;
}

export function buildTimeSlotCondition(
  orderDateColumn: string,
  timeSlot: string
): string {
  const slot = TIME_SLOT_HOURS[timeSlot.toLowerCase()];
  if (!slot) {
    return "";
  }
  
  if (slot.start < slot.end) {
    return `EXTRACT(hour FROM "${orderDateColumn}") >= ${slot.start} AND EXTRACT(hour FROM "${orderDateColumn}") < ${slot.end}`;
  } else {
    return `(EXTRACT(hour FROM "${orderDateColumn}") >= ${slot.start} OR EXTRACT(hour FROM "${orderDateColumn}") < ${slot.end})`;
  }
}

export function buildCalculatedTimeSlot(orderDateColumn: string): string {
  return `
    CASE 
      WHEN EXTRACT(hour FROM "${orderDateColumn}") >= 6 AND EXTRACT(hour FROM "${orderDateColumn}") < 11 THEN 'breakfast'
      WHEN EXTRACT(hour FROM "${orderDateColumn}") >= 11 AND EXTRACT(hour FROM "${orderDateColumn}") < 15 THEN 'lunch'
      WHEN EXTRACT(hour FROM "${orderDateColumn}") >= 18 AND EXTRACT(hour FROM "${orderDateColumn}") < 23 THEN 'dinner'
      ELSE 'late'
    END
  `.trim().replace(/\s+/g, " ");
}

export async function applyQueryEnhancements(
  datasetId: number,
  metricName: string,
  userQuestion: string,
  existingFilters?: { column: string; value: string }[]
): Promise<QueryEnhancement> {
  const mappings = await getColumnMappingsForDataset(datasetId);
  const appliedRules: string[] = [];
  const warnings: string[] = [];
  const additionalConditions: string[] = [];
  let orderByClause: string | undefined;
  const selectAdjustments: string[] = [];

  const hasDocumentTypeColumn = !!mappings["document_type"];
  const hasDocumentTypeFilter = existingFilters?.some(f => 
    f.column === "document_type" || f.column === mappings["document_type"]
  );

  if (isRevenueMetric(metricName) && hasDocumentTypeColumn && !hasDocumentTypeFilter) {
    const physicalColumn = mappings["document_type"];
    additionalConditions.push(`"${physicalColumn}" = 'sale'`);
    appliedRules.push("RULE_2_DOCUMENT_TYPE_FILTER");
    console.log(`[QUERY-RULES] Rule 2: Injecting document_type='sale' filter for metric "${metricName}"`);
  }

  const hasTimeSlotColumn = !!mappings["time_slot"];
  const orderDateColumn = mappings["order_date"];
  const timeSlotFilter = existingFilters?.find(f => 
    f.column === "time_slot" || f.column === mappings["time_slot"]
  );

  if (timeSlotFilter && !hasTimeSlotColumn && orderDateColumn) {
    const timeSlotValue = timeSlotFilter.value.toLowerCase();
    if (TIME_SLOT_HOURS[timeSlotValue]) {
      const condition = buildTimeSlotCondition(orderDateColumn, timeSlotValue);
      if (condition) {
        additionalConditions.push(condition);
        appliedRules.push("RULE_4_TIME_SLOT_FROM_ORDER_DATE");
        console.log(`[QUERY-RULES] Rule 4: Calculating time_slot=${timeSlotValue} from order_date hour`);
      }
    }
  }

  const orderBy = detectOrderByFromQuestion(userQuestion);
  if (orderBy) {
    const metricToColumn: Record<string, string> = {
      gross_margin: "gross_margin",
      quantity: mappings["quantity"] || "quantity",
      revenue: mappings["revenue_amount"] || "revenue",
      avg_unit_price: mappings["price"] || "price",
      order_date: mappings["order_date"] || "order_date",
    };

    const columnName = metricToColumn[orderBy.column] || orderBy.column;
    orderByClause = `"${columnName}" ${orderBy.direction}`;
    appliedRules.push("RULE_6_ORDER_BY_SEMANTIC");
    console.log(`[QUERY-RULES] Rule 6: Applying ORDER BY ${columnName} ${orderBy.direction}`);
  }

  const hasSalesChannelColumn = !!mappings["sales_channel"];
  const salesChannelFilter = existingFilters?.find(f => 
    f.column === "sales_channel" || f.column === mappings["sales_channel"]
  );

  if (hasSalesChannelColumn && !salesChannelFilter) {
    appliedRules.push("RULE_3_SALES_CHANNEL_ALL");
    console.log(`[QUERY-RULES] Rule 3: No sales_channel filter specified, including all channels`);
  }

  return {
    additionalWhereClause: additionalConditions.length > 0 
      ? additionalConditions.join(" AND ") 
      : undefined,
    orderByClause,
    selectAdjustments,
    appliedRules,
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}

export function injectWhereClause(
  originalSql: string,
  additionalWhere: string
): string {
  const upperSql = originalSql.toUpperCase();
  const groupByIndex = upperSql.indexOf("GROUP BY");
  const orderByIndex = upperSql.indexOf("ORDER BY");
  const limitIndex = upperSql.indexOf("LIMIT");
  
  let insertPosition = originalSql.length;
  if (groupByIndex > -1) insertPosition = Math.min(insertPosition, groupByIndex);
  if (orderByIndex > -1) insertPosition = Math.min(insertPosition, orderByIndex);
  if (limitIndex > -1) insertPosition = Math.min(insertPosition, limitIndex);

  const beforeInsert = originalSql.substring(0, insertPosition).trim();
  const afterInsert = originalSql.substring(insertPosition);

  const hasWhere = upperSql.includes("WHERE");

  if (hasWhere) {
    const whereIndex = upperSql.indexOf("WHERE");
    const afterWhere = beforeInsert.substring(whereIndex + 5);
    const beforeWhere = beforeInsert.substring(0, whereIndex + 5);
    return `${beforeWhere} (${afterWhere.trim()}) AND ${additionalWhere} ${afterInsert}`.trim();
  } else {
    return `${beforeInsert} WHERE ${additionalWhere} ${afterInsert}`.trim();
  }
}

export function injectOrderByClause(
  originalSql: string,
  orderByClause: string
): string {
  const upperSql = originalSql.toUpperCase();
  
  if (upperSql.includes("ORDER BY")) {
    return originalSql;
  }

  const limitIndex = upperSql.indexOf("LIMIT");
  if (limitIndex > -1) {
    const beforeLimit = originalSql.substring(0, limitIndex);
    const afterLimit = originalSql.substring(limitIndex);
    return `${beforeLimit.trim()} ORDER BY ${orderByClause} ${afterLimit}`.trim();
  }

  return `${originalSql.trim()} ORDER BY ${orderByClause}`;
}

export function enhanceSqlWithRules(
  originalSql: string,
  enhancement: QueryEnhancement
): string {
  let sql = originalSql;

  if (enhancement.additionalWhereClause) {
    sql = injectWhereClause(sql, enhancement.additionalWhereClause);
  }

  if (enhancement.orderByClause) {
    sql = injectOrderByClause(sql, enhancement.orderByClause);
  }

  return sql;
}

export { TIME_SLOT_HOURS, ORDER_BY_KEYWORDS, SALES_CHANNEL_VALUES, DOCUMENT_TYPE_VALUES };
