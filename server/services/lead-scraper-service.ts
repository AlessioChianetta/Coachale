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
