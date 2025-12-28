/**
 * Instagram Integration Module
 * Parallel structure to WhatsApp integration
 * 
 * Key differences from WhatsApp:
 * - 24-hour messaging window restriction
 * - 200 DM/hour rate limit
 * - No template messages for cold outreach
 * - Comment-to-DM automation
 * - Story reply automation
 */

// Types
export * from "./types";

// Core modules
export { MetaClient, createMetaClient } from "./meta-client";
export { handleInstagramWebhook, verifyInstagramWebhook } from "./webhook-handler";
export { processInstagramMessage, scheduleInstagramMessageProcessing } from "./message-processor";
export { WindowTracker, checkWindowStatus, updateWindowStatus } from "./window-tracker";

// Constants
export const INSTAGRAM_API_VERSION = "v21.0";
export const INSTAGRAM_GRAPH_API_BASE = `https://graph.instagram.com/${INSTAGRAM_API_VERSION}`;
export const MESSENGER_GRAPH_API_BASE = `https://graph.facebook.com/${INSTAGRAM_API_VERSION}`;

// 24-hour window in milliseconds
export const MESSAGING_WINDOW_MS = 24 * 60 * 60 * 1000;

// Human Agent tag extends window by 7 days
export const HUMAN_AGENT_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

// Rate limit: 200 DMs per hour
export const DM_RATE_LIMIT = 200;
export const DM_RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
