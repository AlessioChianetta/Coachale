// Cleanup script for ghost WhatsApp conversations
// Deletes conversations with message_count = 0 that are older than 2 minutes
// This fixes the bug where duplicate webhooks create empty conversations

import { db } from "../db";
import { whatsappConversations } from "../../shared/schema";
import { eq, and, sql } from "drizzle-orm";

/**
 * Delete ghost conversations (empty conversations created by duplicate webhooks)
 * Uses actual message count from DB, not the cached message_count field
 */
export async function cleanupGhostConversations(): Promise<number> {
  try {
    const { whatsappMessages } = await import("../../shared/schema");
    const { sql: sqlFunc } = await import("drizzle-orm");
    
    // Find conversations older than 2 minutes with NO actual messages in DB
    // We check the actual message count, not the cached message_count field
    const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);

    // First, find conversations that might be ghosts
    const ghostCandidates = await db
      .select({
        id: whatsappConversations.id,
        phoneNumber: whatsappConversations.phoneNumber,
        createdAt: whatsappConversations.createdAt,
      })
      .from(whatsappConversations)
      .where(
        sql`${whatsappConversations.createdAt} < ${twoMinutesAgo}`
      );

    // Check each candidate for actual messages
    const ghostIds: string[] = [];
    const ghostPhones: string[] = [];

    for (const candidate of ghostCandidates) {
      const [messageCount] = await db
        .select({ count: sqlFunc<number>`COUNT(*)::int` })
        .from(whatsappMessages)
        .where(eq(whatsappMessages.conversationId, candidate.id));

      if (messageCount.count === 0) {
        ghostIds.push(candidate.id);
        ghostPhones.push(candidate.phoneNumber);
      }
    }

    // Delete only conversations with truly zero messages
    if (ghostIds.length > 0) {
      // Use IN clause instead of ANY to avoid array literal issues
      await db
        .delete(whatsappConversations)
        .where(sql`${whatsappConversations.id} IN (${sql.raw(ghostIds.map(id => `'${id}'`).join(','))})`);

      console.log(`🧹 [CLEANUP] Deleted ${ghostIds.length} ghost conversation(s):`);
      ghostPhones.forEach((phone, i) => {
        console.log(`   - ${phone} (ID: ${ghostIds[i]})`);
      });

      return ghostIds.length;
    }

    return 0;
  } catch (error) {
    console.error("❌ [CLEANUP] Error cleaning up ghost conversations:", error);
    return 0;
  }
}

/**
 * Start periodic cleanup (runs every 5 minutes)
 */
export function startGhostConversationCleanup(): NodeJS.Timeout {
  console.log("🧹 [CLEANUP] Starting ghost conversation cleanup (every 5 minutes)");
  
  // Delay first run by 30 seconds to allow database connection to stabilize
  setTimeout(() => {
    cleanupGhostConversations();
  }, 30 * 1000);
  
  // Then run every 5 minutes
  return setInterval(() => {
    cleanupGhostConversations();
  }, 5 * 60 * 1000);
}
