import ExcelJS from 'exceljs';
import * as chardet from 'chardet';
import fs from 'fs';
import path from 'path';
import { Readable } from 'stream';

export interface ColumnInfo {
  name: string;
  index: number;
  sampleValues: any[];
}

export interface SheetInfo {
  name: string;
  columns: ColumnInfo[];
  sampleRows: Record<string, any>[];
  rowCount: number;
}

export interface ProcessedFile {
  sheets: SheetInfo[];
  fileSize: number;
  originalFilename: string;
  format: 'xlsx' | 'xls' | 'csv';
}

const MAX_SAMPLE_ROWS = 100;

async function detectFileEncoding(filePath: string): Promise<BufferEncoding> {
  const buffer = await fs.promises.readFile(filePath);
  const detected = chardet.detect(buffer);
  const encodingMap: Record<string, BufferEncoding> = {
    'UTF-8': 'utf-8',
    'UTF-16 LE': 'utf16le',
    'UTF-16 BE': 'utf16le',
    'ISO-8859-1': 'latin1',
    'ISO-8859-15': 'latin1',
    'windows-1252': 'latin1',
  };
  return encodingMap[detected || 'UTF-8'] || 'utf-8';
}

export async function processExcelFile(filePath: string, originalFilename: string): Promise<ProcessedFile> {
  const stats = await fs.promises.stat(filePath);
  const ext = path.extname(originalFilename).toLowerCase();
  
  if (ext === '.csv') {
    return processCsvFile(filePath, originalFilename, stats.size);
  }
  
  const workbook = new ExcelJS.stream.xlsx.WorkbookReader(filePath, {
    entries: 'emit',
    sharedStrings: 'cache',
    hyperlinks: 'ignore',
    styles: 'ignore',
    worksheets: 'emit',
  });

  const sheets: SheetInfo[] = [];

  for await (const worksheetReader of workbook) {
    const sheetInfo: SheetInfo = {
      name: worksheetReader.name || 'Sheet1',
      columns: [],
      sampleRows: [],
      rowCount: 0,
    };

    let headerRow: string[] = [];
    let rowIndex = 0;

    for await (const row of worksheetReader) {
      rowIndex++;
      
      if (rowIndex === 1) {
        headerRow = (row.values as any[]).slice(1).map((v, i) => 
          v?.toString?.() || `Column_${i + 1}`
        );
        sheetInfo.columns = headerRow.map((name, index) => ({
          name,
          index,
          sampleValues: [],
        }));
        continue;
      }

      const values = (row.values as any[]).slice(1);
      const rowData: Record<string, any> = {};
      
      headerRow.forEach((colName, idx) => {
        const cellValue = values[idx];
        let value = cellValue;
        
        if (cellValue && typeof cellValue === 'object') {
          if (cellValue.result !== undefined) {
            value = cellValue.result;
          } else if (cellValue.text !== undefined) {
            value = cellValue.text;
          } else if (cellValue instanceof Date) {
            value = cellValue.toISOString();
          }
        }
        
        rowData[colName] = value;
        
        if (sheetInfo.sampleRows.length < MAX_SAMPLE_ROWS && value !== undefined && value !== null) {
          const colInfo = sheetInfo.columns.find(c => c.name === colName);
          if (colInfo && colInfo.sampleValues.length < 10) {
            colInfo.sampleValues.push(value);
          }
        }
      });

      if (sheetInfo.sampleRows.length < MAX_SAMPLE_ROWS) {
        sheetInfo.sampleRows.push(rowData);
      }
      
      sheetInfo.rowCount++;
    }

    sheets.push(sheetInfo);
  }

  return {
    sheets,
    fileSize: stats.size,
    originalFilename,
    format: ext === '.xls' ? 'xls' : 'xlsx',
  };
}

async function processCsvFile(filePath: string, originalFilename: string, fileSize: number): Promise<ProcessedFile> {
  const encoding = await detectFileEncoding(filePath);
  const content = await fs.promises.readFile(filePath, { encoding });
  
  const lines = content.split(/\r?\n/).filter(line => line.trim());
  if (lines.length === 0) {
    throw new Error('CSV file is empty');
  }

  const delimiter = detectCsvDelimiter(lines[0]);
  const headerRow = parseCsvLine(lines[0], delimiter);
  
  const columns: ColumnInfo[] = headerRow.map((name, index) => ({
    name: name.trim() || `Column_${index + 1}`,
    index,
    sampleValues: [],
  }));

  const sampleRows: Record<string, any>[] = [];
  const rowCount = lines.length - 1;

  for (let i = 1; i < lines.length && sampleRows.length < MAX_SAMPLE_ROWS; i++) {
    const values = parseCsvLine(lines[i], delimiter);
    const rowData: Record<string, any> = {};
    
    headerRow.forEach((colName, idx) => {
      const value = parseValue(values[idx]);
      rowData[colName.trim() || `Column_${idx + 1}`] = value;
      
      if (value !== undefined && value !== null && value !== '') {
        const colInfo = columns.find(c => c.name === (colName.trim() || `Column_${idx + 1}`));
        if (colInfo && colInfo.sampleValues.length < 10) {
          colInfo.sampleValues.push(value);
        }
      }
    });

    sampleRows.push(rowData);
  }

  return {
    sheets: [{
      name: 'Sheet1',
      columns,
      sampleRows,
      rowCount,
    }],
    fileSize,
    originalFilename,
    format: 'csv',
  };
}

function detectCsvDelimiter(line: string): string {
  const delimiters = [',', ';', '\t', '|'];
  let maxCount = 0;
  let bestDelimiter = ',';

  for (const delimiter of delimiters) {
    const count = (line.match(new RegExp(delimiter.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
    if (count > maxCount) {
      maxCount = count;
      bestDelimiter = delimiter;
    }
  }

  return bestDelimiter;
}

function parseCsvLine(line: string, delimiter: string): string[] {
  const result: string[] = [];
  let current = '';
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
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);

  return result.map(v => v.replace(/^"|"$/g, ''));
}

function parseValue(value: string | undefined): any {
  if (value === undefined || value === '' || value === null) {
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
    const normalized = trimmed.replace(',', '.');
    const num = parseFloat(normalized);
    if (!isNaN(num)) {
      return num;
    }
  }

  const datePatterns = [
    /^\d{4}-\d{2}-\d{2}$/,
    /^\d{2}\/\d{2}\/\d{4}$/,
    /^\d{2}-\d{2}-\d{4}$/,
  ];
  for (const pattern of datePatterns) {
    if (pattern.test(trimmed)) {
      const date = new Date(trimmed);
      if (!isNaN(date.getTime())) {
        return date.toISOString();
      }
    }
  }

  return trimmed;
}

export async function getSheetNames(filePath: string, originalFilename: string): Promise<string[]> {
  const ext = path.extname(originalFilename).toLowerCase();
  
  if (ext === '.csv') {
    return ['Sheet1'];
  }

  const workbook = new ExcelJS.stream.xlsx.WorkbookReader(filePath, {
    entries: 'emit',
    worksheets: 'emit',
  });

  const names: string[] = [];
  for await (const worksheetReader of workbook) {
    names.push(worksheetReader.name || `Sheet${names.length + 1}`);
  }

  return names;
}
