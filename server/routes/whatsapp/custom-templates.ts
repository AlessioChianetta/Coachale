import { Router } from "express";
import { authenticateToken, requireRole, type AuthRequest } from "../../middleware/auth";
import { z } from "zod";
import {
  createTemplateSchema,
  updateTemplateSchema,
  previewRequestSchema,
} from "../../validators/whatsapp/custom-template-schema";
import {
  createTemplate,
  listTemplates,
  getTemplate,
  createNewVersion,
  archiveTemplate,
  restoreTemplate,
} from "../../services/whatsapp/templates-service";
import { resolveVariables } from "../../services/whatsapp/variable-resolver";
import { db } from "../../db";
import { 
  whatsappTemplateVersions, 
  whatsappVariableCatalog,
  proactiveLeads,
  users,
  consultantWhatsappConfig,
} from "../../../shared/schema";
import { eq, and } from "drizzle-orm";

const router = Router();

/**
 * GET /api/whatsapp/custom-templates/catalog
 * Fetch all available variables from the catalog
 */
router.get(
  "/whatsapp/custom-templates/catalog",
  authenticateToken,
  requireRole("consultant"),
  async (req: AuthRequest, res) => {
    try {
      const variables = await db
        .select({
          id: whatsappVariableCatalog.id,
          variableKey: whatsappVariableCatalog.variableKey,
          variableName: whatsappVariableCatalog.variableName,
          description: whatsappVariableCatalog.description,
          sourceType: whatsappVariableCatalog.sourceType,
          sourcePath: whatsappVariableCatalog.sourcePath,
          dataType: whatsappVariableCatalog.dataType,
        })
        .from(whatsappVariableCatalog)
        .orderBy(whatsappVariableCatalog.sourceType, whatsappVariableCatalog.variableName);

      res.json({
        success: true,
        data: variables,
        count: variables.length,
      });
    } catch (error: any) {
      console.error("❌ [CUSTOM TEMPLATES] Error fetching variable catalog:", error);
      res.status(500).json({
        success: false,
        error: error.message || "Failed to fetch variable catalog",
      });
    }
  }
);

/**
 * POST /api/whatsapp/custom-templates
 * Create a new template with initial version and variables
 */
router.post(
  "/whatsapp/custom-templates",
  authenticateToken,
  requireRole("consultant"),
  async (req: AuthRequest, res) => {
    try {
      const consultantId = req.user!.id;

      // Validate request body
      const validationResult = createTemplateSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({
          success: false,
          error: "Validation failed",
          details: validationResult.error.errors,
        });
      }

      const data = validationResult.data;

      // Create template
      const template = await createTemplate(consultantId, data);

      res.status(201).json({
        success: true,
        data: template,
        message: "Template created successfully",
      });
    } catch (error: any) {
      console.error("❌ [CUSTOM TEMPLATES] Error creating template:", error);

      // Handle unique constraint violation (duplicate template type for consultant)
      if (error.code === "23505" && error.constraint?.includes("unique_template_per_type")) {
        return res.status(409).json({
          success: false,
          error: "A template of this type already exists for your account",
        });
      }

      // Handle validation errors
      if (error.message?.includes("Validation failed")) {
        return res.status(400).json({
          success: false,
          error: error.message,
        });
      }

      res.status(500).json({
        success: false,
        error: error.message || "Failed to create template",
      });
    }
  }
);

/**
 * GET /api/whatsapp/custom-templates
 * List all templates for the logged-in consultant
 */
router.get(
  "/whatsapp/custom-templates",
  authenticateToken,
  requireRole("consultant"),
  async (req: AuthRequest, res) => {
    try {
      const consultantId = req.user!.id;

      // Parse query filters
      const filters: any = {};
      if (req.query.templateType) {
        filters.templateType = req.query.templateType;
      }

      const templates = await listTemplates(consultantId, filters);

      res.json({
        success: true,
        data: templates,
        count: templates.length,
      });
    } catch (error: any) {
      console.error("❌ [CUSTOM TEMPLATES] Error listing templates:", error);
      res.status(500).json({
        success: false,
        error: error.message || "Failed to list templates",
      });
    }
  }
);

/**
 * GET /api/whatsapp/custom-templates/:id
 * Get a single template with all versions and variables
 */
router.get(
  "/whatsapp/custom-templates/:id",
  authenticateToken,
  requireRole("consultant"),
  async (req: AuthRequest, res) => {
    try {
      const consultantId = req.user!.id;
      const templateId = req.params.id;

      // Validate UUID format
      const uuidSchema = z.string().uuid();
      const uuidValidation = uuidSchema.safeParse(templateId);
      if (!uuidValidation.success) {
        return res.status(400).json({
          success: false,
          error: "Invalid template ID format",
        });
      }

      const template = await getTemplate(templateId, consultantId);

      if (!template) {
        return res.status(404).json({
          success: false,
          error: "Template not found or does not belong to you",
        });
      }

      res.json({
        success: true,
        data: template,
      });
    } catch (error: any) {
      console.error("❌ [CUSTOM TEMPLATES] Error getting template:", error);
      res.status(500).json({
        success: false,
        error: error.message || "Failed to get template",
      });
    }
  }
);

/**
 * PUT /api/whatsapp/custom-templates/:id
 * Create a new version for an existing template
 * (deactivates previous version, creates new active version)
 */
router.put(
  "/whatsapp/custom-templates/:id",
  authenticateToken,
  requireRole("consultant"),
  async (req: AuthRequest, res) => {
    try {
      const consultantId = req.user!.id;
      const templateId = req.params.id;

      // Validate UUID format
      const uuidSchema = z.string().uuid();
      const uuidValidation = uuidSchema.safeParse(templateId);
      if (!uuidValidation.success) {
        return res.status(400).json({
          success: false,
          error: "Invalid template ID format",
        });
      }

      // Validate request body
      const validationResult = updateTemplateSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({
          success: false,
          error: "Validation failed",
          details: validationResult.error.errors,
        });
      }

      const data = validationResult.data;

      // Create new version
      const template = await createNewVersion(templateId, consultantId, data);

      res.json({
        success: true,
        data: template,
        message: "New template version created successfully",
      });
    } catch (error: any) {
      console.error("❌ [CUSTOM TEMPLATES] Error updating template:", error);

      // Handle not found error
      if (error.message?.includes("not found") || error.message?.includes("does not belong")) {
        return res.status(404).json({
          success: false,
          error: error.message,
        });
      }

      // Handle validation errors
      if (error.message?.includes("Validation failed")) {
        return res.status(400).json({
          success: false,
          error: error.message,
        });
      }

      res.status(500).json({
        success: false,
        error: error.message || "Failed to update template",
      });
    }
  }
);

/**
 * DELETE /api/whatsapp/custom-templates/:id
 * Archive a template (soft delete - preserves all versions and variables)
 */
router.delete(
  "/whatsapp/custom-templates/:id",
  authenticateToken,
  requireRole("consultant"),
  async (req: AuthRequest, res) => {
    try {
      const consultantId = req.user!.id;
      const templateId = req.params.id;

      // Validate UUID format
      const uuidSchema = z.string().uuid();
      const uuidValidation = uuidSchema.safeParse(templateId);
      if (!uuidValidation.success) {
        return res.status(400).json({
          success: false,
          error: "Invalid template ID format",
        });
      }

      const archived = await archiveTemplate(templateId, consultantId);

      if (!archived) {
        return res.status(404).json({
          success: false,
          error: "Template not found or does not belong to you",
        });
      }

      res.json({
        success: true,
        message: "Template archived successfully",
      });
    } catch (error: any) {
      console.error("❌ [CUSTOM TEMPLATES] Error archiving template:", error);
      res.status(500).json({
        success: false,
        error: error.message || "Failed to archive template",
      });
    }
  }
);

/**
 * PATCH /api/whatsapp/custom-templates/:id/restore
 * Restore an archived template (unarchive)
 */
router.patch(
  "/whatsapp/custom-templates/:id/restore",
  authenticateToken,
  requireRole("consultant"),
  async (req: AuthRequest, res) => {
    try {
      const consultantId = req.user!.id;
      const templateId = req.params.id;

      // Validate UUID format
      const uuidSchema = z.string().uuid();
      const uuidValidation = uuidSchema.safeParse(templateId);
      if (!uuidValidation.success) {
        return res.status(400).json({
          success: false,
          error: "Invalid template ID format",
        });
      }

      const restored = await restoreTemplate(templateId, consultantId);

      if (!restored) {
        return res.status(404).json({
          success: false,
          error: "Template not found or does not belong to you",
        });
      }

      res.json({
        success: true,
        message: "Template restored successfully",
      });
    } catch (error: any) {
      console.error("❌ [CUSTOM TEMPLATES] Error restoring template:", error);
      res.status(500).json({
        success: false,
        error: error.message || "Failed to restore template",
      });
    }
  }
);

/**
 * POST /api/whatsapp/custom-templates/preview-draft
 * Preview a template draft during creation (before saving)
 * Resolves variables without requiring a saved template
 */
router.post(
  "/whatsapp/custom-templates/preview-draft",
  authenticateToken,
  requireRole("consultant"),
  async (req: AuthRequest, res) => {
    try {
      const consultantId = req.user!.id;

      // Validate request body
      const draftPreviewSchema = z.object({
        bodyText: z.string().min(1, "Body text is required"),
        variables: z.array(z.object({
          variableKey: z.string(),
          position: z.number(),
        })),
        mode: z.enum(["sample", "lead"]),
        leadId: z.string().uuid().optional(),
        sampleData: z.record(z.string()).optional(),
      });

      const validationResult = draftPreviewSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({
          success: false,
          error: "Validation failed",
          details: validationResult.error.errors,
        });
      }

      const { bodyText, variables, mode, leadId, sampleData } = validationResult.data;

      // Validate mode-specific requirements
      if (mode === "lead" && !leadId) {
        return res.status(400).json({
          success: false,
          error: "leadId is required when mode is 'lead'",
        });
      }

      // Load all catalog variables
      const catalogVars = await db
        .select()
        .from(whatsappVariableCatalog)
        .orderBy(whatsappVariableCatalog.variableKey);

      const catalogMap = new Map(catalogVars.map(v => [v.variableKey, v]));

      // Validate that all variables exist in catalog
      const invalidVars = variables.filter(v => !catalogMap.has(v.variableKey));
      if (invalidVars.length > 0) {
        return res.status(400).json({
          success: false,
          error: `Invalid variables: ${invalidVars.map(v => v.variableKey).join(", ")} not found in catalog`,
        });
      }

      // Resolve variables
      const warnings: Array<{ variable: string; reason: string }> = [];
      const resolvedVariables: Array<{
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
      }> = [];

      if (mode === "sample") {
        // Load consultant data for consultant/agent_config variables
        const consultants = await db
          .select()
          .from(users)
          .where(eq(users.id, consultantId))
          .limit(1);

        const consultant = consultants[0];

        // Load consultant WhatsApp config
        const configs = await db
          .select()
          .from(consultantWhatsappConfig)
          .where(eq(consultantWhatsappConfig.consultantId, consultantId))
          .limit(1);

        const agentConfig = configs[0] || null;

        // Resolve from sample data or fallback values
        for (const varMapping of variables) {
          const catalogVar = catalogMap.get(varMapping.variableKey)!;
          let resolvedValue: string | null = null;
          let source: "lead" | "sample" | "default" | "fallback" = "sample";
          
          // For consultant/agent_config variables, use REAL data from DB
          if (catalogVar.sourceType === "consultant" && consultant) {
            // Navigate path in consultant data
            const pathParts = catalogVar.sourcePath.split(".");
            let value: any = consultant;
            
            for (const part of pathParts) {
              if (value && typeof value === "object" && part in value) {
                value = value[part];
              } else {
                value = null;
                break;
              }
            }

            if (value !== null && value !== undefined && value !== "") {
              resolvedValue = String(value);
              source = "lead"; // Using real consultant data
            }
          } else if (catalogVar.sourceType === "agent_config" && agentConfig) {
            // Navigate path in agent config data
            const pathParts = catalogVar.sourcePath.split(".");
            let value: any = agentConfig;
            
            for (const part of pathParts) {
              if (value && typeof value === "object" && part in value) {
                value = value[part];
              } else {
                value = null;
                break;
              }
            }

            if (value !== null && value !== undefined && value !== "") {
              resolvedValue = String(value);
              source = "lead"; // Using real agent config data
            }
          }
          
          // If not resolved from DB, try sample data
          if (!resolvedValue) {
            const sampleValue = sampleData?.[varMapping.variableKey];
            if (sampleValue) {
              resolvedValue = sampleValue;
              source = "sample";
            }
          }
          
          // If still not resolved, try fallback value
          if (!resolvedValue && catalogVar.fallbackValue) {
            resolvedValue = catalogVar.fallbackValue;
            source = "default";
          }
          
          // If still not resolved, use placeholder
          const finalValue = resolvedValue || `{${varMapping.variableKey}}`;
          const missing = !resolvedValue;

          resolvedVariables.push({
            key: varMapping.variableKey,
            value: finalValue,
            source: missing ? "fallback" : source,
            missing,
            catalogEntry: {
              variableName: catalogVar.variableName,
              description: catalogVar.description,
              sourceType: catalogVar.sourceType,
              sourcePath: catalogVar.sourcePath,
            },
          });

          if (missing) {
            warnings.push({
              variable: varMapping.variableKey,
              reason: `Valore mancante per ${varMapping.variableKey}. Usa placeholder nel preview.`,
            });
          }
        }
      } else if (mode === "lead") {
        // Load lead data
        const leads = await db
          .select()
          .from(proactiveLeads)
          .where(
            and(
              eq(proactiveLeads.id, leadId!),
              eq(proactiveLeads.consultantId, consultantId)
            )
          )
          .limit(1);

        const lead = leads[0];
        if (!lead) {
          warnings.push({
            variable: "lead",
            reason: "Lead not found or does not belong to consultant",
          });
          return res.status(404).json({
            success: false,
            error: "Lead not found or does not belong to you",
          });
        }

        // Load consultant data
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

        // Resolve variables from lead data
        for (const varMapping of variables) {
          const catalogVar = catalogMap.get(varMapping.variableKey)!;
          
          let targetData: any = null;
          switch (catalogVar.sourceType) {
            case "lead":
              targetData = lead;
              break;
            case "consultant":
              targetData = consultant;
              break;
            case "agent_config":
              targetData = agentConfig;
              break;
            case "computed":
              targetData = lead;
              break;
          }

          let resolvedValue: string | null = null;
          let source: "lead" | "sample" | "default" | "fallback" = "lead";

          if (targetData) {
            // Navigate path
            const pathParts = catalogVar.sourcePath.split(".");
            let value: any = targetData;
            
            for (const part of pathParts) {
              if (value && typeof value === "object" && part in value) {
                value = value[part];
              } else {
                value = null;
                break;
              }
            }

            if (value !== null && value !== undefined && value !== "") {
              resolvedValue = String(value);
            } else if (catalogVar.fallbackValue) {
              resolvedValue = catalogVar.fallbackValue;
              source = "fallback";
            }
          }

          const missing = resolvedValue === null;
          resolvedVariables.push({
            key: varMapping.variableKey,
            value: resolvedValue || `{${varMapping.variableKey}}`,
            source,
            missing,
            catalogEntry: {
              variableName: catalogVar.variableName,
              description: catalogVar.description,
              sourceType: catalogVar.sourceType,
              sourcePath: catalogVar.sourcePath,
            },
          });

          if (missing) {
            warnings.push({
              variable: varMapping.variableKey,
              reason: `Variable value not found in lead data, using placeholder {${varMapping.variableKey}}`,
            });
          }
        }
      }

      // Render text by replacing {variable} with resolved values
      let renderedText = bodyText;
      for (const variable of resolvedVariables) {
        const regex = new RegExp(`\\{${variable.key}\\}`, 'g');
        renderedText = renderedText.replace(regex, variable.value);
      }

      res.json({
        success: true,
        data: {
          originalText: bodyText,
          renderedText,
          variables: resolvedVariables,
          warnings,
        },
      });
    } catch (error: any) {
      console.error("❌ [CUSTOM TEMPLATES] Error previewing draft template:", error);
      res.status(500).json({
        success: false,
        error: error.message || "Failed to preview draft template",
      });
    }
  }
);

/**
 * POST /api/whatsapp/custom-templates/:id/preview
 * Preview a template with variable resolution
 */
router.post(
  "/whatsapp/custom-templates/:id/preview",
  authenticateToken,
  requireRole("consultant"),
  async (req: AuthRequest, res) => {
    try {
      const consultantId = req.user!.id;
      const templateId = req.params.id;

      // Validate UUID format
      const uuidSchema = z.string().uuid();
      const uuidValidation = uuidSchema.safeParse(templateId);
      if (!uuidValidation.success) {
        return res.status(400).json({
          success: false,
          error: "Invalid template ID format",
        });
      }

      // Validate request body
      const validationResult = previewRequestSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({
          success: false,
          error: "Validation failed",
          details: validationResult.error.errors,
        });
      }

      const { mode, leadId, sampleId } = validationResult.data;

      // Verify template exists and belongs to consultant
      const template = await getTemplate(templateId, consultantId);
      if (!template) {
        return res.status(404).json({
          success: false,
          error: "Template not found or does not belong to you",
        });
      }

      // Get active version
      const activeVersion = template.versions.find(v => v.isActive);
      if (!activeVersion) {
        return res.status(400).json({
          success: false,
          error: "Template has no active version",
        });
      }

      // Resolve variables
      const resolution = await resolveVariables(activeVersion.id, {
        mode,
        leadId,
        sampleId,
        consultantId,
      });

      res.json({
        success: true,
        data: {
          templateId: template.id,
          templateName: template.templateName,
          versionId: activeVersion.id,
          versionNumber: activeVersion.versionNumber,
          originalText: activeVersion.bodyText,
          renderedText: resolution.renderedText,
          variables: resolution.variables,
          warnings: resolution.warnings,
        },
      });
    } catch (error: any) {
      console.error("❌ [CUSTOM TEMPLATES] Error previewing template:", error);
      res.status(500).json({
        success: false,
        error: error.message || "Failed to preview template",
      });
    }
  }
);

export default router;
