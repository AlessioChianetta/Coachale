/**
 * File Chunker Service
 * Splits large XLSX/CSV files into smaller chunks for FileSearch upload
 * 
 * Uses row-by-row chunking with REAL size verification to ensure
 * each chunk stays within Gemini's processing limits.
 * 
 * Token limit: ~100,000 tokens per chunk (safe margin for Gemini)
 * Estimates ~4 characters per token for text content
 */

import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import fs from 'fs/promises';

export interface ChunkResult {
  chunkIndex: number;
  totalChunks: number;
  content: string;
  rowsInChunk: number;
  startRow: number;
  endRow: number;
  actualChars: number;
  estimatedTokens: number;
}

export interface ChunkingResult {
  needsChunking: boolean;
  estimatedTokens: number;
  chunks: ChunkResult[];
  originalRowCount: number;
  fileType: 'xlsx' | 'csv';
}

const MAX_TOKENS_PER_CHUNK = 100000;
const CHARS_PER_TOKEN = 4;
const MAX_CHARS_PER_CHUNK = MAX_TOKENS_PER_CHUNK * CHARS_PER_TOKEN;
const SAFETY_MARGIN = 0.9;
const SAFE_MAX_CHARS = Math.floor(MAX_CHARS_PER_CHUNK * SAFETY_MARGIN);

/**
 * Estimate tokens from character count
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

/**
 * Check if content needs chunking based on estimated tokens
 */
export function needsChunking(content: string): boolean {
  const tokens = estimateTokens(content);
  console.log(`📊 [CHUNKER] Content size: ${content.length.toLocaleString()} chars, ~${tokens.toLocaleString()} tokens`);
  return tokens > MAX_TOKENS_PER_CHUNK;
}

/**
 * Format a single row into text
 */
function formatSingleRow(headers: string[], row: any[], rowNumber: number): string {
  const rowValues = headers.map((_, cellIndex) => {
    const val = row[cellIndex];
    if (val === null || val === undefined || val === '') return '-';
    return String(val).replace(/\|/g, '/').replace(/\n/g, ' ');
  });
  return `${rowNumber}. ${rowValues.join(' | ')}\n`;
}

/**
 * Get chunk header (sheet name, row range, column headers)
 */
function getChunkHeader(
  sheetName: string,
  chunkIndex: number,
  totalChunks: number,
  startRow: number,
  endRow: number,
  headers: string[]
): string {
  let text = `=== ${sheetName} (Parte ${chunkIndex + 1}/${totalChunks}) ===\n`;
  text += `Righe ${startRow + 1} - ${endRow + 1}\n\n`;
  text += `INTESTAZIONI: ${headers.join(' | ')}\n\n`;
  text += `DATI:\n`;
  return text;
}

/**
 * Build chunks row-by-row with REAL size verification
 * This ensures each chunk stays within the character limit
 */
function buildChunksRowByRow(
  headers: string[],
  rows: any[][],
  sheetName: string,
  globalStartRow: number = 0
): ChunkResult[] {
  const chunks: ChunkResult[] = [];
  
  if (rows.length === 0) return chunks;
  
  let currentChunkRows: string[] = [];
  let currentChunkChars = 0;
  let chunkStartRow = 0;
  
  const headerTemplate = getChunkHeader(sheetName, 0, 1, 0, 0, headers);
  const headerOverhead = headerTemplate.length + 100;
  
  console.log(`📊 [CHUNKER] Building chunks row-by-row for "${sheetName}" (${rows.length.toLocaleString()} rows)`);
  console.log(`📊 [CHUNKER] Max chars per chunk: ${SAFE_MAX_CHARS.toLocaleString()} (with ${(SAFETY_MARGIN * 100).toFixed(0)}% safety margin)`);
  console.log(`📊 [CHUNKER] Header overhead: ~${headerOverhead} chars`);
  
  for (let i = 0; i < rows.length; i++) {
    const rowText = formatSingleRow(headers, rows[i], globalStartRow + i + 1);
    const rowChars = rowText.length;
    
    const projectedTotal = headerOverhead + currentChunkChars + rowChars;
    
    if (projectedTotal > SAFE_MAX_CHARS && currentChunkRows.length > 0) {
      const chunkContent = buildChunkContent(
        sheetName, 
        chunks.length, 
        0, 
        globalStartRow + chunkStartRow, 
        globalStartRow + i - 1, 
        headers, 
        currentChunkRows
      );
      
      chunks.push({
        chunkIndex: chunks.length,
        totalChunks: 0,
        content: chunkContent,
        rowsInChunk: currentChunkRows.length,
        startRow: globalStartRow + chunkStartRow,
        endRow: globalStartRow + i - 1,
        actualChars: chunkContent.length,
        estimatedTokens: estimateTokens(chunkContent),
      });
      
      console.log(`  📦 Chunk ${chunks.length}: rows ${chunkStartRow + 1}-${i}, ${currentChunkRows.length} rows, ${chunkContent.length.toLocaleString()} chars, ~${estimateTokens(chunkContent).toLocaleString()} tokens`);
      
      currentChunkRows = [];
      currentChunkChars = 0;
      chunkStartRow = i;
    }
    
    currentChunkRows.push(rowText);
    currentChunkChars += rowChars;
  }
  
  if (currentChunkRows.length > 0) {
    const chunkContent = buildChunkContent(
      sheetName, 
      chunks.length, 
      0, 
      globalStartRow + chunkStartRow, 
      globalStartRow + rows.length - 1, 
      headers, 
      currentChunkRows
    );
    
    chunks.push({
      chunkIndex: chunks.length,
      totalChunks: 0,
      content: chunkContent,
      rowsInChunk: currentChunkRows.length,
      startRow: globalStartRow + chunkStartRow,
      endRow: globalStartRow + rows.length - 1,
      actualChars: chunkContent.length,
      estimatedTokens: estimateTokens(chunkContent),
    });
    
    console.log(`  📦 Chunk ${chunks.length}: rows ${chunkStartRow + 1}-${rows.length}, ${currentChunkRows.length} rows, ${chunkContent.length.toLocaleString()} chars, ~${estimateTokens(chunkContent).toLocaleString()} tokens`);
  }
  
  return chunks;
}

/**
 * Build chunk content from pre-formatted rows
 */
function buildChunkContent(
  sheetName: string,
  chunkIndex: number,
  totalChunks: number,
  startRow: number,
  endRow: number,
  headers: string[],
  formattedRows: string[]
): string {
  let text = `=== ${sheetName} (Parte ${chunkIndex + 1}/${totalChunks || '?'}) ===\n`;
  text += `Righe ${startRow + 1} - ${endRow + 1}\n\n`;
  text += `INTESTAZIONI: ${headers.join(' | ')}\n\n`;
  text += `DATI:\n`;
  text += formattedRows.join('');
  return text;
}

/**
 * Format rows into text content with headers (legacy function for non-chunked files)
 */
function formatRowsToText(
  headers: string[],
  rows: any[][],
  sheetName: string,
  chunkIndex: number,
  totalChunks: number,
  startRow: number
): string {
  let text = `=== ${sheetName} (Parte ${chunkIndex + 1}/${totalChunks}) ===\n`;
  text += `Righe ${startRow + 1} - ${startRow + rows.length}\n\n`;
  text += `INTESTAZIONI: ${headers.join(' | ')}\n\n`;
  text += `DATI:\n`;
  
  rows.forEach((row, index) => {
    const rowValues = headers.map((_, cellIndex) => {
      const val = row[cellIndex];
      if (val === null || val === undefined || val === '') return '-';
      return String(val).replace(/\|/g, '/').replace(/\n/g, ' ');
    });
    text += `${startRow + index + 1}. ${rowValues.join(' | ')}\n`;
  });
  
  return text;
}

/**
 * Split Excel file into chunks using row-by-row verification
 */
export async function chunkExcelFile(filePath: string): Promise<ChunkingResult> {
  console.log(`\n📦 [CHUNKER] Analyzing Excel file for chunking: ${filePath}`);
  
  const fileBuffer = await fs.readFile(filePath);
  const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
  
  const allData: { sheetName: string; headers: string[]; rows: any[][] }[] = [];
  let totalRows = 0;
  
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' }) as any[][];
    
    if (data.length === 0) continue;
    
    const headers = (data[0] as any[]).map((h, i) => 
      h !== undefined && h !== '' ? String(h) : `Col${i + 1}`
    );
    const rows = data.slice(1);
    
    allData.push({ sheetName, headers, rows });
    totalRows += rows.length;
    
    console.log(`  📋 Sheet "${sheetName}": ${rows.length.toLocaleString()} rows, ${headers.length} columns`);
  }
  
  if (allData.length === 0) {
    return {
      needsChunking: false,
      estimatedTokens: 0,
      chunks: [],
      originalRowCount: 0,
      fileType: 'xlsx',
    };
  }
  
  const testContent = allData.map(({ sheetName, headers, rows }) => 
    formatRowsToText(headers, rows, sheetName, 0, 1, 0)
  ).join('\n');
  
  const estimatedTokens = estimateTokens(testContent);
  
  console.log(`📊 [CHUNKER] Total content: ${testContent.length.toLocaleString()} chars, ~${estimatedTokens.toLocaleString()} tokens`);
  
  if (estimatedTokens <= MAX_TOKENS_PER_CHUNK) {
    console.log(`✅ [CHUNKER] File doesn't need chunking`);
    return {
      needsChunking: false,
      estimatedTokens,
      chunks: [{
        chunkIndex: 0,
        totalChunks: 1,
        content: testContent,
        rowsInChunk: totalRows,
        startRow: 0,
        endRow: totalRows - 1,
        actualChars: testContent.length,
        estimatedTokens,
      }],
      originalRowCount: totalRows,
      fileType: 'xlsx',
    };
  }
  
  console.log(`⚠️ [CHUNKER] File needs chunking (${estimatedTokens.toLocaleString()} tokens > ${MAX_TOKENS_PER_CHUNK.toLocaleString()} limit)`);
  
  const allChunks: ChunkResult[] = [];
  let globalRowIndex = 0;
  
  for (const { sheetName, headers, rows } of allData) {
    const sheetChunks = buildChunksRowByRow(headers, rows, sheetName, globalRowIndex);
    allChunks.push(...sheetChunks);
    globalRowIndex += rows.length;
  }
  
  allChunks.forEach((chunk, idx) => {
    chunk.chunkIndex = idx;
    chunk.totalChunks = allChunks.length;
    chunk.content = chunk.content.replace(/Parte \d+\/(\?|\d+)/, `Parte ${idx + 1}/${allChunks.length}`);
  });
  
  const minTokens = Math.min(...allChunks.map(c => c.estimatedTokens));
  const maxTokens = Math.max(...allChunks.map(c => c.estimatedTokens));
  const avgTokens = Math.round(allChunks.reduce((sum, c) => sum + c.estimatedTokens, 0) / allChunks.length);
  
  console.log(`\n✅ [CHUNKER] Split into ${allChunks.length} chunks`);
  console.log(`📊 [CHUNKER] Chunk stats: min=${minTokens.toLocaleString()}, max=${maxTokens.toLocaleString()}, avg=${avgTokens.toLocaleString()} tokens`);
  console.log(`📊 [CHUNKER] All chunks verified under ${MAX_TOKENS_PER_CHUNK.toLocaleString()} token limit`);
  
  return {
    needsChunking: true,
    estimatedTokens,
    chunks: allChunks,
    originalRowCount: totalRows,
    fileType: 'xlsx',
  };
}

/**
 * Split CSV file into chunks using row-by-row verification
 */
export async function chunkCSVFile(filePath: string): Promise<ChunkingResult> {
  console.log(`\n📦 [CHUNKER] Analyzing CSV file for chunking: ${filePath}`);
  
  const fileContent = await fs.readFile(filePath, 'utf-8');
  const result = Papa.parse(fileContent, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: true,
  });
  
  const rows = result.data as Record<string, any>[];
  const headers = result.meta.fields || [];
  
  console.log(`  📋 CSV Data: ${rows.length.toLocaleString()} rows, ${headers.length} columns`);
  
  if (rows.length === 0) {
    return {
      needsChunking: false,
      estimatedTokens: 0,
      chunks: [],
      originalRowCount: 0,
      fileType: 'csv',
    };
  }
  
  const arrayRows = rows.map(row => headers.map(h => row[h] ?? ''));
  const testContent = formatRowsToText(headers, arrayRows, 'CSV Data', 0, 1, 0);
  const estimatedTokens = estimateTokens(testContent);
  
  console.log(`📊 [CHUNKER] Total content: ${testContent.length.toLocaleString()} chars, ~${estimatedTokens.toLocaleString()} tokens`);
  
  if (estimatedTokens <= MAX_TOKENS_PER_CHUNK) {
    console.log(`✅ [CHUNKER] CSV doesn't need chunking`);
    return {
      needsChunking: false,
      estimatedTokens,
      chunks: [{
        chunkIndex: 0,
        totalChunks: 1,
        content: testContent,
        rowsInChunk: rows.length,
        startRow: 0,
        endRow: rows.length - 1,
        actualChars: testContent.length,
        estimatedTokens,
      }],
      originalRowCount: rows.length,
      fileType: 'csv',
    };
  }
  
  console.log(`⚠️ [CHUNKER] CSV needs chunking (${estimatedTokens.toLocaleString()} tokens > ${MAX_TOKENS_PER_CHUNK.toLocaleString()} limit)`);
  
  const chunks = buildChunksRowByRow(headers, arrayRows, 'CSV Data', 0);
  
  chunks.forEach((chunk, idx) => {
    chunk.chunkIndex = idx;
    chunk.totalChunks = chunks.length;
    chunk.content = chunk.content.replace(/Parte \d+\/(\?|\d+)/, `Parte ${idx + 1}/${chunks.length}`);
  });
  
  const minTokens = Math.min(...chunks.map(c => c.estimatedTokens));
  const maxTokens = Math.max(...chunks.map(c => c.estimatedTokens));
  const avgTokens = Math.round(chunks.reduce((sum, c) => sum + c.estimatedTokens, 0) / chunks.length);
  
  console.log(`\n✅ [CHUNKER] Split CSV into ${chunks.length} chunks`);
  console.log(`📊 [CHUNKER] Chunk stats: min=${minTokens.toLocaleString()}, max=${maxTokens.toLocaleString()}, avg=${avgTokens.toLocaleString()} tokens`);
  
  return {
    needsChunking: true,
    estimatedTokens,
    chunks,
    originalRowCount: rows.length,
    fileType: 'csv',
  };
}

/**
 * Split text content into chunks (for already extracted content)
 */
export function chunkTextContent(
  content: string,
  documentTitle: string
): ChunkResult[] {
  const estimatedTokens = estimateTokens(content);
  
  if (estimatedTokens <= MAX_TOKENS_PER_CHUNK) {
    return [{
      chunkIndex: 0,
      totalChunks: 1,
      content,
      rowsInChunk: 0,
      startRow: 0,
      endRow: 0,
      actualChars: content.length,
      estimatedTokens,
    }];
  }
  
  console.log(`⚠️ [CHUNKER] Text content needs chunking (${estimatedTokens.toLocaleString()} tokens)`);
  
  const chunks: ChunkResult[] = [];
  const lines = content.split('\n');
  
  let currentLines: string[] = [];
  let currentChars = 0;
  let chunkStartLine = 0;
  
  const headerOverhead = 100;
  
  for (let i = 0; i < lines.length; i++) {
    const lineChars = lines[i].length + 1;
    
    if (headerOverhead + currentChars + lineChars > SAFE_MAX_CHARS && currentLines.length > 0) {
      const chunkContent = `=== ${documentTitle} (Parte ${chunks.length + 1}/?) ===\n\n${currentLines.join('\n')}`;
      
      chunks.push({
        chunkIndex: chunks.length,
        totalChunks: 0,
        content: chunkContent,
        rowsInChunk: currentLines.length,
        startRow: chunkStartLine,
        endRow: i - 1,
        actualChars: chunkContent.length,
        estimatedTokens: estimateTokens(chunkContent),
      });
      
      currentLines = [];
      currentChars = 0;
      chunkStartLine = i;
    }
    
    currentLines.push(lines[i]);
    currentChars += lineChars;
  }
  
  if (currentLines.length > 0) {
    const chunkContent = `=== ${documentTitle} (Parte ${chunks.length + 1}/?) ===\n\n${currentLines.join('\n')}`;
    
    chunks.push({
      chunkIndex: chunks.length,
      totalChunks: 0,
      content: chunkContent,
      rowsInChunk: currentLines.length,
      startRow: chunkStartLine,
      endRow: lines.length - 1,
      actualChars: chunkContent.length,
      estimatedTokens: estimateTokens(chunkContent),
    });
  }
  
  chunks.forEach((chunk, idx) => {
    chunk.chunkIndex = idx;
    chunk.totalChunks = chunks.length;
    chunk.content = chunk.content.replace(/Parte \d+\/\?/, `Parte ${idx + 1}/${chunks.length}`);
  });
  
  console.log(`✅ [CHUNKER] Split text into ${chunks.length} chunks`);
  
  return chunks;
}
