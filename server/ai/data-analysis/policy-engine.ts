/**
 * Policy Engine for Data Analysis
 * 
 * Pure TypeScript - NO AI calls
 * Gate keeper for tool access based on intent classification
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
}

const ALL_COMPUTE_TOOLS = ["execute_metric", "aggregate_group", "compare_periods", "query_metric"];
const ALL_TOOLS = [...ALL_COMPUTE_TOOLS, "filter_data", "get_schema"];

export const POLICY_RULES: Record<IntentType, PolicyRule> = {
  analytics: {
    intent: "analytics",
    allowedTools: ["execute_metric", "aggregate_group", "compare_periods", "filter_data"],
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
    blockedTools: ALL_COMPUTE_TOOLS,
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

  console.log(`[POLICY-ENGINE] Result: allowed=${allowed.length}, blocked=${blocked.length}, violations=${violations.length}`);

  return { allowed, blocked, violations };
}
