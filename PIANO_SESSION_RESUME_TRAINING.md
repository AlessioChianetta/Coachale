# 📋 PIANO TECNICO: Session Resume per AI Training System

**Versione:** 1.0  
**Data:** 2 Dicembre 2025  
**Obiettivo:** Implementare session resumption nel Prospect Simulator per gestire il timeout di 10 minuti di Gemini Live API

---

## 🎯 EXECUTIVE SUMMARY

### Problema Attuale
Il Prospect Simulator (sistema di training automatico che simula un prospect per testare il Sales Agent) **NON** gestisce il timeout di 10 minuti di Gemini Live API. Quando la sessione scade, il training si interrompe bruscamente perdendo tutto il contesto.

### Soluzione
Implementare la stessa logica di session resumption già funzionante per `sales_agent` e `consultation_invite` modes, adattandola al Prospect Simulator.

### Impatto Stimato
- **Sessioni training illimitate** (attualmente max 10 min)
- **Zero interruzioni** durante test complessi discovery→demo
- **Consistenza UX** tra training automatico e sessioni reali

---

## 📊 ARCHITETTURA ATTUALE vs PROPOSTA

### FLUSSO ATTUALE (Senza Resume)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        PROSPECT SIMULATOR (ATTUALE)                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  [Start Training]                                                           │
│        │                                                                    │
│        ▼                                                                    │
│  ┌─────────────┐    HTTP POST     ┌──────────────────────┐                 │
│  │   start()   │ ─────────────► │ /api/.../session     │                 │
│  └─────────────┘                  │ Creates conversation │                 │
│        │                          └──────────────────────┘                 │
│        │ Gets sessionToken, conversationId                                 │
│        ▼                                                                    │
│  ┌─────────────────────┐                                                   │
│  │ connectToWebSocket()│                                                   │
│  └─────────────────────┘                                                   │
│        │                                                                    │
│        │  WebSocket URL:                                                    │
│        │  ws://host/ws/ai-voice?mode=sales_agent&sessionToken=xxx          │
│        │                                                                    │
│        │  ⚠️ MANCA: &resumeHandle=xxx                                       │
│        │                                                                    │
│        ▼                                                                    │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    WebSocket Connection                              │   │
│  │                                                                      │   │
│  │   ┌──────────────┐     ┌──────────────┐     ┌──────────────┐       │   │
│  │   │  Transcript  │────►│   Respond    │────►│  Transcript  │       │   │
│  │   │  (Agent)     │     │  (Prospect)  │     │  (Agent)     │       │   │
│  │   └──────────────┘     └──────────────┘     └──────────────┘       │   │
│  │                                                                      │   │
│  │   ... ripeti per ~10 minuti ...                                     │   │
│  │                                                                      │   │
│  │   ┌──────────────────────────────────────────────────────────────┐  │   │
│  │   │  ⏰ TIMEOUT 10 MINUTI                                         │  │   │
│  │   │                                                               │  │   │
│  │   │  Server invia: goAway notification                           │  │   │
│  │   │                 session_expiring                             │  │   │
│  │   │                 session_resumption_update (con handle)       │  │   │
│  │   │                                                               │  │   │
│  │   │  ⚠️ Prospect Simulator NON gestisce questi messaggi!         │  │   │
│  │   │  ⚠️ La sessione si chiude e il training fallisce!           │  │   │
│  │   └──────────────────────────────────────────────────────────────┘  │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│        │                                                                    │
│        ▼                                                                    │
│  ┌─────────────────┐                                                       │
│  │ WebSocket close │  ❌ Training interrotto                               │
│  │ code: 1000      │  ❌ Contesto perso                                    │
│  └─────────────────┘  ❌ Nessun resume                                     │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### FLUSSO PROPOSTO (Con Resume)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       PROSPECT SIMULATOR (PROPOSTO)                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  [Start Training]                                                           │
│        │                                                                    │
│        ▼                                                                    │
│  ┌─────────────┐                                                           │
│  │   start()   │    🆕 Initialize: resumeHandle = null                     │
│  └─────────────┘                                                           │
│        │                                                                    │
│        ▼                                                                    │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    WebSocket Connection                              │   │
│  │                                                                      │   │
│  │   URL: ws://host/ws/ai-voice?mode=sales_agent&sessionToken=xxx      │   │
│  │        &resumeHandle={this.resumeHandle || ''}  🆕 AGGIUNTO         │   │
│  │                                                                      │   │
│  │   ┌──────────────────────────────────────────────────────────────┐  │   │
│  │   │  📩 NUOVI HANDLER MESSAGGI                                    │  │   │
│  │   ├──────────────────────────────────────────────────────────────┤  │   │
│  │   │                                                               │  │   │
│  │   │  case 'session_resumption_update':                           │  │   │
│  │   │       this.resumeHandle = message.handle;  ✅ SALVA HANDLE   │  │   │
│  │   │       console.log("Handle saved for reconnect");             │  │   │
│  │   │       break;                                                  │  │   │
│  │   │                                                               │  │   │
│  │   │  case 'session_expiring':                                    │  │   │
│  │   │       this.sessionExpiring = true;                           │  │   │
│  │   │       console.log(`Session expires in ${message.timeLeft}s`);│  │   │
│  │   │       this.prepareForReconnect();  🆕 PREPARA RECONNECT      │  │   │
│  │   │       break;                                                  │  │   │
│  │   │                                                               │  │   │
│  │   │  case 'session:resumed':                                     │  │   │
│  │   │       console.log("Session resumed successfully!");          │  │   │
│  │   │       this.sessionExpiring = false;                          │  │   │
│  │   │       break;                                                  │  │   │
│  │   │                                                               │  │   │
│  │   └──────────────────────────────────────────────────────────────┘  │   │
│  │                                                                      │   │
│  │   ┌──────────────────────────────────────────────────────────────┐  │   │
│  │   │  🔄 on('close') HANDLER MODIFICATO                           │  │   │
│  │   ├──────────────────────────────────────────────────────────────┤  │   │
│  │   │                                                               │  │   │
│  │   │  ws.on('close', async (code, reason) => {                    │  │   │
│  │   │    if (this.isRunning && this.resumeHandle) {                │  │   │
│  │   │      // 🆕 TENTATIVO RECONNECT AUTOMATICO                    │  │   │
│  │   │      console.log("Attempting automatic reconnect...");       │  │   │
│  │   │      await this.attemptReconnect();                          │  │   │
│  │   │    } else {                                                   │  │   │
│  │   │      // Chiusura normale                                      │  │   │
│  │   │      this.isRunning = false;                                  │  │   │
│  │   │    }                                                          │  │   │
│  │   │  });                                                          │  │   │
│  │   │                                                               │  │   │
│  │   └──────────────────────────────────────────────────────────────┘  │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│        │                                                                    │
│        ▼ (dopo chiusura con resumeHandle)                                  │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  🆕 attemptReconnect()                                               │   │
│  ├─────────────────────────────────────────────────────────────────────┤   │
│  │                                                                      │   │
│  │  async attemptReconnect(): Promise<boolean> {                       │   │
│  │    const MAX_RETRIES = 3;                                           │   │
│  │    const RETRY_DELAY_MS = 2000;                                     │   │
│  │                                                                      │   │
│  │    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {       │   │
│  │      try {                                                          │   │
│  │        console.log(`Reconnect attempt ${attempt}/${MAX_RETRIES}`);  │   │
│  │        await new Promise(r => setTimeout(r, RETRY_DELAY_MS));       │   │
│  │                                                                      │   │
│  │        // 🆕 Riconnetti CON il resumeHandle                         │   │
│  │        await this.connectToWebSocket();                             │   │
│  │                                                                      │   │
│  │        // Aspetta conferma session:resumed                          │   │
│  │        const resumed = await this.waitForSessionResumed(5000);      │   │
│  │        if (resumed) {                                               │   │
│  │          console.log("✅ Reconnect successful!");                   │   │
│  │          return true;                                               │   │
│  │        }                                                            │   │
│  │      } catch (error) {                                              │   │
│  │        console.error(`Reconnect attempt ${attempt} failed`);        │   │
│  │      }                                                              │   │
│  │    }                                                                │   │
│  │    console.error("❌ All reconnect attempts failed");               │   │
│  │    await this.completeSession();                                    │   │
│  │    return false;                                                    │   │
│  │  }                                                                  │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 📁 FILE DA MODIFICARE

### 1️⃣ `server/services/prospect-simulator/index.ts`

**Modifiche richieste:**

#### A. Aggiungere proprietà per session resume

```typescript
// Linea ~137, dopo le proprietà esistenti
private resumeHandle: string | null = null;           // 🆕 Handle per session resume
private sessionExpiring: boolean = false;              // 🆕 Flag timeout imminente
private reconnectAttempts: number = 0;                 // 🆕 Contatore tentativi
private static readonly MAX_RECONNECT_ATTEMPTS = 3;   // 🆕 Max retry
private static readonly RECONNECT_DELAY_MS = 2000;    // 🆕 Delay tra retry
```

#### B. Modificare `buildWebSocketUrl()` (linea ~292)

```typescript
private buildWebSocketUrl(): string {
  const protocol = process.env.REPLIT_DEV_DOMAIN ? 'wss' : 'ws';
  const host = process.env.REPLIT_DEV_DOMAIN || 'localhost:5000';
  
  const params = new URLSearchParams({
    mode: 'sales_agent',
    sessionToken: this.sessionToken!,
    shareToken: this.options.agent.shareToken,
  });
  
  if (this.options.testMode) {
    params.set('testMode', this.options.testMode);
  }
  
  // 🆕 AGGIUNGERE: Include resumeHandle se disponibile
  if (this.resumeHandle) {
    params.set('resumeHandle', this.resumeHandle);
    console.log(`🔄 [PROSPECT SIMULATOR] Including resumeHandle in WebSocket URL`);
    console.log(`   → Handle preview: ${this.resumeHandle.substring(0, 20)}...`);
  }
  
  return `${protocol}://${host}/ws/ai-voice?${params.toString()}`;
}
```

#### C. Modificare `handleServerMessage()` (linea ~309)

Aggiungere nuovi case handlers:

```typescript
// 🆕 AGGIUNGERE dopo case 'conversation_end' (linea ~394)

// Session resume - Il server invia un nuovo handle dopo ogni risposta AI
case 'session_resumption_update':
  if (message.handle) {
    this.resumeHandle = message.handle;
    console.log(`🔄 [PROSPECT SIMULATOR] Session handle received and saved`);
    console.log(`   → Handle preview: ${message.handle.substring(0, 20)}...`);
    console.log(`   → Resumable: ${message.resumable}`);
  }
  break;

// Session expiring - Gemini avvisa 60s prima del timeout
case 'session_expiring':
  console.log(`\n⏰ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`⏰ [PROSPECT SIMULATOR] SESSION EXPIRING WARNING`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`   ⏱️  Time remaining: ~${message.timeLeft || 60} seconds`);
  console.log(`   🔄 Resume handle ready: ${message.hasHandle ? 'YES' : 'NO'}`);
  console.log(`   📍 Current turn: ${this.currentTurn}/${this.maxTurns}`);
  console.log(`   💾 Preparing for automatic reconnect...`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
  this.sessionExpiring = true;
  break;

// Session resumed - Conferma che il resume è andato a buon fine
case 'session:resumed':
  console.log(`\n✅ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`✅ [PROSPECT SIMULATOR] SESSION RESUMED SUCCESSFULLY`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`   📍 Resuming from turn: ${this.currentTurn}`);
  console.log(`   📊 Message count: ${this.messageCount}`);
  console.log(`   🔄 Reconnect attempts reset to 0`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
  this.sessionExpiring = false;
  this.reconnectAttempts = 0;
  break;
```

#### D. Modificare `ws.on('close')` handler (linea ~282)

```typescript
this.ws.on('close', async (code, reason) => {
  console.log(`🔌 [PROSPECT SIMULATOR] WebSocket closed: ${code} - ${reason}`);
  
  // 🆕 NUOVA LOGICA: Tentativo automatico di reconnect se abbiamo un handle
  if (this.isRunning && this.resumeHandle && code !== 1000) {
    console.log(`🔄 [PROSPECT SIMULATOR] Session closed unexpectedly, attempting reconnect...`);
    console.log(`   → Has resumeHandle: YES`);
    console.log(`   → Current turn: ${this.currentTurn}/${this.maxTurns}`);
    console.log(`   → Reconnect attempts: ${this.reconnectAttempts}/${ProspectSimulator.MAX_RECONNECT_ATTEMPTS}`);
    
    const reconnected = await this.attemptReconnect();
    if (reconnected) {
      console.log(`✅ [PROSPECT SIMULATOR] Reconnect successful, continuing training...`);
      return; // Non marcare come completato, continua
    }
  }
  
  // Se non riusciamo a riconnetterci, ferma la sessione
  this.isRunning = false;
});
```

#### E. Aggiungere nuovo metodo `attemptReconnect()`

```typescript
// 🆕 NUOVO METODO: Tentativo automatico di riconnessione con resume
private async attemptReconnect(): Promise<boolean> {
  if (this.reconnectAttempts >= ProspectSimulator.MAX_RECONNECT_ATTEMPTS) {
    console.error(`❌ [PROSPECT SIMULATOR] Max reconnect attempts (${ProspectSimulator.MAX_RECONNECT_ATTEMPTS}) reached`);
    return false;
  }
  
  this.reconnectAttempts++;
  
  console.log(`\n🔄 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`🔄 [PROSPECT SIMULATOR] RECONNECT ATTEMPT ${this.reconnectAttempts}/${ProspectSimulator.MAX_RECONNECT_ATTEMPTS}`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`   🔑 Resume handle: ${this.resumeHandle?.substring(0, 20)}...`);
  console.log(`   📍 Current turn: ${this.currentTurn}`);
  console.log(`   📊 Messages so far: ${this.messageCount}`);
  console.log(`   ⏳ Waiting ${ProspectSimulator.RECONNECT_DELAY_MS}ms before attempt...`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
  
  await new Promise(resolve => setTimeout(resolve, ProspectSimulator.RECONNECT_DELAY_MS));
  
  try {
    // Riconnetti con il resumeHandle incluso nell'URL
    await this.connectToWebSocket();
    
    // Aspetta conferma del resume (max 10 secondi)
    const resumeConfirmed = await new Promise<boolean>((resolve) => {
      const timeout = setTimeout(() => {
        console.warn(`⚠️ [PROSPECT SIMULATOR] Resume confirmation timeout after 10s`);
        resolve(false);
      }, 10000);
      
      // Il flag sessionExpiring viene resettato quando riceviamo 'session:resumed'
      const checkInterval = setInterval(() => {
        if (!this.sessionExpiring && this.ws?.readyState === WebSocket.OPEN) {
          clearTimeout(timeout);
          clearInterval(checkInterval);
          resolve(true);
        }
      }, 100);
    });
    
    if (resumeConfirmed) {
      console.log(`✅ [PROSPECT SIMULATOR] Resume confirmed! Continuing from turn ${this.currentTurn}`);
      this.reconnectAttempts = 0; // Reset counter on success
      return true;
    }
    
    console.warn(`⚠️ [PROSPECT SIMULATOR] Resume not confirmed, will retry...`);
    return this.attemptReconnect(); // Retry recursively
    
  } catch (error) {
    console.error(`❌ [PROSPECT SIMULATOR] Reconnect attempt ${this.reconnectAttempts} failed:`, error);
    return this.attemptReconnect(); // Retry recursively
  }
}
```

---

## 📊 DIAGRAMMA DI SEQUENZA: Session Resume Flow

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│  Prospect   │    │  WebSocket  │    │   Gemini    │    │  Gemini     │
│  Simulator  │    │   Server    │    │  WS Service │    │  Live API   │
└──────┬──────┘    └──────┬──────┘    └──────┬──────┘    └──────┬──────┘
       │                   │                  │                   │
       │  1. Connect       │                  │                   │
       │  (no resumeHandle)│                  │                   │
       │──────────────────►│                  │                   │
       │                   │  2. New session  │                   │
       │                   │─────────────────►│                   │
       │                   │                  │  3. Setup Gemini  │
       │                   │                  │──────────────────►│
       │                   │                  │                   │
       │                   │                  │◄──────────────────│
       │                   │                  │  4. setupComplete │
       │                   │                  │     + handle      │
       │                   │◄─────────────────│                   │
       │◄──────────────────│  5. session_     │                   │
       │                   │  resumption_     │                   │
       │                   │  update          │                   │
       │  [SALVA HANDLE]   │                  │                   │
       │                   │                  │                   │
       ├───────────────────┼──────────────────┼───────────────────┤
       │          ... CONVERSAZIONE NORMALE (max 10 min) ...      │
       ├───────────────────┼──────────────────┼───────────────────┤
       │                   │                  │                   │
       │                   │                  │◄──────────────────│
       │                   │                  │  6. goAway        │
       │                   │◄─────────────────│  (60s warning)    │
       │◄──────────────────│  7. session_     │                   │
       │                   │  expiring        │                   │
       │                   │  + latest handle │                   │
       │  [FLAG EXPIRING]  │                  │                   │
       │                   │                  │                   │
       │                   │                  │◄──────────────────│
       │                   │                  │  8. Connection    │
       │                   │◄─────────────────│     closes        │
       │◄──────────────────│  9. WS close     │                   │
       │                   │                  │                   │
       │  [TRIGGER RECONNECT]                 │                   │
       │                   │                  │                   │
       │  10. Wait 2000ms  │                  │                   │
       │  ─ ─ ─ ─ ─ ─ ─ ─ │                  │                   │
       │                   │                  │                   │
       │  11. Connect      │                  │                   │
       │  WITH resumeHandle│                  │                   │
       │──────────────────►│                  │                   │
       │                   │  12. Resume      │                   │
       │                   │  request         │                   │
       │                   │─────────────────►│                   │
       │                   │                  │  13. Resume       │
       │                   │                  │  with handle      │
       │                   │                  │──────────────────►│
       │                   │                  │                   │
       │                   │                  │◄──────────────────│
       │                   │                  │  14. Context      │
       │                   │                  │      restored     │
       │                   │◄─────────────────│                   │
       │◄──────────────────│  15. session:    │                   │
       │                   │  resumed         │                   │
       │  [RESET FLAGS]    │                  │                   │
       │  [CONTINUE]       │                  │                   │
       │                   │                  │                   │
       ├───────────────────┼──────────────────┼───────────────────┤
       │          ... CONVERSAZIONE CONTINUA (altri 10 min) ...   │
       └───────────────────┴──────────────────┴───────────────────┘
```

---

## 🔍 VERIFICA: Server Side (già implementato)

Il server (`gemini-live-ws-service.ts`) **già gestisce** correttamente il session resume. Verifica:

### ✅ Handle inviato al client (linea ~4695-4720)
```typescript
// Il server salva e invia l'handle dopo ogni risposta Gemini
if (response.sessionResumptionUpdate?.newHandle) {
  lastSessionHandle = response.sessionResumptionUpdate.newHandle;
  // ... salvataggio DB ...
  clientWs.send(JSON.stringify({
    type: 'session_resumption_update',
    handle: lastSessionHandle,
    resumable: true
  }));
}
```

### ✅ goAway notification handling (linea ~3085-3115)
```typescript
if (response.goAway) {
  // Invia handle proattivamente per reconnect
  if (lastSessionHandle) {
    clientWs.send(JSON.stringify({
      type: 'session_resumption_update',
      handle: lastSessionHandle,
      resumable: true
    }));
  }
  // Notifica il client
  clientWs.send(JSON.stringify({
    type: 'session_expiring',
    message: 'La sessione sta per scadere tra ~60 secondi.',
    timeLeft: 60,
    hasHandle: !!lastSessionHandle
  }));
}
```

### ✅ Resume validation (linea ~1001-1040)
```typescript
// Il server valida il resumeHandle dal query string
if (resumeHandle) {
  const isValid = await storage.validateGeminiSessionHandle(
    resumeHandle,
    mode === 'sales_agent' ? null : userId,
    mode === 'sales_agent' ? shareToken : undefined,
    // ...
  );
  if (isValid) {
    validatedResumeHandle = resumeHandle;
  }
}
```

### ✅ Session resume con Gemini (linea ~2579-2592)
```typescript
// Session resume configurato correttamente
session_resumption: { handle: validatedResumeHandle || null },
// ...
if (validatedResumeHandle) {
  console.log(`🔄 RESUMING SESSION with handle: ${validatedResumeHandle.substring(0, 20)}...`);
}
```

---

## ✅ CHECKLIST IMPLEMENTAZIONE

### Prospect Simulator (`server/services/prospect-simulator/index.ts`)

- [ ] **Proprietà nuove** (linea ~137)
  - [ ] `resumeHandle: string | null = null`
  - [ ] `sessionExpiring: boolean = false`
  - [ ] `reconnectAttempts: number = 0`
  - [ ] Costanti `MAX_RECONNECT_ATTEMPTS`, `RECONNECT_DELAY_MS`

- [ ] **buildWebSocketUrl()** (linea ~292)
  - [ ] Aggiungere `resumeHandle` ai params se presente

- [ ] **handleServerMessage()** (linea ~309)
  - [ ] Handler per `session_resumption_update`
  - [ ] Handler per `session_expiring`
  - [ ] Handler per `session:resumed`

- [ ] **ws.on('close')** (linea ~282)
  - [ ] Check se `isRunning && resumeHandle`
  - [ ] Chiamata a `attemptReconnect()`

- [ ] **attemptReconnect()** (nuovo metodo)
  - [ ] Retry loop con exponential backoff
  - [ ] Timeout per conferma resume
  - [ ] Reset contatori su successo

### Test da eseguire

- [ ] Avviare training e aspettare timeout 10 minuti
- [ ] Verificare che il simulator riceva `session_expiring`
- [ ] Verificare automatic reconnect con resume
- [ ] Verificare che la conversazione continui senza perdita di contesto
- [ ] Verificare log dettagliati per debugging

---

## 📝 NOTE TECNICHE

### Gemini Live API Session Resume (da Google Docs)

1. **Handle lifetime**: L'handle è valido per circa 15-30 minuti dopo la chiusura
2. **Context preservation**: Tutto il contesto della sessione viene mantenuto
3. **Token usage**: Il resume NON consuma token aggiuntivi per il contesto esistente
4. **Setup skip**: Quando si fa resume, NON si deve re-inviare `system_instruction`

### Timing considerazioni

- `goAway` arriva ~60 secondi prima della chiusura
- Il delay di 2 secondi tra retry è sufficiente per evitare race conditions
- Il timeout di 10 secondi per la conferma resume è conservativo

### Error handling

- Se tutti i retry falliscono, completare la sessione gracefully
- Salvare lo stato del training per analisi post-mortem
- Loggare tutti i tentativi per debugging

---

## 🚀 NEXT STEPS

Dopo l'implementazione del session resume, considerare:

1. **Notifica UI del training**: Mostrare all'utente quando avviene un reconnect
2. **Metriche**: Tracciare quanti reconnect avvengono per sessione
3. **Cleanup handle scaduti**: Job periodico per rimuovere handle vecchi dal DB

---

*Documento creato per il team di sviluppo - Dicembre 2025*
