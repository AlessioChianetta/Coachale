import { Router } from "express";
import { authenticateToken, requireRole, type AuthRequest } from "../../middleware/auth";
import { db } from "../../db";
import { consultantAvailabilitySettings, clientKnowledgeDocuments, users } from "../../../shared/schema";
import { eq } from "drizzle-orm";
import { extractTextFromFile } from "../../services/document-processor";
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import {
  listDriveFolders,
  listDriveFiles,
  downloadDriveFile,
  isDriveConnected
} from "../../services/google-drive-service";

const router = Router();

const CLIENT_KNOWLEDGE_UPLOAD_DIR = "uploads/client-knowledge";

async function ensureUploadDir() {
  const dir = path.join(process.cwd(), CLIENT_KNOWLEDGE_UPLOAD_DIR);
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

async function getClientConsultantId(clientId: string): Promise<string | null> {
  const [client] = await db
    .select()
    .from(users)
    .where(eq(users.id, clientId))
    .limit(1);
  
  return client?.consultantId || null;
}

router.get(
  "/client/google-drive/status",
  authenticateToken,
  requireRole("client"),
  async (req: AuthRequest, res) => {
    try {
      const clientId = req.user!.id;
      const consultantId = await getClientConsultantId(clientId);
      
      if (!consultantId) {
        return res.json({
          success: true,
          connected: false,
          error: "No consultant assigned"
        });
      }
      
      const [settings] = await db
        .select()
        .from(consultantAvailabilitySettings)
        .where(eq(consultantAvailabilitySettings.consultantId, consultantId))
        .limit(1);
      
      const connected = !!(settings?.googleDriveRefreshToken);
      
      res.json({
        success: true,
        connected,
        email: settings?.googleDriveEmail || null
      });
    } catch (error: any) {
      console.error("❌ [CLIENT GOOGLE DRIVE] Error checking status:", error);
      res.status(500).json({
        success: false,
        error: error.message || "Failed to check Google Drive status"
      });
    }
  }
);

router.get(
  "/client/google-drive/folders",
  authenticateToken,
  requireRole("client"),
  async (req: AuthRequest, res) => {
    try {
      const clientId = req.user!.id;
      const consultantId = await getClientConsultantId(clientId);
      const parentId = req.query.parentId as string | undefined;
      
      if (!consultantId) {
        return res.status(400).json({
          success: false,
          error: "No consultant assigned"
        });
      }
      
      const connected = await isDriveConnected(consultantId);
      if (!connected) {
        return res.status(400).json({
          success: false,
          error: "Consultant has not connected Google Drive"
        });
      }
      
      const folders = await listDriveFolders(consultantId, parentId);
      
      res.json({
        success: true,
        data: folders
      });
    } catch (error: any) {
      console.error("❌ [CLIENT GOOGLE DRIVE] Error listing folders:", error);
      res.status(500).json({
        success: false,
        error: error.message || "Failed to list folders"
      });
    }
  }
);

router.get(
  "/client/google-drive/files",
  authenticateToken,
  requireRole("client"),
  async (req: AuthRequest, res) => {
    try {
      const clientId = req.user!.id;
      const consultantId = await getClientConsultantId(clientId);
      const parentId = req.query.parentId as string | undefined;
      
      if (!consultantId) {
        return res.status(400).json({
          success: false,
          error: "No consultant assigned"
        });
      }
      
      const connected = await isDriveConnected(consultantId);
      if (!connected) {
        return res.status(400).json({
          success: false,
          error: "Consultant has not connected Google Drive"
        });
      }
      
      const files = await listDriveFiles(consultantId, parentId);
      
      res.json({
        success: true,
        data: files
      });
    } catch (error: any) {
      console.error("❌ [CLIENT GOOGLE DRIVE] Error listing files:", error);
      res.status(500).json({
        success: false,
        error: error.message || "Failed to list files"
      });
    }
  }
);

router.post(
  "/client/google-drive/import",
  authenticateToken,
  requireRole("client"),
  async (req: AuthRequest, res) => {
    let tempFilePath: string | null = null;
    let finalFilePath: string | null = null;
    
    try {
      const clientId = req.user!.id;
      const consultantId = await getClientConsultantId(clientId);
      const { fileId, title, description, category, priority } = req.body;
      
      if (!consultantId) {
        return res.status(400).json({
          success: false,
          error: "No consultant assigned"
        });
      }
      
      if (!fileId) {
        return res.status(400).json({
          success: false,
          error: "File ID is required"
        });
      }
      
      const connected = await isDriveConnected(consultantId);
      if (!connected) {
        return res.status(400).json({
          success: false,
          error: "Consultant has not connected Google Drive"
        });
      }
      
      console.log(`📥 [CLIENT GOOGLE DRIVE] Importing file ${fileId} for client ${clientId}`);
      
      const { filePath, fileName, mimeType } = await downloadDriveFile(consultantId, fileId);
      tempFilePath = filePath;
      
      const ALLOWED_MIME_TYPES: Record<string, "pdf" | "docx" | "txt"> = {
        "application/pdf": "pdf",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
        "application/msword": "docx",
        "text/plain": "txt",
        "text/markdown": "txt",
        "text/csv": "txt",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "docx",
        "application/vnd.ms-excel": "docx"
      };
      
      const fileType = ALLOWED_MIME_TYPES[mimeType];
      if (!fileType) {
        await fs.unlink(tempFilePath).catch(() => {});
        return res.status(400).json({
          success: false,
          error: `Unsupported file type: ${mimeType}`
        });
      }
      
      const fileStats = await fs.stat(tempFilePath);
      const fileSize = fileStats.size;
      
      const uploadDir = await ensureUploadDir();
      const uniqueFileName = `${crypto.randomUUID()}${path.extname(fileName)}`;
      finalFilePath = path.join(uploadDir, uniqueFileName);
      
      await fs.copyFile(tempFilePath, finalFilePath);
      await fs.unlink(tempFilePath).catch(() => {});
      tempFilePath = null;
      
      const documentId = crypto.randomUUID();
      const documentTitle = title?.trim() || fileName.replace(/\.[^/.]+$/, '');
      
      const [newDocument] = await db
        .insert(clientKnowledgeDocuments)
        .values({
          id: documentId,
          clientId,
          title: documentTitle,
          description: description?.trim() || `Imported from Google Drive: ${fileName}`,
          category: category || "other",
          fileName,
          fileType,
          fileSize,
          filePath: finalFilePath,
          priority: priority ? parseInt(priority, 10) : 5,
          status: "processing"
        })
        .returning();
      
      console.log(`📄 [CLIENT GOOGLE DRIVE] Created document: "${documentTitle}" (status: processing)`);
      
      (async () => {
        try {
          console.log(`🔄 [CLIENT GOOGLE DRIVE] Extracting text from: ${fileName}`);
          const extractedContent = await extractTextFromFile(finalFilePath!, mimeType);
          
          await db
            .update(clientKnowledgeDocuments)
            .set({
              extractedContent,
              status: "indexed",
              updatedAt: new Date()
            })
            .where(eq(clientKnowledgeDocuments.id, documentId));
          
          console.log(`✅ [CLIENT GOOGLE DRIVE] Document indexed: "${documentTitle}"`);
        } catch (extractError: any) {
          console.error(`❌ [CLIENT GOOGLE DRIVE] Text extraction failed for ${fileName}:`, extractError);
          await db
            .update(clientKnowledgeDocuments)
            .set({
              status: "failed",
              updatedAt: new Date()
            })
            .where(eq(clientKnowledgeDocuments.id, documentId));
        }
      })();
      
      res.json({
        success: true,
        data: {
          id: newDocument.id,
          title: newDocument.title,
          fileName: newDocument.fileName,
          status: newDocument.status
        },
        message: "Document imported successfully. Text extraction in progress."
      });
    } catch (error: any) {
      console.error("❌ [CLIENT GOOGLE DRIVE] Error importing file:", error);
      
      if (tempFilePath) {
        await fs.unlink(tempFilePath).catch(() => {});
      }
      if (finalFilePath) {
        await fs.unlink(finalFilePath).catch(() => {});
      }
      
      res.status(500).json({
        success: false,
        error: error.message || "Failed to import file from Google Drive"
      });
    }
  }
);

export default router;
