/**
 * Instagram Message Processor
 * 
 * Processes incoming Instagram messages and generates AI responses.
 * Reuses shared AI logic from WhatsApp implementation:
 * - ai-prompts.ts: System prompt building
 * - ai-context-builder.ts: User context building
 * 
 * Key differences from WhatsApp:
 * - 24h window enforcement (cannot send if window closed)
 * - Uses Meta Graph API instead of Twilio
 * - No template messages for outreach
 */

import { db } from "../db";
import {
  instagramPendingMessages,
  instagramMessages,
  instagramConversations,
  consultantInstagramConfig,
  consultantWhatsappConfig,
  users,
  appointmentBookings,
  proposedAppointmentSlots,
  whatsappAgentKnowledgeItems,
  consultantKnowledgeDocuments,
} from "../../shared/schema";
import { eq, isNull, and, desc, asc, sql, gte, inArray } from "drizzle-orm";
import { buildUserContext, detectIntent } from "../ai-context-builder";
import { buildWhatsAppAgentPrompt } from "../whatsapp/agent-consultant-chat-service";
import { getAIProvider, getModelWithThinking, getModelForProviderName } from "../ai/provider-factory";
import { MetaClient, createMetaClient } from "./meta-client";
import { WindowTracker, checkWindowStatus } from "./window-tracker";
import { decryptForConsultant } from "../encryption";
import { nanoid } from "nanoid";
import { getMandatoryBookingBlock, CORE_CONVERSATION_RULES_BLOCK, OBJECTION_HANDLING_BLOCK, DISQUALIFICATION_BLOCK, BOOKING_CONVERSATION_PHASES_BLOCK } from "../whatsapp/instruction-blocks";
import { fileSearchService } from "../ai/file-search-service";
import { fileSearchSyncService } from "../services/file-search-sync-service";
import { 
  extractBookingDataFromConversation,
  mergeWithAccumulatedState,
  markExtractionStateCompleted,
  validateBookingData,
  createBookingRecord,
  createGoogleCalendarBooking,
  ConversationMessage,
  BookingExtractionResult,
  BookingModificationResult,
  ExistingBooking
} from "../booking/booking-service";
import { updateGoogleCalendarEvent, deleteGoogleCalendarEvent, addAttendeesToGoogleCalendarEvent } from "../google-calendar-service";
import { isActionAlreadyCompleted, LastCompletedAction, ActionDetails } from "../booking/booking-intent-detector";

// Debounce and queue system (mirrors WhatsApp implementation)
const DEBOUNCE_DELAY = 4000; // 4 seconds to match WhatsApp

interface QueueTask {
  conversationId: string;
  agentConfigId: string;
  consultantId: string;
}

const pendingTimers = new Map<string, NodeJS.Timeout>();
const consultantQueues = new Map<string, QueueTask[]>();
const processingConsultants = new Set<string>();
const inFlightConversations = new Set<string>(); // Guard to prevent duplicate processing
const pendingReschedule = new Map<string, QueueTask>(); // Track conversations needing reschedule (keyed by composite key)

// Helper to create composite key for reschedule tracking
function getRescheduleKey(conversationId: string, agentConfigId: string, consultantId: string): string {
  return `${conversationId}:${agentConfigId}:${consultantId}`;
}

/**
 * Schedule message processing with debounce and consultant-level queuing
 * Mirrors WhatsApp implementation to prevent double AI responses
 */
export function scheduleInstagramMessageProcessing(
  conversationId: string,
  agentConfigId: string,
  consultantId: string
): void {
  const key = `${conversationId}_${consultantId}`;

  console.log(`🔍 [INSTAGRAM SCHEDULE] scheduleInstagramMessageProcessing called for ${key}`);

  // Clear existing timer for this specific conversation
  if (pendingTimers.has(key)) {
    console.log(`⏲️  [INSTAGRAM SCHEDULE] Clearing existing timer for ${key}`);
    clearTimeout(pendingTimers.get(key)!);
  }

  // Schedule debounced processing
  const timer = setTimeout(async () => {
    console.log(`⚡ [INSTAGRAM SCHEDULE] Timer fired for ${key}, enqueueing...`);
    pendingTimers.delete(key);
    await enqueueInstagramProcessing(conversationId, agentConfigId, consultantId);
  }, DEBOUNCE_DELAY);

  pendingTimers.set(key, timer);
  console.log(`✅ [INSTAGRAM SCHEDULE] Timer set for ${key}, will fire in ${DEBOUNCE_DELAY}ms`);
}

async function enqueueInstagramProcessing(
  conversationId: string,
  agentConfigId: string,
  consultantId: string
): Promise<void> {
  console.log(`📥 [INSTAGRAM ENQUEUE] Adding to queue: conversation ${conversationId} for consultant ${consultantId}`);

  // Check if this conversation is already being processed
  // If so, mark for reschedule after current run completes to pick up new messages
  if (inFlightConversations.has(conversationId)) {
    const rescheduleKey = getRescheduleKey(conversationId, agentConfigId, consultantId);
    console.log(`⏭️ [INSTAGRAM ENQUEUE] Conversation ${conversationId} already in-flight, marking for reschedule`);
    pendingReschedule.set(rescheduleKey, { conversationId, agentConfigId, consultantId });
    return;
  }

  // Check if this conversation is already queued - skip if so
  const existingQueue = consultantQueues.get(consultantId);
  if (existingQueue && existingQueue.some(t => t.conversationId === conversationId)) {
    console.log(`⏭️ [INSTAGRAM ENQUEUE] Conversation ${conversationId} already in queue, skipping`);
    return;
  }

  // Add to consultant's queue
  if (!consultantQueues.has(consultantId)) {
    console.log(`🆕 [INSTAGRAM ENQUEUE] Creating new queue for consultant ${consultantId}`);
    consultantQueues.set(consultantId, []);
  }

  const queue = consultantQueues.get(consultantId)!;
  queue.push({ conversationId, agentConfigId, consultantId });
  console.log(`📊 [INSTAGRAM ENQUEUE] Queue size for consultant ${consultantId}: ${queue.length}`);

  // Process queue if not already processing
  if (!processingConsultants.has(consultantId)) {
    console.log(`🚀 [INSTAGRAM ENQUEUE] Starting queue processing for consultant ${consultantId}`);
    await processInstagramConsultantQueue(consultantId);
  } else {
    console.log(`⏳ [INSTAGRAM ENQUEUE] Queue already processing for consultant ${consultantId}, will pick up when done`);
  }
}

async function processInstagramConsultantQueue(consultantId: string): Promise<void> {
  if (processingConsultants.has(consultantId)) {
    return; // Already processing this consultant
  }

  processingConsultants.add(consultantId);

  try {
    const queue = consultantQueues.get(consultantId);
    if (!queue) {
      return;
    }

    while (queue.length > 0) {
      const task = queue.shift();
      if (!task) break;

      // Mark conversation as in-flight to prevent duplicate processing
      inFlightConversations.add(task.conversationId);

      try {
        await processInstagramConversation(task.conversationId, task.agentConfigId, task.consultantId);
      } catch (error: any) {
        console.error(`❌ [INSTAGRAM] Failed to process messages for conversation ${task.conversationId}`);
        console.error(`   Error type: ${error?.name || 'Unknown'}`);
        console.error(`   Error message: ${error?.message || error}`);
        if (error?.stack) {
          console.error(`   Stack trace:\n${error.stack}`);
        }
      } finally {
        // Release conversation from in-flight guard
        inFlightConversations.delete(task.conversationId);

        // Check if there was a reschedule request during processing
        const rescheduleKey = getRescheduleKey(task.conversationId, task.agentConfigId, task.consultantId);
        const rescheduleTask = pendingReschedule.get(rescheduleKey);
        if (rescheduleTask) {
          console.log(`🔄 [INSTAGRAM QUEUE] Reschedule detected for ${task.conversationId}, re-enqueueing`);
          pendingReschedule.delete(rescheduleKey);
          // Re-enqueue via the normal path to ensure proper processing
          // Use setImmediate to avoid blocking the current queue iteration
          setImmediate(() => {
            enqueueInstagramProcessing(
              rescheduleTask.conversationId,
              rescheduleTask.agentConfigId,
              rescheduleTask.consultantId
            );
          });
        }
      }
    }
  } finally {
    processingConsultants.delete(consultantId);
  }
}


/**
 * Process a conversation - main entry point
 */
async function processInstagramConversation(
  conversationId: string,
  agentConfigId: string,
  consultantId: string
): Promise<void> {
  const startTime = Date.now();
  console.log(`\n🔄 [INSTAGRAM] Processing conversation ${conversationId}`);

  // Hoisted for catch block access
  let batchMessageIds: string[] = [];

  try {
    // Check if window is still open
    const windowStatus = await checkWindowStatus(conversationId);
    if (!windowStatus.canSendMessage) {
      console.log(`⚠️ [INSTAGRAM] Window closed for conversation ${conversationId}. Cannot send message.`);
      await markPendingMessagesProcessed(conversationId);
      return;
    }

    // Get pending messages
    const pendingMessages = await db
      .select()
      .from(instagramPendingMessages)
      .where(
        and(
          eq(instagramPendingMessages.conversationId, conversationId),
          isNull(instagramPendingMessages.processedAt)
        )
      )
      .orderBy(asc(instagramPendingMessages.receivedAt));

    if (pendingMessages.length === 0) {
      console.log(`📭 [INSTAGRAM] No pending messages for conversation ${conversationId}`);
      return;
    }

    console.log(`📬 [INSTAGRAM] Found ${pendingMessages.length} pending message(s)`);

    // Extract IDs for batch-scoped processing (critical for mid-run message handling)
    batchMessageIds = pendingMessages.map(m => m.id);

    // Get conversation and config
    const [conversation] = await db
      .select()
      .from(instagramConversations)
      .where(eq(instagramConversations.id, conversationId))
      .limit(1);

    if (!conversation) {
      console.error(`❌ [INSTAGRAM] Conversation ${conversationId} not found`);
      return;
    }

    const [config] = await db
      .select()
      .from(consultantInstagramConfig)
      .where(eq(consultantInstagramConfig.id, agentConfigId))
      .limit(1);

    if (!config || !config.isActive) {
      console.error(`❌ [INSTAGRAM] Config ${agentConfigId} not found or inactive`);
      return;
    }

    // Get consultant
    const [consultant] = await db
      .select()
      .from(users)
      .where(eq(users.id, consultantId))
      .limit(1);

    if (!consultant) {
      console.error(`❌ [INSTAGRAM] Consultant ${consultantId} not found`);
      return;
    }

    // Look for linked WhatsApp agent (1 agent per Instagram account)
    const [linkedAgent] = await db
      .select()
      .from(consultantWhatsappConfig)
      .where(
        and(
          eq(consultantWhatsappConfig.instagramConfigId, config.id),
          eq(consultantWhatsappConfig.consultantId, consultantId),
          eq(consultantWhatsappConfig.isActive, true)
        )
      )
      .limit(1);

    if (linkedAgent) {
      console.log(`🔗 [INSTAGRAM] Found linked WhatsApp agent: ${linkedAgent.agentName} (${linkedAgent.id})`);
    } else {
      console.log(`⚠️ [INSTAGRAM] No linked WhatsApp agent, using Instagram config settings`);
    }

    // Combine pending messages
    const combinedMessage = pendingMessages
      .map((m) => m.messageText)
      .join("\n");

    // Mark as processing (generate batch ID)
    const batchId = nanoid(10);
    await db
      .update(instagramPendingMessages)
      .set({ batchId })
      .where(
        and(
          eq(instagramPendingMessages.conversationId, conversationId),
          isNull(instagramPendingMessages.processedAt)
        )
      );

    // Get conversation history
    const messageHistory = await db
      .select()
      .from(instagramMessages)
      .where(eq(instagramMessages.conversationId, conversationId))
      .orderBy(desc(instagramMessages.createdAt))
      .limit(30);

    // Format history for AI
    const formattedHistory = messageHistory
      .reverse()
      .map((m) => ({
        role: m.sender === "client" ? "user" as const : "assistant" as const,
        content: m.messageText,
      }));

    // Generate AI response using shared logic (prefer linked agent settings)
    const aiResponse = await generateAIResponse(
      config,
      consultant,
      conversation,
      combinedMessage,
      formattedHistory,
      linkedAgent || null,
      pendingMessages
    );

    if (!aiResponse) {
      console.log(`⚠️ [INSTAGRAM] No AI response generated`);
      await markPendingMessagesProcessed(conversationId);
      return;
    }

    // Send message via Meta API
    await sendInstagramResponse(
      config,
      consultant,
      conversation,
      aiResponse,
      windowStatus.canUseHumanAgentTag
    );

    // ═══════════════════════════════════════════════════════════════════════════════
    // BOOKING EXTRACTION - Extract booking data from conversation (like WhatsApp)
    // Supports: NEW BOOKING, MODIFY, CANCEL, ADD_ATTENDEES
    // ═══════════════════════════════════════════════════════════════════════════════
    if (linkedAgent && linkedAgent.bookingEnabled) {
      try {
        console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('🔍 [INSTAGRAM BOOKING EXTRACTION] Starting extraction...');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        
        // ═══════════════════════════════════════════════════════════════════════════════
        // STEP 1: Check for existing confirmed booking (like WhatsApp lines 2126-2147)
        // ═══════════════════════════════════════════════════════════════════════════════
        let existingBookingForModification: ExistingBooking | null = null;
        let lastCompletedAction: LastCompletedAction | null = null;
        
        // STEP 1: Search for ACTIVE booking by instagramConversationId
        // Include both 'confirmed' and 'proposed' status (like WhatsApp)
        let existingBooking = await db
          .select()
          .from(appointmentBookings)
          .where(
            and(
              eq(appointmentBookings.instagramConversationId, conversation.id),
              sql`(${appointmentBookings.status} = 'confirmed' OR ${appointmentBookings.status} = 'proposed')`
            )
          )
          .orderBy(desc(appointmentBookings.createdAt))
          .limit(1)
          .then(r => r[0] || null);
        
        // STEP 2: If no active booking, check if there's a CANCELLED booking in this conversation
        // If yes, we're in NEW BOOKING mode - DO NOT use instagramUserId fallback
        // This prevents modifying other bookings after user cancelled one in this conversation
        let skipFallbackDueToCancellation = false;
        
        if (!existingBooking && conversation.instagramUserId) {
          const cancelledInThisConversation = await db
            .select({ id: appointmentBookings.id })
            .from(appointmentBookings)
            .where(
              and(
                eq(appointmentBookings.instagramConversationId, conversation.id),
                eq(appointmentBookings.status, 'cancelled')
              )
            )
            .limit(1)
            .then(r => r[0] || null);
          
          if (cancelledInThisConversation) {
            console.log(`⛔ [INSTAGRAM] Cancelled booking exists in this conversation - skipping instagramUserId fallback`);
            console.log(`   → User cancelled here, treating as NEW BOOKING mode`);
            skipFallbackDueToCancellation = true;
          }
        }
        
        // STEP 3: Fallback to instagramUserId ONLY if no cancelled booking in this conversation
        if (!existingBooking && conversation.instagramUserId && !skipFallbackDueToCancellation) {
          existingBooking = await db
            .select()
            .from(appointmentBookings)
            .where(
              and(
                eq(appointmentBookings.consultantId, config.consultantId),
                eq(appointmentBookings.instagramUserId, conversation.instagramUserId),
                sql`(${appointmentBookings.status} = 'confirmed' OR ${appointmentBookings.status} = 'proposed')`
              )
            )
            .orderBy(desc(appointmentBookings.createdAt))
            .limit(1)
            .then(r => r[0] || null);
          
          if (existingBooking) {
            console.log(`✅ [INSTAGRAM] Found booking via instagramUserId fallback`);
          }
        }
        
        if (existingBooking) {
          existingBookingForModification = {
            id: existingBooking.id,
            appointmentDate: existingBooking.appointmentDate,
            appointmentTime: existingBooking.appointmentTime,
            clientEmail: existingBooking.leadEmail,
            clientPhone: existingBooking.leadPhone,
            googleEventId: existingBooking.googleEventId,
          };
          lastCompletedAction = existingBooking.lastCompletedAction as LastCompletedAction | null;
          console.log(`✅ [INSTAGRAM APPOINTMENT MANAGEMENT] Existing booking found`);
          console.log(`   🆔 Booking ID: ${existingBooking.id}`);
          console.log(`   📅 Date: ${existingBooking.appointmentDate} ${existingBooking.appointmentTime}`);
          console.log(`   🔍 Checking for MODIFICATION or CANCELLATION intent...`);
        } else {
          console.log(`📅 [INSTAGRAM NEW BOOKING] No existing booking - checking for new appointment`);
        }
        
        // Get fresh message history including the AI response we just sent
        const recentMessages = await db
          .select()
          .from(instagramMessages)
          .where(eq(instagramMessages.conversationId, conversationId))
          .orderBy(desc(instagramMessages.createdAt))
          .limit(15);
        
        // Convert to ConversationMessage format (oldest first)
        const conversationMessages = recentMessages
          .slice()
          .reverse()
          .map(m => ({
            sender: m.sender === 'client' ? 'client' as const : 'ai' as const,
            messageText: m.messageText || ''
          }));
        
        console.log(`   📚 Analyzing ${conversationMessages.length} messages for booking data...`);
        
        // Get AI provider for booking extraction
        const bookingAiProvider = await getAIProvider(config.consultantId, config.consultantId);
        
        // Extract booking data using centralized service with accumulator pattern
        // Pass existing booking if found to detect MODIFY/CANCEL/ADD_ATTENDEES intents
        const extracted = await extractBookingDataFromConversation(
          conversationMessages,
          existingBookingForModification || undefined,
          bookingAiProvider.client,
          'Europe/Rome',
          undefined, // providerName
          {
            publicConversationId: conversation.id, // Use publicConversationId for Instagram accumulator
            consultantId: config.consultantId,
          }
        );
        
        // ═══════════════════════════════════════════════════════════════════════════════
        // HANDLE MODIFICATION RESULTS (MODIFY/CANCEL/ADD_ATTENDEES)
        // ═══════════════════════════════════════════════════════════════════════════════
        if (extracted && 'intent' in extracted && existingBookingForModification) {
          const modResult = extracted as BookingModificationResult;
          console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
          console.log('📊 [INSTAGRAM APPOINTMENT MANAGEMENT] Intent Detection Results');
          console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
          console.log(`🎯 Intent: ${modResult.intent}`);
          console.log(`📅 New Date: ${modResult.newDate || 'N/A'}`);
          console.log(`🕐 New Time: ${modResult.newTime || 'N/A'}`);
          console.log(`👥 Attendees: ${modResult.attendees?.length > 0 ? modResult.attendees.join(', ') : 'None'}`);
          console.log(`✅ Confirmed Times: ${modResult.confirmedTimes}`);
          console.log(`💯 Confidence: ${modResult.confidence?.toUpperCase() || 'N/A'}`);
          console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
          
          // Helper to send Instagram message
          const sendInstagramConfirmation = async (messageText: string) => {
            let pageAccessToken = config.pageAccessToken;
            if (pageAccessToken && consultant.encryptionSalt) {
              try {
                pageAccessToken = decryptForConsultant(pageAccessToken, consultant.encryptionSalt);
              } catch (e) {
                console.log("🔓 [INSTAGRAM] Token not encrypted, using as-is");
              }
            }
            
            if (pageAccessToken && config.facebookPageId) {
              await db.insert(instagramMessages).values({
                conversationId: conversation.id,
                instagramMessageId: `ig_manage_${Date.now()}`,
                messageText,
                direction: 'outbound',
                sender: 'ai',
              });
              
              const metaClient = createMetaClient({
                pageAccessToken,
                instagramPageId: config.facebookPageId,
                isDryRun: config.isDryRun,
              });
              
              await metaClient.sendMessage(conversation.instagramUserId, messageText);
              console.log(`   📱 Instagram Message: ✅ Sent to ${conversation.instagramUserId}`);
            }
          };
          
          // ═══════════════════════════════════════════════════════════════════════════════
          // MODIFY APPOINTMENT - Requires 1 confirmation (like WhatsApp lines 2476-2594)
          // ═══════════════════════════════════════════════════════════════════════════════
          if (modResult.intent === 'MODIFY' && modResult.newDate && modResult.newTime) {
            console.log('\n🔄 [INSTAGRAM MODIFY APPOINTMENT] Starting modification process...');
            
            // Check if date/time are identical to existing booking - no real modification needed
            const isSameDateAndTime = 
              existingBookingForModification.appointmentDate === modResult.newDate &&
              existingBookingForModification.appointmentTime === modResult.newTime;
            
            if (isSameDateAndTime) {
              console.log(`   ⏭️ [INSTAGRAM MODIFY] Skipping - new date/time identical to existing booking`);
              console.log(`      Existing: ${existingBookingForModification.appointmentDate} ${existingBookingForModification.appointmentTime}`);
              console.log(`      Requested: ${modResult.newDate} ${modResult.newTime}`);
            } else {
            const modifyDetails: ActionDetails = {
              newDate: modResult.newDate,
              newTime: modResult.newTime
            };
            if (isActionAlreadyCompleted(lastCompletedAction, 'MODIFY', modifyDetails)) {
              console.log(`   ⏭️ [INSTAGRAM MODIFY] Skipping - same modification already completed recently`);
            } else if (!modResult.confirmedTimes || modResult.confirmedTimes < 1) {
              console.log(`⚠️ [INSTAGRAM MODIFY] Insufficient confirmations (${modResult.confirmedTimes || 0}/1)`);
              console.log('   AI should ask for confirmation via prompt - skipping modification');
            } else {
              console.log(`✅ [INSTAGRAM MODIFY] Confirmed ${modResult.confirmedTimes} time(s) - proceeding with modification`);
              
              const duration = linkedAgent?.appointmentDuration || 60;
              const timezone = "Europe/Rome";
              
              // Update Google Calendar if exists
              if (existingBookingForModification.googleEventId) {
                try {
                  const success = await updateGoogleCalendarEvent(
                    config.consultantId,
                    existingBookingForModification.googleEventId,
                    {
                      startDate: modResult.newDate,
                      startTime: modResult.newTime,
                      duration,
                      timezone
                    },
                    linkedAgent.id
                  );
                  if (success) {
                    console.log('✅ [INSTAGRAM MODIFY] Google Calendar event updated successfully');
                  }
                } catch (gcalError: any) {
                  console.error('⚠️ [INSTAGRAM MODIFY] Failed to update Google Calendar:', gcalError.message);
                }
              }
              
              // Calculate new end time
              const [startHour, startMinute] = modResult.newTime.split(':').map(Number);
              const totalMinutes = startHour * 60 + startMinute + duration;
              const endHour = Math.floor(totalMinutes / 60) % 24;
              const endMinute = totalMinutes % 60;
              const formattedEndTime = `${endHour.toString().padStart(2, '0')}:${endMinute.toString().padStart(2, '0')}`;
              
              // Update database
              await db
                .update(appointmentBookings)
                .set({
                  appointmentDate: modResult.newDate,
                  appointmentTime: modResult.newTime,
                  appointmentEndTime: formattedEndTime,
                  lastCompletedAction: {
                    type: 'MODIFY' as const,
                    completedAt: new Date().toISOString(),
                    triggerMessageId: conversation.id,
                    details: {
                      oldDate: existingBookingForModification.appointmentDate,
                      oldTime: existingBookingForModification.appointmentTime,
                      newDate: modResult.newDate,
                      newTime: modResult.newTime
                    }
                  }
                })
                .where(eq(appointmentBookings.id, existingBookingForModification.id));
              
              console.log('💾 [INSTAGRAM MODIFY] Database updated with lastCompletedAction');
              
              // Send confirmation message
              const modifyMessage = `✅ APPUNTAMENTO MODIFICATO!

📅 Nuovo appuntamento:
🗓️ Data: ${modResult.newDate.split('-').reverse().join('/')}
🕐 Orario: ${modResult.newTime}

Ti ho aggiornato l'invito al calendario all'indirizzo ${existingBookingForModification.clientEmail}. Controlla la tua inbox! 📬

Ci vediamo alla nuova data! 🚀`;
              
              await sendInstagramConfirmation(modifyMessage);
              console.log('✅ [INSTAGRAM MODIFY] Modification complete and confirmation sent!');
            }
            }
          }
          
          // ═══════════════════════════════════════════════════════════════════════════════
          // CANCEL APPOINTMENT - Requires 2 confirmations (aligned with WhatsApp behavior)
          // ═══════════════════════════════════════════════════════════════════════════════
          else if (modResult.intent === 'CANCEL') {
            console.log('\n🗑️ [INSTAGRAM CANCEL APPOINTMENT] Starting cancellation process...');
            
            if (isActionAlreadyCompleted(lastCompletedAction, 'CANCEL')) {
              console.log(`   ⏭️ [INSTAGRAM CANCEL] Skipping - action already completed recently`);
            } else if (!modResult.confirmedTimes || modResult.confirmedTimes < 2) {
              console.log(`⚠️ [INSTAGRAM CANCEL] Insufficient confirmations (${modResult.confirmedTimes || 0}/2)`);
              console.log('   AI should continue asking for confirmation via prompt - skipping cancellation');
            } else {
              console.log(`✅ [INSTAGRAM CANCEL] Confirmed ${modResult.confirmedTimes} times - proceeding with cancellation`);
              
              // Delete from Google Calendar if exists
              let calendarDeleteSuccess = true;
              if (existingBookingForModification.googleEventId) {
                try {
                  const success = await deleteGoogleCalendarEvent(
                    config.consultantId,
                    existingBookingForModification.googleEventId,
                    linkedAgent.id
                  );
                  if (success) {
                    console.log('✅ [INSTAGRAM CANCEL] Google Calendar event deleted successfully');
                  } else {
                    console.log('⚠️ [INSTAGRAM CANCEL] Failed to delete from Google Calendar');
                    calendarDeleteSuccess = false;
                  }
                } catch (gcalError: any) {
                  console.error('⚠️ [INSTAGRAM CANCEL] Failed to delete from Google Calendar:', gcalError.message);
                  calendarDeleteSuccess = false;
                }
              }
              
              // Update database status
              await db
                .update(appointmentBookings)
                .set({
                  status: 'cancelled',
                  lastCompletedAction: {
                    type: 'CANCEL' as const,
                    completedAt: new Date().toISOString(),
                    triggerMessageId: conversation.id,
                    details: {
                      oldDate: existingBookingForModification.appointmentDate,
                      oldTime: existingBookingForModification.appointmentTime
                    }
                  }
                })
                .where(eq(appointmentBookings.id, existingBookingForModification.id));
              
              console.log('💾 [INSTAGRAM CANCEL] Database updated with lastCompletedAction');
              
              // Send confirmation message
              const cancelMessage = calendarDeleteSuccess
                ? `✅ APPUNTAMENTO CANCELLATO

Ho cancellato il tuo appuntamento del ${existingBookingForModification.appointmentDate.split('-').reverse().join('/')} alle ${existingBookingForModification.appointmentTime}.

Se in futuro vorrai riprogrammare, sarò qui per aiutarti! 😊`
                : `⚠️ APPUNTAMENTO CANCELLATO (verifica calendario)

Ho cancellato il tuo appuntamento del ${existingBookingForModification.appointmentDate.split('-').reverse().join('/')} alle ${existingBookingForModification.appointmentTime} dal sistema.

⚠️ Nota: C'è stato un problema nell'aggiornamento del tuo Google Calendar. Per favore, verifica manualmente che l'evento sia stato rimosso dal tuo calendario.

Se vuoi riprogrammare in futuro, scrivimi! 😊`;
              
              await sendInstagramConfirmation(cancelMessage);
              console.log('✅ [INSTAGRAM CANCEL] Cancellation complete and confirmation sent!');
            }
          }
          
          // ═══════════════════════════════════════════════════════════════════════════════
          // ADD ATTENDEES - No confirmation required (like WhatsApp lines 2693-2801)
          // ═══════════════════════════════════════════════════════════════════════════════
          else if (modResult.intent === 'ADD_ATTENDEES' && modResult.attendees && modResult.attendees.length > 0) {
            console.log('\n👥 [INSTAGRAM ADD ATTENDEES] Starting add attendees process...');
            
            const addAttendeesDetails: ActionDetails = {
              attendees: modResult.attendees
            };
            if (isActionAlreadyCompleted(lastCompletedAction, 'ADD_ATTENDEES', addAttendeesDetails)) {
              console.log(`   ⏭️ [INSTAGRAM ADD ATTENDEES] Skipping - same attendees already added recently`);
            } else {
              console.log('   ✅ No confirmation required for adding attendees - proceeding directly');
              console.log(`   📧 Attendees to add: ${modResult.attendees.join(', ')}`);
              
              if (existingBookingForModification.googleEventId) {
                try {
                  const result = await addAttendeesToGoogleCalendarEvent(
                    config.consultantId,
                    existingBookingForModification.googleEventId,
                    modResult.attendees,
                    linkedAgent.id
                  );
                  
                  console.log(`✅ [INSTAGRAM ADD ATTENDEES] Google Calendar updated - ${result.added} added, ${result.skipped} already invited`);
                  
                  // Save lastCompletedAction
                  await db
                    .update(appointmentBookings)
                    .set({
                      lastCompletedAction: {
                        type: 'ADD_ATTENDEES' as const,
                        completedAt: new Date().toISOString(),
                        triggerMessageId: conversation.id,
                        details: {
                          attendeesAdded: modResult.attendees
                        }
                      }
                    })
                    .where(eq(appointmentBookings.id, existingBookingForModification.id));
                  
                  // Send confirmation message
                  const addAttendeesMessage = result.added > 0
                    ? `✅ INVITATI AGGIUNTI!

Ho aggiunto ${result.added} ${result.added === 1 ? 'invitato' : 'invitati'} all'appuntamento del ${existingBookingForModification.appointmentDate.split('-').reverse().join('/')} alle ${existingBookingForModification.appointmentTime}.

${result.skipped > 0 ? `ℹ️ ${result.skipped} ${result.skipped === 1 ? 'era già invitato' : 'erano già invitati'}.\n\n` : ''}📧 Gli inviti Google Calendar sono stati inviati automaticamente! 📬`
                    : `ℹ️ Tutti gli invitati sono già stati aggiunti all'appuntamento del ${existingBookingForModification.appointmentDate.split('-').reverse().join('/')} alle ${existingBookingForModification.appointmentTime}. 

Nessuna modifica necessaria! ✅`;
                  
                  await sendInstagramConfirmation(addAttendeesMessage);
                  console.log('✅ [INSTAGRAM ADD ATTENDEES] Confirmation message sent with lastCompletedAction saved!');
                  
                } catch (gcalError: any) {
                  console.error('⚠️ [INSTAGRAM ADD ATTENDEES] Failed to add attendees to Google Calendar');
                  console.error(`   Event ID: ${existingBookingForModification.googleEventId}`);
                  console.error(`   Error: ${gcalError?.message || gcalError}`);
                  
                  const errorMessage = `⚠️ Mi dispiace, ho riscontrato un errore nell'aggiungere gli invitati al calendario.

Per favore riprova o aggiungili manualmente dal tuo Google Calendar. 🙏`;
                  
                  await sendInstagramConfirmation(errorMessage);
                }
              } else {
                console.log('⚠️ [INSTAGRAM ADD ATTENDEES] No Google Event ID found - cannot add attendees');
              }
            }
          } else if (modResult.intent === 'NONE') {
            console.log('💬 [INSTAGRAM APPOINTMENT MANAGEMENT] No modification/cancellation/add attendees intent detected - continuing normal conversation');
          }
        }
        
        // ═══════════════════════════════════════════════════════════════════════════════
        // HANDLE NEW BOOKING RESULTS (existing logic)
        // ═══════════════════════════════════════════════════════════════════════════════
        else if (extracted && 'isConfirming' in extracted) {
          console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
          console.log('📊 [INSTAGRAM BOOKING] Extraction Results');
          console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
          console.log(`🎯 Confirming: ${extracted.isConfirming ? '✅ YES' : '❌ NO'}`);
          console.log(`📅 Date:     ${extracted.date ? `✅ ${extracted.date}` : '❌ MISSING'}`);
          console.log(`🕐 Time:     ${extracted.time ? `✅ ${extracted.time}` : '❌ MISSING'}`);
          console.log(`📞 Phone:    ${extracted.phone ? `✅ ${extracted.phone}` : '❌ MISSING'}`);
          console.log(`📧 Email:    ${extracted.email ? `✅ ${extracted.email}` : '❌ MISSING'}`);
          console.log(`👤 Name:     ${extracted.name ? `✅ ${extracted.name}` : '❌ MISSING'}`);
          console.log(`💯 Confidence: ${extracted.confidence?.toUpperCase() || 'N/A'}`);
          console.log(`✔️ Complete: ${extracted.hasAllData ? '✅ YES - Ready to book!' : '❌ NO - Missing fields'}`);
          console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
          
          // If user is confirming, validate and create booking using centralized service
          // Instagram requires same fields as WhatsApp: date, time, email, AND phone
          if (extracted.isConfirming && extracted.date && extracted.time && extracted.email && extracted.phone) {
            console.log('\n🎉 [INSTAGRAM BOOKING] User is confirming! Validating data...');
            
            // Validate booking data using centralized service
            const validation = await validateBookingData(
              extracted as BookingExtractionResult,
              config.consultantId,
              'Europe/Rome',
              'instagram'
            );
            
            if (!validation.valid) {
              console.log(`❌ [INSTAGRAM BOOKING] Validation failed: ${validation.reason}`);
            } else {
              // Build client name from Instagram profile or extracted name
              const clientName = extracted.name || 
                conversation.instagramName || 
                (conversation.instagramUsername ? `@${conversation.instagramUsername}` : 'Instagram User');
              
              // Create booking using centralized service
              const newBooking = await createBookingRecord(
                config.consultantId,
                null, // No WhatsApp conversationId
                {
                  date: extracted.date,
                  time: extracted.time,
                  email: extracted.email,
                  phone: extracted.phone || null,
                  name: clientName,
                },
                'instagram',
                null, // No publicConversationId
                {
                  instagramUserId: conversation.instagramUserId,
                  instagramConversationId: conversation.id,
                  agentConfigId: linkedAgent.id,
                }
              );
              
              if (newBooking) {
                console.log(`✅ [INSTAGRAM BOOKING] Created booking: ${newBooking.id}`);
                console.log(`   📅 Date: ${newBooking.appointmentDate} at ${newBooking.appointmentTime}`);
                console.log(`   👤 Client: ${newBooking.clientName}`);
                console.log(`   📱 Instagram ID: ${conversation.instagramUserId}`);
                
                let googleMeetLink: string | null = null;
                let googleEventId: string | null = null;
                
                // Try to create Google Calendar event if configured
                try {
                  const calendarResult = await createGoogleCalendarBooking(
                    config.consultantId,
                    newBooking,
                    extracted.email,
                    linkedAgent.id
                  );
                  if (calendarResult.googleEventId) {
                    googleEventId = calendarResult.googleEventId;
                    googleMeetLink = calendarResult.googleMeetLink || null;
                    console.log(`   📅 Google Calendar event: ${googleEventId}`);
                    console.log(`   🎥 Meet Link: ${googleMeetLink ? '✅ Generated' : '❌ Not available'}`);
                  }
                } catch (calError) {
                  console.log(`   ⚠️ Google Calendar not configured or error: ${calError}`);
                }
                
                // Send confirmation message to user (like WhatsApp does)
                try {
                  // Get page access token for sending
                  let pageAccessToken = config.pageAccessToken;
                  if (pageAccessToken && consultant.encryptionSalt) {
                    try {
                      pageAccessToken = decryptForConsultant(pageAccessToken, consultant.encryptionSalt);
                    } catch (e) {
                      console.log("🔓 [INSTAGRAM] Token not encrypted, using as-is");
                    }
                  }
                  
                  if (pageAccessToken && config.facebookPageId) {
                    // Format date in Italian
                    const dateFormatter = new Intl.DateTimeFormat('it-IT', {
                      weekday: 'long',
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                      timeZone: 'Europe/Rome'
                    });
                    const appointmentDateObj = new Date(`${extracted.date}T${extracted.time}:00`);
                    const formattedDate = dateFormatter.format(appointmentDateObj);
                    
                    // Get duration from agent settings
                    const duration = linkedAgent?.appointmentDuration || 60;
                    
                    // Build confirmation message (same format as WhatsApp)
                    const confirmationMessage = `✅ APPUNTAMENTO CONFERMATO!

📅 Data: ${formattedDate}
🕐 Orario: ${extracted.time}
⏱️ Durata: ${duration} minuti
📧 Email: ${extracted.email}

📬 Ti ho inviato l'invito al calendario all'indirizzo ${extracted.email}. Controlla la tua inbox!
${googleMeetLink ? `\n🎥 Link Google Meet: ${googleMeetLink}\n\n👉 Clicca sul link nell'invito o usa questo link per collegarti alla call.` : ''}

Ci vediamo online! 🚀`;

                    // Save to database
                    await db.insert(instagramMessages).values({
                      conversationId: conversation.id,
                      instagramMessageId: `ig_confirm_${Date.now()}`,
                      senderId: config.instagramAccountId || 'agent',
                      messageText: confirmationMessage,
                      direction: 'outbound',
                    });
                    
                    // Send via Meta API
                    const confirmClient = createMetaClient({
                      pageAccessToken,
                      instagramPageId: config.facebookPageId,
                      isDryRun: config.isDryRun,
                    });
                    
                    await confirmClient.sendMessage(conversation.instagramUserId, confirmationMessage);
                    
                    console.log(`   📱 Instagram Confirmation: ✅ Sent to ${conversation.instagramUserId}`);
                  }
                } catch (confirmError) {
                  console.log(`   ⚠️ Failed to send Instagram confirmation: ${confirmError}`);
                }
                
                // Mark extraction state as completed (null for WhatsApp conversationId, Instagram uses publicConversationId)
                await markExtractionStateCompleted(null, conversation.id);
              }
            }
          } else if (extracted.isConfirming) {
            console.log('⏳ [INSTAGRAM BOOKING] User is confirming but missing required data:');
            if (!extracted.date) console.log('   ❌ Missing: date');
            if (!extracted.time) console.log('   ❌ Missing: time');
            if (!extracted.email) console.log('   ❌ Missing: email');
            if (!extracted.phone) console.log('   ❌ Missing: phone');
          }
        }
      } catch (bookingError) {
        console.error('❌ [INSTAGRAM BOOKING] Extraction error:', bookingError);
      }
    }

    // Mark only the batch messages we actually processed (not any that arrived mid-run)
    await markPendingMessagesProcessed(conversationId, batchMessageIds);

    const duration = Date.now() - startTime;
    console.log(`✅ [INSTAGRAM] Processed conversation ${conversationId} in ${duration}ms`);
  } catch (error) {
    console.error(`❌ [INSTAGRAM] Error processing conversation ${conversationId}:`, error);
    // Leave messages pending - they will be retried on next message or reschedule
    // The 24h Instagram window provides natural expiration for stuck messages
    // Schedule a retry after a delay to give transient issues time to resolve
    setTimeout(() => {
      console.log(`🔄 [INSTAGRAM] Auto-retry for conversation ${conversationId} after error`);
      scheduleInstagramMessageProcessing(conversationId, agentConfigId, consultantId);
    }, 30000); // 30 second delay before retry
  }
}

/**
 * Generate AI response using shared AI logic
 * If a linked WhatsApp agent exists, use its settings; otherwise fall back to Instagram config
 */
async function generateAIResponse(
  config: typeof consultantInstagramConfig.$inferSelect,
  consultant: typeof users.$inferSelect,
  conversation: typeof instagramConversations.$inferSelect,
  userMessage: string,
  messageHistory: Array<{ role: "user" | "assistant"; content: string }>,
  linkedAgent: typeof consultantWhatsappConfig.$inferSelect | null,
  pendingMessages?: Array<typeof instagramPendingMessages.$inferSelect>
): Promise<string | null> {
  try {
    // Use linked WhatsApp agent settings if available, otherwise fall back to Instagram config
    const source = linkedAgent || config;
    
    // Build agent config object compatible with WhatsApp structure
    const agentConfigForAI = {
      id: linkedAgent?.id || config.id,
      consultantId: config.consultantId,
      agentName: source.agentName,
      agentType: source.agentType,
      businessName: source.businessName,
      consultantDisplayName: source.consultantDisplayName,
      businessDescription: source.businessDescription,
      consultantBio: source.consultantBio,
      salesScript: source.salesScript,
      aiPersonality: source.aiPersonality,
      vision: source.vision,
      mission: source.mission,
      values: source.values,
      usp: source.usp,
      whoWeHelp: source.whoWeHelp,
      whoWeDontHelp: source.whoWeDontHelp,
      whatWeDo: source.whatWeDo,
      howWeDoIt: source.howWeDoIt,
      agentInstructions: source.agentInstructions,
      agentInstructionsEnabled: source.agentInstructionsEnabled,
      bookingEnabled: source.bookingEnabled,
      objectionHandlingEnabled: source.objectionHandlingEnabled,
      disqualificationEnabled: source.disqualificationEnabled,
      isProactiveAgent: linkedAgent?.isProactiveAgent || false,
      integrationMode: "whatsapp_ai" as const,
    };
    
    console.log(`🤖 [INSTAGRAM] Using ${linkedAgent ? 'linked WhatsApp agent' : 'Instagram config'} settings for AI: ${agentConfigForAI.agentName}`);
    console.log(`📋 [INSTAGRAM] Agent instructions enabled: ${agentConfigForAI.agentInstructionsEnabled}, length: ${agentConfigForAI.agentInstructions?.length || 0}`);
    console.log(`📋 [INSTAGRAM] Booking enabled: ${agentConfigForAI.bookingEnabled}, Objection: ${agentConfigForAI.objectionHandlingEnabled}`);

    // Build system prompt using shared WhatsApp agent logic
    const systemPrompt = await buildWhatsAppAgentPrompt(agentConfigForAI);
    console.log(`📝 [INSTAGRAM] System prompt length: ${systemPrompt.length} chars`);

    // Fetch user profile for richer context
    let userProfileInfo = "";
    try {
      let pageAccessToken = config.pageAccessToken;
      if (pageAccessToken && consultant.encryptionSalt) {
        try {
          pageAccessToken = decryptForConsultant(pageAccessToken, consultant.encryptionSalt);
        } catch (e) {
          console.log("🔓 [INSTAGRAM] Token not encrypted, using as-is for profile fetch");
        }
      }
      
      if (pageAccessToken && config.instagramPageId) {
        const metaClient = createMetaClient({
          pageAccessToken,
          instagramPageId: config.instagramPageId,
          isDryRun: config.isDryRun,
        });
        const profile = await metaClient.getUserProfile(conversation.instagramUserId) as any;
        if (profile) {
          const profileParts = [
            `- Username Instagram: @${profile.username || conversation.instagramUsername || "sconosciuto"}`,
            `- Nome: ${profile.name || "Non disponibile"}`
          ];
          
          // Add biography if available (requires instagram_graph_user_profile permission)
          if (profile.biography) {
            profileParts.push(`- Bio del profilo: "${profile.biography}"`);
          }
          
          // Add follower count if available
          if (profile.follower_count) {
            profileParts.push(`- Follower: ${profile.follower_count.toLocaleString()}`);
          }
          
          userProfileInfo = '\n' + profileParts.join('\n');
          console.log(`👤 [INSTAGRAM] Fetched profile for ${profile.username || conversation.instagramUserId}${profile.biography ? ' (with bio)' : ''}`);
        }
      }
    } catch (e) {
      console.log("⚠️ [INSTAGRAM] Could not fetch user profile:", e);
      userProfileInfo = `
- Username Instagram: @${conversation.instagramUsername || conversation.instagramUserId}`;
    }

    // Extract trigger context from pending messages metadata (use latest message with metadata)
    let triggerContext = "";
    const latestPendingWithMeta = pendingMessages?.slice().reverse().find(m => m.metadata);
    if (latestPendingWithMeta?.metadata) {
      const meta = latestPendingWithMeta.metadata as any;
      if (meta.commentTrigger) {
        triggerContext = `
- Questa conversazione è iniziata da un COMMENTO su un tuo post Instagram
- L'utente ha scritto: "${latestPendingWithMeta.messageText?.replace('[Comment Trigger] User commented: ', '') || ''}"
- L'utente è interessato al contenuto del post, rispondi contestualmente`;
      } else if (meta.iceBreaker) {
        triggerContext = `
- L'utente ha usato un ICE BREAKER (domanda rapida predefinita)
- Domanda selezionata: "${meta.payload || ''}"
- Rispondi direttamente alla domanda in modo chiaro e conciso`;
      }
    }

    // Build source context based on conversation source type
    let sourceContext = "";
    switch (conversation.sourceType) {
      case "dm":
        sourceContext = "L'utente ti ha scritto direttamente in DM";
        break;
      case "story_reply":
        sourceContext = "L'utente ha RISPOSTO a una tua STORIA Instagram - menziona brevemente la storia se rilevante";
        break;
      case "story_mention":
        sourceContext = "L'utente ti ha MENZIONATO in una sua STORIA - ringrazialo e coinvolgilo";
        break;
      case "comment":
        sourceContext = "L'utente ha commentato un tuo post e tu lo stai contattando in DM";
        break;
      case "ice_breaker":
        sourceContext = "L'utente ha usato una domanda rapida (Ice Breaker)";
        break;
      default:
        sourceContext = "Messaggio diretto";
    }

    // Add Instagram-specific context to system prompt
    const instagramContext = `

## Instagram-Specific Context
- Canale: Instagram Direct Messages
${userProfileInfo}
- Come è iniziata la conversazione: ${sourceContext}
${triggerContext}
- Finestra messaggi: ${conversation.windowExpiresAt ? `scade tra ${Math.round((new Date(conversation.windowExpiresAt).getTime() - Date.now()) / 3600000)}h` : "attiva"}

⚠️ REGOLE FONDAMENTALI PER INSTAGRAM DM:
1. LIMITE 1000 CARATTERI: I messaggi Instagram hanno un limite MASSIMO di 1000 caratteri. Le tue risposte DEVONO essere SEMPRE sotto i 900 caratteri.
2. RISPOSTE BREVI: Su Instagram le persone si aspettano messaggi brevi e diretti, come una chat tra amici. NON scrivere paragrafi lunghi o elenchi puntati estesi.
3. STILE CONVERSAZIONALE: Scrivi come se stessi chattando, non come se scrivessi un'email formale.
4. UNA DOMANDA ALLA VOLTA: Fai UNA sola domanda per messaggio, non bombardare l'utente.
5. Hai solo 24h dalla risposta dell'utente per rispondere. Se non risponde, non puoi contattarlo.
6. USA LE INFO DEL PROFILO: Quando l'utente chiede "sai chi sono?" o simili, USA le informazioni del profilo sopra (username, nome, bio se disponibile) per dimostrare che lo conosci. Es: "Certo @username, vedo dal tuo profilo che..."
`;

    // Build booking context if booking is enabled
    let bookingBlock = "";
    if (agentConfigForAI.bookingEnabled && linkedAgent) {
      try {
        console.log(`📅 [INSTAGRAM] Loading booking context for agent ${linkedAgent.id}...`);
        
        // Cross-channel booking detection with multiple fallbacks
        // Priority: 1) instagramUserId match, 2) Instagram username in clientName
        let existingBooking: any[] = [];
        const futureDate = new Date();
        futureDate.setHours(0, 0, 0, 0);
        
        // Primary: Search by Instagram user ID (most reliable)
        if (conversation.instagramUserId) {
          existingBooking = await db
            .select()
            .from(appointmentBookings)
            .where(
              and(
                eq(appointmentBookings.consultantId, config.consultantId),
                sql`(${appointmentBookings.status} = 'confirmed' OR ${appointmentBookings.status} = 'proposed')`,
                sql`${appointmentBookings.appointmentDate} >= ${futureDate.toISOString().split('T')[0]}`,
                sql`${appointmentBookings.instagramUserId} = ${conversation.instagramUserId}`
              )
            )
            .limit(1);
          
          if (existingBooking.length > 0) {
            console.log(`✅ [INSTAGRAM] Found booking by Instagram user ID`);
          }
        }
        
        // Fallback: Search by Instagram username in clientName (for legacy bookings)
        if (existingBooking.length === 0 && conversation.instagramUsername) {
          existingBooking = await db
            .select()
            .from(appointmentBookings)
            .where(
              and(
                eq(appointmentBookings.consultantId, config.consultantId),
                sql`(${appointmentBookings.status} = 'confirmed' OR ${appointmentBookings.status} = 'proposed')`,
                sql`${appointmentBookings.appointmentDate} >= ${futureDate.toISOString().split('T')[0]}`,
                sql`LOWER(${appointmentBookings.clientName}) LIKE LOWER(${'%' + conversation.instagramUsername + '%'})`
              )
            )
            .limit(1);
          
          if (existingBooking.length > 0) {
            console.log(`✅ [INSTAGRAM] Found booking by username fallback: @${conversation.instagramUsername}`);
          }
        }
        
        if (existingBooking.length === 0) {
          console.log(`ℹ️ [INSTAGRAM] No existing booking found for this user`);
        }
        
        // Get available slots from calendar API (same endpoint as WhatsApp)
        let availableSlots: any[] = [];
        try {
          // Calculate date range (next 7 days)
          const startDate = new Date();
          const endDate = new Date();
          endDate.setDate(endDate.getDate() + 7);
          
          const slotsResponse = await fetch(
            `http://localhost:${process.env.PORT || 5000}/api/calendar/available-slots?` +
            `consultantId=${config.consultantId}&` +
            `startDate=${startDate.toISOString()}&` +
            `endDate=${endDate.toISOString()}` +
            `&agentConfigId=${linkedAgent.id}`,
            {
              method: 'GET',
              headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' }
            }
          );
          
          if (slotsResponse.ok) {
            const slotsData = await slotsResponse.json();
            availableSlots = slotsData.slots || [];
            console.log(`📅 [INSTAGRAM] Found ${availableSlots.length} available slots from calendar API`);
          } else {
            console.log(`⚠️ [INSTAGRAM] Calendar slots API returned ${slotsResponse.status}`);
          }
        } catch (e: any) {
          console.log(`⚠️ [INSTAGRAM] Could not load calendar slots: ${e.message || e}`);
        }
        
        // Format today's date
        const now = new Date();
        const formatter = new Intl.DateTimeFormat('it-IT', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          timeZone: 'Europe/Rome',
          hour12: false
        });
        const formattedToday = formatter.format(now);
        
        // Build booking block only if we have slots or existing appointment
        if (availableSlots.length > 0 || existingBooking[0]) {
          console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
          console.log(`📅 [INSTAGRAM BOOKING] Building booking context block`);
          console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
          
          bookingBlock = getMandatoryBookingBlock({
            existingAppointment: existingBooking[0] ? {
              id: existingBooking[0].id,
              date: existingBooking[0].appointmentDate || "",
              time: existingBooking[0].appointmentTime || "",
              email: existingBooking[0].leadEmail || "",
              phone: existingBooking[0].leadPhone || ""
            } : undefined,
            availableSlots: availableSlots.slice(0, 6),
            timezone: 'Europe/Rome',
            formattedToday
          });
          
          if (existingBooking[0]) {
            console.log(`   ✅ Existing booking: ${existingBooking[0].appointmentDate} at ${existingBooking[0].appointmentTime}`);
            console.log(`   📧 Lead email: ${existingBooking[0].leadEmail || 'N/A'}`);
            console.log(`   📱 Lead phone: ${existingBooking[0].leadPhone || 'N/A'}`);
          } else {
            console.log(`   📆 Available slots to propose: ${availableSlots.length}`);
            if (availableSlots.length > 0) {
              const slotPreview = availableSlots.slice(0, 3).map((s: any) => 
                `${s.date || s.start?.split('T')[0]} ${s.time || s.start?.split('T')[1]?.substring(0,5)}`
              ).join(', ');
              console.log(`   🕐 First slots: ${slotPreview}${availableSlots.length > 3 ? '...' : ''}`);
            }
          }
          console.log(`   📝 Booking block size: ${bookingBlock.length} chars`);
          console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
        } else {
          console.log(`ℹ️ [INSTAGRAM BOOKING] No booking context (no slots and no existing booking)`);
        }
      } catch (e) {
        console.log(`⚠️ [INSTAGRAM] Error loading booking context:`, e);
      }
    } else {
      console.log(`ℹ️ [INSTAGRAM] Booking disabled or no linked agent - skipping booking context`);
    }

    // Add mandatory instruction blocks (like WhatsApp)
    console.log(`\n🔧 [INSTAGRAM] Adding instruction blocks:`);
    console.log(`   ✅ CORE_CONVERSATION_RULES`);
    let instructionBlocks = CORE_CONVERSATION_RULES_BLOCK;
    
    if (agentConfigForAI.objectionHandlingEnabled) {
      instructionBlocks += '\n' + OBJECTION_HANDLING_BLOCK;
      console.log(`   ✅ OBJECTION_HANDLING`);
    }
    
    if (agentConfigForAI.disqualificationEnabled) {
      instructionBlocks += '\n' + DISQUALIFICATION_BLOCK;
      console.log(`   ✅ DISQUALIFICATION`);
    }
    
    if (agentConfigForAI.bookingEnabled) {
      instructionBlocks += '\n' + BOOKING_CONVERSATION_PHASES_BLOCK;
      console.log(`   ✅ BOOKING_CONVERSATION_PHASES`);
    }

    let fullSystemPrompt = systemPrompt + instructionBlocks + instagramContext + bookingBlock;
    console.log(`\n📝 [INSTAGRAM] Full system prompt breakdown:`);
    console.log(`   📄 Base prompt: ${systemPrompt.length} chars`);
    console.log(`   📋 Instruction blocks: ${instructionBlocks.length} chars`);
    console.log(`   📱 Instagram context: ${instagramContext.length} chars`);
    console.log(`   📅 Booking block: ${bookingBlock.length} chars`);
    console.log(`   📊 TOTAL: ${fullSystemPrompt.length} chars`);

    // Setup File Search if available (like WhatsApp)
    // Check both agent-specific and consultant-wide stores
    let fileSearchTool: any = null;
    try {
      if (linkedAgent) {
        // First try agent-specific store
        const agentStore = await fileSearchSyncService.getWhatsappAgentStore(linkedAgent.id);
        if (agentStore && agentStore.documentCount > 0) {
          fileSearchTool = fileSearchService.buildFileSearchTool([agentStore.googleStoreName]);
          console.log(`🔍 [INSTAGRAM] File Search enabled: ${agentStore.displayName} (${agentStore.documentCount} docs)`);
        }
      }
      
      // Fallback to consultant's store (works even without linked agent)
      if (!fileSearchTool) {
        const consultantStore = await fileSearchSyncService.getConsultantStore(config.consultantId);
        if (consultantStore && consultantStore.documentCount > 0) {
          fileSearchTool = fileSearchService.buildFileSearchTool([consultantStore.googleStoreName]);
          console.log(`🔍 [INSTAGRAM] Using consultant File Search: ${consultantStore.displayName}`);
        }
      }
    } catch (e) {
      console.log(`⚠️ [INSTAGRAM] File Search not available:`, e);
    }

    // Load knowledge base items for linked agent (like WhatsApp)
    // Also fallback to consultant knowledge documents if no agent is linked
    let knowledgeItems: any[] = [];
    try {
      if (linkedAgent?.id) {
        // First try agent-specific knowledge items
        const agentKnowledgeResult = await db
          .select()
          .from(whatsappAgentKnowledgeItems)
          .where(eq(whatsappAgentKnowledgeItems.agentConfigId, linkedAgent.id))
          .orderBy(asc(whatsappAgentKnowledgeItems.order), asc(whatsappAgentKnowledgeItems.createdAt));
        
        knowledgeItems = agentKnowledgeResult || [];

        if (knowledgeItems.length > 0) {
          console.log(`📚 [INSTAGRAM] Loaded ${knowledgeItems.length} knowledge items for agent ${linkedAgent.id}`);
          const knowledgeBlock = knowledgeItems
            .filter(item => item && item.title && item.content)
            .map(item => `[${item.title}]\n${item.content}`)
            .join('\n\n');
          if (knowledgeBlock) {
            fullSystemPrompt += `\n\n[KNOWLEDGE BASE]\n${knowledgeBlock}`;
          }
        }
      }
      
      // Fallback to consultant's general knowledge documents if no agent knowledge loaded
      if (knowledgeItems.length === 0 && config?.consultantId) {
        const consultantDocs = await db
          .select({
            title: consultantKnowledgeDocuments.title,
            extractedText: consultantKnowledgeDocuments.extractedText,
            category: consultantKnowledgeDocuments.category,
          })
          .from(consultantKnowledgeDocuments)
          .where(eq(consultantKnowledgeDocuments.consultantId, config.consultantId))
          .limit(10); // Limit to avoid token overflow
        
        if (consultantDocs && consultantDocs.length > 0) {
          console.log(`📚 [INSTAGRAM] Using ${consultantDocs.length} consultant knowledge documents as fallback`);
          const docsBlock = consultantDocs
            .filter(doc => doc && doc.extractedText)
            .map(doc => `[${doc.category?.toUpperCase() || 'DOC'}: ${doc.title}]\n${doc.extractedText?.substring(0, 2000)}...`)
            .join('\n\n');
          if (docsBlock) {
            fullSystemPrompt += `\n\n[KNOWLEDGE BASE]\n${docsBlock}`;
          }
        }
      }
    } catch (error: any) {
      console.log(`⚠️ [INSTAGRAM] Failed to load knowledge items: ${error?.message || 'Unknown error'}`);
    }

    // Get AI provider and generate response (uses pre-configured client)
    const aiProvider = await getAIProvider(consultant.id, consultant.id);
    
    // Map source to canonical provider name for getModelWithThinking
    // source "google" = Google AI Studio, "vertex"/"superadmin"/"client"/"admin" = Vertex AI
    const canonicalProviderName = aiProvider.source === 'google' ? 'Google AI Studio' : 'Vertex AI';
    console.log(`🤖 [INSTAGRAM] AI Provider: ${aiProvider.source} -> ${canonicalProviderName} (${aiProvider.metadata.name})`);
    
    // Get model and thinking config based on canonical provider name
    const { model, useThinking, thinkingLevel } = getModelWithThinking(canonicalProviderName);
    console.log(`🧠 [INSTAGRAM] Model: ${model}, Thinking: ${useThinking ? `enabled (${thinkingLevel})` : 'disabled'}`);

    // Build contents array
    const contents = [
      ...messageHistory.map((m) => ({
        role: m.role === "user" ? "user" : "model",
        parts: [{ text: m.content }],
      })),
      { role: "user", parts: [{ text: userMessage }] },
    ];

    // Generate AI response using the unified client adapter
    // The adapter normalizes the response format for both Vertex AI and Google AI Studio
    // Note: Google AI Studio uses thinkingBudget (in tokens), Vertex AI uses thinkingLevel
    const isGoogleStudio = aiProvider.source === 'google';
    const thinkingBudgetMap: Record<string, number> = {
      'minimal': 512,
      'low': 1024, 
      'medium': 8192,
      'high': 24576
    };
    
    const response = await aiProvider.client.generateContent({
      model,
      contents,
      generationConfig: {
        systemInstruction: fullSystemPrompt,
        ...(useThinking && {
          thinkingConfig: isGoogleStudio 
            ? { thinkingBudget: thinkingBudgetMap[thinkingLevel] || 1024 }
            : { thinkingLevel }
        }),
      },
      ...(fileSearchTool && { tools: [fileSearchTool] }),
    });
    
    // Extract response text (the adapter normalizes this)
    let responseText: string | null = null;
    try {
      responseText = response.response?.text?.() || null;
    } catch (e) {
      // Fallback extraction methods
      if (typeof response.response?.text === 'string') {
        responseText = response.response.text;
      } else if (response.text) {
        responseText = response.text;
      }
    }
    
    console.log(`✅ [INSTAGRAM] AI response generated: ${responseText ? responseText.substring(0, 100) + '...' : 'null'}`);

    // Clean up response (remove markdown, actions, thinking, etc.)
    if (responseText) {
      responseText = cleanAIResponse(responseText);
    }

    return responseText;
  } catch (error) {
    console.error("❌ [INSTAGRAM] Error generating AI response:", error);
    return null;
  }
}

/**
 * Clean AI response for Instagram
 * Removes thinking output, actions, markdown, and other artifacts
 */
function cleanAIResponse(text: string): string {
  let cleaned = text;

  // Remove thinking output (Gemini 3 thinking model)
  cleaned = cleaned.replace(/<thinking>[\s\S]*?<\/thinking>/gi, "");
  cleaned = cleaned.replace(/\[THINKING\][\s\S]*?\[\/THINKING\]/gi, "");
  
  // Remove [ACTIONS] sections
  cleaned = cleaned.replace(/\[ACTIONS\][\s\S]*?\[\/ACTIONS\]/gi, "");
  cleaned = cleaned.replace(/\{"actions":\s*\[[\s\S]*?\]\}/gi, "");
  cleaned = cleaned.replace(/\[\/ACTIONS\]/gi, "");

  // Remove bold markers
  cleaned = cleaned.replace(/\*\*(.+?)\*\*/g, "$1");

  // Convert list markers
  cleaned = cleaned.replace(/^\s*\*\s+/gm, "- ");

  // Remove any remaining XML-like tags
  cleaned = cleaned.replace(/<[^>]+>/g, "");

  // Clean up multiple newlines
  cleaned = cleaned.replace(/\n{3,}/g, "\n\n");

  // Clean up whitespace
  cleaned = cleaned.trim();

  return cleaned;
}

/**
 * Split message into chunks respecting Instagram's 1000 char limit
 * Tries to split at sentence boundaries for natural reading
 */
function splitMessageForInstagram(text: string, maxLength: number = 950): string[] {
  if (text.length <= maxLength) {
    return [text];
  }

  const chunks: string[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    if (remaining.length <= maxLength) {
      chunks.push(remaining.trim());
      break;
    }

    // Try to find a good breaking point (sentence end, paragraph, or word boundary)
    let breakPoint = maxLength;
    
    // Try to break at paragraph first
    const paragraphBreak = remaining.lastIndexOf('\n\n', maxLength);
    if (paragraphBreak > maxLength * 0.5) {
      breakPoint = paragraphBreak;
    } else {
      // Try to break at sentence end
      const sentenceEnders = ['. ', '! ', '? ', '.\n', '!\n', '?\n'];
      let bestBreak = -1;
      for (const ender of sentenceEnders) {
        const pos = remaining.lastIndexOf(ender, maxLength);
        if (pos > bestBreak && pos > maxLength * 0.3) {
          bestBreak = pos + ender.length - 1;
        }
      }
      if (bestBreak > 0) {
        breakPoint = bestBreak;
      } else {
        // Fall back to word boundary
        const spaceBreak = remaining.lastIndexOf(' ', maxLength);
        if (spaceBreak > maxLength * 0.5) {
          breakPoint = spaceBreak;
        }
      }
    }

    chunks.push(remaining.substring(0, breakPoint).trim());
    remaining = remaining.substring(breakPoint).trim();
  }

  return chunks;
}

/**
 * Send response via Meta Graph API
 * In Dry Run mode: logs the message, saves to DB with isDryRun metadata, but doesn't actually send
 */
async function sendInstagramResponse(
  config: typeof consultantInstagramConfig.$inferSelect,
  consultant: typeof users.$inferSelect,
  conversation: typeof instagramConversations.$inferSelect,
  responseText: string,
  canUseHumanAgentTag: boolean
): Promise<void> {
  // Dry Run Mode - detailed logging without sending
  if (config.isDryRun) {
    console.log(`\n🧪 ======================= DRY RUN MODE =======================`);
    console.log(`📍 [INSTAGRAM DRY RUN] Conversation: ${conversation.id}`);
    console.log(`👤 [INSTAGRAM DRY RUN] To User: ${conversation.instagramUserId} (@${conversation.instagramUsername || 'unknown'})`);
    console.log(`💬 [INSTAGRAM DRY RUN] Message that WOULD be sent:`);
    console.log(`────────────────────────────────────────────────────────────────`);
    console.log(responseText);
    console.log(`────────────────────────────────────────────────────────────────`);
    console.log(`🏷️ [INSTAGRAM DRY RUN] Would use HUMAN_AGENT tag: ${canUseHumanAgentTag && conversation.overriddenAt !== null}`);
    console.log(`📊 [INSTAGRAM DRY RUN] Message length: ${responseText.length} chars`);
    console.log(`🧪 ============================================================\n`);

    // Save message to database with dry run indicator in metadata
    await db.insert(instagramMessages).values({
      conversationId: conversation.id,
      messageText: responseText,
      direction: "outbound",
      sender: "ai",
      mediaType: "text",
      instagramMessageId: `dry_run_${Date.now()}`,
      metaStatus: "dry_run",
      metadata: { isDryRun: true, simulatedAt: new Date().toISOString() },
      sentAt: new Date(),
      createdAt: new Date(),
    });

    // Update conversation stats (even in dry run for testing)
    await db
      .update(instagramConversations)
      .set({
        messageCount: sql`${instagramConversations.messageCount} + 1`,
        lastMessageAt: new Date(),
        lastMessageFrom: "ai",
        updatedAt: new Date(),
      })
      .where(eq(instagramConversations.id, conversation.id));

    console.log(`✅ [INSTAGRAM DRY RUN] Message saved to DB with isDryRun flag. No actual message sent.`);
    return;
  }

  // Normal Mode - Actually send the message
  // Decrypt page access token
  let pageAccessToken = config.pageAccessToken;
  if (pageAccessToken && consultant.encryptionSalt) {
    try {
      pageAccessToken = decryptForConsultant(pageAccessToken, consultant.encryptionSalt);
    } catch (e) {
      console.log("🔓 [INSTAGRAM] Token not encrypted, using as-is");
    }
  }

  if (!pageAccessToken || !config.facebookPageId) {
    console.error("❌ [INSTAGRAM] Missing page access token or Facebook page ID");
    return;
  }

  // Create Meta client - use Facebook Page ID for the endpoint (NOT Instagram Account ID)
  // Instagram Messaging API requires: POST /{facebook-page-id}/messages
  const client = createMetaClient({
    pageAccessToken,
    instagramPageId: config.facebookPageId, // Must be Facebook Page ID, not Instagram Account ID!
    isDryRun: false,
  });

  // Split message if too long (Instagram limit: 1000 chars)
  const messageChunks = splitMessageForInstagram(responseText, 950);
  console.log(`📨 [INSTAGRAM] Sending ${messageChunks.length} message chunk(s) (total: ${responseText.length} chars)`);

  let lastMessageId: string | null = null;
  const useHumanTag = canUseHumanAgentTag && conversation.overriddenAt !== null;

  // Send each chunk
  for (let i = 0; i < messageChunks.length; i++) {
    const chunk = messageChunks[i];
    
    // Small delay between messages to avoid rate limiting
    if (i > 0) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    const result = await client.sendMessage(
      conversation.instagramUserId,
      chunk,
      { useHumanAgentTag: useHumanTag }
    );

    if (!result) {
      console.error(`❌ [INSTAGRAM] Failed to send message chunk ${i + 1}/${messageChunks.length}`);
      continue;
    }

    lastMessageId = result.message_id;

    // Save each chunk to database
    await db.insert(instagramMessages).values({
      conversationId: conversation.id,
      messageText: chunk,
      direction: "outbound",
      sender: "ai",
      mediaType: "text",
      instagramMessageId: result.message_id,
      metaStatus: "sent",
      sentAt: new Date(),
      createdAt: new Date(),
    });

    console.log(`✅ [INSTAGRAM] Sent chunk ${i + 1}/${messageChunks.length}: ${result.message_id}`);
  }

  if (!lastMessageId) {
    console.error("❌ [INSTAGRAM] All message chunks failed to send");
    return;
  }

  // Update conversation stats (count as 1 response even if multiple chunks)
  await db
    .update(instagramConversations)
    .set({
      messageCount: sql`${instagramConversations.messageCount} + 1`,
      lastMessageAt: new Date(),
      lastMessageFrom: "ai",
      updatedAt: new Date(),
    })
    .where(eq(instagramConversations.id, conversation.id));

  console.log(`📤 [INSTAGRAM] Sent response to ${conversation.instagramUserId}: ${lastMessageId}`);
}

/**
 * Mark pending messages as processed
 * @param conversationId - The conversation ID
 * @param messageIds - Optional array of specific message IDs to mark. If not provided, marks all pending messages.
 */
async function markPendingMessagesProcessed(conversationId: string, messageIds?: string[]): Promise<void> {
  if (messageIds && messageIds.length > 0) {
    // Mark only specific messages (batch-scoped) using Drizzle's inArray for proper SQL
    await db
      .update(instagramPendingMessages)
      .set({ processedAt: new Date() })
      .where(
        inArray(instagramPendingMessages.id, messageIds)
      );
  } else {
    // Mark all pending messages (fallback for window closed)
    await db
      .update(instagramPendingMessages)
      .set({ processedAt: new Date() })
      .where(
        and(
          eq(instagramPendingMessages.conversationId, conversationId),
          isNull(instagramPendingMessages.processedAt)
        )
      );
  }
}

/**
 * Process a single Instagram message (for external calls)
 */
export async function processInstagramMessage(
  conversationId: string,
  agentConfigId: string,
  consultantId: string
): Promise<void> {
  return processInstagramConversation(conversationId, agentConfigId, consultantId);
}
