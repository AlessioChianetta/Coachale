/**
 * Instagram Configuration Router
 * 
 * CRUD operations for consultant Instagram agent configuration.
 * Follows same pattern as WhatsApp agent configuration.
 */

import { Router, Response } from "express";
import { authenticateToken, type AuthRequest } from "../../middleware/auth";
import { db } from "../../db";
import {
  consultantInstagramConfig,
  instagramConversations,
  instagramMessages,
  instagramDailyStats,
} from "../../../shared/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { encrypt, decrypt, encryptForConsultant, decryptForConsultant } from "../../encryption";
import { nanoid } from "nanoid";

const router = Router();

/**
 * GET /api/instagram/config
 * Get consultant's Instagram agent configuration
 */
router.get("/config", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const consultantId = req.user!.id;

    const [config] = await db
      .select()
      .from(consultantInstagramConfig)
      .where(eq(consultantInstagramConfig.consultantId, consultantId))
      .limit(1);

    if (!config) {
      return res.json({ config: null });
    }

    // Mask sensitive tokens
    const maskedConfig = {
      ...config,
      pageAccessToken: config.pageAccessToken ? "***ENCRYPTED***" : null,
      appSecret: config.appSecret ? "***ENCRYPTED***" : null,
    };

    return res.json({ config: maskedConfig });
  } catch (error) {
    console.error("Error fetching Instagram config:", error);
    return res.status(500).json({ error: "Failed to fetch configuration" });
  }
});

/**
 * POST /api/instagram/config
 * Create or update Instagram agent configuration
 */
router.post("/config", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const consultantId = req.user!.id;
    const encryptionSalt = req.user!.encryptionSalt;

    console.log("[INSTAGRAM CONFIG] Received body:", {
      instagramPageId: req.body.instagramPageId,
      hasPageAccessToken: !!req.body.pageAccessToken,
      pageAccessTokenLength: req.body.pageAccessToken?.length || 0,
      hasAppSecret: !!req.body.appSecret,
      appSecretLength: req.body.appSecret?.length || 0,
      hasEncryptionSalt: !!encryptionSalt,
    });

    const {
      instagramPageId,
      pageAccessToken,
      appSecret,
      agentName,
      agentType,
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
      storyReplyEnabled,
      iceBreakersEnabled,
      iceBreakers,
      commentTriggerKeywords,
      isDryRun,
      isActive,
    } = req.body;

    // Check if config already exists
    const [existingConfig] = await db
      .select()
      .from(consultantInstagramConfig)
      .where(eq(consultantInstagramConfig.consultantId, consultantId))
      .limit(1);

    // Encrypt sensitive tokens if provided
    let encryptedPageAccessToken = existingConfig?.pageAccessToken;
    let encryptedAppSecret = existingConfig?.appSecret;

    if (pageAccessToken && pageAccessToken !== "***ENCRYPTED***") {
      // Use per-consultant encryption if salt exists, otherwise use legacy encryption
      if (encryptionSalt) {
        encryptedPageAccessToken = encryptForConsultant(pageAccessToken, encryptionSalt);
      } else {
        encryptedPageAccessToken = encrypt(pageAccessToken);
      }
    }

    if (appSecret && appSecret !== "***ENCRYPTED***") {
      if (encryptionSalt) {
        encryptedAppSecret = encryptForConsultant(appSecret, encryptionSalt);
      } else {
        encryptedAppSecret = encrypt(appSecret);
      }
    }

    // Generate verify token if not exists
    const verifyToken = existingConfig?.verifyToken || nanoid(32);

    const configData = {
      consultantId,
      instagramPageId,
      pageAccessToken: encryptedPageAccessToken,
      appSecret: encryptedAppSecret,
      verifyToken,
      agentName: agentName || "Instagram Agent",
      agentType: agentType || "sales",
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
      agentInstructionsEnabled: agentInstructionsEnabled ?? false,
      bookingEnabled: bookingEnabled ?? false,
      objectionHandlingEnabled: objectionHandlingEnabled ?? false,
      disqualificationEnabled: disqualificationEnabled ?? false,
      autoResponseEnabled: autoResponseEnabled ?? true,
      commentToDmEnabled: commentToDmEnabled ?? false,
      storyReplyEnabled: storyReplyEnabled ?? true,
      iceBreakersEnabled: iceBreakersEnabled ?? false,
      iceBreakers: iceBreakers || [],
      commentTriggerKeywords: commentTriggerKeywords || [],
      isDryRun: isDryRun ?? true,
      isActive: isActive ?? false,
      updatedAt: new Date(),
    };

    let savedConfig;

    if (existingConfig) {
      [savedConfig] = await db
        .update(consultantInstagramConfig)
        .set(configData)
        .where(eq(consultantInstagramConfig.id, existingConfig.id))
        .returning();
    } else {
      [savedConfig] = await db
        .insert(consultantInstagramConfig)
        .values({
          ...configData,
          createdAt: new Date(),
        })
        .returning();
    }

    // Mask sensitive tokens in response
    const maskedConfig = {
      ...savedConfig,
      pageAccessToken: savedConfig.pageAccessToken ? "***ENCRYPTED***" : null,
      appSecret: savedConfig.appSecret ? "***ENCRYPTED***" : null,
    };

    return res.json({ 
      success: true, 
      config: maskedConfig,
      webhookUrl: `/api/instagram/webhook`,
      verifyToken: savedConfig.verifyToken,
    });
  } catch (error) {
    console.error("Error saving Instagram config:", error);
    return res.status(500).json({ error: "Failed to save configuration" });
  }
});

/**
 * GET /api/instagram/stats
 * Get Instagram messaging statistics
 */
router.get("/stats", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const consultantId = req.user!.id;

    // Get conversation counts
    const [conversationStats] = await db
      .select({
        totalConversations: sql<number>`count(*)`,
        activeConversations: sql<number>`count(*) filter (where ${instagramConversations.isWindowOpen} = true)`,
        unreadCount: sql<number>`sum(${instagramConversations.unreadByConsultant})`,
      })
      .from(instagramConversations)
      .where(eq(instagramConversations.consultantId, consultantId));

    // Get message counts (last 24h)
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [messageStats] = await db
      .select({
        messagesSent: sql<number>`count(*) filter (where ${instagramMessages.direction} = 'outbound' and ${instagramMessages.createdAt} > ${oneDayAgo})`,
        messagesReceived: sql<number>`count(*) filter (where ${instagramMessages.direction} = 'inbound' and ${instagramMessages.createdAt} > ${oneDayAgo})`,
      })
      .from(instagramMessages)
      .innerJoin(
        instagramConversations,
        eq(instagramMessages.conversationId, instagramConversations.id)
      )
      .where(eq(instagramConversations.consultantId, consultantId));

    return res.json({
      totalConversations: Number(conversationStats?.totalConversations || 0),
      activeConversations: Number(conversationStats?.activeConversations || 0),
      unreadCount: Number(conversationStats?.unreadCount || 0),
      messagesSent24h: Number(messageStats?.messagesSent || 0),
      messagesReceived24h: Number(messageStats?.messagesReceived || 0),
    });
  } catch (error) {
    console.error("Error fetching Instagram stats:", error);
    return res.status(500).json({ error: "Failed to fetch statistics" });
  }
});

/**
 * GET /api/instagram/conversations
 * Get list of Instagram conversations
 */
router.get("/conversations", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const consultantId = req.user!.id;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const offset = parseInt(req.query.offset as string) || 0;

    const conversations = await db
      .select()
      .from(instagramConversations)
      .where(eq(instagramConversations.consultantId, consultantId))
      .orderBy(desc(instagramConversations.lastMessageAt))
      .limit(limit)
      .offset(offset);

    return res.json({ conversations });
  } catch (error) {
    console.error("Error fetching Instagram conversations:", error);
    return res.status(500).json({ error: "Failed to fetch conversations" });
  }
});

/**
 * GET /api/instagram/conversations/:id/messages
 * Get messages for a specific conversation
 */
router.get("/conversations/:id/messages", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const consultantId = req.user!.id;
    const conversationId = req.params.id;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const offset = parseInt(req.query.offset as string) || 0;

    // Verify conversation belongs to consultant
    const [conversation] = await db
      .select()
      .from(instagramConversations)
      .where(
        and(
          eq(instagramConversations.id, conversationId),
          eq(instagramConversations.consultantId, consultantId)
        )
      )
      .limit(1);

    if (!conversation) {
      return res.status(404).json({ error: "Conversation not found" });
    }

    const messages = await db
      .select()
      .from(instagramMessages)
      .where(eq(instagramMessages.conversationId, conversationId))
      .orderBy(desc(instagramMessages.createdAt))
      .limit(limit)
      .offset(offset);

    // Mark as read
    await db
      .update(instagramConversations)
      .set({ unreadByConsultant: 0 })
      .where(eq(instagramConversations.id, conversationId));

    return res.json({ 
      conversation,
      messages: messages.reverse(), // Oldest first
    });
  } catch (error) {
    console.error("Error fetching Instagram messages:", error);
    return res.status(500).json({ error: "Failed to fetch messages" });
  }
});

/**
 * POST /api/instagram/config/test-connection
 * Test Instagram API connection
 */
router.post("/config/test-connection", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const consultantId = req.user!.id;
    const encryptionSalt = req.user!.encryptionSalt;

    const [config] = await db
      .select()
      .from(consultantInstagramConfig)
      .where(eq(consultantInstagramConfig.consultantId, consultantId))
      .limit(1);

    if (!config || !config.pageAccessToken || !config.instagramPageId) {
      return res.status(400).json({ 
        success: false, 
        error: "Configuration incomplete. Please save your Instagram Page ID and Access Token first." 
      });
    }

    // Decrypt token - try per-consultant first, then legacy
    let accessToken = config.pageAccessToken;
    if (encryptionSalt) {
      try {
        accessToken = decryptForConsultant(config.pageAccessToken, encryptionSalt);
      } catch (e) {
        // Token might be encrypted with legacy method, try that
        try {
          accessToken = decrypt(config.pageAccessToken);
        } catch (e2) {
          // Token might not be encrypted at all
        }
      }
    } else {
      // No salt, try legacy decryption
      try {
        accessToken = decrypt(config.pageAccessToken);
      } catch (e) {
        // Token might not be encrypted
      }
    }

    // Test API connection - first try as Instagram Business Account
    console.log("[INSTAGRAM TEST] Testing connection with pageId:", config.instagramPageId);
    let response = await fetch(
      `https://graph.facebook.com/v21.0/${config.instagramPageId}?fields=id,username,name&access_token=${accessToken}`
    );

    let pageInfo = await response.json();
    
    // If error indicates this is a Facebook Page (Business), try to get linked Instagram account
    if (pageInfo.error?.message?.includes("node type (Business)")) {
      console.log("[INSTAGRAM TEST] Detected Facebook Page, looking for linked Instagram Business Account...");
      
      const fbPageResponse = await fetch(
        `https://graph.facebook.com/v21.0/${config.instagramPageId}?fields=instagram_business_account&access_token=${accessToken}`
      );
      
      const fbPageData = await fbPageResponse.json();
      console.log("[INSTAGRAM TEST] Facebook Page response:", JSON.stringify(fbPageData, null, 2));
      
      if (fbPageData.instagram_business_account?.id) {
        const instagramId = fbPageData.instagram_business_account.id;
        console.log("[INSTAGRAM TEST] Found linked Instagram ID:", instagramId);
        
        // Update the config with the correct Instagram ID
        await db.update(consultantInstagramConfig)
          .set({ instagramPageId: instagramId, updatedAt: new Date() })
          .where(eq(consultantInstagramConfig.consultantId, consultantId));
        
        // Now test with the correct Instagram ID
        response = await fetch(
          `https://graph.facebook.com/v21.0/${instagramId}?fields=id,username,name&access_token=${accessToken}`
        );
        pageInfo = await response.json();
        
        if (pageInfo.error) {
          console.log("[INSTAGRAM TEST] API Error with Instagram ID:", JSON.stringify(pageInfo, null, 2));
          return res.status(400).json({ 
            success: false, 
            error: `API Error: ${pageInfo.error?.message || "Unknown error"}` 
          });
        }
        
        return res.json({
          success: true,
          message: `Connessione riuscita! ID Instagram aggiornato automaticamente da Facebook Page a ${instagramId}`,
          pageInfo: {
            id: pageInfo.id,
            username: pageInfo.username,
            name: pageInfo.name,
          },
          autoUpdated: true,
          newInstagramId: instagramId,
        });
      } else {
        return res.status(400).json({ 
          success: false, 
          error: "Nessun account Instagram Business collegato a questa pagina Facebook. Vai su Meta Business Suite e collega un account Instagram alla tua pagina." 
        });
      }
    }

    if (!response.ok || pageInfo.error) {
      console.log("[INSTAGRAM TEST] API Error:", JSON.stringify(pageInfo, null, 2));
      return res.status(400).json({ 
        success: false, 
        error: `API Error: ${pageInfo.error?.message || "Unknown error"}` 
      });
    }

    return res.json({
      success: true,
      message: "Connessione riuscita!",
      pageInfo: {
        id: pageInfo.id,
        username: pageInfo.username,
        name: pageInfo.name,
      },
    });
  } catch (error) {
    console.error("Error testing Instagram connection:", error);
    return res.status(500).json({ 
      success: false, 
      error: "Failed to test connection" 
    });
  }
});

export default router;
