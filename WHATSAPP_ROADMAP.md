# 📱 WhatsApp Business Integration - Roadmap Implementazione

**Data ultimo aggiornamento:** 29 Ottobre 2025  
**Stato attuale:** ✅ Fase 1 completata (Core Twilio MVP)

---

## 📊 Panoramica Progetto

Sistema di integrazione WhatsApp Business via Twilio per piattaforma fitness/finanza, con AI conversazionale, riconoscimento cliente/lead, multi-tenant e dashboard real-time.

### 🎯 Obiettivi
- **Riconoscimento automatico** cliente (contesto completo) vs lead (script acquisizione)
- **Multi-tenant**: ogni consulente ha credenziali Twilio isolate
- **AI conversazionale**: risposte automatiche usando Gemini AI con contesto utente
- **Dashboard real-time**: monitoring conversazioni con WebSocket
- **Rich media**: gestione immagini, PDF, audio con AI Vision
- **Analytics**: KPI, statistiche utilizzo, conversione lead
- **Calendario**: booking automatico appuntamenti

---

## ✅ FASE 1 - CORE TWILIO MVP (COMPLETATA)

### Cosa è stato implementato

#### 1. Database Schema (5 tabelle)
- ✅ `consultant_whatsapp_config` - Configurazione Twilio per consulente
  - Credenziali: accountSid, authToken, whatsappNumber
  - Toggle: isActive, autoResponseEnabled
  - **CONSTRAINT UNIQUE** su `consultant_id` aggiunto

- ✅ `whatsapp_conversations` - Conversazioni WhatsApp
  - Associazione: phoneNumber → userId (client) o NULL (lead)
  - AI control: aiEnabled, overriddenAt
  - Tracking: messageCount, unreadByConsultant
  - Lead tracking: isLead, leadConvertedAt

- ✅ `whatsapp_messages` - Messaggi inviati/ricevuti
  - Contenuto: messageText, direction (inbound/outbound)
  - Sender: client | consultant | ai
  - Twilio tracking: twilioSid, twilioStatus
  - Batching: isBatched, batchId
  - Media: mediaType, mediaUrl, localMediaPath

- ✅ `whatsapp_pending_messages` - Queue debouncing (4 sec)
  - Temporanea: receivedAt, processedAt
  - Batching multipli messaggi rapidi

- ✅ `whatsapp_global_api_keys` - Pool API keys per lead
  - Rotazione: lastUsedAt, usageCount
  - Status: isActive

#### 2. Server Infrastructure

**File implementati:**
- ✅ `server/whatsapp/webhook-handler.ts`
  - Gestisce messaggi in arrivo da Twilio webhook
  - Validazione firma Twilio (firma X-Twilio-Signature)
  - Riconoscimento cliente vs lead (lookup phoneNumber)
  - Inserimento in `whatsapp_pending_messages`
  - **FIX APPLICATO**: ora chiama `scheduleMessageProcessing()`

- ✅ `server/whatsapp/message-processor.ts`
  - **Debouncing 4 secondi**: messaggi multipli → 1 risposta batched
  - Selezione API key: cliente usa propria, lead usa pool globale
  - Build contesto AI: `buildUserContext()` per clienti (esercizi, finanze, consulenze)
  - Build system prompt: clienti vs lead (script acquisizione)
  - Generazione risposta: Gemini AI `generateContent()`
  - Invio risposta via Twilio

- ✅ `server/whatsapp/twilio-client.ts`
  - Invio messaggi outbound tramite Twilio API
  - Recupero configurazione consulente
  - Salvataggio twilioSid per tracking

- ✅ `server/whatsapp/polling-service.ts`
  - **Alternativa ai webhook** (l'utente NON può usare webhook callbacks attualmente)
  - Polling ogni 30 secondi (configurabile via `WHATSAPP_POLL_INTERVAL_SECONDS`)
  - Recupera nuovi messaggi tramite Twilio API `client.messages.list()`
  - Passa messaggi a `handleWebhook()` per processing

#### 3. API Endpoints

- ✅ `GET /api/whatsapp/config` - Recupera configurazione consulente
  - Auth: `authenticateToken` + `requireRole("consultant")`
  - Risposta: esclude credenziali sensibili (twilioAuthToken)

- ✅ `POST /api/whatsapp/config` - Salva/aggiorna configurazione
  - Validazione: formato numero WhatsApp (`+` + 10-15 cifre)
  - Upsert: crea nuova config o aggiorna esistente
  - Security: sanitizza risposta (no auth token)

- ✅ `POST /api/whatsapp/webhook` - Endpoint webhook Twilio
  - Validazione firma X-Twilio-Signature
  - Chiamata a `handleWebhook()`

#### 4. Frontend UI

- ✅ `client/src/pages/consultant-whatsapp.tsx`
  - Form configurazione: Account SID, Auth Token, Numero WhatsApp
  - Toggle: Auto Response AI
  - Status badge: Configurato / Non Configurato / Errore
  - Link diretto a Twilio Console
  - Istruzioni setup Sandbox

- ✅ `client/src/components/sidebar.tsx`
  - Aggiunta voce menu "WhatsApp" (icona MessageSquare, colore verde)

- ✅ `client/src/App.tsx`
  - Route `/consultant/whatsapp` con AuthGuard

#### 5. Integrazione AI Esistente

- ✅ Riuso funzioni esistenti:
  - `buildUserContext()` - Carica contesto completo cliente
  - `buildSystemPrompt()` - Genera prompt AI personalizzato
  - `detectIntent()` - Riconosce intent messaggio
  - `getCurrentApiKey()` - Rotazione API keys clienti

---

## 🚧 FASE 2 - RICH MEDIA (DA IMPLEMENTARE)

### Obiettivo
Gestire immagini, PDF, audio, video inviati dai clienti con analisi AI

### Tasks

#### 2.1 Ricezione Media
- [ ] Aggiornare `webhook-handler.ts` per gestire `NumMedia > 0`
- [ ] Download media da Twilio URL (`MediaUrl0`, `MediaContentType0`)
- [ ] Storage locale: `/storage/whatsapp/media/{messageId}_{filename}`
- [ ] Inserimento in `whatsapp_media_files` table

#### 2.2 AI Vision per Immagini
- [ ] Integrazione Gemini Vision API (`gemini-2.5-flash` supporta vision)
- [ ] Analisi automatica immagini: 
  - Riconoscimento contenuto (cibo, esercizi, documenti)
  - Estrazione testo (OCR)
  - Conteggio calorie se foto cibo
  - Form esercizi se foto palestra
- [ ] Salvataggio analisi in `whatsapp_media_files.aiAnalysis`

#### 2.3 Gestione PDF/Documenti
- [ ] Parsing PDF con libreria `pdf-parse`
- [ ] Estrazione testo da documenti
- [ ] Storage testo in `whatsapp_media_files.extractedText`
- [ ] AI analisi documenti finanziari (estratti conto, fatture)

#### 2.4 Audio/Trascrizione
- [ ] Download file audio da Twilio
- [ ] Trascrizione con Gemini Audio API
- [ ] Storage trascrizione in `whatsapp_messages.metadata.audioTranscript`
- [ ] Durata audio in `whatsapp_messages.metadata.audioDuration`

#### 2.5 Frontend Preview Media
- [ ] Componente preview immagini in dashboard conversazioni
- [ ] Download PDF direttamente dalla chat
- [ ] Player audio inline
- [ ] Visualizzazione analisi AI sotto media

### Nuove Tabelle Necessarie
**Già presenti** in schema.ts (pronte all'uso):
```typescript
whatsappMediaFiles {
  id, messageId, originalUrl, localPath, fileName, 
  fileSize, mimeType, downloaded, downloadedAt,
  aiProcessed, aiAnalysis, extractedText
}
```

### Package da Installare
```bash
npm install pdf-parse
npm install sharp  # Image processing
```

---

## 🚧 FASE 3 - DASHBOARD REAL-TIME (DA IMPLEMENTARE)

### Obiettivo
Dashboard live per consulente con conversazioni attive, notifiche WebSocket, invio messaggi manuali

### Tasks

#### 3.1 WebSocket Setup
- [ ] Configurare WebSocket server in `server/index.ts`
- [ ] Creare `server/whatsapp/websocket-handler.ts`
- [ ] Autenticazione WebSocket per consultanti
- [ ] Room per consulente: `whatsapp:consultant:{consultantId}`

#### 3.2 Eventi Real-Time
- [ ] **NEW_MESSAGE**: notifica nuovo messaggio inbound
- [ ] **MESSAGE_SENT**: conferma messaggio outbound
- [ ] **CONVERSATION_UPDATE**: cambio stato conversazione
- [ ] **TYPING_INDICATOR**: cliente sta scrivendo (opzionale)

#### 3.3 API Endpoints Dashboard
- [ ] `GET /api/whatsapp/conversations` - Lista conversazioni attive
  - Filtri: isActive, unreadOnly
  - Sort: lastMessageAt DESC
  - Include: lastMessage, unreadCount
  
- [ ] `GET /api/whatsapp/conversations/:id/messages` - Storia messaggi
  - Paginazione: limit, offset
  - Include: sender, timestamp, mediaType
  
- [ ] `POST /api/whatsapp/conversations/:id/send` - Invio manuale
  - Body: { messageText, mediaUrl? }
  - Sender: "consultant"
  - Disable AI per quella risposta
  
- [ ] `PATCH /api/whatsapp/conversations/:id/ai-toggle` - On/Off AI
  - Body: { aiEnabled: boolean }
  - Tracking: overriddenAt, overriddenBy

- [ ] `PATCH /api/whatsapp/conversations/:id/mark-read` - Marca letto
  - Reset unreadByConsultant counter
  - Update metadata.lastReadByConsultant

#### 3.4 Frontend Dashboard UI
- [ ] `client/src/pages/consultant-whatsapp-conversations.tsx`
  - Lista conversazioni sidebar (stile WhatsApp Web)
  - Preview ultimo messaggio + timestamp
  - Badge unread count
  - Filtri: All / Leads / Clients / Unread
  
- [ ] Componente Chat View
  - Messaggi scrollabili (bubble UI)
  - Indicatore sender: Cliente (sinistra) vs AI/Consultant (destra)
  - Input box per invio manuale
  - Toggle AI on/off prominente
  - Upload media (fase 2)

- [ ] WebSocket client integration
  - Auto-refresh lista conversazioni
  - Notifiche desktop per nuovi messaggi
  - Sound notification (opzionale)

### Schema Updates Necessari
Già presente `whatsappConversations.metadata`:
```typescript
metadata: {
  lastReadByConsultant?: string;
  tags?: string[];  // ["urgente", "vendita", "tecnico"]
  notes?: string;   // Note private consulente
}
```

---

## 🚧 FASE 4 - STATUS TRACKING (DA IMPLEMENTARE)

### Obiettivo
Tracking stato messaggi (Sent/Delivered/Read) con UI spunte stile WhatsApp

### Tasks

#### 4.1 Twilio Status Callbacks
**NOTA**: L'utente attualmente NON può usare webhook callbacks. Questa fase richiede configurazione webhook Twilio per status updates.

- [ ] Configurare Status Callback URL in Twilio
- [ ] Endpoint `POST /api/whatsapp/status-callback`
- [ ] Aggiornare `whatsappMessages.twilioStatus` con eventi:
  - `queued` → `sent` → `delivered` → `read`
  - `failed` / `undelivered` per errori

#### 4.2 Timestamp Tracking
- [ ] Aggiornare colonne già presenti:
  - `sentAt` - quando inviato da Twilio
  - `deliveredAt` - quando ricevuto dal telefono
  - `readAt` - quando letto dal cliente
  - `failedAt` - se fallito

#### 4.3 UI Spunte WhatsApp-like
- [ ] Icona singola spunta: `sent` ✓
- [ ] Doppia spunta grigia: `delivered` ✓✓
- [ ] Doppia spunta blu: `read` ✓✓ (blu)
- [ ] Alert rosso: `failed` ⚠️

#### 4.4 Error Handling
- [ ] Salvataggio `twilioErrorCode` e `twilioErrorMessage`
- [ ] Dashboard alert per messaggi falliti
- [ ] Retry automatico (max 3 tentativi)

---

## 🚧 FASE 5 - ANALYTICS & KPI (DA IMPLEMENTARE)

### Obiettivo
Statistiche utilizzo, conversion rate lead, dashboard rotazione API keys

### Tasks

#### 5.1 Daily Stats Collection
Tabella già presente: `whatsappDailyStats`

- [ ] Cron job giornaliero: calcolo metriche per consulente
  - `totalMessages`, `inboundMessages`, `outboundMessages`
  - `uniqueContacts`, `newLeads`, `convertedLeads`
  - `avgResponseTimeSeconds` (tempo tra inbound e AI response)
  - `aiResponses` vs `manualResponses`
  - `imagesReceived`, `documentsReceived`, `audioReceived`

#### 5.2 API Key Rotation Analytics
- [ ] Dashboard visualizzazione uso pool globale API keys
- [ ] Grafico distribuzione: quale key usata più spesso
- [ ] Alert se key vicina a quota limit
- [ ] Log completo in `whatsapp_api_key_rotation_log`

#### 5.3 Conversion Funnel
- [ ] Lead lifecycle tracking:
  1. **New lead** - primo messaggio
  2. **Engaged** - risposta a follow-up
  3. **Qualified** - informazioni raccolte
  4. **Converted** - diventa cliente (userId assegnato)
- [ ] Tempo medio conversione
- [ ] Drop-off rate per stage

#### 5.4 Frontend Analytics Dashboard
- [ ] `client/src/pages/consultant-whatsapp-analytics.tsx`
- [ ] Charts:
  - Messaggi per giorno (line chart)
  - Lead conversion rate (funnel)
  - Tempo risposta medio (bar chart)
  - API key usage (pie chart)
- [ ] Export CSV dati

#### 5.5 Package da Installare
```bash
npm install recharts  # Già presente
npm install date-fns  # Già presente
```

---

## 🚧 FASE 6 - INTEGRAZIONE CALENDARIO (DA IMPLEMENTARE)

### Obiettivo
AI riconosce richiesta appuntamento, propone slot, crea evento Google Calendar

### Tasks

#### 6.1 Intent Detection Appuntamento
- [ ] Aggiungere pattern in `detectIntent()`:
  - "vorrei prenotare", "quando sei disponibile", "appuntamento"
- [ ] AI risposta automatica con slot disponibili
- [ ] Esempio: "Sono disponibile: Lun 14:00, Mar 10:00, Gio 16:00"

#### 6.2 Slot Availability Check
- [ ] Query esistente tabella `consultations`
- [ ] Filtro: consulente + data/ora
- [ ] Esclusione: consultations già scheduled
- [ ] Rispetto orari consulente (9-18 working hours)

#### 6.3 Booking Automatico
- [ ] AI parsing risposta cliente: "Lun 14:00 va bene"
- [ ] Creazione automatica in `consultations`:
  - consultantId, clientId (se cliente) o NULL (lead)
  - scheduledAt, duration (default 60min)
  - status: "scheduled"
  
- [ ] Generazione Google Meet link (se configurato OAuth)
- [ ] Invio conferma WhatsApp con:
  - Data/ora appuntamento
  - Link Google Meet
  - Reminder 24h prima (Fase 7)

#### 6.4 Integration Google Calendar
- [ ] Riuso OAuth esistente per Google Calendar
- [ ] Creazione evento automatico
- [ ] Salvataggio `googleCalendarEventId` in consultation
- [ ] Cancellazione evento se consultation cancellata

---

## 🚧 FASE 7 - SISTEMA REMINDER FOLLOW-UP (DA IMPLEMENTARE)

### Obiettivo
Reminder automatici per lead inattivi, follow-up post-consulenza, check-in clienti

### Tasks

#### 7.1 Reminder Configuration
Tabella già presente: `whatsappFollowupReminders`

- [ ] Configurazione consulente:
  - Lead inattivo 24h → "Ciao! Posso aiutarti?"
  - Lead inattivo 48h → "Hai domande sui nostri servizi?"
  - Cliente inattivo 7 giorni → "Come stai andando con gli esercizi?"
  - Post-consulenza 24h → "Spero che la consulenza sia stata utile!"

#### 7.2 Cron Scheduler
- [ ] Cron job ogni ora: check reminder da inviare
- [ ] Query: `status = 'pending' AND scheduledFor <= NOW()`
- [ ] Invio messaggio via Twilio
- [ ] Update: `status = 'sent'`, `sentAt = NOW()`

#### 7.3 Reply Tracking
- [ ] Webhook/polling detecta risposta dopo reminder
- [ ] Update: `receivedReply = true`, `repliedAt = NOW()`
- [ ] Analytics: % reply rate per tipo reminder

#### 7.4 Frontend Reminder Config
- [ ] `client/src/pages/consultant-whatsapp-reminders.tsx`
- [ ] Toggle: enable/disable reminder types
- [ ] Custom message templates
- [ ] Trigger timing configuration (hours)
- [ ] History reminders inviati

---

## 🚧 FASE 8 - MULTI-LANGUAGE SUPPORT (OPZIONALE)

### Tasks
- [ ] Detection lingua cliente: analisi primo messaggio
- [ ] AI risposta nella lingua rilevata
- [ ] Storage: `whatsappConversations.metadata.language`
- [ ] Support: IT, EN, ES, FR

---

## 🚧 FASE 9 - CHATBOT FLOWS AVANZATI (OPZIONALE)

### Tasks
- [ ] Flow guidato onboarding lead:
  1. "Qual è il tuo obiettivo?" → Fitness / Finanza
  2. "Raccontami di più" → Free text
  3. "Lasciami la tua email" → Validation
  4. "Vuoi prenotare?" → Booking flow
- [ ] State machine per tracking progress flow
- [ ] Quick replies buttons (Twilio supporta list messages)

---

## 🚧 FASE 10 - BROADCAST MESSAGGI (OPZIONALE)

### Tasks
- [ ] Endpoint `POST /api/whatsapp/broadcast`
- [ ] Body: { targetGroup: "all" | "clients" | "leads", messageText }
- [ ] Invio batch messaggi con rate limiting (Twilio limits)
- [ ] Tracking: quale cliente ha ricevuto broadcast
- [ ] Opt-out management: cliente può dire "STOP"

---

## 📋 SCHEMA DATABASE COMPLETO

### Tabelle già create (Fase 1)
1. ✅ `consultant_whatsapp_config`
2. ✅ `whatsapp_conversations`
3. ✅ `whatsapp_messages`
4. ✅ `whatsapp_pending_messages`
5. ✅ `whatsapp_global_api_keys`

### Tabelle da creare (Fasi successive)
6. ⏳ `whatsapp_media_files` (Fase 2)
7. ⏳ `whatsapp_api_key_rotation_log` (Fase 5)
8. ⏳ `whatsapp_followup_reminders` (Fase 7)
9. ⏳ `whatsapp_daily_stats` (Fase 5)

**NOTA**: Gli schema Drizzle per le tabelle 6-9 sono **già presenti** in `shared/schema.ts`. Basta fare `npm run db:push` per crearle quando necessario.

---

## 🔧 CONFIGURAZIONE TWILIO

### Setup Sandbox (Testing)
1. Vai a https://console.twilio.com/us1/develop/sms/try-it-out/whatsapp-learn
2. Join Sandbox: invia codice da WhatsApp a numero Twilio
3. Numero sandbox: `+14155238886` (esempio)
4. **IMPORTANTE**: Sandbox ha limitazioni:
   - Max 5 numeri pre-approvati
   - Messaggi solo da/verso numeri join
   - Template "join {code}" obbligatorio per iniziare

### Setup Produzione (Business)
1. Richiedi numero WhatsApp Business verificato
2. Processo verifica Facebook Business Manager
3. Template messaggi pre-approvati
4. Costo: variabile per paese/destinazione

### Webhook Configuration (quando disponibile)
**NOTA**: L'utente attualmente NON può usare webhook. Usare polling (Fase 1).

Quando webhook saranno disponibili:
1. Twilio Console → Messaging → WhatsApp senders
2. Configurazione webhook:
   - URL: `https://your-repl.replit.app/api/whatsapp/webhook`
   - HTTP POST
   - Status Callback URL: `https://your-repl.replit.app/api/whatsapp/status-callback`

---

## 🧪 TESTING

### Test Fase 1 (Manuale)
1. Configurare credenziali Twilio in `/consultant/whatsapp`
2. Salvare configurazione → check database `consultant_whatsapp_config`
3. Inviare messaggio da WhatsApp (numero join sandbox)
4. Verificare:
   - Polling riceve messaggio (log ogni 30s)
   - Messaggio inserito in `whatsapp_pending_messages`
   - Dopo 4 secondi: processing inizia
   - AI genera risposta
   - Risposta inviata via Twilio
   - Messaggio salvato in `whatsapp_messages`

### Test Conversazione Cliente vs Lead
1. **Cliente esistente**:
   - Assicurati che `users.phoneNumber` match numero WhatsApp
   - Invia messaggio → AI usa contesto completo (esercizi, finanze)
   
2. **Lead nuovo**:
   - Usa numero non in database
   - Invia messaggio → AI usa script acquisizione lead
   - Verifica `whatsappConversations.isLead = true`

### Test Debouncing
1. Invia 3 messaggi rapidi (< 4 secondi tra loro)
2. Verifica: 3 righe in `whatsapp_pending_messages`
3. Verifica: 1 solo messaggio AI risposta (batched)
4. Check: `whatsappMessages.isBatched = true`

---

## 🐛 PROBLEMI RISOLTI

### 1. Messages Not Being Processed
**Problema**: Messaggi inseriti in `whatsapp_pending_messages` ma mai processati.  
**Causa**: `handleWebhook()` non chiamava `scheduleMessageProcessing()`.  
**Fix**: Aggiunta chiamata a `scheduleMessageProcessing(phoneNumber, consultantId)` in webhook-handler.ts (linea 80).

### 2. UNIQUE Constraint Missing
**Problema**: Possibilità di multiple config per stesso consulente.  
**Fix**: Aggiunto `UNIQUE (consultant_id)` su `consultant_whatsapp_config`.

---

## 📚 RISORSE UTILI

### Documentazione Twilio
- WhatsApp API: https://www.twilio.com/docs/whatsapp
- Message Status: https://www.twilio.com/docs/sms/api/message-resource#message-status-values
- Media Messages: https://www.twilio.com/docs/sms/accepted-mime-types
- Webhook Security: https://www.twilio.com/docs/usage/webhooks/webhooks-security

### Gemini AI
- Vision API: https://ai.google.dev/gemini-api/docs/vision
- Streaming: https://ai.google.dev/gemini-api/docs/text-generation#generate-a-text-stream

### Codice Esistente da Riutilizzare
- `server/ai-context-builder.ts` - buildUserContext(), detectIntent()
- `server/ai-prompts.ts` - buildSystemPrompt()
- `server/routes/automated-emails.ts` - Pattern cron scheduler
- `client/src/pages/consultant-email-logs.tsx` - Pattern dashboard con filtri/paginazione

---

## 🚀 PROSSIMI PASSI IMMEDIATI

Per il prossimo programmatore:

1. **Testare Fase 1 end-to-end**:
   - Setup Twilio Sandbox
   - Configurare credenziali in `/consultant/whatsapp`
   - Inviare messaggio test
   - Verificare risposta AI

2. **Inserire API keys globali per lead**:
   ```sql
   INSERT INTO whatsapp_global_api_keys (api_key, is_active)
   VALUES 
     ('YOUR_GEMINI_API_KEY_1', true),
     ('YOUR_GEMINI_API_KEY_2', true);
   ```

3. **Iniziare Fase 2 (Rich Media)**:
   - Implementare download media da Twilio
   - Setup storage `/storage/whatsapp/media/`
   - Test invio immagine → AI Vision analisi

4. **Documentare problemi**:
   - Aggiornare questo file con nuovi bug fix
   - Screenshot dashboard quando implementata
   - Video demo flusso completo

---

## 📞 CONTATTI & SUPPORTO

Per domande su implementazione:
- Documentazione codice: Commenti inline in ogni file
- Pattern esistenti: Guarda `automated-emails` per cron, `ai-context-builder` per AI
- Test database: Usa `execute_sql_tool` per query dirette

**Buon lavoro! 💪**
