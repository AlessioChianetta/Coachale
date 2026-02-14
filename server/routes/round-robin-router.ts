import { Router, Request, Response } from "express";
import { db } from "../db";
import {
  bookingPools,
  bookingPoolMembers,
  consultantWhatsappConfig,
} from "../../shared/schema";
import { eq, and, sql } from "drizzle-orm";
import { getPoolMembers, getPoolStats } from "../booking/round-robin-service";

const router = Router();

router.get("/pools", async (req: Request, res: Response) => {
  try {
    const consultantId = (req as any).user?.id;
    if (!consultantId) return res.status(401).json({ error: "Non autenticato" });

    const pools = await db
      .select()
      .from(bookingPools)
      .where(eq(bookingPools.consultantId, consultantId));

    res.json({ pools });
  } catch (error: any) {
    console.error("[ROUND-ROBIN] Error fetching pools:", error);
    res.status(500).json({ error: error.message });
  }
});

router.post("/pools", async (req: Request, res: Response) => {
  try {
    const consultantId = (req as any).user?.id;
    if (!consultantId) return res.status(401).json({ error: "Non autenticato" });

    const { name, strategy } = req.body;

    const [pool] = await db
      .insert(bookingPools)
      .values({
        consultantId,
        name: name || "Pool Commerciali",
        strategy: strategy || "weighted",
      })
      .returning();

    res.json({ pool });
  } catch (error: any) {
    console.error("[ROUND-ROBIN] Error creating pool:", error);
    res.status(500).json({ error: error.message });
  }
});

router.put("/pools/:poolId", async (req: Request, res: Response) => {
  try {
    const consultantId = (req as any).user?.id;
    if (!consultantId) return res.status(401).json({ error: "Non autenticato" });

    const { poolId } = req.params;
    const { name, strategy, isActive } = req.body;

    const updateData: any = { updatedAt: new Date() };
    if (name !== undefined) updateData.name = name;
    if (strategy !== undefined) updateData.strategy = strategy;
    if (isActive !== undefined) updateData.isActive = isActive;

    const [updated] = await db
      .update(bookingPools)
      .set(updateData)
      .where(and(eq(bookingPools.id, poolId), eq(bookingPools.consultantId, consultantId)))
      .returning();

    if (!updated) return res.status(404).json({ error: "Pool non trovato" });
    res.json({ pool: updated });
  } catch (error: any) {
    console.error("[ROUND-ROBIN] Error updating pool:", error);
    res.status(500).json({ error: error.message });
  }
});

router.delete("/pools/:poolId", async (req: Request, res: Response) => {
  try {
    const consultantId = (req as any).user?.id;
    if (!consultantId) return res.status(401).json({ error: "Non autenticato" });

    const { poolId } = req.params;

    await db
      .update(consultantWhatsappConfig)
      .set({ roundRobinEnabled: false, bookingPoolId: null })
      .where(eq(consultantWhatsappConfig.bookingPoolId, poolId));

    await db
      .delete(bookingPools)
      .where(and(eq(bookingPools.id, poolId), eq(bookingPools.consultantId, consultantId)));

    res.json({ success: true });
  } catch (error: any) {
    console.error("[ROUND-ROBIN] Error deleting pool:", error);
    res.status(500).json({ error: error.message });
  }
});

router.get("/pools/:poolId/members", async (req: Request, res: Response) => {
  try {
    const { poolId } = req.params;
    const members = await getPoolMembers(poolId);
    res.json({ members });
  } catch (error: any) {
    console.error("[ROUND-ROBIN] Error fetching members:", error);
    res.status(500).json({ error: error.message });
  }
});

router.post("/pools/:poolId/members", async (req: Request, res: Response) => {
  try {
    const { poolId } = req.params;
    const { agentConfigId, weight, maxDailyBookings } = req.body;

    if (!agentConfigId) {
      return res.status(400).json({ error: "agentConfigId è richiesto" });
    }

    const [member] = await db
      .insert(bookingPoolMembers)
      .values({
        poolId,
        agentConfigId,
        weight: weight || 50,
        maxDailyBookings: maxDailyBookings || 10,
      })
      .returning();

    res.json({ member });
  } catch (error: any) {
    if (error.message?.includes("unique") || error.code === "23505") {
      return res.status(409).json({ error: "Questo dipendente è già nel pool" });
    }
    console.error("[ROUND-ROBIN] Error adding member:", error);
    res.status(500).json({ error: error.message });
  }
});

router.post("/pools/:poolId/members/standalone", async (req: Request, res: Response) => {
  try {
    const { poolId } = req.params;
    const { memberName, weight, maxDailyBookings } = req.body;

    if (!memberName || !memberName.trim()) {
      return res.status(400).json({ error: "Il nome è obbligatorio" });
    }

    const [member] = await db
      .insert(bookingPoolMembers)
      .values({
        poolId,
        agentConfigId: null,
        memberName: memberName.trim(),
        weight: weight || 50,
        maxDailyBookings: maxDailyBookings || 10,
      })
      .returning();

    res.json({ member });
  } catch (error: any) {
    console.error("[ROUND-ROBIN] Error adding standalone member:", error);
    res.status(500).json({ error: error.message });
  }
});

router.post("/members/:memberId/calendar/oauth/start", async (req: Request, res: Response) => {
  try {
    const { memberId } = req.params;

    const [member] = await db
      .select()
      .from(bookingPoolMembers)
      .where(eq(bookingPoolMembers.id, memberId))
      .limit(1);

    if (!member) {
      return res.status(404).json({ error: "Membro non trovato" });
    }

    const { getStandaloneMemberAuthorizationUrl, buildBaseUrlFromRequest } = await import("../google-calendar-service");
    const redirectBaseUrl = buildBaseUrlFromRequest(req);
    const authUrl = await getStandaloneMemberAuthorizationUrl(memberId, redirectBaseUrl);

    if (!authUrl) {
      return res.status(500).json({ error: "Credenziali OAuth globali non configurate" });
    }

    res.json({ authUrl });
  } catch (error: any) {
    console.error("[ROUND-ROBIN] Error starting member OAuth:", error);
    res.status(500).json({ error: error.message });
  }
});

router.put("/pools/:poolId/members/:memberId", async (req: Request, res: Response) => {
  try {
    const { memberId } = req.params;
    const { weight, maxDailyBookings, isActive, isPaused } = req.body;

    const updateData: any = { updatedAt: new Date() };
    if (weight !== undefined) updateData.weight = weight;
    if (maxDailyBookings !== undefined) updateData.maxDailyBookings = maxDailyBookings;
    if (isActive !== undefined) updateData.isActive = isActive;
    if (isPaused !== undefined) updateData.isPaused = isPaused;

    const [updated] = await db
      .update(bookingPoolMembers)
      .set(updateData)
      .where(eq(bookingPoolMembers.id, memberId))
      .returning();

    if (!updated) return res.status(404).json({ error: "Membro non trovato" });
    res.json({ member: updated });
  } catch (error: any) {
    console.error("[ROUND-ROBIN] Error updating member:", error);
    res.status(500).json({ error: error.message });
  }
});

router.delete("/pools/:poolId/members/:memberId", async (req: Request, res: Response) => {
  try {
    const { memberId } = req.params;

    await db.delete(bookingPoolMembers).where(eq(bookingPoolMembers.id, memberId));

    res.json({ success: true });
  } catch (error: any) {
    console.error("[ROUND-ROBIN] Error removing member:", error);
    res.status(500).json({ error: error.message });
  }
});

router.get("/pools/:poolId/stats", async (req: Request, res: Response) => {
  try {
    const { poolId } = req.params;
    const stats = await getPoolStats(poolId);
    res.json(stats);
  } catch (error: any) {
    console.error("[ROUND-ROBIN] Error fetching stats:", error);
    res.status(500).json({ error: error.message });
  }
});

router.put("/agent/:agentConfigId/round-robin", async (req: Request, res: Response) => {
  try {
    const { agentConfigId } = req.params;
    const { enabled, poolId } = req.body;

    const updateData: any = { updatedAt: new Date() };
    if (enabled !== undefined) updateData.roundRobinEnabled = enabled;
    if (poolId !== undefined) updateData.bookingPoolId = poolId;

    if (enabled === false) {
      updateData.bookingPoolId = null;
    }

    const [updated] = await db
      .update(consultantWhatsappConfig)
      .set(updateData)
      .where(eq(consultantWhatsappConfig.id, agentConfigId))
      .returning();

    if (!updated) return res.status(404).json({ error: "Agent non trovato" });

    res.json({
      roundRobinEnabled: updated.roundRobinEnabled,
      bookingPoolId: updated.bookingPoolId,
    });
  } catch (error: any) {
    console.error("[ROUND-ROBIN] Error updating agent round-robin:", error);
    res.status(500).json({ error: error.message });
  }
});

router.get("/agent/:agentConfigId/round-robin", async (req: Request, res: Response) => {
  try {
    const { agentConfigId } = req.params;

    const [agent] = await db
      .select({
        roundRobinEnabled: consultantWhatsappConfig.roundRobinEnabled,
        bookingPoolId: consultantWhatsappConfig.bookingPoolId,
      })
      .from(consultantWhatsappConfig)
      .where(eq(consultantWhatsappConfig.id, agentConfigId))
      .limit(1);

    if (!agent) return res.status(404).json({ error: "Agent non trovato" });

    res.json(agent);
  } catch (error: any) {
    console.error("[ROUND-ROBIN] Error fetching agent round-robin:", error);
    res.status(500).json({ error: error.message });
  }
});

router.post("/pools/:poolId/members/:memberId/reset", async (req: Request, res: Response) => {
  try {
    const { memberId } = req.params;

    const [updated] = await db
      .update(bookingPoolMembers)
      .set({
        totalBookingsCount: 0,
        lastAssignedAt: null,
        updatedAt: new Date(),
      })
      .where(eq(bookingPoolMembers.id, memberId))
      .returning();

    if (!updated) return res.status(404).json({ error: "Membro non trovato" });
    res.json({ member: updated });
  } catch (error: any) {
    console.error("[ROUND-ROBIN] Error resetting member:", error);
    res.status(500).json({ error: error.message });
  }
});

router.get("/agents-available", async (req: Request, res: Response) => {
  try {
    const consultantId = (req as any).user?.id;
    if (!consultantId) return res.status(401).json({ error: "Non autenticato" });

    const agents = await db
      .select({
        id: consultantWhatsappConfig.id,
        agentName: consultantWhatsappConfig.agentName,
        hasCalendar: sql<boolean>`${consultantWhatsappConfig.googleRefreshToken} IS NOT NULL`,
        googleCalendarEmail: consultantWhatsappConfig.googleCalendarEmail,
        roundRobinEnabled: consultantWhatsappConfig.roundRobinEnabled,
        bookingPoolId: consultantWhatsappConfig.bookingPoolId,
      })
      .from(consultantWhatsappConfig)
      .where(
        and(
          eq(consultantWhatsappConfig.consultantId, consultantId),
          eq(consultantWhatsappConfig.isActive, true)
        )
      );

    res.json({ agents });
  } catch (error: any) {
    console.error("[ROUND-ROBIN] Error fetching available agents:", error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
