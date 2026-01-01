import { Router, Request, Response } from "express";
import { db } from "../db";
import { eq, and, sql } from "drizzle-orm";
import { consultantWhatsappConfig, users } from "@shared/schema";
import { getAIProvider, getModelWithThinking } from "../ai/provider-factory";
import { buildWhatsAppAgentPrompt } from "../whatsapp/agent-consultant-chat-service";

const router = Router();

function getClientIP(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  return req.ip || req.socket.remoteAddress || 'unknown';
}

async function getRateLimitCount(ipAddress: string, agentSlug: string, date: string): Promise<number> {
  const result = await db.execute(sql`
    SELECT message_count FROM public_chat_rate_limits 
    WHERE ip_address = ${ipAddress} AND agent_slug = ${agentSlug} AND date = ${date}::date
    LIMIT 1
  `);
  
  if (result.rows && result.rows.length > 0) {
    return Number(result.rows[0].message_count) || 0;
  }
  return 0;
}

async function incrementRateLimit(ipAddress: string, agentSlug: string, date: string): Promise<number> {
  const result = await db.execute(sql`
    INSERT INTO public_chat_rate_limits (ip_address, agent_slug, date, message_count, created_at, updated_at)
    VALUES (${ipAddress}, ${agentSlug}, ${date}::date, 1, NOW(), NOW())
    ON CONFLICT (ip_address, agent_slug, date)
    DO UPDATE SET 
      message_count = public_chat_rate_limits.message_count + 1,
      updated_at = NOW()
    RETURNING message_count
  `);
  
  if (result.rows && result.rows.length > 0) {
    return Number(result.rows[0].message_count) || 1;
  }
  return 1;
}

router.get("/:slug/info", async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;

    // SECURITY FIX 2.2: Reject empty or whitespace-only slugs
    if (!slug || !slug.trim() || slug.trim().length === 0) {
      return res.status(400).json({ error: "Slug is required" });
    }

    const cleanSlug = slug.trim().toLowerCase();

    // SECURITY FIX 2.1: Query ONLY Level 1 agents with valid publicSlug
    const [agent] = await db.select()
      .from(consultantWhatsappConfig)
      .where(
        and(
          eq(consultantWhatsappConfig.publicSlug, cleanSlug),
          eq(consultantWhatsappConfig.level, "1"),
          eq(consultantWhatsappConfig.isActive, true)
        )
      )
      .limit(1);

    if (!agent) {
      return res.status(404).json({ error: "Agente non trovato" });
    }

    const [consultant] = await db.select({
      firstName: users.firstName,
      lastName: users.lastName,
      pricingPageSlug: users.pricingPageSlug,
      username: users.username,
    })
      .from(users)
      .where(eq(users.id, agent.consultantId))
      .limit(1);

    const consultantName = consultant 
      ? `${consultant.firstName} ${consultant.lastName}`.trim() 
      : agent.consultantDisplayName || "Consulente";

    const consultantSlugValue = consultant?.pricingPageSlug || consultant?.username || null;

    res.json({
      agentName: agent.agentName || "Assistente AI",
      consultantName,
      consultantSlug: consultantSlugValue,
      dailyMessageLimit: agent.dailyMessageLimit || 15,
      businessName: agent.businessName || null,
      businessDescription: agent.businessDescription || null,
    });
  } catch (error: any) {
    console.error("[PUBLIC AI CHAT] Get info error:", error);
    res.status(500).json({ error: "Errore interno del server" });
  }
});

router.post("/:slug/chat", async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;
    const { message, conversationHistory = [] } = req.body;

    // SECURITY FIX 2.2: Reject empty or whitespace-only slugs
    if (!slug || !slug.trim() || slug.trim().length === 0) {
      return res.status(400).json({ error: "Slug is required" });
    }

    if (!message || typeof message !== "string" || message.trim().length === 0) {
      return res.status(400).json({ error: "Il messaggio è obbligatorio" });
    }

    const cleanSlug = slug.trim().toLowerCase();

    // SECURITY FIX 2.1: Query ONLY Level 1 agents with valid publicSlug
    const [agent] = await db.select()
      .from(consultantWhatsappConfig)
      .where(
        and(
          eq(consultantWhatsappConfig.publicSlug, cleanSlug),
          eq(consultantWhatsappConfig.level, "1"),
          eq(consultantWhatsappConfig.isActive, true)
        )
      )
      .limit(1);

    if (!agent) {
      return res.status(404).json({ error: "Agente non trovato" });
    }

    const [consultant] = await db.select({
      pricingPageSlug: users.pricingPageSlug,
      username: users.username,
    })
      .from(users)
      .where(eq(users.id, agent.consultantId))
      .limit(1);

    const clientIP = getClientIP(req);
    const today = new Date().toISOString().split('T')[0];
    const dailyLimit = agent.dailyMessageLimit || 15;

    const currentCount = await getRateLimitCount(clientIP, slug.trim(), today);

    if (currentCount >= dailyLimit) {
      const consultantSlugValue = consultant?.pricingPageSlug || consultant?.username || null;
      const upgradeUrl = consultantSlugValue 
        ? `/c/${consultantSlugValue}/pricing` 
        : null;
      
      return res.status(429).json({
        error: "Limite messaggi giornaliero raggiunto",
        upgradeUrl,
        remainingMessages: 0,
      });
    }

    const newCount = await incrementRateLimit(clientIP, slug.trim(), today);
    const remainingMessages = dailyLimit - newCount;

    let aiResponse = "";

    try {
      const aiProvider = await getAIProvider(agent.consultantId, agent.consultantId);
      const { model: modelName } = getModelWithThinking(aiProvider.metadata.name);

      const systemPrompt = await buildWhatsAppAgentPrompt(agent);

      const history = conversationHistory.map((msg: { role: string; content: string }) => ({
        role: msg.role === "user" ? "user" : "model",
        parts: [{ text: msg.content }],
      }));

      history.push({
        role: "user",
        parts: [{ text: message.trim() }],
      });

      const result = await aiProvider.client.generateContent({
        model: modelName,
        contents: history,
        generationConfig: {
          systemInstruction: systemPrompt,
          temperature: 0.7,
          topP: 0.95,
          maxOutputTokens: 2048,
        },
      });

      aiResponse = result.response.text() || "";
    } catch (aiError: any) {
      console.error("[PUBLIC AI CHAT] AI generation error:", aiError);
      aiResponse = "Mi dispiace, si è verificato un errore durante l'elaborazione. Riprova più tardi.";
    }

    res.json({
      response: aiResponse,
      remainingMessages,
    });
  } catch (error: any) {
    console.error("[PUBLIC AI CHAT] Chat error:", error);
    res.status(500).json({ error: "Errore interno del server" });
  }
});

export default router;
