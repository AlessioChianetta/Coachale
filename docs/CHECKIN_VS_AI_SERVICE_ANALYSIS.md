# Analisi Architetturale: Differenze tra AI Service e Check-in Personalization Service

**Data**: 2026-01-23  
**Autore**: Analisi tecnica approfondita  
**Scopo**: Identificare le differenze architetturali e proporre allineamento

---

## 1. Executive Summary

Il servizio `checkin-personalization-service.ts` presenta divergenze significative rispetto al pattern consolidato in `ai-service.ts`. Queste differenze causano:

1. **Troncamento dati**: I contenuti vengono tagliati arbitrariamente (300/200/100 chars)
2. **Context injection inefficiente**: Tutti i dati vengono forzati nel system prompt
3. **File Search sottoutilizzato**: Usato come "supplemento" invece che come fonte primaria
4. **Mancanza di conditional loading**: Non rispetta il flag `hasFileSearch` per decidere cosa includere

---

## 2. Architettura AI-SERVICE.TS (Pattern Corretto)

### 2.1 Flusso Dati

```
┌─────────────────────────────────────────────────────────────────┐
│                        ai-service.ts                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. buildUserContext() ─────────────────────────────────────┐   │
│     └─ Carica TUTTO dal database (no troncamenti)           │   │
│                                                              │   │
│  2. fileSearchService.getStoreBreakdownForGeneration() ─────┤   │
│     └─ Verifica quali documenti sono indicizzati            │   │
│                                                              │   │
│  3. hasFileSearch = storeNames.length > 0 && totalDocs > 0  │   │
│                                                              │   │
│  4. buildSystemPrompt(mode, consultantType, userContext,    │   │
│                        pageContext, { hasFileSearch })       │   │
│     └─ SE hasFileSearch=true:                                │   │
│        - OMETTE contenuti pesanti (esercizi, library, etc)   │   │
│        - Include solo metadati/statistiche                   │   │
│        - Dice "I contenuti sono accessibili via File Search" │   │
│     └─ SE hasFileSearch=false:                               │   │
│        - Include TUTTO nel prompt (context injection)        │   │
│                                                              │   │
│  5. fileSearchTool = fileSearchService.buildFileSearchTool() │   │
│     └─ Crea il tool che l'AI può chiamare                    │   │
│                                                              │   │
│  6. generateContent({                                        │   │
│       systemInstruction: systemPrompt,                       │   │
│       tools: [fileSearchTool]  // <-- AI può cercare!        │   │
│     })                                                       │   │
│                                                              │   │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 buildSystemPrompt con hasFileSearch

Da `ai-prompts.ts`, quando `hasFileSearch=true`:

```typescript
// ESERCIZI - Solo metadati, non contenuto
${hasFileSearch && userContext.exercises.all.length > 0 ? `
📚 ESERCIZI VIA FILE SEARCH (RAG)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Hai ${userContext.exercises.all.length} esercizi assegnati.
I contenuti degli esercizi sono accessibili automaticamente tramite ricerca semantica.
Dashboard rapida:
- Completati: X
- In sospeso: Y
- Restituiti: Z
` : ''}

// CONSULENZE - Solo metadati, non contenuto
${hasFileSearch && userContext.consultations.recent.length > 0 ? `
📞 CONSULENZE VIA FILE SEARCH (RAG)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Hai ${userContext.consultations.recent.length} consulenze recenti.
I contenuti delle consulenze sono accessibili automaticamente tramite ricerca semantica.
` : ''}
```

Quando `hasFileSearch=false`:
```typescript
// ESERCIZI - Tutto il contenuto nel prompt
${!hasFileSearch && userContext.exercises.all.length > 0 ? `
Esercizi (${userContext.exercises.all.length} totali):
${userContext.exercises.all.map(e => {
  // Include TUTTO: titolo, categoria, status, note, risposte, feedback, etc.
  // NESSUN TRONCAMENTO
}).join('\n')}
` : ''}
```

### 2.3 Risparmio Token

```
SENZA File Search:  ~150,000 tokens (tutto nel prompt)
CON File Search:    ~15,000 tokens (solo metadati + tool)
                    ─────────────────────────────────────
RISPARMIO:          ~90% dei token
```

---

## 3. Architettura CHECKIN-PERSONALIZATION-SERVICE.TS (Pattern Attuale - Problematico)

### 3.1 Problemi Identificati

```
┌─────────────────────────────────────────────────────────────────┐
│            checkin-personalization-service.ts                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ❌ PROBLEMA 1: buildContextFromUserContext() TRONCA TUTTO     │
│     └─ c.notes.substring(0, 300)           // MAX 300 chars    │
│     └─ c.summaryEmail.substring(0, 200)    // MAX 200 chars    │
│     └─ feedback.substring(0, 100)          // MAX 100 chars    │
│     └─ consultations.slice(0, 5)           // MAX 5            │
│     └─ exercises.slice(0, 10)              // MAX 10           │
│     └─ goals.slice(0, 5)                   // MAX 5            │
│                                                                 │
│  ❌ PROBLEMA 2: TUTTO nel system prompt                         │
│     └─ I dati troncati vanno TUTTI nel prompt                  │
│     └─ Non c'è conditional loading basato su hasFileSearch     │
│                                                                 │
│  ❌ PROBLEMA 3: File Search come "supplemento"                  │
│     └─ fileSearchTool passato ma non è il focus                │
│     └─ L'AI non sa che DEVE usare file_search per i dettagli   │
│                                                                 │
│  ❌ PROBLEMA 4: Non usa buildSystemPrompt standard              │
│     └─ Prompt custom che non segue le best practices           │
│     └─ Manca la logica hasFileSearch per omettere contenuti    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 3.2 Codice Problematico

```typescript
// TRONCAMENTI ARBITRARI
const notesPreview = c.notes.substring(0, 300);        // ❌ PERCHÉ 300?
const summaryPreview = c.summaryEmail.substring(0, 200); // ❌ PERCHÉ 200?
const feedback = f.feedback.substring(0, 100);          // ❌ PERCHÉ 100?

// LIMITI ARBITRARI
const recentConsultations = userContext.consultations.recent.slice(0, 5);  // ❌
const exerciseList = userContext.exercises.all.slice(0, 10);               // ❌
const goalList = userContext.goals.slice(0, 5);                            // ❌

// TUTTO NEL PROMPT - SEMPRE
const systemPrompt = `${consultantRef}
...
${clientDataContext}  // ← Dati troncati ma comunque forzati nel prompt
...
`;
```

---

## 4. Soluzione Proposta

### 4.1 Opzione A: Allineamento Completo con ai-service.ts

```typescript
// 1. NON usare buildContextFromUserContext() con troncamenti
// 2. Usare buildSystemPrompt() standard con hasFileSearch flag
// 3. L'AI usa file_search tool per cercare i dettagli

const hasFileSearch = context.hasFileSearchStore && context.storeNames.length > 0;

const systemPrompt = hasFileSearch 
  ? buildFileSearchPromptForCheckin(context)  // Solo metadati + istruzioni
  : buildFallbackPromptForCheckin(context);   // Context injection completo

const fileSearchTool = hasFileSearch 
  ? fileSearchService.buildFileSearchTool(context.storeNames) 
  : null;

const result = await client.generateContent({
  model,
  contents: [{ role: 'user', parts: [{ text: userMessage }] }],
  systemInstruction: { role: 'system', parts: [{ text: systemPrompt }] },
  generationConfig: { maxOutputTokens: 2000 },
  ...(fileSearchTool && { tools: [fileSearchTool] }), // AI può cercare!
});
```

### 4.2 Prompt File Search Mode

```typescript
function buildFileSearchPromptForCheckin(context: ClientCheckinContext): string {
  return `${consultantRef}

Stai per inviare un messaggio WhatsApp di check-in settimanale al tuo cliente ${context.clientName}.

═══════════════════════════════════════════════════════════════════
📊 DATI DISPONIBILI VIA FILE SEARCH
═══════════════════════════════════════════════════════════════════

Hai accesso completo ai seguenti dati tramite ricerca semantica:
- Tutte le consulenze passate (note complete, riepiloghi, trascrizioni)
- Tutti gli esercizi assegnati (risposte, feedback, punteggi)
- Progressi email journey
- Obiettivi e task
- Documenti della libreria

IMPORTANTE: USA IL TOOL file_search PER CERCARE I DETTAGLI!
Cerca: "consulenze recenti ${context.clientName}" per trovare le note
Cerca: "esercizi ${context.clientName}" per trovare i progressi

═══════════════════════════════════════════════════════════════════

ISTRUZIONI:
1. USA file_search per trovare informazioni specifiche sul cliente
2. Cita dettagli REALI dalle consulenze e dagli esercizi
3. Genera un messaggio COMPLETO e PERSONALIZZATO (150-250 parole)
...
`;
}
```

### 4.3 Fallback Mode (senza File Search)

```typescript
function buildFallbackPromptForCheckin(context: ClientCheckinContext): string {
  // Se File Search non è disponibile, carica TUTTO senza troncamenti
  const fullContext = buildFullContextNoTruncation(context.userContext);
  
  return `${consultantRef}
...
${fullContext}  // NESSUN TRONCAMENTO - tutti i dati completi
...
`;
}
```

---

## 5. Tabella Comparativa

| Aspetto | ai-service.ts | checkin-service.ts (attuale) |
|---------|---------------|------------------------------|
| **buildUserContext** | ✅ Usato correttamente | ✅ Usato |
| **Troncamento dati** | ❌ Mai | ⚠️ Sempre (300/200/100 chars) |
| **buildSystemPrompt** | ✅ Standard con hasFileSearch | ❌ Custom senza flag |
| **File Search mode** | ✅ Omette contenuti, usa tool | ❌ Include tutto troncato |
| **RAG fallback** | ✅ Solo se File Search assente | ❌ Sempre context injection |
| **Istruzioni per AI** | ✅ "Usa file_search per cercare" | ❌ "Basati sui dati sopra" |
| **maxOutputTokens** | ✅ Dinamico/alto | ⚠️ Fisso (1000) |

---

## 6. Piano di Implementazione

### Fase 1: Rimuovere Troncamenti
- Eliminare tutti i `.substring(0, N)` e `.slice(0, N)` arbitrari
- I dati devono essere completi o non inclusi affatto

### Fase 2: Implementare Dual Mode
- **File Search Mode**: Solo metadati nel prompt, AI usa tool per dettagli
- **Fallback Mode**: Context injection completo (senza troncamenti)

### Fase 3: Aggiornare Prompt
- Istruzioni chiare per usare file_search
- Query di esempio per guidare l'AI

### Fase 4: Testing
- Verificare che File Search venga effettivamente usato (controllare citations)
- Verificare che i messaggi siano completi e non troncati

---

## 7. Metriche di Successo

1. **Nessun troncamento** nei log di generazione
2. **File Search citations** presenti nelle risposte
3. **Messaggi completi** (> 150 parole) senza interruzioni a metà frase
4. **Token ridotti** in modalità File Search

---

## 8. Riferimenti Codice

| File | Linee Chiave |
|------|--------------|
| `server/ai-service.ts` | 789-800, 1172-1173, 1218, 1267 |
| `server/ai-prompts.ts` | 539-543, 913-1053 |
| `server/ai/checkin-personalization-service.ts` | 136-225, 265-332 |
| `server/ai/file-search-service.ts` | buildFileSearchTool(), parseCitations() |
