import { db } from "../db";
import {
  consultantMetaAdsConfig,
  metaAdInsights,
  metaAdInsightsDaily,
  users,
} from "../../shared/schema";
import { eq, and } from "drizzle-orm";
import { decrypt, decryptForConsultant } from "../encryption";

const FB_GRAPH_URL = "https://graph.facebook.com/v19.0";

async function getDecryptedToken(config: any, consultantId: string): Promise<string | null> {
  if (!config.accessToken) return null;

  try {
    const [consultant] = await db
      .select({ encryptionSalt: users.encryptionSalt })
      .from(users)
      .where(eq(users.id, consultantId))
      .limit(1);

    if (consultant?.encryptionSalt) {
      return decryptForConsultant(config.accessToken, consultant.encryptionSalt);
    }
    return decrypt(config.accessToken);
  } catch {
    try {
      return decrypt(config.accessToken);
    } catch {
      return null;
    }
  }
}

export async function syncMetaAdsForConsultant(consultantId: string): Promise<{
  success: boolean;
  adsCount: number;
  error?: string;
}> {
  const startTime = Date.now();

  try {
    const [config] = await db
      .select()
      .from(consultantMetaAdsConfig)
      .where(
        and(
          eq(consultantMetaAdsConfig.consultantId, consultantId),
          eq(consultantMetaAdsConfig.isConnected, true),
          eq(consultantMetaAdsConfig.isActive, true)
        )
      )
      .limit(1);

    if (!config) {
      return { success: false, adsCount: 0, error: "No Meta Ads config found" };
    }

    const accessToken = await getDecryptedToken(config, consultantId);
    if (!accessToken) {
      await db
        .update(consultantMetaAdsConfig)
        .set({ syncError: "Token decryption failed", updatedAt: new Date() })
        .where(eq(consultantMetaAdsConfig.id, config.id));
      return { success: false, adsCount: 0, error: "Token decryption failed" };
    }

    const adAccountId = config.adAccountId;
    if (!adAccountId) {
      return { success: false, adsCount: 0, error: "No ad account ID configured" };
    }

    const actId = adAccountId.startsWith("act_") ? adAccountId : `act_${adAccountId}`;

    const adsFields = [
      "id", "name", "status", "effective_status",
      "campaign{id,name,status,daily_budget,lifetime_budget}",
      "adset{id,name,status}",
      "creative{id,thumbnail_url,body,title}",
    ].join(",");

    const adsRes = await fetch(
      `${FB_GRAPH_URL}/${actId}/ads?fields=${adsFields}&limit=100&access_token=${accessToken}`
    );
    if (!adsRes.ok) {
      const errorMsg = `HTTP ${adsRes.status}: ${adsRes.statusText}`;
      console.error(`[META-ADS SYNC] Fetch failed for ${consultantId}:`, errorMsg);
      await db
        .update(consultantMetaAdsConfig)
        .set({ syncError: errorMsg, updatedAt: new Date() })
        .where(eq(consultantMetaAdsConfig.id, config.id));
      return { success: false, adsCount: 0, error: errorMsg };
    }
    const adsData = (await adsRes.json()) as any;

    if (adsData.error) {
      const errorMsg = adsData.error.message || "Unknown API error";
      console.error(`[META-ADS SYNC] API error for ${consultantId}:`, errorMsg);

      await db
        .update(consultantMetaAdsConfig)
        .set({ syncError: errorMsg, updatedAt: new Date() })
        .where(eq(consultantMetaAdsConfig.id, config.id));

      return { success: false, adsCount: 0, error: errorMsg };
    }

    const ads = adsData.data || [];
    console.log(`[META-ADS SYNC] Found ${ads.length} ads for consultant ${consultantId}`);

    let syncedCount = 0;

    for (const ad of ads) {
      try {
        const insightsRes = await fetch(
          `${FB_GRAPH_URL}/${ad.id}/insights?fields=spend,impressions,clicks,reach,actions,cost_per_action_type,cpc,cpm,ctr,frequency&date_preset=maximum&access_token=${accessToken}`
        );
        if (!insightsRes.ok) {
          console.warn(`[META-ADS SYNC] Insights fetch failed for ad ${ad.id}: HTTP ${insightsRes.status}`);
          continue;
        }
        const insightsData = (await insightsRes.json()) as any;
        const insights = insightsData.data?.[0] || {};

        const leads = extractActionValue(insights.actions, "lead");
        const conversions = extractActionValue(insights.actions, "offsite_conversion");
        const spend = parseFloat(insights.spend || "0");
        const impressionsVal = parseInt(insights.impressions || "0");
        const clicksVal = parseInt(insights.clicks || "0");
        const reachVal = parseInt(insights.reach || "0");

        const cpc = parseFloat(insights.cpc || "0") || (clicksVal > 0 ? spend / clicksVal : null);
        const cpm = parseFloat(insights.cpm || "0") || (impressionsVal > 0 ? (spend / impressionsVal) * 1000 : null);
        const ctr = parseFloat(insights.ctr || "0") || (impressionsVal > 0 ? (clicksVal / impressionsVal) * 100 : null);
        const cpl = leads > 0 ? spend / leads : null;
        const frequency = parseFloat(insights.frequency || "0") || null;

        const campaignBudget = ad.campaign?.daily_budget
          ? parseFloat(ad.campaign.daily_budget) / 100
          : null;
        const lifetimeBudget = ad.campaign?.lifetime_budget
          ? parseFloat(ad.campaign.lifetime_budget) / 100
          : null;

        const [existing] = await db
          .select()
          .from(metaAdInsights)
          .where(
            and(
              eq(metaAdInsights.consultantId, consultantId),
              eq(metaAdInsights.metaAdId, ad.id)
            )
          )
          .limit(1);

        const adData = {
          consultantId,
          configId: config.id,
          metaAdId: ad.id,
          metaCampaignId: ad.campaign?.id || null,
          metaAdsetId: ad.adset?.id || null,
          adName: ad.name,
          campaignName: ad.campaign?.name || null,
          adsetName: ad.adset?.name || null,
          adStatus: ad.effective_status || ad.status || "UNKNOWN",
          campaignStatus: ad.campaign?.status || null,
          dailyBudget: campaignBudget,
          lifetimeBudget,
          spend,
          impressions: impressionsVal,
          clicks: clicksVal,
          reach: reachVal,
          leads,
          conversions,
          cpc,
          cpm,
          ctr,
          cpl,
          frequency,
          roas: null as number | null,
          creativeThumbnailUrl: ad.creative?.thumbnail_url || null,
          creativeBody: ad.creative?.body || null,
          creativeTitle: ad.creative?.title || null,
          lastSyncedAt: new Date(),
          updatedAt: new Date(),
        };

        if (existing) {
          await db
            .update(metaAdInsights)
            .set(adData)
            .where(eq(metaAdInsights.id, existing.id));
        } else {
          await db.insert(metaAdInsights).values(adData);
        }

        syncedCount++;
      } catch (adError: any) {
        console.error(`[META-ADS SYNC] Error syncing ad ${ad.id}:`, adError.message);
      }
    }

    await db
      .update(consultantMetaAdsConfig)
      .set({
        lastSyncedAt: new Date(),
        syncError: null,
        updatedAt: new Date(),
      })
      .where(eq(consultantMetaAdsConfig.id, config.id));

    const elapsed = Date.now() - startTime;
    console.log(`[META-ADS SYNC] ✅ Synced ${syncedCount}/${ads.length} ads for ${consultantId} in ${elapsed}ms`);

    return { success: true, adsCount: syncedCount };
  } catch (error: any) {
    console.error(`[META-ADS SYNC] Fatal error for ${consultantId}:`, error.message);
    return { success: false, adsCount: 0, error: error.message };
  }
}

export async function syncDailySnapshot(consultantId: string): Promise<void> {
  try {
    const today = new Date().toISOString().split("T")[0];

    const currentAds = await db
      .select()
      .from(metaAdInsights)
      .where(eq(metaAdInsights.consultantId, consultantId));

    for (const ad of currentAds) {
      const [existing] = await db
        .select()
        .from(metaAdInsightsDaily)
        .where(
          and(
            eq(metaAdInsightsDaily.consultantId, consultantId),
            eq(metaAdInsightsDaily.metaAdId, ad.metaAdId),
            eq(metaAdInsightsDaily.snapshotDate, today)
          )
        )
        .limit(1);

      const snapshotData = {
        consultantId,
        metaAdId: ad.metaAdId,
        snapshotDate: today,
        spend: ad.spend,
        impressions: ad.impressions,
        clicks: ad.clicks,
        reach: ad.reach,
        leads: ad.leads,
        conversions: ad.conversions,
        cpc: ad.cpc,
        cpm: ad.cpm,
        ctr: ad.ctr,
        cpl: ad.cpl,
        frequency: ad.frequency,
        roas: ad.roas,
      };

      if (existing) {
        await db
          .update(metaAdInsightsDaily)
          .set(snapshotData)
          .where(eq(metaAdInsightsDaily.id, existing.id));
      } else {
        await db.insert(metaAdInsightsDaily).values(snapshotData);
      }
    }

    console.log(`[META-ADS SYNC] Daily snapshot saved for ${consultantId} (${currentAds.length} ads)`);
  } catch (error: any) {
    console.error(`[META-ADS SYNC] Daily snapshot error for ${consultantId}:`, error.message);
  }
}

export async function syncAllConsultants(): Promise<void> {
  try {
    const configs = await db
      .select()
      .from(consultantMetaAdsConfig)
      .where(
        and(
          eq(consultantMetaAdsConfig.isConnected, true),
          eq(consultantMetaAdsConfig.isActive, true),
          eq(consultantMetaAdsConfig.syncEnabled, true)
        )
      );

    console.log(`[META-ADS SYNC] Starting sync for ${configs.length} consultant(s)`);

    for (const config of configs) {
      await syncMetaAdsForConsultant(config.consultantId);
      await syncDailySnapshot(config.consultantId);
    }

    console.log(`[META-ADS SYNC] ✅ Completed sync cycle for ${configs.length} consultant(s)`);
  } catch (error: any) {
    console.error("[META-ADS SYNC] Global sync error:", error.message);
  }
}

function extractActionValue(actions: any[], actionType: string): number {
  if (!Array.isArray(actions)) return 0;
  const action = actions.find(
    (a: any) => a.action_type === actionType || a.action_type?.includes(actionType)
  );
  return action ? parseInt(action.value || "0") : 0;
}

export function startMetaAdsSyncScheduler(): void {
  const enabled = process.env.META_ADS_SYNC_ENABLED !== "false";
  if (!enabled) {
    console.log("[META-ADS SYNC] Scheduler is disabled (set META_ADS_SYNC_ENABLED=true to enable)");
    return;
  }

  const intervalMs = 15 * 60 * 1000;
  console.log("[META-ADS SYNC] Scheduler started (every 15 minutes)");

  setInterval(async () => {
    try {
      await syncAllConsultants();
    } catch (error: any) {
      console.error("[META-ADS SYNC] Scheduler error:", error.message);
    }
  }, intervalMs);

  setTimeout(() => syncAllConsultants(), 60000);
}
