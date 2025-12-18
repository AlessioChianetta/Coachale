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
import { eq, and, desc, isNotNull } from "drizzle-orm";

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
}

export const fileSearchSyncService = FileSearchSyncService;
