import { Router } from 'express';
import { authenticateToken, requireRole, type AuthRequest } from '../middleware/auth';
import { fileSearchService } from '../ai/file-search-service';
import { fileSearchSyncService } from '../services/file-search-sync-service';

const router = Router();

/**
 * GET /api/file-search/stores
 * Get all FileSearchStores for current user
 */
router.get('/stores', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const role = req.user!.role as 'consultant' | 'client';
    
    const stores = await fileSearchService.getStoresForUser(userId, role);
    res.json(stores);
  } catch (error: any) {
    console.error('[FileSearch API] Error fetching stores:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/file-search/info
 * Get FileSearchStore info for current consultant
 */
router.get('/info', authenticateToken, requireRole('consultant'), async (req: AuthRequest, res) => {
  try {
    const consultantId = req.user!.id;
    const info = await fileSearchSyncService.getStoreInfo(consultantId);
    res.json(info);
  } catch (error: any) {
    console.error('[FileSearch API] Error fetching info:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/file-search/stores/:storeId/documents
 * Get documents in a store
 */
router.get('/stores/:storeId/documents', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const docs = await fileSearchService.getDocumentsInStore(req.params.storeId);
    res.json(docs);
  } catch (error: any) {
    console.error('[FileSearch API] Error fetching documents:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/file-search/sync-library
 * Trigger sync of library documents to FileSearchStore
 */
router.post('/sync-library', authenticateToken, requireRole('consultant'), async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const result = await fileSearchSyncService.syncAllLibraryDocuments(userId);
    res.json(result);
  } catch (error: any) {
    console.error('[FileSearch API] Error syncing library:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/file-search/sync-knowledge
 * Trigger sync of knowledge base documents to FileSearchStore
 */
router.post('/sync-knowledge', authenticateToken, requireRole('consultant'), async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const result = await fileSearchSyncService.syncAllConsultantKnowledgeDocuments(userId);
    res.json(result);
  } catch (error: any) {
    console.error('[FileSearch API] Error syncing knowledge:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/file-search/sync-consultations
 * Trigger sync of consultations to FileSearchStore
 */
router.post('/sync-consultations', authenticateToken, requireRole('consultant'), async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const result = await fileSearchSyncService.syncAllConsultations(userId);
    res.json(result);
  } catch (error: any) {
    console.error('[FileSearch API] Error syncing consultations:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/file-search/sync-exercises
 * Trigger sync of exercises to FileSearchStore
 */
router.post('/sync-exercises', authenticateToken, requireRole('consultant'), async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const result = await fileSearchSyncService.syncAllExercises(userId);
    res.json(result);
  } catch (error: any) {
    console.error('[FileSearch API] Error syncing exercises:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/file-search/sync-university
 * Trigger sync of university lessons to FileSearchStore
 */
router.post('/sync-university', authenticateToken, requireRole('consultant'), async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const result = await fileSearchSyncService.syncAllUniversityLessons(userId);
    res.json(result);
  } catch (error: any) {
    console.error('[FileSearch API] Error syncing university:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/file-search/sync-all
 * Trigger full sync of ALL content (library + knowledge base + exercises + university + consultations) to FileSearchStore
 */
router.post('/sync-all', authenticateToken, requireRole('consultant'), async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const result = await fileSearchSyncService.syncAllContentForConsultant(userId);
    res.json({
      success: true,
      ...result,
      message: `Sincronizzazione COMPLETA. Library: ${result.library.synced}/${result.library.total}, Knowledge Base: ${result.knowledgeBase.synced}/${result.knowledgeBase.total}, Exercises: ${result.exercises.synced}/${result.exercises.total}, University: ${result.university.synced}/${result.university.total}, Consultations: ${result.consultations.synced}/${result.consultations.total}`,
    });
  } catch (error: any) {
    console.error('[FileSearch API] Error syncing all:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/file-search/initialize
 * Quick endpoint to create an empty FileSearchStore for a consultant
 * Use this before syncing documents to test File Search functionality
 */
router.post('/initialize', authenticateToken, requireRole('consultant'), async (req: AuthRequest, res) => {
  try {
    const consultantId = req.user!.id;
    
    // Check if store already exists
    const existingStores = await fileSearchService.getStoresForUser(consultantId, 'consultant');
    if (existingStores.length > 0) {
      console.log(`✅ [FileSearch API] Store already exists for consultant ${consultantId}`);
      return res.json({
        success: true,
        message: 'Store già esistente',
        store: existingStores[0],
        isNew: false,
      });
    }
    
    // Check if GEMINI_API_KEY is configured
    if (!process.env.GEMINI_API_KEY) {
      return res.status(400).json({
        success: false,
        error: 'GEMINI_API_KEY non configurata. File Search richiede Google AI Studio.',
      });
    }
    
    // Create new store
    console.log(`🔧 [FileSearch API] Creating new store for consultant ${consultantId}`);
    const result = await fileSearchService.createStore({
      displayName: 'Knowledge Base Consulente',
      ownerId: consultantId,
      ownerType: 'consultant',
      description: 'Store per ricerca semantica AI (File Search)',
    });
    
    if (!result.success) {
      return res.status(500).json({
        success: false,
        error: result.error || 'Errore durante la creazione dello store',
      });
    }
    
    // Fetch the created store
    const newStore = await fileSearchService.getStore(result.storeId!);
    
    console.log(`✅ [FileSearch API] Store created successfully: ${result.storeId}`);
    res.json({
      success: true,
      message: 'Store creato con successo! Ora puoi sincronizzare i documenti.',
      store: newStore,
      isNew: true,
      nextStep: 'Chiama /api/file-search/sync-all per sincronizzare tutti i documenti',
    });
  } catch (error: any) {
    console.error('[FileSearch API] Error initializing store:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
