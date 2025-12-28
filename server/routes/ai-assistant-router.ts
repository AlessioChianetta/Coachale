import { Router, Response } from "express";
import { db } from "../db";
import { 
  consultantWhatsappConfig, 
  agentClientAssignments,
  aiAssistantPreferences,
  users,
  aiConversations
} from "../../shared/schema";
import { eq, and, inArray, desc } from "drizzle-orm";
import { AuthRequest, authenticateToken, requireRole } from "../middleware/auth";

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
    
    const assignments = await db.select({
      agentId: agentClientAssignments.agentConfigId,
    })
    .from(agentClientAssignments)
    .where(and(
      eq(agentClientAssignments.clientId, clientId),
      eq(agentClientAssignments.isActive, true)
    ));

    if (assignments.length === 0) {
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
    })
    .from(consultantWhatsappConfig)
    .where(inArray(consultantWhatsappConfig.id, agentIds));

    res.json(agents);
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
        writingStyle: "professional",
        responseLength: "balanced",
        customInstructions: null,
        defaultSystemInstructions: null,
        consultantDefaultInstructions,
      });
    }

    res.json({
      writingStyle: prefs.writingStyle,
      responseLength: prefs.responseLength,
      customInstructions: prefs.customInstructions,
      defaultSystemInstructions: prefs.defaultSystemInstructions,
      consultantDefaultInstructions,
    });
  } catch (error) {
    console.error("[AI Assistant] Error fetching preferences:", error);
    res.status(500).json({ error: "Failed to fetch preferences" });
  }
});

router.put("/preferences", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { writingStyle, responseLength, customInstructions, defaultSystemInstructions } = req.body;

    const [existing] = await db.select()
      .from(aiAssistantPreferences)
      .where(eq(aiAssistantPreferences.userId, userId))
      .limit(1);

    if (existing) {
      await db.update(aiAssistantPreferences)
        .set({
          writingStyle: writingStyle || "professional",
          responseLength: responseLength || "balanced",
          customInstructions: customInstructions || null,
          defaultSystemInstructions: defaultSystemInstructions !== undefined ? defaultSystemInstructions : existing.defaultSystemInstructions,
          updatedAt: new Date(),
        })
        .where(eq(aiAssistantPreferences.userId, userId));
    } else {
      await db.insert(aiAssistantPreferences).values({
        userId,
        writingStyle: writingStyle || "professional",
        responseLength: responseLength || "balanced",
        customInstructions: customInstructions || null,
        defaultSystemInstructions: defaultSystemInstructions || null,
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
        writingStyle: "professional",
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
          writingStyle: writingStyle || "professional",
          responseLength: responseLength || "balanced",
          customInstructions: customInstructions || null,
          updatedAt: new Date(),
        })
        .where(eq(aiAssistantPreferences.userId, clientId));
    } else {
      await db.insert(aiAssistantPreferences).values({
        userId: clientId,
        writingStyle: writingStyle || "professional",
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
          writingStyle: "professional",
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

export default router;
