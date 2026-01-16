/**
 * Code Execution File Manager
 * 
 * Uploads CSV files to Google's File API for use with Code Execution.
 * Files uploaded via File API don't count as prompt tokens, solving the 1M token limit issue.
 * Files are auto-deleted after 48 hours by Google.
 */

import { GoogleGenAI, createPartFromUri } from "@google/genai";
import fs from "fs/promises";
import path from "path";
import os from "os";
import crypto from "crypto";
import { TabularDocument, structuredDataToCsv } from "./code-execution-helper";

export interface FileDataPart {
  fileData: {
    fileUri: string;
    mimeType: string;
  };
  fileName: string;
  sheetName: string;
  rowCount: number;
  headers: string[];
}

export interface UploadResult {
  success: boolean;
  parts: FileDataPart[];
  errors: string[];
  totalSizeBytes: number;
}

const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024; // 20MB per file (Google limit)
const MAX_CUMULATIVE_SIZE_BYTES = 100 * 1024 * 1024; // 100MB total (reasonable limit)

/**
 * Upload tabular documents as CSV files to Google File API
 * Returns fileData references that can be used in Gemini requests without consuming tokens
 */
export async function uploadTabularDataForCodeExecution(
  docs: TabularDocument[],
  apiKey: string
): Promise<UploadResult> {
  const result: UploadResult = {
    success: false,
    parts: [],
    errors: [],
    totalSizeBytes: 0,
  };

  if (!apiKey) {
    result.errors.push("No API key provided");
    return result;
  }

  if (docs.length === 0) {
    result.errors.push("No documents to upload");
    return result;
  }

  const ai = new GoogleGenAI({ apiKey });
  const tempFiles: string[] = [];

  try {
    for (const doc of docs) {
      const csvMap = structuredDataToCsv(doc);

      for (const [sheetName, csvContent] of csvMap) {
        const sizeBytes = Buffer.byteLength(csvContent, "utf-8");

        // Skip if individual file is too large
        if (sizeBytes > MAX_FILE_SIZE_BYTES) {
          console.log(
            `⚠️ [FILE UPLOAD] Skipping sheet "${sheetName}" - too large (${(sizeBytes / 1024 / 1024).toFixed(1)}MB > 20MB limit)`
          );
          result.errors.push(
            `Sheet "${sheetName}" exceeds 20MB limit (${(sizeBytes / 1024 / 1024).toFixed(1)}MB)`
          );
          continue;
        }

        // Skip if cumulative limit exceeded
        if (result.totalSizeBytes + sizeBytes > MAX_CUMULATIVE_SIZE_BYTES) {
          console.log(
            `⚠️ [FILE UPLOAD] Skipping sheet "${sheetName}" - cumulative limit exceeded`
          );
          result.errors.push(
            `Sheet "${sheetName}" would exceed cumulative 100MB limit`
          );
          continue;
        }

        // Generate unique filename
        const cleanDocName = doc.fileName
          .replace(/\.[^/.]+$/, "")
          .replace(/[^a-zA-Z0-9_-]/g, "_")
          .toLowerCase();
        const cleanSheetName = sheetName
          .replace(/[^a-zA-Z0-9_-]/g, "_")
          .toLowerCase();
        const uniqueId = crypto.randomBytes(4).toString("hex");
        const fileName = `${cleanDocName}_${cleanSheetName}_${uniqueId}.csv`;

        // Write to temp file
        const tempPath = path.join(os.tmpdir(), fileName);
        await fs.writeFile(tempPath, csvContent, "utf-8");
        tempFiles.push(tempPath);

        try {
          console.log(
            `📤 [FILE UPLOAD] Uploading "${fileName}" (${(sizeBytes / 1024).toFixed(1)}KB)...`
          );

          // Upload to Google File API
          // The @google/genai SDK returns the file object directly
          const uploadedFile = await ai.files.upload({
            file: tempPath,
            config: {
              mimeType: "text/csv",
              displayName: fileName,
            },
          });

          // Check both possible response structures
          const fileUri = uploadedFile.uri;
          const fileMimeType = uploadedFile.mimeType || "text/csv";
          
          if (!fileUri) {
            console.error(`❌ [FILE UPLOAD] No URI in response:`, JSON.stringify(uploadedFile, null, 2));
            throw new Error("Upload succeeded but no URI returned");
          }

          const sheet = doc.structuredData.sheets.find(
            (s) => s.name === sheetName
          );

          result.parts.push({
            fileData: {
              fileUri: fileUri,
              mimeType: fileMimeType,
            },
            fileName,
            sheetName,
            rowCount: sheet?.rowCount || csvContent.split("\n").length - 1,
            headers: sheet?.headers || [],
          });

          result.totalSizeBytes += sizeBytes;

          console.log(
            `✅ [FILE UPLOAD] Uploaded "${fileName}": ${csvContent.split("\n").length} rows`
          );
          console.log(`   📎 URI: ${fileUri.substring(0, 70)}...`);
          console.log(`   📄 Name: ${uploadedFile.name || 'N/A'}`);
        } catch (uploadError: any) {
          console.error(
            `❌ [FILE UPLOAD] Failed to upload "${fileName}":`,
            uploadError.message
          );
          console.error(`   Stack:`, uploadError.stack?.split('\n').slice(0, 3).join('\n'));
          result.errors.push(`Failed to upload "${fileName}": ${uploadError.message}`);
        }
      }
    }

    result.success = result.parts.length > 0;

    if (result.parts.length > 0) {
      console.log(
        `📦 [FILE UPLOAD] Total: ${result.parts.length} file(s), ${(result.totalSizeBytes / 1024 / 1024).toFixed(2)}MB`
      );
    }
  } finally {
    // Cleanup temp files
    for (const tempPath of tempFiles) {
      try {
        await fs.unlink(tempPath);
      } catch {
        // Ignore cleanup errors
      }
    }
  }

  return result;
}

/**
 * Build instruction for Code Execution when files are uploaded via File API
 * Files are mounted in the sandbox at /mnt/data/<displayName>
 */
export function buildFileApiCodeExecutionInstruction(
  parts: FileDataPart[]
): string {
  if (parts.length === 0) return "";

  const fileDescriptions: string[] = [];
  const readExamples: string[] = [];
  
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    const headerPreview = part.headers.slice(0, 10).join(", ");
    const moreHeaders =
      part.headers.length > 10 ? ` (+${part.headers.length - 10} altre)` : "";
    const sandboxPath = `/mnt/data/${part.fileName}`;
    
    fileDescriptions.push(
      `📄 FILE ${i + 1}: "${part.fileName}" (${part.rowCount} righe)\n` +
        `   📂 PATH: ${sandboxPath}\n` +
        `   📝 Colonne: ${headerPreview}${moreHeaders}`
    );
    
    // Generate read example for each file
    const dfName = i === 0 ? 'df' : `df${i + 1}`;
    readExamples.push(`${dfName} = pd.read_csv("${sandboxPath}")`);
  }

  return `
═══════════════════════════════════════════════════════════════════
🐍 FILE CSV CARICATI PER CODE EXECUTION (File API)
═══════════════════════════════════════════════════════════════════

Ti ho caricato ${parts.length} file CSV tramite File API. I file sono montati
nella sandbox di Code Execution in /mnt/data/. Ecco cosa contengono:

${fileDescriptions.join("\n\n")}

📌 ISTRUZIONI OBBLIGATORIE PER LEGGERE I FILE:
I file sono montati in /mnt/data/. Usa ESATTAMENTE questi path:

\`\`\`python
import pandas as pd

# Leggi i file dai path esatti
${readExamples.join("\n")}

# Ora puoi fare calcoli
print(df.head())  # Verifica i dati caricati
totale = df['nome_colonna'].sum()
media = df['nome_colonna'].mean()
print(f"Totale: {totale}, Media: {media}")
\`\`\`

⚠️ REGOLE FONDAMENTALI:
- USA ESATTAMENTE i path /mnt/data/<filename> indicati sopra
- NON inventare numeri - DEVI usare Code Execution
- Mostra sempre il codice Python che usi per i calcoli
- Se ricevi FileNotFoundError, verifica il path esatto

═══════════════════════════════════════════════════════════════════
`;
}
