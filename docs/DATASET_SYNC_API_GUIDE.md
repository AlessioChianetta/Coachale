# 📊 Dataset Sync API - Guida Tecnica Completa

## Panoramica

Questo documento descrive l'API per la sincronizzazione automatica di dataset CSV/XLSX da sistemi esterni (es. POS ristoranti, ERP, e-commerce).

---

## 🔐 Autenticazione

### API Key
Ogni sorgente esterna riceve una API Key univoca nel formato:
```
dsync_<consultant_id>_<random_32_chars>
```

### Firma HMAC-SHA256
Ogni richiesta deve includere una firma per validazione:
```
X-Dataset-Signature: sha256=<HMAC-SHA256(payload, secret_key)>
X-Dataset-Timestamp: <unix_timestamp>
```

**Validazione lato server:**
1. Verifica che il timestamp sia entro 5 minuti
2. Calcola HMAC del payload con secret key
3. Confronta con header signature

---

## 📤 Endpoint Webhook

### POST `/api/dataset-sync/webhook/:apiKey`

Riceve file CSV/XLSX da sistemi esterni.

**Headers richiesti:**
```
Content-Type: multipart/form-data
X-Dataset-Signature: sha256=<signature>
X-Dataset-Timestamp: <unix_timestamp>
```

**Body (multipart/form-data):**
| Campo | Tipo | Obbligatorio | Descrizione |
|-------|------|--------------|-------------|
| `file` | File | ✅ | File CSV, XLSX o XLS |
| `source_name` | String | ❌ | Nome sorgente (default: API key name) |
| `replace_mode` | String | ❌ | `full` (sostituisci tutto) o `append` (aggiungi) |

**Response 200 OK:**
```json
{
  "success": true,
  "syncId": "sync_abc123",
  "rowsImported": 15000,
  "columnsDetected": 12,
  "mappingSummary": {
    "mapped": ["price", "quantity", "order_date", "product_name"],
    "unmapped": ["custom_field_1"]
  }
}
```

**Response 400 Bad Request:**
```json
{
  "success": false,
  "error": "MISSING_REQUIRED_COLUMNS",
  "message": "Colonne obbligatorie mancanti: price, quantity",
  "requiredColumns": ["price", "quantity", "order_date"]
}
```

---

## 📋 Schema Colonne - Ruoli Logici

### GET `/api/dataset-sync/schema`

Restituisce la documentazione completa dei ruoli logici supportati.

**Response:**
```json
{
  "version": "2.0",
  "lastUpdated": "2026-01-24",
  "roles": [...]
}
```

---

## 🏷️ RUOLI LOGICI SUPPORTATI (19 ruoli)

### ⭐ RUOLI CRITICI (obbligatori per metriche)

| Ruolo | Nome IT | Tipo | Descrizione | Pattern Auto-Detect |
|-------|---------|------|-------------|---------------------|
| `price` | Prezzo Vendita | NUMERIC | Prezzo unitario di vendita | prezzo, price, unit_price, pvp, listino |
| `cost` | Costo Unitario | NUMERIC | Costo di acquisto/produzione | costo, cost, costo_acquisto, food_cost |
| `quantity` | Quantità | NUMERIC | Numero di unità vendute | quantita, quantity, qty, qta, pezzi |
| `order_date` | Data Ordine | DATE | Data della transazione | data, date, order_date, timestamp |
| `revenue_amount` | Importo Fatturato | NUMERIC | **Totale riga post-sconti** (priorità su price×quantity) | prezzo_finale, importo_riga, total_line, amount |

### 📊 RUOLI DOCUMENTO

| Ruolo | Nome IT | Tipo | Descrizione | Valori Accettati |
|-------|---------|------|-------------|------------------|
| `document_id` | ID Documento | TEXT | ID ordine/scontrino/fattura | Qualsiasi ID univoco |
| `line_id` | ID Riga | TEXT | ID riga dettaglio | Qualsiasi ID riga |
| `document_type` | Tipo Documento | TEXT | Classificazione transazione | `sale`, `refund`, `void`, `staff_meal` |

> ⚠️ **IMPORTANTE**: Se `document_type` non è presente, default = `sale`

### 🍕 RUOLI PRODOTTO

| Ruolo | Nome IT | Tipo | Descrizione | Pattern Auto-Detect |
|-------|---------|------|-------------|---------------------|
| `product_id` | Codice Articolo | TEXT | SKU/codice prodotto | idprodotto, product_id, sku, cod_art |
| `product_name` | Nome Prodotto | TEXT | Descrizione prodotto | descr_prod, product_name, descrizione, articolo |
| `category` | Categoria | TEXT | Categoria prodotto | categoria, category, tipologia, gruppo |
| `is_sellable` | Prodotto Vendibile | INTEGER | 1=prodotto, 0=modifier/nota | is_sellable, vendibile |

### 👤 RUOLI CLIENTE

| Ruolo | Nome IT | Tipo | Descrizione | Pattern Auto-Detect |
|-------|---------|------|-------------|---------------------|
| `customer_id` | ID Cliente | TEXT | Identificativo cliente | idcliente, customer_id, cod_cliente |
| `customer_name` | Nome Cliente | TEXT | Ragione sociale/nome | ragione_sociale, customer_name, cliente |

### 💰 RUOLI FINANZIARI

| Ruolo | Nome IT | Tipo | Descrizione | Pattern Auto-Detect |
|-------|---------|------|-------------|---------------------|
| `discount_percent` | Sconto % | NUMERIC | Percentuale sconto applicata | sconto_percent, discount_pct |
| `total_net` | Totale Netto | NUMERIC | Importo netto post-sconti | totale_netto, net_total |
| `tax_rate` | Aliquota IVA | NUMERIC | Percentuale IVA | aliquota, tax_rate, vat_rate |
| `payment_method` | Metodo Pagamento | TEXT | Modalità di pagamento | pagamento, payment_method |

### 🕐 RUOLI TEMPORALI E CANALE (NUOVI)

| Ruolo | Nome IT | Tipo | Descrizione | Valori Accettati |
|-------|---------|------|-------------|------------------|
| `time_slot` | Fascia Oraria | TEXT | Classificazione orario servizio | `breakfast`, `lunch`, `dinner`, `late` |
| `sales_channel` | Canale Vendita | TEXT | Modalità di servizio | `dine_in`, `takeaway`, `delivery` |

> 📝 **Fallback automatici:**
> - Se `time_slot` manca → calcolato da `order_date` (ora)
> - Se `sales_channel` manca → default = `dine_in`

### 👨‍💼 RUOLI STAFF

| Ruolo | Nome IT | Tipo | Descrizione | Pattern Auto-Detect |
|-------|---------|------|-------------|---------------------|
| `staff` | Operatore | TEXT | Nome/ID operatore | operatore, staff, cassiere, waiter |

---

## 🗓️ SCHEDULING SINCRONIZZAZIONE

### Opzioni disponibili:

| Frequenza | Configurazione | Descrizione |
|-----------|----------------|-------------|
| Giornaliera | `daily@HH:MM` | Ogni giorno all'ora specificata (timezone Europe/Rome) |
| Ogni X giorni | `every_X_days@HH:MM` | Ogni X giorni all'ora specificata |
| Settimanale | `weekly@DOW@HH:MM` | Giorno settimana (0=Dom, 1=Lun, ...) |
| Mensile | `monthly@DD@HH:MM` | Giorno del mese (1-28) |
| Solo Webhook | `webhook_only` | Nessun polling, solo ricezione webhook |

### Esempio configurazione:
```json
{
  "schedule": "daily@06:00",
  "timezone": "Europe/Rome",
  "retryOnFailure": true,
  "maxRetries": 3
}
```

---

## 📜 CRONOLOGIA SINCRONIZZAZIONI

### GET `/api/dataset-sync/history/:sourceId`

Restituisce la cronologia delle sincronizzazioni per una sorgente.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "sync_abc123",
      "status": "completed",
      "startedAt": "2026-01-24T06:00:00Z",
      "completedAt": "2026-01-24T06:02:15Z",
      "durationMs": 135000,
      "rowsImported": 15000,
      "rowsSkipped": 12,
      "errors": [],
      "triggeredBy": "scheduled"
    }
  ]
}
```

---

## 🔧 7 REGOLE QUERY ENGINE

### Regola 1: Priorità Fatturato ✅ (già implementata)
```
IF revenue_amount EXISTS:
    USE SUM(revenue_amount)
ELSE:
    USE SUM(price * quantity)
```

### Regola 2: Filtro Automatico document_type
```
IF metric IN (revenue, gross_margin, food_cost)
AND no explicit document_type filter:
    inject WHERE document_type='sale'
```

### Regola 3: Canale Vendite Default
```
IF sales_channel NOT specified:
    default = ALL ('dine_in','takeaway','delivery')
IF specified (delivery/asporto/sala):
    filter specific channel
```

### Regola 4: Time Slot Automatico
```
Mapping:
  breakfast: 06:00-11:00
  lunch: 11:00-15:00
  dinner: 18:00-23:00
  late: 23:00-04:00

IF time_slot column exists:
    filter time_slot
ELSE:
    filter EXTRACT(hour from order_date)
```

### Regola 5: Categoria Semantica
```
PRIORITY:
  1) category semantic mapping
  2) fallback ILIKE solo se category NON esiste
```

### Regola 6: ORDER BY Semantico
```
| Keyword AI          | ORDER BY              |
|--------------------|-----------------------|
| profittevoli       | gross_margin DESC     |
| più venduti        | quantity DESC         |
| fatturato          | revenue DESC          |
| più cari           | avg_unit_price DESC   |
| meno profittevoli  | gross_margin ASC      |
```

### Regola 7: Divisioni Sicure ✅ (già implementata)
```
SEMPRE usare NULLIF(denominatore, 0)
```

---

## 📊 ESEMPIO FILE CSV ATTESO

```csv
order_id,order_date,product_name,category,price,cost,quantity,revenue_amount,document_type,time_slot,sales_channel
ORD001,2026-01-24 12:30:00,Pizza Margherita,Pizza,8.50,2.50,2,17.00,sale,lunch,dine_in
ORD001,2026-01-24 12:30:00,Coca Cola,Bevande,3.00,0.80,2,6.00,sale,lunch,dine_in
ORD002,2026-01-24 19:45:00,Spaghetti Carbonara,Primi,12.00,3.20,1,12.00,sale,dinner,delivery
ORD003,2026-01-24 20:00:00,Pizza Margherita,Pizza,8.50,2.50,1,-8.50,refund,dinner,dine_in
```

---

## 🔒 SICUREZZA

1. **HTTPS obbligatorio** - Tutte le comunicazioni crittografate
2. **Firma HMAC** - Validazione integrità payload
3. **Rate Limiting** - Max 100 richieste/ora per API key
4. **Idempotenza** - Header `X-Idempotency-Key` per evitare duplicati
5. **Timestamp Window** - Richieste valide solo entro 5 minuti

---

## 📞 SUPPORTO

Per configurare una nuova sorgente esterna:
1. Contatta il consulente per ottenere API Key e Secret
2. Configura il tuo sistema per inviare file nel formato specificato
3. Testa con un file di esempio prima della produzione

---

## Changelog

| Versione | Data | Modifiche |
|----------|------|-----------|
| 2.0 | 2026-01-24 | Aggiunti ruoli: revenue_amount, document_type, time_slot, sales_channel |
| 1.0 | 2026-01-15 | Versione iniziale con 15 ruoli |
