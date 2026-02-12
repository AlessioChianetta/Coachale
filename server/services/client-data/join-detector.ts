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
  matchType: "exact_name" | "overlap_only" | "pk_fk_pattern" | "semantic_match";
  valueOverlapPercent: number;
  joinType: "LEFT" | "INNER";
  explanation: string;
  rawScore: number;
}

export interface JoinDetectionResult {
  files: FileSchema[];
  suggestedJoins: JoinCandidate[];
  primaryTable: string;
  joinOrder: string[];
  overallConfidence: number;
  orphanTables?: string[];
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

function detectColumnType(values: any[]): "integer" | "float" | "numeric" | "string" | "date" {
  if (values.length === 0) return "string";

  let hasInt = false;
  let hasFloat = false;
  let hasString = false;
  let hasDate = false;

  for (const v of values) {
    const s = String(v).trim();
    if (/^\d{4}[-/]\d{1,2}[-/]\d{1,2}/.test(s) || /^\d{1,2}[-/]\d{1,2}[-/]\d{4}/.test(s)) {
      hasDate = true;
    } else if (typeof v === "number" && Number.isInteger(v)) {
      hasInt = true;
    } else if (typeof v === "number") {
      hasFloat = true;
    } else if (/^-?\d+$/.test(s)) {
      hasInt = true;
    } else if (/^-?\d+[.,]\d+$/.test(s)) {
      hasFloat = true;
    } else {
      hasString = true;
    }
  }

  if (hasString) return "string";
  if (hasDate && !hasInt && !hasFloat) return "date";
  if (hasInt && hasFloat) return "numeric";
  if (hasFloat) return "float";
  if (hasInt) return "integer";
  if (hasDate) return "date";
  return "string";
}

function areTypesCompatible(typeA: string, typeB: string): boolean {
  if (typeA === typeB) return true;
  const numericTypes = new Set(["integer", "float", "numeric"]);
  if (numericTypes.has(typeA) && numericTypes.has(typeB)) return true;
  return false;
}

function computeValueOverlap(valuesA: any[], valuesB: any[]): { overlapPct: number; intersectionSize: number } {
  if (valuesA.length === 0 || valuesB.length === 0) {
    return { overlapPct: 0, intersectionSize: 0 };
  }

  const setA = new Set(valuesA.map(String));
  const setB = new Set(valuesB.map(String));
  let intersectionSize = 0;
  const smaller = setA.size <= setB.size ? setA : setB;
  const larger = setA.size <= setB.size ? setB : setA;
  smaller.forEach((v) => {
    if (larger.has(v)) intersectionSize++;
  });

  const minSetSize = Math.min(setA.size, setB.size);
  const overlapPct = minSetSize > 0 ? intersectionSize / minSetSize : 0;
  return { overlapPct, intersectionSize };
}

// Added extra terms to blacklist to avoid joining on prices or quantities
// Added "cost", "costo", "revenue" to prevent financial joins
const NAME_BLACKLIST = ["id", "name", "date", "description", "note", "tipo", "type", "value", "valore", "status", "code", "codice", "quantita", "quantity", "prezzo", "price", "importo", "amount", "cost", "costo", "revenue"];

// Helper to check for generic terms
const GENERIC_TERMS = ["tipo", "type", "status", "stato", "cat", "mode", "flag", "state"];
const STRONG_ID_ROOTS = ["id", "cod", "key", "num"];

interface ScoredCandidate extends JoinCandidate {
  rawScore: number;
}

export async function detectJoins(files: FileSchema[]): Promise<JoinDetectionResult> {
  if (files.length === 0) {
    return { files, suggestedJoins: [], primaryTable: "", joinOrder: [], overallConfidence: 0, orphanTables: [] };
  }
  if (files.length === 1) {
    return { files, suggestedJoins: [], primaryTable: files[0].filename, joinOrder: [files[0].filename], overallConfidence: 0, orphanTables: [] };
  }

  const allCandidates: ScoredCandidate[] = [];

  for (let i = 0; i < files.length; i++) {
    for (let j = i + 1; j < files.length; j++) {
      const fileA = files[i];
      const fileB = files[j];

      for (const colA of fileA.columns) {
        for (const colB of fileB.columns) {
          const valuesA = fileA.sampleValues[colA] || [];
          const valuesB = fileB.sampleValues[colB] || [];

          if (valuesA.length === 0 || valuesB.length === 0) continue;

          const typeA = detectColumnType(valuesA);
          const typeB = detectColumnType(valuesB);
          if (!areTypesCompatible(typeA, typeB)) continue;

          const { overlapPct, intersectionSize } = computeValueOverlap(valuesA, valuesB);
          // Allow slightly lower overlap if names match strongly, otherwise require 1%
          if (intersectionSize === 0 || overlapPct < 0.01) continue;

          const normA = normalizeColumnName(colA);
          const normB = normalizeColumnName(colB);

          let score = 0;

          // 1. Base Score: Overlap Percentage (0-100)
          score += Math.round(overlapPct * 100);

          const isExactName = normA === normB;
          const isBlacklisted = NAME_BLACKLIST.includes(normA);

          // 2. Exact Name Match Bonus
          if (isExactName && !isBlacklisted) {
            score += 25; // Increased slightly
          }

          // 3. ID/Code Partial Match Bonus (e.g. "order_id" vs "id")
          // If both contain "id", "cod", etc. -> Likely keys
          const isIdLikeA = STRONG_ID_ROOTS.some(r => normA.includes(r));
          const isIdLikeB = STRONG_ID_ROOTS.some(r => normB.includes(r));

          if (!isExactName && isIdLikeA && isIdLikeB) {
              score += 15;
          }

          // 4. Semantic Match Bonus (e.g. "codiceprod" vs "productid")
          // Check for shared meaningful roots (prod, cli, supp, ord)
          const semanticRoots = ["prod", "art", "item", "cli", "cust", "forn", "supp", "vend", "sale", "ord", "doc"];
          const sharedRoot = semanticRoots.find(root => normA.includes(root) && normB.includes(root));
          if (sharedRoot && !isExactName) {
              score += 20;
          }

          // 5. PENALTY: Generic Type/Status columns joining non-Type tables
          // Prevents "tiporiga" -> "prodotti"
          const isGenericA = GENERIC_TERMS.some(t => normA.includes(t));
          const isGenericB = GENERIC_TERMS.some(t => normB.includes(t));

          // If A is generic but B is NOT (and they aren't exact match), check if target table supports generic
          if (isGenericA && !isGenericB && !isExactName) {
               const targetTableNorm = normalizeColumnName(fileB.tableName);
               const tableMatchesGeneric = GENERIC_TERMS.some(t => targetTableNorm.includes(t));
               if (!tableMatchesGeneric) {
                   score -= 60; // Massive penalty
               }
          }
          if (isGenericB && !isGenericA && !isExactName) {
               const sourceTableNorm = normalizeColumnName(fileA.tableName);
               const tableMatchesGeneric = GENERIC_TERMS.some(t => sourceTableNorm.includes(t));
               if (!tableMatchesGeneric) {
                   score -= 60; // Massive penalty
               }
          }

          // 6. PK/FK Check
          const uniqueRatioA = new Set(valuesA.map(String)).size / valuesA.length;
          const uniqueRatioB = new Set(valuesB.map(String)).size / valuesB.length;
          const hasPk = uniqueRatioA >= 0.95 || uniqueRatioB >= 0.95; // Lowered threshold slightly to 95%

          if (hasPk) {
            score += 15;
          }

          if (score <= 0) continue;

          const confidence = Math.min(score / 140, 1.0);

          let matchType: JoinCandidate["matchType"];
          if (isExactName && !isBlacklisted) {
            matchType = "exact_name";
          } else if (hasPk) {
            matchType = "pk_fk_pattern";
          } else if (sharedRoot) {
            matchType = "semantic_match";
          } else {
            matchType = "overlap_only";
          }

          let explanation: string;
          if (matchType === "exact_name") {
            explanation = `Colonna "${colA}" ha lo stesso nome in entrambi i file con ${Math.round(overlapPct * 100)}% di sovrapposizione dati`;
          } else if (matchType === "pk_fk_pattern") {
            const pkFile = uniqueRatioB >= 0.95 ? fileB.filename : fileA.filename;
            explanation = `"${colA}" → "${colB}" relazione chiave primaria/esterna (${pkFile} contiene valori unici)`;
          } else if (matchType === "semantic_match") {
            explanation = `"${colA}" e "${colB}" sembrano semanticamente correlati (radice comune)`;
          } else {
            explanation = `"${colA}" e "${colB}" condividono ${Math.round(overlapPct * 100)}% dei valori`;
          }

          allCandidates.push({
            sourceFile: fileA.filename,
            sourceColumn: colA,
            targetFile: fileB.filename,
            targetColumn: colB,
            confidence,
            matchType,
            valueOverlapPercent: Math.round(overlapPct * 100),
            joinType: "LEFT",
            explanation,
            rawScore: score,
          });
        }
      }
    }
  }

  const deduped = deduplicateJoins(allCandidates);

  const factTable = files.reduce((max, f) => (f.rowCount > max.rowCount ? f : max), files[0]);
  const factFilename = factTable.filename;

  const dimensionFiles = files.filter((f) => f.filename !== factFilename);
  const selectedJoins: ScoredCandidate[] = [];
  const connectedDimensions = new Set<string>();
  const orphanTables: string[] = [];

  // Threshold lowered slightly to catch valid but messy joins
  const SCORE_THRESHOLD = 60; 

  for (const dim of dimensionFiles) {
    const candidatesForDim = deduped.filter(
      (c) =>
        (c.sourceFile === dim.filename && c.targetFile === factFilename) ||
        (c.targetFile === dim.filename && c.sourceFile === factFilename)
    );

    const validCandidates = candidatesForDim.filter((c) => c.rawScore > SCORE_THRESHOLD);
    if (validCandidates.length > 0) {
      validCandidates.sort((a, b) => b.rawScore - a.rawScore);
      selectedJoins.push(validCandidates[0]);
      connectedDimensions.add(dim.filename);
    }
  }

  for (const dim of dimensionFiles) {
    if (connectedDimensions.has(dim.filename)) continue;

    const candidatesForDim = deduped.filter(
      (c) =>
        ((c.sourceFile === dim.filename && connectedDimensions.has(c.targetFile)) ||
         (c.targetFile === dim.filename && connectedDimensions.has(c.sourceFile)))
    );

    const validCandidates = candidatesForDim.filter((c) => c.rawScore > SCORE_THRESHOLD);
    if (validCandidates.length > 0) {
      validCandidates.sort((a, b) => b.rawScore - a.rawScore);
      selectedJoins.push(validCandidates[0]);
      connectedDimensions.add(dim.filename);
    } else {
      orphanTables.push(dim.filename);
    }
  }

  const finalJoins: JoinCandidate[] = selectedJoins
    .sort((a, b) => b.rawScore - a.rawScore)
    .map(({ rawScore, ...rest }) => rest);

  const overallConfidence =
    finalJoins.length > 0
      ? finalJoins.reduce((sum, j) => sum + j.confidence, 0) / finalJoins.length
      : 0;

  const connectedDimensionsSorted = dimensionFiles
    .filter((f) => connectedDimensions.has(f.filename))
    .map((f) => {
      const join = selectedJoins.find(
        (j) => j.sourceFile === f.filename || j.targetFile === f.filename
      );
      return { filename: f.filename, score: join?.rawScore || 0 };
    })
    .sort((a, b) => b.score - a.score)
    .map((d) => d.filename);

  const joinOrder = [factFilename, ...connectedDimensionsSorted];

  return {
    files,
    suggestedJoins: finalJoins,
    primaryTable: factFilename,
    joinOrder,
    overallConfidence,
    orphanTables: orphanTables.length > 0 ? orphanTables : undefined,
  };
}

function deduplicateJoins<T extends JoinCandidate>(candidates: T[]): T[] {
  const seen = new Map<string, T>();

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

    const relevantJoin = joins.find(
      (j) =>
        (j.sourceFile === fileName && joinOrder.slice(0, i).includes(j.targetFile)) ||
        (j.targetFile === fileName && joinOrder.slice(0, i).includes(j.sourceFile))
    );

    if (!relevantJoin) continue;

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