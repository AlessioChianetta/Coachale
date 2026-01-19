import { Router, Response } from "express";
import { db } from "../db";
import { clientDataDatasets, users, consultantColumnMappings } from "../../shared/schema";
import { eq, and, desc, or } from "drizzle-orm";
import { AuthRequest, authenticateToken, requireRole, requireAnyRole } from "../middleware/auth";
import { upload } from "../middleware/upload";
import { processExcelFile, type ProcessedFile } from "../services/client-data/upload-processor";
import { getDistributedSample, profileAllColumns, type DistributedSample } from "../services/client-data/column-profiler";
import { discoverColumns, saveColumnMapping, type ColumnDefinition, type DiscoveryResult } from "../services/client-data/column-discovery";
import { generateTableName, createDynamicTable, importDataToTable, getTablePreview, dropDynamicTable, getTableRowCount } from "../services/client-data/table-generator";
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

router.post(
  "/discover-columns",
  authenticateToken,
  requireAnyRole(["consultant", "client"]),
  async (req: AuthRequest, res: Response) => {
    try {
      const { filePath, filename, sheetName } = req.body;
      const userId = req.user!.id;
      const userRole = req.user!.role;

      if (!filePath || !filename) {
        return res.status(400).json({
          success: false,
          error: "Missing required fields: filePath, filename",
        });
      }

      try {
        await fs.promises.access(filePath);
      } catch {
        return res.status(404).json({
          success: false,
          error: "File not found. Please upload the file again.",
        });
      }

      console.log(`[CLIENT-DATA] Discovering columns for: ${filename}`);

      const sample = await getDistributedSample(filePath, filename, 300, sheetName);

      const consultantId = userRole === "consultant" ? userId : req.user!.consultantId;
      const discoveryResult = await discoverColumns(sample, filename, consultantId || undefined);

      console.log(
        `[CLIENT-DATA] Discovery complete: ${discoveryResult.columns.length} columns, ` +
        `confidence: ${(discoveryResult.overallConfidence * 100).toFixed(1)}%, ` +
        `auto-confirmed: ${discoveryResult.autoConfirmed}`
      );

      res.json({
        success: true,
        data: {
          columns: discoveryResult.columns,
          overallConfidence: discoveryResult.overallConfidence,
          autoConfirmed: discoveryResult.autoConfirmed,
          templateDetected: discoveryResult.templateDetected,
          aiUsed: discoveryResult.aiUsed,
          totalRowCount: sample.totalRowCount,
          sampleRows: sample.rows.slice(0, 10),
        },
      });
    } catch (error: any) {
      console.error("[CLIENT-DATA] Error discovering columns:", error);
      res.status(500).json({
        success: false,
        error: error.message || "Failed to discover columns",
      });
    }
  }
);

router.post(
  "/datasets/:id/discover-columns",
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
        return res.status(403).json({ success: false, error: "Access denied" });
      }

      if (userRole === "client" && dataset.clientId !== userId) {
        return res.status(403).json({ success: false, error: "Access denied" });
      }

      res.json({
        success: true,
        data: {
          columns: Object.entries(dataset.columnMapping).map(([key, value]) => ({
            originalName: key,
            suggestedName: key,
            displayName: value.displayName,
            dataType: value.dataType,
            description: value.description,
            confidence: 1.0,
            sampleValues: [],
          })),
          overallConfidence: 1.0,
          autoConfirmed: true,
          totalRowCount: dataset.rowCount,
        },
      });
    } catch (error: any) {
      console.error("[CLIENT-DATA] Error getting dataset columns:", error);
      res.status(500).json({
        success: false,
        error: error.message || "Failed to get dataset columns",
      });
    }
  }
);

router.post(
  "/datasets/:id/confirm-columns",
  authenticateToken,
  requireAnyRole(["consultant", "client"]),
  async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { columns, filePath, sheetName } = req.body as {
        columns: ColumnDefinition[];
        filePath: string;
        sheetName?: string;
      };
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
        return res.status(403).json({ success: false, error: "Access denied" });
      }

      if (userRole === "client" && dataset.clientId !== userId) {
        return res.status(403).json({ success: false, error: "Access denied" });
      }

      if (!columns || !Array.isArray(columns) || columns.length === 0) {
        return res.status(400).json({
          success: false,
          error: "Missing or invalid columns array",
        });
      }

      console.log(`[CLIENT-DATA] Confirming columns for dataset ${id}: ${columns.length} columns`);

      await db
        .update(clientDataDatasets)
        .set({ status: "processing", updatedAt: new Date() })
        .where(eq(clientDataDatasets.id, id));

      const consultantId = dataset.consultantId || userId;
      const clientId = dataset.clientId;

      const createResult = await createDynamicTable(
        dataset.tableName,
        columns,
        consultantId,
        clientId || undefined
      );

      if (!createResult.success) {
        await db
          .update(clientDataDatasets)
          .set({ status: "error", errorMessage: createResult.error, updatedAt: new Date() })
          .where(eq(clientDataDatasets.id, id));

        return res.status(500).json({
          success: false,
          error: createResult.error || "Failed to create table",
        });
      }

      const effectiveFilePath = filePath || `uploads/client-data/${dataset.originalFilename}`;
      
      const importResult = await importDataToTable(
        effectiveFilePath,
        dataset.tableName,
        columns,
        consultantId,
        clientId || undefined,
        sheetName || dataset.sheetName || undefined
      );

      if (!importResult.success) {
        await dropDynamicTable(dataset.tableName);
        await db
          .update(clientDataDatasets)
          .set({ status: "error", errorMessage: importResult.error, updatedAt: new Date() })
          .where(eq(clientDataDatasets.id, id));

        return res.status(500).json({
          success: false,
          error: importResult.error || "Failed to import data",
        });
      }

      const columnMapping: Record<string, { displayName: string; dataType: string; description?: string }> = {};
      for (const col of columns) {
        columnMapping[col.originalName] = {
          displayName: col.displayName,
          dataType: col.dataType,
          description: col.description,
        };
      }

      const [updated] = await db
        .update(clientDataDatasets)
        .set({
          status: "ready",
          columnMapping,
          rowCount: importResult.rowCount,
          errorMessage: null,
          updatedAt: new Date(),
        })
        .where(eq(clientDataDatasets.id, id))
        .returning();

      for (const col of columns) {
        if (col.confidence >= 0.8) {
          await saveColumnMapping(
            consultantId,
            col.originalName,
            col.suggestedName,
            col.dataType,
            col.confidence
          );
        }
      }

      console.log(`[CLIENT-DATA] Dataset ${id} ready with ${importResult.rowCount} rows`);

      res.json({
        success: true,
        data: {
          dataset: updated,
          rowCount: importResult.rowCount,
          tableName: dataset.tableName,
        },
      });
    } catch (error: any) {
      console.error("[CLIENT-DATA] Error confirming columns:", error);
      res.status(500).json({
        success: false,
        error: error.message || "Failed to confirm columns",
      });
    }
  }
);

router.get(
  "/datasets/:id/preview",
  authenticateToken,
  requireAnyRole(["consultant", "client"]),
  async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { limit = "100" } = req.query;
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
        return res.status(403).json({ success: false, error: "Access denied" });
      }

      if (userRole === "client" && dataset.clientId !== userId) {
        return res.status(403).json({ success: false, error: "Access denied" });
      }

      if (dataset.status !== "ready") {
        return res.status(400).json({
          success: false,
          error: `Dataset is not ready. Current status: ${dataset.status}`,
        });
      }

      const preview = await getTablePreview(dataset.tableName, parseInt(limit as string, 10));
      
      await db
        .update(clientDataDatasets)
        .set({ lastQueriedAt: new Date() })
        .where(eq(clientDataDatasets.id, id));

      res.json({
        success: true,
        data: {
          columns: preview.columns,
          rows: preview.rows,
          totalRowCount: dataset.rowCount,
          columnMapping: dataset.columnMapping,
        },
      });
    } catch (error: any) {
      console.error("[CLIENT-DATA] Error getting dataset preview:", error);
      res.status(500).json({
        success: false,
        error: error.message || "Failed to get dataset preview",
      });
    }
  }
);

router.post(
  "/create-and-import",
  authenticateToken,
  requireAnyRole(["consultant", "client"]),
  async (req: AuthRequest, res: Response) => {
    try {
      const { name, filePath, filename, sheetName, columns, clientId: targetClientId } = req.body as {
        name: string;
        filePath: string;
        filename: string;
        sheetName?: string;
        columns: ColumnDefinition[];
        clientId?: string;
      };
      const userId = req.user!.id;
      const userRole = req.user!.role;

      if (!name || !filePath || !filename || !columns?.length) {
        return res.status(400).json({
          success: false,
          error: "Missing required fields: name, filePath, filename, columns",
        });
      }

      const consultantId = userRole === "consultant" ? userId : req.user!.consultantId!;
      const clientId = userRole === "client" ? userId : targetClientId;

      const tableName = generateTableName(consultantId, name);

      console.log(`[CLIENT-DATA] Creating dataset ${name} with table ${tableName}`);

      const columnMapping: Record<string, { displayName: string; dataType: string; description?: string }> = {};
      for (const col of columns) {
        columnMapping[col.originalName] = {
          displayName: col.displayName,
          dataType: col.dataType,
          description: col.description,
        };
      }

      const [dataset] = await db
        .insert(clientDataDatasets)
        .values({
          name,
          consultantId,
          clientId,
          originalFilename: filename,
          sheetName,
          tableName,
          columnMapping,
          originalColumns: columns.map(c => c.originalName),
          status: "processing",
        })
        .returning();

      const createResult = await createDynamicTable(tableName, columns, consultantId, clientId || undefined);

      if (!createResult.success) {
        await db
          .update(clientDataDatasets)
          .set({ status: "error", errorMessage: createResult.error, updatedAt: new Date() })
          .where(eq(clientDataDatasets.id, dataset.id));

        return res.status(500).json({
          success: false,
          error: createResult.error || "Failed to create table",
        });
      }

      const importResult = await importDataToTable(
        filePath,
        tableName,
        columns,
        consultantId,
        clientId || undefined,
        sheetName
      );

      if (!importResult.success) {
        await dropDynamicTable(tableName);
        await db
          .update(clientDataDatasets)
          .set({ status: "error", errorMessage: importResult.error, updatedAt: new Date() })
          .where(eq(clientDataDatasets.id, dataset.id));

        return res.status(500).json({
          success: false,
          error: importResult.error || "Failed to import data",
        });
      }

      const [updated] = await db
        .update(clientDataDatasets)
        .set({
          status: "ready",
          rowCount: importResult.rowCount,
          errorMessage: null,
          updatedAt: new Date(),
        })
        .where(eq(clientDataDatasets.id, dataset.id))
        .returning();

      for (const col of columns) {
        if (col.confidence >= 0.8) {
          await saveColumnMapping(
            consultantId,
            col.originalName,
            col.suggestedName,
            col.dataType,
            col.confidence
          );
        }
      }

      console.log(`[CLIENT-DATA] Dataset ${dataset.id} created with ${importResult.rowCount} rows`);

      res.status(201).json({
        success: true,
        data: {
          dataset: updated,
          rowCount: importResult.rowCount,
          tableName,
        },
      });
    } catch (error: any) {
      console.error("[CLIENT-DATA] Error creating and importing dataset:", error);
      res.status(500).json({
        success: false,
        error: error.message || "Failed to create and import dataset",
      });
    }
  }
);

export default router;
