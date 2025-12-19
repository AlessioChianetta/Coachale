/**
 * Follow-up API Routes
 * CRUD endpoints per regole automazione, template e conversation states
 */

import { Router } from "express";
import { db } from "../db";
import * as schema from "../../shared/schema";
import { eq, and, desc, sql, gte, lte, inArray } from "drizzle-orm";
import { authenticateToken, requireRole } from "../middleware/auth";
import { getAIProvider } from "../ai/provider-factory";
import { evaluateWithHumanLikeAI, ConversationContext, enrichMessages, logHumanLikeDecision } from "../ai/human-like-decision-engine";
import { getLastMessages, getAvailableTemplates } from "../cron/followup-scheduler";

const router = Router();

// ═══════════════════════════════════════════════════════════════════════════
// FOLLOWUP RULES CRUD
// ═══════════════════════════════════════════════════════════════════════════

router.get("/rules", authenticateToken, requireRole("consultant"), async (req, res) => {
  try {
    const rules = await db
      .select()
      .from(schema.followupRules)
      .where(eq(schema.followupRules.consultantId, req.user!.id))
      .orderBy(desc(schema.followupRules.priority));

    res.json(rules);
  } catch (error: any) {
    console.error("Error fetching followup rules:", error);
    res.status(500).json({ message: error.message });
  }
});

router.post("/rules", authenticateToken, requireRole("consultant"), async (req, res) => {
  try {
    const { name, description, triggerType, triggerCondition, templateId, fallbackMessage,
      applicableToStates, applicableToAgentTypes, applicableToChannels,
      maxAttempts, cooldownHours, priority, isActive, isDefault, agentId } = req.body;

    const [newRule] = await db
      .insert(schema.followupRules)
      .values({
        consultantId: req.user!.id,
        agentId: agentId || null,
        name,
        description,
        triggerType: triggerType || "time_based",
        triggerCondition: triggerCondition || {},
        templateId: templateId || null,
        fallbackMessage,
        applicableToStates: applicableToStates || [],
        applicableToAgentTypes: applicableToAgentTypes || [],
        applicableToChannels: applicableToChannels || [],
        maxAttempts: maxAttempts || 3,
        cooldownHours: cooldownHours || 24,
        priority: priority || 5,
        isActive: isActive !== false,
        isDefault: isDefault || false,
      })
      .returning();

    res.status(201).json(newRule);
  } catch (error: any) {
    console.error("Error creating followup rule:", error);
    res.status(500).json({ message: error.message });
  }
});

router.put("/rules/:id", authenticateToken, requireRole("consultant"), async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const [existingRule] = await db
      .select()
      .from(schema.followupRules)
      .where(and(
        eq(schema.followupRules.id, id),
        eq(schema.followupRules.consultantId, req.user!.id)
      ))
      .limit(1);

    if (!existingRule) {
      return res.status(404).json({ message: "Rule not found" });
    }

    const [updatedRule] = await db
      .update(schema.followupRules)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(schema.followupRules.id, id))
      .returning();

    res.json(updatedRule);
  } catch (error: any) {
    console.error("Error updating followup rule:", error);
    res.status(500).json({ message: error.message });
  }
});

router.delete("/rules/:id", authenticateToken, requireRole("consultant"), async (req, res) => {
  try {
    const { id } = req.params;

    const [existingRule] = await db
      .select()
      .from(schema.followupRules)
      .where(and(
        eq(schema.followupRules.id, id),
        eq(schema.followupRules.consultantId, req.user!.id)
      ))
      .limit(1);

    if (!existingRule) {
      return res.status(404).json({ message: "Rule not found" });
    }

    await db.delete(schema.followupRules).where(eq(schema.followupRules.id, id));

    res.json({ message: "Rule deleted successfully" });
  } catch (error: any) {
    console.error("Error deleting followup rule:", error);
    res.status(500).json({ message: error.message });
  }
});

router.patch("/rules/:id/toggle", authenticateToken, requireRole("consultant"), async (req, res) => {
  try {
    const { id } = req.params;

    const [existingRule] = await db
      .select()
      .from(schema.followupRules)
      .where(and(
        eq(schema.followupRules.id, id),
        eq(schema.followupRules.consultantId, req.user!.id)
      ))
      .limit(1);

    if (!existingRule) {
      return res.status(404).json({ message: "Rule not found" });
    }

    const [updatedRule] = await db
      .update(schema.followupRules)
      .set({ isActive: !existingRule.isActive, updatedAt: new Date() })
      .where(eq(schema.followupRules.id, id))
      .returning();

    res.json(updatedRule);
  } catch (error: any) {
    console.error("Error toggling followup rule:", error);
    res.status(500).json({ message: error.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// SEED DEFAULT RULES
// ═══════════════════════════════════════════════════════════════════════════

router.post("/rules/seed-defaults", authenticateToken, requireRole("consultant"), async (req, res) => {
  try {
    // Check if user already has rules
    const existingRules = await db
      .select()
      .from(schema.followupRules)
      .where(eq(schema.followupRules.consultantId, req.user!.id))
      .limit(1);

    if (existingRules.length > 0) {
      return res.status(400).json({
        message: "Hai già delle regole configurate. Elimina le regole esistenti prima di creare quelle predefinite."
      });
    }

    // Default rules for WhatsApp follow-up scenarios
    // Distinzione chiave: 
    // - Entro 24h dall'ultimo messaggio lead: AI genera messaggio intelligente leggendo la chat
    // - Oltre 24h: WhatsApp richiede template approvati
    const defaultRules = [
      // ═══════════════════════════════════════════════════════════════
      // REGOLE ENTRO 24H - AI genera messaggi intelligenti
      // ═══════════════════════════════════════════════════════════════
      {
        consultantId: req.user!.id,
        name: "AI Follow-up Intelligente (entro 24h)",
        description: "L'AI legge la cronologia della chat e genera un messaggio di follow-up personalizzato e contestuale. Attivo solo se il lead ha scritto nelle ultime 24h.",
        triggerType: "ai_decision" as const,
        triggerCondition: { hoursWithoutReply: 4, maxHoursSinceLeadMessage: 24 },
        fallbackMessage: "Ciao! Hai avuto modo di leggere il mio ultimo messaggio?",
        applicableToStates: ["new", "contacted", "interested", "qualified"],
        applicableToAgentTypes: [],
        applicableToChannels: ["whatsapp"],
        maxAttempts: 2,
        cooldownHours: 4,
        priority: 10,
        isActive: true,
        isDefault: true,
      },
      {
        consultantId: req.user!.id,
        name: "AI Secondo Tentativo (entro 24h)",
        description: "Secondo messaggio AI se il lead non risponde entro 8 ore. Sempre entro la finestra 24h.",
        triggerType: "ai_decision" as const,
        triggerCondition: { hoursWithoutReply: 8, maxHoursSinceLeadMessage: 24 },
        fallbackMessage: "Ciao! Ti scrivo per un breve aggiornamento. Fammi sapere se hai domande!",
        applicableToStates: ["contacted", "interested"],
        applicableToAgentTypes: [],
        applicableToChannels: ["whatsapp"],
        maxAttempts: 1,
        cooldownHours: 8,
        priority: 8,
        isActive: true,
        isDefault: true,
      },
      // ═══════════════════════════════════════════════════════════════
      // REGOLE OLTRE 24H - Richiedono template approvati WhatsApp
      // ═══════════════════════════════════════════════════════════════
      {
        consultantId: req.user!.id,
        name: "Template Follow-up 48h",
        description: "Dopo 48h senza risposta usa un template approvato. Richiede template assegnato all'agente.",
        triggerType: "time_based" as const,
        triggerCondition: { hoursWithoutReply: 48 },
        fallbackMessage: null,
        applicableToStates: ["contacted", "interested"],
        applicableToAgentTypes: [],
        applicableToChannels: ["whatsapp"],
        maxAttempts: 1,
        cooldownHours: 48,
        priority: 6,
        isActive: true,
        isDefault: true,
      },
      {
        consultantId: req.user!.id,
        name: "Template Ultimo Tentativo 7 giorni",
        description: "Ultimo follow-up dopo una settimana con template finale. Richiede template assegnato.",
        triggerType: "time_based" as const,
        triggerCondition: { daysWithoutReply: 7 },
        fallbackMessage: null,
        applicableToStates: ["contacted", "interested", "qualified"],
        applicableToAgentTypes: [],
        applicableToChannels: ["whatsapp"],
        maxAttempts: 1,
        cooldownHours: 168,
        priority: 4,
        isActive: true,
        isDefault: true,
      },
    ];

    const createdRules = await db
      .insert(schema.followupRules)
      .values(defaultRules)
      .returning();

    res.status(201).json({
      message: `Create ${createdRules.length} regole predefinite con successo!`,
      rules: createdRules,
    });
  } catch (error: any) {
    console.error("Error seeding default rules:", error);
    res.status(500).json({ message: error.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// AI RULE GENERATION
// ═══════════════════════════════════════════════════════════════════════════

router.post("/rules/generate-with-ai", authenticateToken, requireRole("consultant"), async (req, res) => {
  try {
    const { description } = req.body;

    if (!description || typeof description !== "string" || description.trim().length < 10) {
      return res.status(400).json({ message: "Descrizione troppo corta. Fornisci almeno 10 caratteri." });
    }

    const aiProvider = await getAIProvider(req.user!.id, "admin");

    if (!aiProvider) {
      return res.status(500).json({ message: "Impossibile accedere al provider AI. Contatta l'amministratore." });
    }

    const systemPrompt = `Sei un assistente AI specializzato nella creazione di regole di follow-up per automazioni WhatsApp e CRM.

Il tuo compito è interpretare una descrizione in linguaggio naturale e generare una regola di follow-up strutturata.

REGOLE:
1. triggerType può essere: "time_based", "event_based", o "ai_decision"
2. Per trigger time_based, usa hoursWithoutReply nel triggerCondition
3. maxAttempts deve essere tra 1 e 10
4. cooldownHours deve essere tra 1 e 168 (1 settimana)
5. priority deve essere tra 1 e 10 (10 = massima priorità)

Rispondi SOLO con un JSON valido, senza markdown o spiegazioni:
{
  "name": "Nome breve e descrittivo della regola",
  "description": "Descrizione dettagliata di cosa fa la regola",
  "triggerType": "time_based|event_based|ai_decision",
  "triggerCondition": { "hoursWithoutReply": numero },
  "fallbackMessage": "Messaggio da inviare se nessun template è disponibile",
  "maxAttempts": numero,
  "cooldownHours": numero,
  "priority": numero
}`;

    const userPrompt = `Crea una regola di follow-up basata su questa descrizione: "${description}"`;

    const result = await aiProvider.client.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        { role: "user", parts: [{ text: userPrompt }] }
      ],
      generationConfig: {
        systemInstruction: systemPrompt,
        temperature: 0.3,
        maxOutputTokens: 1024,
      }
    });

    const responseText = result.response.text();

    let jsonStr = responseText.trim();
    if (jsonStr.startsWith("```json")) {
      jsonStr = jsonStr.slice(7);
    } else if (jsonStr.startsWith("```")) {
      jsonStr = jsonStr.slice(3);
    }
    if (jsonStr.endsWith("```")) {
      jsonStr = jsonStr.slice(0, -3);
    }
    jsonStr = jsonStr.trim();

    const generatedRule = JSON.parse(jsonStr);

    const validatedRule = {
      name: generatedRule.name || "Nuova Regola AI",
      description: generatedRule.description || "",
      triggerType: ["time_based", "event_based", "ai_decision"].includes(generatedRule.triggerType)
        ? generatedRule.triggerType
        : "time_based",
      triggerCondition: generatedRule.triggerCondition || { hoursWithoutReply: 24 },
      fallbackMessage: generatedRule.fallbackMessage || "",
      maxAttempts: Math.min(10, Math.max(1, generatedRule.maxAttempts || 3)),
      cooldownHours: Math.min(168, Math.max(1, generatedRule.cooldownHours || 24)),
      priority: Math.min(10, Math.max(1, generatedRule.priority || 5)),
    };

    res.json({ success: true, data: validatedRule });
  } catch (error: any) {
    console.error("Error generating rule with AI:", error);

    if (error.message?.includes("JSON")) {
      return res.status(500).json({ success: false, message: "L'AI ha generato una risposta non valida. Riprova con una descrizione diversa." });
    }

    res.status(500).json({ success: false, message: error.message || "Errore durante la generazione della regola." });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// CONVERSATION STATES
// ═══════════════════════════════════════════════════════════════════════════

router.get("/conversations", authenticateToken, requireRole("consultant"), async (req, res) => {
  try {
    const conversations = await db
      .select({
        state: schema.conversationStates,
        conversation: schema.whatsappConversations,
      })
      .from(schema.conversationStates)
      .innerJoin(
        schema.whatsappConversations,
        eq(schema.conversationStates.conversationId, schema.whatsappConversations.id)
      )
      .innerJoin(
        schema.consultantWhatsappConfig,
        eq(schema.whatsappConversations.agentConfigId, schema.consultantWhatsappConfig.id)
      )
      .where(eq(schema.consultantWhatsappConfig.consultantId, req.user!.id))
      .orderBy(desc(schema.conversationStates.updatedAt));

    res.json(conversations);
  } catch (error: any) {
    console.error("Error fetching conversation states:", error);
    res.status(500).json({ message: error.message });
  }
});

router.get("/conversations/:id", authenticateToken, requireRole("consultant"), async (req, res) => {
  try {
    const { id } = req.params;

    const [result] = await db
      .select({
        state: schema.conversationStates,
        conversation: schema.whatsappConversations,
      })
      .from(schema.conversationStates)
      .innerJoin(
        schema.whatsappConversations,
        eq(schema.conversationStates.conversationId, schema.whatsappConversations.id)
      )
      .innerJoin(
        schema.consultantWhatsappConfig,
        eq(schema.whatsappConversations.agentConfigId, schema.consultantWhatsappConfig.id)
      )
      .where(and(
        eq(schema.conversationStates.conversationId, id),
        eq(schema.consultantWhatsappConfig.consultantId, req.user!.id)
      ))
      .limit(1);

    if (!result) {
      return res.status(404).json({ message: "Conversation not found" });
    }

    res.json(result);
  } catch (error: any) {
    console.error("Error fetching conversation state:", error);
    res.status(500).json({ message: error.message });
  }
});

router.patch("/conversations/:id/state", authenticateToken, requireRole("consultant"), async (req, res) => {
  try {
    const { id } = req.params;
    const { currentState, engagementScore, conversionProbability, aiRecommendation } = req.body;

    const [existingState] = await db
      .select()
      .from(schema.conversationStates)
      .where(eq(schema.conversationStates.conversationId, id))
      .limit(1);

    if (!existingState) {
      return res.status(404).json({ message: "Conversation state not found" });
    }

    const updateData: any = { updatedAt: new Date() };

    if (currentState) {
      updateData.currentState = currentState;
      updateData.previousState = existingState.currentState;
      updateData.stateChangedAt = new Date();
    }
    if (engagementScore !== undefined) updateData.engagementScore = engagementScore;
    if (conversionProbability !== undefined) updateData.conversionProbability = conversionProbability;
    if (aiRecommendation) updateData.aiRecommendation = aiRecommendation;

    const [updatedState] = await db
      .update(schema.conversationStates)
      .set(updateData)
      .where(eq(schema.conversationStates.id, existingState.id))
      .returning();

    res.json(updatedState);
  } catch (error: any) {
    console.error("Error updating conversation state:", error);
    res.status(500).json({ message: error.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// ANALYTICS
// ═══════════════════════════════════════════════════════════════════════════

router.get("/analytics", authenticateToken, requireRole("consultant"), async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    let query = db
      .select()
      .from(schema.followupAnalytics)
      .where(eq(schema.followupAnalytics.consultantId, req.user!.id));

    const analytics = await query.orderBy(desc(schema.followupAnalytics.date));

    const totals = await db
      .select({
        totalSent: sql<number>`COALESCE(SUM(${schema.followupAnalytics.messagesSent}), 0)`,
        totalDelivered: sql<number>`COALESCE(SUM(${schema.followupAnalytics.messagesDelivered}), 0)`,
        totalRead: sql<number>`COALESCE(SUM(${schema.followupAnalytics.messagesRead}), 0)`,
        totalReplies: sql<number>`COALESCE(SUM(${schema.followupAnalytics.repliesReceived}), 0)`,
        totalConversions: sql<number>`COALESCE(SUM(${schema.followupAnalytics.conversionsAchieved}), 0)`,
        aiDecisions: sql<number>`COALESCE(SUM(${schema.followupAnalytics.aiDecisionsMade}), 0)`,
      })
      .from(schema.followupAnalytics)
      .where(eq(schema.followupAnalytics.consultantId, req.user!.id));

    res.json({
      daily: analytics,
      totals: totals[0] || {},
    });
  } catch (error: any) {
    console.error("Error fetching followup analytics:", error);
    res.status(500).json({ message: error.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// SCHEDULED MESSAGES
// ═══════════════════════════════════════════════════════════════════════════

router.get("/scheduled", authenticateToken, requireRole("consultant"), async (req, res) => {
  try {
    const scheduled = await db
      .select({
        message: schema.scheduledFollowupMessages,
        conversation: schema.whatsappConversations,
      })
      .from(schema.scheduledFollowupMessages)
      .innerJoin(
        schema.whatsappConversations,
        eq(schema.scheduledFollowupMessages.conversationId, schema.whatsappConversations.id)
      )
      .innerJoin(
        schema.consultantWhatsappConfig,
        eq(schema.whatsappConversations.agentConfigId, schema.consultantWhatsappConfig.id)
      )
      .where(eq(schema.consultantWhatsappConfig.consultantId, req.user!.id))
      .orderBy(schema.scheduledFollowupMessages.scheduledFor);

    res.json(scheduled);
  } catch (error: any) {
    console.error("Error fetching scheduled messages:", error);
    res.status(500).json({ message: error.message });
  }
});

router.delete("/scheduled/:id", authenticateToken, requireRole("consultant"), async (req, res) => {
  try {
    const { id } = req.params;

    await db
      .update(schema.scheduledFollowupMessages)
      .set({
        status: "cancelled",
        cancelledAt: new Date(),
        cancelReason: "manual"
      })
      .where(eq(schema.scheduledFollowupMessages.id, id));

    res.json({ message: "Scheduled message cancelled" });
  } catch (error: any) {
    console.error("Error cancelling scheduled message:", error);
    res.status(500).json({ message: error.message });
  }
});

router.post("/messages/:id/retry", authenticateToken, requireRole("consultant"), async (req, res) => {
  try {
    const { id } = req.params;
    const consultantId = req.user!.id;

    console.log(`🔄 [FOLLOWUP-API] Retry requested for message ${id} by consultant ${consultantId}`);

    const [messageWithConversation] = await db
      .select({
        message: schema.scheduledFollowupMessages,
        conversation: schema.whatsappConversations,
      })
      .from(schema.scheduledFollowupMessages)
      .innerJoin(
        schema.whatsappConversations,
        eq(schema.scheduledFollowupMessages.conversationId, schema.whatsappConversations.id)
      )
      .where(eq(schema.scheduledFollowupMessages.id, id))
      .limit(1);

    if (!messageWithConversation) {
      return res.status(404).json({ success: false, message: "Messaggio non trovato" });
    }

    if (messageWithConversation.conversation.consultantId !== consultantId) {
      return res.status(403).json({ success: false, message: "Non autorizzato" });
    }

    if (messageWithConversation.message.status !== 'failed') {
      return res.status(400).json({ success: false, message: "Solo i messaggi falliti possono essere ritentati" });
    }

    const now = new Date();
    const retryIn5Min = new Date(now.getTime() + 5 * 60 * 1000);

    await db
      .update(schema.scheduledFollowupMessages)
      .set({
        status: 'pending',
        scheduledFor: retryIn5Min,
        nextRetryAt: retryIn5Min,
        attemptCount: 0,
        errorMessage: null,
        lastErrorCode: null,
        failureReason: null,
      })
      .where(eq(schema.scheduledFollowupMessages.id, id));

    console.log(`✅ [FOLLOWUP-API] Message ${id} queued for retry at ${retryIn5Min.toISOString()}`);

    res.json({
      success: true,
      message: "Messaggio schedulato per ritentativo",
      retryAt: retryIn5Min.toISOString()
    });
  } catch (error: any) {
    console.error("Error retrying message:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get("/failed-messages", authenticateToken, requireRole("consultant"), async (req, res) => {
  try {
    const consultantId = req.user!.id;

    const failedMessages = await db
      .select({
        id: schema.scheduledFollowupMessages.id,
        conversationId: schema.scheduledFollowupMessages.conversationId,
        status: schema.scheduledFollowupMessages.status,
        errorMessage: schema.scheduledFollowupMessages.errorMessage,
        lastErrorCode: schema.scheduledFollowupMessages.lastErrorCode,
        failureReason: schema.scheduledFollowupMessages.failureReason,
        attemptCount: schema.scheduledFollowupMessages.attemptCount,
        maxAttempts: schema.scheduledFollowupMessages.maxAttempts,
        lastAttemptAt: schema.scheduledFollowupMessages.lastAttemptAt,
        createdAt: schema.scheduledFollowupMessages.createdAt,
        phoneNumber: schema.whatsappConversations.phoneNumber,
      })
      .from(schema.scheduledFollowupMessages)
      .innerJoin(
        schema.whatsappConversations,
        eq(schema.scheduledFollowupMessages.conversationId, schema.whatsappConversations.id)
      )
      .where(
        and(
          eq(schema.whatsappConversations.consultantId, consultantId),
          eq(schema.scheduledFollowupMessages.status, 'failed')
        )
      )
      .orderBy(desc(schema.scheduledFollowupMessages.lastAttemptAt))
      .limit(50);

    res.json(failedMessages);
  } catch (error: any) {
    console.error("Error fetching failed messages:", error);
    res.status(500).json({ message: error.message });
  }
});

router.post("/messages/:id/send-now", authenticateToken, requireRole("consultant"), async (req, res) => {
  try {
    const { id } = req.params;
    const consultantId = req.user!.id;

    console.log(`🚀 [FOLLOWUP-API] Send-now requested for message ${id} by consultant ${consultantId}`);

    const [messageWithConversation] = await db
      .select({
        message: schema.scheduledFollowupMessages,
        conversation: schema.whatsappConversations,
        agent: schema.consultantWhatsappConfig,
      })
      .from(schema.scheduledFollowupMessages)
      .innerJoin(
        schema.whatsappConversations,
        eq(schema.scheduledFollowupMessages.conversationId, schema.whatsappConversations.id)
      )
      .innerJoin(
        schema.consultantWhatsappConfig,
        eq(schema.whatsappConversations.agentConfigId, schema.consultantWhatsappConfig.id)
      )
      .where(eq(schema.scheduledFollowupMessages.id, id))
      .limit(1);

    if (!messageWithConversation) {
      return res.status(404).json({
        success: false,
        message: "Messaggio non trovato"
      });
    }

    if (messageWithConversation.agent.consultantId !== consultantId) {
      return res.status(403).json({
        success: false,
        message: "Non hai i permessi per inviare questo messaggio"
      });
    }

    if (messageWithConversation.message.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: `Il messaggio non è in stato pending (stato attuale: ${messageWithConversation.message.status})`
      });
    }

    await db
      .update(schema.scheduledFollowupMessages)
      .set({ scheduledFor: new Date() })
      .where(eq(schema.scheduledFollowupMessages.id, id));

    console.log(`📤 [FOLLOWUP-API] Processing message ${id} immediately...`);

    await processScheduledMessages([id]);

    const [updatedMessage] = await db
      .select()
      .from(schema.scheduledFollowupMessages)
      .where(eq(schema.scheduledFollowupMessages.id, id))
      .limit(1);

    console.log(`✅ [FOLLOWUP-API] Send-now completed for message ${id}, new status: ${updatedMessage?.status}`);

    res.json({
      success: true,
      message: updatedMessage?.status === 'sent'
        ? "Messaggio inviato con successo!"
        : `Messaggio elaborato (stato: ${updatedMessage?.status})`,
      status: updatedMessage?.status,
      sentAt: updatedMessage?.sentAt,
    });
  } catch (error: any) {
    console.error("Error sending message now:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Errore durante l'invio del messaggio"
    });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// AI EVALUATION LOGS
// ═══════════════════════════════════════════════════════════════════════════

router.get("/ai-logs", authenticateToken, requireRole("consultant"), async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
    const offset = parseInt(req.query.offset as string) || 0;

    // Get AI evaluation logs for this consultant's conversations
    const logs = await db
      .select({
        log: schema.followupAiEvaluationLog,
        conversation: {
          id: schema.whatsappConversations.id,
          phoneNumber: schema.whatsappConversations.phoneNumber,
        },
        agent: {
          id: schema.consultantWhatsappConfig.id,
          agentName: schema.consultantWhatsappConfig.agentName,
        },
        lead: {
          id: schema.proactiveLeads.id,
          firstName: schema.proactiveLeads.firstName,
          lastName: schema.proactiveLeads.lastName,
        },
      })
      .from(schema.followupAiEvaluationLog)
      .innerJoin(
        schema.whatsappConversations,
        eq(schema.followupAiEvaluationLog.conversationId, schema.whatsappConversations.id)
      )
      .innerJoin(
        schema.consultantWhatsappConfig,
        eq(schema.whatsappConversations.agentConfigId, schema.consultantWhatsappConfig.id)
      )
      .leftJoin(
        schema.proactiveLeads,
        eq(schema.whatsappConversations.proactiveLeadId, schema.proactiveLeads.id)
      )
      .where(eq(schema.consultantWhatsappConfig.consultantId, req.user!.id))
      .orderBy(desc(schema.followupAiEvaluationLog.createdAt))
      .limit(limit)
      .offset(offset);

    // Get total count
    const [countResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(schema.followupAiEvaluationLog)
      .innerJoin(
        schema.whatsappConversations,
        eq(schema.followupAiEvaluationLog.conversationId, schema.whatsappConversations.id)
      )
      .innerJoin(
        schema.consultantWhatsappConfig,
        eq(schema.whatsappConversations.agentConfigId, schema.consultantWhatsappConfig.id)
      )
      .where(eq(schema.consultantWhatsappConfig.consultantId, req.user!.id));

    res.json({
      logs,
      total: countResult?.count || 0,
      limit,
      offset,
    });
  } catch (error: any) {
    console.error("Error fetching AI evaluation logs:", error);
    res.status(500).json({ message: error.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// DASHBOARD STATS
// ═══════════════════════════════════════════════════════════════════════════

router.get("/dashboard-stats", authenticateToken, requireRole("consultant"), async (req, res) => {
  try {
    const consultantId = req.user!.id;
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const next24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    // Get all agent configs for this consultant
    const agentConfigs = await db
      .select({ id: schema.consultantWhatsappConfig.id })
      .from(schema.consultantWhatsappConfig)
      .where(eq(schema.consultantWhatsappConfig.consultantId, consultantId));

    const agentIds = agentConfigs.map(a => a.id);

    // 1. Conversations awaiting follow-up (active, not closed)
    const [awaitingFollowup] = await db
      .select({ count: sql<number>`count(*)` })
      .from(schema.conversationStates)
      .innerJoin(
        schema.whatsappConversations,
        eq(schema.conversationStates.conversationId, schema.whatsappConversations.id)
      )
      .where(
        and(
          eq(schema.whatsappConversations.consultantId, consultantId),
          eq(schema.whatsappConversations.isActive, true),
          sql`${schema.conversationStates.currentState} NOT IN ('closed_won', 'closed_lost')`
        )
      );

    // 2. Messages sent today
    const [sentToday] = await db
      .select({ count: sql<number>`count(*)` })
      .from(schema.scheduledFollowupMessages)
      .innerJoin(
        schema.whatsappConversations,
        eq(schema.scheduledFollowupMessages.conversationId, schema.whatsappConversations.id)
      )
      .where(
        and(
          eq(schema.whatsappConversations.consultantId, consultantId),
          eq(schema.scheduledFollowupMessages.status, 'sent'),
          gte(schema.scheduledFollowupMessages.sentAt, todayStart)
        )
      );

    // 3. Scheduled for next 24h (only future messages, not overdue)
    const [scheduledNext24h] = await db
      .select({ count: sql<number>`count(*)` })
      .from(schema.scheduledFollowupMessages)
      .innerJoin(
        schema.whatsappConversations,
        eq(schema.scheduledFollowupMessages.conversationId, schema.whatsappConversations.id)
      )
      .where(
        and(
          eq(schema.whatsappConversations.consultantId, consultantId),
          eq(schema.scheduledFollowupMessages.status, 'pending'),
          gte(schema.scheduledFollowupMessages.scheduledFor, now),
          lte(schema.scheduledFollowupMessages.scheduledFor, next24h)
        )
      );

    // 4. Blocked/Stopped leads (closed_lost or hasSaidNoExplicitly)
    const [blockedLeads] = await db
      .select({ count: sql<number>`count(*)` })
      .from(schema.conversationStates)
      .innerJoin(
        schema.whatsappConversations,
        eq(schema.conversationStates.conversationId, schema.whatsappConversations.id)
      )
      .where(
        and(
          eq(schema.whatsappConversations.consultantId, consultantId),
          sql`(${schema.conversationStates.currentState} = 'closed_lost' OR ${schema.conversationStates.hasSaidNoExplicitly} = true)`
        )
      );

    // 5. Errors (failed messages)
    const [errors] = await db
      .select({ count: sql<number>`count(*)` })
      .from(schema.scheduledFollowupMessages)
      .innerJoin(
        schema.whatsappConversations,
        eq(schema.scheduledFollowupMessages.conversationId, schema.whatsappConversations.id)
      )
      .where(
        and(
          eq(schema.whatsappConversations.consultantId, consultantId),
          eq(schema.scheduledFollowupMessages.status, 'failed')
        )
      );

    res.json({
      awaitingFollowup: Number(awaitingFollowup?.count) || 0,
      sentToday: Number(sentToday?.count) || 0,
      scheduledNext24h: Number(scheduledNext24h?.count) || 0,
      blockedLeads: Number(blockedLeads?.count) || 0,
      errors: Number(errors?.count) || 0,
    });
  } catch (error: any) {
    console.error("Error fetching dashboard stats:", error);
    res.status(500).json({ message: error.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// WEEKLY STATS (For dashboard charts)
// ═══════════════════════════════════════════════════════════════════════════

router.get("/stats/weekly", authenticateToken, requireRole("consultant"), async (req, res) => {
  try {
    const consultantId = req.user!.id;
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Daily stats for last 7 days
    const dailyStats = await db
      .select({
        date: sql<string>`DATE(${schema.scheduledFollowupMessages.createdAt})`,
        sent: sql<number>`COUNT(*) FILTER (WHERE ${schema.scheduledFollowupMessages.status} = 'sent')`,
        pending: sql<number>`COUNT(*) FILTER (WHERE ${schema.scheduledFollowupMessages.status} = 'pending')`,
        failed: sql<number>`COUNT(*) FILTER (WHERE ${schema.scheduledFollowupMessages.status} = 'failed')`,
        cancelled: sql<number>`COUNT(*) FILTER (WHERE ${schema.scheduledFollowupMessages.status} = 'cancelled')`,
      })
      .from(schema.scheduledFollowupMessages)
      .innerJoin(
        schema.whatsappConversations,
        eq(schema.scheduledFollowupMessages.conversationId, schema.whatsappConversations.id)
      )
      .where(
        and(
          eq(schema.whatsappConversations.consultantId, consultantId),
          gte(schema.scheduledFollowupMessages.createdAt, sevenDaysAgo)
        )
      )
      .groupBy(sql`DATE(${schema.scheduledFollowupMessages.createdAt})`)
      .orderBy(sql`DATE(${schema.scheduledFollowupMessages.createdAt})`);

    // Response rate: AI-generated vs Template messages
    const responseRates = await db
      .select({
        messageType: sql<string>`CASE WHEN ${schema.scheduledFollowupMessages.templateId} IS NOT NULL THEN 'template' ELSE 'ai' END`,
        totalSent: sql<number>`COUNT(*) FILTER (WHERE ${schema.scheduledFollowupMessages.status} = 'sent')`,
        gotReply: sql<number>`COUNT(*) FILTER (WHERE ${schema.scheduledFollowupMessages.status} = 'sent' AND EXISTS (
          SELECT 1 FROM ${schema.whatsappMessages} m 
          WHERE m.conversation_id = ${schema.scheduledFollowupMessages.conversationId}
          AND m.sender = 'client'
          AND m.created_at > ${schema.scheduledFollowupMessages.sentAt}
          AND m.created_at < ${schema.scheduledFollowupMessages.sentAt} + INTERVAL '24 hours'
        ))`,
      })
      .from(schema.scheduledFollowupMessages)
      .innerJoin(
        schema.whatsappConversations,
        eq(schema.scheduledFollowupMessages.conversationId, schema.whatsappConversations.id)
      )
      .where(
        and(
          eq(schema.whatsappConversations.consultantId, consultantId),
          gte(schema.scheduledFollowupMessages.createdAt, sevenDaysAgo)
        )
      )
      .groupBy(sql`CASE WHEN ${schema.scheduledFollowupMessages.templateId} IS NOT NULL THEN 'template' ELSE 'ai' END`);

    // Top 5 error messages
    const topErrors = await db
      .select({
        errorMessage: schema.scheduledFollowupMessages.errorMessage,
        count: sql<number>`COUNT(*)`,
      })
      .from(schema.scheduledFollowupMessages)
      .innerJoin(
        schema.whatsappConversations,
        eq(schema.scheduledFollowupMessages.conversationId, schema.whatsappConversations.id)
      )
      .where(
        and(
          eq(schema.whatsappConversations.consultantId, consultantId),
          eq(schema.scheduledFollowupMessages.status, 'failed'),
          sql`${schema.scheduledFollowupMessages.errorMessage} IS NOT NULL`
        )
      )
      .groupBy(schema.scheduledFollowupMessages.errorMessage)
      .orderBy(sql`COUNT(*) DESC`)
      .limit(5);

    // Fill in missing days with zeros
    const chartData = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const dateStr = date.toISOString().split('T')[0];
      const dayData = dailyStats.find(d => d.date === dateStr);
      chartData.push({
        date: dateStr,
        day: date.toLocaleDateString('it-IT', { weekday: 'short' }),
        sent: Number(dayData?.sent) || 0,
        pending: Number(dayData?.pending) || 0,
        failed: Number(dayData?.failed) || 0,
      });
    }

    // Format response rates with null safety
    const aiStats = responseRates.find(r => r.messageType === 'ai') || { totalSent: 0, gotReply: 0 };
    const templateStats = responseRates.find(r => r.messageType === 'template') || { totalSent: 0, gotReply: 0 };

    const aiSent = Number(aiStats.totalSent) || 0;
    const aiReplied = Number(aiStats.gotReply) || 0;
    const templateSent = Number(templateStats.totalSent) || 0;
    const templateReplied = Number(templateStats.gotReply) || 0;

    res.json({
      dailyChart: chartData,
      responseRates: {
        ai: {
          sent: aiSent,
          replied: aiReplied,
          rate: aiSent > 0 ? Math.round((aiReplied / aiSent) * 100) : 0,
        },
        template: {
          sent: templateSent,
          replied: templateReplied,
          rate: templateSent > 0 ? Math.round((templateReplied / templateSent) * 100) : 0,
        },
      },
      topErrors: topErrors.map(e => ({
        message: e.errorMessage || 'Errore sconosciuto',
        count: Number(e.count) || 0,
      })),
    });
  } catch (error: any) {
    console.error("Error fetching weekly stats:", error);
    res.status(500).json({ message: error.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// AGENTS LIST (For activity log filters)
// ═══════════════════════════════════════════════════════════════════════════

router.get("/agents", authenticateToken, requireRole("consultant"), async (req, res) => {
  try {
    const consultantId = req.user!.id;

    const agents = await db
      .select({
        id: schema.consultantWhatsappConfig.id,
        agentName: schema.consultantWhatsappConfig.agentName,
      })
      .from(schema.consultantWhatsappConfig)
      .where(eq(schema.consultantWhatsappConfig.consultantId, consultantId))
      .orderBy(schema.consultantWhatsappConfig.agentName);

    res.json(agents);
  } catch (error: any) {
    console.error("Error fetching agents:", error);
    res.status(500).json({ message: error.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// ACTIVITY LOG (Timeline aggregata per lead)
// ═══════════════════════════════════════════════════════════════════════════

router.get("/activity-log", authenticateToken, requireRole("consultant"), async (req, res) => {
  try {
    const consultantId = req.user!.id;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
    const filter = req.query.filter as string || 'all';
    const agentIdFilter = req.query.agentId as string || null;
    const searchQuery = req.query.search as string || null;
    const dateFrom = req.query.dateFrom as string || null;
    const dateTo = req.query.dateTo as string || null;

    // Build dynamic where conditions
    const buildWhereConditions = (baseCondition: any, createdAtField: any) => {
      const conditions = [baseCondition];

      if (agentIdFilter) {
        conditions.push(eq(schema.consultantWhatsappConfig.id, agentIdFilter));
      }
      if (dateFrom) {
        conditions.push(sql`${createdAtField} >= ${new Date(dateFrom)}`);
      }
      if (dateTo) {
        const endDate = new Date(dateTo);
        endDate.setHours(23, 59, 59, 999);
        conditions.push(sql`${createdAtField} <= ${endDate}`);
      }

      return and(...conditions);
    };

    // Get recent activity combining AI logs, scheduled messages, and proactive lead logs
    const aiLogs = await db
      .select({
        id: schema.followupAiEvaluationLog.id,
        conversationId: schema.followupAiEvaluationLog.conversationId,
        decision: schema.followupAiEvaluationLog.decision,
        reasoning: schema.followupAiEvaluationLog.reasoning,
        confidenceScore: schema.followupAiEvaluationLog.confidenceScore,
        matchedRuleId: schema.followupAiEvaluationLog.matchedRuleId,
        matchedRuleReason: schema.followupAiEvaluationLog.matchedRuleReason,
        createdAt: schema.followupAiEvaluationLog.createdAt,
        phoneNumber: schema.whatsappConversations.phoneNumber,
        agentName: schema.consultantWhatsappConfig.agentName,
        agentId: schema.consultantWhatsappConfig.id,
        leadFirstName: schema.proactiveLeads.firstName,
        leadLastName: schema.proactiveLeads.lastName,
        currentState: schema.conversationStates.currentState,
        temperatureLevel: schema.conversationStates.temperatureLevel,
        consecutiveNoReplyCount: schema.conversationStates.consecutiveNoReplyCount,
        lastAiEvaluationAt: schema.conversationStates.lastAiEvaluationAt,
      })
      .from(schema.followupAiEvaluationLog)
      .innerJoin(
        schema.whatsappConversations,
        eq(schema.followupAiEvaluationLog.conversationId, schema.whatsappConversations.id)
      )
      .innerJoin(
        schema.consultantWhatsappConfig,
        eq(schema.whatsappConversations.agentConfigId, schema.consultantWhatsappConfig.id)
      )
      .leftJoin(
        schema.proactiveLeads,
        eq(schema.whatsappConversations.proactiveLeadId, schema.proactiveLeads.id)
      )
      .leftJoin(
        schema.conversationStates,
        eq(schema.whatsappConversations.id, schema.conversationStates.conversationId)
      )
      .where(buildWhereConditions(
        eq(schema.consultantWhatsappConfig.consultantId, consultantId),
        schema.followupAiEvaluationLog.createdAt
      ))
      .orderBy(desc(schema.followupAiEvaluationLog.createdAt))
      .limit(limit);

    // Enrich AI logs with 24h window info
    const enrichedAiLogs = await Promise.all(aiLogs.map(async (log) => {
      const lastLeadMsg = await db
        .select({ createdAt: schema.whatsappMessages.createdAt })
        .from(schema.whatsappMessages)
        .where(
          and(
            eq(schema.whatsappMessages.conversationId, log.conversationId),
            eq(schema.whatsappMessages.sender, 'client')
          )
        )
        .orderBy(desc(schema.whatsappMessages.createdAt))
        .limit(1);

      const window24hExpiresAt = lastLeadMsg.length > 0 && lastLeadMsg[0].createdAt
        ? new Date(new Date(lastLeadMsg[0].createdAt).getTime() + 24 * 60 * 60 * 1000)
        : null;

      const canSendFreeform = window24hExpiresAt ? new Date() < window24hExpiresAt : false;

      return {
        ...log,
        window24hExpiresAt,
        canSendFreeform,
      };
    }));

    // Get scheduled/sent messages with template info, temperature, and template approval status
    const scheduledMessages = await db
      .select({
        id: schema.scheduledFollowupMessages.id,
        conversationId: schema.scheduledFollowupMessages.conversationId,
        status: schema.scheduledFollowupMessages.status,
        scheduledFor: schema.scheduledFollowupMessages.scheduledFor,
        sentAt: schema.scheduledFollowupMessages.sentAt,
        errorMessage: schema.scheduledFollowupMessages.errorMessage,
        aiDecisionReasoning: schema.scheduledFollowupMessages.aiDecisionReasoning,
        createdAt: schema.scheduledFollowupMessages.createdAt,
        phoneNumber: schema.whatsappConversations.phoneNumber,
        agentName: schema.consultantWhatsappConfig.agentName,
        agentId: schema.consultantWhatsappConfig.id,
        leadFirstName: schema.proactiveLeads.firstName,
        leadLastName: schema.proactiveLeads.lastName,
        templateId: schema.scheduledFollowupMessages.templateId,
        fallbackMessage: schema.scheduledFollowupMessages.fallbackMessage,
        savedMessagePreview: schema.scheduledFollowupMessages.messagePreview,
        aiSelectedTemplateReasoning: schema.scheduledFollowupMessages.aiSelectedTemplateReasoning,
        templateName: schema.whatsappCustomTemplates.templateName,
        templateBody: schema.whatsappCustomTemplates.body,
        templateTwilioStatus: schema.whatsappTemplateVersions.twilioStatus,
        temperatureLevel: schema.conversationStates.temperatureLevel,
        currentState: schema.conversationStates.currentState,
        consecutiveNoReplyCount: schema.conversationStates.consecutiveNoReplyCount,
        lastAiEvaluationAt: schema.conversationStates.lastAiEvaluationAt,
      })
      .from(schema.scheduledFollowupMessages)
      .innerJoin(
        schema.whatsappConversations,
        eq(schema.scheduledFollowupMessages.conversationId, schema.whatsappConversations.id)
      )
      .innerJoin(
        schema.consultantWhatsappConfig,
        eq(schema.whatsappConversations.agentConfigId, schema.consultantWhatsappConfig.id)
      )
      .leftJoin(
        schema.proactiveLeads,
        eq(schema.whatsappConversations.proactiveLeadId, schema.proactiveLeads.id)
      )
      .leftJoin(
        schema.whatsappCustomTemplates,
        eq(schema.scheduledFollowupMessages.templateId, schema.whatsappCustomTemplates.id)
      )
      .leftJoin(
        schema.whatsappTemplateVersions,
        and(
          eq(schema.whatsappTemplateVersions.templateId, schema.whatsappCustomTemplates.id),
          eq(schema.whatsappTemplateVersions.isActive, true)
        )
      )
      .leftJoin(
        schema.conversationStates,
        eq(schema.whatsappConversations.id, schema.conversationStates.conversationId)
      )
      .where(buildWhereConditions(
        eq(schema.consultantWhatsappConfig.consultantId, consultantId),
        schema.scheduledFollowupMessages.createdAt
      ))
      .orderBy(desc(schema.scheduledFollowupMessages.createdAt))
      .limit(limit);

    // Enrich scheduled messages with 24h window info
    const enrichedMessages = await Promise.all(scheduledMessages.map(async (msg) => {
      // Find last lead message to calculate 24h window
      const lastLeadMsg = await db
        .select({ createdAt: schema.whatsappMessages.createdAt })
        .from(schema.whatsappMessages)
        .where(
          and(
            eq(schema.whatsappMessages.conversationId, msg.conversationId),
            eq(schema.whatsappMessages.sender, 'client')
          )
        )
        .orderBy(desc(schema.whatsappMessages.createdAt))
        .limit(1);

      const window24hExpiresAt = lastLeadMsg.length > 0 && lastLeadMsg[0].createdAt
        ? new Date(new Date(lastLeadMsg[0].createdAt).getTime() + 24 * 60 * 60 * 1000)
        : null;

      const canSendFreeform = window24hExpiresAt ? new Date() < window24hExpiresAt : false;

      return {
        ...msg,
        window24hExpiresAt,
        canSendFreeform,
      };
    }));

    // Combine and format timeline events
    const events: any[] = [];

    for (const log of enrichedAiLogs) {
      events.push({
        id: `ai-${log.id}`,
        type: 'ai_evaluation',
        conversationId: log.conversationId,
        leadName: log.leadFirstName || log.leadLastName
          ? `${log.leadFirstName || ''} ${log.leadLastName || ''}`.trim()
          : log.phoneNumber,
        phoneNumber: log.phoneNumber,
        agentName: log.agentName || 'Agente',
        agentId: log.agentId,
        timestamp: log.createdAt,
        decision: log.decision,
        reasoning: log.reasoning,
        confidenceScore: log.confidenceScore,
        matchedRuleId: log.matchedRuleId,
        matchedRuleReason: log.matchedRuleReason,
        currentState: log.currentState,
        temperatureLevel: log.temperatureLevel || 'warm',
        consecutiveNoReplyCount: log.consecutiveNoReplyCount || 0,
        lastAiEvaluationAt: log.lastAiEvaluationAt,
        window24hExpiresAt: log.window24hExpiresAt,
        canSendFreeform: log.canSendFreeform,
        status: log.decision === 'stop' ? 'stopped' :
          log.decision === 'skip' ? 'waiting' :
            log.decision === 'send_now' ? 'active' : 'active',
      });
    }

    for (const msg of enrichedMessages) {
      let templateName = msg.templateName;
      let templateTwilioStatus = msg.templateTwilioStatus;
      let messagePreview = msg.savedMessagePreview || msg.fallbackMessage || msg.templateBody || null;

      // Se il templateId inizia con HX, usa il SID come nome (i template Twilio non sono memorizzati localmente)
      if (msg.templateId && msg.templateId.startsWith('HX') && !templateName) {
        templateName = msg.templateId;
        templateTwilioStatus = 'approved';
      }

      events.push({
        id: `msg-${msg.id}`,
        type: msg.status === 'sent' ? 'message_sent' :
          msg.status === 'failed' ? 'message_failed' :
            msg.status === 'pending' ? 'message_scheduled' : 'message_cancelled',
        conversationId: msg.conversationId,
        leadName: msg.leadFirstName || msg.leadLastName
          ? `${msg.leadFirstName || ''} ${msg.leadLastName || ''}`.trim()
          : msg.phoneNumber,
        phoneNumber: msg.phoneNumber,
        agentName: msg.agentName || 'Agente',
        agentId: msg.agentId,
        timestamp: msg.sentAt || msg.scheduledFor || msg.createdAt,
        reasoning: msg.aiDecisionReasoning,
        errorMessage: msg.errorMessage,
        status: msg.status === 'sent' ? 'active' :
          msg.status === 'failed' ? 'error' :
            msg.status === 'pending' ? 'scheduled' : 'cancelled',
        window24hExpiresAt: msg.window24hExpiresAt,
        canSendFreeform: msg.canSendFreeform,
        templateId: msg.templateId,
        templateName: templateName || (msg.templateId?.startsWith('HX') ? msg.templateId : null),
        templateTwilioStatus: templateTwilioStatus || (msg.templateId ? 'not_synced' : null),
        messagePreview: messagePreview,
        aiSelectedTemplateReasoning: msg.aiSelectedTemplateReasoning,
        temperatureLevel: msg.temperatureLevel || 'warm',
        currentState: msg.currentState,
        consecutiveNoReplyCount: msg.consecutiveNoReplyCount || 0,
        lastAiEvaluationAt: msg.lastAiEvaluationAt,
      });
    }

    // Sort by timestamp descending
    events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    // Filter by search query (name/phone)
    let filteredEvents = events;
    if (searchQuery) {
      const searchLower = searchQuery.toLowerCase();
      filteredEvents = filteredEvents.filter(e =>
        e.leadName?.toLowerCase().includes(searchLower) ||
        e.phoneNumber?.includes(searchQuery)
      );
    }

    // Filter by status/type
    if (filter === 'errors') {
      filteredEvents = filteredEvents.filter(e => e.status === 'error' || e.type === 'message_failed');
    } else if (filter === 'sent') {
      filteredEvents = filteredEvents.filter(e => e.type === 'message_sent');
    } else if (filter === 'stopped') {
      filteredEvents = filteredEvents.filter(e => e.decision === 'stop' || e.status === 'stopped');
    } else if (filter === 'scheduled') {
      filteredEvents = filteredEvents.filter(e => e.type === 'message_scheduled');
    }

    // Helper function to calculate next scheduled check based on temperature
    const calculateNextScheduledCheck = (lastEvalAt: Date | null, temperature: string): Date | null => {
      if (!lastEvalAt) return null;
      const lastEval = new Date(lastEvalAt);
      switch (temperature) {
        case 'hot':
        case 'warm':
          return new Date(lastEval.getTime() + 5 * 60 * 1000); // Every 5 minutes
        case 'cold':
          return new Date(lastEval.getTime() + 2 * 60 * 60 * 1000); // Every 2 hours
        case 'ghost':
          // Daily at 10:00, calculate next occurrence
          const next = new Date(lastEval);
          next.setHours(10, 0, 0, 0);
          if (next <= new Date()) next.setDate(next.getDate() + 1);
          return next;
        default:
          return new Date(lastEval.getTime() + 5 * 60 * 1000);
      }
    };

    // Group by conversation for timeline view
    const groupedByConversation: Record<string, any> = {};
    for (const event of filteredEvents.slice(0, limit)) {
      if (!groupedByConversation[event.conversationId]) {
        groupedByConversation[event.conversationId] = {
          conversationId: event.conversationId,
          leadName: event.leadName,
          leadPhone: event.phoneNumber,
          agentName: event.agentName,
          agentId: event.agentId,
          currentStatus: event.status,
          temperatureLevel: event.temperatureLevel || 'warm',
          currentState: event.currentState,
          window24hExpiresAt: event.window24hExpiresAt,
          consecutiveNoReplyCount: event.consecutiveNoReplyCount || 0,
          lastAiEvaluationAt: event.lastAiEvaluationAt,
          nextScheduledCheck: null,
          events: [],
        };
      }
      
      // Track the most recent lastAiEvaluationAt across all events
      const group = groupedByConversation[event.conversationId];
      if (event.lastAiEvaluationAt) {
        const eventEvalTime = new Date(event.lastAiEvaluationAt).getTime();
        const currentEvalTime = group.lastAiEvaluationAt 
          ? new Date(group.lastAiEvaluationAt).getTime() 
          : 0;
        if (eventEvalTime > currentEvalTime) {
          group.lastAiEvaluationAt = event.lastAiEvaluationAt;
        }
      }
      
      group.events.push(event);
    }
    
    // ═══════════════════════════════════════════════════════════════════════════
    // CRITICAL FIX: Fetch CURRENT conversationStates values for all grouped conversations
    // The events contain historical temperature values from when the event occurred,
    // but we need the CURRENT temperature (e.g., when a lead replies, webhook sets it to 'hot')
    // ═══════════════════════════════════════════════════════════════════════════
    const conversationIds = Object.keys(groupedByConversation);
    if (conversationIds.length > 0) {
      const currentStates = await db
        .select({
          conversationId: schema.conversationStates.conversationId,
          temperatureLevel: schema.conversationStates.temperatureLevel,
          consecutiveNoReplyCount: schema.conversationStates.consecutiveNoReplyCount,
          currentState: schema.conversationStates.currentState,
          lastAiEvaluationAt: schema.conversationStates.lastAiEvaluationAt,
        })
        .from(schema.conversationStates)
        .where(inArray(schema.conversationStates.conversationId, conversationIds));
      
      // Update grouped data with CURRENT values from database
      for (const state of currentStates) {
        const group = groupedByConversation[state.conversationId];
        if (group) {
          group.temperatureLevel = state.temperatureLevel || 'warm';
          group.consecutiveNoReplyCount = state.consecutiveNoReplyCount || 0;
          group.currentState = state.currentState;
          // Use the most recent lastAiEvaluationAt (either from events or current state)
          if (state.lastAiEvaluationAt) {
            const stateEvalTime = new Date(state.lastAiEvaluationAt).getTime();
            const groupEvalTime = group.lastAiEvaluationAt 
              ? new Date(group.lastAiEvaluationAt).getTime() 
              : 0;
            if (stateEvalTime > groupEvalTime) {
              group.lastAiEvaluationAt = state.lastAiEvaluationAt;
            }
          }
        }
      }
    }
    
    // After updating with current state, compute nextScheduledCheck using ACTUAL temperature
    for (const conversationId of Object.keys(groupedByConversation)) {
      const group = groupedByConversation[conversationId];
      group.nextScheduledCheck = calculateNextScheduledCheck(
        group.lastAiEvaluationAt,
        group.temperatureLevel || 'warm'
      );
    }

    res.json({
      timeline: Object.values(groupedByConversation),
      allEvents: filteredEvents.slice(0, limit),
      total: filteredEvents.length,
    });
  } catch (error: any) {
    console.error("Error fetching activity log:", error);
    res.status(500).json({ message: error.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// CONVERSATION TIMELINE (Detailed timeline for a single conversation)
// ═══════════════════════════════════════════════════════════════════════════

router.get("/conversation/:conversationId/timeline", authenticateToken, requireRole("consultant"), async (req, res) => {
  try {
    const consultantId = req.user!.id;
    const { conversationId } = req.params;

    // Verify conversation belongs to consultant
    const [conversation] = await db
      .select()
      .from(schema.whatsappConversations)
      .where(
        and(
          eq(schema.whatsappConversations.id, conversationId),
          eq(schema.whatsappConversations.consultantId, consultantId)
        )
      );

    if (!conversation) {
      return res.status(404).json({ message: "Conversazione non trovata" });
    }

    // Get all AI evaluations for this conversation
    const aiLogs = await db
      .select()
      .from(schema.followupAiEvaluationLog)
      .where(eq(schema.followupAiEvaluationLog.conversationId, conversationId))
      .orderBy(desc(schema.followupAiEvaluationLog.createdAt));

    // Get all scheduled/sent messages
    const messages = await db
      .select({
        id: schema.scheduledFollowupMessages.id,
        status: schema.scheduledFollowupMessages.status,
        scheduledFor: schema.scheduledFollowupMessages.scheduledFor,
        sentAt: schema.scheduledFollowupMessages.sentAt,
        errorMessage: schema.scheduledFollowupMessages.errorMessage,
        aiDecisionReasoning: schema.scheduledFollowupMessages.aiDecisionReasoning,
        fallbackMessage: schema.scheduledFollowupMessages.fallbackMessage,
        createdAt: schema.scheduledFollowupMessages.createdAt,
        templateName: schema.whatsappCustomTemplates.templateName,
        templateBody: schema.whatsappCustomTemplates.body,
      })
      .from(schema.scheduledFollowupMessages)
      .leftJoin(
        schema.whatsappCustomTemplates,
        eq(schema.scheduledFollowupMessages.templateId, schema.whatsappCustomTemplates.id)
      )
      .where(eq(schema.scheduledFollowupMessages.conversationId, conversationId))
      .orderBy(desc(schema.scheduledFollowupMessages.createdAt));

    // Get conversation state
    const [state] = await db
      .select()
      .from(schema.conversationStates)
      .where(eq(schema.conversationStates.conversationId, conversationId));

    // Get lead info
    const [lead] = await db
      .select({
        firstName: schema.proactiveLeads.firstName,
        lastName: schema.proactiveLeads.lastName,
        phoneNumber: schema.whatsappConversations.phoneNumber,
        agentName: schema.consultantWhatsappConfig.agentName,
      })
      .from(schema.whatsappConversations)
      .leftJoin(
        schema.proactiveLeads,
        eq(schema.whatsappConversations.proactiveLeadId, schema.proactiveLeads.id)
      )
      .leftJoin(
        schema.consultantWhatsappConfig,
        eq(schema.whatsappConversations.agentConfigId, schema.consultantWhatsappConfig.id)
      )
      .where(eq(schema.whatsappConversations.id, conversationId));

    // Combine into timeline
    const timeline: any[] = [];

    for (const log of aiLogs) {
      timeline.push({
        id: log.id,
        type: 'ai_evaluation',
        timestamp: log.createdAt,
        decision: log.decision,
        reasoning: log.reasoning,
        confidenceScore: log.confidenceScore,
        matchedRuleId: log.matchedRuleId,
        matchedRuleReason: log.matchedRuleReason,
      });
    }

    for (const msg of messages) {
      timeline.push({
        id: msg.id,
        type: msg.status === 'sent' ? 'message_sent' :
          msg.status === 'failed' ? 'message_failed' :
            msg.status === 'pending' ? 'message_scheduled' : 'message_cancelled',
        timestamp: msg.sentAt || msg.scheduledFor || msg.createdAt,
        status: msg.status,
        errorMessage: msg.errorMessage,
        reasoning: msg.aiDecisionReasoning,
        templateName: msg.templateName,
        messagePreview: msg.fallbackMessage || msg.templateBody,
      });
    }

    // Sort by timestamp descending
    timeline.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    res.json({
      conversationId,
      leadName: lead?.firstName || lead?.lastName
        ? `${lead?.firstName || ''} ${lead?.lastName || ''}`.trim()
        : lead?.phoneNumber,
      phoneNumber: lead?.phoneNumber,
      agentName: lead?.agentName,
      currentState: state?.currentState,
      temperatureLevel: state?.temperatureLevel,
      engagementScore: state?.engagementScore,
      conversionProbability: state?.conversionProbability,
      timeline,
      totalEvents: timeline.length,
    });
  } catch (error: any) {
    console.error("Error fetching conversation timeline:", error);
    res.status(500).json({ message: error.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// DAILY STATS (Aggregated stats for specific date range)
// ═══════════════════════════════════════════════════════════════════════════

router.get("/stats/daily", authenticateToken, requireRole("consultant"), async (req, res) => {
  try {
    const consultantId = req.user!.id;
    const days = Math.min(parseInt(req.query.days as string) || 30, 90);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const dailyStats = await db
      .select({
        date: sql<string>`DATE(${schema.scheduledFollowupMessages.createdAt})`,
        sent: sql<number>`COUNT(*) FILTER (WHERE ${schema.scheduledFollowupMessages.status} = 'sent')`,
        failed: sql<number>`COUNT(*) FILTER (WHERE ${schema.scheduledFollowupMessages.status} = 'failed')`,
        cancelled: sql<number>`COUNT(*) FILTER (WHERE ${schema.scheduledFollowupMessages.status} = 'cancelled')`,
        pending: sql<number>`COUNT(*) FILTER (WHERE ${schema.scheduledFollowupMessages.status} = 'pending')`,
      })
      .from(schema.scheduledFollowupMessages)
      .innerJoin(
        schema.whatsappConversations,
        eq(schema.scheduledFollowupMessages.conversationId, schema.whatsappConversations.id)
      )
      .where(
        and(
          eq(schema.whatsappConversations.consultantId, consultantId),
          gte(schema.scheduledFollowupMessages.createdAt, startDate)
        )
      )
      .groupBy(sql`DATE(${schema.scheduledFollowupMessages.createdAt})`)
      .orderBy(sql`DATE(${schema.scheduledFollowupMessages.createdAt})`);

    // Calculate totals
    const totals = {
      sent: dailyStats.reduce((sum, d) => sum + Number(d.sent), 0),
      failed: dailyStats.reduce((sum, d) => sum + Number(d.failed), 0),
      cancelled: dailyStats.reduce((sum, d) => sum + Number(d.cancelled), 0),
      pending: dailyStats.reduce((sum, d) => sum + Number(d.pending), 0),
    };

    res.json({
      days,
      startDate: startDate.toISOString(),
      dailyStats: dailyStats.map(d => ({
        date: d.date,
        sent: Number(d.sent),
        failed: Number(d.failed),
        cancelled: Number(d.cancelled),
        pending: Number(d.pending),
      })),
      totals,
      successRate: totals.sent + totals.failed > 0
        ? Math.round((totals.sent / (totals.sent + totals.failed)) * 100)
        : 100,
    });
  } catch (error: any) {
    console.error("Error fetching daily stats:", error);
    res.status(500).json({ message: error.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// FOLLOWUP SETTINGS (Global hoursWithoutReply config)
// ═══════════════════════════════════════════════════════════════════════════

router.get("/settings", authenticateToken, requireRole("consultant"), async (req, res) => {
  try {
    const rules = await db
      .select()
      .from(schema.followupRules)
      .where(eq(schema.followupRules.consultantId, req.user!.id))
      .limit(1);

    let hoursWithoutReply = 4;
    if (rules.length > 0 && rules[0].triggerCondition) {
      const condition = rules[0].triggerCondition as Record<string, any>;
      if (typeof condition.hoursWithoutReply === 'number') {
        hoursWithoutReply = condition.hoursWithoutReply;
      }
    }

    res.json({
      hoursWithoutReply,
      rulesCount: rules.length
    });
  } catch (error: any) {
    console.error("Error fetching followup settings:", error);
    res.status(500).json({ message: error.message });
  }
});

router.put("/settings", authenticateToken, requireRole("consultant"), async (req, res) => {
  try {
    const { hoursWithoutReply } = req.body;

    if (typeof hoursWithoutReply !== 'number' || hoursWithoutReply < 0 || hoursWithoutReply > 168) {
      return res.status(400).json({
        message: "hoursWithoutReply deve essere un numero tra 0 e 168 (1 settimana)"
      });
    }

    const rules = await db
      .select()
      .from(schema.followupRules)
      .where(eq(schema.followupRules.consultantId, req.user!.id));

    let updatedCount = 0;
    for (const rule of rules) {
      const currentCondition = (rule.triggerCondition || {}) as Record<string, any>;
      const newCondition = {
        ...currentCondition,
        hoursWithoutReply
      };

      await db
        .update(schema.followupRules)
        .set({
          triggerCondition: newCondition,
          updatedAt: new Date()
        })
        .where(eq(schema.followupRules.id, rule.id));
      updatedCount++;
    }

    res.json({
      success: true,
      message: `Aggiornate ${updatedCount} regole con hoursWithoutReply = ${hoursWithoutReply}`,
      hoursWithoutReply,
      updatedRulesCount: updatedCount
    });
  } catch (error: any) {
    console.error("Error updating followup settings:", error);
    res.status(500).json({ message: error.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// SYSTEM RULES (Read-only)
// ═══════════════════════════════════════════════════════════════════════════

import { getSystemRulesForDisplay } from "../ai/system-rules-config";

router.get("/system-rules", authenticateToken, requireRole("consultant"), async (req, res) => {
  try {
    const rules = getSystemRulesForDisplay();
    res.json({
      success: true,
      rules,
      description: "Regole di sistema applicate automaticamente prima della valutazione AI. Non modificabili.",
      descriptionEn: "System rules applied automatically before AI evaluation. Read-only.",
    });
  } catch (error: any) {
    console.error("Error fetching system rules:", error);
    res.status(500).json({ message: error.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// MANUAL TRIGGER - Run evaluation immediately
// ═══════════════════════════════════════════════════════════════════════════

import { runFollowupEvaluation, processScheduledMessages } from "../cron/followup-scheduler";

router.post("/trigger-evaluation", authenticateToken, requireRole("consultant"), async (req, res) => {
  try {
    console.log(`🔄 [FOLLOWUP-API] Manual trigger requested by consultant ${req.user!.id}`);

    await runFollowupEvaluation();

    res.json({
      success: true,
      message: "Valutazione follow-up eseguita con successo",
      triggeredAt: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("Error triggering followup evaluation:", error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// AGENT ASSIGNED TEMPLATES - Template approvati assegnati per agente
// ═══════════════════════════════════════════════════════════════════════════

router.get("/agent-templates", authenticateToken, requireRole("consultant"), async (req, res) => {
  try {
    const consultantId = req.user!.id;

    // Get all agents for this consultant
    const agents = await db
      .select({
        id: schema.consultantWhatsappConfig.id,
        agentName: schema.consultantWhatsappConfig.agentName,
        agentType: schema.consultantWhatsappConfig.agentType,
        isActive: schema.consultantWhatsappConfig.isActive,
      })
      .from(schema.consultantWhatsappConfig)
      .where(eq(schema.consultantWhatsappConfig.consultantId, consultantId));

    // Get template assignments for each agent
    const agentTemplates = await Promise.all(agents.map(async (agent) => {
      const assignments = await db
        .select({
          templateId: schema.whatsappTemplateAssignments.templateId,
          templateType: schema.whatsappTemplateAssignments.templateType,
          priority: schema.whatsappTemplateAssignments.priority,
        })
        .from(schema.whatsappTemplateAssignments)
        .where(eq(schema.whatsappTemplateAssignments.agentConfigId, agent.id))
        .orderBy(desc(schema.whatsappTemplateAssignments.priority));

      // Filter only approved Twilio templates (HX prefix)
      const approvedTemplates = assignments.filter(t =>
        t.templateId.startsWith('HX') && t.templateType === 'twilio'
      );

      // Get template details - for Twilio templates (HX prefix), we return the ID directly
      // since there's no local DB table for Twilio template metadata
      const templateDetails = approvedTemplates.map((t) => ({
        templateId: t.templateId,
        templateType: t.templateType,
        priority: t.priority,
        friendlyName: t.templateId, // Twilio template SID as name
        twilioStatus: 'approved', // If assigned, assumed approved
        bodyText: null, // Not stored locally for Twilio templates
      }));

      return {
        agentId: agent.id,
        agentName: agent.agentName,
        agentType: agent.agentType,
        isActive: agent.isActive,
        assignedTemplates: templateDetails,
        hasApprovedTemplates: templateDetails.length > 0,
      };
    }));

    res.json({
      success: true,
      agents: agentTemplates,
      totalAgents: agents.length,
      agentsWithTemplates: agentTemplates.filter(a => a.hasApprovedTemplates).length,
    });
  } catch (error: any) {
    console.error("Error fetching agent templates:", error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// AI PREFERENCES - Personalizzazione comportamento AI (Sistema 100% AI)
// ═══════════════════════════════════════════════════════════════════════════

router.get("/ai-preferences", authenticateToken, requireRole("consultant"), async (req, res) => {
  try {
    const [preferences] = await db
      .select()
      .from(schema.consultantAiPreferences)
      .where(eq(schema.consultantAiPreferences.consultantId, req.user!.id))
      .limit(1);

    if (!preferences) {
      // Return default preferences if none exist
      return res.json({
        success: true,
        preferences: {
          maxFollowupsTotal: 5,
          minHoursBetweenFollowups: 24,
          workingHoursStart: 9,
          workingHoursEnd: 19,
          workingDays: [1, 2, 3, 4, 5],
          toneStyle: "professionale",
          messageLength: "medio",
          useEmojis: false,
          aggressivenessLevel: 5,
          persistenceLevel: 5,
          firstFollowupDelayHours: 24,
          templateNoResponseDelayHours: 48,
          coldLeadReactivationDays: 7,
          customInstructions: null,
          businessContext: null,
          targetAudience: null,
          neverContactWeekends: false,
          respectHolidays: true,
          stopOnFirstNo: true,
          requireLeadResponseForFreeform: true,
          allowAiToSuggestTemplates: true,
          allowAiToWriteFreeformMessages: true,
          logAiReasoning: true,
          maxNoReplyBeforeDormancy: 3,
          dormancyDurationDays: 90,
          finalAttemptAfterDormancy: true,
          maxWarmFollowups: 2,
          warmFollowupDelayHours: 4,
          engagedGhostThresholdDays: 14,
          prioritizeEngagedLeads: true,
          isActive: true,
        },
        isDefault: true,
      });
    }

    res.json({
      success: true,
      preferences,
      isDefault: false,
    });
  } catch (error: any) {
    console.error("Error fetching AI preferences:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put("/ai-preferences", authenticateToken, requireRole("consultant"), async (req, res) => {
  try {
    const updates = req.body;

    // Check if preferences exist
    const [existing] = await db
      .select()
      .from(schema.consultantAiPreferences)
      .where(eq(schema.consultantAiPreferences.consultantId, req.user!.id))
      .limit(1);

    let result;

    if (existing) {
      // Update existing
      [result] = await db
        .update(schema.consultantAiPreferences)
        .set({
          ...updates,
          updatedAt: new Date(),
        })
        .where(eq(schema.consultantAiPreferences.consultantId, req.user!.id))
        .returning();
    } else {
      // Create new
      [result] = await db
        .insert(schema.consultantAiPreferences)
        .values({
          consultantId: req.user!.id,
          ...updates,
        })
        .returning();
    }

    console.log(`✅ [AI-PREFERENCES] Updated preferences for consultant ${req.user!.id}`);

    res.json({
      success: true,
      preferences: result,
      message: "Preferenze AI aggiornate con successo",
    });
  } catch (error: any) {
    console.error("Error updating AI preferences:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get AI system info for display
router.get("/ai-system-info", authenticateToken, requireRole("consultant"), async (req, res) => {
  try {
    res.json({
      name: "Marco - Consulente AI Esperto",
      description: "L'AI analizza ogni lead come un consulente esperto con 15 anni di esperienza, decidendo autonomamente quando e come contattarli.",
      capabilities: [
        { icon: "brain", label: "Analisi Intelligente - Legge la chat completa e interpreta il contesto" },
        { icon: "clock", label: "Timing Ottimale - Sceglie il momento migliore per ogni follow-up" },
        { icon: "target", label: "Personalizzazione - Adatta messaggi e template al singolo lead" },
        { icon: "zap", label: "Rispetto Decisioni - Si ferma automaticamente ai NO espliciti" },
        { icon: "sparkles", label: "Apprendimento - Migliora dalle valutazioni precedenti" },
      ],
      defaultBehaviors: [
        "Attende 24-48h dopo il primo template senza risposta",
        "Non tempesta i lead con messaggi ravvicinati",
        "Usa template approvati fuori dalla finestra 24h",
        "Rispetta orari lavorativi del consulente",
        "Ferma follow-up dopo un NO esplicito",
      ],
    });
  } catch (error: any) {
    console.error("Error fetching AI system info:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// FASE 7-8: Lead Status API - Stato dettagliato follow-up per ogni lead
// ═══════════════════════════════════════════════════════════════════════════

router.get("/lead-status", authenticateToken, requireRole("consultant"), async (req, res) => {
  try {
    const consultantId = req.user!.id;

    // Get all conversation states with lead info for this consultant
    const leadStates = await db
      .select({
        conversationId: schema.conversationStates.conversationId,
        currentState: schema.conversationStates.currentState,
        followupCount: schema.conversationStates.followupCount,
        consecutiveNoReplyCount: schema.conversationStates.consecutiveNoReplyCount,
        lastReplyAt: schema.conversationStates.lastReplyAt,
        dormantUntil: schema.conversationStates.dormantUntil,
        permanentlyExcluded: schema.conversationStates.permanentlyExcluded,
        dormantReason: schema.conversationStates.dormantReason,
        lastFollowupAt: schema.conversationStates.lastFollowupAt,
        nextFollowupScheduledAt: schema.conversationStates.nextFollowupScheduledAt,
        engagementScore: schema.conversationStates.engagementScore,
        temperatureLevel: schema.conversationStates.temperatureLevel,
        aiRecommendation: schema.conversationStates.aiRecommendation,
        phoneNumber: schema.whatsappConversations.phoneNumber,
        agentConfigId: schema.whatsappConversations.agentConfigId,
        lastMessageAt: schema.whatsappConversations.lastMessageAt,
      })
      .from(schema.conversationStates)
      .innerJoin(
        schema.whatsappConversations,
        eq(schema.conversationStates.conversationId, schema.whatsappConversations.id)
      )
      .where(eq(schema.whatsappConversations.consultantId, consultantId))
      .orderBy(desc(schema.whatsappConversations.lastMessageAt));

    // Enrich with lead name and agent name
    const enrichedLeads = await Promise.all(
      leadStates.map(async (lead) => {
        // Get lead name from proactiveLeads if exists
        let leadName = 'Lead';
        const conversation = await db
          .select({ proactiveLeadId: schema.whatsappConversations.proactiveLeadId })
          .from(schema.whatsappConversations)
          .where(eq(schema.whatsappConversations.id, lead.conversationId))
          .limit(1);

        if (conversation[0]?.proactiveLeadId) {
          const proactiveLead = await db
            .select({ firstName: schema.proactiveLeads.firstName, lastName: schema.proactiveLeads.lastName })
            .from(schema.proactiveLeads)
            .where(eq(schema.proactiveLeads.id, conversation[0].proactiveLeadId))
            .limit(1);

          if (proactiveLead[0]) {
            leadName = `${proactiveLead[0].firstName || ''} ${proactiveLead[0].lastName || ''}`.trim() || 'Lead';
          }
        }

        // Get agent name
        let agentName = 'Agente';
        if (lead.agentConfigId) {
          const agentConfig = await db
            .select({ agentName: schema.consultantWhatsappConfig.agentName })
            .from(schema.consultantWhatsappConfig)
            .where(eq(schema.consultantWhatsappConfig.id, lead.agentConfigId))
            .limit(1);

          if (agentConfig[0]) {
            agentName = agentConfig[0].agentName || 'Agente';
          }
        }

        // Calculate status and next action
        let status: 'active' | 'dormant' | 'excluded' = 'active';
        let nextAction = '';
        let nextActionDate: Date | null = null;
        let reason = '';

        const now = new Date();

        if (lead.permanentlyExcluded) {
          status = 'excluded';
          reason = lead.dormantReason || 'Nessuna risposta dopo 4+ tentativi';
          nextAction = 'Non lo contatto più';
        } else if (lead.dormantUntil && new Date(lead.dormantUntil) > now) {
          status = 'dormant';
          const daysLeft = Math.ceil((new Date(lead.dormantUntil).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          reason = lead.dormantReason || 'Nessuna risposta dopo 3 tentativi';
          nextAction = `Riprovo tra ${daysLeft} giorni`;
          nextActionDate = new Date(lead.dormantUntil);
        } else if (lead.nextFollowupScheduledAt) {
          const scheduledDate = new Date(lead.nextFollowupScheduledAt);
          if (scheduledDate > now) {
            const hoursLeft = Math.ceil((scheduledDate.getTime() - now.getTime()) / (1000 * 60 * 60));

            // Distingui tra "in attesa risposta" e "prossimo contatto"
            // Se l'ultimo follow-up è stato inviato nelle ultime 24 ore, siamo in attesa risposta
            const hoursSinceLastFollowup = lead.lastFollowupAt
              ? (now.getTime() - new Date(lead.lastFollowupAt).getTime()) / (1000 * 60 * 60)
              : 999;

            if (hoursSinceLastFollowup < 24 && lead.consecutiveNoReplyCount > 0) {
              // Messaggio appena inviato, in attesa risposta
              nextAction = `In attesa risposta (${lead.consecutiveNoReplyCount}/3)`;
              reason = `Messaggio inviato ${hoursSinceLastFollowup < 1 ? 'da poco' : `${Math.floor(hoursSinceLastFollowup)}h fa`}, controllo tra ${hoursLeft}h`;
            } else if (hoursLeft < 24) {
              nextAction = `Prossimo contatto tra ${hoursLeft} ore`;
              reason = `Follow-up #${lead.followupCount + 1} programmato`;
            } else {
              const daysLeft = Math.ceil(hoursLeft / 24);
              nextAction = `Prossimo contatto tra ${daysLeft} giorni`;
              reason = `Follow-up #${lead.followupCount + 1} programmato`;
            }
            nextActionDate = scheduledDate;
          } else {
            nextAction = 'In attesa valutazione AI';
            reason = 'Il sistema sta decidendo quando contattare';
          }
        } else if (lead.consecutiveNoReplyCount >= 3) {
          status = 'dormant';
          reason = 'Raggiunto limite 3 tentativi senza risposta';
          nextAction = 'Entrerà in dormienza';
        } else {
          nextAction = 'In attesa risposta';
          reason = `Tentativi: ${lead.consecutiveNoReplyCount}/3 senza risposta`;
        }

        return {
          conversationId: lead.conversationId,
          phoneNumber: lead.phoneNumber,
          leadName,
          agentName,
          status,
          currentState: lead.currentState,
          followupCount: lead.followupCount,
          consecutiveNoReplyCount: lead.consecutiveNoReplyCount,
          lastReplyAt: lead.lastReplyAt,
          lastFollowupAt: lead.lastFollowupAt,
          dormantUntil: lead.dormantUntil,
          permanentlyExcluded: lead.permanentlyExcluded,
          engagementScore: lead.engagementScore,
          temperatureLevel: lead.temperatureLevel,
          nextAction,
          nextActionDate,
          reason,
          aiRecommendation: lead.aiRecommendation,
        };
      })
    );

    // Calculate summary stats
    const activeCount = enrichedLeads.filter(l => l.status === 'active').length;
    const dormantCount = enrichedLeads.filter(l => l.status === 'dormant').length;
    const excludedCount = enrichedLeads.filter(l => l.status === 'excluded').length;

    res.json({
      success: true,
      leads: enrichedLeads,
      summary: {
        total: enrichedLeads.length,
        active: activeCount,
        dormant: dormantCount,
        excluded: excludedCount,
      },
    });
  } catch (error: any) {
    console.error("Error fetching lead status:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// SIMULATE AI FOLLOW-UP (Testing endpoint)
// ═══════════════════════════════════════════════════════════════════════════

router.post("/conversations/:conversationId/simulate-ai-followup", authenticateToken, requireRole("consultant"), async (req, res) => {
  try {
    const { conversationId } = req.params;
    const consultantId = req.user!.id;
    const now = new Date();

    console.log(`🧪 [FORCE-SEND] Starting forced follow-up for conversation ${conversationId}`);

    // 1. Verify conversation belongs to consultant and get state
    const [conversation] = await db
      .select({
        conversation: schema.whatsappConversations,
        state: schema.conversationStates,
        agent: schema.consultantWhatsappConfig,
      })
      .from(schema.whatsappConversations)
      .leftJoin(
        schema.conversationStates,
        eq(schema.conversationStates.conversationId, schema.whatsappConversations.id)
      )
      .innerJoin(
        schema.consultantWhatsappConfig,
        eq(schema.consultantWhatsappConfig.id, schema.whatsappConversations.agentConfigId)
      )
      .where(
        and(
          eq(schema.whatsappConversations.id, conversationId),
          eq(schema.consultantWhatsappConfig.consultantId, consultantId)
        )
      )
      .limit(1);

    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: "Conversazione non trovata"
      });
    }

    // 2. Find scheduled message for this conversation (if any)
    const [scheduledMessage] = await db
      .select()
      .from(schema.scheduledFollowupMessages)
      .where(
        and(
          eq(schema.scheduledFollowupMessages.conversationId, conversationId),
          eq(schema.scheduledFollowupMessages.status, 'pending')
        )
      )
      .orderBy(desc(schema.scheduledFollowupMessages.scheduledFor))
      .limit(1);

    let messageText = "";
    let templateId = null;
    let messageSent = false;

    if (scheduledMessage) {
      // Use the scheduled message (messagePreview or fallbackMessage)
      messageText = scheduledMessage.messagePreview || scheduledMessage.fallbackMessage || "";
      templateId = scheduledMessage.templateId;
      console.log(`📨 [FORCE-SEND] Found scheduled message: ${messageText.substring(0, 50)}...`);

      // Mark scheduled message as sent
      await db
        .update(schema.scheduledFollowupMessages)
        .set({
          status: 'sent',
          sentAt: now,
        })
        .where(eq(schema.scheduledFollowupMessages.id, scheduledMessage.id));
    } else {
      // No scheduled message, use a default follow-up
      messageText = "Ciao! Volevo fare un follow-up sulla nostra conversazione. Hai avuto modo di riflettere?";
      console.log(`📨 [FORCE-SEND] No scheduled message, using default`);
    }

    // 3. Build and replace template variables {{1}}, {{2}}, etc.
    // Get lead info for variable substitution
    const [lead] = await db
      .select()
      .from(schema.proactiveLeads)
      .where(eq(schema.proactiveLeads.id, conversation.conversation.proactiveLeadId || ''))
      .limit(1);

    // Build template variables
    const templateVariables: Record<string, string> = {
      "1": lead?.firstName || conversation.conversation.phoneNumber.slice(-4) || "Cliente",
      "2": conversation.agent.consultantDisplayName || conversation.agent.agentName || "il tuo consulente",
      "3": conversation.agent.businessName || "la nostra azienda",
      "4": lead?.idealState || (lead?.leadInfo as any)?.obiettivi || "i tuoi obiettivi",
      "5": lead?.idealState || (lead?.leadInfo as any)?.obiettivi || "i tuoi obiettivi",
    };

    console.log(`📋 [FORCE-SEND] Template variables:`, JSON.stringify(templateVariables));

    // Replace {{1}}, {{2}}, etc. with actual values
    for (const [key, value] of Object.entries(templateVariables)) {
      const placeholder = `{{${key}}}`;
      messageText = messageText.replace(new RegExp(placeholder.replace(/[{}]/g, '\\$&'), 'g'), value);
    }

    console.log(`📝 [FORCE-SEND] Compiled message: ${messageText.substring(0, 80)}...`);

    // 4. Send the message via Twilio (unless dry run)
    const { sendWhatsAppMessage } = await import("../whatsapp/twilio-client");

    // Save message to DB first
    const [savedMessage] = await db
      .insert(schema.whatsappMessages)
      .values({
        conversationId,
        messageText,
        direction: "outbound",
        sender: "ai",
        templateId: templateId,
        metadata: {
          forcedFollowup: true,
          simulatedAt: now.toISOString(),
        },
      })
      .returning();

    if (!conversation.agent.isDryRun) {
      try {
        await sendWhatsAppMessage(
          consultantId,
          conversation.conversation.phoneNumber,
          messageText,
          savedMessage.id,
          { conversationId }
        );
        messageSent = true;
        console.log(`📤 [FORCE-SEND] Message sent via Twilio`);
      } catch (twilioError: any) {
        console.error(`❌ [FORCE-SEND] Twilio error:`, twilioError.message);
      }
    } else {
      messageSent = true; // Consider dry run as "sent"
      console.log(`🧪 [FORCE-SEND] DRY RUN mode - message logged but NOT sent via Twilio`);
    }

    // 4. Update counters (the key part!)
    const state = conversation.state;
    const oldConsecutiveCount = state?.consecutiveNoReplyCount || 0;
    const newConsecutiveCount = oldConsecutiveCount + 1;
    const cooldownHours = 24;
    const nextCheck = new Date();
    nextCheck.setHours(nextCheck.getHours() + cooldownHours);

    await db
      .update(schema.conversationStates)
      .set({
        followupCount: sql`COALESCE(followup_count, 0) + 1`,
        consecutiveNoReplyCount: sql`COALESCE(consecutive_no_reply_count, 0) + 1`,
        lastFollowupAt: now,
        nextFollowupScheduledAt: nextCheck,
        updatedAt: now,
      })
      .where(eq(schema.conversationStates.conversationId, conversationId));

    console.log(`📊 [FORCE-SEND] Updated counters: followupCount++, consecutiveNoReplyCount: ${oldConsecutiveCount} → ${newConsecutiveCount}`);

    // 5. Check for dormancy trigger (3 consecutive no-replies)
    let dormancyTriggered = false;

    if (newConsecutiveCount >= 3 && !state?.dormantUntil) {
      const dormantUntilDate = new Date();
      dormantUntilDate.setMonth(dormantUntilDate.getMonth() + 3);

      await db
        .update(schema.conversationStates)
        .set({
          currentState: 'ghost',
          temperatureLevel: 'ghost',
          dormantUntil: dormantUntilDate,
          dormantReason: 'Nessuna risposta dopo 3 tentativi consecutivi',
          updatedAt: now,
        })
        .where(eq(schema.conversationStates.conversationId, conversationId));

      dormancyTriggered = true;
      console.log(`😴 [FORCE-SEND] Lead entered dormancy until ${dormantUntilDate.toISOString()}`);
    }

    // 6. Update conversation lastMessageAt
    await db
      .update(schema.whatsappConversations)
      .set({
        lastMessageAt: now,
        lastMessageFrom: 'ai',
        updatedAt: now,
      })
      .where(eq(schema.whatsappConversations.id, conversationId));

    res.json({
      success: true,
      action: 'force_sent',
      messageSent,
      messagePreview: messageText.substring(0, 100),
      templateId,
      countersUpdated: true,
      oldConsecutiveNoReplyCount: oldConsecutiveCount,
      newConsecutiveNoReplyCount: newConsecutiveCount,
      nextFollowupAt: nextCheck.toISOString(),
      dormancyTriggered,
      message: dormancyTriggered
        ? `Messaggio inviato! Lead in DORMIENZA (${newConsecutiveCount}/3 tentativi)`
        : `Messaggio inviato! Tentativo ${newConsecutiveCount}/3`,
    });

  } catch (error: any) {
    console.error("❌ [FORCE-SEND] Error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Errore durante l'invio forzato"
    });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// PENDING FOLLOW-UPS QUEUE (per agent)
// ═══════════════════════════════════════════════════════════════════════════

router.get("/pending-queue", authenticateToken, requireRole("consultant"), async (req, res) => {
  try {
    const consultantId = req.user!.id;
    const now = new Date();

    // Get all conversation states with next scheduled follow-up, grouped by agent
    const pendingConversations = await db
      .select({
        conversationId: schema.conversationStates.conversationId,
        nextFollowupScheduledAt: schema.conversationStates.nextFollowupScheduledAt,
        currentState: schema.conversationStates.currentState,
        temperatureLevel: schema.conversationStates.temperatureLevel,
        followupCount: schema.conversationStates.followupCount,
        consecutiveNoReplyCount: schema.conversationStates.consecutiveNoReplyCount,
        dormantUntil: schema.conversationStates.dormantUntil,
        // Conversation info
        phoneNumber: schema.whatsappConversations.phoneNumber,
        proactiveLeadId: schema.whatsappConversations.proactiveLeadId,
        lastMessageAt: schema.whatsappConversations.lastMessageAt,
        // Agent info
        agentId: schema.consultantWhatsappConfig.id,
        agentName: schema.consultantWhatsappConfig.agentName,
        agentType: schema.consultantWhatsappConfig.agentType,
      })
      .from(schema.conversationStates)
      .innerJoin(
        schema.whatsappConversations,
        eq(schema.whatsappConversations.id, schema.conversationStates.conversationId)
      )
      .innerJoin(
        schema.consultantWhatsappConfig,
        eq(schema.consultantWhatsappConfig.id, schema.whatsappConversations.agentConfigId)
      )
      .where(
        and(
          eq(schema.consultantWhatsappConfig.consultantId, consultantId),
          eq(schema.conversationStates.permanentlyExcluded, false)
        )
      )
      .orderBy(schema.conversationStates.nextFollowupScheduledAt);

    // Enrich with lead names
    const leadIds = pendingConversations
      .filter(c => c.proactiveLeadId)
      .map(c => c.proactiveLeadId!);

    const leads = leadIds.length > 0 ? await db
      .select({
        id: schema.proactiveLeads.id,
        firstName: schema.proactiveLeads.firstName,
        lastName: schema.proactiveLeads.lastName,
      })
      .from(schema.proactiveLeads)
      .where(inArray(schema.proactiveLeads.id, leadIds)) : [];

    const leadMap = new Map(leads.map(l => [l.id, `${l.firstName || ''} ${l.lastName || ''}`.trim()]));

    // Group by agent
    const byAgent: Record<string, {
      agentId: string;
      agentName: string;
      agentType: string;
      pending: Array<{
        conversationId: string;
        leadName: string;
        phoneNumber: string;
        nextCheckAt: string | null;
        isOverdue: boolean;
        currentState: string;
        followupCount: number;
        consecutiveNoReply: number;
        isDormant: boolean;
        dormantUntil: string | null;
      }>;
    }> = {};

    for (const conv of pendingConversations) {
      if (!byAgent[conv.agentId]) {
        byAgent[conv.agentId] = {
          agentId: conv.agentId,
          agentName: conv.agentName || 'Agent',
          agentType: conv.agentType,
          pending: [],
        };
      }

      const isDormant = !!conv.dormantUntil && new Date(conv.dormantUntil) > now;
      const isOverdue = conv.nextFollowupScheduledAt
        ? new Date(conv.nextFollowupScheduledAt) < now && !isDormant
        : false;

      byAgent[conv.agentId].pending.push({
        conversationId: conv.conversationId,
        leadName: conv.proactiveLeadId ? (leadMap.get(conv.proactiveLeadId) || conv.phoneNumber) : conv.phoneNumber,
        phoneNumber: conv.phoneNumber,
        nextCheckAt: conv.nextFollowupScheduledAt?.toISOString() || null,
        isOverdue,
        currentState: conv.currentState || 'new',
        followupCount: conv.followupCount || 0,
        consecutiveNoReply: conv.consecutiveNoReplyCount || 0,
        isDormant,
        dormantUntil: conv.dormantUntil?.toISOString() || null,
      });
    }

    // Sort pending items in each agent: overdue first, then by nextCheckAt
    for (const agent of Object.values(byAgent)) {
      agent.pending.sort((a, b) => {
        if (a.isOverdue && !b.isOverdue) return -1;
        if (!a.isOverdue && b.isOverdue) return 1;
        if (a.isDormant && !b.isDormant) return 1;
        if (!a.isDormant && b.isDormant) return -1;
        if (!a.nextCheckAt) return 1;
        if (!b.nextCheckAt) return -1;
        return new Date(a.nextCheckAt).getTime() - new Date(b.nextCheckAt).getTime();
      });
    }

    res.json({
      agents: Object.values(byAgent),
      totalPending: pendingConversations.filter(c => !c.dormantUntil || new Date(c.dormantUntil) < now).length,
      totalDormant: pendingConversations.filter(c => c.dormantUntil && new Date(c.dormantUntil) > now).length,
    });

  } catch (error: any) {
    console.error("❌ [PENDING-QUEUE] Error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Errore nel recupero della coda"
    });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// LIVE TEST COCKPIT ENDPOINTS
// ═══════════════════════════════════════════════════════════════════════════

router.get("/conversations-for-test", authenticateToken, requireRole("consultant"), async (req, res) => {
  try {
    const consultantId = req.user!.id;

    const conversations = await db
      .select({
        id: schema.whatsappConversations.id,
        phoneNumber: schema.whatsappConversations.phoneNumber,
        proactiveLeadId: schema.whatsappConversations.proactiveLeadId,
        lastMessageAt: schema.whatsappConversations.lastMessageAt,
        agentName: schema.consultantWhatsappConfig.agentName,
        currentState: schema.conversationStates.currentState,
        followupCount: schema.conversationStates.followupCount,
        consecutiveNoReplyCount: schema.conversationStates.consecutiveNoReplyCount,
        temperatureLevel: schema.conversationStates.temperatureLevel,
      })
      .from(schema.whatsappConversations)
      .innerJoin(
        schema.consultantWhatsappConfig,
        eq(schema.consultantWhatsappConfig.id, schema.whatsappConversations.agentConfigId)
      )
      .leftJoin(
        schema.conversationStates,
        eq(schema.conversationStates.conversationId, schema.whatsappConversations.id)
      )
      .where(eq(schema.consultantWhatsappConfig.consultantId, consultantId))
      .orderBy(desc(schema.whatsappConversations.lastMessageAt))
      .limit(50);

    const leadIds = conversations.filter(c => c.proactiveLeadId).map(c => c.proactiveLeadId!);
    const leads = leadIds.length > 0 ? await db
      .select({
        id: schema.proactiveLeads.id,
        firstName: schema.proactiveLeads.firstName,
        lastName: schema.proactiveLeads.lastName,
      })
      .from(schema.proactiveLeads)
      .where(inArray(schema.proactiveLeads.id, leadIds)) : [];

    const leadMap = new Map(leads.map(l => [l.id, `${l.firstName || ''} ${l.lastName || ''}`.trim()]));

    const result = conversations.map(conv => ({
      id: conv.id,
      phoneNumber: conv.phoneNumber,
      leadName: conv.proactiveLeadId ? (leadMap.get(conv.proactiveLeadId) || conv.phoneNumber) : conv.phoneNumber,
      agentName: conv.agentName || 'Agente',
      currentState: conv.currentState || 'new',
      lastMessageAt: conv.lastMessageAt?.toISOString() || null,
      followupCount: conv.followupCount || 0,
      consecutiveNoReplyCount: conv.consecutiveNoReplyCount || 0,
      temperatureLevel: conv.temperatureLevel || null,
    }));

    res.json(result);
  } catch (error: any) {
    console.error("❌ [CONVERSATIONS-FOR-TEST] Error:", error);
    res.status(500).json({ message: error.message });
  }
});

router.get("/conversation-details/:id", authenticateToken, requireRole("consultant"), async (req, res) => {
  try {
    const { id } = req.params;
    const consultantId = req.user!.id;

    const [result] = await db
      .select({
        id: schema.whatsappConversations.id,
        phoneNumber: schema.whatsappConversations.phoneNumber,
        proactiveLeadId: schema.whatsappConversations.proactiveLeadId,
        lastMessageAt: schema.whatsappConversations.lastMessageAt,
        window24hExpiresAt: schema.whatsappConversations.window24hExpiresAt,
        agentName: schema.consultantWhatsappConfig.agentName,
        currentState: schema.conversationStates.currentState,
        followupCount: schema.conversationStates.followupCount,
        consecutiveNoReplyCount: schema.conversationStates.consecutiveNoReplyCount,
        temperatureLevel: schema.conversationStates.temperatureLevel,
        lastFollowupAt: schema.conversationStates.lastFollowupAt,
        dormantUntil: schema.conversationStates.dormantUntil,
        permanentlyExcluded: schema.conversationStates.permanentlyExcluded,
        engagementScore: schema.conversationStates.engagementScore,
      })
      .from(schema.whatsappConversations)
      .innerJoin(
        schema.consultantWhatsappConfig,
        eq(schema.consultantWhatsappConfig.id, schema.whatsappConversations.agentConfigId)
      )
      .leftJoin(
        schema.conversationStates,
        eq(schema.conversationStates.conversationId, schema.whatsappConversations.id)
      )
      .where(and(
        eq(schema.whatsappConversations.id, id),
        eq(schema.consultantWhatsappConfig.consultantId, consultantId)
      ))
      .limit(1);

    if (!result) {
      return res.status(404).json({ message: "Conversazione non trovata" });
    }

    let leadName = result.phoneNumber;
    if (result.proactiveLeadId) {
      const [lead] = await db
        .select({ firstName: schema.proactiveLeads.firstName, lastName: schema.proactiveLeads.lastName })
        .from(schema.proactiveLeads)
        .where(eq(schema.proactiveLeads.id, result.proactiveLeadId))
        .limit(1);
      if (lead) {
        leadName = `${lead.firstName || ''} ${lead.lastName || ''}`.trim() || result.phoneNumber;
      }
    }

    const now = new Date();
    const canSendFreeform = result.window24hExpiresAt ? new Date(result.window24hExpiresAt) > now : false;

    res.json({
      id: result.id,
      phoneNumber: result.phoneNumber,
      leadName,
      agentName: result.agentName || 'Agente',
      currentState: result.currentState || 'new',
      followupCount: result.followupCount || 0,
      consecutiveNoReplyCount: result.consecutiveNoReplyCount || 0,
      temperatureLevel: result.temperatureLevel || null,
      lastMessageAt: result.lastMessageAt?.toISOString() || null,
      lastFollowupAt: result.lastFollowupAt?.toISOString() || null,
      dormantUntil: result.dormantUntil?.toISOString() || null,
      permanentlyExcluded: result.permanentlyExcluded || false,
      engagementScore: result.engagementScore || null,
      window24hExpiresAt: result.window24hExpiresAt?.toISOString() || null,
      canSendFreeform,
    });
  } catch (error: any) {
    console.error("❌ [CONVERSATION-DETAILS] Error:", error);
    res.status(500).json({ message: error.message });
  }
});

router.post("/evaluate-now", authenticateToken, requireRole("consultant"), async (req, res) => {
  try {
    const { conversationId, timeOverrideHours } = req.body;
    const consultantId = req.user!.id;

    if (!conversationId) {
      return res.status(400).json({ message: "conversationId è obbligatorio" });
    }

    const [conversation] = await db
      .select({
        id: schema.whatsappConversations.id,
        phoneNumber: schema.whatsappConversations.phoneNumber,
        agentConfigId: schema.whatsappConversations.agentConfigId,
        lastMessageAt: schema.whatsappConversations.lastMessageAt,
        window24hExpiresAt: schema.whatsappConversations.window24hExpiresAt,
        agentName: schema.consultantWhatsappConfig.agentName,
        currentState: schema.conversationStates.currentState,
        followupCount: schema.conversationStates.followupCount,
        consecutiveNoReplyCount: schema.conversationStates.consecutiveNoReplyCount,
        temperatureLevel: schema.conversationStates.temperatureLevel,
      })
      .from(schema.whatsappConversations)
      .innerJoin(
        schema.consultantWhatsappConfig,
        eq(schema.consultantWhatsappConfig.id, schema.whatsappConversations.agentConfigId)
      )
      .leftJoin(
        schema.conversationStates,
        eq(schema.conversationStates.conversationId, schema.whatsappConversations.id)
      )
      .where(and(
        eq(schema.whatsappConversations.id, conversationId),
        eq(schema.consultantWhatsappConfig.consultantId, consultantId)
      ))
      .limit(1);

    if (!conversation) {
      return res.status(404).json({ message: "Conversazione non trovata" });
    }

    const now = new Date();
    let hoursSinceLastMessage = 0;
    
    if (conversation.lastMessageAt) {
      const lastMsg = new Date(conversation.lastMessageAt);
      hoursSinceLastMessage = (now.getTime() - lastMsg.getTime()) / (1000 * 60 * 60);
    }

    if (timeOverrideHours !== undefined && !isNaN(timeOverrideHours)) {
      hoursSinceLastMessage = timeOverrideHours;
    }

    const canSendFreeform = conversation.window24hExpiresAt 
      ? new Date(conversation.window24hExpiresAt) > now 
      : false;

    const consecutiveNoReply = conversation.consecutiveNoReplyCount || 0;
    const followupCount = conversation.followupCount || 0;
    const currentState = conversation.currentState || 'new';

    // Build conversation context for AI evaluation
    const lastMessages = await getLastMessages(conversationId, 15);
    const templates = await getAvailableTemplates(consultantId, conversation.agentConfigId);
    
    // Enrich messages with type detection
    const enrichedMessages = enrichMessages(lastMessages.map(m => ({
      id: m.timestamp,
      role: m.role === 'lead' ? 'lead' : 'agent',
      content: m.content,
      timestamp: m.timestamp,
      isTemplate: m.messageType === 'template',
    })));

    // Calculate timing for lead responses
    let lastLeadResponseTime: Date | null = null;
    for (const msg of lastMessages) {
      if (msg.role === 'lead') {
        lastLeadResponseTime = new Date(msg.timestamp);
        break;
      }
    }
    
    const hoursSinceLastLeadResponse = lastLeadResponseTime 
      ? (now.getTime() - lastLeadResponseTime.getTime()) / (1000 * 60 * 60)
      : null;

    // Apply time override if provided
    const effectiveHoursSinceLastMessage = timeOverrideHours !== undefined && !isNaN(timeOverrideHours) 
      ? timeOverrideHours 
      : hoursSinceLastMessage;

    // Build context for AI
    const context: ConversationContext = {
      conversationId,
      leadPhone: conversation.phoneNumber,
      currentState: currentState,
      agentType: 'setter',
      channel: 'whatsapp',
      hoursSinceLastMessage: effectiveHoursSinceLastMessage,
      hoursSinceLastLeadResponse: timeOverrideHours !== undefined ? timeOverrideHours : hoursSinceLastLeadResponse,
      daysSilent: Math.floor(effectiveHoursSinceLastMessage / 24),
      messages: enrichedMessages,
      totalMessages: lastMessages.length,
      messagesFromLead: lastMessages.filter(m => m.role === 'lead').length,
      messagesFromAgent: lastMessages.filter(m => m.role !== 'lead').length,
      templatessSent: lastMessages.filter(m => m.messageType === 'template').length,
      followupCount: followupCount,
      maxFollowupsAllowed: 5,
      signals: {
        hasAskedPrice: false,
        hasMentionedUrgency: false,
        hasSaidNoExplicitly: false,
        discoveryCompleted: false,
        demoPresented: false,
        leadNeverResponded: lastMessages.filter(m => m.role === 'lead').length === 0,
      },
      engagementScore: 50,
      conversionProbability: 0.3,
      temperatureLevel: (conversation.temperatureLevel as any) || 'warm',
      availableTemplates: templates.map(t => ({
        id: t.id,
        name: t.name,
        useCase: t.useCase,
        bodyPreview: t.bodyText?.substring(0, 100) || '',
      })),
      previousEvaluations: [],
      window24hExpiresAt: conversation.window24hExpiresAt ? new Date(conversation.window24hExpiresAt) : null,
      canSendFreeformNow: canSendFreeform,
    };

    // Call REAL AI evaluation
    console.log(`🧠 [EVALUATE-NOW] Calling evaluateWithHumanLikeAI for conversation ${conversationId}`);
    const startTime = Date.now();
    const aiDecision = await evaluateWithHumanLikeAI(context, consultantId);
    const latencyMs = Date.now() - startTime;

    // Log the decision
    await logHumanLikeDecision(conversationId, context, aiDecision, "gemini-2.5-flash", latencyMs);

    // If decision is send_now, send message IMMEDIATELY via Twilio
    let messageSent = false;
    let twilioSid: string | null = null;
    let twilioError: string | null = null;
    let scheduledMessageId: string | null = null;

    if (aiDecision.decision === 'send_now' && aiDecision.suggestedMessage) {
      console.log(`🚀 [EVALUATE-NOW] Decision is SEND_NOW - sending message LIVE via Twilio`);
      
      // 1. Insert scheduled message record first
      const [scheduledRecord] = await db.insert(schema.scheduledFollowupMessages).values({
        conversationId,
        templateId: aiDecision.suggestedTemplateId || null,
        messageText: aiDecision.suggestedMessage,
        scheduledFor: new Date(),
        status: 'processing',
        createdAt: new Date(),
      }).returning();
      
      scheduledMessageId = scheduledRecord.id;
      console.log(`📋 [EVALUATE-NOW] Created scheduled record: ${scheduledMessageId}`);
      
      // 2. Fetch agent config to check isDryRun
      const [agentConfig] = await db
        .select({ isDryRun: schema.consultantWhatsappConfig.isDryRun })
        .from(schema.consultantWhatsappConfig)
        .where(eq(schema.consultantWhatsappConfig.id, conversation.agentConfigId!))
        .limit(1);
      
      const isDryRun = agentConfig?.isDryRun ?? true;
      
      // 3. Save message to whatsappMessages table
      const [savedMessage] = await db
        .insert(schema.whatsappMessages)
        .values({
          conversationId,
          messageText: aiDecision.suggestedMessage,
          direction: "outbound",
          sender: "ai",
          templateId: aiDecision.suggestedTemplateId || null,
          metadata: {
            evaluateNowLiveSend: true,
            aiDecision: aiDecision.decision,
            confidenceScore: aiDecision.confidenceScore,
            scheduledMessageId,
          },
        })
        .returning();
      
      console.log(`💾 [EVALUATE-NOW] Saved message to DB: ${savedMessage.id}`);
      
      // 4. Send via Twilio (LIVE!)
      const { sendWhatsAppMessage } = await import("../whatsapp/twilio-client");
      
      if (!isDryRun) {
        try {
          twilioSid = await sendWhatsAppMessage(
            consultantId,
            conversation.phoneNumber,
            aiDecision.suggestedMessage,
            savedMessage.id,
            { 
              conversationId,
              agentConfigId: conversation.agentConfigId!,
            }
          );
          messageSent = true;
          console.log(`✅ [EVALUATE-NOW] Message sent LIVE via Twilio! SID: ${twilioSid}`);
          
          // 5. Update scheduled message status to 'sent'
          await db
            .update(schema.scheduledFollowupMessages)
            .set({
              status: 'sent',
              sentAt: new Date(),
            })
            .where(eq(schema.scheduledFollowupMessages.id, scheduledMessageId));
          
          // 6. Update conversation state counters
          await db
            .update(schema.conversationStates)
            .set({
              followupCount: sql`COALESCE(followup_count, 0) + 1`,
              lastFollowupAt: new Date(),
              updatedAt: new Date(),
            })
            .where(eq(schema.conversationStates.conversationId, conversationId));
          
          // 7. Update conversation lastMessageAt
          await db
            .update(schema.whatsappConversations)
            .set({
              lastMessageAt: new Date(),
              lastMessageFrom: 'ai',
              updatedAt: new Date(),
            })
            .where(eq(schema.whatsappConversations.id, conversationId));
          
        } catch (error: any) {
          twilioError = error.message || 'Unknown Twilio error';
          console.error(`❌ [EVALUATE-NOW] Twilio error:`, twilioError);
          
          // Update scheduled message status to 'failed'
          await db
            .update(schema.scheduledFollowupMessages)
            .set({
              status: 'failed',
              errorMessage: twilioError,
            })
            .where(eq(schema.scheduledFollowupMessages.id, scheduledMessageId));
        }
      } else {
        // DRY RUN mode - simulate success
        messageSent = true;
        twilioSid = `DRY_RUN_${Date.now()}`;
        console.log(`🧪 [EVALUATE-NOW] DRY RUN mode - message logged but NOT sent via Twilio`);
        
        await db
          .update(schema.scheduledFollowupMessages)
          .set({
            status: 'sent',
            sentAt: new Date(),
          })
          .where(eq(schema.scheduledFollowupMessages.id, scheduledMessageId));
      }
    } else if (aiDecision.decision === 'send_now' && !aiDecision.suggestedMessage) {
      console.log(`⚠️ [EVALUATE-NOW] Decision is send_now but no suggestedMessage provided`);
    }

    res.json({
      success: true,
      decision: aiDecision.decision,
      reasoning: aiDecision.reasoning,
      confidenceScore: aiDecision.confidenceScore,
      recommendedAction: aiDecision.decision === 'send_now' ? 'invia_messaggio' : 
                         aiDecision.decision === 'schedule' ? 'programma_invio' :
                         aiDecision.decision === 'stop' ? 'stop_followup' : 'attendere',
      templateId: aiDecision.suggestedTemplateId,
      templateName: aiDecision.suggestedTemplateId ? templates.find(t => t.id === aiDecision.suggestedTemplateId)?.name : undefined,
      messagePreview: aiDecision.suggestedMessage,
      internalThinking: aiDecision.internalThinking,
      // NEW: Live send confirmation
      liveSend: aiDecision.decision === 'send_now' ? {
        messageSent,
        twilioSid,
        twilioError,
        scheduledMessageId,
      } : undefined,
      context: {
        hoursSinceLastMessage: effectiveHoursSinceLastMessage.toFixed(1),
        canSendFreeform,
        consecutiveNoReply,
        followupCount,
        currentState,
        temperatureLevel: conversation.temperatureLevel,
      }
    });

  } catch (error: any) {
    console.error("❌ [EVALUATE-NOW] Error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Errore durante la valutazione"
    });
  }
});

export default router;
