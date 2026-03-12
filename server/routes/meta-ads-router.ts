import { Router, Response } from "express";
import { authenticateToken, type AuthRequest } from "../middleware/auth";
import { requireRole } from "../middleware/auth";
import { db } from "../db";
import * as schema from "../../shared/schema";
import { eq, and, desc, isNull, isNotNull, sql } from "drizzle-orm";
import { syncMetaAdsForConsultant, syncDailySnapshot } from "../services/meta-ads-sync-service";

const router = Router();

router.get("/config", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res: Response) => {
  try {
    const consultantId = req.user!.id;

    const [config] = await db
      .select()
      .from(schema.consultantMetaAdsConfig)
      .where(
        and(
          eq(schema.consultantMetaAdsConfig.consultantId, consultantId),
          eq(schema.consultantMetaAdsConfig.isActive, true)
        )
      )
      .limit(1);

    return res.json({
      success: true,
      config: config
        ? {
            id: config.id,
            adAccountId: config.adAccountId,
            adAccountName: config.adAccountName,
            businessId: config.businessId,
            businessName: config.businessName,
            isConnected: config.isConnected,
            connectedAt: config.connectedAt,
            syncEnabled: config.syncEnabled,
            lastSyncedAt: config.lastSyncedAt,
            syncError: config.syncError,
          }
        : null,
    });
  } catch (error) {
    console.error("[META-ADS] Error getting config:", error);
    return res.status(500).json({ success: false, error: "Failed to get config" });
  }
});

router.get("/ads", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res: Response) => {
  try {
    const consultantId = req.user!.id;
    const { status, campaignId, sort } = req.query;

    const ads = await db
      .select()
      .from(schema.metaAdInsights)
      .where(eq(schema.metaAdInsights.consultantId, consultantId))
      .orderBy(desc(schema.metaAdInsights.spend));

    let filteredAds = ads;
    if (status && status !== "all") {
      filteredAds = filteredAds.filter((a) => a.adStatus === String(status));
    }
    if (campaignId) {
      filteredAds = filteredAds.filter((a) => a.metaCampaignId === String(campaignId));
    }

    if (sort === "cpc") {
      filteredAds.sort((a, b) => (a.cpc || 999) - (b.cpc || 999));
    } else if (sort === "ctr") {
      filteredAds.sort((a, b) => (b.ctr || 0) - (a.ctr || 0));
    } else if (sort === "spend") {
      filteredAds.sort((a, b) => (b.spend || 0) - (a.spend || 0));
    }

    const totalSpend = filteredAds.reduce((sum, a) => sum + (a.spend || 0), 0);
    const totalImpressions = filteredAds.reduce((sum, a) => sum + (a.impressions || 0), 0);
    const totalClicks = filteredAds.reduce((sum, a) => sum + (a.clicks || 0), 0);
    const totalLeads = filteredAds.reduce((sum, a) => sum + (a.leads || 0), 0);
    const avgCpc = totalClicks > 0 ? totalSpend / totalClicks : 0;
    const avgCtr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
    const avgCpl = totalLeads > 0 ? totalSpend / totalLeads : 0;

    const campaigns = [...new Set(filteredAds.map((a) => a.campaignName).filter(Boolean))];

    return res.json({
      success: true,
      ads: filteredAds,
      summary: {
        totalAds: filteredAds.length,
        activeAds: filteredAds.filter((a) => a.adStatus === "ACTIVE").length,
        totalSpend,
        totalImpressions,
        totalClicks,
        totalLeads,
        avgCpc,
        avgCtr,
        avgCpl,
      },
      campaigns,
    });
  } catch (error) {
    console.error("[META-ADS] Error getting ads:", error);
    return res.status(500).json({ success: false, error: "Failed to get ads" });
  }
});

router.get("/ads/:metaAdId", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res: Response) => {
  try {
    const consultantId = req.user!.id;
    const { metaAdId } = req.params;
    const { days } = req.query;
    const daysCount = parseInt(String(days || "30"));

    const [ad] = await db
      .select()
      .from(schema.metaAdInsights)
      .where(
        and(
          eq(schema.metaAdInsights.consultantId, consultantId),
          eq(schema.metaAdInsights.metaAdId, metaAdId)
        )
      )
      .limit(1);

    if (!ad) {
      return res.status(404).json({ success: false, error: "Ad not found" });
    }

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysCount);
    const cutoffStr = cutoffDate.toISOString().split("T")[0];

    const dailyData = await db
      .select()
      .from(schema.metaAdInsightsDaily)
      .where(
        and(
          eq(schema.metaAdInsightsDaily.consultantId, consultantId),
          eq(schema.metaAdInsightsDaily.metaAdId, metaAdId),
          sql`${schema.metaAdInsightsDaily.snapshotDate} >= ${cutoffStr}`
        )
      )
      .orderBy(schema.metaAdInsightsDaily.snapshotDate);

    const [linkedPost] = await db
      .select({
        id: schema.contentPosts.id,
        title: schema.contentPosts.title,
        hook: schema.contentPosts.hook,
        platform: schema.contentPosts.platform,
        status: schema.contentPosts.status,
      })
      .from(schema.contentPosts)
      .where(
        and(
          eq(schema.contentPosts.consultantId, consultantId),
          eq(schema.contentPosts.metaAdId, metaAdId)
        )
      )
      .limit(1);

    return res.json({
      success: true,
      ad,
      dailyData,
      linkedPost: linkedPost || null,
    });
  } catch (error) {
    console.error("[META-ADS] Error getting ad detail:", error);
    return res.status(500).json({ success: false, error: "Failed to get ad detail" });
  }
});

router.post("/ads/:metaAdId/link-post", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res: Response) => {
  try {
    const consultantId = req.user!.id;
    const { metaAdId } = req.params;
    const { postId } = req.body;

    if (!postId) {
      return res.status(400).json({ success: false, error: "postId richiesto" });
    }

    const [ad] = await db
      .select()
      .from(schema.metaAdInsights)
      .where(
        and(
          eq(schema.metaAdInsights.consultantId, consultantId),
          eq(schema.metaAdInsights.metaAdId, metaAdId)
        )
      )
      .limit(1);

    if (!ad) {
      return res.status(404).json({ success: false, error: "Inserzione non trovata" });
    }

    const [post] = await db
      .select()
      .from(schema.contentPosts)
      .where(
        and(
          eq(schema.contentPosts.id, postId),
          eq(schema.contentPosts.consultantId, consultantId)
        )
      )
      .limit(1);

    if (!post) {
      return res.status(404).json({ success: false, error: "Post non trovato" });
    }

    await db
      .update(schema.contentPosts)
      .set({ metaAdId, updatedAt: new Date() })
      .where(eq(schema.contentPosts.id, postId));

    console.log(`[META-ADS] Linked ad ${metaAdId} to post ${postId} for consultant ${consultantId}`);

    return res.json({ success: true });
  } catch (error) {
    console.error("[META-ADS] Error linking ad to post:", error);
    return res.status(500).json({ success: false, error: "Failed to link ad to post" });
  }
});

router.post("/ads/:metaAdId/unlink-post", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res: Response) => {
  try {
    const consultantId = req.user!.id;
    const { metaAdId } = req.params;

    await db
      .update(schema.contentPosts)
      .set({ metaAdId: null, updatedAt: new Date() })
      .where(
        and(
          eq(schema.contentPosts.consultantId, consultantId),
          eq(schema.contentPosts.metaAdId, metaAdId)
        )
      );

    return res.json({ success: true });
  } catch (error) {
    console.error("[META-ADS] Error unlinking ad:", error);
    return res.status(500).json({ success: false, error: "Failed to unlink ad" });
  }
});

router.get("/unlinked-posts", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res: Response) => {
  try {
    const consultantId = req.user!.id;

    const posts = await db
      .select({
        id: schema.contentPosts.id,
        title: schema.contentPosts.title,
        hook: schema.contentPosts.hook,
        platform: schema.contentPosts.platform,
        status: schema.contentPosts.status,
        imageUrl: schema.contentPosts.imageUrl,
        createdAt: schema.contentPosts.createdAt,
        metaAdId: schema.contentPosts.metaAdId,
      })
      .from(schema.contentPosts)
      .where(
        and(
          eq(schema.contentPosts.consultantId, consultantId),
          isNull(schema.contentPosts.metaAdId)
        )
      )
      .orderBy(desc(schema.contentPosts.createdAt))
      .limit(50);

    return res.json({ success: true, posts });
  } catch (error) {
    console.error("[META-ADS] Error getting unlinked posts:", error);
    return res.status(500).json({ success: false, error: "Failed to get unlinked posts" });
  }
});

router.post("/sync", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res: Response) => {
  try {
    const consultantId = req.user!.id;

    const result = await syncMetaAdsForConsultant(consultantId);
    if (result.success) {
      await syncDailySnapshot(consultantId);
    }

    return res.json({
      success: result.success,
      adsCount: result.adsCount,
      error: result.error || null,
    });
  } catch (error) {
    console.error("[META-ADS] Error triggering sync:", error);
    return res.status(500).json({ success: false, error: "Failed to sync" });
  }
});

router.get("/summary", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res: Response) => {
  try {
    const consultantId = req.user!.id;

    const ads = await db
      .select()
      .from(schema.metaAdInsights)
      .where(eq(schema.metaAdInsights.consultantId, consultantId));

    const activeAds = ads.filter((a) => a.adStatus === "ACTIVE");

    const totalSpend = ads.reduce((s, a) => s + (a.spend || 0), 0);
    const totalClicks = ads.reduce((s, a) => s + (a.clicks || 0), 0);
    const totalImpressions = ads.reduce((s, a) => s + (a.impressions || 0), 0);
    const totalLeads = ads.reduce((s, a) => s + (a.leads || 0), 0);
    const totalReach = ads.reduce((s, a) => s + (a.reach || 0), 0);

    const linkedPostsCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(schema.contentPosts)
      .where(
        and(
          eq(schema.contentPosts.consultantId, consultantId),
          isNotNull(schema.contentPosts.metaAdId)
        )
      );

    return res.json({
      success: true,
      summary: {
        totalAds: ads.length,
        activeAds: activeAds.length,
        totalSpend,
        totalImpressions,
        totalClicks,
        totalReach,
        totalLeads,
        avgCpc: totalClicks > 0 ? totalSpend / totalClicks : 0,
        avgCtr: totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0,
        avgCpl: totalLeads > 0 ? totalSpend / totalLeads : 0,
        linkedPosts: Number(linkedPostsCount[0]?.count || 0),
      },
    });
  } catch (error) {
    console.error("[META-ADS] Error getting summary:", error);
    return res.status(500).json({ success: false, error: "Failed to get summary" });
  }
});

router.delete("/disconnect", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res: Response) => {
  try {
    const consultantId = req.user!.id;

    const [config] = await db
      .select()
      .from(schema.consultantMetaAdsConfig)
      .where(
        and(
          eq(schema.consultantMetaAdsConfig.consultantId, consultantId),
          eq(schema.consultantMetaAdsConfig.isActive, true)
        )
      )
      .limit(1);

    if (!config) {
      return res.status(404).json({ success: false, error: "Nessun account Meta Ads collegato" });
    }

    await db
      .update(schema.consultantMetaAdsConfig)
      .set({
        isActive: false,
        isConnected: false,
        accessToken: null,
        syncEnabled: false,
        updatedAt: new Date(),
      })
      .where(eq(schema.consultantMetaAdsConfig.id, config.id));

    await db
      .update(schema.contentPosts)
      .set({ metaAdId: null, updatedAt: new Date() })
      .where(eq(schema.contentPosts.consultantId, consultantId));

    console.log(`[META-ADS] Disconnected account for consultant ${consultantId}`);

    return res.json({ success: true });
  } catch (error) {
    console.error("[META-ADS] Error disconnecting:", error);
    return res.status(500).json({ success: false, error: "Failed to disconnect" });
  }
});

export default router;
