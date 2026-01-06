import cron from 'node-cron';
import { db } from '../db';
import { users, aiConversations, aiDailySummaries } from '../../shared/schema';
import { eq, and, isNull, or, desc, gte, lt, sql } from 'drizzle-orm';
import { startOfDay, subDays, format } from 'date-fns';
import { it } from 'date-fns/locale';

let schedulerTask: cron.ScheduledTask | null = null;

export function initMemorySummaryScheduler() {
  if (schedulerTask) {
    console.log('📅 [MemorySummaryScheduler] Already initialized, skipping');
    return;
  }

  console.log('📅 [MemorySummaryScheduler] Initializing nightly summary generation');
  console.log('   Schedule: 03:00 Italian time (Europe/Rome)');
  
  schedulerTask = cron.schedule('0 3 * * *', async () => {
    await runNightlyMemoryGeneration();
  }, {
    timezone: 'Europe/Rome'
  });

  console.log('✅ [MemorySummaryScheduler] Scheduled for 03:00 nightly');
}

async function runNightlyMemoryGeneration() {
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`🧠 [MemorySummaryScheduler] Starting nightly memory generation`);
  console.log(`   Time: ${new Date().toISOString()}`);
  console.log(`${'═'.repeat(60)}`);

  const startTime = Date.now();
  let totalGenerated = 0;
  let totalUsers = 0;
  let errors: string[] = [];

  try {
    const { getSuperAdminGeminiKeys } = await import('../ai/provider-factory');
    const { ConversationMemoryService, conversationMemoryService } = await import('../services/conversation-memory/memory-service');
    
    const superAdminKeys = await getSuperAdminGeminiKeys();
    if (!superAdminKeys || !superAdminKeys.enabled || superAdminKeys.keys.length === 0) {
      console.log('⚠️ [MemorySummaryScheduler] No SuperAdmin Gemini keys available, skipping');
      return;
    }

    const apiKey = superAdminKeys.keys[0];

    const allUsers = await db
      .select({ id: users.id, role: users.role, firstName: users.firstName })
      .from(users)
      .where(or(
        eq(users.role, 'consultant'),
        eq(users.role, 'client'),
        eq(users.role, 'bronze'),
        eq(users.role, 'silver'),
        eq(users.role, 'gold')
      ));

    console.log(`   📊 Found ${allUsers.length} users to check`);

    const memoryService = new ConversationMemoryService();

    for (const user of allUsers) {
      try {
        const cutoffDate = subDays(new Date(), 30);
        
        const daysWithConversations = await db
          .selectDistinct({
            day: sql<Date>`DATE(${aiConversations.createdAt})`.as("day"),
          })
          .from(aiConversations)
          .where(and(
            eq(aiConversations.clientId, user.id),
            gte(aiConversations.createdAt, cutoffDate)
          ));

        if (daysWithConversations.length === 0) continue;

        totalUsers++;

        const result = await memoryService.generateMissingDailySummariesWithProgress(
          user.id,
          apiKey,
          () => {}
        );

        if (result.generated > 0) {
          totalGenerated += result.generated;
          console.log(`   ✅ ${user.firstName || user.id}: ${result.generated} summaries generated`);
        }
      } catch (error: any) {
        const errorMsg = `User ${user.id}: ${error.message}`;
        errors.push(errorMsg);
        console.error(`   ❌ ${errorMsg}`);
      }
    }

    const durationMs = Date.now() - startTime;

    await conversationMemoryService.logGeneration({
      userId: 'system',
      targetUserId: null,
      generationType: 'automatic',
      summariesGenerated: totalGenerated,
      conversationsAnalyzed: totalUsers,
      durationMs,
      errors,
    });

    console.log(`\n${'═'.repeat(60)}`);
    console.log(`🧠 [MemorySummaryScheduler] Nightly generation complete`);
    console.log(`   Generated: ${totalGenerated} summaries`);
    console.log(`   Users processed: ${totalUsers}`);
    console.log(`   Duration: ${(durationMs / 1000).toFixed(1)}s`);
    if (errors.length > 0) {
      console.log(`   Errors: ${errors.length}`);
    }
    console.log(`${'═'.repeat(60)}\n`);

  } catch (error: any) {
    console.error('[MemorySummaryScheduler] Fatal error:', error.message);
  }
}

export function stopMemorySummaryScheduler() {
  if (schedulerTask) {
    schedulerTask.stop();
    schedulerTask = null;
    console.log('⏹️ [MemorySummaryScheduler] Stopped');
  }
}

export async function triggerManualMemoryGeneration() {
  console.log('🔧 [MemorySummaryScheduler] Manual trigger requested');
  await runNightlyMemoryGeneration();
}
