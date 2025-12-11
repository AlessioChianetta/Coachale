import { db } from '../db';
import { 
  consultantKnowledgeDocuments, 
  consultantKnowledgeApis, 
  consultantKnowledgeApiCache,
  users
} from '@shared/schema';
import { eq, and, desc, sql, ilike, or } from 'drizzle-orm';
import axios from 'axios';
import { decryptForConsultant } from '../encryption';

interface SearchedDocument {
  id: string;
  title: string;
  category: string;
  extractedContent: string;
  priority: number;
}

interface ApiDataResult {
  apiName: string;
  category: string;
  data: any;
  lastSync: Date | null;
}

interface KnowledgeContext {
  documents: SearchedDocument[];
  apiData: ApiDataResult[];
  summary: string;
}

async function getConsultantEncryptionSalt(consultantId: string): Promise<string | null> {
  const [user] = await db
    .select({ encryptionSalt: users.encryptionSalt })
    .from(users)
    .where(eq(users.id, consultantId));
  return user?.encryptionSalt || null;
}

export async function searchKnowledgeDocuments(
  consultantId: string, 
  query: string, 
  limit: number = 10
): Promise<SearchedDocument[]> {
  const queryTerms = query
    .split(/\s+/)
    .filter(term => term.length >= 2)
    .map(term => term.replace(/[%_\\'"]/g, '').toLowerCase())
    .slice(0, 10);
  
  if (queryTerms.length === 0) {
    return [];
  }
  
  const likeConditions = queryTerms.map(term => 
    ilike(consultantKnowledgeDocuments.extractedContent, `%${term}%`)
  );
  
  const titleConditions = queryTerms.map(term =>
    ilike(consultantKnowledgeDocuments.title, `%${term}%`)
  );
  
  const documents = await db
    .select({
      id: consultantKnowledgeDocuments.id,
      title: consultantKnowledgeDocuments.title,
      category: consultantKnowledgeDocuments.category,
      extractedContent: consultantKnowledgeDocuments.extractedContent,
      priority: consultantKnowledgeDocuments.priority,
    })
    .from(consultantKnowledgeDocuments)
    .where(
      and(
        eq(consultantKnowledgeDocuments.consultantId, consultantId),
        eq(consultantKnowledgeDocuments.status, 'indexed'),
        or(...likeConditions, ...titleConditions)
      )
    )
    .orderBy(
      desc(consultantKnowledgeDocuments.priority),
      desc(consultantKnowledgeDocuments.createdAt)
    )
    .limit(limit);
  
  return documents.map(doc => ({
    id: doc.id,
    title: doc.title,
    category: doc.category,
    extractedContent: doc.extractedContent 
      ? doc.extractedContent.substring(0, 500) + (doc.extractedContent.length > 500 ? '...' : '')
      : '',
    priority: doc.priority,
  }));
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

export async function getActiveApiData(consultantId: string): Promise<ApiDataResult[]> {
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
        apiName: api.name,
        category: api.category,
        data,
        lastSync,
      });
    }
  }

  return results;
}

export async function getKnowledgeContext(
  consultantId: string, 
  query?: string
): Promise<KnowledgeContext> {
  const [documents, apiData] = await Promise.all([
    query ? searchKnowledgeDocuments(consultantId, query, 5) : Promise.resolve([]),
    getActiveApiData(consultantId),
  ]);

  const docSummary = documents.length > 0
    ? `${documents.length} documenti trovati: ${documents.map(d => d.title).join(', ')}`
    : 'Nessun documento trovato';

  const apiSummary = apiData.length > 0
    ? `${apiData.length} API attive: ${apiData.map(a => a.apiName).join(', ')}`
    : 'Nessuna API attiva';

  const summary = `Knowledge Base: ${docSummary}. ${apiSummary}.`;

  return {
    documents,
    apiData,
    summary,
  };
}
