/**
 * Dynamic Context Scheduler
 * 
 * Automatically syncs dynamic context documents to File Search for all consultants.
 * Runs every hour to keep AI assistant context up-to-date with:
 * - WhatsApp conversation history
 * - Proactive Lead Hub metrics
 * - AI limitations document
 */

import cron from 'node-cron';
import { db } from '../db';
import { users, fileSearchStores, fileSearchSettings } from '../../shared/schema';
import { eq, and } from 'drizzle-orm';
import { formatInTimeZone } from 'date-fns-tz';
import { syncDynamicDocuments } from '../ai/dynamic-context-documents';
import type { OperationalSettings } from '../ai/dynamic-context-documents';

let schedulerTask: cron.ScheduledTask | null = null;

const ITALIAN_TIMEZONE = 'Europe/Rome';

export function initDynamicContextScheduler() {
  if (schedulerTask) {
    console.log('📄 [DynamicContextScheduler] Already initialized, skipping');
    return;
  }

  console.log('📄 [DynamicContextScheduler] Initializing hourly context sync');
  console.log('   Schedule: Every hour at :30 (Europe/Rome)');
  
  schedulerTask = cron.schedule('30 * * * *', async () => {
    const now = new Date();
    const italianTime = formatInTimeZone(now, ITALIAN_TIMEZONE, 'HH:mm');
    console.log(`⏰ [DynamicContextScheduler] Running scheduled sync (Italian time: ${italianTime})`);
    await runDynamicContextSync();
  }, {
    timezone: ITALIAN_TIMEZONE
  });

  console.log('✅ [DynamicContextScheduler] Scheduled to run every hour at :30');
}

async function runDynamicContextSync() {
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`📄 [DynamicContextScheduler] Starting automatic context sync`);
  console.log(`   Time: ${new Date().toISOString()}`);
  console.log(`${'═'.repeat(60)}`);

  const startTime = Date.now();
  let consultantsProcessed = 0;
  let successCount = 0;
  let errorCount = 0;
  const errors: string[] = [];

  try {
    const consultantsWithStores = await db
      .select({
        consultantId: fileSearchStores.ownerId,
        firstName: users.firstName,
        lastName: users.lastName,
      })
      .from(fileSearchStores)
      .innerJoin(users, eq(users.id, fileSearchStores.ownerId))
      .where(eq(fileSearchStores.ownerType, 'consultant'));

    const uniqueConsultantIds = [...new Set(consultantsWithStores.map(c => c.consultantId))];

    if (uniqueConsultantIds.length === 0) {
      console.log('   📊 No consultants with File Search stores found, skipping');
      return;
    }

    console.log(`   📊 Found ${uniqueConsultantIds.length} consultants with File Search stores`);

    for (const consultantId of uniqueConsultantIds) {
      const consultant = consultantsWithStores.find(c => c.consultantId === consultantId);
      const name = consultant ? `${consultant.firstName || ''} ${consultant.lastName || ''}`.trim() : consultantId.substring(0, 8);
      
      console.log(`   👤 Syncing context for: ${name}...`);
      consultantsProcessed++;

      try {
        const [settings] = await db
          .select()
          .from(fileSearchSettings)
          .where(eq(fileSearchSettings.consultantId, consultantId))
          .limit(1);

        let operationalSettings: OperationalSettings | undefined;
        if (settings?.operationalSyncEnabled) {
          operationalSettings = {
            clients: settings.autoSyncOperationalClients,
            clientStates: settings.autoSyncOperationalClientStates,
            whatsappTemplates: settings.autoSyncOperationalWhatsappTemplates,
            twilioTemplates: settings.autoSyncOperationalTwilioTemplates,
            config: settings.autoSyncOperationalConfig,
            email: settings.autoSyncOperationalEmail,
            campaigns: settings.autoSyncOperationalCampaigns,
            calendar: settings.autoSyncOperationalCalendar,
            exercisesPending: settings.autoSyncOperationalExercisesPending,
            consultations: settings.autoSyncOperationalConsultations,
          };
        }

        const result = await syncDynamicDocuments(consultantId, operationalSettings);
        
        if (result.totalDocuments > 0) {
          successCount++;
          console.log(`      ✅ Synced ${result.totalDocuments} documents${operationalSettings ? ' (incl. operational)' : ''}`);
        } else {
          console.log(`      ⚠️ No documents synced (may be missing store or API key)`);
        }

        if (settings?.operationalSyncEnabled) {
          await db
            .update(fileSearchSettings)
            .set({ lastOperationalSyncAt: new Date() })
            .where(eq(fileSearchSettings.consultantId, consultantId));
        }
      } catch (error: any) {
        errorCount++;
        const errorMsg = `${name}: ${error.message}`;
        errors.push(errorMsg);
        console.error(`      ❌ Error: ${error.message}`);
      }
    }

    const elapsedSeconds = Math.round((Date.now() - startTime) / 1000);
    
    console.log(`\n${'─'.repeat(60)}`);
    console.log(`📄 [DynamicContextScheduler] Sync complete`);
    console.log(`   Processed: ${consultantsProcessed} consultants`);
    console.log(`   Success: ${successCount}, Errors: ${errorCount}`);
    console.log(`   Duration: ${elapsedSeconds}s`);
    if (errors.length > 0) {
      console.log(`   Errors: ${errors.join('; ')}`);
    }
    console.log(`${'═'.repeat(60)}\n`);

  } catch (error: any) {
    console.error(`❌ [DynamicContextScheduler] Fatal error:`, error);
  }
}

export function stopDynamicContextScheduler() {
  if (schedulerTask) {
    schedulerTask.stop();
    schedulerTask = null;
    console.log('🛑 [DynamicContextScheduler] Stopped');
  }
}

export async function manualTriggerDynamicContextSync(consultantId?: string) {
  if (consultantId) {
    console.log(`📄 [DynamicContextScheduler] Manual sync for consultant ${consultantId.substring(0, 8)}...`);
    
    const [settings] = await db
      .select()
      .from(fileSearchSettings)
      .where(eq(fileSearchSettings.consultantId, consultantId))
      .limit(1);

    let operationalSettings: OperationalSettings | undefined;
    if (settings?.operationalSyncEnabled) {
      operationalSettings = {
        clients: settings.autoSyncOperationalClients,
        clientStates: settings.autoSyncOperationalClientStates,
        whatsappTemplates: settings.autoSyncOperationalWhatsappTemplates,
        twilioTemplates: settings.autoSyncOperationalTwilioTemplates,
        config: settings.autoSyncOperationalConfig,
        email: settings.autoSyncOperationalEmail,
        campaigns: settings.autoSyncOperationalCampaigns,
        calendar: settings.autoSyncOperationalCalendar,
        exercisesPending: settings.autoSyncOperationalExercisesPending,
        consultations: settings.autoSyncOperationalConsultations,
      };
    }

    const result = await syncDynamicDocuments(consultantId, operationalSettings);
    
    if (settings?.operationalSyncEnabled) {
      await db
        .update(fileSearchSettings)
        .set({ lastOperationalSyncAt: new Date() })
        .where(eq(fileSearchSettings.consultantId, consultantId));
    }
    
    return result;
  } else {
    console.log(`📄 [DynamicContextScheduler] Manual sync for all consultants...`);
    await runDynamicContextSync();
  }
}
