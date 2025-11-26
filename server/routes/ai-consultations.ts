import { Router } from 'express';
import { db } from '../db';
import { aiWeeklyConsultations, users } from '@shared/schema';
import { eq, and, gte, lte, desc } from 'drizzle-orm';
import { authenticateToken, type AuthRequest } from '../middleware/auth';
import { isConsultationActive } from '../ai/gemini-live-ws-service';

const router = Router();

/**
 * GET /api/consultations/ai/check-access
 * 
 * Verifica se il cliente può accedere alla consulenza AI settimanale
 * Controlla:
 * 1. Se esiste una consulenza programmata
 * 2. Se è martedì alle 15:00 (o modalità test attiva)
 * 3. Restituisce info sul prossimo appuntamento
 */
router.get('/check-access', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const consultantId = req.user!.consultantId;

    if (!consultantId) {
      return res.status(403).json({
        canAccess: false,
        reason: 'no_consultant',
        message: 'Non hai un consulente assegnato'
      });
    }

    // Trova la prossima consulenza programmata o quella in corso
    const now = new Date();
    const consultations = await db.select()
      .from(aiWeeklyConsultations)
      .where(
        and(
          eq(aiWeeklyConsultations.clientId, userId),
          eq(aiWeeklyConsultations.consultantId, consultantId)
        )
      )
      .orderBy(desc(aiWeeklyConsultations.scheduledFor))
      .limit(10);

    // Trova la prossima consulenza (futura o in corso oggi)
    const upcomingConsultation = consultations.find(c => {
      const scheduledDate = new Date(c.scheduledFor);
      return scheduledDate >= new Date(now.getTime() - 90 * 60 * 1000); // Include quelle iniziate max 90 min fa
    });

    // Se esiste una consulenza in modalità test, permetti sempre l'accesso
    if (upcomingConsultation?.isTestMode) {
      return res.json({
        canAccess: true,
        reason: 'test_mode',
        consultationId: upcomingConsultation.id,
        nextScheduled: upcomingConsultation.scheduledFor,
        message: 'Modalità test attiva - accesso sempre consentito'
      });
    }

    // Se non ci sono consulenze programmate, nega l'accesso
    if (!upcomingConsultation) {
      return res.json({
        canAccess: false,
        reason: 'no_scheduled_consultation',
        message: 'Nessuna consulenza programmata al momento'
      });
    }

    const scheduledDate = new Date(upcomingConsultation.scheduledFor);
    const timeDiff = scheduledDate.getTime() - now.getTime();
    const minutesDiff = Math.floor(timeDiff / (1000 * 60));

    // Permetti accesso se siamo entro 5 minuti prima o durante le 90 min della sessione
    const canAccessNow = timeDiff <= 5 * 60 * 1000 && timeDiff >= -90 * 60 * 1000;

    if (canAccessNow) {
      return res.json({
        canAccess: true,
        reason: 'scheduled_time',
        consultationId: upcomingConsultation.id,
        nextScheduled: upcomingConsultation.scheduledFor,
        message: 'Accesso consentito - consulenza in corso'
      });
    }

    // Altrimenti nega l'accesso e fornisci info sulla prossima consulenza
    const days = Math.floor(minutesDiff / (60 * 24));
    const hours = Math.floor((minutesDiff % (60 * 24)) / 60);
    const minutes = minutesDiff % 60;

    let timeUntil = '';
    if (days > 0) timeUntil += `${days} ${days === 1 ? 'giorno' : 'giorni'}`;
    if (hours > 0) timeUntil += `${timeUntil ? ', ' : ''}${hours} ${hours === 1 ? 'ora' : 'ore'}`;
    if (minutes > 0 && days === 0) timeUntil += `${timeUntil ? ', ' : ''}${minutes} ${minutes === 1 ? 'minuto' : 'minuti'}`;

    return res.json({
      canAccess: false,
      reason: 'too_early',
      consultationId: upcomingConsultation.id,
      nextScheduled: upcomingConsultation.scheduledFor,
      timeUntil,
      message: `La prossima consulenza è ${timeUntil ? 'tra ' + timeUntil : 'a breve'}`
    });

  } catch (error) {
    console.error('Error checking consultation access:', error);
    res.status(500).json({ error: 'Errore durante la verifica dell\'accesso' });
  }
});

/**
 * GET /api/consultations/ai/upcoming
 * 
 * Ottiene le prossime consulenze programmate per il cliente
 */
router.get('/upcoming', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;

    const upcoming = await db.select()
      .from(aiWeeklyConsultations)
      .where(
        and(
          eq(aiWeeklyConsultations.clientId, userId),
          gte(aiWeeklyConsultations.scheduledFor, new Date())
        )
      )
      .orderBy(aiWeeklyConsultations.scheduledFor)
      .limit(5);

    res.json(upcoming);
  } catch (error) {
    console.error('Error fetching upcoming consultations:', error);
    res.status(500).json({ error: 'Errore durante il caricamento delle consulenze' });
  }
});

/**
 * GET /api/consultations/ai/history
 * 
 * Ottiene lo storico delle consulenze completate
 */
router.get('/history', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;

    const history = await db.select()
      .from(aiWeeklyConsultations)
      .where(
        and(
          eq(aiWeeklyConsultations.clientId, userId),
          eq(aiWeeklyConsultations.status, 'completed')
        )
      )
      .orderBy(desc(aiWeeklyConsultations.completedAt))
      .limit(20);

    res.json(history);
  } catch (error) {
    console.error('Error fetching consultation history:', error);
    res.status(500).json({ error: 'Errore durante il caricamento dello storico' });
  }
});

/**
 * POST /api/consultations/ai/create
 * 
 * Crea una nuova consulenza AI settimanale (solo per consultants)
 */
router.post('/create', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const consultantId = req.user!.id;
    const { clientId, scheduledFor, maxDurationMinutes, isTestMode } = req.body;

    if (req.user!.role !== 'consultant') {
      return res.status(403).json({ error: 'Solo i consulenti possono creare consulenze AI' });
    }

    if (!clientId || !scheduledFor) {
      return res.status(400).json({ error: 'clientId e scheduledFor sono obbligatori' });
    }

    // Crea la nuova consulenza
    const newConsultation = await db.insert(aiWeeklyConsultations).values({
      clientId,
      consultantId,
      scheduledFor: new Date(scheduledFor),
      status: 'scheduled',
      isTestMode: isTestMode || false,
      maxDurationMinutes: maxDurationMinutes || 90
    }).returning();

    res.status(201).json(newConsultation[0]);
  } catch (error) {
    console.error('Error creating AI consultation:', error);
    res.status(500).json({ error: 'Errore durante la creazione della consulenza' });
  }
});

/**
 * GET /api/consultations/ai/all
 * 
 * Ottiene tutte le consulenze AI per il consulente (raggruppate per cliente)
 * Include flag isActive per mostrare badge "In Corso" per sessioni attive
 */
router.get('/all', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const consultantId = req.user!.id;

    if (req.user!.role !== 'consultant') {
      return res.status(403).json({ error: 'Solo i consulenti possono visualizzare tutte le consulenze' });
    }

    // Ottieni tutte le consulenze del consulente con JOIN su users per info cliente
    const consultations = await db.select({
      id: aiWeeklyConsultations.id,
      clientId: aiWeeklyConsultations.clientId,
      scheduledFor: aiWeeklyConsultations.scheduledFor,
      status: aiWeeklyConsultations.status,
      isTestMode: aiWeeklyConsultations.isTestMode,
      maxDurationMinutes: aiWeeklyConsultations.maxDurationMinutes,
      completedAt: aiWeeklyConsultations.completedAt,
      aiConversationId: aiWeeklyConsultations.aiConversationId,
      transcript: aiWeeklyConsultations.transcript,
      clientFirstName: users.firstName,
      clientLastName: users.lastName,
      clientEmail: users.email
    })
    .from(aiWeeklyConsultations)
    .leftJoin(users, eq(aiWeeklyConsultations.clientId, users.id))
    .where(eq(aiWeeklyConsultations.consultantId, consultantId))
    .orderBy(desc(aiWeeklyConsultations.scheduledFor));

    // Aggiungi flag isActive per ogni consulenza
    const consultationsWithActivity = consultations.map(consultation => ({
      ...consultation,
      isActive: isConsultationActive(consultation.id)
    }));

    res.json(consultationsWithActivity);
  } catch (error) {
    console.error('Error fetching all consultations:', error);
    res.status(500).json({ error: 'Errore durante il caricamento delle consulenze' });
  }
});

/**
 * DELETE /api/consultations/ai/:id
 * 
 * Elimina una consulenza AI (solo se non completata)
 */
router.delete('/:id', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const consultantId = req.user!.id;
    const consultationId = req.params.id;

    if (req.user!.role !== 'consultant') {
      return res.status(403).json({ error: 'Solo i consulenti possono eliminare consulenze' });
    }

    // Verifica che la consulenza appartenga al consulente
    const consultation = await db.select()
      .from(aiWeeklyConsultations)
      .where(
        and(
          eq(aiWeeklyConsultations.id, consultationId),
          eq(aiWeeklyConsultations.consultantId, consultantId)
        )
      )
      .limit(1);

    if (consultation.length === 0) {
      return res.status(404).json({ error: 'Consulenza non trovata' });
    }

    // Elimina la consulenza
    await db.delete(aiWeeklyConsultations)
      .where(eq(aiWeeklyConsultations.id, consultationId));

    res.json({ message: 'Consulenza eliminata con successo' });
  } catch (error) {
    console.error('Error deleting consultation:', error);
    res.status(500).json({ error: 'Errore durante l\'eliminazione della consulenza' });
  }
});

/**
 * POST /api/consultations/ai/create-test
 * 
 * Crea una consulenza di test per sviluppo (solo per testing)
 */
router.post('/create-test', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const consultantId = req.user!.consultantId;

    if (!consultantId) {
      return res.status(403).json({ error: 'No consultant assigned' });
    }

    // Crea consulenza di test programmata per ora
    const newConsultation = await db.insert(aiWeeklyConsultations).values({
      clientId: userId,
      consultantId: consultantId,
      scheduledFor: new Date(), // Ora
      status: 'scheduled',
      isTestMode: true,
      maxDurationMinutes: 90
    }).returning();

    res.json(newConsultation[0]);
  } catch (error) {
    console.error('Error creating test consultation:', error);
    res.status(500).json({ error: 'Errore durante la creazione della consulenza di test' });
  }
});

/**
 * PATCH /api/consultations/ai/:id/autosave
 * 
 * Auto-salva la trascrizione di una consulenza in corso
 * - Solo il client proprietario può salvare
 * - Solo se status è "scheduled" o "in_progress" (a meno che non sia flush finale)
 * - Aggiorna solo il campo transcript senza modificare status
 * - updatedAt viene aggiornato automaticamente
 * 
 * Flag isFinalFlush:
 * - Se true: bypassa validazione status per permettere salvataggio finale su consulenze chiuse
 * - Se false/undefined: applica validazione status normale (blocca autosave su completed/cancelled)
 */
router.patch('/:id/autosave', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const consultationId = req.params.id;
    const { transcript, isFinalFlush } = req.body;

    if (!transcript || typeof transcript !== 'string') {
      return res.status(400).json({ error: 'Campo transcript obbligatorio' });
    }

    // Verifica che la consulenza esista e appartenga al client
    const consultation = await db.select()
      .from(aiWeeklyConsultations)
      .where(eq(aiWeeklyConsultations.id, consultationId))
      .limit(1);

    if (consultation.length === 0) {
      return res.status(404).json({ error: 'Consulenza non trovata' });
    }

    const consultationData = consultation[0];

    // Verifica che l'utente sia il proprietario (client)
    if (consultationData.clientId !== userId) {
      return res.status(403).json({ error: 'Non autorizzato a modificare questa consulenza' });
    }

    // 🔒 VALIDAZIONE STATUS: Bypassa se è flush finale
    if (!isFinalFlush) {
      // Autosave periodico: applica validazione status
      if (consultationData.status === 'completed') {
        console.log(`🛑 [AUTOSAVE] Autosave periodico bloccato su consulenza completed (${consultationId})`);
        return res.status(409).json({ error: 'La consulenza è già stata completata' });
      }

      if (consultationData.status === 'cancelled') {
        console.log(`🛑 [AUTOSAVE] Autosave periodico bloccato su consulenza cancelled (${consultationId})`);
        return res.status(409).json({ error: 'La consulenza è stata cancellata' });
      }
      
      console.log(`💾 [AUTOSAVE] Autosave periodico su consulenza ${consultationData.status} (${consultationId})`);
    } else {
      // Flush finale: bypassa validazione status
      console.log(`💾 [FINAL FLUSH] Flush finale su consulenza ${consultationData.status} (${consultationId}) - validazione status bypassata ✅`);
    }

    // Aggiorna solo il campo transcript
    // updatedAt viene aggiornato automaticamente dal database
    const updated = await db.update(aiWeeklyConsultations)
      .set({ 
        transcript,
        updatedAt: new Date() // Aggiornamento esplicito del timestamp
      })
      .where(eq(aiWeeklyConsultations.id, consultationId))
      .returning();

    res.json({ 
      success: true, 
      message: isFinalFlush ? 'Flush finale completato' : 'Trascrizione salvata',
      updatedAt: updated[0].updatedAt,
      isFinalFlush: !!isFinalFlush
    });
  } catch (error) {
    console.error('Error auto-saving consultation transcript:', error);
    res.status(500).json({ error: 'Errore durante il salvataggio della trascrizione' });
  }
});

/**
 * PATCH /api/consultations/ai/:id/end-session
 * 
 * Termina una consulenza AI e imposta lo status finale in base al motivo di chiusura
 * - reason: 'manual' → Chiusura manuale dall'utente (pulsante Phone/X) → status = 'cancelled'
 * - reason: 'auto_90min' → Chiusura intelligente a 90 minuti → status = 'completed'
 * - reason: 'error' → Chiusura per errore → status = 'cancelled'
 * 
 * CRITICO: Questo endpoint viene chiamato DOPO il flush finale della trascrizione
 * in modo che l'autosave possa salvare anche per sessioni chiuse manualmente
 */
router.patch('/:id/end-session', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const consultationId = req.params.id;
    const { reason } = req.body;

    // Validazione del parametro reason
    const validReasons = ['manual', 'auto_90min', 'error'];
    if (!reason || !validReasons.includes(reason)) {
      return res.status(400).json({ 
        error: 'Campo reason obbligatorio',
        validValues: validReasons
      });
    }

    // Verifica che la consulenza esista e appartenga al client
    const consultation = await db.select()
      .from(aiWeeklyConsultations)
      .where(eq(aiWeeklyConsultations.id, consultationId))
      .limit(1);

    if (consultation.length === 0) {
      return res.status(404).json({ error: 'Consulenza non trovata' });
    }

    const consultationData = consultation[0];

    // Verifica che l'utente sia il proprietario (client)
    if (consultationData.clientId !== userId) {
      return res.status(403).json({ error: 'Non autorizzato a modificare questa consulenza' });
    }

    // Determina lo status finale in base al motivo
    let finalStatus: 'completed' | 'cancelled';
    
    if (reason === 'auto_90min') {
      // Chiusura intelligente a 90 minuti: consulenza completata normalmente
      finalStatus = 'completed';
      console.log(`✅ [END SESSION] Consultation ${consultationId} completed (intelligent 90-min close)`);
    } else {
      // Chiusura manuale o per errore: consulenza cancellata/interrotta
      finalStatus = 'cancelled';
      console.log(`🛑 [END SESSION] Consultation ${consultationId} cancelled (reason: ${reason})`);
    }

    // Aggiorna lo status e il timestamp di completamento
    const updated = await db.update(aiWeeklyConsultations)
      .set({ 
        status: finalStatus,
        completedAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(aiWeeklyConsultations.id, consultationId))
      .returning();

    res.json({ 
      success: true, 
      message: `Consulenza ${finalStatus === 'completed' ? 'completata' : 'terminata'}`,
      status: finalStatus,
      completedAt: updated[0].completedAt
    });
  } catch (error) {
    console.error('Error ending consultation session:', error);
    res.status(500).json({ error: 'Errore durante la chiusura della sessione' });
  }
});

export default router;
