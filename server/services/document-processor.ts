/**
 * Document Processor Service
 * Extracts text from PDF, DOCX, and TXT files for Knowledge Base
 */

import fs from 'fs/promises';
import path from 'path';
import mammoth from 'mammoth';
import { PDFParse } from 'pdf-parse';

/**
 * Extract text from PDF file
 * Uses pdf-parse library (v2.x) to extract all text content from PDF
 */
export async function extractTextFromPDF(filePath: string): Promise<string> {
  console.log(`📄 [PDF] Extracting text from: ${filePath}`);
  
  try {
    const dataBuffer = await fs.readFile(filePath);
    
    // Use PDFParse class (v2.x API)
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
 * Uses mammoth library to convert DOCX to plain text
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
 * Simple file read with UTF-8 encoding
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
 * Extract text from file based on MIME type
 * Orchestrator function that calls the appropriate extraction method
 * 
 * @param filePath - Full path to the file
 * @param mimeType - MIME type of the file (e.g., 'application/pdf')
 * @returns Extracted text content
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
    // Verify file exists
    await fs.access(filePath);
    const stats = await fs.stat(filePath);
    console.log(`📊 File size: ${(stats.size / 1024).toFixed(2)} KB`);
    
    let extractedText: string;
    
    // Route to appropriate extraction method based on MIME type
    switch (mimeType) {
      case 'application/pdf':
        extractedText = await extractTextFromPDF(filePath);
        break;
      
      case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
      case 'application/msword':
        extractedText = await extractTextFromDOCX(filePath);
        break;
      
      case 'text/plain':
        extractedText = await extractTextFromTXT(filePath);
        break;
      
      default:
        // Try to detect by file extension as fallback
        const ext = path.extname(filePath).toLowerCase();
        console.warn(`⚠️ Unknown MIME type: ${mimeType}, trying by extension: ${ext}`);
        
        if (ext === '.pdf') {
          extractedText = await extractTextFromPDF(filePath);
        } else if (ext === '.docx' || ext === '.doc') {
          extractedText = await extractTextFromDOCX(filePath);
        } else if (ext === '.txt') {
          extractedText = await extractTextFromTXT(filePath);
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
 * Get file type from MIME type
 * Maps MIME type to our knowledge item type enum
 */
export function getKnowledgeItemType(mimeType: string): 'pdf' | 'docx' | 'txt' {
  switch (mimeType) {
    case 'application/pdf':
      return 'pdf';
    
    case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
    case 'application/msword':
      return 'docx';
    
    case 'text/plain':
      return 'txt';
    
    default:
      throw new Error(`Unsupported MIME type: ${mimeType}`);
  }
}
