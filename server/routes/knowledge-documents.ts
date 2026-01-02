import { Router, Request, Response } from "express";
import { authenticateToken, requireRole, type AuthRequest } from "../middleware/auth";
import { upload } from "../middleware/upload";
import { db } from "../db";
import {
  consultantKnowledgeDocuments,
  consultantKnowledgeApis,
  updateConsultantKnowledgeDocumentSchema,
  vertexAiSettings,
} from "../../shared/schema";
import { eq, and, desc } from "drizzle-orm";
import { extractTextFromFile, type VertexAICredentials } from "../services/document-processor";
import { parseServiceAccountJson } from "../ai/provider-factory";
import { fileSearchSyncService, syncProgressEmitter, type DocumentProgressEvent } from "../services/file-search-sync-service";
import { FileSearchService } from "../ai/file-search-service";
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
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

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
        })
        .from(consultantKnowledgeDocuments)
        .where(eq(consultantKnowledgeDocuments.consultantId, consultantId))
        .orderBy(desc(consultantKnowledgeDocuments.createdAt));

      res.json({
        success: true,
        data: documents,
        count: documents.length,
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
          
          const extractedContent = await extractTextFromFile(finalFilePath!, file.mimetype, vertexCredentials);
          
          syncProgressEmitter.emitDocumentProgress(documentId, "extracting_complete", 40, "Testo estratto con successo");

          await db
            .update(consultantKnowledgeDocuments)
            .set({
              extractedContent,
              status: "indexed",
              updatedAt: new Date(),
            })
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

      // Delete from FileSearch first (pass consultantId for proper API credential resolution)
      try {
        const deleteResult = await fileSearchService.deleteDocumentBySource(
          'knowledge_base',
          id,
          consultantId
        );
        if (deleteResult.deleted > 0) {
          console.log(`🗑️ [KNOWLEDGE DOCUMENTS] Deleted ${deleteResult.deleted} document(s) from FileSearch`);
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

export default router;
