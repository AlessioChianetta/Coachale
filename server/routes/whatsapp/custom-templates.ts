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
import * as schema from "../../../shared/schema";
import {
  whatsappTemplateVersions,
  whatsappVariableCatalog,
  whatsappTemplateVariables,
  proactiveLeads,
  users,
  consultantWhatsappConfig,
} from "../../../shared/schema";
import { inArray } from "drizzle-orm";
import { eq, and, sql } from "drizzle-orm";
import {
  DEFAULT_TEMPLATES_BY_AGENT,
  AGENT_TYPE_LABELS,
  type AgentType as TemplateAgentType
} from "../../data/default-templates-seed";
import { getAIProvider, getModelWithThinking } from "../../ai/provider-factory";

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
 * POST /api/whatsapp/custom-templates/generate-ai-message
 * Generate a WhatsApp template message using AI
 */
router.post(
  "/whatsapp/custom-templates/generate-ai-message",
  authenticateToken,
  requireRole("consultant"),
  async (req: AuthRequest, res) => {
    try {
      const consultantId = req.user!.id;
      const { prompt, scenario, variables } = req.body;

      if (!prompt || typeof prompt !== 'string') {
        return res.status(400).json({
          success: false,
          error: "Descrizione richiesta mancante",
        });
      }

      // Get AI provider for this consultant
      const aiProvider = await getAIProvider(consultantId);
      if (!aiProvider.client) {
        return res.status(500).json({
          success: false,
          error: "Nessuna API key AI configurata. Configura una chiave Gemini nelle impostazioni.",
        });
      }

      // Build the system prompt for template generation
      const availableVariables = variables?.length > 0 
        ? variables.map((v: string) => `{${v}}`).join(", ")
        : "{nome_lead}, {nome_consulente}, {nome_azienda}";

      const scenarioContext = scenario ? `Scenario: ${scenario}` : "";

      const systemPrompt = `Sei un esperto copywriter italiano specializzato in messaggi WhatsApp per business.
Genera un messaggio WhatsApp in italiano basato sulla richiesta dell'utente.

REGOLE FONDAMENTALI:
1. Il messaggio deve essere BREVE (massimo 160 caratteri idealmente, max 200)
2. Usa un tono professionale ma amichevole
3. Includi le variabili dinamiche disponibili nel formato {nome_variabile}
4. Non usare emoji eccessive (max 1-2)
5. Il messaggio deve essere pronto per essere inviato su WhatsApp Business

VARIABILI DISPONIBILI (usa SOLO queste):
${availableVariables}

${scenarioContext}

IMPORTANTE: Rispondi SOLO con il testo del messaggio, senza spiegazioni o commenti.`;

      const userMessage = `Genera un messaggio WhatsApp per: ${prompt}`;

      // Get the appropriate model based on provider (Gemini 3 for Google AI Studio, 2.5 for Vertex)
      const { model, useThinking, thinkingLevel } = getModelWithThinking(aiProvider.metadata.provider);
      console.log(`[AI TEMPLATE] Using model: ${model} (${aiProvider.metadata.provider}), thinking: ${useThinking}`);

      // Call Gemini AI using the unified GeminiClient interface
      const result = await aiProvider.client.generateContent({
        model,
        contents: [
          { role: "user", parts: [{ text: systemPrompt + "\n\n" + userMessage }] }
        ],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 500,
          ...(useThinking && { thinkingConfig: { thinkingLevel } }),
        },
      });

      const generatedText = result.response.text();

      if (!generatedText || generatedText.trim().length === 0) {
        return res.status(500).json({
          success: false,
          error: "L'AI non ha generato alcun messaggio. Riprova con una descrizione diversa.",
        });
      }

      // Clean up the response (remove quotes, markdown, etc.)
      let cleanedMessage = generatedText
        .trim()
        .replace(/^["']|["']$/g, '') // Remove surrounding quotes
        .replace(/```[\s\S]*?```/g, '') // Remove code blocks
        .replace(/\*\*/g, '') // Remove bold markdown
        .trim();

      console.log(`✅ [AI TEMPLATE] Generated message for consultant ${consultantId}: ${cleanedMessage.substring(0, 50)}...`);

      res.json({
        success: true,
        message: cleanedMessage,
      });
    } catch (error: any) {
      console.error("❌ [AI TEMPLATE] Error generating message:", error);
      res.status(500).json({
        success: false,
        error: error.message || "Errore durante la generazione del messaggio AI",
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

// ═══════════════════════════════════════════════════════════════════════════
// DEFAULT TEMPLATES ENDPOINTS 
// (Must be placed BEFORE /:id route to avoid route collision)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * GET /api/whatsapp/custom-templates/default-templates
 * Get all available default templates grouped by agent type
 */
router.get(
  "/whatsapp/custom-templates/default-templates",
  authenticateToken,
  requireRole("consultant"),
  async (req: AuthRequest, res) => {
    try {
      const consultantId = req.user!.id;

      // Get existing templates for this consultant to check which defaults are already loaded
      const existingTemplates = await db
        .select({
          templateName: schema.whatsappCustomTemplates.templateName,
          targetAgentType: schema.whatsappCustomTemplates.targetAgentType,
          isSystemTemplate: schema.whatsappCustomTemplates.isSystemTemplate,
        })
        .from(schema.whatsappCustomTemplates)
        .where(eq(schema.whatsappCustomTemplates.consultantId, consultantId));

      const existingNamesByAgent = new Map<string, Set<string>>();
      for (const t of existingTemplates) {
        if (t.targetAgentType && t.isSystemTemplate) {
          if (!existingNamesByAgent.has(t.targetAgentType)) {
            existingNamesByAgent.set(t.targetAgentType, new Set());
          }
          existingNamesByAgent.get(t.targetAgentType)!.add(t.templateName);
        }
      }

      // Build response with availability status
      const agentTemplates = Object.entries(DEFAULT_TEMPLATES_BY_AGENT).map(([agentType, templates]) => {
        const existingNames = existingNamesByAgent.get(agentType) || new Set();
        const loadedCount = templates.filter(t => existingNames.has(t.templateName)).length;

        return {
          agentType,
          agentLabel: AGENT_TYPE_LABELS[agentType as TemplateAgentType],
          totalTemplates: templates.length,
          loadedCount,
          allLoaded: loadedCount === templates.length,
          templates: templates.map(t => ({
            ...t,
            isLoaded: existingNames.has(t.templateName),
          })),
        };
      });

      res.json({
        success: true,
        data: agentTemplates,
        summary: {
          totalAgentTypes: agentTemplates.length,
          fullyLoadedAgents: agentTemplates.filter(a => a.allLoaded).length,
        },
      });
    } catch (error: any) {
      console.error("❌ [DEFAULT TEMPLATES] Error fetching defaults:", error);
      res.status(500).json({
        success: false,
        error: error.message || "Failed to fetch default templates",
      });
    }
  }
);

/**
 * POST /api/whatsapp/custom-templates/load-defaults/:agentType
 * Load default templates for a specific agent type
 */
router.post(
  "/whatsapp/custom-templates/load-defaults/:agentType",
  authenticateToken,
  requireRole("consultant"),
  async (req: AuthRequest, res) => {
    try {
      const consultantId = req.user!.id;
      const agentType = req.params.agentType as TemplateAgentType;

      // Validate agent type
      const validAgentTypes = Object.keys(DEFAULT_TEMPLATES_BY_AGENT);
      if (!validAgentTypes.includes(agentType)) {
        return res.status(400).json({
          success: false,
          error: `Invalid agent type. Valid types: ${validAgentTypes.join(", ")}`,
        });
      }

      const defaultTemplates = DEFAULT_TEMPLATES_BY_AGENT[agentType];

      // Get existing templates to avoid duplicates
      const existingTemplates = await db
        .select({
          templateName: schema.whatsappCustomTemplates.templateName,
        })
        .from(schema.whatsappCustomTemplates)
        .where(
          and(
            eq(schema.whatsappCustomTemplates.consultantId, consultantId),
            eq(schema.whatsappCustomTemplates.targetAgentType, agentType),
            eq(schema.whatsappCustomTemplates.isSystemTemplate, true)
          )
        );

      const existingNames = new Set(existingTemplates.map(t => t.templateName));

      // Filter out templates that already exist
      const templatesToCreate = defaultTemplates.filter(t => !existingNames.has(t.templateName));

      if (templatesToCreate.length === 0) {
        return res.json({
          success: true,
          message: "Tutti i template predefiniti sono già stati caricati",
          created: 0,
          skipped: defaultTemplates.length,
        });
      }

      // Load variable catalog for mapping
      const catalogVariables = await db
        .select({
          id: whatsappVariableCatalog.id,
          variableKey: whatsappVariableCatalog.variableKey,
        })
        .from(whatsappVariableCatalog);
      
      const catalogMap = new Map(catalogVariables.map(v => [v.variableKey, v.id]));

      // Create templates and their versions
      let createdCount = 0;
      for (const template of templatesToCreate) {
        console.log(`📝 [DEFAULT TEMPLATES] Creating template: ${template.templateName} with targetAgentType: ${template.targetAgentType}`);

        const [newTemplate] = await db
          .insert(schema.whatsappCustomTemplates)
          .values({
            consultantId,
            templateName: template.templateName,
            description: template.description,
            body: template.body,
            useCase: template.useCase,
            targetAgentType: template.targetAgentType,
            isSystemTemplate: true,
            isActive: true,
          })
          .returning();

        console.log(`✅ [DEFAULT TEMPLATES] Created template ID: ${newTemplate.id}, targetAgentType: ${newTemplate.targetAgentType}`);

        const [newVersion] = await db
          .insert(whatsappTemplateVersions)
          .values({
            templateId: newTemplate.id,
            versionNumber: 1,
            bodyText: template.body,
            isActive: true,
            createdBy: consultantId,
          })
          .returning();

        // Extract variables from body and create variable mappings
        const variableRegex = /\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g;
        const foundVariables: string[] = [];
        let match;
        while ((match = variableRegex.exec(template.body)) !== null) {
          if (!foundVariables.includes(match[1])) {
            foundVariables.push(match[1]);
          }
        }

        // Create variable mappings for each found variable
        let position = 1;
        for (const variableKey of foundVariables) {
          const catalogId = catalogMap.get(variableKey);
          if (catalogId) {
            await db
              .insert(whatsappTemplateVariables)
              .values({
                templateVersionId: newVersion.id,
                variableCatalogId: catalogId,
                position: position,
              });
            console.log(`  ✅ Mapped variable {${variableKey}} -> position ${position}`);
            position++;
          } else {
            console.log(`  ⚠️ Variable {${variableKey}} not found in catalog, skipping`);
          }
        }

        createdCount++;
      }

      console.log(`✅ [DEFAULT TEMPLATES] Created ${createdCount} templates for ${agentType}`);

      res.json({
        success: true,
        message: `Caricati ${createdCount} template predefiniti per ${AGENT_TYPE_LABELS[agentType]}`,
        created: createdCount,
        skipped: defaultTemplates.length - createdCount,
      });
    } catch (error: any) {
      console.error("❌ [DEFAULT TEMPLATES] Error loading defaults:", error);
      res.status(500).json({
        success: false,
        error: error.message || "Failed to load default templates",
      });
    }
  }
);

/**
 * POST /api/whatsapp/custom-templates/fix-missing-variables
 * Fix templates that are missing variable mappings (for already loaded templates)
 */
router.post(
  "/whatsapp/custom-templates/fix-missing-variables",
  authenticateToken,
  requireRole("consultant"),
  async (req: AuthRequest, res) => {
    try {
      const consultantId = req.user!.id;

      // Load variable catalog
      const catalogVariables = await db
        .select({
          id: whatsappVariableCatalog.id,
          variableKey: whatsappVariableCatalog.variableKey,
        })
        .from(whatsappVariableCatalog);
      
      const catalogMap = new Map(catalogVariables.map(v => [v.variableKey, v.id]));

      // Get all templates with their active versions
      const templatesWithVersions = await db
        .select({
          templateId: schema.whatsappCustomTemplates.id,
          templateName: schema.whatsappCustomTemplates.templateName,
          versionId: whatsappTemplateVersions.id,
          bodyText: whatsappTemplateVersions.bodyText,
        })
        .from(schema.whatsappCustomTemplates)
        .innerJoin(
          whatsappTemplateVersions,
          and(
            eq(whatsappTemplateVersions.templateId, schema.whatsappCustomTemplates.id),
            eq(whatsappTemplateVersions.isActive, true)
          )
        )
        .where(eq(schema.whatsappCustomTemplates.consultantId, consultantId));

      let fixedCount = 0;
      let skippedCount = 0;

      for (const template of templatesWithVersions) {
        // Check if variables already exist for this version
        const existingVars = await db
          .select({ id: whatsappTemplateVariables.id })
          .from(whatsappTemplateVariables)
          .where(eq(whatsappTemplateVariables.templateVersionId, template.versionId))
          .limit(1);

        if (existingVars.length > 0) {
          skippedCount++;
          continue; // Already has variables
        }

        // Extract variables from body
        const variableRegex = /\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g;
        const foundVariables: string[] = [];
        let match;
        while ((match = variableRegex.exec(template.bodyText || "")) !== null) {
          if (!foundVariables.includes(match[1])) {
            foundVariables.push(match[1]);
          }
        }

        if (foundVariables.length === 0) {
          skippedCount++;
          continue; // No variables to add
        }

        // Create variable mappings
        let position = 1;
        for (const variableKey of foundVariables) {
          const catalogId = catalogMap.get(variableKey);
          if (catalogId) {
            await db
              .insert(whatsappTemplateVariables)
              .values({
                templateVersionId: template.versionId,
                variableCatalogId: catalogId,
                position: position,
              });
            position++;
          }
        }

        if (position > 1) {
          console.log(`✅ [FIX VARIABLES] Fixed template "${template.templateName}" with ${position - 1} variables`);
          fixedCount++;
        }
      }

      res.json({
        success: true,
        message: `Corretti ${fixedCount} template. ${skippedCount} template già a posto o senza variabili.`,
        fixed: fixedCount,
        skipped: skippedCount,
      });
    } catch (error: any) {
      console.error("❌ [FIX VARIABLES] Error:", error);
      res.status(500).json({
        success: false,
        error: error.message || "Failed to fix template variables",
      });
    }
  }
);

/**
 * GET /api/whatsapp/custom-templates/by-agent-type/:agentType
 * Get all templates for a specific agent type (both system and custom)
 */
router.get(
  "/whatsapp/custom-templates/by-agent-type/:agentType",
  authenticateToken,
  requireRole("consultant"),
  async (req: AuthRequest, res) => {
    try {
      const consultantId = req.user!.id;
      const agentType = req.params.agentType;

      const templates = await db
        .select({
          id: schema.whatsappCustomTemplates.id,
          templateName: schema.whatsappCustomTemplates.templateName,
          description: schema.whatsappCustomTemplates.description,
          body: schema.whatsappCustomTemplates.body,
          useCase: schema.whatsappCustomTemplates.useCase,
          targetAgentType: schema.whatsappCustomTemplates.targetAgentType,
          isSystemTemplate: schema.whatsappCustomTemplates.isSystemTemplate,
          isActive: schema.whatsappCustomTemplates.isActive,
          archivedAt: schema.whatsappCustomTemplates.archivedAt,
          createdAt: schema.whatsappCustomTemplates.createdAt,
          versionId: whatsappTemplateVersions.id,
          versionNumber: whatsappTemplateVersions.versionNumber,
          twilioContentSid: whatsappTemplateVersions.twilioContentSid,
          twilioStatus: whatsappTemplateVersions.twilioStatus,
        })
        .from(schema.whatsappCustomTemplates)
        .leftJoin(
          whatsappTemplateVersions,
          and(
            eq(whatsappTemplateVersions.templateId, schema.whatsappCustomTemplates.id),
            eq(whatsappTemplateVersions.isActive, true)
          )
        )
        .where(
          and(
            eq(schema.whatsappCustomTemplates.consultantId, consultantId),
            eq(schema.whatsappCustomTemplates.targetAgentType, agentType)
          )
        )
        .orderBy(schema.whatsappCustomTemplates.createdAt);

      const approved = templates.filter(t => t.twilioStatus === "approved");
      const pending = templates.filter(t => t.twilioStatus === "pending_approval" || t.twilioStatus === "pending");
      const localDrafts = templates.filter(t => !t.twilioContentSid);
      const rejected = templates.filter(t => t.twilioStatus === "rejected");

      res.json({
        success: true,
        data: {
          agentType,
          agentLabel: AGENT_TYPE_LABELS[agentType as TemplateAgentType] || agentType,
          templates,
          grouped: { approved, pending, localDrafts, rejected },
          counts: {
            total: templates.length,
            approved: approved.length,
            pending: pending.length,
            localDrafts: localDrafts.length,
            rejected: rejected.length,
          },
        },
      });
    } catch (error: any) {
      console.error("❌ [TEMPLATES BY AGENT] Error:", error);
      res.status(500).json({
        success: false,
        error: error.message || "Failed to fetch templates by agent type",
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

/**
 * POST /api/whatsapp/custom-templates/generate-with-ai
 * Generate a template using AI based on a natural language description
 */
router.post(
  "/whatsapp/custom-templates/generate-with-ai",
  authenticateToken,
  requireRole("consultant"),
  async (req: AuthRequest, res) => {
    try {
      const consultantId = req.user!.id;

      // Validate request body
      const generateSchema = z.object({
        description: z.string().min(10, "La descrizione deve essere almeno di 10 caratteri"),
      });

      const validationResult = generateSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({
          success: false,
          error: "Validazione fallita",
          details: validationResult.error.errors,
        });
      }

      const { description } = validationResult.data;

      // Get AI provider
      const { getAIProvider, getModelWithThinking } = await import("../../ai/provider-factory");
      const provider = await getAIProvider(consultantId);

      if (!provider) {
        return res.status(500).json({
          success: false,
          error: "Impossibile ottenere il provider AI. Verifica la configurazione.",
        });
      }

      // Fetch available variables from catalog
      const catalogVariables = await db
        .select({
          variableKey: whatsappVariableCatalog.variableKey,
          variableName: whatsappVariableCatalog.variableName,
          description: whatsappVariableCatalog.description,
        })
        .from(whatsappVariableCatalog);

      const variablesListText = catalogVariables
        .map(v => `- {${v.variableKey}}: ${v.variableName} - ${v.description}`)
        .join("\n");

      // Build AI prompt
      const systemPrompt = `Sei un esperto di copywriting per messaggi WhatsApp aziendali in italiano.
Il tuo compito è generare template di messaggi WhatsApp efficaci e professionali.

REGOLE IMPORTANTI:
1. I messaggi devono essere in ITALIANO
2. Devono essere brevi, diretti e professionali (max 500 caratteri)
3. Usa un tono cordiale ma professionale
4. Puoi usare SOLO queste variabili disponibili (racchiuse tra parentesi graffe):
${variablesListText}

5. Il tipo di template deve essere uno di questi:
   - "opening": Primo contatto con un nuovo lead
   - "followup_gentle": Follow-up gentile dopo primo contatto
   - "followup_value": Follow-up con proposta di valore
   - "followup_final": Follow-up finale/ultimo tentativo

6. Il nome del template deve essere breve e descrittivo (senza spazi, usa underscore)

FORMATO OUTPUT (JSON valido):
{
  "templateName": "nome_template_esempio",
  "templateType": "opening|followup_gentle|followup_value|followup_final",
  "description": "Breve descrizione del template",
  "bodyText": "Testo del messaggio con {nome_lead} e altre variabili"
}

Rispondi SOLO con il JSON, senza altro testo.`;

      const userPrompt = `Genera un template WhatsApp basato su questa richiesta dell'utente:

"${description}"

Ricorda: rispondi SOLO con il JSON valido.`;

      console.log(`🤖 [AI TEMPLATE] Generating template for consultant ${consultantId}`);

      const { model, useThinking, thinkingLevel } = getModelWithThinking(provider.metadata?.name || 'Vertex AI');
      console.log(`   🧠 [AI] Using model: ${model}, thinking: ${useThinking ? `enabled (${thinkingLevel})` : 'disabled'}`);

      const result = await provider.client.generateContent({
        model,
        contents: [
          { role: "user", parts: [{ text: userPrompt }] }
        ],
        generationConfig: {
          systemInstruction: systemPrompt,
          temperature: 0.7,
          maxOutputTokens: 1024,
          ...(useThinking && { thinkingConfig: { thinkingLevel } }),
        },
      });

      const responseText = result.response.text();
      console.log(`🤖 [AI TEMPLATE] Raw response:`, responseText);

      // Parse JSON response
      let generatedTemplate;
      try {
        // Clean up response - remove markdown code blocks if present
        let cleanJson = responseText.trim();
        if (cleanJson.startsWith("```json")) {
          cleanJson = cleanJson.slice(7);
        }
        if (cleanJson.startsWith("```")) {
          cleanJson = cleanJson.slice(3);
        }
        if (cleanJson.endsWith("```")) {
          cleanJson = cleanJson.slice(0, -3);
        }
        cleanJson = cleanJson.trim();

        generatedTemplate = JSON.parse(cleanJson);
      } catch (parseError) {
        console.error("❌ [AI TEMPLATE] Failed to parse AI response:", parseError);
        return res.status(500).json({
          success: false,
          error: "L'AI ha restituito una risposta non valida. Riprova.",
        });
      }

      // Validate the generated template structure
      const templateValidation = z.object({
        templateName: z.string().min(1),
        templateType: z.enum(["opening", "followup_gentle", "followup_value", "followup_final"]),
        description: z.string().optional(),
        bodyText: z.string().min(1),
      });

      const parsedTemplate = templateValidation.safeParse(generatedTemplate);
      if (!parsedTemplate.success) {
        console.error("❌ [AI TEMPLATE] Invalid template structure:", parsedTemplate.error);
        return res.status(500).json({
          success: false,
          error: "Il template generato non è valido. Riprova con una descrizione diversa.",
        });
      }

      // Extract variables from bodyText and build variable mappings
      const { extractVariablesFromText } = await import("../../validators/whatsapp/custom-template-schema");
      const extractedVars = extractVariablesFromText(parsedTemplate.data.bodyText);

      // Filter to only include valid catalog variables
      const validVariableKeys = catalogVariables.map(v => v.variableKey);
      const validExtractedVars = extractedVars.filter(v => validVariableKeys.includes(v));

      // Build variable mappings with positions
      const variables = validExtractedVars.map((varKey, index) => ({
        variableKey: varKey,
        position: index + 1,
      }));

      console.log(`✅ [AI TEMPLATE] Generated template: ${parsedTemplate.data.templateName}`);

      res.json({
        success: true,
        data: {
          templateName: parsedTemplate.data.templateName,
          templateType: parsedTemplate.data.templateType,
          description: parsedTemplate.data.description || "",
          bodyText: parsedTemplate.data.bodyText,
          variables,
          extractedVariables: validExtractedVars,
        },
      });

      // Cleanup AI provider if needed
      if (provider.cleanup) {
        await provider.cleanup();
      }
    } catch (error: any) {
      console.error("❌ [AI TEMPLATE] Error generating template:", error);
      res.status(500).json({
        success: false,
        error: error.message || "Errore durante la generazione del template",
      });
    }
  }
);

/**
 * POST /api/whatsapp/custom-templates/sync-twilio-status
 * Sync Twilio approval status for all templates that have been exported
 */
router.post(
  "/whatsapp/custom-templates/sync-twilio-status",
  authenticateToken,
  requireRole("consultant"),
  async (req: AuthRequest, res) => {
    try {
      const consultantId = req.user!.id;
      const { agentConfigId } = req.body;

      if (!agentConfigId) {
        return res.status(400).json({
          success: false,
          error: "agentConfigId è richiesto",
        });
      }

      // Get agent config with Twilio credentials
      const [agentConfig] = await db
        .select()
        .from(consultantWhatsappConfig)
        .where(
          and(
            eq(consultantWhatsappConfig.id, agentConfigId),
            eq(consultantWhatsappConfig.consultantId, consultantId)
          )
        )
        .limit(1);

      if (!agentConfig) {
        return res.status(404).json({
          success: false,
          error: "Configurazione agente non trovata",
        });
      }

      if (!agentConfig.twilioAccountSid || !agentConfig.twilioAuthToken) {
        return res.status(400).json({
          success: false,
          error: "Credenziali Twilio non configurate per questo agente",
        });
      }

      // Get all template versions with twilioContentSid
      const versionsWithTwilio = await db
        .select({
          id: whatsappTemplateVersions.id,
          templateId: whatsappTemplateVersions.templateId,
          twilioContentSid: whatsappTemplateVersions.twilioContentSid,
          twilioStatus: whatsappTemplateVersions.twilioStatus,
        })
        .from(whatsappTemplateVersions)
        .innerJoin(
          schema.whatsappCustomTemplates,
          eq(whatsappTemplateVersions.templateId, schema.whatsappCustomTemplates.id)
        )
        .where(
          and(
            eq(schema.whatsappCustomTemplates.consultantId, consultantId),
            sql`${whatsappTemplateVersions.twilioContentSid} IS NOT NULL`
          )
        );

      if (versionsWithTwilio.length === 0) {
        return res.json({
          success: true,
          message: "Nessun template da sincronizzare",
          updated: 0,
          results: [],
        });
      }

      console.log(`🔄 [SYNC TWILIO] Syncing ${versionsWithTwilio.length} templates for consultant ${consultantId}`);

      const { checkTemplateApprovalStatus } = await import("../../services/whatsapp/template-approval-checker");
      const results: Array<{ versionId: string; contentSid: string; oldStatus: string | null; newStatus: string; success: boolean }> = [];

      for (const version of versionsWithTwilio) {
        try {
          const statusResult = await checkTemplateApprovalStatus(
            agentConfig.twilioAccountSid!,
            agentConfig.twilioAuthToken!,
            version.twilioContentSid!
          );

          // Map Twilio status to our enum
          let dbStatus: "draft" | "pending_approval" | "approved" | "rejected" = "draft";
          if (statusResult.status === "approved") {
            dbStatus = "approved";
          } else if (statusResult.status === "pending" || statusResult.status === "received") {
            dbStatus = "pending_approval";
          } else if (statusResult.status === "rejected" || statusResult.status === "paused" || statusResult.status === "disabled") {
            dbStatus = "rejected";
          }

          // Update version in DB
          await db
            .update(whatsappTemplateVersions)
            .set({ twilioStatus: dbStatus })
            .where(eq(whatsappTemplateVersions.id, version.id));

          results.push({
            versionId: version.id,
            contentSid: version.twilioContentSid!,
            oldStatus: version.twilioStatus,
            newStatus: dbStatus,
            success: true,
          });

          console.log(`✅ [SYNC TWILIO] Updated ${version.twilioContentSid}: ${version.twilioStatus} -> ${dbStatus}`);
        } catch (error: any) {
          console.error(`❌ [SYNC TWILIO] Error syncing ${version.twilioContentSid}:`, error.message);
          results.push({
            versionId: version.id,
            contentSid: version.twilioContentSid!,
            oldStatus: version.twilioStatus,
            newStatus: "error",
            success: false,
          });
        }
      }

      const successCount = results.filter(r => r.success).length;

      res.json({
        success: true,
        message: `Sincronizzati ${successCount}/${versionsWithTwilio.length} template`,
        updated: successCount,
        results,
      });
    } catch (error: any) {
      console.error("❌ [SYNC TWILIO] Error:", error);
      res.status(500).json({
        success: false,
        error: error.message || "Errore durante la sincronizzazione",
      });
    }
  }
);

/**
 * POST /api/whatsapp/custom-templates/verify-agent-credentials
 * Verify that an agent has valid Twilio credentials configured
 */
router.post(
  "/whatsapp/custom-templates/verify-agent-credentials",
  authenticateToken,
  requireRole("consultant"),
  async (req: AuthRequest, res) => {
    try {
      const consultantId = req.user!.id;
      const { agentConfigId } = req.body;

      if (!agentConfigId) {
        return res.status(400).json({
          success: false,
          error: "agentConfigId è richiesto",
        });
      }

      const [agentConfig] = await db
        .select({
          id: consultantWhatsappConfig.id,
          agentName: consultantWhatsappConfig.agentName,
          twilioAccountSid: consultantWhatsappConfig.twilioAccountSid,
          twilioAuthToken: consultantWhatsappConfig.twilioAuthToken,
          twilioWhatsappNumber: consultantWhatsappConfig.twilioWhatsappNumber,
        })
        .from(consultantWhatsappConfig)
        .where(
          and(
            eq(consultantWhatsappConfig.id, agentConfigId),
            eq(consultantWhatsappConfig.consultantId, consultantId)
          )
        )
        .limit(1);

      if (!agentConfig) {
        return res.status(404).json({
          success: false,
          error: "Configurazione agente non trovata",
        });
      }

      const missingFields: string[] = [];
      if (!agentConfig.twilioAccountSid) missingFields.push("Twilio Account SID");
      if (!agentConfig.twilioAuthToken) missingFields.push("Twilio Auth Token");
      if (!agentConfig.twilioWhatsappNumber) missingFields.push("Numero WhatsApp Twilio");

      if (missingFields.length > 0) {
        return res.json({
          success: false,
          valid: false,
          agentName: agentConfig.agentName,
          missingFields,
          message: `Configura: ${missingFields.join(", ")}`,
        });
      }

      res.json({
        success: true,
        valid: true,
        agentName: agentConfig.agentName,
        message: "Credenziali Twilio configurate correttamente",
      });
    } catch (error: any) {
      console.error("❌ [VERIFY CREDENTIALS] Error:", error);
      res.status(500).json({
        success: false,
        error: error.message || "Errore durante la verifica",
      });
    }
  }
);

/**
 * POST /api/whatsapp/custom-templates/fetch-from-twilio
 * Fetch all templates directly from Twilio Content API and compare with local DB
 */
router.post(
  "/whatsapp/custom-templates/fetch-from-twilio",
  authenticateToken,
  requireRole("consultant"),
  async (req: AuthRequest, res) => {
    try {
      const consultantId = req.user!.id;
      const { agentConfigId } = req.body;

      if (!agentConfigId) {
        return res.status(400).json({
          success: false,
          error: "agentConfigId è richiesto",
        });
      }

      const [agentConfig] = await db
        .select()
        .from(consultantWhatsappConfig)
        .where(
          and(
            eq(consultantWhatsappConfig.id, agentConfigId),
            eq(consultantWhatsappConfig.consultantId, consultantId)
          )
        )
        .limit(1);

      if (!agentConfig) {
        return res.status(404).json({
          success: false,
          error: "Configurazione agente non trovata",
        });
      }

      if (!agentConfig.twilioAccountSid || !agentConfig.twilioAuthToken) {
        return res.status(400).json({
          success: false,
          error: "Credenziali Twilio non configurate per questo agente",
        });
      }

      const twilio = (await import('twilio')).default;
      const twilioClient = twilio(agentConfig.twilioAccountSid, agentConfig.twilioAuthToken);

      console.log(`🔍 [FETCH TWILIO] Fetching all templates from Twilio for agent ${agentConfig.agentName}`);

      const twilioTemplates = await twilioClient.content.v1.contents.list({ limit: 100 });

      console.log(`📋 [FETCH TWILIO] Found ${twilioTemplates.length} templates on Twilio`);

      const templatesWithStatus = await Promise.all(
        twilioTemplates.map(async (t) => {
          let approvalStatus = "unknown";
          try {
            const approvalRequests = t.approvalRequests as any;
            if (approvalRequests?.whatsapp?.status) {
              approvalStatus = approvalRequests.whatsapp.status;
            }
          } catch (e) { }

          return {
            sid: t.sid,
            friendlyName: t.friendlyName,
            language: t.language,
            dateCreated: t.dateCreated,
            approvalStatus,
            bodyPreview: (() => {
              try {
                const types = t.types as any;
                if (types?.['twilio/text']?.body) {
                  return types['twilio/text'].body.substring(0, 100) + (types['twilio/text'].body.length > 100 ? '...' : '');
                }
                return null;
              } catch (e) {
                return null;
              }
            })(),
          };
        })
      );

      const localVersions = await db
        .select({
          id: whatsappTemplateVersions.id,
          templateId: whatsappTemplateVersions.templateId,
          templateName: schema.whatsappCustomTemplates.templateName,
          twilioContentSid: whatsappTemplateVersions.twilioContentSid,
          twilioStatus: whatsappTemplateVersions.twilioStatus,
          versionNumber: whatsappTemplateVersions.versionNumber,
        })
        .from(whatsappTemplateVersions)
        .innerJoin(
          schema.whatsappCustomTemplates,
          eq(whatsappTemplateVersions.templateId, schema.whatsappCustomTemplates.id)
        )
        .where(eq(schema.whatsappCustomTemplates.consultantId, consultantId));

      const matchedTemplates = templatesWithStatus.map((twilioT) => {
        const localMatch = localVersions.find((v) => v.twilioContentSid === twilioT.sid);
        return {
          ...twilioT,
          linkedToLocal: !!localMatch,
          localTemplateName: localMatch?.templateName || null,
          localVersionId: localMatch?.id || null,
          localStatus: localMatch?.twilioStatus || null,
          statusMismatch: localMatch ? localMatch.twilioStatus !== twilioT.approvalStatus : false,
        };
      });

      const orphanedLocal = localVersions.filter(
        (v) => v.twilioContentSid && !templatesWithStatus.find((t) => t.sid === v.twilioContentSid)
      );

      res.json({
        success: true,
        agentName: agentConfig.agentName,
        twilioTemplates: matchedTemplates,
        orphanedLocalTemplates: orphanedLocal.map((o) => ({
          versionId: o.id,
          templateName: o.templateName,
          twilioContentSid: o.twilioContentSid,
          localStatus: o.twilioStatus,
          message: "Template non trovato su Twilio (cancellato o SID errato)",
        })),
        summary: {
          totalOnTwilio: twilioTemplates.length,
          approvedOnTwilio: matchedTemplates.filter((t) => t.approvalStatus === "approved").length,
          pendingOnTwilio: matchedTemplates.filter((t) => t.approvalStatus === "pending" || t.approvalStatus === "received").length,
          linkedToLocal: matchedTemplates.filter((t) => t.linkedToLocal).length,
          orphanedLocal: orphanedLocal.length,
        },
      });
    } catch (error: any) {
      console.error("❌ [FETCH TWILIO] Error:", error);
      res.status(500).json({
        success: false,
        error: error.message || "Errore durante il recupero dei template da Twilio",
      });
    }
  }
);

/**
 * POST /api/whatsapp/custom-templates/link-twilio-template
 * Link an existing Twilio template to a local template version
 */
router.post(
  "/whatsapp/custom-templates/link-twilio-template",
  authenticateToken,
  requireRole("consultant"),
  async (req: AuthRequest, res) => {
    try {
      const consultantId = req.user!.id;
      const { versionId, twilioContentSid, agentConfigId } = req.body;

      if (!versionId || !twilioContentSid || !agentConfigId) {
        return res.status(400).json({
          success: false,
          error: "versionId, twilioContentSid e agentConfigId sono richiesti",
        });
      }

      const [agentConfig] = await db
        .select()
        .from(consultantWhatsappConfig)
        .where(
          and(
            eq(consultantWhatsappConfig.id, agentConfigId),
            eq(consultantWhatsappConfig.consultantId, consultantId)
          )
        )
        .limit(1);

      if (!agentConfig || !agentConfig.twilioAccountSid || !agentConfig.twilioAuthToken) {
        return res.status(400).json({
          success: false,
          error: "Credenziali Twilio non configurate",
        });
      }

      const twilio = (await import('twilio')).default;
      const twilioClient = twilio(agentConfig.twilioAccountSid, agentConfig.twilioAuthToken);

      const content = await twilioClient.content.v1.contents(twilioContentSid).fetch();

      let approvalStatus: "draft" | "pending_approval" | "approved" | "rejected" = "draft";
      const approvalRequests = content.approvalRequests as any;
      if (approvalRequests?.whatsapp?.status) {
        const status = approvalRequests.whatsapp.status;
        if (status === "approved") approvalStatus = "approved";
        else if (status === "pending" || status === "received") approvalStatus = "pending_approval";
        else if (status === "rejected" || status === "paused" || status === "disabled") approvalStatus = "rejected";
      }

      await db
        .update(whatsappTemplateVersions)
        .set({
          twilioContentSid,
          twilioStatus: approvalStatus,
          lastSyncedAt: new Date(),
        })
        .where(eq(whatsappTemplateVersions.id, versionId));

      res.json({
        success: true,
        message: `Template collegato con successo. Stato: ${approvalStatus}`,
        twilioContentSid,
        approvalStatus,
      });
    } catch (error: any) {
      console.error("❌ [LINK TEMPLATE] Error:", error);
      res.status(500).json({
        success: false,
        error: error.message || "Errore durante il collegamento del template",
      });
    }
  }
);

// Note: DEFAULT TEMPLATES ENDPOINTS moved above /:id route to avoid route collision

export default router;

