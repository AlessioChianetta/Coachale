import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { db } from '../db';
import { 
  driveSyncChannels, 
  consultantKnowledgeDocuments, 
  consultantAvailabilitySettings,
  vertexAiSettings,
  systemSettings,
  documentSyncHistory
} from '../../shared/schema';
import { eq, and, lt, lte, isNotNull } from 'drizzle-orm';
import { extractTextFromFile, type VertexAICredentials } from './document-processor';
import { downloadDriveFile, refreshDriveTokenIfNeeded } from './google-drive-service';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

function extractJsonbString(value: any): string | null {
  if (!value) return null;
  if (typeof value === 'string') {
    let cleaned = value;
    while (cleaned.startsWith('"') && cleaned.endsWith('"') && cleaned.length > 2) {
      try {
        const parsed = JSON.parse(cleaned);
        if (typeof parsed === 'string') {
          cleaned = parsed;
        } else {
          break;
        }
      } catch {
        break;
      }
    }
    return cleaned;
  }
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  return String(value);
}

async function getGlobalOAuthCredentials() {
  const [clientIdSetting] = await db
    .select()
    .from(systemSettings)
    .where(eq(systemSettings.key, "google_oauth_client_id"))
    .limit(1);

  const [clientSecretSetting] = await db
    .select()
    .from(systemSettings)
    .where(eq(systemSettings.key, "google_oauth_client_secret"))
    .limit(1);

  const clientId = extractJsonbString(clientIdSetting?.value);
  const clientSecret = extractJsonbString(clientSecretSetting?.value);

  if (clientId && clientSecret) {
    return { clientId, clientSecret };
  }
  return null;
}

async function createOAuth2ClientForConsultant(consultantId: string): Promise<OAuth2Client> {
  const globalCredentials = await getGlobalOAuthCredentials();
  
  let clientId: string;
  let clientSecret: string;
  
  if (globalCredentials) {
    clientId = globalCredentials.clientId;
    clientSecret = globalCredentials.clientSecret;
  } else {
    const [settings] = await db
      .select()
      .from(consultantAvailabilitySettings)
      .where(eq(consultantAvailabilitySettings.consultantId, consultantId))
      .limit(1);
    
    if (!settings?.googleOAuthClientId || !settings?.googleOAuthClientSecret) {
      throw new Error('Google OAuth credentials not configured');
    }
    
    clientId = settings.googleOAuthClientId;
    clientSecret = settings.googleOAuthClientSecret;
  }
  
  let baseUrl = 'http://localhost:5000';
  if (process.env.REPLIT_DOMAINS) {
    const domains = process.env.REPLIT_DOMAINS.split(',');
    baseUrl = `https://${domains[0]}`;
  }
  
  const redirectUri = `${baseUrl}/api/consultant/google-drive/callback`;
  
  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

async function getDriveClientForConsultant(consultantId: string) {
  const accessToken = await refreshDriveTokenIfNeeded(consultantId);
  
  if (!accessToken) {
    throw new Error('Google Drive not connected');
  }
  
  const oauth2Client = await createOAuth2ClientForConsultant(consultantId);
  oauth2Client.setCredentials({ access_token: accessToken });
  
  return google.drive({ version: 'v3', auth: oauth2Client });
}

function getWebhookUrl(): string {
  if (process.env.REPLIT_DOMAINS) {
    const domains = process.env.REPLIT_DOMAINS.split(',');
    return `https://${domains[0]}/api/google-drive/webhook`;
  }
  return 'http://localhost:5000/api/google-drive/webhook';
}

export async function registerDriveWatch(
  consultantId: string,
  documentId: string,
  googleDriveFileId: string
): Promise<{ channelId: string; resourceId: string; expiration: Date } | null> {
  try {
    const drive = await getDriveClientForConsultant(consultantId);
    
    const channelId = `kb-${documentId}-${Date.now()}`;
    const webhookUrl = getWebhookUrl();
    const expirationMs = Date.now() + 24 * 60 * 60 * 1000;
    
    console.log(`🔔 [DRIVE SYNC] Registering watch for file ${googleDriveFileId}`);
    console.log(`   Webhook URL: ${webhookUrl}`);
    console.log(`   Channel ID: ${channelId}`);
    
    const response = await drive.files.watch({
      fileId: googleDriveFileId,
      requestBody: {
        id: channelId,
        type: 'web_hook',
        address: webhookUrl,
        expiration: String(expirationMs)
      }
    });
    
    if (!response.data.resourceId) {
      throw new Error('No resourceId returned from Drive API');
    }
    
    const resourceId = response.data.resourceId;
    const expiration = new Date(expirationMs);
    
    await db.insert(driveSyncChannels).values({
      id: crypto.randomUUID(),
      consultantId,
      documentId,
      googleDriveFileId,
      channelId,
      resourceId,
      expiration,
      syncStatus: 'active',
      lastSyncedAt: new Date()
    });
    
    console.log(`✅ [DRIVE SYNC] Watch registered successfully`);
    console.log(`   Resource ID: ${resourceId}`);
    console.log(`   Expires: ${expiration.toISOString()}`);
    
    return { channelId, resourceId, expiration };
  } catch (error: any) {
    console.error(`❌ [DRIVE SYNC] Failed to register watch:`, error.message);
    if (error.message?.includes('Push notifications are not supported')) {
      console.log(`ℹ️ [DRIVE SYNC] Push notifications not supported for this file type`);
    }
    return null;
  }
}

export async function stopDriveWatch(
  consultantId: string,
  channelId: string,
  resourceId: string
): Promise<boolean> {
  try {
    const drive = await getDriveClientForConsultant(consultantId);
    
    await drive.channels.stop({
      requestBody: {
        id: channelId,
        resourceId: resourceId
      }
    });
    
    console.log(`🛑 [DRIVE SYNC] Stopped watch for channel ${channelId}`);
    return true;
  } catch (error: any) {
    console.warn(`⚠️ [DRIVE SYNC] Failed to stop watch:`, error.message);
    return false;
  }
}

export async function renewDriveChannel(syncChannelId: string): Promise<boolean> {
  try {
    const [channel] = await db
      .select()
      .from(driveSyncChannels)
      .where(eq(driveSyncChannels.id, syncChannelId))
      .limit(1);
    
    if (!channel) {
      console.error(`❌ [DRIVE SYNC] Channel not found: ${syncChannelId}`);
      return false;
    }
    
    await stopDriveWatch(channel.consultantId, channel.channelId, channel.resourceId);
    
    const result = await registerDriveWatch(
      channel.consultantId,
      channel.documentId,
      channel.googleDriveFileId
    );
    
    if (result) {
      await db
        .delete(driveSyncChannels)
        .where(eq(driveSyncChannels.id, syncChannelId));
      
      console.log(`🔄 [DRIVE SYNC] Channel renewed successfully`);
      return true;
    }
    
    await db
      .update(driveSyncChannels)
      .set({ 
        syncStatus: 'expired',
        updatedAt: new Date()
      })
      .where(eq(driveSyncChannels.id, syncChannelId));
    
    return false;
  } catch (error: any) {
    console.error(`❌ [DRIVE SYNC] Failed to renew channel:`, error.message);
    
    await db
      .update(driveSyncChannels)
      .set({ 
        syncStatus: 'error',
        updatedAt: new Date()
      })
      .where(eq(driveSyncChannels.id, syncChannelId));
    
    return false;
  }
}

/**
 * Schedule a debounced sync for a document
 * If a sync is already scheduled, it updates the scheduled time (resets debounce timer)
 */
export async function scheduleDebouncedSync(documentId: string, scheduledTime: Date): Promise<void> {
  await db
    .update(consultantKnowledgeDocuments)
    .set({ 
      pendingSyncAt: scheduledTime,
      updatedAt: new Date()
    })
    .where(eq(consultantKnowledgeDocuments.id, documentId));
  
  console.log(`⏰ [DRIVE SYNC] Debounced sync scheduled for document ${documentId} at ${scheduledTime.toISOString()}`);
}

/**
 * Process all documents with pending syncs that are due
 */
export async function processPendingSyncs(): Promise<number> {
  const now = new Date();
  
  // Find documents with pendingSyncAt <= now
  const pendingDocs = await db
    .select()
    .from(consultantKnowledgeDocuments)
    .where(
      and(
        isNotNull(consultantKnowledgeDocuments.pendingSyncAt),
        lte(consultantKnowledgeDocuments.pendingSyncAt, now)
      )
    );
  
  if (pendingDocs.length === 0) {
    return 0;
  }
  
  console.log(`🔄 [DRIVE SYNC] Processing ${pendingDocs.length} pending sync(s)...`);
  
  let successCount = 0;
  for (const doc of pendingDocs) {
    const success = await syncDocumentFromDrive(doc.id, 'webhook');
    if (success) successCount++;
  }
  
  return successCount;
}

export async function syncDocumentFromDrive(
  documentId: string, 
  syncType: 'webhook' | 'manual' | 'scheduled' | 'initial' = 'manual'
): Promise<boolean> {
  console.log(`🔄 [DRIVE SYNC] Starting sync for document ${documentId} (type: ${syncType})`);
  const startTime = Date.now();
  
  // Create sync history entry
  const historyId = crypto.randomUUID();
  
  try {
    const [document] = await db
      .select()
      .from(consultantKnowledgeDocuments)
      .where(eq(consultantKnowledgeDocuments.id, documentId))
      .limit(1);
    
    if (!document) {
      console.error(`❌ [DRIVE SYNC] Document not found: ${documentId}`);
      return false;
    }
    
    if (!document.googleDriveFileId) {
      console.error(`❌ [DRIVE SYNC] Document has no Google Drive file ID`);
      return false;
    }
    
    // Insert history entry
    await db.insert(documentSyncHistory).values({
      id: historyId,
      documentId,
      consultantId: document.consultantId,
      syncType,
      status: 'success',
      previousVersion: document.version || 1,
      startedAt: new Date()
    });
    
    await db
      .update(consultantKnowledgeDocuments)
      .set({ 
        status: 'processing',
        pendingSyncAt: null, // Clear pending sync
        updatedAt: new Date()
      })
      .where(eq(consultantKnowledgeDocuments.id, documentId));
    
    console.log(`📥 [DRIVE SYNC] Downloading file from Drive...`);
    const { filePath: tempFilePath, fileName, mimeType } = await downloadDriveFile(
      document.consultantId,
      document.googleDriveFileId
    );
    
    const KNOWLEDGE_UPLOAD_DIR = 'uploads/knowledge';
    const uploadDir = path.join(process.cwd(), KNOWLEDGE_UPLOAD_DIR);
    await fs.mkdir(uploadDir, { recursive: true });
    
    const uniqueFileName = `${crypto.randomUUID()}${path.extname(fileName)}`;
    const newFilePath = path.join(uploadDir, uniqueFileName);
    
    await fs.copyFile(tempFilePath, newFilePath);
    await fs.unlink(tempFilePath).catch(() => {});
    
    if (document.filePath && document.filePath !== newFilePath) {
      await fs.unlink(document.filePath).catch(() => {});
    }
    
    console.log(`🔄 [DRIVE SYNC] Extracting text from updated file...`);
    
    let vertexCredentials: VertexAICredentials | undefined;
    if (mimeType.startsWith('audio/')) {
      const [aiSettings] = await db
        .select()
        .from(vertexAiSettings)
        .where(eq(vertexAiSettings.userId, document.consultantId))
        .limit(1);
      
      if (aiSettings?.serviceAccountJson) {
        const serviceAccount = JSON.parse(aiSettings.serviceAccountJson);
        vertexCredentials = {
          projectId: serviceAccount.project_id,
          location: 'us-central1',
          credentials: serviceAccount
        };
      }
    }
    
    const extractedContent = await extractTextFromFile(newFilePath, mimeType, vertexCredentials);
    const charactersExtracted = extractedContent?.length || 0;
    const estimatedTokens = Math.round(charactersExtracted / 4);
    
    const fileStats = await fs.stat(newFilePath);
    const newVersion = (document.version || 1) + 1;
    
    await db
      .update(consultantKnowledgeDocuments)
      .set({
        filePath: newFilePath,
        fileName,
        fileSize: fileStats.size,
        extractedContent,
        status: 'indexed',
        version: newVersion,
        syncCount: (document.syncCount || 0) + 1,
        lastDriveSyncAt: new Date(),
        pendingSyncAt: null,
        updatedAt: new Date()
      })
      .where(eq(consultantKnowledgeDocuments.id, documentId));
    
    await db
      .update(driveSyncChannels)
      .set({ 
        lastSyncedAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(driveSyncChannels.documentId, documentId));
    
    // Update history entry with success
    const durationMs = Date.now() - startTime;
    await db
      .update(documentSyncHistory)
      .set({
        status: 'success',
        newVersion,
        charactersExtracted,
        estimatedTokens,
        completedAt: new Date(),
        durationMs
      })
      .where(eq(documentSyncHistory.id, historyId));
    
    console.log(`✅ [DRIVE SYNC] Document synced successfully: "${document.title}" (${charactersExtracted} chars, ~${estimatedTokens} tokens)`);
    return true;
  } catch (error: any) {
    console.error(`❌ [DRIVE SYNC] Sync failed:`, error.message);
    
    // Update history entry with failure
    const durationMs = Date.now() - startTime;
    await db
      .update(documentSyncHistory)
      .set({
        status: 'failed',
        errorMessage: error.message,
        completedAt: new Date(),
        durationMs
      })
      .where(eq(documentSyncHistory.id, historyId))
      .catch(() => {}); // Ignore if history entry doesn't exist
    
    await db
      .update(consultantKnowledgeDocuments)
      .set({ 
        status: 'error',
        pendingSyncAt: null,
        updatedAt: new Date()
      })
      .where(eq(consultantKnowledgeDocuments.id, documentId));
    
    return false;
  }
}

export async function findChannelByResourceId(
  channelId: string,
  resourceId: string
): Promise<typeof driveSyncChannels.$inferSelect | null> {
  const [channel] = await db
    .select()
    .from(driveSyncChannels)
    .where(
      and(
        eq(driveSyncChannels.channelId, channelId),
        eq(driveSyncChannels.resourceId, resourceId)
      )
    )
    .limit(1);
  
  return channel || null;
}

export async function getExpiringChannels(hoursBeforeExpiration: number = 6): Promise<Array<typeof driveSyncChannels.$inferSelect>> {
  const cutoffTime = new Date(Date.now() + hoursBeforeExpiration * 60 * 60 * 1000);
  
  const channels = await db
    .select()
    .from(driveSyncChannels)
    .where(
      and(
        eq(driveSyncChannels.syncStatus, 'active'),
        lt(driveSyncChannels.expiration, cutoffTime)
      )
    );
  
  return channels;
}

export async function cleanupExpiredChannels(): Promise<number> {
  const now = new Date();
  
  const expiredChannels = await db
    .select()
    .from(driveSyncChannels)
    .where(lt(driveSyncChannels.expiration, now));
  
  let cleanedCount = 0;
  
  for (const channel of expiredChannels) {
    try {
      await stopDriveWatch(channel.consultantId, channel.channelId, channel.resourceId);
    } catch {
    }
    
    await db
      .delete(driveSyncChannels)
      .where(eq(driveSyncChannels.id, channel.id));
    
    cleanedCount++;
  }
  
  if (cleanedCount > 0) {
    console.log(`🧹 [DRIVE SYNC] Cleaned up ${cleanedCount} expired channels`);
  }
  
  return cleanedCount;
}

export async function removeSyncChannelForDocument(documentId: string): Promise<void> {
  const channels = await db
    .select()
    .from(driveSyncChannels)
    .where(eq(driveSyncChannels.documentId, documentId));
  
  for (const channel of channels) {
    try {
      await stopDriveWatch(channel.consultantId, channel.channelId, channel.resourceId);
    } catch {
    }
  }
  
  await db
    .delete(driveSyncChannels)
    .where(eq(driveSyncChannels.documentId, documentId));
  
  if (channels.length > 0) {
    console.log(`🗑️ [DRIVE SYNC] Removed ${channels.length} sync channel(s) for document ${documentId}`);
  }
}
