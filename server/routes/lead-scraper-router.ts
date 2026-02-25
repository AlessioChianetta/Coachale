import { Router, Response } from "express";
import { db } from "../db";
import { eq, and, desc, sql, ilike, gte } from "drizzle-orm";
import { leadScraperSearches, leadScraperResults, superadminLeadScraperConfig, leadScraperSalesContext } from "../../shared/schema";
import { AuthRequest, authenticateToken, requireAnyRole } from "../middleware/auth";
import { searchGoogleMaps, searchGoogleWeb, scrapeWebsiteWithFirecrawl, enrichSearchResults, generateSalesSummary, generateBatchSalesSummaries } from "../services/lead-scraper-service";
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

router.post("/search", authenticateToken, requireAnyRole(["consultant", "super_admin"]), async (req: AuthRequest, res: Response) => {
  try {
    const { query, location, limit = 20, autoScrapeWebsites = true, searchEngine = "google_maps" } = req.body;
    const consultantId = req.user?.id;

    if (!query) return res.status(400).json({ error: "Query is required" });
    if (!["google_maps", "google_search"].includes(searchEngine)) {
      return res.status(400).json({ error: "searchEngine deve essere 'google_maps' o 'google_search'" });
    }

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
        metadata: { params: { limit, autoScrapeWebsites, searchEngine } },
      })
      .returning();

    res.json({ searchId: search.id, status: "running", message: "Search started" });

    (async () => {
      try {
        if (searchEngine === "google_search") {
          const webResults = await searchGoogleWeb(query, location, limit, serpApiKey);

          for (const result of webResults) {
            await db.insert(leadScraperResults).values({
              searchId: search.id,
              businessName: result.title || null,
              address: null,
              phone: null,
              website: result.website || null,
              rating: null,
              reviewsCount: null,
              category: null,
              latitude: null,
              longitude: null,
              hours: null,
              websiteData: result.snippet ? { description: result.snippet, emails: [], phones: [], socialLinks: {}, services: [] } : null,
              scrapeStatus: result.website ? "pending" : "no_website",
              source: "google_search",
            });
          }

          await db
            .update(leadScraperSearches)
            .set({
              status: autoScrapeWebsites ? "enriching" : "completed",
              resultsCount: webResults.length,
            })
            .where(eq(leadScraperSearches.id, search.id));
        } else {
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
        }

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

router.get("/searches", authenticateToken, requireAnyRole(["consultant", "super_admin"]), async (req: AuthRequest, res: Response) => {
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
    const { has_email, has_phone, rating_min, category, search: searchText, lead_status } = req.query;

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
    if (lead_status && lead_status !== "tutti") {
      conditions.push(eq(leadScraperResults.leadStatus, lead_status as string));
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

router.post("/results/:id/scrape-website", authenticateToken, requireAnyRole(["consultant", "super_admin"]), async (req: AuthRequest, res: Response) => {
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
    const primaryPhone = (!result.phone && websiteData.phones.length > 0) ? websiteData.phones[0] : result.phone;

    const [updated] = await db
      .update(leadScraperResults)
      .set({
        websiteData: websiteData as any,
        email: primaryEmail,
        phone: primaryPhone,
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

    const csvHeaders = "Nome,Indirizzo,Telefono,Email,Sito Web,Rating,Recensioni,Categoria,Email Extra,Telefoni Extra,Social,Servizi,Descrizione\n";
    const csvRows = results.map((r) => {
      const wd = r.websiteData as any || {};
      const extraEmails = (wd.emails || []).join("; ");
      const extraPhones = (wd.phones || []).join("; ");
      const social = Object.entries(wd.socialLinks || {}).map(([k, v]) => `${k}: ${v}`).join("; ");
      const services = (wd.services || []).join("; ");
      const desc = (wd.description || "").replace(/"/g, '""').replace(/\n/g, " ");
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
        `"${extraPhones}"`,
        `"${social}"`,
        `"${services}"`,
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

router.delete("/searches/:id", authenticateToken, requireAnyRole(["consultant", "super_admin"]), async (req: AuthRequest, res: Response) => {
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

router.patch("/results/:id/crm", authenticateToken, requireAnyRole(["consultant", "super_admin"]), async (req: AuthRequest, res: Response) => {
  try {
    const { leadStatus, leadNotes, leadNextAction, leadNextActionDate, leadValue } = req.body;

    const [existing] = await db.select().from(leadScraperResults).where(eq(leadScraperResults.id, req.params.id));
    if (!existing) return res.status(404).json({ error: "Result not found" });

    const updateData: any = {};
    if (leadStatus !== undefined) updateData.leadStatus = leadStatus;
    if (leadNotes !== undefined) updateData.leadNotes = leadNotes;
    if (leadNextAction !== undefined) updateData.leadNextAction = leadNextAction;
    if (leadNextActionDate !== undefined) updateData.leadNextActionDate = leadNextActionDate ? new Date(leadNextActionDate) : null;
    if (leadValue !== undefined) updateData.leadValue = leadValue;

    if (leadStatus && leadStatus !== "nuovo" && !existing.leadContactedAt) {
      updateData.leadContactedAt = new Date();
    }

    const [updated] = await db
      .update(leadScraperResults)
      .set(updateData)
      .where(eq(leadScraperResults.id, req.params.id))
      .returning();

    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/sales-context", authenticateToken, requireAnyRole(["consultant", "super_admin"]), async (req: AuthRequest, res: Response) => {
  try {
    const consultantId = req.user!.id;
    const [context] = await db
      .select()
      .from(leadScraperSalesContext)
      .where(eq(leadScraperSalesContext.consultantId, consultantId));

    res.json(context || null);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.put("/sales-context", authenticateToken, requireAnyRole(["consultant", "super_admin"]), async (req: AuthRequest, res: Response) => {
  try {
    const consultantId = req.user!.id;
    const { servicesOffered, targetAudience, valueProposition, pricingInfo, competitiveAdvantages, idealClientProfile, salesApproach, caseStudies, additionalContext } = req.body;

    const [existing] = await db
      .select()
      .from(leadScraperSalesContext)
      .where(eq(leadScraperSalesContext.consultantId, consultantId));

    if (existing) {
      const [updated] = await db
        .update(leadScraperSalesContext)
        .set({
          servicesOffered, targetAudience, valueProposition, pricingInfo,
          competitiveAdvantages, idealClientProfile, salesApproach, caseStudies,
          additionalContext, updatedAt: new Date(),
        })
        .where(eq(leadScraperSalesContext.consultantId, consultantId))
        .returning();
      res.json(updated);
    } else {
      const [created] = await db
        .insert(leadScraperSalesContext)
        .values({
          consultantId, servicesOffered, targetAudience, valueProposition,
          pricingInfo, competitiveAdvantages, idealClientProfile, salesApproach,
          caseStudies, additionalContext,
        })
        .returning();
      res.json(created);
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/results/:id/generate-summary", authenticateToken, requireAnyRole(["consultant", "super_admin"]), async (req: AuthRequest, res: Response) => {
  try {
    const consultantId = req.user!.id;
    const result = await generateSalesSummary(req.params.id, consultantId);
    res.json(result);
  } catch (error: any) {
    console.error("[LEAD-SCRAPER] Error generating summary:", error);
    res.status(500).json({ error: error.message });
  }
});

router.post("/searches/:id/generate-summaries", authenticateToken, requireAnyRole(["consultant", "super_admin"]), async (req: AuthRequest, res: Response) => {
  try {
    const consultantId = req.user!.id;
    res.json({ status: "started", message: "Generazione resoconti AI avviata in background" });

    generateBatchSalesSummaries(req.params.id, consultantId).catch((err) => {
      console.error("[LEAD-SCRAPER] Batch summary generation error:", err);
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/chat", authenticateToken, requireAnyRole(["consultant", "super_admin"]), async (req: AuthRequest, res: Response) => {
  try {
    const consultantId = req.user!.id;
    const { systemContext, contents } = req.body;

    if (!contents || !Array.isArray(contents)) {
      return res.status(400).json({ error: "contents array is required" });
    }

    const { quickGenerate } = await import("../ai/provider-factory");

    const result = await quickGenerate({
      consultantId,
      feature: "lead-scraper-sales-chat",
      contents: contents.map((c: any) => ({
        role: c.role === "assistant" ? "model" : c.role,
        parts: c.parts,
      })),
      systemInstruction: systemContext || "Sei un AI Sales Agent. Aiuta il consulente con strategie di vendita.",
      thinkingLevel: "low",
    });

    res.json({ text: result.text });
  } catch (error: any) {
    console.error("[LEAD-SCRAPER] Chat error:", error);
    res.status(500).json({ error: error.message });
  }
});

router.get("/all-results", authenticateToken, requireAnyRole(["consultant", "super_admin"]), async (req: AuthRequest, res: Response) => {
  try {
    const consultantId = req.user!.id;
    const { lead_status } = req.query;

    const searches = await db
      .select({ id: leadScraperSearches.id })
      .from(leadScraperSearches)
      .where(eq(leadScraperSearches.consultantId, consultantId));

    if (searches.length === 0) return res.json([]);

    const searchIds = searches.map(s => s.id);

    let conditions: any[] = [sql`${leadScraperResults.searchId} IN (${sql.join(searchIds.map(id => sql`${id}`), sql`, `)})`];

    if (lead_status && lead_status !== "tutti") {
      conditions.push(eq(leadScraperResults.leadStatus, lead_status as string));
    }

    const results = await db
      .select()
      .from(leadScraperResults)
      .where(and(...conditions))
      .orderBy(desc(leadScraperResults.createdAt));

    res.json(results);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
