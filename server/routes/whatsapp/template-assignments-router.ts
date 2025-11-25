import { Router, type Request, type Response } from "express";
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
 */
router.get(
  "/:agentConfigId",
  authenticateToken,
  requireRole("consultant"),
  async (req: AuthRequest, res: Response) => {
    try {
      const { agentConfigId } = req.params;
      const consultantId = req.user!.id;

      // Verify the agent config belongs to this consultant
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

      // Fetch all assignments for this agent with template and active version info
      const assignments = await db
        .select({
          id: whatsappTemplateAssignments.id,
          templateType: whatsappTemplateAssignments.templateType,
          templateId: whatsappTemplateAssignments.templateId,
          templateName: whatsappCustomTemplates.templateName,
          templateDescription: whatsappCustomTemplates.description,
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
            isNull(whatsappCustomTemplates.archivedAt) // Only non-archived templates
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

      // Format response as a map by template type
      const assignmentsMap: Record<string, any> = {};
      assignments.forEach((assignment) => {
        assignmentsMap[assignment.templateType] = {
          assignmentId: assignment.id,
          templateId: assignment.templateId,
          templateName: assignment.templateName,
          templateDescription: assignment.templateDescription,
          activeVersion: assignment.activeVersionId
            ? {
                id: assignment.activeVersionId,
                versionNumber: assignment.activeVersionNumber,
                bodyText: assignment.activeVersionBody,
                twilioStatus: assignment.twilioStatus,
              }
            : null,
        };
      });

      res.json({
        agentConfigId,
        assignments: assignmentsMap,
      });
    } catch (error: any) {
      console.error("[TEMPLATE ASSIGNMENTS] Error fetching assignments:", error);
      res.status(500).json({ message: "Failed to fetch template assignments" });
    }
  }
);

/**
 * POST /api/whatsapp/template-assignments
 * Save or update template assignments for an agent
 * 
 * Payload: {
 *   agentConfigId: string,
 *   assignments: Array<{ templateType: string, templateId: string | null }>
 * }
 */
router.post(
  "/",
  authenticateToken,
  requireRole("consultant"),
  async (req: AuthRequest, res: Response) => {
    try {
      const { agentConfigId, assignments } = req.body;
      const consultantId = req.user!.id;

      if (!agentConfigId) {
        return res.status(400).json({ message: "agentConfigId is required" });
      }

      if (!Array.isArray(assignments)) {
        return res.status(400).json({ message: "assignments must be an array" });
      }

      // Verify the agent config belongs to this consultant
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

      // Process each assignment
      const results = [];
      for (const assignment of assignments) {
        const { templateType, templateId } = assignment;

        if (!templateType) {
          continue; // Skip invalid entries
        }

        // Validate template type
        const validTypes = ["opening", "followup_gentle", "followup_value", "followup_final"];
        if (!validTypes.includes(templateType)) {
          return res.status(400).json({
            message: `Invalid templateType: ${templateType}. Must be one of: ${validTypes.join(", ")}`,
          });
        }

        // If templateId is null/empty, delete the assignment
        if (!templateId) {
          await db
            .delete(whatsappTemplateAssignments)
            .where(
              and(
                eq(whatsappTemplateAssignments.agentConfigId, agentConfigId),
                eq(whatsappTemplateAssignments.templateType, templateType as any)
              )
            );
          results.push({ templateType, action: "deleted" });
          continue;
        }

        // Verify the template exists and belongs to this consultant
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

        // Check if assignment already exists
        const existingAssignment = await db
          .select()
          .from(whatsappTemplateAssignments)
          .where(
            and(
              eq(whatsappTemplateAssignments.agentConfigId, agentConfigId),
              eq(whatsappTemplateAssignments.templateType, templateType as any)
            )
          )
          .limit(1);

        if (existingAssignment && existingAssignment.length > 0) {
          // Update existing assignment
          await db
            .update(whatsappTemplateAssignments)
            .set({
              templateId,
              updatedAt: new Date(),
            })
            .where(eq(whatsappTemplateAssignments.id, existingAssignment[0].id));
          results.push({ templateType, action: "updated", assignmentId: existingAssignment[0].id });
        } else {
          // Create new assignment
          const newAssignment = await db
            .insert(whatsappTemplateAssignments)
            .values({
              agentConfigId,
              templateId,
              templateType: templateType as any,
            })
            .returning();
          results.push({ templateType, action: "created", assignmentId: newAssignment[0].id });
        }
      }

      res.json({
        message: "Template assignments saved successfully",
        agentConfigId,
        results,
      });
    } catch (error: any) {
      console.error("[TEMPLATE ASSIGNMENTS] Error saving assignments:", error);
      res.status(500).json({ message: "Failed to save template assignments" });
    }
  }
);

export default router;
