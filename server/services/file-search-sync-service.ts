/**
 * File Search Sync Service
 * Automatically syncs library documents and knowledge base to FileSearchStore
 * 
 * Supports:
 * - Library Documents (for clients via consultant's library)
 * - Consultant Knowledge Documents (for consultant's AI assistant)
 * - Client Knowledge Documents (for client's AI assistant)
 */

import { EventEmitter } from "events";
import { db } from "../db";
import { 
  libraryDocuments, 
  libraryCategories,
  librarySubcategories,
  fileSearchStores, 
  fileSearchDocuments,
  consultantKnowledgeDocuments,
  clientKnowledgeDocuments,
  exercises,
  exerciseSubmissions,
  exerciseAssignments,
  universityLessons,
  universityModules,
  universityTrimesters,
  universityYears,
  universityYearClientAssignments,
  libraryCategoryClientAssignments,
  consultations,
  users,
  goals,
  consultationTasks,
  userFinanceSettings,
  whatsappAgentKnowledgeItems,
  consultantWhatsappConfig,
  fileSearchSettings,
  dailyReflections,
  clientProgress,
  clientLibraryProgress,
  clientEmailJourneyProgress,
  emailJourneyTemplates,
} from "../../shared/schema";
import { PercorsoCapitaleClient } from "../percorso-capitale-client";
import { PercorsoCapitaleDataProcessor } from "../percorso-capitale-processor";
import { fileSearchService, FileSearchService } from "../ai/file-search-service";
import { eq, and, desc, isNotNull, inArray } from "drizzle-orm";
import { scrapeGoogleDoc } from "../web-scraper";
import { extractTextFromFile } from "./document-processor";

export type SyncEventType = 'start' | 'progress' | 'error' | 'complete' | 'all_complete' | 'orphan_start' | 'orphan_progress' | 'orphan_complete';

export interface SyncProgressEvent {
  type: SyncEventType;
  item?: string;
  current?: number;
  total?: number;
  synced?: number;
  totalSynced?: number;
  category?: 'library' | 'knowledge_base' | 'exercises' | 'university' | 'consultations' | 'whatsapp_agents' | 'exercise_responses' | 'client_knowledge' | 'client_consultations' | 'financial_data' | 'orphans' | 'assigned_exercises' | 'assigned_library' | 'assigned_university' | 'goals' | 'tasks';
  error?: string;
  consultantId: string;
  orphansRemoved?: number;
  storesChecked?: number;
}

export class SyncProgressEmitter extends EventEmitter {
  private static instance: SyncProgressEmitter;

  private constructor() {
    super();
    this.setMaxListeners(100);
  }

  static getInstance(): SyncProgressEmitter {
    if (!SyncProgressEmitter.instance) {
      SyncProgressEmitter.instance = new SyncProgressEmitter();
    }
    return SyncProgressEmitter.instance;
  }

  emitProgress(event: SyncProgressEvent): void {
    this.emit(`sync:${event.consultantId}`, event);
  }

  emitStart(consultantId: string, category: SyncProgressEvent['category'], total: number): void {
    this.emitProgress({
      type: 'start',
      category,
      total,
      current: 0,
      consultantId,
    });
  }

  emitItemProgress(consultantId: string, category: SyncProgressEvent['category'], item: string, current: number, total: number): void {
    this.emitProgress({
      type: 'progress',
      category,
      item,
      current,
      total,
      consultantId,
    });
  }

  emitError(consultantId: string, category: SyncProgressEvent['category'], error: string): void {
    this.emitProgress({
      type: 'error',
      category,
      error,
      consultantId,
    });
  }

  emitComplete(consultantId: string, category: SyncProgressEvent['category'], total: number): void {
    this.emitProgress({
      type: 'complete',
      category,
      total,
      current: total,
      consultantId,
    });
  }

  emitAllComplete(consultantId: string, totalSynced: number): void {
    this.emitProgress({
      type: 'all_complete',
      totalSynced,
      consultantId,
    });
  }

  emitOrphanStart(consultantId: string, totalStores: number): void {
    this.emitProgress({
      type: 'orphan_start',
      category: 'orphans',
      total: totalStores,
      consultantId,
    });
  }

  emitOrphanProgress(consultantId: string, storeName: string, removed: number, current: number, total: number): void {
    this.emitProgress({
      type: 'orphan_progress',
      category: 'orphans',
      item: storeName,
      orphansRemoved: removed,
      current,
      total,
      consultantId,
    });
  }

  emitOrphanComplete(consultantId: string, totalRemoved: number, storesChecked: number): void {
    this.emitProgress({
      type: 'orphan_complete',
      category: 'orphans',
      orphansRemoved: totalRemoved,
      storesChecked,
      consultantId,
    });
  }
}

export const syncProgressEmitter = SyncProgressEmitter.getInstance();

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
        userId: consultantId,
      });

      // CASCADE: Se questo documento è collegato a una lezione universitaria, sincronizza anche quella
      if (uploadResult.success) {
        const linkedLesson = await db.query.universityLessons.findFirst({
          where: eq(universityLessons.libraryDocumentId, documentId),
        });
        
        if (linkedLesson) {
          console.log(`🔗 [FileSync] Document linked to lesson "${linkedLesson.title}" - triggering cascade sync`);
          // Forza re-sync della lezione (delete + recreate per aggiornare il contenuto)
          await this.syncUniversityLesson(linkedLesson.id, consultantId, true); // true = force update
        }
      }

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
      let processed = 0;

      console.log(`🔄 [FileSync] Syncing ${docs.length} library documents for consultant ${consultantId}`);
      syncProgressEmitter.emitStart(consultantId, 'library', docs.length);

      for (const doc of docs) {
        const result = await this.syncLibraryDocument(doc.id, consultantId);
        processed++;
        if (result.success) {
          synced++;
          syncProgressEmitter.emitItemProgress(consultantId, 'library', doc.title, processed, docs.length);
        } else {
          failed++;
          errors.push(`${doc.title}: ${result.error}`);
          syncProgressEmitter.emitError(consultantId, 'library', `${doc.title}: ${result.error}`);
        }
      }

      console.log(`✅ [FileSync] Complete - Synced: ${synced}/${docs.length}, Failed: ${failed}`);
      syncProgressEmitter.emitComplete(consultantId, 'library', docs.length);

      return {
        total: docs.length,
        synced,
        failed,
        errors,
      };
    } catch (error: any) {
      console.error('[FileSync] Bulk sync error:', error);
      syncProgressEmitter.emitError(consultantId, 'library', error.message);
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

  /**
   * Sync a consultant knowledge document to FileSearchStore
   * Includes retry logic to handle race conditions when called right after document indexing
   */
  static async syncConsultantKnowledgeDocument(
    documentId: string,
    consultantId: string,
    maxRetries: number = 3,
  ): Promise<{ success: boolean; error?: string }> {
    let doc = null;
    let lastStatus = 'unknown';
    
    // Retry loop to handle race condition when document is just being indexed
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      doc = await db.query.consultantKnowledgeDocuments.findFirst({
        where: and(
          eq(consultantKnowledgeDocuments.id, documentId),
          eq(consultantKnowledgeDocuments.consultantId, consultantId),
        ),
      });

      if (!doc) {
        return { success: false, error: 'Knowledge document not found' };
      }
      
      lastStatus = doc.status;
      
      if (doc.status === 'indexed') {
        break; // Document is ready for sync
      }
      
      // If not indexed yet and we have retries left, wait and try again
      if (attempt < maxRetries) {
        console.log(`⏳ [FileSync] Document ${documentId} status is '${doc.status}', waiting for indexed status (attempt ${attempt}/${maxRetries})...`);
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt)); // Exponential backoff: 1s, 2s, 3s
      }
    }
    
    if (!doc || doc.status !== 'indexed') {
      return { success: false, error: `Document status is '${lastStatus}' after ${maxRetries} attempts, expected 'indexed'` };
    }
    
    try {

      const isAlreadyIndexed = await fileSearchService.isDocumentIndexed('knowledge_base', documentId);
      if (isAlreadyIndexed) {
        console.log(`📌 [FileSync] Knowledge document already indexed: ${documentId}`);
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
          displayName: `Knowledge Base Consulente`,
          ownerId: consultantId,
          ownerType: 'consultant',
          description: 'Documenti Knowledge Base sincronizzati per AI semantic search',
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

      const content = doc.extractedContent || doc.contentSummary || `${doc.title}\n\n${doc.description || ''}`;
      
      const uploadResult = await fileSearchService.uploadDocumentFromContent({
        content: content,
        displayName: `[KB] ${doc.title}`,
        storeId: consultantStore.id,
        sourceType: 'knowledge_base',
        sourceId: documentId,
        userId: consultantId,
      });

      if (uploadResult.success) {
        console.log(`✅ [FileSync] Knowledge document synced: ${doc.title}`);
      }

      return uploadResult.success 
        ? { success: true }
        : { success: false, error: uploadResult.error };
    } catch (error: any) {
      console.error('[FileSync] Error syncing knowledge document:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Bulk sync all consultant knowledge documents
   */
  static async syncAllConsultantKnowledgeDocuments(consultantId: string): Promise<{
    total: number;
    synced: number;
    failed: number;
    skipped: number;
    errors: string[];
  }> {
    try {
      const docs = await db.query.consultantKnowledgeDocuments.findMany({
        where: and(
          eq(consultantKnowledgeDocuments.consultantId, consultantId),
          eq(consultantKnowledgeDocuments.status, 'indexed')
        ),
        orderBy: [desc(consultantKnowledgeDocuments.priority)],
      });

      let synced = 0;
      let failed = 0;
      let skipped = 0;
      let processed = 0;
      const errors: string[] = [];

      console.log(`🔄 [FileSync] Syncing ${docs.length} knowledge documents for consultant ${consultantId}`);
      syncProgressEmitter.emitStart(consultantId, 'knowledge_base', docs.length);

      for (const doc of docs) {
        const isAlreadyIndexed = await fileSearchService.isDocumentIndexed('knowledge_base', doc.id);
        if (isAlreadyIndexed) {
          skipped++;
          processed++;
          syncProgressEmitter.emitItemProgress(consultantId, 'knowledge_base', doc.title, processed, docs.length);
          continue;
        }

        const result = await this.syncConsultantKnowledgeDocument(doc.id, consultantId);
        processed++;
        if (result.success) {
          synced++;
          syncProgressEmitter.emitItemProgress(consultantId, 'knowledge_base', doc.title, processed, docs.length);
        } else {
          failed++;
          errors.push(`${doc.title}: ${result.error}`);
          syncProgressEmitter.emitError(consultantId, 'knowledge_base', `${doc.title}: ${result.error}`);
        }
      }

      console.log(`✅ [FileSync] Knowledge Base sync complete - Synced: ${synced}, Skipped: ${skipped}, Failed: ${failed}`);
      syncProgressEmitter.emitComplete(consultantId, 'knowledge_base', docs.length);

      return {
        total: docs.length,
        synced,
        failed,
        skipped,
        errors,
      };
    } catch (error: any) {
      console.error('[FileSync] Knowledge bulk sync error:', error);
      syncProgressEmitter.emitError(consultantId, 'knowledge_base', error.message);
      return {
        total: 0,
        synced: 0,
        failed: 1,
        skipped: 0,
        errors: [error.message],
      };
    }
  }

  /**
   * Auto-sync on knowledge document upload/index
   */
  static async onKnowledgeDocumentIndexed(documentId: string, consultantId: string): Promise<void> {
    try {
      const result = await this.syncConsultantKnowledgeDocument(documentId, consultantId);
      if (!result.success) {
        console.warn(`⚠️ [FileSync] Failed to auto-sync knowledge document: ${result.error}`);
      }
    } catch (error) {
      console.error('[FileSync] Knowledge auto-sync error:', error);
    }
  }

  /**
   * Sync ALL documents for a consultant (library + knowledge base)
   */
  static async syncAllDocumentsForConsultant(consultantId: string): Promise<{
    library: { total: number; synced: number; failed: number; errors: string[] };
    knowledgeBase: { total: number; synced: number; failed: number; skipped: number; errors: string[] };
  }> {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`🔄 [FileSync] Starting full sync for consultant ${consultantId}`);
    console.log(`${'='.repeat(60)}\n`);

    const libraryResult = await this.syncAllLibraryDocuments(consultantId);
    const knowledgeResult = await this.syncAllConsultantKnowledgeDocuments(consultantId);

    console.log(`\n${'='.repeat(60)}`);
    console.log(`✅ [FileSync] Full sync complete for consultant ${consultantId}`);
    console.log(`   Library: ${libraryResult.synced}/${libraryResult.total} synced`);
    console.log(`   Knowledge Base: ${knowledgeResult.synced}/${knowledgeResult.total} synced, ${knowledgeResult.skipped} skipped`);
    console.log(`${'='.repeat(60)}\n`);

    return {
      library: libraryResult,
      knowledgeBase: knowledgeResult,
    };
  }

  /**
   * Get FileSearchStore info for a consultant
   */
  static async getStoreInfo(consultantId: string): Promise<{
    hasStore: boolean;
    storeId?: string;
    storeName?: string;
    documentCount?: number;
  }> {
    const store = await db.query.fileSearchStores.findFirst({
      where: and(
        eq(fileSearchStores.ownerId, consultantId),
        eq(fileSearchStores.ownerType, 'consultant'),
        eq(fileSearchStores.isActive, true),
      ),
    });

    if (!store) {
      return { hasStore: false };
    }

    return {
      hasStore: true,
      storeId: store.id,
      storeName: store.googleStoreName,
      documentCount: store.documentCount || 0,
    };
  }

  // ============================================================
  // EXERCISES SYNC - Indicizzazione degli esercizi per File Search
  // ============================================================

  /**
   * Sync a single exercise to FileSearchStore
   */
  static async syncExercise(
    exerciseId: string,
    consultantId: string,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const exercise = await db.query.exercises.findFirst({
        where: eq(exercises.id, exerciseId),
      });

      if (!exercise) {
        return { success: false, error: 'Exercise not found' };
      }

      const isAlreadyIndexed = await fileSearchService.isDocumentIndexed('exercise', exerciseId);
      if (isAlreadyIndexed) {
        console.log(`📌 [FileSync] Exercise already indexed: ${exerciseId}`);
        return { success: true };
      }

      // Get or create consultant store
      let consultantStore = await db.query.fileSearchStores.findFirst({
        where: and(
          eq(fileSearchStores.ownerId, consultantId),
          eq(fileSearchStores.ownerType, 'consultant'),
        ),
      });

      if (!consultantStore) {
        const result = await fileSearchService.createStore({
          displayName: `Knowledge Store Consulente`,
          ownerId: consultantId,
          ownerType: 'consultant',
          description: 'Esercizi, documenti e contenuti indicizzati per AI semantic search',
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

      // Scrape workPlatform content if it's a Google Doc URL
      let workPlatformContent: string | null = null;
      if (exercise.workPlatform && exercise.workPlatform.includes('docs.google.com')) {
        try {
          console.log(`🔍 [FileSync] Scraping Google Doc for exercise: ${exercise.title}`);
          workPlatformContent = await scrapeGoogleDoc(exercise.workPlatform);
          if (workPlatformContent) {
            console.log(`✅ [FileSync] Scraped ${workPlatformContent.length} chars from Google Doc`);
          }
        } catch (scrapeError: any) {
          console.warn(`⚠️ [FileSync] Failed to scrape Google Doc for ${exercise.title}: ${scrapeError.message}`);
        }
      }

      // Build exercise content for indexing (including scraped content)
      const content = this.buildExerciseContent(exercise, workPlatformContent);
      
      const uploadResult = await fileSearchService.uploadDocumentFromContent({
        content: content,
        displayName: `[EX] ${exercise.title}`,
        storeId: consultantStore.id,
        sourceType: 'exercise',
        sourceId: exerciseId,
        userId: consultantId,
      });

      if (uploadResult.success) {
        console.log(`✅ [FileSync] Exercise synced: ${exercise.title}`);
      }

      return uploadResult.success 
        ? { success: true }
        : { success: false, error: uploadResult.error };
    } catch (error: any) {
      console.error('[FileSync] Error syncing exercise:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Build searchable content from an exercise
   * @param exercise - The exercise object
   * @param workPlatformContent - Optional scraped content from workPlatform (Google Doc)
   */
  private static buildExerciseContent(exercise: any, workPlatformContent?: string | null): string {
    const parts: string[] = [];
    
    parts.push(`# ${exercise.title}`);
    parts.push(`Categoria: ${exercise.category}`);
    parts.push(`Tipo: ${exercise.type}`);
    
    if (exercise.description) {
      parts.push(`\n## Descrizione\n${exercise.description}`);
    }
    
    if (exercise.instructions) {
      parts.push(`\n## Istruzioni\n${exercise.instructions}`);
    }
    
    // Include questions if present
    if (exercise.questions && Array.isArray(exercise.questions) && exercise.questions.length > 0) {
      parts.push(`\n## Domande`);
      exercise.questions.forEach((q: any, i: number) => {
        parts.push(`\n### Domanda ${i + 1}: ${q.question || q.text || ''}`);
        if (q.type) parts.push(`Tipo: ${q.type}`);
        if (q.options && Array.isArray(q.options)) {
          parts.push(`Opzioni: ${q.options.join(', ')}`);
        }
      });
    }
    
    if (exercise.workPlatform) {
      parts.push(`\n## Piattaforma di lavoro\nURL: ${exercise.workPlatform}`);
    }

    // Include scraped content from Google Doc if available
    if (workPlatformContent) {
      parts.push(`\n## Contenuto Documento\n${workPlatformContent}`);
    }
    
    return parts.join('\n');
  }

  /**
   * Bulk sync all exercises for a consultant
   */
  static async syncAllExercises(consultantId: string): Promise<{
    total: number;
    synced: number;
    failed: number;
    skipped: number;
    errors: string[];
  }> {
    try {
      const allExercises = await db.query.exercises.findMany({
        where: eq(exercises.createdBy, consultantId),
      });

      let synced = 0;
      let failed = 0;
      let skipped = 0;
      let processed = 0;
      const errors: string[] = [];

      console.log(`\n${'═'.repeat(60)}`);
      console.log(`🏋️ [FileSync] Syncing ${allExercises.length} exercises for consultant ${consultantId}`);
      console.log(`${'═'.repeat(60)}\n`);
      syncProgressEmitter.emitStart(consultantId, 'exercises', allExercises.length);

      // Emit progress every N items to avoid SSE overload for large exercise sets
      const PROGRESS_INTERVAL = Math.max(5, Math.floor(allExercises.length / 30)); // Max ~30 progress events
      
      for (const exercise of allExercises) {
        const isAlreadyIndexed = await fileSearchService.isDocumentIndexed('exercise', exercise.id);
        if (isAlreadyIndexed) {
          skipped++;
          processed++;
          // Emit progress only every N items
          if (processed % PROGRESS_INTERVAL === 0 || processed === allExercises.length) {
            syncProgressEmitter.emitItemProgress(consultantId, 'exercises', exercise.title, processed, allExercises.length);
          }
          continue;
        }

        const result = await this.syncExercise(exercise.id, consultantId);
        processed++;
        if (result.success) {
          synced++;
          if (processed % PROGRESS_INTERVAL === 0 || processed === allExercises.length) {
            syncProgressEmitter.emitItemProgress(consultantId, 'exercises', exercise.title, processed, allExercises.length);
          }
        } else {
          failed++;
          errors.push(`${exercise.title}: ${result.error}`);
          syncProgressEmitter.emitError(consultantId, 'exercises', `${exercise.title}: ${result.error}`);
        }
        
        // Small delay to avoid rate limiting
        if (synced % 10 === 0) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      console.log(`\n${'═'.repeat(60)}`);
      console.log(`✅ [FileSync] Exercises sync complete`);
      console.log(`   📊 Total: ${allExercises.length}`);
      console.log(`   ✅ Synced: ${synced}`);
      console.log(`   ⏭️  Skipped (already indexed): ${skipped}`);
      console.log(`   ❌ Failed: ${failed}`);
      console.log(`${'═'.repeat(60)}\n`);
      syncProgressEmitter.emitComplete(consultantId, 'exercises', allExercises.length);

      return {
        total: allExercises.length,
        synced,
        failed,
        skipped,
        errors,
      };
    } catch (error: any) {
      console.error('[FileSync] Exercises bulk sync error:', error);
      syncProgressEmitter.emitError(consultantId, 'exercises', error.message);
      return {
        total: 0,
        synced: 0,
        failed: 1,
        skipped: 0,
        errors: [error.message],
      };
    }
  }

  // ============================================================
  // UNIVERSITY LESSONS SYNC
  // ============================================================

  /**
   * Sync a single university lesson to FileSearchStore
   * INCLUDES linked library document content for full-text search
   */
  static async syncUniversityLesson(
    lessonId: string,
    consultantId: string,
    forceUpdate: boolean = false,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const lesson = await db.query.universityLessons.findFirst({
        where: eq(universityLessons.id, lessonId),
      });

      if (!lesson) {
        return { success: false, error: 'Lesson not found' };
      }

      // Load hierarchy with separate queries (no relations defined in schema)
      let lessonWithHierarchy: any = { ...lesson, module: null };
      if (lesson.moduleId) {
        const module = await db.query.universityModules.findFirst({
          where: eq(universityModules.id, lesson.moduleId),
        });
        if (module) {
          lessonWithHierarchy.module = { ...module, trimester: null };
          if (module.trimesterId) {
            const trimester = await db.query.universityTrimesters.findFirst({
              where: eq(universityTrimesters.id, module.trimesterId),
            });
            if (trimester) {
              lessonWithHierarchy.module.trimester = { ...trimester, year: null };
              if (trimester.yearId) {
                const year = await db.query.universityYears.findFirst({
                  where: eq(universityYears.id, trimester.yearId),
                });
                if (year) {
                  lessonWithHierarchy.module.trimester.year = year;
                }
              }
            }
          }
        }
      }

      const isAlreadyIndexed = await fileSearchService.isDocumentIndexed('university_lesson', lessonId);
      if (isAlreadyIndexed && !forceUpdate) {
        console.log(`📌 [FileSync] Lesson already indexed: ${lessonId}`);
        return { success: true };
      }

      // Se forceUpdate, elimina il documento esistente prima di ricreare
      if (isAlreadyIndexed && forceUpdate) {
        console.log(`🔄 [FileSync] Force updating lesson: ${lessonId} - deleting old version`);
        await fileSearchService.deleteDocumentBySource('university_lesson', lessonId);
      }

      // CRITICAL FIX: Load the linked library document content if exists
      let linkedDocument: { title: string; content: string | null; contentType: string | null; videoUrl: string | null } | null = null;
      if (lessonWithHierarchy.libraryDocumentId) {
        const libDoc = await db.query.libraryDocuments.findFirst({
          where: eq(libraryDocuments.id, lessonWithHierarchy.libraryDocumentId),
        });
        if (libDoc) {
          linkedDocument = {
            title: libDoc.title,
            content: libDoc.content,
            contentType: libDoc.contentType,
            videoUrl: libDoc.videoUrl,
          };
          console.log(`📚 [FileSync] Found linked library document for lesson "${lessonWithHierarchy.title}": "${libDoc.title}" (${libDoc.content?.length || 0} chars)`);
        }
      }

      // Get or create consultant store
      let consultantStore = await db.query.fileSearchStores.findFirst({
        where: and(
          eq(fileSearchStores.ownerId, consultantId),
          eq(fileSearchStores.ownerType, 'consultant'),
        ),
      });

      if (!consultantStore) {
        const result = await fileSearchService.createStore({
          displayName: `Knowledge Store Consulente`,
          ownerId: consultantId,
          ownerType: 'consultant',
          description: 'Esercizi, documenti e contenuti indicizzati per AI semantic search',
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

      // Build lesson content for indexing (now includes library document content!)
      const content = this.buildLessonContent(lessonWithHierarchy, linkedDocument);
      
      const uploadResult = await fileSearchService.uploadDocumentFromContent({
        content: content,
        displayName: `[LESSON] ${lessonWithHierarchy.title}`,
        storeId: consultantStore.id,
        sourceType: 'university_lesson',
        sourceId: lessonId,
        userId: consultantId,
      });

      if (uploadResult.success) {
        const contentSize = content.length;
        console.log(`✅ [FileSync] Lesson synced: ${lessonWithHierarchy.title} (${contentSize} chars${linkedDocument ? ', includes library doc' : ''})`);
      }

      return uploadResult.success 
        ? { success: true }
        : { success: false, error: uploadResult.error };
    } catch (error: any) {
      console.error('[FileSync] Error syncing lesson:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Build searchable content from a university lesson
   * INCLUDES linked library document content for comprehensive semantic search
   */
  private static buildLessonContent(
    lesson: any, 
    linkedDocument?: { title: string; content: string | null; contentType: string | null; videoUrl: string | null } | null
  ): string {
    const parts: string[] = [];
    
    // Build hierarchy path
    const hierarchy: string[] = [];
    if (lesson.module?.trimester?.year?.name) {
      hierarchy.push(lesson.module.trimester.year.name);
    }
    if (lesson.module?.trimester?.name) {
      hierarchy.push(lesson.module.trimester.name);
    }
    if (lesson.module?.name) {
      hierarchy.push(lesson.module.name);
    }
    
    parts.push(`# ${lesson.title}`);
    
    if (hierarchy.length > 0) {
      parts.push(`Percorso: ${hierarchy.join(' > ')}`);
    }
    
    if (lesson.description) {
      parts.push(`\n## Descrizione\n${lesson.description}`);
    }
    
    if (lesson.content) {
      parts.push(`\n## Contenuto Base\n${lesson.content}`);
    }
    
    // CRITICAL: Include the full library document content (this is where the 100k+ tokens are!)
    if (linkedDocument?.content) {
      parts.push(`\n## Contenuto Completo della Lezione\n`);
      parts.push(`Documento: ${linkedDocument.title}`);
      parts.push(`\n${linkedDocument.content}`);
    }
    
    if (lesson.videoUrl || linkedDocument?.videoUrl) {
      parts.push(`\n## Video\n${lesson.videoUrl || linkedDocument?.videoUrl}`);
    }
    
    return parts.join('\n');
  }

  /**
   * Bulk sync all university lessons for a consultant
   */
  static async syncAllUniversityLessons(consultantId: string): Promise<{
    total: number;
    synced: number;
    failed: number;
    skipped: number;
    errors: string[];
  }> {
    try {
      // Get all years for this consultant
      const years = await db.query.universityYears.findMany();
      
      // Get all lessons (syncUniversityLesson loads hierarchy data separately)
      const allLessons = await db.query.universityLessons.findMany();

      let synced = 0;
      let failed = 0;
      let skipped = 0;
      let processed = 0;
      const errors: string[] = [];

      console.log(`\n${'═'.repeat(60)}`);
      console.log(`🎓 [FileSync] Syncing ${allLessons.length} university lessons`);
      console.log(`${'═'.repeat(60)}\n`);
      syncProgressEmitter.emitStart(consultantId, 'university', allLessons.length);

      // Emit progress every N items to avoid SSE overload (1097 lessons is a lot!)
      const PROGRESS_INTERVAL = Math.max(10, Math.floor(allLessons.length / 50)); // Max ~50 progress events
      
      for (const lesson of allLessons) {
        const isAlreadyIndexed = await fileSearchService.isDocumentIndexed('university_lesson', lesson.id);
        if (isAlreadyIndexed) {
          skipped++;
          processed++;
          // Emit progress only every N items to reduce SSE load
          if (processed % PROGRESS_INTERVAL === 0 || processed === allLessons.length) {
            syncProgressEmitter.emitItemProgress(consultantId, 'university', lesson.title, processed, allLessons.length);
          }
          continue;
        }

        const result = await this.syncUniversityLesson(lesson.id, consultantId);
        processed++;
        if (result.success) {
          synced++;
          // Emit progress only every N items
          if (processed % PROGRESS_INTERVAL === 0 || processed === allLessons.length) {
            syncProgressEmitter.emitItemProgress(consultantId, 'university', lesson.title, processed, allLessons.length);
          }
        } else {
          failed++;
          errors.push(`${lesson.title}: ${result.error}`);
          syncProgressEmitter.emitError(consultantId, 'university', `${lesson.title}: ${result.error}`);
        }
        
        // Small delay to avoid rate limiting
        if (synced % 10 === 0) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      console.log(`\n${'═'.repeat(60)}`);
      console.log(`✅ [FileSync] University lessons sync complete`);
      console.log(`   📊 Total: ${allLessons.length}`);
      console.log(`   ✅ Synced: ${synced}`);
      console.log(`   ⏭️  Skipped (already indexed): ${skipped}`);
      console.log(`   ❌ Failed: ${failed}`);
      console.log(`${'═'.repeat(60)}\n`);
      syncProgressEmitter.emitComplete(consultantId, 'university', allLessons.length);

      return {
        total: allLessons.length,
        synced,
        failed,
        skipped,
        errors,
      };
    } catch (error: any) {
      console.error('[FileSync] University lessons bulk sync error:', error);
      syncProgressEmitter.emitError(consultantId, 'university', error.message);
      return {
        total: 0,
        synced: 0,
        failed: 1,
        skipped: 0,
        errors: [error.message],
      };
    }
  }

  // ============================================================
  // CONSULTATIONS SYNC - Indicizzazione trascrizioni consulenze
  // ============================================================

  /**
   * Sync a single consultation to FileSearchStore
   */
  static async syncConsultation(
    consultationId: string,
    consultantId: string,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const consultation = await db.query.consultations.findFirst({
        where: and(
          eq(consultations.id, consultationId),
          eq(consultations.consultantId, consultantId),
        ),
      });

      if (!consultation) {
        return { success: false, error: 'Consultation not found' };
      }

      // Only sync consultations with transcript or notes
      if (!consultation.transcript && !consultation.notes) {
        return { success: false, error: 'No transcript or notes to index' };
      }

      // Get client info separately (no relation defined)
      const client = await db.query.users.findFirst({
        where: eq(users.id, consultation.clientId),
      });

      const isAlreadyIndexed = await fileSearchService.isDocumentIndexed('consultation', consultationId);
      if (isAlreadyIndexed) {
        console.log(`📌 [FileSync] Consultation already indexed: ${consultationId}`);
        return { success: true };
      }

      // Get or create consultant store
      let consultantStore = await db.query.fileSearchStores.findFirst({
        where: and(
          eq(fileSearchStores.ownerId, consultantId),
          eq(fileSearchStores.ownerType, 'consultant'),
        ),
      });

      if (!consultantStore) {
        const result = await fileSearchService.createStore({
          displayName: `Knowledge Store Consulente`,
          ownerId: consultantId,
          ownerType: 'consultant',
          description: 'Esercizi, documenti e contenuti indicizzati per AI semantic search',
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

      // Build consultation content for indexing (include client info)
      const consultationWithClient = { ...consultation, client };
      const content = this.buildConsultationContent(consultationWithClient);
      const clientName = client?.firstName || 'Cliente';
      const date = new Date(consultation.scheduledAt).toLocaleDateString('it-IT');
      
      const uploadResult = await fileSearchService.uploadDocumentFromContent({
        content: content,
        displayName: `[CONSULENZA] ${clientName} - ${date}`,
        storeId: consultantStore.id,
        sourceType: 'consultation',
        sourceId: consultationId,
        userId: consultantId,
      });

      if (uploadResult.success) {
        console.log(`✅ [FileSync] Consultation synced: ${clientName} - ${date}`);
      }

      return uploadResult.success 
        ? { success: true }
        : { success: false, error: uploadResult.error };
    } catch (error: any) {
      console.error('[FileSync] Error syncing consultation:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Build searchable content from a consultation
   */
  private static buildConsultationContent(consultation: any): string {
    const parts: string[] = [];
    const clientName = consultation.client?.firstName || 'Cliente';
    const date = new Date(consultation.scheduledAt).toLocaleDateString('it-IT');
    
    parts.push(`# Consulenza con ${clientName}`);
    parts.push(`Data: ${date}`);
    parts.push(`Durata: ${consultation.duration} minuti`);
    parts.push(`Stato: ${consultation.status}`);
    
    if (consultation.notes) {
      parts.push(`\n## Note\n${consultation.notes}`);
    }
    
    if (consultation.transcript) {
      parts.push(`\n## Trascrizione\n${consultation.transcript}`);
    }
    
    if (consultation.summaryEmail) {
      parts.push(`\n## Riepilogo\n${consultation.summaryEmail}`);
    }
    
    return parts.join('\n');
  }

  /**
   * Bulk sync all consultations with transcripts for a consultant
   * 
   * PRIVACY FIX: Consultations are now synced to each CLIENT's PRIVATE store
   * instead of the consultant's shared store. This ensures client data isolation.
   * The consultant can still search all consultations because getStoreNamesForGeneration()
   * includes all client stores for consultants.
   */
  static async syncAllConsultations(consultantId: string): Promise<{
    total: number;
    synced: number;
    failed: number;
    skipped: number;
    errors: string[];
  }> {
    try {
      // Get all completed consultations with transcripts or notes
      const allConsultations = await db.query.consultations.findMany({
        where: and(
          eq(consultations.consultantId, consultantId),
          eq(consultations.status, 'completed'),
        ),
      });

      // Filter to only those with content to index
      const consultationsWithContent = allConsultations.filter(
        c => c.transcript || c.notes
      );

      let synced = 0;
      let failed = 0;
      let skipped = 0;
      let processed = 0;
      const errors: string[] = [];

      console.log(`\n${'═'.repeat(60)}`);
      console.log(`📞 [FileSync] Syncing ${consultationsWithContent.length} consultations to CLIENT PRIVATE stores`);
      console.log(`🔐 [FileSync] Privacy mode: each consultation goes to the client's private store`);
      console.log(`${'═'.repeat(60)}\n`);
      syncProgressEmitter.emitStart(consultantId, 'consultations', consultationsWithContent.length);

      for (const consultation of consultationsWithContent) {
        const isAlreadyIndexed = await fileSearchService.isDocumentIndexed('consultation', consultation.id);
        const consultationLabel = `Consultation ${new Date(consultation.scheduledAt).toLocaleDateString('it-IT')}`;
        if (isAlreadyIndexed) {
          skipped++;
          processed++;
          syncProgressEmitter.emitItemProgress(consultantId, 'consultations', consultationLabel, processed, consultationsWithContent.length);
          continue;
        }

        // PRIVACY FIX: Sync to CLIENT's private store instead of consultant's shared store
        const result = await this.syncClientConsultationNotes(
          consultation.id, 
          consultation.clientId, 
          consultantId
        );
        processed++;
        if (result.success) {
          synced++;
          syncProgressEmitter.emitItemProgress(consultantId, 'consultations', consultationLabel, processed, consultationsWithContent.length);
        } else {
          failed++;
          errors.push(`Consultation ${consultation.id}: ${result.error}`);
          syncProgressEmitter.emitError(consultantId, 'consultations', `${consultationLabel}: ${result.error}`);
        }
        
        // Small delay to avoid rate limiting
        if (synced % 10 === 0) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      console.log(`\n${'═'.repeat(60)}`);
      console.log(`✅ [FileSync] Consultations sync complete (CLIENT PRIVATE stores)`);
      console.log(`   📊 Total with content: ${consultationsWithContent.length}`);
      console.log(`   ✅ Synced: ${synced}`);
      console.log(`   ⏭️  Skipped (already indexed): ${skipped}`);
      console.log(`   ❌ Failed: ${failed}`);
      console.log(`${'═'.repeat(60)}\n`);
      syncProgressEmitter.emitComplete(consultantId, 'consultations', consultationsWithContent.length);

      return {
        total: consultationsWithContent.length,
        synced,
        failed,
        skipped,
        errors,
      };
    } catch (error: any) {
      console.error('[FileSync] Consultations bulk sync error:', error);
      syncProgressEmitter.emitError(consultantId, 'consultations', error.message);
      return {
        total: 0,
        synced: 0,
        failed: 1,
        skipped: 0,
        errors: [error.message],
      };
    }
  }

  /**
   * Sync ALL content for a consultant (library + knowledge base + exercises + university + consultations + whatsapp agents + client private data)
   */
  static async syncAllContentForConsultant(consultantId: string): Promise<{
    library: { total: number; synced: number; failed: number; errors: string[] };
    knowledgeBase: { total: number; synced: number; failed: number; skipped: number; errors: string[] };
    exercises: { total: number; synced: number; failed: number; skipped: number; errors: string[] };
    university: { total: number; synced: number; failed: number; skipped: number; errors: string[] };
    consultations: { total: number; synced: number; failed: number; skipped: number; errors: string[] };
    whatsappAgents: { total: number; synced: number; failed: number; agentsProcessed: number; errors: string[] };
    clientPrivateData?: {
      clientsProcessed: number;
      exerciseResponses: { total: number; synced: number; failed: number };
      clientKnowledge: { total: number; synced: number; failed: number };
      clientConsultations: { total: number; synced: number; failed: number };
      financialData: { total: number; synced: number; failed: number };
    };
    orphansCleanup?: {
      storesChecked: number;
      orphansRemoved: number;
      errors: string[];
    };
  }> {
    console.log(`\n${'═'.repeat(70)}`);
    console.log(`🔄 [FileSync] Starting FULL content sync for consultant ${consultantId}`);
    console.log(`${'═'.repeat(70)}\n`);

    // Get file search settings to check autoSyncWhatsappAgents
    const [settings] = await db.select().from(fileSearchSettings).where(eq(fileSearchSettings.consultantId, consultantId)).limit(1);

    // Sync consultant's global resources
    const libraryResult = await this.syncAllLibraryDocuments(consultantId);
    const knowledgeResult = await this.syncAllConsultantKnowledgeDocuments(consultantId);
    const exercisesResult = await this.syncAllExercises(consultantId);
    const universityResult = await this.syncAllUniversityLessons(consultantId);
    const consultationsResult = await this.syncAllConsultations(consultantId);

    // Sync WhatsApp agent knowledge if enabled
    let whatsappAgentsResult = { total: 0, synced: 0, failed: 0, agentsProcessed: 0, errors: [] as string[] };
    if (settings?.autoSyncWhatsappAgents) {
      console.log(`\n${'─'.repeat(70)}`);
      console.log(`📱 [FileSync] Syncing WHATSAPP AGENT knowledge...`);
      console.log(`${'─'.repeat(70)}`);
      whatsappAgentsResult = await this.syncAllWhatsappAgentKnowledge(consultantId);
    }

    // Sync client private data (exercise responses, client knowledge, client consultations)
    console.log(`\n${'─'.repeat(70)}`);
    console.log(`🔐 [FileSync] Syncing CLIENT PRIVATE data...`);
    console.log(`${'─'.repeat(70)}`);

    const clients = await db
      .select({ id: users.id, firstName: users.firstName, lastName: users.lastName })
      .from(users)
      .where(and(eq(users.consultantId, consultantId), eq(users.role, 'client')));

    let clientsProcessed = 0;
    let totalExerciseResponses = { total: 0, synced: 0, failed: 0, skipped: 0 };
    let totalClientKnowledge = { total: 0, synced: 0, failed: 0, skipped: 0 };
    let totalClientConsultations = { total: 0, synced: 0, failed: 0, skipped: 0 };
    let totalFinancialData = { total: 0, synced: 0, failed: 0 };

    // Pre-calculate totals for accurate progress tracking
    const clientIds = clients.map(c => c.id);
    
    // Get all exercise submissions for all clients
    const allClientAssignments = clientIds.length > 0 
      ? await db.select({ id: exerciseAssignments.id })
          .from(exerciseAssignments)
          .where(inArray(exerciseAssignments.clientId, clientIds))
      : [];
    const assignmentIds = allClientAssignments.map(a => a.id);
    const allClientSubmissions = assignmentIds.length > 0
      ? await db.query.exerciseSubmissions.findMany({
          where: inArray(exerciseSubmissions.assignmentId, assignmentIds)
        })
      : [];
    const preCalcExerciseResponsesTotal = allClientSubmissions.length;

    // Get all client knowledge documents
    const allClientKnowledge = clientIds.length > 0
      ? await db.query.clientKnowledgeDocuments.findMany({
          where: inArray(clientKnowledgeDocuments.clientId, clientIds)
        })
      : [];
    const preCalcClientKnowledgeTotal = allClientKnowledge.length;

    // Get all completed consultations with content
    const allClientConsultationsRaw = clientIds.length > 0
      ? await db.query.consultations.findMany({
          where: and(
            inArray(consultations.clientId, clientIds),
            eq(consultations.status, 'completed')
          )
        })
      : [];
    const preCalcClientConsultationsTotal = allClientConsultationsRaw.filter(
      c => c.transcript || c.notes || c.summaryEmail
    ).length;

    // Get clients with finance settings (for financial_data category)
    const clientsWithFinanceSettings = clientIds.length > 0
      ? await db.query.userFinanceSettings.findMany({
          where: inArray(userFinanceSettings.clientId, clientIds)
        })
      : [];
    const preCalcFinancialTotal = clientsWithFinanceSettings.length;

    // Pre-calculate totals for assigned content categories
    const allExerciseAssignments = clientIds.length > 0
      ? await db.query.exerciseAssignments.findMany({ where: inArray(exerciseAssignments.clientId, clientIds) })
      : [];
    const preCalcAssignedExercisesTotal = allExerciseAssignments.length;

    const allLibraryAssignments = clientIds.length > 0
      ? await db.query.libraryCategoryClientAssignments.findMany({ where: inArray(libraryCategoryClientAssignments.clientId, clientIds) })
      : [];
    const preCalcAssignedLibraryTotal = allLibraryAssignments.length;

    const allUniversityAssignments = clientIds.length > 0
      ? await db.query.universityYearClientAssignments.findMany({ where: inArray(universityYearClientAssignments.clientId, clientIds) })
      : [];
    const preCalcAssignedUniversityTotal = allUniversityAssignments.length;

    // Goals and tasks are aggregated per client, so total = number of clients with goals/tasks
    const preCalcGoalsTotal = clients.length;
    const preCalcTasksTotal = clients.length;

    // Counters for assigned content
    let totalAssignedExercises = { total: 0, synced: 0, failed: 0 };
    let totalAssignedLibrary = { total: 0, synced: 0, failed: 0 };
    let totalAssignedUniversity = { total: 0, synced: 0, failed: 0 };
    let totalGoals = { total: 0, synced: 0, failed: 0 };
    let totalTasks = { total: 0, synced: 0, failed: 0 };

    // Emit SSE start events with pre-calculated totals
    syncProgressEmitter.emitStart(consultantId, 'exercise_responses', preCalcExerciseResponsesTotal);
    syncProgressEmitter.emitStart(consultantId, 'client_knowledge', preCalcClientKnowledgeTotal);
    syncProgressEmitter.emitStart(consultantId, 'client_consultations', preCalcClientConsultationsTotal);
    if (settings?.autoSyncFinancial) {
      syncProgressEmitter.emitStart(consultantId, 'financial_data', preCalcFinancialTotal);
    }
    syncProgressEmitter.emitStart(consultantId, 'assigned_exercises', preCalcAssignedExercisesTotal);
    syncProgressEmitter.emitStart(consultantId, 'assigned_library', preCalcAssignedLibraryTotal);
    syncProgressEmitter.emitStart(consultantId, 'assigned_university', preCalcAssignedUniversityTotal);
    syncProgressEmitter.emitStart(consultantId, 'goals', preCalcGoalsTotal);
    syncProgressEmitter.emitStart(consultantId, 'tasks', preCalcTasksTotal);

    for (const client of clients) {
      console.log(`   📋 Processing client: ${client.firstName} ${client.lastName} (${client.id.substring(0, 8)}...)`);
      const clientDisplayName = `${client.firstName || ''} ${client.lastName || ''}`.trim() || client.id.substring(0, 8);
      
      // Sync exercise responses to client's private store
      const exerciseResponsesResult = await this.syncAllClientExerciseResponses(client.id, consultantId);
      totalExerciseResponses.total += exerciseResponsesResult.total;
      totalExerciseResponses.synced += exerciseResponsesResult.synced;
      totalExerciseResponses.failed += exerciseResponsesResult.failed;
      totalExerciseResponses.skipped += exerciseResponsesResult.skipped || 0;

      // Sync client knowledge documents to client's private store
      const clientKnowledgeResult = await this.syncAllClientKnowledgeDocuments(client.id, consultantId);
      totalClientKnowledge.total += clientKnowledgeResult.total;
      totalClientKnowledge.synced += clientKnowledgeResult.synced;
      totalClientKnowledge.failed += clientKnowledgeResult.failed;
      totalClientKnowledge.skipped += clientKnowledgeResult.skipped || 0;

      // Sync client consultations to client's private store
      const clientConsultationsResult = await this.syncAllClientConsultations(client.id, consultantId);
      totalClientConsultations.total += clientConsultationsResult.total;
      totalClientConsultations.synced += clientConsultationsResult.synced;
      totalClientConsultations.failed += clientConsultationsResult.failed;
      totalClientConsultations.skipped += clientConsultationsResult.skipped || 0;

      // Sync financial data if enabled (only count if client actually has finance settings)
      if (settings?.autoSyncFinancial) {
        const financialResult = await this.syncClientFinancialData(client.id, consultantId);
        if (financialResult.success) {
          totalFinancialData.synced += 1;
        } else if (financialResult.error !== 'Finance settings not configured for this client') {
          totalFinancialData.failed += 1;
        }
      }

      // Sync assigned content (exercises, library, university, goals, tasks) via inline migration
      // This ensures all audit-expected content is synchronized to client private stores
      const clientExerciseAssigns = await db.query.exerciseAssignments.findMany({
        where: eq(exerciseAssignments.clientId, client.id),
      });
      for (const assignment of clientExerciseAssigns) {
        const result = await this.syncExerciseToClient(assignment.exerciseId, client.id, consultantId);
        totalAssignedExercises.total++;
        if (result.success) {
          totalAssignedExercises.synced++;
        } else {
          totalAssignedExercises.failed++;
        }
        syncProgressEmitter.emitItemProgress(consultantId, 'assigned_exercises', clientDisplayName, 
          totalAssignedExercises.synced + totalAssignedExercises.failed, preCalcAssignedExercisesTotal);
      }

      const clientLibAssigns = await db.query.libraryCategoryClientAssignments.findMany({
        where: eq(libraryCategoryClientAssignments.clientId, client.id),
      });
      for (const assignment of clientLibAssigns) {
        const result = await this.syncLibraryCategoryToClient(assignment.categoryId, client.id, consultantId);
        totalAssignedLibrary.total++;
        if (result.success) {
          totalAssignedLibrary.synced += result.synced;
          totalAssignedLibrary.failed += result.failed;
        } else {
          totalAssignedLibrary.failed++;
        }
        syncProgressEmitter.emitItemProgress(consultantId, 'assigned_library', clientDisplayName,
          totalAssignedLibrary.total, preCalcAssignedLibraryTotal);
      }

      const clientUniAssigns = await db.query.universityYearClientAssignments.findMany({
        where: eq(universityYearClientAssignments.clientId, client.id),
      });
      for (const assignment of clientUniAssigns) {
        const result = await this.syncUniversityYearToClient(assignment.yearId, client.id, consultantId);
        totalAssignedUniversity.total++;
        if (result.success) {
          totalAssignedUniversity.synced += result.synced;
          totalAssignedUniversity.failed += result.failed;
        } else {
          totalAssignedUniversity.failed++;
        }
        syncProgressEmitter.emitItemProgress(consultantId, 'assigned_university', clientDisplayName,
          totalAssignedUniversity.total, preCalcAssignedUniversityTotal);
      }

      // Sync goals and tasks (aggregated documents) - always re-sync to ensure up-to-date
      const goalsResult = await this.syncClientGoals(client.id, consultantId);
      totalGoals.total++;
      if (goalsResult.success) {
        totalGoals.synced++;
      } else {
        totalGoals.failed++;
      }
      syncProgressEmitter.emitItemProgress(consultantId, 'goals', clientDisplayName,
        totalGoals.synced + totalGoals.failed, preCalcGoalsTotal);

      const tasksResult = await this.syncClientTasks(client.id, consultantId);
      totalTasks.total++;
      if (tasksResult.success) {
        totalTasks.synced++;
      } else {
        totalTasks.failed++;
      }
      syncProgressEmitter.emitItemProgress(consultantId, 'tasks', clientDisplayName,
        totalTasks.synced + totalTasks.failed, preCalcTasksTotal);

      // Sync daily reflections
      const reflectionsResult = await this.syncClientDailyReflections(client.id, consultantId);
      if (!reflectionsResult.success && reflectionsResult.error) {
        errors.push(`Client ${clientDisplayName} riflessioni: ${reflectionsResult.error}`);
      }

      // Sync client progress history
      const progressHistResult = await this.syncClientProgress(client.id, consultantId);
      if (!progressHistResult.success && progressHistResult.error) {
        errors.push(`Client ${clientDisplayName} progresso: ${progressHistResult.error}`);
      }

      // Sync library progress  
      const libraryProgResult = await this.syncClientLibraryProgress(client.id, consultantId);
      if (!libraryProgResult.success && libraryProgResult.error) {
        errors.push(`Client ${clientDisplayName} progresso libreria: ${libraryProgResult.error}`);
      }

      // Sync email journey progress
      const emailJourneyResult = await this.syncClientEmailJourneyProgress(client.id, consultantId);
      if (!emailJourneyResult.success && emailJourneyResult.error) {
        errors.push(`Client ${clientDisplayName} email journey: ${emailJourneyResult.error}`);
      }

      clientsProcessed++;
      
      // Calculate real progress for each category (processed items vs pre-calculated totals)
      const exerciseResponsesProgress = totalExerciseResponses.synced + totalExerciseResponses.failed + totalExerciseResponses.skipped;
      const clientKnowledgeProgress = totalClientKnowledge.synced + totalClientKnowledge.failed + totalClientKnowledge.skipped;
      const clientConsultationsProgress = totalClientConsultations.synced + totalClientConsultations.failed + totalClientConsultations.skipped;
      const financialProgress = totalFinancialData.synced + totalFinancialData.failed;
      
      // Emit SSE progress events with real progress vs pre-calculated totals
      syncProgressEmitter.emitItemProgress(consultantId, 'exercise_responses', clientDisplayName, exerciseResponsesProgress, preCalcExerciseResponsesTotal);
      syncProgressEmitter.emitItemProgress(consultantId, 'client_knowledge', clientDisplayName, clientKnowledgeProgress, preCalcClientKnowledgeTotal);
      syncProgressEmitter.emitItemProgress(consultantId, 'client_consultations', clientDisplayName, clientConsultationsProgress, preCalcClientConsultationsTotal);
      if (settings?.autoSyncFinancial) {
        syncProgressEmitter.emitItemProgress(consultantId, 'financial_data', clientDisplayName, financialProgress, preCalcFinancialTotal);
      }
    }

    // Set financial total from pre-calculated value (not incremented per client)
    totalFinancialData.total = preCalcFinancialTotal;

    // Emit SSE complete events with pre-calculated totals for consistency
    syncProgressEmitter.emitProgress({
      type: 'complete',
      category: 'exercise_responses',
      total: preCalcExerciseResponsesTotal,
      current: preCalcExerciseResponsesTotal,
      synced: totalExerciseResponses.synced,
      consultantId,
    });
    syncProgressEmitter.emitProgress({
      type: 'complete',
      category: 'client_knowledge',
      total: preCalcClientKnowledgeTotal,
      current: preCalcClientKnowledgeTotal,
      synced: totalClientKnowledge.synced,
      consultantId,
    });
    syncProgressEmitter.emitProgress({
      type: 'complete',
      category: 'client_consultations',
      total: preCalcClientConsultationsTotal,
      current: preCalcClientConsultationsTotal,
      synced: totalClientConsultations.synced,
      consultantId,
    });
    if (settings?.autoSyncFinancial) {
      syncProgressEmitter.emitProgress({
        type: 'complete',
        category: 'financial_data',
        total: preCalcFinancialTotal,
        current: preCalcFinancialTotal,
        synced: totalFinancialData.synced,
        consultantId,
      });
    }
    syncProgressEmitter.emitProgress({
      type: 'complete',
      category: 'assigned_exercises',
      total: preCalcAssignedExercisesTotal,
      current: preCalcAssignedExercisesTotal,
      synced: totalAssignedExercises.synced,
      consultantId,
    });
    syncProgressEmitter.emitProgress({
      type: 'complete',
      category: 'assigned_library',
      total: preCalcAssignedLibraryTotal,
      current: preCalcAssignedLibraryTotal,
      synced: totalAssignedLibrary.synced,
      consultantId,
    });
    syncProgressEmitter.emitProgress({
      type: 'complete',
      category: 'assigned_university',
      total: preCalcAssignedUniversityTotal,
      current: preCalcAssignedUniversityTotal,
      synced: totalAssignedUniversity.synced,
      consultantId,
    });
    syncProgressEmitter.emitProgress({
      type: 'complete',
      category: 'goals',
      total: preCalcGoalsTotal,
      current: preCalcGoalsTotal,
      synced: totalGoals.synced,
      consultantId,
    });
    syncProgressEmitter.emitProgress({
      type: 'complete',
      category: 'tasks',
      total: preCalcTasksTotal,
      current: preCalcTasksTotal,
      synced: totalTasks.synced,
      consultantId,
    });

    const totalSynced = libraryResult.synced + knowledgeResult.synced + exercisesResult.synced + 
      universityResult.synced + consultationsResult.synced + whatsappAgentsResult.synced +
      totalExerciseResponses.synced + totalClientKnowledge.synced + totalClientConsultations.synced + 
      totalFinancialData.synced + totalAssignedExercises.synced + totalAssignedLibrary.synced +
      totalAssignedUniversity.synced + totalGoals.synced + totalTasks.synced;

    // ============================================================
    // CLEANUP SOURCE ORPHANS - Remove documents whose source was deleted
    // ============================================================
    console.log(`\n${'─'.repeat(70)}`);
    console.log(`🧹 [FileSync] Cleaning up SOURCE ORPHANS (deleted source records)...`);
    console.log(`${'─'.repeat(70)}`);

    let orphansRemoved = 0;
    let orphanErrors: string[] = [];

    // Get all stores for this consultant (consultant store, whatsapp agent stores, client stores)
    const allStores = await db
      .select({ id: fileSearchStores.id, displayName: fileSearchStores.displayName, ownerType: fileSearchStores.ownerType })
      .from(fileSearchStores)
      .where(eq(fileSearchStores.ownerId, consultantId));

    // Also get client stores
    const clientStores = await db
      .select({ 
        id: fileSearchStores.id, 
        displayName: fileSearchStores.displayName,
        ownerType: fileSearchStores.ownerType 
      })
      .from(fileSearchStores)
      .innerJoin(users, eq(users.id, fileSearchStores.ownerId))
      .where(and(
        eq(users.consultantId, consultantId),
        eq(fileSearchStores.ownerType, 'client')
      ));

    const storesToClean = [...allStores, ...clientStores];
    
    // Emit SSE orphan start event
    syncProgressEmitter.emitOrphanStart(consultantId, storesToClean.length);
    
    let storeIndex = 0;
    for (const store of storesToClean) {
      storeIndex++;
      try {
        const cleanupResult = await fileSearchService.cleanupSourceOrphans(store.id, consultantId);
        const storeRemoved = cleanupResult.success ? cleanupResult.removed : 0;
        
        if (cleanupResult.success && cleanupResult.removed > 0) {
          console.log(`   🗑️ ${store.displayName}: removed ${cleanupResult.removed} orphan(s)`);
          orphansRemoved += cleanupResult.removed;
        }
        
        // Emit SSE orphan progress event for each store
        syncProgressEmitter.emitOrphanProgress(consultantId, store.displayName || 'Store senza nome', storeRemoved, storeIndex, storesToClean.length);
        
        if (cleanupResult.errors.length > 0) {
          orphanErrors.push(...cleanupResult.errors.map(e => `${store.displayName}: ${e}`));
        }
      } catch (error: any) {
        console.error(`   ❌ Error cleaning orphans for ${store.displayName}:`, error.message);
        orphanErrors.push(`${store.displayName}: ${error.message}`);
        syncProgressEmitter.emitError(consultantId, 'orphans', `${store.displayName}: ${error.message}`);
      }
    }

    // Emit SSE orphan complete event
    syncProgressEmitter.emitOrphanComplete(consultantId, orphansRemoved, storesToClean.length);

    if (orphansRemoved > 0) {
      console.log(`   ✅ Total source orphans removed: ${orphansRemoved}`);
    } else {
      console.log(`   ✅ No source orphans found`);
    }
    
    console.log(`\n${'═'.repeat(70)}`);
    console.log(`✅ [FileSync] FULL content sync complete for consultant ${consultantId}`);
    console.log(`   📚 Library: ${libraryResult.synced}/${libraryResult.total} synced`);
    console.log(`   📖 Knowledge Base: ${knowledgeResult.synced}/${knowledgeResult.total} synced`);
    console.log(`   🏋️ Exercises: ${exercisesResult.synced}/${exercisesResult.total} synced`);
    console.log(`   🎓 University: ${universityResult.synced}/${universityResult.total} synced`);
    console.log(`   📞 Consultations: ${consultationsResult.synced}/${consultationsResult.total} synced`);
    console.log(`   📱 WhatsApp Agents: ${whatsappAgentsResult.synced}/${whatsappAgentsResult.total} synced (${whatsappAgentsResult.agentsProcessed} agents)`);
    console.log(`   🔐 Client Private Data (${clientsProcessed} clients):`);
    console.log(`      📝 Exercise Responses: ${totalExerciseResponses.synced}/${totalExerciseResponses.total} synced`);
    console.log(`      📚 Client Knowledge: ${totalClientKnowledge.synced}/${totalClientKnowledge.total} synced`);
    console.log(`      📞 Client Consultations: ${totalClientConsultations.synced}/${totalClientConsultations.total} synced`);
    console.log(`      💰 Financial Data: ${totalFinancialData.synced}/${totalFinancialData.total} synced`);
    console.log(`   📋 Assigned Content:`);
    console.log(`      📋 Assigned Exercises: ${totalAssignedExercises.synced}/${totalAssignedExercises.total} synced`);
    console.log(`      📕 Assigned Library: ${totalAssignedLibrary.synced}/${totalAssignedLibrary.total} synced`);
    console.log(`      🎯 Assigned University: ${totalAssignedUniversity.synced}/${totalAssignedUniversity.total} synced`);
    console.log(`      🎯 Goals: ${totalGoals.synced}/${totalGoals.total} synced`);
    console.log(`      ✅ Tasks: ${totalTasks.synced}/${totalTasks.total} synced`);
    console.log(`   🧹 Source Orphans: ${orphansRemoved} removed from ${storesToClean.length} stores`);
    console.log(`${'═'.repeat(70)}\n`);

    syncProgressEmitter.emitAllComplete(consultantId, totalSynced);

    return {
      library: libraryResult,
      knowledgeBase: knowledgeResult,
      exercises: exercisesResult,
      university: universityResult,
      consultations: consultationsResult,
      whatsappAgents: whatsappAgentsResult,
      clientPrivateData: {
        clientsProcessed,
        exerciseResponses: totalExerciseResponses,
        clientKnowledge: totalClientKnowledge,
        clientConsultations: totalClientConsultations,
        financialData: totalFinancialData,
      },
      assignedContent: {
        assignedExercises: totalAssignedExercises,
        assignedLibrary: totalAssignedLibrary,
        assignedUniversity: totalAssignedUniversity,
        goals: totalGoals,
        tasks: totalTasks,
      },
      orphansCleanup: {
        storesChecked: storesToClean.length,
        orphansRemoved,
        errors: orphanErrors,
      },
    };
  }

  // ============================================================
  // CLIENT PRIVATE DATA SYNC - Dati privati del cliente
  // ============================================================
  // PRIVACY CRITICA:
  // - I dati del client A NON devono MAI essere accessibili al client B
  // - Lo store privato del client contiene SOLO i suoi dati personali
  // - Lo store del consultant contiene solo template/libreria (accessibile a tutti)
  // ============================================================

  /**
   * Sync a client's exercise response/submission to their PRIVATE store
   * 
   * This syncs the client's personal answers to exercises, ensuring privacy
   * by storing them only in the client's private FileSearchStore.
   * 
   * @param submissionId - The exercise submission ID (from exerciseSubmissions table)
   * @param clientId - The client's user ID
   * @param consultantId - The consultant's user ID
   */
  static async syncClientExerciseResponse(
    submissionId: string,
    clientId: string,
    consultantId: string,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Get the submission with its assignment and exercise info
      const submission = await db.query.exerciseSubmissions.findFirst({
        where: eq(exerciseSubmissions.id, submissionId),
      });

      if (!submission) {
        return { success: false, error: 'Exercise submission not found' };
      }

      // Get the assignment to verify client ownership and get exercise info
      const assignment = await db.query.exerciseAssignments.findFirst({
        where: eq(exerciseAssignments.id, submission.assignmentId),
      });

      if (!assignment) {
        return { success: false, error: 'Exercise assignment not found' };
      }

      // Verify this submission belongs to the correct client
      if (assignment.clientId !== clientId) {
        return { success: false, error: 'Submission does not belong to this client' };
      }

      // Get the exercise details
      const exercise = await db.query.exercises.findFirst({
        where: eq(exercises.id, assignment.exerciseId),
      });

      if (!exercise) {
        return { success: false, error: 'Exercise not found' };
      }

      // Get or create the client's PRIVATE store
      const clientStore = await fileSearchService.getOrCreateClientStore(clientId, consultantId);
      if (!clientStore) {
        return { success: false, error: 'Failed to get or create client private store' };
      }

      // Extract text from uploaded files (Word, PDF, etc.)
      const extractedFileContents: Array<{ fileName: string; content: string }> = [];
      
      // Helper to normalize file path - add 'uploads/' prefix if missing
      const normalizeFilePath = (fp: string): string => {
        if (fp.startsWith('uploads/') || fp.startsWith('/')) return fp;
        return `uploads/${fp}`;
      };

      // Check for uploaded files in answers
      if (submission.answers && Array.isArray(submission.answers)) {
        for (const answer of submission.answers) {
          if (answer.uploadedFiles && Array.isArray(answer.uploadedFiles)) {
            for (const rawPath of answer.uploadedFiles) {
              try {
                const filePath = normalizeFilePath(rawPath);
                const fileName = filePath.split('/').pop() || rawPath;
                console.log(`🔍 [FileSync] Extracting text from uploaded file: ${filePath}`);
                const extractedText = await extractTextFromFile(filePath);
                if (extractedText && extractedText.trim().length > 0) {
                  extractedFileContents.push({ fileName, content: extractedText });
                  console.log(`✅ [FileSync] Extracted ${extractedText.length} chars from ${fileName}`);
                }
              } catch (extractError: any) {
                console.warn(`⚠️ [FileSync] Failed to extract text from ${rawPath}: ${extractError.message}`);
              }
            }
          }
        }
      }
      
      // Also check attachments array
      if (submission.attachments && Array.isArray(submission.attachments)) {
        for (const rawPath of submission.attachments) {
          try {
            const filePath = normalizeFilePath(rawPath);
            const fileName = filePath.split('/').pop() || rawPath;
            console.log(`🔍 [FileSync] Extracting text from attachment: ${filePath}`);
            const extractedText = await extractTextFromFile(filePath);
            if (extractedText && extractedText.trim().length > 0) {
              extractedFileContents.push({ fileName, content: extractedText });
              console.log(`✅ [FileSync] Extracted ${extractedText.length} chars from ${fileName}`);
            }
          } catch (extractError: any) {
            console.warn(`⚠️ [FileSync] Failed to extract text from attachment ${rawPath}: ${extractError.message}`);
          }
        }
      }

      // Build content from the submission (including extracted file contents)
      const content = this.buildExerciseSubmissionContent(exercise, submission, assignment, extractedFileContents);

      // Upload to client's PRIVATE store
      const uploadResult = await fileSearchService.uploadDocumentFromContent({
        content: content,
        displayName: `[RISPOSTA] ${exercise.title}`,
        storeId: clientStore.storeId,
        sourceType: 'exercise',
        sourceId: submissionId,
        clientId: clientId,
        userId: clientId,
      });

      if (uploadResult.success) {
        console.log(`✅ [FileSync] Client exercise response synced to PRIVATE store: ${exercise.title} (client: ${clientId.substring(0, 8)})`);
      }

      return uploadResult.success
        ? { success: true }
        : { success: false, error: uploadResult.error };
    } catch (error: any) {
      console.error('[FileSync] Error syncing client exercise response:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Build searchable content from an exercise submission
   * @param exercise - The exercise definition
   * @param submission - The submission object
   * @param assignment - The assignment object
   * @param extractedFileContents - Optional array of extracted text from uploaded files
   */
  private static buildExerciseSubmissionContent(
    exercise: any, 
    submission: any, 
    assignment: any,
    extractedFileContents?: Array<{ fileName: string; content: string }>
  ): string {
    const parts: string[] = [];
    
    parts.push(`# Risposta Esercizio: ${exercise.title}`);
    parts.push(`Categoria: ${exercise.category}`);
    parts.push(`Tipo: ${exercise.type}`);
    
    if (submission.submittedAt) {
      const date = new Date(submission.submittedAt).toLocaleDateString('it-IT');
      parts.push(`Data invio: ${date}`);
    }

    if (assignment.status) {
      parts.push(`Stato: ${assignment.status}`);
    }

    if (assignment.score !== null && assignment.score !== undefined) {
      parts.push(`Punteggio: ${assignment.score}`);
    }
    
    // Include the answers
    if (submission.answers && Array.isArray(submission.answers) && submission.answers.length > 0) {
      parts.push(`\n## Risposte`);
      submission.answers.forEach((answer: any, i: number) => {
        parts.push(`\n### Risposta ${i + 1}`);
        if (typeof answer.answer === 'string') {
          parts.push(answer.answer);
        } else if (Array.isArray(answer.answer)) {
          parts.push(answer.answer.join(', '));
        }
      });
    }
    
    if (submission.notes) {
      parts.push(`\n## Note del cliente\n${submission.notes}`);
    }

    // Include consultant feedback if any
    if (assignment.consultantFeedback && Array.isArray(assignment.consultantFeedback)) {
      parts.push(`\n## Feedback del consulente`);
      assignment.consultantFeedback.forEach((fb: any) => {
        parts.push(`- ${fb.feedback}`);
      });
    }

    // Include extracted content from uploaded files (Word, PDF, etc.)
    if (extractedFileContents && extractedFileContents.length > 0) {
      parts.push(`\n## Contenuto File Allegati`);
      extractedFileContents.forEach((file) => {
        parts.push(`\n### File: ${file.fileName}`);
        parts.push(file.content);
      });
    }
    
    return parts.join('\n');
  }

  /**
   * Sync a client's consultation notes to their PRIVATE store
   * 
   * This syncs consultation notes and transcripts specific to a client,
   * ensuring privacy by storing them only in the client's private FileSearchStore.
   * 
   * @param consultationId - The consultation/appointment ID
   * @param clientId - The client's user ID
   * @param consultantId - The consultant's user ID
   */
  static async syncClientConsultationNotes(
    consultationId: string,
    clientId: string,
    consultantId: string,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Get the consultation
      const consultation = await db.query.consultations.findFirst({
        where: and(
          eq(consultations.id, consultationId),
          eq(consultations.clientId, clientId),
        ),
      });

      if (!consultation) {
        return { success: false, error: 'Consultation not found or does not belong to this client' };
      }

      // Only sync if there's content to index
      if (!consultation.transcript && !consultation.notes && !consultation.summaryEmail) {
        return { success: false, error: 'No transcript, notes, or summary to index' };
      }

      // Get or create the client's PRIVATE store
      const clientStore = await fileSearchService.getOrCreateClientStore(clientId, consultantId);
      if (!clientStore) {
        return { success: false, error: 'Failed to get or create client private store' };
      }

      // Build content from the consultation
      const content = this.buildClientConsultationContent(consultation);
      const date = new Date(consultation.scheduledAt).toLocaleDateString('it-IT');

      // Upload to client's PRIVATE store
      const uploadResult = await fileSearchService.uploadDocumentFromContent({
        content: content,
        displayName: `[CONSULENZA PRIVATA] ${date}`,
        storeId: clientStore.storeId,
        sourceType: 'consultation',
        sourceId: consultationId,
        clientId: clientId,
        userId: clientId,
      });

      if (uploadResult.success) {
        console.log(`✅ [FileSync] Client consultation synced to PRIVATE store: ${date} (client: ${clientId.substring(0, 8)})`);
      }

      return uploadResult.success
        ? { success: true }
        : { success: false, error: uploadResult.error };
    } catch (error: any) {
      console.error('[FileSync] Error syncing client consultation notes:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Build searchable content from a client's consultation (for their private store)
   */
  private static buildClientConsultationContent(consultation: any): string {
    const parts: string[] = [];
    const date = new Date(consultation.scheduledAt).toLocaleDateString('it-IT');
    
    parts.push(`# Consulenza del ${date}`);
    parts.push(`Durata: ${consultation.duration} minuti`);
    parts.push(`Stato: ${consultation.status}`);
    
    if (consultation.notes) {
      parts.push(`\n## Note della consulenza\n${consultation.notes}`);
    }
    
    if (consultation.transcript) {
      parts.push(`\n## Trascrizione\n${consultation.transcript}`);
    }
    
    if (consultation.summaryEmail) {
      parts.push(`\n## Riepilogo\n${consultation.summaryEmail}`);
    }
    
    return parts.join('\n');
  }

  /**
   * Sync all exercise responses for a specific client to their PRIVATE store
   */
  static async syncAllClientExerciseResponses(
    clientId: string,
    consultantId: string,
  ): Promise<{
    total: number;
    synced: number;
    failed: number;
    skipped: number;
    errors: string[];
  }> {
    try {
      // Get all assignments for this client
      const assignments = await db.query.exerciseAssignments.findMany({
        where: eq(exerciseAssignments.clientId, clientId),
      });

      // Get all submissions for these assignments
      const assignmentIds = assignments.map(a => a.id);
      const submissions = await db.query.exerciseSubmissions.findMany({
        where: and(
          isNotNull(exerciseSubmissions.submittedAt),
        ),
      });

      // Filter to only submissions that belong to this client's assignments
      const clientSubmissions = submissions.filter(s => 
        assignmentIds.includes(s.assignmentId)
      );

      let synced = 0;
      let failed = 0;
      let skipped = 0;
      const errors: string[] = [];

      console.log(`\n${'═'.repeat(60)}`);
      console.log(`🔐 [FileSync] Syncing ${clientSubmissions.length} exercise responses for client ${clientId.substring(0, 8)} to PRIVATE store`);
      console.log(`${'═'.repeat(60)}\n`);

      for (const submission of clientSubmissions) {
        const isAlreadyIndexed = await fileSearchService.isDocumentIndexed('exercise', submission.id);
        if (isAlreadyIndexed) {
          skipped++;
          continue;
        }

        const result = await this.syncClientExerciseResponse(submission.id, clientId, consultantId);
        if (result.success) {
          synced++;
        } else {
          failed++;
          errors.push(`Submission ${submission.id}: ${result.error}`);
        }
      }

      console.log(`✅ [FileSync] Client exercise responses sync complete - Synced: ${synced}, Skipped: ${skipped}, Failed: ${failed}`);

      return {
        total: clientSubmissions.length,
        synced,
        failed,
        skipped,
        errors,
      };
    } catch (error: any) {
      console.error('[FileSync] Error syncing all client exercise responses:', error);
      return {
        total: 0,
        synced: 0,
        failed: 1,
        skipped: 0,
        errors: [error.message],
      };
    }
  }

  /**
   * Sync all consultations for a specific client to their PRIVATE store
   */
  static async syncAllClientConsultations(
    clientId: string,
    consultantId: string,
  ): Promise<{
    total: number;
    synced: number;
    failed: number;
    skipped: number;
    errors: string[];
  }> {
    try {
      // Get all completed consultations for this client
      const clientConsultations = await db.query.consultations.findMany({
        where: and(
          eq(consultations.clientId, clientId),
          eq(consultations.status, 'completed'),
        ),
      });

      // Filter to only those with content to index
      const consultationsWithContent = clientConsultations.filter(
        c => c.transcript || c.notes || c.summaryEmail
      );

      let synced = 0;
      let failed = 0;
      let skipped = 0;
      const errors: string[] = [];

      console.log(`\n${'═'.repeat(60)}`);
      console.log(`🔐 [FileSync] Syncing ${consultationsWithContent.length} consultations for client ${clientId.substring(0, 8)} to PRIVATE store`);
      console.log(`${'═'.repeat(60)}\n`);

      for (const consultation of consultationsWithContent) {
        const isAlreadyIndexed = await fileSearchService.isDocumentIndexed('consultation', `client_${consultation.id}`);
        if (isAlreadyIndexed) {
          skipped++;
          continue;
        }

        const result = await this.syncClientConsultationNotes(consultation.id, clientId, consultantId);
        if (result.success) {
          synced++;
        } else {
          failed++;
          errors.push(`Consultation ${consultation.id}: ${result.error}`);
        }
      }

      console.log(`✅ [FileSync] Client consultations sync complete - Synced: ${synced}, Skipped: ${skipped}, Failed: ${failed}`);

      return {
        total: consultationsWithContent.length,
        synced,
        failed,
        skipped,
        errors,
      };
    } catch (error: any) {
      console.error('[FileSync] Error syncing all client consultations:', error);
      return {
        total: 0,
        synced: 0,
        failed: 1,
        skipped: 0,
        errors: [error.message],
      };
    }
  }

  /**
   * Sync ALL private data for a client (exercise responses + consultations)
   */
  static async syncAllPrivateDataForClient(
    clientId: string,
    consultantId: string,
  ): Promise<{
    exerciseResponses: { total: number; synced: number; failed: number; skipped: number; errors: string[] };
    consultations: { total: number; synced: number; failed: number; skipped: number; errors: string[] };
  }> {
    console.log(`\n${'═'.repeat(70)}`);
    console.log(`🔐 [FileSync] Starting PRIVATE data sync for client ${clientId.substring(0, 8)}`);
    console.log(`${'═'.repeat(70)}\n`);

    const exerciseResult = await this.syncAllClientExerciseResponses(clientId, consultantId);
    const consultationsResult = await this.syncAllClientConsultations(clientId, consultantId);

    console.log(`\n${'═'.repeat(70)}`);
    console.log(`✅ [FileSync] PRIVATE data sync complete for client ${clientId.substring(0, 8)}`);
    console.log(`   📝 Exercise Responses: ${exerciseResult.synced}/${exerciseResult.total} synced`);
    console.log(`   📞 Consultations: ${consultationsResult.synced}/${consultationsResult.total} synced`);
    console.log(`${'═'.repeat(70)}\n`);

    return {
      exerciseResponses: exerciseResult,
      consultations: consultationsResult,
    };
  }

  /**
   * Get info about a client's private store
   */
  static async getClientStoreInfo(clientId: string): Promise<{
    hasStore: boolean;
    storeId?: string;
    storeName?: string;
    documentCount?: number;
  }> {
    const store = await db.query.fileSearchStores.findFirst({
      where: and(
        eq(fileSearchStores.ownerId, clientId),
        eq(fileSearchStores.ownerType, 'client'),
        eq(fileSearchStores.isActive, true),
      ),
    });

    if (!store) {
      return { hasStore: false };
    }

    return {
      hasStore: true,
      storeId: store.id,
      storeName: store.googleStoreName,
      documentCount: store.documentCount || 0,
    };
  }

  /**
   * Run a Post-Import Audit to verify indexing status of all content
   * 
   * @param consultantId - The consultant's user ID
   * @returns Audit summary with health score and recommendations
   */
  static async runPostImportAudit(consultantId: string): Promise<{
    summary: {
      library: { total: number; indexed: number; missing: string[] };
      knowledgeBase: { total: number; indexed: number; missing: string[] };
      exercises: { total: number; indexed: number; missing: string[] };
    };
    recommendations: string[];
    healthScore: number;
  }> {
    console.log(`\n${'═'.repeat(60)}`);
    console.log(`🔍 [FileSync] Running Post-Import Audit for consultant ${consultantId}`);
    console.log(`${'═'.repeat(60)}\n`);

    const libraryResult = await this.auditLibraryDocuments(consultantId);
    const knowledgeBaseResult = await this.auditKnowledgeDocuments(consultantId);
    const exercisesResult = await this.auditExercises(consultantId);

    const totalDocs = libraryResult.total + knowledgeBaseResult.total + exercisesResult.total;
    const totalIndexed = libraryResult.indexed + knowledgeBaseResult.indexed + exercisesResult.indexed;
    const healthScore = totalDocs > 0 ? Math.round((totalIndexed / totalDocs) * 100) : 100;

    const recommendations: string[] = [];

    if (libraryResult.missing.length > 0) {
      recommendations.push(`Sincronizza ${libraryResult.missing.length} documenti libreria mancanti`);
    }
    if (knowledgeBaseResult.missing.length > 0) {
      recommendations.push(`Sincronizza ${knowledgeBaseResult.missing.length} documenti knowledge base mancanti`);
    }
    if (exercisesResult.missing.length > 0) {
      recommendations.push(`Sincronizza ${exercisesResult.missing.length} esercizi mancanti`);
    }

    if (healthScore < 50) {
      recommendations.push('⚠️ Health Score basso: esegui una sincronizzazione completa');
    } else if (healthScore < 80) {
      recommendations.push('💡 Consigliato: sincronizza i contenuti mancanti per migliorare le performance AI');
    } else if (healthScore === 100) {
      recommendations.push('✅ Tutti i contenuti sono indicizzati correttamente');
    }

    console.log(`\n${'═'.repeat(60)}`);
    console.log(`✅ [FileSync] Post-Import Audit Complete`);
    console.log(`   📚 Library: ${libraryResult.indexed}/${libraryResult.total} indexed`);
    console.log(`   📖 Knowledge Base: ${knowledgeBaseResult.indexed}/${knowledgeBaseResult.total} indexed`);
    console.log(`   🏋️ Exercises: ${exercisesResult.indexed}/${exercisesResult.total} indexed`);
    console.log(`   🏥 Health Score: ${healthScore}%`);
    console.log(`${'═'.repeat(60)}\n`);

    return {
      summary: {
        library: libraryResult,
        knowledgeBase: knowledgeBaseResult,
        exercises: exercisesResult,
      },
      recommendations,
      healthScore,
    };
  }

  private static async auditLibraryDocuments(consultantId: string): Promise<{
    total: number;
    indexed: number;
    missing: string[];
  }> {
    const docs = await db.query.libraryDocuments.findMany({
      where: eq(libraryDocuments.createdBy, consultantId),
    });

    const missing: string[] = [];
    let indexed = 0;

    for (const doc of docs) {
      const isIndexed = await fileSearchService.isDocumentIndexed('library', doc.id);
      if (isIndexed) {
        indexed++;
      } else {
        missing.push(doc.title);
      }
    }

    return {
      total: docs.length,
      indexed,
      missing,
    };
  }

  private static async auditKnowledgeDocuments(consultantId: string): Promise<{
    total: number;
    indexed: number;
    missing: string[];
  }> {
    const docs = await db.query.consultantKnowledgeDocuments.findMany({
      where: and(
        eq(consultantKnowledgeDocuments.consultantId, consultantId),
        eq(consultantKnowledgeDocuments.status, 'indexed'),
      ),
    });

    const missing: string[] = [];
    let indexed = 0;

    for (const doc of docs) {
      const isIndexed = await fileSearchService.isDocumentIndexed('knowledge_base', doc.id);
      if (isIndexed) {
        indexed++;
      } else {
        missing.push(doc.title);
      }
    }

    return {
      total: docs.length,
      indexed,
      missing,
    };
  }

  private static async auditExercises(consultantId: string): Promise<{
    total: number;
    indexed: number;
    missing: string[];
  }> {
    const allExercises = await db.query.exercises.findMany({
      where: eq(exercises.createdBy, consultantId),
    });

    const missing: string[] = [];
    let indexed = 0;

    for (const exercise of allExercises) {
      const isIndexed = await fileSearchService.isDocumentIndexed('exercise', exercise.id);
      if (isIndexed) {
        indexed++;
      } else {
        missing.push(exercise.title);
      }
    }

    return {
      total: allExercises.length,
      indexed,
      missing,
    };
  }

  // ============================================================
  // CLIENT KNOWLEDGE DOCUMENTS SYNC
  // ============================================================

  /**
   * Sync a client knowledge document to their PRIVATE FileSearchStore
   * 
   * @param documentId - The client knowledge document ID
   * @param clientId - The client's user ID
   * @param consultantId - The consultant's user ID
   */
  static async syncClientKnowledgeDocument(
    documentId: string,
    clientId: string,
    consultantId: string,
    maxRetries: number = 3,
  ): Promise<{ success: boolean; error?: string }> {
    let doc = null;
    let lastStatus = 'unknown';
    
    // Retry loop to handle race condition when document is just being indexed
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      doc = await db.query.clientKnowledgeDocuments.findFirst({
        where: and(
          eq(clientKnowledgeDocuments.id, documentId),
          eq(clientKnowledgeDocuments.clientId, clientId),
        ),
      });

      if (!doc) {
        return { success: false, error: 'Client knowledge document not found' };
      }
      
      lastStatus = doc.status;
      
      if (doc.status === 'indexed') {
        break; // Document is ready for sync
      }
      
      // If not indexed yet and we have retries left, wait and try again
      if (attempt < maxRetries) {
        console.log(`⏳ [FileSync] Client document ${documentId} status is '${doc.status}', waiting for indexed status (attempt ${attempt}/${maxRetries})...`);
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt)); // Exponential backoff
      }
    }
    
    if (!doc || doc.status !== 'indexed') {
      return { success: false, error: `Document status is '${lastStatus}' after ${maxRetries} attempts, expected 'indexed'` };
    }

    // Verify the client has a consultant assigned
    if (!consultantId) {
      return { success: false, error: 'Client must be associated with a consultant to sync documents' };
    }
    
    try {
      const isAlreadyIndexed = await fileSearchService.isDocumentIndexed('knowledge_base', documentId);
      if (isAlreadyIndexed) {
        console.log(`📌 [FileSync] Client knowledge document already indexed: ${documentId}`);
        return { success: true };
      }

      // Get or create the client's PRIVATE store (NOT the consultant's store)
      const clientStore = await fileSearchService.getOrCreateClientStore(clientId, consultantId);
      if (!clientStore) {
        return { success: false, error: 'Failed to get or create client private store' };
      }

      // Build content from the document
      const content = this.buildClientKnowledgeDocumentContent(doc);
      
      // Upload to client's PRIVATE store with clientId set to distinguish from consultant docs
      const uploadResult = await fileSearchService.uploadDocumentFromContent({
        content: content,
        displayName: `[CLIENT KB] ${doc.title}`,
        storeId: clientStore.storeId,
        sourceType: 'knowledge_base',
        sourceId: documentId,
        clientId: clientId,
        userId: clientId,
      });

      if (uploadResult.success) {
        console.log(`✅ [FileSync] Client knowledge document synced to PRIVATE store: ${doc.title} (client: ${clientId.substring(0, 8)})`);
      }

      return uploadResult.success 
        ? { success: true }
        : { success: false, error: uploadResult.error };
    } catch (error: any) {
      console.error('[FileSync] Error syncing client knowledge document:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Build searchable content from a client knowledge document
   */
  private static buildClientKnowledgeDocumentContent(doc: any): string {
    const parts: string[] = [];
    
    parts.push(`# ${doc.title}`);
    
    if (doc.category) {
      parts.push(`Categoria: ${doc.category}`);
    }
    
    if (doc.description) {
      parts.push(`\n## Descrizione\n${doc.description}`);
    }
    
    // Use extracted content if available, otherwise use summary
    if (doc.extractedContent) {
      parts.push(`\n## Contenuto\n${doc.extractedContent}`);
    } else if (doc.contentSummary) {
      parts.push(`\n## Riepilogo\n${doc.contentSummary}`);
    }
    
    // Include keywords if present
    if (doc.keywords && Array.isArray(doc.keywords) && doc.keywords.length > 0) {
      parts.push(`\n## Parole chiave\n${doc.keywords.join(', ')}`);
    }
    
    // Include tags if present
    if (doc.tags && Array.isArray(doc.tags) && doc.tags.length > 0) {
      parts.push(`\n## Tag\n${doc.tags.join(', ')}`);
    }
    
    return parts.join('\n');
  }

  /**
   * Bulk sync all client knowledge documents for a specific client to their PRIVATE store
   */
  static async syncAllClientKnowledgeDocuments(
    clientId: string,
    consultantId: string,
  ): Promise<{
    total: number;
    synced: number;
    failed: number;
    skipped: number;
    errors: string[];
  }> {
    try {
      // Verify the client has a consultant assigned
      if (!consultantId) {
        return {
          total: 0,
          synced: 0,
          failed: 1,
          skipped: 0,
          errors: ['Client must be associated with a consultant to sync documents'],
        };
      }

      const docs = await db.query.clientKnowledgeDocuments.findMany({
        where: and(
          eq(clientKnowledgeDocuments.clientId, clientId),
          eq(clientKnowledgeDocuments.status, 'indexed')
        ),
        orderBy: [desc(clientKnowledgeDocuments.priority)],
      });

      let synced = 0;
      let failed = 0;
      let skipped = 0;
      const errors: string[] = [];

      console.log(`\n${'═'.repeat(60)}`);
      console.log(`🔐 [FileSync] Syncing ${docs.length} knowledge documents for client ${clientId.substring(0, 8)} to PRIVATE store`);
      console.log(`${'═'.repeat(60)}\n`);

      for (const doc of docs) {
        const isAlreadyIndexed = await fileSearchService.isDocumentIndexed('knowledge_base', doc.id);
        if (isAlreadyIndexed) {
          skipped++;
          continue;
        }

        const result = await this.syncClientKnowledgeDocument(doc.id, clientId, consultantId);
        if (result.success) {
          synced++;
        } else {
          failed++;
          errors.push(`${doc.title}: ${result.error}`);
        }
      }

      console.log(`✅ [FileSync] Client knowledge documents sync complete - Synced: ${synced}, Skipped: ${skipped}, Failed: ${failed}`);

      return {
        total: docs.length,
        synced,
        failed,
        skipped,
        errors,
      };
    } catch (error: any) {
      console.error('[FileSync] Error syncing all client knowledge documents:', error);
      return {
        total: 0,
        synced: 0,
        failed: 1,
        skipped: 0,
        errors: [error.message],
      };
    }
  }

  /**
   * Auto-sync on client knowledge document upload/index
   */
  static async onClientKnowledgeDocumentIndexed(
    documentId: string,
    clientId: string,
    consultantId: string
  ): Promise<void> {
    try {
      const result = await this.syncClientKnowledgeDocument(documentId, clientId, consultantId);
      if (!result.success) {
        console.warn(`⚠️ [FileSync] Failed to auto-sync client knowledge document: ${result.error}`);
      }
    } catch (error) {
      console.error('[FileSync] Client knowledge auto-sync error:', error);
    }
  }

  /**
   * Audit client knowledge documents for a specific client
   */
  private static async auditClientKnowledgeDocuments(clientId: string): Promise<{
    total: number;
    indexed: number;
    missing: string[];
  }> {
    const docs = await db.query.clientKnowledgeDocuments.findMany({
      where: and(
        eq(clientKnowledgeDocuments.clientId, clientId),
        eq(clientKnowledgeDocuments.status, 'indexed'),
      ),
    });

    const missing: string[] = [];
    let indexed = 0;

    for (const doc of docs) {
      const isIndexed = await fileSearchService.isDocumentIndexed('knowledge_base', doc.id);
      if (isIndexed) {
        indexed++;
      } else {
        missing.push(doc.title);
      }
    }

    return {
      total: docs.length,
      indexed,
      missing,
    };
  }

  /**
   * Run a COMPREHENSIVE Post-Import Audit to verify indexing status of ALL content
   * Returns full object details (not just titles) for the audit UI
   * 
   * @param consultantId - The consultant's user ID
   * @returns Detailed audit with full object info for each missing item
   */
  static async runComprehensiveAudit(consultantId: string): Promise<{
    consultant: {
      library: { total: number; indexed: number; missing: Array<{ id: string; title: string; type: string }> };
      knowledgeBase: { total: number; indexed: number; missing: Array<{ id: string; title: string }> };
      exercises: { total: number; indexed: number; missing: Array<{ id: string; title: string }> };
      university: { total: number; indexed: number; missing: Array<{ id: string; title: string; lessonTitle: string }> };
    };
    clients: Array<{
      clientId: string;
      clientName: string;
      clientEmail: string;
      exerciseResponses: { total: number; indexed: number; missing: Array<{ id: string; exerciseTitle: string; submittedAt: Date | null }> };
      consultationNotes: { total: number; indexed: number; missing: Array<{ id: string; date: Date; summary: string }> };
      knowledgeDocs: { total: number; indexed: number; missing: Array<{ id: string; title: string }> };
      hasFinancialDataIndexed: boolean;
      assignedExercises: { total: number; indexed: number; missing: Array<{ id: string; title: string }> };
      assignedLibrary: { total: number; indexed: number; missing: Array<{ id: string; title: string; categoryName: string }> };
      assignedUniversity: { total: number; indexed: number; missing: Array<{ id: string; title: string; yearName: string }> };
      goals: { total: number; indexed: number; missing: Array<{ id: string; title: string }> };
      tasks: { total: number; indexed: number; missing: Array<{ id: string; title: string }> };
      dailyReflections: { total: number; indexed: number; missing: Array<{ id: string; date: string }> };
      clientProgressHistory: { total: number; indexed: number; missing: Array<{ id: string; date: string }> };
      libraryProgress: { total: number; indexed: number; missing: Array<{ id: string; documentTitle: string }> };
      emailJourneyProgress: { total: number; indexed: number; missing: Array<{ id: string; templateTitle: string }> };
    }>;
    whatsappAgents: Array<{
      agentId: string;
      agentName: string;
      knowledgeItems: { total: number; indexed: number; missing: Array<{ id: string; title: string; type: string }> };
    }>;
    summary: { totalMissing: number; consultantMissing: number; clientsMissing: number; whatsappAgentsMissing: number; healthScore: number };
    recommendations: string[];
  }> {
    console.log(`\n${'═'.repeat(60)}`);
    console.log(`🔍 [FileSync] Running FAST Audit for consultant ${consultantId}`);
    console.log(`${'═'.repeat(60)}\n`);

    // FAST APPROACH: Count from DB and compare with file_search_documents table
    // Instead of calling API for each document, just use SQL counts
    
    console.log(`📊 [Audit] Step 1: Fetching library documents...`);
    // Count items in source tables
    const libraryDocs = await db.select({ id: libraryDocuments.id, title: libraryDocuments.title, contentType: libraryDocuments.contentType })
      .from(libraryDocuments).where(eq(libraryDocuments.createdBy, consultantId));
    console.log(`📊 [Audit] Found ${libraryDocs.length} library docs`);
    
    console.log(`📊 [Audit] Step 2: Fetching knowledge documents...`);
    const knowledgeDocs = await db.select({ id: consultantKnowledgeDocuments.id, title: consultantKnowledgeDocuments.title })
      .from(consultantKnowledgeDocuments).where(eq(consultantKnowledgeDocuments.consultantId, consultantId));
    console.log(`📊 [Audit] Found ${knowledgeDocs.length} knowledge docs`);
    
    console.log(`📊 [Audit] Step 3: Fetching exercises...`);
    const allExercises = await db.select({ id: exercises.id, title: exercises.title })
      .from(exercises).where(eq(exercises.createdBy, consultantId));
    console.log(`📊 [Audit] Found ${allExercises.length} exercises`);
    
    console.log(`📊 [Audit] Step 4: Fetching university years...`);
    // University lessons via join - get all years for consultant first, then get lessons
    const consultantYears = await db.select({ id: universityYears.id })
      .from(universityYears).where(eq(universityYears.createdBy, consultantId));
    console.log(`📊 [Audit] Found ${consultantYears.length} university years`);
    const yearIds = consultantYears.map(y => y.id);
    
    let universityLessonsList: { id: string; title: string }[] = [];
    if (yearIds.length > 0) {
      const trimesters = await db.select({ id: universityTrimesters.id })
        .from(universityTrimesters).where(inArray(universityTrimesters.yearId, yearIds));
      const trimesterIds = trimesters.map(t => t.id);
      
      if (trimesterIds.length > 0) {
        const modules = await db.select({ id: universityModules.id })
          .from(universityModules).where(inArray(universityModules.trimesterId, trimesterIds));
        const moduleIds = modules.map(m => m.id);
        
        if (moduleIds.length > 0) {
          universityLessonsList = await db.select({ id: universityLessons.id, title: universityLessons.title })
            .from(universityLessons).where(inArray(universityLessons.moduleId, moduleIds));
        }
      }
    }

    // Get indexed documents from file_search_documents for this consultant
    // First get the consultant's store(s)
    const consultantStores = await db.select({ id: fileSearchStores.id })
      .from(fileSearchStores)
      .where(eq(fileSearchStores.ownerId, consultantId));
    
    const storeIds = consultantStores.map(s => s.id);
    
    let indexedDocs: { sourceType: string | null; sourceId: string | null }[] = [];
    if (storeIds.length > 0) {
      const indexedDocsRaw = await db.select({
        sourceType: fileSearchDocuments.sourceType,
        sourceId: fileSearchDocuments.sourceId,
      })
        .from(fileSearchDocuments)
        .where(and(
          inArray(fileSearchDocuments.storeId, storeIds),
          eq(fileSearchDocuments.status, 'indexed')
        ));
      indexedDocs = indexedDocsRaw.map(r => ({ sourceType: r.sourceType, sourceId: r.sourceId }));
    }

    const indexedLibraryIds = new Set(indexedDocs.filter(d => d.sourceType === 'library').map(d => d.sourceId));
    const indexedKnowledgeIds = new Set(indexedDocs.filter(d => d.sourceType === 'knowledge_base').map(d => d.sourceId));
    const indexedExerciseIds = new Set(indexedDocs.filter(d => d.sourceType === 'exercise').map(d => d.sourceId));
    const indexedUniversityIds = new Set(indexedDocs.filter(d => d.sourceType === 'university_lesson').map(d => d.sourceId));

    // Calculate missing
    const libraryMissing = libraryDocs.filter(d => !indexedLibraryIds.has(d.id)).map(d => ({ id: d.id, title: d.title, type: d.contentType || 'document' }));
    const knowledgeMissing = knowledgeDocs.filter(d => !indexedKnowledgeIds.has(d.id)).map(d => ({ id: d.id, title: d.title }));
    const exercisesMissing = allExercises.filter(d => !indexedExerciseIds.has(d.id)).map(d => ({ id: d.id, title: d.title }));
    const universityMissing = universityLessonsList.filter(d => !indexedUniversityIds.has(d.id)).map(d => ({ id: d.id, title: d.title, lessonTitle: d.title }));

    const libraryResult = { total: libraryDocs.length, indexed: libraryDocs.length - libraryMissing.length, missing: libraryMissing };
    const knowledgeBaseResult = { total: knowledgeDocs.length, indexed: knowledgeDocs.length - knowledgeMissing.length, missing: knowledgeMissing };
    const exercisesResult = { total: allExercises.length, indexed: allExercises.length - exercisesMissing.length, missing: exercisesMissing };
    const universityResult = { total: universityLessonsList.length, indexed: universityLessonsList.length - universityMissing.length, missing: universityMissing };

    // Get all clients
    const clientUsers = await db.select({ id: users.id, firstName: users.firstName, lastName: users.lastName, email: users.email })
      .from(users).where(and(eq(users.consultantId, consultantId), eq(users.role, 'client')));

    // For clients - simplified counts
    const clientsAudit = [];
    let totalClientsMissing = 0;

    for (const client of clientUsers) {
      // Count exercise submissions for this client
      const clientAssignments = await db.select({ id: exerciseAssignments.id, exerciseId: exerciseAssignments.exerciseId })
        .from(exerciseAssignments).where(eq(exerciseAssignments.clientId, client.id));
      const assignmentIds = clientAssignments.map(a => a.id);
      
      const clientSubmissions = assignmentIds.length > 0 
        ? await db.select({ id: exerciseSubmissions.id, assignmentId: exerciseSubmissions.assignmentId, submittedAt: exerciseSubmissions.submittedAt })
            .from(exerciseSubmissions).where(isNotNull(exerciseSubmissions.submittedAt))
            .then(subs => subs.filter(s => assignmentIds.includes(s.assignmentId)))
        : [];

      // Count consultations
      const clientConsultations = await db.select({ id: consultations.id, scheduledAt: consultations.scheduledAt, notes: consultations.notes })
        .from(consultations).where(and(eq(consultations.clientId, client.id), eq(consultations.status, 'completed')));
      const consultationsWithContent = clientConsultations.filter(c => c.notes);

      // Count client knowledge docs
      const clientKnowledge = await db.select({ id: clientKnowledgeDocuments.id, title: clientKnowledgeDocuments.title })
        .from(clientKnowledgeDocuments).where(eq(clientKnowledgeDocuments.clientId, client.id));

      // === NEW: Query ASSIGNED content for this client ===
      
      // 1. Assigned Exercises - get exercises assigned to client via exerciseAssignments
      const assignedExerciseIds = clientAssignments.map(a => a.exerciseId);
      let assignedExercisesList: { id: string; title: string }[] = [];
      if (assignedExerciseIds.length > 0) {
        assignedExercisesList = await db.select({ id: exercises.id, title: exercises.title })
          .from(exercises).where(inArray(exercises.id, assignedExerciseIds));
      }
      
      // 2. Assigned Library - get library docs from assigned categories
      const libraryCategoryAssigns = await db.select({ 
        categoryId: libraryCategoryClientAssignments.categoryId 
      })
        .from(libraryCategoryClientAssignments)
        .where(eq(libraryCategoryClientAssignments.clientId, client.id));
      const assignedCategoryIds = libraryCategoryAssigns.map(a => a.categoryId);
      
      let assignedLibraryDocs: { id: string; title: string; categoryId: string | null }[] = [];
      let categoryNames: Map<string, string> = new Map();
      if (assignedCategoryIds.length > 0) {
        assignedLibraryDocs = await db.select({ 
          id: libraryDocuments.id, 
          title: libraryDocuments.title,
          categoryId: libraryDocuments.categoryId
        })
          .from(libraryDocuments)
          .where(inArray(libraryDocuments.categoryId, assignedCategoryIds));
        
        // Get category names for display
        const categories = await db.select({ id: libraryCategories.id, name: libraryCategories.name })
          .from(libraryCategories)
          .where(inArray(libraryCategories.id, assignedCategoryIds));
        categoryNames = new Map(categories.map(c => [c.id, c.name]));
      }
      
      // 3. Assigned University - get lessons from assigned years
      const universityYearAssigns = await db.select({ 
        yearId: universityYearClientAssignments.yearId 
      })
        .from(universityYearClientAssignments)
        .where(eq(universityYearClientAssignments.clientId, client.id));
      const assignedYearIds = universityYearAssigns.map(a => a.yearId);
      
      let assignedLessons: { id: string; title: string; yearId: string | null }[] = [];
      let yearNames: Map<string, string> = new Map();
      if (assignedYearIds.length > 0) {
        // Get trimesters for assigned years
        const trimesters = await db.select({ id: universityTrimesters.id, yearId: universityTrimesters.yearId })
          .from(universityTrimesters).where(inArray(universityTrimesters.yearId, assignedYearIds));
        const trimesterIds = trimesters.map(t => t.id);
        const trimesterToYear = new Map(trimesters.map(t => [t.id, t.yearId]));
        
        if (trimesterIds.length > 0) {
          // Get modules for those trimesters
          const modules = await db.select({ id: universityModules.id, trimesterId: universityModules.trimesterId })
            .from(universityModules).where(inArray(universityModules.trimesterId, trimesterIds));
          const moduleIds = modules.map(m => m.id);
          const moduleToTrimester = new Map(modules.map(m => [m.id, m.trimesterId]));
          
          if (moduleIds.length > 0) {
            // Get lessons for those modules
            const lessons = await db.select({ id: universityLessons.id, title: universityLessons.title, moduleId: universityLessons.moduleId })
              .from(universityLessons).where(inArray(universityLessons.moduleId, moduleIds));
            
            // Map lessons to their yearId
            assignedLessons = lessons.map(l => {
              const trimesterId = moduleToTrimester.get(l.moduleId);
              const yearId = trimesterId ? trimesterToYear.get(trimesterId) : null;
              return { id: l.id, title: l.title, yearId: yearId || null };
            });
          }
        }
        
        // Get year names for display
        const years = await db.select({ id: universityYears.id, title: universityYears.title })
          .from(universityYears)
          .where(inArray(universityYears.id, assignedYearIds));
        yearNames = new Map(years.map(y => [y.id, y.title]));
      }
      
      // 4. Client Goals
      const clientGoals = await db.select({ id: goals.id, title: goals.title })
        .from(goals).where(eq(goals.clientId, client.id));
      
      // 5. Client Tasks (from consultation_tasks)
      const clientTasks = await db.select({ id: consultationTasks.id, title: consultationTasks.title })
        .from(consultationTasks).where(eq(consultationTasks.clientId, client.id));

      // 6. Client Daily Reflections
      const clientReflections = await db.select({ id: dailyReflections.id, date: dailyReflections.date })
        .from(dailyReflections).where(eq(dailyReflections.clientId, client.id));

      // 7. Client Progress History
      const clientProgressHist = await db.select({ id: clientProgress.id, date: clientProgress.date })
        .from(clientProgress).where(eq(clientProgress.clientId, client.id));

      // 8. Client Library Progress
      const clientLibProgress = await db.select({ 
          id: clientLibraryProgress.id, 
          documentId: clientLibraryProgress.documentId
        })
        .from(clientLibraryProgress).where(eq(clientLibraryProgress.clientId, client.id));

      // 9. Client Email Journey Progress  
      const clientEmailProgress = await db.select({ id: clientEmailJourneyProgress.id })
        .from(clientEmailJourneyProgress).where(eq(clientEmailJourneyProgress.clientId, client.id));

      // Get indexed documents for this client - use simple query without innerJoin
      const clientIndexedRaw = await db.select({
        sourceType: fileSearchDocuments.sourceType,
        sourceId: fileSearchDocuments.sourceId,
      })
        .from(fileSearchDocuments)
        .where(and(eq(fileSearchDocuments.clientId, client.id), eq(fileSearchDocuments.status, 'indexed')));
      const clientIndexed = clientIndexedRaw.map(r => ({ sourceType: r.sourceType, sourceId: r.sourceId }));

      // Existing indexed sets
      const indexedSubmissionIds = new Set(clientIndexed.filter(d => d.sourceType === 'exercise').map(d => d.sourceId));
      const indexedConsultationIds = new Set(clientIndexed.filter(d => d.sourceType === 'consultation').map(d => d.sourceId));
      const indexedClientKnowledgeIds = new Set(clientIndexed.filter(d => d.sourceType === 'knowledge_base').map(d => d.sourceId));
      
      // NEW: Indexed sets for assigned content (using same sourceTypes for synced content)
      const indexedExerciseTemplateIds = new Set(clientIndexed.filter(d => d.sourceType === 'exercise').map(d => d.sourceId));
      const indexedLibraryCopyIds = new Set(clientIndexed.filter(d => d.sourceType === 'library').map(d => d.sourceId));
      const indexedUniversityCopyIds = new Set(clientIndexed.filter(d => d.sourceType === 'university_lesson').map(d => d.sourceId));
      // Goals and tasks are saved with sourceId=clientId (one document per client containing all goals/tasks)
      const hasGoalsIndexed = clientIndexed.some(d => d.sourceType === 'goal' && d.sourceId === client.id);
      const hasTasksIndexed = clientIndexed.some(d => d.sourceType === 'task' && d.sourceId === client.id);
      
      // New categories - one aggregated document per client
      const hasReflectionsIndexed = clientIndexed.some(d => d.sourceType === 'daily_reflection' && d.sourceId === client.id);
      const hasProgressHistoryIndexed = clientIndexed.some(d => d.sourceType === 'client_progress' && d.sourceId === client.id);
      const hasLibraryProgressIndexed = clientIndexed.some(d => d.sourceType === 'library_progress' && d.sourceId === client.id);
      const hasEmailJourneyIndexed = clientIndexed.some(d => d.sourceType === 'email_journey' && d.sourceId === client.id);

      // Existing missing calculations
      const submissionsMissing = clientSubmissions.filter(s => !indexedSubmissionIds.has(s.id)).map(s => ({ id: s.id, exerciseTitle: 'Esercizio', submittedAt: s.submittedAt }));
      const consultationsMissing = consultationsWithContent.filter(c => !indexedConsultationIds.has(c.id)).map(c => ({ id: c.id, date: c.scheduledAt, summary: c.notes?.substring(0, 50) || '' }));
      const clientKnowledgeMissing = clientKnowledge.filter(k => !indexedClientKnowledgeIds.has(k.id)).map(k => ({ id: k.id, title: k.title }));
      
      // NEW: Missing calculations for assigned content
      const assignedExercisesMissing = assignedExercisesList.filter(e => !indexedExerciseTemplateIds.has(e.id)).map(e => ({ id: e.id, title: e.title }));
      const assignedLibraryMissing = assignedLibraryDocs.filter(d => !indexedLibraryCopyIds.has(d.id)).map(d => ({ 
        id: d.id, 
        title: d.title, 
        categoryName: d.categoryId ? (categoryNames.get(d.categoryId) || 'Categoria') : 'Senza categoria'
      }));
      const assignedUniversityMissing = assignedLessons.filter(l => !indexedUniversityCopyIds.has(l.id)).map(l => ({ 
        id: l.id, 
        title: l.title, 
        yearName: l.yearId ? (yearNames.get(l.yearId) || 'Anno') : 'Senza anno'
      }));
      // Goals/Tasks are synced as single aggregated document per client (not per goal/task)
      // If goals exist but no goal document indexed, they all need syncing
      const goalsMissing = (clientGoals.length > 0 && !hasGoalsIndexed) 
        ? clientGoals.map(g => ({ id: g.id, title: g.title })) 
        : [];
      const tasksMissing = (clientTasks.length > 0 && !hasTasksIndexed) 
        ? clientTasks.map(t => ({ id: t.id, title: t.title })) 
        : [];

      // Daily Reflections missing (aggregated, so if any exist and not indexed, all are missing)
      const reflectionsMissing = (clientReflections.length > 0 && !hasReflectionsIndexed)
        ? clientReflections.map(r => ({ id: r.id, date: r.date?.toISOString() || '' }))
        : [];

      // Progress history missing  
      const progressHistoryMissing = (clientProgressHist.length > 0 && !hasProgressHistoryIndexed)
        ? clientProgressHist.map(p => ({ id: p.id, date: p.date?.toISOString() || '' }))
        : [];

      // Library progress missing
      const libraryProgressMissing = (clientLibProgress.length > 0 && !hasLibraryProgressIndexed)
        ? clientLibProgress.map(l => ({ id: l.id, documentTitle: l.documentId || 'Documento' }))
        : [];

      // Email journey missing
      const emailJourneyMissing = (clientEmailProgress.length > 0 && !hasEmailJourneyIndexed)
        ? clientEmailProgress.map(e => ({ id: e.id, templateTitle: 'Email Journey' }))
        : [];

      const clientMissing = submissionsMissing.length + consultationsMissing.length + clientKnowledgeMissing.length +
                            assignedExercisesMissing.length + assignedLibraryMissing.length + assignedUniversityMissing.length +
                            goalsMissing.length + tasksMissing.length + reflectionsMissing.length + progressHistoryMissing.length + libraryProgressMissing.length + emailJourneyMissing.length;
      
      // Check if financial data is indexed for this client
      const hasFinancialDataIndexed = clientIndexed.some(d => d.sourceType === 'financial_data');

      // Always include clients that have any data to audit
      const hasAnyData = clientSubmissions.length > 0 || consultationsWithContent.length > 0 || clientKnowledge.length > 0 || 
                         hasFinancialDataIndexed || assignedExercisesList.length > 0 || assignedLibraryDocs.length > 0 || 
                         assignedLessons.length > 0 || clientGoals.length > 0 || clientTasks.length > 0 ||
                         clientReflections.length > 0 || clientProgressHist.length > 0 || clientLibProgress.length > 0 || clientEmailProgress.length > 0;

      if (hasAnyData) {
        clientsAudit.push({
          clientId: client.id,
          clientName: `${client.firstName} ${client.lastName}`,
          clientEmail: client.email,
          exerciseResponses: { total: clientSubmissions.length, indexed: clientSubmissions.length - submissionsMissing.length, missing: submissionsMissing },
          consultationNotes: { total: consultationsWithContent.length, indexed: consultationsWithContent.length - consultationsMissing.length, missing: consultationsMissing },
          knowledgeDocs: { total: clientKnowledge.length, indexed: clientKnowledge.length - clientKnowledgeMissing.length, missing: clientKnowledgeMissing },
          hasFinancialDataIndexed,
          assignedExercises: { total: assignedExercisesList.length, indexed: assignedExercisesList.length - assignedExercisesMissing.length, missing: assignedExercisesMissing },
          assignedLibrary: { total: assignedLibraryDocs.length, indexed: assignedLibraryDocs.length - assignedLibraryMissing.length, missing: assignedLibraryMissing },
          assignedUniversity: { total: assignedLessons.length, indexed: assignedLessons.length - assignedUniversityMissing.length, missing: assignedUniversityMissing },
          goals: { total: clientGoals.length, indexed: clientGoals.length - goalsMissing.length, missing: goalsMissing },
          tasks: { total: clientTasks.length, indexed: clientTasks.length - tasksMissing.length, missing: tasksMissing },
          dailyReflections: { total: clientReflections.length, indexed: clientReflections.length - reflectionsMissing.length, missing: reflectionsMissing },
          clientProgressHistory: { total: clientProgressHist.length, indexed: clientProgressHist.length - progressHistoryMissing.length, missing: progressHistoryMissing },
          libraryProgress: { total: clientLibProgress.length, indexed: clientLibProgress.length - libraryProgressMissing.length, missing: libraryProgressMissing },
          emailJourneyProgress: { total: clientEmailProgress.length, indexed: clientEmailProgress.length - emailJourneyMissing.length, missing: emailJourneyMissing },
        });
        totalClientsMissing += clientMissing;
      }
    }

    // Audit WhatsApp Agents
    const whatsappAgentsAudit: Array<{
      agentId: string;
      agentName: string;
      knowledgeItems: { total: number; indexed: number; missing: Array<{ id: string; title: string; type: string }> };
    }> = [];
    let totalWhatsappAgentsMissing = 0;

    const whatsappAgents = await db.select({ id: consultantWhatsappConfig.id, agentName: consultantWhatsappConfig.agentName })
      .from(consultantWhatsappConfig).where(eq(consultantWhatsappConfig.consultantId, consultantId));

    for (const agent of whatsappAgents) {
      const agentKnowledge = await db.select({ 
        id: whatsappAgentKnowledgeItems.id, 
        title: whatsappAgentKnowledgeItems.title,
        type: whatsappAgentKnowledgeItems.type 
      })
        .from(whatsappAgentKnowledgeItems)
        .where(eq(whatsappAgentKnowledgeItems.agentConfigId, agent.id));

      // Get agent's file search store
      const agentStores = await db.select({ id: fileSearchStores.id })
        .from(fileSearchStores)
        .where(and(
          eq(fileSearchStores.ownerId, agent.id),
          eq(fileSearchStores.ownerType, 'whatsapp_agent')
        ));
      const agentStoreIds = agentStores.map(s => s.id);

      let agentIndexedDocs: { sourceType: string | null; sourceId: string | null }[] = [];
      if (agentStoreIds.length > 0) {
        const agentIndexedRaw = await db.select({
          sourceType: fileSearchDocuments.sourceType,
          sourceId: fileSearchDocuments.sourceId,
        })
          .from(fileSearchDocuments)
          .where(and(
            inArray(fileSearchDocuments.storeId, agentStoreIds),
            eq(fileSearchDocuments.status, 'indexed')
          ));
        agentIndexedDocs = agentIndexedRaw.map(r => ({ sourceType: r.sourceType, sourceId: r.sourceId }));
      }

      const indexedKnowledgeIds = new Set(agentIndexedDocs.filter(d => d.sourceType === 'knowledge_base').map(d => d.sourceId));
      const knowledgeMissing = agentKnowledge.filter(k => !indexedKnowledgeIds.has(k.id)).map(k => ({ 
        id: k.id, 
        title: k.title, 
        type: k.type || 'document' 
      }));

      if (agentKnowledge.length > 0) {
        whatsappAgentsAudit.push({
          agentId: agent.id,
          agentName: agent.agentName || 'Agente WhatsApp',
          knowledgeItems: {
            total: agentKnowledge.length,
            indexed: agentKnowledge.length - knowledgeMissing.length,
            missing: knowledgeMissing
          }
        });
        totalWhatsappAgentsMissing += knowledgeMissing.length;
      }
    }

    const consultantMissing = libraryResult.missing.length + knowledgeBaseResult.missing.length + 
                              exercisesResult.missing.length + universityResult.missing.length;
    const totalMissing = consultantMissing + totalClientsMissing + totalWhatsappAgentsMissing;

    const totalDocs = libraryResult.total + knowledgeBaseResult.total + exercisesResult.total + universityResult.total +
                      clientsAudit.reduce((sum, c) => sum + c.exerciseResponses.total + c.consultationNotes.total + c.knowledgeDocs.total +
                        c.assignedExercises.total + c.assignedLibrary.total + c.assignedUniversity.total + c.goals.total + c.tasks.total, 0) +
                      whatsappAgentsAudit.reduce((sum, a) => sum + a.knowledgeItems.total, 0);
    const totalIndexed = (libraryResult.total - libraryResult.missing.length) + 
                         (knowledgeBaseResult.total - knowledgeBaseResult.missing.length) +
                         (exercisesResult.total - exercisesResult.missing.length) + 
                         (universityResult.total - universityResult.missing.length) +
                         clientsAudit.reduce((sum, c) => 
                           sum + (c.exerciseResponses.total - c.exerciseResponses.missing.length) + 
                           (c.consultationNotes.total - c.consultationNotes.missing.length) + 
                           (c.knowledgeDocs.total - c.knowledgeDocs.missing.length) +
                           (c.assignedExercises.total - c.assignedExercises.missing.length) +
                           (c.assignedLibrary.total - c.assignedLibrary.missing.length) +
                           (c.assignedUniversity.total - c.assignedUniversity.missing.length) +
                           (c.goals.total - c.goals.missing.length) +
                           (c.tasks.total - c.tasks.missing.length), 0) +
                         whatsappAgentsAudit.reduce((sum, a) => sum + a.knowledgeItems.indexed, 0);

    const healthScore = totalDocs > 0 ? Math.round((totalIndexed / totalDocs) * 100) : 100;

    const recommendations: string[] = [];
    if (libraryResult.missing.length > 0) {
      recommendations.push(`Sincronizza ${libraryResult.missing.length} documenti libreria mancanti`);
    }
    if (knowledgeBaseResult.missing.length > 0) {
      recommendations.push(`Sincronizza ${knowledgeBaseResult.missing.length} documenti knowledge base mancanti`);
    }
    if (exercisesResult.missing.length > 0) {
      recommendations.push(`Sincronizza ${exercisesResult.missing.length} esercizi mancanti`);
    }
    if (universityResult.missing.length > 0) {
      recommendations.push(`Sincronizza ${universityResult.missing.length} lezioni university mancanti`);
    }
    if (totalClientsMissing > 0) {
      recommendations.push(`Sincronizza ${totalClientsMissing} documenti privati dei clienti mancanti`);
    }
    if (totalWhatsappAgentsMissing > 0) {
      recommendations.push(`Sincronizza ${totalWhatsappAgentsMissing} documenti knowledge degli agenti WhatsApp mancanti`);
    }
    
    // Calculate missing assigned content for detailed recommendations
    const totalAssignedExercisesMissing = clientsAudit.reduce((sum, c) => sum + c.assignedExercises.missing.length, 0);
    const totalAssignedLibraryMissing = clientsAudit.reduce((sum, c) => sum + c.assignedLibrary.missing.length, 0);
    const totalAssignedUniversityMissing = clientsAudit.reduce((sum, c) => sum + c.assignedUniversity.missing.length, 0);
    const totalGoalsMissing = clientsAudit.reduce((sum, c) => sum + c.goals.missing.length, 0);
    const totalTasksMissing = clientsAudit.reduce((sum, c) => sum + c.tasks.missing.length, 0);
    
    if (totalAssignedExercisesMissing > 0) {
      recommendations.push(`Sincronizza ${totalAssignedExercisesMissing} esercizi assegnati non indicizzati nei private store dei clienti`);
    }
    if (totalAssignedLibraryMissing > 0) {
      recommendations.push(`Sincronizza ${totalAssignedLibraryMissing} documenti libreria assegnati non indicizzati nei private store dei clienti`);
    }
    if (totalAssignedUniversityMissing > 0) {
      recommendations.push(`Sincronizza ${totalAssignedUniversityMissing} lezioni university assegnate non indicizzate nei private store dei clienti`);
    }
    if (totalGoalsMissing > 0) {
      recommendations.push(`Sincronizza ${totalGoalsMissing} obiettivi clienti non indicizzati`);
    }
    if (totalTasksMissing > 0) {
      recommendations.push(`Sincronizza ${totalTasksMissing} task clienti non indicizzati`);
    }

    if (healthScore === 100) {
      recommendations.push('✅ Tutti i contenuti sono indicizzati correttamente');
    } else if (healthScore >= 80) {
      recommendations.push('💡 Quasi completo - sincronizza i contenuti mancanti per il 100%');
    } else if (healthScore >= 50) {
      recommendations.push('⚠️ Sincronizzazione parziale - consigliato completare');
    } else {
      recommendations.push('🚨 Health Score basso - esegui sincronizzazione completa');
    }

    console.log(`\n${'═'.repeat(60)}`);
    console.log(`✅ [FileSync] Comprehensive Audit Complete`);
    console.log(`   📚 Library: ${libraryResult.total - libraryResult.missing.length}/${libraryResult.total} indexed`);
    console.log(`   📖 Knowledge Base: ${knowledgeBaseResult.total - knowledgeBaseResult.missing.length}/${knowledgeBaseResult.total} indexed`);
    console.log(`   🏋️ Exercises: ${exercisesResult.total - exercisesResult.missing.length}/${exercisesResult.total} indexed`);
    console.log(`   🎓 University: ${universityResult.total - universityResult.missing.length}/${universityResult.total} indexed`);
    console.log(`   👥 Clients: ${clientsAudit.length} with data, ${totalClientsMissing} missing`);
    console.log(`      📝 Assigned Exercises: ${totalAssignedExercisesMissing} missing`);
    console.log(`      📖 Assigned Library: ${totalAssignedLibraryMissing} missing`);
    console.log(`      🎓 Assigned University: ${totalAssignedUniversityMissing} missing`);
    console.log(`      🎯 Goals: ${totalGoalsMissing} missing`);
    console.log(`      ✅ Tasks: ${totalTasksMissing} missing`);
    console.log(`   📱 WhatsApp Agents: ${whatsappAgentsAudit.length} agents, ${totalWhatsappAgentsMissing} missing`);
    console.log(`   🏥 Health Score: ${healthScore}%`);
    console.log(`${'═'.repeat(60)}\n`);

    return {
      consultant: {
        library: libraryResult,
        knowledgeBase: knowledgeBaseResult,
        exercises: exercisesResult,
        university: universityResult,
      },
      clients: clientsAudit,
      whatsappAgents: whatsappAgentsAudit,
      summary: {
        totalMissing,
        consultantMissing,
        clientsMissing: totalClientsMissing,
        whatsappAgentsMissing: totalWhatsappAgentsMissing,
        healthScore,
      },
      recommendations,
    };
  }

  private static async auditLibraryDocumentsDetailed(consultantId: string): Promise<{
    total: number;
    indexed: number;
    missing: Array<{ id: string; title: string; type: string }>;
  }> {
    const docs = await db.select().from(libraryDocuments).where(eq(libraryDocuments.createdBy, consultantId));

    const missing: Array<{ id: string; title: string; type: string }> = [];
    let indexed = 0;

    for (const doc of docs) {
      const isIndexed = await fileSearchService.isDocumentIndexed('library', doc.id);
      if (isIndexed) {
        indexed++;
      } else {
        missing.push({ id: doc.id, title: doc.title, type: doc.type || 'document' });
      }
    }

    return { total: docs.length, indexed, missing };
  }

  private static async auditKnowledgeDocumentsDetailed(consultantId: string): Promise<{
    total: number;
    indexed: number;
    missing: Array<{ id: string; title: string }>;
  }> {
    const docs = await db.select().from(consultantKnowledgeDocuments).where(
      and(
        eq(consultantKnowledgeDocuments.consultantId, consultantId),
        eq(consultantKnowledgeDocuments.status, 'indexed'),
      )
    );

    const missing: Array<{ id: string; title: string }> = [];
    let indexed = 0;

    for (const doc of docs) {
      const isIndexed = await fileSearchService.isDocumentIndexed('knowledge_base', doc.id);
      if (isIndexed) {
        indexed++;
      } else {
        missing.push({ id: doc.id, title: doc.title });
      }
    }

    return { total: docs.length, indexed, missing };
  }

  private static async auditExercisesDetailed(consultantId: string): Promise<{
    total: number;
    indexed: number;
    missing: Array<{ id: string; title: string }>;
  }> {
    const allExercises = await db.select().from(exercises).where(eq(exercises.createdBy, consultantId));

    const missing: Array<{ id: string; title: string }> = [];
    let indexed = 0;

    for (const exercise of allExercises) {
      const isIndexed = await fileSearchService.isDocumentIndexed('exercise', exercise.id);
      if (isIndexed) {
        indexed++;
      } else {
        missing.push({ id: exercise.id, title: exercise.title });
      }
    }

    return { total: allExercises.length, indexed, missing };
  }

  private static async auditUniversityLessonsDetailed(consultantId: string): Promise<{
    total: number;
    indexed: number;
    missing: Array<{ id: string; title: string; lessonTitle: string }>;
  }> {
    // universityLessons doesn't have createdBy - must join through modules -> trimesters -> years
    const lessonsWithModules = await db.select({
      id: universityLessons.id,
      title: universityLessons.title,
      moduleId: universityLessons.moduleId,
      moduleName: universityModules.name,
    })
      .from(universityLessons)
      .innerJoin(universityModules, eq(universityLessons.moduleId, universityModules.id))
      .innerJoin(universityTrimesters, eq(universityModules.trimesterId, universityTrimesters.id))
      .innerJoin(universityYears, eq(universityTrimesters.yearId, universityYears.id))
      .where(eq(universityYears.createdBy, consultantId));

    const missing: Array<{ id: string; title: string; lessonTitle: string }> = [];
    let indexed = 0;

    for (const lesson of lessonsWithModules) {
      const isIndexed = await fileSearchService.isDocumentIndexed('university_lesson', lesson.id);
      if (isIndexed) {
        indexed++;
      } else {
        missing.push({ 
          id: lesson.id, 
          title: lesson.moduleName || 'Modulo', 
          lessonTitle: lesson.title 
        });
      }
    }

    return { total: lessonsWithModules.length, indexed, missing };
  }

  private static async auditClientExerciseResponsesDetailed(clientId: string, consultantId: string): Promise<{
    total: number;
    indexed: number;
    missing: Array<{ id: string; exerciseTitle: string; submittedAt: Date | null }>;
  }> {
    const assignments = await db.select().from(exerciseAssignments).where(eq(exerciseAssignments.clientId, clientId));

    const assignmentIds = assignments.map(a => a.id);
    if (assignmentIds.length === 0) {
      return { total: 0, indexed: 0, missing: [] };
    }

    const submissions = await db.select().from(exerciseSubmissions).where(isNotNull(exerciseSubmissions.submittedAt));

    const clientSubmissions = submissions.filter(s => assignmentIds.includes(s.assignmentId));

    const missing: Array<{ id: string; exerciseTitle: string; submittedAt: Date | null }> = [];
    let indexed = 0;

    for (const submission of clientSubmissions) {
      const isIndexed = await fileSearchService.isDocumentIndexed('exercise', submission.id);
      if (isIndexed) {
        indexed++;
      } else {
        const assignment = assignments.find(a => a.id === submission.assignmentId);
        let exerciseTitle = 'Esercizio';
        if (assignment) {
          const [exercise] = await db.select().from(exercises).where(eq(exercises.id, assignment.exerciseId)).limit(1);
          if (exercise) {
            exerciseTitle = exercise.title;
          }
        }
        missing.push({ 
          id: submission.id, 
          exerciseTitle, 
          submittedAt: submission.submittedAt 
        });
      }
    }

    return { total: clientSubmissions.length, indexed, missing };
  }

  private static async auditClientConsultationsDetailed(clientId: string): Promise<{
    total: number;
    indexed: number;
    missing: Array<{ id: string; date: Date; summary: string }>;
  }> {
    const clientConsultations = await db.select().from(consultations).where(
      and(
        eq(consultations.clientId, clientId),
        eq(consultations.status, 'completed'),
      )
    );

    const consultationsWithContent = clientConsultations.filter(
      c => c.transcript || c.notes || c.summaryEmail
    );

    const missing: Array<{ id: string; date: Date; summary: string }> = [];
    let indexed = 0;

    for (const consultation of consultationsWithContent) {
      const isIndexed = await fileSearchService.isDocumentIndexed('consultation', `client_${consultation.id}`);
      if (isIndexed) {
        indexed++;
      } else {
        missing.push({ 
          id: consultation.id, 
          date: consultation.scheduledAt, 
          summary: consultation.notes?.substring(0, 50) || consultation.summaryEmail?.substring(0, 50) || 'Consulenza'
        });
      }
    }

    return { total: consultationsWithContent.length, indexed, missing };
  }

  private static async auditClientKnowledgeDocsDetailed(clientId: string): Promise<{
    total: number;
    indexed: number;
    missing: Array<{ id: string; title: string }>;
  }> {
    const docs = await db.select().from(clientKnowledgeDocuments).where(
      and(
        eq(clientKnowledgeDocuments.clientId, clientId),
        eq(clientKnowledgeDocuments.status, 'indexed'),
      )
    );

    const missing: Array<{ id: string; title: string }> = [];
    let indexed = 0;

    for (const doc of docs) {
      const isIndexed = await fileSearchService.isDocumentIndexed('knowledge_base', doc.id);
      if (isIndexed) {
        indexed++;
      } else {
        missing.push({ id: doc.id, title: doc.title });
      }
    }

    return { total: docs.length, indexed, missing };
  }

  // ============================================================
  // CLIENT FINANCIAL DATA SYNC
  // ============================================================

  /**
   * Sync client's financial data (from Percorso Capitale) to their PRIVATE FileSearchStore
   * 
   * @param clientId - The client's user ID
   * @param consultantId - The consultant's user ID
   */
  static async syncClientFinancialData(
    clientId: string,
    consultantId: string,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      console.log(`\n${'═'.repeat(60)}`);
      console.log(`💰 [FileSync] Syncing financial data for client ${clientId.substring(0, 8)}`);
      console.log(`${'═'.repeat(60)}\n`);

      // Check if already indexed
      const isAlreadyIndexed = await fileSearchService.isDocumentIndexed('financial_data', clientId);
      if (isAlreadyIndexed) {
        console.log(`📌 [FileSync] Financial data already indexed for client: ${clientId.substring(0, 8)}`);
        return { success: true };
      }

      // Get client's finance settings
      const [financeConfig] = await db.select()
        .from(userFinanceSettings)
        .where(eq(userFinanceSettings.clientId, clientId));

      if (!financeConfig || !financeConfig.isEnabled || !financeConfig.percorsoCapitaleEmail) {
        return { success: false, error: 'Finance settings not configured for this client' };
      }

      const apiKey = process.env.PERCORSO_CAPITALE_API_KEY;
      const baseUrl = process.env.PERCORSO_CAPITALE_BASE_URL;

      if (!apiKey || !baseUrl) {
        return { success: false, error: 'Percorso Capitale API not configured' };
      }

      // Fetch financial data from Percorso Capitale
      const pcClient = PercorsoCapitaleClient.getInstance(apiKey, baseUrl, financeConfig.percorsoCapitaleEmail);
      
      const [dashboardRaw, budgetsRaw, transactionsRaw, accountArchRaw, investmentsRaw, goalsRaw] = await Promise.all([
        pcClient.getDashboard(),
        pcClient.getCategoryBudgets(),
        pcClient.getTransactions(),
        pcClient.getAccountArchitecture(),
        pcClient.getInvestments(),
        pcClient.getGoals(),
      ]);

      // Process data
      const processedDashboard = dashboardRaw ? PercorsoCapitaleDataProcessor.processDashboard(dashboardRaw) : null;
      const processedAccountArch = accountArchRaw ? PercorsoCapitaleDataProcessor.processAccountArchitecture(accountArchRaw) : null;
      const processedBudgets = (budgetsRaw && transactionsRaw) ? PercorsoCapitaleDataProcessor.processCategoryBudgets(budgetsRaw, transactionsRaw) : null;
      const processedGoals = goalsRaw ? PercorsoCapitaleDataProcessor.processGoals(goalsRaw) : null;
      const processedInvestments = investmentsRaw ? PercorsoCapitaleDataProcessor.processInvestments(investmentsRaw) : null;

      // Build content for indexing
      const content = this.buildFinancialDataContent({
        dashboard: processedDashboard,
        accounts: processedAccountArch,
        budgets: processedBudgets,
        transactions: transactionsRaw?.slice(0, 100), // Limit to 100 recent transactions
        investments: processedInvestments,
        goals: processedGoals,
        updatedAt: new Date().toISOString(),
      });

      // Get or create the client's PRIVATE store
      const clientStore = await fileSearchService.getOrCreateClientStore(clientId, consultantId);
      if (!clientStore) {
        return { success: false, error: 'Failed to get or create client private store' };
      }

      // Upload to client's PRIVATE store
      const uploadResult = await fileSearchService.uploadDocumentFromContent({
        content: content,
        displayName: `[FINANCIAL DATA] Dati Finanziari - ${new Date().toLocaleDateString('it-IT')}`,
        storeId: clientStore.storeId,
        sourceType: 'financial_data',
        sourceId: clientId,
        clientId: clientId,
        userId: clientId,
      });

      if (uploadResult.success) {
        console.log(`✅ [FileSync] Financial data synced to PRIVATE store for client: ${clientId.substring(0, 8)}`);
      }

      return uploadResult.success 
        ? { success: true }
        : { success: false, error: uploadResult.error };
    } catch (error: any) {
      console.error('[FileSync] Error syncing client financial data:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Build searchable content from financial data
   */
  private static buildFinancialDataContent(data: {
    dashboard: any;
    accounts: any;
    budgets: any;
    transactions: any[];
    investments: any;
    goals: any;
    updatedAt: string;
  }): string {
    const parts: string[] = [];
    
    parts.push(`# Dati Finanziari Cliente`);
    parts.push(`Ultimo aggiornamento: ${new Date(data.updatedAt).toLocaleString('it-IT')}`);
    
    // Dashboard
    if (data.dashboard) {
      parts.push(`\n## Dashboard Finanziaria`);
      parts.push(`- Patrimonio Netto: €${data.dashboard.netWorth?.toLocaleString('it-IT') || 'N/A'}`);
      parts.push(`- Liquidità Disponibile: €${data.dashboard.availableLiquidity?.toLocaleString('it-IT') || 'N/A'}`);
      parts.push(`- Entrate Mensili: €${data.dashboard.monthlyIncome?.toLocaleString('it-IT') || 'N/A'}`);
      parts.push(`- Spese Mensili: €${data.dashboard.monthlyExpenses?.toLocaleString('it-IT') || 'N/A'}`);
      parts.push(`- Tasso di Risparmio: ${data.dashboard.savingsRate?.toFixed(1) || 'N/A'}%`);
      parts.push(`- Cash Flow Mensile Disponibile: €${data.dashboard.availableMonthlyFlow?.toLocaleString('it-IT') || 'N/A'}`);
    }

    // Accounts
    if (data.accounts && data.accounts.accountsWithAllocations) {
      parts.push(`\n## Conti Bancari`);
      parts.push(`Totale Liquidità: €${data.accounts.totalBalance?.toLocaleString('it-IT') || 'N/A'}`);
      data.accounts.accountsWithAllocations.forEach((acc: any) => {
        parts.push(`- ${acc.name} (${acc.type}): €${acc.balance?.toLocaleString('it-IT') || '0'}`);
      });
    }

    // Budgets
    if (data.budgets && Array.isArray(data.budgets) && data.budgets.length > 0) {
      parts.push(`\n## Budget Categorie`);
      data.budgets.forEach((b: any) => {
        const status = b.status === 'over' ? '🔴' : b.status === 'warning' ? '🟡' : '🟢';
        parts.push(`- ${status} ${b.category}: €${b.spent || '0'}/€${b.monthlyBudget || '0'} (${b.percentage || '0'}%)`);
      });
    }

    // Recent Transactions
    if (data.transactions && data.transactions.length > 0) {
      parts.push(`\n## Transazioni Recenti (ultime ${data.transactions.length})`);
      data.transactions.slice(0, 50).forEach((t: any) => {
        const sign = t.type === 'income' ? '+' : '-';
        parts.push(`- ${t.date}: ${sign}€${Math.abs(parseFloat(t.amount || '0')).toLocaleString('it-IT')} - ${t.description} (${t.category})`);
      });
    }

    // Investments
    if (data.investments && data.investments.portfolios) {
      parts.push(`\n## Investimenti`);
      parts.push(`Valore Totale Portafoglio: €${data.investments.totalValue?.toLocaleString('it-IT') || 'N/A'}`);
      if (data.investments.portfolios && data.investments.portfolios.length > 0) {
        data.investments.portfolios.forEach((p: any) => {
          parts.push(`- ${p.name}: €${p.currentValue?.toLocaleString('it-IT') || '0'}`);
        });
      }
    }

    // Goals
    if (data.goals && data.goals.goals && data.goals.goals.length > 0) {
      parts.push(`\n## Obiettivi Finanziari`);
      data.goals.goals.forEach((g: any) => {
        const progress = g.targetAmount ? ((g.currentAmount / g.targetAmount) * 100).toFixed(1) : '0';
        parts.push(`- ${g.name}: €${g.currentAmount?.toLocaleString('it-IT') || '0'}/€${g.targetAmount?.toLocaleString('it-IT') || '0'} (${progress}%)`);
      });
    }
    
    return parts.join('\n');
  }

  /**
   * Check if a client has financial data indexed
   */
  static async isClientFinancialDataIndexed(clientId: string): Promise<boolean> {
    return await fileSearchService.isDocumentIndexed('financial_data', clientId);
  }

  /**
   * Delete and re-sync client financial data (force update)
   */
  static async resyncClientFinancialData(
    clientId: string,
    consultantId: string,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Delete existing financial data document
      // Pass consultantId for proper API credential resolution (client stores use consultant's keys)
      const existingDocs = await db.select()
        .from(fileSearchDocuments)
        .where(and(
          eq(fileSearchDocuments.sourceType, 'financial_data'),
          eq(fileSearchDocuments.sourceId, clientId),
        ));

      for (const doc of existingDocs) {
        await fileSearchService.deleteDocument(doc.id, consultantId);
      }

      // Sync fresh data
      return await this.syncClientFinancialData(clientId, consultantId);
    } catch (error: any) {
      console.error('[FileSync] Error resyncing client financial data:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Sync WhatsApp Agent Knowledge Base to FileSearchStore
   * Creates a dedicated store for each agent and syncs all knowledge items
   * 
   * @param agentConfigId - The WhatsApp agent configuration ID
   * @returns Sync results with counts and errors
   */
  static async syncWhatsappAgentKnowledge(agentConfigId: string): Promise<{
    total: number;
    synced: number;
    failed: number;
    errors: string[];
  }> {
    try {
      // Get the agent config to find the consultant
      const agentConfig = await db.query.consultantWhatsappConfig.findFirst({
        where: eq(consultantWhatsappConfig.id, agentConfigId),
      });

      if (!agentConfig) {
        console.error(`[FileSync] WhatsApp agent config not found: ${agentConfigId}`);
        return { total: 0, synced: 0, failed: 1, errors: ['Agent config not found'] };
      }

      const consultantId = agentConfig.consultantId;
      console.log(`\n${'═'.repeat(60)}`);
      console.log(`📱 [FileSync] Syncing WhatsApp Agent Knowledge for agent "${agentConfig.agentName}" (${agentConfigId.substring(0, 8)})`);
      console.log(`${'═'.repeat(60)}\n`);

      // Get all knowledge items for this agent
      const knowledgeItems = await db.query.whatsappAgentKnowledgeItems.findMany({
        where: eq(whatsappAgentKnowledgeItems.agentConfigId, agentConfigId),
      });

      if (knowledgeItems.length === 0) {
        console.log(`ℹ️ [FileSync] No knowledge items found for agent ${agentConfigId.substring(0, 8)}`);
        return { total: 0, synced: 0, failed: 0, errors: [] };
      }

      // Get or create FileSearchStore for this WhatsApp agent
      let agentStore = await db.query.fileSearchStores.findFirst({
        where: and(
          eq(fileSearchStores.ownerId, agentConfigId),
          eq(fileSearchStores.ownerType, 'whatsapp_agent'),
        ),
      });

      if (!agentStore) {
        console.log(`🔧 [FileSync] Creating new FileSearchStore for WhatsApp agent "${agentConfig.agentName}"`);
        const result = await fileSearchService.createStore({
          displayName: `WhatsApp Agent: ${agentConfig.agentName}`,
          ownerId: agentConfigId,
          ownerType: 'whatsapp_agent',
          description: `Knowledge base per l'agente WhatsApp "${agentConfig.agentName}"`,
          userId: consultantId, // Use consultant's keys or SuperAdmin fallback
        });

        if (!result.success || !result.storeId) {
          console.error(`[FileSync] Failed to create FileSearchStore: ${result.error}`);
          return { total: knowledgeItems.length, synced: 0, failed: knowledgeItems.length, errors: [result.error || 'Failed to create store'] };
        }

        agentStore = await db.query.fileSearchStores.findFirst({
          where: eq(fileSearchStores.id, result.storeId),
        });

        if (!agentStore) {
          return { total: knowledgeItems.length, synced: 0, failed: knowledgeItems.length, errors: ['Store created but not found'] };
        }
      }

      let synced = 0;
      let failed = 0;
      const errors: string[] = [];
      let processed = 0;

      console.log(`🔄 [FileSync] Syncing ${knowledgeItems.length} knowledge items for agent "${agentConfig.agentName}"`);
      syncProgressEmitter.emitStart(consultantId, 'whatsapp_agents', knowledgeItems.length);

      for (const item of knowledgeItems) {
        processed++;

        // Check if already indexed
        const isAlreadyIndexed = await fileSearchService.isDocumentIndexed('whatsapp_agent_knowledge', item.id);
        if (isAlreadyIndexed) {
          console.log(`📌 [FileSync] WhatsApp knowledge item already indexed: ${item.title}`);
          synced++;
          syncProgressEmitter.emitItemProgress(consultantId, 'whatsapp_agents', item.title, processed, knowledgeItems.length);
          continue;
        }

        // Build content based on type
        let content = item.content;
        if (!content && item.filePath) {
          // If content is empty but we have a file, try to extract text
          try {
            const extractedText = await extractTextFromFile(item.filePath, item.type);
            content = extractedText || '';
          } catch (err: any) {
            console.warn(`⚠️ [FileSync] Could not extract text from ${item.fileName}: ${err.message}`);
            content = `[Documento: ${item.title}]\nTipo: ${item.type}\nFile: ${item.fileName || 'N/A'}`;
          }
        }

        if (!content || content.trim().length === 0) {
          console.warn(`⚠️ [FileSync] Skipping empty knowledge item: ${item.title}`);
          failed++;
          errors.push(`${item.title}: Empty content`);
          continue;
        }

        // Upload to FileSearch store - use knowledge_base sourceType, differentiate via metadata
        const uploadResult = await fileSearchService.uploadDocumentFromContent({
          content: `# ${item.title}\n\n${content}`,
          displayName: item.title,
          storeId: agentStore.id,
          sourceType: 'whatsapp_agent_knowledge',
          sourceId: item.id,
          userId: consultantId,
          customMetadata: {
            docType: item.type,
            agentConfigId: agentConfigId,
          },
        });

        if (uploadResult.success) {
          synced++;
          console.log(`✅ [FileSync] Synced WhatsApp knowledge item: ${item.title}`);
          syncProgressEmitter.emitItemProgress(consultantId, 'whatsapp_agents', item.title, processed, knowledgeItems.length);
        } else {
          failed++;
          errors.push(`${item.title}: ${uploadResult.error}`);
          console.error(`❌ [FileSync] Failed to sync WhatsApp knowledge item "${item.title}": ${uploadResult.error}`);
          syncProgressEmitter.emitError(consultantId, 'whatsapp_agents', `${item.title}: ${uploadResult.error}`);
        }
      }

      // RECONCILIATION: Remove orphaned documents from the AGENT's store
      // Get all active knowledge item IDs for this agent
      const activeItemIds = knowledgeItems
        .filter(item => item.isActive !== false)
        .map(item => item.id);

      // Use the agentStore (already fetched above) for reconciliation
      // Pass consultantId so Google API calls use consultant's credentials (not agent's ID)
      if (agentStore) {
        const fileSearchServiceInstance = new FileSearchService();
        const reconcileResult = await fileSearchServiceInstance.reconcileBySourceType(
          agentStore.id,
          'whatsapp_agent_knowledge',
          activeItemIds,
          consultantId
        );
        
        if (reconcileResult.removed > 0) {
          console.log(`🧹 [FileSync] Reconciled ${reconcileResult.removed} orphaned WhatsApp knowledge documents from agent store`);
        }
      }

      console.log(`\n${'═'.repeat(60)}`);
      console.log(`✅ [FileSync] WhatsApp Agent Knowledge Sync Complete`);
      console.log(`   Agent: ${agentConfig.agentName}`);
      console.log(`   Synced: ${synced}/${knowledgeItems.length}`);
      console.log(`   Failed: ${failed}`);
      console.log(`${'═'.repeat(60)}\n`);

      syncProgressEmitter.emitComplete(consultantId, 'whatsapp_agents', knowledgeItems.length);

      return {
        total: knowledgeItems.length,
        synced,
        failed,
        errors,
      };
    } catch (error: any) {
      console.error('[FileSync] WhatsApp agent knowledge sync error:', error);
      return {
        total: 0,
        synced: 0,
        failed: 1,
        errors: [error.message],
      };
    }
  }

  /**
   * Sync ALL WhatsApp agent knowledge for a consultant
   * Iterates through all WhatsApp agents and syncs their knowledge items
   * 
   * @param consultantId - The consultant's user ID
   * @returns Aggregate sync results across all agents
   */
  static async syncAllWhatsappAgentKnowledge(consultantId: string): Promise<{
    total: number;
    synced: number;
    failed: number;
    agentsProcessed: number;
    errors: string[];
  }> {
    // Only sync active agents with complete configuration
    const agentConfigs = await db.query.consultantWhatsappConfig.findMany({
      where: and(
        eq(consultantWhatsappConfig.consultantId, consultantId),
        eq(consultantWhatsappConfig.isActive, true)
      ),
    });

    if (agentConfigs.length === 0) {
      console.log(`📱 [FileSync] No active WhatsApp agents found for consultant ${consultantId.substring(0, 8)}`);
      return { total: 0, synced: 0, failed: 0, agentsProcessed: 0, errors: [] };
    }

    // Filter agents that have complete configuration (accountSid and authToken)
    const validAgentConfigs = agentConfigs.filter(config => 
      config.accountSid && config.authToken
    );

    if (validAgentConfigs.length === 0) {
      console.log(`📱 [FileSync] No WhatsApp agents with complete config for consultant ${consultantId.substring(0, 8)}`);
      return { total: 0, synced: 0, failed: 0, agentsProcessed: 0, errors: [] };
    }

    let totalSynced = 0;
    let totalFailed = 0;
    let totalItems = 0;
    const allErrors: string[] = [];

    console.log(`📱 [FileSync] Syncing ${validAgentConfigs.length} active WhatsApp agents for consultant ${consultantId.substring(0, 8)}`);

    for (const agentConfig of validAgentConfigs) {
      console.log(`   📱 Processing agent: ${agentConfig.agentName || 'Unnamed'} (${agentConfig.id.substring(0, 8)}...)`);
      const result = await this.syncWhatsappAgentKnowledge(agentConfig.id);
      totalItems += result.total;
      totalSynced += result.synced;
      totalFailed += result.failed;
      allErrors.push(...result.errors);
    }

    return {
      total: totalItems,
      synced: totalSynced,
      failed: totalFailed,
      agentsProcessed: validAgentConfigs.length,
      errors: allErrors,
    };
  }

  /**
   * Sync a single WhatsApp knowledge item to FileSearchStore
   * 
   * @param itemId - The knowledge item ID
   * @param agentConfigId - The WhatsApp agent configuration ID
   * @returns Sync result
   */
  static async syncSingleWhatsappKnowledgeItem(itemId: string, agentConfigId: string): Promise<{ success: boolean; error?: string }> {
    try {
      // Get the item
      const item = await db.query.whatsappAgentKnowledgeItems.findFirst({
        where: and(
          eq(whatsappAgentKnowledgeItems.id, itemId),
          eq(whatsappAgentKnowledgeItems.agentConfigId, agentConfigId),
        ),
      });

      if (!item) {
        return { success: false, error: 'Knowledge item not found' };
      }

      // Get the agent config
      const agentConfig = await db.query.consultantWhatsappConfig.findFirst({
        where: eq(consultantWhatsappConfig.id, agentConfigId),
      });

      if (!agentConfig) {
        return { success: false, error: 'Agent config not found' };
      }

      const consultantId = agentConfig.consultantId;

      // Check if already indexed
      const isAlreadyIndexed = await fileSearchService.isDocumentIndexed('whatsapp_agent_knowledge', item.id);
      if (isAlreadyIndexed) {
        return { success: true };
      }

      // Get or create FileSearchStore for this WhatsApp agent
      let agentStore = await db.query.fileSearchStores.findFirst({
        where: and(
          eq(fileSearchStores.ownerId, agentConfigId),
          eq(fileSearchStores.ownerType, 'whatsapp_agent'),
        ),
      });

      if (!agentStore) {
        const result = await fileSearchService.createStore({
          displayName: `WhatsApp Agent: ${agentConfig.agentName}`,
          ownerId: agentConfigId,
          ownerType: 'whatsapp_agent',
          description: `Knowledge base per l'agente WhatsApp "${agentConfig.agentName}"`,
          userId: consultantId,
        });

        if (!result.success || !result.storeId) {
          return { success: false, error: result.error || 'Failed to create store' };
        }

        agentStore = await db.query.fileSearchStores.findFirst({
          where: eq(fileSearchStores.id, result.storeId),
        });

        if (!agentStore) {
          return { success: false, error: 'Store created but not found' };
        }
      }

      // Build content
      let content = item.content;
      if (!content && item.filePath) {
        try {
          const extractedText = await extractTextFromFile(item.filePath, item.type);
          content = extractedText || '';
        } catch (err: any) {
          content = `[Documento: ${item.title}]\nTipo: ${item.type}\nFile: ${item.fileName || 'N/A'}`;
        }
      }

      if (!content || content.trim().length === 0) {
        return { success: false, error: 'Empty content' };
      }

      // Upload to FileSearch store with proper sourceType for reconciliation
      const uploadResult = await fileSearchService.uploadDocumentFromContent({
        content: `# ${item.title}\n\n${content}`,
        displayName: item.title,
        storeId: agentStore.id,
        sourceType: 'whatsapp_agent_knowledge',
        sourceId: item.id,
        userId: consultantId,
        customMetadata: {
          docType: item.type,
          agentConfigId: agentConfigId,
        },
      });

      return { success: uploadResult.success, error: uploadResult.error };
    } catch (error: any) {
      console.error('[FileSync] Error syncing single WhatsApp knowledge item:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get FileSearchStore for a WhatsApp agent (if exists)
   * 
   * @param agentConfigId - The WhatsApp agent configuration ID
   * @returns Store info or null if not found
   */
  static async getWhatsappAgentStore(agentConfigId: string): Promise<typeof fileSearchStores.$inferSelect | null> {
    return await db.query.fileSearchStores.findFirst({
      where: and(
        eq(fileSearchStores.ownerId, agentConfigId),
        eq(fileSearchStores.ownerType, 'whatsapp_agent'),
        eq(fileSearchStores.isActive, true),
      ),
    });
  }

  /**
   * Get FileSearchStore for a consultant (if exists)
   * Used as fallback when WhatsApp agent doesn't have a dedicated store
   * 
   * @param consultantId - The consultant's user ID
   * @returns Store info or null if not found
   */
  static async getConsultantStore(consultantId: string): Promise<typeof fileSearchStores.$inferSelect | null> {
    return await db.query.fileSearchStores.findFirst({
      where: and(
        eq(fileSearchStores.ownerId, consultantId),
        eq(fileSearchStores.ownerType, 'consultant'),
        eq(fileSearchStores.isActive, true),
      ),
    });
  }

  /**
   * Run a Post-Import Audit for a client's private data
   * 
   * @param clientId - The client's user ID
   * @returns Audit summary with health score and recommendations
   */
  static async runClientPostImportAudit(clientId: string): Promise<{
    summary: {
      clientKnowledgeBase: { total: number; indexed: number; missing: string[] };
    };
    recommendations: string[];
    healthScore: number;
  }> {
    console.log(`\n${'═'.repeat(60)}`);
    console.log(`🔍 [FileSync] Running Client Post-Import Audit for client ${clientId.substring(0, 8)}`);
    console.log(`${'═'.repeat(60)}\n`);

    const clientKnowledgeResult = await this.auditClientKnowledgeDocuments(clientId);

    const totalDocs = clientKnowledgeResult.total;
    const totalIndexed = clientKnowledgeResult.indexed;
    const healthScore = totalDocs > 0 ? Math.round((totalIndexed / totalDocs) * 100) : 100;

    const recommendations: string[] = [];

    if (clientKnowledgeResult.missing.length > 0) {
      recommendations.push(`Sincronizza ${clientKnowledgeResult.missing.length} documenti knowledge del client mancanti`);
    }

    if (healthScore < 50) {
      recommendations.push('⚠️ Health Score basso: esegui una sincronizzazione completa');
    } else if (healthScore < 80) {
      recommendations.push('💡 Consigliato: sincronizza i contenuti mancanti per migliorare le performance AI');
    } else if (healthScore === 100) {
      recommendations.push('✅ Tutti i documenti del client sono indicizzati correttamente');
    }

    console.log(`\n${'═'.repeat(60)}`);
    console.log(`✅ [FileSync] Client Post-Import Audit Complete`);
    console.log(`   📖 Client Knowledge Base: ${clientKnowledgeResult.indexed}/${clientKnowledgeResult.total} indexed`);
    console.log(`   🏥 Health Score: ${healthScore}%`);
    console.log(`${'═'.repeat(60)}\n`);

    return {
      summary: {
        clientKnowledgeBase: clientKnowledgeResult,
      },
      recommendations,
      healthScore,
    };
  }

  // ============================================================
  // CLIENT ASSIGNMENT SYNC - Sync content when assigned to client
  // ============================================================
  // NEW ARCHITECTURE: Client sees ONLY their private store
  // When consultant assigns something, it gets COPIED to client's store
  // ============================================================

  /**
   * Sync an exercise template to client's private store when assigned
   * Called when consultant creates an exerciseAssignment
   */
  static async syncExerciseToClient(
    exerciseId: string,
    clientId: string,
    consultantId: string,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const exercise = await db.query.exercises.findFirst({
        where: eq(exercises.id, exerciseId),
      });

      if (!exercise) {
        return { success: false, error: 'Exercise not found' };
      }

      // Check if already synced to this client's store
      const existingDoc = await db.query.fileSearchDocuments.findFirst({
        where: and(
          eq(fileSearchDocuments.sourceType, 'exercise'),
          eq(fileSearchDocuments.sourceId, exerciseId),
          eq(fileSearchDocuments.clientId, clientId),
        ),
      });

      if (existingDoc) {
        console.log(`📌 [FileSync] Exercise already synced to client ${clientId.substring(0, 8)}: ${exercise.title}`);
        return { success: true };
      }

      // Get or create client's private store
      const clientStore = await fileSearchService.getOrCreateClientStore(clientId, consultantId);
      if (!clientStore) {
        return { success: false, error: 'Failed to get or create client private store' };
      }

      // Build exercise content
      let workPlatformContent: string | null = null;
      if (exercise.workPlatform && exercise.workPlatform.includes('docs.google.com')) {
        try {
          workPlatformContent = await scrapeGoogleDoc(exercise.workPlatform);
        } catch (e) {
          console.warn(`⚠️ [FileSync] Failed to scrape Google Doc for ${exercise.title}`);
        }
      }

      const content = this.buildExerciseContent(exercise, workPlatformContent);

      // Upload to client's PRIVATE store
      const uploadResult = await fileSearchService.uploadDocumentFromContent({
        content: content,
        displayName: `[ESERCIZIO ASSEGNATO] ${exercise.title}`,
        storeId: clientStore.storeId,
        sourceType: 'exercise',
        sourceId: exerciseId,
        clientId: clientId,
        userId: clientId,
      });

      if (uploadResult.success) {
        console.log(`✅ [FileSync] Exercise synced to client ${clientId.substring(0, 8)} private store: ${exercise.title}`);
      }

      return uploadResult.success
        ? { success: true }
        : { success: false, error: uploadResult.error };
    } catch (error: any) {
      console.error('[FileSync] Error syncing exercise to client:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Sync all library documents from a category to client's private store
   * Called when consultant assigns a library category to client
   */
  static async syncLibraryCategoryToClient(
    categoryId: string,
    clientId: string,
    consultantId: string,
  ): Promise<{ success: boolean; synced: number; failed: number; error?: string }> {
    try {
      // Get the category
      const category = await db.query.libraryCategories.findFirst({
        where: eq(libraryCategories.id, categoryId),
      });

      if (!category) {
        return { success: false, synced: 0, failed: 0, error: 'Category not found' };
      }

      // Get all subcategories
      const subcategories = await db.query.librarySubcategories.findMany({
        where: eq(librarySubcategories.categoryId, categoryId),
      });

      const subcategoryIds = subcategories.map(s => s.id);

      // Get all documents in this category (direct + via subcategories)
      const docs = await db.query.libraryDocuments.findMany({
        where: subcategoryIds.length > 0 
          ? inArray(libraryDocuments.subcategoryId, subcategoryIds)
          : eq(libraryDocuments.createdBy, consultantId),
      });

      console.log(`\n${'═'.repeat(60)}`);
      console.log(`📚 [FileSync] Syncing ${docs.length} library docs from category "${category.name}" to client ${clientId.substring(0, 8)}`);
      console.log(`${'═'.repeat(60)}\n`);

      // Get or create client's private store
      const clientStore = await fileSearchService.getOrCreateClientStore(clientId, consultantId);
      if (!clientStore) {
        return { success: false, synced: 0, failed: 0, error: 'Failed to get or create client private store' };
      }

      let synced = 0;
      let failed = 0;

      for (const doc of docs) {
        // Check if already synced
        const existingDoc = await db.query.fileSearchDocuments.findFirst({
          where: and(
            eq(fileSearchDocuments.sourceType, 'library'),
            eq(fileSearchDocuments.sourceId, doc.id),
            eq(fileSearchDocuments.clientId, clientId),
          ),
        });

        if (existingDoc) {
          synced++; // Count as success
          continue;
        }

        const uploadResult = await fileSearchService.uploadDocumentFromContent({
          content: doc.content || `${doc.title}\n\n${doc.description || ''}`,
          displayName: `[LIBRERIA] ${doc.title}`,
          storeId: clientStore.storeId,
          sourceType: 'library',
          sourceId: doc.id,
          clientId: clientId,
          userId: clientId,
        });

        if (uploadResult.success) {
          synced++;
        } else {
          failed++;
        }
      }

      console.log(`✅ [FileSync] Library category sync complete - Synced: ${synced}, Failed: ${failed}`);

      return { success: true, synced, failed };
    } catch (error: any) {
      console.error('[FileSync] Error syncing library category to client:', error);
      return { success: false, synced: 0, failed: 0, error: error.message };
    }
  }

  /**
   * Sync all university lessons from a year to client's private store
   * Called when consultant assigns a university year to client
   */
  static async syncUniversityYearToClient(
    yearId: string,
    clientId: string,
    consultantId: string,
  ): Promise<{ success: boolean; synced: number; failed: number; error?: string }> {
    try {
      // Get the year
      const year = await db.query.universityYears.findFirst({
        where: eq(universityYears.id, yearId),
      });

      if (!year) {
        return { success: false, synced: 0, failed: 0, error: 'Year not found' };
      }

      // Get all trimesters for this year
      const trimesters = await db.query.universityTrimesters.findMany({
        where: eq(universityTrimesters.yearId, yearId),
      });

      const trimesterIds = trimesters.map(t => t.id);

      // Get all modules for these trimesters
      let allModules: any[] = [];
      if (trimesterIds.length > 0) {
        allModules = await db.query.universityModules.findMany({
          where: inArray(universityModules.trimesterId, trimesterIds),
        });
      }

      const moduleIds = allModules.map(m => m.id);

      // Get all lessons for these modules
      let allLessons: any[] = [];
      if (moduleIds.length > 0) {
        allLessons = await db.query.universityLessons.findMany({
          where: inArray(universityLessons.moduleId, moduleIds),
        });
      }

      console.log(`\n${'═'.repeat(60)}`);
      console.log(`🎓 [FileSync] Syncing ${allLessons.length} lessons from "${year.title}" to client ${clientId.substring(0, 8)}`);
      console.log(`${'═'.repeat(60)}\n`);

      // Get or create client's private store
      const clientStore = await fileSearchService.getOrCreateClientStore(clientId, consultantId);
      if (!clientStore) {
        return { success: false, synced: 0, failed: 0, error: 'Failed to get or create client private store' };
      }

      let synced = 0;
      let failed = 0;

      for (const lesson of allLessons) {
        // Check if already synced
        const existingDoc = await db.query.fileSearchDocuments.findFirst({
          where: and(
            eq(fileSearchDocuments.sourceType, 'university_lesson'),
            eq(fileSearchDocuments.sourceId, lesson.id),
            eq(fileSearchDocuments.clientId, clientId),
          ),
        });

        if (existingDoc) {
          synced++;
          continue;
        }

        // Build lesson content with hierarchy
        const module = allModules.find(m => m.id === lesson.moduleId);
        const trimester = module ? trimesters.find(t => t.id === module.trimesterId) : null;

        let content = `# ${lesson.title}\n\n`;
        if (year) content += `Anno: ${year.title}\n`;
        if (trimester) content += `Trimestre: ${trimester.title}\n`;
        if (module) content += `Modulo: ${module.title}\n\n`;
        if (lesson.description) content += `${lesson.description}\n\n`;
        if (lesson.content) content += lesson.content;

        // Load linked library document if exists
        if (lesson.libraryDocumentId) {
          const libDoc = await db.query.libraryDocuments.findFirst({
            where: eq(libraryDocuments.id, lesson.libraryDocumentId),
          });
          if (libDoc && libDoc.content) {
            content += `\n\n## Contenuto Allegato\n${libDoc.content}`;
          }
        }

        const uploadResult = await fileSearchService.uploadDocumentFromContent({
          content: content,
          displayName: `[LEZIONE] ${lesson.title}`,
          storeId: clientStore.storeId,
          sourceType: 'university_lesson',
          sourceId: lesson.id,
          clientId: clientId,
          userId: clientId,
        });

        if (uploadResult.success) {
          synced++;
        } else {
          failed++;
        }

        // Rate limit
        if (synced % 10 === 0) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      console.log(`✅ [FileSync] University year sync complete - Synced: ${synced}, Failed: ${failed}`);

      return { success: true, synced, failed };
    } catch (error: any) {
      console.error('[FileSync] Error syncing university year to client:', error);
      return { success: false, synced: 0, failed: 0, error: error.message };
    }
  }

  /**
   * Sync client's goals to their private store
   */
  static async syncClientGoals(
    clientId: string,
    consultantId: string,
  ): Promise<{ success: boolean; synced: number; error?: string }> {
    try {
      const clientGoals = await db.query.goals.findMany({
        where: eq(goals.clientId, clientId),
      });

      if (clientGoals.length === 0) {
        return { success: true, synced: 0 };
      }

      // Get or create client's private store
      const clientStore = await fileSearchService.getOrCreateClientStore(clientId, consultantId);
      if (!clientStore) {
        return { success: false, synced: 0, error: 'Failed to get or create client private store' };
      }

      // Build goals content
      let content = `# Obiettivi del Cliente\n\n`;
      content += `Data aggiornamento: ${new Date().toLocaleDateString('it-IT')}\n\n`;

      for (const goal of clientGoals) {
        content += `## ${goal.title}\n`;
        if (goal.description) content += `${goal.description}\n`;
        content += `- Stato: ${goal.status}\n`;
        content += `- Valore target: ${goal.targetValue} ${goal.unit || ''}\n`;
        content += `- Valore attuale: ${goal.currentValue || '0'} ${goal.unit || ''}\n`;
        if (goal.targetDate) content += `- Scadenza: ${new Date(goal.targetDate).toLocaleDateString('it-IT')}\n`;
        content += '\n';
      }

      // Delete old goals document if exists
      await fileSearchService.deleteDocumentBySource('goal', clientId);

      const uploadResult = await fileSearchService.uploadDocumentFromContent({
        content: content,
        displayName: `[OBIETTIVI] Obiettivi del Cliente`,
        storeId: clientStore.storeId,
        sourceType: 'goal' as any,
        sourceId: clientId,
        clientId: clientId,
        userId: clientId,
      });

      if (uploadResult.success) {
        console.log(`✅ [FileSync] Goals synced to client ${clientId.substring(0, 8)} private store`);
      }

      return uploadResult.success
        ? { success: true, synced: clientGoals.length }
        : { success: false, synced: 0, error: uploadResult.error };
    } catch (error: any) {
      console.error('[FileSync] Error syncing client goals:', error);
      return { success: false, synced: 0, error: error.message };
    }
  }

  /**
   * Sync client's consultation tasks to their private store
   */
  static async syncClientTasks(
    clientId: string,
    consultantId: string,
  ): Promise<{ success: boolean; synced: number; error?: string }> {
    try {
      const clientTasks = await db.query.consultationTasks.findMany({
        where: eq(consultationTasks.clientId, clientId),
      });

      if (clientTasks.length === 0) {
        return { success: true, synced: 0 };
      }

      // Get or create client's private store
      const clientStore = await fileSearchService.getOrCreateClientStore(clientId, consultantId);
      if (!clientStore) {
        return { success: false, synced: 0, error: 'Failed to get or create client private store' };
      }

      // Build tasks content
      let content = `# Task del Cliente\n\n`;
      content += `Data aggiornamento: ${new Date().toLocaleDateString('it-IT')}\n\n`;

      const pendingTasks = clientTasks.filter(t => t.status === 'pending');
      const completedTasks = clientTasks.filter(t => t.status === 'completed');

      if (pendingTasks.length > 0) {
        content += `## Task in corso (${pendingTasks.length})\n\n`;
        for (const task of pendingTasks) {
          content += `### ${task.title}\n`;
          if (task.description) content += `${task.description}\n`;
          content += `- Priorità: ${task.priority}\n`;
          content += `- Categoria: ${task.category}\n`;
          if (task.dueDate) content += `- Scadenza: ${new Date(task.dueDate).toLocaleDateString('it-IT')}\n`;
          content += '\n';
        }
      }

      if (completedTasks.length > 0) {
        content += `## Task completati (${completedTasks.length})\n\n`;
        for (const task of completedTasks) {
          content += `- ✅ ${task.title}`;
          if (task.completedAt) content += ` (completato: ${new Date(task.completedAt).toLocaleDateString('it-IT')})`;
          content += '\n';
        }
      }

      // Delete old tasks document if exists
      await fileSearchService.deleteDocumentBySource('task', clientId);

      const uploadResult = await fileSearchService.uploadDocumentFromContent({
        content: content,
        displayName: `[TASK] Task del Cliente`,
        storeId: clientStore.storeId,
        sourceType: 'task' as any,
        sourceId: clientId,
        clientId: clientId,
        userId: clientId,
      });

      if (uploadResult.success) {
        console.log(`✅ [FileSync] Tasks synced to client ${clientId.substring(0, 8)} private store`);
      }

      return uploadResult.success
        ? { success: true, synced: clientTasks.length }
        : { success: false, synced: 0, error: uploadResult.error };
    } catch (error: any) {
      console.error('[FileSync] Error syncing client tasks:', error);
      return { success: false, synced: 0, error: error.message };
    }
  }

  /**
   * Sync client's daily reflections to their private store
   */
  static async syncClientDailyReflections(
    clientId: string,
    consultantId: string,
  ): Promise<{ success: boolean; synced: number; error?: string }> {
    try {
      const reflections = await db.query.dailyReflections.findMany({
        where: eq(dailyReflections.clientId, clientId),
        orderBy: [desc(dailyReflections.date)],
      });

      if (reflections.length === 0) {
        return { success: true, synced: 0 };
      }

      const clientStore = await fileSearchService.getOrCreateClientStore(clientId, consultantId);
      if (!clientStore) {
        return { success: false, synced: 0, error: 'Failed to get or create client private store' };
      }

      let content = `# Diario Riflessioni del Cliente\n\n`;
      content += `Data aggiornamento: ${new Date().toLocaleDateString('it-IT')}\n`;
      content += `Totale riflessioni: ${reflections.length}\n\n`;

      for (const reflection of reflections) {
        const date = new Date(reflection.date).toLocaleDateString('it-IT');
        content += `## ${date}\n\n`;

        if (reflection.grateful && Array.isArray(reflection.grateful) && reflection.grateful.length > 0) {
          content += `### 🙏 Cose di cui sono grato:\n`;
          for (const item of reflection.grateful) {
            content += `- ${item}\n`;
          }
          content += '\n';
        }

        if (reflection.makeGreat && Array.isArray(reflection.makeGreat) && reflection.makeGreat.length > 0) {
          content += `### ⭐ Cose che renderebbero oggi grandioso:\n`;
          for (const item of reflection.makeGreat) {
            content += `- ${item}\n`;
          }
          content += '\n';
        }

        if (reflection.doBetter) {
          content += `### 📈 Cosa potevo fare meglio:\n${reflection.doBetter}\n\n`;
        }

        content += '---\n\n';
      }

      await fileSearchService.deleteDocumentBySource('daily_reflection' as any, clientId);

      const uploadResult = await fileSearchService.uploadDocumentFromContent({
        content: content,
        displayName: `[RIFLESSIONI] Diario Riflessioni`,
        storeId: clientStore.storeId,
        sourceType: 'daily_reflection' as any,
        sourceId: clientId,
        clientId: clientId,
        userId: clientId,
      });

      if (uploadResult.success) {
        console.log(`✅ [FileSync] Daily reflections synced to client ${clientId.substring(0, 8)} private store (${reflections.length} entries)`);
      }

      return uploadResult.success
        ? { success: true, synced: reflections.length }
        : { success: false, synced: 0, error: uploadResult.error };
    } catch (error: any) {
      console.error('[FileSync] Error syncing client daily reflections:', error);
      return { success: false, synced: 0, error: error.message };
    }
  }

  /**
   * Sync client's progress history to their private store
   */
  static async syncClientProgress(
    clientId: string,
    consultantId: string,
  ): Promise<{ success: boolean; synced: number; error?: string }> {
    try {
      const progressEntries = await db.query.clientProgress.findMany({
        where: eq(clientProgress.clientId, clientId),
        orderBy: [desc(clientProgress.date)],
      });

      if (progressEntries.length === 0) {
        return { success: true, synced: 0 };
      }

      const clientStore = await fileSearchService.getOrCreateClientStore(clientId, consultantId);
      if (!clientStore) {
        return { success: false, synced: 0, error: 'Failed to get or create client private store' };
      }

      let content = `# Storico Avanzamento del Cliente\n\n`;
      content += `Data aggiornamento: ${new Date().toLocaleDateString('it-IT')}\n`;
      content += `Totale registrazioni: ${progressEntries.length}\n\n`;

      for (const entry of progressEntries) {
        const date = new Date(entry.date).toLocaleDateString('it-IT');
        content += `## ${date}\n`;
        content += `- Esercizi completati: ${entry.exercisesCompleted || 0}/${entry.totalExercises || 0}\n`;
        content += `- Giorni consecutivi (streak): ${entry.streakDays || 0}\n`;
        if (entry.notes) {
          content += `- Note: ${entry.notes}\n`;
        }
        content += '\n';
      }

      await fileSearchService.deleteDocumentBySource('client_progress' as any, clientId);

      const uploadResult = await fileSearchService.uploadDocumentFromContent({
        content: content,
        displayName: `[PROGRESSO] Storico Avanzamento`,
        storeId: clientStore.storeId,
        sourceType: 'client_progress' as any,
        sourceId: clientId,
        clientId: clientId,
        userId: clientId,
      });

      if (uploadResult.success) {
        console.log(`✅ [FileSync] Progress history synced to client ${clientId.substring(0, 8)} private store (${progressEntries.length} entries)`);
      }

      return uploadResult.success
        ? { success: true, synced: progressEntries.length }
        : { success: false, synced: 0, error: uploadResult.error };
    } catch (error: any) {
      console.error('[FileSync] Error syncing client progress:', error);
      return { success: false, synced: 0, error: error.message };
    }
  }

  /**
   * Sync client's library reading progress to their private store
   */
  static async syncClientLibraryProgress(
    clientId: string,
    consultantId: string,
  ): Promise<{ success: boolean; synced: number; error?: string }> {
    try {
      const libraryProgressEntries = await db
        .select({
          id: clientLibraryProgress.id,
          documentId: clientLibraryProgress.documentId,
          isRead: clientLibraryProgress.isRead,
          readAt: clientLibraryProgress.readAt,
          timeSpent: clientLibraryProgress.timeSpent,
          documentTitle: libraryDocuments.title,
        })
        .from(clientLibraryProgress)
        .leftJoin(libraryDocuments, eq(clientLibraryProgress.documentId, libraryDocuments.id))
        .where(eq(clientLibraryProgress.clientId, clientId));

      if (libraryProgressEntries.length === 0) {
        return { success: true, synced: 0 };
      }

      const clientStore = await fileSearchService.getOrCreateClientStore(clientId, consultantId);
      if (!clientStore) {
        return { success: false, synced: 0, error: 'Failed to get or create client private store' };
      }

      let content = `# Progresso Letture Libreria\n\n`;
      content += `Data aggiornamento: ${new Date().toLocaleDateString('it-IT')}\n`;
      content += `Totale documenti tracciati: ${libraryProgressEntries.length}\n\n`;

      const readEntries = libraryProgressEntries.filter(e => e.isRead);
      const unreadEntries = libraryProgressEntries.filter(e => !e.isRead);

      if (readEntries.length > 0) {
        content += `## ✅ Documenti Letti (${readEntries.length})\n\n`;
        for (const entry of readEntries) {
          content += `### ${entry.documentTitle || 'Documento sconosciuto'}\n`;
          if (entry.readAt) {
            content += `- Letto il: ${new Date(entry.readAt).toLocaleDateString('it-IT')}\n`;
          }
          if (entry.timeSpent) {
            const minutes = Math.round(entry.timeSpent / 60);
            content += `- Tempo di lettura: ${minutes} minuti\n`;
          }
          content += '\n';
        }
      }

      if (unreadEntries.length > 0) {
        content += `## 📖 In Lettura (${unreadEntries.length})\n\n`;
        for (const entry of unreadEntries) {
          content += `- ${entry.documentTitle || 'Documento sconosciuto'}`;
          if (entry.timeSpent) {
            const minutes = Math.round(entry.timeSpent / 60);
            content += ` (${minutes} min spesi)`;
          }
          content += '\n';
        }
      }

      await fileSearchService.deleteDocumentBySource('library_progress' as any, clientId);

      const uploadResult = await fileSearchService.uploadDocumentFromContent({
        content: content,
        displayName: `[LIBRERIA] Progresso Letture`,
        storeId: clientStore.storeId,
        sourceType: 'library_progress' as any,
        sourceId: clientId,
        clientId: clientId,
        userId: clientId,
      });

      if (uploadResult.success) {
        console.log(`✅ [FileSync] Library progress synced to client ${clientId.substring(0, 8)} private store (${libraryProgressEntries.length} entries)`);
      }

      return uploadResult.success
        ? { success: true, synced: libraryProgressEntries.length }
        : { success: false, synced: 0, error: uploadResult.error };
    } catch (error: any) {
      console.error('[FileSync] Error syncing client library progress:', error);
      return { success: false, synced: 0, error: error.message };
    }
  }

  /**
   * Sync client's email journey progress to their private store
   */
  static async syncClientEmailJourneyProgress(
    clientId: string,
    consultantId: string,
  ): Promise<{ success: boolean; synced: number; error?: string }> {
    try {
      const journeyProgressEntries = await db
        .select({
          id: clientEmailJourneyProgress.id,
          currentDay: clientEmailJourneyProgress.currentDay,
          monthStartDate: clientEmailJourneyProgress.monthStartDate,
          lastEmailSentAt: clientEmailJourneyProgress.lastEmailSentAt,
          lastEmailSubject: clientEmailJourneyProgress.lastEmailSubject,
          templateId: clientEmailJourneyProgress.lastTemplateUsedId,
          templateTitle: emailJourneyTemplates.title,
          templateEmailType: emailJourneyTemplates.emailType,
          templateDayOfMonth: emailJourneyTemplates.dayOfMonth,
        })
        .from(clientEmailJourneyProgress)
        .leftJoin(emailJourneyTemplates, eq(clientEmailJourneyProgress.lastTemplateUsedId, emailJourneyTemplates.id))
        .where(eq(clientEmailJourneyProgress.clientId, clientId));

      if (journeyProgressEntries.length === 0) {
        return { success: true, synced: 0 };
      }

      const clientStore = await fileSearchService.getOrCreateClientStore(clientId, consultantId);
      if (!clientStore) {
        return { success: false, synced: 0, error: 'Failed to get or create client private store' };
      }

      let content = `# Email Journey - Email Ricevute\n\n`;
      content += `Data aggiornamento: ${new Date().toLocaleDateString('it-IT')}\n\n`;

      for (const entry of journeyProgressEntries) {
        content += `## Stato Journey\n`;
        content += `- Giorno corrente nel ciclo: ${entry.currentDay}/28\n`;
        if (entry.monthStartDate) {
          content += `- Inizio ciclo: ${new Date(entry.monthStartDate).toLocaleDateString('it-IT')}\n`;
        }
        content += '\n';

        if (entry.lastEmailSentAt) {
          content += `## Ultima Email Ricevuta\n`;
          if (entry.lastEmailSubject) {
            content += `- Oggetto: ${entry.lastEmailSubject}\n`;
          }
          if (entry.templateTitle) {
            content += `- Template: ${entry.templateTitle}\n`;
          }
          if (entry.templateEmailType) {
            content += `- Tipo: ${entry.templateEmailType}\n`;
          }
          if (entry.templateDayOfMonth) {
            content += `- Giorno del mese: ${entry.templateDayOfMonth}\n`;
          }
          content += `- Inviata il: ${new Date(entry.lastEmailSentAt).toLocaleDateString('it-IT')}\n`;
        } else {
          content += `## Email\n`;
          content += `- Nessuna email inviata ancora nel journey corrente\n`;
        }
        content += '\n';
      }

      await fileSearchService.deleteDocumentBySource('email_journey' as any, clientId);

      const uploadResult = await fileSearchService.uploadDocumentFromContent({
        content: content,
        displayName: `[EMAIL JOURNEY] Email Ricevute`,
        storeId: clientStore.storeId,
        sourceType: 'email_journey' as any,
        sourceId: clientId,
        clientId: clientId,
        userId: clientId,
      });

      if (uploadResult.success) {
        console.log(`✅ [FileSync] Email journey progress synced to client ${clientId.substring(0, 8)} private store`);
      }

      return uploadResult.success
        ? { success: true, synced: journeyProgressEntries.length }
        : { success: false, synced: 0, error: uploadResult.error };
    } catch (error: any) {
      console.error('[FileSync] Error syncing client email journey progress:', error);
      return { success: false, synced: 0, error: error.message };
    }
  }

  /**
   * Full migration for an existing client - sync all assigned content to their private store
   */
  static async migrateClientToPrivateStore(
    clientId: string,
    consultantId: string,
  ): Promise<{
    success: boolean;
    exercises: { synced: number; failed: number };
    library: { synced: number; failed: number };
    university: { synced: number; failed: number };
    goals: { synced: number };
    tasks: { synced: number };
    consultations: { synced: number; failed: number };
    errors: string[];
  }> {
    console.log(`\n${'═'.repeat(70)}`);
    console.log(`🔄 [FileSync] FULL MIGRATION for client ${clientId.substring(0, 8)} to private store`);
    console.log(`${'═'.repeat(70)}\n`);

    const errors: string[] = [];
    let exercisesResult = { synced: 0, failed: 0 };
    let libraryResult = { synced: 0, failed: 0 };
    let universityResult = { synced: 0, failed: 0 };
    let goalsResult = { synced: 0 };
    let tasksResult = { synced: 0 };
    let consultationsResult = { synced: 0, failed: 0, skipped: 0 };

    // 1. Sync all assigned exercises
    console.log(`\n📝 [Migration] Step 1: Syncing assigned exercises...`);
    const assignments = await db.query.exerciseAssignments.findMany({
      where: eq(exerciseAssignments.clientId, clientId),
    });

    for (const assignment of assignments) {
      const result = await this.syncExerciseToClient(assignment.exerciseId, clientId, consultantId);
      if (result.success) {
        exercisesResult.synced++;
      } else {
        exercisesResult.failed++;
        errors.push(`Exercise ${assignment.exerciseId}: ${result.error}`);
      }
    }
    console.log(`   ✅ Exercises: ${exercisesResult.synced} synced, ${exercisesResult.failed} failed`);

    // 2. Sync all assigned library categories
    console.log(`\n📚 [Migration] Step 2: Syncing assigned library categories...`);
    const libraryAssignments = await db.query.libraryCategoryClientAssignments.findMany({
      where: eq(libraryCategoryClientAssignments.clientId, clientId),
    });

    for (const assignment of libraryAssignments) {
      const result = await this.syncLibraryCategoryToClient(assignment.categoryId, clientId, consultantId);
      if (result.success) {
        libraryResult.synced += result.synced;
        libraryResult.failed += result.failed;
      } else {
        errors.push(`Library category ${assignment.categoryId}: ${result.error}`);
      }
    }
    console.log(`   ✅ Library docs: ${libraryResult.synced} synced, ${libraryResult.failed} failed`);

    // 3. Sync all assigned university years
    console.log(`\n🎓 [Migration] Step 3: Syncing assigned university years...`);
    const universityAssignments = await db.query.universityYearClientAssignments.findMany({
      where: eq(universityYearClientAssignments.clientId, clientId),
    });

    for (const assignment of universityAssignments) {
      const result = await this.syncUniversityYearToClient(assignment.yearId, clientId, consultantId);
      if (result.success) {
        universityResult.synced += result.synced;
        universityResult.failed += result.failed;
      } else {
        errors.push(`University year ${assignment.yearId}: ${result.error}`);
      }
    }
    console.log(`   ✅ University lessons: ${universityResult.synced} synced, ${universityResult.failed} failed`);

    // 4. Sync goals
    console.log(`\n🎯 [Migration] Step 4: Syncing goals...`);
    const goalsRes = await this.syncClientGoals(clientId, consultantId);
    goalsResult.synced = goalsRes.synced;
    if (!goalsRes.success && goalsRes.error) errors.push(`Goals: ${goalsRes.error}`);
    console.log(`   ✅ Goals: ${goalsResult.synced} synced`);

    // 5. Sync tasks
    console.log(`\n✅ [Migration] Step 5: Syncing tasks...`);
    const tasksRes = await this.syncClientTasks(clientId, consultantId);
    tasksResult.synced = tasksRes.synced;
    if (!tasksRes.success && tasksRes.error) errors.push(`Tasks: ${tasksRes.error}`);
    console.log(`   ✅ Tasks: ${tasksResult.synced} synced`);

    // 6. Sync consultations (already handled by syncAllConsultations but call for this client)
    // SECURITY: Filter by both clientId AND consultantId to prevent cross-consultant data exposure
    console.log(`\n📞 [Migration] Step 6: Syncing consultations...`);
    const clientConsultations = await db.query.consultations.findMany({
      where: and(
        eq(consultations.clientId, clientId),
        eq(consultations.consultantId, consultantId),
        eq(consultations.status, 'completed'),
      ),
    });

    for (const consultation of clientConsultations) {
      if (!consultation.transcript && !consultation.notes) continue;
      
      const isAlreadyIndexed = await fileSearchService.isDocumentIndexed('consultation', consultation.id);
      if (isAlreadyIndexed) {
        consultationsResult.skipped++;
        continue;
      }

      const result = await this.syncClientConsultationNotes(consultation.id, clientId, consultantId);
      if (result.success) {
        consultationsResult.synced++;
      } else {
        consultationsResult.failed++;
      }
    }
    console.log(`   ✅ Consultations: ${consultationsResult.synced} synced, ${consultationsResult.skipped} skipped, ${consultationsResult.failed} failed`);

    console.log(`\n${'═'.repeat(70)}`);
    console.log(`✅ [FileSync] MIGRATION COMPLETE for client ${clientId.substring(0, 8)}`);
    console.log(`${'═'.repeat(70)}\n`);

    return {
      success: errors.length === 0,
      exercises: exercisesResult,
      library: libraryResult,
      university: universityResult,
      goals: goalsResult,
      tasks: tasksResult,
      consultations: consultationsResult,
      errors,
    };
  }

  /**
   * Migrate ALL clients for a consultant to the new private store architecture
   */
  static async migrateAllClientsToPrivateStores(
    consultantId: string,
  ): Promise<{
    success: boolean;
    clientsMigrated: number;
    totalExercises: number;
    totalLibrary: number;
    totalUniversity: number;
    totalGoals: number;
    totalTasks: number;
    totalConsultations: number;
    errors: string[];
  }> {
    console.log(`\n${'═'.repeat(70)}`);
    console.log(`🚀 [FileSync] BULK MIGRATION - All clients for consultant ${consultantId.substring(0, 8)}`);
    console.log(`${'═'.repeat(70)}\n`);

    const clients = await db.query.users.findMany({
      where: eq(users.consultantId, consultantId),
    });

    console.log(`📋 Found ${clients.length} clients to migrate`);

    let clientsMigrated = 0;
    let totalExercises = 0;
    let totalLibrary = 0;
    let totalUniversity = 0;
    let totalGoals = 0;
    let totalTasks = 0;
    let totalConsultations = 0;
    const errors: string[] = [];

    for (const client of clients) {
      console.log(`\n👤 Migrating client: ${client.firstName} ${client.lastName} (${client.id.substring(0, 8)})`);

      const result = await this.migrateClientToPrivateStore(client.id, consultantId);

      if (result.success) {
        clientsMigrated++;
      }

      totalExercises += result.exercises.synced;
      totalLibrary += result.library.synced;
      totalUniversity += result.university.synced;
      totalGoals += result.goals.synced;
      totalTasks += result.tasks.synced;
      totalConsultations += result.consultations.synced;
      errors.push(...result.errors);
    }

    console.log(`\n${'═'.repeat(70)}`);
    console.log(`✅ [FileSync] BULK MIGRATION COMPLETE`);
    console.log(`   👤 Clients migrated: ${clientsMigrated}/${clients.length}`);
    console.log(`   📝 Exercises: ${totalExercises}`);
    console.log(`   📚 Library docs: ${totalLibrary}`);
    console.log(`   🎓 University lessons: ${totalUniversity}`);
    console.log(`   🎯 Goals: ${totalGoals}`);
    console.log(`   ✅ Tasks: ${totalTasks}`);
    console.log(`   📞 Consultations: ${totalConsultations}`);
    console.log(`${'═'.repeat(70)}\n`);

    return {
      success: errors.length === 0,
      clientsMigrated,
      totalExercises,
      totalLibrary,
      totalUniversity,
      totalGoals,
      totalTasks,
      totalConsultations,
      errors,
    };
  }
}

export const fileSearchSyncService = FileSearchSyncService;
