import { Router } from "express";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { storage } from "../../storage";

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

/**
 * GET /public/invite/:token
 * Public endpoint (no auth required) to fetch consultation invite details and agent info
 * Used by prospect lobby page before joining live consultation
 * Tracks access count automatically
 */
router.get("/:token", async (req, res) => {
  try {
    const { token } = req.params;

    console.log(`[PublicInvite] Fetching invite for token: ${token}`);

    // Get invite by token
    const invite = await storage.getConsultationInviteByToken(token);

    if (!invite) {
      return res.status(404).json({ message: "Invito non trovato o non valido" });
    }

    // Check invite status - WHITELIST: only "pending" and "active" are accessible
    if (invite.status !== 'pending' && invite.status !== 'active') {
      // Return user-friendly messages for known states
      if (invite.status === 'revoked') {
        return res.status(403).json({ message: "Questo invito è stato revocato" });
      }
      if (invite.status === 'expired') {
        return res.status(410).json({ message: "Questo invito è scaduto" });
      }
      if (invite.status === 'used') {
        return res.status(410).json({ message: "Questo invito è già stato utilizzato" });
      }
      // Catch-all for any other non-active states
      return res.status(403).json({ message: "Questo invito non è più valido" });
    }

    // Get agent details
    const agent = await storage.getClientSalesAgentById(invite.agentId);

    if (!agent) {
      return res.status(404).json({ message: "Agente non trovato" });
    }

    // Check if agent is active
    if (!agent.isActive) {
      return res.status(404).json({ message: "Questo consulente non è più attivo" });
    }

    // Track access AFTER all validations pass (only successful accesses count)
    await storage.trackConsultationInviteAccess(token);

    console.log(`[PublicInvite] Invite found: ${invite.consultantName} for ${invite.prospectName || 'prospect'}`);

    // Return public-safe data (conversationId excluded - provided only on join)
    const responseData = {
      // Invite details
      inviteToken: invite.inviteToken,
      consultantName: invite.consultantName,
      prospectName: invite.prospectName,
      prospectEmail: invite.prospectEmail,
      prospectPhone: invite.prospectPhone,
      status: invite.status,
      
      // Agent details (for display in lobby)
      agent: {
        agentName: agent.agentName,
        displayName: agent.displayName,
        businessName: agent.businessName,
        businessDescription: agent.businessDescription,
        consultantBio: agent.consultantBio,
        vision: agent.vision,
        mission: agent.mission,
        values: agent.values,
        usp: agent.usp,
        targetClient: agent.targetClient,
        whatWeDo: agent.whatWeDo,
        howWeDoIt: agent.howWeDoIt,
        yearsExperience: agent.yearsExperience,
        clientsHelped: agent.clientsHelped,
        resultsGenerated: agent.resultsGenerated,
        servicesOffered: agent.servicesOffered,
        guarantees: agent.guarantees,
      },
    };

    res.json(responseData);
  } catch (error: any) {
    console.error(`[PublicInvite] Error:`, error);
    res.status(500).json({
      message: "Errore durante il recupero dell'invito",
      error: error.message
    });
  }
});

/**
 * POST /public/invite/:token/join
 * Public endpoint (no auth required) to join/resume a consultation via invite link
 * Creates new conversation if first join, or resumes existing conversation
 */
router.post("/:token/join", async (req, res) => {
  try {
    const { token } = req.params;

    console.log(`[PublicInvite] Join request for token: ${token}`);

    const joinSchema = z.object({
      prospectName: z.string().min(1, "Nome richiesto"),
      prospectEmail: z.string().email().optional().or(z.literal('')),
      prospectPhone: z.string().optional(),
    });

    const validationResult = joinSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        message: "Dati non validi",
        errors: validationResult.error.errors.map(e => `${e.path.join('.')}: ${e.message}`)
      });
    }

    const { prospectName, prospectEmail, prospectPhone } = validationResult.data;

    const invite = await storage.getConsultationInviteByToken(token);

    if (!invite) {
      return res.status(404).json({ message: "Invito non trovato" });
    }

    if (invite.status !== 'pending' && invite.status !== 'active') {
      if (invite.status === 'revoked') {
        return res.status(403).json({ message: "Questo invito è stato revocato" });
      }
      if (invite.status === 'expired') {
        return res.status(410).json({ message: "Questo invito è scaduto" });
      }
      return res.status(403).json({ message: "Questo invito non è più valido" });
    }

    const agent = await storage.getClientSalesAgentById(invite.agentId);

    if (!agent) {
      return res.status(404).json({ message: "Agente non trovato" });
    }

    if (!agent.isActive) {
      return res.status(404).json({ message: "Questo consulente non è più attivo" });
    }

    let conversation;

    if (invite.conversationId) {
      conversation = await storage.getClientSalesConversationById(invite.conversationId);
      if (!conversation) {
        console.warn(`[PublicInvite] Invite has conversationId ${invite.conversationId} but conversation not found, creating new one`);
        conversation = await storage.createClientSalesConversation({
          agentId: agent.id,
          prospectName: prospectName.trim(),
          prospectEmail: prospectEmail?.trim() || null,
          prospectPhone: prospectPhone?.trim() || null,
          currentPhase: 'discovery',
          collectedData: {},
          objectionsRaised: [],
          outcome: 'pending',
        });
      } else {
        console.log(`[PublicInvite] Resuming existing conversation ${conversation.id}`);
      }
    } else {
      conversation = await storage.createClientSalesConversation({
        agentId: agent.id,
        prospectName: prospectName.trim(),
        prospectEmail: prospectEmail?.trim() || null,
        prospectPhone: prospectPhone?.trim() || null,
        currentPhase: 'discovery',
        collectedData: {},
        objectionsRaised: [],
        outcome: 'pending',
      });

      console.log(`[PublicInvite] Created new conversation ${conversation.id}`);
    }

    await storage.updateConsultationInvite(token, {
      prospectName: prospectName.trim(),
      prospectEmail: prospectEmail?.trim() || null,
      prospectPhone: prospectPhone?.trim() || null,
      conversationId: conversation.id,
      status: 'active',
    });

    const sessionToken = jwt.sign(
      {
        type: 'consultation_invite_session',
        conversationId: conversation.id,
        agentId: agent.id,
        inviteToken: token,
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    console.log(`[PublicInvite] Join successful for ${prospectName}, conversation ${conversation.id}`);

    res.json({
      conversationId: conversation.id,
      sessionToken: sessionToken,
      consultantName: invite.consultantName,
      displayName: agent.displayName,
    });
  } catch (error: any) {
    console.error(`[PublicInvite] Join error:`, error);

    if (error instanceof z.ZodError) {
      return res.status(400).json({
        message: "Dati non validi",
        errors: error.errors
      });
    }

    res.status(500).json({
      message: "Errore durante l'accesso alla consultazione",
      error: error.message
    });
  }
});

export default router;
