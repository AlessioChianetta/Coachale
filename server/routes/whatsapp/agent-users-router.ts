import { Router } from "express";
import { authenticateToken, requireRole, type AuthRequest } from "../../middleware/auth";
import { db } from "../../db";
import { bronzeUsers, bronzeUserAgentAccess, consultantWhatsappConfig, clientLevelSubscriptions } from "@shared/schema";
import { eq, and, ilike, or } from "drizzle-orm";

const router = Router();

router.get("/:agentId/users", authenticateToken, requireRole(["consultant", "super_admin"]), async (req: AuthRequest, res) => {
  try {
    const { agentId } = req.params;
    const consultantId = req.user!.id;

    const agent = await db.query.consultantWhatsappConfig.findFirst({
      where: and(
        eq(consultantWhatsappConfig.id, agentId),
        eq(consultantWhatsappConfig.consultantId, consultantId)
      ),
    });

    if (!agent) {
      return res.status(404).json({ error: "Agent not found" });
    }

    const allBronzeUsers = await db.query.bronzeUsers.findMany({
      where: and(
        eq(bronzeUsers.consultantId, consultantId),
        eq(bronzeUsers.isActive, true)
      ),
    });

    const allSilverUsers = await db.query.clientLevelSubscriptions.findMany({
      where: and(
        eq(clientLevelSubscriptions.consultantId, consultantId),
        eq(clientLevelSubscriptions.status, "active"),
        eq(clientLevelSubscriptions.level, "2")
      ),
    });

    const accessRecords = await db.query.bronzeUserAgentAccess.findMany({
      where: eq(bronzeUserAgentAccess.agentConfigId, agentId),
    });

    const accessMap = new Map(accessRecords.map(r => [r.bronzeUserId, r.isEnabled]));

    const bronzeList = allBronzeUsers.map(u => ({
      id: u.id,
      email: u.email,
      firstName: u.firstName,
      lastName: u.lastName,
      tier: "bronze" as const,
      isEnabled: accessMap.get(u.id) ?? true,
      createdAt: u.createdAt,
    }));

    const silverList = allSilverUsers.map(u => ({
      id: u.id,
      email: u.clientEmail,
      firstName: u.clientName?.split(" ")[0] || null,
      lastName: u.clientName?.split(" ").slice(1).join(" ") || null,
      tier: "silver" as const,
      isEnabled: true,
      createdAt: u.createdAt,
    }));

    res.json({
      users: [...bronzeList, ...silverList],
      agentLevels: agent.levels || [],
    });
  } catch (error) {
    console.error("Error fetching agent users:", error);
    res.status(500).json({ error: "Failed to fetch agent users" });
  }
});

router.post("/:agentId/users/:userId/toggle", authenticateToken, requireRole(["consultant", "super_admin"]), async (req: AuthRequest, res) => {
  try {
    const { agentId, userId } = req.params;
    const { isEnabled } = req.body;
    const consultantId = req.user!.id;

    const agent = await db.query.consultantWhatsappConfig.findFirst({
      where: and(
        eq(consultantWhatsappConfig.id, agentId),
        eq(consultantWhatsappConfig.consultantId, consultantId)
      ),
    });

    if (!agent) {
      return res.status(404).json({ error: "Agent not found" });
    }

    const bronzeUser = await db.query.bronzeUsers.findFirst({
      where: and(
        eq(bronzeUsers.id, userId),
        eq(bronzeUsers.consultantId, consultantId)
      ),
    });

    if (!bronzeUser) {
      return res.status(404).json({ error: "User not found" });
    }

    const existing = await db.query.bronzeUserAgentAccess.findFirst({
      where: and(
        eq(bronzeUserAgentAccess.bronzeUserId, userId),
        eq(bronzeUserAgentAccess.agentConfigId, agentId)
      ),
    });

    if (existing) {
      await db.update(bronzeUserAgentAccess)
        .set({ isEnabled })
        .where(eq(bronzeUserAgentAccess.id, existing.id));
    } else {
      await db.insert(bronzeUserAgentAccess).values({
        bronzeUserId: userId,
        agentConfigId: agentId,
        isEnabled,
      });
    }

    res.json({ success: true, isEnabled });
  } catch (error) {
    console.error("Error toggling user access:", error);
    res.status(500).json({ error: "Failed to toggle user access" });
  }
});

export default router;
