import { db } from "../db";
import { eq, sql } from "drizzle-orm";
import { leadScraperSearches, leadScraperResults } from "../../shared/schema";

interface SerpApiResult {
  title?: string;
  address?: string;
  phone?: string;
  website?: string;
  rating?: number;
  reviews?: number;
  type?: string;
  gps_coordinates?: { latitude: number; longitude: number };
  operating_hours?: any;
  thumbnail?: string;
}

export async function searchGoogleMaps(
  query: string,
  location: string,
  limit: number = 20,
  serpApiKey: string
): Promise<SerpApiResult[]> {
  const allResults: SerpApiResult[] = [];
  let start = 0;

  while (allResults.length < limit) {
    const params = new URLSearchParams({
      engine: "google_maps",
      q: `${query} ${location}`,
      type: "search",
      api_key: serpApiKey,
      start: start.toString(),
    });

    if (location) {
      params.set("q", `${query} in ${location}`);
    }

    const response = await fetch(`https://serpapi.com/search.json?${params.toString()}`);
    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`SerpAPI error: ${response.status} - ${errText}`);
    }

    const data = await response.json();
    const localResults = data.local_results || [];

    if (localResults.length === 0) break;

    allResults.push(...localResults);
    start += 20;

    if (localResults.length < 20) break;
  }

  return allResults.slice(0, limit);
}

export async function scrapeWebsiteWithFirecrawl(
  url: string,
  firecrawlApiKey: string
): Promise<{
  emails: string[];
  phones: string[];
  socialLinks: Record<string, string>;
  description: string;
  services: string[];
}> {
  const defaultResult = { emails: [], phones: [], socialLinks: {}, description: "", services: [] };

  try {
    const response = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${firecrawlApiKey}`,
      },
      body: JSON.stringify({
        url,
        formats: ["markdown"],
        onlyMainContent: true,
        timeout: 15000,
      }),
    });

    if (!response.ok) {
      console.error(`Firecrawl error for ${url}: ${response.status}`);
      return defaultResult;
    }

    const data = await response.json();
    const markdown = data.data?.markdown || "";

    const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
    const emails = [...new Set(markdown.match(emailRegex) || [])].filter(
      (e: string) => !e.includes("example.com") && !e.includes("sentry") && !e.endsWith(".png") && !e.endsWith(".jpg")
    );

    const phoneRegex = /(?:\+?\d{1,3}[-.\s]?)?\(?\d{2,4}\)?[-.\s]?\d{3,4}[-.\s]?\d{3,4}/g;
    const rawPhones = markdown.match(phoneRegex) || [];
    const phones = [...new Set(rawPhones.filter((p: string) => p.replace(/\D/g, "").length >= 8))];

    const socialLinks: Record<string, string> = {};
    const socialPatterns = [
      { name: "facebook", regex: /https?:\/\/(?:www\.)?facebook\.com\/[^\s\)\"'<>]+/gi },
      { name: "instagram", regex: /https?:\/\/(?:www\.)?instagram\.com\/[^\s\)\"'<>]+/gi },
      { name: "linkedin", regex: /https?:\/\/(?:www\.)?linkedin\.com\/[^\s\)\"'<>]+/gi },
      { name: "twitter", regex: /https?:\/\/(?:www\.)?(?:twitter|x)\.com\/[^\s\)\"'<>]+/gi },
      { name: "youtube", regex: /https?:\/\/(?:www\.)?youtube\.com\/[^\s\)\"'<>]+/gi },
    ];
    for (const { name, regex } of socialPatterns) {
      const match = markdown.match(regex);
      if (match) socialLinks[name] = match[0];
    }

    const description = markdown.substring(0, 500).replace(/[#*\[\]]/g, "").trim();

    const serviceKeywords = /(?:servizi|services|what we do|cosa facciamo|our services|i nostri servizi)[:\s]*\n?([\s\S]{0,1000}?)(?:\n\n|\n#{1,3}|$)/i;
    const serviceMatch = markdown.match(serviceKeywords);
    let services: string[] = [];
    if (serviceMatch) {
      services = serviceMatch[1]
        .split(/\n[-•*]\s*/)
        .map((s: string) => s.trim())
        .filter((s: string) => s.length > 3 && s.length < 200)
        .slice(0, 10);
    }

    return { emails, phones, socialLinks, description, services };
  } catch (error) {
    console.error(`Firecrawl scrape error for ${url}:`, error);
    return defaultResult;
  }
}

export async function enrichSearchResults(
  searchId: string,
  firecrawlApiKey: string
): Promise<{ enriched: number; failed: number }> {
  const results = await db
    .select()
    .from(leadScraperResults)
    .where(
      eq(leadScraperResults.searchId, searchId)
    );

  let enriched = 0;
  let failed = 0;

  for (const result of results) {
    if (!result.website || result.scrapeStatus === "scraped") continue;

    try {
      let websiteUrl = result.website;
      if (!websiteUrl.startsWith("http")) {
        websiteUrl = `https://${websiteUrl}`;
      }

      const websiteData = await scrapeWebsiteWithFirecrawl(websiteUrl, firecrawlApiKey);

      const primaryEmail = websiteData.emails.length > 0 ? websiteData.emails[0] : result.email;

      await db
        .update(leadScraperResults)
        .set({
          websiteData: websiteData as any,
          email: primaryEmail,
          scrapeStatus: "scraped",
        })
        .where(eq(leadScraperResults.id, result.id));

      enriched++;
    } catch (error) {
      console.error(`Failed to enrich result ${result.id}:`, error);
      await db
        .update(leadScraperResults)
        .set({ scrapeStatus: "failed" })
        .where(eq(leadScraperResults.id, result.id));
      failed++;
    }
  }

  return { enriched, failed };
}
