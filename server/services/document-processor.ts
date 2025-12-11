/**
 * Document Processor Service
 * Extracts text from various file types for Knowledge Base
 * Supports: PDF, DOCX, TXT, MD, RTF, CSV, XLSX, XLS, PPTX, ODT
 * Audio transcription: MP3, WAV, M4A, OGG, WEBM
 */

import fs from 'fs/promises';
import path from 'path';
import mammoth from 'mammoth';
import { PDFParse } from 'pdf-parse';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import officeparser from 'officeparser';

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
 * Extract text from CSV file using papaparse
 */
export async function extractTextFromCSV(filePath: string): Promise<string> {
  console.log(`📄 [CSV] Parsing CSV file: ${filePath}`);
  
  try {
    const fileContent = await fs.readFile(filePath, 'utf-8');
    const result = Papa.parse(fileContent, {
      header: true,
      skipEmptyLines: true,
    });
    
    if (result.errors && result.errors.length > 0) {
      console.warn('⚠️ [CSV] Parse warnings:', result.errors);
    }
    
    // Convert CSV data to readable text
    const rows = result.data as Record<string, any>[];
    const headers = result.meta.fields || [];
    
    let extractedText = `CSV Data (${rows.length} rows, ${headers.length} columns)\n`;
    extractedText += `Columns: ${headers.join(', ')}\n\n`;
    
    // Add row data
    rows.forEach((row, index) => {
      extractedText += `Row ${index + 1}:\n`;
      headers.forEach(header => {
        if (row[header] !== undefined && row[header] !== '') {
          extractedText += `  ${header}: ${row[header]}\n`;
        }
      });
      extractedText += '\n';
    });
    
    console.log(`✅ [CSV] Extracted ${rows.length} rows, ${headers.length} columns`);
    
    return extractedText.trim();
  } catch (error: any) {
    console.error(`❌ [CSV] Parse failed:`, error.message);
    throw new Error(`Failed to parse CSV file: ${error.message}`);
  }
}

/**
 * Extract text from Excel files (XLSX, XLS)
 */
export async function extractTextFromExcel(filePath: string): Promise<string> {
  console.log(`📄 [EXCEL] Reading spreadsheet: ${filePath}`);
  
  try {
    const workbook = XLSX.readFile(filePath);
    let extractedText = '';
    
    workbook.SheetNames.forEach((sheetName, sheetIndex) => {
      const sheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];
      
      extractedText += `=== Sheet ${sheetIndex + 1}: ${sheetName} ===\n\n`;
      
      if (data.length > 0) {
        const headers = data[0] as string[];
        extractedText += `Columns: ${headers.filter(h => h).join(', ')}\n\n`;
        
        data.slice(1).forEach((row, rowIndex) => {
          const rowData = row.map((cell, cellIndex) => {
            const header = headers[cellIndex] || `Col${cellIndex + 1}`;
            return cell !== undefined && cell !== '' ? `${header}: ${cell}` : null;
          }).filter(Boolean);
          
          if (rowData.length > 0) {
            extractedText += `Row ${rowIndex + 1}: ${rowData.join(', ')}\n`;
          }
        });
      }
      
      extractedText += '\n';
    });
    
    console.log(`✅ [EXCEL] Extracted ${workbook.SheetNames.length} sheets`);
    
    if (!extractedText.trim()) {
      throw new Error('Excel file appears to be empty');
    }
    
    return extractedText.trim();
  } catch (error: any) {
    console.error(`❌ [EXCEL] Read failed:`, error.message);
    throw new Error(`Failed to read Excel file: ${error.message}`);
  }
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
 * Transcribe audio file using Gemini API
 * Supports: MP3, WAV, M4A, OGG, WEBM
 */
export async function transcribeAudioWithGemini(filePath: string, mimeType: string): Promise<string> {
  console.log(`🎵 [AUDIO] Transcribing audio file: ${filePath}`);
  
  try {
    const { GoogleGenAI } = await import('@google/genai');
    
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY is not configured');
    }
    
    const genAI = new GoogleGenAI({ apiKey });
    
    // Read the audio file
    const audioBuffer = await fs.readFile(filePath);
    const base64Audio = audioBuffer.toString('base64');
    
    // Get file stats for logging
    const stats = await fs.stat(filePath);
    const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2);
    console.log(`📊 [AUDIO] File size: ${fileSizeMB} MB`);
    
    // Use Gemini to transcribe
    const model = genAI.models.get('gemini-2.0-flash');
    
    const response = await model.generateContent({
      contents: [{
        role: 'user',
        parts: [
          {
            inlineData: {
              mimeType: mimeType,
              data: base64Audio,
            },
          },
          {
            text: 'Please transcribe this audio file completely and accurately. Provide only the transcription text without any additional commentary or formatting. If there are multiple speakers, indicate speaker changes. If you cannot understand parts of the audio, indicate [inaudible]. Transcribe in the original language of the audio.',
          },
        ],
      }],
    });
    
    const transcription = response.text?.trim() || '';
    
    console.log(`✅ [AUDIO] Transcribed ${transcription.length} characters`);
    
    if (!transcription || transcription.length === 0) {
      throw new Error('Audio transcription returned empty result');
    }
    
    return `[Audio Transcription]\n\n${transcription}`;
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
 * Extract text from file based on MIME type
 */
export async function extractTextFromFile(
  filePath: string,
  mimeType: string
): Promise<string> {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📚 [DOCUMENT PROCESSOR] Starting text extraction');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`📁 File: ${path.basename(filePath)}`);
  console.log(`📋 MIME Type: ${mimeType}`);
  
  try {
    await fs.access(filePath);
    const stats = await fs.stat(filePath);
    console.log(`📊 File size: ${(stats.size / 1024).toFixed(2)} KB`);
    
    let extractedText: string;
    const ext = path.extname(filePath).toLowerCase();
    
    // Route to appropriate extraction method based on MIME type
    switch (mimeType) {
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
      
      // CSV
      case 'text/csv':
      case 'application/csv':
        extractedText = await extractTextFromCSV(filePath);
        break;
      
      // Excel
      case 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
      case 'application/vnd.ms-excel':
        extractedText = await extractTextFromExcel(filePath);
        break;
      
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
      
      // Audio files for transcription
      case 'audio/mpeg':
      case 'audio/mp3':
        extractedText = await transcribeAudioWithGemini(filePath, 'audio/mpeg');
        break;
      
      case 'audio/wav':
      case 'audio/wave':
      case 'audio/x-wav':
        extractedText = await transcribeAudioWithGemini(filePath, 'audio/wav');
        break;
      
      case 'audio/mp4':
      case 'audio/m4a':
      case 'audio/x-m4a':
        extractedText = await transcribeAudioWithGemini(filePath, 'audio/mp4');
        break;
      
      case 'audio/ogg':
      case 'audio/vorbis':
        extractedText = await transcribeAudioWithGemini(filePath, 'audio/ogg');
        break;
      
      case 'audio/webm':
        extractedText = await transcribeAudioWithGemini(filePath, 'audio/webm');
        break;
      
      default:
        // Fallback: try to detect by file extension
        console.warn(`⚠️ Unknown MIME type: ${mimeType}, trying by extension: ${ext}`);
        
        if (ext === '.pdf') {
          extractedText = await extractTextFromPDF(filePath);
        } else if (ext === '.docx' || ext === '.doc') {
          extractedText = await extractTextFromDOCX(filePath);
        } else if (ext === '.txt') {
          extractedText = await extractTextFromTXT(filePath);
        } else if (ext === '.md' || ext === '.markdown') {
          extractedText = await extractTextFromMD(filePath);
        } else if (ext === '.csv') {
          extractedText = await extractTextFromCSV(filePath);
        } else if (ext === '.xlsx' || ext === '.xls') {
          extractedText = await extractTextFromExcel(filePath);
        } else if (ext === '.pptx' || ext === '.ppt') {
          extractedText = await extractTextFromPPTX(filePath);
        } else if (ext === '.rtf') {
          extractedText = await extractTextFromRTF(filePath);
        } else if (ext === '.odt') {
          extractedText = await extractTextFromODT(filePath);
        } else if (ext === '.mp3') {
          extractedText = await transcribeAudioWithGemini(filePath, 'audio/mpeg');
        } else if (ext === '.wav') {
          extractedText = await transcribeAudioWithGemini(filePath, 'audio/wav');
        } else if (ext === '.m4a') {
          extractedText = await transcribeAudioWithGemini(filePath, 'audio/mp4');
        } else if (ext === '.ogg') {
          extractedText = await transcribeAudioWithGemini(filePath, 'audio/ogg');
        } else if (ext === '.webm') {
          extractedText = await transcribeAudioWithGemini(filePath, 'audio/webm');
        } else {
          throw new Error(`Unsupported file type: ${mimeType} (extension: ${ext})`);
        }
    }
    
    console.log('✅ [DOCUMENT PROCESSOR] Extraction successful');
    console.log(`📊 Total characters extracted: ${extractedText.length}`);
    console.log(`📊 Estimated tokens: ~${Math.ceil(extractedText.length / 4)}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    return extractedText;
    
  } catch (error: any) {
    console.error('❌ [DOCUMENT PROCESSOR] Extraction failed');
    console.error(`   Error: ${error.message}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    throw error;
  }
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
