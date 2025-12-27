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
      clientName: users.displayName,
      clientEmail: users.email,
    })
    .from(agentClientAssignments)
    .innerJoin(users, eq(agentClientAssignments.clientId, users.id))
    .where(eq(agentClientAssignments.agentConfigId, agentId));

    res.json(assignments);
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
      displayName: users.displayName,
      email: users.email,
    })
    .from(users)
    .where(and(
      eq(users.consultantId, consultantId),
      eq(users.role, "client")
    ));

    res.json(clients);
  } catch (error) {
    console.error("[AI Assistant] Error fetching clients:", error);
    res.status(500).json({ error: "Failed to fetch clients" });
  }
});

export default router;
