import { pool, db } from "../../db";
import { clientDataDatasets } from "../../../shared/schema";
import { eq } from "drizzle-orm";
import ExcelJS from "exceljs";
import * as chardet from "chardet";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import type { ColumnDefinition } from "./column-discovery";

const BATCH_SIZE = 1000;

export function generateTableName(consultantId: string, datasetName: string): string {
  const sanitizedName = datasetName
    .toLowerCase()
    .replace(/[àáâãäå]/g, "a")
    .replace(/[èéêë]/g, "e")
    .replace(/[ìíîï]/g, "i")
    .replace(/[òóôõö]/g, "o")
    .replace(/[ùúûü]/g, "u")
    .replace(/[^a-z0-9]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
    .substring(0, 30);

  const hash = crypto
    .createHash("md5")
    .update(`${consultantId}_${datasetName}_${Date.now()}`)
    .digest("hex")
    .substring(0, 8);

  const shortConsultantId = consultantId.substring(0, 8);

  return `cdd_${shortConsultantId}_${sanitizedName}_${hash}`;
}

export function sanitizeColumnName(name: string): string {
  const sanitized = name
    .toLowerCase()
    .replace(/[àáâãäå]/g, "a")
    .replace(/[èéêë]/g, "e")
    .replace(/[ìíîï]/g, "i")
    .replace(/[òóôõö]/g, "o")
    .replace(/[ùúûü]/g, "u")
    .replace(/[^a-z0-9]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
    .substring(0, 63);

  if (/^\d/.test(sanitized)) {
    return `col_${sanitized}`;
  }

  const reserved = ["id", "row", "index", "table", "select", "insert", "update", "delete", "from", "where"];
  if (reserved.includes(sanitized)) {
    return `${sanitized}_col`;
  }

  return sanitized || "column";
}

function mapDataTypeToPostgres(dataType: string): string {
  switch (dataType.toUpperCase()) {
    case "NUMERIC":
      return "NUMERIC(15,2)";
    case "INTEGER":
      return "INTEGER";
    case "DATE":
      return "DATE";
    case "BOOLEAN":
      return "BOOLEAN";
    case "TEXT":
    default:
      return "TEXT";
  }
}

export async function createDynamicTable(
  tableName: string,
  columns: ColumnDefinition[],
  consultantId: string,
  clientId?: string
): Promise<{ success: boolean; error?: string }> {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const tableExistsResult = await client.query(
      `SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = $1
      )`,
      [tableName]
    );

    if (tableExistsResult.rows[0].exists) {
      await client.query("ROLLBACK");
      return { success: false, error: `Table ${tableName} already exists` };
    }

    const columnDefs: string[] = [
      "id SERIAL PRIMARY KEY",
      "riga_originale INTEGER NOT NULL",
      "consultant_id VARCHAR(255) NOT NULL",
      "client_id VARCHAR(255)",
      "created_at TIMESTAMP DEFAULT NOW()",
    ];

    const indexColumns: string[] = [];

    for (const col of columns) {
      const sanitizedName = sanitizeColumnName(col.suggestedName || col.originalName);
      const pgType = mapDataTypeToPostgres(col.dataType);
      columnDefs.push(`"${sanitizedName}" ${pgType}`);

      const upperType = col.dataType?.toUpperCase();
      if (upperType === "DATE" || upperType === "NUMERIC" || upperType === "INTEGER" || upperType === "NUMBER") {
        indexColumns.push(sanitizedName);
      }
    }

    const createTableSQL = `
      CREATE TABLE "${tableName}" (
        ${columnDefs.join(",\n        ")}
      )
    `;

    console.log(`[TABLE-GENERATOR] Creating table: ${tableName}`);
    await client.query(createTableSQL);

    await client.query(`CREATE INDEX ON "${tableName}" (consultant_id)`);
    if (clientId) {
      await client.query(`CREATE INDEX ON "${tableName}" (client_id)`);
    }
    await client.query(`CREATE INDEX ON "${tableName}" (riga_originale)`);

    for (const colName of indexColumns.slice(0, 5)) {
      try {
        await client.query(`CREATE INDEX ON "${tableName}" ("${colName}")`);
      } catch (idxError) {
        console.warn(`[TABLE-GENERATOR] Could not create index on ${colName}:`, idxError);
      }
    }

    await client.query("COMMIT");

    console.log(`[TABLE-GENERATOR] Table ${tableName} created successfully with ${columns.length} columns`);
    return { success: true };
  } catch (error: any) {
    await client.query("ROLLBACK");
    console.error(`[TABLE-GENERATOR] Error creating table ${tableName}:`, error);
    return { success: false, error: error.message };
  } finally {
    client.release();
  }
}

async function parseExcelFile(
  filePath: string,
  sheetName?: string
): Promise<{ columns: string[]; rows: Record<string, any>[] }> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);

  const worksheet = sheetName
    ? workbook.getWorksheet(sheetName)
    : workbook.worksheets[0];

  if (!worksheet) {
    throw new Error("No worksheet found");
  }

  const columns: string[] = [];
  const headerRow = worksheet.getRow(1);
  headerRow.eachCell((cell, colNumber) => {
    columns[colNumber - 1] = cell.value?.toString() || `Column_${colNumber}`;
  });

  const rows: Record<string, any>[] = [];

  for (let i = 2; i <= worksheet.rowCount; i++) {
    const row = worksheet.getRow(i);
    const rowData: Record<string, any> = {};
    let hasData = false;

    row.eachCell((cell, colNumber) => {
      const colName = columns[colNumber - 1] || `Column_${colNumber}`;
      let value = cell.value;

      if (value && typeof value === "object") {
        if ("result" in value) {
          value = value.result;
        } else if ("text" in value) {
          value = (value as any).text;
        } else if (value instanceof Date) {
          value = value.toISOString().split("T")[0];
        }
      }

      rowData[colName] = value;
      if (value !== null && value !== undefined && value !== "") {
        hasData = true;
      }
    });

    if (hasData) {
      rows.push(rowData);
    }
  }

  return { columns, rows };
}

async function parseCsvFile(filePath: string): Promise<{ columns: string[]; rows: Record<string, any>[] }> {
  const buffer = await fs.promises.readFile(filePath);
  const detected = chardet.detect(buffer);
  const encoding = (detected === "UTF-8" ? "utf-8" : "latin1") as BufferEncoding;
  const content = buffer.toString(encoding);

  const lines = content.split(/\r?\n/).filter(line => line.trim());
  if (lines.length < 2) {
    throw new Error("CSV file is empty or has no data rows");
  }

  const delimiter = detectDelimiter(lines[0]);
  const columns = parseCsvLine(lines[0], delimiter);
  const rows: Record<string, any>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i], delimiter);
    const rowData: Record<string, any> = {};
    let hasData = false;

    columns.forEach((col, idx) => {
      const value = parseValue(values[idx]);
      rowData[col] = value;
      if (value !== null && value !== undefined && value !== "") {
        hasData = true;
      }
    });

    if (hasData) {
      rows.push(rowData);
    }
  }

  return { columns, rows };
}

function detectDelimiter(line: string): string {
  const delimiters = [",", ";", "\t", "|"];
  let maxCount = 0;
  let bestDelimiter = ",";

  for (const delimiter of delimiters) {
    const escaped = delimiter.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const count = (line.match(new RegExp(escaped, "g")) || []).length;
    if (count > maxCount) {
      maxCount = count;
      bestDelimiter = delimiter;
    }
  }

  return bestDelimiter;
}

function parseCsvLine(line: string, delimiter: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current.trim());

  return result.map(v => v.replace(/^"|"$/g, "").trim() || `Column_${result.indexOf(v) + 1}`);
}

function parseValue(value: string | undefined): any {
  if (value === undefined || value === "" || value === null) {
    return null;
  }

  const trimmed = value.trim();

  if (/^-?\d+$/.test(trimmed)) {
    const num = parseInt(trimmed, 10);
    if (Number.isSafeInteger(num)) {
      return num;
    }
  }

  if (/^-?\d+[.,]\d+$/.test(trimmed)) {
    const normalized = trimmed.replace(",", ".");
    const num = parseFloat(normalized);
    if (!isNaN(num)) {
      return num;
    }
  }

  return trimmed;
}

function convertValueForInsert(value: any, dataType: string): any {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const strValue = String(value).trim();

  switch (dataType.toUpperCase()) {
    case "DATE":
      if (/^\d{4}-\d{2}-\d{2}/.test(strValue)) {
        return strValue.split("T")[0];
      }
      if (/^\d{2}\/\d{2}\/\d{4}$/.test(strValue)) {
        const [day, month, year] = strValue.split("/");
        return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
      }
      if (/^\d{2}-\d{2}-\d{4}$/.test(strValue)) {
        const [day, month, year] = strValue.split("-");
        return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
      }
      return null;

    case "NUMERIC":
    case "INTEGER":
      const cleanNum = strValue.replace(/[€$%\s]/g, "").replace(",", ".");
      const num = parseFloat(cleanNum);
      if (!isNaN(num)) {
        return dataType.toUpperCase() === "INTEGER" ? Math.round(num) : num;
      }
      return null;

    case "BOOLEAN":
      const lower = strValue.toLowerCase();
      if (["true", "1", "si", "sì", "yes", "vero"].includes(lower)) {
        return true;
      }
      if (["false", "0", "no", "falso"].includes(lower)) {
        return false;
      }
      return null;

    case "TEXT":
    default:
      return strValue;
  }
}

export async function importDataToTable(
  filePath: string,
  tableName: string,
  columns: ColumnDefinition[],
  consultantId: string,
  clientId?: string,
  sheetName?: string,
  onProgress?: (current: number, total: number) => void
): Promise<{ success: boolean; rowCount: number; error?: string }> {
  const client = await pool.connect();
  const stagingTableName = `staging_${tableName}`;

  try {
    const ext = path.extname(filePath).toLowerCase();
    const parsed = ext === ".csv"
      ? await parseCsvFile(filePath)
      : await parseExcelFile(filePath, sheetName);

    const totalRows = parsed.rows.length;
    console.log(`[TABLE-GENERATOR] Importing ${totalRows} rows using staging table strategy`);

    await client.query("BEGIN");

    await client.query(`DROP TABLE IF EXISTS "${stagingTableName}" CASCADE`);

    const columnDefs: string[] = [
      "id SERIAL PRIMARY KEY",
      "riga_originale INTEGER NOT NULL",
      "consultant_id VARCHAR(255) NOT NULL",
      "client_id VARCHAR(255)",
      "created_at TIMESTAMP DEFAULT NOW()",
    ];

    for (const col of columns) {
      const sanitizedName = sanitizeColumnName(col.suggestedName || col.originalName);
      const pgType = mapDataTypeToPostgres(col.dataType);
      columnDefs.push(`"${sanitizedName}" ${pgType}`);
    }

    const createStagingSQL = `
      CREATE TABLE "${stagingTableName}" (
        ${columnDefs.join(",\n        ")}
      )
    `;
    await client.query(createStagingSQL);
    console.log(`[TABLE-GENERATOR] Created staging table: ${stagingTableName}`);

    const sanitizedColumns = columns.map(c => sanitizeColumnName(c.suggestedName || c.originalName));
    const insertColumns = ["riga_originale", "consultant_id", "client_id", ...sanitizedColumns];
    const columnsList = insertColumns.map(c => `"${c}"`).join(", ");

    let insertedCount = 0;

    for (let batchStart = 0; batchStart < totalRows; batchStart += BATCH_SIZE) {
      const batchEnd = Math.min(batchStart + BATCH_SIZE, totalRows);
      const batchRows = parsed.rows.slice(batchStart, batchEnd);

      if (batchRows.length === 0) continue;

      const values: any[][] = [];
      const placeholders: string[] = [];
      let paramIndex = 1;

      for (let i = 0; i < batchRows.length; i++) {
        const row = batchRows[i];
        const rowNum = batchStart + i + 1;
        const rowValues: any[] = [rowNum, consultantId, clientId || null];

        for (const col of columns) {
          const rawValue = row[col.originalName];
          const convertedValue = convertValueForInsert(rawValue, col.dataType);
          rowValues.push(convertedValue);
        }

        values.push(rowValues);

        const rowPlaceholders = rowValues.map(() => `$${paramIndex++}`).join(", ");
        placeholders.push(`(${rowPlaceholders})`);
      }

      const insertSQL = `INSERT INTO "${stagingTableName}" (${columnsList}) VALUES ${placeholders.join(", ")}`;
      const flatValues = values.flat();

      await client.query(insertSQL, flatValues);

      insertedCount += batchRows.length;

      if (onProgress) {
        onProgress(insertedCount, totalRows);
      }

      if (batchEnd < totalRows) {
        console.log(`[TABLE-GENERATOR] Inserted ${insertedCount}/${totalRows} rows into staging...`);
      }
    }

    console.log(`[TABLE-GENERATOR] Creating indexes on staging table...`);
    await client.query(`CREATE INDEX ON "${stagingTableName}" (consultant_id)`);
    if (clientId) {
      await client.query(`CREATE INDEX ON "${stagingTableName}" (client_id)`);
    }
    await client.query(`CREATE INDEX ON "${stagingTableName}" (riga_originale)`);

    const indexColumns: string[] = [];
    for (const col of columns) {
      const upperType = col.dataType?.toUpperCase();
      if (upperType === "DATE" || upperType === "NUMERIC" || upperType === "INTEGER" || upperType === "NUMBER") {
        indexColumns.push(sanitizeColumnName(col.suggestedName || col.originalName));
      }
    }

    for (const colName of indexColumns.slice(0, 5)) {
      try {
        await client.query(`CREATE INDEX ON "${stagingTableName}" ("${colName}")`);
      } catch (idxError) {
        console.warn(`[TABLE-GENERATOR] Could not create index on ${colName}:`, idxError);
      }
    }

    console.log(`[TABLE-GENERATOR] Performing atomic swap: staging -> target`);

    const tableExistsResult = await client.query(
      `SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = $1
      )`,
      [tableName]
    );

    if (tableExistsResult.rows[0].exists) {
      const backupName = `${tableName}_old_${Date.now()}`;
      await client.query(`ALTER TABLE "${tableName}" RENAME TO "${backupName}"`);
      await client.query(`ALTER TABLE "${stagingTableName}" RENAME TO "${tableName}"`);
      await client.query(`DROP TABLE IF EXISTS "${backupName}" CASCADE`);
    } else {
      await client.query(`ALTER TABLE "${stagingTableName}" RENAME TO "${tableName}"`);
    }

    await client.query("COMMIT");

    console.log(`[TABLE-GENERATOR] Successfully imported ${insertedCount} rows into ${tableName} (staging+swap)`);
    return { success: true, rowCount: insertedCount };
  } catch (error: any) {
    await client.query("ROLLBACK").catch(() => {});
    await client.query(`DROP TABLE IF EXISTS "${stagingTableName}" CASCADE`).catch(() => {});
    console.error(`[TABLE-GENERATOR] Error importing data to ${tableName}:`, error);
    return { success: false, rowCount: 0, error: error.message };
  } finally {
    client.release();
  }
}

export async function dropDynamicTable(tableName: string): Promise<boolean> {
  if (!tableName.startsWith("cdd_")) {
    console.error(`[TABLE-GENERATOR] Refusing to drop non-cdd table: ${tableName}`);
    return false;
  }

  const client = await pool.connect();

  try {
    await client.query(`DROP TABLE IF EXISTS "${tableName}" CASCADE`);
    console.log(`[TABLE-GENERATOR] Dropped table: ${tableName}`);
    return true;
  } catch (error) {
    console.error(`[TABLE-GENERATOR] Error dropping table ${tableName}:`, error);
    return false;
  } finally {
    client.release();
  }
}

export async function getTableRowCount(tableName: string): Promise<number> {
  const client = await pool.connect();

  try {
    const result = await client.query(`SELECT COUNT(*) as count FROM "${tableName}"`);
    return parseInt(result.rows[0].count, 10);
  } catch (error) {
    console.error(`[TABLE-GENERATOR] Error getting row count for ${tableName}:`, error);
    return 0;
  } finally {
    client.release();
  }
}

export async function getTablePreview(
  tableName: string,
  limit: number = 100
): Promise<{ columns: string[]; rows: Record<string, any>[] }> {
  const client = await pool.connect();

  try {
    const colResult = await client.query(
      `SELECT column_name FROM information_schema.columns 
       WHERE table_name = $1 AND table_schema = 'public'
       ORDER BY ordinal_position`,
      [tableName]
    );

    const columns = colResult.rows.map(r => r.column_name);

    const dataResult = await client.query(
      `SELECT * FROM "${tableName}" ORDER BY riga_originale LIMIT $1`,
      [limit]
    );

    return { columns, rows: dataResult.rows };
  } catch (error) {
    console.error(`[TABLE-GENERATOR] Error getting table preview for ${tableName}:`, error);
    return { columns: [], rows: [] };
  } finally {
    client.release();
  }
}
