/**
 * AI Usage Aggregator CRON Job
 * Aggregates raw ai_token_usage records into ai_token_usage_daily for analytics.
 * 
 * CRON: Every night at 02:00 UTC
 * - Aggregates yesterday's data by default
 * - Uses UPSERT to avoid double counting
 * - Optionally cleans up raw records older than 90 days
 */

import cron from 'node-cron';
import { db } from '../db';
import { sql } from 'drizzle-orm';
import { acquireCronLock, releaseCronLock } from './cron-lock-manager';

let aggregatorJob: cron.ScheduledTask | null = null;

const AGGREGATION_INTERVAL = '0 2 * * *'; // Every night at 02:00 UTC
const RAW_DATA_RETENTION_DAYS = 90;

export function initAIUsageAggregator(): void {
  console.log('📊 [AI-USAGE-AGGREGATOR] Initializing AI usage aggregator...');

  if (aggregatorJob) {
    console.log('⚠️ [AI-USAGE-AGGREGATOR] Aggregator already initialized, stopping existing job first...');
    stopAIUsageAggregator();
  }

  aggregatorJob = cron.schedule(AGGREGATION_INTERVAL, async () => {
    console.log('⏰ [AI-USAGE-AGGREGATOR] Daily aggregation triggered');
    try {
      await runAggregation();
    } catch (error) {
      console.error('❌ [AI-USAGE-AGGREGATOR] Error in daily aggregation:', error);
    }
  }, {
    scheduled: true,
    timezone: 'UTC'
  });

  console.log('✅ [AI-USAGE-AGGREGATOR] Aggregator initialized successfully');
  console.log(`   📊 Schedule: ${AGGREGATION_INTERVAL} (daily at 02:00 UTC)`);
  console.log(`   🗑️  Raw data retention: ${RAW_DATA_RETENTION_DAYS} days`);
}

export function stopAIUsageAggregator(): void {
  if (aggregatorJob) {
    aggregatorJob.stop();
    aggregatorJob = null;
    console.log('🛑 [AI-USAGE-AGGREGATOR] Aggregator stopped');
  }
}

export async function runAggregation(targetDate?: string): Promise<{ aggregated: number; cleaned: number }> {
  const lockName = 'ai_usage_aggregator';
  const lockAcquired = await acquireCronLock(lockName, 10 * 60 * 1000); // 10 min lock

  if (!lockAcquired) {
    console.log('⚠️ [AI-USAGE-AGGREGATOR] Aggregation already running (DB lock), skipping...');
    return { aggregated: 0, cleaned: 0 };
  }

  const startTime = Date.now();

  try {
    const dateFilter = targetDate || null;

    console.log(`🔄 [AI-USAGE-AGGREGATOR] Starting aggregation for ${targetDate || 'yesterday'}...`);

    const result = await db.execute(sql`
      INSERT INTO ai_token_usage_daily (
        consultant_id, client_id, client_role, model, feature, date,
        request_count, total_input_tokens, total_output_tokens,
        total_cached_tokens, total_thinking_tokens, total_cost,
        avg_duration_ms, error_count
      )
      SELECT 
        consultant_id,
        client_id,
        client_role,
        model,
        feature,
        DATE(created_at) as date,
        COUNT(*)::integer as request_count,
        SUM(input_tokens)::integer as total_input_tokens,
        SUM(output_tokens)::integer as total_output_tokens,
        SUM(cached_tokens)::integer as total_cached_tokens,
        SUM(thinking_tokens)::integer as total_thinking_tokens,
        SUM(total_cost::numeric) as total_cost,
        AVG(duration_ms)::integer as avg_duration_ms,
        SUM(CASE WHEN error THEN 1 ELSE 0 END)::integer as error_count
      FROM ai_token_usage
      WHERE DATE(created_at) = COALESCE(${dateFilter}::date, CURRENT_DATE - INTERVAL '1 day')
      GROUP BY consultant_id, client_id, client_role, model, feature, DATE(created_at)
      ON CONFLICT (consultant_id, client_id, model, feature, date) 
      DO UPDATE SET 
        request_count = EXCLUDED.request_count,
        total_input_tokens = EXCLUDED.total_input_tokens,
        total_output_tokens = EXCLUDED.total_output_tokens,
        total_cached_tokens = EXCLUDED.total_cached_tokens,
        total_thinking_tokens = EXCLUDED.total_thinking_tokens,
        total_cost = EXCLUDED.total_cost,
        avg_duration_ms = EXCLUDED.avg_duration_ms,
        error_count = EXCLUDED.error_count,
        client_role = EXCLUDED.client_role
    `);

    const aggregatedRows = result.rowCount || 0;
    console.log(`✅ [AI-USAGE-AGGREGATOR] Aggregated ${aggregatedRows} rows for ${targetDate || 'yesterday'}`);

    let cleanedRows = 0;
    try {
      const cleanupResult = await db.execute(sql`
        DELETE FROM ai_token_usage
        WHERE created_at < NOW() - INTERVAL '${sql.raw(String(RAW_DATA_RETENTION_DAYS))} days'
      `);
      cleanedRows = cleanupResult.rowCount || 0;
      if (cleanedRows > 0) {
        console.log(`🗑️ [AI-USAGE-AGGREGATOR] Cleaned up ${cleanedRows} raw records older than ${RAW_DATA_RETENTION_DAYS} days`);
      } else {
        console.log(`🗑️ [AI-USAGE-AGGREGATOR] No raw records older than ${RAW_DATA_RETENTION_DAYS} days to clean up`);
      }
    } catch (cleanupError) {
      console.error('⚠️ [AI-USAGE-AGGREGATOR] Error during cleanup (aggregation still succeeded):', cleanupError);
    }

    const duration = Date.now() - startTime;
    console.log(`📊 [AI-USAGE-AGGREGATOR] ═══════════════════════════════════════`);
    console.log(`📊 [AI-USAGE-AGGREGATOR] Aggregation Report`);
    console.log(`📊 [AI-USAGE-AGGREGATOR] ───────────────────────────────────────`);
    console.log(`📊 [AI-USAGE-AGGREGATOR] Target date: ${targetDate || 'yesterday'}`);
    console.log(`📊 [AI-USAGE-AGGREGATOR] Rows aggregated: ${aggregatedRows}`);
    console.log(`📊 [AI-USAGE-AGGREGATOR] Rows cleaned: ${cleanedRows}`);
    console.log(`📊 [AI-USAGE-AGGREGATOR] Duration: ${duration}ms`);
    console.log(`📊 [AI-USAGE-AGGREGATOR] ═══════════════════════════════════════`);

    return { aggregated: aggregatedRows, cleaned: cleanedRows };
  } catch (error) {
    console.error('❌ [AI-USAGE-AGGREGATOR] Aggregation failed:', error);
    throw error;
  } finally {
    await releaseCronLock(lockName);
  }
}
