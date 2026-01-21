/**
 * SQL Utility Functions
 * Provides safe SQL identifier handling to prevent SQL injection
 */

export function sanitizeIdentifier(name: string): string {
  const sanitized = name
    .toLowerCase()
    .replace(/[àáâãäå]/g, "a")
    .replace(/[èéêë]/g, "e")
    .replace(/[ìíîï]/g, "i")
    .replace(/[òóôõö]/g, "o")
    .replace(/[ùúûü]/g, "u")
    .replace(/[^a-z0-9_]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
    .substring(0, 63);

  if (/^\d/.test(sanitized)) {
    return `col_${sanitized}`;
  }

  return sanitized || "col";
}

export function validateIdentifier(name: string): boolean {
  return /^[a-z_][a-z0-9_]*$/i.test(name) && name.length <= 63;
}

export function escapeIdentifier(name: string): string {
  if (!name || typeof name !== 'string') {
    throw new Error(`Invalid identifier: ${name}`);
  }
  
  const cleaned = name.replace(/"/g, '""');
  
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(cleaned) || cleaned.length > 128) {
    throw new Error(`Unsafe identifier: ${name}`);
  }
  
  return `"${cleaned}"`;
}

export function safeTableName(tableName: string): string {
  if (!tableName || typeof tableName !== 'string') {
    throw new Error(`Invalid table name: ${tableName}`);
  }
  
  if (!/^cdd_[a-z0-9_]+$/i.test(tableName)) {
    throw new Error(`Invalid table name format: ${tableName}`);
  }
  
  return escapeIdentifier(tableName);
}

export function safeColumnName(columnName: string): string {
  if (!columnName || typeof columnName !== 'string') {
    throw new Error(`Invalid column name: ${columnName}`);
  }
  
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(columnName) || columnName.length > 63) {
    throw new Error(`Invalid column name: ${columnName}`);
  }
  
  return escapeIdentifier(columnName);
}
