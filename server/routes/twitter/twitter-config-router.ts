/**
 * Twitter/X Configuration Router
 * CRUD operations for Twitter agent configurations
 */

import { Router, Request, Response } from "express";
import { db } from "../../db";
import {
  consultantTwitterConfig,
  twitterAgentConfig,
  twitterConversations,
  twitterMessages,
  superadminTwitterConfig,
  consultantWhatsappConfig,
} from "../../../shared/schema";
import { eq, and, desc, sql, count } from "drizzle-orm";
import { encrypt, decrypt } from "../../encryption";

const router = Router();

/**
 * GET /api/twitter/configs
 * Get all Twitter configs for the current consultant
 */
router.get("/configs", async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user) {
      return res.status(401).json({ error: "Non autorizzato" });
    }

    const consultantId = user.role === "consultant" ? user.id : user.consultantId;

    const configs = await db
      .select({
        id: consultantTwitterConfig.id,
        agentName: consultantTwitterConfig.agentName,
        twitterUserId: consultantTwitterConfig.twitterUserId,
        twitterUsername: consultantTwitterConfig.twitterUsername,
        isActive: consultantTwitterConfig.isActive,
        isConnected: consultantTwitterConfig.isConnected,
        connectedAt: consultantTwitterConfig.connectedAt,
        autoResponseEnabled: consultantTwitterConfig.autoResponseEnabled,
        isDryRun: consultantTwitterConfig.isDryRun,
        keywordDmEnabled: consultantTwitterConfig.keywordDmEnabled,
        triggerKeywords: consultantTwitterConfig.triggerKeywords,
        createdAt: consultantTwitterConfig.createdAt,
      })
      .from(consultantTwitterConfig)
      .where(eq(consultantTwitterConfig.consultantId, consultantId))
      .orderBy(desc(consultantTwitterConfig.createdAt));

    res.json({ configs });
  } catch (error) {
    console.error("Error fetching Twitter configs:", error);
    res.status(500).json({ error: "Errore nel recupero delle configurazioni" });
  }
});

/**
 * GET /api/twitter/configs/:id
 * Get a specific Twitter config
 */
router.get("/configs/:id", async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user) {
      return res.status(401).json({ error: "Non autorizzato" });
    }

    const consultantId = user.role === "consultant" ? user.id : user.consultantId;
    const { id } = req.params;

    const [config] = await db
      .select()
      .from(consultantTwitterConfig)
      .where(
        and(
          eq(consultantTwitterConfig.id, id),
          eq(consultantTwitterConfig.consultantId, consultantId)
        )
      )
      .limit(1);

    if (!config) {
      return res.status(404).json({ error: "Configurazione non trovata" });
    }

    // Don't return sensitive tokens
    const safeConfig = {
      ...config,
      accessToken: config.accessToken ? "[REDACTED]" : null,
      accessTokenSecret: config.accessTokenSecret ? "[REDACTED]" : null,
      refreshToken: config.refreshToken ? "[REDACTED]" : null,
    };

    res.json({ config: safeConfig });
  } catch (error) {
    console.error("Error fetching Twitter config:", error);
    res.status(500).json({ error: "Errore nel recupero della configurazione" });
  }
});

/**
 * PATCH /api/twitter/configs/:id
 * Update a Twitter config
 */
router.patch("/configs/:id", async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user) {
      return res.status(401).json({ error: "Non autorizzato" });
    }

    const consultantId = user.role === "consultant" ? user.id : user.consultantId;
    const { id } = req.params;
    const updates = req.body;

    // Verify ownership
    const [existing] = await db
      .select()
      .from(consultantTwitterConfig)
      .where(
        and(
          eq(consultantTwitterConfig.id, id),
          eq(consultantTwitterConfig.consultantId, consultantId)
        )
      )
      .limit(1);

    if (!existing) {
      return res.status(404).json({ error: "Configurazione non trovata" });
    }

    // Filter allowed fields
    const allowedFields = [
      "agentName",
      "isActive",
      "autoResponseEnabled",
      "isDryRun",
      "workingHoursEnabled",
      "workingHoursStart",
      "workingHoursEnd",
      "workingDays",
      "afterHoursMessage",
      "businessName",
      "consultantDisplayName",
      "businessDescription",
      "consultantBio",
      "salesScript",
      "aiPersonality",
      "vision",
      "mission",
      "values",
      "usp",
      "whoWeHelp",
      "whoWeDontHelp",
      "whatWeDo",
      "howWeDoIt",
      "agentInstructions",
      "agentInstructionsEnabled",
      "bookingEnabled",
      "objectionHandlingEnabled",
      "disqualificationEnabled",
      "keywordDmEnabled",
      "triggerKeywords",
      "autoDmMessage",
    ];

    const filteredUpdates: Record<string, unknown> = {};
    for (const field of allowedFields) {
      if (field in updates) {
        filteredUpdates[field] = updates[field];
      }
    }

    filteredUpdates.updatedAt = new Date();

    const [updated] = await db
      .update(consultantTwitterConfig)
      .set(filteredUpdates)
      .where(eq(consultantTwitterConfig.id, id))
      .returning();

    res.json({ config: updated });
  } catch (error) {
    console.error("Error updating Twitter config:", error);
    res.status(500).json({ error: "Errore nell'aggiornamento della configurazione" });
  }
});

/**
 * DELETE /api/twitter/configs/:id
 * Disconnect/delete a Twitter config
 */
router.delete("/configs/:id", async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user) {
      return res.status(401).json({ error: "Non autorizzato" });
    }

    const consultantId = user.role === "consultant" ? user.id : user.consultantId;
    const { id } = req.params;

    // Verify ownership
    const [existing] = await db
      .select()
      .from(consultantTwitterConfig)
      .where(
        and(
          eq(consultantTwitterConfig.id, id),
          eq(consultantTwitterConfig.consultantId, consultantId)
        )
      )
      .limit(1);

    if (!existing) {
      return res.status(404).json({ error: "Configurazione non trovata" });
    }

    // Delete the config (cascades to conversations and messages)
    await db
      .delete(consultantTwitterConfig)
      .where(eq(consultantTwitterConfig.id, id));

    res.json({ success: true, message: "Configurazione eliminata" });
  } catch (error) {
    console.error("Error deleting Twitter config:", error);
    res.status(500).json({ error: "Errore nell'eliminazione della configurazione" });
  }
});

/**
 * GET /api/twitter/conversations
 * Get conversations for the current consultant
 */
router.get("/conversations", async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user) {
      return res.status(401).json({ error: "Non autorizzato" });
    }

    const consultantId = user.role === "consultant" ? user.id : user.consultantId;
    const { configId, limit = "50", offset = "0" } = req.query;

    let query = db
      .select()
      .from(twitterConversations)
      .where(eq(twitterConversations.consultantId, consultantId))
      .orderBy(desc(twitterConversations.lastMessageAt))
      .limit(parseInt(limit as string))
      .offset(parseInt(offset as string));

    if (configId) {
      query = db
        .select()
        .from(twitterConversations)
        .where(
          and(
            eq(twitterConversations.consultantId, consultantId),
            eq(twitterConversations.agentConfigId, configId as string)
          )
        )
        .orderBy(desc(twitterConversations.lastMessageAt))
        .limit(parseInt(limit as string))
        .offset(parseInt(offset as string));
    }

    const conversations = await query;

    res.json({ conversations });
  } catch (error) {
    console.error("Error fetching Twitter conversations:", error);
    res.status(500).json({ error: "Errore nel recupero delle conversazioni" });
  }
});

/**
 * GET /api/twitter/conversations/:id/messages
 * Get messages for a conversation
 */
router.get("/conversations/:id/messages", async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user) {
      return res.status(401).json({ error: "Non autorizzato" });
    }

    const { id } = req.params;
    const { limit = "100", offset = "0" } = req.query;

    const messages = await db
      .select()
      .from(twitterMessages)
      .where(eq(twitterMessages.conversationId, id))
      .orderBy(desc(twitterMessages.createdAt))
      .limit(parseInt(limit as string))
      .offset(parseInt(offset as string));

    // Return in chronological order
    res.json({ messages: messages.reverse() });
  } catch (error) {
    console.error("Error fetching Twitter messages:", error);
    res.status(500).json({ error: "Errore nel recupero dei messaggi" });
  }
});

/**
 * POST /api/twitter/conversations/:id/toggle-ai
 * Toggle AI for a conversation
 */
router.post("/conversations/:id/toggle-ai", async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user) {
      return res.status(401).json({ error: "Non autorizzato" });
    }

    const { id } = req.params;
    const { enabled } = req.body;

    const [updated] = await db
      .update(twitterConversations)
      .set({
        aiEnabled: enabled,
        updatedAt: new Date(),
      })
      .where(eq(twitterConversations.id, id))
      .returning();

    res.json({ conversation: updated });
  } catch (error) {
    console.error("Error toggling AI:", error);
    res.status(500).json({ error: "Errore nel toggle AI" });
  }
});

/**
 * GET /api/twitter/stats
 * Get Twitter stats for the current consultant
 */
router.get("/stats", async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user) {
      return res.status(401).json({ error: "Non autorizzato" });
    }

    const consultantId = user.role === "consultant" ? user.id : user.consultantId;

    // Count conversations
    const [convCount] = await db
      .select({ count: count() })
      .from(twitterConversations)
      .where(eq(twitterConversations.consultantId, consultantId));

    // Count unread
    const [unreadCount] = await db
      .select({ total: sql<number>`COALESCE(SUM(${twitterConversations.unreadByConsultant}), 0)` })
      .from(twitterConversations)
      .where(eq(twitterConversations.consultantId, consultantId));

    // Count connected accounts
    const [configCount] = await db
      .select({ count: count() })
      .from(consultantTwitterConfig)
      .where(
        and(
          eq(consultantTwitterConfig.consultantId, consultantId),
          eq(consultantTwitterConfig.isConnected, true)
        )
      );

    res.json({
      totalConversations: convCount?.count || 0,
      unreadMessages: unreadCount?.total || 0,
      connectedAccounts: configCount?.count || 0,
    });
  } catch (error) {
    console.error("Error fetching Twitter stats:", error);
    res.status(500).json({ error: "Errore nel recupero delle statistiche" });
  }
});

export default router;
