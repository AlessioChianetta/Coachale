/**
 * Weekly Check-in Scheduler CRON Job
 * Sistema di check-in settimanale automatico per i clienti via WhatsApp.
 * 
 * CRON 1 (08:00 Europe/Rome): Schedula check-in per la giornata
 * CRON 2 (ogni minuto): Processa e invia messaggi schedulati
 */

import cron from 'node-cron';
import { db } from '../db';
import {
  weeklyCheckinConfig,
  weeklyCheckinLogs,
  weeklyCheckinTemplates,
  users,
  whatsappConversations,
  exercises,
  consultations,
  consultantWhatsappConfig
} from '../../shared/schema';
import { eq, and, lte, isNotNull, desc, sql, gte, inArray } from 'drizzle-orm';
import { sendWhatsAppMessage } from '../whatsapp/twilio-client';
import { getAIProvider, getModelWithThinking } from '../ai/provider-factory';
import { decryptForConsultant } from '../encryption';

let dailySchedulingJob: cron.ScheduledTask | null = null;
let processingJob: cron.ScheduledTask | null = null;
let isDailySchedulingRunning = false;
let isProcessingRunning = false;

const DAILY_SCHEDULING_INTERVAL = '0 8 * * *'; // Daily at 08:00
const PROCESSING_INTERVAL = '* * * * *';       // Every minute
const TIMEZONE = 'Europe/Rome';

interface ClientContext {
  clientName?: string;
  lastExercise?: string;
  exerciseStatus?: string;
  daysSinceLastContact?: number;
  lastConsultationTopic?: string;
  progressContext?: string;
}

interface PersonalizationResult {
  personalizedMessage: string;
  context: ClientContext;
}

/**
 * Start the weekly check-in scheduler
 */
export function startWeeklyCheckinScheduler(): void {
  console.log('🚀 [WEEKLY-CHECKIN] Initializing weekly check-in scheduler...');
  
  if (dailySchedulingJob || processingJob) {
    console.log('⚠️ [WEEKLY-CHECKIN] Scheduler already initialized, stopping existing jobs first...');
    stopWeeklyCheckinScheduler();
  }

  dailySchedulingJob = cron.schedule(DAILY_SCHEDULING_INTERVAL, async () => {
    console.log('⏰ [WEEKLY-CHECKIN] Daily scheduling cycle triggered');
    try {
      await runDailySchedulingNow();
    } catch (error) {
      console.error('❌ [WEEKLY-CHECKIN] Error in daily scheduling cycle:', error);
    }
  }, {
    scheduled: true,
    timezone: TIMEZONE
  });

  processingJob = cron.schedule(PROCESSING_INTERVAL, async () => {
    try {
      await processScheduledCheckins();
    } catch (error) {
      console.error('❌ [WEEKLY-CHECKIN] Error in processing cycle:', error);
    }
  }, {
    scheduled: true,
    timezone: TIMEZONE
  });

  console.log('✅ [WEEKLY-CHECKIN] Scheduler initialized successfully');
  console.log(`   📅 Daily scheduling: ${DAILY_SCHEDULING_INTERVAL} (08:00 Europe/Rome)`);
  console.log(`   📋 Processing: ${PROCESSING_INTERVAL} (every minute)`);
}

/**
 * Stop the weekly check-in scheduler
 */
export function stopWeeklyCheckinScheduler(): void {
  console.log('🛑 [WEEKLY-CHECKIN] Stopping weekly check-in scheduler...');
  
  if (dailySchedulingJob) {
    dailySchedulingJob.stop();
    dailySchedulingJob = null;
    console.log('   ✅ Daily scheduling job stopped');
  }
  
  if (processingJob) {
    processingJob.stop();
    processingJob = null;
    console.log('   ✅ Processing job stopped');
  }
  
  console.log('✅ [WEEKLY-CHECKIN] Scheduler stopped');
}

/**
 * Run daily scheduling manually (for testing)
 */
export async function runDailySchedulingNow(): Promise<void> {
  if (isDailySchedulingRunning) {
    console.log('⚠️ [WEEKLY-CHECKIN] Daily scheduling already running, skipping...');
    return;
  }

  isDailySchedulingRunning = true;
  const startTime = Date.now();
  
  try {
    console.log('📅 [WEEKLY-CHECKIN] Starting daily check-in scheduling...');
    
    const now = new Date();
    const currentDay = now.getDay();
    
    const enabledConfigs = await db
      .select()
      .from(weeklyCheckinConfig)
      .where(eq(weeklyCheckinConfig.isEnabled, true));
    
    console.log(`📊 [WEEKLY-CHECKIN] Found ${enabledConfigs.length} enabled consultant configs`);
    
    if (enabledConfigs.length === 0) {
      console.log('💤 [WEEKLY-CHECKIN] No enabled configs, nothing to schedule');
      return;
    }

    let totalScheduled = 0;
    let totalSkipped = 0;

    for (const config of enabledConfigs) {
      try {
        const excludedDays = config.excludedDays || [];
        if (excludedDays.includes(currentDay)) {
          console.log(`⏭️ [WEEKLY-CHECKIN] Consultant ${config.consultantId}: day ${currentDay} is excluded`);
          continue;
        }

        const scheduled = await scheduleCheckinForConsultant(config, currentDay);
        totalScheduled += scheduled;
      } catch (error) {
        console.error(`❌ [WEEKLY-CHECKIN] Error scheduling for consultant ${config.consultantId}:`, error);
        totalSkipped++;
      }
    }

    await db.update(weeklyCheckinConfig)
      .set({ lastRunAt: new Date() })
      .where(eq(weeklyCheckinConfig.isEnabled, true));

    const duration = Date.now() - startTime;
    console.log(`📈 [WEEKLY-CHECKIN] Daily scheduling completed in ${duration}ms`);
    console.log(`   📅 Total scheduled: ${totalScheduled}`);
    console.log(`   ⏭️ Total skipped: ${totalSkipped}`);
    
  } finally {
    isDailySchedulingRunning = false;
  }
}

/**
 * Schedule check-ins for a single consultant
 */
async function scheduleCheckinForConsultant(
  config: typeof weeklyCheckinConfig.$inferSelect,
  currentDay: number
): Promise<number> {
  const consultantId = config.consultantId;
  
  const activeClients = await db
    .select({
      id: users.id,
      firstName: users.firstName,
      lastName: users.lastName,
      phoneNumber: users.phoneNumber,
    })
    .from(users)
    .where(
      and(
        eq(users.consultantId, consultantId),
        eq(users.role, 'client'),
        eq(users.isActive, true),
        isNotNull(users.phoneNumber)
      )
    );

  if (activeClients.length === 0) {
    console.log(`💤 [WEEKLY-CHECKIN] Consultant ${consultantId}: no active clients with phone numbers`);
    return 0;
  }

  const minDays = config.minDaysSinceLastContact || 5;
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - minDays);

  const recentConversations = await db
    .select({
      clientId: whatsappConversations.clientId,
      lastMessageAt: whatsappConversations.lastMessageAt
    })
    .from(whatsappConversations)
    .where(
      and(
        eq(whatsappConversations.consultantId, consultantId),
        isNotNull(whatsappConversations.lastMessageAt),
        gte(whatsappConversations.lastMessageAt, cutoffDate)
      )
    );

  const recentlyContactedClientIds = new Set(
    recentConversations
      .filter(c => c.clientId)
      .map(c => c.clientId!)
  );

  const eligibleClients = activeClients.filter(
    client => !recentlyContactedClientIds.has(client.id)
  );

  if (eligibleClients.length === 0) {
    console.log(`💤 [WEEKLY-CHECKIN] Consultant ${consultantId}: all clients contacted recently`);
    return 0;
  }

  const dailyQuota = Math.max(1, Math.ceil(eligibleClients.length / 7));
  
  const shuffled = [...eligibleClients].sort(() => Math.random() - 0.5);
  const selectedClients = shuffled.slice(0, dailyQuota);

  console.log(`📊 [WEEKLY-CHECKIN] Consultant ${consultantId}: ${selectedClients.length}/${eligibleClients.length} clients selected (quota: ${dailyQuota})`);

  const templateIds = config.templateIds || [];
  let templateIndex = 0;
  
  const templates = templateIds.length > 0
    ? await db
        .select()
        .from(weeklyCheckinTemplates)
        .where(
          and(
            inArray(weeklyCheckinTemplates.id, templateIds),
            eq(weeklyCheckinTemplates.isActive, true)
          )
        )
    : await db
        .select()
        .from(weeklyCheckinTemplates)
        .where(
          and(
            eq(weeklyCheckinTemplates.isSystemTemplate, true),
            eq(weeklyCheckinTemplates.isActive, true)
          )
        );

  if (templates.length === 0) {
    console.log(`⚠️ [WEEKLY-CHECKIN] Consultant ${consultantId}: no active templates available`);
    return 0;
  }

  let scheduled = 0;

  for (const client of selectedClients) {
    try {
      const scheduledTime = generateRandomTime(
        config.preferredTimeStart || '09:00',
        config.preferredTimeEnd || '18:00'
      );

      const template = templates[templateIndex % templates.length];
      templateIndex++;

      let personalizedMessage: string | null = null;
      let aiContext: ClientContext | null = null;

      if (config.useAiPersonalization) {
        try {
          const result = await personalizeMessage(
            consultantId,
            client.id,
            `${client.firstName} ${client.lastName}`,
            template.body
          );
          personalizedMessage = result.personalizedMessage;
          aiContext = result.context;
        } catch (error) {
          console.error(`⚠️ [WEEKLY-CHECKIN] AI personalization failed for client ${client.id}:`, error);
        }
      }

      const conversation = await db
        .select({ id: whatsappConversations.id })
        .from(whatsappConversations)
        .where(
          and(
            eq(whatsappConversations.consultantId, consultantId),
            eq(whatsappConversations.clientId, client.id)
          )
        )
        .limit(1);

      await db.insert(weeklyCheckinLogs).values({
        configId: config.id,
        consultantId: consultantId,
        clientId: client.id,
        phoneNumber: client.phoneNumber!,
        conversationId: conversation[0]?.id || null,
        scheduledFor: scheduledTime,
        scheduledDay: currentDay,
        scheduledHour: scheduledTime.getHours(),
        templateId: template.id,
        templateName: template.name,
        originalTemplateBody: template.body,
        personalizedMessage: personalizedMessage,
        aiPersonalizationContext: aiContext,
        status: 'scheduled'
      });

      scheduled++;
    } catch (error) {
      console.error(`❌ [WEEKLY-CHECKIN] Error scheduling for client ${client.id}:`, error);
    }
  }

  console.log(`✅ [WEEKLY-CHECKIN] Consultant ${consultantId}: scheduled ${scheduled} check-ins`);
  return scheduled;
}

/**
 * Generate a random time between start and end time strings (HH:MM format)
 */
function generateRandomTime(startTimeStr: string, endTimeStr: string): Date {
  const now = new Date();
  
  const [startHour, startMin] = startTimeStr.split(':').map(Number);
  const [endHour, endMin] = endTimeStr.split(':').map(Number);
  
  const startMinutes = startHour * 60 + startMin;
  const endMinutes = endHour * 60 + endMin;
  
  const randomMinutes = startMinutes + Math.floor(Math.random() * (endMinutes - startMinutes));
  
  const scheduledTime = new Date(now);
  scheduledTime.setHours(Math.floor(randomMinutes / 60), randomMinutes % 60, 0, 0);
  
  if (scheduledTime <= now) {
    scheduledTime.setMinutes(scheduledTime.getMinutes() + 5);
  }
  
  return scheduledTime;
}

/**
 * Personalize a template message using AI
 */
async function personalizeMessage(
  consultantId: string,
  clientId: string,
  clientName: string,
  templateBody: string
): Promise<PersonalizationResult> {
  const context: ClientContext = {
    clientName
  };

  const [lastExercise] = await db
    .select({
      title: exercises.title,
      status: exercises.status
    })
    .from(exercises)
    .where(eq(exercises.assignedTo, clientId))
    .orderBy(desc(exercises.createdAt))
    .limit(1);

  if (lastExercise) {
    context.lastExercise = lastExercise.title;
    context.exerciseStatus = lastExercise.status || 'in_progress';
  }

  const [lastConsultation] = await db
    .select({
      summary: consultations.summary,
      topic: consultations.title
    })
    .from(consultations)
    .where(eq(consultations.clientId, clientId))
    .orderBy(desc(consultations.scheduledAt))
    .limit(1);

  if (lastConsultation) {
    context.lastConsultationTopic = lastConsultation.topic || undefined;
  }

  const [lastConv] = await db
    .select({
      lastMessageAt: whatsappConversations.lastMessageAt
    })
    .from(whatsappConversations)
    .where(eq(whatsappConversations.clientId, clientId))
    .orderBy(desc(whatsappConversations.lastMessageAt))
    .limit(1);

  if (lastConv?.lastMessageAt) {
    const daysSince = Math.floor(
      (Date.now() - new Date(lastConv.lastMessageAt).getTime()) / (1000 * 60 * 60 * 24)
    );
    context.daysSinceLastContact = daysSince;
  }

  try {
    const consultant = await db
      .select({ encryptionSalt: users.encryptionSalt })
      .from(users)
      .where(eq(users.id, consultantId))
      .limit(1);

    const { provider, metadata } = await getAIProvider(consultantId);
    const { model, useThinking, thinkingLevel } = getModelWithThinking(metadata?.name);

    const prompt = `You are a friendly wellness consultant assistant. Personalize this check-in message template for a client.

TEMPLATE:
${templateBody}

CLIENT CONTEXT:
- Name: ${context.clientName}
${context.lastExercise ? `- Last exercise assigned: "${context.lastExercise}" (status: ${context.exerciseStatus})` : '- No recent exercises assigned'}
${context.lastConsultationTopic ? `- Last consultation topic: "${context.lastConsultationTopic}"` : ''}
${context.daysSinceLastContact ? `- Days since last contact: ${context.daysSinceLastContact}` : ''}

INSTRUCTIONS:
1. Personalize the template by naturally incorporating the client's context
2. Keep the message concise (max 200 characters for WhatsApp)
3. Maintain a warm, caring, and professional tone
4. Use the client's first name naturally
5. If they have an exercise in progress, gently ask about it
6. Do NOT include any metadata, just the final message text

Return ONLY the personalized message text, nothing else.`;

    const generateConfig: any = {
      model,
      contents: [{ role: 'user', parts: [{ text: prompt }] }]
    };

    if (useThinking) {
      generateConfig.config = {
        thinkingConfig: { thinkingBudget: thinkingLevel === 'low' ? 1024 : 2048 }
      };
    }

    const response = await provider.models.generateContent(generateConfig);
    
    let personalizedText = '';
    if (response.candidates && response.candidates[0]?.content?.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.text && !part.thought) {
          personalizedText += part.text;
        }
      }
    }

    personalizedText = personalizedText.trim();
    
    if (!personalizedText || personalizedText.length < 10) {
      return {
        personalizedMessage: templateBody.replace('{{nome}}', context.clientName || 'ciao'),
        context
      };
    }

    return {
      personalizedMessage: personalizedText,
      context
    };
  } catch (error) {
    console.error('❌ [WEEKLY-CHECKIN] AI personalization error:', error);
    return {
      personalizedMessage: templateBody.replace('{{nome}}', context.clientName || 'ciao'),
      context
    };
  }
}

/**
 * Process scheduled check-in messages
 */
async function processScheduledCheckins(): Promise<void> {
  if (isProcessingRunning) {
    return;
  }

  isProcessingRunning = true;
  
  try {
    const now = new Date();
    
    const pendingCheckins = await db
      .select()
      .from(weeklyCheckinLogs)
      .where(
        and(
          eq(weeklyCheckinLogs.status, 'scheduled'),
          lte(weeklyCheckinLogs.scheduledFor, now)
        )
      )
      .limit(10);

    if (pendingCheckins.length === 0) {
      return;
    }

    console.log(`📤 [WEEKLY-CHECKIN] Processing ${pendingCheckins.length} pending check-ins`);

    for (const checkin of pendingCheckins) {
      try {
        const [agentConfig] = await db
          .select()
          .from(consultantWhatsappConfig)
          .where(
            and(
              eq(consultantWhatsappConfig.consultantId, checkin.consultantId),
              eq(consultantWhatsappConfig.isActive, true)
            )
          )
          .limit(1);

        if (!agentConfig) {
          console.error(`⚠️ [WEEKLY-CHECKIN] No active WhatsApp agent for consultant ${checkin.consultantId}`);
          await db.update(weeklyCheckinLogs)
            .set({
              status: 'failed',
              errorMessage: 'No active WhatsApp agent configured',
              updatedAt: new Date()
            })
            .where(eq(weeklyCheckinLogs.id, checkin.id));
          continue;
        }

        const messageText = checkin.personalizedMessage || checkin.originalTemplateBody || 'Ciao! Come stai? 😊';

        const messageSid = await sendWhatsAppMessage(
          checkin.consultantId,
          checkin.phoneNumber,
          messageText,
          undefined,
          {
            agentConfigId: agentConfig.id,
            conversationId: checkin.conversationId || undefined
          }
        );

        await db.update(weeklyCheckinLogs)
          .set({
            status: 'sent',
            twilioMessageSid: messageSid,
            sentAt: new Date(),
            updatedAt: new Date()
          })
          .where(eq(weeklyCheckinLogs.id, checkin.id));

        await db.update(weeklyCheckinConfig)
          .set({
            totalSent: sql`${weeklyCheckinConfig.totalSent} + 1`,
            updatedAt: new Date()
          })
          .where(eq(weeklyCheckinConfig.id, checkin.configId));

        if (checkin.templateId) {
          await db.update(weeklyCheckinTemplates)
            .set({
              timesUsed: sql`${weeklyCheckinTemplates.timesUsed} + 1`,
              lastUsedAt: new Date(),
              updatedAt: new Date()
            })
            .where(eq(weeklyCheckinTemplates.id, checkin.templateId));
        }

        console.log(`✅ [WEEKLY-CHECKIN] Sent check-in ${checkin.id} to ${checkin.phoneNumber}`);
      } catch (error: any) {
        console.error(`❌ [WEEKLY-CHECKIN] Error sending check-in ${checkin.id}:`, error);
        
        const retryCount = (checkin.retryCount || 0) + 1;
        const maxRetries = 3;
        
        await db.update(weeklyCheckinLogs)
          .set({
            status: retryCount >= maxRetries ? 'failed' : 'scheduled',
            errorMessage: error.message || 'Unknown error',
            retryCount,
            scheduledFor: retryCount < maxRetries 
              ? new Date(Date.now() + retryCount * 5 * 60 * 1000)
              : checkin.scheduledFor,
            updatedAt: new Date()
          })
          .where(eq(weeklyCheckinLogs.id, checkin.id));
      }
    }
  } finally {
    isProcessingRunning = false;
  }
}
