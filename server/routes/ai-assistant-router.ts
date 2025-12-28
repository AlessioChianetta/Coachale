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

    const [prefs] = await db.select()
      .from(aiAssistantPreferences)
      .where(eq(aiAssistantPreferences.userId, userId))
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
    console.error("[AI Assistant] Error fetching preferences:", error);
    res.status(500).json({ error: "Failed to fetch preferences" });
  }
});

router.put("/preferences", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { writingStyle, responseLength, customInstructions } = req.body;

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
          updatedAt: new Date(),
        })
        .where(eq(aiAssistantPreferences.userId, userId));
    } else {
      await db.insert(aiAssistantPreferences).values({
        userId,
        writingStyle: writingStyle || "professional",
        responseLength: responseLength || "balanced",
        customInstructions: customInstructions || null,
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

export default router;
