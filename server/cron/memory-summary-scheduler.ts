import cron from 'node-cron';
import { db } from '../db';
import { users, clientLevelSubscriptions, bronzeUserAgentAccess } from '../../shared/schema';
import { eq, and } from 'drizzle-orm';
import { formatInTimeZone } from 'date-fns-tz';

let schedulerTask: cron.ScheduledTask | null = null;

const ITALIAN_TIMEZONE = 'Europe/Rome';

export function initMemorySummaryScheduler() {
  if (schedulerTask) {
    console.log('📅 [MemorySummaryScheduler] Already initialized, skipping');
    return;
  }

  console.log('📅 [MemorySummaryScheduler] Initializing hourly memory generation');
  console.log('   Schedule: Every hour at :00 (Europe/Rome)');
  
  schedulerTask = cron.schedule('0 * * * *', async () => {
    const now = new Date();
    // Use formatInTimeZone to get the correct hour in Italian timezone
    const currentHour = parseInt(formatInTimeZone(now, ITALIAN_TIMEZONE, 'H'));
    console.log(`⏰ [MemorySummaryScheduler] Running for hour ${currentHour} (Italian time: ${formatInTimeZone(now, ITALIAN_TIMEZONE, 'HH:mm')})`);
    await runMemoryGenerationForHour(currentHour);
  }, {
    timezone: ITALIAN_TIMEZONE
  });

  console.log('✅ [MemorySummaryScheduler] Scheduled to run every hour at :00');
}

async function runMemoryGenerationForHour(targetHour: number) {
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`🧠 [MemorySummaryScheduler] Starting memory generation for hour ${targetHour}`);
  console.log(`   Time: ${new Date().toISOString()}`);
  console.log(`${'═'.repeat(60)}`);

  const startTime = Date.now();
  let totalGenerated = 0;
  let totalUsers = 0;
  let errors: string[] = [];
  let consultantsProcessed = 0;

  try {
    const { getSuperAdminGeminiKeys } = await import('../ai/provider-factory');
    const { ConversationMemoryService, conversationMemoryService } = await import('../services/conversation-memory/memory-service');
    
    const superAdminKeys = await getSuperAdminGeminiKeys();
    if (!superAdminKeys || !superAdminKeys.enabled || superAdminKeys.keys.length === 0) {
      console.log('⚠️ [MemorySummaryScheduler] No SuperAdmin Gemini keys available, skipping');
      return;
    }

    const apiKey = superAdminKeys.keys[0];

    const consultants = await db
      .select({ id: users.id, firstName: users.firstName, memoryGenerationHour: users.memoryGenerationHour })
      .from(users)
      .where(eq(users.role, 'consultant'));

    const matchingConsultants = consultants.filter(c => (c.memoryGenerationHour ?? 3) === targetHour);

    if (matchingConsultants.length === 0) {
      console.log(`   📊 No consultants scheduled for hour ${targetHour}`);
      return;
    }

    console.log(`   📊 Found ${matchingConsultants.length} consultants scheduled for hour ${targetHour}`);

    const memoryService = new ConversationMemoryService();

    for (const consultant of matchingConsultants) {
      console.log(`   👤 Processing consultant: ${consultant.firstName || consultant.id}`);
      consultantsProcessed++;

      // OPTIMIZATION: Pre-audit to get only users with missing days
      const auditData = await conversationMemoryService.getMemoryAudit(consultant.id);
      const usersWithMissingDays = auditData.filter(u => u.missingDays > 0);
      
      if (usersWithMissingDays.length === 0) {
        console.log(`      ⏭️ All client users complete`);
      } else {
        console.log(`      📊 ${usersWithMissingDays.length}/${auditData.length} client users need summaries`);
      }

      // Process client users with missing summaries
      for (const userData of usersWithMissingDays) {
        try {
          totalUsers++;

          const result = await memoryService.generateMissingDailySummariesWithProgress(
            userData.userId,
            apiKey,
            () => {}
          );

          if (result.generated > 0) {
            totalGenerated += result.generated;
            console.log(`      ✅ ${userData.firstName || userData.userId}: ${result.generated} summaries generated`);
          }
        } catch (error: any) {
          const errorMsg = `User ${userData.userId}: ${error.message}`;
          errors.push(errorMsg);
          console.error(`      ❌ ${errorMsg}`);
        }
      }

      // GOLD MANAGERS: Process Gold tier subscription users for this consultant
      try {
        const goldSubscriptions = await db
          .select({
            id: clientLevelSubscriptions.id,
            email: clientLevelSubscriptions.clientEmail,
            firstName: clientLevelSubscriptions.clientName,
          })
          .from(clientLevelSubscriptions)
          .where(and(
            eq(clientLevelSubscriptions.consultantId, consultant.id),
            eq(clientLevelSubscriptions.level, "3"), // Gold only
            eq(clientLevelSubscriptions.status, "active")
          ));

        // Get agent access status for Gold subscriptions
        const goldAccessRecords = await db
          .select({
            bronzeUserId: bronzeUserAgentAccess.bronzeUserId,
            isEnabled: bronzeUserAgentAccess.isEnabled,
          })
          .from(bronzeUserAgentAccess)
          .where(eq(bronzeUserAgentAccess.userType, "gold"));
        
        const accessMap = new Map(goldAccessRecords.map(r => [r.bronzeUserId, r.isEnabled]));

        // Filter to only Gold managers with agent access enabled (default true if no record)
        const activeGoldSubscriptions = goldSubscriptions.filter(sub => accessMap.get(sub.id) ?? true);
        const disabledCount = goldSubscriptions.length - activeGoldSubscriptions.length;

        if (activeGoldSubscriptions.length > 0) {
          console.log(`      🥇 Processing ${activeGoldSubscriptions.length} Gold managers (${disabledCount} disabled, skipped)`);
          
          for (const goldSub of activeGoldSubscriptions) {
            try {
              const result = await memoryService.generateManagerMissingDailySummariesWithProgress(
                goldSub.id,
                consultant.id,
                apiKey,
                () => {}
              );

              if (result.generated > 0) {
                totalGenerated += result.generated;
                console.log(`         ✅ Gold ${goldSub.firstName || goldSub.email}: ${result.generated} summaries generated`);
              }
            } catch (goldError: any) {
              const errorMsg = `Gold ${goldSub.id}: ${goldError.message}`;
              errors.push(errorMsg);
              console.error(`         ❌ ${errorMsg}`);
            }
          }
        } else if (disabledCount > 0) {
          console.log(`      🥇 No active Gold managers (${disabledCount} disabled, skipped)`);
        }
      } catch (goldQueryError: any) {
        console.error(`      ⚠️ Failed to query Gold managers: ${goldQueryError.message}`);
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
    console.log(`🧠 [MemorySummaryScheduler] Hourly generation complete for hour ${targetHour}`);
    console.log(`   Consultants processed: ${consultantsProcessed}`);
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
  console.log('🔧 [MemorySummaryScheduler] Manual trigger requested - running for all hours');
  for (let hour = 0; hour < 24; hour++) {
    await runMemoryGenerationForHour(hour);
  }
}
