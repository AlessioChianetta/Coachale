import { Router } from "express";
import { authenticateToken, requireRole, type AuthRequest } from "../../middleware/auth";
import { db } from "../../db";
import { consultantAvailabilitySettings, clientKnowledgeDocuments, users, vertexAiSettings } from "../../../shared/schema";
import { eq } from "drizzle-orm";
import { extractTextFromFile, type VertexAICredentials } from "../../services/document-processor";
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
    try {
      const clientId = req.user!.id;
      const consultantId = await getClientConsultantId(clientId);
      const { fileIds, fileId, title, description, category, priority } = req.body;
      
      if (!consultantId) {
        return res.status(400).json({
          success: false,
          error: "No consultant assigned"
        });
      }
      
      const idsToImport: string[] = fileIds || (fileId ? [fileId] : []);
      
      if (idsToImport.length === 0) {
        return res.status(400).json({
          success: false,
          error: "At least one file ID is required"
        });
      }
      
      const connected = await isDriveConnected(consultantId);
      if (!connected) {
        return res.status(400).json({
          success: false,
          error: "Consultant has not connected Google Drive"
        });
      }
      
      console.log(`📥 [CLIENT GOOGLE DRIVE] Importing ${idsToImport.length} file(s) for client ${clientId}`);
      
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
        "audio/x-m4a": "m4a",
        "audio/m4a": "m4a",
        "audio/ogg": "ogg",
        "audio/webm": "webm_audio"
      };
      
      const results: { imported: number; failed: number; errors: string[] } = {
        imported: 0,
        failed: 0,
        errors: []
      };
      
      for (const currentFileId of idsToImport) {
        let tempFilePath: string | null = null;
        let finalFilePath: string | null = null;
        
        try {
          const { filePath, fileName, mimeType } = await downloadDriveFile(consultantId, currentFileId);
          tempFilePath = filePath;
          
          const fileType = ALLOWED_MIME_TYPES[mimeType];
          if (!fileType) {
            await fs.unlink(tempFilePath).catch(() => {});
            results.failed++;
            results.errors.push(`${fileName}: Unsupported file type (${mimeType})`);
            continue;
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
          const documentTitle = (idsToImport.length === 1 && title?.trim()) 
            ? title.trim() 
            : fileName.replace(/\.[^/.]+$/, '');
          
          const [newDocument] = await db
            .insert(clientKnowledgeDocuments)
            .values({
              id: documentId,
              clientId,
              title: documentTitle,
              description: (idsToImport.length === 1 && description?.trim()) 
                ? description.trim() 
                : `Imported from Google Drive: ${fileName}`,
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
          
          const storedFilePath = finalFilePath;
          const storedMimeType = mimeType;
          const storedFileName = fileName;
          const storedConsultantId = consultantId;
          (async () => {
            try {
              console.log(`🔄 [CLIENT GOOGLE DRIVE] Extracting text from: ${storedFileName}`);
              
              let vertexCredentials: VertexAICredentials | undefined;
              if (storedMimeType.startsWith('audio/') && storedConsultantId) {
                const [aiSettings] = await db
                  .select()
                  .from(vertexAiSettings)
                  .where(eq(vertexAiSettings.userId, storedConsultantId))
                  .limit(1);
                
                if (aiSettings?.serviceAccountJson) {
                  const serviceAccount = JSON.parse(aiSettings.serviceAccountJson);
                  vertexCredentials = {
                    projectId: serviceAccount.project_id,
                    location: 'us-central1',
                    credentials: serviceAccount
                  };
                  console.log(`🔑 [CLIENT GOOGLE DRIVE] Using Vertex AI credentials for audio transcription`);
                }
              }
              
              const extractedContent = await extractTextFromFile(storedFilePath, storedMimeType, vertexCredentials);
              
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
          
          results.imported++;
        } catch (fileError: any) {
          console.error(`❌ [CLIENT GOOGLE DRIVE] Error importing file ${currentFileId}:`, fileError);
          results.failed++;
          results.errors.push(fileError.message || `Failed to import file ${currentFileId}`);
          
          if (tempFilePath) {
            await fs.unlink(tempFilePath).catch(() => {});
          }
          if (finalFilePath) {
            await fs.unlink(finalFilePath).catch(() => {});
          }
        }
      }
      
      res.json({
        success: results.imported > 0,
        imported: results.imported,
        failed: results.failed,
        errors: results.errors.length > 0 ? results.errors : undefined,
        message: `${results.imported} file(s) imported successfully${results.failed > 0 ? `, ${results.failed} failed` : ''}. Text extraction in progress.`
      });
    } catch (error: any) {
      console.error("❌ [CLIENT GOOGLE DRIVE] Error in import:", error);
      res.status(500).json({
        success: false,
        error: error.message || "Failed to import files from Google Drive"
      });
    }
  }
);

export default router;
