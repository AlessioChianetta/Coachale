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
  company: ["azienda", "company", "società", "ditta", "societa", "impresa", "company_name", "companyname"],
  notes: ["note", "notes", "commenti", "osservazioni", "commento", "descrizione"],
  obiettivi: ["obiettivi", "obiettivo", "goals", "goal", "objectives", "objective"],
  desideri: ["desideri", "desiderio", "desires", "desire", "wishes", "wish"],
  uncino: ["uncino", "hook", "gancio", "pain_point", "painpoint"],
  fonte: ["fonte", "source", "sorgente", "provenienza", "origin", "lead_source"],
  website: ["website", "sito", "sito_web", "sitoweb", "url", "web"],
  address: ["indirizzo", "address", "via", "street"],
  city: ["città", "city", "citta", "comune"],
  state: ["provincia", "state", "regione", "region"],
  postalCode: ["cap", "postal_code", "postalcode", "zip", "zipcode"],
  country: ["paese", "country", "nazione", "nation"],
  tags: ["tags", "tag", "etichette", "etichetta", "labels", "label"],
  dateOfBirth: ["data_nascita", "dateofbirth", "date_of_birth", "birthday", "nascita", "dob"],
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

// AI-powered column mapping
router.post(
  "/consultant/agents/:agentId/leads/ai-map",
  authenticateToken,
  requireRole("consultant"),
  async (req: AuthRequest, res) => {
    try {
      const consultantId = req.user!.id;
      const agentId = req.params.agentId;
      const { columns } = req.body;

      // Verify agent access
      const agentConfig = await storage.getConsultantWhatsappConfig(consultantId, agentId);
      if (!agentConfig) {
        return res.status(404).json({
          success: false,
          error: "Agente non trovato"
        });
      }

      if (!columns || !Array.isArray(columns)) {
        return res.status(400).json({
          success: false,
          error: "Dati colonne mancanti"
        });
      }

      const { aiMapColumns } = await import("../services/lead-import-ai-mapper");
      const suggestions = await aiMapColumns(columns);

      res.json({
        success: true,
        data: { suggestions }
      });
    } catch (error: any) {
      console.error("[AI Map] Error:", error);
      res.status(500).json({
        success: false,
        error: error.message || "Errore durante la mappatura AI"
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
      
      // Apply date filtering if startFromDate and dateCreated column mapping are configured
      const startFromDate = settings.startFromDate;
      const dateCreatedColumn = columnMappings.dateCreated;
      
      if (startFromDate && dateCreatedColumn) {
        const filterDate = new Date(startFromDate);
        if (!isNaN(filterDate.getTime())) {
          const originalCount = rows.length;
          rows = rows.filter((row) => {
            const rowDateStr = row[dateCreatedColumn];
            if (!rowDateStr) return false;
            
            // Parse date with various formats
            const rowDate = new Date(rowDateStr);
            if (isNaN(rowDate.getTime())) {
              // Try parsing common Italian date formats (dd/mm/yyyy)
              const parts = String(rowDateStr).split(/[\/\-\.]/);
              if (parts.length === 3) {
                const parsed = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
                if (!isNaN(parsed.getTime())) {
                  return parsed >= filterDate;
                }
              }
              return false;
            }
            return rowDate >= filterDate;
          });
          console.log(`📅 [LEAD IMPORT] Date filter applied: ${originalCount} -> ${rows.length} rows (from ${startFromDate})`);
        }
      }
      
      console.log(`📥 [LEAD IMPORT] Processing ${rows.length} rows from ${uploadedFilePath ? 'file' : 'Google Sheets'}`)
      
      const pollingEnabled = settings.pollingEnabled === true;
      const pollingIntervalMinutes = settings.pollingIntervalMinutes || 30;
      
      const [importJob] = await db.insert(schema.leadImportJobs).values({
        consultantId,
        agentConfigId: agentId,
        jobName: jobName || `Import ${new Date().toLocaleDateString('it-IT')}`,
        sourceType: sourceType || 'excel',
        googleSheetUrl: googleSheetUrl || null,
        columnMappings,
        settings,
        pollingEnabled: sourceType === 'google_sheets' ? pollingEnabled : false,
        pollingIntervalMinutes: sourceType === 'google_sheets' ? pollingIntervalMinutes : 30,
        lastRowCount: rows.length,
        status: 'active',
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
          
          const obiettivi = columnMappings.obiettivi ? row[columnMappings.obiettivi] || null : null;
          const desideri = columnMappings.desideri ? row[columnMappings.desideri] || null : null;
          const uncino = columnMappings.uncino ? row[columnMappings.uncino] || null : null;
          const fonte = columnMappings.fonte ? row[columnMappings.fonte] || null : null;
          const website = columnMappings.website ? row[columnMappings.website] || null : null;
          const address = columnMappings.address ? row[columnMappings.address] || null : null;
          const city = columnMappings.city ? row[columnMappings.city] || null : null;
          const state = columnMappings.state ? row[columnMappings.state] || null : null;
          const postalCode = columnMappings.postalCode ? row[columnMappings.postalCode] || null : null;
          const country = columnMappings.country ? row[columnMappings.country] || null : null;
          const tagsRaw = columnMappings.tags ? row[columnMappings.tags] || null : null;
          const dateOfBirth = columnMappings.dateOfBirth ? row[columnMappings.dateOfBirth] || null : null;
          
          const leadInfo: any = {};
          if (notes) leadInfo.note = notes;
          if (obiettivi) leadInfo.obiettivi = obiettivi;
          if (desideri) leadInfo.desideri = desideri;
          if (uncino) leadInfo.uncino = uncino;
          if (fonte) leadInfo.fonte = fonte;
          if (email) leadInfo.email = email;
          if (company) leadInfo.companyName = company;
          if (website) leadInfo.website = website;
          if (address) leadInfo.address = address;
          if (city) leadInfo.city = city;
          if (state) leadInfo.state = state;
          if (postalCode) leadInfo.postalCode = postalCode;
          if (country) leadInfo.country = country;
          if (dateOfBirth) leadInfo.dateOfBirth = dateOfBirth;
          if (tagsRaw) {
            const tagsArray = tagsRaw.split(/[,;]/).map((t: string) => t.trim()).filter(Boolean);
            if (tagsArray.length > 0) leadInfo.tags = tagsArray;
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

router.get(
  "/consultant/lead-import/sheets",
  authenticateToken,
  requireRole("consultant"),
  async (req: AuthRequest, res) => {
    try {
      const consultantId = req.user!.id;
      
      const sheets = await db.select()
        .from(schema.leadImportJobs)
        .where(
          and(
            eq(schema.leadImportJobs.consultantId, consultantId),
            eq(schema.leadImportJobs.sourceType, 'google_sheets')
          )
        )
        .orderBy(desc(schema.leadImportJobs.createdAt));
      
      res.json({
        success: true,
        data: sheets
      });
    } catch (error: any) {
      console.error("❌ [LEAD IMPORT] Error fetching Google Sheets configs:", error);
      res.status(500).json({
        success: false,
        error: error.message || "Errore durante il recupero delle configurazioni"
      });
    }
  }
);

router.post(
  "/consultant/lead-import/sheets",
  authenticateToken,
  requireRole("consultant"),
  async (req: AuthRequest, res) => {
    try {
      const consultantId = req.user!.id;
      const {
        sheetUrl,
        agentConfigId,
        campaignId,
        columnMappings,
        pollingIntervalMinutes = 30,
        pollingEnabled = false,
        configName,
      } = req.body;
      
      if (!sheetUrl) {
        return res.status(400).json({
          success: false,
          error: "URL Google Sheets richiesto"
        });
      }
      
      if (!agentConfigId) {
        return res.status(400).json({
          success: false,
          error: "Agent config ID richiesto"
        });
      }
      
      const agentConfig = await storage.getConsultantWhatsappConfig(consultantId, agentConfigId);
      if (!agentConfig) {
        return res.status(404).json({
          success: false,
          error: "Agente non trovato o accesso negato"
        });
      }
      
      const sheetIdMatch = sheetUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
      if (!sheetIdMatch) {
        return res.status(400).json({
          success: false,
          error: "URL Google Sheets non valido"
        });
      }
      
      const csvExportUrl = `https://docs.google.com/spreadsheets/d/${sheetIdMatch[1]}/export?format=csv`;
      const response = await fetch(csvExportUrl);
      
      if (!response.ok) {
        return res.status(400).json({
          success: false,
          error: "Impossibile accedere al foglio. Verifica che sia condiviso pubblicamente."
        });
      }
      
      const csvContent = await response.text();
      const { rows } = parseCsvData(csvContent);
      const initialRowCount = rows.length;
      
      const settings: any = {};
      if (campaignId) {
        settings.campaignId = campaignId;
      }
      
      const [newJob] = await db.insert(schema.leadImportJobs).values({
        consultantId,
        agentConfigId,
        jobName: configName || `Google Sheet - ${new Date().toLocaleDateString('it-IT')}`,
        sourceType: 'google_sheets',
        googleSheetUrl: sheetUrl,
        columnMappings: columnMappings || {},
        settings,
        pollingEnabled,
        pollingIntervalMinutes,
        lastRowCount: initialRowCount,
      }).returning();
      
      console.log(`✅ [SHEETS POLLING] Created new Google Sheets config: ${newJob.id} with ${initialRowCount} initial rows`);
      
      res.json({
        success: true,
        data: newJob
      });
    } catch (error: any) {
      console.error("❌ [LEAD IMPORT] Error creating Google Sheets config:", error);
      res.status(500).json({
        success: false,
        error: error.message || "Errore durante la creazione della configurazione"
      });
    }
  }
);

router.put(
  "/consultant/lead-import/sheets/:jobId",
  authenticateToken,
  requireRole("consultant"),
  async (req: AuthRequest, res) => {
    try {
      const consultantId = req.user!.id;
      const { jobId } = req.params;
      const {
        sheetUrl,
        columnMappings,
        pollingIntervalMinutes,
        pollingEnabled,
        configName,
        campaignId,
        status,
      } = req.body;
      
      const [existingJob] = await db.select()
        .from(schema.leadImportJobs)
        .where(
          and(
            eq(schema.leadImportJobs.id, jobId),
            eq(schema.leadImportJobs.consultantId, consultantId),
            eq(schema.leadImportJobs.sourceType, 'google_sheets')
          )
        );
      
      if (!existingJob) {
        return res.status(404).json({
          success: false,
          error: "Configurazione non trovata"
        });
      }
      
      const updateData: any = {
        updatedAt: new Date(),
      };
      
      if (sheetUrl !== undefined) {
        const sheetIdMatch = sheetUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
        if (!sheetIdMatch) {
          return res.status(400).json({
            success: false,
            error: "URL Google Sheets non valido"
          });
        }
        updateData.googleSheetUrl = sheetUrl;
      }
      
      if (columnMappings !== undefined) updateData.columnMappings = columnMappings;
      if (pollingIntervalMinutes !== undefined) updateData.pollingIntervalMinutes = pollingIntervalMinutes;
      if (pollingEnabled !== undefined) updateData.pollingEnabled = pollingEnabled;
      if (configName !== undefined) updateData.jobName = configName;
      if (status !== undefined) updateData.status = status;
      
      if (campaignId !== undefined) {
        updateData.settings = {
          ...existingJob.settings,
          campaignId,
        };
      }
      
      const [updatedJob] = await db.update(schema.leadImportJobs)
        .set(updateData)
        .where(eq(schema.leadImportJobs.id, jobId))
        .returning();
      
      console.log(`✅ [SHEETS POLLING] Updated Google Sheets config: ${jobId}`);
      
      res.json({
        success: true,
        data: updatedJob
      });
    } catch (error: any) {
      console.error("❌ [LEAD IMPORT] Error updating Google Sheets config:", error);
      res.status(500).json({
        success: false,
        error: error.message || "Errore durante l'aggiornamento della configurazione"
      });
    }
  }
);

router.delete(
  "/consultant/lead-import/sheets/:jobId",
  authenticateToken,
  requireRole("consultant"),
  async (req: AuthRequest, res) => {
    try {
      const consultantId = req.user!.id;
      const { jobId } = req.params;
      
      const [existingJob] = await db.select()
        .from(schema.leadImportJobs)
        .where(
          and(
            eq(schema.leadImportJobs.id, jobId),
            eq(schema.leadImportJobs.consultantId, consultantId),
            eq(schema.leadImportJobs.sourceType, 'google_sheets')
          )
        );
      
      if (!existingJob) {
        return res.status(404).json({
          success: false,
          error: "Configurazione non trovata"
        });
      }
      
      await db.delete(schema.leadImportJobs)
        .where(eq(schema.leadImportJobs.id, jobId));
      
      console.log(`✅ [SHEETS POLLING] Deleted Google Sheets config: ${jobId}`);
      
      res.json({
        success: true,
        message: "Configurazione eliminata con successo"
      });
    } catch (error: any) {
      console.error("❌ [LEAD IMPORT] Error deleting Google Sheets config:", error);
      res.status(500).json({
        success: false,
        error: error.message || "Errore durante l'eliminazione della configurazione"
      });
    }
  }
);

router.post(
  "/consultant/lead-import/sheets/:jobId/toggle-polling",
  authenticateToken,
  requireRole("consultant"),
  async (req: AuthRequest, res) => {
    try {
      const consultantId = req.user!.id;
      const { jobId } = req.params;
      const { pollingEnabled } = req.body;
      
      const [existingJob] = await db.select()
        .from(schema.leadImportJobs)
        .where(
          and(
            eq(schema.leadImportJobs.id, jobId),
            eq(schema.leadImportJobs.consultantId, consultantId),
            eq(schema.leadImportJobs.sourceType, 'google_sheets')
          )
        );
      
      if (!existingJob) {
        return res.status(404).json({
          success: false,
          error: "Configurazione non trovata"
        });
      }
      
      const newPollingEnabled = pollingEnabled !== undefined ? pollingEnabled : !existingJob.pollingEnabled;
      
      const [updatedJob] = await db.update(schema.leadImportJobs)
        .set({
          pollingEnabled: newPollingEnabled,
          updatedAt: new Date(),
        })
        .where(eq(schema.leadImportJobs.id, jobId))
        .returning();
      
      console.log(`✅ [SHEETS POLLING] ${newPollingEnabled ? 'Enabled' : 'Disabled'} polling for job: ${jobId}`);
      
      res.json({
        success: true,
        data: updatedJob,
        message: newPollingEnabled ? "Polling attivato" : "Polling disattivato"
      });
    } catch (error: any) {
      console.error("❌ [LEAD IMPORT] Error toggling polling:", error);
      res.status(500).json({
        success: false,
        error: error.message || "Errore durante il toggle del polling"
      });
    }
  }
);

router.post(
  "/consultant/lead-import/sheets/:jobId/import-now",
  authenticateToken,
  requireRole("consultant"),
  async (req: AuthRequest, res) => {
    try {
      const consultantId = req.user!.id;
      const { jobId } = req.params;
      
      const [existingJob] = await db.select()
        .from(schema.leadImportJobs)
        .where(
          and(
            eq(schema.leadImportJobs.id, jobId),
            eq(schema.leadImportJobs.consultantId, consultantId),
            eq(schema.leadImportJobs.sourceType, 'google_sheets')
          )
        );
      
      if (!existingJob) {
        return res.status(404).json({
          success: false,
          error: "Configurazione non trovata"
        });
      }
      
      if (!existingJob.googleSheetUrl) {
        return res.status(400).json({
          success: false,
          error: "URL Google Sheets non configurato"
        });
      }
      
      const { importNewRowsFromSheet } = await import('../schedulers/sheets-polling-scheduler');
      const result = await importNewRowsFromSheet(existingJob);
      
      res.json({
        success: true,
        data: result
      });
    } catch (error: any) {
      console.error("❌ [LEAD IMPORT] Error running manual import:", error);
      res.status(500).json({
        success: false,
        error: error.message || "Errore durante l'importazione manuale"
      });
    }
  }
);

export { parseCsvData, generateRowHash, normalizePhoneNumber };
export default router;
