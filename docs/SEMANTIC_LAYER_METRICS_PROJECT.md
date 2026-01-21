# Progetto: Semantic Layer Metrics & Guide UI

## 📋 OVERVIEW
Aggiungere 11 nuove metriche al semantic layer e creare una guida UI interattiva che mostra ai consulenti quali metriche sono disponibili in base alle colonne mappate nel loro dataset.

---

## 🗄️ DATABASE

### Tabelle esistenti (no modifiche)
- `client_data_datasets` - dataset caricati
- `client_data_semantic_mappings` - mapping colonne → ruoli logici

### Nessuna nuova tabella richiesta
Le metriche sono definite in codice (metric-templates.ts), non nel DB.

---

## 🔧 BACKEND

### File da modificare
```
server/ai/data-analysis/metric-templates.ts
```

### Nuove metriche da aggiungere

#### A) Data Quality (5 metriche)
| Nome | Formula | Colonne richieste |
|------|---------|-------------------|
| `lines_count` | `COUNT(*)` | nessuna |
| `missing_cost_lines` | `COUNT(*) WHERE cost IS NULL OR cost = 0` | cost |
| `missing_price_lines` | `COUNT(*) WHERE price IS NULL OR price = 0` | price |
| `negative_revenue_lines` | `COUNT(*) WHERE revenue_amount <= 0` | revenue_amount |
| `unmapped_category_lines` | `COUNT(*) WHERE category IS NULL OR category = ''` | category |

#### B) Menu Engineering (2 metriche)
| Nome | Formula | Colonne richieste |
|------|---------|-------------------|
| `gross_margin_per_item` | `SUM((price-cost)*qty) / SUM(qty)` | price, cost, quantity |
| `gross_margin_per_document` | `SUM((price-cost)*qty) / COUNT(DISTINCT doc_id)` | price, cost, quantity, document_id |

#### C) Medie Ponderate (2 metriche)
| Nome | Formula | Colonne richieste |
|------|---------|-------------------|
| `avg_unit_price_weighted` | `SUM(price*qty) / SUM(qty)` | price, quantity |
| `avg_unit_cost_weighted` | `SUM(cost*qty) / SUM(qty)` | cost, quantity |

#### D) Mix/Incidenze (2 metriche)
| Nome | Formula | Colonne richieste |
|------|---------|-------------------|
| `category_mix_percent` | `revenue_cat / revenue_total * 100` | revenue_amount, category |
| `profit_mix_percent` | `margin_cat / margin_total * 100` | price, cost, quantity, category |

### API Endpoint (nuovo)
```
GET /api/client-data/datasets/:id/available-metrics
```
Ritorna le metriche disponibili per un dataset in base ai mapping esistenti.

---

## 🎨 FRONTEND

### Nuovo componente
```
client/src/components/client-data/SemanticLayerGuide.tsx
```

### Layout UI (Card-based)
```
┌─────────────────────────────────────────────────────────────┐
│  📊 Guida Semantic Layer                              [?]   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────┐ │
│  │ 🏷️ RUOLI LOGICI │  │ 📈 METRICHE     │  │ ⚠️ QUALITÀ  │ │
│  │                 │  │                 │  │  DATI       │ │
│  │ ✅ product_name │  │ ✅ revenue      │  │             │ │
│  │ ✅ category     │  │ ✅ gross_margin │  │ 0 righe     │ │
│  │ ✅ price        │  │ ✅ ticket_medio │  │ senza costo │ │
│  │ ✅ quantity     │  │ ❌ food_cost %  │  │             │ │
│  │ ❌ cost         │  │   (manca cost)  │  │ 12 righe    │ │
│  │ ❌ document_id  │  │                 │  │ senza cat.  │ │
│  └─────────────────┘  └─────────────────┘  └─────────────┘ │
│                                                             │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ 💡 Suggerimento: Mappa la colonna "costo_unitario"      ││
│  │    al ruolo "cost" per sbloccare Food Cost e Margini    ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

### Sezioni del componente

1. **Ruoli Logici** (colonna sx)
   - Lista dei 18 ruoli con stato ✅/❌
   - Tooltip con descrizione ruolo
   - Colore verde = mappato, grigio = non mappato

2. **Metriche Disponibili** (colonna centrale)
   - Raggruppate per categoria (Fatturato, Margini, Conteggi, ecc.)
   - Badge colorati: verde = disponibile, rosso = manca dipendenza
   - Hover mostra formula SQL

3. **Qualità Dati** (colonna dx)
   - Conteggio righe con problemi
   - Indicatori warning se > 5% righe problematiche

4. **Suggerimenti** (footer)
   - Suggerisce quali colonne mappare per sbloccare metriche

### Integrazione nella pagina
In `ClientDataAnalysis.tsx` → viewMode "list":
- Aggiungere SemanticLayerGuide sotto DatasetList
- Si espande/collassa
- Mostra dati del dataset selezionato (o overview generale)

---

## 📝 WORKFLOW DI SVILUPPO

### FASE 1: Backend - Nuove Metriche
- [x] Aggiungere 5 metriche Data Quality ✅
- [x] Aggiungere 2 metriche Menu Engineering ✅
- [x] Aggiungere 2 metriche Medie Ponderate ✅
- [x] Aggiungere 2 metriche Mix/Incidenze ✅
- [x] Creare endpoint GET available-metrics ✅

### FASE 2: Frontend - Componente Guide
- [x] Creare SemanticLayerGuide.tsx ✅
- [x] Implementare sezione Ruoli Logici ✅
- [x] Implementare sezione Metriche Disponibili ✅
- [x] Implementare sezione Qualità Dati ✅
- [x] Implementare suggerimenti dinamici ✅

### FASE 3: Integrazione
- [x] Integrare in ClientDataAnalysis.tsx ✅
- [ ] Testare con dataset reale
- [ ] Verificare metriche funzionano nelle query

---

## 🔄 STATO ATTUALE
**Ultima modifica**: Componente SemanticLayerGuide integrato in ClientDataAnalysis
**Fase corrente**: FASE 4 - Test e verifica
**Task corrente**: Testing e review architetto
