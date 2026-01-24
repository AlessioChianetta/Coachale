import { 
  getExpiringChannels, 
  renewDriveChannel, 
  cleanupExpiredChannels 
} from '../services/google-drive-sync-service';

let renewalInterval: NodeJS.Timeout | null = null;

export async function runChannelRenewal(): Promise<void> {
  console.log(`🔄 [DRIVE RENEWAL] Starting channel renewal check...`);
  
  try {
    const cleanedCount = await cleanupExpiredChannels();
    if (cleanedCount > 0) {
      console.log(`🧹 [DRIVE RENEWAL] Cleaned ${cleanedCount} expired channels`);
    }
    
    const expiringChannels = await getExpiringChannels(6);
    
    if (expiringChannels.length === 0) {
      console.log(`✅ [DRIVE RENEWAL] No channels need renewal`);
      return;
    }
    
    console.log(`📋 [DRIVE RENEWAL] Found ${expiringChannels.length} channel(s) expiring soon`);
    
    let renewedCount = 0;
    let failedCount = 0;
    
    for (const channel of expiringChannels) {
      const hoursUntilExpiration = (channel.expiration.getTime() - Date.now()) / (1000 * 60 * 60);
      console.log(`   Channel ${channel.channelId.substring(0, 20)}... expires in ${hoursUntilExpiration.toFixed(1)}h`);
      
      const success = await renewDriveChannel(channel.id);
      if (success) {
        renewedCount++;
      } else {
        failedCount++;
      }
      
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    console.log(`✅ [DRIVE RENEWAL] Renewal complete: ${renewedCount} renewed, ${failedCount} failed`);
  } catch (error: any) {
    console.error(`❌ [DRIVE RENEWAL] Error during renewal:`, error.message);
  }
}

export function startChannelRenewalScheduler(): void {
  if (renewalInterval) {
    console.log(`⚠️ [DRIVE RENEWAL] Scheduler already running`);
    return;
  }
  
  const RENEWAL_INTERVAL_MS = 12 * 60 * 60 * 1000;
  
  console.log(`🚀 [DRIVE RENEWAL] Starting channel renewal scheduler (every 12 hours)`);
  
  setTimeout(() => {
    runChannelRenewal().catch(err => {
      console.error(`❌ [DRIVE RENEWAL] Initial run failed:`, err.message);
    });
  }, 60 * 1000);
  
  renewalInterval = setInterval(() => {
    runChannelRenewal().catch(err => {
      console.error(`❌ [DRIVE RENEWAL] Scheduled run failed:`, err.message);
    });
  }, RENEWAL_INTERVAL_MS);
  
  console.log(`✅ [DRIVE RENEWAL] Scheduler started`);
}

export function stopChannelRenewalScheduler(): void {
  if (renewalInterval) {
    clearInterval(renewalInterval);
    renewalInterval = null;
    console.log(`🛑 [DRIVE RENEWAL] Scheduler stopped`);
  }
}
