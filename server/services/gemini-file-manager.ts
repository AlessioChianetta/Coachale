/**
 * Gemini Files API Manager
 * 
 * Manages Gemini Files API file lifecycle:
 * - Check expiration (48h after upload)
 * - Automatic re-upload on-demand when expired
 * - Cleanup of expired references
 * 
 * Strategy:
 * - Lazy loading: re-upload happens on-demand when file is needed
 * - Local files always available for re-upload
 * - Clear logging for debugging
 */

import { db } from '../db';
import { consultantKnowledgeDocuments } from '../../shared/schema';
import { eq, and, lt, isNull } from 'drizzle-orm';
import { uploadPDFToGeminiFilesAPI } from './document-processor';
import fs from 'fs/promises';

/**
 * Check if a Gemini file has expired
 * Returns true if file is expired or no expiration date set
 */
export function isGeminiFileExpired(expiresAt: Date | null | undefined): boolean {
  if (!expiresAt) return true;
  return new Date() >= new Date(expiresAt);
}

/**
 * Ensure a document has a valid (non-expired) Gemini file URI
 * If expired, automatically re-uploads the PDF
 * 
 * @param documentId - The document ID to check
 * @returns The valid fileUri if available, or null if not a PDF
 */
export async function ensureGeminiFileValid(documentId: string): Promise<string | null> {
  try {
    console.log(`🔍 [GEMINI] Checking validity of Gemini file for document: ${documentId}`);
    
    // 1. Get document from DB
    const [document] = await db
      .select()
      .from(consultantKnowledgeDocuments)
      .where(eq(consultantKnowledgeDocuments.id, documentId))
      .limit(1);

    if (!document) {
      console.warn(`⚠️ [GEMINI] Document not found: ${documentId}`);
      return null;
    }

    // Only PDF files can be uploaded to Gemini Files API
    if (document.fileType !== 'pdf') {
      console.log(`ℹ️ [GEMINI] Document is not a PDF (${document.fileType}), skipping Gemini file check`);
      return null;
    }

    // 2. Check if geminiFileUri exists and is still valid
    if (document.geminiFileUri && !isGeminiFileExpired(document.geminiFileExpiresAt)) {
      console.log(`✅ [GEMINI] File is still valid, expires at: ${document.geminiFileExpiresAt?.toISOString()}`);
      return document.geminiFileUri;
    }

    // 3. File is either missing or expired - need to re-upload
    if (!document.filePath) {
      console.error(`❌ [GEMINI] Cannot re-upload: local file path not found for document ${documentId}`);
      return null;
    }

    // Check if local file still exists
    try {
      await fs.stat(document.filePath);
    } catch (error) {
      console.error(`❌ [GEMINI] Cannot re-upload: local file not found at ${document.filePath}`);
      return null;
    }

    console.log(`🔄 [GEMINI] File expired, re-uploading...`);

    // 4. Re-upload PDF to Gemini Files API
    try {
      const uploadResult = await uploadPDFToGeminiFilesAPI(
        document.filePath,
        document.fileName
      );

      // 5. Update DB with new URI and expiration
      await db
        .update(consultantKnowledgeDocuments)
        .set({
          geminiFileUri: uploadResult.fileUri,
          geminiFileExpiresAt: uploadResult.expiresAt,
          updatedAt: new Date(),
        })
        .where(eq(consultantKnowledgeDocuments.id, documentId));

      console.log(`✅ [GEMINI] Re-uploaded successfully. New URI: ${uploadResult.fileUri}`);
      console.log(`📅 [GEMINI] New expiration: ${uploadResult.expiresAt.toISOString()}`);

      return uploadResult.fileUri;
    } catch (uploadError: any) {
      console.error(`❌ [GEMINI] Re-upload failed: ${uploadError.message}`);
      return null;
    }
  } catch (error: any) {
    console.error(`❌ [GEMINI] Error ensuring file validity: ${error.message}`);
    return null;
  }
}

/**
 * Cleanup expired Gemini file references
 * Sets geminiFileUri and geminiFileExpiresAt to NULL for expired files
 * 
 * This saves space and makes it clear that files need re-upload on next use
 * 
 * @returns Number of documents cleaned up
 */
export async function cleanupExpiredGeminiReferences(): Promise<number> {
  try {
    console.log(`🧹 [GEMINI] Starting cleanup of expired Gemini file references...`);

    const now = new Date();

    // Find all documents with expired Gemini files
    const expiredDocuments = await db
      .select({ id: consultantKnowledgeDocuments.id })
      .from(consultantKnowledgeDocuments)
      .where(
        and(
          isNull(consultantKnowledgeDocuments.geminiFileUri).not(),
          lt(consultantKnowledgeDocuments.geminiFileExpiresAt, now)
        )
      );

    if (expiredDocuments.length === 0) {
      console.log(`✅ [GEMINI] No expired files to clean up`);
      return 0;
    }

    // Clear the expired references
    const result = await db
      .update(consultantKnowledgeDocuments)
      .set({
        geminiFileUri: null,
        geminiFileExpiresAt: null,
        updatedAt: new Date(),
      })
      .where(
        and(
          isNull(consultantKnowledgeDocuments.geminiFileUri).not(),
          lt(consultantKnowledgeDocuments.geminiFileExpiresAt, now)
        )
      );

    const cleanedCount = expiredDocuments.length;
    console.log(`✅ [GEMINI] Cleaned up ${cleanedCount} expired Gemini file references`);

    return cleanedCount;
  } catch (error: any) {
    console.error(`❌ [GEMINI] Cleanup failed: ${error.message}`);
    return 0;
  }
}

/**
 * Optional: Schedule regular cleanup of expired references
 * Can be called by a cron job or scheduler
 */
export async function scheduleCleanupTask(): Promise<void> {
  // Run cleanup every 24 hours
  const CLEANUP_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours

  setInterval(async () => {
    try {
      await cleanupExpiredGeminiReferences();
    } catch (error: any) {
      console.error(`❌ [GEMINI] Scheduled cleanup failed: ${error.message}`);
    }
  }, CLEANUP_INTERVAL);

  console.log(`⏰ [GEMINI] Scheduled cleanup task started (runs every 24 hours)`);
}
