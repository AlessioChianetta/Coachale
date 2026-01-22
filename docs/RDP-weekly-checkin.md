# RDP - Weekly Check-in Automatico AI

**Data creazione:** 2026-01-22  
**Versione:** 1.1  
**Stato:** ✅ Completato

---

## 1. Panoramica

Sistema di check-in settimanale automatico che contatta i clienti via WhatsApp per verificare come stanno e se hanno bisogno di aiuto. I messaggi sono personalizzati in base al contesto del cliente (ultime consulenze, esercizi, progressi) e vengono inviati a giorni/orari variabili per sembrare più naturali.

### 1.1 Obiettivi
- Mantenere engagement costante con i clienti
- Fornire supporto proattivo senza intervento manuale del consulente
- Aumentare retention e soddisfazione cliente
- Ridurre churn attraverso contatto regolare

### 1.2 Funzionalità Principali
- **Rotazione template**: 4-5 template predefiniti che ruotano per evitare ripetitività
- **Personalizzazione AI**: Messaggi arricchiti con contesto cliente (ultima consulenza, esercizi, progressi)
- **Scheduling variabile**: Giorno e ora casuali nella settimana per sembrare più umani
- **Tracking risposte**: Monitoraggio dei check-in inviati e delle risposte ricevute

---

## 2. Schema Database

### 2.1 Tabella: `weekly_checkin_config`

Configurazione check-in per ogni consulente.

```sql
CREATE TABLE weekly_checkin_config (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  consultant_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Stato
  is_enabled BOOLEAN DEFAULT false NOT NULL,
  
  -- Configurazione orario
  preferred_time_start TIME DEFAULT '09:00',  -- Orario minimo invio
  preferred_time_end TIME DEFAULT '18:00',    -- Orario massimo invio
  excluded_days INTEGER[] DEFAULT '{}',       -- Giorni esclusi (0=domenica, 6=sabato)
  
  -- Template rotation
  template_ids VARCHAR[] DEFAULT '{}',        -- Array di template_id da ruotare
  use_ai_personalization BOOLEAN DEFAULT true, -- Abilita personalizzazione AI
  
  -- Filtri clienti
  target_audience TEXT DEFAULT 'all_active',  -- 'all_active', 'with_exercises', 'recently_inactive'
  min_days_since_last_contact INTEGER DEFAULT 5, -- Minimo giorni dall'ultimo contatto
  
  -- Statistiche cache
  last_run_at TIMESTAMP,
  total_sent INTEGER DEFAULT 0,
  total_responses INTEGER DEFAULT 0,
  
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now(),
  
  UNIQUE(consultant_id)
);

CREATE INDEX idx_weekly_checkin_config_consultant ON weekly_checkin_config(consultant_id);
CREATE INDEX idx_weekly_checkin_config_enabled ON weekly_checkin_config(is_enabled) WHERE is_enabled = true;
```

### 2.2 Tabella: `weekly_checkin_logs`

Log di ogni check-in inviato.

```sql
CREATE TABLE weekly_checkin_logs (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id VARCHAR NOT NULL REFERENCES weekly_checkin_config(id) ON DELETE CASCADE,
  consultant_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Target
  client_id VARCHAR REFERENCES users(id) ON DELETE SET NULL,
  phone_number VARCHAR NOT NULL,
  conversation_id VARCHAR REFERENCES whatsapp_conversations(id) ON DELETE SET NULL,
  
  -- Scheduling
  scheduled_for TIMESTAMP NOT NULL,
  scheduled_day INTEGER NOT NULL,     -- 0-6 (domenica-sabato)
  scheduled_hour INTEGER NOT NULL,    -- 0-23
  
  -- Template usato
  template_id VARCHAR REFERENCES whatsapp_custom_templates(id) ON DELETE SET NULL,
  template_name VARCHAR,
  
  -- Messaggio
  original_template_body TEXT,        -- Template originale
  personalized_message TEXT,          -- Messaggio personalizzato da AI
  ai_personalization_context JSONB,   -- Contesto usato per personalizzazione
  
  -- Stato invio
  status TEXT DEFAULT 'scheduled' NOT NULL, -- 'scheduled', 'sent', 'delivered', 'read', 'replied', 'failed', 'cancelled'
  
  -- Tracking Twilio
  twilio_message_sid VARCHAR,
  sent_at TIMESTAMP,
  delivered_at TIMESTAMP,
  read_at TIMESTAMP,
  
  -- Risposta cliente
  replied_at TIMESTAMP,
  reply_message_preview TEXT,         -- Prime 100 chars della risposta
  
  -- Errori
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

CREATE INDEX idx_weekly_checkin_logs_config ON weekly_checkin_logs(config_id);
CREATE INDEX idx_weekly_checkin_logs_consultant ON weekly_checkin_logs(consultant_id);
CREATE INDEX idx_weekly_checkin_logs_client ON weekly_checkin_logs(client_id);
CREATE INDEX idx_weekly_checkin_logs_status ON weekly_checkin_logs(status);
CREATE INDEX idx_weekly_checkin_logs_scheduled ON weekly_checkin_logs(scheduled_for) WHERE status = 'scheduled';
CREATE INDEX idx_weekly_checkin_logs_phone ON weekly_checkin_logs(phone_number);
```

### 2.3 Tabella: `weekly_checkin_templates` (Predefiniti)

Template predefiniti di sistema per check-in.

```sql
CREATE TABLE weekly_checkin_templates (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Può essere NULL per template di sistema, o consultant_id per custom
  consultant_id VARCHAR REFERENCES users(id) ON DELETE CASCADE,
  
  -- Template info
  name VARCHAR NOT NULL,
  body TEXT NOT NULL,                 -- Testo con placeholder: {nome_cliente}, {ultimo_argomento}, etc.
  category TEXT DEFAULT 'general',    -- 'general', 'exercise_focus', 'progress_focus', 'support_offer'
  
  -- Stato
  is_system_template BOOLEAN DEFAULT false NOT NULL,
  is_active BOOLEAN DEFAULT true NOT NULL,
  
  -- Usage stats
  times_used INTEGER DEFAULT 0,
  last_used_at TIMESTAMP,
  
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

CREATE INDEX idx_weekly_checkin_templates_consultant ON weekly_checkin_templates(consultant_id);
CREATE INDEX idx_weekly_checkin_templates_system ON weekly_checkin_templates(is_system_template) WHERE is_system_template = true;
```

---

## 3. Template Predefiniti di Sistema

### 3.1 Template Generali

| ID | Nome | Categoria | Testo |
|----|------|-----------|-------|
| 1 | check_in_friendly | general | "Ciao {nome_cliente}! 👋 Come stai? Volevo fare un check-in veloce per vedere come procede tutto. Se hai bisogno di qualcosa, sono qui!" |
| 2 | check_in_progress | progress_focus | "Ciao {nome_cliente}! Come sta andando questa settimana? {contesto_progressi} Fammi sapere se posso aiutarti in qualcosa!" |
| 3 | check_in_exercise | exercise_focus | "Ehi {nome_cliente}! 📚 Volevo vedere come stai procedendo con {ultimo_esercizio}. Hai domande o dubbi? Sono qui per te!" |
| 4 | check_in_support | support_offer | "Ciao {nome_cliente}! Tutto bene? Se c'è qualcosa che ti blocca o su cui vorresti lavorare insieme, scrivimi pure. Buona giornata! ☀️" |
| 5 | check_in_consultation | general | "Ciao {nome_cliente}! È passata una settimana dalla nostra ultima sessione. Come stai mettendo in pratica quello di cui abbiamo parlato? Fammi sapere!" |

### 3.2 Variabili Disponibili per Personalizzazione AI

| Variabile | Descrizione | Fonte |
|-----------|-------------|-------|
| `{nome_cliente}` | Nome del cliente | users.firstName |
| `{ultimo_esercizio}` | Nome ultimo esercizio assegnato | exerciseAssignments + exercises |
| `{stato_esercizio}` | Stato dell'ultimo esercizio | exerciseAssignments.status |
| `{giorni_ultimo_contatto}` | Giorni dall'ultimo messaggio | whatsappConversations.lastMessageAt |
| `{ultimo_argomento}` | Argomento ultima consulenza | consultationSummaries.summary |
| `{contesto_progressi}` | Frase AI sui progressi | Generato da AI |
| `{prossimo_step}` | Prossimo passo suggerito | Generato da AI |

---

## 4. Architettura Backend

### 4.1 File Structure

```
server/
├── cron/
│   └── weekly-checkin-scheduler.ts    # CRON job principale
├── routes/
│   └── weekly-checkin-router.ts       # API endpoints
├── services/
│   └── weekly-checkin/
│       ├── index.ts                   # Export principale
│       ├── scheduler.ts               # Logica scheduling
│       ├── personalizer.ts            # Personalizzazione AI messaggi
│       └── sender.ts                  # Invio via WhatsApp
```

### 4.2 CRON Schedule

```typescript
// Gira ogni giorno alle 08:00 Europe/Rome
const DAILY_SCHEDULE = '0 8 * * *';

// Gira ogni minuto per processare messaggi schedulati
const PROCESSING_SCHEDULE = '* * * * *';
```

### 4.3 Algoritmo Scheduling Settimanale

```
Per ogni consulente con check-in abilitato:
  1. Recupera lista clienti attivi con numero WhatsApp
  2. Filtra clienti già contattati negli ultimi N giorni
  3. Calcola quanti clienti contattare oggi (totale / 7)
  4. Seleziona casualmente i clienti per oggi
  5. Per ogni cliente selezionato:
     a. Genera orario casuale tra preferred_time_start e preferred_time_end
     b. Seleziona template in rotazione (round-robin o casuale)
     c. Se AI enabled, personalizza messaggio con contesto cliente
     d. Crea record in weekly_checkin_logs con status 'scheduled'
```

### 4.4 API Endpoints

| Metodo | Endpoint | Descrizione |
|--------|----------|-------------|
| GET | `/api/weekly-checkin/config` | Recupera config consulente |
| POST | `/api/weekly-checkin/config` | Crea/aggiorna config |
| PATCH | `/api/weekly-checkin/config/toggle` | Toggle enable/disable |
| GET | `/api/weekly-checkin/stats` | Statistiche aggregate |
| GET | `/api/weekly-checkin/logs` | Log ultimi check-in |
| GET | `/api/weekly-checkin/templates` | Template disponibili |
| POST | `/api/weekly-checkin/templates` | Crea template custom |
| DELETE | `/api/weekly-checkin/templates/:id` | Elimina template custom |
| POST | `/api/weekly-checkin/test` | Invia check-in di test |

---

## 5. Layout Grafico Frontend

### 5.1 Posizionamento

La card "Check-in Settimanale" viene inserita nella pagina **Consultant WhatsApp** (`/consultant/whatsapp`), nella tab **"I Miei Agenti"** (`custom`), dopo la sezione "Leaderboard + Activity Feed".

### 5.2 Mockup Card

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  ┌────┐                                                                     │
│  │ 📅 │  CHECK-IN SETTIMANALE AUTOMATICO                      [Toggle ON]  │
│  └────┘  Contatta automaticamente i tuoi clienti ogni settimana             │
│                                                                             │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐              │
│  │    📤 45        │  │    💬 32        │  │    📊 71%       │              │
│  │  Inviati        │  │  Risposte       │  │  Tasso Risposta │              │
│  │  questa sett.   │  │  ricevute       │  │                 │              │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘              │
│                                                                             │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  TEMPLATE IN ROTAZIONE                                      [+ Aggiungi]   │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ ☑ "Ciao {nome}! Come stai? Volevo fare un check-in..."              │   │
│  │ ☑ "Ehi {nome}! Come sta andando con {esercizio}?"                   │   │
│  │ ☑ "Ciao {nome}! Tutto bene? Se hai bisogno..."                      │   │
│  │ ☐ "Custom template consulente..."                        [🗑️ Elimina] │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  IMPOSTAZIONI                                                               │
│  ┌──────────────────────────┐  ┌──────────────────────────┐                 │
│  │ Orario invio             │  │ Giorni esclusi           │                 │
│  │ [09:00] - [18:00]        │  │ ☐ Lun ☐ Mar ☐ Mer ☐ Gio  │                 │
│  │                          │  │ ☐ Ven ☑ Sab ☑ Dom       │                 │
│  └──────────────────────────┘  └──────────────────────────┘                 │
│                                                                             │
│  ☑ Personalizza messaggi con AI (usa contesto cliente)                     │
│  ☑ Escludi clienti contattati negli ultimi 5 giorni                        │
│                                                                             │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  ULTIMI CHECK-IN                                            [Vedi tutti →] │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ 📤 Marco Rossi    | "Ciao Marco! Come stai?" | Ieri 14:32 | ✅ Letto │   │
│  │ 💬 Anna Bianchi   | "Tutto ok con budget?"   | Ieri 10:15 | 💬 Risposta│  │
│  │ 📤 Luca Verdi     | "Ehi Luca! Come va?"     | 2 gg fa    | 📤 Inviato│   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│                                              [📤 Invia Check-in di Test]   │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 5.3 Componenti UI

```typescript
// Componente principale
<WeeklyCheckinCard />

// Sotto-componenti
├── <WeeklyCheckinStats />           // KPI cards (inviati, risposte, tasso)
├── <WeeklyCheckinTemplateList />    // Lista template con checkbox
├── <WeeklyCheckinSettings />        // Orari, giorni, toggle AI
├── <WeeklyCheckinRecentLogs />      // Ultimi 5 check-in
└── <WeeklyCheckinTestButton />      // Pulsante test
```

---

## 6. Flusso Dati

### 6.1 Flusso Scheduling (Giornaliero alle 08:00)

```
┌─────────────────┐
│  CRON 08:00     │
│  Europe/Rome    │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│  1. Query consultanti con weekly_checkin_config.is_enabled  │
└────────┬────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│  2. Per ogni consulente:                                    │
│     - Recupera clienti attivi con whatsapp                  │
│     - Filtra già contattati < min_days_since_last_contact   │
│     - Calcola quota giornaliera (totale / 7)                │
│     - Seleziona casualmente clienti per oggi                │
└────────┬────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│  3. Per ogni cliente selezionato:                           │
│     - Genera orario random in finestra preferita            │
│     - Seleziona template (rotazione)                        │
│     - Se AI enabled: personalizza con contesto              │
│     - INSERT in weekly_checkin_logs (status='scheduled')    │
└─────────────────────────────────────────────────────────────┘
```

### 6.2 Flusso Processing (Ogni minuto)

```
┌─────────────────┐
│  CRON * * * * * │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│  1. Query: scheduled_for <= NOW() AND status = 'scheduled'  │
└────────┬────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│  2. Per ogni messaggio:                                     │
│     - Invia via Twilio WhatsApp API                         │
│     - UPDATE status = 'sent', twilio_message_sid            │
│     - Incrementa weekly_checkin_config.total_sent           │
└─────────────────────────────────────────────────────────────┘
```

### 6.3 Flusso Personalizzazione AI

```
┌─────────────────────────────────────────────────────────────┐
│  INPUT: client_id, template_body                            │
└────────┬────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│  1. Recupera contesto cliente:                              │
│     - users: nome, cognome                                  │
│     - exerciseAssignments: ultimo esercizio, stato          │
│     - whatsappConversations: ultimo messaggio               │
│     - consultationSummaries: ultima consulenza              │
└────────┬────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│  2. Chiama Gemini con prompt:                               │
│     "Personalizza questo template check-in per il cliente   │
│      usando il contesto fornito. Mantieni il tono amichevole│
│      e la lunghezza simile. Template: {...}"                │
└────────┬────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│  OUTPUT: personalized_message, ai_personalization_context   │
└─────────────────────────────────────────────────────────────┘
```

---

## 7. Considerazioni Tecniche

### 7.1 Rate Limiting
- Max 50 messaggi/ora per consulente (come followup esistente)
- Spread naturale dei messaggi nell'arco della giornata

### 7.2 Retry Logic
- Max 3 tentativi per messaggio fallito
- Backoff esponenziale: 5min, 15min, 60min

### 7.3 Webhook Tracking
- Riutilizzare webhook Twilio esistente per status updates
- Aggiungere handler per `weekly_checkin_logs` update

### 7.4 Esclusioni Automatiche
- Clienti che hanno risposto "stop" o simili
- Clienti con conversazione attiva nelle ultime 24h
- Clienti già contattati questa settimana

---

## 8. Changelog

| Data | Versione | Modifiche |
|------|----------|-----------|
| 2026-01-22 | 1.0 | Creazione documento iniziale |
| 2026-01-22 | 1.1 | Implementazione completata: DB, API, CRON scheduler, UI |

---

## 9. File Implementati

| File | Descrizione |
|------|-------------|
| `shared/schema.ts` | Schema Drizzle per weeklyCheckinConfig, weeklyCheckinTemplates, weeklyCheckinLogs |
| `server/routes/weekly-checkin-router.ts` | API endpoints per configurazione, template, logs, stats, test |
| `server/cron/weekly-checkin-scheduler.ts` | CRON scheduler giornaliero + processore messaggi |
| `client/src/components/whatsapp/WeeklyCheckinCard.tsx` | Componente UI card con stats, template, settings |
| `client/src/pages/consultant-whatsapp.tsx` | Integrazione card nella sezione "I Miei Agenti" |

## 10. TODO Implementazione

- [x] Task 1: Creare tabelle DB via SQL
- [x] Task 2: Creare API endpoints
- [x] Task 3: Creare scheduler CRON
- [x] Task 4: Implementare personalizzazione AI
- [x] Task 5: Creare sistema rotazione template
- [x] Task 6: Creare componente UI
- [x] Task 7: Integrare invio WhatsApp
- [x] Task 8: Test e review
- [ ] Task 9: Aggiornare manuale
