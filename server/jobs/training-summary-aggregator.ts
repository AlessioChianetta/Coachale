// Training Summary Aggregator - Cron Job
// Runs daily at 3 AM to recalculate training summaries for all sales agents
// Uses node-cron for scheduling with duplicate prevention via global registry

import cron from "node-cron";
import type { ScheduledTask } from "node-cron";
import { db } from "../db";
import { clientSalesAgents } from "../../shared/schema";
import { eq } from "drizzle-orm";
import { SalesScriptTracker } from "../ai/sales-script-tracker";

const AGGREGATOR_KEY = Symbol.for("app.trainingSummaryAggregator");

interface AggregatorRegistry {
  task: ScheduledTask | null;
  registrationId: string | null;
}

declare global {
  var __trainingSummaryAggregatorRegistry: AggregatorRegistry | undefined;
}

function getRegistry(): AggregatorRegistry {
  if (!globalThis.__trainingSummaryAggregatorRegistry) {
    globalThis.__trainingSummaryAggregatorRegistry = {
      task: null,
      registrationId: null,
    };
  }
  return globalThis.__trainingSummaryAggregatorRegistry;
}

/**
 * Run aggregation for all active sales agents
 */
async function runAggregation(): Promise<void> {
  try {
    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("🔄 [TRAINING AGGREGATOR] Starting daily aggregation...");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    // Fetch all active sales agents
    const agents = await db
      .select()
      .from(clientSalesAgents)
      .where(eq(clientSalesAgents.isActive, true));

    if (agents.length === 0) {
      console.log("⚠️  [TRAINING AGGREGATOR] No active sales agents found");
      return;
    }

    console.log(`📊 [TRAINING AGGREGATOR] Found ${agents.length} active agent(s)`);

    // Calculate summary for each agent
    let successCount = 0;
    let failureCount = 0;

    for (const agent of agents) {
      try {
        await SalesScriptTracker.calculateAgentSummary(agent.id);
        successCount++;
      } catch (error: any) {
        console.error(
          `❌ [TRAINING AGGREGATOR] Failed for agent ${agent.id}:`,
          error.message
        );
        failureCount++;
      }
    }

    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("✅ [TRAINING AGGREGATOR] Daily aggregation complete");
    console.log(`   Success: ${successCount} agent(s)`);
    console.log(`   Failed: ${failureCount} agent(s)`);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
  } catch (error: any) {
    console.error("❌ [TRAINING AGGREGATOR] Fatal error:", error.message);
  }
}

/**
 * Start the training summary aggregator cron job
 * Scheduled to run daily at 3:00 AM
 */
export function startTrainingAggregator(): void {
  const registry = getRegistry();

  // Prevent duplicate registration
  if (registry.task) {
    console.log(
      "⚠️  [TRAINING AGGREGATOR] Already registered, skipping duplicate"
    );
    return;
  }

  // Generate unique registration ID
  const regId = Math.random().toString(36).substring(2, 8);
  registry.registrationId = regId;

  console.log(
    `✅ [TRAINING AGGREGATOR] Registering cron job (ID: ${regId})`
  );
  console.log(`📅 [TRAINING AGGREGATOR] Schedule: Daily at 3:00 AM`);

  // Schedule cron job: Daily at 3:00 AM
  // Cron format: "minute hour day month weekday"
  // "0 3 * * *" = At 03:00 every day
  const cronTimezone = process.env.CRON_TIMEZONE || "UTC";
  
  registry.task = cron.schedule(
    "0 3 * * *",
    async () => {
      await runAggregation();
    },
    {
      scheduled: true,
      timezone: cronTimezone,
    }
  );

  console.log(`⏰ [TRAINING AGGREGATOR] Timezone: ${cronTimezone}`);

  console.log("✅ [TRAINING AGGREGATOR] Cron job started successfully");
}

/**
 * Stop the training summary aggregator cron job
 */
export function stopTrainingAggregator(): void {
  const registry = getRegistry();

  if (registry.task) {
    registry.task.stop();
    registry.task = null;
    registry.registrationId = null;
    console.log("🛑 [TRAINING AGGREGATOR] Cron job stopped");
  }
}

/**
 * Manually trigger aggregation (for testing or on-demand)
 */
export async function triggerAggregationNow(): Promise<void> {
  console.log("🚀 [TRAINING AGGREGATOR] Manual trigger requested");
  await runAggregation();
}
