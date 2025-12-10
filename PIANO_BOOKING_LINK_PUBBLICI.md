# Piano Tecnico: Booking Automatico per Link Pubblici (Iframe/Embed)

## Panoramica Progetto

**Obiettivo**: Implementare il sistema di booking automatico (già funzionante per WhatsApp/Twilio) anche per i link pubblici condivisi via iframe o embed su siti esterni.

**Stato Attuale**:
- WhatsApp/Twilio: Booking automatico completo (estrazione dati, validazione, Google Calendar, email conferma)
- Link Pubblici: Solo chat AI + cronologia, NESSUN booking automatico

---

## Architettura Attuale

### Sistema WhatsApp (Funzionante)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        WHATSAPP/TWILIO FLOW                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────┐    ┌─────────────────────┐    ┌──────────────────────────┐   │
│  │  Lead    │───▶│  message-processor  │───▶│  Estrazione Dati AI      │   │
│  │ WhatsApp │    │        .ts          │    │  (gemini-2.5-flash)      │   │
│  └──────────┘    └─────────────────────┘    └──────────────────────────┘   │
│                            │                           │                    │
│                            │                           ▼                    │
│                            │              ┌──────────────────────────┐     │
│                            │              │  Validazione:            │     │
│                            │              │  - Data >= oggi          │     │
│                            │              │  - hasAllData check      │     │
│                            │              │  - Slot disponibili      │     │
│                            │              └──────────────────────────┘     │
│                            │                           │                    │
│                            ▼                           ▼                    │
│              ┌──────────────────────────────────────────────────┐          │
│              │           BOOKING CREATO                         │          │
│              │  - appointmentBookings (DB)                      │          │
│              │  - Google Calendar Event                         │          │
│              │  - Email conferma lead                           │          │
│              │  - Email notifica consultant                     │          │
│              └──────────────────────────────────────────────────┘          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Sistema Link Pubblici (Da Implementare)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       LINK PUBBLICO / IFRAME FLOW                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────┐    ┌─────────────────────┐    ┌──────────────────────────┐   │
│  │ Visitor  │───▶│ public-share-router │───▶│  Chat AI Streaming       │   │
│  │ (iframe) │    │        .ts          │    │  (processConsultant...)  │   │
│  └──────────┘    └─────────────────────┘    └──────────────────────────┘   │
│       │                    │                           │                    │
│       │                    │                           │                    │
│       │                    ▼                           ▼                    │
│       │         ┌──────────────────────────────────────────────────┐       │
│       │         │  MANCA COMPLETAMENTE:                            │       │
│       │         │  ❌ Estrazione automatica dati                   │       │
│       │         │  ❌ Validazione slot                             │       │
│       │         │  ❌ Creazione Google Calendar                    │       │
│       │         │  ❌ Email conferma                               │       │
│       │         └──────────────────────────────────────────────────┘       │
│       │                                                                     │
│       │    ATTUALMENTE: Solo salvataggio messaggi in                       │
│       └──▶ whatsappAgentConsultantMessages + whatsappAgentConsultantConv.  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Soluzione Proposta

### Architettura Target

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    NUOVO FLUSSO LINK PUBBLICI                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────┐    ┌─────────────────────┐    ┌──────────────────────────┐   │
│  │ Visitor  │───▶│ public-share-router │───▶│  Chat AI Streaming       │   │
│  │ (iframe) │    │        .ts          │    │  (processConsultant...)  │   │
│  └──────────┘    └─────────────────────┘    └──────────────────────────┘   │
│                            │                           │                    │
│                            │                           ▼                    │
│                            │              ┌──────────────────────────┐     │
│                            │              │  NUOVO: booking-service  │     │
│                            │              │  (servizio condiviso)    │     │
│                            │              └──────────────────────────┘     │
│                            │                           │                    │
│                            ▼                           ▼                    │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                    BOOKING COMPLETO                                   │  │
│  │  ✅ Estrazione dati AI (data, ora, nome, email, telefono)            │  │
│  │  ✅ Validazione slot disponibili                                     │  │
│  │  ✅ Creazione evento Google Calendar                                 │  │
│  │  ✅ Email conferma visitatore                                        │  │
│  │  ✅ Notifica consultant                                              │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## File da Creare/Modificare

### 1. NUOVO FILE: `server/booking/booking-service.ts`

**Scopo**: Servizio condiviso per gestire booking da qualsiasi fonte (WhatsApp O Link Pubblico)

```typescript
// Struttura del nuovo servizio
export interface BookingExtractionResult {
  isConfirming: boolean;
  date: string | null;        // "YYYY-MM-DD"
  time: string | null;        // "HH:MM"
  phone: string | null;
  email: string | null;
  name: string | null;
  confidence: 'high' | 'medium' | 'low';
  hasAllData: boolean;
}

export interface BookingModificationResult {
  intent: 'MODIFY' | 'CANCEL' | 'ADD_ATTENDEES' | 'NONE';
  newDate: string | null;
  newTime: string | null;
  attendees: string[];
  confirmedTimes: number;
  confidence: 'high' | 'medium' | 'low';
}

export interface BookingCreationResult {
  success: boolean;
  bookingId: string | null;
  googleEventId: string | null;
  errorMessage: string | null;
}

// Funzioni da implementare
export async function extractBookingDataFromConversation(
  messages: Message[],
  existingBooking?: ExistingBooking
): Promise<BookingExtractionResult | BookingModificationResult>;

export async function validateBookingData(
  extracted: BookingExtractionResult,
  consultantId: string,
  timezone: string
): Promise<ValidationResult>;

export async function createBooking(
  consultantId: string,
  conversationId: string,
  data: ValidatedBookingData,
  source: 'whatsapp' | 'public_link'
): Promise<BookingCreationResult>;

export async function sendConfirmationEmail(
  booking: Booking,
  recipientEmail: string,
  consultantInfo: ConsultantInfo
): Promise<void>;
```

### 2. MODIFICA: `server/routes/whatsapp/public-share-router.ts`

**Linee da modificare**: ~530-570 (dopo salvataggio messaggio AI)

**Aggiungere dopo riga 559**:
```typescript
// NUOVO: Booking automatico per link pubblici
// Verificare se l'agente ha booking abilitato
if (agentConfig.bookingEnabled !== false) {
  try {
    const bookingResult = await processPublicLinkBooking(
      conversation,
      agentConfig,
      share,
      fullResponse
    );
    
    if (bookingResult.bookingCreated) {
      // Inviare conferma via SSE
      res.write(`data: ${JSON.stringify({ 
        type: 'booking_confirmed',
        booking: bookingResult.booking 
      })}\n\n`);
    }
  } catch (bookingError) {
    console.error('Booking error:', bookingError);
    // Non bloccare la risposta - solo log
  }
}
```

### 3. MODIFICA: `server/whatsapp/message-processor.ts`

**Refactoring richiesto**: Estrarre la logica di booking (linee ~1936-2900) in funzioni riutilizzabili nel nuovo `booking-service.ts`

**Funzioni da estrarre**:
- Prompt di estrazione dati (linee 2017-2224)
- Logica validazione date (linee 2630-2684)
- Creazione Google Calendar event (linee 2686-2900)
- Invio email conferma

---

## Schema Database

### Tabelle Coinvolte

```sql
-- Già esistente - usata anche per link pubblici
CREATE TABLE appointment_bookings (
  id TEXT PRIMARY KEY,
  consultant_id TEXT NOT NULL,
  conversation_id TEXT,                    -- WhatsApp conversation
  public_conversation_id TEXT,             -- NUOVO: per link pubblici
  
  -- Dati appuntamento
  appointment_date TEXT NOT NULL,          -- "YYYY-MM-DD"
  appointment_time TEXT NOT NULL,          -- "HH:MM"
  duration_minutes INTEGER DEFAULT 60,
  
  -- Dati cliente
  client_name TEXT,
  client_email TEXT,
  client_phone TEXT,
  
  -- Google Calendar
  google_event_id TEXT,
  google_calendar_link TEXT,
  
  -- Metadata
  source TEXT DEFAULT 'whatsapp',          -- 'whatsapp' | 'public_link'
  status TEXT DEFAULT 'confirmed',
  created_at TIMESTAMP DEFAULT NOW()
);

-- Già esistente - conversazioni link pubblici
CREATE TABLE whatsapp_agent_consultant_conversations (
  id TEXT PRIMARY KEY,
  consultant_id TEXT NOT NULL,
  agent_config_id TEXT NOT NULL,
  share_id TEXT,                           -- Link al share pubblico
  external_visitor_id TEXT,                -- ID visitatore anonimo
  customer_name TEXT,
  phone_number TEXT,
  visitor_metadata JSONB,
  ...
);
```

### Nuova Colonna da Aggiungere

```sql
-- Migrazione
ALTER TABLE appointment_bookings 
ADD COLUMN public_conversation_id TEXT REFERENCES whatsapp_agent_consultant_conversations(id);

ALTER TABLE appointment_bookings 
ADD COLUMN source TEXT DEFAULT 'whatsapp';
```

---

## Flusso Dettagliato

### Diagramma Sequenza: Booking da Link Pubblico

```
┌─────────┐     ┌──────────────┐     ┌──────────────┐     ┌─────────────┐     ┌────────────┐
│ Visitor │     │ public-share │     │  booking-    │     │   Google    │     │   Email    │
│ (iframe)│     │   -router    │     │   service    │     │  Calendar   │     │  Service   │
└────┬────┘     └──────┬───────┘     └──────┬───────┘     └──────┬──────┘     └─────┬──────┘
     │                 │                    │                    │                  │
     │  Messaggio      │                    │                    │                  │
     │  "Prenoto per   │                    │                    │                  │
     │   domani 15:00" │                    │                    │                  │
     │─────────────────▶                    │                    │                  │
     │                 │                    │                    │                  │
     │                 │  AI genera risposta│                    │                  │
     │                 │  (streaming SSE)   │                    │                  │
     │                 │───────────────────▶│                    │                  │
     │                 │                    │                    │                  │
     │  ◀──────────────│  Chunks testo      │                    │                  │
     │  (SSE stream)   │                    │                    │                  │
     │                 │                    │                    │                  │
     │                 │  POST risposta     │                    │                  │
     │                 │  completata        │                    │                  │
     │                 │───────────────────▶│                    │                  │
     │                 │                    │                    │                  │
     │                 │                    │  extractBookingData│                  │
     │                 │                    │  (AI Gemini 2.5)   │                  │
     │                 │                    │────────────────────│                  │
     │                 │                    │                    │                  │
     │                 │                    │  Dati estratti:    │                  │
     │                 │                    │  - date: 2025-12-11│                  │
     │                 │                    │  - time: 15:00     │                  │
     │                 │                    │  - email: x@y.com  │                  │
     │                 │                    │  - hasAllData: true│                  │
     │                 │                    │                    │                  │
     │                 │                    │  validateSlot()    │                  │
     │                 │                    │────────────────────│                  │
     │                 │                    │                    │                  │
     │                 │                    │  createCalendarEvent                  │
     │                 │                    │────────────────────▶                  │
     │                 │                    │                    │                  │
     │                 │                    │◀───────────────────│                  │
     │                 │                    │  eventId + link    │                  │
     │                 │                    │                    │                  │
     │                 │                    │  saveBooking()     │                  │
     │                 │                    │  (database)        │                  │
     │                 │                    │                    │                  │
     │                 │                    │  sendConfirmation()│                  │
     │                 │                    │────────────────────────────────────────▶
     │                 │                    │                    │                  │
     │                 │◀───────────────────│                    │                  │
     │                 │  BookingResult     │                    │                  │
     │                 │                    │                    │                  │
     │  ◀──────────────│  SSE: booking_     │                    │                  │
     │                 │  confirmed         │                    │                  │
     │                 │                    │                    │                  │
     ▼                 ▼                    ▼                    ▼                  ▼
```

---

## Prompt AI per Estrazione Dati

### Prompt Estrazione Nuova Prenotazione

```
Analizza questa conversazione recente di un visitatore che sta prenotando un appuntamento:

CONVERSAZIONE RECENTE:
${conversationContext}

TASK: Estrai TUTTI i dati forniti dal visitatore durante la conversazione.

RISPONDI SOLO con un oggetto JSON nel seguente formato:
{
  "isConfirming": true/false,
  "date": "YYYY-MM-DD" (null se non confermato),
  "time": "HH:MM" (null se non confermato),
  "phone": "numero di telefono" (null se non fornito),
  "email": "email@example.com" (null se non fornita),
  "name": "nome del visitatore" (null se non fornito),
  "confidence": "high/medium/low",
  "hasAllData": true/false (true solo se hai data, ora, telefono ED email)
}

REGOLE CRITICHE:
1. Cerca i dati in TUTTA la conversazione, non solo ultimo messaggio
2. hasAllData = true SOLO se hai TUTTI i campi: date, time, phone, email
3. Per link pubblici, il NAME è importante per identificare il visitatore

DATA CORRENTE: ${new Date().toLocaleDateString('it-IT')}
```

### Prompt Gestione Modifica/Cancellazione

```
Analizza questa conversazione di un visitatore che ha GIÀ un appuntamento confermato:

APPUNTAMENTO ESISTENTE:
- Data: ${existingBooking.appointmentDate}
- Ora: ${existingBooking.appointmentTime}
- Email: ${existingBooking.clientEmail}

CONVERSAZIONE RECENTE:
${conversationContext}

TASK: Identifica se il visitatore vuole MODIFICARE, CANCELLARE, o solo CONVERSARE.

RISPONDI con JSON:
{
  "intent": "MODIFY" | "CANCEL" | "NONE",
  "newDate": "YYYY-MM-DD" (solo se intent=MODIFY),
  "newTime": "HH:MM" (solo se intent=MODIFY),
  "confirmedTimes": numero (1 per MODIFY, 2 per CANCEL),
  "confidence": "high/medium/low"
}
```

---

## Componenti Google Calendar

### Funzioni Esistenti da Riutilizzare

File: `server/google-calendar-service.ts`

```typescript
// Già implementate - da riutilizzare
export async function createGoogleCalendarEvent(
  consultantId: string,
  eventData: CalendarEventData
): Promise<CalendarEventResult>;

export async function updateGoogleCalendarEvent(
  consultantId: string,
  eventId: string,
  updates: Partial<CalendarEventData>
): Promise<void>;

export async function deleteGoogleCalendarEvent(
  consultantId: string,
  eventId: string
): Promise<void>;

export async function addAttendeesToGoogleCalendarEvent(
  consultantId: string,
  eventId: string,
  attendeeEmails: string[]
): Promise<{ added: number; skipped: number }>;
```

### Formato Evento Calendar

```typescript
interface CalendarEventData {
  summary: string;           // "Appuntamento con [Nome Visitatore]"
  description: string;       // Dettagli + fonte (link pubblico)
  startDateTime: string;     // ISO 8601
  endDateTime: string;       // ISO 8601
  attendees: string[];       // [visitorEmail]
  location?: string;
  conferenceData?: {         // Per Google Meet
    createRequest: {
      requestId: string;
      conferenceSolutionKey: { type: 'hangoutsMeet' }
    }
  };
}
```

---

## Email di Conferma

### Template Email Visitatore

```html
Subject: ✅ Conferma Appuntamento - ${consultantName}

Ciao ${visitorName},

Il tuo appuntamento è stato confermato!

📅 Data: ${formattedDate}
🕐 Ora: ${formattedTime}
⏱️ Durata: ${duration} minuti

${googleMeetLink ? `
🔗 Link Google Meet: ${googleMeetLink}
` : ''}

📎 Aggiungi al calendario: ${googleCalendarLink}

---
Per modificare o cancellare l'appuntamento, rispondi a questa email 
o torna sulla chat.

${businessName}
```

### Template Email Consultant (Notifica)

```html
Subject: 🆕 Nuovo Appuntamento da Link Pubblico

Hai un nuovo appuntamento prenotato tramite link pubblico!

👤 Visitatore: ${visitorName}
📧 Email: ${visitorEmail}
📞 Telefono: ${visitorPhone || 'Non fornito'}

📅 Data: ${formattedDate}
🕐 Ora: ${formattedTime}

🔗 Fonte: ${shareName} (link pubblico)

Vedi dettagli nel pannello di controllo.
```

---

## Checklist Implementazione

### Fase 1: Servizio Condiviso
- [ ] Creare `server/booking/booking-service.ts`
- [ ] Estrarre funzioni da `message-processor.ts`
- [ ] Implementare `extractBookingDataFromConversation()`
- [ ] Implementare `validateBookingData()`
- [ ] Implementare `createBooking()`
- [ ] Test unitari servizio

### Fase 2: Integrazione Link Pubblici
- [ ] Modificare `public-share-router.ts`
- [ ] Aggiungere chiamata a booking-service dopo risposta AI
- [ ] Gestire SSE per conferma booking
- [ ] Aggiungere migrazione DB (colonna `source`, `public_conversation_id`)

### Fase 3: Email e Notifiche
- [ ] Implementare `sendConfirmationEmail()` per visitatori web
- [ ] Implementare notifica consultant
- [ ] Template email responsive

### Fase 4: Testing
- [ ] Test flusso completo: chat → estrazione → calendar → email
- [ ] Test modifica appuntamento
- [ ] Test cancellazione appuntamento
- [ ] Test edge cases (dati parziali, date passate, slot non disponibili)

---

## Configurazione Richiesta

### Variabili Ambiente
```bash
# Già configurate per WhatsApp
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=

# Email (se non già configurato)
SMTP_HOST=
SMTP_PORT=
SMTP_USER=
SMTP_PASS=
EMAIL_FROM=
```

### Permessi Google Calendar API
- `https://www.googleapis.com/auth/calendar`
- `https://www.googleapis.com/auth/calendar.events`

---

## Note Tecniche Importanti

1. **Differenza chiave WhatsApp vs Link Pubblico**:
   - WhatsApp: `conversationId` in tabella `whatsapp_conversations`
   - Link Pubblico: `public_conversation_id` in tabella `whatsapp_agent_consultant_conversations`

2. **Identificazione Visitatore**:
   - WhatsApp: numero telefono come ID univoco
   - Link Pubblico: `externalVisitorId` (nanoid generato)

3. **Streaming SSE**:
   - Il booking viene processato DOPO che la risposta AI è completata
   - Un evento SSE `booking_confirmed` notifica il frontend

4. **Retry e Fallback**:
   - Se estrazione AI fallisce → log errore, non bloccare chat
   - Se Google Calendar fallisce → salvare booking senza eventId, notificare consultant

---

## Stima Effort

| Task | Complessità | Ore Stimate |
|------|-------------|-------------|
| booking-service.ts | Media | 4-6 ore |
| Integrazione public-share-router | Media | 3-4 ore |
| Migrazione DB | Bassa | 1 ora |
| Email templates | Bassa | 2 ore |
| Testing completo | Alta | 4-6 ore |
| **TOTALE** | | **14-19 ore** |

---

*Documento generato automaticamente - v1.0*
*Data: ${new Date().toLocaleDateString('it-IT')}*
