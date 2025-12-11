import { db } from '../db';
import { 
  consultantKnowledgeDocuments, 
  consultantKnowledgeApis, 
  consultantKnowledgeApiCache,
  users
} from '@shared/schema';
import { eq, and, desc, sql } from 'drizzle-orm';
import axios from 'axios';
import { decryptForConsultant } from '../encryption';

interface KnowledgeDocument {
  id: string;
  title: string;
  category: string;
  description: string | null;
  extractedContent: string;
  contentSummary: string | null;
  priority: number;
  usageCount: number;
  lastUsedAt: Date | null;
}

interface ApiDataResult {
  id: string;
  apiName: string;
  category: string;
  description: string | null;
  data: any;
  lastSync: Date | null;
  usageCount: number;
}

interface KnowledgeContext {
  documents: KnowledgeDocument[];
  apiData: ApiDataResult[];
  summary: string;
  totalDocuments: number;
  totalApis: number;
}

async function getConsultantEncryptionSalt(consultantId: string): Promise<string | null> {
  const [user] = await db
    .select({ encryptionSalt: users.encryptionSalt })
    .from(users)
    .where(eq(users.id, consultantId));
  return user?.encryptionSalt || null;
}

/**
 * Carica TUTTI i documenti indicizzati del consulente.
 * L'AI ha SEMPRE accesso a TUTTO il contenuto, non solo ricerca per keyword.
 */
export async function getAllKnowledgeDocuments(
  consultantId: string
): Promise<KnowledgeDocument[]> {
  const documents = await db
    .select({
      id: consultantKnowledgeDocuments.id,
      title: consultantKnowledgeDocuments.title,
      category: consultantKnowledgeDocuments.category,
      description: consultantKnowledgeDocuments.description,
      extractedContent: consultantKnowledgeDocuments.extractedContent,
      contentSummary: consultantKnowledgeDocuments.contentSummary,
      priority: consultantKnowledgeDocuments.priority,
      usageCount: consultantKnowledgeDocuments.usageCount,
      lastUsedAt: consultantKnowledgeDocuments.lastUsedAt,
    })
    .from(consultantKnowledgeDocuments)
    .where(
      and(
        eq(consultantKnowledgeDocuments.consultantId, consultantId),
        eq(consultantKnowledgeDocuments.status, 'indexed')
      )
    )
    .orderBy(
      desc(consultantKnowledgeDocuments.priority),
      desc(consultantKnowledgeDocuments.createdAt)
    );

  return documents.map(doc => ({
    id: doc.id,
    title: doc.title,
    category: doc.category,
    description: doc.description,
    extractedContent: doc.extractedContent || '',
    contentSummary: doc.contentSummary,
    priority: doc.priority,
    usageCount: doc.usageCount,
    lastUsedAt: doc.lastUsedAt,
  }));
}

/**
 * Incrementa il contatore di utilizzo per i documenti usati dall'AI
 */
export async function trackDocumentUsage(documentIds: string[]): Promise<void> {
  if (documentIds.length === 0) return;
  
  const now = new Date();
  for (const docId of documentIds) {
    await db
      .update(consultantKnowledgeDocuments)
      .set({
        usageCount: sql`${consultantKnowledgeDocuments.usageCount} + 1`,
        lastUsedAt: now,
        updatedAt: now,
      })
      .where(eq(consultantKnowledgeDocuments.id, docId));
  }
  console.log(`📊 [Knowledge Tracking] Updated usage for ${documentIds.length} documents`);
}

/**
 * Incrementa il contatore di utilizzo per le API usate dall'AI
 */
export async function trackApiUsage(apiIds: string[]): Promise<void> {
  if (apiIds.length === 0) return;
  
  const now = new Date();
  for (const apiId of apiIds) {
    await db
      .update(consultantKnowledgeApis)
      .set({
        usageCount: sql`${consultantKnowledgeApis.usageCount} + 1`,
        lastUsedAt: now,
        updatedAt: now,
      })
      .where(eq(consultantKnowledgeApis.id, apiId));
  }
  console.log(`📊 [Knowledge Tracking] Updated usage for ${apiIds.length} APIs`);
}

async function syncApiData(
  apiConfig: typeof consultantKnowledgeApis.$inferSelect,
  encryptionSalt: string
): Promise<any> {
  try {
    let headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(apiConfig.requestHeaders as Record<string, string> || {}),
    };

    if (apiConfig.apiKey && apiConfig.authType !== 'none') {
      const decryptedKey = decryptForConsultant(apiConfig.apiKey, encryptionSalt);
      const authConfig = apiConfig.authConfig as any || {};
      
      switch (apiConfig.authType) {
        case 'api_key':
          const headerName = authConfig.headerName || 'X-API-Key';
          headers[headerName] = decryptedKey;
          break;
        case 'bearer':
          headers['Authorization'] = `Bearer ${decryptedKey}`;
          break;
        case 'basic':
          const username = authConfig.username || '';
          const credentials = Buffer.from(`${username}:${decryptedKey}`).toString('base64');
          headers['Authorization'] = `Basic ${credentials}`;
          break;
      }
    }

    const url = `${apiConfig.baseUrl}${apiConfig.defaultEndpoint || ''}`;
    const params = apiConfig.requestParams as Record<string, string> || {};

    const response = apiConfig.requestMethod === 'POST'
      ? await axios.post(url, params, { headers, timeout: 30000 })
      : await axios.get(url, { headers, params, timeout: 30000 });

    let data = response.data;
    
    const dataMapping = apiConfig.dataMapping as any;
    if (dataMapping?.responsePath) {
      const paths = dataMapping.responsePath.split('.');
      for (const path of paths) {
        data = data?.[path];
      }
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + (apiConfig.cacheDurationMinutes * 60 * 1000));

    const existingCache = await db
      .select()
      .from(consultantKnowledgeApiCache)
      .where(
        and(
          eq(consultantKnowledgeApiCache.apiConfigId, apiConfig.id),
          eq(consultantKnowledgeApiCache.cacheKey, 'default')
        )
      )
      .limit(1);

    if (existingCache.length > 0) {
      await db
        .update(consultantKnowledgeApiCache)
        .set({
          cachedData: data,
          expiresAt,
          updatedAt: now,
        })
        .where(eq(consultantKnowledgeApiCache.id, existingCache[0].id));
    } else {
      await db
        .insert(consultantKnowledgeApiCache)
        .values({
          apiConfigId: apiConfig.id,
          consultantId: apiConfig.consultantId,
          cacheKey: 'default',
          cachedData: data,
          expiresAt,
        });
    }

    await db
      .update(consultantKnowledgeApis)
      .set({
        lastSyncAt: now,
        lastSyncStatus: 'success',
        lastSyncError: null,
        updatedAt: now,
      })
      .where(eq(consultantKnowledgeApis.id, apiConfig.id));

    return data;
  } catch (error: any) {
    console.error(`[KnowledgeSearcher] API sync failed for ${apiConfig.name}:`, error.message);
    
    await db
      .update(consultantKnowledgeApis)
      .set({
        lastSyncAt: new Date(),
        lastSyncStatus: 'error',
        lastSyncError: error.message,
        updatedAt: new Date(),
      })
      .where(eq(consultantKnowledgeApis.id, apiConfig.id));

    return null;
  }
}

/**
 * Carica TUTTI i dati delle API attive del consulente.
 * L'AI ha SEMPRE accesso a TUTTE le API configurate.
 */
export async function getAllActiveApiData(consultantId: string): Promise<ApiDataResult[]> {
  const activeApis = await db
    .select()
    .from(consultantKnowledgeApis)
    .where(
      and(
        eq(consultantKnowledgeApis.consultantId, consultantId),
        eq(consultantKnowledgeApis.isActive, true)
      )
    )
    .orderBy(desc(consultantKnowledgeApis.priority));

  if (activeApis.length === 0) {
    return [];
  }

  const encryptionSalt = await getConsultantEncryptionSalt(consultantId);
  const results: ApiDataResult[] = [];
  const now = new Date();

  for (const api of activeApis) {
    const [cache] = await db
      .select()
      .from(consultantKnowledgeApiCache)
      .where(
        and(
          eq(consultantKnowledgeApiCache.apiConfigId, api.id),
          eq(consultantKnowledgeApiCache.cacheKey, 'default')
        )
      )
      .limit(1);

    let data: any = null;
    let lastSync: Date | null = api.lastSyncAt;

    const isCacheValid = cache && new Date(cache.expiresAt) > now;

    if (isCacheValid) {
      data = cache.cachedData;
    } else if (api.autoRefresh && encryptionSalt) {
      data = await syncApiData(api, encryptionSalt);
      if (data) {
        lastSync = new Date();
      }
    } else if (cache) {
      data = cache.cachedData;
    }

    if (data !== null) {
      results.push({
        id: api.id,
        apiName: api.name,
        category: api.category,
        description: api.description,
        data,
        lastSync,
        usageCount: api.usageCount,
      });
    }
  }

  return results;
}

/**
 * Carica TUTTO il contesto della Knowledge Base per l'AI.
 * L'AI ha SEMPRE accesso a TUTTI i documenti e API, indipendentemente dalla query.
 */
export async function getKnowledgeContext(
  consultantId: string, 
  _query?: string // Ignoriamo la query - carichiamo SEMPRE tutto
): Promise<KnowledgeContext> {
  const [documents, apiData] = await Promise.all([
    getAllKnowledgeDocuments(consultantId),
    getAllActiveApiData(consultantId),
  ]);

  const docSummary = documents.length > 0
    ? `${documents.length} documenti disponibili: ${documents.map(d => `"${d.title}" (${d.category})`).join(', ')}`
    : 'Nessun documento caricato';

  const apiSummary = apiData.length > 0
    ? `${apiData.length} API attive: ${apiData.map(a => `"${a.apiName}" (${a.category})`).join(', ')}`
    : 'Nessuna API configurata';

  const summary = `📚 Knowledge Base del Consulente:\n- ${docSummary}\n- ${apiSummary}`;

  console.log(`📚 [Knowledge Base] Loaded ${documents.length} documents and ${apiData.length} APIs for consultant ${consultantId}`);

  return {
    documents,
    apiData,
    summary,
    totalDocuments: documents.length,
    totalApis: apiData.length,
  };
}

/**
 * Genera un riassunto AI per un documento (chiamato manualmente dall'utente)
 */
export async function generateDocumentSummary(
  documentId: string,
  consultantId: string
): Promise<string | null> {
  const [document] = await db
    .select()
    .from(consultantKnowledgeDocuments)
    .where(
      and(
        eq(consultantKnowledgeDocuments.id, documentId),
        eq(consultantKnowledgeDocuments.consultantId, consultantId)
      )
    )
    .limit(1);

  if (!document || !document.extractedContent) {
    return null;
  }

  // Il riassunto verrà generato dall'AI service quando l'utente attiva lo switch
  return document.extractedContent.substring(0, 500);
}

/**
 * Abilita/disabilita il riassunto per un documento
 */
export async function toggleDocumentSummary(
  documentId: string,
  consultantId: string,
  enabled: boolean,
  summary?: string
): Promise<boolean> {
  const updateData: any = {
    updatedAt: new Date(),
  };

  if (enabled && summary) {
    updateData.contentSummary = summary;
  } else if (!enabled) {
    updateData.contentSummary = null;
  }

  const result = await db
    .update(consultantKnowledgeDocuments)
    .set(updateData)
    .where(
      and(
        eq(consultantKnowledgeDocuments.id, documentId),
        eq(consultantKnowledgeDocuments.consultantId, consultantId)
      )
    );

  return true;
}
