# RDP: Auto Semantic Mapping CSV

## Obiettivo
Automatizzare il mapping colonne CSV → ruoli semantici business con:
- 80-90% mapping automatico
- 1-2 click di conferma per colonne critiche
- ZERO calcoli su colonne non validate

---

## 1. SCHEMA DATABASE

### 1.1 Nuova tabella: `dataset_column_semantics`

```sql
CREATE TABLE dataset_column_semantics (
  id SERIAL PRIMARY KEY,
  dataset_id INTEGER NOT NULL REFERENCES client_data_datasets(id) ON DELETE CASCADE,
  physical_column VARCHAR(255) NOT NULL,
  logical_role VARCHAR(50) NOT NULL,
  confidence NUMERIC(3,2) NOT NULL DEFAULT 0,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  auto_approved BOOLEAN NOT NULL DEFAULT FALSE,
  confirmed_by_user_id VARCHAR(255),
  confirmed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  CONSTRAINT valid_status CHECK (status IN ('pending', 'confirmed', 'rejected')),
  CONSTRAINT valid_logical_role CHECK (logical_role IN (
    'price', 'cost', 'quantity', 'order_date', 'order_id', 
    'customer_id', 'product_name', 'category', 'discount_percent',
    'total_net', 'tax_rate', 'payment_method', 'staff'
  )),
  CONSTRAINT unique_dataset_column UNIQUE (dataset_id, physical_column)
);

CREATE INDEX idx_semantics_dataset ON dataset_column_semantics(dataset_id);
CREATE INDEX idx_semantics_status ON dataset_column_semantics(status);
```

### 1.2 Modifica tabella esistente: `client_data_datasets`

```sql
ALTER TABLE client_data_datasets 
ADD COLUMN analytics_enabled BOOLEAN NOT NULL DEFAULT FALSE;
```

---

## 2. LOGICAL ROLES (Vocabolario Fisso)

### Core Roles (CRITICI - richiedono conferma)
| Role | Descrizione | Required per metriche |
|------|-------------|----------------------|
| `price` | Prezzo di vendita unitario | revenue, food_cost_percent, ticket_medio |
| `cost` | Costo unitario | food_cost, gross_margin |
| `quantity` | Quantità | revenue, food_cost, quantity_total |
| `order_date` | Data ordine | tutte le analisi temporali |

### Dimension Roles (auto-approvabili)
| Role | Descrizione |
|------|-------------|
| `order_id` | ID ordine/scontrino |
| `customer_id` | ID cliente |
| `product_name` | Nome prodotto |
| `category` | Categoria prodotto |
| `payment_method` | Metodo pagamento |
| `staff` | Personale/cameriere |

### Financial Roles
| Role | Descrizione |
|------|-------------|
| `discount_percent` | Sconto percentuale |
| `total_net` | Totale netto |
| `tax_rate` | Aliquota IVA |

---

## 3. LOGICA AUTO-APPROVAL

```
IF confidence >= 0.90 AND role NOT IN (price, cost, quantity, order_date):
    → auto_approved = TRUE, status = 'confirmed'

IF role IN (price, cost, quantity, order_date):
    → auto_approved = FALSE, status = 'pending'
    → RICHIEDE 1 CLICK CONFERMA UI

IF 2+ candidates con confidence > 0.70:
    → BLOCCO, scelta manuale obbligatoria

IF confidence < 0.70:
    → NON MAPPARE
```

---

## 4. API ENDPOINTS

### 4.1 GET `/api/client-data/datasets/:id/semantic-mappings`
Ritorna tutti i mapping semantici del dataset.

**Response:**
```json
{
  "datasetId": 123,
  "analyticsEnabled": false,
  "mappings": [
    {
      "id": 1,
      "physicalColumn": "unit_price",
      "logicalRole": "price",
      "confidence": 0.95,
      "status": "pending",
      "autoApproved": false,
      "isCritical": true
    }
  ],
  "pendingCritical": ["price", "cost"],
  "missingRequired": []
}
```

### 4.2 POST `/api/client-data/datasets/:id/semantic-mappings/confirm`
Conferma uno o più mapping.

**Request:**
```json
{
  "confirmations": [
    { "physicalColumn": "unit_price", "logicalRole": "price" },
    { "physicalColumn": "unit_cost", "logicalRole": "cost" }
  ]
}
```

**Response:**
```json
{
  "confirmed": 2,
  "analyticsEnabled": true
}
```

### 4.3 POST `/api/client-data/datasets/:id/semantic-mappings/reject`
Rigetta un mapping e richiede scelta manuale.

---

## 5. UI FLOW

### Step 1: Upload CSV
- Utente carica file
- Sistema esegue auto-detect
- Salva mapping in `dataset_column_semantics`

### Step 2: Review Mapping (se necessario)
Se ci sono mapping critici pending:
```
┌─────────────────────────────────────────────────┐
│  Conferma Mapping Dati                          │
│                                                 │
│  Abbiamo rilevato automaticamente:              │
│                                                 │
│  ┌─────────────────────────────────────────┐   │
│  │ unit_price → Prezzo di Vendita  [✓]     │   │
│  │ unit_cost  → Costo Unitario     [✓]     │   │
│  │ quantity   → Quantità           [✓]     │   │
│  │ order_date → Data Ordine        [✓]     │   │
│  └─────────────────────────────────────────┘   │
│                                                 │
│  [Conferma Tutti]                               │
└─────────────────────────────────────────────────┘
```

### Step 3: Analytics Abilitato
- `analytics_enabled = true`
- Utente può interrogare i dati

---

## 6. BLOCCO ANALYTICS

### Quando bloccare
- `analytics_enabled = false`
- Mapping critici con `status = 'pending'`

### Messaggio Errore
```
"Per analizzare questo dataset, conferma prima il mapping delle colonne chiave: 
Prezzo, Costo, Quantità, Data Ordine"
```

### Check nel Query Planner
```typescript
if (!dataset.analyticsEnabled) {
  return {
    error: "MAPPING_REQUIRED",
    message: "Conferma il mapping delle colonne prima di analizzare i dati",
    pendingColumns: ["price", "cost"]
  };
}
```

---

## 7. METRIC ENGINE REFACTOR

### Prima (hardcoded)
```typescript
// metric-registry.ts
revenue: {
  formula: "SUM(unit_price * quantity)"
}
```

### Dopo (logical roles)
```typescript
// metric-registry.ts
revenue: {
  formula: "SUM({price} * {quantity})",
  requiredRoles: ["price", "quantity"]
}

// Resolver
function resolveFormula(formula: string, datasetId: number): string {
  const mappings = await getSemanticMappings(datasetId);
  return formula.replace(/{(\w+)}/g, (_, role) => {
    const mapping = mappings.find(m => m.logicalRole === role && m.status === 'confirmed');
    if (!mapping) throw new Error(`Manca mappatura per: ${role}`);
    return `"${mapping.physicalColumn}"`;
  });
}
```

---

## 8. ACCEPTANCE CRITERIA

### AC1: Auto-detect funziona
- [ ] Upload CSV con colonne standard → 80%+ auto-mappato
- [ ] Confidence score salvato correttamente

### AC2: Conferma 1-click
- [ ] Colonne critiche mostrate per conferma
- [ ] 1 click conferma tutte
- [ ] analytics_enabled = true dopo conferma

### AC3: Analytics bloccato
- [ ] Query rifiutata se analytics_enabled = false
- [ ] Messaggio friendly mostrato

### AC4: Metric resolver
- [ ] Metriche usano {price} non unit_price
- [ ] Errore se manca mapping

### AC5: Golden Test
- [ ] revenue totale = valore atteso dal CSV test
- [ ] food_cost totale = valore atteso
- [ ] order_count = valore atteso

### AC6: Test colonne rinominate
- [ ] `prezzo_unitario` → rilevato come `price`
- [ ] `costo_unitario` → rilevato come `cost`
- [ ] Metriche calcolate correttamente

---

## 9. VALORI ATTESI (Golden Test)

Calcolati dal CSV `restaurant_complex_dataset.csv` (941 righe):

```
Periodo: Gennaio 2025 (tutto il dataset)

Revenue Gross = SUM(unit_price * quantity) = 21956.62 EUR
Food Cost = SUM(unit_cost * quantity) = 7689.61 EUR
Order Count = COUNT(DISTINCT order_id) = 941
Quantity Total = SUM(quantity) = 1913
Food Cost Percent = 35.02%
Gross Margin = 14267.01 EUR
```

---

## 10. TIMELINE IMPLEMENTAZIONE

1. **Task 1**: Schema DB (SQL diretto) - 15 min
2. **Task 2**: Auto-detect nell'upload - 30 min
3. **Task 3**: API endpoints - 30 min
4. **Task 4**: UI conferma - 45 min
5. **Task 5**: Blocco analytics - 20 min
6. **Task 6**: Metric resolver - 45 min
7. **Task 7-8**: Tests - 30 min
8. **Task 9**: E2E review - 15 min

**Totale stimato: ~4 ore**
