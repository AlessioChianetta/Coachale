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
  mediaType?: 'image' | 'video';
  platforms?: Record<string, { type: string; text: string }>;
  accountPlatforms?: { id: string; platform: string }[];
}

interface SchedulePostResult {
  jobId: string;
  success: boolean;
  postIds?: string[];
  errors?: string[];
}

// Mappa identificatori Publer → provider generico per logica content type
function normalizeProvider(publerPlatform: string): string {
  const providerMap: Record<string, string> = {
    // Instagram variants
    'ig_business': 'instagram',
    'ig_personal': 'instagram',
    'instagram': 'instagram',
    // Facebook variants
    'fb_page': 'facebook',
    'fb_group': 'facebook',
    'facebook': 'facebook',
    // LinkedIn variants
    'linkedin': 'linkedin',
    'linkedin_page': 'linkedin',
    // Twitter/X
    'twitter': 'twitter',
    'x': 'twitter',
    // TikTok
    'tiktok': 'tiktok',
    'tiktok_business': 'tiktok',
    // Pinterest
    'pinterest': 'pinterest',
    // YouTube
    'youtube': 'youtube',
    // Telegram
    'telegram': 'telegram',
    // Threads
    'threads': 'threads',
    // Bluesky
    'bluesky': 'bluesky',
    // Google Business
    'google_business': 'google_business',
    'gmb': 'google_business',
  };
  return providerMap[publerPlatform] || publerPlatform;
}

// Get the correct network key for Publer API
// According to official Publer docs, the key in networks should be the provider name
function getNetworkKey(normalizedProvider: string): string {
  const networkKeyMap: Record<string, string> = {
    'instagram': 'instagram',    // Official docs use 'instagram' as network key
    'facebook': 'facebook',      // Official docs use 'facebook'
    'linkedin': 'linkedin',
    'twitter': 'twitter',
    'tiktok': 'tiktok',
    'pinterest': 'pinterest',
    'youtube': 'youtube',
    'telegram': 'telegram',
    'threads': 'threads',
    'bluesky': 'bluesky',
    'google_business': 'google_business',
  };
  return networkKeyMap[normalizedProvider] || normalizedProvider;
}

function getContentType(
  platform: string, 
  hasMedia: boolean, 
  mediaType?: 'image' | 'video', 
  mediaCount?: number
): string {
  // Normalizza l'identificatore Publer al provider generico
  const provider = normalizeProvider(platform);
  
  // Instagram NEVER supports 'status' - always requires media
  // IMPORTANT: Publer API for Instagram uses specific types:
  // - 'photo' for 1 image
  // - 'carousel' for multiple images
  // - 'video' for video content
  if (provider === 'instagram') {
    if (!hasMedia) {
      throw new Error('Instagram richiede almeno un\'immagine o video. Impossibile pubblicare solo testo.');
    }
    if (mediaType === 'video') return 'video';
    if (mediaCount && mediaCount > 1) return 'carousel';
    return 'photo'; // 1 image = 'photo' (NOT 'post')
  }
  
  // Pinterest, YouTube, TikTok don't support text-only
  if (['pinterest', 'youtube', 'tiktok'].includes(provider) && !hasMedia) {
    throw new Error(`${provider} richiede media. Impossibile pubblicare solo testo.`);
  }
  
  if (!hasMedia) return 'status';
  if (mediaType === 'video') return 'video';
  if (mediaCount && mediaCount > 1 && ['facebook', 'pinterest', 'tiktok'].includes(provider)) {
    return 'carousel';
  }
  return 'photo';
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
    
    console.log('[PUBLER] Raw accounts from API:', JSON.stringify(accounts, null, 2));

    await db.delete(publerAccounts).where(eq(publerAccounts.consultantId, consultantId));

    for (const account of accounts) {
      // Publer API returns 'provider' field with the network name (instagram, facebook, etc.)
      // NOT 'type' which is the account type (profile, business, page)
      const platform = account.provider || account.network || account.type;
      console.log(`[PUBLER] Saving account ${account.id}: provider=${account.provider}, type=${account.type}, using platform=${platform}`);
      
      await db.insert(publerAccounts).values({
        id: account.id,
        consultantId,
        platform: platform,
        accountName: account.name,
        accountUsername: account.username,
        profileImageUrl: account.picture || account.profile_image,
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

  async uploadPlaceholderImage(consultantId: string): Promise<PublerMediaResult> {
    const credentials = await this.getDecryptedApiKey(consultantId);
    
    if (!credentials) {
      throw new Error('Publer non configurato');
    }

    // Leggi l'immagine placeholder dal filesystem
    const fs = await import('fs/promises');
    const path = await import('path');
    const placeholderPath = path.join(process.cwd(), 'client', 'public', 'placeholder-social.png');
    
    let fileBuffer: Buffer;
    try {
      fileBuffer = await fs.readFile(placeholderPath);
    } catch (error) {
      throw new Error('Immagine placeholder non trovata');
    }

    const formData = new FormData();
    const blob = new Blob([fileBuffer], { type: 'image/png' });
    formData.append('file', blob, 'placeholder-social.png');
    formData.append('direct_upload', 'true');
    formData.append('in_library', 'true');

    console.log('[PUBLER] Uploading placeholder image...');

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
      console.error('[PUBLER] Placeholder upload failed:', error);
      throw new Error(error.message || `Errore upload placeholder: ${response.status}`);
    }

    const result = await response.json();
    console.log('[PUBLER] Placeholder uploaded successfully:', result.id);
    return result;
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
        .select({ id: publerAccounts.id, platform: publerAccounts.platform })
        .from(publerAccounts)
        .where(eq(publerAccounts.consultantId, consultantId));
      
      accountPlatforms = request.accountIds
        .map(id => {
          const saved = savedAccounts.find(a => a.id === id);
          return saved ? { id, platform: saved.platform } : null;
        })
        .filter((a): a is { id: string; platform: string } => a !== null);
    }

    console.log('[PUBLER] Account platforms resolved:', JSON.stringify(accountPlatforms, null, 2));

    // Guard: se non riusciamo a risolvere alcuna piattaforma, errore
    if (accountPlatforms.length === 0) {
      throw new Error('Impossibile determinare le piattaforme degli account selezionati. Sincronizza gli account dalla pagina Chiavi API.');
    }

    // Verifica se piattaforme che richiedono media sono selezionate
    const hasMedia = request.mediaIds && request.mediaIds.length > 0;
    const mediaCount = request.mediaIds?.length || 0;
    const mediaType = request.mediaType || 'image';
    
    // Check per piattaforme che richiedono media PRIMA di generare networks
    const platformsRequiringMedia = ['instagram', 'pinterest', 'youtube', 'tiktok'];
    for (const account of accountPlatforms) {
      const normalizedPlatform = normalizeProvider(account.platform);
      if (platformsRequiringMedia.includes(normalizedPlatform) && !hasMedia) {
        throw new Error(`${normalizedPlatform.charAt(0).toUpperCase() + normalizedPlatform.slice(1)} richiede almeno un'immagine o video. Per pubblicare solo testo, deseleziona questo account.`);
      }
    }

    // Build media array for networks - use 'photo' for images per Publer docs
    const mediaArray = request.mediaIds?.map(id => ({ 
      id, 
      type: mediaType === 'video' ? 'video' : 'photo'  // Publer uses 'photo' not 'image'
    })) || [];

    // Get unique platforms from selected accounts
    const uniquePlatforms = [...new Set(accountPlatforms.map(a => a.platform))];
    const normalizedPlatforms = [...new Set(uniquePlatforms.map(p => normalizeProvider(p)))];
    console.log('[PUBLER] Unique platforms:', uniquePlatforms);
    console.log('[PUBLER] Normalized platforms:', normalizedPlatforms);

    // Build networks object according to official Publer API docs:
    // - Key is provider name ('instagram', 'facebook', etc.)
    // - Media goes INSIDE networks.{provider}.media (not at post level)
    const networks: Record<string, any> = {};
    for (const platform of normalizedPlatforms) {
      try {
        const contentType = getContentType(platform, hasMedia, mediaType, mediaCount);
        const networkKey = getNetworkKey(platform);
        
        // Build network entry with media INSIDE per official docs
        const networkEntry: any = {
          type: contentType,
          text: request.text
        };
        
        // Add media inside the network entry (official Publer docs structure)
        if (hasMedia && mediaArray.length > 0) {
          networkEntry.media = mediaArray;
        }
        
        networks[networkKey] = networkEntry;
        console.log(`[PUBLER] Network for ${platform} -> key=${networkKey}: type=${contentType}, media_count=${mediaArray.length}`);
      } catch (err: any) {
        console.error(`[PUBLER] Error creating network for ${platform}:`, err.message);
        throw err;
      }
    }
    console.log(`[PUBLER] Networks object:`, JSON.stringify(networks));

    // Determine scheduled_at value based on publish state
    // Per official Publer docs: scheduled_at goes INSIDE each account object
    let scheduledAtValue: string | undefined;
    let apiState: string | number;
    let usePublishEndpoint = false;
    
    if (publerState === 'publish_now') {
      // Per Publer docs: for immediate publish, use /posts/schedule/publish endpoint
      // WITHOUT scheduled_at in accounts
      apiState = 'scheduled';
      usePublishEndpoint = true;
      console.log('[PUBLER] Publish now mode - using /posts/schedule/publish endpoint');
    } else if (publerState === 'draft') {
      apiState = 1; // Draft uses numeric 1
    } else {
      // Scheduled - use user-provided date
      apiState = 'scheduled';
      if (request.scheduledAt) {
        scheduledAtValue = request.scheduledAt.toISOString();
      }
    }

    // Build accounts array per official Publer docs:
    // - scheduled_at goes INSIDE each account object (not at post level)
    const accountsArray = request.accountIds.map(id => {
      const accountEntry: any = { id };
      if (scheduledAtValue) {
        accountEntry.scheduled_at = scheduledAtValue;
      }
      return accountEntry;
    });
    console.log('[PUBLER] Accounts array:', JSON.stringify(accountsArray));

    // Build post entry according to OFFICIAL Publer API docs:
    // - networks contains media inside each provider (networks.instagram.media)
    // - scheduled_at goes inside each account object
    // - NO source/provider/format/media_ids at post level (not documented)
    const postEntry: any = {
      networks,
      accounts: accountsArray
    };
    
    console.log('[PUBLER] Has media:', hasMedia);
    console.log('[PUBLER] Use publish endpoint:', usePublishEndpoint);
    
    const postPayload: any = {
      bulk: {
        state: apiState,
        posts: [postEntry],
      },
    };

    console.log('[PUBLER] ==================== REQUEST PAYLOAD ====================');
    console.log('[PUBLER] Request payload:', JSON.stringify(postPayload, null, 2));
    console.log('[PUBLER] =========================================================');

    // Per official Publer docs:
    // - /posts/schedule for scheduled posts (with scheduled_at in accounts)
    // - /posts/schedule/publish for immediate publishing (without scheduled_at)
    const endpoint = usePublishEndpoint 
      ? `${PUBLER_BASE_URL}/posts/schedule/publish`
      : `${PUBLER_BASE_URL}/posts/schedule`;
    
    console.log('[PUBLER] Using endpoint:', endpoint, '(api_state:', apiState, ', usePublishEndpoint:', usePublishEndpoint, ')');

    const response = await fetch(endpoint, {
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
    // "compositore in stato non valido" = account needs reconnection on Publer
    if (message.includes('compositore') || message.includes('composer') || message.includes('stato non valido')) {
      return `${provider} (${accountName}): Account in stato non valido. Vai su Publer.com, scollega e ricollega questo account, poi riprova.`;
    }
    
    // Messaggi generici per riconnessione
    if (message.includes('riselezionarlo') || message.includes('aggiorna') || message.includes('refresh')) {
      return `${provider} (${accountName}): Account scollegato. Riconnetti l'account su Publer.com.`;
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

  async syncPostStatuses(consultantId: string): Promise<{ updated: number; errors: string[] }> {
    const credentials = await this.getDecryptedApiKey(consultantId);
    if (!credentials) {
      return { updated: 0, errors: ['Publer non configurato'] };
    }

    const { apiKey, workspaceId } = credentials;
    const errors: string[] = [];
    let updated = 0;

    try {
      // Get local posts that have publerPostId and are not yet published
      const localPosts = await db
        .select()
        .from(contentPosts)
        .where(eq(contentPosts.consultantId, consultantId));

      const postsWithPublerId = localPosts.filter(p => p.publerPostId && p.publerStatus !== 'published');
      
      if (postsWithPublerId.length === 0) {
        return { updated: 0, errors: [] };
      }

      // Helper function to fetch all pages of posts with given state
      const fetchAllPostsByState = async (state: 'published' | 'failed'): Promise<Set<string>> => {
        const ids = new Set<string>();
        let page = 1;
        const perPage = 100;
        
        while (true) {
          const url = `${PUBLER_BASE_URL}/posts?state=${state}&per_page=${perPage}&page=${page}`;
          console.log(`[PUBLER SYNC] Fetching ${state} posts: ${url}`);
          
          const response = await fetch(url, {
            headers: {
              'Authorization': `Bearer-API ${apiKey}`,
              'Publer-Workspace-Id': workspaceId,
            },
          });

          if (!response.ok) {
            const errorMsg = `Publer API error (${state}): ${response.status} ${response.statusText}`;
            console.error(`[PUBLER SYNC] ${errorMsg}`);
            errors.push(errorMsg);
            break;
          }

          const data = await response.json();
          const posts = data.posts || data || [];
          
          console.log(`[PUBLER SYNC] Found ${Array.isArray(posts) ? posts.length : 0} ${state} posts on page ${page}`);
          if (Array.isArray(posts) && posts.length > 0) {
            console.log(`[PUBLER SYNC] Sample post IDs: ${posts.slice(0, 5).map((p: any) => p.id).join(', ')}`);
          }
          
          if (Array.isArray(posts)) {
            posts.forEach((p: any) => ids.add(p.id));
          }
          
          // Check if there are more pages
          const totalPages = data.total_pages || 1;
          if (page >= totalPages || (Array.isArray(posts) && posts.length < perPage)) {
            break;
          }
          page++;
        }
        
        return ids;
      };

      // Fetch all published and failed posts with pagination
      const [publishedIds, failedIds] = await Promise.all([
        fetchAllPostsByState('published'),
        fetchAllPostsByState('failed'),
      ]);

      console.log(`[PUBLER SYNC] Total published IDs from Publer: ${publishedIds.size}`);
      console.log(`[PUBLER SYNC] Total failed IDs from Publer: ${failedIds.size}`);
      console.log(`[PUBLER SYNC] Local posts to check: ${postsWithPublerId.map(p => p.publerPostId).join(', ')}`);

      // Update local posts based on Publer status
      for (const post of postsWithPublerId) {
        const publerIds = post.publerPostId?.split(',') || [];
        console.log(`[PUBLER SYNC] Checking post ${post.id} with Publer IDs: ${publerIds.join(', ')}`);
        
        for (const publerId of publerIds) {
          const trimmedId = publerId.trim();
          const isPublished = publishedIds.has(trimmedId);
          const isFailed = failedIds.has(trimmedId);
          console.log(`[PUBLER SYNC] ID ${trimmedId}: published=${isPublished}, failed=${isFailed}`);
          
          if (isPublished) {
            await db
              .update(contentPosts)
              .set({ 
                publerStatus: 'published',
                status: 'published',
              })
              .where(eq(contentPosts.id, post.id));
            updated++;
            console.log(`[PUBLER SYNC] Post ${post.id} marked as published`);
            break;
          } else if (failedIds.has(publerId.trim())) {
            await db
              .update(contentPosts)
              .set({ 
                publerStatus: 'failed',
              })
              .where(eq(contentPosts.id, post.id));
            updated++;
            console.log(`[PUBLER SYNC] Post ${post.id} marked as failed`);
            break;
          }
        }
      }

      return { updated, errors };
    } catch (error: any) {
      console.error('[PUBLER SYNC] Error syncing post statuses:', error);
      errors.push(error.message);
      return { updated, errors };
    }
  }

  async syncAllConsultantsPostStatuses(): Promise<{ consultants: number; totalUpdated: number }> {
    let totalUpdated = 0;
    let consultantCount = 0;

    try {
      // Get all consultants with active Publer config
      const configs = await db
        .select()
        .from(publerConfigs)
        .where(eq(publerConfigs.isActive, true));

      for (const config of configs) {
        try {
          const result = await this.syncPostStatuses(config.consultantId);
          totalUpdated += result.updated;
          consultantCount++;
        } catch (error: any) {
          console.error(`[PUBLER SYNC] Error for consultant ${config.consultantId}:`, error.message);
        }
      }

      console.log(`[PUBLER SYNC] Synced ${consultantCount} consultants, updated ${totalUpdated} posts`);
      return { consultants: consultantCount, totalUpdated };
    } catch (error: any) {
      console.error('[PUBLER SYNC] Global sync error:', error);
      return { consultants: consultantCount, totalUpdated };
    }
  }
}

export const publerService = new PublerService();
