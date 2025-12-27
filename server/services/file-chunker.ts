/**
 * File Chunker Service
 * Splits large XLSX/CSV files into smaller chunks for FileSearch upload
 * 
 * Token limit: ~500,000 tokens per chunk (safe margin for Gemini)
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
}

export interface ChunkingResult {
  needsChunking: boolean;
  estimatedTokens: number;
  chunks: ChunkResult[];
  originalRowCount: number;
  fileType: 'xlsx' | 'csv';
}

const MAX_TOKENS_PER_CHUNK = 200000; // Reduced from 400k for faster uploads
const CHARS_PER_TOKEN = 4;
const MAX_CHARS_PER_CHUNK = MAX_TOKENS_PER_CHUNK * CHARS_PER_TOKEN;

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
  console.log(`📊 [CHUNKER] Content size: ${content.length} chars, ~${tokens.toLocaleString()} tokens`);
  return tokens > MAX_TOKENS_PER_CHUNK;
}

/**
 * Format rows into text content with headers
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
 * Split Excel file into chunks
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
  
  if (estimatedTokens <= MAX_TOKENS_PER_CHUNK) {
    console.log(`✅ [CHUNKER] File doesn't need chunking (${estimatedTokens.toLocaleString()} tokens)`);
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
      }],
      originalRowCount: totalRows,
      fileType: 'xlsx',
    };
  }
  
  console.log(`⚠️ [CHUNKER] File needs chunking (${estimatedTokens.toLocaleString()} tokens > ${MAX_TOKENS_PER_CHUNK.toLocaleString()} limit)`);
  
  const chunks: ChunkResult[] = [];
  const rowsPerChunk = Math.ceil((MAX_CHARS_PER_CHUNK / testContent.length) * totalRows * 0.8);
  
  console.log(`📊 [CHUNKER] Estimated ~${rowsPerChunk} rows per chunk`);
  
  let globalRowIndex = 0;
  
  for (const { sheetName, headers, rows } of allData) {
    for (let i = 0; i < rows.length; i += rowsPerChunk) {
      const chunkRows = rows.slice(i, Math.min(i + rowsPerChunk, rows.length));
      const startRow = globalRowIndex + i;
      const endRow = startRow + chunkRows.length - 1;
      
      chunks.push({
        chunkIndex: chunks.length,
        totalChunks: 0,
        content: formatRowsToText(headers, chunkRows, sheetName, chunks.length, 0, startRow),
        rowsInChunk: chunkRows.length,
        startRow,
        endRow,
      });
    }
    globalRowIndex += rows.length;
  }
  
  chunks.forEach((chunk, idx) => {
    chunk.chunkIndex = idx;
    chunk.totalChunks = chunks.length;
    const lines = chunk.content.split('\n');
    lines[0] = lines[0].replace(/Parte \d+\/\d+/, `Parte ${idx + 1}/${chunks.length}`);
    chunk.content = lines.join('\n');
  });
  
  console.log(`✅ [CHUNKER] Split into ${chunks.length} chunks`);
  
  return {
    needsChunking: true,
    estimatedTokens,
    chunks,
    originalRowCount: totalRows,
    fileType: 'xlsx',
  };
}

/**
 * Split CSV file into chunks
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
  
  if (estimatedTokens <= MAX_TOKENS_PER_CHUNK) {
    console.log(`✅ [CHUNKER] CSV doesn't need chunking (${estimatedTokens.toLocaleString()} tokens)`);
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
      }],
      originalRowCount: rows.length,
      fileType: 'csv',
    };
  }
  
  console.log(`⚠️ [CHUNKER] CSV needs chunking (${estimatedTokens.toLocaleString()} tokens > ${MAX_TOKENS_PER_CHUNK.toLocaleString()} limit)`);
  
  const chunks: ChunkResult[] = [];
  const rowsPerChunk = Math.ceil((MAX_CHARS_PER_CHUNK / testContent.length) * rows.length * 0.8);
  
  console.log(`📊 [CHUNKER] Estimated ~${rowsPerChunk} rows per chunk`);
  
  for (let i = 0; i < arrayRows.length; i += rowsPerChunk) {
    const chunkRows = arrayRows.slice(i, Math.min(i + rowsPerChunk, arrayRows.length));
    
    chunks.push({
      chunkIndex: chunks.length,
      totalChunks: 0,
      content: formatRowsToText(headers, chunkRows, 'CSV Data', chunks.length, 0, i),
      rowsInChunk: chunkRows.length,
      startRow: i,
      endRow: i + chunkRows.length - 1,
    });
  }
  
  chunks.forEach((chunk, idx) => {
    chunk.chunkIndex = idx;
    chunk.totalChunks = chunks.length;
    const lines = chunk.content.split('\n');
    lines[0] = lines[0].replace(/Parte \d+\/\d+/, `Parte ${idx + 1}/${chunks.length}`);
    chunk.content = lines.join('\n');
  });
  
  console.log(`✅ [CHUNKER] Split CSV into ${chunks.length} chunks`);
  
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
    }];
  }
  
  console.log(`⚠️ [CHUNKER] Text content needs chunking (${estimatedTokens.toLocaleString()} tokens)`);
  
  const chunks: ChunkResult[] = [];
  const lines = content.split('\n');
  const linesPerChunk = Math.ceil((MAX_CHARS_PER_CHUNK / content.length) * lines.length * 0.8);
  
  for (let i = 0; i < lines.length; i += linesPerChunk) {
    const chunkLines = lines.slice(i, Math.min(i + linesPerChunk, lines.length));
    const chunkContent = `=== ${documentTitle} (Parte ${chunks.length + 1}/?) ===\n\n${chunkLines.join('\n')}`;
    
    chunks.push({
      chunkIndex: chunks.length,
      totalChunks: 0,
      content: chunkContent,
      rowsInChunk: chunkLines.length,
      startRow: i,
      endRow: i + chunkLines.length - 1,
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
