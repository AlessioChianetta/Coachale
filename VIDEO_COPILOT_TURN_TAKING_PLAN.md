# Video Copilot - Piano Implementazione Turn-Taking Intelligente

## 📋 Sommario Esecutivo

**Problema identificato**: Il sistema Video Copilot attuale invia OGNI chunk audio a Vertex AI per trascrizione, causando:
- Errori 429 (Too Many Requests) - decine di chiamate API al secondo
- Costi eccessivi per token utilizzati
- Trascrizioni frammentate e incomprensibili

**Soluzione proposta**: Implementare un sistema di turn-taking intelligente simile a Fathom che:
- Bufferizza l'audio fino al rilevamento di silenzio (700ms)
- Distingue tra trascrizione UI (frequente) e analisi AI (rara)
- Chiama l'analisi Sales Manager solo dopo scambi completi di turno

**Risultato atteso**: Riduzione chiamate API da ~50/secondo a ~2-3/turno conversazionale

---

## 🔴 FLUSSO ATTUALE (BROKEN)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         FLUSSO ATTUALE - PROBLEMA                            │
└─────────────────────────────────────────────────────────────────────────────┘

  Audio Stream (ogni 100-200ms)
       │
       ▼
┌──────────────────┐
│  audio_chunk #1  │──────┐
└──────────────────┘      │
       │                  │
       ▼                  │
┌──────────────────┐      │
│  audio_chunk #2  │──────┤
└──────────────────┘      │
       │                  │    ┌─────────────────────────────────────────┐
       ▼                  ├───▶│  handleAudioChunk()                     │
┌──────────────────┐      │    │                                         │
│  audio_chunk #3  │──────┤    │  1. transcribeAudio() ───▶ VERTEX AI   │
└──────────────────┘      │    │  2. analyzeSentiment() ──▶ VERTEX AI   │
       │                  │    │  3. detectObjection() ───▶ VERTEX AI   │
       ▼                  │    │  4. generateSuggestion()─▶ VERTEX AI   │
┌──────────────────┐      │    │  5. runSalesManagerAnalysis()           │
│  audio_chunk #4  │──────┤    │     └─────────────────────▶ VERTEX AI  │
└──────────────────┘      │    └─────────────────────────────────────────┘
       │                  │
      ...                 │         ⚠️ RISULTATO: 5+ chiamate API per OGNI chunk!
       │                  │         ⚠️ Con 10 chunk/secondo = 50+ chiamate/secondo
       ▼                  │         ⚠️ = ERRORI 429 garantiti!
┌──────────────────┐      │
│  audio_chunk #N  │──────┘
└──────────────────┘
```

### Codice Attuale Problematico (linee 560-669 di video-ai-copilot.ts)

```typescript
async function handleAudioChunk(ws, session, message) {
  // ❌ PROBLEMA: Chiamata IMMEDIATA per ogni singolo chunk
  const transcript = await transcribeAudio(
    session,
    message.data,        // Ogni chunk, anche 100ms di audio
    message.speakerId,
    speakerName
  );

  if (transcript) {
    // ❌ Altra chiamata API per sentiment
    const sentiment = await analyzeSentiment(session, transcript, message.speakerId);
    
    // ❌ Altra chiamata API per obiezioni
    const battleCard = await detectObjectionAndGenerateBattleCard(session, transcript);
    
    // ❌ Altra chiamata API per suggerimenti (con throttle 3s, ma insufficiente)
    const suggestion = await generateSuggestion(session, recentTranscripts);
    
    // ❌ Chiamata Sales Manager (throttle 5s, ma comunque troppo frequente)
    await runSalesManagerAnalysis(ws, session);
  }
}
```

---

## 🟢 FLUSSO PROPOSTO (CORRETTO)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      FLUSSO PROPOSTO - TURN-TAKING                          │
└─────────────────────────────────────────────────────────────────────────────┘

  Audio Stream (ogni 100-200ms)
       │
       ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                        TURN BUFFER (per speaker)                             │
│  ┌─────────────────────────────────────────────────────────────────────────┐ │
│  │  audioChunks: [chunk1, chunk2, chunk3, ...]                             │ │
│  │  currentSpeakerId: "speaker_123"                                        │ │
│  │  lastChunkTime: 1702456789000                                           │ │
│  │  silenceTimer: Timer (700ms)                                            │ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────────┘
       │
       │  ┌─────────────────────────────────────────────────────────────────┐
       │  │ LOGICA DECISIONALE                                              │
       │  │                                                                 │
       │  │ if (silenzio >= 700ms) {                                        │
       │  │   // ✅ Fine chunk → TRASCRIVI (per UI)                         │
       │  │   transcribeCompletedChunk()                                    │
       │  │ }                                                               │
       │  │                                                                 │
       │  │ if (speakerChanged) {                                           │
       │  │   // ✅ Cambio speaker → ANALIZZA (Sales Manager)               │
       │  │   analyzeCompletedTurnExchange()                                │
       │  │ }                                                               │
       │  └─────────────────────────────────────────────────────────────────┘
       │
       ├─────────────── 700ms silenzio ─────────────────┐
       │                                                │
       ▼                                                ▼
┌──────────────────────┐                    ┌──────────────────────┐
│  transcribeChunk()   │                    │  ACCUMULA nel turno  │
│  (per aggiornare UI) │                    │  (stesso speaker)    │
│                      │                    │                      │
│  ✅ 1 chiamata API   │                    │  Nessuna chiamata    │
│  per frase completa  │                    │                      │
└──────────────────────┘                    └──────────────────────┘
       │
       │  Speaker A finisce, Speaker B inizia
       │
       ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                    ANALISI TURNO COMPLETO                                    │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │ TURNO COMPLETO Speaker A:                                              │  │
│  │ "Buongiorno, le parlo del nostro servizio di consulenza..."           │  │
│  │                                                                        │  │
│  │ TURNO COMPLETO Speaker B:                                              │  │
│  │ "Interessante, ma quanto costa? E quali sono i tempi?"                │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  → runSalesManagerAnalysis() con ENTRAMBI i turni completi                   │
│  → ✅ 1 sola chiamata API per SCAMBIO di turno                               │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## 📊 Diagramma Stati del Turn Buffer

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    DIAGRAMMA STATI - TURN STATE MACHINE                      │
└─────────────────────────────────────────────────────────────────────────────┘

                              ┌──────────────┐
                              │    IDLE      │
                              │ (nessun audio)│
                              └──────┬───────┘
                                     │
                          audio da speaker A
                                     │
                                     ▼
                    ┌────────────────────────────────┐
                    │        BUFFERING_A             │
                    │   (accumulo audio speaker A)   │
                    │                                │
                    │  - Aggiungi chunk al buffer    │
                    │  - Reset silenceTimer (700ms)  │
                    └────────────────────────────────┘
                         │                    │
          silenzio 700ms │                    │ audio da speaker B
                         │                    │
                         ▼                    ▼
    ┌────────────────────────┐    ┌────────────────────────────┐
    │   CHUNK_COMPLETE_A     │    │      SPEAKER_CHANGE        │
    │                        │    │                            │
    │ - transcribeChunk(A)   │    │ 1. Finalizza turno A       │
    │ - Invia a UI           │    │ 2. transcribeChunk(A)      │
    │ - Mantieni nel turno A │    │ 3. Salva trascrizione A    │
    └────────────────────────┘    │ 4. Inizia buffer B         │
                │                 │ 5. TRIGGER ANALYSIS        │
                │                 │    (dopo debounce 2s)      │
                ▼                 └────────────────────────────┘
    ┌────────────────────────┐                    │
    │   WAITING_MORE_A       │                    │
    │                        │                    ▼
    │  (pausa lunga 2s+)     │    ┌────────────────────────────┐
    │  - NON analizza ancora │    │       BUFFERING_B          │
    │  - Aspetta speaker B   │    │  (accumulo audio speaker B)│
    └────────────────────────┘    └────────────────────────────┘
                                              │
                                   silenzio 700ms
                                              │
                                              ▼
                              ┌────────────────────────────────┐
                              │      TURN_EXCHANGE_COMPLETE    │
                              │                                │
                              │ - Trascrizione A completa      │
                              │ - Trascrizione B completa      │
                              │ - CHIAMA Sales Manager         │
                              │   con A + B insieme            │
                              └────────────────────────────────┘
```

---

## 🔧 Strutture Dati da Implementare

### 1. SpeakerTurnBuffer

```typescript
// Aggiungere in video-ai-copilot.ts dopo le interfacce esistenti (linea ~115)

interface AudioChunk {
  data: string;           // Base64 audio
  timestamp: number;      // Quando è arrivato
  durationMs: number;     // Durata stimata del chunk
}

interface SpeakerTurnBuffer {
  speakerId: string;
  speakerName: string;
  chunks: AudioChunk[];
  startTime: number;
  lastChunkTime: number;
  transcriptParts: string[];  // Trascrizioni parziali per UI
  fullTranscript: string;     // Trascrizione completa del turno
  role: 'host' | 'guest' | 'prospect';
}

interface TurnState {
  meetingId: string;
  currentSpeaker: SpeakerTurnBuffer | null;
  previousSpeaker: SpeakerTurnBuffer | null;
  silenceTimer: NodeJS.Timeout | null;
  analysisDebounceTimer: NodeJS.Timeout | null;
  lastAnalysisTime: number;
  pendingAnalysis: boolean;
}

// Map per tracciare lo stato per meeting
const turnStates = new Map<string, TurnState>();
```

### 2. Costanti di Configurazione

```typescript
// Costanti per il turn-taking (aggiungere dopo ANALYSIS_THROTTLE_MS, linea ~127)

const TURN_TAKING_CONFIG = {
  // Silenzio che indica fine di un "chunk" di parlato
  SILENCE_THRESHOLD_MS: 700,
  
  // Silenzio minimo per considerare un cambio di speaker
  SPEAKER_CHANGE_THRESHOLD_MS: 300,
  
  // Pausa lunga (stesso speaker) - trascrivi ma non analizzare
  LONG_PAUSE_THRESHOLD_MS: 2000,
  
  // Debounce prima di chiamare Sales Manager
  ANALYSIS_DEBOUNCE_MS: 2000,
  
  // Minimo audio per tentare trascrizione
  MIN_AUDIO_CHUNKS: 3,
  
  // Minimo durata audio (ms) per trascrizione
  MIN_AUDIO_DURATION_MS: 500,
  
  // Massimo tempo senza analisi (forza analisi)
  MAX_TIME_WITHOUT_ANALYSIS_MS: 30000,
};
```

---

## 🔄 Nuovo Flusso handleAudioChunk

### Pseudocodice

```typescript
async function handleAudioChunk(ws, session, message) {
  const { meetingId } = session;
  const { speakerId, speakerName, data } = message;
  
  // 1. Ottieni o crea lo stato del turno
  let turnState = turnStates.get(meetingId);
  if (!turnState) {
    turnState = createTurnState(meetingId);
    turnStates.set(meetingId, turnState);
  }
  
  // 2. Cancella il timer di silenzio esistente
  if (turnState.silenceTimer) {
    clearTimeout(turnState.silenceTimer);
  }
  
  // 3. Controlla se c'è cambio speaker
  const isNewSpeaker = !turnState.currentSpeaker || 
                       turnState.currentSpeaker.speakerId !== speakerId;
  
  if (isNewSpeaker && turnState.currentSpeaker) {
    // 4a. CAMBIO SPEAKER: Finalizza turno precedente
    await finalizeTurn(ws, session, turnState);
    
    // Sposta currentSpeaker a previousSpeaker
    turnState.previousSpeaker = turnState.currentSpeaker;
    
    // Crea nuovo buffer per nuovo speaker
    turnState.currentSpeaker = createSpeakerBuffer(speakerId, speakerName, session);
    
    // 4b. Schedula analisi Sales Manager (dopo debounce)
    scheduleAnalysis(ws, session, turnState);
  }
  
  // 5. Aggiungi chunk al buffer corrente
  if (!turnState.currentSpeaker) {
    turnState.currentSpeaker = createSpeakerBuffer(speakerId, speakerName, session);
  }
  
  turnState.currentSpeaker.chunks.push({
    data,
    timestamp: Date.now(),
    durationMs: estimateChunkDuration(data),
  });
  turnState.currentSpeaker.lastChunkTime = Date.now();
  
  // 6. Avvia timer silenzio per rilevare fine chunk
  turnState.silenceTimer = setTimeout(async () => {
    await handleSilenceDetected(ws, session, turnState);
  }, TURN_TAKING_CONFIG.SILENCE_THRESHOLD_MS);
}
```

### Funzioni Helper

```typescript
function createTurnState(meetingId: string): TurnState {
  return {
    meetingId,
    currentSpeaker: null,
    previousSpeaker: null,
    silenceTimer: null,
    analysisDebounceTimer: null,
    lastAnalysisTime: 0,
    pendingAnalysis: false,
  };
}

function createSpeakerBuffer(
  speakerId: string, 
  speakerName: string, 
  session: SessionState
): SpeakerTurnBuffer {
  const participant = session.participants.get(speakerId);
  return {
    speakerId,
    speakerName,
    chunks: [],
    startTime: Date.now(),
    lastChunkTime: Date.now(),
    transcriptParts: [],
    fullTranscript: '',
    role: participant?.role || 'guest',
  };
}

async function handleSilenceDetected(
  ws: WebSocket,
  session: SessionState,
  turnState: TurnState
) {
  if (!turnState.currentSpeaker) return;
  
  const buffer = turnState.currentSpeaker;
  
  // Verifica che ci sia abbastanza audio
  if (buffer.chunks.length < TURN_TAKING_CONFIG.MIN_AUDIO_CHUNKS) {
    console.log(`⏭️ [VideoCopilot] Troppo poco audio (${buffer.chunks.length} chunks), skip`);
    return;
  }
  
  // Concatena tutti i chunk audio
  const combinedAudio = combineAudioChunks(buffer.chunks);
  
  // TRASCRIZIONE (per UI) - questa è l'unica chiamata API per questo chunk
  const transcript = await transcribeAudio(
    session,
    combinedAudio,
    buffer.speakerId,
    buffer.speakerName
  );
  
  if (transcript) {
    // Aggiungi alla trascrizione del turno
    buffer.transcriptParts.push(transcript);
    buffer.fullTranscript = buffer.transcriptParts.join(' ');
    
    // Invia a UI come trascrizione parziale
    sendMessage(ws, {
      type: 'transcript',
      data: {
        speakerId: buffer.speakerId,
        speakerName: buffer.speakerName,
        text: transcript,
        isPartial: true,  // Indica che potrebbe esserci altro
      },
      timestamp: Date.now(),
    });
    
    // Aggiungi al buffer della sessione per compatibilità
    session.transcriptBuffer.push({
      speakerId: buffer.speakerId,
      speakerName: buffer.speakerName,
      text: transcript,
      timestamp: Date.now(),
      sentiment: 'neutral', // Sentiment verrà calcolato dopo
    });
  }
  
  // Pulisci i chunk già trascritti (mantieni buffer leggero)
  buffer.chunks = [];
}

async function finalizeTurn(
  ws: WebSocket,
  session: SessionState,
  turnState: TurnState
) {
  const buffer = turnState.currentSpeaker;
  if (!buffer) return;
  
  // Se ci sono chunk non trascritti, trascrivili prima
  if (buffer.chunks.length >= TURN_TAKING_CONFIG.MIN_AUDIO_CHUNKS) {
    const combinedAudio = combineAudioChunks(buffer.chunks);
    const transcript = await transcribeAudio(
      session,
      combinedAudio,
      buffer.speakerId,
      buffer.speakerName
    );
    
    if (transcript) {
      buffer.transcriptParts.push(transcript);
      buffer.fullTranscript = buffer.transcriptParts.join(' ');
    }
  }
  
  // Invia trascrizione finale del turno
  if (buffer.fullTranscript) {
    sendMessage(ws, {
      type: 'transcript',
      data: {
        speakerId: buffer.speakerId,
        speakerName: buffer.speakerName,
        text: buffer.fullTranscript,
        isPartial: false,  // Turno completo
        turnComplete: true,
      },
      timestamp: Date.now(),
    });
    
    // Aggiungi alla cronologia conversazione
    const speakerRole = buffer.role === 'host' ? 'assistant' : 'user';
    session.conversationMessages.push({
      role: speakerRole,
      content: buffer.fullTranscript,
      timestamp: new Date().toISOString(),
    });
  }
}

function scheduleAnalysis(
  ws: WebSocket,
  session: SessionState,
  turnState: TurnState
) {
  // Cancella eventuale timer precedente
  if (turnState.analysisDebounceTimer) {
    clearTimeout(turnState.analysisDebounceTimer);
  }
  
  turnState.pendingAnalysis = true;
  
  turnState.analysisDebounceTimer = setTimeout(async () => {
    if (!turnState.pendingAnalysis) return;
    
    // Verifica che ci sia uno scambio completo
    if (!turnState.previousSpeaker?.fullTranscript || 
        !turnState.currentSpeaker?.fullTranscript) {
      console.log(`⏭️ [VideoCopilot] Scambio incompleto, skip analysis`);
      return;
    }
    
    console.log(`\n🎯 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`🎯 [TURN-EXCHANGE] Analisi dopo scambio di turno`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`   Speaker precedente: ${turnState.previousSpeaker.speakerName}`);
    console.log(`   → "${turnState.previousSpeaker.fullTranscript.substring(0, 80)}..."`);
    console.log(`   Speaker corrente: ${turnState.currentSpeaker.speakerName}`);
    console.log(`   → "${turnState.currentSpeaker.fullTranscript.substring(0, 80)}..."`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
    
    // Chiama Sales Manager con contesto completo
    await runSalesManagerAnalysis(ws, session);
    
    turnState.lastAnalysisTime = Date.now();
    turnState.pendingAnalysis = false;
    
  }, TURN_TAKING_CONFIG.ANALYSIS_DEBOUNCE_MS);
}

function combineAudioChunks(chunks: AudioChunk[]): string {
  // Combina i base64 audio chunks in un unico buffer
  const buffers = chunks.map(c => Buffer.from(c.data, 'base64'));
  const combined = Buffer.concat(buffers);
  return combined.toString('base64');
}

function estimateChunkDuration(base64Audio: string): number {
  // PCM 16-bit mono a 16kHz = 32000 bytes/secondo
  const bytes = Buffer.from(base64Audio, 'base64').length;
  return (bytes / 32000) * 1000; // ms
}
```

---

## 🔄 Gestione Pause Lunghe (Stile Fathom)

### Scenario: Stesso speaker fa pausa >2 secondi

```
┌─────────────────────────────────────────────────────────────────────────────┐
│              GESTIONE PAUSE LUNGHE (STESSO SPEAKER)                          │
└─────────────────────────────────────────────────────────────────────────────┘

Speaker A parla    Pausa 3s    Speaker A riprende    Speaker B risponde
     │                │              │                      │
     ▼                ▼              ▼                      ▼
┌─────────┐    ┌───────────┐   ┌─────────┐           ┌─────────────┐
│ Chunk 1 │    │ 700ms     │   │ Chunk 2 │           │ Cambio      │
│ Chunk 2 │    │ silenzio  │   │ Chunk 3 │           │ Speaker!    │
│ Chunk 3 │    │ rilevato  │   │         │           │             │
└─────────┘    └───────────┘   └─────────┘           └─────────────┘
     │                │              │                      │
     │                ▼              │                      ▼
     │         ┌─────────────┐       │              ┌─────────────────┐
     │         │ TRASCRIVI   │       │              │ 1. Finalizza A  │
     │         │ parte 1     │       │              │ 2. Trascrivi A  │
     │         │             │       │              │ 3. Buffer B     │
     │         │ ⚠️ NON      │       │              │ 4. ANALISI      │
     │         │ ANALIZZARE! │       │              │    (dopo 2s)    │
     │         └─────────────┘       │              └─────────────────┘
     │                │              │
     └────────────────┴──────────────┘
                      │
              Tutto STESSO turno di A
              Trascrizioni parziali concatenate
```

### Codice per gestione pause lunghe

```typescript
async function handleSilenceDetected(
  ws: WebSocket,
  session: SessionState,
  turnState: TurnState
) {
  if (!turnState.currentSpeaker) return;
  
  const buffer = turnState.currentSpeaker;
  const silenceDuration = Date.now() - buffer.lastChunkTime;
  
  // Se silenzio > LONG_PAUSE ma stesso speaker, NON finalizzare il turno
  const isLongPause = silenceDuration >= TURN_TAKING_CONFIG.LONG_PAUSE_THRESHOLD_MS;
  
  if (isLongPause) {
    console.log(`⏸️ [VideoCopilot] Pausa lunga rilevata (${silenceDuration}ms) - stesso speaker`);
  }
  
  // Trascrivi comunque per aggiornare UI
  if (buffer.chunks.length >= TURN_TAKING_CONFIG.MIN_AUDIO_CHUNKS) {
    const combinedAudio = combineAudioChunks(buffer.chunks);
    const transcript = await transcribeAudio(/* ... */);
    
    if (transcript) {
      buffer.transcriptParts.push(transcript);
      buffer.fullTranscript = buffer.transcriptParts.join(' ');
      
      // Invia a UI come trascrizione parziale
      sendMessage(ws, {
        type: 'transcript',
        data: {
          speakerId: buffer.speakerId,
          speakerName: buffer.speakerName,
          text: transcript,
          isPartial: true,  // ⬅️ Indica che il turno NON è finito
          isPauseContinuation: isLongPause, // ⬅️ Indica pausa lunga
        },
        timestamp: Date.now(),
      });
    }
    
    // Pulisci chunk trascritti
    buffer.chunks = [];
  }
  
  // ⚠️ NON chiamare Sales Manager qui!
  // L'analisi avviene SOLO quando cambia speaker
}
```

---

## 🛡️ Retry con Exponential Backoff per errori 429

```typescript
// Wrapper per chiamate Vertex AI con retry automatico

interface RetryConfig {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 5,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
};

async function withRetry<T>(
  operation: () => Promise<T>,
  config: RetryConfig = DEFAULT_RETRY_CONFIG,
  operationName: string = 'API call'
): Promise<T> {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error: any) {
      lastError = error;
      
      const is429 = error.status === 429 || 
                    error.message?.includes('429') ||
                    error.message?.includes('Too Many Requests') ||
                    error.message?.includes('RESOURCE_EXHAUSTED');
      
      if (!is429 || attempt === config.maxRetries) {
        throw error;
      }
      
      // Exponential backoff con jitter
      const delay = Math.min(
        config.baseDelayMs * Math.pow(2, attempt) + Math.random() * 1000,
        config.maxDelayMs
      );
      
      console.log(`⚠️ [RETRY] ${operationName} - 429 error, attempt ${attempt + 1}/${config.maxRetries}, waiting ${Math.round(delay)}ms`);
      
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
}

// Uso nel transcribeAudio
async function transcribeAudio(session, audioBase64, speakerId, speakerName) {
  return withRetry(
    async () => {
      const aiProvider = await getAIProvider(/*...*/);
      const response = await aiProvider.client.generateContent(/*...*/);
      return response.response.text().trim();
    },
    DEFAULT_RETRY_CONFIG,
    `Transcription for ${speakerName}`
  );
}
```

---

## 📱 Aggiornamenti Frontend (useVideoCopilot.ts)

### Nuovi tipi di messaggio

```typescript
// Aggiungere supporto per nuovi campi nei messaggi transcript

interface TranscriptMessage {
  speakerId: string;
  speakerName: string;
  text: string;
  isPartial?: boolean;           // ⬅️ NUOVO: indica trascrizione parziale
  turnComplete?: boolean;        // ⬅️ NUOVO: indica fine turno
  isPauseContinuation?: boolean; // ⬅️ NUOVO: indica continuazione dopo pausa
}

// Nel handler del WebSocket
case 'transcript':
  const transcriptData = message.data as TranscriptMessage;
  
  if (transcriptData.isPartial) {
    // Aggiorna UI con testo parziale (può cambiare)
    updatePartialTranscript(transcriptData);
  } else if (transcriptData.turnComplete) {
    // Finalizza trascrizione nella history
    addCompletedTranscript(transcriptData);
  }
  break;
```

---

## 📋 Checklist Implementazione

### File da modificare: `server/websocket/video-ai-copilot.ts`

- [ ] **Linea ~115**: Aggiungere nuove interfacce (`AudioChunk`, `SpeakerTurnBuffer`, `TurnState`)
- [ ] **Linea ~127**: Aggiungere `TURN_TAKING_CONFIG` con costanti
- [ ] **Linea ~128**: Aggiungere `const turnStates = new Map<string, TurnState>()`
- [ ] **Linee 560-669**: Riscrivere `handleAudioChunk` con logica turn-taking
- [ ] **Nuove funzioni**: Aggiungere helper functions per turn management
- [ ] **Linea ~289**: Wrappare `transcribeAudio` con `withRetry`

### File da modificare: `client/src/hooks/useVideoCopilot.ts`

- [ ] Aggiornare handler per nuovi campi `isPartial`, `turnComplete`
- [ ] Implementare `updatePartialTranscript` per UI real-time

### Test da eseguire

- [ ] Simulare conversazione con pause lunghe (3-5 secondi)
- [ ] Verificare che non ci siano errori 429
- [ ] Verificare che trascrizioni UI siano fluide
- [ ] Verificare che Sales Manager venga chiamato solo dopo scambi di turno

---

## 📊 Metriche di Successo

| Metrica | Prima | Dopo |
|---------|-------|------|
| Chiamate API per secondo | 50+ | 0.5-2 |
| Errori 429 | Frequenti | Zero |
| Latenza trascrizione UI | N/A (frammentata) | <1s |
| Chiamate Sales Manager | Ogni 5s | Solo cambio turno |
| Costo token/minuto | Alto | -80% |

---

## 🔗 Riferimenti

- **File principale**: `server/websocket/video-ai-copilot.ts`
- **File reference (working)**: `server/ai/gemini-live-ws-service.ts` (usa VAD nativo di Gemini Live)
- **Frontend hook**: `client/src/hooks/useVideoCopilot.ts`
- **Sales Manager**: `server/ai/sales-manager-agent.ts`

---

*Documento generato per implementazione turn-taking intelligente - Dicembre 2025*
