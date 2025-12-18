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
import { fileSearchStores, fileSearchDocuments } from "../../shared/schema";
import { eq, and, desc, inArray, or } from "drizzle-orm";
import fs from "fs/promises";
import path from "path";

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
  ownerType: 'consultant' | 'client' | 'system';
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
  maxTokensPerChunk: 512,
  maxOverlapTokens: 64,
};

export class FileSearchService {
  private client: GoogleGenAI | null = null;
  private apiKey: string | null = null;

  constructor() {
    this.apiKey = process.env.GEMINI_API_KEY || null;
    if (this.apiKey) {
      this.client = new GoogleGenAI({ apiKey: this.apiKey });
      // Log API key configuration for debugging
      const keyPreview = this.apiKey.substring(0, 10) + '...' + this.apiKey.substring(this.apiKey.length - 4);
      console.log(`🔑 [FileSearch] Initialized with GEMINI_API_KEY (Google AI Studio): ${keyPreview}`);
    } else {
      console.warn(`⚠️ [FileSearch] No GEMINI_API_KEY configured - File Search will not work`);
    }
  }

  private ensureClient(): GoogleGenAI {
    if (!this.client) {
      throw new Error('File Search Service: No Gemini API key configured. Set GEMINI_API_KEY environment variable.');
    }
    return this.client;
  }

  /**
   * Create a new FileSearchStore for an owner (consultant, client, or system)
   */
  async createStore(params: {
    displayName: string;
    ownerId: string;
    ownerType: 'consultant' | 'client' | 'system';
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
   * Upload document from text content (for library documents already in DB)
   */
  async uploadDocumentFromContent(params: {
    content: string;
    displayName: string;
    storeId: string;
    sourceType: 'library' | 'knowledge_base' | 'manual';
    sourceId?: string;
    chunkingConfig?: ChunkingConfig;
  }): Promise<FileSearchUploadResult> {
    const tempFilePath = path.join('/tmp', `filesearch-${Date.now()}.txt`);
    
    try {
      await fs.writeFile(tempFilePath, params.content, 'utf-8');
      
      const result = await this.uploadDocument({
        filePath: tempFilePath,
        displayName: params.displayName,
        storeId: params.storeId,
        sourceType: params.sourceType,
        sourceId: params.sourceId,
        chunkingConfig: params.chunkingConfig,
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
   */
  async getStoresForUser(userId: string, userRole: 'consultant' | 'client'): Promise<FileSearchStoreInfo[]> {
    const stores = await db.query.fileSearchStores.findMany({
      where: and(
        eq(fileSearchStores.ownerId, userId),
        eq(fileSearchStores.ownerType, userRole),
        eq(fileSearchStores.isActive, true)
      ),
      orderBy: [desc(fileSearchStores.createdAt)],
    });

    return stores.map(store => ({
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
   */
  async getStoreNamesForGeneration(userId: string, userRole: 'consultant' | 'client', consultantId?: string): Promise<string[]> {
    const conditions = [];
    
    // User-specific stores (consultant or their consultant for clients)
    if (userRole === 'consultant') {
      conditions.push(
        and(
          eq(fileSearchStores.ownerId, userId),
          eq(fileSearchStores.ownerType, 'consultant'),
          eq(fileSearchStores.isActive, true)
        )
      );
    } else if (userRole === 'client' && consultantId) {
      conditions.push(
        and(
          eq(fileSearchStores.ownerId, consultantId),
          eq(fileSearchStores.ownerType, 'consultant'),
          eq(fileSearchStores.isActive, true)
        )
      );
    }

    // Always include system-wide stores
    conditions.push(
      and(
        eq(fileSearchStores.ownerType, 'system'),
        eq(fileSearchStores.isActive, true)
      )
    );

    // FIX: Use OR to combine all conditions (was using only first condition before!)
    const stores = await db.query.fileSearchStores.findMany({
      where: conditions.length > 1 ? or(...conditions) : conditions[0],
    });

    console.log(`🔍 [FileSearch] getStoreNamesForGeneration - Role: ${userRole}, UserId: ${userId}, ConsultantId: ${consultantId || 'N/A'}`);
    console.log(`   📦 Found ${stores.length} stores: ${stores.map(s => s.displayName).join(', ') || 'nessuno'}`);

    return stores.map(store => store.googleStoreName);
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
      sourceType: doc.sourceType as 'library' | 'knowledge_base' | 'manual',
      sourceId: doc.sourceId || undefined,
    }));
  }

  /**
   * Check if a document is already indexed
   */
  async isDocumentIndexed(sourceType: 'library' | 'knowledge_base', sourceId: string): Promise<boolean> {
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
}

export const fileSearchService = new FileSearchService();
