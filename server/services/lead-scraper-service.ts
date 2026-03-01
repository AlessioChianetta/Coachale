import { db } from "../db";
import { eq, sql, and, isNull, inArray } from "drizzle-orm";
import { leadScraperSearches, leadScraperResults, leadScraperSalesContext } from "../../shared/schema";
import { quickGenerate } from "../ai/provider-factory";

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
  place_id?: string;
  types?: string[];
  type_id?: string;
  price?: string;
  description?: string;
  open_state?: string;
  extensions?: any;
}

const ITALIAN_CITY_COORDINATES: Record<string, string> = {
  "roma": "@41.9028,12.4964,13z",
  "milano": "@45.4642,9.1900,13z",
  "napoli": "@40.8518,14.2681,13z",
  "torino": "@45.0703,7.6869,13z",
  "palermo": "@38.1157,13.3615,13z",
  "genova": "@44.4056,8.9463,13z",
  "bologna": "@44.4949,11.3426,13z",
  "firenze": "@43.7696,11.2558,13z",
  "bari": "@41.1171,16.8719,13z",
  "catania": "@37.5079,15.0830,13z",
  "venezia": "@45.4408,12.3155,13z",
  "verona": "@45.4384,10.9916,13z",
  "messina": "@38.1938,15.5540,13z",
  "padova": "@45.4064,11.8768,13z",
  "trieste": "@45.6495,13.7768,13z",
  "taranto": "@40.4764,17.2295,13z",
  "brescia": "@45.5416,10.2118,13z",
  "reggio calabria": "@38.1113,15.6474,13z",
  "modena": "@44.6471,10.9252,13z",
  "prato": "@43.8777,11.1020,13z",
  "reggio emilia": "@44.6989,10.6297,13z",
  "perugia": "@43.1107,12.3908,13z",
  "cagliari": "@39.2238,9.1217,13z",
  "livorno": "@43.5485,10.3106,13z",
  "ravenna": "@44.4184,12.2035,13z",
  "rimini": "@44.0594,12.5681,13z",
  "salerno": "@40.6824,14.7681,13z",
  "ferrara": "@44.8381,11.6199,13z",
  "sassari": "@40.7268,8.5600,13z",
  "siracusa": "@37.0755,15.2866,13z",
  "pescara": "@42.4618,14.2141,13z",
  "monza": "@45.5845,9.2744,13z",
  "bergamo": "@45.6983,9.6773,13z",
  "lecce": "@40.3516,18.1750,13z",
  "trento": "@46.0748,11.1217,13z",
  "bolzano": "@46.4983,11.3548,13z",
  "vicenza": "@45.5455,11.5354,13z",
  "terni": "@42.5636,12.6427,13z",
  "novara": "@45.4467,8.6200,13z",
  "piacenza": "@45.0526,9.6930,13z",
  "ancona": "@43.6158,13.5189,13z",
  "udine": "@46.0711,13.2346,13z",
  "arezzo": "@43.4634,11.8798,13z",
  "cesena": "@44.1391,12.2431,13z",
  "pesaro": "@43.9096,12.9131,13z",
  "como": "@45.8081,9.0852,13z",
  "la spezia": "@44.1025,9.8241,13z",
  "varese": "@45.8206,8.8257,13z",
  "parma": "@44.8015,10.3279,13z",
  "lucca": "@43.8429,10.5027,13z",
  "pisa": "@43.7228,10.4017,13z",
  "siena": "@43.3188,11.3308,13z",
  "treviso": "@45.6669,12.2430,13z",
  "latina": "@41.4676,12.9037,13z",
  "cosenza": "@39.3004,16.2510,13z",
  "potenza": "@40.6404,15.8056,13z",
  "catanzaro": "@38.9100,16.5878,13z",
  "campobasso": "@41.5614,14.6684,13z",
  "l'aquila": "@42.3498,13.3995,13z",
  "aosta": "@45.7370,7.3209,13z",
  "matera": "@40.6664,16.6043,13z",
};

function getGPSCoordinatesForLocation(location: string): string | null {
  if (!location) return null;
  const normalized = location.toLowerCase().trim();
  for (const [city, coords] of Object.entries(ITALIAN_CITY_COORDINATES)) {
    if (normalized.includes(city) || city.includes(normalized)) {
      return coords;
    }
  }
  return null;
}

export async function searchGoogleMaps(
  query: string,
  location: string,
  limit: number = 20,
  serpApiKey: string
): Promise<SerpApiResult[]> {
  const allResults: SerpApiResult[] = [];
  let start = 0;

  const gpsCoords = getGPSCoordinatesForLocation(location);
  if (gpsCoords) {
    console.log(`[LEAD-SCRAPER] Using GPS coordinates for ${location}: ${gpsCoords}`);
  }

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

    if (gpsCoords) {
      params.set("ll", gpsCoords);
    }

    const response = await fetch(`https://serpapi.com/search.json?${params.toString()}`);
    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`SerpAPI error: ${response.status} - ${errText}`);
    }

    const data = await response.json();
    const localResults = data.local_results || [];

    if (localResults.length === 0) break;

    for (const r of localResults) {
      allResults.push({
        ...r,
        place_id: r.place_id || null,
        types: r.types || [],
        type_id: r.type_id || null,
        price: r.price || null,
        description: r.description || null,
        open_state: r.open_state || null,
        extensions: r.extensions || null,
      });
    }
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

const CONTACT_PAGE_PATTERNS = [
  /contatt/i, /contact/i, /chi-siamo/i, /chi_siamo/i, /about/i,
  /team/i, /staff/i, /persone/i, /dove-siamo/i, /dove_siamo/i,
  /sede/i, /raggiungici/i, /scrivici/i,
];

function findContactPageUrl(links: string[], baseUrl: string): string | null {
  if (!links || links.length === 0) return null;

  const baseDomain = baseUrl.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0].toLowerCase();

  const candidates = links.filter(link => {
    try {
      const linkDomain = link.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0].toLowerCase();
      if (linkDomain !== baseDomain) return false;
      const path = link.replace(/^https?:\/\/[^/]+/, '').toLowerCase();
      if (!path || path === '/' || path === '') return false;
      return CONTACT_PAGE_PATTERNS.some(pattern => pattern.test(path));
    } catch { return false; }
  });

  if (candidates.length === 0) return null;

  const priorityOrder = ['contatt', 'contact', 'chi-siamo', 'about', 'team'];
  for (const keyword of priorityOrder) {
    const match = candidates.find(c => c.toLowerCase().includes(keyword));
    if (match) return match;
  }
  return candidates[0];
}

function mergeScrapedData(
  homepage: { emails: string[]; phones: string[]; socialLinks: Record<string, string>; description: string; services: string[]; teamMembers: Array<{ name?: string; role?: string; email?: string }> },
  contactPage: { emails: string[]; phones: string[]; socialLinks: Record<string, string>; description: string; services: string[]; teamMembers: Array<{ name?: string; role?: string; email?: string }> }
): typeof homepage {
  const allEmails = [...new Set([...homepage.emails, ...contactPage.emails])];
  const allPhones = [...new Set([...homepage.phones, ...contactPage.phones])];
  const mergedSocial = { ...homepage.socialLinks, ...contactPage.socialLinks };
  const mergedServices = [...new Set([...homepage.services, ...contactPage.services])];

  const teamMap = new Map<string, { name?: string; role?: string; email?: string }>();
  for (const member of [...homepage.teamMembers, ...contactPage.teamMembers]) {
    const key = (member.name || member.email || '').toLowerCase();
    if (key) teamMap.set(key, { ...teamMap.get(key), ...member });
  }

  return {
    emails: allEmails,
    phones: allPhones,
    socialLinks: mergedSocial,
    description: homepage.description || contactPage.description,
    services: mergedServices,
    teamMembers: Array.from(teamMap.values()),
  };
}

const FIRECRAWL_JSON_SCHEMA = {
  type: "object",
  properties: {
    company_name: { type: "string" },
    emails: { type: "array", items: { type: "string" } },
    phone_numbers: { type: "array", items: { type: "string" } },
    services: { type: "array", items: { type: "string" } },
    description: { type: "string" },
    team_members: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          role: { type: "string" },
          email: { type: "string" },
        },
      },
    },
    social_links: { type: "object" },
  },
};

async function scrapeOnePage(
  url: string,
  firecrawlApiKey: string,
  includeLinks: boolean = false
): Promise<{
  emails: string[];
  phones: string[];
  socialLinks: Record<string, string>;
  description: string;
  services: string[];
  teamMembers: Array<{ name?: string; role?: string; email?: string }>;
  links: string[];
}> {
  const defaultResult = { emails: [], phones: [], socialLinks: {}, description: "", services: [], teamMembers: [], links: [] };

  try {
    const formats: string[] = ["markdown", "json"];
    if (includeLinks) formats.push("links");

    const response = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${firecrawlApiKey}`,
      },
      body: JSON.stringify({
        url,
        formats,
        jsonOptions: {
          schema: FIRECRAWL_JSON_SCHEMA,
          prompt: "Extract all contact information, team members with their roles and emails, services offered, and social media links from this business website page. Focus on finding direct/personal emails (not just info@) and mobile phone numbers.",
        },
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
    const jsonData = data.data?.json || null;
    const pageLinks = data.data?.links || [];

    console.log(`[LEAD-SCRAPER] Firecrawl response for ${url}: ${rawMarkdown.length} chars markdown, JSON=${jsonData ? 'yes' : 'no'}, ${pageLinks.length} links`);

    const regexSocialLinks = extractSocialLinks(rawMarkdown);
    const regexEmails = extractEmails(rawMarkdown);
    const cleanedText = cleanMarkdown(rawMarkdown);
    const regexPhones = extractPhones(cleanedText);
    const regexServices = extractServices(rawMarkdown);

    let jsonEmails: string[] = [];
    let jsonPhones: string[] = [];
    let jsonServices: string[] = [];
    let jsonDescription = "";
    let jsonTeamMembers: Array<{ name?: string; role?: string; email?: string }> = [];
    let jsonSocialLinks: Record<string, string> = {};

    if (jsonData) {
      jsonEmails = (jsonData.emails || []).filter((e: string) => e && e.includes('@'));
      jsonPhones = (jsonData.phone_numbers || []).filter((p: string) => p && p.trim());
      jsonServices = (jsonData.services || []).filter((s: string) => s && s.trim());
      jsonDescription = jsonData.description || "";
      jsonTeamMembers = (jsonData.team_members || []).filter((m: any) => m && (m.name || m.email));
      jsonSocialLinks = jsonData.social_links || {};

      for (const member of jsonTeamMembers) {
        if (member.email && member.email.includes('@') && !jsonEmails.includes(member.email)) {
          jsonEmails.push(member.email);
        }
      }

      console.log(`[LEAD-SCRAPER] JSON extraction for ${url}: ${jsonEmails.length} emails, ${jsonPhones.length} phones, ${jsonServices.length} services, ${jsonTeamMembers.length} team members`);
    }

    const finalEmails = [...new Set([...jsonEmails, ...regexEmails])];
    const finalPhones = [...new Set([...jsonPhones, ...regexPhones])];
    const finalSocial = { ...regexSocialLinks, ...jsonSocialLinks };
    const finalServices = [...new Set([...jsonServices, ...regexServices])];
    const finalDescription = jsonDescription || cleanedText;

    console.log(`[LEAD-SCRAPER] Final merged for ${url}: ${finalEmails.length} emails, ${finalPhones.length} phones, ${Object.keys(finalSocial).length} social, ${finalServices.length} services, ${jsonTeamMembers.length} team, ${finalDescription.length} chars desc`);

    return {
      emails: finalEmails,
      phones: finalPhones,
      socialLinks: finalSocial,
      description: finalDescription,
      services: finalServices,
      teamMembers: jsonTeamMembers,
      links: pageLinks,
    };
  } catch (error) {
    console.error(`[LEAD-SCRAPER] Firecrawl scrape error for ${url}:`, error);
    return defaultResult;
  }
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
  teamMembers?: Array<{ name?: string; role?: string; email?: string }>;
  contactPageUrl?: string;
}> {
  const homepageData = await scrapeOnePage(url, firecrawlApiKey, true);

  if (homepageData.emails.length === 0 && homepageData.phones.length === 0 && homepageData.description === "") {
    return { ...homepageData, teamMembers: [], contactPageUrl: undefined };
  }

  const contactPageUrl = findContactPageUrl(homepageData.links, url);
  let finalData = homepageData;

  if (contactPageUrl) {
    console.log(`[LEAD-SCRAPER] Found contact page: ${contactPageUrl} — scraping for additional contacts`);
    const contactPageData = await scrapeOnePage(contactPageUrl, firecrawlApiKey, false);
    finalData = mergeScrapedData(homepageData, contactPageData);
    console.log(`[LEAD-SCRAPER] After contact page merge: ${finalData.emails.length} emails (+${finalData.emails.length - homepageData.emails.length}), ${finalData.phones.length} phones (+${finalData.phones.length - homepageData.phones.length}), ${finalData.teamMembers.length} team members`);
  }

  return {
    emails: finalData.emails,
    phones: finalData.phones,
    socialLinks: finalData.socialLinks,
    description: finalData.description,
    services: finalData.services,
    teamMembers: finalData.teamMembers,
    contactPageUrl: contactPageUrl || undefined,
  };
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

async function batchScrapeWithFirecrawl(
  urls: string[],
  firecrawlApiKey: string,
  timeoutMs: number = 120000
): Promise<Map<string, { emails: string[]; phones: string[]; socialLinks: Record<string, string>; description: string; services: string[]; teamMembers: Array<{ name?: string; role?: string; email?: string }>; contactPageUrl?: string }>> {
  const resultMap = new Map<string, any>();

  if (urls.length === 0) return resultMap;

  console.log(`[LEAD-SCRAPER] Starting batch scrape for ${urls.length} URLs`);

  try {
    const batchResponse = await fetch("https://api.firecrawl.dev/v1/batch/scrape", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${firecrawlApiKey}`,
      },
      body: JSON.stringify({
        urls,
        formats: ["markdown", "json", "links"],
        jsonOptions: {
          schema: FIRECRAWL_JSON_SCHEMA,
          prompt: "Extract all contact information, team members with their roles and emails, services offered, and social media links from this business website page. Focus on finding direct/personal emails (not just info@) and mobile phone numbers.",
        },
        onlyMainContent: false,
      }),
    });

    if (!batchResponse.ok) {
      const errBody = await batchResponse.text().catch(() => "");
      console.error(`[LEAD-SCRAPER] Batch scrape init failed: ${batchResponse.status} — ${errBody}`);
      return resultMap;
    }

    const batchInit = await batchResponse.json();
    const batchId = batchInit.id;
    if (!batchId) {
      console.error(`[LEAD-SCRAPER] Batch scrape returned no ID:`, batchInit);
      return resultMap;
    }

    console.log(`[LEAD-SCRAPER] Batch scrape started: ${batchId}, polling for results...`);

    const startTime = Date.now();
    let completed = false;
    let batchData: any = null;

    while (Date.now() - startTime < timeoutMs) {
      await new Promise(r => setTimeout(r, 3000));

      const pollResponse = await fetch(`https://api.firecrawl.dev/v1/batch/scrape/${batchId}`, {
        headers: { Authorization: `Bearer ${firecrawlApiKey}` },
      });

      if (!pollResponse.ok) {
        console.warn(`[LEAD-SCRAPER] Batch poll error: ${pollResponse.status}`);
        continue;
      }

      batchData = await pollResponse.json();
      const status = batchData.status;

      if (status === "completed") {
        completed = true;
        break;
      } else if (status === "failed") {
        console.error(`[LEAD-SCRAPER] Batch scrape failed:`, batchData);
        break;
      }

      const progress = batchData.completed || 0;
      const total = batchData.total || urls.length;
      console.log(`[LEAD-SCRAPER] Batch progress: ${progress}/${total} (${status})`);
    }

    if (!completed || !batchData?.data) {
      console.warn(`[LEAD-SCRAPER] Batch scrape ${completed ? 'has no data' : 'timed out after ' + Math.round((Date.now() - startTime) / 1000) + 's'}`);
      return resultMap;
    }

    const batchResults = batchData.data || [];
    console.log(`[LEAD-SCRAPER] Batch scrape completed: ${batchResults.length} results`);

    for (const item of batchResults) {
      const sourceUrl = item.metadata?.sourceURL || item.metadata?.url || "";
      if (!sourceUrl) continue;

      const rawMarkdown = item.markdown || "";
      const jsonData = item.json || null;
      const pageLinks = item.links || [];

      const regexSocialLinks = extractSocialLinks(rawMarkdown);
      const regexEmails = extractEmails(rawMarkdown);
      const cleanedText = cleanMarkdown(rawMarkdown);
      const regexPhones = extractPhones(cleanedText);
      const regexServices = extractServices(rawMarkdown);

      let jsonEmails: string[] = [];
      let jsonPhones: string[] = [];
      let jsonServices: string[] = [];
      let jsonDescription = "";
      let jsonTeamMembers: Array<{ name?: string; role?: string; email?: string }> = [];
      let jsonSocialLinks: Record<string, string> = {};

      if (jsonData) {
        jsonEmails = (jsonData.emails || []).filter((e: string) => e && e.includes('@'));
        jsonPhones = (jsonData.phone_numbers || []).filter((p: string) => p && p.trim());
        jsonServices = (jsonData.services || []).filter((s: string) => s && s.trim());
        jsonDescription = jsonData.description || "";
        jsonTeamMembers = (jsonData.team_members || []).filter((m: any) => m && (m.name || m.email));
        jsonSocialLinks = jsonData.social_links || {};

        for (const member of jsonTeamMembers) {
          if (member.email && member.email.includes('@') && !jsonEmails.includes(member.email)) {
            jsonEmails.push(member.email);
          }
        }
      }

      const contactPageUrl = findContactPageUrl(pageLinks, sourceUrl);

      const finalData = {
        emails: [...new Set([...jsonEmails, ...regexEmails])],
        phones: [...new Set([...jsonPhones, ...regexPhones])],
        socialLinks: { ...regexSocialLinks, ...jsonSocialLinks },
        description: jsonDescription || cleanedText,
        services: [...new Set([...jsonServices, ...regexServices])],
        teamMembers: jsonTeamMembers,
        contactPageUrl: contactPageUrl || undefined,
      };

      const normalizedUrl = sourceUrl.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0].toLowerCase();
      resultMap.set(normalizedUrl, finalData);
    }

    return resultMap;
  } catch (error) {
    console.error(`[LEAD-SCRAPER] Batch scrape error:`, error);
    return resultMap;
  }
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

  const toScrape: Array<{ result: typeof results[0]; url: string }> = [];

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
      toScrape.push({ result, url: websiteUrl });
    } catch (error) {
      console.error(`Failed to check cache for result ${result.id}:`, error);
      toScrape.push({ result, url: result.website.startsWith("http") ? result.website : `https://${result.website}` });
    }
  }

  if (toScrape.length === 0) {
    console.log(`[LEAD-SCRAPER] Enrichment complete for search ${searchId}: ${enriched} scraped, ${cached} from cache, ${failed} failed (nothing to scrape)`);
    return { enriched, failed, cached };
  }

  console.log(`[LEAD-SCRAPER] ${toScrape.length} URLs to scrape (${cached} from cache already)`);

  const batchResults = await batchScrapeWithFirecrawl(
    toScrape.map(s => s.url),
    firecrawlApiKey
  );

  const useBatch = batchResults.size > 0;

  for (const { result, url } of toScrape) {
    try {
      let websiteData: any;
      const normalizedDomain = url.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0].toLowerCase();

      if (useBatch && batchResults.has(normalizedDomain)) {
        websiteData = batchResults.get(normalizedDomain);
        console.log(`[LEAD-SCRAPER] Batch result for ${normalizedDomain}: ${websiteData.emails?.length || 0} emails, ${websiteData.phones?.length || 0} phones`);
      } else {
        console.log(`[LEAD-SCRAPER] ${useBatch ? 'Batch miss' : 'Batch failed'}, falling back to individual scrape for ${url}`);
        websiteData = await scrapeWebsiteWithFirecrawl(url, firecrawlApiKey);
      }

      const primaryEmail = websiteData.emails?.length > 0 ? websiteData.emails[0] : result.email;
      const primaryPhone = (!result.phone && websiteData.phones?.length > 0) ? websiteData.phones[0] : result.phone;

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

  if (useBatch) {
    console.log(`[LEAD-SCRAPER] Contact page scraping for batch results...`);
    let contactPagesScraped = 0;
    for (const { result, url } of toScrape) {
      try {
        const normalizedDomain = url.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0].toLowerCase();
        const batchData = batchResults.get(normalizedDomain);
        if (!batchData?.contactPageUrl) continue;

        const contactPageData = await scrapeOnePage(batchData.contactPageUrl, firecrawlApiKey, false);
        if (contactPageData.emails.length === 0 && contactPageData.phones.length === 0 && contactPageData.teamMembers.length === 0) continue;

        const merged = mergeScrapedData(batchData as any, contactPageData);
        const primaryEmail = merged.emails.length > 0 ? merged.emails[0] : result.email;
        const primaryPhone = (!result.phone && merged.phones.length > 0) ? merged.phones[0] : result.phone;

        await db
          .update(leadScraperResults)
          .set({
            websiteData: { ...merged, contactPageUrl: batchData.contactPageUrl } as any,
            email: primaryEmail,
            phone: primaryPhone,
          })
          .where(eq(leadScraperResults.id, result.id));

        contactPagesScraped++;
        console.log(`[LEAD-SCRAPER] Contact page ${batchData.contactPageUrl}: +${contactPageData.emails.length} emails, +${contactPageData.phones.length} phones, +${contactPageData.teamMembers.length} team`);
      } catch (err) {
        console.warn(`[LEAD-SCRAPER] Contact page scrape failed for ${result.businessName}:`, err);
      }
    }
    if (contactPagesScraped > 0) {
      console.log(`[LEAD-SCRAPER] Scraped ${contactPagesScraped} contact pages for additional data`);
    }
  }

  console.log(`[LEAD-SCRAPER] Enrichment complete for search ${searchId}: ${enriched} scraped (${useBatch ? 'batch' : 'sequential'}), ${cached} from cache, ${failed} failed`);
  return { enriched, failed, cached };
}

export async function generateSalesSummary(resultId: string, consultantId: string): Promise<any> {
  const [result] = await db.select().from(leadScraperResults).where(eq(leadScraperResults.id, resultId));
  if (!result) throw new Error("Result not found");

  const [salesContext] = await db
    .select()
    .from(leadScraperSalesContext)
    .where(eq(leadScraperSalesContext.consultantId, consultantId));

  const wd = (result.websiteData as any) || {};

  let consultantContextBlock = "";
  if (salesContext) {
    const parts: string[] = [];
    if (salesContext.servicesOffered) parts.push(`SERVIZI CHE VENDO: ${salesContext.servicesOffered}`);
    if (salesContext.targetAudience) parts.push(`TARGET IDEALE: ${salesContext.targetAudience}`);
    if (salesContext.valueProposition) parts.push(`PROPOSTA DI VALORE: ${salesContext.valueProposition}`);
    if (salesContext.pricingInfo) parts.push(`PRICING: ${salesContext.pricingInfo}`);
    if (salesContext.competitiveAdvantages) parts.push(`VANTAGGI COMPETITIVI: ${salesContext.competitiveAdvantages}`);
    if (salesContext.idealClientProfile) parts.push(`PROFILO CLIENTE IDEALE: ${salesContext.idealClientProfile}`);
    if (salesContext.salesApproach) parts.push(`APPROCCIO VENDITA: ${salesContext.salesApproach}`);
    if (salesContext.caseStudies) parts.push(`CASI DI SUCCESSO: ${salesContext.caseStudies}`);
    if (salesContext.additionalContext) parts.push(`CONTESTO AGGIUNTIVO: ${salesContext.additionalContext}`);
    consultantContextBlock = parts.join("\n");
  }

  let companyDataBlock = "";
  const dataLines: string[] = [];
  if (result.businessName) dataLines.push(`NOME AZIENDA: ${result.businessName}`);
  if (result.category) dataLines.push(`CATEGORIA: ${result.category}`);
  if (result.address) dataLines.push(`INDIRIZZO: ${result.address}`);
  if (result.website) dataLines.push(`SITO WEB: ${result.website}`);
  if (result.phone) dataLines.push(`TELEFONO: ${result.phone}`);
  if (result.email) dataLines.push(`EMAIL: ${result.email}`);
  if (result.rating) dataLines.push(`RATING GOOGLE: ${result.rating}/5 (${result.reviewsCount || 0} recensioni)`);
  if (wd.emails?.length) dataLines.push(`EMAIL DAL SITO: ${wd.emails.join(", ")}`);
  if (wd.phones?.length) dataLines.push(`TELEFONI DAL SITO: ${wd.phones.join(", ")}`);
  if (wd.socialLinks && Object.keys(wd.socialLinks).length > 0) {
    dataLines.push(`SOCIAL: ${Object.entries(wd.socialLinks).map(([k, v]) => `${k}: ${v}`).join(", ")}`);
  }
  if (wd.services?.length) dataLines.push(`SERVIZI DELL'AZIENDA: ${wd.services.join(", ")}`);
  if (wd.teamMembers?.length) {
    const teamStr = wd.teamMembers.map((m: any) => {
      const parts = [];
      if (m.name) parts.push(m.name);
      if (m.role) parts.push(`(${m.role})`);
      if (m.email) parts.push(`- ${m.email}`);
      return parts.join(' ');
    }).join('; ');
    dataLines.push(`TEAM/PERSONE CHIAVE: ${teamStr}`);
  }
  if (wd.contactPageUrl) dataLines.push(`PAGINA CONTATTI: ${wd.contactPageUrl}`);
  if ((result as any).mapsDescription) dataLines.push(`DESCRIZIONE GOOGLE MAPS: ${(result as any).mapsDescription}`);
  if ((result as any).businessTypes?.length) dataLines.push(`TIPOLOGIE MAPS: ${(result as any).businessTypes.join(', ')}`);
  if ((result as any).priceRange) dataLines.push(`FASCIA PREZZO: ${(result as any).priceRange}`);
  if (wd.description) {
    const descTruncated = wd.description.length > 4000 ? wd.description.substring(0, 4000) + "..." : wd.description;
    dataLines.push(`DESCRIZIONE DAL SITO:\n${descTruncated}`);
  }
  companyDataBlock = dataLines.join("\n");

  const systemPrompt = `Sei un esperto analista di vendita B2B italiano. Il tuo compito è analizzare un'azienda target e produrre un resoconto strutturato per aiutare il consulente a vendere i propri servizi a questa azienda.

${consultantContextBlock ? `--- PROFILO DEL CONSULENTE (CHI VENDE) ---\n${consultantContextBlock}\n---` : "NOTA: Il consulente non ha ancora configurato il proprio profilo vendita. Fai un'analisi generica dell'azienda."}

Produci il resoconto in questo FORMATO ESATTO:

**SCORE: [numero da 1 a 100]**

## Chi sono
[Breve sintesi dell'azienda: cosa fanno, dimensione stimata, settore. Max 3-4 righe.]

## Cosa fanno
[Servizi/prodotti principali dell'azienda target. Elenco puntato con bullet points.]

## Punti di forza dell'azienda
[Cosa fanno bene, reputazione, presenza online. Elenco puntato.]

## Segnali chiave
[Segnali concreti dal sito/recensioni/social che indicano propensione all'acquisto. Es: "Stanno già usando tool X", "Hanno pubblicato annunci per Y", "Il CEO parla di Z su LinkedIn". Ogni segnale su un bullet point separato.]

## Bisogni potenziali
[Per ogni bisogno: collega esplicitamente al servizio/prodotto specifico del consulente che lo risolve. Formato per ogni punto:
- **Bisogno:** [descrizione concreta] → **Soluzione:** [nome servizio/prodotto del consulente e come lo risolve]]

## Obiezioni probabili
[Le 2-3 obiezioni più probabili che il prospect potrebbe sollevare, con la risposta consigliata per ciascuna. Formato:
- **"Obiezione"** → Risposta: [come gestirla]]

## Urgenza
[Perché dovrebbero agire ORA e non tra 6 mesi. Leva temporale concreta: stagionalità, trend di mercato, competitor che si muovono, costo dell'inazione.]

## Strategia di approccio
[Come contattarli, quale canale usare, quando, con quale tono. Max 3-4 righe.]

## Contatto migliore
[Quale persona contattare (nome e ruolo se trovati), quale email/telefono usare e perché.]

## Apertura conversazione suggerita
Genera 3 varianti:
- **WhatsApp:** [Messaggio breve, diretto, max 2-3 frasi. Tono conversazionale.]
- **Email:** [Oggetto email + prime 2 righe del corpo. Tono professionale.]
- **Voce:** [Frase di apertura per chiamata telefonica, presentazione + aggancio in 15 secondi.]

REGOLE:
- Lo SCORE deve riflettere quanto questa azienda è un buon prospect PER IL CONSULENTE in base ai suoi servizi specifici
- Score alto (70-100): bisogno evidente dei servizi del consulente, buon budget presunto, facile accesso
- Score medio (40-69): potenziale interesse ma non certo, bisogna investigare
- Score basso (1-39): poco match con i servizi del consulente
- Sii pratico e actionable, MAI generico. Ogni punto deve contenere dettagli specifici sull'azienda target
- Scrivi in italiano
- Max 800 parole totali. Preferisci bullet points a paragrafi lunghi
- NON inventare informazioni: se un dato non è disponibile, omettilo`;

  const userPrompt = `Analizza questa azienda target:\n\n${companyDataBlock}`;

  try {
    const aiResult = await quickGenerate({
      consultantId,
      feature: "lead-scraper-sales-analysis",
      contents: [{ role: "user", parts: [{ text: userPrompt }] }],
      systemInstruction: systemPrompt,
      thinkingLevel: "low",
    });

    const responseText = aiResult.text || "";

    let score: number | null = null;
    const scorePatterns = [
      /\*\*SCORE:\s*(\d{1,3})\s*(?:\/\s*100)?\s*\*\*/i,
      /\*\*\s*SCORE\s*:\s*(\d{1,3})\s*(?:\/\s*100)?\s*\*\*/i,
      /#+\s*SCORE\s*:\s*(\d{1,3})/i,
      /SCORE\s*:\s*(\d{1,3})\s*(?:\/\s*100)?/i,
      /\bscore\s*[:=]\s*(\d{1,3})\b/i,
    ];
    for (const pattern of scorePatterns) {
      const match = responseText.match(pattern);
      if (match) {
        score = Math.min(100, Math.max(1, parseInt(match[1])));
        break;
      }
    }

    if (score === null) {
      console.warn(`[LEAD-SCRAPER] Score extraction FAILED for ${result.businessName}. First 300 chars: ${responseText.substring(0, 300).replace(/\n/g, ' ')}`);
    }

    const [updated] = await db
      .update(leadScraperResults)
      .set({
        aiSalesSummary: responseText,
        aiCompatibilityScore: score,
        aiSalesSummaryGeneratedAt: new Date(),
      })
      .where(eq(leadScraperResults.id, resultId))
      .returning();

    console.log(`[LEAD-SCRAPER] AI summary generated for ${result.businessName}: score=${score}`);
    return updated;
  } catch (error: any) {
    console.error(`[LEAD-SCRAPER] AI summary error for ${result.businessName}:`, error.message);
    throw error;
  }
}

export async function generateBatchSalesSummaries(
  searchId: string,
  consultantId: string,
  onProgress?: (info: { index: number; total: number; businessName: string; score: number | null; status: 'analyzing' | 'done' | 'failed' }) => void,
): Promise<{ generated: number; failed: number }> {
  const results = await db
    .select()
    .from(leadScraperResults)
    .where(
      and(
        eq(leadScraperResults.searchId, searchId),
        sql`(${leadScraperResults.scrapeStatus} = 'scraped' OR ${leadScraperResults.scrapeStatus} = 'scraped_cached')`,
        isNull(leadScraperResults.aiSalesSummary)
      )
    );

  let generated = 0;
  let failed = 0;

  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    try {
      if (onProgress) {
        onProgress({ index: i + 1, total: results.length, businessName: result.businessName || 'Sconosciuto', score: null, status: 'analyzing' });
      }
      const updated = await generateSalesSummary(result.id, consultantId);
      generated++;
      if (onProgress) {
        onProgress({ index: i + 1, total: results.length, businessName: result.businessName || 'Sconosciuto', score: updated?.aiCompatibilityScore ?? null, status: 'done' });
      }
    } catch (error: any) {
      console.error(`[LEAD-SCRAPER] Batch summary failed for ${result.businessName}:`, error.message);
      failed++;
      if (onProgress) {
        onProgress({ index: i + 1, total: results.length, businessName: result.businessName || 'Sconosciuto', score: null, status: 'failed' });
      }
    }
  }

  console.log(`[LEAD-SCRAPER] Batch summary complete for search ${searchId}: ${generated} generated, ${failed} failed`);
  return { generated, failed };
}
