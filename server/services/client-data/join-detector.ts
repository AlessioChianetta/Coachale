import fs from "fs";
import * as chardet from "chardet";

export interface FileSchema {
  filename: string;
  filePath: string;
  tableName: string;
  columns: string[];
  sampleValues: Record<string, any[]>;
  rowCount: number;
  delimiter: string;
  encoding: BufferEncoding;
}

export interface JoinCandidate {
  sourceFile: string;
  sourceColumn: string;
  targetFile: string;
  targetColumn: string;
  confidence: number;
  matchType: "exact_name" | "name_similarity" | "value_overlap" | "pk_fk_pattern";
  valueOverlapPercent: number;
  joinType: "LEFT" | "INNER";
  explanation: string;
}

export interface JoinDetectionResult {
  files: FileSchema[];
  suggestedJoins: JoinCandidate[];
  primaryTable: string;
  joinOrder: string[];
  overallConfidence: number;
}

function detectFileEncoding(buffer: Buffer): BufferEncoding {
  const detected = chardet.detect(buffer);
  const encodingMap: Record<string, BufferEncoding> = {
    "UTF-8": "utf-8",
    "UTF-16 LE": "utf16le",
    "UTF-16 BE": "utf16le",
    "ISO-8859-1": "latin1",
    "ISO-8859-15": "latin1",
    "windows-1252": "latin1",
    "ISO-8859-2": "latin1",
  };
  return encodingMap[detected || "UTF-8"] || "latin1";
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
  return result.map((v) => v.replace(/^"|"$/g, "").trim());
}

function parseValue(value: string | undefined): any {
  if (value === undefined || value === "" || value === null) return null;
  const trimmed = value.trim();
  if (trimmed === "") return null;

  if (/^-?\d+$/.test(trimmed)) {
    const num = parseInt(trimmed, 10);
    if (Number.isSafeInteger(num)) return num;
  }

  if (/^"?-?\d+[.,]\d+"?$/.test(trimmed)) {
    const cleaned = trimmed.replace(/"/g, "");
    const normalized = cleaned.replace(",", ".");
    const num = parseFloat(normalized);
    if (!isNaN(num)) return num;
  }

  return trimmed;
}

export async function analyzeFile(filePath: string, filename: string): Promise<FileSchema> {
  const buffer = await fs.promises.readFile(filePath);
  const encoding = detectFileEncoding(buffer);
  const content = buffer.toString(encoding);

  const lines = content.split(/\r?\n/).filter((line) => line.trim());
  if (lines.length === 0) throw new Error(`File ${filename} is empty`);

  const delimiter = detectDelimiter(lines[0]);
  const headers = parseCsvLine(lines[0], delimiter);

  const sampleValues: Record<string, any[]> = {};
  headers.forEach((h) => (sampleValues[h] = []));

  const sampleSize = Math.min(lines.length - 1, 500);
  for (let i = 1; i <= sampleSize; i++) {
    const values = parseCsvLine(lines[i], delimiter);
    headers.forEach((h, idx) => {
      const val = parseValue(values[idx]);
      if (val !== null && val !== undefined) {
        sampleValues[h].push(val);
      }
    });
  }

  const baseName = filename
    .replace(/\.\w+$/, "")
    .replace(/[_\d]+$/, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");

  return {
    filename,
    filePath,
    tableName: baseName || "table",
    columns: headers,
    sampleValues,
    rowCount: lines.length - 1,
    delimiter,
    encoding,
  };
}

function normalizeColumnName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[àáâãäå]/g, "a")
    .replace(/[èéêë]/g, "e")
    .replace(/[ìíîï]/g, "i")
    .replace(/[òóôõö]/g, "o")
    .replace(/[ùúûü]/g, "u")
    .replace(/[^a-z0-9]/g, "")
    .trim();
}

function isPrimaryKeyCandidate(colName: string, values: any[]): boolean {
  const normalized = normalizeColumnName(colName);
  const isPkName =
    normalized === "id" ||
    normalized === "codice" ||
    normalized === "codigo" ||
    normalized === "code" ||
    /^id_/.test(normalized) ||
    /_id$/.test(normalized);

  if (!isPkName) return false;

  const uniqueValues = new Set(values.map(String));
  const uniqueRatio = uniqueValues.size / Math.max(values.length, 1);
  return uniqueRatio > 0.9;
}

function computeValueOverlap(valuesA: any[], valuesB: any[]): number {
  if (valuesA.length === 0 || valuesB.length === 0) return 0;

  const setB = new Set(valuesB.map(String));
  const matchCount = valuesA.filter((v) => setB.has(String(v))).length;
  return matchCount / Math.max(valuesA.length, 1);
}

export async function detectJoins(files: FileSchema[]): Promise<JoinDetectionResult> {
  const candidates: JoinCandidate[] = [];

  for (let i = 0; i < files.length; i++) {
    for (let j = 0; j < files.length; j++) {
      if (i === j) continue;

      const fileA = files[i];
      const fileB = files[j];

      for (const colA of fileA.columns) {
        for (const colB of fileB.columns) {
          const normA = normalizeColumnName(colA);
          const normB = normalizeColumnName(colB);

          if (normA.length < 2 || normB.length < 2) continue;

          let confidence = 0;
          let matchType: JoinCandidate["matchType"] = "value_overlap";
          let explanation = "";

          if (normA === normB) {
            confidence += 0.5;
            matchType = "exact_name";
            explanation = `Colonna "${colA}" ha lo stesso nome in entrambi i file`;
          } else if (
            normA.includes(normB) ||
            normB.includes(normA) ||
            normA.replace(/_?id$/, "") === normB.replace(/_?id$/, "")
          ) {
            confidence += 0.3;
            matchType = "name_similarity";
            explanation = `Colonna "${colA}" e "${colB}" hanno nomi simili`;
          } else {
            continue;
          }

          const valuesA = fileA.sampleValues[colA] || [];
          const valuesB = fileB.sampleValues[colB] || [];
          const overlap = computeValueOverlap(valuesA, valuesB);

          if (overlap < 0.1 && matchType !== "exact_name") continue;

          confidence += overlap * 0.4;

          const isPkA = isPrimaryKeyCandidate(colA, valuesA);
          const isPkB = isPrimaryKeyCandidate(colB, valuesB);

          if (isPkA || isPkB) {
            confidence += 0.2;
            matchType = "pk_fk_pattern";
            const pkFile = isPkB ? fileB.filename : fileA.filename;
            explanation = `"${colB}" in ${pkFile} sembra una chiave primaria`;
          }

          confidence = Math.min(confidence, 1.0);

          if (confidence >= 0.3) {
            const uniqueB = new Set(valuesB.map(String));
            const bIsLookup = uniqueB.size === valuesB.length && fileB.rowCount < fileA.rowCount;

            candidates.push({
              sourceFile: fileA.filename,
              sourceColumn: colA,
              targetFile: fileB.filename,
              targetColumn: colB,
              confidence,
              matchType,
              valueOverlapPercent: Math.round(overlap * 100),
              joinType: bIsLookup ? "LEFT" : "LEFT",
              explanation,
            });
          }
        }
      }
    }
  }

  const deduped = deduplicateJoins(candidates);
  const sorted = deduped.sort((a, b) => b.confidence - a.confidence);

  const primaryTable = determinePrimaryTable(files, sorted);
  const joinOrder = determineJoinOrder(files, sorted, primaryTable);

  const overallConfidence =
    sorted.length > 0
      ? sorted.reduce((sum, j) => sum + j.confidence, 0) / sorted.length
      : 0;

  return {
    files,
    suggestedJoins: sorted,
    primaryTable,
    joinOrder,
    overallConfidence,
  };
}

function deduplicateJoins(candidates: JoinCandidate[]): JoinCandidate[] {
  const seen = new Map<string, JoinCandidate>();

  for (const c of candidates) {
    const pairKey = [c.sourceFile, c.targetFile].sort().join("|||");
    const key = `${pairKey}__${[c.sourceColumn, c.targetColumn].sort().join("|||")}`;

    const existing = seen.get(key);
    if (!existing || c.confidence > existing.confidence) {
      seen.set(key, c);
    }
  }

  return Array.from(seen.values());
}

function determinePrimaryTable(files: FileSchema[], joins: JoinCandidate[]): string {
  const scores = new Map<string, number>();
  files.forEach((f) => scores.set(f.filename, f.rowCount));

  for (const j of joins) {
    const sourceScore = scores.get(j.sourceFile) || 0;
    scores.set(j.sourceFile, sourceScore + 100);
  }

  let primary = files[0].filename;
  let maxScore = 0;

  for (const [filename, score] of scores.entries()) {
    if (score > maxScore) {
      maxScore = score;
      primary = filename;
    }
  }

  return primary;
}

function determineJoinOrder(
  files: FileSchema[],
  joins: JoinCandidate[],
  primaryTable: string
): string[] {
  const order = [primaryTable];
  const remaining = new Set(files.map((f) => f.filename).filter((f) => f !== primaryTable));

  while (remaining.size > 0) {
    let bestFile: string | null = null;
    let bestConf = -1;

    for (const file of remaining) {
      const relatedJoin = joins.find(
        (j) =>
          (j.sourceFile === file && order.includes(j.targetFile)) ||
          (j.targetFile === file && order.includes(j.sourceFile))
      );
      if (relatedJoin && relatedJoin.confidence > bestConf) {
        bestConf = relatedJoin.confidence;
        bestFile = file;
      }
    }

    if (bestFile) {
      order.push(bestFile);
      remaining.delete(bestFile);
    } else {
      const next = remaining.values().next().value;
      if (next) {
        order.push(next);
        remaining.delete(next);
      }
    }
  }

  return order;
}

export function buildJoinSQL(
  files: FileSchema[],
  joins: JoinCandidate[],
  primaryTable: string,
  joinOrder: string[],
  stagingTables: Map<string, string>
): { sql: string; columns: { name: string; sourceFile: string; originalName: string }[] } {
  const fileByName = new Map(files.map((f) => [f.filename, f]));
  const allColumns: { name: string; sourceFile: string; originalName: string }[] = [];

  const primaryFile = fileByName.get(primaryTable)!;
  const primaryStagingTable = stagingTables.get(primaryTable)!;
  const primaryAlias = primaryFile.tableName;

  const selectParts: string[] = [];
  const usedNames = new Set<string>();

  for (const col of primaryFile.columns) {
    const sanitized = sanitizeForSQL(col);
    let uniqueName = sanitized;
    if (usedNames.has(uniqueName)) {
      uniqueName = `${primaryAlias}_${sanitized}`;
    }
    usedNames.add(uniqueName);
    selectParts.push(`"${primaryAlias}"."${sanitized}" AS "${uniqueName}"`);
    allColumns.push({ name: uniqueName, sourceFile: primaryTable, originalName: col });
  }

  let fromClause = `"${primaryStagingTable}" AS "${primaryAlias}"`;
  const joinClauses: string[] = [];

  for (let i = 1; i < joinOrder.length; i++) {
    const fileName = joinOrder[i];
    const file = fileByName.get(fileName);
    if (!file) continue;

    const stagingTable = stagingTables.get(fileName);
    if (!stagingTable) continue;

    const alias = file.tableName + (i > 1 ? `_${i}` : "");

    for (const col of file.columns) {
      const sanitized = sanitizeForSQL(col);
      let uniqueName = sanitized;
      if (usedNames.has(uniqueName)) {
        uniqueName = `${alias}_${sanitized}`;
      }
      usedNames.add(uniqueName);
      selectParts.push(`"${alias}"."${sanitized}" AS "${uniqueName}"`);
      allColumns.push({ name: uniqueName, sourceFile: fileName, originalName: col });
    }

    const relevantJoin = joins.find(
      (j) =>
        (j.sourceFile === fileName && joinOrder.slice(0, i).includes(j.targetFile)) ||
        (j.targetFile === fileName && joinOrder.slice(0, i).includes(j.sourceFile))
    );

    if (relevantJoin) {
      let leftAlias: string;
      let leftCol: string;
      let rightCol: string;

      if (relevantJoin.targetFile === fileName) {
        const leftFile = fileByName.get(relevantJoin.sourceFile)!;
        const leftIdx = joinOrder.indexOf(relevantJoin.sourceFile);
        leftAlias = leftFile.tableName + (leftIdx > 1 ? `_${leftIdx}` : leftIdx === 0 ? "" : "");
        if (leftIdx === 0) leftAlias = leftFile.tableName;
        leftCol = sanitizeForSQL(relevantJoin.sourceColumn);
        rightCol = sanitizeForSQL(relevantJoin.targetColumn);
      } else {
        const leftFile = fileByName.get(relevantJoin.targetFile)!;
        const leftIdx = joinOrder.indexOf(relevantJoin.targetFile);
        leftAlias = leftFile.tableName + (leftIdx > 1 ? `_${leftIdx}` : leftIdx === 0 ? "" : "");
        if (leftIdx === 0) leftAlias = leftFile.tableName;
        leftCol = sanitizeForSQL(relevantJoin.targetColumn);
        rightCol = sanitizeForSQL(relevantJoin.sourceColumn);
      }

      joinClauses.push(
        `LEFT JOIN "${stagingTable}" AS "${alias}" ON "${leftAlias}"."${leftCol}" = "${alias}"."${rightCol}"`
      );
    } else {
      joinClauses.push(`CROSS JOIN "${stagingTable}" AS "${alias}"`);
    }
  }

  const sql = `SELECT ${selectParts.join(",\n  ")} FROM ${fromClause}\n${joinClauses.join("\n")}`;

  return { sql, columns: allColumns };
}

function sanitizeForSQL(name: string): string {
  return name
    .toLowerCase()
    .replace(/[àáâãäå]/g, "a")
    .replace(/[èéêë]/g, "e")
    .replace(/[ìíîï]/g, "i")
    .replace(/[òóôõö]/g, "o")
    .replace(/[ùúûü]/g, "u")
    .replace(/[^a-z0-9_]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
    .substring(0, 63) || "col";
}
