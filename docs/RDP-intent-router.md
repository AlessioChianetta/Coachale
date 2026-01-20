# RDP: Intent Router Architecture

## 1. Problem Statement

### Current Issues
Il sistema attuale (query-planner.ts) mescola troppe responsabilità:
1. Classificazione dell'intento utente
2. Selezione dei tool
3. Esecuzione delle query
4. Generazione della risposta

**Conseguenze osservate:**
- Alla domanda "Come posso aumentare il fatturato del 50%?" il planner chiama `filter_data`
- Gemini legge righe raw e poi **inventa numeri** (fatturato mensile, ticket medio diversi dal reale)
- Proiezioni non richieste
- Pattern attribuiti senza evidenza nei dati

### Root Cause
Il prompt monolitico `SYSTEM_PROMPT_IT` (146 righe) contiene:
- Regole di intent routing
- Logiche di tool selection
- Istruzioni consulenziali
- Regole anti-hallucination

Gemini non riesce a distinguere chiaramente tra "strategia" e "analytics".

---

## 2. Solution Architecture

### 3-Layer Pipeline

```
User prompt
    ↓
┌─────────────────────────────────────────────┐
│           ROUTER AGENT                       │
│  Model: gemini-2.5-flash-lite               │
│  File: server/ai/data-analysis/intent-router.ts │
│  Responsabilità: SOLO classificare intent   │
│  Output: IntentRouterOutput (JSON)          │
└────────────────────┬────────────────────────┘
                     ↓
┌─────────────────────────────────────────────┐
│           POLICY ENGINE                      │
│  Zero AI - TypeScript puro                  │
│  File: server/ai/data-analysis/policy-engine.ts │
│  Responsabilità: Gate keeper per tool       │
│  Blocca tool non consentiti per intent      │
└────────────────────┬────────────────────────┘
                     ↓
┌─────────────────────────────────────────────┐
│         EXECUTION AGENT                      │
│  Model: gemini-2.5-flash (analytics)        │
│         gemini-2.5-flash-lite (strategy)    │
│  File: query-planner.ts (refactored)        │
│  Responsabilità: Esecuzione controllata     │
└────────────────────┬────────────────────────┘
                     ↓
                 Validator
```

---

## 3. Router Agent Specification

### Model
- **Name:** `gemini-2.5-flash-lite`
- **Temperature:** 0.0 (deterministic)
- **Max tokens:** 256 (output is small JSON)

### Prompt Design

```
Sei un classificatore di intenti. NON fare analisi, NON generare numeri.

ANALIZZA la domanda dell'utente e restituisci SOLO un JSON con:
- intent: tipo di richiesta
- requires_metrics: se servono numeri dal database
- suggested_tools: tool consigliati (può essere vuoto)

========================
INTENT TYPES
========================

ANALYTICS (requires_metrics: true)
- Domande che chiedono numeri specifici
- Esempi: "Qual è il fatturato?", "Quanti ordini?", "Food cost %"
- Tool: execute_metric, aggregate_group, compare_periods

STRATEGY (requires_metrics: false)
- Domande consulenziali/strategiche
- Esempi: "Come aumento il fatturato?", "Consigli per ridurre i costi"
- Tool: NESSUNO - risposta qualitativa

DATA_PREVIEW (requires_metrics: false)
- Richieste di vedere righe raw
- Esempi: "Mostrami i dati", "Prime 10 righe", "Lista ordini"
- Tool: filter_data SOLO

CONVERSATIONAL (requires_metrics: false)
- Saluti, ringraziamenti, conferme
- Esempi: "Grazie", "Ok", "Ciao"
- Tool: NESSUNO

========================
OUTPUT FORMAT
========================

Rispondi SOLO con JSON valido, senza markdown:
{
  "intent": "analytics" | "strategy" | "data_preview" | "conversational",
  "requires_metrics": boolean,
  "suggested_tools": ["tool_name"] | [],
  "confidence": 0.0-1.0
}
```

### Output Schema (TypeScript)

```typescript
export type IntentType = "analytics" | "strategy" | "data_preview" | "conversational";

export interface IntentRouterOutput {
  intent: IntentType;
  requires_metrics: boolean;
  suggested_tools: string[];
  confidence: number;
}
```

---

## 4. Policy Engine Specification

### Rules Matrix

| Intent | Tool Consentiti | Tool Vietati | Response Mode |
|--------|-----------------|--------------|---------------|
| `analytics` | execute_metric, aggregate_group, compare_periods | filter_data (raw), generazione numeri | DATA MODE |
| `strategy` | NESSUNO | TUTTI | QUALITATIVE MODE |
| `data_preview` | filter_data | execute_metric, aggregate_group | PREVIEW MODE |
| `conversational` | NESSUNO | TUTTI | SIMPLE REPLY |

### Enforcement Rules (TypeScript)

```typescript
interface PolicyRule {
  intent: IntentType;
  allowedTools: string[];
  blockedTools: string[];
  blockNumericGeneration: boolean;
  requireToolCall: boolean;
}

const POLICY_RULES: Record<IntentType, PolicyRule> = {
  analytics: {
    intent: "analytics",
    allowedTools: ["execute_metric", "aggregate_group", "compare_periods"],
    blockedTools: ["filter_data"],
    blockNumericGeneration: true,  // AI cannot invent numbers
    requireToolCall: true,         // MUST call a tool
  },
  strategy: {
    intent: "strategy",
    allowedTools: [],
    blockedTools: ["execute_metric", "aggregate_group", "compare_periods", "filter_data"],
    blockNumericGeneration: true,  // NO numbers at all
    requireToolCall: false,        // Pure text response
  },
  data_preview: {
    intent: "data_preview",
    allowedTools: ["filter_data"],
    blockedTools: ["execute_metric", "aggregate_group", "compare_periods"],
    blockNumericGeneration: true,  // Only show raw data
    requireToolCall: true,
  },
  conversational: {
    intent: "conversational",
    allowedTools: [],
    blockedTools: ["execute_metric", "aggregate_group", "compare_periods", "filter_data"],
    blockNumericGeneration: false,
    requireToolCall: false,
  },
};
```

### Policy Enforcement Flow

```typescript
function enforcePolicyOnToolCalls(
  intent: IntentType,
  toolCalls: ToolCall[]
): { allowed: ToolCall[]; blocked: ToolCall[]; violations: string[] } {
  const policy = POLICY_RULES[intent];
  const allowed: ToolCall[] = [];
  const blocked: ToolCall[] = [];
  const violations: string[] = [];

  for (const call of toolCalls) {
    if (policy.blockedTools.includes(call.name)) {
      blocked.push(call);
      violations.push(`Tool "${call.name}" non consentito per intent "${intent}"`);
    } else if (policy.allowedTools.length === 0 || policy.allowedTools.includes(call.name)) {
      allowed.push(call);
    } else {
      blocked.push(call);
      violations.push(`Tool "${call.name}" non nella lista consentita per intent "${intent}"`);
    }
  }

  return { allowed, blocked, violations };
}
```

---

## 5. Execution Agent Prompts

### ANALYTICS_AGENT_PROMPT

```
Sei un esecutore di analytics. Il tuo UNICO compito è chiamare i tool corretti.

REGOLE:
1. DEVI chiamare almeno un tool compute (execute_metric, aggregate_group, compare_periods)
2. NON generare numeri autonomamente
3. NON fare consulenza o suggerimenti
4. Riporta SOLO i risultati dei tool

METRICHE DISPONIBILI:
- revenue: Fatturato totale
- food_cost: Costo materie prime
- food_cost_percent: Food cost %
- ticket_medio: Valore medio per ordine
- order_count: Numero ordini
- gross_margin: Margine lordo
- gross_margin_percent: Margine lordo %

OUTPUT:
- Chiama i tool necessari
- Attendi i risultati
- Formatta i numeri con precisione (2 decimali per €, 1 per %)
```

### STRATEGY_AGENT_PROMPT

```
Sei un consulente strategico. Rispondi a domande di business SENZA numeri.

REGOLE:
1. NON chiamare tool
2. NON citare numeri specifici (€, %, quantità)
3. NON fare proiezioni numeriche
4. Fornisci consigli qualitativi generali

APPROCCIO:
- Identifica le leve strategiche (pricing, costi, volume, mix prodotti)
- Suggerisci framework di analisi
- Proponi azioni concrete senza quantificarle
- Se servono numeri, suggerisci di chiedere analytics specifici

ESEMPIO:
Domanda: "Come posso aumentare il fatturato?"
Risposta: "Per aumentare il fatturato puoi lavorare su tre leve:
1. **Volume**: Aumentare il numero di clienti o ordini
2. **Prezzo**: Rivedere il pricing dei prodotti più venduti
3. **Mix**: Promuovere prodotti ad alto margine

Vuoi che analizzi i dati attuali per identificare le opportunità specifiche?"
```

### DATA_PREVIEW_PROMPT

```
Mostra i dati richiesti senza analisi.

REGOLE:
1. Usa SOLO filter_data
2. NON calcolare aggregati
3. NON commentare i dati
4. Formatta come tabella leggibile
```

---

## 6. Database Changes

Nessuna modifica al database richiesta. I log di routing possono essere aggiunti opzionalmente per telemetria.

---

## 7. API Changes

### Existing Endpoint (Modified)
`POST /api/client-data/conversations/:id/messages`

Il flusso interno cambia ma l'API resta identica.

### Internal Flow

```typescript
// Before (monolithic)
askDataset(question) {
  intent = classifyIntent(question);  // rule-based
  plan = planQuery(question);         // AI does everything
  results = executeTools(plan);
  response = explainResults(results);
}

// After (3-layer)
askDataset(question) {
  // Layer 1: Router (AI - flash-lite)
  routerOutput = await routeIntent(question);
  
  // Layer 2: Policy (TypeScript - no AI)
  policy = POLICY_RULES[routerOutput.intent];
  
  // Layer 3: Execution (AI - flash)
  if (policy.requireToolCall) {
    plan = await planAnalytics(question, policy.allowedTools);
    validated = enforcePolicyOnToolCalls(routerOutput.intent, plan.steps);
    if (validated.violations.length > 0) {
      return errorResponse(validated.violations);
    }
    results = await executeTools(validated.allowed);
    response = await explainResults(results);
  } else {
    response = await generateQualitativeResponse(question, routerOutput.intent);
  }
}
```

---

## 8. Test Cases

### Test 1: Strategy Intent
```
Input: "Come posso aumentare il fatturato del 50% nei prossimi 12 mesi?"
Expected Router Output:
{
  "intent": "strategy",
  "requires_metrics": false,
  "suggested_tools": [],
  "confidence": 0.95
}
Expected Behavior:
- NO tool calls
- Qualitative response about revenue growth strategies
- NO invented numbers
```

### Test 2: Analytics Intent
```
Input: "Qual è il fatturato totale?"
Expected Router Output:
{
  "intent": "analytics",
  "requires_metrics": true,
  "suggested_tools": ["execute_metric"],
  "confidence": 0.98
}
Expected Behavior:
- Tool call: execute_metric(metricName: "revenue")
- Response with exact number from database
```

### Test 3: Data Preview Intent
```
Input: "Mostrami le prime 10 righe"
Expected Router Output:
{
  "intent": "data_preview",
  "requires_metrics": false,
  "suggested_tools": ["filter_data"],
  "confidence": 0.95
}
Expected Behavior:
- Tool call: filter_data(limit: 10)
- Table display of raw data
- NO aggregates or KPIs
```

### Test 4: Conversational Intent
```
Input: "Grazie, perfetto!"
Expected Router Output:
{
  "intent": "conversational",
  "requires_metrics": false,
  "suggested_tools": [],
  "confidence": 0.99
}
Expected Behavior:
- NO tool calls
- Simple acknowledgment response
```

### Test 5: Mixed Intent (Edge Case)
```
Input: "Quanto fatturato serve per crescere del 50%?"
Expected Router Output:
{
  "intent": "analytics",
  "requires_metrics": true,
  "suggested_tools": ["execute_metric"],
  "confidence": 0.85
}
Expected Behavior:
- First: execute_metric(revenue) to get current value
- Then: Calculate 50% increase (math, not AI invention)
```

---

## 9. Golden Test Values

Using `restaurant_complex_dataset`:
- **revenue**: 21956.62 €
- **food_cost**: 7689.61 €
- **order_count**: 941
- **ticket_medio**: 23.33 €
- **food_cost_percent**: 35.02%
- **gross_margin**: 14267.01 €

---

## 10. Implementation Order

1. **intent-router.ts** - Router Agent con prompt e chiamata a gemini-2.5-flash-lite
2. **policy-engine.ts** - Regole hardcoded TypeScript
3. **query-planner.ts refactor** - Rimuovere logica intent, usare pipeline
4. **Test acceptance** - Verificare i 4 test cases

---

## 11. Rollback Plan

Se emergono problemi:
1. Feature flag `USE_INTENT_ROUTER` (default: false)
2. Fallback al sistema monolitico esistente
3. Log dettagliato per debugging

---

## 12. Metrics & Monitoring

### Success Metrics
- Riduzione hallucination numeriche: target 0%
- Intent classification accuracy: target >95%
- Latency overhead Router: <200ms

### Logging
```typescript
console.log(`[INTENT-ROUTER] Question: "${question.substring(0,50)}..."`);
console.log(`[INTENT-ROUTER] Result: ${JSON.stringify(routerOutput)}`);
console.log(`[POLICY-ENGINE] Intent: ${intent}, Allowed: ${allowed.length}, Blocked: ${blocked.length}`);
```
