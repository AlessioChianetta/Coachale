# RDP: Compute-First Data Analysis System

## Overview

Sistema di analisi dati strutturati (Excel/CSV) per clienti, con architettura "compute-first" che separa calcolo deterministico (SQL) da interpretazione AI (Gemini). Integrato nella Knowledge Base esistente di consultant e client.

**Problema risolto:** Analizzare milioni di righe di dati (es. 5M token) senza passarli nel prompt AI, ottenendo calcoli precisi e spiegazioni intelligenti.

**Caso d'uso principale:** Ristorante che carica dati vendite (DDTRIGHE, PRODOTTI) e chiede "Qual è il margine per piatto?" - l'AI calcola correttamente su tutte le righe.

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

```typescript
interface UploadResult {
  sheets: Array<{
    name: string;
    columns: string[];
    sampleRows: any[];      // Prime 100 righe
    rowCount: number;
  }>;
  fileSize: number;
  originalFilename: string;
}

async function processUpload(file: Buffer, filename: string): Promise<UploadResult>
```

#### 2. column-discovery.ts

```typescript
interface ColumnMapping {
  original: string;           // Nome originale: "COD_ART"
  mapped: string;             // Nome mappato: "codice_articolo"
  type: 'string' | 'integer' | 'decimal' | 'date' | 'boolean';
  description: string;        // "Codice identificativo dell'articolo"
  sampleValues: string[];     // ["A001", "B002", "C003"]
  nullPercentage: number;     // % valori nulli
  confidence: number;         // 0-1 quanto è sicura l'AI
}

async function discoverColumns(
  columns: string[], 
  sampleRows: any[]
): Promise<ColumnMapping[]>
```

**Prompt AI per discovery:**
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

```typescript
async function createDataTable(
  consultantId: number,
  clientId: number,
  datasetName: string,
  columnMapping: ColumnMapping[],
  rows: any[]
): Promise<{ tableName: string; rowCount: number }>
```

Genera SQL dinamico:
```sql
CREATE TABLE cdd_{consultantId}_{clientId}_{datasetName} (
  id SERIAL PRIMARY KEY,
  {colonne mappate con tipi corretti},
  _row_number INTEGER,
  _imported_at TIMESTAMP DEFAULT NOW()
);

INSERT INTO ... VALUES ...;
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

## Domande Aperte

1. **Aggiornamento dati:** Il cliente può ri-caricare lo stesso dataset per aggiornarlo? (replace vs append)
2. **Condivisione:** Il consultant può vedere/analizzare i dati del client?
3. **Export:** Permettere export risultati in Excel?
4. **Grafici:** Integrare visualizzazioni (chart) nelle risposte?
5. **Scheduling:** Query automatiche periodiche (es. report settimanale)?

---

## Riferimenti

- Google Gemini Function Calling: https://ai.google.dev/docs/function_calling
- xlsx library: https://www.npmjs.com/package/xlsx
- Drizzle ORM dynamic tables: https://orm.drizzle.team/docs/dynamic-queries
