import { db } from "../db";
import { aiConversations } from "@shared/schema";
import { eq, and, sql } from "drizzle-orm";

export type FlowStage = "awaiting_slot_selection" | "awaiting_confirm" | null;

export interface BookingFlowState {
  activeFlow: "consultations_booking" | null;
  flowStage: FlowStage;
  flowExpiresAt: Date | null;
  isActive: boolean;
  // Post-booking context: tracks last confirmed consultation for modify/cancel
  lastConsultationId: string | null;
  lastConsultationExpiresAt: Date | null;
  hasRecentConsultation: boolean;
}

const FLOW_TTL_MINUTES = 15;
const POST_BOOKING_CONTEXT_TTL_MINUTES = 30; // 30 min window to modify a just-confirmed booking

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
  const emptyState: BookingFlowState = { 
    activeFlow: null, 
    flowStage: null, 
    flowExpiresAt: null, 
    isActive: false,
    lastConsultationId: null,
    lastConsultationExpiresAt: null,
    hasRecentConsultation: false
  };

  if (!conversationId) {
    return emptyState;
  }

  const [conversation] = await db
    .select({
      activeFlow: aiConversations.activeFlow,
      flowStage: aiConversations.flowStage,
      flowExpiresAt: aiConversations.flowExpiresAt,
      lastConsultationId: aiConversations.lastConsultationId,
      lastConsultationExpiresAt: aiConversations.lastConsultationExpiresAt,
    })
    .from(aiConversations)
    .where(eq(aiConversations.id, conversationId))
    .limit(1);

  if (!conversation) {
    return emptyState;
  }

  const now = new Date();
  
  // Check if booking flow is expired
  const isFlowExpired = conversation.flowExpiresAt && conversation.flowExpiresAt < now;
  if (isFlowExpired) {
    await clearBookingFlowState(conversationId);
  }

  // Check if post-booking context is still valid
  const isConsultationContextValid = conversation.lastConsultationExpiresAt && 
    conversation.lastConsultationExpiresAt > now;
  const hasRecentConsultation = !!(conversation.lastConsultationId && isConsultationContextValid);

  const isActive = !isFlowExpired && 
    conversation.activeFlow === "consultations_booking" && 
    !!conversation.flowStage;

  return {
    activeFlow: isFlowExpired ? null : conversation.activeFlow as "consultations_booking" | null,
    flowStage: isFlowExpired ? null : conversation.flowStage as FlowStage,
    flowExpiresAt: isFlowExpired ? null : conversation.flowExpiresAt,
    isActive,
    lastConsultationId: hasRecentConsultation ? conversation.lastConsultationId : null,
    lastConsultationExpiresAt: hasRecentConsultation ? conversation.lastConsultationExpiresAt : null,
    hasRecentConsultation,
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

/**
 * Set post-booking context after a consultation is confirmed.
 * This allows the user to modify/cancel the booking within a time window.
 */
export async function setPostBookingContext(
  conversationId: string,
  consultationId: string
): Promise<void> {
  if (!conversationId || !consultationId) {
    console.log(`⚠️ [POST-BOOKING CONTEXT] Cannot set - missing conversationId or consultationId`);
    return;
  }

  const expiresAt = new Date(Date.now() + POST_BOOKING_CONTEXT_TTL_MINUTES * 60 * 1000);

  await db
    .update(aiConversations)
    .set({
      lastConsultationId: consultationId,
      lastConsultationExpiresAt: expiresAt,
      // Also clear the booking flow state since booking is complete
      activeFlow: null,
      flowStage: null,
      flowExpiresAt: null,
      updatedAt: new Date(),
    })
    .where(eq(aiConversations.id, conversationId));

  console.log(`📌 [POST-BOOKING CONTEXT] Set for conversation ${conversationId.slice(0, 8)}...:`);
  console.log(`   lastConsultationId: ${consultationId}, expiresAt: ${expiresAt.toISOString()}`);
}

/**
 * Clear post-booking context (e.g., after successful reschedule/cancel)
 */
export async function clearPostBookingContext(conversationId: string): Promise<void> {
  if (!conversationId) return;

  await db
    .update(aiConversations)
    .set({
      lastConsultationId: null,
      lastConsultationExpiresAt: null,
      updatedAt: new Date(),
    })
    .where(eq(aiConversations.id, conversationId));

  console.log(`🧹 [POST-BOOKING CONTEXT] Cleared for conversation ${conversationId.slice(0, 8)}...`);
}
