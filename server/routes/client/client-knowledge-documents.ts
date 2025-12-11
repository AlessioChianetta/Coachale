import { Router } from "express";
import { authenticateToken, requireRole, type AuthRequest } from "../../middleware/auth";
import { upload } from "../../middleware/upload";
import { db } from "../../db";
import {
  clientKnowledgeDocuments,
  clientKnowledgeApis,
  updateClientKnowledgeDocumentSchema,
} from "../../../shared/schema";
import { eq, and, desc } from "drizzle-orm";
import { extractTextFromFile } from "../../services/document-processor";
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";

const router = Router();

const CLIENT_KNOWLEDGE_UPLOAD_DIR = "uploads/client-knowledge";
const MAX_FILE_SIZE = 10 * 1024 * 1024;

const ALLOWED_MIME_TYPES: Record<string, "pdf" | "docx" | "txt"> = {
  "application/pdf": "pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/msword": "docx",
  "text/plain": "txt",
};

async function ensureUploadDir() {
  const dir = path.join(process.cwd(), CLIENT_KNOWLEDGE_UPLOAD_DIR);
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

router.get(
  "/client/knowledge/documents",
  authenticateToken,
  requireRole("client"),
  async (req: AuthRequest, res) => {
    try {
      const clientId = req.user!.id;

      const documents = await db
        .select()
        .from(clientKnowledgeDocuments)
        .where(eq(clientKnowledgeDocuments.clientId, clientId))
        .orderBy(desc(clientKnowledgeDocuments.createdAt));

      res.json({
        success: true,
        data: documents,
        count: documents.length,
      });
    } catch (error: any) {
      console.error("❌ [CLIENT KNOWLEDGE DOCUMENTS] Error listing documents:", error);
      res.status(500).json({
        success: false,
        error: error.message || "Failed to list knowledge documents",
      });
    }
  }
);

router.get(
  "/client/knowledge/documents/:id",
  authenticateToken,
  requireRole("client"),
  async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const clientId = req.user!.id;

      const [document] = await db
        .select()
        .from(clientKnowledgeDocuments)
        .where(
          and(
            eq(clientKnowledgeDocuments.id, id),
            eq(clientKnowledgeDocuments.clientId, clientId)
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
      console.error("❌ [CLIENT KNOWLEDGE DOCUMENTS] Error fetching document:", error);
      res.status(500).json({
        success: false,
        error: error.message || "Failed to fetch knowledge document",
      });
    }
  }
);

router.post(
  "/client/knowledge/documents",
  authenticateToken,
  requireRole("client"),
  upload.single("file"),
  async (req: AuthRequest, res) => {
    let uploadedFilePath: string | null = null;
    let finalFilePath: string | null = null;

    try {
      const clientId = req.user!.id;
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
          error: "Invalid file type. Allowed types: PDF, DOCX, TXT",
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
        .insert(clientKnowledgeDocuments)
        .values({
          id: documentId,
          clientId,
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

      console.log(`📄 [CLIENT KNOWLEDGE DOCUMENTS] Created document: "${title}" (status: processing)`);

      (async () => {
        try {
          console.log(`🔄 [CLIENT KNOWLEDGE DOCUMENTS] Extracting text from: ${file.originalname}`);
          const extractedContent = await extractTextFromFile(finalFilePath!, file.mimetype);

          await db
            .update(clientKnowledgeDocuments)
            .set({
              extractedContent,
              status: "indexed",
              updatedAt: new Date(),
            })
            .where(eq(clientKnowledgeDocuments.id, documentId));

          console.log(`✅ [CLIENT KNOWLEDGE DOCUMENTS] Document indexed: "${title}"`);
        } catch (extractError: any) {
          console.error(`❌ [CLIENT KNOWLEDGE DOCUMENTS] Text extraction failed:`, extractError.message);
          await db
            .update(clientKnowledgeDocuments)
            .set({
              status: "error",
              errorMessage: extractError.message,
              updatedAt: new Date(),
            })
            .where(eq(clientKnowledgeDocuments.id, documentId));
        }
      })();

      res.status(201).json({
        success: true,
        data: newDocument,
        message: "Document uploaded successfully. Text extraction in progress.",
      });
    } catch (error: any) {
      console.error("❌ [CLIENT KNOWLEDGE DOCUMENTS] Error uploading document:", error);

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
  "/client/knowledge/documents/:id",
  authenticateToken,
  requireRole("client"),
  async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const clientId = req.user!.id;

      const [existingDocument] = await db
        .select()
        .from(clientKnowledgeDocuments)
        .where(
          and(
            eq(clientKnowledgeDocuments.id, id),
            eq(clientKnowledgeDocuments.clientId, clientId)
          )
        )
        .limit(1);

      if (!existingDocument) {
        return res.status(404).json({
          success: false,
          error: "Document not found",
        });
      }

      const validationResult = updateClientKnowledgeDocumentSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({
          success: false,
          error: "Validation failed",
          details: validationResult.error.errors,
        });
      }

      const updateData = validationResult.data;

      const [updatedDocument] = await db
        .update(clientKnowledgeDocuments)
        .set({
          ...updateData,
          updatedAt: new Date(),
        })
        .where(eq(clientKnowledgeDocuments.id, id))
        .returning();

      console.log(`✏️ [CLIENT KNOWLEDGE DOCUMENTS] Updated document: "${updatedDocument.title}"`);

      res.json({
        success: true,
        data: updatedDocument,
        message: "Document updated successfully",
      });
    } catch (error: any) {
      console.error("❌ [CLIENT KNOWLEDGE DOCUMENTS] Error updating document:", error);
      res.status(500).json({
        success: false,
        error: error.message || "Failed to update knowledge document",
      });
    }
  }
);

router.delete(
  "/client/knowledge/documents/:id",
  authenticateToken,
  requireRole("client"),
  async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const clientId = req.user!.id;

      const [document] = await db
        .select()
        .from(clientKnowledgeDocuments)
        .where(
          and(
            eq(clientKnowledgeDocuments.id, id),
            eq(clientKnowledgeDocuments.clientId, clientId)
          )
        )
        .limit(1);

      if (!document) {
        return res.status(404).json({
          success: false,
          error: "Document not found",
        });
      }

      if (document.filePath) {
        try {
          await fs.unlink(document.filePath);
          console.log(`🗑️ [CLIENT KNOWLEDGE DOCUMENTS] Deleted file: ${document.filePath}`);
        } catch (fileError: any) {
          console.warn(`⚠️ [CLIENT KNOWLEDGE DOCUMENTS] Could not delete file: ${fileError.message}`);
        }
      }

      await db
        .delete(clientKnowledgeDocuments)
        .where(eq(clientKnowledgeDocuments.id, id));

      console.log(`🗑️ [CLIENT KNOWLEDGE DOCUMENTS] Deleted document: "${document.title}"`);

      res.json({
        success: true,
        message: "Document deleted successfully",
      });
    } catch (error: any) {
      console.error("❌ [CLIENT KNOWLEDGE DOCUMENTS] Error deleting document:", error);
      res.status(500).json({
        success: false,
        error: error.message || "Failed to delete knowledge document",
      });
    }
  }
);

router.post(
  "/client/knowledge/documents/:id/toggle-summary",
  authenticateToken,
  requireRole("client"),
  async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const clientId = req.user!.id;
      const { enabled } = req.body;

      const [document] = await db
        .select()
        .from(clientKnowledgeDocuments)
        .where(
          and(
            eq(clientKnowledgeDocuments.id, id),
            eq(clientKnowledgeDocuments.clientId, clientId)
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

      if (enabled && !contentSummary && document.extractedContent) {
        const extractedText = document.extractedContent;
        contentSummary = extractedText.length > 500 
          ? extractedText.substring(0, 500) + '... [Riassunto estratto automaticamente]'
          : extractedText;
      }

      const [updatedDocument] = await db
        .update(clientKnowledgeDocuments)
        .set({
          summaryEnabled: enabled,
          contentSummary: enabled ? contentSummary : null,
          updatedAt: new Date(),
        })
        .where(eq(clientKnowledgeDocuments.id, id))
        .returning();

      console.log(`📝 [CLIENT KNOWLEDGE DOCUMENTS] Summary ${enabled ? 'enabled' : 'disabled'} for: "${document.title}"`);

      res.json({
        success: true,
        data: updatedDocument,
        message: enabled ? "Riassunto abilitato" : "Riassunto disabilitato",
      });
    } catch (error: any) {
      console.error("❌ [CLIENT KNOWLEDGE DOCUMENTS] Error toggling summary:", error);
      res.status(500).json({
        success: false,
        error: error.message || "Failed to toggle summary",
      });
    }
  }
);

router.put(
  "/client/knowledge/documents/:id/tags",
  authenticateToken,
  requireRole("client"),
  async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const clientId = req.user!.id;
      const { tags } = req.body;

      if (!Array.isArray(tags)) {
        return res.status(400).json({
          success: false,
          error: "Tags must be an array of strings",
        });
      }

      const [document] = await db
        .select()
        .from(clientKnowledgeDocuments)
        .where(
          and(
            eq(clientKnowledgeDocuments.id, id),
            eq(clientKnowledgeDocuments.clientId, clientId)
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
        .update(clientKnowledgeDocuments)
        .set({
          tags: cleanTags,
          updatedAt: new Date(),
        })
        .where(eq(clientKnowledgeDocuments.id, id))
        .returning();

      console.log(`🏷️ [CLIENT KNOWLEDGE DOCUMENTS] Updated tags for: "${document.title}" -> [${cleanTags.join(', ')}]`);

      res.json({
        success: true,
        data: updatedDocument,
        message: "Tags aggiornati",
      });
    } catch (error: any) {
      console.error("❌ [CLIENT KNOWLEDGE DOCUMENTS] Error updating tags:", error);
      res.status(500).json({
        success: false,
        error: error.message || "Failed to update tags",
      });
    }
  }
);

router.get(
  "/client/knowledge/documents/:id/preview",
  authenticateToken,
  requireRole("client"),
  async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const clientId = req.user!.id;

      const [document] = await db
        .select()
        .from(clientKnowledgeDocuments)
        .where(
          and(
            eq(clientKnowledgeDocuments.id, id),
            eq(clientKnowledgeDocuments.clientId, clientId)
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
      console.error("❌ [CLIENT KNOWLEDGE DOCUMENTS] Error fetching preview:", error);
      res.status(500).json({
        success: false,
        error: error.message || "Failed to fetch document preview",
      });
    }
  }
);

router.get(
  "/client/knowledge/stats",
  authenticateToken,
  requireRole("client"),
  async (req: AuthRequest, res) => {
    try {
      const clientId = req.user!.id;

      const documents = await db
        .select()
        .from(clientKnowledgeDocuments)
        .where(eq(clientKnowledgeDocuments.clientId, clientId));

      const apis = await db
        .select()
        .from(clientKnowledgeApis)
        .where(eq(clientKnowledgeApis.clientId, clientId));

      const totalDocuments = documents.length;
      const indexedDocuments = documents.filter(d => d.status === 'indexed').length;
      const processingDocuments = documents.filter(d => d.status === 'processing').length;
      const errorDocuments = documents.filter(d => d.status === 'error').length;
      
      const totalApis = apis.length;
      const activeApis = apis.filter(a => a.isActive).length;
      
      const totalDocUsage = documents.reduce((sum, d) => sum + (d.usageCount || 0), 0);
      const totalApiUsage = apis.reduce((sum, a) => sum + (a.usageCount || 0), 0);
      
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
      console.error("❌ [CLIENT KNOWLEDGE STATS] Error fetching stats:", error);
      res.status(500).json({
        success: false,
        error: error.message || "Failed to fetch knowledge stats",
      });
    }
  }
);

export default router;
