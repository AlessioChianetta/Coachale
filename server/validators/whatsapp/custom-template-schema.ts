import { z } from "zod";
import { db } from "../../db";
import { whatsappVariableCatalog } from "../../../shared/schema";
import { eq, inArray } from "drizzle-orm";

/**
 * Extract variable keys from bodyText
 * Example: "Ciao {nome_lead}, sono {nome_consulente}" => ["nome_lead", "nome_consulente"]
 */
export function extractVariablesFromText(bodyText: string): string[] {
  const regex = /\{([a-zA-Z0-9_]+)\}/g;
  const matches: string[] = [];
  let match;
  
  while ((match = regex.exec(bodyText)) !== null) {
    if (!matches.includes(match[1])) {
      matches.push(match[1]);
    }
  }
  
  return matches;
}

/**
 * Validate that all variables exist in catalog
 */
export async function validateVariablesExistInCatalog(variableKeys: string[]): Promise<{
  valid: boolean;
  missingVariables: string[];
  catalogVariables: Array<{ id: string; variableKey: string }>;
}> {
  if (variableKeys.length === 0) {
    return { valid: true, missingVariables: [], catalogVariables: [] };
  }

  const catalogVariables = await db
    .select({
      id: whatsappVariableCatalog.id,
      variableKey: whatsappVariableCatalog.variableKey,
    })
    .from(whatsappVariableCatalog)
    .where(inArray(whatsappVariableCatalog.variableKey, variableKeys));

  const foundKeys = catalogVariables.map(v => v.variableKey);
  const missingVariables = variableKeys.filter(key => !foundKeys.includes(key));

  return {
    valid: missingVariables.length === 0,
    missingVariables,
    catalogVariables,
  };
}

/**
 * Validate that position mapping is sequential (1, 2, 3, ...) without gaps
 */
export function validatePositionSequencing(positions: number[]): {
  valid: boolean;
  error?: string;
} {
  if (positions.length === 0) {
    return { valid: true };
  }

  // Sort positions
  const sorted = [...positions].sort((a, b) => a - b);

  // Check if starts at 1
  if (sorted[0] !== 1) {
    return { 
      valid: false, 
      error: "Position mapping must start at 1" 
    };
  }

  // Check for sequential ordering without gaps
  for (let i = 0; i < sorted.length; i++) {
    if (sorted[i] !== i + 1) {
      return { 
        valid: false, 
        error: `Position mapping has gaps. Expected ${i + 1}, found ${sorted[i]}` 
      };
    }
  }

  return { valid: true };
}

/**
 * Variable mapping schema
 */
const variableMappingSchema = z.object({
  variableKey: z.string().min(1, "Variable key is required"),
  position: z.number().int().min(1, "Position must be at least 1"),
});

/**
 * Base template schema
 */
const baseTemplateSchema = z.object({
  templateName: z.string().min(1, "Template name is required").max(255),
  templateType: z.enum(["opening", "followup_gentle", "followup_value", "followup_final"]),
  description: z.string().optional(),
});

/**
 * Template version schema
 */
const templateVersionSchema = z.object({
  bodyText: z.string().min(1, "Body text is required"),
  variables: z.array(variableMappingSchema).optional().default([]),
});

/**
 * Create template schema (includes both template and first version)
 */
export const createTemplateSchema = baseTemplateSchema.merge(templateVersionSchema);

/**
 * Update template schema (creates new version)
 */
export const updateTemplateSchema = templateVersionSchema;

/**
 * Validate create template request with comprehensive checks
 */
export async function validateCreateTemplate(data: z.infer<typeof createTemplateSchema>): Promise<{
  valid: boolean;
  errors: string[];
  catalogVariables?: Array<{ id: string; variableKey: string }>;
}> {
  const errors: string[] = [];

  // Extract variables from bodyText
  const extractedVariables = extractVariablesFromText(data.bodyText);

  // Check if provided variables match extracted variables
  const providedVariableKeys = data.variables?.map(v => v.variableKey) || [];

  // Check for variables in text but not in mapping
  const unmappedVariables = extractedVariables.filter(
    key => !providedVariableKeys.includes(key)
  );
  if (unmappedVariables.length > 0) {
    errors.push(
      `Variables found in text but not in mapping: ${unmappedVariables.join(", ")}`
    );
  }

  // Check for variables in mapping but not in text
  const extraMappedVariables = providedVariableKeys.filter(
    key => !extractedVariables.includes(key)
  );
  if (extraMappedVariables.length > 0) {
    errors.push(
      `Variables in mapping but not found in text: ${extraMappedVariables.join(", ")}`
    );
  }

  // Validate all variables exist in catalog
  const catalogValidation = await validateVariablesExistInCatalog(extractedVariables);
  if (!catalogValidation.valid) {
    errors.push(
      `Variables not found in catalog: ${catalogValidation.missingVariables.join(", ")}`
    );
  }

  // Validate position sequencing
  const positions = data.variables?.map(v => v.position) || [];
  const positionValidation = validatePositionSequencing(positions);
  if (!positionValidation.valid) {
    errors.push(positionValidation.error!);
  }

  // Check for duplicate positions
  const duplicatePositions = positions.filter(
    (pos, index) => positions.indexOf(pos) !== index
  );
  if (duplicatePositions.length > 0) {
    errors.push(`Duplicate positions found: ${[...new Set(duplicatePositions)].join(", ")}`);
  }

  return {
    valid: errors.length === 0,
    errors,
    catalogVariables: catalogValidation.catalogVariables,
  };
}

/**
 * Preview mode schema
 */
export const previewRequestSchema = z.object({
  mode: z.enum(["sample", "lead"]),
  leadId: z.string().uuid().optional(),
  sampleId: z.string().uuid().optional(),
}).refine(
  (data) => {
    // If mode is "lead", leadId is required
    if (data.mode === "lead" && !data.leadId) {
      return false;
    }
    // If mode is "sample", sampleId is optional (will use default if not provided)
    return true;
  },
  {
    message: "leadId is required when mode is 'lead'",
  }
);

export type CreateTemplateInput = z.infer<typeof createTemplateSchema>;
export type UpdateTemplateInput = z.infer<typeof updateTemplateSchema>;
export type PreviewRequestInput = z.infer<typeof previewRequestSchema>;
