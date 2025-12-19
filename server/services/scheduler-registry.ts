// Scheduler Registry - Prevents duplicate cron jobs during hot reload
// Uses globalThis to persist scheduler state across module reloads

import cron from "node-cron";
import type { ScheduledTask } from "node-cron";

// Global registry key using Symbol to avoid conflicts
const SCHEDULER_KEY = Symbol.for("app.emailScheduler");

interface SchedulerEntry {
  task: ScheduledTask;
  registrationId: string;
  schedulerName: string;
}

interface SchedulerRegistry {
  task: ScheduledTask | null;
  registrationId: string | null;
}

interface MultiSchedulerRegistry {
  schedulers: Map<string, SchedulerEntry>;
}

// Extend globalThis to include our registries
declare global {
  var __schedulerRegistry: SchedulerRegistry | undefined;
  var __multiSchedulerRegistry: MultiSchedulerRegistry | undefined;
}

/**
 * Get or create the scheduler registry on globalThis (legacy single scheduler)
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
 * Get or create the multi-scheduler registry on globalThis
 * This persists across hot reloads in development
 */
function getMultiRegistry(): MultiSchedulerRegistry {
  if (!globalThis.__multiSchedulerRegistry) {
    globalThis.__multiSchedulerRegistry = {
      schedulers: new Map()
    };
  }
  return globalThis.__multiSchedulerRegistry;
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
 * Ensures only ONE instance of a named scheduler is running
 * Safe for hot reload - will stop old task before creating new one
 * 
 * @param schedulerName - Unique name for this scheduler type (e.g., "finance-prefetch")
 * @param cronSchedule - The cron schedule string (e.g., "0 6 * * *" for 6 AM daily)
 * @param handler - The async function to execute on schedule
 * @param registrationId - Unique ID for this registration (for logging)
 */
export function ensureScheduler(
  schedulerName: string,
  cronSchedule: string,
  handler: () => Promise<void>,
  registrationId: string
): void {
  const registry = getMultiRegistry();
  
  // If there's an existing task with this name, stop it first
  const existing = registry.schedulers.get(schedulerName);
  if (existing) {
    console.log(`🔄 [SCHEDULER REGISTRY] Stopping previous ${schedulerName} scheduler (ID: ${existing.registrationId})`);
    existing.task.stop();
    registry.schedulers.delete(schedulerName);
  }
  
  // Create and register new task
  console.log(`✅ [SCHEDULER REGISTRY] Registering new ${schedulerName} scheduler (ID: ${registrationId})`);
  const task = cron.schedule(cronSchedule, handler);
  
  // Store in registry
  registry.schedulers.set(schedulerName, {
    task,
    registrationId,
    schedulerName
  });
  
  console.log(`🕐 [SCHEDULER REGISTRY] ${schedulerName} scheduler active with schedule: ${cronSchedule}`);
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

/**
 * Cleanup all schedulers for graceful shutdown
 */
export function cleanupAllSchedulers(): void {
  // Clean legacy single scheduler
  cleanupScheduler();
  
  // Clean multi-scheduler registry
  const multiRegistry = getMultiRegistry();
  for (const [name, entry] of multiRegistry.schedulers) {
    console.log(`🧹 [SCHEDULER REGISTRY] Cleaning up ${name} scheduler (ID: ${entry.registrationId})`);
    entry.task.stop();
  }
  multiRegistry.schedulers.clear();
}

// Register cleanup on process exit
process.on('SIGTERM', cleanupAllSchedulers);
process.on('SIGINT', cleanupAllSchedulers);
