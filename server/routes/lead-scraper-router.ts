import { Router, Response } from "express";
import { db } from "../db";
import { eq, and, desc, sql, ilike, gte } from "drizzle-orm";
import { leadScraperSearches, leadScraperResults, superadminLeadScraperConfig } from "../../shared/schema";
import { AuthRequest, authenticateToken, requireRole } from "../middleware/auth";
import { searchGoogleMaps, scrapeWebsiteWithFirecrawl, enrichSearchResults } from "../services/lead-scraper-service";
import { decrypt } from "../encryption";

const router = Router();

async function getLeadScraperKeys(): Promise<{ serpApiKey: string | null; firecrawlKey: string | null }> {
  try {
    const [config] = await db.select().from(superadminLeadScraperConfig).limit(1);
    if (config && config.enabled) {
      return {
        serpApiKey: config.serpapiKeyEncrypted ? decrypt(config.serpapiKeyEncrypted) : null,
        firecrawlKey: config.firecrawlKeyEncrypted ? decrypt(config.firecrawlKeyEncrypted) : null,
      };
    }
  } catch (e) {
    console.error("[LEAD-SCRAPER] Error reading keys from DB, falling back to env:", e);
  }
  return {
    serpApiKey: process.env.SERPAPI_KEY || null,
    firecrawlKey: process.env.FIRECRAWL_API_KEY || null,
  };
}

router.post("/search", authenticateToken, requireRole(["consultant", "super_admin"]), async (req: AuthRequest, res: Response) => {
  try {
    const { query, location, limit = 20, autoScrapeWebsites = true } = req.body;
    const consultantId = req.user?.id;

    if (!query) return res.status(400).json({ error: "Query is required" });

    const keys = await getLeadScraperKeys();
    const serpApiKey = keys.serpApiKey;
    if (!serpApiKey) {
      return res.status(400).json({ error: "SERPAPI_KEY non configurata. Vai nelle Impostazioni Admin > Lead Scraper per configurarla." });
    }

    const [search] = await db
      .insert(leadScraperSearches)
      .values({
        consultantId: consultantId!,
        query,
        location: location || "",
        status: "running",
        metadata: { params: { limit, autoScrapeWebsites } },
      })
      .returning();

    res.json({ searchId: search.id, status: "running", message: "Search started" });

    (async () => {
      try {
        const results = await searchGoogleMaps(query, location, limit, serpApiKey);

        for (const result of results) {
          await db.insert(leadScraperResults).values({
            searchId: search.id,
            businessName: result.title || null,
            address: result.address || null,
            phone: result.phone || null,
            website: result.website || null,
            rating: result.rating || null,
            reviewsCount: result.reviews || null,
            category: result.type || null,
            latitude: result.gps_coordinates?.latitude || null,
            longitude: result.gps_coordinates?.longitude || null,
            hours: result.operating_hours || null,
            scrapeStatus: result.website ? "pending" : "no_website",
            source: "google_maps",
          });
        }

        await db
          .update(leadScraperSearches)
          .set({
            status: autoScrapeWebsites ? "enriching" : "completed",
            resultsCount: results.length,
          })
          .where(eq(leadScraperSearches.id, search.id));

        if (autoScrapeWebsites) {
          const bgKeys = await getLeadScraperKeys();
          const firecrawlKey = bgKeys.firecrawlKey;
          if (firecrawlKey) {
            await enrichSearchResults(search.id, firecrawlKey);
          }

          await db
            .update(leadScraperSearches)
            .set({ status: "completed" })
            .where(eq(leadScraperSearches.id, search.id));
        }
      } catch (error: any) {
        console.error("Background search error:", error);
        await db
          .update(leadScraperSearches)
          .set({
            status: "failed",
            metadata: sql`jsonb_set(COALESCE(metadata, '{}'::jsonb), '{error}', ${JSON.stringify(error.message)}::jsonb)`,
          })
          .where(eq(leadScraperSearches.id, search.id));
      }
    })();
  } catch (error: any) {
    console.error("Error starting search:", error);
    res.status(500).json({ error: error.message });
  }
});

router.get("/searches", authenticateToken, requireRole(["consultant", "super_admin"]), async (req: AuthRequest, res: Response) => {
  try {
    const consultantId = req.user?.id;

    const searches = await db
      .select()
      .from(leadScraperSearches)
      .where(eq(leadScraperSearches.consultantId, consultantId!))
      .orderBy(desc(leadScraperSearches.createdAt));

    res.json(searches);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/searches/:id", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const [search] = await db
      .select()
      .from(leadScraperSearches)
      .where(and(eq(leadScraperSearches.id, req.params.id), eq(leadScraperSearches.consultantId, req.user!.id)));

    if (!search) return res.status(404).json({ error: "Search not found" });

    const results = await db
      .select()
      .from(leadScraperResults)
      .where(eq(leadScraperResults.searchId, search.id))
      .orderBy(desc(leadScraperResults.rating));

    res.json({ search, results });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/searches/:id/results", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { has_email, has_phone, rating_min, category, search: searchText } = req.query;

    let conditions: any[] = [eq(leadScraperResults.searchId, req.params.id)];

    if (has_email === "true") {
      conditions.push(sql`${leadScraperResults.email} IS NOT NULL AND ${leadScraperResults.email} != ''`);
    }
    if (has_phone === "true") {
      conditions.push(sql`${leadScraperResults.phone} IS NOT NULL AND ${leadScraperResults.phone} != ''`);
    }
    if (rating_min) {
      conditions.push(gte(leadScraperResults.rating, parseFloat(rating_min as string)));
    }
    if (category) {
      conditions.push(ilike(leadScraperResults.category, `%${category}%`));
    }
    if (searchText) {
      conditions.push(ilike(leadScraperResults.businessName, `%${searchText}%`));
    }

    const results = await db
      .select()
      .from(leadScraperResults)
      .where(and(...conditions))
      .orderBy(desc(leadScraperResults.rating));

    res.json(results);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/results/:id/scrape-website", authenticateToken, requireRole(["consultant", "super_admin"]), async (req: AuthRequest, res: Response) => {
  try {
    const scrapeKeys = await getLeadScraperKeys();
    const firecrawlKey = scrapeKeys.firecrawlKey;
    if (!firecrawlKey) {
      return res.status(400).json({ error: "FIRECRAWL_API_KEY non configurata. Vai nelle Impostazioni Admin > Lead Scraper per configurarla." });
    }

    const [result] = await db
      .select()
      .from(leadScraperResults)
      .where(eq(leadScraperResults.id, req.params.id));

    if (!result) return res.status(404).json({ error: "Result not found" });
    if (!result.website) return res.status(400).json({ error: "No website to scrape" });

    let websiteUrl = result.website;
    if (!websiteUrl.startsWith("http")) websiteUrl = `https://${websiteUrl}`;

    const websiteData = await scrapeWebsiteWithFirecrawl(websiteUrl, firecrawlKey);

    const primaryEmail = websiteData.emails.length > 0 ? websiteData.emails[0] : result.email;

    const [updated] = await db
      .update(leadScraperResults)
      .set({
        websiteData: websiteData as any,
        email: primaryEmail,
        scrapeStatus: "scraped",
      })
      .where(eq(leadScraperResults.id, req.params.id))
      .returning();

    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/searches/:id/export", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const [search] = await db
      .select()
      .from(leadScraperSearches)
      .where(and(eq(leadScraperSearches.id, req.params.id), eq(leadScraperSearches.consultantId, req.user!.id)));

    if (!search) return res.status(404).json({ error: "Search not found" });

    const results = await db
      .select()
      .from(leadScraperResults)
      .where(eq(leadScraperResults.searchId, req.params.id))
      .orderBy(desc(leadScraperResults.rating));

    const csvHeaders = "Nome,Indirizzo,Telefono,Email,Sito Web,Rating,Recensioni,Categoria,Email Extra,Social,Descrizione\n";
    const csvRows = results.map((r) => {
      const wd = r.websiteData as any || {};
      const extraEmails = (wd.emails || []).join("; ");
      const social = Object.entries(wd.socialLinks || {}).map(([k, v]) => `${k}: ${v}`).join("; ");
      const desc = (wd.description || "").replace(/"/g, '""').substring(0, 200);
      return [
        `"${(r.businessName || "").replace(/"/g, '""')}"`,
        `"${(r.address || "").replace(/"/g, '""')}"`,
        `"${r.phone || ""}"`,
        `"${r.email || ""}"`,
        `"${r.website || ""}"`,
        r.rating || "",
        r.reviewsCount || "",
        `"${(r.category || "").replace(/"/g, '""')}"`,
        `"${extraEmails}"`,
        `"${social}"`,
        `"${desc}"`,
      ].join(",");
    });

    const csv = csvHeaders + csvRows.join("\n");
    const filename = `lead_scraper_${search?.query?.replace(/\s+/g, "_") || "export"}_${new Date().toISOString().split("T")[0]}.csv`;

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send("\uFEFF" + csv);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.delete("/searches/:id", authenticateToken, requireRole(["consultant", "super_admin"]), async (req: AuthRequest, res: Response) => {
  try {
    const [deleted] = await db
      .delete(leadScraperSearches)
      .where(and(eq(leadScraperSearches.id, req.params.id), eq(leadScraperSearches.consultantId, req.user!.id)))
      .returning();

    if (!deleted) return res.status(404).json({ error: "Search not found" });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
