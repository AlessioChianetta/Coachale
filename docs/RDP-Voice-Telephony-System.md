# RDP - Sistema Telefonia Vocale AI
## Requirements Definition Document

**Progetto**: Integrazione Telefonica con Alessia AI  
**Versione**: 1.0  
**Data**: Gennaio 2026  
**Stato**: In Sviluppo

---

## 📋 Indice

1. [Executive Summary](#1-executive-summary)
2. [Architettura Attuale (Alessia Browser)](#2-architettura-attuale-alessia-browser)
3. [Architettura Futura (Telefonia)](#3-architettura-futura-telefonia)
4. [Database](#4-database)
5. [Backend](#5-backend)
6. [Frontend](#6-frontend)
7. [Flusso Chiamata](#7-flusso-chiamata)
8. [Requisiti Tecnici](#8-requisiti-tecnici)
9. [Divisione Responsabilità](#9-divisione-responsabilità)
10. [Timeline](#10-timeline)

---

## 1. Executive Summary

### Obiettivo
Estendere l'assistente vocale **Alessia** (attualmente funzionante via browser) per rispondere alle **chiamate telefoniche** in ingresso, utilizzando la stessa intelligenza artificiale basata su Gemini Live.

### Valore Aggiunto
- **Accessibilità**: I clienti possono parlare con Alessia da qualsiasi telefono
- **Automazione**: Assistenza 24/7 senza operatori umani
- **Integrazione**: Stessa AI, stesso contesto, stesso database
- **Scalabilità**: Centralino proprio senza costi per chiamata a terzi

### Approccio
Riutilizzo del **95%** del codice esistente di Alessia. L'unica aggiunta è un **bridge ESL** che collega FreeSWITCH (centralino VoIP) al WebSocket server già funzionante.

---

## 2. Architettura Attuale (Alessia Browser)

### 2.1 Panoramica

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         ARCHITETTURA ATTUALE                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   ┌──────────────┐      WebSocket       ┌──────────────────────────────┐   │
│   │              │    /ws/ai-voice      │                              │   │
│   │   BROWSER    │ ◄─────────────────► │   gemini-live-ws-service.ts  │   │
│   │              │    Audio PCM 16k     │                              │   │
│   │  ┌────────┐  │                      │  ┌────────────────────────┐  │   │
│   │  │  Mic   │  │                      │  │  buildUserContext()    │  │   │
│   │  └────────┘  │                      │  │  buildSystemPrompt()   │  │   │
│   │      │       │                      │  └────────────────────────┘  │   │
│   │      ▼       │                      │             │                │   │
│   │  ┌────────┐  │                      │             ▼                │   │
│   │  │Resampler│ │                      │  ┌────────────────────────┐  │   │
│   │  │ 48k→16k │ │                      │  │    Gemini Live API     │  │   │
│   │  └────────┘  │                      │  │     (Vertex AI)        │  │   │
│   │      │       │                      │  └────────────────────────┘  │   │
│   │      ▼       │                      │             │                │   │
│   │  ┌────────┐  │      Audio Base64    │             ▼                │   │
│   │  │ PCM16  │──┼──────────────────────┼───► Trascrizione + Risposta  │   │
│   │  └────────┘  │                      │             │                │   │
│   │      ▲       │                      │             ▼                │   │
│   │      │       │   ◄──────────────────┼───  Audio PCM 24k            │   │
│   │  ┌────────┐  │                      │                              │   │
│   │  │Speaker │  │                      │  ┌────────────────────────┐  │   │
│   │  └────────┘  │                      │  │      PostgreSQL        │  │   │
│   │              │                      │  │  (ai_conversations,    │  │   │
│   └──────────────┘                      │  │   ai_messages)         │  │   │
│                                         │  └────────────────────────┘  │   │
│                                         └──────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Componenti Frontend Esistenti

| File | Linee | Descrizione |
|------|-------|-------------|
| `LiveModeScreen.tsx` | 2827 | Schermata principale vocale: stati (idle, loading, listening, thinking, speaking), gestione audio, transcript, timer, reconnect automatico |
| `FloatingAlessiaChat.tsx` | 245 | Widget flottante draggable con ridimensionamento |
| `AlessiaSessionContext.tsx` | 121 | Context React per stato sessione globale |
| `MicLevelIndicator.tsx` | ~50 | Visualizzatore livello microfono |
| `PhoneCallLayout.tsx` | ~200 | Layout stile chiamata telefonica |

### 2.3 Componenti Backend Esistenti

| File | Linee | Descrizione |
|------|-------|-------------|
| `gemini-live-ws-service.ts` | 6113 | **Core**: WebSocket server, connessione Gemini Live, gestione audio, salvataggio conversazioni |
| `ai-context-builder.ts` | 76880 | Costruisce contesto utente (profilo, storico, knowledge base) |
| `ai-prompts.ts` | 116045 | System prompt per ogni modalità AI |
| `audio-converter.ts` | ~500 | Conversione audio: WebM↔PCM, PCM↔WAV, base64 |

### 2.4 Flusso Audio Attuale

```
┌─────────────────────────────────────────────────────────────────────┐
│                        FLUSSO AUDIO BROWSER                         │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  CATTURA                 PROCESSING               INVIO             │
│  ┌─────────┐            ┌─────────────┐         ┌─────────────┐    │
│  │getUserMe│            │AudioWorklet │         │ WebSocket   │    │
│  │dia()    │──────────►│(resampling) │────────►│ send()      │    │
│  └─────────┘            └─────────────┘         └─────────────┘    │
│      │                       │                       │              │
│  48kHz Stereo           16kHz Mono              Base64 PCM16        │
│                                                                     │
│  RICEZIONE              DECODE                   PLAYBACK           │
│  ┌─────────────┐       ┌─────────────┐         ┌─────────────┐     │
│  │ WebSocket   │       │ base64→     │         │AudioContext │     │
│  │ onmessage   │──────►│ ArrayBuffer │────────►│ .play()     │     │
│  └─────────────┘       └─────────────┘         └─────────────┘     │
│      │                       │                       │              │
│  Base64 PCM24           Float32Array            24kHz Stereo        │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 2.5 Database Attuale

#### Tabella: `ai_conversations`
```sql
CREATE TABLE ai_conversations (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id VARCHAR REFERENCES users(id),
  sales_conversation_id VARCHAR,
  agent_id VARCHAR,
  mode TEXT NOT NULL,  -- 'assistenza' | 'consulente' | 'live_voice'
  title TEXT,
  last_message_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

#### Tabella: `ai_messages`
```sql
CREATE TABLE ai_messages (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id VARCHAR REFERENCES ai_conversations(id),
  role TEXT NOT NULL,  -- 'user' | 'assistant' | 'system'
  content TEXT NOT NULL,
  message_type TEXT,   -- 'text' | 'voice'
  audio_url TEXT,
  ai_audio_url TEXT,
  duration_seconds INTEGER,
  voice_used TEXT,
  status TEXT DEFAULT 'completed',
  created_at TIMESTAMP DEFAULT NOW()
);
```

#### Tabella: `ai_weekly_consultations`
```sql
CREATE TABLE ai_weekly_consultations (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id VARCHAR REFERENCES users(id),
  consultant_id VARCHAR REFERENCES users(id),
  scheduled_for TIMESTAMP NOT NULL,
  status TEXT DEFAULT 'scheduled',  -- 'scheduled' | 'in_progress' | 'completed' | 'cancelled'
  ai_conversation_id VARCHAR REFERENCES ai_conversations(id),
  full_transcript TEXT,
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  actual_duration_minutes INTEGER
);
```

---

## 3. Architettura Futura (Telefonia)

### 3.1 Panoramica

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                           ARCHITETTURA CON TELEFONIA                                │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                     │
│  ┌────────────────────────────────────────────────────────────────────────────┐    │
│  │                        HOSTINGER VPS                                        │    │
│  │  ┌──────────────────────────────────────────────────────────────────────┐  │    │
│  │  │                         FreeSWITCH                                    │  │    │
│  │  │                                                                       │  │    │
│  │  │   ┌─────────┐      ┌─────────────┐      ┌─────────────────────────┐  │  │    │
│  │  │   │  SIP    │      │  Dialplan   │      │    Event Socket         │  │  │    │
│  │  │   │ Profile │◄────►│ ai_support  │◄────►│    (porta 8021)         │  │  │    │
│  │  │   └─────────┘      └─────────────┘      └───────────┬─────────────┘  │  │    │
│  │  │        ▲                                            │                 │  │    │
│  │  │        │                                            │ TCP             │  │    │
│  │  └────────┼────────────────────────────────────────────┼─────────────────┘  │    │
│  └───────────┼────────────────────────────────────────────┼─────────────────────┘    │
│              │                                            │                          │
│              │ SIP Trunk                                  │                          │
│              │                                            ▼                          │
│  ┌───────────┴───────────┐            ┌──────────────────────────────────────────┐  │
│  │                       │            │               REPLIT                      │  │
│  │   MESSAGENET / VOIP   │            │  ┌────────────────────────────────────┐  │  │
│  │   (Numero Italiano)   │            │  │        voice-esl-client.ts         │  │  │
│  │                       │            │  │                                    │  │  │
│  └───────────────────────┘            │  │  • Connessione ESL                 │  │  │
│              ▲                        │  │  • Event handlers                  │  │  │
│              │                        │  │  • uuid_broadcast                  │  │  │
│              │                        │  │  • Caller ID lookup                │  │  │
│  ┌───────────┴───────────┐            │  └──────────────┬─────────────────────┘  │  │
│  │                       │            │                 │                        │  │
│  │   📞 TELEFONO         │            │                 ▼                        │  │
│  │   (Cliente)           │            │  ┌────────────────────────────────────┐  │  │
│  │                       │            │  │      voice-audio-handler.ts        │  │  │
│  └───────────────────────┘            │  │                                    │  │  │
│                                       │  │  • Audio chunks → Gemini           │  │  │
│                                       │  │  • Risposta → WAV 8k               │  │  │
│                                       │  │  • Conversione μ-law ↔ PCM         │  │  │
│                                       │  └──────────────┬─────────────────────┘  │  │
│                                       │                 │                        │  │
│                                       │                 ▼                        │  │
│                                       │  ┌────────────────────────────────────┐  │  │
│                                       │  │    gemini-live-ws-service.ts       │  │  │
│                                       │  │    (ESISTENTE - NESSUNA MODIFICA)  │  │  │
│                                       │  │                                    │  │  │
│                                       │  │  • buildUserContext()              │  │  │
│                                       │  │  • buildSystemPrompt()             │  │  │
│                                       │  │  • Gemini Live API                 │  │  │
│                                       │  │  • Salvataggio DB                  │  │  │
│                                       │  └────────────────────────────────────┘  │  │
│                                       └──────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Componenti Nuovi

| Componente | File | Descrizione |
|------------|------|-------------|
| **ESL Client** | `server/voice/voice-esl-client.ts` | Connessione Event Socket a FreeSWITCH, gestione eventi chiamata |
| **Audio Handler** | `server/voice/voice-audio-handler.ts` | Ricezione audio da FreeSWITCH, conversione formati, invio a Gemini |
| **Caller Lookup** | `server/voice/voice-caller-lookup.ts` | Mapping Caller ID → profilo cliente database |
| **Call Manager** | `server/voice/voice-call-manager.ts` | Gestione stato chiamata, turni parlato, timeout |
| **Voice Routes** | `server/routes/voice-routes.ts` | API REST per monitoring e configurazione |
| **Voice Calls Table** | Schema DB | Logging chiamate telefoniche |

### 3.3 Differenze Audio

| Aspetto | Browser (Attuale) | Telefono (Nuovo) |
|---------|-------------------|------------------|
| **Sample Rate Ingresso** | 48kHz → 16kHz | 8kHz |
| **Codec Ingresso** | PCM Linear16 | G.711 μ-law (PCMU) |
| **Sample Rate Uscita** | 24kHz | 8kHz |
| **Codec Uscita** | PCM Linear16 | G.711 μ-law (PCMU) |
| **Canali** | Stereo → Mono | Mono |
| **Trasporto** | WebSocket | ESL + File WAV |

### 3.4 Flusso Audio Telefonia

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           FLUSSO AUDIO TELEFONIA                                │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  INGRESSO (Utente → AI)                                                         │
│  ┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐   │
│  │  FreeSWITCH │     │  Recording  │     │  Conversione │     │   Gemini    │   │
│  │  (G.711 8k) │────►│  (chunk)    │────►│  μ-law→PCM16 │────►│   Live      │   │
│  └─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘   │
│                                                                                 │
│  USCITA (AI → Utente)                                                           │
│  ┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐   │
│  │   Gemini    │     │  Conversione │     │  WAV 8k     │     │ uuid_       │   │
│  │   Live      │────►│  PCM24→PCM8 │────►│  mono       │────►│ broadcast   │   │
│  └─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘   │
│                                                                                 │
│  MODALITÀ: Turn-Based (MVP)                                                     │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │  1. Utente parla (1-3 secondi)                                          │   │
│  │  2. VAD rileva fine parlato                                             │   │
│  │  3. Audio inviato a Gemini                                              │   │
│  │  4. Gemini genera risposta                                              │   │
│  │  5. Risposta convertita in WAV 8k                                       │   │
│  │  6. FreeSWITCH riproduce audio                                          │   │
│  │  7. Ripeti                                                              │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Database

### 4.1 Nuova Tabella: `voice_calls`

```sql
CREATE TABLE voice_calls (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Identificazione
  caller_id VARCHAR(20) NOT NULL,           -- Numero chiamante
  called_number VARCHAR(20) NOT NULL,       -- Numero chiamato (DID)
  client_id VARCHAR REFERENCES users(id),   -- Cliente riconosciuto (nullable)
  consultant_id VARCHAR REFERENCES users(id), -- Consulente associato
  
  -- FreeSWITCH
  freeswitch_uuid VARCHAR(36) NOT NULL,     -- UUID chiamata FreeSWITCH
  freeswitch_channel VARCHAR(100),          -- Nome canale
  
  -- Stato
  status VARCHAR(20) NOT NULL DEFAULT 'ringing',
  -- 'ringing' | 'answered' | 'talking' | 'completed' | 'failed' | 'transferred'
  
  -- Timing
  started_at TIMESTAMP NOT NULL DEFAULT NOW(),
  answered_at TIMESTAMP,
  ended_at TIMESTAMP,
  duration_seconds INTEGER,
  talk_time_seconds INTEGER,
  
  -- AI
  ai_conversation_id VARCHAR REFERENCES ai_conversations(id),
  ai_mode VARCHAR(50) DEFAULT 'assistenza',
  prompt_used TEXT,
  
  -- Trascrizione
  full_transcript TEXT,
  transcript_chunks JSONB,  -- Array di {timestamp, role, text}
  
  -- Audio
  recording_url TEXT,
  
  -- Risultato
  outcome VARCHAR(50),  -- 'completed' | 'transferred' | 'voicemail' | 'abandoned'
  transfer_target VARCHAR(20),  -- Se trasferito, a che numero
  
  -- Metadata
  metadata JSONB,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indici
CREATE INDEX idx_voice_calls_caller ON voice_calls(caller_id);
CREATE INDEX idx_voice_calls_client ON voice_calls(client_id);
CREATE INDEX idx_voice_calls_status ON voice_calls(status);
CREATE INDEX idx_voice_calls_started ON voice_calls(started_at);
```

### 4.2 Nuova Tabella: `voice_call_events`

```sql
CREATE TABLE voice_call_events (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id VARCHAR REFERENCES voice_calls(id) ON DELETE CASCADE,
  
  event_type VARCHAR(50) NOT NULL,
  -- 'channel_create' | 'channel_answer' | 'dtmf' | 'playback_start' 
  -- | 'playback_stop' | 'recording_start' | 'channel_hangup' | 'error'
  
  event_data JSONB,
  
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_voice_call_events_call ON voice_call_events(call_id);
```

### 4.3 Estensione: `users` (già esistente)

```sql
-- Campo già esistente
phone_number TEXT  -- Usato per lookup Caller ID → Cliente
```

### 4.4 Entity Relationship Diagram

```
┌─────────────────┐         ┌─────────────────┐         ┌─────────────────┐
│     users       │         │   voice_calls   │         │ voice_call_     │
├─────────────────┤         ├─────────────────┤         │ events          │
│ id (PK)         │◄───────┤ client_id (FK)  │         ├─────────────────┤
│ phone_number    │         │ consultant_id   │◄───────┤ call_id (FK)    │
│ ...             │         │ ai_conversation │         │ event_type      │
└─────────────────┘         │ _id (FK)        │         │ event_data      │
        ▲                   │ caller_id       │         └─────────────────┘
        │                   │ status          │
        │                   │ transcript      │
        │                   └─────────────────┘
        │                           │
        │                           ▼
        │                   ┌─────────────────┐
        └───────────────────┤ai_conversations │
                           ├─────────────────┤
                           │ id (PK)         │
                           │ client_id (FK)  │
                           │ mode            │
                           └─────────────────┘
```

---

## 5. Backend

### 5.1 Struttura Directory

```
server/
├── voice/
│   ├── index.ts                    # Export modulo
│   ├── voice-esl-client.ts         # Connessione ESL a FreeSWITCH
│   ├── voice-audio-handler.ts      # Gestione audio (conversione, chunk)
│   ├── voice-caller-lookup.ts      # Lookup Caller ID → Cliente
│   ├── voice-call-manager.ts       # State machine chiamata
│   └── voice-gemini-bridge.ts      # Ponte verso Gemini Live
├── routes/
│   └── voice-routes.ts             # API REST
└── ai/
    └── gemini-live-ws-service.ts   # ESISTENTE (nessuna modifica)
```

### 5.2 ESL Client (`voice-esl-client.ts`)

```typescript
// Responsabilità:
// 1. Connessione persistente a FreeSWITCH (porta 8021)
// 2. Autenticazione ESL
// 3. Sottoscrizione eventi: CHANNEL_CREATE, CHANNEL_ANSWER, CHANNEL_HANGUP, DTMF
// 4. Esecuzione comandi: uuid_broadcast, uuid_transfer, uuid_kill

import { Connection } from 'modesl';

interface ESLConfig {
  host: string;      // FREESWITCH_HOST
  port: number;      // 8021
  password: string;  // FREESWITCH_ESL_PASSWORD
}

class VoiceESLClient {
  private connection: Connection | null = null;
  private isConnected: boolean = false;
  private reconnectAttempts: number = 0;
  
  async connect(): Promise<void>;
  async disconnect(): Promise<void>;
  
  // Event handlers
  onChannelCreate(handler: (event: ESLEvent) => void): void;
  onChannelAnswer(handler: (event: ESLEvent) => void): void;
  onChannelHangup(handler: (event: ESLEvent) => void): void;
  onDTMF(handler: (event: ESLEvent) => void): void;
  
  // Commands
  async answer(uuid: string): Promise<void>;
  async playback(uuid: string, filePath: string): Promise<void>;
  async broadcast(uuid: string, filePath: string, leg: 'aleg' | 'bleg' | 'both'): Promise<void>;
  async transfer(uuid: string, destination: string): Promise<void>;
  async hangup(uuid: string, cause?: string): Promise<void>;
  async recordStart(uuid: string, filePath: string): Promise<void>;
  async recordStop(uuid: string): Promise<void>;
}
```

### 5.3 Audio Handler (`voice-audio-handler.ts`)

```typescript
// Responsabilità:
// 1. Ricezione audio chunk da FreeSWITCH (file o stream)
// 2. Conversione G.711 μ-law 8kHz → PCM Linear16 16kHz
// 3. Invio a Gemini Live
// 4. Ricezione risposta Gemini (PCM 24kHz)
// 5. Conversione → WAV 8kHz mono
// 6. Salvataggio file per playback

interface AudioChunk {
  data: Buffer;
  format: 'ulaw' | 'alaw' | 'pcm16';
  sampleRate: number;
  timestamp: number;
}

class VoiceAudioHandler {
  // Conversioni
  ulawToPCM16(input: Buffer): Buffer;
  pcm16ToUlaw(input: Buffer): Buffer;
  resample(input: Buffer, fromRate: number, toRate: number): Buffer;
  
  // Processing
  async processIncomingAudio(chunk: AudioChunk): Promise<Buffer>;
  async processOutgoingAudio(geminiAudio: Buffer): Promise<string>;  // returns WAV path
  
  // VAD (Voice Activity Detection)
  detectSpeechEnd(samples: Buffer): boolean;
}
```

### 5.4 Caller Lookup (`voice-caller-lookup.ts`)

```typescript
// Responsabilità:
// 1. Normalizzazione numero telefono (+39, 0039, spazi, ecc.)
// 2. Lookup in database: users.phone_number
// 3. Ritorno profilo cliente se trovato

interface CallerLookupResult {
  found: boolean;
  userId?: string;
  clientId?: string;
  consultantId?: string;
  clientName?: string;
  clientProfile?: UserProfile;
}

class VoiceCallerLookup {
  normalizePhoneNumber(raw: string): string;
  async lookupByPhone(phoneNumber: string): Promise<CallerLookupResult>;
  async getClientContext(clientId: string): Promise<ClientContext>;
}
```

### 5.5 Call Manager (`voice-call-manager.ts`)

```typescript
// Responsabilità:
// 1. State machine per ogni chiamata attiva
// 2. Gestione turni: utente parla → AI risponde → utente parla
// 3. Timeout e fallback
// 4. Logging eventi

type CallState = 
  | 'ringing'
  | 'answered' 
  | 'greeting'      // AI saluta
  | 'listening'     // Utente parla
  | 'processing'    // AI elabora
  | 'speaking'      // AI risponde
  | 'transferring'
  | 'ended';

interface ActiveCall {
  uuid: string;
  callerId: string;
  state: CallState;
  clientId?: string;
  conversationHistory: TranscriptEntry[];
  startTime: number;
  lastActivity: number;
}

class VoiceCallManager {
  private activeCalls: Map<string, ActiveCall> = new Map();
  
  async handleIncomingCall(event: ESLEvent): Promise<void>;
  async handleUserSpeech(uuid: string, audioChunk: Buffer): Promise<void>;
  async handleAIResponse(uuid: string, response: string, audio: Buffer): Promise<void>;
  async handleHangup(uuid: string): Promise<void>;
  
  // Fallback
  async transferToHuman(uuid: string, reason: string): Promise<void>;
  async sendToVoicemail(uuid: string): Promise<void>;
}
```

### 5.6 Gemini Bridge (`voice-gemini-bridge.ts`)

```typescript
// Responsabilità:
// 1. Creare "sessione virtuale" verso gemini-live-ws-service
// 2. Passare audio in formato compatibile
// 3. Ricevere risposta testuale e audio
// 4. Riutilizzare buildUserContext e buildSystemPrompt

class VoiceGeminiBridge {
  async createSession(
    clientId: string | null,
    consultantId: string,
    mode: 'assistenza' | 'consulente'
  ): Promise<GeminiSession>;
  
  async sendAudio(sessionId: string, audio: Buffer): Promise<GeminiResponse>;
  async closeSession(sessionId: string): Promise<void>;
}
```

### 5.7 Voice Routes (`server/routes/voice-routes.ts`)

```typescript
// API REST per monitoring e configurazione

// GET /api/voice/status
// Stato connessione ESL, chiamate attive

// GET /api/voice/calls
// Lista chiamate recenti con filtri

// GET /api/voice/calls/:id
// Dettaglio singola chiamata

// GET /api/voice/stats
// Statistiche: chiamate/giorno, durata media, outcome

// POST /api/voice/config
// Aggiornamento configurazione (numeri, fallback, ecc.)

// GET /api/voice/health
// Health check per monitoring
```

---

## 6. Frontend

### 6.1 Nuove Pagine

#### Dashboard Chiamate Vocali (`/consultant/voice-calls`)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  📞 Chiamate Vocali                                               [Config] │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  STATISTICHE OGGI                                                   │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐            │   │
│  │  │    12    │  │   8m 23s │  │    85%   │  │    2     │            │   │
│  │  │ Chiamate │  │ Durata ⌀ │  │ Complete │  │ Attive   │            │   │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘            │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  CHIAMATE IN CORSO                                        [2 attive]│   │
│  │  ┌─────────────────────────────────────────────────────────────┐   │   │
│  │  │  🟢 +39 333 1234567 → Mario Rossi    │ 03:45 │ AI Risponde  │   │   │
│  │  │  🟢 +39 347 9876543 → (Sconosciuto)  │ 01:12 │ In Ascolto   │   │   │
│  │  └─────────────────────────────────────────────────────────────┘   │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  STORICO CHIAMATE                            [Filtra] [Esporta CSV] │   │
│  │  ┌───────────────────────────────────────────────────────────────┐ │   │
│  │  │ Data/Ora     │ Numero        │ Cliente      │ Durata │ Esito  │ │   │
│  │  │──────────────┼───────────────┼──────────────┼────────┼────────│ │   │
│  │  │ 14:32        │ +39 333 1234  │ Mario Rossi  │ 05:23  │ ✅     │ │   │
│  │  │ 13:15        │ +39 347 9876  │ —            │ 02:45  │ ✅     │ │   │
│  │  │ 11:42        │ +39 320 5555  │ Anna Bianchi │ 00:45  │ 📲     │ │   │
│  │  │ 10:08        │ +39 339 1111  │ Luca Verdi   │ 08:12  │ ✅     │ │   │
│  │  └───────────────────────────────────────────────────────────────┘ │   │
│  │                                                      Pagina 1 di 5  │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

Legenda esiti:
✅ = Completata con successo
📲 = Trasferita a operatore
📭 = Voicemail
❌ = Fallita/Abbandonata
```

#### Dettaglio Chiamata (`/consultant/voice-calls/:id`)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  ← Torna                                📞 Chiamata #abc123                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────┐  ┌─────────────────────────────────┐  │
│  │  INFORMAZIONI                   │  │  AUDIO                          │  │
│  │                                 │  │                                 │  │
│  │  Chiamante: +39 333 1234567     │  │  ▶ ━━━━━━━━━━━━━━━━━━━━ 05:23  │  │
│  │  Cliente: Mario Rossi           │  │  [Scarica WAV]                  │  │
│  │  Data: 31/01/2026 14:32         │  │                                 │  │
│  │  Durata: 5 minuti 23 secondi    │  └─────────────────────────────────┘  │
│  │  Esito: ✅ Completata           │                                       │
│  │                                 │                                       │
│  └─────────────────────────────────┘                                       │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  TRASCRIZIONE                                                       │   │
│  │                                                                     │   │
│  │  [00:00] 🤖 Alessia:                                                │   │
│  │  Buongiorno, sono Alessia, l'assistente virtuale. Come posso       │   │
│  │  aiutarti oggi?                                                     │   │
│  │                                                                     │   │
│  │  [00:08] 👤 Cliente:                                                │   │
│  │  Ciao, volevo sapere quando è la prossima consulenza               │   │
│  │                                                                     │   │
│  │  [00:14] 🤖 Alessia:                                                │   │
│  │  Certo Mario! La tua prossima consulenza è programmata per         │   │
│  │  lunedì 3 febbraio alle ore 15:00. Vuoi che ti invii un            │   │
│  │  promemoria?                                                        │   │
│  │                                                                     │   │
│  │  [00:28] 👤 Cliente:                                                │   │
│  │  Sì grazie, mandamelo su WhatsApp                                  │   │
│  │                                                                     │   │
│  │  ...                                                                │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### Configurazione Telefonia (`/consultant/settings/voice`)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  ⚙️ Configurazione Telefonia                                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  CONNESSIONE FREESWITCH                                    🟢 Online│   │
│  │                                                                     │   │
│  │  Host:     ┌─────────────────────────────────────┐                 │   │
│  │            │ vps123.hostinger.com                │                 │   │
│  │            └─────────────────────────────────────┘                 │   │
│  │  Porta:    ┌─────────┐                                             │   │
│  │            │ 8021    │                                             │   │
│  │            └─────────┘                                             │   │
│  │  Password: ┌─────────────────────────────────────┐                 │   │
│  │            │ ••••••••••••                        │                 │   │
│  │            └─────────────────────────────────────┘                 │   │
│  │                                                     [Test Connessione] │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  NUMERO ASSISTENZA                                                  │   │
│  │                                                                     │   │
│  │  DID Principale: ┌─────────────────────────────────────┐           │   │
│  │                  │ +39 02 12345678                     │           │   │
│  │                  └─────────────────────────────────────┘           │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  COMPORTAMENTO AI                                                   │   │
│  │                                                                     │   │
│  │  Messaggio Benvenuto:                                               │   │
│  │  ┌─────────────────────────────────────────────────────────────┐   │   │
│  │  │ Buongiorno, sono Alessia, l'assistente virtuale di         │   │   │
│  │  │ [Nome Consulente]. Come posso aiutarti?                    │   │   │
│  │  └─────────────────────────────────────────────────────────────┘   │   │
│  │                                                                     │   │
│  │  Timeout Silenzio: ┌────┐ secondi                                  │   │
│  │                    │ 10 │                                          │   │
│  │                    └────┘                                          │   │
│  │                                                                     │   │
│  │  ☑ Trasferisci a operatore se AI non capisce (3 tentativi)        │   │
│  │  ☑ Invia trascrizione via email dopo chiamata                     │   │
│  │  ☐ Registra audio chiamate                                        │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  FALLBACK                                                           │   │
│  │                                                                     │   │
│  │  Numero Trasferimento: ┌─────────────────────────────────────┐     │   │
│  │                        │ +39 333 9999999                     │     │   │
│  │                        └─────────────────────────────────────┘     │   │
│  │                                                                     │   │
│  │  Orari Attivi:                                                      │   │
│  │  ☑ Lun  ☑ Mar  ☑ Mer  ☑ Gio  ☑ Ven  ☐ Sab  ☐ Dom               │   │
│  │  Dalle: [09:00] Alle: [18:00]                                      │   │
│  │                                                                     │   │
│  │  Fuori Orario: ○ Voicemail  ● Messaggio + Richiama                 │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│                                               [Annulla] [Salva Modifiche]   │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 6.2 Componenti React Nuovi

| Componente | Descrizione |
|------------|-------------|
| `VoiceCallsDashboard.tsx` | Dashboard principale con stats e lista chiamate |
| `VoiceCallsTable.tsx` | Tabella chiamate con sorting, filtering, pagination |
| `VoiceCallDetail.tsx` | Dettaglio singola chiamata con player audio |
| `VoiceCallTranscript.tsx` | Visualizzatore trascrizione con timestamp |
| `VoiceSettings.tsx` | Form configurazione telefonia |
| `VoiceConnectionStatus.tsx` | Badge stato connessione ESL |
| `ActiveCallsBadge.tsx` | Indicatore chiamate attive in tempo reale |

---

## 7. Flusso Chiamata

### 7.1 Sequenza Completa

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                              SEQUENCE DIAGRAM - CHIAMATA IN INGRESSO                    │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│  Telefono     FreeSWITCH      ESL Client      Call Manager     Gemini Bridge    DB     │
│     │              │              │                │                │            │      │
│     │──INVITE────►│              │                │                │            │      │
│     │              │──CHANNEL────►│                │                │            │      │
│     │              │  _CREATE     │                │                │            │      │
│     │              │              │──lookupCaller─►│                │            │      │
│     │              │              │                │──findByPhone──►│            │      │
│     │              │              │                │◄───clientId────│            │      │
│     │              │              │                │                │            │      │
│     │              │◄──answer─────│                │                │            │      │
│     │◄──200 OK────│              │                │                │            │      │
│     │              │              │                │──createCall───►│            │      │
│     │              │              │                │◄──callId───────│            │      │
│     │              │              │                │                │            │      │
│     │              │              │                │──createSession─────────────►│      │
│     │              │              │                │◄──sessionId─────────────────│      │
│     │              │              │                │                │            │      │
│     │              │◄──playback───│                │                │            │      │
│     │◄──"Ciao..."─│  (greeting)  │                │                │            │      │
│     │              │              │                │                │            │      │
│     │──"Vorrei.."►│              │                │                │            │      │
│     │              │──audio──────►│                │                │            │      │
│     │              │              │──processAudio─►│                │            │      │
│     │              │              │                │──sendToGemini─────────────►│      │
│     │              │              │                │                │──query────►│      │
│     │              │              │                │◄──response + audio──────────│      │
│     │              │              │                │                │            │      │
│     │              │              │                │──saveWAV──────►│            │      │
│     │              │◄──broadcast──│                │                │            │      │
│     │◄──"Certo.."─│              │                │                │            │      │
│     │              │              │                │                │            │      │
│     │    ...       │     ...      │      ...       │      ...       │    ...     │      │
│     │              │              │                │                │            │      │
│     │──BYE────────►│              │                │                │            │      │
│     │              │──HANGUP─────►│                │                │            │      │
│     │              │              │──endCall──────►│                │            │      │
│     │              │              │                │──saveCall─────►│            │      │
│     │              │              │                │                │──insert───►│      │
│     │              │              │                │                │            │      │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

### 7.2 State Machine Chiamata

```
                              ┌─────────────────┐
                              │                 │
                   ┌──────────│    RINGING      │
                   │          │                 │
                   │          └────────┬────────┘
                   │                   │
                   │            answer │
                   │                   ▼
                   │          ┌─────────────────┐
                   │          │                 │
                   │          │   ANSWERING     │
                   │          │                 │
                   │          └────────┬────────┘
                   │                   │
                   │        playGreeting
                   │                   ▼
                   │          ┌─────────────────┐
              hangup          │                 │
                   │          │   GREETING      │──────────────┐
                   │          │                 │              │
                   │          └────────┬────────┘              │
                   │                   │                       │
                   │         greetingDone                      │
                   │                   ▼                       │
                   │          ┌─────────────────┐              │
                   │          │                 │◄─────────────┤
                   ├──────────│   LISTENING     │              │
                   │          │                 │──────┐       │
                   │          └────────┬────────┘      │       │
                   │                   │               │       │
                   │          speechEnd│               │timeout│
                   │                   ▼               │       │
                   │          ┌─────────────────┐      │       │
                   │          │                 │      │       │
                   ├──────────│  PROCESSING     │      │       │
                   │          │                 │      │       │
                   │          └────────┬────────┘      │       │
                   │                   │               │       │
                   │         aiResponse│               │       │
                   │                   ▼               │       │
                   │          ┌─────────────────┐      │       │
                   │          │                 │      │       │
                   ├──────────│   SPEAKING      │◄─────┘       │
                   │          │                 │              │
                   │          └────────┬────────┘              │
                   │                   │                       │
                   │          speechDone                       │
                   │                   │                       │
                   │                   └───────────────────────┘
                   │
                   ▼
          ┌─────────────────┐
          │                 │
          │     ENDED       │
          │                 │
          └─────────────────┘
```

---

## 8. Requisiti Tecnici

### 8.1 Infrastruttura (TUO COMPITO)

| Componente | Requisito |
|------------|-----------|
| **VPS** | Ubuntu 22.04, IP pubblico statico, 2+ vCPU, 2GB+ RAM |
| **FreeSWITCH** | Versione 1.10.x, installato e funzionante |
| **SIP Trunk** | Provider italiano (Messagenet o simile), numero DID |
| **Porte Aperte** | 5060/UDP (SIP), 16384-32768/UDP (RTP), 8021/TCP (ESL) |
| **NAT** | `external_sip_ip` e `external_rtp_ip` configurati |

### 8.2 Software (MIO COMPITO)

| Componente | Tecnologia |
|------------|------------|
| **ESL Client** | `modesl` npm package |
| **Audio Processing** | Buffer manipulation, custom μ-law codec |
| **Database** | PostgreSQL (Drizzle ORM) |
| **API** | Express.js REST endpoints |
| **Frontend** | React + TypeScript + Tailwind |

### 8.3 Environment Variables

```bash
# FreeSWITCH Connection
FREESWITCH_HOST=vps123.hostinger.com
FREESWITCH_ESL_PORT=8021
FREESWITCH_ESL_PASSWORD=your-esl-password

# Numeri
VOICE_DID_NUMBER=+390212345678
VOICE_FALLBACK_NUMBER=+393339999999

# Comportamento
VOICE_GREETING_TEXT=Buongiorno, sono Alessia. Come posso aiutarti?
VOICE_SILENCE_TIMEOUT=10
VOICE_MAX_DURATION=1800  # 30 minuti max

# Storage audio
VOICE_RECORDINGS_PATH=/tmp/voice_recordings
```

---

## 9. Divisione Responsabilità

### 9.1 TU (Infrastruttura/Telecom)

| # | Task | Deliverable |
|---|------|-------------|
| 1 | Acquisto numero VoIP | Credenziali SIP, DID italiano |
| 2 | Setup VPS Hostinger | IP pubblico, porte aperte |
| 3 | Installazione FreeSWITCH | FreeSWITCH running |
| 4 | Configurazione SIP trunk | Chiamate inbound funzionanti |
| 5 | Dialplan `ai_support` | Context per routing AI |
| 6 | Abilitazione ESL | Porta 8021 raggiungibile |
| 7 | Test chiamata base | Chiamata → risponde → riattacca |

### 9.2 IO (Programmatore/Node)

| # | Task | Deliverable |
|---|------|-------------|
| 1 | Schema DB `voice_calls` | Migrazione database |
| 2 | ESL Client | Connessione + event handlers |
| 3 | Caller Lookup | Riconoscimento clienti |
| 4 | Audio Handler | Conversione μ-law ↔ PCM |
| 5 | Gemini Bridge | Integrazione con AI esistente |
| 6 | Call Manager | State machine + logging |
| 7 | Voice Routes | API monitoring |
| 8 | Frontend Dashboard | UI gestione chiamate |
| 9 | Frontend Settings | Configurazione telefonia |

### 9.3 Punti di Contatto

| Argomento | Chi Decide |
|-----------|------------|
| Codec audio (PCMU) | TU (FreeSWITCH) |
| Formato WAV output | IO (Node) |
| IP e Porta ESL | TU (Firewall) |
| Nome context dialplan | TU (FreeSWITCH) |
| Comandi ESL | IO (Node) |
| Credenziali ESL | TU (crea) → IO (usa) |

---

## 10. Timeline

### Fase 1: Setup (1-2 giorni)
**TU**: VPS + FreeSWITCH + SIP trunk  
**IO**: Schema DB + struttura file

### Fase 2: Connessione (1 giorno)
**TU**: ESL abilitato e testato  
**IO**: ESL Client funzionante

### Fase 3: Audio (1-2 giorni)
**TU**: Dialplan `ai_support`  
**IO**: Audio handler + Gemini bridge

### Fase 4: Integrazione (1 giorno)
**INSIEME**: Test end-to-end chiamata → AI risponde

### Fase 5: UI (1-2 giorni)
**IO**: Dashboard + Settings frontend

### Fase 6: Polish (1 giorno)
**INSIEME**: Bug fixing, ottimizzazioni

---

## Appendice A: Comandi ESL Utili

```bash
# Rispondere alla chiamata
uuid_answer <uuid>

# Riprodurre audio
uuid_broadcast <uuid> /path/to/file.wav aleg

# Registrare audio
uuid_record <uuid> start /path/to/recording.wav

# Trasferire chiamata
uuid_transfer <uuid> <destination> XML default

# Terminare chiamata
uuid_kill <uuid> NORMAL_CLEARING

# Ottenere variabili
uuid_getvar <uuid> Caller-Caller-ID-Number
```

## Appendice B: Formato Audio

### G.711 μ-law (PCMU)
- Sample rate: 8000 Hz
- Bit depth: 8-bit companded
- Bitrate: 64 kbps
- Standard PSTN

### PCM Linear16 (per Gemini)
- Sample rate: 16000 Hz (input) / 24000 Hz (output)
- Bit depth: 16-bit signed little-endian
- Canali: Mono

### Conversione
```
Ingresso: μ-law 8k → upsample → PCM16 16k → Gemini
Uscita:   Gemini → PCM 24k → downsample → PCM 8k → μ-law → FreeSWITCH
```

---

**Fine Documento**
