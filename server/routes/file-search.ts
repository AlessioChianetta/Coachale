import { Router, Request, Response } from 'express';
import { authenticateToken, requireRole, type AuthRequest } from '../middleware/auth';
import { fileSearchService } from '../ai/file-search-service';
import { fileSearchSyncService } from '../services/file-search-sync-service';
import { db } from '../db';
import { fileSearchSettings, fileSearchUsageLogs, fileSearchStores, fileSearchDocuments, users, consultantWhatsappConfig } from '../../shared/schema';
import { eq, desc, sql, and, gte, isNull, isNotNull, inArray } from 'drizzle-orm';
import crypto from 'crypto';

const sseTokenStore = new Map<string, { consultantId: string; expiresAt: number }>();

setInterval(() => {
  const now = Date.now();
  for (const [token, data] of sseTokenStore.entries()) {
    if (data.expiresAt < now) {
      sseTokenStore.delete(token);
    }
  }
}, 60000);

const router = Router();

/**
 * GET /api/file-search/stores
 * Get all FileSearchStores for current user
 * 
 * Handles edge cases:
 * - Pure consultant: returns their own stores
 * - Pure client: returns their consultant's stores
 * - Mixed consultant+client (like Fernando): returns BOTH their own stores AND parent consultant's stores
 */
router.get('/stores', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const role = req.user!.role as 'consultant' | 'client';
    const consultantId = req.user!.consultantId; // May be set even if role is 'consultant' (mixed case)
    
    const stores = await fileSearchService.getStoresForUser(userId, role, consultantId);
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
 * POST /api/file-search/sync-whatsapp/:agentConfigId
 * Trigger sync of WhatsApp agent knowledge base to FileSearchStore
 */
router.post('/sync-whatsapp/:agentConfigId', authenticateToken, requireRole('consultant'), async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const { agentConfigId } = req.params;

    // Verify the agent belongs to the authenticated consultant
    const agentConfig = await db.query.consultantWhatsappConfig.findFirst({
      where: and(
        eq(consultantWhatsappConfig.id, agentConfigId),
        eq(consultantWhatsappConfig.consultantId, userId),
      ),
    });

    if (!agentConfig) {
      return res.status(404).json({ 
        success: false, 
        error: 'WhatsApp agent not found or unauthorized' 
      });
    }

    const result = await fileSearchSyncService.syncWhatsappAgentKnowledge(agentConfigId);
    res.json({
      success: true,
      agentName: agentConfig.agentName,
      ...result,
      message: `Sincronizzazione WhatsApp Agent completata. ${result.synced}/${result.total} documenti sincronizzati.`,
    });
  } catch (error: any) {
    console.error('[FileSearch API] Error syncing WhatsApp agent knowledge:', error);
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
 * GET /api/file-search/stores/:storeId/audit
 * Audit a FileSearchStore - compare local DB vs Google API
 * Returns discrepancies: documents only in DB, only on Google, or in both
 */
router.get('/stores/:storeId/audit', authenticateToken, requireRole('consultant'), async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const { storeId } = req.params;

    // Get store and verify access
    const store = await db.query.fileSearchStores.findFirst({
      where: eq(fileSearchStores.id, storeId),
    });

    if (!store) {
      return res.status(404).json({ 
        success: false, 
        error: 'Store non trovato' 
      });
    }

    // Authorization: consultant can access their own stores, WhatsApp agent stores, OR stores of their clients
    const isOwnStore = store.ownerId === userId && (store.ownerType === 'consultant' || store.ownerType === 'whatsapp_agent');
    
    // Check if store belongs to a client of this consultant
    let isClientStore = false;
    if (!isOwnStore && store.ownerType === 'client') {
      const [clientUser] = await db.select().from(users).where(eq(users.id, store.ownerId)).limit(1);
      if (clientUser && clientUser.consultantId === userId) {
        isClientStore = true;
      }
    }

    if (!isOwnStore && !isClientStore) {
      return res.status(403).json({ 
        success: false, 
        error: 'Non autorizzato ad accedere a questo store' 
      });
    }

    // Pass the requesting consultant's userId for API key resolution
    const result = await fileSearchService.auditStoreVsGoogle(storeId, userId);
    res.json({
      success: result.success,
      ...result,
      message: result.success 
        ? `Audit completato. DB: ${result.dbDocuments}, Google: ${result.googleDocuments}. Orfani DB: ${result.onlyInDb.length}, Orfani Google: ${result.onlyOnGoogle.length}`
        : result.error,
    });
  } catch (error: any) {
    console.error('[FileSearch API] Error auditing store:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/file-search/stores/:storeId/cleanup
 * Cleanup orphaned documents from Google that don't exist in local DB
 */
router.post('/stores/:storeId/cleanup', authenticateToken, requireRole('consultant'), async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const { storeId } = req.params;

    // Get store and verify access
    const store = await db.query.fileSearchStores.findFirst({
      where: eq(fileSearchStores.id, storeId),
    });

    if (!store) {
      return res.status(404).json({ 
        success: false, 
        error: 'Store non trovato' 
      });
    }

    // Authorization: consultant can access their own stores, WhatsApp agent stores, OR stores of their clients
    const isOwnStore = store.ownerId === userId && (store.ownerType === 'consultant' || store.ownerType === 'whatsapp_agent');
    
    // Check if store belongs to a client of this consultant
    let isClientStore = false;
    if (!isOwnStore && store.ownerType === 'client') {
      const [clientUser] = await db.select().from(users).where(eq(users.id, store.ownerId)).limit(1);
      if (clientUser && clientUser.consultantId === userId) {
        isClientStore = true;
      }
    }

    if (!isOwnStore && !isClientStore) {
      return res.status(403).json({ 
        success: false, 
        error: 'Non autorizzato ad accedere a questo store' 
      });
    }

    // Pass the requesting consultant's userId for API key resolution
    const result = await fileSearchService.cleanupOrphansOnGoogle(storeId, userId);
    res.json({
      success: result.success,
      removed: result.removed,
      errors: result.errors,
      message: result.success 
        ? `Pulizia completata. ${result.removed} documenti orfani rimossi da Google.`
        : `Pulizia parziale. ${result.removed} rimossi, ${result.errors.length} errori.`,
    });
  } catch (error: any) {
    console.error('[FileSearch API] Error cleaning up store:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/file-search/stores/:storeId/cleanup-db
 * Cleanup documents from DB that don't exist on Google
 */
router.post('/stores/:storeId/cleanup-db', authenticateToken, requireRole('consultant'), async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const { storeId } = req.params;

    // Get store and verify access
    const store = await db.query.fileSearchStores.findFirst({
      where: eq(fileSearchStores.id, storeId),
    });

    if (!store) {
      return res.status(404).json({ 
        success: false, 
        error: 'Store non trovato' 
      });
    }

    // Authorization: consultant can access their own stores, WhatsApp agent stores, OR stores of their clients
    const isOwnStore = store.ownerId === userId && (store.ownerType === 'consultant' || store.ownerType === 'whatsapp_agent');
    
    // Check if store belongs to a client of this consultant
    let isClientStore = false;
    if (!isOwnStore && store.ownerType === 'client') {
      const [clientUser] = await db.select().from(users).where(eq(users.id, store.ownerId)).limit(1);
      if (clientUser && clientUser.consultantId === userId) {
        isClientStore = true;
      }
    }

    if (!isOwnStore && !isClientStore) {
      return res.status(403).json({ 
        success: false, 
        error: 'Non autorizzato ad accedere a questo store' 
      });
    }

    // Get audit first - pass userId for API key resolution
    const audit = await fileSearchService.auditStoreVsGoogle(storeId, userId);
    if (!audit.success) {
      return res.status(500).json({ success: false, error: audit.error });
    }

    if (audit.onlyInDb.length === 0) {
      return res.json({
        success: true,
        removed: 0,
        message: 'Nessun documento orfano nel DB da rimuovere.',
      });
    }

    // Delete orphaned DB records (they're not on Google anyway)
    let removed = 0;
    const errors: string[] = [];

    for (const doc of audit.onlyInDb) {
      try {
        await db.delete(fileSearchDocuments).where(eq(fileSearchDocuments.id, doc.id));
        removed++;
        console.log(`🗑️ [FileSearch] Deleted orphan from DB: ${doc.id} (${doc.fileName})`);
      } catch (deleteError: any) {
        errors.push(`Failed to delete ${doc.id}: ${deleteError.message}`);
      }
    }

    // Update store document count
    await db.update(fileSearchStores)
      .set({ documentCount: Math.max(0, (store.documentCount || 0) - removed) })
      .where(eq(fileSearchStores.id, storeId));

    res.json({
      success: errors.length === 0,
      removed,
      errors,
      message: errors.length === 0 
        ? `Pulizia DB completata. ${removed} documenti orfani rimossi.`
        : `Pulizia parziale. ${removed} rimossi, ${errors.length} errori.`,
    });
  } catch (error: any) {
    console.error('[FileSearch API] Error cleaning up DB:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/file-search/stores/:storeId/source-orphans
 * Find documents in FileSearch whose source records no longer exist
 */
router.get('/stores/:storeId/source-orphans', authenticateToken, requireRole('consultant'), async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const { storeId } = req.params;

    const store = await db.query.fileSearchStores.findFirst({
      where: eq(fileSearchStores.id, storeId),
    });

    if (!store) {
      return res.status(404).json({ 
        success: false, 
        error: 'Store non trovato' 
      });
    }

    const isOwnStore = store.ownerId === userId && (store.ownerType === 'consultant' || store.ownerType === 'whatsapp_agent');
    
    let isClientStore = false;
    if (!isOwnStore && store.ownerType === 'client') {
      const [clientUser] = await db.select().from(users).where(eq(users.id, store.ownerId)).limit(1);
      if (clientUser && clientUser.consultantId === userId) {
        isClientStore = true;
      }
    }

    if (!isOwnStore && !isClientStore) {
      return res.status(403).json({ 
        success: false, 
        error: 'Non autorizzato ad accedere a questo store' 
      });
    }

    const result = await fileSearchService.findSourceOrphans(storeId);
    res.json({
      success: result.success,
      orphans: result.orphans,
      count: result.orphans.length,
      message: result.success 
        ? `Trovati ${result.orphans.length} documenti orfani dalla sorgente`
        : result.error,
    });
  } catch (error: any) {
    console.error('[FileSearch API] Error finding source orphans:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/file-search/stores/:storeId/cleanup-source-orphans
 * Clean up documents whose source records no longer exist
 */
router.post('/stores/:storeId/cleanup-source-orphans', authenticateToken, requireRole('consultant'), async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const { storeId } = req.params;

    const store = await db.query.fileSearchStores.findFirst({
      where: eq(fileSearchStores.id, storeId),
    });

    if (!store) {
      return res.status(404).json({ 
        success: false, 
        error: 'Store non trovato' 
      });
    }

    const isOwnStore = store.ownerId === userId && (store.ownerType === 'consultant' || store.ownerType === 'whatsapp_agent');
    
    let isClientStore = false;
    if (!isOwnStore && store.ownerType === 'client') {
      const [clientUser] = await db.select().from(users).where(eq(users.id, store.ownerId)).limit(1);
      if (clientUser && clientUser.consultantId === userId) {
        isClientStore = true;
      }
    }

    if (!isOwnStore && !isClientStore) {
      return res.status(403).json({ 
        success: false, 
        error: 'Non autorizzato ad accedere a questo store' 
      });
    }

    const result = await fileSearchService.cleanupSourceOrphans(storeId, userId);
    res.json({
      success: result.success,
      removed: result.removed,
      errors: result.errors,
      message: result.success 
        ? `Pulizia completata. ${result.removed} documenti orfani rimossi.`
        : `Pulizia parziale. ${result.removed} rimossi, ${result.errors.length} errori.`,
    });
  } catch (error: any) {
    console.error('[FileSearch API] Error cleaning up source orphans:', error);
    res.status(500).json({ success: false, error: error.message });
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
    
    // Verify Gemini API key is available (from database: SuperAdmin or User keys)
    const geminiClient = await fileSearchService.getClientForUser(consultantId);
    if (!geminiClient) {
      return res.status(400).json({
        success: false,
        error: 'Chiave API Gemini non configurata. Configura le chiavi in Impostazioni > API Keys (SuperAdmin o chiavi personali con supporto File Search).',
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

/**
 * GET /api/file-search/settings
 * Get File Search settings for current consultant
 */
router.get('/settings', authenticateToken, requireRole('consultant'), async (req: AuthRequest, res) => {
  try {
    const consultantId = req.user!.id;
    
    let [settings] = await db
      .select()
      .from(fileSearchSettings)
      .where(eq(fileSearchSettings.consultantId, consultantId))
      .limit(1);
    
    if (!settings) {
      [settings] = await db
        .insert(fileSearchSettings)
        .values({
          consultantId,
          enabled: true,
          autoSyncLibrary: true,
          autoSyncKnowledgeBase: true,
        })
        .returning();
    }
    
    res.json(settings);
  } catch (error: any) {
    console.error('[FileSearch API] Error fetching settings:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PATCH /api/file-search/settings
 * Update File Search settings
 */
router.patch('/settings', authenticateToken, requireRole('consultant'), async (req: AuthRequest, res) => {
  try {
    const consultantId = req.user!.id;
    const { 
      enabled, 
      autoSyncLibrary, 
      autoSyncKnowledgeBase,
      autoSyncExercises,
      autoSyncConsultations,
      autoSyncUniversity,
      autoSyncExerciseResponses,
      autoSyncFinancial,
      autoSyncClientKnowledge,
      autoSyncWhatsappAgents,
      scheduledSyncEnabled,
      scheduledSyncHour,
      autoSyncGoals,
      autoSyncTasks,
      autoSyncDailyReflections,
      autoSyncClientProgress,
      autoSyncLibraryProgress,
      autoSyncEmailJourney,
      autoSyncAssignedExercises,
      autoSyncAssignedLibrary,
      autoSyncAssignedUniversity
    } = req.body;
    
    const updateData: Partial<typeof fileSearchSettings.$inferInsert> = {
      updatedAt: new Date(),
    };
    
    if (typeof enabled === 'boolean') updateData.enabled = enabled;
    if (typeof autoSyncLibrary === 'boolean') updateData.autoSyncLibrary = autoSyncLibrary;
    if (typeof autoSyncKnowledgeBase === 'boolean') updateData.autoSyncKnowledgeBase = autoSyncKnowledgeBase;
    if (typeof autoSyncExercises === 'boolean') updateData.autoSyncExercises = autoSyncExercises;
    if (typeof autoSyncConsultations === 'boolean') updateData.autoSyncConsultations = autoSyncConsultations;
    if (typeof autoSyncUniversity === 'boolean') updateData.autoSyncUniversity = autoSyncUniversity;
    if (typeof autoSyncExerciseResponses === 'boolean') updateData.autoSyncExerciseResponses = autoSyncExerciseResponses;
    if (typeof autoSyncFinancial === 'boolean') updateData.autoSyncFinancial = autoSyncFinancial;
    if (typeof autoSyncClientKnowledge === 'boolean') updateData.autoSyncClientKnowledge = autoSyncClientKnowledge;
    if (typeof autoSyncWhatsappAgents === 'boolean') updateData.autoSyncWhatsappAgents = autoSyncWhatsappAgents;
    if (typeof scheduledSyncEnabled === 'boolean') updateData.scheduledSyncEnabled = scheduledSyncEnabled;
    if (typeof scheduledSyncHour === 'number' && scheduledSyncHour >= 0 && scheduledSyncHour <= 23) {
      updateData.scheduledSyncHour = scheduledSyncHour;
    }
    if (typeof autoSyncGoals === 'boolean') updateData.autoSyncGoals = autoSyncGoals;
    if (typeof autoSyncTasks === 'boolean') updateData.autoSyncTasks = autoSyncTasks;
    if (typeof autoSyncDailyReflections === 'boolean') updateData.autoSyncDailyReflections = autoSyncDailyReflections;
    if (typeof autoSyncClientProgress === 'boolean') updateData.autoSyncClientProgress = autoSyncClientProgress;
    if (typeof autoSyncLibraryProgress === 'boolean') updateData.autoSyncLibraryProgress = autoSyncLibraryProgress;
    if (typeof autoSyncEmailJourney === 'boolean') updateData.autoSyncEmailJourney = autoSyncEmailJourney;
    if (typeof autoSyncAssignedExercises === 'boolean') updateData.autoSyncAssignedExercises = autoSyncAssignedExercises;
    if (typeof autoSyncAssignedLibrary === 'boolean') updateData.autoSyncAssignedLibrary = autoSyncAssignedLibrary;
    if (typeof autoSyncAssignedUniversity === 'boolean') updateData.autoSyncAssignedUniversity = autoSyncAssignedUniversity;
    
    const [updated] = await db
      .update(fileSearchSettings)
      .set(updateData)
      .where(eq(fileSearchSettings.consultantId, consultantId))
      .returning();
    
    if (!updated) {
      const [created] = await db
        .insert(fileSearchSettings)
        .values({
          consultantId,
          ...updateData,
        })
        .returning();
      return res.json(created);
    }
    
    res.json(updated);
  } catch (error: any) {
    console.error('[FileSearch API] Error updating settings:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/file-search/clients
 * Get all clients for current consultant with their File Search enabled status
 */
router.get('/clients', authenticateToken, requireRole('consultant'), async (req: AuthRequest, res) => {
  try {
    const consultantId = req.user!.id;
    
    const clients = await db
      .select({
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
        fileSearchEnabled: users.fileSearchEnabled,
        isActive: users.isActive,
      })
      .from(users)
      .where(and(
        eq(users.consultantId, consultantId),
        eq(users.role, 'client')
      ));
    
    res.json(clients);
  } catch (error: any) {
    console.error('[FileSearch API] Error fetching clients:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PATCH /api/file-search/clients/:clientId
 * Update File Search enabled status for a specific client
 */
router.patch('/clients/:clientId', authenticateToken, requireRole('consultant'), async (req: AuthRequest, res) => {
  try {
    const consultantId = req.user!.id;
    const { clientId } = req.params;
    const { fileSearchEnabled } = req.body;
    
    if (typeof fileSearchEnabled !== 'boolean') {
      return res.status(400).json({ error: 'fileSearchEnabled must be a boolean' });
    }
    
    // Verify client belongs to consultant
    const [client] = await db
      .select()
      .from(users)
      .where(and(
        eq(users.id, clientId),
        eq(users.consultantId, consultantId),
        eq(users.role, 'client')
      ))
      .limit(1);
    
    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }
    
    // Update the client's File Search status
    const [updated] = await db
      .update(users)
      .set({ fileSearchEnabled })
      .where(eq(users.id, clientId))
      .returning({
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
        fileSearchEnabled: users.fileSearchEnabled,
      });
    
    console.log(`[FileSearch] Client ${clientId} File Search ${fileSearchEnabled ? 'ENABLED' : 'DISABLED'} by consultant ${consultantId}`);
    
    res.json(updated);
  } catch (error: any) {
    console.error('[FileSearch API] Error updating client File Search status:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/file-search/analytics
 * Get File Search usage analytics for consultant
 */
router.get('/analytics', authenticateToken, requireRole('consultant'), async (req: AuthRequest, res) => {
  try {
    const consultantId = req.user!.id;
    const days = parseInt(req.query.days as string) || 30;
    
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    const usageLogs = await db
      .select()
      .from(fileSearchUsageLogs)
      .where(and(
        eq(fileSearchUsageLogs.consultantId, consultantId),
        gte(fileSearchUsageLogs.createdAt, startDate)
      ))
      .orderBy(desc(fileSearchUsageLogs.createdAt))
      .limit(500);
    
    // Get ALL clients for this consultant FIRST (needed for store queries)
    const allClients = await db
      .select({ 
        id: users.id, 
        firstName: users.firstName, 
        lastName: users.lastName, 
        email: users.email 
      })
      .from(users)
      .where(and(
        eq(users.consultantId, consultantId),
        eq(users.role, 'client')
      ));
    
    const clientIds = allClients.map(c => c.id);
    const allOwnerIds = [consultantId, ...clientIds];
    
    // Get ALL stores: consultant store + client private stores
    const stores = await db
      .select()
      .from(fileSearchStores)
      .where(inArray(fileSearchStores.ownerId, allOwnerIds));
    
    console.log(`📊 [FileSearch Analytics] Found ${stores.length} stores for consultant ${consultantId}`);
    console.log(`📊 [FileSearch Analytics] Owner IDs searched: [${allOwnerIds.slice(0, 5).join(', ')}...]`);
    
    // Get store IDs for counting documents
    const storeIds = stores.map(s => s.id);
    const totalDocuments = storeIds.length > 0 
      ? await db
          .select({ count: sql<number>`count(*)` })
          .from(fileSearchDocuments)
          .where(inArray(fileSearchDocuments.storeId, storeIds))
      : [{ count: 0 }];
    
    // Fetch all synced documents with store info (consultant + clients)
    const documents = await db
      .select({
        id: fileSearchDocuments.id,
        googleFileId: fileSearchDocuments.googleFileId,
        fileName: fileSearchDocuments.fileName,
        displayName: fileSearchDocuments.displayName,
        mimeType: fileSearchDocuments.mimeType,
        status: fileSearchDocuments.status,
        sourceType: fileSearchDocuments.sourceType,
        sourceId: fileSearchDocuments.sourceId,
        uploadedAt: fileSearchDocuments.uploadedAt,
        storeDisplayName: fileSearchStores.displayName,
        storeId: fileSearchDocuments.storeId,
        storeOwnerId: fileSearchStores.ownerId,
        clientId: fileSearchDocuments.clientId,
      })
      .from(fileSearchDocuments)
      .innerJoin(fileSearchStores, eq(fileSearchDocuments.storeId, fileSearchStores.id))
      .where(inArray(fileSearchStores.ownerId, allOwnerIds))
      .orderBy(desc(fileSearchDocuments.uploadedAt))
      .limit(5000);
    
    console.log(`📊 [FileSearch Analytics] Total documents fetched: ${documents.length}`);
    
    // Build hierarchical data structure
    // Consultant docs = docs in consultant's store (storeOwnerId = consultantId)
    const consultantDocs = documents.filter(d => d.storeOwnerId === consultantId);
    // Client docs = docs in client stores (storeOwnerId = clientId)
    const clientDocs = documents.filter(d => d.storeOwnerId !== consultantId);
    
    console.log(`📊 [FileSearch Analytics] Consultant docs: ${consultantDocs.length}, Client docs: ${clientDocs.length}`);
    
    // Build client info map
    const clientInfoMap: Record<string, { name: string; email: string }> = {};
    allClients.forEach(u => {
      clientInfoMap[u.id] = { name: `${u.firstName} ${u.lastName}`, email: u.email };
    });
    
    // Build consultant store data - find the consultant's own store
    const consultantStoreRecord = stores.find(s => s.ownerId === consultantId);
    const consultantStore = {
      storeId: consultantStoreRecord?.id || '',
      storeName: consultantStoreRecord?.displayName || 'Store Globale Consulente',
      documents: {
        consultantGuide: consultantDocs.filter(d => d.sourceType === 'consultant_guide'),
        library: consultantDocs.filter(d => d.sourceType === 'library'),
        knowledgeBase: consultantDocs.filter(d => d.sourceType === 'knowledge_base'),
        exercises: consultantDocs.filter(d => d.sourceType === 'exercise'),
        university: consultantDocs.filter(d => d.sourceType === 'university' || d.sourceType === 'university_lesson'),
        other: consultantDocs.filter(d => !['consultant_guide', 'library', 'knowledge_base', 'exercise', 'university', 'university_lesson'].includes(d.sourceType)),
      },
      totals: {
        consultantGuide: consultantDocs.filter(d => d.sourceType === 'consultant_guide').length,
        library: consultantDocs.filter(d => d.sourceType === 'library').length,
        knowledgeBase: consultantDocs.filter(d => d.sourceType === 'knowledge_base').length,
        exercises: consultantDocs.filter(d => d.sourceType === 'exercise').length,
        university: consultantDocs.filter(d => d.sourceType === 'university' || d.sourceType === 'university_lesson').length,
      },
    };
    
    // Build client stores data - include ALL clients, even those without documents
    // Client docs are in stores where storeOwnerId = client.id (private stores)
    const clientStoresData = allClients.map(client => {
      const clientDocuments = clientDocs.filter(d => d.storeOwnerId === client.id);
      const clientStore = stores.find(s => s.ownerId === client.id);
      
      return {
        clientId: client.id,
        clientName: `${client.firstName} ${client.lastName}`,
        clientEmail: client.email,
        storeId: clientStore?.id || null,
        storeName: clientStore?.displayName || null,
        hasStore: !!clientStore,
        hasDocuments: clientDocuments.length > 0,
        documents: {
          exerciseResponses: clientDocuments.filter(d => d.sourceType === 'exercise'),
          consultationNotes: clientDocuments.filter(d => d.sourceType === 'consultation'),
          knowledgeBase: clientDocuments.filter(d => d.sourceType === 'knowledge_base'),
          goals: clientDocuments.filter(d => d.sourceType === 'goal'),
          tasks: clientDocuments.filter(d => d.sourceType === 'task'),
          dailyReflections: clientDocuments.filter(d => d.sourceType === 'daily_reflection'),
          clientProgressHistory: clientDocuments.filter(d => d.sourceType === 'client_progress'),
          libraryProgress: clientDocuments.filter(d => d.sourceType === 'library_progress'),
          emailJourneyProgress: clientDocuments.filter(d => d.sourceType === 'email_journey'),
          assignedExercises: clientDocuments.filter(d => d.sourceType === 'exercise' && d.sourceId !== client.id),
          assignedLibrary: clientDocuments.filter(d => d.sourceType === 'library'),
          assignedUniversity: clientDocuments.filter(d => d.sourceType === 'university_lesson'),
          externalDocs: clientDocuments.filter(d => d.sourceType === 'exercise_external_doc'),
        },
        totals: {
          exerciseResponses: clientDocuments.filter(d => d.sourceType === 'exercise').length,
          consultationNotes: clientDocuments.filter(d => d.sourceType === 'consultation').length,
          knowledgeBase: clientDocuments.filter(d => d.sourceType === 'knowledge_base').length,
          goals: clientDocuments.filter(d => d.sourceType === 'goal').length,
          tasks: clientDocuments.filter(d => d.sourceType === 'task').length,
          dailyReflections: clientDocuments.filter(d => d.sourceType === 'daily_reflection').length,
          clientProgressHistory: clientDocuments.filter(d => d.sourceType === 'client_progress').length,
          libraryProgress: clientDocuments.filter(d => d.sourceType === 'library_progress').length,
          emailJourneyProgress: clientDocuments.filter(d => d.sourceType === 'email_journey').length,
          assignedExercises: clientDocuments.filter(d => d.sourceType === 'exercise' && d.sourceId !== client.id).length,
          assignedLibrary: clientDocuments.filter(d => d.sourceType === 'library').length,
          assignedUniversity: clientDocuments.filter(d => d.sourceType === 'university_lesson').length,
          externalDocs: clientDocuments.filter(d => d.sourceType === 'exercise_external_doc').length,
          total: clientDocuments.length,
        },
        potentialContent: {
          exerciseResponses: true,
          consultationNotes: true,
          knowledgeBase: true,
        },
      };
    });
    
    const totalFileSearchCalls = usageLogs.filter(l => l.usedFileSearch).length;
    const totalClassicRagCalls = usageLogs.filter(l => !l.usedFileSearch).length;
    const totalTokensSaved = usageLogs.reduce((acc, l) => acc + (l.tokensSaved || 0), 0);
    const totalCitations = usageLogs.reduce((acc, l) => acc + (l.citationsCount || 0), 0);
    const avgResponseTime = usageLogs.length > 0 
      ? Math.round(usageLogs.reduce((acc, l) => acc + (l.responseTimeMs || 0), 0) / usageLogs.length) 
      : 0;
    
    const dailyStats = usageLogs.reduce((acc, log) => {
      const date = log.createdAt ? new Date(log.createdAt).toISOString().split('T')[0] : 'unknown';
      if (!acc[date]) {
        acc[date] = { 
          date, 
          fileSearchCalls: 0, 
          classicRagCalls: 0, 
          tokensSaved: 0, 
          citations: 0 
        };
      }
      if (log.usedFileSearch) {
        acc[date].fileSearchCalls++;
      } else {
        acc[date].classicRagCalls++;
      }
      acc[date].tokensSaved += log.tokensSaved || 0;
      acc[date].citations += log.citationsCount || 0;
      return acc;
    }, {} as Record<string, { date: string; fileSearchCalls: number; classicRagCalls: number; tokensSaved: number; citations: number }>);
    
    const providerStats = usageLogs.reduce((acc, log) => {
      const provider = log.providerUsed || 'unknown';
      acc[provider] = (acc[provider] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    res.json({
      summary: {
        totalCalls: usageLogs.length,
        fileSearchCalls: totalFileSearchCalls,
        classicRagCalls: totalClassicRagCalls,
        fileSearchPercentage: usageLogs.length > 0 
          ? Math.round((totalFileSearchCalls / usageLogs.length) * 100) 
          : 0,
        totalTokensSaved,
        totalCitations,
        avgResponseTimeMs: avgResponseTime,
        totalStores: stores.length,
        totalDocuments: totalDocuments[0]?.count || 0,
      },
      dailyStats: Object.values(dailyStats).sort((a, b) => a.date.localeCompare(b.date)),
      providerStats,
      stores: stores.map(s => ({
        id: s.id,
        displayName: s.displayName,
        documentCount: s.documentCount,
        isActive: s.isActive,
        createdAt: s.createdAt,
      })),
      recentLogs: usageLogs.slice(0, 50).map(l => ({
        id: l.id,
        requestType: l.requestType,
        usedFileSearch: l.usedFileSearch,
        providerUsed: l.providerUsed,
        storeCount: l.storeCount,
        citationsCount: l.citationsCount,
        tokensSaved: l.tokensSaved,
        responseTimeMs: l.responseTimeMs,
        createdAt: l.createdAt,
      })),
      documents: documents.map(d => ({
        id: d.id,
        googleFileId: d.googleFileId,
        fileName: d.fileName,
        displayName: d.displayName,
        mimeType: d.mimeType,
        status: d.status,
        sourceType: d.sourceType,
        sourceId: d.sourceId,
        uploadedAt: d.uploadedAt,
        storeDisplayName: d.storeDisplayName,
        clientId: d.clientId,
      })),
      hierarchicalData: {
        consultantStore,
        clientStores: clientStoresData,
      },
      geminiApiKeyConfigured: await fileSearchService.isApiKeyConfigured(consultantId),
    });
  } catch (error: any) {
    console.error('[FileSearch API] Error fetching analytics:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/file-search/audit
 * Run Comprehensive Post-Import Audit to check indexing status of ALL content
 * Returns full object details for each missing item (id, title, etc.)
 */
router.get('/audit', authenticateToken, requireRole('consultant'), async (req: AuthRequest, res) => {
  try {
    const consultantId = req.user!.id;
    const audit = await fileSearchSyncService.runComprehensiveAudit(consultantId);
    res.json(audit);
  } catch (error: any) {
    console.error('[FileSearch API] Error running audit:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/file-search/sync-single
 * Sync a single item to FileSearchStore
 */
router.post('/sync-single', authenticateToken, requireRole('consultant'), async (req: AuthRequest, res) => {
  try {
    const consultantId = req.user!.id;
    const { type, id, clientId } = req.body;

    if (!type || !id) {
      return res.status(400).json({ error: 'type and id are required' });
    }

    let result: { success: boolean; error?: string };

    switch (type) {
      case 'library':
        result = await fileSearchSyncService.syncLibraryDocument(consultantId, id);
        break;
      case 'knowledge_base':
        result = await fileSearchSyncService.syncKnowledgeDocument(consultantId, id);
        break;
      case 'exercise':
        result = await fileSearchSyncService.syncExercise(consultantId, id);
        break;
      case 'university_lesson':
        result = await fileSearchSyncService.syncUniversityLesson(consultantId, id);
        break;
      case 'exercise_response':
        if (!clientId) {
          return res.status(400).json({ error: 'clientId is required for exercise_response' });
        }
        result = await fileSearchSyncService.syncClientExerciseResponse(id, clientId, consultantId);
        break;
      case 'consultation':
        if (!clientId) {
          return res.status(400).json({ error: 'clientId is required for consultation' });
        }
        result = await fileSearchSyncService.syncClientConsultationNotes(id, clientId, consultantId);
        break;
      case 'client_knowledge':
        if (!clientId) {
          return res.status(400).json({ error: 'clientId is required for client_knowledge' });
        }
        result = await fileSearchSyncService.syncClientKnowledgeDocument(id, clientId, consultantId);
        break;
      case 'whatsapp_agent':
        result = await fileSearchSyncService.syncWhatsappAgentKnowledge(id);
        break;
      case 'whatsapp_knowledge':
        const { agentId } = req.body;
        if (!agentId) {
          return res.status(400).json({ error: 'agentId is required for whatsapp_knowledge' });
        }
        result = await fileSearchSyncService.syncSingleWhatsappKnowledgeItem(id, agentId);
        break;
      case 'consultant_guide':
        result = await fileSearchSyncService.syncConsultantGuide(consultantId);
        break;
      default:
        return res.status(400).json({ error: `Unknown type: ${type}` });
    }

    if (result.success) {
      res.json({ success: true, message: `Elemento sincronizzato con successo` });
    } else {
      res.status(500).json({ success: false, error: result.error });
    }
  } catch (error: any) {
    console.error('[FileSearch API] Error syncing single item:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/file-search/sync-missing
 * Sync only the missing (non-indexed) documents
 */
router.post('/sync-missing', authenticateToken, requireRole('consultant'), async (req: AuthRequest, res) => {
  try {
    const consultantId = req.user!.id;
    
    const audit = await fileSearchSyncService.runPostImportAudit(consultantId);
    
    let syncedLibrary = 0;
    let syncedKnowledge = 0;
    let syncedExercises = 0;
    
    if (audit.summary.library.missing.length > 0) {
      const libraryResult = await fileSearchSyncService.syncAllLibraryDocuments(consultantId);
      syncedLibrary = libraryResult.synced;
    }
    
    if (audit.summary.knowledgeBase.missing.length > 0) {
      const knowledgeResult = await fileSearchSyncService.syncAllConsultantKnowledgeDocuments(consultantId);
      syncedKnowledge = knowledgeResult.synced;
    }
    
    if (audit.summary.exercises.missing.length > 0) {
      const exercisesResult = await fileSearchSyncService.syncAllExercises(consultantId);
      syncedExercises = exercisesResult.synced;
    }
    
    const totalSynced = syncedLibrary + syncedKnowledge + syncedExercises;
    
    res.json({
      success: true,
      synced: {
        library: syncedLibrary,
        knowledgeBase: syncedKnowledge,
        exercises: syncedExercises,
        total: totalSynced,
      },
      message: `Sincronizzati ${totalSynced} documenti mancanti (Library: ${syncedLibrary}, KB: ${syncedKnowledge}, Exercises: ${syncedExercises})`,
    });
  } catch (error: any) {
    console.error('[FileSearch API] Error syncing missing:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/file-search/sync-financial/:clientId
 * Sync financial data for a specific client
 */
router.post('/sync-financial/:clientId', authenticateToken, requireRole('consultant'), async (req: AuthRequest, res) => {
  try {
    const consultantId = req.user!.id;
    const { clientId } = req.params;
    
    if (!clientId) {
      return res.status(400).json({ error: 'clientId is required' });
    }
    
    const result = await fileSearchSyncService.syncClientFinancialData(clientId, consultantId);
    
    if (result.success) {
      res.json({ success: true, message: `Dati finanziari sincronizzati per il cliente` });
    } else {
      res.status(500).json({ success: false, error: result.error });
    }
  } catch (error: any) {
    console.error('[FileSearch API] Error syncing client financial data:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/file-search/resync-financial/:clientId
 * Force re-sync financial data for a specific client (delete and recreate)
 */
router.post('/resync-financial/:clientId', authenticateToken, requireRole('consultant'), async (req: AuthRequest, res) => {
  try {
    const consultantId = req.user!.id;
    const { clientId } = req.params;
    
    if (!clientId) {
      return res.status(400).json({ error: 'clientId is required' });
    }
    
    const result = await fileSearchSyncService.resyncClientFinancialData(clientId, consultantId);
    
    if (result.success) {
      res.json({ success: true, message: `Dati finanziari ri-sincronizzati per il cliente` });
    } else {
      res.status(500).json({ success: false, error: result.error });
    }
  } catch (error: any) {
    console.error('[FileSearch API] Error resyncing client financial data:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/file-search/financial-status/:clientId
 * Check if financial data is indexed for a specific client
 */
router.get('/financial-status/:clientId', authenticateToken, requireRole('consultant'), async (req: AuthRequest, res) => {
  try {
    const { clientId } = req.params;
    
    if (!clientId) {
      return res.status(400).json({ error: 'clientId is required' });
    }
    
    const isIndexed = await fileSearchSyncService.isClientFinancialDataIndexed(clientId);
    
    res.json({ clientId, isIndexed });
  } catch (error: any) {
    console.error('[FileSearch API] Error checking financial status:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/file-search/log-usage
 * Log File Search usage (internal use)
 */
router.post('/log-usage', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const {
      consultantId,
      clientId,
      requestType,
      storeNames,
      storeCount,
      documentCount,
      citationsCount,
      usedFileSearch,
      providerUsed,
      apiKeySource,
      tokensSaved,
      responseTimeMs,
      errorMessage,
    } = req.body;
    
    const [log] = await db
      .insert(fileSearchUsageLogs)
      .values({
        consultantId,
        clientId,
        requestType,
        storeNames: storeNames || [],
        storeCount: storeCount || 0,
        documentCount: documentCount || 0,
        citationsCount: citationsCount || 0,
        usedFileSearch: usedFileSearch || false,
        providerUsed: providerUsed || 'fallback',
        apiKeySource,
        tokensSaved: tokensSaved || 0,
        responseTimeMs,
        errorMessage,
      })
      .returning();
    
    if (usedFileSearch) {
      await db
        .update(fileSearchSettings)
        .set({
          totalUsageCount: sql`${fileSearchSettings.totalUsageCount} + 1`,
          updatedAt: new Date(),
        })
        .where(eq(fileSearchSettings.consultantId, consultantId));
    }
    
    res.json({ success: true, logId: log.id });
  } catch (error: any) {
    console.error('[FileSearch API] Error logging usage:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * ═══════════════════════════════════════════════════════════════════
 * CLIENT FILE SEARCH ROUTES
 * Allow clients to view File Search status and analytics
 * They access their consultant's stores automatically
 * ═══════════════════════════════════════════════════════════════════
 */

/**
 * GET /api/file-search/client/status
 * Get File Search status for current client (shows if their consultant has File Search enabled)
 */
router.get('/client/status', authenticateToken, requireRole('client'), async (req: AuthRequest, res) => {
  try {
    const clientId = req.user!.id;
    const consultantId = req.user!.consultantId;
    
    if (!consultantId) {
      return res.json({
        enabled: false,
        message: 'Nessun consulente associato',
        stores: [],
        storeNames: [],
      });
    }
    
    // Get consultant's File Search stores that this client can access
    const storeNames = await fileSearchService.getStoreNamesForGeneration(
      clientId,
      'client',
      consultantId
    );
    
    // Get settings from consultant
    const [settings] = await db
      .select()
      .from(fileSearchSettings)
      .where(eq(fileSearchSettings.consultantId, consultantId))
      .limit(1);
    
    // Get store details
    const stores = await fileSearchService.getStoresForUser(consultantId, 'consultant');
    
    res.json({
      enabled: (settings?.enabled ?? false) && storeNames.length > 0,
      message: storeNames.length > 0 
        ? 'File Search attivo - le tue richieste useranno la ricerca semantica'
        : 'File Search non configurato dal consulente',
      storeCount: storeNames.length,
      storeNames: storeNames,
      stores: stores.map(s => ({
        displayName: s.displayName,
        documentCount: s.documentCount,
      })),
      totalDocuments: stores.reduce((sum, s) => sum + (s.documentCount || 0), 0),
    });
  } catch (error: any) {
    console.error('[FileSearch API] Error fetching client status:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/file-search/client/analytics
 * Get File Search usage analytics for client (their own usage)
 */
router.get('/client/analytics', authenticateToken, requireRole('client'), async (req: AuthRequest, res) => {
  try {
    const clientId = req.user!.id;
    const consultantId = req.user!.consultantId;
    const days = parseInt(req.query.days as string) || 30;
    
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    // Get client's own usage logs
    const usageLogs = await db
      .select()
      .from(fileSearchUsageLogs)
      .where(and(
        eq(fileSearchUsageLogs.clientId, clientId),
        gte(fileSearchUsageLogs.createdAt, startDate)
      ))
      .orderBy(desc(fileSearchUsageLogs.createdAt))
      .limit(100);
    
    // Get consultant's stores that client can access
    let stores: any[] = [];
    let totalDocuments = 0;
    
    if (consultantId) {
      stores = await db
        .select()
        .from(fileSearchStores)
        .where(eq(fileSearchStores.ownerId, consultantId));
      
      const docCount = await db
        .select({ count: sql<number>`count(*)` })
        .from(fileSearchDocuments)
        .where(
          sql`${fileSearchDocuments.storeId} IN (
            SELECT id FROM file_search_stores WHERE owner_id = ${consultantId}
          )`
        );
      totalDocuments = docCount[0]?.count || 0;
    }
    
    const totalFileSearchCalls = usageLogs.filter(l => l.usedFileSearch).length;
    const totalClassicRagCalls = usageLogs.filter(l => !l.usedFileSearch).length;
    const totalTokensSaved = usageLogs.reduce((acc, l) => acc + (l.tokensSaved || 0), 0);
    
    res.json({
      summary: {
        totalCalls: usageLogs.length,
        fileSearchCalls: totalFileSearchCalls,
        classicRagCalls: totalClassicRagCalls,
        fileSearchPercentage: usageLogs.length > 0 
          ? Math.round((totalFileSearchCalls / usageLogs.length) * 100) 
          : 0,
        totalTokensSaved,
        totalStores: stores.length,
        totalDocuments,
      },
      stores: stores.map(s => ({
        displayName: s.displayName,
        documentCount: s.documentCount,
        isActive: s.isActive,
      })),
      recentLogs: usageLogs.slice(0, 20).map(l => ({
        usedFileSearch: l.usedFileSearch,
        tokensSaved: l.tokensSaved,
        responseTimeMs: l.responseTimeMs,
        createdAt: l.createdAt,
      })),
      fileSearchEnabled: stores.length > 0,
    });
  } catch (error: any) {
    console.error('[FileSearch API] Error fetching client analytics:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/file-search/client/documents
 * Get ALL File Search documents accessible to the client (consultant's shared store + client's private store)
 * This shows the client what documents the AI has access to when answering questions
 */
router.get('/client/documents', authenticateToken, requireRole('client'), async (req: AuthRequest, res) => {
  try {
    const clientId = req.user!.id;
    const consultantId = req.user!.consultantId;
    
    if (!consultantId) {
      return res.json({
        success: true,
        documents: [],
        summary: {
          total: 0,
          bySourceType: {},
          consultantDocs: 0,
          clientDocs: 0,
        },
        message: 'Nessun consulente associato',
      });
    }
    
    const ownerIds = [consultantId, clientId];
    
    const stores = await db
      .select()
      .from(fileSearchStores)
      .where(inArray(fileSearchStores.ownerId, ownerIds));
    
    if (stores.length === 0) {
      return res.json({
        success: true,
        documents: [],
        summary: {
          total: 0,
          bySourceType: {},
          consultantDocs: 0,
          clientDocs: 0,
        },
        message: 'Nessuno store File Search configurato',
      });
    }
    
    const storeIds = stores.map(s => s.id);
    
    const documents = await db
      .select({
        id: fileSearchDocuments.id,
        fileName: fileSearchDocuments.fileName,
        displayName: fileSearchDocuments.displayName,
        mimeType: fileSearchDocuments.mimeType,
        status: fileSearchDocuments.status,
        sourceType: fileSearchDocuments.sourceType,
        sourceId: fileSearchDocuments.sourceId,
        uploadedAt: fileSearchDocuments.uploadedAt,
        indexedAt: fileSearchDocuments.indexedAt,
        contentSize: fileSearchDocuments.contentSize,
        storeId: fileSearchDocuments.storeId,
        storeDisplayName: fileSearchStores.displayName,
        storeOwnerId: fileSearchStores.ownerId,
        storeOwnerType: fileSearchStores.ownerType,
      })
      .from(fileSearchDocuments)
      .innerJoin(fileSearchStores, eq(fileSearchDocuments.storeId, fileSearchStores.id))
      .where(inArray(fileSearchDocuments.storeId, storeIds))
      .orderBy(desc(fileSearchDocuments.uploadedAt));
    
    const consultantDocs = documents.filter(d => d.storeOwnerId === consultantId);
    const clientDocs = documents.filter(d => d.storeOwnerId === clientId);
    
    const bySourceType: Record<string, number> = {};
    documents.forEach(d => {
      const type = d.sourceType || 'other';
      bySourceType[type] = (bySourceType[type] || 0) + 1;
    });
    
    const formattedDocs = documents.map(d => ({
      id: d.id,
      name: d.displayName || d.fileName,
      fileName: d.fileName,
      mimeType: d.mimeType,
      status: d.status,
      sourceType: d.sourceType,
      sourceId: d.sourceId,
      syncedAt: d.indexedAt || d.uploadedAt,
      contentSize: d.contentSize,
      isFromConsultant: d.storeOwnerId === consultantId,
      storeDisplayName: d.storeDisplayName,
    }));
    
    res.json({
      success: true,
      documents: formattedDocs,
      summary: {
        total: documents.length,
        bySourceType,
        consultantDocs: consultantDocs.length,
        clientDocs: clientDocs.length,
      },
      stores: stores.map(s => ({
        id: s.id,
        displayName: s.displayName,
        ownerType: s.ownerType,
        documentCount: s.documentCount,
      })),
    });
  } catch (error: any) {
    console.error('[FileSearch API] Error fetching client documents:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/file-search/sync-token
 * Generate a short-lived token for SSE connection
 * This is more secure than passing JWT in query params
 */
router.post('/sync-token', authenticateToken, requireRole('consultant'), async (req: AuthRequest, res) => {
  const consultantId = req.user!.id;
  
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = Date.now() + 5 * 60 * 1000;
  
  sseTokenStore.set(token, { consultantId, expiresAt });
  
  res.json({ token, expiresIn: 300 });
});

/**
 * GET /api/file-search/sync-events
 * SSE endpoint for real-time sync progress updates
 * 
 * Authentication: Uses short-lived token from /sync-token endpoint
 * Token is kept valid for TTL to allow EventSource automatic reconnects
 * Token is invalidated when connection closes normally
 * 
 * Event format:
 * data: {"type":"progress","item":"Document Name","current":5,"total":20,"category":"library"}
 * 
 * Event types: 'start', 'progress', 'error', 'complete', 'all_complete'
 */
router.get('/sync-events', async (req: Request, res: Response) => {
  const token = req.query.token as string;
  
  if (!token) {
    return res.status(401).json({ error: 'SSE token required' });
  }
  
  const tokenData = sseTokenStore.get(token);
  if (!tokenData || tokenData.expiresAt < Date.now()) {
    sseTokenStore.delete(token);
    return res.status(401).json({ error: 'Invalid or expired SSE token' });
  }
  
  const consultantId = tokenData.consultantId;
  
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  res.write(`data: ${JSON.stringify({ type: 'connected', consultantId })}\n\n`);

  const heartbeatInterval = setInterval(() => {
    res.write(`:heartbeat\n\n`);
  }, 30000);

  const { syncProgressEmitter } = await import('../services/file-search-sync-service');

  const eventHandler = (event: any) => {
    const { consultantId: _, ...eventData } = event;
    res.write(`data: ${JSON.stringify(eventData)}\n\n`);
    
    if (event.type === 'all_complete') {
      sseTokenStore.delete(token);
    }
  };

  syncProgressEmitter.on(`sync:${consultantId}`, eventHandler);

  req.on('close', () => {
    clearInterval(heartbeatInterval);
    syncProgressEmitter.off(`sync:${consultantId}`, eventHandler);
    sseTokenStore.delete(token);
    res.end();
  });
});

/**
 * POST /api/file-search/reset-stores
 * Reset (delete all documents from) File Search stores for privacy migration
 * 
 * Options:
 * - type: 'consultant' - Reset only consultant's shared store
 * - type: 'clients' - Reset all client private stores for this consultant
 * - type: 'all' - Reset both consultant and all client stores
 * 
 * This is used after fixing the privacy isolation bug to clear old data
 * before re-syncing with the corrected logic.
 */
router.post('/reset-stores', authenticateToken, requireRole('consultant'), async (req: AuthRequest, res) => {
  try {
    const consultantId = req.user!.id;
    const { type = 'all' } = req.body;
    
    console.log(`\n${'═'.repeat(60)}`);
    console.log(`🗑️ [FileSearch Reset] Starting store reset for consultant ${consultantId}`);
    console.log(`   Type: ${type}`);
    console.log(`${'═'.repeat(60)}\n`);
    
    let consultantDocsDeleted = 0;
    let clientDocsDeleted = 0;
    let clientStoresReset = 0;
    
    // Get consultant's store
    if (type === 'consultant' || type === 'all') {
      const consultantStore = await db.query.fileSearchStores.findFirst({
        where: and(
          eq(fileSearchStores.ownerId, consultantId),
          eq(fileSearchStores.ownerType, 'consultant'),
        ),
      });
      
      if (consultantStore) {
        // Get all documents in the consultant store
        const consultantDocs = await db.query.fileSearchDocuments.findMany({
          where: eq(fileSearchDocuments.storeId, consultantStore.id),
        });
        
        console.log(`📦 [Reset] Found ${consultantDocs.length} documents in consultant store`);
        
        // Delete each document from Google and database
        for (const doc of consultantDocs) {
          try {
            await fileSearchService.deleteDocument(doc.id, consultantId);
            consultantDocsDeleted++;
          } catch (err: any) {
            console.warn(`⚠️ [Reset] Failed to delete doc ${doc.id}: ${err.message}`);
          }
        }
        
        // Update store document count
        await db.update(fileSearchStores)
          .set({ documentCount: 0, updatedAt: new Date() })
          .where(eq(fileSearchStores.id, consultantStore.id));
          
        console.log(`✅ [Reset] Consultant store reset: ${consultantDocsDeleted} documents deleted`);
      }
    }
    
    // Get all client stores for this consultant
    if (type === 'clients' || type === 'all') {
      // Get all clients of this consultant
      const clients = await db.select({ id: users.id })
        .from(users)
        .where(and(eq(users.consultantId, consultantId), eq(users.role, 'client')));
      
      const clientIds = clients.map(c => c.id);
      
      if (clientIds.length > 0) {
        // Get all client stores
        const clientStores = await db.query.fileSearchStores.findMany({
          where: and(
            inArray(fileSearchStores.ownerId, clientIds),
            eq(fileSearchStores.ownerType, 'client'),
          ),
        });
        
        console.log(`📦 [Reset] Found ${clientStores.length} client stores to reset`);
        
        for (const store of clientStores) {
          // Get all documents in this client store
          const clientDocs = await db.query.fileSearchDocuments.findMany({
            where: eq(fileSearchDocuments.storeId, store.id),
          });
          
          // Delete each document
          for (const doc of clientDocs) {
            try {
              await fileSearchService.deleteDocument(doc.id, consultantId);
              clientDocsDeleted++;
            } catch (err: any) {
              console.warn(`⚠️ [Reset] Failed to delete client doc ${doc.id}: ${err.message}`);
            }
          }
          
          // Update store document count
          await db.update(fileSearchStores)
            .set({ documentCount: 0, updatedAt: new Date() })
            .where(eq(fileSearchStores.id, store.id));
            
          clientStoresReset++;
        }
        
        console.log(`✅ [Reset] Client stores reset: ${clientStoresReset} stores, ${clientDocsDeleted} documents deleted`);
      }
    }
    
    console.log(`\n${'═'.repeat(60)}`);
    console.log(`✅ [FileSearch Reset] Complete!`);
    console.log(`   Consultant docs deleted: ${consultantDocsDeleted}`);
    console.log(`   Client docs deleted: ${clientDocsDeleted}`);
    console.log(`   Client stores reset: ${clientStoresReset}`);
    console.log(`${'═'.repeat(60)}\n`);
    
    res.json({
      success: true,
      message: `Reset completato: ${consultantDocsDeleted + clientDocsDeleted} documenti eliminati`,
      details: {
        consultantDocsDeleted,
        clientDocsDeleted,
        clientStoresReset,
      },
    });
  } catch (error: any) {
    console.error('[FileSearch API] Error resetting stores:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/file-search/reset-and-resync
 * Complete reset and resync of all File Search stores
 * 
 * This endpoint:
 * 1. Deletes ALL documents from consultant and client stores
 * 2. Triggers a full sync of all content
 * 
 * Use this when you need a clean slate and want to resync everything.
 * Progress is emitted via SSE for real-time tracking.
 */
router.post('/reset-and-resync', authenticateToken, requireRole('consultant'), async (req: AuthRequest, res) => {
  try {
    const consultantId = req.user!.id;
    
    console.log(`\n${'═'.repeat(70)}`);
    console.log(`🔄 [FileSearch] Starting COMPLETE RESET AND RESYNC for consultant ${consultantId}`);
    console.log(`${'═'.repeat(70)}\n`);
    
    // PHASE 1: Delete all documents from all stores
    console.log(`📍 PHASE 1: Deleting all documents from all stores...`);
    
    let consultantDocsDeleted = 0;
    let clientDocsDeleted = 0;
    let clientStoresReset = 0;
    
    // Reset consultant store
    const consultantStore = await db.query.fileSearchStores.findFirst({
      where: and(
        eq(fileSearchStores.ownerId, consultantId),
        eq(fileSearchStores.ownerType, 'consultant'),
      ),
    });
    
    if (consultantStore) {
      const consultantDocs = await db.query.fileSearchDocuments.findMany({
        where: eq(fileSearchDocuments.storeId, consultantStore.id),
      });
      
      console.log(`   📦 Consultant store: ${consultantDocs.length} documents to delete`);
      
      for (const doc of consultantDocs) {
        try {
          await fileSearchService.deleteDocument(doc.id, consultantId);
          consultantDocsDeleted++;
        } catch (err: any) {
          console.warn(`   ⚠️ Failed to delete doc ${doc.id}: ${err.message}`);
        }
      }
      
      await db.update(fileSearchStores)
        .set({ documentCount: 0, updatedAt: new Date() })
        .where(eq(fileSearchStores.id, consultantStore.id));
    }
    
    // Reset all client stores
    const clients = await db.select({ id: users.id })
      .from(users)
      .where(and(eq(users.consultantId, consultantId), eq(users.role, 'client')));
    
    const clientIds = clients.map(c => c.id);
    
    if (clientIds.length > 0) {
      const clientStores = await db.query.fileSearchStores.findMany({
        where: and(
          inArray(fileSearchStores.ownerId, clientIds),
          eq(fileSearchStores.ownerType, 'client'),
        ),
      });
      
      console.log(`   📦 Client stores: ${clientStores.length} stores to reset`);
      
      for (const store of clientStores) {
        const clientDocs = await db.query.fileSearchDocuments.findMany({
          where: eq(fileSearchDocuments.storeId, store.id),
        });
        
        for (const doc of clientDocs) {
          try {
            await fileSearchService.deleteDocument(doc.id, consultantId);
            clientDocsDeleted++;
          } catch (err: any) {
            console.warn(`   ⚠️ Failed to delete client doc ${doc.id}: ${err.message}`);
          }
        }
        
        await db.update(fileSearchStores)
          .set({ documentCount: 0, updatedAt: new Date() })
          .where(eq(fileSearchStores.id, store.id));
          
        clientStoresReset++;
      }
    }
    
    console.log(`   ✅ Phase 1 complete: ${consultantDocsDeleted + clientDocsDeleted} documents deleted`);
    
    // PHASE 2: Full sync of all content
    console.log(`\n📍 PHASE 2: Syncing all content...`);
    
    const syncResult = await fileSearchSyncService.syncAllContentForConsultant(consultantId);
    
    console.log(`\n${'═'.repeat(70)}`);
    console.log(`✅ [FileSearch] RESET AND RESYNC COMPLETE!`);
    console.log(`${'═'.repeat(70)}\n`);
    
    res.json({
      success: true,
      message: 'Reset e risincronizzazione completati',
      resetPhase: {
        consultantDocsDeleted,
        clientDocsDeleted,
        clientStoresReset,
        totalDeleted: consultantDocsDeleted + clientDocsDeleted,
      },
      syncPhase: syncResult,
    });
  } catch (error: any) {
    console.error('[FileSearch API] Error in reset-and-resync:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/file-search/migrate-client/:clientId
 * Migrate a single client to private store architecture
 * Syncs all assigned content to the client's private store
 */
router.post('/migrate-client/:clientId', authenticateToken, requireRole('consultant'), async (req: AuthRequest, res) => {
  try {
    const consultantId = req.user!.id;
    const { clientId } = req.params;
    
    // Verify client belongs to this consultant
    const client = await db.query.users.findFirst({
      where: and(
        eq(users.id, clientId),
        eq(users.consultantId, consultantId),
      ),
    });
    
    if (!client) {
      return res.status(404).json({ error: 'Client not found or not authorized' });
    }
    
    console.log(`\n${'═'.repeat(60)}`);
    console.log(`🔄 [API] Starting migration for client: ${client.firstName} ${client.lastName}`);
    console.log(`${'═'.repeat(60)}\n`);
    
    const result = await fileSearchSyncService.migrateClientToPrivateStore(clientId, consultantId);
    
    res.json({
      success: result.success,
      clientName: `${client.firstName} ${client.lastName}`,
      summary: {
        exercises: result.exercises,
        library: result.library,
        university: result.university,
        goals: result.goals,
        tasks: result.tasks,
        consultations: result.consultations,
      },
      errors: result.errors,
    });
  } catch (error: any) {
    console.error('[FileSearch API] Error migrating client:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/file-search/migrate-all-clients
 * Migrate ALL clients to private store architecture
 * Syncs all assigned content to each client's private store
 */
router.post('/migrate-all-clients', authenticateToken, requireRole('consultant'), async (req: AuthRequest, res) => {
  try {
    const consultantId = req.user!.id;
    
    console.log(`\n${'═'.repeat(60)}`);
    console.log(`🚀 [API] Starting BULK migration for all clients`);
    console.log(`${'═'.repeat(60)}\n`);
    
    const result = await fileSearchSyncService.migrateAllClientsToPrivateStores(consultantId);
    
    res.json({
      success: result.success,
      summary: {
        clientsMigrated: result.clientsMigrated,
        totalExercises: result.totalExercises,
        totalLibrary: result.totalLibrary,
        totalUniversity: result.totalUniversity,
        totalGoals: result.totalGoals,
        totalTasks: result.totalTasks,
        totalConsultations: result.totalConsultations,
      },
      errors: result.errors,
    });
  } catch (error: any) {
    console.error('[FileSearch API] Error in bulk migration:', error);
    res.status(500).json({ error: error.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// EXTERNAL DOCS FROM EXERCISES (workPlatform Google Docs)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * GET /api/file-search/external-docs/missing
 * Get all missing external docs (workPlatform URLs) across all clients
 * Optional query param: ?clientId=xxx to filter for specific client
 */
router.get('/external-docs/missing', authenticateToken, requireRole('consultant'), async (req: AuthRequest, res) => {
  try {
    const consultantId = req.user!.id;
    const { clientId } = req.query;
    
    if (clientId && typeof clientId === 'string') {
      // Get missing docs for specific client
      const missing = await fileSearchSyncService.getMissingExternalDocsForClient(clientId, consultantId);
      
      // Get client name
      const client = await db.query.users.findFirst({
        where: eq(users.id, clientId),
      });
      
      res.json({
        clientId,
        clientName: client ? `${client.firstName || ''} ${client.lastName || ''}`.trim() : 'Unknown',
        missingDocs: missing,
        total: missing.length,
      });
    } else {
      // Get all missing docs across all clients
      const allMissing = await fileSearchSyncService.getAllMissingExternalDocs(consultantId);
      
      // Group by client
      const byClient = new Map<string, { clientName: string; docs: typeof allMissing }>();
      for (const doc of allMissing) {
        if (!byClient.has(doc.clientId)) {
          byClient.set(doc.clientId, { clientName: doc.clientName, docs: [] });
        }
        byClient.get(doc.clientId)!.docs.push(doc);
      }
      
      res.json({
        totalMissing: allMissing.length,
        clientsWithMissing: byClient.size,
        byClient: Array.from(byClient.entries()).map(([clientId, data]) => ({
          clientId,
          clientName: data.clientName,
          missingDocs: data.docs,
          count: data.docs.length,
        })),
      });
    }
  } catch (error: any) {
    console.error('[FileSearch API] Error fetching missing external docs:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/file-search/external-docs/sync
 * Sync a single external doc
 * Body: { assignmentId: string, clientId: string }
 */
router.post('/external-docs/sync', authenticateToken, requireRole('consultant'), async (req: AuthRequest, res) => {
  try {
    const consultantId = req.user!.id;
    const { assignmentId, clientId } = req.body;
    
    if (!assignmentId || !clientId) {
      return res.status(400).json({ error: 'Missing assignmentId or clientId' });
    }
    
    // Verify client belongs to this consultant
    const client = await db.query.users.findFirst({
      where: and(
        eq(users.id, clientId),
        eq(users.consultantId, consultantId),
      ),
    });
    
    if (!client) {
      return res.status(404).json({ error: 'Client not found or not authorized' });
    }
    
    const result = await fileSearchSyncService.syncExerciseExternalDoc(assignmentId, clientId, consultantId);
    
    res.json({
      success: result.success,
      error: result.error,
    });
  } catch (error: any) {
    console.error('[FileSearch API] Error syncing external doc:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/file-search/external-docs/sync-all
 * Sync all missing external docs
 * Body: { clientId?: string } - optional, syncs all clients if not provided
 */
router.post('/external-docs/sync-all', authenticateToken, requireRole('consultant'), async (req: AuthRequest, res) => {
  try {
    const consultantId = req.user!.id;
    const { clientId } = req.body;
    
    if (clientId) {
      // Sync for specific client
      const client = await db.query.users.findFirst({
        where: and(
          eq(users.id, clientId),
          eq(users.consultantId, consultantId),
        ),
      });
      
      if (!client) {
        return res.status(404).json({ error: 'Client not found or not authorized' });
      }
      
      const result = await fileSearchSyncService.syncAllExternalDocsForClient(clientId, consultantId);
      
      res.json({
        success: result.success,
        clientId,
        clientName: `${client.firstName || ''} ${client.lastName || ''}`.trim(),
        synced: result.synced,
        failed: result.failed,
        errors: result.errors,
      });
    } else {
      // Sync for all clients
      const clients = await db.query.users.findMany({
        where: eq(users.consultantId, consultantId),
      });
      
      let totalSynced = 0;
      let totalFailed = 0;
      const allErrors: string[] = [];
      const clientResults: Array<{ clientId: string; clientName: string; synced: number; failed: number }> = [];
      
      for (const client of clients) {
        const result = await fileSearchSyncService.syncAllExternalDocsForClient(client.id, consultantId);
        
        totalSynced += result.synced;
        totalFailed += result.failed;
        allErrors.push(...result.errors);
        
        if (result.synced > 0 || result.failed > 0) {
          clientResults.push({
            clientId: client.id,
            clientName: `${client.firstName || ''} ${client.lastName || ''}`.trim(),
            synced: result.synced,
            failed: result.failed,
          });
        }
      }
      
      res.json({
        success: totalFailed === 0,
        totalSynced,
        totalFailed,
        clientResults,
        errors: allErrors,
      });
    }
  } catch (error: any) {
    console.error('[FileSearch API] Error syncing all external docs:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
