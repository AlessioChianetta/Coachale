import { Router, Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { db } from "../db";
import { eq, and, desc, sql } from "drizzle-orm";
import {
  managerUsers,
  managerLinkAssignments,
  managerConversations,
  managerMessages,
  whatsappAgentShares,
  consultantWhatsappConfig,
} from "@shared/schema";
import { getAIProvider, getModelWithThinking } from "../ai/provider-factory";

const router = Router();
const JWT_SECRET = process.env.SESSION_SECRET || "manager-fallback-secret-key";

interface ManagerTokenPayload {
  managerId: string;
  consultantId: string;
  shareId: string;
  role: string;
}

interface ManagerRequest extends Request {
  manager?: ManagerTokenPayload;
  share?: typeof whatsappAgentShares.$inferSelect;
  agentConfig?: typeof consultantWhatsappConfig.$inferSelect;
}

async function verifyManagerToken(
  req: ManagerRequest,
  res: Response,
  next: NextFunction
) {
  try {
    let token = req.headers.authorization?.replace("Bearer ", "");
    
    if (!token && req.cookies?.managerToken) {
      token = req.cookies.managerToken;
    }

    if (!token) {
      return res.status(401).json({ message: "Authentication required" });
    }

    const decoded = jwt.verify(token, JWT_SECRET) as ManagerTokenPayload;
    
    if (decoded.role !== "manager") {
      return res.status(403).json({ message: "Invalid token role" });
    }

    const [manager] = await db.select()
      .from(managerUsers)
      .where(eq(managerUsers.id, decoded.managerId))
      .limit(1);

    if (!manager || manager.status !== "active") {
      return res.status(403).json({ message: "Manager account not active" });
    }

    req.manager = decoded;
    next();
  } catch (error: any) {
    if (error.name === "JsonWebTokenError" || error.name === "TokenExpiredError") {
      return res.status(401).json({ message: "Invalid or expired token" });
    }
    console.error("[PUBLIC AGENT] Token verification error:", error);
    return res.status(500).json({ message: "Authentication error" });
  }
}

async function loadShareAndAgent(
  req: ManagerRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const { slug } = req.params;

    if (!slug) {
      return res.status(400).json({ message: "Slug is required" });
    }

    const [share] = await db.select()
      .from(whatsappAgentShares)
      .where(eq(whatsappAgentShares.slug, slug))
      .limit(1);

    if (!share) {
      return res.status(404).json({ message: "Agent not found" });
    }

    if (!share.isActive) {
      return res.status(403).json({ message: "Agent is not active" });
    }

    if (share.expireAt && new Date(share.expireAt) < new Date()) {
      return res.status(403).json({ message: "Agent link has expired" });
    }

    const [agentConfig] = await db.select()
      .from(consultantWhatsappConfig)
      .where(eq(consultantWhatsappConfig.id, share.agentConfigId))
      .limit(1);

    if (!agentConfig) {
      return res.status(404).json({ message: "Agent configuration not found" });
    }

    req.share = share;
    req.agentConfig = agentConfig;
    next();
  } catch (error: any) {
    console.error("[PUBLIC AGENT] Load share error:", error);
    return res.status(500).json({ message: "Failed to load agent" });
  }
}

router.get("/:slug", loadShareAndAgent, async (req: ManagerRequest, res: Response) => {
  try {
    const share = req.share!;
    const agentConfig = req.agentConfig!;

    res.json({
      agentName: share.agentName,
      description: agentConfig.businessDescription || null,
      requiresLogin: share.requiresLogin,
      businessName: agentConfig.businessName || null,
      consultantName: agentConfig.consultantDisplayName || null,
    });
  } catch (error: any) {
    console.error("[PUBLIC AGENT] Get info error:", error);
    res.status(500).json({ message: "Failed to get agent info" });
  }
});

router.get(
  "/:slug/manager/me",
  loadShareAndAgent,
  verifyManagerToken,
  async (req: ManagerRequest, res: Response) => {
    try {
      const manager = req.manager!;
      const share = req.share!;

      if (manager.shareId !== share.id) {
        return res.status(403).json({ message: "Access denied to this agent" });
      }

      const [managerData] = await db.select({
        id: managerUsers.id,
        name: managerUsers.name,
        email: managerUsers.email,
        status: managerUsers.status,
      })
        .from(managerUsers)
        .where(eq(managerUsers.id, manager.managerId))
        .limit(1);

      if (!managerData) {
        return res.status(404).json({ message: "Manager not found" });
      }

      res.json(managerData);
    } catch (error: any) {
      console.error("[PUBLIC AGENT] Get manager info error:", error);
      res.status(500).json({ message: "Failed to get manager info" });
    }
  }
);

router.get(
  "/:slug/conversations",
  loadShareAndAgent,
  verifyManagerToken,
  async (req: ManagerRequest, res: Response) => {
    try {
      const share = req.share!;
      const manager = req.manager!;

      if (manager.shareId !== share.id) {
        return res.status(403).json({ message: "Access denied to this agent" });
      }

      const conversations = await db.select({
        id: managerConversations.id,
        title: managerConversations.title,
        messageCount: managerConversations.messageCount,
        lastMessageAt: managerConversations.lastMessageAt,
        createdAt: managerConversations.createdAt,
      })
        .from(managerConversations)
        .where(and(
          eq(managerConversations.managerId, manager.managerId),
          eq(managerConversations.shareId, share.id)
        ))
        .orderBy(desc(managerConversations.lastMessageAt));

      res.json(conversations);
    } catch (error: any) {
      console.error("[PUBLIC AGENT] List conversations error:", error);
      res.status(500).json({ message: "Failed to list conversations" });
    }
  }
);

router.post(
  "/:slug/conversations",
  loadShareAndAgent,
  verifyManagerToken,
  async (req: ManagerRequest, res: Response) => {
    try {
      const share = req.share!;
      const manager = req.manager!;

      if (manager.shareId !== share.id) {
        return res.status(403).json({ message: "Access denied to this agent" });
      }

      const [conversation] = await db.insert(managerConversations).values({
        managerId: manager.managerId,
        shareId: share.id,
        agentConfigId: share.agentConfigId,
        title: "Nuova conversazione",
        messageCount: 0,
        metadata: {
          userAgent: req.headers["user-agent"],
          ipAddress: req.ip,
        },
      }).returning();

      res.status(201).json(conversation);
    } catch (error: any) {
      console.error("[PUBLIC AGENT] Create conversation error:", error);
      res.status(500).json({ message: "Failed to create conversation" });
    }
  }
);

router.get(
  "/:slug/conversations/:conversationId",
  loadShareAndAgent,
  verifyManagerToken,
  async (req: ManagerRequest, res: Response) => {
    try {
      const share = req.share!;
      const manager = req.manager!;
      const { conversationId } = req.params;

      if (manager.shareId !== share.id) {
        return res.status(403).json({ message: "Access denied to this agent" });
      }

      const [conversation] = await db.select()
        .from(managerConversations)
        .where(and(
          eq(managerConversations.id, conversationId),
          eq(managerConversations.managerId, manager.managerId),
          eq(managerConversations.shareId, share.id)
        ))
        .limit(1);

      if (!conversation) {
        return res.status(404).json({ message: "Conversation not found" });
      }

      const messages = await db.select()
        .from(managerMessages)
        .where(eq(managerMessages.conversationId, conversationId))
        .orderBy(managerMessages.createdAt);

      res.json({
        ...conversation,
        messages,
      });
    } catch (error: any) {
      console.error("[PUBLIC AGENT] Get conversation error:", error);
      res.status(500).json({ message: "Failed to get conversation" });
    }
  }
);

router.post(
  "/:slug/conversations/:conversationId/messages",
  loadShareAndAgent,
  verifyManagerToken,
  async (req: ManagerRequest, res: Response) => {
    try {
      const share = req.share!;
      const agentConfig = req.agentConfig!;
      const manager = req.manager!;
      const { conversationId } = req.params;
      const { content, preferences } = req.body;

      if (manager.shareId !== share.id) {
        return res.status(403).json({ message: "Access denied to this agent" });
      }

      if (!content || typeof content !== "string" || content.trim().length === 0) {
        return res.status(400).json({ message: "Message content is required" });
      }

      const [conversation] = await db.select()
        .from(managerConversations)
        .where(and(
          eq(managerConversations.id, conversationId),
          eq(managerConversations.managerId, manager.managerId),
          eq(managerConversations.shareId, share.id)
        ))
        .limit(1);

      if (!conversation) {
        return res.status(404).json({ message: "Conversation not found" });
      }

      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      res.setHeader("X-Accel-Buffering", "no");

      const sendSSE = (data: any) => {
        res.write(`data: ${JSON.stringify(data)}\n\n`);
      };

      const [userMessage] = await db.insert(managerMessages).values({
        conversationId,
        role: "user",
        content: content.trim(),
        status: "completed",
      }).returning();

      const previousMessages = await db.select()
        .from(managerMessages)
        .where(eq(managerMessages.conversationId, conversationId))
        .orderBy(managerMessages.createdAt)
        .limit(20);

      let aiResponseContent = "";
      let modelUsed = "";

      try {
        const aiProvider = await getAIProvider(agentConfig.consultantId, agentConfig.consultantId);
        const { model: modelName } = getModelWithThinking(aiProvider.metadata.name);
        modelUsed = modelName;

        let styleInstructions = "";
        if (preferences) {
          const { writingStyle, responseLength, customInstructions } = preferences;
          
          if (writingStyle === 'conversational') {
            styleInstructions += "\n\nStile di comunicazione: Usa un tono amichevole e informale, come se stessi parlando con un collega.";
          } else if (writingStyle === 'professional') {
            styleInstructions += "\n\nStile di comunicazione: Mantieni un tono formale e professionale, appropriato per contesti business.";
          } else if (writingStyle === 'concise') {
            styleInstructions += "\n\nStile di comunicazione: Sii breve e diretto. Vai subito al punto senza dilungarti.";
          } else if (writingStyle === 'detailed') {
            styleInstructions += "\n\nStile di comunicazione: Fornisci spiegazioni approfondite e dettagliate, con esempi quando utile.";
          } else if (writingStyle === 'custom' && customInstructions) {
            styleInstructions += `\n\nIstruzioni personalizzate dell'utente: ${customInstructions}`;
          }
          
          if (responseLength === 'brief') {
            styleInstructions += "\nLunghezza risposta: Mantieni le risposte brevi, 1-2 paragrafi al massimo.";
          } else if (responseLength === 'comprehensive') {
            styleInstructions += "\nLunghezza risposta: Fornisci risposte complete ed esaustive, coprendo tutti gli aspetti rilevanti.";
          }
        }

        const systemPrompt = (agentConfig.agentInstructions || 
          `Sei ${agentConfig.agentName}, un assistente AI professionale per ${agentConfig.businessName || "l'azienda"}.
${agentConfig.businessDescription ? `Descrizione: ${agentConfig.businessDescription}` : ""}
Rispondi in modo professionale e utile.`) + styleInstructions;

        const conversationHistory = previousMessages.slice(0, -1).map(msg => ({
          role: msg.role === "user" ? "user" : "model",
          parts: [{ text: msg.content }],
        }));

        conversationHistory.push({
          role: "user",
          parts: [{ text: content.trim() }],
        });

        const result = await aiProvider.client.models.generateContent({
          model: modelName,
          systemInstruction: systemPrompt,
          contents: conversationHistory,
          generationConfig: {
            temperature: 0.7,
            topP: 0.95,
            maxOutputTokens: 4096,
          },
        });

        aiResponseContent = result.response.text() || "";
        sendSSE({ type: "delta", content: aiResponseContent });
      } catch (aiError: any) {
        console.error("[PUBLIC AGENT] AI generation error:", aiError);
        aiResponseContent = "Mi dispiace, si è verificato un errore durante l'elaborazione della risposta. Riprova più tardi.";
        sendSSE({ type: "delta", content: aiResponseContent });
      }

      const [assistantMessage] = await db.insert(managerMessages).values({
        conversationId,
        role: "assistant",
        content: aiResponseContent,
        status: "completed",
        metadata: { modelUsed },
      }).returning();

      const newMessageCount = (conversation.messageCount || 0) + 2;
      await db.update(managerConversations)
        .set({
          messageCount: newMessageCount,
          lastMessageAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(managerConversations.id, conversationId));

      if (newMessageCount === 2) {
        const titlePrompt = `Genera un titolo breve (max 5 parole) per questa conversazione basandoti sul primo messaggio dell'utente: "${content.trim()}"`;
        try {
          const aiProvider = await getAIProvider(agentConfig.consultantId, agentConfig.consultantId);
          const { model: modelName } = getModelWithThinking(aiProvider.metadata.name);
          
          const titleResult = await aiProvider.client.models.generateContent({
            model: modelName,
            contents: [{ role: "user", parts: [{ text: titlePrompt }] }],
            generationConfig: { temperature: 0.5, maxOutputTokens: 50 },
          });

          const generatedTitle = (titleResult.response.text() || "").trim().replace(/["\n]/g, "").slice(0, 100);
          if (generatedTitle) {
            await db.update(managerConversations)
              .set({ title: generatedTitle })
              .where(eq(managerConversations.id, conversationId));
          }
        } catch (titleError) {
          console.error("[PUBLIC AGENT] Title generation error:", titleError);
        }
      }

      sendSSE({ type: "complete", messageId: assistantMessage.id });
      res.end();
    } catch (error: any) {
      console.error("[PUBLIC AGENT] Send message error:", error);
      res.status(500).json({ message: "Failed to send message" });
    }
  }
);

router.delete(
  "/:slug/conversations/:conversationId",
  loadShareAndAgent,
  verifyManagerToken,
  async (req: ManagerRequest, res: Response) => {
    try {
      const share = req.share!;
      const manager = req.manager!;
      const { conversationId } = req.params;

      if (manager.shareId !== share.id) {
        return res.status(403).json({ message: "Access denied to this agent" });
      }

      const [conversation] = await db.select()
        .from(managerConversations)
        .where(and(
          eq(managerConversations.id, conversationId),
          eq(managerConversations.managerId, manager.managerId),
          eq(managerConversations.shareId, share.id)
        ))
        .limit(1);

      if (!conversation) {
        return res.status(404).json({ message: "Conversation not found" });
      }

      await db.delete(managerConversations)
        .where(eq(managerConversations.id, conversationId));

      res.json({ message: "Conversation deleted successfully" });
    } catch (error: any) {
      console.error("[PUBLIC AGENT] Delete conversation error:", error);
      res.status(500).json({ message: "Failed to delete conversation" });
    }
  }
);

router.post(
  "/:slug/anonymous/chat",
  loadShareAndAgent,
  async (req: ManagerRequest, res: Response) => {
    try {
      const share = req.share!;
      const agentConfig = req.agentConfig!;
      const { content, conversationHistory = [] } = req.body;

      if (share.requiresLogin) {
        return res.status(403).json({ message: "This agent requires login. Please authenticate first." });
      }

      if (!content || typeof content !== "string" || content.trim().length === 0) {
        return res.status(400).json({ message: "Message content is required" });
      }

      let aiResponseContent = "Mi dispiace, si è verificato un errore. Riprova più tardi.";

      try {
        const aiProvider = await getAIProvider(agentConfig.consultantId, agentConfig.consultantId);
        const { model: modelName } = getModelWithThinking(aiProvider.metadata.name);

        const systemPrompt = agentConfig.agentInstructions || 
          `Sei ${agentConfig.agentName}, un assistente AI professionale per ${agentConfig.businessName || "l'azienda"}.
${agentConfig.businessDescription ? `Descrizione: ${agentConfig.businessDescription}` : ""}
Rispondi in modo professionale e utile.`;

        const geminiHistory = conversationHistory.map((msg: { role: string; content: string }) => ({
          role: msg.role === "user" ? "user" : "model",
          parts: [{ text: msg.content }],
        }));

        geminiHistory.push({
          role: "user",
          parts: [{ text: content.trim() }],
        });

        const result = await aiProvider.client.models.generateContent({
          model: modelName,
          systemInstruction: systemPrompt,
          contents: geminiHistory,
          generationConfig: {
            temperature: 0.7,
            topP: 0.95,
            maxOutputTokens: 4096,
          },
        });

        aiResponseContent = result.response.text() || aiResponseContent;

        await db.update(whatsappAgentShares)
          .set({ 
            totalMessagesCount: sql`${whatsappAgentShares.totalMessagesCount} + 1`,
            lastAccessAt: new Date(),
          })
          .where(eq(whatsappAgentShares.id, share.id));

      } catch (aiError: any) {
        console.error("[PUBLIC AGENT] Anonymous AI error:", aiError);
      }

      res.json({
        role: "assistant",
        content: aiResponseContent,
      });
    } catch (error: any) {
      console.error("[PUBLIC AGENT] Anonymous chat error:", error);
      res.status(500).json({ message: "Failed to process message" });
    }
  }
);

export default router;
