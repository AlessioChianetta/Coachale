import { db } from "../../db";
import { datasetColumnSemantics, clientDataDatasets, customMappingRules, CRITICAL_ROLES, type SemanticLogicalRole, type SemanticMappingStatus } from "../../../shared/schema";
import { eq, and, sql, desc } from "drizzle-orm";
import { autoDetectAllColumns, getLogicalColumnDisplayName } from "../../ai/data-analysis/logical-columns";

export interface SemanticMapping {
  id: number;
  physicalColumn: string;
  logicalRole: SemanticLogicalRole;
  confidence: number;
  status: SemanticMappingStatus;
  autoApproved: boolean;
  isCritical: boolean;
  displayName: string;
}

export interface SemanticMappingResult {
  datasetId: number;
  analyticsEnabled: boolean;
  mappings: SemanticMapping[];
  pendingCritical: string[];
  missingRequired: string[];
}

const AUTO_APPROVE_THRESHOLD = 0.90;
const MIN_CONFIDENCE_THRESHOLD = 0.70;

interface CustomRule {
  columnPattern: string;
  logicalRole: string;
  matchType: "exact" | "contains" | "startswith" | "endswith";
  caseSensitive: boolean;
  priority: number;
}

function matchColumnWithRule(columnName: string, rule: CustomRule): boolean {
  const col = rule.caseSensitive ? columnName : columnName.toLowerCase();
  const pattern = rule.caseSensitive ? rule.columnPattern : rule.columnPattern.toLowerCase();
  
  switch (rule.matchType) {
    case "exact":
      return col === pattern;
    case "contains":
      return col.includes(pattern);
    case "startswith":
      return col.startsWith(pattern);
    case "endswith":
      return col.endsWith(pattern);
    default:
      return col.includes(pattern);
  }
}

async function applyCustomRules(
  consultantId: string,
  physicalColumns: string[]
): Promise<Map<string, { logicalRole: SemanticLogicalRole; confidence: number }>> {
  const customMatches = new Map<string, { logicalRole: SemanticLogicalRole; confidence: number }>();
  
  try {
    const rules = await db
      .select()
      .from(customMappingRules)
      .where(eq(customMappingRules.consultantId, consultantId))
      .orderBy(desc(customMappingRules.priority));
    
    if (rules.length === 0) {
      return customMatches;
    }
    
    console.log(`[SEMANTIC] Applying ${rules.length} custom mapping rules for consultant ${consultantId}`);
    
    for (const col of physicalColumns) {
      for (const rule of rules) {
        if (matchColumnWithRule(col, rule as CustomRule)) {
          customMatches.set(col, {
            logicalRole: rule.logicalRole as SemanticLogicalRole,
            confidence: 0.98,
          });
          console.log(`[SEMANTIC] Custom rule matched: "${col}" -> ${rule.logicalRole} (pattern: "${rule.columnPattern}")`);
          break;
        }
      }
    }
  } catch (error) {
    console.warn("[SEMANTIC] Error applying custom rules:", error);
  }
  
  return customMatches;
}

export async function detectAndSaveSemanticMappings(
  datasetId: number,
  physicalColumns: string[]
): Promise<SemanticMappingResult> {
  console.log(`[SEMANTIC] Auto-detecting mappings for dataset ${datasetId} with ${physicalColumns.length} columns`);

  const [dataset] = await db
    .select({ consultantId: clientDataDatasets.consultantId })
    .from(clientDataDatasets)
    .where(eq(clientDataDatasets.id, datasetId))
    .limit(1);

  const customMatches = dataset?.consultantId 
    ? await applyCustomRules(dataset.consultantId, physicalColumns)
    : new Map<string, { logicalRole: SemanticLogicalRole; confidence: number }>();

  const columnsForAutoDetect = physicalColumns.filter(col => !customMatches.has(col));
  const detectedMappings = autoDetectAllColumns(columnsForAutoDetect);
  
  for (const [col, match] of customMatches.entries()) {
    detectedMappings.set(col, {
      logicalColumn: match.logicalRole,
      confidence: match.confidence,
      patternMatched: "custom_rule",
    });
  }

  const mappingsToInsert: Array<{
    datasetId: number;
    physicalColumn: string;
    logicalRole: SemanticLogicalRole;
    confidence: string;
    status: SemanticMappingStatus;
    autoApproved: boolean;
  }> = [];

  for (const [physical, detection] of detectedMappings.entries()) {
    if (detection.confidence < MIN_CONFIDENCE_THRESHOLD) {
      console.log(`[SEMANTIC] Skipping ${physical} - confidence ${detection.confidence} below threshold ${MIN_CONFIDENCE_THRESHOLD}`);
      continue;
    }

    const logicalRole = detection.logicalColumn as SemanticLogicalRole;
    const isCritical = CRITICAL_ROLES.includes(logicalRole);
    // Auto-approve if confidence >= 0.90 for non-critical, or >= 0.95 for critical (exact match)
    const canAutoApprove = detection.confidence >= AUTO_APPROVE_THRESHOLD && 
      (!isCritical || detection.confidence >= 0.95);

    mappingsToInsert.push({
      datasetId,
      physicalColumn: physical,
      logicalRole,
      confidence: detection.confidence.toFixed(2),
      status: canAutoApprove ? "confirmed" : "pending",
      autoApproved: canAutoApprove,
    });
  }

  if (mappingsToInsert.length > 0) {
    await db
      .insert(datasetColumnSemantics)
      .values(mappingsToInsert)
      .onConflictDoNothing();
  }

  const savedMappings = await db
    .select()
    .from(datasetColumnSemantics)
    .where(eq(datasetColumnSemantics.datasetId, datasetId));

  const mappings: SemanticMapping[] = savedMappings.map((m) => ({
    id: m.id,
    physicalColumn: m.physicalColumn,
    logicalRole: m.logicalRole as SemanticLogicalRole,
    confidence: parseFloat(m.confidence || "0"),
    status: m.status as SemanticMappingStatus,
    autoApproved: m.autoApproved,
    isCritical: CRITICAL_ROLES.includes(m.logicalRole as SemanticLogicalRole),
    displayName: getLogicalColumnDisplayName(m.logicalRole, "it"),
  }));

  const pendingCritical = mappings
    .filter((m) => m.isCritical && m.status === "pending")
    .map((m) => m.logicalRole);

  const analyticsEnabled = pendingCritical.length === 0;

  if (analyticsEnabled) {
    await db
      .update(clientDataDatasets)
      .set({ analyticsEnabled: true, updatedAt: new Date() })
      .where(eq(clientDataDatasets.id, datasetId));
  }

  console.log(`[SEMANTIC] Dataset ${datasetId}: ${mappings.length} mappings, ${pendingCritical.length} pending critical, analytics=${analyticsEnabled}`);

  return {
    datasetId,
    analyticsEnabled,
    mappings,
    pendingCritical,
    missingRequired: [],
  };
}

export async function getSemanticMappings(datasetId: number): Promise<SemanticMappingResult> {
  const [dataset] = await db
    .select()
    .from(clientDataDatasets)
    .where(eq(clientDataDatasets.id, datasetId))
    .limit(1);

  if (!dataset) {
    throw new Error(`Dataset ${datasetId} not found`);
  }

  const savedMappings = await db
    .select()
    .from(datasetColumnSemantics)
    .where(eq(datasetColumnSemantics.datasetId, datasetId));

  const mappings: SemanticMapping[] = savedMappings.map((m) => ({
    id: m.id,
    physicalColumn: m.physicalColumn,
    logicalRole: m.logicalRole as SemanticLogicalRole,
    confidence: parseFloat(m.confidence || "0"),
    status: m.status as SemanticMappingStatus,
    autoApproved: m.autoApproved,
    isCritical: CRITICAL_ROLES.includes(m.logicalRole as SemanticLogicalRole),
    displayName: getLogicalColumnDisplayName(m.logicalRole, "it"),
  }));

  const pendingCritical = mappings
    .filter((m) => m.isCritical && m.status === "pending")
    .map((m) => m.logicalRole);

  return {
    datasetId,
    analyticsEnabled: dataset.analyticsEnabled ?? false,
    mappings,
    pendingCritical,
    missingRequired: [],
  };
}

export async function confirmSemanticMappings(
  datasetId: number,
  confirmations: Array<{ physicalColumn: string; logicalRole?: SemanticLogicalRole }>,
  userId: string
): Promise<{ confirmed: number; analyticsEnabled: boolean }> {
  let confirmed = 0;
  const now = new Date();

  for (const conf of confirmations) {
    // Check if the mapping already exists
    const [existing] = await db
      .select()
      .from(datasetColumnSemantics)
      .where(
        and(
          eq(datasetColumnSemantics.datasetId, datasetId),
          eq(datasetColumnSemantics.physicalColumn, conf.physicalColumn)
        )
      )
      .limit(1);

    if (existing) {
      // Update existing mapping
      await db
        .update(datasetColumnSemantics)
        .set({
          status: "confirmed",
          confirmedByUserId: userId,
          confirmedAt: now,
          updatedAt: now,
          ...(conf.logicalRole && { logicalRole: conf.logicalRole }),
        })
        .where(
          and(
            eq(datasetColumnSemantics.datasetId, datasetId),
            eq(datasetColumnSemantics.physicalColumn, conf.physicalColumn)
          )
        );
    } else if (conf.logicalRole) {
      // Insert new mapping for previously unmapped columns
      const displayName = getLogicalColumnDisplayName(conf.logicalRole);
      const isCritical = CRITICAL_ROLES.includes(conf.logicalRole as any);
      
      await db.insert(datasetColumnSemantics).values({
        datasetId,
        physicalColumn: conf.physicalColumn,
        logicalRole: conf.logicalRole,
        confidence: 1.0, // User-confirmed, 100% confidence
        status: "confirmed",
        autoApproved: false,
        isCritical,
        displayName,
        confirmedByUserId: userId,
        confirmedAt: now,
        createdAt: now,
        updatedAt: now,
      });
    }
    confirmed++;
  }

  const pendingCritical = await db
    .select()
    .from(datasetColumnSemantics)
    .where(
      and(
        eq(datasetColumnSemantics.datasetId, datasetId),
        eq(datasetColumnSemantics.status, "pending"),
        sql`${datasetColumnSemantics.logicalRole} IN ('price', 'cost', 'quantity', 'order_date')`
      )
    );

  const analyticsEnabled = pendingCritical.length === 0;

  if (analyticsEnabled) {
    await db
      .update(clientDataDatasets)
      .set({ analyticsEnabled: true, updatedAt: new Date() })
      .where(eq(clientDataDatasets.id, datasetId));
  }

  console.log(`[SEMANTIC] Confirmed ${confirmed} mappings for dataset ${datasetId}, analytics=${analyticsEnabled}`);

  return { confirmed, analyticsEnabled };
}

export async function rejectSemanticMapping(
  datasetId: number,
  physicalColumn: string,
  userId: string
): Promise<void> {
  await db
    .update(datasetColumnSemantics)
    .set({
      status: "rejected",
      confirmedByUserId: userId,
      confirmedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(datasetColumnSemantics.datasetId, datasetId),
        eq(datasetColumnSemantics.physicalColumn, physicalColumn)
      )
    );

  await db
    .update(clientDataDatasets)
    .set({ analyticsEnabled: false, updatedAt: new Date() })
    .where(eq(clientDataDatasets.id, datasetId));
}

export async function checkAnalyticsEnabled(datasetId: number): Promise<{
  enabled: boolean;
  pendingColumns?: string[];
  missingCritical?: string[];
  message?: string;
}> {
  const [dataset] = await db
    .select()
    .from(clientDataDatasets)
    .where(eq(clientDataDatasets.id, datasetId))
    .limit(1);

  if (!dataset) {
    return { enabled: false, message: "Dataset non trovato" };
  }

  if (dataset.analyticsEnabled) {
    return { enabled: true };
  }

  const confirmedMappings = await db
    .select()
    .from(datasetColumnSemantics)
    .where(
      and(
        eq(datasetColumnSemantics.datasetId, datasetId),
        eq(datasetColumnSemantics.status, "confirmed")
      )
    );

  const confirmedRoles = new Set(confirmedMappings.map((m) => m.logicalRole));

  const REQUIRED_CRITICAL_ROLES: SemanticLogicalRole[] = ["price", "quantity"];
  const missingCritical = REQUIRED_CRITICAL_ROLES.filter((role) => !confirmedRoles.has(role));

  const pendingMappings = await db
    .select()
    .from(datasetColumnSemantics)
    .where(
      and(
        eq(datasetColumnSemantics.datasetId, datasetId),
        eq(datasetColumnSemantics.status, "pending"),
        sql`${datasetColumnSemantics.logicalRole} IN ('price', 'cost', 'quantity', 'order_date')`
      )
    );

  const pendingRoles = pendingMappings.map((m) =>
    getLogicalColumnDisplayName(m.logicalRole, "it")
  );

  if (missingCritical.length > 0) {
    const missingNames = missingCritical.map((r) => getLogicalColumnDisplayName(r, "it"));
    return {
      enabled: false,
      missingCritical: missingNames,
      pendingColumns: pendingRoles,
      message: `Colonne critiche mancanti: ${missingNames.join(", ")}. Carica un dataset con queste colonne.`,
    };
  }

  if (pendingRoles.length > 0) {
    return {
      enabled: false,
      pendingColumns: pendingRoles,
      message: `Per analizzare questo dataset, conferma prima il mapping delle colonne chiave: ${pendingRoles.join(", ")}`,
    };
  }

  return { enabled: false, message: "Analytics non abilitato per questo dataset." };
}

export async function resolvePhysicalColumn(
  datasetId: number,
  logicalRole: SemanticLogicalRole
): Promise<string | null> {
  const [mapping] = await db
    .select()
    .from(datasetColumnSemantics)
    .where(
      and(
        eq(datasetColumnSemantics.datasetId, datasetId),
        eq(datasetColumnSemantics.logicalRole, logicalRole),
        eq(datasetColumnSemantics.status, "confirmed")
      )
    )
    .limit(1);

  return mapping?.physicalColumn || null;
}

export async function resolveAllPhysicalColumns(
  datasetId: number
): Promise<Map<SemanticLogicalRole, string>> {
  const mappings = await db
    .select()
    .from(datasetColumnSemantics)
    .where(
      and(
        eq(datasetColumnSemantics.datasetId, datasetId),
        eq(datasetColumnSemantics.status, "confirmed")
      )
    );

  const result = new Map<SemanticLogicalRole, string>();
  for (const m of mappings) {
    result.set(m.logicalRole as SemanticLogicalRole, m.physicalColumn);
  }

  return result;
}
