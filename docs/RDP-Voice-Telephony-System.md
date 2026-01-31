# RDP - Sistema Telefonia Vocale AI
## Requirements Definition Document

**Progetto**: Integrazione Telefonica con Alessia AI  
**Versione**: 2.0 (Production-Ready)  
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
8. [Sicurezza](#8-sicurezza)
9. [Anti-Abuso e Rate Limiting](#9-anti-abuso-e-rate-limiting)
10. [Requisiti Tecnici](#10-requisiti-tecnici)
11. [Divisione Responsabilità](#11-divisione-responsabilità)
12. [Timeline](#12-timeline)
13. [Appendici](#13-appendici)

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
Riutilizzo del **95%** del codice esistente di Alessia. L'unica aggiunta è un **bridge ESL** che collega FreeSWITCH (centralino VoIP) al sistema AI già funzionante.

### Architettura di Deployment

> ⚠️ **IMPORTANTE**: Tutto il sistema vocale (FreeSWITCH + Node Backend Voice) risiede su **VPS Hostinger**, NON su Replit.
> 
> Replit rimane solo per l'applicazione web principale (React frontend + Express API). La telefonia richiede latenza ultra-bassa e IP statico.

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
│   │  │ 48k→16k │ │                      │  │    Gemini Live API     │   │
│   │  └────────┘  │                      │  │     (Vertex AI)        │   │
│   │      │       │                      │  └────────────────────────┘  │   │
│   │      ▼       │                      │             │                │   │
│   │  ┌────────┐  │      Audio Base64    │             ▼                │   │
│   │  │ PCM16  │──┼──────────────────────┼───► Trascrizione + Risposta  │   │
│   │  └────────┘  │                      │             │                │   │
│   │      ▲       │                      │             ▼                │   │
│   │      │       │   ◄──────────────────┼───  Audio PCM 24k            │   │
│   │  ┌────────┐  │                      │                              │   │
│   │  │Speaker │  │                      │  ┌────────────────────────┐  │   │
│   │  └────────┘  │                      │  │      PostgreSQL        │   │
│   │              │                      │  │  (ai_conversations,    │   │
│   └──────────────┘                      │  │   ai_messages)         │   │
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
| `ai-context-builder.ts` | ~77000 | Costruisce contesto utente (profilo, storico, knowledge base) |
| `ai-prompts.ts` | ~116000 | System prompt per ogni modalità AI |
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
  status TEXT DEFAULT 'scheduled',
  ai_conversation_id VARCHAR REFERENCES ai_conversations(id),
  full_transcript TEXT,
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  actual_duration_minutes INTEGER
);
```

---

## 3. Architettura Futura (Telefonia)

### 3.1 Panoramica Deployment

> ⚠️ **ARCHITETTURA PRODUCTION**: Il backend vocale risiede interamente su VPS Hostinger per garantire:
> - **Latenza ultra-bassa** (< 100ms)
> - **IP statico** per SIP e firewall
> - **Connessione ESL locale** (127.0.0.1)
> - **Storage audio persistente**

```
┌──────────────────────────────────────────────────────────────────────────────────────┐
│                        ARCHITETTURA PRODUCTION TELEFONIA                              │
├──────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                      │
│  ┌────────────────────────────────────────────────────────────────────────────────┐ │
│  │                          HOSTINGER VPS (IP STATICO)                             │ │
│  │                                                                                 │ │
│  │  ┌─────────────────────────────────┐   ┌─────────────────────────────────────┐ │ │
│  │  │         FreeSWITCH              │   │      NODE VOICE BACKEND             │ │ │
│  │  │                                 │   │                                     │ │ │
│  │  │  ┌─────────┐    ┌───────────┐  │   │  ┌────────────────────────────────┐ │ │ │
│  │  │  │  SIP    │    │ Dialplan  │  │   │  │   voice-esl-client.ts          │ │ │ │
│  │  │  │ Profile │◄──►│ai_support │  │   │  │   • Connessione ESL            │ │ │ │
│  │  │  │ (PCMU!) │    │           │  │   │  │   • Event handlers             │ │ │ │
│  │  │  └─────────┘    └───────────┘  │   │  │   • uuid_broadcast             │ │ │ │
│  │  │       ▲              │         │   │  └───────────────┬────────────────┘ │ │ │
│  │  │       │              │         │   │                  │                  │ │ │
│  │  │       │         ┌────┴─────┐   │   │                  ▼                  │ │ │
│  │  │       │         │  ESL     │   │   │  ┌────────────────────────────────┐ │ │ │
│  │  │       │         │ 127.0.0.1│◄──┼───┼──┤   voice-audio-handler.ts       │ │ │ │
│  │  │       │         │ :8021    │   │   │  │   • μ-law ↔ PCM conversion     │ │ │ │
│  │  │       │         └──────────┘   │   │  │   • /dev/shm temp chunks       │ │ │ │
│  │  │       │                        │   │  └───────────────┬────────────────┘ │ │ │
│  │  └───────┼────────────────────────┘   │                  │                  │ │ │
│  │          │ SIP Trunk                  │                  ▼                  │ │ │
│  │          │                            │  ┌────────────────────────────────┐ │ │ │
│  │          │                            │  │   voice-gemini-bridge.ts       │ │ │ │
│  │          ▼                            │  │   • buildUserContext()         │ │ │ │
│  │  ┌───────────────────────┐            │  │   • buildSystemPrompt()        │ │ │ │
│  │  │   MESSAGENET / VOIP   │            │  │   • Gemini Live API            │ │ │ │
│  │  │   (Numero Italiano)   │            │  └───────────────┬────────────────┘ │ │ │
│  │  │   +39 02 1234567      │            │                  │                  │ │ │
│  │  └───────────────────────┘            │                  ▼                  │ │ │
│  │          ▲                            │  ┌────────────────────────────────┐ │ │ │
│  │          │                            │  │   /var/lib/alessia/recordings │ │ │ │
│  │          │                            │  │   (Storage persistente)        │ │ │ │
│  │  ┌───────┴───────────┐                │  └────────────────────────────────┘ │ │ │
│  │  │                   │                │                                     │ │ │
│  │  │  📞 TELEFONO      │                └─────────────────────────────────────┘ │ │
│  │  │   (Cliente)       │                                                        │ │
│  │  │                   │                                                        │ │
│  │  └───────────────────┘                                                        │ │
│  │                                                                                 │ │
│  └─────────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                      │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐ │
│  │                              COMUNICAZIONE DB                                    │ │
│  │                                                                                 │ │
│  │   VPS Hostinger ◄────────────────► PostgreSQL (Supabase) ◄────────► Replit App │ │
│  │                    HTTPS/TLS                               HTTPS/TLS           │ │
│  │                                                                                 │ │
│  └─────────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                      │
└──────────────────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Componenti Nuovi (VPS Hostinger)

| Componente | File | Descrizione |
|------------|------|-------------|
| **ESL Client** | `voice-esl-client.ts` | Connessione ESL locale (127.0.0.1:8021) |
| **Audio Handler** | `voice-audio-handler.ts` | Conversione μ-law↔PCM, temp su /dev/shm |
| **Caller Lookup** | `voice-caller-lookup.ts` | Mapping Caller ID → profilo cliente |
| **Call Manager** | `voice-call-manager.ts` | State machine, rate limiting |
| **Gemini Bridge** | `voice-gemini-bridge.ts` | Ponte verso Gemini Live API |
| **Voice API** | `voice-routes.ts` | REST API per monitoring |
| **Health Check** | `voice-health.ts` | Verifica ESL, FreeSWITCH, Gemini |

### 3.3 Differenze Audio

| Aspetto | Browser (Attuale) | Telefono (Nuovo) |
|---------|-------------------|------------------|
| **Sample Rate Ingresso** | 48kHz → 16kHz | 8kHz |
| **Codec Ingresso** | PCM Linear16 | G.711 μ-law (PCMU) |
| **Sample Rate Uscita** | 24kHz | 8kHz |
| **Codec Uscita** | PCM Linear16 | G.711 μ-law (PCMU) |
| **Canali** | Stereo → Mono | Mono |
| **Trasporto** | WebSocket | ESL + File WAV |
| **Temp Storage** | Memory | /dev/shm (RAM disk) |

### 3.4 Flusso Audio Telefonia

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           FLUSSO AUDIO TELEFONIA                                │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  INGRESSO (Utente → AI)                                                         │
│  ┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐   │
│  │  FreeSWITCH │     │  Recording  │     │  Conversione │     │   Gemini    │   │
│  │  (PCMU 8k)  │────►│  /dev/shm   │────►│  μ-law→PCM16 │────►│   Live      │   │
│  └─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘   │
│                                                                                 │
│  USCITA (AI → Utente)                                                           │
│  ┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐   │
│  │   Gemini    │     │  Conversione │     │  WAV 8k     │     │ uuid_       │   │
│  │   Live      │────►│  PCM24→PCM8 │────►│  /dev/shm   │────►│ broadcast   │   │
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
  caller_id VARCHAR(20) NOT NULL,
  called_number VARCHAR(20) NOT NULL,
  client_id VARCHAR REFERENCES users(id),
  consultant_id VARCHAR REFERENCES users(id),
  
  -- FreeSWITCH
  freeswitch_uuid VARCHAR(36) NOT NULL,
  freeswitch_channel VARCHAR(100),
  
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
  transcript_chunks JSONB,
  
  -- Audio
  recording_url TEXT,
  
  -- Risultato
  outcome VARCHAR(50),
  transfer_target VARCHAR(20),
  
  -- 💰 BILLING (per SaaS futuro)
  telephony_minutes DECIMAL(10,2),
  ai_tokens_used INTEGER,
  ai_cost_estimate DECIMAL(10,4),
  
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
CREATE INDEX idx_voice_calls_consultant ON voice_calls(consultant_id);
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
CREATE INDEX idx_voice_call_events_type ON voice_call_events(event_type);
```

### 4.3 Nuova Tabella: `voice_numbers` (Multi-tenant Ready)

```sql
-- Preparazione per multi-tenant SaaS
CREATE TABLE voice_numbers (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Numero
  phone_number VARCHAR(20) NOT NULL UNIQUE,
  display_name VARCHAR(100),
  
  -- Proprietario
  consultant_id VARCHAR REFERENCES users(id),
  
  -- Configurazione
  greeting_text TEXT,
  ai_mode VARCHAR(50) DEFAULT 'assistenza',
  fallback_number VARCHAR(20),
  
  -- Orari attività
  active_days JSONB DEFAULT '["mon","tue","wed","thu","fri"]',
  active_hours_start TIME DEFAULT '09:00',
  active_hours_end TIME DEFAULT '18:00',
  timezone VARCHAR(50) DEFAULT 'Europe/Rome',
  
  -- Fuori orario
  out_of_hours_action VARCHAR(20) DEFAULT 'voicemail',
  -- 'voicemail' | 'message' | 'transfer' | 'reject'
  
  -- Limiti
  max_concurrent_calls INTEGER DEFAULT 5,
  max_call_duration_minutes INTEGER DEFAULT 30,
  
  -- Stato
  is_active BOOLEAN DEFAULT true,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_voice_numbers_phone ON voice_numbers(phone_number);
CREATE INDEX idx_voice_numbers_consultant ON voice_numbers(consultant_id);
```

### 4.4 Nuova Tabella: `voice_rate_limits` (Anti-Abuso)

```sql
CREATE TABLE voice_rate_limits (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  
  caller_id VARCHAR(20) NOT NULL,
  
  -- Contatori (rolling window)
  calls_last_minute INTEGER DEFAULT 0,
  calls_last_hour INTEGER DEFAULT 0,
  calls_today INTEGER DEFAULT 0,
  total_minutes_today DECIMAL(10,2) DEFAULT 0,
  
  -- Timestamp
  last_call_at TIMESTAMP,
  first_call_today TIMESTAMP,
  
  -- Stato
  is_blocked BOOLEAN DEFAULT false,
  blocked_reason TEXT,
  blocked_until TIMESTAMP,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_voice_rate_limits_caller ON voice_rate_limits(caller_id);
```

### 4.5 Entity Relationship Diagram

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
        │                   │ telephony_mins  │
        │                   │ ai_cost_est     │
        │                   └─────────────────┘
        │                           │
        │                           ▼
        │                   ┌─────────────────┐
        │                   │ai_conversations │
        │                   └─────────────────┘
        │
        │                   ┌─────────────────┐
        └───────────────────┤ voice_numbers   │
                           ├─────────────────┤
                           │ phone_number    │
                           │ consultant_id   │
                           │ greeting_text   │
                           │ fallback_number │
                           └─────────────────┘
                           
                           ┌─────────────────┐
                           │voice_rate_limits│
                           ├─────────────────┤
                           │ caller_id       │
                           │ calls_last_min  │
                           │ is_blocked      │
                           └─────────────────┘
```

---

## 5. Backend

### 5.1 Struttura Directory (VPS Hostinger)

```
/opt/alessia-voice/
├── src/
│   ├── index.ts                    # Entry point
│   ├── config.ts                   # Environment config
│   ├── esl/
│   │   └── voice-esl-client.ts     # Connessione ESL (127.0.0.1)
│   ├── audio/
│   │   └── voice-audio-handler.ts  # Conversione, /dev/shm
│   ├── calls/
│   │   ├── voice-call-manager.ts   # State machine
│   │   ├── voice-caller-lookup.ts  # Caller ID → Cliente
│   │   └── voice-rate-limiter.ts   # Anti-abuso
│   ├── ai/
│   │   └── voice-gemini-bridge.ts  # Ponte Gemini Live
│   ├── routes/
│   │   └── voice-routes.ts         # API REST
│   └── health/
│       └── voice-health.ts         # Health checks
├── package.json
├── tsconfig.json
└── .env
```

### 5.2 ESL Client (`voice-esl-client.ts`)

```typescript
import { Connection } from 'modesl';

interface ESLConfig {
  host: string;      // '127.0.0.1' - SEMPRE localhost
  port: number;      // 8021
  password: string;  // Password lunga random
}

class VoiceESLClient {
  private connection: Connection | null = null;
  private isConnected: boolean = false;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 10;
  
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
  
  // Health
  async ping(): Promise<boolean>;
  getConnectionState(): 'connected' | 'disconnected' | 'reconnecting';
}
```

### 5.3 Audio Handler (`voice-audio-handler.ts`)

```typescript
interface AudioConfig {
  tempDir: string;           // '/dev/shm/alessia' - RAM disk per bassa latenza
  recordingsDir: string;     // '/var/lib/alessia/voice_recordings' - persistente
}

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
  async processOutgoingAudio(geminiAudio: Buffer): Promise<string>;
  
  // VAD
  detectSpeechEnd(samples: Buffer): boolean;
  
  // Cleanup
  async cleanupTempFiles(): Promise<void>;
}
```

### 5.4 Rate Limiter (`voice-rate-limiter.ts`)

```typescript
interface RateLimitConfig {
  maxCallsPerMinute: number;     // 3
  maxCallsPerHour: number;       // 20
  maxCallsPerDay: number;        // 50
  maxMinutesPerDay: number;      // 120
  maxCallDuration: number;       // 1800 (30 min)
  blockAnonymous: boolean;       // true
  blockedPrefixes: string[];     // ['+1900', '+44870']
}

interface RateLimitResult {
  allowed: boolean;
  reason?: string;
  waitSeconds?: number;
}

class VoiceRateLimiter {
  async checkLimit(callerId: string): Promise<RateLimitResult>;
  async recordCall(callerId: string, durationSeconds: number): Promise<void>;
  async blockCaller(callerId: string, reason: string, hours: number): Promise<void>;
  async unblockCaller(callerId: string): Promise<void>;
  async getCallerStats(callerId: string): Promise<CallerStats>;
}
```

### 5.5 Health Check (`voice-health.ts`)

```typescript
interface HealthStatus {
  overall: 'healthy' | 'degraded' | 'unhealthy';
  components: {
    esl: ComponentHealth;
    freeswitch: ComponentHealth;
    gemini: ComponentHealth;
    database: ComponentHealth;
    storage: ComponentHealth;
  };
  metrics: {
    activeCallsCount: number;
    callsLast5Min: number;
    avgLatencyMs: number;
  };
}

interface ComponentHealth {
  status: 'up' | 'down' | 'degraded';
  latencyMs?: number;
  lastCheck: Date;
  error?: string;
}

class VoiceHealth {
  // Verifica singoli componenti
  async checkESL(): Promise<ComponentHealth>;
  async checkFreeSWITCH(): Promise<ComponentHealth>;
  async checkGemini(): Promise<ComponentHealth>;
  async checkDatabase(): Promise<ComponentHealth>;
  async checkStorage(): Promise<ComponentHealth>;
  
  // Verifica completa
  async getFullHealth(): Promise<HealthStatus>;
  
  // Codec check
  async verifyCodecHandshake(): Promise<boolean>;
}
```

### 5.6 Voice Routes (`voice-routes.ts`)

```typescript
// GET /api/voice/health
// Stato completo di tutti i componenti
// Response: HealthStatus

// GET /api/voice/status
// Stato connessione ESL + chiamate attive
// Response: { eslConnected, activeCalls[], uptime }

// GET /api/voice/calls
// Lista chiamate con filtri
// Query: ?from=date&to=date&status=completed&client_id=xxx
// Response: { calls[], total, page, limit }

// GET /api/voice/calls/:id
// Dettaglio singola chiamata con eventi
// Response: { call, events[] }

// GET /api/voice/calls/:id/audio
// Stream audio registrazione
// Response: audio/wav

// GET /api/voice/stats
// Statistiche aggregate
// Query: ?period=day|week|month
// Response: { totalCalls, avgDuration, outcomes{}, costEstimate }

// POST /api/voice/config
// Aggiornamento configurazione numero
// Body: { greeting_text, fallback_number, ... }

// GET /api/voice/rate-limits/:callerId
// Stato rate limit per numero
// Response: RateLimitStats

// POST /api/voice/block/:callerId
// Blocca numero manualmente
// Body: { reason, hours }

// DELETE /api/voice/block/:callerId
// Sblocca numero
```

---

## 6. Frontend

### 6.1 Dashboard Chiamate Vocali (`/consultant/voice-calls`)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  📞 Chiamate Vocali                                    [⚙️ Config] [🔄 5s] │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  STATO SISTEMA                                          🟢 Online   │   │
│  │  ┌───────────┐  ┌───────────┐  ┌───────────┐  ┌───────────┐       │   │
│  │  │ ESL       │  │ FreeSWITCH│  │  Gemini   │  │    DB     │       │   │
│  │  │ 🟢 12ms   │  │ 🟢 OK     │  │ 🟢 45ms   │  │ 🟢 8ms    │       │   │
│  │  └───────────┘  └───────────┘  └───────────┘  └───────────┘       │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  STATISTICHE OGGI                                                   │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────┐│   │
│  │  │    12    │  │   8m 23s │  │    85%   │  │    2     │  │  €3.40 ││   │
│  │  │ Chiamate │  │ Durata ⌀ │  │ Complete │  │ Attive   │  │ Costo  ││   │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘  └────────┘│   │
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
│  │  │ 09:30        │ Anonymous     │ —            │ 00:00  │ 🚫     │ │   │
│  │  └───────────────────────────────────────────────────────────────┘ │   │
│  │                                                      Pagina 1 di 5  │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

Legenda esiti:
✅ = Completata con successo
📲 = Trasferita a operatore
📭 = Voicemail
🚫 = Bloccata (rate limit / anonimo)
❌ = Fallita/Abbandonata
```

### 6.2 Dettaglio Chiamata (`/consultant/voice-calls/:id`)

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
│  │                                 │  ┌─────────────────────────────────┐  │
│  │  💰 COSTI                       │  │  TIMELINE EVENTI                │  │
│  │  Minuti telefonia: 5.38         │  │                                 │  │
│  │  Token AI: 1,245                │  │  14:32:00 │ 📞 Chiamata in arr. │  │
│  │  Costo stimato: €0.28           │  │  14:32:02 │ ✅ Risposta         │  │
│  │                                 │  │  14:32:03 │ 🎵 Saluto iniziale  │  │
│  └─────────────────────────────────┘  │  14:32:15 │ 🎤 Utente parla    │  │
│                                       │  14:32:28 │ 🤖 AI risponde     │  │
│                                       │  14:37:25 │ 📴 Fine chiamata   │  │
│                                       └─────────────────────────────────┘  │
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
│  │  ...                                                                │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 6.3 Configurazione Telefonia (`/consultant/settings/voice`)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  ⚙️ Configurazione Telefonia                                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  CONNESSIONE FREESWITCH                                    🟢 Online│   │
│  │                                                                     │   │
│  │  Host:     vps123.hostinger.com (127.0.0.1 interno)                │   │
│  │  Porta:    8021 (ESL locale)                                       │   │
│  │  Latenza:  12ms                                                    │   │
│  │                                                     [Test Connessione]│   │
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
│  │  🛡️ ANTI-ABUSO                                                     │   │
│  │                                                                     │   │
│  │  Max chiamate/minuto per numero: ┌───┐                             │   │
│  │                                  │ 3 │                             │   │
│  │                                  └───┘                             │   │
│  │  Max durata chiamata: ┌────┐ minuti                                │   │
│  │                       │ 30 │                                       │   │
│  │                       └────┘                                       │   │
│  │  ☑ Blocca chiamate anonime                                        │   │
│  │  ☑ Blocca prefissi internazionali sospetti                        │   │
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

### 6.4 Componenti React Nuovi

| Componente | Descrizione |
|------------|-------------|
| `VoiceCallsDashboard.tsx` | Dashboard con stats, health, lista chiamate |
| `VoiceSystemHealth.tsx` | Stato ESL, FreeSWITCH, Gemini, DB |
| `VoiceCallsTable.tsx` | Tabella con sorting, filtering, pagination |
| `VoiceCallDetail.tsx` | Dettaglio singola chiamata |
| `VoiceCallTranscript.tsx` | Visualizzatore trascrizione |
| `VoiceCallTimeline.tsx` | Timeline eventi chiamata |
| `VoiceSettings.tsx` | Form configurazione |
| `VoiceAntiAbuseSettings.tsx` | Configurazione rate limits |
| `ActiveCallsBadge.tsx` | Indicatore chiamate real-time |

---

## 7. Flusso Chiamata

### 7.1 Sequenza Completa

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                              SEQUENCE DIAGRAM - CHIAMATA IN INGRESSO                    │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│  Telefono   FreeSWITCH   RateLimiter   ESL Client    Call Manager   Gemini     DB      │
│     │           │            │             │              │            │        │       │
│     │──INVITE──►│            │             │              │            │        │       │
│     │           │──CHANNEL───────────────►│              │            │        │       │
│     │           │  _CREATE   │             │              │            │        │       │
│     │           │            │◄─checkLimit─│              │            │        │       │
│     │           │            │             │              │            │        │       │
│     │           │            │─allowed?────►              │            │        │       │
│     │           │            │             │              │            │        │       │
│     │           │            │    [SE BLOCCATO: hangup + log]         │        │       │
│     │           │            │             │              │            │        │       │
│     │           │◄──answer───┼─────────────│              │            │        │       │
│     │◄─200 OK───│            │             │              │            │        │       │
│     │           │            │             │──newCall────►│            │        │       │
│     │           │            │             │              │──insert───►│        │       │
│     │           │            │             │              │            │◄──ok───│       │
│     │           │            │             │              │            │        │       │
│     │           │            │             │              │──session──►│        │       │
│     │           │            │             │              │◄─sessionId─│        │       │
│     │           │            │             │              │            │        │       │
│     │           │◄─playback──┼─────────────│              │            │        │       │
│     │◄─"Ciao.."─│  (greeting)│             │              │            │        │       │
│     │           │            │             │              │            │        │       │
│     │─"Vorrei.."────────────────────────►│              │            │        │       │
│     │           │            │             │──audio──────►│            │        │       │
│     │           │            │             │              │─toGemini──►│        │       │
│     │           │            │             │              │◄─response──│        │       │
│     │           │            │             │              │            │        │       │
│     │           │            │             │◄─saveWAV─────│            │        │       │
│     │           │◄─broadcast─┼─────────────│              │            │        │       │
│     │◄─"Certo.."│            │             │              │            │        │       │
│     │           │            │             │              │            │        │       │
│     │   ...     │    ...     │    ...      │     ...      │    ...     │   ...  │       │
│     │           │            │             │              │            │        │       │
│     │──BYE─────►│            │             │              │            │        │       │
│     │           │──HANGUP────────────────►│              │            │        │       │
│     │           │            │             │──endCall────►│            │        │       │
│     │           │            │◄─recordCall─│              │            │        │       │
│     │           │            │             │              │──update───►│        │       │
│     │           │            │             │              │            │        │       │
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
                   │        [rate limit check]
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

## 8. Sicurezza

### 8.1 ESL Security (CRITICO)

> ⚠️ **ESL = Controllo totale delle chiamate**. Se compromesso, un attaccante può:
> - Ascoltare tutte le chiamate
> - Trasferire chiamate a numeri premium
> - Generare costi enormi

**Configurazione obbligatoria FreeSWITCH** (`/etc/freeswitch/autoload_configs/event_socket.conf.xml`):

```xml
<configuration name="event_socket.conf" description="Socket Client">
  <settings>
    <!-- SOLO localhost - MAI 0.0.0.0 -->
    <param name="listen-ip" value="127.0.0.1"/>
    <param name="listen-port" value="8021"/>
    
    <!-- Password lunga random (minimo 32 caratteri) -->
    <param name="password" value="$(ESL_PASSWORD)"/>
    
    <!-- ACL restrittiva -->
    <param name="apply-inbound-acl" value="loopback.auto"/>
  </settings>
</configuration>
```

**Firewall (iptables)**:
```bash
# Blocca ESL dall'esterno
iptables -A INPUT -p tcp --dport 8021 -s 127.0.0.1 -j ACCEPT
iptables -A INPUT -p tcp --dport 8021 -j DROP
```

### 8.2 Codec Forcing (OBBLIGATORIO)

**SIP Profile** (`/etc/freeswitch/sip_profiles/external.xml`):

```xml
<param name="inbound-codec-prefs" value="PCMU"/>
<param name="outbound-codec-prefs" value="PCMU"/>
<param name="codec-prefs" value="PCMU"/>
```

**Perché**: Se non forzato, alcuni carrier inviano ALAW o altri codec che Gemini non gestisce correttamente.

### 8.3 Storage Sicuro

| Tipo File | Path | Permessi |
|-----------|------|----------|
| Chunk temporanei | `/dev/shm/alessia/` | 700 (solo processo Node) |
| Registrazioni | `/var/lib/alessia/voice_recordings/` | 750 |
| Logs | `/var/log/alessia/` | 640 |

**Cleanup automatico**:
```bash
# Cron job: pulisci chunk temp ogni 5 minuti
*/5 * * * * find /dev/shm/alessia -type f -mmin +10 -delete

# Cron job: comprimi registrazioni vecchie di 7 giorni
0 3 * * * find /var/lib/alessia/voice_recordings -name "*.wav" -mtime +7 -exec gzip {} \;
```

---

## 9. Anti-Abuso e Rate Limiting

### 9.1 Limiti Default

| Parametro | Valore | Descrizione |
|-----------|--------|-------------|
| `max_calls_per_minute` | 3 | Per singolo numero chiamante |
| `max_calls_per_hour` | 20 | Per singolo numero chiamante |
| `max_calls_per_day` | 50 | Per singolo numero chiamante |
| `max_minutes_per_day` | 120 | Minuti totali per numero |
| `max_call_duration` | 1800s | 30 minuti max per chiamata |
| `block_anonymous` | true | Rifiuta Caller ID nascosto |

### 9.2 Prefissi Bloccati

```typescript
const BLOCKED_PREFIXES = [
  '+1900',     // USA premium
  '+44870',    // UK premium
  '+44871',    // UK premium
  '+44872',    // UK premium
  '+39199',    // Italia premium
  '+39892',    // Italia premium
  '+39899',    // Italia premium
];
```

### 9.3 Comportamento Rate Limit

```
┌──────────────────────────────────────────────────────────────────────┐
│                        RATE LIMIT FLOW                               │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  Chiamata in arrivo                                                  │
│         │                                                            │
│         ▼                                                            │
│  ┌──────────────┐                                                    │
│  │ Caller ID?   │──NO──► Rifiuta + Log "anonymous_blocked"          │
│  └──────┬───────┘                                                    │
│         │ SI                                                         │
│         ▼                                                            │
│  ┌──────────────┐                                                    │
│  │ Prefisso OK? │──NO──► Rifiuta + Log "blocked_prefix"             │
│  └──────┬───────┘                                                    │
│         │ SI                                                         │
│         ▼                                                            │
│  ┌──────────────┐                                                    │
│  │ In blacklist?│──SI──► Rifiuta + Log "blacklisted"                │
│  └──────┬───────┘                                                    │
│         │ NO                                                         │
│         ▼                                                            │
│  ┌──────────────┐                                                    │
│  │ < 3 call/min?│──NO──► Rifiuta + Log "rate_limit_minute"          │
│  └──────┬───────┘                                                    │
│         │ SI                                                         │
│         ▼                                                            │
│  ┌──────────────┐                                                    │
│  │ < 20 call/h? │──NO──► Rifiuta + Log "rate_limit_hour"            │
│  └──────┬───────┘                                                    │
│         │ SI                                                         │
│         ▼                                                            │
│  ┌──────────────┐                                                    │
│  │< 120 min/day?│──NO──► Rifiuta + Log "daily_limit"                │
│  └──────┬───────┘                                                    │
│         │ SI                                                         │
│         ▼                                                            │
│     ✅ ACCETTA                                                       │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 10. Requisiti Tecnici

### 10.1 Infrastruttura VPS (TUO COMPITO)

| Componente | Requisito |
|------------|-----------|
| **VPS** | Ubuntu 22.04, IP pubblico statico, 2+ vCPU, 4GB+ RAM |
| **FreeSWITCH** | Versione 1.10.x, installato e funzionante |
| **SIP Trunk** | Provider italiano (Messagenet o simile), numero DID |
| **Porte Firewall** | 5060/UDP (SIP), 16384-32768/UDP (RTP) |
| **ESL** | Bind su 127.0.0.1:8021, password 32+ caratteri |
| **NAT** | `external_sip_ip` e `external_rtp_ip` configurati |
| **Codec** | PCMU forzato in SIP profile |

### 10.2 Software Voice Backend (MIO COMPITO)

| Componente | Tecnologia |
|------------|------------|
| **ESL Client** | `modesl` npm package |
| **Audio Processing** | Custom μ-law codec, resampling |
| **Database** | PostgreSQL (Supabase) via HTTPS |
| **API** | Express.js REST |
| **Health Monitoring** | Custom health checks |

### 10.3 Environment Variables (VPS)

```bash
# ═══════════════════════════════════════════════════════════════════
# CONNESSIONE ESL (locale)
# ═══════════════════════════════════════════════════════════════════
FREESWITCH_ESL_HOST=127.0.0.1
FREESWITCH_ESL_PORT=8021
FREESWITCH_ESL_PASSWORD=your-very-long-random-password-min-32-chars

# ═══════════════════════════════════════════════════════════════════
# DATABASE (remoto)
# ═══════════════════════════════════════════════════════════════════
DATABASE_URL=postgresql://user:pass@db.supabase.co:5432/postgres

# ═══════════════════════════════════════════════════════════════════
# GEMINI API
# ═══════════════════════════════════════════════════════════════════
GOOGLE_AI_API_KEY=Providery factory o quella che usiamo normalmente
GEMINI_MODEL=Il modello che usiamo per gemini live

# ═══════════════════════════════════════════════════════════════════
# NUMERI
# ═══════════════════════════════════════════════════════════════════
VOICE_DID_NUMBER=+390212345678
VOICE_FALLBACK_NUMBER=+393339999999

# ═══════════════════════════════════════════════════════════════════
# COMPORTAMENTO
# ═══════════════════════════════════════════════════════════════════
VOICE_GREETING_TEXT=Buongiorno, sono Alessia. Come posso aiutarti?
VOICE_SILENCE_TIMEOUT=10
VOICE_MAX_DURATION=1800

# ═══════════════════════════════════════════════════════════════════
# STORAGE (locale VPS)
# ═══════════════════════════════════════════════════════════════════
VOICE_TEMP_DIR=/dev/shm/alessia
VOICE_RECORDINGS_DIR=/var/lib/alessia/voice_recordings
VOICE_LOGS_DIR=/var/log/alessia

# ═══════════════════════════════════════════════════════════════════
# RATE LIMITING
# ═══════════════════════════════════════════════════════════════════
VOICE_MAX_CALLS_PER_MINUTE=3
VOICE_MAX_CALLS_PER_HOUR=20
VOICE_MAX_CALLS_PER_DAY=50
VOICE_MAX_MINUTES_PER_DAY=120
VOICE_BLOCK_ANONYMOUS=true
```

---

## 11. Divisione Responsabilità

### 11.1 TU (Infrastruttura/Telecom)

| # | Task | Deliverable |
|---|------|-------------|
| 1 | Acquisto numero VoIP | Credenziali SIP, DID italiano |
| 2 | Setup VPS Hostinger | IP pubblico, 4GB RAM, Ubuntu 22.04 |
| 3 | Installazione FreeSWITCH | FreeSWITCH 1.10.x running |
| 4 | Configurazione SIP trunk | Chiamate inbound funzionanti |
| 5 | **Codec forcing PCMU** | SIP profile con `inbound-codec-prefs=PCMU` |
| 6 | Dialplan `ai_support` | Context per routing AI |
| 7 | **ESL sicuro** | Bind 127.0.0.1, password 32+ char, firewall |
| 8 | Creazione directory | `/var/lib/alessia/`, `/dev/shm/alessia/` |
| 9 | Test chiamata base | Chiamata → risponde → riattacca |

### 11.2 IO (Programmatore/Node)

| # | Task | Deliverable |
|---|------|-------------|
| 1 | Schema DB (voice_calls, voice_numbers, voice_rate_limits) | Migrazione database |
| 2 | ESL Client | Connessione locale + event handlers |
| 3 | Rate Limiter | Anti-abuso completo |
| 4 | Caller Lookup | Riconoscimento clienti |
| 5 | Audio Handler | Conversione μ-law ↔ PCM, /dev/shm |
| 6 | Gemini Bridge | Integrazione con AI |
| 7 | Call Manager | State machine + logging |
| 8 | Health Check | Verifica ESL, FreeSWITCH, Gemini, codec |
| 9 | Voice Routes | API monitoring |
| 10 | Frontend Dashboard | UI gestione chiamate |
| 11 | Frontend Settings | Configurazione telefonia |

### 11.3 Checklist Pre-Produzione

| Check | Chi | Stato |
|-------|-----|-------|
| ESL bind su 127.0.0.1 | TU | ⬜ |
| Password ESL 32+ char | TU | ⬜ |
| Firewall ESL chiuso | TU | ⬜ |
| Codec PCMU forzato | TU | ⬜ |
| Directory /var/lib/alessia create | TU | ⬜ |
| Rate limiter testato | IO | ⬜ |
| Health check funzionante | IO | ⬜ |
| Chiamata test E2E | INSIEME | ⬜ |

---

## 12. Timeline

### Fase 1: Setup Infrastruttura (1-2 giorni)
**TU**: VPS + FreeSWITCH + SIP trunk + ESL sicuro + codec forcing  
**IO**: Schema DB + struttura progetto VPS

### Fase 2: Connessione (1 giorno)
**TU**: ESL testato da locale  
**IO**: ESL Client funzionante + Health checks

### Fase 3: Audio + Rate Limiting (1-2 giorni)
**TU**: Dialplan `ai_support`  
**IO**: Audio handler + Rate limiter + Gemini bridge

### Fase 4: Integrazione (1 giorno)
**INSIEME**: Test end-to-end chiamata → rate check → AI risponde

### Fase 5: UI (1-2 giorni)
**IO**: Dashboard + Settings frontend

### Fase 6: Security Review + Polish (1 giorno)
**INSIEME**: Penetration test ESL, bug fixing, ottimizzazioni

---

## 13. Appendici

### Appendice A: Comandi ESL Utili

```bash
# Rispondere alla chiamata
uuid_answer <uuid>

# Riprodurre audio
uuid_broadcast <uuid> /var/lib/alessia/responses/greeting.wav aleg

# Registrare audio
uuid_record <uuid> start /var/lib/alessia/voice_recordings/call_123.wav

# Trasferire chiamata
uuid_transfer <uuid> <destination> XML default

# Terminare chiamata
uuid_kill <uuid> NORMAL_CLEARING

# Ottenere variabili
uuid_getvar <uuid> Caller-Caller-ID-Number

# Verificare codec
uuid_getvar <uuid> read_codec
uuid_getvar <uuid> write_codec
```

### Appendice B: Formato Audio

#### G.711 μ-law (PCMU)
- Sample rate: 8000 Hz
- Bit depth: 8-bit companded
- Bitrate: 64 kbps
- Standard PSTN

#### PCM Linear16 (per Gemini)
- Sample rate: 16000 Hz (input) / 24000 Hz (output)
- Bit depth: 16-bit signed little-endian
- Canali: Mono

#### Conversione
```
Ingresso: μ-law 8k → upsample → PCM16 16k → Gemini
Uscita:   Gemini → PCM 24k → downsample → PCM 8k → μ-law → FreeSWITCH
```

### Appendice C: Health Check Response Example

```json
{
  "overall": "healthy",
  "components": {
    "esl": {
      "status": "up",
      "latencyMs": 12,
      "lastCheck": "2026-01-31T14:30:00Z"
    },
    "freeswitch": {
      "status": "up",
      "codec": "PCMU",
      "channels": 2,
      "lastCheck": "2026-01-31T14:30:00Z"
    },
    "gemini": {
      "status": "up",
      "latencyMs": 45,
      "model": "gemini-2.0-flash-live",
      "lastCheck": "2026-01-31T14:30:00Z"
    },
    "database": {
      "status": "up",
      "latencyMs": 8,
      "lastCheck": "2026-01-31T14:30:00Z"
    },
    "storage": {
      "status": "up",
      "tempFreeBytes": 1073741824,
      "recordingsFreeBytes": 10737418240,
      "lastCheck": "2026-01-31T14:30:00Z"
    }
  },
  "metrics": {
    "activeCallsCount": 2,
    "callsLast5Min": 5,
    "avgLatencyMs": 65
  }
}
```

---

**Fine Documento - Versione 2.0 Production-Ready**
