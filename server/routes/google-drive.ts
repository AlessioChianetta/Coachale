import { Router } from "express";
import { authenticateToken, requireRole, type AuthRequest } from "../middleware/auth";
import { db } from "../db";
import { consultantAvailabilitySettings, consultantKnowledgeDocuments } from "../../shared/schema";
import { eq } from "drizzle-orm";
import { extractTextFromFile } from "../services/document-processor";
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import {
  buildBaseUrlFromRequest,
  getDriveAuthorizationUrl,
  exchangeDriveCodeForTokens,
  refreshDriveTokenIfNeeded,
  listDriveFolders,
  listDriveFiles,
  downloadDriveFile,
  getDriveUserEmail,
  isDriveConnected,
  disconnectDrive
} from "../services/google-drive-service";

const router = Router();

const KNOWLEDGE_UPLOAD_DIR = "uploads/knowledge";

async function ensureUploadDir() {
  const dir = path.join(process.cwd(), KNOWLEDGE_UPLOAD_DIR);
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

router.get(
  "/consultant/google-drive/status",
  authenticateToken,
  requireRole("consultant"),
  async (req: AuthRequest, res) => {
    try {
      const consultantId = req.user!.id;
      
      const [settings] = await db
        .select()
        .from(consultantAvailabilitySettings)
        .where(eq(consultantAvailabilitySettings.consultantId, consultantId))
        .limit(1);
      
      const connected = !!(settings?.googleDriveRefreshToken);
      
      res.json({
        success: true,
        connected,
        email: settings?.googleDriveEmail || null,
        connectedAt: settings?.googleDriveConnectedAt || null
      });
    } catch (error: any) {
      console.error("❌ [GOOGLE DRIVE] Error checking status:", error);
      res.status(500).json({
        success: false,
        error: error.message || "Failed to check Google Drive status"
      });
    }
  }
);

router.get(
  "/consultant/google-drive/connect",
  authenticateToken,
  requireRole("consultant"),
  async (req: AuthRequest, res) => {
    try {
      const consultantId = req.user!.id;
      const baseUrl = buildBaseUrlFromRequest(req);
      
      const authUrl = await getDriveAuthorizationUrl(consultantId, baseUrl);
      
      res.json({
        success: true,
        authUrl
      });
    } catch (error: any) {
      console.error("❌ [GOOGLE DRIVE] Error generating auth URL:", error);
      res.status(500).json({
        success: false,
        error: error.message || "Failed to generate Google Drive authorization URL"
      });
    }
  }
);

router.get(
  "/consultant/google-drive/callback",
  async (req, res) => {
    try {
      const { code, state, error } = req.query;
      
      if (error) {
        console.error("❌ [GOOGLE DRIVE] OAuth error:", error);
        return res.redirect('/consultant/api-settings?drive_error=' + encodeURIComponent(String(error)));
      }
      
      if (!code || !state) {
        return res.redirect('/consultant/api-settings?drive_error=missing_params');
      }
      
      const consultantId = state as string;
      const baseUrl = buildBaseUrlFromRequest(req);
      
      console.log(`🔄 [GOOGLE DRIVE] Processing OAuth callback for consultant ${consultantId}`);
      
      const tokens = await exchangeDriveCodeForTokens(code as string, consultantId, baseUrl);
      
      const [existingSettings] = await db
        .select()
        .from(consultantAvailabilitySettings)
        .where(eq(consultantAvailabilitySettings.consultantId, consultantId))
        .limit(1);
      
      const connectedAt = new Date();
      
      if (!existingSettings) {
        await db.insert(consultantAvailabilitySettings).values({
          consultantId,
          googleDriveRefreshToken: tokens.refreshToken,
          googleDriveAccessToken: tokens.accessToken,
          googleDriveTokenExpiresAt: tokens.expiresAt,
          googleDriveConnectedAt: connectedAt
        });
      } else {
        await db
          .update(consultantAvailabilitySettings)
          .set({
            googleDriveRefreshToken: tokens.refreshToken,
            googleDriveAccessToken: tokens.accessToken,
            googleDriveTokenExpiresAt: tokens.expiresAt,
            googleDriveConnectedAt: connectedAt,
            updatedAt: new Date()
          })
          .where(eq(consultantAvailabilitySettings.consultantId, consultantId));
      }
      
      const userEmail = await getDriveUserEmail(consultantId);
      if (userEmail) {
        await db
          .update(consultantAvailabilitySettings)
          .set({ 
            googleDriveEmail: userEmail, 
            googleDriveConnectedAt: connectedAt,
            updatedAt: new Date() 
          })
          .where(eq(consultantAvailabilitySettings.consultantId, consultantId));
      }
      
      console.log(`✅ [GOOGLE DRIVE] Connected for consultant ${consultantId} (${userEmail})`);
      
      res.redirect('/consultant/api-settings?drive_connected=true');
    } catch (error: any) {
      console.error("❌ [GOOGLE DRIVE] OAuth callback error:", error);
      res.redirect('/consultant/api-settings?drive_error=' + encodeURIComponent(error.message || 'Unknown error'));
    }
  }
);

router.post(
  "/consultant/google-drive/disconnect",
  authenticateToken,
  requireRole("consultant"),
  async (req: AuthRequest, res) => {
    try {
      const consultantId = req.user!.id;
      
      await disconnectDrive(consultantId);
      
      res.json({
        success: true,
        message: "Google Drive disconnected successfully"
      });
    } catch (error: any) {
      console.error("❌ [GOOGLE DRIVE] Error disconnecting:", error);
      res.status(500).json({
        success: false,
        error: error.message || "Failed to disconnect Google Drive"
      });
    }
  }
);

router.get(
  "/consultant/google-drive/folders",
  authenticateToken,
  requireRole("consultant"),
  async (req: AuthRequest, res) => {
    try {
      const consultantId = req.user!.id;
      const parentId = req.query.parentId as string | undefined;
      
      const connected = await isDriveConnected(consultantId);
      if (!connected) {
        return res.status(400).json({
          success: false,
          error: "Google Drive not connected"
        });
      }
      
      const folders = await listDriveFolders(consultantId, parentId);
      
      res.json({
        success: true,
        data: folders
      });
    } catch (error: any) {
      console.error("❌ [GOOGLE DRIVE] Error listing folders:", error);
      res.status(500).json({
        success: false,
        error: error.message || "Failed to list folders"
      });
    }
  }
);

router.get(
  "/consultant/google-drive/files",
  authenticateToken,
  requireRole("consultant"),
  async (req: AuthRequest, res) => {
    try {
      const consultantId = req.user!.id;
      const parentId = req.query.parentId as string | undefined;
      
      const connected = await isDriveConnected(consultantId);
      if (!connected) {
        return res.status(400).json({
          success: false,
          error: "Google Drive not connected"
        });
      }
      
      const files = await listDriveFiles(consultantId, parentId);
      
      res.json({
        success: true,
        data: files
      });
    } catch (error: any) {
      console.error("❌ [GOOGLE DRIVE] Error listing files:", error);
      res.status(500).json({
        success: false,
        error: error.message || "Failed to list files"
      });
    }
  }
);

router.post(
  "/consultant/google-drive/import",
  authenticateToken,
  requireRole("consultant"),
  async (req: AuthRequest, res) => {
    let tempFilePath: string | null = null;
    let finalFilePath: string | null = null;
    
    try {
      const consultantId = req.user!.id;
      const { fileId, title, description, category, priority } = req.body;
      
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
          error: "Google Drive not connected"
        });
      }
      
      console.log(`📥 [GOOGLE DRIVE] Importing file ${fileId} for consultant ${consultantId}`);
      
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
        .insert(consultantKnowledgeDocuments)
        .values({
          id: documentId,
          consultantId,
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
      
      console.log(`📄 [GOOGLE DRIVE] Created document: "${documentTitle}" (status: processing)`);
      
      (async () => {
        try {
          console.log(`🔄 [GOOGLE DRIVE] Extracting text from: ${fileName}`);
          const extractedContent = await extractTextFromFile(finalFilePath!, mimeType);
          
          await db
            .update(consultantKnowledgeDocuments)
            .set({
              extractedContent,
              status: "indexed",
              updatedAt: new Date()
            })
            .where(eq(consultantKnowledgeDocuments.id, documentId));
          
          console.log(`✅ [GOOGLE DRIVE] Document indexed: "${documentTitle}"`);
        } catch (extractError: any) {
          console.error(`❌ [GOOGLE DRIVE] Text extraction failed for ${fileName}:`, extractError);
          await db
            .update(consultantKnowledgeDocuments)
            .set({
              status: "failed",
              updatedAt: new Date()
            })
            .where(eq(consultantKnowledgeDocuments.id, documentId));
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
      console.error("❌ [GOOGLE DRIVE] Error importing file:", error);
      
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
