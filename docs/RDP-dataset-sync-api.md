# RDP - Dataset Sync API

## Obiettivo del Progetto

Creare un sistema di integrazione per partner esterni che consenta la ricezione automatica di dataset CSV/XLSX da 1800 installazioni ristoranti, con sincronizzazione via webhook o schedulata, mappatura semantica automatica delle colonne e dashboard di gestione per i consulenti.

---

## Requisiti Funzionali

### RF-1: Webhook di Ricezione Dataset
- **RF-1.1**: Endpoint `POST /api/dataset-sync/webhook/:apiKey` per ricezione file
- **RF-1.2**: Supporto formati CSV, XLSX, XLS
- **RF-1.3**: Mappatura automatica colonne basata su 19 ruoli semantici
- **RF-1.4**: Modalità replace (full) o append per import dati
- **RF-1.5**: Idempotency support per evitare duplicazioni

### RF-2: Autenticazione e Sicurezza
- **RF-2.1**: API Key univoca per sorgente nel formato `dsync_<consultant_id>_<random>`
- **RF-2.2**: Firma HMAC-SHA256 obbligatoria per ogni richiesta
- **RF-2.3**: Validazione timestamp entro 5 minuti
- **RF-2.4**: Constant-time comparison con `crypto.timingSafeEqual`
- **RF-2.5**: Rate limiting per sorgente (configurabile)

### RF-3: Schema Semantico (19 Ruoli Logici)
- **RF-3.1**: Ruoli critici: `order_id`, `order_date`, `price`, `quantity`
- **RF-3.2**: Ruoli documento: `document_type` (sale/refund/void/staff_meal)
- **RF-3.3**: Ruoli prodotto: `product_name`, `product_sku`, `category`
- **RF-3.4**: Ruoli cliente: `customer_name`, `customer_phone`
- **RF-3.5**: Ruoli finanziari: `revenue_amount` (priorità su price×quantity), `discount`, `tax`
- **RF-3.6**: Ruoli temporali: `time_slot` (breakfast/lunch/dinner/late)
- **RF-3.7**: Ruoli staff: `staff_name`, `sales_channel` (dine_in/takeaway/delivery)
- **RF-3.8**: Endpoint schema `GET /api/dataset-sync/schema` per partner

### RF-4: Schedulazione Sincronizzazione
- **RF-4.1**: Opzione webhook_only (solo su richiesta)
- **RF-4.2**: Schedulazione giornaliera (daily@HH:MM)
- **RF-4.3**: Schedulazione settimanale (weekly@DOW@HH:MM)
- **RF-4.4**: Schedulazione mensile (monthly@DD@HH:MM)
- **RF-4.5**: Schedulazione personalizzata (every_X_days@HH:MM)
- **RF-4.6**: Supporto timezone (default Europe/Rome)
- **RF-4.7**: Retry automatico in caso di fallimento

### RF-5: Query Engine Rules (7 Regole)
- **RF-5.1**: Revenue priority - usa `revenue_amount` se disponibile
- **RF-5.2**: Document type filter - auto-inject `WHERE document_type='sale'`
- **RF-5.3**: Sales channel default - filtra per canale se specificato
- **RF-5.4**: Time slot resolver - calcola da ora ordine (6-11→breakfast, 11-15→lunch, 18-22→dinner, altro→late)
- **RF-5.5**: Category semantic - mappatura alias categorie
- **RF-5.6**: ORDER BY semantic - traduce "migliori" → DESC, "peggiori" → ASC
- **RF-5.7**: NULLIF safe divisions - previene divisioni per zero

### RF-6: Dashboard Gestione (Frontend)
- **RF-6.1**: Tab Overview con metriche (success rate, sync attive, errori 24h)
- **RF-6.2**: Tab Sorgenti con CRUD (crea, modifica, elimina, toggle attivo)
- **RF-6.3**: Generazione e rigenerazione API key/secret
- **RF-6.4**: Tab Pianificazione con form scheduling
- **RF-6.5**: Tab Cronologia con history paginata e filtri
- **RF-6.6**: Tab Test con upload file e generatore firma HMAC
- **RF-6.7**: Tab Schema con documentazione API per partner
- **RF-6.8**: Esempi cURL pronti all'uso per partner

---

## Requisiti Non Funzionali

### RNF-1: Performance
- Parsing file fino a 100MB
- Import fino a 100.000 righe per sync
- Timeout webhook 5 minuti

### RNF-2: Sicurezza
- Secret key mai esposta dopo creazione
- Validazione constant-time per prevenire timing attacks
- Log completo di ogni tentativo di sync

### RNF-3: Usabilità
- Interfaccia in italiano
- Messaggi di errore descrittivi
- Preview risultati prima dell'import nel test tool

### RNF-4: Manutenibilità
- Codice modulare con componenti React separati
- Hook React Query per gestione stato
- Documentazione API completa per partner

---

## Architettura

### Backend
```
server/routes/dataset-sync-router.ts    # 12 endpoint REST
server/ai/data-analysis/query-engine-rules.ts  # 7 regole query
server/ai/data-analysis/query-planner.ts       # Integrazione regole
server/cron/dataset-sync-scheduler.ts   # Scheduler (opzionale)
```

### Frontend
```
client/src/components/client-data/
├── ExternalSyncDashboard.tsx    # Container principale con 6 tab
├── SyncOverviewCards.tsx        # Metriche e attività recente
├── SyncSourcesManager.tsx       # CRUD sorgenti con API key
├── SyncScheduleConfig.tsx       # Form scheduling
├── SyncHistoryLog.tsx           # Cronologia paginata
├── WebhookTestTool.tsx          # Test upload e firma HMAC
└── SchemaReferencePanel.tsx     # Documentazione ruoli

client/src/hooks/useDatasetSync.ts  # 13+ React Query hooks
```

### Database
```sql
-- Tabelle create
dataset_sync_sources      -- Sorgenti configurate
dataset_sync_schedules    -- Configurazioni scheduling
dataset_sync_history      -- Log sincronizzazioni
```

---

## API Endpoints

| Metodo | Endpoint | Descrizione |
|--------|----------|-------------|
| GET | `/api/dataset-sync/schema` | Schema 19 ruoli per partner |
| POST | `/api/dataset-sync/webhook/:apiKey` | Ricezione file |
| GET | `/api/dataset-sync/sources` | Lista sorgenti |
| POST | `/api/dataset-sync/sources` | Crea sorgente |
| DELETE | `/api/dataset-sync/sources/:id` | Elimina sorgente |
| PATCH | `/api/dataset-sync/sources/:id/toggle` | Attiva/disattiva |
| POST | `/api/dataset-sync/sources/:id/regenerate-key` | Rigenera chiavi |
| GET | `/api/dataset-sync/sources/:id/schedule` | Legge schedule |
| POST | `/api/dataset-sync/sources/:id/schedule` | Aggiorna schedule |
| DELETE | `/api/dataset-sync/schedules/:id` | Elimina schedule |
| GET | `/api/dataset-sync/stats` | Statistiche dashboard |
| GET | `/api/dataset-sync/history` | Cronologia con filtri |
| POST | `/api/dataset-sync/test-webhook` | Test upload file |

---

## Stato Implementazione

### Completato
- [x] Webhook endpoint con autenticazione HMAC-SHA256
- [x] Schema endpoint con 19 ruoli semantici
- [x] 12 endpoint REST per gestione
- [x] 7 regole query engine integrate
- [x] Dashboard frontend con 6 tab
- [x] React Query hooks (13+)
- [x] Documentazione API (DATASET_SYNC_API_GUIDE.md)
- [x] Gestione empty state in SyncScheduleConfig

### Da Completare
- [ ] Abilitare scheduler in produzione (DATASET_SYNC_SCHEDULER_ENABLED=true)
- [ ] Test end-to-end con partner reale
- [ ] Metriche Prometheus/Grafana

---

## Riferimenti

- Guida tecnica: `docs/DATASET_SYNC_API_GUIDE.md`
- Semantic Layer: `docs/RDP-semantic-layer-complete.md`
- Compute-first Analysis: `docs/RDP-compute-first-data-analysis.md`
