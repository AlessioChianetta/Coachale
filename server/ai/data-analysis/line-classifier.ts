/**
 * Line Classifier - Enterprise POS Data Quality
 * 
 * Classifies POS/DDT lines into:
 * - product: Real sellable items (Pizza, Beer, Coffee)
 * - modifier: Extras/additions (+ragu, extra cheese)
 * - note: Kitchen notes (poco panna, senza sale, ciliaca)
 * 
 * Generates SQL conditions to filter only sellable items
 */

export type LineType = 'product' | 'modifier' | 'note';

export interface LineClassificationConfig {
  productNameColumn: string;
  revenueColumn?: string;
  quantityColumn?: string;
}

// Patterns that indicate a line is NOT a sellable product
const NOTE_PREFIXES = [
  '...',
  '..',
  '.',
  '+',
  '-',
  '*',
  '>>',
  '→',
];

// Italian/English keywords for notes and modifiers
const NOTE_KEYWORDS = [
  // Italian kitchen notes
  'poco', 'poca', 'pochi', 'poche',
  'senza', 'senza sale', 'senza zucchero',
  'extra', 'aggiunta', 'aggiungi',
  'doppio', 'doppia',
  'mezzo', 'mezza', 'meta',
  'ciliaca', 'celiaco', 'celiachia',
  'allergia', 'allergico', 'allergica',
  'intollerante', 'intolleranza',
  'vegetariano', 'vegano', 'veg',
  'no ghiaccio', 'con ghiaccio',
  'al sangue', 'media', 'ben cotta', 'ben cotto',
  'tiepido', 'tiepida', 'caldo', 'calda', 'freddo', 'fredda',
  'urgente', 'prima', 'dopo',
  'separato', 'separata', 'a parte',
  'nota', 'note', 'commento',
  // Modifiers
  'ragu', 'ragù',
  'panna',
  'burro',
  'olio',
  'limone',
  'salsa',
  'formaggio',
  'mozzarella',
  // Short codes often used as notes
  'cuc', '2cuc', '3cuc',
  'ok', 'si', 'no',
];

// Modifier patterns (typically start with + or contain "extra")
const MODIFIER_PATTERNS = [
  /^\+/,                    // Starts with +
  /^extra\s/i,              // Starts with "extra "
  /^aggiunta\s/i,           // Starts with "aggiunta "
  /^con\s/i,                // Starts with "con "
  /^doppio\s/i,             // Starts with "doppio "
];

/**
 * Classify a single product name into line type
 */
export function classifyLine(productName: string): LineType {
  if (!productName || typeof productName !== 'string') {
    return 'note';
  }
  
  const trimmed = productName.trim();
  const lower = trimmed.toLowerCase();
  
  // Check prefix patterns first
  for (const prefix of NOTE_PREFIXES) {
    if (trimmed.startsWith(prefix)) {
      return 'note';
    }
  }
  
  // Check modifier patterns
  for (const pattern of MODIFIER_PATTERNS) {
    if (pattern.test(trimmed)) {
      return 'modifier';
    }
  }
  
  // Check if it's just a note keyword (short string matching keyword)
  if (lower.length <= 20) {
    for (const keyword of NOTE_KEYWORDS) {
      // Exact match or starts with keyword
      if (lower === keyword || lower.startsWith(keyword + ' ')) {
        return 'note';
      }
    }
  }
  
  // Check if contains only note keywords (e.g., "poco panna")
  const words = lower.split(/\s+/);
  if (words.length <= 3 && words.every(w => NOTE_KEYWORDS.includes(w))) {
    return 'note';
  }
  
  // Default: it's a sellable product
  return 'product';
}

/**
 * Check if a line is sellable (product) vs note/modifier
 */
export function isSellable(productName: string, revenueAmount?: number): boolean {
  // If revenue is null/zero and looks like a note, it's not sellable
  const lineType = classifyLine(productName);
  
  if (lineType !== 'product') {
    return false;
  }
  
  // If revenue is provided and is null/0/negative, might be a note
  if (revenueAmount !== undefined && revenueAmount !== null) {
    if (revenueAmount <= 0) {
      // Zero revenue + any keyword = not sellable
      const lower = (productName || '').toLowerCase();
      for (const keyword of NOTE_KEYWORDS.slice(0, 20)) {
        if (lower.includes(keyword)) {
          return false;
        }
      }
    }
  }
  
  return true;
}

/**
 * Sanitize column name to prevent SQL injection
 * Only allows alphanumeric, underscore, and common characters
 * THROWS error if column name is invalid (fail closed)
 */
function sanitizeColumnName(col: string): string {
  // Remove any quotes first, then validate
  const clean = col.replace(/["'`]/g, '');
  // Only allow alphanumeric, underscore, and hyphen
  if (!/^[a-zA-Z0-9_\-]+$/.test(clean)) {
    const errorMsg = `[LINE-CLASSIFIER] SECURITY: Invalid column name rejected: ${col}`;
    console.error(errorMsg);
    throw new Error(errorMsg); // FAIL CLOSED - don't silently skip
  }
  return clean;
}

/**
 * Generate SQL WHERE clause to filter only sellable items
 * This is the CORE function for anti-hallucination on product analytics
 * THROWS if column names are invalid (fail closed for security)
 */
export function generateSellableFilterSQL(config: LineClassificationConfig): string {
  const { productNameColumn, revenueColumn } = config;
  
  // SECURITY: Sanitize column names (throws if invalid)
  const cleanProductCol = sanitizeColumnName(productNameColumn);
  const col = `"${cleanProductCol}"`;
  
  const conditions: string[] = [];
  
  // 1. Exclude lines starting with note prefixes
  for (const prefix of NOTE_PREFIXES) {
    // Handle ... separately as it's the most common
    if (prefix === '...') {
      conditions.push(`${col} NOT LIKE '...%'`);
    } else if (prefix === '..') {
      conditions.push(`${col} NOT LIKE '..%'`);
    } else {
      conditions.push(`${col} NOT LIKE '${prefix}%'`);
    }
  }
  
  // 2. If revenue column is available, exclude zero/null revenue
  if (revenueColumn) {
    const cleanRevenueCol = sanitizeColumnName(revenueColumn);
    if (cleanRevenueCol) {
      conditions.push(`("${cleanRevenueCol}" IS NOT NULL AND "${cleanRevenueCol}" > 0)`);
    }
  }
  
  // 3. Exclude common note keywords (as whole word match)
  // Only add most impactful ones to keep query efficient
  const impactfulKeywords = ['poco', 'poca', 'senza', 'extra', 'aggiunta', 'nota', 'ciliaca'];
  for (const kw of impactfulKeywords) {
    // Exclude if starts with keyword followed by space (e.g., "poco panna")
    conditions.push(`LOWER(${col}) NOT LIKE '${kw} %'`);
    // Exclude exact match
    conditions.push(`LOWER(${col}) != '${kw}'`);
  }
  
  return conditions.join(' AND ');
}

/**
 * Generate a lightweight filter for high-performance queries
 * Uses only the most essential conditions
 * THROWS if column names are invalid (fail closed for security)
 */
export function generateLightweightSellableFilter(config: LineClassificationConfig): string {
  const { productNameColumn, revenueColumn } = config;
  
  // SECURITY: Sanitize column names (throws if invalid)
  const cleanProductCol = sanitizeColumnName(productNameColumn);
  const col = `"${cleanProductCol}"`;
  
  const conditions: string[] = [];
  
  // Most common patterns only
  conditions.push(`${col} NOT LIKE '...%'`);
  conditions.push(`${col} NOT LIKE '.%'`);
  conditions.push(`${col} NOT LIKE '+%'`);
  conditions.push(`LOWER(${col}) NOT LIKE 'poco %'`);
  conditions.push(`LOWER(${col}) NOT LIKE 'senza %'`);
  
  if (revenueColumn) {
    const cleanRevenueCol = sanitizeColumnName(revenueColumn);
    if (cleanRevenueCol) {
      conditions.push(`"${cleanRevenueCol}" > 0`);
    }
  }
  
  return conditions.join(' AND ');
}

/**
 * Get statistics about line classification for a dataset
 * Useful for data quality reporting
 */
export interface LineClassificationStats {
  totalLines: number;
  products: number;
  modifiers: number;
  notes: number;
  sellablePercent: number;
}

export function calculateClassificationStats(productNames: string[]): LineClassificationStats {
  const stats: LineClassificationStats = {
    totalLines: productNames.length,
    products: 0,
    modifiers: 0,
    notes: 0,
    sellablePercent: 0,
  };
  
  for (const name of productNames) {
    const type = classifyLine(name);
    switch (type) {
      case 'product':
        stats.products++;
        break;
      case 'modifier':
        stats.modifiers++;
        break;
      case 'note':
        stats.notes++;
        break;
    }
  }
  
  stats.sellablePercent = stats.totalLines > 0 
    ? Math.round((stats.products / stats.totalLines) * 100)
    : 0;
  
  return stats;
}

console.log('[LINE-CLASSIFIER] Module loaded - Enterprise POS data quality filter ready');
