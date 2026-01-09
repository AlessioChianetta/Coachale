import { fileSearchService } from "../../ai/file-search-service";

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
 * Search knowledge base for context about an email.
 * Uses the same FileSearch service pattern as AI Assistant for semantic RAG.
 */
export async function searchKnowledgeBase(
  consultantId: string,
  emailContext: EmailContext
): Promise<KnowledgeSearchResult> {
  const searchQuery = buildSearchQuery(emailContext);
  
  console.log(`[EMAIL-KB] Searching knowledge base for consultant ${consultantId}`);
  console.log(`[EMAIL-KB] Query: ${searchQuery.substring(0, 100)}...`);

  try {
    // Use the same method as AI Assistant - getStoreNamesForGeneration
    const storeNames = await fileSearchService.getStoreNamesForGeneration(
      consultantId,
      'consultant'
    );

    if (storeNames.length === 0) {
      console.log(`[EMAIL-KB] No FileSearch stores found for consultant ${consultantId}`);
      return {
        found: false,
        storeNames: [],
        totalDocuments: 0,
        documents: [],
        citations: [],
        searchQuery,
      };
    }

    // Get store info for document count
    const stores = await fileSearchService.getStoresForUser(consultantId, 'consultant');
    const totalDocuments = stores.reduce((sum, s) => sum + (s.documentCount || 0), 0);

    if (totalDocuments === 0) {
      console.log(`[EMAIL-KB] Stores found but no indexed documents for consultant ${consultantId}`);
      return {
        found: false,
        storeNames: [],
        totalDocuments: 0,
        documents: [],
        citations: [],
        searchQuery,
      };
    }

    console.log(`[EMAIL-KB] Knowledge base ready: ${totalDocuments} documents in ${storeNames.length} stores`);
    console.log(`[EMAIL-KB] Store names: ${storeNames.join(", ")}`);

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
