/**
 * Follow-up API Routes
 * CRUD endpoints per regole automazione, template e conversation states
 */

import { Router } from "express";
import { db } from "../db";
import * as schema from "../../shared/schema";
import { eq, and, desc, sql, gte, lte } from "drizzle-orm";
import { authenticateToken, requireRole } from "../middleware/auth";
import { getAIProvider } from "../ai/provider-factory";

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

export default router;
