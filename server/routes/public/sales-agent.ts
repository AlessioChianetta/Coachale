import { Router } from "express";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { storage } from "../../storage";

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Zod schema for POST /session validation
const createSessionSchema = z.object({
  prospectName: z.string().min(1, "prospectName è obbligatorio"),
  prospectEmail: z.string().email("Email non valida").optional().nullable(),
  prospectPhone: z.string().optional().nullable(),
});

/**
 * GET /public/sales-agent/:shareToken
 * Public endpoint (no auth required) to fetch sales agent config by share token
 * Used by prospect landing page
 */
router.get("/:shareToken", async (req, res) => {
  try {
    const { shareToken } = req.params;

    console.log(`[PublicSalesAgent] Fetching agent for shareToken: ${shareToken}`);

    // Get agent by share token
    const agent = await storage.getClientSalesAgentByShareToken(shareToken);

    if (!agent) {
      return res.status(404).json({ message: "Sales agent non trovato" });
    }

    // Check if agent is active
    if (!agent.isActive) {
      return res.status(404).json({ message: "Questo agente di vendita non è più attivo" });
    }

    // Return only public-safe data (exclude internal fields: id, clientId, consultantId)
    const publicData = {
      agentName: agent.agentName,
      displayName: agent.displayName,
      businessName: agent.businessName,
      businessDescription: agent.businessDescription,
      consultantBio: agent.consultantBio,
      
      // Authority & positioning
      vision: agent.vision,
      mission: agent.mission,
      values: agent.values,
      usp: agent.usp,
      targetClient: agent.targetClient,
      nonTargetClient: agent.nonTargetClient,
      whatWeDo: agent.whatWeDo,
      howWeDoIt: agent.howWeDoIt,
      
      // Credentials
      yearsExperience: agent.yearsExperience,
      clientsHelped: agent.clientsHelped,
      resultsGenerated: agent.resultsGenerated,
      softwareCreated: agent.softwareCreated,
      booksPublished: agent.booksPublished,
      caseStudies: agent.caseStudies,
      
      // Services
      servicesOffered: agent.servicesOffered,
      guarantees: agent.guarantees,
      
      // Modes (what the agent can do)
      enableDiscovery: agent.enableDiscovery,
      enableDemo: agent.enableDemo,
      enablePayment: agent.enablePayment,
      
      // Public metadata
      isActive: agent.isActive,
    };

    console.log(`[PublicSalesAgent] Agent found: ${agent.agentName} (${agent.id})`);

    res.json(publicData);
  } catch (error: any) {
    console.error(`[PublicSalesAgent] Error:`, error);
    res.status(500).json({
      message: "Errore durante il recupero dell'agente",
      error: error.message
    });
  }
});

/**
 * POST /public/sales-agent/:shareToken/session
 * Public endpoint (no auth required) to create a new sales conversation session
 * Used by prospect to start a Live Mode conversation
 */
router.post("/:shareToken/session", async (req, res) => {
  try {
    const { shareToken } = req.params;

    console.log(`[PublicSalesAgent] Creating session for shareToken: ${shareToken}`);

    // Validate input with Zod
    const validationResult = createSessionSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({ 
        message: "Dati non validi",
        errors: validationResult.error.errors.map(e => `${e.path.join('.')}: ${e.message}`)
      });
    }

    const { prospectName, prospectEmail, prospectPhone } = validationResult.data;

    // Get agent by share token
    const agent = await storage.getClientSalesAgentByShareToken(shareToken);

    if (!agent) {
      return res.status(404).json({ message: "Sales agent non trovato" });
    }

    // Check if agent is active
    if (!agent.isActive) {
      return res.status(404).json({ message: "Questo agente di vendita non è più attivo" });
    }

    console.log(`[PublicSalesAgent] Agent found: ${agent.agentName} (${agent.id})`);

    // Create conversation record
    const conversation = await storage.createClientSalesConversation({
      agentId: agent.id,
      prospectName: prospectName.trim(),
      prospectEmail: prospectEmail?.trim() || null,
      prospectPhone: prospectPhone?.trim() || null,
      currentPhase: 'discovery',
      collectedData: {},
      objectionsRaised: [],
      outcome: 'pending',
    });

    console.log(`[PublicSalesAgent] Conversation created: ${conversation.id}`);
    
    // Generate JWT sessionToken for WebSocket authentication
    const sessionToken = jwt.sign(
      {
        type: 'sales_agent_session',
        conversationId: conversation.id,
        agentId: agent.id,
        shareToken: shareToken,
      },
      JWT_SECRET,
      { expiresIn: '24h' } // Session valid for 24 hours
    );

    console.log(`[PublicSalesAgent] Session created successfully for ${prospectName}`);

    // Return response with sessionToken for WebSocket authentication
    res.json({
      conversationId: conversation.id,
      sessionToken: sessionToken,
      agentName: agent.agentName,
      displayName: agent.displayName,
    });
  } catch (error: any) {
    console.error(`[PublicSalesAgent] Error creating session:`, error);
    
    // Handle Zod validation errors
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        message: "Dati non validi",
        errors: error.errors.map(e => `${e.path.join('.')}: ${e.message}`)
      });
    }
    
    res.status(500).json({
      message: "Errore durante la creazione della sessione",
      error: error.message
    });
  }
});

export default router;
