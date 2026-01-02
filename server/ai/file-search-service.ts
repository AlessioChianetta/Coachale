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
import { fileSearchStores, fileSearchDocuments, users, consultantWhatsappConfig } from "../../shared/schema";
import { eq, and, desc, inArray, or, sql } from "drizzle-orm";
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
  sourceType: 'library' | 'knowledge_base' | 'manual' | 'consultant_guide';
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
  constructor() {
    console.log(`ℹ️ [FileSearch] Service initialized - using database keys only (SuperAdmin or User)`);
  }

  /**
   * Resolve the correct user ID to use for API credentials based on store type.
   * This handles the ownership chain for different store types:
   * - consultant: Use store.ownerId directly (it's the consultant's userId)
   * - client: Look up the client's consultant via users.consultantId
   * - whatsapp_agent: Look up the agent's consultant via consultantWhatsappConfig
   * - system: Return null (will use SuperAdmin fallback)
   * 
   * @param store - The FileSearchStore
   * @param requestingUserId - Optional explicit userId to use (takes precedence)
   * @returns The resolved userId to use for API credentials
   */
  async resolveStoreCredentialOwner(
    store: { ownerId: string; ownerType: string },
    requestingUserId?: string
  ): Promise<string | null> {
    // If explicit userId provided, use it
    if (requestingUserId) {
      return requestingUserId;
    }

    try {
      switch (store.ownerType) {
        case 'consultant':
          // ownerId is the consultant's userId
          return store.ownerId;

        case 'client':
          // ownerId is a client userId, look up their consultant
          const [clientUser] = await db
            .select({ consultantId: users.consultantId })
            .from(users)
            .where(eq(users.id, store.ownerId))
            .limit(1);
          
          if (clientUser?.consultantId) {
            return clientUser.consultantId;
          }
          console.warn(`⚠️ [FileSearch] Client ${store.ownerId} has no consultantId, falling back to SuperAdmin`);
          return null;

        case 'whatsapp_agent':
          // ownerId is an agent config ID, look up the consultant
          const [agentConfig] = await db
            .select({ consultantId: consultantWhatsappConfig.consultantId })
            .from(consultantWhatsappConfig)
            .where(eq(consultantWhatsappConfig.id, store.ownerId))
            .limit(1);
          
          if (agentConfig?.consultantId) {
            return agentConfig.consultantId;
          }
          console.warn(`⚠️ [FileSearch] Agent config ${store.ownerId} not found, falling back to SuperAdmin`);
          return null;

        case 'system':
          // System stores use SuperAdmin keys
          return null;

        default:
          console.warn(`⚠️ [FileSearch] Unknown ownerType: ${store.ownerType}, falling back to SuperAdmin`);
          return null;
      }
    } catch (error: any) {
      console.error(`❌ [FileSearch] Error resolving store credential owner:`, error.message);
      return null;
    }
  }

  /**
   * Get GoogleGenAI client for a specific user using 2-tier priority system:
   * 1. SuperAdmin keys (if available and user.useSuperadminGemini !== false)
   * 2. User's own keys (user.geminiApiKeys) - for clients, also check consultant's keys
   * 
   * NOTE: No environment fallback - keys must come from database only
   * File Search API requires Google AI Studio keys with v1beta API version.
   */
  async getClientForUser(userId?: string): Promise<GoogleGenAI | null> {
    if (!userId) {
      console.warn(`⚠️ [FileSearch] No userId provided, cannot retrieve API keys`);
      return null;
    }

    try {
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (!user) {
        console.error(`❌ [FileSearch] User ${userId} not found`);
        return null;
      }

      // Priority 1: SuperAdmin keys (if user opted in)
      if (user.useSuperadminGemini !== false) {
        const superAdminKeys = await getSuperAdminGeminiKeys();
        if (superAdminKeys && superAdminKeys.keys.length > 0) {
          // Use random key for load balancing (same as provider-factory.ts)
          const index = Math.floor(Math.random() * superAdminKeys.keys.length);
          const apiKey = superAdminKeys.keys[index];
          console.log(`✅ [FileSearch] Using SuperAdmin Gemini key for user ${userId} (${index + 1}/${superAdminKeys.keys.length})`);
          // File Search API requires v1beta
          return new GoogleGenAI({ apiKey, apiVersion: 'v1beta' });
        }
      }

      // Priority 2: User's own API keys
      const apiKeys = user.geminiApiKeys || [];
      if (apiKeys.length > 0) {
        const currentIndex = user.geminiApiKeyIndex || 0;
        const validIndex = currentIndex % apiKeys.length;
        const apiKey = apiKeys[validIndex];
        console.log(`✅ [FileSearch] Using user's own Gemini key for user ${userId}`);
        // File Search API requires v1beta
        return new GoogleGenAI({ apiKey, apiVersion: 'v1beta' });
      }

      // Priority 3: If user is a client, try consultant's keys
      if (user.role === 'client' && user.consultantId) {
        const [consultant] = await db
          .select()
          .from(users)
          .where(eq(users.id, user.consultantId))
          .limit(1);
        
        if (consultant) {
          const consultantKeys = consultant.geminiApiKeys || [];
          if (consultantKeys.length > 0) {
            const index = Math.floor(Math.random() * consultantKeys.length);
            const apiKey = consultantKeys[index];
            console.log(`✅ [FileSearch] Using consultant's Gemini key for client ${userId} (${index + 1}/${consultantKeys.length})`);
            // File Search API requires v1beta
            return new GoogleGenAI({ apiKey, apiVersion: 'v1beta' });
          }
        }
      }

      console.error(`❌ [FileSearch] No Gemini API key available for user ${userId}. Configure keys in /consultant/api-keys-unified`);
      return null;
    } catch (error: any) {
      console.error(`❌ [FileSearch] Error getting client for user ${userId}:`, error.message);
      return null;
    }
  }

  /**
   * Check if at least one source of API keys is available (database only)
   */
  async isApiKeyConfigured(userId?: string): Promise<boolean> {
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
        
        // If user is a client, check consultant's keys
        if (user && user.role === 'client' && user.consultantId) {
          const [consultant] = await db
            .select()
            .from(users)
            .where(eq(users.id, user.consultantId))
            .limit(1);
          
          if (consultant && consultant.geminiApiKeys && consultant.geminiApiKeys.length > 0) {
            return true;
          }
        }
      } catch {
        // Ignore errors
      }
    }

    return false;
  }

  /**
   * Get a client using the 2-tier priority system (async version for operations)
   * Priority: SuperAdmin keys → User keys (no environment fallback)
   */
  private async ensureClientAsync(userId?: string): Promise<GoogleGenAI> {
    // If userId is provided, try to get a client for that user (uses 2-tier system)
    if (userId) {
      const client = await this.getClientForUser(userId);
      if (client) {
        return client;
      }
    }
    
    // Try SuperAdmin keys as fallback
    const superAdminKeys = await getSuperAdminGeminiKeys();
    if (superAdminKeys && superAdminKeys.keys.length > 0) {
      const index = Math.floor(Math.random() * superAdminKeys.keys.length);
      const apiKey = superAdminKeys.keys[index];
      console.log(`🔑 [FileSearch] Using SuperAdmin Gemini key ${index + 1}/${superAdminKeys.keys.length} for operation`);
      // File Search API requires v1beta
      return new GoogleGenAI({ apiKey, apiVersion: 'v1beta' });
    }
    
    throw new Error('File Search Service: No Gemini API key configured. Configure keys in /consultant/api-keys-unified (SuperAdmin or User keys).');
  }

  /**
   * Create a new FileSearchStore for an owner (consultant, client, or system)
   * @param params.userId - Optional userId to use for 3-tier API key resolution
   */
  async createStore(params: {
    displayName: string;
    ownerId: string;
    ownerType: 'consultant' | 'client' | 'system' | 'whatsapp_agent';
    description?: string;
    userId?: string;
  }): Promise<{ success: boolean; storeId?: string; storeName?: string; error?: string }> {
    const client = await this.ensureClientAsync(params.userId);
    
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
   * @param params.userId - Optional userId for 3-tier API key resolution
   */
  async uploadDocument(params: {
    filePath: string;
    displayName: string;
    storeId: string;
    sourceType: 'library' | 'knowledge_base' | 'manual' | 'consultant_guide';
    sourceId?: string;
    userId?: string;
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
    const client = await this.ensureClientAsync(params.userId);
    
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
      const maxAttempts = 240; // 8 minutes timeout (240 * 2s = 480s)
      while (!operation.done && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 2000));
        attempts++;
        
        try {
          // Pass the full operation object as per Google GenAI SDK
          operation = await client.operations.get({ operation });
          
          if (attempts % 15 === 0) {
            console.log(`⏳ [FileSearch] Upload in progress... (attempt ${attempts}/${maxAttempts}, ~${Math.round(attempts * 2 / 60)}min)`);
          }
        } catch (pollError: any) {
          // Log but continue - sometimes polling can temporarily fail
          console.warn(`⚠️ [FileSearch] Polling attempt ${attempts} warning:`, pollError.message);
          
          // If we've had too many consecutive errors, break
          if (attempts >= 10 && !operation.done) {
            console.error(`❌ [FileSearch] Too many polling errors, stopping`);
            break;
          }
        }
      }

      if (!operation.done) {
        return { success: false, error: 'Upload operation timed out' };
      }

      // Extract Google File ID from operation result
      const opResult = (operation as any).result;
      const opMetadata = (operation as any).metadata;
      
      let googleFileId = opResult?.name || opResult?.file?.name || opMetadata?.file?.name;
      
      if (!googleFileId && typeof opResult === 'string') {
        googleFileId = opResult;
      }
      
      if (!googleFileId) {
        const opName = (operation as any).name;
        if (opName && typeof opName === 'string') {
          googleFileId = opName.includes('/') ? opName.split('/').pop() : opName;
        }
      }
      
      if (!googleFileId) {
        googleFileId = `file-${Date.now()}`;
        console.error(`❌ [FileSearch] CRITICAL: Using timestamp fallback for googleFileId.`);
      }

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
    sourceType: 'library' | 'knowledge_base' | 'client_knowledge' | 'exercise' | 'consultation' | 'university' | 'university_lesson' | 'financial_data' | 'manual' | 'consultant_guide' | 'exercise_external_doc';
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
    try {
      const client = await this.ensureClientAsync(params.userId);
      
      // Debug: Log client properties
      console.log(`🔍 [FileSearch] Client type: ${typeof client}, has fileSearchStores: ${!!client?.fileSearchStores}`);
      if (!client?.fileSearchStores) {
        console.error(`❌ [FileSearch] Client missing fileSearchStores. Client keys: ${Object.keys(client || {}).join(', ')}`);
        return { success: false, error: 'GoogleGenAI client does not have fileSearchStores property' };
      }
      
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
      const maxAttempts = 240; // 8 minutes timeout (240 * 2s = 480s)
      while (!operation.done && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 2000));
        attempts++;
        try {
          operation = await client.operations.get({ operation });
          if (attempts % 15 === 0) {
            console.log(`⏳ [FileSearch] Upload in progress... (attempt ${attempts}/${maxAttempts}, ~${Math.round(attempts * 2 / 60)}min)`);
          }
        } catch (pollError: any) {
          console.warn(`⚠️ [FileSearch] Polling attempt ${attempts} warning:`, pollError.message);
          if (attempts >= 10 && !operation.done) break;
        }
      }

      if (!operation.done) {
        return { success: false, error: 'Upload operation timed out' };
      }

      // Extract Google File ID from operation result
      // The ID can be in different locations depending on the API response structure
      const opResult = (operation as any).result;
      const opMetadata = (operation as any).metadata;
      
      // Try multiple possible locations for the file ID
      let googleFileId = opResult?.name || opResult?.file?.name || opMetadata?.file?.name;
      
      // If still no ID, check if the result itself is a string (some APIs return the name directly)
      if (!googleFileId && typeof opResult === 'string') {
        googleFileId = opResult;
      }
      
      // Use operation name as fallback (Google API no longer returns googleFileId in result)
      if (!googleFileId) {
        const opName = (operation as any).name;
        if (opName && typeof opName === 'string') {
          // Extract document ID from operation name like "operations/abc123" or use full name
          googleFileId = opName.includes('/') ? opName.split('/').pop() : opName;
        }
      }
      
      // Final fallback - but log it prominently
      if (!googleFileId) {
        googleFileId = `file-${Date.now()}`;
        console.error(`❌ [FileSearch] CRITICAL: Using timestamp fallback for googleFileId. This will cause 404 errors on future updates.`);
      }

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
   * First deletes from Google API, then from local database
   * 
   * @param documentId - The document ID to delete
   * @param requestingUserId - Optional userId to use for API credentials (for consultant deleting from client/agent stores)
   */
  async deleteDocument(documentId: string, requestingUserId?: string): Promise<{ success: boolean; error?: string }> {
    try {
      const doc = await db.query.fileSearchDocuments.findFirst({
        where: eq(fileSearchDocuments.id, documentId),
      });
      if (!doc) return { success: false, error: 'Document not found' };

      const store = await db.query.fileSearchStores.findFirst({
        where: eq(fileSearchStores.id, doc.storeId),
      });
      if (!store) return { success: false, error: 'Store not found' };

      // Resolve the correct user ID for API credentials
      const credentialOwnerId = await this.resolveStoreCredentialOwner(store, requestingUserId);
      const ai = await this.getClientForUser(credentialOwnerId || undefined);
      
      if (ai) {
        try {
          const documentName = `fileSearchStores/${store.googleStoreName}/documents/${doc.googleFileId}`;
          await ai.fileSearchStores.documents.delete({ name: documentName, config: { force: true } });
          console.log(`🗑️ [FileSearch] Deleted from Google: ${documentName}`);
        } catch (googleError: any) {
          const errorMessage = typeof googleError.message === 'string' ? googleError.message : JSON.stringify(googleError.message || googleError);
          const isNotFound = errorMessage.toLowerCase().includes('not found') || 
                             errorMessage.includes('404') ||
                             googleError.status === 404 ||
                             googleError.code === 404;
          
          if (!isNotFound) {
            console.error(`❌ [FileSearch] Google delete failed:`, errorMessage);
            return { success: false, error: `Google API error: ${errorMessage}` };
          }
          console.log(`🧹 [FileSearch] Document not on Google - cleaning up local record only`);
        }
      } else {
        console.warn(`⚠️ [FileSearch] No API client available, deleting from DB only`);
      }

      await db.delete(fileSearchDocuments).where(eq(fileSearchDocuments.id, documentId));
      
      await db.update(fileSearchStores)
        .set({ documentCount: Math.max(0, (store.documentCount || 1) - 1) })
        .where(eq(fileSearchStores.id, doc.storeId));

      console.log(`🗑️ [FileSearch] Document deleted: ${documentId}`);
      return { success: true };
    } catch (error: any) {
      console.error(`❌ [FileSearch] Delete failed:`, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Reconcile documents by source type - removes orphaned documents
   * that no longer exist in the source system
   * 
   * @param storeId - The FileSearchStore ID
   * @param sourceType - The source type to reconcile (e.g., 'whatsapp_agent_knowledge')
   * @param validSourceIds - Array of source IDs that should exist (empty = remove all)
   * @param requestingUserId - Optional userId to use for API credentials when deleting
   * @returns Reconciliation results
   */
  async reconcileBySourceType(
    storeId: string, 
    sourceType: string, 
    validSourceIds: string[],
    requestingUserId?: string
  ): Promise<{ removed: number; errors: string[] }> {
    try {
      let orphanedDocs;
      if (validSourceIds.length === 0) {
        orphanedDocs = await db
          .select()
          .from(fileSearchDocuments)
          .where(and(
            eq(fileSearchDocuments.storeId, storeId),
            eq(fileSearchDocuments.sourceType, sourceType as any)
          ));
      } else {
        orphanedDocs = await db
          .select()
          .from(fileSearchDocuments)
          .where(and(
            eq(fileSearchDocuments.storeId, storeId),
            eq(fileSearchDocuments.sourceType, sourceType as any),
            sql`${fileSearchDocuments.sourceId} IS NOT NULL`,
            sql`${fileSearchDocuments.sourceId} NOT IN (${sql.join(validSourceIds.map(id => sql`${id}`), sql`, `)})`
          ));
      }

      if (orphanedDocs.length === 0) {
        return { removed: 0, errors: [] };
      }

      console.log(`🧹 [FileSearch] Reconciling ${orphanedDocs.length} orphaned ${sourceType} documents`);

      let removed = 0;
      const errors: string[] = [];

      for (const doc of orphanedDocs) {
        const result = await this.deleteDocument(doc.id, requestingUserId);
        if (result.success) {
          removed++;
        } else {
          errors.push(`Failed to delete ${doc.id}: ${result.error}`);
        }
      }

      console.log(`🧹 [FileSearch] Reconciliation complete: ${removed}/${orphanedDocs.length} removed`);
      return { removed, errors };
    } catch (error: any) {
      console.error(`❌ [FileSearch] Reconciliation failed:`, error);
      return { removed: 0, errors: [error.message] };
    }
  }

  /**
   * Delete a document by its source type and source ID
   * Useful when deleting the original source (e.g., KB document, lesson) and need to remove from FileSearch
   * 
   * @param sourceType - The type of source (e.g., 'library', 'knowledge_base', 'university_lesson')
   * @param sourceId - The ID of the source document
   * @param requestingUserId - Optional userId to use for API credentials
   * @returns Result with success status and optional error
   */
  async deleteDocumentBySource(
    sourceType: string,
    sourceId: string,
    requestingUserId?: string
  ): Promise<{ success: boolean; deleted: number; errors: string[] }> {
    try {
      // Find both exact match and chunked documents (sourceId_chunk_*)
      const docs = await db
        .select()
        .from(fileSearchDocuments)
        .where(and(
          eq(fileSearchDocuments.sourceType, sourceType as any),
          or(
            eq(fileSearchDocuments.sourceId, sourceId),
            sql`${fileSearchDocuments.sourceId} LIKE ${sourceId + '_chunk_%'}`
          )
        ));

      if (docs.length === 0) {
        console.log(`ℹ️ [FileSearch] No documents found for sourceType=${sourceType}, sourceId=${sourceId}`);
        return { success: true, deleted: 0, errors: [] };
      }

      console.log(`🗑️ [FileSearch] Deleting ${docs.length} document(s) for sourceType=${sourceType}, sourceId=${sourceId}`);

      let deleted = 0;
      const errors: string[] = [];

      for (const doc of docs) {
        const result = await this.deleteDocument(doc.id, requestingUserId);
        if (result.success) {
          deleted++;
        } else {
          errors.push(`Failed to delete ${doc.id}: ${result.error}`);
        }
      }

      console.log(`🗑️ [FileSearch] Deleted ${deleted}/${docs.length} documents by source`);
      return { success: errors.length === 0, deleted, errors };
    } catch (error: any) {
      console.error(`❌ [FileSearch] Delete by source failed:`, error);
      return { success: false, deleted: 0, errors: [error.message] };
    }
  }

  /**
   * List documents directly from Google FileSearch API
   * This allows verifying what actually exists on Google vs local DB
   * 
   * @param storeName - The Google store name (e.g., 'consultant_xyz_store')
   * @param userId - User ID to get API client
   * @returns List of documents from Google API
   */
  async listDocumentsFromGoogle(
    storeName: string,
    userId: string
  ): Promise<{ success: boolean; documents: Array<{ name: string; displayName?: string; createTime?: string }>; error?: string }> {
    try {
      const ai = await this.getClientForUser(userId);
      if (!ai) {
        return { success: false, documents: [], error: 'No AI client available' };
      }

      const fullStoreName = `fileSearchStores/${storeName}`;
      const documents: Array<{ name: string; displayName?: string; createTime?: string }> = [];

      try {
        const response = await ai.fileSearchStores.documents.list({ parent: fullStoreName });
        
        if (response && Array.isArray(response)) {
          for (const doc of response) {
            documents.push({
              name: doc.name || '',
              displayName: doc.displayName,
              createTime: doc.createTime,
            });
          }
        }
      } catch (listError: any) {
        if (listError.message?.includes('not found')) {
          console.log(`⚠️ [FileSearch] Store ${storeName} not found on Google`);
          return { success: true, documents: [] };
        }
        throw listError;
      }

      console.log(`📋 [FileSearch] Listed ${documents.length} documents from Google store: ${storeName}`);
      return { success: true, documents };
    } catch (error: any) {
      console.error(`❌ [FileSearch] List from Google failed:`, error);
      return { success: false, documents: [], error: error.message };
    }
  }

  /**
   * Audit a FileSearchStore comparing local DB vs Google API
   * Identifies discrepancies: documents only in DB, only on Google, or in both
   * 
   * @param storeId - The local store ID
   * @param requestingUserId - Optional userId to use for API key resolution (useful when consultant audits client's store)
   * @returns Audit results with categorized documents
   */
  async auditStoreVsGoogle(storeId: string, requestingUserId?: string): Promise<{
    success: boolean;
    storeName: string;
    dbDocuments: number;
    googleDocuments: number;
    onlyInDb: Array<{ id: string; fileName: string; googleFileId: string; sourceType: string }>;
    onlyOnGoogle: Array<{ name: string; displayName?: string }>;
    inBoth: number;
    error?: string;
  }> {
    try {
      const store = await db.query.fileSearchStores.findFirst({
        where: eq(fileSearchStores.id, storeId),
      });

      if (!store) {
        return {
          success: false,
          storeName: '',
          dbDocuments: 0,
          googleDocuments: 0,
          onlyInDb: [],
          onlyOnGoogle: [],
          inBoth: 0,
          error: 'Store not found',
        };
      }

      // Get documents from local DB
      const dbDocs = await db
        .select()
        .from(fileSearchDocuments)
        .where(eq(fileSearchDocuments.storeId, storeId));

      // Get documents from Google - use requesting user's keys if available (for consultant auditing client stores)
      const apiUserId = requestingUserId || store.ownerId;
      const googleResult = await this.listDocumentsFromGoogle(store.googleStoreName, apiUserId);
      if (!googleResult.success) {
        return {
          success: false,
          storeName: store.googleStoreName,
          dbDocuments: dbDocs.length,
          googleDocuments: 0,
          onlyInDb: [],
          onlyOnGoogle: [],
          inBoth: 0,
          error: googleResult.error,
        };
      }

      // Create sets for comparison
      const dbGoogleFileIds = new Set(dbDocs.map(d => d.googleFileId));
      const googleFileNames = new Set(googleResult.documents.map(d => {
        // Extract file ID from full name: fileSearchStores/xxx/documents/FILE_ID
        const parts = d.name.split('/');
        return parts[parts.length - 1];
      }));

      // Find documents only in DB
      const onlyInDb = dbDocs
        .filter(d => !googleFileNames.has(d.googleFileId))
        .map(d => ({
          id: d.id,
          fileName: d.fileName,
          googleFileId: d.googleFileId,
          sourceType: d.sourceType,
        }));

      // Find documents only on Google
      const onlyOnGoogle = googleResult.documents.filter(d => {
        const parts = d.name.split('/');
        const fileId = parts[parts.length - 1];
        return !dbGoogleFileIds.has(fileId);
      });

      // Count documents in both
      const inBoth = dbDocs.length - onlyInDb.length;

      console.log(`📊 [FileSearch] Audit complete for store ${store.googleStoreName}:`);
      console.log(`   DB: ${dbDocs.length}, Google: ${googleResult.documents.length}`);
      console.log(`   Only in DB: ${onlyInDb.length}, Only on Google: ${onlyOnGoogle.length}, In both: ${inBoth}`);

      return {
        success: true,
        storeName: store.googleStoreName,
        dbDocuments: dbDocs.length,
        googleDocuments: googleResult.documents.length,
        onlyInDb,
        onlyOnGoogle,
        inBoth,
      };
    } catch (error: any) {
      console.error(`❌ [FileSearch] Audit failed:`, error);
      return {
        success: false,
        storeName: '',
        dbDocuments: 0,
        googleDocuments: 0,
        onlyInDb: [],
        onlyOnGoogle: [],
        inBoth: 0,
        error: error.message,
      };
    }
  }

  /**
   * Cleanup orphaned documents that exist on Google but not in local DB
   * This removes documents from Google that shouldn't be there
   * 
   * @param storeId - The local store ID
   * @param requestingUserId - Optional userId to use for API key resolution (useful when consultant cleans client's store)
   * @returns Cleanup results
   */
  async cleanupOrphansOnGoogle(storeId: string, requestingUserId?: string): Promise<{
    success: boolean;
    removed: number;
    errors: string[];
  }> {
    try {
      const audit = await this.auditStoreVsGoogle(storeId, requestingUserId);
      if (!audit.success) {
        return { success: false, removed: 0, errors: [audit.error || 'Audit failed'] };
      }

      if (audit.onlyOnGoogle.length === 0) {
        console.log(`✅ [FileSearch] No orphaned documents on Google for store ${audit.storeName}`);
        return { success: true, removed: 0, errors: [] };
      }

      console.log(`🧹 [FileSearch] Cleaning up ${audit.onlyOnGoogle.length} orphaned documents from Google`);

      const store = await db.query.fileSearchStores.findFirst({
        where: eq(fileSearchStores.id, storeId),
      });

      if (!store) {
        return { success: false, removed: 0, errors: ['Store not found'] };
      }

      // Use requesting user's keys if available (for consultant cleaning client stores)
      const apiUserId = requestingUserId || store.ownerId;
      const ai = await this.getClientForUser(apiUserId);
      if (!ai) {
        return { success: false, removed: 0, errors: ['No AI client available'] };
      }

      let removed = 0;
      const errors: string[] = [];

      for (const doc of audit.onlyOnGoogle) {
        try {
          await ai.fileSearchStores.documents.delete({ name: doc.name, config: { force: true } });
          removed++;
          console.log(`🗑️ [FileSearch] Deleted orphan from Google: ${doc.name}`);
        } catch (deleteError: any) {
          if (!deleteError.message?.includes('not found')) {
            errors.push(`Failed to delete ${doc.name}: ${deleteError.message}`);
          } else {
            removed++; // Already gone, count as success
          }
        }
      }

      console.log(`🧹 [FileSearch] Cleanup complete: ${removed}/${audit.onlyOnGoogle.length} removed`);
      return { success: errors.length === 0, removed, errors };
    } catch (error: any) {
      console.error(`❌ [FileSearch] Cleanup failed:`, error);
      return { success: false, removed: 0, errors: [error.message] };
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
      
      // PRIVACY FIX: Include ALL client private stores for this consultant
      // This allows consultants to search across all their clients' consultations,
      // exercise responses, and other private data that's now properly isolated
      // Get clients for this consultant and include their stores
      const consultantClients = await db.query.users.findMany({
        where: eq(users.consultantId, userId),
        columns: { id: true },
      });
      
      if (consultantClients.length > 0) {
        const clientIds = consultantClients.map(c => c.id);
        conditions.push(
          and(
            inArray(fileSearchStores.ownerId, clientIds),
            eq(fileSearchStores.ownerType, 'client'),
            eq(fileSearchStores.isActive, true)
          )
        );
        console.log(`🔐 [FileSearch] Consultant ${userId} - including ${clientIds.length} client private stores`);
      }
      
      // If consultant ALSO has a consultantId (meaning they're also a client of another consultant),
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
    } else if (userRole === 'client') {
      // PRIVACY ISOLATION: Client sees ONLY their own private store
      // All assigned content (exercises, library docs, lessons) is copied to client's store
      // Client NEVER sees consultant's store directly - this ensures perfect privacy
      conditions.push(
        and(
          eq(fileSearchStores.ownerId, userId),
          eq(fileSearchStores.ownerType, 'client'),
          eq(fileSearchStores.isActive, true)
        )
      );
      console.log(`🔐 [FileSearch] ISOLATION MODE: Client ${userId} sees ONLY their private store`);
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
   * Get detailed breakdown of stores and documents for AI generation logging
   * Returns store names + detailed category breakdown for console output
   */
  async getStoreBreakdownForGeneration(userId: string, userRole: 'consultant' | 'client', consultantId?: string): Promise<{
    storeNames: string[];
    breakdown: Array<{
      storeName: string;
      storeDisplayName: string;
      ownerType: string;
      categories: Record<string, number>;
      totalDocs: number;
    }>;
  }> {
    const conditions = [];
    
    if (userRole === 'consultant') {
      conditions.push(
        and(
          eq(fileSearchStores.ownerId, userId),
          eq(fileSearchStores.ownerType, 'consultant'),
          eq(fileSearchStores.isActive, true)
        )
      );
      
      const consultantClients = await db.query.users.findMany({
        where: eq(users.consultantId, userId),
        columns: { id: true, firstName: true, lastName: true },
      });
      
      if (consultantClients.length > 0) {
        const clientIds = consultantClients.map(c => c.id);
        conditions.push(
          and(
            inArray(fileSearchStores.ownerId, clientIds),
            eq(fileSearchStores.ownerType, 'client'),
            eq(fileSearchStores.isActive, true)
          )
        );
      }
      
      if (consultantId && consultantId !== userId) {
        conditions.push(
          and(
            eq(fileSearchStores.ownerId, consultantId),
            eq(fileSearchStores.ownerType, 'consultant'),
            eq(fileSearchStores.isActive, true)
          )
        );
      }
    } else if (userRole === 'client') {
      conditions.push(
        and(
          eq(fileSearchStores.ownerId, userId),
          eq(fileSearchStores.ownerType, 'client'),
          eq(fileSearchStores.isActive, true)
        )
      );
    }

    conditions.push(
      and(
        eq(fileSearchStores.ownerType, 'system'),
        eq(fileSearchStores.isActive, true)
      )
    );

    const stores = await db.query.fileSearchStores.findMany({
      where: conditions.length > 1 ? or(...conditions) : conditions[0],
    });

    const breakdown: Array<{
      storeName: string;
      storeDisplayName: string;
      ownerType: string;
      categories: Record<string, number>;
      categoryTokens: Record<string, number>;
      totalDocs: number;
      totalTokens: number;
    }> = [];

    for (const store of stores) {
      const docs = await db.query.fileSearchDocuments.findMany({
        where: and(
          eq(fileSearchDocuments.storeId, store.id),
          eq(fileSearchDocuments.status, 'indexed')
        ),
      });

      const categories: Record<string, number> = {};
      const categoryTokens: Record<string, number> = {};
      let totalTokens = 0;
      
      for (const doc of docs) {
        const cat = doc.sourceType || 'other';
        categories[cat] = (categories[cat] || 0) + 1;
        
        // Convert contentSize (chars/bytes) to estimated tokens (1 token ≈ 4 chars)
        const docTokens = doc.contentSize ? Math.ceil(doc.contentSize / 4) : 0;
        categoryTokens[cat] = (categoryTokens[cat] || 0) + docTokens;
        totalTokens += docTokens;
      }

      breakdown.push({
        storeName: store.googleStoreName,
        storeDisplayName: store.displayName,
        ownerType: store.ownerType,
        categories,
        categoryTokens,
        totalDocs: docs.length,
        totalTokens,
      });
    }

    const uniqueStoreNames = [...new Set(stores.map(store => store.googleStoreName))];

    return { storeNames: uniqueStoreNames, breakdown };
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
      sourceType: doc.sourceType as 'library' | 'knowledge_base' | 'client_knowledge' | 'exercise' | 'consultation' | 'university' | 'university_lesson' | 'financial_data' | 'manual' | 'consultant_guide' | 'exercise_external_doc',
      sourceId: doc.sourceId || undefined,
      contentHash: doc.contentHash || undefined,
      clientId: doc.clientId || undefined,
    }));
  }

  /**
   * Check if a document is already indexed
   * Also checks for chunked documents (sourceId_chunk_0, sourceId_chunk_1, etc.)
   */
  async isDocumentIndexed(sourceType: 'library' | 'knowledge_base' | 'client_knowledge' | 'exercise' | 'consultation' | 'university' | 'university_lesson' | 'financial_data' | 'manual' | 'consultant_guide' | 'exercise_external_doc', sourceId: string): Promise<boolean> {
    // First check for exact match (non-chunked document)
    const doc = await db.query.fileSearchDocuments.findFirst({
      where: and(
        eq(fileSearchDocuments.sourceType, sourceType),
        eq(fileSearchDocuments.sourceId, sourceId),
        eq(fileSearchDocuments.status, 'indexed')
      ),
    });

    if (doc) {
      return true;
    }

    // Check for chunked document (at least chunk 0 exists)
    const chunkDoc = await db.query.fileSearchDocuments.findFirst({
      where: and(
        eq(fileSearchDocuments.sourceType, sourceType),
        eq(fileSearchDocuments.sourceId, `${sourceId}_chunk_0`),
        eq(fileSearchDocuments.status, 'indexed')
      ),
    });

    return !!chunkDoc;
  }

  /**
   * Get document index info including indexedAt and contentHash
   * Used for staleness detection during sync
   */
  async getDocumentIndexInfo(sourceType: 'library' | 'knowledge_base' | 'client_knowledge' | 'exercise' | 'consultation' | 'university' | 'university_lesson' | 'financial_data' | 'manual' | 'consultant_guide' | 'exercise_external_doc', sourceId: string): Promise<{
    exists: boolean;
    documentId?: string;
    indexedAt?: Date;
    contentHash?: string;
  }> {
    const doc = await db.query.fileSearchDocuments.findFirst({
      where: and(
        eq(fileSearchDocuments.sourceType, sourceType),
        eq(fileSearchDocuments.sourceId, sourceId),
        eq(fileSearchDocuments.status, 'indexed')
      ),
    });

    if (!doc) {
      return { exists: false };
    }

    return {
      exists: true,
      documentId: doc.id,
      indexedAt: doc.indexedAt ?? undefined,
      contentHash: doc.contentHash ?? undefined,
    };
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
   * Note: Google File Search has a limit of 5 corpora (stores) max
   */
  buildFileSearchTool(storeNames: string[]): any {
    if (storeNames.length === 0) {
      return null;
    }

    // Google File Search limit: max 5 corpora
    const MAX_STORES = 5;
    const limitedStoreNames = storeNames.slice(0, MAX_STORES);
    
    if (storeNames.length > MAX_STORES) {
      console.warn(`⚠️ [FileSearch] Limiting stores from ${storeNames.length} to ${MAX_STORES} (Google API limit)`);
    }

    return {
      fileSearch: {
        fileSearchStoreNames: limitedStoreNames,
      }
    };
  }

  /**
   * Get GoogleGenAI client (for internal use)
   * @deprecated Use getClientForUser(userId) for proper 2-tier key selection
   */
  getClient(): GoogleGenAI | null {
    console.warn(`⚠️ [FileSearch] getClient() is deprecated - use getClientForUser(userId) instead`);
    return null;
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

  /**
   * Find documents in FileSearch that no longer have their source record
   * These are "source orphans" - documents whose original source (knowledge document,
   * exercise, etc.) was deleted but the FileSearch document still exists
   */
  async findSourceOrphans(storeId: string): Promise<{
    success: boolean;
    orphans: Array<{
      id: string;
      fileName: string;
      googleFileId: string;
      sourceType: string;
      sourceId: string | null;
    }>;
    error?: string;
  }> {
    try {
      const { consultantKnowledgeDocuments, clientKnowledgeDocuments, whatsappAgentKnowledgeItems, consultantExercises, consultations, libraryDocuments } = await import('../../shared/schema');
      
      const docs = await db
        .select()
        .from(fileSearchDocuments)
        .where(and(
          eq(fileSearchDocuments.storeId, storeId),
          sql`${fileSearchDocuments.sourceId} IS NOT NULL`
        ));

      const orphans: Array<{
        id: string;
        fileName: string;
        googleFileId: string;
        sourceType: string;
        sourceId: string | null;
      }> = [];

      const bySourceType: Record<string, typeof docs> = {};
      for (const doc of docs) {
        const st = doc.sourceType || 'unknown';
        if (!bySourceType[st]) bySourceType[st] = [];
        bySourceType[st].push(doc);
      }

      // Helper function to extract base ID from chunked sourceId
      // e.g., "f7f666e6-734f-4ac9-8746-5c1d754494eb_chunk_10" -> "f7f666e6-734f-4ac9-8746-5c1d754494eb"
      const extractBaseId = (sourceId: string): string => {
        const chunkMatch = sourceId.match(/^(.+)_chunk_\d+$/);
        return chunkMatch ? chunkMatch[1] : sourceId;
      };

      for (const [sourceType, typeDocs] of Object.entries(bySourceType)) {
        const sourceIds = typeDocs.map(d => d.sourceId!).filter(Boolean);
        if (sourceIds.length === 0) continue;

        // Extract base IDs for chunked documents
        const baseIds = [...new Set(sourceIds.map(extractBaseId))];

        let existingBaseIds: Set<string> = new Set();

        try {
          switch (sourceType) {
            case 'knowledge_base':
              const kbDocs = await db.select({ id: consultantKnowledgeDocuments.id })
                .from(consultantKnowledgeDocuments)
                .where(inArray(consultantKnowledgeDocuments.id, baseIds));
              existingBaseIds = new Set(kbDocs.map(d => d.id));
              break;
            case 'client_knowledge':
              const ckDocs = await db.select({ id: clientKnowledgeDocuments.id })
                .from(clientKnowledgeDocuments)
                .where(inArray(clientKnowledgeDocuments.id, baseIds));
              existingBaseIds = new Set(ckDocs.map(d => d.id));
              break;
            case 'whatsapp_agent_knowledge':
              const wakDocs = await db.select({ id: whatsappAgentKnowledgeItems.id })
                .from(whatsappAgentKnowledgeItems)
                .where(inArray(whatsappAgentKnowledgeItems.id, baseIds));
              existingBaseIds = new Set(wakDocs.map(d => d.id));
              break;
            case 'exercise':
              const exDocs = await db.select({ id: consultantExercises.id })
                .from(consultantExercises)
                .where(inArray(consultantExercises.id, baseIds));
              existingBaseIds = new Set(exDocs.map(d => d.id));
              break;
            case 'consultation':
              const consDocs = await db.select({ id: consultations.id })
                .from(consultations)
                .where(inArray(consultations.id, baseIds));
              existingBaseIds = new Set(consDocs.map(d => d.id));
              break;
            case 'library':
              const libDocs = await db.select({ id: libraryDocuments.id })
                .from(libraryDocuments)
                .where(inArray(libraryDocuments.id, baseIds));
              existingBaseIds = new Set(libDocs.map(d => d.id));
              break;
            default:
              console.log(`⚠️ [FileSearch] Unknown sourceType for orphan check: ${sourceType}`);
              continue;
          }
        } catch (checkError: any) {
          console.warn(`⚠️ [FileSearch] Error checking source type ${sourceType}:`, checkError.message);
          continue;
        }

        // Check if the base ID exists (handles both regular docs and chunks)
        for (const doc of typeDocs) {
          if (doc.sourceId) {
            const baseId = extractBaseId(doc.sourceId);
            if (!existingBaseIds.has(baseId)) {
              orphans.push({
                id: doc.id,
                fileName: doc.fileName,
                googleFileId: doc.googleFileId,
                sourceType: doc.sourceType || 'unknown',
                sourceId: doc.sourceId,
              });
            }
          }
        }
      }

      console.log(`🔍 [FileSearch] Found ${orphans.length} source orphans in store ${storeId}`);
      return { success: true, orphans };
    } catch (error: any) {
      console.error(`❌ [FileSearch] Error finding source orphans:`, error);
      return { success: false, orphans: [], error: error.message };
    }
  }

  /**
   * Clean up source orphans - delete documents whose source no longer exists
   */
  async cleanupSourceOrphans(storeId: string, requestingUserId?: string): Promise<{
    success: boolean;
    removed: number;
    errors: string[];
  }> {
    const orphansResult = await this.findSourceOrphans(storeId);
    if (!orphansResult.success) {
      return { success: false, removed: 0, errors: [orphansResult.error || 'Failed to find orphans'] };
    }

    let removed = 0;
    const errors: string[] = [];

    for (const orphan of orphansResult.orphans) {
      const deleteResult = await this.deleteDocument(orphan.id, requestingUserId);
      if (deleteResult.success) {
        removed++;
        console.log(`🗑️ [FileSearch] Deleted source orphan: ${orphan.fileName} (sourceType: ${orphan.sourceType})`);
      } else {
        errors.push(`Failed to delete ${orphan.fileName}: ${deleteResult.error}`);
      }
    }

    return {
      success: errors.length === 0,
      removed,
      errors,
    };
  }
}

export const fileSearchService = new FileSearchService();
