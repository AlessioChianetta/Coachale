# RDP - Voice Bridge per Alessia AI Phone
## Requirements, Design, Plan

**Data:** 2026-01-31  
**Versione:** 1.0  
**Autore:** Agent  

---

## 1. REQUIREMENTS (Requisiti)

### 1.1 Obiettivo
Creare un bridge audio che colleghi FreeSWITCH a Gemini 2.5 Flash Native Audio, permettendo chiamate telefoniche con l'AI Assistant Alessia.

### 1.2 Requisiti Funzionali

| ID | Requisito | Priorità |
|----|-----------|----------|
| RF-01 | Ricevere audio da FreeSWITCH via mod_audio_stream (WebSocket) | MUST |
| RF-02 | Convertire audio μ-law 8kHz → PCM 16kHz per Gemini | MUST |
| RF-03 | Inviare audio a Gemini 2.5 Flash Native Audio API | MUST |
| RF-04 | Ricevere risposta vocale da Gemini (PCM 24kHz) | MUST |
| RF-05 | Convertire audio PCM 24kHz → μ-law 8kHz per FreeSWITCH | MUST |
| RF-06 | Gestire sessioni chiamata (start/stop/timeout) | MUST |
| RF-07 | Riconoscere caller_id e caricare context cliente | SHOULD |
| RF-08 | Autenticazione token per connessioni remote | SHOULD |
| RF-09 | Logging dettagliato (bytes in/out, latenza) | MUST |
| RF-10 | Rate limiting per prevenire abusi | COULD |

### 1.3 Requisiti Non-Funzionali

| ID | Requisito | Target |
|----|-----------|--------|
| RNF-01 | Latenza end-to-end | < 300ms |
| RNF-02 | Uptime | 99.9% |
| RNF-03 | Chiamate concorrenti | 10+ |
| RNF-04 | Memoria per chiamata | < 50MB |
| RNF-05 | CPU per chiamata | < 10% |

### 1.4 Vincoli Tecnici

- **VPS Hostinger**: 4GB RAM, 2 vCPU
- **Node.js**: v20.20.0
- **FreeSWITCH**: Docker container con mod_audio_stream
- **Gemini API**: gemini-2.5-flash-native-audio-preview
- **Porta 9090**: WebSocket server (0.0.0.0 per accesso remoto)
- **Porta 8021**: ESL solo localhost

---

## 2. DESIGN (Architettura)

### 2.1 Diagramma Architetturale

**Architettura semplificata: riusa il WebSocket Replit esistente (/ws/ai-voice)**

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              VPS HOSTINGER                                  │
│                                                                             │
│  ┌───────────────┐                      ┌───────────────────────────────┐  │
│  │               │    mod_audio_stream  │      VOICE BRIDGE             │  │
│  │  FreeSWITCH   │◄────────────────────►│      (Proxy/Converter)        │  │
│  │               │    ws://127.0.0.1    │                               │  │
│  │  - SIP/RTP    │        :9090         │  ┌─────────────────────────┐  │  │
│  │  - Dialplan   │                      │  │  voice-bridge-server.ts │  │  │
│  │  - Codec      │                      │  │  - WebSocket Server     │  │  │
│  │               │                      │  │  - Session Manager      │  │  │
│  └───────────────┘                      │  │  - Audio Converter      │  │  │
│         │                               │  └───────────┬─────────────┘  │  │
│         │ ESL                           │              │                 │  │
│         │ 8021                          │  ┌───────────▼─────────────┐  │  │
│         │ (localhost)                   │  │  replit-ws-client.ts    │  │  │
│         │                               │  │  - Connette a Replit    │  │  │
│         │                               │  │  - Stesso protocollo    │  │  │
│         │                               │  │    del browser          │  │  │
│         │                               │  └───────────┬─────────────┘  │  │
│         │                               │              │                 │  │
│         │                               └──────────────┼─────────────────┘  │
│         │                                              │                    │
└─────────┼──────────────────────────────────────────────┼────────────────────┘
          │                                              │
          │                                              │ WSS
          │                                              ▼
          │                               ┌───────────────────────────────┐
          │                               │        REPLIT                 │
          │                               │                               │
          │                               │  ┌─────────────────────────┐  │
          │                               │  │  /ws/ai-voice           │  │
          │                               │  │  gemini-live-ws-service │  │
          │                               │  │  (codice esistente)     │  │
          │                               │  └───────────┬─────────────┘  │
          │                               │              │                 │
          │                               │              ▼                 │
          │                               │  ┌─────────────────────────┐  │
          │                               │  │  Vertex AI / Gemini     │  │
          │                               │  │  Live API               │  │
          │                               │  └─────────────────────────┘  │
          │                               │                               │
          │                               └───────────────────────────────┘
          │
          ▼
    ┌───────────────┐
    │   TELEFONO    │
    │   (Cliente)   │
    │   SIP/PSTN    │
    └───────────────┘
```

**Vantaggi di questa architettura:**
- Riusa esattamente lo stesso codice AI del browser
- Nessuna duplicazione di logica Gemini
- Stesso comportamento, stessa voce, stesso context
- Il bridge VPS è solo un "traduttore" audio

### 2.2 Flusso Chiamata

```
┌──────────┐    ┌────────────┐    ┌─────────────┐    ┌──────────────┐    ┌─────────┐
│ Telefono │    │ FreeSWITCH │    │ Voice Bridge│    │Audio Convert │    │ Gemini  │
└────┬─────┘    └─────┬──────┘    └──────┬──────┘    └──────┬───────┘    └────┬────┘
     │                │                   │                  │                 │
     │  INVITE        │                   │                  │                 │
     │───────────────►│                   │                  │                 │
     │                │                   │                  │                 │
     │  200 OK        │                   │                  │                 │
     │◄───────────────│                   │                  │                 │
     │                │                   │                  │                 │
     │                │ WS Connect        │                  │                 │
     │                │──────────────────►│                  │                 │
     │                │                   │                  │                 │
     │                │                   │ Setup Gemini     │                 │
     │                │                   │──────────────────┼────────────────►│
     │                │                   │                  │                 │
     │  RTP Audio     │                   │                  │                 │
     │───────────────►│                   │                  │                 │
     │                │ μ-law 8kHz        │                  │                 │
     │                │──────────────────►│                  │                 │
     │                │                   │ μ-law → PCM 16k  │                 │
     │                │                   │─────────────────►│                 │
     │                │                   │                  │ Audio IN        │
     │                │                   │                  │────────────────►│
     │                │                   │                  │                 │
     │                │                   │                  │ Audio OUT 24k   │
     │                │                   │                  │◄────────────────│
     │                │                   │ PCM 24k → μ-law  │                 │
     │                │                   │◄─────────────────│                 │
     │                │ μ-law 8kHz        │                  │                 │
     │                │◄──────────────────│                  │                 │
     │  RTP Audio     │                   │                  │                 │
     │◄───────────────│                   │                  │                 │
     │                │                   │                  │                 │
```

### 2.3 Struttura File

```
vps-voice-bridge/
├── src/
│   ├── index.ts                 # Entry point
│   ├── voice-bridge-server.ts   # WebSocket server principale
│   ├── audio-converter.ts       # Conversioni audio
│   ├── replit-ws-client.ts      # Client WebSocket Replit (riusa /ws/ai-voice)
│   ├── caller-context.ts        # Notifiche a Replit API
│   ├── session-manager.ts       # Gestione sessioni chiamata
│   ├── logger.ts                # Logging strutturato
│   └── config.ts                # Configurazione
├── freeswitch/
│   ├── dialplan-9999.xml        # Dialplan per AI
│   └── modules-check.md         # Guida verifica mod_audio_stream
├── systemd/
│   └── alessia-voice.service    # Unit systemd
├── package.json
├── tsconfig.json
├── .env.example
├── DEPLOY.md                    # Guida deployment
└── RDP.md                       # Questo documento
```

### 2.4 Formato Audio mod_audio_stream

**Input da FreeSWITCH:**
- Formato: μ-law (G.711u) o PCM L16
- Sample rate: 8000 Hz
- Channels: 1 (mono)
- Frame size: 20ms (160 samples)
- WebSocket frame: Binary con header metadata

**Output verso FreeSWITCH:**
- Stesso formato dell'input
- Buffering per smooth playback

### 2.5 Formato Audio Gemini

**Input verso Gemini:**
- Formato: PCM 16-bit little-endian
- Sample rate: 16000 Hz
- Channels: 1 (mono)
- Encoding: base64 in JSON

**Output da Gemini:**
- Formato: PCM 16-bit little-endian
- Sample rate: 24000 Hz
- Channels: 1 (mono)
- Encoding: base64 in JSON

### 2.6 Gestione Sessioni

```typescript
interface CallSession {
  id: string;                    // UUID sessione
  callId: string;                // Call-ID FreeSWITCH
  callerId: string;              // Numero chiamante
  calledNumber: string;          // Numero chiamato
  startTime: Date;               // Inizio chiamata
  state: 'connecting' | 'active' | 'ending' | 'ended';
  fsWebSocket: WebSocket;        // Connessione FreeSWITCH
  geminiWebSocket: WebSocket;    // Connessione Gemini
  clientContext?: ClientContext; // Context cliente (se riconosciuto)
  audioStats: {
    bytesIn: number;
    bytesOut: number;
    packetsIn: number;
    packetsOut: number;
    lastActivityTime: Date;
  };
}
```

### 2.7 Protocollo mod_audio_stream

**Messaggio Start (da FreeSWITCH):**
```json
{
  "event": "start",
  "call_id": "abc123",
  "caller_id": "+393331234567",
  "called_number": "9999",
  "codec": "PCMU",
  "sample_rate": 8000
}
```

**Messaggio Audio (bidirezionale):**
```
Binary frame: raw audio bytes (μ-law or PCM)
```

**Messaggio Stop (da FreeSWITCH):**
```json
{
  "event": "stop",
  "call_id": "abc123",
  "reason": "hangup"
}
```

---

## 3. PLAN (Piano di Implementazione)

### 3.1 Task Breakdown

| # | Task | File | Dipendenze | Stima |
|---|------|------|------------|-------|
| 1 | Setup progetto (package.json, tsconfig, .env) | vari | - | ✅ FATTO |
| 2 | Config e Logger | config.ts, logger.ts | 1 | 15 min |
| 3 | Audio Converter (μ-law ↔ PCM, resampling) | audio-converter.ts | 1 | 30 min |
| 4 | Session Manager | session-manager.ts | 2 | 20 min |
| 5 | Gemini Client | gemini-client.ts | 2, 3 | 45 min |
| 6 | Caller Context (Replit API) | caller-context.ts | 2 | 20 min |
| 7 | Voice Bridge Server | voice-bridge-server.ts | 3, 4, 5, 6 | 60 min |
| 8 | Entry Point | index.ts | 7 | 10 min |
| 9 | Dialplan FreeSWITCH | freeswitch/dialplan-9999.xml | - | 10 min |
| 10 | Guida mod_audio_stream | freeswitch/modules-check.md | - | 15 min |
| 11 | Systemd Unit | systemd/alessia-voice.service | - | 10 min |
| 12 | Guida Deploy | DEPLOY.md | 9, 10, 11 | 30 min |

**Tempo totale stimato:** ~4 ore

### 3.2 Ordine di Implementazione

```
Phase 1: Fondamenta
├── config.ts
├── logger.ts
└── audio-converter.ts

Phase 2: Core Components
├── session-manager.ts
├── gemini-client.ts
└── caller-context.ts

Phase 3: Integration
├── voice-bridge-server.ts
└── index.ts

Phase 4: Deployment
├── freeswitch/dialplan-9999.xml
├── freeswitch/modules-check.md
├── systemd/alessia-voice.service
└── DEPLOY.md
```

### 3.3 Rischi e Mitigazioni

| Rischio | Probabilità | Impatto | Mitigazione |
|---------|-------------|---------|-------------|
| mod_audio_stream non presente | Media | Alto | Guida rebuild immagine Docker |
| Latenza > 300ms | Bassa | Medio | Buffering ottimizzato, VPS locale |
| Gemini rate limit | Bassa | Alto | Retry con backoff, caching |
| Formato audio incompatibile | Media | Alto | Test unitari conversioni |

### 3.4 Test Plan

**Unit Test:**
- audio-converter.ts: test conversioni μ-law ↔ PCM
- session-manager.ts: test lifecycle sessioni

**Integration Test:**
- Connessione WebSocket mock FreeSWITCH
- Connessione Gemini con audio test

**E2E Test:**
```bash
# 1. Avvia bridge
npm run dev

# 2. Test WebSocket da remoto
wscat -c ws://IP_PUBBLICO:9090?token=xxx

# 3. Test chiamata da FreeSWITCH
docker exec -it freeswitch fs_cli -x "originate loopback/9999/default &park"

# 4. Verifica log
journalctl -u alessia-voice -f
```

---

## 4. APPENDICE

### 4.1 Comandi Utili FreeSWITCH

```bash
# Verifica mod_audio_stream
docker exec -it freeswitch fs_cli -x "show modules" | grep audio

# Ricarica dialplan
docker exec -it freeswitch fs_cli -x "reloadxml"

# Test chiamata
docker exec -it freeswitch fs_cli -x "originate loopback/9999/default &park"

# Mostra chiamate attive
docker exec -it freeswitch fs_cli -x "show calls"

# Log realtime
docker exec -it freeswitch fs_cli -x "sofia global siptrace on"
```

### 4.2 Comandi Utili Bridge

```bash
# Sviluppo
npm run dev

# Produzione
npm run build && npm start

# Log systemd
journalctl -u alessia-voice -f

# Restart servizio
sudo systemctl restart alessia-voice

# Status servizio
sudo systemctl status alessia-voice
```

### 4.3 Firewall Rules

```bash
# Apri porta 9090 solo per tuo IP
sudo ufw allow from YOUR_IP to any port 9090

# Oppure con token (nessuna regola firewall necessaria)
# Il bridge valida il token in query string
```

---

**Fine RDP**
