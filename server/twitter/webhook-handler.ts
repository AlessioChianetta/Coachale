/**
 * Twitter/X Webhook Handler
 * 
 * Handles incoming webhooks from X Account Activity API:
 * - CRC (Challenge Response Check) verification
 * - DM events
 * - Typing indicators
 * - Read receipts
 */

import { Request, Response } from "express";
import crypto from "crypto";
import { db } from "../db";
import {
  consultantTwitterConfig,
  superadminTwitterConfig,
  twitterConversations,
  twitterMessages,
  twitterPendingMessages,
  twitterAgentConfig,
  consultantWhatsappConfig,
} from "../../shared/schema";
import { decrypt } from "../encryption";
import { eq, and, sql } from "drizzle-orm";
import {
  TwitterWebhookEvent,
  TwitterDMEvent,
  CRCResponse,
} from "./types";
import { scheduleTwitterMessageProcessing } from "./message-processor";

/**
 * Generate CRC response token
 * Required for Twitter webhook verification
 */
function generateCRCResponse(crcToken: string, consumerSecret: string): string {
  const hmac = crypto.createHmac("sha256", consumerSecret);
  hmac.update(crcToken);
  return `sha256=${hmac.digest("base64")}`;
}

/**
 * Verify webhook signature from X
 */
function verifySignature(
  rawBody: Buffer,
  signature: string | undefined,
  consumerSecret: string
): boolean {
  if (!signature) {
    console.log("⚠️ [TWITTER WEBHOOK] No signature provided");
    return false;
  }

  const expectedSignature = crypto
    .createHmac("sha256", consumerSecret)
    .update(rawBody)
    .digest("base64");

  const providedSignature = signature.replace("sha256=", "");

  console.log(`🔐 [TWITTER WEBHOOK] Signature check:`);
  console.log(`   Provided: sha256=${providedSignature.slice(0, 20)}...`);
  console.log(`   Expected: sha256=${expectedSignature.slice(0, 20)}...`);

  try {
    return crypto.timingSafeEqual(
      Buffer.from(expectedSignature),
      Buffer.from(providedSignature)
    );
  } catch (err) {
    console.log(`❌ [TWITTER WEBHOOK] Signature comparison error:`, err);
    return false;
  }
}

/**
 * Get Super Admin Twitter config (centralized credentials)
 */
async function getSuperAdminConfig() {
  const [config] = await db
    .select()
    .from(superadminTwitterConfig)
    .where(eq(superadminTwitterConfig.enabled, true))
    .limit(1);
  return config;
}

/**
 * Handle CRC verification (GET request from X)
 * X sends this periodically to verify the webhook is alive
 */
export async function verifyTwitterWebhook(req: Request, res: Response): Promise<void> {
  const crcToken = req.query.crc_token as string;

  console.log(`🔐 [TWITTER WEBHOOK] CRC verification request received`);

  if (!crcToken) {
    console.log("❌ [TWITTER WEBHOOK] No crc_token provided");
    res.status(400).send("Missing crc_token");
    return;
  }

  // Get Super Admin config for API secret
  const superAdminConfig = await getSuperAdminConfig();

  if (!superAdminConfig?.apiSecretEncrypted) {
    console.log("❌ [TWITTER WEBHOOK] No Super Admin config found");
    res.status(500).send("Server configuration error");
    return;
  }

  try {
    const apiSecret = decrypt(superAdminConfig.apiSecretEncrypted);
    const responseToken = generateCRCResponse(crcToken, apiSecret);

    const response: CRCResponse = {
      response_token: responseToken,
    };

    console.log(`✅ [TWITTER WEBHOOK] CRC verification successful`);
    res.status(200).json(response);
  } catch (error) {
    console.error("❌ [TWITTER WEBHOOK] CRC verification failed:", error);
    res.status(500).send("CRC verification failed");
  }
}

/**
 * Handle incoming webhook events (POST request from X)
 */
export async function handleTwitterWebhook(req: Request, res: Response): Promise<void> {
  // RESPOND 200 IMMEDIATELY to prevent X from timing out
  res.status(200).send("EVENT_RECEIVED");

  console.log(`\n${"━".repeat(60)}`);
  console.log(`🐦 [TWITTER WEBHOOK] RAW INCOMING at ${new Date().toISOString()}`);
  console.log(`📦 [TWITTER WEBHOOK] FULL BODY:`, JSON.stringify(req.body, null, 2));
  console.log(`${"━".repeat(60)}\n`);

  try {
    const event: TwitterWebhookEvent = req.body;
    const forUserId = event.for_user_id;

    if (!forUserId) {
      console.log("⚠️ [TWITTER WEBHOOK] No for_user_id in event");
      return;
    }

    // Verify signature
    const signature = req.headers["x-twitter-webhooks-signature"] as string | undefined;
    const rawBody = req.rawBody;

    const superAdminConfig = await getSuperAdminConfig();
    if (superAdminConfig?.apiSecretEncrypted && rawBody && signature) {
      const apiSecret = decrypt(superAdminConfig.apiSecretEncrypted);
      const isValid = verifySignature(rawBody, signature, apiSecret);
      
      if (!isValid) {
        console.log("❌ [TWITTER WEBHOOK] Invalid signature");
        return;
      }
      console.log("✅ [TWITTER WEBHOOK] Signature verified");
    }

    // Find config for this user
    const [config] = await db
      .select()
      .from(consultantTwitterConfig)
      .where(
        and(
          eq(consultantTwitterConfig.twitterUserId, forUserId),
          eq(consultantTwitterConfig.isActive, true)
        )
      )
      .limit(1);

    if (!config) {
      console.log(`⚠️ [TWITTER WEBHOOK] No config found for user ${forUserId}`);
      return;
    }

    console.log(`✅ [TWITTER WEBHOOK] Found config for @${config.twitterUsername}`);

    // Handle DM events
    if (event.direct_message_events && event.direct_message_events.length > 0) {
      console.log(`💬 [TWITTER DM] Processing ${event.direct_message_events.length} DM event(s)`);
      
      for (const dmEvent of event.direct_message_events) {
        await handleDMEvent(config, dmEvent, event.users || {});
      }
    }

    // Handle typing events (optional logging)
    if (event.direct_message_indicate_typing_events) {
      console.log(`⌨️ [TWITTER TYPING] ${event.direct_message_indicate_typing_events.length} typing indicator(s)`);
    }

    // Handle read receipts (optional logging)
    if (event.direct_message_mark_read_events) {
      console.log(`👁️ [TWITTER READ] ${event.direct_message_mark_read_events.length} read receipt(s)`);
    }

  } catch (error) {
    console.error("❌ [TWITTER WEBHOOK] Error processing webhook:", error);
  }
}

/**
 * Handle individual DM event
 */
async function handleDMEvent(
  config: typeof consultantTwitterConfig.$inferSelect,
  dmEvent: TwitterDMEvent,
  users: Record<string, { id: number; id_str: string; name: string; screen_name: string; profile_image_url_https?: string }>
): Promise<void> {
  const senderId = dmEvent.message_create.sender_id;
  const recipientId = dmEvent.message_create.target.recipient_id;
  const messageText = dmEvent.message_create.message_data.text;
  const messageId = dmEvent.id;
  const timestamp = new Date(parseInt(dmEvent.created_timestamp));

  // Skip messages from ourselves (echo)
  if (senderId === config.twitterUserId) {
    console.log(`📤 [TWITTER WEBHOOK] Skipping echo message`);
    return;
  }

  console.log(`📥 [TWITTER DM] Received from ${senderId}: "${messageText.slice(0, 50)}..."`);

  // Get sender info from users object
  const senderInfo = users[senderId];
  const senderUsername = senderInfo?.screen_name || null;
  const senderDisplayName = senderInfo?.name || null;
  const senderProfileImage = senderInfo?.profile_image_url_https || null;

  // Find or create conversation
  let [conversation] = await db
    .select()
    .from(twitterConversations)
    .where(
      and(
        eq(twitterConversations.consultantId, config.consultantId),
        eq(twitterConversations.twitterUserId, senderId),
        eq(twitterConversations.agentConfigId, config.id)
      )
    )
    .limit(1);

  const now = new Date();

  if (!conversation) {
    // Create new conversation
    [conversation] = await db
      .insert(twitterConversations)
      .values({
        consultantId: config.consultantId,
        agentConfigId: config.id,
        twitterUserId: senderId,
        twitterUsername: senderUsername,
        displayName: senderDisplayName,
        profileImageUrl: senderProfileImage,
        sourceType: "dm",
        messageCount: 1,
        unreadByConsultant: 1,
        lastMessageAt: now,
        lastMessageFrom: "client",
      })
      .returning();

    console.log(`🆕 [TWITTER WEBHOOK] Created new conversation ${conversation.id}`);
  } else {
    // Update existing conversation
    await db
      .update(twitterConversations)
      .set({
        twitterUsername: senderUsername || conversation.twitterUsername,
        displayName: senderDisplayName || conversation.displayName,
        profileImageUrl: senderProfileImage || conversation.profileImageUrl,
        messageCount: sql`${twitterConversations.messageCount} + 1`,
        unreadByConsultant: sql`${twitterConversations.unreadByConsultant} + 1`,
        lastMessageAt: now,
        lastMessageFrom: "client",
        updatedAt: now,
      })
      .where(eq(twitterConversations.id, conversation.id));

    console.log(`📝 [TWITTER WEBHOOK] Updated conversation ${conversation.id}`);
  }

  // Save the message
  await db.insert(twitterMessages).values({
    conversationId: conversation.id,
    messageText,
    direction: "inbound",
    sender: "client",
    mediaType: "text",
    twitterMessageId: messageId,
    dmEventId: messageId,
    createdAt: timestamp,
  });

  console.log(`💾 [TWITTER WEBHOOK] Saved message to DB`);

  // Check if auto-response is enabled
  if (!config.autoResponseEnabled) {
    console.log(`⏸️ [TWITTER WEBHOOK] Auto-response disabled`);
    return;
  }

  // Check dry run mode
  if (config.isDryRun) {
    console.log(`🧪 [TWITTER WEBHOOK] DRY RUN - would process message`);
    return;
  }

  // Schedule AI processing
  try {
    await scheduleTwitterMessageProcessing(conversation.id, config.id);
    console.log(`🤖 [TWITTER WEBHOOK] Scheduled AI processing`);
  } catch (error) {
    console.error(`❌ [TWITTER WEBHOOK] Failed to schedule processing:`, error);
  }
}
