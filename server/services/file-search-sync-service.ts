/**
 * File Search Sync Service
 * Automatically syncs library documents and knowledge base to FileSearchStore
 */

import { db } from "../db";
import { libraryDocuments, fileSearchStores, fileSearchDocuments } from "../../shared/schema";
import { fileSearchService } from "../ai/file-search-service";
import { eq, and } from "drizzle-orm";

export class FileSearchSyncService {
  /**
   * Sync a library document to FileSearchStore
   */
  static async syncLibraryDocument(
    documentId: string,
    consultantId: string,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const doc = await db.query.libraryDocuments.findFirst({
        where: eq(libraryDocuments.id, documentId),
      });

      if (!doc) {
        return { success: false, error: 'Document not found' };
      }

      const isAlreadyIndexed = await fileSearchService.isDocumentIndexed('library', documentId);
      if (isAlreadyIndexed) {
        console.log(`📌 [FileSync] Document already indexed: ${documentId}`);
        return { success: true };
      }

      let consultantStore = await db.query.fileSearchStores.findFirst({
        where: and(
          eq(fileSearchStores.ownerId, consultantId),
          eq(fileSearchStores.ownerType, 'consultant'),
        ),
      });

      if (!consultantStore) {
        const result = await fileSearchService.createStore({
          displayName: `Libreria Consulente`,
          ownerId: consultantId,
          ownerType: 'consultant',
          description: 'Documenti della libreria sincronizzati per AI search',
        });

        if (!result.success || !result.storeId) {
          return { success: false, error: 'Failed to create FileSearchStore' };
        }

        consultantStore = await db.query.fileSearchStores.findFirst({
          where: eq(fileSearchStores.id, result.storeId),
        });

        if (!consultantStore) {
          return { success: false, error: 'Store created but not found' };
        }
      }

      const uploadResult = await fileSearchService.uploadDocumentFromContent({
        content: doc.content || `${doc.title}\n\n${doc.description || ''}`,
        displayName: doc.title,
        storeId: consultantStore.id,
        sourceType: 'library',
        sourceId: documentId,
      });

      return uploadResult.success 
        ? { success: true }
        : { success: false, error: uploadResult.error };
    } catch (error: any) {
      console.error('[FileSync] Error syncing document:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Bulk sync all library documents for a consultant
   */
  static async syncAllLibraryDocuments(consultantId: string): Promise<{
    total: number;
    synced: number;
    failed: number;
    errors: string[];
  }> {
    try {
      const docs = await db.query.libraryDocuments.findMany({
        where: eq(libraryDocuments.createdBy, consultantId),
      });

      let synced = 0;
      let failed = 0;
      const errors: string[] = [];

      console.log(`🔄 [FileSync] Syncing ${docs.length} library documents for consultant ${consultantId}`);

      for (const doc of docs) {
        const result = await this.syncLibraryDocument(doc.id, consultantId);
        if (result.success) {
          synced++;
        } else {
          failed++;
          errors.push(`${doc.title}: ${result.error}`);
        }
      }

      console.log(`✅ [FileSync] Complete - Synced: ${synced}/${docs.length}, Failed: ${failed}`);

      return {
        total: docs.length,
        synced,
        failed,
        errors,
      };
    } catch (error: any) {
      console.error('[FileSync] Bulk sync error:', error);
      return {
        total: 0,
        synced: 0,
        failed: 1,
        errors: [error.message],
      };
    }
  }

  /**
   * Auto-sync on document upload (call this in your upload endpoint)
   */
  static async onDocumentUploaded(documentId: string, consultantId: string): Promise<void> {
    try {
      const result = await this.syncLibraryDocument(documentId, consultantId);
      if (!result.success) {
        console.warn(`⚠️ [FileSync] Failed to auto-sync document: ${result.error}`);
      }
    } catch (error) {
      console.error('[FileSync] Auto-sync error:', error);
    }
  }
}

export const fileSearchSyncService = FileSearchSyncService;
