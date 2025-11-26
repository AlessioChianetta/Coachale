// Scheduler Registry - Prevents duplicate cron jobs during hot reload
// Uses globalThis to persist scheduler state across module reloads

import cron from "node-cron";
import type { ScheduledTask } from "node-cron";

// Global registry key using Symbol to avoid conflicts
const SCHEDULER_KEY = Symbol.for("app.emailScheduler");

interface SchedulerRegistry {
  task: ScheduledTask | null;
  registrationId: string | null;
}

// Extend globalThis to include our registry
declare global {
  var __schedulerRegistry: SchedulerRegistry | undefined;
}

/**
 * Get or create the scheduler registry on globalThis
 * This persists across hot reloads in development
 */
function getRegistry(): SchedulerRegistry {
  if (!globalThis.__schedulerRegistry) {
    globalThis.__schedulerRegistry = {
      task: null,
      registrationId: null
    };
  }
  return globalThis.__schedulerRegistry;
}

/**
 * Ensures only ONE email scheduler cron job is running
 * Safe for hot reload - will stop old task before creating new one
 * 
 * @param cronSchedule - The cron schedule string (e.g., "0 * * * *")
 * @param handler - The async function to execute on schedule
 * @param registrationId - Unique ID for this registration (for logging)
 */
export function ensureEmailScheduler(
  cronSchedule: string,
  handler: () => Promise<void>,
  registrationId: string
): void {
  const registry = getRegistry();
  
  // If there's an existing task, stop it first
  if (registry.task) {
    console.log(`🔄 [SCHEDULER REGISTRY] Stopping previous scheduler (ID: ${registry.registrationId})`);
    registry.task.stop();
    registry.task = null;
  }
  
  // Create and register new task
  console.log(`✅ [SCHEDULER REGISTRY] Registering new scheduler (ID: ${registrationId})`);
  const task = cron.schedule(cronSchedule, handler);
  
  // Store in registry
  registry.task = task;
  registry.registrationId = registrationId;
  
  console.log(`📧 [SCHEDULER REGISTRY] Email scheduler active with schedule: ${cronSchedule}`);
}

/**
 * Cleanup function for graceful shutdown
 * Call this when the server is shutting down
 */
export function cleanupScheduler(): void {
  const registry = getRegistry();
  
  if (registry.task) {
    console.log(`🧹 [SCHEDULER REGISTRY] Cleaning up scheduler (ID: ${registry.registrationId})`);
    registry.task.stop();
    registry.task = null;
    registry.registrationId = null;
  }
}

// Register cleanup on process exit
process.on('SIGTERM', cleanupScheduler);
process.on('SIGINT', cleanupScheduler);
