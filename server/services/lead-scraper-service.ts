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

interface GoogleWebResult {
  title?: string;
  website?: string;
  snippet?: string;
  displayedLink?: string;
}

export async function searchGoogleWeb(
  query: string,
  location: string,
  limit: number = 20,
  serpApiKey: string
): Promise<GoogleWebResult[]> {
  const allResults: GoogleWebResult[] = [];
  let start = 0;

  while (allResults.length < limit) {
    const searchQuery = location ? `${query} ${location}` : query;
    const params = new URLSearchParams({
      engine: "google",
      q: searchQuery,
      api_key: serpApiKey,
      start: start.toString(),
      num: "10",
      gl: "it",
      hl: "it",
    });

    if (location) {
      params.set("location", location);
    }

    const response = await fetch(`https://serpapi.com/search.json?${params.toString()}`);
    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`SerpAPI error: ${response.status} - ${errText}`);
    }

    const data = await response.json();
    const organicResults = data.organic_results || [];

    if (organicResults.length === 0) break;

    for (const r of organicResults) {
      allResults.push({
        title: r.title || null,
        website: r.link || null,
        snippet: r.snippet || null,
        displayedLink: r.displayed_link || null,
      });
    }

    start += 10;

    if (organicResults.length < 10) break;
  }

  const seen = new Set<string>();
  const deduped = allResults.filter((r) => {
    if (!r.website) return false;
    const domain = r.website.replace(/^https?:\/\//, "").split("/")[0].toLowerCase();
    if (seen.has(domain)) return false;
    seen.add(domain);
    return true;
  });

  console.log(`[LEAD-SCRAPER] Google Web search: "${query}" in "${location}" — ${deduped.length} unique results (from ${allResults.length} total)`);

  return deduped.slice(0, limit);
}

function cleanMarkdown(raw: string): string {
  let text = raw;
  text = text.replace(/!\[([^\]]*)\]\([^)]+\)/g, "");
  text = text.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
  text = text.replace(/<[^>]+>/g, "");
  text = text.replace(/#{1,6}\s*/g, "");
  text = text.replace(/[*_~`]{1,3}/g, "");
  text = text.replace(/^[-*+]\s+/gm, "• ");
  text = text.replace(/^\|.*\|$/gm, "");
  text = text.replace(/^[-|:\s]+$/gm, "");
  text = text.replace(/\n{3,}/g, "\n\n");
  return text.trim();
}

function extractEmails(text: string): string[] {
  const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;
  const blacklistedDomains = [
    "example.com", "test.com", "yoursite.com", "domain.com",
    "email.com", "sentry.io", "sentry.com", "wixpress.com",
    "placeholder.com", "localhost", "noreply",
  ];
  const imageExtensions = [".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp", ".ico", ".bmp"];

  const raw = text.match(emailRegex) || [];
  const filtered = raw.filter((e: string) => {
    const lower = e.toLowerCase();
    if (blacklistedDomains.some(d => lower.includes(d))) return false;
    if (imageExtensions.some(ext => lower.endsWith(ext))) return false;
    const localPart = lower.split("@")[0];
    if (localPart.length < 3) return false;
    if (/^\d+$/.test(localPart)) return false;
    return true;
  });

  return [...new Set(filtered)];
}

function extractPhones(text: string): string[] {
  const phonePatterns = [
    /\+39\s*\d{2,4}[\s./-]?\d{3,4}[\s./-]?\d{3,4}/g,
    /\+39\s*3\d{2}[\s./-]?\d{3,4}[\s./-]?\d{3,4}/g,
    /(?<!\d[.,])0\d{1,3}[\s./-]\d{3,4}[\s./-]?\d{3,4}(?![.,]\d)/g,
    /(?<!\d[.,])3\d{2}[\s./-]\d{3,4}[\s./-]?\d{3,4}(?![.,]\d)/g,
    /800[\s./-]?\d{3}[\s./-]?\d{3}/g,
    /\+\d{1,3}\s*\(?\d{2,4}\)?[\s./-]\d{3,4}[\s./-]?\d{3,4}/g,
  ];

  const allMatches: string[] = [];
  for (const pattern of phonePatterns) {
    const matches = text.match(pattern) || [];
    allMatches.push(...matches);
  }

  const cleaned = allMatches
    .map((p: string) => p.trim())
    .filter((p: string) => {
      const digits = p.replace(/\D/g, "");
      if (digits.length < 8 || digits.length > 15) return false;
      if (/^\d{1,2}\.\d{4,}$/.test(p.trim())) return false;
      if (/^\d{10,}$/.test(p.trim()) && !p.includes("+")) return false;
      return true;
    });

  return [...new Set(cleaned)];
}

function extractSocialLinks(text: string): Record<string, string> {
  const socialLinks: Record<string, string> = {};
  const socialPatterns = [
    { name: "facebook", regex: /https?:\/\/(?:www\.)?facebook\.com\/[^\s)"'<>,]+/gi },
    { name: "instagram", regex: /https?:\/\/(?:www\.)?instagram\.com\/[^\s)"'<>,]+/gi },
    { name: "linkedin", regex: /https?:\/\/(?:www\.)?linkedin\.com\/[^\s)"'<>,]+/gi },
    { name: "twitter", regex: /https?:\/\/(?:www\.)?(?:twitter|x)\.com\/[^\s)"'<>,]+/gi },
    { name: "youtube", regex: /https?:\/\/(?:www\.)?youtube\.com\/[^\s)"'<>,]+/gi },
    { name: "tiktok", regex: /https?:\/\/(?:www\.)?tiktok\.com\/[^\s)"'<>,]+/gi },
    { name: "pinterest", regex: /https?:\/\/(?:www\.)?pinterest\.[a-z.]+\/[^\s)"'<>,]+/gi },
  ];

  for (const { name, regex } of socialPatterns) {
    const match = text.match(regex);
    if (match) {
      let url = match[0];
      url = url.replace(/[?&](ref|utm_\w+|fbclid|igshid|source|locale)=[^&\s)]+/gi, "");
      url = url.replace(/[&?]$/, "");
      url = url.replace(/\/+$/, "");
      socialLinks[name] = url;
    }
  }

  return socialLinks;
}

function extractServices(text: string): string[] {
  const serviceKeywords = /(?:servizi|services|what we do|cosa facciamo|our services|i nostri servizi|le nostre attività|soluzioni|competenze|expertise|what we offer|aree di competenza|cosa offriamo)[:\s]*\n?([\s\S]{0,3000}?)(?:\n\n\n|\n#{1,3}\s|$)/i;
  const serviceMatch = text.match(serviceKeywords);
  if (!serviceMatch) return [];

  return serviceMatch[1]
    .split(/\n[-•*]\s*|\n\d+[.)]\s*|\n/)
    .map((s: string) => s.replace(/\]\([^)]*\)/g, "").replace(/\[[^\]]*\]/g, "").trim())
    .filter((s: string) => {
      if (s.length < 4 || s.length > 300) return false;
      if (/^https?:\/\//.test(s)) return false;
      if (/^\d+$/.test(s)) return false;
      return true;
    });
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
        onlyMainContent: false,
        timeout: 30000,
      }),
    });

    if (!response.ok) {
      const errBody = await response.text().catch(() => "");
      console.error(`[LEAD-SCRAPER] Firecrawl error for ${url}: ${response.status} — ${errBody}`);
      return defaultResult;
    }

    const data = await response.json();
    const rawMarkdown = data.data?.markdown || "";

    console.log(`[LEAD-SCRAPER] Firecrawl response for ${url}: ${rawMarkdown.length} chars of markdown`);

    const socialLinks = extractSocialLinks(rawMarkdown);
    const emails = extractEmails(rawMarkdown);

    const cleanedText = cleanMarkdown(rawMarkdown);

    const phones = extractPhones(cleanedText);
    const description = cleanedText;
    const services = extractServices(rawMarkdown);

    console.log(`[LEAD-SCRAPER] Extracted from ${url}: ${emails.length} emails, ${phones.length} phones, ${Object.keys(socialLinks).length} social, ${services.length} services, ${description.length} chars description`);

    return { emails, phones, socialLinks, description, services };
  } catch (error) {
    console.error(`[LEAD-SCRAPER] Firecrawl scrape error for ${url}:`, error);
    return defaultResult;
  }
}

function extractDomain(url: string): string {
  return url.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0].toLowerCase();
}

async function findCachedScrape(website: string): Promise<{
  websiteData: any;
  email: string | null;
  phone: string | null;
} | null> {
  const domain = extractDomain(website);

  const cached = await db
    .select({
      websiteData: leadScraperResults.websiteData,
      email: leadScraperResults.email,
      phone: leadScraperResults.phone,
    })
    .from(leadScraperResults)
    .where(
      sql`${leadScraperResults.scrapeStatus} = 'scraped'
        AND ${leadScraperResults.websiteData} IS NOT NULL
        AND ${leadScraperResults.websiteData}::text != '{}'
        AND ${leadScraperResults.websiteData}::text != 'null'
        AND LOWER(REGEXP_REPLACE(REGEXP_REPLACE(${leadScraperResults.website}, '^https?://', ''), '^www\\.', '')) LIKE ${domain + '%'}`
    )
    .limit(1);

  if (cached.length > 0 && cached[0].websiteData) {
    const wd = cached[0].websiteData as any;
    if (wd.description || (wd.emails && wd.emails.length > 0) || (wd.phones && wd.phones.length > 0)) {
      console.log(`[LEAD-SCRAPER] Cache hit for ${domain} — reusing existing scrape data`);
      return cached[0];
    }
  }

  return null;
}

export async function enrichSearchResults(
  searchId: string,
  firecrawlApiKey: string
): Promise<{ enriched: number; failed: number; cached: number }> {
  const results = await db
    .select()
    .from(leadScraperResults)
    .where(
      eq(leadScraperResults.searchId, searchId)
    );

  let enriched = 0;
  let failed = 0;
  let cached = 0;

  for (const result of results) {
    if (!result.website || result.scrapeStatus === "scraped") continue;

    try {
      const cachedData = await findCachedScrape(result.website);

      if (cachedData) {
        const primaryEmail = (cachedData.websiteData as any)?.emails?.[0] || cachedData.email || result.email;
        const primaryPhone = (!result.phone && (cachedData.websiteData as any)?.phones?.[0]) ? (cachedData.websiteData as any).phones[0] : (cachedData.phone || result.phone);

        await db
          .update(leadScraperResults)
          .set({
            websiteData: cachedData.websiteData,
            email: primaryEmail,
            phone: primaryPhone || result.phone,
            scrapeStatus: "scraped_cached",
          })
          .where(eq(leadScraperResults.id, result.id));

        cached++;
        continue;
      }

      let websiteUrl = result.website;
      if (!websiteUrl.startsWith("http")) {
        websiteUrl = `https://${websiteUrl}`;
      }

      const websiteData = await scrapeWebsiteWithFirecrawl(websiteUrl, firecrawlApiKey);

      const primaryEmail = websiteData.emails.length > 0 ? websiteData.emails[0] : result.email;
      const primaryPhone = (!result.phone && websiteData.phones.length > 0) ? websiteData.phones[0] : result.phone;

      await db
        .update(leadScraperResults)
        .set({
          websiteData: websiteData as any,
          email: primaryEmail,
          phone: primaryPhone,
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

  console.log(`[LEAD-SCRAPER] Enrichment complete for search ${searchId}: ${enriched} scraped, ${cached} from cache, ${failed} failed`);
  return { enriched, failed, cached };
}
