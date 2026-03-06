import { Router, Response } from "express";
import { db } from "../db";
import { eq, and, desc, sql, ilike, gte, inArray } from "drizzle-orm";
import { leadScraperSearches, leadScraperResults, superadminLeadScraperConfig, leadScraperSalesContext, leadScraperActivities } from "../../shared/schema";
import { AuthRequest, authenticateToken, requireAnyRole } from "../middleware/auth";
import { searchGoogleMaps, searchGoogleWeb, scrapeWebsiteWithFirecrawl, enrichSearchResults, generateSalesSummary, generateBatchSalesSummaries, searchItalianLocations, normalizeLocation, verifyAndSelectContactsForResult, shouldAllowAutomatedOutreach } from "../services/lead-scraper-service";
import { decrypt } from "../encryption";
import { generateOutreachContent, scheduleIndividualOutreach, loadSelectedWaTemplates, titleCaseName } from "./ai-autonomy-router";

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

router.get("/autocomplete/query", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const q = (req.query.q as string || "").trim();
    if (!q || q.length < 2) return res.json([]);
    const resp = await fetch(`https://suggestqueries.google.com/complete/search?client=firefox&hl=it&gl=it&q=${encodeURIComponent(q)}`);
    if (!resp.ok) return res.json([]);
    const data = await resp.json();
    const suggestions = (data[1] || []).slice(0, 8) as string[];
    res.json(suggestions);
  } catch (e) {
    console.error("[AUTOCOMPLETE] query error:", e);
    res.json([]);
  }
});

router.get("/autocomplete/location", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const q = (req.query.q as string || "").trim();
    if (!q || q.length < 1) return res.json([]);
    const matches = searchItalianLocations(q, 8);
    const formatted = matches.map(m => {
      if (m.type === "region") return { label: m.name, subtitle: "Regione", value: m.name };
      return { label: m.name, subtitle: m.region || "", value: m.name };
    });
    res.json(formatted);
  } catch (e) {
    console.error("[AUTOCOMPLETE] location error:", e);
    res.json([]);
  }
});

router.get("/normalize-location", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const q = (req.query.q as string || "").trim();
    if (!q) return res.json({ normalized: "", displayName: "", type: "unknown", changed: false });
    const result = normalizeLocation(q);
    res.json({
      normalized: result.normalized,
      displayName: result.displayName,
      type: result.type,
      changed: result.normalized.toLowerCase() !== q.toLowerCase(),
    });
  } catch (e) {
    console.error("[NORMALIZE] location error:", e);
    res.json({ normalized: q, displayName: q, type: "unknown", changed: false });
  }
});

router.post("/search", authenticateToken, requireAnyRole(["consultant", "super_admin"]), async (req: AuthRequest, res: Response) => {
  try {
    let { query, location, limit = 20, autoScrapeWebsites = true, searchEngine = "google_maps", searchMode = "predefinito" } = req.body;
    if (searchMode === "cerca_outreach") autoScrapeWebsites = true;
    const consultantId = req.user?.id;

    if (location) {
      const locResult = normalizeLocation(location);
      if (locResult.type !== "unknown") {
        console.log(`[LEAD-SCRAPER] Location normalized: "${location}" → "${locResult.normalized}" (${locResult.type})`);
        location = locResult.normalized;
      }
    }

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
        metadata: { params: { limit, autoScrapeWebsites, searchEngine, searchMode } },
      })
      .returning();

    res.json({ searchId: search.id, status: "running", message: "Search started" });

    (async () => {
      try {
        const existingLeadsResult = await db.execute(sql`
          SELECT business_name, phone, website, email, google_place_id
          FROM lead_scraper_results
          WHERE search_id IN (SELECT id FROM lead_scraper_searches WHERE consultant_id = ${consultantId})
        `);
        const existingNames = new Set<string>();
        const existingPhones = new Set<string>();
        const existingDomains = new Set<string>();
        const existingPlaceIds = new Set<string>();
        for (const row of existingLeadsResult.rows as any[]) {
          if (row.business_name) existingNames.add(row.business_name.toLowerCase().trim());
          if (row.phone) existingPhones.add(row.phone.replace(/[\s\-()\.]/g, ''));
          if (row.website) {
            const domain = row.website.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0].toLowerCase();
            if (domain) existingDomains.add(domain);
          }
          if (row.email) {
            const emailDomain = row.email.split('@')[1]?.toLowerCase();
            if (emailDomain) existingDomains.add(emailDomain);
          }
          if (row.google_place_id) existingPlaceIds.add(row.google_place_id);
        }
        console.log(`[LEAD-SCRAPER] Dedup sets: ${existingNames.size} names, ${existingPhones.size} phones, ${existingDomains.size} domains, ${existingPlaceIds.size} place_ids`);

        const isDuplicate = (name: string | null, phone: string | null, website: string | null, placeId?: string | null): boolean => {
          if (placeId && existingPlaceIds.has(placeId)) return true;
          if (name && existingNames.has(name.toLowerCase().trim())) return true;
          if (phone) {
            const normalized = phone.replace(/[\s\-()\.]/g, '');
            if (existingPhones.has(normalized)) return true;
          }
          if (website) {
            const domain = website.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0].toLowerCase();
            if (domain && existingDomains.has(domain)) return true;
          }
          return false;
        };

        let newCount = 0;
        let duplicatesSkipped = 0;
        const MAX_EXTRA_PAGES = 10;

        const WEB_PAGE_SIZE = 10;
        const MAPS_PAGE_SIZE = 20;

        if (searchEngine === "google_search") {
          let offset = 0;
          let pagesUsed = 0;
          let noMoreResults = false;
          while (newCount < limit && pagesUsed <= MAX_EXTRA_PAGES && !noMoreResults) {
            const webResults = await searchGoogleWeb(query, location, WEB_PAGE_SIZE, serpApiKey, offset);
            if (webResults.length === 0) { noMoreResults = true; break; }

            for (const result of webResults) {
              if (newCount >= limit) break;
              if (isDuplicate(result.title || null, null, result.website || null)) {
                duplicatesSkipped++;
                continue;
              }
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
              newCount++;
              if (result.title) existingNames.add(result.title.toLowerCase().trim());
              if (result.website) {
                const domain = result.website.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0].toLowerCase();
                if (domain) existingDomains.add(domain);
              }
            }

            if (webResults.length < WEB_PAGE_SIZE) noMoreResults = true;
            offset += WEB_PAGE_SIZE;
            pagesUsed++;
            console.log(`[LEAD-SCRAPER] Page ${pagesUsed}: ${newCount} new, ${duplicatesSkipped} dups, offset=${offset}`);
          }
        } else {
          let offset = 0;
          let pagesUsed = 0;
          let noMoreResults = false;
          while (newCount < limit && pagesUsed <= MAX_EXTRA_PAGES && !noMoreResults) {
            const mapsResults = await searchGoogleMaps(query, location, MAPS_PAGE_SIZE, serpApiKey, offset);
            if (mapsResults.length === 0) { noMoreResults = true; break; }

            for (const result of mapsResults) {
              if (newCount >= limit) break;
              if (isDuplicate(result.title || null, result.phone || null, result.website || null, result.place_id || null)) {
                duplicatesSkipped++;
                continue;
              }
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
                googlePlaceId: result.place_id || null,
                businessTypes: result.types || null,
                priceRange: result.price || null,
                openState: result.open_state || null,
                mapsDescription: result.description || null,
                scrapeStatus: result.website ? "pending" : "no_website",
                source: "google_maps",
              });
              newCount++;
              if (result.title) existingNames.add(result.title.toLowerCase().trim());
              if (result.phone) existingPhones.add(result.phone.replace(/[\s\-()\.]/g, ''));
              if (result.place_id) existingPlaceIds.add(result.place_id);
              if (result.website) {
                const domain = result.website.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0].toLowerCase();
                if (domain) existingDomains.add(domain);
              }
            }

            if (mapsResults.length < MAPS_PAGE_SIZE) noMoreResults = true;
            offset += MAPS_PAGE_SIZE;
            pagesUsed++;
            console.log(`[LEAD-SCRAPER] Page ${pagesUsed}: ${newCount} new, ${duplicatesSkipped} dups, offset=${offset}`);
          }
        }

        console.log(`[LEAD-SCRAPER] Search complete: ${newCount} new leads inserted, ${duplicatesSkipped} duplicates skipped (mode: ${searchMode})`);

        if (searchMode === "solo_cerca") {
          await db
            .update(leadScraperSearches)
            .set({ status: "completed", resultsCount: newCount })
            .where(eq(leadScraperSearches.id, search.id));
        } else {
          await db
            .update(leadScraperSearches)
            .set({
              status: autoScrapeWebsites ? "enriching" : "completed",
              resultsCount: newCount,
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
              .set({ status: "analyzing" })
              .where(eq(leadScraperSearches.id, search.id));

            try {
              await generateBatchSalesSummaries(search.id, consultantId!);
              console.log(`[LEAD-SCRAPER] Auto AI analysis completed for search ${search.id}`);
            } catch (aiErr: any) {
              console.error(`[LEAD-SCRAPER] AI analysis error (non-blocking):`, aiErr?.message || aiErr);
            }

            if (searchMode === "cerca_outreach") {
              await db
                .update(leadScraperSearches)
                .set({ status: "scheduling" })
                .where(eq(leadScraperSearches.id, search.id));

              let outreachCount = 0;
              const channelBreakdown: Record<string, number> = {};
              const outreachErrors: string[] = [];
              try {
                const settingsResult = await db.execute(sql`
                  SELECT outreach_config FROM ai_autonomy_settings WHERE consultant_id = ${consultantId} LIMIT 1
                `);
                const settings = (settingsResult.rows[0] as any);
                const outreachConfig = settings?.outreach_config || {};

                const voiceTemplateId = outreachConfig.voice_template_id || null;
                const whatsappConfigId = outreachConfig.whatsapp_config_id || null;
                const emailAccountId = outreachConfig.email_account_id || null;
                const poolId = outreachConfig.pool_id ?? null;
                const callInstructionTemplate = outreachConfig.call_instruction_template || null;

                const [salesCtxResult, consultantResult, waConfigResult2] = await Promise.all([
                  db.execute(sql`
                    SELECT services_offered, target_audience, value_proposition, sales_approach,
                           competitive_advantages, ideal_client_profile, additional_context
                    FROM lead_scraper_sales_context WHERE consultant_id = ${consultantId} LIMIT 1
                  `),
                  db.execute(sql`SELECT first_name, last_name FROM users WHERE id = ${consultantId} LIMIT 1`),
                  db.execute(sql`SELECT business_name, consultant_display_name FROM consultant_whatsapp_config WHERE consultant_id = ${consultantId} AND is_active = true LIMIT 1`),
                ]);
                const salesCtx = (salesCtxResult.rows[0] as any) || {};
                const cRow = consultantResult.rows[0] as any;
                const waConfigRow2 = waConfigResult2.rows[0] as any;
                const consultantName = waConfigRow2?.consultant_display_name || (cRow ? titleCaseName([cRow.first_name, cRow.last_name].filter(Boolean).join(' ')) || 'Consulente' : 'Consulente');
                const consultantBusinessName = waConfigRow2?.business_name || null;

                let resolvedVoiceTemplateName: string | null = null;
                if (voiceTemplateId) {
                  try {
                    const { getTemplateById } = await import("../voice/voice-templates");
                    const tmpl = getTemplateById(voiceTemplateId);
                    if (tmpl) resolvedVoiceTemplateName = tmpl.name;
                  } catch {}
                }

                const waTemplateSids: string[] = outreachConfig.whatsapp_template_ids || [];
                const loadedWaTemplates = await loadSelectedWaTemplates(consultantId, waTemplateSids);

                const scheduleConfig = {
                  voiceTemplateId, whatsappConfigId, emailAccountId, poolId,
                  timezone: 'Europe/Rome',
                  voiceTemplateName: resolvedVoiceTemplateName,
                  callInstructionTemplate, outreachConfig,
                };

                const searchResults = await db.select().from(leadScraperResults).where(eq(leadScraperResults.searchId, search.id));
                const leadsWithContact = searchResults.filter(r => r.email || r.phone);

                let slotIndex = 0;
                for (const lead of leadsWithContact) {
                  try {
                    const leadObj = {
                      id: lead.id, leadId: lead.id,
                      businessName: lead.businessName, phone: lead.phone,
                      email: lead.email, website: lead.website,
                      address: lead.address, category: lead.category,
                      score: lead.aiCompatibilityScore,
                      salesSummary: lead.aiSalesSummary,
                      rating: lead.rating, reviewsCount: lead.reviewsCount,
                      consultantNotes: lead.leadNotes || '',
                    };

                    const channels: string[] = [];
                    if (lead.phone) channels.push("voice", "whatsapp");
                    if (lead.email) channels.push("email");
                    if (channels.length === 0) continue;

                    let firstTaskId: string | null = null;
                    for (const channel of channels) {
                      try {
                        const content = await generateOutreachContent(consultantId, leadObj, channel, salesCtx, consultantName, undefined, outreachConfig, loadedWaTemplates, consultantBusinessName);
                        const result = await scheduleIndividualOutreach(consultantId, leadObj, channel, content, scheduleConfig, 'approval', slotIndex);
                        if (!firstTaskId) firstTaskId = result.taskId;
                        channelBreakdown[channel] = (channelBreakdown[channel] || 0) + 1;
                        outreachCount++;
                        slotIndex++;
                        console.log(`[LEAD-SCRAPER] ✓ Outreach ${lead.businessName} → ${channel} (${result.status})`);
                      } catch (chErr: any) {
                        if (chErr?.message?.startsWith('SKIP_CHANNEL:')) {
                          console.log(`[LEAD-SCRAPER] Skipped ${channel} for ${lead.businessName}: ${chErr.message}`);
                        } else {
                          console.error(`[LEAD-SCRAPER] ✗ Outreach ${lead.businessName} → ${channel}: ${chErr?.message}`);
                          outreachErrors.push(`${lead.businessName}→${channel}: ${chErr?.message?.substring(0, 80)}`);
                        }
                      }
                    }

                    if (firstTaskId) {
                      await db.update(leadScraperResults)
                        .set({ outreachTaskId: firstTaskId, leadStatus: "in_outreach" })
                        .where(eq(leadScraperResults.id, lead.id));
                    }
                  } catch (taskErr: any) {
                    console.error(`[LEAD-SCRAPER] Outreach task creation error for lead ${lead.id}:`, taskErr?.message || taskErr);
                    outreachErrors.push(`${lead.businessName || lead.id}: ${taskErr?.message?.substring(0, 80)}`);
                  }
                }
                console.log(`[LEAD-SCRAPER] Outreach scheduling complete: ${outreachCount} tasks created (${JSON.stringify(channelBreakdown)})`);
              } catch (outreachErr: any) {
                console.error(`[LEAD-SCRAPER] Outreach scheduling error:`, outreachErr?.message || outreachErr);
              }

              await db
                .update(leadScraperSearches)
                .set({
                  status: "completed",
                  metadata: sql`jsonb_set(COALESCE(metadata, '{}'::jsonb), '{outreachResults}', ${JSON.stringify({
                    tasksCreated: outreachCount,
                    channelBreakdown,
                    errors: outreachErrors.length > 0 ? outreachErrors : undefined,
                  })}::jsonb)`,
                })
                .where(eq(leadScraperSearches.id, search.id));
            } else {
              await db
                .update(leadScraperSearches)
                .set({ status: "completed" })
                .where(eq(leadScraperSearches.id, search.id));
            }
          }
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

router.post("/rescrape", authenticateToken, requireAnyRole(["consultant", "super_admin"]), async (req: AuthRequest, res: Response) => {
  try {
    const { searchId } = req.body;
    const consultantId = req.user?.id;

    const keys = await getLeadScraperKeys();
    const firecrawlKey = keys.firecrawlKey;
    if (!firecrawlKey) {
      return res.status(400).json({ error: "FIRECRAWL_API_KEY non configurata." });
    }

    let searchIds: string[] = [];
    if (searchId) {
      const [search] = await db.select().from(leadScraperSearches)
        .where(and(eq(leadScraperSearches.id, searchId), eq(leadScraperSearches.consultantId, consultantId!)));
      if (!search) return res.status(404).json({ error: "Ricerca non trovata" });
      searchIds = [searchId];
    } else {
      const searches = await db.select({ id: leadScraperSearches.id }).from(leadScraperSearches)
        .where(eq(leadScraperSearches.consultantId, consultantId!));
      searchIds = searches.map(s => s.id);
    }

    if (searchIds.length === 0) {
      return res.json({ message: "Nessuna ricerca trovata" });
    }

    res.json({ message: `Ri-analisi avviata per ${searchIds.length} ricerche`, searchIds });

    (async () => {
      try {
        for (const sid of searchIds) {
          console.log(`[LEAD-SCRAPER] Rescrape: resetting leads for search ${sid}`);

          await db.execute(sql`
            UPDATE lead_scraper_results
            SET scrape_status = 'pending', website_data = NULL, sales_summary = NULL
            WHERE search_id = ${sid} AND website IS NOT NULL AND website != ''
          `);

          await db.update(leadScraperSearches)
            .set({ status: "enriching" })
            .where(eq(leadScraperSearches.id, sid));

          await enrichSearchResults(sid, firecrawlKey);

          await db.update(leadScraperSearches)
            .set({ status: "analyzing" })
            .where(eq(leadScraperSearches.id, sid));

          try {
            await generateBatchSalesSummaries(sid, consultantId!);
            console.log(`[LEAD-SCRAPER] Rescrape: AI analysis completed for search ${sid}`);
          } catch (aiErr: any) {
            console.error(`[LEAD-SCRAPER] Rescrape: AI analysis error (non-blocking):`, aiErr?.message || aiErr);
          }

          await db.update(leadScraperSearches)
            .set({ status: "completed" })
            .where(eq(leadScraperSearches.id, sid));
        }
        console.log(`[LEAD-SCRAPER] Rescrape: all ${searchIds.length} searches completed`);
      } catch (error: any) {
        console.error("[LEAD-SCRAPER] Rescrape error:", error);
        for (const sid of searchIds) {
          await db.update(leadScraperSearches)
            .set({ status: "completed" })
            .where(eq(leadScraperSearches.id, sid)).catch(() => {});
        }
      }
    })();
  } catch (error: any) {
    console.error("Error starting rescrape:", error);
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

    const forceRescrape = req.query.force === "true" || req.body?.force === true;

    const [result] = await db
      .select()
      .from(leadScraperResults)
      .where(eq(leadScraperResults.id, req.params.id));

    if (!result) return res.status(404).json({ error: "Result not found" });
    if (!result.website) return res.status(400).json({ error: "No website to scrape" });

    if (forceRescrape) {
      await db.update(leadScraperResults)
        .set({ websiteData: null, scrapeStatus: "pending", salesSummary: null })
        .where(eq(leadScraperResults.id, req.params.id));
      console.log(`[LEAD-SCRAPER] Force rescrape: reset websiteData for ${req.params.id}`);
    }

    let websiteUrl = result.website;
    if (!websiteUrl.startsWith("http")) websiteUrl = `https://${websiteUrl}`;

    const websiteData = await scrapeWebsiteWithFirecrawl(websiteUrl, firecrawlKey);

    const [scraped] = await db
      .update(leadScraperResults)
      .set({
        websiteData: websiteData as any,
        email: websiteData.emails.length > 0 ? websiteData.emails[0] : result.email,
        phone: (!result.phone && websiteData.phones.length > 0) ? websiteData.phones[0] : result.phone,
        scrapeStatus: "scraped",
      })
      .where(eq(leadScraperResults.id, req.params.id))
      .returning();

    try {
      const verified = await verifyAndSelectContactsForResult(req.params.id);
      res.json(verified);
    } catch (verifyErr) {
      console.warn(`[LEAD-SCRAPER] Post-scrape verification failed, returning scraped result:`, verifyErr);
      res.json(scraped);
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/results/:id/verify-email", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const updated = await verifyAndSelectContactsForResult(req.params.id);
    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.patch("/results/:id/set-primary", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { primaryEmail, primaryPhone } = req.body;

    const [result] = await db
      .select()
      .from(leadScraperResults)
      .where(eq(leadScraperResults.id, req.params.id));

    if (!result) return res.status(404).json({ error: "Result not found" });

    const updateData: any = {};
    if (primaryEmail !== undefined) {
      updateData.primaryEmail = primaryEmail;
      updateData.email = primaryEmail;
    }
    if (primaryPhone !== undefined) {
      updateData.primaryPhone = primaryPhone;
      updateData.phone = primaryPhone;
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
    const { lead_status, search, source } = req.query;

    let conditions: any[] = [
      sql`EXISTS (SELECT 1 FROM ${leadScraperSearches} WHERE ${leadScraperSearches.id} = ${leadScraperResults.searchId} AND ${leadScraperSearches.consultantId} = ${consultantId})`
    ];

    if (lead_status && lead_status !== "tutti") {
      conditions.push(eq(leadScraperResults.leadStatus, lead_status as string));
    }

    if (search && typeof search === "string" && search.trim()) {
      const term = `%${search.trim()}%`;
      conditions.push(sql`(
        ${leadScraperResults.businessName} ILIKE ${term} OR
        ${leadScraperResults.email} ILIKE ${term} OR
        ${leadScraperResults.phone} ILIKE ${term} OR
        ${leadScraperResults.leadNotes} ILIKE ${term} OR
        ${leadScraperResults.category} ILIKE ${term}
      )`);
    }

    if (source && typeof source === "string" && source !== "tutti") {
      conditions.push(eq(leadScraperResults.source, source));
    }

    const results = await db
      .select()
      .from(leadScraperResults)
      .where(and(...conditions))
      .orderBy(desc(leadScraperResults.createdAt));

    const outreachIds = results.filter(r => r.outreachTaskId).map(r => r.outreachTaskId!);
    let taskStatusMap: Record<string, { status: string; channel: string }> = {};
    if (outreachIds.length > 0) {
      try {
        const taskRows = await db.execute(sql`SELECT id, status, preferred_channel FROM ai_scheduled_tasks WHERE id = ANY(${outreachIds})`);
        for (const row of taskRows.rows as any[]) {
          taskStatusMap[row.id] = { status: row.status, channel: row.preferred_channel };
        }
      } catch {}
    }

    const resultsWithOutreach = results.map(r => ({
      ...r,
      outreachTaskStatus: r.outreachTaskId ? (taskStatusMap[r.outreachTaskId]?.status || null) : null,
      outreachTaskChannel: r.outreachTaskId ? (taskStatusMap[r.outreachTaskId]?.channel || null) : null,
    }));

    res.json(resultsWithOutreach);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.delete("/results/bulk", authenticateToken, requireAnyRole(["consultant", "super_admin"]), async (req: AuthRequest, res: Response) => {
  try {
    const consultantId = req.user!.id;
    const { ids } = req.body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, error: "ids array required" });
    }

    const owned = await db
      .select({ id: leadScraperResults.id, outreachTaskId: leadScraperResults.outreachTaskId })
      .from(leadScraperResults)
      .innerJoin(leadScraperSearches, eq(leadScraperResults.searchId, leadScraperSearches.id))
      .where(and(
        inArray(leadScraperResults.id, ids),
        eq(leadScraperSearches.consultantId, consultantId)
      ));

    const ownedIds = owned.map(r => r.id);

    if (ownedIds.length === 0) {
      return res.json({ success: true, deletedCount: 0 });
    }

    const outreachTaskIds = owned
      .map(r => r.outreachTaskId)
      .filter((id): id is string => !!id);

    if (outreachTaskIds.length > 0) {
      try {
        await db.execute(sql`
          DELETE FROM scheduled_voice_calls
          WHERE source_task_id = ANY(${outreachTaskIds}::varchar[]) AND status != 'completed'
        `);
        await db.execute(sql`
          DELETE FROM ai_scheduled_tasks
          WHERE id = ANY(${outreachTaskIds}::varchar[]) AND status != 'completed'
        `);
        console.log(`[LEAD-SCRAPER] Bulk delete: removed outreach tasks + voice calls for ${outreachTaskIds.length} task IDs`);
      } catch (e: any) {
        console.error(`[LEAD-SCRAPER] Error deleting outreach tasks by id:`, e?.message);
      }
    }

    try {
      for (const leadId of ownedIds) {
        const excludeCondition = outreachTaskIds.length > 0
          ? sql`AND id != ALL(ARRAY[${sql.join(outreachTaskIds.map(id => sql`${id}`), sql`, `)}]::varchar[])`
          : sql``;
        const relatedTasks = await db.execute(sql`
          SELECT id FROM ai_scheduled_tasks
          WHERE additional_context LIKE ${'%' + leadId + '%'}
            AND status != 'completed'
            ${excludeCondition}
        `);
        const relatedIds = (relatedTasks.rows as any[]).map((r: any) => r.id);
        if (relatedIds.length > 0) {
          await db.execute(sql`DELETE FROM scheduled_voice_calls WHERE source_task_id = ANY(ARRAY[${sql.join(relatedIds.map((id: string) => sql`${id}`), sql`, `)}]::varchar[]) AND status != 'completed'`);
          await db.execute(sql`DELETE FROM ai_scheduled_tasks WHERE id = ANY(ARRAY[${sql.join(relatedIds.map((id: string) => sql`${id}`), sql`, `)}]::varchar[])`);
        }
      }
    } catch (e: any) {
      console.error(`[LEAD-SCRAPER] Error deleting outreach tasks by additional_context:`, e?.message);
    }

    await db.delete(leadScraperResults).where(inArray(leadScraperResults.id, ownedIds));

    res.json({ success: true, deletedCount: ownedIds.length });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete("/results/:id", authenticateToken, requireAnyRole(["consultant", "super_admin"]), async (req: AuthRequest, res: Response) => {
  try {
    const consultantId = req.user!.id;
    const leadId = req.params.id;

    const [owned] = await db
      .select({ id: leadScraperResults.id, outreachTaskId: leadScraperResults.outreachTaskId })
      .from(leadScraperResults)
      .innerJoin(leadScraperSearches, eq(leadScraperResults.searchId, leadScraperSearches.id))
      .where(and(
        eq(leadScraperResults.id, leadId),
        eq(leadScraperSearches.consultantId, consultantId)
      ));

    if (!owned) {
      return res.status(404).json({ success: false, error: "Lead not found" });
    }

    if (owned.outreachTaskId) {
      try {
        await db.execute(sql`
          DELETE FROM scheduled_voice_calls WHERE source_task_id = ${owned.outreachTaskId} AND status != 'completed'
        `);
        await db.execute(sql`
          DELETE FROM ai_scheduled_tasks WHERE id = ${owned.outreachTaskId} AND status != 'completed'
        `);
        console.log(`[LEAD-SCRAPER] Deleted outreach task ${owned.outreachTaskId} for lead ${leadId}`);
      } catch (e: any) {
        console.error(`[LEAD-SCRAPER] Error deleting outreach task by id:`, e?.message);
      }
    }

    try {
      const relatedTasks = await db.execute(sql`
        SELECT id FROM ai_scheduled_tasks
        WHERE additional_context LIKE ${'%' + leadId + '%'}
          AND status != 'completed'
          ${owned.outreachTaskId ? sql`AND id != ${owned.outreachTaskId}` : sql``}
      `);
      const relatedIds = (relatedTasks.rows as any[]).map(r => r.id);
      if (relatedIds.length > 0) {
        await db.execute(sql`DELETE FROM scheduled_voice_calls WHERE source_task_id = ANY(${relatedIds}::varchar[]) AND status != 'completed'`);
        await db.execute(sql`DELETE FROM ai_scheduled_tasks WHERE id = ANY(${relatedIds}::varchar[])`);
      }
    } catch (e: any) {
      console.error(`[LEAD-SCRAPER] Error deleting outreach tasks by additional_context:`, e?.message);
    }

    await db.delete(leadScraperResults).where(eq(leadScraperResults.id, leadId));

    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/results/:id", authenticateToken, requireAnyRole(["consultant", "super_admin"]), async (req: AuthRequest, res: Response) => {
  try {
    const consultantId = req.user!.id;
    const [result] = await db
      .select()
      .from(leadScraperResults)
      .where(eq(leadScraperResults.id, req.params.id));

    if (!result) return res.status(404).json({ error: "Result not found" });

    const [search] = await db
      .select()
      .from(leadScraperSearches)
      .where(and(
        eq(leadScraperSearches.id, result.searchId),
        eq(leadScraperSearches.consultantId, consultantId)
      ));

    if (!search) return res.status(403).json({ error: "Not authorized" });

    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/suggest-keywords", authenticateToken, requireAnyRole(["consultant", "super_admin"]), async (req: AuthRequest, res: Response) => {
  try {
    const consultantId = req.user!.id;

    const [context] = await db
      .select()
      .from(leadScraperSalesContext)
      .where(eq(leadScraperSalesContext.consultantId, consultantId));

    if (!context || !context.servicesOffered) {
      return res.status(400).json({ error: "Configura prima il tuo profilo vendita nella tab Sales Agent" });
    }

    const { quickGenerate } = await import("../ai/provider-factory");

    const profileParts = [
      context.servicesOffered ? `SERVIZI: ${context.servicesOffered}` : "",
      context.targetAudience ? `TARGET: ${context.targetAudience}` : "",
      context.idealClientProfile ? `CLIENTE IDEALE: ${context.idealClientProfile}` : "",
      context.valueProposition ? `PROPOSTA DI VALORE: ${context.valueProposition}` : "",
    ].filter(Boolean).join("\n");

    const result = await quickGenerate({
      consultantId,
      feature: "lead-scraper-keyword-suggestions",
      systemInstruction: "Sei un esperto di lead generation e ricerca B2B. Rispondi SOLO con un JSON array valido, senza markdown, senza backtick, senza testo aggiuntivo.",
      contents: [{
        role: "user",
        parts: [{ text: `Analizza il profilo vendita di questo consulente e suggerisci 8-12 query di ricerca efficaci per trovare potenziali clienti.

PROFILO CONSULENTE:
${profileParts}

Per ogni keyword indica se è più adatta a Google Maps (attività locali, ristoranti, negozi, studi professionali) o Google Search (aziende digitali, agenzie, software house, e-commerce).

Rispondi SOLO con JSON array: [{"keyword": "string", "engine": "maps" o "search", "reason": "breve motivo in italiano"}]` }]
      }],
      thinkingLevel: "low",
    });

    let suggestions = [];
    try {
      const cleanText = (result.text || "").replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
      suggestions = JSON.parse(cleanText);
    } catch {
      console.error("[LEAD-SCRAPER] Failed to parse keyword suggestions:", result.text);
      return res.status(500).json({ error: "Errore nel parsing dei suggerimenti AI" });
    }

    res.json({ suggestions });
  } catch (error: any) {
    console.error("[LEAD-SCRAPER] Suggest keywords error:", error);
    res.status(500).json({ error: error.message });
  }
});

router.get("/leads/:leadId/activities", authenticateToken, requireAnyRole(["consultant", "super_admin"]), async (req: AuthRequest, res: Response) => {
  try {
    const consultantId = req.user!.id;
    const { leadId } = req.params;
    const { type } = req.query;

    let conditions: any[] = [
      eq(leadScraperActivities.leadId, leadId),
      eq(leadScraperActivities.consultantId, consultantId),
    ];

    if (type && typeof type === "string" && type !== "all") {
      conditions.push(eq(leadScraperActivities.type, type));
    }

    const activities = await db
      .select()
      .from(leadScraperActivities)
      .where(and(...conditions))
      .orderBy(desc(leadScraperActivities.createdAt));

    res.json(activities);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/leads/:leadId/activities", authenticateToken, requireAnyRole(["consultant", "super_admin"]), async (req: AuthRequest, res: Response) => {
  try {
    const consultantId = req.user!.id;
    const { leadId } = req.params;
    const { type, title, description, outcome, scheduledAt, completedAt, metadata } = req.body;

    if (!type) return res.status(400).json({ error: "type is required" });

    const [activity] = await db
      .insert(leadScraperActivities)
      .values({
        leadId,
        consultantId,
        type,
        title: title || null,
        description: description || null,
        outcome: outcome || null,
        scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
        completedAt: completedAt ? new Date(completedAt) : null,
        metadata: metadata || {},
      })
      .returning();

    res.status(201).json(activity);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.patch("/activities/:activityId", authenticateToken, requireAnyRole(["consultant", "super_admin"]), async (req: AuthRequest, res: Response) => {
  try {
    const consultantId = req.user!.id;
    const { activityId } = req.params;

    const [existing] = await db
      .select()
      .from(leadScraperActivities)
      .where(and(eq(leadScraperActivities.id, activityId), eq(leadScraperActivities.consultantId, consultantId)));

    if (!existing) return res.status(404).json({ error: "Activity not found" });

    const updateData: any = { updatedAt: new Date() };
    const { title, description, outcome, scheduledAt, completedAt, metadata, type } = req.body;
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (outcome !== undefined) updateData.outcome = outcome;
    if (type !== undefined) updateData.type = type;
    if (scheduledAt !== undefined) updateData.scheduledAt = scheduledAt ? new Date(scheduledAt) : null;
    if (completedAt !== undefined) updateData.completedAt = completedAt ? new Date(completedAt) : null;
    if (metadata !== undefined) updateData.metadata = metadata;

    const [updated] = await db
      .update(leadScraperActivities)
      .set(updateData)
      .where(eq(leadScraperActivities.id, activityId))
      .returning();

    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.delete("/activities/:activityId", authenticateToken, requireAnyRole(["consultant", "super_admin"]), async (req: AuthRequest, res: Response) => {
  try {
    const consultantId = req.user!.id;
    const { activityId } = req.params;

    const [existing] = await db
      .select()
      .from(leadScraperActivities)
      .where(and(eq(leadScraperActivities.id, activityId), eq(leadScraperActivities.consultantId, consultantId)));

    if (!existing) return res.status(404).json({ error: "Activity not found" });

    await db.delete(leadScraperActivities).where(eq(leadScraperActivities.id, activityId));
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/manual-lead", authenticateToken, requireAnyRole(["consultant", "super_admin"]), async (req: AuthRequest, res: Response) => {
  try {
    const consultantId = req.user?.id;
    if (!consultantId) return res.status(401).json({ error: "Unauthorized" });

    const {
      businessName, phone, email, website, address, category,
      leadStatus, leadNotes, leadValue, leadNextAction, leadNextActionDate,
      rating, source
    } = req.body;

    if (!businessName || businessName.trim().length === 0) {
      return res.status(400).json({ error: "Il nome azienda è obbligatorio" });
    }

    const parsedRating = rating ? parseFloat(rating) : null;
    if (parsedRating !== null && (isNaN(parsedRating) || parsedRating < 0 || parsedRating > 5)) {
      return res.status(400).json({ error: "Rating deve essere tra 0 e 5" });
    }
    const parsedValue = leadValue ? parseFloat(leadValue) : null;
    if (parsedValue !== null && (isNaN(parsedValue) || parsedValue < 0)) {
      return res.status(400).json({ error: "Valore deve essere un numero positivo" });
    }

    let manualSearchResult = await db.execute(sql`
      SELECT id FROM lead_scraper_searches
      WHERE consultant_id = ${consultantId} AND query = '__manual_leads__'
      LIMIT 1
    `);

    let searchId: string;
    if (manualSearchResult.rows.length > 0) {
      searchId = (manualSearchResult.rows[0] as any).id;
    } else {
      const [newSearch] = await db
        .insert(leadScraperSearches)
        .values({
          consultantId: consultantId,
          query: "__manual_leads__",
          location: "",
          status: "completed",
          metadata: { type: "manual_collection" },
        })
        .returning();
      searchId = newSearch.id;
    }

    const [lead] = await db
      .insert(leadScraperResults)
      .values({
        searchId,
        businessName: businessName.trim(),
        phone: phone?.trim() || null,
        email: email?.trim() || null,
        website: website?.trim() || null,
        address: address?.trim() || null,
        category: category?.trim() || null,
        rating: parsedRating,
        source: source || "manual",
        scrapeStatus: "no_website",
        leadStatus: leadStatus || "nuovo",
        leadNotes: leadNotes?.trim() || null,
        leadValue: parsedValue,
        leadNextAction: leadNextAction?.trim() || null,
        leadNextActionDate: leadNextActionDate ? new Date(leadNextActionDate) : null,
      })
      .returning();

    await db.execute(sql`
      UPDATE lead_scraper_searches
      SET results_count = COALESCE(results_count, 0) + 1
      WHERE id = ${searchId}
    `);

    res.json({ success: true, lead });
  } catch (error: any) {
    console.error("[LEAD-SCRAPER] Error creating manual lead:", error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
