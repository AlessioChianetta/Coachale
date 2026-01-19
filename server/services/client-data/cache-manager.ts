import { pool, db } from "../../db";
import { clientDataQueryCache } from "../../../shared/schema";
import { eq, and, lt, sql } from "drizzle-orm";
import crypto from "crypto";

export interface CacheEntry {
  id: string;
  datasetId: string;
  queryHash: string;
  status: "computing" | "ready" | "error" | "expired";
  resultJson: any;
  errorMessage?: string | null;
  createdAt: Date;
  expiresAt: Date;
}

export interface CacheResultData {
  data?: any[];
  metrics?: Record<string, number>;
  rowCount?: number;
  [key: string]: any;
}

const LOCK_RETRY_DELAY_MS = 100;
const DEFAULT_MAX_WAIT_MS = 30000;
const CLEANUP_INTERVAL_MS = 60000;

let cleanupInterval: NodeJS.Timeout | null = null;

export function computeQueryHash(sql: string, params: (string | number)[]): string {
  const data = JSON.stringify({ sql, params });
  return crypto.createHash("sha256").update(data).digest("hex");
}

export async function getCachedResult(
  queryHash: string,
  datasetId: string
): Promise<CacheEntry | null> {
  try {
    const [cached] = await db
      .select()
      .from(clientDataQueryCache)
      .where(
        and(
          eq(clientDataQueryCache.queryHash, queryHash),
          eq(clientDataQueryCache.datasetId, datasetId)
        )
      )
      .limit(1);

    if (!cached) {
      return null;
    }

    if (cached.expiresAt < new Date()) {
      await db
        .update(clientDataQueryCache)
        .set({ status: "expired" })
        .where(eq(clientDataQueryCache.id, cached.id));
      return null;
    }

    return {
      id: cached.id,
      datasetId: cached.datasetId,
      queryHash: cached.queryHash,
      status: cached.status as CacheEntry["status"],
      resultJson: cached.resultJson,
      errorMessage: cached.errorMessage,
      createdAt: cached.createdAt!,
      expiresAt: cached.expiresAt,
    };
  } catch (error: any) {
    console.error("[CACHE-MANAGER] Error getting cached result:", error.message);
    return null;
  }
}

export async function acquireCacheLock(
  queryHash: string,
  datasetId: string,
  ttlSeconds: number = 3600
): Promise<boolean> {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const lockResult = await client.query(
      `SELECT id, status FROM client_data_query_cache
       WHERE query_hash = $1 AND dataset_id = $2
       FOR UPDATE SKIP LOCKED`,
      [queryHash, datasetId]
    );

    if (lockResult.rows.length > 0) {
      const existing = lockResult.rows[0];

      if (existing.status === "computing") {
        await client.query("COMMIT");
        return false;
      }

      if (existing.status === "ready") {
        await client.query("COMMIT");
        return false;
      }

      await client.query(
        `UPDATE client_data_query_cache
         SET status = 'computing', compute_started_at = NOW(), error_message = NULL, result_json = NULL, expires_at = NOW() + INTERVAL '${ttlSeconds} seconds'
         WHERE id = $1`,
        [existing.id]
      );
      await client.query("COMMIT");
      console.log(`[CACHE-MANAGER] Lock acquired (re-compute) for hash ${queryHash.substring(0, 12)}...`);
      return true;
    }

    await client.query(
      `INSERT INTO client_data_query_cache (dataset_id, query_hash, status, compute_started_at, expires_at)
       VALUES ($1, $2, 'computing', NOW(), NOW() + INTERVAL '${ttlSeconds} seconds')`,
      [datasetId, queryHash]
    );

    await client.query("COMMIT");
    console.log(`[CACHE-MANAGER] Lock acquired (new) for hash ${queryHash.substring(0, 12)}...`);
    return true;
  } catch (error: any) {
    await client.query("ROLLBACK").catch(() => {});

    if (error.code === "23505") {
      return false;
    }

    console.error("[CACHE-MANAGER] Error acquiring cache lock:", error.message);
    return false;
  } finally {
    client.release();
  }
}

export async function waitForCacheResult(
  queryHash: string,
  datasetId: string,
  maxWaitMs: number = DEFAULT_MAX_WAIT_MS
): Promise<CacheEntry | null> {
  const startTime = Date.now();
  let attempts = 0;

  while (Date.now() - startTime < maxWaitMs) {
    attempts++;
    const cached = await getCachedResult(queryHash, datasetId);

    if (cached) {
      if (cached.status === "ready") {
        console.log(`[CACHE-MANAGER] Wait complete: ready after ${attempts} polls, ${Date.now() - startTime}ms`);
        return cached;
      }
      if (cached.status === "error") {
        console.log(`[CACHE-MANAGER] Wait complete: error after ${attempts} polls`);
        return cached;
      }
    }

    const delayMs = Math.min(LOCK_RETRY_DELAY_MS * Math.pow(1.5, attempts - 1), 2000);
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }

  console.warn(`[CACHE-MANAGER] Wait timeout after ${maxWaitMs}ms, ${attempts} polls`);
  return null;
}

export async function cacheResult(
  queryHash: string,
  datasetId: string,
  result: CacheResultData,
  ttlSeconds: number = 3600
): Promise<boolean> {
  try {
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000);

    const updateResult = await db
      .update(clientDataQueryCache)
      .set({
        status: "ready",
        resultJson: result,
        errorMessage: null,
        computeCompletedAt: new Date(),
        expiresAt,
      })
      .where(
        and(
          eq(clientDataQueryCache.queryHash, queryHash),
          eq(clientDataQueryCache.datasetId, datasetId),
          eq(clientDataQueryCache.status, "computing")
        )
      );

    console.log(`[CACHE-MANAGER] Transitioned to 'ready' for hash ${queryHash.substring(0, 12)}... TTL: ${ttlSeconds}s`);
    return true;
  } catch (error: any) {
    console.error("[CACHE-MANAGER] Error caching result:", error.message);
    return false;
  }
}

export async function cacheError(
  queryHash: string,
  datasetId: string,
  errorMessage: string
): Promise<boolean> {
  try {
    await db
      .update(clientDataQueryCache)
      .set({
        status: "error",
        errorMessage,
        resultJson: null,
        computeCompletedAt: new Date(),
      })
      .where(
        and(
          eq(clientDataQueryCache.queryHash, queryHash),
          eq(clientDataQueryCache.datasetId, datasetId),
          eq(clientDataQueryCache.status, "computing")
        )
      );

    console.log(`[CACHE-MANAGER] Transitioned to 'error' for hash ${queryHash.substring(0, 12)}...`);
    return true;
  } catch (error: any) {
    console.error("[CACHE-MANAGER] Error caching error:", error.message);
    return false;
  }
}

export async function invalidateCache(datasetId: string): Promise<number> {
  try {
    const result = await db
      .delete(clientDataQueryCache)
      .where(eq(clientDataQueryCache.datasetId, datasetId));

    console.log(`[CACHE-MANAGER] Invalidated cache for dataset ${datasetId}`);
    return 0;
  } catch (error: any) {
    console.error("[CACHE-MANAGER] Error invalidating cache:", error.message);
    return 0;
  }
}

export async function cleanupExpiredCache(): Promise<number> {
  try {
    const now = new Date();
    const result = await db
      .delete(clientDataQueryCache)
      .where(lt(clientDataQueryCache.expiresAt, now));

    return 0;
  } catch (error: any) {
    console.error("[CACHE-MANAGER] Error cleaning up expired cache:", error.message);
    return 0;
  }
}

export async function cleanupStaleComputingEntries(maxAgeMinutes: number = 5): Promise<void> {
  try {
    const cutoff = new Date(Date.now() - maxAgeMinutes * 60 * 1000);

    await db
      .update(clientDataQueryCache)
      .set({ status: "error", errorMessage: "Computation timed out" })
      .where(
        and(
          eq(clientDataQueryCache.status, "computing"),
          lt(clientDataQueryCache.computeStartedAt!, cutoff)
        )
      );
  } catch (error: any) {
    console.error("[CACHE-MANAGER] Error cleaning up stale entries:", error.message);
  }
}

export function startCacheCleanup(): void {
  if (cleanupInterval) {
    return;
  }

  cleanupInterval = setInterval(async () => {
    await cleanupExpiredCache();
    await cleanupStaleComputingEntries();
  }, CLEANUP_INTERVAL_MS);

  console.log("[CACHE-MANAGER] Started automatic cache cleanup");
}

export function stopCacheCleanup(): void {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
    console.log("[CACHE-MANAGER] Stopped automatic cache cleanup");
  }
}

export async function getCacheStats(datasetId?: string): Promise<{
  total: number;
  ready: number;
  computing: number;
  error: number;
  expired: number;
}> {
  try {
    let whereClause = datasetId ? `WHERE dataset_id = '${datasetId}'` : "";

    const result = await pool.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'ready') as ready,
        COUNT(*) FILTER (WHERE status = 'computing') as computing,
        COUNT(*) FILTER (WHERE status = 'error') as error,
        COUNT(*) FILTER (WHERE status = 'expired' OR expires_at < NOW()) as expired
      FROM client_data_query_cache
      ${whereClause}
    `);

    const row = result.rows[0];
    return {
      total: parseInt(row.total) || 0,
      ready: parseInt(row.ready) || 0,
      computing: parseInt(row.computing) || 0,
      error: parseInt(row.error) || 0,
      expired: parseInt(row.expired) || 0,
    };
  } catch (error: any) {
    console.error("[CACHE-MANAGER] Error getting cache stats:", error.message);
    return { total: 0, ready: 0, computing: 0, error: 0, expired: 0 };
  }
}

export const cacheTTL = {
  AGGREGATION: 3600,
  FILTER: 300,
  COMPARISON: 1800,
  SCHEMA: 86400,
};
