import ExcelJS from 'exceljs';
import * as chardet from 'chardet';
import fs from 'fs';
import path from 'path';

export interface ColumnProfile {
  name: string;
  dataType: 'string' | 'number' | 'integer' | 'date' | 'boolean' | 'mixed';
  nullCount: number;
  uniqueCount: number;
  sampleValues: any[];
  min?: number | string;
  max?: number | string;
  avgLength?: number;
  patterns?: string[];
}

export interface DistributedSample {
  columns: string[];
  rows: Record<string, any>[];
  totalRowCount: number;
  sampledFromStart: number;
  sampledFromMiddle: number;
  sampledFromEnd: number;
}

const DEFAULT_SAMPLE_SIZE = 300;
const ROWS_PER_SECTION = 100;

export async function getDistributedSample(
  filePath: string,
  originalFilename: string,
  targetSampleSize: number = DEFAULT_SAMPLE_SIZE,
  sheetName?: string
): Promise<DistributedSample> {
  const ext = path.extname(originalFilename).toLowerCase();
  
  if (ext === '.csv') {
    return getDistributedSampleFromCsv(filePath, targetSampleSize);
  }
  
  return getDistributedSampleFromExcel(filePath, targetSampleSize, sheetName);
}

async function getDistributedSampleFromExcel(
  filePath: string,
  targetSampleSize: number,
  sheetName?: string
): Promise<DistributedSample> {
  const perSection = Math.floor(targetSampleSize / 3);
  
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  
  const worksheet = sheetName 
    ? workbook.getWorksheet(sheetName) 
    : workbook.worksheets[0];
  
  if (!worksheet) {
    throw new Error('No worksheet found');
  }

  const totalRows = worksheet.rowCount - 1;
  const headerRow = worksheet.getRow(1);
  const columns: string[] = [];
  
  headerRow.eachCell((cell, colNumber) => {
    columns[colNumber - 1] = cell.value?.toString() || `Column_${colNumber}`;
  });

  const rows: Record<string, any>[] = [];
  let sampledFromStart = 0;
  let sampledFromMiddle = 0;
  let sampledFromEnd = 0;

  const startEnd = Math.min(perSection, totalRows);
  for (let i = 2; i <= startEnd + 1 && i <= worksheet.rowCount; i++) {
    const row = worksheet.getRow(i);
    const rowData: Record<string, any> = {};
    row.eachCell((cell, colNumber) => {
      const colName = columns[colNumber - 1] || `Column_${colNumber}`;
      rowData[colName] = getCellValue(cell);
    });
    rows.push(rowData);
    sampledFromStart++;
  }

  if (totalRows > perSection * 2) {
    const middleStart = Math.floor(totalRows / 2) - Math.floor(perSection / 2) + 2;
    const middleEnd = Math.min(middleStart + perSection - 1, worksheet.rowCount);
    
    for (let i = middleStart; i <= middleEnd && sampledFromMiddle < perSection; i++) {
      const row = worksheet.getRow(i);
      const rowData: Record<string, any> = {};
      row.eachCell((cell, colNumber) => {
        const colName = columns[colNumber - 1] || `Column_${colNumber}`;
        rowData[colName] = getCellValue(cell);
      });
      rows.push(rowData);
      sampledFromMiddle++;
    }
  }

  if (totalRows > perSection) {
    const endStart = Math.max(worksheet.rowCount - perSection + 1, startEnd + 2);
    for (let i = endStart; i <= worksheet.rowCount && sampledFromEnd < perSection; i++) {
      const row = worksheet.getRow(i);
      const rowData: Record<string, any> = {};
      row.eachCell((cell, colNumber) => {
        const colName = columns[colNumber - 1] || `Column_${colNumber}`;
        rowData[colName] = getCellValue(cell);
      });
      rows.push(rowData);
      sampledFromEnd++;
    }
  }

  return {
    columns,
    rows,
    totalRowCount: totalRows,
    sampledFromStart,
    sampledFromMiddle,
    sampledFromEnd,
  };
}

async function getDistributedSampleFromCsv(
  filePath: string,
  targetSampleSize: number
): Promise<DistributedSample> {
  const perSection = Math.floor(targetSampleSize / 3);
  
  const buffer = await fs.promises.readFile(filePath);
  const detected = chardet.detect(buffer);
  const encoding = (detected === 'UTF-8' ? 'utf-8' : 'latin1') as BufferEncoding;
  const content = buffer.toString(encoding);
  
  const lines = content.split(/\r?\n/).filter(line => line.trim());
  if (lines.length < 2) {
    throw new Error('CSV file is empty or has no data rows');
  }

  const delimiter = detectDelimiter(lines[0]);
  const columns = parseCsvLine(lines[0], delimiter);
  const totalRows = lines.length - 1;

  const rows: Record<string, any>[] = [];
  let sampledFromStart = 0;
  let sampledFromMiddle = 0;
  let sampledFromEnd = 0;

  const startEnd = Math.min(perSection, totalRows);
  for (let i = 1; i <= startEnd; i++) {
    rows.push(parseRowToObject(lines[i], columns, delimiter));
    sampledFromStart++;
  }

  if (totalRows > perSection * 2) {
    const middleStart = Math.floor(totalRows / 2) - Math.floor(perSection / 2) + 1;
    const middleEnd = Math.min(middleStart + perSection - 1, totalRows);
    
    for (let i = middleStart; i <= middleEnd && sampledFromMiddle < perSection; i++) {
      rows.push(parseRowToObject(lines[i], columns, delimiter));
      sampledFromMiddle++;
    }
  }

  if (totalRows > perSection) {
    const endStart = Math.max(totalRows - perSection + 2, startEnd + 2);
    for (let i = endStart; i <= totalRows && sampledFromEnd < perSection; i++) {
      rows.push(parseRowToObject(lines[i], columns, delimiter));
      sampledFromEnd++;
    }
  }

  return {
    columns,
    rows,
    totalRowCount: totalRows,
    sampledFromStart,
    sampledFromMiddle,
    sampledFromEnd,
  };
}

function getCellValue(cell: ExcelJS.Cell): any {
  const value = cell.value;
  
  if (value === null || value === undefined) {
    return null;
  }
  
  if (typeof value === 'object') {
    if ('result' in value) {
      return value.result;
    }
    if ('text' in value) {
      return (value as any).text;
    }
    if (value instanceof Date) {
      return value.toISOString();
    }
  }
  
  return value;
}

function detectDelimiter(line: string): string {
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
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());

  return result.map(v => v.replace(/^"|"$/g, '').trim() || `Column_${result.indexOf(v) + 1}`);
}

function parseRowToObject(line: string, columns: string[], delimiter: string): Record<string, any> {
  const values = parseCsvLine(line, delimiter);
  const obj: Record<string, any> = {};
  
  columns.forEach((col, idx) => {
    obj[col] = parseValue(values[idx]);
  });
  
  return obj;
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

  return trimmed;
}

export function profileColumn(values: any[]): ColumnProfile {
  const nonNullValues = values.filter(v => v !== null && v !== undefined && v !== '');
  const nullCount = values.length - nonNullValues.length;
  
  const typeStats: Record<string, number> = {
    string: 0,
    number: 0,
    integer: 0,
    date: 0,
    boolean: 0,
  };

  const uniqueValues = new Set<string>();
  const sampleValues: any[] = [];
  let totalLength = 0;
  let minNum: number | undefined;
  let maxNum: number | undefined;
  let minStr: string | undefined;
  let maxStr: string | undefined;

  for (const value of nonNullValues) {
    const strValue = String(value);
    uniqueValues.add(strValue);
    
    if (sampleValues.length < 10 && !sampleValues.includes(value)) {
      sampleValues.push(value);
    }

    totalLength += strValue.length;

    if (typeof value === 'boolean' || value === 'true' || value === 'false') {
      typeStats.boolean++;
    } else if (typeof value === 'number') {
      if (Number.isInteger(value)) {
        typeStats.integer++;
      } else {
        typeStats.number++;
      }
      if (minNum === undefined || value < minNum) minNum = value;
      if (maxNum === undefined || value > maxNum) maxNum = value;
    } else if (isDateValue(strValue)) {
      typeStats.date++;
    } else {
      typeStats.string++;
      if (minStr === undefined || strValue < minStr) minStr = strValue;
      if (maxStr === undefined || strValue > maxStr) maxStr = strValue;
    }
  }

  let dataType: ColumnProfile['dataType'] = 'mixed';
  const total = nonNullValues.length;
  
  if (total > 0) {
    const threshold = 0.8;
    if (typeStats.integer / total >= threshold) {
      dataType = 'integer';
    } else if ((typeStats.number + typeStats.integer) / total >= threshold) {
      dataType = 'number';
    } else if (typeStats.date / total >= threshold) {
      dataType = 'date';
    } else if (typeStats.boolean / total >= threshold) {
      dataType = 'boolean';
    } else if (typeStats.string / total >= threshold) {
      dataType = 'string';
    }
  }

  const profile: ColumnProfile = {
    name: '',
    dataType,
    nullCount,
    uniqueCount: uniqueValues.size,
    sampleValues,
    avgLength: nonNullValues.length > 0 ? Math.round(totalLength / nonNullValues.length) : 0,
  };

  if (dataType === 'number' || dataType === 'integer') {
    profile.min = minNum;
    profile.max = maxNum;
  } else if (dataType === 'string') {
    profile.min = minStr;
    profile.max = maxStr;
  }

  return profile;
}

function isDateValue(value: string): boolean {
  const datePatterns = [
    /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2})?/,
    /^\d{2}\/\d{2}\/\d{4}$/,
    /^\d{2}-\d{2}-\d{4}$/,
    /^\d{2}\.\d{2}\.\d{4}$/,
  ];
  
  return datePatterns.some(pattern => pattern.test(value));
}

export function profileAllColumns(sample: DistributedSample): Record<string, ColumnProfile> {
  const profiles: Record<string, ColumnProfile> = {};
  
  for (const colName of sample.columns) {
    const values = sample.rows.map(row => row[colName]);
    const profile = profileColumn(values);
    profile.name = colName;
    profiles[colName] = profile;
  }
  
  return profiles;
}
