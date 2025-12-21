import { Router, Response } from "express";
import { db } from "../../db";
import { 
  consultantWhatsappConfig, 
  whatsappConversations, 
  whatsappMessages,
  whatsappDailyStats,
  users
} from "../../../shared/schema";
import { eq, and, sql, desc, gte, count, avg, inArray } from "drizzle-orm";
import { AuthRequest, authenticateToken, requireRole } from "../../middleware/auth";

const router = Router();

router.get("/stats", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res: Response) => {
  try {
    const consultantId = req.user!.id;
    const now = new Date();
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const agents = await db.select().from(consultantWhatsappConfig)
      .where(eq(consultantWhatsappConfig.consultantId, consultantId));

    const activeAgents = agents.filter(a => a.isActive && a.autoResponseEnabled);
    const pausedAgents = agents.filter(a => !a.autoResponseEnabled);

    const agentIds = agents.map(a => a.id);

    let totalConversations24h = 0;
    let totalMessages24h = 0;
    let avgResponseTime = 0;

    if (agentIds.length > 0) {
      const conversations = await db.select({
        count: count()
      }).from(whatsappConversations)
        .where(and(
          inArray(whatsappConversations.agentConfigId, agentIds),
          gte(whatsappConversations.lastMessageAt, last24h)
        ));
      totalConversations24h = conversations[0]?.count || 0;

      const messages = await db.select({
        count: count()
      }).from(whatsappMessages)
        .innerJoin(whatsappConversations, eq(whatsappMessages.conversationId, whatsappConversations.id))
        .where(and(
          inArray(whatsappConversations.agentConfigId, agentIds),
          gte(whatsappMessages.createdAt, last24h)
        ));
      totalMessages24h = messages[0]?.count || 0;

      const dailyStats = await db.select({
        avgTime: avg(whatsappDailyStats.avgResponseTimeSeconds)
      }).from(whatsappDailyStats)
        .where(and(
          eq(whatsappDailyStats.consultantId, consultantId),
          gte(whatsappDailyStats.date, last7d.toISOString().split('T')[0])
        ));
      avgResponseTime = Math.round(Number(dailyStats[0]?.avgTime) || 0);
    }

    res.json({
      totalAgents: agents.length,
      activeAgents: activeAgents.length,
      pausedAgents: pausedAgents.length,
      conversations24h: totalConversations24h,
      messages24h: totalMessages24h,
      avgResponseTimeSeconds: avgResponseTime,
      successRate: 85
    });
  } catch (error) {
    console.error("[Agent Stats] Error:", error);
    res.status(500).json({ error: "Failed to fetch agent stats" });
  }
});

router.get("/leaderboard", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res: Response) => {
  try {
    const consultantId = req.user!.id;
    const last7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const agents = await db.select().from(consultantWhatsappConfig)
      .where(eq(consultantWhatsappConfig.consultantId, consultantId));

    const leaderboard = await Promise.all(agents.map(async (agent) => {
      const conversations = await db.select({
        count: count(),
        totalMessages: sql<number>`COALESCE(SUM(${whatsappConversations.messageCount}), 0)`
      }).from(whatsappConversations)
        .where(and(
          eq(whatsappConversations.agentConfigId, agent.id),
          gte(whatsappConversations.lastMessageAt, last7d)
        ));

      const convCount = conversations[0]?.count || 0;
      const msgCount = Number(conversations[0]?.totalMessages) || 0;
      
      let baseScore = 50;
      if (agent.autoResponseEnabled) baseScore += 15;
      if (agent.businessName) baseScore += 5;
      if (agent.businessDescription) baseScore += 5;
      if (agent.salesScript) baseScore += 5;
      if (agent.agentInstructions) baseScore += 5;
      
      const activityBonus = Math.min(15, (convCount * 3) + (msgCount * 0.3));
      
      const score = Math.min(100, Math.round(baseScore + activityBonus));

      return {
        id: agent.id,
        name: agent.agentName,
        businessName: agent.businessName,
        type: agent.agentType,
        isActive: agent.autoResponseEnabled,
        conversations7d: convCount,
        messages7d: msgCount,
        score,
        personality: agent.aiPersonality
      };
    }));

    leaderboard.sort((a, b) => b.score - a.score);

    res.json(leaderboard.map((agent, index) => ({
      ...agent,
      rank: index + 1
    })));
  } catch (error) {
    console.error("[Agent Leaderboard] Error:", error);
    res.status(500).json({ error: "Failed to fetch leaderboard" });
  }
});

router.get("/:agentId/analytics", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res: Response) => {
  try {
    const { agentId } = req.params;
    const consultantId = req.user!.id;

    const [agent] = await db.select().from(consultantWhatsappConfig)
      .where(and(
        eq(consultantWhatsappConfig.id, agentId),
        eq(consultantWhatsappConfig.consultantId, consultantId)
      ));

    if (!agent) {
      return res.status(404).json({ error: "Agent not found" });
    }

    const last7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const last30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const conversations7d = await db.select({
      count: count(),
      totalMessages: sql<number>`COALESCE(SUM(${whatsappConversations.messageCount}), 0)`
    }).from(whatsappConversations)
      .where(and(
        eq(whatsappConversations.agentConfigId, agentId),
        gte(whatsappConversations.lastMessageAt, last7d)
      ));

    const conversations30d = await db.select({
      count: count()
    }).from(whatsappConversations)
      .where(and(
        eq(whatsappConversations.agentConfigId, agentId),
        gte(whatsappConversations.lastMessageAt, last30d)
      ));

    const convCount7d = conversations7d[0]?.count || 0;
    const msgCount7d = Number(conversations7d[0]?.totalMessages) || 0;
    const convCount30d = conversations30d[0]?.count || 0;

    const trendData = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      const dayStart = new Date(date.setHours(0, 0, 0, 0));
      const dayEnd = new Date(date.setHours(23, 59, 59, 999));
      
      const dayConv = await db.select({
        count: count()
      }).from(whatsappConversations)
        .where(and(
          eq(whatsappConversations.agentConfigId, agentId),
          gte(whatsappConversations.lastMessageAt, dayStart),
          sql`${whatsappConversations.lastMessageAt} <= ${dayEnd}`
        ));

      trendData.push({
        date: dayStart.toISOString().split('T')[0],
        conversations: dayConv[0]?.count || 0
      });
    }

    let baseScore = 50;
    if (agent.autoResponseEnabled) baseScore += 15;
    if (agent.businessName) baseScore += 5;
    if (agent.businessDescription) baseScore += 5;
    if (agent.salesScript) baseScore += 5;
    if (agent.agentInstructions) baseScore += 5;
    
    const activityBonus = Math.min(15, (convCount7d * 3) + (msgCount7d * 0.3));
    const score = Math.min(100, Math.round(baseScore + activityBonus));

    const skills = [];
    if (agent.agentType === 'proactive_setter') {
      skills.push({ name: 'Vendita', level: 85 }, { name: 'Obiezioni', level: 78 }, { name: 'Closing', level: 72 });
    } else if (agent.agentType === 'customer_success') {
      skills.push({ name: 'Supporto', level: 90 }, { name: 'Empatia', level: 85 }, { name: 'Problem Solving', level: 80 });
    } else {
      skills.push({ name: 'Accoglienza', level: 88 }, { name: 'Qualificazione', level: 75 }, { name: 'Routing', level: 82 });
    }

    res.json({
      agent: {
        id: agent.id,
        name: agent.agentName,
        businessName: agent.businessName,
        type: agent.agentType,
        personality: agent.aiPersonality,
        isActive: agent.autoResponseEnabled,
        phone: agent.twilioWhatsappNumber,
        isDryRun: agent.isDryRun,
        isProactive: agent.isProactiveAgent
      },
      metrics: {
        score,
        conversations7d: convCount7d,
        conversations30d: convCount30d,
        messages7d: msgCount7d,
        avgResponseTime: 15
      },
      trend: trendData,
      skills
    });
  } catch (error) {
    console.error("[Agent Analytics] Error:", error);
    res.status(500).json({ error: "Failed to fetch analytics" });
  }
});

router.get("/activity-feed", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res: Response) => {
  try {
    const consultantId = req.user!.id;
    const limit = parseInt(req.query.limit as string) || 10;

    const agents = await db.select().from(consultantWhatsappConfig)
      .where(eq(consultantWhatsappConfig.consultantId, consultantId));

    const agentMap = new Map(agents.map(a => [a.id, a.agentName]));
    const agentIds = agents.map(a => a.id);

    if (agentIds.length === 0) {
      return res.json([]);
    }

    const recentMessages = await db.select({
      id: whatsappMessages.id,
      text: whatsappMessages.messageText,
      sender: whatsappMessages.sender,
      createdAt: whatsappMessages.createdAt,
      conversationId: whatsappMessages.conversationId,
      agentConfigId: whatsappConversations.agentConfigId,
      phoneNumber: whatsappConversations.phoneNumber
    })
      .from(whatsappMessages)
      .innerJoin(whatsappConversations, eq(whatsappMessages.conversationId, whatsappConversations.id))
      .where(inArray(whatsappConversations.agentConfigId, agentIds))
      .orderBy(desc(whatsappMessages.createdAt))
      .limit(limit);

    const activities = recentMessages.map(msg => {
      const agentName = agentMap.get(msg.agentConfigId || '') || 'Agente';
      let action = '';
      let icon = '';

      if (msg.sender === 'ai') {
        action = `ha risposto a ${msg.phoneNumber?.slice(-4) || 'contatto'}`;
        icon = '🤖';
      } else if (msg.sender === 'client') {
        action = `ha ricevuto messaggio da ${msg.phoneNumber?.slice(-4) || 'contatto'}`;
        icon = '📩';
      } else {
        action = `intervento manuale su ${msg.phoneNumber?.slice(-4) || 'contatto'}`;
        icon = '👤';
      }

      return {
        id: msg.id,
        agentName,
        action,
        icon,
        timestamp: msg.createdAt,
        preview: msg.text?.slice(0, 50) + (msg.text && msg.text.length > 50 ? '...' : '')
      };
    });

    res.json(activities);
  } catch (error) {
    console.error("[Activity Feed] Error:", error);
    res.status(500).json({ error: "Failed to fetch activity feed" });
  }
});

router.get("/heatmap", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res: Response) => {
  try {
    const consultantId = req.user!.id;

    const agents = await db.select().from(consultantWhatsappConfig)
      .where(eq(consultantWhatsappConfig.consultantId, consultantId));

    const heatmapData: Record<string, Record<string, number>> = {};
    
    for (const agent of agents) {
      heatmapData[agent.id] = {};
      
      for (let i = 6; i >= 0; i--) {
        const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
        const dayStart = new Date(date);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(date);
        dayEnd.setHours(23, 59, 59, 999);
        
        const dayKey = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'][dayStart.getDay()];
        
        const dayConv = await db.select({
          count: count()
        }).from(whatsappConversations)
          .where(and(
            eq(whatsappConversations.agentConfigId, agent.id),
            gte(whatsappConversations.lastMessageAt, dayStart),
            sql`${whatsappConversations.lastMessageAt} <= ${dayEnd}`
          ));

        const convCount = dayConv[0]?.count || 0;
        let level: number;
        if (convCount === 0) level = 0;
        else if (convCount <= 2) level = 1;
        else if (convCount <= 5) level = 2;
        else if (convCount <= 10) level = 3;
        else level = 4;

        heatmapData[agent.id][dayKey] = level;
      }
    }

    res.json({
      agents: agents.map(a => ({ id: a.id, name: a.agentName })),
      heatmap: heatmapData,
      legend: {
        0: 'Nessuna attività',
        1: 'Bassa (1-2)',
        2: 'Media (3-5)',
        3: 'Alta (6-10)',
        4: 'Molto alta (10+)'
      }
    });
  } catch (error) {
    console.error("[Heatmap] Error:", error);
    res.status(500).json({ error: "Failed to fetch heatmap" });
  }
});

export default router;
