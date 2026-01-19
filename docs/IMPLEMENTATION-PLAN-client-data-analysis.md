# Piano di Implementazione: Compute-First Data Analysis

**Data creazione:** Gennaio 2026  
**Basato su:** `docs/RDP-compute-first-data-analysis.md`  
**Stima totale:** ~40 ore

---

## Stato Implementazione

| Fase | Nome | Stato | Completamento |
|------|------|-------|---------------|
| 0 | Setup Iniziale | ✅ Completato | 100% |
| 1 | Database Schema | ✅ Completato | 100% |
| 2 | Upload & Parsing | 🔄 In corso | 0% |
| 3 | Column Discovery | ⬜ Da fare | 0% |
| 4 | Tabelle Dinamiche | ⬜ Da fare | 0% |
| 5 | Semantic Layer & Mini-DSL | ⬜ Da fare | 0% |
| 6 | Query Executor | ⬜ Da fare | 0% |
| 7 | Cache Anti-Stampede | ⬜ Da fare | 0% |
| 8 | AI Integration | ⬜ Da fare | 0% |
| 9 | Test Riconciliazione | ⬜ Da fare | 0% |
| 10 | Frontend | ⬜ Da fare | 0% |
| 11 | Polish & Security | ⬜ Da fare | 0% |

---

## FASE 0: Setup Iniziale

**Riferimento RDP:** Sezione "Decisioni Tecniche Critiche" (riga 13)  
**Stima:** 30 min

### Task

| # | Task | File/Comando | Stato |
|---|------|--------------|-------|
| 0.1 | Installare dipendenze NPM | `npm install exceljs chardet better-sse` | ✅ |
| 0.2 | Creare struttura cartelle backend | `server/services/client-data/` | ✅ |
| 0.3 | Creare struttura cartelle frontend | `client/src/components/client-data/` | ✅ |
| 0.4 | Creare ruolo database app_user | Supabase gestisce ruoli | ⏭️ Skip |
| 0.5 | Aggiornare .gitignore | Escludere file temporanei upload | ✅ |

### Checklist Verifica

- [ ] `npm list exceljs chardet better-sse` mostra tutte le dipendenze
- [ ] Cartella `server/services/client-data/` esiste
- [ ] Cartella `client/src/components/client-data/` esiste
- [ ] Ruolo `app_user` creato in database con NOBYPASSRLS

---

## FASE 1: Database Schema

**Riferimento RDP:** Sezione "Database Schema" (riga 117)  
**Stima:** 2h

### Task

| # | Task | File | Stato |
|---|------|------|-------|
| 1.1 | Schema client_data_datasets | SQL diretto | ✅ |
| 1.2 | Schema client_data_metrics | SQL diretto | ✅ |
| 1.3 | Schema client_data_dimensions | SQL diretto | ✅ |
| 1.4 | Schema client_data_query_log | SQL diretto | ✅ |
| 1.5 | Schema client_data_dataset_groups | SQL diretto | ✅ |
| 1.6 | Schema client_data_join_keys | SQL diretto | ✅ |
| 1.7 | Schema client_data_query_cache | SQL diretto | ✅ |
| 1.8 | Schema consultant_column_mappings | SQL diretto | ✅ |
| 1.9 | Creare indici performance | SQL diretto | ✅ |
| 1.10 | RLS policies su tutte le tabelle | SQL diretto | ⏭️ Via Supabase |
| 1.11 | Trigger auto-populate consultant_id | SQL diretto | ⏭️ Via App Logic |

### Checklist Verifica

- [ ] 8 tabelle create in database
- [ ] Indici su consultant_id/client_id esistono
- [ ] RLS attivo (verificare con `\d+ tablename`)
- [ ] Test: query con app_user vede solo propri dati

### Schema Dettagli

```
client_data_datasets       - Metadata dataset caricati
client_data_metrics        - Semantic layer metriche
client_data_dimensions     - Dimensioni per breakdown
client_data_query_log      - Audit log query
client_data_dataset_groups - Gruppi per JOIN
client_data_join_keys      - Chiavi JOIN tra tabelle
client_data_query_cache    - Cache query frequenti
consultant_column_mappings - Mapping salvati per consultant
```

---

## FASE 2: Upload & Parsing

**Riferimento RDP:** Sezione "upload-processor.ts" (riga 463)  
**Stima:** 4h

### Task

| # | Task | File | Stato |
|---|------|------|-------|
| 2.1 | Endpoint upload | `server/routes/client-data-router.ts` | ⬜ |
| 2.2 | Multer config (50MB limit) | `server/routes/client-data-router.ts` | ⬜ |
| 2.3 | ExcelJS streaming parser | `server/services/client-data/upload-processor.ts` | ⬜ |
| 2.4 | CSV parser con chardet | `server/services/client-data/upload-processor.ts` | ⬜ |
| 2.5 | Sampling distribuito | `server/services/client-data/column-profiler.ts` | ⬜ |
| 2.6 | Creazione staging table | `server/services/client-data/upload-processor.ts` | ⬜ |
| 2.7 | Import con COPY | `server/services/client-data/upload-processor.ts` | ⬜ |
| 2.8 | Swap atomico (RENAME) | `server/services/client-data/upload-processor.ts` | ⬜ |
| 2.9 | Fallback batch INSERT | `server/services/client-data/upload-processor.ts` | ⬜ |
| 2.10 | Progress SSE endpoint | `server/routes/client-data-router.ts` | ⬜ |
| 2.11 | Gestione multi-foglio Excel | `server/services/client-data/upload-processor.ts` | ⬜ |
| 2.12 | Gestione encoding CSV | `server/services/client-data/upload-processor.ts` | ⬜ |

### Checklist Verifica

- [ ] Upload Excel 50MB funziona senza crash
- [ ] Upload CSV con encoding Latin1 funziona
- [ ] Progress bar aggiorna correttamente
- [ ] Import 100k righe < 30 sec
- [ ] Staging table eliminata dopo swap
- [ ] File Excel multi-foglio mostra selezione

---

## FASE 3: Column Discovery

**Riferimento RDP:** Sezione "column-discovery.ts" (riga 682)  
**Stima:** 3h

### Task

| # | Task | File | Stato |
|---|------|------|-------|
| 3.1 | Pattern detection TYPE_PATTERNS | `server/services/client-data/column-discovery.ts` | ⬜ |
| 3.2 | Template KNOWN_COLUMN_TEMPLATES | `server/services/client-data/column-templates.ts` | ⬜ |
| 3.3 | Funzione inferColumnTypeByPattern | `server/services/client-data/column-discovery.ts` | ⬜ |
| 3.4 | Calcolo confidence score | `server/services/client-data/column-discovery.ts` | ⬜ |
| 3.5 | Fallback AI per confidence < 80% | `server/services/client-data/column-discovery.ts` | ⬜ |
| 3.6 | Auto-conferma se confidence >= 85% | `server/services/client-data/column-discovery.ts` | ⬜ |
| 3.7 | Sampling distribuito integrazione | `server/services/client-data/column-profiler.ts` | ⬜ |
| 3.8 | Salvataggio mapping consultant | `server/services/client-data/column-discovery.ts` | ⬜ |

### Checklist Verifica

- [ ] Template DDTRIGHE riconosciuto automaticamente
- [ ] Date in formato DD/MM/YYYY rilevate
- [ ] Valute rilevate correttamente
- [ ] AI chiamata SOLO se confidence < 80%
- [ ] Auto-conferma testata con file noto
- [ ] Mapping salvato riutilizzato al secondo upload

---

## FASE 4: Tabelle Dinamiche

**Riferimento RDP:** Sezione "table-generator.ts" (riga 841)  
**Stima:** 3h

### Task

| # | Task | File | Stato |
|---|------|------|-------|
| 4.1 | Funzione sanitizeIdentifier | `server/services/client-data/table-generator.ts` | ⬜ |
| 4.2 | Funzione generateTableName | `server/services/client-data/table-generator.ts` | ⬜ |
| 4.3 | Funzione mapToPostgresType | `server/services/client-data/table-generator.ts` | ⬜ |
| 4.4 | Funzione createDataTable (raw SQL) | `server/services/client-data/table-generator.ts` | ⬜ |
| 4.5 | Aggiunta colonne consultant_id/client_id | `server/services/client-data/table-generator.ts` | ⬜ |
| 4.6 | Creazione RLS policy su tabella cdd_* | `server/services/client-data/table-generator.ts` | ⬜ |
| 4.7 | Creazione indici automatici | `server/services/client-data/table-generator.ts` | ⬜ |
| 4.8 | Cleanup tabelle orfane (cron) | `server/cron/cleanup-orphan-tables.ts` | ⬜ |
| 4.9 | Dataset Groups per JOIN | `server/services/client-data/dataset-groups.ts` | ⬜ |
| 4.10 | Gestione re-upload (versioning) | `server/services/client-data/table-generator.ts` | ⬜ |

### Checklist Verifica

- [ ] Naming convention `cdd_{consultantId}_{clientId}_{name}` rispettata
- [ ] Nomi > 63 char troncati con hash
- [ ] RLS policy creata automaticamente
- [ ] Indice su consultant_id/client_id creato
- [ ] Test cross-tenant fallisce (RLS funziona)
- [ ] Re-upload mantiene backup
- [ ] Cron cleanup elimina tabelle orfane

---

## FASE 5: Semantic Layer & Mini-DSL

**Riferimento RDP:** Sezione "Mini-DSL per Validazione Metriche" (riga 2254)  
**Stima:** 3h

### Task

| # | Task | File | Stato |
|---|------|------|-------|
| 5.1 | DSL Tokenizer | `server/services/client-data/metric-dsl.ts` | ⬜ |
| 5.2 | DSL Parser (AST) | `server/services/client-data/metric-dsl.ts` | ⬜ |
| 5.3 | Validazione AST | `server/services/client-data/metric-dsl.ts` | ⬜ |
| 5.4 | Generazione SQL sicuro | `server/services/client-data/metric-dsl.ts` | ⬜ |
| 5.5 | Funzioni whitelist | `server/services/client-data/metric-dsl.ts` | ⬜ |
| 5.6 | Metric Suggester AI | `server/services/client-data/metric-suggester.ts` | ⬜ |
| 5.7 | Metriche auto-generate | `server/services/client-data/metric-suggester.ts` | ⬜ |
| 5.8 | Endpoint CRUD metriche | `server/routes/client-data-router.ts` | ⬜ |

### Funzioni DSL Supportate

```
sum(colonna)              -> SUM(colonna)
avg(colonna)              -> AVG(colonna)
count(colonna)            -> COUNT(colonna)
count_distinct(colonna)   -> COUNT(DISTINCT colonna)
min(colonna) / max(colonna)
ratio(a, b)               -> (a) / NULLIF((b), 0)
percent(parte, totale)    -> 100.0 * (parte) / NULLIF((totale), 0)
subtract(a, b) / add(a, b) / multiply(a, b)
```

### Checklist Verifica

- [ ] DSL `sum(importo_totale)` -> `SUM(importo_totale)`
- [ ] DSL `ratio(sum(a), count(b))` funziona con nesting
- [ ] SQL injection impossibile (testare con `'; DROP TABLE`)
- [ ] Colonne non esistenti rifiutate
- [ ] Metriche suggerite automaticamente per colonne numeriche
- [ ] CRUD metriche funziona

---

## FASE 6: Query Executor

**Riferimento RDP:** Sezione "query-executor.ts" (riga 1068)  
**Stima:** 3h

### Task

| # | Task | File | Stato |
|---|------|------|-------|
| 6.1 | Tool get_metric | `server/services/client-data/query-executor.ts` | ⬜ |
| 6.2 | Tool breakdown | `server/services/client-data/query-executor.ts` | ⬜ |
| 6.3 | Tool top_bottom | `server/services/client-data/query-executor.ts` | ⬜ |
| 6.4 | Tool compare_periods | `server/services/client-data/query-executor.ts` | ⬜ |
| 6.5 | Tool profile_dataset | `server/services/client-data/query-executor.ts` | ⬜ |
| 6.6 | Timeout 30s per query | `server/services/client-data/query-executor.ts` | ⬜ |
| 6.7 | Limite 10k righe risultato | `server/services/client-data/query-executor.ts` | ⬜ |
| 6.8 | SET LOCAL tenant context | `server/middleware/set-tenant-context.ts` | ⬜ |
| 6.9 | Logging query in audit log | `server/services/client-data/query-executor.ts` | ⬜ |
| 6.10 | Supporto JOIN per dataset groups | `server/services/client-data/query-executor.ts` | ⬜ |
| 6.11 | Endpoint per ogni tool | `server/routes/client-data-router.ts` | ⬜ |

### Checklist Verifica

- [ ] get_metric ritorna valore corretto
- [ ] breakdown ritorna array con dimensione
- [ ] top_bottom ritorna top N ordinati
- [ ] compare_periods ritorna differenza %
- [ ] profile_dataset ritorna stats colonne
- [ ] Timeout scatta dopo 30s
- [ ] Max 10k righe rispettato
- [ ] SET LOCAL impostato prima di ogni query
- [ ] Query loggata in audit log

---

## FASE 7: Cache Anti-Stampede

**Riferimento RDP:** Sezione "Caching Query Frequenti" (riga 2498)  
**Stima:** 2h

### Task

| # | Task | File | Stato |
|---|------|------|-------|
| 7.1 | Tabella client_data_query_cache | SQL diretto | ⬜ |
| 7.2 | Funzione hashQuery | `server/services/client-data/query-cache.ts` | ⬜ |
| 7.3 | SKIP LOCKED per anti-stampede | `server/services/client-data/query-cache.ts` | ⬜ |
| 7.4 | Stato computing/ready/error | `server/services/client-data/query-cache.ts` | ⬜ |
| 7.5 | Polling per attesa risultato | `server/services/client-data/query-cache.ts` | ⬜ |
| 7.6 | TTL e invalidazione | `server/services/client-data/query-cache.ts` | ⬜ |
| 7.7 | Cleanup cache vecchia (cron) | `server/cron/cleanup-cache.ts` | ⬜ |
| 7.8 | Monitoring cache bloccate | `server/services/client-data/query-cache.ts` | ⬜ |

### Checklist Verifica

- [ ] Prima query calcola e salva in cache
- [ ] Seconda query identica usa cache
- [ ] 50 request parallele = 1 sola query SQL
- [ ] Cache invalidata quando dataset aggiornato
- [ ] Cleanup elimina cache scaduta
- [ ] Alert se cache bloccata > 5 min

---

## FASE 8: AI Integration

**Riferimento RDP:** Sezione "AI Integration (Gemini 3 Pro)" (riga 1133)  
**Stima:** 4h

### Task

| # | Task | File | Stato |
|---|------|------|-------|
| 8.1 | Tool definitions per Gemini | `server/ai/data-analysis/tool-definitions.ts` | ⬜ |
| 8.2 | System prompt builder | `server/ai/data-analysis/query-planner.ts` | ⬜ |
| 8.3 | Query loop multi-round (max 10) | `server/ai/data-analysis/query-planner.ts` | ⬜ |
| 8.4 | Validazione tool call | `server/ai/data-analysis/query-planner.ts` | ⬜ |
| 8.5 | Retry se AI non chiama tool | `server/ai/data-analysis/query-planner.ts` | ⬜ |
| 8.6 | Result explainer | `server/ai/data-analysis/result-explainer.ts` | ⬜ |
| 8.7 | Output strutturato JSON | `server/ai/data-analysis/structured-output.ts` | ⬜ |
| 8.8 | Progress SSE durante analisi | `server/routes/client-data-router.ts` | ⬜ |
| 8.9 | Timeout 5 min totale | `server/ai/data-analysis/query-planner.ts` | ⬜ |
| 8.10 | Endpoint /query/natural | `server/routes/client-data-router.ts` | ⬜ |

### Checklist Verifica

- [ ] AI chiama tool get_metric correttamente
- [ ] Multi-round funziona (max 10 round)
- [ ] Retry scatta se AI risponde senza tool
- [ ] Output JSON valido sempre
- [ ] Progress SSE aggiorna durante analisi
- [ ] Timeout 5 min rispettato
- [ ] Explanation human-readable

---

## FASE 9: Test Riconciliazione

**Riferimento RDP:** Sezione "Test di Riconciliazione Automatici" (riga 2756)  
**Stima:** 2h

### Task

| # | Task | File | Stato |
|---|------|------|-------|
| 9.1 | Test somma categoria = totale | `server/services/client-data/reconciliation-tests.ts` | ⬜ |
| 9.2 | Test somma giorni = mese | `server/services/client-data/reconciliation-tests.ts` | ⬜ |
| 9.3 | Test valori negativi inaspettati | `server/services/client-data/reconciliation-tests.ts` | ⬜ |
| 9.4 | Esecuzione automatica post-import | `server/services/client-data/upload-processor.ts` | ⬜ |
| 9.5 | Append warning a risposta AI | `server/ai/data-analysis/structured-output.ts` | ⬜ |
| 9.6 | UI mostra warning riconciliazione | Frontend | ⬜ |

### Checklist Verifica

- [ ] Test eseguiti automaticamente dopo import
- [ ] Warning visibile se somme non tornano
- [ ] Tolleranza 0.01 per errori float
- [ ] Warning quantita negative segnalato
- [ ] Warning incluso in risposta AI

---

## FASE 10: Frontend

**Riferimento RDP:** Sezione "Frontend" (riga 1323)  
**Stima:** 6h

### Task

| # | Task | File | Stato |
|---|------|------|-------|
| 10.1 | DatasetUploader (drag & drop) | `client/src/components/client-data/DatasetUploader.tsx` | ⬜ |
| 10.2 | ProgressBar upload | `client/src/components/client-data/DatasetUploader.tsx` | ⬜ |
| 10.3 | SheetSelector (Excel multi-foglio) | `client/src/components/client-data/SheetSelector.tsx` | ⬜ |
| 10.4 | ColumnMappingEditor | `client/src/components/client-data/ColumnMappingEditor.tsx` | ⬜ |
| 10.5 | DatasetPreview | `client/src/components/client-data/DatasetPreview.tsx` | ⬜ |
| 10.6 | MetricsEditor con DSL | `client/src/components/client-data/MetricsEditor.tsx` | ⬜ |
| 10.7 | DatasetGroupsEditor | `client/src/components/client-data/DatasetGroupsEditor.tsx` | ⬜ |
| 10.8 | QueryInterface (chat) | `client/src/components/client-data/QueryInterface.tsx` | ⬜ |
| 10.9 | ResultsDisplay | `client/src/components/client-data/ResultsDisplay.tsx` | ⬜ |
| 10.10 | DatasetCard | `client/src/components/client-data/DatasetCard.tsx` | ⬜ |
| 10.11 | ProgressIndicator SSE | `client/src/hooks/useAnalysisProgress.ts` | ⬜ |
| 10.12 | Pagina lista dataset (consultant) | `client/src/pages/consultant/ClientDatasets.tsx` | ⬜ |
| 10.13 | Pagina lista dataset (client) | `client/src/pages/client/MyDatasets.tsx` | ⬜ |
| 10.14 | Integrazione sidebar menu | Aggiornare navigazione | ⬜ |

### Checklist Verifica

- [ ] Upload drag & drop funziona
- [ ] Progress bar durante upload
- [ ] Selezione foglio Excel funziona
- [ ] Mapping colonne editabile
- [ ] Preview dati mostra prime righe
- [ ] Editor metriche con dropdown
- [ ] Editor gruppi per JOIN
- [ ] Chat query funziona
- [ ] Risultati formattati correttamente
- [ ] Tutto responsive mobile

---

## FASE 11: Polish & Security

**Riferimento RDP:** Sezione "Sicurezza Avanzata" (riga 1880)  
**Stima:** 3h

### Task

| # | Task | File | Stato |
|---|------|------|-------|
| 11.1 | Error handling user-friendly | Tutti i file | ⬜ |
| 11.2 | Rate limiting (100 query/min) | `server/routes/client-data-router.ts` | ⬜ |
| 11.3 | Limiti per consultant | `server/services/client-data/limits.ts` | ⬜ |
| 11.4 | Logging completo | `server/services/client-data/*.ts` | ⬜ |
| 11.5 | Test E2E flow completo | `tests/client-data.test.ts` | ⬜ |
| 11.6 | Test RLS isolamento | `tests/client-data-security.test.ts` | ⬜ |
| 11.7 | Documentazione utente | `docs/USER-GUIDE-data-analysis.md` | ⬜ |
| 11.8 | Cleanup file temporanei | Cron job | ⬜ |

### Limiti per Consultant

```typescript
const LIMITS = {
  maxDatasets: 50,
  maxRowsPerDataset: 1_000_000,
  maxTotalRows: 10_000_000,
  maxStorageMB: 500,
  maxQueriesPerDay: 10_000,
};
```

### Checklist Verifica

- [ ] Errori mostrati in italiano chiaro
- [ ] Rate limit blocca dopo 100 query/min
- [ ] Limiti storage rispettati
- [ ] Log audit completi
- [ ] Test E2E passa
- [ ] Test RLS passa
- [ ] Documentazione scritta

---

## File Backend da Creare

```
server/
├── routes/
│   └── client-data-router.ts
├── services/
│   └── client-data/
│       ├── upload-processor.ts
│       ├── column-discovery.ts
│       ├── column-templates.ts
│       ├── column-profiler.ts
│       ├── table-generator.ts
│       ├── dataset-groups.ts
│       ├── metric-dsl.ts
│       ├── metric-suggester.ts
│       ├── query-executor.ts
│       ├── query-cache.ts
│       ├── reconciliation-tests.ts
│       └── limits.ts
├── ai/
│   └── data-analysis/
│       ├── query-planner.ts
│       ├── result-explainer.ts
│       ├── tool-definitions.ts
│       └── structured-output.ts
├── middleware/
│   └── set-tenant-context.ts
├── cron/
│   ├── cleanup-orphan-tables.ts
│   └── cleanup-cache.ts
└── types/
    └── client-data.ts
```

---

## File Frontend da Creare

```
client/src/
├── components/
│   └── client-data/
│       ├── DatasetUploader.tsx
│       ├── SheetSelector.tsx
│       ├── ColumnMappingEditor.tsx
│       ├── DatasetPreview.tsx
│       ├── MetricsEditor.tsx
│       ├── DatasetGroupsEditor.tsx
│       ├── QueryInterface.tsx
│       ├── ResultsDisplay.tsx
│       └── DatasetCard.tsx
├── pages/
│   ├── consultant/
│   │   └── ClientDatasets.tsx
│   └── client/
│       └── MyDatasets.tsx
└── hooks/
    └── useAnalysisProgress.ts
```

---

## Note Critiche da Non Dimenticare

### Sicurezza

1. **ExcelJS streaming** - NON usare xlsx (carica tutto in RAM)
2. **Raw SQL per DDL** - Drizzle non supporta tabelle runtime
3. **app_user ruolo** - NON superuser (bypassa RLS)
4. **SET LOCAL** - Evita leak tra request con connection pool
5. **FORCE RLS** - Anche su tabelle cdd_* dinamiche
6. **Mini-DSL** - NON regex per validare formule

### Performance

7. **COPY + staging** - 10x piu veloce di INSERT batch
8. **Indici DOPO import** - Molto piu veloce
9. **SKIP LOCKED** - Evita stampede cache
10. **Sampling distribuito** - Inizio/meta/fine, non solo prime 100

### AI

11. **Retry se no tool call** - AI puo rispondere senza chiamare tool
12. **Max 10 round** - Evita loop infiniti
13. **Timeout 5 min** - Analisi complesse richiedono tempo
14. **Output strutturato** - JSON sempre, non testo libero

### Automazione

15. **Auto-conferma 85%** - Zero-click per installazioni massive
16. **Template gestionali** - Pattern pre-definiti per DDTRIGHE etc
17. **Learning mapping** - Salva correzioni consultant

---

## Dipendenze da Installare

```bash
npm install exceljs chardet better-sse
```

---

## Log Progressi

| Data | Fase | Task | Stato | Note |
|------|------|------|-------|------|
| 2026-01-19 | - | Piano creato | OK | File IMPLEMENTATION-PLAN creato |

