/**
 * Instagram Window Cleanup Cron Job
 * 
 * Runs every 5 minutes to close expired 24-hour messaging windows.
 * Also cleans up HUMAN_AGENT extended windows when they expire.
 */

import { ensureScheduler } from "../services/scheduler-registry";
import { WindowTracker } from "../instagram/window-tracker";
import { nanoid } from "nanoid";

const SCHEDULER_NAME = "instagram-window-cleanup";
const CRON_SCHEDULE = "*/5 * * * *"; // Every 5 minutes

async function cleanupExpiredWindows(): Promise<void> {
  console.log("🪟 [INSTAGRAM CRON] Starting window cleanup...");
  
  try {
    const closedCount = await WindowTracker.closeExpiredWindows();
    
    if (closedCount > 0) {
      console.log(`✅ [INSTAGRAM CRON] Closed ${closedCount} expired windows`);
    } else {
      console.log("🪟 [INSTAGRAM CRON] No expired windows to close");
    }
  } catch (error) {
    console.error("❌ [INSTAGRAM CRON] Error during window cleanup:", error);
  }
}

/**
 * Initialize the Instagram window cleanup scheduler
 */
export function initInstagramWindowCleanup(): void {
  const registrationId = nanoid(8);
  
  ensureScheduler(
    SCHEDULER_NAME,
    CRON_SCHEDULE,
    cleanupExpiredWindows,
    registrationId
  );
  
  console.log(`🪟 [INSTAGRAM CRON] Window cleanup scheduler initialized (every 5 minutes)`);
}
