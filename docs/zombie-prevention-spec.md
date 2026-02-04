# Sistema Anti-Zombie per Connessioni Gemini

## Problema Risolto

Le connessioni WebSocket verso Gemini Live API potevano rimanere aperte indefinitamente quando:
- Il client crashava senza chiudere la connessione
- La rete veniva persa improvvisamente
- Il browser veniva chiuso forzatamente
- La VPS perdeva connettività con Replit

Queste "connessioni zombie" consumavano quota Gemini senza essere utilizzate, causando:
- Esaurimento della quota API
- Errori 1011 (Resource Exhausted)
- Degradazione delle performance

---

## Soluzione Implementata

### P0.1 - lastActivity Tracking

**Modifiche:**
- Aggiunto `lastActivity: Date` all'interfaccia `ActiveGeminiConnection`
- Aggiunto `callId` e `clientId` per tracking
- Funzione `updateConnectionActivity(connectionId)` chiamata su:
  - Ogni audio chunk ricevuto dal client
  - Ogni text input ricevuto
  - Ogni heartbeat ping

**File:** `server/ai/gemini-live-ws-service.ts` (linee 122-149)

---

### P0.2 - Garbage Collector (60s)

**Costanti:**
```typescript
IDLE_TIMEOUT_MS = 30 * 60 * 1000        // 30 minuti
MAX_SESSION_DURATION_MS = 2 * 60 * 60 * 1000  // 2 ore
```

**Comportamento:**
- Ogni 60 secondi scansiona tutte le connessioni attive
- Termina connessioni inattive da > 30 minuti
- Termina connessioni attive da > 2 ore
- Warning a 1h50 prima della chiusura forzata

**File:** `server/ai/gemini-live-ws-service.ts` (linee 206-247)

---

### P0.3 - Heartbeat

**Client (ogni 30s):**
```typescript
wsRef.current.send(JSON.stringify({ type: 'ping' }));
```

**Server:**
- Riceve `ping`, aggiorna `lastActivity`
- Risponde con `pong` per conferma
- Se no ping per 60s → connessione zombie → termina

**File Server:** `server/ai/gemini-live-ws-service.ts` (linee 7351-7360)
**File Client:** `client/src/components/ai-assistant/live-mode/LiveModeScreen.tsx` (linee 823-835, 875-879)

---

### P0.4 - WebSocket terminate() HARD

**Problema:** `ws.close()` può lasciare socket half-open
**Soluzione:** Usa `ws.terminate()` per chiusura immediata

```typescript
if (typeof (conn.websocket as any).terminate === 'function') {
  (conn.websocket as any).terminate();
} else {
  conn.websocket.close(1000, reason);
}
```

**File:** `server/ai/gemini-live-ws-service.ts` (linee 173-175, 259-264)

---

## Diagramma Flusso

### PRIMA (Vulnerabile):

```
┌─────────────────────────────────────────────────────────────┐
│                    CLIENT CONNETTE                          │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│                  SESSIONE ATTIVA                            │
│                                                             │
│  ⚠️ NESSUN TIMEOUT INATTIVITÀ                              │
│  ⚠️ NESSUN LIMITE DURATA                                   │
│  ⚠️ SE CLIENT CRASHA → CONNESSIONE RESTA APERTA            │
│                                                             │
└─────────────────────┬───────────────────────────────────────┘
                      │
          ┌───────────┴───────────┐
          │                       │
          ▼                       ▼
┌─────────────────┐     ┌─────────────────────────┐
│ Client chiude   │     │ Client crasha           │
│ normalmente     │     │                         │
└────────┬────────┘     └────────────┬────────────┘
         │                           │
         ▼                           ▼
┌─────────────────┐     ┌─────────────────────────┐
│ ✅ Cleanup OK   │     │ ❌ ZOMBIE! Consuma      │
│                 │     │ quota Gemini per sempre │
└─────────────────┘     └─────────────────────────┘
```

### DOPO (Protetto):

```
┌─────────────────────────────────────────────────────────────┐
│                    CLIENT CONNETTE                          │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│              + lastActivity: Date.now()                     │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│                  SESSIONE ATTIVA                            │
│                                                             │
│  ✅ TIMEOUT INATTIVITÀ: 30 min → chiudi                    │
│  ✅ MAX DURATA: 2 ore → warning + chiudi                    │
│  ✅ HEARTBEAT: ping ogni 30s, no ping 60s → chiudi          │
│                                                             │
│        ┌────────────────────────────────────┐               │
│        │  GARBAGE COLLECTOR ogni 60s:       │               │
│        │  - Check lastActivity > 30 min?    │               │
│        │  - Check startedAt > 2 ore?        │               │
│        │  - SE SI → terminate() HARD        │               │
│        └────────────────────────────────────┘               │
└─────────────────────┬───────────────────────────────────────┘
                      │
          ┌───────────┼───────────┬───────────┐
          │           │           │           │
          ▼           ▼           ▼           ▼
┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ Client chiude│ │ Timeout idle │ │ Max durata   │ │ No heartbeat │
│ normalmente  │ │ 30 min       │ │ 2 ore        │ │ 60s          │
└──────┬───────┘ └──────┬───────┘ └──────┬───────┘ └──────┬───────┘
       │                │                │                │
       ▼                ▼                ▼                ▼
┌─────────────────────────────────────────────────────────────┐
│                    ✅ CLEANUP GARANTITO                     │
│                    terminate() + Map.delete()               │
│                    Nessun zombie possibile                  │
└─────────────────────────────────────────────────────────────┘
```

---

## Tabella Comparativa PRIMA/DOPO

| Aspetto | 🔴 PRIMA | 🟢 DOPO |
|---------|----------|---------|
| **Timeout inattività** | ❌ Mai | ✅ 30 min |
| **Max durata sessione** | ❌ Infinito | ✅ 2 ore (warning a 1h50) |
| **Heartbeat check** | ❌ No | ✅ Ogni 30s |
| **lastActivity nel tracker** | ❌ No | ✅ Si, aggiornato ad ogni attività |
| **Cleanup automatico** | ❌ Solo DB handles | ✅ Connessioni + handles |
| **Tipo chiusura** | ⚠️ close() soft | ✅ terminate() hard |
| **Zombie possibili** | ✅ SI | ❌ NO |
| **Consumo quota imprevisto** | ✅ SI | ❌ NO |

---

## Logging

Il tracker ora logga ogni 30 secondi:
```
🔌 [GEMINI TRACKER] Active connections: 2
   • abc123: voice_call - active - durata: 15min - idle: 2min - retries: 0
   • def456: consultation - active - durata: 45min - idle: 0min - retries: 1
```

Quando il garbage collector killa una connessione:
```
🧹 [ZOMBIE KILLER] Connection abc123 IDLE for 31min → TERMINATING
   ✅ [abc123] Terminated: idle_timeout
🧹 [ZOMBIE KILLER] Cleanup complete: 1 idle, 0 max duration
```

---

## Data Implementazione

**Data:** 4 Febbraio 2026
**Causa Root:** Connessioni zombie dalla VPS dal 1 Febbraio 2026 che hanno esaurito la quota Gemini
