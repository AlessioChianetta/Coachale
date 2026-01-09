import { db } from "../../db";
import * as schema from "@shared/schema";
import { eq, and, desc } from "drizzle-orm";
import { FileSearchService } from "../../ai/file-search-service";

export interface KnowledgeSearchResult {
  found: boolean;
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

export async function searchKnowledgeBase(
  consultantId: string,
  emailContext: EmailContext
): Promise<KnowledgeSearchResult> {
  const searchQuery = buildSearchQuery(emailContext);
  
  console.log(`[EMAIL-KB] Searching knowledge base for consultant ${consultantId}`);
  console.log(`[EMAIL-KB] Query: ${searchQuery.substring(0, 100)}...`);

  try {
    const fileSearchService = new FileSearchService();
    
    const stores = await db
      .select()
      .from(schema.fileSearchStores)
      .where(
        and(
          eq(schema.fileSearchStores.ownerId, consultantId),
          eq(schema.fileSearchStores.ownerType, "consultant")
        )
      );

    if (stores.length === 0) {
      console.log(`[EMAIL-KB] No knowledge base found for consultant ${consultantId}`);
      return {
        found: false,
        documents: [],
        citations: [],
        searchQuery,
      };
    }

    const documents: KnowledgeSearchResult["documents"] = [];
    const citations: KnowledgeSearchResult["citations"] = [];

    for (const store of stores) {
      try {
        const docs = await db
          .select()
          .from(schema.fileSearchDocuments)
          .where(
            and(
              eq(schema.fileSearchDocuments.storeId, store.id),
              eq(schema.fileSearchDocuments.status, "indexed")
            )
          )
          .limit(10);

        if (docs.length > 0) {
          console.log(`[EMAIL-KB] Found ${docs.length} indexed documents in store ${store.displayName}`);
          
          for (const doc of docs) {
            documents.push({
              title: doc.displayName || doc.fileName,
              content: `Documento: ${doc.displayName || doc.fileName}`,
              sourceId: doc.id,
              relevanceScore: 0.7,
            });
          }
        }
      } catch (err) {
        console.error(`[EMAIL-KB] Error searching store ${store.id}:`, err);
      }
    }

    const found = documents.length > 0;
    
    console.log(`[EMAIL-KB] Search complete. Found: ${found}, Documents: ${documents.length}`);

    return {
      found,
      documents,
      citations,
      searchQuery,
    };
  } catch (error) {
    console.error("[EMAIL-KB] Error searching knowledge base:", error);
    return {
      found: false,
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
  
  if (!result.found || result.documents.length === 0) {
    return "";
  }
  
  const contextParts: string[] = [
    "DOCUMENTAZIONE DISPONIBILE:",
    "",
  ];
  
  for (const doc of result.documents.slice(0, 5)) {
    contextParts.push(`- ${doc.title}`);
    if (doc.content && doc.content.length > 50) {
      contextParts.push(`  Contenuto: ${doc.content.substring(0, 200)}...`);
    }
  }
  
  return contextParts.join("\n");
}
