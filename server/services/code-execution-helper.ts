/**
 * Code Execution Helper for Tabular Data
 * Handles detection of calculation intents and prepares data for Gemini Code Execution
 */

import { db } from "../db";
import { clientKnowledgeDocuments } from "../../shared/schema";
import { eq, and, or, isNotNull } from "drizzle-orm";

/**
 * Patterns that indicate a calculation request
 */
const CALCULATION_PATTERNS = [
  // Italian
  /\b(calcola|somma|totale|media|margine|percentuale|margini|fatturato|ricavo|costo|guadagno|profitto|incasso|vendite|acquisti)\b/i,
  /\b(quanto|quanti|quante)\s+(ho|abbiamo|sono|hai|ha)\s+(guadagnato|speso|venduto|incassato|fatturato)/i,
  /\b(somma|totale|media|massimo|minimo)\s+(di|delle?|degli?|dei)\b/i,
  /\banaliz{1,2}a\s+(i\s+)?(dati|numeri|cifre|importi|valori)\b/i,
  // English
  /\b(calculate|sum|total|average|margin|percentage|revenue|cost|profit|sales)\b/i,
  /\b(how\s+much|how\s+many)\s+(did\s+)?(i|we)\s+(earn|spend|sell|make)\b/i,
];

/**
 * Patterns for date/period filters
 */
const DATE_FILTER_PATTERNS = [
  /\b(gennaio|febbraio|marzo|aprile|maggio|giugno|luglio|agosto|settembre|ottobre|novembre|dicembre)\b/i,
  /\b(january|february|march|april|may|june|july|august|september|october|november|december)\b/i,
  /\b(2024|2025|2026)\b/,
  /\b(ultimo|ultimi|scorso|scorsi)\s+(mese|anno|trimestre|settimana)\b/i,
  /\b(last|previous)\s+(month|year|quarter|week)\b/i,
];

export interface CalculationIntent {
  isCalculation: boolean;
  hasDateFilter: boolean;
  suggestedDateFilter?: string;
}

/**
 * Detect if a user message is requesting calculations on tabular data
 */
export function detectCalculationIntent(message: string): CalculationIntent {
  const isCalculation = CALCULATION_PATTERNS.some(pattern => pattern.test(message));
  const hasDateFilter = DATE_FILTER_PATTERNS.some(pattern => pattern.test(message));
  
  let suggestedDateFilter: string | undefined;
  
  // Extract month name if present
  const monthMatch = message.match(/\b(gennaio|febbraio|marzo|aprile|maggio|giugno|luglio|agosto|settembre|ottobre|novembre|dicembre|january|february|march|april|may|june|july|august|september|october|november|december)\b/i);
  if (monthMatch) {
    suggestedDateFilter = monthMatch[1].toLowerCase();
  }
  
  // Extract year if present
  const yearMatch = message.match(/\b(2024|2025|2026)\b/);
  if (yearMatch) {
    suggestedDateFilter = suggestedDateFilter 
      ? `${suggestedDateFilter} ${yearMatch[1]}` 
      : yearMatch[1];
  }
  
  return {
    isCalculation,
    hasDateFilter,
    suggestedDateFilter
  };
}

export interface TabularDocument {
  id: string;
  title: string;
  fileName: string;
  structuredData: {
    sheets: Array<{
      name: string;
      headers: string[];
      rows: any[][];
      rowCount: number;
      columnCount: number;
    }>;
    totalRows: number;
    totalColumns: number;
    fileType: 'csv' | 'xlsx' | 'xls';
  };
}

/**
 * Get tabular documents (Excel/CSV) for a client that have structured data
 */
export async function getClientTabularDocuments(clientId: string): Promise<TabularDocument[]> {
  const docs = await db.select({
    id: clientKnowledgeDocuments.id,
    title: clientKnowledgeDocuments.title,
    fileName: clientKnowledgeDocuments.fileName,
    structuredData: clientKnowledgeDocuments.structuredData,
  })
  .from(clientKnowledgeDocuments)
  .where(
    and(
      eq(clientKnowledgeDocuments.clientId, clientId),
      isNotNull(clientKnowledgeDocuments.structuredData),
      or(
        eq(clientKnowledgeDocuments.fileType, 'xlsx'),
        eq(clientKnowledgeDocuments.fileType, 'xls'),
        eq(clientKnowledgeDocuments.fileType, 'csv')
      )
    )
  );
  
  return docs.filter(d => d.structuredData !== null) as TabularDocument[];
}

/**
 * Convert structured data to CSV format for Code Execution
 * Returns a map of sheet name -> CSV content
 */
export function structuredDataToCsv(doc: TabularDocument): Map<string, string> {
  const csvMap = new Map<string, string>();
  
  for (const sheet of doc.structuredData.sheets) {
    const lines: string[] = [];
    
    // Header line
    lines.push(sheet.headers.map(h => escapeCsvField(h)).join(','));
    
    // Data lines
    for (const row of sheet.rows) {
      const values = sheet.headers.map((_, i) => {
        const val = row[i];
        if (val === null || val === undefined || val === '') return '';
        return escapeCsvField(String(val));
      });
      lines.push(values.join(','));
    }
    
    csvMap.set(sheet.name, lines.join('\n'));
  }
  
  return csvMap;
}

/**
 * Escape a field for CSV format
 */
function escapeCsvField(field: string): string {
  // If field contains comma, newline, or quote, wrap in quotes and escape internal quotes
  if (field.includes(',') || field.includes('\n') || field.includes('"')) {
    return `"${field.replace(/"/g, '""')}"`;
  }
  return field;
}

/**
 * Inline data part with metadata for Code Execution
 */
export interface InlineDataPartWithMeta {
  inlineData: { mimeType: string; data: string };
  fileName: string;
  sheetName: string;
  rowCount: number;
  headers: string[];
}

/**
 * Build inline data parts for Gemini Code Execution
 * Converts structured data to base64 CSV for each sheet
 * Includes metadata so Gemini knows what each file contains
 * 
 * Limits:
 * - Individual sheet: max 15MB
 * - Cumulative total: max 12MB (to leave headroom for prompt)
 */
const MAX_INDIVIDUAL_SIZE_BYTES = 15 * 1024 * 1024; // 15MB per sheet
const MAX_CUMULATIVE_SIZE_BYTES = 12 * 1024 * 1024; // 12MB total

export function buildInlineDataParts(docs: TabularDocument[]): InlineDataPartWithMeta[] {
  const parts: InlineDataPartWithMeta[] = [];
  let cumulativeSizeBytes = 0;
  
  for (const doc of docs) {
    const csvMap = structuredDataToCsv(doc);
    
    for (const [sheetName, csvContent] of csvMap) {
      const sizeBytes = Buffer.byteLength(csvContent, 'utf-8');
      
      // Skip if individual CSV is too large
      if (sizeBytes > MAX_INDIVIDUAL_SIZE_BYTES) {
        console.log(`⚠️ [CODE EXEC] Skipping sheet "${sheetName}" - too large (${(sizeBytes / 1024 / 1024).toFixed(1)}MB > 15MB limit)`);
        continue;
      }
      
      // Skip if adding this would exceed cumulative limit
      if (cumulativeSizeBytes + sizeBytes > MAX_CUMULATIVE_SIZE_BYTES) {
        console.log(`⚠️ [CODE EXEC] Skipping sheet "${sheetName}" - would exceed cumulative limit (${((cumulativeSizeBytes + sizeBytes) / 1024 / 1024).toFixed(1)}MB > 12MB)`);
        continue;
      }
      
      // Convert to base64
      const base64Content = Buffer.from(csvContent, 'utf-8').toString('base64');
      
      // Generate a clean unique filename (docId + sheetName to avoid duplicates)
      const cleanDocName = doc.originalName.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();
      const cleanSheetName = sheetName.replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();
      const fileName = `${cleanDocName}_${cleanSheetName}.csv`;
      
      const sheet = doc.structuredData.sheets.find(s => s.name === sheetName);
      
      parts.push({
        inlineData: {
          mimeType: 'text/csv',
          data: base64Content
        },
        fileName,
        sheetName,
        rowCount: sheet?.rowCount || csvContent.split('\n').length - 1,
        headers: sheet?.headers || []
      });
      
      cumulativeSizeBytes += sizeBytes;
      console.log(`📊 [CODE EXEC] Prepared "${fileName}": ${csvContent.split('\n').length} rows, ${(sizeBytes / 1024).toFixed(1)}KB (cumulative: ${(cumulativeSizeBytes / 1024).toFixed(1)}KB)`);
    }
  }
  
  if (cumulativeSizeBytes > 0) {
    console.log(`📦 [CODE EXEC] Total payload: ${(cumulativeSizeBytes / 1024 / 1024).toFixed(2)}MB across ${parts.length} file(s)`);
  }
  
  return parts;
}

/**
 * Build a summary of available tabular data for the system prompt
 * This tells Gemini what data files are available and their structure
 */
export function buildTabularDataSummary(docs: TabularDocument[]): string {
  if (docs.length === 0) return '';
  
  const lines: string[] = [
    '\n📊 DATI TABELLARI DISPONIBILI PER CALCOLI (usa Code Execution Python con pandas):',
    ''
  ];
  
  for (const doc of docs) {
    lines.push(`📁 FILE: ${doc.title} (${doc.fileName})`);
    
    for (const sheet of doc.structuredData.sheets) {
      const isJoined = sheet.name.endsWith('_JOINED');
      const joinLabel = isJoined ? ' [DATI UNIFICATI]' : '';
      
      lines.push(`   📋 Foglio: ${sheet.name}${joinLabel}`);
      lines.push(`   📏 Dimensioni: ${sheet.rowCount} righe x ${sheet.columnCount} colonne`);
      lines.push(`   📝 Colonne: ${sheet.headers.slice(0, 10).join(', ')}${sheet.headers.length > 10 ? '...' : ''}`);
      lines.push('');
    }
  }
  
  lines.push('⚠️ IMPORTANTE: I dati sopra sono caricati come file CSV. Per calcoli precisi:');
  lines.push('1. USA Code Execution Python con pandas');
  lines.push('2. Carica i dati con: df = pd.read_csv("file.csv")');
  lines.push('3. Esegui calcoli con pandas (NON inventare numeri)');
  lines.push('');
  
  return lines.join('\n');
}

/**
 * Build instruction for Code Execution when tabular data is available
 * Uses the actual file metadata from inline parts
 */
export function buildCodeExecutionInstruction(inlineParts: InlineDataPartWithMeta[]): string {
  if (inlineParts.length === 0) return '';
  
  // Build file descriptions
  const fileDescriptions: string[] = [];
  for (const part of inlineParts) {
    const headerPreview = part.headers.slice(0, 10).join(', ');
    const moreHeaders = part.headers.length > 10 ? ` (+${part.headers.length - 10} altre)` : '';
    fileDescriptions.push(
      `📄 FILE: "${part.fileName}" (${part.rowCount} righe)\n` +
      `   Colonne: ${headerPreview}${moreHeaders}`
    );
  }
  
  return `
═══════════════════════════════════════════════════════════════════
🐍 DATI CSV ALLEGATI PER CODE EXECUTION
═══════════════════════════════════════════════════════════════════

Ti ho allegato ${inlineParts.length} file CSV come dati inline. Ecco cosa contengono:

${fileDescriptions.join('\n\n')}

📌 ISTRUZIONI OBBLIGATORIE PER CALCOLI:
1. I file CSV sono passati come dati base64 inline
2. Per leggerli, usa questo pattern ESATTO:

\`\`\`python
import pandas as pd
import io
import base64

# Il contenuto CSV ti viene passato come stringa - leggi direttamente
# Nota: pandas può leggere direttamente dalla stringa CSV
csv_data = """<CONTENUTO_CSV>"""
df = pd.read_csv(io.StringIO(csv_data))

# Ora puoi fare calcoli
totale = df['colonna'].sum()
media = df['colonna'].mean()
print(f"Totale: {totale}, Media: {media}")
\`\`\`

⚠️ REGOLE FONDAMENTALI:
- NON inventare numeri - DEVI usare Code Execution
- I dati sono GIÀ disponibili - non serve fare query o connessioni
- Mostra sempre il codice Python che usi per i calcoli
- Dopo il calcolo, mostra il risultato in modo chiaro

═══════════════════════════════════════════════════════════════════
`;
}
