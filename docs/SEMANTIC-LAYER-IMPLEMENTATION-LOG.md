# Semantic Layer Implementation Log

## Obiettivo
Blindare il sistema data analysis per evitare che Gemini inventi dati. Implementazione enterprise-grade.

**Aggiornato:** 2026-01-20

---

## Task List (12 punti critici)

| # | Task | Status |
|---|------|--------|
| 1 | REQUIRED function calling per richieste numeriche | ✅ Completato |
| 2 | Semantic validation colonne (no SUM su text) | ✅ Completato |
| 3 | LIMIT hard su GROUP BY (max 500) | ✅ Completato |
| 4 | SQL timeout guard (3s) | ✅ Completato |
| 5 | Result validator anti-hallucination | ✅ Completato |
| 6 | Intent classification (informational vs analytical) | ✅ Completato |
| 7 | Dataset ownership enforcement server-side | ✅ Esistente |
| 8 | Metric ENUM (tabella dataset_metrics_config) | ✅ Completato |
| 9 | Dependency graph metriche derivate | ✅ Completato |
| 10 | Cache versionata (dataset_version + metric_version) | ✅ Schema aggiornato |
| 11 | Full audit trace completo | ✅ Completato |
| 12 | Unit test metriche core | ⏳ Da fare |

---

## Implementazione Completata (2026-01-20)

### Nuovi File Creati

1. **`server/ai/data-analysis/intent-classifier.ts`**
   - Classifica domande in `analytical`, `informational`, `operational`
   - `ForceToolRetryError` per bloccare risposte senza tool
   - Pattern detection per domande numeriche

2. **`server/ai/data-analysis/metric-registry.ts`**
   - 10 metriche canoniche predefinite (ENUM)
   - revenue, food_cost, food_cost_percent, ticket_medio, etc.
   - Validazione ENUM con `isValidMetricName()`
   - Formule SQL predefinite

3. **`server/ai/data-analysis/result-validator.ts`**
   - Estrae numeri dalla risposta AI
   - Verifica che provengano dai tool results
   - Range check (0-100% per percentuali)
   - Outlier detection (warning se food_cost > 60%)

### File Modificati

1. **`server/ai/data-analysis/tool-definitions.ts`**
   - Nuovo tool `execute_metric` con ENUM (no DSL custom)
   - `query_metric` deprecato
   - Limiti hard esportati: MAX_GROUP_BY_LIMIT=500, SQL_TIMEOUT_MS=3000

2. **`server/ai/data-analysis/query-planner.ts`**
   - Import intent-classifier e metric-registry
   - System prompt aggiornato per forzare execute_metric
   - BLOCCO HARD: `ForceToolRetryError` se intent analitico e no tool
   - Validazione execute_metric in validateToolCallAgainstSchema
   - Nuovo case executeToolCall per execute_metric

3. **`server/services/client-data/query-executor.ts`**
   - DEFAULT_TIMEOUT_MS ridotto da 30s a 3s
   - MAX_GROUP_BY_LIMIT=500 enforced in aggregateGroup
   - MAX_FILTER_LIMIT=1000 enforced in filterData
   - Max 3 colonne in GROUP BY

4. **`server/ai/data-analysis/result-explainer.ts`**
   - Import result-validator
   - `validateAIResponse()` chiamato prima di restituire risposta
   - Warning aggiunto a insights se numeri inventati
   - `wasValidated` e `validationResult` in output

5. **`shared/schema.ts`**
   - clientDataMetrics: +validationRules, +dependsOn, +isPrimary, +version
   - clientDataQueryLog: +intentType, +validationResult, +metricVersion, +aiResponseHash

---

### Task 1: REQUIRED Function Calling

**Problema:** `mode: "ANY"` permette a Gemini di rispondere senza chiamare tool.

**Soluzione:**
1. Creare `intent-classifier.ts` per rilevare se domanda richiede dati
2. Modificare `query-planner.ts` per forzare retry se tool non chiamato
3. Aggiungere `ForceToolRetryError`

**File modificati:**
- `server/ai/data-analysis/intent-classifier.ts` (nuovo)
- `server/ai/data-analysis/query-planner.ts`

---

