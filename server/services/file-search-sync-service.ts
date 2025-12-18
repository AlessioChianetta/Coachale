/**
 * File Search Sync Service
 * Automatically syncs library documents and knowledge base to FileSearchStore
 * 
 * Supports:
 * - Library Documents (for clients via consultant's library)
 * - Consultant Knowledge Documents (for consultant's AI assistant)
 * - Client Knowledge Documents (for client's AI assistant)
 */

import { db } from "../db";
import { 
  libraryDocuments, 
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
  consultations,
  users,
} from "../../shared/schema";
import { fileSearchService } from "../ai/file-search-service";
import { eq, and, desc, isNotNull, inArray } from "drizzle-orm";

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
      const errors: string[] = [];

      console.log(`🔄 [FileSync] Syncing ${docs.length} knowledge documents for consultant ${consultantId}`);

      for (const doc of docs) {
        const isAlreadyIndexed = await fileSearchService.isDocumentIndexed('knowledge_base', doc.id);
        if (isAlreadyIndexed) {
          skipped++;
          continue;
        }

        const result = await this.syncConsultantKnowledgeDocument(doc.id, consultantId);
        if (result.success) {
          synced++;
        } else {
          failed++;
          errors.push(`${doc.title}: ${result.error}`);
        }
      }

      console.log(`✅ [FileSync] Knowledge Base sync complete - Synced: ${synced}, Skipped: ${skipped}, Failed: ${failed}`);

      return {
        total: docs.length,
        synced,
        failed,
        skipped,
        errors,
      };
    } catch (error: any) {
      console.error('[FileSync] Knowledge bulk sync error:', error);
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

      // Build exercise content for indexing
      const content = this.buildExerciseContent(exercise);
      
      const uploadResult = await fileSearchService.uploadDocumentFromContent({
        content: content,
        displayName: `[EX] ${exercise.title}`,
        storeId: consultantStore.id,
        sourceType: 'exercise',
        sourceId: exerciseId,
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
   */
  private static buildExerciseContent(exercise: any): string {
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
      parts.push(`\n## Piattaforma di lavoro\n${exercise.workPlatform}`);
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
      const errors: string[] = [];

      console.log(`\n${'═'.repeat(60)}`);
      console.log(`🏋️ [FileSync] Syncing ${allExercises.length} exercises for consultant ${consultantId}`);
      console.log(`${'═'.repeat(60)}\n`);

      for (const exercise of allExercises) {
        const isAlreadyIndexed = await fileSearchService.isDocumentIndexed('exercise', exercise.id);
        if (isAlreadyIndexed) {
          skipped++;
          continue;
        }

        const result = await this.syncExercise(exercise.id, consultantId);
        if (result.success) {
          synced++;
        } else {
          failed++;
          errors.push(`${exercise.title}: ${result.error}`);
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

      return {
        total: allExercises.length,
        synced,
        failed,
        skipped,
        errors,
      };
    } catch (error: any) {
      console.error('[FileSync] Exercises bulk sync error:', error);
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
   */
  static async syncUniversityLesson(
    lessonId: string,
    consultantId: string,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const lesson = await db.query.universityLessons.findFirst({
        where: eq(universityLessons.id, lessonId),
        with: {
          module: {
            with: {
              trimester: {
                with: {
                  year: true
                }
              }
            }
          }
        }
      });

      if (!lesson) {
        return { success: false, error: 'Lesson not found' };
      }

      const isAlreadyIndexed = await fileSearchService.isDocumentIndexed('university_lesson', lessonId);
      if (isAlreadyIndexed) {
        console.log(`📌 [FileSync] Lesson already indexed: ${lessonId}`);
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

      // Build lesson content for indexing
      const content = this.buildLessonContent(lesson);
      
      const uploadResult = await fileSearchService.uploadDocumentFromContent({
        content: content,
        displayName: `[LESSON] ${lesson.title}`,
        storeId: consultantStore.id,
        sourceType: 'university_lesson',
        sourceId: lessonId,
      });

      if (uploadResult.success) {
        console.log(`✅ [FileSync] Lesson synced: ${lesson.title}`);
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
   */
  private static buildLessonContent(lesson: any): string {
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
      parts.push(`\n## Contenuto\n${lesson.content}`);
    }
    
    if (lesson.videoUrl) {
      parts.push(`\n## Video\n${lesson.videoUrl}`);
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
      
      // Get all lessons through the hierarchy
      const allLessons = await db.query.universityLessons.findMany({
        with: {
          module: {
            with: {
              trimester: {
                with: {
                  year: true
                }
              }
            }
          }
        }
      });

      let synced = 0;
      let failed = 0;
      let skipped = 0;
      const errors: string[] = [];

      console.log(`\n${'═'.repeat(60)}`);
      console.log(`🎓 [FileSync] Syncing ${allLessons.length} university lessons`);
      console.log(`${'═'.repeat(60)}\n`);

      for (const lesson of allLessons) {
        const isAlreadyIndexed = await fileSearchService.isDocumentIndexed('university_lesson', lesson.id);
        if (isAlreadyIndexed) {
          skipped++;
          continue;
        }

        const result = await this.syncUniversityLesson(lesson.id, consultantId);
        if (result.success) {
          synced++;
        } else {
          failed++;
          errors.push(`${lesson.title}: ${result.error}`);
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

      return {
        total: allLessons.length,
        synced,
        failed,
        skipped,
        errors,
      };
    } catch (error: any) {
      console.error('[FileSync] University lessons bulk sync error:', error);
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
      const errors: string[] = [];

      console.log(`\n${'═'.repeat(60)}`);
      console.log(`📞 [FileSync] Syncing ${consultationsWithContent.length} consultations for consultant ${consultantId}`);
      console.log(`${'═'.repeat(60)}\n`);

      for (const consultation of consultationsWithContent) {
        const isAlreadyIndexed = await fileSearchService.isDocumentIndexed('consultation', consultation.id);
        if (isAlreadyIndexed) {
          skipped++;
          continue;
        }

        const result = await this.syncConsultation(consultation.id, consultantId);
        if (result.success) {
          synced++;
        } else {
          failed++;
          errors.push(`Consultation ${consultation.id}: ${result.error}`);
        }
        
        // Small delay to avoid rate limiting
        if (synced % 10 === 0) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      console.log(`\n${'═'.repeat(60)}`);
      console.log(`✅ [FileSync] Consultations sync complete`);
      console.log(`   📊 Total with content: ${consultationsWithContent.length}`);
      console.log(`   ✅ Synced: ${synced}`);
      console.log(`   ⏭️  Skipped (already indexed): ${skipped}`);
      console.log(`   ❌ Failed: ${failed}`);
      console.log(`${'═'.repeat(60)}\n`);

      return {
        total: consultationsWithContent.length,
        synced,
        failed,
        skipped,
        errors,
      };
    } catch (error: any) {
      console.error('[FileSync] Consultations bulk sync error:', error);
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
   * Sync ALL content for a consultant (library + knowledge base + exercises + university + consultations)
   */
  static async syncAllContentForConsultant(consultantId: string): Promise<{
    library: { total: number; synced: number; failed: number; errors: string[] };
    knowledgeBase: { total: number; synced: number; failed: number; skipped: number; errors: string[] };
    exercises: { total: number; synced: number; failed: number; skipped: number; errors: string[] };
    university: { total: number; synced: number; failed: number; skipped: number; errors: string[] };
    consultations: { total: number; synced: number; failed: number; skipped: number; errors: string[] };
  }> {
    console.log(`\n${'═'.repeat(70)}`);
    console.log(`🔄 [FileSync] Starting FULL content sync for consultant ${consultantId}`);
    console.log(`${'═'.repeat(70)}\n`);

    const libraryResult = await this.syncAllLibraryDocuments(consultantId);
    const knowledgeResult = await this.syncAllConsultantKnowledgeDocuments(consultantId);
    const exercisesResult = await this.syncAllExercises(consultantId);
    const universityResult = await this.syncAllUniversityLessons(consultantId);
    const consultationsResult = await this.syncAllConsultations(consultantId);

    console.log(`\n${'═'.repeat(70)}`);
    console.log(`✅ [FileSync] FULL content sync complete for consultant ${consultantId}`);
    console.log(`   📚 Library: ${libraryResult.synced}/${libraryResult.total} synced`);
    console.log(`   📖 Knowledge Base: ${knowledgeResult.synced}/${knowledgeResult.total} synced`);
    console.log(`   🏋️ Exercises: ${exercisesResult.synced}/${exercisesResult.total} synced`);
    console.log(`   🎓 University: ${universityResult.synced}/${universityResult.total} synced`);
    console.log(`   📞 Consultations: ${consultationsResult.synced}/${consultationsResult.total} synced`);
    console.log(`${'═'.repeat(70)}\n`);

    return {
      library: libraryResult,
      knowledgeBase: knowledgeResult,
      exercises: exercisesResult,
      university: universityResult,
      consultations: consultationsResult,
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

      // Build content from the submission
      const content = this.buildExerciseSubmissionContent(exercise, submission, assignment);

      // Upload to client's PRIVATE store
      const uploadResult = await fileSearchService.uploadDocumentFromContent({
        content: content,
        displayName: `[RISPOSTA] ${exercise.title}`,
        storeId: clientStore.storeId,
        sourceType: 'exercise',
        sourceId: submissionId,
        clientId: clientId,
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
   */
  private static buildExerciseSubmissionContent(exercise: any, submission: any, assignment: any): string {
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
    }>;
    summary: { totalMissing: number; consultantMissing: number; clientsMissing: number; healthScore: number };
    recommendations: string[];
  }> {
    console.log(`\n${'═'.repeat(60)}`);
    console.log(`🔍 [FileSync] Running FAST Audit for consultant ${consultantId}`);
    console.log(`${'═'.repeat(60)}\n`);

    // FAST APPROACH: Count from DB and compare with file_search_documents table
    // Instead of calling API for each document, just use SQL counts
    
    // Count items in source tables
    const libraryDocs = await db.select({ id: libraryDocuments.id, title: libraryDocuments.title, type: libraryDocuments.type })
      .from(libraryDocuments).where(eq(libraryDocuments.createdBy, consultantId));
    const knowledgeDocs = await db.select({ id: consultantKnowledgeDocuments.id, title: consultantKnowledgeDocuments.title })
      .from(consultantKnowledgeDocuments).where(eq(consultantKnowledgeDocuments.consultantId, consultantId));
    const allExercises = await db.select({ id: exercises.id, title: exercises.title })
      .from(exercises).where(eq(exercises.createdBy, consultantId));
    
    // University lessons via join - get all years for consultant first, then get lessons
    const consultantYears = await db.select({ id: universityYears.id })
      .from(universityYears).where(eq(universityYears.createdBy, consultantId));
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
    const indexedDocsRaw = await db.select()
      .from(fileSearchDocuments)
      .innerJoin(fileSearchStores, eq(fileSearchDocuments.storeId, fileSearchStores.id))
      .where(and(
        eq(fileSearchStores.ownerId, consultantId),
        eq(fileSearchDocuments.status, 'indexed')
      ));
    const indexedDocs = indexedDocsRaw.map(r => ({ sourceType: r.file_search_documents.sourceType, sourceId: r.file_search_documents.sourceId }));

    const indexedLibraryIds = new Set(indexedDocs.filter(d => d.sourceType === 'library').map(d => d.sourceId));
    const indexedKnowledgeIds = new Set(indexedDocs.filter(d => d.sourceType === 'knowledge_base').map(d => d.sourceId));
    const indexedExerciseIds = new Set(indexedDocs.filter(d => d.sourceType === 'exercise').map(d => d.sourceId));
    const indexedUniversityIds = new Set(indexedDocs.filter(d => d.sourceType === 'university').map(d => d.sourceId));

    // Calculate missing
    const libraryMissing = libraryDocs.filter(d => !indexedLibraryIds.has(d.id)).map(d => ({ id: d.id, title: d.title, type: d.type || 'document' }));
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

      // Get indexed for this client
      const clientIndexedRaw = await db.select()
        .from(fileSearchDocuments)
        .innerJoin(fileSearchStores, eq(fileSearchDocuments.storeId, fileSearchStores.id))
        .where(and(eq(fileSearchDocuments.clientId, client.id), eq(fileSearchDocuments.status, 'indexed')));
      const clientIndexed = clientIndexedRaw.map(r => ({ sourceType: r.file_search_documents.sourceType, sourceId: r.file_search_documents.sourceId }));

      const indexedSubmissionIds = new Set(clientIndexed.filter(d => d.sourceType === 'exercise').map(d => d.sourceId));
      const indexedConsultationIds = new Set(clientIndexed.filter(d => d.sourceType === 'consultation').map(d => d.sourceId));
      const indexedClientKnowledgeIds = new Set(clientIndexed.filter(d => d.sourceType === 'knowledge_base').map(d => d.sourceId));

      const submissionsMissing = clientSubmissions.filter(s => !indexedSubmissionIds.has(s.id)).map(s => ({ id: s.id, exerciseTitle: 'Esercizio', submittedAt: s.submittedAt }));
      const consultationsMissing = consultationsWithContent.filter(c => !indexedConsultationIds.has(c.id)).map(c => ({ id: c.id, date: c.scheduledAt, summary: c.notes?.substring(0, 50) || '' }));
      const clientKnowledgeMissing = clientKnowledge.filter(k => !indexedClientKnowledgeIds.has(k.id)).map(k => ({ id: k.id, title: k.title }));

      const clientMissing = submissionsMissing.length + consultationsMissing.length + clientKnowledgeMissing.length;
      
      if (clientSubmissions.length > 0 || consultationsWithContent.length > 0 || clientKnowledge.length > 0) {
        clientsAudit.push({
          clientId: client.id,
          clientName: `${client.firstName} ${client.lastName}`,
          clientEmail: client.email,
          exerciseResponses: { total: clientSubmissions.length, indexed: clientSubmissions.length - submissionsMissing.length, missing: submissionsMissing },
          consultationNotes: { total: consultationsWithContent.length, indexed: consultationsWithContent.length - consultationsMissing.length, missing: consultationsMissing },
          knowledgeDocs: { total: clientKnowledge.length, indexed: clientKnowledge.length - clientKnowledgeMissing.length, missing: clientKnowledgeMissing },
        });
        totalClientsMissing += clientMissing;
      }
    }

    const consultantMissing = libraryResult.missing.length + knowledgeBaseResult.missing.length + 
                              exercisesResult.missing.length + universityResult.missing.length;
    const totalMissing = consultantMissing + totalClientsMissing;

    const totalDocs = libraryResult.total + knowledgeBaseResult.total + exercisesResult.total + universityResult.total +
                      clientsAudit.reduce((sum, c) => sum + c.exerciseResponses.total + c.consultationNotes.total + c.knowledgeDocs.total, 0);
    const totalIndexed = (libraryResult.total - libraryResult.missing.length) + 
                         (knowledgeBaseResult.total - knowledgeBaseResult.missing.length) +
                         (exercisesResult.total - exercisesResult.missing.length) + 
                         (universityResult.total - universityResult.missing.length) +
                         clientsAudit.reduce((sum, c) => 
                           sum + (c.exerciseResponses.total - c.exerciseResponses.missing.length) + 
                           (c.consultationNotes.total - c.consultationNotes.missing.length) + 
                           (c.knowledgeDocs.total - c.knowledgeDocs.missing.length), 0);

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
      summary: {
        totalMissing,
        consultantMissing,
        clientsMissing: totalClientsMissing,
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
}

export const fileSearchSyncService = FileSearchSyncService;
