import { Router, Response } from "express";
import { db } from "../db";
import { 
  consultantWhatsappConfig, 
  agentClientAssignments,
  aiAssistantPreferences,
  users,
  aiConversations,
  clientLevelSubscriptions
} from "../../shared/schema";
import { eq, and, inArray, desc } from "drizzle-orm";
import { AuthRequest, authenticateToken, requireRole } from "../middleware/auth";
import { buildWhatsAppAgentPrompt } from "../whatsapp/agent-consultant-chat-service";
import { conversationMemoryService } from "../services/conversation-memory/memory-service";
import { getSuperAdminGeminiKeys } from "../ai/provider-factory";
import { syncDynamicDocuments, previewDynamicDocuments } from "../ai/dynamic-context-documents";

const router = Router();

router.get("/consultant/agents-for-assistant", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res: Response) => {
  try {
    const consultantId = req.user!.id;
    
    const agents = await db.select({
      id: consultantWhatsappConfig.id,
      name: consultantWhatsappConfig.agentName,
      businessName: consultantWhatsappConfig.businessName,
      agentType: consultantWhatsappConfig.agentType,
      aiPersonality: consultantWhatsappConfig.aiPersonality,
      enableInAIAssistant: consultantWhatsappConfig.enableInAIAssistant,
      fileSearchCategories: consultantWhatsappConfig.fileSearchCategories,
    })
    .from(consultantWhatsappConfig)
    .where(and(
      eq(consultantWhatsappConfig.consultantId, consultantId),
      eq(consultantWhatsappConfig.enableInAIAssistant, true)
    ));

    res.json(agents);
  } catch (error) {
    console.error("[AI Assistant] Error fetching consultant agents:", error);
    res.status(500).json({ error: "Failed to fetch agents" });
  }
});

router.get("/client/agents-for-assistant", authenticateToken, requireRole("client"), async (req: AuthRequest, res: Response) => {
  try {
    const clientId = req.user!.id;
    const userType = (req.user as any)?.type;
    const subscriptionId = (req.user as any)?.subscriptionId;
    
    // Determine client's subscription level from clientLevelSubscriptions
    let tierLevel: string = "3"; // Default to Gold for clients (role=client implies Gold)
    const [subscription] = await db.select({ level: clientLevelSubscriptions.level })
      .from(clientLevelSubscriptions)
      .where(eq(clientLevelSubscriptions.clientId, clientId))
      .limit(1);
    
    if (subscription) {
      tierLevel = subscription.level; // "2" = Silver, "3" = Gold, "4" = Deluxe
    }
    
    console.log(`[AI Assistant] Fetching agents for client - clientId: ${clientId}, type: ${userType}, subscriptionId: ${subscriptionId}, tierLevel: ${tierLevel}`);
    
    const assignments = await db.select({
      agentId: agentClientAssignments.agentConfigId,
    })
    .from(agentClientAssignments)
    .where(and(
      eq(agentClientAssignments.clientId, clientId),
      eq(agentClientAssignments.isActive, true)
    ));

    console.log(`[AI Assistant] Found ${assignments.length} assignments for clientId: ${clientId}`);

    if (assignments.length === 0) {
      console.log(`[AI Assistant] No assignments found - returning empty array`);
      return res.json([]);
    }

    const agentIds = assignments.map(a => a.agentId);
    
    const agents = await db.select({
      id: consultantWhatsappConfig.id,
      name: consultantWhatsappConfig.agentName,
      businessName: consultantWhatsappConfig.businessName,
      agentType: consultantWhatsappConfig.agentType,
      aiPersonality: consultantWhatsappConfig.aiPersonality,
      fileSearchCategories: consultantWhatsappConfig.fileSearchCategories,
      consultantId: consultantWhatsappConfig.consultantId,
      publicSlug: consultantWhatsappConfig.publicSlug,
      levels: consultantWhatsappConfig.levels,
    })
    .from(consultantWhatsappConfig)
    .where(inArray(consultantWhatsappConfig.id, agentIds));

    // Filter agents by tier: only agents with levels configured are visible
    // Gold/Deluxe sees all agents with levels, Bronze/Silver only their tier
    const filteredAgents = agents.filter(agent => {
      // Agents without levels are not visible to anyone
      if (!agent.levels || agent.levels.length === 0) {
        return false;
      }
      // Gold/Deluxe sees all agents with levels configured
      if (tierLevel === "3" || tierLevel === "4") {
        return true;
      }
      // Silver sees agents with level "2" configured
      if (tierLevel === "2") {
        return agent.levels.includes("2");
      }
      // Bronze sees agents with level "1" configured
      return agent.levels.includes("1");
    });
    
    console.log(`[AI Assistant] Tier ${tierLevel}: filtered ${filteredAgents.length}/${agents.length} agents`);

    // Return without the levels field to keep response clean
    const responseAgents = filteredAgents.map(({ levels, ...rest }) => rest);
    res.json(responseAgents);
  } catch (error) {
    console.error("[AI Assistant] Error fetching client agents:", error);
    res.status(500).json({ error: "Failed to fetch agents" });
  }
});

router.get("/agent/:agentId/client-assignments", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res: Response) => {
  try {
    const { agentId } = req.params;
    const consultantId = req.user!.id;

    const agent = await db.select().from(consultantWhatsappConfig)
      .where(and(
        eq(consultantWhatsappConfig.id, agentId),
        eq(consultantWhatsappConfig.consultantId, consultantId)
      ))
      .limit(1);

    if (agent.length === 0) {
      return res.status(404).json({ error: "Agent not found" });
    }

    const assignments = await db.select({
      id: agentClientAssignments.id,
      clientId: agentClientAssignments.clientId,
      assignedAt: agentClientAssignments.assignedAt,
      isActive: agentClientAssignments.isActive,
      clientFirstName: users.firstName,
      clientLastName: users.lastName,
      clientEmail: users.email,
    })
    .from(agentClientAssignments)
    .innerJoin(users, eq(agentClientAssignments.clientId, users.id))
    .where(eq(agentClientAssignments.agentConfigId, agentId));
    
    const formattedAssignments = assignments.map(a => ({
      ...a,
      clientName: `${a.clientFirstName} ${a.clientLastName}`.trim(),
    }));

    res.json(formattedAssignments);
  } catch (error) {
    console.error("[AI Assistant] Error fetching client assignments:", error);
    res.status(500).json({ error: "Failed to fetch assignments" });
  }
});

router.post("/agent/:agentId/client-assignments", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res: Response) => {
  try {
    const { agentId } = req.params;
    const { clientIds } = req.body as { clientIds: string[] };
    const consultantId = req.user!.id;

    const agent = await db.select().from(consultantWhatsappConfig)
      .where(and(
        eq(consultantWhatsappConfig.id, agentId),
        eq(consultantWhatsappConfig.consultantId, consultantId)
      ))
      .limit(1);

    if (agent.length === 0) {
      return res.status(404).json({ error: "Agent not found" });
    }

    const existingAssignments = await db.select()
      .from(agentClientAssignments)
      .where(eq(agentClientAssignments.agentConfigId, agentId));
    
    const existingClientIds = existingAssignments.map(a => a.clientId);

    const toAdd = clientIds.filter(id => !existingClientIds.includes(id));
    const toRemove = existingClientIds.filter(id => !clientIds.includes(id));

    if (toAdd.length > 0) {
      await db.insert(agentClientAssignments).values(
        toAdd.map(clientId => ({
          agentConfigId: agentId,
          clientId,
          isActive: true,
        }))
      ).onConflictDoUpdate({
        target: [agentClientAssignments.agentConfigId, agentClientAssignments.clientId],
        set: { isActive: true },
      });
    }

    if (toRemove.length > 0) {
      for (const clientId of toRemove) {
        await db.delete(agentClientAssignments)
          .where(and(
            eq(agentClientAssignments.agentConfigId, agentId),
            eq(agentClientAssignments.clientId, clientId)
          ));
      }
    }

    res.json({ success: true, added: toAdd.length, removed: toRemove.length });
  } catch (error) {
    console.error("[AI Assistant] Error updating client assignments:", error);
    res.status(500).json({ error: "Failed to update assignments" });
  }
});

router.patch("/agent/:agentId/ai-assistant-settings", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res: Response) => {
  try {
    const { agentId } = req.params;
    const { enableInAIAssistant, fileSearchCategories } = req.body;
    const consultantId = req.user!.id;

    const agent = await db.select().from(consultantWhatsappConfig)
      .where(and(
        eq(consultantWhatsappConfig.id, agentId),
        eq(consultantWhatsappConfig.consultantId, consultantId)
      ))
      .limit(1);

    if (agent.length === 0) {
      return res.status(404).json({ error: "Agent not found" });
    }

    const updates: any = { updatedAt: new Date() };
    if (enableInAIAssistant !== undefined) updates.enableInAIAssistant = enableInAIAssistant;
    if (fileSearchCategories !== undefined) updates.fileSearchCategories = fileSearchCategories;

    await db.update(consultantWhatsappConfig)
      .set(updates)
      .where(eq(consultantWhatsappConfig.id, agentId));

    res.json({ success: true });
  } catch (error) {
    console.error("[AI Assistant] Error updating agent settings:", error);
    res.status(500).json({ error: "Failed to update settings" });
  }
});

router.get("/preferences", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const userRole = req.user!.role;

    const [prefs] = await db.select()
      .from(aiAssistantPreferences)
      .where(eq(aiAssistantPreferences.userId, userId))
      .limit(1);

    // For clients, also fetch consultant's default instructions
    let consultantDefaultInstructions: string | null = null;
    if (userRole === "client") {
      const [user] = await db.select({ consultantId: users.consultantId })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);
      
      if (user?.consultantId) {
        const [consultantPrefs] = await db.select({ defaultSystemInstructions: aiAssistantPreferences.defaultSystemInstructions })
          .from(aiAssistantPreferences)
          .where(eq(aiAssistantPreferences.userId, user.consultantId))
          .limit(1);
        consultantDefaultInstructions = consultantPrefs?.defaultSystemInstructions || null;
      }
    }

    if (!prefs) {
      return res.json({
        writingStyle: "eccentric",
        responseLength: "balanced",
        customInstructions: null,
        defaultSystemInstructions: null,
        consultantDefaultInstructions,
        preferredModel: "gemini-3-flash-preview",
        thinkingLevel: "none",
      });
    }

    res.json({
      writingStyle: prefs.writingStyle,
      responseLength: prefs.responseLength,
      customInstructions: prefs.customInstructions,
      defaultSystemInstructions: prefs.defaultSystemInstructions,
      consultantDefaultInstructions,
      preferredModel: prefs.preferredModel || "gemini-3-flash-preview",
      thinkingLevel: prefs.thinkingLevel || "none",
    });
  } catch (error) {
    console.error("[AI Assistant] Error fetching preferences:", error);
    res.status(500).json({ error: "Failed to fetch preferences" });
  }
});

router.put("/preferences", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { writingStyle, responseLength, customInstructions, defaultSystemInstructions, preferredModel, thinkingLevel } = req.body;

    const [existing] = await db.select()
      .from(aiAssistantPreferences)
      .where(eq(aiAssistantPreferences.userId, userId))
      .limit(1);

    if (existing) {
      await db.update(aiAssistantPreferences)
        .set({
          writingStyle: writingStyle || "eccentric",
          responseLength: responseLength || "balanced",
          customInstructions: customInstructions || null,
          defaultSystemInstructions: defaultSystemInstructions !== undefined ? defaultSystemInstructions : existing.defaultSystemInstructions,
          preferredModel: preferredModel !== undefined ? preferredModel : existing.preferredModel,
          thinkingLevel: thinkingLevel !== undefined ? thinkingLevel : existing.thinkingLevel,
          updatedAt: new Date(),
        })
        .where(eq(aiAssistantPreferences.userId, userId));
    } else {
      await db.insert(aiAssistantPreferences).values({
        userId,
        writingStyle: writingStyle || "eccentric",
        responseLength: responseLength || "balanced",
        customInstructions: customInstructions || null,
        defaultSystemInstructions: defaultSystemInstructions || null,
        preferredModel: preferredModel || "gemini-3-flash-preview",
        thinkingLevel: thinkingLevel || "none",
      });
    }

    res.json({ success: true });
  } catch (error) {
    console.error("[AI Assistant] Error updating preferences:", error);
    res.status(500).json({ error: "Failed to update preferences" });
  }
});

router.get("/consultant/clients", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res: Response) => {
  try {
    const consultantId = req.user!.id;

    const clients = await db.select({
      id: users.id,
      firstName: users.firstName,
      lastName: users.lastName,
      email: users.email,
    })
    .from(users)
    .where(and(
      eq(users.consultantId, consultantId),
      eq(users.role, "client")
    ));

    const formattedClients = clients.map(c => ({
      id: c.id,
      displayName: `${c.firstName} ${c.lastName}`.trim(),
      email: c.email,
    }));

    res.json(formattedClients);
  } catch (error) {
    console.error("[AI Assistant] Error fetching clients:", error);
    res.status(500).json({ error: "Failed to fetch clients" });
  }
});

// Get AI preferences for a specific client (consultant only)
router.get("/consultant/client/:clientId/preferences", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res: Response) => {
  try {
    const consultantId = req.user!.id;
    const { clientId } = req.params;

    // Verify client belongs to this consultant
    const [client] = await db.select()
      .from(users)
      .where(and(
        eq(users.id, clientId),
        eq(users.consultantId, consultantId),
        eq(users.role, "client")
      ))
      .limit(1);

    if (!client) {
      return res.status(404).json({ error: "Client not found or not authorized" });
    }

    const [prefs] = await db.select()
      .from(aiAssistantPreferences)
      .where(eq(aiAssistantPreferences.userId, clientId))
      .limit(1);

    if (!prefs) {
      return res.json({
        writingStyle: "eccentric",
        responseLength: "balanced",
        customInstructions: null,
      });
    }

    res.json({
      writingStyle: prefs.writingStyle,
      responseLength: prefs.responseLength,
      customInstructions: prefs.customInstructions,
    });
  } catch (error) {
    console.error("[AI Assistant] Error fetching client preferences:", error);
    res.status(500).json({ error: "Failed to fetch client preferences" });
  }
});

// Update AI preferences for a specific client (consultant only)
router.put("/consultant/client/:clientId/preferences", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res: Response) => {
  try {
    const consultantId = req.user!.id;
    const { clientId } = req.params;
    const { writingStyle, responseLength, customInstructions } = req.body;

    // Verify client belongs to this consultant
    const [client] = await db.select()
      .from(users)
      .where(and(
        eq(users.id, clientId),
        eq(users.consultantId, consultantId),
        eq(users.role, "client")
      ))
      .limit(1);

    if (!client) {
      return res.status(404).json({ error: "Client not found or not authorized" });
    }

    const [existing] = await db.select()
      .from(aiAssistantPreferences)
      .where(eq(aiAssistantPreferences.userId, clientId))
      .limit(1);

    if (existing) {
      await db.update(aiAssistantPreferences)
        .set({
          writingStyle: writingStyle || "eccentric",
          responseLength: responseLength || "balanced",
          customInstructions: customInstructions || null,
          updatedAt: new Date(),
        })
        .where(eq(aiAssistantPreferences.userId, clientId));
    } else {
      await db.insert(aiAssistantPreferences).values({
        userId: clientId,
        writingStyle: writingStyle || "eccentric",
        responseLength: responseLength || "balanced",
        customInstructions: customInstructions || null,
      });
    }

    res.json({ success: true });
  } catch (error) {
    console.error("[AI Assistant] Error updating client preferences:", error);
    res.status(500).json({ error: "Failed to update client preferences" });
  }
});

// Get all clients with their AI preferences (consultant only)
router.get("/consultant/clients-with-preferences", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res: Response) => {
  try {
    const consultantId = req.user!.id;

    // Get all clients for this consultant
    const clients = await db.select({
      id: users.id,
      firstName: users.firstName,
      lastName: users.lastName,
      email: users.email,
    })
    .from(users)
    .where(and(
      eq(users.consultantId, consultantId),
      eq(users.role, "client")
    ));

    // Get all preferences for these clients
    const clientIds = clients.map(c => c.id);
    const preferences = clientIds.length > 0 
      ? await db.select()
          .from(aiAssistantPreferences)
          .where(inArray(aiAssistantPreferences.userId, clientIds))
      : [];

    // Create a map of userId -> preferences
    const prefsMap = new Map(preferences.map(p => [p.userId, p]));

    const result = clients.map(c => {
      const prefs = prefsMap.get(c.id);
      return {
        id: c.id,
        displayName: `${c.firstName} ${c.lastName}`.trim(),
        email: c.email,
        preferences: prefs ? {
          writingStyle: prefs.writingStyle,
          responseLength: prefs.responseLength,
          customInstructions: prefs.customInstructions,
        } : {
          writingStyle: "eccentric",
          responseLength: "balanced",
          customInstructions: null,
        },
        hasCustomPreferences: !!prefs,
      };
    });

    res.json(result);
  } catch (error) {
    console.error("[AI Assistant] Error fetching clients with preferences:", error);
    res.status(500).json({ error: "Failed to fetch clients with preferences" });
  }
});

/**
 * POST /api/ai-assistant/enhance-instructions
 * Use AI to enhance and improve custom instructions
 */
router.post("/enhance-instructions", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const userRole = req.user!.role;
    const { instructions, mode = "enhance" } = req.body;

    if (!instructions || typeof instructions !== "string") {
      return res.status(400).json({ error: "Instructions text is required" });
    }

    if (instructions.length < 20) {
      return res.status(400).json({ error: "Le istruzioni devono contenere almeno 20 caratteri" });
    }

    // Import AI provider
    const { getAIProvider, getModelWithThinking } = await import("../ai/provider-factory");
    
    // Determine which user's AI provider to use
    // For clients, use their consultant's provider; for consultants, use their own
    let providerUserId = userId;
    if (userRole === "client") {
      const [clientUser] = await db.select({ consultantId: users.consultantId })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);
      if (clientUser?.consultantId) {
        providerUserId = clientUser.consultantId;
      }
    }
    
    // Get AI provider (using consultant's provider for clients)
    const providerResult = await getAIProvider(providerUserId, providerUserId);
    
    if (!providerResult || !providerResult.client) {
      return res.status(503).json({ error: "AI non disponibile. Configura le impostazioni AI." });
    }

    console.log(`✅ [AI ENHANCEMENT] Using provider: ${providerResult.metadata.name}`);
    console.log(`   - Enhancement mode: ${mode}`);

    // Build mode-specific enhancement instructions
    const modeInstructions: Record<string, string> = {
      enhance: `Il tuo compito è migliorare queste istruzioni per l'AI Assistant rendendole:
1. **Più strutturate e chiare** - dividi in sezioni logiche se necessario
2. **Più specifiche** - aggiungi dettagli concreti dove utile
3. **Più actionable** - aggiungi indicazioni su COSA fare e COME farlo
4. **Mantenendo ESATTAMENTE l'intento originale** - non cambiare il significato, solo migliorare la qualità`,

      simplify: `Il tuo compito è SEMPLIFICARE queste istruzioni:
1. **Elimina ridondanze** - rimuovi ripetizioni e informazioni superflue
2. **Mantieni solo l'essenziale** - focalizzati sui concetti chiave
3. **Frasi brevi e dirette** - ogni frase deve comunicare un solo concetto`,

      expand: `Il tuo compito è ESPANDERE queste istruzioni:
1. **Aggiungi dettagli** - elabora ogni punto con maggiori informazioni
2. **Includi esempi** - aggiungi esempi concreti dove utile
3. **Copri più casi** - pensa a scenari aggiuntivi da gestire`,

      formalize: `Il tuo compito è rendere queste istruzioni più FORMALI e PROFESSIONALI:
1. **Tono professionale** - usa un linguaggio formale e preciso
2. **Struttura chiara** - organizza in modo ordinato
3. **Terminologia appropriata** - usa termini tecnici dove opportuno`,

      friendly: `Il tuo compito è rendere queste istruzioni più AMICHEVOLI e ACCESSIBILI:
1. **Tono caldo** - usa un linguaggio accogliente
2. **Semplifica** - evita gergo tecnico
3. **Incoraggiante** - aggiungi elementi positivi e motivanti`,
    };

    const selectedMode = modeInstructions[mode] || modeInstructions.enhance;

    const systemPrompt = `Sei un esperto nella scrittura di istruzioni per assistenti AI.

${selectedMode}

⚠️ REGOLE CRITICHE - DEVI RISPETTARLE:
1. Rispondi ESCLUSIVAMENTE con le istruzioni migliorate
2. NESSUN commento, NESSUNA spiegazione, NESSUN meta-testo
3. NESSUNA opzione multipla - dammi UNA SOLA versione migliorata
4. NON scrivere "Ecco le istruzioni migliorate:" o simili
5. NON chiedere quale versione preferisco
6. Inizia DIRETTAMENTE con il testo delle istruzioni
7. Mantieni la stessa lingua delle istruzioni originali
8. Lunghezza massima: circa 2000 caratteri

Il tuo output deve essere SOLO il testo delle istruzioni migliorate, pronto per essere usato così com'è.`;

    const userPrompt = `Migliora queste istruzioni e restituisci SOLO il risultato finale (niente spiegazioni):

${instructions}`;

    // Get model configuration
    const { model, useThinking, thinkingLevel } = getModelWithThinking(providerResult.metadata.name);

    // Call AI using the same pattern as other routes
    const result = await providerResult.client.generateContent({
      model,
      contents: [
        {
          role: "user",
          parts: [{ text: userPrompt }],
        },
      ],
      systemInstruction: systemPrompt,
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 2000,
      },
    });

    const enhancedText = result.response.text()?.trim() || "";

    console.log(`✅ [AI ENHANCEMENT] Enhanced from ${instructions.length} to ${enhancedText.length} chars`);

    res.json({
      success: true,
      data: {
        original: instructions,
        enhanced: enhancedText,
        originalLength: instructions.length,
        enhancedLength: enhancedText.length,
        provider: providerResult.metadata.name,
        mode,
      },
    });
  } catch (error: any) {
    console.error("[AI Assistant] Error enhancing instructions:", error);
    res.status(500).json({ error: error.message || "Errore nel miglioramento delle istruzioni" });
  }
});

/**
 * GET /api/ai-assistant/agent/:agentId/suggestions
 * Get AI-generated personalized suggestions for an agent's welcome screen
 * If suggestions don't exist, generate them using Gemini based on agent's brand voice
 */
router.get("/agent/:agentId/suggestions", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { agentId } = req.params;
    const userId = req.user!.id;

    // Get the agent configuration
    const [agent] = await db.select()
      .from(consultantWhatsappConfig)
      .where(eq(consultantWhatsappConfig.id, agentId))
      .limit(1);

    if (!agent) {
      return res.status(404).json({ error: "Agent not found" });
    }

    // If suggestions already exist, return them
    if (agent.aiAssistantSuggestions && Array.isArray(agent.aiAssistantSuggestions) && agent.aiAssistantSuggestions.length > 0) {
      console.log(`✅ [AI SUGGESTIONS] Returning cached suggestions for agent ${agentId}`);
      return res.json({ suggestions: agent.aiAssistantSuggestions, source: "cached" });
    }

    // Generate new suggestions using AI
    console.log(`🔄 [AI SUGGESTIONS] Generating new suggestions for agent ${agentId}`);

    const { getAIProvider, getModelWithThinking } = await import("../ai/provider-factory");
    
    // Use consultant's AI provider
    const providerResult = await getAIProvider(agent.consultantId, agent.consultantId);
    
    if (!providerResult || !providerResult.client) {
      // Return default suggestions if AI not available
      const defaultSuggestions = getDefaultSuggestions();
      return res.json({ suggestions: defaultSuggestions, source: "default" });
    }

    // Build a COMPACT context for suggestions (not the full WhatsApp sales prompt)
    const buildSuggestionsContext = () => {
      const parts: string[] = [];
      parts.push(`Business: ${agent.businessName || 'Non specificato'}`);
      if (agent.businessDescription) parts.push(`Descrizione: ${agent.businessDescription}`);
      if (agent.mission) parts.push(`Mission: ${agent.mission}`);
      if (agent.vision) parts.push(`Vision: ${agent.vision}`);
      if (agent.usp) parts.push(`USP: ${agent.usp}`);
      if (agent.whoWeHelp) parts.push(`Chi aiutiamo: ${agent.whoWeHelp}`);
      if (agent.whatWeDo) parts.push(`Cosa facciamo: ${agent.whatWeDo}`);
      if (agent.howWeDoIt) parts.push(`Come lo facciamo: ${agent.howWeDoIt}`);
      if (agent.services && Array.isArray(agent.services) && agent.services.length > 0) {
        const serviceNames = agent.services.map((s: any) => s.name || s).filter(Boolean).slice(0, 3);
        if (serviceNames.length > 0) parts.push(`Servizi principali: ${serviceNames.join(', ')}`);
      }
      return parts.join('\n');
    };

    const agentContext = buildSuggestionsContext();
    console.log(`[AI SUGGESTIONS] Compact context length: ${agentContext.length} chars`);

    const systemPrompt = `Sei un assistente AI che genera suggerimenti per pulsanti di una welcome screen.

CONTESTO BUSINESS:
${agentContext}

TASK: Genera 4 suggerimenti pertinenti al business sopra.
Ogni suggerimento deve essere una domanda che un potenziale cliente farebbe.`;

    const { model } = getModelWithThinking(providerResult.metadata.name);

    // Log the full prompt for debugging
    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`📋 [AI SUGGESTIONS] FULL SYSTEM PROMPT:`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(systemPrompt);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

    // Define strict JSON schema for Gemini to follow
    const responseSchema = {
      type: "array",
      items: {
        type: "object",
        properties: {
          icon: {
            type: "string",
            enum: ["target", "book", "message", "lightbulb", "trending", "sparkles"]
          },
          label: { type: "string" },
          prompt: { type: "string" },
          gradient: {
            type: "string",
            enum: ["from-cyan-500 to-teal-500", "from-teal-500 to-emerald-500", "from-slate-500 to-cyan-500", "from-cyan-600 to-teal-600"]
          }
        },
        required: ["icon", "label", "prompt", "gradient"]
      },
      minItems: 4,
      maxItems: 4
    };

    const result = await providerResult.client.generateContent({
      model,
      contents: [
        {
          role: "user",
          parts: [{ text: "Genera 4 suggerimenti per pulsanti della welcome screen, pertinenti al business descritto sopra. Ogni suggerimento deve avere icon, label (max 4 parole), prompt (max 60 caratteri), e gradient." }],
        },
      ],
      systemInstruction: systemPrompt,
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 2000,
        responseMimeType: "application/json",
        responseSchema: responseSchema as any,
      },
    });

    const responseText = result.response.text()?.trim() || "";
    
    let suggestions;
    try {
      // Extract JSON from response (handle various formats)
      let jsonText = responseText;
      
      // Handle markdown code blocks
      if (responseText.includes("```")) {
        const match = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (match) {
          jsonText = match[1].trim();
        }
      }
      
      // Try to find JSON array in the response if not valid JSON
      if (!jsonText.startsWith("[")) {
        const arrayMatch = responseText.match(/\[\s*\{[\s\S]*\}\s*\]/);
        if (arrayMatch) {
          jsonText = arrayMatch[0];
        }
      }
      
      console.log("[AI SUGGESTIONS] Attempting to parse:", jsonText.substring(0, 200));
      suggestions = JSON.parse(jsonText);
      
      // Validate structure - must have exactly 4 items with correct keys
      if (!Array.isArray(suggestions) || suggestions.length !== 4) {
        throw new Error("Invalid suggestions format: expected array of 4");
      }
      
      // Validate each suggestion has required keys
      const validIcons = ["target", "book", "message", "lightbulb", "trending", "sparkles"];
      for (const s of suggestions) {
        if (!s.icon || !s.label || !s.prompt || !s.gradient) {
          throw new Error(`Missing required keys. Got: ${Object.keys(s).join(", ")}`);
        }
        if (!validIcons.includes(s.icon)) {
          s.icon = "target"; // Default to target if invalid icon
        }
      }
      console.log("[AI SUGGESTIONS] Validation passed:", suggestions.map(s => s.label).join(", "));
    } catch (parseError) {
      console.error("[AI SUGGESTIONS] Failed to parse AI response:", parseError);
      console.error("[AI SUGGESTIONS] Raw response was:", responseText.substring(0, 500));
      suggestions = getDefaultSuggestions();
      return res.json({ suggestions, source: "default" });
    }

    // Save suggestions to database
    await db.update(consultantWhatsappConfig)
      .set({ 
        aiAssistantSuggestions: suggestions,
        updatedAt: new Date()
      })
      .where(eq(consultantWhatsappConfig.id, agentId));

    console.log(`✅ [AI SUGGESTIONS] Generated and saved ${suggestions.length} suggestions for agent ${agentId}`);

    res.json({ suggestions, source: "generated" });
  } catch (error: any) {
    console.error("[AI Assistant] Error getting suggestions:", error);
    res.status(500).json({ error: error.message || "Errore nel recupero dei suggerimenti" });
  }
});

/**
 * DELETE /api/ai-assistant/agent/:agentId/suggestions
 * Clear cached suggestions to force regeneration
 */
router.delete("/agent/:agentId/suggestions", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res: Response) => {
  try {
    const { agentId } = req.params;
    const consultantId = req.user!.id;

    // Verify ownership
    const [agent] = await db.select()
      .from(consultantWhatsappConfig)
      .where(and(
        eq(consultantWhatsappConfig.id, agentId),
        eq(consultantWhatsappConfig.consultantId, consultantId)
      ))
      .limit(1);

    if (!agent) {
      return res.status(404).json({ error: "Agent not found or not owned by you" });
    }

    await db.update(consultantWhatsappConfig)
      .set({ 
        aiAssistantSuggestions: null,
        updatedAt: new Date()
      })
      .where(eq(consultantWhatsappConfig.id, agentId));

    console.log(`🗑️ [AI SUGGESTIONS] Cleared suggestions for agent ${agentId}`);

    res.json({ success: true, message: "Suggestions cleared, will regenerate on next visit" });
  } catch (error: any) {
    console.error("[AI Assistant] Error clearing suggestions:", error);
    res.status(500).json({ error: error.message || "Errore nella cancellazione dei suggerimenti" });
  }
});

// Helper function to build brand context from agent config
function buildBrandContext(agent: any): string {
  const parts: string[] = [];
  
  if (agent.agentName) parts.push(`Nome Agente: ${agent.agentName}`);
  if (agent.businessName) parts.push(`Business: ${agent.businessName}`);
  if (agent.businessDescription) parts.push(`Descrizione: ${agent.businessDescription}`);
  if (agent.mission) parts.push(`Mission: ${agent.mission}`);
  if (agent.vision) parts.push(`Vision: ${agent.vision}`);
  if (agent.usp) parts.push(`USP: ${agent.usp}`);
  if (agent.whoWeHelp) parts.push(`Chi aiutiamo: ${agent.whoWeHelp}`);
  if (agent.whatWeDo) parts.push(`Cosa facciamo: ${agent.whatWeDo}`);
  if (agent.howWeDoIt) parts.push(`Come lo facciamo: ${agent.howWeDoIt}`);
  if (agent.aiPersonality) parts.push(`Personalità AI: ${agent.aiPersonality}`);
  if (agent.selectedTemplate) parts.push(`Template: ${agent.selectedTemplate}`);
  if (agent.agentType) parts.push(`Tipo agente: ${agent.agentType}`);
  
  if (agent.servicesOffered && Array.isArray(agent.servicesOffered)) {
    const services = agent.servicesOffered.map((s: any) => s.name).join(", ");
    if (services) parts.push(`Servizi offerti: ${services}`);
  }

  return parts.length > 0 ? parts.join("\n") : "Assistente AI generico per consulenza";
}

// Default suggestions fallback
function getDefaultSuggestions() {
  return [
    {
      icon: "target" as const,
      label: "I miei obiettivi",
      prompt: "Mostrami un riepilogo dei miei obiettivi e progressi",
      gradient: "from-cyan-500 to-teal-500",
    },
    {
      icon: "book" as const,
      label: "Cosa studiare oggi",
      prompt: "Quale lezione dovrei studiare oggi?",
      gradient: "from-teal-500 to-emerald-500",
    },
    {
      icon: "trending" as const,
      label: "I miei progressi",
      prompt: "Analizza i miei progressi nelle ultime settimane",
      gradient: "from-slate-500 to-cyan-500",
    },
    {
      icon: "lightbulb" as const,
      label: "Esercizi pendenti",
      prompt: "Quali esercizi ho ancora da completare?",
      gradient: "from-cyan-600 to-teal-600",
    },
  ];
}

router.get("/memory/manager-audit", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res: Response) => {
  try {
    const consultantId = req.user!.id;
    const auditData = await conversationMemoryService.getManagerMemoryAudit(consultantId);
    res.json(auditData);
  } catch (error: any) {
    console.error("[AI Assistant] Error fetching manager memory audit:", error);
    res.status(500).json({ error: error.message || "Failed to fetch manager memory audit" });
  }
});

router.get("/memory/manager/:userId/agents", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res: Response) => {
  try {
    const { userId } = req.params;
    const agentBreakdown = await conversationMemoryService.getGoldUserAgentBreakdown(userId);
    res.json(agentBreakdown);
  } catch (error: any) {
    console.error("[AI Assistant] Error fetching Gold user agent breakdown:", error);
    res.status(500).json({ error: error.message || "Failed to fetch agent breakdown" });
  }
});

router.get("/memory/manager/:subscriptionId/agents/:agentProfileId/summaries", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res: Response) => {
  try {
    const { subscriptionId, agentProfileId } = req.params;
    console.log(`[AI Assistant] Fetching agent-specific summaries for subscription: ${subscriptionId}, agent: ${agentProfileId}`);
    
    // First try to get agent-specific summaries
    let summaries = await conversationMemoryService.getManagerDailySummaries(subscriptionId, 30, agentProfileId);
    console.log(`[AI Assistant] Found ${summaries.length} per-agent summaries for agent ${agentProfileId.slice(0,8)}...`);
    
    // Fallback: if no per-agent summaries, get all summaries (including legacy ones without agentProfileId)
    let usedFallback = false;
    if (summaries.length === 0) {
      console.log(`[AI Assistant] No per-agent summaries found, using fallback to global summaries`);
      summaries = await conversationMemoryService.getManagerDailySummaries(subscriptionId, 30);
      usedFallback = true;
      console.log(`[AI Assistant] Fallback: Found ${summaries.length} global summaries`);
    }
    
    res.json({ summaries, usedFallback });
  } catch (error: any) {
    console.error("[AI Assistant] Error fetching agent summaries:", error);
    res.status(500).json({ error: error.message || "Failed to fetch agent summaries" });
  }
});

router.get("/memory/manager/:subscriptionId", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res: Response) => {
  try {
    const { subscriptionId } = req.params;
    console.log(`[AI Assistant] Fetching manager summaries for subscription: ${subscriptionId}`);
    const summaries = await conversationMemoryService.getManagerDailySummaries(subscriptionId, 30);
    console.log(`[AI Assistant] Found ${summaries.length} summaries for subscription ${subscriptionId.slice(0,8)}...`);
    if (summaries.length > 0) {
      console.log(`[AI Assistant] First summary:`, JSON.stringify(summaries[0]).slice(0, 200));
    }
    res.json(summaries);
  } catch (error: any) {
    console.error("[AI Assistant] Error fetching manager summaries:", error);
    res.status(500).json({ error: error.message || "Failed to fetch manager summaries" });
  }
});

router.post("/memory/manager/:subscriptionId/generate", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res: Response) => {
  try {
    const { subscriptionId } = req.params;
    const consultantId = req.user!.id;

    let apiKey: string | null = null;

    const superAdminKeys = await getSuperAdminGeminiKeys();
    if (superAdminKeys && superAdminKeys.enabled && superAdminKeys.keys.length > 0) {
      apiKey = superAdminKeys.keys[0];
    }

    if (!apiKey) {
      const [consultant] = await db.select({ geminiApiKeys: users.geminiApiKeys })
        .from(users)
        .where(eq(users.id, consultantId));
      
      if (consultant?.geminiApiKeys && consultant.geminiApiKeys.length > 0) {
        apiKey = consultant.geminiApiKeys[0];
      }
    }

    if (!apiKey) {
      return res.status(400).json({ error: "Gemini API key not configured" });
    }

    const result = await conversationMemoryService.generateManagerMissingDailySummariesWithProgress(
      subscriptionId,
      consultantId,
      apiKey
    );

    res.json({
      success: true,
      generated: result.generated,
      skipped: result.skipped
    });
  } catch (error: any) {
    console.error("[AI Assistant] Error generating manager memory:", error);
    res.status(500).json({ error: error.message || "Failed to generate manager memory" });
  }
});

/**
 * POST /api/ai-assistant/sync-context
 * Sync dynamic context documents to File Search
 * This uploads/updates conversation history, lead metrics, and AI limitations docs
 */
router.post("/sync-context", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res: Response) => {
  try {
    const consultantId = req.user!.id;
    console.log(`🔄 [AI Context Sync] Manual sync triggered by consultant ${consultantId.substring(0, 8)}...`);

    const result = await syncDynamicDocuments(consultantId);

    res.json({
      success: result.totalDocuments > 0,
      message: `Sincronizzati ${result.totalDocuments}/3 documenti`,
      details: {
        conversationHistory: result.conversationHistory,
        leadHubMetrics: result.leadHubMetrics,
        aiLimitations: result.aiLimitations,
      },
      syncedAt: result.syncedAt,
    });
  } catch (error: any) {
    console.error("[AI Context Sync] Error syncing context:", error);
    res.status(500).json({ error: error.message || "Errore durante la sincronizzazione" });
  }
});

/**
 * GET /api/ai-assistant/sync-context/preview
 * Preview what would be synced without actually uploading
 */
router.get("/sync-context/preview", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res: Response) => {
  try {
    const consultantId = req.user!.id;
    const preview = await previewDynamicDocuments(consultantId);

    res.json({
      success: true,
      preview,
      totalTokensEstimate: 
        preview.conversationHistory.tokensEstimate + 
        preview.leadHubMetrics.tokensEstimate + 
        preview.aiLimitations.tokensEstimate,
    });
  } catch (error: any) {
    console.error("[AI Context Sync] Error generating preview:", error);
    res.status(500).json({ error: error.message || "Errore durante la generazione dell'anteprima" });
  }
});

export default router;
