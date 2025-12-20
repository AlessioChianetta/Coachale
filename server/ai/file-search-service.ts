/**
 * Gemini File Search Service
 * 
 * Implements Google's File Search API for advanced RAG functionality.
 * File Search enables semantic retrieval over uploaded documents with:
 * - Automatic chunking and embedding generation
 * - Semantic vector search
 * - Automatic citations in responses
 * 
 * Architecture:
 * - Each consultant has their own FileSearchStore for their documents
 * - Each client has access to their consultant's store + system-wide documents
 * - Documents are automatically synced when uploaded to knowledge base
 * 
 * @see https://ai.google.dev/gemini-api/docs/file-search
 */

import { GoogleGenAI } from "@google/genai";
import { db } from "../db";
import { fileSearchStores, fileSearchDocuments, users } from "../../shared/schema";
import { eq, and, desc, inArray, or } from "drizzle-orm";
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import { getSuperAdminGeminiKeys } from "./provider-factory";

export interface ChunkingConfig {
  maxTokensPerChunk: number;
  maxOverlapTokens: number;
}

export interface FileSearchUploadResult {
  success: boolean;
  fileId?: string;
  error?: string;
  storeName?: string;
}

export interface FileSearchStoreInfo {
  id: string;
  name: string;
  displayName: string;
  documentCount: number;
  createdAt: Date;
  ownerId: string;
  ownerType: 'consultant' | 'client' | 'system' | 'whatsapp_agent';
}

export interface FileSearchDocumentInfo {
  id: string;
  storeId: string;
  googleFileId: string;
  fileName: string;
  displayName: string;
  mimeType: string;
  status: 'pending' | 'processing' | 'indexed' | 'failed';
  uploadedAt: Date;
  sourceType: 'library' | 'knowledge_base' | 'manual';
  sourceId?: string;
}

export interface Citation {
  sourceTitle: string;
  sourceId?: string;
  content: string;
  startIndex?: number;
  endIndex?: number;
}

const DEFAULT_CHUNKING_CONFIG: ChunkingConfig = {
  maxTokensPerChunk: 400,
  maxOverlapTokens: 40,
};

export class FileSearchService {
  private envClient: GoogleGenAI | null = null;
  private envApiKey: string | null = null;

  constructor() {
    this.envApiKey = process.env.GEMINI_API_KEY || null;
    if (this.envApiKey) {
      this.envClient = new GoogleGenAI({ apiKey: this.envApiKey });
      const keyPreview = this.envApiKey.substring(0, 10) + '...' + this.envApiKey.substring(this.envApiKey.length - 4);
      console.log(`🔑 [FileSearch] Environment fallback initialized: ${keyPreview}`);
    } else {
      console.log(`ℹ️ [FileSearch] No GEMINI_API_KEY in env - will use 3-tier key system`);
    }
  }

  /**
   * Get GoogleGenAI client for a specific user using 3-tier priority system:
   * 1. SuperAdmin keys (if available and user.useSuperadminGemini !== false)
   * 2. User's own keys (user.geminiApiKeys)
   * 3. Environment fallback (process.env.GEMINI_API_KEY)
   * 
   * NOTE: File Search API requires Google AI Studio keys. If the key doesn't support
   * fileSearchStores, we fall back to the environment key which is known to work.
   */
  async getClientForUser(userId?: string): Promise<GoogleGenAI | null> {
    if (!userId) {
      return this.envClient;
    }

    try {
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (!user) {
        console.warn(`⚠️ [FileSearch] User ${userId} not found, falling back to env key`);
        return this.envClient;
      }

      // Priority 1: SuperAdmin keys (if user opted in)
      if (user.useSuperadminGemini !== false) {
        const superAdminKeys = await getSuperAdminGeminiKeys();
        if (superAdminKeys && superAdminKeys.keys.length > 0) {
          const index = Math.floor(Math.random() * superAdminKeys.keys.length);
          const apiKey = superAdminKeys.keys[index];
          const testClient = new GoogleGenAI({ apiKey });
          
          if (testClient.fileSearchStores) {
            console.log(`✅ [FileSearch] Using SuperAdmin Gemini key for user ${userId} (${index + 1}/${superAdminKeys.keys.length})`);
            return testClient;
          } else {
            console.warn(`⚠️ [FileSearch] SuperAdmin key does not support File Search API, falling back to env key`);
          }
        }
      }

      // Priority 2: User's own API keys
      const apiKeys = user.geminiApiKeys || [];
      if (apiKeys.length > 0) {
        const currentIndex = user.geminiApiKeyIndex || 0;
        const validIndex = currentIndex % apiKeys.length;
        const apiKey = apiKeys[validIndex];
        const testClient = new GoogleGenAI({ apiKey });
        
        if (testClient.fileSearchStores) {
          console.log(`✅ [FileSearch] Using user's own Gemini key for user ${userId}`);
          return testClient;
        } else {
          console.warn(`⚠️ [FileSearch] User key does not support File Search API, falling back to env key`);
        }
      }

      // Priority 3: Environment fallback
      if (this.envClient) {
        console.log(`✅ [FileSearch] Using env GEMINI_API_KEY fallback for user ${userId}`);
        return this.envClient;
      }

      console.error(`❌ [FileSearch] No Gemini API key available for user ${userId}`);
      return null;
    } catch (error: any) {
      console.error(`❌ [FileSearch] Error getting client for user ${userId}:`, error.message);
      return this.envClient;
    }
  }

  /**
   * Check if at least one source of API keys is available
   */
  async isApiKeyConfigured(userId?: string): Promise<boolean> {
    // Check env key first
    if (this.envApiKey) {
      return true;
    }

    // Check superadmin keys
    const superAdminKeys = await getSuperAdminGeminiKeys();
    if (superAdminKeys && superAdminKeys.keys.length > 0) {
      return true;
    }

    // Check user's own keys if userId provided
    if (userId) {
      try {
        const [user] = await db
          .select()
          .from(users)
          .where(eq(users.id, userId))
          .limit(1);
        
        if (user && user.geminiApiKeys && user.geminiApiKeys.length > 0) {
          return true;
        }
      } catch {
        // Ignore errors
      }
    }

    return false;
  }

  private ensureClient(): GoogleGenAI {
    if (!this.envClient) {
      throw new Error('File Search Service: No Gemini API key configured. Set GEMINI_API_KEY environment variable or configure SuperAdmin/User keys.');
    }
    return this.envClient;
  }

  /**
   * Create a new FileSearchStore for an owner (consultant, client, or system)
   */
  async createStore(params: {
    displayName: string;
    ownerId: string;
    ownerType: 'consultant' | 'client' | 'system' | 'whatsapp_agent';
    description?: string;
  }): Promise<{ success: boolean; storeId?: string; storeName?: string; error?: string }> {
    const client = this.ensureClient();
    
    try {
      console.log(`🔍 [FileSearch] Creating store for ${params.ownerType} ${params.ownerId}: "${params.displayName}"`);
      
      const store = await client.fileSearchStores.create({
        config: {
          displayName: params.displayName,
        }
      });

      if (!store?.name) {
        throw new Error('Failed to create FileSearchStore - no name returned');
      }

      const [dbStore] = await db.insert(fileSearchStores).values({
        googleStoreName: store.name,
        displayName: params.displayName,
        description: params.description || null,
        ownerId: params.ownerId,
        ownerType: params.ownerType,
        documentCount: 0,
        isActive: true,
      }).returning();

      console.log(`✅ [FileSearch] Store created: ${store.name} (DB ID: ${dbStore.id})`);
      
      return {
        success: true,
        storeId: dbStore.id,
        storeName: store.name,
      };
    } catch (error: any) {
      console.error(`❌ [FileSearch] Failed to create store:`, error);
      return {
        success: false,
        error: error.message || 'Unknown error creating store',
      };
    }
  }

  /**
   * Upload a file directly to a FileSearchStore
   */
  async uploadDocument(params: {
    filePath: string;
    displayName: string;
    storeId: string;
    sourceType: 'library' | 'knowledge_base' | 'manual';
    sourceId?: string;
    chunkingConfig?: ChunkingConfig;
    customMetadata?: {
      docType?: string;
      category?: string;
      moduleId?: string;
      yearId?: string;
      trimesterId?: string;
      lessonId?: string;
      tags?: string[];
    };
  }): Promise<FileSearchUploadResult> {
    const client = this.ensureClient();
    
    try {
      const store = await db.query.fileSearchStores.findFirst({
        where: eq(fileSearchStores.id, params.storeId),
      });

      if (!store) {
        return { success: false, error: `Store ${params.storeId} not found` };
      }

      console.log(`📤 [FileSearch] Uploading "${params.displayName}" to store ${store.googleStoreName}`);

      const fileContent = await fs.readFile(params.filePath);
      const mimeType = this.getMimeType(params.filePath);

      const chunkConfig = params.chunkingConfig || DEFAULT_CHUNKING_CONFIG;

      let operation = await client.fileSearchStores.uploadToFileSearchStore({
        file: params.filePath,
        fileSearchStoreName: store.googleStoreName,
        config: {
          displayName: params.displayName,
          chunkingConfig: {
            whiteSpaceConfig: {
              maxTokensPerChunk: chunkConfig.maxTokensPerChunk,
              maxOverlapTokens: chunkConfig.maxOverlapTokens,
            }
          }
        }
      });

      // Poll for operation completion
      // SDK expects: client.operations.get({ operation }) where operation is the object returned
      let attempts = 0;
      const maxAttempts = 60;
      while (!operation.done && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 2000));
        attempts++;
        
        try {
          // Pass the full operation object as per Google GenAI SDK
          operation = await client.operations.get({ operation });
          
          if (attempts % 10 === 0) {
            console.log(`⏳ [FileSearch] Upload in progress... (attempt ${attempts}/${maxAttempts})`);
          }
        } catch (pollError: any) {
          // Log but continue - sometimes polling can temporarily fail
          console.warn(`⚠️ [FileSearch] Polling attempt ${attempts} warning:`, pollError.message);
          
          // If we've had too many consecutive errors, break
          if (attempts >= 5 && !operation.done) {
            console.error(`❌ [FileSearch] Too many polling errors, stopping`);
            break;
          }
        }
      }

      if (!operation.done) {
        return { success: false, error: 'Upload operation timed out' };
      }

      const googleFileId = (operation as any).result?.name || `file-${Date.now()}`;

      const [dbDoc] = await db.insert(fileSearchDocuments).values({
        storeId: params.storeId,
        googleFileId: googleFileId,
        fileName: path.basename(params.filePath),
        displayName: params.displayName,
        mimeType: mimeType,
        status: 'indexed',
        sourceType: params.sourceType,
        sourceId: params.sourceId || null,
        chunkingConfig: chunkConfig,
        customMetadata: params.customMetadata || null,
      }).returning();

      await db.update(fileSearchStores)
        .set({ documentCount: (store.documentCount || 0) + 1 })
        .where(eq(fileSearchStores.id, params.storeId));

      console.log(`✅ [FileSearch] Document uploaded: ${googleFileId} (DB ID: ${dbDoc.id})`);

      return {
        success: true,
        fileId: dbDoc.id,
        storeName: store.googleStoreName,
      };
    } catch (error: any) {
      console.error(`❌ [FileSearch] Upload failed:`, error);
      return {
        success: false,
        error: error.message || 'Unknown error uploading document',
      };
    }
  }

  /**
   * Calculate content hash for incremental sync
   */
  private calculateContentHash(content: string): string {
    return crypto.createHash('sha256').update(content, 'utf8').digest('hex').substring(0, 16);
  }

  /**
   * Check if document needs re-upload (content changed)
   */
  async needsReupload(sourceType: string, sourceId: string, contentHash: string): Promise<boolean> {
    const existingDoc = await db.query.fileSearchDocuments.findFirst({
      where: and(
        eq(fileSearchDocuments.sourceType, sourceType),
        eq(fileSearchDocuments.sourceId, sourceId),
        eq(fileSearchDocuments.status, 'indexed')
      ),
    });

    if (!existingDoc) return true;
    if (!existingDoc.contentHash) return true;
    return existingDoc.contentHash !== contentHash;
  }

  /**
   * Upload document from text content (for library documents already in DB)
   */
  async uploadDocumentFromContent(params: {
    content: string;
    displayName: string;
    storeId: string;
    sourceType: 'library' | 'knowledge_base' | 'exercise' | 'consultation' | 'university' | 'university_lesson' | 'financial_data' | 'manual';
    sourceId?: string;
    clientId?: string;
    userId?: string;
    chunkingConfig?: ChunkingConfig;
    skipHashCheck?: boolean;
    customMetadata?: {
      docType?: string;
      category?: string;
      moduleId?: string;
      yearId?: string;
      trimesterId?: string;
      lessonId?: string;
      tags?: string[];
    };
  }): Promise<FileSearchUploadResult> {
    const contentHash = this.calculateContentHash(params.content);
    const contentSize = params.content.length;
    
    if (!params.skipHashCheck && params.sourceId) {
      const needsUpload = await this.needsReupload(params.sourceType, params.sourceId, contentHash);
      if (!needsUpload) {
        console.log(`⏭️ [FileSearch] Skipping upload - content unchanged: ${params.displayName} (hash: ${contentHash})`);
        return { success: true, fileId: 'unchanged', storeName: '' };
      }
    }
    
    const tempFilePath = path.join('/tmp', `filesearch-${Date.now()}.txt`);
    
    try {
      await fs.writeFile(tempFilePath, params.content, 'utf-8');
      
      const result = await this.uploadDocumentWithHash({
        filePath: tempFilePath,
        displayName: params.displayName,
        storeId: params.storeId,
        sourceType: params.sourceType,
        sourceId: params.sourceId,
        clientId: params.clientId,
        userId: params.userId,
        contentHash,
        contentSize,
        chunkingConfig: params.chunkingConfig,
        customMetadata: params.customMetadata,
      });

      return result;
    } finally {
      try {
        await fs.unlink(tempFilePath);
      } catch {
      }
    }
  }

  /**
   * Upload document with hash tracking (internal method)
   * Now uses getClientForUser to support 3-tier key system (SuperAdmin -> User -> Environment)
   */
  private async uploadDocumentWithHash(params: {
    filePath: string;
    displayName: string;
    storeId: string;
    sourceType: string;
    sourceId?: string;
    clientId?: string;
    userId?: string;
    contentHash: string;
    contentSize: number;
    chunkingConfig?: ChunkingConfig;
    customMetadata?: {
      docType?: string;
      category?: string;
      moduleId?: string;
      yearId?: string;
      trimesterId?: string;
      lessonId?: string;
      tags?: string[];
    };
  }): Promise<FileSearchUploadResult> {
    const client = await this.getClientForUser(params.userId);
    if (!client) {
      return { success: false, error: 'FileSearch client not available (no API key configured - check SuperAdmin, User, or Environment keys)' };
    }

    try {
      const store = await db.query.fileSearchStores.findFirst({
        where: eq(fileSearchStores.id, params.storeId),
      });

      if (!store) {
        return { success: false, error: `Store ${params.storeId} not found` };
      }

      if (params.sourceId) {
        await db.delete(fileSearchDocuments).where(
          and(
            eq(fileSearchDocuments.sourceType, params.sourceType),
            eq(fileSearchDocuments.sourceId, params.sourceId)
          )
        );
      }

      console.log(`📤 [FileSearch] Uploading "${params.displayName}" (hash: ${params.contentHash}) to store ${store.googleStoreName}`);

      const chunkConfig = params.chunkingConfig || DEFAULT_CHUNKING_CONFIG;

      let operation = await client.fileSearchStores.uploadToFileSearchStore({
        file: params.filePath,
        fileSearchStoreName: store.googleStoreName,
        config: {
          displayName: params.displayName,
          chunkingConfig: {
            whiteSpaceConfig: {
              maxTokensPerChunk: chunkConfig.maxTokensPerChunk,
              maxOverlapTokens: chunkConfig.maxOverlapTokens,
            }
          }
        }
      });

      let attempts = 0;
      const maxAttempts = 60;
      while (!operation.done && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 2000));
        attempts++;
        try {
          operation = await client.operations.get({ operation });
        } catch (pollError: any) {
          console.warn(`⚠️ [FileSearch] Polling attempt ${attempts} warning:`, pollError.message);
          if (attempts >= 5 && !operation.done) break;
        }
      }

      if (!operation.done) {
        return { success: false, error: 'Upload operation timed out' };
      }

      const googleFileId = (operation as any).result?.name || `file-${Date.now()}`;

      const [dbDoc] = await db.insert(fileSearchDocuments).values({
        storeId: params.storeId,
        googleFileId: googleFileId,
        fileName: path.basename(params.filePath),
        displayName: params.displayName,
        mimeType: 'text/plain',
        status: 'indexed',
        sourceType: params.sourceType as any,
        sourceId: params.sourceId || null,
        clientId: params.clientId || null,
        contentHash: params.contentHash,
        contentSize: params.contentSize,
        chunkingConfig: chunkConfig,
        customMetadata: params.customMetadata || null,
        indexedAt: new Date(),
        lastModifiedAt: new Date(),
      }).returning();

      await db.update(fileSearchStores)
        .set({ documentCount: (store.documentCount || 0) + 1 })
        .where(eq(fileSearchStores.id, params.storeId));

      console.log(`✅ [FileSearch] Document uploaded: ${googleFileId} (hash: ${params.contentHash})`);

      return {
        success: true,
        fileId: dbDoc.id,
        storeName: store.googleStoreName,
      };
    } catch (error: any) {
      console.error(`❌ [FileSearch] Upload with hash failed:`, error);
      return {
        success: false,
        error: error.message || 'Unknown error uploading document',
      };
    }
  }

  /**
   * Delete a document from a FileSearchStore
   */
  async deleteDocument(documentId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const doc = await db.query.fileSearchDocuments.findFirst({
        where: eq(fileSearchDocuments.id, documentId),
      });

      if (!doc) {
        return { success: false, error: 'Document not found' };
      }

      await db.delete(fileSearchDocuments).where(eq(fileSearchDocuments.id, documentId));

      await db.update(fileSearchStores)
        .set({ documentCount: Math.max(0, (await this.getStore(doc.storeId))?.documentCount || 1) - 1 })
        .where(eq(fileSearchStores.id, doc.storeId));

      console.log(`🗑️ [FileSearch] Document deleted: ${documentId}`);

      return { success: true };
    } catch (error: any) {
      console.error(`❌ [FileSearch] Delete failed:`, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get store by ID
   */
  async getStore(storeId: string): Promise<FileSearchStoreInfo | null> {
    const store = await db.query.fileSearchStores.findFirst({
      where: eq(fileSearchStores.id, storeId),
    });

    if (!store) return null;

    return {
      id: store.id,
      name: store.googleStoreName,
      displayName: store.displayName,
      documentCount: store.documentCount || 0,
      createdAt: store.createdAt!,
      ownerId: store.ownerId,
      ownerType: store.ownerType as 'consultant' | 'client' | 'system',
    };
  }

  /**
   * Get stores for a user (consultant or client)
   * 
   * Edge cases handled:
   * - Pure consultant: returns their own stores
   * - Pure client: returns their consultant's stores (via consultantId)
   * - Mixed consultant+client: returns BOTH their own stores AND parent consultant's stores
   */
  async getStoresForUser(userId: string, userRole: 'consultant' | 'client', consultantId?: string): Promise<FileSearchStoreInfo[]> {
    const conditions = [];

    if (userRole === 'consultant') {
      // Always include consultant's own stores
      conditions.push(
        and(
          eq(fileSearchStores.ownerId, userId),
          eq(fileSearchStores.ownerType, 'consultant'),
          eq(fileSearchStores.isActive, true)
        )
      );
      
      // FIX: If consultant ALSO has a consultantId (meaning they're also a client),
      // include their parent consultant's stores too
      if (consultantId && consultantId !== userId) {
        conditions.push(
          and(
            eq(fileSearchStores.ownerId, consultantId),
            eq(fileSearchStores.ownerType, 'consultant'),
            eq(fileSearchStores.isActive, true)
          )
        );
      }
    } else if (userRole === 'client' && consultantId) {
      // Pure client: include their consultant's stores
      conditions.push(
        and(
          eq(fileSearchStores.ownerId, consultantId),
          eq(fileSearchStores.ownerType, 'consultant'),
          eq(fileSearchStores.isActive, true)
        )
      );
    } else {
      // Fallback: just look for user's own stores
      conditions.push(
        and(
          eq(fileSearchStores.ownerId, userId),
          eq(fileSearchStores.ownerType, userRole),
          eq(fileSearchStores.isActive, true)
        )
      );
    }

    const stores = await db.query.fileSearchStores.findMany({
      where: conditions.length > 1 ? or(...conditions) : conditions[0],
      orderBy: [desc(fileSearchStores.createdAt)],
    });

    // Deduplicate by store id (in case same store matched multiple conditions)
    const uniqueStores = stores.reduce((acc, store) => {
      if (!acc.find(s => s.id === store.id)) {
        acc.push(store);
      }
      return acc;
    }, [] as typeof stores);

    return uniqueStores.map(store => ({
      id: store.id,
      name: store.googleStoreName,
      displayName: store.displayName,
      documentCount: store.documentCount || 0,
      createdAt: store.createdAt!,
      ownerId: store.ownerId,
      ownerType: store.ownerType as 'consultant' | 'client' | 'system',
    }));
  }

  /**
   * Get Google FileSearchStore names for AI generation
   * Returns the Google store names that should be passed to generateContent
   * 
   * Logic:
   * - Consultants: their own stores + system stores
   * - Clients: their consultant's stores + system stores
   * - Mixed (consultant who is also a client): BOTH their own stores AND their parent consultant's stores
   * 
   * Edge cases handled:
   * - Pure consultant (no client profile): only their own stores + system
   * - Pure client: only their consultant's stores + system
   * - Mixed consultant+client (like Fernando): BOTH stores + system, deduplicated
   */
  async getStoreNamesForGeneration(userId: string, userRole: 'consultant' | 'client', consultantId?: string): Promise<string[]> {
    const conditions = [];
    
    // User-specific stores (consultant or their consultant for clients)
    if (userRole === 'consultant') {
      // Always include consultant's own stores
      conditions.push(
        and(
          eq(fileSearchStores.ownerId, userId),
          eq(fileSearchStores.ownerType, 'consultant'),
          eq(fileSearchStores.isActive, true)
        )
      );
      
      // FIX: If consultant ALSO has a consultantId (meaning they're also a client of another consultant),
      // include their parent consultant's stores too
      if (consultantId && consultantId !== userId) {
        conditions.push(
          and(
            eq(fileSearchStores.ownerId, consultantId),
            eq(fileSearchStores.ownerType, 'consultant'),
            eq(fileSearchStores.isActive, true)
          )
        );
        console.log(`🔗 [FileSearch] Consultant ${userId} is also a client of ${consultantId} - including both stores`);
      }
    } else if (userRole === 'client' && consultantId) {
      // Pure client: include their consultant's stores
      conditions.push(
        and(
          eq(fileSearchStores.ownerId, consultantId),
          eq(fileSearchStores.ownerType, 'consultant'),
          eq(fileSearchStores.isActive, true)
        )
      );
      
      // FIX: Also include client's own private store (where exercises and consultations are indexed)
      conditions.push(
        and(
          eq(fileSearchStores.ownerId, userId),
          eq(fileSearchStores.ownerType, 'client'),
          eq(fileSearchStores.isActive, true)
        )
      );
      console.log(`🔐 [FileSearch] Including client's private store for user ${userId}`);
    }

    // Always include system-wide stores
    conditions.push(
      and(
        eq(fileSearchStores.ownerType, 'system'),
        eq(fileSearchStores.isActive, true)
      )
    );

    // Use OR to combine all conditions
    const stores = await db.query.fileSearchStores.findMany({
      where: conditions.length > 1 ? or(...conditions) : conditions[0],
    });

    // Deduplicate store names (in case the same store is matched by multiple conditions)
    const uniqueStoreNames = [...new Set(stores.map(store => store.googleStoreName))];

    console.log(`🔍 [FileSearch] getStoreNamesForGeneration - Role: ${userRole}, UserId: ${userId}, ConsultantId: ${consultantId || 'N/A'}`);
    console.log(`   📦 Found ${uniqueStoreNames.length} unique stores: ${stores.map(s => s.displayName).join(', ') || 'nessuno'}`);

    return uniqueStoreNames;
  }

  /**
   * Get documents in a store
   */
  async getDocumentsInStore(storeId: string): Promise<FileSearchDocumentInfo[]> {
    const docs = await db.query.fileSearchDocuments.findMany({
      where: eq(fileSearchDocuments.storeId, storeId),
      orderBy: [desc(fileSearchDocuments.uploadedAt)],
    });

    return docs.map(doc => ({
      id: doc.id,
      storeId: doc.storeId,
      googleFileId: doc.googleFileId,
      fileName: doc.fileName,
      displayName: doc.displayName,
      mimeType: doc.mimeType,
      status: doc.status as 'pending' | 'processing' | 'indexed' | 'failed',
      uploadedAt: doc.uploadedAt!,
      sourceType: doc.sourceType as 'library' | 'knowledge_base' | 'exercise' | 'consultation' | 'university' | 'university_lesson' | 'financial_data' | 'manual',
      sourceId: doc.sourceId || undefined,
      contentHash: doc.contentHash || undefined,
      clientId: doc.clientId || undefined,
    }));
  }

  /**
   * Check if a document is already indexed
   */
  async isDocumentIndexed(sourceType: 'library' | 'knowledge_base' | 'exercise' | 'consultation' | 'university' | 'university_lesson' | 'financial_data' | 'manual', sourceId: string): Promise<boolean> {
    const doc = await db.query.fileSearchDocuments.findFirst({
      where: and(
        eq(fileSearchDocuments.sourceType, sourceType),
        eq(fileSearchDocuments.sourceId, sourceId),
        eq(fileSearchDocuments.status, 'indexed')
      ),
    });

    return !!doc;
  }

  /**
   * Parse citations from Gemini response
   */
  parseCitations(response: any): Citation[] {
    const citations: Citation[] = [];
    
    try {
      const candidates = response?.candidates || [];
      for (const candidate of candidates) {
        const groundingMetadata = candidate?.groundingMetadata;
        if (groundingMetadata?.groundingChunks) {
          for (const chunk of groundingMetadata.groundingChunks) {
            if (chunk.retrievedContext) {
              citations.push({
                sourceTitle: chunk.retrievedContext.title || 'Unknown Source',
                sourceId: chunk.retrievedContext.uri,
                content: chunk.retrievedContext.text || '',
              });
            }
          }
        }
        
        const citationMetadata = candidate?.citationMetadata;
        if (citationMetadata?.citationSources) {
          for (const source of citationMetadata.citationSources) {
            citations.push({
              sourceTitle: source.uri || 'Source',
              content: '',
              startIndex: source.startIndex,
              endIndex: source.endIndex,
            });
          }
        }
      }
    } catch (error) {
      console.warn('[FileSearch] Error parsing citations:', error);
    }

    return citations;
  }

  /**
   * Get MIME type from file extension
   */
  private getMimeType(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes: Record<string, string> = {
      '.txt': 'text/plain',
      '.md': 'text/markdown',
      '.pdf': 'application/pdf',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.doc': 'application/msword',
      '.csv': 'text/csv',
      '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      '.xls': 'application/vnd.ms-excel',
      '.json': 'application/json',
      '.html': 'text/html',
      '.htm': 'text/html',
    };
    return mimeTypes[ext] || 'application/octet-stream';
  }

  /**
   * Build FileSearch tool configuration for generateContent
   */
  buildFileSearchTool(storeNames: string[]): any {
    if (storeNames.length === 0) {
      return null;
    }

    return {
      fileSearch: {
        fileSearchStoreNames: storeNames,
      }
    };
  }

  /**
   * Get GoogleGenAI client (for internal use)
   * @deprecated Use getClientForUser(userId) for proper 3-tier key selection
   */
  getClient(): GoogleGenAI | null {
    return this.envClient;
  }

  /**
   * Get or create a PRIVATE FileSearchStore for a client
   * 
   * Each client has their own private store where ONLY their personal data is indexed.
   * This ensures complete privacy - Client A's data is never accessible to Client B.
   * 
   * @param clientId - The client's user ID
   * @param consultantId - The consultant's user ID (for reference/association)
   * @returns Store ID and name, or null if creation fails
   */
  async getOrCreateClientStore(clientId: string, consultantId: string): Promise<{ storeId: string; storeName: string } | null> {
    try {
      // Check if client already has a private store
      let clientStore = await db.query.fileSearchStores.findFirst({
        where: and(
          eq(fileSearchStores.ownerId, clientId),
          eq(fileSearchStores.ownerType, 'client'),
          eq(fileSearchStores.isActive, true),
        ),
      });

      if (clientStore) {
        console.log(`📦 [FileSearch] Found existing client store for ${clientId}: ${clientStore.googleStoreName}`);
        return {
          storeId: clientStore.id,
          storeName: clientStore.googleStoreName,
        };
      }

      // Create new private store for the client
      console.log(`🔐 [FileSearch] Creating PRIVATE store for client ${clientId}`);
      
      const result = await this.createStore({
        displayName: `Private Store - Client ${clientId.substring(0, 8)}`,
        ownerId: clientId,
        ownerType: 'client',
        description: `Store privato per dati personali del cliente. Consultant: ${consultantId}`,
      });

      if (!result.success || !result.storeId) {
        console.error(`❌ [FileSearch] Failed to create client store: ${result.error}`);
        return null;
      }

      console.log(`✅ [FileSearch] Created PRIVATE client store: ${result.storeName} (ID: ${result.storeId})`);
      
      return {
        storeId: result.storeId,
        storeName: result.storeName!,
      };
    } catch (error: any) {
      console.error(`❌ [FileSearch] Error in getOrCreateClientStore:`, error);
      return null;
    }
  }

  /**
   * Get store names for a client (includes their private store + consultant's public store)
   */
  async getStoreNamesForClient(clientId: string, consultantId: string): Promise<string[]> {
    const conditions = [];
    
    // Client's private store
    conditions.push(
      and(
        eq(fileSearchStores.ownerId, clientId),
        eq(fileSearchStores.ownerType, 'client'),
        eq(fileSearchStores.isActive, true)
      )
    );
    
    // Consultant's store (public/shared content like templates and library)
    conditions.push(
      and(
        eq(fileSearchStores.ownerId, consultantId),
        eq(fileSearchStores.ownerType, 'consultant'),
        eq(fileSearchStores.isActive, true)
      )
    );

    // System-wide stores
    conditions.push(
      and(
        eq(fileSearchStores.ownerType, 'system'),
        eq(fileSearchStores.isActive, true)
      )
    );

    const stores = await db.query.fileSearchStores.findMany({
      where: or(...conditions),
    });

    console.log(`🔍 [FileSearch] getStoreNamesForClient - ClientId: ${clientId}, ConsultantId: ${consultantId}`);
    console.log(`   📦 Found ${stores.length} stores: ${stores.map(s => `${s.displayName} (${s.ownerType})`).join(', ') || 'nessuno'}`);

    return stores.map(store => store.googleStoreName);
  }
}

export const fileSearchService = new FileSearchService();
