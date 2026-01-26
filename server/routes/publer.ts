import { Router } from 'express';
import { authenticateToken, requireRole, type AuthRequest } from '../middleware/auth';
import { publerService } from '../services/publer-service';
import { upload } from '../middleware/upload';
import { z } from 'zod';
import fs from 'fs/promises';

const router = Router();

const configSchema = z.object({
  apiKey: z.string().min(1, 'API Key richiesta'),
  workspaceId: z.string().min(1, 'Workspace ID richiesto'),
  isActive: z.boolean().optional().default(true),
});

const publishSchema = z.object({
  postId: z.string().optional(),
  accountIds: z.array(z.string()).min(1, 'Seleziona almeno un account'),
  accountPlatforms: z.array(z.object({
    id: z.string(),
    platform: z.string(),
  })).optional(),
  text: z.string().min(1, 'Testo del post richiesto'),
  state: z.enum(['draft', 'publish_now', 'scheduled']).default('publish_now'),
  scheduledAt: z.string().datetime().optional(),
  mediaIds: z.array(z.string()).optional(),
  mediaType: z.enum(['image', 'video']).optional(),
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

router.post('/upload-placeholder', authenticateToken, requireRole('consultant'), async (req: AuthRequest, res) => {
  try {
    const consultantId = req.user!.id;
    const status = await publerService.getConfigStatus(consultantId);
    if (!status.configured || !status.isActive) {
      return res.status(400).json({ success: false, error: 'Publer non configurato o disattivato' });
    }
    const result = await publerService.uploadPlaceholderImage(consultantId);
    res.json({ success: true, mediaId: result.id });
  } catch (error: any) {
    console.error('[PUBLER] Error uploading placeholder:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/upload-media', authenticateToken, requireRole('consultant'), upload.array('files', 35), async (req: AuthRequest, res) => {
  const files = req.files as Express.Multer.File[];
  
  if (!files || files.length === 0) {
    return res.status(400).json({ success: false, error: 'Nessun file caricato' });
  }
  
  try {
    const consultantId = req.user!.id;
    const status = await publerService.getConfigStatus(consultantId);
    if (!status.configured || !status.isActive) {
      return res.status(400).json({ success: false, error: 'Publer non configurato o disattivato' });
    }
    
    const uploadedMedia: { id: string; path: string; thumbnail?: string }[] = [];
    const errors: string[] = [];
    
    for (const file of files) {
      try {
        const fileBuffer = await fs.readFile(file.path);
        const result = await publerService.uploadMedia(consultantId, fileBuffer, file.originalname, file.mimetype);
        console.log('[PUBLER] Media upload result:', JSON.stringify(result, null, 2));
        uploadedMedia.push({
          id: result.id,
          path: result.path,
          thumbnail: result.thumbnail,
        });
      } catch (uploadError: any) {
        console.error(`[PUBLER] Error uploading file ${file.originalname}:`, uploadError);
        errors.push(`${file.originalname}: ${uploadError.message}`);
      } finally {
        try {
          await fs.unlink(file.path);
        } catch (unlinkError) {
          console.error(`[PUBLER] Error deleting temp file ${file.path}:`, unlinkError);
        }
      }
    }
    
    if (uploadedMedia.length === 0 && errors.length > 0) {
      return res.status(500).json({ success: false, error: errors.join('; ') });
    }
    
    res.json({ 
      success: true, 
      media: uploadedMedia,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error: any) {
    console.error('[PUBLER] Error in upload-media:', error);
    for (const file of files) {
      try {
        await fs.unlink(file.path);
      } catch (unlinkError) {
        console.error(`[PUBLER] Error deleting temp file ${file.path}:`, unlinkError);
      }
    }
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
      accountPlatforms: data.accountPlatforms,
      text: data.text,
      state: data.state,
      scheduledAt: scheduledDate,
      mediaIds: data.mediaIds,
      mediaType: data.mediaType,
    });
    
    // Se ci sono errori dal job polling, il post non è stato creato
    if (!result.success && result.errors && result.errors.length > 0) {
      if (data.postId) {
        await publerService.updatePostStatus(data.postId, 'failed', undefined, undefined, result.errors[0]);
      }
      return res.status(400).json({ 
        success: false, 
        jobId: result.jobId,
        error: result.errors[0],
        errors: result.errors 
      });
    }
    
    if (data.postId) {
      let publerStatus: 'draft' | 'scheduled' | 'published';
      if (data.state === 'draft') {
        publerStatus = 'draft';
      } else if (data.state === 'scheduled') {
        publerStatus = 'scheduled';
      } else {
        publerStatus = 'scheduled';
      }
      const postId = result.postIds?.[0] || result.jobId;
      await publerService.updatePostStatus(data.postId, publerStatus, postId, scheduledDate);
    }
    
    const messages: Record<string, string> = {
      draft: 'Bozza salvata su Publer',
      publish_now: 'Post pubblicato su Publer',
      scheduled: 'Post programmato su Publer',
    };
    
    res.json({ success: true, ...result, message: messages[data.state] });
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

router.get('/media-proxy', async (req, res) => {
  try {
    const { url } = req.query;
    
    if (!url || typeof url !== 'string') {
      return res.status(400).json({ success: false, error: 'URL richiesto' });
    }
    
    if (!url.startsWith('https://cdn.publer.com/')) {
      return res.status(400).json({ success: false, error: 'URL non valido' });
    }
    
    const response = await fetch(url, {
      headers: {
        'Referer': 'https://cdn.publer.com/',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
      },
    });
    
    if (!response.ok) {
      console.error('[PUBLER] Media proxy failed:', response.status, response.statusText);
      return res.status(response.status).json({ success: false, error: 'Impossibile recuperare media' });
    }
    
    const contentType = response.headers.get('content-type') || 'image/png';
    const buffer = await response.arrayBuffer();
    
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.send(Buffer.from(buffer));
  } catch (error: any) {
    console.error('[PUBLER] Media proxy error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
