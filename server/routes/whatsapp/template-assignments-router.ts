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

const router = Router();

/**
 * GET /api/whatsapp/template-assignments/:agentConfigId
 * Fetch all template assignments for a specific agent config
 * Returns an array of all assigned templates (supports N templates per agent)
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

      const assignments = await db
        .select({
          id: whatsappTemplateAssignments.id,
          templateId: whatsappTemplateAssignments.templateId,
          templateType: whatsappTemplateAssignments.templateType,
          priority: whatsappTemplateAssignments.priority,
          assignedAt: whatsappTemplateAssignments.assignedAt,
          templateName: whatsappCustomTemplates.templateName,
          templateDescription: whatsappCustomTemplates.description,
          useCase: whatsappCustomTemplates.useCase,
          body: whatsappCustomTemplates.body,
          activeVersionId: whatsappTemplateVersions.id,
          activeVersionNumber: whatsappTemplateVersions.versionNumber,
          activeVersionBody: whatsappTemplateVersions.bodyText,
          twilioStatus: whatsappTemplateVersions.twilioStatus,
        })
        .from(whatsappTemplateAssignments)
        .innerJoin(
          whatsappCustomTemplates,
          and(
            eq(whatsappTemplateAssignments.templateId, whatsappCustomTemplates.id),
            isNull(whatsappCustomTemplates.archivedAt)
          )
        )
        .leftJoin(
          whatsappTemplateVersions,
          and(
            eq(whatsappTemplateVersions.templateId, whatsappCustomTemplates.id),
            eq(whatsappTemplateVersions.isActive, true)
          )
        )
        .where(eq(whatsappTemplateAssignments.agentConfigId, agentConfigId));

      const formattedAssignments = assignments.map((a) => ({
        assignmentId: a.id,
        templateId: a.templateId,
        templateName: a.templateName,
        templateDescription: a.templateDescription,
        useCase: a.useCase || a.templateType || "generale",
        priority: a.priority || 0,
        assignedAt: a.assignedAt,
        body: a.body || a.activeVersionBody,
        activeVersion: a.activeVersionId
          ? {
              id: a.activeVersionId,
              versionNumber: a.activeVersionNumber,
              bodyText: a.activeVersionBody,
              twilioStatus: a.twilioStatus,
            }
          : null,
      }));

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
          });
        }
      }

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
