import { Router } from 'express';
import { authenticateToken, requireRole, type AuthRequest } from '../middleware/auth';
import { publerService } from '../services/publer-service';
import { z } from 'zod';

const router = Router();

const configSchema = z.object({
  apiKey: z.string().min(1, 'API Key richiesta'),
  workspaceId: z.string().min(1, 'Workspace ID richiesto'),
  isActive: z.boolean().optional().default(true),
});

const publishSchema = z.object({
  postId: z.string().optional(),
  accountIds: z.array(z.string()).min(1, 'Seleziona almeno un account'),
  text: z.string().min(1, 'Testo del post richiesto'),
  scheduledAt: z.string().datetime().optional(),
  mediaIds: z.array(z.string()).optional(),
});

router.get('/config', authenticateToken, requireRole('consultant'), async (req: AuthRequest, res) => {
  try {
    const consultantId = req.user!.id;
    const status = await publerService.getConfigStatus(consultantId);
    res.json({ success: true, ...status });
  } catch (error: any) {
    console.error('[PUBLER] Error getting config:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put('/config', authenticateToken, requireRole('consultant'), async (req: AuthRequest, res) => {
  try {
    const consultantId = req.user!.id;
    const data = configSchema.parse(req.body);
    
    await publerService.saveConfig(consultantId, data.apiKey, data.workspaceId, data.isActive);
    
    res.json({ success: true, message: 'Configurazione Publer salvata' });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: error.errors[0].message });
    }
    console.error('[PUBLER] Error saving config:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/test', authenticateToken, requireRole('consultant'), async (req: AuthRequest, res) => {
  try {
    const consultantId = req.user!.id;
    const result = await publerService.testConnection(consultantId);
    res.json(result);
  } catch (error: any) {
    console.error('[PUBLER] Error testing connection:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/accounts', authenticateToken, requireRole('consultant'), async (req: AuthRequest, res) => {
  try {
    const consultantId = req.user!.id;
    const status = await publerService.getConfigStatus(consultantId);
    if (!status.configured || !status.isActive) {
      return res.status(400).json({ success: false, error: 'Publer non configurato o disattivato' });
    }
    const accounts = await publerService.getCachedAccounts(consultantId);
    res.json({ success: true, accounts });
  } catch (error: any) {
    console.error('[PUBLER] Error getting accounts:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/accounts/sync', authenticateToken, requireRole('consultant'), async (req: AuthRequest, res) => {
  try {
    const consultantId = req.user!.id;
    const status = await publerService.getConfigStatus(consultantId);
    if (!status.configured || !status.isActive) {
      return res.status(400).json({ success: false, error: 'Publer non configurato o disattivato' });
    }
    const result = await publerService.syncAccounts(consultantId);
    res.json({ success: true, ...result, message: `Sincronizzati ${result.synced} account` });
  } catch (error: any) {
    console.error('[PUBLER] Error syncing accounts:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/publish', authenticateToken, requireRole('consultant'), async (req: AuthRequest, res) => {
  try {
    const consultantId = req.user!.id;
    const status = await publerService.getConfigStatus(consultantId);
    if (!status.configured || !status.isActive) {
      return res.status(400).json({ success: false, error: 'Publer non configurato o disattivato' });
    }
    const data = publishSchema.parse(req.body);
    const scheduledDate = data.scheduledAt ? new Date(data.scheduledAt) : undefined;
    
    const result = await publerService.schedulePost(consultantId, {
      accountIds: data.accountIds,
      text: data.text,
      scheduledAt: scheduledDate,
      mediaIds: data.mediaIds,
    });
    
    if (data.postId) {
      const publerStatus = scheduledDate ? 'scheduled' : 'published';
      await publerService.updatePostStatus(data.postId, publerStatus, result.jobId, scheduledDate);
    }
    
    res.json({ success: true, ...result, message: 'Post inviato a Publer' });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: error.errors[0].message });
    }
    console.error('[PUBLER] Error publishing:', error);
    if (req.body?.postId) {
      await publerService.updatePostStatus(req.body.postId, 'failed', undefined, undefined, error.message);
    }
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
