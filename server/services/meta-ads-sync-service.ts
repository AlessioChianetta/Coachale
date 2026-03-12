import { db } from "../db";
import {
  consultantMetaAdsConfig,
  metaAdInsights,
  metaAdInsightsDaily,
  users,
  superadminInstagramConfig,
} from "../../shared/schema";
import { eq, and } from "drizzle-orm";
import { decrypt, decryptForConsultant, encrypt, encryptForConsultant } from "../encryption";

const FB_GRAPH_URL = "https://graph.facebook.com/v19.0";
const FB_TOKEN_URL = "https://graph.facebook.com/v19.0/oauth/access_token";

const ALL_EFFECTIVE_STATUSES = [
  "ACTIVE",
  "PAUSED",
  "ARCHIVED",
  "CAMPAIGN_PAUSED",
  "ADSET_PAUSED",
  "DELETED",
  "DISAPPROVED",
  "PENDING_REVIEW",
  "PREAPPROVED",
  "PENDING_BILLING_INFO",
  "WITH_ISSUES",
].join(",");

interface MetaErrorResponse {
  error?: { message?: string; type?: string; code?: number };
}

interface MetaAction {
  action_type?: string;
  value?: string;
}

interface MetaPurchaseRoas {
  action_type?: string;
  value?: string;
}

interface MetaAdCreative {
  thumbnail_url?: string;
  body?: string;
  title?: string;
}

interface MetaAdCampaign {
  id?: string;
  name?: string;
  status?: string;
  daily_budget?: string;
  lifetime_budget?: string;
}

interface MetaAdAdset {
  id?: string;
  name?: string;
  status?: string;
}

interface MetaAd {
  id: string;
  name?: string;
  status?: string;
  effective_status?: string;
  creative?: MetaAdCreative;
  campaign?: MetaAdCampaign;
  adset?: MetaAdAdset;
}

interface MetaAdsResponse extends MetaErrorResponse {
  data?: MetaAd[];
  paging?: { cursors?: { after?: string }; next?: string };
}

interface MetaInsightData {
  spend?: string;
  impressions?: string;
  clicks?: string;
  reach?: string;
  cpc?: string;
  cpm?: string;
  ctr?: string;
  frequency?: string;
  actions?: MetaAction[];
  cost_per_action_type?: MetaAction[];
  purchase_roas?: MetaPurchaseRoas[];
  outbound_clicks?: MetaAction[];
  cost_per_outbound_click?: MetaAction[];
  outbound_clicks_ctr?: MetaAction[];
  date_start?: string;
  date_stop?: string;
}

interface MetaInsightsResponse extends MetaErrorResponse {
  data?: MetaInsightData[];
}

interface MetaAdsConfig {
  id: string;
  consultantId: string;
  adAccountId: string | null;
  accessToken: string | null;
  isConnected: boolean | null;
  isActive: boolean | null;
  syncEnabled: boolean | null;
  tokenExpiresAt?: Date | null;
}

interface MetaTokenResponse extends MetaErrorResponse {
  access_token?: string;
  token_type?: string;
  expires_in?: number;
}

async function getDecryptedToken(config: MetaAdsConfig, consultantId: string): Promise<string | null> {
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

async function getSuperAdminConfig() {
  const [config] = await db
    .select()
    .from(superadminInstagramConfig)
    .where(eq(superadminInstagramConfig.enabled, true))
    .limit(1);
  return config;
}

export async function renewMetaAdsToken(consultantId: string): Promise<{ success: boolean; error?: string }> {
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

    if (!config?.accessToken) {
      return { success: false, error: "No token to renew" };
    }

    const currentToken = await getDecryptedToken(config, consultantId);
    if (!currentToken) {
      return { success: false, error: "Token decryption failed" };
    }

    const superAdminConfig = await getSuperAdminConfig();
    if (!superAdminConfig) {
      return { success: false, error: "No super admin config found" };
    }

    const appSecret = decrypt(superAdminConfig.metaAppSecretEncrypted);

    const longLivedUrl = new URL(FB_TOKEN_URL);
    longLivedUrl.searchParams.set("grant_type", "fb_exchange_token");
    longLivedUrl.searchParams.set("client_id", superAdminConfig.metaAppId);
    longLivedUrl.searchParams.set("client_secret", appSecret);
    longLivedUrl.searchParams.set("fb_exchange_token", currentToken);

    const res = await fetch(longLivedUrl.toString());
    const data: MetaTokenResponse = await res.json();

    if (data.error) {
      console.error(`[META-ADS TOKEN] Renewal failed for ${consultantId}:`, data.error.message);
      return { success: false, error: data.error.message || "Token renewal failed" };
    }

    if (!data.access_token) {
      return { success: false, error: "No access_token in response" };
    }

    const expiresIn = data.expires_in || 5184000;
    const tokenExpiresAt = new Date(Date.now() + expiresIn * 1000);

    const [consultant] = await db
      .select({ encryptionSalt: users.encryptionSalt })
      .from(users)
      .where(eq(users.id, consultantId))
      .limit(1);

    const encryptedToken = consultant?.encryptionSalt
      ? encryptForConsultant(data.access_token, consultant.encryptionSalt)
      : encrypt(data.access_token);

    await db
      .update(consultantMetaAdsConfig)
      .set({
        accessToken: encryptedToken,
        tokenExpiresAt,
        syncError: null,
        updatedAt: new Date(),
      })
      .where(eq(consultantMetaAdsConfig.id, config.id));

    console.log(`[META-ADS TOKEN] ✅ Renewed for ${consultantId} (expires in ${Math.round(expiresIn / 86400)} days)`);
    return { success: true };
  } catch (error: any) {
    console.error(`[META-ADS TOKEN] Error renewing for ${consultantId}:`, error.message);
    return { success: false, error: error.message };
  }
}

async function fetchAllAds(actId: string, accessToken: string, adsFields: string): Promise<MetaAd[]> {
  const allAds: MetaAd[] = [];
  const statusArray = JSON.stringify(ALL_EFFECTIVE_STATUSES.split(","));
  let url = `${FB_GRAPH_URL}/${actId}/ads?fields=${adsFields}&effective_status=${statusArray}&limit=200&access_token=${accessToken}`;

  let pageCount = 0;
  const MAX_PAGES = 10;

  while (url && pageCount < MAX_PAGES) {
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }

    const data: MetaAdsResponse = await res.json();
    if (data.error) {
      throw new Error(data.error.message || "Unknown API error");
    }

    if (data.data) {
      allAds.push(...data.data);
    }

    url = data.paging?.next || "";
    pageCount++;
  }

  return allAds;
}

export async function syncMetaAdsForConsultant(consultantId: string): Promise<{
  success: boolean;
  adsCount: number;
  error?: string;
}> {
  const startTime = Date.now();
  let renewalError: string | null = null;

  try {
    let [config] = await db
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

    if (config.tokenExpiresAt) {
      const daysLeft = (config.tokenExpiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24);

      if (daysLeft <= 0) {
        await db
          .update(consultantMetaAdsConfig)
          .set({ syncError: "Token scaduto — ricollegati a Meta Ads", updatedAt: new Date() })
          .where(eq(consultantMetaAdsConfig.id, config.id));
        return { success: false, adsCount: 0, error: "Token scaduto — ricollegati a Meta Ads" };
      }

      if (daysLeft <= 10) {
        console.log(`[META-ADS SYNC] Token expires in ${Math.round(daysLeft)} days, attempting renewal...`);
        const renewResult = await renewMetaAdsToken(consultantId);
        if (!renewResult.success) {
          console.warn(`[META-ADS SYNC] Token renewal failed: ${renewResult.error}`);
          renewalError = `Rinnovo token fallito: ${renewResult.error || "errore sconosciuto"}`;
          await db
            .update(consultantMetaAdsConfig)
            .set({
              syncError: renewalError,
              updatedAt: new Date(),
            })
            .where(eq(consultantMetaAdsConfig.id, config.id));
        } else {
          const [refreshedConfig] = await db
            .select()
            .from(consultantMetaAdsConfig)
            .where(eq(consultantMetaAdsConfig.id, config.id))
            .limit(1);
          if (refreshedConfig) {
            config.accessToken = refreshedConfig.accessToken;
          }
        }
      }
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

    let ads: MetaAd[];
    try {
      ads = await fetchAllAds(actId, accessToken, adsFields);
    } catch (err: any) {
      const errorMsg = err.message || "Unknown fetch error";
      console.error(`[META-ADS SYNC] Fetch failed for ${consultantId}:`, errorMsg);
      await db
        .update(consultantMetaAdsConfig)
        .set({ syncError: errorMsg, updatedAt: new Date() })
        .where(eq(consultantMetaAdsConfig.id, config.id));
      return { success: false, adsCount: 0, error: errorMsg };
    }

    console.log(`[META-ADS SYNC] Found ${ads.length} total ads for consultant ${consultantId}`);

    let syncedCount = 0;

    for (const ad of ads) {
      try {
        const insightsFields = [
          "spend", "impressions", "clicks", "reach",
          "actions", "cost_per_action_type",
          "cpc", "cpm", "ctr", "frequency", "purchase_roas",
          "outbound_clicks", "cost_per_outbound_click", "outbound_clicks_ctr",
          "date_start", "date_stop",
        ].join(",");

        const insightsRes = await fetch(
          `${FB_GRAPH_URL}/${ad.id}/insights?fields=${insightsFields}&date_preset=maximum&access_token=${accessToken}`
        );
        if (!insightsRes.ok) {
          console.warn(`[META-ADS SYNC] Insights fetch failed for ad ${ad.id}: HTTP ${insightsRes.status}`);
          continue;
        }
        const insightsData: MetaInsightsResponse = await insightsRes.json();
        const insights: MetaInsightData = insightsData.data?.[0] || {};

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

        let roas: number | null = null;
        if (insights.purchase_roas && Array.isArray(insights.purchase_roas) && insights.purchase_roas.length > 0) {
          roas = parseFloat(insights.purchase_roas[0]?.value || "0") || null;
        }

        const linkClicks = extractOutboundValue(insights.outbound_clicks);
        const cpcLink = extractOutboundFloat(insights.cost_per_outbound_click);
        const ctrLink = extractOutboundFloat(insights.outbound_clicks_ctr);

        let resultType: string | null = null;
        if (leads > 0) resultType = "lead";
        else if (conversions > 0) resultType = "offsite_conversion";
        else if (linkClicks > 0) resultType = "link_click";

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
          roas,
          linkClicks,
          cpcLink,
          ctrLink,
          resultType,
          creativeThumbnailUrl: ad.creative?.thumbnail_url || null,
          creativeBody: ad.creative?.body || null,
          creativeTitle: ad.creative?.title || null,
          dateStart: insights.date_start || null,
          dateStop: insights.date_stop || null,
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
        syncError: renewalError,
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
        linkClicks: ad.linkClicks,
        cpcLink: ad.cpcLink,
        ctrLink: ad.ctrLink,
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

function extractActionValue(actions: MetaAction[] | undefined, actionType: string): number {
  if (!Array.isArray(actions)) return 0;
  const action = actions.find(
    (a: MetaAction) => a.action_type === actionType || a.action_type?.includes(actionType)
  );
  return action ? parseInt(action.value || "0") : 0;
}

function extractOutboundValue(outboundClicks: MetaAction[] | undefined): number {
  if (!Array.isArray(outboundClicks) || outboundClicks.length === 0) return 0;
  const click = outboundClicks.find(a => a.action_type === "outbound_click") || outboundClicks[0];
  return parseInt(click?.value || "0");
}

function extractOutboundFloat(outboundData: MetaAction[] | undefined): number | null {
  if (!Array.isArray(outboundData) || outboundData.length === 0) return null;
  const item = outboundData.find(a => a.action_type === "outbound_click") || outboundData[0];
  const val = parseFloat(item?.value || "0");
  return val || null;
}

export function startMetaAdsSyncScheduler(): void {
  const enabled = process.env.META_ADS_SYNC_ENABLED === "true";
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
