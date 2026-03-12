import { Router, Response } from "express";
import { authenticateToken, type AuthRequest } from "../middleware/auth";
import { requireRole } from "../middleware/auth";
import { db } from "../db";
import * as schema from "../../shared/schema";
import { eq, and, desc, isNull, isNotNull, sql, inArray } from "drizzle-orm";
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

    if (!config) {
      return res.json({ success: true, config: null });
    }

    const tokenExpiresAt = config.tokenExpiresAt ? config.tokenExpiresAt.toISOString() : null;
    let tokenDaysLeft: number | null = null;
    if (config.tokenExpiresAt) {
      const diffMs = config.tokenExpiresAt.getTime() - Date.now();
      const diffDays = diffMs / (1000 * 60 * 60 * 24);
      tokenDaysLeft = diffMs >= 0 ? Math.ceil(diffDays) : Math.floor(diffDays);
    }

    return res.json({
      success: true,
      config: {
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
        tokenExpiresAt,
        tokenDaysLeft,
      },
    });
  } catch (error) {
    console.error("[META-ADS] Error getting config:", error);
    return res.status(500).json({ success: false, error: "Failed to get config" });
  }
});

router.get("/ads", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res: Response) => {
  try {
    const consultantId = req.user!.id;
    const { status, campaignId, sort, days } = req.query;

    const ads = await db
      .select()
      .from(schema.metaAdInsights)
      .where(eq(schema.metaAdInsights.consultantId, consultantId))
      .orderBy(desc(schema.metaAdInsights.spend));

    type AdWithOverrides = typeof ads[number];

    let processedAds: AdWithOverrides[] = ads;

    if (days && days !== "lifetime") {
      const daysNum = Math.min(365, Math.max(1, parseInt(String(days)) || 30));
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - daysNum);
      const cutoffStr = cutoff.toISOString().split("T")[0];

      const dailyRows = await db
        .select()
        .from(schema.metaAdInsightsDaily)
        .where(
          and(
            eq(schema.metaAdInsightsDaily.consultantId, consultantId),
            sql`${schema.metaAdInsightsDaily.snapshotDate} >= ${cutoffStr}`
          )
        )
        .orderBy(schema.metaAdInsightsDaily.snapshotDate);

      const dailyByAd: Record<string, typeof dailyRows> = {};
      for (const d of dailyRows) {
        if (!dailyByAd[d.metaAdId]) dailyByAd[d.metaAdId] = [];
        dailyByAd[d.metaAdId].push(d);
      }

      processedAds = ads.map(ad => {
        const snapshots = dailyByAd[ad.metaAdId];
        if (!snapshots || snapshots.length === 0) return ad;

        const spend = snapshots.reduce((s, d) => s + (d.spend || 0), 0);
        const impressions = snapshots.reduce((s, d) => s + (d.impressions || 0), 0);
        const clicks = snapshots.reduce((s, d) => s + (d.clicks || 0), 0);
        const reach = snapshots.reduce((s, d) => s + (d.reach || 0), 0);
        const leads = snapshots.reduce((s, d) => s + (d.leads || 0), 0);
        const conversions = snapshots.reduce((s, d) => s + (d.conversions || 0), 0);
        const linkClicks = snapshots.reduce((s, d) => s + (d.linkClicks || 0), 0);
        const videoViews = snapshots.reduce((s, d) => s + (d.videoViews || 0), 0);

        const cpc = clicks > 0 ? spend / clicks : null;
        const cpm = impressions > 0 ? (spend / impressions) * 1000 : null;
        const ctr = impressions > 0 ? (clicks / impressions) * 100 : null;
        const cpl = leads > 0 ? spend / leads : null;
        const frequency = impressions > 0 && reach > 0 ? impressions / reach : null;
        const cpcLink = linkClicks > 0 ? spend / linkClicks : null;
        const ctrLink = impressions > 0 && linkClicks > 0 ? (linkClicks / impressions) * 100 : null;

        const latest = snapshots[snapshots.length - 1];

        return {
          ...ad,
          spend,
          impressions,
          clicks,
          reach,
          leads,
          conversions,
          cpc,
          cpm,
          ctr,
          cpl,
          frequency,
          roas: latest.roas,
          linkClicks,
          cpcLink,
          ctrLink,
          resultType: latest.resultType ?? ad.resultType,
          videoViews,
        };
      });
    }

    let filteredAds = processedAds;
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
    } else if (sort === "roas") {
      filteredAds.sort((a, b) => (b.roas || 0) - (a.roas || 0));
    } else if (sort === "frequency") {
      filteredAds.sort((a, b) => (b.frequency || 0) - (a.frequency || 0));
    } else if (sort === "leads") {
      filteredAds.sort((a, b) => (b.leads || 0) - (a.leads || 0));
    } else if (sort === "cpl") {
      filteredAds.sort((a, b) => (a.cpl || 999) - (b.cpl || 999));
    }

    const totalSpend = filteredAds.reduce((sum, a) => sum + (a.spend || 0), 0);
    const totalImpressions = filteredAds.reduce((sum, a) => sum + (a.impressions || 0), 0);
    const totalClicks = filteredAds.reduce((sum, a) => sum + (a.clicks || 0), 0);
    const totalLeads = filteredAds.reduce((sum, a) => sum + (a.leads || 0), 0);
    const totalReach = filteredAds.reduce((sum, a) => sum + (a.reach || 0), 0);
    const totalLinkClicks = filteredAds.reduce((sum, a) => sum + (a.linkClicks || 0), 0);
    const avgCpc = totalClicks > 0 ? totalSpend / totalClicks : 0;
    const avgCtr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
    const avgCpl = totalLeads > 0 ? totalSpend / totalLeads : 0;

    const roasAds = filteredAds.filter(a => a.roas && a.roas > 0);
    const avgRoas = roasAds.length > 0 ? roasAds.reduce((s, a) => s + (a.roas || 0), 0) / roasAds.length : 0;

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
        totalReach,
        totalLinkClicks,
        avgCpc,
        avgCtr,
        avgCpl,
        avgRoas,
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
    const daysCount = Math.min(365, Math.max(1, parseInt(String(days || "30")) || 30));

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

router.get("/data-export", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res: Response) => {
  try {
    const consultantId = req.user!.id;

    const allAds = await db
      .select()
      .from(schema.metaAdInsights)
      .where(eq(schema.metaAdInsights.consultantId, consultantId))
      .orderBy(desc(schema.metaAdInsights.spend));

    const cutoff90 = new Date();
    cutoff90.setDate(cutoff90.getDate() - 90);
    const cutoff90Str = cutoff90.toISOString().split("T")[0];

    const allDaily = await db
      .select()
      .from(schema.metaAdInsightsDaily)
      .where(
        and(
          eq(schema.metaAdInsightsDaily.consultantId, consultantId),
          sql`${schema.metaAdInsightsDaily.snapshotDate} >= ${cutoff90Str}`
        )
      )
      .orderBy(schema.metaAdInsightsDaily.snapshotDate);

    const linkedPosts = await db
      .select({
        id: schema.contentPosts.id,
        title: schema.contentPosts.title,
        hook: schema.contentPosts.hook,
        platform: schema.contentPosts.platform,
        status: schema.contentPosts.status,
        metaAdId: schema.contentPosts.metaAdId,
      })
      .from(schema.contentPosts)
      .where(
        and(
          eq(schema.contentPosts.consultantId, consultantId),
          isNotNull(schema.contentPosts.metaAdId)
        )
      );

    const dailyByAd: Record<string, typeof allDaily> = {};
    for (const d of allDaily) {
      if (!dailyByAd[d.metaAdId]) dailyByAd[d.metaAdId] = [];
      dailyByAd[d.metaAdId].push(d);
    }

    const postByAd: Record<string, typeof linkedPosts[0]> = {};
    for (const p of linkedPosts) {
      if (p.metaAdId) postByAd[p.metaAdId] = p;
    }

    const adsExport = allAds.map(ad => ({
      ...ad,
      daily: dailyByAd[ad.metaAdId] || [],
      linkedPost: postByAd[ad.metaAdId] || null,
    }));

    const campaignMap: Record<string, {
      name: string;
      adsCount: number;
      totalSpend: number;
      totalImpressions: number;
      totalClicks: number;
      totalLeads: number;
      totalReach: number;
      avgCpc: number;
      avgCtr: number;
      avgCpl: number;
      avgRoas: number;
    }> = {};

    for (const ad of allAds) {
      const cName = ad.campaignName || "Sconosciuta";
      if (!campaignMap[cName]) {
        campaignMap[cName] = { name: cName, adsCount: 0, totalSpend: 0, totalImpressions: 0, totalClicks: 0, totalLeads: 0, totalReach: 0, avgCpc: 0, avgCtr: 0, avgCpl: 0, avgRoas: 0 };
      }
      const c = campaignMap[cName];
      c.adsCount++;
      c.totalSpend += ad.spend || 0;
      c.totalImpressions += ad.impressions || 0;
      c.totalClicks += ad.clicks || 0;
      c.totalLeads += ad.leads || 0;
      c.totalReach += ad.reach || 0;
    }

    for (const ad of allAds) {
      const cName = ad.campaignName || "Sconosciuta";
      const c = campaignMap[cName];
      if (c && ad.roas && ad.roas > 0) {
        c.avgRoas += ad.roas;
      }
    }

    const campaigns = Object.values(campaignMap).map(c => {
      const roasAds = allAds.filter(a => (a.campaignName || "Sconosciuta") === c.name && a.roas && a.roas > 0).length;
      return {
        ...c,
        avgCpc: c.totalClicks > 0 ? c.totalSpend / c.totalClicks : 0,
        avgCtr: c.totalImpressions > 0 ? (c.totalClicks / c.totalImpressions) * 100 : 0,
        avgCpl: c.totalLeads > 0 ? c.totalSpend / c.totalLeads : 0,
        avgRoas: roasAds > 0 ? c.avgRoas / roasAds : 0,
        avgFrequency: c.totalImpressions > 0 && c.totalReach > 0 ? c.totalImpressions / c.totalReach : 0,
      };
    });

    const totalSpend = allAds.reduce((s, a) => s + (a.spend || 0), 0);
    const totalClicks = allAds.reduce((s, a) => s + (a.clicks || 0), 0);
    const totalImpressions = allAds.reduce((s, a) => s + (a.impressions || 0), 0);
    const totalLeads = allAds.reduce((s, a) => s + (a.leads || 0), 0);

    const topByRoas = [...allAds].filter(a => a.roas && a.roas > 0).sort((a, b) => (b.roas || 0) - (a.roas || 0)).slice(0, 5);
    const topByCpl = [...allAds].filter(a => a.cpl && a.cpl > 0).sort((a, b) => (a.cpl || 999) - (b.cpl || 999)).slice(0, 5);
    const topByCtr = [...allAds].filter(a => a.ctr && a.ctr > 0).sort((a, b) => (b.ctr || 0) - (a.ctr || 0)).slice(0, 5);

    return res.json({
      success: true,
      exportedAt: new Date().toISOString(),
      ads: adsExport,
      campaigns,
      summary: {
        totalAds: allAds.length,
        activeAds: allAds.filter(a => a.adStatus === "ACTIVE").length,
        totalSpend,
        totalImpressions,
        totalClicks,
        totalLeads,
        avgCpc: totalClicks > 0 ? totalSpend / totalClicks : 0,
        avgCtr: totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0,
        avgCpl: totalLeads > 0 ? totalSpend / totalLeads : 0,
      },
      topPerformers: {
        byRoas: topByRoas.map(a => ({ adName: a.adName, roas: a.roas })),
        byCpl: topByCpl.map(a => ({ adName: a.adName, cpl: a.cpl })),
        byCtr: topByCtr.map(a => ({ adName: a.adName, ctr: a.ctr })),
      },
    });
  } catch (error) {
    console.error("[META-ADS] Error exporting data:", error);
    return res.status(500).json({ success: false, error: "Failed to export data" });
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
        body: schema.contentPosts.body,
        cta: schema.contentPosts.cta,
        folderId: schema.contentPosts.folderId,
      })
      .from(schema.contentPosts)
      .where(
        and(
          eq(schema.contentPosts.consultantId, consultantId),
          isNull(schema.contentPosts.metaAdId),
          eq(schema.contentPosts.isAd, true)
        )
      )
      .orderBy(desc(schema.contentPosts.createdAt))
      .limit(100);

    const folderIds = [...new Set(posts.map(p => p.folderId).filter(Boolean))] as string[];
    let folders: { id: string; name: string; color: string | null; icon: string | null; folderType: string | null }[] = [];
    if (folderIds.length > 0) {
      folders = await db
        .select({
          id: schema.contentFolders.id,
          name: schema.contentFolders.name,
          color: schema.contentFolders.color,
          icon: schema.contentFolders.icon,
          folderType: schema.contentFolders.folderType,
        })
        .from(schema.contentFolders)
        .where(inArray(schema.contentFolders.id, folderIds));
    }

    return res.json({ success: true, posts, folders });
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

      try {
        const { syncMetaAdsToFileSearch } = await import("../ai/dynamic-context-documents");
        await syncMetaAdsToFileSearch(consultantId);
        console.log(`[META-ADS] File Search synced after manual sync for ${consultantId.substring(0, 8)}`);
      } catch (fsErr: any) {
        console.warn(`[META-ADS] File Search sync failed: ${fsErr.message}`);
      }
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

router.get("/hidden-campaigns", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res: Response) => {
  try {
    const consultantId = req.user!.id;
    const [config] = await db
      .select({ hiddenCampaigns: schema.consultantMetaAdsConfig.hiddenCampaigns })
      .from(schema.consultantMetaAdsConfig)
      .where(and(eq(schema.consultantMetaAdsConfig.consultantId, consultantId), eq(schema.consultantMetaAdsConfig.isActive, true)))
      .limit(1);
    return res.json({ success: true, hiddenCampaigns: (config?.hiddenCampaigns as string[]) || [] });
  } catch (error) {
    console.error("[META-ADS] Error getting hidden campaigns:", error);
    return res.status(500).json({ success: false, error: "Failed" });
  }
});

router.post("/hidden-campaigns", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res: Response) => {
  try {
    const consultantId = req.user!.id;
    const { hiddenCampaigns } = req.body;
    if (!Array.isArray(hiddenCampaigns)) {
      return res.status(400).json({ success: false, error: "hiddenCampaigns must be an array" });
    }
    await db
      .update(schema.consultantMetaAdsConfig)
      .set({ hiddenCampaigns, updatedAt: new Date() })
      .where(and(eq(schema.consultantMetaAdsConfig.consultantId, consultantId), eq(schema.consultantMetaAdsConfig.isActive, true)));
    return res.json({ success: true, hiddenCampaigns });
  } catch (error) {
    console.error("[META-ADS] Error updating hidden campaigns:", error);
    return res.status(500).json({ success: false, error: "Failed" });
  }
});

router.get("/ai-excluded-campaigns", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res: Response) => {
  try {
    const consultantId = req.user!.id;
    const [config] = await db
      .select({ aiExcludedCampaigns: schema.consultantMetaAdsConfig.aiExcludedCampaigns })
      .from(schema.consultantMetaAdsConfig)
      .where(and(eq(schema.consultantMetaAdsConfig.consultantId, consultantId), eq(schema.consultantMetaAdsConfig.isActive, true)))
      .limit(1);
    return res.json({ success: true, aiExcludedCampaigns: (config?.aiExcludedCampaigns as string[]) || [] });
  } catch (error) {
    console.error("[META-ADS] Error getting AI excluded campaigns:", error);
    return res.status(500).json({ success: false, error: "Failed" });
  }
});

router.post("/ai-excluded-campaigns", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res: Response) => {
  try {
    const consultantId = req.user!.id;
    const { aiExcludedCampaigns } = req.body;
    if (!Array.isArray(aiExcludedCampaigns)) {
      return res.status(400).json({ success: false, error: "aiExcludedCampaigns must be an array" });
    }
    await db
      .update(schema.consultantMetaAdsConfig)
      .set({ aiExcludedCampaigns, updatedAt: new Date() })
      .where(and(eq(schema.consultantMetaAdsConfig.consultantId, consultantId), eq(schema.consultantMetaAdsConfig.isActive, true)));
    return res.json({ success: true, aiExcludedCampaigns });
  } catch (error) {
    console.error("[META-ADS] Error updating AI excluded campaigns:", error);
    return res.status(500).json({ success: false, error: "Failed" });
  }
});

router.post("/simone-cleanup", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res: Response) => {
  try {
    const consultantId = req.user!.id;
    const { cleanupSimoneStaleData } = await import("../scripts/cleanup-simone-stale-data");
    const result = await cleanupSimoneStaleData(consultantId);
    console.log(`[META-ADS] Simone cleanup for ${consultantId}:`, result);
    return res.json({ success: true, ...result });
  } catch (error) {
    console.error("[META-ADS] Error cleaning Simone data:", error);
    return res.status(500).json({ success: false, error: "Cleanup failed" });
  }
});

router.get("/campaign-export/:campaignName", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res: Response) => {
  try {
    const consultantId = req.user!.id;
    const campaignName = decodeURIComponent(req.params.campaignName);

    const insights = await db
      .select()
      .from(schema.metaAdInsights)
      .where(and(
        eq(schema.metaAdInsights.consultantId, consultantId),
        eq(schema.metaAdInsights.campaignName, campaignName)
      ));

    const metaAdIds = insights.map(a => a.metaAdId);
    let dailySnapshots: any[] = [];
    if (metaAdIds.length > 0) {
      dailySnapshots = await db
        .select()
        .from(schema.metaAdInsightsDaily)
        .where(and(
          eq(schema.metaAdInsightsDaily.consultantId, consultantId),
          inArray(schema.metaAdInsightsDaily.metaAdId, metaAdIds)
        ))
        .orderBy(desc(schema.metaAdInsightsDaily.snapshotDate));
    }

    return res.json({
      success: true,
      campaignName,
      exportDate: new Date().toISOString(),
      totalAds: insights.length,
      insights,
      dailySnapshots,
    });
  } catch (error) {
    console.error("[META-ADS] Error exporting campaign data:", error);
    return res.status(500).json({ success: false, error: "Failed to export campaign data" });
  }
});

export default router;
