import { Router, Response, Request } from "express";
import { db } from "../db";
import { eq, and, desc, sql } from "drizzle-orm";
import { AuthRequest, authenticateToken, requireRole, requireAnyRole } from "../middleware/auth";
import { upload } from "../middleware/upload";
import { processExcelFile } from "../services/client-data/upload-processor";
import { discoverColumns, saveColumnMapping } from "../services/client-data/column-discovery";
import { generateTableName, createDynamicTable, insertParsedRowsToTable, sanitizeColumnName } from "../services/client-data/table-generator";
import { detectAndSaveSemanticMappings } from "../services/client-data/semantic-mapping-service";
import { LOGICAL_COLUMNS, COLUMN_AUTO_DETECT_PATTERNS } from "../ai/data-analysis/logical-columns";
import { nanoid } from "nanoid";
import crypto from "crypto";
import fs from "fs";
import path from "path";

const router = Router();

const UPLOAD_DIR = 'uploads/dataset-sync';

async function ensureUploadDir() {
  try {
    await fs.promises.access(UPLOAD_DIR);
  } catch {
    await fs.promises.mkdir(UPLOAD_DIR, { recursive: true });
  }
}

function generateApiKey(consultantId: string): string {
  const random = crypto.randomBytes(16).toString('hex');
  return `dsync_${consultantId.substring(0, 8)}_${random}`;
}

function generateSecretKey(): string {
  return crypto.randomBytes(32).toString('hex');
}

function verifyHmacSignature(payload: Buffer, signature: string, secretKey: string): boolean {
  const expectedSignature = `sha256=${crypto
    .createHmac('sha256', secretKey)
    .update(payload)
    .digest('hex')}`;
  
  // Use constant-time comparison to prevent timing attacks
  if (signature.length !== expectedSignature.length) {
    return false;
  }
  
  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature, 'utf8'),
      Buffer.from(expectedSignature, 'utf8')
    );
  } catch {
    return false;
  }
}

function verifyTimestamp(timestampStr: string, maxAgeSeconds: number = 300): boolean {
  const timestamp = parseInt(timestampStr, 10);
  if (isNaN(timestamp)) return false;
  const now = Math.floor(Date.now() / 1000);
  return Math.abs(now - timestamp) <= maxAgeSeconds;
}

router.get("/schema", async (req: Request, res: Response) => {
  try {
    const roles = Object.entries(LOGICAL_COLUMNS).map(([key, def]) => ({
      id: key,
      name: def.displayName,
      nameIt: def.displayNameIt,
      dataType: def.dataType,
      description: def.description,
      aliases: (def as any).aliases || [],
      requiredForMetrics: def.requiredForMetrics || [],
      autoDetectPatterns: COLUMN_AUTO_DETECT_PATTERNS[key]?.map(p => p.source) || [],
    }));

    const criticalRoles = ["price", "cost", "quantity", "order_date", "revenue_amount"];
    const documentRoles = ["document_id", "line_id", "document_type"];
    const productRoles = ["product_id", "product_name", "category", "is_sellable"];
    const customerRoles = ["customer_id", "customer_name"];
    const financialRoles = ["discount_percent", "total_net", "tax_rate", "payment_method"];
    const temporalRoles = ["time_slot", "sales_channel"];
    const staffRoles = ["staff"];

    res.json({
      success: true,
      version: "2.0",
      lastUpdated: "2026-01-24",
      totalRoles: roles.length,
      roleCategories: {
        critical: criticalRoles,
        document: documentRoles,
        product: productRoles,
        customer: customerRoles,
        financial: financialRoles,
        temporal: temporalRoles,
        staff: staffRoles,
      },
      roles,
      defaults: {
        document_type: "sale",
        sales_channel: "dine_in",
        time_slot_mapping: {
          breakfast: "06:00-11:00",
          lunch: "11:00-15:00",
          dinner: "18:00-23:00",
          late: "23:00-04:00",
        },
      },
      schedulingOptions: [
        { pattern: "daily@HH:MM", example: "daily@06:00" },
        { pattern: "weekly@DOW@HH:MM", example: "weekly@1@06:00" },
        { pattern: "monthly@DD@HH:MM", example: "monthly@01@06:00" },
        { pattern: "every_X_days@HH:MM", example: "every_3_days@06:00" },
        { pattern: "webhook_only", example: "webhook_only" },
      ],
    });
  } catch (error: any) {
    console.error("[DATASET-SYNC] Error fetching schema:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post(
  "/webhook/:apiKey",
  upload.single("file"),
  async (req: Request, res: Response) => {
    const startTime = Date.now();
    const syncId = `sync_${nanoid(12)}`;
    let sourceId: number | null = null;
    let sourceData: any = null;

    try {
      await ensureUploadDir();

      const { apiKey } = req.params;
      const signature = req.headers['x-dataset-signature'] as string;
      const timestamp = req.headers['x-dataset-timestamp'] as string;
      const idempotencyKey = req.headers['x-idempotency-key'] as string;

      if (!apiKey || !apiKey.startsWith('dsync_')) {
        return res.status(401).json({
          success: false,
          error: "INVALID_API_KEY_FORMAT",
          message: "Formato API key non valido",
        });
      }

      const sourceResult = await db.execute<any>(
        sql`SELECT * FROM dataset_sync_sources WHERE api_key = ${apiKey} AND is_active = true`
      );
      const source = sourceResult.rows || [];

      if (!source || source.length === 0) {
        return res.status(401).json({
          success: false,
          error: "INVALID_API_KEY",
          message: "API key non valida o disattivata",
        });
      }

      sourceData = source[0];
      sourceId = sourceData.id;

      if (signature && sourceData.secret_key) {
        const rawBody = (req as any).rawBody || Buffer.from(JSON.stringify(req.body));
        if (!verifyHmacSignature(rawBody, signature, sourceData.secret_key)) {
          console.warn(`[DATASET-SYNC] Invalid HMAC signature for source ${sourceId}`);
          return res.status(401).json({
            success: false,
            error: "INVALID_SIGNATURE",
            message: "Firma HMAC non valida",
          });
        }
        console.log(`[DATASET-SYNC] HMAC signature verified for source ${sourceId}`);
      }

      if (timestamp) {
        if (!verifyTimestamp(timestamp)) {
          return res.status(401).json({
            success: false,
            error: "EXPIRED_TIMESTAMP",
            message: "Timestamp della richiesta scaduto (max 5 minuti)",
          });
        }
      }

      if (idempotencyKey) {
        const existingResult = await db.execute<any>(
          sql`SELECT id FROM dataset_sync_history WHERE idempotency_key = ${idempotencyKey}`
        );
        const existing = existingResult.rows || [];
        if (existing && existing.length > 0) {
          return res.status(200).json({
            success: true,
            syncId: "duplicate",
            message: "Richiesta già processata (idempotenza)",
          });
        }
      }

      if (!req.file) {
        await db.execute(sql`
          INSERT INTO dataset_sync_history (source_id, sync_id, status, triggered_by, error_code, error_message, idempotency_key, request_ip)
          VALUES (${sourceId}, ${syncId}, 'failed', 'webhook', 'MISSING_FILE', 'Nessun file caricato', ${idempotencyKey || null}, ${req.ip || null})
        `);
        return res.status(400).json({
          success: false,
          error: "MISSING_FILE",
          message: "Nessun file caricato",
        });
      }

      const { originalname, path: tempPath, size } = req.file;
      const ext = path.extname(originalname).toLowerCase();

      if (![".xlsx", ".xls", ".csv"].includes(ext)) {
        await fs.promises.unlink(tempPath);
        await db.execute(sql`
          INSERT INTO dataset_sync_history (source_id, sync_id, status, triggered_by, file_name, file_size_bytes, error_code, error_message, idempotency_key, request_ip)
          VALUES (${sourceId}, ${syncId}, 'failed', 'webhook', ${originalname}, ${size}, 'INVALID_FILE_TYPE', 'Tipo file non supportato', ${idempotencyKey || null}, ${req.ip || null})
        `);
        return res.status(400).json({
          success: false,
          error: "INVALID_FILE_TYPE",
          message: "Tipo file non supportato. Accettati: .xlsx, .xls, .csv",
        });
      }

      await db.execute(sql`
        INSERT INTO dataset_sync_history (source_id, sync_id, status, triggered_by, file_name, file_size_bytes, idempotency_key, request_ip)
        VALUES (${sourceId}, ${syncId}, 'processing', 'webhook', ${originalname}, ${size}, ${idempotencyKey || null}, ${req.ip || null})
      `);

      const newPath = path.join(UPLOAD_DIR, `${syncId}_${originalname}`);
      await fs.promises.rename(tempPath, newPath);

      console.log(`[DATASET-SYNC] Processing file: ${originalname} (${size} bytes) for source ${sourceId}`);

      const processedFile = await processExcelFile(newPath, originalname);

      if (processedFile.sheets.length === 0 || processedFile.sheets[0].rowCount === 0) {
        const durationMs = Date.now() - startTime;
        await db.execute(sql`
          UPDATE dataset_sync_history 
          SET status = 'failed', completed_at = now(), duration_ms = ${durationMs}, error_code = 'EMPTY_FILE', error_message = 'File vuoto o senza righe valide'
          WHERE sync_id = ${syncId}
        `);
        return res.status(400).json({
          success: false,
          error: "EMPTY_FILE",
          message: "File vuoto o senza righe valide",
        });
      }

      const sheet = processedFile.sheets[0];
      const headers = sheet.columns.map(c => c.name);
      const totalRows = sheet.rowCount;

      // Trasforma i dati nel formato DistributedSample richiesto da discoverColumns
      const sample = {
        columns: headers,
        rows: sheet.sampleRows,
        totalRowCount: sheet.rowCount,
        sampledFromStart: sheet.sampleRows.length,
        sampledFromMiddle: 0,
        sampledFromEnd: 0
      };
      const discoveryResult = await discoverColumns(sample, originalname, sourceData.consultant_id);

      // Una colonna è considerata "mappata" se ha un patternMatched o confidence >= 0.8
      const mappedColumns = discoveryResult.columns.filter(c => c.patternMatched || c.confidence >= 0.8);
      const unmappedColumns = discoveryResult.columns.filter(c => !c.patternMatched && c.confidence < 0.8);

      let targetDatasetId = sourceData.target_dataset_id;
      let tableName: string;
      let needsTableCreation = false;

      // Client ID per il dataset
      const datasetClientId = sourceData.client_id || sourceData.consultant_id;

      if (targetDatasetId) {
        const existingDatasetResult = await db.execute<any>(
          sql`SELECT table_name FROM client_data_datasets WHERE id = ${targetDatasetId}`
        );
        const existingDataset = existingDatasetResult.rows || [];
        if (existingDataset && existingDataset.length > 0) {
          tableName = existingDataset[0].table_name;
          
          if (sourceData.replace_mode === 'full') {
            await db.execute(sql.raw(`TRUNCATE TABLE ${tableName}`));
          }
        } else {
          // Dataset ID esiste ma non trovato nel DB - crea nuova tabella
          const datasetName = sourceData.name || originalname || 'dataset';
          tableName = generateTableName(sourceData.consultant_id, datasetName);
          needsTableCreation = true;
          targetDatasetId = null; // Reset per creare nuovo dataset
        }
      } else {
        const datasetName = sourceData.name || originalname || 'dataset';
        tableName = generateTableName(sourceData.consultant_id, datasetName);
        needsTableCreation = true;
      }

      // Crea definizioni colonne - usa la struttura corretta per createDynamicTable
      const columnDefinitions = discoveryResult.columns.map(col => ({
        originalName: col.originalName || col.physicalColumn || 'column',
        suggestedName: col.physicalColumn || col.originalName || 'column',
        displayName: col.displayName || col.originalName || 'Column',
        dataType: (col.detectedType || col.dataType || 'TEXT') as "TEXT" | "NUMERIC" | "INTEGER" | "DATE" | "BOOLEAN",
        confidence: col.confidence || 0.5,
        sampleValues: col.sampleValues || [],
      }));

      // Crea tabella se necessario
      if (needsTableCreation) {
        await createDynamicTable(tableName, columnDefinitions, sourceData.consultant_id, datasetClientId);
      }

      // Prepara opzioni upsert se modalità upsert
      let upsertOptions: { mode: 'insert' | 'upsert'; keyColumns: string[] } | undefined = undefined;
      if (sourceData.replace_mode === 'upsert' && sourceData.upsert_key_columns?.length > 0) {
        upsertOptions = {
          mode: 'upsert' as const,
          keyColumns: sourceData.upsert_key_columns
        };
      }

      // Importa dati già parsati direttamente nella tabella
      const { rowsImported, rowsSkipped, rowsInserted, rowsUpdated } = await insertParsedRowsToTable(
        tableName,
        headers,
        sheet.sampleRows,
        sourceData.consultant_id,
        datasetClientId,
        upsertOptions
      );

      if (!targetDatasetId) {
        // Build column_mapping object (same structure as client-data-router)
        const columnMapping: Record<string, { displayName: string; dataType: string; description?: string }> = {};
        for (const col of columnDefinitions) {
          const dbColumnName = sanitizeColumnName(col.suggestedName || col.originalName);
          columnMapping[dbColumnName] = {
            displayName: col.displayName || col.originalName,
            dataType: col.dataType || 'TEXT',
          };
        }

        const insertedDatasetResult = await db.execute<any>(sql`
          INSERT INTO client_data_datasets (consultant_id, client_id, name, original_filename, table_name, status, row_count, column_count, column_mapping, auto_confirmed, confidence_score, created_at)
          VALUES (${sourceData.consultant_id}, ${datasetClientId}, ${`Sync: ${sourceData.name}`}, ${originalname}, ${tableName}, 'ready', ${rowsImported}, ${headers.length}, ${JSON.stringify(columnMapping)}::jsonb, ${discoveryResult.autoConfirmed}, ${discoveryResult.overallConfidence}, now())
          RETURNING id
        `);
        const insertedDataset = insertedDatasetResult.rows || [];
        targetDatasetId = insertedDataset[0].id;

        await db.execute(sql`
          UPDATE dataset_sync_sources SET target_dataset_id = ${targetDatasetId} WHERE id = ${sourceId}
        `);

        // Salva mapping per ogni colonna ad alta confidenza
        for (const col of discoveryResult.columns) {
          if (col.confidence >= 0.8) {
            await saveColumnMapping(
              sourceData.consultant_id,
              col.originalName,
              col.suggestedName || col.physicalColumn || col.originalName,
              col.dataType || col.detectedType || 'TEXT'
            );
          }
        }
        
        // Semantic mappings con array di nomi colonna
        const physicalColumns = discoveryResult.columns.map(c => c.suggestedName || c.physicalColumn || c.originalName);
        await detectAndSaveSemanticMappings(targetDatasetId, physicalColumns);
      }

      const durationMs = Date.now() - startTime;

      await db.execute(sql`
        UPDATE dataset_sync_history 
        SET status = 'completed', completed_at = now(), duration_ms = ${durationMs}, 
            rows_imported = ${rowsImported}, rows_skipped = ${rowsSkipped}, rows_total = ${totalRows},
            rows_inserted = ${rowsInserted}, rows_updated = ${rowsUpdated},
            columns_detected = ${headers.length}, 
            columns_mapped = ${JSON.stringify(mappedColumns.map(c => c.suggestedName))}::jsonb,
            columns_unmapped = ${JSON.stringify(unmappedColumns.map(c => c.physicalColumn || c.originalName))}::jsonb
        WHERE sync_id = ${syncId}
      `);

      console.log(`[DATASET-SYNC] Completed: ${rowsImported} rows imported, ${rowsSkipped} skipped in ${durationMs}ms`);

      res.json({
        success: true,
        syncId,
        rowsImported,
        rowsSkipped,
        rowsTotal: totalRows,
        columnsDetected: headers.length,
        mappingSummary: {
          mapped: mappedColumns.map(c => c.suggestedName),
          unmapped: unmappedColumns.map(c => c.physicalColumn || c.originalName),
        },
        durationMs,
      });

    } catch (error: any) {
      console.error("[DATASET-SYNC] Webhook error:", error);
      
      const durationMs = Date.now() - startTime;
      
      if (sourceId) {
        await db.execute(sql`
          UPDATE dataset_sync_history 
          SET status = 'failed', completed_at = now(), duration_ms = ${durationMs}, 
              error_code = 'INTERNAL_ERROR', error_message = ${error.message}
          WHERE sync_id = ${syncId}
        `);
      }

      res.status(500).json({
        success: false,
        error: "INTERNAL_ERROR",
        message: error.message,
      });
    }
  }
);

router.get(
  "/sources",
  authenticateToken,
  requireAnyRole(["consultant", "super_admin"]),
  async (req: AuthRequest, res: Response) => {
    try {
      const consultantId = req.user!.id;

      const sourcesResult = await db.execute<any>(sql`
        SELECT 
          s.id, s.name, s.description, s.api_key, s.secret_key, s.is_active, s.replace_mode, s.upsert_key_columns, s.target_dataset_id,
          s.rate_limit_per_hour, s.client_id, s.created_at, s.updated_at,
          u.first_name as client_first_name, u.last_name as client_last_name, u.email as client_email,
          (SELECT COUNT(*) FROM dataset_sync_history WHERE source_id = s.id) as sync_count,
          (SELECT MAX(started_at) FROM dataset_sync_history WHERE source_id = s.id) as last_sync_at
        FROM dataset_sync_sources s
        LEFT JOIN users u ON s.client_id = u.id
        WHERE s.consultant_id = ${consultantId}
        ORDER BY s.created_at DESC
      `);
      const sources = sourcesResult.rows || [];

      res.json({ success: true, data: sources });
    } catch (error: any) {
      console.error("[DATASET-SYNC] Error fetching sources:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

router.post(
  "/sources",
  authenticateToken,
  requireAnyRole(["consultant", "super_admin"]),
  async (req: AuthRequest, res: Response) => {
    try {
      const consultantId = req.user!.id;
      const { name, description, replaceMode = 'full', rateLimitPerHour = 100, clientId, upsertKeyColumns } = req.body;

      if (!name) {
        return res.status(400).json({ success: false, error: "Nome sorgente obbligatorio" });
      }

      const apiKey = generateApiKey(consultantId);
      const secretKey = generateSecretKey();

      // Parse upsertKeyColumns from comma-separated string to array
      let keyColumnsArray: string[] | null = null;
      if (replaceMode === 'upsert' && upsertKeyColumns) {
        keyColumnsArray = upsertKeyColumns
          .split(',')
          .map((c: string) => c.trim())
          .filter((c: string) => c.length > 0);
      }

      const insertedResult = await db.execute<any>(sql`
        INSERT INTO dataset_sync_sources (consultant_id, name, description, api_key, secret_key, replace_mode, rate_limit_per_hour, client_id, upsert_key_columns)
        VALUES (${consultantId}, ${name}, ${description || null}, ${apiKey}, ${secretKey}, ${replaceMode}, ${rateLimitPerHour}, ${clientId || null}, ${keyColumnsArray})
        RETURNING id, name, api_key, secret_key, is_active, replace_mode, upsert_key_columns, client_id, created_at
      `);
      const inserted = insertedResult.rows || [];

      res.json({ 
        success: true, 
        data: inserted[0],
        message: "Sorgente creata. Conserva la secret_key in modo sicuro - non sarà più visibile.",
      });
    } catch (error: any) {
      console.error("[DATASET-SYNC] Error creating source:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

router.delete(
  "/sources/:id",
  authenticateToken,
  requireAnyRole(["consultant", "super_admin"]),
  async (req: AuthRequest, res: Response) => {
    try {
      const consultantId = req.user!.id;
      const sourceId = parseInt(req.params.id);

      await db.execute(sql`
        DELETE FROM dataset_sync_sources 
        WHERE id = ${sourceId} AND consultant_id = ${consultantId}
      `);

      res.json({ success: true, message: "Sorgente eliminata" });
    } catch (error: any) {
      console.error("[DATASET-SYNC] Error deleting source:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

// Update source settings (including replace_mode and upsert_key_columns)
router.patch(
  "/sources/:id",
  authenticateToken,
  requireAnyRole(["consultant", "super_admin"]),
  async (req: AuthRequest, res: Response) => {
    try {
      const consultantId = req.user!.id;
      const sourceId = parseInt(req.params.id);
      const { name, description, replaceMode, upsertKeyColumns, rateLimitPerHour, isActive } = req.body;

      // Verify ownership
      const existingResult = await db.execute<any>(sql`
        SELECT id FROM dataset_sync_sources WHERE id = ${sourceId} AND consultant_id = ${consultantId}
      `);
      if (!existingResult.rows || existingResult.rows.length === 0) {
        return res.status(404).json({ success: false, error: "Sorgente non trovata" });
      }

      // Parse upsertKeyColumns from comma-separated string to array
      let keyColumnsArray: string[] | null = null;
      if (replaceMode === 'upsert' && upsertKeyColumns) {
        keyColumnsArray = upsertKeyColumns
          .split(',')
          .map((c: string) => c.trim())
          .filter((c: string) => c.length > 0);
      }

      // Build update query dynamically
      const updates: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      if (name !== undefined) {
        updates.push(`name = $${paramIndex++}`);
        values.push(name);
      }
      if (description !== undefined) {
        updates.push(`description = $${paramIndex++}`);
        values.push(description);
      }
      if (replaceMode !== undefined) {
        updates.push(`replace_mode = $${paramIndex++}`);
        values.push(replaceMode);
      }
      if (replaceMode === 'upsert') {
        updates.push(`upsert_key_columns = $${paramIndex++}`);
        values.push(keyColumnsArray);
      } else if (replaceMode !== undefined) {
        // Clear upsert columns if mode changed away from upsert
        updates.push(`upsert_key_columns = NULL`);
      }
      if (rateLimitPerHour !== undefined) {
        updates.push(`rate_limit_per_hour = $${paramIndex++}`);
        values.push(rateLimitPerHour);
      }
      if (isActive !== undefined) {
        updates.push(`is_active = $${paramIndex++}`);
        values.push(isActive);
      }

      updates.push(`updated_at = NOW()`);

      if (updates.length === 1) {
        return res.status(400).json({ success: false, error: "Nessun campo da aggiornare" });
      }

      values.push(sourceId);
      values.push(consultantId);

      const updateQuery = `
        UPDATE dataset_sync_sources 
        SET ${updates.join(', ')}
        WHERE id = $${paramIndex++} AND consultant_id = $${paramIndex}
        RETURNING id, name, description, replace_mode, upsert_key_columns, rate_limit_per_hour, is_active
      `;

      const result = await db.execute<any>(sql.raw(updateQuery, ...values));
      const updated = result.rows?.[0];

      res.json({ success: true, data: updated });
    } catch (error: any) {
      console.error("[DATASET-SYNC] Error updating source:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

// Get available columns for a sync source (from the last sync)
router.get(
  "/sources/:id/columns",
  authenticateToken,
  requireAnyRole(["consultant", "super_admin"]),
  async (req: AuthRequest, res: Response) => {
    try {
      const consultantId = req.user!.id;
      const sourceId = parseInt(req.params.id);

      // Get the source and its target dataset
      const sourceResult = await db.execute<any>(sql`
        SELECT s.id, s.target_dataset_id, d.table_name
        FROM dataset_sync_sources s
        LEFT JOIN client_data_datasets d ON d.id = s.target_dataset_id
        WHERE s.id = ${sourceId} AND s.consultant_id = ${consultantId}
      `);

      if (!sourceResult.rows?.length) {
        return res.status(404).json({ success: false, error: "Sorgente non trovata" });
      }

      const tableName = sourceResult.rows[0].table_name;
      if (!tableName) {
        return res.json({ success: true, columns: [], message: "Nessun sync effettuato" });
      }

      // Get columns from the dynamic table (exclude system columns)
      const columnsResult = await db.execute<any>(sql`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = ${tableName}
          AND column_name NOT IN ('id', 'consultant_id', 'client_id', 'created_at', 'updated_at', 'sync_source_id', 'sync_batch_id')
        ORDER BY ordinal_position
      `);

      const columns = columnsResult.rows?.map((r: any) => r.column_name) || [];
      res.json({ success: true, columns });
    } catch (error: any) {
      console.error("[DATASET-SYNC] Error getting columns:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

router.get(
  "/history/:sourceId",
  authenticateToken,
  requireAnyRole(["consultant", "super_admin"]),
  async (req: AuthRequest, res: Response) => {
    try {
      const consultantId = req.user!.id;
      const sourceId = parseInt(req.params.sourceId);
      const limit = parseInt(req.query.limit as string) || 50;

      const sourceResult = await db.execute<any>(sql`
        SELECT id FROM dataset_sync_sources WHERE id = ${sourceId} AND consultant_id = ${consultantId}
      `);
      const source = sourceResult.rows || [];

      if (!source || source.length === 0) {
        return res.status(404).json({ success: false, error: "Sorgente non trovata" });
      }

      const historyResult = await db.execute<any>(sql`
        SELECT * FROM dataset_sync_history 
        WHERE source_id = ${sourceId}
        ORDER BY started_at DESC
        LIMIT ${limit}
      `);
      const history = historyResult.rows || [];

      res.json({ success: true, data: history });
    } catch (error: any) {
      console.error("[DATASET-SYNC] Error fetching history:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

router.post(
  "/sources/:id/schedule",
  authenticateToken,
  requireAnyRole(["consultant", "super_admin"]),
  async (req: AuthRequest, res: Response) => {
    try {
      const consultantId = req.user!.id;
      const sourceId = parseInt(req.params.id);
      const { scheduleType, scheduleConfig, timezone = 'Europe/Rome', retryOnFailure = true, maxRetries = 3 } = req.body;

      const sourceResult = await db.execute<any>(sql`
        SELECT id FROM dataset_sync_sources WHERE id = ${sourceId} AND consultant_id = ${consultantId}
      `);
      const source = sourceResult.rows || [];

      if (!source || source.length === 0) {
        return res.status(404).json({ success: false, error: "Sorgente non trovata" });
      }

      const validScheduleTypes = ['webhook_only', 'daily', 'weekly', 'monthly', 'every_x_days'];
      if (!validScheduleTypes.includes(scheduleType)) {
        return res.status(400).json({ 
          success: false, 
          error: `Tipo schedulazione non valido. Opzioni: ${validScheduleTypes.join(', ')}` 
        });
      }

      const existingResult = await db.execute<any>(sql`
        SELECT id FROM dataset_sync_schedules WHERE source_id = ${sourceId}
      `);
      const existing = existingResult.rows || [];

      if (existing && existing.length > 0) {
        await db.execute(sql`
          UPDATE dataset_sync_schedules 
          SET schedule_type = ${scheduleType}, schedule_config = ${JSON.stringify(scheduleConfig || {})}::jsonb,
              timezone = ${timezone}, retry_on_failure = ${retryOnFailure}, max_retries = ${maxRetries},
              updated_at = now()
          WHERE source_id = ${sourceId}
        `);
      } else {
        await db.execute(sql`
          INSERT INTO dataset_sync_schedules (source_id, schedule_type, schedule_config, timezone, retry_on_failure, max_retries)
          VALUES (${sourceId}, ${scheduleType}, ${JSON.stringify(scheduleConfig || {})}::jsonb, ${timezone}, ${retryOnFailure}, ${maxRetries})
        `);
      }

      res.json({ success: true, message: "Schedulazione aggiornata" });
    } catch (error: any) {
      console.error("[DATASET-SYNC] Error updating schedule:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

router.patch(
  "/sources/:id/toggle",
  authenticateToken,
  requireAnyRole(["consultant", "super_admin"]),
  async (req: AuthRequest, res: Response) => {
    try {
      const consultantId = req.user!.id;
      const sourceId = parseInt(req.params.id);
      const { isActive } = req.body;

      await db.execute(sql`
        UPDATE dataset_sync_sources 
        SET is_active = ${isActive}, updated_at = now()
        WHERE id = ${sourceId} AND consultant_id = ${consultantId}
      `);

      res.json({ success: true, message: isActive ? "Sorgente attivata" : "Sorgente disattivata" });
    } catch (error: any) {
      console.error("[DATASET-SYNC] Error toggling source:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

router.get(
  "/stats",
  authenticateToken,
  requireAnyRole(["consultant", "super_admin"]),
  async (req: AuthRequest, res: Response) => {
    try {
      const consultantId = req.user!.id;

      const activeSourcesRes = await db.execute<any>(sql`
        SELECT COUNT(*) as count FROM dataset_sync_sources 
        WHERE consultant_id = ${consultantId} AND is_active = true
      `);
      const activeSourcesResult = activeSourcesRes.rows || [];

      const syncsLast24hRes = await db.execute<any>(sql`
        SELECT COUNT(*) as count FROM dataset_sync_history h
        JOIN dataset_sync_sources s ON h.source_id = s.id
        WHERE s.consultant_id = ${consultantId} 
        AND h.started_at >= NOW() - INTERVAL '24 hours'
      `);
      const syncsLast24hResult = syncsLast24hRes.rows || [];

      const errorsLast24hRes = await db.execute<any>(sql`
        SELECT COUNT(*) as count FROM dataset_sync_history h
        JOIN dataset_sync_sources s ON h.source_id = s.id
        WHERE s.consultant_id = ${consultantId} 
        AND h.started_at >= NOW() - INTERVAL '24 hours'
        AND h.status = 'failed'
      `);
      const errorsLast24hResult = errorsLast24hRes.rows || [];

      const successfulLast24hRes = await db.execute<any>(sql`
        SELECT COUNT(*) as count FROM dataset_sync_history h
        JOIN dataset_sync_sources s ON h.source_id = s.id
        WHERE s.consultant_id = ${consultantId} 
        AND h.started_at >= NOW() - INTERVAL '24 hours'
        AND h.status = 'completed'
      `);
      const successfulLast24hResult = successfulLast24hRes.rows || [];

      const syncsLast24h = parseInt(syncsLast24hResult[0]?.count || '0');
      const successfulLast24h = parseInt(successfulLast24hResult[0]?.count || '0');
      const successRate = syncsLast24h > 0 ? Math.round((successfulLast24h / syncsLast24h) * 100) : 100;

      res.json({
        success: true,
        data: {
          successRate,
          activeSources: parseInt(activeSourcesResult[0]?.count || '0'),
          syncsLast24h,
          errorsLast24h: parseInt(errorsLast24hResult[0]?.count || '0'),
        },
      });
    } catch (error: any) {
      console.error("[DATASET-SYNC] Error fetching stats:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

router.post(
  "/sources/:id/regenerate-key",
  authenticateToken,
  requireAnyRole(["consultant", "super_admin"]),
  async (req: AuthRequest, res: Response) => {
    try {
      const consultantId = req.user!.id;
      const sourceId = parseInt(req.params.id);

      const sourceResult = await db.execute<any>(sql`
        SELECT id FROM dataset_sync_sources WHERE id = ${sourceId} AND consultant_id = ${consultantId}
      `);
      const source = sourceResult.rows || [];

      if (!source || source.length === 0) {
        return res.status(404).json({ success: false, error: "Sorgente non trovata" });
      }

      const newApiKey = generateApiKey(consultantId);
      const newSecretKey = generateSecretKey();

      await db.execute(sql`
        UPDATE dataset_sync_sources 
        SET api_key = ${newApiKey}, secret_key = ${newSecretKey}, updated_at = now()
        WHERE id = ${sourceId} AND consultant_id = ${consultantId}
      `);

      res.json({
        success: true,
        data: {
          apiKey: newApiKey,
          secretKey: newSecretKey,
        },
        message: "Chiavi rigenerate. Conserva la secret_key in modo sicuro - non sarà più visibile.",
      });
    } catch (error: any) {
      console.error("[DATASET-SYNC] Error regenerating keys:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

router.get(
  "/history",
  authenticateToken,
  requireAnyRole(["consultant", "super_admin"]),
  async (req: AuthRequest, res: Response) => {
    try {
      const consultantId = req.user!.id;
      const { sourceId, status, dateFrom, dateTo, page = '1', limit = '50' } = req.query;

      const pageNum = Math.max(1, parseInt(page as string) || 1);
      const limitNum = Math.min(100, Math.max(1, parseInt(limit as string) || 50));
      const offset = (pageNum - 1) * limitNum;

      let conditions = [sql`s.consultant_id = ${consultantId}`];
      
      if (sourceId) {
        conditions.push(sql`h.source_id = ${parseInt(sourceId as string)}`);
      }
      if (status) {
        conditions.push(sql`h.status = ${status as string}`);
      }
      if (dateFrom) {
        conditions.push(sql`h.started_at >= ${dateFrom as string}::timestamp`);
      }
      if (dateTo) {
        conditions.push(sql`h.started_at <= ${dateTo as string}::timestamp`);
      }

      const whereClause = sql.join(conditions, sql` AND `);

      const countRes = await db.execute<any>(sql`
        SELECT COUNT(*) as total FROM dataset_sync_history h
        JOIN dataset_sync_sources s ON h.source_id = s.id
        WHERE ${whereClause}
      `);
      const countResult = countRes.rows || [];

      const historyRes = await db.execute<any>(sql`
        SELECT h.*, s.name as source_name FROM dataset_sync_history h
        JOIN dataset_sync_sources s ON h.source_id = s.id
        WHERE ${whereClause}
        ORDER BY h.started_at DESC
        LIMIT ${limitNum} OFFSET ${offset}
      `);
      const history = historyRes.rows || [];

      const total = parseInt(countResult[0]?.total || '0');

      res.json({
        success: true,
        data: history,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum),
        },
      });
    } catch (error: any) {
      console.error("[DATASET-SYNC] Error fetching history:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

router.get(
  "/sources/:id/schedule",
  authenticateToken,
  requireAnyRole(["consultant", "super_admin"]),
  async (req: AuthRequest, res: Response) => {
    try {
      const consultantId = req.user!.id;
      const sourceId = parseInt(req.params.id);

      const sourceResult = await db.execute<any>(sql`
        SELECT id FROM dataset_sync_sources WHERE id = ${sourceId} AND consultant_id = ${consultantId}
      `);
      const source = sourceResult.rows || [];

      if (!source || source.length === 0) {
        return res.status(404).json({ success: false, error: "Sorgente non trovata" });
      }

      const scheduleResult = await db.execute<any>(sql`
        SELECT * FROM dataset_sync_schedules WHERE source_id = ${sourceId}
      `);
      const schedule = scheduleResult.rows || [];

      res.json({
        success: true,
        data: schedule && schedule.length > 0 ? schedule[0] : null,
      });
    } catch (error: any) {
      console.error("[DATASET-SYNC] Error fetching schedule:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

router.delete(
  "/schedules/:id",
  authenticateToken,
  requireAnyRole(["consultant", "super_admin"]),
  async (req: AuthRequest, res: Response) => {
    try {
      const consultantId = req.user!.id;
      const scheduleId = parseInt(req.params.id);

      const scheduleResult = await db.execute<any>(sql`
        SELECT sch.id, s.consultant_id FROM dataset_sync_schedules sch
        JOIN dataset_sync_sources s ON sch.source_id = s.id
        WHERE sch.id = ${scheduleId}
      `);
      const schedule = scheduleResult.rows || [];

      if (!schedule || schedule.length === 0) {
        return res.status(404).json({ success: false, error: "Schedulazione non trovata" });
      }

      if (schedule[0].consultant_id !== consultantId) {
        return res.status(403).json({ success: false, error: "Non autorizzato" });
      }

      await db.execute(sql`
        DELETE FROM dataset_sync_schedules WHERE id = ${scheduleId}
      `);

      res.json({ success: true, message: "Schedulazione eliminata" });
    } catch (error: any) {
      console.error("[DATASET-SYNC] Error deleting schedule:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

router.post(
  "/test-webhook",
  authenticateToken,
  requireAnyRole(["consultant", "super_admin"]),
  upload.single("file"),
  async (req: AuthRequest, res: Response) => {
    try {
      await ensureUploadDir();

      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: "MISSING_FILE",
          message: "Nessun file caricato",
        });
      }

      const { originalname, path: tempPath, size } = req.file;
      const ext = path.extname(originalname).toLowerCase();

      if (![".xlsx", ".xls", ".csv"].includes(ext)) {
        await fs.promises.unlink(tempPath);
        return res.status(400).json({
          success: false,
          error: "INVALID_FILE_TYPE",
          message: "Tipo file non supportato. Accettati: .xlsx, .xls, .csv",
        });
      }

      console.log(`[DATASET-SYNC] Test webhook - Processing file: ${originalname} (${size} bytes)`);

      const processedFile = await processExcelFile(tempPath, originalname);

      await fs.promises.unlink(tempPath);

      if (processedFile.sheets.length === 0 || processedFile.sheets[0].rowCount === 0) {
        return res.status(400).json({
          success: false,
          error: "EMPTY_FILE",
          message: "File vuoto o senza righe valide",
        });
      }

      const sheet = processedFile.sheets[0];
      const headers = sheet.columns.map(c => c.name);
      
      // Trasforma i dati nel formato DistributedSample (stesso formato del webhook reale)
      const sample = {
        columns: headers,
        rows: sheet.sampleRows,
        totalRowCount: sheet.rowCount,
        sampledFromStart: sheet.sampleRows.length,
        sampledFromMiddle: 0,
        sampledFromEnd: 0
      };

      // Ottieni consultantId per riutilizzare mapping salvati
      const consultantId = req.user!.id;
      const discoveryResult = await discoverColumns(sample, originalname, consultantId);

      // Una colonna è considerata "mappata" se ha un patternMatched o confidence >= 0.8
      const mappedColumns = discoveryResult.columns.filter(c => c.patternMatched || c.confidence >= 0.8);
      const unmappedColumns = discoveryResult.columns.filter(c => !c.patternMatched && c.confidence < 0.8);

      // Controlla se vogliamo simulare il flusso completo del webhook
      const { sourceId } = req.body;
      const simulateFullWebhook = req.body.simulateFullWebhook === "true" || req.body.simulateFullWebhook === true;

      if (simulateFullWebhook && sourceId) {
        // ========== MODALITÀ SIMULAZIONE COMPLETA ==========
        // Esegue esattamente lo stesso flusso del webhook reale
        
        const sourceResult = await db.execute<any>(sql`
          SELECT * FROM dataset_sync_sources WHERE id = ${sourceId} AND consultant_id = ${consultantId}
        `);
        const sourceData = (sourceResult.rows || [])[0];

        if (!sourceData) {
          return res.status(404).json({
            success: false,
            error: "SOURCE_NOT_FOUND",
            message: "Sorgente non trovata o non autorizzata",
          });
        }

        if (!sourceData.is_active) {
          return res.status(400).json({
            success: false,
            error: "SOURCE_INACTIVE",
            message: "Sorgente non attiva",
          });
        }

        // Determina tableName e targetDatasetId
        let targetDatasetId = sourceData.target_dataset_id;
        let tableName: string;

        let needsTableCreation = false;
        
        if (targetDatasetId) {
          const existingDatasetResult = await db.execute<any>(
            sql`SELECT table_name FROM client_data_datasets WHERE id = ${targetDatasetId}`
          );
          const existingDataset = existingDatasetResult.rows || [];
          if (existingDataset && existingDataset.length > 0) {
            tableName = existingDataset[0].table_name;
            
            if (sourceData.replace_mode === 'full') {
              await db.execute(sql.raw(`TRUNCATE TABLE ${tableName}`));
            }
          } else {
            // Dataset ID esiste ma non trovato nel DB - crea nuova tabella
            const datasetName = sourceData.name || originalname || 'dataset';
            tableName = generateTableName(sourceData.consultant_id, datasetName);
            needsTableCreation = true;
            targetDatasetId = null; // Reset per creare nuovo dataset
          }
        } else {
          const datasetName = sourceData.name || originalname || 'dataset';
          tableName = generateTableName(sourceData.consultant_id, datasetName);
          needsTableCreation = true;
        }

        // Crea definizioni colonne - usa la struttura corretta per createDynamicTable
        const columnDefinitions = discoveryResult.columns.map(col => ({
          originalName: col.originalName || col.physicalColumn || 'column',
          suggestedName: col.physicalColumn || col.originalName || 'column',
          displayName: col.displayName || col.originalName || 'Column',
          dataType: (col.detectedType || col.dataType || 'TEXT') as "TEXT" | "NUMERIC" | "INTEGER" | "DATE" | "BOOLEAN",
          confidence: col.confidence || 0.5,
          sampleValues: col.sampleValues || [],
        }));

        // Client ID per il dataset
        const datasetClientId = sourceData.client_id || sourceData.consultant_id;

        // Crea tabella se necessario
        if (needsTableCreation) {
          await createDynamicTable(tableName, columnDefinitions, sourceData.consultant_id, datasetClientId);
        }

        // Prepara opzioni upsert se modalità upsert
        let upsertOptions: { mode: 'insert' | 'upsert'; keyColumns: string[] } | undefined = undefined;
        if (sourceData.replace_mode === 'upsert' && sourceData.upsert_key_columns?.length > 0) {
          upsertOptions = {
            mode: 'upsert' as const,
            keyColumns: sourceData.upsert_key_columns
          };
        }

        // Importa dati già parsati direttamente nella tabella
        const { rowsImported, rowsSkipped, rowsInserted, rowsUpdated } = await insertParsedRowsToTable(
          tableName,
          headers,
          sheet.sampleRows,
          sourceData.consultant_id,
          datasetClientId,
          upsertOptions
        );

        // Crea dataset se non esisteva
        if (!targetDatasetId) {
          // Build column_mapping object (same structure as client-data-router)
          const columnMapping: Record<string, { displayName: string; dataType: string; description?: string }> = {};
          for (const col of columnDefinitions) {
            const dbColumnName = sanitizeColumnName(col.suggestedName || col.originalName);
            columnMapping[dbColumnName] = {
              displayName: col.displayName || col.originalName,
              dataType: col.dataType || 'TEXT',
            };
          }

          const insertedDatasetResult = await db.execute<any>(sql`
            INSERT INTO client_data_datasets (consultant_id, client_id, name, original_filename, table_name, status, row_count, column_count, column_mapping, auto_confirmed, confidence_score, created_at)
            VALUES (${sourceData.consultant_id}, ${datasetClientId}, ${`Test Sync: ${sourceData.name}`}, ${originalname}, ${tableName}, 'ready', ${rowsImported}, ${headers.length}, ${JSON.stringify(columnMapping)}::jsonb, ${discoveryResult.autoConfirmed}, ${discoveryResult.overallConfidence}, now())
            RETURNING id
          `);
          const insertedDataset = insertedDatasetResult.rows || [];
          targetDatasetId = insertedDataset[0].id;

          await db.execute(sql`
            UPDATE dataset_sync_sources SET target_dataset_id = ${targetDatasetId} WHERE id = ${sourceId}
          `);

          // Salva mapping per ogni colonna ad alta confidenza
          for (const col of discoveryResult.columns) {
            if (col.confidence >= 0.8) {
              await saveColumnMapping(
                sourceData.consultant_id,
                col.originalName,
                col.suggestedName || col.physicalColumn || col.originalName,
                col.dataType || col.detectedType || 'TEXT'
              );
            }
          }
          
          // Semantic mappings con array di nomi colonna
          const physicalColumns = discoveryResult.columns.map(c => c.suggestedName || c.physicalColumn || c.originalName);
          await detectAndSaveSemanticMappings(targetDatasetId, physicalColumns);
        }

        // Log nella history come test
        const syncId = `test_${Date.now()}_${Math.random().toString(36).substring(7)}`;
        await db.execute(sql`
          INSERT INTO dataset_sync_history (sync_id, source_id, status, started_at, completed_at, rows_imported, rows_skipped, rows_inserted, rows_updated, rows_total, columns_detected, columns_mapped, columns_unmapped, file_name, file_size_bytes)
          VALUES (${syncId}, ${sourceId}, 'completed', now(), now(), ${rowsImported}, ${rowsSkipped}, ${rowsInserted}, ${rowsUpdated}, ${sheet.rowCount}, ${headers.length}, 
                  ${JSON.stringify(mappedColumns.map(c => c.suggestedName))}::jsonb,
                  ${JSON.stringify(unmappedColumns.map(c => c.physicalColumn || c.originalName))}::jsonb,
                  ${originalname}, ${size})
        `);

        console.log(`[DATASET-SYNC] Test FULL simulation completed: ${rowsImported} rows imported to dataset ${targetDatasetId}`);

        return res.json({
          success: true,
          mode: "full_simulation",
          syncId,
          datasetId: targetDatasetId,
          rowsImported,
          rowsSkipped,
          rowsTotal: sheet.rowCount,
          columnsDetected: headers.length,
          mappingSummary: {
            mapped: mappedColumns.map(c => c.suggestedName),
            unmapped: unmappedColumns.map(c => c.physicalColumn || c.originalName),
          },
          message: "Test COMPLETO eseguito. Dati importati come se fosse una chiamata webhook reale.",
        });
      }

      // ========== MODALITÀ TEST RAPIDO (default) ==========
      // Solo verifica formato e mapping, senza importare
      res.json({
        success: true,
        mode: "quick_test",
        data: {
          fileName: originalname,
          fileSize: size,
          sheetName: sheet.name,
          totalRows: sheet.rowCount,
          columnsDetected: headers.length,
          columns: discoveryResult.columns.map(col => ({
            physicalColumn: col.physicalColumn || col.originalName,
            detectedType: col.detectedType || col.dataType,
            suggestedLogicalColumn: col.suggestedName,
            confidence: col.confidence,
            sampleValues: col.sampleValues?.slice(0, 5),
          })),
          mappingSummary: {
            mapped: mappedColumns.map(c => ({
              physical: c.physicalColumn || c.originalName,
              logical: c.suggestedName,
              confidence: c.confidence,
            })),
            unmapped: unmappedColumns.map(c => c.physicalColumn || c.originalName),
          },
          previewRows: sheet.sampleRows.slice(0, 10),
        },
        message: "Test rapido completato. Il file NON è stato importato.",
      });
    } catch (error: any) {
      console.error("[DATASET-SYNC] Test webhook error:", error);
      res.status(500).json({
        success: false,
        error: "INTERNAL_ERROR",
        message: error.message,
      });
    }
  }
);

// === SOURCE ANALYTICS API ===
// Detailed analytics per source: health status, frequency, trends, push/pull mode

router.get(
  "/sources/:id/analytics",
  authenticateToken,
  requireAnyRole(["consultant", "super_admin"]),
  async (req: AuthRequest, res: Response) => {
    try {
      const consultantId = req.user!.id;
      const sourceId = parseInt(req.params.id);

      // Verify source ownership
      const sourceResult = await db.execute<any>(sql`
        SELECT s.*, u.first_name as client_first_name, u.last_name as client_last_name
        FROM dataset_sync_sources s
        LEFT JOIN users u ON s.client_id = u.id
        WHERE s.id = ${sourceId} AND s.consultant_id = ${consultantId}
      `);
      const source = (sourceResult.rows || [])[0];

      if (!source) {
        return res.status(404).json({ success: false, error: "Sorgente non trovata" });
      }

      // Get schedule to determine push/pull mode
      const scheduleResult = await db.execute<any>(sql`
        SELECT * FROM dataset_sync_schedules WHERE source_id = ${sourceId}
      `);
      const schedule = (scheduleResult.rows || [])[0];
      const syncMode = schedule?.schedule_type === 'webhook_only' ? 'push' : (schedule ? 'pull' : 'push');

      // Last sync info (freshness)
      const lastSyncResult = await db.execute<any>(sql`
        SELECT * FROM dataset_sync_history 
        WHERE source_id = ${sourceId} 
        ORDER BY started_at DESC 
        LIMIT 1
      `);
      const lastSync = (lastSyncResult.rows || [])[0];

      // Stats last 7 days
      const stats7dResult = await db.execute<any>(sql`
        SELECT 
          COUNT(*) as total_syncs,
          COUNT(*) FILTER (WHERE status = 'completed') as successful_syncs,
          COUNT(*) FILTER (WHERE status = 'failed') as failed_syncs,
          COALESCE(SUM(rows_imported), 0) as total_rows,
          COALESCE(AVG(duration_ms), 0) as avg_duration_ms,
          COALESCE(MIN(started_at), NULL) as first_sync,
          COALESCE(MAX(started_at), NULL) as last_sync
        FROM dataset_sync_history 
        WHERE source_id = ${sourceId} 
        AND started_at >= NOW() - INTERVAL '7 days'
      `);
      const stats7d = (stats7dResult.rows || [])[0];

      // Stats last 30 days
      const stats30dResult = await db.execute<any>(sql`
        SELECT 
          COUNT(*) as total_syncs,
          COUNT(*) FILTER (WHERE status = 'completed') as successful_syncs,
          COUNT(*) FILTER (WHERE status = 'failed') as failed_syncs,
          COALESCE(SUM(rows_imported), 0) as total_rows
        FROM dataset_sync_history 
        WHERE source_id = ${sourceId} 
        AND started_at >= NOW() - INTERVAL '30 days'
      `);
      const stats30d = (stats30dResult.rows || [])[0];

      // Daily trend last 14 days
      const dailyTrendResult = await db.execute<any>(sql`
        SELECT 
          DATE(started_at) as date,
          COUNT(*) as sync_count,
          COUNT(*) FILTER (WHERE status = 'completed') as success_count,
          COUNT(*) FILTER (WHERE status = 'failed') as fail_count,
          COALESCE(SUM(rows_imported), 0) as rows_imported,
          COALESCE(AVG(duration_ms), 0) as avg_duration_ms
        FROM dataset_sync_history 
        WHERE source_id = ${sourceId} 
        AND started_at >= NOW() - INTERVAL '14 days'
        GROUP BY DATE(started_at)
        ORDER BY date ASC
      `);
      const dailyTrend = dailyTrendResult.rows || [];

      // Calculate average sync frequency (hours between syncs)
      const syncFrequencyResult = await db.execute<any>(sql`
        WITH sync_gaps AS (
          SELECT 
            started_at,
            LAG(started_at) OVER (ORDER BY started_at) as prev_sync
          FROM dataset_sync_history 
          WHERE source_id = ${sourceId}
          AND started_at >= NOW() - INTERVAL '30 days'
        )
        SELECT 
          AVG(EXTRACT(EPOCH FROM (started_at - prev_sync)) / 3600) as avg_hours_between_syncs
        FROM sync_gaps 
        WHERE prev_sync IS NOT NULL
      `);
      const avgHoursBetweenSyncs = parseFloat((syncFrequencyResult.rows || [])[0]?.avg_hours_between_syncs) || null;

      // Calculate health status
      const totalSyncs7d = parseInt(stats7d.total_syncs || '0');
      const successfulSyncs7d = parseInt(stats7d.successful_syncs || '0');
      const failedSyncs7d = parseInt(stats7d.failed_syncs || '0');
      const successRate7d = totalSyncs7d > 0 ? (successfulSyncs7d / totalSyncs7d) * 100 : 100;

      // Freshness: hours since last successful sync
      let freshness = null;
      let freshnessStatus: 'fresh' | 'stale' | 'critical' | 'unknown' = 'unknown';
      if (lastSync && lastSync.status === 'completed') {
        freshness = (Date.now() - new Date(lastSync.completed_at || lastSync.started_at).getTime()) / (1000 * 60 * 60);
        if (freshness < 24) freshnessStatus = 'fresh';
        else if (freshness < 72) freshnessStatus = 'stale';
        else freshnessStatus = 'critical';
      } else if (lastSync && lastSync.status === 'failed') {
        freshnessStatus = 'critical';
      }

      // Overall health: green, yellow, red
      let healthStatus: 'healthy' | 'warning' | 'critical' = 'healthy';
      if (successRate7d < 50 || freshnessStatus === 'critical') {
        healthStatus = 'critical';
      } else if (successRate7d < 90 || freshnessStatus === 'stale') {
        healthStatus = 'warning';
      }

      // Recent errors
      const recentErrorsResult = await db.execute<any>(sql`
        SELECT error_code, error_message, started_at
        FROM dataset_sync_history 
        WHERE source_id = ${sourceId} AND status = 'failed'
        ORDER BY started_at DESC
        LIMIT 5
      `);
      const recentErrors = recentErrorsResult.rows || [];

      res.json({
        success: true,
        data: {
          source: {
            id: source.id,
            name: source.name,
            isActive: source.is_active,
            clientName: source.client_first_name ? `${source.client_first_name} ${source.client_last_name}` : null,
            syncMode, // 'push' or 'pull'
            createdAt: source.created_at,
          },
          health: {
            status: healthStatus,
            successRate7d: Math.round(successRate7d * 100) / 100,
            freshnessHours: freshness ? Math.round(freshness * 10) / 10 : null,
            freshnessStatus,
          },
          frequency: {
            avgHoursBetweenSyncs: avgHoursBetweenSyncs ? Math.round(avgHoursBetweenSyncs * 10) / 10 : null,
            syncsLast7d: totalSyncs7d,
            syncsLast30d: parseInt(stats30d.total_syncs || '0'),
          },
          metrics: {
            last7d: {
              totalSyncs: totalSyncs7d,
              successfulSyncs: successfulSyncs7d,
              failedSyncs: failedSyncs7d,
              totalRows: parseInt(stats7d.total_rows || '0'),
              avgDurationMs: Math.round(parseFloat(stats7d.avg_duration_ms || '0')),
            },
            last30d: {
              totalSyncs: parseInt(stats30d.total_syncs || '0'),
              successfulSyncs: parseInt(stats30d.successful_syncs || '0'),
              failedSyncs: parseInt(stats30d.failed_syncs || '0'),
              totalRows: parseInt(stats30d.total_rows || '0'),
            },
          },
          lastSync: lastSync ? {
            syncId: lastSync.sync_id,
            status: lastSync.status,
            startedAt: lastSync.started_at,
            completedAt: lastSync.completed_at,
            rowsImported: lastSync.rows_imported,
            durationMs: lastSync.duration_ms,
          } : null,
          dailyTrend: dailyTrend.map((d: any) => ({
            date: d.date,
            syncCount: parseInt(d.sync_count || '0'),
            successCount: parseInt(d.success_count || '0'),
            failCount: parseInt(d.fail_count || '0'),
            rowsImported: parseInt(d.rows_imported || '0'),
            avgDurationMs: Math.round(parseFloat(d.avg_duration_ms || '0')),
          })),
          recentErrors,
        },
      });
    } catch (error: any) {
      console.error("[DATASET-SYNC] Error fetching source analytics:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

// === ALL SOURCES ANALYTICS ===
// Overview of all sources with health status for dashboard

router.get(
  "/analytics/overview",
  authenticateToken,
  requireAnyRole(["consultant", "super_admin"]),
  async (req: AuthRequest, res: Response) => {
    try {
      const consultantId = req.user!.id;

      // Get all sources with their latest sync info
      const sourcesResult = await db.execute<any>(sql`
        SELECT 
          s.id,
          s.name,
          s.is_active,
          s.client_id,
          c.first_name as client_first_name,
          c.last_name as client_last_name,
          s.created_at,
          sch.schedule_type,
          (
            SELECT started_at FROM dataset_sync_history 
            WHERE source_id = s.id 
            ORDER BY started_at DESC LIMIT 1
          ) as last_sync_at,
          (
            SELECT status FROM dataset_sync_history 
            WHERE source_id = s.id 
            ORDER BY started_at DESC LIMIT 1
          ) as last_sync_status,
          (
            SELECT COUNT(*) FROM dataset_sync_history 
            WHERE source_id = s.id 
            AND started_at >= NOW() - INTERVAL '7 days'
          ) as syncs_7d,
          (
            SELECT COUNT(*) FILTER (WHERE status = 'completed') FROM dataset_sync_history 
            WHERE source_id = s.id 
            AND started_at >= NOW() - INTERVAL '7 days'
          ) as success_7d,
          (
            SELECT COUNT(*) FILTER (WHERE status = 'failed') FROM dataset_sync_history 
            WHERE source_id = s.id 
            AND started_at >= NOW() - INTERVAL '7 days'
          ) as failed_7d,
          (
            SELECT COALESCE(SUM(rows_imported), 0) FROM dataset_sync_history 
            WHERE source_id = s.id 
            AND started_at >= NOW() - INTERVAL '7 days'
          ) as rows_7d
        FROM dataset_sync_sources s
        LEFT JOIN users c ON s.client_id = c.id
        LEFT JOIN dataset_sync_schedules sch ON sch.source_id = s.id
        WHERE s.consultant_id = ${consultantId}
        ORDER BY s.name ASC
      `);
      const sources = sourcesResult.rows || [];

      // Process each source to add health status
      const sourcesWithHealth = sources.map((s: any) => {
        const syncs7d = parseInt(s.syncs_7d || '0');
        const success7d = parseInt(s.success_7d || '0');
        const failed7d = parseInt(s.failed_7d || '0');
        const successRate = syncs7d > 0 ? (success7d / syncs7d) * 100 : 100;

        // Calculate freshness
        let freshnessHours = null;
        let freshnessStatus: 'fresh' | 'stale' | 'critical' | 'unknown' = 'unknown';
        if (s.last_sync_at) {
          freshnessHours = (Date.now() - new Date(s.last_sync_at).getTime()) / (1000 * 60 * 60);
          if (s.last_sync_status === 'failed') {
            freshnessStatus = 'critical';
          } else if (freshnessHours < 24) {
            freshnessStatus = 'fresh';
          } else if (freshnessHours < 72) {
            freshnessStatus = 'stale';
          } else {
            freshnessStatus = 'critical';
          }
        }

        // Health status
        let healthStatus: 'healthy' | 'warning' | 'critical' = 'healthy';
        if (!s.is_active) {
          healthStatus = 'warning';
        } else if (successRate < 50 || freshnessStatus === 'critical') {
          healthStatus = 'critical';
        } else if (successRate < 90 || freshnessStatus === 'stale') {
          healthStatus = 'warning';
        }

        const syncMode = s.schedule_type === 'webhook_only' ? 'push' : (s.schedule_type ? 'pull' : 'push');

        return {
          id: s.id,
          name: s.name,
          isActive: s.is_active,
          clientId: s.client_id,
          clientName: s.client_first_name ? `${s.client_first_name} ${s.client_last_name}` : null,
          syncMode,
          healthStatus,
          successRate: Math.round(successRate),
          freshnessHours: freshnessHours ? Math.round(freshnessHours * 10) / 10 : null,
          freshnessStatus,
          lastSyncAt: s.last_sync_at,
          lastSyncStatus: s.last_sync_status,
          metrics7d: {
            syncs: syncs7d,
            success: success7d,
            failed: failed7d,
            rows: parseInt(s.rows_7d || '0'),
          },
        };
      });

      // Group by client
      const byClient: Record<string, any[]> = {};
      const noClient: any[] = [];
      for (const source of sourcesWithHealth) {
        if (source.clientId) {
          const clientKey = source.clientId;
          if (!byClient[clientKey]) {
            byClient[clientKey] = [];
          }
          byClient[clientKey].push(source);
        } else {
          noClient.push(source);
        }
      }

      // Calculate overall stats
      const totalSources = sourcesWithHealth.length;
      const activeSources = sourcesWithHealth.filter((s: any) => s.isActive).length;
      const healthyCounts = {
        healthy: sourcesWithHealth.filter((s: any) => s.healthStatus === 'healthy').length,
        warning: sourcesWithHealth.filter((s: any) => s.healthStatus === 'warning').length,
        critical: sourcesWithHealth.filter((s: any) => s.healthStatus === 'critical').length,
      };
      const pushCount = sourcesWithHealth.filter((s: any) => s.syncMode === 'push').length;
      const pullCount = sourcesWithHealth.filter((s: any) => s.syncMode === 'pull').length;

      res.json({
        success: true,
        data: {
          summary: {
            totalSources,
            activeSources,
            healthStatus: healthyCounts,
            syncModes: { push: pushCount, pull: pullCount },
          },
          sources: sourcesWithHealth,
          byClient,
          noClient,
        },
      });
    } catch (error: any) {
      console.error("[DATASET-SYNC] Error fetching analytics overview:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

// === CLIENT ANALYTICS ===
// Aggregated sync analytics per client

router.get(
  "/analytics/clients",
  authenticateToken,
  requireAnyRole(["consultant", "super_admin"]),
  async (req: AuthRequest, res: Response) => {
    try {
      const consultantId = req.user!.id;

      const clientsResult = await db.execute<any>(sql`
        SELECT 
          c.id,
          c.first_name,
          c.last_name,
          c.email,
          COUNT(DISTINCT s.id) as source_count,
          COUNT(DISTINCT s.id) FILTER (WHERE s.is_active) as active_source_count,
          (
            SELECT COUNT(*) FROM dataset_sync_history h
            JOIN dataset_sync_sources src ON h.source_id = src.id
            WHERE src.client_id = c.id
            AND h.started_at >= NOW() - INTERVAL '7 days'
          ) as syncs_7d,
          (
            SELECT COUNT(*) FILTER (WHERE status = 'completed') FROM dataset_sync_history h
            JOIN dataset_sync_sources src ON h.source_id = src.id
            WHERE src.client_id = c.id
            AND h.started_at >= NOW() - INTERVAL '7 days'
          ) as success_7d,
          (
            SELECT COALESCE(SUM(rows_imported), 0) FROM dataset_sync_history h
            JOIN dataset_sync_sources src ON h.source_id = src.id
            WHERE src.client_id = c.id
            AND h.started_at >= NOW() - INTERVAL '7 days'
          ) as rows_7d,
          (
            SELECT MAX(h.started_at) FROM dataset_sync_history h
            JOIN dataset_sync_sources src ON h.source_id = src.id
            WHERE src.client_id = c.id
          ) as last_sync_at
        FROM users c
        JOIN dataset_sync_sources s ON s.client_id = c.id
        WHERE s.consultant_id = ${consultantId}
        GROUP BY c.id, c.first_name, c.last_name, c.email
        ORDER BY c.first_name ASC
      `);
      const clients = clientsResult.rows || [];

      const clientsWithStats = clients.map((c: any) => {
        const syncs7d = parseInt(c.syncs_7d || '0');
        const success7d = parseInt(c.success_7d || '0');
        const successRate = syncs7d > 0 ? (success7d / syncs7d) * 100 : 100;

        let freshnessStatus: 'fresh' | 'stale' | 'critical' | 'unknown' = 'unknown';
        let freshnessHours = null;
        if (c.last_sync_at) {
          freshnessHours = (Date.now() - new Date(c.last_sync_at).getTime()) / (1000 * 60 * 60);
          if (freshnessHours < 24) freshnessStatus = 'fresh';
          else if (freshnessHours < 72) freshnessStatus = 'stale';
          else freshnessStatus = 'critical';
        }

        let healthStatus: 'healthy' | 'warning' | 'critical' = 'healthy';
        if (successRate < 50 || freshnessStatus === 'critical') {
          healthStatus = 'critical';
        } else if (successRate < 90 || freshnessStatus === 'stale') {
          healthStatus = 'warning';
        }

        return {
          id: c.id,
          name: `${c.first_name} ${c.last_name}`,
          email: c.email,
          sourceCount: parseInt(c.source_count || '0'),
          activeSourceCount: parseInt(c.active_source_count || '0'),
          syncs7d: syncs7d,
          success7d: success7d,
          successRate: Math.round(successRate),
          rows7d: parseInt(c.rows_7d || '0'),
          lastSyncAt: c.last_sync_at,
          freshnessHours: freshnessHours ? Math.round(freshnessHours * 10) / 10 : null,
          freshnessStatus,
          healthStatus,
        };
      });

      res.json({
        success: true,
        data: clientsWithStats,
      });
    } catch (error: any) {
      console.error("[DATASET-SYNC] Error fetching client analytics:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

export default router;
