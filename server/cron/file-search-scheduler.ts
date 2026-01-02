import cron from 'node-cron';
import { db } from '../db';
import { fileSearchSettings } from '../../shared/schema';
import { eq } from 'drizzle-orm';
import { FileSearchSyncService } from '../services/file-search-sync-service';

let schedulerTask: cron.ScheduledTask | null = null;

export function initFileSearchScheduler() {
  if (schedulerTask) {
    console.log('📅 [FileSearchScheduler] Already initialized, skipping');
    return;
  }

  console.log('📅 [FileSearchScheduler] Initializing scheduled sync (checks every minute)');
  console.log('   Timezone: Europe/Rome (Italian time)');
  
  schedulerTask = cron.schedule('* * * * *', async () => {
    await runScheduledSync();
  }, {
    timezone: 'Europe/Rome'
  });

  console.log('✅ [FileSearchScheduler] Scheduled sync initialized');
}

async function runScheduledSync() {
  const now = new Date();
  
  const italianTime = new Intl.DateTimeFormat('it-IT', {
    timeZone: 'Europe/Rome',
    hour: 'numeric',
    minute: 'numeric',
    hour12: false
  }).format(now);
  
  const [hourStr, minuteStr] = italianTime.split(':');
  const currentHour = parseInt(hourStr, 10);
  const currentMinute = parseInt(minuteStr, 10);

  try {
    const allSettings = await db.select()
      .from(fileSearchSettings)
      .where(eq(fileSearchSettings.scheduledSyncEnabled, true));

    const matchingConsultants = allSettings.filter(
      s => s.scheduledSyncHour === currentHour && (s.scheduledSyncMinute ?? 0) === currentMinute
    );

    if (matchingConsultants.length === 0) {
      return;
    }

    console.log(`\n${'═'.repeat(60)}`);
    console.log(`📅 [FileSearchScheduler] Running scheduled syncs at ${currentHour.toString().padStart(2, '0')}:${currentMinute.toString().padStart(2, '0')} (Italian time)`);
    console.log(`   🎯 Found ${matchingConsultants.length} consultant(s) scheduled for this time`);
    console.log(`${'═'.repeat(60)}`);

    for (const settings of matchingConsultants) {
      try {
        console.log(`\n   🔄 Starting scheduled sync for consultant: ${settings.consultantId}`);
        
        const result = await FileSearchSyncService.syncAllDocumentsForConsultant(settings.consultantId);
        
        await db.update(fileSearchSettings)
          .set({ lastScheduledSync: new Date() })
          .where(eq(fileSearchSettings.consultantId, settings.consultantId));

        console.log(`   ✅ Scheduled sync completed for ${settings.consultantId}`);
        console.log(`      Synced: ${result.totalSynced}, Updated: ${result.totalUpdated}, Skipped: ${result.totalSkipped}, Failed: ${result.totalFailed}`);
      } catch (error: any) {
        console.error(`   ❌ Scheduled sync failed for ${settings.consultantId}:`, error.message);
      }
    }

    console.log(`\n${'═'.repeat(60)}`);
    console.log(`📅 [FileSearchScheduler] Scheduled sync cycle complete`);
    console.log(`${'═'.repeat(60)}\n`);
  } catch (error: any) {
    console.error('[FileSearchScheduler] Error in scheduled sync:', error.message);
  }
}

export function stopFileSearchScheduler() {
  if (schedulerTask) {
    schedulerTask.stop();
    schedulerTask = null;
    console.log('⏹️ [FileSearchScheduler] Stopped');
  }
}
