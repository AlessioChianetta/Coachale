import cron from 'node-cron';
import { processPendingSyncs } from '../services/google-drive-sync-service';

let isRunning = false;

export function startDrivePendingSyncScheduler(): void {
  console.log(`🔄 [DRIVE PENDING SYNC] Starting pending sync processor (every 5 minutes)`);
  
  cron.schedule('*/5 * * * *', async () => {
    if (isRunning) {
      console.log(`⏭️ [DRIVE PENDING SYNC] Previous run still in progress, skipping`);
      return;
    }
    
    isRunning = true;
    
    try {
      const syncedCount = await processPendingSyncs();
      if (syncedCount > 0) {
        console.log(`✅ [DRIVE PENDING SYNC] Processed ${syncedCount} pending sync(s)`);
      }
    } catch (error: any) {
      console.error(`❌ [DRIVE PENDING SYNC] Error processing pending syncs:`, error.message);
    } finally {
      isRunning = false;
    }
  });
  
  console.log(`✅ [DRIVE PENDING SYNC] Scheduler started`);
}
