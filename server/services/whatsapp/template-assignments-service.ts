import { db } from "../../db";
import { eq, and, isNull } from "drizzle-orm";
import {
  whatsappTemplateAssignments,
  whatsappCustomTemplates,
  whatsappTemplateVersions,
  whatsappTemplateVariables,
  whatsappVariableCatalog,
} from "../../../shared/schema";
import { resolveVariables, VariableResolutionResult } from "./variable-resolver";

/**
 * Active template result with metadata
 */
export interface ActiveTemplateResult {
  template: {
    id: string;
    templateName: string;
    templateType: "opening" | "followup_gentle" | "followup_value" | "followup_final";
    description: string | null;
  };
  activeVersion: {
    id: string;
    versionNumber: number;
    bodyText: string;
    twilioContentSid: string | null;
    twilioStatus: "not_synced" | "pending" | "approved" | "rejected" | null;
  };
  variables: Array<{
    id: string;
    variableKey: string;
    position: number;
  }>;
}

/**
 * Resolved template result
 */
export interface ResolvedTemplateResult {
  renderedText: string;
  variables: Array<{
    key: string;
    value: string;
    source: "lead" | "sample" | "default" | "fallback";
    missing: boolean;
  }>;
  warnings: Array<{
    variable: string;
    reason: string;
  }>;
}

/**
 * Fetch active template for a specific agent and template type
 * 
 * @param agentConfigId - WhatsApp agent configuration ID
 * @param templateType - Type of template (opening, followup_gentle, etc.)
 * @returns Active template with version and variables, or null if not found/archived
 */
export async function getActiveTemplateForAgent(
  agentConfigId: string,
  templateType: "opening" | "followup_gentle" | "followup_value" | "followup_final"
): Promise<ActiveTemplateResult | null> {
  try {
    // Step 1: Find assignment for this agent and type
    const assignment = await db
      .select()
      .from(whatsappTemplateAssignments)
      .where(
        and(
          eq(whatsappTemplateAssignments.agentConfigId, agentConfigId),
          eq(whatsappTemplateAssignments.templateType, templateType)
        )
      )
      .limit(1);

    if (!assignment || assignment.length === 0) {
      return null; // No assignment found
    }

    const templateId = assignment[0].templateId;

    // Step 2: Fetch template (guard against archived)
    const template = await db
      .select()
      .from(whatsappCustomTemplates)
      .where(
        and(
          eq(whatsappCustomTemplates.id, templateId),
          isNull(whatsappCustomTemplates.archivedAt) // Only active templates
        )
      )
      .limit(1);

    if (!template || template.length === 0) {
      return null; // Template not found or archived
    }

    // Step 3: Fetch active version
    const activeVersion = await db
      .select()
      .from(whatsappTemplateVersions)
      .where(
        and(
          eq(whatsappTemplateVersions.templateId, templateId),
          eq(whatsappTemplateVersions.isActive, true)
        )
      )
      .limit(1);

    if (!activeVersion || activeVersion.length === 0) {
      return null; // No active version
    }

    // Step 4: Fetch variables for this version (join with catalog to get variableKey)
    const variables = await db
      .select({
        id: whatsappTemplateVariables.id,
        variableKey: whatsappVariableCatalog.variableKey,
        position: whatsappTemplateVariables.position,
      })
      .from(whatsappTemplateVariables)
      .innerJoin(
        whatsappVariableCatalog,
        eq(whatsappTemplateVariables.variableCatalogId, whatsappVariableCatalog.id)
      )
      .where(eq(whatsappTemplateVariables.templateVersionId, activeVersion[0].id))
      .orderBy(whatsappTemplateVariables.position);

    // Return structured result
    return {
      template: {
        id: template[0].id,
        templateName: template[0].templateName,
        templateType: template[0].templateType,
        description: template[0].description,
      },
      activeVersion: {
        id: activeVersion[0].id,
        versionNumber: activeVersion[0].versionNumber,
        bodyText: activeVersion[0].bodyText,
        twilioContentSid: activeVersion[0].twilioContentSid,
        twilioStatus: activeVersion[0].twilioStatus,
      },
      variables: variables.map(v => ({
        id: v.id,
        variableKey: v.variableKey,
        position: v.position,
      })),
    };
  } catch (error) {
    console.error(`[TEMPLATE SERVICE] Error fetching template for agent ${agentConfigId}:`, error);
    return null; // Return null on error to allow fallback
  }
}

/**
 * Resolve template variables for a specific lead
 * Uses the existing variable-resolver to populate template with lead data
 * 
 * @param templateVersionId - Template version ID
 * @param consultantId - Consultant ID who owns the template
 * @param leadId - Lead ID for data resolution
 * @returns Rendered template with resolved variables
 */
export async function resolveActiveTemplateForLead(
  templateVersionId: string,
  consultantId: string,
  leadId: string
): Promise<ResolvedTemplateResult> {
  try {
    // Use existing variable-resolver with mode "lead"
    // Note: The actual signature uses an options object
    const result = await resolveVariables(templateVersionId, {
      mode: "lead",
      leadId,
      consultantId,
    });

    // Return structured result
    return {
      renderedText: result.renderedText,
      variables: result.variables,
      warnings: result.warnings,
    };
  } catch (error) {
    console.error(`[TEMPLATE SERVICE] Error resolving template ${templateVersionId}:`, error);
    throw error; // Re-throw to let caller handle
  }
}

// Export types and functions
export type {
  ActiveTemplateResult,
  ResolvedTemplateResult,
};
