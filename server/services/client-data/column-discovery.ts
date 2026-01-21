import { db } from "../../db";
import { consultantColumnMappings } from "../../../shared/schema";
import { eq, and, ilike, sql } from "drizzle-orm";
import { GoogleGenAI } from "@google/genai";
import { getSuperAdminGeminiKeys } from "../../ai/provider-factory";
import type { DistributedSample, ColumnProfile } from "./column-profiler";
import { profileColumn } from "./column-profiler";

export interface ColumnDefinition {
  originalName: string;
  suggestedName: string;
  displayName: string;
  dataType: "TEXT" | "NUMERIC" | "INTEGER" | "DATE" | "BOOLEAN";
  description?: string;
  confidence: number;
  patternMatched?: string;
  sampleValues: any[];
}

export interface DiscoveryResult {
  columns: ColumnDefinition[];
  overallConfidence: number;
  autoConfirmed: boolean;
  templateDetected?: string;
  aiUsed: boolean;
}

const TEMPLATE_PATTERNS: Record<string, { columns: Record<string, { dataType: string; description: string }> }> = {
  DDTRIGHE: {
    columns: {
      "cod_art": { dataType: "TEXT", description: "Codice articolo" },
      "des_art": { dataType: "TEXT", description: "Descrizione articolo" },
      "qta": { dataType: "NUMERIC", description: "Quantità" },
      "prezzo": { dataType: "NUMERIC", description: "Prezzo unitario" },
      "imp_tot": { dataType: "NUMERIC", description: "Importo totale" },
      "iva": { dataType: "NUMERIC", description: "Percentuale IVA" },
      "data_doc": { dataType: "DATE", description: "Data documento" },
      "num_doc": { dataType: "TEXT", description: "Numero documento" },
      "cod_cli": { dataType: "TEXT", description: "Codice cliente" },
      "rag_soc": { dataType: "TEXT", description: "Ragione sociale" },
    },
  },
  INVENTARIO: {
    columns: {
      "codice": { dataType: "TEXT", description: "Codice prodotto" },
      "descrizione": { dataType: "TEXT", description: "Descrizione prodotto" },
      "giacenza": { dataType: "INTEGER", description: "Giacenza attuale" },
      "costo": { dataType: "NUMERIC", description: "Costo unitario" },
      "prezzo_vendita": { dataType: "NUMERIC", description: "Prezzo vendita" },
      "categoria": { dataType: "TEXT", description: "Categoria prodotto" },
      "fornitore": { dataType: "TEXT", description: "Fornitore" },
      "um": { dataType: "TEXT", description: "Unità di misura" },
    },
  },
  CRM: {
    columns: {
      "nome": { dataType: "TEXT", description: "Nome contatto" },
      "cognome": { dataType: "TEXT", description: "Cognome contatto" },
      "email": { dataType: "TEXT", description: "Email" },
      "telefono": { dataType: "TEXT", description: "Telefono" },
      "azienda": { dataType: "TEXT", description: "Azienda" },
      "stato": { dataType: "TEXT", description: "Stato lead" },
      "fonte": { dataType: "TEXT", description: "Fonte acquisizione" },
      "data_contatto": { dataType: "DATE", description: "Data primo contatto" },
      "note": { dataType: "TEXT", description: "Note" },
    },
  },
};

const PATTERNS = {
  DATE_DMY: /^\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4}$/,
  DATE_YMD: /^\d{4}[-\/]\d{1,2}[-\/]\d{1,2}$/,
  DATE_ISO: /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2})?/,
  DATE_WORDS: /^\d{1,2}\s+(gen|feb|mar|apr|mag|giu|lug|ago|set|ott|nov|dic|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i,
  IMPORTO_EU: /^-?\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?€?$/,
  IMPORTO_SIMPLE: /^-?€?\s?\d+(?:[.,]\d{1,2})?$/,
  PERCENTAGE: /^-?\d+(?:[.,]\d+)?%$/,
  INTEGER: /^-?\d+$/,
  DECIMAL: /^-?\d+[.,]\d+$/,
  DECIMAL_SIMPLE: /^-?\d+\.\d{1,4}$/,
  PHONE: /^(?:\+?\d{1,3}[-.\s]?)?\d{6,}$/,
  EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  BOOLEAN_IT: /^(si|no|vero|falso|true|false|1|0|s|n|y|yes)$/i,
  COD_FISCALE: /^[A-Z]{6}\d{2}[A-Z]\d{2}[A-Z]\d{3}[A-Z]$/i,
  PARTITA_IVA: /^\d{11}$/,
};

const DIRTY_DATA_PATTERNS = [
  /^#(REF|DIV\/0|N\/A|VALUE|NAME|NUM|NULL)!?$/i,
  /^(n\/a|na|null|undefined|-)$/i,
  /^(err|error|errore)$/i,
  /^\s*$/,
];

function isCleanValue(val: any): boolean {
  if (val === null || val === undefined || val === "") return false;
  const strVal = String(val).trim();
  return !DIRTY_DATA_PATTERNS.some(p => p.test(strVal));
}

function cleanNumericValue(val: string): string {
  return val
    .replace(/€/g, "")
    .replace(/\s/g, "")
    .replace(/['']/g, "")
    .trim();
}

const COLUMN_NAME_HINTS: Record<string, { dataType: string; confidence: number }> = {
  "data": { dataType: "DATE", confidence: 0.9 },
  "date": { dataType: "DATE", confidence: 0.9 },
  "dt_": { dataType: "DATE", confidence: 0.85 },
  "order_date": { dataType: "DATE", confidence: 0.95 },
  "created": { dataType: "DATE", confidence: 0.85 },
  "updated": { dataType: "DATE", confidence: 0.85 },
  "timestamp": { dataType: "DATE", confidence: 0.9 },
  "importo": { dataType: "NUMERIC", confidence: 0.9 },
  "prezzo": { dataType: "NUMERIC", confidence: 0.9 },
  "price": { dataType: "NUMERIC", confidence: 0.95 },
  "unit_price": { dataType: "NUMERIC", confidence: 0.95 },
  "unit_cost": { dataType: "NUMERIC", confidence: 0.95 },
  "amount": { dataType: "NUMERIC", confidence: 0.9 },
  "totale": { dataType: "NUMERIC", confidence: 0.9 },
  "total": { dataType: "NUMERIC", confidence: 0.9 },
  "total_net": { dataType: "NUMERIC", confidence: 0.95 },
  "net": { dataType: "NUMERIC", confidence: 0.85 },
  "gross": { dataType: "NUMERIC", confidence: 0.85 },
  "imp_": { dataType: "NUMERIC", confidence: 0.85 },
  "costo": { dataType: "NUMERIC", confidence: 0.9 },
  "cost": { dataType: "NUMERIC", confidence: 0.9 },
  "revenue": { dataType: "NUMERIC", confidence: 0.9 },
  "margin": { dataType: "NUMERIC", confidence: 0.85 },
  "profit": { dataType: "NUMERIC", confidence: 0.85 },
  "fee": { dataType: "NUMERIC", confidence: 0.85 },
  "tax": { dataType: "NUMERIC", confidence: 0.85 },
  "vat": { dataType: "NUMERIC", confidence: 0.85 },
  "qta": { dataType: "INTEGER", confidence: 0.9 },
  "qty": { dataType: "INTEGER", confidence: 0.9 },
  "quantita": { dataType: "INTEGER", confidence: 0.9 },
  "quantity": { dataType: "INTEGER", confidence: 0.9 },
  "count": { dataType: "INTEGER", confidence: 0.85 },
  "numero": { dataType: "INTEGER", confidence: 0.75 },
  "number": { dataType: "INTEGER", confidence: 0.75 },
  "table_number": { dataType: "INTEGER", confidence: 0.9 },
  "order_id": { dataType: "INTEGER", confidence: 0.9 },
  "perc": { dataType: "NUMERIC", confidence: 0.85 },
  "percent": { dataType: "NUMERIC", confidence: 0.85 },
  "percentage": { dataType: "NUMERIC", confidence: 0.85 },
  "discount": { dataType: "NUMERIC", confidence: 0.85 },
  "sconto": { dataType: "NUMERIC", confidence: 0.85 },
  "iva": { dataType: "NUMERIC", confidence: 0.85 },
  "email": { dataType: "TEXT", confidence: 0.95 },
  "telefono": { dataType: "TEXT", confidence: 0.9 },
  "phone": { dataType: "TEXT", confidence: 0.9 },
  "tel": { dataType: "TEXT", confidence: 0.85 },
  "nome": { dataType: "TEXT", confidence: 0.9 },
  "name": { dataType: "TEXT", confidence: 0.9 },
  "item_name": { dataType: "TEXT", confidence: 0.95 },
  "product_name": { dataType: "TEXT", confidence: 0.95 },
  "cognome": { dataType: "TEXT", confidence: 0.9 },
  "surname": { dataType: "TEXT", confidence: 0.9 },
  "descrizione": { dataType: "TEXT", confidence: 0.9 },
  "description": { dataType: "TEXT", confidence: 0.9 },
  "note": { dataType: "TEXT", confidence: 0.9 },
  "notes": { dataType: "TEXT", confidence: 0.9 },
  "codice": { dataType: "TEXT", confidence: 0.8 },
  "code": { dataType: "TEXT", confidence: 0.8 },
  "cod_": { dataType: "TEXT", confidence: 0.75 },
  "id": { dataType: "TEXT", confidence: 0.7 },
  "waiter": { dataType: "TEXT", confidence: 0.9 },
  "cameriere": { dataType: "TEXT", confidence: 0.9 },
  "customer": { dataType: "TEXT", confidence: 0.9 },
  "cliente": { dataType: "TEXT", confidence: 0.9 },
  "category": { dataType: "TEXT", confidence: 0.9 },
  "categoria": { dataType: "TEXT", confidence: 0.9 },
  "flag": { dataType: "BOOLEAN", confidence: 0.85 },
  "attivo": { dataType: "BOOLEAN", confidence: 0.85 },
  "active": { dataType: "BOOLEAN", confidence: 0.85 },
  "enabled": { dataType: "BOOLEAN", confidence: 0.85 },
  "is_": { dataType: "BOOLEAN", confidence: 0.8 },
  "has_": { dataType: "BOOLEAN", confidence: 0.8 },
};

export function detectPatterns(columnName: string, values: any[]): { dataType: string; confidence: number; pattern?: string; anomalyCount?: number } {
  const cleanValues = values.filter(isCleanValue);
  const totalOriginal = values.length;
  const dirtyCount = totalOriginal - cleanValues.length;
  
  if (cleanValues.length === 0) {
    return { dataType: "TEXT", confidence: 0.5, anomalyCount: dirtyCount };
  }

  const stringValues = cleanValues.map(v => String(v).trim());
  const totalCount = stringValues.length;

  let dateCount = 0;
  let numericCount = 0;
  let integerOnlyCount = 0;
  let decimalCount = 0;
  let percentageCount = 0;
  let emailCount = 0;
  let booleanCount = 0;
  let textCount = 0;

  for (const val of stringValues) {
    const cleanedNumeric = cleanNumericValue(val);
    
    if (PATTERNS.DATE_DMY.test(val) || PATTERNS.DATE_YMD.test(val) || 
        PATTERNS.DATE_ISO.test(val) || PATTERNS.DATE_WORDS.test(val)) {
      dateCount++;
    } else if (PATTERNS.PERCENTAGE.test(val)) {
      percentageCount++;
      numericCount++;
    } else if (PATTERNS.EMAIL.test(val)) {
      emailCount++;
    } else if (PATTERNS.BOOLEAN_IT.test(val)) {
      booleanCount++;
    } else if (PATTERNS.DECIMAL.test(cleanedNumeric) || PATTERNS.DECIMAL_SIMPLE.test(cleanedNumeric)) {
      decimalCount++;
      numericCount++;
    } else if (PATTERNS.INTEGER.test(cleanedNumeric)) {
      integerOnlyCount++;
      numericCount++;
    } else if (PATTERNS.IMPORTO_EU.test(val) || PATTERNS.IMPORTO_SIMPLE.test(val)) {
      numericCount++;
      if (cleanedNumeric.includes(".") || cleanedNumeric.includes(",")) {
        decimalCount++;
      } else {
        integerOnlyCount++;
      }
    } else {
      textCount++;
    }
  }

  const results: { dataType: string; confidence: number; pattern?: string }[] = [];
  
  const numericRatio = numericCount / totalCount;
  const dateRatio = dateCount / totalCount;
  const emailRatio = emailCount / totalCount;
  const booleanRatio = booleanCount / totalCount;
  
  if (dateRatio >= 0.7) {
    results.push({ dataType: "DATE", confidence: dateRatio, pattern: "DATE" });
  }
  
  if (emailRatio >= 0.8) {
    results.push({ dataType: "TEXT", confidence: emailRatio, pattern: "EMAIL" });
  }
  
  if (booleanRatio >= 0.7) {
    results.push({ dataType: "BOOLEAN", confidence: booleanRatio, pattern: "BOOLEAN" });
  }
  
  if (numericRatio >= 0.7) {
    const hasDecimals = decimalCount > 0;
    const isAllIntegers = integerOnlyCount === numericCount && !hasDecimals;
    
    if (isAllIntegers && numericRatio >= 0.95) {
      results.push({ dataType: "INTEGER", confidence: numericRatio, pattern: "INTEGER" });
    } else {
      results.push({ dataType: "NUMERIC", confidence: numericRatio, pattern: hasDecimals ? "DECIMAL" : "NUMERIC" });
    }
  }

  const nameHint = getColumnNameHint(columnName);
  if (nameHint) {
    for (const result of results) {
      if (result.dataType === nameHint.dataType || 
          (result.dataType === "INTEGER" && nameHint.dataType === "NUMERIC") ||
          (result.dataType === "NUMERIC" && nameHint.dataType === "INTEGER")) {
        if (result.confidence >= 0.95) {
          result.confidence = Math.min(0.98, result.confidence + 0.02);
        }
      }
    }
    
    if (results.length === 0 && nameHint.confidence >= 0.85) {
      if ((nameHint.dataType === "NUMERIC" || nameHint.dataType === "INTEGER") && numericRatio >= 0.5) {
        console.log(`[COLUMN-DISCOVERY] Using name hint for "${columnName}": ${nameHint.dataType} (numericRatio: ${numericRatio.toFixed(2)})`);
        results.push({ dataType: "NUMERIC", confidence: Math.max(numericRatio, 0.75), pattern: "NAME_HINT" });
      } else if (nameHint.dataType === "DATE" && dateRatio >= 0.5) {
        results.push({ dataType: "DATE", confidence: Math.max(dateRatio, 0.75), pattern: "NAME_HINT" });
      } else if (nameHint.dataType === "BOOLEAN" && booleanRatio >= 0.5) {
        results.push({ dataType: "BOOLEAN", confidence: Math.max(booleanRatio, 0.75), pattern: "NAME_HINT" });
      }
    }
  }

  if (results.length > 0) {
    results.sort((a, b) => b.confidence - a.confidence);
    const best = results[0];
    return { 
      dataType: best.dataType, 
      confidence: best.confidence, 
      pattern: best.pattern,
      anomalyCount: dirtyCount 
    };
  }

  const textRatio = textCount / totalCount;
  const fallbackConfidence = textRatio >= 0.5 ? Math.min(0.75, 0.5 + textRatio * 0.25) : 0.6;
  return { dataType: "TEXT", confidence: fallbackConfidence, anomalyCount: dirtyCount };
}

function getColumnNameHint(columnName: string): { dataType: string; confidence: number } | null {
  const lowerName = columnName.toLowerCase();

  for (const [hint, result] of Object.entries(COLUMN_NAME_HINTS)) {
    if (lowerName.includes(hint) || lowerName.startsWith(hint)) {
      return result;
    }
  }

  return null;
}

function detectTemplate(filename: string, columns: string[]): string | null {
  const upperFilename = filename.toUpperCase();
  const lowerColumns = columns.map(c => c.toLowerCase());

  if (upperFilename.includes("DDTRIGHE") || upperFilename.includes("FATTUR")) {
    const ddtColumns = Object.keys(TEMPLATE_PATTERNS.DDTRIGHE.columns);
    const matches = lowerColumns.filter(c => ddtColumns.some(tc => c.includes(tc) || tc.includes(c)));
    if (matches.length >= 3) {
      return "DDTRIGHE";
    }
  }

  if (upperFilename.includes("INVENTAR") || upperFilename.includes("MAGAZZIN") || upperFilename.includes("STOCK")) {
    const invColumns = Object.keys(TEMPLATE_PATTERNS.INVENTARIO.columns);
    const matches = lowerColumns.filter(c => invColumns.some(tc => c.includes(tc) || tc.includes(c)));
    if (matches.length >= 3) {
      return "INVENTARIO";
    }
  }

  if (upperFilename.includes("CRM") || upperFilename.includes("LEAD") || upperFilename.includes("CONTATT")) {
    const crmColumns = Object.keys(TEMPLATE_PATTERNS.CRM.columns);
    const matches = lowerColumns.filter(c => crmColumns.some(tc => c.includes(tc) || tc.includes(c)));
    if (matches.length >= 3) {
      return "CRM";
    }
  }

  return null;
}

function sanitizeColumnName(name: string): string {
  return name
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
}

function generateDisplayName(originalName: string): string {
  const cleaned = originalName
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .toLowerCase();

  return cleaned
    .split(" ")
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

async function callGeminiForColumnDiscovery(
  columns: string[],
  sampleData: Record<string, any>[],
  filename: string
): Promise<Partial<ColumnDefinition>[]> {
  try {
    const geminiKeys = await getSuperAdminGeminiKeys();
    if (!geminiKeys?.keys?.length) {
      console.warn("[COLUMN-DISCOVERY] No Gemini API keys available for AI fallback");
      return [];
    }

    const apiKey = geminiKeys.keys[0];
    const genAI = new GoogleGenAI({ apiKey });

    const samplePreview = sampleData.slice(0, 5).map(row => {
      const preview: Record<string, any> = {};
      for (const col of columns) {
        preview[col] = row[col];
      }
      return preview;
    });

    const prompt = `Analizza le seguenti colonne di un file dati e determina il tipo di dati più appropriato per ciascuna.

File: ${filename}
Colonne: ${columns.join(", ")}

Campione dati (prime 5 righe):
${JSON.stringify(samplePreview, null, 2)}

Per ogni colonna, rispondi in formato JSON con questo schema:
{
  "columns": [
    {
      "originalName": "nome_colonna",
      "suggestedName": "nome_snake_case_sanitizzato",
      "displayName": "Nome Leggibile",
      "dataType": "TEXT|NUMERIC|INTEGER|DATE|BOOLEAN",
      "description": "Breve descrizione del contenuto",
      "confidence": 0.85
    }
  ]
}

IMPORTANTE:
- dataType deve essere uno tra: TEXT, NUMERIC (per importi/decimali), INTEGER, DATE, BOOLEAN
- suggestedName deve essere in snake_case, solo caratteri alfanumerici e underscore
- confidence tra 0 e 1 (quanto sei sicuro del tipo)
- Rispondi SOLO con il JSON, nessun altro testo`;

    const response = await genAI.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    });

    const text = response.text || "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return parsed.columns || [];
    }

    return [];
  } catch (error) {
    console.error("[COLUMN-DISCOVERY] Gemini AI call failed:", error);
    return [];
  }
}

async function lookupSavedMappings(consultantId: string, columnNames: string[]): Promise<Map<string, ColumnDefinition>> {
  const mappingsMap = new Map<string, ColumnDefinition>();

  try {
    for (const colName of columnNames) {
      const [mapping] = await db
        .select()
        .from(consultantColumnMappings)
        .where(
          and(
            eq(consultantColumnMappings.consultantId, consultantId),
            eq(consultantColumnMappings.originalColumn, colName)
          )
        )
        .limit(1);

      if (mapping && (mapping.usageCount ?? 0) >= 1) {
        mappingsMap.set(colName, {
          originalName: colName,
          suggestedName: mapping.mappedColumn,
          displayName: generateDisplayName(mapping.mappedColumn),
          dataType: mapping.mappedType as ColumnDefinition["dataType"],
          confidence: 0.95,
          sampleValues: [],
        });
      }
    }
  } catch (error) {
    console.warn("[COLUMN-DISCOVERY] Error looking up saved mappings:", error);
  }

  return mappingsMap;
}

export async function discoverColumns(
  sample: DistributedSample,
  filename: string,
  consultantId?: string
): Promise<DiscoveryResult> {
  const columns: ColumnDefinition[] = [];
  let totalConfidence = 0;
  let aiUsed = false;

  const templateDetected = detectTemplate(filename, sample.columns);

  let savedMappings = new Map<string, ColumnDefinition>();
  if (consultantId) {
    savedMappings = await lookupSavedMappings(consultantId, sample.columns);
  }

  const lowConfidenceColumns: string[] = [];

  for (const colName of sample.columns) {
    if (savedMappings.has(colName)) {
      const saved = savedMappings.get(colName)!;
      const values = sample.rows.map(r => r[colName]);
      saved.sampleValues = values.filter(v => v !== null && v !== undefined).slice(0, 10);
      columns.push(saved);
      totalConfidence += saved.confidence;
      continue;
    }

    const values = sample.rows.map(r => r[colName]);
    const nonNullValues = values.filter(v => v !== null && v !== undefined && v !== "");

    let dataType: ColumnDefinition["dataType"] = "TEXT";
    let confidence = 0.5;
    let patternMatched: string | undefined;

    if (templateDetected) {
      const templateCols = TEMPLATE_PATTERNS[templateDetected]?.columns || {};
      const matchedTemplateCol = Object.entries(templateCols).find(([key]) =>
        colName.toLowerCase().includes(key) || key.includes(colName.toLowerCase())
      );

      if (matchedTemplateCol) {
        dataType = matchedTemplateCol[1].dataType as ColumnDefinition["dataType"];
        confidence = 0.9;
        patternMatched = `TEMPLATE_${templateDetected}`;
      }
    }

    if (!patternMatched) {
      const nameHint = getColumnNameHint(colName);
      if (nameHint) {
        dataType = nameHint.dataType as ColumnDefinition["dataType"];
        confidence = nameHint.confidence;
        patternMatched = "NAME_HINT";
      }
    }

    if (!patternMatched || confidence < 0.8) {
      const patternResult = detectPatterns(colName, values);
      if (patternResult.confidence > confidence) {
        dataType = patternResult.dataType as ColumnDefinition["dataType"];
        confidence = patternResult.confidence;
        patternMatched = patternResult.pattern;
      }
    }

    if (confidence < 0.85) {
      lowConfidenceColumns.push(colName);
    }

    columns.push({
      originalName: colName,
      suggestedName: sanitizeColumnName(colName),
      displayName: generateDisplayName(colName),
      dataType,
      confidence,
      patternMatched,
      sampleValues: nonNullValues.slice(0, 10),
    });

    totalConfidence += confidence;
  }

  if (lowConfidenceColumns.length > 0 && lowConfidenceColumns.length <= sample.columns.length * 0.5) {
    const aiResults = await callGeminiForColumnDiscovery(lowConfidenceColumns, sample.rows, filename);
    if (aiResults.length > 0) {
      aiUsed = true;

      for (const aiCol of aiResults) {
        const existingIdx = columns.findIndex(c => c.originalName === aiCol.originalName);
        if (existingIdx >= 0 && aiCol.confidence && aiCol.confidence > columns[existingIdx].confidence) {
          columns[existingIdx] = {
            ...columns[existingIdx],
            suggestedName: aiCol.suggestedName || columns[existingIdx].suggestedName,
            displayName: aiCol.displayName || columns[existingIdx].displayName,
            dataType: (aiCol.dataType as ColumnDefinition["dataType"]) || columns[existingIdx].dataType,
            description: aiCol.description,
            confidence: aiCol.confidence,
            patternMatched: "AI_GEMINI",
          };

          totalConfidence = totalConfidence - columns[existingIdx].confidence + aiCol.confidence;
        }
      }
    }
  }

  const overallConfidence = columns.length > 0 ? totalConfidence / columns.length : 0;
  const autoConfirmed = overallConfidence >= 0.85;

  return {
    columns,
    overallConfidence,
    autoConfirmed,
    templateDetected: templateDetected || undefined,
    aiUsed,
  };
}

export async function saveColumnMapping(
  consultantId: string,
  originalColumn: string,
  mappedColumn: string,
  mappedType: string
): Promise<void> {
  try {
    const existing = await db
      .select()
      .from(consultantColumnMappings)
      .where(
        and(
          eq(consultantColumnMappings.consultantId, consultantId),
          eq(consultantColumnMappings.originalColumn, originalColumn.toLowerCase())
        )
      )
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(consultantColumnMappings)
        .set({
          mappedColumn,
          mappedType: mappedType as "TEXT" | "NUMERIC" | "INTEGER" | "DATE" | "BOOLEAN",
          usageCount: sql`${consultantColumnMappings.usageCount} + 1`,
          updatedAt: new Date(),
        })
        .where(eq(consultantColumnMappings.id, existing[0].id));
    } else {
      await db.insert(consultantColumnMappings).values({
        consultantId,
        originalColumn: originalColumn.toLowerCase(),
        mappedColumn,
        mappedType: mappedType as "TEXT" | "NUMERIC" | "INTEGER" | "DATE" | "BOOLEAN",
        usageCount: 1,
      });
    }

    console.log(`[COLUMN-DISCOVERY] Saved mapping: ${originalColumn} -> ${mappedColumn} (${mappedType})`);
  } catch (error) {
    console.error("[COLUMN-DISCOVERY] Error saving column mapping:", error);
  }
}
