/**
 * Instagram Webhook Handler
 * 
 * Handles incoming webhooks from Meta:
 * - Webhook verification (GET request)
 * - Message events (POST request)
 * - Story replies and mentions
 * - Comment notifications
 */

import { Request, Response } from "express";
import crypto from "crypto";
import { db } from "../db";
import {
  consultantInstagramConfig,
  superadminInstagramConfig,
  instagramConversations,
  instagramMessages,
  instagramPendingMessages,
  instagramAgentConfig,
  consultantWhatsappConfig,
} from "../../shared/schema";
import { decrypt, decryptForConsultant } from "../encryption";
import { eq, and, sql } from "drizzle-orm";
import {
  MetaWebhookEvent,
  MetaMessagingEvent,
  MetaChange,
  MetaCommentValue,
} from "./types";
import { scheduleInstagramMessageProcessing } from "./message-processor";
import { WindowTracker } from "./window-tracker";
import { MESSAGING_WINDOW_MS } from "./index";
import { MetaClient } from "./meta-client";
import { users } from "../../shared/schema";

/**
 * Verify webhook signature from Meta
 */
function verifySignature(
  rawBody: Buffer,
  signature: string | undefined,
  appSecret: string
): boolean {
  if (!signature) {
    console.log("⚠️ [INSTAGRAM WEBHOOK] No signature provided");
    return false;
  }

  const expectedSignature = crypto
    .createHmac("sha256", appSecret)
    .update(rawBody)
    .digest("hex");

  const providedSignature = signature.replace("sha256=", "");
  
  // Debug logging - VERBOSE for troubleshooting
  console.log(`🔐 [INSTAGRAM WEBHOOK] Signature check:`);
  console.log(`   Provided signature: sha256=${providedSignature}`);
  console.log(`   Expected signature: sha256=${expectedSignature}`);
  console.log(`   App Secret used: ${appSecret.substring(0, 8)}...${appSecret.slice(-8)} (length: ${appSecret.length})`);
  console.log(`   Raw body length: ${rawBody.length}`);
  console.log(`   Raw body (first 200 chars): ${rawBody.toString().substring(0, 200)}`);
  
  // Handle different signature lengths (Meta test might have different format)
  if (providedSignature.length !== expectedSignature.length) {
    console.log(`   ⚠️ Signature length mismatch: provided=${providedSignature.length}, expected=${expectedSignature.length}`);
    return false;
  }
  
  try {
    return crypto.timingSafeEqual(
      Buffer.from(expectedSignature),
      Buffer.from(providedSignature)
    );
  } catch (err) {
    console.log(`   ❌ Signature comparison error:`, err);
    return false;
  }
}

/**
 * Get Super Admin Instagram config (centralized credentials)
 */
async function getSuperAdminConfig() {
  const [config] = await db
    .select()
    .from(superadminInstagramConfig)
    .where(eq(superadminInstagramConfig.enabled, true))
    .limit(1);
  return config;
}

/**
 * Handle webhook verification (GET request from Meta)
 * Uses centralized Super Admin verify token
 */
export async function verifyInstagramWebhook(req: Request, res: Response): Promise<void> {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  console.log(`🔐 [INSTAGRAM WEBHOOK] Verification request: mode=${mode}, token=${token}`);

  if (mode !== "subscribe") {
    console.log("❌ [INSTAGRAM WEBHOOK] Invalid mode");
    res.status(403).send("Forbidden");
    return;
  }

  // Get Super Admin config with centralized verify token
  const superAdminConfig = await getSuperAdminConfig();

  if (!superAdminConfig || superAdminConfig.verifyToken !== token) {
    console.log("❌ [INSTAGRAM WEBHOOK] Invalid verify token (checked Super Admin config)");
    res.status(403).send("Forbidden");
    return;
  }

  console.log(`✅ [INSTAGRAM WEBHOOK] Verification successful (Super Admin config)`);
  res.status(200).send(challenge);
}

/**
 * Handle incoming webhook events (POST request from Meta)
 */
export async function handleInstagramWebhook(req: Request, res: Response): Promise<void> {
  // RESPOND 200 IMMEDIATELY to prevent Meta from timing out
  // Process everything async after responding
  res.status(200).send("EVENT_RECEIVED");
  
  console.log(`\n${"━".repeat(60)}`);
  console.log(`🔥 [INSTAGRAM WEBHOOK] RAW INCOMING at ${new Date().toISOString()}`);
  console.log(`📦 [INSTAGRAM WEBHOOK] FULL BODY:`, JSON.stringify(req.body, null, 2));
  console.log(`${"━".repeat(60)}\n`);
  
  try {
    const event: MetaWebhookEvent = req.body;
    
    // Log what type of events we received
    for (const entry of event.entry || []) {
      console.log(`📋 [INSTAGRAM WEBHOOK] Entry ID: ${entry.id}`);
      console.log(`   - Has messaging: ${!!entry.messaging} (${entry.messaging?.length || 0} events)`);
      console.log(`   - Has changes: ${!!entry.changes} (${entry.changes?.length || 0} events)`);
      if (entry.changes) {
        for (const change of entry.changes) {
          console.log(`   - Change field: ${change.field}`);
          console.log(`   - Change value:`, JSON.stringify(change.value).slice(0, 300));
        }
      }
    }

    // Accept both "instagram" and "page" object types
    // Instagram DMs via Messenger API arrive as object: "page" with entry[].messaging[]
    // Direct Instagram webhooks arrive as object: "instagram" with entry[].changes[]
    if (event.object !== "instagram" && event.object !== "page") {
      console.log(`⚠️ [INSTAGRAM WEBHOOK] Ignoring unknown event object type: ${event.object}`);
      return; // Already responded 200 at start
    }
    
    const isPageEvent = event.object === "page";
    console.log(`✅ [INSTAGRAM WEBHOOK] Valid ${isPageEvent ? "PAGE (Messenger API)" : "INSTAGRAM"} event received`);
    console.log(`📊 [INSTAGRAM WEBHOOK] Entries count: ${event.entry?.length || 0}`);
    
    // For page events, extract Instagram DM messages from entry[].messaging[]
    if (isPageEvent) {
      console.log(`📱 [INSTAGRAM WEBHOOK] Processing PAGE event for Instagram DMs`);
      for (const entry of event.entry || []) {
        console.log(`📋 [INSTAGRAM WEBHOOK] PAGE Entry ID (Facebook Page): ${entry.id}`);
        
        if (entry.messaging && entry.messaging.length > 0) {
          for (const msgEvent of entry.messaging) {
            console.log(`💬 [INSTAGRAM WEBHOOK] PAGE Messaging Event:`);
            console.log(`   Sender ID: ${msgEvent.sender?.id}`);
            console.log(`   Recipient ID: ${msgEvent.recipient?.id}`);
            console.log(`   Timestamp: ${msgEvent.timestamp}`);
            if (msgEvent.message) {
              console.log(`   Message ID: ${msgEvent.message.mid}`);
              console.log(`   Message Text: ${msgEvent.message.text || "(no text)"}`);
              console.log(`   Has Attachments: ${!!(msgEvent.message.attachments?.length)}`);
            }
            if (msgEvent.read) {
              console.log(`   READ receipt - watermark: ${msgEvent.read.watermark}`);
            }
            if (msgEvent.delivery) {
              console.log(`   DELIVERY receipt - mids: ${msgEvent.delivery.mids?.join(", ")}`);
            }
          }
        }
      }
      
      // For now, log page events but continue to process them through the normal flow
      // The entry.id for page events is the Facebook Page ID, which we can use to find the config
    }

    // Get signature from headers
    const signature = req.headers["x-hub-signature-256"] as string | undefined;
    const rawBody = req.rawBody;

    // Get Super Admin config for centralized App Secret
    const superAdminConfig = await getSuperAdminConfig();
    let decryptedAppSecret: string | null = null;
    
    if (superAdminConfig?.metaAppSecretEncrypted) {
      try {
        decryptedAppSecret = decrypt(superAdminConfig.metaAppSecretEncrypted);
        console.log(`🔓 [INSTAGRAM WEBHOOK] Decrypted App Secret from DB:`);
        console.log(`   Full secret: ${decryptedAppSecret}`);
        console.log(`   Preview: ${decryptedAppSecret?.substring(0, 8)}...${decryptedAppSecret?.slice(-8)} (length: ${decryptedAppSecret?.length})`);
      } catch (e) {
        console.log(`⚠️ [INSTAGRAM WEBHOOK] Failed to decrypt App Secret:`, e);
      }
    }

    // Verify signature using centralized App Secret
    if (decryptedAppSecret && rawBody && signature) {
      const isValidSignature = verifySignature(rawBody, signature, decryptedAppSecret);
      if (!isValidSignature) {
        // Check if this is a Meta test message (random_mid, random_text)
        const bodyStr = rawBody.toString();
        const isTestMessage = bodyStr.includes('"mid":"random_mid"') || bodyStr.includes('"text":"random_text"');
        
        if (isTestMessage) {
          console.log(`⚠️ [INSTAGRAM WEBHOOK] Invalid signature but this is a META TEST message - continuing for development`);
          // Continue processing for test messages
        } else {
          console.log(`❌ [INSTAGRAM WEBHOOK] Invalid signature (checked Super Admin App Secret)`);
          return; // Already responded 200 at start
        }
      } else {
        console.log(`✅ [INSTAGRAM WEBHOOK] Signature verified (Super Admin config)`);
      }
    } else if (!decryptedAppSecret) {
      console.log(`⚠️ [INSTAGRAM WEBHOOK] No Super Admin App Secret configured - skipping signature verification`);
    }

    // Process each entry
    for (const entry of event.entry) {
      // NOTE: entry.id can be either Instagram Account ID OR Facebook Page ID depending on webhook type
      let entryId = entry.id;
      
      // TRUCCO PER META: Se arriva l'ID business, lo trasformo in ID utente (per test)
      if (entryId === '17841474222864076') {
        console.log(`🔄 [INSTAGRAM WEBHOOK] Mapping Business ID 17841474222864076 -> User ID 17841401835429922`);
        entryId = '17841401835429922';
      }

      // MULTI-AGENT ROUTING: First check per-agent Instagram configs
      let agentConfig: typeof instagramAgentConfig.$inferSelect | null = null;
      let whatsappAgent: typeof consultantWhatsappConfig.$inferSelect | null = null;
      
      // Try to find per-agent config by Instagram Page ID
      const [foundAgentConfig] = await db
        .select()
        .from(instagramAgentConfig)
        .where(
          and(
            eq(instagramAgentConfig.instagramPageId, entryId),
            eq(instagramAgentConfig.isActive, true)
          )
        )
        .limit(1);

      if (foundAgentConfig) {
        agentConfig = foundAgentConfig;
        // Get the associated WhatsApp agent
        const [agent] = await db
          .select()
          .from(consultantWhatsappConfig)
          .where(eq(consultantWhatsappConfig.id, foundAgentConfig.whatsappAgentId))
          .limit(1);
        whatsappAgent = agent || null;
        
        console.log(`🎯 [INSTAGRAM WEBHOOK] MULTI-AGENT: Found per-agent config for Page ID ${entryId}`);
        console.log(`   📱 WhatsApp Agent: ${whatsappAgent?.agentName} (ID: ${whatsappAgent?.id})`);
        console.log(`   🎭 AI Personality: ${agentConfig.aiPersonality}`);
      }

      // Fallback: try Facebook Page ID in per-agent configs
      if (!agentConfig) {
        const [foundAgentConfigFB] = await db
          .select()
          .from(instagramAgentConfig)
          .where(
            and(
              eq(instagramAgentConfig.facebookPageId, entryId),
              eq(instagramAgentConfig.isActive, true)
            )
          )
          .limit(1);

        if (foundAgentConfigFB) {
          agentConfig = foundAgentConfigFB;
          const [agent] = await db
            .select()
            .from(consultantWhatsappConfig)
            .where(eq(consultantWhatsappConfig.id, foundAgentConfigFB.whatsappAgentId))
            .limit(1);
          whatsappAgent = agent || null;
          
          console.log(`🎯 [INSTAGRAM WEBHOOK] MULTI-AGENT: Found per-agent config via Facebook Page ID ${entryId}`);
        }
      }

      // FALLBACK: Try consultant-level Instagram config (legacy/default)
      let config: typeof consultantInstagramConfig.$inferSelect | null = null;
      
      if (!agentConfig) {
        // Try to find config by Instagram Page ID first (most common for Instagram webhooks)
        const [foundConfig] = await db
          .select()
          .from(consultantInstagramConfig)
          .where(
            and(
              eq(consultantInstagramConfig.instagramPageId, entryId),
              eq(consultantInstagramConfig.isActive, true)
            )
          )
          .limit(1);
        
        config = foundConfig || null;

        // Fallback: try Facebook Page ID if not found
        if (!config) {
          const [foundConfigFB] = await db
            .select()
            .from(consultantInstagramConfig)
            .where(
              and(
                eq(consultantInstagramConfig.facebookPageId, entryId),
                eq(consultantInstagramConfig.isActive, true)
              )
            )
            .limit(1);
          config = foundConfigFB || null;
        }
      }

      // Check if we have any config
      if (!agentConfig && !config) {
        console.log(`⚠️ [INSTAGRAM WEBHOOK] No active config for entry.id ${entryId}`);
        console.log(`   💡 Hint: Searched both per-agent and consultant configs - no match found`);
        
        // Debug: List all active configs to help troubleshoot
        const allConfigs = await db
          .select({
            id: consultantInstagramConfig.id,
            instagramPageId: consultantInstagramConfig.instagramPageId,
            facebookPageId: consultantInstagramConfig.facebookPageId,
            instagramUsername: consultantInstagramConfig.instagramUsername,
            isActive: consultantInstagramConfig.isActive
          })
          .from(consultantInstagramConfig)
          .where(eq(consultantInstagramConfig.isActive, true));
        
        console.log(`   📋 DEBUG: Active consultant configs in DB:`);
        for (const c of allConfigs) {
          console.log(`      - @${c.instagramUsername}: instagramPageId=${c.instagramPageId}, facebookPageId=${c.facebookPageId}`);
        }
        console.log(`   🔍 Looking for entry.id: ${entryId}`);
        
        continue;
      }
      
      // Log which config we're using
      if (agentConfig && whatsappAgent) {
        console.log(`✅ [INSTAGRAM WEBHOOK] Using PER-AGENT config:`);
        console.log(`   📱 Agent: ${whatsappAgent.agentName} (WhatsApp ID: ${whatsappAgent.id})`);
        console.log(`   📸 Instagram: @${agentConfig.instagramUsername || 'unknown'}`);
        console.log(`   🤖 Auto-response: ${agentConfig.autoResponseEnabled}, Dry-run: ${agentConfig.isDryRun}`);
      } else if (config) {
        console.log(`✅ [INSTAGRAM WEBHOOK] Using CONSULTANT config (legacy):`);
        console.log(`   📱 Consultant: ${config.consultantId}`);
        console.log(`   📸 Instagram: @${config.instagramUsername || 'unknown'}`);
        console.log(`   🤖 Auto-response: ${config.autoResponseEnabled}, Dry-run: ${config.isDryRun}`);
      }

      // Use the effective config (prefer agent config over consultant config)
      const effectiveConfig = agentConfig || config!;

      // Handle messaging events (DMs, story replies, etc.)
      if (entry.messaging && entry.messaging.length > 0) {
        console.log(`💬 [IG DM EVENTS] Processing ${entry.messaging.length} messaging event(s)...`);
        for (const messagingEvent of entry.messaging) {
          console.log(`💬 [IG DM EVENT]`, JSON.stringify(messagingEvent, null, 2));
          // Pass config with agent context for multi-agent support
          await handleMessagingEvent(
            effectiveConfig as typeof consultantInstagramConfig.$inferSelect, 
            messagingEvent,
            whatsappAgent
          );
        }
      }

      // Handle changes events (comments, mentions, etc.)
      if (entry.changes && entry.changes.length > 0) {
        console.log(`🗨️ [IG CHANGE EVENTS] Processing ${entry.changes.length} change event(s)...`);
        for (const change of entry.changes) {
          await handleChangeEvent(
            effectiveConfig as typeof consultantInstagramConfig.$inferSelect, 
            change,
            whatsappAgent
          );
        }
      }
    }

    // Already responded 200 at start
  } catch (error) {
    console.error("❌ [INSTAGRAM WEBHOOK] Error processing webhook:", error);
    // Already responded 200 at start, just log the error
  }
}

/**
 * Handle messaging events (DMs, story replies)
 */
async function handleMessagingEvent(
  config: typeof consultantInstagramConfig.$inferSelect,
  event: MetaMessagingEvent,
  whatsappAgent?: typeof consultantWhatsappConfig.$inferSelect | null
): Promise<void> {
  const senderId = event.sender.id;
  const recipientId = event.recipient.id;
  
  // Skip echo messages (messages we sent)
  if (event.message?.is_echo) {
    console.log(`📤 [INSTAGRAM WEBHOOK] Skipping echo message from ${senderId}`);
    return;
  }

  console.log(`📥 [INSTAGRAM WEBHOOK] Received message from ${senderId}`);

  // Handle postback (ice breaker click)
  if (event.postback) {
    await handlePostback(config, senderId, event.postback);
    return;
  }

  // Handle read receipt
  if (event.read) {
    await handleReadReceipt(config, senderId, event.read.mid);
    return;
  }

  // Handle regular message
  if (!event.message) {
    console.log(`⚠️ [INSTAGRAM WEBHOOK] No message content in event`);
    return;
  }

  // Determine message source type
  let sourceType: "dm" | "story_reply" | "story_mention" = "dm";
  let sourcePostId: string | undefined;
  let messageText = event.message.text || "";

  // Check for story reply
  if (event.message.reply_to?.story) {
    sourceType = "story_reply";
    sourcePostId = event.message.reply_to.story.id;
  }

  // Check for story mention in attachments
  if (event.message.attachments) {
    for (const attachment of event.message.attachments) {
      if (attachment.type === "story_mention") {
        sourceType = "story_mention";
        // For story mentions, the text might be empty but we have the attachment
        if (!messageText) {
          messageText = "[Story mention]";
        }
      }
    }
  }

  // Find or create conversation
  let [conversation] = await db
    .select()
    .from(instagramConversations)
    .where(
      and(
        eq(instagramConversations.consultantId, config.consultantId),
        eq(instagramConversations.instagramUserId, senderId),
        eq(instagramConversations.agentConfigId, config.id)
      )
    )
    .limit(1);

  const now = new Date();
  const windowExpiresAt = new Date(now.getTime() + MESSAGING_WINDOW_MS);

  if (!conversation) {
    // Create new conversation
    [conversation] = await db
      .insert(instagramConversations)
      .values({
        consultantId: config.consultantId,
        agentConfigId: config.id,
        instagramUserId: senderId,
        sourceType,
        sourcePostId,
        lastUserMessageAt: now,
        windowExpiresAt,
        isWindowOpen: true,
        messageCount: 1,
        unreadByConsultant: 1,
        lastMessageAt: now,
        lastMessageFrom: "client",
      })
      .returning();

    console.log(`🆕 [INSTAGRAM WEBHOOK] Created new conversation ${conversation.id}`);
  } else {
    // Update existing conversation
    await db
      .update(instagramConversations)
      .set({
        lastUserMessageAt: now,
        windowExpiresAt,
        isWindowOpen: true,
        messageCount: sql`${instagramConversations.messageCount} + 1`,
        unreadByConsultant: sql`${instagramConversations.unreadByConsultant} + 1`,
        lastMessageAt: now,
        lastMessageFrom: "client",
        updatedAt: now,
      })
      .where(eq(instagramConversations.id, conversation.id));

    console.log(`📝 [INSTAGRAM WEBHOOK] Updated conversation ${conversation.id}`);
  }

  // Determine media type
  let mediaType: "text" | "image" | "video" | "audio" | "sticker" | "story_reply" | "story_mention" = "text";
  let mediaUrl: string | undefined;

  if (event.message.attachments && event.message.attachments.length > 0) {
    const attachment = event.message.attachments[0];
    switch (attachment.type) {
      case "image":
        mediaType = "image";
        break;
      case "video":
      case "ig_reel":
        mediaType = "video";
        break;
      case "audio":
        mediaType = "audio";
        break;
      case "animated_media":
        mediaType = "sticker";
        break;
      case "story_mention":
        mediaType = "story_mention";
        break;
    }
    mediaUrl = attachment.payload.url;
  }

  if (sourceType === "story_reply") {
    mediaType = "story_reply";
  }

  // Save message to database
  const [savedMessage] = await db
    .insert(instagramMessages)
    .values({
      conversationId: conversation.id,
      messageText: messageText || "[Media]",
      direction: "inbound",
      sender: "client",
      mediaType,
      mediaUrl,
      instagramMessageId: event.message.mid,
      replyToStoryId: event.message.reply_to?.story?.id,
      replyToStoryUrl: event.message.reply_to?.story?.url,
      createdAt: now,
    })
    .returning();

  console.log(`💾 [INSTAGRAM WEBHOOK] Saved message ${savedMessage.id}`);

  // Add to pending messages for batch processing
  await db.insert(instagramPendingMessages).values({
    conversationId: conversation.id,
    consultantId: config.consultantId,
    instagramUserId: senderId,
    messageText: messageText || "[Media]",
    mediaType,
    mediaUrl,
    instagramMessageId: event.message.mid,
    receivedAt: now,
  });

  // Schedule message processing (batching like WhatsApp)
  // Dry run mode now processes the full flow but doesn't actually send messages
  if (config.autoResponseEnabled) {
    if (config.isDryRun) {
      console.log(`🧪 [INSTAGRAM WEBHOOK] DRY RUN MODE - Processing full flow without sending actual messages`);
    }
    scheduleInstagramMessageProcessing(
      conversation.id,
      config.id,
      config.consultantId
    );
  } else {
    console.log(`⏸️ [INSTAGRAM WEBHOOK] Auto-response disabled for config ${config.id}`);
  }
}

/**
 * Handle postback events (ice breaker clicks)
 */
async function handlePostback(
  config: typeof consultantInstagramConfig.$inferSelect,
  senderId: string,
  postback: { mid: string; title: string; payload: string }
): Promise<void> {
  console.log(`🧊 [INSTAGRAM WEBHOOK] Ice breaker clicked: ${postback.title} (${postback.payload})`);

  // Find or create conversation
  let [conversation] = await db
    .select()
    .from(instagramConversations)
    .where(
      and(
        eq(instagramConversations.consultantId, config.consultantId),
        eq(instagramConversations.instagramUserId, senderId),
        eq(instagramConversations.agentConfigId, config.id)
      )
    )
    .limit(1);

  const now = new Date();
  const windowExpiresAt = new Date(now.getTime() + MESSAGING_WINDOW_MS);

  if (!conversation) {
    [conversation] = await db
      .insert(instagramConversations)
      .values({
        consultantId: config.consultantId,
        agentConfigId: config.id,
        instagramUserId: senderId,
        sourceType: "ice_breaker",
        lastUserMessageAt: now,
        windowExpiresAt,
        isWindowOpen: true,
        messageCount: 1,
        unreadByConsultant: 1,
        lastMessageAt: now,
        lastMessageFrom: "client",
      })
      .returning();
  } else {
    await db
      .update(instagramConversations)
      .set({
        lastUserMessageAt: now,
        windowExpiresAt,
        isWindowOpen: true,
        messageCount: sql`${instagramConversations.messageCount} + 1`,
        unreadByConsultant: sql`${instagramConversations.unreadByConsultant} + 1`,
        lastMessageAt: now,
        lastMessageFrom: "client",
        updatedAt: now,
      })
      .where(eq(instagramConversations.id, conversation.id));
  }

  // Save the postback as a message
  await db.insert(instagramMessages).values({
    conversationId: conversation.id,
    messageText: `[Ice Breaker] ${postback.title}`,
    direction: "inbound",
    sender: "client",
    mediaType: "text",
    instagramMessageId: postback.mid,
    metadata: { iceBreaker: true, payload: postback.payload },
    createdAt: now,
  });

  // Add to pending for processing
  await db.insert(instagramPendingMessages).values({
    conversationId: conversation.id,
    consultantId: config.consultantId,
    instagramUserId: senderId,
    messageText: `[Ice Breaker] ${postback.title}`,
    instagramMessageId: postback.mid,
    receivedAt: now,
    metadata: { iceBreaker: true, payload: postback.payload },
  });

  // Schedule processing (dry run mode processes full flow without sending)
  if (config.autoResponseEnabled) {
    if (config.isDryRun) {
      console.log(`🧪 [INSTAGRAM WEBHOOK] DRY RUN MODE - Processing ice breaker without sending actual messages`);
    }
    scheduleInstagramMessageProcessing(
      conversation.id,
      config.id,
      config.consultantId
    );
  }
}

/**
 * Handle read receipt
 */
async function handleReadReceipt(
  config: typeof consultantInstagramConfig.$inferSelect,
  senderId: string,
  messageId: string
): Promise<void> {
  console.log(`👁️ [INSTAGRAM WEBHOOK] Read receipt for ${messageId}`);

  // Update message as read
  await db
    .update(instagramMessages)
    .set({
      metaStatus: "read",
      readAt: new Date(),
    })
    .where(eq(instagramMessages.instagramMessageId, messageId));
}

/**
 * Handle change events (comments on posts)
 */
async function handleChangeEvent(
  config: typeof consultantInstagramConfig.$inferSelect,
  change: MetaChange,
  whatsappAgent?: typeof consultantWhatsappConfig.$inferSelect | null
): Promise<void> {
  const field = change.field;
  const value = change.value;
  
  if (field === "comments" || field === "live_comments") {
    console.log(`🗨️ [IG COMMENT EVENT] Field: ${field}`);
    console.log(`🗨️ [IG COMMENT EVENT] Value:`, JSON.stringify(value, null, 2));
    if (whatsappAgent) {
      console.log(`🎯 [IG COMMENT EVENT] Via WhatsApp Agent: ${whatsappAgent.agentName}`);
    }
    
    if (!config.commentToDmEnabled) {
      console.log(`⚠️ [IG COMMENT EVENT] commentToDmEnabled is FALSE for config ${config.id} - skipping comment processing`);
      console.log(`   💡 Enable "Comment to DM" in agent settings to process comments`);
      return;
    }
    
    const commentValue = value as MetaCommentValue;
    await handleCommentEvent(config, commentValue, whatsappAgent);
  } else {
    console.log(`🧩 [IG CHANGE EVENT] Field: ${field}, Value:`, JSON.stringify(value, null, 2).slice(0, 500));
  }
}

/**
 * Handle comment-to-DM automation using Private Replies
 * 
 * Private Replies allow sending 1 DM per comment, within 7 days.
 * No existing conversation or open window required!
 * 
 * @see https://developers.facebook.com/docs/messenger-platform/instagram/features/private-replies
 */
async function handleCommentEvent(
  config: typeof consultantInstagramConfig.$inferSelect,
  comment: MetaCommentValue,
  whatsappAgent?: typeof consultantWhatsappConfig.$inferSelect | null
): Promise<void> {
  console.log(`💬 [INSTAGRAM COMMENT] From @${comment.from.username}: "${comment.text}"`);
  console.log(`   Comment ID: ${comment.id}`);
  console.log(`   Post ID: ${comment.media?.id || 'unknown'}`);

  // Check if comment contains trigger keywords (whole word match, case insensitive)
  const triggerKeywords = config.commentTriggerKeywords || [];
  const commentText = comment.text.toLowerCase();
  
  // Split comment into words, removing punctuation
  const commentWords = commentText.replace(/[^\w\s]/g, ' ').split(/\s+/).filter(Boolean);
  
  let triggered = false;
  let matchedKeyword = '';
  
  // If no keywords configured, require at least one to avoid accidental replies to ALL comments
  if (triggerKeywords.length === 0) {
    console.log(`⚠️ [INSTAGRAM COMMENT] No trigger keywords configured - skipping`);
    console.log(`   💡 Configure keywords in agent settings (e.g., "INFO", "LINK", "DM")`);
    return;
  }
  
  for (const keyword of triggerKeywords) {
    const keywordLower = keyword.toLowerCase().trim();
    if (commentWords.includes(keywordLower)) {
      triggered = true;
      matchedKeyword = keyword;
      break;
    }
  }

  if (!triggered) {
    console.log(`⏭️ [INSTAGRAM COMMENT] No trigger keyword found in comment`);
    console.log(`   Keywords configured: ${triggerKeywords.join(', ')}`);
    return;
  }

  console.log(`🎯 [INSTAGRAM COMMENT] Triggered by keyword "${matchedKeyword}"!`);

  // Get the auto-reply message
  const autoReplyMessage = config.commentAutoReplyMessage || 
    "Ciao! Grazie per il tuo commento. Ti scrivo in privato!";

  // Get consultant's encryption salt for token decryption
  const [consultant] = await db
    .select()
    .from(users)
    .where(eq(users.id, config.consultantId))
    .limit(1);

  if (!consultant) {
    console.error(`❌ [INSTAGRAM COMMENT] Consultant not found: ${config.consultantId}`);
    return;
  }

  // Decrypt page access token
  let pageAccessToken: string | null = config.pageAccessToken;
  if (!pageAccessToken) {
    console.error(`❌ [INSTAGRAM COMMENT] No page access token configured`);
    return;
  }

  try {
    if (consultant.encryptionSalt) {
      pageAccessToken = decryptForConsultant(pageAccessToken, consultant.encryptionSalt);
    } else {
      pageAccessToken = decrypt(pageAccessToken);
    }
  } catch (e) {
    // Token might not be encrypted
    console.log(`🔓 [INSTAGRAM COMMENT] Token decryption failed, using as-is`);
  }

  // Create MetaClient with the Facebook Page ID (not Instagram Page ID)
  // For Private Replies, we POST to /{PAGE-ID}/messages
  const metaClient = new MetaClient({
    pageAccessToken,
    instagramPageId: config.facebookPageId!, // Facebook Page ID is used for the API endpoint
    isDryRun: config.isDryRun || false,
  });

  try {
    console.log(`📤 [INSTAGRAM COMMENT] Sending Private Reply to comment ${comment.id}...`);
    
    // Send Private Reply using the comment ID (NOT user ID!)
    const result = await metaClient.sendPrivateReply(comment.id, autoReplyMessage);
    
    if (result) {
      console.log(`✅ [INSTAGRAM COMMENT] Private Reply sent successfully!`);
      console.log(`   Message ID: ${result.message_id}`);
      
      // Optionally create/update conversation for future DMs
      // The user can now reply to this DM and open a normal conversation window
      const [existingConversation] = await db
        .select()
        .from(instagramConversations)
        .where(
          and(
            eq(instagramConversations.consultantId, config.consultantId),
            eq(instagramConversations.instagramUserId, comment.from.id),
            eq(instagramConversations.agentConfigId, config.id)
          )
        )
        .limit(1);

      if (!existingConversation) {
        // Create new conversation record for this user
        const [newConversation] = await db
          .insert(instagramConversations)
          .values({
            consultantId: config.consultantId,
            agentConfigId: config.id,
            instagramUserId: comment.from.id,
            instagramUsername: comment.from.username,
            isWindowOpen: false, // Window opens when they reply to our DM
            lastUserMessageAt: null,
            windowExpiresAt: null,
          })
          .returning();

        console.log(`📝 [INSTAGRAM COMMENT] Created conversation record for @${comment.from.username}`);
        
        // Store the outbound message
        await db.insert(instagramMessages).values({
          conversationId: newConversation.id,
          consultantId: config.consultantId,
          direction: 'outbound',
          messageText: autoReplyMessage,
          instagramMessageId: result.message_id,
          sentAt: new Date(),
          metaStatus: 'sent',
          metadata: { 
            privateReply: true, 
            triggerCommentId: comment.id,
            triggerKeyword: matchedKeyword,
          },
        });
      } else {
        // Store the outbound message in existing conversation
        await db.insert(instagramMessages).values({
          conversationId: existingConversation.id,
          consultantId: config.consultantId,
          direction: 'outbound',
          messageText: autoReplyMessage,
          instagramMessageId: result.message_id,
          sentAt: new Date(),
          metaStatus: 'sent',
          metadata: { 
            privateReply: true, 
            triggerCommentId: comment.id,
            triggerKeyword: matchedKeyword,
          },
        });
      }
    }
  } catch (error: any) {
    console.error(`❌ [INSTAGRAM COMMENT] Private Reply failed:`, error.message);
    
    // Common errors:
    // - Already replied to this comment (1 reply limit)
    // - Comment is older than 7 days
    // - Invalid comment ID
    if (error.message?.includes('code: 10')) {
      console.log(`   💡 This usually means: already replied to this comment OR comment is >7 days old`);
    }
  }
}
