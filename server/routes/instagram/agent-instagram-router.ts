/**
 * Agent Instagram Configuration Router
 * 
 * Per-agent Instagram configuration endpoints.
 * Each WhatsApp agent can have its own Instagram account linked.
 */

import { Router, Response } from "express";
import { authenticateToken, type AuthRequest } from "../../middleware/auth";
import { db } from "../../db";
import {
  instagramAgentConfig,
  consultantWhatsappConfig,
} from "../../../shared/schema";
import { eq, and } from "drizzle-orm";
import { encrypt, decrypt, encryptForConsultant, decryptForConsultant } from "../../encryption";

const router = Router();

/**
 * GET /api/consultant/agents/:agentId/instagram
 * Get Instagram configuration for a specific WhatsApp agent
 */
router.get("/:agentId/instagram", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const consultantId = req.user!.id;
    const { agentId } = req.params;

    // Verify agent belongs to consultant
    const [agent] = await db
      .select()
      .from(consultantWhatsappConfig)
      .where(and(
        eq(consultantWhatsappConfig.id, agentId),
        eq(consultantWhatsappConfig.consultantId, consultantId)
      ))
      .limit(1);

    if (!agent) {
      return res.status(404).json({ error: "Agent not found" });
    }

    // Get Instagram config for this agent
    const [config] = await db
      .select()
      .from(instagramAgentConfig)
      .where(eq(instagramAgentConfig.whatsappAgentId, agentId))
      .limit(1);

    if (!config) {
      return res.json({ config: null });
    }

    // Mask sensitive tokens
    const maskedConfig = {
      ...config,
      pageAccessToken: config.pageAccessToken ? "***ENCRYPTED***" : null,
    };

    return res.json({ config: maskedConfig });
  } catch (error) {
    console.error("[AGENT-INSTAGRAM] Error fetching config:", error);
    return res.status(500).json({ error: "Failed to fetch configuration" });
  }
});

/**
 * POST /api/consultant/agents/:agentId/instagram
 * Create or update Instagram configuration for a specific WhatsApp agent
 */
router.post("/:agentId/instagram", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const consultantId = req.user!.id;
    const encryptionSalt = req.user!.encryptionSalt;
    const { agentId } = req.params;

    // Verify agent belongs to consultant
    const [agent] = await db
      .select()
      .from(consultantWhatsappConfig)
      .where(and(
        eq(consultantWhatsappConfig.id, agentId),
        eq(consultantWhatsappConfig.consultantId, consultantId)
      ))
      .limit(1);

    if (!agent) {
      return res.status(404).json({ error: "Agent not found" });
    }

    const {
      instagramPageId,
      facebookPageId,
      pageAccessToken,
      instagramUsername,
      businessName,
      consultantDisplayName,
      businessDescription,
      consultantBio,
      salesScript,
      aiPersonality,
      vision,
      mission,
      values,
      usp,
      whoWeHelp,
      whoWeDontHelp,
      whatWeDo,
      howWeDoIt,
      agentInstructions,
      agentInstructionsEnabled,
      bookingEnabled,
      objectionHandlingEnabled,
      disqualificationEnabled,
      autoResponseEnabled,
      commentToDmEnabled,
      commentTriggerKeywords,
      commentAutoReplyMessage,
      storyReplyEnabled,
      storyAutoReplyMessage,
      iceBreakersEnabled,
      iceBreakers,
      isDryRun,
      isActive,
      workingHoursEnabled,
      workingHoursStart,
      workingHoursEnd,
      workingDays,
      afterHoursMessage,
    } = req.body;

    // Check if config already exists for this agent
    const [existingConfig] = await db
      .select()
      .from(instagramAgentConfig)
      .where(eq(instagramAgentConfig.whatsappAgentId, agentId))
      .limit(1);

    // Encrypt sensitive tokens if provided
    let encryptedPageAccessToken = existingConfig?.pageAccessToken;

    if (pageAccessToken && pageAccessToken !== "***ENCRYPTED***") {
      if (encryptionSalt) {
        encryptedPageAccessToken = encryptForConsultant(pageAccessToken, encryptionSalt);
      } else {
        encryptedPageAccessToken = encrypt(pageAccessToken);
      }
    }

    const configData = {
      instagramPageId: instagramPageId ?? existingConfig?.instagramPageId,
      facebookPageId: facebookPageId ?? existingConfig?.facebookPageId,
      pageAccessToken: encryptedPageAccessToken,
      instagramUsername: instagramUsername ?? existingConfig?.instagramUsername,
      businessName: businessName ?? existingConfig?.businessName,
      consultantDisplayName: consultantDisplayName ?? existingConfig?.consultantDisplayName,
      businessDescription: businessDescription ?? existingConfig?.businessDescription,
      consultantBio: consultantBio ?? existingConfig?.consultantBio,
      salesScript: salesScript ?? existingConfig?.salesScript,
      aiPersonality: aiPersonality ?? existingConfig?.aiPersonality,
      vision: vision ?? existingConfig?.vision,
      mission: mission ?? existingConfig?.mission,
      values: values ?? existingConfig?.values,
      usp: usp ?? existingConfig?.usp,
      whoWeHelp: whoWeHelp ?? existingConfig?.whoWeHelp,
      whoWeDontHelp: whoWeDontHelp ?? existingConfig?.whoWeDontHelp,
      whatWeDo: whatWeDo ?? existingConfig?.whatWeDo,
      howWeDoIt: howWeDoIt ?? existingConfig?.howWeDoIt,
      agentInstructions: agentInstructions ?? existingConfig?.agentInstructions,
      agentInstructionsEnabled: agentInstructionsEnabled ?? existingConfig?.agentInstructionsEnabled ?? false,
      bookingEnabled: bookingEnabled ?? existingConfig?.bookingEnabled ?? true,
      objectionHandlingEnabled: objectionHandlingEnabled ?? existingConfig?.objectionHandlingEnabled ?? true,
      disqualificationEnabled: disqualificationEnabled ?? existingConfig?.disqualificationEnabled ?? true,
      autoResponseEnabled: autoResponseEnabled ?? existingConfig?.autoResponseEnabled ?? true,
      commentToDmEnabled: commentToDmEnabled ?? existingConfig?.commentToDmEnabled ?? false,
      commentTriggerKeywords: commentTriggerKeywords ?? existingConfig?.commentTriggerKeywords,
      commentAutoReplyMessage: commentAutoReplyMessage ?? existingConfig?.commentAutoReplyMessage,
      storyReplyEnabled: storyReplyEnabled ?? existingConfig?.storyReplyEnabled ?? false,
      storyAutoReplyMessage: storyAutoReplyMessage ?? existingConfig?.storyAutoReplyMessage,
      iceBreakersEnabled: iceBreakersEnabled ?? existingConfig?.iceBreakersEnabled ?? false,
      iceBreakers: iceBreakers ?? existingConfig?.iceBreakers,
      isDryRun: isDryRun ?? existingConfig?.isDryRun ?? true,
      isActive: isActive ?? existingConfig?.isActive ?? true,
      workingHoursEnabled: workingHoursEnabled ?? existingConfig?.workingHoursEnabled ?? false,
      workingHoursStart: workingHoursStart ?? existingConfig?.workingHoursStart,
      workingHoursEnd: workingHoursEnd ?? existingConfig?.workingHoursEnd,
      workingDays: workingDays ?? existingConfig?.workingDays,
      afterHoursMessage: afterHoursMessage ?? existingConfig?.afterHoursMessage,
      isConnected: !!instagramPageId && !!encryptedPageAccessToken,
      connectedAt: (instagramPageId && encryptedPageAccessToken && !existingConfig?.isConnected) 
        ? new Date() 
        : existingConfig?.connectedAt,
      updatedAt: new Date(),
    };

    let savedConfig;

    if (existingConfig) {
      // Update existing config
      [savedConfig] = await db
        .update(instagramAgentConfig)
        .set(configData)
        .where(eq(instagramAgentConfig.id, existingConfig.id))
        .returning();
    } else {
      // Create new config
      [savedConfig] = await db
        .insert(instagramAgentConfig)
        .values({
          whatsappAgentId: agentId,
          ...configData,
        })
        .returning();

      // Update WhatsApp agent to link to this Instagram config
      await db
        .update(consultantWhatsappConfig)
        .set({ ownInstagramConfigId: savedConfig.id })
        .where(eq(consultantWhatsappConfig.id, agentId));
    }

    // Mask sensitive data in response
    const maskedConfig = {
      ...savedConfig,
      pageAccessToken: savedConfig.pageAccessToken ? "***ENCRYPTED***" : null,
    };

    console.log(`[AGENT-INSTAGRAM] ${existingConfig ? 'Updated' : 'Created'} config for agent ${agentId}`);

    return res.json({ config: maskedConfig });
  } catch (error) {
    console.error("[AGENT-INSTAGRAM] Error saving config:", error);
    return res.status(500).json({ error: "Failed to save configuration" });
  }
});

/**
 * POST /api/consultant/agents/:agentId/instagram/test
 * Test Instagram connection for a specific WhatsApp agent
 */
router.post("/:agentId/instagram/test", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const consultantId = req.user!.id;
    const encryptionSalt = req.user!.encryptionSalt;
    const { agentId } = req.params;

    // Verify agent belongs to consultant
    const [agent] = await db
      .select()
      .from(consultantWhatsappConfig)
      .where(and(
        eq(consultantWhatsappConfig.id, agentId),
        eq(consultantWhatsappConfig.consultantId, consultantId)
      ))
      .limit(1);

    if (!agent) {
      return res.status(404).json({ error: "Agent not found" });
    }

    // Get Instagram config
    const [config] = await db
      .select()
      .from(instagramAgentConfig)
      .where(eq(instagramAgentConfig.whatsappAgentId, agentId))
      .limit(1);

    if (!config || !config.pageAccessToken) {
      return res.status(400).json({ 
        success: false, 
        error: "Instagram not configured for this agent" 
      });
    }

    // Decrypt token
    let accessToken: string;
    try {
      if (encryptionSalt) {
        accessToken = decryptForConsultant(config.pageAccessToken, encryptionSalt);
      } else {
        accessToken = decrypt(config.pageAccessToken);
      }
    } catch (decryptError) {
      console.error("[AGENT-INSTAGRAM] Token decryption failed:", decryptError);
      return res.status(400).json({ 
        success: false, 
        error: "Failed to decrypt access token" 
      });
    }

    // Test connection by fetching Instagram account info
    const pageId = config.instagramPageId || config.facebookPageId;
    if (!pageId) {
      return res.status(400).json({ 
        success: false, 
        error: "No Instagram Page ID configured" 
      });
    }

    const response = await fetch(
      `https://graph.facebook.com/v18.0/${pageId}?fields=id,instagram_business_account{id,username,profile_picture_url}&access_token=${accessToken}`
    );

    const data = await response.json();

    if (data.error) {
      console.error("[AGENT-INSTAGRAM] Meta API error:", data.error);
      return res.json({
        success: false,
        error: data.error.message || "Failed to connect to Instagram",
      });
    }

    const instagramAccount = data.instagram_business_account;
    if (!instagramAccount) {
      return res.json({
        success: false,
        error: "No Instagram Business account linked to this Facebook Page",
      });
    }

    // Update config with verified username
    if (instagramAccount.username && instagramAccount.username !== config.instagramUsername) {
      await db
        .update(instagramAgentConfig)
        .set({ 
          instagramUsername: instagramAccount.username,
          instagramPageId: instagramAccount.id,
          isConnected: true,
          connectedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(instagramAgentConfig.id, config.id));
    }

    return res.json({
      success: true,
      username: instagramAccount.username,
      profilePictureUrl: instagramAccount.profile_picture_url,
      instagramId: instagramAccount.id,
    });
  } catch (error) {
    console.error("[AGENT-INSTAGRAM] Test connection error:", error);
    return res.status(500).json({ 
      success: false, 
      error: "Failed to test connection" 
    });
  }
});

/**
 * DELETE /api/consultant/agents/:agentId/instagram
 * Remove Instagram configuration from a specific WhatsApp agent
 */
router.delete("/:agentId/instagram", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const consultantId = req.user!.id;
    const { agentId } = req.params;

    // Verify agent belongs to consultant
    const [agent] = await db
      .select()
      .from(consultantWhatsappConfig)
      .where(and(
        eq(consultantWhatsappConfig.id, agentId),
        eq(consultantWhatsappConfig.consultantId, consultantId)
      ))
      .limit(1);

    if (!agent) {
      return res.status(404).json({ error: "Agent not found" });
    }

    // Delete Instagram config
    await db
      .delete(instagramAgentConfig)
      .where(eq(instagramAgentConfig.whatsappAgentId, agentId));

    // Clear link in WhatsApp agent
    await db
      .update(consultantWhatsappConfig)
      .set({ ownInstagramConfigId: null })
      .where(eq(consultantWhatsappConfig.id, agentId));

    console.log(`[AGENT-INSTAGRAM] Removed config for agent ${agentId}`);

    return res.json({ success: true });
  } catch (error) {
    console.error("[AGENT-INSTAGRAM] Error removing config:", error);
    return res.status(500).json({ error: "Failed to remove configuration" });
  }
});

/**
 * GET /api/consultant/agents/:agentId/instagram/inherit
 * Get inherited settings from WhatsApp agent (for prefilling Instagram form)
 */
router.get("/:agentId/instagram/inherit", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const consultantId = req.user!.id;
    const { agentId } = req.params;

    // Get WhatsApp agent
    const [agent] = await db
      .select()
      .from(consultantWhatsappConfig)
      .where(and(
        eq(consultantWhatsappConfig.id, agentId),
        eq(consultantWhatsappConfig.consultantId, consultantId)
      ))
      .limit(1);

    if (!agent) {
      return res.status(404).json({ error: "Agent not found" });
    }

    // Return settings that can be inherited
    return res.json({
      agentName: agent.agentName,
      businessName: agent.businessName,
      consultantDisplayName: agent.consultantDisplayName,
      businessDescription: agent.businessDescription,
      consultantBio: agent.consultantBio,
      salesScript: agent.salesScript,
      aiPersonality: agent.aiPersonality,
      vision: agent.vision,
      mission: agent.mission,
      values: agent.values,
      usp: agent.usp,
      whoWeHelp: agent.whoWeHelp,
      whoWeDontHelp: agent.whoWeDontHelp,
      whatWeDo: agent.whatWeDo,
      howWeDoIt: agent.howWeDoIt,
      agentInstructions: agent.agentInstructions,
      agentInstructionsEnabled: agent.agentInstructionsEnabled,
      bookingEnabled: agent.bookingEnabled,
      objectionHandlingEnabled: agent.objectionHandlingEnabled,
      disqualificationEnabled: agent.disqualificationEnabled,
    });
  } catch (error) {
    console.error("[AGENT-INSTAGRAM] Error fetching inherited settings:", error);
    return res.status(500).json({ error: "Failed to fetch inherited settings" });
  }
});

export default router;
