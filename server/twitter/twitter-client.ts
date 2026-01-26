/**
 * Twitter/X API Client
 * Handles API v2 requests for sending DMs and managing conversations
 */

import crypto from "crypto";
import OAuth from "oauth-1.0a";
import { TWITTER_API_V2_BASE, TWITTER_API_V1_BASE } from "./index";
import {
  TwitterAPIv2Response,
  TwitterDMEventV2,
  SendDMRequest,
  SendDMResponse,
  TwitterAPIv2User,
  TwitterWebhookInfo,
} from "./types";

export interface TwitterClientConfig {
  apiKey: string;
  apiSecret: string;
  accessToken: string;
  accessTokenSecret: string;
  bearerToken?: string;
}

export class TwitterClient {
  private oauth: OAuth;
  private accessToken: string;
  private accessTokenSecret: string;
  private bearerToken?: string;
  private apiKey: string;
  private apiSecret: string;

  constructor(config: TwitterClientConfig) {
    this.apiKey = config.apiKey;
    this.apiSecret = config.apiSecret;
    this.accessToken = config.accessToken;
    this.accessTokenSecret = config.accessTokenSecret;
    this.bearerToken = config.bearerToken;

    this.oauth = new OAuth({
      consumer: {
        key: config.apiKey,
        secret: config.apiSecret,
      },
      signature_method: "HMAC-SHA256",
      hash_function(baseString, key) {
        return crypto
          .createHmac("sha256", key)
          .update(baseString)
          .digest("base64");
      },
    });
  }

  /**
   * Make OAuth 1.0a signed request
   */
  private async makeOAuthRequest<T>(
    method: "GET" | "POST" | "DELETE",
    url: string,
    body?: Record<string, unknown>
  ): Promise<T> {
    const requestData = {
      url,
      method,
    };

    const token = {
      key: this.accessToken,
      secret: this.accessTokenSecret,
    };

    const headers = this.oauth.toHeader(
      this.oauth.authorize(requestData, token)
    ) as Record<string, string>;

    const fetchOptions: RequestInit = {
      method,
      headers: {
        ...headers,
        "Content-Type": "application/json",
      },
    };

    if (body && method === "POST") {
      fetchOptions.body = JSON.stringify(body);
    }

    console.log(`🐦 [TWITTER API] ${method} ${url}`);

    const response = await fetch(url, fetchOptions);
    const data = await response.json();

    if (!response.ok) {
      console.error(`❌ [TWITTER API] Error:`, data);
      throw new Error(
        `Twitter API error: ${response.status} - ${JSON.stringify(data)}`
      );
    }

    console.log(`✅ [TWITTER API] Success:`, JSON.stringify(data).slice(0, 200));
    return data as T;
  }

  /**
   * Make Bearer token request (App-only auth)
   */
  private async makeBearerRequest<T>(
    method: "GET" | "POST" | "DELETE",
    url: string,
    body?: Record<string, unknown>
  ): Promise<T> {
    if (!this.bearerToken) {
      throw new Error("Bearer token not configured");
    }

    const fetchOptions: RequestInit = {
      method,
      headers: {
        Authorization: `Bearer ${this.bearerToken}`,
        "Content-Type": "application/json",
      },
    };

    if (body && method === "POST") {
      fetchOptions.body = JSON.stringify(body);
    }

    const response = await fetch(url, fetchOptions);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        `Twitter API error: ${response.status} - ${JSON.stringify(data)}`
      );
    }

    return data as T;
  }

  /**
   * Send a Direct Message to a user (API v2)
   */
  async sendDirectMessage(
    recipientId: string,
    message: SendDMRequest
  ): Promise<SendDMResponse> {
    const url = `${TWITTER_API_V2_BASE}/dm_conversations/with/${recipientId}/messages`;

    const response = await this.makeOAuthRequest<{ data: SendDMResponse }>(
      "POST",
      url,
      message
    );

    console.log(
      `📤 [TWITTER DM] Sent to ${recipientId}: "${message.text.slice(0, 50)}..."`
    );

    return response.data;
  }

  /**
   * Get DM events for a specific conversation
   */
  async getDMEvents(
    conversationId: string,
    maxResults: number = 50
  ): Promise<TwitterAPIv2Response<TwitterDMEventV2[]>> {
    const params = new URLSearchParams({
      "dm_event.fields": "id,text,created_at,sender_id,dm_conversation_id,attachments",
      expansions: "sender_id",
      "user.fields": "id,name,username,profile_image_url",
      max_results: maxResults.toString(),
    });

    const url = `${TWITTER_API_V2_BASE}/dm_conversations/${conversationId}/dm_events?${params}`;

    return this.makeOAuthRequest<TwitterAPIv2Response<TwitterDMEventV2[]>>(
      "GET",
      url
    );
  }

  /**
   * Get DM events with a specific user
   */
  async getDMEventsWithUser(
    participantId: string,
    maxResults: number = 50
  ): Promise<TwitterAPIv2Response<TwitterDMEventV2[]>> {
    const params = new URLSearchParams({
      "dm_event.fields": "id,text,created_at,sender_id,dm_conversation_id,attachments",
      expansions: "sender_id",
      "user.fields": "id,name,username,profile_image_url",
      max_results: maxResults.toString(),
    });

    const url = `${TWITTER_API_V2_BASE}/dm_conversations/with/${participantId}/dm_events?${params}`;

    return this.makeOAuthRequest<TwitterAPIv2Response<TwitterDMEventV2[]>>(
      "GET",
      url
    );
  }

  /**
   * Get all recent DM events
   */
  async getAllDMEvents(
    maxResults: number = 100
  ): Promise<TwitterAPIv2Response<TwitterDMEventV2[]>> {
    const params = new URLSearchParams({
      "dm_event.fields": "id,text,created_at,sender_id,dm_conversation_id,attachments",
      expansions: "sender_id",
      "user.fields": "id,name,username,profile_image_url",
      max_results: maxResults.toString(),
    });

    const url = `${TWITTER_API_V2_BASE}/dm_events?${params}`;

    return this.makeOAuthRequest<TwitterAPIv2Response<TwitterDMEventV2[]>>(
      "GET",
      url
    );
  }

  /**
   * Get user by ID
   */
  async getUserById(userId: string): Promise<TwitterAPIv2User | null> {
    const params = new URLSearchParams({
      "user.fields": "id,name,username,profile_image_url,description,verified,protected",
    });

    const url = `${TWITTER_API_V2_BASE}/users/${userId}?${params}`;

    try {
      const response = await this.makeOAuthRequest<TwitterAPIv2Response<TwitterAPIv2User>>(
        "GET",
        url
      );
      return response.data || null;
    } catch (error) {
      console.error(`Failed to get user ${userId}:`, error);
      return null;
    }
  }

  /**
   * Get user by username
   */
  async getUserByUsername(username: string): Promise<TwitterAPIv2User | null> {
    const params = new URLSearchParams({
      "user.fields": "id,name,username,profile_image_url,description,verified,protected",
    });

    const url = `${TWITTER_API_V2_BASE}/users/by/username/${username}?${params}`;

    try {
      const response = await this.makeOAuthRequest<TwitterAPIv2Response<TwitterAPIv2User>>(
        "GET",
        url
      );
      return response.data || null;
    } catch (error) {
      console.error(`Failed to get user @${username}:`, error);
      return null;
    }
  }

  /**
   * Get authenticated user info
   */
  async getMe(): Promise<TwitterAPIv2User | null> {
    const params = new URLSearchParams({
      "user.fields": "id,name,username,profile_image_url,description,verified",
    });

    const url = `${TWITTER_API_V2_BASE}/users/me?${params}`;

    try {
      const response = await this.makeOAuthRequest<TwitterAPIv2Response<TwitterAPIv2User>>(
        "GET",
        url
      );
      return response.data || null;
    } catch (error) {
      console.error("Failed to get authenticated user:", error);
      return null;
    }
  }

  // ============================================================
  // ACCOUNT ACTIVITY API (WEBHOOKS) - v1.1
  // ============================================================

  /**
   * Register a webhook URL
   */
  async registerWebhook(
    envName: string,
    webhookUrl: string
  ): Promise<TwitterWebhookInfo> {
    const params = new URLSearchParams({ url: webhookUrl });
    const url = `${TWITTER_API_V1_BASE}/account_activity/all/${envName}/webhooks.json?${params}`;

    return this.makeOAuthRequest<TwitterWebhookInfo>("POST", url);
  }

  /**
   * List registered webhooks
   */
  async listWebhooks(envName: string): Promise<TwitterWebhookInfo[]> {
    const url = `${TWITTER_API_V1_BASE}/account_activity/all/${envName}/webhooks.json`;

    return this.makeOAuthRequest<TwitterWebhookInfo[]>("GET", url);
  }

  /**
   * Delete a webhook
   */
  async deleteWebhook(envName: string, webhookId: string): Promise<void> {
    const url = `${TWITTER_API_V1_BASE}/account_activity/all/${envName}/webhooks/${webhookId}.json`;

    await this.makeOAuthRequest<void>("DELETE", url);
  }

  /**
   * Trigger CRC check for a webhook
   */
  async triggerCRCCheck(envName: string, webhookId: string): Promise<void> {
    const url = `${TWITTER_API_V1_BASE}/account_activity/all/${envName}/webhooks/${webhookId}.json`;

    await this.makeOAuthRequest<void>("PUT" as "POST", url);
  }

  /**
   * Subscribe the authenticated user to webhook events
   */
  async subscribeToWebhook(envName: string): Promise<void> {
    const url = `${TWITTER_API_V1_BASE}/account_activity/all/${envName}/subscriptions.json`;

    await this.makeOAuthRequest<void>("POST", url);
    console.log(`✅ [TWITTER] User subscribed to webhook events`);
  }

  /**
   * Unsubscribe from webhook events
   */
  async unsubscribeFromWebhook(envName: string): Promise<void> {
    const url = `${TWITTER_API_V1_BASE}/account_activity/all/${envName}/subscriptions.json`;

    await this.makeOAuthRequest<void>("DELETE", url);
  }

  /**
   * Check subscription status
   */
  async checkSubscription(envName: string): Promise<boolean> {
    const url = `${TWITTER_API_V1_BASE}/account_activity/all/${envName}/subscriptions.json`;

    try {
      await this.makeOAuthRequest<void>("GET", url);
      return true;
    } catch {
      return false;
    }
  }

  // ============================================================
  // TYPING INDICATOR & READ RECEIPTS (v1.1)
  // ============================================================

  /**
   * Show typing indicator
   */
  async showTypingIndicator(recipientId: string): Promise<void> {
    const url = `${TWITTER_API_V1_BASE}/direct_messages/indicate_typing.json`;

    await this.makeOAuthRequest("POST", url, {
      recipient_id: recipientId,
    });
  }

  /**
   * Mark DM as read
   */
  async markAsRead(lastReadEventId: string, recipientId: string): Promise<void> {
    const url = `${TWITTER_API_V1_BASE}/direct_messages/mark_read.json`;

    await this.makeOAuthRequest("POST", url, {
      last_read_event_id: lastReadEventId,
      recipient_id: recipientId,
    });
  }
}

/**
 * Create a Twitter client instance
 */
export function createTwitterClient(config: TwitterClientConfig): TwitterClient {
  return new TwitterClient(config);
}
