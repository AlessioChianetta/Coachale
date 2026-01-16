/**
 * Document Processor Service
 * Extracts text from various file types for Knowledge Base
 * Supports: PDF, DOCX, TXT, MD, RTF, CSV, XLSX, XLS, PPTX, ODT
 * Audio transcription: MP3, WAV, M4A, OGG, WEBM
 * Uses Vertex AI as priority for audio transcription when credentials are available
 * 
 * Enhanced features:
 * - Automatic file type detection using magic bytes (handles misnamed files)
 * - Multiple encoding support for CSV (UTF-8, Latin-1, Windows-1252)
 * - Structured data extraction for tabular preview
 */

import fs from 'fs/promises';
import path from 'path';
import mammoth from 'mammoth';
import { PDFParse } from 'pdf-parse';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import officeparser from 'officeparser';
import { VertexAI } from '@google-cloud/vertexai';
import { GEMINI_3_MODEL } from '../ai/provider-factory';

/**
 * Structured data for tabular files (CSV/Excel)
 * Used for frontend preview and AI context
 */
export interface StructuredTableData {
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
}

/**
 * Detect real file type from magic bytes (first bytes of file)
 * This handles cases where file extension doesn't match content
 */
export async function detectRealFileType(filePath: string): Promise<'xlsx' | 'xls' | 'csv' | 'unknown'> {
  try {
    const buffer = Buffer.alloc(8);
    const fileHandle = await fs.open(filePath, 'r');
    await fileHandle.read(buffer, 0, 8, 0);
    await fileHandle.close();
    
    // ZIP signature (PK..) - XLSX files are ZIP archives
    if (buffer[0] === 0x50 && buffer[1] === 0x4B && buffer[2] === 0x03 && buffer[3] === 0x04) {
      console.log('🔍 [FILE DETECT] Detected ZIP/XLSX format from magic bytes');
      return 'xlsx';
    }
    
    // OLE2 compound document signature - XLS (old Excel)
    if (buffer[0] === 0xD0 && buffer[1] === 0xCF && buffer[2] === 0x11 && buffer[3] === 0xE0) {
      console.log('🔍 [FILE DETECT] Detected OLE2/XLS format from magic bytes');
      return 'xls';
    }
    
    // Check if it looks like text (CSV)
    const textBuffer = await fs.readFile(filePath, { encoding: null });
    const first1000 = textBuffer.slice(0, 1000);
    let textChars = 0;
    for (const byte of first1000) {
      // ASCII printable + common whitespace
      if ((byte >= 32 && byte <= 126) || byte === 9 || byte === 10 || byte === 13) {
        textChars++;
      }
    }
    
    if (textChars / first1000.length > 0.9) {
      console.log('🔍 [FILE DETECT] Detected text/CSV format from content analysis');
      return 'csv';
    }
    
    return 'unknown';
  } catch (error: any) {
    console.warn(`⚠️ [FILE DETECT] Could not detect file type: ${error.message}`);
    return 'unknown';
  }
}

/**
 * Read file with multiple encoding attempts
 * Tries UTF-8, then Latin-1 (ISO-8859-1), then Windows-1252
 */
async function readFileWithEncoding(filePath: string): Promise<string> {
  const encodings = ['utf-8', 'latin1'] as const;
  
  for (const encoding of encodings) {
    try {
      const content = await fs.readFile(filePath, { encoding: encoding as BufferEncoding });
      // Check for common encoding issues (replacement character)
      if (!content.includes('\uFFFD')) {
        console.log(`✅ [ENCODING] Successfully read file with ${encoding} encoding`);
        return content;
      }
    } catch (error: any) {
      console.warn(`⚠️ [ENCODING] Failed to read with ${encoding}: ${error.message}`);
    }
  }
  
  // Fallback: read as buffer and convert
  console.log('🔄 [ENCODING] Trying binary read with manual conversion...');
  const buffer = await fs.readFile(filePath);
  return buffer.toString('latin1');
}

export interface VertexAICredentials {
  projectId: string;
  location: string;
  credentials: {
    client_email: string;
    private_key: string;
    [key: string]: any;
  };
}

/**
 * Extract text from PDF file
 */
export async function extractTextFromPDF(filePath: string): Promise<string> {
  console.log(`📄 [PDF] Extracting text from: ${filePath}`);
  
  try {
    const dataBuffer = await fs.readFile(filePath);
    const parser = new PDFParse({ data: dataBuffer });
    const result = await parser.getText();
    
    const extractedText = result.text.trim();
    const pageCount = result.numpages;
    
    console.log(`✅ [PDF] Extracted ${extractedText.length} characters from ${pageCount} pages`);
    
    if (!extractedText || extractedText.length === 0) {
      throw new Error('PDF appears to be empty or contains only images');
    }
    
    return extractedText;
  } catch (error: any) {
    console.error(`❌ [PDF] Extraction failed:`, error.message);
    throw new Error(`Failed to extract text from PDF: ${error.message}`);
  }
}

/**
 * Extract text from DOCX file
 */
export async function extractTextFromDOCX(filePath: string): Promise<string> {
  console.log(`📄 [DOCX] Extracting text from: ${filePath}`);
  
  try {
    const result = await mammoth.extractRawText({ path: filePath });
    const extractedText = result.value.trim();
    
    console.log(`✅ [DOCX] Extracted ${extractedText.length} characters`);
    
    if (result.messages && result.messages.length > 0) {
      console.warn('⚠️ [DOCX] Warnings during extraction:', result.messages);
    }
    
    if (!extractedText || extractedText.length === 0) {
      throw new Error('DOCX appears to be empty');
    }
    
    return extractedText;
  } catch (error: any) {
    console.error(`❌ [DOCX] Extraction failed:`, error.message);
    throw new Error(`Failed to extract text from DOCX: ${error.message}`);
  }
}

/**
 * Extract text from TXT file
 */
export async function extractTextFromTXT(filePath: string): Promise<string> {
  console.log(`📄 [TXT] Reading text file: ${filePath}`);
  
  try {
    const extractedText = await fs.readFile(filePath, 'utf-8');
    
    console.log(`✅ [TXT] Read ${extractedText.length} characters`);
    
    if (!extractedText || extractedText.trim().length === 0) {
      throw new Error('TXT file is empty');
    }
    
    return extractedText.trim();
  } catch (error: any) {
    console.error(`❌ [TXT] Read failed:`, error.message);
    throw new Error(`Failed to read TXT file: ${error.message}`);
  }
}

/**
 * Extract text from Markdown file
 */
export async function extractTextFromMD(filePath: string): Promise<string> {
  console.log(`📄 [MD] Reading markdown file: ${filePath}`);
  
  try {
    const extractedText = await fs.readFile(filePath, 'utf-8');
    
    console.log(`✅ [MD] Read ${extractedText.length} characters`);
    
    if (!extractedText || extractedText.trim().length === 0) {
      throw new Error('Markdown file is empty');
    }
    
    return extractedText.trim();
  } catch (error: any) {
    console.error(`❌ [MD] Read failed:`, error.message);
    throw new Error(`Failed to read Markdown file: ${error.message}`);
  }
}

/**
 * Extract structured data from CSV file
 * Returns both text for AI and structured data for preview
 */
export async function extractStructuredDataFromCSV(filePath: string): Promise<{ text: string; structured: StructuredTableData }> {
  console.log(`📄 [CSV] Parsing CSV file with encoding detection: ${filePath}`);
  
  try {
    // Use encoding-aware reading
    const fileContent = await readFileWithEncoding(filePath);
    const result = Papa.parse(fileContent, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: true,
    });
    
    if (result.errors && result.errors.length > 0) {
      console.warn('⚠️ [CSV] Parse warnings:', result.errors.slice(0, 5));
    }
    
    const rows = result.data as Record<string, any>[];
    const headers = result.meta.fields || [];
    
    // Create structured data for frontend preview
    const structured: StructuredTableData = {
      sheets: [{
        name: 'Sheet1',
        headers: headers,
        rows: rows.map(row => headers.map(h => row[h] ?? '')),
        rowCount: rows.length,
        columnCount: headers.length,
      }],
      totalRows: rows.length,
      totalColumns: headers.length,
      fileType: 'csv',
    };
    
    // Create optimized text format for AI
    // Format: Header row + pipe-separated data rows (more compact than Row-by-Row)
    let extractedText = `=== CSV DATA ===\n`;
    extractedText += `Totale: ${rows.length} righe x ${headers.length} colonne\n\n`;
    extractedText += `INTESTAZIONI: ${headers.join(' | ')}\n\n`;
    extractedText += `DATI:\n`;
    
    rows.forEach((row, index) => {
      const rowValues = headers.map(h => {
        const val = row[h];
        if (val === null || val === undefined || val === '') return '-';
        return String(val).replace(/\|/g, '/').replace(/\n/g, ' ');
      });
      extractedText += `${index + 1}. ${rowValues.join(' | ')}\n`;
    });
    
    console.log(`✅ [CSV] Extracted ${rows.length} rows, ${headers.length} columns (${extractedText.length} chars)`);
    
    return { text: extractedText.trim(), structured };
  } catch (error: any) {
    console.error(`❌ [CSV] Parse failed:`, error.message);
    throw new Error(`Failed to parse CSV file: ${error.message}`);
  }
}

/**
 * Extract text from CSV file using papaparse (legacy wrapper)
 */
export async function extractTextFromCSV(filePath: string): Promise<string> {
  const { text } = await extractStructuredDataFromCSV(filePath);
  return text;
}

/**
 * Detect related sheets that can be JOINed (e.g., TESTATA + RIGHE)
 * Returns ALL detected relations (not just the first one)
 * Primary = fewer rows (header/testata), Related = more rows (detail/righe)
 */
interface SheetRelation {
  primarySheetName: string;
  relatedSheetName: string;
  joinColumn: string;
  primaryRowCount: number;
  relatedRowCount: number;
}

function detectAllRelatedSheets(sheets: StructuredTableData['sheets']): SheetRelation[] {
  const relations: SheetRelation[] = [];
  
  if (sheets.length < 2) {
    console.log('🔗 [JOIN] Single sheet, no join needed');
    return relations;
  }

  // Common join column patterns (case-insensitive)
  const commonJoinPatterns = [
    'numero', 'id', 'codice', 'code', 'number', 'nr', 'n.',
    'documento', 'doc', 'fattura', 'invoice', 'ordine', 'order',
    'riferimento', 'ref', 'reference', 'rif'
  ];

  // Track detail sheets already used - a detail sheet can only be in one relation
  // BUT a primary (master) sheet can participate in multiple relations
  const usedDetailSheets = new Set<string>();

  for (let i = 0; i < sheets.length; i++) {
    for (let j = i + 1; j < sheets.length; j++) {
      const sheet1 = sheets[i];
      const sheet2 = sheets[j];

      // Determine which would be detail (more rows)
      const [primary, detail] = sheet1.rowCount <= sheet2.rowCount 
        ? [sheet1, sheet2] 
        : [sheet2, sheet1];

      // Skip if detail sheet already used in another relation
      if (usedDetailSheets.has(detail.name)) continue;

      // Skip empty sheets
      if (primary.rowCount === 0 || detail.rowCount === 0) continue;

      // Find columns with same name (case-insensitive)
      const primaryHeadersLower = primary.headers.map(h => h.toLowerCase().trim());
      const detailHeadersLower = detail.headers.map(h => h.toLowerCase().trim());

      const commonColumns: string[] = [];
      for (let k = 0; k < primary.headers.length; k++) {
        const headerLower = primaryHeadersLower[k];
        const matchIndex = detailHeadersLower.indexOf(headerLower);
        if (matchIndex !== -1) {
          commonColumns.push(primary.headers[k]);
        }
      }

      if (commonColumns.length === 0) continue;

      // Sort common columns to prioritize likely join columns
      const sortedColumns = commonColumns.sort((a, b) => {
        const aLower = a.toLowerCase();
        const bLower = b.toLowerCase();
        const aScore = commonJoinPatterns.findIndex(p => aLower.includes(p));
        const bScore = commonJoinPatterns.findIndex(p => bLower.includes(p));
        if (aScore === -1 && bScore === -1) return 0;
        if (aScore === -1) return 1;
        if (bScore === -1) return -1;
        return aScore - bScore;
      });

      const joinColumn = sortedColumns[0];

      // Verify the ratio makes sense (detail should have >= rows than primary)
      if (detail.rowCount >= primary.rowCount) {
        console.log(`🔗 [JOIN] Found relation: "${primary.name}" (${primary.rowCount} rows) ↔ "${detail.name}" (${detail.rowCount} rows) via column "${joinColumn}"`);
        relations.push({
          primarySheetName: primary.name,
          relatedSheetName: detail.name,
          joinColumn,
          primaryRowCount: primary.rowCount,
          relatedRowCount: detail.rowCount
        });
        
        // Only mark detail sheet as used (primary can join with multiple details)
        usedDetailSheets.add(detail.name);
      }
    }
  }

  if (relations.length === 0) {
    console.log('🔗 [JOIN] No related sheets detected');
  } else {
    console.log(`🔗 [JOIN] Detected ${relations.length} sheet relation(s)`);
  }
  
  return relations;
}

/**
 * JOIN related sheets into a single flat table
 * Performs LEFT JOIN: all rows from related (detail) sheet, matching columns from primary (master) sheet
 */
function joinRelatedSheets(
  sheets: StructuredTableData['sheets'],
  relation: SheetRelation
): StructuredTableData['sheets'][0] {
  const primary = sheets.find(s => s.name === relation.primarySheetName)!;
  const related = sheets.find(s => s.name === relation.relatedSheetName)!;

  console.log(`🔗 [JOIN] Joining "${primary.name}" + "${related.name}" on column "${relation.joinColumn}"`);

  // Find join column indices
  const primaryJoinColIndex = primary.headers.findIndex(
    h => h.toLowerCase().trim() === relation.joinColumn.toLowerCase().trim()
  );
  const relatedJoinColIndex = related.headers.findIndex(
    h => h.toLowerCase().trim() === relation.joinColumn.toLowerCase().trim()
  );

  if (primaryJoinColIndex === -1 || relatedJoinColIndex === -1) {
    console.error('🔗 [JOIN] Join column not found, returning original sheets');
    return related; // Fallback: return detail sheet as-is
  }

  // Create lookup map from primary sheet: joinValue -> row data
  const primaryLookup = new Map<string, any[]>();
  for (const row of primary.rows) {
    const joinValue = String(row[primaryJoinColIndex] ?? '').trim();
    if (joinValue) {
      primaryLookup.set(joinValue, row);
    }
  }

  // Build merged headers: primary headers (excluding join col) + related headers
  const primaryHeadersExcludingJoin = primary.headers.filter((_, i) => i !== primaryJoinColIndex);
  const mergedHeaders = [...related.headers, ...primaryHeadersExcludingJoin];

  // Perform LEFT JOIN
  const mergedRows: any[][] = [];
  let matchedCount = 0;
  let unmatchedCount = 0;

  for (const relatedRow of related.rows) {
    const joinValue = String(relatedRow[relatedJoinColIndex] ?? '').trim();
    const primaryRow = primaryLookup.get(joinValue);

    if (primaryRow) {
      // Found match: append primary columns (excluding join column)
      const primaryValuesExcludingJoin = primaryRow.filter((_, i) => i !== primaryJoinColIndex);
      mergedRows.push([...relatedRow, ...primaryValuesExcludingJoin]);
      matchedCount++;
    } else {
      // No match: append empty values for primary columns
      const emptyPrimaryValues = primaryHeadersExcludingJoin.map(() => '');
      mergedRows.push([...relatedRow, ...emptyPrimaryValues]);
      unmatchedCount++;
    }
  }

  console.log(`✅ [JOIN] Merged ${mergedRows.length} rows (${matchedCount} matched, ${unmatchedCount} unmatched)`);
  console.log(`✅ [JOIN] Result: ${mergedHeaders.length} columns = ${related.headers.length} (detail) + ${primaryHeadersExcludingJoin.length} (master)`);

  return {
    name: `${related.name}_JOINED`,
    headers: mergedHeaders,
    rows: mergedRows,
    rowCount: mergedRows.length,
    columnCount: mergedHeaders.length
  };
}

/**
 * Extract structured data from Excel files (XLSX, XLS)
 * Returns both text for AI and structured data for preview
 * Automatically JOINs related sheets (e.g., TESTATA + RIGHE) when detected
 */
export async function extractStructuredDataFromExcel(filePath: string): Promise<{ text: string; structured: StructuredTableData }> {
  console.log(`📄 [EXCEL] Reading spreadsheet with structured extraction: ${filePath}`);
  
  try {
    // Read file as buffer and use XLSX.read() for better ES module compatibility
    const fileBuffer = await fs.readFile(filePath);
    const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
    
    // STEP 1: Read all sheets into memory FIRST (before generating text)
    const originalSheets: StructuredTableData['sheets'] = [];
    
    workbook.SheetNames.forEach((sheetName) => {
      const sheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' }) as any[][];
      
      if (data.length === 0) return;
      
      const headers = (data[0] as any[]).map((h, i) => h !== undefined && h !== '' ? String(h) : `Col${i + 1}`);
      const rows = data.slice(1);
      
      originalSheets.push({
        name: sheetName,
        headers: headers,
        rows: rows,
        rowCount: rows.length,
        columnCount: headers.length,
      });
    });

    // STEP 2: Detect and JOIN all related sheet pairs (e.g., TESTATA + RIGHE)
    let finalSheets: StructuredTableData['sheets'] = [];
    let joinApplied = false;
    const allInvolvedSheetNames = new Set<string>();

    if (originalSheets.length >= 2) {
      const relations = detectAllRelatedSheets(originalSheets);
      
      if (relations.length > 0) {
        // Perform all JOINs
        for (const relation of relations) {
          const joinedSheet = joinRelatedSheets(originalSheets, relation);
          finalSheets.push(joinedSheet);
          allInvolvedSheetNames.add(relation.primarySheetName);
          allInvolvedSheetNames.add(relation.relatedSheetName);
          console.log(`🔗 [JOIN] Applied JOIN: "${relation.primarySheetName}" + "${relation.relatedSheetName}" → "${joinedSheet.name}"`);
        }
        
        joinApplied = true;
      }
    }
    
    // Add sheets that weren't involved in any JOIN
    const uninvolvedSheets = originalSheets.filter(s => !allInvolvedSheetNames.has(s.name));
    finalSheets = [...finalSheets, ...uninvolvedSheets];
    
    // If no JOINs were performed, use original sheets
    if (finalSheets.length === 0) {
      finalSheets = originalSheets;
    }

    // STEP 3: Generate text from final sheets (after potential JOIN)
    let extractedText = '';
    let totalRows = 0;
    let maxColumns = 0;

    finalSheets.forEach((sheetData, sheetIndex) => {
      totalRows += sheetData.rowCount;
      maxColumns = Math.max(maxColumns, sheetData.columnCount);
      
      // Create text for AI - optimized pipe-separated format
      // Mark sheets that were created via JOIN (they end with "_JOINED")
      const isJoinedSheet = sheetData.name.endsWith('_JOINED');
      const joinTag = isJoinedSheet ? ' (DATI UNIFICATI - JOIN AUTOMATICO)' : '';
      extractedText += `=== FOGLIO ${sheetIndex + 1}: ${sheetData.name}${joinTag} ===\n`;
      extractedText += `Totale: ${sheetData.rowCount} righe x ${sheetData.columnCount} colonne\n\n`;
      extractedText += `INTESTAZIONI: ${sheetData.headers.join(' | ')}\n\n`;
      extractedText += `DATI:\n`;
      
      sheetData.rows.forEach((row, rowIndex) => {
        const rowValues = sheetData.headers.map((_, cellIndex) => {
          const val = row[cellIndex];
          if (val === null || val === undefined || val === '') return '-';
          return String(val).replace(/\|/g, '/').replace(/\n/g, ' ');
        });
        extractedText += `${rowIndex + 1}. ${rowValues.join(' | ')}\n`;
      });
      
      extractedText += '\n';
    });
    
    const structured: StructuredTableData = {
      sheets: finalSheets,
      totalRows,
      totalColumns: maxColumns,
      fileType: 'xlsx',
    };
    
    const joinInfo = joinApplied ? ' (with auto-JOIN)' : '';
    console.log(`✅ [EXCEL] Extracted ${finalSheets.length} sheets${joinInfo}, ${totalRows} total rows (${extractedText.length} chars)`);
    
    if (!extractedText.trim()) {
      throw new Error('Excel file appears to be empty');
    }
    
    return { text: extractedText.trim(), structured };
  } catch (error: any) {
    console.error(`❌ [EXCEL] Read failed:`, error.message);
    throw new Error(`Failed to read Excel file: ${error.message}`);
  }
}

/**
 * Extract text from Excel files (XLSX, XLS) - legacy wrapper
 */
export async function extractTextFromExcel(filePath: string): Promise<string> {
  const { text } = await extractStructuredDataFromExcel(filePath);
  return text;
}

/**
 * Extract text from PowerPoint files (PPTX) using officeparser
 */
export async function extractTextFromPPTX(filePath: string): Promise<string> {
  console.log(`📄 [PPTX] Extracting text from presentation: ${filePath}`);
  
  try {
    const extractedText = await officeparser.parseOfficeAsync(filePath);
    
    console.log(`✅ [PPTX] Extracted ${extractedText.length} characters`);
    
    if (!extractedText || extractedText.trim().length === 0) {
      throw new Error('PowerPoint file appears to be empty');
    }
    
    return extractedText.trim();
  } catch (error: any) {
    console.error(`❌ [PPTX] Extraction failed:`, error.message);
    throw new Error(`Failed to extract text from PowerPoint: ${error.message}`);
  }
}

/**
 * Extract text from RTF files using officeparser
 */
export async function extractTextFromRTF(filePath: string): Promise<string> {
  console.log(`📄 [RTF] Extracting text from: ${filePath}`);
  
  try {
    const extractedText = await officeparser.parseOfficeAsync(filePath);
    
    console.log(`✅ [RTF] Extracted ${extractedText.length} characters`);
    
    if (!extractedText || extractedText.trim().length === 0) {
      throw new Error('RTF file appears to be empty');
    }
    
    return extractedText.trim();
  } catch (error: any) {
    console.error(`❌ [RTF] Extraction failed:`, error.message);
    throw new Error(`Failed to extract text from RTF: ${error.message}`);
  }
}

/**
 * Extract text from ODT files using officeparser
 */
export async function extractTextFromODT(filePath: string): Promise<string> {
  console.log(`📄 [ODT] Extracting text from: ${filePath}`);
  
  try {
    const extractedText = await officeparser.parseOfficeAsync(filePath);
    
    console.log(`✅ [ODT] Extracted ${extractedText.length} characters`);
    
    if (!extractedText || extractedText.trim().length === 0) {
      throw new Error('ODT file appears to be empty');
    }
    
    return extractedText.trim();
  } catch (error: any) {
    console.error(`❌ [ODT] Extraction failed:`, error.message);
    throw new Error(`Failed to extract text from ODT: ${error.message}`);
  }
}

/**
 * Transcribe audio file using Vertex AI (priority) or Google AI Studio (fallback)
 * Supports: MP3, WAV, M4A, OGG, WEBM
 * Uses Vertex AI when credentials are provided, falls back to GEMINI_API_KEY otherwise
 */
export async function transcribeAudioWithGemini(
  filePath: string, 
  mimeType: string,
  vertexCredentials?: VertexAICredentials
): Promise<string> {
  console.log(`🎵 [AUDIO] Transcribing audio file: ${filePath}`);
  
  const MAX_RETRIES = 3;
  const BASE_DELAY_MS = 1000;
  
  try {
    const audioBuffer = await fs.readFile(filePath);
    const base64Audio = audioBuffer.toString('base64');
    
    const stats = await fs.stat(filePath);
    const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2);
    console.log(`📊 [AUDIO] File size: ${fileSizeMB} MB`);
    
    let finalMimeType = mimeType;
    if (mimeType.includes("opus") || mimeType === "audio/ogg; codecs=opus") {
      finalMimeType = "audio/ogg";
    } else if (mimeType === "audio/webm") {
      finalMimeType = "audio/ogg";
    } else if (!["audio/mpeg", "audio/mp3", "audio/wav", "audio/ogg", "audio/mp4"].includes(mimeType)) {
      console.warn(`⚠️ [AUDIO] Unsupported audio format: ${mimeType}, trying as audio/ogg`);
      finalMimeType = "audio/ogg";
    }
    
    const useVertexAI = !!vertexCredentials;
    console.log(`🎵 [AUDIO] Using ${useVertexAI ? 'Vertex AI' : 'Google AI Studio'} for transcription (MIME: ${finalMimeType})`);
    
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        let transcription: string;
        
        if (useVertexAI && vertexCredentials) {
          const vertexAI = new VertexAI({
            project: vertexCredentials.projectId,
            location: vertexCredentials.location,
            googleAuthOptions: {
              credentials: vertexCredentials.credentials,
            },
          });
          
          const model = vertexAI.preview.getGenerativeModel({ model: "gemini-2.5-flash-lite" });
          
          const result = await model.generateContent({
            contents: [{
              role: 'user',
              parts: [
                {
                  text: 'Please transcribe this audio file completely and accurately. Provide only the transcription text without any additional commentary or formatting. If there are multiple speakers, indicate speaker changes. If you cannot understand parts of the audio, indicate [inaudible]. Transcribe in the original language of the audio.',
                },
                {
                  inlineData: {
                    mimeType: finalMimeType,
                    data: base64Audio,
                  },
                },
              ],
            }],
          });
          
          const candidate = result.response?.candidates?.[0];
          transcription = candidate?.content?.parts?.[0]?.text?.trim() || '';
        } else {
          const apiKey = process.env.GEMINI_API_KEY;
          if (!apiKey) {
            throw new Error('GEMINI_API_KEY is not configured and no Vertex AI credentials provided');
          }
          
          const { GoogleGenAI } = await import('@google/genai');
          const genAI = new GoogleGenAI({ apiKey });
          
          const response = await genAI.models.generateContent({
            model: GEMINI_3_MODEL,
            contents: [{
              role: 'user',
              parts: [
                {
                  text: 'Please transcribe this audio file completely and accurately. Provide only the transcription text without any additional commentary or formatting. If there are multiple speakers, indicate speaker changes. If you cannot understand parts of the audio, indicate [inaudible]. Transcribe in the original language of the audio.',
                },
                {
                  inlineData: {
                    mimeType: finalMimeType,
                    data: base64Audio,
                  },
                },
              ],
            }],
          });
          
          transcription = response.text?.trim() || '';
        }
        
        console.log(`✅ [AUDIO] Transcribed ${transcription.length} characters via ${useVertexAI ? 'Vertex AI' : 'Google AI Studio'}`);
        
        if (!transcription || transcription.length === 0) {
          throw new Error('Audio transcription returned empty result');
        }
        
        return `[Audio Transcription]\n\n${transcription}`;
        
      } catch (error: any) {
        const status = error?.status || error?.response?.status || error?.code;
        const isRetryable = status === 503 || status === 429 || status === 500 || status === 'UNAVAILABLE';
        
        if (isRetryable && attempt < MAX_RETRIES) {
          const delay = BASE_DELAY_MS * Math.pow(2, attempt - 1);
          console.warn(`⚠️ [AUDIO] Transcription attempt ${attempt}/${MAX_RETRIES} failed (status: ${status}), retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        
        throw error;
      }
    }
    
    throw new Error('Max retries exceeded for audio transcription');
  } catch (error: any) {
    console.error(`❌ [AUDIO] Transcription failed:`, error.message);
    throw new Error(`Failed to transcribe audio: ${error.message}`);
  }
}

/**
 * All supported file types
 */
export type KnowledgeFileType = 
  | 'pdf' | 'docx' | 'txt' | 'md' | 'rtf' | 'odt' 
  | 'csv' | 'xlsx' | 'xls' 
  | 'pptx' 
  | 'mp3' | 'wav' | 'm4a' | 'ogg' | 'webm_audio';

/**
 * Extract text and structured data from file
 * Returns both text for AI and structured data for tabular files
 */
export async function extractTextAndStructuredData(
  filePath: string,
  mimeType: string,
  vertexCredentials?: VertexAICredentials
): Promise<{ text: string; structured?: StructuredTableData }> {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📚 [DOCUMENT PROCESSOR] Starting text extraction with auto-detection');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`📁 File: ${path.basename(filePath)}`);
  console.log(`📋 MIME Type (from browser): ${mimeType}`);
  
  try {
    await fs.access(filePath);
    const stats = await fs.stat(filePath);
    console.log(`📊 File size: ${(stats.size / 1024).toFixed(2)} KB`);
    
    const ext = path.extname(filePath).toLowerCase();
    
    // SMART DETECTION: For CSV/text files, check if they're actually Excel files
    let effectiveMimeType = mimeType;
    if (mimeType === 'text/csv' || mimeType === 'application/csv' || ext === '.csv') {
      const realType = await detectRealFileType(filePath);
      if (realType === 'xlsx' || realType === 'xls') {
        console.log(`🔄 [AUTO-DETECT] File is actually Excel (${realType}), not CSV! Switching extraction method.`);
        effectiveMimeType = realType === 'xlsx' 
          ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
          : 'application/vnd.ms-excel';
      }
    }
    
    let extractedText: string;
    let structured: StructuredTableData | undefined;
    
    // Route to appropriate extraction method based on effective MIME type
    switch (effectiveMimeType) {
      // PDF
      case 'application/pdf':
        extractedText = await extractTextFromPDF(filePath);
        break;
      
      // Word Documents
      case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
      case 'application/msword':
        extractedText = await extractTextFromDOCX(filePath);
        break;
      
      // Plain Text
      case 'text/plain':
        extractedText = await extractTextFromTXT(filePath);
        break;
      
      // Markdown
      case 'text/markdown':
      case 'text/x-markdown':
        extractedText = await extractTextFromMD(filePath);
        break;
      
      // CSV - with structured data extraction
      case 'text/csv':
      case 'application/csv': {
        const csvResult = await extractStructuredDataFromCSV(filePath);
        extractedText = csvResult.text;
        structured = csvResult.structured;
        break;
      }
      
      // Excel - with structured data extraction
      case 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
      case 'application/vnd.ms-excel': {
        const excelResult = await extractStructuredDataFromExcel(filePath);
        extractedText = excelResult.text;
        structured = excelResult.structured;
        break;
      }
      
      // PowerPoint
      case 'application/vnd.openxmlformats-officedocument.presentationml.presentation':
      case 'application/vnd.ms-powerpoint':
        extractedText = await extractTextFromPPTX(filePath);
        break;
      
      // RTF
      case 'text/rtf':
      case 'application/rtf':
        extractedText = await extractTextFromRTF(filePath);
        break;
      
      // ODT (OpenDocument Text)
      case 'application/vnd.oasis.opendocument.text':
        extractedText = await extractTextFromODT(filePath);
        break;
      
      // Audio files for transcription (uses Vertex AI when credentials provided)
      case 'audio/mpeg':
      case 'audio/mp3':
        extractedText = await transcribeAudioWithGemini(filePath, 'audio/mpeg', vertexCredentials);
        break;
      
      case 'audio/wav':
      case 'audio/wave':
      case 'audio/x-wav':
        extractedText = await transcribeAudioWithGemini(filePath, 'audio/wav', vertexCredentials);
        break;
      
      case 'audio/mp4':
      case 'audio/m4a':
      case 'audio/x-m4a':
        extractedText = await transcribeAudioWithGemini(filePath, 'audio/mp4', vertexCredentials);
        break;
      
      case 'audio/ogg':
      case 'audio/vorbis':
        extractedText = await transcribeAudioWithGemini(filePath, 'audio/ogg', vertexCredentials);
        break;
      
      case 'audio/webm':
        extractedText = await transcribeAudioWithGemini(filePath, 'audio/webm', vertexCredentials);
        break;
      
      default:
        // Fallback: try to detect by file extension with smart detection
        console.warn(`⚠️ Unknown MIME type: ${effectiveMimeType}, trying by extension: ${ext}`);
        
        // First, try smart detection for any file
        const detectedType = await detectRealFileType(filePath);
        if (detectedType === 'xlsx' || detectedType === 'xls') {
          console.log(`🔄 [AUTO-DETECT] Fallback detected Excel format`);
          const excelResult = await extractStructuredDataFromExcel(filePath);
          extractedText = excelResult.text;
          structured = excelResult.structured;
        } else if (detectedType === 'csv') {
          console.log(`🔄 [AUTO-DETECT] Fallback detected CSV format`);
          const csvResult = await extractStructuredDataFromCSV(filePath);
          extractedText = csvResult.text;
          structured = csvResult.structured;
        } else if (ext === '.pdf') {
          extractedText = await extractTextFromPDF(filePath);
        } else if (ext === '.docx' || ext === '.doc') {
          extractedText = await extractTextFromDOCX(filePath);
        } else if (ext === '.txt') {
          extractedText = await extractTextFromTXT(filePath);
        } else if (ext === '.md' || ext === '.markdown') {
          extractedText = await extractTextFromMD(filePath);
        } else if (ext === '.csv') {
          const csvResult = await extractStructuredDataFromCSV(filePath);
          extractedText = csvResult.text;
          structured = csvResult.structured;
        } else if (ext === '.xlsx' || ext === '.xls') {
          const excelResult = await extractStructuredDataFromExcel(filePath);
          extractedText = excelResult.text;
          structured = excelResult.structured;
        } else if (ext === '.pptx' || ext === '.ppt') {
          extractedText = await extractTextFromPPTX(filePath);
        } else if (ext === '.rtf') {
          extractedText = await extractTextFromRTF(filePath);
        } else if (ext === '.odt') {
          extractedText = await extractTextFromODT(filePath);
        } else if (ext === '.mp3') {
          extractedText = await transcribeAudioWithGemini(filePath, 'audio/mpeg', vertexCredentials);
        } else if (ext === '.wav') {
          extractedText = await transcribeAudioWithGemini(filePath, 'audio/wav', vertexCredentials);
        } else if (ext === '.m4a') {
          extractedText = await transcribeAudioWithGemini(filePath, 'audio/mp4', vertexCredentials);
        } else if (ext === '.ogg') {
          extractedText = await transcribeAudioWithGemini(filePath, 'audio/ogg', vertexCredentials);
        } else if (ext === '.webm') {
          extractedText = await transcribeAudioWithGemini(filePath, 'audio/webm', vertexCredentials);
        } else {
          throw new Error(`Unsupported file type: ${effectiveMimeType} (extension: ${ext})`);
        }
    }
    
    console.log('✅ [DOCUMENT PROCESSOR] Extraction successful');
    console.log(`📊 Total characters extracted: ${extractedText.length}`);
    console.log(`📊 Estimated tokens: ~${Math.ceil(extractedText.length / 4)}`);
    if (structured) {
      console.log(`📊 Structured data: ${structured.totalRows} rows x ${structured.totalColumns} columns across ${structured.sheets.length} sheet(s)`);
    }
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    return { text: extractedText, structured };
    
  } catch (error: any) {
    console.error('❌ [DOCUMENT PROCESSOR] Extraction failed');
    console.error(`   Error: ${error.message}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    throw error;
  }
}

/**
 * Extract text from file based on MIME type (legacy wrapper)
 * Supports optional Vertex AI credentials for audio transcription
 */
export async function extractTextFromFile(
  filePath: string,
  mimeType: string,
  vertexCredentials?: VertexAICredentials
): Promise<string> {
  const { text } = await extractTextAndStructuredData(filePath, mimeType, vertexCredentials);
  return text;
}

/**
 * Get file type from MIME type for database storage
 */
export function getKnowledgeItemType(mimeType: string): KnowledgeFileType {
  const ext = mimeType.split('/').pop() || '';
  
  switch (mimeType) {
    case 'application/pdf':
      return 'pdf';
    
    case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
    case 'application/msword':
      return 'docx';
    
    case 'text/plain':
      return 'txt';
    
    case 'text/markdown':
    case 'text/x-markdown':
      return 'md';
    
    case 'text/csv':
    case 'application/csv':
      return 'csv';
    
    case 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
      return 'xlsx';
    
    case 'application/vnd.ms-excel':
      return 'xls';
    
    case 'application/vnd.openxmlformats-officedocument.presentationml.presentation':
    case 'application/vnd.ms-powerpoint':
      return 'pptx';
    
    case 'text/rtf':
    case 'application/rtf':
      return 'rtf';
    
    case 'application/vnd.oasis.opendocument.text':
      return 'odt';
    
    case 'audio/mpeg':
    case 'audio/mp3':
      return 'mp3';
    
    case 'audio/wav':
    case 'audio/wave':
    case 'audio/x-wav':
      return 'wav';
    
    case 'audio/mp4':
    case 'audio/m4a':
    case 'audio/x-m4a':
      return 'm4a';
    
    case 'audio/ogg':
    case 'audio/vorbis':
      return 'ogg';
    
    case 'audio/webm':
      return 'webm_audio';
    
    default:
      throw new Error(`Unsupported MIME type: ${mimeType}`);
  }
}

/**
 * Check if a MIME type is supported for knowledge extraction
 */
export function isSupportedKnowledgeType(mimeType: string): boolean {
  const supportedTypes = [
    // Documents
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword',
    'text/plain',
    'text/markdown',
    'text/x-markdown',
    'text/rtf',
    'application/rtf',
    'application/vnd.oasis.opendocument.text',
    // Data
    'text/csv',
    'application/csv',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
    // Presentations
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.ms-powerpoint',
    // Audio
    'audio/mpeg',
    'audio/mp3',
    'audio/wav',
    'audio/wave',
    'audio/x-wav',
    'audio/mp4',
    'audio/m4a',
    'audio/x-m4a',
    'audio/ogg',
    'audio/vorbis',
    'audio/webm',
  ];
  
  return supportedTypes.includes(mimeType);
}

/**
 * Get human-readable file type label
 */
export function getFileTypeLabel(fileType: KnowledgeFileType): string {
  const labels: Record<KnowledgeFileType, string> = {
    pdf: 'PDF',
    docx: 'DOCX',
    txt: 'TXT',
    md: 'Markdown',
    rtf: 'RTF',
    odt: 'ODT',
    csv: 'CSV',
    xlsx: 'Excel',
    xls: 'Excel',
    pptx: 'PowerPoint',
    mp3: 'MP3 Audio',
    wav: 'WAV Audio',
    m4a: 'M4A Audio',
    ogg: 'OGG Audio',
    webm_audio: 'WebM Audio',
  };
  
  return labels[fileType] || fileType.toUpperCase();
}
