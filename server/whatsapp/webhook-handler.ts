import { Request, Response } from "express";
import twilio from "twilio";
import { db } from "../db";
import {
  consultantWhatsappConfig,
  whatsappConversations,
  whatsappMessages,
  whatsappPendingMessages,
  users,
  whatsappGlobalApiKeys,
} from "../../shared/schema";
import { eq, and, isNull, asc, sql } from "drizzle-orm";
import { scheduleMessageProcessing } from "./message-processor";

/**
 * Normalizes phone numbers to E.164 format (+39...)
 * Handles Italian numbers with various formats:
 * - whatsapp:+393501234567 → +393501234567
 * - +393501234567 → +393501234567
 * - 00393501234567 → +393501234567
 * - 3501234567 → +393501234567
 * - 350 123 4567 → +393501234567
 * 
 * Keeps the receptionist number constant for direct comparison
 */
export function normalizePhoneNumber(phoneNumber: string): string {
  // Remove whatsapp: prefix
  let cleaned = phoneNumber.replace(/^whatsapp:/, "");
  
  // Remove all punctuation and spaces
  cleaned = cleaned.replace(/[\s\-\.\(\)]/g, "");
  
  // If it's the receptionist number, return as-is for exact matching
  if (cleaned === "+393500220129" || cleaned === "393500220129" || cleaned === "3500220129") {
    return "+393500220129";
  }
  
  // Handle 0039 prefix (international format without +)
  if (cleaned.startsWith("0039")) {
    cleaned = "+39" + cleaned.substring(4);
  }
  // Handle + prefix already present
  else if (cleaned.startsWith("+39")) {
    // Already in E.164 format
  }
  // Handle local Italian mobile number (starts with 3)
  else if (/^3\d{8,9}$/.test(cleaned)) {
    cleaned = "+39" + cleaned;
  }
  // Handle number starting with 39 but without +
  else if (cleaned.startsWith("39") && /^393\d{8,9}$/.test(cleaned)) {
    cleaned = "+" + cleaned;
  }
  
  return cleaned;
}

/**
 * Detects media type from Twilio MediaContentType
 * Maps MIME types to our schema's mediaType enum
 * 
 * @param contentType - The MediaContentType from Twilio webhook (e.g., "audio/ogg", "image/jpeg")
 * @returns The detected media type: "audio", "image", "video", "document", or "text"
 */
function detectMediaType(contentType: string | null | undefined): "text" | "audio" | "image" | "video" | "document" {
  if (!contentType) return "text";
  
  const lower = contentType.toLowerCase();
  
  // Detect audio (WhatsApp voice messages come as "audio/ogg")
  if (lower.startsWith("audio/")) return "audio";
  
  // Detect images
  if (lower.startsWith("image/")) return "image";
  
  // Detect videos
  if (lower.startsWith("video/")) return "video";
  
  // Default to document for PDFs, documents, and unknown types
  return "document";
}

/**
 * Handle Twilio status updates (sent, delivered, failed, undelivered)
 * These webhooks update existing outbound messages instead of creating new ones
 */
async function handleStatusUpdate(webhookBody: TwilioWebhookBody): Promise<boolean> {
  const messageSid = webhookBody.MessageSid;
  const messageStatus = webhookBody.MessageStatus;
  const errorCode = webhookBody.ErrorCode;
  const errorMessage = webhookBody.ErrorMessage;

  console.log(`📊 [WEBHOOK STATUS] Received status update for ${messageSid}: ${messageStatus}`);
  
  if (errorCode) {
    console.log(`   Error Code: ${errorCode}`);
    console.log(`   Error Message: ${errorMessage}`);
  }

  // Find existing message by twilioSid
  const [existingMessage] = await db
    .select()
    .from(whatsappMessages)
    .where(eq(whatsappMessages.twilioSid, messageSid))
    .limit(1);

  if (!existingMessage) {
    console.log(`⚠️ [WEBHOOK STATUS] Message ${messageSid} not found in database - might be a race condition or external message`);
    return false;
  }

  // Map Twilio status to our schema enum
  const validStatuses = ["queued", "sent", "delivered", "read", "failed", "undelivered"];
  const mappedStatus = validStatuses.includes(messageStatus || "")
    ? (messageStatus as "queued" | "sent" | "delivered" | "read" | "failed" | "undelivered")
    : existingMessage.twilioStatus;

  // Prepare metadata update
  const existingMetadata = existingMessage.metadata || {};
  const updatedMetadata = {
    ...existingMetadata,
    lastStatusUpdate: new Date().toISOString(),
    ...(errorCode && { errorCode }),
    ...(errorMessage && { errorMessage }),
  };

  // Update the existing message
  await db
    .update(whatsappMessages)
    .set({
      twilioStatus: mappedStatus,
      metadata: updatedMetadata,
    })
    .where(eq(whatsappMessages.id, existingMessage.id));

  console.log(`✅ [WEBHOOK STATUS] Updated message ${existingMessage.id} (${messageSid}) to status: ${mappedStatus}`);

  // Log specific errors
  if (messageStatus === "failed" && errorCode) {
    console.error(`\n❌ [WEBHOOK ERROR] Message ${messageSid} failed:`);
    console.error(`   Message ID: ${existingMessage.id}`);
    console.error(`   Conversation ID: ${existingMessage.conversationId}`);
    console.error(`   Error Code: ${errorCode}`);
    console.error(`   Error Message: ${errorMessage}`);
    
    if (errorCode === "63016") {
      console.error(`   🚨 TEMPLATE NOT APPROVED - This template has not been approved by WhatsApp`);
      console.error(`   📝 Action Required: Get template approved in Twilio Console before sending`);
    } else if (errorCode === "63003") {
      console.error(`   🚨 INVALID PHONE NUMBER - The recipient number is not valid or not registered on WhatsApp`);
    } else if (errorCode === "63007") {
      console.error(`   🚨 MESSAGE BLOCKED - User has blocked this WhatsApp number`);
    }
    console.error('');
  }

  return true;
}

export interface TwilioWebhookBody {
  AccountSid: string;
  MessageSid: string;
  From: string;
  To: string;
  Body: string;
  NumMedia: string;
  MediaContentType0?: string;
  MediaUrl0?: string;
  // Status update fields
  MessageStatus?: string;
  ErrorCode?: string;
  ErrorMessage?: string;
}

/**
 * Core webhook processing logic (used by both webhook endpoint and polling service)
 * 
 * SECURITY NOTE: Signature validation is handled by handleIncomingWhatsAppMessage() for webhook endpoint.
 * Polling service bypasses signature validation (safe because it uses trusted DB credentials).
 */
export async function handleWebhook(webhookBody: TwilioWebhookBody): Promise<void> {
  const twilioAccountSid = webhookBody.AccountSid;
  const from = webhookBody.From;
  const to = webhookBody.To;
  const messageText = webhookBody.Body || "";
  const messageSid = webhookBody.MessageSid;
  const numMedia = parseInt(webhookBody.NumMedia || "0");
  const messageStatus = webhookBody.MessageStatus;

  const phoneNumber = from.replace("whatsapp:", "");
  const toNumber = to.replace("whatsapp:", "");

  // 🔍 DETECT STATUS UPDATES: Twilio sends status callbacks for outbound messages
  // Status updates typically have MessageStatus field with empty/missing Body
  // We also check if the message already exists in DB (outbound direction) as additional validation
  if (messageStatus) {
    const bodyIsEmpty = !messageText || messageText.trim() === "";
    
    // Check if message exists in our DB (it would be an outbound message we sent)
    const [existingMsg] = await db
      .select()
      .from(whatsappMessages)
      .where(eq(whatsappMessages.twilioSid, messageSid))
      .limit(1);
    
    // If body is empty OR message exists as outbound, treat as status update
    if (bodyIsEmpty || (existingMsg && existingMsg.direction === 'outbound')) {
      console.log(`🔔 [WEBHOOK] Detected status update (MessageStatus=${messageStatus}, bodyEmpty=${bodyIsEmpty}, existingOutbound=${!!existingMsg})`);
      const handled = await handleStatusUpdate(webhookBody);
      if (handled) {
        console.log(`✅ [WEBHOOK] Status update processed successfully`);
        return;
      }
      // If not handled (message not found), continue as normal inbound message processing
      console.log(`⚠️ [WEBHOOK] Status update not handled, treating as potential new message`);
    }
  }

  // ANTI-DUPLICAZIONE: Check veloce pre-processing per evitare lavoro inutile
  // La protezione atomica principale è ON CONFLICT DO NOTHING durante l'INSERT
  const [existingInMessages] = await db
    .select()
    .from(whatsappMessages)
    .where(eq(whatsappMessages.twilioSid, messageSid))
    .limit(1);

  if (existingInMessages) {
    console.log(`⏭️ [ANTI-DUP] Messaggio ${messageSid} già presente in whatsappMessages - skipping`);
    return;
  }

  const [existingInPending] = await db
    .select()
    .from(whatsappPendingMessages)
    .where(eq(whatsappPendingMessages.twilioSid, messageSid))
    .limit(1);

  if (existingInPending) {
    console.log(`⏭️ [ANTI-DUP] Messaggio ${messageSid} già in coda (whatsappPendingMessages) - skipping`);
    return;
  }

  console.log(`✅ [ANTI-DUP] Messaggio ${messageSid} è nuovo, procedo con l'elaborazione`);

  // Find config by destination WhatsApp number (To field) for multi-agent support
  const [config] = await db
    .select()
    .from(consultantWhatsappConfig)
    .where(
      and(
        eq(consultantWhatsappConfig.twilioAccountSid, twilioAccountSid),
        eq(consultantWhatsappConfig.twilioWhatsappNumber, toNumber)
      )
    )
    .limit(1);

  if (!config) {
    console.error(`❌ No config found for Twilio account ${twilioAccountSid} with WhatsApp number ${toNumber}`);
    return;
  }

  console.log(`📞 Routing message to agent: ${config.agentName} (${toNumber})`);

  // CRITICAL FIX: Only find existing conversation, don't create yet
  // This prevents ghost conversations when message is duplicate
  let conversation = await findConversation(phoneNumber, config.consultantId, config.id);

  // NULL SAFETY FIX: If conversation doesn't exist (was deleted or never created), create it now
  // This handles legitimate new messages without crashing
  if (!conversation) {
    console.log(`🆕 Conversation not found for ${phoneNumber}, creating new one...`);
    conversation = await findOrCreateConversation(phoneNumber, config.consultantId, config.id);
  }

  if (!conversation.aiEnabled) {
    console.log("⏸️ AI disabled for conversation, storing message with media");

    // RACE CONDITION FIX: Use ON CONFLICT DO NOTHING for atomic duplicate prevention
    // If multiple webhooks arrive simultaneously, unique constraint on twilioSid prevents duplicates
    const savedMessages = await db.insert(whatsappMessages).values({
      conversationId: conversation.id,
      messageText,
      direction: "inbound",
      sender: "client",
      twilioSid: messageSid,
      mediaType: numMedia > 0 ? (webhookBody.MediaContentType0?.startsWith("image/") ? "image" : webhookBody.MediaContentType0?.startsWith("audio/") ? "audio" : "document") : "text",
      mediaUrl: webhookBody.MediaUrl0 || null,
      mediaContentType: webhookBody.MediaContentType0 || null,
    })
    .onConflictDoNothing({ target: whatsappMessages.twilioSid })
    .returning();

    // If ON CONFLICT triggered, savedMessages will be empty - skip processing
    if (savedMessages.length === 0) {
      console.log(`⏭️ [ANTI-DUP ATOMIC] Messaggio ${messageSid} duplicate detected during INSERT - skipping`);
      return;
    }

    const [savedMessage] = savedMessages;

    // Process media even when AI is disabled (for manual conversations)
    if (numMedia > 0 && webhookBody.MediaUrl0 && webhookBody.MediaContentType0) {
      console.log(`📸 Processing media for AI-disabled conversation: ${savedMessage.id}`);
      
      // Import dynamically to avoid circular dependency
      const { handleIncomingMedia } = await import("./media-handler");
      const { whatsappGlobalApiKeys } = await import("../../shared/schema");
      const { asc } = await import("drizzle-orm");
      
      // Get an API key for media processing (filtered by consultant)
      const [apiKey] = await db
        .select()
        .from(whatsappGlobalApiKeys)
        .where(
          and(
            eq(whatsappGlobalApiKeys.consultantId, config.consultantId),
            eq(whatsappGlobalApiKeys.isActive, true)
          )
        )
        .orderBy(asc(whatsappGlobalApiKeys.lastUsedAt))
        .limit(1);

      if (apiKey) {
        await handleIncomingMedia(
          savedMessage.id,
          webhookBody.MediaUrl0,
          webhookBody.MediaContentType0,
          config.consultantId,
          apiKey.apiKey
        );
        
        // Update key usage stats
        await db
          .update(whatsappGlobalApiKeys)
          .set({
            lastUsedAt: new Date(),
            usageCount: sql`${whatsappGlobalApiKeys.usageCount} + 1`,
          })
          .where(eq(whatsappGlobalApiKeys.id, apiKey.id));
      } else {
        console.warn(`⚠️ No API key available for consultant ${config.consultantId} - media processing skipped`);
      }
    }

    // Update conversation stats
    await db
      .update(whatsappConversations)
      .set({
        lastMessageAt: new Date(),
        lastMessageFrom: "client",
        messageCount: conversation.messageCount + 1,
        unreadByConsultant: conversation.unreadByConsultant + 1,
        updatedAt: new Date(),
      })
      .where(eq(whatsappConversations.id, conversation.id));

    return;
  }

  await db.insert(whatsappPendingMessages).values({
    conversationId: conversation.id,
    phoneNumber,
    messageText,
    twilioSid: messageSid,
    mediaType: numMedia > 0 ? detectMediaType(webhookBody.MediaContentType0) : null,
    mediaUrl: webhookBody.MediaUrl0 || null,
    mediaContentType: webhookBody.MediaContentType0 || null,
    metadata: {
      agentConfigId: config.id,
      toNumber: toNumber,
      agentName: config.agentName,
    } as any,
  });

  console.log(`📨 Message queued for processing: ${phoneNumber} (twilioSid: ${messageSid})`);
  
  scheduleMessageProcessing(phoneNumber, config.consultantId);
}

/**
 * Express endpoint handler for Twilio webhooks
 * Validates signature and calls handleWebhook
 */
export async function handleIncomingWhatsAppMessage(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const webhookBody: TwilioWebhookBody = req.body;

    const twilioAccountSid = webhookBody.AccountSid;

    const [config] = await db
      .select()
      .from(consultantWhatsappConfig)
      .where(eq(consultantWhatsappConfig.twilioAccountSid, twilioAccountSid))
      .limit(1);

    if (!config) {
      console.error("❌ Unknown Twilio account:", twilioAccountSid);
      res.sendStatus(200);
      return;
    }

    const signature = req.headers["x-twilio-signature"] as string;
    const url = `${req.protocol}://${req.get("host")}${req.originalUrl}`;

    const isValid = twilio.validateRequest(
      config.twilioAuthToken,
      signature,
      url,
      req.body
    );

    if (!isValid) {
      console.error("❌ Invalid Twilio signature");
      res.status(403).json({ error: "Invalid signature" });
      return;
    }

    await handleWebhook(webhookBody);

    res.sendStatus(200);
  } catch (error) {
    console.error("❌ Webhook error:", error);
    res.sendStatus(500);
  }
}

/**
 * Classifies a phone number participant type
 * Returns: "receptionist" | "consultant" | "client" | "unknown"
 */
async function classifyParticipant(
  normalizedPhone: string,
  consultantId: string,
  tx: any
): Promise<{ type: "receptionist" | "consultant" | "client" | "unknown"; userId: string | null; userRole: string | null }> {
  // Check if receptionist
  if (normalizedPhone === "+393500220129") {
    return { type: "receptionist", userId: null, userRole: null };
  }

  // Query all users with this phone number
  const usersWithPhone = await tx
    .select()
    .from(users)
    .where(eq(users.phoneNumber, normalizedPhone));

  if (usersWithPhone.length === 0) {
    return { type: "unknown", userId: null, userRole: null };
  }

  // Check if it's a consultant (could be the same consultant managing the account)
  const consultant = usersWithPhone.find((u: any) => u.role === "consultant");
  if (consultant) {
    console.log(`👨‍💼 [PARTICIPANT] Recognized CONSULTANT: ${consultant.firstName} ${consultant.lastName}`);
    return { type: "consultant", userId: consultant.id, userRole: "consultant" };
  }

  // Check if it's a client
  const client = usersWithPhone.find((u: any) => u.role === "client" && u.consultantId === consultantId);
  if (client) {
    console.log(`👤 [PARTICIPANT] Recognized CLIENT: ${client.firstName} ${client.lastName}`);
    return { type: "client", userId: client.id, userRole: "client" };
  }

  // Has phone in DB but doesn't match criteria
  return { type: "unknown", userId: null, userRole: null };
}

/**
 * Find existing conversation without creating it
 * Used to prevent ghost conversations from duplicate webhooks
 */
export async function findConversation(
  phoneNumber: string,
  consultantId: string,
  agentConfigId?: string
): Promise<typeof whatsappConversations.$inferSelect | null> {
  const normalizedPhone = normalizePhoneNumber(phoneNumber);
  
  let conversation: typeof whatsappConversations.$inferSelect | null = null;

  if (agentConfigId) {
    [conversation] = await db
      .select()
      .from(whatsappConversations)
      .where(
        and(
          eq(whatsappConversations.phoneNumber, normalizedPhone),
          eq(whatsappConversations.consultantId, consultantId),
          eq(whatsappConversations.agentConfigId, agentConfigId),
          eq(whatsappConversations.isActive, true)
        )
      )
      .limit(1);
  } else {
    [conversation] = await db
      .select()
      .from(whatsappConversations)
      .where(
        and(
          eq(whatsappConversations.phoneNumber, normalizedPhone),
          eq(whatsappConversations.consultantId, consultantId),
          eq(whatsappConversations.isActive, true)
        )
      )
      .limit(1);
  }

  return conversation || null;
}

export async function findOrCreateConversation(
  phoneNumber: string,
  consultantId: string,
  agentConfigId?: string,
  isProactiveLead: boolean = false,
  proactiveLeadId?: string
) {
  const normalizedPhone = normalizePhoneNumber(phoneNumber);
  const callTimestamp = new Date().toISOString();
  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`🔍 [CONVERSATION LOOKUP] Called at ${callTimestamp}`);
  console.log(`📞 Phone: ${normalizedPhone}`);
  console.log(`👤 Consultant: ${consultantId}`);
  console.log(`🤖 Agent: ${agentConfigId || 'none'}`);
  console.log(`🎯 Proactive Lead: ${isProactiveLead}`);
  console.log(`📍 Call originated from:`);
  const stack = new Error().stack?.split('\n').slice(2, 6).join('\n') || 'N/A';
  console.log(stack);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  
  return await db.transaction(async (tx) => {
    let conversation: typeof whatsappConversations.$inferSelect | undefined;

    if (agentConfigId) {
      [conversation] = await tx
        .select()
        .from(whatsappConversations)
        .where(
          and(
            eq(whatsappConversations.phoneNumber, normalizedPhone),
            eq(whatsappConversations.consultantId, consultantId),
            eq(whatsappConversations.agentConfigId, agentConfigId)
          )
        )
        .for('update')
        .limit(1);
    }

    if (!conversation) {
      [conversation] = await tx
        .select()
        .from(whatsappConversations)
        .where(
          and(
            eq(whatsappConversations.phoneNumber, normalizedPhone),
            eq(whatsappConversations.consultantId, consultantId)
          )
        )
        .for('update')
        .limit(1);
    }

    if (conversation) {
      console.log(`✅ [CONVERSATION FOUND] id=${conversation.id}, agentConfigId=${conversation.agentConfigId}, isLead=${conversation.isLead}, isProactiveLead=${conversation.isProactiveLead}`);
      
      // Classify participant and update metadata if not already classified
      const participant = await classifyParticipant(normalizedPhone, consultantId, tx);
      const currentMetadata = conversation.metadata || {};
      
      if (!currentMetadata.participantType) {
        console.log(`🏷️  [METADATA] Adding participant classification: ${participant.type}`);
        await tx
          .update(whatsappConversations)
          .set({
            metadata: {
              ...currentMetadata,
              participantType: participant.type,
              participantUserId: participant.userId,
              participantRole: participant.userRole,
            } as any,
          })
          .where(eq(whatsappConversations.id, conversation.id));
        
        // Update local object
        conversation.metadata = {
          ...currentMetadata,
          participantType: participant.type,
          participantUserId: participant.userId,
          participantRole: participant.userRole,
        } as any;
      }
      
      if (isProactiveLead && (!conversation.isProactiveLead || conversation.proactiveLeadId !== proactiveLeadId)) {
        console.log(`🔄 [UPDATING PROACTIVE FLAGS] Marking existing conversation as proactive`);
        [conversation] = await tx
          .update(whatsappConversations)
          .set({
            isProactiveLead: true,
            proactiveLeadId: proactiveLeadId || null,
            proactiveLeadAssignedAt: sql`now()`,
          })
          .where(eq(whatsappConversations.id, conversation.id))
          .returning();
      }
      
      if (conversation.testModeOverride) {
        console.log(`🧪 [TEST MODE] Override attivo: ${conversation.testModeOverride}`);
        
        if (conversation.testModeOverride === "client" && conversation.testModeUserId) {
          conversation.isLead = false;
          conversation.userId = conversation.testModeUserId;
        } else if (conversation.testModeOverride === "lead") {
          conversation.isLead = true;
          conversation.userId = null;
        } else if (conversation.testModeOverride === "consulente") {
          conversation.isLead = false;
          conversation.userId = null;
          // Set participantType to 'consultant' in metadata so message processor recognizes it
          conversation.metadata = {
            ...(conversation.metadata || {}),
            participantType: 'consultant'
          } as any;
          console.log(`🧪 [TEST MODE] Simulando consulente`);
        }
      }
      
      return conversation;
    }

    console.log(`\n🆕🆕🆕 [CONVERSATION CREATE] Creating NEW conversation at ${new Date().toISOString()} 🆕🆕🆕`);
    
    // Classify participant for new conversation
    const participant = await classifyParticipant(normalizedPhone, consultantId, tx);
    
    // Determine userId and isLead based on participant type
    let userId = participant.userId;
    let isLead = false;
    
    if (participant.type === "receptionist" || participant.type === "consultant") {
      // Receptionist and consultant are never leads
      isLead = false;
    } else if (participant.type === "client") {
      isLead = false;
    } else {
      // Unknown = lead
      isLead = true;
    }

    console.log(`👤 [PARTICIPANT] Type: ${participant.type}, isLead: ${isLead}, userId: ${userId || 'none'}`);

    // Use ON CONFLICT DO NOTHING to handle race conditions gracefully
    // If a duplicate is inserted, the database will ignore it and return empty array
    const inserted = await tx
      .insert(whatsappConversations)
      .values({
        phoneNumber: normalizedPhone,
        consultantId,
        userId,
        isLead,
        aiEnabled: true,
        isActive: true,
        agentConfigId: agentConfigId || null,
        isProactiveLead: isProactiveLead,
        proactiveLeadId: proactiveLeadId || null,
        proactiveLeadAssignedAt: isProactiveLead ? sql`now()` : null,
        metadata: {
          participantType: participant.type,
          participantUserId: participant.userId,
          participantRole: participant.userRole,
        } as any,
      })
      .onConflictDoNothing()
      .returning();

    if (inserted.length > 0) {
      // Successfully inserted new conversation
      [conversation] = inserted;
      console.log(
        `✅ [CONVERSATION CREATED] id=${conversation.id} for ${normalizedPhone} (Type: ${participant.type}, ${isLead ? "Lead" : "Known User"}${isProactiveLead ? " - PROACTIVE" : ""}) assigned to agent: ${agentConfigId || 'default'}`
      );
    } else {
      // Conflict occurred, fetch the existing conversation
      console.log(`⚠️ [RACE CONDITION] Duplicate detected, fetching existing conversation...`);
      [conversation] = await tx
        .select()
        .from(whatsappConversations)
        .where(
          and(
            eq(whatsappConversations.phoneNumber, normalizedPhone),
            eq(whatsappConversations.consultantId, consultantId)
          )
        )
        .limit(1);
      
      if (!conversation) {
        throw new Error(`Failed to find or create conversation for ${normalizedPhone}`);
      }
      
      console.log(`✅ [CONVERSATION FOUND] id=${conversation.id} after race condition`);
    }

    return conversation;
  });
}
