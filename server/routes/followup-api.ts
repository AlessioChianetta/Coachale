/**
 * Follow-up API Routes
 * CRUD endpoints per regole automazione, template e conversation states
 */

import { Router } from "express";
import { db } from "../db";
import * as schema from "../../shared/schema";
import { eq, and, desc, sql, gte, lte } from "drizzle-orm";
import { authenticateToken, requireRole } from "../auth";

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
