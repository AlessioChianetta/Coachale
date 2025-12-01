# 📊 SCHEMA COMPLETO: FLUSSO DISCOVERY → DEMO

## 🎯 ARCHITETTURA ALTA LIVELLO

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        CLIENT SALES CONVERSATION                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  currentPhase: 'discovery'  →  ✨ TRIGGER TRANSIZIONE  →  currentPhase: 'demo'  │
│                                                                              │
│  discoveryRec: null        →  🔄 GENERAZIONE REC  →  discoveryRec: {...}    │
│                                                                              │
│  scriptType: 'discovery'   →  📝 SWITCH SCRIPT  →  scriptType: 'demo'       │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 1️⃣ CHECKPOINT MANAGEMENT - CHI DECIDE SE È COMPLETATO?

### Struttura Database
```typescript
// IN: sales_conversation_training TABLE
{
  checkpointsCompleted: [
    {
      checkpointId: "phase_2_checkpoint_1",
      status: "completed" | "pending" | "failed",
      completedAt: "2025-11-30T10:52:00Z",
      verifications: [
        {
          requirement: "Prospect ha confessato il problema",
          status: "verified",
          evidence: {
            messageId: "msg_123",
            excerpt: "Ho un grande problema con...",
            matchedKeywords: ["problema", "difficoltà"],
            timestamp: "2025-11-30T10:51:00Z"
          }
        }
      ]
    }
  ]
}
```

### Chi e Quando Marca i Checkpoint?

**ATTUALMENTE (Deprecato - StepAdvancementAgent)**
```
File: server/ai/sales-script-tracker.ts

1. trackUserMessage() → riga 443-450
   ↓
   Rileva keywords di conferma della risposta
   ↓
   detectCheckpointProgress() → riga 1174-1200
   ↓
   Cerca parole come: "sì", "certo", "esatto", "giusto", ecc
   ↓
   Se trovate → completeCheckpoint(checkpointId)

2. autoDetectCheckpoints() → riga 532-558
   ↓
   Cicla su TUTTI i checkpoint della fase corrente
   ↓
   ⚠️ DEPRECATO: Chi fa il rilevamento VERO?
   ↓
   → StepAdvancementAgent (AI semantico - SalesManagerAgent)
   → Analizza il transcript SEMANTICAMENTE
   → Decide se il checkpoint è davvero completato
   → Invia risposta con campo: stepAdvancement.canAdvance = true/false
```

### Come Viene Salvato nel Database?

```typescript
// Quando viene salvata la conversazione (riga 4468-4600 in gemini-live-ws-service.ts):

const trackingData = {
  currentPhase: 'demo', // NUOVO
  checkpointsCompleted: [
    { 
      checkpointId: 'phase_1_checkpoint_1', 
      status: 'completed',
      completedAt: NOW,
      verifications: [...]
    },
    { 
      checkpointId: 'phase_2_checkpoint_1', 
      status: 'completed',
      completedAt: NOW,
      verifications: [...]
    }
  ]
};

// SALVA IN: sales_conversation_training TABLE
await db.update(salesConversationTraining).set({
  ...trackingData
}).where(...);
```

### ✅ RISPOSTA #1: WHO MARKS CHECKPOINT?

| Component | Quando | Come | Status |
|-----------|--------|------|--------|
| **SalesScriptTracker** | Dopo ogni msg utente | Keywords matching | ⚠️ LEGACY |
| **SalesManagerAgent** | Analisi semantica | AI analysis del transcript | ✅ CURRENT |
| **StepAdvancementAgent** | In background | Deep semantic analysis | ✅ CURRENT |
| **Database** | On conversation save | Persiste stato completo | ✅ ALWAYS |

---

## 2️⃣ DISCOVERY REC - VIENE PASSATO NEL CONTESTO DELL'AI?

### Timeline della Generazione REC

```
┌─ SALVATAGGIO CONVERSAZIONE ─────────────────────────────────────────┐
│                                                                      │
│  Rileva keyword: "passiamo alla demo"                               │
│         ↓                                                            │
│  Verifica: enableDemo = true? (riga 4397)                           │
│         ↓                                                            │
│  ✅ SÌ → Generazione REC                                            │
│         ↓                                                            │
│  generateDiscoveryRec(                                              │
│    fullTranscript,                                                  │
│    prospectName                                                     │
│  ) → Riga 4412-4435 in gemini-live-ws-service.ts                   │
│         ↓                                                            │
│  Retry logic: max 2 tentativi                                       │
│  Se fallisce → Demo procede SENZA REC                              │
│         ↓                                                            │
│  ✅ generatedDiscoveryRec = {                                       │
│       motivazioneCall: "...",                                       │
│       problemi: ["problema1", "problema2"],                         │
│       urgenza: "Alta",                                              │
│       budget: "10k-15k",                                            │
│       decisionMaker: true,                                          │
│       ...                                                           │
│     }                                                               │
│         ↓                                                            │
│  SALVA in: client_sales_conversations.discoveryRec                  │
│         ↓                                                            │
└─ FINE SALVATAGGIO ─────────────────────────────────────────────────┘

┌─ RICOSTRUZIONE PROMPT (PROSSIMA CONNESSIONE) ─────────────────────┐
│                                                                    │
│  loadConversationHistory() → Riga 1634-1651                        │
│         ↓                                                          │
│  Recupera: conversation.discoveryRec da DATABASE                  │
│         ↓                                                          │
│  IF discoveryRec && currentPhase !== 'discovery':                 │
│    → INIETTA nel prompt! (Riga 1735-1748)                         │
│         ↓                                                          │
│  buildFullSalesAgentContextAsync(                                 │
│    agentConfig,                                                   │
│    prospectData,                                                  │
│    currentPhase = 'demo',  // ← NUOVA FASE!                       │
│    conversationHistory,                                           │
│    scriptPosition,                                                │
│    savedDiscoveryRec  // ← REC PASSATO QUI! 🎯                   │
│  )                                                                │
│         ↓                                                          │
│  buildSalesAgentDynamicContext() → Riga 982-1053                 │
│         ↓                                                          │
│  IF (discoveryRec && currentPhase !== 'discovery'):               │
│    sections.push(formatDiscoveryRecForPrompt(discoveryRec))       │
│    ↓                                                              │
│    Formattazione finale:                                          │
│    ┌────────────────────────────────────────┐                     │
│    │ # 📋 DISCOVERY CALL REC                │                     │
│    │ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │                     │
│    │ ## 🎯 MOTIVAZIONE E BACKGROUND        │                     │
│    │ - Perché ha chiamato: [motivazione]   │                     │
│    │ - Cosa ha provato: [altroProvato]     │                     │
│    │ ## 📊 SITUAZIONE ATTUALE              │                     │
│    │ - Problemi: [problema1], [problema2]  │                     │
│    │ - Urgenza: [urgenza]                  │                     │
│    │ - Budget: [budget]                    │                     │
│    │ - Decision Maker: [true/false]        │                     │
│    └────────────────────────────────────────┘                     │
│         ↓                                                          │
│  ✅ INIETTATO NEL PROMPT DELL'AI!                                 │
│                                                                    │
└─────────────────────────────────────────────────────────────────┘
```

### ✅ RISPOSTA #2: IL REC VIENE PASSATO NEL CONTESTO?

**SÌ, MA CON CONDIZIONI:**

```typescript
// Condizioni di iniezione (riga 1735-1736):
IF (conversation.discoveryRec && conversation.currentPhase !== 'discovery') {
  // INIETTA nel prompt
  buildFullSalesAgentContextAsync(..., discoveryRec)
}

// Nel prompt (riga 995-996):
IF (discoveryRec && currentPhase !== 'discovery') {
  sections.push(formatDiscoveryRecForPrompt(discoveryRec));
}
```

| Quando | Condizione | Azione |
|--------|-----------|--------|
| Phase: discovery | N/A | ❌ REC NON iniettato |
| Phase: demo | discoveryRec exists | ✅ REC iniettato |
| Phase: objections | discoveryRec exists | ✅ REC iniettato |
| Phase: closing | discoveryRec exists | ✅ REC iniettato |

---

## 3️⃣ SCRIPT SWITCH - VIENE INSERITO DEMO E TOLTO DISCOVERY?

### Come Avviene lo Switch degli Script

```
┌─ PRIMA (Phase: discovery) ──────────────────────────────────────┐
│                                                                 │
│  buildStaticSalesAgentPrompt(                                  │
│    agentConfig,                                                │
│    dbScripts,                                                  │
│    currentPhase = 'discovery'  // ← PRIMO PARAMETRO!          │
│  ) → Riga 869-978 in sales-agent-prompt-builder.ts            │
│         ↓                                                       │
│  Controllo fase (riga 938-939):                                │
│  ┌──────────────────────────────────────┐                      │
│  │ if (phase === 'discovery') {         │                      │
│  │   sections.push(dbScripts.discovery) │ ← DISCOVERY SCRIPT  │
│  │ }                                    │                      │
│  └──────────────────────────────────────┘                      │
│         ↓                                                       │
│  ✅ PROMPT CONTIENE:                                           │
│     • Meta-istruzioni (sempre presenti)                        │
│     • DISCOVERY SCRIPT dal database                            │
│     • NON contiene demo script                                 │
│                                                                │
└────────────────────────────────────────────────────────────────┘

        ⏰ TRANSIZIONE RILEVATA ⏰
        (Keyword: "passiamo alla demo")
               ↓
        Genera REC
               ↓
        currentPhase = 'demo'  ← CAMBIA QUI!
               ↓
        client_sales_conversations.currentPhase = 'demo'

┌─ DOPO (Phase: demo) ────────────────────────────────────────────┐
│                                                                 │
│  buildStaticSalesAgentPrompt(                                  │
│    agentConfig,                                                │
│    dbScripts,                                                  │
│    currentPhase = 'demo'  // ← NUOVO PARAMETRO!               │
│  ) → Riga 869-978                                              │
│         ↓                                                       │
│  Controllo fase (riga 943-955):                                │
│  ┌────────────────────────────────────┐                        │
│  │ if (phase === 'demo') {            │                        │
│  │   sections.push(dbScripts.demo)    │ ← DEMO SCRIPT!       │
│  │ } else if (agentConfig.enableDemo) │                        │
│  │   // fallback se nessuno script    │                        │
│  │ }                                  │                        │
│  └────────────────────────────────────┘                        │
│         ↓                                                       │
│  ✅ PROMPT CONTIENE:                                           │
│     • Meta-istruzioni (sempre presenti)                        │
│     • DEMO SCRIPT dal database        ← NUOVO!               │
│     • NON contiene discovery script   ← RIMOSSO!              │
│     • + DISCOVERY REC iniettato       ← AGGIUNTO!             │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

### Dettaglio: Dove viene Caricato il Script Corretto?

```typescript
// Riga 809: In buildFullSalesAgentContext()
const staticPrompt = buildStaticSalesAgentPrompt(
  agentConfig, 
  dbScripts,      // ← Questo contiene: discovery, demo, objections
  currentPhase    // ← Questo decide QUALE script iniettare
);

// Riga 843-856: In buildFullSalesAgentContextAsync()
if (agentConfig.clientId) {
  dbScripts = await fetchClientScripts(
    agentConfig.clientId, 
    agentId
    // Carica TUTTI gli script: discovery, demo, objections
  );
}

// Riga 938-975: In buildStaticSalesAgentPrompt()
// LOGICA FINALE - SWITCH DEGLI SCRIPT:

if (currentPhase === 'discovery' && dbScripts?.discovery) {
  sections.push(dbScripts.discovery);  // ← SOLO DISCOVERY
} 
else if (currentPhase === 'demo' && dbScripts?.demo) {
  sections.push(dbScripts.demo);       // ← SOLO DEMO
}
else if (currentPhase === 'objections' && dbScripts?.objections) {
  sections.push(dbScripts.objections); // ← SOLO OBJECTIONS
}
```

### ✅ RISPOSTA #3: VIENE FATTO LO SWITCH DEGLI SCRIPT?

**SÌ, COMPLETAMENTE:**

```
DISCOVERY SCRIPT
    ↓
[RIMOSSO DAL PROMPT]  ← Non più nella sezione statica
    ↓
DEMO SCRIPT CARICATO   ← Nuovo script nella sezione statica
    ↓
+ DISCOVERY REC        ← Aggiunto come contesto dinamico
```

| Componente | Discovery | Demo | Objections |
|-----------|-----------|------|-----------|
| **Script statico** | ✅ Presente | ❌ Assente | ❌ Assente |
| **Meta-istruzioni** | ✅ Presenti | ✅ Presenti | ✅ Presenti |
| **Discovery REC** | ❌ NO | ✅ SÌ | ✅ SÌ |
| **Navigation Map** | ❌ NO | ✅ SÌ | ✅ SÌ |
| **Script caricato da** | DB | DB | DB |

---

## 📋 FLUSSO COMPLETO VISUALE

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                    CONVERSAZIONE DISCOVERY IN CORSO                           │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  📊 Stato DB:                                                                │
│  ├─ currentPhase: 'discovery'                                               │
│  ├─ discoveryRec: null                                                      │
│  ├─ checkpointsCompleted: [✅, ✅, ✅, ⏳, ⏳]                               │
│  └─ Trackers: SalesScriptTracker carica 'discovery' script                 │
│                                                                              │
│  📝 AI Prompt ATTUALE contiene:                                             │
│  ├─ Meta-istruzioni discovery                                              │
│  ├─ Script Discovery (es: "Fai le 7 domande PERCHÉ")                       │
│  ├─ Cronologia conversazione                                               │
│  ├─ Prospect data                                                           │
│  └─ Navigation Map (fase 5 di 7)                                           │
│                                                                              │
│  🎙️ Agent parla: "Perfetto! Ho capito il tuo problema..."                 │
│                                                                              │
│  🗣️ Prospect risponde: "Sì, esattamente. Come risolvete?"                 │
│                                                                              │
│  📝 Transcript cresce continuamente...                                      │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘

                              ⏱️ TRANSIZIONE TRIGGER ⏱️

                    Agent Riconosciuto: "Perfetto, ho capito tutto.
                    Sono curioso di vedere come funziona nella pratica.
                             Passiamo alla demo?"

                                    ↓ ↓ ↓

┌──────────────────────────────────────────────────────────────────────────────┐
│          RILEVAMENTO TRANSIZIONE (gemini-live-ws-service.ts:4390-4449)       │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ✅ Trigger keyword trovato: "passiamo alla demo"                           │
│  ✅ Verifica: enableDemo = true                                             │
│  ✅ Genera Discovery REC:                                                   │
│     {                                                                        │
│       motivazioneCall: "Ha visto un nostro video e vuole capire i dettagli" │
│       problemi: ["Lentezza recupero", "Dolori persistenti"],               │
│       urgenza: "Alta (8/10)",                                               │
│       budget: "15k-20k",                                                    │
│       decisionMaker: true,                                                  │
│       ...                                                                   │
│     }                                                                        │
│  ✅ Salva in DB                                                             │
│  ✅ Cambia fase                                                             │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘

                              ⏱️ DOPO TRANSIZIONE ⏱️

┌──────────────────────────────────────────────────────────────────────────────┐
│                    CONVERSAZIONE DEMO INIZIATA                               │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  📊 Stato DB - AGGIORNATO:                                                  │
│  ├─ currentPhase: 'demo'  ← CAMBIATO                                        │
│  ├─ discoveryRec: {...}   ← SALVATO                                         │
│  ├─ checkpointsCompleted: [✅, ✅, ✅, ✅, ✅] ← VERIFICATI                  │
│  └─ Trackers: SalesScriptTracker carica 'demo' script                      │
│                                                                              │
│  📝 AI Prompt RICOSTRUITO - NUOVO CONTIENE:                                 │
│  ├─ Meta-istruzioni demo                                                   │
│  ├─ 🆕 DEMO SCRIPT (rimosso il discovery!)                                 │
│  ├─ 🆕 DISCOVERY REC iniettato:                                            │
│  │   # 📋 DISCOVERY CALL REC                                               │
│  │   - Motivazione: Ha visto un nostro video...                            │
│  │   - Problemi: Lentezza recupero, Dolori persistenti                    │
│  │   - Urgenza: Alta (8/10)                                                │
│  │   - Budget: 15k-20k                                                     │
│  │   - Decision Maker: Sì                                                  │
│  ├─ Cronologia conversazione (COMPLETA)                                    │
│  ├─ Prospect data (aggiornata con info estratte)                           │
│  └─ Navigation Map (fase 1 di 3 per demo)                                  │
│                                                                              │
│  🎙️ Agent parla: "Perfetto Marco! Lascia che ti mostri esattamente come   │
│     risolviamo il tuo problema di recupero lento. Guarda qui..."           │
│                                                                              │
│  👁️ Agent personalizza la demo sui PROBLEMI estratti dal REC!             │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## 🔧 CHECKPOINT DI DEBUG

### Come Verificare che Tutto Funziona?

```javascript
// 1️⃣ VERIFICA TRANSIZIONE
Log nel server: "🔄 PHASE TRANSITION: discovery → demo (enableDemo=true)"

// 2️⃣ VERIFICA REC GENERATO
Log: "✅ Discovery REC generated successfully (attempt 1)"
Log: "   - Motivazione: ..."
Log: "   - Urgenza: ..."
Log: "   - Decision Maker: ..."

// 3️⃣ VERIFICA SCRIPT CARICATO
Log: "🔄 [SalesAgentContext] Fetching scripts for phase "demo" - agent ..."
Log: "✅ [SalesAgentContext] Found 3 script(s) in DB: DISCOVERY, DEMO, OBJECTIONS"

// 4️⃣ VERIFICA REC NEL PROMPT
Log: "📋 [connectionId] Discovery REC found in DB - will inject into prompt"
Log: "   → Motivazione: ..."
Log: "   → Urgenza: ..."

// 5️⃣ VERIFICA SCRIPT SELEZIONATO
Nel prompt finale dovrebbe contenere:
✅ "# ═════════════════════════════════════ SCRIPT ATTIVO: DEMO [DA DATABASE]"
❌ NON dovrebbe contenere: "# ═════════════════════════════════════ SCRIPT ATTIVO: DISCOVERY"
```

---

## 📌 RIEPILOGO FINALE DELLE 3 RISPOSTE

| Domanda | Risposta | Dove avviene | File |
|---------|----------|-------------|------|
| **1. Chi marca checkpoint come completato?** | `StepAdvancementAgent` (AI semantico) + `SalesScriptTracker` (legacy) | Backend, analisi AI | `sales-script-tracker.ts` |
| **2. REC viene passato nel contesto AI?** | **SÌ** - Se fase ≠ discovery e REC esiste, viene iniettato nel prompt | Durante ricostruzione prompt | `sales-agent-prompt-builder.ts:995-996` + `gemini-live-ws-service.ts:1735-1748` |
| **3. Script demo viene inserito e discovery tolto?** | **SÌ** - Completamente switchato in base a `currentPhase` | Build static prompt | `sales-agent-prompt-builder.ts:938-975` |

