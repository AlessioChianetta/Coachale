/**
 * Meta Graph API Client for Instagram Messaging
 * Handles sending messages, retrieving user info, and managing conversations
 */

import {
  MetaSendMessageRequest,
  MetaSendMessageResponse,
  MetaUserProfile,
  MetaGraphError,
  MetaOutboundMessage,
  RateLimitStatus,
} from "./types";
import {
  MESSENGER_GRAPH_API_BASE,
  DM_RATE_LIMIT,
  DM_RATE_LIMIT_WINDOW_MS,
} from "./index";

interface MetaClientConfig {
  pageAccessToken: string;
  instagramPageId: string;
  isDryRun?: boolean;
}

// In-memory rate limiter (per page)
const rateLimiters = new Map<string, { count: number; resetAt: Date }>();

export class MetaClient {
  private pageAccessToken: string;
  private instagramPageId: string;
  private isDryRun: boolean;

  constructor(config: MetaClientConfig) {
    this.pageAccessToken = config.pageAccessToken;
    this.instagramPageId = config.instagramPageId;
    this.isDryRun = config.isDryRun ?? true;
  }

  /**
   * Send a text message to a user
   */
  async sendMessage(
    recipientId: string,
    text: string,
    options?: {
      useHumanAgentTag?: boolean;
    }
  ): Promise<MetaSendMessageResponse | null> {
    const message: MetaOutboundMessage = { text };
    return this.sendMessageInternal(recipientId, message, options);
  }

  /**
   * Send a message with quick replies (ice breakers)
   */
  async sendMessageWithQuickReplies(
    recipientId: string,
    text: string,
    quickReplies: Array<{ title: string; payload: string }>
  ): Promise<MetaSendMessageResponse | null> {
    const message: MetaOutboundMessage = {
      text,
      quick_replies: quickReplies.map((qr) => ({
        content_type: "text" as const,
        title: qr.title,
        payload: qr.payload,
      })),
    };
    return this.sendMessageInternal(recipientId, message);
  }

  /**
   * Send an image message
   */
  async sendImage(
    recipientId: string,
    imageUrl: string
  ): Promise<MetaSendMessageResponse | null> {
    const message: MetaOutboundMessage = {
      attachment: {
        type: "image",
        payload: { url: imageUrl },
      },
    };
    return this.sendMessageInternal(recipientId, message);
  }

  /**
   * Internal send message method
   */
  private async sendMessageInternal(
    recipientId: string,
    message: MetaOutboundMessage,
    options?: { useHumanAgentTag?: boolean }
  ): Promise<MetaSendMessageResponse | null> {
    // Check rate limit
    const rateLimitStatus = this.checkRateLimit();
    if (rateLimitStatus.isLimited) {
      console.log(
        `⚠️ [INSTAGRAM] Rate limit exceeded for page ${this.instagramPageId}. Reset at: ${rateLimitStatus.resetAt}`
      );
      throw new Error(
        `Rate limit exceeded. Try again after ${rateLimitStatus.resetAt.toISOString()}`
      );
    }

    // Dry run mode - simulate sending
    if (this.isDryRun) {
      console.log(`🧪 [INSTAGRAM DRY RUN] Would send to ${recipientId}:`, message);
      return {
        recipient_id: recipientId,
        message_id: `dry_run_${Date.now()}`,
      };
    }

    // Build request body - Instagram doesn't need messaging_type (unlike Messenger)
    const requestBody: Record<string, any> = {
      recipient: { id: recipientId },
      message,
    };

    // Only add HUMAN_AGENT tag if explicitly requested (for out-of-window messages)
    if (options?.useHumanAgentTag) {
      requestBody.messaging_type = "MESSAGE_TAG";
      requestBody.tag = "HUMAN_AGENT";
    }

    const endpoint = `${MESSENGER_GRAPH_API_BASE}/${this.instagramPageId}/messages`;
    
    console.log(`📤 [INSTAGRAM API] Sending message:`);
    console.log(`   Endpoint: ${endpoint}`);
    console.log(`   Recipient ID: ${recipientId}`);
    console.log(`   Body: ${JSON.stringify(requestBody, null, 2)}`);

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.pageAccessToken}`,
        },
        body: JSON.stringify(requestBody),
      });

      // Increment rate limit counter
      this.incrementRateLimit();

      if (!response.ok) {
        const errorData: MetaGraphError = await response.json();
        console.error(`❌ [INSTAGRAM] Send message failed:`, errorData);
        throw new Error(
          `Meta API Error: ${errorData.error.message} (code: ${errorData.error.code})`
        );
      }

      const result: MetaSendMessageResponse = await response.json();
      console.log(`✅ [INSTAGRAM] Message sent to ${recipientId}: ${result.message_id}`);
      return result;
    } catch (error) {
      console.error(`❌ [INSTAGRAM] Error sending message:`, error);
      throw error;
    }
  }

  /**
   * Get user profile information
   */
  async getUserProfile(userId: string): Promise<MetaUserProfile | null> {
    try {
      const response = await fetch(
        `${MESSENGER_GRAPH_API_BASE}/${userId}?fields=id,username,name,profile_pic&access_token=${this.pageAccessToken}`
      );

      if (!response.ok) {
        const errorData = await response.json();
        console.error(`❌ [INSTAGRAM] Get user profile failed:`, errorData);
        return null;
      }

      return await response.json();
    } catch (error) {
      console.error(`❌ [INSTAGRAM] Error getting user profile:`, error);
      return null;
    }
  }

  /**
   * Mark message as seen (send read receipt)
   */
  async sendReadReceipt(recipientId: string): Promise<boolean> {
    if (this.isDryRun) {
      console.log(`🧪 [INSTAGRAM DRY RUN] Would send read receipt to ${recipientId}`);
      return true;
    }

    try {
      const response = await fetch(
        `${MESSENGER_GRAPH_API_BASE}/${this.instagramPageId}/messages`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.pageAccessToken}`,
          },
          body: JSON.stringify({
            recipient: { id: recipientId },
            sender_action: "mark_seen",
          }),
        }
      );

      return response.ok;
    } catch (error) {
      console.error(`❌ [INSTAGRAM] Error sending read receipt:`, error);
      return false;
    }
  }

  /**
   * Check current rate limit status
   */
  private checkRateLimit(): RateLimitStatus {
    const key = this.instagramPageId;
    const now = new Date();
    const limiter = rateLimiters.get(key);

    if (!limiter || now > limiter.resetAt) {
      // Reset limiter
      rateLimiters.set(key, {
        count: 0,
        resetAt: new Date(now.getTime() + DM_RATE_LIMIT_WINDOW_MS),
      });
      return {
        remaining: DM_RATE_LIMIT,
        resetAt: new Date(now.getTime() + DM_RATE_LIMIT_WINDOW_MS),
        isLimited: false,
      };
    }

    return {
      remaining: DM_RATE_LIMIT - limiter.count,
      resetAt: limiter.resetAt,
      isLimited: limiter.count >= DM_RATE_LIMIT,
    };
  }

  /**
   * Increment rate limit counter
   */
  private incrementRateLimit(): void {
    const key = this.instagramPageId;
    const limiter = rateLimiters.get(key);
    if (limiter) {
      limiter.count++;
    }
  }

  /**
   * Get current rate limit status (public)
   */
  getRateLimitStatus(): RateLimitStatus {
    return this.checkRateLimit();
  }
}

/**
 * Create a MetaClient instance from agent config
 */
export function createMetaClient(config: {
  pageAccessToken: string;
  instagramPageId: string;
  isDryRun?: boolean;
}): MetaClient {
  return new MetaClient(config);
}
