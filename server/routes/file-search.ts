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
 * POST /api/file-search/sync-all
 * Trigger full sync of all documents (library + knowledge base) to FileSearchStore
 */
router.post('/sync-all', authenticateToken, requireRole('consultant'), async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const result = await fileSearchSyncService.syncAllDocumentsForConsultant(userId);
    res.json({
      success: true,
      ...result,
      message: `Sincronizzazione completata. Library: ${result.library.synced}/${result.library.total}, Knowledge Base: ${result.knowledgeBase.synced}/${result.knowledgeBase.total} (${result.knowledgeBase.skipped} già sincronizzati)`,
    });
  } catch (error: any) {
    console.error('[FileSearch API] Error syncing all:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
