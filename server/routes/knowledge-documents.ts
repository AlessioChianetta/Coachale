import { Router } from "express";
import { authenticateToken, requireRole, type AuthRequest } from "../middleware/auth";
import { upload } from "../middleware/upload";
import { db } from "../db";
import {
  consultantKnowledgeDocuments,
  updateConsultantKnowledgeDocumentSchema,
} from "../../shared/schema";
import { eq, and, desc } from "drizzle-orm";
import { extractTextFromFile } from "../services/document-processor";
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";

const router = Router();

const KNOWLEDGE_UPLOAD_DIR = "uploads/knowledge";
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

const ALLOWED_MIME_TYPES: Record<string, "pdf" | "docx" | "txt"> = {
  "application/pdf": "pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/msword": "docx",
  "text/plain": "txt",
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
        .select()
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
          const extractedContent = await extractTextFromFile(finalFilePath!, file.mimetype);

          await db
            .update(consultantKnowledgeDocuments)
            .set({
              extractedContent,
              status: "indexed",
              updatedAt: new Date(),
            })
            .where(eq(consultantKnowledgeDocuments.id, documentId));

          console.log(`✅ [KNOWLEDGE DOCUMENTS] Document indexed: "${title}"`);
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

export default router;
