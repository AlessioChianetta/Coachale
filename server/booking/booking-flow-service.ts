import { db } from "../db";
import { aiConversations } from "@shared/schema";
import { eq, and, sql } from "drizzle-orm";

export type FlowStage = "awaiting_slot_selection" | "awaiting_confirm" | null;

export interface BookingFlowState {
  activeFlow: "consultations_booking" | null;
  flowStage: FlowStage;
  flowExpiresAt: Date | null;
  isActive: boolean;
}

const FLOW_TTL_MINUTES = 15;

export async function setBookingFlowState(
  conversationId: string,
  stage: FlowStage
): Promise<void> {
  if (!conversationId) {
    console.log(`⚠️ [BOOKING FLOW] Cannot set flow state - no conversationId`);
    return;
  }

  const expiresAt = stage ? new Date(Date.now() + FLOW_TTL_MINUTES * 60 * 1000) : null;
  const activeFlow = stage ? "consultations_booking" : null;

  await db
    .update(aiConversations)
    .set({
      activeFlow,
      flowStage: stage,
      flowExpiresAt: expiresAt,
      updatedAt: new Date(),
    })
    .where(eq(aiConversations.id, conversationId));

  console.log(`🔄 [BOOKING FLOW] Set flow state for conversation ${conversationId.slice(0, 8)}...:`);
  console.log(`   activeFlow: ${activeFlow}, stage: ${stage}, expiresAt: ${expiresAt?.toISOString() || 'null'}`);
}

export async function getBookingFlowState(
  conversationId: string
): Promise<BookingFlowState> {
  if (!conversationId) {
    return { activeFlow: null, flowStage: null, flowExpiresAt: null, isActive: false };
  }

  const [conversation] = await db
    .select({
      activeFlow: aiConversations.activeFlow,
      flowStage: aiConversations.flowStage,
      flowExpiresAt: aiConversations.flowExpiresAt,
    })
    .from(aiConversations)
    .where(eq(aiConversations.id, conversationId))
    .limit(1);

  if (!conversation) {
    return { activeFlow: null, flowStage: null, flowExpiresAt: null, isActive: false };
  }

  const now = new Date();
  const isExpired = conversation.flowExpiresAt && conversation.flowExpiresAt < now;
  
  if (isExpired) {
    await clearBookingFlowState(conversationId);
    return { activeFlow: null, flowStage: null, flowExpiresAt: null, isActive: false };
  }

  const isActive = conversation.activeFlow === "consultations_booking" && !!conversation.flowStage;

  return {
    activeFlow: conversation.activeFlow as "consultations_booking" | null,
    flowStage: conversation.flowStage as FlowStage,
    flowExpiresAt: conversation.flowExpiresAt,
    isActive,
  };
}

export async function clearBookingFlowState(conversationId: string): Promise<void> {
  if (!conversationId) return;

  await db
    .update(aiConversations)
    .set({
      activeFlow: null,
      flowStage: null,
      flowExpiresAt: null,
      updatedAt: new Date(),
    })
    .where(eq(aiConversations.id, conversationId));

  console.log(`🧹 [BOOKING FLOW] Cleared flow state for conversation ${conversationId.slice(0, 8)}...`);
}
