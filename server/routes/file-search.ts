import { Router } from 'express';
import { authenticateToken, type AuthRequest } from '../middleware/auth';
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
router.post('/sync-library', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const result = await fileSearchSyncService.syncAllLibraryDocuments(userId);
    res.json(result);
  } catch (error: any) {
    console.error('[FileSearch API] Error syncing:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
