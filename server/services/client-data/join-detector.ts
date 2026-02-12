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

  const totalDataRows = lines.length - 1;
  const sampleSize = Math.min(totalDataRows, 500);

  if (sampleSize === totalDataRows) {
    for (let i = 1; i <= totalDataRows; i++) {
      const values = parseCsvLine(lines[i], delimiter);
      headers.forEach((h, idx) => {
        const val = parseValue(values[idx]);
        if (val !== null && val !== undefined) {
          sampleValues[h].push(val);
        }
      });
    }
  } else {
    const step = totalDataRows / sampleSize;
    for (let s = 0; s < sampleSize; s++) {
      const lineIdx = Math.min(Math.floor(1 + s * step), lines.length - 1);
      const values = parseCsvLine(lines[lineIdx], delimiter);
      headers.forEach((h, idx) => {
        const val = parseValue(values[idx]);
        if (val !== null && val !== undefined) {
          sampleValues[h].push(val);
        }
      });
    }
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

const NAME_BLACKLIST = ["id", "name", "date", "description", "note", "tipo", "type", "value", "valore", "status", "code", "codice"];

// Helper to check for generic terms
const GENERIC_TERMS = ["tipo", "type", "status", "stato", "cat", "mode", "flag", "state"];
const STRONG_ID_ROOTS = ["id", "cod", "key", "num"];

type ColumnRole = "key" | "dimension" | "measure";

function classifyColumnRole(columnName: string, values: any[], totalRows: number): ColumnRole {
  const lower = columnName.toLowerCase();

  const KEY_SUFFIXES = ["_id", "id", "_key", "_code", "_cod", "_pk", "_fk", "_ref", "_num", "_nr"];
  if (KEY_SUFFIXES.some(s => lower.endsWith(s)) || lower === "id") {
    return "key";
  }

  const KEY_EXACT_NAMES = ["tipologia", "tiporiga", "tipo_riga", "category", "categoria", "codice", "code"];
  if (KEY_EXACT_NAMES.includes(lower)) {
    return "dimension";
  }

  const METRIC_PATTERNS = [
    "costo", "cost", "prezzo", "price", "importo", "amount",
    "totale", "total", "quantita", "quantity", "qty",
    "sconto", "discount", "margine", "margin",
    "fatturato", "ricavo", "revenue", "incasso",
    "percentuale", "percent", "perc",
    "iva", "tax", "netto", "net", "lordo", "gross",
    "spesa", "utile", "profit", "perdita", "loss",
    "debito", "credito", "saldo", "balance",
    "peso", "weight", "altezza", "height", "larghezza", "width",
    "budget", "fee", "rata", "pagamento", "payment",
    "commissione", "commission", "tariffa", "rate",
    "valore_", "val_",
    "imp_", "tot_",
    "costoproduzione", "foodbev", "prime_cost"
  ];

  const matchedPattern = METRIC_PATTERNS.find(p => lower.includes(p));
  if (matchedPattern) {
    console.log(`[CLASSIFY-DEBUG] "${columnName}" → MEASURE (matched pattern "${matchedPattern}")`);
    return "measure";
  }

  const floatCount = values.filter(v => {
    if (typeof v === "number") return !Number.isInteger(v);
    const s = String(v).trim();
    return /^-?\d+[.,]\d+$/.test(s);
  }).length;

  if (values.length > 0 && floatCount / values.length > 0.1) {
    console.log(`[CLASSIFY-DEBUG] "${columnName}" → MEASURE (floats: ${floatCount}/${values.length})`);
    return "measure";
  }

  const numericValues = values
    .map(v => typeof v === "number" ? v : parseFloat(String(v)))
    .filter(v => !isNaN(v) && isFinite(v));

  if (numericValues.length > 10) {
    const mean = numericValues.reduce((a, b) => a + b, 0) / numericValues.length;
    if (mean !== 0) {
      const variance = numericValues.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / numericValues.length;
      const cv = Math.sqrt(variance) / Math.abs(mean);
      if (cv > 0.8) {
        console.log(`[CLASSIFY-DEBUG] "${columnName}" → MEASURE (CV=${cv.toFixed(2)}, mean=${mean.toFixed(1)}, sd=${Math.sqrt(variance).toFixed(1)})`);
        return "measure";
      }
    }
  }

  if (numericValues.length > 0 && values.length > 0) {
    const uniqueRatio = new Set(values.map(String)).size / values.length;
    const allIntegers = floatCount === 0;
    if (uniqueRatio >= 0.9 && allIntegers) {
      return "key";
    }
  }

  const uniqueRatio = new Set(values.map(String)).size / values.length;
  if (uniqueRatio < 0.1) {
    return "dimension";
  }

  const stringCount = values.filter(v => typeof v === "string" && !/^\d+$/.test(v)).length;
  if (values.length > 0 && stringCount / values.length > 0.5) {
    return "dimension";
  }

  return "key";
}

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

  // ====== PHASE 1: Discover PK candidates per file ======
  interface PKCandidate {
    filename: string;
    column: string;
    uniquenessRatio: number;
  }

  const pkCandidates: PKCandidate[] = [];
  const columnRoles = new Map<string, Map<string, ColumnRole>>();

  for (const file of files) {
    const roles = new Map<string, ColumnRole>();
    console.log(`[JOIN-DEBUG] File: ${file.filename}, columns: ${file.columns.length}, sampleValues keys: ${Object.keys(file.sampleValues || {}).length}`);
    for (const col of file.columns) {
      const values = file.sampleValues[col] || [];
      const role = classifyColumnRole(col, values, file.rowCount);
      roles.set(col, role);

      if (role === "measure") {
        console.log(`[JOIN-DEBUG]   ${col}: MEASURE (skipped), ${values.length} values`);
        continue;
      }

      if (values.length === 0) {
        console.log(`[JOIN-DEBUG]   ${col}: no values (skipped)`);
        continue;
      }

      const hasFloats = values.some(v => {
        if (typeof v === "number") return !Number.isInteger(v);
        return /^-?\d+[.,]\d+$/.test(String(v).trim());
      });
      if (hasFloats) {
        console.log(`[JOIN-DEBUG]   ${col}: has floats (skipped), role=${role}, ${values.length} values`);
        continue;
      }

      const uniqueValues = new Set(values.map(String));
      const uniquenessRatio = uniqueValues.size / values.length;

      console.log(`[JOIN-DEBUG]   ${col}: role=${role}, unique=${uniqueValues.size}/${values.length} (${(uniquenessRatio*100).toFixed(1)}%)${uniquenessRatio >= 0.95 ? ' → PK CANDIDATE' : ''}`);

      if (uniquenessRatio >= 0.95) {
        pkCandidates.push({ filename: file.filename, column: col, uniquenessRatio });
      }
    }
    columnRoles.set(file.filename, roles);
  }

  console.log(`[JOIN-DEBUG] Phase 1 complete: ${pkCandidates.length} PK candidates found:`, pkCandidates.map(p => `${p.filename}.${p.column} (${(p.uniquenessRatio*100).toFixed(1)}%)`));

  // ====== PHASE 2: Find FK→PK joins (Inclusion Dependency detection) ======
  const allCandidates: ScoredCandidate[] = [];
  const semanticRoots = ["prod", "art", "item", "cli", "cust", "forn", "supp", "vend", "sale", "ord", "doc", "riga", "line", "cat", "tipo"];

  for (const pk of pkCandidates) {
    const pkFile = files.find(f => f.filename === pk.filename)!;
    const pkValues = pkFile.sampleValues[pk.column] || [];
    const pkSet = new Set(pkValues.map(String));
    console.log(`[JOIN-DEBUG] Phase 2: Checking FK→PK for ${pk.filename}.${pk.column} (PK set size: ${pkSet.size}, sample values: ${pkValues.slice(0,5).join(',')})`);

    for (const fkFile of files) {
      if (fkFile.filename === pk.filename) continue;

      for (const fkCol of fkFile.columns) {
        const fkRole = columnRoles.get(fkFile.filename)?.get(fkCol) || "key";
        if (fkRole === "measure") continue;

        const fkValues = fkFile.sampleValues[fkCol] || [];
        if (fkValues.length === 0) continue;

        const typeFK = detectColumnType(fkValues);
        const typePK = detectColumnType(pkValues);
        if (!areTypesCompatible(typeFK, typePK)) {
          continue;
        }

        const fkSet = new Set(fkValues.map(String));
        let includedCount = 0;
        fkSet.forEach(v => { if (pkSet.has(v)) includedCount++; });

        const coverageRate = fkSet.size > 0 ? includedCount / fkSet.size : 0;

        if (coverageRate >= 0.10) {
          console.log(`[JOIN-DEBUG]   ${fkFile.filename}.${fkCol} → ${pk.filename}.${pk.column}: coverage=${(coverageRate*100).toFixed(1)}%, included=${includedCount}/${fkSet.size}, types=${typeFK}/${typePK}`);
        }

        if (coverageRate < 0.50) continue;

        const intersectionSize = includedCount;
        const overlapPct = fkSet.size > 0 ? intersectionSize / Math.min(fkSet.size, pkSet.size) : 0;

        let score = Math.round(coverageRate * 100);

        const normFK = normalizeColumnName(fkCol);
        const normPK = normalizeColumnName(pk.column);
        const isExactName = normFK === normPK;
        const localBlacklist = ["id", "name", "date", "description", "note", "tipo", "type", "value", "valore", "status", "code", "codice"];
        const isBlacklisted = localBlacklist.includes(normFK);

        if (isExactName && !isBlacklisted) {
          score += 30;
        }

        const localIdRoots = ["id", "cod", "key", "num"];
        const isIdLikeFK = localIdRoots.some(r => normFK.includes(r));
        const isIdLikePK = localIdRoots.some(r => normPK.includes(r));
        if (!isExactName && isIdLikeFK && isIdLikePK) {
          score += 15;
        }

        const sharedRoot = semanticRoots.find(root => normFK.includes(root) && normPK.includes(root));
        if (sharedRoot && !isExactName) {
          score += 20;
        }

        if (pk.uniquenessRatio >= 0.99) {
          score += 10;
        }

        const maxScore = 145;
        const confidence = Math.min(score / maxScore, 1.0);

        let matchType: JoinCandidate["matchType"];
        if (isExactName && !isBlacklisted) {
          matchType = "exact_name";
        } else if (isIdLikeFK || isIdLikePK) {
          matchType = "pk_fk_pattern";
        } else if (sharedRoot) {
          matchType = "semantic_match";
        } else {
          matchType = "overlap_only";
        }

        let explanation: string;
        if (matchType === "exact_name") {
          explanation = `Colonna "${fkCol}" ha lo stesso nome in entrambi i file con ${Math.round(coverageRate * 100)}% di copertura FK→PK`;
        } else if (matchType === "pk_fk_pattern") {
          explanation = `"${fkCol}" → "${pk.column}" relazione chiave primaria/esterna (${pk.filename} contiene valori unici), copertura ${Math.round(coverageRate * 100)}%`;
        } else if (matchType === "semantic_match") {
          explanation = `"${fkCol}" → "${pk.column}" collegamento semantico (radice "${sharedRoot}"), copertura ${Math.round(coverageRate * 100)}%`;
        } else {
          explanation = `"${fkCol}" → "${pk.column}" copertura ${Math.round(coverageRate * 100)}% dei valori FK presenti nella PK`;
        }

        allCandidates.push({
          sourceFile: fkFile.filename,
          sourceColumn: fkCol,
          targetFile: pk.filename,
          targetColumn: pk.column,
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

  // ====== PHASE 3: Star Schema Selection ======
  const deduped = deduplicateJoins(allCandidates);

  const factTable = files.reduce((max, f) => (f.rowCount > max.rowCount ? f : max), files[0]);
  const factFilename = factTable.filename;

  const dimensionFiles = files.filter((f) => f.filename !== factFilename);
  const selectedJoins: ScoredCandidate[] = [];
  const connectedDimensions = new Set<string>();
  const orphanTables: string[] = [];

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

  // ====== PHASE 4: Fallback for orphan tables ======
  for (const orphanFilename of [...orphanTables]) {
    const orphanFile = files.find(f => f.filename === orphanFilename)!;

    const connectedFiles = [factFilename, ...Array.from(connectedDimensions)];
    let bestFallback: ScoredCandidate | null = null;

    for (const connectedFilename of connectedFiles) {
      const connectedFile = files.find(f => f.filename === connectedFilename)!;

      for (const colOrphan of orphanFile.columns) {
        const roleOrphan = columnRoles.get(orphanFilename)?.get(colOrphan) || "key";
        if (roleOrphan === "measure") continue;

        for (const colConnected of connectedFile.columns) {
          const roleConnected = columnRoles.get(connectedFilename)?.get(colConnected) || "key";
          if (roleConnected === "measure") continue;

          const valuesOrphan = orphanFile.sampleValues[colOrphan] || [];
          const valuesConnected = connectedFile.sampleValues[colConnected] || [];
          if (valuesOrphan.length === 0 || valuesConnected.length === 0) continue;

          const typeO = detectColumnType(valuesOrphan);
          const typeC = detectColumnType(valuesConnected);
          if (!areTypesCompatible(typeO, typeC)) continue;

          const { overlapPct } = computeValueOverlap(valuesOrphan, valuesConnected);
          if (overlapPct < 0.5) continue;

          const normO = normalizeColumnName(colOrphan);
          const normC = normalizeColumnName(colConnected);

          const isExactName = normO === normC;
          const hasSharedRoot = semanticRoots.find(r => normO.includes(r) && normC.includes(r));
          if (!isExactName && !hasSharedRoot) continue;

          let fallbackScore = Math.round(overlapPct * 100) - 20;
          if (isExactName) fallbackScore += 15;
          if (hasSharedRoot) fallbackScore += 10;

          if (fallbackScore > (bestFallback?.rawScore || 0)) {
            bestFallback = {
              sourceFile: orphanFilename,
              sourceColumn: colOrphan,
              targetFile: connectedFilename,
              targetColumn: colConnected,
              confidence: Math.min(fallbackScore / 145, 1.0),
              matchType: isExactName ? "exact_name" : "semantic_match",
              valueOverlapPercent: Math.round(overlapPct * 100),
              joinType: "LEFT" as const,
              explanation: `Fallback: "${colOrphan}" ↔ "${colConnected}" sovrapposizione ${Math.round(overlapPct * 100)}%`,
              rawScore: fallbackScore,
            };
          }
        }
      }
    }

    if (bestFallback && bestFallback.rawScore > 60) {
      selectedJoins.push(bestFallback);
      connectedDimensions.add(orphanFilename);
      const idx = orphanTables.indexOf(orphanFilename);
      if (idx !== -1) orphanTables.splice(idx, 1);
    }
  }

  // ====== Build final result ======
  const finalJoins: JoinCandidate[] = selectedJoins
    .sort((a, b) => b.rawScore - a.rawScore);

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