/**
 * Twitter/X Integration Module
 * Parallel structure to Instagram integration
 * 
 * Key features:
 * - DM automation via Account Activity API (webhooks)
 * - Send DMs via API v2
 * - OAuth 1.0a and OAuth 2.0 support
 * - Keyword-triggered DM responses
 */

// Types
export * from "./types";

// Core modules (lazy imports to avoid circular dependencies)
export { TwitterClient, createTwitterClient } from "./twitter-client";
export { handleTwitterWebhook, verifyTwitterWebhook } from "./webhook-handler";

// Message processor exports (imported separately to avoid circular deps)
export async function getMessageProcessor() {
  const { processTwitterMessage, scheduleTwitterMessageProcessing } = await import("./message-processor");
  return { processTwitterMessage, scheduleTwitterMessageProcessing };
}

// Constants
export const TWITTER_API_V2_BASE = "https://api.x.com/2";
export const TWITTER_API_V1_BASE = "https://api.x.com/1.1";

// Account Activity API environment (sandbox/premium/enterprise)
export const ACCOUNT_ACTIVITY_ENV = process.env.TWITTER_WEBHOOK_ENV || "production";

// Rate limits (approximate, depends on tier)
export const DM_SEND_RATE_LIMIT = 1000; // DMs per 24 hours
export const DM_READ_RATE_LIMIT = 15; // requests per 15 minutes
