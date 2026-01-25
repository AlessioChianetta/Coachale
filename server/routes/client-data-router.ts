import { Router, Response } from "express";
import { db } from "../db";
import { clientDataDatasets, users, consultantColumnMappings, clientDataMetrics, clientDataConversations, clientDataMessages, clientDataAiPreferences, customMappingRules } from "../../shared/schema";
import { eq, and, desc, or } from "drizzle-orm";
import { AuthRequest, authenticateToken, requireRole, requireAnyRole } from "../middleware/auth";
import { upload } from "../middleware/upload";
import { processExcelFile, type ProcessedFile } from "../services/client-data/upload-processor";
import { getDistributedSample, profileAllColumns, type DistributedSample } from "../services/client-data/column-profiler";
import { discoverColumns, saveColumnMapping, type ColumnDefinition, type DiscoveryResult } from "../services/client-data/column-discovery";
import { generateTableName, createDynamicTable, importDataToTable, getTablePreview, dropDynamicTable, getTableRowCount, sanitizeColumnName } from "../services/client-data/table-generator";
import { parseMetricExpression, validateMetricAgainstSchema } from "../services/client-data/metric-dsl";
import { queryMetric, filterData, aggregateGroup, comparePeriods, getSchema, aiTools, type QueryResult } from "../services/client-data/query-executor";
import { invalidateCache, getCacheStats } from "../services/client-data/cache-manager";
import { askDataset, type QueryExecutionResult } from "../ai/data-analysis/query-planner";
import { explainResults, generateNaturalLanguageResponse } from "../ai/data-analysis/result-explainer";
import { runReconciliationTests, compareAggregations, type ReconciliationReport } from "../services/client-data/reconciliation";
import { detectAndSaveSemanticMappings, getSemanticMappings, confirmSemanticMappings, rejectSemanticMapping, checkAnalyticsEnabled } from "../services/client-data/semantic-mapping-service";
import { generateAIMappingSuggestions } from "../ai/data-analysis/ai-column-mapper";
import { generateSmartQuestions } from "../ai/data-analysis/smart-questions";
import { runFullAudit } from "../ai/data-analysis/full-audit";
import fs from "fs";
import path from "path";

const reconciliationReportsCache = new Map<string, ReconciliationReport>();

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

      if (dataset.tableName) {
        try {
          await dropDynamicTable(dataset.tableName);
          console.log(`[CLIENT-DATA] Dropped table: ${dataset.tableName}`);
        } catch (dropError) {
          console.warn(`[CLIENT-DATA] Could not drop table ${dataset.tableName}:`, dropError);
        }
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

      // Use sanitized column names (matching database column names) as keys
      const columnMapping: Record<string, { displayName: string; dataType: string; description?: string }> = {};
      for (const col of columns) {
        const dbColumnName = sanitizeColumnName(col.suggestedName || col.originalName);
        columnMapping[dbColumnName] = {
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
            col.dataType
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

      // Use sanitized column names (matching database column names) as keys
      const columnMapping: Record<string, { displayName: string; dataType: string; description?: string }> = {};
      for (const col of columns) {
        const dbColumnName = sanitizeColumnName(col.suggestedName || col.originalName);
        columnMapping[dbColumnName] = {
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
          originalColumns: columns.map(c => sanitizeColumnName(c.suggestedName || c.originalName)),
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
            col.dataType
          );
        }
      }

      const physicalColumns = columns.map((c) => c.suggestedName || c.originalName);
      const semanticResult = await detectAndSaveSemanticMappings(dataset.id, physicalColumns);

      console.log(`[CLIENT-DATA] Dataset ${dataset.id} created with ${importResult.rowCount} rows, analytics=${semanticResult.analyticsEnabled}`);

      res.status(201).json({
        success: true,
        data: {
          dataset: { ...updated, analyticsEnabled: semanticResult.analyticsEnabled },
          rowCount: importResult.rowCount,
          tableName,
          semanticMappings: semanticResult,
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

router.post(
  "/datasets/:id/query",
  authenticateToken,
  requireAnyRole(["consultant", "client"]),
  async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { dsl, tool, params: toolParams } = req.body as {
        dsl?: string;
        tool?: string;
        params?: Record<string, any>;
      };
      const userId = req.user!.id;
      const userRole = req.user!.role;

      const [dataset] = await db
        .select()
        .from(clientDataDatasets)
        .where(eq(clientDataDatasets.id, id))
        .limit(1);

      if (!dataset) {
        return res.status(404).json({ success: false, error: "Dataset not found" });
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

      let result: QueryResult;

      if (tool && toolParams) {
        switch (tool) {
          case "query_metric":
            result = await queryMetric(id, toolParams.dsl || dsl || "", { userId });
            break;
          case "filter_data":
            result = await filterData(
              id,
              toolParams.filters || {},
              toolParams.columns,
              toolParams.limit || 100,
              toolParams.offset || 0,
              { userId }
            );
            break;
          case "aggregate_group":
            result = await aggregateGroup(
              id,
              toolParams.groupBy || [],
              toolParams.aggregations || [],
              toolParams.filters,
              toolParams.orderBy,
              toolParams.limit || 100,
              { userId }
            );
            break;
          case "compare_periods":
            result = await comparePeriods(
              id,
              toolParams.dsl || "",
              toolParams.dateColumn || "",
              { start: toolParams.period1Start, end: toolParams.period1End },
              { start: toolParams.period2Start, end: toolParams.period2End },
              { userId }
            );
            break;
          case "get_schema":
            result = await getSchema(id);
            break;
          default:
            return res.status(400).json({ success: false, error: `Unknown tool: ${tool}` });
        }
      } else if (dsl) {
        result = await queryMetric(id, dsl, { userId });
      } else {
        return res.status(400).json({
          success: false,
          error: "Either 'dsl' or 'tool' with 'params' is required",
        });
      }

      await db
        .update(clientDataDatasets)
        .set({ lastQueriedAt: new Date() })
        .where(eq(clientDataDatasets.id, id));

      res.json(result);
    } catch (error: any) {
      console.error("[CLIENT-DATA] Error executing query:", error);
      res.status(500).json({
        success: false,
        error: error.message || "Failed to execute query",
      });
    }
  }
);

router.get(
  "/datasets/:id/metrics",
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
        return res.status(404).json({ success: false, error: "Dataset not found" });
      }

      if (userRole === "consultant" && dataset.consultantId !== userId) {
        return res.status(403).json({ success: false, error: "Access denied" });
      }

      if (userRole === "client" && dataset.clientId !== userId) {
        return res.status(403).json({ success: false, error: "Access denied" });
      }

      const metrics = await db
        .select()
        .from(clientDataMetrics)
        .where(eq(clientDataMetrics.datasetId, id))
        .orderBy(desc(clientDataMetrics.createdAt));

      res.json({
        success: true,
        data: metrics,
        count: metrics.length,
      });
    } catch (error: any) {
      console.error("[CLIENT-DATA] Error fetching metrics:", error);
      res.status(500).json({
        success: false,
        error: error.message || "Failed to fetch metrics",
      });
    }
  }
);

router.post(
  "/datasets/:id/metrics",
  authenticateToken,
  requireAnyRole(["consultant", "client"]),
  async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { name, dsl, description } = req.body as {
        name: string;
        dsl: string;
        description?: string;
      };
      const userId = req.user!.id;
      const userRole = req.user!.role;

      if (!name || !dsl) {
        return res.status(400).json({
          success: false,
          error: "Missing required fields: name, dsl",
        });
      }

      const [dataset] = await db
        .select()
        .from(clientDataDatasets)
        .where(eq(clientDataDatasets.id, id))
        .limit(1);

      if (!dataset) {
        return res.status(404).json({ success: false, error: "Dataset not found" });
      }

      if (userRole === "consultant" && dataset.consultantId !== userId) {
        return res.status(403).json({ success: false, error: "Access denied" });
      }

      if (userRole === "client" && dataset.clientId !== userId) {
        return res.status(403).json({ success: false, error: "Access denied" });
      }

      const parsed = parseMetricExpression(dsl);
      if (!parsed.isValid) {
        return res.status(400).json({
          success: false,
          error: `Invalid DSL syntax: ${parsed.errors.join("; ")}`,
        });
      }

      const tableColumns = Object.keys(dataset.columnMapping);
      const validation = validateMetricAgainstSchema(parsed, tableColumns);
      if (!validation.valid) {
        return res.status(400).json({
          success: false,
          error: `Invalid metric: ${validation.errors.join("; ")}`,
        });
      }

      const [metric] = await db
        .insert(clientDataMetrics)
        .values({
          datasetId: id,
          name,
          dslFormula: dsl,
          description,
        })
        .returning();

      console.log(`[CLIENT-DATA] Metric created: ${metric.id} for dataset ${id}`);

      res.status(201).json({
        success: true,
        data: metric,
      });
    } catch (error: any) {
      console.error("[CLIENT-DATA] Error creating metric:", error);
      res.status(500).json({
        success: false,
        error: error.message || "Failed to create metric",
      });
    }
  }
);

router.delete(
  "/datasets/:id/metrics/:metricId",
  authenticateToken,
  requireAnyRole(["consultant", "client"]),
  async (req: AuthRequest, res: Response) => {
    try {
      const { id, metricId } = req.params;
      const userId = req.user!.id;
      const userRole = req.user!.role;

      const [dataset] = await db
        .select()
        .from(clientDataDatasets)
        .where(eq(clientDataDatasets.id, id))
        .limit(1);

      if (!dataset) {
        return res.status(404).json({ success: false, error: "Dataset not found" });
      }

      if (userRole === "consultant" && dataset.consultantId !== userId) {
        return res.status(403).json({ success: false, error: "Access denied" });
      }

      if (userRole === "client" && dataset.clientId !== userId) {
        return res.status(403).json({ success: false, error: "Access denied" });
      }

      await db
        .delete(clientDataMetrics)
        .where(
          and(
            eq(clientDataMetrics.id, metricId),
            eq(clientDataMetrics.datasetId, id)
          )
        );

      res.json({ success: true, message: "Metric deleted" });
    } catch (error: any) {
      console.error("[CLIENT-DATA] Error deleting metric:", error);
      res.status(500).json({
        success: false,
        error: error.message || "Failed to delete metric",
      });
    }
  }
);

router.get(
  "/datasets/:id/schema",
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
        return res.status(404).json({ success: false, error: "Dataset not found" });
      }

      if (userRole === "consultant" && dataset.consultantId !== userId) {
        return res.status(403).json({ success: false, error: "Access denied" });
      }

      if (userRole === "client" && dataset.clientId !== userId) {
        return res.status(403).json({ success: false, error: "Access denied" });
      }

      const result = await getSchema(id);
      res.json(result);
    } catch (error: any) {
      console.error("[CLIENT-DATA] Error getting schema:", error);
      res.status(500).json({
        success: false,
        error: error.message || "Failed to get schema",
      });
    }
  }
);

router.post(
  "/datasets/:id/cache/invalidate",
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
        return res.status(404).json({ success: false, error: "Dataset not found" });
      }

      if (userRole === "consultant" && dataset.consultantId !== userId) {
        return res.status(403).json({ success: false, error: "Access denied" });
      }

      if (userRole === "client" && dataset.clientId !== userId) {
        return res.status(403).json({ success: false, error: "Access denied" });
      }

      await invalidateCache(id);

      res.json({ success: true, message: "Cache invalidated" });
    } catch (error: any) {
      console.error("[CLIENT-DATA] Error invalidating cache:", error);
      res.status(500).json({
        success: false,
        error: error.message || "Failed to invalidate cache",
      });
    }
  }
);

router.get(
  "/datasets/:id/cache/stats",
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
        return res.status(404).json({ success: false, error: "Dataset not found" });
      }

      if (userRole === "consultant" && dataset.consultantId !== userId) {
        return res.status(403).json({ success: false, error: "Access denied" });
      }

      if (userRole === "client" && dataset.clientId !== userId) {
        return res.status(403).json({ success: false, error: "Access denied" });
      }

      const stats = await getCacheStats(id);

      res.json({ success: true, data: stats });
    } catch (error: any) {
      console.error("[CLIENT-DATA] Error getting cache stats:", error);
      res.status(500).json({
        success: false,
        error: error.message || "Failed to get cache stats",
      });
    }
  }
);

router.get(
  "/tools",
  authenticateToken,
  requireAnyRole(["consultant", "client"]),
  async (req: AuthRequest, res: Response) => {
    const tools = Object.entries(aiTools).map(([name, tool]) => ({
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    }));

    res.json({ success: true, data: tools });
  }
);

router.post(
  "/datasets/:id/ask",
  authenticateToken,
  requireAnyRole(["consultant", "client"]),
  async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { question } = req.body as { question: string };
      const userId = req.user!.id;
      const userRole = req.user!.role;

      if (!question || typeof question !== "string" || question.trim().length === 0) {
        return res.status(400).json({
          success: false,
          error: "Domanda richiesta",
        });
      }

      const [dataset] = await db
        .select()
        .from(clientDataDatasets)
        .where(eq(clientDataDatasets.id, id))
        .limit(1);

      if (!dataset) {
        return res.status(404).json({ success: false, error: "Dataset non trovato" });
      }

      if (userRole === "consultant" && dataset.consultantId !== userId) {
        return res.status(403).json({ success: false, error: "Accesso negato" });
      }

      if (userRole === "client" && dataset.clientId !== userId) {
        return res.status(403).json({ success: false, error: "Accesso negato" });
      }

      if (dataset.status !== "ready") {
        return res.status(400).json({
          success: false,
          error: `Dataset non pronto. Stato: ${dataset.status}`,
        });
      }

      const columnMapping = dataset.columnMapping as Record<string, { displayName: string; dataType: string; description?: string }>;
      const datasetInfo = {
        id: dataset.id,
        name: dataset.name,
        columns: Object.entries(columnMapping).map(([name, info]) => ({
          name,
          displayName: info.displayName,
          dataType: info.dataType,
          description: info.description,
        })),
        rowCount: dataset.rowCount || 0,
      };

      console.log(`[CLIENT-DATA] Ask query: "${question}" on dataset ${id}`);

      const consultantId = dataset.consultantId || userId;
      const executionResult = await askDataset(question, [datasetInfo], consultantId, userId);

      console.log(`[CLIENT-DATA] Execution result:`, {
        planSteps: executionResult.plan.steps.length,
        resultsCount: executionResult.results.length,
        results: executionResult.results.map(r => ({
          tool: r.toolName,
          success: r.success,
          dataLength: Array.isArray(r.result) ? r.result.length : (r.result ? 'object' : 'null'),
          error: r.error,
        })),
      });

      const explanationResult = await explainResults(
        executionResult.results,
        question,
        consultantId
      );
      
      // Construct answer text from explanation
      let answer = explanationResult.summary;
      if (explanationResult.details.length > 0) {
        answer += "\n\n" + explanationResult.details.join("\n");
      }
      if (explanationResult.insights.length > 0) {
        answer += "\n\n" + explanationResult.insights.join("\n");
      }

      await db
        .update(clientDataDatasets)
        .set({ lastQueriedAt: new Date() })
        .where(eq(clientDataDatasets.id, id));

      const responseData = {
        question,
        answer,
        plan: {
          steps: executionResult.plan.steps,
          complexity: executionResult.plan.estimatedComplexity,
        },
        results: executionResult.results.map((r) => ({
          tool: r.toolName,
          success: r.success,
          data: r.result,
          error: r.error,
          executionTimeMs: r.executionTimeMs,
        })),
        totalExecutionTimeMs: executionResult.totalExecutionTimeMs,
        wasBlocked: explanationResult.wasBlocked || false,
        blockedResponse: explanationResult.blockedResponse,
        validationErrors: explanationResult.validationResult?.errors,
        inventedNumbers: explanationResult.validationResult?.inventedNumbers,
      };

      console.log(`[CLIENT-DATA] Response data summary:`, {
        hasAnswer: !!responseData.answer,
        answerLength: responseData.answer?.length || 0,
        resultsWithData: responseData.results.filter(r => r.success && r.data).length,
        firstResultDataSample: responseData.results[0]?.data?.slice?.(0, 2) || responseData.results[0]?.data,
      });

      res.json({
        success: true,
        data: responseData,
      });
    } catch (error: any) {
      console.error("[CLIENT-DATA] Ask error:", error);
      res.status(500).json({
        success: false,
        error: error.message || "Errore durante l'elaborazione della domanda",
      });
    }
  }
);

router.post(
  "/datasets/:id/reconcile",
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
        return res.status(404).json({ success: false, error: "Dataset non trovato" });
      }

      if (userRole === "consultant" && dataset.consultantId !== userId) {
        return res.status(403).json({ success: false, error: "Accesso negato" });
      }

      if (userRole === "client" && dataset.clientId !== userId) {
        return res.status(403).json({ success: false, error: "Accesso negato" });
      }

      console.log(`[CLIENT-DATA] Running reconciliation tests for dataset ${id}`);

      const report = await runReconciliationTests(id);

      reconciliationReportsCache.set(id, report);

      res.json({
        success: true,
        data: report,
      });
    } catch (error: any) {
      console.error("[CLIENT-DATA] Reconciliation error:", error);
      res.status(500).json({
        success: false,
        error: error.message || "Errore durante i test di riconciliazione",
      });
    }
  }
);

router.get(
  "/datasets/:id/reconciliation-report",
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
        return res.status(404).json({ success: false, error: "Dataset non trovato" });
      }

      if (userRole === "consultant" && dataset.consultantId !== userId) {
        return res.status(403).json({ success: false, error: "Accesso negato" });
      }

      if (userRole === "client" && dataset.clientId !== userId) {
        return res.status(403).json({ success: false, error: "Accesso negato" });
      }

      const cachedReport = reconciliationReportsCache.get(id);

      if (cachedReport) {
        res.json({
          success: true,
          data: cachedReport,
          cached: true,
        });
      } else {
        res.json({
          success: true,
          data: null,
          message: "Nessun report di riconciliazione disponibile. Esegui POST /reconcile per generarlo.",
        });
      }
    } catch (error: any) {
      console.error("[CLIENT-DATA] Error fetching reconciliation report:", error);
      res.status(500).json({
        success: false,
        error: error.message || "Errore nel recupero del report",
      });
    }
  }
);

router.post(
  "/datasets/:id/compare-aggregations",
  authenticateToken,
  requireAnyRole(["consultant", "client"]),
  async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { dsl1, dsl2, expectedRelation, expectedValue } = req.body as {
        dsl1: string;
        dsl2: string;
        expectedRelation: "equal" | "greater" | "less" | "sum";
        expectedValue?: number;
      };
      const userId = req.user!.id;
      const userRole = req.user!.role;

      if (!dsl1 || !dsl2 || !expectedRelation) {
        return res.status(400).json({
          success: false,
          error: "Parametri mancanti: dsl1, dsl2, expectedRelation",
        });
      }

      const [dataset] = await db
        .select()
        .from(clientDataDatasets)
        .where(eq(clientDataDatasets.id, id))
        .limit(1);

      if (!dataset) {
        return res.status(404).json({ success: false, error: "Dataset non trovato" });
      }

      if (userRole === "consultant" && dataset.consultantId !== userId) {
        return res.status(403).json({ success: false, error: "Accesso negato" });
      }

      if (userRole === "client" && dataset.clientId !== userId) {
        return res.status(403).json({ success: false, error: "Accesso negato" });
      }

      const result = await compareAggregations(id, dsl1, dsl2, expectedRelation, expectedValue);

      res.json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      console.error("[CLIENT-DATA] Compare aggregations error:", error);
      res.status(500).json({
        success: false,
        error: error.message || "Errore nel confronto aggregazioni",
      });
    }
  }
);

// ============================================================
// CONVERSATIONS ENDPOINTS
// ============================================================

router.get(
  "/conversations",
  authenticateToken,
  requireAnyRole(["consultant", "client"]),
  async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user!.id;
      const userRole = req.user!.role;

      let conversations;
      
      if (userRole === "consultant") {
        conversations = await db
          .select()
          .from(clientDataConversations)
          .where(eq(clientDataConversations.consultantId, userId))
          .orderBy(desc(clientDataConversations.lastMessageAt));
      } else {
        conversations = await db
          .select()
          .from(clientDataConversations)
          .where(eq(clientDataConversations.clientId, userId))
          .orderBy(desc(clientDataConversations.lastMessageAt));
      }

      res.json({
        success: true,
        data: conversations,
        count: conversations.length,
      });
    } catch (error: any) {
      console.error("[CLIENT-DATA] Error fetching conversations:", error);
      res.status(500).json({
        success: false,
        error: error.message || "Failed to fetch conversations",
      });
    }
  }
);

router.post(
  "/conversations",
  authenticateToken,
  requireAnyRole(["consultant", "client"]),
  async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user!.id;
      const userRole = req.user!.role;
      const { datasetId, title } = req.body;

      if (!datasetId) {
        return res.status(400).json({
          success: false,
          error: "Missing required field: datasetId",
        });
      }

      const [dataset] = await db
        .select()
        .from(clientDataDatasets)
        .where(eq(clientDataDatasets.id, datasetId))
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

      const conversationData: any = {
        datasetId: parseInt(datasetId, 10),
        title: title || `Conversation on ${dataset.name}`,
        clientId: userRole === "client" ? userId : dataset.clientId,
        consultantId: userRole === "consultant" ? userId : dataset.consultantId,
      };

      const [inserted] = await db
        .insert(clientDataConversations)
        .values(conversationData)
        .returning();

      console.log(`[CLIENT-DATA] Conversation created: ${inserted.id}`);

      res.status(201).json({
        success: true,
        data: inserted,
      });
    } catch (error: any) {
      console.error("[CLIENT-DATA] Error creating conversation:", error);
      res.status(500).json({
        success: false,
        error: error.message || "Failed to create conversation",
      });
    }
  }
);

router.get(
  "/conversations/:id",
  authenticateToken,
  requireAnyRole(["consultant", "client"]),
  async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const userId = req.user!.id;
      const userRole = req.user!.role;

      const [conversation] = await db
        .select()
        .from(clientDataConversations)
        .where(eq(clientDataConversations.id, id))
        .limit(1);

      if (!conversation) {
        return res.status(404).json({
          success: false,
          error: "Conversation not found",
        });
      }

      if (userRole === "consultant" && conversation.consultantId !== userId) {
        return res.status(403).json({ success: false, error: "Access denied" });
      }

      if (userRole === "client" && conversation.clientId !== userId) {
        return res.status(403).json({ success: false, error: "Access denied" });
      }

      const messages = await db
        .select()
        .from(clientDataMessages)
        .where(eq(clientDataMessages.conversationId, id))
        .orderBy(clientDataMessages.createdAt);

      res.json({
        success: true,
        data: {
          conversation,
          messages,
        },
      });
    } catch (error: any) {
      console.error("[CLIENT-DATA] Error fetching conversation:", error);
      res.status(500).json({
        success: false,
        error: error.message || "Failed to fetch conversation",
      });
    }
  }
);

router.delete(
  "/conversations/:id",
  authenticateToken,
  requireAnyRole(["consultant", "client"]),
  async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const userId = req.user!.id;
      const userRole = req.user!.role;

      const [conversation] = await db
        .select()
        .from(clientDataConversations)
        .where(eq(clientDataConversations.id, id))
        .limit(1);

      if (!conversation) {
        return res.status(404).json({
          success: false,
          error: "Conversation not found",
        });
      }

      if (userRole === "consultant" && conversation.consultantId !== userId) {
        return res.status(403).json({ success: false, error: "Access denied" });
      }

      if (userRole === "client" && conversation.clientId !== userId) {
        return res.status(403).json({ success: false, error: "Access denied" });
      }

      await db.delete(clientDataConversations).where(eq(clientDataConversations.id, id));

      console.log(`[CLIENT-DATA] Conversation deleted: ${id}`);

      res.json({
        success: true,
        message: "Conversation deleted successfully",
      });
    } catch (error: any) {
      console.error("[CLIENT-DATA] Error deleting conversation:", error);
      res.status(500).json({
        success: false,
        error: error.message || "Failed to delete conversation",
      });
    }
  }
);

// ============================================================
// MESSAGES ENDPOINT
// ============================================================

router.post(
  "/conversations/:id/messages",
  authenticateToken,
  requireAnyRole(["consultant", "client"]),
  async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { content, model, thinkingLevel, writingStyle, responseLength, customInstructions } = req.body as { 
        content: string;
        model?: string;
        thinkingLevel?: string;
        writingStyle?: string;
        responseLength?: string;
        customInstructions?: string;
      };
      const userId = req.user!.id;
      const userRole = req.user!.role;

      if (!content || typeof content !== "string" || content.trim().length === 0) {
        return res.status(400).json({
          success: false,
          error: "Message content is required",
        });
      }

      const [conversation] = await db
        .select()
        .from(clientDataConversations)
        .where(eq(clientDataConversations.id, id))
        .limit(1);

      if (!conversation) {
        return res.status(404).json({ success: false, error: "Conversation not found" });
      }

      if (userRole === "consultant" && conversation.consultantId !== userId) {
        return res.status(403).json({ success: false, error: "Access denied" });
      }

      if (userRole === "client" && conversation.clientId !== userId) {
        return res.status(403).json({ success: false, error: "Access denied" });
      }

      const [dataset] = await db
        .select()
        .from(clientDataDatasets)
        .where(eq(clientDataDatasets.id, conversation.datasetId.toString()))
        .limit(1);

      if (!dataset) {
        return res.status(404).json({ success: false, error: "Dataset not found" });
      }

      if (dataset.status !== "ready") {
        return res.status(400).json({
          success: false,
          error: `Dataset not ready. Status: ${dataset.status}`,
        });
      }

      const [userMessage] = await db
        .insert(clientDataMessages)
        .values({
          conversationId: id,
          role: "user",
          content: content.trim(),
        })
        .returning();

      console.log(`[CLIENT-DATA] User message saved: ${userMessage.id}`);

      // Load FULL conversation history for context-aware intent routing
      // No limit - load all messages for complete context
      // Include queryResult for tool results context
      const previousMessages = await db
        .select({
          id: clientDataMessages.id,
          role: clientDataMessages.role,
          content: clientDataMessages.content,
          toolCalls: clientDataMessages.toolCalls,
          queryResult: clientDataMessages.queryResult,
        })
        .from(clientDataMessages)
        .where(eq(clientDataMessages.conversationId, id))
        .orderBy(desc(clientDataMessages.createdAt));

      // Filter out the just-inserted message by ID and reverse for chronological order
      const conversationHistory = previousMessages
        .filter(m => m.id !== userMessage.id)
        .reverse()
        .map(m => ({
          role: m.role as "user" | "assistant",
          content: m.content,
          toolCalls: m.toolCalls as Array<{ toolName: string }> | undefined,
          toolResults: m.queryResult as Array<{ tool: string; data: any }> | undefined,
        }));

      console.log(`[CLIENT-DATA] Loaded ${conversationHistory.length} messages for context`);

      const columnMapping = dataset.columnMapping as Record<string, { displayName: string; dataType: string; description?: string }>;
      const datasetInfo = {
        id: dataset.id,
        name: dataset.name,
        columns: Object.entries(columnMapping).map(([name, info]) => ({
          name,
          displayName: info.displayName,
          dataType: info.dataType,
          description: info.description,
        })),
        rowCount: dataset.rowCount || 0,
      };

      console.log(`[CLIENT-DATA] Processing message: "${content}" on dataset ${dataset.id}`);

      const consultantId = dataset.consultantId || userId;
      const executionResult = await askDataset(content, [datasetInfo], consultantId, userId, conversationHistory);

      const toolCalls = executionResult.plan.steps.map((step) => ({
        toolName: step.name,
        params: step.args,
      }));

      const thinkingLines = executionResult.plan.steps.map((step, index) => {
        const argsPreview = Object.keys(step.args).slice(0, 3).join(", ");
        return `Step ${index + 1}: ${step.name}${argsPreview ? ` (${argsPreview})` : ""}`;
      });
      const thinking = thinkingLines.length > 0 
        ? thinkingLines.join("\n") + (executionResult.plan.reasoning ? `\n\n${executionResult.plan.reasoning}` : "")
        : executionResult.plan.reasoning || "";

      // Pass user preferences for AI response customization
      const userPreferences = {
        model: model || "gemini-3-flash-preview",
        thinkingLevel: thinkingLevel || "low",
        writingStyle: writingStyle || "default",
        responseLength: responseLength || "balanced",
        customInstructions: customInstructions || "",
      };

      const explanation = await generateNaturalLanguageResponse(
        executionResult.results,
        content,
        consultantId,
        userPreferences,
        conversationHistory
      );

      const queryResult = executionResult.results.map((r) => ({
        tool: r.toolName,
        success: r.success,
        data: r.result,
        error: r.error,
        executionTimeMs: r.executionTimeMs,
      }));

      const [assistantMessage] = await db
        .insert(clientDataMessages)
        .values({
          conversationId: id,
          role: "assistant",
          content: explanation,
          toolCalls,
          thinking,
          queryResult,
        })
        .returning();

      await db
        .update(clientDataConversations)
        .set({ 
          lastMessageAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(clientDataConversations.id, id));

      await db
        .update(clientDataDatasets)
        .set({ lastQueriedAt: new Date() })
        .where(eq(clientDataDatasets.id, dataset.id));

      console.log(`[CLIENT-DATA] Assistant message saved: ${assistantMessage.id}`);

      res.json({
        success: true,
        data: {
          userMessage,
          assistantMessage,
          plan: {
            steps: executionResult.plan.steps,
            complexity: executionResult.plan.estimatedComplexity,
          },
          totalExecutionTimeMs: executionResult.totalExecutionTimeMs,
        },
      });
    } catch (error: any) {
      console.error("[CLIENT-DATA] Message error:", error);
      res.status(500).json({
        success: false,
        error: error.message || "Failed to process message",
      });
    }
  }
);

// ============================================================
// AI PREFERENCES ENDPOINTS
// ============================================================

router.get(
  "/ai-preferences",
  authenticateToken,
  requireAnyRole(["consultant", "client"]),
  async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user!.id;

      const [preferences] = await db
        .select()
        .from(clientDataAiPreferences)
        .where(eq(clientDataAiPreferences.clientId, userId))
        .limit(1);

      if (!preferences) {
        return res.json({
          success: true,
          data: {
            clientId: userId,
            preferredModel: "gemini-2.5-flash",
            thinkingLevel: "none",
            writingStyle: "default",
            responseLength: "medium",
            customInstructions: null,
          },
        });
      }

      res.json({
        success: true,
        data: preferences,
      });
    } catch (error: any) {
      console.error("[CLIENT-DATA] Error fetching AI preferences:", error);
      res.status(500).json({
        success: false,
        error: error.message || "Failed to fetch AI preferences",
      });
    }
  }
);

router.put(
  "/ai-preferences",
  authenticateToken,
  requireAnyRole(["consultant", "client"]),
  async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user!.id;
      const { preferredModel, thinkingLevel, writingStyle, responseLength, customInstructions } = req.body;

      const [existing] = await db
        .select()
        .from(clientDataAiPreferences)
        .where(eq(clientDataAiPreferences.clientId, userId))
        .limit(1);

      let result;

      if (existing) {
        [result] = await db
          .update(clientDataAiPreferences)
          .set({
            preferredModel: preferredModel ?? existing.preferredModel,
            thinkingLevel: thinkingLevel ?? existing.thinkingLevel,
            writingStyle: writingStyle ?? existing.writingStyle,
            responseLength: responseLength ?? existing.responseLength,
            customInstructions: customInstructions !== undefined ? customInstructions : existing.customInstructions,
            updatedAt: new Date(),
          })
          .where(eq(clientDataAiPreferences.clientId, userId))
          .returning();

        console.log(`[CLIENT-DATA] AI preferences updated for user: ${userId}`);
      } else {
        [result] = await db
          .insert(clientDataAiPreferences)
          .values({
            clientId: userId,
            preferredModel: preferredModel ?? "gemini-2.5-flash",
            thinkingLevel: thinkingLevel ?? "none",
            writingStyle: writingStyle ?? "default",
            responseLength: responseLength ?? "medium",
            customInstructions: customInstructions ?? null,
          })
          .returning();

        console.log(`[CLIENT-DATA] AI preferences created for user: ${userId}`);
      }

      res.json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      console.error("[CLIENT-DATA] Error updating AI preferences:", error);
      res.status(500).json({
        success: false,
        error: error.message || "Failed to update AI preferences",
      });
    }
  }
);

router.get(
  "/datasets/:id/semantic-mappings",
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
        .where(eq(clientDataDatasets.id, parseInt(id)))
        .limit(1);

      if (!dataset) {
        return res.status(404).json({ success: false, error: "Dataset not found" });
      }

      if (userRole === "consultant" && dataset.consultantId !== userId) {
        return res.status(403).json({ success: false, error: "Access denied" });
      }

      if (userRole === "client" && dataset.clientId !== userId) {
        return res.status(403).json({ success: false, error: "Access denied" });
      }

      const result = await getSemanticMappings(dataset.id);

      res.json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      console.error("[CLIENT-DATA] Error fetching semantic mappings:", error);
      res.status(500).json({
        success: false,
        error: error.message || "Failed to fetch semantic mappings",
      });
    }
  }
);

router.get(
  "/datasets/:id/available-metrics",
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
        .where(eq(clientDataDatasets.id, parseInt(id)))
        .limit(1);

      if (!dataset) {
        return res.status(404).json({ success: false, error: "Dataset not found" });
      }

      if (userRole === "consultant" && dataset.consultantId !== userId) {
        return res.status(403).json({ success: false, error: "Access denied" });
      }

      if (userRole === "client" && dataset.clientId !== userId) {
        return res.status(403).json({ success: false, error: "Access denied" });
      }

      const semanticMappings = await getSemanticMappings(dataset.id);
      const mappedLogicalRoles = new Set(
        semanticMappings.mappings
          .filter((m: any) => m.status === 'confirmed' || m.status === 'auto')
          .map((m: any) => m.logicalRole)
      );

      const { METRIC_TEMPLATES } = await import("../ai/data-analysis/metric-templates");

      const availableMetrics: Array<{
        name: string;
        displayName: string;
        description: string;
        unit: string;
        available: boolean;
        missingColumns: string[];
        category: string;
      }> = [];

      function deriveMetricCategory(metricName: string): string {
        if (metricName.includes("missing_") || metricName.includes("unmapped_") || metricName.includes("negative_") || metricName === "lines_count") {
          return "data_quality";
        }
        if (metricName.includes("revenue")) return "fatturato";
        if (metricName.includes("_count") || metricName === "quantity_total") return "conteggio";
        if (metricName.includes("food_cost") || metricName.includes("gross_margin")) {
          if (metricName.includes("per_item") || metricName.includes("per_document")) {
            return "menu_engineering";
          }
          return "costi_margini";
        }
        if (metricName.includes("avg_") || metricName.includes("ticket_medio")) return "medie";
        if (metricName.includes("discount")) return "sconti";
        if (metricName.includes("_share")) return "mix_incidenze";
        return "altro";
      }

      for (const [name, template] of Object.entries(METRIC_TEMPLATES)) {
        const missingColumns = template.requiredLogicalColumns.filter(
          (col: string) => !mappedLogicalRoles.has(col)
        );

        availableMetrics.push({
          name,
          displayName: template.displayName,
          description: template.description,
          unit: template.unit,
          available: missingColumns.length === 0,
          missingColumns,
          category: deriveMetricCategory(name),
        });
      }

      const ROLE_DESCRIPTIONS: Record<string, string> = {
        price: "Prezzo unitario di vendita",
        cost: "Costo unitario di acquisto",
        quantity: "Quantità venduta",
        order_date: "Data della transazione",
        order_id: "ID ordine/documento",
        document_id: "ID documento (alias order_id)",
        line_id: "ID riga/dettaglio",
        revenue_amount: "Importo riga (già calcolato)",
        customer_id: "ID cliente",
        customer_name: "Nome cliente",
        product_id: "ID prodotto",
        product_name: "Nome prodotto",
        category: "Categoria prodotto",
        subcategory: "Sotto-categoria prodotto",
        supplier_id: "ID fornitore",
        supplier_name: "Nome fornitore",
        discount_percent: "Percentuale sconto",
        total_net: "Totale netto riga",
        tax_rate: "Aliquota IVA",
        payment_method: "Metodo di pagamento",
        staff: "Operatore/cassiere",
        status: "Stato ordine",
        warehouse: "Magazzino/punto vendita",
        is_sellable: "Flag prodotto vendibile",
      };

      const logicalRolesStatus = Object.keys(ROLE_DESCRIPTIONS).map(role => ({
        role,
        description: ROLE_DESCRIPTIONS[role],
        mapped: mappedLogicalRoles.has(role),
        physicalColumn: semanticMappings.mappings.find((m: any) => m.logicalRole === role)?.physicalColumn || null,
      }));

      res.json({
        success: true,
        data: {
          datasetId: dataset.id,
          datasetName: dataset.name,
          logicalRoles: logicalRolesStatus,
          metrics: availableMetrics,
          summary: {
            totalMetrics: availableMetrics.length,
            availableMetrics: availableMetrics.filter(m => m.available).length,
            unavailableMetrics: availableMetrics.filter(m => !m.available).length,
            mappedRoles: Array.from(mappedLogicalRoles),
          },
        },
      });
    } catch (error: any) {
      console.error("[CLIENT-DATA] Error fetching available metrics:", error);
      res.status(500).json({
        success: false,
        error: error.message || "Failed to fetch available metrics",
      });
    }
  }
);

router.post(
  "/datasets/:id/semantic-mappings/confirm",
  authenticateToken,
  requireAnyRole(["consultant", "client"]),
  async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { confirmations } = req.body as {
        confirmations: Array<{ physicalColumn: string; logicalRole?: string }>;
      };
      const userId = req.user!.id;
      const userRole = req.user!.role;

      if (!confirmations || !Array.isArray(confirmations) || confirmations.length === 0) {
        return res.status(400).json({
          success: false,
          error: "Missing or invalid confirmations array",
        });
      }

      const [dataset] = await db
        .select()
        .from(clientDataDatasets)
        .where(eq(clientDataDatasets.id, parseInt(id)))
        .limit(1);

      if (!dataset) {
        return res.status(404).json({ success: false, error: "Dataset not found" });
      }

      if (userRole === "consultant" && dataset.consultantId !== userId) {
        return res.status(403).json({ success: false, error: "Access denied" });
      }

      if (userRole === "client" && dataset.clientId !== userId) {
        return res.status(403).json({ success: false, error: "Access denied" });
      }

      const result = await confirmSemanticMappings(dataset.id, confirmations, userId);

      res.json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      console.error("[CLIENT-DATA] Error confirming semantic mappings:", error);
      res.status(500).json({
        success: false,
        error: error.message || "Failed to confirm semantic mappings",
      });
    }
  }
);

router.post(
  "/datasets/:id/semantic-mappings/reject",
  authenticateToken,
  requireAnyRole(["consultant", "client"]),
  async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { physicalColumn } = req.body as { physicalColumn: string };
      const userId = req.user!.id;
      const userRole = req.user!.role;

      if (!physicalColumn) {
        return res.status(400).json({
          success: false,
          error: "Missing physicalColumn",
        });
      }

      const [dataset] = await db
        .select()
        .from(clientDataDatasets)
        .where(eq(clientDataDatasets.id, parseInt(id)))
        .limit(1);

      if (!dataset) {
        return res.status(404).json({ success: false, error: "Dataset not found" });
      }

      if (userRole === "consultant" && dataset.consultantId !== userId) {
        return res.status(403).json({ success: false, error: "Access denied" });
      }

      if (userRole === "client" && dataset.clientId !== userId) {
        return res.status(403).json({ success: false, error: "Access denied" });
      }

      await rejectSemanticMapping(dataset.id, physicalColumn, userId);

      res.json({
        success: true,
        message: "Mapping rejected",
      });
    } catch (error: any) {
      console.error("[CLIENT-DATA] Error rejecting semantic mapping:", error);
      res.status(500).json({
        success: false,
        error: error.message || "Failed to reject semantic mapping",
      });
    }
  }
);

router.get(
  "/datasets/:id/ai-mapping-suggestions",
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
        .where(eq(clientDataDatasets.id, parseInt(id)))
        .limit(1);

      if (!dataset) {
        return res.status(404).json({ success: false, error: "Dataset not found" });
      }

      if (userRole === "consultant" && dataset.consultantId !== userId) {
        return res.status(403).json({ success: false, error: "Access denied" });
      }

      if (userRole === "client" && dataset.clientId !== userId) {
        return res.status(403).json({ success: false, error: "Access denied" });
      }

      if (!dataset.tableName) {
        return res.status(400).json({ 
          success: false, 
          error: "Dataset non ha una tabella associata" 
        });
      }

      console.log(`[CLIENT-DATA] Generating AI mapping suggestions for dataset ${id}`);
      const suggestions = await generateAIMappingSuggestions(dataset.id, dataset.tableName);

      res.json({
        success: true,
        data: suggestions,
      });
    } catch (error: any) {
      console.error("[CLIENT-DATA] Error generating AI mapping suggestions:", error);
      res.status(500).json({
        success: false,
        error: error.message || "Failed to generate AI mapping suggestions",
      });
    }
  }
);

router.get(
  "/datasets/:id/analytics-status",
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
        .where(eq(clientDataDatasets.id, parseInt(id)))
        .limit(1);

      if (!dataset) {
        return res.status(404).json({ success: false, error: "Dataset not found" });
      }

      if (userRole === "consultant" && dataset.consultantId !== userId) {
        return res.status(403).json({ success: false, error: "Access denied" });
      }

      if (userRole === "client" && dataset.clientId !== userId) {
        return res.status(403).json({ success: false, error: "Access denied" });
      }

      const result = await checkAnalyticsEnabled(dataset.id);

      res.json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      console.error("[CLIENT-DATA] Error checking analytics status:", error);
      res.status(500).json({
        success: false,
        error: error.message || "Failed to check analytics status",
      });
    }
  }
);

router.get(
  "/datasets/:id/smart-questions",
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
        .where(eq(clientDataDatasets.id, parseInt(id)))
        .limit(1);

      if (!dataset) {
        return res.status(404).json({ success: false, error: "Dataset not found" });
      }

      if (userRole === "consultant" && dataset.consultantId !== userId) {
        return res.status(403).json({ success: false, error: "Access denied" });
      }

      if (userRole === "client" && dataset.clientId !== userId) {
        return res.status(403).json({ success: false, error: "Access denied" });
      }

      const consultantId = dataset.consultantId || userId;
      console.log(`[CLIENT-DATA] Generating smart questions for dataset ${id}`);
      const result = await generateSmartQuestions(dataset.id, consultantId);

      res.json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      console.error("[CLIENT-DATA] Error generating smart questions:", error);
      res.status(500).json({
        success: false,
        error: error.message || "Failed to generate smart questions",
      });
    }
  }
);

router.post(
  "/datasets/:id/full-audit",
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
        .where(eq(clientDataDatasets.id, parseInt(id)))
        .limit(1);

      if (!dataset) {
        return res.status(404).json({ success: false, error: "Dataset not found" });
      }

      if (userRole === "consultant" && dataset.consultantId !== userId) {
        return res.status(403).json({ success: false, error: "Access denied" });
      }

      if (userRole === "client" && dataset.clientId !== userId) {
        return res.status(403).json({ success: false, error: "Access denied" });
      }

      const consultantId = dataset.consultantId || userId;
      console.log(`[CLIENT-DATA] Starting full audit for dataset ${id}`);
      const result = await runFullAudit(dataset.id, consultantId);

      res.json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      console.error("[CLIENT-DATA] Error running full audit:", error);
      res.status(500).json({
        success: false,
        error: error.message || "Failed to run full audit",
      });
    }
  }
);

// ============================================================
// CUSTOM MAPPING RULES ENDPOINTS
// ============================================================

router.get(
  "/mapping-rules",
  authenticateToken,
  requireRole("consultant"),
  async (req: AuthRequest, res: Response) => {
    try {
      const consultantId = req.user!.id;
      
      const rules = await db
        .select()
        .from(customMappingRules)
        .where(eq(customMappingRules.consultantId, consultantId))
        .orderBy(desc(customMappingRules.priority), customMappingRules.columnPattern);

      res.json({
        success: true,
        data: rules,
      });
    } catch (error: any) {
      console.error("[CLIENT-DATA] Error fetching custom mapping rules:", error);
      res.status(500).json({
        success: false,
        error: error.message || "Failed to fetch custom mapping rules",
      });
    }
  }
);

router.post(
  "/mapping-rules",
  authenticateToken,
  requireRole("consultant"),
  async (req: AuthRequest, res: Response) => {
    try {
      const consultantId = req.user!.id;
      const { columnPattern, logicalRole, matchType, caseSensitive, priority, description } = req.body;

      if (!columnPattern || !logicalRole) {
        return res.status(400).json({
          success: false,
          error: "columnPattern e logicalRole sono obbligatori",
        });
      }

      const [newRule] = await db
        .insert(customMappingRules)
        .values({
          consultantId,
          columnPattern,
          logicalRole,
          matchType: matchType || "contains",
          caseSensitive: caseSensitive ?? false,
          priority: priority ?? 0,
          description,
        })
        .returning();

      console.log(`[MAPPING-RULES] Created rule ${newRule.id} for consultant ${consultantId}: "${columnPattern}" -> ${logicalRole}`);

      res.json({
        success: true,
        data: newRule,
      });
    } catch (error: any) {
      console.error("[CLIENT-DATA] Error creating custom mapping rule:", error);
      res.status(500).json({
        success: false,
        error: error.message || "Failed to create custom mapping rule",
      });
    }
  }
);

router.put(
  "/mapping-rules/:id",
  authenticateToken,
  requireRole("consultant"),
  async (req: AuthRequest, res: Response) => {
    try {
      const consultantId = req.user!.id;
      const ruleId = parseInt(req.params.id);
      const { columnPattern, logicalRole, matchType, caseSensitive, priority, description } = req.body;

      const [existing] = await db
        .select()
        .from(customMappingRules)
        .where(and(
          eq(customMappingRules.id, ruleId),
          eq(customMappingRules.consultantId, consultantId)
        ))
        .limit(1);

      if (!existing) {
        return res.status(404).json({
          success: false,
          error: "Regola non trovata",
        });
      }

      const [updated] = await db
        .update(customMappingRules)
        .set({
          columnPattern: columnPattern ?? existing.columnPattern,
          logicalRole: logicalRole ?? existing.logicalRole,
          matchType: matchType ?? existing.matchType,
          caseSensitive: caseSensitive ?? existing.caseSensitive,
          priority: priority ?? existing.priority,
          description: description ?? existing.description,
          updatedAt: new Date(),
        })
        .where(eq(customMappingRules.id, ruleId))
        .returning();

      console.log(`[MAPPING-RULES] Updated rule ${ruleId} for consultant ${consultantId}`);

      res.json({
        success: true,
        data: updated,
      });
    } catch (error: any) {
      console.error("[CLIENT-DATA] Error updating custom mapping rule:", error);
      res.status(500).json({
        success: false,
        error: error.message || "Failed to update custom mapping rule",
      });
    }
  }
);

router.delete(
  "/mapping-rules/:id",
  authenticateToken,
  requireRole("consultant"),
  async (req: AuthRequest, res: Response) => {
    try {
      const consultantId = req.user!.id;
      const ruleId = parseInt(req.params.id);

      const [existing] = await db
        .select()
        .from(customMappingRules)
        .where(and(
          eq(customMappingRules.id, ruleId),
          eq(customMappingRules.consultantId, consultantId)
        ))
        .limit(1);

      if (!existing) {
        return res.status(404).json({
          success: false,
          error: "Regola non trovata",
        });
      }

      await db
        .delete(customMappingRules)
        .where(eq(customMappingRules.id, ruleId));

      console.log(`[MAPPING-RULES] Deleted rule ${ruleId} for consultant ${consultantId}`);

      res.json({
        success: true,
        message: "Regola eliminata",
      });
    } catch (error: any) {
      console.error("[CLIENT-DATA] Error deleting custom mapping rule:", error);
      res.status(500).json({
        success: false,
        error: error.message || "Failed to delete custom mapping rule",
      });
    }
  }
);

export default router;
