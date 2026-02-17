# RDP — AI Token Usage Tracking & Cost Analytics

**Versione:** 2.0  
**Data:** 17 Febbraio 2026  
**Stato:** Piano di Implementazione  
**Aggiornamento v2:** Aggiunta migrazione modelli a Gemini 3, consolidamento chiamate in provider-factory, struttura client/consultant-client

---

## 1. OBIETTIVO

Implementare un sistema completo di tracking dei token AI che:
- Registri **ogni chiamata** a Gemini (generateContent, generateContentStream, Live API)
- Calcoli automaticamente i **costi** basandosi sul modello utilizzato
- Permetta ai **consultant** di vedere quanto spende ogni **client** E ogni **consultant-client** (vedi sezione 1.1)
- Permetta all'**admin** di vedere quanto spende ogni consultant
- Identifichi le **funzionalità** che consumano più token per ottimizzare
- **Migrare tutti i modelli** da Gemini 2.x a Gemini 3 Flash Preview (dove possibile)
- **Consolidare le chiamate dirette** dentro `provider-factory.ts` per semplificare il tracking

---

## 1.1 — STRUTTURA UTENTI E GERARCHIA COSTI

### Chi sono i "clienti" di un consultant?

Nel database, la tabella `users` ha:
- `role`: `"consultant"` | `"client"` | `"super_admin"`
- `consultantId`: Punta al consultant "padre"

**Tre scenari di fatturazione AI:**

```
SCENARIO A: Consultant → Client (classico)
┌──────────────────┐         ┌──────────────────┐
│ Marco (consultant)│────────▶│ Mario (client)   │
│ consultantId: null│         │ consultantId: marco│
│ role: consultant  │         │ role: client      │
└──────────────────┘         └──────────────────┘
  Il client Mario usa l'AI → il costo è attribuito a Marco, suddiviso per Mario.

SCENARIO B: Consultant → Consultant-Client
┌──────────────────┐         ┌──────────────────┐
│ Marco (consultant)│────────▶│ Sara (consultant) │
│ consultantId: null│         │ consultantId: marco│
│ role: consultant  │         │ role: consultant  │
└──────────────────┘         └──────────────────┘
  Sara è un consultant ma è anche "cliente" di Marco.
  Quando Sara usa l'AI come assistita di Marco → costo a Marco.
  Quando Sara usa l'AI per i SUOI clienti → costo a Sara.

SCENARIO C: Consultant agisce per sé stesso
┌──────────────────┐
│ Marco (consultant)│
│ usa AI per scrivere│
│ email, analisi...  │
└──────────────────┘
  consultant_id = marco, client_id = NULL → costo a Marco, nessun client associato.
```

### Come lo gestiamo nel tracking

```
ai_token_usage:
  consultant_id  →  SEMPRE il consultant che "paga" (proprietario delle API key)
  client_id      →  L'utente per cui si lavora (può essere client O consultant-client)
  client_role    →  'client' | 'consultant' | NULL  ← NUOVO CAMPO per distinguere
```

**Regola di attribuzione:**
1. Se la chiamata ha un `clientId` → prendo il `consultantId` del client come "pagante"
2. Se non c'è `clientId` → il consultant stesso sta usando l'AI
3. Se un consultant è anche client di un altro consultant → dipende dal CONTESTO della chiamata

### Dashboard: come mostrare i "clienti"

Nella dashboard del consultant, la tab "Per Cliente" mostrerà:

| Cliente | Ruolo | Token | Costo |
|---------|-------|-------|-------|
| Mario Rossi | Client | 580K | $3.20 |
| Sara Bianchi | Consultant | 420K | $2.15 |
| *Tu stesso* | — | 310K | $1.80 |

Il consultant vede TUTTI gli utenti che generano costi sotto la sua gestione, inclusi:
- I suoi client normali
- I consultant che lo hanno come "padre"
- Le proprie azioni dirette (senza client)

---

## 2. MIGRAZIONE MODELLI: Da Gemini 2.x a Gemini 3

### 2.1 — Situazione Attuale dei Modelli

Ho trovato **5 modelli diversi** usati nel codebase:

| Modello | File che lo usano | Uso |
|---------|-------------------|-----|
| `gemini-2.5-flash` | ~15 file + provider-factory default | Modello principale per tutto |
| `gemini-2.5-flash-lite` | ~12 file | Task leggeri: intent routing, booking, classificazione |
| `gemini-2.5-pro` | 2 file (training-analyzer) | Analisi complessa training |
| `gemini-2.0-flash-lite` | 3 file (public-agent, ai-service) | Legacy, ultra-leggero |
| `gemini-2.5-flash-preview-05-20` | 1 file (discovery-rec) | Versione specifica preview |
| `gemini-2.5-flash-tts` | 1 file (tts-service) | Text-to-Speech |
| `gemini-2.5-pro-tts` | 1 file (whatsapp TTS) | Text-to-Speech alta qualità |
| `gemini-live-2.5-flash-native-audio` | 1 file (live-ws) | Live API audio real-time |
| `gemini-2.5-flash-native-audio-preview` | 1 file (live-ws) | Live API audio fallback |

### 2.2 — Piano di Migrazione

**MIGRABILI a Gemini 3 Flash Preview:**

| Vecchio Modello | Nuovo Modello | Thinking Level | File da Modificare |
|-----------------|---------------|----------------|-------------------|
| `gemini-2.5-flash` | `gemini-3-flash-preview` | — (default) | provider-factory.ts + 15 file |
| `gemini-2.5-flash-lite` | `gemini-3-flash-preview` | `minimal` | 12 file |
| `gemini-2.5-pro` | `gemini-3-flash-preview` | `high` | 2 file (training-analyzer) |
| `gemini-2.0-flash-lite` | `gemini-3-flash-preview` | `minimal` | 3 file |
| `gemini-2.5-flash-preview-05-20` | `gemini-3-flash-preview` | — | 1 file (discovery-rec) |

**NON MIGRABILI (modelli specializzati senza equivalente Gemini 3):**

| Modello | Motivo | Azione |
|---------|--------|--------|
| `gemini-2.5-flash-tts` | Non esiste Gemini 3 TTS | Resta su 2.5, tracking comunque |
| `gemini-2.5-pro-tts` | Non esiste Gemini 3 TTS | Resta su 2.5, tracking comunque |
| `gemini-live-2.5-flash-native-audio` | Non esiste Gemini 3 Live API | Resta su 2.5, tracking comunque |
| `gemini-2.5-flash-native-audio-preview` | Non esiste Gemini 3 Live API | Resta su 2.5, tracking comunque |

### 2.3 — Come Cambia provider-factory.ts

```typescript
// PRIMA (v1)
export const GEMINI_3_MODEL = "gemini-3-flash-preview";
export const GEMINI_LEGACY_MODEL = "gemini-2.5-flash";

export function getModelForProvider(providerType): string {
  if (providerType === 'studio' || providerType === 'google') return GEMINI_3_MODEL;
  return GEMINI_LEGACY_MODEL; // ← Vertex AI usa il vecchio
}

// DOPO (v2) — Tutto su Gemini 3
export const GEMINI_MODEL = "gemini-3-flash-preview";
export const GEMINI_TTS_MODEL = "gemini-2.5-flash-tts";
export const GEMINI_LIVE_MODEL = "gemini-live-2.5-flash-native-audio";

export function getModelForProvider(providerType): string {
  return GEMINI_MODEL; // ← Sempre Gemini 3, indipendentemente dal provider
}
```

### 2.4 — Mappa Completa dei File da Aggiornare per Migrazione Modelli

**File con `gemini-2.5-flash` hardcoded (→ gemini-3-flash-preview):**

| # | File | Riga | Vecchio | Azione |
|---|------|------|---------|--------|
| 1 | `server/ai/provider-factory.ts` | 28,41,53,82,188,628 | `GEMINI_LEGACY_MODEL` / `gemini-2.5-flash` | Cambiare costante + default |
| 2 | `server/ai/human-like-decision-engine.ts` | 595 | `gemini-2.5-flash` | Rimuovere, usare modello da adapter |
| 3 | `server/ai/followup-decision-engine.ts` | 606 | `gemini-2.5-flash` | Rimuovere, usare modello da adapter |
| 4 | `server/ai/email-template-generator.ts` | 524 | `gemini-2.5-flash` | Cambiare a `gemini-3-flash-preview` |
| 5 | `server/routes/email-hub-router.ts` | 1946,2431,2476,2504,2534 | `gemini-2.5-flash` | Cambiare a `gemini-3-flash-preview` |
| 6 | `server/routes/client-data-router.ts` | 2116,2176 | `gemini-2.5-flash` | Cambiare a `gemini-3-flash-preview` |
| 7 | `server/routes/sales-reports.ts` | 222 | `gemini-2.5-flash` | Cambiare a `gemini-3-flash-preview` |
| 8 | `server/ai/gemini-live-ws-service.ts` | 6579 | `gemini-2.5-flash` | Cambiare a `gemini-3-flash-preview` (solo nel campo modelName per tracking, NON nel Live API model) |
| 9 | `server/routes/onboarding.ts` | 627,697,1185 | `gemini-2.5-flash` su Vertex | Cambiare a `gemini-3-flash-preview` |

**File con `gemini-2.5-flash-lite` hardcoded (→ gemini-3-flash-preview + thinking: minimal):**

| # | File | Riga | Azione |
|---|------|------|--------|
| 1 | `server/ai/sales-manager-agent.ts` | 800 | Cambiare MODEL + aggiungere thinking minimal |
| 2 | `server/ai/step-advancement-agent.ts` | 146 | Cambiare MODEL + aggiungere thinking minimal |
| 3 | `server/ai/data-analysis/intent-router.ts` | 29 | Cambiare INTENT_ROUTER_MODEL |
| 4 | `server/ai/data-analysis/query-planner.ts` | 2465 | Cambiare modello inline |
| 5 | `server/ai/consultation-intent-classifier.ts` | 163,181 | Cambiare modello |
| 6 | `server/booking/booking-service.ts` | 776 | Cambiare modello |
| 7 | `server/voice/voice-task-supervisor.ts` | 99 | Cambiare MODEL |
| 8 | `server/voice/voice-booking-supervisor.ts` | 82 | Cambiare MODEL |
| 9 | `server/services/document-processor.ts` | 848 | Cambiare modello Vertex |
| 10 | `server/whatsapp/media-handler.ts` | 318 | Cambiare modello Vertex |

**File con `gemini-2.0-flash-lite` (→ gemini-3-flash-preview + thinking: minimal):**

| # | File | Riga | Azione |
|---|------|------|--------|
| 1 | `server/routes/whatsapp/public-share-router.ts` | 2537 | Cambiare modello |
| 2 | `server/routes/public-agent-router.ts` | 1336,1569 | Cambiare modello |
| 3 | `server/ai-service.ts` | 3037,4197 | Cambiare modello |

**File con `gemini-2.5-pro` (→ gemini-3-flash-preview + thinking: high):**

| # | File | Riga | Azione |
|---|------|------|--------|
| 1 | `server/ai/gemini-training-analyzer.ts` | 276,538 | Cambiare a gemini-3-flash-preview con thinking high |

---

## 3. CONSOLIDAMENTO CHIAMATE IN PROVIDER-FACTORY

### 3.1 — Obiettivo

Portare le **16 chiamate dirette** (`ai.models.generateContent`) dentro `provider-factory.ts` così:
1. Tutte le chiamate passano per un unico punto → tracking automatico al 100%
2. Il modello è configurato centralmente → facile cambiare in futuro
3. Le API key sono gestite dalla factory → niente più `new GoogleGenAI()` sparsi

### 3.2 — Nuova Funzione da Aggiungere a provider-factory.ts

```typescript
export async function quickGenerate(params: {
  consultantId: string;
  clientId?: string;
  feature: string;
  model?: string;
  contents: Array<{ role: string; parts: Array<{ text: string }> }>;
  systemInstruction?: string;
  generationConfig?: any;
  thinkingLevel?: 'minimal' | 'low' | 'medium' | 'high';
}): Promise<{ text: string; usageMetadata?: any }> {
  const provider = await getAIProvider(params.consultantId, params.consultantId);
  const model = params.model || GEMINI_MODEL;
  
  const result = await provider.client.generateContent({
    model,
    contents: params.contents,
    generationConfig: {
      ...params.generationConfig,
      ...(params.thinkingLevel && { 
        thinkingConfig: { thinkingLevel: params.thinkingLevel } 
      }),
    },
    ...(params.systemInstruction && {
      systemInstruction: { role: 'user', parts: [{ text: params.systemInstruction }] }
    }),
  });
  
  provider.cleanup?.();
  return { text: response.text(), usageMetadata: response.usageMetadata };
}
```

### 3.3 — Mappa Consolidamento: File da Migrare al Provider-Factory

**Priorità ALTA — File semplici (1 chiamata, pattern chiaro):**

| # | File | Chiamata Attuale | Migrazione |
|---|------|------------------|------------|
| 1 | `server/ai/checkin-personalization-service.ts` | `ai.models.generateContent()` con key da `getGeminiApiKeyForClassifier()` | → `quickGenerate({ feature: 'checkin-personalization' })` |
| 2 | `server/ai/consultation-intent-classifier.ts` | `ai.models.generateContent()` con key da `getGeminiApiKeyForClassifier()` | → `quickGenerate({ feature: 'intent-classifier', thinkingLevel: 'minimal' })` |
| 3 | `server/routes/consultant-personal-tasks.ts` | `genAI.models.generateContent()` con env key | → `quickGenerate({ feature: 'personal-tasks' })` |
| 4 | `server/routes/client-state.ts` | `genai.models.generateContent()` con env key | → `quickGenerate({ feature: 'client-state' })` |
| 5 | `server/services/lead-import-ai-mapper.ts` | `genAI.models.generateContent()` con env key | → `quickGenerate({ feature: 'lead-import' })` |
| 6 | `server/services/youtube-service.ts` | `ai.models.generateContent()` con key da `getGeminiApiKeyForClassifier()` | → `quickGenerate({ feature: 'youtube-service' })` |
| 7 | `server/objection-detector.ts` | `ai.models.generateContent()` con fallback Vertex → Studio | → `quickGenerate({ feature: 'objection-detector' })` |
| 8 | `server/routes/voice-router.ts` | `ai.models.generateContent()` | → `quickGenerate({ feature: 'voice-call' })` |

**Priorità MEDIA — File con logica speciale (adapter locale, fallback):**

| # | File | Complessità | Migrazione |
|---|------|-------------|------------|
| 9 | `server/ai/autonomous-decision-engine.ts` | Crea GoogleGenAI locale | → `getAIProvider()` + adapter standard |
| 10 | `server/routes/ai-autonomy-router.ts` | Usa `getGeminiApiKeyForClassifier` + crea GoogleGenAI | → `quickGenerate({ feature: 'decision-engine' })` |
| 11 | `server/ai/discovery-rec-generator.ts` | Ha sia adapter che diretto, modello vecchio | → Consolidare entrambi su adapter |
| 12 | `server/services/conversation-memory/memory-service.ts` | 2 chiamate dirette, crea GoogleGenAI | → `quickGenerate({ feature: 'memory-service' })` ×2 |

**Priorità BASSA — File complessi (logica specifica, difficile da astrarre):**

| # | File | Complessità | Decisione |
|---|------|-------------|-----------|
| 13 | `server/ai/ai-task-executor.ts` | Crea adapter locale come fallback, logica complessa | Wrapper `trackedGenerateContent()` — troppo rischioso consolidare |
| 14 | `server/cron/ai-task-scheduler.ts` | Crea adapter locale, cron context | Wrapper `trackedGenerateContent()` |
| 15 | `server/routes/whatsapp/public-share-router.ts` | Trascrizione audio, contesto specifico | Wrapper `trackedGenerateContent()` |
| 16 | `server/services/client-data/column-discovery.ts` | Discovery colonne, context isolato | Wrapper `trackedGenerateContent()` |

### 3.4 — Impatto del Consolidamento

```
PRIMA del consolidamento:
  ┌─────────────┐      ┌──────────────┐
  │ 49 file     │─────▶│ Adapter      │──▶ Gemini API  (tracking qui)
  │ via adapter │      │ (prov-factory)│
  └─────────────┘      └──────────────┘
  
  ┌─────────────┐
  │ 16 file     │──────────────────────▶ Gemini API  (NESSUN tracking!)
  │ diretti     │
  └─────────────┘

DOPO il consolidamento:
  ┌─────────────┐      ┌──────────────┐
  │ 57 file     │─────▶│ Adapter      │──▶ Gemini API  (tracking qui)
  │ via adapter │      │ (prov-factory)│
  │ (+quickGen) │      └──────────────┘
  └─────────────┘      
  
  ┌─────────────┐      ┌──────────────┐
  │ 4 file      │─────▶│ trackedGen() │──▶ Gemini API  (tracking wrapper)
  │ complessi   │      │ (wrapper)    │
  └─────────────┘      └──────────────┘

  ┌─────────────┐
  │ 4 file TTS/ │──────────────────────▶ Gemini API  (tracking separato)
  │ Live API    │
  └─────────────┘

RISULTATO: Da 16 file non tracciati → solo 4 con wrapper + 4 specializzati = 100% copertura
```

---

## 4. MAPPATURA COMPLETA DELLE CHIAMATE AI (Aggiornata)

### 4.1 — Chiamate via GeminiClientAdapter (provider-factory.ts)

Queste passano tutte attraverso `GeminiClientAdapter.generateContent()` o `GeminiClientAdapter.generateContentStream()`.
L'adapter è il **punto di intercezione principale** — modificando solo qui, copriamo ~70% delle chiamate (e ~88% dopo consolidamento).

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

### 4.2 — Chiamate da CONSOLIDARE in provider-factory (attualmente dirette)

Questi 12 file verranno migrati a usare `quickGenerate()` o `getAIProvider()`:

| # | File | Funzionalità | Migrazione a |
|---|------|-------------|-------------|
| 1 | `server/ai/checkin-personalization-service.ts` | Personalizzazione check-in | `quickGenerate()` |
| 2 | `server/ai/consultation-intent-classifier.ts` | Classificazione intent | `quickGenerate()` con thinking: minimal |
| 3 | `server/ai/autonomous-decision-engine.ts` | Engine decisioni autonome | `getAIProvider()` |
| 4 | `server/ai/discovery-rec-generator.ts` (parte diretta) | Discovery rec | Consolidare su adapter esistente |
| 5 | `server/objection-detector.ts` | Rilevatore obiezioni | `quickGenerate()` |
| 6 | `server/routes/consultant-personal-tasks.ts` | Task personali | `quickGenerate()` |
| 7 | `server/routes/client-state.ts` | Stato cliente | `quickGenerate()` |
| 8 | `server/routes/voice-router.ts` | Router vocale | `quickGenerate()` |
| 9 | `server/routes/ai-autonomy-router.ts` (parte diretta) | Autonomia AI | `quickGenerate()` |
| 10 | `server/services/lead-import-ai-mapper.ts` | Mapper importazione lead | `quickGenerate()` |
| 11 | `server/services/youtube-service.ts` | Servizio YouTube | `quickGenerate()` |
| 12 | `server/services/conversation-memory/memory-service.ts` | Memoria conversazioni | `quickGenerate()` ×2 |

### 4.3 — Chiamate che restano con WRAPPER (troppo complesse per consolidare)

| # | File | Funzionalità | Soluzione |
|---|------|-------------|-----------|
| 1 | `server/ai/ai-task-executor.ts` | Esecuzione task AI | `trackedGenerateContent()` wrapper |
| 2 | `server/cron/ai-task-scheduler.ts` | Scheduler task AI (cron) | `trackedGenerateContent()` wrapper |
| 3 | `server/routes/whatsapp/public-share-router.ts` | Trascrizione audio | `trackedGenerateContent()` wrapper |
| 4 | `server/services/client-data/column-discovery.ts` | Discovery colonne | `trackedGenerateContent()` wrapper |

### 4.4 — Modelli SPECIALIZZATI (non migrabili, tracking separato)

| # | File | Modello | Tipo |
|---|------|---------|------|
| 1 | `server/ai/tts-service.ts` | `gemini-2.5-flash-tts` | TTS |
| 2 | `server/whatsapp/message-processor.ts` | `gemini-2.5-pro-tts` | TTS |
| 3 | `server/ai/gemini-live-ws-service.ts` | `gemini-live-2.5-flash-native-audio` | Live API |
| 4 | `server/ai/gemini-live-ws-service.ts` | `gemini-2.5-flash-native-audio-preview` | Live API |

### 4.5 — Chiamata client-side (frontend)

| # | File | Funzionalità | Note |
|---|------|-------------|------|
| 1 | `client/src/pages/content-studio/advisage/services/geminiService.ts` | AdVisage (generazione ads) | Chiama Gemini dal browser — da migrare a endpoint server-side `/api/advisage/generate` |

---

## 5. DATABASE — Schema Tabella `ai_token_usage`

### 5.1 — Layout Tabella

```sql
CREATE TABLE ai_token_usage (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- CHI
  consultant_id VARCHAR NOT NULL REFERENCES users(id),
  client_id     VARCHAR REFERENCES users(id),        -- NULL se azione del consultant stesso
  client_role   TEXT,                                  -- 'client' | 'consultant' | NULL
  key_source    TEXT NOT NULL DEFAULT 'unknown',      -- 'superadmin' | 'user' | 'env'
  
  -- COSA
  model         TEXT NOT NULL,                         -- 'gemini-3-flash-preview', etc.
  feature       TEXT NOT NULL DEFAULT 'unknown',       -- Tag della funzionalità (vedi lista sotto)
  request_type  TEXT NOT NULL DEFAULT 'generate',      -- 'generate' | 'stream' | 'live'
  thinking_level TEXT,                                 -- 'minimal' | 'low' | 'medium' | 'high' | NULL
  
  -- QUANTO
  input_tokens       INTEGER NOT NULL DEFAULT 0,
  output_tokens      INTEGER NOT NULL DEFAULT 0,
  cached_tokens      INTEGER NOT NULL DEFAULT 0,       -- Token input cached (costo ridotto 90%)
  total_tokens       INTEGER NOT NULL DEFAULT 0,
  thinking_tokens    INTEGER NOT NULL DEFAULT 0,       -- Token usati per il "pensiero" (Gemini 3)
  
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

### 5.2 — Feature Tags (etichette funzionalità)

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
| `tts` | Text-to-Speech |
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

### 5.3 — Tabella aggregata giornaliera (per performance)

```sql
CREATE TABLE ai_token_usage_daily (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consultant_id   VARCHAR NOT NULL REFERENCES users(id),
  client_id       VARCHAR REFERENCES users(id),
  client_role     TEXT,
  model           TEXT NOT NULL,
  feature         TEXT NOT NULL,
  date            DATE NOT NULL,
  
  -- Aggregati
  request_count     INTEGER NOT NULL DEFAULT 0,
  total_input_tokens   INTEGER NOT NULL DEFAULT 0,
  total_output_tokens  INTEGER NOT NULL DEFAULT 0,
  total_cached_tokens  INTEGER NOT NULL DEFAULT 0,
  total_thinking_tokens INTEGER NOT NULL DEFAULT 0,
  total_cost           NUMERIC(10,6) NOT NULL DEFAULT 0,
  avg_duration_ms      INTEGER,
  error_count          INTEGER NOT NULL DEFAULT 0,
  
  UNIQUE(consultant_id, client_id, model, feature, date)
);

CREATE INDEX idx_daily_consultant ON ai_token_usage_daily(consultant_id, date);
CREATE INDEX idx_daily_client     ON ai_token_usage_daily(client_id, date);
```

---

## 6. BACKEND — Architettura Servizio

### 6.1 — `server/ai/token-tracker.ts` (Servizio Centrale)

```
┌──────────────────────────────────────────────────┐
│                 TOKEN TRACKER                      │
│                                                    │
│  ┌─────────────┐   ┌──────────────┐               │
│  │ trackUsage() │   │ calcCost()   │               │
│  │              │   │              │               │
│  │ - consultId  │   │ - model      │               │
│  │ - clientId   │   │ - inputTkn   │               │
│  │ - clientRole │   │ - outputTkn  │               │
│  │ - model      │   │ - cachedTkn  │               │
│  │ - feature    │   │ - thinkTkn   │               │
│  │ - usageMeta  │   │              │               │
│  │ - keySource  │   │ Returns USD  │               │
│  │ - thinkLevel │                                  │
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
- **Risoluzione client_role** → query automatica alla tabella `users` per determinare il ruolo

### 6.2 — Listino Prezzi Pre-configurato (Aggiornato)

```typescript
const PRICING: Record<string, { input: number; output: number; cachedInput: number }> = {
  // Prezzi per 1M token (USD) — Febbraio 2026
  
  // MODELLO PRINCIPALE (tutto migrato qui)
  'gemini-3-flash-preview': { 
    input: 0.15,       // $0.15 / 1M input tokens
    output: 0.60,      // $0.60 / 1M output tokens
    cachedInput: 0.02   // $0.02 / 1M cached input tokens
  },
  
  // MODELLO PRO (se necessario per task complessi)
  'gemini-3-pro-preview': {
    input: 1.25,
    output: 10.00,
    cachedInput: 0.13
  },
  
  // TTS (non migrabili)
  'gemini-2.5-flash-tts': { 
    input: 0.50,       // $0.50 / 1M input tokens
    output: 10.00,     // $10.00 / 1M output tokens (audio generato)
    cachedInput: 0.05
  },
  'gemini-2.5-pro-tts': {
    input: 1.00,
    output: 20.00,
    cachedInput: 0.10
  },
  
  // LIVE API (non migrabili)
  'gemini-2.5-flash-native-audio-preview-12-2025': { 
    input: 1.00,       // Audio input
    output: 3.00,
    cachedInput: 0.10
  },
  'gemini-live-2.5-flash-native-audio': {
    input: 1.00,
    output: 3.00,
    cachedInput: 0.10
  },
  
  // LEGACY (per dati storici, verranno gradualmente eliminati)
  'gemini-2.5-flash': { 
    input: 0.30,
    output: 2.50,
    cachedInput: 0.03
  },
  'gemini-2.5-flash-lite': {
    input: 0.10,
    output: 0.40,
    cachedInput: 0.01
  }
};
```

### 6.3 — Punti di Intercezione (Post-Consolidamento)

**A) GeminiClientAdapter (provider-factory.ts) — Copertura ~88%**

Dopo il consolidamento, 57 file su 65 passeranno per l'adapter. Il tracking è nell'adapter:

```
request → adapter.generateContent() → Gemini API → response 
  → tokenTracker.track(usageMetadata, context) ← AGGIUNTO (async, fire-and-forget)
  → return response (invariata)
```

**B) Wrapper per 4 file complessi — Copertura ~6%**

```typescript
export async function trackedGenerateContent(
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

**C) Live API + TTS — Copertura ~6%**

- Live API: tracking a fine sessione (già ha accumulo parziale, aggiungo salvataggio DB)
- TTS: tracking dopo ogni chiamata TTS

### 6.4 — API Endpoints

```
GET /api/ai-usage/summary
  ?period=today|week|month|custom
  &from=2026-02-01
  &to=2026-02-17
  
  Ritorna: { totalTokens, totalCost, requestCount, avgCostPerRequest, 
             topFeatures[], costByModel[], dailyTrend[] }

GET /api/ai-usage/by-client
  ?period=month
  
  Ritorna: [ { clientId, clientName, clientRole, totalTokens, totalCost, 
               requestCount, topFeature, lastUsed } ]
  
  NOTE: clientRole può essere 'client' o 'consultant' (consultant-client)
        Include anche una riga speciale con clientId=null per "azioni proprie"

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

## 7. FRONTEND — Design & Layout

### 7.1 — Pagina Consultant: "AI Usage & Costs"

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
│  │  👤 Per Cliente (include client + consultant-client)    │
│  │  ┌──────────────────────────────────────────────────┐  │
│  │  │ Cliente         │ Ruolo      │ Token │ Costo    │  │
│  │  ├─────────────────┼────────────┼───────┼──────────┤  │
│  │  │ Mario Rossi     │ Client     │ 580K  │ $3.20    │  │
│  │  │ Sara Bianchi    │ Consultant │ 420K  │ $2.15    │  │
│  │  │ Luca Verdi      │ Client     │ 310K  │ $1.80    │  │
│  │  │ *Tu stesso*     │ —          │ 200K  │ $1.10    │  │
│  │  └──────────────────────────────────────────────────┘  │
│  │                                                         │
│  │  ⚙️ Per Funzionalità                                   │
│  │  ┌────────────────────────────────────────────────┐    │
│  │  │ Funzionalità    │ Token  │ Costo │ % Totale  │    │
│  │  ├─────────────────┼────────┼───────┼───────────┤    │
│  │  │ WhatsApp Agent  │ 800K   │ $4.50 │ ███░ 36%  │    │
│  │  │ Chat Assistant  │ 520K   │ $2.80 │ ██░░ 22%  │    │
│  │  │ Email Generator │ 380K   │ $1.95 │ █░░░ 16%  │    │
│  │  │ Follow-up       │ 290K   │ $1.40 │ █░░░ 11%  │    │
│  │  │ Live Session    │ 200K   │ $0.90 │ █░░░  7%  │    │
│  │  │ TTS             │ 80K    │ $0.80 │ ░░░░  6%  │    │
│  │  │ Altro           │ 130K   │ $0.10 │ ░░░░  2%  │    │
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

### 7.2 — Sezione Admin: "Platform AI Costs"

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
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  📊 Migrazione Modelli                               │   │
│  │  Gemini 3 Flash: ████████████████░░ 88% chiamate     │   │
│  │  Gemini 2.5 TTS:  ██░░░░░░░░░░░░░░  6% chiamate     │   │
│  │  Gemini 2.5 Live: ██░░░░░░░░░░░░░░  6% chiamate     │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

## 8. FLUSSO DATI COMPLETO (Post-Consolidamento)

```
                    ┌───────────────────────┐
                    │    57 file            │
                    │    (via adapter o     │
                    │     quickGenerate)    │
                    └───────────┬───────────┘
                                │
                    ┌───────────▼───────────┐
                    │  GeminiClientAdapter   │
                    │  + quickGenerate()     │
                    │  (provider-factory.ts) │
                    └───────────┬───────────┘
                                │
              ┌─────────────────┼─────────────────┐
              ▼                 ▼                  ▼
     ┌────────────┐   ┌────────────┐    ┌────────────┐
     │ Gemini 3   │   │ Gemini 2.5 │    │ Gemini 2.5 │
     │ Flash Prev │   │ Flash TTS  │    │ Live Audio │
     │ (88%)      │   │ (6%)       │    │ (6%)       │
     └─────┬──────┘   └─────┬──────┘    └─────┬──────┘
           │                │                  │
           └────────────────┼──────────────────┘
                            │
                  ┌─────────▼─────────┐
                  │   TOKEN TRACKER    │
                  │                    │
                  │ 1. Estrae usageMeta│
                  │ 2. Risolve ruoli   │
                  │ 3. Calcola costo   │
                  │ 4. Buffer → DB     │
                  └─────────┬─────────┘
                            │
                  ┌─────────▼─────────┐
                  │  ai_token_usage   │──── CRON ────▶ ai_token_usage_daily
                  └─────────┬─────────┘
                            │
                  ┌─────────┴──────────┐
                  │                    │
                  ▼                    ▼
          ┌──────────────┐    ┌──────────────┐
          │ API Consultant│    │ API Admin    │
          │ /ai-usage/*  │    │ /admin/ai-*  │
          └──────┬───────┘    └──────┬───────┘
                 │                    │
                 ▼                    ▼
          ┌──────────────┐    ┌──────────────┐
          │ Dashboard    │    │ Admin Panel  │
          │ Consultant   │    │ Platform     │
          └──────────────┘    └──────────────┘
```

---

## 9. AUTO-REVIEW: 10 DOMANDE CRITICHE E SOLUZIONI

### D1: "Il buffer in-memory perde dati se il server crasha?"
**Rischio:** Sì, le entries nel buffer non ancora flushed vengono perse.  
**Soluzione:** Accettabile. Si tratta di max 5 secondi di dati (50 entries). Il tracking è "best-effort". Aggiungo un `process.on('SIGTERM')` per flush finale.

### D2: "Con 60+ file che chiamano Gemini, il tracker non diventa un bottleneck?"
**Soluzione:** Buffer + batch INSERT. 50 insert → 1 query SQL. `trackUsage()` è fire-and-forget (non awaited).

### D3: "La tabella `ai_token_usage` crescerà tantissimo. Performance?"
**Soluzione:** Tabella aggregata `ai_token_usage_daily` + CRON per pulizia dettagli >90 giorni.

### D4: "Come gestisco le chiamate dove non ho il consultantId?"
**Soluzione:** `consultant_id = 'system'` per le chiamate di sistema. Dashboard admin le raggruppa sotto "Sistema / Cron Jobs".

### D5: "Il file `geminiService.ts` nel frontend chiama Gemini dal browser."
**Soluzione:** Creare proxy server-side `/api/advisage/generate`. Il frontend chiama quello, il tracking è automatico.

### D6: "Migrare tutto a Gemini 3 Flash non rischia di peggiorare le task leggere (ex flash-lite)?"
**Rischio:** `gemini-2.5-flash-lite` era usato per intent classification, booking extraction — task veloci e economici.  
**Soluzione:** Gemini 3 Flash Preview con `thinkingLevel: 'minimal'` è l'equivalente funzionale. È comunque veloce perché minimizza il "pensiero". I costi sono $0.15/1M input vs $0.10/1M di flash-lite — differenza trascurabile. Il vantaggio è un modello più intelligente anche per task semplici, che riduce errori e retry.

### D7: "Il calcolo del costo è accurato? E se Google cambia i prezzi?"
**Soluzione:** Prezzi in dizionario configurabile (`PRICING`). Se cambiano, aggiorno un oggetto. Per v1, sufficiente.

### D8: "Come gestisco il consultant che è anche client di un altro consultant?"
**Soluzione:** Nuovo campo `client_role` nella tabella. Quando il tracker salva un record:
1. Se `client_id` è presente → query `users` per il ruolo → salva `client_role = role`
2. Se `client_id` è null → `client_role = NULL` (azione propria del consultant)
3. La dashboard mostra una colonna "Ruolo" per distinguere visivamente client da consultant-client.

### D9: "La migrazione dei modelli va fatta prima o dopo il tracking?"
**Risposta:** DOPO il tracking. Motivo:
1. Il tracking funziona con QUALSIASI modello (legge `usageMetadata` generico)
2. Una volta attivo il tracking, i dati ci diranno esattamente quante chiamate vanno su ogni modello
3. La migrazione dei modelli è un refactoring separato che posso fare con confidenza avendo i dati
4. Se qualcosa va storto dopo la migrazione, i dati di tracking ci dicono subito dove.

### D10: "Consolidare 12 file in quickGenerate() non rischia di rompere logiche specifiche?"
**Rischio:** Alcuni file hanno logica di fallback (Vertex → Studio) o key resolution specifica.  
**Soluzione:** 
1. `quickGenerate()` usa internamente `getAIProvider()` che ha GIÀ tutta la logica di fallback e key rotation
2. Per file con 1 sola chiamata semplice (8 su 12), la migrazione è quasi meccanica
3. Per i 4 file complessi, uso il wrapper `trackedGenerateContent()` — non li tocco, aggiungo solo tracking
4. Test: confronto output prima/dopo su almeno 3 chiamate per file migrato

---

## 10. PIANO DI IMPLEMENTAZIONE (Ordine Aggiornato)

| Step | Cosa | File | Rischio | Dipendenza |
|------|------|------|---------|------------|
| 1 | Schema DB + migrazione Drizzle | `shared/schema.ts`, migration | Basso | — |
| 2 | Token Tracker service | `server/ai/token-tracker.ts` (nuovo) | Basso | Step 1 |
| 3 | `quickGenerate()` + `trackedGenerateContent()` | `server/ai/provider-factory.ts` | Medio | Step 2 |
| 4 | Tracking in GeminiClientAdapter | `server/ai/provider-factory.ts` | Medio | Step 2 |
| 5 | Consolidamento 12 file diretti → quickGenerate | 12 file server | Medio | Step 3 |
| 6 | Wrapper per 4 file complessi | 4 file server | Basso | Step 3 |
| 7 | Tracking Live API + TTS | `gemini-live-ws-service.ts`, `tts-service.ts` | Basso | Step 2 |
| 8 | API endpoints | `server/routes/ai-usage-router.ts` (nuovo) | Basso | Step 1 |
| 9 | Dashboard consultant | `client/src/pages/consultant-ai-usage.tsx` | Basso | Step 8 |
| 10 | Dashboard admin | `client/src/pages/admin-ai-usage.tsx` | Basso | Step 8 |
| 11 | Sidebar links + routing | Sidebar + routes | Basso | Step 9,10 |
| 12 | CRON aggregazione giornaliera | `server/cron/` | Basso | Step 1 |
| 13 | **Migrazione modelli a Gemini 3** | ~33 file (vedi sezione 2.4) | **Alto** | Step 4 (tracking attivo prima!) |

**NOTA IMPORTANTE:** La migrazione modelli (Step 13) va fatta DOPO che il tracking è attivo, così abbiamo dati per verificare che tutto funziona correttamente.

---

## 11. STIMA IMPATTO PERFORMANCE

| Aspetto | Impatto |
|---------|---------|
| Latenza per chiamata AI | **+0ms** (fire-and-forget, async) |
| Memoria server | **+~200KB** per il buffer (50 entries × ~4KB) |
| Carico DB | **+1 INSERT ogni 5 sec** (batch) = ~17K insert/giorno |
| Spazio DB | **~5MB/mese** per tabella dettaglio, ~100KB/mese per daily |

---

## 12. STIMA RISPARMIO MIGRAZIONE MODELLI

Basandosi su un volume stimato di 800 chiamate/giorno:

| Modello Vecchio | Costo stimato/mese | Modello Nuovo | Costo stimato/mese | Risparmio |
|-----------------|--------------------|----|---|---|
| gemini-2.5-flash (~70% chiamate) | ~$15 | gemini-3-flash-preview | ~$8 | -47% |
| gemini-2.5-flash-lite (~20% chiamate) | ~$2 | gemini-3-flash-preview (minimal) | ~$2.5 | +25% |
| gemini-2.5-pro (~2% chiamate) | ~$5 | gemini-3-flash-preview (high) | ~$1 | -80% |
| TTS + Live (~8% chiamate) | ~$4 | Invariato (2.5) | ~$4 | 0% |
| **TOTALE** | **~$26/mese** | | **~$15.5/mese** | **-40%** |

Il risparmio maggiore viene dalla sostituzione di `gemini-2.5-pro` con `gemini-3-flash-preview` (thinking: high), che offre qualità comparabile a costo molto inferiore.

---

## 13. METRICHE DI SUCCESSO

- [ ] 100% delle chiamate `generateContent` via adapter vengono tracciate
- [ ] 100% delle chiamate consolidate via quickGenerate vengono tracciate
- [ ] 100% delle chiamate wrapper vengono tracciate
- [ ] Dashboard consultant mostra dati corretti con distinzione client/consultant-client
- [ ] Admin vede costi aggregati per consultant e per key_source
- [ ] Migrazione modelli completata senza regressioni
- [ ] Il costo calcolato è ±5% rispetto alla fattura Google
- [ ] Zero impatto sulle performance percepite dall'utente
- [ ] Il sistema non blocca MAI una chiamata AI anche se il tracking fallisce
