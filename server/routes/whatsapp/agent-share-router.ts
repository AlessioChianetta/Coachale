/**
 * WhatsApp Agent Share Routes (Consultant-only)
 * Authenticated routes for managing agent shares
 */

import express from 'express';
import { authenticateToken, requireRole, type AuthRequest } from '../../middleware/auth';
import * as shareService from '../../whatsapp/share-service';
import { db } from '../../db';
import * as schema from '@shared/schema';
import { eq } from 'drizzle-orm';

const router = express.Router();

// All routes require consultant authentication
router.use(authenticateToken);
router.use(requireRole('consultant'));

/**
 * POST /api/whatsapp/agent-share
 * Create a new agent share
 */
router.post('/', async (req: AuthRequest, res) => {
  try {
    const { agentConfigId, accessType, password, allowedDomains, expireAt, requiresLogin } = req.body;
    const consultantId = req.user!.id;
    
    // Validate required fields
    if (!agentConfigId) {
      return res.status(400).json({ error: 'agentConfigId richiesto' });
    }
    
    if (!['public', 'password', 'token'].includes(accessType)) {
      return res.status(400).json({ error: 'accessType non valido. Usa: public, password, token' });
    }
    
    // Verify agent ownership
    const [agentConfig] = await db
      .select()
      .from(schema.consultantWhatsappConfig)
      .where(eq(schema.consultantWhatsappConfig.id, agentConfigId))
      .limit(1);
    
    if (!agentConfig) {
      return res.status(404).json({ error: 'Agente non trovato' });
    }
    
    if (agentConfig.consultantId !== consultantId) {
      return res.status(403).json({ error: 'Non autorizzato a condividere questo agente' });
    }
    
    // Create share
    const share = await shareService.createShare({
      consultantId,
      agentConfigId,
      agentName: agentConfig.agentName,
      accessType,
      password,
      allowedDomains: allowedDomains || [],
      expireAt: expireAt ? new Date(expireAt) : undefined,
      createdBy: consultantId,
      requiresLogin: requiresLogin || false,
    });
    
    // Generate public URL
    const baseUrl = process.env.REPLIT_DOMAINS 
      ? `https://${process.env.REPLIT_DOMAINS.split(',')[0]}`
      : req.protocol + '://' + req.get('host');
    
    const publicUrl = `${baseUrl}/share/${share.slug}`;
    
    res.status(201).json({
      success: true,
      share,
      publicUrl,
      message: 'Condivisione creata con successo',
    });
  } catch (error: any) {
    console.error('Error creating share:', error);
    res.status(400).json({ error: error.message || 'Errore durante la creazione della condivisione' });
  }
});

/**
 * GET /api/whatsapp/agent-share
 * List all shares for the consultant
 */
router.get('/', async (req: AuthRequest, res) => {
  try {
    const consultantId = req.user!.id;
    const shares = await shareService.getSharesByConsultant(consultantId);
    
    // Generate public URLs for each share
    const baseUrl = process.env.REPLIT_DOMAINS 
      ? `https://${process.env.REPLIT_DOMAINS.split(',')[0]}`
      : req.protocol + '://' + req.get('host');
    
    const sharesWithUrls = shares.map(({ share, agent }) => ({
      id: share.id,
      slug: share.slug,
      agentName: share.agentName,
      accessType: share.accessType,
      isActive: share.isActive,
      allowedDomains: share.allowedDomains,
      expireAt: share.expireAt,
      totalAccessCount: share.totalAccessCount,
      uniqueVisitorsCount: share.uniqueVisitorsCount,
      totalMessagesCount: share.totalMessagesCount,
      createdAt: share.createdAt,
      revokedAt: share.revokedAt,
      requiresLogin: share.requiresLogin || false,
      agent: {
        id: share.agentConfigId, // Use agentConfigId as agent.id for filtering
        agentName: agent?.agentName || share.agentName,
        businessName: agent?.businessName,
        agentType: agent?.agentType,
      },
      publicUrl: `${baseUrl}/share/${share.slug}`,
    }));
    
    res.json({
      success: true,
      shares: sharesWithUrls,
    });
  } catch (error: any) {
    console.error('Error fetching shares:', error);
    res.status(500).json({ error: error.message || 'Errore durante il recupero delle condivisioni' });
  }
});

/**
 * GET /api/whatsapp/agent-share/:shareId
 * Get specific share details
 */
router.get('/:shareId', async (req: AuthRequest, res) => {
  try {
    const { shareId } = req.params;
    const consultantId = req.user!.id;
    
    const share = await shareService.getShareById(shareId);
    if (!share) {
      return res.status(404).json({ error: 'Condivisione non trovata' });
    }
    
    if (share.consultantId !== consultantId) {
      return res.status(403).json({ error: 'Non autorizzato' });
    }
    
    const baseUrl = process.env.REPLIT_DOMAINS 
      ? `https://${process.env.REPLIT_DOMAINS.split(',')[0]}`
      : req.protocol + '://' + req.get('host');
    
    res.json({
      success: true,
      share: {
        ...share,
        publicUrl: `${baseUrl}/share/${share.slug}`,
      },
    });
  } catch (error: any) {
    console.error('Error fetching share:', error);
    res.status(500).json({ error: error.message || 'Errore durante il recupero della condivisione' });
  }
});

/**
 * PUT /api/whatsapp/agent-share/:shareId
 * Update share configuration
 */
router.put('/:shareId', async (req: AuthRequest, res) => {
  try {
    const { shareId } = req.params;
    const consultantId = req.user!.id;
    const { accessType, password, allowedDomains, expireAt, isActive, rateLimitConfig } = req.body;
    
    // Validate password requirement when switching to password accessType
    if (accessType === 'password' && !password) {
      // Check if share already has a password
      const existingShare = await shareService.getShareById(shareId);
      if (!existingShare) {
        return res.status(404).json({ error: 'Condivisione non trovata' });
      }
      
      if (existingShare.consultantId !== consultantId) {
        return res.status(403).json({ error: 'Non autorizzato' });
      }
      
      // If changing TO password mode, password is required
      if (existingShare.accessType !== 'password') {
        return res.status(400).json({ 
          error: 'Password richiesta quando si attiva la protezione password' 
        });
      }
    }
    
    // Build update object only with provided fields
    const updateData: any = {};
    
    if (accessType !== undefined) updateData.accessType = accessType;
    if (password !== undefined) updateData.password = password;
    if (allowedDomains !== undefined) updateData.allowedDomains = allowedDomains;
    if (expireAt !== undefined) updateData.expireAt = expireAt ? new Date(expireAt) : null;
    if (isActive !== undefined) updateData.isActive = isActive;
    if (rateLimitConfig !== undefined) updateData.rateLimitConfig = rateLimitConfig;
    
    const updatedShare = await shareService.updateShare(shareId, consultantId, updateData);
    
    res.json({
      success: true,
      share: updatedShare,
      message: 'Condivisione aggiornata con successo',
    });
  } catch (error: any) {
    console.error('Error updating share:', error);
    res.status(400).json({ error: error.message || 'Errore durante l\'aggiornamento della condivisione' });
  }
});

/**
 * PUT /api/whatsapp/agent-share/:shareId/toggle
 * Toggle share active status
 */
router.put('/:shareId/toggle', async (req: AuthRequest, res) => {
  try {
    const { shareId } = req.params;
    const consultantId = req.user!.id;
    
    const share = await shareService.getShareById(shareId);
    if (!share) {
      return res.status(404).json({ error: 'Condivisione non trovata' });
    }
    
    if (share.consultantId !== consultantId) {
      return res.status(403).json({ error: 'Non autorizzato' });
    }
    
    const updatedShare = await shareService.updateShare(shareId, consultantId, {
      isActive: !share.isActive,
    });
    
    res.json({
      success: true,
      share: updatedShare,
      message: updatedShare.isActive ? 'Condivisione attivata' : 'Condivisione disattivata',
    });
  } catch (error: any) {
    console.error('Error toggling share:', error);
    res.status(400).json({ error: error.message || 'Errore durante il toggle della condivisione' });
  }
});

/**
 * DELETE /api/whatsapp/agent-share/:shareId
 * Revoke (soft delete) a share
 */
router.delete('/:shareId', async (req: AuthRequest, res) => {
  try {
    const { shareId } = req.params;
    const consultantId = req.user!.id;
    const { reason } = req.body;
    
    const revokedShare = await shareService.revokeShare(shareId, consultantId, reason);
    
    res.json({
      success: true,
      share: revokedShare,
      message: 'Condivisione revocata con successo',
    });
  } catch (error: any) {
    console.error('Error revoking share:', error);
    res.status(400).json({ error: error.message || 'Errore durante la revoca della condivisione' });
  }
});

/**
 * GET /api/whatsapp/agent-share/:shareId/analytics
 * Get share analytics
 */
router.get('/:shareId/analytics', async (req: AuthRequest, res) => {
  try {
    const { shareId } = req.params;
    const consultantId = req.user!.id;
    
    const analytics = await shareService.getShareAnalytics(shareId, consultantId);
    
    res.json({
      success: true,
      ...analytics,
    });
  } catch (error: any) {
    console.error('Error fetching analytics:', error);
    res.status(400).json({ error: error.message || 'Errore durante il recupero delle analytics' });
  }
});

/**
 * GET /api/whatsapp/agent-share/:shareId/iframe
 * Generate iframe embed code
 */
router.get('/:shareId/iframe', async (req: AuthRequest, res) => {
  try {
    const { shareId } = req.params;
    const consultantId = req.user!.id;
    const { width = '400', height = '600' } = req.query;
    
    const share = await shareService.getShareById(shareId);
    if (!share) {
      return res.status(404).json({ error: 'Condivisione non trovata' });
    }
    
    if (share.consultantId !== consultantId) {
      return res.status(403).json({ error: 'Non autorizzato' });
    }
    
    const baseUrl = process.env.REPLIT_DOMAINS 
      ? `https://${process.env.REPLIT_DOMAINS.split(',')[0]}`
      : req.protocol + '://' + req.get('host');
    
    const iframeUrl = `${baseUrl}/share/${share.slug}?embed=true`;
    
    const iframeCode = `<iframe 
  src="${iframeUrl}"
  width="${width}" 
  height="${height}"
  frameborder="0"
  allow="clipboard-write"
  style="border: none; border-radius: 8px;"
></iframe>`;
    
    const embedScript = `<!-- Snippet Embed Agente AI -->
${iframeCode}
<script>
  // Auto-resize iframe (opzionale)
  window.addEventListener('message', function(e) {
    if (e.origin !== '${baseUrl}') return;
    if (e.data.type === 'resize') {
      const iframe = document.querySelector('iframe[src*="${share.slug}"]');
      if (iframe) iframe.style.height = e.data.height + 'px';
    }
  });
</script>`;
    
    res.json({
      success: true,
      iframe: {
        code: iframeCode,
        scriptWithResize: embedScript,
        url: iframeUrl,
        width,
        height,
      },
    });
  } catch (error: any) {
    console.error('Error generating iframe:', error);
    res.status(500).json({ error: error.message || 'Errore durante la generazione dello snippet iframe' });
  }
});

export default router;
