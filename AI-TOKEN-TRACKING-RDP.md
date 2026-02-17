# RDP — AI Token Usage Tracking & Cost Analytics

**Versione:** 1.0  
**Data:** 17 Febbraio 2026  
**Stato:** Piano di Implementazione  

---

## 1. OBIETTIVO

Implementare un sistema completo di tracking dei token AI che:
- Registri **ogni chiamata** a Gemini (generateContent, generateContentStream, Live API)
- Calcoli automaticamente i **costi** basandosi sul modello utilizzato
- Permetta ai **consultant** di vedere quanto spende ogni cliente
- Permetta all'**admin** di vedere quanto spende ogni consultant
- Identifichi le **funzionalità** che consumano più token per ottimizzare

---

## 2. MAPPATURA COMPLETA DELLE CHIAMATE AI

### 2.1 — Chiamate via GeminiClientAdapter (provider-factory.ts)

Queste passano tutte attraverso `GeminiClientAdapter.generateContent()` o `GeminiClientAdapter.generateContentStream()`.
L'adapter è il **punto di intercezione principale** — modificando solo qui, copriamo ~70% delle chiamate.

**File che usano `getAIProvider()` → adapter:**

| # | File | Funzionalità | Tipo |
|---|------|-------------|------|
| 1 | `server/ai/discovery-rec-generator.ts` | Generazione raccomandazioni discovery | generateContent |
| 2 | `server/ai/email-template-generator.ts` | Generazione template email | generateContent |
| 3 | `server/ai/gemini-training-analyzer.ts` | Analisi training AI | generateContent |
| 4 | `server/ai/human-like-decision-engine.ts` | Decisioni AI human-like | generateContent |
| 5 | `server/ai/sales-agent-context-builder.ts` | Contesto agente vendita | generateContent |
| 6 | `server/ai/sales-manager-agent.ts` | Agente manager vendite | generateContent |
| 7 | `server/ai/step-advancement-agent.ts` | Agente avanzamento step | generateContent |
| 8 | `server/ai/followup-decision-engine.ts` | Engine decisioni follow-up | generateContent |
| 9 | `server/ai/data-analysis/intent-router.ts` | Routing intent analisi dati | generateContent |
| 10 | `server/ai/data-analysis/result-explainer.ts` | Spiegazione risultati analisi | generateContent |
| 11 | `server/ai/data-analysis/query-planner.ts` | Pianificazione query | generateContent |
| 12 | `server/booking/booking-intent-detector.ts` | Rilevamento intent booking | generateContent |
| 13 | `server/booking/booking-service.ts` | Servizio prenotazioni | generateContent |
| 14 | `server/cron/followup-scheduler.ts` | Scheduler follow-up | generateContent |
| 15 | `server/instagram/message-processor.ts` | Elaborazione messaggi Instagram | generateContent |
| 16 | `server/routes/echo.ts` | Echo/riassunti | generateContent |
| 17 | `server/routes/public-ai-chat-router.ts` | Chat AI pubblica | generateContent |
| 18 | `server/routes/script-builder.ts` | Costruttore script vendita | generateContent |
| 19 | `server/routes/whatsapp/agent-instructions-router.ts` | Istruzioni agente WhatsApp | generateContent |
| 20 | `server/routes/whatsapp/custom-templates.ts` | Template WhatsApp custom | generateContent |
| 21 | `server/routes/whatsapp/public-share-router.ts` | Condivisione pubblica agente | generateContent |
| 22 | `server/routes/ai-assistant-router.ts` | Assistente AI consultant | generateContent |
| 23 | `server/routes/content-studio.ts` | Studio contenuti | generateContent |
| 24 | `server/routes/onboarding.ts` | Onboarding AI | generateContent |
| 25 | `server/routes/sales-reports.ts` | Report vendite | generateContent |
| 26 | `server/routes/ai-autonomy-router.ts` | Autonomia AI | generateContent |
| 27 | `server/routes/public-agent-router.ts` | Router agente pubblico | generateContent |
| 28 | `server/services/content-ai-service.ts` | Servizio AI contenuti | generateContent |
| 29 | `server/services/email-hub/email-ai-service.ts` | Servizio AI email hub | generateContent |
| 30 | `server/services/document-processor.ts` | Processore documenti | generateContent |
| 31 | `server/services/conversation-memory/memory-service.ts` | Memoria conversazioni | generateContent |
| 32 | `server/services/lead-nurturing-generation-service.ts` | Generazione lead nurturing | generateContent |
| 33 | `server/services/advisage-server-service.ts` | Servizio AdVisage | generateContent |
| 34 | `server/whatsapp/message-processor.ts` | Processore messaggi WhatsApp | generateContent |
| 35 | `server/whatsapp/media-handler.ts` | Gestione media WhatsApp | generateContent |
| 36 | `server/whatsapp/agent-consultant-chat-service.ts` | Chat agente-consultant | generateContentStream |
| 37 | `server/ai-service.ts` | Servizio AI principale (chat) | generateContentStream |
| 38 | `server/websocket/video-ai-copilot.ts` | Copilot video AI | generateContent |
| 39 | `server/routes/automated-emails.ts` | Email automatiche | generateContent |
| 40 | `server/routes/followup-api.ts` | API follow-up | generateContent |
| 41 | `server/routes.ts` | Routes principali | generateContent |
| 42 | `server/services/content-autopilot-service.ts` | Autopilot contenuti | generateContent |
| 43 | `server/services/ai-university-generator.ts` | Generatore università AI | generateContent |
| 44 | `server/services/ai-lesson-generator.ts` | Generatore lezioni AI | generateContent |
| 45 | `server/services/ai-exercise-generator.ts` | Generatore esercizi AI | generateContent |
| 46 | `server/services/prospect-simulator/index.ts` | Simulatore prospect | generateContent |
| 47 | `server/services/proactive-lead-welcome-email.ts` | Email benvenuto lead | generateContent |
| 48 | `server/voice/voice-task-supervisor.ts` | Supervisore task vocali | generateContent |
| 49 | `server/voice/voice-booking-supervisor.ts` | Supervisore booking vocale | generateContent |

### 2.2 — Chiamate DIRETTE (`ai.models.generateContent`) che bypassano l'adapter

Questi file creano un'istanza `GoogleGenAI` e chiamano direttamente. **Devono essere intercettati separatamente:**

| # | File | Funzionalità | Note |
|---|------|-------------|------|
| 1 | `server/ai/checkin-personalization-service.ts` | Personalizzazione check-in | Usa `ai.models.generateContent` diretto |
| 2 | `server/ai/consultation-intent-classifier.ts` | Classificazione intent consultazione | Usa `ai.models.generateContent` diretto |
| 3 | `server/ai/ai-task-executor.ts` | Esecuzione task AI | Crea fallback adapter + diretto |
| 4 | `server/ai/autonomous-decision-engine.ts` | Engine decisioni autonome | Usa `ai.models.generateContent` diretto |
| 5 | `server/cron/ai-task-scheduler.ts` | Scheduler task AI (cron) | Crea adapter locale + diretto |
| 6 | `server/objection-detector.ts` | Rilevatore obiezioni | Usa sia Vertex che diretto |
| 7 | `server/routes/whatsapp/public-share-router.ts` | Share pubblica (trascrizione) | `genai.models.generateContent` |
| 8 | `server/routes/voice-router.ts` | Router vocale | `ai.models.generateContent` |
| 9 | `server/routes/consultant-personal-tasks.ts` | Task personali consultant | `genAI.models.generateContent` |
| 10 | `server/routes/ai-autonomy-router.ts` | Autonomia AI (parte) | `genAI.models.generateContent` |
| 11 | `server/routes/client-state.ts` | Stato cliente | `genai.models.generateContent` |
| 12 | `server/services/lead-import-ai-mapper.ts` | Mapper importazione lead | `genAI.models.generateContent` |
| 13 | `server/services/youtube-service.ts` | Servizio YouTube | `ai.models.generateContent` |
| 14 | `server/services/conversation-memory/memory-service.ts` | Memoria conversazioni | `genai.models.generateContent` (doppio) |
| 15 | `server/services/client-data/column-discovery.ts` | Discovery colonne dati | `generateContent` diretto |
| 16 | `server/ai/discovery-rec-generator.ts` | Discovery rec (parte) | `genAI.models.generateContent` (bypass) |

### 2.3 — Live API (WebSocket Streaming)

| # | File | Funzionalità | Note |
|---|------|-------------|------|
| 1 | `server/ai/gemini-live-ws-service.ts` (9981 righe) | Live API vocale real-time | Ha GIÀ tracking `usageMetadata` parziale (righe 6293-6599). Usa modello `gemini-live-2.5-flash-native-audio` o `gemini-2.5-flash-native-audio-preview`. Tracking token audio separato. |

### 2.4 — Chiamate client-side (frontend)

| # | File | Funzionalità | Note |
|---|------|-------------|------|
| 1 | `client/src/pages/content-studio/advisage/services/geminiService.ts` | AdVisage (generazione ads) | Chiama Gemini dal browser — NON tracciabile lato server. Va migrato o aggiunto proxy. |

---

## 3. DATABASE — Schema Tabella `ai_token_usage`

### 3.1 — Layout Tabella

```sql
CREATE TABLE ai_token_usage (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- CHI
  consultant_id VARCHAR NOT NULL REFERENCES users(id),
  client_id     VARCHAR REFERENCES users(id),        -- NULL se azione del consultant stesso
  key_source    TEXT NOT NULL DEFAULT 'unknown',      -- 'superadmin' | 'user' | 'env'
  
  -- COSA
  model         TEXT NOT NULL,                         -- 'gemini-3-flash-preview', 'gemini-2.5-flash', etc.
  feature       TEXT NOT NULL DEFAULT 'unknown',       -- Tag della funzionalità (vedi lista sotto)
  request_type  TEXT NOT NULL DEFAULT 'generate',      -- 'generate' | 'stream' | 'live'
  
  -- QUANTO
  input_tokens       INTEGER NOT NULL DEFAULT 0,
  output_tokens      INTEGER NOT NULL DEFAULT 0,
  cached_tokens      INTEGER NOT NULL DEFAULT 0,       -- Token input cached (costo ridotto 90%)
  total_tokens       INTEGER NOT NULL DEFAULT 0,
  
  -- COSTI (in USD)
  input_cost         NUMERIC(10,6) NOT NULL DEFAULT 0,
  output_cost        NUMERIC(10,6) NOT NULL DEFAULT 0,
  cache_savings      NUMERIC(10,6) NOT NULL DEFAULT 0, -- Quanto si è risparmiato con la cache
  total_cost         NUMERIC(10,6) NOT NULL DEFAULT 0,
  
  -- QUANDO
  created_at    TIMESTAMP DEFAULT NOW() NOT NULL,
  
  -- META
  has_file_search    BOOLEAN DEFAULT false,            -- Se la chiamata ha usato File Search
  has_tools          BOOLEAN DEFAULT false,            -- Se la chiamata ha usato function calling
  error              BOOLEAN DEFAULT false,            -- Se la chiamata è fallita
  duration_ms        INTEGER                           -- Tempo di risposta in ms
);

-- INDICI per query performanti
CREATE INDEX idx_token_usage_consultant    ON ai_token_usage(consultant_id);
CREATE INDEX idx_token_usage_client        ON ai_token_usage(client_id);
CREATE INDEX idx_token_usage_created       ON ai_token_usage(created_at);
CREATE INDEX idx_token_usage_feature       ON ai_token_usage(feature);
CREATE INDEX idx_token_usage_model         ON ai_token_usage(model);
CREATE INDEX idx_token_usage_consultant_dt ON ai_token_usage(consultant_id, created_at);
```

### 3.2 — Feature Tags (etichette funzionalità)

Ogni chiamata viene etichettata con un tag che identifica la funzionalità:

| Tag | Descrizione |
|-----|-------------|
| `chat-assistant` | Chat AI principale (consultant/client) |
| `whatsapp-agent` | Agente WhatsApp (messaggi + media) |
| `instagram-agent` | Elaborazione messaggi Instagram |
| `email-generator` | Generazione template email |
| `email-hub` | AI per email hub |
| `email-automated` | Email automatiche/nurturing |
| `content-studio` | Studio contenuti (post, copy) |
| `content-autopilot` | Autopilot contenuti |
| `advisage` | Generazione ads (AdVisage) |
| `script-builder` | Costruttore script vendita |
| `sales-agent` | Agente vendita (context builder + manager) |
| `sales-reports` | Report vendite AI |
| `training-analyzer` | Analisi training |
| `booking-intent` | Rilevamento intent booking |
| `followup-engine` | Engine follow-up + scheduler |
| `discovery-rec` | Raccomandazioni discovery |
| `step-advancement` | Avanzamento step percorso |
| `onboarding` | Onboarding AI |
| `data-analysis` | Analisi dati (intent + query + explain) |
| `document-processor` | Processore documenti |
| `file-search` | Ricerca nei documenti (RAG) |
| `voice-call` | Chiamate vocali AI |
| `video-copilot` | Copilot video meeting |
| `live-session` | Sessione Live API (real-time audio) |
| `objection-detector` | Rilevatore obiezioni |
| `checkin-personalization` | Personalizzazione check-in |
| `intent-classifier` | Classificatore intent |
| `decision-engine` | Engine decisioni autonome |
| `task-executor` | Esecuzione task AI automatici |
| `university-generator` | Generatore corsi università |
| `memory-service` | Servizio memoria conversazioni |
| `lead-import` | Importazione lead AI |
| `lead-welcome` | Email benvenuto lead |
| `prospect-simulator` | Simulatore prospect |
| `youtube-service` | Servizio YouTube AI |
| `echo` | Echo/riassunti |
| `personal-tasks` | Task personali consultant |
| `public-chat` | Chat AI pubblica |
| `client-state` | Analisi stato cliente |
| `unknown` | Non identificato |

### 3.3 — Tabella aggregata giornaliera (per performance)

```sql
CREATE TABLE ai_token_usage_daily (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consultant_id   VARCHAR NOT NULL REFERENCES users(id),
  client_id       VARCHAR REFERENCES users(id),
  model           TEXT NOT NULL,
  feature         TEXT NOT NULL,
  date            DATE NOT NULL,
  
  -- Aggregati
  request_count     INTEGER NOT NULL DEFAULT 0,
  total_input_tokens   INTEGER NOT NULL DEFAULT 0,
  total_output_tokens  INTEGER NOT NULL DEFAULT 0,
  total_cached_tokens  INTEGER NOT NULL DEFAULT 0,
  total_cost           NUMERIC(10,6) NOT NULL DEFAULT 0,
  avg_duration_ms      INTEGER,
  error_count          INTEGER NOT NULL DEFAULT 0,
  
  UNIQUE(consultant_id, client_id, model, feature, date)
);

CREATE INDEX idx_daily_consultant ON ai_token_usage_daily(consultant_id, date);
CREATE INDEX idx_daily_client     ON ai_token_usage_daily(client_id, date);
```

---

## 4. BACKEND — Architettura Servizio

### 4.1 — `server/ai/token-tracker.ts` (Servizio Centrale)

```
┌──────────────────────────────────────────────────┐
│                 TOKEN TRACKER                      │
│                                                    │
│  ┌─────────────┐   ┌──────────────┐               │
│  │ trackUsage() │   │ calcCost()   │               │
│  │              │   │              │               │
│  │ - consultId  │   │ - model      │               │
│  │ - clientId   │   │ - inputTkn   │               │
│  │ - model      │   │ - outputTkn  │               │
│  │ - feature    │   │ - cachedTkn  │               │
│  │ - usageMeta  │   │              │               │
│  │ - keySource  │   │ Returns USD  │               │
│  └──────┬───────┘   └──────────────┘               │
│         │                                          │
│         ▼                                          │
│  ┌──────────────────┐                              │
│  │ BUFFER (in-memory)│  ← Accumula per 5 secondi   │
│  │ max 50 entries    │    poi flush batch su DB     │
│  └──────┬───────────┘                              │
│         │                                          │
│         ▼                                          │
│  ┌──────────────────┐                              │
│  │ DB: ai_token_usage│  ← INSERT batch             │
│  └──────────────────┘                              │
│                                                    │
│  ┌──────────────────┐                              │
│  │ CRON: aggregateDaily()│ ← Ogni notte 02:00     │
│  │ Compatta in daily     │                         │
│  └──────────────────────┘                          │
└──────────────────────────────────────────────────┘
```

**Caratteristiche chiave:**
- **Buffer in-memory** con flush batch ogni 5 secondi (o 50 entries) → evita sovraccarico DB
- **Calcolo costo asincrono** → non rallenta la risposta al client
- **Fire-and-forget** → se il tracking fallisce, la chiamata AI NON viene bloccata
- **Aggregazione notturna** → comprime i dati dettagliati in `ai_token_usage_daily`

### 4.2 — Listino Prezzi Pre-configurato

```typescript
const PRICING: Record<string, { input: number; output: number; cachedInput: number }> = {
  // Prezzi per 1M token (USD)
  'gemini-3-flash-preview': { 
    input: 0.50,      // $0.50 / 1M input tokens
    output: 3.00,     // $3.00 / 1M output tokens
    cachedInput: 0.05  // $0.05 / 1M cached input tokens (90% sconto)
  },
  'gemini-2.5-flash': { 
    input: 0.30,      // $0.30 / 1M input tokens
    output: 2.50,     // $2.50 / 1M output tokens
    cachedInput: 0.03  // $0.03 / 1M cached input tokens
  },
  'gemini-2.5-flash-native-audio-preview-12-2025': { 
    input: 1.00,      // $1.00 / 1M audio input tokens
    output: 3.00,     // $3.00 / 1M output tokens
    cachedInput: 0.10
  },
  'gemini-live-2.5-flash-native-audio': {
    input: 1.00,
    output: 3.00,
    cachedInput: 0.10
  }
};
```

### 4.3 — Punti di Intercezione

**A) GeminiClientAdapter (provider-factory.ts) — Copertura ~70%**

```
PRIMA:
  request → adapter.generateContent() → Gemini API → response → return
  
DOPO:
  request → adapter.generateContent() → Gemini API → response 
    → tokenTracker.track(usageMetadata, context) ← AGGIUNTO (async, fire-and-forget)
    → return response (invariata)
```

**B) Chiamate dirette (16 file) — Copertura ~25%**

Per le chiamate che bypassano l'adapter, creo una funzione wrapper:

```typescript
// Helper per wrappare chiamate dirette
async function trackedGenerateContent(
  ai: GoogleGenAI,
  params: GenerateContentParams,
  context: { consultantId: string; clientId?: string; feature: string; keySource?: string }
): Promise<GenerateContentResult> {
  const start = Date.now();
  const result = await ai.models.generateContent(params);
  tokenTracker.track({ ...context, result, durationMs: Date.now() - start });
  return result;
}
```

**C) Live API (gemini-live-ws-service.ts) — Copertura ~5%**

Il file ha già un tracking parziale di `usageMetadata`. Aggiungo il salvataggio su DB nel punto dove logga i token (riga ~6293).

### 4.4 — API Endpoints

```
GET /api/ai-usage/summary
  ?period=today|week|month|custom
  &from=2026-02-01
  &to=2026-02-17
  
  Ritorna: { totalTokens, totalCost, requestCount, avgCostPerRequest, 
             topFeatures[], costByModel[], dailyTrend[] }

GET /api/ai-usage/by-client
  ?period=month
  
  Ritorna: [ { clientId, clientName, totalTokens, totalCost, requestCount, 
               topFeature, lastUsed } ]

GET /api/ai-usage/by-feature  
  ?period=month
  
  Ritorna: [ { feature, totalTokens, totalCost, requestCount, 
               percentOfTotal, avgTokensPerRequest } ]

GET /api/ai-usage/timeline
  ?period=month
  &granularity=day|hour
  
  Ritorna: [ { date, totalTokens, totalCost, requestCount } ]

GET /api/admin/ai-usage/all-consultants
  ?period=month
  
  Ritorna: [ { consultantId, consultantName, totalTokens, totalCost, 
               clientCount, topFeature, keySource } ]

GET /api/admin/ai-usage/platform-summary
  ?period=month
  
  Ritorna: { totalPlatformCost, totalTokens, consultantCount, 
             costByKeySource: { superadmin, user, env }, topConsumers[] }
```

---

## 5. FRONTEND — Design & Layout

### 5.1 — Pagina Consultant: "AI Usage & Costs"

**URL:** `/consultant/ai-usage`  
**Accesso:** Ruolo `consultant`

```
┌─────────────────────────────────────────────────────────────┐
│  ← Indietro    AI Usage & Costs        📊 Periodo: [Mese ▼]│
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────────┐ │
│  │ 💰 Costo │  │ 📊 Token │  │ 📨 Richieste│ │ 💡 Media  │ │
│  │  $12.45  │  │ 2.4M     │  │    847     │  │ $0.015/req│ │
│  │  +15% ↑  │  │  +8% ↑   │  │   -3% ↓   │  │           │ │
│  └──────────┘  └──────────┘  └──────────┘  └────────────┘ │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │           📈 Trend Giornaliero Costi                │   │
│  │  $2 ─ ╭─╮                                          │   │
│  │       │  ╰─╮    ╭──╮                               │   │
│  │  $1 ─ │    ╰──╮│   ╰─╮  ╭─╮                       │   │
│  │       │       ╰╯     ╰──╯  ╰──                     │   │
│  │  $0 ─ ┼───┼───┼───┼───┼───┼───┼                    │   │
│  │      Lun Mar Mer Gio Ven Sab Dom                    │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌──────────── Tab: [Clienti] [Funzionalità] [Dettaglio]  │
│  │                                                         │
│  │  👤 Per Cliente                                         │
│  │  ┌────────────────────────────────────────────────┐    │
│  │  │ Cliente        │ Token   │ Costo  │ Richieste │    │
│  │  ├────────────────┼─────────┼────────┼───────────┤    │
│  │  │ Mario Rossi    │ 580K    │ $3.20  │ 234       │    │
│  │  │ Anna Bianchi   │ 420K    │ $2.15  │ 178       │    │
│  │  │ Luca Verdi     │ 310K    │ $1.80  │ 145       │    │
│  │  │ ...            │         │        │           │    │
│  │  └────────────────────────────────────────────────┘    │
│  │                                                         │
│  │  ⚙️ Per Funzionalità                                   │
│  │  ┌────────────────────────────────────────────────┐    │
│  │  │ Funzionalità    │ Token  │ Costo │ % Totale  │    │
│  │  ├─────────────────┼────────┼───────┼───────────┤    │
│  │  │ WhatsApp Agent  │ 800K   │ $4.50 │ ███░ 36%  │    │
│  │  │ Chat Assistant  │ 520K   │ $2.80 │ ██░░ 22%  │    │
│  │  │ Email Generator │ 380K   │ $1.95 │ █░░░ 16%  │    │
│  │  │ Follow-up       │ 290K   │ $1.40 │ █░░░ 11%  │    │
│  │  │ Altro           │ 410K   │ $1.80 │ █░░░ 15%  │    │
│  │  └────────────────────────────────────────────────┘    │
│  └─────────────────────────────────────────────────────────┘
└─────────────────────────────────────────────────────────────┘
```

**Componenti UI utilizzati:**
- `Card` con stats numeriche (già presenti nel design system)
- `Tabs` per switch vista clienti/funzionalità/dettaglio
- `Table` per le tabelle dati
- `recharts` (già installato) per i grafici trend
- Badge con percentuale variazione vs periodo precedente
- `Progress` bar per percentuale per funzionalità
- `Select` per il filtro periodo (Oggi, Settimana, Mese, Custom)

**Stile:** Coerente con le pagine esistenti (`consultant-dashboard.tsx`, `consultant-file-search-analytics.tsx`)
- Header sticky con breadcrumb + titolo
- Sfondo `bg-gradient-to-br from-gray-50 via-white to-gray-100 dark:from-gray-900 dark:via-gray-800 dark:to-black`
- Card con ombra leggera, bordi arrotondati
- Supporto dark mode completo

### 5.2 — Sezione Admin: "Platform AI Costs"

**URL:** `/admin/ai-usage`  
**Accesso:** Ruolo `super_admin`

```
┌─────────────────────────────────────────────────────────────┐
│  ← Dashboard    Platform AI Costs      📊 Periodo: [Mese ▼]│
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────────┐ │
│  │ 💰 Totale│  │ 👥 Consul│  │ 🔑 SuperAd│  │ 🔑 Proprie│ │
│  │  $89.50  │  │   12     │  │  $72.30   │  │  $17.20   │ │
│  │  piattaf.│  │ attivi   │  │  chiavi SA│  │  chiavi own│ │
│  └──────────┘  └──────────┘  └──────────┘  └────────────┘ │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │           📈 Costo Piattaforma per Giorno            │   │
│  │  (grafico a barre con stacking per key_source)       │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Consultant       │ Clienti │ Token  │ Costo │ Chiavi│  │
│  ├───────────────────┼─────────┼────────┼───────┼──────┤   │
│  │ Marco Consultant  │ 15      │ 1.2M   │ $32   │ SA   │   │
│  │ Sara Consultant   │ 8       │ 800K   │ $18   │ SA   │   │
│  │ Paolo Consultant  │ 12      │ 650K   │ $15   │ Own  │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  🔥 Top Funzionalità Piattaforma                    │   │
│  │  (donut chart con breakdown per feature)              │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

**Informazione chiave per l'admin:**
- Quanto costa la piattaforma in totale
- Quanto delle chiavi SuperAdmin vengono usate vs chiavi proprie dei consultant
- Chi consuma di più
- Quali funzionalità guidano i costi

---

## 6. FLUSSO DATI COMPLETO

```
┌──────────────┐     ┌───────────────────┐     ┌─────────────┐
│ File qualsiasi│────▶│ GeminiClientAdapter│────▶│ Gemini API  │
│ (40+ files)  │     │ (provider-factory) │     │             │
└──────────────┘     └────────┬──────────┘     └──────┬──────┘
                              │                        │
                              │   ┌────────────────────┘
                              │   │ response + usageMetadata
                              │   ▼
                    ┌─────────────────────┐
                    │   TOKEN TRACKER     │
                    │                     │
                    │ 1. Estrae usageMeta │
                    │ 2. Calcola costo    │
                    │ 3. Buffering        │
                    │ 4. Flush batch DB   │
                    └────────┬────────────┘
                             │
                             ▼
                    ┌─────────────────────┐
                    │  ai_token_usage     │──── CRON notturno ────▶ ai_token_usage_daily
                    │  (dettaglio)        │
                    └────────┬────────────┘
                             │
                    ┌────────┴────────────┐
                    │                     │
                    ▼                     ▼
          ┌──────────────┐      ┌──────────────┐
          │ API Consultant│      │ API Admin    │
          │ /ai-usage/*  │      │ /admin/ai-*  │
          └──────┬───────┘      └──────┬───────┘
                 │                      │
                 ▼                      ▼
          ┌──────────────┐      ┌──────────────┐
          │ Dashboard    │      │ Admin Panel  │
          │ Consultant   │      │ Platform     │
          └──────────────┘      └──────────────┘
```

---

## 7. AUTO-REVIEW: 10 DOMANDE CRITICHE E SOLUZIONI

### D1: "Il buffer in-memory perde dati se il server crasha?"
**Rischio:** Sì, le entries nel buffer non ancora flushed vengono perse.  
**Soluzione:** Accettabile. Si tratta di max 5 secondi di dati (50 entries). Il tracking è "best-effort" — la priorità è non impattare le performance. Aggiungo un `process.on('SIGTERM')` per flush finale prima dello shutdown.

### D2: "Con 60+ file che chiamano Gemini, il tracker non diventa un bottleneck?"
**Rischio:** Se ogni chiamata fa una INSERT sincrona, sì.  
**Soluzione:** Il buffer + batch INSERT è la risposta. 50 insert diventano 1 sola query SQL. Il `trackUsage()` è fire-and-forget (non awaited) quindi non aggiunge latenza alle chiamate AI.

### D3: "La tabella `ai_token_usage` crescerà tantissimo. Performance?"
**Rischio:** Con 800+ chiamate AI al giorno, in un anno sono ~300K righe.  
**Soluzione implementata:**  
1. Tabella aggregata `ai_token_usage_daily` per le query dashboard (molto più veloce)
2. Indici specifici per le query più frequenti
3. CRON opzionale per eliminare dettagli oltre 90 giorni (mantenendo solo i daily)

### D4: "Come gestisco le chiamate dove non ho il consultantId?"
**Rischio:** Alcune chiamate (cron, system-level) non hanno un consultant associato.  
**Soluzione:** Uso `consultant_id = 'system'` per le chiamate di sistema. Nella dashboard admin, queste vengono raggruppate sotto "Sistema / Cron Jobs".

### D5: "Il file `geminiService.ts` nel frontend chiama Gemini direttamente dal browser. Come lo tracko?"
**Rischio:** Quella chiamata bypassa completamente il server, non posso intercettarla.  
**Soluzione:** Per ora, creo un proxy endpoint server-side (`/api/advisage/generate`) e il frontend chiama quello. Oppure accetto che sia non tracciata e la documento. Valuto con il proprietario.

### D6: "Se il consultant usa le proprie API key, i costi li paga lui. Ha senso tracciarli?"
**Risposta:** Assolutamente sì. Anche se paga direttamente Google, il consultant vuole sapere QUANTO sta pagando e per CHI. Anzi, è il use-case principale: "Il cliente Mario mi costa €2.30/mese in AI". Il campo `key_source` distingue chi paga.

### D7: "Il calcolo del costo è accurato? E se Google cambia i prezzi?"
**Rischio:** I prezzi hardcoded diventano obsoleti.  
**Soluzione:** I prezzi sono in un dizionario configurabile (`PRICING`). Se cambiano, basta aggiornare un oggetto. Aggiungo anche un campo `pricing_version` nella tabella per poter ricalcolare retroattivamente se necessario. Tuttavia per semplicità v1, il dizionario è sufficiente.

### D8: "Come distinguo i token di File Search dai token normali in `usageMetadata`?"
**Risposta:** Gemini NON distingue — `promptTokenCount` include tutto (prompt + chunk dei documenti trovati). Questo è corretto per il calcolo del costo. Quello che possiamo fare è etichettare la chiamata con `has_file_search = true` guardando se il parametro `tools` contiene `google_search_retrieval` o simile. Così la dashboard può filtrare.

### D9: "La Live API ha un tracking diverso. Come lo normalizzo?"
**Rischio:** La Live API ha token audio separati e una sessione lunga (non singole chiamate).  
**Soluzione:** Per la Live API, tracko a fine sessione con il totale accumulato. Il campo `request_type = 'live'` distingue queste entries. I costi audio usano il listino audio ($1.00/1M input). Il file ha già il codice per accumulare token (riga 1740-1748), devo solo aggiungere il salvataggio su DB.

### D10: "Servono le viste in tempo reale o bastano i dati aggregati?"
**Risposta:** Per v1, i dati aggregati con refresh periodico bastano. La dashboard fa una query SQL ogni volta che l'utente la apre o cambia filtro. Non serve WebSocket o polling real-time. Se in futuro serve un counter live (tipo "token usati ADESSO"), posso aggiungere un EventEmitter che il frontend ascolta via SSE.

---

## 8. PIANO DI IMPLEMENTAZIONE (Ordine)

| Step | Cosa | File | Rischio |
|------|------|------|---------|
| 1 | Schema DB + migrazione | `shared/schema.ts`, SQL migration | Basso |
| 2 | Token Tracker service | `server/ai/token-tracker.ts` (nuovo) | Basso |
| 3 | Integrare in GeminiClientAdapter | `server/ai/provider-factory.ts` | Medio — punto critico |
| 4 | Integrare nelle 16 chiamate dirette | 16 file server | Basso — wrapper function |
| 5 | Integrare nella Live API | `server/ai/gemini-live-ws-service.ts` | Basso — tracking già presente |
| 6 | API endpoints | `server/routes/ai-usage-router.ts` (nuovo) | Basso |
| 7 | Dashboard consultant | `client/src/pages/consultant-ai-usage.tsx` (nuovo) | Basso |
| 8 | Dashboard admin | `client/src/pages/admin-ai-usage.tsx` (nuovo) | Basso |
| 9 | Sidebar links + routing | `client/src/components/sidebar.tsx`, routes | Basso |
| 10 | CRON aggregazione giornaliera | `server/cron/` | Basso |

---

## 9. STIMA IMPATTO PERFORMANCE

| Aspetto | Impatto |
|---------|---------|
| Latenza per chiamata AI | **+0ms** (fire-and-forget, async) |
| Memoria server | **+~200KB** per il buffer (50 entries × ~4KB) |
| Carico DB | **+1 INSERT ogni 5 sec** (batch) = ~17K insert/giorno |
| Spazio DB | **~5MB/mese** per tabella dettaglio, ~100KB/mese per daily |

---

## 10. METRICHE DI SUCCESSO

- [ ] 100% delle chiamate `generateContent` via adapter vengono tracciate
- [ ] 100% delle chiamate dirette identificate vengono tracciate  
- [ ] Dashboard consultant mostra dati corretti per periodo
- [ ] Admin vede costi aggregati per consultant
- [ ] Il costo calcolato è ±5% rispetto alla fattura Google
- [ ] Zero impatto sulle performance percepite dall'utente
- [ ] Il sistema non blocca MAI una chiamata AI anche se il tracking fallisce
