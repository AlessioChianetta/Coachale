# RDP: Compute-First Data Analysis System

## Overview

Sistema di analisi dati strutturati (Excel/CSV) per clienti, con architettura "compute-first" che separa calcolo deterministico (SQL) da interpretazione AI (Gemini). Integrato nella Knowledge Base esistente di consultant e client.

**Problema risolto:** Analizzare milioni di righe di dati (es. 5M token) senza passarli nel prompt AI, ottenendo calcoli precisi e spiegazioni intelligenti.

**Caso d'uso principale:** Ristorante che carica dati vendite (DDTRIGHE, PRODOTTI) e chiede "Qual è il margine per piatto?" - l'AI calcola correttamente su tutte le righe.

---

## ⚠️ Decisioni Tecniche Critiche (Gennaio 2026)

Dopo analisi approfondita con ricerche web e best practices 2024-2025, le seguenti decisioni architetturali sono **obbligatorie**:

| Area | Problema | Soluzione |
|------|----------|-----------|
| **Excel Parsing** | `xlsx` (SheetJS) carica tutto in RAM → crash su 50MB+ | Usare **ExcelJS con streaming** |
| **Tabelle Dinamiche** | Drizzle ORM non supporta DDL runtime | Usare **raw SQL con sanitizzazione rigorosa** |
| **Sicurezza RLS** | Superuser bypassa RLS | Creare ruolo **app_user** (NON superuser) |
| **RLS Views** | Views non rispettano RLS di default | Usare `security_invoker = true` |
| **Connection Pool** | Context tenant può leakare tra request | Usare **SET LOCAL** in transazioni |
| **Progress Updates** | WebSocket è overkill per flusso unidirezionale | Usare **SSE (Server-Sent Events)** |
| **AI Validation** | AI può rispondere senza chiamare tool | Validare risposta e **forzare retry** |
| **Column Discovery** | Chiamare AI per ogni colonna è lento e costoso | **Pattern detection PRIMA** (template + regex), AI solo per <80% confidence |
| **Automazione 1800** | Troppi click manuali | **Auto-conferma se confidence >= 85%** |

**Dipendenze NPM richieste:**
```bash
npm install exceljs chardet better-sse
```

Per dettagli completi, vedere le sezioni specifiche e il documento `docs/RDP-compute-first-analysis-review.md`.

---

## Architettura

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         FLUSSO COMPLETO                                  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  1. UPLOAD                                                               │
│  ┌──────────┐                                                            │
│  │  Excel   │ ──► Cliente carica file (più fogli supportati)            │
│  │  CSV     │                                                            │
│  └──────────┘                                                            │
│       │                                                                  │
│       ▼                                                                  │
│  2. AUTO-DISCOVERY                                                       │
│  ┌──────────────────────────────────────────────────────────┐           │
│  │  AI analizza prime 100 righe + nomi colonne              │           │
│  │  Genera dizionario automatico:                           │           │
│  │    COD_ART → codice_articolo                             │           │
│  │    IMP_TOT → importo_totale (€)                          │           │
│  │    QTA → quantità                                        │           │
│  └──────────────────────────────────────────────────────────┘           │
│       │                                                                  │
│       ▼                                                                  │
│  3. CONFERMA UTENTE                                                      │
│  ┌──────────────────────────────────────────────────────────┐           │
│  │  Preview: "Ho capito che COD_ART è il codice articolo"   │           │
│  │  Cliente può correggere se sbagliato                     │           │
│  │  [Conferma e Importa]                                    │           │
│  └──────────────────────────────────────────────────────────┘           │
│       │                                                                  │
│       ▼                                                                  │
│  4. IMPORT IN SUPABASE                                                   │
│  ┌──────────────────────────────────────────────────────────┐           │
│  │  Crea tabella: client_datasets_{clientId}_{datasetName}  │           │
│  │  Inserisce tutte le righe                                │           │
│  │  Salva metadata + dizionario colonne                     │           │
│  └──────────────────────────────────────────────────────────┘           │
│       │                                                                  │
│       ▼                                                                  │
│  5. SEMANTIC LAYER (Auto-generato)                                       │
│  ┌──────────────────────────────────────────────────────────┐           │
│  │  AI suggerisce metriche basate sulle colonne:            │           │
│  │    - fatturato = SUM(importo_totale)                     │           │
│  │    - quantita_totale = SUM(quantita)                     │           │
│  │    - ticket_medio = fatturato / COUNT(DISTINCT doc)      │           │
│  │  Cliente può aggiungere/modificare metriche              │           │
│  └──────────────────────────────────────────────────────────┘           │
│       │                                                                  │
│       ▼                                                                  │
│  6. QUERY & ANALISI                                                      │
│  ┌──────────────────────────────────────────────────────────┐           │
│  │  Utente: "Qual è il fatturato di dicembre?"              │           │
│  │       │                                                   │           │
│  │       ▼                                                   │           │
│  │  Gemini (planner): Chiama get_metric("fatturato",        │           │
│  │                    filters: {month: "dicembre"})          │           │
│  │       │                                                   │           │
│  │       ▼                                                   │           │
│  │  Backend: Esegue SQL su Supabase                         │           │
│  │    SELECT SUM(importo_totale) FROM client_datasets_...   │           │
│  │    WHERE EXTRACT(MONTH FROM data) = 12                   │           │
│  │       │                                                   │           │
│  │       ▼                                                   │           │
│  │  Gemini (explainer): "Il fatturato di dicembre è         │           │
│  │    €45.320, in aumento del 12% rispetto a novembre..."   │           │
│  └──────────────────────────────────────────────────────────┘           │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Database Schema (Supabase/PostgreSQL)

### Tabelle Nuove

```sql
-- ============================================================
-- 1. METADATA DEI DATASET CARICATI
-- ============================================================
CREATE TABLE client_data_datasets (
  id SERIAL PRIMARY KEY,
  
  -- Ownership (multi-tenant)
  consultant_id INTEGER REFERENCES users(id),
  client_id INTEGER REFERENCES clients(id),
  
  -- Info dataset
  name VARCHAR(255) NOT NULL,                    -- es: "DDTRIGHE", "PRODOTTI"
  original_filename VARCHAR(500),                -- es: "vendite_2024.xlsx"
  sheet_name VARCHAR(255),                       -- se Excel multi-foglio
  table_name VARCHAR(255) NOT NULL UNIQUE,       -- es: "cdd_123_456_ddtrighe"
  
  -- Schema discovery
  column_mapping JSONB NOT NULL,                 -- dizionario colonne
  original_columns TEXT[],                       -- nomi originali
  detected_types JSONB,                          -- tipi rilevati per colonna
  
  -- Stats
  row_count INTEGER DEFAULT 0,
  file_size_bytes INTEGER,
  
  -- Status
  status VARCHAR(50) DEFAULT 'pending',          -- pending, processing, ready, error
  error_message TEXT,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  last_queried_at TIMESTAMP
);

-- ============================================================
-- 2. SEMANTIC LAYER - METRICHE DEFINITE
-- ============================================================
CREATE TABLE client_data_metrics (
  id SERIAL PRIMARY KEY,
  dataset_id INTEGER REFERENCES client_data_datasets(id) ON DELETE CASCADE,
  
  -- Definizione metrica
  name VARCHAR(100) NOT NULL,                    -- es: "fatturato"
  display_name VARCHAR(255),                     -- es: "Fatturato Totale"
  description TEXT,                              -- es: "Somma degli importi netti"
  
  -- Formula SQL
  formula TEXT NOT NULL,                         -- es: "SUM(importo_totale)"
  formula_type VARCHAR(50) DEFAULT 'aggregate',  -- aggregate, calculated, ratio
  
  -- Colonne coinvolte (per validazione)
  source_columns TEXT[],                         -- es: ["importo_totale"]
  
  -- Formattazione output
  output_type VARCHAR(50) DEFAULT 'number',      -- number, currency, percentage, integer
  decimal_places INTEGER DEFAULT 2,
  
  -- Auto-generato o manuale
  is_auto_generated BOOLEAN DEFAULT FALSE,
  
  created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- 3. DIMENSIONI PER BREAKDOWN
-- ============================================================
CREATE TABLE client_data_dimensions (
  id SERIAL PRIMARY KEY,
  dataset_id INTEGER REFERENCES client_data_datasets(id) ON DELETE CASCADE,
  
  column_name VARCHAR(255) NOT NULL,             -- colonna nel DB
  display_name VARCHAR(255),                     -- nome user-friendly
  dimension_type VARCHAR(50),                    -- date, category, numeric_range
  
  -- Per date
  date_granularities TEXT[],                     -- ['day', 'week', 'month', 'year']
  
  -- Per categorie
  distinct_values_count INTEGER,
  sample_values TEXT[],                          -- primi 10 valori esempio
  
  created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- 4. QUERY LOG (per audit e cache)
-- ============================================================
CREATE TABLE client_data_query_log (
  id SERIAL PRIMARY KEY,
  dataset_id INTEGER REFERENCES client_data_datasets(id),
  
  -- Chi ha fatto la query
  user_id INTEGER REFERENCES users(id),
  
  -- Dettagli query
  tool_name VARCHAR(100),                        -- get_metric, breakdown, top_bottom
  tool_params JSONB,                             -- parametri passati
  generated_sql TEXT,                            -- SQL eseguito
  
  -- Risultato
  result JSONB,
  execution_time_ms INTEGER,
  row_count INTEGER,
  
  -- Errori
  error_message TEXT,
  
  created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- 5. INDICI PER PERFORMANCE
-- ============================================================
CREATE INDEX idx_datasets_consultant ON client_data_datasets(consultant_id);
CREATE INDEX idx_datasets_client ON client_data_datasets(client_id);
CREATE INDEX idx_datasets_status ON client_data_datasets(status);
CREATE INDEX idx_metrics_dataset ON client_data_metrics(dataset_id);
CREATE INDEX idx_dimensions_dataset ON client_data_dimensions(dataset_id);
CREATE INDEX idx_query_log_dataset ON client_data_query_log(dataset_id);
CREATE INDEX idx_query_log_created ON client_data_query_log(created_at);
```

### Tabelle Dinamiche (Create per ogni dataset)

Quando un cliente carica un Excel, il sistema crea una tabella dedicata:

```sql
-- Pattern: cdd_{consultantId}_{clientId}_{datasetName}
-- Esempio per Riccardo Goghero (consultant 5, client 123, dataset "ddtrighe")

CREATE TABLE cdd_5_123_ddtrighe (
  id SERIAL PRIMARY KEY,
  
  -- Colonne originali mappate
  codice_articolo VARCHAR(100),
  descrizione TEXT,
  quantita INTEGER,
  importo_totale DECIMAL(12,2),
  data_documento DATE,
  -- ... altre colonne dal file
  
  -- Metadata
  _row_number INTEGER,                           -- riga originale nel file
  _imported_at TIMESTAMP DEFAULT NOW()
);

-- Indici automatici su colonne data e categoriche
CREATE INDEX idx_cdd_5_123_ddtrighe_data ON cdd_5_123_ddtrighe(data_documento);
```

---

## Backend API

### Nuovi Endpoint

```
POST   /api/client-data/upload              Upload Excel/CSV
GET    /api/client-data/datasets            Lista dataset del cliente
GET    /api/client-data/datasets/:id        Dettaglio dataset
DELETE /api/client-data/datasets/:id        Elimina dataset
POST   /api/client-data/datasets/:id/confirm-mapping  Conferma dizionario
PUT    /api/client-data/datasets/:id/metrics  Aggiorna metriche

POST   /api/client-data/query/get-metric       Tool: singola metrica
POST   /api/client-data/query/breakdown        Tool: metrica per dimensione
POST   /api/client-data/query/top-bottom       Tool: top/bottom N
POST   /api/client-data/query/compare-periods  Tool: confronto periodi
POST   /api/client-data/query/profile          Tool: profilo dataset
POST   /api/client-data/query/natural          Query in linguaggio naturale (Gemini)
```

### File Backend da Creare

```
server/
├── routes/
│   └── client-data-router.ts          # Tutti gli endpoint
├── services/
│   └── client-data/
│       ├── upload-processor.ts        # Parse Excel/CSV
│       ├── column-discovery.ts        # AI auto-discovery colonne
│       ├── table-generator.ts         # Crea tabelle dinamiche
│       ├── metric-suggester.ts        # AI suggerisce metriche
│       └── query-executor.ts          # Esegue query SQL
├── ai/
│   └── data-analysis/
│       ├── query-planner.ts           # Gemini decide quali tool
│       ├── result-explainer.ts        # Gemini spiega risultati
│       └── tool-definitions.ts        # Definizioni tool per Gemini
└── types/
    └── client-data.ts                 # TypeScript types
```

### Dettaglio Servizi

#### 1. upload-processor.ts

**IMPORTANTE:** Usare **ExcelJS con streaming** per file grandi (non xlsx/SheetJS che carica tutto in RAM).

```typescript
// Dipendenze: npm install exceljs chardet

import ExcelJS from 'exceljs';
import chardet from 'chardet';

interface UploadResult {
  sheets: Array<{
    name: string;
    columns: string[];
    sampleRows: any[];      // Prime 100 righe per preview
    rowCount: number;
  }>;
  fileSize: number;
  originalFilename: string;
}

/**
 * Processa file Excel/CSV con streaming per supportare file fino a 50MB
 * senza esaurire la memoria.
 */
async function processUpload(filePath: string, filename: string): Promise<UploadResult> {
  const result: UploadResult = {
    sheets: [],
    fileSize: 0,
    originalFilename: filename
  };

  if (filename.endsWith('.csv')) {
    // CSV: rileva encoding e processa
    const encoding = chardet.detectFileSync(filePath) || 'utf-8';
    return processCSV(filePath, encoding);
  }

  // Excel: usa streaming per file grandi
  const workbookReader = new ExcelJS.stream.xlsx.WorkbookReader(filePath, {
    worksheets: 'emit',
    sharedStrings: 'cache',
    hyperlinks: 'ignore',
    styles: 'ignore',
  });

  for await (const worksheetReader of workbookReader) {
    const sheetData = {
      name: worksheetReader.name,
      columns: [] as string[],
      sampleRows: [] as any[],
      rowCount: 0
    };

    let isFirstRow = true;
    for await (const row of worksheetReader) {
      if (isFirstRow) {
        // Prima riga = header
        sheetData.columns = (row.values as any[]).slice(1).map(v => String(v || ''));
        isFirstRow = false;
      } else {
        sheetData.rowCount++;
        // Salva solo prime 100 righe per preview
        if (sheetData.sampleRows.length < 100) {
          sheetData.sampleRows.push((row.values as any[]).slice(1));
        }
      }
    }

    result.sheets.push(sheetData);
  }

  return result;
}

/**
 * Import batch: inserisce righe 1000 alla volta per evitare timeout
 */
async function importWithBatching(
  filePath: string,
  tableName: string,
  columnMapping: ColumnMapping[],
  onProgress: (progress: number) => void
): Promise<{ rowCount: number }> {
  const workbookReader = new ExcelJS.stream.xlsx.WorkbookReader(filePath);
  let totalRows = 0;
  let batch: any[] = [];
  const BATCH_SIZE = 1000;

  for await (const worksheetReader of workbookReader) {
    let isFirstRow = true;
    for await (const row of worksheetReader) {
      if (isFirstRow) {
        isFirstRow = false;
        continue; // Skip header
      }

      batch.push(mapRowToColumns(row.values, columnMapping));
      totalRows++;

      if (batch.length >= BATCH_SIZE) {
        await insertBatch(tableName, batch);
        batch = [];
        onProgress(totalRows);
      }
    }
  }

  // Insert remaining rows
  if (batch.length > 0) {
    await insertBatch(tableName, batch);
  }

  return { rowCount: totalRows };
}
```

#### 2. column-discovery.ts

**STRATEGIA:** Pattern detection veloce PRIMA, AI solo per casi ambigui (<80% confidence).

```typescript
interface ColumnMapping {
  original: string;           // Nome originale: "COD_ART"
  mapped: string;             // Nome mappato: "codice_articolo"
  type: 'string' | 'integer' | 'decimal' | 'date' | 'boolean';
  description: string;        // "Codice identificativo dell'articolo"
  sampleValues: string[];     // ["A001", "B002", "C003"]
  nullPercentage: number;     // % valori nulli
  confidence: number;         // 0-1 quanto è sicura l'inferenza
  inferenceMethod: 'pattern' | 'ai' | 'template';  // Come è stato rilevato
}

// Pattern comuni per inferenza veloce (NO AI call)
const TYPE_PATTERNS = {
  email: /^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/,
  date_iso: /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2})?$/,
  date_it: /^\d{2}\/\d{2}\/\d{4}$/,
  date_us: /^\d{2}-\d{2}-\d{4}$/,
  integer: /^-?\d+$/,
  decimal: /^-?\d+[.,]\d+$/,
  boolean: /^(true|false|si|no|yes|vero|falso|0|1)$/i,
  currency: /^[€$£]?\s*-?\d+([.,]\d{2})?$/,
  phone: /^[\+]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{4,6}$/,
};

// Template colonne comuni (gestionali ristoranti italiani)
const KNOWN_COLUMN_TEMPLATES: Record<string, Partial<ColumnMapping>> = {
  'COD_ART': { mapped: 'codice_articolo', type: 'string', description: 'Codice articolo' },
  'DESC_ART': { mapped: 'descrizione', type: 'string', description: 'Descrizione articolo' },
  'QTA': { mapped: 'quantita', type: 'integer', description: 'Quantità' },
  'IMP_TOT': { mapped: 'importo_totale', type: 'decimal', description: 'Importo totale (€)' },
  'IMP_UNIT': { mapped: 'prezzo_unitario', type: 'decimal', description: 'Prezzo unitario' },
  'DT_DOC': { mapped: 'data_documento', type: 'date', description: 'Data documento' },
  'COD_CLI': { mapped: 'codice_cliente', type: 'string', description: 'Codice cliente' },
  'RAGSOC': { mapped: 'ragione_sociale', type: 'string', description: 'Ragione sociale' },
  // Aggiungi altri pattern comuni...
};

/**
 * Inferenza tipo colonna con pattern detection (veloce, no AI)
 */
function inferColumnTypeByPattern(values: any[]): { type: string; confidence: number } {
  const sample = values.slice(0, 100).filter(v => v != null && String(v).trim() !== '');
  if (sample.length === 0) return { type: 'string', confidence: 0.5 };

  for (const [typeName, regex] of Object.entries(TYPE_PATTERNS)) {
    const matches = sample.filter(v => regex.test(String(v)));
    const confidence = matches.length / sample.length;
    if (confidence >= 0.8) {
      return { type: typeName, confidence };
    }
  }

  // Default: string
  return { type: 'string', confidence: 1.0 };
}

/**
 * Discovery colonne: template → pattern → AI (fallback)
 */
async function discoverColumns(
  columns: string[], 
  sampleRows: any[]
): Promise<ColumnMapping[]> {
  const results: ColumnMapping[] = [];

  for (let i = 0; i < columns.length; i++) {
    const colName = columns[i].toUpperCase().trim();
    const values = sampleRows.map(row => row[i]);
    const nullCount = values.filter(v => v == null || String(v).trim() === '').length;
    const nullPercentage = nullCount / values.length;
    const sampleValues = values.filter(v => v != null).slice(0, 5).map(String);

    // 1. Controlla template noti (istantaneo)
    if (KNOWN_COLUMN_TEMPLATES[colName]) {
      const template = KNOWN_COLUMN_TEMPLATES[colName];
      results.push({
        original: columns[i],
        mapped: template.mapped!,
        type: template.type as any,
        description: template.description!,
        sampleValues,
        nullPercentage,
        confidence: 0.95,
        inferenceMethod: 'template'
      });
      continue;
    }

    // 2. Inferenza pattern (veloce)
    const patternResult = inferColumnTypeByPattern(values);
    if (patternResult.confidence >= 0.8) {
      results.push({
        original: columns[i],
        mapped: sanitizeColumnName(columns[i]),
        type: mapPatternToType(patternResult.type),
        description: `Colonna ${columns[i]}`,
        sampleValues,
        nullPercentage,
        confidence: patternResult.confidence,
        inferenceMethod: 'pattern'
      });
      continue;
    }

    // 3. Solo se confidence < 0.8, chiama AI
    const aiResult = await discoverColumnWithAI(columns[i], values);
    results.push({
      ...aiResult,
      sampleValues,
      nullPercentage,
      inferenceMethod: 'ai'
    });
  }

  return results;
}

// Calcola confidence complessiva per auto-conferma
function calculateOverallConfidence(mappings: ColumnMapping[]): number {
  const avgConfidence = mappings.reduce((sum, m) => sum + m.confidence, 0) / mappings.length;
  const lowConfidenceCount = mappings.filter(m => m.confidence < 0.7).length;
  
  // Penalizza se ci sono molte colonne a bassa confidence
  const penalty = lowConfidenceCount * 0.05;
  return Math.max(0, avgConfidence - penalty);
}

// Se confidence >= 0.85, auto-conferma senza chiedere all'utente
const AUTO_CONFIRM_THRESHOLD = 0.85;
```

**Prompt AI per discovery (usato solo come fallback):**
```
Analizza queste colonne di un file dati e determina:
1. Un nome normalizzato (snake_case, italiano)
2. Il tipo di dato
3. Una breve descrizione

Colonne: ${columns.join(', ')}

Esempi di dati:
${sampleRows.slice(0, 10).map(row => JSON.stringify(row)).join('\n')}

Rispondi in JSON con questo formato:
[
  {
    "original": "nome originale",
    "mapped": "nome_normalizzato",
    "type": "string|integer|decimal|date|boolean",
    "description": "descrizione breve"
  }
]
```

#### 3. table-generator.ts

**IMPORTANTE:** Drizzle ORM NON supporta tabelle dinamiche. Usare **raw SQL con sanitizzazione rigorosa**.

```typescript
import { sql } from 'drizzle-orm';
import crypto from 'crypto';

// ============================================================
// SICUREZZA: Sanitizzazione nomi tabelle/colonne
// ============================================================

const MAX_IDENTIFIER_LENGTH = 63; // Limite PostgreSQL
const SAFE_IDENTIFIER_REGEX = /^[a-z_][a-z0-9_]*$/;

/**
 * Sanitizza nome per uso come identificatore SQL (tabella/colonna)
 * CRITICO per prevenire SQL injection
 */
function sanitizeIdentifier(input: string): string {
  // 1. Lowercase
  let safe = input.toLowerCase();
  
  // 2. Rimuovi caratteri non permessi
  safe = safe.replace(/[^a-z0-9_]/g, '_');
  
  // 3. Rimuovi underscore multipli consecutivi
  safe = safe.replace(/_+/g, '_');
  
  // 4. Rimuovi underscore iniziali/finali
  safe = safe.replace(/^_+|_+$/g, '');
  
  // 5. Assicura che inizi con lettera
  if (!/^[a-z]/.test(safe)) {
    safe = 'col_' + safe;
  }
  
  // 6. Tronca se troppo lungo
  if (safe.length > MAX_IDENTIFIER_LENGTH) {
    safe = safe.substring(0, MAX_IDENTIFIER_LENGTH);
  }
  
  // 7. Validazione finale
  if (!SAFE_IDENTIFIER_REGEX.test(safe)) {
    throw new Error(`Identificatore non valido dopo sanitizzazione: ${input}`);
  }
  
  return safe;
}

/**
 * Genera nome tabella sicuro con pattern fisso
 */
function generateTableName(consultantId: number, clientId: number, datasetName: string): string {
  const safeName = sanitizeIdentifier(datasetName);
  const tableName = `cdd_${consultantId}_${clientId}_${safeName}`;
  
  if (tableName.length > MAX_IDENTIFIER_LENGTH) {
    // Se troppo lungo, usa hash
    const hash = crypto.createHash('md5').update(datasetName).digest('hex').substring(0, 8);
    return `cdd_${consultantId}_${clientId}_${hash}`;
  }
  
  return tableName;
}

/**
 * Mappa tipo inferito a tipo PostgreSQL
 */
function mapToPostgresType(type: string): string {
  const typeMap: Record<string, string> = {
    'string': 'TEXT',
    'integer': 'INTEGER',
    'decimal': 'DECIMAL(18,4)',
    'date': 'DATE',
    'date_iso': 'TIMESTAMP',
    'date_it': 'DATE',
    'boolean': 'BOOLEAN',
    'currency': 'DECIMAL(12,2)',
    'email': 'VARCHAR(255)',
    'phone': 'VARCHAR(50)',
  };
  return typeMap[type] || 'TEXT';
}

// ============================================================
// CREAZIONE TABELLA (Raw SQL)
// ============================================================

async function createDataTable(
  consultantId: number,
  clientId: number,
  datasetName: string,
  columnMapping: ColumnMapping[]
): Promise<{ tableName: string }> {
  
  const tableName = generateTableName(consultantId, clientId, datasetName);
  
  // Costruisci DDL con colonne sanitizzate
  const columnDefs = columnMapping.map(col => {
    const safeColName = sanitizeIdentifier(col.mapped);
    const pgType = mapToPostgresType(col.type);
    return `${safeColName} ${pgType}`;
  }).join(',\n    ');
  
  // Esegui CREATE TABLE con raw SQL
  // NOTA: Non usare Drizzle schema, usa db.execute direttamente
  await db.execute(sql.raw(`
    CREATE TABLE IF NOT EXISTS ${tableName} (
      id SERIAL PRIMARY KEY,
      ${columnDefs},
      _row_number INTEGER,
      _imported_at TIMESTAMP DEFAULT NOW()
    )
  `));
  
  // Crea indice su colonne data (se presenti)
  const dateColumns = columnMapping.filter(c => 
    c.type === 'date' || c.type === 'date_iso' || c.type === 'date_it'
  );
  
  for (const col of dateColumns) {
    const safeColName = sanitizeIdentifier(col.mapped);
    await db.execute(sql.raw(`
      CREATE INDEX IF NOT EXISTS idx_${tableName}_${safeColName} 
      ON ${tableName}(${safeColName})
    `));
  }
  
  return { tableName };
}

// ============================================================
// INSERT CON TRANSAZIONE E ROLLBACK
// ============================================================

async function importDataWithRollback(
  tableName: string,
  columnMapping: ColumnMapping[],
  rows: any[],
  onProgress: (count: number) => void
): Promise<{ rowCount: number }> {
  
  const BATCH_SIZE = 1000;
  let totalInserted = 0;
  
  // Usa transazione per rollback automatico in caso di errore
  await db.transaction(async (tx) => {
    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE);
      
      // Costruisci INSERT con placeholders
      const columns = columnMapping.map(c => sanitizeIdentifier(c.mapped)).join(', ');
      const placeholders = batch.map((_, rowIdx) => 
        `(${columnMapping.map((_, colIdx) => `$${rowIdx * columnMapping.length + colIdx + 1}`).join(', ')}, ${i + rowIdx + 1})`
      ).join(', ');
      
      const values = batch.flatMap(row => 
        columnMapping.map((col, idx) => row[idx])
      );
      
      await tx.execute(sql.raw(`
        INSERT INTO ${tableName} (${columns}, _row_number)
        VALUES ${placeholders}
      `), values);
      
      totalInserted += batch.length;
      onProgress(totalInserted);
    }
  });
  
  return { rowCount: totalInserted };
}

// ============================================================
// CLEANUP TABELLE ORFANE
// ============================================================

async function dropOrphanTables(): Promise<number> {
  // Trova tabelle cdd_* senza record in client_data_datasets
  const orphans = await db.execute(sql`
    SELECT tablename FROM pg_tables 
    WHERE schemaname = 'public' 
    AND tablename LIKE 'cdd_%'
    AND tablename NOT IN (
      SELECT table_name FROM client_data_datasets WHERE status = 'ready'
    )
  `);
  
  let dropped = 0;
  for (const row of orphans.rows) {
    const tableName = row.tablename as string;
    // Verifica che sia effettivamente un pattern cdd_*
    if (/^cdd_\d+_\d+_[a-z0-9_]+$/.test(tableName)) {
      await db.execute(sql.raw(`DROP TABLE IF EXISTS ${tableName}`));
      dropped++;
      console.log(`[Cleanup] Dropped orphan table: ${tableName}`);
    }
  }
  
  return dropped;
}
```

#### 4. metric-suggester.ts

```typescript
interface SuggestedMetric {
  name: string;
  displayName: string;
  formula: string;
  description: string;
  sourceColumns: string[];
  outputType: 'number' | 'currency' | 'percentage';
}

async function suggestMetrics(
  columns: ColumnMapping[]
): Promise<SuggestedMetric[]>
```

**Logica AI:**
- Se c'è colonna `importo/totale/prezzo` → suggerisci SUM, AVG
- Se c'è colonna `quantità/qta` → suggerisci SUM, COUNT
- Se c'è colonna data → suggerisci breakdown temporali
- Se ci sono colonne numeriche multiple → suggerisci rapporti

#### 5. query-executor.ts

```typescript
interface QueryResult {
  data: any[];
  rowCount: number;
  executionTimeMs: number;
  generatedSql: string;
  queryId: string;
}

// Tool: get_metric
async function getMetric(params: {
  datasetId: number;
  metric: string;
  filters?: Record<string, any>;
}): Promise<QueryResult>

// Tool: breakdown
async function breakdown(params: {
  datasetId: number;
  metric: string;
  by: string;
  filters?: Record<string, any>;
  limit?: number;
}): Promise<QueryResult>

// Tool: top_bottom
async function topBottom(params: {
  datasetId: number;
  metric: string;
  by: string;
  order: 'asc' | 'desc';
  limit: number;
  filters?: Record<string, any>;
}): Promise<QueryResult>

// Tool: compare_periods
async function comparePeriods(params: {
  datasetId: number;
  metric: string;
  periodA: { start: string; end: string };
  periodB: { start: string; end: string };
  by?: string;
}): Promise<QueryResult>

// Tool: profile
async function profileDataset(params: {
  datasetId: number;
}): Promise<{
  rowCount: number;
  columns: Array<{
    name: string;
    type: string;
    nullCount: number;
    distinctCount: number;
    min?: any;
    max?: any;
  }>;
  dateRange?: { min: string; max: string };
}>
```

---

## AI Integration (Gemini 3 Pro)

### Tool Definitions per Function Calling

```typescript
// server/ai/data-analysis/tool-definitions.ts

export const dataAnalysisTools = [
  {
    name: "get_metric",
    description: "Ottieni il valore di una metrica aggregata dal dataset",
    parameters: {
      type: "object",
      properties: {
        metric: {
          type: "string",
          description: "Nome della metrica (es: fatturato, quantita_totale)"
        },
        filters: {
          type: "object",
          description: "Filtri opzionali",
          properties: {
            date_from: { type: "string", format: "date" },
            date_to: { type: "string", format: "date" },
            month: { type: "integer", minimum: 1, maximum: 12 },
            year: { type: "integer" },
            category: { type: "string" }
          }
        }
      },
      required: ["metric"]
    }
  },
  {
    name: "breakdown_metric",
    description: "Suddividi una metrica per una dimensione (es: fatturato per mese)",
    parameters: {
      type: "object",
      properties: {
        metric: { type: "string" },
        by: { 
          type: "string",
          description: "Dimensione per il breakdown (es: mese, categoria, prodotto)"
        },
        filters: { type: "object" },
        limit: { type: "integer", default: 20 }
      },
      required: ["metric", "by"]
    }
  },
  {
    name: "top_bottom",
    description: "Trova i top o bottom N elementi per una metrica",
    parameters: {
      type: "object",
      properties: {
        metric: { type: "string" },
        by: { type: "string" },
        order: { type: "string", enum: ["top", "bottom"] },
        limit: { type: "integer", default: 10 },
        filters: { type: "object" }
      },
      required: ["metric", "by", "order"]
    }
  },
  {
    name: "compare_periods",
    description: "Confronta una metrica tra due periodi temporali",
    parameters: {
      type: "object",
      properties: {
        metric: { type: "string" },
        period_a: { 
          type: "object",
          properties: {
            label: { type: "string" },
            start: { type: "string", format: "date" },
            end: { type: "string", format: "date" }
          }
        },
        period_b: {
          type: "object",
          properties: {
            label: { type: "string" },
            start: { type: "string", format: "date" },
            end: { type: "string", format: "date" }
          }
        },
        by: { type: "string", description: "Dimensione opzionale per breakdown" }
      },
      required: ["metric", "period_a", "period_b"]
    }
  },
  {
    name: "profile_dataset",
    description: "Ottieni informazioni generali sul dataset (righe, colonne, range date)",
    parameters: {
      type: "object",
      properties: {}
    }
  }
];
```

### System Prompt per Gemini

```typescript
// server/ai/data-analysis/query-planner.ts

function buildSystemPrompt(dataset: DatasetInfo, metrics: MetricInfo[]): string {
  return `Sei un analista dati esperto. Il tuo compito è analizzare i dati di un'azienda e rispondere alle domande dell'utente.

## REGOLE FONDAMENTALI

1. NON inventare MAI numeri o dati
2. USA SEMPRE i tool disponibili per ottenere dati reali
3. Se una domanda richiede calcoli, DEVI usare i tool
4. Ogni risposta deve indicare: metriche usate, periodo, eventuali filtri

## DATASET DISPONIBILE

Nome: ${dataset.name}
Righe totali: ${dataset.rowCount}
Periodo dati: ${dataset.dateRange?.min} - ${dataset.dateRange?.max}

Colonne disponibili:
${dataset.columns.map(c => `- ${c.mapped}: ${c.description} (${c.type})`).join('\n')}

## METRICHE DEFINITE

${metrics.map(m => `- ${m.name}: ${m.description}
  Formula: ${m.formula}`).join('\n\n')}

## TOOL DISPONIBILI

- get_metric: Per ottenere il valore di una singola metrica
- breakdown_metric: Per vedere una metrica suddivisa per dimensione
- top_bottom: Per trovare i migliori/peggiori N elementi
- compare_periods: Per confrontare due periodi
- profile_dataset: Per info generali sul dataset

## ESEMPIO DI RISPOSTA CORRETTA

Domanda: "Qual è il fatturato di dicembre?"

1. Uso get_metric("fatturato", filters: {month: 12})
2. Risultato: €45.320
3. Risposta: "Il fatturato di dicembre 2024 è stato di €45.320."

## ESEMPIO DI RISPOSTA SBAGLIATA

"Il fatturato di dicembre è circa €40.000" ← MAI inventare numeri senza usare tool!`;
}
```

### Result Explainer

```typescript
// server/ai/data-analysis/result-explainer.ts

async function explainResults(
  userQuestion: string,
  toolResults: ToolResult[],
  dataset: DatasetInfo
): Promise<string> {
  
  const prompt = `L'utente ha chiesto: "${userQuestion}"

Ho eseguito queste query e ottenuto questi risultati:

${toolResults.map(r => `
Tool: ${r.toolName}
Parametri: ${JSON.stringify(r.params)}
Risultato: ${JSON.stringify(r.data)}
`).join('\n')}

Scrivi una risposta chiara e professionale che:
1. Risponda direttamente alla domanda
2. Citi i numeri esatti ottenuti
3. Fornisca contesto o insight utili
4. Se appropriato, suggerisca approfondimenti

NON inventare dati non presenti nei risultati.`;

  return await callGemini(prompt);
}
```

---

## Frontend

### Nuove Pagine/Componenti

```
client/src/
├── pages/
│   ├── consultant/
│   │   └── ClientDatasets.tsx         # Lista dataset per consultant
│   └── client/
│       └── MyDatasets.tsx             # Lista dataset per client
├── components/
│   └── client-data/
│       ├── DatasetUploader.tsx        # Upload con drag&drop
│       ├── ColumnMappingEditor.tsx    # Conferma/modifica mapping
│       ├── MetricsEditor.tsx          # Gestione metriche
│       ├── DatasetPreview.tsx         # Anteprima dati
│       ├── QueryInterface.tsx         # Chat per domande
│       ├── ResultsDisplay.tsx         # Visualizza risultati
│       └── DatasetCard.tsx            # Card singolo dataset
```

### Integrazione con Knowledge Base

**Opzione scelta:** Stessa sezione, tipo file diverso

```
/consultant/knowledge-documents
├── Documenti (RAG)          → File normali
└── Dati Strutturati         → Excel/CSV per analisi

/client/knowledge-documents
├── Documenti (RAG)          → File condivisi dal consultant
└── I Miei Dati              → Excel/CSV caricati dal client
```

### UI Flow

#### 1. Upload Dataset

```
┌─────────────────────────────────────────────────────────────┐
│  Knowledge Base > Dati Strutturati                          │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │                                                      │    │
│  │     📊 Trascina qui il tuo file Excel o CSV         │    │
│  │                                                      │    │
│  │     oppure [Sfoglia file]                           │    │
│  │                                                      │    │
│  │     Formati supportati: .xlsx, .xls, .csv           │    │
│  │     Max 50MB per file                               │    │
│  │                                                      │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                              │
│  Dataset caricati:                                           │
│  ┌──────────────────────────────────────┐                   │
│  │ 📊 DDTRIGHE                          │                   │
│  │ 150.432 righe • Ultimo aggiornamento │                   │
│  │ 2 ore fa • ✅ Pronto                 │                   │
│  │ [Analizza] [Modifica] [Elimina]      │                   │
│  └──────────────────────────────────────┘                   │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

#### 2. Conferma Mapping Colonne

```
┌─────────────────────────────────────────────────────────────┐
│  Conferma Struttura Dati                              [X]   │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Ho analizzato il tuo file. Verifica che abbia capito       │
│  correttamente le colonne:                                   │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ Colonna       │ Interpretazione      │ Tipo    │ ✓  │    │
│  ├───────────────┼─────────────────────┼─────────┼────┤    │
│  │ COD_ART       │ Codice Articolo      │ Testo   │ ✅ │    │
│  │ DESC_ART      │ Descrizione          │ Testo   │ ✅ │    │
│  │ QTA           │ Quantità             │ Numero  │ ✅ │    │
│  │ IMP_TOT       │ Importo Totale (€)   │ Valuta  │ ✅ │    │
│  │ DT_DOC        │ Data Documento       │ Data    │ ✅ │    │
│  │ XYZABC        │ ⚠️ Non riconosciuto  │ ?       │ ✏️ │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                              │
│  Anteprima prime 5 righe:                                   │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ Codice │ Descrizione    │ Qtà │ Importo │ Data      │    │
│  │ A001   │ Carbonara      │ 5   │ €45.00  │ 15/01/24  │    │
│  │ A002   │ Amatriciana    │ 3   │ €36.00  │ 15/01/24  │    │
│  │ ...                                                  │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                              │
│              [Annulla]  [Conferma e Importa]                │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

#### 3. Gestione Metriche

```
┌─────────────────────────────────────────────────────────────┐
│  Metriche Dataset: DDTRIGHE                                  │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Metriche suggerite dall'AI:                                │
│                                                              │
│  ✅ Fatturato Totale                                        │
│     SUM(importo_totale)                                     │
│     [Modifica] [Rimuovi]                                    │
│                                                              │
│  ✅ Quantità Venduta                                        │
│     SUM(quantita)                                           │
│     [Modifica] [Rimuovi]                                    │
│                                                              │
│  ✅ Ticket Medio                                            │
│     Fatturato / COUNT(DISTINCT data_documento)              │
│     [Modifica] [Rimuovi]                                    │
│                                                              │
│  [+ Aggiungi Metrica Personalizzata]                        │
│                                                              │
│                                    [Salva Metriche]         │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

#### 4. Interfaccia Query (Chat)

```
┌─────────────────────────────────────────────────────────────┐
│  Analizza: DDTRIGHE                                         │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ 👤 Qual è stato il fatturato dell'ultimo trimestre? │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ 🤖 Il fatturato dell'ultimo trimestre (ottobre-     │    │
│  │    dicembre 2024) è stato di €156.780.              │    │
│  │                                                      │    │
│  │    Breakdown per mese:                              │    │
│  │    • Ottobre: €48.320 (31%)                         │    │
│  │    • Novembre: €51.240 (33%)                        │    │
│  │    • Dicembre: €57.220 (36%)                        │    │
│  │                                                      │    │
│  │    📈 Trend positivo: +18% rispetto al trimestre    │    │
│  │    precedente.                                       │    │
│  │                                                      │    │
│  │    ───────────────────────────────────────          │    │
│  │    📊 Fonte: Query #Q-12847                         │    │
│  │    📅 Periodo: 01/10/24 - 31/12/24                  │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ 👤 Quali sono i 5 piatti più venduti?               │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ 🤖 I 5 piatti più venduti nel dataset sono:         │    │
│  │                                                      │    │
│  │    1. Carbonara - 2.847 porzioni (€28.470)          │    │
│  │    2. Amatriciana - 2.156 porzioni (€21.560)        │    │
│  │    3. Cacio e Pepe - 1.923 porzioni (€17.307)       │    │
│  │    4. Gricia - 1.654 porzioni (€14.886)             │    │
│  │    5. Tiramisu - 1.432 porzioni (€8.592)            │    │
│  │                                                      │    │
│  │    💡 Insight: I primi romani dominano il menu!     │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ Fai una domanda sui tuoi dati...              [➤]  │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Sicurezza & Multi-Tenant

### Isolamento Dati

1. **Naming convention tabelle:** `cdd_{consultantId}_{clientId}_{dataset}`
2. **Ogni query include WHERE consultant_id/client_id**
3. **Row Level Security (RLS)** su Supabase opzionale

### Validazione

1. **Nomi tabelle sanitizzati** - no SQL injection
2. **Limiti dimensione file** - max 50MB
3. **Limiti righe** - max 1M righe per dataset
4. **Rate limiting** su query - max 100/minuto per utente

### Audit

- Ogni query loggata in `client_data_query_log`
- Tracciabilità completa chi-cosa-quando

---

## Limiti e Considerazioni

### Limiti Tecnici

| Limite | Valore | Motivazione |
|--------|--------|-------------|
| Dimensione file | 50 MB | Performance upload |
| Righe per dataset | 1.000.000 | Performance query |
| Dataset per cliente | 20 | Storage |
| Colonne per dataset | 100 | Complessità schema |
| Query/minuto | 100 | Rate limiting |

### Tipi File Supportati

- ✅ Excel (.xlsx, .xls)
- ✅ CSV (.csv)
- ❌ JSON (futuro)
- ❌ Parquet (futuro)

### Tipi Dati Riconosciuti

- ✅ Testo/Stringhe
- ✅ Numeri interi
- ✅ Numeri decimali
- ✅ Date (vari formati)
- ✅ Valute
- ❌ Array (futuro)
- ❌ JSON nested (futuro)

---

## Task di Implementazione

### Fase 1: Database & Backend Core
1. Creare schema database (tabelle metadata)
2. Implementare upload-processor (parsing Excel/CSV)
3. Implementare column-discovery (AI)
4. Implementare table-generator (creazione tabelle dinamiche)
5. Implementare query-executor (i 5 tool base)

### Fase 2: AI Integration
6. Configurare tool definitions per Gemini
7. Implementare query-planner
8. Implementare result-explainer
9. Endpoint /api/client-data/query/natural

### Fase 3: Frontend
10. DatasetUploader component
11. ColumnMappingEditor component
12. MetricsEditor component
13. QueryInterface component (chat)
14. Integrazione in knowledge-documents pages

### Fase 4: Polish
15. Error handling robusto
16. Logging e monitoring
17. Rate limiting
18. Test end-to-end
19. Documentazione utente

---

## Query Loop Multi-Round (Iterativo)

### Come Funziona

Gemini può eseguire **query multiple in sequenza** fino a ottenere tutti i dati necessari:

```
Utente: "Perché il margine è calato e quali piatti devo sistemare?"
                              ↓
┌─────────────────────────────────────────────────────────────┐
│  ROUND 1                                                     │
│  Tool: get_metric("margine", {month: "dicembre"})           │
│  Tool: get_metric("margine", {month: "novembre"})           │
│  → Risultato: Dic 32%, Nov 41%                              │
└─────────────────────────────────────────────────────────────┘
                              ↓
Gemini: "Ok, è calato del 9%. Devo capire perché..."
                              ↓
┌─────────────────────────────────────────────────────────────┐
│  ROUND 2                                                     │
│  Tool: breakdown("costo_ingredienti", by="categoria")       │
│  → Risultato: Pesce +22%, Carne +15%                        │
└─────────────────────────────────────────────────────────────┘
                              ↓
Gemini: "Capito, costi aumentati. Quali piatti specifici?"
                              ↓
┌─────────────────────────────────────────────────────────────┐
│  ROUND 3                                                     │
│  Tool: top_bottom("margine", by="piatto", order="bottom")   │
│  → Risultato: Risotto tartufo 12%, Bistecca 18%...          │
└─────────────────────────────────────────────────────────────┘
                              ↓
Gemini genera risposta finale completa
```

### Limiti di Sicurezza

| Limite | Valore | Motivazione |
|--------|--------|-------------|
| Max round per domanda | 10 | Evita loop infiniti |
| Max tool call per round | 10 | Performance |
| **Timeout totale** | **5 minuti (300 sec)** | Analisi complesse richiedono tempo |
| Timeout singola query SQL | 30 secondi | Evita query bloccate |

### Progress Indicator Frontend

Durante l'analisi, mostrare stato in tempo reale:

```
┌─────────────────────────────────────────────────┐
│  🔄 Sto analizzando i tuoi dati...              │
│                                                  │
│  ✅ Query 1/4: Fatturato dicembre               │
│  ✅ Query 2/4: Fatturato novembre               │
│  ⏳ Query 3/4: Breakdown costi in corso...      │
│  ⬚ Query 4/4: Top piatti (in attesa)           │
│                                                  │
│  ⏱️ Tempo: 1:23 / 5:00                          │
│  ━━━━━━━━━━━━━━░░░░░░░░░░░░░░ 28%               │
└─────────────────────────────────────────────────┘
```

**Implementazione SSE (Server-Sent Events):**

> **NOTA:** Usare SSE invece di WebSocket. SSE è meglio per questo caso:
> - Unidirezionale (server→client) - perfetto per progress
> - Auto-reconnect built-in nel browser
> - Funziona con HTTP/2
> - Passa firewall aziendali senza problemi
> - Più semplice da implementare e debuggare

```bash
# Dipendenza consigliata
npm install better-sse
```

```typescript
// server/routes/client-data-router.ts
import { createSession } from 'better-sse';

// Endpoint SSE per progress in tempo reale
app.get('/api/client-data/query/natural/stream', authenticateToken, async (req, res) => {
  const session = await createSession(req, res);
  
  // Heartbeat ogni 30 secondi per mantenere connessione viva
  const heartbeat = setInterval(() => {
    session.push({ type: 'heartbeat', timestamp: Date.now() });
  }, 30000);
  
  try {
    const { question, datasetId } = req.query;
    
    await executeNaturalLanguageQuery({
      question: String(question),
      datasetId: Number(datasetId),
      consultantId: req.user.consultantId,
      
      // Callback per ogni step
      onProgress: (progress: AnalysisProgress) => {
        session.push({ type: 'progress', data: progress });
      }
    });
    
  } catch (error) {
    session.push({ 
      type: 'error', 
      message: 'Analisi fallita. Riprova tra qualche minuto.',
      // Mai esporre stack trace!
    });
  } finally {
    clearInterval(heartbeat);
    session.push({ type: 'complete' });
  }
});

// Tipi per eventi progress
interface AnalysisProgress {
  status: 'started' | 'query_running' | 'query_completed' | 'explaining' | 'completed' | 'error';
  currentRound: number;
  totalRoundsEstimate: number;
  currentQuery?: {
    toolName: string;
    description: string;
  };
  completedQueries: Array<{
    toolName: string;
    description: string;
    executionTimeMs: number;
  }>;
  elapsedTimeMs: number;
  timeoutMs: number;  // 300000 (5 min)
}
```

**Frontend: Consumare SSE**

```typescript
// client/src/hooks/useAnalysisStream.ts

export function useAnalysisStream() {
  const [progress, setProgress] = useState<AnalysisProgress | null>(null);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  
  const startAnalysis = useCallback((question: string, datasetId: number) => {
    setProgress(null);
    setError(null);
    
    const url = `/api/client-data/query/natural/stream?question=${encodeURIComponent(question)}&datasetId=${datasetId}`;
    const eventSource = new EventSource(url);
    
    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      switch (data.type) {
        case 'progress':
          setProgress(data.data);
          break;
        case 'result':
          setResult(data.data);
          break;
        case 'error':
          setError(data.message);
          eventSource.close();
          break;
        case 'complete':
          eventSource.close();
          break;
      }
    };
    
    eventSource.onerror = () => {
      setError('Connessione persa. Riprova.');
      eventSource.close();
    };
    
    return () => eventSource.close();
  }, []);
  
  return { progress, result, error, startAnalysis };
}
```

---

## Automazione Massima (Per 1800 Installazioni)

### Principio: "Zero-Click Quando Possibile"

Per scalare a 1800 installazioni, il sistema deve richiedere **intervento manuale minimo**.

### 1. Auto-Riconoscimento Pattern Comuni

Prima di chiamare l'AI, controlla pattern noti:

```typescript
// server/services/client-data/column-templates.ts

const KNOWN_PATTERNS = {
  // Pattern ristoranti italiani (gestionali comuni)
  restaurant_ddtrighe: {
    patterns: ['ddtrighe', 'righe_ddt', 'dettaglio_vendite'],
    columns: {
      'COD_ART': { mapped: 'codice_articolo', type: 'string' },
      'DESC_ART': { mapped: 'descrizione', type: 'string' },
      'QTA': { mapped: 'quantita', type: 'integer' },
      'IMP_TOT': { mapped: 'importo_totale', type: 'decimal' },
      'DT_DOC': { mapped: 'data_documento', type: 'date' },
      'IMP_UNIT': { mapped: 'prezzo_unitario', type: 'decimal' },
      'COD_CLI': { mapped: 'codice_cliente', type: 'string' },
      // ... altri 50+ pattern comuni
    },
    autoMetrics: [
      { name: 'fatturato', formula: 'SUM(importo_totale)', type: 'currency' },
      { name: 'quantita_venduta', formula: 'SUM(quantita)', type: 'integer' },
      { name: 'ticket_medio', formula: 'AVG(importo_totale)', type: 'currency' },
    ]
  },
  // Pattern fatture
  invoice_standard: { ... },
  // Pattern magazzino
  inventory_standard: { ... },
};
```

**Flusso:**
1. Upload file → Controlla se nome file/colonne matchano pattern noto
2. Se match >= 80% → **Auto-conferma senza chiedere**
3. Se match 50-80% → Mostra preview ma pre-compila tutto
4. Se match < 50% → Chiama AI per discovery

### 2. Auto-Conferma Intelligente

```typescript
interface DiscoveryResult {
  columns: ColumnMapping[];
  overallConfidence: number;  // 0-1
  matchedTemplate?: string;
}

// Se confidence >= 0.85, conferma automaticamente
const AUTO_CONFIRM_THRESHOLD = 0.85;

async function processUploadWithAutoConfirm(file: Buffer, filename: string) {
  const discovery = await discoverColumns(file);
  
  if (discovery.overallConfidence >= AUTO_CONFIRM_THRESHOLD) {
    // Auto-conferma senza intervento utente
    await createDataTable(discovery);
    await generateAutoMetrics(discovery);
    return { status: 'ready', autoConfirmed: true };
  } else {
    // Richiedi conferma manuale
    return { status: 'pending_confirmation', discovery };
  }
}
```

### 3. Metriche Auto-Generate

Non chiedere conferma per metriche ovvie:

| Colonna Rilevata | Metrica Auto-Generata | Chiedi Conferma? |
|------------------|----------------------|------------------|
| importo_totale | SUM(importo_totale) as "Fatturato" | ❌ No |
| quantita | SUM(quantita) as "Quantità Totale" | ❌ No |
| prezzo, importo | AVG() as "Prezzo Medio" | ❌ No |
| data | Breakdown per mese/anno | ❌ No |
| costo + ricavo | Margine = ricavo - costo | ⚠️ Solo se entrambi presenti |
| Colonne custom | - | ✅ Chiedi suggerimento |

### 4. Learning dai Consultant

Se un consultant corregge un mapping, salvalo per riutilizzo:

```sql
CREATE TABLE consultant_column_mappings (
  id SERIAL PRIMARY KEY,
  consultant_id INTEGER REFERENCES users(id),
  original_column VARCHAR(255),
  mapped_column VARCHAR(255),
  mapped_type VARCHAR(50),
  usage_count INTEGER DEFAULT 1,
  created_at TIMESTAMP DEFAULT NOW()
);
```

Prossima volta che quel consultant carica un file con stessa colonna → usa mapping salvato.

---

## Sicurezza Avanzata (Per 1800 Installazioni)

### 1. Prevenzione SQL Injection

**CRITICO:** I nomi tabelle/colonne sono generati dinamicamente. Sanitizzare TUTTO.

```typescript
// server/services/client-data/sql-sanitizer.ts

// Whitelist caratteri permessi
const SAFE_IDENTIFIER_REGEX = /^[a-z][a-z0-9_]*$/;
const MAX_IDENTIFIER_LENGTH = 63; // Limite PostgreSQL

function sanitizeIdentifier(input: string): string {
  // 1. Lowercase
  let safe = input.toLowerCase();
  
  // 2. Rimuovi caratteri non permessi
  safe = safe.replace(/[^a-z0-9_]/g, '_');
  
  // 3. Rimuovi underscore multipli
  safe = safe.replace(/_+/g, '_');
  
  // 4. Assicura che inizi con lettera
  if (!/^[a-z]/.test(safe)) {
    safe = 'col_' + safe;
  }
  
  // 5. Tronca se troppo lungo
  if (safe.length > MAX_IDENTIFIER_LENGTH) {
    safe = safe.substring(0, MAX_IDENTIFIER_LENGTH);
  }
  
  // 6. Valida finale
  if (!SAFE_IDENTIFIER_REGEX.test(safe)) {
    throw new Error(`Invalid identifier: ${input}`);
  }
  
  return safe;
}

// Per nomi tabelle: usa sempre formato fisso
function generateTableName(consultantId: number, clientId: number, datasetName: string): string {
  const safeName = sanitizeIdentifier(datasetName);
  return `cdd_${consultantId}_${clientId}_${safeName}`;
}
```

### 2. Validazione Formule Metriche

L'utente NON può scrivere SQL arbitrario. Solo funzioni permesse:

```typescript
const ALLOWED_FUNCTIONS = [
  'SUM', 'AVG', 'COUNT', 'MIN', 'MAX',
  'ROUND', 'ABS', 'COALESCE',
  'EXTRACT', 'DATE_TRUNC'
];

const ALLOWED_OPERATORS = ['+', '-', '*', '/', '(', ')'];

function validateFormula(formula: string, allowedColumns: string[]): boolean {
  // 1. Controlla funzioni
  const functionMatches = formula.match(/[A-Z_]+\s*\(/g) || [];
  for (const fn of functionMatches) {
    const fnName = fn.replace(/\s*\($/, '');
    if (!ALLOWED_FUNCTIONS.includes(fnName)) {
      throw new Error(`Funzione non permessa: ${fnName}`);
    }
  }
  
  // 2. Controlla colonne
  const columnMatches = formula.match(/[a-z_][a-z0-9_]*/g) || [];
  for (const col of columnMatches) {
    if (!allowedColumns.includes(col) && !ALLOWED_FUNCTIONS.map(f => f.toLowerCase()).includes(col)) {
      throw new Error(`Colonna non esistente: ${col}`);
    }
  }
  
  // 3. Blocca keyword pericolose
  const dangerous = ['DROP', 'DELETE', 'UPDATE', 'INSERT', 'ALTER', 'TRUNCATE', '--', ';'];
  for (const kw of dangerous) {
    if (formula.toUpperCase().includes(kw)) {
      throw new Error(`Keyword non permessa: ${kw}`);
    }
  }
  
  return true;
}
```

### 3. Limiti per Consultant (Multi-Tenant)

```typescript
const LIMITS_PER_CONSULTANT = {
  maxDatasets: 50,              // Max 50 dataset per consultant
  maxRowsPerDataset: 1_000_000, // 1M righe
  maxTotalRows: 10_000_000,     // 10M righe totali
  maxStorageMB: 500,            // 500MB storage
  maxQueriesPerDay: 10_000,     // Rate limit giornaliero
};

async function checkConsultantLimits(consultantId: number): Promise<void> {
  const stats = await getConsultantDataStats(consultantId);
  
  if (stats.datasetCount >= LIMITS_PER_CONSULTANT.maxDatasets) {
    throw new Error('Limite dataset raggiunto. Elimina alcuni dataset per continuare.');
  }
  
  if (stats.totalRows >= LIMITS_PER_CONSULTANT.maxTotalRows) {
    throw new Error('Limite righe totali raggiunto.');
  }
}
```

### 4. Row Level Security (RLS) - Setup Completo

**IMPORTANTE:** RLS richiede configurazione precisa per evitare leak di dati multi-tenant.

```sql
-- ============================================================
-- 1. CREARE RUOLO APPLICAZIONE (NON SUPERUSER!)
-- ============================================================
-- CRITICO: Superuser BYPASSA RLS! Mai usare superuser per l'app.

CREATE ROLE app_user LOGIN PASSWORD 'xxx_cambiare_in_produzione_xxx';

-- Rimuovi esplicitamente privilegi pericolosi
ALTER ROLE app_user NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;

-- Grant necessari
GRANT USAGE ON SCHEMA public TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_user;

-- ============================================================
-- 2. ABILITARE RLS SU TUTTE LE TABELLE MULTI-TENANT
-- ============================================================

-- Abilita E forza RLS (anche per table owner)
ALTER TABLE client_data_datasets ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_data_datasets FORCE ROW LEVEL SECURITY;

ALTER TABLE client_data_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_data_metrics FORCE ROW LEVEL SECURITY;

ALTER TABLE client_data_dimensions ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_data_dimensions FORCE ROW LEVEL SECURITY;

ALTER TABLE client_data_query_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_data_query_log FORCE ROW LEVEL SECURITY;

ALTER TABLE client_data_query_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_data_query_cache FORCE ROW LEVEL SECURITY;

-- ============================================================
-- 3. POLICIES CON CACHE DEL SETTING (Performance)
-- ============================================================
-- Nota: Wrappare current_setting in SELECT per cache

CREATE POLICY consultant_isolation_datasets ON client_data_datasets
  FOR ALL
  USING (consultant_id = (SELECT current_setting('app.current_consultant', TRUE)::INTEGER));

CREATE POLICY consultant_isolation_metrics ON client_data_metrics
  FOR ALL
  USING (dataset_id IN (
    SELECT id FROM client_data_datasets 
    WHERE consultant_id = (SELECT current_setting('app.current_consultant', TRUE)::INTEGER)
  ));

CREATE POLICY consultant_isolation_dimensions ON client_data_dimensions
  FOR ALL
  USING (dataset_id IN (
    SELECT id FROM client_data_datasets 
    WHERE consultant_id = (SELECT current_setting('app.current_consultant', TRUE)::INTEGER)
  ));

CREATE POLICY consultant_isolation_logs ON client_data_query_log
  FOR ALL
  USING (dataset_id IN (
    SELECT id FROM client_data_datasets 
    WHERE consultant_id = (SELECT current_setting('app.current_consultant', TRUE)::INTEGER)
  ));

-- ============================================================
-- 4. TRIGGER PER AUTO-POPULATE consultant_id SU INSERT
-- ============================================================

CREATE OR REPLACE FUNCTION set_consultant_id_from_context()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.consultant_id IS NULL THEN
    NEW.consultant_id := current_setting('app.current_consultant', TRUE)::INTEGER;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER auto_set_consultant_id
  BEFORE INSERT ON client_data_datasets
  FOR EACH ROW EXECUTE FUNCTION set_consultant_id_from_context();

-- ============================================================
-- 5. INDICI OBBLIGATORI PER PERFORMANCE RLS
-- ============================================================
-- Senza indici, ogni query fa full table scan!

CREATE INDEX IF NOT EXISTS idx_datasets_consultant ON client_data_datasets(consultant_id);
CREATE INDEX IF NOT EXISTS idx_metrics_dataset ON client_data_metrics(dataset_id);
CREATE INDEX IF NOT EXISTS idx_dimensions_dataset ON client_data_dimensions(dataset_id);
CREATE INDEX IF NOT EXISTS idx_logs_dataset ON client_data_query_log(dataset_id);
```

**Backend: Settare contesto in ogni richiesta**

```typescript
// server/middleware/set-tenant-context.ts

import { db } from '../db';
import { sql } from 'drizzle-orm';

/**
 * CRITICO: Usare SET LOCAL (non SET) per evitare leak tra request
 * con connection pooling. SET LOCAL si resetta automaticamente
 * al COMMIT/ROLLBACK della transazione.
 */
export async function executeWithTenantContext<T>(
  consultantId: number,
  callback: () => Promise<T>
): Promise<T> {
  return await db.transaction(async (tx) => {
    // SET LOCAL = auto-reset al commit
    await tx.execute(sql`SET LOCAL app.current_consultant = ${String(consultantId)}`);
    return await callback();
  });
}

// Utilizzo in ogni endpoint
app.get('/api/client-data/datasets', authenticateToken, async (req, res) => {
  const consultantId = req.user.consultantId;
  
  const datasets = await executeWithTenantContext(consultantId, async () => {
    // RLS filtra automaticamente - nessun WHERE consultant_id necessario!
    return await db.select().from(clientDataDatasets);
  });
  
  res.json(datasets);
});
```

**Views: Rispettare RLS**

```sql
-- IMPORTANTE: Views NON rispettano RLS di default!
-- Usare security_invoker = true

CREATE VIEW active_datasets 
  WITH (security_invoker = true) 
AS 
  SELECT * FROM client_data_datasets WHERE status = 'ready';
```

---

## Gestione Errori e Recovery

### 1. Import Fallito a Metà

Se l'import fallisce dopo aver creato la tabella:

```typescript
async function importWithRollback(params: ImportParams) {
  const tableName = generateTableName(...);
  
  try {
    // 1. Crea tabella
    await createTable(tableName, params.columns);
    
    // 2. Inserisci righe in batch
    for (const batch of chunks(params.rows, 1000)) {
      await insertBatch(tableName, batch);
    }
    
    // 3. Crea indici
    await createIndexes(tableName);
    
    // 4. Salva metadata
    await saveDatasetMetadata(params);
    
  } catch (error) {
    // ROLLBACK: elimina tabella parziale
    await db.execute(sql`DROP TABLE IF EXISTS ${sql.identifier(tableName)}`);
    
    // Log errore per debug
    console.error(`Import failed for ${tableName}:`, error);
    
    throw error;
  }
}
```

### 2. Cleanup Automatico Tabelle Orfane

Cron job giornaliero:

```typescript
// server/cron/cleanup-orphan-tables.ts

async function cleanupOrphanTables() {
  // Trova tabelle cdd_* che non hanno metadata
  const orphanTables = await db.execute(sql`
    SELECT tablename FROM pg_tables 
    WHERE tablename LIKE 'cdd_%'
    AND tablename NOT IN (
      SELECT table_name FROM client_data_datasets WHERE status = 'ready'
    )
  `);
  
  for (const table of orphanTables) {
    // Tabella creata più di 24h fa senza metadata → elimina
    const created = await getTableCreationTime(table.tablename);
    if (Date.now() - created > 24 * 60 * 60 * 1000) {
      await db.execute(sql`DROP TABLE IF EXISTS ${sql.identifier(table.tablename)}`);
      console.log(`Cleaned up orphan table: ${table.tablename}`);
    }
  }
}
```

### 3. Versioning Dataset (Re-Upload)

Quando il cliente ri-carica lo stesso dataset:

```typescript
async function handleReUpload(existingDatasetId: number, newFile: Buffer) {
  const existing = await getDataset(existingDatasetId);
  
  // 1. Backup tabella esistente
  const backupTableName = `${existing.tableName}_backup_${Date.now()}`;
  await db.execute(sql`
    CREATE TABLE ${sql.identifier(backupTableName)} AS 
    SELECT * FROM ${sql.identifier(existing.tableName)}
  `);
  
  // 2. Svuota tabella originale
  await db.execute(sql`TRUNCATE TABLE ${sql.identifier(existing.tableName)}`);
  
  try {
    // 3. Importa nuovi dati
    await importRows(existing.tableName, newFile);
    
    // 4. Aggiorna metadata
    await updateDatasetMetadata(existingDatasetId, { updatedAt: new Date() });
    
    // 5. Elimina backup (successo)
    await db.execute(sql`DROP TABLE IF EXISTS ${sql.identifier(backupTableName)}`);
    
  } catch (error) {
    // ROLLBACK: ripristina da backup
    await db.execute(sql`TRUNCATE TABLE ${sql.identifier(existing.tableName)}`);
    await db.execute(sql`
      INSERT INTO ${sql.identifier(existing.tableName)} 
      SELECT * FROM ${sql.identifier(backupTableName)}
    `);
    await db.execute(sql`DROP TABLE IF EXISTS ${sql.identifier(backupTableName)}`);
    
    throw error;
  }
}
```

---

## Caching Query Frequenti

Per evitare di ricalcolare le stesse metriche:

```sql
CREATE TABLE client_data_query_cache (
  id SERIAL PRIMARY KEY,
  dataset_id INTEGER REFERENCES client_data_datasets(id) ON DELETE CASCADE,
  
  -- Chiave cache
  cache_key VARCHAR(255) NOT NULL,  -- hash di tool + params
  
  -- Risultato
  result JSONB NOT NULL,
  
  -- Validità
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP,  -- NULL = non scade
  
  UNIQUE(dataset_id, cache_key)
);

CREATE INDEX idx_cache_lookup ON client_data_query_cache(dataset_id, cache_key);
```

```typescript
async function executeWithCache(datasetId: number, tool: string, params: any): Promise<QueryResult> {
  const cacheKey = hashQuery(tool, params);
  
  // 1. Controlla cache
  const cached = await db.query(sql`
    SELECT result FROM client_data_query_cache
    WHERE dataset_id = ${datasetId} AND cache_key = ${cacheKey}
    AND (expires_at IS NULL OR expires_at > NOW())
  `);
  
  if (cached.length > 0) {
    return { ...cached[0].result, fromCache: true };
  }
  
  // 2. Esegui query
  const result = await executeQuery(datasetId, tool, params);
  
  // 3. Salva in cache (scade dopo 1 ora)
  await db.execute(sql`
    INSERT INTO client_data_query_cache (dataset_id, cache_key, result, expires_at)
    VALUES (${datasetId}, ${cacheKey}, ${JSON.stringify(result)}, NOW() + INTERVAL '1 hour')
    ON CONFLICT (dataset_id, cache_key) DO UPDATE SET result = EXCLUDED.result, expires_at = EXCLUDED.expires_at
  `);
  
  return result;
}

// Invalida cache quando dataset viene aggiornato
async function invalidateCache(datasetId: number) {
  await db.execute(sql`DELETE FROM client_data_query_cache WHERE dataset_id = ${datasetId}`);
}
```

---

## Dipendenze NPM da Installare

```bash
# Upload & Parsing (streaming per file grandi)
npm install exceljs chardet

# Progress Updates (SSE invece di WebSocket)
npm install better-sse

# Opzionale: Monitoring centralizzato
npm install @sentry/node
```

---

## Checklist Bug Prevention

### Upload & Import
- [ ] Validare estensione file prima di processare
- [ ] Limite dimensione file (50MB) controllato lato server, non solo frontend
- [ ] Gestire file Excel corrotti senza crash
- [ ] Gestire fogli vuoti
- [ ] Gestire colonne senza header
- [ ] Gestire righe completamente vuote
- [ ] Encoding UTF-8/Latin1 detection automatica per CSV
- [ ] Gestire date in formati diversi (DD/MM/YYYY, YYYY-MM-DD, etc.)
- [ ] **Usare ExcelJS streaming** (non xlsx che carica tutto in RAM)
- [ ] Batch insert 1000 righe alla volta

### Database
- [ ] Nomi tabelle/colonne sempre sanitizzati (max 63 char)
- [ ] **Raw SQL per DDL dinamico** (Drizzle non supporta tabelle runtime)
- [ ] Indici creati automaticamente su colonne data
- [ ] Transaction rollback se import fallisce
- [ ] Cleanup tabelle orfane (cron)
- [ ] Limiti storage per consultant
- [ ] **RLS con ruolo app_user** (NON superuser!)
- [ ] **FORCE ROW LEVEL SECURITY** su tutte le tabelle
- [ ] **SET LOCAL** per context tenant (evita leak con connection pool)
- [ ] Indici su tutti i tenant_id

### Query Execution
- [ ] Timeout 30 sec per singola query SQL
- [ ] Timeout 5 min per analisi completa
- [ ] Limite risultati (max 10.000 righe per query)
- [ ] Formule validate (no SQL injection)
- [ ] Cache query frequenti con **FOR UPDATE SKIP LOCKED** (anti-stampede)
- [ ] Log tutte le query per audit

### AI Integration
- [ ] Max 10 round per analisi
- [ ] **Validare che AI chiami tool** (forzare retry se risponde senza function_call)
- [ ] Gestire risposta AI malformata
- [ ] Fallback se AI non risponde
- [ ] **Progress indicator via SSE** (non WebSocket)
- [ ] Retry automatico su errori transitori (backoff esponenziale)

### Column Discovery
- [ ] **Pattern detection PRIMA di AI** (template + regex)
- [ ] AI solo per colonne con confidence < 80%
- [ ] **Auto-conferma se confidence >= 85%** (zero-click per 1800 installazioni)
- [ ] Template pre-configurati per gestionali comuni (DDTRIGHE, fatture)

### Frontend
- [ ] Progress bar durante import
- [ ] Progress indicator durante analisi (5 min max)
- [ ] Gestire timeout gracefully
- [ ] Mostrare errori user-friendly
- [ ] Disable pulsanti durante operazioni

---

## Domande Aperte

1. **Aggiornamento dati:** Il cliente può ri-caricare lo stesso dataset per aggiornarlo? (replace vs append)
   → **Proposta:** Replace con backup automatico

2. **Condivisione:** Il consultant può vedere/analizzare i dati del client?
   → **Proposta:** Sì, consultant vede tutto dei suoi client

3. **Export:** Permettere export risultati in Excel?
   → **Proposta:** Sì, bottone "Esporta" su ogni risultato

4. **Grafici:** Integrare visualizzazioni (chart) nelle risposte?
   → **Proposta:** Fase 2, usare Recharts già presente

5. **Scheduling:** Query automatiche periodiche (es. report settimanale)?
   → **Proposta:** Fase 2, con email digest

---

## Riferimenti

- Google Gemini Function Calling: https://ai.google.dev/docs/function_calling
- xlsx library: https://www.npmjs.com/package/xlsx
- Drizzle ORM dynamic tables: https://orm.drizzle.team/docs/dynamic-queries
