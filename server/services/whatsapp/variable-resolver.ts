import { db } from "../../db";
import { 
  whatsappTemplateVersions,
  whatsappTemplateVariables,
  whatsappVariableCatalog,
  whatsappTemplateSamples,
  proactiveLeads,
  users,
  consultantWhatsappConfig,
} from "../../../shared/schema";
import { eq, and } from "drizzle-orm";

/**
 * Resolved variable with metadata
 */
export interface ResolvedVariable {
  key: string;
  value: string;
  source: "lead" | "sample" | "default" | "fallback";
  missing: boolean;
  catalogEntry?: {
    variableName: string;
    description: string;
    sourceType: string;
    sourcePath: string;
  };
}

/**
 * Warning about variable resolution
 */
export interface VariableWarning {
  variable: string;
  reason: string;
}

/**
 * Result of variable resolution
 */
export interface VariableResolutionResult {
  renderedText: string;
  variables: ResolvedVariable[];
  warnings: VariableWarning[];
}

/**
 * Resolve a single variable from source data
 */
function resolveFromPath(
  sourceData: any,
  sourcePath: string,
  fallbackSourcePath?: string | null,
  fallbackValue?: string | null
): { value: string | null; usedFallback: boolean } {
  // Try primary path
  const pathParts = sourcePath.split(".");
  let value: any = sourceData;
  
  for (const part of pathParts) {
    if (value && typeof value === "object" && part in value) {
      value = value[part];
    } else {
      value = null;
      break;
    }
  }

  if (value !== null && value !== undefined && value !== "") {
    return { value: String(value), usedFallback: false };
  }

  // Try fallback path if available
  if (fallbackSourcePath) {
    const fallbackParts = fallbackSourcePath.split(".");
    let fallbackVal: any = sourceData;
    
    for (const part of fallbackParts) {
      if (fallbackVal && typeof fallbackVal === "object" && part in fallbackVal) {
        fallbackVal = fallbackVal[part];
      } else {
        fallbackVal = null;
        break;
      }
    }

    if (fallbackVal !== null && fallbackVal !== undefined && fallbackVal !== "") {
      return { value: String(fallbackVal), usedFallback: true };
    }
  }

  // Use static fallback if available
  if (fallbackValue) {
    return { value: fallbackValue, usedFallback: true };
  }

  return { value: null, usedFallback: false };
}

/**
 * Load sample data for variable resolution
 */
async function loadSampleData(
  consultantId: string,
  sampleId?: string
): Promise<Record<string, string>> {
  let sample;

  if (sampleId) {
    // Load specific sample
    const samples = await db
      .select()
      .from(whatsappTemplateSamples)
      .where(
        and(
          eq(whatsappTemplateSamples.id, sampleId),
          eq(whatsappTemplateSamples.consultantId, consultantId)
        )
      )
      .limit(1);

    sample = samples[0];
  } else {
    // Load default sample for consultant
    const samples = await db
      .select()
      .from(whatsappTemplateSamples)
      .where(
        and(
          eq(whatsappTemplateSamples.consultantId, consultantId),
          eq(whatsappTemplateSamples.isDefault, true)
        )
      )
      .limit(1);

    sample = samples[0];
  }

  if (!sample) {
    return {};
  }

  return sample.sampleData as Record<string, string>;
}

/**
 * Load lead data for variable resolution
 */
async function loadLeadData(leadId: string, consultantId: string) {
  const leads = await db
    .select()
    .from(proactiveLeads)
    .where(
      and(
        eq(proactiveLeads.id, leadId),
        eq(proactiveLeads.consultantId, consultantId)
      )
    )
    .limit(1);

  const lead = leads[0];
  if (!lead) {
    return null;
  }

  // Also load consultant data
  const consultants = await db
    .select()
    .from(users)
    .where(eq(users.id, consultantId))
    .limit(1);

  const consultant = consultants[0];

  // Load agent config if available
  let agentConfig = null;
  if (lead.agentConfigId) {
    const configs = await db
      .select()
      .from(consultantWhatsappConfig)
      .where(eq(consultantWhatsappConfig.id, lead.agentConfigId))
      .limit(1);
    
    agentConfig = configs[0];
  }

  return {
    lead,
    consultant,
    agentConfig,
  };
}

/**
 * Resolve variables for a template version
 * 
 * @param templateVersionId - The template version ID
 * @param options - Resolution options
 * @returns Resolved variables and rendered text
 */
export async function resolveVariables(
  templateVersionId: string,
  options: {
    mode: "sample" | "lead";
    leadId?: string;
    sampleId?: string;
    consultantId: string;
  }
): Promise<VariableResolutionResult> {
  const warnings: VariableWarning[] = [];

  try {
    // Load template version
    const versions = await db
      .select()
      .from(whatsappTemplateVersions)
      .where(eq(whatsappTemplateVersions.id, templateVersionId))
      .limit(1);

    const version = versions[0];
    if (!version) {
      warnings.push({
        variable: "template",
        reason: "Template version not found",
      });
      return {
        renderedText: "",
        variables: [],
        warnings,
      };
    }

    // Load template variables with catalog entries
    const templateVars = await db
      .select({
        templateVar: whatsappTemplateVariables,
        catalogVar: whatsappVariableCatalog,
      })
      .from(whatsappTemplateVariables)
      .innerJoin(
        whatsappVariableCatalog,
        eq(whatsappTemplateVariables.variableCatalogId, whatsappVariableCatalog.id)
      )
      .where(eq(whatsappTemplateVariables.templateVersionId, templateVersionId))
      .orderBy(whatsappTemplateVariables.position);

    // Load data source based on mode
    let sourceData: any = {};
    let resolvedVariables: ResolvedVariable[] = [];

    if (options.mode === "sample") {
      // Load sample data
      const sampleData = await loadSampleData(options.consultantId, options.sampleId);
      
      // Resolve variables from sample data
      for (const { templateVar, catalogVar } of templateVars) {
        const sampleValue = sampleData[catalogVar.variableKey];
        
        resolvedVariables.push({
          key: catalogVar.variableKey,
          value: sampleValue || catalogVar.fallbackValue || `{${catalogVar.variableKey}}`,
          source: sampleValue ? "sample" : "default",
          missing: !sampleValue && !catalogVar.fallbackValue,
          catalogEntry: {
            variableName: catalogVar.variableName,
            description: catalogVar.description,
            sourceType: catalogVar.sourceType,
            sourcePath: catalogVar.sourcePath,
          },
        });
      }
    } else if (options.mode === "lead") {
      // Validate leadId
      if (!options.leadId) {
        warnings.push({
          variable: "leadId",
          reason: "leadId is required for mode 'lead'",
        });
        return {
          renderedText: version.bodyText,
          variables: [],
          warnings,
        };
      }

      // Load lead data
      const leadData = await loadLeadData(options.leadId, options.consultantId);
      if (!leadData) {
        warnings.push({
          variable: "lead",
          reason: "Lead not found or does not belong to consultant",
        });
        return {
          renderedText: version.bodyText,
          variables: [],
          warnings,
        };
      }

      // Resolve variables from lead data
      for (const { templateVar, catalogVar } of templateVars) {
        let resolvedValue: string | null = null;
        let source: "lead" | "sample" | "default" | "fallback" = "lead";
        let usedFallback = false;

        // Determine source data based on sourceType
        let targetData: any = null;
        switch (catalogVar.sourceType) {
          case "lead":
            targetData = leadData.lead;
            break;
          case "consultant":
            targetData = leadData.consultant;
            break;
          case "agent_config":
            targetData = leadData.agentConfig;
            break;
          case "computed":
            // For computed values, we might need custom logic
            // For now, treat as lead data
            targetData = leadData.lead;
            break;
        }

        if (targetData) {
          const resolution = resolveFromPath(
            targetData,
            catalogVar.sourcePath,
            catalogVar.fallbackSourcePath,
            catalogVar.fallbackValue
          );
          
          resolvedValue = resolution.value;
          usedFallback = resolution.usedFallback;
          
          if (usedFallback) {
            source = "fallback";
          }
        }

        resolvedVariables.push({
          key: catalogVar.variableKey,
          value: resolvedValue || `{${catalogVar.variableKey}}`,
          source,
          missing: resolvedValue === null,
          catalogEntry: {
            variableName: catalogVar.variableName,
            description: catalogVar.description,
            sourceType: catalogVar.sourceType,
            sourcePath: catalogVar.sourcePath,
          },
        });
      }
    }

    // Render text by replacing {variable} with resolved values
    let renderedText = version.bodyText;
    for (const variable of resolvedVariables) {
      const regex = new RegExp(`\\{${variable.key}\\}`, 'g');
      renderedText = renderedText.replace(regex, variable.value);
    }

    // Add warnings for any missing variables
    const missingVars = resolvedVariables.filter(v => v.missing);
    for (const missingVar of missingVars) {
      warnings.push({
        variable: missingVar.key,
        reason: `Variable value not found, using placeholder {${missingVar.key}}`,
      });
    }

    return {
      renderedText,
      variables: resolvedVariables,
      warnings,
    };

  } catch (error: any) {
    console.error("❌ Error resolving variables:", error);
    warnings.push({
      variable: "system",
      reason: error.message || "Failed to resolve variables",
    });
    return {
      renderedText: "",
      variables: [],
      warnings,
    };
  }
}
