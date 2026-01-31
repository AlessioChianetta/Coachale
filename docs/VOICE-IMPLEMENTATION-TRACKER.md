# Voice Telephony Implementation Tracker

**Data Inizio**: Gennaio 2026  
**RDP Reference**: [RDP-Voice-Telephony-System.md](./RDP-Voice-Telephony-System.md)  
**Ultimo Aggiornamento**: In corso

---

## Riepilogo RDP

### Sezioni RDP
| # | Sezione | Descrizione | Status |
|---|---------|-------------|--------|
| 1 | Executive Summary | Obiettivo, valore, approccio | ✅ Definito |
| 2 | Architettura Attuale | Alessia browser, componenti esistenti | ✅ Definito |
| 3 | Architettura Futura | VPS Hostinger, componenti nuovi | ✅ Definito |
| 4 | Database | 4 nuove tabelle | ✅ IMPLEMENTATO |
| 5 | Backend | 7 moduli VPS | ⏳ In progress |
| 6 | Frontend | 3 pagine consultant | ⏳ Pending |
| 7 | Flusso Chiamata | Sequence diagram, state machine | ✅ Definito |
| 8 | Sicurezza | ESL, codec, storage | ✅ Definito |
| 9 | Anti-Abuso | Rate limiting, prefissi bloccati | ✅ Definito |
| 10 | Requisiti Tecnici | VPS, software, env vars | ✅ Definito |
| 11 | Divisione Responsabilità | TU vs IO | ✅ Definito |
| 12 | Timeline | 6 fasi | ✅ Definito |
| 13 | Appendici | Comandi ESL | ✅ Definito |

---

## Mie Responsabilità (RDP 11.2)

| # | Task RDP | File/Componente | Status | Note |
|---|----------|-----------------|--------|------|
| 1 | Schema DB | SQL tables | ✅ DONE | 4 tabelle + indici + FK |
| 2 | ESL Client | voice-esl-client.ts | ⏳ TODO | VPS reference code |
| 3 | Rate Limiter | voice-rate-limiter.ts | ⏳ TODO | VPS reference code |
| 4 | Caller Lookup | voice-caller-lookup.ts | ⏳ TODO | VPS reference code |
| 5 | Audio Handler | voice-audio-handler.ts | ⏳ TODO | VPS reference code |
| 6 | Gemini Bridge | voice-gemini-bridge.ts | ⏳ TODO | VPS reference code |
| 7 | Call Manager | voice-call-manager.ts | ⏳ TODO | VPS reference code |
| 8 | Health Check | voice-health.ts | ⏳ TODO | VPS reference code |
| 9 | Voice Routes | voice-routes.ts | ✅ DONE | API Replit |
| 10 | Frontend Dashboard | VoiceCalls.tsx | ✅ DONE | /consultant/voice-calls |
| 11 | Frontend Settings | VoiceSettings.tsx | ✅ DONE | /consultant/voice-settings |
| 12 | Frontend Detail | VoiceCallDetail.tsx | ✅ DONE | /consultant/voice-calls/:id |

---

## Database (RDP Sezione 4) - ✅ COMPLETATO

### voice_calls (RDP 4.1)
| Colonna | Tipo | Note |
|---------|------|------|
| id | VARCHAR PK | gen_random_uuid() |
| caller_id | VARCHAR(20) | NOT NULL |
| called_number | VARCHAR(20) | NOT NULL |
| client_id | VARCHAR FK → users | ON DELETE SET NULL |
| consultant_id | VARCHAR FK → users | ON DELETE SET NULL |
| freeswitch_uuid | VARCHAR(36) | NOT NULL |
| freeswitch_channel | VARCHAR(100) | - |
| status | VARCHAR(20) | DEFAULT 'ringing' |
| started_at | TIMESTAMP | NOT NULL DEFAULT NOW() |
| answered_at | TIMESTAMP | - |
| ended_at | TIMESTAMP | - |
| duration_seconds | INTEGER | - |
| talk_time_seconds | INTEGER | - |
| ai_conversation_id | VARCHAR FK → ai_conversations | ON DELETE SET NULL |
| ai_mode | VARCHAR(50) | DEFAULT 'assistenza' |
| prompt_used | TEXT | - |
| full_transcript | TEXT | - |
| transcript_chunks | JSONB | - |
| recording_url | TEXT | - |
| outcome | VARCHAR(50) | - |
| transfer_target | VARCHAR(20) | - |
| telephony_minutes | DECIMAL(10,2) | Billing |
| ai_tokens_used | INTEGER | Billing |
| ai_cost_estimate | DECIMAL(10,4) | Billing |
| metadata | JSONB | - |
| created_at | TIMESTAMP | DEFAULT NOW() |
| updated_at | TIMESTAMP | DEFAULT NOW() |

**Indici**: caller_id, client_id, status, started_at, consultant_id ✅

### voice_call_events (RDP 4.2)
| Colonna | Tipo | Note |
|---------|------|------|
| id | VARCHAR PK | gen_random_uuid() |
| call_id | VARCHAR FK → voice_calls | ON DELETE CASCADE |
| event_type | VARCHAR(50) | NOT NULL |
| event_data | JSONB | - |
| created_at | TIMESTAMP | DEFAULT NOW() |

**Indici**: call_id, event_type ✅

### voice_numbers (RDP 4.3)
| Colonna | Tipo | Note |
|---------|------|------|
| id | VARCHAR PK | gen_random_uuid() |
| phone_number | VARCHAR(20) | NOT NULL UNIQUE |
| display_name | VARCHAR(100) | - |
| consultant_id | VARCHAR FK → users | ON DELETE SET NULL |
| greeting_text | TEXT | - |
| ai_mode | VARCHAR(50) | DEFAULT 'assistenza' |
| fallback_number | VARCHAR(20) | - |
| active_days | JSONB | DEFAULT '["mon"..."fri"]' |
| active_hours_start | TIME | DEFAULT '09:00' |
| active_hours_end | TIME | DEFAULT '18:00' |
| timezone | VARCHAR(50) | DEFAULT 'Europe/Rome' |
| out_of_hours_action | VARCHAR(20) | DEFAULT 'voicemail' |
| max_concurrent_calls | INTEGER | DEFAULT 5 |
| max_call_duration_minutes | INTEGER | DEFAULT 30 |
| is_active | BOOLEAN | DEFAULT true |
| created_at | TIMESTAMP | DEFAULT NOW() |
| updated_at | TIMESTAMP | DEFAULT NOW() |

**Indici**: phone_number, consultant_id ✅

### voice_rate_limits (RDP 4.4)
| Colonna | Tipo | Note |
|---------|------|------|
| id | VARCHAR PK | gen_random_uuid() |
| caller_id | VARCHAR(20) | NOT NULL |
| calls_last_minute | INTEGER | DEFAULT 0 |
| calls_last_hour | INTEGER | DEFAULT 0 |
| calls_today | INTEGER | DEFAULT 0 |
| total_minutes_today | DECIMAL(10,2) | DEFAULT 0 |
| last_call_at | TIMESTAMP | - |
| first_call_today | TIMESTAMP | - |
| is_blocked | BOOLEAN | DEFAULT false |
| blocked_reason | TEXT | - |
| blocked_until | TIMESTAMP | - |
| created_at | TIMESTAMP | DEFAULT NOW() |
| updated_at | TIMESTAMP | DEFAULT NOW() |

**Indici**: caller_id (UNIQUE) ✅

---

## Backend VPS Reference (RDP Sezione 5)

### Struttura Directory (RDP 5.1)
```
server/voice/                    ← Reference code (deploy su VPS)
├── config.ts                    ✅ CREATO
├── index.ts                     ⏳ TODO
├── voice-esl-client.ts          ⏳ TODO (RDP 5.2)
├── voice-audio-handler.ts       ⏳ TODO (RDP 5.3)
├── voice-rate-limiter.ts        ⏳ TODO (RDP 5.4)
├── voice-health.ts              ⏳ TODO (RDP 5.5)
├── voice-routes.ts              ⏳ TODO (RDP 5.6)
├── voice-caller-lookup.ts       ⏳ TODO
├── voice-gemini-bridge.ts       ⏳ TODO
└── voice-call-manager.ts        ⏳ TODO
```

### API Endpoints (RDP 5.6)
| Method | Path | Descrizione | Status |
|--------|------|-------------|--------|
| GET | /api/voice/health | Stato componenti | ⏳ TODO |
| GET | /api/voice/status | ESL + chiamate attive | ⏳ TODO |
| GET | /api/voice/calls | Lista chiamate | ⏳ TODO |
| GET | /api/voice/calls/:id | Dettaglio chiamata | ⏳ TODO |
| GET | /api/voice/calls/:id/audio | Stream audio | ⏳ TODO |
| GET | /api/voice/stats | Statistiche aggregate | ⏳ TODO |
| POST | /api/voice/config | Aggiorna config numero | ⏳ TODO |
| GET | /api/voice/rate-limits/:callerId | Stato rate limit | ⏳ TODO |
| POST | /api/voice/block/:callerId | Blocca numero | ⏳ TODO |
| DELETE | /api/voice/block/:callerId | Sblocca numero | ⏳ TODO |

---

## Frontend Consultant (RDP Sezione 6)

### Pagine
| Pagina | Path | Descrizione | Status |
|--------|------|-------------|--------|
| VoiceCalls | /consultant/voice-calls | Dashboard chiamate (RDP 6.1) | ⏳ TODO |
| VoiceCallDetail | /consultant/voice-calls/:id | Dettaglio (RDP 6.2) | ⏳ TODO |
| VoiceSettings | /consultant/voice-settings | Configurazione (RDP 6.3) | ⏳ TODO |

### Componenti (RDP 6.4)
| Componente | Descrizione | Status |
|------------|-------------|--------|
| VoiceCallsDashboard.tsx | Dashboard con stats, health, lista | ⏳ TODO |
| VoiceSystemHealth.tsx | Stato ESL, FreeSWITCH, Gemini, DB | ⏳ TODO |
| VoiceCallsTable.tsx | Tabella con sorting, filtering | ⏳ TODO |
| VoiceCallDetail.tsx | Dettaglio singola chiamata | ⏳ TODO |
| VoiceCallTranscript.tsx | Visualizzatore trascrizione | ⏳ TODO |
| VoiceCallTimeline.tsx | Timeline eventi chiamata | ⏳ TODO |
| VoiceSettings.tsx | Form configurazione | ⏳ TODO |
| VoiceAntiAbuseSettings.tsx | Config rate limits | ⏳ TODO |
| ActiveCallsBadge.tsx | Indicatore real-time | ⏳ TODO |

---

## Punti Chiave Riconoscimento Cliente

**Flusso (RDP implicito)**:
1. Chiamata arriva con `caller_id` (es: +393331234567)
2. `voice-caller-lookup.ts` cerca in `users.phone_number`
3. Se trovato → carica `client_id`
4. `buildUserContext(clientId)` costruisce contesto completo
5. `buildSystemPrompt()` genera prompt personalizzato
6. Alessia risponde conoscendo tutto del cliente

**Codice chiave da riusare**:
- `server/ai-context-builder.ts` → `buildUserContext()`
- `server/ai-prompts.ts` → `buildSystemPrompt()`
- `server/ai/gemini-live-ws-service.ts` → logica Gemini Live

---

## Log Modifiche

### 2026-01-XX (Oggi)
- ✅ Creato file VOICE-IMPLEMENTATION-TRACKER.md
- ✅ Creato tabella voice_calls + 5 indici
- ✅ Creato tabella voice_call_events + 2 indici
- ✅ Creato tabella voice_numbers + 2 indici
- ✅ Creato tabella voice_rate_limits + 1 indice
- ✅ Aggiunta FK voice_calls.ai_conversation_id → ai_conversations(id)
- ✅ Creato server/voice/config.ts
- ⏳ Prossimo: Backend modules + Frontend

---

## Verifiche Architetto

| # | Data | Scope | Esito | Note |
|---|------|-------|-------|------|
| 1 | Oggi | Database 4 tabelle | ✅ PASS | FK aggiunta dopo review |
| 2 | - | Backend modules | ⏳ Pending | - |
| 3 | - | Frontend | ⏳ Pending | - |
