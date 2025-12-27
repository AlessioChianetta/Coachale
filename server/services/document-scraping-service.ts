import { db } from "../db";
import * as schema from "@shared/schema";
import { eq } from "drizzle-orm";
import { scrapeGoogleDoc, isGoogleDocsUrl, estimateTokenCount } from "../web-scraper";

export interface ScrapeResult {
  success: boolean;
  content?: string;
  tokenCount?: number;
  error?: string;
}

export async function scrapeAndCacheDocumentContent(
  documentId: string,
  content: string | null | undefined
): Promise<ScrapeResult> {
  if (!content) {
    return { success: false, error: "No content provided" };
  }

  const googleDocUrls = extractGoogleDocUrls(content);
  
  if (googleDocUrls.length === 0) {
    const tokenCount = estimateTokenCount(content);
    await db.update(schema.libraryDocuments)
      .set({
        scrapedContent: content,
        scrapedTokens: tokenCount,
        scrapedAt: new Date(),
      })
      .where(eq(schema.libraryDocuments.id, documentId));
    
    console.log(`📄 [Scraper] Document ${documentId.substring(0, 8)} has no Google Docs links, stored raw content (${tokenCount} tokens)`);
    return { success: true, content, tokenCount };
  }

  console.log(`🔗 [Scraper] Found ${googleDocUrls.length} Google Doc link(s) in document ${documentId.substring(0, 8)}`);

  let allScrapedContent = content;
  let totalScrapedChars = 0;

  for (const url of googleDocUrls) {
    try {
      console.log(`🌐 [Scraper] Scraping: ${url.substring(0, 60)}...`);
      const result = await scrapeGoogleDoc(url);
      
      if (result.success && result.content) {
        allScrapedContent += `\n\n=== SCRAPED CONTENT FROM: ${url} ===\n${result.content}\n=== END SCRAPED CONTENT ===`;
        totalScrapedChars += result.content.length;
        console.log(`✅ [Scraper] Scraped ${result.content.length} chars from ${url.substring(0, 40)}...`);
      } else {
        console.warn(`⚠️ [Scraper] Failed to scrape ${url}: ${result.error}`);
      }
    } catch (error: any) {
      console.error(`❌ [Scraper] Error scraping ${url}:`, error.message);
    }
  }

  const tokenCount = estimateTokenCount(allScrapedContent);

  await db.update(schema.libraryDocuments)
    .set({
      scrapedContent: allScrapedContent,
      scrapedTokens: tokenCount,
      scrapedAt: new Date(),
    })
    .where(eq(schema.libraryDocuments.id, documentId));

  console.log(`💾 [Scraper] Cached scraped content for document ${documentId.substring(0, 8)}: ${tokenCount} tokens (${totalScrapedChars} chars from Google Docs)`);

  return { success: true, content: allScrapedContent, tokenCount };
}

export async function rescrapeDocument(documentId: string): Promise<ScrapeResult> {
  const [document] = await db.select()
    .from(schema.libraryDocuments)
    .where(eq(schema.libraryDocuments.id, documentId));

  if (!document) {
    return { success: false, error: "Document not found" };
  }

  return scrapeAndCacheDocumentContent(documentId, document.content);
}

export async function backfillAllDocuments(consultantId?: string): Promise<{ processed: number; success: number; failed: number }> {
  const conditions = consultantId 
    ? eq(schema.libraryDocuments.createdBy, consultantId)
    : undefined;

  const documents = conditions
    ? await db.select({ id: schema.libraryDocuments.id, content: schema.libraryDocuments.content })
        .from(schema.libraryDocuments)
        .where(conditions)
    : await db.select({ id: schema.libraryDocuments.id, content: schema.libraryDocuments.content })
        .from(schema.libraryDocuments);

  console.log(`🔄 [Backfill] Starting backfill for ${documents.length} documents...`);

  let success = 0;
  let failed = 0;

  for (const doc of documents) {
    try {
      const result = await scrapeAndCacheDocumentContent(doc.id, doc.content);
      if (result.success) {
        success++;
      } else {
        failed++;
      }
    } catch (error: any) {
      console.error(`❌ [Backfill] Error processing document ${doc.id}:`, error.message);
      failed++;
    }
  }

  console.log(`✅ [Backfill] Completed: ${success} success, ${failed} failed out of ${documents.length} total`);

  return { processed: documents.length, success, failed };
}

function extractGoogleDocUrls(content: string): string[] {
  const urlRegex = /https:\/\/docs\.google\.com\/document\/d\/[a-zA-Z0-9_-]+(?:\/[^\s<>"')]*)?/g;
  const matches = content.match(urlRegex) || [];
  return [...new Set(matches)];
}
