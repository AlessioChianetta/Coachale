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

    if (pageAccessToken && pageAccessToken !== "***ENCRYPTED***") {
      // Use per-consultant encryption if salt exists, otherwise use legacy encryption
      if (encryptionSalt) {
        encryptedPageAccessToken = encryptForConsultant(pageAccessToken, encryptionSalt);
      } else {
        encryptedPageAccessToken = encrypt(pageAccessToken);
      }
    }

    const configData = {
      consultantId,
      instagramPageId,
      pageAccessToken: encryptedPageAccessToken,
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
    };

    return res.json({ 
      success: true, 
      config: maskedConfig,
      webhookUrl: `/api/instagram/webhook`,
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

    const messagesRaw = await db
      .select()
      .from(instagramMessages)
      .where(eq(instagramMessages.conversationId, conversationId))
      .orderBy(desc(instagramMessages.createdAt))
      .limit(limit)
      .offset(offset);

    // Map database fields to frontend format
    const messages = messagesRaw.map((msg) => ({
      id: msg.id,
      conversationId: msg.conversationId,
      instagramMessageId: msg.instagramMessageId,
      text: msg.messageText, // Map messageText -> text for frontend
      direction: msg.direction,
      sender: msg.sender === "client" ? "user" : msg.sender, // Map client -> user for frontend
      messageType: msg.mediaType || "text",
      mediaUrl: msg.mediaUrl,
      storyUrl: msg.replyToStoryUrl,
      status: msg.metaStatus || "sent",
      createdAt: msg.createdAt,
    }));

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
 * PATCH /api/instagram/config/:configId/settings
 * Update Instagram automation settings
 */
router.patch("/config/:configId/settings", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const consultantId = req.user!.id;
    const { configId } = req.params;

    // Verify the config belongs to the consultant
    const [existingConfig] = await db
      .select()
      .from(consultantInstagramConfig)
      .where(
        and(
          eq(consultantInstagramConfig.id, configId),
          eq(consultantInstagramConfig.consultantId, consultantId)
        )
      )
      .limit(1);

    if (!existingConfig) {
      return res.status(404).json({ error: "Configuration not found" });
    }

    const body = req.body;

    // Build update object containing ONLY fields explicitly defined in the body
    const updateData: Record<string, any> = {
      updatedAt: new Date(),
    };

    if (body.autoResponseEnabled !== undefined) updateData.autoResponseEnabled = body.autoResponseEnabled;
    if (body.storyReplyEnabled !== undefined) updateData.storyReplyEnabled = body.storyReplyEnabled;
    if (body.commentToDmEnabled !== undefined) updateData.commentToDmEnabled = body.commentToDmEnabled;
    if (body.iceBreakersEnabled !== undefined) updateData.iceBreakersEnabled = body.iceBreakersEnabled;
    if (body.isDryRun !== undefined) updateData.isDryRun = body.isDryRun;
    if (body.commentTriggerKeywords !== undefined) updateData.commentTriggerKeywords = body.commentTriggerKeywords;
    if (body.commentAutoReplyMessage !== undefined) updateData.commentAutoReplyMessage = body.commentAutoReplyMessage;
    if (body.storyAutoReplyMessage !== undefined) updateData.storyAutoReplyMessage = body.storyAutoReplyMessage;
    if (body.iceBreakers !== undefined) updateData.iceBreakers = body.iceBreakers;

    const [updatedConfig] = await db
      .update(consultantInstagramConfig)
      .set(updateData)
      .where(eq(consultantInstagramConfig.id, configId))
      .returning();

    console.log(`[INSTAGRAM CONFIG] Updated settings for config ${configId}:`, Object.keys(updateData).filter(k => k !== 'updatedAt'));

    return res.json({
      success: true,
      config: {
        id: updatedConfig.id,
        autoResponseEnabled: updatedConfig.autoResponseEnabled,
        storyReplyEnabled: updatedConfig.storyReplyEnabled,
        commentToDmEnabled: updatedConfig.commentToDmEnabled,
        commentTriggerKeywords: updatedConfig.commentTriggerKeywords,
        commentAutoReplyMessage: updatedConfig.commentAutoReplyMessage,
        storyAutoReplyMessage: updatedConfig.storyAutoReplyMessage,
        iceBreakersEnabled: updatedConfig.iceBreakersEnabled,
        iceBreakers: updatedConfig.iceBreakers,
        isDryRun: updatedConfig.isDryRun,
      },
    });
  } catch (error) {
    console.error("Error updating Instagram settings:", error);
    return res.status(500).json({ error: "Failed to update settings" });
  }
});

/**
 * POST /api/instagram/config/:configId/sync-ice-breakers
 * Sync Ice Breakers with Meta API
 */
router.post("/config/:configId/sync-ice-breakers", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const consultantId = req.user!.id;
    const encryptionSalt = req.user!.encryptionSalt;
    const { configId } = req.params;

    const [config] = await db
      .select()
      .from(consultantInstagramConfig)
      .where(
        and(
          eq(consultantInstagramConfig.id, configId),
          eq(consultantInstagramConfig.consultantId, consultantId)
        )
      )
      .limit(1);

    if (!config || !config.pageAccessToken || !config.facebookPageId) {
      return res.status(400).json({ 
        success: false, 
        error: "Configurazione incompleta. Assicurati di aver completato il collegamento OAuth." 
      });
    }

    // Decrypt token
    let accessToken = config.pageAccessToken;
    console.log(`[INSTAGRAM] Decrypting token for sync-ice-breakers, encryptionSalt available: ${!!encryptionSalt}`);
    if (encryptionSalt) {
      try {
        accessToken = decryptForConsultant(config.pageAccessToken, encryptionSalt);
        console.log(`[INSTAGRAM] Decrypted with per-consultant key, token starts with: ${accessToken.substring(0, 10)}...`);
      } catch (e) {
        console.log(`[INSTAGRAM] Per-consultant decryption failed, trying legacy...`, e);
        try {
          accessToken = decrypt(config.pageAccessToken);
          console.log(`[INSTAGRAM] Decrypted with legacy key`);
        } catch (e2) {
          console.log(`[INSTAGRAM] Legacy decryption also failed`, e2);
        }
      }
    } else {
      try {
        accessToken = decrypt(config.pageAccessToken);
        console.log(`[INSTAGRAM] Decrypted with legacy key (no salt)`);
      } catch (e) {
        console.log(`[INSTAGRAM] Legacy decryption failed (no salt)`, e);
      }
    }

    const iceBreakers = config.iceBreakers || [];
    
    if (!config.iceBreakersEnabled || iceBreakers.length === 0) {
      // Delete ice breakers from Meta if disabled or empty
      console.log(`[INSTAGRAM] Deleting Ice Breakers for config ${configId}`);
      const deleteRes = await fetch(
        `https://graph.facebook.com/v21.0/me/messenger_profile?access_token=${accessToken}`,
        {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            platform: "instagram",
            fields: ["ice_breakers"]
          }),
        }
      );
      const deleteData = await deleteRes.json() as any;
      console.log(`[INSTAGRAM] Delete Ice Breakers response:`, deleteData);
      
      return res.json({
        success: true,
        message: "Ice Breakers rimossi da Instagram",
        action: "deleted"
      });
    }

    // Sync ice breakers to Meta with retry logic for transient errors
    console.log(`[INSTAGRAM] Syncing ${iceBreakers.length} Ice Breakers for config ${configId}`);
    
    const metaIceBreakers = iceBreakers.map((ib: { text: string; payload: string }) => ({
      question: ib.text,
      payload: ib.payload,
    }));

    const MAX_RETRIES = 3;
    let lastError: any = null;
    
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      const syncRes = await fetch(
        `https://graph.facebook.com/v21.0/me/messenger_profile?access_token=${accessToken}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            platform: "instagram",
            ice_breakers: metaIceBreakers,
          }),
        }
      );
      const syncData = await syncRes.json() as any;
      
      console.log(`[INSTAGRAM] Sync Ice Breakers response (attempt ${attempt}/${MAX_RETRIES}):`, syncData);

      if (syncData.result === "success" || syncData.success) {
        return res.json({
          success: true,
          message: `${iceBreakers.length} Ice Breakers sincronizzati con Instagram`,
          action: "synced",
          iceBreakers: metaIceBreakers
        });
      }
      
      // Check if error is transient and we should retry
      if (syncData.error?.is_transient && attempt < MAX_RETRIES) {
        console.log(`[INSTAGRAM] Transient error, retrying in ${attempt * 2} seconds...`);
        await new Promise(resolve => setTimeout(resolve, attempt * 2000));
        lastError = syncData;
        continue;
      }
      
      // Non-transient error or max retries reached
      lastError = syncData;
      break;
    }
    
    console.error(`[INSTAGRAM] Failed to sync Ice Breakers after ${MAX_RETRIES} attempts:`, lastError);
    const isTransient = lastError?.error?.is_transient;
    return res.status(400).json({
      success: false,
      error: isTransient 
        ? "Servizio Meta temporaneamente non disponibile. Riprova tra qualche minuto."
        : (lastError?.error?.message || "Sync fallito. Verifica i permessi dell'app."),
      isTransient,
      details: lastError,
    });
  } catch (error) {
    console.error("Error syncing Ice Breakers:", error);
    return res.status(500).json({ 
      success: false, 
      error: "Errore durante la sincronizzazione degli Ice Breakers" 
    });
  }
});

/**
 * GET /api/instagram/config/:configId/ice-breakers-status
 * Get Ice Breakers status from Meta API
 */
router.get("/config/:configId/ice-breakers-status", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const consultantId = req.user!.id;
    const encryptionSalt = req.user!.encryptionSalt;
    const { configId } = req.params;

    const [config] = await db
      .select()
      .from(consultantInstagramConfig)
      .where(
        and(
          eq(consultantInstagramConfig.id, configId),
          eq(consultantInstagramConfig.consultantId, consultantId)
        )
      )
      .limit(1);

    if (!config || !config.pageAccessToken || !config.facebookPageId) {
      return res.status(400).json({ 
        success: false, 
        error: "Configurazione incompleta." 
      });
    }

    // Decrypt token
    let accessToken = config.pageAccessToken;
    if (encryptionSalt) {
      try {
        accessToken = decryptForConsultant(config.pageAccessToken, encryptionSalt);
      } catch (e) {
        try {
          accessToken = decrypt(config.pageAccessToken);
        } catch (e2) {}
      }
    } else {
      try {
        accessToken = decrypt(config.pageAccessToken);
      } catch (e) {}
    }

    // Get current ice breakers from Meta
    const statusRes = await fetch(
      `https://graph.facebook.com/v21.0/me/messenger_profile?fields=ice_breakers&platform=instagram&access_token=${accessToken}`
    );
    const statusData = await statusRes.json() as any;

    return res.json({
      success: true,
      metaIceBreakers: statusData.data?.[0]?.ice_breakers || [],
      localIceBreakers: config.iceBreakers || [],
      inSync: JSON.stringify(statusData.data?.[0]?.ice_breakers || []) === JSON.stringify(
        (config.iceBreakers || []).map((ib: { text: string; payload: string }) => ({
          question: ib.text,
          payload: ib.payload
        }))
      )
    });
  } catch (error) {
    console.error("Error getting Ice Breakers status:", error);
    return res.status(500).json({ 
      success: false, 
      error: "Errore nel recupero dello stato Ice Breakers" 
    });
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
    console.log("[INSTAGRAM TEST] Token preview:", accessToken.substring(0, 20) + "...", "Length:", accessToken.length);
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

/**
 * POST /api/instagram/config/subscribe-webhook (singular alias)
 * POST /api/instagram/config/subscribe-webhooks
 * Manually subscribe the Facebook Page to receive Instagram messaging webhooks
 * Use this if subscription failed during OAuth or needs to be re-activated
 */
async function subscribeWebhookHandler(req: AuthRequest, res: Response) {
  try {
    const consultantId = req.user!.id;
    const encryptionSalt = req.user!.encryptionSalt;

    const [config] = await db
      .select()
      .from(consultantInstagramConfig)
      .where(eq(consultantInstagramConfig.consultantId, consultantId))
      .limit(1);

    if (!config || !config.pageAccessToken || !config.facebookPageId) {
      return res.status(400).json({ 
        success: false, 
        error: "Configurazione incompleta. Assicurati di aver completato il collegamento OAuth." 
      });
    }

    // Decrypt token
    let accessToken = config.pageAccessToken;
    console.log(`[INSTAGRAM] Decrypting token for subscribe-webhook, encryptionSalt: ${!!encryptionSalt}`);
    if (encryptionSalt) {
      try {
        accessToken = decryptForConsultant(config.pageAccessToken, encryptionSalt);
        console.log(`[INSTAGRAM] Decrypted with per-consultant key`);
      } catch (e) {
        console.log(`[INSTAGRAM] Per-consultant decryption failed, trying legacy...`);
        try {
          accessToken = decrypt(config.pageAccessToken);
          console.log(`[INSTAGRAM] Decrypted with legacy key`);
        } catch (e2) {
          console.log(`[INSTAGRAM] Legacy decryption also failed`);
        }
      }
    } else {
      try {
        accessToken = decrypt(config.pageAccessToken);
        console.log(`[INSTAGRAM] Decrypted with legacy key (no salt)`);
      } catch (e) {
        console.log(`[INSTAGRAM] Legacy decryption failed (no salt)`);
      }
    }

    // Subscribe the Facebook Page to messaging webhooks
    const subscribeUrl = `https://graph.facebook.com/v21.0/${config.facebookPageId}/subscribed_apps`;
    console.log(`[INSTAGRAM] Subscribing to webhooks: ${subscribeUrl}`);
    const subscribeRes = await fetch(subscribeUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        access_token: accessToken,
        subscribed_fields: "messages,messaging_postbacks,message_reactions,message_reads",
      }).toString(),
    });
    
    const responseText = await subscribeRes.text();
    console.log(`[INSTAGRAM] Subscribe webhook response: ${responseText}`);
    
    let subscribeData: any;
    try {
      subscribeData = JSON.parse(responseText);
    } catch (parseError) {
      console.error(`[INSTAGRAM] Failed to parse response as JSON:`, responseText);
      return res.status(500).json({
        success: false,
        error: `Meta API returned invalid response: ${responseText.substring(0, 200)}`
      });
    }

    if (subscribeData.success) {
      return res.json({
        success: true,
        message: "Webhook sottoscritto con successo",
        fields: "messages,messaging_postbacks,message_reactions,message_reads"
      });
    } else {
      console.error(`[INSTAGRAM] Webhook subscription failed:`, subscribeData);
      return res.status(400).json({
        success: false,
        error: subscribeData.error?.message || "Subscription failed"
      });
    }
  } catch (error) {
    console.error("[INSTAGRAM] Error subscribing to webhooks:", error);
    return res.status(500).json({ 
      success: false, 
      error: "Failed to subscribe to webhooks" 
    });
  }
}

router.post("/config/subscribe-webhook", authenticateToken, subscribeWebhookHandler);
router.post("/config/subscribe-webhooks", authenticateToken, subscribeWebhookHandler);

/**
 * GET /api/instagram/config/:configId/webhook-status
 * Check webhook subscription status for a specific Instagram configuration
 */
router.get("/config/:configId/webhook-status", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const consultantId = req.user!.id;
    const encryptionSalt = req.user!.encryptionSalt;
    const { configId } = req.params;

    const [config] = await db
      .select()
      .from(consultantInstagramConfig)
      .where(
        and(
          eq(consultantInstagramConfig.id, configId),
          eq(consultantInstagramConfig.consultantId, consultantId)
        )
      )
      .limit(1);

    if (!config || !config.pageAccessToken || !config.facebookPageId) {
      return res.status(400).json({ 
        success: false, 
        error: "Nessuna configurazione Instagram trovata." 
      });
    }

    // Decrypt token
    let accessToken = config.pageAccessToken;
    if (encryptionSalt) {
      try {
        accessToken = decryptForConsultant(config.pageAccessToken, encryptionSalt);
      } catch (e) {
        try {
          accessToken = decrypt(config.pageAccessToken);
        } catch (e2) {}
      }
    } else {
      try {
        accessToken = decrypt(config.pageAccessToken);
      } catch (e) {}
    }

    // Get current subscriptions
    const statusUrl = `https://graph.facebook.com/v21.0/${config.facebookPageId}/subscribed_apps?access_token=${accessToken}`;
    const statusRes = await fetch(statusUrl);
    const statusData = await statusRes.json() as any;

    return res.json({
      success: true,
      configId: config.id,
      facebookPageId: config.facebookPageId,
      instagramPageId: config.instagramPageId,
      instagramUsername: config.instagramUsername,
      subscriptions: statusData.data || [],
      isSubscribed: statusData.data?.length > 0,
    });
  } catch (error) {
    console.error("Error checking webhook status:", error);
    return res.status(500).json({ 
      success: false, 
      error: "Errore durante il controllo dello stato" 
    });
  }
});

/**
 * GET /api/instagram/config/webhook-status (legacy - gets first config)
 * Check webhook subscription status for the Facebook Page
 */
router.get("/config/webhook-status", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const consultantId = req.user!.id;
    const encryptionSalt = req.user!.encryptionSalt;

    const [config] = await db
      .select()
      .from(consultantInstagramConfig)
      .where(eq(consultantInstagramConfig.consultantId, consultantId))
      .limit(1);

    if (!config || !config.pageAccessToken || !config.facebookPageId) {
      return res.status(400).json({ 
        success: false, 
        error: "Nessuna configurazione Instagram trovata." 
      });
    }

    // Decrypt token
    let accessToken = config.pageAccessToken;
    if (encryptionSalt) {
      try {
        accessToken = decryptForConsultant(config.pageAccessToken, encryptionSalt);
      } catch (e) {
        try {
          accessToken = decrypt(config.pageAccessToken);
        } catch (e2) {}
      }
    } else {
      try {
        accessToken = decrypt(config.pageAccessToken);
      } catch (e) {}
    }

    // Get current subscriptions
    const statusUrl = `https://graph.facebook.com/v21.0/${config.facebookPageId}/subscribed_apps?access_token=${accessToken}`;
    const statusRes = await fetch(statusUrl);
    const statusData = await statusRes.json() as any;

    return res.json({
      success: true,
      configId: config.id,
      facebookPageId: config.facebookPageId,
      instagramPageId: config.instagramPageId,
      instagramUsername: config.instagramUsername,
      subscriptions: statusData.data || [],
      isSubscribed: statusData.data?.length > 0,
    });
  } catch (error) {
    console.error("Error checking webhook status:", error);
    return res.status(500).json({ 
      success: false, 
      error: "Errore durante il controllo dello stato" 
    });
  }
});

export default router;
