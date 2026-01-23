/**
 * Weekly Check-in Scheduler CRON Job
 * Sistema di check-in settimanale automatico per i clienti via WhatsApp.
 * 
 * CRON 1 (08:00 Europe/Rome): Schedula check-in per la giornata
 * CRON 2 (ogni minuto): Processa e invia messaggi schedulati
 * 
 * Usa template WhatsApp approvati da Meta (HX prefix) per garantire la consegna.
 */

import cron from 'node-cron';
import { db } from '../db';
import {
  weeklyCheckinConfig,
  weeklyCheckinLogs,
  users,
  whatsappConversations,
  exercises,
  consultations,
  consultantWhatsappConfig
} from '../../shared/schema';
import { eq, and, lte, isNotNull, desc, sql, gte } from 'drizzle-orm';
import { sendWhatsAppMessage } from '../whatsapp/twilio-client';
import twilio from 'twilio';
import { generateCheckinVariables } from '../ai/checkin-personalization-service';

let dailySchedulingJob: cron.ScheduledTask | null = null;
let processingJob: cron.ScheduledTask | null = null;
let isDailySchedulingRunning = false;
let isProcessingRunning = false;

const DAILY_SCHEDULING_INTERVAL = '0 8 * * *';
const PROCESSING_INTERVAL = '* * * * *';
const TIMEZONE = 'Europe/Rome';

interface TwilioTemplate {
  id: string;
  friendlyName: string;
  bodyText: string;
}

interface ClientContext {
  clientName?: string;
  lastExercise?: string;
  exerciseStatus?: string;
  daysSinceLastContact?: number;
  lastConsultationTopic?: string;
}

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

async function fetchTwilioTemplates(
  twilioAccountSid: string,
  twilioAuthToken: string,
  templateIds: string[]
): Promise<TwilioTemplate[]> {
  const templates: TwilioTemplate[] = [];
  
  if (templateIds.length === 0 || !twilioAccountSid || !twilioAuthToken) {
    return templates;
  }

  try {
    const twilioClient = twilio(twilioAccountSid, twilioAuthToken);
    
    const extractWhatsAppBody = (types: any): string => {
      if (types?.['twilio/whatsapp']?.template?.components) {
        const bodyComponent = types['twilio/whatsapp'].template.components.find(
          (component: any) => component.type === 'BODY'
        );
        return bodyComponent?.text || '';
      }
      return types?.['twilio/text']?.body || '';
    };

    for (const templateId of templateIds) {
      if (!templateId.startsWith('HX')) continue;
      
      try {
        const content = await twilioClient.content.v1.contents(templateId).fetch();
        templates.push({
          id: content.sid,
          friendlyName: content.friendlyName || content.sid,
          bodyText: extractWhatsAppBody(content.types),
        });
      } catch (err: any) {
        console.warn(`[WEEKLY-CHECKIN] Failed to fetch template ${templateId}: ${err.message}`);
      }
    }
  } catch (error: any) {
    console.error('[WEEKLY-CHECKIN] Error fetching Twilio templates:', error.message);
  }

  return templates;
}

async function scheduleCheckinForConsultant(
  config: typeof weeklyCheckinConfig.$inferSelect,
  currentDay: number
): Promise<number> {
  const consultantId = config.consultantId;
  
  if (!config.agentConfigId) {
    console.log(`⚠️ [WEEKLY-CHECKIN] Consultant ${consultantId}: no WhatsApp agent selected in config`);
    return 0;
  }

  const [agentConfig] = await db
    .select({
      id: consultantWhatsappConfig.id,
      twilioAccountSid: consultantWhatsappConfig.twilioAccountSid,
      twilioAuthToken: consultantWhatsappConfig.twilioAuthToken,
    })
    .from(consultantWhatsappConfig)
    .where(
      and(
        eq(consultantWhatsappConfig.id, config.agentConfigId),
        eq(consultantWhatsappConfig.consultantId, consultantId),
        eq(consultantWhatsappConfig.isActive, true)
      )
    )
    .limit(1);

  if (!agentConfig || !agentConfig.twilioAccountSid || !agentConfig.twilioAuthToken) {
    console.log(`⚠️ [WEEKLY-CHECKIN] Consultant ${consultantId}: selected WhatsApp agent not active or missing credentials`);
    return 0;
  }

  const templateIds = config.templateIds || [];
  if (templateIds.length === 0) {
    console.log(`⚠️ [WEEKLY-CHECKIN] Consultant ${consultantId}: no templates selected`);
    return 0;
  }

  const templates = await fetchTwilioTemplates(
    agentConfig.twilioAccountSid,
    agentConfig.twilioAuthToken,
    templateIds
  );

  if (templates.length === 0) {
    console.log(`⚠️ [WEEKLY-CHECKIN] Consultant ${consultantId}: no valid Twilio templates found`);
    return 0;
  }

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
        eq(users.enabledForWeeklyCheckin, true),
        isNotNull(users.phoneNumber)
      )
    );

  if (activeClients.length === 0) {
    console.log(`💤 [WEEKLY-CHECKIN] Consultant ${consultantId}: no clients enabled for weekly check-in`);
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

  let templateIndex = 0;
  let scheduled = 0;

  for (const client of selectedClients) {
    try {
      const scheduledTime = generateRandomTime(
        config.preferredTimeStart || '09:00',
        config.preferredTimeEnd || '18:00'
      );

      const template = templates[templateIndex % templates.length];
      templateIndex++;

      await db.insert(weeklyCheckinLogs).values({
        configId: config.id,
        consultantId,
        clientId: client.id,
        phoneNumber: client.phoneNumber!,
        scheduledFor: scheduledTime,
        scheduledDay: currentDay,
        scheduledHour: scheduledTime.getHours(),
        templateId: template.id,
        templateName: template.friendlyName,
        originalTemplateBody: template.bodyText,
        personalizedMessage: null,
        status: 'scheduled',
        retryCount: 0,
        aiPersonalizationContext: {
          clientName: client.firstName || undefined,
        },
      });

      scheduled++;
    } catch (error) {
      console.error(`❌ [WEEKLY-CHECKIN] Error scheduling for client ${client.id}:`, error);
    }
  }

  console.log(`✅ [WEEKLY-CHECKIN] Consultant ${consultantId}: ${scheduled} check-ins scheduled`);
  return scheduled;
}

function generateRandomTime(startTime: string, endTime: string): Date {
  const now = new Date();
  
  const [startHour, startMin] = startTime.split(':').map(Number);
  const [endHour, endMin] = endTime.split(':').map(Number);
  
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

        const isTemplateMessage = checkin.templateId?.startsWith('HX');
        
        let messageSid: string;
        
        if (isTemplateMessage && checkin.templateId) {
          // Generate AI-personalized variables for template
          let contentVariables: Record<string, string> | undefined;
          
          try {
            const variables = await generateCheckinVariables(checkin.clientId, checkin.consultantId);
            if (variables) {
              contentVariables = {
                '1': variables.name,
                '2': variables.aiMessage,
              };
              console.log(`[WEEKLY-CHECKIN] AI variables for ${checkin.clientId}: ${JSON.stringify(contentVariables)}`);
              
              // Update log with AI personalization
              await db.update(weeklyCheckinLogs)
                .set({
                  personalizedMessage: variables.aiMessage,
                  aiPersonalizationContext: {
                    clientName: variables.name,
                    aiMessage: variables.aiMessage,
                    generatedAt: new Date().toISOString(),
                  },
                  updatedAt: new Date(),
                })
                .where(eq(weeklyCheckinLogs.id, checkin.id));
            }
          } catch (aiError) {
            console.error(`[WEEKLY-CHECKIN] AI personalization failed for ${checkin.clientId}:`, aiError);
            // Continue with fallback - template without personalization
          }
          
          messageSid = await sendWhatsAppMessage(
            checkin.consultantId,
            checkin.phoneNumber,
            `Ciao ${contentVariables?.['1'] || 'Cliente'}! ${contentVariables?.['2'] || 'Come stai questa settimana?'}`,
            undefined,
            {
              contentSid: checkin.templateId,
              contentVariables,
              agentConfigId: agentConfig.id,
              conversationId: checkin.conversationId || undefined
            }
          );
        } else {
          const messageText = checkin.personalizedMessage || checkin.originalTemplateBody || 'Ciao! Come stai? 😊';
          messageSid = await sendWhatsAppMessage(
            checkin.consultantId,
            checkin.phoneNumber,
            messageText,
            undefined,
            {
              agentConfigId: agentConfig.id,
              conversationId: checkin.conversationId || undefined
            }
          );
        }

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

        console.log(`✅ [WEEKLY-CHECKIN] Sent check-in ${checkin.id} to ${checkin.phoneNumber} (template: ${checkin.templateId || 'text'})`);
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
