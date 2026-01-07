import cron from 'node-cron';
import { db } from '../db';
import { users, bronzeUserAgentAccess, whatsappAgentConsultantConversations, whatsappAgentConsultantMessages, managerDailySummaries } from '../../shared/schema';
import { eq, and, like, gte, lt, sql, inArray } from 'drizzle-orm';
import { formatInTimeZone } from 'date-fns-tz';
import { startOfDay, format } from 'date-fns';

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

      // GOLD MANAGERS: Process Gold tier users from users table (not clientLevelSubscriptions)
      // Gold users are identified by: role="client", consultantId=consultant.id, isActive=true
      // Their conversations use pattern manager_{users.id}_%
      try {
        const goldUsers = await db
          .select({
            id: users.id,
            email: users.email,
            firstName: users.firstName,
          })
          .from(users)
          .where(and(
            eq(users.consultantId, consultant.id),
            eq(users.role, "client"),
            eq(users.isActive, true)
          ));

        // Get agent access status for Gold users (using users.id)
        const goldAccessRecords = await db
          .select({
            bronzeUserId: bronzeUserAgentAccess.bronzeUserId,
            isEnabled: bronzeUserAgentAccess.isEnabled,
          })
          .from(bronzeUserAgentAccess)
          .where(eq(bronzeUserAgentAccess.userType, "gold"));
        
        const accessMap = new Map(goldAccessRecords.map(r => [r.bronzeUserId, r.isEnabled]));

        // Filter to only Gold users with agent access enabled (default true if no record)
        const activeGoldUsers = goldUsers.filter(user => accessMap.get(user.id) ?? true);
        const disabledCount = goldUsers.length - activeGoldUsers.length;

        if (activeGoldUsers.length > 0) {
          console.log(`      🥇 Processing ${activeGoldUsers.length} Gold users (${disabledCount} disabled, skipped)`);
          
          for (const goldUser of activeGoldUsers) {
            try {
              // Use users.id as subscriptionId - matches pattern manager_{userId}_%
              const subscriptionId = goldUser.id;
              const visitorPattern = `manager_${subscriptionId}_%`;
              
              // Find all conversations for this Gold user
              const goldConversations = await db
                .select({ id: whatsappAgentConsultantConversations.id })
                .from(whatsappAgentConsultantConversations)
                .where(like(whatsappAgentConsultantConversations.externalVisitorId, visitorPattern));

              if (goldConversations.length === 0) {
                continue;
              }

              const convIds = goldConversations.map(c => c.id);

              // Find all days with messages
              const daysWithMessages = await db
                .selectDistinct({
                  day: sql<Date>`DATE(${whatsappAgentConsultantMessages.createdAt})`.as("day"),
                })
                .from(whatsappAgentConsultantMessages)
                .where(inArray(whatsappAgentConsultantMessages.conversationId, convIds));

              if (daysWithMessages.length === 0) {
                continue;
              }

              // Get existing per-agent summaries to avoid regenerating
              const existingSummaries = await db
                .select({ 
                  summaryDate: managerDailySummaries.summaryDate,
                  agentProfileId: managerDailySummaries.agentProfileId
                })
                .from(managerDailySummaries)
                .where(eq(managerDailySummaries.subscriptionId, subscriptionId));

              // Create a set of "date|agentId" keys for quick lookup
              const existingKeys = new Set(
                existingSummaries.map(s => `${format(s.summaryDate, "yyyy-MM-dd")}|${s.agentProfileId || ''}`)
              );

              // Find days that need per-agent summaries
              const daysNeedingSummary: Date[] = [];
              
              for (const dayRow of daysWithMessages) {
                const day = new Date(dayRow.day);
                const dayStart = startOfDay(day);
                const dayEnd = new Date(dayStart);
                dayEnd.setDate(dayEnd.getDate() + 1);

                // Check message count for this day
                const msgCount = await db
                  .select({ count: sql<number>`count(*)::int` })
                  .from(whatsappAgentConsultantMessages)
                  .where(and(
                    inArray(whatsappAgentConsultantMessages.conversationId, convIds),
                    gte(whatsappAgentConsultantMessages.createdAt, dayStart),
                    lt(whatsappAgentConsultantMessages.createdAt, dayEnd)
                  ));

                if ((msgCount[0]?.count || 0) >= 2) {
                  daysNeedingSummary.push(day);
                }
              }

              let userAgentSummaries = 0;
              const agentsProcessed = new Set<string>();

              // Generate per-agent summaries for each day
              for (const day of daysNeedingSummary) {
                const dateStr = format(day, "yyyy-MM-dd");
                
                const agentResults = await memoryService.generateAllAgentSummariesForManager(
                  subscriptionId,
                  consultant.id,
                  day,
                  apiKey
                );

                for (const result of agentResults) {
                  const key = `${dateStr}|${result.agentProfileId}`;
                  
                  // Only count if this was a new summary (not already existing)
                  if (!existingKeys.has(key) && result.summary !== null) {
                    userAgentSummaries++;
                    agentsProcessed.add(result.agentProfileId);
                  }
                }
              }

              if (userAgentSummaries > 0) {
                totalGenerated += userAgentSummaries;
                const agentList = Array.from(agentsProcessed).map(id => id.slice(0, 8)).join(', ');
                console.log(`         ✅ Gold ${goldUser.firstName || goldUser.email}: ${userAgentSummaries} agent summaries generated`);
                console.log(`            Agents: ${agentList}... (${agentsProcessed.size} agents)`);
              }
            } catch (goldError: any) {
              const errorMsg = `Gold ${goldUser.id}: ${goldError.message}`;
              errors.push(errorMsg);
              console.error(`         ❌ ${errorMsg}`);
            }
          }
        } else if (disabledCount > 0) {
          console.log(`      🥇 No active Gold users (${disabledCount} disabled, skipped)`);
        }
      } catch (goldQueryError: any) {
        console.error(`      ⚠️ Failed to query Gold users: ${goldQueryError.message}`);
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
