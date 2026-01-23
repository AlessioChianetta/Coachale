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
  weeklyCheckinSchedule,
  users,
  whatsappConversations,
  whatsappMessages,
  exercises,
  consultations,
  consultantWhatsappConfig
} from '../../shared/schema';
import { eq, and, lte, isNotNull, desc, sql, gte } from 'drizzle-orm';
import { format } from 'date-fns-tz';
import { sendWhatsAppMessage } from '../whatsapp/twilio-client';
import twilio from 'twilio';
import { generateCheckinVariables } from '../ai/checkin-personalization-service';
import { normalizePhoneNumber } from '../whatsapp/webhook-handler';
import { generateScheduleForWeeks } from '../services/weekly-checkin-schedule-service';

/**
 * Get or create a WhatsApp conversation for check-in messages
 * This ensures the check-in message appears in conversation history for AI context
 */
async function getOrCreateConversationForCheckin(
  phoneNumber: string,
  consultantId: string,
  agentConfigId: string,
  clientId?: string | null
): Promise<string> {
  // Use consistent phone normalization from webhook-handler
  const normalizedPhone = normalizePhoneNumber(phoneNumber);
  
  let [conversation] = await db
    .select({ id: whatsappConversations.id })
    .from(whatsappConversations)
    .where(
      and(
        eq(whatsappConversations.phoneNumber, normalizedPhone),
        eq(whatsappConversations.consultantId, consultantId),
        eq(whatsappConversations.agentConfigId, agentConfigId)
      )
    )
    .limit(1);
  
  if (conversation) {
    return conversation.id;
  }
  
  [conversation] = await db
    .select({ id: whatsappConversations.id })
    .from(whatsappConversations)
    .where(
      and(
        eq(whatsappConversations.phoneNumber, normalizedPhone),
        eq(whatsappConversations.consultantId, consultantId)
      )
    )
    .limit(1);
  
  if (conversation) {
    return conversation.id;
  }
  
  const [newConversation] = await db
    .insert(whatsappConversations)
    .values({
      phoneNumber: normalizedPhone,
      consultantId,
      userId: clientId || null,
      isLead: !clientId,
      aiEnabled: true,
      isActive: true,
      agentConfigId,
    })
    .returning({ id: whatsappConversations.id });
  
  console.log(`[WEEKLY-CHECKIN] Created new conversation ${newConversation.id} for ${normalizedPhone}`);
  return newConversation.id;
}

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
    const todayStr = format(now, 'yyyy-MM-dd', { timeZone: TIMEZONE });
    const currentDay = now.getDay();
    
    // STEP 1: Auto-regenerate calendars for all enabled consultants
    console.log('🔄 [WEEKLY-CHECKIN] Auto-regenerating calendars for all enabled consultants...');
    const enabledConfigs = await db
      .select()
      .from(weeklyCheckinConfig)
      .where(eq(weeklyCheckinConfig.isEnabled, true));
    
    let totalRegenerated = 0;
    for (const config of enabledConfigs) {
      try {
        const result = await generateScheduleForWeeks(config.consultantId, 4);
        console.log(`   ✅ Consultant ${config.consultantId}: ${result.scheduledCount} entries generated`);
        totalRegenerated += result.scheduledCount;
      } catch (error) {
        console.error(`   ❌ Failed to regenerate for ${config.consultantId}:`, error);
      }
    }
    console.log(`📊 [WEEKLY-CHECKIN] Regenerated ${totalRegenerated} total entries for ${enabledConfigs.length} consultants`);
    
    // STEP 2: Activate today's entries from the pre-planned schedule table
    const activatedCount = await activateTodaysScheduleEntries(todayStr);
    
    if (activatedCount > 0) {
      console.log(`📊 [WEEKLY-CHECKIN] Activated ${activatedCount} pre-planned entries for today`);
    }
    
    // LEGACY FALLBACK: If no pre-planned entries, fall back to old on-the-fly scheduling
    if (activatedCount === 0) {
      console.log('💡 [WEEKLY-CHECKIN] No pre-planned entries, using legacy scheduling...');
      
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
      
      console.log(`   📅 Legacy scheduled: ${totalScheduled}`);
      console.log(`   ⏭️ Legacy skipped: ${totalSkipped}`);
    }

    await db.update(weeklyCheckinConfig)
      .set({ lastRunAt: new Date() })
      .where(eq(weeklyCheckinConfig.isEnabled, true));

    const duration = Date.now() - startTime;
    console.log(`📈 [WEEKLY-CHECKIN] Daily scheduling completed in ${duration}ms`);
    
  } finally {
    isDailySchedulingRunning = false;
  }
}

/**
 * Activate today's pre-planned schedule entries
 * Changes status from 'planned' to 'pending' and creates corresponding log entries
 * Includes duplicate prevention check to avoid re-processing already activated entries
 */
async function activateTodaysScheduleEntries(todayStr: string): Promise<number> {
  // Find all 'planned' entries for today (only 'planned' status, not already processed)
  const todaysEntries = await db
    .select()
    .from(weeklyCheckinSchedule)
    .where(
      and(
        eq(weeklyCheckinSchedule.scheduledDate, todayStr),
        eq(weeklyCheckinSchedule.status, 'planned')
      )
    );
  
  if (todaysEntries.length === 0) {
    return 0;
  }
  
  console.log(`📋 [WEEKLY-CHECKIN] Found ${todaysEntries.length} planned entries for ${todayStr}`);
  
  let activated = 0;
  
  for (const entry of todaysEntries) {
    try {
      // Duplicate prevention: Check if this entry already has an associated log entry
      if (entry.executedLogId) {
        console.log(`⏭️ [WEEKLY-CHECKIN] Entry ${entry.id} already has log ${entry.executedLogId}, skipping`);
        continue;
      }
      
      // Create scheduled time from entry data
      const scheduledFor = new Date(`${entry.scheduledDate}T${String(entry.scheduledHour).padStart(2, '0')}:${String(entry.scheduledMinute).padStart(2, '0')}:00`);
      
      // Create a log entry for processing
      const [logEntry] = await db.insert(weeklyCheckinLogs).values({
        configId: entry.configId,
        consultantId: entry.consultantId,
        clientId: entry.clientId,
        phoneNumber: entry.phoneNumber,
        scheduledFor,
        scheduledDay: entry.dayOfWeek,
        scheduledHour: entry.scheduledHour,
        templateId: entry.templateId,
        templateName: entry.templateName,
        originalTemplateBody: null,
        personalizedMessage: null,
        status: 'scheduled',
        retryCount: 0,
        aiPersonalizationContext: null,
      }).returning({ id: weeklyCheckinLogs.id });
      
      // Update schedule entry to 'pending' and link to log
      await db.update(weeklyCheckinSchedule)
        .set({
          status: 'pending',
          executedLogId: logEntry.id,
          updatedAt: new Date(),
        })
        .where(eq(weeklyCheckinSchedule.id, entry.id));
      
      activated++;
    } catch (error) {
      console.error(`❌ [WEEKLY-CHECKIN] Error activating schedule entry ${entry.id}:`, error);
      
      // Mark as skipped with error
      await db.update(weeklyCheckinSchedule)
        .set({
          status: 'skipped',
          skipReason: `Activation error: ${error instanceof Error ? error.message : 'Unknown'}`,
          updatedAt: new Date(),
        })
        .where(eq(weeklyCheckinSchedule.id, entry.id));
    }
  }
  
  return activated;
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
      userId: whatsappConversations.userId,
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
      .filter(c => c.userId)
      .map(c => c.userId!)
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
        // Get the agent from the weekly checkin config, not just any active agent
        const [config] = await db
          .select()
          .from(weeklyCheckinConfig)
          .where(eq(weeklyCheckinConfig.consultantId, checkin.consultantId))
          .limit(1);
        
        if (!config?.agentConfigId) {
          console.error(`⚠️ [WEEKLY-CHECKIN] No agent configured in weekly check-in settings for ${checkin.consultantId}`);
          await db.update(weeklyCheckinLogs)
            .set({
              status: 'failed',
              errorMessage: 'No agent configured in weekly check-in settings',
              updatedAt: new Date(),
            })
            .where(eq(weeklyCheckinLogs.id, checkin.id));
          continue;
        }
        
        const [agentConfig] = await db
          .select()
          .from(consultantWhatsappConfig)
          .where(
            and(
              eq(consultantWhatsappConfig.id, config.agentConfigId),
              eq(consultantWhatsappConfig.consultantId, checkin.consultantId),
              eq(consultantWhatsappConfig.isActive, true)
            )
          )
          .limit(1);

        if (!agentConfig) {
          console.error(`⚠️ [WEEKLY-CHECKIN] Configured agent ${config.agentConfigId} not found or inactive`);
          await db.update(weeklyCheckinLogs)
            .set({
              status: 'failed',
              errorMessage: 'Configured WhatsApp agent not found or inactive',
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
          
          // Get or create conversation for history tracking
          const conversationId = checkin.conversationId || await getOrCreateConversationForCheckin(
            checkin.phoneNumber,
            checkin.consultantId,
            agentConfig.id,
            checkin.clientId
          );
          
          const messageTextToSend = `Ciao ${contentVariables?.['1'] || 'Cliente'}! ${contentVariables?.['2'] || 'Come stai questa settimana?'}`;
          
          messageSid = await sendWhatsAppMessage(
            checkin.consultantId,
            checkin.phoneNumber,
            messageTextToSend,
            undefined,
            {
              contentSid: checkin.templateId,
              contentVariables,
              agentConfigId: agentConfig.id,
              conversationId
            }
          );
          
          // Save message to conversation history so AI has context when client responds
          // Use twilioSid (not twilioMessageSid) to match schema, with onConflictDoNothing for retry safety
          await db.insert(whatsappMessages).values({
            conversationId,
            messageText: messageTextToSend,
            direction: "outbound",
            sender: "ai",
            twilioSid: messageSid,
            metadata: {
              type: "weekly_checkin",
              templateId: checkin.templateId,
              isAutomated: true,
            },
          }).onConflictDoNothing();
          console.log(`[WEEKLY-CHECKIN] Saved check-in message to conversation history (conversation: ${conversationId})`);
        } else {
          // Get or create conversation for history tracking
          const conversationId = checkin.conversationId || await getOrCreateConversationForCheckin(
            checkin.phoneNumber,
            checkin.consultantId,
            agentConfig.id,
            checkin.clientId
          );
          
          const messageText = checkin.personalizedMessage || checkin.originalTemplateBody || 'Ciao! Come stai? 😊';
          messageSid = await sendWhatsAppMessage(
            checkin.consultantId,
            checkin.phoneNumber,
            messageText,
            undefined,
            {
              agentConfigId: agentConfig.id,
              conversationId
            }
          );
          
          // Save message to conversation history so AI has context when client responds
          // Use twilioSid (not twilioMessageSid) to match schema, with onConflictDoNothing for retry safety
          await db.insert(whatsappMessages).values({
            conversationId,
            messageText: messageText,
            direction: "outbound",
            sender: "ai",
            twilioSid: messageSid,
            metadata: {
              type: "weekly_checkin",
              isAutomated: true,
            },
          }).onConflictDoNothing();
          console.log(`[WEEKLY-CHECKIN] Saved check-in message to conversation history (conversation: ${conversationId})`);
        }

        await db.update(weeklyCheckinLogs)
          .set({
            status: 'sent',
            twilioMessageSid: messageSid,
            sentAt: new Date(),
            updatedAt: new Date()
          })
          .where(eq(weeklyCheckinLogs.id, checkin.id));

        // Also update the schedule entry status to 'sent'
        await db.update(weeklyCheckinSchedule)
          .set({
            status: 'sent',
            updatedAt: new Date()
          })
          .where(eq(weeklyCheckinSchedule.executedLogId, checkin.id));

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

        // Also update the schedule entry status if max retries reached
        if (retryCount >= maxRetries) {
          await db.update(weeklyCheckinSchedule)
            .set({
              status: 'failed',
              skipReason: error.message || 'Max retries exceeded',
              updatedAt: new Date()
            })
            .where(eq(weeklyCheckinSchedule.executedLogId, checkin.id));
        }
      }
    }
  } finally {
    isProcessingRunning = false;
  }
}
