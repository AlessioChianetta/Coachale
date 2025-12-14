/**
 * Follow-up Scheduler CRON Job
 * Sistema di scheduling proattivo per follow-up WhatsApp.
 * 
 * CRON 1 (ogni 5 minuti): Valuta conversazioni candidate per follow-up
 * CRON 2 (ogni minuto): Processa messaggi schedulati pendenti
 */

import cron from 'node-cron';
import { db } from '../db';
import { 
  conversationStates,
  scheduledFollowupMessages,
  followupRules,
  whatsappConversations,
  whatsappMessages,
  whatsappCustomTemplates,
  whatsappTemplateAssignments,
  whatsappTemplateVersions,
  consultantWhatsappConfig,
  users
} from '../../shared/schema';
import { eq, and, ne, lte, inArray, isNotNull, desc, sql } from 'drizzle-orm';
import { 
  evaluateFollowup, 
  logFollowupDecision, 
  updateConversationState,
  type FollowupContext,
  type FollowupDecision,
  type AIProvider,
  createStudioProvider
} from '../ai/followup-decision-engine';
import { getAIProvider } from '../ai/provider-factory';
import { sendWhatsAppMessage } from '../whatsapp/twilio-client';

let evaluationJob: cron.ScheduledTask | null = null;
let processingJob: cron.ScheduledTask | null = null;
let isEvaluationRunning = false;
let isProcessingRunning = false;

const EVALUATION_INTERVAL = '*/5 * * * *'; // Every 5 minutes
const PROCESSING_INTERVAL = '* * * * *';   // Every minute
const TIMEZONE = 'Europe/Rome';

export function initFollowupScheduler(): void {
  console.log('🚀 [FOLLOWUP-SCHEDULER] Initializing follow-up scheduler...');
  
  if (evaluationJob || processingJob) {
    console.log('⚠️ [FOLLOWUP-SCHEDULER] Scheduler already initialized, stopping existing jobs first...');
    stopFollowupScheduler();
  }

  evaluationJob = cron.schedule(EVALUATION_INTERVAL, async () => {
    console.log('⏰ [FOLLOWUP-SCHEDULER] Evaluation cycle triggered');
    try {
      await runFollowupEvaluation();
    } catch (error) {
      console.error('❌ [FOLLOWUP-SCHEDULER] Error in evaluation cycle:', error);
    }
  }, {
    scheduled: true,
    timezone: TIMEZONE
  });

  processingJob = cron.schedule(PROCESSING_INTERVAL, async () => {
    console.log('⏰ [FOLLOWUP-SCHEDULER] Processing cycle triggered');
    try {
      await processScheduledMessages();
    } catch (error) {
      console.error('❌ [FOLLOWUP-SCHEDULER] Error in processing cycle:', error);
    }
  }, {
    scheduled: true,
    timezone: TIMEZONE
  });

  console.log('✅ [FOLLOWUP-SCHEDULER] Scheduler initialized successfully');
  console.log(`   📋 Evaluation: ${EVALUATION_INTERVAL} (every 5 minutes)`);
  console.log(`   📋 Processing: ${PROCESSING_INTERVAL} (every minute)`);
}

export function stopFollowupScheduler(): void {
  console.log('🛑 [FOLLOWUP-SCHEDULER] Stopping follow-up scheduler...');
  
  if (evaluationJob) {
    evaluationJob.stop();
    evaluationJob = null;
    console.log('   ✅ Evaluation job stopped');
  }
  
  if (processingJob) {
    processingJob.stop();
    processingJob = null;
    console.log('   ✅ Processing job stopped');
  }
  
  console.log('✅ [FOLLOWUP-SCHEDULER] Scheduler stopped');
}

export async function runFollowupEvaluation(): Promise<void> {
  if (isEvaluationRunning) {
    console.log('⚠️ [FOLLOWUP-SCHEDULER] Evaluation already running, skipping...');
    return;
  }

  isEvaluationRunning = true;
  const startTime = Date.now();
  
  try {
    console.log('🔍 [FOLLOWUP-SCHEDULER] Starting follow-up evaluation cycle...');
    
    const candidateConversations = await findCandidateConversations();
    
    console.log(`📊 [FOLLOWUP-SCHEDULER] Found ${candidateConversations.length} candidate conversations`);
    
    if (candidateConversations.length === 0) {
      console.log('💤 [FOLLOWUP-SCHEDULER] No conversations to evaluate');
      return;
    }

    let processed = 0;
    let scheduled = 0;
    let skipped = 0;
    let stopped = 0;
    let errors = 0;

    for (const conversation of candidateConversations) {
      try {
        const result = await evaluateConversation(conversation);
        processed++;
        
        switch (result) {
          case 'scheduled':
            scheduled++;
            break;
          case 'skipped':
            skipped++;
            break;
          case 'stopped':
            stopped++;
            break;
        }
      } catch (error) {
        errors++;
        console.error(`❌ [FOLLOWUP-SCHEDULER] Error evaluating conversation ${conversation.conversationId}:`, error);
      }
    }

    const duration = Date.now() - startTime;
    console.log('📈 [FOLLOWUP-SCHEDULER] Evaluation cycle completed');
    console.log(`   ⏱️  Duration: ${duration}ms`);
    console.log(`   📊 Processed: ${processed}/${candidateConversations.length}`);
    console.log(`   📅 Scheduled: ${scheduled}`);
    console.log(`   ⏭️  Skipped: ${skipped}`);
    console.log(`   🛑 Stopped: ${stopped}`);
    console.log(`   ❌ Errors: ${errors}`);
    
  } finally {
    isEvaluationRunning = false;
  }
}

export async function processScheduledMessages(): Promise<void> {
  if (isProcessingRunning) {
    console.log('⚠️ [FOLLOWUP-SCHEDULER] Message processing already running, skipping...');
    return;
  }

  isProcessingRunning = true;
  const startTime = Date.now();
  
  try {
    console.log('📤 [FOLLOWUP-SCHEDULER] Processing scheduled messages...');
    
    const now = new Date();
    const pendingMessages = await db
      .select()
      .from(scheduledFollowupMessages)
      .where(
        and(
          eq(scheduledFollowupMessages.status, 'pending'),
          lte(scheduledFollowupMessages.scheduledFor, now)
        )
      )
      .limit(50);

    console.log(`📬 [FOLLOWUP-SCHEDULER] Found ${pendingMessages.length} pending messages to send`);

    if (pendingMessages.length === 0) {
      console.log('💤 [FOLLOWUP-SCHEDULER] No pending messages');
      return;
    }

    let sent = 0;
    let failed = 0;
    let cancelled = 0;

    for (const message of pendingMessages) {
      try {
        const shouldSend = await checkIfShouldStillSend(message.conversationId);
        
        if (!shouldSend) {
          await db
            .update(scheduledFollowupMessages)
            .set({
              status: 'cancelled',
              cancelledAt: new Date(),
              cancelReason: 'user_replied'
            })
            .where(eq(scheduledFollowupMessages.id, message.id));
          
          cancelled++;
          console.log(`⏭️ [FOLLOWUP-SCHEDULER] Message ${message.id} cancelled - user replied`);
          continue;
        }

        await sendFollowupMessage(message);
        
        await db
          .update(scheduledFollowupMessages)
          .set({
            status: 'sent',
            sentAt: new Date(),
            attemptCount: (message.attemptCount || 0) + 1,
            lastAttemptAt: new Date()
          })
          .where(eq(scheduledFollowupMessages.id, message.id));
        
        sent++;
        console.log(`✅ [FOLLOWUP-SCHEDULER] Message ${message.id} sent successfully`);
        
      } catch (error: any) {
        const attemptCount = (message.attemptCount || 0) + 1;
        const maxAttempts = message.maxAttempts || 3;
        
        if (attemptCount >= maxAttempts) {
          await db
            .update(scheduledFollowupMessages)
            .set({
              status: 'failed',
              attemptCount,
              lastAttemptAt: new Date(),
              errorMessage: error.message
            })
            .where(eq(scheduledFollowupMessages.id, message.id));
          
          console.error(`❌ [FOLLOWUP-SCHEDULER] Message ${message.id} failed permanently after ${attemptCount} attempts:`, error.message);
        } else {
          await db
            .update(scheduledFollowupMessages)
            .set({
              attemptCount,
              lastAttemptAt: new Date(),
              errorMessage: error.message
            })
            .where(eq(scheduledFollowupMessages.id, message.id));
          
          console.warn(`⚠️ [FOLLOWUP-SCHEDULER] Message ${message.id} failed (attempt ${attemptCount}/${maxAttempts}):`, error.message);
        }
        
        failed++;
      }
    }

    const duration = Date.now() - startTime;
    console.log('📈 [FOLLOWUP-SCHEDULER] Message processing completed');
    console.log(`   ⏱️  Duration: ${duration}ms`);
    console.log(`   ✅ Sent: ${sent}`);
    console.log(`   ⏭️  Cancelled: ${cancelled}`);
    console.log(`   ❌ Failed: ${failed}`);
    
  } finally {
    isProcessingRunning = false;
  }
}

interface ApplicableRule {
  id: string;
  name: string;
  priority: number;
  triggerType: string;
  templateId: string | null;
  fallbackMessage: string | null;
  maxAttempts: number;
  cooldownHours: number;
}

interface CandidateConversation {
  conversationId: string;
  stateId: string;
  currentState: string;
  daysSilent: number;
  hoursSilent: number;
  followupCount: number;
  maxFollowupsAllowed: number;
  engagementScore: number;
  conversionProbability: number;
  signals: {
    hasAskedPrice: boolean;
    hasMentionedUrgency: boolean;
    hasSaidNoExplicitly: boolean;
    discoveryCompleted: boolean;
    demoPresented: boolean;
  };
  consultantId: string;
  agentConfigId: string | null;
  agentType: string;
  phoneNumber: string;
  leadName?: string;
  applicableRules: ApplicableRule[];
  lastFollowupAt?: Date | null;
}

async function findApplicableRules(
  consultantId: string,
  agentConfigId: string | null,
  currentState: string,
  agentType: string,
  engagementScore: number,
  hoursSilent: number,
  lastFollowupAt?: Date | null
): Promise<ApplicableRule[]> {
  const allRules = await db
    .select()
    .from(followupRules)
    .where(
      and(
        eq(followupRules.consultantId, consultantId),
        eq(followupRules.isActive, true)
      )
    )
    .orderBy(desc(followupRules.priority));

  const applicable: ApplicableRule[] = [];

  for (const rule of allRules) {
    const applicableToStates = (rule.applicableToStates as string[] | null) || [];
    if (applicableToStates.length > 0 && !applicableToStates.includes(currentState)) {
      continue;
    }

    const applicableToAgentTypes = (rule.applicableToAgentTypes as string[] | null) || [];
    if (applicableToAgentTypes.length > 0 && !applicableToAgentTypes.includes(agentType)) {
      continue;
    }

    if (rule.agentId && rule.agentId !== agentConfigId) {
      continue;
    }

    const condition = rule.triggerCondition as {
      hoursWithoutReply?: number;
      daysWithoutReply?: number;
      afterState?: string;
      minEngagementScore?: number;
      maxEngagementScore?: number;
    } | null;

    if (condition) {
      if (condition.hoursWithoutReply !== undefined) {
        if (hoursSilent < condition.hoursWithoutReply) {
          continue;
        }
      }

      if (condition.daysWithoutReply !== undefined) {
        const requiredHours = condition.daysWithoutReply * 24;
        if (hoursSilent < requiredHours) {
          continue;
        }
      }

      if (condition.minEngagementScore !== undefined) {
        if (engagementScore < condition.minEngagementScore) {
          continue;
        }
      }

      if (condition.maxEngagementScore !== undefined) {
        if (engagementScore > condition.maxEngagementScore) {
          continue;
        }
      }

      if (condition.afterState !== undefined) {
        if (currentState !== condition.afterState) {
          continue;
        }
      }
    }

    if (lastFollowupAt && rule.cooldownHours > 0) {
      const hoursSinceLastFollowup = (Date.now() - new Date(lastFollowupAt).getTime()) / (1000 * 60 * 60);
      if (hoursSinceLastFollowup < rule.cooldownHours) {
        console.log(`⏰ [FOLLOWUP-SCHEDULER] Rule "${rule.name}" skipped due to cooldown (${hoursSinceLastFollowup.toFixed(1)}h < ${rule.cooldownHours}h)`);
        continue;
      }
    }

    applicable.push({
      id: rule.id,
      name: rule.name,
      priority: rule.priority,
      triggerType: rule.triggerType,
      templateId: rule.templateId,
      fallbackMessage: rule.fallbackMessage,
      maxAttempts: rule.maxAttempts,
      cooldownHours: rule.cooldownHours,
    });
  }

  return applicable;
}

async function findCandidateConversations(): Promise<CandidateConversation[]> {
  const closedStates = ['closed_won', 'closed_lost'];
  
  const consultantsWithActiveRules = await db
    .selectDistinct({ consultantId: followupRules.consultantId })
    .from(followupRules)
    .where(eq(followupRules.isActive, true));
  
  if (consultantsWithActiveRules.length === 0) {
    console.log('⚠️ [FOLLOWUP-SCHEDULER] No consultants with active follow-up rules');
    return [];
  }
  
  const consultantIds = consultantsWithActiveRules.map(c => c.consultantId);
  console.log(`👥 [FOLLOWUP-SCHEDULER] Found ${consultantIds.length} consultants with active follow-up rules`);

  const candidateStates = await db
    .select({
      stateId: conversationStates.id,
      conversationId: conversationStates.conversationId,
      currentState: conversationStates.currentState,
      followupCount: conversationStates.followupCount,
      maxFollowupsAllowed: conversationStates.maxFollowupsAllowed,
      engagementScore: conversationStates.engagementScore,
      conversionProbability: conversationStates.conversionProbability,
      hasAskedPrice: conversationStates.hasAskedPrice,
      hasMentionedUrgency: conversationStates.hasMentionedUrgency,
      hasSaidNoExplicitly: conversationStates.hasSaidNoExplicitly,
      discoveryCompleted: conversationStates.discoveryCompleted,
      demoPresented: conversationStates.demoPresented,
      nextFollowupScheduledAt: conversationStates.nextFollowupScheduledAt,
      lastFollowupAt: conversationStates.lastFollowupAt,
      conversation: {
        consultantId: whatsappConversations.consultantId,
        agentConfigId: whatsappConversations.agentConfigId,
        phoneNumber: whatsappConversations.phoneNumber,
        lastMessageAt: whatsappConversations.lastMessageAt,
        isActive: whatsappConversations.isActive,
      }
    })
    .from(conversationStates)
    .innerJoin(
      whatsappConversations,
      eq(conversationStates.conversationId, whatsappConversations.id)
    )
    .where(
      and(
        sql`${conversationStates.currentState} NOT IN ('closed_won', 'closed_lost')`,
        inArray(whatsappConversations.consultantId, consultantIds),
        eq(whatsappConversations.isActive, true)
      )
    );

  const now = new Date();
  const candidates: CandidateConversation[] = [];

  for (const state of candidateStates) {
    const lastMessageAt = state.conversation.lastMessageAt;
    const msSilent = lastMessageAt 
      ? (now.getTime() - new Date(lastMessageAt).getTime())
      : 999 * 24 * 60 * 60 * 1000;
    const hoursSilent = msSilent / (1000 * 60 * 60);
    const daysSilent = Math.floor(hoursSilent / 24);

    if (state.nextFollowupScheduledAt && new Date(state.nextFollowupScheduledAt) > now) {
      continue;
    }

    if (state.followupCount >= state.maxFollowupsAllowed) {
      continue;
    }

    let agentType = 'reactive_lead';
    if (state.conversation.agentConfigId) {
      const agentConfig = await db
        .select({ agentType: consultantWhatsappConfig.agentType })
        .from(consultantWhatsappConfig)
        .where(eq(consultantWhatsappConfig.id, state.conversation.agentConfigId))
        .limit(1);
      
      if (agentConfig.length > 0) {
        agentType = agentConfig[0].agentType;
      }
    }

    const applicableRules = await findApplicableRules(
      state.conversation.consultantId,
      state.conversation.agentConfigId,
      state.currentState,
      agentType,
      state.engagementScore,
      hoursSilent,
      state.lastFollowupAt
    );

    candidates.push({
      conversationId: state.conversationId,
      stateId: state.stateId,
      currentState: state.currentState,
      daysSilent,
      hoursSilent,
      followupCount: state.followupCount,
      maxFollowupsAllowed: state.maxFollowupsAllowed,
      engagementScore: state.engagementScore,
      conversionProbability: state.conversionProbability ?? 0.5,
      signals: {
        hasAskedPrice: state.hasAskedPrice,
        hasMentionedUrgency: state.hasMentionedUrgency,
        hasSaidNoExplicitly: state.hasSaidNoExplicitly,
        discoveryCompleted: state.discoveryCompleted,
        demoPresented: state.demoPresented,
      },
      consultantId: state.conversation.consultantId,
      agentConfigId: state.conversation.agentConfigId,
      agentType,
      phoneNumber: state.conversation.phoneNumber,
      applicableRules,
      lastFollowupAt: state.lastFollowupAt,
    });
  }

  return candidates;
}

async function evaluateConversation(
  candidate: CandidateConversation
): Promise<'scheduled' | 'skipped' | 'stopped'> {
  console.log(`🔍 [FOLLOWUP-SCHEDULER] Evaluating conversation ${candidate.conversationId}`);
  console.log(`   State: ${candidate.currentState}, Days silent: ${candidate.daysSilent}, Hours silent: ${candidate.hoursSilent.toFixed(1)}, Follow-ups: ${candidate.followupCount}/${candidate.maxFollowupsAllowed}`);
  
  // Bug 3 Fix: Safety check for applicableRules that could be undefined
  const applicableRules = candidate.applicableRules;
  if (!applicableRules || !Array.isArray(applicableRules)) {
    console.log(`⚠️ [FOLLOWUP-SCHEDULER] applicableRules is undefined or not an array for ${candidate.conversationId}, skipping`);
    return 'skipped';
  }
  
  console.log(`   📋 Applicable rules: ${applicableRules.length}`);

  if (applicableRules.length === 0) {
    console.log(`⏭️ [FOLLOWUP-SCHEDULER] No applicable rules for ${candidate.conversationId}, skipping`);
    return 'skipped';
  }
  
  // Bug 1 Fix: Check for existing pending messages before scheduling
  const existingPending = await db
    .select({ id: scheduledFollowupMessages.id })
    .from(scheduledFollowupMessages)
    .where(
      and(
        eq(scheduledFollowupMessages.conversationId, candidate.conversationId),
        eq(scheduledFollowupMessages.status, 'pending')
      )
    )
    .limit(1);
  
  if (existingPending.length > 0) {
    console.log(`⏭️ [FOLLOWUP-SCHEDULER] Pending message already exists for ${candidate.conversationId} (id: ${existingPending[0].id}), skipping duplicate scheduling`);
    return 'skipped';
  }

  const timeBasedRule = applicableRules.find(r => r.triggerType === 'time_based');
  
  if (timeBasedRule) {
    console.log(`⚡ [FOLLOWUP-SCHEDULER] Using deterministic time_based rule: "${timeBasedRule.name}" (priority: ${timeBasedRule.priority})`);
    
    if (candidate.followupCount >= timeBasedRule.maxAttempts) {
      console.log(`🛑 [FOLLOWUP-SCHEDULER] Max attempts reached for rule "${timeBasedRule.name}" (${candidate.followupCount}/${timeBasedRule.maxAttempts})`);
      
      await updateConversationState(candidate.conversationId, {
        currentState: 'ghost',
        previousState: candidate.currentState,
        lastAiEvaluationAt: new Date(),
        aiRecommendation: `Max follow-up attempts reached (${timeBasedRule.maxAttempts}) for rule "${timeBasedRule.name}"`,
      });
      
      return 'stopped';
    }

    const scheduledFor = new Date();
    
    await db.insert(scheduledFollowupMessages).values({
      conversationId: candidate.conversationId,
      ruleId: timeBasedRule.id,
      templateId: timeBasedRule.templateId,
      scheduledFor,
      status: 'pending',
      templateVariables: {},
      fallbackMessage: timeBasedRule.fallbackMessage,
      aiDecisionReasoning: `Deterministic time_based rule: "${timeBasedRule.name}"`,
      aiConfidenceScore: 1.0,
      attemptCount: 0,
      maxAttempts: timeBasedRule.maxAttempts,
    });

    await updateConversationState(candidate.conversationId, {
      nextFollowupScheduledAt: scheduledFor,
      lastAiEvaluationAt: new Date(),
      aiRecommendation: `Applied rule "${timeBasedRule.name}" - time_based trigger`,
    });

    console.log(`📅 [FOLLOWUP-SCHEDULER] Scheduled follow-up for ${candidate.conversationId} using rule "${timeBasedRule.name}"`);
    return 'scheduled';
  }

  const aiDecisionRule = applicableRules.find(r => r.triggerType === 'ai_decision');
  
  if (!aiDecisionRule) {
    const eventBasedRule = applicableRules.find(r => r.triggerType === 'event_based');
    if (eventBasedRule) {
      console.log(`⏭️ [FOLLOWUP-SCHEDULER] Only event_based rules available for ${candidate.conversationId}, waiting for trigger event`);
    } else {
      console.log(`⏭️ [FOLLOWUP-SCHEDULER] No time_based or ai_decision rules for ${candidate.conversationId}, skipping`);
    }
    return 'skipped';
  }

  console.log(`🤖 [FOLLOWUP-SCHEDULER] Using AI decision for rule: "${aiDecisionRule.name}"`);

  const lastMessages = await getLastMessages(candidate.conversationId, 10);
  const availableTemplates = await getAvailableTemplates(candidate.consultantId, candidate.agentConfigId);

  const context: FollowupContext = {
    conversationId: candidate.conversationId,
    leadName: candidate.leadName,
    currentState: candidate.currentState,
    daysSilent: candidate.daysSilent,
    followupCount: candidate.followupCount,
    maxFollowupsAllowed: candidate.maxFollowupsAllowed,
    channel: 'whatsapp',
    agentType: candidate.agentType,
    lastMessages,
    signals: candidate.signals,
    engagementScore: candidate.engagementScore,
    conversionProbability: candidate.conversionProbability,
    availableTemplates,
  };

  let provider: AIProvider;
  try {
    const aiProviderResult = await getAIProvider(candidate.consultantId, candidate.consultantId);
    provider = {
      type: aiProviderResult.source === 'google' ? 'studio' : 'vertex',
      apiKey: process.env.GEMINI_API_KEY,
    };
  } catch (error) {
    console.warn(`⚠️ [FOLLOWUP-SCHEDULER] Failed to get AI provider for consultant ${candidate.consultantId}, using fallback`);
    provider = createStudioProvider(process.env.GEMINI_API_KEY || '');
  }

  const decision = await evaluateFollowup(context, provider);

  await logFollowupDecision(
    candidate.conversationId,
    context,
    decision,
    'gemini-2.5-flash'
  );

  if (decision.decision === 'send_now' || decision.decision === 'schedule') {
    const scheduledFor = calculateScheduledTime(decision);
    
    const templateIdToUse = aiDecisionRule.templateId || decision.suggestedTemplateId || null;
    const fallbackMessageToUse = aiDecisionRule.fallbackMessage || decision.suggestedMessage || null;
    
    await db.insert(scheduledFollowupMessages).values({
      conversationId: candidate.conversationId,
      ruleId: aiDecisionRule.id,
      templateId: templateIdToUse,
      scheduledFor,
      status: 'pending',
      templateVariables: {},
      fallbackMessage: fallbackMessageToUse,
      aiDecisionReasoning: decision.reasoning,
      aiConfidenceScore: decision.confidenceScore,
      attemptCount: 0,
      maxAttempts: aiDecisionRule.maxAttempts,
    });

    await updateConversationState(candidate.conversationId, {
      nextFollowupScheduledAt: scheduledFor,
      lastAiEvaluationAt: new Date(),
      aiRecommendation: decision.reasoning,
      ...(decision.updatedEngagementScore && { engagementScore: decision.updatedEngagementScore }),
      ...(decision.updatedConversionProbability && { conversionProbability: decision.updatedConversionProbability }),
    });

    console.log(`📅 [FOLLOWUP-SCHEDULER] Scheduled follow-up for ${candidate.conversationId} at ${scheduledFor.toISOString()} (AI decision with rule "${aiDecisionRule.name}")`);
    return 'scheduled';
  }

  if (decision.decision === 'stop') {
    const newState = decision.stateTransition || 
      (candidate.currentState === 'stalled' ? 'ghost' : 'closed_lost');
    
    await updateConversationState(candidate.conversationId, {
      currentState: newState,
      previousState: candidate.currentState,
      lastAiEvaluationAt: new Date(),
      aiRecommendation: decision.reasoning,
    });

    console.log(`🛑 [FOLLOWUP-SCHEDULER] Stopped follow-ups for ${candidate.conversationId}, new state: ${newState}`);
    return 'stopped';
  }

  await updateConversationState(candidate.conversationId, {
    lastAiEvaluationAt: new Date(),
    aiRecommendation: decision.reasoning,
  });

  console.log(`⏭️ [FOLLOWUP-SCHEDULER] Skipped follow-up for ${candidate.conversationId}: ${decision.reasoning}`);
  return 'skipped';
}

async function getLastMessages(
  conversationId: string, 
  limit: number = 10
): Promise<Array<{ role: string; content: string; timestamp: string }>> {
  const messages = await db
    .select({
      sender: whatsappMessages.sender,
      messageText: whatsappMessages.messageText,
      createdAt: whatsappMessages.createdAt,
    })
    .from(whatsappMessages)
    .where(eq(whatsappMessages.conversationId, conversationId))
    .orderBy(desc(whatsappMessages.createdAt))
    .limit(limit);

  return messages.reverse().map(m => ({
    role: m.sender === 'client' ? 'lead' : (m.sender === 'consultant' ? 'consultant' : 'ai'),
    content: m.messageText,
    timestamp: m.createdAt?.toISOString() || new Date().toISOString(),
  }));
}

async function getAvailableTemplates(
  consultantId: string,
  agentConfigId: string | null
): Promise<Array<{ id: string; name: string; useCase: string; bodyText: string; twilioStatus: string }>> {
  
  if (agentConfigId) {
    // First, get all assignments for this agent
    const allAssignments = await db
      .select({
        templateId: whatsappTemplateAssignments.templateId,
        templateType: whatsappTemplateAssignments.templateType,
        priority: whatsappTemplateAssignments.priority,
      })
      .from(whatsappTemplateAssignments)
      .where(eq(whatsappTemplateAssignments.agentConfigId, agentConfigId))
      .orderBy(desc(whatsappTemplateAssignments.priority));

    const results: Array<{ id: string; name: string; useCase: string; bodyText: string; twilioStatus: string }> = [];
    
    for (const assignment of allAssignments) {
      const isTwilioTemplate = assignment.templateId.startsWith('HX');
      
      if (isTwilioTemplate) {
        // For Twilio templates, add with the SID as ID
        // The AI will use this SID to send the template via Twilio
        results.push({
          id: assignment.templateId,
          name: assignment.templateId, // Use SID as name for now
          useCase: assignment.templateType || 'twilio',
          bodyText: '', // Body will be fetched from Twilio when sending
          twilioStatus: 'approved', // If assigned, assume approved
        });
      } else {
        // For custom templates, get details from the custom templates table
        const customTemplate = await db
          .select({
            id: whatsappCustomTemplates.id,
            name: whatsappCustomTemplates.templateName,
            useCase: whatsappCustomTemplates.useCase,
            bodyText: whatsappCustomTemplates.body,
            twilioStatus: whatsappTemplateVersions.twilioStatus,
          })
          .from(whatsappCustomTemplates)
          .leftJoin(
            whatsappTemplateVersions,
            and(
              eq(whatsappTemplateVersions.templateId, whatsappCustomTemplates.id),
              eq(whatsappTemplateVersions.isActive, true)
            )
          )
          .where(
            and(
              eq(whatsappCustomTemplates.id, assignment.templateId),
              eq(whatsappCustomTemplates.isActive, true)
            )
          )
          .limit(1);
        
        if (customTemplate.length > 0) {
          const t = customTemplate[0];
          results.push({
            id: t.id,
            name: t.name,
            useCase: t.useCase || 'generale',
            bodyText: t.bodyText || '',
            twilioStatus: t.twilioStatus || 'not_synced',
          });
        }
      }
    }
    
    return results;
  }

  // Fallback: get all active custom templates for consultant
  const templates = await db
    .select({
      id: whatsappCustomTemplates.id,
      name: whatsappCustomTemplates.templateName,
      useCase: whatsappCustomTemplates.useCase,
      bodyText: whatsappCustomTemplates.body,
      twilioStatus: whatsappTemplateVersions.twilioStatus,
    })
    .from(whatsappCustomTemplates)
    .leftJoin(
      whatsappTemplateVersions,
      and(
        eq(whatsappTemplateVersions.templateId, whatsappCustomTemplates.id),
        eq(whatsappTemplateVersions.isActive, true)
      )
    )
    .where(
      and(
        eq(whatsappCustomTemplates.consultantId, consultantId),
        eq(whatsappCustomTemplates.isActive, true)
      )
    );

  return templates.map(t => ({
    id: t.id,
    name: t.name,
    useCase: t.useCase || 'generale',
    bodyText: t.bodyText || '',
    twilioStatus: t.twilioStatus || 'not_synced',
  }));
}

function calculateScheduledTime(decision: FollowupDecision): Date {
  const now = new Date();
  
  switch (decision.urgency) {
    case 'now':
      return now;
    case 'tomorrow':
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(10, 0, 0, 0);
      return tomorrow;
    case 'next_week':
      const nextWeek = new Date(now);
      nextWeek.setDate(nextWeek.getDate() + 7);
      nextWeek.setHours(10, 0, 0, 0);
      return nextWeek;
    default:
      return now;
  }
}

async function checkIfShouldStillSend(conversationId: string): Promise<boolean> {
  const recentMessages = await db
    .select({
      sender: whatsappMessages.sender,
      createdAt: whatsappMessages.createdAt,
    })
    .from(whatsappMessages)
    .where(eq(whatsappMessages.conversationId, conversationId))
    .orderBy(desc(whatsappMessages.createdAt))
    .limit(1);

  if (recentMessages.length === 0) {
    return true;
  }

  const lastMessage = recentMessages[0];
  
  if (lastMessage.sender === 'client') {
    const hoursSinceMessage = lastMessage.createdAt 
      ? (Date.now() - new Date(lastMessage.createdAt).getTime()) / (1000 * 60 * 60)
      : 0;
    
    if (hoursSinceMessage < 24) {
      return false;
    }
  }

  return true;
}

async function sendFollowupMessage(
  message: typeof scheduledFollowupMessages.$inferSelect
): Promise<void> {
  console.log(`📤 [FOLLOWUP-SCHEDULER] Sending follow-up message ${message.id}`);
  
  const conversation = await db
    .select({
      phoneNumber: whatsappConversations.phoneNumber,
      consultantId: whatsappConversations.consultantId,
      agentConfigId: whatsappConversations.agentConfigId,
      lastMessageAt: whatsappConversations.lastMessageAt,
    })
    .from(whatsappConversations)
    .where(eq(whatsappConversations.id, message.conversationId))
    .limit(1);

  if (conversation.length === 0) {
    throw new Error(`Conversation ${message.conversationId} not found`);
  }

  const { phoneNumber, consultantId, agentConfigId, lastMessageAt } = conversation[0];

  // WhatsApp 24h Rule: Check if last lead message was within 24 hours
  const lastLeadMessage = await db
    .select({ createdAt: whatsappMessages.createdAt })
    .from(whatsappMessages)
    .where(
      and(
        eq(whatsappMessages.conversationId, message.conversationId),
        eq(whatsappMessages.sender, 'client')
      )
    )
    .orderBy(desc(whatsappMessages.createdAt))
    .limit(1);

  const hoursSinceLastLeadMessage = lastLeadMessage.length > 0 && lastLeadMessage[0].createdAt
    ? (Date.now() - new Date(lastLeadMessage[0].createdAt).getTime()) / (1000 * 60 * 60)
    : 999; // Assume > 24h if no messages

  const isWithin24Hours = hoursSinceLastLeadMessage < 24;
  console.log(`⏰ [FOLLOWUP-SCHEDULER] Hours since last lead message: ${hoursSinceLastLeadMessage.toFixed(1)}, within 24h: ${isWithin24Hours}`);

  let messageText = '';
  let useTemplate = false;
  let twilioContentSid: string | null = null;

  // If > 24h, MUST use approved Twilio template
  if (!isWithin24Hours) {
    console.log(`📋 [FOLLOWUP-SCHEDULER] Outside 24h window - MUST use approved template`);
    
    if (message.templateId) {
      // Check if template has approved version
      const templateVersion = await db
        .select({
          bodyText: whatsappTemplateVersions.bodyText,
          twilioStatus: whatsappTemplateVersions.twilioStatus,
          twilioContentSid: whatsappTemplateVersions.twilioContentSid,
        })
        .from(whatsappTemplateVersions)
        .where(
          and(
            eq(whatsappTemplateVersions.templateId, message.templateId),
            eq(whatsappTemplateVersions.isActive, true)
          )
        )
        .limit(1);

      if (templateVersion.length > 0 && templateVersion[0].twilioStatus === 'approved') {
        messageText = templateVersion[0].bodyText;
        twilioContentSid = templateVersion[0].twilioContentSid;
        useTemplate = true;
        console.log(`✅ [FOLLOWUP-SCHEDULER] Using approved template with ContentSid: ${twilioContentSid}`);
      } else {
        // Try fallback to template body
        const template = await db
          .select({ body: whatsappCustomTemplates.body })
          .from(whatsappCustomTemplates)
          .where(eq(whatsappCustomTemplates.id, message.templateId))
          .limit(1);

        if (template.length > 0 && template[0].body) {
          messageText = template[0].body;
        }
      }
    }

    // If no approved template available, find one from agent's assigned templates
    if (!messageText && agentConfigId) {
      const approvedTemplate = await db
        .select({
          bodyText: whatsappTemplateVersions.bodyText,
          twilioContentSid: whatsappTemplateVersions.twilioContentSid,
        })
        .from(whatsappTemplateAssignments)
        .innerJoin(
          whatsappTemplateVersions,
          and(
            eq(whatsappTemplateVersions.templateId, whatsappTemplateAssignments.templateId),
            eq(whatsappTemplateVersions.isActive, true),
            eq(whatsappTemplateVersions.twilioStatus, 'approved')
          )
        )
        .where(eq(whatsappTemplateAssignments.agentConfigId, agentConfigId))
        .orderBy(desc(whatsappTemplateAssignments.priority))
        .limit(1);

      if (approvedTemplate.length > 0) {
        messageText = approvedTemplate[0].bodyText;
        twilioContentSid = approvedTemplate[0].twilioContentSid;
        useTemplate = true;
        console.log(`✅ [FOLLOWUP-SCHEDULER] Found approved template from agent assignments`);
      }
    }

    if (!messageText) {
      throw new Error('No approved template available for follow-up outside 24h window');
    }
  } else {
    // Within 24h - can use free-form AI message or template
    console.log(`💬 [FOLLOWUP-SCHEDULER] Within 24h window - can use free-form message`);
    
    if (message.templateId) {
      const template = await db
        .select({ body: whatsappCustomTemplates.body })
        .from(whatsappCustomTemplates)
        .where(eq(whatsappCustomTemplates.id, message.templateId))
        .limit(1);
      
      if (template.length > 0 && template[0].body) {
        messageText = template[0].body;
      }
    }

    // Fall back to AI-generated message
    if (!messageText) {
      messageText = message.fallbackMessage || '';
    }
  }

  // Apply template variables
  if (messageText) {
    const variables = message.templateVariables as Record<string, string> || {};
    for (const [key, value] of Object.entries(variables)) {
      messageText = messageText.replace(`{{${key}}}`, value);
    }
  }

  if (!messageText) {
    throw new Error('No message text available');
  }

  // Send message via Twilio
  console.log(`📱 [FOLLOWUP-SCHEDULER] Sending follow-up to ${phoneNumber}: "${messageText.substring(0, 50)}..."`);
  
  await sendWhatsAppMessage(
    consultantId,
    phoneNumber,
    messageText,
    undefined,
    {
      agentConfigId: agentConfigId || undefined,
      conversationId: message.conversationId,
      twilioContentSid: twilioContentSid || undefined,
    }
  );
  
  console.log(`✅ [FOLLOWUP-SCHEDULER] Message sent successfully to ${phoneNumber}`);

  await updateConversationState(message.conversationId, {
    followupCount: sql`followup_count + 1` as any,
    lastFollowupAt: new Date(),
    nextFollowupScheduledAt: undefined,
  });
}

export function isSchedulerRunning(): boolean {
  return evaluationJob !== null && processingJob !== null;
}

export function getSchedulerStatus(): {
  evaluationRunning: boolean;
  processingRunning: boolean;
  isEvaluating: boolean;
  isProcessing: boolean;
} {
  return {
    evaluationRunning: evaluationJob !== null,
    processingRunning: processingJob !== null,
    isEvaluating: isEvaluationRunning,
    isProcessing: isProcessingRunning,
  };
}
