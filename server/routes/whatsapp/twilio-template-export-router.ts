import { Router } from "express";
import { authenticateToken, requireRole, type AuthRequest } from "../../middleware/auth";
import { z } from "zod";
import { exportTemplateToTwilio } from "../../services/whatsapp/twilio-template-exporter";

const router = Router();

/**
 * POST /api/whatsapp/custom-templates/:id/export-twilio
 * Export a custom template to Twilio Content API for WhatsApp Business approval
 */
router.post(
  "/whatsapp/custom-templates/:id/export-twilio",
  authenticateToken,
  requireRole("consultant"),
  async (req: AuthRequest, res) => {
    try {
      const consultantId = req.user!.id;
      const templateId = req.params.id;
      const { agentConfigId } = req.body;

      // Validate UUID format
      const uuidSchema = z.string().uuid();
      const uuidValidation = uuidSchema.safeParse(templateId);
      
      if (!uuidValidation.success) {
        return res.status(400).json({
          success: false,
          error: "Invalid template ID format",
        });
      }

      console.log(`📤 [TWILIO EXPORT ROUTER] Export request for template ${templateId}`);
      console.log(`   Consultant ID: ${consultantId}`);
      if (agentConfigId) {
        console.log(`   Agent Config ID: ${agentConfigId}`);
      }

      // Call export service
      const result = await exportTemplateToTwilio(templateId, consultantId, agentConfigId);

      console.log(`✅ [TWILIO EXPORT ROUTER] Export successful: ${result.twilioContentSid}`);

      res.json({
        success: true,
        data: {
          twilioContentSid: result.twilioContentSid,
          friendlyName: result.friendlyName,
        },
        message: result.message,
      });
    } catch (error: any) {
      console.error("❌ [TWILIO EXPORT ROUTER] Export failed:", error);

      // Handle specific error cases
      if (error.message?.includes("non trovato") || error.message?.includes("not found")) {
        return res.status(404).json({
          success: false,
          error: error.message,
        });
      }

      if (error.message?.includes("Configura prima") || error.message?.includes("credenziali")) {
        return res.status(400).json({
          success: false,
          error: error.message,
        });
      }

      if (error.message?.includes("già esiste") || error.message?.includes("already exists")) {
        return res.status(409).json({
          success: false,
          error: error.message,
        });
      }

      // Generic error
      res.status(500).json({
        success: false,
        error: error.message || "Failed to export template to Twilio",
      });
    }
  }
);

export default router;
