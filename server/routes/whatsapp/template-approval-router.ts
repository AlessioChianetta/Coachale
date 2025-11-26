import { Router, type Response } from "express";
import { db } from "../../db";
import { eq, and } from "drizzle-orm";
import { consultantWhatsappConfig } from "../../../shared/schema";
import { authenticateToken, requireRole, type AuthRequest } from "../../middleware/auth";
import { checkTemplateApprovalStatus } from "../../services/whatsapp/template-approval-checker";

const router = Router();

/**
 * GET /api/whatsapp/templates/:configId/approval-status
 * Check approval status for all Twilio templates assigned to this agent and update cache
 */
router.get(
  "/:configId/approval-status",
  authenticateToken,
  requireRole("consultant"),
  async (req: AuthRequest, res: Response) => {
    try {
      const { configId } = req.params;
      const consultantId = req.user!.id;

      // Verify the agent config belongs to this consultant
      const [agentConfig] = await db
        .select()
        .from(consultantWhatsappConfig)
        .where(
          and(
            eq(consultantWhatsappConfig.id, configId),
            eq(consultantWhatsappConfig.consultantId, consultantId)
          )
        )
        .limit(1);

      if (!agentConfig) {
        return res.status(404).json({ 
          success: false,
          message: "Agent configuration not found or access denied" 
        });
      }

      // Check if Twilio credentials are configured
      if (!agentConfig.twilioAccountSid || !agentConfig.twilioAuthToken) {
        return res.status(400).json({
          success: false,
          message: "Credenziali Twilio non configurate per questo agente"
        });
      }

      // Extract all template SIDs from whatsappTemplates
      const templates = agentConfig.whatsappTemplates as {
        openingMessageContentSid?: string;
        followUpGentleContentSid?: string;
        followUpValueContentSid?: string;
        followUpFinalContentSid?: string;
      } | null;

      if (!templates) {
        return res.status(400).json({
          success: false,
          message: "Nessun template configurato per questo agente"
        });
      }

      // Collect all template SIDs
      const templateSids: Array<{ type: string; sid: string }> = [];
      if (templates.openingMessageContentSid) {
        templateSids.push({ type: 'opening', sid: templates.openingMessageContentSid });
      }
      if (templates.followUpGentleContentSid) {
        templateSids.push({ type: 'gentle', sid: templates.followUpGentleContentSid });
      }
      if (templates.followUpValueContentSid) {
        templateSids.push({ type: 'value', sid: templates.followUpValueContentSid });
      }
      if (templates.followUpFinalContentSid) {
        templateSids.push({ type: 'final', sid: templates.followUpFinalContentSid });
      }

      if (templateSids.length === 0) {
        return res.status(400).json({
          success: false,
          message: "Nessun template SID assegnato a questo agente"
        });
      }

      console.log(`🔍 [TEMPLATE APPROVAL CHECK] Checking ${templateSids.length} templates for agent ${agentConfig.agentName}`);

      // Check status for each template
      const results: Record<string, any> = {};
      const statusCache: Record<string, any> = {};

      for (const { type, sid } of templateSids) {
        console.log(`\n📋 Checking ${type} template: ${sid}`);
        
        try {
          const statusResult = await checkTemplateApprovalStatus(
            agentConfig.twilioAccountSid!,
            agentConfig.twilioAuthToken!,
            sid
          );

          results[type] = {
            sid,
            ...statusResult
          };

          // Build cache entry
          statusCache[sid] = {
            status: statusResult.status,
            checkedAt: new Date().toISOString(),
            reason: statusResult.reason
          };

          console.log(`✅ ${type} template ${sid}: ${statusResult.status}`);
        } catch (error: any) {
          console.error(`❌ Error checking ${type} template ${sid}:`, error.message);
          
          results[type] = {
            sid,
            approved: false,
            status: 'error',
            reason: `Errore: ${error.message}`
          };

          statusCache[sid] = {
            status: 'error',
            checkedAt: new Date().toISOString(),
            reason: error.message
          };
        }
      }

      // Update cache in database
      await db
        .update(consultantWhatsappConfig)
        .set({
          templateApprovalStatus: statusCache,
          lastApprovalCheck: new Date(),
          updatedAt: new Date()
        })
        .where(eq(consultantWhatsappConfig.id, configId));

      console.log(`💾 Updated approval status cache for agent ${configId}`);

      res.json({
        success: true,
        agentConfigId: configId,
        agentName: agentConfig.agentName,
        results,
        lastChecked: new Date().toISOString()
      });
    } catch (error: any) {
      console.error("[TEMPLATE APPROVAL] Error checking approval status:", error);
      res.status(500).json({ 
        success: false,
        message: "Failed to check template approval status",
        error: error.message 
      });
    }
  }
);

/**
 * GET /api/whatsapp/templates/debug/:contentSid
 * Debug endpoint to see RAW Twilio API response for template
 */
router.get(
  "/debug/:contentSid",
  authenticateToken,
  requireRole("consultant"),
  async (req: AuthRequest, res: Response) => {
    try {
      const { contentSid } = req.params;
      const { agentId } = req.query;
      const consultantId = req.user!.id;

      if (!agentId || typeof agentId !== 'string') {
        return res.status(400).json({
          success: false,
          message: "agentId query parameter is required"
        });
      }

      // Get agent config
      const [agentConfig] = await db
        .select()
        .from(consultantWhatsappConfig)
        .where(
          and(
            eq(consultantWhatsappConfig.id, agentId),
            eq(consultantWhatsappConfig.consultantId, consultantId)
          )
        )
        .limit(1);

      if (!agentConfig || !agentConfig.twilioAccountSid || !agentConfig.twilioAuthToken) {
        return res.status(404).json({
          success: false,
          message: "Agent configuration not found or Twilio credentials missing"
        });
      }

      console.log(`🔍 [DEBUG] Fetching RAW Twilio response for template ${contentSid}`);

      const twilio = (await import('twilio')).default;
      const twilioClient = twilio(agentConfig.twilioAccountSid, agentConfig.twilioAuthToken);
      
      // Fetch template content
      const content = await twilioClient.content.v1.contents(contentSid).fetch();
      
      // Try to fetch approval requests separately
      let approvalFetchResult = null;
      try {
        approvalFetchResult = await twilioClient.content.v1
          .contents(contentSid)
          .approvalFetch()
          .fetch();
      } catch (approvalError: any) {
        approvalFetchResult = { error: approvalError.message };
      }

      // Extract all possible status paths
      const statusPaths = {
        'content.approvalRequests?.whatsapp?.status': (content.approvalRequests as any)?.whatsapp?.status,
        'content.types["twilio/whatsapp"]?.approval?.status': (content.types as any)?.['twilio/whatsapp']?.approval?.status,
        'content.types["twilio/whatsapp"]?.status': (content.types as any)?.['twilio/whatsapp']?.status,
        'content.approval?.status': (content as any).approval?.status,
        'content.status': (content as any).status,
        'content.types["twilio/whatsapp"]?.body?.approval_status': (content.types as any)?.['twilio/whatsapp']?.body?.approval_status,
      };

      res.json({
        success: true,
        contentSid,
        agentId,
        agentName: agentConfig.agentName,
        rawResponse: {
          content: JSON.parse(JSON.stringify(content)),
          approvalFetch: approvalFetchResult
        },
        extractedStatusPaths: statusPaths,
        detectedStatus: Object.entries(statusPaths).find(([_, value]) => value)?.[1] || 'not_found',
        recommendation: `Cerca lo status nella risposta RAW sopra. Se lo trovi in un path diverso, aggiungi un nuovo PATH nel codice.`
      });

    } catch (error: any) {
      console.error("[TEMPLATE DEBUG] Error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch template debug info",
        error: error.message
      });
    }
  }
);

export default router;
