/**
 * Instagram 24-Hour Window Tracker
 * 
 * Instagram API only allows sending messages within 24 hours of the user's last message.
 * This module tracks window status and provides utilities for managing the messaging window.
 * 
 * Key rules:
 * - Window opens when user sends a message
 * - Window expires 24 hours after user's last message
 * - HUMAN_AGENT tag extends window to 7 days (for human takeover)
 * - Cannot send proactive messages outside window (unlike WhatsApp templates)
 */

import { db } from "../db";
import { instagramConversations, instagramDailyStats } from "../../shared/schema";
import { eq, and, lt, sql } from "drizzle-orm";
import { MESSAGING_WINDOW_MS, HUMAN_AGENT_WINDOW_MS } from "./index";
import { WindowStatus } from "./types";

export class WindowTracker {
  /**
   * Check if messaging window is open for a conversation
   */
  static async getWindowStatus(conversationId: string): Promise<WindowStatus> {
    const [conversation] = await db
      .select()
      .from(instagramConversations)
      .where(eq(instagramConversations.id, conversationId))
      .limit(1);

    if (!conversation) {
      return {
        isOpen: false,
        expiresAt: null,
        canSendMessage: false,
        canUseHumanAgentTag: false,
        humanAgentExpiresAt: null,
      };
    }

    const now = new Date();
    const windowExpiresAt = conversation.windowExpiresAt;
    const humanAgentExpiresAt = conversation.windowExtendedUntil;

    // Check if standard window is open
    const isStandardWindowOpen = windowExpiresAt ? now < windowExpiresAt : false;

    // Check if HUMAN_AGENT window is open
    const isHumanAgentWindowOpen = humanAgentExpiresAt ? now < humanAgentExpiresAt : false;

    // Can send if either window is open
    const canSendMessage = isStandardWindowOpen || isHumanAgentWindowOpen;

    // Can use HUMAN_AGENT tag if standard window is open (extends to 7 days)
    const canUseHumanAgentTag = isStandardWindowOpen;

    return {
      isOpen: isStandardWindowOpen,
      expiresAt: windowExpiresAt,
      canSendMessage,
      canUseHumanAgentTag,
      humanAgentExpiresAt,
    };
  }

  /**
   * Update window status when user sends a message
   * Called by webhook handler when receiving an inbound message
   */
  static async openWindow(conversationId: string): Promise<void> {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + MESSAGING_WINDOW_MS);

    await db
      .update(instagramConversations)
      .set({
        lastUserMessageAt: now,
        windowExpiresAt: expiresAt,
        isWindowOpen: true,
        updatedAt: now,
      })
      .where(eq(instagramConversations.id, conversationId));

    console.log(`🪟 [INSTAGRAM] Window opened for conversation ${conversationId}, expires at ${expiresAt.toISOString()}`);
  }

  /**
   * Extend window using HUMAN_AGENT tag (7 days)
   * Called when human takeover is needed
   */
  static async extendWindowWithHumanAgent(conversationId: string): Promise<void> {
    const now = new Date();
    const extendedUntil = new Date(now.getTime() + HUMAN_AGENT_WINDOW_MS);

    await db
      .update(instagramConversations)
      .set({
        windowExtendedUntil: extendedUntil,
        updatedAt: now,
      })
      .where(eq(instagramConversations.id, conversationId));

    console.log(`🪟 [INSTAGRAM] Window extended with HUMAN_AGENT for conversation ${conversationId}, expires at ${extendedUntil.toISOString()}`);
  }

  /**
   * Close expired windows (called by cron job)
   */
  static async closeExpiredWindows(): Promise<number> {
    const now = new Date();

    // Find conversations with expired windows
    const expiredConversations = await db
      .select({ id: instagramConversations.id, consultantId: instagramConversations.consultantId })
      .from(instagramConversations)
      .where(
        and(
          eq(instagramConversations.isWindowOpen, true),
          lt(instagramConversations.windowExpiresAt, now),
          // Only close if HUMAN_AGENT window is also expired or not set
          sql`(${instagramConversations.windowExtendedUntil} IS NULL OR ${instagramConversations.windowExtendedUntil} < NOW())`
        )
      );

    if (expiredConversations.length === 0) {
      return 0;
    }

    // Update all expired conversations
    const conversationIds = expiredConversations.map((c) => c.id);
    await db
      .update(instagramConversations)
      .set({
        isWindowOpen: false,
        updatedAt: now,
      })
      .where(sql`${instagramConversations.id} = ANY(ARRAY[${conversationIds.join(",")}]::text[])`);

    // Update daily stats for window expirations
    const consultantCounts = new Map<string, number>();
    for (const conv of expiredConversations) {
      consultantCounts.set(
        conv.consultantId,
        (consultantCounts.get(conv.consultantId) || 0) + 1
      );
    }

    const today = new Date().toISOString().split("T")[0];
    for (const [consultantId, count] of consultantCounts) {
      await db
        .insert(instagramDailyStats)
        .values({
          consultantId,
          date: today,
          windowsExpired: count,
        })
        .onConflictDoUpdate({
          target: [instagramDailyStats.consultantId, instagramDailyStats.date],
          set: {
            windowsExpired: sql`${instagramDailyStats.windowsExpired} + ${count}`,
          },
        });
    }

    console.log(`🪟 [INSTAGRAM] Closed ${expiredConversations.length} expired windows`);
    return expiredConversations.length;
  }
}

/**
 * Check window status for a conversation
 */
export async function checkWindowStatus(conversationId: string): Promise<WindowStatus> {
  return WindowTracker.getWindowStatus(conversationId);
}

/**
 * Update window when user sends a message
 */
export async function updateWindowStatus(conversationId: string): Promise<void> {
  return WindowTracker.openWindow(conversationId);
}
