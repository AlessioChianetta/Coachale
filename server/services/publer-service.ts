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

type PublishState = 'draft' | 'publish_now' | 'scheduled';

interface SchedulePostRequest {
  accountIds: string[];
  text: string;
  state?: PublishState;
  scheduledAt?: Date;
  mediaIds?: string[];
  platforms?: Record<string, { type: string; text: string }>;
  accountPlatforms?: { id: string; platform: string }[];
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

  async testConnection(consultantId: string): Promise<{ success: boolean; message: string; accountCount?: number; workspaces?: any[] }> {
    const credentials = await this.getDecryptedApiKey(consultantId);
    
    if (!credentials) {
      return { success: false, message: 'Publer non configurato o API key mancante' };
    }

    try {
      const meResponse = await fetch(`${PUBLER_BASE_URL}/users/me`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer-API ${credentials.apiKey}`,
          'Content-Type': 'application/json',
        },
      });

      console.log('[PUBLER] /me response status:', meResponse.status);

      if (!meResponse.ok) {
        const error = await meResponse.json().catch(() => ({}));
        console.error('[PUBLER] /me failed:', meResponse.status, error);
        if (meResponse.status === 401) {
          return { success: false, message: 'API Key non valida. Verifica che sia corretta.' };
        }
        return { success: false, message: error.message || `Errore API Key: ${meResponse.status}` };
      }

      const meData = await meResponse.json();
      console.log('[PUBLER] /me success, user:', meData.email || meData.name || 'OK');

      const wsResponse = await fetch(`${PUBLER_BASE_URL}/workspaces`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer-API ${credentials.apiKey}`,
          'Content-Type': 'application/json',
        },
      });

      if (!wsResponse.ok) {
        console.error('[PUBLER] /workspaces failed:', wsResponse.status);
        return { success: false, message: 'Impossibile recuperare i workspace.' };
      }

      const workspaces = await wsResponse.json();
      console.log('[PUBLER] Found workspaces:', workspaces.length);

      if (credentials.workspaceId) {
        const validWs = workspaces.find((ws: any) => ws.id === credentials.workspaceId);
        if (!validWs) {
          const wsNames = workspaces.map((ws: any) => `${ws.name} (${ws.id})`).join(', ');
          return { 
            success: false, 
            message: `Workspace ID non trovato. I tuoi workspace: ${wsNames || 'nessuno'}`,
            workspaces
          };
        }

        const accountsResponse = await fetch(`${PUBLER_BASE_URL}/accounts`, {
          method: 'GET',
          headers: this.getHeaders(credentials.apiKey, credentials.workspaceId),
        });

        if (accountsResponse.ok) {
          const accounts = await accountsResponse.json();
          return { 
            success: true, 
            message: `Connessione riuscita! Workspace: ${validWs.name}`,
            accountCount: Array.isArray(accounts) ? accounts.length : 0
          };
        }
      }

      if (workspaces.length > 0) {
        const wsNames = workspaces.map((ws: any) => `${ws.name} (${ws.id})`).join(', ');
        return { 
          success: false, 
          message: `API Key valida! Inserisci il Workspace ID. I tuoi workspace: ${wsNames}`,
          workspaces
        };
      }

      return { success: true, message: 'API Key valida! Nessun workspace trovato.' };
    } catch (error: any) {
      console.error('[PUBLER] Test connection error:', error);
      return { success: false, message: `Errore di connessione: ${error.message}` };
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

    let publerState: string;
    if (request.state === 'draft') {
      publerState = 'draft';
    } else if (request.state === 'scheduled' && request.scheduledAt) {
      publerState = 'scheduled';
    } else {
      publerState = 'publish_now';
    }

    console.log('[PUBLER] Scheduling post with state:', publerState, 'for accounts:', request.accountIds.length);

    // Determina le piattaforme selezionate
    // Se accountPlatforms non è fornito, recupera dal database
    let accountPlatforms = request.accountPlatforms;
    if (!accountPlatforms || accountPlatforms.length === 0) {
      // Fallback: recupera le platform dagli account salvati
      const savedAccounts = await db
        .select({ id: publerAccounts.accountId, platform: publerAccounts.platform })
        .from(publerAccounts)
        .where(eq(publerAccounts.consultantId, consultantId));
      
      accountPlatforms = request.accountIds
        .map(id => {
          const saved = savedAccounts.find(a => a.id === id);
          return saved ? { id, platform: saved.platform } : null;
        })
        .filter((a): a is { id: string; platform: string } => a !== null);
    }

    // Verifica se Instagram è selezionato e non ci sono media
    const hasInstagram = accountPlatforms.some(a => a.platform === 'instagram');
    const hasMedia = request.mediaIds && request.mediaIds.length > 0;
    
    if (hasInstagram && !hasMedia) {
      throw new Error('Instagram richiede almeno un\'immagine o video. Per pubblicare solo testo, deseleziona Instagram.');
    }

    // REGOLA D'ORO PUBLER API:
    // 1. networks DEVE essere compilato (mai vuoto)
    // 2. text DEVE essere dentro networks.default.text
    // 3. scheduled_at DEVE essere a livello POST, NON dentro accounts
    // 4. Instagram usa type: 'post', altre piattaforme usano 'status'
    // Questo vale per TUTTI gli stati: draft, scheduled, publish_now
    
    // Determina il tipo di post (Instagram usa 'post', altri 'status')
    const postType = hasInstagram ? 'post' : 'status';
    
    // Se request.platforms è fornito, assicurati che Instagram usi type 'post'
    let networks = request.platforms;
    if (networks && hasInstagram) {
      // Override del tipo per Instagram
      if (networks.instagram) {
        networks.instagram.type = 'post';
      }
      if (networks.default) {
        networks.default.type = 'post';
      }
    }
    
    const postEntry: any = {
      accounts: request.accountIds.map(id => ({ id })),
      networks: networks || {
        default: {
          type: postType,
          text: request.text
        }
      },
      media: request.mediaIds?.map(id => ({ id, type: 'image' })) || [],
    };
    
    // scheduled_at a livello POST (non dentro accounts!)
    if (publerState === 'scheduled' && request.scheduledAt) {
      postEntry.scheduled_at = request.scheduledAt.toISOString();
    }
    
    const postPayload: any = {
      bulk: {
        state: publerState,
        posts: [postEntry],
      },
    };

    console.log('[PUBLER] Request payload:', JSON.stringify(postPayload, null, 2));

    // Usa sempre /posts/schedule per tutti gli stati
    const response = await fetch(`${PUBLER_BASE_URL}/posts/schedule`, {
      method: 'POST',
      headers: this.getHeaders(credentials.apiKey, credentials.workspaceId),
      body: JSON.stringify(postPayload),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      console.error('[PUBLER] Schedule post failed:', response.status, error);
      throw new Error(error.message || `Errore pubblicazione: ${response.status}`);
    }

    const result = await response.json();
    console.log('[PUBLER] 🎫 Schedule request accepted, job_id:', result.job_id);
    
    // Poll job status per verificare che il post sia stato effettivamente creato
    const jobResult = await this.pollJobStatus(credentials.apiKey, credentials.workspaceId, result.job_id);
    
    return { 
      jobId: result.job_id, 
      success: jobResult.success,
      postIds: jobResult.postIds,
      errors: jobResult.errors 
    };
  }

  private async pollJobStatus(
    apiKey: string, 
    workspaceId: string, 
    jobId: string, 
    maxAttempts: number = 10,
    delayMs: number = 1000
  ): Promise<{ success: boolean; postIds?: string[]; errors?: string[] }> {
    console.log('[PUBLER] 🔎 Starting job status polling for:', jobId);
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
      
      try {
        const response = await fetch(`${PUBLER_BASE_URL}/job_status/${jobId}`, {
          method: 'GET',
          headers: this.getHeaders(apiKey, workspaceId),
        });
        
        if (!response.ok) {
          console.error('[PUBLER] ❌ Job status check failed:', response.status);
          continue;
        }
        
        const jobData = await response.json();
        console.log(`[PUBLER] 📊 Job status (attempt ${attempt}/${maxAttempts}):`, JSON.stringify(jobData, null, 2));
        
        // Verifica stato del job - 'complete' O 'completed' sono entrambi validi
        if (jobData.status === 'completed' || jobData.status === 'complete') {
          console.log('[PUBLER] ✅ Job finished with status:', jobData.status);
          
          const postIds: string[] = [];
          const errors: string[] = [];
          
          // IMPORTANTE: Controlla payload.failures per errori specifici degli account
          if (jobData.payload?.failures) {
            console.log('[PUBLER] ⚠️ Found failures in payload:', JSON.stringify(jobData.payload.failures, null, 2));
            
            for (const [postKey, accountErrors] of Object.entries(jobData.payload.failures)) {
              if (Array.isArray(accountErrors)) {
                for (const err of accountErrors as any[]) {
                  const errorMsg = this.formatAccountError(err);
                  console.error(`[PUBLER] ❌ Account failure [${err.provider}/${err.account_name}]:`, err.message);
                  errors.push(errorMsg);
                }
              }
            }
          }
          
          // Estrai post IDs dai risultati (se presenti)
          if (jobData.results && Array.isArray(jobData.results)) {
            for (const r of jobData.results) {
              console.log('[PUBLER] 📝 Post result:', {
                post_id: r.post_id || r.id,
                account_id: r.account_id,
                status: r.status,
                scheduled_at: r.scheduled_at,
                error: r.error || r.errors
              });
              
              if (r.post_id || r.id) {
                postIds.push(r.post_id || r.id);
              }
              if (r.error || r.errors) {
                errors.push(r.error || JSON.stringify(r.errors));
              }
            }
          }
          
          // Controlla post_ids nel payload
          if (jobData.payload?.post_ids) {
            postIds.push(...jobData.payload.post_ids);
          }
          if (jobData.post_ids) {
            postIds.push(...jobData.post_ids);
          }
          
          const success = errors.length === 0 && postIds.length > 0;
          console.log(`[PUBLER] 📋 Final result: success=${success}, posts=${postIds.length}, errors=${errors.length}`);
          
          return { 
            success, 
            postIds: postIds.length > 0 ? postIds : undefined,
            errors: errors.length > 0 ? errors : undefined 
          };
        }
        
        if (jobData.status === 'failed') {
          console.error('[PUBLER] ❌ Job failed:', jobData.error || jobData.errors);
          return { 
            success: false, 
            errors: [jobData.error || JSON.stringify(jobData.errors) || 'Job failed'] 
          };
        }
        
        // Se ancora pending, continua polling
        console.log(`[PUBLER] ⏳ Job still pending (status: ${jobData.status}), waiting...`);
        
      } catch (err) {
        console.error('[PUBLER] ❌ Error polling job status:', err);
      }
    }
    
    console.warn('[PUBLER] ⚠️ Job polling timeout - max attempts reached');
    return { success: false, errors: ['Job status polling timeout'] };
  }

  private formatAccountError(err: { provider?: string; account_name?: string; message?: string }): string {
    const provider = err.provider || 'unknown';
    const accountName = err.account_name || 'Account';
    const message = err.message || 'Errore sconosciuto';
    
    // Messaggi user-friendly per errori comuni
    if (provider === 'instagram') {
      if (message.includes('compositore') || message.includes('composer')) {
        return `Instagram (${accountName}): Questo account richiede un'immagine o video. Instagram non supporta post solo testo.`;
      }
    }
    
    // Messaggi generici per riconnessione
    if (message.includes('riselezionarlo') || message.includes('aggiorna') || message.includes('refresh')) {
      return `${provider} (${accountName}): Account scollegato. Riconnetti l'account in Publer.`;
    }
    
    return `${provider} (${accountName}): ${message}`;
  }

  async updatePostStatus(
    postId: string, 
    status: 'draft' | 'scheduled' | 'published' | 'failed', 
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

    console.log('[PUBLER] Updating post status:', postId, status);

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
