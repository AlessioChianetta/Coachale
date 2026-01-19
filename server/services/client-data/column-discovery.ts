import { db } from "../../db";
import { consultantColumnMappings } from "../../../shared/schema";
import { eq, and, ilike } from "drizzle-orm";
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
  DATE_DMY: /^\d{2}[-\/]\d{2}[-\/]\d{4}$/,
  DATE_YMD: /^\d{4}[-\/]\d{2}[-\/]\d{2}$/,
  DATE_ISO: /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/,
  IMPORTO_EU: /^-?\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?€?$/,
  IMPORTO_SIMPLE: /^-?€?\s?\d+(?:[.,]\d{1,2})?$/,
  PERCENTAGE: /^-?\d+(?:[.,]\d+)?%$/,
  INTEGER: /^-?\d+$/,
  DECIMAL: /^-?\d+[.,]\d+$/,
  PHONE: /^(?:\+?\d{1,3}[-.\s]?)?\d{6,}$/,
  EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  BOOLEAN_IT: /^(si|no|vero|falso|true|false|1|0)$/i,
  COD_FISCALE: /^[A-Z]{6}\d{2}[A-Z]\d{2}[A-Z]\d{3}[A-Z]$/i,
  PARTITA_IVA: /^\d{11}$/,
};

const COLUMN_NAME_HINTS: Record<string, { dataType: string; confidence: number }> = {
  "data": { dataType: "DATE", confidence: 0.9 },
  "date": { dataType: "DATE", confidence: 0.9 },
  "dt_": { dataType: "DATE", confidence: 0.85 },
  "importo": { dataType: "NUMERIC", confidence: 0.9 },
  "prezzo": { dataType: "NUMERIC", confidence: 0.9 },
  "price": { dataType: "NUMERIC", confidence: 0.9 },
  "amount": { dataType: "NUMERIC", confidence: 0.9 },
  "totale": { dataType: "NUMERIC", confidence: 0.85 },
  "total": { dataType: "NUMERIC", confidence: 0.85 },
  "imp_": { dataType: "NUMERIC", confidence: 0.85 },
  "costo": { dataType: "NUMERIC", confidence: 0.85 },
  "cost": { dataType: "NUMERIC", confidence: 0.85 },
  "qta": { dataType: "INTEGER", confidence: 0.85 },
  "qty": { dataType: "INTEGER", confidence: 0.85 },
  "quantita": { dataType: "INTEGER", confidence: 0.85 },
  "quantity": { dataType: "INTEGER", confidence: 0.85 },
  "count": { dataType: "INTEGER", confidence: 0.8 },
  "numero": { dataType: "INTEGER", confidence: 0.7 },
  "perc": { dataType: "NUMERIC", confidence: 0.8 },
  "percent": { dataType: "NUMERIC", confidence: 0.8 },
  "iva": { dataType: "NUMERIC", confidence: 0.85 },
  "email": { dataType: "TEXT", confidence: 0.95 },
  "telefono": { dataType: "TEXT", confidence: 0.9 },
  "phone": { dataType: "TEXT", confidence: 0.9 },
  "tel": { dataType: "TEXT", confidence: 0.85 },
  "nome": { dataType: "TEXT", confidence: 0.9 },
  "name": { dataType: "TEXT", confidence: 0.9 },
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
  "flag": { dataType: "BOOLEAN", confidence: 0.8 },
  "attivo": { dataType: "BOOLEAN", confidence: 0.8 },
  "active": { dataType: "BOOLEAN", confidence: 0.8 },
  "enabled": { dataType: "BOOLEAN", confidence: 0.8 },
};

export function detectPatterns(columnName: string, values: any[]): { dataType: string; confidence: number; pattern?: string } {
  const nonNullValues = values.filter(v => v !== null && v !== undefined && v !== "");
  if (nonNullValues.length === 0) {
    return { dataType: "TEXT", confidence: 0.5 };
  }

  const stringValues = nonNullValues.map(v => String(v).trim());
  const totalCount = stringValues.length;

  let dateCount = 0;
  let importoCount = 0;
  let percentageCount = 0;
  let integerCount = 0;
  let decimalCount = 0;
  let emailCount = 0;
  let phoneCount = 0;
  let booleanCount = 0;

  for (const val of stringValues) {
    if (PATTERNS.DATE_DMY.test(val) || PATTERNS.DATE_YMD.test(val) || PATTERNS.DATE_ISO.test(val)) {
      dateCount++;
    } else if (PATTERNS.PERCENTAGE.test(val)) {
      percentageCount++;
    } else if (PATTERNS.EMAIL.test(val)) {
      emailCount++;
    } else if (PATTERNS.PHONE.test(val)) {
      phoneCount++;
    } else if (PATTERNS.BOOLEAN_IT.test(val)) {
      booleanCount++;
    } else if (PATTERNS.IMPORTO_EU.test(val) || PATTERNS.IMPORTO_SIMPLE.test(val)) {
      if (val.includes(",") && !val.includes(".")) {
        importoCount++;
      } else if (PATTERNS.DECIMAL.test(val.replace("€", "").trim())) {
        importoCount++;
      } else if (PATTERNS.INTEGER.test(val.replace("€", "").trim())) {
        integerCount++;
      }
    } else if (PATTERNS.DECIMAL.test(val)) {
      decimalCount++;
    } else if (PATTERNS.INTEGER.test(val)) {
      integerCount++;
    }
  }

  const results: { dataType: string; confidence: number; pattern?: string }[] = [];

  if (dateCount > 0) {
    results.push({ dataType: "DATE", confidence: dateCount / totalCount, pattern: "DATE" });
  }
  if (percentageCount > 0) {
    results.push({ dataType: "NUMERIC", confidence: percentageCount / totalCount, pattern: "PERCENTAGE" });
  }
  if (emailCount > 0) {
    results.push({ dataType: "TEXT", confidence: emailCount / totalCount, pattern: "EMAIL" });
  }
  if (booleanCount > 0) {
    results.push({ dataType: "BOOLEAN", confidence: booleanCount / totalCount, pattern: "BOOLEAN" });
  }
  if (importoCount > 0) {
    results.push({ dataType: "NUMERIC", confidence: importoCount / totalCount, pattern: "IMPORTO" });
  }
  if (decimalCount > 0) {
    results.push({ dataType: "NUMERIC", confidence: decimalCount / totalCount, pattern: "DECIMAL" });
  }
  if (integerCount > 0) {
    const intConfidence = integerCount / totalCount;
    if (intConfidence > 0.8) {
      results.push({ dataType: "INTEGER", confidence: intConfidence, pattern: "INTEGER" });
    } else {
      results.push({ dataType: "NUMERIC", confidence: intConfidence, pattern: "NUMERIC" });
    }
  }

  if (results.length > 0) {
    results.sort((a, b) => b.confidence - a.confidence);
    return results[0];
  }

  return { dataType: "TEXT", confidence: 0.7 };
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
  sourcePattern: string,
  targetColumn: string,
  dataType: string,
  confidence: number
): Promise<void> {
  try {
    const existing = await db
      .select()
      .from(consultantColumnMappings)
      .where(
        and(
          eq(consultantColumnMappings.consultantId, consultantId),
          eq(consultantColumnMappings.sourcePattern, sourcePattern.toLowerCase())
        )
      )
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(consultantColumnMappings)
        .set({
          targetColumn,
          dataType,
          confidence,
          updatedAt: new Date(),
        })
        .where(eq(consultantColumnMappings.id, existing[0].id));
    } else {
      await db.insert(consultantColumnMappings).values({
        consultantId,
        sourcePattern: sourcePattern.toLowerCase(),
        targetColumn,
        dataType,
        confidence,
      });
    }

    console.log(`[COLUMN-DISCOVERY] Saved mapping: ${sourcePattern} -> ${targetColumn} (${dataType})`);
  } catch (error) {
    console.error("[COLUMN-DISCOVERY] Error saving column mapping:", error);
  }
}
