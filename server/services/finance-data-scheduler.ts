import { storage } from "../storage";
import { PercorsoCapitaleClient } from "../percorso-capitale-client";

export interface FinancePrefetchResult {
  userId: string;
  email: string;
  success: boolean;
  cachedEndpoints: string[];
  error?: string;
  duration?: number;
}

export async function prefetchFinanceDataForUser(
  userId: string,
  percorsoCapitaleEmail: string
): Promise<FinancePrefetchResult> {
  const startTime = Date.now();
  const result: FinancePrefetchResult = {
    userId,
    email: percorsoCapitaleEmail.substring(0, 3) + "***",
    success: false,
    cachedEndpoints: [],
  };

  const apiKey = process.env.PERCORSO_CAPITALE_API_KEY;
  const baseUrl = process.env.PERCORSO_CAPITALE_BASE_URL;

  if (!apiKey || !baseUrl) {
    result.error = "Missing API key or base URL configuration";
    return result;
  }

  try {
    const client = PercorsoCapitaleClient.getInstance(apiKey, baseUrl, percorsoCapitaleEmail);

    const prefetchPromises = [
      client.getDashboard().then((data) => {
        if (data) result.cachedEndpoints.push("dashboard");
        return data;
      }),
      client.getCategoryBudgets().then((data) => {
        if (data) result.cachedEndpoints.push("categoryBudgets");
        return data;
      }),
      client.getTransactions().then((data) => {
        if (data) result.cachedEndpoints.push("transactions");
        return data;
      }),
      client.getAccountArchitecture().then((data) => {
        if (data) result.cachedEndpoints.push("accountArchitecture");
        return data;
      }),
      client.getBudgetSettings().then((data) => {
        if (data) result.cachedEndpoints.push("budgetSettings");
        return data;
      }),
      client.getInvestments().then((data) => {
        if (data) result.cachedEndpoints.push("investments");
        return data;
      }),
      client.getGoals().then((data) => {
        if (data) result.cachedEndpoints.push("goals");
        return data;
      }),
    ];

    await Promise.allSettled(prefetchPromises);

    result.success = result.cachedEndpoints.length > 0;
    result.duration = Date.now() - startTime;

    client.logCacheStats();

    return result;
  } catch (error: any) {
    result.error = error.message || "Unknown error";
    result.duration = Date.now() - startTime;
    return result;
  }
}

export async function runFinanceDataPrefetch(): Promise<{
  total: number;
  success: number;
  failed: number;
  results: FinancePrefetchResult[];
}> {
  const startTime = Date.now();
  console.log(`\n💰 [FINANCE PREFETCH] Starting daily finance data pre-fetch...`);
  console.log(`⏰ [FINANCE PREFETCH] Execution time: ${new Date().toISOString()}`);

  const activeSettings = await storage.getAllActiveFinanceSettings();

  if (activeSettings.length === 0) {
    console.log(`ℹ️  [FINANCE PREFETCH] No users with active finance settings found`);
    return { total: 0, success: 0, failed: 0, results: [] };
  }

  console.log(`📊 [FINANCE PREFETCH] Found ${activeSettings.length} user(s) with active finance settings`);

  const results: FinancePrefetchResult[] = [];
  let successCount = 0;
  let failCount = 0;

  for (const settings of activeSettings) {
    console.log(`\n🔄 [FINANCE PREFETCH] Processing user ${settings.clientId}...`);

    const result = await prefetchFinanceDataForUser(
      settings.clientId,
      settings.percorsoCapitaleEmail
    );

    results.push(result);

    if (result.success) {
      successCount++;
      console.log(
        `✅ [FINANCE PREFETCH] User ${settings.clientId}: Cached ${result.cachedEndpoints.length} endpoints in ${result.duration}ms`
      );
      console.log(`   Endpoints: ${result.cachedEndpoints.join(", ")}`);
    } else {
      failCount++;
      console.error(
        `❌ [FINANCE PREFETCH] User ${settings.clientId}: Failed - ${result.error}`
      );
    }
  }

  const totalDuration = Date.now() - startTime;
  console.log(`\n📈 [FINANCE PREFETCH] Completed in ${totalDuration}ms`);
  console.log(`   Total: ${activeSettings.length}, Success: ${successCount}, Failed: ${failCount}`);

  return {
    total: activeSettings.length,
    success: successCount,
    failed: failCount,
    results,
  };
}
