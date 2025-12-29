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
} from "../../shared/schema";
import { decrypt } from "../encryption";
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
  
  return crypto.timingSafeEqual(
    Buffer.from(expectedSignature),
    Buffer.from(providedSignature)
  );
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
  console.log(`\n${"━".repeat(60)}`);
  console.log(`📥 [INSTAGRAM WEBHOOK] Incoming POST request at ${new Date().toISOString()}`);
  console.log(`📦 [INSTAGRAM WEBHOOK] Raw body preview:`, JSON.stringify(req.body).slice(0, 500));
  console.log(`${"━".repeat(60)}\n`);
  
  try {
    const event: MetaWebhookEvent = req.body;

    if (event.object !== "instagram") {
      console.log(`⚠️ [INSTAGRAM WEBHOOK] Ignoring non-Instagram event: ${event.object}`);
      res.status(200).send("EVENT_RECEIVED");
      return;
    }
    
    console.log(`✅ [INSTAGRAM WEBHOOK] Valid Instagram event received`);
    console.log(`📊 [INSTAGRAM WEBHOOK] Entries count: ${event.entry?.length || 0}`);

    // Get signature from headers
    const signature = req.headers["x-hub-signature-256"] as string | undefined;
    const rawBody = req.rawBody;

    // Get Super Admin config for centralized App Secret
    const superAdminConfig = await getSuperAdminConfig();
    let decryptedAppSecret: string | null = null;
    
    if (superAdminConfig?.metaAppSecretEncrypted) {
      try {
        decryptedAppSecret = decrypt(superAdminConfig.metaAppSecretEncrypted);
      } catch (e) {
        console.log(`⚠️ [INSTAGRAM WEBHOOK] Failed to decrypt App Secret`);
      }
    }

    // Verify signature using centralized App Secret
    if (decryptedAppSecret && rawBody && signature) {
      const isValidSignature = verifySignature(rawBody, signature, decryptedAppSecret);
      if (!isValidSignature) {
        console.log(`❌ [INSTAGRAM WEBHOOK] Invalid signature (checked Super Admin App Secret)`);
        res.status(200).send("EVENT_RECEIVED"); // Still respond 200 to prevent retries
        return;
      }
      console.log(`✅ [INSTAGRAM WEBHOOK] Signature verified (Super Admin config)`);
    } else if (!decryptedAppSecret) {
      console.log(`⚠️ [INSTAGRAM WEBHOOK] No Super Admin App Secret configured - skipping signature verification`);
    }

    // Process each entry
    for (const entry of event.entry) {
      const instagramPageId = entry.id;

      // Find agent config for this page
      const [config] = await db
        .select()
        .from(consultantInstagramConfig)
        .where(
          and(
            eq(consultantInstagramConfig.instagramPageId, instagramPageId),
            eq(consultantInstagramConfig.isActive, true)
          )
        )
        .limit(1);

      if (!config) {
        console.log(`⚠️ [INSTAGRAM WEBHOOK] No active config for page ${instagramPageId}`);
        continue;
      }

      // Handle messaging events
      if (entry.messaging) {
        for (const messagingEvent of entry.messaging) {
          await handleMessagingEvent(config, messagingEvent);
        }
      }

      // Handle changes events (comments, mentions)
      if (entry.changes) {
        for (const change of entry.changes) {
          await handleChangeEvent(config, change);
        }
      }
    }

    // Respond 200 to Meta (they expect this within 20 seconds)
    res.status(200).send("EVENT_RECEIVED");
  } catch (error) {
    console.error("❌ [INSTAGRAM WEBHOOK] Error processing webhook:", error);
    // Still respond 200 to prevent Meta from retrying
    if (!res.headersSent) {
      res.status(200).send("EVENT_RECEIVED");
    }
  }
}

/**
 * Handle messaging events (DMs, story replies)
 */
async function handleMessagingEvent(
  config: typeof consultantInstagramConfig.$inferSelect,
  event: MetaMessagingEvent
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
  change: MetaChange
): Promise<void> {
  if (change.field === "comments" && config.commentToDmEnabled) {
    const commentValue = change.value as MetaCommentValue;
    await handleCommentEvent(config, commentValue);
  }
}

/**
 * Handle comment-to-DM automation
 */
async function handleCommentEvent(
  config: typeof consultantInstagramConfig.$inferSelect,
  comment: MetaCommentValue
): Promise<void> {
  console.log(`💬 [INSTAGRAM WEBHOOK] Comment from ${comment.from.username}: "${comment.text}"`);

  // Check if comment contains trigger keywords (whole word match, case insensitive)
  const triggerKeywords = config.commentTriggerKeywords || [];
  const commentText = comment.text.toLowerCase();
  
  // Split comment into words, removing punctuation
  const commentWords = commentText.replace(/[^\w\s]/g, ' ').split(/\s+/).filter(Boolean);
  
  const triggered = triggerKeywords.some((keyword: string) => {
    const keywordLower = keyword.toLowerCase().trim();
    // Check if keyword exists as a whole word in the comment
    return commentWords.includes(keywordLower);
  });

  if (!triggered) {
    console.log(`⏭️ [INSTAGRAM WEBHOOK] Comment doesn't contain trigger keywords`);
    return;
  }

  console.log(`🎯 [INSTAGRAM WEBHOOK] Comment triggered! Sending DM to ${comment.from.id}`);

  // Check if we already have a conversation with this user
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

  // Note: We can only send DM if we have an open window (user messaged us first)
  // For comment-to-DM, we'll create a pending message that will be sent when user opens window
  if (!existingConversation || !existingConversation.isWindowOpen) {
    console.log(`⚠️ [INSTAGRAM WEBHOOK] No open window for ${comment.from.username}. Comment-to-DM requires user to message first in Instagram API.`);
    // TODO: Store pending comment trigger for when user opens window
    return;
  }

  // If window is open, we can send the auto-reply DM
  // This will be handled by the message processor
  await db.insert(instagramPendingMessages).values({
    conversationId: existingConversation.id,
    consultantId: config.consultantId,
    instagramUserId: comment.from.id,
    messageText: `[Comment Trigger] User commented: "${comment.text}"`,
    instagramMessageId: comment.id,
    receivedAt: new Date(),
    metadata: { commentTrigger: true, postId: comment.media.id },
  });

  // Schedule processing (dry run mode processes full flow without sending)
  if (config.autoResponseEnabled) {
    if (config.isDryRun) {
      console.log(`🧪 [INSTAGRAM WEBHOOK] DRY RUN MODE - Processing comment trigger without sending actual messages`);
    }
    scheduleInstagramMessageProcessing(
      existingConversation.id,
      config.id,
      config.consultantId
    );
  }
}
