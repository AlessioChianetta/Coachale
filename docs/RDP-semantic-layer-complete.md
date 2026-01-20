# RDP: Semantic Layer Completo per Data Analysis

**Data**: Gennaio 2026  
**Versione**: 1.0  
**Stato**: IN IMPLEMENTAZIONE  

---

## 1. STATO ATTUALE (AS-IS)

### 1.1 Cosa FUNZIONA oggi

| Componente | Stato | Note |
|------------|-------|------|
| **Intent Classifier** | ✅ BUONO | Distingue analytical/informational |
| **Tool Forcing** | ✅ BUONO | AI obbligata a usare tool per numeri |
| **Metric Registry** | ⚠️ PARZIALE | Metriche predefinite ma hardcoded |
| **Anti-Hallucination** | ✅ BUONO | Blocca se numeri DB mancano |
| **timeGranularity** | ✅ BUONO | Forza DATE_TRUNC in SQL |

### 1.2 Cosa NON FUNZIONA

| Problema | Impatto | Urgenza |
|----------|---------|---------|
| **Nomi CSV hardcoded** | CRITICO - rompe tutto se CSV cambia | 🔴 P0 |
| **Nessun mapping semantico** | CRITICO - non portabile | 🔴 P0 |
| **Validazione post-query** | ALTO - UX scadente | 🟠 P1 |
| **Metriche in codice** | MEDIO - non configurabile | 🟡 P2 |
| **Nessun hard-lock revenue** | MEDIO - AI può bypassare | 🟡 P2 |

---

## 2. ANALISI DETTAGLIATA DEI PROBLEMI

### 2.1 Nomi CSV Hardcoded (CRITICO)

**Dove:** `server/ai/data-analysis/metric-registry.ts`

```typescript
// OGGI: Hardcoded
sqlExpression: 'SUM(CAST("unit_price" AS NUMERIC) * CAST("quantity" AS NUMERIC))'

// DOMANI: Placeholder
sqlTemplate: 'SUM(CAST({price} AS NUMERIC) * CAST({quantity} AS NUMERIC))'
```

**Conseguenze:**
- Se un cliente usa un gestionale con `prezzo_vendita` invece di `unit_price` → **TUTTO SI ROMPE**
- Non possiamo supportare verticali diversi (fitness, retail) con colonne diverse
- Ogni nuovo cliente richiede intervento manuale

### 2.2 Column Mapping Attuale (Solo Descrittivo)

**Dove:** `client_data_datasets.columnMapping`

```json
// OGGI: Solo tipo e display
{
  "unit_price": {
    "displayName": "Prezzo Unitario",
    "dataType": "NUMERIC"
  }
}

// MANCA: Ruolo semantico
// Serve: logicalRole → quale ruolo business ha questa colonna?
```

### 2.3 Nessuna Pre-Validazione

**Oggi:**
```
1. Utente chiede "calcola food cost"
2. Sistema cerca metriche
3. SQL viene generato con "unit_cost"
4. SQL fallisce: "column unit_cost does not exist"
5. Errore tecnico mostrato all'utente ❌
```

**Domani:**
```
1. Utente chiede "calcola food cost"
2. Sistema verifica: food_cost richiede {cost}, {quantity}
3. Check: {cost} mappato? ❌ NO
4. Errore business: "Per calcolare il food cost, serve la colonna Costo Unitario. Vai in Impostazioni Dataset per configurarla." ✅
```

---

## 3. ARCHITETTURA TARGET (TO-BE)

### 3.1 Nuova Tabella Database

```sql
CREATE TABLE dataset_column_mappings (
  id SERIAL PRIMARY KEY,
  dataset_id INTEGER NOT NULL REFERENCES client_data_datasets(id) ON DELETE CASCADE,
  logical_column VARCHAR(100) NOT NULL,  -- 'price', 'cost', 'quantity', 'order_id', 'date'
  physical_column VARCHAR(255) NOT NULL, -- 'unit_price', 'prezzo_vendita', etc.
  confidence DECIMAL(3,2) DEFAULT 1.0,   -- Auto-detection confidence
  is_confirmed BOOLEAN DEFAULT false,     -- User confirmed mapping
  created_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(dataset_id, logical_column)
);
```

### 3.2 Colonne Logiche Standard

| Logical Column | Display Name | Data Type | Richiesto per |
|----------------|--------------|-----------|---------------|
| `price` | Prezzo Vendita | NUMERIC | revenue, food_cost_percent |
| `cost` | Costo Unitario | NUMERIC | food_cost, gross_margin |
| `quantity` | Quantità | NUMERIC | revenue, food_cost, quantity_total |
| `total_net` | Totale Netto | NUMERIC | ticket_medio, revenue_net |
| `discount_percent` | Sconto % | NUMERIC | discount_total |
| `order_id` | ID Ordine | TEXT | order_count |
| `product_name` | Nome Prodotto | TEXT | groupBy |
| `category` | Categoria | TEXT | groupBy |
| `order_date` | Data Ordine | DATE | compare_periods, timeGranularity |

### 3.3 Metric Templates con Placeholder

```typescript
const METRIC_TEMPLATES = {
  revenue_gross: {
    sqlTemplate: 'SUM(CAST({price} AS NUMERIC) * CAST({quantity} AS NUMERIC))',
    requiredLogicalColumns: ["price", "quantity"],
  },
  food_cost: {
    sqlTemplate: 'SUM(CAST({cost} AS NUMERIC) * CAST({quantity} AS NUMERIC))',
    requiredLogicalColumns: ["cost", "quantity"],
  },
  food_cost_percent: {
    sqlTemplate: '(SUM(CAST({cost} AS NUMERIC) * CAST({quantity} AS NUMERIC)) / NULLIF(SUM(CAST({price} AS NUMERIC) * CAST({quantity} AS NUMERIC)), 0)) * 100',
    requiredLogicalColumns: ["cost", "price", "quantity"],
  },
};
```

### 3.4 Semantic Resolver

Il resolver traduce i placeholder nelle colonne fisiche:

```
Input:  'SUM({price} * {quantity})'
Lookup: price → "unit_price", quantity → "quantity"
Output: 'SUM("unit_price" * "quantity")'
```

### 3.5 Pre-Query Validation

Prima di eseguire SQL:
1. Estrae colonne logiche richieste dalla metrica
2. Verifica che esistano nel mapping del dataset
3. Se mancano → errore business-friendly, NON errore SQL

### 3.6 Hard-Lock per Termini Chiave

| Termine Utente | Metrica Forzata |
|----------------|-----------------|
| fatturato, vendite, revenue, incasso | revenue_gross |
| food cost, costo cibo | food_cost_percent |
| margine, guadagno | gross_margin |
| ordini, scontrini | order_count |

---

## 4. FLOW COMPLETO

### 4.1 Import Dataset

```
1. Upload CSV
2. Parser estrae colonne fisiche
3. Auto-detection tenta mapping:
   - "unit_price" → price (confidence: 0.95)
   - "prezzo" → price (confidence: 0.85)
4. Se confidence >= 85% → auto-conferma
5. Altrimenti → richiedi conferma utente
6. Salva in dataset_column_mappings
```

### 4.2 Query Utente

```
1. Utente: "Qual è il food cost?"
2. Intent: analytical
3. Term Mapper: "food cost" → food_cost_percent
4. Pre-Validator: verifica {price}, {cost}, {quantity}
5. Semantic Resolver: traduce placeholder
6. Query Executor: esegue SQL
7. Result Validator: verifica numeri
8. AI Explainer: interpreta risultato
```

---

## 5. FILES DA CREARE

| File | Descrizione |
|------|-------------|
| `server/ai/data-analysis/semantic-resolver.ts` | Traduce placeholder → colonne fisiche |
| `server/ai/data-analysis/pre-validator.ts` | Verifica colonne prima di query |
| `server/ai/data-analysis/term-mapper.ts` | Hard-lock termini → metriche |
| `server/ai/data-analysis/logical-columns.ts` | Definizione colonne logiche standard |

---

## 6. FILES DA MODIFICARE

| File | Modifica |
|------|----------|
| `shared/schema.ts` | Aggiungere tabella datasetColumnMappings |
| `server/ai/data-analysis/metric-registry.ts` | Usare sqlTemplate con placeholder |
| `server/ai/data-analysis/query-planner.ts` | Integrare term-mapper e pre-validator |
| `server/services/client-data/query-executor.ts` | Usare semantic resolver |

---

## 7. PATTERN AUTO-DETECTION

Per auto-mappare colonne durante import:

```typescript
const COLUMN_PATTERNS = {
  price: [
    /^(unit_)?price$/i,
    /^prezzo(_unitario)?$/i,
    /^selling_price$/i,
    /^importo_vendita$/i,
  ],
  cost: [
    /^(unit_)?cost$/i,
    /^costo(_unitario)?$/i,
    /^food_cost$/i,
    /^costo_acquisto$/i,
  ],
  quantity: [
    /^(qty|quantity|quantita)$/i,
    /^numero_pezzi$/i,
  ],
  order_id: [
    /^order_id$/i,
    /^id_ordine$/i,
    /^scontrino$/i,
    /^receipt_id$/i,
  ],
  order_date: [
    /^(order_)?date$/i,
    /^data(_ordine)?$/i,
    /^timestamp$/i,
  ],
};
```

---

## 8. CHECKLIST IMPLEMENTAZIONE

- [x] Creare tabella dataset_column_mappings
- [ ] Aggiungere schema Drizzle
- [ ] Creare logical-columns.ts
- [ ] Creare semantic-resolver.ts
- [ ] Creare pre-validator.ts
- [ ] Creare term-mapper.ts
- [ ] Modificare metric-registry.ts (template)
- [ ] Integrare in query-planner.ts
- [ ] Integrare in query-executor.ts
- [ ] Auto-detection durante import
- [ ] Script migrazione dataset esistenti
- [ ] UI configurazione colonne
