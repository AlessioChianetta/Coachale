import { db } from "../../db";
import {
  whatsappCustomTemplates,
  whatsappTemplateVersions,
  whatsappTemplateVariables,
  whatsappVariableCatalog,
} from "../../../shared/schema";
import { eq, and, desc, sql, isNull, asc } from "drizzle-orm";
import { 
  validateCreateTemplate, 
  type CreateTemplateInput,
  type UpdateTemplateInput 
} from "../../validators/whatsapp/custom-template-schema";
import { getTwilioClient } from "../../whatsapp/twilio-client";
import { convertToTwilioFormat } from "./variable-converter";

/**
 * Template with active version info
 */
export interface TemplateListItem {
  id: string;
  templateName: string;
  templateType: string;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
  activeVersion?: {
    id: string;
    versionNumber: number;
    bodyText: string;
    twilioStatus: string;
    variableCount: number;
  };
}

/**
 * Full template with all versions
 */
export interface TemplateDetail {
  id: string;
  consultantId: string;
  templateName: string;
  templateType: string;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
  versions: Array<{
    id: string;
    versionNumber: number;
    bodyText: string;
    twilioContentSid: string | null;
    twilioStatus: string;
    isActive: boolean;
    createdAt: Date;
    createdBy: string | null;
    variables: Array<{
      id: string;
      position: number;
      variableKey: string;
      variableName: string;
      description: string;
      sourceType: string;
      sourcePath: string;
    }>;
  }>;
}

/**
 * Create a new template with initial version and variables
 * Transaction: template -> version -> variables
 */
export async function createTemplate(
  consultantId: string,
  data: CreateTemplateInput
): Promise<TemplateDetail> {
  // Validate the template data
  const validation = await validateCreateTemplate(data);
  if (!validation.valid) {
    throw new Error(`Validation failed: ${validation.errors.join("; ")}`);
  }

  return await db.transaction(async (tx) => {
    // 1. Insert template
    const [template] = await tx
      .insert(whatsappCustomTemplates)
      .values({
        consultantId,
        templateName: data.templateName,
        templateType: data.templateType,
        description: data.description,
      })
      .returning();

    // 2. Insert version v1 (active by default)
    const [version] = await tx
      .insert(whatsappTemplateVersions)
      .values({
        templateId: template.id,
        versionNumber: 1,
        bodyText: data.bodyText,
        isActive: true,
        createdBy: consultantId,
      })
      .returning();

    // 3. Insert variables mapping
    const variableRecords = [];
    for (const varMapping of data.variables || []) {
      // Find catalog entry
      const catalogEntry = validation.catalogVariables?.find(
        v => v.variableKey === varMapping.variableKey
      );
      
      if (!catalogEntry) {
        throw new Error(`Variable ${varMapping.variableKey} not found in catalog`);
      }

      variableRecords.push({
        templateVersionId: version.id,
        variableCatalogId: catalogEntry.id,
        position: varMapping.position,
      });
    }

    let insertedVariables: any[] = [];
    if (variableRecords.length > 0) {
      insertedVariables = await tx
        .insert(whatsappTemplateVariables)
        .values(variableRecords)
        .returning();
    }

    // Load variable details for response
    const variablesWithDetails = await tx
      .select({
        id: whatsappTemplateVariables.id,
        position: whatsappTemplateVariables.position,
        variableKey: whatsappVariableCatalog.variableKey,
        variableName: whatsappVariableCatalog.variableName,
        description: whatsappVariableCatalog.description,
        sourceType: whatsappVariableCatalog.sourceType,
        sourcePath: whatsappVariableCatalog.sourcePath,
      })
      .from(whatsappTemplateVariables)
      .innerJoin(
        whatsappVariableCatalog,
        eq(whatsappTemplateVariables.variableCatalogId, whatsappVariableCatalog.id)
      )
      .where(eq(whatsappTemplateVariables.templateVersionId, version.id))
      .orderBy(whatsappTemplateVariables.position);

    return {
      id: template.id,
      consultantId: template.consultantId,
      templateName: template.templateName,
      templateType: template.templateType,
      description: template.description,
      createdAt: template.createdAt,
      updatedAt: template.updatedAt,
      versions: [{
        id: version.id,
        versionNumber: version.versionNumber,
        bodyText: version.bodyText,
        twilioContentSid: version.twilioContentSid,
        twilioStatus: version.twilioStatus,
        isActive: version.isActive,
        createdAt: version.createdAt,
        createdBy: version.createdBy,
        variables: variablesWithDetails,
      }],
    };
  });
}

/**
 * List all templates for a consultant with active version info
 */
export async function listTemplates(
  consultantId: string,
  filters?: {
    templateType?: string;
  }
): Promise<TemplateListItem[]> {
  // Build where conditions - exclude archived templates
  const conditions = [
    eq(whatsappCustomTemplates.consultantId, consultantId),
    isNull(whatsappCustomTemplates.archivedAt),
  ];
  
  if (filters?.templateType) {
    conditions.push(eq(whatsappCustomTemplates.templateType, filters.templateType as any));
  }

  // Get templates
  const templates = await db
    .select()
    .from(whatsappCustomTemplates)
    .where(and(...conditions))
    .orderBy(desc(whatsappCustomTemplates.createdAt));

  // For each template, get active version with variable count
  const result: TemplateListItem[] = [];
  
  for (const template of templates) {
    // Get active version
    const activeVersions = await db
      .select({
        id: whatsappTemplateVersions.id,
        versionNumber: whatsappTemplateVersions.versionNumber,
        bodyText: whatsappTemplateVersions.bodyText,
        twilioStatus: whatsappTemplateVersions.twilioStatus,
      })
      .from(whatsappTemplateVersions)
      .where(
        and(
          eq(whatsappTemplateVersions.templateId, template.id),
          eq(whatsappTemplateVersions.isActive, true)
        )
      )
      .limit(1);

    const activeVersion = activeVersions[0];

    // Get variable count for active version
    let variableCount = 0;
    if (activeVersion) {
      const countResult = await db
        .select({ count: sql<number>`count(*)` })
        .from(whatsappTemplateVariables)
        .where(eq(whatsappTemplateVariables.templateVersionId, activeVersion.id));
      
      variableCount = Number(countResult[0]?.count || 0);
    }

    result.push({
      id: template.id,
      templateName: template.templateName,
      templateType: template.templateType,
      description: template.description,
      createdAt: template.createdAt,
      updatedAt: template.updatedAt,
      activeVersion: activeVersion ? {
        id: activeVersion.id,
        versionNumber: activeVersion.versionNumber,
        bodyText: activeVersion.bodyText,
        twilioStatus: activeVersion.twilioStatus,
        variableCount,
      } : undefined,
    });
  }

  return result;
}

/**
 * Get a single template with all versions and variables
 */
export async function getTemplate(
  templateId: string,
  consultantId: string
): Promise<TemplateDetail | null> {
  // Get template - check if not archived
  const templates = await db
    .select()
    .from(whatsappCustomTemplates)
    .where(
      and(
        eq(whatsappCustomTemplates.id, templateId),
        eq(whatsappCustomTemplates.consultantId, consultantId),
        isNull(whatsappCustomTemplates.archivedAt)
      )
    )
    .limit(1);

  const template = templates[0];
  if (!template) {
    return null;
  }

  // Get all versions
  const versions = await db
    .select()
    .from(whatsappTemplateVersions)
    .where(eq(whatsappTemplateVersions.templateId, templateId))
    .orderBy(desc(whatsappTemplateVersions.versionNumber));

  // For each version, get variables
  const versionsWithVariables = await Promise.all(
    versions.map(async (version) => {
      const variables = await db
        .select({
          id: whatsappTemplateVariables.id,
          position: whatsappTemplateVariables.position,
          variableKey: whatsappVariableCatalog.variableKey,
          variableName: whatsappVariableCatalog.variableName,
          description: whatsappVariableCatalog.description,
          sourceType: whatsappVariableCatalog.sourceType,
          sourcePath: whatsappVariableCatalog.sourcePath,
        })
        .from(whatsappTemplateVariables)
        .innerJoin(
          whatsappVariableCatalog,
          eq(whatsappTemplateVariables.variableCatalogId, whatsappVariableCatalog.id)
        )
        .where(eq(whatsappTemplateVariables.templateVersionId, version.id))
        .orderBy(whatsappTemplateVariables.position);

      return {
        id: version.id,
        versionNumber: version.versionNumber,
        bodyText: version.bodyText,
        twilioContentSid: version.twilioContentSid,
        twilioStatus: version.twilioStatus,
        isActive: version.isActive,
        createdAt: version.createdAt,
        createdBy: version.createdBy,
        variables,
      };
    })
  );

  return {
    id: template.id,
    consultantId: template.consultantId,
    templateName: template.templateName,
    templateType: template.templateType,
    description: template.description,
    createdAt: template.createdAt,
    updatedAt: template.updatedAt,
    versions: versionsWithVariables,
  };
}

/**
 * Create a new version for an existing template
 * Transaction: deactivate old version -> insert new version -> insert variables
 */
export async function createNewVersion(
  templateId: string,
  consultantId: string,
  data: UpdateTemplateInput
): Promise<TemplateDetail> {
  // Validate the update data
  const validation = await validateCreateTemplate({
    ...data,
    templateName: "", // Not needed for validation
    templateType: "opening", // Not needed for validation
  });
  
  if (!validation.valid) {
    throw new Error(`Validation failed: ${validation.errors.join("; ")}`);
  }

  // Verify template exists and belongs to consultant
  const templates = await db
    .select()
    .from(whatsappCustomTemplates)
    .where(
      and(
        eq(whatsappCustomTemplates.id, templateId),
        eq(whatsappCustomTemplates.consultantId, consultantId)
      )
    )
    .limit(1);

  const template = templates[0];
  if (!template) {
    throw new Error("Template not found or does not belong to consultant");
  }

  return await db.transaction(async (tx) => {
    // 1. Get current max version number
    const maxVersionResult = await tx
      .select({ maxVersion: sql<number>`COALESCE(MAX(${whatsappTemplateVersions.versionNumber}), 0)` })
      .from(whatsappTemplateVersions)
      .where(eq(whatsappTemplateVersions.templateId, templateId));

    const nextVersionNumber = Number(maxVersionResult[0]?.maxVersion || 0) + 1;

    // 2. Deactivate old active version
    await tx
      .update(whatsappTemplateVersions)
      .set({ isActive: false })
      .where(
        and(
          eq(whatsappTemplateVersions.templateId, templateId),
          eq(whatsappTemplateVersions.isActive, true)
        )
      );

    // 3. Insert new version
    const [newVersion] = await tx
      .insert(whatsappTemplateVersions)
      .values({
        templateId,
        versionNumber: nextVersionNumber,
        bodyText: data.bodyText,
        isActive: true,
        createdBy: consultantId,
      })
      .returning();

    // 4. Insert variables mapping
    const variableRecords = [];
    for (const varMapping of data.variables || []) {
      const catalogEntry = validation.catalogVariables?.find(
        v => v.variableKey === varMapping.variableKey
      );
      
      if (!catalogEntry) {
        throw new Error(`Variable ${varMapping.variableKey} not found in catalog`);
      }

      variableRecords.push({
        templateVersionId: newVersion.id,
        variableCatalogId: catalogEntry.id,
        position: varMapping.position,
      });
    }

    if (variableRecords.length > 0) {
      await tx
        .insert(whatsappTemplateVariables)
        .values(variableRecords);
    }

    // 5. Update template's updatedAt timestamp
    await tx
      .update(whatsappCustomTemplates)
      .set({ updatedAt: new Date() })
      .where(eq(whatsappCustomTemplates.id, templateId));

    // Return updated template
    const updatedTemplate = await getTemplate(templateId, consultantId);
    if (!updatedTemplate) {
      throw new Error("Failed to retrieve updated template");
    }

    return updatedTemplate;
  });
}

/**
 * Archive a template (soft delete - sets archivedAt timestamp)
 * All versions and variables are preserved
 */
export async function archiveTemplate(
  templateId: string,
  consultantId: string
): Promise<boolean> {
  const result = await db
    .update(whatsappCustomTemplates)
    .set({ 
      archivedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(whatsappCustomTemplates.id, templateId),
        eq(whatsappCustomTemplates.consultantId, consultantId),
        isNull(whatsappCustomTemplates.archivedAt)
      )
    )
    .returning();

  return result.length > 0;
}

/**
 * Restore an archived template (unarchive - sets archivedAt to NULL)
 */
export async function restoreTemplate(
  templateId: string,
  consultantId: string
): Promise<boolean> {
  const result = await db
    .update(whatsappCustomTemplates)
    .set({ 
      archivedAt: null,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(whatsappCustomTemplates.id, templateId),
        eq(whatsappCustomTemplates.consultantId, consultantId)
      )
    )
    .returning();

  return result.length > 0;
}
