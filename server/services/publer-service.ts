import { db } from '../db';
import { publerConfigs, publerAccounts, contentPosts } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { storage } from '../storage';

const PUBLER_BASE_URL = 'https://app.publer.com/api/v1';

interface PublerAccount {
  id: string;
  name: string;
  username?: string;
  type: string;
  profile_image?: string;
}

interface PublerMediaResult {
  id: string;
  path: string;
  thumbnail?: string;
  width?: number;
  height?: number;
}

interface SchedulePostRequest {
  accountIds: string[];
  text: string;
  scheduledAt?: Date;
  mediaIds?: string[];
  platforms?: Record<string, { type: string; text: string }>;
}

interface SchedulePostResult {
  jobId: string;
  success: boolean;
}

export class PublerService {
  private async getConfig(consultantId: string) {
    const [config] = await db
      .select()
      .from(publerConfigs)
      .where(eq(publerConfigs.consultantId, consultantId))
      .limit(1);
    
    return config;
  }

  private async getDecryptedApiKey(consultantId: string): Promise<{ apiKey: string; workspaceId: string } | null> {
    const config = await this.getConfig(consultantId);
    
    if (!config || !config.apiKeyEncrypted || !config.workspaceId) {
      return null;
    }

    try {
      const apiKey = storage.decryptData(config.apiKeyEncrypted);
      return { apiKey, workspaceId: config.workspaceId };
    } catch (error) {
      console.error('[PUBLER] Failed to decrypt API key:', error);
      return null;
    }
  }

  private getHeaders(apiKey: string, workspaceId: string) {
    return {
      'Authorization': `Bearer-API ${apiKey}`,
      'Publer-Workspace-Id': workspaceId,
      'Content-Type': 'application/json',
    };
  }

  async testConnection(consultantId: string): Promise<{ success: boolean; message: string; accountCount?: number }> {
    const credentials = await this.getDecryptedApiKey(consultantId);
    
    if (!credentials) {
      return { success: false, message: 'Publer non configurato o API key mancante' };
    }

    try {
      const response = await fetch(`${PUBLER_BASE_URL}/accounts`, {
        method: 'GET',
        headers: this.getHeaders(credentials.apiKey, credentials.workspaceId),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        return { 
          success: false, 
          message: error.message || `Errore connessione Publer: ${response.status}` 
        };
      }

      const accounts = await response.json();
      return { 
        success: true, 
        message: 'Connessione riuscita!',
        accountCount: Array.isArray(accounts) ? accounts.length : 0
      };
    } catch (error: any) {
      return { success: false, message: `Errore: ${error.message}` };
    }
  }

  async getAccounts(consultantId: string): Promise<PublerAccount[]> {
    const credentials = await this.getDecryptedApiKey(consultantId);
    
    if (!credentials) {
      throw new Error('Publer non configurato');
    }

    const response = await fetch(`${PUBLER_BASE_URL}/accounts`, {
      method: 'GET',
      headers: this.getHeaders(credentials.apiKey, credentials.workspaceId),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || `Errore API Publer: ${response.status}`);
    }

    const accounts = await response.json();
    return accounts;
  }

  async syncAccounts(consultantId: string): Promise<{ synced: number }> {
    const accounts = await this.getAccounts(consultantId);

    await db.delete(publerAccounts).where(eq(publerAccounts.consultantId, consultantId));

    for (const account of accounts) {
      await db.insert(publerAccounts).values({
        id: account.id,
        consultantId,
        platform: account.type,
        accountName: account.name,
        accountUsername: account.username,
        profileImageUrl: account.profile_image,
        isActive: true,
        syncedAt: new Date(),
      });
    }

    await db.update(publerConfigs)
      .set({ lastSyncAt: new Date(), updatedAt: new Date() })
      .where(eq(publerConfigs.consultantId, consultantId));

    return { synced: accounts.length };
  }

  async getCachedAccounts(consultantId: string) {
    return db.select().from(publerAccounts).where(eq(publerAccounts.consultantId, consultantId));
  }

  async uploadMedia(consultantId: string, fileBuffer: Buffer, filename: string, mimeType: string): Promise<PublerMediaResult> {
    const credentials = await this.getDecryptedApiKey(consultantId);
    
    if (!credentials) {
      throw new Error('Publer non configurato');
    }

    const formData = new FormData();
    const blob = new Blob([fileBuffer], { type: mimeType });
    formData.append('file', blob, filename);
    formData.append('direct_upload', 'true');
    formData.append('in_library', 'true');

    const response = await fetch(`${PUBLER_BASE_URL}/media`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer-API ${credentials.apiKey}`,
        'Publer-Workspace-Id': credentials.workspaceId,
      },
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || `Errore upload media: ${response.status}`);
    }

    return response.json();
  }

  async schedulePost(consultantId: string, request: SchedulePostRequest): Promise<SchedulePostResult> {
    const credentials = await this.getDecryptedApiKey(consultantId);
    
    if (!credentials) {
      throw new Error('Publer non configurato');
    }

    const postPayload: any = {
      bulk: {
        state: request.scheduledAt ? 'scheduled' : 'publish_now',
        posts: [
          {
            accounts: request.accountIds.map(id => ({
              id,
              scheduled_at: request.scheduledAt?.toISOString(),
            })),
            networks: request.platforms || {},
            media: request.mediaIds?.map(id => ({ id, type: 'image' })) || [],
          },
        ],
      },
    };

    if (!request.platforms) {
      postPayload.bulk.posts[0].text = request.text;
    }

    const response = await fetch(`${PUBLER_BASE_URL}/posts/schedule/publish`, {
      method: 'POST',
      headers: this.getHeaders(credentials.apiKey, credentials.workspaceId),
      body: JSON.stringify(postPayload),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || `Errore pubblicazione: ${response.status}`);
    }

    const result = await response.json();
    return { jobId: result.job_id, success: true };
  }

  async updatePostStatus(
    postId: string, 
    status: 'scheduled' | 'published' | 'failed', 
    publerPostId?: string,
    scheduledAt?: Date,
    error?: string
  ) {
    const updateData: any = {
      publerStatus: status,
      updatedAt: new Date(),
    };
    
    if (publerPostId) updateData.publerPostId = publerPostId;
    if (scheduledAt) updateData.publerScheduledAt = scheduledAt;
    if (status === 'published') updateData.publerPublishedAt = new Date();
    if (error) updateData.publerError = error;

    await db.update(contentPosts)
      .set(updateData)
      .where(eq(contentPosts.id, postId));
  }

  async saveConfig(consultantId: string, apiKey: string, workspaceId: string, isActive: boolean = true) {
    const [existing] = await db
      .select()
      .from(publerConfigs)
      .where(eq(publerConfigs.consultantId, consultantId))
      .limit(1);

    if (existing) {
      const updateData: any = { isActive, updatedAt: new Date() };
      if (apiKey !== 'KEEP_EXISTING') {
        updateData.apiKeyEncrypted = storage.encryptData(apiKey);
      }
      if (workspaceId !== 'KEEP_EXISTING') {
        updateData.workspaceId = workspaceId;
      }
      await db.update(publerConfigs)
        .set(updateData)
        .where(eq(publerConfigs.consultantId, consultantId));
    } else {
      if (apiKey === 'KEEP_EXISTING' || workspaceId === 'KEEP_EXISTING') {
        throw new Error('API Key e Workspace ID sono richiesti per la prima configurazione');
      }
      await db.insert(publerConfigs).values({
        consultantId,
        apiKeyEncrypted: storage.encryptData(apiKey),
        workspaceId,
        isActive,
      });
    }

    return { success: true };
  }

  async getConfigStatus(consultantId: string) {
    const config = await this.getConfig(consultantId);
    
    if (!config) {
      return { configured: false };
    }

    const accounts = await this.getCachedAccounts(consultantId);

    return {
      configured: true,
      isActive: config.isActive,
      hasApiKey: !!config.apiKeyEncrypted,
      hasWorkspaceId: !!config.workspaceId,
      lastSyncAt: config.lastSyncAt,
      accountCount: accounts.length,
    };
  }
}

export const publerService = new PublerService();
