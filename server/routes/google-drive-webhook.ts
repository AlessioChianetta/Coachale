import { Router, Request, Response } from 'express';
import { findChannelByResourceId, scheduleDebouncedSync } from '../services/google-drive-sync-service';

const router = Router();

// Debounce duration in minutes (wait before syncing after file change)
const SYNC_DEBOUNCE_MINUTES = 30;

router.post('/google-drive/webhook', async (req: Request, res: Response) => {
  const resourceState = req.headers['x-goog-resource-state'] as string | undefined;
  const channelId = req.headers['x-goog-channel-id'] as string | undefined;
  const resourceId = req.headers['x-goog-resource-id'] as string | undefined;
  const messageNumber = req.headers['x-goog-message-number'] as string | undefined;
  const changedFields = req.headers['x-goog-changed'] as string | undefined;
  
  console.log(`📥 [DRIVE WEBHOOK] Received notification`);
  console.log(`   State: ${resourceState}`);
  console.log(`   Channel ID: ${channelId}`);
  console.log(`   Resource ID: ${resourceId}`);
  console.log(`   Message #: ${messageNumber}`);
  if (changedFields) {
    console.log(`   Changed: ${changedFields}`);
  }
  
  res.status(200).send('OK');
  
  if (resourceState === 'sync') {
    console.log(`ℹ️ [DRIVE WEBHOOK] Initial sync message received, ignoring`);
    return;
  }
  
  if (!channelId || !resourceId) {
    console.warn(`⚠️ [DRIVE WEBHOOK] Missing channelId or resourceId`);
    return;
  }
  
  try {
    const channel = await findChannelByResourceId(channelId, resourceId);
    
    if (!channel) {
      console.warn(`⚠️ [DRIVE WEBHOOK] Channel not found: ${channelId}`);
      return;
    }
    
    if (resourceState === 'update' || resourceState === 'change') {
      // Schedule debounced sync instead of immediate sync
      const scheduledTime = new Date(Date.now() + SYNC_DEBOUNCE_MINUTES * 60 * 1000);
      await scheduleDebouncedSync(channel.documentId, scheduledTime);
      console.log(`⏰ [DRIVE WEBHOOK] Sync scheduled for ${scheduledTime.toISOString()} (${SYNC_DEBOUNCE_MINUTES} min debounce)`);
    } else if (resourceState === 'trash' || resourceState === 'delete') {
      console.log(`🗑️ [DRIVE WEBHOOK] File trashed/deleted: ${channel.documentId}`);
    } else {
      console.log(`ℹ️ [DRIVE WEBHOOK] Unhandled state: ${resourceState}`);
    }
  } catch (error: any) {
    console.error(`❌ [DRIVE WEBHOOK] Error processing notification:`, error.message);
  }
});

router.get('/google-drive/webhook', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'active',
    message: 'Google Drive webhook endpoint is active',
    timestamp: new Date().toISOString()
  });
});

export default router;
