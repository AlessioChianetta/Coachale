/**
 * Policy Engine for Data Analysis
 * 
 * Pure TypeScript - NO AI calls
 * Gate keeper for tool access based on intent classification
 * 
 * TOOL CATEGORIES:
 * - COMPUTE_TOOLS: Execute calculations and return numbers (execute_metric, aggregate_group, etc.)
 * - METADATA_TOOLS: Explore schema/structure, no data returned (get_schema)
 * - DATA_TOOLS: Filter/preview data without computation (filter_data)
 * 
 * RULE: For analytics with requires_metrics=true:
 * - get_schema CAN precede compute tools (for validation)
 * - get_schema CANNOT be the ONLY tool (must have at least one compute tool)
 */

import type { ToolCall } from "./tool-definitions";

export type IntentType = "analytics" | "strategy" | "data_preview" | "conversational";

export interface PolicyRule {
  intent: IntentType;
  allowedTools: string[];
  blockedTools: string[];
  blockNumericGeneration: boolean;
  requireToolCall: boolean;
}

export interface PolicyEnforcementResult {
  allowed: ToolCall[];
  blocked: ToolCall[];
  violations: string[];
  requiresComputeTool?: boolean;
}

export const COMPUTE_TOOLS = ["execute_metric", "aggregate_group", "compare_periods", "query_metric"];
export const METADATA_TOOLS = ["get_schema"];
export const DATA_TOOLS = ["filter_data"];
const ALL_TOOLS = [...COMPUTE_TOOLS, ...METADATA_TOOLS, ...DATA_TOOLS];

export const POLICY_RULES: Record<IntentType, PolicyRule> = {
  analytics: {
    intent: "analytics",
    allowedTools: ["execute_metric", "aggregate_group", "compare_periods", "filter_data", "get_schema"],
    blockedTools: [],
    blockNumericGeneration: true,
    requireToolCall: true,
  },
  strategy: {
    intent: "strategy",
    allowedTools: [],
    blockedTools: ALL_TOOLS,
    blockNumericGeneration: true,
    requireToolCall: false,
  },
  data_preview: {
    intent: "data_preview",
    allowedTools: ["filter_data", "get_schema"],
    blockedTools: COMPUTE_TOOLS,
    blockNumericGeneration: true,
    requireToolCall: true,
  },
  conversational: {
    intent: "conversational",
    allowedTools: [],
    blockedTools: ALL_TOOLS,
    blockNumericGeneration: false,
    requireToolCall: false,
  },
};

/**
 * Get policy rules for a given intent
 */
export function getPolicyForIntent(intent: IntentType): PolicyRule {
  const policy = POLICY_RULES[intent];
  console.log(`[POLICY-ENGINE] Getting policy for intent: ${intent}`);
  return policy;
}

/**
 * Enforce policy rules on tool calls
 * Filters tool calls based on allowed/blocked lists for the given intent
 */
export function enforcePolicyOnToolCalls(
  intent: IntentType,
  toolCalls: ToolCall[]
): PolicyEnforcementResult {
  const policy = POLICY_RULES[intent];
  const allowed: ToolCall[] = [];
  const blocked: ToolCall[] = [];
  const violations: string[] = [];

  console.log(`[POLICY-ENGINE] Enforcing policy for intent: ${intent}, tool calls: ${toolCalls.length}`);

  for (const call of toolCalls) {
    if (policy.blockedTools.includes(call.name)) {
      blocked.push(call);
      violations.push(`Tool "${call.name}" non consentito per intent "${intent}"`);
      console.log(`[POLICY-ENGINE] BLOCKED: ${call.name} (in blockedTools)`);
    } else if (policy.allowedTools.length === 0) {
      blocked.push(call);
      violations.push(`Nessun tool consentito per intent "${intent}"`);
      console.log(`[POLICY-ENGINE] BLOCKED: ${call.name} (no tools allowed for ${intent})`);
    } else if (policy.allowedTools.includes(call.name)) {
      allowed.push(call);
      console.log(`[POLICY-ENGINE] ALLOWED: ${call.name}`);
    } else {
      blocked.push(call);
      violations.push(`Tool "${call.name}" non nella lista consentita per intent "${intent}"`);
      console.log(`[POLICY-ENGINE] BLOCKED: ${call.name} (not in allowedTools)`);
    }
  }

  const hasComputeTool = allowed.some(call => COMPUTE_TOOLS.includes(call.name));
  const hasOnlyMetadata = allowed.length > 0 && allowed.every(call => METADATA_TOOLS.includes(call.name));
  
  console.log(`[POLICY-ENGINE] Result: allowed=${allowed.length}, blocked=${blocked.length}, violations=${violations.length}`);
  console.log(`[POLICY-ENGINE] Tool analysis: hasComputeTool=${hasComputeTool}, hasOnlyMetadata=${hasOnlyMetadata}`);

  return { 
    allowed, 
    blocked, 
    violations,
    requiresComputeTool: intent === "analytics" && hasOnlyMetadata
  };
}

/**
 * Validate that analytics intent with requires_metrics=true has at least one compute tool
 * 
 * RULE: get_schema can PRECEDE compute tools, but cannot SUBSTITUTE them
 * If requires_metrics=true and only metadata tools are called, we need to re-plan
 */
export function validateAnalyticsToolCalls(
  toolCalls: ToolCall[],
  requiresMetrics: boolean
): { valid: boolean; reason?: string } {
  if (!requiresMetrics) {
    return { valid: true };
  }
  
  const hasComputeTool = toolCalls.some(call => COMPUTE_TOOLS.includes(call.name));
  const hasOnlyMetadata = toolCalls.length > 0 && toolCalls.every(call => METADATA_TOOLS.includes(call.name));
  const hasOnlyMetadataOrData = toolCalls.length > 0 && toolCalls.every(call => 
    METADATA_TOOLS.includes(call.name) || DATA_TOOLS.includes(call.name)
  );
  
  // RULE: requires_metrics=true means we MUST have at least one compute tool
  // filter_data (DATA_TOOLS) does NOT satisfy this - it only previews data, doesn't compute metrics
  if (hasOnlyMetadata) {
    console.log(`[POLICY-ENGINE] VALIDATION FAILED: requires_metrics=true but only metadata tools called`);
    return { 
      valid: false, 
      reason: "La domanda richiede metriche calcolate, ma sono stati chiamati solo tool di metadata (get_schema). Usa execute_metric o aggregate_group per calcolare i dati richiesti."
    };
  }
  
  if (hasOnlyMetadataOrData && !hasComputeTool) {
    console.log(`[POLICY-ENGINE] VALIDATION FAILED: requires_metrics=true but no compute tools (only metadata/data preview)`);
    return { 
      valid: false, 
      reason: "La domanda richiede metriche calcolate, ma sono stati usati solo tool di anteprima dati. Usa execute_metric o aggregate_group per i calcoli."
    };
  }
  
  if (hasComputeTool) {
    console.log(`[POLICY-ENGINE] VALIDATION OK: compute tool present`);
    return { valid: true };
  }
  
  console.log(`[POLICY-ENGINE] VALIDATION WARNING: no compute tools, but mixed tool types`);
  return { valid: true };
}
