import cron from 'node-cron';
import { db } from '../db';
import * as schema from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import { storage } from '../storage';
import Papa from 'papaparse';
import crypto from 'crypto';

function parseCsvData(csvContent: string): { headers: string[]; rows: Record<string, any>[] } {
  const result = Papa.parse<Record<string, any>>(csvContent, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });
  
  const headers = result.meta.fields || [];
  return { headers, rows: result.data };
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

export interface ImportResult {
  imported: number;
  duplicates: number;
  skipped: number;
  errors: number;
  newRowCount: number;
  previousRowCount: number;
}

export async function importNewRowsFromSheet(job: schema.LeadImportJob): Promise<ImportResult> {
  const result: ImportResult = {
    imported: 0,
    duplicates: 0,
    skipped: 0,
    errors: 0,
    newRowCount: 0,
    previousRowCount: job.lastRowCount || 0,
  };
  
  if (!job.googleSheetUrl) {
    console.log(`[SHEETS POLLING] Job ${job.id} has no Google Sheet URL`);
    return result;
  }
  
  const sheetIdMatch = job.googleSheetUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (!sheetIdMatch) {
    console.log(`[SHEETS POLLING] Invalid Google Sheet URL for job ${job.id}`);
    return result;
  }
  
  const sheetId = sheetIdMatch[1];
  const csvExportUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv`;
  
  try {
    const response = await fetch(csvExportUrl);
    
    if (!response.ok) {
      console.error(`[SHEETS POLLING] Failed to fetch sheet for job ${job.id}: ${response.status}`);
      return result;
    }
    
    const csvContent = await response.text();
    let { rows } = parseCsvData(csvContent);
    
    const columnMappings = job.columnMappings || {};
    const settings = job.settings || {};
    
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
            const parts = rowDateStr.split(/[\/\-\.]/);
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
        console.log(`[SHEETS POLLING] Date filter applied: ${originalCount} -> ${rows.length} rows (from ${startFromDate})`);
      }
    }
    
    result.newRowCount = rows.length;
    
    if (rows.length <= (job.lastRowCount || 0)) {
      console.log(`[SHEETS POLLING] No new rows for job ${job.id} (current: ${rows.length}, previous: ${job.lastRowCount})`);
      
      await db.update(schema.leadImportJobs)
        .set({ lastImportAt: new Date(), updatedAt: new Date() })
        .where(eq(schema.leadImportJobs.id, job.id));
      
      return result;
    }
    
    const newRows = rows.slice(job.lastRowCount || 0);
    console.log(`[SHEETS POLLING] Found ${newRows.length} new rows for job ${job.id}`);
    
    const skipDuplicates = settings.skipDuplicates !== false;
    const defaultContactFrequency = settings.defaultContactFrequency || 7;
    const campaignId = settings.campaignId || null;
    
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(10, 0, 0, 0);
    
    const [importRun] = await db.insert(schema.leadImportRuns).values({
      jobId: job.id,
      runStatus: 'running',
      startedAt: new Date(),
      originalFilename: `polling-${new Date().toISOString()}`,
    }).returning();
    
    const errorDetails: Array<{ row: number; field?: string; message: string }> = [];
    
    for (let i = 0; i < newRows.length; i++) {
      const row = newRows[i];
      const absoluteRowNumber = (job.lastRowCount || 0) + i + 1;
      
      try {
        const firstName = row[columnMappings.firstName || ''] || '';
        const lastName = row[columnMappings.lastName || ''] || '';
        const rawPhone = row[columnMappings.phoneNumber || ''] || '';
        const email = columnMappings.email ? row[columnMappings.email] || null : null;
        const company = columnMappings.company ? row[columnMappings.company] || null : null;
        
        // Multi-column notes concatenation
        let notes: string | null = null;
        const notesColumns = settings.notesColumns as string[] | undefined;
        if (notesColumns && notesColumns.length > 0) {
          const noteParts = notesColumns
            .map(col => row[col] ? String(row[col]).trim() : '')
            .filter(Boolean);
          notes = noteParts.length > 0 ? noteParts.join(' | ') : null;
        } else if (columnMappings.notes) {
          notes = row[columnMappings.notes] || null;
        }
        
        // Extract all CRM fields from column mappings
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
        const question1 = columnMappings.question1 ? row[columnMappings.question1] || null : null;
        const question2 = columnMappings.question2 ? row[columnMappings.question2] || null : null;
        const question3 = columnMappings.question3 ? row[columnMappings.question3] || null : null;
        const question4 = columnMappings.question4 ? row[columnMappings.question4] || null : null;
        
        if (!rawPhone) {
          result.skipped++;
          errorDetails.push({ row: absoluteRowNumber, field: 'phoneNumber', message: 'Numero di telefono mancante' });
          continue;
        }
        
        const phoneNumber = normalizePhoneNumber(rawPhone);
        
        if (!/^\+\d{1,15}$/.test(phoneNumber)) {
          result.skipped++;
          errorDetails.push({ row: absoluteRowNumber, field: 'phoneNumber', message: 'Formato telefono non valido' });
          continue;
        }
        
        const sourceRowHash = generateRowHash(phoneNumber, firstName, lastName);
        
        if (skipDuplicates) {
          const existingLead = await storage.getProactiveLeadByPhone(job.consultantId, phoneNumber);
          if (existingLead) {
            result.duplicates++;
            continue;
          }
        }
        
        // Build leadInfo with all CRM fields (matching webhook.ts and lead-import-router.ts structure)
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
        if (question1) leadInfo.question1 = question1;
        if (question2) leadInfo.question2 = question2;
        if (question3) leadInfo.question3 = question3;
        if (question4) leadInfo.question4 = question4;
        if (tagsRaw) {
          const tagsArray = tagsRaw.split(/[,;]/).map((t: string) => t.trim()).filter(Boolean);
          if (tagsArray.length > 0) leadInfo.tags = tagsArray;
        }
        
        const leadData: any = {
          consultantId: job.consultantId,
          agentConfigId: job.agentConfigId,
          firstName: firstName || 'Lead',
          lastName: lastName || '',
          phoneNumber,
          contactSchedule: new Date(tomorrow.getTime() + (i * 5 * 60 * 1000)),
          contactFrequency: defaultContactFrequency,
          status: 'pending',
          importJobId: job.id,
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
        result.imported++;
        
      } catch (error: any) {
        result.errors++;
        errorDetails.push({ row: absoluteRowNumber, message: error.message || 'Errore sconosciuto' });
        console.error(`[SHEETS POLLING] Error processing row ${absoluteRowNumber}:`, error.message);
      }
    }
    
    await db.update(schema.leadImportRuns)
      .set({
        runStatus: 'completed',
        completedAt: new Date(),
        rowsProcessed: newRows.length,
        rowsImported: result.imported,
        rowsSkipped: result.skipped,
        rowsDuplicates: result.duplicates,
        rowsErrors: result.errors,
        errorDetails,
      })
      .where(eq(schema.leadImportRuns.id, importRun.id));
    
    await db.update(schema.leadImportJobs)
      .set({
        totalRowsImported: (job.totalRowsImported || 0) + result.imported,
        lastImportAt: new Date(),
        lastRowCount: rows.length,
        updatedAt: new Date(),
      })
      .where(eq(schema.leadImportJobs.id, job.id));
    
    console.log(`[SHEETS POLLING] Completed import for job ${job.id}: ${result.imported} imported, ${result.duplicates} duplicates, ${result.skipped} skipped, ${result.errors} errors`);
    
  } catch (error: any) {
    console.error(`[SHEETS POLLING] Fatal error for job ${job.id}:`, error.message);
    result.errors++;
  }
  
  return result;
}

async function runPollingCycle() {
  const executionId = Math.random().toString(36).substring(7);
  console.log(`\n[SHEETS POLLING] Starting polling cycle (ExecID: ${executionId})...`);
  
  try {
    const activeJobs = await db.select()
      .from(schema.leadImportJobs)
      .where(
        and(
          eq(schema.leadImportJobs.sourceType, 'google_sheets'),
          eq(schema.leadImportJobs.pollingEnabled, true),
          eq(schema.leadImportJobs.status, 'active')
        )
      );
    
    if (activeJobs.length === 0) {
      console.log(`[SHEETS POLLING] No active polling jobs found`);
      return;
    }
    
    console.log(`[SHEETS POLLING] Found ${activeJobs.length} active polling jobs`);
    
    const now = new Date();
    
    for (const job of activeJobs) {
      const lastImport = job.lastImportAt ? new Date(job.lastImportAt) : new Date(0);
      const intervalMs = (job.pollingIntervalMinutes || 30) * 60 * 1000;
      const nextPollTime = new Date(lastImport.getTime() + intervalMs);
      
      if (now >= nextPollTime) {
        console.log(`[SHEETS POLLING] Processing job ${job.id} (${job.jobName})`);
        
        try {
          await importNewRowsFromSheet(job);
        } catch (error: any) {
          console.error(`[SHEETS POLLING] Error processing job ${job.id}:`, error.message);
        }
      } else {
        const minutesUntilNext = Math.round((nextPollTime.getTime() - now.getTime()) / 60000);
        console.log(`[SHEETS POLLING] Skipping job ${job.id} - next poll in ${minutesUntilNext} minutes`);
      }
    }
    
    console.log(`[SHEETS POLLING] Polling cycle completed (ExecID: ${executionId})`);
    
  } catch (error: any) {
    console.error(`[SHEETS POLLING] Fatal error in polling cycle:`, error.message);
  }
}

let schedulerInstance: cron.ScheduledTask | null = null;

export function startSheetsPollingScheduler() {
  if (schedulerInstance) {
    console.log('[SHEETS POLLING] Scheduler already running, skipping initialization');
    return;
  }
  
  console.log('[SHEETS POLLING] Starting Google Sheets polling scheduler (every minute)...');
  
  schedulerInstance = cron.schedule('* * * * *', async () => {
    await runPollingCycle();
  }, {
    scheduled: true,
    timezone: 'Europe/Rome'
  });
  
  console.log('[SHEETS POLLING] ✅ Scheduler started successfully');
}

export function stopSheetsPollingScheduler() {
  if (schedulerInstance) {
    schedulerInstance.stop();
    schedulerInstance = null;
    console.log('[SHEETS POLLING] Scheduler stopped');
  }
}
