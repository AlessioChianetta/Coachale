/**
 * Weekly Check-in Schedule Service
 * 
 * This service handles the 4-week pre-planned calendar generation for the weekly check-in system.
 * It creates a deterministic schedule of check-in messages for clients, respecting:
 * - Excluded days
 * - Minimum days between contacts
 * - Template rotation
 * - Time preferences
 */

import { db } from '../db';
import {
  weeklyCheckinConfig,
  weeklyCheckinSchedule,
  users,
  consultantWhatsappConfig
} from '../../shared/schema';
import { eq, and, gte, lte, desc, sql } from 'drizzle-orm';
import twilio from 'twilio';

const TIMEZONE = 'Europe/Rome';

interface TwilioTemplate {
  id: string;
  friendlyName: string;
  bodyText: string;
}

interface ScheduleGenerationResult {
  scheduledCount: number;
  clients: string[];
  dateRange: {
    from: Date;
    to: Date;
  };
}

interface ClientWithPhone {
  id: string;
  firstName: string | null;
  lastName: string | null;
  phoneNumber: string;
}

/**
 * Get current date in Europe/Rome timezone
 */
function getRomeDate(): Date {
  const now = new Date();
  const romeOffset = getRomeTimezoneOffset(now);
  return new Date(now.getTime() + romeOffset * 60000);
}

/**
 * Get timezone offset for Europe/Rome in minutes
 * Handles DST transitions
 */
function getRomeTimezoneOffset(date: Date): number {
  const jan = new Date(date.getFullYear(), 0, 1);
  const jul = new Date(date.getFullYear(), 6, 1);
  
  const janOffset = jan.getTimezoneOffset();
  const julOffset = jul.getTimezoneOffset();
  
  const isDST = date.getMonth() >= 2 && date.getMonth() <= 9;
  const baseOffset = -60;
  
  return isDST ? baseOffset - 60 : baseOffset;
}

/**
 * Format date to YYYY-MM-DD string
 */
function formatDateToString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Fetch Twilio templates by their IDs
 */
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
        console.warn(`[SCHEDULE-SERVICE] Failed to fetch template ${templateId}: ${err.message}`);
      }
    }
  } catch (error: any) {
    console.error('[SCHEDULE-SERVICE] Error fetching Twilio templates:', error.message);
  }

  return templates;
}

/**
 * Generate a deterministic time within the specified range based on date and client ID
 * Uses a hash function to ensure same inputs always produce same outputs
 */
function deterministicTime(
  dateKey: string,
  clientId: string,
  preferredStart: string,
  preferredEnd: string
): { hour: number; minute: number } {
  const seed = dateKey + clientId;
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash) + seed.charCodeAt(i);
    hash = hash & hash;
  }
  hash = Math.abs(hash);
  
  const [startH, startM] = preferredStart.split(':').map(Number);
  const [endH, endM] = preferredEnd.split(':').map(Number);
  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;
  const windowSize = Math.max(endMinutes - startMinutes, 1);
  
  const targetMinutes = startMinutes + (hash % windowSize);
  return {
    hour: Math.floor(targetMinutes / 60),
    minute: targetMinutes % 60,
  };
}

/**
 * Main function to generate a 4-week schedule for a consultant
 */
export async function generateScheduleForWeeks(
  consultantId: string,
  weeks: number = 4
): Promise<ScheduleGenerationResult> {
  console.log(`[SCHEDULE-SERVICE] Generating ${weeks}-week schedule for consultant ${consultantId}`);
  
  // 1. Delete existing planned entries
  await db.delete(weeklyCheckinSchedule)
    .where(
      and(
        eq(weeklyCheckinSchedule.consultantId, consultantId),
        eq(weeklyCheckinSchedule.status, 'planned')
      )
    );
  
  console.log('[SCHEDULE-SERVICE] Deleted existing planned entries');
  
  // 2. Load configuration
  const [config] = await db
    .select()
    .from(weeklyCheckinConfig)
    .where(
      and(
        eq(weeklyCheckinConfig.consultantId, consultantId),
        eq(weeklyCheckinConfig.isEnabled, true)
      )
    )
    .limit(1);
  
  if (!config) {
    throw new Error(`No enabled weekly check-in config found for consultant ${consultantId}`);
  }
  
  if (!config.agentConfigId) {
    throw new Error(`No WhatsApp agent configured for weekly check-in`);
  }
  
  // Get WhatsApp agent config for Twilio credentials
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
    throw new Error(`WhatsApp agent not active or missing Twilio credentials`);
  }
  
  // Get all clients enabled for weekly check-in
  const clients = await db
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
        sql`${users.phoneNumber} IS NOT NULL`
      )
    );
  
  if (clients.length === 0) {
    console.log('[SCHEDULE-SERVICE] No clients enabled for weekly check-in');
    return {
      scheduledCount: 0,
      clients: [],
      dateRange: {
        from: new Date(),
        to: new Date()
      }
    };
  }
  
  const eligibleClients = clients.filter(c => c.phoneNumber) as ClientWithPhone[];
  console.log(`[SCHEDULE-SERVICE] Found ${eligibleClients.length} eligible clients`);
  
  // Get template IDs
  const templateIds = config.templateIds || [];
  if (templateIds.length === 0) {
    throw new Error(`No templates configured for weekly check-in`);
  }
  
  // 3. Fetch Twilio templates
  const templates = await fetchTwilioTemplates(
    agentConfig.twilioAccountSid,
    agentConfig.twilioAuthToken,
    templateIds
  );
  
  if (templates.length === 0) {
    throw new Error(`No valid Twilio templates found`);
  }
  
  console.log(`[SCHEDULE-SERVICE] Fetched ${templates.length} Twilio templates`);
  
  // 4. Generate schedule for N weeks
  const excludedDays = config.excludedDays || [];
  const minDaysBetweenContacts = config.minDaysSinceLastContact || 5;
  const preferredTimeStart = config.preferredTimeStart || '09:00';
  const preferredTimeEnd = config.preferredTimeEnd || '18:00';
  
  const today = getRomeDate();
  today.setHours(0, 0, 0, 0);
  
  const endDate = new Date(today);
  endDate.setDate(endDate.getDate() + (weeks * 7));
  
  // Track last scheduled date for each client
  const clientLastScheduled: Map<string, Date> = new Map();
  
  // Sort clients for deterministic ordering
  const sortedClients = [...eligibleClients].sort((a, b) => a.id.localeCompare(b.id));
  
  const scheduleEntries: Array<typeof weeklyCheckinSchedule.$inferInsert> = [];
  const scheduledClientIds = new Set<string>();
  
  let clientIndex = 0;
  const totalDays = weeks * 7;
  
  // Start from tomorrow (dayOffset = 1) to avoid scheduling for today with past times
  for (let dayOffset = 1; dayOffset <= totalDays; dayOffset++) {
    const currentDate = new Date(today);
    currentDate.setDate(currentDate.getDate() + dayOffset);
    
    const dayOfWeek = currentDate.getDay();
    const weekNumber = Math.floor(dayOffset / 7) + 1;
    
    // Skip excluded days
    if (excludedDays.includes(dayOfWeek)) {
      continue;
    }
    
    // Calculate deterministic template index
    const month = currentDate.getMonth();
    const year = currentDate.getFullYear();
    const templateIndex = (dayOffset + month * 31 + year) % templates.length;
    const template = templates[templateIndex];
    
    // Find eligible clients for this day (respecting min days between contacts)
    const eligibleForToday: ClientWithPhone[] = [];
    
    for (const client of sortedClients) {
      const lastScheduled = clientLastScheduled.get(client.id);
      
      if (!lastScheduled) {
        eligibleForToday.push(client);
      } else {
        const daysSinceLast = Math.floor(
          (currentDate.getTime() - lastScheduled.getTime()) / (1000 * 60 * 60 * 24)
        );
        if (daysSinceLast >= minDaysBetweenContacts) {
          eligibleForToday.push(client);
        }
      }
    }
    
    if (eligibleForToday.length === 0) {
      continue;
    }
    
    // Deterministic client selection using round-robin based on day offset
    const selectedClient = eligibleForToday[clientIndex % eligibleForToday.length];
    clientIndex++;
    
    // Generate deterministic time based on date and client ID
    const dateKey = formatDateToString(currentDate);
    const { hour, minute } = deterministicTime(dateKey, selectedClient.id, preferredTimeStart, preferredTimeEnd);
    
    // Create schedule entry
    scheduleEntries.push({
      configId: config.id,
      consultantId,
      clientId: selectedClient.id,
      phoneNumber: selectedClient.phoneNumber,
      scheduledDate: formatDateToString(currentDate),
      scheduledHour: hour,
      scheduledMinute: minute,
      templateId: template.id,
      templateName: template.friendlyName,
      status: 'planned',
      weekNumber,
      dayOfWeek,
      generatedAt: new Date(),
    });
    
    // Update tracking
    clientLastScheduled.set(selectedClient.id, currentDate);
    scheduledClientIds.add(selectedClient.id);
  }
  
  // 5. Insert all schedule entries
  if (scheduleEntries.length > 0) {
    await db.insert(weeklyCheckinSchedule).values(scheduleEntries);
  }
  
  console.log(`[SCHEDULE-SERVICE] Created ${scheduleEntries.length} schedule entries`);
  
  // 6. Return summary
  return {
    scheduledCount: scheduleEntries.length,
    clients: Array.from(scheduledClientIds),
    dateRange: {
      from: today,
      to: endDate
    }
  };
}

/**
 * Get schedule entries for a consultant within a date range
 */
export async function getScheduleForConsultant(
  consultantId: string,
  startDate?: Date,
  endDate?: Date
): Promise<Array<typeof weeklyCheckinSchedule.$inferSelect>> {
  const conditions = [eq(weeklyCheckinSchedule.consultantId, consultantId)];
  
  if (startDate) {
    conditions.push(gte(weeklyCheckinSchedule.scheduledDate, formatDateToString(startDate)));
  }
  
  if (endDate) {
    conditions.push(lte(weeklyCheckinSchedule.scheduledDate, formatDateToString(endDate)));
  }
  
  const entries = await db
    .select()
    .from(weeklyCheckinSchedule)
    .where(and(...conditions))
    .orderBy(weeklyCheckinSchedule.scheduledDate, weeklyCheckinSchedule.scheduledHour);
  
  return entries;
}

/**
 * Update the status of a schedule entry
 */
export async function updateScheduleStatus(
  scheduleId: string,
  status: 'pending' | 'sent' | 'failed' | 'skipped',
  skipReason?: string
): Promise<void> {
  const updateData: Partial<typeof weeklyCheckinSchedule.$inferInsert> = {
    status,
    updatedAt: new Date(),
  };
  
  if (skipReason) {
    updateData.skipReason = skipReason;
  }
  
  if (status === 'sent' || status === 'failed') {
    updateData.executedAt = new Date();
  }
  
  await db.update(weeklyCheckinSchedule)
    .set(updateData)
    .where(eq(weeklyCheckinSchedule.id, scheduleId));
}

/**
 * Cancel a scheduled entry
 */
export async function cancelScheduleEntry(
  scheduleId: string,
  reason: string
): Promise<void> {
  await db.update(weeklyCheckinSchedule)
    .set({
      status: 'cancelled',
      skipReason: reason,
      updatedAt: new Date(),
    })
    .where(eq(weeklyCheckinSchedule.id, scheduleId));
}

/**
 * Get pending schedule entries that need to be processed
 * (status = 'planned' and scheduledDate/time has passed)
 */
export async function getPendingScheduleEntries(
  consultantId?: string
): Promise<Array<typeof weeklyCheckinSchedule.$inferSelect>> {
  const now = getRomeDate();
  const todayStr = formatDateToString(now);
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  
  const conditions = [
    eq(weeklyCheckinSchedule.status, 'planned'),
    sql`(
      ${weeklyCheckinSchedule.scheduledDate} < ${todayStr}
      OR (
        ${weeklyCheckinSchedule.scheduledDate} = ${todayStr}
        AND (
          ${weeklyCheckinSchedule.scheduledHour} < ${currentHour}
          OR (
            ${weeklyCheckinSchedule.scheduledHour} = ${currentHour}
            AND ${weeklyCheckinSchedule.scheduledMinute} <= ${currentMinute}
          )
        )
      )
    )`
  ];
  
  if (consultantId) {
    conditions.push(eq(weeklyCheckinSchedule.consultantId, consultantId));
  }
  
  const entries = await db
    .select()
    .from(weeklyCheckinSchedule)
    .where(and(...conditions))
    .orderBy(weeklyCheckinSchedule.scheduledDate, weeklyCheckinSchedule.scheduledHour)
    .limit(50);
  
  return entries;
}

/**
 * Link a schedule entry to its execution log
 */
export async function linkScheduleToLog(
  scheduleId: string,
  logId: string
): Promise<void> {
  await db.update(weeklyCheckinSchedule)
    .set({
      executedLogId: logId,
      executedAt: new Date(),
      status: 'sent',
      updatedAt: new Date(),
    })
    .where(eq(weeklyCheckinSchedule.id, scheduleId));
}

/**
 * Regenerate the schedule for a consultant
 * This is a wrapper that cleans up and regenerates
 */
export async function regenerateSchedule(
  consultantId: string,
  weeks: number = 4
): Promise<ScheduleGenerationResult> {
  console.log(`[SCHEDULE-SERVICE] Regenerating ${weeks}-week schedule for consultant ${consultantId}`);
  
  const result = await generateScheduleForWeeks(consultantId, weeks);
  
  // Mark as regenerated
  if (result.scheduledCount > 0) {
    await db.update(weeklyCheckinSchedule)
      .set({ regeneratedAt: new Date() })
      .where(
        and(
          eq(weeklyCheckinSchedule.consultantId, consultantId),
          eq(weeklyCheckinSchedule.status, 'planned')
        )
      );
  }
  
  return result;
}
