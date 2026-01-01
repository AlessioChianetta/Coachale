import { performance } from 'perf_hooks';
import { db } from "../db";
import {
  whatsappPendingMessages,
  whatsappMessages,
  whatsappConversations,
  whatsappGlobalApiKeys,
  consultantWhatsappConfig,
  users,
  appointmentBookings,
  consultantAvailabilitySettings,
  proposedAppointmentSlots,
  proactiveLeads,
  whatsappAgentKnowledgeItems,
  superadminVertexConfig,
  consultantVertexAccess,
  vertexAiSettings,
  conversationStates,
} from "../../shared/schema";
import { eq, isNull, and, desc, asc, sql, inArray } from "drizzle-orm";
import { buildUserContext, detectIntent } from "../ai-context-builder";
import { buildSystemPrompt } from "../ai-prompts";
import { GoogleGenAI } from "@google/genai";
import { createVertexGeminiClient, parseServiceAccountJson, GEMINI_3_MODEL, GEMINI_LEGACY_MODEL, getModelWithThinking, getSuperAdminGeminiKeys, getAIProvider } from "../ai/provider-factory";
import { sendWhatsAppMessage } from "./twilio-client";
import { nanoid } from "nanoid";
import { handleIncomingMedia } from "./media-handler";
// OBJECTION DETECTOR DISABLED - Aligned with public share (Dec 2025)
// import { detectObjection, trackObjection, getConversationObjections } from "../objection-detector";
import { getOrCreateProfile, updateClientProfile } from "../client-profiler";
import { createGoogleCalendarEvent, updateGoogleCalendarEvent, deleteGoogleCalendarEvent, addAttendeesToGoogleCalendarEvent } from "../google-calendar-service";
import { decryptJSON } from "../encryption";
import { resolveInstructionVariables } from "./template-engine";
import {
  getMandatoryBookingBlock,
  CORE_CONVERSATION_RULES_BLOCK,
  BOOKING_CONVERSATION_PHASES_BLOCK,
  PROACTIVE_MODE_BLOCK,
  DISQUALIFICATION_BLOCK,
  OBJECTION_HANDLING_BLOCK,
  UPSELLING_BLOCK
} from "./instruction-blocks";
import { generateSpeech } from "../ai/tts-service";
import { fileSearchService } from "../ai/file-search-service";
import { fileSearchSyncService } from "../services/file-search-sync-service";
import { isRetryableError } from "../ai/retry-manager";
import { shouldRespondWithAudio } from "./audio-response-utils";
import { shouldAnalyzeForBooking, isActionAlreadyCompleted, LastCompletedAction, ActionDetails } from "../booking/booking-intent-detector";
import {
  extractBookingDataFromConversation,
  validateBookingData,
  createBookingRecord,
  createGoogleCalendarBooking,
  sendBookingConfirmationEmail,
  markExtractionStateCompleted,
  BookingExtractionResult,
  ConversationMessage,
} from "../booking/booking-service";
import * as fs from "fs";
import * as fsPromises from "fs/promises";
import * as path from "path";
import { exec, spawn } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

/**
 * TASK 4: Token estimation helper function
 * Estimates tokens based on character count (4 chars ≈ 1 token)
 */
function estimateTokenCount(text: string): number {
  return Math.ceil((text || '').length / 4);
}

/**
 * TASK 2: Detect explicit rejection phrases in lead messages
 * Detects Italian and English rejection patterns to update hasSaidNoExplicitly flag
 */
function detectExplicitRejection(messageText: string): boolean {
  const normalizedText = messageText.toLowerCase().trim();

  const italianPatterns = [
    /\bno\s+grazie\b/,
    /\bnon\s+mi\s+interessa\b/,
    /\bnon\s+sono\s+interessat[oa]?\b/,
    /\blasciatemi\s+stare\b/,
    /\brimuovimi\b/,
    /\bnon\s+contattatemi\b/,
    /\bbasta\b/,
    /\bstop\b/,
    /\bcancella\b/,
    /\bnon\s+voglio\b/,
  ];

  const englishPatterns = [
    /\bnot\s+interested\b/,
    /\bleave\s+me\s+alone\b/,
    /\bremove\s+me\b/,
    /\bunsubscribe\b/,
    /\bstop\s+contacting\b/,
  ];

  const allPatterns = [...italianPatterns, ...englishPatterns];

  for (const pattern of allPatterns) {
    if (pattern.test(normalizedText)) {
      return true;
    }
  }

  return false;
}

/**
 * Convert WAV to OGG/Opus asynchronously with timeout
 * Optimized for voice audio with proper Opus settings
 */
async function convertWavToOggAsync(
  wavFilePath: string,
  oggFilePath: string,
  timeoutMs: number = 120000
): Promise<void> {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();

    // Optimized FFmpeg command for voice/Opus conversion
    // -threads 0: Use all available CPU cores
    // -application voip: Optimize for voice
    // -frame_duration 20: Standard frame size for voice
    // -vbr on: Variable bitrate for better quality
    // -compression_level 10: Best compression
    const ffmpeg = spawn('ffmpeg', [
      '-i', wavFilePath,
      '-c:a', 'libopus',
      '-b:a', '48k',           // Lower bitrate for voice (was 64k)
      '-application', 'voip',  // Voice optimization
      '-frame_duration', '20', // 20ms frames for voice
      '-vbr', 'on',            // Variable bitrate
      '-compression_level', '10',
      '-threads', '0',         // Use all CPU cores
      '-y',                    // Overwrite output
      oggFilePath
    ], {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let stderr = '';

    ffmpeg.stderr?.on('data', (data) => {
      stderr += data.toString();
    });

    const timeout = setTimeout(() => {
      ffmpeg.kill('SIGKILL');
      reject(new Error(`FFmpeg conversion timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    ffmpeg.on('close', (code) => {
      clearTimeout(timeout);
      const duration = Date.now() - startTime;

      if (code === 0) {
        console.log(`✅ FFmpeg conversion completed in ${duration}ms`);
        resolve();
      } else {
        reject(new Error(`FFmpeg exited with code ${code}: ${stderr.slice(-500)}`));
      }
    });

    ffmpeg.on('error', (err) => {
      clearTimeout(timeout);
      reject(new Error(`FFmpeg spawn error: ${err.message}`));
    });
  });
}

/**
 * Calculate audio duration from WAV buffer (instant, no FFprobe)
 * WAV format: 44 bytes header, then PCM data
 * Duration = dataSize / (sampleRate * channels * bytesPerSample)
 */
function calculateWavDuration(wavBuffer: Buffer): number {
  // WAV header structure:
  // Bytes 24-27: Sample rate (little-endian uint32)
  // Bytes 22-23: Number of channels (little-endian uint16)
  // Bytes 34-35: Bits per sample (little-endian uint16)
  // Bytes 40-43: Data size (little-endian uint32)

  try {
    const sampleRate = wavBuffer.readUInt32LE(24);
    const channels = wavBuffer.readUInt16LE(22);
    const bitsPerSample = wavBuffer.readUInt16LE(34);
    const dataSize = wavBuffer.readUInt32LE(40);

    const bytesPerSample = bitsPerSample / 8;
    const duration = dataSize / (sampleRate * channels * bytesPerSample);

    return Math.round(duration);
  } catch (error) {
    console.warn('⚠️ Could not parse WAV header, estimating duration');
    // Fallback: estimate based on buffer size (assuming 24kHz, mono, 16-bit)
    return Math.round((wavBuffer.length - 44) / (24000 * 1 * 2));
  }
}

const DEBOUNCE_DELAY = 4000;
const MAX_RETRIES = 3;
const INITIAL_BACKOFF = 1000; // 1 second

// Queue system per consultant
interface QueueTask {
  phoneNumber: string;
  consultantId: string;
}

const pendingTimers = new Map<string, NodeJS.Timeout>();
const consultantQueues = new Map<string, QueueTask[]>();
const processingConsultants = new Set<string>();

// Helper function to format slot for display in logs and AI prompts
interface FormattedSlot {
  start: Date | string;
  end: Date | string;
  date: string;      // "10/11/2025"
  dayOfWeek: string; // "lunedì"
  time: string;      // "09:00"
  fullDateTime: string; // "lunedì 10 novembre 2025 alle ore 09:00"
}

function formatSlotForDisplay(slot: { start: Date | string; end: Date | string }, timezone: string = 'Europe/Rome'): FormattedSlot {
  const startDate = typeof slot.start === 'string' ? new Date(slot.start) : slot.start;
  const endDate = typeof slot.end === 'string' ? new Date(slot.end) : slot.end;

  const date = startDate.toLocaleDateString('it-IT', {
    timeZone: timezone,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });

  const dayOfWeek = startDate.toLocaleDateString('it-IT', {
    timeZone: timezone,
    weekday: 'long'
  });

  const time = startDate.toLocaleTimeString('it-IT', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit'
  });

  const fullDateTime = startDate.toLocaleString('it-IT', {
    timeZone: timezone,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).replace(',', ' alle ore');

  return {
    start: slot.start,
    end: slot.end,
    date,
    dayOfWeek,
    time,
    fullDateTime
  };
}

function isWithinWorkingHours(settings: any): boolean {
  // If no working hours configured, always allow (24/7)
  if (!settings?.workingHours || Object.keys(settings.workingHours).length === 0) {
    return true;
  }

  const nowItaly = new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Rome" }));

  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const currentDay = dayNames[nowItaly.getDay()];

  const dayConfig = settings.workingHours[currentDay];

  // If day not configured or not enabled, return false (not working)
  if (!dayConfig || !dayConfig.enabled) {
    return false;
  }

  const currentTime = nowItaly.getHours() * 60 + nowItaly.getMinutes();

  const [startHour, startMin] = dayConfig.start.split(':').map(Number);
  const [endHour, endMin] = dayConfig.end.split(':').map(Number);

  const startTime = startHour * 60 + startMin;
  const endTime = endHour * 60 + endMin;

  return currentTime >= startTime && currentTime <= endTime;
}

/**
 * @deprecated Use isWithinAgentWorkingHours instead - this function uses the old aiAvailability format
 * from calendar settings. The new approach uses WhatsApp agent config directly.
 */
function isWithinAiWorkingHours(aiAvailability: any, timezone: string = "Europe/Rome"): boolean {
  // If AI is explicitly disabled, return false
  if (aiAvailability.enabled === false) {
    return false;
  }

  // If no working days configured, AI is available 24/7
  if (!aiAvailability.workingDays || Object.keys(aiAvailability.workingDays).length === 0) {
    return true;
  }

  // Use consultant's configured timezone with robust error handling
  let now: Date;
  let effectiveTimezone = timezone;

  try {
    now = new Date(new Date().toLocaleString("en-US", { timeZone: timezone }));
  } catch (error) {
    // Invalid timezone - fallback to Europe/Rome
    console.warn(`⚠️ Invalid timezone "${timezone}" - falling back to Europe/Rome. Error: ${error}`);
    effectiveTimezone = "Europe/Rome";
    now = new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Rome" }));
  }

  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const currentDay = dayNames[now.getDay()];

  const dayConfig = aiAvailability.workingDays[currentDay];

  // If day not configured or not enabled, AI is not available
  if (!dayConfig || !dayConfig.enabled) {
    return false;
  }

  const currentTime = now.getHours() * 60 + now.getMinutes();

  const [startHour, startMin] = dayConfig.start.split(':').map(Number);
  const [endHour, endMin] = dayConfig.end.split(':').map(Number);

  const startTime = startHour * 60 + startMin;
  const endTime = endHour * 60 + endMin;

  const isWithin = currentTime >= startTime && currentTime <= endTime;

  console.log(`🕐 AI Hours Check [${effectiveTimezone}]: Day=${currentDay}, Time=${now.getHours()}:${now.getMinutes()}, Range=${dayConfig.start}-${dayConfig.end}, Within=${isWithin}`);

  return isWithin;
}

/**
 * Check if current time is within the WhatsApp agent's configured working hours.
 * Uses the agent config format: workingHoursEnabled, workingHoursStart, workingHoursEnd, workingDays
 * 
 * @param config - WhatsApp agent config object
 * @param timezone - Timezone to use for time calculations (default: "Europe/Rome")
 * @returns true if AI should respond, false if outside working hours
 */
function isWithinAgentWorkingHours(config: any, timezone: string = "Europe/Rome"): boolean {
  // If workingHoursEnabled is false, agent is available 24/7
  if (config?.workingHoursEnabled === false) {
    console.log(`🕐 Agent Working Hours: 24/7 mode (workingHoursEnabled=false)`);
    return true;
  }

  // If working hours config is incomplete, default to 24/7 availability
  if (!config?.workingHoursStart || !config?.workingHoursEnd || !config?.workingDays) {
    console.log(`🕐 Agent Working Hours: 24/7 mode (missing config: start=${config?.workingHoursStart}, end=${config?.workingHoursEnd}, days=${config?.workingDays})`);
    return true;
  }

  // If workingDays is empty array, default to 24/7
  if (Array.isArray(config.workingDays) && config.workingDays.length === 0) {
    console.log(`🕐 Agent Working Hours: 24/7 mode (empty workingDays array)`);
    return true;
  }

  // Get current time in specified timezone
  let now: Date;
  let effectiveTimezone = timezone;

  try {
    now = new Date(new Date().toLocaleString("en-US", { timeZone: timezone }));
  } catch (error) {
    console.warn(`⚠️ Invalid timezone "${timezone}" - falling back to Europe/Rome. Error: ${error}`);
    effectiveTimezone = "Europe/Rome";
    now = new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Rome" }));
  }

  // Check if current day is in workingDays
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const currentDay = dayNames[now.getDay()];

  // workingDays is an array of lowercase day names: ["monday", "tuesday", ...]
  const isWorkingDay = config.workingDays.includes(currentDay);
  if (!isWorkingDay) {
    console.log(`🕐 Agent Working Hours [${effectiveTimezone}]: Day=${currentDay} NOT in workingDays=${JSON.stringify(config.workingDays)} → Outside hours`);
    return false;
  }

  // Check if current time is within working hours
  const currentTime = now.getHours() * 60 + now.getMinutes();

  const [startHour, startMin] = config.workingHoursStart.split(':').map(Number);
  const [endHour, endMin] = config.workingHoursEnd.split(':').map(Number);

  const startTime = startHour * 60 + startMin;
  const endTime = endHour * 60 + endMin;

  const isWithin = currentTime >= startTime && currentTime <= endTime;

  console.log(`🕐 Agent Working Hours [${effectiveTimezone}]: Day=${currentDay}, Time=${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}, Range=${config.workingHoursStart}-${config.workingHoursEnd}, Within=${isWithin}`);

  return isWithin;
}

export function scheduleMessageProcessing(phoneNumber: string, consultantId: string) {
  const key = `${phoneNumber}_${consultantId}`;

  console.log(`🔍 [SCHEDULE] scheduleMessageProcessing called for ${key}`);

  // Clear existing timer for this specific conversation
  if (pendingTimers.has(key)) {
    console.log(`⏲️  [SCHEDULE] Clearing existing timer for ${key}`);
    clearTimeout(pendingTimers.get(key)!);
  }

  // Schedule debounced processing
  const timer = setTimeout(async () => {
    console.log(`⚡ [SCHEDULE] Timer fired for ${key}, enqueueing...`);
    pendingTimers.delete(key);
    await enqueueProcessing(phoneNumber, consultantId);
  }, DEBOUNCE_DELAY);

  pendingTimers.set(key, timer);
  console.log(`✅ [SCHEDULE] Timer set for ${key}, will fire in ${DEBOUNCE_DELAY}ms`);
}

async function enqueueProcessing(phoneNumber: string, consultantId: string) {
  console.log(`📥 [ENQUEUE] Adding to queue: ${phoneNumber} for consultant ${consultantId}`);

  // Add to consultant's queue
  if (!consultantQueues.has(consultantId)) {
    console.log(`🆕 [ENQUEUE] Creating new queue for consultant ${consultantId}`);
    consultantQueues.set(consultantId, []);
  }

  const queue = consultantQueues.get(consultantId)!;
  queue.push({ phoneNumber, consultantId });
  console.log(`📊 [ENQUEUE] Queue size for consultant ${consultantId}: ${queue.length}`);

  // Process queue if not already processing
  if (!processingConsultants.has(consultantId)) {
    console.log(`🚀 [ENQUEUE] Starting queue processing for consultant ${consultantId}`);
    await processConsultantQueue(consultantId);
  } else {
    console.log(`⏳ [ENQUEUE] Queue already processing for consultant ${consultantId}, will pick up when done`);
  }
}

async function processConsultantQueue(consultantId: string) {
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

      try {
        await processPendingMessagesWithRetry(task.phoneNumber, task.consultantId);
      } catch (error: any) {
        console.error(`❌ Failed to process messages for ${task.phoneNumber} after retries`);
        console.error(`   Error type: ${error?.name || 'Unknown'}`);
        console.error(`   Error message: ${error?.message || error}`);
        if (error?.stack) {
          console.error(`   Stack trace:\n${error.stack}`);
        }
      }
    }
  } finally {
    processingConsultants.delete(consultantId);
  }
}

async function processPendingMessagesWithRetry(
  phoneNumber: string,
  consultantId: string,
  retryCount = 0
): Promise<void> {
  try {
    await processPendingMessages(phoneNumber, consultantId);
  } catch (error: any) {
    // Check if error is DB-related
    const errorCode = typeof error?.code === 'string' ? error.code : String(error?.code || '');
    const isDbError = error?.message?.includes("connection") ||
      error?.message?.includes("timeout") ||
      error?.message?.includes("pool") ||
      errorCode.includes("ECONNREFUSED");

    if (isDbError && retryCount < MAX_RETRIES) {
      const backoffTime = INITIAL_BACKOFF * Math.pow(2, retryCount);
      console.warn(
        `⚠️ DB error, retrying in ${backoffTime}ms (attempt ${retryCount + 1}/${MAX_RETRIES}):`,
        error.message
      );

      await new Promise((resolve) => setTimeout(resolve, backoffTime));
      return processPendingMessagesWithRetry(phoneNumber, consultantId, retryCount + 1);
    }

    throw error;
  }
}

async function processPendingMessages(phoneNumber: string, consultantId: string) {
  // ========================================
  // PERFORMANCE TIMING TRACKING
  // ========================================
  const timings = {
    requestStart: performance.now(),
    contextBuildStart: 0,
    contextBuildEnd: 0,
    appointmentFetchStart: 0,
    appointmentFetchEnd: 0,
    objectionDetectionStart: 0,
    objectionDetectionEnd: 0,
    promptBuildStart: 0,
    promptBuildEnd: 0,
    geminiCallStart: 0,
    geminiCallEnd: 0,
    totalEnd: 0,
  };

  try {
    // Step 1: Fetch conversation
    const [conversation] = await db
      .select()
      .from(whatsappConversations)
      .where(
        and(
          eq(whatsappConversations.phoneNumber, phoneNumber),
          eq(whatsappConversations.consultantId, consultantId)
        )
      )
      .limit(1);

    if (!conversation) {
      console.error("❌ Conversation not found for processing");
      return;
    }

    // Step 2: Fetch pending messages
    const pending = await db
      .select()
      .from(whatsappPendingMessages)
      .where(
        and(
          eq(whatsappPendingMessages.conversationId, conversation.id),
          isNull(whatsappPendingMessages.processedAt)
        )
      )
      .orderBy(asc(whatsappPendingMessages.receivedAt));

    console.log(`📋 [PENDING] Found ${pending.length} pending messages for conversation ${conversation.id} (phone: ${phoneNumber})`);

    // ⏱️ TIMING: Calculate polling latency (time from webhook to processing)
    if (pending.length > 0 && pending[0].receivedAt) {
      const webhookReceivedAt = new Date(pending[0].receivedAt).getTime();
      const pollingLatencyMs = Date.now() - webhookReceivedAt;
      const pollingLatencyS = (pollingLatencyMs / 1000).toFixed(1);
      console.log(`⏱️ [TIMING] Polling latency: ${pollingLatencyS}s (from webhook to processing)`);
    }

    // Step 2.1: Deduplicate pending messages by twilioSid
    // This prevents processing duplicate messages (e.g., from Twilio webhook retries)
    const uniquePending = pending.filter((msg, index, self) =>
      index === self.findIndex(m => m.twilioSid === msg.twilioSid)
    );

    const duplicatesCount = pending.length - uniquePending.length;
    if (duplicatesCount > 0) {
      console.log(`🔄 [DEDUP] Filtered ${duplicatesCount} duplicate pending message(s) - processing ${uniquePending.length} unique message(s)`);
    }

    if (uniquePending.length > 0) {
      console.log(`🔍 [PENDING] First message twilioSid: ${uniquePending[0].twilioSid}, simulated: ${uniquePending[0].metadata?.simulated || false}, text: "${uniquePending[0].messageText.substring(0, 50)}..."`);
    }

    if (uniquePending.length === 0) {
      console.log(`⏭️  [PENDING] No unique pending messages after deduplication, returning early`);
      return;
    }

    // Step 2.3: Detect participant type early for routing decisions
    const participantType = (conversation.metadata as any)?.participantType || 'unknown';
    console.log(`🔍 [PARTICIPANT TYPE] ${participantType}`);

    // Step 2.4: Consultant routing reconciliation
    // If consultant is writing, use the agent from pending message metadata (destination number)
    if (participantType === 'consultant') {
      const firstPendingMetadata = uniquePending[0]?.metadata as any;
      const targetAgentConfigId = firstPendingMetadata?.agentConfigId;

      if (targetAgentConfigId && targetAgentConfigId !== conversation.agentConfigId) {
        console.log(`🔄 [CONSULTANT ROUTING] Updating conversation agent: ${conversation.agentConfigId || 'none'} → ${targetAgentConfigId} (${firstPendingMetadata?.agentName || 'unknown'})`);

        // Update conversation to use correct agent for consultant's destination number
        await db
          .update(whatsappConversations)
          .set({ agentConfigId: targetAgentConfigId })
          .where(eq(whatsappConversations.id, conversation.id));

        // Update local conversation object
        conversation.agentConfigId = targetAgentConfigId;
      }
    }

    // Step 2.5: Check AI availability using aiAvailability field
    const [calendarSettings] = await db
      .select()
      .from(consultantAvailabilitySettings)
      .where(eq(consultantAvailabilitySettings.consultantId, consultantId))
      .limit(1);

    // Load WhatsApp config - prioritize conversation's assigned agent
    let consultantConfig;
    if (conversation.agentConfigId) {
      [consultantConfig] = await db
        .select()
        .from(consultantWhatsappConfig)
        .where(eq(consultantWhatsappConfig.id, conversation.agentConfigId))
        .limit(1);

      if (consultantConfig) {
        console.log(`✅ [CONFIG] Using agent from conversation: ${consultantConfig.agentName} (${consultantConfig.id})`);
      } else {
        console.warn(`⚠️ [CONFIG] Agent ${conversation.agentConfigId} not found, falling back to consultant default`);
      }
    }

    // Fallback to first active agent for consultant
    if (!consultantConfig) {
      [consultantConfig] = await db
        .select()
        .from(consultantWhatsappConfig)
        .where(eq(consultantWhatsappConfig.consultantId, consultantId))
        .limit(1);

      if (consultantConfig) {
        console.log(`⚠️ [CONFIG] Using fallback agent for consultant: ${consultantConfig.agentName}`);
      }
    }

    // Determine if this is a proactive agent (writes first to leads)
    const isProactiveAgent = consultantConfig?.agentType === 'proactive_setter';
    console.log(`🎯 [AGENT TYPE] Agent type: ${consultantConfig?.agentType}, isProactive: ${isProactiveAgent}`);

    // Check if AI auto-response is enabled for this agent
    if (consultantConfig && consultantConfig.autoResponseEnabled === false) {
      console.log(`🤖 AI auto-response is DISABLED for agent ${consultantConfig.agentName} - storing messages but not responding`);

      // STEP 1: Save inbound messages to conversation history (with atomic duplicate prevention)
      for (const msg of pending) {
        await db.insert(whatsappMessages).values({
          conversationId: conversation.id,
          messageText: msg.messageText,
          direction: "inbound",
          sender: "client",
          twilioSid: msg.twilioSid, // CRITICAL: Include twilioSid for anti-duplication
          mediaUrl: msg.mediaUrl,
          mediaType: msg.mediaType || "text",
          mediaContentType: msg.mediaContentType,
          metadata: msg.metadata || null, // Preserve metadata from pending (e.g., simulated flag)
        })
          .onConflictDoNothing({ target: whatsappMessages.twilioSid }); // Skip duplicates silently
      }

      // STEP 2: Mark as processed (including duplicates to prevent re-processing)
      await db
        .update(whatsappPendingMessages)
        .set({ processedAt: new Date() })
        .where(
          inArray(
            whatsappPendingMessages.id,
            pending.map((p) => p.id)
          )
        );

      console.log(`✅ Stored ${uniquePending.length} inbound message(s) without AI response (AI disabled)`);
      return;
    }

    // Check if within agent working hours
    // Guard against null/undefined timezone - use Europe/Rome as fallback
    const consultantTimezone = calendarSettings?.timezone || "Europe/Rome";
    if (consultantConfig?.workingHoursEnabled && !isWithinAgentWorkingHours(consultantConfig, consultantTimezone)) {
      console.log(`⏰ Outside agent working hours for ${consultantConfig.agentName}`);

      // STEP 1: Save inbound messages to conversation history (with atomic duplicate prevention)
      for (const msg of pending) {
        await db.insert(whatsappMessages).values({
          conversationId: conversation.id,
          messageText: msg.messageText,
          direction: "inbound",
          sender: "client",
          twilioSid: msg.twilioSid, // CRITICAL: Include twilioSid for anti-duplication
          mediaUrl: msg.mediaUrl,
          mediaType: msg.mediaType || "text",
          mediaContentType: msg.mediaContentType,
          metadata: msg.metadata || null, // Preserve metadata from pending (e.g., simulated flag)
        })
          .onConflictDoNothing({ target: whatsappMessages.twilioSid }); // Skip duplicates silently
      }

      // STEP 2: Send after-hours message
      const defaultMessage = "Ciao! L'assistente AI è attualmente non disponibile. Ti risponderò appena possibile.";
      const afterHoursMsg = consultantConfig?.afterHoursMessage || defaultMessage;

      const [savedMessage] = await db
        .insert(whatsappMessages)
        .values({
          conversationId: conversation.id,
          messageText: afterHoursMsg,
          direction: "outbound",
          sender: "ai",
        })
        .returning();

      await sendWhatsAppMessage(
        consultantId,
        phoneNumber,
        afterHoursMsg,
        savedMessage.id,
        { conversationId: conversation.id }
      );

      // STEP 3: Mark as processed (including duplicates to prevent re-processing)
      await db
        .update(whatsappPendingMessages)
        .set({ processedAt: new Date() })
        .where(
          inArray(
            whatsappPendingMessages.id,
            pending.map((p) => p.id)
          )
        );

      console.log(`✅ Stored ${uniquePending.length} inbound message(s) and sent after-hours message`);
      return;
    }

    console.log(`✅ AI is ENABLED and within working hours for consultant ${consultantId} - proceeding with AI response`);

    const batchedText = uniquePending.map((p) => p.messageText).join(". ");
    const batchId = nanoid();

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`🔑 [STEP 3] Selecting AI Provider (Vertex AI / Google AI Studio)`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`🆔 Conversation ID: ${conversation.id}`);
    console.log(`👤 User Type: ${conversation.userId ? 'CLIENT' : 'LEAD'}`);

    // Step 3: Try Vertex AI first, fallback to API keys
    const aiProvider = await selectWhatsAppAIProvider(conversation);

    console.log(`✅ Selected AI Provider: ${aiProvider.type}`);
    if (aiProvider.type === 'vertex') {
      console.log(`   📍 Project: ${aiProvider.projectId}, Location: ${aiProvider.location}`);
    } else {
      const maskedKey = aiProvider.apiKey.length > 20
        ? `${aiProvider.apiKey.substring(0, 10)}...${aiProvider.apiKey.substring(aiProvider.apiKey.length - 4)}`
        : '***masked***';
      console.log(`   🔐 API Key: ${maskedKey}`);
      console.log(`   🆔 Key ID: ${aiProvider.keyId.substring(0, 8)}...`);
    }
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Extract apiKey and keyInfo from aiProvider for use in media processing and objection detection
    let apiKey: string;
    let keyInfo: { apiKey: string; keyId: string };

    if (aiProvider.type === 'studio') {
      // For Google AI Studio, use keys from aiProvider
      apiKey = aiProvider.apiKey;
      keyInfo = { apiKey: aiProvider.apiKey, keyId: aiProvider.keyId };
      console.log(`🔑 [API KEY] Extracted from Google AI Studio provider (key: ${aiProvider.keyId.substring(0, 8)}...)`);
    } else {
      // For Vertex AI, get a fallback API key for operations that require it (media processing, objection detection)
      try {
        const fallbackKeyInfo = await selectApiKey(conversation);
        apiKey = fallbackKeyInfo.apiKey;
        keyInfo = fallbackKeyInfo;
        console.log(`🔑 [API KEY] Vertex AI in use - obtained fallback Google AI Studio key for media/objection processing (key: ${fallbackKeyInfo.keyId.substring(0, 8)}...)`);
      } catch (error: any) {
        console.warn(`⚠️ [API KEY] Failed to get fallback Google AI Studio key for Vertex AI - media/objection processing may be limited`);
        console.warn(`   Error: ${error.message}`);
        // Use dummy values to prevent crashes - features requiring API key will be skipped
        apiKey = '';
        keyInfo = { apiKey: '', keyId: 'vertex-no-fallback' };
      }
    }

    console.log(`💾 [STEP 4] Saving ${uniquePending.length} inbound message(s) to database`);
    // Step 4: Save inbound messages sequentially with atomic duplicate prevention
    const inboundMessages = [];
    for (const p of uniquePending) {
      const messageData = {
        conversationId: conversation.id,
        messageText: p.messageText,
        direction: "inbound" as const,
        sender: "client" as const,
        twilioSid: p.twilioSid, // CRITICAL: Include twilioSid for anti-duplication
        mediaType: (p.mediaType || "text") as "text" | "image" | "document" | "audio" | "video",
        mediaUrl: p.mediaUrl || null,
        mediaContentType: p.mediaContentType || null,
        isBatched: uniquePending.length > 1,
        batchId: uniquePending.length > 1 ? batchId : null,
        metadata: p.metadata || null, // Preserve metadata from pending (e.g., simulated flag)
      };

      // ATOMIC DUPLICATE PREVENTION: Use onConflictDoNothing to skip duplicates silently
      const savedMessages = await db
        .insert(whatsappMessages)
        .values(messageData)
        .onConflictDoNothing({ target: whatsappMessages.twilioSid })
        .returning();

      // If conflict occurred, savedMessages will be empty - skip this message
      if (savedMessages.length === 0) {
        console.log(`⏭️ [ANTI-DUP ATOMIC] Messaggio ${p.twilioSid} duplicate detected during INSERT - skipping`);
        continue;
      }

      const savedMsg = savedMessages[0];
      inboundMessages.push(savedMsg);
      console.log(`✅ [STEP 4] Saved inbound message ${savedMsg.id}: "${p.messageText.substring(0, 50)}..."`);

      // Process media if present
      if (p.mediaUrl && p.mediaContentType) {
        console.log(`📸 Processing media for message ${savedMsg.id}`);
        // Pass Vertex AI credentials for audio transcription if available
        const vertexCreds = aiProvider.type === 'vertex' ? {
          projectId: aiProvider.projectId,
          location: aiProvider.location,
          credentials: aiProvider.credentials
        } : undefined;

        await handleIncomingMedia(
          savedMsg.id,
          p.mediaUrl,
          p.mediaContentType,
          conversation.consultantId,
          apiKey,
          conversation.agentConfigId || undefined,
          vertexCreds
        );
      }
    }

    // Detect if client sent audio message (for Mirror mode TTS response)
    const clientSentAudio = inboundMessages.some(msg => msg.mediaType === 'audio');
    if (clientSentAudio) {
      console.log(`🎤 [AUDIO DETECTION] Client sent audio message - Mirror mode may trigger TTS response`);
    } else {
      console.log(`💬 [AUDIO DETECTION] Client sent text message - No audio TTS needed unless always_audio mode`);
    }

    // TASK 2: Detect explicit rejection in inbound messages
    const isExplicitRejection = detectExplicitRejection(batchedText);
    if (isExplicitRejection) {
      console.log(`⚠️ [REJECTION-DETECTED] Lead ha detto NO esplicitamente - aggiornato flag`);
      await db.update(conversationStates)
        .set({ hasSaidNoExplicitly: true })
        .where(eq(conversationStates.conversationId, conversation.id));
    }

    console.log(`📸 [STEP 5] Building media context (${inboundMessages.length} messages)`);
    // Step 5: Build media context for AI
    let mediaContext = "";
    for (const msg of inboundMessages) {
      if (msg.mediaType !== "text") {
        // Reload message to get updated metadata after media processing
        const [updatedMsg] = await db
          .select()
          .from(whatsappMessages)
          .where(eq(whatsappMessages.id, msg.id))
          .limit(1);

        if (updatedMsg?.metadata) {
          if (updatedMsg.metadata.aiVisionAnalysis) {
            mediaContext += `\n\n[IMMAGINE RICEVUTA - Analisi AI Vision]: ${updatedMsg.metadata.aiVisionAnalysis}`;
          }
          if (updatedMsg.metadata.extractedText) {
            mediaContext += `\n\n[TESTO ESTRATTO]: ${updatedMsg.metadata.extractedText.substring(0, 1000)}`;
          }
          if (updatedMsg.metadata.audioTranscript) {
            mediaContext += `\n\n[AUDIO TRASCRITTO]: ${updatedMsg.metadata.audioTranscript}`;
          }
        }
      }
    }

    // Determina userId effettivo considerando il test mode
    let effectiveUserId = conversation.userId;
    let effectiveIsLead = conversation.isLead;

    if (conversation.testModeOverride) {
      console.log(`🧪 [TEST MODE] Override attivo: ${conversation.testModeOverride}`);
      if (conversation.testModeOverride === "client" && conversation.testModeUserId) {
        effectiveUserId = conversation.testModeUserId;
        effectiveIsLead = false;
        console.log(`🧪 [TEST MODE] Usando userId: ${effectiveUserId}`);
      } else if (conversation.testModeOverride === "lead") {
        effectiveUserId = null;
        effectiveIsLead = true;
        console.log(`🧪 [TEST MODE] Simulando lead`);
      } else if (conversation.testModeOverride === "consulente") {
        effectiveUserId = null;
        effectiveIsLead = false;
        console.log(`🧪 [TEST MODE] Simulando consulente`);
      }
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`🤖 [STEP 6] Building AI System Prompt`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`👤 Participant Type: ${participantType.toUpperCase()}`);
    console.log(`💬 Message: "${batchedText.substring(0, 80)}${batchedText.length > 80 ? '...' : ''}"`);

    // Step 6: Build system prompt
    let systemPrompt: string;
    let objectionDetection: any = null;
    let clientProfile: any = null;
    let recentObjections: any[] = [];

    // Check if consultant is writing - give full data access
    if (participantType === 'consultant') {
      console.log(`\n👨‍💼 [CONSULTANT MODE] Building consultant context with full data access...`);

      // Import buildConsultantContext
      const { buildConsultantContext } = await import('../consultant-context-builder');

      // Build consultant context with full CRM data
      timings.contextBuildStart = performance.now();
      const consultantContext = await buildConsultantContext(consultantId, {
        message: batchedText,
        pageContext: { pageType: 'whatsapp_mobile' },
      });
      timings.contextBuildEnd = performance.now();
      const contextBuildTime = Math.round(timings.contextBuildEnd - timings.contextBuildStart);
      console.log(`✅ Consultant context built: ${contextBuildTime}ms`);

      // Build consultant-specific system prompt
      const { buildConsultantSystemPrompt } = await import('../ai-service');
      timings.promptBuildStart = performance.now();
      systemPrompt = buildConsultantSystemPrompt(consultantContext);
      timings.promptBuildEnd = performance.now();
      const promptBuildTime = Math.round(timings.promptBuildEnd - timings.promptBuildStart);
      console.log(`✅ Consultant system prompt ready: ${promptBuildTime}ms`);

      // Add WhatsApp-specific instructions for consultant
      systemPrompt += `\n\n📱 MODALITÀ WHATSAPP CONSULENTE:\nStai rispondendo via WhatsApp come consulente con accesso completo a tutti i dati CRM. Rispondi in modo professionale ma conciso. Puoi accedere a tutti i dati di clienti, esercizi, appuntamenti, lead, ecc. come se fossi dentro l'applicazione.`;

    } else if (effectiveUserId) {
      // ⏱️ Context Building Timing
      timings.contextBuildStart = performance.now();

      console.log(`\n🔍 Detecting intent for client message...`);
      const intent = detectIntent(batchedText);
      console.log(`✅ Intent detected: ${intent}`);

      console.log(`📚 Building user context...`);
      const userContext = await buildUserContext(effectiveUserId, {
        message: batchedText,
        intent,
        conversation: {
          isProactiveLead: conversation.isProactiveLead || false,
          proactiveLeadId: conversation.proactiveLeadId || null,
          isLead: conversation.isLead,
          messageCount: conversation.messageCount,
        },
      });
      console.log(`✅ User context built successfully`);

      timings.contextBuildEnd = performance.now();
      const contextBuildTime = Math.round(timings.contextBuildEnd - timings.contextBuildStart);
      console.log(`⏱️  [TIMING] Context building: ${contextBuildTime}ms`);

      // ⏱️ Prompt Building Timing
      timings.promptBuildStart = performance.now();
      console.log(`📝 Building system prompt for client...`);
      systemPrompt = buildSystemPrompt(
        "assistenza",
        "finanziario",
        userContext
      );
      timings.promptBuildEnd = performance.now();
      const promptBuildTime = Math.round(timings.promptBuildEnd - timings.promptBuildStart);
      console.log(`✅ System prompt ready`);
      console.log(`⏱️  [TIMING] Prompt building: ${promptBuildTime}ms`);

      // WhatsApp Concise Mode: Add conversational style instructions for clients only
      if (consultantConfig?.whatsappConciseMode) {
        console.log(`💬 [WHATSAPP MODE] Modalità conversazionale attiva - adattando lo stile per WhatsApp`);
        systemPrompt += `

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📱 MODALITÀ WHATSAPP ATTIVA - REGOLE FONDAMENTALI
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🚨 CONTESTO CRUCIALE:
Stai comunicando con il cliente tramite WhatsApp - NON via email, NON di persona.
Questo significa che il cliente si aspetta risposte rapide, dirette e conversazionali, 
come in una normale chat WhatsApp tra due persone.

📝 STILE DI SCRITTURA WHATSAPP:
✅ Messaggi brevi (max 2-3 frasi per concetto)
✅ Linguaggio naturale e colloquiale - come parleresti di persona
✅ Vai dritto al punto - zero formalità inutili
✅ Rispondi velocemente alle domande senza giri di parole
✅ Usa emoji quando appropriato (ma senza esagerare)
✅ Scrivi come se stessi chattando su WhatsApp con un amico/cliente

❌ NON FARE MAI:
❌ Messaggi lunghi oltre 1000 caratteri
❌ Formattazioni eccessive (troppi asterischi, simboli, liste)
❌ Tono formale da email professionale
❌ Introduzioni lunghe tipo "Gentile cliente, La contatto per..."
❌ Liste puntate con più di 3-4 punti
❌ Suggerimenti di "aprire lezioni", "aprire esercizi", "cliccare qui" - siamo su WhatsApp, non puoi aprire nulla!

⚠️ IMPORTANTE - LIMITAZIONI WHATSAPP:
Su WhatsApp NON puoi:
- Aprire lezioni o esercizi per il cliente
- Fornire link cliccabili alla piattaforma
- Mostrare interfacce o dashboard

Puoi SOLO:
- Rispondere a domande
- Fornire informazioni
- Dare consigli basati sui dati
- Suggerire azioni che il cliente può fare POI sulla piattaforma (es: "Quando accedi alla piattaforma, vai nella sezione X")

💡 MENTALITÀ CORRETTA:
Stai chattando su WhatsApp. Il cliente ha il telefono in mano e si aspetta 
una risposta veloce e utile, non un'email formale. Sii diretto, amichevole 
e pratico. Pensa: "Come risponderei a questo messaggio se fossi su WhatsApp?"

🎯 ESEMPI PRATICI:

✅ BUONO (stile WhatsApp naturale):
"Ciao! Ho controllato i tuoi dati 📊
Il tuo risparmio è al 25% - ottimo risultato! 👏
Ti serve aiuto con qualcos'altro?"

❌ SBAGLIATO (troppo formale/lungo per WhatsApp):
"Buongiorno gentile cliente,
Desidero informarLa che ho provveduto ad effettuare un'attenta analisi 
dei Suoi dati finanziari presenti all'interno del Software Orbitale e ho 
riscontrato che il Suo tasso di risparmio mensile ammonta al 25%..."

❌ SBAGLIATO (suggerisce di aprire risorse su WhatsApp):
"Per studiare questo argomento, ti consiglio di aprire la lezione X. Clicca qui 👉"

✅ CORRETTO (indica cosa fare POI sulla piattaforma):
"Ti consiglio di studiare la lezione 'Budget Avanzato' nella sezione Università. La trovi nel modulo Q1 quando accedi alla piattaforma 📚"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`;
      }
    } else {
      // For leads, detect intent for appointment booking
      console.log(`\n🔍 Detecting intent for lead message...`);
      const leadIntent = detectIntent(batchedText);
      console.log(`✅ Intent detected: ${leadIntent}`);

      // OBJECTION DETECTION DISABLED - Aligned with public share (Dec 2025)
      // The AI handles objections naturally without explicit detection
      console.log(`⏭️ [OBJECTION] Objection detection DISABLED (aligned with public share)`);

      // Get or create client profile (without objection tracking)
      console.log(`👤 Fetching/creating lead profile...`);
      clientProfile = await getOrCreateProfile(undefined, conversation.phoneNumber);
      console.log(`✅ Lead profile: ${clientProfile.profileType} (difficulty: ${clientProfile.difficultyScore}/10)`);

      // Initialize availableSlots and existingAppointmentInfo OUTSIDE guard so they're always defined
      let availableSlots: any[] = [];
      let existingAppointmentInfo: any = undefined;

      // APPOINTMENT CONTEXT MANAGEMENT - Maintain context across messages
      if (consultantConfig?.bookingEnabled !== false && !effectiveUserId) {
        // STEP 1: Check if we already have slots saved in database (maintains context)
        // This happens BEFORE intent detection so context is preserved even when
        // lead responds with generic messages like "certo", "pomeriggio", etc.
        console.log('📅 [APPOINTMENT CONTEXT] Checking for existing saved slots...');
        try {
          const [savedSlots] = await db
            .select()
            .from(proposedAppointmentSlots)
            .where(
              and(
                eq(proposedAppointmentSlots.conversationId, conversation.id),
                eq(proposedAppointmentSlots.usedForBooking, false),
                sql`${proposedAppointmentSlots.expiresAt} > NOW()`
              )
            )
            .orderBy(desc(proposedAppointmentSlots.proposedAt))
            .limit(1);

          if (savedSlots && savedSlots.slots) {
            availableSlots = savedSlots.slots as any[];
            console.log(`💾 [APPOINTMENT CONTEXT] Retrieved ${availableSlots.length} saved slots from database`);
            console.log(`📅 [APPOINTMENT CONTEXT] Context maintained - AI can continue appointment flow`);
          } else {
            console.log('📅 [APPOINTMENT CONTEXT] No saved slots found - will fetch from calendar...');
          }
        } catch (error: any) {
          console.error('❌ [APPOINTMENT CONTEXT] Error retrieving saved slots');
          console.error(`   Conversation ID: ${conversation.id}`);
          console.error(`   Error type: ${error?.name || 'Unknown'}`);
          console.error(`   Error message: ${error?.message || error}`);
          if (error?.stack) {
            console.error(`   Stack trace:\n${error.stack}`);
          }
        }

        // STEP 2: If no saved slots, ALWAYS fetch new slots (not just on appointment_request)
        // This way slots are ALWAYS available for the AI to propose
        if (availableSlots.length === 0) {
          console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
          console.log('🔍 [STEP 1] Fetching Available Appointment Slots');
          console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
          console.log(`📅 New appointment request detected for consultant: ${conversation.consultantId}`);

          // ⏱️ Appointment Fetch Timing
          timings.appointmentFetchStart = performance.now();

          try {
            // Calculate date range (next 7 days)
            const startDate = new Date();
            const endDate = new Date();
            endDate.setDate(endDate.getDate() + 7);

            console.log(`📆 Search range: ${startDate.toLocaleDateString('it-IT')} → ${endDate.toLocaleDateString('it-IT')} (7 days)`);
            console.log(`🌐 Calling API: /api/calendar/available-slots`);

            // Call available slots endpoint (with agent calendar support)
            const agentConfigId = conversation.agentConfigId || consultantConfig?.id;
            const slotsResponse = await fetch(
              `http://localhost:${process.env.PORT || 5000}/api/calendar/available-slots?` +
              `consultantId=${conversation.consultantId}&` +
              `startDate=${startDate.toISOString()}&` +
              `endDate=${endDate.toISOString()}` +
              (agentConfigId ? `&agentConfigId=${agentConfigId}` : '')
            );

            if (slotsResponse.ok) {
              const slotsData = await slotsResponse.json();
              const rawSlots = slotsData.slots || [];

              // Format slots for display and AI context
              const consultantTimezone = calendarSettings?.timezone || 'Europe/Rome';
              availableSlots = rawSlots.map((slot: any) => formatSlotForDisplay(slot, consultantTimezone));

              console.log(`\n✅ Found ${availableSlots.length} available slots!`);
              if (availableSlots.length > 0) {
                // Group slots by date for better visualization
                const slotsByDate = availableSlots.reduce((acc: any, slot: any) => {
                  if (!acc[slot.date]) {
                    acc[slot.date] = [];
                  }
                  acc[slot.date].push(slot);
                  return acc;
                }, {});

                console.log(`\n📅 Available Slots by Day:\n`);
                Object.keys(slotsByDate).sort().forEach(date => {
                  const daySlots = slotsByDate[date];
                  const dayOfWeek = daySlots[0].dayOfWeek;
                  console.log(`   📆 ${dayOfWeek} ${date} (${daySlots.length} slots)`);
                  daySlots.forEach((slot: any, i: number) => {
                    console.log(`      ${i + 1}. ${slot.time}`);
                  });
                  console.log('');
                });
                console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
              } else {
                console.log(`⚠️ No available slots found in the next 7 days`);
                console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
              }

              // PERSIST SLOTS: Save to database for future messages (maintains context)
              if (availableSlots.length > 0) {
                const expiresAt = new Date();
                expiresAt.setHours(expiresAt.getHours() + 48); // Slots valid for 48 hours

                // Check if slots already exist for this conversation
                const [existing] = await db
                  .select()
                  .from(proposedAppointmentSlots)
                  .where(
                    and(
                      eq(proposedAppointmentSlots.conversationId, conversation.id),
                      eq(proposedAppointmentSlots.consultantId, conversation.consultantId)
                    )
                  )
                  .limit(1);

                if (existing) {
                  // Update existing slots
                  await db
                    .update(proposedAppointmentSlots)
                    .set({
                      slots: availableSlots,
                      proposedAt: new Date(),
                      expiresAt,
                      usedForBooking: false,
                    })
                    .where(eq(proposedAppointmentSlots.id, existing.id));

                  console.log(`💾 [APPOINTMENT] Updated ${availableSlots.length} existing slots in database (expires in 48h)`);
                } else {
                  // Insert new slots
                  await db
                    .insert(proposedAppointmentSlots)
                    .values({
                      conversationId: conversation.id,
                      consultantId: conversation.consultantId,
                      slots: availableSlots,
                      proposedAt: new Date(),
                      expiresAt,
                      usedForBooking: false,
                    });

                  console.log(`💾 Saved ${availableSlots.length} slots to database (valid for 48 hours)`);
                  console.log(`✅ Slots ready to propose to lead via AI`);
                }
              }
            } else {
              const errorText = await slotsResponse.text();
              console.error(`\n❌ Failed to fetch slots from API`);
              console.error(`   Response status: ${slotsResponse.status}`);
              console.error(`   Error: ${errorText}`);
              console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
            }

            timings.appointmentFetchEnd = performance.now();
            const appointmentFetchTime = Math.round(timings.appointmentFetchEnd - timings.appointmentFetchStart);
            console.log(`⏱️  [TIMING] Appointment fetch: ${appointmentFetchTime}ms`);

          } catch (error: any) {
            console.error(`\n❌ Error fetching available slots`);
            console.error(`   Consultant ID: ${conversation.consultantId}`);
            console.error(`   Date range: ${startDate.toISOString()} to ${endDate.toISOString()}`);
            console.error(`   Error type: ${error?.name || 'Unknown'}`);
            console.error(`   Error message: ${error?.message || error}`);
            if (error?.stack) {
              console.error(`   Stack trace:\n${error.stack}`);
            }
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

            timings.appointmentFetchEnd = performance.now();
            const appointmentFetchTime = Math.round(timings.appointmentFetchEnd - timings.appointmentFetchStart);
            console.log(`⏱️  [TIMING] Appointment fetch (failed): ${appointmentFetchTime}ms`);
          }
        }

        // Log final state for debugging
        if (availableSlots.length > 0) {
          console.log(`✅ [APPOINTMENT CONTEXT] Final state: ${availableSlots.length} slots available for AI prompt`);
        } else {
          console.log(`📭 [APPOINTMENT CONTEXT] Final state: No slots available (not in appointment flow)`);
        }

        // Check for existing confirmed appointment to pass to AI prompt
        const [existingBooking] = await db
          .select()
          .from(appointmentBookings)
          .where(
            and(
              eq(appointmentBookings.conversationId, conversation.id),
              eq(appointmentBookings.status, 'confirmed')
            )
          )
          .limit(1);

        if (existingBooking) {
          existingAppointmentInfo = {
            id: existingBooking.id,
            date: existingBooking.appointmentDate,
            time: existingBooking.appointmentTime,
            email: existingBooking.clientEmail,
            phone: existingBooking.clientPhone,
          };
          console.log(`📅 [EXISTING APPOINTMENT] Found confirmed appointment for this conversation`);
          console.log(`   Date: ${existingBooking.appointmentDate} ${existingBooking.appointmentTime}`);
          console.log(`   Email: ${existingBooking.clientEmail}`);
        }
      } else {
        console.log(`⏭️ [APPOINTMENT SLOTS] Slots fetch DISABLED (bookingEnabled=false)`);
      }

      // Check if this is a proactive lead (use conversation flag first)
      let proactiveLeadData: any = null;
      let isProactiveLead = conversation.isProactiveLead || false;

      console.log(`🔍 [PROACTIVE CHECK] conversation.isProactiveLead=${conversation.isProactiveLead}, conversation.proactiveLeadId=${conversation.proactiveLeadId}`);

      if (isProactiveLead && conversation.proactiveLeadId) {
        try {
          // Load lead data using the linked proactiveLeadId
          const [leadEntry] = await db
            .select()
            .from(proactiveLeads)
            .where(eq(proactiveLeads.id, conversation.proactiveLeadId))
            .limit(1);

          if (leadEntry) {
            proactiveLeadData = leadEntry;
            console.log(`🎯 [PROACTIVE LEAD] Found lead data: ${leadEntry.firstName} ${leadEntry.lastName}`);
            console.log(`📋 Lead Info: ${JSON.stringify(leadEntry.leadInfo)}`);
            console.log(`🎯 Ideal State: ${leadEntry.idealState}`);

            // Update status to 'responded' if this is first response
            if (leadEntry.status === 'contacted') {
              await db
                .update(proactiveLeads)
                .set({
                  status: 'responded',
                  updatedAt: new Date(),
                  metadata: {
                    ...leadEntry.metadata,
                    conversationId: conversation.id,
                    firstResponseAt: new Date().toISOString()
                  }
                })
                .where(eq(proactiveLeads.id, leadEntry.id));
              console.log(`✅ [PROACTIVE LEAD] Updated status to 'responded'`);
            }
          } else {
            console.warn(`⚠️ [PROACTIVE LEAD] Conversation marked as proactive but lead ${conversation.proactiveLeadId} not found`);
          }
        } catch (error: any) {
          console.error(`⚠️ [PROACTIVE LEAD] Error loading proactive lead: ${error.message}`);
        }
      } else {
        console.log(`ℹ️ [PROACTIVE CHECK] This is a REACTIVE lead (isProactiveLead=false)`);
      }

      // Debug log for proactive lead prompt building
      if (isProactiveLead) {
        console.log(`📝 [PROMPT DEBUG] Building prompt with isProactiveAgent=${isProactiveAgent}, isProactiveLead=${isProactiveLead}`);
      }

      // Build prompt with objection context, available slots, and existing appointment
      systemPrompt = await buildLeadSystemPrompt(
        consultantConfig,
        clientProfile ? {
          difficultyScore: clientProfile.difficultyScore,
          totalObjections: clientProfile.totalObjections,
          profileType: clientProfile.profileType,
          escalationRequired: clientProfile.escalationRequired,
        } : undefined,
        recentObjections.map(obj => ({
          objectionType: obj.objectionType,
          objectionText: obj.objectionText,
          wasResolved: obj.wasResolved,
        })),
        availableSlots,
        consultantTimezone,
        existingAppointmentInfo,
        isProactiveLead,
        proactiveLeadData?.leadInfo,
        proactiveLeadData?.idealState,
        isProactiveAgent
      );
    }

    console.log(`📚 [STEP 7] Checking for reset request and fetching message history`);
    // Step 7: Check for reset request
    const resetKeywords = ['ricominciamo', 'reset', 'ripartiamo da capo', 'ricomincia', 'riparti da capo', 'ricominciare'];
    const isResetRequest = resetKeywords.some(keyword => batchedText.toLowerCase().includes(keyword));

    let geminiMessages: Array<{ role: "user" | "model", parts: Array<{ text: string }> }> = [];

    if (isResetRequest) {
      console.log(`🔄 [STEP 7] Reset requested - clearing ALL conversation data`);

      // STEP 1: Delete proposed appointment slots for this conversation
      const deletedSlots = await db
        .delete(proposedAppointmentSlots)
        .where(eq(proposedAppointmentSlots.conversationId, conversation.id))
        .returning();

      if (deletedSlots.length > 0) {
        console.log(`🗑️  Deleted ${deletedSlots.length} proposed appointment slots`);
      }

      // STEP 2: Delete unconfirmed appointments (those without confirmedAt)
      const deletedAppointments = await db
        .delete(appointmentBookings)
        .where(
          and(
            eq(appointmentBookings.clientPhone, phoneNumber),
            eq(appointmentBookings.consultantId, conversation.consultantId),
            isNull(appointmentBookings.confirmedAt)
          )
        )
        .returning();

      if (deletedAppointments.length > 0) {
        console.log(`🗑️  Deleted ${deletedAppointments.length} unconfirmed appointments`);
      }

      // STEP 3: Update conversation with reset timestamp
      await db
        .update(whatsappConversations)
        .set({
          lastResetAt: new Date(),
          // Reset lead conversion status if it was a lead
          leadConvertedAt: null
        })
        .where(eq(whatsappConversations.id, conversation.id));

      console.log(`✅ Reset data: timestamp updated, conversation reset to initial state`);

      // STEP 3.5: Save inbound reset request messages (with atomic duplicate prevention)
      for (const msg of pending) {
        await db.insert(whatsappMessages).values({
          conversationId: conversation.id,
          messageText: msg.messageText,
          direction: "inbound",
          sender: "client",
          twilioSid: msg.twilioSid,
          mediaUrl: msg.mediaUrl,
          mediaType: msg.mediaType || "text",
          mediaContentType: msg.mediaContentType,
          metadata: msg.metadata || null,
        })
          .onConflictDoNothing({ target: whatsappMessages.twilioSid }); // Skip duplicates silently
      }
      console.log(`✅ Saved ${pending.length} inbound reset request message(s) to history`);

      // STEP 4: Save reset acknowledgment message directly (bypass AI for consistency)
      const resetMessage = "Certo! Nessun problema, ricominciamo da capo. 👋\nCosa ti ha spinto a scriverci oggi?";

      const [savedResetMsg] = await db
        .insert(whatsappMessages)
        .values({
          conversationId: conversation.id,
          messageText: resetMessage,
          direction: "outbound",
          sender: "ai",
        })
        .returning();

      await sendWhatsAppMessage(
        conversation.consultantId,
        phoneNumber,
        resetMessage,
        savedResetMsg.id,
        { conversationId: conversation.id }
      );

      // STEP 5: Mark pending as processed (including duplicates to prevent re-processing)
      await db
        .update(whatsappPendingMessages)
        .set({ processedAt: new Date() })
        .where(
          inArray(
            whatsappPendingMessages.id,
            pending.map((p) => p.id)
          )
        );

      console.log(`✅ Reset conversation complete - sent acknowledgment and cleared all temporary data`);
      return; // Exit early, no need to call AI
    }

    // Load history, filtering by lastResetAt if it exists
    const historyConditions = [eq(whatsappMessages.conversationId, conversation.id)];

    if (conversation.lastResetAt) {
      console.log(`🔄 Filtering history after last reset: ${conversation.lastResetAt}`);
      historyConditions.push(sql`${whatsappMessages.createdAt} > ${conversation.lastResetAt}`);
    }

    const history = await db
      .select()
      .from(whatsappMessages)
      .where(and(...historyConditions))
      .orderBy(desc(whatsappMessages.createdAt))
      .limit(20);

    geminiMessages = history.reverse().map((m) => ({
      role: m.sender === "client" ? ("user" as const) : ("model" as const),
      parts: [{ text: m.messageText }],
    }));
    console.log(`📚 [STEP 7] Found ${history.length} historical messages${conversation.lastResetAt ? ' (after reset)' : ''}`);

    console.log(`🧠 [STEP 8] Calling Gemini AI (model selection based on provider)`);

    // Step 8: Generate AI response with retry logic
    const userMessage = mediaContext ? `${batchedText}\n${mediaContext}` : batchedText;

    // Estimate tokens before API call
    const systemPromptChars = systemPrompt.length;
    const userMessageChars = userMessage.length;
    const historyChars = geminiMessages.reduce((sum, msg) => sum + msg.parts[0].text.length, 0);

    const estimatedSystemTokens = Math.ceil(systemPromptChars / 4);
    const estimatedUserTokens = Math.ceil(userMessageChars / 4);
    const estimatedHistoryTokens = Math.ceil(historyChars / 4);
    const estimatedTotalInput = estimatedSystemTokens + estimatedUserTokens + estimatedHistoryTokens;

    console.log(`\n📊 [GEMINI TOKENS] Stima PRIMA della chiamata:`);
    console.log(`   📝 System Prompt: ~${estimatedSystemTokens.toLocaleString()} tokens (${systemPromptChars.toLocaleString()} chars)`);
    console.log(`   💬 User Message: ~${estimatedUserTokens.toLocaleString()} tokens (${userMessageChars.toLocaleString()} chars)`);
    console.log(`   📜 History: ~${estimatedHistoryTokens.toLocaleString()} tokens (${historyChars.toLocaleString()} chars)`);
    console.log(`   🔢 TOTALE INPUT: ~${estimatedTotalInput.toLocaleString()} tokens\n`);

    // Check if agent has File Search Store for RAG-powered responses
    // SECURITY: ONLY Level 3 (Deluxe) agents can access consultant's full store
    // All other levels (null, "1", "2") can ONLY access agent-specific store
    const agentLevel = consultantConfig.level; // "1" = Bronze, "2" = Silver, "3" = Deluxe, null = internal/public
    const canAccessConsultantStore = agentLevel === "3"; // STRICT: Only explicit Level 3
    
    console.log(`🔐 [FILE SEARCH] Access check - Agent level: ${agentLevel}, canAccessConsultantStore: ${canAccessConsultantStore}`);
    
    let fileSearchTool: any = null;
    try {
      // First try agent-specific store (safe for all users)
      const agentStore = await fileSearchSyncService.getWhatsappAgentStore(consultantConfig.id);
      if (agentStore && agentStore.documentCount > 0) {
        fileSearchTool = fileSearchService.buildFileSearchTool([agentStore.googleStoreName]);
        console.log(`🔍 [FILE SEARCH] WhatsApp agent has FileSearchStore: ${agentStore.displayName}`);
        console.log(`   📦 Store: ${agentStore.googleStoreName}`);
        console.log(`   📄 Documents: ${agentStore.documentCount}`);
      } else if (canAccessConsultantStore) {
        // ONLY Level 3 (Deluxe) can fallback to consultant's store
        // All other levels (null, "1", "2") are blocked from CRM data
        const consultantStore = await fileSearchSyncService.getConsultantStore(consultantConfig.consultantId);
        if (consultantStore && consultantStore.documentCount > 0) {
          fileSearchTool = fileSearchService.buildFileSearchTool([consultantStore.googleStoreName]);
          console.log(`🔍 [FILE SEARCH] Using consultant's FileSearchStore as fallback: ${consultantStore.displayName}`);
          console.log(`   📦 Store: ${consultantStore.googleStoreName}`);
          console.log(`   📄 Documents: ${consultantStore.documentCount}`);
        } else if (consultantStore) {
          console.log(`ℹ️ [FILE SEARCH] Consultant store exists but has no documents`);
        } else {
          console.log(`ℹ️ [FILE SEARCH] No FileSearchStore available (no agent or consultant store)`);
        }
      } else {
        console.log(`🔐 [FILE SEARCH] Non-Deluxe agent (Level ${agentLevel ?? 'null'}) - consultant store BLOCKED for security`);
      }
    } catch (fsError: any) {
      console.warn(`⚠️ [FILE SEARCH] Error checking stores: ${fsError.message}`);
    }

    // Retry logic with exponential backoff and API key rotation
    const maxRetries = 3;
    let lastError: any;
    let currentKeyId = aiProvider.type === 'studio' ? aiProvider.keyId : null;
    let currentProvider = aiProvider; // Track current provider for retries
    let response: any;
    let startTime: number;
    let endTime: number;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`🔄 [RETRY] Attempt ${attempt}/${maxRetries}${attempt > 1 ? ' with new API key' : ''}`);

        // Rotate API key only for Google AI Studio on retry (Vertex AI doesn't need rotation)
        if (attempt > 1 && currentProvider.type === 'studio') {
          const newKeyInfo = await selectApiKey(conversation, currentKeyId);
          currentProvider = {
            type: 'studio',
            apiKey: newKeyInfo.apiKey,
            keyId: newKeyInfo.keyId
          };
          currentKeyId = newKeyInfo.keyId;
          console.log(`🔑 [RETRY] Rotated to new API key: ${currentKeyId.substring(0, 8)}...`);
        }

        // ⏱️ Gemini API Call Timing
        timings.geminiCallStart = performance.now();
        startTime = Date.now();

        // Create AI client and call API based on provider type
        if (currentProvider.type === 'vertex') {
          // For Vertex AI, use shared helper that creates @google-cloud/vertexai client
          const { model: vertexModel, useThinking: vertexUseThinking, thinkingLevel: vertexThinkingLevel } = getModelWithThinking('Vertex AI');
          console.log(`   🧠 [AI] Vertex AI - Using model: ${vertexModel}, thinking: ${vertexUseThinking ? `enabled (${vertexThinkingLevel})` : 'disabled'}`);

          const vertexClient = createVertexGeminiClient(
            currentProvider.projectId,
            currentProvider.location,
            currentProvider.credentials,
            vertexModel
          );

          response = await vertexClient.generateContent({
            model: vertexModel,
            contents: [
              ...geminiMessages,
              {
                role: "user",
                parts: [{ text: userMessage }],
              },
            ],
            generationConfig: {
              systemInstruction: systemPrompt,
              ...(vertexUseThinking && { thinkingConfig: { thinkingLevel: vertexThinkingLevel } }),
            },
            ...(fileSearchTool && { tools: [fileSearchTool] }),
          });
        } else {
          // For Google AI Studio, use @google/genai with API key
          const { model: studioModel, useThinking: studioUseThinking, thinkingLevel: studioThinkingLevel } = getModelWithThinking('Google AI Studio');
          console.log(`   🧠 [AI] Google AI Studio - Using model: ${studioModel}, thinking: ${studioUseThinking ? `enabled (${studioThinkingLevel})` : 'disabled'}`);

          const ai = new GoogleGenAI({ apiKey: currentProvider.apiKey });

          response = await ai.models.generateContent({
            model: studioModel,
            contents: [
              ...geminiMessages,
              {
                role: "user",
                parts: [{ text: userMessage }],
              },
            ],
            config: {
              systemInstruction: systemPrompt,
              ...(studioUseThinking && { thinkingConfig: { thinkingLevel: studioThinkingLevel } }),
              ...(fileSearchTool && { tools: [fileSearchTool] }),
            },
          });
        }

        endTime = Date.now();
        timings.geminiCallEnd = performance.now();

        const geminiCallTime = Math.round(timings.geminiCallEnd - timings.geminiCallStart);

        // Success - break retry loop
        console.log(`✅ [RETRY] Success on attempt ${attempt}!`);
        console.log(`⏱️  [TIMING] Gemini API call: ${geminiCallTime}ms`);
        break;

      } catch (error: any) {
        lastError = error;

        // Check if it's a retryable error (500, 503, INTERNAL, UNAVAILABLE, overloaded)
        const isRetryable = isRetryableError(error);

        if (isRetryable) {
          console.log(`⚠️ [RETRY] Retryable error on attempt ${attempt}: ${error.message}`);

          // Mark API Studio key as failed (Vertex AI doesn't use key rotation)
          if (currentProvider.type === 'studio' && currentKeyId) {
            await markKeyAsFailed(currentKeyId);
          }

          // If not last attempt, wait with exponential backoff before rotating
          if (attempt < maxRetries) {
            const backoffMs = Math.min(1000 * Math.pow(2, attempt - 1), 10000); // Max 10s
            console.log(`⏱️ [RETRY] Waiting ${backoffMs}ms before ${currentProvider.type === 'vertex' ? 'retrying' : 'rotating to new key'}...`);
            await new Promise(resolve => setTimeout(resolve, backoffMs));
          } else {
            console.log(`❌ [RETRY] All ${maxRetries} attempts failed with retryable errors`);
            const errorMsg = currentProvider.type === 'vertex'
              ? `Vertex AI unavailable after ${maxRetries} attempts. Please try again later.`
              : `Gemini API unavailable after ${maxRetries} attempts with different keys. Please try again later.`;
            throw new Error(errorMsg);
          }
        } else {
          // Not a retryable error - throw immediately
          console.log(`❌ [RETRY] Non-retryable error on attempt ${attempt}: ${error.message}`);
          throw error;
        }
      }
    }

    if (!response) {
      throw lastError || new Error('Failed to get response from Gemini API');
    }

    // Detailed logging to debug why Gemini refuses to respond
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🔍 [DEBUG] Analyzing Gemini Response Object');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    try {
      // Log response structure
      console.log('📦 Response object keys:', Object.keys(response || {}));

      // Check if response has 'response' property (Vertex AI structure)
      if (response.response) {
        console.log('📦 response.response keys:', Object.keys(response.response || {}));
        console.log('📊 response.response.candidates:', response.response.candidates?.length || 0);

        if (response.response.candidates && response.response.candidates.length > 0) {
          const candidate = response.response.candidates[0];
          console.log('🎯 Candidate 0:');
          console.log('   - finishReason:', candidate.finishReason);
          console.log('   - content:', candidate.content ? 'present' : 'missing');
          console.log('   - safetyRatings:', candidate.safetyRatings ? JSON.stringify(candidate.safetyRatings, null, 2) : 'none');

          if (candidate.content?.parts) {
            console.log('   - content.parts:', candidate.content.parts.length);
            console.log('   - content.parts[0].text length:', candidate.content.parts[0]?.text?.length || 0);
            console.log('   - content.parts[0].text preview:', candidate.content.parts[0]?.text?.substring(0, 100) || 'EMPTY');
          }
        }

        // Check for promptFeedback (safety blocks)
        if (response.response.promptFeedback) {
          console.log('🚨 promptFeedback:', JSON.stringify(response.response.promptFeedback, null, 2));
        }
      }

      // Try to extract text using response.text() function if available
      let extractedText = null;
      if (typeof response.text === 'function') {
        console.log('✅ response.text is a function - calling it...');
        extractedText = response.text();
      } else if (typeof response.response?.text === 'function') {
        console.log('✅ response.response.text is a function - calling it...');
        extractedText = response.response.text();
      } else if (response.text) {
        console.log('✅ response.text is a property - using it...');
        extractedText = response.text;
      } else if (response.response?.text) {
        console.log('✅ response.response.text is a property - using it...');
        extractedText = response.response.text;
      } else {
        console.log('❌ No text extraction method found!');
      }

      console.log('📝 Extracted text length:', extractedText?.length || 0);
      console.log('📝 Extracted text preview:', extractedText?.substring(0, 200) || 'EMPTY/NULL');

    } catch (debugError: any) {
      console.error('❌ Error during response debugging:', debugError.message);
      console.error('   Stack:', debugError.stack);
    }
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // TASK 4: Detailed Token Breakdown Logging with FileSearch support
    const agentName = consultantConfig?.agentName || 'Unknown Agent';
    const systemPromptTokens = estimateTokenCount(systemPrompt);
    const conversationTokens = estimateTokenCount(JSON.stringify(geminiMessages));
    const userMessageTokens = estimateTokenCount(userMessage);

    // FileSearch tokens (if available from groundingMetadata)
    let fileSearchTokens = 0;
    let fileSearchDetails: { type: string; count: number; tokens: number }[] = [];

    // Check for grounding metadata in response (both Vertex AI and Google AI Studio structures)
    const candidates = response?.candidates || response?.response?.candidates;
    if (candidates?.[0]?.groundingMetadata?.groundingChunks) {
      const chunks = candidates[0].groundingMetadata.groundingChunks;
      fileSearchTokens = chunks.reduce((acc: number, chunk: any) => 
        acc + estimateTokenCount(chunk.retrievedContext?.text || ''), 0);

      // Group by source type
      const typeGroups: Record<string, { count: number; tokens: number }> = {};
      for (const chunk of chunks) {
        const uri = chunk.retrievedContext?.uri || '';
        const sourceType = uri.includes('.pdf') ? 'PDF'
          : uri.includes('.docx') ? 'DOCX'
          : uri.includes('.doc') ? 'DOC'
          : uri.includes('.txt') ? 'TXT'
          : uri.includes('.xlsx') ? 'XLSX'
          : uri.includes('.csv') ? 'CSV'
          : 'Other';
        if (!typeGroups[sourceType]) typeGroups[sourceType] = { count: 0, tokens: 0 };
        typeGroups[sourceType].count++;
        typeGroups[sourceType].tokens += estimateTokenCount(chunk.retrievedContext?.text || '');
      }
      fileSearchDetails = Object.entries(typeGroups).map(([type, data]) => ({ type, ...data }));
    }

    const totalInputTokens = systemPromptTokens + conversationTokens + userMessageTokens + fileSearchTokens;

    console.log(`\n📊 [WHATSAPP AI] Token Breakdown for agent "${agentName}":`);
    console.log(`   ├── System Prompt: ${systemPromptTokens.toLocaleString()} tokens`);
    console.log(`   ├── Conversation History: ${conversationTokens.toLocaleString()} tokens`);
    console.log(`   ├── User Message: ${userMessageTokens.toLocaleString()} tokens`);
    if (fileSearchTokens > 0) {
      console.log(`   ├── FileSearch Retrieved: ${fileSearchTokens.toLocaleString()} tokens`);
      for (const detail of fileSearchDetails) {
        console.log(`   │   ├── ${detail.type} (${detail.count} docs): ${detail.tokens.toLocaleString()} tokens`);
      }
    }
    console.log(`   └── TOTAL INPUT: ${totalInputTokens.toLocaleString()} tokens`);

    // Try to extract text with proper error handling
    let aiResponse: string;
    try {
      if (typeof response.response?.text === 'function') {
        aiResponse = response.response.text();
      } else if (typeof response.text === 'function') {
        aiResponse = response.text();
      } else {
        aiResponse = response.text || response.response?.text || "Mi dispiace, non ho potuto generare una risposta.";
      }
    } catch (textError: any) {
      console.error('❌ [ERROR] Failed to extract text from response:', textError.message);
      aiResponse = "Mi dispiace, non ho potuto generare una risposta.";
    }

    // Calculate actual tokens used
    const responseChars = aiResponse.length;
    const estimatedOutputTokens = Math.ceil(responseChars / 4);
    const estimatedTotalTokens = estimatedTotalInput + estimatedOutputTokens;
    const responseTime = endTime - startTime;

    console.log(`\n📊 [GEMINI TOKENS] Utilizzo DOPO la risposta:`);
    console.log(`   ✅ Response: ~${estimatedOutputTokens.toLocaleString()} tokens (${responseChars.toLocaleString()} chars)`);
    console.log(`   🔢 TOTALE (input + output): ~${estimatedTotalTokens.toLocaleString()} tokens`);
    console.log(`   ⏱️  Tempo di risposta: ${responseTime}ms`);
    console.log(`   💰 Costo stimato: $${(estimatedTotalTokens * 0.000002).toFixed(6)} (input + output)`);
    console.log(``);
    console.log(`✅ [STEP 8] Gemini response received: "${aiResponse.substring(0, 100)}..."`);

    console.log(`💾 [STEP 9] Saving AI response to database`);

    // Calculate timing metrics for this message
    const geminiTime = Math.round(endTime - startTime);
    const contextTime = timings.contextBuildEnd > 0
      ? Math.round(timings.contextBuildEnd - timings.contextBuildStart)
      : 0;
    const currentTotalTime = Math.round(performance.now() - timings.requestStart);

    // Step 9: Save AI response with timing metadata
    const [savedMessage] = await db
      .insert(whatsappMessages)
      .values({
        conversationId: conversation.id,
        messageText: aiResponse,
        direction: "outbound",
        sender: "ai",
        isBatched: uniquePending.length > 1,
        batchId: uniquePending.length > 1 ? batchId : null,
        metadata: {
          processingMs: currentTotalTime,
          geminiMs: geminiTime,
          contextMs: contextTime,
        }
      })
      .returning();
    console.log(`✅ [STEP 9] AI response saved with ID: ${savedMessage.id} (timing: ${geminiTime}ms Gemini, ${currentTotalTime}ms total)`);

    // OBJECTION TRACKING DISABLED - Aligned with public share (Dec 2025)

    // Step 9.5: Generate TTS audio response if enabled (Mirror Mode)
    // CRITICAL: TTS generation is fully isolated - any failure falls back to text-only
    let audioMediaUrl: string | null = null;

    // Determine if we should send audio and/or text based on audioResponseMode
    const responseDecision = consultantConfig?.ttsEnabled
      ? shouldRespondWithAudio(consultantConfig.audioResponseMode || 'always_text', clientSentAudio)
      : { sendAudio: false, sendText: true };

    console.log(`🎛️ [AUDIO DECISION] Mode: ${consultantConfig?.audioResponseMode}, ClientSentAudio: ${clientSentAudio} → sendAudio=${responseDecision.sendAudio}, sendText=${responseDecision.sendText}`);

    // Wrap entire TTS flow in isolated try/catch to guarantee text fallback
    if (responseDecision.sendAudio) {
      try {
        console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('🎙️ [TTS GENERATION] Generating voice response with Achernar');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(`📋 Mode: ${consultantConfig.audioResponseMode}`);
        console.log(`🎤 Client sent audio: ${clientSentAudio}`);
        console.log(`📝 Text to convert: ${aiResponse.length} chars`);
        // Get Vertex AI credentials for TTS
        let vertexClient: any = null;
        let vertexProjectId: string = '';
        let vertexLocation: string = '';

        if (currentProvider.type === 'vertex') {
          // Use existing Vertex AI credentials from current provider
          console.log('✅ Using existing Vertex AI credentials from message processor');
          vertexClient = createVertexGeminiClient(
            currentProvider.projectId,
            currentProvider.location,
            currentProvider.credentials,
            'gemini-2.5-pro-tts'
          );
          vertexProjectId = currentProvider.projectId;
          vertexLocation = currentProvider.location;
        } else {
          // Need to get Vertex AI credentials for TTS (Google AI Studio doesn't support TTS)
          console.log('⚠️  Current provider is Google AI Studio - fetching Vertex AI for TTS...');

          // NEW UNIFIED APPROACH: Check SuperAdmin Vertex first, then consultant's own vertexAiSettings
          let foundVertexSettings: { projectId: string; location: string; serviceAccountJson: string } | null = null;

          // 1. Check if consultant can use SuperAdmin Vertex
          const [consultant] = await db
            .select({ useSuperadminVertex: users.useSuperadminVertex })
            .from(users)
            .where(eq(users.id, conversation.consultantId))
            .limit(1);

          if (consultant?.useSuperadminVertex) {
            const [accessRecord] = await db
              .select({ hasAccess: consultantVertexAccess.hasAccess })
              .from(consultantVertexAccess)
              .where(eq(consultantVertexAccess.consultantId, conversation.consultantId))
              .limit(1);

            const hasAccess = accessRecord?.hasAccess ?? true;

            if (hasAccess) {
              const [superadminConfig] = await db
                .select()
                .from(superadminVertexConfig)
                .where(eq(superadminVertexConfig.enabled, true))
                .limit(1);

              if (superadminConfig) {
                console.log('✅ Using SuperAdmin Vertex AI for TTS');
                foundVertexSettings = superadminConfig;
              }
            }
          }

          // 2. Fallback: Check consultant's own vertexAiSettings
          if (!foundVertexSettings) {
            const [consultantVertexSettings] = await db
              .select()
              .from(vertexAiSettings)
              .where(and(
                eq(vertexAiSettings.userId, conversation.consultantId),
                eq(vertexAiSettings.enabled, true)
              ))
              .limit(1);

            if (consultantVertexSettings) {
              console.log('✅ Using consultant Vertex AI for TTS');
              foundVertexSettings = consultantVertexSettings;
            }
          }

          if (!foundVertexSettings || !foundVertexSettings.serviceAccountJson) {
            throw new Error('Vertex AI credentials not configured - TTS requires Vertex AI');
          }

          const credentials = await parseServiceAccountJson(foundVertexSettings.serviceAccountJson);
          vertexClient = createVertexGeminiClient(
            foundVertexSettings.projectId,
            foundVertexSettings.location,
            credentials,
            'gemini-2.5-pro-tts'
          );
          vertexProjectId = foundVertexSettings.projectId;
          vertexLocation = foundVertexSettings.location;
        }

        // Generate TTS audio with Gemini 2.5 Pro TTS (Achernar voice)
        console.log('🤖 Calling generateSpeech with Vertex AI...');
        const ttsStartTime = performance.now();
        const audioBuffer = await generateSpeech({
          text: aiResponse,
          vertexClient: vertexClient,
          projectId: vertexProjectId,
          location: vertexLocation
        });
        const ttsEndTime = performance.now();
        const ttsGenerationMs = Math.round(ttsEndTime - ttsStartTime);

        // Calculate audio duration IMMEDIATELY from WAV buffer (instant, no FFprobe!)
        const audioDuration = calculateWavDuration(audioBuffer);
        console.log(`⏱️ Audio duration: ${audioDuration} seconds (calculated from WAV header)`);
        console.log(`⏱️ TTS generation time: ${ttsGenerationMs}ms`);

        // Ensure uploads/audio directory exists (async)
        const audioDir = path.join(process.cwd(), 'uploads', 'audio');
        await fsPromises.mkdir(audioDir, { recursive: true });

        // Save WAV file first (from TTS service) - ASYNC
        const wavFileName = `twilio-response-${nanoid()}.wav`;
        const wavFilePath = path.join(audioDir, wavFileName);
        await fsPromises.writeFile(wavFilePath, audioBuffer);
        console.log(`✅ WAV file saved: ${wavFilePath}`);

        // Convert WAV to OGG/Opus for WhatsApp compatibility (ASYNC with timeout)
        // WhatsApp only supports: OGG/Opus, AMR, AAC/M4A, MP3 (not WAV)
        const oggFileName = wavFileName.replace('.wav', '.ogg');
        const oggFilePath = path.join(audioDir, oggFileName);

        console.log('🔧 Converting WAV to OGG/Opus for WhatsApp (async)...');
        try {
          await convertWavToOggAsync(wavFilePath, oggFilePath, 120000); // 2 min timeout for production
          console.log(`✅ OGG file created: ${oggFilePath}`);

          // Use OGG file for WhatsApp
          audioMediaUrl = `/uploads/audio/${oggFileName}`;

          // Clean up WAV file (keep only OGG for WhatsApp) - ASYNC
          await fsPromises.unlink(wavFilePath);
          console.log(`🗑️ WAV file deleted (keeping OGG for WhatsApp)`);
        } catch (conversionError: any) {
          console.error(`❌ FFmpeg conversion failed: ${conversionError.message}`);
          console.log(`⚠️ Falling back to WAV file (may not work on WhatsApp)`);
          audioMediaUrl = `/uploads/audio/${wavFileName}`;
        }

        console.log(`✅ Audio ready: ${audioMediaUrl}`);

        // Calculate total time including TTS
        const totalWithTtsMs = Math.round(performance.now() - timings.requestStart);

        // Update saved message with audio metadata AND complete timing
        await db
          .update(whatsappMessages)
          .set({
            mediaType: 'audio',
            mediaUrl: audioMediaUrl,
            metadata: {
              audioGenerated: true,
              audioDuration,
              ttsEngine: 'gemini-2.5-pro-tts',
              voice: 'Achernar',
              // Complete timing breakdown
              processingMs: totalWithTtsMs,
              geminiMs: geminiTime,
              contextMs: contextTime,
              ttsMs: ttsGenerationMs,
            }
          })
          .where(eq(whatsappMessages.id, savedMessage.id));

        console.log(`✅ Message updated with audio metadata (TTS: ${ttsGenerationMs}ms, Total: ${totalWithTtsMs}ms)`);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

      } catch (ttsError: any) {
        // Outer catch: Isolates entire TTS flow - any error falls back to text-only
        console.error('\n❌ [TTS ERROR] Audio generation failed - falling back to text');
        console.error(`   Error: ${ttsError.message}`);
        console.error(`   Stack: ${ttsError.stack}`);
        console.log('   ➡️  Continuing with text-only response (message will still be delivered)...\n');
        audioMediaUrl = null; // Ensure fallback to text
        responseDecision.sendAudio = false;
        responseDecision.sendText = true;
      }
    } else {
      console.log(`\n📝 [TTS SKIP] TTS disabled or not needed (ttsEnabled=${consultantConfig?.ttsEnabled}, mode=${consultantConfig?.audioResponseMode}, clientAudio=${clientSentAudio})\n`);
    }

    console.log(`📤 [STEP 10] Sending WhatsApp message to ${phoneNumber}`);
    // Step 10: Send WhatsApp message based on responseDecision (text, audio, or both)

    // Determine message text:
    // - Full response if sendText=true
    // - Minimal placeholder if sendText=false but audio is being sent (Twilio requires non-empty Body)
    // - Empty string only if nothing is being sent (should not happen)
    const messageText = responseDecision.sendText
      ? aiResponse
      : (responseDecision.sendAudio && audioMediaUrl ? '🎤' : '');

    await sendWhatsAppMessage(
      conversation.consultantId,
      phoneNumber,
      messageText,
      savedMessage.id,
      {
        conversationId: conversation.id,
        mediaUrl: audioMediaUrl
      }
    );

    // Log what was sent
    const sentTypes = [];
    if (responseDecision.sendText && aiResponse) sentTypes.push('text');
    if (responseDecision.sendAudio && audioMediaUrl) sentTypes.push('audio');
    console.log(`✅ [STEP 10] WhatsApp message sent: ${sentTypes.join(' + ') || 'empty'}`);

    // Step 10.5: Automatic appointment booking/modification/cancellation
    // CRITICAL: Booking logic only applies to LEADS when bookingEnabled=true
    // Existing clients (effectiveUserId truthy) skip appointment booking (they use web interface)
    // MANDATORY CHECK: Agent MUST have its own calendar connected (no fallback to consultant)
    const agentHasCalendar = !!consultantConfig?.googleRefreshToken;
    
    // ═══════════════════════════════════════════════════════════════════════════════
    // 🔍 LOG DECISIONE ANALISI BOOKING - Step 1: Pre-requisiti
    // ═══════════════════════════════════════════════════════════════════════════════
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🔍 [BOOKING DECISION] Valutazione pre-requisiti per analisi booking');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`   📋 PRE-REQUISITI:`);
    console.log(`   ├── bookingEnabled: ${consultantConfig?.bookingEnabled !== false ? '✅ SÌ' : '❌ NO (disabilitato)'}`);
    console.log(`   ├── agentHasCalendar: ${agentHasCalendar ? '✅ SÌ (Google Calendar connesso)' : '❌ NO (calendario non connesso)'}`);
    console.log(`   ├── effectiveUserId: ${effectiveUserId ? `❌ PRESENTE (${effectiveUserId}) - è un cliente esistente, skip booking` : '✅ ASSENTE (è un lead)'}`);
    console.log(`   └── Agent: ${consultantConfig?.agentName || 'Unknown'}`);
    
    const willAnalyzeBooking = consultantConfig?.bookingEnabled !== false && agentHasCalendar && !effectiveUserId;
    console.log(`   🎯 DECISIONE: ${willAnalyzeBooking ? '✅ PROCEDERÀ con analisi booking' : '❌ SKIP analisi booking'}`);
    if (!willAnalyzeBooking) {
      const skipReasons: string[] = [];
      if (consultantConfig?.bookingEnabled === false) skipReasons.push('booking disabilitato');
      if (!agentHasCalendar) skipReasons.push('calendario non connesso');
      if (effectiveUserId) skipReasons.push('utente è cliente esistente');
      console.log(`   ⚠️ MOTIVO SKIP: ${skipReasons.join(', ')}`);
    }
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    if (!agentHasCalendar && consultantConfig?.bookingEnabled !== false) {
      console.log(`⚠️ [BOOKING DISABLED] Agent "${consultantConfig?.agentName}" has NO Google Calendar connected`);
      console.log(`   → Booking is enabled but calendar is missing - skipping all appointment logic`);
      console.log(`   → To enable booking, connect Google Calendar in agent settings`);
    }
    
    if (consultantConfig?.bookingEnabled !== false && agentHasCalendar && !effectiveUserId) {
      let retrievedSlots: any[] = [];
      let alreadyConfirmed = false;
      let existingBookingForModification: any = null;

      // STEP 1: Check if this conversation already has a confirmed appointment
      const [existingBooking] = await db
        .select()
        .from(appointmentBookings)
        .where(
          and(
            eq(appointmentBookings.conversationId, conversation.id),
            eq(appointmentBookings.status, 'confirmed')
          )
        )
        .limit(1);

      // Cast lastCompletedAction for type-safety
      let lastCompletedAction: LastCompletedAction | null = null;

      if (existingBooking) {
        alreadyConfirmed = true;
        existingBookingForModification = existingBooking;
        lastCompletedAction = existingBooking.lastCompletedAction as LastCompletedAction | null;
        console.log(`✅ [APPOINTMENT MANAGEMENT] Appointment already confirmed for this conversation`);
        console.log(`   🆔 Booking ID: ${existingBooking.id}`);
        console.log(`   📅 Date: ${existingBooking.appointmentDate} ${existingBooking.appointmentTime}`);
        console.log(`   🔍 Checking for MODIFICATION or CANCELLATION intent...`);
      } else {
        // STEP 2: Only retrieve slots if no confirmed appointment exists
        const [proposedSlots] = await db
          .select()
          .from(proposedAppointmentSlots)
          .where(
            and(
              eq(proposedAppointmentSlots.conversationId, conversation.id),
              eq(proposedAppointmentSlots.usedForBooking, false),
              sql`${proposedAppointmentSlots.expiresAt} > NOW()`
            )
          )
          .orderBy(desc(proposedAppointmentSlots.proposedAt))
          .limit(1);

        if (proposedSlots) {
          retrievedSlots = proposedSlots.slots as any[];
          console.log(`💾 [APPOINTMENT BOOKING] Retrieved ${retrievedSlots.length} proposed slots from database`);
        }
      }

      // Proceed with extraction for NEW bookings OR MODIFICATIONS/CANCELLATIONS
      // ALLINEATO A PUBLIC SHARE: Non richiediamo più slot salvati per nuovi booking
      // ACCUMULATOR PATTERN: Always extract to progressively accumulate booking data
      if (true) {

        // ACCUMULATOR: Always proceed with extraction - no pre-check skip
        // This ensures we capture all booking data progressively across messages
        console.log(`   ✅ [ACCUMULATOR] Always proceeding with booking analysis (no pre-check skip)`);

        if (alreadyConfirmed) {
            console.log('📅 [APPOINTMENT MANAGEMENT] Existing appointment detected - checking for MODIFY/CANCEL intent');
          } else {
            console.log('📅 [APPOINTMENT BOOKING] Attempting to extract appointment confirmation from lead message');
          }
          try {
            // Get last 20 messages to have full context (not just current batch)
            // CRITICAL: Filter by lastResetAt to prevent AI from seeing pre-reset data
            const recentMessagesConditions = [eq(whatsappMessages.conversationId, conversation.id)];

            if (conversation.lastResetAt) {
              console.log(`🔄 [EXTRACTION] Filtering messages after reset: ${conversation.lastResetAt}`);
              recentMessagesConditions.push(sql`${whatsappMessages.createdAt} > ${conversation.lastResetAt}`);
            }

            const recentMessages = await db
              .select()
              .from(whatsappMessages)
              .where(and(...recentMessagesConditions))
              .orderBy(desc(whatsappMessages.createdAt))
              .limit(20);

            console.log(`📊 [EXTRACTION] Retrieved ${recentMessages.length} messages for extraction${conversation.lastResetAt ? ' (after reset)' : ''}`);

            // Build conversation context for extraction
            // IMPORTANTE: Usa .slice().reverse() per NON mutare l'array originale
            const conversationContext = recentMessages
              .slice()
              .reverse()
              .map(m => `${m.sender === 'client' ? 'LEAD' : 'AI'}: ${m.messageText}`)
              .join('\n');

            // SPLIT: Different extraction methods for MODIFY/CANCEL vs NEW BOOKING
            if (alreadyConfirmed) {
            // Use AI to extract appointment intent and data from ENTIRE recent conversation
            // MODIFY/CANCEL prompt for existing appointments
            const extractionPrompt = `
Analizza questa conversazione recente di un lead che ha GIÀ un appuntamento confermato:

APPUNTAMENTO ESISTENTE:
- Data: ${existingBookingForModification.appointmentDate}
- Ora: ${existingBookingForModification.appointmentTime}
- Email: ${existingBookingForModification.clientEmail}
- Telefono: ${existingBookingForModification.clientPhone}

CONVERSAZIONE RECENTE:
${conversationContext}

TASK: Identifica se il lead vuole MODIFICARE, CANCELLARE, AGGIUNGERE INVITATI o solo CONVERSARE sull'appuntamento esistente.

RISPONDI SOLO con un oggetto JSON nel seguente formato:
{
  "intent": "MODIFY" | "CANCEL" | "ADD_ATTENDEES" | "NONE",
  "newDate": "YYYY-MM-DD" (solo se intent=MODIFY, altrimenti null),
  "newTime": "HH:MM" (solo se intent=MODIFY, altrimenti null),
  "attendees": ["email1@example.com", "email2@example.com"] (solo se intent=ADD_ATTENDEES, altrimenti []),
  "confirmedTimes": numero (1 per MODIFY se confermato, 2 per CANCEL se confermato 2 volte, 0 se non confermato o ADD_ATTENDEES),
  "confidence": "high/medium/low"
}

ESEMPI:

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Esempio 1 - MODIFICA (proposta, NON ancora confermata):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
LEAD: possiamo modificarlo a martedì alle 16:00?
AI: Perfetto! Vuoi spostare l'appuntamento a martedì 5 novembre alle 16:00? Confermi che va bene?

→ {"intent": "MODIFY", "newDate": "2025-11-05", "newTime": "16:00", "attendees": [], "confirmedTimes": 0, "confidence": "high"}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Esempio 2 - MODIFICA (CONFERMATA dal lead):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
LEAD: possiamo spostarlo alle 18?
AI: Certo! Vuoi spostarlo alle 18:00? Confermi?
LEAD: sì va bene

→ {"intent": "MODIFY", "newDate": "${existingBookingForModification.appointmentDate}", "newTime": "18:00", "attendees": [], "confirmedTimes": 1, "confidence": "high"}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Esempio 2b - MODIFICA DIRETTA/IMPERATIVA (NON è ancora confermata):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Quando il lead usa una forma IMPERATIVA o una richiesta DIRETTA, è solo una RICHIESTA.
L'AI deve SEMPRE chiedere conferma esplicita prima che il sistema esegua la modifica.

LEAD: mettilo alle 10:00
→ {"intent": "MODIFY", "newDate": "${existingBookingForModification.appointmentDate}", "newTime": "10:00", "attendees": [], "confirmedTimes": 0, "confidence": "high"}

LEAD: me lo puoi mettere alle 10?
→ {"intent": "MODIFY", "newDate": "${existingBookingForModification.appointmentDate}", "newTime": "10:00", "attendees": [], "confirmedTimes": 0, "confidence": "high"}

LEAD: spostalo a domani alle 14
→ {"intent": "MODIFY", "newDate": "[data domani]", "newTime": "14:00", "attendees": [], "confirmedTimes": 0, "confidence": "high"}

⚠️ NOTA: Le forme imperative ("mettilo", "spostalo", "cambialo") e le richieste dirette 
("me lo metti", "puoi metterlo") sono RICHIESTE, non conferme. confirmedTimes=0.
Solo risposte esplicite come "sì", "confermo", "va bene" dopo che l'AI ha chiesto conferma 
contano come conferma (confirmedTimes=1).

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Esempio 3 - CANCELLAZIONE (prima conferma):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
LEAD: devo disdire l'appuntamento
AI: [messaggio persuasivo] Quindi, mi confermi che vuoi davvero cancellare?
LEAD: sì voglio cancellare

→ {"intent": "CANCEL", "newDate": null, "newTime": null, "attendees": [], "confirmedTimes": 1, "confidence": "high"}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Esempio 4 - CANCELLAZIONE (CONFERMATA 2 volte):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
LEAD: voglio cancellare
AI: [persuasione] Confermi che vuoi cancellare?
LEAD: sì
AI: Ok, capisco. Solo per essere sicuri: confermi che vuoi procedere con la cancellazione?
LEAD: sì confermo

→ {"intent": "CANCEL", "newDate": null, "newTime": null, "attendees": [], "confirmedTimes": 2, "confidence": "high"}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Esempio 5 - AGGIUNTA INVITATI (1 email):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
LEAD: Mi aggiungi mario.rossi@example.com agli invitati?
AI: Certo! Aggiungo subito mario.rossi@example.com agli invitati.

→ {"intent": "ADD_ATTENDEES", "newDate": null, "newTime": null, "attendees": ["mario.rossi@example.com"], "confirmedTimes": 0, "confidence": "high"}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Esempio 6 - AGGIUNTA INVITATI (multipli):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
LEAD: Aggiungi anche il mio socio chianettalessio1@gmail.com e mia moglie laura@test.it
AI: Perfetto! Aggiungo chianettalessio1@gmail.com e laura@test.it agli invitati.

→ {"intent": "ADD_ATTENDEES", "newDate": null, "newTime": null, "attendees": ["chianettalessio1@gmail.com", "laura@test.it"], "confirmedTimes": 0, "confidence": "high"}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Esempio 7 - AGGIUNTA INVITATI (con contesto):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
LEAD: invita anche giovanni.verdi@company.com è il mio collega
AI: Ottimo! Aggiungo giovanni.verdi@company.com all'appuntamento.

→ {"intent": "ADD_ATTENDEES", "newDate": null, "newTime": null, "attendees": ["giovanni.verdi@company.com"], "confirmedTimes": 0, "confidence": "high"}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Esempio 8 - NESSUNA AZIONE (solo conversazione):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
LEAD: grazie per l'appuntamento, a presto!

→ {"intent": "NONE", "newDate": null, "newTime": null, "attendees": [], "confirmedTimes": 0, "confidence": "high"}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🗓️ DATA CORRENTE: ${new Date().toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' })}

⚠️ REGOLE:
1. intent="MODIFY" solo se il lead vuole cambiare data/ora
2. intent="CANCEL" solo se vuole cancellare/disdire
3. intent="ADD_ATTENDEES" solo se vuole aggiungere invitati/partecipanti all'appuntamento
4. intent="NONE" per qualsiasi altra conversazione
5. Se cambia solo l'ora, newDate = data esistente
6. Estrai le nuove date/ore dal contesto della conversazione
7. Per ADD_ATTENDEES: estrai TUTTE le email valide menzionate e mettile nell'array "attendees"
8. IMPORTANTE: estrai solo email valide in formato corretto (es: utente@dominio.com, nome.cognome@azienda.it)
9. Ignora testo che sembra email ma non ha @, o che non ha un dominio valido
10. Riconosci frasi come: "aggiungi", "invita anche", "metti anche", "mi aggiungi", "inserisci" seguiti da email
11. Per MODIFY e CANCEL: attendees deve essere sempre [] (array vuoto)
12. Per ADD_ATTENDEES: attendees contiene array di email da aggiungere
13. confirmedTimes = numero di volte che il lead ha ESPLICITAMENTE confermato (conta "sì", "confermo", "va bene", ecc.)
14. Per MODIFY: confirmedTimes = 1 SOLO quando il lead conferma esplicitamente DOPO che l'AI ha chiesto conferma
15. Per CANCEL: confirmedTimes = 1 o 2 in base a quante volte ha confermato esplicitamente
16. Per ADD_ATTENDEES: confirmedTimes = 0 (nessuna conferma necessaria)
17. Se non ha ancora confermato esplicitamente: confirmedTimes = 0
18. IMPORTANTE: Le richieste dirette ("mettilo alle 10", "spostalo alle 14") NON contano come conferma - confirmedTimes=0 finché il lead non conferma esplicitamente
`;

            console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            console.log('🔍 [STEP 2] Extracting Appointment Data from Conversation');
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            console.log(`📚 Analyzing last ${recentMessages.length} messages for appointment details...`);
            console.log(`🤖 Using AI model: gemini-2.5-flash`);

            // Retry with key rotation for appointment extraction
            const maxExtractionRetries = 3;
            let extractionKeyId = keyInfo.keyId;
            let extractionResponse: any;

            for (let attempt = 1; attempt <= maxExtractionRetries; attempt++) {
              try {
                // Validate Vertex AI credentials
                const hasVertexCredentials = aiProvider.type === 'vertex' &&
                  aiProvider.projectId &&
                  aiProvider.location &&
                  aiProvider.credentials;

                // Determine effective provider for this attempt
                const useVertex = aiProvider.type === 'vertex' && hasVertexCredentials;
                console.log(`🔄 [EXTRACTION] Attempt ${attempt}/${maxExtractionRetries} with provider: ${useVertex ? 'vertex' : 'studio'}`);

                if (useVertex) {
                  // Use Vertex AI
                  const vertexClient = createVertexGeminiClient(
                    aiProvider.projectId!,
                    aiProvider.location!,
                    aiProvider.credentials!
                  );

                  extractionResponse = await vertexClient.generateContent({
                    contents: [{ role: "user", parts: [{ text: extractionPrompt }] }],
                  });
                } else {
                  // Use Google AI Studio (fallback)
                  if (aiProvider.type === 'vertex' && !hasVertexCredentials) {
                    console.warn(`⚠️ [EXTRACTION] Vertex AI requested but credentials missing - using Google AI Studio fallback`);
                  }

                  // Rotate API key on retry attempts
                  let extractionApiKey = apiKey;
                  if (attempt > 1) {
                    const newKeyInfo = await selectApiKey(conversation, extractionKeyId);
                    extractionApiKey = newKeyInfo.apiKey;
                    extractionKeyId = newKeyInfo.keyId;
                    console.log(`🔑 [EXTRACTION] Rotated to new API key: ${extractionKeyId.substring(0, 8)}...`);
                  }

                  const extractionAi = new GoogleGenAI({ apiKey: extractionApiKey });
                  extractionResponse = await extractionAi.models.generateContent({
                    model: GEMINI_3_MODEL,
                    contents: [{ role: "user", parts: [{ text: extractionPrompt }] }],
                  });
                }

                console.log(`✅ [EXTRACTION] Success on attempt ${attempt}!`);
                break; // Success - exit retry loop

              } catch (extractionError: any) {
                const is503 = extractionError.status === 503 ||
                  extractionError.message?.includes('overloaded') ||
                  extractionError.message?.includes('UNAVAILABLE');

                if (is503 && attempt < maxExtractionRetries) {
                  console.log(`⚠️ [EXTRACTION] API overloaded (503) on attempt ${attempt}`);
                  await markKeyAsFailed(extractionKeyId);

                  const backoffMs = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
                  console.log(`⏱️ [EXTRACTION] Waiting ${backoffMs}ms before rotating...`);
                  await new Promise(resolve => setTimeout(resolve, backoffMs));
                } else {
                  // Final attempt or non-503 error - throw to outer catch
                  console.error(`❌ [EXTRACTION] Failed after ${attempt} attempt(s): ${extractionError.message}`);
                  throw extractionError;
                }
              }
            }

            if (!extractionResponse) {
              throw new Error('Failed to extract appointment data after all retries');
            }

            let extractionText: string;
            try {
              if (typeof extractionResponse.text === 'function') {
                extractionText = extractionResponse.text();
              } else if (typeof extractionResponse.response?.text === 'function') {
                extractionText = extractionResponse.response.text();
              } else if (extractionResponse.text) {
                extractionText = extractionResponse.text;
              } else if (extractionResponse.response?.text) {
                extractionText = extractionResponse.response.text;
              } else if (extractionResponse.response?.candidates?.[0]?.content?.parts?.[0]?.text) {
                extractionText = extractionResponse.response.candidates[0].content.parts[0].text;
              } else if (extractionResponse.candidates?.[0]?.content?.parts?.[0]?.text) {
                extractionText = extractionResponse.candidates[0].content.parts[0].text;
              } else {
                extractionText = "";
              }
            } catch (textError: any) {
              console.error('❌ [EXTRACTION ERROR] Failed to extract text from response:', textError.message);
              extractionText = "";
            }
            console.log(`\n💬 AI Raw Response:\n${extractionText.substring(0, 200)}${extractionText.length > 200 ? '...' : ''}\n`);

            // Parse JSON from AI response
            const jsonMatch = extractionText.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              const extracted = JSON.parse(jsonMatch[0]);

              // Check if this is MODIFY/CANCEL intent (for existing appointments) or booking confirmation
              if (alreadyConfirmed && extracted.intent) {
                // GESTIONE MODIFICA/CANCELLAZIONE APPUNTAMENTO ESISTENTE
                console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
                console.log('📊 [APPOINTMENT MANAGEMENT] Intent Detection Results');
                console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
                console.log(`🎯 Intent: ${extracted.intent}`);
                console.log(`📅 New Date: ${extracted.newDate || 'N/A'}`);
                console.log(`🕐 New Time: ${extracted.newTime || 'N/A'}`);
                console.log(`💯 Confidence: ${extracted.confidence.toUpperCase()}`);
                console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

                if (extracted.intent === 'MODIFY' && extracted.newDate && extracted.newTime) {
                  // MODIFICA APPUNTAMENTO - RICHIEDE 1 CONFERMA
                  console.log('\n🔄 [MODIFY APPOINTMENT] Starting modification process...');

                  // CHECK ANTI-DUPLICATO: Verifica se questa azione è già stata completata di recente
                  const modifyDetails: ActionDetails = {
                    newDate: extracted.newDate,
                    newTime: extracted.newTime
                  };
                  if (isActionAlreadyCompleted(lastCompletedAction, 'MODIFY', modifyDetails)) {
                    console.log(`   ⏭️ [MODIFY APPOINTMENT] Skipping - same modification already completed recently`);
                    return;
                  }

                  // ✅ CHECK CONFERMA: Esegui SOLO se ha confermato almeno 1 volta
                  if (!extracted.confirmedTimes || extracted.confirmedTimes < 1) {
                    console.log(`⚠️ [MODIFY APPOINTMENT] Insufficient confirmations (${extracted.confirmedTimes || 0}/1)`);
                    console.log('   AI should ask for confirmation via prompt');
                    console.log('   Skipping modification - waiting for confirmation\n');
                    // NON eseguire - lascia che AI continui il flusso di conferma via prompt
                    return;
                  }

                  console.log(`✅ [MODIFY APPOINTMENT] Confirmed ${extracted.confirmedTimes} time(s) - proceeding with modification`);

                  // Get settings for timezone and duration FROM AGENT (not consultant)
                  const [agentForModify] = await db
                    .select()
                    .from(consultantWhatsappConfig)
                    .where(eq(consultantWhatsappConfig.id, conversation.agentConfigId!))
                    .limit(1);

                  const timezone = agentForModify?.availabilityTimezone || "Europe/Rome";
                  const duration = agentForModify?.availabilityAppointmentDuration || 60;
                  console.log(`   📅 [MODIFY] Using AGENT settings: tz=${timezone}, duration=${duration}min`);

                  // Update Google Calendar event if exists
                  if (existingBookingForModification.googleEventId) {
                    try {
                      const success = await updateGoogleCalendarEvent(
                        conversation.consultantId,
                        existingBookingForModification.googleEventId,
                        {
                          startDate: extracted.newDate,
                          startTime: extracted.newTime,
                          duration: duration,
                          timezone: timezone
                        },
                        conversation.agentConfigId || undefined  // Use agent's calendar
                      );

                      if (success) {
                        console.log('✅ [MODIFY APPOINTMENT] Google Calendar event updated successfully');
                      }
                    } catch (gcalError: any) {
                      console.error('⚠️ [MODIFY APPOINTMENT] Failed to update Google Calendar:', gcalError.message);
                    }
                  }

                  // Calculate new end time
                  const [startHour, startMinute] = extracted.newTime.split(':').map(Number);
                  const totalMinutes = startHour * 60 + startMinute + duration;
                  const endHour = Math.floor(totalMinutes / 60) % 24;
                  const endMinute = totalMinutes % 60;
                  const formattedEndTime = `${endHour.toString().padStart(2, '0')}:${endMinute.toString().padStart(2, '0')}`;

                  // Update database with lastCompletedAction to prevent duplicates
                  await db
                    .update(appointmentBookings)
                    .set({
                      appointmentDate: extracted.newDate,
                      appointmentTime: extracted.newTime,
                      appointmentEndTime: formattedEndTime,
                      lastCompletedAction: {
                        type: 'MODIFY' as const,
                        completedAt: new Date().toISOString(),
                        triggerMessageId: conversation.id,
                        details: {
                          oldDate: existingBookingForModification.appointmentDate,
                          oldTime: existingBookingForModification.appointmentTime,
                          newDate: extracted.newDate,
                          newTime: extracted.newTime
                        }
                      }
                    })
                    .where(eq(appointmentBookings.id, existingBookingForModification.id));

                  console.log('💾 [MODIFY APPOINTMENT] Database updated with lastCompletedAction');

                  // Send confirmation message
                  const modifyMessage = `✅ APPUNTAMENTO MODIFICATO!

📅 Nuovo appuntamento:
🗓️ Data: ${extracted.newDate.split('-').reverse().join('/')}
🕐 Orario: ${extracted.newTime}

Ti ho aggiornato l'invito al calendario all'indirizzo ${existingBookingForModification.clientEmail}. Controlla la tua inbox! 📬

Ci vediamo alla nuova data! 🚀`;

                  const [modifyMsg] = await db
                    .insert(whatsappMessages)
                    .values({
                      conversationId: conversation.id,
                      messageText: modifyMessage,
                      direction: "outbound",
                      sender: "ai",
                    })
                    .returning();

                  await sendWhatsAppMessage(
                    conversation.consultantId,
                    phoneNumber,
                    modifyMessage,
                    modifyMsg.id,
                    { conversationId: conversation.id }
                  );

                  console.log('✅ [MODIFY APPOINTMENT] Modification complete and confirmation sent!');

                } else if (extracted.intent === 'CANCEL') {
                  // CANCELLAZIONE APPUNTAMENTO - RICHIEDE 2 CONFERME
                  console.log('\n🗑️ [CANCEL APPOINTMENT] Starting cancellation process...');

                  // CHECK ANTI-DUPLICATO: Verifica se questa azione è già stata completata di recente
                  if (isActionAlreadyCompleted(lastCompletedAction, 'CANCEL')) {
                    console.log(`   ⏭️ [CANCEL APPOINTMENT] Skipping - action already completed recently`);
                    return;
                  }

                  // ✅ CHECK CONFERME: Esegui SOLO se ha confermato 2 volte
                  if (!extracted.confirmedTimes || extracted.confirmedTimes < 2) {
                    console.log(`⚠️ [CANCEL APPOINTMENT] Insufficient confirmations (${extracted.confirmedTimes || 0}/2)`);
                    console.log('   AI should continue asking for confirmation via prompt');
                    console.log('   Skipping cancellation - waiting for 2 confirmations\n');
                    // NON eseguire - lascia che AI continui il flusso di conferma via prompt
                    return;
                  }

                  console.log(`✅ [CANCEL APPOINTMENT] Confirmed ${extracted.confirmedTimes} times - proceeding with cancellation`);

                  // Delete from Google Calendar if exists
                  let calendarDeleteSuccess = true;
                  if (existingBookingForModification.googleEventId) {
                    try {
                      const success = await deleteGoogleCalendarEvent(
                        conversation.consultantId,
                        existingBookingForModification.googleEventId,
                        conversation.agentConfigId || undefined  // Use agent's calendar
                      );

                      if (success) {
                        console.log('✅ [CANCEL APPOINTMENT] Google Calendar event deleted successfully');
                      } else {
                        console.log('⚠️ [CANCEL APPOINTMENT] Failed to delete from Google Calendar');
                        calendarDeleteSuccess = false;
                      }
                    } catch (gcalError: any) {
                      console.error('⚠️ [CANCEL APPOINTMENT] Failed to delete from Google Calendar:', gcalError.message);
                      calendarDeleteSuccess = false;
                    }
                  }

                  // Update database status to cancelled with lastCompletedAction
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

                  console.log('💾 [CANCEL APPOINTMENT] Database updated with lastCompletedAction');

                  // Send confirmation message
                  const cancelMessage = calendarDeleteSuccess
                    ? `✅ APPUNTAMENTO CANCELLATO

Ho cancellato il tuo appuntamento del ${existingBookingForModification.appointmentDate.split('-').reverse().join('/')} alle ${existingBookingForModification.appointmentTime}.

Se in futuro vorrai riprogrammare, sarò qui per aiutarti! 😊`
                    : `⚠️ APPUNTAMENTO CANCELLATO (verifica calendario)

Ho cancellato il tuo appuntamento del ${existingBookingForModification.appointmentDate.split('-').reverse().join('/')} alle ${existingBookingForModification.appointmentTime} dal sistema.

⚠️ Nota: C'è stato un problema nell'aggiornamento del tuo Google Calendar. Per favore, verifica manualmente che l'evento sia stato rimosso dal tuo calendario.

Se vuoi riprogrammare in futuro, scrivimi! 😊`;

                  const [cancelMsg] = await db
                    .insert(whatsappMessages)
                    .values({
                      conversationId: conversation.id,
                      messageText: cancelMessage,
                      direction: "outbound",
                      sender: "ai",
                    })
                    .returning();

                  await sendWhatsAppMessage(
                    conversation.consultantId,
                    phoneNumber,
                    cancelMessage,
                    cancelMsg.id,
                    { conversationId: conversation.id }
                  );

                  console.log('✅ [CANCEL APPOINTMENT] Cancellation complete and confirmation sent!');

                } else if (extracted.intent === 'ADD_ATTENDEES' && extracted.attendees && extracted.attendees.length > 0) {
                  // AGGIUNTA INVITATI - NESSUNA CONFERMA NECESSARIA
                  console.log('\n👥 [ADD ATTENDEES] Starting add attendees process...');

                  // CHECK ANTI-DUPLICATO: Verifica se questa azione è già stata completata di recente
                  const addAttendeesDetails: ActionDetails = {
                    attendees: extracted.attendees
                  };
                  if (isActionAlreadyCompleted(lastCompletedAction, 'ADD_ATTENDEES', addAttendeesDetails)) {
                    console.log(`   ⏭️ [ADD ATTENDEES] Skipping - same attendees already added recently`);
                    return;
                  }

                  console.log('   ✅ No confirmation required for adding attendees - proceeding directly');
                  console.log(`   📧 Attendees to add: ${extracted.attendees.join(', ')}`);

                  if (existingBookingForModification.googleEventId) {
                    try {
                      const result = await addAttendeesToGoogleCalendarEvent(
                        conversation.consultantId,
                        existingBookingForModification.googleEventId,
                        extracted.attendees,
                        conversation.agentConfigId || undefined  // Use agent's calendar
                      );

                      console.log(`✅ [ADD ATTENDEES] Google Calendar updated - ${result.added} added, ${result.skipped} already invited`);

                      // Send confirmation message
                      const addAttendeesMessage = result.added > 0
                        ? `✅ INVITATI AGGIUNTI!

Ho aggiunto ${result.added} ${result.added === 1 ? 'invitato' : 'invitati'} all'appuntamento del ${existingBookingForModification.appointmentDate.split('-').reverse().join('/')} alle ${existingBookingForModification.appointmentTime}.

${result.skipped > 0 ? `ℹ️ ${result.skipped} ${result.skipped === 1 ? 'era già invitato' : 'erano già invitati'}.\n\n` : ''}📧 Gli inviti Google Calendar sono stati inviati automaticamente! 📬`
                        : `ℹ️ Tutti gli invitati sono già stati aggiunti all'appuntamento del ${existingBookingForModification.appointmentDate.split('-').reverse().join('/')} alle ${existingBookingForModification.appointmentTime}. 

Nessuna modifica necessaria! ✅`;

                      const [addMsg] = await db
                        .insert(whatsappMessages)
                        .values({
                          conversationId: conversation.id,
                          messageText: addAttendeesMessage,
                          direction: "outbound",
                          sender: "ai",
                        })
                        .returning();

                      await sendWhatsAppMessage(
                        conversation.consultantId,
                        phoneNumber,
                        addAttendeesMessage,
                        addMsg.id,
                        { conversationId: conversation.id }
                      );

                      // Save lastCompletedAction to prevent duplicates
                      await db
                        .update(appointmentBookings)
                        .set({
                          lastCompletedAction: {
                            type: 'ADD_ATTENDEES' as const,
                            completedAt: new Date().toISOString(),
                            triggerMessageId: conversation.id,
                            details: {
                              attendeesAdded: extracted.attendees
                            }
                          }
                        })
                        .where(eq(appointmentBookings.id, existingBookingForModification.id));

                      console.log('✅ [ADD ATTENDEES] Confirmation message sent with lastCompletedAction saved!');

                    } catch (gcalError: any) {
                      console.error('⚠️ [ADD ATTENDEES] Failed to add attendees to Google Calendar');
                      console.error(`   Event ID: ${existingBookingForModification.googleEventId}`);
                      console.error(`   Attendees: ${extracted.attendees?.join(', ') || 'none'}`);
                      console.error(`   Error type: ${gcalError?.name || 'Unknown'}`);
                      console.error(`   Error message: ${gcalError?.message || gcalError}`);
                      if (gcalError?.stack) {
                        console.error(`   Stack trace:\n${gcalError.stack}`);
                      }

                      // Send error message
                      const errorMessage = `⚠️ Mi dispiace, ho riscontrato un errore nell'aggiungere gli invitati al calendario.

Per favore riprova o aggiungili manualmente dal tuo Google Calendar. 🙏`;

                      const [errorMsg] = await db
                        .insert(whatsappMessages)
                        .values({
                          conversationId: conversation.id,
                          messageText: errorMessage,
                          direction: "outbound",
                          sender: "ai",
                        })
                        .returning();

                      await sendWhatsAppMessage(
                        conversation.consultantId,
                        phoneNumber,
                        errorMessage,
                        errorMsg.id,
                        { conversationId: conversation.id }
                      );
                    }
                  } else {
                    console.log('⚠️ [ADD ATTENDEES] No Google Event ID found - cannot add attendees');
                  }

                } else {
                  // NONE - just conversation, no action needed
                  console.log('💬 [APPOINTMENT MANAGEMENT] No modification/cancellation/add attendees intent detected - continuing normal conversation');
                }

              }
            } // end if (jsonMatch)
            } // end if (alreadyConfirmed) - MODIFY/CANCEL extraction block
            else {
              // ═══════════════════════════════════════════════════════════════════════════════
              // NUOVA PRENOTAZIONE - Allineato a public-share-router.ts
              // Usa extractBookingDataFromConversation() invece del prompt inline
              // ═══════════════════════════════════════════════════════════════════════════════
              console.log('📅 [NEW BOOKING] Using extractBookingDataFromConversation() - aligned with public-share-router.ts');
              
              // Converti messaggi in formato ConversationMessage[] (come public-share-router.ts)
              // IMPORTANTE: Usa .slice().reverse() per NON mutare l'array originale
              const conversationMessages: ConversationMessage[] = recentMessages
                .slice()
                .reverse()
                .map(m => ({
                  sender: m.sender === 'client' ? 'client' as const : 'ai' as const,
                  messageText: m.messageText || ''
                }));
              
              console.log(`   📚 Analyzing ${conversationMessages.length} messages for new booking...`);
              
              // Get AI provider for booking extraction (aligned with public-share-router.ts)
              const bookingAiProvider = await getAIProvider(conversation.consultantId, conversation.consultantId);
              
              // Estrai dati booking dalla conversazione usando il servizio centralizzato
              // ACCUMULATOR PATTERN: Passa conversationId per accumulare dati progressivamente
              const extracted = await extractBookingDataFromConversation(
                conversationMessages,
                undefined, // Nessun booking esistente
                bookingAiProvider.client, // AI client from getAIProvider (aligned with public-share)
                'Europe/Rome',
                undefined, // providerName
                {
                  conversationId: conversation.id,
                  consultantId: conversation.consultantId,
                }
              );
              
              if (extracted && 'isConfirming' in extracted) {
                const extractionResult = extracted as BookingExtractionResult;
                
                // ═══════════════════════════════════════════════════════════════════════════════
                // 🔍 LOG VALIDAZIONE CAMPI ESTRATTI - Analisi dettagliata di ogni campo
                // ═══════════════════════════════════════════════════════════════════════════════
                console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
                console.log('📊 [STEP 3] Data Extraction Results');
                console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
                console.log(`🎯 Confirmation Status: ${extractionResult.isConfirming ? '✅ YES' : '❌ NO'}`);
                console.log(`📅 Date:     ${extractionResult.date ? `✅ ${extractionResult.date}` : '❌ MISSING'}`);
                console.log(`🕐 Time:     ${extractionResult.time ? `✅ ${extractionResult.time}` : '❌ MISSING'}`);
                console.log(`📞 Phone:    ${extractionResult.phone ? `✅ ${extractionResult.phone}` : '❌ MISSING'}`);
                console.log(`📧 Email:    ${extractionResult.email ? `✅ ${extractionResult.email}` : '❌ MISSING'}`);
                console.log(`💯 Confidence: ${extractionResult.confidence.toUpperCase()}`);
                console.log(`✔️ Complete Data: ${extractionResult.hasAllData ? '✅ YES - Ready to book!' : '❌ NO - Missing fields'}`);
                console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
                
                // ═══════════════════════════════════════════════════════════════════════════════
                // 🔍 LOG VALIDAZIONE DETTAGLIATA DI OGNI CAMPO
                // ═══════════════════════════════════════════════════════════════════════════════
                console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
                console.log('🔬 [FIELD VALIDATION] Validazione dettagliata di ogni campo');
                console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
                
                // Validazione DATE
                const dateValue = extractionResult.date;
                const datePattern = /^\d{4}-\d{2}-\d{2}$/;
                const dateFormatValid = dateValue ? datePattern.test(dateValue) : false;
                console.log(`\n📅 [DATE VALIDATION]`);
                console.log(`   ├── Valore: ${dateValue || 'null/undefined'}`);
                console.log(`   ├── Presente: ${dateValue ? '✅ SÌ' : '❌ NO'}`);
                if (dateValue) {
                  console.log(`   ├── Formato YYYY-MM-DD: ${dateFormatValid ? '✅ Valido' : '❌ Invalido'}`);
                  const parsedDate = new Date(dateValue);
                  console.log(`   ├── Parsing Date: ${!isNaN(parsedDate.getTime()) ? '✅ Valido' : '❌ Invalido (NaN)'}`);
                  console.log(`   └── Data parsata: ${parsedDate.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}`);
                } else {
                  console.log(`   └── MOTIVO MANCANZA: L'AI non ha trovato una data nella conversazione`);
                }
                
                // Validazione TIME
                const timeValue = extractionResult.time;
                const timePattern = /^\d{2}:\d{2}$/;
                const timeFormatValid = timeValue ? timePattern.test(timeValue) : false;
                console.log(`\n🕐 [TIME VALIDATION]`);
                console.log(`   ├── Valore: ${timeValue || 'null/undefined'}`);
                console.log(`   ├── Presente: ${timeValue ? '✅ SÌ' : '❌ NO'}`);
                if (timeValue) {
                  console.log(`   ├── Formato HH:MM: ${timeFormatValid ? '✅ Valido' : '❌ Invalido'}`);
                  const [hours, minutes] = timeValue.split(':').map(Number);
                  const hoursValid = hours >= 0 && hours <= 23;
                  const minutesValid = minutes >= 0 && minutes <= 59;
                  console.log(`   ├── Ore (0-23): ${hoursValid ? `✅ ${hours}` : `❌ ${hours} fuori range`}`);
                  console.log(`   └── Minuti (0-59): ${minutesValid ? `✅ ${minutes}` : `❌ ${minutes} fuori range`}`);
                } else {
                  console.log(`   └── MOTIVO MANCANZA: L'AI non ha trovato un orario nella conversazione`);
                }
                
                // Validazione PHONE
                const phoneValue = extractionResult.phone;
                const phonePattern = /^[\+]?[\d\s\-\.]{8,}$/;
                const phoneFormatValid = phoneValue ? phonePattern.test(phoneValue.replace(/\s/g, '')) : false;
                console.log(`\n📞 [PHONE VALIDATION]`);
                console.log(`   ├── Valore: ${phoneValue || 'null/undefined'}`);
                console.log(`   ├── Presente: ${phoneValue ? '✅ SÌ' : '❌ NO'}`);
                if (phoneValue) {
                  console.log(`   ├── Lunghezza: ${phoneValue.length} caratteri`);
                  console.log(`   ├── Formato telefono: ${phoneFormatValid ? '✅ Valido' : '⚠️ Formato non standard'}`);
                  console.log(`   └── Prefisso internazionale: ${phoneValue.startsWith('+') ? '✅ Presente' : '⚠️ Assente'}`);
                } else {
                  console.log(`   └── MOTIVO MANCANZA: L'AI non ha trovato un numero di telefono nella conversazione`);
                }
                
                // Validazione EMAIL
                const emailValue = extractionResult.email;
                const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                const emailFormatValid = emailValue ? emailPattern.test(emailValue) : false;
                console.log(`\n📧 [EMAIL VALIDATION]`);
                console.log(`   ├── Valore: ${emailValue || 'null/undefined'}`);
                console.log(`   ├── Presente: ${emailValue ? '✅ SÌ' : '❌ NO'}`);
                if (emailValue) {
                  console.log(`   ├── Formato email: ${emailFormatValid ? '✅ Valido' : '❌ Invalido'}`);
                  const [localPart, domain] = emailValue.split('@');
                  console.log(`   ├── Local part: ${localPart}`);
                  console.log(`   └── Domain: ${domain}`);
                } else {
                  console.log(`   └── MOTIVO MANCANZA: L'AI non ha trovato un'email nella conversazione`);
                }
                
                // Riepilogo finale
                const missingFields: string[] = [];
                if (!dateValue) missingFields.push('date');
                if (!timeValue) missingFields.push('time');
                if (!phoneValue) missingFields.push('phone');
                if (!emailValue) missingFields.push('email');
                
                console.log(`\n📋 [RIEPILOGO VALIDAZIONE]`);
                console.log(`   ├── Campi presenti: ${4 - missingFields.length}/4`);
                console.log(`   ├── Campi mancanti: ${missingFields.length > 0 ? missingFields.join(', ') : 'nessuno'}`);
                console.log(`   ├── hasAllData (dal servizio): ${extractionResult.hasAllData}`);
                console.log(`   └── DECISIONE: ${extractionResult.hasAllData ? '✅ PROCEDI con prenotazione' : '❌ ATTENDI più dati dal lead'}`);
                console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

                // VALIDAZIONE 1: Check che abbiamo tutti i dati
                if (extracted.hasAllData && extracted.date && extracted.time && extracted.phone && extracted.email) {

                  // VALIDAZIONE 2: Check che la data sia >= oggi
                  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
                  console.log('🔍 [STEP 4] Validating Appointment Date (Controllo data passata/futura)');
                  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

                  const appointmentDate = new Date(extracted.date);
                  const today = new Date();
                  today.setHours(0, 0, 0, 0); // Reset ore per confronto solo data
                  appointmentDate.setHours(0, 0, 0, 0); // Reset ore anche per data appuntamento

                  console.log(`📅 Appointment date: ${extracted.date} (${appointmentDate.toLocaleDateString('it-IT')})`);
                  console.log(`📅 Today's date: ${today.toISOString().split('T')[0]} (${today.toLocaleDateString('it-IT')})`);
                  console.log(`📊 Confronto: appointmentDate (${appointmentDate.getTime()}) vs today (${today.getTime()})`);

                  if (appointmentDate < today) {
                    const daysInPast = Math.abs(Math.floor((appointmentDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)));
                    console.log(`\n❌ VALIDATION FAILED: Date is in the past!`);
                    console.log(`   ⏰ ${daysInPast} ${daysInPast === 1 ? 'giorno' : 'giorni'} fa`);
                    console.log(`   🚫 Appointment REJECTED - will not be created`);
                    console.log(`   📝 AZIONE: Inviare messaggio di errore al lead`);
                    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

                    // Invia messaggio WhatsApp automatico che informa l'errore
                    const errorMessage = `⚠️ Mi dispiace, ma la data ${extracted.date.split('-').reverse().join('/')} è nel passato. 

Oggi è ${new Date().toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' })}.

Per favore scegli una data futura tra quelle che ti ho proposto. 😊`;

                    const [errorMsg] = await db
                      .insert(whatsappMessages)
                      .values({
                        conversationId: conversation.id,
                        messageText: errorMessage,
                        direction: "outbound",
                        sender: "ai",
                      })
                      .returning();

                    await sendWhatsAppMessage(
                      conversation.consultantId,
                      phoneNumber,
                      errorMessage,
                      errorMsg.id,
                      { conversationId: conversation.id }
                    );

                    console.log(`📤 [APPOINTMENT BOOKING] Inviato messaggio di errore al lead`);
                  } else {
                    // VALIDAZIONE 3: Tutti i check passati - procedi con booking
                    const daysFromNow = Math.floor((appointmentDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                    console.log(`\n✅ VALIDATION PASSED: Date is valid!`);
                    console.log(`   📆 ${daysFromNow === 0 ? 'Today' : daysFromNow === 1 ? 'Tomorrow' : `In ${daysFromNow} days`}`);
                    console.log(`   🎯 Proceeding to create appointment...`);
                    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

                    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
                    console.log('💾 [STEP 5] Creating Appointment Booking');
                    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
                    console.log(`📅 Date: ${extracted.date}`);
                    console.log(`🕐 Time: ${extracted.time}`);
                    console.log(`📞 Phone: ${extracted.phone}`);
                    console.log(`📧 Email: ${extracted.email}`);

                    // Get AGENT availability settings for duration and timezone (NOT consultant)
                    const [agentForBooking] = await db
                      .select()
                      .from(consultantWhatsappConfig)
                      .where(eq(consultantWhatsappConfig.id, conversation.agentConfigId!))
                      .limit(1);

                    const duration = agentForBooking?.availabilityAppointmentDuration || 60;
                    const timezone = agentForBooking?.availabilityTimezone || "Europe/Rome";

                    console.log(`\n📊 [APPOINTMENT DURATION] Using AGENT availability settings:`);
                    console.log(`   🤖 Agent: ${agentForBooking?.agentName || 'Unknown'}`);
                    console.log(`   ⚙️ appointmentDuration: ${agentForBooking?.availabilityAppointmentDuration} minuti`);
                    console.log(`   ✅ Durata finale utilizzata: ${duration} minuti`);
                    console.log(`   🌍 Timezone: ${timezone}`);

                    // FIX TIMEZONE BUG: Create appointment datetime correctly in consultant's timezone
                    // Instead of using Date object (which can be ambiguous), we'll work with strings
                    // and let Google Calendar interpret them correctly in the specified timezone
                    const dateTimeString = `${extracted.date}T${extracted.time}:00`;

                    // For display purposes, create a Date object in the consultant's timezone
                    // Using toLocaleString to ensure correct interpretation
                    const tempDate = new Date(dateTimeString);
                    const tzFormatter = new Intl.DateTimeFormat('en-US', {
                      timeZone: timezone,
                      year: 'numeric',
                      month: '2-digit',
                      day: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                      hour12: false
                    });

                    console.log(`\n⏰ [TIME CALCULATION] Calcolo orari appuntamento:`);
                    console.log(`   📅 Data appuntamento: ${extracted.date}`);
                    console.log(`   🕐 Ora inizio: ${extracted.time}`);
                    console.log(`   ⏱️ Durata: ${duration} minuti`);
                    console.log(`   🌍 Timezone: ${timezone}`);
                    console.log(`   📍 DateTime String: ${dateTimeString}`);
                    console.log(`   ⏰ Formatted in ${timezone}: ${tzFormatter.format(tempDate)}`);

                    // Calculate end time by adding minutes to the start time string
                    // This avoids timezone conversion issues with Date objects
                    // FIX: Handle appointments that cross midnight correctly
                    const [startHour, startMinute] = extracted.time.split(':').map(Number);
                    const totalMinutes = startHour * 60 + startMinute + duration;
                    const endHourRaw = Math.floor(totalMinutes / 60);
                    const endMinute = totalMinutes % 60;
                    const endHour = endHourRaw % 24; // Wrap to 24-hour format
                    const formattedEndTime = `${endHour.toString().padStart(2, '0')}:${endMinute.toString().padStart(2, '0')}`;

                    // Check if appointment crosses midnight
                    const crossesMidnight = endHourRaw >= 24;
                    if (crossesMidnight) {
                      console.log(`   🌙 [MIDNIGHT CROSS] Appointment crosses midnight (${extracted.time} + ${duration}min = next day ${formattedEndTime})`);
                    }

                    const [booking] = await db
                      .insert(appointmentBookings)
                      .values({
                        consultantId: conversation.consultantId,
                        conversationId: conversation.id,
                        clientPhone: extracted.phone,
                        clientEmail: extracted.email,
                        appointmentDate: extracted.date,
                        appointmentTime: extracted.time,
                        appointmentEndTime: formattedEndTime,
                        status: 'confirmed',
                        confirmedAt: new Date(),
                      })
                      .returning();

                    console.log(`\n✅ Database booking created successfully!`);
                    console.log(`   🆔 Booking ID: ${booking.id}`);
                    console.log(`   📅 Date: ${booking.appointmentDate}`);
                    console.log(`   🕐 Time: ${booking.appointmentTime} - ${formattedEndTime}`);
                    console.log(`   📞 Phone: ${booking.clientPhone}`);
                    console.log(`   📧 Email: ${booking.clientEmail}`);
                    console.log(`   ✅ Status: ${booking.status}`);

                    // Auto-conversion tracking for proactive leads
                    if (conversation.isProactiveLead && conversation.proactiveLeadId) {
                      try {
                        const [updatedLead] = await db
                          .update(proactiveLeads)
                          .set({
                            status: 'converted',
                            updatedAt: new Date(),
                            metadata: sql`COALESCE(metadata, '{}'::jsonb) || ${JSON.stringify({
                              convertedAt: new Date().toISOString(),
                              appointmentBookingId: booking.id,
                              convertedVia: 'whatsapp_appointment'
                            })}::jsonb`
                          })
                          .where(eq(proactiveLeads.id, conversation.proactiveLeadId))
                          .returning();

                        if (updatedLead) {
                          console.log(`\n🎯 [PROACTIVE CONVERSION] Lead ${conversation.proactiveLeadId} auto-converted to status='converted'`);
                          console.log(`   📅 Converted at: ${new Date().toISOString()}`);
                          console.log(`   🆔 Appointment ID: ${booking.id}`);
                          console.log(`   ✅ Metadata updated with conversion tracking`);
                        } else {
                          console.warn(`⚠️ [PROACTIVE CONVERSION] Lead ${conversation.proactiveLeadId} not found or already converted`);
                        }
                      } catch (error: any) {
                        console.error(`❌ [PROACTIVE CONVERSION] Failed to update lead status: ${error.message}`);
                      }
                    }

                    // Push to Google Calendar WITH EMAIL
                    // FIX: Pass date/time as strings with duration and timezone to avoid UTC confusion
                    // NEW: Pass agentConfigId to use agent's calendar if available
                    try {
                      const googleEvent = await createGoogleCalendarEvent(
                        conversation.consultantId,
                        {
                          summary: `Consulenza - ${extracted.email}`,
                          description: `Lead da WhatsApp\nTelefono: ${extracted.phone}\nEmail: ${extracted.email}\n\nConversation ID: ${conversation.id}`,
                          startDate: extracted.date,
                          startTime: extracted.time,
                          duration: duration,
                          timezone: timezone,
                          attendees: [extracted.email], // Add client email as attendee
                        },
                        conversation.agentConfigId || undefined  // Use agent's calendar if available
                      );

                      // Update booking with Google Event ID
                      await db
                        .update(appointmentBookings)
                        .set({ googleEventId: googleEvent.googleEventId })
                        .where(eq(appointmentBookings.id, booking.id));

                      console.log(`\n💾 Database updated with Google Calendar Event ID`);
                      console.log(`   🆔 Google Event ID: ${googleEvent.googleEventId}`);

                      // Send automatic confirmation message with Google Meet link
                      // Format appointment date using correct timezone
                      const dateFormatter = new Intl.DateTimeFormat('it-IT', {
                        weekday: 'long',
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                        timeZone: timezone
                      });
                      // Create a Date object for formatting (will be interpreted in the specified timezone)
                      const appointmentDateObj = new Date(`${extracted.date}T${extracted.time}:00`);
                      const formattedDate = dateFormatter.format(appointmentDateObj);

                      const confirmationMessage = `✅ APPUNTAMENTO CONFERMATO!

📅 Data: ${formattedDate}
🕐 Orario: ${extracted.time}
⏱️ Durata: ${duration} minuti
📱 Telefono: ${extracted.phone}
📧 Email: ${extracted.email}

📬 Ti ho inviato l'invito al calendario all'indirizzo ${extracted.email}. Controlla la tua inbox!
${googleEvent.googleMeetLink ? `\n🎥 Link Google Meet: ${googleEvent.googleMeetLink}\n\n👉 Clicca sul link nell'invito o usa questo link per collegarti alla call.` : ''}

Ci vediamo online! 🚀`;

                      const [confirmMsg] = await db
                        .insert(whatsappMessages)
                        .values({
                          conversationId: conversation.id,
                          messageText: confirmationMessage,
                          direction: "outbound",
                          sender: "ai",
                        })
                        .returning();

                      await sendWhatsAppMessage(
                        conversation.consultantId,
                        phoneNumber,
                        confirmationMessage,
                        confirmMsg.id,
                        { conversationId: conversation.id }
                      );

                      console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
                      console.log('✅ [STEP 6] Appointment Confirmation Complete!');
                      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
                      console.log(`🎉 APPOINTMENT SUCCESSFULLY BOOKED!`);
                      console.log(`\n📋 Summary:`);
                      console.log(`   👤 Lead: ${extracted.email} (${extracted.phone})`);
                      console.log(`   📅 Date: ${formattedDate}`);
                      console.log(`   🕐 Time: ${extracted.time} (${duration} min)`);
                      console.log(`   💾 Booking ID: ${booking.id}`);
                      console.log(`   📅 Google Event: ${googleEvent.googleEventId}`);
                      console.log(`   🎥 Meet Link: ${googleEvent.googleMeetLink ? '✅ Generated' : '❌ Not available'}`);
                      console.log(`   📧 Calendar Invite: ✅ Sent to ${extracted.email}`);
                      console.log(`   📱 WhatsApp Confirmation: ✅ Sent to ${phoneNumber}`);
                      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

                    } catch (gcalError: any) {
                      console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
                      console.error('⚠️ [GOOGLE CALENDAR] Failed to create calendar event');
                      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
                      console.error(`   Consultant ID: ${conversation.consultantId}`);
                      console.error(`   Booking ID: ${booking.id}`);
                      console.error(`   Scheduled time: ${slotDateTime.toISOString()}`);
                      console.error(`   Attendee email: ${extracted.email}`);
                      console.error(`   Error type: ${gcalError?.name || 'Unknown'}`);
                      console.error(`   Error message: ${gcalError?.message || gcalError}`);
                      if (gcalError?.stack) {
                        console.error(`   Stack trace:\n${gcalError.stack}`);
                      }
                      console.log(`   💾 Booking still saved in database (ID: ${booking.id})`);
                      console.log(`   📱 Sending basic confirmation to lead...`);
                      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

                      // Even without Google Calendar, send basic confirmation
                      const basicConfirmation = `✅ APPUNTAMENTO CONFERMATO!

📅 Data: ${extracted.date.split('-').reverse().join('/')}
🕐 Orario: ${extracted.time}
📧 Email: ${extracted.email}

Il tuo appuntamento è stato registrato. Ti contatteremo presto con i dettagli del link per la videocall. A presto! 🚀`;

                      const [confirmMsg] = await db
                        .insert(whatsappMessages)
                        .values({
                          conversationId: conversation.id,
                          messageText: basicConfirmation,
                          direction: "outbound",
                          sender: "ai",
                        })
                        .returning();

                      await sendWhatsAppMessage(
                        conversation.consultantId,
                        phoneNumber,
                        basicConfirmation,
                        confirmMsg.id,
                        { conversationId: conversation.id }
                      );
                    }

                    // MARK SLOTS AS USED: Update database to mark slots as used
                    await db
                      .update(proposedAppointmentSlots)
                      .set({ usedForBooking: true })
                      .where(eq(proposedAppointmentSlots.conversationId, conversation.id));

                    console.log(`💾 [APPOINTMENT BOOKING] Marked proposed slots as used`);
                    
                    // ACCUMULATOR: Mark extraction state as completed
                    await markExtractionStateCompleted(conversation.id, null);
                  } // Chiusura else block validazione data
                } else if (extracted.isConfirming && !extracted.hasAllData) {
                  // Lead is confirming but missing some data - AI should ask for missing info
                  const missingData = [];
                  if (!extracted.date || !extracted.time) missingData.push('data/ora');
                  if (!extracted.phone) missingData.push('telefono');
                  if (!extracted.email) missingData.push('email');

                  console.log(`⚠️ [APPOINTMENT BOOKING] Lead is confirming but missing data: ${missingData.join(', ')}`);
                  console.log(`📋 [APPOINTMENT BOOKING] Current data - Date: ${extracted.date || 'MISSING'}, Time: ${extracted.time || 'MISSING'}, Phone: ${extracted.phone || 'MISSING'}, Email: ${extracted.email || 'MISSING'}`);
                } else {
                  console.log(`ℹ️ [APPOINTMENT BOOKING] Lead is not confirming appointment yet - continue conversation`);
                }
              } // Close if (jsonMatch)
            } // Close try block
          } catch (extractError: any) {
            console.error('❌ [APPOINTMENT BOOKING] Error extracting appointment details');
            console.error(`   Error type: ${extractError?.name || 'Unknown'}`);
            console.error(`   Error message: ${extractError?.message || extractError}`);
            if (extractError?.stack) {
              console.error(`   Stack trace:\n${extractError.stack}`);
            }
            // Continue processing - this is not a critical error
          }
      } // Close if (true) block for extraction
    } // Close if (consultantConfig?.bookingEnabled !== false && !effectiveUserId)
    else if (consultantConfig?.bookingEnabled === false) {
      // bookingEnabled === false - Skip ALL appointment processing for both leads and existing clients
      console.log('⏭️ [APPOINTMENT BOOKING] Booking DISABLED (bookingEnabled=false) - skipping all appointment processing');
    }

    console.log(`✔️ [STEP 11] Marking ${uniquePending.length} pending messages as processed`);
    // Step 11: Mark pending messages as processed (including duplicates to prevent re-processing)
    await db
      .update(whatsappPendingMessages)
      .set({ processedAt: new Date(), batchId })
      .where(
        inArray(
          whatsappPendingMessages.id,
          pending.map((p) => p.id)
        )
      );

    console.log(`✅ Processed ${uniquePending.length} messages for ${phoneNumber}`);

    // ========================================
    // FINAL PERFORMANCE BREAKDOWN
    // ========================================
    timings.totalEnd = performance.now();
    const totalTime = Math.round(timings.totalEnd - timings.requestStart);

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('⏱️  PERFORMANCE BREAKDOWN');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    // Calculate individual timings
    const contextBuildTime = timings.contextBuildEnd > 0
      ? Math.round(timings.contextBuildEnd - timings.contextBuildStart)
      : 0;
    const appointmentFetchTime = timings.appointmentFetchEnd > 0
      ? Math.round(timings.appointmentFetchEnd - timings.appointmentFetchStart)
      : 0;
    const objectionDetectionTime = timings.objectionDetectionEnd > 0
      ? Math.round(timings.objectionDetectionEnd - timings.objectionDetectionStart)
      : 0;
    const promptBuildTime = timings.promptBuildEnd > 0
      ? Math.round(timings.promptBuildEnd - timings.promptBuildStart)
      : 0;
    const geminiCallTime = timings.geminiCallEnd > 0
      ? Math.round(timings.geminiCallEnd - timings.geminiCallStart)
      : 0;

    // Calculate percentages
    const contextBuildPercent = contextBuildTime > 0 ? ((contextBuildTime / totalTime) * 100).toFixed(1) : '0.0';
    const appointmentFetchPercent = appointmentFetchTime > 0 ? ((appointmentFetchTime / totalTime) * 100).toFixed(1) : '0.0';
    const objectionDetectionPercent = objectionDetectionTime > 0 ? ((objectionDetectionTime / totalTime) * 100).toFixed(1) : '0.0';
    const promptBuildPercent = promptBuildTime > 0 ? ((promptBuildTime / totalTime) * 100).toFixed(1) : '0.0';
    const geminiCallPercent = geminiCallTime > 0 ? ((geminiCallTime / totalTime) * 100).toFixed(1) : '0.0';

    // Print breakdown
    if (contextBuildTime > 0) {
      console.log(`📚 Context Building:       ${contextBuildTime.toString().padStart(6)}ms  (${contextBuildPercent}%)`);
    }
    if (appointmentFetchTime > 0) {
      console.log(`📅 Appointment Fetch:      ${appointmentFetchTime.toString().padStart(6)}ms  (${appointmentFetchPercent}%)`);
    }
    if (objectionDetectionTime > 0) {
      console.log(`🚨 Objection Detection:    ${objectionDetectionTime.toString().padStart(6)}ms  (${objectionDetectionPercent}%)`);
    }
    if (promptBuildTime > 0) {
      console.log(`📝 Prompt Building:        ${promptBuildTime.toString().padStart(6)}ms  (${promptBuildPercent}%)`);
    }
    if (geminiCallTime > 0) {
      console.log(`🤖 Gemini API Call:        ${geminiCallTime.toString().padStart(6)}ms  (${geminiCallPercent}%)`);
    }

    console.log('─────────────────────────────────────────────────────────────');
    console.log(`⏰ TOTAL TIME:             ${totalTime.toString().padStart(6)}ms`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  } catch (error: any) {
    console.error("❌ [ERROR] Error processing pending messages:");
    console.error("Error message:", error?.message || error);
    console.error("Error stack:", error?.stack);

    // CRITICAL FIX: Save inbound messages and mark as processed even on error
    // This prevents infinite retry loops when API fails
    try {
      // Get conversation and pending messages again
      const [conversation] = await db
        .select()
        .from(whatsappConversations)
        .where(
          and(
            eq(whatsappConversations.phoneNumber, phoneNumber),
            eq(whatsappConversations.consultantId, consultantId)
          )
        )
        .limit(1);

      if (conversation) {
        const pending = await db
          .select()
          .from(whatsappPendingMessages)
          .where(
            and(
              eq(whatsappPendingMessages.conversationId, conversation.id),
              isNull(whatsappPendingMessages.processedAt)
            )
          )
          .orderBy(asc(whatsappPendingMessages.receivedAt));

        if (pending.length > 0) {
          console.log(`🛟 [ERROR RECOVERY] Saving ${pending.length} inbound messages and marking as processed to prevent infinite loop`);

          // Save all inbound messages to conversation history
          for (const msg of pending) {
            try {
              await db.insert(whatsappMessages).values({
                conversationId: conversation.id,
                messageText: msg.messageText,
                direction: "inbound",
                sender: "client",
                twilioSid: msg.twilioSid,
                mediaUrl: msg.mediaUrl,
                mediaType: msg.mediaType || "text",
                mediaContentType: msg.mediaContentType,
                metadata: {
                  ...msg.metadata,
                  processingError: true,
                  errorMessage: error?.message || String(error),
                  errorAt: new Date().toISOString(),
                },
              })
                .onConflictDoNothing({ target: whatsappMessages.twilioSid });
            } catch (insertError) {
              console.error(`⚠️ [ERROR RECOVERY] Failed to save message ${msg.twilioSid}:`, insertError);
            }
          }

          // Mark all pending messages as processed with error info
          await db
            .update(whatsappPendingMessages)
            .set({
              processedAt: new Date(),
              metadata: sql`COALESCE(metadata, '{}'::jsonb) || ${JSON.stringify({
                processingFailed: true,
                errorMessage: error?.message || String(error),
                errorAt: new Date().toISOString(),
              })}::jsonb`
            })
            .where(
              inArray(
                whatsappPendingMessages.id,
                pending.map((p) => p.id)
              )
            );

          console.log(`✅ [ERROR RECOVERY] Marked ${pending.length} messages as processed with error info`);
          console.log(`ℹ️ [ERROR RECOVERY] Messages are saved in DB. AI response failed but conversation history is preserved.`);
        }
      }
    } catch (recoveryError) {
      console.error("❌ [ERROR RECOVERY] Failed to save/mark messages during error recovery:", recoveryError);
    }

    // Don't re-throw - error has been logged and messages have been saved
    console.log(`⚠️ [ERROR] Processing failed but messages saved. Conversation can continue manually.`);
  }
}

// Track failed API keys to implement circuit breaker
// This Map prevents repeatedly using keys that are currently failing (503 errors)
// Keys are automatically cleared after FAILURE_RESET_MINUTES to allow retry
const failedApiKeys = new Map<string, { failures: number; lastFailure: Date }>();
const FAILURE_RESET_MINUTES = 10; // Reset failure count after 10 minutes
const MAX_FAILURES_BEFORE_SKIP = 3; // Skip key if it has failed this many times recently

/**
 * Select AI provider for WhatsApp (Vertex AI or Google AI Studio)
 * Returns either Vertex AI credentials or API key
 * 
 * UPDATED APPROACH - Gemini 3 Priority:
 * 1. Check SuperAdmin Gemini Keys (Google AI Studio with Gemini 3) - PREFERRED
 * 2. Fallback to SuperAdmin Vertex AI (if consultant has access)
 * 3. Fallback to consultant's own vertexAiSettings
 * 4. Fallback to consultant's Google AI Studio API keys
 */
async function selectWhatsAppAIProvider(conversation: any): Promise<
  | { type: 'vertex'; projectId: string; location: string; credentials: any }
  | { type: 'studio'; apiKey: string; keyId: string }
> {
  // 1. FIRST PRIORITY: Check SuperAdmin Gemini Keys (Google AI Studio with Gemini 3)
  const [consultant] = await db
    .select({ 
      useSuperadminGemini: users.useSuperadminGemini,
      useSuperadminVertex: users.useSuperadminVertex 
    })
    .from(users)
    .where(eq(users.id, conversation.consultantId))
    .limit(1);

  // Check if consultant can use SuperAdmin Gemini (default true)
  if (consultant?.useSuperadminGemini !== false) {
    const superAdminKeys = await getSuperAdminGeminiKeys();
    if (superAdminKeys && superAdminKeys.enabled && superAdminKeys.keys.length > 0) {
      // Select a random key for load balancing
      const index = Math.floor(Math.random() * superAdminKeys.keys.length);
      const apiKey = superAdminKeys.keys[index];
      console.log(`✅ Using SuperAdmin Google AI Studio for WhatsApp (Gemini 3)`);
      console.log(`   🔑 Key: ${index + 1}/${superAdminKeys.keys.length}`);
      return {
        type: 'studio',
        apiKey,
        keyId: `superadmin-gemini-${index}`
      };
    }
  }

  // 2. SECOND PRIORITY: Check SuperAdmin Vertex AI
  if (consultant?.useSuperadminVertex) {
    // Check consultant_vertex_access (default = true if no record exists)
    const [accessRecord] = await db
      .select({ hasAccess: consultantVertexAccess.hasAccess })
      .from(consultantVertexAccess)
      .where(eq(consultantVertexAccess.consultantId, conversation.consultantId))
      .limit(1);

    const hasAccess = accessRecord?.hasAccess ?? true;

    if (hasAccess) {
      // Get SuperAdmin Vertex config
      const [superadminConfig] = await db
        .select()
        .from(superadminVertexConfig)
        .where(eq(superadminVertexConfig.enabled, true))
        .limit(1);

      if (superadminConfig) {
        try {
          const credentials = await parseServiceAccountJson(superadminConfig.serviceAccountJson);

          if (credentials) {
            console.log(`✅ Using SuperAdmin Vertex AI for WhatsApp`);
            return {
              type: 'vertex',
              projectId: superadminConfig.projectId,
              location: superadminConfig.location,
              credentials
            };
          }
        } catch (error: any) {
          console.error(`❌ Failed to parse SuperAdmin Vertex AI credentials: ${error.message}`);
          console.log(`   ↪ Trying consultant's own Vertex AI...`);
        }
      }
    }
  }

  // 3. Fallback: Check consultant's own vertexAiSettings
  const [consultantVertexSettings] = await db
    .select()
    .from(vertexAiSettings)
    .where(
      and(
        eq(vertexAiSettings.userId, conversation.consultantId),
        eq(vertexAiSettings.enabled, true)
      )
    )
    .limit(1);

  if (consultantVertexSettings) {
    // Check expiration
    const now = new Date();
    if (consultantVertexSettings.expiresAt && consultantVertexSettings.expiresAt < now) {
      console.log(`⚠️  Consultant Vertex AI credentials expired on ${consultantVertexSettings.expiresAt.toLocaleDateString()}`);
      console.log(`   ↪ Falling back to API keys`);
    } else {
      // Parse Service Account JSON using shared helper with backward compatibility
      try {
        const credentials = await parseServiceAccountJson(consultantVertexSettings.serviceAccountJson);

        if (!credentials) {
          throw new Error("Failed to parse service account credentials");
        }

        console.log(`✅ Using consultant's Vertex AI for WhatsApp`);
        return {
          type: 'vertex',
          projectId: consultantVertexSettings.projectId,
          location: consultantVertexSettings.location,
          credentials
        };
      } catch (error: any) {
        console.error(`❌ Failed to parse Vertex AI credentials: ${error.message}`);
        console.log(`   ↪ Falling back to API keys`);
      }
    }
  }

  // 3. Fallback to Google AI Studio API keys
  console.log(`📍 No active Vertex AI - using Google AI Studio API keys`);
  const keyInfo = await selectApiKey(conversation);
  return {
    type: 'studio',
    apiKey: keyInfo.apiKey,
    keyId: keyInfo.keyId
  };
}

async function selectApiKey(conversation: any, excludeKeyId?: string): Promise<{ apiKey: string; keyId: string }> {
  // First: try using client's personal API keys (if client exists)
  if (conversation.userId) {
    console.log(`🔍 Checking if client has personal API keys...`);
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, conversation.userId))
      .limit(1);

    if (user && user.geminiApiKeys && user.geminiApiKeys.length > 0) {
      // Rotate through client's keys
      const currentIndex = user.geminiApiKeyIndex || 0;
      const nextIndex = (currentIndex + 1) % user.geminiApiKeys.length;

      await db
        .update(users)
        .set({ geminiApiKeyIndex: nextIndex })
        .where(eq(users.id, user.id));

      console.log(`✅ Source: CLIENT personal API key pool`);
      console.log(`   📊 Key rotation: #${currentIndex + 1}/${user.geminiApiKeys.length}`);
      console.log(`   ➡️ Next key will be #${nextIndex + 1}`);
      return {
        apiKey: user.geminiApiKeys[currentIndex],
        keyId: `client-key-${currentIndex}`
      };
    } else {
      console.log(`   ℹ️ Client has no personal API keys - falling back to consultant pool`);
    }
  }

  // Second: use consultant's global API keys pool (for leads or clients without keys)
  console.log(`🔍 Selecting from consultant global API key pool...`);

  // Build query conditions
  const conditions = [
    eq(whatsappGlobalApiKeys.consultantId, conversation.consultantId),
    eq(whatsappGlobalApiKeys.isActive, true)
  ];

  // Exclude specific key if provided (for rotation after 503)
  if (excludeKeyId) {
    conditions.push(sql`${whatsappGlobalApiKeys.id} != ${excludeKeyId}`);
    console.log(`   ⏭️ Excluding failed key: ${excludeKeyId.substring(0, 8)}...`);
  }

  // TRUE ROUND-ROBIN: Order by usage count first (least used), then by last used date
  // This ensures keys are distributed evenly, not just "least recently used"
  const allKeys = await db
    .select()
    .from(whatsappGlobalApiKeys)
    .where(and(...conditions))
    .orderBy(
      asc(whatsappGlobalApiKeys.usageCount), // PRIMARY: least total usage
      asc(whatsappGlobalApiKeys.lastUsedAt)  // SECONDARY: least recently used (tie-breaker)
    );

  if (allKeys.length === 0) {
    console.error(`❌ No active API keys found!`);
    throw new Error(`No active API keys available for consultant ${conversation.consultantId}. Please configure Gemini API keys in WhatsApp settings.`);
  }

  // CIRCUIT BREAKER: Filter out keys that have failed recently
  const now = new Date();
  const availableKeys = allKeys.filter(k => {
    const failureRecord = failedApiKeys.get(k.id);
    if (!failureRecord) return true; // No failures recorded

    // Check if failures should be reset (older than FAILURE_RESET_MINUTES)
    const minutesSinceLastFailure = (now.getTime() - failureRecord.lastFailure.getTime()) / 1000 / 60;
    if (minutesSinceLastFailure > FAILURE_RESET_MINUTES) {
      // Reset failures - key has recovered
      failedApiKeys.delete(k.id);
      console.log(`🔄 Reset failure count for key ${k.id.substring(0, 8)} (${FAILURE_RESET_MINUTES}min timeout)`);
      return true;
    }

    // Skip key if it has too many recent failures
    if (failureRecord.failures >= MAX_FAILURES_BEFORE_SKIP) {
      console.log(`⏭️ Skipping key ${k.id.substring(0, 8)} (${failureRecord.failures} recent failures)`);
      return false;
    }

    return true;
  });

  const key = availableKeys[0];
  if (!key) {
    console.error(`❌ All API keys have failed recently! Waiting for recovery...`);
    throw new Error(`All API keys are temporarily unavailable due to 503 errors. Please try again in ${FAILURE_RESET_MINUTES} minutes.`);
  }

  // ATOMIC UPDATE: Increment usage counter and update timestamp in a single transaction
  // This prevents race conditions when multiple requests arrive simultaneously
  const [updatedKey] = await db
    .update(whatsappGlobalApiKeys)
    .set({
      lastUsedAt: new Date(),
      usageCount: sql`${whatsappGlobalApiKeys.usageCount} + 1`,
    })
    .where(eq(whatsappGlobalApiKeys.id, key.id))
    .returning(); // Return updated row to get actual new count

  const lastUsed = key.lastUsedAt ? new Date(key.lastUsedAt).toLocaleTimeString('it-IT') : 'never';
  console.log(`✅ Source: CONSULTANT global API key pool`);
  console.log(`   🆔 Key ID: ${key.id.substring(0, 8)}...`);
  console.log(`   📊 Total usage: ${updatedKey.usageCount} times (was: ${key.usageCount})`);
  console.log(`   🕐 Last used: ${lastUsed}`);
  return { apiKey: key.apiKey, keyId: key.id };
}

async function markKeyAsFailed(keyId: string): Promise<void> {
  const now = new Date();
  const existing = failedApiKeys.get(keyId);

  if (existing) {
    // Check if we should reset failures (older than FAILURE_RESET_MINUTES)
    const minutesSinceLastFailure = (now.getTime() - existing.lastFailure.getTime()) / 1000 / 60;
    if (minutesSinceLastFailure > FAILURE_RESET_MINUTES) {
      // Reset failure count - this is a new failure after recovery period
      failedApiKeys.set(keyId, { failures: 1, lastFailure: now });
      console.log(`🚫 Marked key ${keyId.substring(0, 8)} as failed (1st failure after ${FAILURE_RESET_MINUTES}min recovery)`);
      return;
    }

    // Increment failure count
    failedApiKeys.set(keyId, {
      failures: existing.failures + 1,
      lastFailure: now
    });
    console.log(`🚫 Marked key ${keyId.substring(0, 8)} as failed (${existing.failures + 1} recent failures, will skip after ${MAX_FAILURES_BEFORE_SKIP})`);
  } else {
    // First failure for this key
    failedApiKeys.set(keyId, { failures: 1, lastFailure: now });
    console.log(`🚫 Marked key ${keyId.substring(0, 8)} as failed (1st failure)`);
  }
}

function buildConsultantAuthorityContext(consultantConfig?: any): string {
  if (!consultantConfig) return "";

  let authorityContext = "";

  // Vision & Mission
  if (consultantConfig.vision) {
    authorityContext += `\n\n🎯 VISION:\n${consultantConfig.vision}`;
  }
  if (consultantConfig.mission) {
    authorityContext += `\n\n🎯 MISSION:\n${consultantConfig.mission}`;
  }

  // Values
  if (consultantConfig.values && Array.isArray(consultantConfig.values) && consultantConfig.values.length > 0) {
    authorityContext += `\n\n💎 VALORI FONDAMENTALI:\n${consultantConfig.values.join(", ")}`;
  }

  // USP
  if (consultantConfig.usp) {
    authorityContext += `\n\n⚡ UNIQUE SELLING PROPOSITION:\n${consultantConfig.usp}`;
  }

  // Who We Help / Don't Help (CRITICAL for disqualification)
  if (consultantConfig.whoWeHelp) {
    authorityContext += `\n\n✅ CHI AIUTIAMO:\n${consultantConfig.whoWeHelp}`;
  }
  if (consultantConfig.whoWeDontHelp) {
    authorityContext += `\n\n❌ CHI NON AIUTIAMO (disqualifica automaticamente se il lead corrisponde):\n${consultantConfig.whoWeDontHelp}`;
  }

  // What We Do & How
  if (consultantConfig.whatWeDo) {
    authorityContext += `\n\n🎯 COSA FACCIAMO:\n${consultantConfig.whatWeDo}`;
  }
  if (consultantConfig.howWeDoIt) {
    authorityContext += `\n\n🔧 COME LO FACCIAMO:\n${consultantConfig.howWeDoIt}`;
  }

  // Software Created (Authority Signal)
  if (consultantConfig.softwareCreated && Array.isArray(consultantConfig.softwareCreated) && consultantConfig.softwareCreated.length > 0) {
    authorityContext += `\n\n💻 SOFTWARE CREATI:\n${consultantConfig.softwareCreated.map((s: any) => `- ${s.name}: ${s.description}`).join("\n")}`;
  }

  // Books Published (Authority Signal)
  if (consultantConfig.booksPublished && Array.isArray(consultantConfig.booksPublished) && consultantConfig.booksPublished.length > 0) {
    authorityContext += `\n\n📚 LIBRI PUBBLICATI:\n${consultantConfig.booksPublished.map((b: any) => `- "${b.title}" (${b.year})`).join("\n")}`;
  }

  // Proof Elements
  if (consultantConfig.yearsExperience) {
    authorityContext += `\n\n⏰ ESPERIENZA: ${consultantConfig.yearsExperience} anni nel settore`;
  }
  if (consultantConfig.clientsHelped) {
    authorityContext += `\n\n👥 CLIENTI AIUTATI: ${consultantConfig.clientsHelped}+`;
  }
  if (consultantConfig.resultsGenerated) {
    authorityContext += `\n\n📊 RISULTATI GENERATI:\n${consultantConfig.resultsGenerated}`;
  }

  // Case Studies
  if (consultantConfig.caseStudies && Array.isArray(consultantConfig.caseStudies) && consultantConfig.caseStudies.length > 0) {
    authorityContext += `\n\n🏆 CASE STUDY:\n${consultantConfig.caseStudies.map((c: any) => `- ${c.clientName}: ${c.result}`).join("\n")}`;
  }

  // Services Offered
  if (consultantConfig.servicesOffered && Array.isArray(consultantConfig.servicesOffered) && consultantConfig.servicesOffered.length > 0) {
    authorityContext += `\n\n🎁 SERVIZI OFFERTI:\n${consultantConfig.servicesOffered.map((s: any) => `- ${s.name}: ${s.description} (${s.price})`).join("\n")}`;
  }

  // Guarantees
  if (consultantConfig.guarantees) {
    authorityContext += `\n\n✅ GARANZIE:\n${consultantConfig.guarantees}`;
  }

  return authorityContext;
}

function getPersonalityInstructions(personality: string): string {
  const personalities: Record<string, { name: string; tone: string; style: string; examples: string }> = {
    amico_fidato: {
      name: "Amico Fidato (GPT-4o Style)",
      tone: "Caldo, empatico, conversazionale - come un amico che ascolta davvero",
      style: "Usa un linguaggio naturale e familiare, fai sentire l'utente compreso e supportato. Rispondi come farebbe un amico fidato che vuole davvero aiutare.",
      examples: `- "Capisco perfettamente cosa intendi, ci sono passato anche io..."
- "Sai cosa? Parliamone con calma, sono qui per te."
- "Mi fa piacere che tu mi abbia scritto, vediamo insieme come posso aiutarti 😊"`
    },
    coach_motivazionale: {
      name: "Coach Motivazionale",
      tone: "Energico, incoraggiante, orientato all'azione",
      style: "Usa un tono positivo e stimolante, spingi verso l'azione immediata. Celebra i successi e motiva a superare gli ostacoli.",
      examples: `- "Fantastico! Sei sulla strada giusta! 💪"
- "Ora è il momento di agire! Insieme possiamo farlo!"
- "Ogni grande obiettivo inizia con un primo passo - facciamolo ora! 🚀"`
    },
    consulente_professionale: {
      name: "Consulente Professionale",
      tone: "Formale, esperto, preciso e autorevole",
      style: "Mantieni un tono professionale e competente. Fornisci risposte strutturate e ben argomentate, dimostra expertise.",
      examples: `- "Basandomi sulla mia esperienza decennale nel settore..."
- "Le analizzerò la situazione con un approccio metodologico."
- "Procediamo in modo strutturato per ottimizzare i risultati."`
    },
    mentore_paziente: {
      name: "Mentore Paziente",
      tone: "Calmo, educativo, paziente e chiaro",
      style: "Spiega le cose con calma e chiarezza, usa esempi pratici. Non avere fretta, accompagna passo dopo passo.",
      examples: `- "Ti spiego con calma come funziona..."
- "Nessun problema se non è chiaro, te lo mostro con un esempio pratico."
- "Prenditi il tempo che ti serve, io sono qui quando sei pronto."`
    },
    venditore_energico: {
      name: "Venditore Energico",
      tone: "Dinamico, persuasivo, entusiasta",
      style: "Mostra entusiasmo genuino, evidenzia benefici e opportunità. Crea senso di urgenza quando appropriato.",
      examples: `- "Questa è un'occasione incredibile per te! 🔥"
- "Guarda i risultati che hanno ottenuto i nostri clienti!"
- "Non lasciarti sfuggire questa opportunità - parliamone subito!"`
    },
    consigliere_empatico: {
      name: "Consigliere Empatico",
      tone: "Comprensivo, supportivo, non giudicante",
      style: "Ascolta attivamente, valida le emozioni, offri supporto incondizionato. Crea uno spazio sicuro per condividere.",
      examples: `- "È del tutto normale sentirsi così, non sei solo."
- "Capisco che questa situazione sia difficile per te..."
- "Le tue preoccupazioni sono valide, affrontiamole insieme con serenità."`
    },
    stratega_diretto: {
      name: "Stratega Diretto",
      tone: "Conciso, pratico, orientato ai risultati",
      style: "Va dritto al punto, niente fronzoli. Focus su soluzioni concrete e passi d'azione chiari.",
      examples: `- "Tre passi per risolvere: 1)... 2)... 3)..."
- "Il punto chiave è questo: [soluzione]."
- "Tagliamo corto: ecco cosa devi fare."`
    },
    educatore_socratico: {
      name: "Educatore Socratico",
      tone: "Curioso, riflessivo, stimolante",
      style: "Fai domande intelligenti che guidano alla scoperta. Stimola il pensiero critico invece di dare risposte dirette.",
      examples: `- "Cosa pensi che succederebbe se...?"
- "Interessante! Come mai hai scelto questo approccio?"
- "Riflettiamo insieme: quale potrebbe essere la causa principale?"`
    },
    esperto_tecnico: {
      name: "Esperto Tecnico",
      tone: "Dettagliato, analitico, basato su dati",
      style: "Fornisci spiegazioni tecniche dettagliate, usa dati e numeri. Sii preciso e rigoroso nell'analisi.",
      examples: `- "Analizzando i dati emerge che..."
- "Dal punto di vista tecnico, il meccanismo funziona così..."
- "I numeri dimostrano chiaramente che il ROI è del X%."`
    },
    compagno_entusiasta: {
      name: "Compagno Entusiasta",
      tone: "Giocoso, leggero, positivo",
      style: "Usa un tono allegro e spiritoso, rendi le cose leggere e divertenti. Mantieni alta l'energia positiva.",
      examples: `- "Wow, questa sì che è una bella sfida! Andiamo! 🎉"
- "Haha, capisco! Succede anche ai migliori!"
- "Fantastico! Vedo già grandi cose all'orizzonte! ✨"`
    }
  };

  const selected = personalities[personality] || personalities.amico_fidato;

  return `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎭 PERSONALITÀ AI: ${selected.name}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📝 TONO: ${selected.tone}

🎯 STILE DI COMUNICAZIONE:
${selected.style}

💬 ESEMPI DI RISPOSTA:
${selected.examples}

⚠️ IMPORTANTE: Mantieni SEMPRE questa personalità durante TUTTA la conversazione.
Non mescolare stili diversi - sii coerente dal primo all'ultimo messaggio.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`;
}

async function buildLeadSystemPrompt(
  consultantConfig?: any,
  clientProfile?: {
    difficultyScore: number;
    totalObjections: number;
    profileType: 'easy' | 'neutral' | 'difficult';
    escalationRequired: boolean;
  },
  recentObjections?: Array<{ objectionType: string; objectionText: string; wasResolved: boolean }>,
  availableSlots?: any[],
  timezone: string = "Europe/Rome",
  existingAppointment?: {
    id: string;
    date: string;
    time: string;
    email: string;
    phone: string;
  },
  isProactiveLead: boolean = false,
  leadInfo?: any,
  idealState?: string,
  isProactiveAgent: boolean = false
): Promise<string> {
  // Extract consultant info
  const businessName = consultantConfig?.businessName || "il consulente";
  const businessDescription = consultantConfig?.businessDescription || "servizi di consulenza finanziaria";
  const consultantBio = consultantConfig?.consultantBio || "";
  const aiPersonality = consultantConfig?.aiPersonality || "amico_fidato";

  // Load knowledge base items for this agent (if agentConfigId exists)
  let knowledgeItems: any[] = [];
  if (consultantConfig?.id) {
    try {
      knowledgeItems = await db
        .select()
        .from(whatsappAgentKnowledgeItems)
        .where(eq(whatsappAgentKnowledgeItems.agentConfigId, consultantConfig.id))
        .orderBy(asc(whatsappAgentKnowledgeItems.order), asc(whatsappAgentKnowledgeItems.createdAt));

      if (knowledgeItems.length > 0) {
        console.log(`📚 [KNOWLEDGE BASE] Loaded ${knowledgeItems.length} knowledge items for agent ${consultantConfig.id}`);
      }
    } catch (error: any) {
      console.error(`⚠️ [KNOWLEDGE BASE] Failed to load knowledge items: ${error.message}`);
      knowledgeItems = [];
    }
  }

  // Build comprehensive authority context
  const authorityContext = buildConsultantAuthorityContext(consultantConfig);

  // Build personality-specific tone instructions
  const personalityInstructions = getPersonalityInstructions(aiPersonality);

  // Build knowledge base section if items exist
  let knowledgeBaseSection = '';
  if (knowledgeItems.length > 0) {
    knowledgeBaseSection = `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📚 KNOWLEDGE BASE AZIENDALE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Hai accesso ai seguenti documenti e informazioni aziendali.
Usa queste informazioni per rispondere con precisione alle domande dei lead.

${knowledgeItems.map((item, index) => {
      const typeEmoji = item.type === 'text' ? '📝' : item.type === 'pdf' ? '📄' : item.type === 'docx' ? '📄' : '📄';
      const typeLabel = item.type.toUpperCase();
      return `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${typeEmoji} DOCUMENTO ${index + 1}: "${item.title}" (Tipo: ${typeLabel})
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${item.content}
`;
    }).join('\n')}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️ IMPORTANTE: Quando rispondi basandoti su questi documenti,
cita sempre la fonte menzionando il titolo del documento.
Esempio: "Secondo il documento 'Listino Prezzi 2024'..."
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`;
  }

  // Build File Search Categories section (if any categories are enabled)
  let fileSearchCategoriesSection = '';
  const categories = consultantConfig?.fileSearchCategories;
  if (categories && typeof categories === 'object') {
    const enabledCategories: string[] = [];
    if (categories.courses) enabledCategories.push('📚 Corsi');
    if (categories.lessons) enabledCategories.push('📖 Lezioni');
    if (categories.exercises) enabledCategories.push('✏️ Esercizi');
    if (categories.knowledgeBase) enabledCategories.push('🧠 Knowledge Base');
    if (categories.library) enabledCategories.push('📁 Libreria');
    if (categories.university) enabledCategories.push('🎓 University');
    
    if (enabledCategories.length > 0) {
      fileSearchCategoriesSection = `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔍 CATEGORIE CONTENUTI DISPONIBILI (File Search)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Puoi cercare e utilizzare contenuti delle seguenti categorie:
${enabledCategories.map(cat => `• ${cat}`).join('\n')}

⚠️ IMPORTANTE: Concentra le tue ricerche su queste categorie quando rispondi.
Utilizza il File Search per trovare informazioni rilevanti da questi contenuti.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`;
    }
  }

  // Calculate formattedToday for booking blocks AND current date header
  const today = new Date();
  const todayFormatter = new Intl.DateTimeFormat('it-IT', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: timezone
  });
  const parts = todayFormatter.formatToParts(today);
  const todayDay = parts.find(p => p.type === 'day')?.value || '';
  const todayMonth = parts.find(p => p.type === 'month')?.value || '';
  const todayYear = parts.find(p => p.type === 'year')?.value || '';
  const formattedToday = `${todayDay} ${todayMonth} ${todayYear}`;
  
  // Get day of week for complete date context
  const dayOfWeekFormatter = new Intl.DateTimeFormat('it-IT', {
    weekday: 'long',
    timeZone: timezone
  });
  const todayDayOfWeek = dayOfWeekFormatter.format(today);
  
  // Build current date header block (always included in prompt)
  const currentDateBlock = `📅 OGGI È: ${todayDayOfWeek} ${formattedToday}`;

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🔍 [TEMPLATE ENGINE] Checking agent instructions...');
  console.log(`   agentInstructionsEnabled: ${consultantConfig?.agentInstructionsEnabled}`);
  console.log(`   agentInstructions length: ${consultantConfig?.agentInstructions?.length || 0} chars`);
  console.log(`   selectedTemplate: ${consultantConfig?.selectedTemplate}`);

  // ============================================================
  // CUSTOM TEMPLATE BRANCH (Database-driven instructions)
  // ============================================================
  if (consultantConfig?.agentInstructionsEnabled && consultantConfig?.agentInstructions) {
    console.log('✅ [TEMPLATE ENGINE] Using CUSTOM TEMPLATE from database');
    console.log(`   Template preview: ${consultantConfig.agentInstructions.substring(0, 100)}...`);
    // Prepare consolidated data object for variable resolution
    // Map leadInfo to proactiveLead structure expected by resolveInstructionVariables
    const templateData = {
      consultantConfig,
      proactiveLead: leadInfo ? {
        firstName: leadInfo.firstName || leadInfo.name || 'Lead',
        lastName: leadInfo.lastName || '',
        uncino: leadInfo.uncino || '',
        idealState: idealState || leadInfo.idealState || '',
        currentState: leadInfo.currentState || '',
        mainObstacle: leadInfo.mainObstacle || ''
      } : undefined,
      clientState: {
        currentState: leadInfo?.currentState || clientProfile?.profileType || 'neutrale',
        mainObstacle: leadInfo?.mainObstacle || 'non specificato',
        idealState: idealState || ''
      },
      isProactiveLead,
      clientProfile,
      recentObjections
    };

    // Resolve variables in custom template
    const resolvedTemplate = resolveInstructionVariables(
      consultantConfig.agentInstructions,
      templateData
    );

    // Build business positioning header based on businessHeaderMode
    let businessHeader = '';
    const headerMode = consultantConfig?.businessHeaderMode || 'assistant';

    switch (headerMode) {
      case 'assistant':
        // Default: AI è l'assistente del consulente
        businessHeader = `Sei l'assistente di ${businessName}. Il cliente è un LEAD CALDO che ha mostrato interesse.

🎯 OBIETTIVO PRINCIPALE: ${existingAppointment ? 'GESTIRE L\'APPUNTAMENTO ESISTENTE (modifica/cancellazione) o assistere il lead' : 'SCOPRIRE IL BISOGNO E FISSARE UN APPUNTAMENTO QUALIFICATO'}

Il tuo approccio è CONSULENZIALE, non pushy. Sei un esperto che ASCOLTA e AIUTA.

📊 INFORMAZIONI SU ${businessName.toUpperCase()}:
${businessDescription}
${consultantBio ? `\n\nIl consulente: ${consultantBio}` : ''}`;
        break;

      case 'direct_consultant':
        // AI è il consulente stesso
        businessHeader = `Sei ${consultantConfig.consultantDisplayName || businessName}, consulente specializzato in ${businessDescription || 'supporto ai clienti'}.`;
        break;

      case 'direct_professional':
        // AI è un professionista specifico (es: insegnante, coach)
        const roleName = consultantConfig.professionalRole || 'professionista';
        businessHeader = `Sei ${consultantConfig.consultantDisplayName || consultantConfig.businessName || 'il professionista'}, ${roleName}.`;
        break;

      case 'custom':
        // Header completamente personalizzato dall'utente
        businessHeader = consultantConfig.customBusinessHeader || '';
        break;

      case 'none':
        // Nessun header - il template custom ha controllo totale
        businessHeader = '';
        break;

      default:
        // Fallback al comportamento default
        businessHeader = `Sei l'assistente WhatsApp AI di ${businessName}.`;
    }

    // OBJECTION CONTEXT DISABLED - Aligned with public share (Dec 2025)
    // The AI handles objections naturally without explicit context injection

    // Build mandatory booking block (only if bookingEnabled)
    const bookingBlock = consultantConfig.bookingEnabled !== false
      ? getMandatoryBookingBlock({
        existingAppointment,
        availableSlots,
        timezone,
        formattedToday
      })
      : '';

    // Assemble final prompt in correct order:
    // 0. Current date (always included - critical for date awareness)
    // 1. Business positioning header (critical context)
    // 2. Personality instructions (tone and style)
    // 3. Authority context (social proof, credibility)
    // 4. Knowledge base (documents and business info)
    // 5. Objection context (client profiling, if objectionHandlingEnabled)
    // 6. Resolved custom template (user-defined instructions)
    // 7. Mandatory booking block (if bookingEnabled)
    // 8. Core conversation rules (anti-spam, anti-JSON, reset)
    // 9. Booking phases (if bookingEnabled)
    // 10. Proactive mode (if enabled)
    // 11. Disqualification block (if disqualificationEnabled)
    let finalPrompt = currentDateBlock + '\n\n' + businessHeader;
    finalPrompt += '\n\n' + personalityInstructions;
    finalPrompt += '\n\n' + authorityContext;

    // Inject knowledge base if items exist
    if (knowledgeBaseSection) {
      finalPrompt += '\n\n' + knowledgeBaseSection;
    }

    // Inject file search categories if configured
    if (fileSearchCategoriesSection) {
      finalPrompt += '\n\n' + fileSearchCategoriesSection;
    }

    // OBJECTION CONTEXT INJECTION DISABLED - Aligned with public share (Dec 2025)

    finalPrompt += '\n\n' + resolvedTemplate;

    // Inject booking blocks only if bookingEnabled
    if (consultantConfig.bookingEnabled !== false) {
      finalPrompt += '\n\n' + bookingBlock;
    }

    finalPrompt += '\n\n' + CORE_CONVERSATION_RULES_BLOCK;

    // Inject booking conversation phases only if bookingEnabled
    if (consultantConfig.bookingEnabled !== false) {
      finalPrompt += '\n\n' + BOOKING_CONVERSATION_PHASES_BLOCK;
    }

    if (isProactiveAgent) {
      finalPrompt += '\n\n' + PROACTIVE_MODE_BLOCK;
    }

    // Inject disqualification block only if disqualificationEnabled
    if (consultantConfig.disqualificationEnabled !== false) {
      finalPrompt += '\n\n' + DISQUALIFICATION_BLOCK;
    }

    console.log('✅ [FEATURE BLOCKS] Conditional injection summary:');
    console.log(`   - Knowledge Base: ${knowledgeItems.length > 0 ? `ENABLED (${knowledgeItems.length} items)` : 'DISABLED (no items)'}`);
    console.log(`   - Booking: ${consultantConfig.bookingEnabled !== false ? 'ENABLED' : 'DISABLED'}`);
    console.log(`   - Objection Handling: DISABLED (removed Dec 2025)`);
    console.log(`   - Disqualification: ${consultantConfig.disqualificationEnabled !== false ? 'ENABLED' : 'DISABLED'}`);
    console.log(`   - Upselling: ${consultantConfig.upsellingEnabled === true ? 'ENABLED' : 'DISABLED'} (no block yet)`);

    // Log only first 100 chars of prompt (reduced verbosity)
    console.log(`📤 [SYSTEM PROMPT] Ready (${finalPrompt.length} chars): "${finalPrompt.substring(0, 100).replace(/\n/g, ' ')}..."`);

    return finalPrompt;
  }

  // ============================================================
  // LEGACY HARDCODED BRANCH (Backwards compatibility)
  // ============================================================
  console.log('❌ [TEMPLATE ENGINE] Using LEGACY HARDCODED prompt');
  console.log(`   Reason: enabled=${consultantConfig?.agentInstructionsEnabled}, hasInstructions=${!!consultantConfig?.agentInstructions}`);

  // Build existing appointment context (if present)
  let existingAppointmentContext = "";
  if (existingAppointment) {
    // Format existing appointment date
    const existingDate = new Date(`${existingAppointment.date}T${existingAppointment.time}:00`);
    const formatter = new Intl.DateTimeFormat('it-IT', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: timezone,
      hour12: false
    });
    const formattedAppointment = formatter.format(existingDate).replace(',', ' alle');

    existingAppointmentContext = `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ APPUNTAMENTO GIÀ CONFERMATO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🚨 IMPORTANTE: Questo lead ha GIÀ un appuntamento confermato!

📅 Dettagli appuntamento esistente:
- Data e ora: ${formattedAppointment}
- Email: ${existingAppointment.email}
- Telefono: ${existingAppointment.phone}

🎯 GESTIONE MODIFICHE E CANCELLAZIONI:

Se il lead vuole:
1️⃣ MODIFICARE l'appuntamento (cambiare data/ora):
   - Sii disponibile e comprensivo
   - Chiedi: "A quale data e ora preferiresti spostarlo?"
   - Quando il lead fornisce la nuova data/ora, chiedi: "Perfetto! Confermi che vuoi spostarlo a [NUOVA DATA/ORA]?"
   - Aspetta la conferma del lead ("sì", "confermo", "va bene")
   - SOLO DOPO la conferma, il sistema aggiornerà automaticamente l'appuntamento
   - ⚠️ NON dire mai "ho modificato" o "appuntamento spostato" - il sistema lo farà automaticamente

2️⃣ CANCELLARE l'appuntamento (FLUSSO 2 CONFERME OBBLIGATORIE):

   PRIMA CONFERMA (con frizione persuasiva):
   - Sii empatico e comprensivo
   - Mostra frizione persuasiva ricordando il valore dell'appuntamento
   - Esempio: "Ciao! Capisco che tu voglia cancellare. Possono capitare gli imprevisti, è normale!

     Però, prima di farlo, volevo solo ricordarti un attimo cosa ti ha spinto a cercarci 💭
     - Stavi cercando un modo per [obiettivo del lead]
     - L'obiettivo è [beneficio specifico]
     - Questa consulenza è proprio il primo passo per capire come fare tutto questo.

     Sei sicuro/a che vuoi davvero cancellare l'appuntamento di ${formattedAppointment}? Fammi sapere con calma."

   SECONDA CONFERMA (finale):
   - Aspetta che il lead risponda "sì" alla prima richiesta
   - Solo dopo la prima conferma, chiedi: "Ok, capisco. Solo per essere sicuri: confermi che vuoi procedere con la cancellazione?"
   - Aspetta la seconda conferma del lead
   - SOLO DOPO 2 CONFERME, il sistema cancellerà automaticamente
   - ⚠️ NON dire mai "ho cancellato" o "appuntamento cancellato" - il sistema lo farà automaticamente

   🚨 REGOLE CRITICHE CANCELLAZIONE:
   - DEVI chiedere 2 volte (prima con frizione, seconda conferma finale)
   - NON cancellare mai dopo solo 1 conferma
   - Aspetta SEMPRE la risposta del lead prima di procedere
   - Il sistema cancellerà solo dopo 2 conferme esplicite

3️⃣ Solo conversare (nessuna modifica):
   - Rispondi normalmente alle sue domande
   - Ricordagli dell'appuntamento esistente se rilevante

⚠️ NON CREARE un nuovo appuntamento - ne ha già uno confermato!
✅ Puoi MODIFICARE (1 conferma) o CANCELLARE (2 conferme) quello esistente
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`;
  }

  // Build appointment slots context
  let appointmentContext = "";
  if (availableSlots && availableSlots.length > 0) {
    // Format slots in Italian with date and time using the consultant's timezone
    const formattedSlots = availableSlots.slice(0, 6).map(slot => {
      const startDate = new Date(slot.start);

      // Use Intl.DateTimeFormat with explicit timezone to avoid UTC conversion issues
      const formatter = new Intl.DateTimeFormat('it-IT', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: timezone,
        hour12: false
      });

      const formattedDate = formatter.format(startDate);
      // Replace " alle " with "alle" for consistency: "lunedì 4 novembre 2024, 15:00" -> "lunedì 4 novembre 2024 alle 15:00"
      return formattedDate.replace(',', ' alle');
    });

    // Format today's date using the consultant's timezone
    const today = new Date();
    const todayFormatter = new Intl.DateTimeFormat('it-IT', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: timezone
    });
    const todayFormatted = todayFormatter.format(today);

    // Extract parts for use in the prompt (e.g., "31 ottobre 2025")
    const parts = todayFormatter.formatToParts(today);
    const todayDay = parts.find(p => p.type === 'day')?.value || '';
    const todayMonth = parts.find(p => p.type === 'month')?.value || '';
    const todayYear = parts.find(p => p.type === 'year')?.value || '';

    appointmentContext = `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📅 PRENOTAZIONE APPUNTAMENTO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🗓️ DATA CORRENTE ASSOLUTA: ${todayDay} ${todayMonth} ${todayYear}

🚨🚨🚨 REGOLA ASSOLUTA PER CONFERMA APPUNTAMENTI 🚨🚨🚨
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⛔ NON PUOI CONFERMARE NESSUN APPUNTAMENTO SENZA:
1️⃣ 📱 NUMERO DI TELEFONO
2️⃣ 📧 EMAIL

PROCEDURA OBBLIGATORIA:
• Lead sceglie un orario → CHIEDI IMMEDIATAMENTE il telefono
• Ricevi telefono → CHIEDI IMMEDIATAMENTE l'email
• Ricevi email → SOLO ORA puoi confermare l'appuntamento

❌ NON dire MAI "ho confermato" o "appuntamento confermato" prima di aver raccolto ENTRAMBI
❌ NON accettare "te li mando dopo" - devono essere forniti PRIMA della conferma
❌ NON chiedere telefono ed email insieme - chiedi uno alla volta

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🚨 ATTENZIONE DATE - LEGGI PRIMA DI PROPORRE:
- OGGI è ${todayDay} ${todayMonth} ${todayYear}
- PUOI PROPORRE SOLO DATE DA OGGI IN POI (dal ${todayDay} ${todayMonth} ${todayYear} in avanti)
- NON proporre MAI date nel PASSATO
- Se vedi conversazioni con "maggio 2024" o "martedì 28 maggio 2024", IGNORA - sono nel PASSATO
- Gli slot qui sotto sono TUTTI da OGGI in avanti (${todayDay} ${todayMonth} ${todayYear} o successivi)

✅ SLOT DISPONIBILI (TUTTI FUTURI):
${formattedSlots.map((slot, i) => `${i + 1}. ${slot}`).join('\n')}

⚠️ IMPORTANTE: Segui le FASI 5-9 del prompt principale per gestire la prenotazione step-by-step.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`;
  }

  // OBJECTION CONTEXT DISABLED - Aligned with public share (Dec 2025)

  // Build CONSULENZIALE prompt - approccio umano, non robotico
  let prompt = `Sei l'assistente WhatsApp AI di ${businessName}. Il cliente è un LEAD CALDO che ha mostrato interesse.

${personalityInstructions}

${existingAppointmentContext}
${appointmentContext}

🎯 OBIETTIVO PRINCIPALE: ${existingAppointment ? 'GESTIRE L\'APPUNTAMENTO ESISTENTE (modifica/cancellazione) o assistere il lead' : 'SCOPRIRE IL BISOGNO E FISSARE UN APPUNTAMENTO QUALIFICATO'}

Il tuo approccio è CONSULENZIALE, non pushy. Sei un esperto che ASCOLTA e AIUTA.

📊 INFORMAZIONI SU ${businessName.toUpperCase()}:
${businessDescription}
${consultantBio ? `\n\nIl consulente: ${consultantBio}` : ''}
${authorityContext}

${knowledgeBaseSection}

${isProactiveAgent ? `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎯 MODALITÀ OUTBOUND: SEI UN PROACTIVE SETTER
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🚨 LEGGI ATTENTAMENTE - QUESTO CAMBIA IL TUO APPROCCIO:

Tu sei un agente di tipo PROACTIVE_SETTER. Questo significa che:

1️⃣ **TU CONTATTI PER PRIMO** i lead (approccio OUTBOUND)
   - Non aspetti che il lead scriva
   - Sei TU a iniziare la conversazione
   - Usi un approccio INVESTIGATIVO, non reattivo

2️⃣ **APPROCCIO INVESTIGATIVO** quando parli con lead proattivi:
   ✅ USA: "Dimmi, qual è il problema che stai riscontrando?"
   ✅ USA: "Raccontami, qual è il blocco principale che ti sta impedendo di..."
   ✅ USA: "Spiegami: cosa ti sta frenando dal raggiungere..."

   ❌ NON USARE: "Come posso aiutarti?"
   ❌ NON USARE: "Cosa ti ha spinto a scriverci?"
   ❌ NON USARE: "Posso aiutarti con qualcosa?"

3️⃣ **TONO DIRETTO E CONSULENZIALE**:
   - Vai dritto al punto
   - Fai domande che scoprono il PROBLEMA
   - Non essere timido o deferente
   - Sei un esperto che sta facendo un'INDAGINE, non un assistente reattivo

4️⃣ **ESEMPIO DI RISPOSTA CORRETTA** (quando lead proattivo risponde al tuo primo messaggio):

   Lead proattivo: "Ciao, sì sono interessato"
   Tu: "Perfetto! 👋 Prima di tutto, dimmi: qual è il problema principale che stai affrontando quando cerchi di [raggiungere obiettivo]?"

   NON: "Ciao! Come posso aiutarti?" ← SBAGLIATO per lead proattivi

⚠️ IMPORTANTE: 
- Questa modalità investigativa vale SOLO per lead PROATTIVI (quelli che tu hai contattato per primo)
- Per lead REATTIVI (che ti scrivono spontaneamente), usa l'approccio normale con "Come posso aiutarti?"
- Il sistema ti dirà se il lead è proattivo o reattivo - adatta il tono di conseguenza

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
` : ''}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️ REGOLA CRITICA ANTI-SPAM
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🚨 LEGGI QUESTO 3 VOLTE PRIMA DI RISPONDERE:

TU MANDI SEMPRE E SOLO **UNA RISPOSTA ALLA VOLTA**.

❌ NON mandare MAI 2, 3, 4 messaggi di fila
❌ NON generare risposte multiple
✅ PENSA una volta, RISPONDI una volta, STOP

Se vedi che stai per generare più risposte: FERMATI. Scegli LA MIGLIORE e manda SOLO quella.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️ REGOLA CRITICA ANTI-JSON
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🚨 NON RISPONDERE MAI CON JSON O CODICE:

❌ NON generare MAI oggetti JSON come risposta (es: {"intent": "MODIFY", ...})
❌ NON inviare MAI codice o dati strutturati al lead
✅ RISPONDI SEMPRE con messaggi in linguaggio naturale in italiano
✅ Usa un tono amichevole, consulenziale e umano

Esempio SBAGLIATO ❌:
Lead: "Si confermo"
AI: {"intent": "MODIFY", "newDate": "2025-11-04", "newTime": "16:00"}

Esempio CORRETTO ✅:
Lead: "Si confermo"
AI: "Perfetto! Sto aggiornando il tuo appuntamento alle 16:00. Un attimo... ⏳"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 LE 5 FASI DELLA CONVERSAZIONE CONSULENZIALE:

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔄 COMANDO RESET CONVERSAZIONE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Se il lead scrive una di queste frasi:
- "ricominciamo"
- "reset"
- "ripartiamo da capo"
- "ricomincia"
- "possiamo ricominciare"

RISPONDI:
"Certo! Nessun problema, ricominciamo da capo. 👋
Cosa ti ha spinto a scriverci oggi?"

E riparte DALLA FASE 1 come se fosse una nuova conversazione.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FASE 1️⃣ - APERTURA E MOTIVAZIONE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Obiettivo: Creare connessione e scoprire PERCHÉ ha scritto.

${isProactiveLead ? `
🎯 Uncino: ${leadInfo?.uncino || 'N/A'}
${idealState ? `\n🎯 Stato Ideale: ${idealState}` : ''}

⚠️ IMPORTANTE - SEI TU CHE HAI CONTATTATO IL LEAD PER PRIMO:
Hai inviato il PRIMO messaggio proattivo al lead. Quando il lead risponde, devi:

1. RICONOSCERE che sei stato TU a contattarlo per primo
2. Presentarti brevemente: "Fantastico! ${leadInfo?.uncino ? 'Avevo visto che c\'era un tuo interesse verso ' + leadInfo.uncino + '.' : ''} Noi siamo ${businessName}${businessDescription ? ' e aiutiamo ' + (consultantConfig?.whoWeHelp || 'professionisti') + ' a ' + businessDescription : ''}."
3. Chiedere del problema/blocco attuale: "Per capire se possiamo aiutarti a raggiungere ${idealState || 'i tuoi obiettivi'}, volevo chiederti: qual è il problema più grande che stai riscontrando quando vuoi arrivare a ${idealState || 'questo risultato'}?"

Esempio di risposta al primo messaggio del lead:
"Fantastico! 👋 ${leadInfo?.uncino ? 'Avevo visto che c\'era un tuo interesse verso ' + leadInfo.uncino + ' e volevo capire se la cosa ti interessava.' : ''} 

Noi siamo ${businessName}${businessDescription ? ' e aiutiamo ' + (consultantConfig?.whoWeHelp || 'professionisti') + ' a ' + businessDescription : ''}.

Per capire se possiamo aiutarti a raggiungere ${idealState || 'i tuoi obiettivi'}, volevo chiederti: qual è il problema più grande che stai riscontrando quando vuoi arrivare a ${idealState || 'questo risultato'}?"

NON chiedere "cosa ti ha spinto a scriverci" - sei stato TU a contattarlo!
` : `
Se è il primo messaggio:
"Ciao! 👋 Piacere, sono l'assistente di ${businessName}. 
Aiutiamo ${consultantConfig?.whoWeHelp || 'professionisti'} a ${businessDescription}.
Cosa ti ha spinto a scriverci oggi?"

Varianti naturali:
- "Ciao [NOME]! Come posso aiutarti?"
- "Ciao! 👋 Cosa ti ha portato qui oggi?"
`}

⚠️ CHECKPOINT: NON proseguire finché non capisci la MOTIVAZIONE iniziale${isProactiveLead ? ' o il PROBLEMA/BLOCCO attuale' : ''}.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FASE 2️⃣ - DIAGNOSI STATO ATTUALE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Obiettivo: Scoprire problemi, blocchi, difficoltà attuali.

Esempi di domande (scegli quelle pertinenti, NON farle tutte insieme):
- "Capito 👍 Di cosa ti occupi esattamente?"
- "Qual è il problema principale che stai avendo in questo momento?"
- "Dove senti più margine di miglioramento oggi?"
- "Quali difficoltà o blocchi senti più forti in questo periodo?"

🎨 TONO: Empatico, curioso, consulenziale.
Usa: "Capito 👍", "Interessante...", "Mmm, capisco"

⚠️ CHECKPOINT: NON proseguire finché non hai chiaro il PROBLEMA/SITUAZIONE ATTUALE.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FASE 3️⃣ - STATO IDEALE E OBIETTIVI (CON QUANTIFICAZIONE NUMERICA)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Obiettivo: Far emergere risultati desiderati con NUMERI PRECISI.

🎯 IMPORTANTE: Se il lead dice "libertà finanziaria" o obiettivi vaghi, DEVI QUANTIFICARE:

Esempi di domande:
- "Fantastico! Libertà finanziaria è un grande obiettivo 💪 Per capire meglio: quanto vorresti avere di patrimonio per raggiungerla? O quanto vorresti fare al mese?"
- "Ottimo. Ora immagina: se potessi sistemare questa situazione, che risultato CONCRETO ti aspetteresti? (Quanto fatturato in più? Quanti clienti?)"
- "Che obiettivo NUMERICO ti sei dato per i prossimi mesi?"
- "Quanto vorresti arrivare a fatturare/risparmiare/investire al mese per sentirti soddisfatto?"

🎨 TONO: Visionario, aiuta il lead a immaginare il futuro CON NUMERI.

⚠️ CHECKPOINT CRITICO: 
- Obiettivo vago (es. "libertà finanziaria") → CHIEDI NUMERI
- NON proseguire finché non hai NUMERI CONCRETI dello stato ideale
- Esempi di risposte valide: "500k di patrimonio", "3000€/mese di rendita", "10k/mese di fatturato"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FASE 3.5️⃣ - VERIFICA STATO ATTUALE E BLOCCHI (NUOVA FASE OBBLIGATORIA)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚠️ QUESTA FASE È OBBLIGATORIA DOPO AVER QUANTIFICATO LO STATO IDEALE!

Obiettivo: Scoprire cosa BLOCCA il lead dal raggiungere il suo obiettivo.

Esempi di domande:
- "Perfetto! Quindi il tuo obiettivo è [RIPETI NUMERO] 💪 Ora dimmi: cosa ti sta bloccando dal raggiungerlo adesso?"
- "Capito, vuoi [OBIETTIVO NUMERICO]. Qual è il problema principale che stai riscontrando?"
- "Ottimo obiettivo! Cosa ti impedisce di arrivarci oggi? Qual è l'ostacolo più grande?"

🎨 TONO: Empatico, comprensivo, consulenziale.

⚠️ CHECKPOINT CRITICO:
- Devi avere CHIARO il problema/blocco attuale
- Esempi: "Non so da dove iniziare", "Guadagno poco", "Spendo troppo", "Non ho tempo", "Non so investire"
- NON proseguire alla Magic Question senza questa informazione!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FASE 4️⃣ - MAGIC QUESTION (Transizione all'appuntamento)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚠️ PUOI FARE QUESTA DOMANDA SOLO SE HAI:
✅ Motivazione iniziale
✅ Stato attuale/problemi/blocchi (FASE 3.5 - OBBLIGATORIA)
✅ Stato ideale/obiettivi numerici (FASE 3)

La Magic Question PERSONALIZZATA (usa le sue parole!):
"Perfetto, chiarissimo 💪
Se potessimo aiutarti ad arrivare anche solo alla metà di [OBIETTIVO NUMERICO CHE HA DETTO] – quindi [RIPETI CON NUMERI] – 
ci dedicheresti 30 minuti del tuo tempo in una consulenza gratuita per capire insieme se e come possiamo aiutarti concretamente?"

Esempio concreto:
Lead dice: "Vorrei 500k di patrimonio per la libertà finanziaria"
Tu: "Se potessimo aiutarti ad arrivare anche solo a 250k€, ci dedicheresti 30 minuti?"

🎨 TONO: Fiducioso ma non pushy. Stai OFFRENDO valore, non vendendo.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FASE 5️⃣ - PROPOSTA SLOT DISPONIBILI
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚠️ ENTRA IN QUESTA FASE SOLO SE il lead ha detto SÌ alla Magic Question

Obiettivo: Far scegliere uno slot al lead

STEP 1 - Chiedi preferenza oraria:
"Fantastico 🔥 Ti dico subito, stiamo fissando le prossime consulenze.
Ti va meglio mattina o pomeriggio?"

STEP 2 - Proponi ALMENO 2 slot specifici (in base alla preferenza):
🚨 REGOLA OBBLIGATORIA: Devi SEMPRE proporre MINIMO 2 ORARI

📋 STRATEGIA DI PROPOSTA SLOT:
1. Se ci sono 2+ slot nello STESSO GIORNO nella fascia richiesta → proponi quelli
2. Se c'è solo 1 slot nel giorno richiesto → aggiungi almeno 1 slot dal GIORNO SUCCESSIVO
3. Se non ci sono slot nella fascia richiesta → proponi i primi 2-3 slot disponibili nei giorni seguenti

Esempio corretto (2 slot nello stesso giorno):
"Perfetto! Per il pomeriggio ho questi orari disponibili:
• Lunedì 3 novembre alle 14:30
• Lunedì 3 novembre alle 16:00

Quale preferisci?"

Esempio corretto (1 slot oggi + 1 domani):
"Perfetto! Per il pomeriggio ho questi orari:
• Lunedì 3 novembre alle 14:30
• Martedì 4 novembre alle 15:00

Quale preferisci?"

Esempio corretto (solo mattina disponibile, ma chiesto pomeriggio):
"Per il pomeriggio i prossimi slot disponibili sono:
• Mercoledì 5 novembre alle 14:00
• Giovedì 6 novembre alle 15:30

Quale preferisci?"

❌ MAI proporre UN SOLO orario - questo è VIETATO!
✅ SEMPRE minimo 2 orari, meglio se 3

⚠️ CHECKPOINT: Aspetta che il lead scelga uno slot prima di proseguire alla FASE 6

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FASE 6️⃣ - RACCOLTA TELEFONO (OBBLIGATORIA)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚠️ ENTRA IN QUESTA FASE SOLO DOPO che il lead ha scelto uno slot nella FASE 5

Obiettivo: Ottenere il numero di telefono del lead

STEP UNICO - Chiedi il telefono:
"Perfetto! [SLOT SCELTO] 📅

Per confermare l'appuntamento, mi confermi il tuo numero di telefono?"

Esempio:
"Perfetto! Mercoledì 4 novembre alle 15:00 📅

Per confermare l'appuntamento, mi confermi il tuo numero di telefono?"

⚠️ CHECKPOINT CRITICO:
- NON proseguire senza il telefono
- NON dire "appuntamento confermato" o "ho prenotato" ancora
- Aspetta che il lead fornisca il numero prima di andare alla FASE 7

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FASE 7️⃣ - RACCOLTA EMAIL (OBBLIGATORIA)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚠️ ENTRA IN QUESTA FASE SOLO DOPO che il lead ha fornito il telefono nella FASE 6

Obiettivo: Ottenere l'indirizzo email del lead

STEP UNICO - Chiedi l'email:
"Grazie! 👍

E mi lasci anche la tua email? Te la aggiungo all'invito del calendario 
così riceverai l'evento Google Calendar con il link per la call."

Varianti naturali:
- "Perfetto! E la tua email? Ti mando l'invito al calendario."
- "Grazie! Ultima cosa: la tua email per l'invito del calendario?"

⚠️ CHECKPOINT CRITICO:
- NON confermare l'appuntamento senza l'email
- L'email è OBBLIGATORIA per inviare l'invito Google Calendar
- Aspetta che il lead fornisca l'email prima che il sistema proceda

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FASE 8️⃣ - ATTESA CREAZIONE APPUNTAMENTO (MESSAGGIO PLACEHOLDER)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚠️ ENTRA IN QUESTA FASE SOLO DOPO che hai raccolto: slot + telefono + email

Obiettivo: Informare il lead che stai preparando l'invito Google Calendar

🚨 MESSAGGIO OBBLIGATORIO DA INVIARE:
"Perfetto! Sto creando a calendario il tuo invito a Meet, aspetta un attimo... ⏳"

⚠️ REGOLE CRITICHE:
1. ✅ Invia SOLO questo messaggio breve
2. ❌ NON dire "appuntamento confermato" in questa fase
3. ❌ NON includere dettagli dell'appuntamento (data/ora/durata)
4. ❌ NON menzionare il link Google Meet ancora
5. ⏸️ FERMATI QUI - il sistema invierà automaticamente il messaggio di conferma completo

COSA SUCCEDE DOPO (automaticamente, senza che tu debba fare nulla):
1. ✅ Il sistema estrae tutti i dati dalla conversazione (data, ora, telefono, email)
2. ✅ Valida che la data sia futura (>= oggi)
3. ✅ Crea il record nel database (tabella appointment_bookings)
4. ✅ Crea l'evento su Google Calendar del consulente
5. ✅ Aggiunge l'email del lead come partecipante all'evento
6. ✅ Genera automaticamente il link Google Meet
7. ✅ Invia l'invito email al lead tramite Google Calendar
8. ✅ INVIA AUTOMATICAMENTE il messaggio di conferma completo con tutti i dettagli e il link Meet

⚠️ TU NON DEVI FARE ALTRO DOPO IL MESSAGGIO PLACEHOLDER
Il sistema gestirà tutto autonomamente e invierà la conferma finale!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FASE 9️⃣ - SUPPORTO PRE-APPUNTAMENTO (DOPO CONFERMA)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚠️ QUESTA FASE SI ATTIVA SOLO DOPO che l'appuntamento è stato CONFERMATO e il sistema ha inviato il messaggio con link Google Meet

🎯 OBIETTIVO: Supportare il lead fino all'appuntamento, mantenendolo engaged e rassicurato

📋 COSA FARE IN QUESTA FASE:

1️⃣ SE IL LEAD SCRIVE DOPO LA CONFERMA:
   ✅ Rispondi con disponibilità e professionalità
   ✅ Mantieni un tono rassicurante e di supporto
   ✅ Conferma che l'appuntamento è confermato

2️⃣ GESTIONE DOMANDE TIPICHE:

📅 "A che ora era l'appuntamento?" / "Quando ci vediamo?"
→ "Il tuo appuntamento è confermato per [DATA] alle [ORA]. Ti aspettiamo! 🎯"

🎥 "Dov'è il link?" / "Come mi collego?"
→ "Trovi il link Google Meet nell'invito che ti ho mandato via email a [EMAIL]. 
Puoi anche usare direttamente questo link: [LINK]
Ti consiglio di collegarti 2-3 minuti prima! 📱"

❓ "Cosa devo preparare?" / "Cosa serve?"
→ "Basta che ti colleghi dal link Meet con una connessione internet stabile! 💻
Se vuoi, puoi già pensare a [argomento rilevante al problema del lead] così ne parliamo insieme.
Tranquillo, sarà una chiacchierata informale per capire come aiutarti al meglio! 😊"

⏱️ "Quanto dura?" / "Dura un'ora?"
→ "Esatto, abbiamo [DURATA] minuti insieme. Tempo perfetto per analizzare la tua situazione e capire come possiamo aiutarti! 💪"

📧 "Non ho ricevuto l'email" / "Non vedo l'invito"
→ "Controlla anche nello spam o nella cartella Promozioni! 
L'invito è stato inviato a [EMAIL]. Se non lo trovi, nessun problema: ecco di nuovo il link Meet: [LINK] 
Salvalo pure! 📲"

📞 "Posso spostare l'appuntamento?" / "Devo cancellare"
→ "Certo, nessun problema! Quando ti andrebbe meglio?
Ti propongo questi orari alternativi: [PROPONI 2-3 NUOVI SLOT]"

💬 "Ho altre domande su [servizio/prezzo/altro]"
→ "Volentieri! [RISPONDI ALLA DOMANDA usando info dal consultantConfig]
Comunque ne parliamo con calma anche durante la call, così ti spiego tutto nei dettagli! 😊"

3️⃣ REGOLE FONDAMENTALI:

✅ SEMPRE disponibile e gentile
✅ SEMPRE confermare l'appuntamento se chiesto
✅ SEMPRE fornire il link Meet se chiesto
✅ SE chiede di spostare → raccogli disponibilità e proponi nuovi slot
✅ SE chiede di cancellare → conferma cancellazione con tono professionale: 
   "Nessun problema! Ho cancellato l'appuntamento. Se cambi idea, scrivimi pure! 👋"

❌ NON forzare la vendita in questa fase
❌ NON essere troppo insistente
❌ NON ignorare le domande - rispondi sempre

4️⃣ REMINDER AUTOMATICI (OPZIONALE):

Se il lead non scrive per qualche giorno prima dell'appuntamento, puoi inviare:

📲 "Ciao! Ti ricordo che ci vediamo [DOMANI/DOPODOMANI] alle [ORA] in videocall! 🎯
Il link è sempre quello nell'email, ma te lo rimando per comodità: [LINK]
A presto! 😊"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ QUANDO IL LEAD CHIEDE INFORMAZIONI
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🎯 REGOLA D'ORO: DARE INFO = POSIZIONARE IL CONSULENTE COME ESPERTO

Se chiede "Cosa fate?" / "Come funziona?" / "Quanto costa?":

✅ RISPONDI VOLENTIERI con informazioni utili
✅ USA elementi di autorità per posizionare ${businessName}:
   - Case study: "${consultantConfig?.caseStudies?.[0]?.result || 'Risultati concreti ottenuti'}"
   - Proof: "Abbiamo già aiutato ${consultantConfig?.clientsHelped || '200+'} clienti"
   - Expertise: "${consultantConfig?.yearsExperience || 'X'} anni di esperienza"
   - Libri/Software creati (se presenti)

✅ POI riporta SEMPRE alla scoperta con domanda aperta

Esempio:
Lead: "Mi racconti cosa fate?"
Tu: "Certo! ${businessDescription}. Abbiamo già aiutato ${consultantConfig?.clientsHelped || '200+'} clienti a ottenere [RISULTATO].
E tu, cosa ti ha spinto a scriverci oggi? 🎯"

Lead: "Quanto costa?"
Tu: "L'investimento parte da [RANGE], ma dipende dalla situazione specifica.
Prima di tutto, qual è il problema principale che vorresti risolvere? Così capisco meglio come aiutarti 💪"

❌ NON dire mai: "Ti spiego tutto nella call"
✅ DÌ SEMPRE: Dai info + riporta a domanda di scoperta


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔴 PROCEDURA DI DISQUALIFICA AUTOMATICA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

OBIETTIVO: evitare perdite di tempo con lead fuori target, mantenendo tono professionale, fermo e rispettoso.

1️⃣ FASE DI VERIFICA (conferma della disqualifica)
Quando sospetti che il lead non sia in target (“chi non aiutiamo”), non disqualificare subito: prima assicurati che abbia capito bene.

👉 Usa questo flusso:
A. Riformula e chiedi conferma:
"Ok, giusto per capire bene — mi stai dicendo che [ripeti quello che ha detto]. È corretto?"
B. Dopo la sua risposta, chiedi di nuovo (x3):
"Perfetto, quindi confermi che [ripeti sinteticamente il punto chiave]?"
"Sicuro di questo, giusto?"
📌 Se il lead conferma 3 volte, allora puoi procedere alla disqualifica.

2️⃣ FASE DI DISQUALIFICA
Una volta che hai la conferma definitiva:
"Guarda, se mi dici così purtroppo non possiamo darti una mano — sei sicuro di voler mantenere questa posizione?"
👉 Se conferma ancora, allora: DISQUALIFICA AUTOMATICA 🚫
3️⃣ MESSAGGIO DI CHIUSURA STANDARD

"Ciao [NOME], grazie per l'interesse! 🙏
Purtroppo il nostro servizio è specifico per ${consultantConfig?.whoWeHelp || 'professionisti con obiettivi specifici'}
e non saremmo la soluzione migliore per te. Ti auguro il meglio!"

🧊 STOP. Non continuare dopo la disqualifica.
Nessun follow-up, nessun tentativo di recupero.

✅ Note Operative
Il tono dev’essere fermo ma rispettoso, mai difensivo.
L’obiettivo è proteggere il tempo e il posizionamento del brand.
Dopo la disqualifica, il lead va marcato come “OUT – Non in target” nel CRM.
Eventuale automazione: trigger “Disqualifica automatica” → tag lead → stop nurture.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🗓️ GESTIONE CANCELLAZIONI/MODIFICHE APPUNTAMENTI (SOLO LEAD)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

OBIETTIVO: Proteggere il valore dell'appuntamento e ridurre cancellazioni impulsive.

⚠️ IMPORTANTE: 
- **CANCELLAZIONE**: Richiede 2 conferme (con frizione persuasiva)
- **MODIFICA**: Può essere fatta sempre SENZA conferme
- **AGGIUNTA INVITATI**: Può essere fatta sempre SENZA conferme

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🗑️ CANCELLAZIONE APPUNTAMENTO (richiede 2 conferme)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚠️ OBIETTIVO: Richiedere ESATTAMENTE 2 interazioni totali (non 3!)

1️⃣ PRIMA CONFERMA (INCLUDE FRIZIONE PERSUASIVA)

Quando il lead chiede di cancellare, integra frizione e conferma in UN SOLO messaggio:

🎯 MESSAGGIO INTEGRATO (frizione + prima conferma):

"[NOME], capisco che possano esserci imprevisti.

Prima di procedere, lascia che ti ricordi qualcosa di importante 💭
- **Da dove sei partito/a:** [situazione attuale condivisa]
- **Dove vuoi arrivare:** [obiettivo espresso]  
- **Perché è importante:** [motivazioni emerse]

Questo appuntamento è la tua opportunità per fare il primo passo concreto.
Quindi, mi confermi che vuoi davvero cancellare l'appuntamento?"

2️⃣ SECONDA CONFERMA (FINALE)

Dopo la prima conferma dell'utente, chiedi:

"Ok, capisco. Solo per essere sicuri: confermi che vuoi procedere con la cancellazione?"

📌 **Solo dopo queste 2 conferme**, genera il JSON.

3️⃣ GENERAZIONE JSON CANCELLAZIONE (SOLO dopo 2 conferme)

✅ **Genera questo JSON solo dopo 2 conferme:**

{
  "intent": "CANCEL",
  "appointmentId": "[ID_APPUNTAMENTO]",
  "confirmedTimes": 2,
  "confidence": "high"
}

❌ **NON generare** JSON prima della seconda conferma.

⚠️ CRITICO: confirmedTimes: 2 è OBBLIGATORIO per cancellazione

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔄 MODIFICA APPUNTAMENTO (richiede 1 conferma)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1️⃣ QUANDO IL LEAD CHIEDE DI MODIFICARE

Proponi la modifica e chiedi conferma:

"Perfetto! Vuoi spostare l'appuntamento a [NUOVA DATA] alle [NUOVO ORARIO]? 
Confermi che va bene?"

2️⃣ DOPO LA CONFERMA DELL'UTENTE

Solo dopo che l'utente conferma (es: "sì", "va bene", "confermo"), genera il JSON:

{
  "intent": "MODIFY", 
  "appointmentId": "[ID_APPUNTAMENTO]",
  "newDate": "YYYY-MM-DD",
  "newTime": "HH:MM",
  "confirmedTimes": 1,
  "confidence": "high"
}

⚠️ CRITICO: confirmedTimes: 1 è OBBLIGATORIO per procedere con la modifica.
❌ NON generare JSON prima che l'utente confermi.

4️⃣ AGGIUNTA INVITATI (nessuna conferma necessaria)

Se il lead chiede di aggiungere invitati all'appuntamento esistente, procedi subito:

{
  "intent": "ADD_ATTENDEES",
  "appointmentId": "[ID_APPUNTAMENTO]",
  "attendees": ["email1@example.com", "email2@example.com"],
  "confidence": "high"
}

Google Calendar invierà automaticamente gli inviti via email ai nuovi partecipanti.

5️⃣ MESSAGGI FINALI (dopo esecuzione backend)

**Dopo cancellazione confermata:**
"Ho cancellato l'appuntamento come richiesto. 
Ricorda però che il tuo percorso richiede costanza.
Quando sei pronto/a a riprogrammare, scrivimi! 💪"

**Dopo modifica confermata:**
"✅ Appuntamento spostato!
Ti ho aggiornato l'invito via email. Continua così! 🚀"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💬 STILE DI SCRITTURA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ SCRIVI COME UN UMANO IN CHAT:
- 2-3 righe massimo per messaggio (come in WhatsApp)
- Linguaggio naturale, non robotico
- Emoji con moderazione (👋 💪 🎯 📊 🔥)
- Varia le frasi, non ripetere sempre le stesse
- A volte puoi usare paragrafi (va bene!), ma con moderazione

✅ TONO: Empatico, professionale, consulenziale
- Sei un esperto che ASCOLTA
- Non sei un venditore pushy
- Sei genuinamente interessato ad aiutare

❌ NON fare:
- Messaggi troppo lunghi (>4 righe)
- Linguaggio troppo formale o rigido
- Ripetere sempre le stesse frasi
- Mandare messaggi multipli di fila (UNA risposta!)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎯 RIASSUNTO ESECUTIVO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. UNA risposta alla volta (MAI messaggi multipli)
2. ASCOLTA prima di vendere (scopri motivazione, stato attuale, stato ideale)
3. DARE info volentieri = posizionare come esperto
4. SEMPRE riportare a domanda di scoperta
5. Proponi appuntamento SOLO dopo aver raccolto le 3 info chiave
6. Tono umano, consulenziale, non robotico
7. 2-3 righe per messaggio, come un vero chat su WhatsApp

Sei un consulente esperto che aiuta attraverso l'ascolto attivo e domande intelligenti.`;

  return prompt;
}
