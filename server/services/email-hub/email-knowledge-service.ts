import { db } from "../../db";
import * as schema from "@shared/schema";
import { eq, and, sql } from "drizzle-orm";
import { FileSearchService } from "../../ai/file-search-service";

export interface KnowledgeSearchResult {
  found: boolean;
  storeNames: string[];
  totalDocuments: number;
  documents: Array<{
    title: string;
    content: string;
    sourceId: string;
    relevanceScore: number;
  }>;
  citations: Array<{
    sourceTitle: string;
    sourceId?: string;
    content: string;
  }>;
  searchQuery: string;
}

export interface EmailContext {
  subject: string;
  fromEmail: string;
  fromName?: string;
  bodyText: string;
}

/**
 * Get all FileSearch stores and document count for a consultant.
 * This enables the email AI service to use native Gemini File Search (semantic RAG).
 */
export async function getConsultantFileSearchStores(
  consultantId: string
): Promise<{ storeNames: string[]; totalDocuments: number }> {
  try {
    // Get all stores for this consultant
    const stores = await db
      .select({
        id: schema.fileSearchStores.id,
        storeName: schema.fileSearchStores.storeName,
      })
      .from(schema.fileSearchStores)
      .where(
        and(
          eq(schema.fileSearchStores.ownerId, consultantId),
          eq(schema.fileSearchStores.ownerType, "consultant")
        )
      );

    if (stores.length === 0) {
      console.log(`[EMAIL-KB] No FileSearch stores found for consultant ${consultantId}`);
      return { storeNames: [], totalDocuments: 0 };
    }

    const storeIds = stores.map(s => s.id);
    const storeNames = stores.map(s => s.storeName).filter(Boolean) as string[];

    // Count ALL indexed documents across all stores (no limit!)
    const [docCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(schema.fileSearchDocuments)
      .where(
        and(
          sql`${schema.fileSearchDocuments.storeId} = ANY(${sql`ARRAY[${sql.join(storeIds.map(id => sql`${id}`), sql`, `)}]::text[]`})`,
          eq(schema.fileSearchDocuments.status, "indexed")
        )
      );

    const totalDocuments = Number(docCount?.count || 0);
    
    console.log(`[EMAIL-KB] Found ${stores.length} stores with ${totalDocuments} indexed documents for consultant ${consultantId}`);
    console.log(`[EMAIL-KB] Store names: ${storeNames.join(", ")}`);

    return { storeNames, totalDocuments };
  } catch (error) {
    console.error("[EMAIL-KB] Error fetching FileSearch stores:", error);
    return { storeNames: [], totalDocuments: 0 };
  }
}

/**
 * Search knowledge base for context about an email.
 * Now returns store names for use with Gemini File Search API.
 */
export async function searchKnowledgeBase(
  consultantId: string,
  emailContext: EmailContext
): Promise<KnowledgeSearchResult> {
  const searchQuery = buildSearchQuery(emailContext);
  
  console.log(`[EMAIL-KB] Searching knowledge base for consultant ${consultantId}`);
  console.log(`[EMAIL-KB] Query: ${searchQuery.substring(0, 100)}...`);

  try {
    const { storeNames, totalDocuments } = await getConsultantFileSearchStores(consultantId);

    if (storeNames.length === 0 || totalDocuments === 0) {
      console.log(`[EMAIL-KB] No indexed documents found for consultant ${consultantId}`);
      return {
        found: false,
        storeNames: [],
        totalDocuments: 0,
        documents: [],
        citations: [],
        searchQuery,
      };
    }

    // Return store info for FileSearch RAG - no manual document fetching needed
    // The AI service will use these store names with Gemini's native File Search tool
    console.log(`[EMAIL-KB] Knowledge base ready with ${totalDocuments} documents in ${storeNames.length} stores`);

    return {
      found: true,
      storeNames,
      totalDocuments,
      documents: [], // No longer needed - Gemini File Search handles retrieval
      citations: [],
      searchQuery,
    };
  } catch (error) {
    console.error("[EMAIL-KB] Error searching knowledge base:", error);
    return {
      found: false,
      storeNames: [],
      totalDocuments: 0,
      documents: [],
      citations: [],
      searchQuery,
    };
  }
}

function buildSearchQuery(context: EmailContext): string {
  const parts: string[] = [];
  
  if (context.subject) {
    parts.push(context.subject);
  }
  
  if (context.bodyText) {
    const cleanBody = context.bodyText
      .replace(/^>.*$/gm, "")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
    
    const firstParagraph = cleanBody.split("\n\n")[0];
    if (firstParagraph && firstParagraph.length > 20) {
      parts.push(firstParagraph.substring(0, 500));
    }
  }
  
  return parts.join(" - ");
}

export async function getKnowledgeContext(
  consultantId: string,
  emailContext: EmailContext
): Promise<string> {
  const result = await searchKnowledgeBase(consultantId, emailContext);
  
  if (!result.found || result.totalDocuments === 0) {
    return "";
  }
  
  // Return a brief summary - actual content retrieval is done via Gemini File Search
  return `Knowledge Base disponibile: ${result.totalDocuments} documenti indicizzati in ${result.storeNames.length} archivi.`;
}
