// Google Docs Scraper
// Extracts text content from public Google Docs

export interface ScrapedContent {
  success: boolean;
  url: string;
  content?: string;
  length?: number;
  tokenCount?: number;
  error?: string;
}

/**
 * Checks if a URL is a Google Docs URL
 */
export function isGoogleDocsUrl(url: string): boolean {
  try {
    const parsedUrl = new URL(url);
    return parsedUrl.hostname === 'docs.google.com' && 
           parsedUrl.pathname.includes('/document/');
  } catch {
    return false;
  }
}

/**
 * Extracts the document ID from a Google Docs URL
 */
function extractDocId(url: string): string | null {
  try {
    const match = url.match(/\/document\/d\/([a-zA-Z0-9-_]+)/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

/**
 * Converts a Google Docs URL to a plain text export URL
 */
function getExportUrl(docId: string): string {
  return `https://docs.google.com/document/d/${docId}/export?format=txt`;
}

/**
 * Estimate token count from text (rough approximation: ~4 chars per token for Italian/English)
 */
export function estimateTokenCount(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Scrapes text content from a public Google Docs document
 * @param url - The Google Docs URL
 * @param maxLength - Maximum content length (default 400000 chars = ~100k tokens)
 * @returns Promise with scraped content
 */
export async function scrapeGoogleDoc(url: string, maxLength: number = 400000): Promise<ScrapedContent> {
  // Verify it's a Google Docs URL
  if (!isGoogleDocsUrl(url)) {
    return {
      success: false,
      url,
      error: 'URL non valido. Supporto solo documenti Google Docs.',
    };
  }

  // Extract document ID
  const docId = extractDocId(url);
  if (!docId) {
    return {
      success: false,
      url,
      error: 'Impossibile estrarre l\'ID del documento.',
    };
  }

  try {
    // Get the export URL
    const exportUrl = getExportUrl(docId);
    
    // Fetch the document as plain text
    const response = await fetch(exportUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; DocumentReader/1.0)',
      },
      signal: AbortSignal.timeout(10000), // 10 second timeout
    });

    if (!response.ok) {
      // Check if it's a permission error
      if (response.status === 401 || response.status === 403) {
        return {
          success: false,
          url,
          error: 'Documento non accessibile. Assicurati che sia pubblico o condiviso con "chiunque abbia il link può visualizzare".',
        };
      }
      
      return {
        success: false,
        url,
        error: `Errore durante il download: ${response.status} ${response.statusText}`,
      };
    }

    // Get the text content
    let content = await response.text();
    
    // Check if we got actual content
    if (!content || content.trim().length === 0) {
      return {
        success: false,
        url,
        error: 'Documento vuoto o non accessibile.',
      };
    }

    // AGGRESSIVE CLEANUP to reduce token usage
    const originalLength = content.length;
    
    // 1. Remove excessive whitespace (newlines, spaces, tabs)
    content = content
      // Replace 3+ consecutive newlines with max 2
      .replace(/\n{3,}/g, '\n\n')
      // Replace multiple spaces/tabs with single space
      .replace(/[ \t]{2,}/g, ' ')
      // Remove trailing whitespace from each line
      .replace(/[ \t]+$/gm, '')
      // Remove leading whitespace from each line (except first indent)
      .replace(/^[ \t]+/gm, '');
    
    // 2. Remove duplicate URLs (Google Docs often repeats them)
    const urlPattern = /(https?:\/\/[^\s]+)/g;
    const seenUrls: string[] = [];
    content = content.replace(urlPattern, (url) => {
      if (seenUrls.includes(url)) {
        return '[URL rimosso - duplicato]';
      }
      seenUrls.push(url);
      return url;
    });
    
    // 3. Truncate if still too long (reduce from 250k to 15k chars max)
    if (content.length > maxLength) {
      content = content.substring(0, maxLength) + '\n\n[...contenuto troncato per lunghezza]';
    }
    
    const cleanedLength = content.length;
    const reduction = ((originalLength - cleanedLength) / originalLength * 100).toFixed(1);
    console.log(`🧹 Cleaned: ${originalLength} → ${cleanedLength} chars (${reduction}% reduction)`);


    const tokenCount = estimateTokenCount(content);
    console.log(`📊 Token count: ~${tokenCount.toLocaleString()} tokens`);

    return {
      success: true,
      url,
      content,
      length: originalLength,
      tokenCount,
    };
  } catch (error: any) {
    // Handle timeout
    if (error.name === 'AbortError' || error.name === 'TimeoutError') {
      return {
        success: false,
        url,
        error: 'Timeout durante il download del documento (10 secondi).',
      };
    }

    return {
      success: false,
      url,
      error: `Errore durante lo scraping: ${error.message}`,
    };
  }
}

/**
 * Extracts URLs from a text message
 * @param text - The text to search for URLs
 * @returns Array of found URLs
 */
export function extractUrls(text: string): string[] {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const matches = text.match(urlRegex);
  return matches || [];
}

/**
 * Checks if a URL is likely a Google Sheets URL (NOT SUPPORTED)
 */
export function isGoogleSheetsUrl(url: string): boolean {
  return url.includes("docs.google.com/spreadsheets");
}

/**
 * Scrapes multiple Google Docs URLs and returns their content
 * IMPORTANT: Always returns same number of results as input URLs (for positional alignment)
 * @param urls - Array of URLs to scrape (only Google Docs are supported)
 * @param maxLength - Maximum content length per document (default 100000 chars)
 * @returns Promise with array of scraped content (one result per input URL)
 */
export async function scrapeMultipleUrls(urls: string[], maxLength: number = 400000): Promise<ScrapedContent[]> {
  // Scrape each URL individually to maintain positional alignment
  // Non-Google-Docs URLs will get an error result
  const scrapePromises = urls.map(url => scrapeGoogleDoc(url, maxLength));
  return Promise.all(scrapePromises);
}
