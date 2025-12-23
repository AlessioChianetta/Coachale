import { Router, type Response } from "express";
import { db } from "../../db";
import { eq, and, isNull } from "drizzle-orm";
import {
  whatsappTemplateAssignments,
  whatsappCustomTemplates,
  whatsappTemplateVersions,
  consultantWhatsappConfig,
} from "../../../shared/schema";
import { authenticateToken, requireRole, type AuthRequest } from "../../middleware/auth";
import twilio from "twilio";

const router = Router();

interface TwilioTemplateInfo {
  friendlyName: string;
  bodyText: string;
  approvalStatus?: string;
}

async function fetchTwilioTemplatesInfo(
  accountSid: string,
  authToken: string,
  templateSids: string[]
): Promise<Map<string, TwilioTemplateInfo>> {
  const templateMap = new Map<string, TwilioTemplateInfo>();
  
  if (templateSids.length === 0 || !accountSid || !authToken) {
    return templateMap;
  }

  const extractWhatsAppBody = (types: any): string => {
    if (types?.['twilio/whatsapp']?.template?.components) {
      const bodyComponent = types['twilio/whatsapp'].template.components.find(
        (component: any) => component.type === 'BODY'
      );
      return bodyComponent?.text || '';
    }
    return types?.['twilio/text']?.body || '';
  };

  try {
    const twilioClient = twilio(accountSid, authToken);
    
    // Fetch each template directly by SID to avoid pagination issues
    const fetchPromises = templateSids.map(async (sid) => {
      try {
        const content = await twilioClient.content.v1.contents(sid).fetch();
        templateMap.set(sid, {
          friendlyName: content.friendlyName || sid,
          bodyText: extractWhatsAppBody(content.types),
          approvalStatus: 'approved',
        });
      } catch (err: any) {
        console.warn(`[TEMPLATE ASSIGNMENTS] Failed to fetch template ${sid}: ${err.message}`);
      }
    });

    await Promise.all(fetchPromises);

    console.log(`[TEMPLATE ASSIGNMENTS] Fetched ${templateMap.size}/${templateSids.length} Twilio templates info`);
  } catch (error: any) {
    console.error("[TEMPLATE ASSIGNMENTS] Error fetching Twilio templates info:", error.message);
  }

  return templateMap;
}

/**
 * GET /api/whatsapp/template-assignments/:agentConfigId
 * Fetch all template assignments for a specific agent config
 * Returns an array of all assigned templates (supports N templates per agent)
 * Handles both Twilio templates (HX prefix) and custom templates (UUID)
 */
router.get(
  "/:agentConfigId",
  authenticateToken,
  requireRole("consultant"),
  async (req: AuthRequest, res: Response) => {
    try {
      const { agentConfigId } = req.params;
      const consultantId = req.user!.id;

      const agentConfig = await db
        .select()
        .from(consultantWhatsappConfig)
        .where(
          and(
            eq(consultantWhatsappConfig.id, agentConfigId),
            eq(consultantWhatsappConfig.consultantId, consultantId)
          )
        )
        .limit(1);

      if (!agentConfig || agentConfig.length === 0) {
        return res.status(404).json({ message: "Agent configuration not found" });
      }

      // First, get ALL assignments for this agent (no INNER JOIN to avoid filtering Twilio templates)
      const allAssignments = await db
        .select({
          id: whatsappTemplateAssignments.id,
          templateId: whatsappTemplateAssignments.templateId,
          templateType: whatsappTemplateAssignments.templateType,
          priority: whatsappTemplateAssignments.priority,
          assignedAt: whatsappTemplateAssignments.assignedAt,
        })
        .from(whatsappTemplateAssignments)
        .where(eq(whatsappTemplateAssignments.agentConfigId, agentConfigId));

      const formattedAssignments = [];
      const existingTemplateIds = new Set(allAssignments.map(a => a.templateId));

      // LEGACY FALLBACK: Include templates from old 4-slot system if not in new assignments table
      const config = agentConfig[0];
      const legacyTemplates = config.whatsappTemplates as any || {};
      const legacySlots = [
        { sid: legacyTemplates.openingMessageContentSid, type: "opening", label: "Messaggio apertura" },
        { sid: legacyTemplates.followUpGentleContentSid, type: "follow_up_gentle", label: "Follow-up gentile" },
        { sid: legacyTemplates.followUpValueContentSid, type: "follow_up_value", label: "Follow-up valore" },
        { sid: legacyTemplates.followUpFinalContentSid, type: "follow_up_final", label: "Follow-up finale" },
      ];

      // Collect all Twilio template SIDs to fetch their details
      const twilioTemplateSids: string[] = [];
      for (const assignment of allAssignments) {
        if (assignment.templateId.startsWith('HX')) {
          twilioTemplateSids.push(assignment.templateId);
        }
      }
      for (const slot of legacySlots) {
        if (slot.sid && slot.sid.startsWith('HX') && !existingTemplateIds.has(slot.sid)) {
          twilioTemplateSids.push(slot.sid);
        }
      }

      // Fetch Twilio template details (friendlyName, bodyText) if there are any HX templates
      const twilioTemplatesMap = await fetchTwilioTemplatesInfo(
        config.twilioAccountSid || '',
        config.twilioAuthToken || '',
        twilioTemplateSids
      );

      for (const slot of legacySlots) {
        if (slot.sid && !existingTemplateIds.has(slot.sid)) {
          const twilioInfo = twilioTemplatesMap.get(slot.sid);
          formattedAssignments.push({
            assignmentId: `legacy-${slot.type}`,
            templateId: slot.sid,
            templateName: twilioInfo?.friendlyName || slot.sid,
            templateDescription: slot.label,
            useCase: slot.type,
            priority: 0,
            assignedAt: null,
            body: twilioInfo?.bodyText || null,
            isTwilioTemplate: true,
            isLegacy: true,
            activeVersion: {
              id: null,
              versionNumber: null,
              bodyText: twilioInfo?.bodyText || null,
              twilioStatus: "approved",
            },
          });
        }
      }

      for (const assignment of allAssignments) {
        const isTwilioTemplate = assignment.templateId.startsWith('HX');

        if (isTwilioTemplate) {
          // For Twilio templates (HX prefix), use enriched data from Twilio API
          const twilioInfo = twilioTemplatesMap.get(assignment.templateId);
          formattedAssignments.push({
            assignmentId: assignment.id,
            templateId: assignment.templateId,
            templateName: twilioInfo?.friendlyName || assignment.templateId,
            templateDescription: twilioInfo ? "Template Twilio approvato" : "Twilio pre-approved template",
            useCase: assignment.templateType || "twilio",
            priority: assignment.priority || 0,
            assignedAt: assignment.assignedAt,
            body: twilioInfo?.bodyText || null,
            isTwilioTemplate: true,
            isLegacy: false,
            activeVersion: {
              id: null,
              versionNumber: null,
              bodyText: twilioInfo?.bodyText || null,
              twilioStatus: "approved",
            },
          });
        } else {
          // For custom templates (UUID), fetch full metadata from whatsappCustomTemplates
          const customTemplateData = await db
            .select({
              templateName: whatsappCustomTemplates.templateName,
              templateDescription: whatsappCustomTemplates.description,
              useCase: whatsappCustomTemplates.useCase,
              body: whatsappCustomTemplates.body,
              activeVersionId: whatsappTemplateVersions.id,
              activeVersionNumber: whatsappTemplateVersions.versionNumber,
              activeVersionBody: whatsappTemplateVersions.bodyText,
              twilioStatus: whatsappTemplateVersions.twilioStatus,
            })
            .from(whatsappCustomTemplates)
            .leftJoin(
              whatsappTemplateVersions,
              and(
                eq(whatsappTemplateVersions.templateId, whatsappCustomTemplates.id),
                eq(whatsappTemplateVersions.isActive, true)
              )
            )
            .where(
              and(
                eq(whatsappCustomTemplates.id, assignment.templateId),
                isNull(whatsappCustomTemplates.archivedAt)
              )
            )
            .limit(1);

          if (customTemplateData.length > 0) {
            const t = customTemplateData[0];
            formattedAssignments.push({
              assignmentId: assignment.id,
              templateId: assignment.templateId,
              templateName: t.templateName,
              templateDescription: t.templateDescription,
              useCase: t.useCase || assignment.templateType || "generale",
              priority: assignment.priority || 0,
              assignedAt: assignment.assignedAt,
              body: t.body || t.activeVersionBody,
              isTwilioTemplate: false,
              isLegacy: false,
              activeVersion: t.activeVersionId
                ? {
                    id: t.activeVersionId,
                    versionNumber: t.activeVersionNumber,
                    bodyText: t.activeVersionBody,
                    twilioStatus: t.twilioStatus,
                  }
                : null,
            });
          }
          // If custom template not found (archived/deleted), skip it silently
        }
      }

      res.json({
        agentConfigId,
        assignments: formattedAssignments,
      });
    } catch (error: any) {
      console.error("[TEMPLATE ASSIGNMENTS] Error fetching assignments:", error);
      res.status(500).json({ message: "Failed to fetch template assignments" });
    }
  }
);

/**
 * POST /api/whatsapp/template-assignments
 * Add a template assignment to an agent (allows multiple templates per agent)
 * 
 * Payload: {
 *   agentConfigId: string,
 *   templateId: string,
 *   priority?: number
 * }
 */
router.post(
  "/",
  authenticateToken,
  requireRole("consultant"),
  async (req: AuthRequest, res: Response) => {
    try {
      const { agentConfigId, templateId, priority = 0 } = req.body;
      const consultantId = req.user!.id;

      if (!agentConfigId) {
        return res.status(400).json({ message: "agentConfigId is required" });
      }

      if (!templateId) {
        return res.status(400).json({ message: "templateId is required" });
      }

      const agentConfig = await db
        .select()
        .from(consultantWhatsappConfig)
        .where(
          and(
            eq(consultantWhatsappConfig.id, agentConfigId),
            eq(consultantWhatsappConfig.consultantId, consultantId)
          )
        )
        .limit(1);

      if (!agentConfig || agentConfig.length === 0) {
        return res.status(404).json({ message: "Agent configuration not found" });
      }

      const template = await db
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

      if (!template || template.length === 0) {
        return res.status(404).json({
          message: `Template not found or does not belong to you: ${templateId}`,
        });
      }

      const existingAssignment = await db
        .select()
        .from(whatsappTemplateAssignments)
        .where(
          and(
            eq(whatsappTemplateAssignments.agentConfigId, agentConfigId),
            eq(whatsappTemplateAssignments.templateId, templateId)
          )
        )
        .limit(1);

      if (existingAssignment && existingAssignment.length > 0) {
        await db
          .update(whatsappTemplateAssignments)
          .set({
            priority,
            updatedAt: new Date(),
          })
          .where(eq(whatsappTemplateAssignments.id, existingAssignment[0].id));

        return res.json({
          message: "Template assignment updated",
          assignmentId: existingAssignment[0].id,
          action: "updated",
        });
      }

      const newAssignment = await db
        .insert(whatsappTemplateAssignments)
        .values({
          agentConfigId,
          templateId,
          priority,
          templateType: template[0].templateType,
        })
        .returning();

      res.json({
        message: "Template assigned successfully",
        assignmentId: newAssignment[0].id,
        action: "created",
      });
    } catch (error: any) {
      console.error("[TEMPLATE ASSIGNMENTS] Error creating assignment:", error);
      res.status(500).json({ message: "Failed to create template assignment" });
    }
  }
);

/**
 * POST /api/whatsapp/template-assignments/bulk
 * Bulk save template assignments for an agent (replaces all existing assignments)
 * Supports both Twilio templates (SID starting with HX) and custom templates (UUID)
 * 
 * Payload: {
 *   agentConfigId: string,
 *   templateIds: string[]
 * }
 */
router.post(
  "/bulk",
  authenticateToken,
  requireRole("consultant"),
  async (req: AuthRequest, res: Response) => {
    try {
      const { agentConfigId, templateIds } = req.body;
      const consultantId = req.user!.id;

      if (!agentConfigId) {
        return res.status(400).json({ message: "agentConfigId is required" });
      }

      if (!Array.isArray(templateIds)) {
        return res.status(400).json({ message: "templateIds must be an array" });
      }

      const agentConfig = await db
        .select()
        .from(consultantWhatsappConfig)
        .where(
          and(
            eq(consultantWhatsappConfig.id, agentConfigId),
            eq(consultantWhatsappConfig.consultantId, consultantId)
          )
        )
        .limit(1);

      if (!agentConfig || agentConfig.length === 0) {
        return res.status(404).json({ message: "Agent configuration not found" });
      }

      await db
        .delete(whatsappTemplateAssignments)
        .where(eq(whatsappTemplateAssignments.agentConfigId, agentConfigId));

      const results = [];
      for (let i = 0; i < templateIds.length; i++) {
        const templateId = templateIds[i];
        
        // Check if this is a Twilio template (SID starting with HX) or a custom template (UUID)
        const isTwilioTemplate = templateId.startsWith('HX');
        
        if (isTwilioTemplate) {
          // For Twilio templates, save directly without checking custom templates table
          const newAssignment = await db
            .insert(whatsappTemplateAssignments)
            .values({
              agentConfigId,
              templateId,
              priority: templateIds.length - i,
              templateType: "twilio", // Mark as Twilio template
            })
            .returning();

          results.push({
            templateId,
            assignmentId: newAssignment[0].id,
            action: "assigned",
            type: "twilio",
          });
        } else {
          // For custom templates, verify they exist and belong to the consultant
          const template = await db
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

          if (template && template.length > 0) {
            const newAssignment = await db
              .insert(whatsappTemplateAssignments)
              .values({
                agentConfigId,
                templateId,
                priority: templateIds.length - i,
                templateType: template[0].templateType,
              })
              .returning();

            results.push({
              templateId,
              assignmentId: newAssignment[0].id,
              action: "assigned",
              type: "custom",
            });
          }
        }
      }

      console.log(`[TEMPLATE ASSIGNMENTS] Bulk saved ${results.length} templates for agent ${agentConfigId}`);

      res.json({
        message: "Template assignments saved successfully",
        agentConfigId,
        assignedCount: results.length,
        results,
      });
    } catch (error: any) {
      console.error("[TEMPLATE ASSIGNMENTS] Error bulk saving assignments:", error);
      res.status(500).json({ message: "Failed to save template assignments" });
    }
  }
);

/**
 * DELETE /api/whatsapp/template-assignments/:assignmentId
 * Remove a specific template assignment
 */
router.delete(
  "/:assignmentId",
  authenticateToken,
  requireRole("consultant"),
  async (req: AuthRequest, res: Response) => {
    try {
      const { assignmentId } = req.params;
      const consultantId = req.user!.id;

      const assignment = await db
        .select({
          id: whatsappTemplateAssignments.id,
          agentConfigId: whatsappTemplateAssignments.agentConfigId,
        })
        .from(whatsappTemplateAssignments)
        .innerJoin(
          consultantWhatsappConfig,
          eq(whatsappTemplateAssignments.agentConfigId, consultantWhatsappConfig.id)
        )
        .where(
          and(
            eq(whatsappTemplateAssignments.id, assignmentId),
            eq(consultantWhatsappConfig.consultantId, consultantId)
          )
        )
        .limit(1);

      if (!assignment || assignment.length === 0) {
        return res.status(404).json({ message: "Assignment not found" });
      }

      await db
        .delete(whatsappTemplateAssignments)
        .where(eq(whatsappTemplateAssignments.id, assignmentId));

      res.json({
        message: "Template assignment removed successfully",
        assignmentId,
      });
    } catch (error: any) {
      console.error("[TEMPLATE ASSIGNMENTS] Error deleting assignment:", error);
      res.status(500).json({ message: "Failed to delete template assignment" });
    }
  }
);

/**
 * PATCH /api/whatsapp/template-assignments/:assignmentId/priority
 * Update priority of a template assignment
 */
router.patch(
  "/:assignmentId/priority",
  authenticateToken,
  requireRole("consultant"),
  async (req: AuthRequest, res: Response) => {
    try {
      const { assignmentId } = req.params;
      const { priority } = req.body;
      const consultantId = req.user!.id;

      if (typeof priority !== "number") {
        return res.status(400).json({ message: "priority must be a number" });
      }

      const assignment = await db
        .select({
          id: whatsappTemplateAssignments.id,
        })
        .from(whatsappTemplateAssignments)
        .innerJoin(
          consultantWhatsappConfig,
          eq(whatsappTemplateAssignments.agentConfigId, consultantWhatsappConfig.id)
        )
        .where(
          and(
            eq(whatsappTemplateAssignments.id, assignmentId),
            eq(consultantWhatsappConfig.consultantId, consultantId)
          )
        )
        .limit(1);

      if (!assignment || assignment.length === 0) {
        return res.status(404).json({ message: "Assignment not found" });
      }

      await db
        .update(whatsappTemplateAssignments)
        .set({
          priority,
          updatedAt: new Date(),
        })
        .where(eq(whatsappTemplateAssignments.id, assignmentId));

      res.json({
        message: "Priority updated successfully",
        assignmentId,
        priority,
      });
    } catch (error: any) {
      console.error("[TEMPLATE ASSIGNMENTS] Error updating priority:", error);
      res.status(500).json({ message: "Failed to update priority" });
    }
  }
);

export default router;
