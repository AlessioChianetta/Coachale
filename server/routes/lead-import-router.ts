import { Router } from "express";
import { authenticateToken, requireRole, type AuthRequest } from "../middleware/auth";
import { db } from "../db";
import * as schema from "@shared/schema";
import { eq, and, desc } from "drizzle-orm";
import multer from "multer";
import * as XLSX from "xlsx";
import Papa from "papaparse";
import crypto from "crypto";
import path from "path";
import { randomUUID } from "crypto";
import { storage } from "../storage";

const router = Router();

const leadUploadStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const uniqueName = `lead-import-${randomUUID()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const leadUpload = multer({
  storage: leadUploadStorage,
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
  fileFilter: (req, file, cb) => {
    const allowedExtensions = /\.(xlsx|xls|csv)$/i;
    const allowedMimeTypes = [
      'text/csv',
      'application/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ];
    
    const extname = allowedExtensions.test(file.originalname);
    const mimetype = allowedMimeTypes.includes(file.mimetype);
    
    if (mimetype || extname) {
      return cb(null, true);
    }
    cb(new Error('Solo file Excel (.xlsx, .xls) o CSV (.csv) sono supportati'));
  }
});

const COLUMN_SYNONYMS: Record<string, string[]> = {
  firstName: ["nome", "first_name", "firstname", "name", "nome_cliente", "first name"],
  lastName: ["cognome", "last_name", "lastname", "surname", "last name"],
  phoneNumber: ["telefono", "phone", "cellulare", "mobile", "whatsapp", "numero", "phone_number", "phonenumber", "tel"],
  email: ["email", "e-mail", "mail", "posta", "e_mail"],
  company: ["azienda", "company", "società", "ditta", "societa", "impresa"],
  notes: ["note", "notes", "commenti", "osservazioni", "commento", "descrizione"],
};

function autoMapColumns(headers: string[]): Record<string, string> {
  const mappings: Record<string, string> = {};
  
  for (const header of headers) {
    const normalizedHeader = header.toLowerCase().trim().replace(/[_\-\s]+/g, '');
    
    for (const [field, synonyms] of Object.entries(COLUMN_SYNONYMS)) {
      for (const synonym of synonyms) {
        const normalizedSynonym = synonym.toLowerCase().replace(/[_\-\s]+/g, '');
        if (normalizedHeader === normalizedSynonym || normalizedHeader.includes(normalizedSynonym)) {
          mappings[field] = header;
          break;
        }
      }
      if (mappings[field]) break;
    }
  }
  
  return mappings;
}

function generateRowHash(phoneNumber: string, firstName: string, lastName: string): string {
  const normalizedPhone = (phoneNumber || '').toLowerCase().trim().replace(/[\s\-\(\)]/g, '');
  const normalizedFirst = (firstName || '').toLowerCase().trim();
  const normalizedLast = (lastName || '').toLowerCase().trim();
  
  const data = `${normalizedPhone}|${normalizedFirst}|${normalizedLast}`;
  return crypto.createHash('sha256').update(data).digest('hex');
}

function normalizePhoneNumber(phone: string): string {
  if (!phone) return '';
  
  let phoneNumber = phone.trim().replace(/[\s\-\(\)]/g, '');
  
  if (phoneNumber.startsWith('39') && !phoneNumber.startsWith('+39')) {
    phoneNumber = '+' + phoneNumber;
  } else if (!phoneNumber.startsWith('+') && !phoneNumber.startsWith('39')) {
    phoneNumber = '+39' + phoneNumber;
  }
  
  return phoneNumber;
}

function parseExcelFile(filePath: string): { headers: string[]; rows: Record<string, any>[] } {
  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  
  const jsonData = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { header: 1 });
  
  if (jsonData.length === 0) {
    return { headers: [], rows: [] };
  }
  
  const headers = (jsonData[0] as string[]).map(h => String(h || '').trim());
  const rows: Record<string, any>[] = [];
  
  for (let i = 1; i < jsonData.length; i++) {
    const rowData = jsonData[i] as any[];
    if (!rowData || rowData.every(cell => cell === null || cell === undefined || cell === '')) continue;
    
    const row: Record<string, any> = {};
    headers.forEach((header, idx) => {
      row[header] = rowData[idx] !== undefined ? String(rowData[idx]) : '';
    });
    rows.push(row);
  }
  
  return { headers, rows };
}

function parseCsvData(csvContent: string): { headers: string[]; rows: Record<string, any>[] } {
  const result = Papa.parse<Record<string, any>>(csvContent, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });
  
  const headers = result.meta.fields || [];
  return { headers, rows: result.data };
}

router.post(
  "/consultant/agents/:agentId/leads/upload",
  authenticateToken,
  requireRole("consultant"),
  leadUpload.single('file'),
  async (req: AuthRequest, res) => {
    try {
      const consultantId = req.user!.id;
      const agentId = req.params.agentId;
      
      const agentConfig = await storage.getConsultantWhatsappConfig(consultantId, agentId);
      if (!agentConfig) {
        return res.status(404).json({
          success: false,
          error: "Agente non trovato o accesso negato"
        });
      }
      
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: "Nessun file caricato"
        });
      }
      
      const filePath = req.file.path;
      const fileExt = path.extname(req.file.originalname).toLowerCase();
      
      let headers: string[] = [];
      let rows: Record<string, any>[] = [];
      
      if (fileExt === '.csv') {
        const fs = await import('fs');
        const csvContent = fs.readFileSync(filePath, 'utf-8');
        const parsed = parseCsvData(csvContent);
        headers = parsed.headers;
        rows = parsed.rows;
      } else {
        const parsed = parseExcelFile(filePath);
        headers = parsed.headers;
        rows = parsed.rows;
      }
      
      if (headers.length === 0) {
        return res.status(400).json({
          success: false,
          error: "Il file non contiene intestazioni valide"
        });
      }
      
      const suggestedMappings = autoMapColumns(headers);
      const previewRows = rows.slice(0, 5);
      
      res.json({
        success: true,
        data: {
          columns: headers,
          previewRows,
          totalRows: rows.length,
          suggestedMappings,
          originalFilename: req.file.originalname,
          uploadedFilePath: filePath,
        }
      });
    } catch (error: any) {
      console.error("❌ [LEAD IMPORT] Error uploading file:", error);
      res.status(500).json({
        success: false,
        error: error.message || "Errore durante il caricamento del file"
      });
    }
  }
);

router.post(
  "/consultant/agents/:agentId/leads/preview-sheet",
  authenticateToken,
  requireRole("consultant"),
  async (req: AuthRequest, res) => {
    try {
      const consultantId = req.user!.id;
      const agentId = req.params.agentId;
      
      const agentConfig = await storage.getConsultantWhatsappConfig(consultantId, agentId);
      if (!agentConfig) {
        return res.status(404).json({
          success: false,
          error: "Agente non trovato o accesso negato"
        });
      }
      
      const { sheetUrl } = req.body;
      
      if (!sheetUrl) {
        return res.status(400).json({
          success: false,
          error: "URL Google Sheets richiesto"
        });
      }
      
      const sheetIdMatch = sheetUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
      if (!sheetIdMatch) {
        return res.status(400).json({
          success: false,
          error: "URL Google Sheets non valido"
        });
      }
      
      const sheetId = sheetIdMatch[1];
      const csvExportUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv`;
      
      const response = await fetch(csvExportUrl);
      
      if (!response.ok) {
        return res.status(400).json({
          success: false,
          error: "Impossibile accedere al foglio. Verifica che sia condiviso pubblicamente."
        });
      }
      
      const csvContent = await response.text();
      const { headers, rows } = parseCsvData(csvContent);
      
      if (headers.length === 0) {
        return res.status(400).json({
          success: false,
          error: "Il foglio non contiene intestazioni valide"
        });
      }
      
      const suggestedMappings = autoMapColumns(headers);
      const previewRows = rows.slice(0, 5);
      
      res.json({
        success: true,
        data: {
          columns: headers,
          previewRows,
          totalRows: rows.length,
          suggestedMappings,
          googleSheetUrl: sheetUrl,
        }
      });
    } catch (error: any) {
      console.error("❌ [LEAD IMPORT] Error previewing Google Sheet:", error);
      res.status(500).json({
        success: false,
        error: error.message || "Errore durante la preview del foglio Google"
      });
    }
  }
);

router.post(
  "/consultant/agents/:agentId/leads/import",
  authenticateToken,
  requireRole("consultant"),
  async (req: AuthRequest, res) => {
    try {
      const consultantId = req.user!.id;
      const agentId = req.params.agentId;
      
      const agentConfig = await storage.getConsultantWhatsappConfig(consultantId, agentId);
      if (!agentConfig) {
        return res.status(404).json({
          success: false,
          error: "Agente non trovato o accesso negato"
        });
      }
      
      const {
        jobName,
        sourceType,
        googleSheetUrl,
        uploadedFilePath,
        columnMappings,
        settings = {},
      } = req.body;
      
      if (!columnMappings || !columnMappings.phoneNumber) {
        return res.status(400).json({
          success: false,
          error: "Il mapping della colonna telefono è obbligatorio"
        });
      }
      
      // Read rows from file source instead of expecting them in request body
      let rows: Record<string, any>[] = [];
      
      if (uploadedFilePath) {
        // Re-read the uploaded file
        const fs = await import('fs');
        if (!fs.existsSync(uploadedFilePath)) {
          return res.status(400).json({
            success: false,
            error: "File caricato non trovato. Riprova il caricamento."
          });
        }
        
        const fileExt = path.extname(uploadedFilePath).toLowerCase();
        if (fileExt === '.csv') {
          const csvContent = fs.readFileSync(uploadedFilePath, 'utf-8');
          const parsed = parseCsvData(csvContent);
          rows = parsed.rows;
        } else {
          const parsed = parseExcelFile(uploadedFilePath);
          rows = parsed.rows;
        }
      } else if (googleSheetUrl) {
        // Re-fetch Google Sheets data
        const sheetIdMatch = googleSheetUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
        if (!sheetIdMatch) {
          return res.status(400).json({
            success: false,
            error: "URL Google Sheets non valido"
          });
        }
        
        const sheetId = sheetIdMatch[1];
        const csvExportUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv`;
        
        const response = await fetch(csvExportUrl);
        if (!response.ok) {
          return res.status(400).json({
            success: false,
            error: "Impossibile accedere al foglio Google Sheets."
          });
        }
        
        const csvContent = await response.text();
        const parsed = parseCsvData(csvContent);
        rows = parsed.rows;
      } else {
        return res.status(400).json({
          success: false,
          error: "Nessuna fonte dati specificata (file o Google Sheets)"
        });
      }
      
      if (rows.length === 0) {
        return res.status(400).json({
          success: false,
          error: "Nessuna riga da importare"
        });
      }
      
      console.log(`📥 [LEAD IMPORT] Processing ${rows.length} rows from ${uploadedFilePath ? 'file' : 'Google Sheets'}`)
      
      const [importJob] = await db.insert(schema.leadImportJobs).values({
        consultantId,
        agentConfigId: agentId,
        jobName: jobName || `Import ${new Date().toLocaleDateString('it-IT')}`,
        sourceType: sourceType || 'excel',
        googleSheetUrl: googleSheetUrl || null,
        columnMappings,
        settings,
      }).returning();
      
      const [importRun] = await db.insert(schema.leadImportRuns).values({
        jobId: importJob.id,
        runStatus: 'running',
        startedAt: new Date(),
        originalFilename: uploadedFilePath ? path.basename(uploadedFilePath) : null,
      }).returning();
      
      const stats = {
        imported: 0,
        skipped: 0,
        duplicates: 0,
        errors: 0,
      };
      const errorDetails: Array<{ row: number; field?: string; message: string }> = [];
      
      const skipDuplicates = settings.skipDuplicates !== false;
      const defaultContactFrequency = settings.defaultContactFrequency || 7;
      const campaignId = settings.campaignId || null;
      
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(10, 0, 0, 0);
      
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const rowNumber = i + 1;
        
        try {
          const firstName = row[columnMappings.firstName] || '';
          const lastName = row[columnMappings.lastName] || '';
          const rawPhone = row[columnMappings.phoneNumber] || '';
          const email = columnMappings.email ? row[columnMappings.email] || null : null;
          const company = columnMappings.company ? row[columnMappings.company] || null : null;
          const notes = columnMappings.notes ? row[columnMappings.notes] || null : null;
          
          if (!rawPhone) {
            stats.skipped++;
            errorDetails.push({ row: rowNumber, field: 'phoneNumber', message: 'Numero di telefono mancante' });
            continue;
          }
          
          const phoneNumber = normalizePhoneNumber(rawPhone);
          
          if (!/^\+\d{1,15}$/.test(phoneNumber)) {
            stats.skipped++;
            errorDetails.push({ row: rowNumber, field: 'phoneNumber', message: 'Formato telefono non valido' });
            continue;
          }
          
          const sourceRowHash = generateRowHash(phoneNumber, firstName, lastName);
          
          if (skipDuplicates) {
            const existingLead = await storage.getProactiveLeadByPhone(consultantId, phoneNumber);
            if (existingLead) {
              stats.duplicates++;
              continue;
            }
          }
          
          const leadInfo: any = {};
          if (notes) {
            leadInfo.note = notes;
          }
          
          const leadData: any = {
            consultantId,
            agentConfigId: agentId,
            firstName: firstName || 'Lead',
            lastName: lastName || '',
            phoneNumber,
            contactSchedule: new Date(tomorrow.getTime() + (i * 5 * 60 * 1000)),
            contactFrequency: defaultContactFrequency,
            status: 'pending',
            importJobId: importJob.id,
            sourceRowHash,
            importedAt: new Date(),
          };
          
          if (campaignId) {
            leadData.campaignId = campaignId;
          }
          
          if (Object.keys(leadInfo).length > 0) {
            leadData.leadInfo = leadInfo;
          }
          
          if (email || company) {
            leadData.metadata = {
              ...(email && { email }),
              ...(company && { company }),
            };
          }
          
          await storage.createProactiveLead(leadData);
          stats.imported++;
          
        } catch (error: any) {
          stats.errors++;
          errorDetails.push({ row: rowNumber, message: error.message || 'Errore sconosciuto' });
          console.error(`❌ [LEAD IMPORT] Error processing row ${rowNumber}:`, error);
        }
      }
      
      await db.update(schema.leadImportRuns)
        .set({
          runStatus: 'completed',
          completedAt: new Date(),
          rowsProcessed: rows.length,
          rowsImported: stats.imported,
          rowsSkipped: stats.skipped,
          rowsDuplicates: stats.duplicates,
          rowsErrors: stats.errors,
          errorDetails,
        })
        .where(eq(schema.leadImportRuns.id, importRun.id));
      
      await db.update(schema.leadImportJobs)
        .set({
          totalRowsImported: importJob.totalRowsImported! + stats.imported,
          lastImportAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(schema.leadImportJobs.id, importJob.id));
      
      console.log(`✅ [LEAD IMPORT] Completed: ${stats.imported} imported, ${stats.duplicates} duplicates, ${stats.skipped} skipped, ${stats.errors} errors`);
      
      res.json({
        success: true,
        data: {
          jobId: importJob.id,
          runId: importRun.id,
          stats,
          errorDetails: errorDetails.slice(0, 20),
        }
      });
    } catch (error: any) {
      console.error("❌ [LEAD IMPORT] Error importing leads:", error);
      res.status(500).json({
        success: false,
        error: error.message || "Errore durante l'importazione"
      });
    }
  }
);

router.get(
  "/consultant/agents/:agentId/leads/import-jobs",
  authenticateToken,
  requireRole("consultant"),
  async (req: AuthRequest, res) => {
    try {
      const consultantId = req.user!.id;
      const agentId = req.params.agentId;
      
      const agentConfig = await storage.getConsultantWhatsappConfig(consultantId, agentId);
      if (!agentConfig) {
        return res.status(404).json({
          success: false,
          error: "Agente non trovato o accesso negato"
        });
      }
      
      const jobs = await db.select()
        .from(schema.leadImportJobs)
        .where(
          and(
            eq(schema.leadImportJobs.consultantId, consultantId),
            eq(schema.leadImportJobs.agentConfigId, agentId)
          )
        )
        .orderBy(desc(schema.leadImportJobs.createdAt));
      
      res.json({
        success: true,
        data: jobs
      });
    } catch (error: any) {
      console.error("❌ [LEAD IMPORT] Error fetching import jobs:", error);
      res.status(500).json({
        success: false,
        error: error.message || "Errore durante il recupero dei job"
      });
    }
  }
);

router.get(
  "/consultant/agents/:agentId/leads/import-jobs/:jobId/runs",
  authenticateToken,
  requireRole("consultant"),
  async (req: AuthRequest, res) => {
    try {
      const consultantId = req.user!.id;
      const { agentId, jobId } = req.params;
      
      const agentConfig = await storage.getConsultantWhatsappConfig(consultantId, agentId);
      if (!agentConfig) {
        return res.status(404).json({
          success: false,
          error: "Agente non trovato o accesso negato"
        });
      }
      
      const [job] = await db.select()
        .from(schema.leadImportJobs)
        .where(
          and(
            eq(schema.leadImportJobs.id, jobId),
            eq(schema.leadImportJobs.consultantId, consultantId),
            eq(schema.leadImportJobs.agentConfigId, agentId)
          )
        );
      
      if (!job) {
        return res.status(404).json({
          success: false,
          error: "Job di importazione non trovato"
        });
      }
      
      const runs = await db.select()
        .from(schema.leadImportRuns)
        .where(eq(schema.leadImportRuns.jobId, jobId))
        .orderBy(desc(schema.leadImportRuns.createdAt));
      
      res.json({
        success: true,
        data: {
          job,
          runs
        }
      });
    } catch (error: any) {
      console.error("❌ [LEAD IMPORT] Error fetching import runs:", error);
      res.status(500).json({
        success: false,
        error: error.message || "Errore durante il recupero delle esecuzioni"
      });
    }
  }
);

export default router;
