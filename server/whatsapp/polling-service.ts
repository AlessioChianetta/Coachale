// WhatsApp Polling Service - Alternative to webhooks for receiving messages
// Periodically polls Twilio API for new incoming messages
// Uses node-cron for scheduling with duplicate prevention (similar to email-scheduler)

import cron from "node-cron";
import type { ScheduledTask } from "node-cron";
import { db } from "../db";
import {
  consultantWhatsappConfig,
  whatsappMessages,
  whatsappConversations,
  whatsappPollingWatermarks,
} from "../../shared/schema";
import { eq, and, desc, isNull, sql } from "drizzle-orm";
import { handleWebhook } from "./webhook-handler";
import twilio from "twilio";

// Anti-flooding protection
const MAX_MESSAGES_PER_POLL = 50;

// Circuit breaker configuration
const MAX_CONSECUTIVE_ERRORS = 5;
const CIRCUIT_BREAKER_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes

const POLLING_KEY = Symbol.for("app.whatsappPolling");

interface PollingRegistry {
  task: ScheduledTask | null;
  registrationId: string | null;
}

declare global {
  var __whatsappPollingRegistry: PollingRegistry | undefined;
}

function getRegistry(): PollingRegistry {
  if (!globalThis.__whatsappPollingRegistry) {
    globalThis.__whatsappPollingRegistry = {
      task: null,
      registrationId: null,
    };
  }
  return globalThis.__whatsappPollingRegistry;
}

/**
 * Get or create watermark for agent config
 */
async function getOrCreateWatermark(agentConfigId: string, consultantId: string) {
  const [watermark] = await db
    .select()
    .from(whatsappPollingWatermarks)
    .where(eq(whatsappPollingWatermarks.agentConfigId, agentConfigId))
    .limit(1);

  if (watermark) {
    return watermark;
  }

  // Create new watermark starting from 24 hours ago (safe default)
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  
  const [newWatermark] = await db
    .insert(whatsappPollingWatermarks)
    .values({
      consultantId,
      agentConfigId,
      lastProcessedMessageDate: oneDayAgo,
      lastPolledAt: new Date(),
    })
    .returning();

  console.log(`🆕 [WATERMARK] Created new watermark for agent ${agentConfigId} starting from ${oneDayAgo.toISOString()}`);
  return newWatermark;
}

/**
 * Check and reset circuit breaker if cooldown period has passed
 */
async function checkCircuitBreaker(agentConfigId: string): Promise<boolean> {
  const [watermark] = await db
    .select()
    .from(whatsappPollingWatermarks)
    .where(eq(whatsappPollingWatermarks.agentConfigId, agentConfigId))
    .limit(1);

  if (!watermark || !watermark.isCircuitBreakerOpen) {
    return false; // Circuit is closed, can proceed
  }

  const cooldownElapsed = watermark.circuitBreakerOpenedAt 
    && (Date.now() - watermark.circuitBreakerOpenedAt.getTime()) > CIRCUIT_BREAKER_COOLDOWN_MS;

  if (cooldownElapsed) {
    // Reset circuit breaker
    await db
      .update(whatsappPollingWatermarks)
      .set({
        isCircuitBreakerOpen: false,
        consecutiveErrors: 0,
        circuitBreakerOpenedAt: null,
        updatedAt: new Date(),
      })
      .where(eq(whatsappPollingWatermarks.agentConfigId, agentConfigId));

    console.log(`🔓 [CIRCUIT BREAKER] Reset for agent ${agentConfigId} after cooldown`);
    return false;
  }

  return true; // Circuit still open
}

/**
 * Poll Twilio API for new incoming WhatsApp messages for a single consultant
 */
async function pollMessagesForConsultant(
  config: typeof consultantWhatsappConfig.$inferSelect
): Promise<void> {
  if (!config.twilioAccountSid || !config.twilioAuthToken || !config.twilioWhatsappNumber) {
    console.log(`⚠️ [WHATSAPP POLLING] Skipping consultant ${config.consultantId} - incomplete config`);
    return;
  }

  try {
    // Check circuit breaker
    const circuitOpen = await checkCircuitBreaker(config.id);
    if (circuitOpen) {
      console.log(`🔒 [CIRCUIT BREAKER] Skipping agent ${config.id} (${config.agentName}) - circuit breaker is open`);
      return;
    }

    const client = twilio(config.twilioAccountSid, config.twilioAuthToken);

    // Get watermark (persistent record of last processed message PER AGENT CONFIG)
    const watermark = await getOrCreateWatermark(config.id, config.consultantId);
    const lastProcessedTime = watermark.lastProcessedMessageDate;

    console.log(`🔖 [WATERMARK] Agent ${config.agentName} (${config.id}) - last processed: ${lastProcessedTime.toISOString()}`);

    // Fetch messages from Twilio (inbound messages to this consultant's WhatsApp number)
    const messages = await client.messages.list({
      to: `whatsapp:${config.twilioWhatsappNumber}`,
      limit: MAX_MESSAGES_PER_POLL + 10, // Fetch a bit more to detect flooding
      pageSize: MAX_MESSAGES_PER_POLL + 10,
    });

    // Filter for messages we haven't processed yet
    const newMessages = messages.filter((msg) => {
      const msgTime = new Date(msg.dateSent);
      return msgTime > lastProcessedTime && msg.direction === "inbound";
    });

    if (newMessages.length === 0) {
      console.log(`✅ [WHATSAPP POLLING] No new messages for agent ${config.agentName}`);
      
      // CRITICAL FIX: Advance watermark even when no new messages
      // This prevents re-downloading old messages if conversations are deleted
      // Use the most recent message seen on Twilio, BUT never go backwards
      let advancedWatermark = lastProcessedTime;
      let advancedSid = watermark.lastProcessedTwilioSid;
      
      if (messages.length > 0) {
        // Twilio has messages - check if latest is newer than current watermark
        const mostRecentSeen = messages[0]; // Twilio returns newest first
        const mostRecentDate = new Date(mostRecentSeen.dateSent);
        
        if (mostRecentDate > lastProcessedTime) {
          advancedWatermark = mostRecentDate;
          advancedSid = mostRecentSeen.sid;
          console.log(`📍 [WATERMARK] Advancing to latest seen on Twilio: ${advancedWatermark.toISOString()}`);
        } else {
          console.log(`📌 [WATERMARK] Latest on Twilio (${mostRecentDate.toISOString()}) is older than watermark - keeping current`);
        }
      }
      
      // Update watermark to prevent re-processing deleted messages
      await db
        .update(whatsappPollingWatermarks)
        .set({ 
          lastProcessedMessageDate: advancedWatermark,
          lastProcessedTwilioSid: advancedSid,
          lastPolledAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(whatsappPollingWatermarks.agentConfigId, config.id));
      
      return;
    }

    // Anti-flooding protection
    if (newMessages.length > MAX_MESSAGES_PER_POLL) {
      console.warn(`🚨 [ANTI-FLOOD] Found ${newMessages.length} messages for agent ${config.agentName} - limiting to ${MAX_MESSAGES_PER_POLL}`);
      console.warn(`🚨 [ANTI-FLOOD] This might indicate a polling issue or message spam. Check Twilio logs!`);
      
      // Log error to watermark
      await db
        .update(whatsappPollingWatermarks)
        .set({
          lastErrorAt: new Date(),
          lastErrorMessage: `Anti-flood triggered: ${newMessages.length} messages found (max ${MAX_MESSAGES_PER_POLL})`,
          updatedAt: new Date(),
        })
        .where(eq(whatsappPollingWatermarks.agentConfigId, config.id));
    }

    // Process only up to MAX_MESSAGES_PER_POLL
    const messagesToProcess = newMessages.slice(-MAX_MESSAGES_PER_POLL).reverse(); // Oldest first
    
    console.log(`📬 [WHATSAPP POLLING] Processing ${messagesToProcess.length} new message(s) for agent ${config.agentName}`);

    // CRITICAL FIX: Track the latest message SEEN on Twilio (not just processed)
    // This prevents re-downloading old messages if local DB is cleared
    let latestSeenDate = lastProcessedTime;
    let latestSeenSid = watermark.lastProcessedTwilioSid;
    
    // Find the most recent message in the batch (even if already processed)
    if (messagesToProcess.length > 0) {
      const mostRecentMessage = messagesToProcess[messagesToProcess.length - 1]; // Last = newest (reversed array)
      latestSeenDate = new Date(mostRecentMessage.dateSent);
      latestSeenSid = mostRecentMessage.sid;
    }
    
    let processedCount = 0;

    // Process each new message (oldest first)
    for (const message of messagesToProcess) {
      // CRITICAL: Check if we already processed this message (deduplicate by twilioSid)
      const [existingMessage] = await db
        .select()
        .from(whatsappMessages)
        .where(eq(whatsappMessages.twilioSid, message.sid))
        .limit(1);

      if (existingMessage) {
        console.log(`⏭️ Skipping already processed message ${message.sid}`);
        continue;
      }

      // Convert Twilio message to webhook format
      const webhookPayload = {
        MessageSid: message.sid,
        From: message.from,
        To: message.to,
        Body: message.body,
        NumMedia: message.numMedia,
        AccountSid: config.twilioAccountSid,
      };

      console.log(`📥 Processing message ${message.sid}: ${message.from} -> ${message.body?.substring(0, 50)}...`);

      try {
        await handleWebhook(webhookPayload);
        processedCount++;
        
      } catch (error) {
        console.error(`❌ Error processing message ${message.sid}:`, error);
        
        // Log error but continue processing other messages
        await db
          .update(whatsappPollingWatermarks)
          .set({
            lastErrorAt: new Date(),
            lastErrorMessage: `Error processing message ${message.sid}: ${error}`,
            consecutiveErrors: sql`${whatsappPollingWatermarks.consecutiveErrors} + 1`,
            updatedAt: new Date(),
          })
          .where(eq(whatsappPollingWatermarks.agentConfigId, config.id));
      }
    }

    // Update watermark with latest SEEN message (not just processed)
    // This ensures we don't re-download old messages if local DB is cleared
    await db
      .update(whatsappPollingWatermarks)
      .set({
        lastProcessedMessageDate: latestSeenDate,
        lastProcessedTwilioSid: latestSeenSid,
        messagesProcessedCount: sql`${whatsappPollingWatermarks.messagesProcessedCount} + ${processedCount}`,
        lastPolledAt: new Date(),
        consecutiveErrors: 0, // Reset on success
        updatedAt: new Date(),
      })
      .where(eq(whatsappPollingWatermarks.agentConfigId, config.id));

    console.log(`✅ [WATERMARK] Updated for agent ${config.agentName} - latest seen: ${latestSeenDate.toISOString()} (processed: ${processedCount})`);

  } catch (error: any) {
    console.error(`❌ [WHATSAPP POLLING] Error for agent ${config.agentName}:`, error);
    
    // Update error tracking and potentially open circuit breaker
    try {
      const [watermark] = await db
        .select()
        .from(whatsappPollingWatermarks)
        .where(eq(whatsappPollingWatermarks.agentConfigId, config.id))
        .limit(1);

      const newConsecutiveErrors = (watermark?.consecutiveErrors || 0) + 1;
      const shouldOpenCircuit = newConsecutiveErrors >= MAX_CONSECUTIVE_ERRORS;

      await db
        .update(whatsappPollingWatermarks)
        .set({
          lastErrorAt: new Date(),
          lastErrorMessage: error.message || String(error),
          consecutiveErrors: newConsecutiveErrors,
          isCircuitBreakerOpen: shouldOpenCircuit,
          circuitBreakerOpenedAt: shouldOpenCircuit ? new Date() : watermark?.circuitBreakerOpenedAt,
          updatedAt: new Date(),
        })
        .where(eq(whatsappPollingWatermarks.agentConfigId, config.id));

      if (shouldOpenCircuit) {
        console.error(`🔒 [CIRCUIT BREAKER] OPENED for agent ${config.agentName} after ${newConsecutiveErrors} consecutive errors`);
        console.error(`🔒 [CIRCUIT BREAKER] Will retry after ${CIRCUIT_BREAKER_COOLDOWN_MS / 1000 / 60} minutes`);
      }
    } catch (dbError) {
      console.error(`❌ Failed to update error tracking:`, dbError);
    }
  }
}

/**
 * Poll all active consultants for new messages
 */
/**
 * Poll all active consultants for new messages
 * REFACTORED: Uses sequential processing to prevent DB connection saturation
 */
async function pollAllConsultants(): Promise<void> {
  try {
    console.log(`🔄 [WHATSAPP POLLING] Starting poll cycle...`);

    // Get all active WhatsApp configs with retry logic for database connection
    let configs;
    try {
      configs = await db
        .select()
        .from(consultantWhatsappConfig)
        .where(eq(consultantWhatsappConfig.isActive, true));
    } catch (dbError: any) {
      // Handle database connection errors gracefully (common with Neon/Supabase serverless)
      // Code 08006 is "connection failure", 57P01 is "admin shutdown", etc.
      if (dbError.code === '08006' || dbError.message?.includes('connection') || dbError.code === 'ECONNREFUSED') {
        console.log(`⏸️ [WHATSAPP POLLING] Database connection unavailable - skipping this cycle`);
        return;
      }
      console.error(`❌ [WHATSAPP POLLING] Critical DB error fetching configs:`, dbError);
      return; 
    }

    if (!configs || configs.length === 0) {
      // console.log(`⚠️ [WHATSAPP POLLING] No active WhatsApp configs found`);
      return; // Silent return to avoid log spam if no users
    }

    console.log(`📊 [WHATSAPP POLLING] Polling ${configs.length} consultant(s) sequentially...`);

    // FIX: Use sequential loop instead of Promise.all to prevent "Too many connections" errors
    // and to ensure one failing agent doesn't crash the entire scheduler.
    for (const config of configs) {
      try {
        // Poll specific consultant
        await pollMessagesForConsultant(config);

        // OPTIONAL: Add a small delay (e.g., 500ms) between agents to let the DB "breathe"
        // This is crucial if you are on a Free Tier database
        await new Promise(resolve => setTimeout(resolve, 500));

      } catch (agentError) {
        // Catch error for THIS specific agent so the loop continues for others
        console.error(`❌ [WHATSAPP POLLING] Failed to poll agent ${config.agentName} (${config.id}):`, agentError);
        // We do not re-throw here, ensuring other agents still get polled
      }
    }

    console.log(`✅ [WHATSAPP POLLING] Poll cycle complete`);
  } catch (error) {
    // This catches unforeseen errors in the main loop logic itself
    console.error(`❌ [WHATSAPP POLLING] Fatal error in poll cycle:`, error);
  }
}


/**
 * Start the WhatsApp polling service
 * Polls every 90 seconds for new messages (configurable via WHATSAPP_POLL_INTERVAL_SECONDS)
 * Reduced from 30s to 90s to minimize database load with Supabase free tier
 */
export function startWhatsAppPolling(): void {
  const registry = getRegistry();

  // Stop existing task if any
  if (registry.task) {
    console.log(`🔄 [WHATSAPP POLLING] Stopping previous polling task (ID: ${registry.registrationId})`);
    registry.task.stop();
    registry.task = null;
  }

  // Get polling interval from env or default to 90 seconds (optimized for Supabase free tier)
  const intervalSeconds = parseInt(process.env.WHATSAPP_POLL_INTERVAL_SECONDS || "30", 10);
  const cronSchedule = `*/${intervalSeconds} * * * * *`; // Every N seconds

  const registrationId = `whatsapp-polling-${Date.now()}`;

  console.log(`✅ [WHATSAPP POLLING] Starting polling service (ID: ${registrationId})`);
  console.log(`📅 [WHATSAPP POLLING] Schedule: every ${intervalSeconds} seconds`);

  // Create and start the cron task
  const task = cron.schedule(cronSchedule, pollAllConsultants);

  registry.task = task;
  registry.registrationId = registrationId;

  // Run immediately on startup
  pollAllConsultants();
}

/**
 * Stop the WhatsApp polling service
 */
export function stopWhatsAppPolling(): void {
  const registry = getRegistry();

  if (registry.task) {
    console.log(`🛑 [WHATSAPP POLLING] Stopping polling service (ID: ${registry.registrationId})`);
    registry.task.stop();
    registry.task = null;
    registry.registrationId = null;
  }
}

// Cleanup on process exit
process.on("SIGTERM", stopWhatsAppPolling);
process.on("SIGINT", stopWhatsAppPolling);
