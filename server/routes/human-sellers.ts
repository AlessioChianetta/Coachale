import { Router, Response } from 'express';
import { db } from '../db';
import { humanSellers, videoMeetings, videoMeetingParticipants, insertHumanSellerSchema, insertVideoMeetingSchema, salesScripts, videoMeetingAnalytics, users } from '@shared/schema';
import { eq, and, desc, asc } from 'drizzle-orm';
import { AuthRequest, authenticateToken, requireRole } from '../middleware/auth';
import { nanoid } from 'nanoid';
import { OAuth2Client } from 'google-auth-library';

const router = Router();

const requireClient = requireRole('client');

// ═══════════════════════════════════════════════════════════════════════════
// AGGREGATED ENDPOINTS (for client dashboard)
// ═══════════════════════════════════════════════════════════════════════════

router.get('/meetings', authenticateToken, requireClient, async (req: AuthRequest, res: Response) => {
  try {
    const clientId = req.user!.id;
    
    const meetings = await db
      .select({
        id: videoMeetings.id,
        sellerId: videoMeetings.sellerId,
        meetingToken: videoMeetings.meetingToken,
        prospectName: videoMeetings.prospectName,
        prospectEmail: videoMeetings.prospectEmail,
        playbookId: videoMeetings.playbookId,
        scheduledAt: videoMeetings.scheduledAt,
        status: videoMeetings.status,
        createdAt: videoMeetings.createdAt,
        scriptName: salesScripts.name,
      })
      .from(videoMeetings)
      .innerJoin(humanSellers, eq(videoMeetings.sellerId, humanSellers.id))
      .leftJoin(salesScripts, eq(videoMeetings.playbookId, salesScripts.id))
      .where(eq(humanSellers.clientId, clientId))
      .orderBy(desc(videoMeetings.scheduledAt));
    
    res.json(meetings);
  } catch (error: any) {
    console.error('[VideoMeetings] GET all client meetings error:', error);
    res.status(500).json({ error: 'Errore nel recupero dei meetings' });
  }
});

router.get('/scripts', authenticateToken, requireClient, async (req: AuthRequest, res: Response) => {
  try {
    const clientId = req.user!.id;
    
    const scripts = await db
      .select({
        id: salesScripts.id,
        name: salesScripts.name,
      })
      .from(salesScripts)
      .where(eq(salesScripts.clientId, clientId))
      .orderBy(asc(salesScripts.name));
    
    res.json(scripts);
  } catch (error: any) {
    console.error('[Scripts] GET client scripts error:', error);
    res.status(500).json({ error: 'Errore nel recupero degli scripts' });
  }
});

router.get('/analytics/:meetingId', authenticateToken, requireClient, async (req: AuthRequest, res: Response) => {
  try {
    const clientId = req.user!.id;
    const { meetingId } = req.params;
    
    const [meeting] = await db
      .select({
        meeting: videoMeetings,
        seller: humanSellers,
      })
      .from(videoMeetings)
      .innerJoin(humanSellers, eq(videoMeetings.sellerId, humanSellers.id))
      .where(and(
        eq(videoMeetings.id, meetingId),
        eq(humanSellers.clientId, clientId)
      ));
    
    if (!meeting) {
      return res.status(404).json({ error: 'Meeting non trovato' });
    }
    
    const [analytics] = await db
      .select()
      .from(videoMeetingAnalytics)
      .where(eq(videoMeetingAnalytics.meetingId, meetingId));
    
    res.json({
      meetingId,
      prospectName: meeting.meeting.prospectName,
      scheduledAt: meeting.meeting.scheduledAt,
      status: meeting.meeting.status,
      analytics: analytics || null,
    });
  } catch (error: any) {
    console.error('[Analytics] GET meeting analytics error:', error);
    res.status(500).json({ error: 'Errore nel recupero delle analytics' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// HUMAN SELLERS CRUD
// ═══════════════════════════════════════════════════════════════════════════

router.get('/', authenticateToken, requireClient, async (req: AuthRequest, res: Response) => {
  try {
    const clientId = req.user!.id;
    
    const sellers = await db
      .select()
      .from(humanSellers)
      .where(eq(humanSellers.clientId, clientId))
      .orderBy(desc(humanSellers.createdAt));
    
    res.json(sellers);
  } catch (error: any) {
    console.error('[HumanSellers] GET list error:', error);
    res.status(500).json({ error: 'Errore nel recupero dei venditori' });
  }
});

router.get('/:id', authenticateToken, requireClient, async (req: AuthRequest, res: Response) => {
  try {
    const clientId = req.user!.id;
    const { id } = req.params;
    
    const [seller] = await db
      .select()
      .from(humanSellers)
      .where(and(
        eq(humanSellers.id, id),
        eq(humanSellers.clientId, clientId)
      ));
    
    if (!seller) {
      return res.status(404).json({ error: 'Venditore non trovato' });
    }
    
    res.json(seller);
  } catch (error: any) {
    console.error('[HumanSellers] GET single error:', error);
    res.status(500).json({ error: 'Errore nel recupero del venditore' });
  }
});

router.post('/', authenticateToken, requireClient, async (req: AuthRequest, res: Response) => {
  try {
    const clientId = req.user!.id;
    
    // Validazione Zod
    const validation = insertHumanSellerSchema.safeParse({ ...req.body, clientId });
    if (!validation.success) {
      return res.status(400).json({ error: 'Dati non validi', details: validation.error.errors });
    }
    
    const { sellerName, displayName, description, isActive, ownerEmail } = validation.data;
    
    const [newSeller] = await db
      .insert(humanSellers)
      .values({
        clientId,
        sellerName,
        displayName,
        description: description || null,
        ownerEmail: ownerEmail || null,
        isActive: isActive ?? true,
      })
      .returning();
    
    console.log(`[HumanSellers] Created seller ${newSeller.id} for client ${clientId}`);
    res.status(201).json(newSeller);
  } catch (error: any) {
    console.error('[HumanSellers] POST create error:', error);
    res.status(500).json({ error: 'Errore nella creazione del venditore' });
  }
});

router.put('/:id', authenticateToken, requireClient, async (req: AuthRequest, res: Response) => {
  try {
    const clientId = req.user!.id;
    const { id } = req.params;
    const { sellerName, displayName, description, isActive, ownerEmail } = req.body;
    
    const [existing] = await db
      .select()
      .from(humanSellers)
      .where(and(
        eq(humanSellers.id, id),
        eq(humanSellers.clientId, clientId)
      ));
    
    if (!existing) {
      return res.status(404).json({ error: 'Venditore non trovato' });
    }
    
    const [updated] = await db
      .update(humanSellers)
      .set({
        sellerName: sellerName ?? existing.sellerName,
        displayName: displayName ?? existing.displayName,
        description: description !== undefined ? description : existing.description,
        ownerEmail: ownerEmail !== undefined ? ownerEmail : existing.ownerEmail,
        isActive: isActive !== undefined ? isActive : existing.isActive,
        updatedAt: new Date(),
      })
      .where(eq(humanSellers.id, id))
      .returning();
    
    console.log(`[HumanSellers] Updated seller ${id}`);
    res.json(updated);
  } catch (error: any) {
    console.error('[HumanSellers] PUT update error:', error);
    res.status(500).json({ error: 'Errore nell\'aggiornamento del venditore' });
  }
});

router.delete('/:id', authenticateToken, requireClient, async (req: AuthRequest, res: Response) => {
  try {
    const clientId = req.user!.id;
    const { id } = req.params;
    
    const [existing] = await db
      .select()
      .from(humanSellers)
      .where(and(
        eq(humanSellers.id, id),
        eq(humanSellers.clientId, clientId)
      ));
    
    if (!existing) {
      return res.status(404).json({ error: 'Venditore non trovato' });
    }
    
    await db
      .delete(humanSellers)
      .where(eq(humanSellers.id, id));
    
    console.log(`[HumanSellers] Deleted seller ${id}`);
    res.json({ success: true, message: 'Venditore eliminato' });
  } catch (error: any) {
    console.error('[HumanSellers] DELETE error:', error);
    res.status(500).json({ error: 'Errore nell\'eliminazione del venditore' });
  }
});

router.patch('/:id/toggle', authenticateToken, requireClient, async (req: AuthRequest, res: Response) => {
  try {
    const clientId = req.user!.id;
    const { id } = req.params;
    
    const [existing] = await db
      .select()
      .from(humanSellers)
      .where(and(
        eq(humanSellers.id, id),
        eq(humanSellers.clientId, clientId)
      ));
    
    if (!existing) {
      return res.status(404).json({ error: 'Venditore non trovato' });
    }
    
    const [updated] = await db
      .update(humanSellers)
      .set({
        isActive: !existing.isActive,
        updatedAt: new Date(),
      })
      .where(eq(humanSellers.id, id))
      .returning();
    
    console.log(`[HumanSellers] Toggled seller ${id} isActive: ${updated.isActive}`);
    res.json(updated);
  } catch (error: any) {
    console.error('[HumanSellers] PATCH toggle error:', error);
    res.status(500).json({ error: 'Errore nel toggle del venditore' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// VIDEO MEETINGS CRUD
// ═══════════════════════════════════════════════════════════════════════════

router.get('/meetings/:id', authenticateToken, requireClient, async (req: AuthRequest, res: Response) => {
  try {
    const clientId = req.user!.id;
    const { id } = req.params;
    
    const [meeting] = await db
      .select({
        meeting: videoMeetings,
        seller: humanSellers,
      })
      .from(videoMeetings)
      .leftJoin(humanSellers, eq(videoMeetings.sellerId, humanSellers.id))
      .where(and(
        eq(videoMeetings.id, id),
        eq(humanSellers.clientId, clientId)
      ));
    
    if (!meeting) {
      return res.status(404).json({ error: 'Meeting non trovato' });
    }
    
    const participants = await db
      .select()
      .from(videoMeetingParticipants)
      .where(eq(videoMeetingParticipants.meetingId, id));
    
    res.json({ ...meeting.meeting, seller: meeting.seller, participants });
  } catch (error: any) {
    console.error('[VideoMeetings] GET single error:', error);
    res.status(500).json({ error: 'Errore nel recupero del meeting' });
  }
});

router.get('/:sellerId/meetings', authenticateToken, requireClient, async (req: AuthRequest, res: Response) => {
  try {
    const clientId = req.user!.id;
    const { sellerId } = req.params;
    
    const [seller] = await db
      .select()
      .from(humanSellers)
      .where(and(
        eq(humanSellers.id, sellerId),
        eq(humanSellers.clientId, clientId)
      ));
    
    if (!seller) {
      return res.status(404).json({ error: 'Venditore non trovato' });
    }
    
    const meetings = await db
      .select()
      .from(videoMeetings)
      .where(eq(videoMeetings.sellerId, sellerId))
      .orderBy(desc(videoMeetings.createdAt));
    
    res.json(meetings);
  } catch (error: any) {
    console.error('[VideoMeetings] GET list error:', error);
    res.status(500).json({ error: 'Errore nel recupero dei meetings' });
  }
});

router.post('/:sellerId/meetings', authenticateToken, requireClient, async (req: AuthRequest, res: Response) => {
  try {
    const clientId = req.user!.id;
    const { sellerId } = req.params;
    
    const [seller] = await db
      .select()
      .from(humanSellers)
      .where(and(
        eq(humanSellers.id, sellerId),
        eq(humanSellers.clientId, clientId)
      ));
    
    if (!seller) {
      return res.status(404).json({ error: 'Venditore non trovato' });
    }
    
    const meetingToken = nanoid(16);
    const { prospectName, prospectEmail, scheduledAt, playbookId } = req.body;
    
    // Validazione base
    if (!prospectName || typeof prospectName !== 'string') {
      return res.status(400).json({ error: 'Nome prospect obbligatorio' });
    }
    
    // Priorità ownerEmail: 1) seller.ownerEmail 2) consultant email
    let ownerEmail = seller.ownerEmail || null;
    if (!ownerEmail) {
      const [owner] = await db
        .select({ email: users.email })
        .from(users)
        .where(eq(users.id, clientId));
      ownerEmail = owner?.email || null;
    }
    
    const [newMeeting] = await db
      .insert(videoMeetings)
      .values({
        sellerId,
        meetingToken,
        prospectName,
        prospectEmail: prospectEmail || null,
        ownerEmail,
        scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
        playbookId: playbookId || null,
        status: 'scheduled',
      })
      .returning();
    
    console.log(`[VideoMeetings] Created meeting ${newMeeting.id} with token ${meetingToken}`);
    res.status(201).json(newMeeting);
  } catch (error: any) {
    console.error('[VideoMeetings] POST create error:', error);
    res.status(500).json({ error: 'Errore nella creazione del meeting' });
  }
});

router.put('/meetings/:id', authenticateToken, requireClient, async (req: AuthRequest, res: Response) => {
  try {
    const clientId = req.user!.id;
    const { id } = req.params;
    const { prospectName, prospectEmail, scheduledAt, playbookId } = req.body;
    
    const [existing] = await db
      .select({
        meeting: videoMeetings,
        seller: humanSellers,
      })
      .from(videoMeetings)
      .leftJoin(humanSellers, eq(videoMeetings.sellerId, humanSellers.id))
      .where(and(
        eq(videoMeetings.id, id),
        eq(humanSellers.clientId, clientId)
      ));
    
    if (!existing) {
      return res.status(404).json({ error: 'Meeting non trovato' });
    }
    
    const [updated] = await db
      .update(videoMeetings)
      .set({
        prospectName: prospectName ?? existing.meeting.prospectName,
        prospectEmail: prospectEmail !== undefined ? prospectEmail : existing.meeting.prospectEmail,
        scheduledAt: scheduledAt ? new Date(scheduledAt) : existing.meeting.scheduledAt,
        playbookId: playbookId !== undefined ? playbookId : existing.meeting.playbookId,
      })
      .where(eq(videoMeetings.id, id))
      .returning();
    
    console.log(`[VideoMeetings] Updated meeting ${id}`);
    res.json(updated);
  } catch (error: any) {
    console.error('[VideoMeetings] PUT update error:', error);
    res.status(500).json({ error: 'Errore nell\'aggiornamento del meeting' });
  }
});

router.delete('/meetings/:id', authenticateToken, requireClient, async (req: AuthRequest, res: Response) => {
  try {
    const clientId = req.user!.id;
    const { id } = req.params;
    
    const [existing] = await db
      .select({
        meeting: videoMeetings,
        seller: humanSellers,
      })
      .from(videoMeetings)
      .leftJoin(humanSellers, eq(videoMeetings.sellerId, humanSellers.id))
      .where(and(
        eq(videoMeetings.id, id),
        eq(humanSellers.clientId, clientId)
      ));
    
    if (!existing) {
      return res.status(404).json({ error: 'Meeting non trovato' });
    }
    
    await db
      .delete(videoMeetings)
      .where(eq(videoMeetings.id, id));
    
    console.log(`[VideoMeetings] Deleted meeting ${id}`);
    res.json({ success: true, message: 'Meeting eliminato' });
  } catch (error: any) {
    console.error('[VideoMeetings] DELETE error:', error);
    res.status(500).json({ error: 'Errore nell\'eliminazione del meeting' });
  }
});

router.patch('/meetings/:id/status', authenticateToken, requireClient, async (req: AuthRequest, res: Response) => {
  try {
    const clientId = req.user!.id;
    const { id } = req.params;
    const { status } = req.body;
    
    const validStatuses = ['scheduled', 'in_progress', 'completed', 'cancelled'];
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Stato non valido' });
    }
    
    const [existing] = await db
      .select({
        meeting: videoMeetings,
        seller: humanSellers,
      })
      .from(videoMeetings)
      .leftJoin(humanSellers, eq(videoMeetings.sellerId, humanSellers.id))
      .where(and(
        eq(videoMeetings.id, id),
        eq(humanSellers.clientId, clientId)
      ));
    
    if (!existing) {
      return res.status(404).json({ error: 'Meeting non trovato' });
    }
    
    const updateData: any = { status };
    
    if (status === 'in_progress' && !existing.meeting.startedAt) {
      updateData.startedAt = new Date();
    }
    if (status === 'completed' && !existing.meeting.endedAt) {
      updateData.endedAt = new Date();
    }
    
    const [updated] = await db
      .update(videoMeetings)
      .set(updateData)
      .where(eq(videoMeetings.id, id))
      .returning();
    
    console.log(`[VideoMeetings] Updated meeting ${id} status to ${status}`);
    res.json(updated);
  } catch (error: any) {
    console.error('[VideoMeetings] PATCH status error:', error);
    res.status(500).json({ error: 'Errore nell\'aggiornamento dello stato' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// PUBLIC MEETING ACCESS (no auth required)
// ═══════════════════════════════════════════════════════════════════════════

export const publicMeetRouter = Router();

publicMeetRouter.get('/:token', async (req, res) => {
  try {
    const { token } = req.params;
    
    const [meeting] = await db
      .select({
        meeting: videoMeetings,
        seller: humanSellers,
      })
      .from(videoMeetings)
      .leftJoin(humanSellers, eq(videoMeetings.sellerId, humanSellers.id))
      .where(eq(videoMeetings.meetingToken, token));
    
    if (!meeting) {
      return res.status(404).json({ error: 'Meeting non trovato' });
    }
    
    // Recupera googleClientId dal consulente (risale la catena: seller -> client -> consultant)
    let googleClientId: string | null = null;
    if (meeting.seller?.clientId) {
      // Prima ottieni il client (proprietario del seller)
      const [client] = await db
        .select({ consultantId: users.consultantId, googleClientId: users.googleClientId })
        .from(users)
        .where(eq(users.id, meeting.seller.clientId));
      
      // Se il client ha un consultant, prendi il googleClientId dal consultant
      if (client?.consultantId) {
        const [consultant] = await db
          .select({ googleClientId: users.googleClientId })
          .from(users)
          .where(eq(users.id, client.consultantId));
        googleClientId = consultant?.googleClientId || null;
      } else {
        // Se il client è già un consultant (non ha consultantId), usa il suo googleClientId
        googleClientId = client?.googleClientId || null;
      }
    }
    
    // ownerEmail dal seller (ogni venditore ha la sua email)
    const ownerEmail = meeting.seller?.ownerEmail || meeting.meeting.ownerEmail || null;
    
    res.json({
      id: meeting.meeting.id,
      prospectName: meeting.meeting.prospectName,
      scheduledAt: meeting.meeting.scheduledAt,
      status: meeting.meeting.status,
      sellerId: meeting.meeting.sellerId,
      sellerClientId: meeting.seller?.clientId || null,
      ownerEmail,
      googleClientId,
      seller: meeting.seller ? {
        displayName: meeting.seller.displayName,
        description: meeting.seller.description,
      } : null,
    });
  } catch (error: any) {
    console.error('[PublicMeet] GET error:', error);
    res.status(500).json({ error: 'Errore nel recupero del meeting' });
  }
});

publicMeetRouter.post('/:token/join', async (req, res) => {
  try {
    const { token } = req.params;
    const { name, role } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: 'Nome partecipante obbligatorio' });
    }
    
    const [meeting] = await db
      .select()
      .from(videoMeetings)
      .where(eq(videoMeetings.meetingToken, token));
    
    if (!meeting) {
      return res.status(404).json({ error: 'Meeting non trovato' });
    }
    
    if (meeting.status === 'cancelled') {
      return res.status(400).json({ error: 'Meeting cancellato' });
    }
    
    if (meeting.status === 'completed') {
      return res.status(400).json({ error: 'Meeting già terminato' });
    }
    
    const participantRole = role || 'guest';
    if (!['host', 'guest', 'prospect'].includes(participantRole)) {
      return res.status(400).json({ error: 'Ruolo non valido' });
    }
    
    const [participant] = await db
      .insert(videoMeetingParticipants)
      .values({
        meetingId: meeting.id,
        name,
        role: participantRole,
        joinedAt: new Date(),
      })
      .returning();
    
    console.log(`[PublicMeet] Participant ${name} joined meeting ${meeting.id}`);
    res.status(201).json({
      participantId: participant.id,
      meetingId: meeting.id,
      status: meeting.status,
    });
  } catch (error: any) {
    console.error('[PublicMeet] POST join error:', error);
    res.status(500).json({ error: 'Errore nel join al meeting' });
  }
});

// Verifica token Google e restituisce email (come Google Meet)
publicMeetRouter.post('/verify-google', async (req, res) => {
  try {
    const { credential, clientId } = req.body;
    
    if (!credential) {
      return res.status(400).json({ error: 'Token Google mancante' });
    }
    
    // Verifica il token Google
    const googleClientId = clientId || process.env.GOOGLE_CLIENT_ID;
    if (!googleClientId) {
      return res.status(500).json({ error: 'Google Client ID non configurato' });
    }
    
    const client = new OAuth2Client(googleClientId);
    
    const ticket = await client.verifyIdToken({
      idToken: credential,
      audience: googleClientId,
    });
    
    const payload = ticket.getPayload();
    
    if (!payload) {
      return res.status(401).json({ error: 'Token Google non valido' });
    }
    
    res.json({
      email: payload.email,
      name: payload.name,
      picture: payload.picture,
      emailVerified: payload.email_verified,
    });
  } catch (error: any) {
    console.error('[PublicMeet] Google verify error:', error);
    res.status(401).json({ error: 'Verifica Google fallita' });
  }
});

export default router;
