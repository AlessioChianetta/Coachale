# RDP - Voice Booking Supervisor
## Sistema di Prenotazione Appuntamenti per Chiamate Vocali

**Data**: Febbraio 2026
**Stato**: Specifica Tecnica - Mappa Implementazione
**Approccio**: LLM Supervisore (NON tool function real-time)

---

## INDICE

1. [Analisi dei Due Sistemi di Booking Esistenti](#1-analisi-dei-due-sistemi-di-booking-esistenti)
2. [Perché NON Tool Function Real-Time](#2-perché-non-tool-function-real-time)
3. [Architettura LLM Supervisore](#3-architettura-llm-supervisore)
4. [State Machine del Supervisore](#4-state-machine-del-supervisore)
5. [Tabella Componenti Riusati](#5-tabella-componenti-riusati)
6. [Diagrammi di Flusso](#6-diagrammi-di-flusso)
7. [Casistiche Complete](#7-casistiche-complete)
8. [Modifiche per File](#8-modifiche-per-file)
9. [Schema Database](#9-schema-database)
10. [Frontend UI](#10-frontend-ui)
11. [Step di Implementazione](#11-step-di-implementazione)

---

## 1. ANALISI DEI DUE SISTEMI DI BOOKING ESISTENTI

Il codebase ha **due sistemi di booking completamente diversi**. È fondamentale capirli entrambi.

### SISTEMA A: "Consultation Tools" (Chat AI Interna)

**Usato da**: AI Assistant chat (consulente ↔ cliente registrato)
**File principali**:
- `server/ai/consultation-tools.ts` → 6 dichiarazioni tool
- `server/ai/consultation-tool-executor.ts` → esecuzione con Google Calendar
- `server/booking/booking-flow-service.ts` → state management (flow stage + TTL)

**Flusso**:
```
Cliente registrato → Chat AI → Tool function calling Gemini →
getAvailableSlots → proposeBooking (crea pendingBooking con token) →
Cliente dice "confermo" → confirmBooking (crea consultation + Google Calendar + Meet)
```

**Tabelle DB usate**:
- `pendingBookings` → stato temporaneo pre-conferma (token, TTL 15 min)
- `consultations` → appuntamento confermato finale
- `consultantAvailabilitySettings` → configurazione slot
- `aiConversations` → flow state (activeFlow, flowStage, flowExpiresAt)

**Caratteristiche**:
- Richiede `clientId` (solo clienti registrati)
- Usa `conversationId` per flow state
- Crea `pendingBooking` con token → conferma con token → crea `consultation`
- Integra Google Calendar + Meet link automatico
- Post-booking context: 30 min finestra per modifica/cancellazione

### SISTEMA B: "Booking Service" (WhatsApp/Instagram/Public Link)

**Usato da**: WhatsApp message-processor, Instagram, Public Share
**File principali**:
- `server/booking/booking-intent-detector.ts` → pre-check se analizzare
- `server/booking/booking-service.ts` → estrazione dati, validazione, creazione
- `server/whatsapp/message-processor.ts` → orchestrazione (linee 3055-3300+)

**Flusso**:
```
Lead scrive messaggio → shouldAnalyzeForBooking() pre-check →
extractBookingDataFromConversation() (LLM analizza tutta la conversazione) →
Accumulator Pattern (salva stato progressivo in bookingExtractionState) →
validateBookingData() → createBookingRecord() → createGoogleCalendarBooking()
```

**Tabelle DB usate**:
- `appointmentBookings` → appuntamento creato (source: whatsapp/public_link/instagram)
- `bookingExtractionState` → accumulator progressivo (date, time, phone, email, name)
- `consultantAvailabilitySettings` → configurazione slot
- `proposedAppointmentSlots` → slot proposti (fix scope bug)

**Caratteristiche**:
- NON richiede `clientId` (funziona con lead anonimi)
- Richiede 4 campi: date + time + phone + email (hasAllData)
- LLM estrae dati dalla conversazione (Gemini 2.5 Flash Lite)
- Pattern Accumulator: i dati si accumulano progressivamente tra messaggi
- Dual-source extraction: analizza sia messaggi lead che risposte AI
- Validazione: data futura, formato corretto, tutti i campi presenti

### QUALE SISTEMA USARE PER LA VOCE?

```
┌─────────────────────────────────────────────────────────────────────┐
│                    DECISIONE ARCHITETTURALE                        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  SCENARIO VOCE: Due casistiche principali                          │
│                                                                     │
│  1. CLIENTE REGISTRATO (ha clientId)                               │
│     → Usa SISTEMA A (consultation-tool-executor)                   │
│     → Crea consultation + Google Calendar + Meet                   │
│     → Flow: proposeBooking → confirmBooking                       │
│                                                                     │
│  2. NON-CLIENTE / LEAD (no clientId)                               │
│     → Usa SISTEMA B (booking-service)                              │
│     → Crea appointmentBooking + Google Calendar                    │
│     → Flow: extractBookingData → validateBooking → createBooking  │
│                                                                     │
│  IN ENTRAMBI I CASI: LLM Supervisore analizza la trascrizione     │
│  e decide QUANDO chiamare il servizio appropriato                  │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 2. PERCHÉ NON TOOL FUNCTION REAL-TIME

```
┌─────────────────────────────────────────────────────────────────────┐
│  TOOL FUNCTION LIVE vs LLM SUPERVISORE - Confronto Tecnico        │
├──────────────────────┬──────────────────┬───────────────────────────┤
│ Aspetto              │ Tool Function    │ LLM Supervisore           │
├──────────────────────┼──────────────────┼───────────────────────────┤
│ Naturalezza voce     │ ❌ Interrompe     │ ✅ Zero interruzioni      │
│ Gestione correzioni  │ ❌ Race condition │ ✅ Reset stato naturale   │
│ Controllo logico     │ ⚠️ Medio         │ ✅ Altissimo              │
│ Debug                │ ❌ Incubo         │ ✅ State machine loggato  │
│ Trigger prematuro    │ ❌ Frequente      │ ✅ Mai (aspetta conferma) │
│ Doppio booking       │ ❌ Possibile      │ ✅ Impossibile (mutex)    │
│ UX percepita         │ ❌ "Bot"          │ ✅ Assistente umano       │
│ Scalabilità          │ ⚠️ Bassa         │ ✅ Alta                   │
│ Latenza extra        │ ❌ Pausa durante  │ ✅ Zero (post-turno)      │
│ Dati incompleti      │ ❌ Chiama subito  │ ✅ Aspetta raccolta       │
├──────────────────────┴──────────────────┴───────────────────────────┤
│                                                                     │
│ PROBLEMI REALI DEL TOOL FUNCTION IN VOCE:                          │
│                                                                     │
│ 1. L'utente dice "mercoledì alle 15... anzi no, giovedì"          │
│    → Tool già chiamato con mercoledì → BOOKING SBAGLIATO           │
│                                                                     │
│ 2. L'utente dice "sì" (conferma generica) in un altro contesto    │
│    → Tool triggera confirmBooking → BOOKING NON VOLUTO             │
│                                                                     │
│ 3. L'utente parla disordinato: "la settimana prossima... forse     │
│    lunedì... ma dipende dal lavoro... facciamo martedì alle 10"    │
│    → Tool chiama 3 volte con dati diversi → CAOS                   │
│                                                                     │
│ 4. Race condition: audio chunk arriva mentre tool è in esecuzione  │
│    → Dati mescolati tra turni → ERRORE IMPREVEDIBILE               │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 3. ARCHITETTURA LLM SUPERVISORE

```
┌─────────────────────────────────────────────────────────────────────┐
│                    ARCHITETTURA GENERALE                            │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌──────────────┐    Audio     ┌──────────────────┐                │
│  │   Telefono   │ ──────────── │   FreeSWITCH     │                │
│  │  (Utente)    │              │   VPS Bridge     │                │
│  └──────────────┘              └────────┬─────────┘                │
│                                         │ WebSocket                 │
│                                         ▼                           │
│  ┌──────────────────────────────────────────────────────────┐      │
│  │              gemini-live-ws-service.ts                    │      │
│  │                                                          │      │
│  │  ┌────────────────────────────────────────────────────┐  │      │
│  │  │  GEMINI LIVE API (Conversazione Naturale)          │  │      │
│  │  │                                                    │  │      │
│  │  │  System Prompt include:                            │  │      │
│  │  │  • Istruzioni booking vocale                       │  │      │
│  │  │  • Slot disponibili pre-caricati                   │  │      │
│  │  │  • Regole di conferma vocale                       │  │      │
│  │  │                                                    │  │      │
│  │  │  L'AI conversa naturalmente:                       │  │      │
│  │  │  "Ti va mercoledì alle 15?"                        │  │      │
│  │  │  "Perfetto, confermo mercoledì 12 alle 15:00"     │  │      │
│  │  └──────────┬─────────────────────────────────────────┘  │      │
│  │             │                                            │      │
│  │             │ Trascrizioni (user + AI) in real-time      │      │
│  │             │ (conversationMessages[])                   │      │
│  │             ▼                                            │      │
│  │  ┌────────────────────────────────────────────────────┐  │      │
│  │  │  VOICE BOOKING SUPERVISOR (LLM in background)     │  │      │
│  │  │  server/voice/voice-booking-supervisor.ts          │  │      │
│  │  │                                                    │  │      │
│  │  │  ┌──────────────────────────────────────────────┐  │  │      │
│  │  │  │  STATE MACHINE                               │  │  │      │
│  │  │  │                                              │  │  │      │
│  │  │  │  nessun_intento                              │  │  │      │
│  │  │  │      ↓ (rileva interesse booking)            │  │  │      │
│  │  │  │  raccolta_dati                               │  │  │      │
│  │  │  │      ↓ (tutti i campi presenti)              │  │  │      │
│  │  │  │  dati_completi                               │  │  │      │
│  │  │  │      ↓ (conferma esplicita utente)           │  │  │      │
│  │  │  │  confermato → TRIGGER BOOKING                │  │  │      │
│  │  │  └──────────────────────────────────────────────┘  │  │      │
│  │  │                                                    │  │      │
│  │  │  Trigger: dopo ogni AI turn completato             │  │      │
│  │  │  Input: ultimi N messaggi trascrizione             │  │      │
│  │  │  Output: stato aggiornato + eventuale booking      │  │      │
│  │  └──────────┬─────────────────────────────────────────┘  │      │
│  │             │                                            │      │
│  │             │ Solo quando stato = "confermato"           │      │
│  │             ▼                                            │      │
│  │  ┌────────────────────────────────────────────────────┐  │      │
│  │  │  BOOKING EXECUTION                                 │  │      │
│  │  │                                                    │  │      │
│  │  │  SE clientId presente (cliente registrato):        │  │      │
│  │  │    → executeConsultationTool("proposeBooking")     │  │      │
│  │  │    → executeConsultationTool("confirmBooking")     │  │      │
│  │  │    → Crea consultation + Google Calendar + Meet    │  │      │
│  │  │                                                    │  │      │
│  │  │  SE NON clientId (lead/non-cliente):               │  │      │
│  │  │    → createBookingRecord() da booking-service      │  │      │
│  │  │    → createGoogleCalendarBooking()                 │  │      │
│  │  │    → Crea appointmentBooking + Google Calendar     │  │      │
│  │  └────────────────────────────────────────────────────┘  │      │
│  └──────────────────────────────────────────────────────────┘      │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 4. STATE MACHINE DEL SUPERVISORE

### 4.1 Stati

```
┌─────────────────────────────────────────────────────────────────────┐
│                     STATE MACHINE                                   │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────────┐                                               │
│  │ NESSUN_INTENTO   │  Stato iniziale. Nessun interesse booking.   │
│  │                  │  Il supervisore monitora ma non agisce.       │
│  └────────┬─────────┘                                               │
│           │                                                         │
│           │ Trigger: utente chiede disponibilità, menziona          │
│           │ appuntamento, dice "quando posso venire?", etc.         │
│           ▼                                                         │
│  ┌─────────────────┐                                               │
│  │ RACCOLTA_DATI    │  L'AI sta raccogliendo informazioni.         │
│  │                  │  Il supervisore traccia i campi accumulati.   │
│  │                  │                                               │
│  │  Campi tracciati:│                                               │
│  │  • date: string | null                                          │
│  │  • time: string | null                                          │
│  │  • confirmed: boolean (conferma esplicita utente)               │
│  │  • phone: string | null (solo per non-clienti)                  │
│  │  • email: string | null (solo per non-clienti)                  │
│  │  • name: string | null  (solo per non-clienti)                  │
│  └────────┬─────────┘                                               │
│           │                                                         │
│           │ Trigger: TUTTI i campi obbligatori presenti             │
│           │ (per clienti: date + time)                              │
│           │ (per non-clienti: date + time + phone + email)          │
│           ▼                                                         │
│  ┌─────────────────┐                                               │
│  │ DATI_COMPLETI    │  Tutti i dati sono presenti.                 │
│  │                  │  Attende conferma esplicita dell'utente.      │
│  │                  │  L'AI ha già proposto: "Mercoledì alle 15?"  │
│  └────────┬─────────┘                                               │
│           │                                                         │
│           │ Trigger: utente dice "sì", "confermo", "va bene",      │
│           │ "perfetto", "ok prenota", E l'AI ha confermato          │
│           │ ripetendo data/ora nella sua risposta                   │
│           ▼                                                         │
│  ┌─────────────────┐                                               │
│  │ CONFERMATO       │  Booking confermato! Trigger esecuzione.     │
│  │  ══════════════  │                                               │
│  │  → Chiama il     │  Questo stato dura un istante.               │
│  │    booking       │  Dopo l'esecuzione → COMPLETATO o ERRORE     │
│  │    service       │                                               │
│  └────────┬─────────┘                                               │
│           │                                                         │
│           ├──── Successo ────▶ ┌──────────────┐                    │
│           │                    │ COMPLETATO    │                    │
│           │                    │ Booking creato│                    │
│           │                    └──────────────┘                    │
│           │                                                         │
│           └──── Errore ──────▶ ┌──────────────┐                    │
│                                │ ERRORE        │                    │
│                                │ Slot occupato │                    │
│                                │ → reset a     │                    │
│                                │ RACCOLTA_DATI │                    │
│                                └──────────────┘                    │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│  TRANSIZIONI SPECIALI                                               │
│                                                                     │
│  • CORREZIONE: da qualsiasi stato → RACCOLTA_DATI                  │
│    Trigger: utente dice "anzi no", "aspetta", "cambiamo",          │
│    "non quel giorno", "facciamo un altro orario"                   │
│    Azione: reset dei campi modificati, mantieni gli altri          │
│                                                                     │
│  • ABBANDONO: da qualsiasi stato → NESSUN_INTENTO                 │
│    Trigger: utente cambia completamente argomento,                 │
│    nessuna menzione booking per 5+ turni consecutivi               │
│                                                                     │
│  • TIMEOUT: DATI_COMPLETI per più di 3 turni senza conferma       │
│    → torna a RACCOLTA_DATI (potrebbe aver cambiato idea)           │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 4.2 Struttura Dati Stato

```typescript
interface VoiceBookingSupervisorState {
  stage: 'nessun_intento' | 'raccolta_dati' | 'dati_completi' | 'confermato' | 'completato' | 'errore';
  
  extractedData: {
    date: string | null;       // "2026-02-12" formato YYYY-MM-DD
    time: string | null;       // "15:00" formato HH:MM
    confirmed: boolean;        // conferma esplicita utente
    phone: string | null;      // solo per non-clienti
    email: string | null;      // solo per non-clienti
    name: string | null;       // nome del chiamante (se detto)
    duration: number;          // default 60 min
    notes: string | null;      // note dalla conversazione
  };
  
  metadata: {
    turnsInCurrentState: number;    // contatore turni nello stato attuale
    lastAnalyzedMessageIndex: number; // ultimo messaggio analizzato
    bookingAttempts: number;        // tentativi di booking (per retry)
    createdBookingId: string | null; // ID del booking creato
    createdBookingType: 'consultation' | 'appointment' | null;
    googleMeetLink: string | null;
    errorMessage: string | null;
  };
}
```

---

## 5. TABELLA COMPONENTI RIUSATI

### Cosa riusiamo dal codebase esistente

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│ COMPONENTE ESISTENTE                  │ RIUSO PER VOCE         │ MODIFICHE      │
├───────────────────────────────────────┼────────────────────────┼────────────────┤
│ consultation-tool-executor.ts         │ ✅ 100% (clienti)      │ NESSUNA        │
│  → executeGetAvailableSlots()         │ Pre-carica slot nel    │                │
│  → executeProposeBooking()            │ system prompt e        │                │
│  → executeConfirmBooking()            │ booking su conferma    │                │
│  → executeCancelBooking()             │                        │                │
│  → executeRescheduleBooking()         │                        │                │
├───────────────────────────────────────┼────────────────────────┼────────────────┤
│ consultation-tools.ts                 │ ✅ Solo come           │ NESSUNA        │
│  → consultationTools[]                │ riferimento parametri  │                │
│  → ConsultationToolDeclaration        │ (non inviati a Gemini  │                │
│  → ConsultationToolResult             │ Live, usati dal        │                │
│                                       │ supervisore)           │                │
├───────────────────────────────────────┼────────────────────────┼────────────────┤
│ booking-service.ts                    │ ✅ 100% (non-clienti)  │ Aggiungere     │
│  → extractBookingDataFromConversation │ NO (supervisore lo fa) │ source=        │
│  → validateBookingData()              │ ✅ Validazione date    │ 'voice_call'   │
│  → createBookingRecord()              │ ✅ Crea appointmentBkg │                │
│  → createGoogleCalendarBooking()      │ ✅ Google Calendar     │                │
│  → processFullBooking()               │ ✅ Orchestra tutto     │                │
│  → formatAppointmentDate()            │ ✅ Formattazione       │                │
├───────────────────────────────────────┼────────────────────────┼────────────────┤
│ booking-flow-service.ts               │ ❌ NON usato           │ N/A            │
│  (usa aiConversations per flow state  │ La voce non ha         │                │
│   - non applicabile a voice calls)    │ aiConversations        │                │
├───────────────────────────────────────┼────────────────────────┼────────────────┤
│ booking-intent-detector.ts            │ ❌ NON usato           │ N/A            │
│  (pre-check basato su regex/LLM       │ Il supervisore fa      │                │
│   per messaggi WhatsApp)              │ tutto internamente     │                │
├───────────────────────────────────────┼────────────────────────┼────────────────┤
│ google-calendar-service.ts            │ ✅ 100%                │ NESSUNA        │
│  → createGoogleCalendarEvent()        │ Creazione evento       │                │
│  → deleteGoogleCalendarEvent()        │ Cancellazione          │                │
│  → listEvents()                       │ Lista eventi           │                │
├───────────────────────────────────────┼────────────────────────┼────────────────┤
│ gemini-live-ws-service.ts             │ ✅ Base per            │ AGGIUNGERE:    │
│  → conversationMessages[]             │ integrazione           │ • Hook post-   │
│  → commitUserMessage()                │ supervisore            │   AI-turn      │
│  → scheduleTranscriptUpdate()         │                        │ • Pre-load     │
│  → System prompt building             │                        │   slot nel     │
│                                       │                        │   prompt       │
│                                       │                        │ • Booking      │
│                                       │                        │   prompt       │
│                                       │                        │   section      │
├───────────────────────────────────────┼────────────────────────┼────────────────┤
│ shared/schema.ts                      │                        │ AGGIUNGERE:    │
│  → appointmentBookings                │ ✅ Tabella per         │ source=        │
│  → pendingBookings                    │ non-clienti            │ 'voice_call'   │
│  → consultations                      │ ✅ Tabella per clienti │ alla union     │
│  → voiceCalls                         │ ✅ Riferimento         │ type di source │
│  → consultantAvailabilitySettings     │ ✅ Config slot         │                │
├───────────────────────────────────────┼────────────────────────┼────────────────┤
│ AI Provider                           │                        │                │
│  → getAIProvider() / provider-factory │ ✅ Per il supervisore  │ NESSUNA        │
│  → Gemini 2.5 Flash Lite             │ LLM (analisi veloce)  │                │
└───────────────────────────────────────┴────────────────────────┴────────────────┘
```

### Cosa creiamo da zero

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│ NUOVO COMPONENTE                      │ SCOPO                                   │
├───────────────────────────────────────┼─────────────────────────────────────────┤
│ server/voice/voice-booking-           │ Core del sistema:                       │
│   supervisor.ts                       │ • State machine (4 stati)               │
│   (~400-500 righe)                    │ • Prompt di analisi trascrizione        │
│                                       │ • Estrazione dati (date/time/confirm)   │
│                                       │ • Trigger booking services              │
│                                       │ • Gestione correzioni/reset             │
├───────────────────────────────────────┼─────────────────────────────────────────┤
│ Sezione booking nel system prompt     │ Istruzioni per Alessia:                 │
│ (aggiunto in gemini-live-ws-          │ • Come proporre appuntamenti            │
│  service.ts)                          │ • Come chiedere conferma                │
│                                       │ • Slot disponibili pre-caricati         │
│                                       │ • Regole di conferma vocale             │
├───────────────────────────────────────┼─────────────────────────────────────────┤
│ Hook nel message handler              │ Punto di aggancio:                      │
│ (in gemini-live-ws-service.ts)        │ • Dopo ogni AI turn completato          │
│                                       │ • Passa trascrizione al supervisore     │
│                                       │ • Riceve risultato e agisce             │
├───────────────────────────────────────┼─────────────────────────────────────────┤
│ UI Badge nella lista chiamate         │ Visual indicator:                       │
│ (in consultant-voice-calls.tsx)       │ • Badge "Appuntamento Creato"           │
│                                       │ • Link a dettagli consulenza            │
└───────────────────────────────────────┴─────────────────────────────────────────┘
```

---

## 6. DIAGRAMMI DI FLUSSO

### 6.1 Flusso Principale - Chiamata con Booking

```
┌─────────────────────────────────────────────────────────────────────────┐
│                   FLUSSO PRINCIPALE (HAPPY PATH)                        │
└─────────────────────────────────────────────────────────────────────────┘

 CHIAMATA INIZIA
      │
      ▼
 ┌──────────────────────────────┐
 │ 1. WebSocket si connette      │
 │    gemini-live-ws-service.ts  │
 │    Identifica: isPhoneCall    │
 └──────────────┬───────────────┘
                │
                ▼
 ┌──────────────────────────────┐
 │ 2. Lookup caller              │
 │    • userId trovato?          │
 │    • scheduledCallId?         │
 │    • outboundTargetPhone?     │
 └──────────────┬───────────────┘
                │
                ├──── clientId presente ──────────────┐
                │     (CLIENTE REGISTRATO)             │
                │                                      │
                ├──── no clientId ────────────────┐    │
                │     (NON-CLIENTE / LEAD)        │    │
                ▼                                 │    │
 ┌──────────────────────────────┐                 │    │
 │ 3. Pre-carica slot           │ ◄───────────────┘────┘
 │    disponibili               │
 │    executeGetAvailableSlots() │
 │    → inietta nel system      │
 │      prompt come contesto    │
 └──────────────┬───────────────┘
                │
                ▼
 ┌──────────────────────────────┐
 │ 4. Crea VoiceBooking-        │
 │    Supervisor instance       │
 │    stato: nessun_intento     │
 │    isClient: true/false      │
 │    clientId: ... | null      │
 │    consultantId: ...         │
 └──────────────┬───────────────┘
                │
                ▼
 ┌──────────────────────────────┐
 │ 5. Gemini Live: Setup +      │
 │    System prompt con sezione │
 │    booking + slot            │
 │    disponibili               │
 └──────────────┬───────────────┘
                │
                ▼
 ═══════════════════════════════════
   CONVERSAZIONE VOCALE NATURALE
   (loop di audio chunks)
 ═══════════════════════════════════
                │
         ┌──────┴──────┐
         ▼             ▼
   [Utente parla]  [AI risponde]
   commitUserMessage() → conversationMessages.push()
   currentAiTranscript  → conversationMessages.push()
         │             │
         └──────┬──────┘
                │
                ▼
 ┌──────────────────────────────────────────────────────┐
 │ 6. HOOK: Dopo ogni AI turn completato                │
 │    (quando isAiSpeaking passa da true → false)       │
 │                                                      │
 │    supervisor.analyzeTranscript(conversationMessages) │
 │                                                      │
 │    Il supervisore:                                    │
 │    a) Prende ultimi N messaggi                        │
 │    b) Chiama Gemini 2.5 Flash Lite con prompt di     │
 │       analisi booking                                 │
 │    c) Aggiorna state machine                          │
 │    d) SE stato = confermato → TRIGGER BOOKING         │
 └──────────────┬───────────────────────────────────────┘
                │
                │ stato = confermato?
                │
                ├──── NO → continua conversazione
                │         (loop torna al punto 5)
                │
                └──── SÌ ─────▼
                              │
 ┌────────────────────────────┴──────────────────────────┐
 │ 7. BOOKING EXECUTION                                   │
 │                                                        │
 │    SE isClient (ha clientId):                          │
 │    ┌────────────────────────────────────────────────┐  │
 │    │ a) executeProposeBooking(clientId, consultId,  │  │
 │    │    { date, time })                              │  │
 │    │    → Crea pendingBooking con token              │  │
 │    │                                                 │  │
 │    │ b) executeConfirmBooking(clientId, { token })   │  │
 │    │    → Crea consultation                          │  │
 │    │    → Crea Google Calendar event + Meet          │  │
 │    │    → Set post-booking context                   │  │
 │    └────────────────────────────────────────────────┘  │
 │                                                        │
 │    SE NON isClient (lead):                             │
 │    ┌────────────────────────────────────────────────┐  │
 │    │ a) createBookingRecord(consultantId, null,     │  │
 │    │    { date, time, phone, email }, 'voice_call') │  │
 │    │    → Crea appointmentBooking                   │  │
 │    │                                                 │  │
 │    │ b) createGoogleCalendarBooking(consultantId,   │  │
 │    │    booking, email)                              │  │
 │    │    → Crea Google Calendar event + Meet          │  │
 │    └────────────────────────────────────────────────┘  │
 └────────────────────────────────────────────────────────┘
                │
                ▼
 ┌──────────────────────────────────────┐
 │ 8. Invia conferma via Gemini        │
 │                                      │
 │    Inietta messaggio di sistema:     │
 │    "L'appuntamento è stato creato    │
 │     per [data] alle [ora].           │
 │     Comunica la conferma al          │
 │     chiamante."                      │
 │                                      │
 │    Gemini lo dice a voce:            │
 │    "Perfetto! Ho confermato il tuo   │
 │     appuntamento per mercoledì 12    │
 │     febbraio alle 15:00!"            │
 └──────────────────────────────────────┘
                │
                ▼
 ┌──────────────────────────────────────┐
 │ 9. Aggiorna voiceCall metadata       │
 │    • metadata.bookingCreated = true  │
 │    • metadata.bookingId = "..."      │
 │    • metadata.bookingType = "..."    │
 └──────────────────────────────────────┘
```

### 6.2 Flusso Supervisore - Analisi Trascrizione

```
┌─────────────────────────────────────────────────────────────────────────┐
│              FLUSSO INTERNO SUPERVISORE (per ogni AI turn)              │
└─────────────────────────────────────────────────────────────────────────┘

 analyzeTranscript(messages) chiamato
      │
      ▼
 ┌──────────────────────────────┐
 │ 1. Prepara contesto          │
 │    • Ultimi 10-15 messaggi   │
 │    • Stato attuale            │
 │    • Dati già estratti        │
 └──────────────┬───────────────┘
                │
                ▼
 ┌──────────────────────────────┐
 │ 2. Chiama Gemini Flash Lite  │
 │    con prompt di analisi     │
 │                              │
 │    "Analizza questa          │
 │     trascrizione vocale.     │
 │     Stato attuale: X         │
 │     Dati estratti: Y         │
 │     Rispondi in JSON"        │
 └──────────────┬───────────────┘
                │
                ▼
 ┌──────────────────────────────┐
 │ 3. Parse risposta JSON       │
 │                              │
 │    {                         │
 │      "newStage": "...",      │
 │      "date": "2026-02-12",  │
 │      "time": "15:00",       │
 │      "confirmed": true,      │
 │      "phone": "333...",     │
 │      "email": "x@y.com",   │
 │      "correction": false,    │
 │      "reasoning": "..."      │
 │    }                         │
 └──────────────┬───────────────┘
                │
                ▼
 ┌──────────────────────────────────────────────────┐
 │ 4. Aggiorna state machine                        │
 │                                                  │
 │    SE correction = true:                         │
 │      → Reset campi modificati                    │
 │      → stage = raccolta_dati                     │
 │      → turnsInCurrentState = 0                   │
 │                                                  │
 │    SE newStage diverso da stage attuale:         │
 │      → Transizione di stato                      │
 │      → Log transizione                           │
 │                                                  │
 │    Merge dati estratti (accumulator pattern):    │
 │      → Nuovi dati sovrascrivono null             │
 │      → Non sovrascrivere dati esistenti se       │
 │        nuovo valore è null                        │
 └──────────────┬───────────────────────────────────┘
                │
                ▼
 ┌──────────────────────────────┐     ┌───────────────────┐
 │ 5. stato = confermato?       │──NO─▶│ Return: no action │
 │                              │      └───────────────────┘
 └──────────────┬───────────────┘
                │ SÌ
                ▼
 ┌──────────────────────────────┐
 │ 6. TRIGGER BOOKING           │
 │    (vedi Flusso 6.1 step 7)  │
 │    Return: booking result    │
 └──────────────────────────────┘
```

### 6.3 Flusso Correzione Utente

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    FLUSSO CORREZIONE                                     │
└─────────────────────────────────────────────────────────────────────────┘

 Stato: DATI_COMPLETI (date=2026-02-12, time=15:00)
 AI: "Perfetto, mercoledì 12 alle 15, confermo?"
      │
      ▼
 Utente: "Aspetta, no... facciamo giovedì piuttosto"
      │
      ▼
 ┌──────────────────────────────┐
 │ Supervisore rileva:          │
 │ correction = true            │
 │ date = null (reset)          │
 │ time = "15:00" (mantieni)    │
 │ confirmed = false            │
 └──────────────┬───────────────┘
                │
                ▼
 ┌──────────────────────────────┐
 │ Stato → RACCOLTA_DATI       │
 │ date = null                  │
 │ time = "15:00"               │
 │ confirmed = false            │
 └──────────────┬───────────────┘
                │
                ▼
 AI: "Certo! Giovedì 13 alle 15:00 va bene?"
 Utente: "Sì perfetto"
      │
      ▼
 ┌──────────────────────────────┐
 │ Supervisore rileva:          │
 │ date = "2026-02-13"          │
 │ time = "15:00"               │
 │ confirmed = true             │
 │ → CONFERMATO                 │
 │ → TRIGGER BOOKING            │
 └──────────────────────────────┘
```

---

## 7. CASISTICHE COMPLETE

### 7.1 Matrice Scenari

```
┌──────────────────────────────────────────────────────────────────────────────────────┐
│ SCENARIO                  │ IsClient │ Direction │ Booking Service │ Dati Richiesti │
├───────────────────────────┼──────────┼───────────┼─────────────────┼────────────────┤
│ A. Cliente registrato     │ ✅ SÌ    │ INBOUND   │ consultation-   │ date + time    │
│    chiama per prenotare   │          │           │ tool-executor   │ (phone/email   │
│                           │          │           │ (Sistema A)     │ già nel DB)    │
├───────────────────────────┼──────────┼───────────┼─────────────────┼────────────────┤
│ B. Non-cliente chiama     │ ❌ NO    │ INBOUND   │ booking-service │ date + time    │
│    e vuole appuntamento   │          │           │ (Sistema B)     │ + phone + email│
├───────────────────────────┼──────────┼───────────┼─────────────────┼────────────────┤
│ C. Outbound a cliente     │ ✅ SÌ    │ OUTBOUND  │ consultation-   │ date + time    │
│    con intento booking    │          │           │ tool-executor   │                │
│                           │          │           │ (Sistema A)     │                │
├───────────────────────────┼──────────┼───────────┼─────────────────┼────────────────┤
│ D. Outbound a non-cliente │ ❌ NO    │ OUTBOUND  │ booking-service │ date + time    │
│    (es. sales call che     │          │           │ (Sistema B)     │ + phone + email│
│    diventa booking)       │          │           │                 │ (phone dal DB) │
├───────────────────────────┼──────────┼───────────┼─────────────────┼────────────────┤
│ E. Chiamata senza booking │ qualsiasi│ qualsiasi │ NESSUNO         │ N/A            │
│    (info, supporto, etc.) │          │           │ Supervisore     │                │
│                           │          │           │ resta in        │                │
│                           │          │           │ nessun_intento  │                │
├───────────────────────────┼──────────┼───────────┼─────────────────┼────────────────┤
│ F. Non-cliente senza      │ ❌ NO    │ INBOUND   │ NESSUNO         │ N/A            │
│    email (non completable)│          │           │ Supervisore in  │                │
│                           │          │           │ raccolta_dati   │                │
│                           │          │           │ (attende email) │                │
├───────────────────────────┼──────────┼───────────┼─────────────────┼────────────────┤
│ G. Utente si corregge     │ qualsiasi│ qualsiasi │ Reset parziale  │ Ricalcola      │
│    durante raccolta dati  │          │           │ stato supervisor│                │
├───────────────────────────┼──────────┼───────────┼─────────────────┼────────────────┤
│ H. Slot occupato (errore) │ qualsiasi│ qualsiasi │ Retry con nuovo │ Nuova data/ora │
│                           │          │           │ slot proposto   │                │
└───────────────────────────┴──────────┴───────────┴─────────────────┴────────────────┘
```

### 7.2 Dettaglio per Scenario

**SCENARIO A - Cliente registrato chiama per appuntamento**
```
Utente: "Ciao Alessia, vorrei prenotare una consulenza"
AI: "Ciao Marco! Certo, ho controllato il calendario. Questa settimana
     ho disponibili: mercoledì alle 10, alle 15, e giovedì alle 11.
     Quale ti va meglio?"
Utente: "Mercoledì alle 15 va benissimo"
AI: "Perfetto! Mercoledì 12 febbraio alle 15:00. Confermi?"
Utente: "Sì, confermo"

→ Supervisore: stage = confermato
→ executeProposeBooking(clientId, consultantId, {date: "2026-02-12", time: "15:00"})
→ executeConfirmBooking(clientId, {confirmationToken: "..."})
→ Crea consultation + Google Calendar + Meet link
→ Inietta conferma: "Ho confermato! Ti ho mandato l'invito calendario con Meet."
```

**SCENARIO B - Non-cliente chiama per appuntamento**
```
Utente: "Buongiorno, vorrei fissare un appuntamento"
AI: "Buongiorno! Sono Alessia, assistente di Marco Rossi. Certo!
     Ho disponibili: lunedì alle 10, martedì alle 14 e 16.
     Quale orario preferisci?"
Utente: "Martedì alle 14"
AI: "Martedì 11 febbraio alle 14:00. Mi lasci un numero di telefono
     e un'email per mandarti l'invito?"
Utente: "Il numero è 333 1234567"
AI: "Perfetto, e l'email?"
Utente: "mario@gmail.com"
AI: "Ottimo! Allora martedì 11 alle 14, telefono 333 1234567,
     email mario@gmail.com. Tutto giusto?"
Utente: "Sì esatto"

→ Supervisore: stage = confermato
→ createBookingRecord(consultantId, null, {date, time, phone, email}, 'voice_call')
→ createGoogleCalendarBooking(consultantId, booking, email)
→ Inietta conferma: "Appuntamento confermato! Ti mando l'invito calendario."
```

**SCENARIO D - Outbound a non-cliente (phone già noto)**
```
[Chiamata in uscita a +39 333 1234567]
AI: "Ciao! Sono Alessia, ti chiamo per conto di Marco Rossi.
     Volevo chiederti se sei ancora interessato a una consulenza."
Utente: "Sì, volevo proprio chiamare!"
AI: "Ottimo! Ho slot disponibili giovedì alle 10 e venerdì alle 15.
     Quale preferisci?"
Utente: "Venerdì alle 15"
AI: "Perfetto! Mi confermi la tua email per mandarti l'invito?"
Utente: "mario@gmail.com"
AI: "Venerdì 14 febbraio alle 15:00, email mario@gmail.com. Confermi?"
Utente: "Confermo"

→ Supervisore: phone = outboundTargetPhone (già noto dalla scheduledCall)
→ stage = confermato
→ createBookingRecord(consultantId, null,
   {date, time, phone: "3331234567", email: "mario@gmail.com"}, 'voice_call')
```

---

## 8. MODIFICHE PER FILE

### 8.1 FILE NUOVI

```
┌──────────────────────────────────────────────────────────────────────┐
│ FILE: server/voice/voice-booking-supervisor.ts  (~400-500 righe)    │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│ EXPORTS:                                                             │
│                                                                      │
│ class VoiceBookingSupervisor {                                       │
│   constructor(options: {                                             │
│     consultantId: string;                                            │
│     clientId: string | null;         // null = non-cliente           │
│     voiceCallId: string;                                             │
│     outboundTargetPhone: string | null; // per outbound              │
│     availableSlots: AvailableSlot[];  // pre-caricati                │
│   })                                                                 │
│                                                                      │
│   async analyzeTranscript(                                           │
│     messages: ConversationMessage[],  // da conversationMessages     │
│     aiClient: GeminiClient            // per LLM analisi             │
│   ): Promise<SupervisorResult>                                       │
│                                                                      │
│   getState(): VoiceBookingSupervisorState                            │
│   reset(): void                                                      │
│   getBookingPromptSection(): string   // sezione per system prompt   │
│   getAvailableSlotsForPrompt(): string // formattazione slot         │
│ }                                                                    │
│                                                                      │
│ interface SupervisorResult {                                         │
│   action: 'none' | 'booking_created' | 'booking_failed' |           │
│           'notify_ai';                                               │
│   bookingId?: string;                                                │
│   bookingType?: 'consultation' | 'appointment';                     │
│   googleMeetLink?: string;                                           │
│   errorMessage?: string;                                             │
│   notifyMessage?: string;   // messaggio da iniettare a Gemini      │
│ }                                                                    │
│                                                                      │
│ IMPLEMENTAZIONE INTERNA:                                             │
│                                                                      │
│ - buildAnalysisPrompt(): prompt per Gemini Flash Lite               │
│ - parseAnalysisResult(): parse JSON risposta                         │
│ - executeBookingForClient(): usa consultation-tool-executor          │
│ - executeBookingForLead(): usa booking-service                       │
│ - updateState(): transizione state machine                           │
│ - shouldSkipAnalysis(): ottimizzazione (non analizzare ogni turn)    │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

### 8.2 FILE MODIFICATI

```
┌──────────────────────────────────────────────────────────────────────┐
│ FILE: server/ai/gemini-live-ws-service.ts                           │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│ MODIFICA 1: Import (top of file)                                     │
│   + import { VoiceBookingSupervisor } from "../voice/voice-booking- │
│     supervisor";                                                     │
│                                                                      │
│ MODIFICA 2: Pre-load slot (~linea 1027, dopo lookup userId)         │
│   + Pre-fetch available slots per il consultantId                    │
│   + Salva in variabile per passare al supervisore                    │
│                                                                      │
│ MODIFICA 3: System prompt - sezione booking (~linea 3670-3680)      │
│   + Aggiungere sezione "GESTIONE APPUNTAMENTI" al prompt            │
│   + Include slot disponibili formattati                              │
│   + Include istruzioni di conferma vocale                            │
│                                                                      │
│ MODIFICA 4: Istanziare supervisore (~linea 1536, variabili locali)  │
│   + let bookingSupervisor: VoiceBookingSupervisor | null = null;    │
│   + Inizializzazione dopo auth con isPhoneCall check                │
│                                                                      │
│ MODIFICA 5: Hook post-AI-turn (~dopo currentAiTranscript commit)   │
│   + Quando AI finisce di parlare (isAiSpeaking → false)             │
│   + Chiama bookingSupervisor.analyzeTranscript()                     │
│   + Se action = 'booking_created' → inietta conferma                │
│   + Se action = 'notify_ai' → inietta messaggio di sistema          │
│                                                                      │
│ MODIFICA 6: Aggiorna voiceCall metadata su booking creato            │
│   + Salva bookingId e bookingType nel metadata jsonb                 │
│                                                                      │
├──────────────────────────────────────────────────────────────────────┤
│ FILE: server/booking/booking-service.ts                              │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│ MODIFICA: Aggiungere 'voice_call' al tipo source                    │
│   processFullBooking(..., source: '...' | 'voice_call')             │
│   createBookingRecord(..., source: '...' | 'voice_call')            │
│                                                                      │
├──────────────────────────────────────────────────────────────────────┤
│ FILE: shared/schema.ts                                               │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│ MODIFICA: appointmentBookings.source - aggiungere 'voice_call'      │
│   source: text("source").$type<"whatsapp" | "public_link" |        │
│     "instagram" | "public_page" | "voice_call">()                   │
│                                                                      │
├──────────────────────────────────────────────────────────────────────┤
│ FILE: client/src/pages/consultant-voice-calls.tsx                    │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│ MODIFICA: Aggiungere badge "Appuntamento Creato" nella lista        │
│   chiamate quando metadata.bookingCreated = true                     │
│   + Badge verde con icona CalendarCheck                              │
│   + Tooltip con data/ora appuntamento                                │
│   + Link a dettagli consulenza (se consultation) o booking          │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 9. SCHEMA DATABASE

### 9.1 Modifiche Schema

```
TABELLA: appointment_bookings
  → Aggiungere 'voice_call' alla union type del campo source
  → Aggiungere campo opzionale: voiceCallId (riferimento a voice_calls.id)

TABELLA: voice_calls
  → Il campo metadata (jsonb) conterrà:
    {
      bookingCreated: boolean,
      bookingId: string,
      bookingType: 'consultation' | 'appointment',
      googleMeetLink: string | null
    }
  → NESSUNA modifica schema necessaria (metadata è già jsonb)
```

### 9.2 Relazioni

```
voice_calls.metadata.bookingId ──────▶ consultations.id (se cliente)
                                ──────▶ appointment_bookings.id (se non-cliente)

appointment_bookings.source = 'voice_call' (nuovo valore)
appointment_bookings.voiceCallId ────▶ voice_calls.id (nuovo campo opzionale)
```

---

## 10. FRONTEND UI

### Badge nella lista chiamate

```
┌─────────────────────────────────────────────────────────────────┐
│ CHIAMATE VOCALI                                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│ 📞 +39 333 1234567          12 Feb 2026, 15:32   5 min 23s     │
│    ✅ Appuntamento Creato → Mer 14 Feb alle 10:00              │
│                                                                  │
│ 📞 Mario Rossi              12 Feb 2026, 14:15   3 min 10s     │
│    (nessun appuntamento)                                         │
│                                                                  │
│ 📞 +39 340 9876543          11 Feb 2026, 11:02   8 min 45s     │
│    ✅ Appuntamento Creato → Gio 13 Feb alle 15:00              │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 11. STEP DI IMPLEMENTAZIONE

### Step 1: Schema DB
- Aggiungere `'voice_call'` al tipo source in `appointmentBookings` (schema.ts)
- Eseguire `npm run db:push`

### Step 2: Creare `server/voice/voice-booking-supervisor.ts`
- Implementare state machine completa
- Prompt di analisi trascrizione per Gemini Flash Lite
- Metodo `analyzeTranscript()` con parse JSON
- Metodo `executeBookingForClient()` che usa `consultation-tool-executor`
- Metodo `executeBookingForLead()` che usa `booking-service`
- Metodo `getBookingPromptSection()` per system prompt
- Metodo `getAvailableSlotsForPrompt()` per formattare slot
- Logging dettagliato per ogni transizione di stato

### Step 3: Integrare in `gemini-live-ws-service.ts`
- Pre-caricare slot disponibili durante setup (prima del system prompt)
- Aggiungere sezione booking al system prompt per phone_service
- Istanziare `VoiceBookingSupervisor` per ogni chiamata phone_service
- Hook post-AI-turn: chiamare `analyzeTranscript()` dopo ogni turno AI completato
- Se risultato = booking_created → iniettare conferma via clientContent
- Aggiornare voiceCall metadata con booking info

### Step 4: Aggiungere `'voice_call'` come source valido
- `booking-service.ts` → tipo source in `createBookingRecord()`
- `booking-service.ts` → tipo source in `processFullBooking()`

### Step 5: UI Badge
- `consultant-voice-calls.tsx` → leggere metadata.bookingCreated
- Mostrare badge verde "Appuntamento Creato" con data/ora
- Link ai dettagli

### Step 6: Testing e Debug
- Test Scenario A: cliente registrato booking vocale
- Test Scenario B: non-cliente booking vocale
- Test Scenario G: correzione utente durante raccolta
- Verificare Google Calendar + Meet link creation
- Verificare che il supervisore non triggeri su conversazioni senza booking

---

## APPENDICE: PROMPT DI ANALISI DEL SUPERVISORE

```
Il supervisore usa questo prompt per analizzare la trascrizione:

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Analizza questa trascrizione di una CHIAMATA VOCALE.
Determina se c'è un intento di prenotazione appuntamento.

STATO ATTUALE: {currentStage}
DATI GIÀ ESTRATTI: {currentData}
TIPO CHIAMANTE: {isClient ? "CLIENTE REGISTRATO" : "NON-CLIENTE"}

TRASCRIZIONE RECENTE:
{last N messages formatted}

RISPONDI SOLO con un oggetto JSON:
{
  "newStage": "nessun_intento|raccolta_dati|dati_completi|confermato",
  "date": "YYYY-MM-DD" o null,
  "time": "HH:MM" o null,
  "confirmed": true/false,
  "phone": "numero" o null (solo se non-cliente e lo dice),
  "email": "email" o null (solo se non-cliente e lo dice),
  "name": "nome" o null,
  "correction": true/false (se l'utente ha corretto un dato),
  "reasoning": "spiegazione breve della decisione"
}

REGOLE:
1. confirmed = true SOLO se l'utente ha detto esplicitamente
   "sì", "confermo", "va bene", "ok prenota" DOPO che l'AI
   ha ripetuto data e ora
2. Se l'utente dice "anzi no", "aspetta", "cambiamo" →
   correction = true, reset i campi corretti
3. Se la conversazione non parla di appuntamenti →
   newStage = "nessun_intento"
4. Estrai la data dall'AI response se il lead è abbreviato
   (es: "mercoledì" → guarda cosa dice l'AI per la data esatta)
5. Per non-clienti: confermato = true SOLO se hai ANCHE
   phone e email
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## NOTE FINALI

### Ottimizzazioni Performance
- Il supervisore NON viene chiamato a ogni singolo audio chunk
- Viene chiamato SOLO dopo che l'AI ha completato un turno di risposta
- Usa Gemini 2.5 Flash Lite (veloce, economico, sufficiente per analisi JSON)
- Skip automatico se la conversazione non ha menzionato nulla di booking-related

### Sicurezza Anti-Duplicato
- Il supervisore ha un mutex interno: una volta in stato `confermato`, non può essere ri-triggerato
- `bookingAttempts` traccia i tentativi per evitare loop
- Dopo `completato`, il supervisore ignora tutti i messaggi successivi sul booking

### Compatibilità
- Funziona con tutti i 4 scenari vocali (inbound/outbound × client/non-client)
- Non interferisce con il flusso vocale esistente
- Non modifica la conversazione Gemini (solo inietta messaggi di conferma)
- Riusa al 100% i booking services esistenti senza modificarli
