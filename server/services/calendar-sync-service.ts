// Google Calendar Sync Service
// Periodically syncs changes from Google Calendar to local database
// Detects modifications and deletions of appointments
// Uses node-cron for scheduling with duplicate prevention

import cron from "node-cron";
import type { ScheduledTask } from "node-cron";
import { db } from "../db";
import {
  consultantAvailabilitySettings,
  appointmentBookings,
  users,
} from "../../shared/schema";
import { eq, and, isNotNull, sql, inArray } from "drizzle-orm";
import { fetchGoogleCalendarEvents } from "../google-calendar-service";

const SYNC_KEY = Symbol.for("app.calendarSync");

interface SyncRegistry {
  task: ScheduledTask | null;
  registrationId: string | null;
}

declare global {
  var __calendarSyncRegistry: SyncRegistry | undefined;
}

function getRegistry(): SyncRegistry {
  if (!globalThis.__calendarSyncRegistry) {
    globalThis.__calendarSyncRegistry = {
      task: null,
      registrationId: null,
    };
  }
  return globalThis.__calendarSyncRegistry;
}

/**
 * Sync Google Calendar events for a single consultant
 * Detects modifications and deletions
 */
async function syncCalendarForConsultant(consultantId: string): Promise<void> {
  try {
    console.log(`\n🔄 [CALENDAR SYNC] Starting sync for consultant ${consultantId}`);

    // Check if consultant has Google Calendar connected
    const [settings] = await db
      .select()
      .from(consultantAvailabilitySettings)
      .where(eq(consultantAvailabilitySettings.consultantId, consultantId))
      .limit(1);

    if (!settings?.googleAccessToken) {
      console.log(`⏭️  [CALENDAR SYNC] Consultant ${consultantId} - no Google Calendar connected`);
      return;
    }

    // Fetch events from Google Calendar (next 90 days)
    const now = new Date();
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 90);

    const googleEvents = await fetchGoogleCalendarEvents(consultantId, now, futureDate);

    // CRITICAL FIX: Fetch ONLY appointments within the same 90-day window from database
    // This prevents false deletions of appointments beyond the Google fetch window
    const localAppointments = await db
      .select()
      .from(appointmentBookings)
      .where(
        and(
          eq(appointmentBookings.consultantId, consultantId),
          isNotNull(appointmentBookings.confirmedAt),
          isNotNull(appointmentBookings.googleEventId),
          // Only check appointments within the sync window
          sql`${appointmentBookings.appointmentDate} >= ${now.toISOString().split('T')[0]}`,
          sql`${appointmentBookings.appointmentDate} <= ${futureDate.toISOString().split('T')[0]}`
        )
      );

    if (localAppointments.length === 0) {
      console.log(`✅ [CALENDAR SYNC] No confirmed appointments to sync for consultant ${consultantId} in the next 90 days`);
      return;
    }

    console.log(`📊 [CALENDAR SYNC] Found ${localAppointments.length} confirmed appointment(s) to verify in sync window`);
    console.log(`   Sync window: ${now.toISOString().split('T')[0]} to ${futureDate.toISOString().split('T')[0]}`);

    // Create a map of Google events by ID for quick lookup
    const googleEventsMap = new Map(
      googleEvents.map(event => [event.id, event])
    );

    console.log(`📅 [CALENDAR SYNC] Fetched ${googleEvents.length} event(s) from Google Calendar`);

    // Check each local appointment against Google Calendar
    let deletedCount = 0;
    let modifiedCount = 0;

    for (const appointment of localAppointments) {
      // SAFETY CHECK: Validate appointment has required fields
      if (!appointment.id || !appointment.appointmentDate || !appointment.appointmentTime || !appointment.googleEventId) {
        console.warn(`⚠️  [CALENDAR SYNC] Skipping appointment with missing required fields:`, {
          id: appointment.id || 'MISSING',
          date: appointment.appointmentDate || 'MISSING',
          time: appointment.appointmentTime || 'MISSING',
          googleEventId: appointment.googleEventId || 'MISSING',
          status: appointment.status || 'MISSING'
        });
        continue;
      }

      const googleEvent = googleEventsMap.get(appointment.googleEventId!);

      // CASE 1: Event deleted from Google Calendar
      if (!googleEvent) {
        console.log(`🗑️  [CALENDAR SYNC] Event deleted from Google Calendar`);
        console.log(`   📋 Event Details:`);
        console.log(`      🆔 Appointment ID: ${appointment.id}`);
        console.log(`      📅 Google Event ID: ${appointment.googleEventId}`);
        console.log(`      📅 Date: ${appointment.appointmentDate} ${appointment.appointmentTime}`);
        console.log(`      👤 Client: ${appointment.clientPhone} / ${appointment.clientEmail}`);
        console.log(`      📊 Status: ${appointment.status}`);
        console.log(`      🔖 Source: Manual/AI (deleted from Calendar)`);

        // Mark appointment as cancelled
        await db
          .update(appointmentBookings)
          .set({
            status: 'cancelled',
            cancelledAt: new Date(),
            cancellationReason: 'Cancellato dal calendario Google',
            googleEventId: null, // Remove Google event ID
          })
          .where(eq(appointmentBookings.id, appointment.id));

        deletedCount++;
        continue;
      }

      // CASE 2: Event modified in Google Calendar (date/time changed)
      const googleStart = new Date(googleEvent.start?.dateTime || googleEvent.start?.date || '');
      const localStart = new Date(`${appointment.appointmentDate}T${appointment.appointmentTime}`);

      // Compare timestamps (allow 1 minute tolerance for timezone rounding)
      const timeDiffMinutes = Math.abs(googleStart.getTime() - localStart.getTime()) / (1000 * 60);

      if (timeDiffMinutes > 1) {
        console.log(`📝 [CALENDAR SYNC] Event modified in Google Calendar`);
        console.log(`   📋 Event Details:`);
        console.log(`      🆔 Appointment ID: ${appointment.id}`);
        console.log(`      📅 Google Event ID: ${appointment.googleEventId}`);
        console.log(`      📊 Status: ${appointment.status}`);
        console.log(`      🔖 Source: Calendar modification detected`);
        console.log(`   ⏰ Time Change:`);
        console.log(`      Old: ${appointment.appointmentDate} ${appointment.appointmentTime}`);
        console.log(`      New: ${googleStart.toISOString().split('T')[0]} ${googleStart.getHours().toString().padStart(2, '0')}:${googleStart.getMinutes().toString().padStart(2, '0')}`);

        // Extract new date and time from Google event
        const newDate = googleStart.toISOString().split('T')[0]; // YYYY-MM-DD
        const newTime = `${googleStart.getHours().toString().padStart(2, '0')}:${googleStart.getMinutes().toString().padStart(2, '0')}`; // HH:MM

        // Update appointment with new date/time
        await db
          .update(appointmentBookings)
          .set({
            appointmentDate: newDate,
            appointmentTime: newTime,
            updatedAt: new Date(),
          })
          .where(eq(appointmentBookings.id, appointment.id));

        modifiedCount++;
      }
    }

    console.log(`✅ [CALENDAR SYNC] Sync complete for consultant ${consultantId}`);
    console.log(`   📊 Deleted: ${deletedCount}, Modified: ${modifiedCount}, Unchanged: ${localAppointments.length - deletedCount - modifiedCount}`);

  } catch (error: any) {
    // Handle errors gracefully
    if (error.message?.includes('Calendar API has not been used')) {
      console.log(`⚠️  [CALENDAR SYNC] Google Calendar API not enabled for consultant ${consultantId}`);
      return;
    }

    if (error.message?.includes('Google Calendar non connesso')) {
      console.log(`⚠️  [CALENDAR SYNC] Consultant ${consultantId} - Google Calendar not connected`);
      return;
    }

    console.error(`❌ [CALENDAR SYNC] Error syncing calendar for consultant ${consultantId}:`, error.message);
  }
}

/**
 * Sync calendars for all consultants with Google Calendar connected
 */
async function syncAllConsultants(): Promise<void> {
  try {
    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`🔄 [CALENDAR SYNC] Starting sync cycle...`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

    // Get all consultants with Google Calendar connected
    let consultants;
    try {
      const settings = await db
        .select({
          consultantId: consultantAvailabilitySettings.consultantId,
        })
        .from(consultantAvailabilitySettings)
        .where(isNotNull(consultantAvailabilitySettings.googleAccessToken));

      if (settings.length === 0) {
        console.log(`⚠️  [CALENDAR SYNC] No consultants with Google Calendar connected`);
        return;
      }

      const consultantIds = settings.map(s => s.consultantId);

      consultants = await db
        .select({
          id: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
        })
        .from(users)
        .where(
          and(
            eq(users.role, 'consultant'),
            inArray(users.id, consultantIds)
          )
        );
    } catch (dbError: any) {
      // Handle database connection errors gracefully (common with Neon serverless)
      // Error codes: 08006 (connection failure), ECONNRESET, connection terminated
      const isConnectionError =
        dbError.code === '08006' ||
        dbError.code === 'ECONNRESET' ||
        dbError.message?.includes('connection failure') ||
        dbError.message?.includes('connection terminated') ||
        dbError.message?.includes('Cannot set property message') ||
        dbError.name === 'TypeError';

      if (isConnectionError) {
        console.log(`⏸️  [CALENDAR SYNC] Database connection unavailable (sleeping/waking) - will retry next cycle`);
        return;
      }
      throw dbError;
    }

    if (consultants.length === 0) {
      console.log(`⚠️  [CALENDAR SYNC] No consultants with Google Calendar connected`);
      return;
    }

    console.log(`📊 [CALENDAR SYNC] Syncing ${consultants.length} consultant(s)...`);

    // Sync each consultant sequentially to avoid API rate limits
    for (const consultant of consultants) {
      await syncCalendarForConsultant(consultant.id);

      // Small delay between consultants to avoid rate limits
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    console.log(`\n✅ [CALENDAR SYNC] Sync cycle complete`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

  } catch (error) {
    console.error(`❌ [CALENDAR SYNC] Error in sync cycle:`, error);
  }
}

/**
 * Start the calendar sync service
 * Syncs every 5 minutes by default (configurable via CALENDAR_SYNC_INTERVAL_MINUTES)
 */
export function startCalendarSync(): void {
  const registry = getRegistry();

  // Stop existing task if any
  if (registry.task) {
    console.log(`🔄 [CALENDAR SYNC] Stopping previous sync task (ID: ${registry.registrationId})`);
    registry.task.stop();
    registry.task = null;
  }

  // Get sync interval from env or default to 5 minutes
  const intervalMinutes = parseInt(process.env.CALENDAR_SYNC_INTERVAL_MINUTES || "5", 10);
  const cronSchedule = `*/${intervalMinutes} * * * *`; // Every N minutes

  const registrationId = `calendar-sync-${Date.now()}`;

  console.log(`✅ [CALENDAR SYNC] Starting calendar sync service (ID: ${registrationId})`);
  console.log(`📅 [CALENDAR SYNC] Schedule: every ${intervalMinutes} minute(s)`);

  // Create and start the cron task
  const task = cron.schedule(cronSchedule, syncAllConsultants);

  registry.task = task;
  registry.registrationId = registrationId;

  // Run immediately on startup (after a small delay to let server initialize)
  setTimeout(() => {
    syncAllConsultants();
  }, 10000); // 10 seconds delay
}

/**
 * Stop the calendar sync service
 */
export function stopCalendarSync(): void {
  const registry = getRegistry();

  if (registry.task) {
    console.log(`🛑 [CALENDAR SYNC] Stopping sync service (ID: ${registry.registrationId})`);
    registry.task.stop();
    registry.task = null;
    registry.registrationId = null;
  }
}

// Cleanup on process exit
process.on("SIGTERM", stopCalendarSync);
process.on("SIGINT", stopCalendarSync);
