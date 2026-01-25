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
 * Get ISO week number for a date
 * ISO weeks start on Monday and week 1 is the week containing January 4th
 */
function getISOWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7; // Make Sunday = 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum); // Set to nearest Thursday
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return weekNo;
}

/**
 * Get ISO week year (may differ from calendar year at year boundaries)
 */
function getISOWeekYear(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  return d.getUTCFullYear();
}

/**
 * Get the Monday of the ISO week containing the given date
 */
function getISOWeekMonday(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const dayOfWeek = d.getDay();
  // ISO weeks start on Monday (1), Sunday is 0
  const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  d.setDate(d.getDate() - daysFromMonday);
  return d;
}

/**
 * Get all dates in an ISO week (Monday to Sunday)
 */
function getISOWeekDates(weekMonday: Date): Date[] {
  const dates: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekMonday);
    d.setDate(weekMonday.getDate() + i);
    dates.push(d);
  }
  return dates;
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
 * INCREMENTAL MODE: Does NOT delete existing entries - only adds new ones for uncovered dates
 * Also rotates days of the week for each client across weeks
 */
export async function generateScheduleForWeeks(
  consultantId: string,
  weeks: number = 4
): Promise<ScheduleGenerationResult> {
  console.log(`[SCHEDULE-SERVICE] Generating ${weeks}-week schedule for consultant ${consultantId} (incremental mode)`);
  
  // 1. Load existing planned entries to avoid duplicates
  const existingEntries = await db
    .select({
      clientId: weeklyCheckinSchedule.clientId,
      scheduledDate: weeklyCheckinSchedule.scheduledDate,
      dayOfWeek: weeklyCheckinSchedule.dayOfWeek,
    })
    .from(weeklyCheckinSchedule)
    .where(
      and(
        eq(weeklyCheckinSchedule.consultantId, consultantId),
        sql`${weeklyCheckinSchedule.status} IN ('planned', 'pending', 'sent')`
      )
    );
  
  // Build a set of existing (clientId, date) pairs to skip
  const existingSchedules = new Set(
    existingEntries.map(e => `${e.clientId}|${e.scheduledDate}`)
  );
  
  // Build a set of weeks that already have a scheduled entry per client
  // Key format: "clientId|ISOYear-WweekNumber" using ISO week year (not calendar year)
  const clientWeeksCovered = new Set<string>();
  for (const entry of existingEntries) {
    const entryDate = new Date(entry.scheduledDate);
    const weekNumber = getISOWeekNumber(entryDate);
    const isoYear = getISOWeekYear(entryDate);
    const weekKey = `${entry.clientId}|${isoYear}-W${weekNumber}`;
    clientWeeksCovered.add(weekKey);
  }
  
  // Track last used day of week per client for rotation (find the most recent entry)
  const clientLastDayOfWeek = new Map<string, number>();
  const clientLastScheduledDate = new Map<string, string>();
  
  for (const entry of existingEntries) {
    const currentDate = clientLastScheduledDate.get(entry.clientId);
    // Use >= to ensure we get the day from the most recent date
    if (currentDate === undefined || entry.scheduledDate >= currentDate) {
      clientLastScheduledDate.set(entry.clientId, entry.scheduledDate);
      // Use explicit null check for dayOfWeek since 0 (Sunday) is valid
      if (entry.dayOfWeek !== null && entry.dayOfWeek !== undefined) {
        clientLastDayOfWeek.set(entry.clientId, entry.dayOfWeek);
      }
    }
  }
  
  console.log(`[SCHEDULE-SERVICE] Found ${existingEntries.length} existing entries, will add only new ones`);
  
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
  
  // Get all users enabled for weekly check-in (includes clients AND consultants who are clients of another consultant)
  // The key is consultant_id pointing to this consultant, not the role
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
  
  // Build list of allowed days (0=Sunday, 1=Monday, ..., 6=Saturday)
  const allowedDays = [0, 1, 2, 3, 4, 5, 6].filter(d => !excludedDays.includes(d));
  if (allowedDays.length === 0) {
    console.log('[SCHEDULE-SERVICE] All days are excluded, cannot schedule');
    return {
      scheduledCount: 0,
      clients: [],
      dateRange: { from: today, to: endDate }
    };
  }
  
  // Sort clients for deterministic ordering
  const sortedClients = [...eligibleClients].sort((a, b) => a.id.localeCompare(b.id));
  
  const scheduleEntries: Array<typeof weeklyCheckinSchedule.$inferInsert> = [];
  const scheduledClientIds = new Set<string>();
  
  // For each week, schedule each client on a rotating day
  // Start from current ISO week (if there are future days) or next week
  const todayMonday = getISOWeekMonday(today);
  
  // Collect unique ISO weeks to schedule (starting from current/next week)
  // IMPORTANT: Always collect exactly `weeks` valid weeks, skipping past weeks
  const weeksToSchedule: Array<{ monday: Date; isoWeekKey: string; weekNumber: number; weekYear: number }> = [];
  
  let weekOffset = 0;
  while (weeksToSchedule.length < weeks) {
    // Get the Monday of the target week
    const targetMonday = new Date(todayMonday);
    targetMonday.setDate(todayMonday.getDate() + (weekOffset * 7));
    weekOffset++;
    
    // If current week and all days have passed, skip to next week
    const weekSunday = new Date(targetMonday);
    weekSunday.setDate(targetMonday.getDate() + 6);
    if (weekSunday <= today) {
      continue; // Entire week is in the past, try next
    }
    
    // Check if this week has at least 2 allowed days remaining (to avoid partial weeks)
    const remainingAllowedDays = allowedDays.filter(dayOfWeek => {
      const dayDate = new Date(targetMonday);
      dayDate.setDate(targetMonday.getDate() + (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
      return dayDate > today && dayDate <= weekSunday;
    });
    
    // Skip weeks with less than 2 allowed days remaining (too partial)
    if (weeksToSchedule.length === 0 && remainingAllowedDays.length < 2) {
      continue; // First week is too partial, skip to next
    }
    
    const targetWeekNumber = getISOWeekNumber(targetMonday);
    const targetWeekYear = getISOWeekYear(targetMonday);
    const isoWeekKey = `${targetWeekYear}-W${targetWeekNumber}`;
    
    weeksToSchedule.push({
      monday: targetMonday,
      isoWeekKey,
      weekNumber: targetWeekNumber,
      weekYear: targetWeekYear
    });
    
    // Safety limit to prevent infinite loop
    if (weekOffset > 52) break;
  }
  
  console.log(`[SCHEDULE-SERVICE] Planning ${weeksToSchedule.length} weeks: ${weeksToSchedule.map(w => w.isoWeekKey).join(', ')}`);
  
  for (let weekIdx = 0; weekIdx < weeksToSchedule.length; weekIdx++) {
    const weekInfo = weeksToSchedule[weekIdx];
    const { monday: targetMonday, isoWeekKey, weekNumber: targetWeekNumber, weekYear: targetWeekYear } = weekInfo;
    
    // Get all dates in this ISO week
    const weekDates = getISOWeekDates(targetMonday);
    
    for (const client of sortedClients) {
      // Check if this week is already covered for this client
      const weekKey = `${client.id}|${isoWeekKey}`;
      if (clientWeeksCovered.has(weekKey)) {
        continue; // Skip - already has an entry for this week
      }
      
      // Get last used day of week for this client, rotate to next allowed day
      const lastDayOfWeek = clientLastDayOfWeek.get(client.id);
      let preferredDayOfWeek: number;
      
      if (lastDayOfWeek === undefined) {
        // First time: use deterministic day based on client ID
        const hash = client.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
        preferredDayOfWeek = allowedDays[hash % allowedDays.length];
      } else {
        // Rotate to next allowed day
        const currentIndex = allowedDays.indexOf(lastDayOfWeek);
        if (currentIndex === -1) {
          // Last day is now excluded, pick first allowed
          preferredDayOfWeek = allowedDays[0];
        } else {
          // Rotate to next day in allowed list
          preferredDayOfWeek = allowedDays[(currentIndex + 1) % allowedDays.length];
        }
      }
      
      // Try to find a valid date in this week, starting with preferred day
      // If preferred day doesn't satisfy minDays, try other allowed days
      let targetDate: Date | null = null;
      let actualDayOfWeek: number = preferredDayOfWeek;
      
      // Build list of days to try: preferred first, then others in rotation order
      const daysToTry: number[] = [];
      const preferredIndex = allowedDays.indexOf(preferredDayOfWeek);
      for (let i = 0; i < allowedDays.length; i++) {
        const dayIndex = (preferredIndex + i) % allowedDays.length;
        daysToTry.push(allowedDays[dayIndex]);
      }
      
      for (const tryDayOfWeek of daysToTry) {
        // Find the date for this day in the ISO week
        const checkDate = weekDates.find(d => d.getDay() === tryDayOfWeek);
        
        if (!checkDate) continue;
        
        // Must be in the future
        if (checkDate <= today) continue;
        // Must be within our planning window
        if (checkDate > endDate) continue;
        
        const dateKey = formatDateToString(checkDate);
        const scheduleKey = `${client.id}|${dateKey}`;
        
        // Skip if already scheduled for this date
        if (existingSchedules.has(scheduleKey)) continue;
        
        // Check minimum days since last scheduled
        const lastScheduled = clientLastScheduledDate.get(client.id);
        if (lastScheduled) {
          const lastDate = new Date(lastScheduled);
          const daysSinceLast = Math.floor(
            (checkDate.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24)
          );
          if (daysSinceLast < minDaysBetweenContacts) continue;
        }
        
        // Found a valid date!
        targetDate = checkDate;
        actualDayOfWeek = tryDayOfWeek;
        break;
      }
      
      if (!targetDate) continue; // No valid day found for this week
      
      const dateKey = formatDateToString(targetDate);
      
      // Calculate template (rotate through templates)
      const weekNumber = weekIdx + 1;
      const templateIndex = (weekIdx + client.id.charCodeAt(0)) % templates.length;
      const template = templates[templateIndex];
      
      // Generate deterministic time
      const { hour, minute } = deterministicTime(dateKey, client.id, preferredTimeStart, preferredTimeEnd);
      
      // Create schedule entry
      scheduleEntries.push({
        configId: config.id,
        consultantId,
        clientId: client.id,
        phoneNumber: client.phoneNumber,
        scheduledDate: dateKey,
        scheduledHour: hour,
        scheduledMinute: minute,
        templateId: template.id,
        templateName: template.friendlyName,
        status: 'planned',
        weekNumber,
        dayOfWeek: actualDayOfWeek,
        generatedAt: new Date(),
      });
      
      // Update tracking for next iteration
      clientLastDayOfWeek.set(client.id, actualDayOfWeek);
      clientLastScheduledDate.set(client.id, dateKey);
      existingSchedules.add(`${client.id}|${dateKey}`);
      clientWeeksCovered.add(weekKey);
      scheduledClientIds.add(client.id);
    }
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
 * Now includes client name via JOIN with users table
 */
export async function getScheduleForConsultant(
  consultantId: string,
  startDate?: Date,
  endDate?: Date
): Promise<Array<typeof weeklyCheckinSchedule.$inferSelect & { clientName?: string }>> {
  const conditions = [eq(weeklyCheckinSchedule.consultantId, consultantId)];
  
  if (startDate) {
    conditions.push(gte(weeklyCheckinSchedule.scheduledDate, formatDateToString(startDate)));
  }
  
  if (endDate) {
    conditions.push(lte(weeklyCheckinSchedule.scheduledDate, formatDateToString(endDate)));
  }
  
  const entries = await db
    .select({
      id: weeklyCheckinSchedule.id,
      configId: weeklyCheckinSchedule.configId,
      consultantId: weeklyCheckinSchedule.consultantId,
      clientId: weeklyCheckinSchedule.clientId,
      phoneNumber: weeklyCheckinSchedule.phoneNumber,
      scheduledDate: weeklyCheckinSchedule.scheduledDate,
      scheduledHour: weeklyCheckinSchedule.scheduledHour,
      scheduledMinute: weeklyCheckinSchedule.scheduledMinute,
      templateId: weeklyCheckinSchedule.templateId,
      templateName: weeklyCheckinSchedule.templateName,
      status: weeklyCheckinSchedule.status,
      executedLogId: weeklyCheckinSchedule.executedLogId,
      executedAt: weeklyCheckinSchedule.executedAt,
      skipReason: weeklyCheckinSchedule.skipReason,
      weekNumber: weeklyCheckinSchedule.weekNumber,
      dayOfWeek: weeklyCheckinSchedule.dayOfWeek,
      generatedAt: weeklyCheckinSchedule.generatedAt,
      regeneratedAt: weeklyCheckinSchedule.regeneratedAt,
      createdAt: weeklyCheckinSchedule.createdAt,
      updatedAt: weeklyCheckinSchedule.updatedAt,
      clientName: sql<string>`CONCAT(${users.firstName}, ' ', ${users.lastName})`.as('clientName'),
    })
    .from(weeklyCheckinSchedule)
    .leftJoin(users, eq(weeklyCheckinSchedule.clientId, users.id))
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
