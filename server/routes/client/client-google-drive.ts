import { Router } from "express";
import { authenticateToken, requireRole, type AuthRequest } from "../../middleware/auth";
import { db } from "../../db";
import { clientKnowledgeDocuments, users, vertexAiSettings } from "../../../shared/schema";
import { eq } from "drizzle-orm";
import { extractTextFromFile, type VertexAICredentials } from "../../services/document-processor";
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import {
  buildBaseUrlFromRequest,
  getClientDriveAuthorizationUrl,
  exchangeClientDriveCodeForTokens,
  getClientDriveUserEmail,
  listClientDriveFolders,
  listClientDriveFiles,
  downloadClientDriveFile,
  isClientDriveConnected,
  disconnectClientDrive
} from "../../services/google-drive-service";

const router = Router();

const CLIENT_KNOWLEDGE_UPLOAD_DIR = "uploads/client-knowledge";

async function ensureUploadDir() {
  const dir = path.join(process.cwd(), CLIENT_KNOWLEDGE_UPLOAD_DIR);
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

// Check client's own Google Drive connection status
router.get(
  "/client/google-drive/status",
  authenticateToken,
  requireRole("client"),
  async (req: AuthRequest, res) => {
    try {
      const clientId = req.user!.id;
      
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, clientId))
        .limit(1);
      
      const connected = !!(user?.googleDriveRefreshToken);
      
      res.json({
        success: true,
        connected,
        email: user?.googleDriveEmail || null,
        connectedAt: user?.googleDriveConnectedAt || null
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

// Initiate OAuth flow for client's own Google Drive
router.get(
  "/client/google-drive/connect",
  authenticateToken,
  requireRole("client"),
  async (req: AuthRequest, res) => {
    try {
      const clientId = req.user!.id;
      const baseUrl = buildBaseUrlFromRequest(req);
      
      const authUrl = await getClientDriveAuthorizationUrl(clientId, baseUrl);
      
      res.json({
        success: true,
        authUrl
      });
    } catch (error: any) {
      console.error("❌ [CLIENT GOOGLE DRIVE] Error generating auth URL:", error);
      res.status(500).json({
        success: false,
        error: error.message || "Failed to generate Google Drive authorization URL"
      });
    }
  }
);

// OAuth callback for client's Google Drive
router.get(
  "/client/google-drive/callback",
  async (req, res) => {
    try {
      const { code, state, error } = req.query;
      
      if (error) {
        console.error("❌ [CLIENT GOOGLE DRIVE] OAuth error:", error);
        return res.redirect('/client/knowledge-documents?drive_error=' + encodeURIComponent(String(error)));
      }
      
      if (!code || !state) {
        return res.redirect('/client/knowledge-documents?drive_error=missing_params');
      }
      
      const clientId = state as string;
      const baseUrl = buildBaseUrlFromRequest(req);
      
      console.log(`🔄 [CLIENT GOOGLE DRIVE] Processing OAuth callback for client ${clientId}`);
      
      const tokens = await exchangeClientDriveCodeForTokens(code as string, clientId, baseUrl);
      
      const connectedAt = new Date();
      
      await db
        .update(users)
        .set({
          googleDriveRefreshToken: tokens.refreshToken,
          googleDriveAccessToken: tokens.accessToken,
          googleDriveTokenExpiresAt: tokens.expiresAt,
          googleDriveConnectedAt: connectedAt
        })
        .where(eq(users.id, clientId));
      
      // Get the user's email
      const userEmail = await getClientDriveUserEmail(clientId);
      if (userEmail) {
        await db
          .update(users)
          .set({ 
            googleDriveEmail: userEmail
          })
          .where(eq(users.id, clientId));
      }
      
      console.log(`✅ [CLIENT GOOGLE DRIVE] Connected for client ${clientId} (${userEmail})`);
      
      res.redirect('/client/knowledge-documents?drive_connected=true');
    } catch (error: any) {
      console.error("❌ [CLIENT GOOGLE DRIVE] OAuth callback error:", error);
      res.redirect('/client/knowledge-documents?drive_error=' + encodeURIComponent(error.message || 'Unknown error'));
    }
  }
);

// Disconnect client's Google Drive
router.post(
  "/client/google-drive/disconnect",
  authenticateToken,
  requireRole("client"),
  async (req: AuthRequest, res) => {
    try {
      const clientId = req.user!.id;
      
      await disconnectClientDrive(clientId);
      
      res.json({
        success: true,
        message: "Google Drive disconnected successfully"
      });
    } catch (error: any) {
      console.error("❌ [CLIENT GOOGLE DRIVE] Error disconnecting:", error);
      res.status(500).json({
        success: false,
        error: error.message || "Failed to disconnect Google Drive"
      });
    }
  }
);

// List folders from client's own Google Drive
router.get(
  "/client/google-drive/folders",
  authenticateToken,
  requireRole("client"),
  async (req: AuthRequest, res) => {
    try {
      const clientId = req.user!.id;
      const parentId = req.query.parentId as string | undefined;
      
      const connected = await isClientDriveConnected(clientId);
      if (!connected) {
        return res.status(400).json({
          success: false,
          error: "Google Drive not connected"
        });
      }
      
      const folders = await listClientDriveFolders(clientId, parentId);
      
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

// List files from client's own Google Drive
router.get(
  "/client/google-drive/files",
  authenticateToken,
  requireRole("client"),
  async (req: AuthRequest, res) => {
    try {
      const clientId = req.user!.id;
      const parentId = req.query.parentId as string | undefined;
      
      const connected = await isClientDriveConnected(clientId);
      if (!connected) {
        return res.status(400).json({
          success: false,
          error: "Google Drive not connected"
        });
      }
      
      const files = await listClientDriveFiles(clientId, parentId);
      
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

// Import files from client's own Google Drive
router.post(
  "/client/google-drive/import",
  authenticateToken,
  requireRole("client"),
  async (req: AuthRequest, res) => {
    try {
      const clientId = req.user!.id;
      const { fileIds, fileId, title, description, category, priority } = req.body;
      
      const idsToImport: string[] = fileIds || (fileId ? [fileId] : []);
      
      if (idsToImport.length === 0) {
        return res.status(400).json({
          success: false,
          error: "At least one file ID is required"
        });
      }
      
      const connected = await isClientDriveConnected(clientId);
      if (!connected) {
        return res.status(400).json({
          success: false,
          error: "Google Drive not connected"
        });
      }
      
      // Get client's consultant for Vertex AI credentials
      const [client] = await db
        .select()
        .from(users)
        .where(eq(users.id, clientId))
        .limit(1);
      
      const consultantId = client?.consultantId || null;
      
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
          const { filePath, fileName, mimeType } = await downloadClientDriveFile(clientId, currentFileId);
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
