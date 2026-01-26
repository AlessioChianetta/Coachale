/**
 * Twitter Message Queue Worker
 * Async message processing with retry logic
 * Handles rate limiting and exponential backoff
 */

import { db } from "../../db";
import {
  twitterPendingMessages,
  TwitterPendingMessage,
} from "../../../shared/schema";
import { eq, and, sql, gte } from "drizzle-orm";
import { TwitterClient, createTwitterClient } from "../twitter-client";
import { decrypt } from "../../encryption";
import { superadminTwitterConfig } from "../../../shared/schema";

/**
 * Interface for a queued Twitter message
 */
export interface QueuedTwitterMessage {
  id: string;
  consultantId: string;
  conversationId: string;
  recipientId: string; // Maps to twitterUserId in DB
  messageText: string;
  status: "pending" | "processing" | "sent" | "failed";
  retryCount: number;
  lastError?: string;
  createdAt: Date;
}

/**
 * Metadata stored in the twitter_pending_messages.metadata field
 */
interface MessageMetadata {
  status: "pending" | "processing" | "sent" | "failed";
  retryCount: number;
  lastError?: string;
  lastRetryAt?: string;
  nextRetryAt?: string;
}

/**
 * Exponential backoff delays (in milliseconds)
 * Retry attempt 1: 2000ms
 * Retry attempt 2: 4000ms
 * Retry attempt 3: 8000ms
 * Retry attempt 4: 16000ms
 */
const BACKOFF_DELAYS_MS = [2000, 4000, 8000, 16000];
const MAX_RETRIES = 4;

/**
 * Special delay for rate limit errors (429)
 * Wait 60 seconds before retrying rate-limited messages
 */
const RATE_LIMIT_DELAY_MS = 60000;

/**
 * Twitter Message Queue
 * Handles async message processing with retry logic
 */
export class TwitterMessageQueue {
  private client: TwitterClient | null = null;
  private isProcessing = false;
  private isRetrying = false;

  /**
   * Initialize the queue (load Twitter client credentials)
   */
  async initialize(): Promise<void> {
    try {
      const [superAdminConfig] = await db
        .select()
        .from(superadminTwitterConfig)
        .where(eq(superadminTwitterConfig.enabled, true))
        .limit(1);

      if (!superAdminConfig) {
        console.error(
          "❌ [TWITTER QUEUE] No superadmin Twitter config found. Queue not initialized."
        );
        return;
      }

      this.client = createTwitterClient({
        apiKey: decrypt(superAdminConfig.apiKeyEncrypted),
        apiSecret: decrypt(superAdminConfig.apiSecretEncrypted),
        accessToken: "", // Will be provided per-message from consultant config
        accessTokenSecret: "", // Will be provided per-message from consultant config
        bearerToken: superAdminConfig.bearerToken
          ? decrypt(superAdminConfig.bearerToken)
          : undefined,
      });

      console.log("✅ [TWITTER QUEUE] Initialized successfully");
    } catch (error) {
      console.error("❌ [TWITTER QUEUE] Initialization error:", error);
    }
  }

  /**
   * Enqueue a message for sending
   * Adds message to pending messages queue with metadata
   */
  async enqueue(message: QueuedTwitterMessage): Promise<void> {
    try {
      const metadata: MessageMetadata = {
        status: "pending",
        retryCount: 0,
      };

      await db.insert(twitterPendingMessages).values({
        id: message.id,
        conversationId: message.conversationId,
        consultantId: message.consultantId,
        twitterUserId: message.recipientId,
        messageText: message.messageText,
        metadata: metadata as any,
        receivedAt: message.createdAt,
      });

      console.log(
        `📥 [TWITTER QUEUE] Enqueued message ${message.id} for ${message.recipientId}`
      );
    } catch (error) {
      console.error(`❌ [TWITTER QUEUE] Failed to enqueue message:`, error);
      throw error;
    }
  }

  /**
   * Process all pending messages in the queue
   * Marks them as processing and attempts to send
   */
  async process(): Promise<void> {
    if (this.isProcessing) {
      console.warn("⚠️ [TWITTER QUEUE] Already processing, skipping...");
      return;
    }

    this.isProcessing = true;

    try {
      console.log("🔄 [TWITTER QUEUE] Starting message processing...");

      // Get all pending messages
      const pendingMessages = await db
        .select()
        .from(twitterPendingMessages)
        .where(
          and(
            sql`(${twitterPendingMessages.metadata}->'status')::text = '"pending"'`
          )
        )
        .limit(100); // Process in batches

      console.log(
        `📊 [TWITTER QUEUE] Found ${pendingMessages.length} pending messages`
      );

      for (const dbMessage of pendingMessages) {
        await this.processMessage(dbMessage);
      }

      console.log("✅ [TWITTER QUEUE] Processing completed");
    } catch (error) {
      console.error("❌ [TWITTER QUEUE] Processing error:", error);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Process a single message
   */
  private async processMessage(
    dbMessage: TwitterPendingMessage
  ): Promise<void> {
    try {
      const metadata = (dbMessage.metadata || {}) as MessageMetadata;
      const message: QueuedTwitterMessage = {
        id: dbMessage.id,
        consultantId: dbMessage.consultantId,
        conversationId: dbMessage.conversationId,
        recipientId: dbMessage.twitterUserId,
        messageText: dbMessage.messageText,
        status: (metadata.status || "pending") as any,
        retryCount: metadata.retryCount || 0,
        lastError: metadata.lastError,
        createdAt: dbMessage.receivedAt,
      };

      console.log(
        `📤 [TWITTER QUEUE] Processing message ${message.id} (retry ${message.retryCount}/${MAX_RETRIES})`
      );

      // Update status to processing
      await this.updateMessageMetadata(message.id, {
        ...metadata,
        status: "processing",
      });

      // Get consultant credentials for this message
      const consultantConfig = await this.getConsultantTwitterConfig(
        message.consultantId
      );

      if (!consultantConfig) {
        throw new Error(
          `No Twitter config found for consultant ${message.consultantId}`
        );
      }

      // Get superadmin config for API keys
      const [superAdminConfig] = await db
        .select()
        .from(superadminTwitterConfig)
        .where(eq(superadminTwitterConfig.enabled, true))
        .limit(1);

      if (!superAdminConfig) {
        throw new Error("No superadmin Twitter config found");
      }

      // Create client with consultant's tokens
      const client = createTwitterClient({
        apiKey: decrypt(superAdminConfig.apiKeyEncrypted),
        apiSecret: decrypt(superAdminConfig.apiSecretEncrypted),
        accessToken: decrypt(consultantConfig.accessToken),
        accessTokenSecret: decrypt(consultantConfig.accessTokenSecret),
      });

      // Send the message
      await client.sendDirectMessage(message.recipientId, {
        text: message.messageText,
      });

      console.log(`✅ [TWITTER QUEUE] Message ${message.id} sent successfully`);

      // Update status to sent
      await this.updateMessageMetadata(message.id, {
        ...metadata,
        status: "sent",
      });

      // Mark as processed
      await db
        .update(twitterPendingMessages)
        .set({
          processedAt: new Date(),
        })
        .where(eq(twitterPendingMessages.id, message.id));
    } catch (error) {
      await this.handleMessageError(dbMessage, error);
    }
  }

  /**
   * Handle errors during message processing
   */
  private async handleMessageError(
    dbMessage: TwitterPendingMessage,
    error: any
  ): Promise<void> {
    const metadata = (dbMessage.metadata || {}) as MessageMetadata;
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    const isRateLimitError =
      error?.status === 429 || errorMessage.includes("429");

    console.error(
      `❌ [TWITTER QUEUE] Error processing message ${dbMessage.id}: ${errorMessage}`
    );

    const retryCount = (metadata.retryCount || 0) + 1;

    if (retryCount > MAX_RETRIES) {
      console.error(
        `🛑 [TWITTER QUEUE] Message ${dbMessage.id} exceeded max retries. Marking as failed.`
      );

      await this.updateMessageMetadata(dbMessage.id, {
        status: "failed",
        retryCount,
        lastError: errorMessage,
      });
      return;
    }

    // Calculate next retry delay
    const delayMs = isRateLimitError
      ? RATE_LIMIT_DELAY_MS
      : BACKOFF_DELAYS_MS[Math.min(retryCount - 1, BACKOFF_DELAYS_MS.length - 1)];

    const nextRetryAt = new Date(Date.now() + delayMs);

    console.log(
      `⏰ [TWITTER QUEUE] Message ${dbMessage.id} scheduled for retry ${retryCount} at ${nextRetryAt.toISOString()}`
    );

    await this.updateMessageMetadata(dbMessage.id, {
      status: "pending",
      retryCount,
      lastError: errorMessage,
      lastRetryAt: new Date().toISOString(),
      nextRetryAt: nextRetryAt.toISOString(),
    });
  }

  /**
   * Retry failed messages with exponential backoff
   * Processes messages that have failed but not exceeded max retries
   */
  async retryFailed(): Promise<void> {
    if (this.isRetrying) {
      console.warn("⚠️ [TWITTER QUEUE] Already retrying, skipping...");
      return;
    }

    this.isRetrying = true;

    try {
      console.log("🔄 [TWITTER QUEUE] Starting retry of failed messages...");

      const now = new Date();

      // Get messages ready for retry
      // Status is "pending" (from previous retry attempt) and nextRetryAt is in the past
      const readyToRetry = await db
        .select()
        .from(twitterPendingMessages)
        .where(
          and(
            sql`(${twitterPendingMessages.metadata}->'status')::text = '"pending"'`,
            sql`(${twitterPendingMessages.metadata}->>'nextRetryAt')::timestamp IS NULL OR (${twitterPendingMessages.metadata}->>'nextRetryAt')::timestamp <= ${now}`,
            sql`((${twitterPendingMessages.metadata}->'retryCount')::integer || 0) > 0`
          )
        )
        .limit(100);

      console.log(
        `📊 [TWITTER QUEUE] Found ${readyToRetry.length} messages ready to retry`
      );

      for (const dbMessage of readyToRetry) {
        await this.processMessage(dbMessage);
      }

      console.log("✅ [TWITTER QUEUE] Retry processing completed");
    } catch (error) {
      console.error("❌ [TWITTER QUEUE] Retry error:", error);
    } finally {
      this.isRetrying = false;
    }
  }

  /**
   * Update message metadata in the database
   */
  private async updateMessageMetadata(
    messageId: string,
    metadata: MessageMetadata
  ): Promise<void> {
    try {
      await db
        .update(twitterPendingMessages)
        .set({
          metadata: metadata as any,
        })
        .where(eq(twitterPendingMessages.id, messageId));
    } catch (error) {
      console.error(`❌ [TWITTER QUEUE] Failed to update metadata:`, error);
    }
  }

  /**
   * Get consultant's Twitter configuration
   */
  private async getConsultantTwitterConfig(
    consultantId: string
  ): Promise<any> {
    try {
      const { consultantTwitterConfig } = await import(
        "../../../shared/schema"
      );

      const [config] = await db
        .select()
        .from(consultantTwitterConfig)
        .where(eq(consultantTwitterConfig.consultantId, consultantId))
        .limit(1);

      return config || null;
    } catch (error) {
      console.error(
        `❌ [TWITTER QUEUE] Failed to get consultant config:`,
        error
      );
      return null;
    }
  }

  /**
   * Get queue statistics
   */
  async getStats(): Promise<{
    pending: number;
    processing: number;
    sent: number;
    failed: number;
    totalRetries: number;
  }> {
    try {
      const stats = {
        pending: 0,
        processing: 0,
        sent: 0,
        failed: 0,
        totalRetries: 0,
      };

      const messages = await db.select().from(twitterPendingMessages);

      for (const msg of messages) {
        const metadata = (msg.metadata || {}) as MessageMetadata;
        const status = metadata.status || "pending";

        if (status === "pending") stats.pending++;
        else if (status === "processing") stats.processing++;
        else if (status === "sent") stats.sent++;
        else if (status === "failed") stats.failed++;

        stats.totalRetries += metadata.retryCount || 0;
      }

      return stats;
    } catch (error) {
      console.error("❌ [TWITTER QUEUE] Failed to get stats:", error);
      return {
        pending: 0,
        processing: 0,
        sent: 0,
        failed: 0,
        totalRetries: 0,
      };
    }
  }

  /**
   * Clear processed messages (maintenance)
   * Removes messages that are older than a specified number of days
   */
  async clearProcessed(daysOld: number = 7): Promise<number> {
    try {
      const cutoffDate = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000);

      const messagesDeleted = await db
        .delete(twitterPendingMessages)
        .where(
          and(
            sql`(${twitterPendingMessages.metadata}->'status')::text IN ('"sent"', '"failed"')`,
            sql`${twitterPendingMessages.processedAt} IS NOT NULL`,
            sql`${twitterPendingMessages.processedAt} < ${cutoffDate}`
          )
        );

      console.log(
        `🧹 [TWITTER QUEUE] Cleaned up ${messagesDeleted} processed messages older than ${daysOld} days`
      );
      return messagesDeleted;
    } catch (error) {
      console.error("❌ [TWITTER QUEUE] Failed to clear processed messages:", error);
      return 0;
    }
  }
}

/**
 * Create a new Twitter Message Queue instance
 */
export function createTwitterMessageQueue(): TwitterMessageQueue {
  return new TwitterMessageQueue();
}

/**
 * Singleton instance
 */
let queueInstance: TwitterMessageQueue | null = null;

/**
 * Get or create the queue singleton
 */
export async function getTwitterMessageQueue(): Promise<TwitterMessageQueue> {
  if (!queueInstance) {
    queueInstance = new TwitterMessageQueue();
    await queueInstance.initialize();
  }
  return queueInstance;
}
