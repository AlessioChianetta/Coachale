/**
 * Dataset Sync Scheduler
 * CRON job to trigger scheduled dataset synchronizations
 * Runs every minute to check for pending scheduled syncs
 */

import cron from "node-cron";
import { db } from "../db";
import { sql } from "drizzle-orm";
import { toZonedTime, fromZonedTime, format } from "date-fns-tz";

interface ScheduleConfig {
  hour?: number;
  minute?: number;
  dayOfWeek?: number;
  dayOfMonth?: number;
  intervalDays?: number;
}

interface SyncSchedule {
  id: number;
  source_id: number;
  schedule_type: string;
  schedule_config: ScheduleConfig | null;
  timezone: string;
  is_active: boolean;
  last_run_at: Date | null;
  next_run_at: Date | null;
}

interface SyncSource {
  id: number;
  consultant_id: string;
  name: string;
  api_key: string;
  is_active: boolean;
}

function parseScheduleConfig(scheduleType: string, config: ScheduleConfig | null): ScheduleConfig {
  const parsed: ScheduleConfig = {
    hour: config?.hour ?? 6,
    minute: config?.minute ?? 0,
    ...config,
  };
  return parsed;
}

function shouldRunNow(
  schedule: SyncSchedule,
  nowInTimezone: Date
): boolean {
  const config = parseScheduleConfig(schedule.schedule_type, schedule.schedule_config);
  const currentHour = nowInTimezone.getHours();
  const currentMinute = nowInTimezone.getMinutes();
  const currentDayOfWeek = nowInTimezone.getDay();
  const currentDayOfMonth = nowInTimezone.getDate();

  const targetHour = config.hour ?? 6;
  const targetMinute = config.minute ?? 0;

  const timeMatches = currentHour === targetHour && currentMinute === targetMinute;

  if (!timeMatches) {
    return false;
  }

  switch (schedule.schedule_type) {
    case "daily":
      return true;

    case "weekly":
      const targetDayOfWeek = config.dayOfWeek ?? 1;
      return currentDayOfWeek === targetDayOfWeek;

    case "monthly":
      const targetDayOfMonth = config.dayOfMonth ?? 1;
      return currentDayOfMonth === targetDayOfMonth;

    case "every_x_days":
      if (!schedule.last_run_at || !config.intervalDays) {
        return true;
      }
      const daysSinceLastRun = Math.floor(
        (nowInTimezone.getTime() - schedule.last_run_at.getTime()) / (24 * 60 * 60 * 1000)
      );
      return daysSinceLastRun >= config.intervalDays;

    case "webhook_only":
      return false;

    default:
      return false;
  }
}

function calculateNextRunTime(
  schedule: SyncSchedule,
  nowInTimezone: Date
): Date {
  const config = parseScheduleConfig(schedule.schedule_type, schedule.schedule_config);
  const targetHour = config.hour ?? 6;
  const targetMinute = config.minute ?? 0;

  const next = new Date(nowInTimezone);
  next.setHours(targetHour, targetMinute, 0, 0);

  if (next <= nowInTimezone) {
    next.setDate(next.getDate() + 1);
  }

  switch (schedule.schedule_type) {
    case "weekly":
      const targetDayOfWeek = config.dayOfWeek ?? 1;
      while (next.getDay() !== targetDayOfWeek) {
        next.setDate(next.getDate() + 1);
      }
      break;

    case "monthly":
      const targetDayOfMonth = config.dayOfMonth ?? 1;
      next.setDate(targetDayOfMonth);
      if (next <= nowInTimezone) {
        next.setMonth(next.getMonth() + 1);
      }
      break;

    case "every_x_days":
      if (config.intervalDays) {
        const lastRun = schedule.last_run_at || nowInTimezone;
        const daysSinceLastRun = Math.floor(
          (nowInTimezone.getTime() - lastRun.getTime()) / (24 * 60 * 60 * 1000)
        );
        const daysToWait = Math.max(0, config.intervalDays - daysSinceLastRun);
        next.setDate(next.getDate() + daysToWait - 1);
      }
      break;
  }

  return next;
}

async function triggerSync(sourceId: number, scheduleId: number): Promise<void> {
  console.log(`[DATASET-SYNC-CRON] Triggering sync for source ${sourceId} (schedule ${scheduleId})`);

  try {
    const syncId = `sync_cron_${Date.now()}_${sourceId}`;

    await db.execute(sql`
      INSERT INTO dataset_sync_history (source_id, sync_id, status, triggered_by)
      VALUES (${sourceId}, ${syncId}, 'pending', 'scheduled')
    `);

    await db.execute(sql`
      UPDATE dataset_sync_schedules 
      SET last_run_at = now() 
      WHERE id = ${scheduleId}
    `);

    console.log(`[DATASET-SYNC-CRON] Created sync job ${syncId} for source ${sourceId}`);

  } catch (error: any) {
    console.error(`[DATASET-SYNC-CRON] Failed to trigger sync for source ${sourceId}:`, error.message);
  }
}

async function processScheduledSyncs(): Promise<void> {
  try {
    const schedules = await db.execute<SyncSchedule>(sql`
      SELECT s.*, src.is_active as source_is_active
      FROM dataset_sync_schedules s
      JOIN dataset_sync_sources src ON s.source_id = src.id
      WHERE s.is_active = true 
        AND s.schedule_type != 'webhook_only'
        AND src.is_active = true
    `);

    if (!schedules || schedules.length === 0) {
      return;
    }

    const now = new Date();

    for (const schedule of schedules as SyncSchedule[]) {
      const timezone = schedule.timezone || "Europe/Rome";
      const nowInTimezone = toZonedTime(now, timezone);

      if (shouldRunNow(schedule, nowInTimezone)) {
        const alreadyRanToday = schedule.last_run_at && 
          format(toZonedTime(schedule.last_run_at, timezone), "yyyy-MM-dd") === 
          format(nowInTimezone, "yyyy-MM-dd") &&
          toZonedTime(schedule.last_run_at, timezone).getHours() === nowInTimezone.getHours();

        if (!alreadyRanToday) {
          await triggerSync(schedule.source_id, schedule.id);
        }
      }

      const nextRun = calculateNextRunTime(schedule, nowInTimezone);
      await db.execute(sql`
        UPDATE dataset_sync_schedules 
        SET next_run_at = ${nextRun.toISOString()} 
        WHERE id = ${schedule.id}
      `);
    }

  } catch (error: any) {
    console.error("[DATASET-SYNC-CRON] Error processing schedules:", error.message);
  }
}

let cronJob: cron.ScheduledTask | null = null;

export function initDatasetSyncScheduler(): void {
  if (cronJob) {
    console.log("[DATASET-SYNC-CRON] Scheduler already initialized");
    return;
  }

  cronJob = cron.schedule("* * * * *", async () => {
    await processScheduledSyncs();
  }, {
    timezone: "Europe/Rome",
  });

  console.log("[DATASET-SYNC-CRON] Dataset sync scheduler initialized (runs every minute)");
}

export function stopDatasetSyncScheduler(): void {
  if (cronJob) {
    cronJob.stop();
    cronJob = null;
    console.log("[DATASET-SYNC-CRON] Dataset sync scheduler stopped");
  }
}

export { processScheduledSyncs, shouldRunNow, calculateNextRunTime };
