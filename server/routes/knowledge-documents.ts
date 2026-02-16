import { Router, Request, Response } from "express";
import { authenticateToken, requireRole, type AuthRequest } from "../middleware/auth";
import { upload } from "../middleware/upload";
import { db } from "../db";
import {
  consultantKnowledgeDocuments,
  consultantKnowledgeApis,
  updateConsultantKnowledgeDocumentSchema,
  vertexAiSettings,
  fileSearchStores,
  knowledgeDocumentFolders,
  documentSyncHistory,
} from "../../shared/schema";
import { eq, and, desc, lt, gt, or, ilike, sql, count, isNull, inArray, asc } from "drizzle-orm";
import { z } from "zod";
import { extractTextFromFile, extractTextFromPDFWithFallback, type VertexAICredentials } from "../services/document-processor";
import { parseServiceAccountJson } from "../ai/provider-factory";
import { fileSearchSyncService, FileSearchSyncService, syncProgressEmitter, type DocumentProgressEvent } from "../services/file-search-sync-service";
import { FileSearchService } from "../ai/file-search-service";
import { ensureGeminiFileValid } from "../services/gemini-file-manager";
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";

const fileSearchService = new FileSearchService();

const documentSseTokenStore = new Map<string, { consultantId: string; documentId: string; expiresAt: number }>();

setInterval(() => {
  const now = Date.now();
  for (const [token, data] of documentSseTokenStore.entries()) {
    if (data.expiresAt < now) {
      documentSseTokenStore.delete(token);
    }
  }
}, 60000);

const router = Router();

const KNOWLEDGE_UPLOAD_DIR = "uploads/knowledge";
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

const ALLOWED_MIME_TYPES: Record<string, "pdf" | "docx" | "txt" | "md" | "rtf" | "odt" | "csv" | "xlsx" | "xls" | "pptx" | "ppt" | "mp3" | "wav" | "m4a" | "ogg" | "webm_audio"> = {
  "application/pdf": "pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/msword": "docx",
  "text/plain": "txt",
  "text/markdown": "md",
  "text/x-markdown": "md",
  "text/rtf": "rtf",
  "application/rtf": "rtf",
  "application/vnd.oasis.opendocument.text": "odt",
  "text/csv": "csv",
  "application/csv": "csv",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "application/vnd.ms-excel": "xls",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
  "application/vnd.ms-powerpoint": "ppt",
  "audio/mpeg": "mp3",
  "audio/mp3": "mp3",
  "audio/wav": "wav",
  "audio/wave": "wav",
  "audio/x-wav": "wav",
  "audio/mp4": "m4a",
  "audio/m4a": "m4a",
  "audio/x-m4a": "m4a",
  "audio/ogg": "ogg",
  "audio/vorbis": "ogg",
  "audio/webm": "webm_audio",
};

async function ensureUploadDir() {
  const dir = path.join(process.cwd(), KNOWLEDGE_UPLOAD_DIR);
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

router.get(
  "/consultant/knowledge/documents",
  authenticateToken,
  requireRole("consultant"),
  async (req: AuthRequest, res) => {
    try {
      const consultantId = req.user!.id;
      const { cursor, limit: limitParam, folderId, search, category, status } = req.query;
      
      const limit = Math.min(Math.max(parseInt(limitParam as string) || 50, 1), 100);
      
      const conditions: any[] = [eq(consultantKnowledgeDocuments.consultantId, consultantId)];
      
      if (folderId !== undefined) {
        if (folderId === '' || folderId === 'null' || folderId === 'root') {
          conditions.push(isNull(consultantKnowledgeDocuments.folderId));
        } else {
          conditions.push(eq(consultantKnowledgeDocuments.folderId, folderId as string));
        }
      }
      
      if (search && typeof search === 'string' && search.trim()) {
        const searchTerm = `%${search.trim().toLowerCase()}%`;
        conditions.push(
          or(
            ilike(consultantKnowledgeDocuments.title, searchTerm),
            ilike(consultantKnowledgeDocuments.description, searchTerm),
            ilike(consultantKnowledgeDocuments.fileName, searchTerm)
          )
        );
      }
      
      if (category && typeof category === 'string' && category.trim()) {
        conditions.push(eq(consultantKnowledgeDocuments.category, category.trim()));
      }
      
      if (status && typeof status === 'string' && status.trim()) {
        conditions.push(eq(consultantKnowledgeDocuments.status, status.trim() as any));
      }
      
      if (cursor && typeof cursor === 'string') {
        try {
          const [cursorDate, cursorId] = cursor.split('_');
          const cursorTimestamp = new Date(cursorDate);
          conditions.push(
            or(
              lt(consultantKnowledgeDocuments.createdAt, cursorTimestamp),
              and(
                eq(consultantKnowledgeDocuments.createdAt, cursorTimestamp),
                lt(consultantKnowledgeDocuments.id, cursorId)
              )
            )
          );
        } catch (e) {
          console.warn("[KNOWLEDGE DOCUMENTS] Invalid cursor format:", cursor);
        }
      }

      const [totalCountResult] = await db
        .select({ count: count() })
        .from(consultantKnowledgeDocuments)
        .where(and(...conditions.slice(0, cursor ? conditions.length - 1 : conditions.length)));
      
      const totalCount = totalCountResult?.count || 0;

      const documents = await db
        .select({
          id: consultantKnowledgeDocuments.id,
          consultantId: consultantKnowledgeDocuments.consultantId,
          title: consultantKnowledgeDocuments.title,
          description: consultantKnowledgeDocuments.description,
          category: consultantKnowledgeDocuments.category,
          fileName: consultantKnowledgeDocuments.fileName,
          fileType: consultantKnowledgeDocuments.fileType,
          fileSize: consultantKnowledgeDocuments.fileSize,
          filePath: consultantKnowledgeDocuments.filePath,
          folderId: consultantKnowledgeDocuments.folderId,
          contentSummary: consultantKnowledgeDocuments.contentSummary,
          summaryEnabled: consultantKnowledgeDocuments.summaryEnabled,
          keywords: consultantKnowledgeDocuments.keywords,
          tags: consultantKnowledgeDocuments.tags,
          version: consultantKnowledgeDocuments.version,
          priority: consultantKnowledgeDocuments.priority,
          status: consultantKnowledgeDocuments.status,
          errorMessage: consultantKnowledgeDocuments.errorMessage,
          usageCount: consultantKnowledgeDocuments.usageCount,
          lastUsedAt: consultantKnowledgeDocuments.lastUsedAt,
          createdAt: consultantKnowledgeDocuments.createdAt,
          updatedAt: consultantKnowledgeDocuments.updatedAt,
          fileSearchSyncedAt: consultantKnowledgeDocuments.fileSearchSyncedAt,
          syncProgress: consultantKnowledgeDocuments.syncProgress,
          syncCurrentChunk: consultantKnowledgeDocuments.syncCurrentChunk,
          syncTotalChunks: consultantKnowledgeDocuments.syncTotalChunks,
          syncMessage: consultantKnowledgeDocuments.syncMessage,
          googleDriveFileId: consultantKnowledgeDocuments.googleDriveFileId,
          syncCount: consultantKnowledgeDocuments.syncCount,
          lastDriveSyncAt: consultantKnowledgeDocuments.lastDriveSyncAt,
          pendingSyncAt: consultantKnowledgeDocuments.pendingSyncAt,
        })
        .from(consultantKnowledgeDocuments)
        .where(and(...conditions))
        .orderBy(desc(consultantKnowledgeDocuments.createdAt), desc(consultantKnowledgeDocuments.id))
        .limit(limit + 1);

      const hasMore = documents.length > limit;
      const data = hasMore ? documents.slice(0, limit) : documents;
      
      let nextCursor: string | null = null;
      if (hasMore && data.length > 0) {
        const lastDoc = data[data.length - 1];
        nextCursor = `${lastDoc.createdAt!.toISOString()}_${lastDoc.id}`;
      }

      res.json({
        success: true,
        data,
        nextCursor,
        hasMore,
        totalCount,
      });
    } catch (error: any) {
      console.error("❌ [KNOWLEDGE DOCUMENTS] Error listing documents:", error);
      res.status(500).json({
        success: false,
        error: error.message || "Failed to list knowledge documents",
      });
    }
  }
);

router.get(
  "/consultant/knowledge/documents/:id",
  authenticateToken,
  requireRole("consultant"),
  async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const consultantId = req.user!.id;

      const [document] = await db
        .select()
        .from(consultantKnowledgeDocuments)
        .where(
          and(
            eq(consultantKnowledgeDocuments.id, id),
            eq(consultantKnowledgeDocuments.consultantId, consultantId)
          )
        )
        .limit(1);

      if (!document) {
        return res.status(404).json({
          success: false,
          error: "Document not found",
        });
      }

      // Check and re-upload Gemini file if expired (async, doesn't block response)
      if (document.geminiFileUri && document.fileType === 'pdf') {
        ensureGeminiFileValid(id).catch((error: any) => {
          console.warn(`⚠️ [GEMINI] Failed to ensure Gemini file validity in background: ${error.message}`);
        });
      }

      res.json({
        success: true,
        data: document,
      });
    } catch (error: any) {
      console.error("❌ [KNOWLEDGE DOCUMENTS] Error fetching document:", error);
      res.status(500).json({
        success: false,
        error: error.message || "Failed to fetch knowledge document",
      });
    }
  }
);

router.get(
  "/consultant/knowledge/documents/:id/sync-history",
  authenticateToken,
  requireRole("consultant"),
  async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const consultantId = req.user!.id;

      const [document] = await db
        .select({ id: consultantKnowledgeDocuments.id })
        .from(consultantKnowledgeDocuments)
        .where(
          and(
            eq(consultantKnowledgeDocuments.id, id),
            eq(consultantKnowledgeDocuments.consultantId, consultantId)
          )
        )
        .limit(1);

      if (!document) {
        return res.status(404).json({
          success: false,
          error: "Document not found",
        });
      }

      const history = await db
        .select({
          id: documentSyncHistory.id,
          syncType: documentSyncHistory.syncType,
          status: documentSyncHistory.status,
          charactersExtracted: documentSyncHistory.charactersExtracted,
          estimatedTokens: documentSyncHistory.estimatedTokens,
          errorMessage: documentSyncHistory.errorMessage,
          durationMs: documentSyncHistory.durationMs,
          startedAt: documentSyncHistory.startedAt,
          completedAt: documentSyncHistory.completedAt,
          createdAt: documentSyncHistory.createdAt,
        })
        .from(documentSyncHistory)
        .where(eq(documentSyncHistory.documentId, id))
        .orderBy(desc(documentSyncHistory.createdAt))
        .limit(50);

      res.json({
        success: true,
        data: history,
      });
    } catch (error: any) {
      console.error("❌ [KNOWLEDGE DOCUMENTS] Error fetching sync history:", error);
      res.status(500).json({
        success: false,
        error: error.message || "Failed to fetch sync history",
      });
    }
  }
);

router.post(
  "/consultant/knowledge/documents/:id/drive-sync",
  authenticateToken,
  requireRole("consultant"),
  async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const consultantId = req.user!.id;

      const [document] = await db
        .select()
        .from(consultantKnowledgeDocuments)
        .where(
          and(
            eq(consultantKnowledgeDocuments.id, id),
            eq(consultantKnowledgeDocuments.consultantId, consultantId)
          )
        )
        .limit(1);

      if (!document) {
        return res.status(404).json({ success: false, error: "Document not found" });
      }

      if (!document.googleDriveFileId) {
        return res.status(400).json({ success: false, error: "Document is not linked to Google Drive" });
      }

      console.log(`🔄 [KNOWLEDGE DOCUMENTS] Manual drive sync requested for document ${id} (${document.title})`);
      
      const { syncDocumentFromDrive, registerDriveWatch } = await import('../services/google-drive-sync-service');
      
      res.json({ success: true, message: "Sync started" });

      (async () => {
        try {
          console.log(`🔄 [KNOWLEDGE DOCUMENTS] Starting syncDocumentFromDrive for ${id}...`);
          const success = await syncDocumentFromDrive(id, 'manual');
          if (success) {
            console.log(`✅ [KNOWLEDGE DOCUMENTS] Manual drive sync completed for document ${id}`);
          } else {
            console.error(`❌ [KNOWLEDGE DOCUMENTS] syncDocumentFromDrive returned false for ${id}`);
          }
          
          const { driveSyncChannels } = await import('../../shared/schema');
          const existingActiveChannels = await db
            .select()
            .from(driveSyncChannels)
            .where(and(
              eq(driveSyncChannels.documentId, id),
              eq(driveSyncChannels.syncStatus, 'active')
            ))
            .limit(1);
          
          if (existingActiveChannels.length === 0) {
            console.log(`🔔 [KNOWLEDGE DOCUMENTS] Re-registering watch channel for document ${id}`);
            await registerDriveWatch(consultantId, id, document.googleDriveFileId!, 'knowledge');
          }
        } catch (err: any) {
          console.error(`❌ [KNOWLEDGE DOCUMENTS] Manual drive sync failed for ${id}:`, err.message);
          console.error(err.stack);
        }
      })();
    } catch (error: any) {
      console.error("❌ [KNOWLEDGE DOCUMENTS] Error triggering drive sync:", error);
      res.status(500).json({ success: false, error: error.message || "Failed to sync" });
    }
  }
);

router.post(
  "/consultant/knowledge/documents",
  authenticateToken,
  requireRole("consultant"),
  upload.single("file"),
  async (req: AuthRequest, res) => {
    let uploadedFilePath: string | null = null;
    let finalFilePath: string | null = null;

    try {
      const consultantId = req.user!.id;
      const file = req.file;

      if (!file) {
        return res.status(400).json({
          success: false,
          error: "File is required",
        });
      }

      uploadedFilePath = file.path;

      if (file.size > MAX_FILE_SIZE) {
        await fs.unlink(uploadedFilePath).catch(() => {});
        return res.status(400).json({
          success: false,
          error: `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB`,
        });
      }

      const fileType = ALLOWED_MIME_TYPES[file.mimetype];
      if (!fileType) {
        await fs.unlink(uploadedFilePath).catch(() => {});
        return res.status(400).json({
          success: false,
          error: "Invalid file type. Allowed types: PDF, DOCX, TXT, MD, RTF, CSV, XLSX, XLS, PPTX, Audio (MP3, WAV, M4A, OGG)",
        });
      }

      const { title, description, category, priority } = req.body;

      if (!title || title.trim().length === 0) {
        await fs.unlink(uploadedFilePath).catch(() => {});
        return res.status(400).json({
          success: false,
          error: "Title is required",
        });
      }

      const uploadDir = await ensureUploadDir();
      const uniqueFileName = `${crypto.randomUUID()}${path.extname(file.originalname)}`;
      finalFilePath = path.join(uploadDir, uniqueFileName);

      await fs.copyFile(uploadedFilePath, finalFilePath);
      await fs.unlink(uploadedFilePath).catch(() => {});
      uploadedFilePath = null;

      const documentId = crypto.randomUUID();
      const [newDocument] = await db
        .insert(consultantKnowledgeDocuments)
        .values({
          id: documentId,
          consultantId,
          title: title.trim(),
          description: description?.trim() || null,
          category: category || "other",
          fileName: file.originalname,
          fileType,
          fileSize: file.size,
          filePath: finalFilePath,
          priority: priority ? parseInt(priority, 10) : 5,
          status: "processing",
        })
        .returning();

      console.log(`📄 [KNOWLEDGE DOCUMENTS] Created document: "${title}" (status: processing)`);

      (async () => {
        try {
          console.log(`🔄 [KNOWLEDGE DOCUMENTS] Extracting text from: ${file.originalname}`);
          syncProgressEmitter.emitDocumentProgress(documentId, "extracting", 10, "Estrazione testo in corso...");
          
          let vertexCredentials: VertexAICredentials | undefined;
          try {
            const [aiSettings] = await db
              .select()
              .from(vertexAiSettings)
              .where(eq(vertexAiSettings.userId, consultantId))
              .limit(1);
            
            if (aiSettings?.serviceAccountJson && aiSettings.enabled) {
              const parsedCredentials = await parseServiceAccountJson(aiSettings.serviceAccountJson);
              if (parsedCredentials) {
                vertexCredentials = {
                  projectId: aiSettings.projectId,
                  location: aiSettings.location || 'us-central1',
                  credentials: parsedCredentials,
                };
                console.log(`🔑 [KNOWLEDGE DOCUMENTS] Using Vertex AI credentials for audio transcription`);
              }
            }
          } catch (credError: any) {
            console.warn(`⚠️ [KNOWLEDGE DOCUMENTS] Could not load Vertex AI credentials, will use fallback:`, credError.message);
          }
          
          let extractedContent: string;
          let geminiFileUri: string | undefined;
          let geminiFileExpiresAt: Date | undefined;
          
          if (fileType === 'pdf') {
            console.log(`📄 [KNOWLEDGE DOCUMENTS] Using PDF fallback extraction with Gemini Files API support`);
            const pdfResult = await extractTextFromPDFWithFallback(finalFilePath!, title.trim());
            extractedContent = pdfResult.text;
            geminiFileUri = pdfResult.geminiFileUri;
            geminiFileExpiresAt = pdfResult.geminiFileExpiresAt;
            
            if (pdfResult.usedGemini) {
              console.log(`🤖 [KNOWLEDGE DOCUMENTS] PDF extracted using Gemini Files API`);
            } else {
              console.log(`📋 [KNOWLEDGE DOCUMENTS] PDF extracted using pdf-parse`);
            }
          } else {
            extractedContent = await extractTextFromFile(finalFilePath!, file.mimetype, vertexCredentials);
          }
          
          syncProgressEmitter.emitDocumentProgress(documentId, "extracting_complete", 40, "Testo estratto con successo");

          const updateData: Record<string, any> = {
            extractedContent,
            status: "indexed",
            updatedAt: new Date(),
          };
          
          if (geminiFileUri) {
            updateData.geminiFileUri = geminiFileUri;
            updateData.geminiFileExpiresAt = geminiFileExpiresAt;
            console.log(`💾 [KNOWLEDGE DOCUMENTS] Saving Gemini file URI: ${geminiFileUri}`);
          }

          await db
            .update(consultantKnowledgeDocuments)
            .set(updateData)
            .where(eq(consultantKnowledgeDocuments.id, documentId));

          console.log(`✅ [KNOWLEDGE DOCUMENTS] Document indexed: "${title}"`);
          
          syncProgressEmitter.emitDocumentProgress(documentId, "syncing", 50, "Sincronizzazione con AI in corso...");
          
          try {
            await fileSearchSyncService.syncConsultantKnowledgeDocumentWithProgress(documentId, consultantId);
            syncProgressEmitter.emitDocumentProgress(documentId, "complete", 100, "Documento elaborato con successo");
            console.log(`🔍 [FileSearch] Document auto-synced to FileSearchStore: "${title}"`);
          } catch (syncError: any) {
            console.warn(`⚠️ [FileSearch] Auto-sync failed for "${title}":`, syncError.message);
            syncProgressEmitter.emitDocumentProgress(documentId, "complete", 100, "Documento indicizzato (sync AI non disponibile)");
          }
        } catch (extractError: any) {
          console.error(`❌ [KNOWLEDGE DOCUMENTS] Text extraction failed:`, extractError.message);
          await db
            .update(consultantKnowledgeDocuments)
            .set({
              status: "error",
              errorMessage: extractError.message,
              updatedAt: new Date(),
            })
            .where(eq(consultantKnowledgeDocuments.id, documentId));
          syncProgressEmitter.emitDocumentProgress(documentId, "error", 0, "Errore durante l'elaborazione", { error: extractError.message });
        }
      })();

      res.status(201).json({
        success: true,
        data: newDocument,
        message: "Document uploaded successfully. Text extraction in progress.",
      });
    } catch (error: any) {
      console.error("❌ [KNOWLEDGE DOCUMENTS] Error uploading document:", error);

      if (uploadedFilePath) {
        await fs.unlink(uploadedFilePath).catch(() => {});
      }
      if (finalFilePath) {
        await fs.unlink(finalFilePath).catch(() => {});
      }

      res.status(500).json({
        success: false,
        error: error.message || "Failed to upload knowledge document",
      });
    }
  }
);

router.put(
  "/consultant/knowledge/documents/:id",
  authenticateToken,
  requireRole("consultant"),
  async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const consultantId = req.user!.id;

      const [existingDocument] = await db
        .select()
        .from(consultantKnowledgeDocuments)
        .where(
          and(
            eq(consultantKnowledgeDocuments.id, id),
            eq(consultantKnowledgeDocuments.consultantId, consultantId)
          )
        )
        .limit(1);

      if (!existingDocument) {
        return res.status(404).json({
          success: false,
          error: "Document not found",
        });
      }

      if (existingDocument.description?.startsWith('[SYSTEM_DOC:')) {
        return res.status(403).json({
          success: false,
          error: "Cannot edit system-linked documents. Manage them from the System Documents section.",
        });
      }

      const validationResult = updateConsultantKnowledgeDocumentSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({
          success: false,
          error: "Validation failed",
          details: validationResult.error.errors,
        });
      }

      const updateData = validationResult.data;

      const [updatedDocument] = await db
        .update(consultantKnowledgeDocuments)
        .set({
          ...updateData,
          updatedAt: new Date(),
        })
        .where(eq(consultantKnowledgeDocuments.id, id))
        .returning();

      console.log(`✏️ [KNOWLEDGE DOCUMENTS] Updated document: "${updatedDocument.title}"`);

      res.json({
        success: true,
        data: updatedDocument,
        message: "Document updated successfully",
      });
    } catch (error: any) {
      console.error("❌ [KNOWLEDGE DOCUMENTS] Error updating document:", error);
      res.status(500).json({
        success: false,
        error: error.message || "Failed to update knowledge document",
      });
    }
  }
);

router.delete(
  "/consultant/knowledge/documents/:id",
  authenticateToken,
  requireRole("consultant"),
  async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const consultantId = req.user!.id;

      const [document] = await db
        .select()
        .from(consultantKnowledgeDocuments)
        .where(
          and(
            eq(consultantKnowledgeDocuments.id, id),
            eq(consultantKnowledgeDocuments.consultantId, consultantId)
          )
        )
        .limit(1);

      if (!document) {
        return res.status(404).json({
          success: false,
          error: "Document not found",
        });
      }

      if (document.description?.startsWith('[SYSTEM_DOC:')) {
        return res.status(403).json({
          success: false,
          error: "Cannot delete system-linked documents. Manage them from the System Documents section.",
        });
      }

      // Delete from FileSearch first (get consultant store and pass storeId)
      try {
        const [consultantStore] = await db
          .select({ id: fileSearchStores.id })
          .from(fileSearchStores)
          .where(and(
            eq(fileSearchStores.ownerId, consultantId),
            eq(fileSearchStores.ownerType, 'consultant')
          ))
          .limit(1);
        
        if (consultantStore) {
          const deleteResult = await fileSearchService.deleteDocumentBySource(
            'knowledge_base',
            id,
            consultantStore.id,
            consultantId
          );
          if (deleteResult.deleted > 0) {
            console.log(`🗑️ [KNOWLEDGE DOCUMENTS] Deleted ${deleteResult.deleted} document(s) from FileSearch`);
          }
        }
      } catch (fileSearchError: any) {
        console.warn(`⚠️ [KNOWLEDGE DOCUMENTS] Could not delete from FileSearch:`, fileSearchError.message);
        // Don't fail the request if FileSearch deletion fails
      }

      if (document.filePath) {
        try {
          await fs.unlink(document.filePath);
          console.log(`🗑️ [KNOWLEDGE DOCUMENTS] Deleted file: ${document.filePath}`);
        } catch (fileError: any) {
          console.warn(`⚠️ [KNOWLEDGE DOCUMENTS] Could not delete file: ${fileError.message}`);
        }
      }

      await db
        .delete(consultantKnowledgeDocuments)
        .where(eq(consultantKnowledgeDocuments.id, id));

      console.log(`🗑️ [KNOWLEDGE DOCUMENTS] Deleted document: "${document.title}"`);

      res.json({
        success: true,
        message: "Document deleted successfully",
      });
    } catch (error: any) {
      console.error("❌ [KNOWLEDGE DOCUMENTS] Error deleting document:", error);
      res.status(500).json({
        success: false,
        error: error.message || "Failed to delete knowledge document",
      });
    }
  }
);

// Toggle summary enabled/disabled for a document
router.post(
  "/consultant/knowledge/documents/:id/toggle-summary",
  authenticateToken,
  requireRole("consultant"),
  async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const consultantId = req.user!.id;
      const { enabled } = req.body;

      const [document] = await db
        .select()
        .from(consultantKnowledgeDocuments)
        .where(
          and(
            eq(consultantKnowledgeDocuments.id, id),
            eq(consultantKnowledgeDocuments.consultantId, consultantId)
          )
        )
        .limit(1);

      if (!document) {
        return res.status(404).json({
          success: false,
          error: "Document not found",
        });
      }

      let contentSummary = document.contentSummary;

      // Se abilitiamo il riassunto e non esiste, generiamo un riassunto base
      if (enabled && !contentSummary && document.extractedContent) {
        // Genera un riassunto semplice (i primi 500 caratteri + indicazione che è un estratto)
        const extractedText = document.extractedContent;
        contentSummary = extractedText.length > 500 
          ? extractedText.substring(0, 500) + '... [Riassunto estratto automaticamente]'
          : extractedText;
      }

      const [updatedDocument] = await db
        .update(consultantKnowledgeDocuments)
        .set({
          summaryEnabled: enabled,
          contentSummary: enabled ? contentSummary : null,
          updatedAt: new Date(),
        })
        .where(eq(consultantKnowledgeDocuments.id, id))
        .returning();

      console.log(`📝 [KNOWLEDGE DOCUMENTS] Summary ${enabled ? 'enabled' : 'disabled'} for: "${document.title}"`);

      res.json({
        success: true,
        data: updatedDocument,
        message: enabled ? "Riassunto abilitato" : "Riassunto disabilitato",
      });
    } catch (error: any) {
      console.error("❌ [KNOWLEDGE DOCUMENTS] Error toggling summary:", error);
      res.status(500).json({
        success: false,
        error: error.message || "Failed to toggle summary",
      });
    }
  }
);

// Update custom tags for a document
router.put(
  "/consultant/knowledge/documents/:id/tags",
  authenticateToken,
  requireRole("consultant"),
  async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const consultantId = req.user!.id;
      const { tags } = req.body;

      if (!Array.isArray(tags)) {
        return res.status(400).json({
          success: false,
          error: "Tags must be an array of strings",
        });
      }

      const [document] = await db
        .select()
        .from(consultantKnowledgeDocuments)
        .where(
          and(
            eq(consultantKnowledgeDocuments.id, id),
            eq(consultantKnowledgeDocuments.consultantId, consultantId)
          )
        )
        .limit(1);

      if (!document) {
        return res.status(404).json({
          success: false,
          error: "Document not found",
        });
      }

      const cleanTags = tags.map((t: string) => t.trim().toLowerCase()).filter((t: string) => t.length > 0);

      const [updatedDocument] = await db
        .update(consultantKnowledgeDocuments)
        .set({
          tags: cleanTags,
          updatedAt: new Date(),
        })
        .where(eq(consultantKnowledgeDocuments.id, id))
        .returning();

      console.log(`🏷️ [KNOWLEDGE DOCUMENTS] Updated tags for: "${document.title}" -> [${cleanTags.join(', ')}]`);

      res.json({
        success: true,
        data: updatedDocument,
        message: "Tags aggiornati",
      });
    } catch (error: any) {
      console.error("❌ [KNOWLEDGE DOCUMENTS] Error updating tags:", error);
      res.status(500).json({
        success: false,
        error: error.message || "Failed to update tags",
      });
    }
  }
);

// Get document preview (full extracted content)
router.get(
  "/consultant/knowledge/documents/:id/preview",
  authenticateToken,
  requireRole("consultant"),
  async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const consultantId = req.user!.id;

      const [document] = await db
        .select()
        .from(consultantKnowledgeDocuments)
        .where(
          and(
            eq(consultantKnowledgeDocuments.id, id),
            eq(consultantKnowledgeDocuments.consultantId, consultantId)
          )
        )
        .limit(1);

      if (!document) {
        return res.status(404).json({
          success: false,
          error: "Document not found",
        });
      }

      res.json({
        success: true,
        data: {
          id: document.id,
          title: document.title,
          description: document.description,
          category: document.category,
          fileName: document.fileName,
          fileType: document.fileType,
          fileSize: document.fileSize,
          extractedContent: document.extractedContent,
          contentSummary: document.contentSummary,
          summaryEnabled: document.summaryEnabled,
          structuredData: document.structuredData,
          tags: document.tags,
          priority: document.priority,
          usageCount: document.usageCount,
          lastUsedAt: document.lastUsedAt,
          version: document.version,
          status: document.status,
          createdAt: document.createdAt,
          updatedAt: document.updatedAt,
        },
      });
    } catch (error: any) {
      console.error("❌ [KNOWLEDGE DOCUMENTS] Error fetching preview:", error);
      res.status(500).json({
        success: false,
        error: error.message || "Failed to fetch document preview",
      });
    }
  }
);

// Get knowledge base statistics
router.get(
  "/consultant/knowledge/stats",
  authenticateToken,
  requireRole("consultant"),
  async (req: AuthRequest, res) => {
    try {
      const consultantId = req.user!.id;

      // Get all documents (only fields needed for stats)
      const documents = await db
        .select({
          id: consultantKnowledgeDocuments.id,
          title: consultantKnowledgeDocuments.title,
          category: consultantKnowledgeDocuments.category,
          status: consultantKnowledgeDocuments.status,
          usageCount: consultantKnowledgeDocuments.usageCount,
          lastUsedAt: consultantKnowledgeDocuments.lastUsedAt,
        })
        .from(consultantKnowledgeDocuments)
        .where(eq(consultantKnowledgeDocuments.consultantId, consultantId));

      // Get all APIs (only fields needed for stats)
      const apis = await db
        .select({
          id: consultantKnowledgeApis.id,
          name: consultantKnowledgeApis.name,
          category: consultantKnowledgeApis.category,
          isActive: consultantKnowledgeApis.isActive,
          usageCount: consultantKnowledgeApis.usageCount,
          lastUsedAt: consultantKnowledgeApis.lastUsedAt,
        })
        .from(consultantKnowledgeApis)
        .where(eq(consultantKnowledgeApis.consultantId, consultantId));

      // Calculate statistics
      const totalDocuments = documents.length;
      const indexedDocuments = documents.filter(d => d.status === 'indexed').length;
      const processingDocuments = documents.filter(d => d.status === 'processing').length;
      const errorDocuments = documents.filter(d => d.status === 'error').length;
      
      const totalApis = apis.length;
      const activeApis = apis.filter(a => a.isActive).length;
      
      const totalDocUsage = documents.reduce((sum, d) => sum + (d.usageCount || 0), 0);
      const totalApiUsage = apis.reduce((sum, a) => sum + (a.usageCount || 0), 0);
      
      // Most used documents
      const mostUsedDocs = [...documents]
        .filter(d => d.usageCount > 0)
        .sort((a, b) => (b.usageCount || 0) - (a.usageCount || 0))
        .slice(0, 5)
        .map(d => ({
          id: d.id,
          title: d.title,
          category: d.category,
          usageCount: d.usageCount,
          lastUsedAt: d.lastUsedAt,
        }));

      // Most used APIs
      const mostUsedApis = [...apis]
        .filter(a => a.usageCount > 0)
        .sort((a, b) => (b.usageCount || 0) - (a.usageCount || 0))
        .slice(0, 5)
        .map(a => ({
          id: a.id,
          name: a.name,
          category: a.category,
          usageCount: a.usageCount,
          lastUsedAt: a.lastUsedAt,
        }));

      // Documents by category
      const docsByCategory: Record<string, number> = {};
      documents.forEach(d => {
        docsByCategory[d.category] = (docsByCategory[d.category] || 0) + 1;
      });

      res.json({
        success: true,
        data: {
          documents: {
            total: totalDocuments,
            indexed: indexedDocuments,
            processing: processingDocuments,
            error: errorDocuments,
            totalUsage: totalDocUsage,
            byCategory: docsByCategory,
            mostUsed: mostUsedDocs,
          },
          apis: {
            total: totalApis,
            active: activeApis,
            totalUsage: totalApiUsage,
            mostUsed: mostUsedApis,
          },
          totalKnowledgeItems: totalDocuments + totalApis,
          totalUsage: totalDocUsage + totalApiUsage,
        },
      });
    } catch (error: any) {
      console.error("❌ [KNOWLEDGE STATS] Error fetching stats:", error);
      res.status(500).json({
        success: false,
        error: error.message || "Failed to fetch knowledge stats",
      });
    }
  }
);

router.post(
  "/consultant/knowledge/documents/:id/progress-token",
  authenticateToken,
  requireRole("consultant"),
  async (req: AuthRequest, res) => {
    const consultantId = req.user!.id;
    const { id } = req.params;

    const [document] = await db
      .select()
      .from(consultantKnowledgeDocuments)
      .where(
        and(
          eq(consultantKnowledgeDocuments.id, id),
          eq(consultantKnowledgeDocuments.consultantId, consultantId)
        )
      )
      .limit(1);

    if (!document) {
      return res.status(404).json({ success: false, error: "Document not found" });
    }

    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = Date.now() + 10 * 60 * 1000;
    
    documentSseTokenStore.set(token, { consultantId, documentId: id, expiresAt });
    
    res.json({ token, expiresIn: 600 });
  }
);

router.get(
  "/consultant/knowledge/documents/:id/progress",
  async (req: Request, res: Response) => {
    const token = req.query.token as string;
    const { id } = req.params;

    if (!token) {
      return res.status(401).json({ error: "SSE token required" });
    }

    const tokenData = documentSseTokenStore.get(token);
    if (!tokenData || tokenData.expiresAt < Date.now()) {
      documentSseTokenStore.delete(token);
      return res.status(401).json({ error: "Invalid or expired SSE token" });
    }

    if (tokenData.documentId !== id) {
      return res.status(403).json({ error: "Token not valid for this document" });
    }

    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    });

    res.write(`data: ${JSON.stringify({ type: "connected", documentId: id })}\n\n`);

    const heartbeatInterval = setInterval(() => {
      res.write(`:heartbeat\n\n`);
    }, 30000);

    const eventHandler = (event: DocumentProgressEvent) => {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
      
      if (event.phase === "complete" || event.phase === "error") {
        setTimeout(() => {
          documentSseTokenStore.delete(token);
        }, 5000);
      }
    };

    syncProgressEmitter.on(`doc:${id}`, eventHandler);

    req.on("close", () => {
      clearInterval(heartbeatInterval);
      syncProgressEmitter.off(`doc:${id}`, eventHandler);
      documentSseTokenStore.delete(token);
      res.end();
    });
  }
);

router.post(
  "/consultant/knowledge/documents/:id/retry",
  authenticateToken,
  requireRole("consultant"),
  async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const consultantId = req.user!.id;

      const [document] = await db
        .select()
        .from(consultantKnowledgeDocuments)
        .where(
          and(
            eq(consultantKnowledgeDocuments.id, id),
            eq(consultantKnowledgeDocuments.consultantId, consultantId)
          )
        )
        .limit(1);

      if (!document) {
        return res.status(404).json({ success: false, error: "Document not found" });
      }

      if (!document.filePath) {
        return res.status(400).json({ success: false, error: "Document file not found" });
      }

      await db
        .update(consultantKnowledgeDocuments)
        .set({
          status: "processing",
          errorMessage: null,
          updatedAt: new Date(),
        })
        .where(eq(consultantKnowledgeDocuments.id, id));

      res.json({ success: true, message: "Retry started" });

      (async () => {
        try {
          syncProgressEmitter.emitDocumentProgress(id, "extracting", 10, "Estrazione testo in corso...");

          let vertexCredentials: VertexAICredentials | undefined;
          try {
            const [aiSettings] = await db
              .select()
              .from(vertexAiSettings)
              .where(eq(vertexAiSettings.userId, consultantId))
              .limit(1);

            if (aiSettings?.serviceAccountJson && aiSettings.enabled) {
              const parsedCredentials = await parseServiceAccountJson(aiSettings.serviceAccountJson);
              if (parsedCredentials) {
                vertexCredentials = {
                  projectId: aiSettings.projectId,
                  location: aiSettings.location || "us-central1",
                  credentials: parsedCredentials,
                };
              }
            }
          } catch (credError: any) {
            console.warn(`⚠️ [KNOWLEDGE DOCUMENTS] Could not load Vertex AI credentials:`, credError.message);
          }

          const mimeType = getMimeTypeFromFileType(document.fileType);
          const extractedContent = await extractTextFromFile(document.filePath, mimeType, vertexCredentials);

          syncProgressEmitter.emitDocumentProgress(id, "extracting_complete", 40, "Testo estratto con successo");

          await db
            .update(consultantKnowledgeDocuments)
            .set({
              extractedContent,
              status: "indexed",
              errorMessage: null,
              updatedAt: new Date(),
            })
            .where(eq(consultantKnowledgeDocuments.id, id));

          syncProgressEmitter.emitDocumentProgress(id, "syncing", 50, "Sincronizzazione con AI in corso...");

          try {
            await fileSearchSyncService.syncConsultantKnowledgeDocumentWithProgress(id, consultantId);
            syncProgressEmitter.emitDocumentProgress(id, "complete", 100, "Documento elaborato con successo");
          } catch (syncError: any) {
            console.warn(`⚠️ [KNOWLEDGE DOCUMENTS] FileSearch sync failed:`, syncError.message);
            syncProgressEmitter.emitDocumentProgress(id, "complete", 100, "Documento indicizzato (sync AI non disponibile)");
          }
        } catch (extractError: any) {
          console.error(`❌ [KNOWLEDGE DOCUMENTS] Retry failed:`, extractError.message);
          await db
            .update(consultantKnowledgeDocuments)
            .set({
              status: "error",
              errorMessage: extractError.message,
              updatedAt: new Date(),
            })
            .where(eq(consultantKnowledgeDocuments.id, id));
          syncProgressEmitter.emitDocumentProgress(id, "error", 0, "Errore durante l'elaborazione", { error: extractError.message });
        }
      })();
    } catch (error: any) {
      console.error("❌ [KNOWLEDGE DOCUMENTS] Error starting retry:", error);
      res.status(500).json({ success: false, error: error.message || "Failed to start retry" });
    }
  }
);

function getMimeTypeFromFileType(fileType: string): string {
  const mimeTypes: Record<string, string> = {
    pdf: "application/pdf",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    txt: "text/plain",
    md: "text/markdown",
    rtf: "text/rtf",
    odt: "application/vnd.oasis.opendocument.text",
    csv: "text/csv",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    xls: "application/vnd.ms-excel",
    pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ppt: "application/vnd.ms-powerpoint",
    mp3: "audio/mpeg",
    wav: "audio/wav",
    m4a: "audio/mp4",
    ogg: "audio/ogg",
    webm_audio: "audio/webm",
  };
  return mimeTypes[fileType] || "application/octet-stream";
}

// ================== FOLDER CRUD ENDPOINTS ==================

const createFolderSchema = z.object({
  name: z.string().min(1).max(255),
  parentId: z.string().nullable().optional(),
  icon: z.string().optional().default("folder"),
  color: z.string().optional().default("#6366f1"),
});

const updateFolderSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  parentId: z.string().nullable().optional(),
  icon: z.string().optional(),
  color: z.string().optional(),
  sortOrder: z.number().int().optional(),
});

router.get(
  "/consultant/knowledge/folders",
  authenticateToken,
  requireRole("consultant"),
  async (req: AuthRequest, res) => {
    try {
      const consultantId = req.user!.id;

      const folders = await db
        .select({
          id: knowledgeDocumentFolders.id,
          consultantId: knowledgeDocumentFolders.consultantId,
          name: knowledgeDocumentFolders.name,
          parentId: knowledgeDocumentFolders.parentId,
          icon: knowledgeDocumentFolders.icon,
          color: knowledgeDocumentFolders.color,
          sortOrder: knowledgeDocumentFolders.sortOrder,
          createdAt: knowledgeDocumentFolders.createdAt,
          updatedAt: knowledgeDocumentFolders.updatedAt,
        })
        .from(knowledgeDocumentFolders)
        .where(eq(knowledgeDocumentFolders.consultantId, consultantId))
        .orderBy(asc(knowledgeDocumentFolders.sortOrder), asc(knowledgeDocumentFolders.name));

      const documentCounts = await db
        .select({
          folderId: consultantKnowledgeDocuments.folderId,
          count: count(),
        })
        .from(consultantKnowledgeDocuments)
        .where(eq(consultantKnowledgeDocuments.consultantId, consultantId))
        .groupBy(consultantKnowledgeDocuments.folderId);

      const countMap = new Map<string | null, number>();
      documentCounts.forEach(dc => {
        countMap.set(dc.folderId, dc.count);
      });

      const foldersWithCounts = folders.map(folder => ({
        ...folder,
        documentCount: countMap.get(folder.id) || 0,
      }));

      const rootDocumentCount = countMap.get(null) || 0;

      res.json({
        success: true,
        data: foldersWithCounts,
        rootDocumentCount,
      });
    } catch (error: any) {
      console.error("❌ [KNOWLEDGE FOLDERS] Error listing folders:", error);
      res.status(500).json({
        success: false,
        error: error.message || "Failed to list folders",
      });
    }
  }
);

router.post(
  "/consultant/knowledge/folders",
  authenticateToken,
  requireRole("consultant"),
  async (req: AuthRequest, res) => {
    try {
      const consultantId = req.user!.id;

      const validationResult = createFolderSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({
          success: false,
          error: "Validation failed",
          details: validationResult.error.errors,
        });
      }

      const { name, parentId, icon, color } = validationResult.data;

      if (parentId) {
        const [parentFolder] = await db
          .select({ id: knowledgeDocumentFolders.id })
          .from(knowledgeDocumentFolders)
          .where(
            and(
              eq(knowledgeDocumentFolders.id, parentId),
              eq(knowledgeDocumentFolders.consultantId, consultantId)
            )
          )
          .limit(1);

        if (!parentFolder) {
          return res.status(400).json({
            success: false,
            error: "Parent folder not found",
          });
        }
      }

      const [maxSortOrder] = await db
        .select({ maxSort: sql<number>`COALESCE(MAX(${knowledgeDocumentFolders.sortOrder}), 0)` })
        .from(knowledgeDocumentFolders)
        .where(
          and(
            eq(knowledgeDocumentFolders.consultantId, consultantId),
            parentId ? eq(knowledgeDocumentFolders.parentId, parentId) : isNull(knowledgeDocumentFolders.parentId)
          )
        );

      const [newFolder] = await db
        .insert(knowledgeDocumentFolders)
        .values({
          id: crypto.randomUUID(),
          consultantId,
          name: name.trim(),
          parentId: parentId || null,
          icon: icon || "folder",
          color: color || "#6366f1",
          sortOrder: (maxSortOrder?.maxSort || 0) + 1,
        })
        .returning();

      console.log(`📁 [KNOWLEDGE FOLDERS] Created folder: "${name}"`);

      res.status(201).json({
        success: true,
        data: { ...newFolder, documentCount: 0 },
      });
    } catch (error: any) {
      console.error("❌ [KNOWLEDGE FOLDERS] Error creating folder:", error);
      res.status(500).json({
        success: false,
        error: error.message || "Failed to create folder",
      });
    }
  }
);

router.put(
  "/consultant/knowledge/folders/:id",
  authenticateToken,
  requireRole("consultant"),
  async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const consultantId = req.user!.id;

      const [existingFolder] = await db
        .select()
        .from(knowledgeDocumentFolders)
        .where(
          and(
            eq(knowledgeDocumentFolders.id, id),
            eq(knowledgeDocumentFolders.consultantId, consultantId)
          )
        )
        .limit(1);

      if (!existingFolder) {
        return res.status(404).json({
          success: false,
          error: "Folder not found",
        });
      }

      const validationResult = updateFolderSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({
          success: false,
          error: "Validation failed",
          details: validationResult.error.errors,
        });
      }

      const updateData = validationResult.data;

      if (updateData.parentId !== undefined) {
        if (updateData.parentId === id) {
          return res.status(400).json({
            success: false,
            error: "A folder cannot be its own parent",
          });
        }

        if (updateData.parentId) {
          const [parentFolder] = await db
            .select({ id: knowledgeDocumentFolders.id })
            .from(knowledgeDocumentFolders)
            .where(
              and(
                eq(knowledgeDocumentFolders.id, updateData.parentId),
                eq(knowledgeDocumentFolders.consultantId, consultantId)
              )
            )
            .limit(1);

          if (!parentFolder) {
            return res.status(400).json({
              success: false,
              error: "Parent folder not found",
            });
          }
        }
      }

      const [updatedFolder] = await db
        .update(knowledgeDocumentFolders)
        .set({
          ...updateData,
          updatedAt: new Date(),
        })
        .where(eq(knowledgeDocumentFolders.id, id))
        .returning();

      console.log(`✏️ [KNOWLEDGE FOLDERS] Updated folder: "${updatedFolder.name}"`);

      res.json({
        success: true,
        data: updatedFolder,
      });
    } catch (error: any) {
      console.error("❌ [KNOWLEDGE FOLDERS] Error updating folder:", error);
      res.status(500).json({
        success: false,
        error: error.message || "Failed to update folder",
      });
    }
  }
);

router.delete(
  "/consultant/knowledge/folders/:id",
  authenticateToken,
  requireRole("consultant"),
  async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const consultantId = req.user!.id;

      const [folder] = await db
        .select()
        .from(knowledgeDocumentFolders)
        .where(
          and(
            eq(knowledgeDocumentFolders.id, id),
            eq(knowledgeDocumentFolders.consultantId, consultantId)
          )
        )
        .limit(1);

      if (!folder) {
        return res.status(404).json({
          success: false,
          error: "Folder not found",
        });
      }

      await db
        .update(consultantKnowledgeDocuments)
        .set({ folderId: null, updatedAt: new Date() })
        .where(
          and(
            eq(consultantKnowledgeDocuments.folderId, id),
            eq(consultantKnowledgeDocuments.consultantId, consultantId)
          )
        );

      await db
        .update(knowledgeDocumentFolders)
        .set({ parentId: folder.parentId, updatedAt: new Date() })
        .where(
          and(
            eq(knowledgeDocumentFolders.parentId, id),
            eq(knowledgeDocumentFolders.consultantId, consultantId)
          )
        );

      await db
        .delete(knowledgeDocumentFolders)
        .where(eq(knowledgeDocumentFolders.id, id));

      console.log(`🗑️ [KNOWLEDGE FOLDERS] Deleted folder: "${folder.name}"`);

      res.json({
        success: true,
        message: "Folder deleted successfully",
      });
    } catch (error: any) {
      console.error("❌ [KNOWLEDGE FOLDERS] Error deleting folder:", error);
      res.status(500).json({
        success: false,
        error: error.message || "Failed to delete folder",
      });
    }
  }
);

// ================== DOCUMENT MOVE ENDPOINTS ==================

const moveDocumentSchema = z.object({
  folderId: z.string().nullable(),
});

const bulkMoveSchema = z.object({
  documentIds: z.array(z.string()).min(1),
  folderId: z.string().nullable(),
});

const bulkDeleteSchema = z.object({
  documentIds: z.array(z.string()).min(1),
});

router.put(
  "/consultant/knowledge/documents/:id/move",
  authenticateToken,
  requireRole("consultant"),
  async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const consultantId = req.user!.id;

      const validationResult = moveDocumentSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({
          success: false,
          error: "Validation failed",
          details: validationResult.error.errors,
        });
      }

      const { folderId } = validationResult.data;

      const [document] = await db
        .select({ id: consultantKnowledgeDocuments.id, title: consultantKnowledgeDocuments.title })
        .from(consultantKnowledgeDocuments)
        .where(
          and(
            eq(consultantKnowledgeDocuments.id, id),
            eq(consultantKnowledgeDocuments.consultantId, consultantId)
          )
        )
        .limit(1);

      if (!document) {
        return res.status(404).json({
          success: false,
          error: "Document not found",
        });
      }

      if (folderId) {
        const [targetFolder] = await db
          .select({ id: knowledgeDocumentFolders.id })
          .from(knowledgeDocumentFolders)
          .where(
            and(
              eq(knowledgeDocumentFolders.id, folderId),
              eq(knowledgeDocumentFolders.consultantId, consultantId)
            )
          )
          .limit(1);

        if (!targetFolder) {
          return res.status(400).json({
            success: false,
            error: "Target folder not found",
          });
        }
      }

      const [updatedDocument] = await db
        .update(consultantKnowledgeDocuments)
        .set({ folderId, updatedAt: new Date() })
        .where(eq(consultantKnowledgeDocuments.id, id))
        .returning();

      console.log(`📦 [KNOWLEDGE DOCUMENTS] Moved document "${document.title}" to folder: ${folderId || 'root'}`);

      res.json({
        success: true,
        data: updatedDocument,
      });
    } catch (error: any) {
      console.error("❌ [KNOWLEDGE DOCUMENTS] Error moving document:", error);
      res.status(500).json({
        success: false,
        error: error.message || "Failed to move document",
      });
    }
  }
);

router.post(
  "/consultant/knowledge/documents/bulk-move",
  authenticateToken,
  requireRole("consultant"),
  async (req: AuthRequest, res) => {
    try {
      const consultantId = req.user!.id;

      const validationResult = bulkMoveSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({
          success: false,
          error: "Validation failed",
          details: validationResult.error.errors,
        });
      }

      const { documentIds, folderId } = validationResult.data;

      if (folderId) {
        const [targetFolder] = await db
          .select({ id: knowledgeDocumentFolders.id })
          .from(knowledgeDocumentFolders)
          .where(
            and(
              eq(knowledgeDocumentFolders.id, folderId),
              eq(knowledgeDocumentFolders.consultantId, consultantId)
            )
          )
          .limit(1);

        if (!targetFolder) {
          return res.status(400).json({
            success: false,
            error: "Target folder not found",
          });
        }
      }

      const result = await db
        .update(consultantKnowledgeDocuments)
        .set({ folderId, updatedAt: new Date() })
        .where(
          and(
            inArray(consultantKnowledgeDocuments.id, documentIds),
            eq(consultantKnowledgeDocuments.consultantId, consultantId)
          )
        )
        .returning({ id: consultantKnowledgeDocuments.id });

      console.log(`📦 [KNOWLEDGE DOCUMENTS] Bulk moved ${result.length} documents to folder: ${folderId || 'root'}`);

      res.json({
        success: true,
        movedCount: result.length,
      });
    } catch (error: any) {
      console.error("❌ [KNOWLEDGE DOCUMENTS] Error bulk moving documents:", error);
      res.status(500).json({
        success: false,
        error: error.message || "Failed to bulk move documents",
      });
    }
  }
);

router.delete(
  "/consultant/knowledge/documents/bulk-delete",
  authenticateToken,
  requireRole("consultant"),
  async (req: AuthRequest, res) => {
    try {
      const consultantId = req.user!.id;

      const validationResult = bulkDeleteSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({
          success: false,
          error: "Validation failed",
          details: validationResult.error.errors,
        });
      }

      const { documentIds } = validationResult.data;

      const documentsToDelete = await db
        .select({ id: consultantKnowledgeDocuments.id, filePath: consultantKnowledgeDocuments.filePath, title: consultantKnowledgeDocuments.title })
        .from(consultantKnowledgeDocuments)
        .where(
          and(
            inArray(consultantKnowledgeDocuments.id, documentIds),
            eq(consultantKnowledgeDocuments.consultantId, consultantId)
          )
        );

      if (documentsToDelete.length === 0) {
        return res.status(404).json({
          success: false,
          error: "No documents found to delete",
        });
      }

      try {
        const [consultantStore] = await db
          .select({ id: fileSearchStores.id })
          .from(fileSearchStores)
          .where(and(
            eq(fileSearchStores.ownerId, consultantId),
            eq(fileSearchStores.ownerType, 'consultant')
          ))
          .limit(1);

        if (consultantStore) {
          for (const doc of documentsToDelete) {
            try {
              await fileSearchService.deleteDocumentBySource('knowledge_base', doc.id, consultantStore.id, consultantId);
            } catch (e) {
              console.warn(`⚠️ [KNOWLEDGE DOCUMENTS] Could not delete document ${doc.id} from FileSearch`);
            }
          }
        }
      } catch (fileSearchError: any) {
        console.warn(`⚠️ [KNOWLEDGE DOCUMENTS] FileSearch cleanup failed:`, fileSearchError.message);
      }

      for (const doc of documentsToDelete) {
        if (doc.filePath) {
          try {
            await fs.unlink(doc.filePath);
          } catch (fileError: any) {
            console.warn(`⚠️ [KNOWLEDGE DOCUMENTS] Could not delete file: ${doc.filePath}`);
          }
        }
      }

      await db
        .delete(consultantKnowledgeDocuments)
        .where(
          and(
            inArray(consultantKnowledgeDocuments.id, documentIds),
            eq(consultantKnowledgeDocuments.consultantId, consultantId)
          )
        );

      console.log(`🗑️ [KNOWLEDGE DOCUMENTS] Bulk deleted ${documentsToDelete.length} documents`);

      res.json({
        success: true,
        deletedCount: documentsToDelete.length,
      });
    } catch (error: any) {
      console.error("❌ [KNOWLEDGE DOCUMENTS] Error bulk deleting documents:", error);
      res.status(500).json({
        success: false,
        error: error.message || "Failed to bulk delete documents",
      });
    }
  }
);

// ==================== WHATSAPP AGENTS LIST (for system docs UI) ====================

router.get(
  "/consultant/knowledge/whatsapp-agents",
  authenticateToken,
  requireRole("consultant"),
  async (req: Request, res: Response) => {
    try {
      const consultantId = (req as AuthRequest).user!.id;

      const result = await db.execute(sql`
        SELECT id, agent_name, agent_type, is_active
        FROM consultant_whatsapp_config
        WHERE consultant_id = ${consultantId}
        ORDER BY agent_name ASC
      `);

      res.json({ success: true, data: result.rows });
    } catch (error: any) {
      console.error("❌ [WHATSAPP AGENTS LIST] Error:", error);
      res.status(500).json({ success: false, error: error.message || "Failed to list WhatsApp agents" });
    }
  }
);

// ==================== SYSTEM PROMPT DOCUMENTS ====================

router.get(
  "/consultant/knowledge/system-documents",
  authenticateToken,
  requireRole("consultant"),
  async (req: Request, res: Response) => {
    try {
      const consultantId = (req as AuthRequest).user!.id;

      const result = await db.execute(sql`
        SELECT id, consultant_id, title, content, description, is_active,
               target_client_assistant, target_autonomous_agents, target_whatsapp_agents,
               target_client_mode, target_client_ids, target_department_ids,
               priority, injection_mode, google_drive_file_id,
               last_drive_sync_at, sync_count, pending_sync_at,
               created_at, updated_at
        FROM system_prompt_documents
        WHERE consultant_id = ${consultantId}
        ORDER BY priority ASC, created_at DESC
      `);

      res.json({ success: true, data: result.rows });
    } catch (error: any) {
      console.error("❌ [SYSTEM PROMPT DOCS] Error listing:", error);
      res.status(500).json({ success: false, error: error.message || "Failed to list system prompt documents" });
    }
  }
);

router.post(
  "/consultant/knowledge/system-documents",
  authenticateToken,
  requireRole("consultant"),
  async (req: Request, res: Response) => {
    try {
      const consultantId = (req as AuthRequest).user!.id;
      const { title, content, description, target_client_assistant, target_autonomous_agents, target_whatsapp_agents, priority, injection_mode, target_client_mode, target_client_ids, target_department_ids, google_drive_file_id } = req.body;

      if (!title || !content) {
        return res.status(400).json({ success: false, error: "Title and content are required" });
      }

      const id = crypto.randomUUID();
      const now = new Date();

      const result = await db.execute(sql`
        INSERT INTO system_prompt_documents (id, consultant_id, title, content, description, is_active,
          target_client_assistant, target_autonomous_agents, target_whatsapp_agents, priority, injection_mode,
          target_client_mode, target_client_ids, target_department_ids, google_drive_file_id, created_at, updated_at)
        VALUES (${id}, ${consultantId}, ${title}, ${content}, ${description || null}, true,
          ${target_client_assistant ?? false}, ${JSON.stringify(target_autonomous_agents || {})}::jsonb,
          ${JSON.stringify(target_whatsapp_agents || {})}::jsonb, ${priority ?? 5}, ${injection_mode || 'system_prompt'},
          ${target_client_mode || 'all'}, ${JSON.stringify(target_client_ids || [])}::jsonb, ${JSON.stringify(target_department_ids || [])}::jsonb,
          ${google_drive_file_id || null},
          ${now}, ${now})
        RETURNING *
      `);

      if ((injection_mode || 'system_prompt') === 'file_search') {
        setImmediate(async () => {
          try {
            if (target_client_assistant) {
              await fileSearchSyncService.syncSystemPromptDocumentToFileSearch(id, consultantId, 'client_assistant', consultantId, 'consultant');
            }
            const autoAgents = target_autonomous_agents || {};
            for (const [agentId, enabled] of Object.entries(autoAgents)) {
              if (enabled) {
                await fileSearchSyncService.syncSystemPromptDocumentToFileSearch(id, consultantId, 'autonomous_agent', agentId, 'autonomous_agent');
                console.log(`✅ [SYSTEM PROMPT DOCS] Synced to File Search for autonomous agent store: ${agentId}`);
              }
            }
            const waAgents = target_whatsapp_agents || {};
            for (const [agentId, enabled] of Object.entries(waAgents)) {
              if (enabled) {
                await fileSearchSyncService.syncSystemPromptDocumentToFileSearch(id, consultantId, 'whatsapp_agent', agentId, 'whatsapp_agent');
              }
            }
            const deptIds = (target_client_mode === 'specific_departments' && target_department_ids) ? target_department_ids : [];
            for (const deptId of deptIds) {
              await fileSearchSyncService.syncSystemPromptDocumentToFileSearch(id, consultantId, 'department', deptId, 'department');
              console.log(`✅ [SYSTEM PROMPT DOCS] Synced to File Search for department store: ${deptId}`);
            }
          } catch (err: any) {
            console.error('❌ [SYSTEM PROMPT DOCS] Background file_search sync failed:', err.message);
          }
        });
      }

      if ((target_client_mode || 'all') === 'consultant_only') {
        setImmediate(async () => {
          try {
            const knowledgeDocId = crypto.randomUUID();
            const contentBytes = Buffer.byteLength(content, 'utf8');
            const sanitizedFileName = `${title.trim().replace(/[^a-zA-Z0-9À-ÿ _-]/g, '_')}.txt`;
            const relPath = `${KNOWLEDGE_UPLOAD_DIR}/${knowledgeDocId}_${sanitizedFileName}`;
            const absPath = path.join(process.cwd(), relPath);
            await fs.mkdir(path.dirname(absPath), { recursive: true });
            await fs.writeFile(absPath, content, 'utf8');
            await db
              .insert(consultantKnowledgeDocuments)
              .values({
                id: knowledgeDocId,
                consultantId,
                title: title.trim(),
                description: `[SYSTEM_DOC:${id}] ${description?.trim() || `Documento di sistema: ${title.trim()}`}`,
                category: 'other',
                fileName: sanitizedFileName,
                fileType: 'txt',
                fileSize: contentBytes,
                filePath: relPath,
                extractedContent: content,
                priority: priority ?? 5,
                status: 'indexed',
                googleDriveFileId: google_drive_file_id || null,
              });
            console.log(`📋 [SYSTEM PROMPT DOCS] Created KB companion doc "${title}" (id: ${knowledgeDocId}, sysDocId: ${id})`);
            await FileSearchSyncService.onKnowledgeDocumentIndexed(knowledgeDocId, consultantId);
            console.log(`✅ [SYSTEM PROMPT DOCS] KB companion doc synced to File Search as knowledge_base source`);
          } catch (err: any) {
            console.error('⚠️ [SYSTEM PROMPT DOCS] Failed to create/sync companion knowledge document:', err.message);
          }
        });
      }

      res.status(201).json({ success: true, data: result.rows[0] });
    } catch (error: any) {
      console.error("❌ [SYSTEM PROMPT DOCS] Error creating:", error);
      res.status(500).json({ success: false, error: error.message || "Failed to create system prompt document" });
    }
  }
);

router.put(
  "/consultant/knowledge/system-documents/:id",
  authenticateToken,
  requireRole("consultant"),
  async (req: Request, res: Response) => {
    try {
      const consultantId = (req as AuthRequest).user!.id;
      const { id } = req.params;
      const { title, content, description, target_client_assistant, target_autonomous_agents, target_whatsapp_agents, priority, is_active, injection_mode, target_client_mode, target_client_ids, target_department_ids } = req.body;

      const existing = await db.execute(sql`
        SELECT id FROM system_prompt_documents WHERE id = ${id} AND consultant_id = ${consultantId}
      `);

      if (existing.rows.length === 0) {
        return res.status(404).json({ success: false, error: "System prompt document not found" });
      }

      const result = await db.execute(sql`
        UPDATE system_prompt_documents
        SET title = COALESCE(${title ?? null}, title),
            content = COALESCE(${content ?? null}, content),
            description = COALESCE(${description ?? null}, description),
            target_client_assistant = COALESCE(${target_client_assistant ?? null}, target_client_assistant),
            target_autonomous_agents = COALESCE(${target_autonomous_agents ? JSON.stringify(target_autonomous_agents) : null}::jsonb, target_autonomous_agents),
            target_whatsapp_agents = COALESCE(${target_whatsapp_agents ? JSON.stringify(target_whatsapp_agents) : null}::jsonb, target_whatsapp_agents),
            priority = COALESCE(${priority ?? null}, priority),
            is_active = COALESCE(${is_active ?? null}, is_active),
            injection_mode = COALESCE(${injection_mode ?? null}, injection_mode),
            target_client_mode = COALESCE(${target_client_mode ?? null}, target_client_mode),
            target_client_ids = COALESCE(${target_client_ids ? JSON.stringify(target_client_ids) : null}::jsonb, target_client_ids),
            target_department_ids = COALESCE(${target_department_ids ? JSON.stringify(target_department_ids) : null}::jsonb, target_department_ids),
            updated_at = ${new Date()}
        WHERE id = ${id} AND consultant_id = ${consultantId}
        RETURNING *
      `);

      const updatedDoc = result.rows[0] as any;
      if (updatedDoc) {
        setImmediate(async () => {
          try {
            if (updatedDoc.injection_mode === 'file_search' && updatedDoc.is_active) {
              if (updatedDoc.target_client_assistant) {
                await fileSearchSyncService.syncSystemPromptDocumentToFileSearch(id, consultantId, 'client_assistant', consultantId, 'consultant');
              } else {
                await fileSearchSyncService.removeSystemPromptDocumentFromFileSearch(id, consultantId, 'consultant');
              }
              const autoAgents = (typeof updatedDoc.target_autonomous_agents === 'string' ? JSON.parse(updatedDoc.target_autonomous_agents) : updatedDoc.target_autonomous_agents) || {};
              for (const [agentId, enabled] of Object.entries(autoAgents)) {
                if (enabled) {
                  await fileSearchSyncService.syncSystemPromptDocumentToFileSearch(id, consultantId, 'autonomous_agent', agentId, 'autonomous_agent');
                } else {
                  await fileSearchSyncService.removeSystemPromptDocumentFromFileSearch(id, `${agentId}_${consultantId}`, 'autonomous_agent');
                }
              }
              const waAgents = (typeof updatedDoc.target_whatsapp_agents === 'string' ? JSON.parse(updatedDoc.target_whatsapp_agents) : updatedDoc.target_whatsapp_agents) || {};
              for (const [agentId, enabled] of Object.entries(waAgents)) {
                if (enabled) {
                  await fileSearchSyncService.syncSystemPromptDocumentToFileSearch(id, consultantId, 'whatsapp_agent', agentId, 'whatsapp_agent');
                } else {
                  await fileSearchSyncService.removeSystemPromptDocumentFromFileSearch(id, agentId, 'whatsapp_agent');
                }
              }
              const updatedDeptIds = (updatedDoc.target_client_mode === 'specific_departments' && updatedDoc.target_department_ids) ? (typeof updatedDoc.target_department_ids === 'string' ? JSON.parse(updatedDoc.target_department_ids) : updatedDoc.target_department_ids) : [];
              for (const deptId of updatedDeptIds) {
                await fileSearchSyncService.syncSystemPromptDocumentToFileSearch(id, consultantId, 'department', deptId, 'department');
              }
            } else if (updatedDoc.injection_mode === 'system_prompt' || !updatedDoc.is_active) {
              await fileSearchSyncService.removeSystemPromptDocumentFromFileSearch(id, consultantId, 'consultant');
              const autoAgents = (typeof updatedDoc.target_autonomous_agents === 'string' ? JSON.parse(updatedDoc.target_autonomous_agents) : updatedDoc.target_autonomous_agents) || {};
              for (const agentId of Object.keys(autoAgents)) {
                await fileSearchSyncService.removeSystemPromptDocumentFromFileSearch(id, `${agentId}_${consultantId}`, 'autonomous_agent');
              }
              const waAgents = (typeof updatedDoc.target_whatsapp_agents === 'string' ? JSON.parse(updatedDoc.target_whatsapp_agents) : updatedDoc.target_whatsapp_agents) || {};
              for (const agentId of Object.keys(waAgents)) {
                await fileSearchSyncService.removeSystemPromptDocumentFromFileSearch(id, agentId, 'whatsapp_agent');
              }
              const prevDeptIds = (updatedDoc.target_client_mode === 'specific_departments' && updatedDoc.target_department_ids) ? (typeof updatedDoc.target_department_ids === 'string' ? JSON.parse(updatedDoc.target_department_ids) : updatedDoc.target_department_ids) : [];
              for (const deptId of prevDeptIds) {
                await fileSearchSyncService.removeSystemPromptDocumentFromFileSearch(id, deptId, 'department');
              }
            }
          } catch (err: any) {
            console.error('❌ [SYSTEM PROMPT DOCS] Background file_search sync failed:', err.message);
          }
        });
      }

      res.json({ success: true, data: updatedDoc });
    } catch (error: any) {
      console.error("❌ [SYSTEM PROMPT DOCS] Error updating:", error);
      res.status(500).json({ success: false, error: error.message || "Failed to update system prompt document" });
    }
  }
);

router.delete(
  "/consultant/knowledge/system-documents/:id",
  authenticateToken,
  requireRole("consultant"),
  async (req: Request, res: Response) => {
    try {
      const consultantId = (req as AuthRequest).user!.id;
      const { id } = req.params;

      const existing = await db.execute(sql`
        SELECT id, target_whatsapp_agents, target_autonomous_agents, injection_mode, target_client_mode, target_department_ids
        FROM system_prompt_documents
        WHERE id = ${id} AND consultant_id = ${consultantId}
      `);

      if (existing.rows.length === 0) {
        return res.status(404).json({ success: false, error: "System prompt document not found" });
      }

      const docToDelete = existing.rows[0] as any;

      await db.execute(sql`
        DELETE FROM system_prompt_documents
        WHERE id = ${id} AND consultant_id = ${consultantId}
      `);

      if (docToDelete.injection_mode === 'file_search') {
        setImmediate(async () => {
          try {
            await fileSearchSyncService.removeSystemPromptDocumentFromFileSearch(id, consultantId, 'consultant');
            const autoAgents = (typeof docToDelete.target_autonomous_agents === 'string' ? JSON.parse(docToDelete.target_autonomous_agents) : docToDelete.target_autonomous_agents) || {};
            for (const agentId of Object.keys(autoAgents)) {
              await fileSearchSyncService.removeSystemPromptDocumentFromFileSearch(id, `${agentId}_${consultantId}`, 'autonomous_agent');
            }
            const waAgents = (typeof docToDelete.target_whatsapp_agents === 'string' ? JSON.parse(docToDelete.target_whatsapp_agents) : docToDelete.target_whatsapp_agents) || {};
            for (const agentId of Object.keys(waAgents)) {
              await fileSearchSyncService.removeSystemPromptDocumentFromFileSearch(id, agentId, 'whatsapp_agent');
            }
            const deleteDeptIds = (docToDelete.target_client_mode === 'specific_departments' && docToDelete.target_department_ids) ? (typeof docToDelete.target_department_ids === 'string' ? JSON.parse(docToDelete.target_department_ids) : docToDelete.target_department_ids) : [];
            for (const deptId of deleteDeptIds) {
              await fileSearchSyncService.removeSystemPromptDocumentFromFileSearch(id, deptId, 'department');
            }
          } catch (err: any) {
            console.error('❌ [SYSTEM PROMPT DOCS] Background file_search removal failed:', err.message);
          }
        });
      }

      setImmediate(async () => {
        try {
          const companionDocs = await db
            .select({ id: consultantKnowledgeDocuments.id, filePath: consultantKnowledgeDocuments.filePath })
            .from(consultantKnowledgeDocuments)
            .where(and(
              eq(consultantKnowledgeDocuments.consultantId, consultantId),
              ilike(consultantKnowledgeDocuments.description, `[SYSTEM_DOC:${id}]%`)
            ));
          for (const companion of companionDocs) {
            try {
              const [consultantStore] = await db
                .select({ id: fileSearchStores.id })
                .from(fileSearchStores)
                .where(and(
                  eq(fileSearchStores.ownerId, consultantId),
                  eq(fileSearchStores.ownerType, 'consultant')
                ))
                .limit(1);
              if (consultantStore) {
                const fileSearchService = new FileSearchService(consultantId);
                await fileSearchService.deleteDocumentBySource('knowledge_base', companion.id, consultantStore.id, consultantId);
              }
            } catch (fsErr: any) {
              console.warn(`⚠️ [SYSTEM PROMPT DOCS] Could not delete companion from FileSearch:`, fsErr.message);
            }
            if (companion.filePath) {
              try { await fs.unlink(path.join(process.cwd(), companion.filePath)); } catch {}
            }
            await db.delete(consultantKnowledgeDocuments).where(eq(consultantKnowledgeDocuments.id, companion.id));
            console.log(`🗑️ [SYSTEM PROMPT DOCS] Deleted KB companion doc ${companion.id} for system doc ${id}`);
          }
        } catch (err: any) {
          console.error('⚠️ [SYSTEM PROMPT DOCS] Failed to clean up companion KB docs:', err.message);
        }
      });

      res.json({ success: true, data: { id } });
    } catch (error: any) {
      console.error("❌ [SYSTEM PROMPT DOCS] Error deleting:", error);
      res.status(500).json({ success: false, error: error.message || "Failed to delete system prompt document" });
    }
  }
);

router.patch(
  "/consultant/knowledge/system-documents/:id/toggle",
  authenticateToken,
  requireRole("consultant"),
  async (req: Request, res: Response) => {
    try {
      const consultantId = (req as AuthRequest).user!.id;
      const { id } = req.params;

      const result = await db.execute(sql`
        UPDATE system_prompt_documents
        SET is_active = NOT is_active, updated_at = ${new Date()}
        WHERE id = ${id} AND consultant_id = ${consultantId}
        RETURNING *
      `);

      if (result.rows.length === 0) {
        return res.status(404).json({ success: false, error: "System prompt document not found" });
      }

      const toggled = result.rows[0] as any;
      if (toggled.injection_mode === 'file_search') {
        setImmediate(async () => {
          try {
            if (!toggled.is_active) {
              await fileSearchSyncService.removeSystemPromptDocumentFromFileSearch(id, consultantId, 'consultant');
              const autoAgents = (typeof toggled.target_autonomous_agents === 'string' ? JSON.parse(toggled.target_autonomous_agents) : toggled.target_autonomous_agents) || {};
              for (const agentId of Object.keys(autoAgents)) {
                await fileSearchSyncService.removeSystemPromptDocumentFromFileSearch(id, `${agentId}_${consultantId}`, 'autonomous_agent');
              }
              const waAgents = (typeof toggled.target_whatsapp_agents === 'string' ? JSON.parse(toggled.target_whatsapp_agents) : toggled.target_whatsapp_agents) || {};
              for (const agentId of Object.keys(waAgents)) {
                await fileSearchSyncService.removeSystemPromptDocumentFromFileSearch(id, agentId, 'whatsapp_agent');
              }
              const toggleDeptIds = (toggled.target_client_mode === 'specific_departments' && toggled.target_department_ids) ? (typeof toggled.target_department_ids === 'string' ? JSON.parse(toggled.target_department_ids) : toggled.target_department_ids) : [];
              for (const deptId of toggleDeptIds) {
                await fileSearchSyncService.removeSystemPromptDocumentFromFileSearch(id, deptId, 'department');
              }
            } else {
              if (toggled.target_client_assistant) {
                await fileSearchSyncService.syncSystemPromptDocumentToFileSearch(id, consultantId, 'client_assistant', consultantId, 'consultant');
              }
              const autoAgents = (typeof toggled.target_autonomous_agents === 'string' ? JSON.parse(toggled.target_autonomous_agents) : toggled.target_autonomous_agents) || {};
              for (const [agentId, enabled] of Object.entries(autoAgents)) {
                if (enabled) {
                  await fileSearchSyncService.syncSystemPromptDocumentToFileSearch(id, consultantId, 'autonomous_agent', agentId, 'autonomous_agent');
                }
              }
              const waAgents = (typeof toggled.target_whatsapp_agents === 'string' ? JSON.parse(toggled.target_whatsapp_agents) : toggled.target_whatsapp_agents) || {};
              for (const [agentId, enabled] of Object.entries(waAgents)) {
                if (enabled) {
                  await fileSearchSyncService.syncSystemPromptDocumentToFileSearch(id, consultantId, 'whatsapp_agent', agentId, 'whatsapp_agent');
                }
              }
              const toggledDeptIds = (toggled.target_client_mode === 'specific_departments' && toggled.target_department_ids) ? (typeof toggled.target_department_ids === 'string' ? JSON.parse(toggled.target_department_ids) : toggled.target_department_ids) : [];
              for (const deptId of toggledDeptIds) {
                await fileSearchSyncService.syncSystemPromptDocumentToFileSearch(id, consultantId, 'department', deptId, 'department');
              }
            }
          } catch (err: any) {
            console.error('❌ [SYSTEM PROMPT DOCS] Background file_search toggle sync failed:', err.message);
          }
        });
      }

      res.json({ success: true, data: toggled });
    } catch (error: any) {
      console.error("❌ [SYSTEM PROMPT DOCS] Error toggling:", error);
      res.status(500).json({ success: false, error: error.message || "Failed to toggle system prompt document" });
    }
  }
);

router.post(
  "/consultant/knowledge/system-documents/:id/sync",
  authenticateToken,
  requireRole("consultant"),
  async (req: Request, res: Response) => {
    try {
      const consultantId = (req as AuthRequest).user!.id;
      const { id } = req.params;

      const docResult = await db.execute(sql`
        SELECT id, google_drive_file_id FROM system_prompt_documents
        WHERE id = ${id} AND consultant_id = ${consultantId}
        LIMIT 1
      `);

      if (!docResult.rows?.length) {
        return res.status(404).json({ success: false, error: "Document not found" });
      }

      const doc = docResult.rows[0] as any;
      if (!doc.google_drive_file_id) {
        return res.status(400).json({ success: false, error: "Document is not linked to Google Drive" });
      }

      const { syncSystemDocFromDrive } = await import('../services/google-drive-sync-service');
      const success = await syncSystemDocFromDrive(id, 'manual', consultantId);

      if (success) {
        const updatedResult = await db.execute(sql`
          SELECT sync_count, last_drive_sync_at FROM system_prompt_documents WHERE id = ${id}
        `);
        res.json({ success: true, data: updatedResult.rows?.[0] || {} });
      } else {
        res.status(500).json({ success: false, error: "Sync failed" });
      }
    } catch (error: any) {
      console.error("❌ [SYSTEM PROMPT DOCS] Error syncing:", error);
      res.status(500).json({ success: false, error: error.message || "Failed to sync" });
    }
  }
);

router.get(
  "/consultant/knowledge/system-documents/:id/sync-history",
  authenticateToken,
  requireRole("consultant"),
  async (req: Request, res: Response) => {
    try {
      const consultantId = (req as AuthRequest).user!.id;
      const { id } = req.params;

      const result = await db.execute(sql`
        SELECT id, sync_type, status, previous_version, new_version,
               characters_extracted, estimated_tokens, error_message,
               duration_ms, started_at, completed_at
        FROM document_sync_history
        WHERE document_id = ${id} AND consultant_id = ${consultantId}
        ORDER BY started_at DESC
        LIMIT 20
      `);

      res.json({ success: true, data: result.rows });
    } catch (error: any) {
      console.error("❌ [SYSTEM PROMPT DOCS] Error fetching sync history:", error);
      res.status(500).json({ success: false, error: error.message || "Failed to fetch sync history" });
    }
  }
);

// ==================== SYSTEM DOCUMENT TEXT EXTRACTION ====================

router.post(
  "/consultant/knowledge/system-documents/extract-text",
  authenticateToken,
  requireRole("consultant"),
  upload.single("file"),
  async (req: AuthRequest, res) => {
    let uploadedFilePath: string | null = null;
    try {
      const file = req.file;
      if (!file) {
        return res.status(400).json({ success: false, error: "File is required" });
      }

      uploadedFilePath = file.path;

      if (file.size > MAX_FILE_SIZE) {
        await fs.unlink(uploadedFilePath).catch(() => {});
        return res.status(400).json({ success: false, error: `File troppo grande. Massimo ${MAX_FILE_SIZE / 1024 / 1024}MB` });
      }

      const TEXT_MIME_TYPES: Record<string, string> = {
        "application/pdf": "pdf",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
        "application/msword": "docx",
        "text/plain": "txt",
        "text/markdown": "md",
        "text/x-markdown": "md",
        "text/rtf": "rtf",
        "application/rtf": "rtf",
        "application/vnd.oasis.opendocument.text": "odt",
        "text/csv": "csv",
        "application/csv": "csv",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
        "application/vnd.ms-excel": "xls",
        "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
        "application/vnd.ms-powerpoint": "ppt",
      };

      const mimeType = file.mimetype;
      if (!TEXT_MIME_TYPES[mimeType]) {
        await fs.unlink(uploadedFilePath).catch(() => {});
        return res.status(400).json({ success: false, error: `Tipo di file non supportato: ${mimeType}` });
      }

      console.log(`📄 [SYSTEM DOC EXTRACT] Extracting text from ${file.originalname} (${mimeType})`);

      let extractedText: string;
      if (mimeType === "application/pdf") {
        const result = await extractTextFromPDFWithFallback(uploadedFilePath, file.originalname);
        extractedText = result.text;
      } else {
        extractedText = await extractTextFromFile(uploadedFilePath, mimeType);
      }

      await fs.unlink(uploadedFilePath).catch(() => {});
      uploadedFilePath = null;

      console.log(`✅ [SYSTEM DOC EXTRACT] Extracted ${extractedText.length} characters from ${file.originalname}`);

      res.json({
        success: true,
        data: {
          text: extractedText,
          fileName: file.originalname,
          characters: extractedText.length,
          estimatedTokens: Math.round(extractedText.length / 4),
        },
      });
    } catch (error: any) {
      if (uploadedFilePath) {
        await fs.unlink(uploadedFilePath).catch(() => {});
      }
      console.error("❌ [SYSTEM DOC EXTRACT] Error:", error);
      res.status(500).json({ success: false, error: error.message || "Errore nell'estrazione del testo" });
    }
  }
);

router.post(
  "/consultant/knowledge/system-documents/import-drive-text",
  authenticateToken,
  requireRole("consultant"),
  async (req: AuthRequest, res) => {
    let tempFilePath: string | null = null;
    try {
      const consultantId = req.user!.id;
      const { fileId, fileName: requestFileName } = req.body;

      if (!fileId) {
        return res.status(400).json({ success: false, error: "fileId is required" });
      }

      console.log(`📥 [SYSTEM DOC DRIVE] Importing text from Drive file ${fileId} for consultant ${consultantId}`);

      const { downloadDriveFile } = await import('../services/google-drive-service');
      const { filePath, fileName, mimeType } = await downloadDriveFile(consultantId, fileId);
      tempFilePath = filePath;

      let extractedText: string;
      if (mimeType === "application/pdf") {
        const result = await extractTextFromPDFWithFallback(filePath, fileName);
        extractedText = result.text;
      } else {
        extractedText = await extractTextFromFile(filePath, mimeType);
      }

      await fs.unlink(tempFilePath).catch(() => {});
      tempFilePath = null;

      console.log(`✅ [SYSTEM DOC DRIVE] Extracted ${extractedText.length} characters from ${fileName}`);

      res.json({
        success: true,
        data: {
          text: extractedText,
          fileName: requestFileName || fileName,
          fileId,
          characters: extractedText.length,
          estimatedTokens: Math.round(extractedText.length / 4),
        },
      });
    } catch (error: any) {
      if (tempFilePath) {
        await fs.unlink(tempFilePath).catch(() => {});
      }
      console.error("❌ [SYSTEM DOC DRIVE] Error:", error);
      res.status(500).json({ success: false, error: error.message || "Errore nell'importazione da Google Drive" });
    }
  }
);

// ==================== AGENT KNOWLEDGE ASSIGNMENTS ====================

router.get(
  "/consultant/knowledge/agent-assignments",
  authenticateToken,
  requireRole("consultant"),
  async (req: Request, res: Response) => {
    try {
      const consultantId = (req as AuthRequest).user!.id;
      const { agentId } = req.query;

      let result;
      if (agentId && typeof agentId === "string") {
        result = await db.execute(sql`
          SELECT id, consultant_id, agent_id, document_id, created_at
          FROM agent_knowledge_assignments
          WHERE consultant_id = ${consultantId} AND agent_id = ${agentId}
          ORDER BY created_at DESC
        `);
      } else {
        result = await db.execute(sql`
          SELECT id, consultant_id, agent_id, document_id, created_at
          FROM agent_knowledge_assignments
          WHERE consultant_id = ${consultantId}
          ORDER BY created_at DESC
        `);
      }

      res.json({ success: true, data: result.rows });
    } catch (error: any) {
      console.error("❌ [AGENT ASSIGNMENTS] Error listing:", error);
      res.status(500).json({ success: false, error: error.message || "Failed to list agent assignments" });
    }
  }
);

router.get(
  "/consultant/knowledge/agent-assignments/summary",
  authenticateToken,
  requireRole("consultant"),
  async (req: Request, res: Response) => {
    try {
      const consultantId = (req as AuthRequest).user!.id;

      const result = await db.execute(sql`
        SELECT agent_id, COUNT(*)::int as count
        FROM agent_knowledge_assignments
        WHERE consultant_id = ${consultantId}
        GROUP BY agent_id
        ORDER BY agent_id
      `);

      res.json({ success: true, data: result.rows });
    } catch (error: any) {
      console.error("❌ [AGENT ASSIGNMENTS] Error getting summary:", error);
      res.status(500).json({ success: false, error: error.message || "Failed to get assignment summary" });
    }
  }
);

router.get(
  "/consultant/knowledge/agent-assignments/by-document",
  authenticateToken,
  requireRole("consultant"),
  async (req: Request, res: Response) => {
    try {
      const consultantId = (req as AuthRequest).user!.id;

      const result = await db.execute(sql`
        SELECT document_id, array_agg(agent_id) as agent_ids
        FROM agent_knowledge_assignments
        WHERE consultant_id = ${consultantId}
        GROUP BY document_id
      `);

      const map: Record<string, string[]> = {};
      for (const row of result.rows as any[]) {
        map[row.document_id] = row.agent_ids;
      }

      res.json({ success: true, data: map });
    } catch (error: any) {
      console.error("❌ [AGENT ASSIGNMENTS] Error getting by-document map:", error);
      res.status(500).json({ success: false, error: error.message || "Failed to get document assignments" });
    }
  }
);

router.post(
  "/consultant/knowledge/agent-assignments",
  authenticateToken,
  requireRole("consultant"),
  async (req: Request, res: Response) => {
    try {
      const consultantId = (req as AuthRequest).user!.id;
      const { agent_id, document_id } = req.body;

      if (!agent_id || !document_id) {
        return res.status(400).json({ success: false, error: "agent_id and document_id are required" });
      }

      // Validate document ownership
      const docCheck = await db.execute(sql`
        SELECT id FROM consultant_knowledge_documents
        WHERE id = ${document_id} AND consultant_id = ${consultantId}
      `);
      if (docCheck.rows.length === 0) {
        return res.status(404).json({ success: false, error: "Document not found" });
      }

      const id = crypto.randomUUID();
      const now = new Date();

      const result = await db.execute(sql`
        INSERT INTO agent_knowledge_assignments (id, consultant_id, agent_id, document_id, created_at)
        VALUES (${id}, ${consultantId}, ${agent_id}, ${document_id}, ${now})
        ON CONFLICT (consultant_id, agent_id, document_id) DO NOTHING
        RETURNING *
      `);

      if (result.rows.length === 0) {
        return res.status(409).json({ success: false, error: "Assignment already exists" });
      }

      res.status(201).json({ success: true, data: result.rows[0] });
    } catch (error: any) {
      console.error("❌ [AGENT ASSIGNMENTS] Error creating:", error);
      res.status(500).json({ success: false, error: error.message || "Failed to create agent assignment" });
    }
  }
);

router.delete(
  "/consultant/knowledge/agent-assignments/:id",
  authenticateToken,
  requireRole("consultant"),
  async (req: Request, res: Response) => {
    try {
      const consultantId = (req as AuthRequest).user!.id;
      const { id } = req.params;

      const result = await db.execute(sql`
        DELETE FROM agent_knowledge_assignments
        WHERE id = ${id} AND consultant_id = ${consultantId}
        RETURNING id
      `);

      if (result.rows.length === 0) {
        return res.status(404).json({ success: false, error: "Assignment not found" });
      }

      res.json({ success: true, data: { id } });
    } catch (error: any) {
      console.error("❌ [AGENT ASSIGNMENTS] Error deleting:", error);
      res.status(500).json({ success: false, error: error.message || "Failed to delete agent assignment" });
    }
  }
);

router.post(
  "/consultant/knowledge/agent-assignments/bulk",
  authenticateToken,
  requireRole("consultant"),
  async (req: Request, res: Response) => {
    try {
      const consultantId = (req as AuthRequest).user!.id;
      const { agent_id, document_ids } = req.body;

      if (!agent_id || !Array.isArray(document_ids) || document_ids.length === 0) {
        return res.status(400).json({ success: false, error: "agent_id and document_ids[] are required" });
      }

      // Validate document ownership for all documents
      const docCheckResult = await db.execute(sql`
        SELECT id FROM consultant_knowledge_documents
        WHERE id = ANY(${document_ids}) AND consultant_id = ${consultantId}
      `);
      const validDocIds = new Set((docCheckResult.rows as any[]).map(r => r.id));
      const filteredDocIds = document_ids.filter((id: string) => validDocIds.has(id));

      if (filteredDocIds.length === 0) {
        return res.status(404).json({ success: false, error: "No valid documents found" });
      }

      const inserted: any[] = [];
      for (const docId of filteredDocIds) {
        const id = crypto.randomUUID();
        const now = new Date();
        const result = await db.execute(sql`
          INSERT INTO agent_knowledge_assignments (id, consultant_id, agent_id, document_id, created_at)
          VALUES (${id}, ${consultantId}, ${agent_id}, ${docId}, ${now})
          ON CONFLICT (consultant_id, agent_id, document_id) DO NOTHING
          RETURNING *
        `);
        if (result.rows.length > 0) {
          inserted.push(result.rows[0]);
        }
      }

      res.status(201).json({ success: true, data: inserted, insertedCount: inserted.length });
    } catch (error: any) {
      console.error("❌ [AGENT ASSIGNMENTS] Error bulk creating:", error);
      res.status(500).json({ success: false, error: error.message || "Failed to bulk create agent assignments" });
    }
  }
);

router.delete(
  "/consultant/knowledge/agent-assignments/bulk",
  authenticateToken,
  requireRole("consultant"),
  async (req: Request, res: Response) => {
    try {
      const consultantId = (req as AuthRequest).user!.id;
      const { agent_id, document_ids } = req.body;

      if (!agent_id || !Array.isArray(document_ids) || document_ids.length === 0) {
        return res.status(400).json({ success: false, error: "agent_id and document_ids[] are required" });
      }

      let deletedCount = 0;
      for (const docId of document_ids) {
        const result = await db.execute(sql`
          DELETE FROM agent_knowledge_assignments
          WHERE consultant_id = ${consultantId} AND agent_id = ${agent_id} AND document_id = ${docId}
          RETURNING id
        `);
        deletedCount += result.rows.length;
      }

      res.json({ success: true, data: { deletedCount } });
    } catch (error: any) {
      console.error("❌ [AGENT ASSIGNMENTS] Error bulk deleting:", error);
      res.status(500).json({ success: false, error: error.message || "Failed to bulk delete agent assignments" });
    }
  }
);

router.get(
  "/consultant/knowledge/agent-assignments/:agentId/documents",
  authenticateToken,
  requireRole("consultant"),
  async (req: Request, res: Response) => {
    try {
      const consultantId = (req as AuthRequest).user!.id;
      const { agentId } = req.params;

      const result = await db.execute(sql`
        SELECT a.id as assignment_id, a.agent_id, a.document_id, a.created_at as assigned_at,
               d.title, d.description, d.category, d.file_name, d.file_type, d.file_size,
               d.status, d.priority, d.created_at as document_created_at, d.updated_at as document_updated_at
        FROM agent_knowledge_assignments a
        JOIN consultant_knowledge_documents d ON d.id = a.document_id
        WHERE a.consultant_id = ${consultantId} AND a.agent_id = ${agentId}
        ORDER BY d.title ASC
      `);

      res.json({ success: true, data: result.rows });
    } catch (error: any) {
      console.error("❌ [AGENT ASSIGNMENTS] Error getting agent documents:", error);
      res.status(500).json({ success: false, error: error.message || "Failed to get agent documents" });
    }
  }
);

export default router;
