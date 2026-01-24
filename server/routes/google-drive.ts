import { Router } from "express";
import { authenticateToken, requireRole, type AuthRequest } from "../middleware/auth";
import { db } from "../db";
import { consultantAvailabilitySettings, consultantKnowledgeDocuments, vertexAiSettings } from "../../shared/schema";
import { eq, inArray, and, isNotNull } from "drizzle-orm";
import { extractTextFromFile, type VertexAICredentials } from "../services/document-processor";
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
  disconnectDrive,
  listSharedDrives,
  listSharedDriveFolders,
  listSharedDriveFiles,
  listSharedWithMe,
  listRecentFiles,
  listStarredFiles,
  listTrashedFiles
} from "../services/google-drive-service";
import { registerDriveWatch } from "../services/google-drive-sync-service";

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

// ═══════════════════════════════════════════════════════════════════════════
// SHARED DRIVES & SHARED WITH ME - Extended Drive access endpoints
// ═══════════════════════════════════════════════════════════════════════════

router.get(
  "/consultant/google-drive/shared-drives",
  authenticateToken,
  requireRole("consultant"),
  async (req: AuthRequest, res) => {
    try {
      const consultantId = req.user!.id;
      
      const connected = await isDriveConnected(consultantId);
      if (!connected) {
        return res.status(400).json({
          success: false,
          error: "Google Drive not connected"
        });
      }
      
      const sharedDrives = await listSharedDrives(consultantId);
      
      res.json({
        success: true,
        data: sharedDrives
      });
    } catch (error: any) {
      console.error("❌ [GOOGLE DRIVE] Error listing shared drives:", error);
      res.status(500).json({
        success: false,
        error: error.message || "Failed to list shared drives"
      });
    }
  }
);

router.get(
  "/consultant/google-drive/shared-drive/:driveId/folders",
  authenticateToken,
  requireRole("consultant"),
  async (req: AuthRequest, res) => {
    try {
      const consultantId = req.user!.id;
      const { driveId } = req.params;
      const parentId = req.query.parentId as string | undefined;
      
      const connected = await isDriveConnected(consultantId);
      if (!connected) {
        return res.status(400).json({
          success: false,
          error: "Google Drive not connected"
        });
      }
      
      const folders = await listSharedDriveFolders(consultantId, driveId, parentId);
      
      res.json({
        success: true,
        data: folders
      });
    } catch (error: any) {
      console.error("❌ [GOOGLE DRIVE] Error listing shared drive folders:", error);
      res.status(500).json({
        success: false,
        error: error.message || "Failed to list shared drive folders"
      });
    }
  }
);

router.get(
  "/consultant/google-drive/shared-drive/:driveId/files",
  authenticateToken,
  requireRole("consultant"),
  async (req: AuthRequest, res) => {
    try {
      const consultantId = req.user!.id;
      const { driveId } = req.params;
      const parentId = req.query.parentId as string | undefined;
      
      const connected = await isDriveConnected(consultantId);
      if (!connected) {
        return res.status(400).json({
          success: false,
          error: "Google Drive not connected"
        });
      }
      
      const files = await listSharedDriveFiles(consultantId, driveId, parentId);
      
      res.json({
        success: true,
        data: files
      });
    } catch (error: any) {
      console.error("❌ [GOOGLE DRIVE] Error listing shared drive files:", error);
      res.status(500).json({
        success: false,
        error: error.message || "Failed to list shared drive files"
      });
    }
  }
);

router.get(
  "/consultant/google-drive/shared-with-me",
  authenticateToken,
  requireRole("consultant"),
  async (req: AuthRequest, res) => {
    try {
      const consultantId = req.user!.id;
      const onlyFolders = req.query.onlyFolders === "true";
      
      const connected = await isDriveConnected(consultantId);
      if (!connected) {
        return res.status(400).json({
          success: false,
          error: "Google Drive not connected"
        });
      }
      
      const items = await listSharedWithMe(consultantId, onlyFolders);
      
      res.json({
        success: true,
        data: items
      });
    } catch (error: any) {
      console.error("❌ [GOOGLE DRIVE] Error listing shared-with-me:", error);
      res.status(500).json({
        success: false,
        error: error.message || "Failed to list shared items"
      });
    }
  }
);

// ═══════════════════════════════════════════════════════════════════════════

router.post(
  "/consultant/google-drive/import",
  authenticateToken,
  requireRole("consultant"),
  async (req: AuthRequest, res) => {
    try {
      const consultantId = req.user!.id;
      const { fileIds, fileId, title, description, category, priority } = req.body;
      
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
          error: "Google Drive not connected"
        });
      }
      
      console.log(`📥 [GOOGLE DRIVE] Importing ${idsToImport.length} file(s) for consultant ${consultantId}`);
      
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
            .insert(consultantKnowledgeDocuments)
            .values({
              id: documentId,
              consultantId,
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
              status: "processing",
              googleDriveFileId: currentFileId
            })
            .returning();
          
          console.log(`📄 [GOOGLE DRIVE] Created document: "${documentTitle}" (status: processing)`);
          
          registerDriveWatch(consultantId, documentId, currentFileId)
            .then((result) => {
              if (result) {
                console.log(`🔔 [GOOGLE DRIVE] Watch registered for "${documentTitle}"`);
              } else {
                console.log(`ℹ️ [GOOGLE DRIVE] Watch not registered for "${documentTitle}" (may not be supported for this file type)`);
              }
            })
            .catch((watchError) => {
              console.warn(`⚠️ [GOOGLE DRIVE] Failed to register watch for "${documentTitle}":`, watchError.message);
            });
          
          const storedFilePath = finalFilePath;
          const storedMimeType = mimeType;
          const storedFileName = fileName;
          (async () => {
            try {
              console.log(`🔄 [GOOGLE DRIVE] Extracting text from: ${storedFileName}`);
              
              let vertexCredentials: VertexAICredentials | undefined;
              if (storedMimeType.startsWith('audio/')) {
                const [aiSettings] = await db
                  .select()
                  .from(vertexAiSettings)
                  .where(eq(vertexAiSettings.userId, consultantId))
                  .limit(1);
                
                if (aiSettings?.serviceAccountJson) {
                  const serviceAccount = JSON.parse(aiSettings.serviceAccountJson);
                  vertexCredentials = {
                    projectId: serviceAccount.project_id,
                    location: 'us-central1',
                    credentials: serviceAccount
                  };
                  console.log(`🔑 [GOOGLE DRIVE] Using Vertex AI credentials for audio transcription`);
                }
              }
              
              const extractedContent = await extractTextFromFile(storedFilePath, storedMimeType, vertexCredentials);
              
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
          
          results.imported++;
        } catch (fileError: any) {
          console.error(`❌ [GOOGLE DRIVE] Error importing file ${currentFileId}:`, fileError);
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
      console.error("❌ [GOOGLE DRIVE] Error in import:", error);
      res.status(500).json({
        success: false,
        error: error.message || "Failed to import files from Google Drive"
      });
    }
  }
);

// Check import status of Drive files - returns which file IDs are already imported
router.post(
  "/consultant/google-drive/import-status",
  authenticateToken,
  requireRole("consultant"),
  async (req: AuthRequest, res) => {
    try {
      const consultantId = req.user!.id;
      const { fileIds } = req.body;
      
      if (!fileIds || !Array.isArray(fileIds) || fileIds.length === 0) {
        return res.status(400).json({
          success: false,
          error: "fileIds array is required"
        });
      }
      
      // Find which Drive file IDs are already imported
      const importedDocs = await db
        .select({ googleDriveFileId: consultantKnowledgeDocuments.googleDriveFileId })
        .from(consultantKnowledgeDocuments)
        .where(
          and(
            eq(consultantKnowledgeDocuments.consultantId, consultantId),
            isNotNull(consultantKnowledgeDocuments.googleDriveFileId),
            inArray(consultantKnowledgeDocuments.googleDriveFileId, fileIds)
          )
        );
      
      const importedIds = new Set(importedDocs.map(d => d.googleDriveFileId));
      
      res.json({
        success: true,
        importedFileIds: Array.from(importedIds)
      });
    } catch (error: any) {
      console.error("❌ [GOOGLE DRIVE] Error checking import status:", error);
      res.status(500).json({
        success: false,
        error: error.message || "Failed to check import status"
      });
    }
  }
);

// List recent files
router.get(
  "/consultant/google-drive/recent",
  authenticateToken,
  requireRole("consultant"),
  async (req: AuthRequest, res) => {
    try {
      const consultantId = req.user!.id;
      
      const connected = await isDriveConnected(consultantId);
      if (!connected) {
        return res.status(400).json({
          success: false,
          error: "Google Drive not connected"
        });
      }
      
      const files = await listRecentFiles(consultantId);
      
      res.json({
        success: true,
        data: files
      });
    } catch (error: any) {
      console.error("❌ [GOOGLE DRIVE] Error listing recent files:", error);
      res.status(500).json({
        success: false,
        error: error.message || "Failed to list recent files"
      });
    }
  }
);

// List starred files
router.get(
  "/consultant/google-drive/starred",
  authenticateToken,
  requireRole("consultant"),
  async (req: AuthRequest, res) => {
    try {
      const consultantId = req.user!.id;
      
      const connected = await isDriveConnected(consultantId);
      if (!connected) {
        return res.status(400).json({
          success: false,
          error: "Google Drive not connected"
        });
      }
      
      const files = await listStarredFiles(consultantId);
      
      res.json({
        success: true,
        data: files
      });
    } catch (error: any) {
      console.error("❌ [GOOGLE DRIVE] Error listing starred files:", error);
      res.status(500).json({
        success: false,
        error: error.message || "Failed to list starred files"
      });
    }
  }
);

// List trashed files
router.get(
  "/consultant/google-drive/trash",
  authenticateToken,
  requireRole("consultant"),
  async (req: AuthRequest, res) => {
    try {
      const consultantId = req.user!.id;
      
      const connected = await isDriveConnected(consultantId);
      if (!connected) {
        return res.status(400).json({
          success: false,
          error: "Google Drive not connected"
        });
      }
      
      const files = await listTrashedFiles(consultantId);
      
      res.json({
        success: true,
        data: files
      });
    } catch (error: any) {
      console.error("❌ [GOOGLE DRIVE] Error listing trashed files:", error);
      res.status(500).json({
        success: false,
        error: error.message || "Failed to list trashed files"
      });
    }
  }
);

export default router;
