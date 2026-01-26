/**
 * Cron Lock Manager
 * Uses direct SQL for atomic lock acquisition to prevent duplicate cron job executions.
 */

import { db } from '../db';
import { sql } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

const INSTANCE_ID = uuidv4();
const DEFAULT_LOCK_DURATION_MS = 5 * 60 * 1000; // 5 minutes default

/**
 * Try to acquire a lock for a cron job.
 * Returns true if lock acquired, false if already locked by another process.
 */
export async function acquireCronLock(
  jobName: string,
  lockDurationMs: number = DEFAULT_LOCK_DURATION_MS
): Promise<boolean> {
  const expiresAt = new Date(Date.now() + lockDurationMs);
  
  try {
    // Atomic upsert: insert if not exists, or update if expired
    const result = await db.execute(sql`
      INSERT INTO cron_locks (id, job_name, locked_by, locked_at, expires_at)
      VALUES (gen_random_uuid(), ${jobName}, ${INSTANCE_ID}, NOW(), ${expiresAt})
      ON CONFLICT (job_name) DO UPDATE
      SET locked_by = ${INSTANCE_ID},
          locked_at = NOW(),
          expires_at = ${expiresAt}
      WHERE cron_locks.expires_at < NOW()
      RETURNING id
    `);
    
    const acquired = result.rowCount && result.rowCount > 0;
    
    if (acquired) {
      console.log(`🔒 [CronLock] Acquired lock for "${jobName}" (instance: ${INSTANCE_ID.slice(0, 8)})`);
    } else {
      console.log(`⏳ [CronLock] Lock for "${jobName}" held by another process, skipping...`);
    }
    
    return !!acquired;
  } catch (error: any) {
    console.error(`❌ [CronLock] Error acquiring lock for "${jobName}":`, error.message);
    return false;
  }
}

/**
 * Release a cron job lock.
 * Only releases if this instance owns the lock.
 */
export async function releaseCronLock(jobName: string): Promise<void> {
  try {
    const result = await db.execute(sql`
      DELETE FROM cron_locks
      WHERE job_name = ${jobName}
        AND locked_by = ${INSTANCE_ID}
    `);
    
    if (result.rowCount && result.rowCount > 0) {
      console.log(`🔓 [CronLock] Released lock for "${jobName}"`);
    }
  } catch (error: any) {
    console.error(`❌ [CronLock] Error releasing lock for "${jobName}":`, error.message);
  }
}

/**
 * Extend lock duration (heartbeat for long-running jobs).
 */
export async function extendCronLock(
  jobName: string,
  lockDurationMs: number = DEFAULT_LOCK_DURATION_MS
): Promise<boolean> {
  const expiresAt = new Date(Date.now() + lockDurationMs);
  
  try {
    const result = await db.execute(sql`
      UPDATE cron_locks
      SET expires_at = ${expiresAt}
      WHERE job_name = ${jobName}
        AND locked_by = ${INSTANCE_ID}
    `);
    
    return result.rowCount !== null && result.rowCount > 0;
  } catch (error: any) {
    console.error(`❌ [CronLock] Error extending lock for "${jobName}":`, error.message);
    return false;
  }
}

/**
 * Clean up expired locks (maintenance task).
 */
export async function cleanupExpiredLocks(): Promise<number> {
  try {
    const result = await db.execute(sql`
      DELETE FROM cron_locks
      WHERE expires_at < NOW()
    `);
    
    const cleaned = result.rowCount || 0;
    if (cleaned > 0) {
      console.log(`🧹 [CronLock] Cleaned up ${cleaned} expired locks`);
    }
    return cleaned;
  } catch (error: any) {
    console.error(`❌ [CronLock] Error cleaning expired locks:`, error.message);
    return 0;
  }
}

/**
 * Wrapper to run a cron job with lock protection.
 */
export async function withCronLock<T>(
  jobName: string,
  job: () => Promise<T>,
  options: { lockDurationMs?: number; heartbeatIntervalMs?: number } = {}
): Promise<T | null> {
  const { lockDurationMs = DEFAULT_LOCK_DURATION_MS, heartbeatIntervalMs } = options;
  
  const acquired = await acquireCronLock(jobName, lockDurationMs);
  if (!acquired) {
    return null;
  }
  
  let heartbeatInterval: NodeJS.Timeout | null = null;
  
  try {
    // Optional heartbeat for long-running jobs
    if (heartbeatIntervalMs) {
      heartbeatInterval = setInterval(() => {
        extendCronLock(jobName, lockDurationMs);
      }, heartbeatIntervalMs);
    }
    
    return await job();
  } finally {
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval);
    }
    await releaseCronLock(jobName);
  }
}

/**
 * Get current instance ID for debugging.
 */
export function getInstanceId(): string {
  return INSTANCE_ID;
}
