# RDP: Sistema Intelligente di Analisi Dati

**Stato**: 🚧 In Sviluppo
**Ultimo aggiornamento**: 2026-01-21

---

## 1. OVERVIEW

Sistema a 3 componenti per migliorare l'analisi dati:
1. **AI Column Mapper** - Mapping intelligente colonne con analisi dati reali
2. **Smart Questions** - Domande generate dai dati disponibili
3. **Full Audit** - Report completo per presentazioni

---

## 2. DATABASE

### Nessuna modifica schema richiesta
Le tabelle esistenti sono sufficienti:
- `dataset_column_semantics` - già supporta mapping con confidence e status
- `client_data_datasets` - già ha analytics_enabled flag
- `client_data_conversations/messages` - per cache domande generate

### Query utili per debug
```sql
-- Vedere mapping di un dataset
SELECT * FROM dataset_column_semantics WHERE dataset_id = 8;

-- Vedere colonne pending
SELECT * FROM dataset_column_semantics 
WHERE dataset_id = 8 AND status = 'pending';

-- Verificare analytics enabled
SELECT id, name, analytics_enabled FROM client_data_datasets WHERE id = 8;
```

---

## 3. BACKEND

### 3.1 AI Column Mapper

**File**: `server/ai/data-analysis/ai-column-mapper.ts`

**Funzioni**:
```typescript
interface ColumnAnalysis {
  physicalColumn: string;
  sampleValues: any[];
  detectedType: 'currency' | 'percentage' | 'integer' | 'text' | 'date';
  statistics: { min: number, max: number, avg: number, nullCount: number };
  suggestedLogicalRole: string | null;
  confidence: number;
  reasoning: string;
  anomalies: string[];
}

async function analyzeColumnsWithAI(
  datasetId: number, 
  tableName: string
): Promise<ColumnAnalysis[]>

async function getSampleData(
  tableName: string, 
  columns: string[], 
  limit: number
): Promise<Record<string, any[]>>
```

**Endpoint**: `GET /api/client-data/datasets/:id/ai-mapping-suggestions`

**Response**:
```json
{
  "success": true,
  "data": {
    "suggestions": [
      {
        "physicalColumn": "costoproduzione_prezzoacquisto",
        "suggestedRole": "cost",
        "confidence": 0.92,
        "reasoning": "Valori numerici bassi (media €2.15), nome contiene 'costo' e 'prezzo_acquisto'",
        "sampleValues": [1.20, 2.50, 0.80, 3.40],
        "anomalies": []
      }
    ],
    "warnings": [
      "Trovate 2 potenziali colonne costo: cost_amount e costoproduzione_prezzoacquisto"
    ]
  }
}
```

### 3.2 Smart Questions

**File**: `server/ai/data-analysis/smart-questions.ts`

**Funzioni**:
```typescript
interface SmartQuestionsResult {
  questions: string[];
  availableMetrics: string[];
  dimensions: Record<string, string[]>;
  generatedAt: string;
}

async function generateSmartQuestions(
  datasetId: number
): Promise<SmartQuestionsResult>

async function getAvailableMetrics(
  mappings: SemanticMapping[]
): Promise<string[]>

async function exploreDimensions(
  tableName: string,
  textColumns: string[]
): Promise<Record<string, string[]>>
```

**Endpoint**: `GET /api/client-data/datasets/:id/smart-questions`

### 3.3 Full Audit

**File**: `server/ai/data-analysis/full-audit.ts`

**Pipeline Steps**:
1. Schema Analysis (problemi mapping)
2. KPI Generali (revenue, orders, ticket medio)
3. Top/Flop Prodotti
4. Margini (se cost disponibile)
5. Breakdown Dimensionale
6. Trend Temporali
7. Anomaly Detection
8. AI Summary + Raccomandazioni

**Endpoint**: `POST /api/client-data/datasets/:id/full-audit`
(Streaming SSE per progress)

---

## 4. FRONTEND

### 4.1 AI Column Mapper UI

**File**: `client/src/components/client-data/SemanticMappingConfirmation.tsx`

**Layout**:
```
┌─────────────────────────────────────────────────────────────────┐
│ 🤖 Configurazione Intelligente Colonne                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ Colonna: costoproduzione_prezzoacquisto                     │ │
│ │ ────────────────────────────────────────────────────────────│ │
│ │ 📊 Sample: 1.20, 2.50, 0.80, 3.40, 1.90                    │ │
│ │ 📈 Stats: Min €0.80 | Max €3.40 | Media €2.15              │ │
│ │                                                             │ │
│ │ 💡 Suggerimento AI (92% confidence):                       │ │
│ │    → Mappare come "Costo Unitario"                         │ │
│ │    Motivo: Valori bassi tipici di costi materia prima      │ │
│ │                                                             │ │
│ │ [Costo Unitario ▼]  [✓ Conferma]  [✗ Ignora]              │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                  │
│ ⚠️ Attenzione: 2 colonne potrebbero essere "costo"             │
│    Seleziona quale usare per i calcoli margine                  │
└─────────────────────────────────────────────────────────────────┘
```

### 4.2 Smart Questions UI

**File**: `client/src/components/client-data/DataAnalysisChat.tsx`

**Layout** (sostituisce domande statiche):
```
┌─────────────────────────────────────────────────────────────────┐
│ 💡 Domande suggerite per i tuoi dati                            │
│ ────────────────────────────────────────────────────────────────│
│                                                                  │
│ [🔄] Rigenera suggerimenti                                      │
│                                                                  │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ 📊 Qual è il fatturato totale per categoria                 │ │
│ │    (Pizze, Antipasti, Primi, Dolci, Bevande)?              │→│
│ └─────────────────────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ 💰 Quali sono i 10 prodotti con margine più alto?          │→│
│ └─────────────────────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ 👨‍🍳 Come si confrontano le performance dei camerieri?       │→│
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                  │
│ 🏷️ Basate su: revenue, cost, quantity, category, waiter        │
└─────────────────────────────────────────────────────────────────┘
```

### 4.3 Full Audit UI

**File**: `client/src/components/client-data/FullAuditDialog.tsx`

**Layout**:
```
┌─────────────────────────────────────────────────────────────────┐
│ 📋 Audit Completo - ristorante_simulato_120k          [X]       │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│ Generazione in corso...                                          │
│ ████████████░░░░░░░░ 60%                                        │
│                                                                  │
│ ✅ Schema Analysis                                               │
│ ✅ KPI Generali                                                  │
│ ✅ Analisi Prodotti                                              │
│ 🔄 Analisi Margini...                                           │
│ ⏳ Trend Temporali                                               │
│ ⏳ Anomaly Detection                                             │
│ ⏳ AI Summary                                                    │
│                                                                  │
├─────────────────────────────────────────────────────────────────┤
│ ▼ KPI Generali                                                   │
│   Fatturato: €1,234,567                                         │
│   Ordini: 45,678                                                │
│   Ticket Medio: €27.03                                          │
│                                                                  │
│ ▼ Top 10 Prodotti                                               │
│   1. Margherita - €45,000 (3.2%)                                │
│   2. Carbonara - €38,500 (2.8%)                                 │
│   ...                                                           │
│                                                                  │
│ ▶ Analisi Margini (clicca per espandere)                        │
│ ▶ Problemi Rilevati (2 warning)                                 │
│ ▶ Raccomandazioni                                               │
│                                                                  │
├─────────────────────────────────────────────────────────────────┤
│ [📥 Esporta PDF]  [📊 Esporta Excel]  [Chiudi]                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 5. TASK TRACKER

| # | Task | Stato | Note |
|---|------|-------|------|
| 1 | AI Column Mapper: Backend | ✅ Completato | ai-column-mapper.ts con analisi 100 sample rows |
| 2 | AI Column Mapper: Endpoint + fix pattern | ✅ Completato | Pattern cost ampliati per cost_amount |
| 3 | AI Column Mapper: Frontend | ✅ Completato | UI con suggestions, stats, anomalies |
| 4 | Smart Questions: Backend | ✅ Completato | Verifica metriche, esplora dimensioni |
| 5 | Smart Questions: Frontend | ✅ Completato | Sostituisce domande statiche |
| 6 | Full Audit: Backend | ✅ Completato | 8-step pipeline completa |
| 7 | Full Audit: Frontend | ✅ Completato | Dialog con progress e collapsible sections |
| 8 | SQL Security | ✅ Completato | Aggiunto sql-utils.ts con sanitizzazione |

---

## 6. SICUREZZA SQL

Tutti i file che usano SQL raw ora utilizzano le funzioni di sicurezza da `sql-utils.ts`:
- `safeTableName(name)` - Valida e quota nomi tabelle (devono iniziare con `cdd_`)
- `safeColumnName(name)` - Valida e quota nomi colonne

Questo previene SQL injection attraverso nomi colonna/tabella malevoli.

---

## 7. CHANGELOG

### 2026-01-21 (Completamento)
- Completati tutti i task 1-8
- Aggiunta sicurezza SQL con sql-utils.ts
- Full Audit usa JSON response (SSE streaming come miglioramento futuro)
- Frontend integrato con pulsante Audit e Smart Questions dinamiche

### 2026-01-21 (Inizio)
- Creato RDP iniziale
- Definiti 3 componenti principali
- Definito layout UI per ogni componente
