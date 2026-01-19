import { Router, Response } from "express";
import { db } from "../db";
import { clientDataDatasets, users } from "../../shared/schema";
import { eq, and, desc, or } from "drizzle-orm";
import { AuthRequest, authenticateToken, requireRole, requireAnyRole } from "../middleware/auth";
import { upload } from "../middleware/upload";
import { processExcelFile, type ProcessedFile } from "../services/client-data/upload-processor";
import { getDistributedSample, profileAllColumns, type DistributedSample } from "../services/client-data/column-profiler";
import fs from "fs";
import path from "path";

const router = Router();

const UPLOAD_DIR = 'uploads/client-data';

async function ensureUploadDir() {
  try {
    await fs.promises.access(UPLOAD_DIR);
  } catch {
    await fs.promises.mkdir(UPLOAD_DIR, { recursive: true });
  }
}

router.post(
  "/upload",
  authenticateToken,
  requireAnyRole(["consultant", "client"]),
  upload.single("file"),
  async (req: AuthRequest, res: Response) => {
    try {
      await ensureUploadDir();

      if (!req.file) {
        return res.status(400).json({ success: false, error: "No file uploaded" });
      }

      const { originalname, path: tempPath, size } = req.file;
      const ext = path.extname(originalname).toLowerCase();

      if (![".xlsx", ".xls", ".csv"].includes(ext)) {
        await fs.promises.unlink(tempPath);
        return res.status(400).json({
          success: false,
          error: "Invalid file type. Supported: .xlsx, .xls, .csv",
        });
      }

      const newPath = path.join(UPLOAD_DIR, `${Date.now()}_${originalname}`);
      await fs.promises.rename(tempPath, newPath);

      console.log(`[CLIENT-DATA] Processing file: ${originalname} (${size} bytes)`);

      const processedFile = await processExcelFile(newPath, originalname);

      let distributedSample: DistributedSample | null = null;
      let columnProfiles: Record<string, any> | null = null;

      if (processedFile.sheets.length > 0) {
        try {
          distributedSample = await getDistributedSample(newPath, originalname);
          columnProfiles = profileAllColumns(distributedSample);
        } catch (profileError) {
          console.warn("[CLIENT-DATA] Could not generate distributed sample:", profileError);
        }
      }

      res.json({
        success: true,
        data: {
          filePath: newPath,
          originalFilename: originalname,
          fileSize: size,
          format: processedFile.format,
          sheets: processedFile.sheets.map((sheet) => ({
            name: sheet.name,
            rowCount: sheet.rowCount,
            columns: sheet.columns.map((col) => ({
              name: col.name,
              sampleValues: col.sampleValues.slice(0, 5),
            })),
            sampleRows: sheet.sampleRows.slice(0, 10),
          })),
          distributedSample: distributedSample
            ? {
                totalRowCount: distributedSample.totalRowCount,
                sampledFromStart: distributedSample.sampledFromStart,
                sampledFromMiddle: distributedSample.sampledFromMiddle,
                sampledFromEnd: distributedSample.sampledFromEnd,
              }
            : null,
          columnProfiles,
        },
      });
    } catch (error: any) {
      console.error("[CLIENT-DATA] Upload processing error:", error);
      res.status(500).json({
        success: false,
        error: error.message || "Failed to process uploaded file",
      });
    }
  }
);

router.get(
  "/datasets",
  authenticateToken,
  requireAnyRole(["consultant", "client"]),
  async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user!.id;
      const userRole = req.user!.role;

      let datasets;
      
      if (userRole === "consultant") {
        datasets = await db
          .select()
          .from(clientDataDatasets)
          .where(eq(clientDataDatasets.consultantId, userId))
          .orderBy(desc(clientDataDatasets.createdAt));
      } else {
        datasets = await db
          .select()
          .from(clientDataDatasets)
          .where(eq(clientDataDatasets.clientId, userId))
          .orderBy(desc(clientDataDatasets.createdAt));
      }

      res.json({
        success: true,
        data: datasets,
        count: datasets.length,
      });
    } catch (error: any) {
      console.error("[CLIENT-DATA] Error fetching datasets:", error);
      res.status(500).json({
        success: false,
        error: error.message || "Failed to fetch datasets",
      });
    }
  }
);

router.get(
  "/datasets/:id",
  authenticateToken,
  requireAnyRole(["consultant", "client"]),
  async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const userId = req.user!.id;
      const userRole = req.user!.role;

      const [dataset] = await db
        .select()
        .from(clientDataDatasets)
        .where(eq(clientDataDatasets.id, id))
        .limit(1);

      if (!dataset) {
        return res.status(404).json({
          success: false,
          error: "Dataset not found",
        });
      }

      if (userRole === "consultant" && dataset.consultantId !== userId) {
        return res.status(403).json({
          success: false,
          error: "Access denied",
        });
      }

      if (userRole === "client" && dataset.clientId !== userId) {
        return res.status(403).json({
          success: false,
          error: "Access denied",
        });
      }

      res.json({
        success: true,
        data: dataset,
      });
    } catch (error: any) {
      console.error("[CLIENT-DATA] Error fetching dataset:", error);
      res.status(500).json({
        success: false,
        error: error.message || "Failed to fetch dataset",
      });
    }
  }
);

router.delete(
  "/datasets/:id",
  authenticateToken,
  requireAnyRole(["consultant", "client"]),
  async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const userId = req.user!.id;
      const userRole = req.user!.role;

      const [dataset] = await db
        .select()
        .from(clientDataDatasets)
        .where(eq(clientDataDatasets.id, id))
        .limit(1);

      if (!dataset) {
        return res.status(404).json({
          success: false,
          error: "Dataset not found",
        });
      }

      if (userRole === "consultant" && dataset.consultantId !== userId) {
        return res.status(403).json({
          success: false,
          error: "Access denied",
        });
      }

      if (userRole === "client" && dataset.clientId !== userId) {
        return res.status(403).json({
          success: false,
          error: "Access denied",
        });
      }

      await db.delete(clientDataDatasets).where(eq(clientDataDatasets.id, id));

      console.log(`[CLIENT-DATA] Dataset deleted: ${id}`);

      res.json({
        success: true,
        message: "Dataset deleted successfully",
      });
    } catch (error: any) {
      console.error("[CLIENT-DATA] Error deleting dataset:", error);
      res.status(500).json({
        success: false,
        error: error.message || "Failed to delete dataset",
      });
    }
  }
);

router.post(
  "/datasets",
  authenticateToken,
  requireAnyRole(["consultant", "client"]),
  async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user!.id;
      const userRole = req.user!.role;
      const { name, clientId, filePath, sheetName, columnMapping, originalFilename, rowCount, fileSizeBytes } = req.body;

      if (!name || !columnMapping) {
        return res.status(400).json({
          success: false,
          error: "Missing required fields: name, columnMapping",
        });
      }

      const sanitizedName = name.toLowerCase().replace(/[^a-z0-9_]/g, "_").substring(0, 50);
      const timestamp = Date.now();
      const tableName = `cdd_${timestamp}_${sanitizedName}`;

      const datasetData: any = {
        name,
        originalFilename,
        sheetName,
        tableName,
        columnMapping,
        originalColumns: Object.keys(columnMapping),
        rowCount: rowCount || 0,
        fileSizeBytes: fileSizeBytes || 0,
        status: "pending",
      };

      if (userRole === "consultant") {
        datasetData.consultantId = userId;
        if (clientId) {
          datasetData.clientId = clientId;
        }
      } else {
        datasetData.clientId = userId;
        datasetData.consultantId = req.user!.consultantId;
      }

      const [inserted] = await db
        .insert(clientDataDatasets)
        .values(datasetData)
        .returning();

      console.log(`[CLIENT-DATA] Dataset created: ${inserted.id}`);

      res.status(201).json({
        success: true,
        data: inserted,
      });
    } catch (error: any) {
      console.error("[CLIENT-DATA] Error creating dataset:", error);
      res.status(500).json({
        success: false,
        error: error.message || "Failed to create dataset",
      });
    }
  }
);

router.patch(
  "/datasets/:id",
  authenticateToken,
  requireAnyRole(["consultant", "client"]),
  async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const userId = req.user!.id;
      const userRole = req.user!.role;
      const updates = req.body;

      const [dataset] = await db
        .select()
        .from(clientDataDatasets)
        .where(eq(clientDataDatasets.id, id))
        .limit(1);

      if (!dataset) {
        return res.status(404).json({
          success: false,
          error: "Dataset not found",
        });
      }

      if (userRole === "consultant" && dataset.consultantId !== userId) {
        return res.status(403).json({
          success: false,
          error: "Access denied",
        });
      }

      if (userRole === "client" && dataset.clientId !== userId) {
        return res.status(403).json({
          success: false,
          error: "Access denied",
        });
      }

      const allowedUpdates: (keyof typeof updates)[] = [
        "name",
        "columnMapping",
        "status",
        "errorMessage",
      ];
      const sanitizedUpdates: any = { updatedAt: new Date() };

      for (const key of allowedUpdates) {
        if (updates[key] !== undefined) {
          sanitizedUpdates[key] = updates[key];
        }
      }

      const [updated] = await db
        .update(clientDataDatasets)
        .set(sanitizedUpdates)
        .where(eq(clientDataDatasets.id, id))
        .returning();

      res.json({
        success: true,
        data: updated,
      });
    } catch (error: any) {
      console.error("[CLIENT-DATA] Error updating dataset:", error);
      res.status(500).json({
        success: false,
        error: error.message || "Failed to update dataset",
      });
    }
  }
);

export default router;
