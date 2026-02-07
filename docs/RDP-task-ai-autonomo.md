# RDP - Task AI Autonomo: Dipendente Virtuale Intelligente

> **Data:** 7 Febbraio 2026  
> **Status:** Proposta  
> **Priorità:** Alta  
> **Dipendenze:** VoiceTaskSupervisor, AI Task Scheduler, Follow-up Decision Engine, Gemini API

---

## 1. VISIONE E OBIETTIVO

### 1.1 Problema
Attualmente il sistema "Task AI" (`ai_task` in CALL_TYPE_INFO) è marcato come "Beta / In sviluppo". Il flusso esistente supporta solo **chiamate vocali programmate** (single_call/follow_up) che eseguono un'istruzione vocale su un contatto. Non esiste un vero **dipendente AI autonomo** che:
- Analizza dati del cliente prima di agire
- Prende decisioni basate su contesto e storico
- Esegue task complessi (ricerca, analisi, preparazione documenti)
- Decide autonomamente quando e come contattare
- Impara dalle interazioni precedenti

### 1.2 Obiettivo
Creare un **Dipendente AI Autonomo** che funziona come un collaboratore virtuale del consulente:
- **Modalità Manuale**: Il consulente crea task specifici con istruzioni ("Analizza lo storico di Mario Rossi")
- **Modalità Automatica**: L'AI monitora periodicamente i dati, rileva situazioni che richiedono azione, e decide autonomamente cosa fare (es: "Ho notato che il cliente non ha risposto da 30 giorni → preparo un report e chiamo")
- **Ibrido**: L'AI propone azioni ma chiede approvazione prima di eseguirle (configurabile per livello di autonomia)

---

## 2. ARCHITETTURA DI SISTEMA

### 2.1 Overview Architetturale

```
┌─────────────────────────────────────────────────────────────────┐
│                    CONSULTANT DASHBOARD                         │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌───────────────┐   │
│  │ Task     │  │ Autonomy │  │ Activity │  │ Approval      │   │
│  │ Creator  │  │ Settings │  │ Feed     │  │ Queue         │   │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └──────┬────────┘   │
│       │             │             │                │            │
└───────┼─────────────┼─────────────┼────────────────┼────────────┘
        │             │             │                │
   ┌────▼─────────────▼─────────────▼────────────────▼────────────┐
   │                      REST API LAYER                          │
   │  POST /ai-autonomous-tasks     GET /ai-activity-feed         │
   │  PATCH /ai-autonomy-settings   POST /ai-approve-action       │
   │  GET /ai-autonomous-proposals  POST /ai-reject-action        │
   └──────────────────────┬───────────────────────────────────────┘
                          │
   ┌──────────────────────▼───────────────────────────────────────┐
   │              AI AUTONOMOUS TASK ENGINE                       │
   │                                                              │
   │  ┌─────────────┐  ┌──────────────┐  ┌────────────────────┐  │
   │  │  Task       │  │  Proactive   │  │  Decision          │  │
   │  │  Executor   │  │  Monitor     │  │  Engine (LLM)      │  │
   │  │  (Manual)   │  │  (CRON)      │  │  (Gemini 2.5)      │  │
   │  └──────┬──────┘  └──────┬───────┘  └────────┬───────────┘  │
   │         │                │                    │              │
   │  ┌──────▼────────────────▼────────────────────▼───────────┐  │
   │  │              ACTION DISPATCHER                         │  │
   │  │  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────────────┐ │  │
   │  │  │Voice │ │Email │ │WA    │ │Report│ │Data Analysis │ │  │
   │  │  │Call  │ │Send  │ │Send  │ │Gen   │ │Engine        │ │  │
   │  │  └──────┘ └──────┘ └──────┘ └──────┘ └──────────────┘ │  │
   │  └────────────────────────────────────────────────────────┘  │
   └──────────────────────────────────────────────────────────────┘
                          │
   ┌──────────────────────▼───────────────────────────────────────┐
   │                    DATABASE LAYER                             │
   │  ai_autonomous_tasks │ ai_autonomy_settings │ ai_activity_log│
   │  ai_autonomous_rules │ ai_action_proposals  │                │
   └──────────────────────────────────────────────────────────────┘
```

### 2.2 Flusso Generale

```
                        ┌──────────────┐
                        │   TRIGGER    │
                        └──────┬───────┘
                               │
                    ┌──────────┼──────────┐
                    │          │          │
              ┌─────▼────┐ ┌──▼─────┐ ┌──▼──────────┐
              │ Manuale  │ │ CRON   │ │ Evento      │
              │ (Console)│ │ (Auto) │ │ (Webhook)   │
              └─────┬────┘ └──┬─────┘ └──┬──────────┘
                    │         │          │
                    └─────────┼──────────┘
                              │
                    ┌─────────▼──────────┐
                    │  CONTEXT BUILDER   │
                    │  • Client data     │
                    │  • History         │
                    │  • Preferences     │
                    │  • Active tasks    │
                    └─────────┬──────────┘
                              │
                    ┌─────────▼──────────┐
                    │  DECISION ENGINE   │
                    │  (Gemini 2.5 Flash)│
                    │  • Analyze context │
                    │  • Choose action   │
                    │  • Plan execution  │
                    └─────────┬──────────┘
                              │
                 ┌────────────┼────────────┐
                 │            │            │
          ┌──────▼─────┐ ┌───▼──────┐ ┌───▼──────────┐
          │ Auto-exec  │ │ Propose  │ │ Log & Skip   │
          │ (high      │ │ (medium  │ │ (low         │
          │ autonomy)  │ │ autonomy)│ │ autonomy)    │
          └──────┬─────┘ └───┬──────┘ └───┬──────────┘
                 │           │            │
          ┌──────▼─────┐ ┌───▼──────┐    │
          │  EXECUTE   │ │ APPROVAL │    │
          │  ACTION    │ │ QUEUE    │    │
          └──────┬─────┘ └───┬──────┘    │
                 │           │            │
                 └───────────┼────────────┘
                             │
                   ┌─────────▼──────────┐
                   │  ACTIVITY LOG      │
                   │  • What was done   │
                   │  • Why (reasoning) │
                   │  • Results         │
                   └────────────────────┘
```

---

## 3. DATABASE SCHEMA

### 3.0 Strategia di Migrazione: Estensione di `ai_scheduled_tasks`

> **DECISIONE ARCHITETTURALE**: NON creiamo una nuova tabella `ai_autonomous_tasks`. Estendiamo la tabella esistente `ai_scheduled_tasks` con colonne aggiuntive. Questo perché:
> 1. Il CRON job `ai-task-scheduler.ts` già legge da `ai_scheduled_tasks` ed esegue task
> 2. Il callback system in `voice-router.ts` (POST `/call-result`) già sincronizza `ai_scheduled_tasks` con `scheduled_voice_calls` tramite `source_task_id`
> 3. Il `VoiceTaskSupervisor` già crea record in `ai_scheduled_tasks` durante le chiamate
> 4. La funzione `scheduleNextRecurrence()` già gestisce ricorrenze su `ai_scheduled_tasks`
> 5. Creare una tabella parallela richiederebbe duplicare tutta questa logica
>
> La tabella `ai_scheduled_tasks` diventa il **Single Source of Truth** per tutti i tipi di task (manuali, proattivi, reattivi).

### 3.1 Estensione Tabella `ai_scheduled_tasks` (ALTER TABLE)

```sql
-- ═══════════════════════════════════════════════════════════════
-- NUOVE COLONNE per supportare il sistema autonomo
-- Tutte hanno DEFAULT per non rompere i task esistenti
-- ═══════════════════════════════════════════════════════════════

-- Origine del task: chi l'ha creato?
ALTER TABLE ai_scheduled_tasks ADD COLUMN IF NOT EXISTS origin_type VARCHAR(20) DEFAULT 'manual';
-- Valori: 'manual' (consulente), 'proactive' (monitor AI), 'reactive' (evento),
--         'voice_supervisor' (creato da VoiceTaskSupervisor durante chiamata)

-- Categoria del task: cosa deve fare?
ALTER TABLE ai_scheduled_tasks ADD COLUMN IF NOT EXISTS task_category VARCHAR(30) DEFAULT 'outreach';
-- Valori: 'outreach' (call/email/wa), 'analysis', 'report', 'research',
--         'preparation', 'followup', 'monitoring', 'reminder'

-- Contatto target con ID strutturato (opzionale, complementa contact_phone)
ALTER TABLE ai_scheduled_tasks ADD COLUMN IF NOT EXISTS contact_id UUID;
ALTER TABLE ai_scheduled_tasks ADD COLUMN IF NOT EXISTS contact_email VARCHAR(255);

-- Piano di esecuzione multi-step
ALTER TABLE ai_scheduled_tasks ADD COLUMN IF NOT EXISTS execution_plan JSONB DEFAULT '[]'::jsonb;
-- Esempio: [
--   {"step": 1, "action": "fetch_client_data", "status": "completed", "result": "..."},
--   {"step": 2, "action": "analyze_patterns", "status": "in_progress"},
--   {"step": 3, "action": "generate_report", "status": "pending"},
--   {"step": 4, "action": "voice_call", "status": "pending"}
-- ]

-- Azioni post-completamento
ALTER TABLE ai_scheduled_tasks ADD COLUMN IF NOT EXISTS post_actions JSONB DEFAULT '[]'::jsonb;
-- Esempio: [{"type": "voice_call", "phone": "+39...", "instruction": "Spiega risultati"}]

-- Flag: chiama dopo task (già usato nel frontend, ora formalizzato in DB)
ALTER TABLE ai_scheduled_tasks ADD COLUMN IF NOT EXISTS call_after_task BOOLEAN DEFAULT false;

-- Contesto raccolto dall'AI
ALTER TABLE ai_scheduled_tasks ADD COLUMN IF NOT EXISTS context_data JSONB DEFAULT '{}'::jsonb;

-- Risultato strutturato del task
ALTER TABLE ai_scheduled_tasks ADD COLUMN IF NOT EXISTS result_data JSONB;
-- Esempio analisi: {"insights": [...], "recommendations": [...], "risk_score": 7.2}

-- Priorità (1=massima, 5=minima)
ALTER TABLE ai_scheduled_tasks ADD COLUMN IF NOT EXISTS priority INTEGER DEFAULT 3;

-- Task padre (per ricorrenze e catene di task)
ALTER TABLE ai_scheduled_tasks ADD COLUMN IF NOT EXISTS parent_task_id VARCHAR(100);

-- Reasoning dell'AI (perché ha deciso di creare/fare questo task)
ALTER TABLE ai_scheduled_tasks ADD COLUMN IF NOT EXISTS ai_reasoning TEXT;
ALTER TABLE ai_scheduled_tasks ADD COLUMN IF NOT EXISTS ai_confidence DECIMAL(3,2); -- 0.00-1.00

-- Collegamento a regola che ha scatenato il task
ALTER TABLE ai_scheduled_tasks ADD COLUMN IF NOT EXISTS triggered_by_rule_id UUID;

-- Collegamento ad email/whatsapp (complementa voice_call_id già esistente)
ALTER TABLE ai_scheduled_tasks ADD COLUMN IF NOT EXISTS email_id VARCHAR(100);
ALTER TABLE ai_scheduled_tasks ADD COLUMN IF NOT EXISTS whatsapp_message_id VARCHAR(100);

-- Timestamp inizio esecuzione (diverso da scheduled_at)
ALTER TABLE ai_scheduled_tasks ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ;

-- Deadline (opzionale)
ALTER TABLE ai_scheduled_tasks ADD COLUMN IF NOT EXISTS deadline_at TIMESTAMPTZ;

-- NUOVI STATUS aggiunti:
-- Oltre ai già supportati (scheduled, in_progress, completed, failed, paused, retry_pending, cancelled)
-- Aggiungiamo: 'draft' (proposto AI, attesa approvazione), 'approved' (approvato, attesa scheduling),
--              'waiting_approval' (task generò azione che richiede ok)

-- Nuovi indici
CREATE INDEX IF NOT EXISTS idx_ai_tasks_origin ON ai_scheduled_tasks(origin_type) WHERE origin_type != 'manual';
CREATE INDEX IF NOT EXISTS idx_ai_tasks_category ON ai_scheduled_tasks(task_category);
CREATE INDEX IF NOT EXISTS idx_ai_tasks_contact_id ON ai_scheduled_tasks(contact_id) WHERE contact_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ai_tasks_parent ON ai_scheduled_tasks(parent_task_id) WHERE parent_task_id IS NOT NULL;
```

**Impatto sul codice esistente**: ZERO. Tutte le colonne hanno DEFAULT, quindi:
- `ai-task-scheduler.ts` continua a funzionare invariato
- `voice-router.ts` callback continua a funzionare invariato
- `VoiceTaskSupervisor` continua a funzionare invariato
- `scheduleNextRecurrence()` continua a funzionare invariato
- Il frontend wizard esistente continua a funzionare invariato

### 3.2 Nuove Tabelle

#### `ai_autonomy_settings` — Configurazione per consulente

```sql
CREATE TABLE ai_autonomy_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consultant_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Livello di autonomia globale (1-10)
  -- 1-3: Solo proposta (l'AI propone, il consulente approva tutto)
  -- 4-6: Semi-autonomo (azioni a basso rischio auto, alto rischio proposta)
  -- 7-9: Autonomo (quasi tutto auto, solo azioni critiche richiedono approvazione)
  -- 10: Completamente autonomo
  autonomy_level INTEGER NOT NULL DEFAULT 3,
  
  -- Azioni permesse in automatico (senza approvazione)
  auto_allowed_actions JSONB DEFAULT '[]'::jsonb,
  -- Esempio: ["analyze_data", "generate_report", "send_reminder_call"]
  
  -- Azioni che richiedono SEMPRE approvazione
  always_approve_actions JSONB DEFAULT '["send_email", "make_call", "modify_data"]'::jsonb,
  
  -- Orari di lavoro dell'AI (non opera fuori da questi orari)
  working_hours_start TIME DEFAULT '08:00',
  working_hours_end TIME DEFAULT '20:00',
  working_days INTEGER[] DEFAULT ARRAY[1,2,3,4,5], -- Lun-Ven (ISO)
  
  -- Limiti operativi giornalieri
  max_daily_calls INTEGER DEFAULT 10,
  max_daily_emails INTEGER DEFAULT 20,
  max_daily_whatsapp INTEGER DEFAULT 30,
  max_daily_analyses INTEGER DEFAULT 50,
  
  -- Intervallo minimo tra controlli proattivi (minuti)
  proactive_check_interval_minutes INTEGER DEFAULT 60,
  
  -- Attivo/Disattivo
  is_active BOOLEAN DEFAULT false,
  
  -- Istruzioni personalizzate del consulente
  custom_instructions TEXT,
  -- Es: "Non chiamare mai i clienti prima delle 10. Prioritizza i lead caldi."
  
  -- Canali abilitati
  channels_enabled JSONB DEFAULT '{"voice": true, "email": false, "whatsapp": false}'::jsonb,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT unique_consultant_autonomy UNIQUE (consultant_id)
);
```

#### `ai_autonomous_rules` — Regole di monitoraggio proattivo

```sql
CREATE TABLE ai_autonomous_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consultant_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Nome della regola (per identificarla nella UI)
  name VARCHAR(255) NOT NULL,
  description TEXT,
  
  -- Tipo di regola
  -- 'inactivity': Contatto non sentito da X giorni
  -- 'metric_threshold': Metrica supera soglia
  -- 'date_trigger': Data specifica (compleanno, scadenza)
  -- 'pattern': Pattern rilevato nei dati
  -- 'custom': Regola custom descritta in linguaggio naturale
  rule_type VARCHAR(30) NOT NULL,
  
  -- Condizione (interpretata dall'AI o dal codice)
  condition JSONB NOT NULL,
  -- Esempi:
  -- Inactivity: {"days_without_contact": 30, "applies_to": "all_clients"}
  -- Metric: {"metric": "payment_delay", "operator": ">", "threshold": 15, "unit": "days"}
  -- Date: {"field": "contract_expiry", "days_before": 30}
  -- Custom: {"natural_language": "Se un lead ha visitato la landing page 3+ volte ma non ha prenotato"}
  
  -- Azione da eseguire quando la condizione è vera
  action_template JSONB NOT NULL,
  -- Esempio: {
  --   "task_category": "outreach",
  --   "instruction_template": "Il cliente {contact_name} non è stato contattato da {days} giorni. Analizza il suo storico e proponi un'azione.",
  --   "post_actions": [{"type": "voice_call", "instruction": "Fai un check-in amichevole"}],
  --   "priority": 2
  -- }
  
  -- Frequenza di controllo (override del default)
  check_interval_minutes INTEGER DEFAULT 60,
  
  -- Cooldown: dopo che la regola scatta, quanti giorni prima di riscattare per lo stesso contatto
  cooldown_days INTEGER DEFAULT 7,
  
  -- Attiva/Disattiva
  is_active BOOLEAN DEFAULT true,
  
  -- Statistiche
  times_triggered INTEGER DEFAULT 0,
  last_triggered_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_autonomous_rules_consultant ON ai_autonomous_rules(consultant_id);
CREATE INDEX idx_autonomous_rules_active ON ai_autonomous_rules(is_active);
```

#### `ai_action_proposals` — Coda proposte in attesa di approvazione

```sql
CREATE TABLE ai_action_proposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consultant_id UUID NOT NULL REFERENCES users(id),
  task_id VARCHAR(100) REFERENCES ai_scheduled_tasks(id),
  
  -- Tipo di azione proposta
  action_type VARCHAR(30) NOT NULL,
  -- 'voice_call', 'email', 'whatsapp', 'report', 'data_update'
  
  -- Dettagli dell'azione
  action_details JSONB NOT NULL,
  -- Esempio voice_call: {
  --   "contact_phone": "+39...",
  --   "contact_name": "Mario Rossi",
  --   "instruction": "Chiama per verificare soddisfazione",
  --   "template_id": "check-in-cliente",
  --   "suggested_time": "2026-02-08T10:00:00"
  -- }
  
  -- Reasoning dell'AI
  ai_reasoning TEXT NOT NULL,
  ai_confidence DECIMAL(3,2),
  
  -- Contesto che ha portato alla proposta
  trigger_context JSONB,
  -- Esempio: {
  --   "rule_id": "...",
  --   "rule_name": "Inattività 30 giorni",
  --   "detected_at": "2026-02-07T14:30:00",
  --   "client_last_contact": "2026-01-05",
  --   "days_inactive": 33
  -- }
  
  -- Status
  -- 'pending': In attesa di decisione
  -- 'approved': Approvato → verrà eseguito
  -- 'rejected': Rifiutato dal consulente
  -- 'expired': Scaduto (non più rilevante)
  -- 'auto_approved': Approvato automaticamente (alto livello autonomia)
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  
  -- Risposta del consulente
  consultant_response TEXT, -- Note del consulente sulla decisione
  responded_at TIMESTAMPTZ,
  
  -- Scadenza proposta
  expires_at TIMESTAMPTZ,
  
  -- Urgenza (1=urgente, 3=normale, 5=bassa)
  urgency INTEGER DEFAULT 3,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_proposals_consultant ON ai_action_proposals(consultant_id);
CREATE INDEX idx_proposals_status ON ai_action_proposals(status);
CREATE INDEX idx_proposals_pending ON ai_action_proposals(consultant_id, status) WHERE status = 'pending';
```

#### `ai_activity_log` — Feed attività dell'AI

```sql
CREATE TABLE ai_activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consultant_id UUID NOT NULL REFERENCES users(id),
  task_id VARCHAR(100) REFERENCES ai_scheduled_tasks(id),
  
  -- Tipo di evento
  event_type VARCHAR(30) NOT NULL,
  -- 'task_created', 'task_started', 'task_completed', 'task_failed',
  -- 'action_proposed', 'action_approved', 'action_rejected',
  -- 'action_executed', 'rule_triggered', 'analysis_completed',
  -- 'decision_made', 'error_occurred', 'insight_discovered'
  
  -- Descrizione leggibile
  title VARCHAR(255) NOT NULL,
  description TEXT,
  
  -- Icona e colore per la UI
  icon VARCHAR(30), -- 'phone', 'mail', 'chart', 'alert', 'check', 'brain'
  severity VARCHAR(10) DEFAULT 'info', -- 'info', 'success', 'warning', 'error'
  
  -- Dati strutturati dell'evento
  event_data JSONB DEFAULT '{}'::jsonb,
  
  -- Contatto coinvolto (opzionale)
  contact_id UUID,
  contact_name VARCHAR(255),
  
  -- Letto dal consulente?
  is_read BOOLEAN DEFAULT false,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_activity_log_consultant ON ai_activity_log(consultant_id);
CREATE INDEX idx_activity_log_created ON ai_activity_log(created_at DESC);
CREATE INDEX idx_activity_log_unread ON ai_activity_log(consultant_id, is_read) WHERE is_read = false;
```

### 3.3 State Machine — Ciclo di Vita del Task

La tabella `ai_scheduled_tasks` usa il campo `status` per il ciclo di vita. I nuovi status `draft`, `approved`, e `waiting_approval` estendono la state machine esistente senza conflitto.

```
                                    ┌──────────────────────┐
                                    │    PROACTIVE         │
                                    │    MONITOR           │
                                    │    (origin=proactive) │
                                    └──────────┬───────────┘
                                               │
                                    ┌──────────▼───────────┐
                              ┌─────│       draft          │──── [scade] ──→ cancelled
                              │     │  (proposta dall'AI)  │
                              │     └──────────┬───────────┘
                              │                │
                     [rifiutato]         [approvato dal consulente]
                              │                │
                              ▼                ▼
                         cancelled     ┌───────────────────┐
                                       │    approved        │
                                       │ (attende scheduling)│
                                       └───────┬───────────┘
                                               │
                    ┌──────────────────────────┘
                    │
                    │   ┌──────────────────────┐
                    │   │   CONSULENTE          │
                    │   │   (origin=manual)     │
                    │   │   VOICE SUPERVISOR    │
                    │   │   (origin=voice_supv) │
                    │   └──────────┬───────────┘
                    │              │
                    ▼              ▼
              ┌─────────────────────────┐
              │      scheduled          │ ◄─── [resume da pausa]
              │  (attende scheduled_at)  │
              └──────────┬──────────────┘
                         │
              [scheduled_at raggiunto]
              [CRON ai-task-scheduler.ts]
                         │
                         ▼
              ┌─────────────────────────┐
              │     in_progress         │ ◄─── [retry dopo failure]
              │  (in esecuzione)        │
              └──────┬──────────────────┘
                     │
         ┌───────────┼───────────┬──────────────┐
         │           │           │              │
         ▼           ▼           ▼              ▼
   ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────────┐
   │completed │ │  failed  │ │retry_    │ │waiting_approval  │
   │(successo)│ │(definitivo)│ │pending  │ │(azione richiede  │
   └─────┬────┘ └──────────┘ │(retry    │ │  ok consulente)  │
         │                    │ auto)    │ └────────┬─────────┘
         │                    └──────────┘          │
    [se ricorrente]                          [approvato] → in_progress
    [scheduleNextRecurrence()]               [rifiutato] → completed (parziale)
         │
         ▼
   Nuovo task 'scheduled'
   (parent_task_id = id corrente)

   Da qualsiasi stato:
   ├─── [consulente pausa] ──→ paused ──→ [resume] ──→ scheduled
   └─── [consulente cancella] ──→ cancelled
```

**Transizioni e chi le triggera:**

| Da → A | Trigger | Codice Responsabile |
|--------|---------|---------------------|
| `draft` → `approved` | Consulente approva proposta | `voice-router.ts` POST `/ai-autonomy/proposals/:id/approve` |
| `draft` → `cancelled` | Consulente rifiuta / scadenza | `voice-router.ts` POST `/ai-autonomy/proposals/:id/reject` |
| `approved` → `scheduled` | Sistema programma task | `voice-router.ts` approve handler |
| `scheduled` → `in_progress` | CRON trova task pronto | `ai-task-scheduler.ts` `executeTask()` |
| `in_progress` → `completed` | Callback chiamata OK / step OK | `voice-router.ts` POST `/call-result` |
| `in_progress` → `retry_pending` | Chiamata fallisce, retry disponibile | `ai-task-scheduler.ts` `handleFailure()` |
| `in_progress` → `failed` | Max retry raggiunto | `ai-task-scheduler.ts` `handleFailure()` |
| `in_progress` → `waiting_approval` | Step genera azione rischiosa | `ai-task-executor.ts` (nuovo) |
| `waiting_approval` → `in_progress` | Consulente approva azione | `voice-router.ts` approve handler |
| `retry_pending` → `in_progress` | CRON trova retry pronto | `ai-task-scheduler.ts` `processAITasks()` |
| `*` → `paused` | Consulente pausa | `voice-router.ts` PATCH `/ai-tasks/:id` |
| `paused` → `scheduled` | Consulente riprende | `voice-router.ts` PATCH `/ai-tasks/:id` |
| `*` → `cancelled` | Consulente cancella | `voice-router.ts` DELETE `/ai-tasks/:id` |

### 3.4 Integrazione con Sistemi Esistenti — Mapping Concreto

**Come il CRON job (`ai-task-scheduler.ts`) viene esteso:**

```typescript
// In processAITasks(), aggiungere branch per task_type === 'ai_task'
async function executeTask(task: AIScheduledTask): Promise<void> {
  if (task.task_type === 'ai_task') {
    // NUOVO FLUSSO: esecuzione multi-step
    await executeAutonomousTask(task); // server/services/ai-task-executor.ts
  } else {
    // FLUSSO ESISTENTE: chiamata diretta (invariato)
    const callSuccess = await initiateVoiceCall(task);
    // ... gestione successo/failure esistente ...
  }
}
```

**Come il callback (`voice-router.ts` POST `/call-result`) resta invariato:**

```
Callback riceve status da VPS
  │
  ├─ Aggiorna scheduled_voice_calls (invariato)
  │
  ├─ Se resolvedTaskId presente:
  │   ├─ Aggiorna ai_scheduled_tasks status (invariato)
  │   ├─ Se completed + recurrence: scheduleNextRecurrence() (invariato)
  │   └─ NUOVO: Se task era step di un execution_plan → aggiorna step status
  │
  └─ NUOVO: Log in ai_activity_log
```

**Come il VoiceTaskSupervisor interagisce:**

```
VoiceTaskSupervisor rileva intent durante chiamata
  │
  ├─ create_task → Crea in ai_scheduled_tasks (GIÀ FUNZIONA)
  │   └─ NUOVO: Setta origin_type = 'voice_supervisor'
  │
  ├─ modify_task → Modifica in ai_scheduled_tasks (GIÀ FUNZIONA)
  ├─ cancel_task → Cancella in ai_scheduled_tasks (GIÀ FUNZIONA)
  └─ list_tasks → Legge da ai_scheduled_tasks (GIÀ FUNZIONA)
```

---

## 4. BACKEND — Componenti e Flussi

### 4.1 Proactive Monitor Service (`server/services/ai-proactive-monitor.ts`)

CRON job che gira periodicamente e analizza lo stato dei clienti per ogni consulente con autonomia attiva.

```
CRON: ogni {proactive_check_interval_minutes} minuti
  │
  ├─ Per ogni consulente con is_active = true:
  │   │
  │   ├─ 1. Carica regole attive (ai_autonomous_rules)
  │   │
  │   ├─ 2. Per ogni regola:
  │   │   ├─ Valuta condizione contro i dati
  │   │   ├─ Se scatta:
  │   │   │   ├─ Controlla cooldown (non scattare troppo spesso per lo stesso contatto)
  │   │   │   ├─ Costruisci contesto (client data, history, metrics)
  │   │   │   └─ Genera task o proposta
  │   │   └─ Se non scatta: skip
  │   │
  │   ├─ 3. AI Global Analysis (opzionale, ogni N ore)
  │   │   ├─ Passa ALL clients data a Gemini
  │   │   ├─ "Analizza tutti i clienti. Ci sono situazioni che richiedono azione?"
  │   │   └─ Genera proposte per situazioni rilevate
  │   │
  │   └─ 4. Log attività nel feed
  │
  └─ Cleanup: Espira proposte vecchie, pulisci task stuck
```

**Regole Built-in (pre-configurate):**

| Regola | Condizione | Azione Default |
|--------|-----------|----------------|
| Inattività Cliente | Nessun contatto da X giorni | Proponi check-in call |
| Scadenza Contratto | Contratto scade tra X giorni | Proponi follow-up |
| Pagamento Ritardato | Fattura non pagata da X giorni | Proponi sollecito |
| Lead Caldo Ignorato | Lead con alto score non contattato | Proponi chiamata vendita |
| Compleanno/Anniversario | Data speciale entro X giorni | Proponi messaggio auguri |
| Post-Consulenza | Consulenza fatta, no follow-up da X giorni | Proponi check-in |
| Trend Negativo | Metriche peggiorano del X% | Report + proposta azione |

### 4.2 AI Decision Engine (`server/ai/autonomous-decision-engine.ts`)

Il cuore del sistema. Usa Gemini per analizzare il contesto e decidere cosa fare.

```
INPUT:
  - Trigger (rule, manual, event)
  - Contact context (history, data, last interactions)
  - Consultant preferences (autonomy level, custom instructions)
  - Available actions (call, email, wa, analysis, report)
  - Current workload (quanti task già in coda)

OUTPUT:
  {
    "decision": "execute" | "propose" | "skip",
    "reasoning": "Il cliente non risponde da 45 giorni...",
    "confidence": 0.87,
    "actions": [
      {
        "type": "analysis",
        "instruction": "Analizza storico pagamenti ultimi 6 mesi",
        "priority": 2
      },
      {
        "type": "voice_call",
        "instruction": "Chiama per check-in amichevole, menziona...",
        "delay_after_analysis": true,
        "template_id": "check-in-cliente"
      }
    ],
    "urgency": 2,
    "estimated_duration_minutes": 5
  }
```

**Prompt System del Decision Engine:**

```
Sei un dipendente esperto di una società di consulenza finanziaria.
Il tuo compito è analizzare la situazione di ogni cliente e decidere 
se è necessaria un'azione proattiva.

REGOLE DI DECISIONE:
1. NON essere invadente - rispetta i tempi del cliente
2. Prioritizza in base all'urgenza reale, non alla quantità di dati
3. Considera il canale preferito del cliente
4. Non proporre azioni se il consulente ne ha già troppe in coda
5. Sii specifico nelle istruzioni: non "chiama il cliente" ma "chiama 
   Mario per discutere il ritardo nel pagamento della fattura #123"

LIVELLO AUTONOMIA: {autonomy_level}/10
- Se <= 3: Proponi SEMPRE, non eseguire mai autonomamente
- Se 4-6: Esegui analisi/report autonomamente, proponi contatti
- Se >= 7: Esegui tutto tranne modifiche dati sensibili
- Se 10: Piena autonomia

ISTRUZIONI SPECIFICHE DEL CONSULENTE:
{custom_instructions}
```

### 4.3 Task Executor Service (`server/services/ai-task-executor.ts`)

Esegue materialmente i task. Supporta diversi tipi di azione:

| Azione | Implementazione | Sistemi Coinvolti |
|--------|----------------|-------------------|
| `analyze_data` | Usa Data Analysis Engine (query SQL + AI interpretation) | `server/ai/data-analysis/` |
| `generate_report` | Genera report strutturato con insights | Gemini + template PDF |
| `voice_call` | Crea scheduled_voice_call e triggera VPS | `ai-task-scheduler.ts` esistente |
| `send_email` | Invia email tramite Email Hub | `server/services/email-hub/` |
| `send_whatsapp` | Invia messaggio WhatsApp | `server/services/whatsapp/` |
| `research` | Cerca info nel knowledge base del consulente | `server/services/knowledge-searcher.ts` |
| `prepare_proposal` | Genera bozza proposta/preventivo | Gemini + template |
| `client_summary` | Genera riepilogo completo del cliente | Multi-source aggregation |

**Flusso Multi-Step:**

```
Task: "Analizza lo storico di Mario Rossi e chiama per discutere"

Step 1: fetch_client_data
  └─ Query DB per tutti i dati del cliente
  └─ Status: completed ✓

Step 2: analyze_patterns  
  └─ Gemini analizza dati e genera insights
  └─ Output: {insights: [...], recommendations: [...]}
  └─ Status: completed ✓

Step 3: prepare_call_context
  └─ Gemini prepara talking points per la chiamata
  └─ Output: "Punti da discutere: 1) Ritardo pagamento..."
  └─ Status: completed ✓

Step 4: voice_call
  └─ Crea scheduled_voice_call con context dei punti precedenti
  └─ Callback aggiorna task a 'completed' quando la chiamata finisce
  └─ Status: in_progress...
```

### 4.4 API Endpoints

#### Autonomy Settings
```
GET    /api/voice/ai-autonomy/settings          → Leggi impostazioni autonomia
PUT    /api/voice/ai-autonomy/settings          → Aggiorna impostazioni
POST   /api/voice/ai-autonomy/toggle            → Attiva/Disattiva AI autonomo
```

#### Autonomous Rules
```
GET    /api/voice/ai-autonomy/rules             → Lista regole
POST   /api/voice/ai-autonomy/rules             → Crea regola
PATCH  /api/voice/ai-autonomy/rules/:id         → Modifica regola
DELETE /api/voice/ai-autonomy/rules/:id         → Elimina regola
POST   /api/voice/ai-autonomy/rules/:id/toggle  → Attiva/Disattiva regola
```

#### Action Proposals
```
GET    /api/voice/ai-autonomy/proposals         → Lista proposte pendenti
POST   /api/voice/ai-autonomy/proposals/:id/approve  → Approva proposta
POST   /api/voice/ai-autonomy/proposals/:id/reject   → Rifiuta proposta
POST   /api/voice/ai-autonomy/proposals/bulk-approve → Approva multiple
```

#### Activity Feed
```
GET    /api/voice/ai-autonomy/activity          → Feed attività (paginato)
POST   /api/voice/ai-autonomy/activity/mark-read     → Segna come letto
GET    /api/voice/ai-autonomy/activity/unread-count   → Conteggio non letti
```

#### Task Management (estensione endpoint esistenti)
```
POST   /api/voice/ai-tasks                      → Crea task (manuale + autonomo)
GET    /api/voice/ai-tasks                      → Lista task (con filtri origin_type)
PATCH  /api/voice/ai-tasks/:id                  → Modifica task
DELETE /api/voice/ai-tasks/:id                  → Elimina task
GET    /api/voice/ai-tasks/:id/execution-plan   → Dettaglio piano esecuzione
POST   /api/voice/ai-tasks/:id/retry            → Retry manuale
POST   /api/voice/ai-tasks/:id/pause            → Metti in pausa
POST   /api/voice/ai-tasks/:id/resume           → Riprendi
```

#### Dashboard Stats
```
GET    /api/voice/ai-autonomy/dashboard         → Stats aggregate per dashboard
```

---

## 5. FRONTEND — Layout e Componenti

### 5.1 Pagina Principale: Tab "AI Autonomo" nella Voice Calls page

Aggiungere una nuova tab o sezione nella pagina `consultant-voice-calls.tsx` (o una pagina dedicata).

```
┌─────────────────────────────────────────────────────────────────┐
│  📱 Chiamate    📅 Pianificate    🤖 AI Autonomo    📊 Stats   │
└─────────────────────────────────────────────────────────────────┘
```

### 5.2 Layout Dashboard AI Autonomo

```
┌───────────────────────────────────────────────────────────────────┐
│ 🤖 AI Autonomo                                    [⚙️ Settings] │
│                                                                   │
│ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐    │
│ │ Attivo  │ │ In coda │ │ Oggi    │ │ Proposte│ │ Success │    │
│ │ ✅ ON   │ │   12    │ │   5     │ │   3 ⚠️  │ │  87%    │    │
│ └─────────┘ └─────────┘ └─────────┘ └─────────┘ └─────────┘    │
│                                                                   │
│ ┌─── PROPOSTE IN ATTESA (3) ──────────────────────────────────┐  │
│ │                                                              │  │
│ │ 🔔 Mario Rossi - Inattivo da 33 giorni                     │  │
│ │    L'AI propone: Check-in telefonico amichevole             │  │
│ │    Confidenza: 87%  Urgenza: Media                          │  │
│ │    [✅ Approva]  [❌ Rifiuta]  [✏️ Modifica e Approva]      │  │
│ │                                                              │  │
│ │ 📊 Laura Bianchi - Trend pagamenti negativo                 │  │
│ │    L'AI propone: Analisi + Report + Chiamata                │  │
│ │    Confidenza: 92%  Urgenza: Alta                           │  │
│ │    [✅ Approva]  [❌ Rifiuta]  [✏️ Modifica e Approva]      │  │
│ │                                                              │  │
│ │ 📞 Luca Verdi - Follow-up post-consulenza scaduto           │  │
│ │    L'AI propone: Chiamata check-in                          │  │
│ │    Confidenza: 79%  Urgenza: Bassa                          │  │
│ │    [✅ Approva]  [❌ Rifiuta]  [✏️ Modifica e Approva]      │  │
│ │                                                              │  │
│ │              [Approva Tutte]  [Vedi Tutte →]                │  │
│ └──────────────────────────────────────────────────────────────┘  │
│                                                                   │
│ ┌─── FEED ATTIVITÀ ───────────────────────────────────────────┐  │
│ │                                                              │  │
│ │ 14:30 🧠 Analisi completata: "Storico pagamenti Rossi"     │  │
│ │       → 3 insights rilevati, report generato                │  │
│ │                                                              │  │
│ │ 14:15 📞 Chiamata completata: Luigi Neri                    │  │
│ │       → Check-in riuscito, durata 3:45, cliente soddisfatto │  │
│ │                                                              │  │
│ │ 13:50 🔔 Regola scattata: "Inattività 30gg" per 2 clienti  │  │
│ │       → Proposte generate e in attesa di approvazione       │  │
│ │                                                              │  │
│ │ 13:00 ✅ Task completato: "Report mensile portfolio"        │  │
│ │       → PDF generato e salvato, 15 pagine                   │  │
│ │                                                              │  │
│ │                      [Carica altro ↓]                       │  │
│ └──────────────────────────────────────────────────────────────┘  │
│                                                                   │
│ ┌─── TASK ATTIVI ─────────────────────────────────────────────┐  │
│ │                                                              │  │
│ │ ┌────────────────────────────────────────────────────────┐   │  │
│ │ │ 🔄 In Esecuzione: "Analisi trimestrale clienti VIP"   │   │  │
│ │ │ Step 2/4: Analisi pattern  [████████░░░░] 60%          │   │  │
│ │ │ Avviato: 14:20  |  ETA: 14:35  |  Auto                │   │  │
│ │ └────────────────────────────────────────────────────────┘   │  │
│ │                                                              │  │
│ │ ┌────────────────────────────────────────────────────────┐   │  │
│ │ │ ⏰ Programmato: "Follow-up Bianchi" → oggi 16:00      │   │  │
│ │ │ Tipo: Chiamata  |  Priorità: Alta  |  Manuale         │   │  │
│ │ └────────────────────────────────────────────────────────┘   │  │
│ │                                                              │  │
│ │ ┌────────────────────────────────────────────────────────┐   │  │
│ │ │ 🔁 Ricorrente: "Check-in settimanale VIP"             │   │  │
│ │ │ Prossimo: Lun 10 Feb 09:00  |  5 contatti  |  Auto    │   │  │
│ │ └────────────────────────────────────────────────────────┘   │  │
│ │                                                              │  │
│ └──────────────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────────────┘
```

### 5.3 Pannello Impostazioni Autonomia

```
┌───────────────────────────────────────────────────────────────────┐
│ ⚙️ Impostazioni AI Autonomo                                      │
│                                                                   │
│ ┌─── LIVELLO AUTONOMIA ──────────────────────────────────────┐   │
│ │                                                             │   │
│ │  Solo Proposte ◄━━━━━━━━━━━●━━━━━━━━━━━► Piena Autonomia   │   │
│ │                            6                                │   │
│ │                                                             │   │
│ │  Livello 6: Semi-Autonomo                                   │   │
│ │  ✅ Analisi e report → Automatiche                          │   │
│ │  ✅ Ricerca informazioni → Automatica                       │   │
│ │  ⚠️ Chiamate → Richiede approvazione                       │   │
│ │  ⚠️ Email → Richiede approvazione                          │   │
│ │  ⚠️ WhatsApp → Richiede approvazione                       │   │
│ │  ❌ Modifica dati → Mai automatica                          │   │
│ └─────────────────────────────────────────────────────────────┘   │
│                                                                   │
│ ┌─── ORARI DI LAVORO ────────────────────────────────────────┐   │
│ │  Dalle: [08:00]  Alle: [20:00]                              │   │
│ │  Giorni: [✓] Lun [✓] Mar [✓] Mer [✓] Gio [✓] Ven [ ] Sab  │   │
│ └─────────────────────────────────────────────────────────────┘   │
│                                                                   │
│ ┌─── LIMITI GIORNALIERI ─────────────────────────────────────┐   │
│ │  Chiamate max: [10]    Email max: [20]                      │   │
│ │  WhatsApp max: [30]    Analisi max: [50]                    │   │
│ └─────────────────────────────────────────────────────────────┘   │
│                                                                   │
│ ┌─── CANALI ABILITATI ───────────────────────────────────────┐   │
│ │  [✓] Chiamate vocali    [✓] Email    [ ] WhatsApp          │   │
│ └─────────────────────────────────────────────────────────────┘   │
│                                                                   │
│ ┌─── ISTRUZIONI PERSONALIZZATE ──────────────────────────────┐   │
│ │  ┌─────────────────────────────────────────────────────┐    │   │
│ │  │ Non chiamare mai i clienti prima delle 10.          │    │   │
│ │  │ Prioritizza i lead con score > 70.                  │    │   │
│ │  │ Per i clienti VIP, proponi sempre prima di agire.   │    │   │
│ │  │ Non inviare più di 2 follow-up alla stessa persona  │    │   │
│ │  │ nella stessa settimana.                             │    │   │
│ │  └─────────────────────────────────────────────────────┘    │   │
│ └─────────────────────────────────────────────────────────────┘   │
│                                                                   │
│ ┌─── REGOLE DI MONITORAGGIO ─────────────────────────────────┐   │
│ │                                                             │   │
│ │  [✓] Inattività cliente (> 30 giorni)         [✏️] [🗑️]   │   │
│ │  [✓] Scadenza contratto (30 giorni prima)     [✏️] [🗑️]   │   │
│ │  [✓] Pagamento ritardato (> 15 giorni)        [✏️] [🗑️]   │   │
│ │  [ ] Lead caldo ignorato (> 3 giorni)         [✏️] [🗑️]   │   │
│ │  [✓] Post-consulenza senza follow-up          [✏️] [🗑️]   │   │
│ │                                                             │   │
│ │  [+ Aggiungi regola personalizzata]                         │   │
│ └─────────────────────────────────────────────────────────────┘   │
│                                                                   │
│                    [💾 Salva Impostazioni]                        │
└───────────────────────────────────────────────────────────────────┘
```

### 5.4 Componenti React da Creare

| Componente | Descrizione | File |
|-----------|-------------|------|
| `AIAutonomousDashboard` | Dashboard principale con stats, proposte, feed, task | `client/src/components/voice/ai-autonomous-dashboard.tsx` |
| `AIProposalCard` | Card singola proposta con azioni approve/reject | `client/src/components/voice/ai-proposal-card.tsx` |
| `AIActivityFeed` | Feed scrollabile delle attività AI | `client/src/components/voice/ai-activity-feed.tsx` |
| `AIAutonomySettings` | Pannello impostazioni con slider autonomia | `client/src/components/voice/ai-autonomy-settings.tsx` |
| `AIRuleEditor` | Editor regole di monitoraggio | `client/src/components/voice/ai-rule-editor.tsx` |
| `AITaskExecutionProgress` | Barra progresso task multi-step | `client/src/components/voice/ai-task-progress.tsx` |
| `AIAutonomyToggle` | Toggle on/off con conferma | `client/src/components/voice/ai-autonomy-toggle.tsx` |
| `AINotificationBadge` | Badge proposte pendenti nella navbar | `client/src/components/voice/ai-notification-badge.tsx` |

---

## 6. FLUSSI OPERATIVI DETTAGLIATI

### 6.1 Flusso Manuale: Consulente crea task

```
1. Consulente apre Dashboard AI Autonomo
2. Click "+ Nuovo Task"
3. Wizard esistente (già implementato) con tipo "Task AI Autonomo"
4. Seleziona:
   - Contatto (da rubrica)
   - Categoria (analisi/ricerca/report/outreach)
   - Istruzione in linguaggio naturale
   - Post-azioni: "Chiama dopo completamento" toggle
   - Scheduling: data/ora o "esegui subito"
5. AI migliora l'istruzione (endpoint /improve-instruction già esistente)
6. Conferma → Task creato con status 'scheduled'
7. CRON lo esegue al momento giusto
8. Task Executor:
   a. Raccoglie contesto
   b. Esegue steps del piano
   c. Se call_after_task: crea chiamata con risultati come contesto
   d. Logga tutto nel feed
```

### 6.2 Flusso Automatico: Proactive Monitor

```
1. CRON ogni 60min (configurabile)
2. Per ogni consulente con autonomia attiva:
   a. Carica regole attive
   b. Per ogni regola:
      - Query DB per trovare contatti che soddisfano la condizione
      - Es: "SELECT * FROM contacts WHERE last_contact_at < NOW() - INTERVAL '30 days'"
      - Per ogni match:
        - Controlla cooldown (non re-triggerare troppo presto)
        - Costruisci contesto completo (history, data, metrics)
        - Invia a Decision Engine
   c. Decision Engine decide:
      - autonomy_level >= 7 → Crea task direttamente (auto-esecuzione)
      - autonomy_level 4-6 → Crea proposta (pending approval)
      - autonomy_level <= 3 → Crea proposta + notifica push
3. Le proposte appaiono nel Dashboard
4. Il consulente approva/rifiuta
5. Se approvato → Task creato e schedulato
```

### 6.3 Flusso Reattivo: Evento triggera azione

```
TRIGGER: Fine di una chiamata vocale con un cliente
  │
  ├─ VoiceTaskSupervisor rileva intent durante la chiamata
  │   Es: "Il cliente ha detto che vuole il report mensile"
  │
  ├─ Callback di fine chiamata:
  │   1. Salva transcript
  │   2. Invia transcript a Decision Engine
  │   3. AI analizza: "Il cliente ha richiesto un report. Devo crearlo?"
  │   4. Se autonomy >= 5:
  │      → Crea task "Genera report mensile per cliente X"
  │      → Esegui automaticamente
  │   5. Se autonomy < 5:
  │      → Crea proposta "Generare report mensile per cliente X?"
  │
  └─ Risultato viene loggato nel feed
```

### 6.4 Flusso Multi-Step con Chiamata Post-Task

```
Task: "Analizza portfolio e chiama per discutere"

T+0min: Task avviato
  │
  ├─ Step 1: Fetch data (30s)
  │   └─ Carica dati cliente da DB, Excel uploads, API esterne
  │
  ├─ Step 2: AI Analysis (2min)  
  │   └─ Gemini analizza pattern, genera insights
  │   └─ Output: {insights: [...], risk_score: 7.2, recommendations: [...]}
  │
  ├─ Step 3: Generate Report (1min)
  │   └─ Crea report strutturato con grafici
  │   └─ Salva in result_data
  │
  ├─ Step 4: Prepare Call (30s)
  │   └─ AI genera talking points basati sull'analisi
  │   └─ "Punti da discutere:
  │       1. Portfolio ha rendimento +12% YTD
  │       2. Concentrazione su tech (35%) - diversificare?
  │       3. Bond in scadenza tra 60 giorni - rinnovo?"
  │
  ├─ Step 5: Voice Call
  │   └─ Crea scheduled_voice_call
  │   └─ custom_prompt include talking points
  │   └─ AI chiama il cliente con contesto completo
  │
T+5min: Chiamata in corso
  │
  ├─ Durante la chiamata:
  │   └─ VoiceTaskSupervisor monitora (può creare nuovi task)
  │   └─ VoiceBookingSupervisor monitora (può prenotare appuntamento)
  │
T+10min: Chiamata completata
  │
  └─ Callback aggiorna:
      ├─ ai_scheduled_tasks → completed
      ├─ scheduled_voice_calls → completed
      ├─ ai_activity_log → nuovo entry
      └─ Se ricorrente → schedula prossima occorrenza
```

---

## 7. INTEGRAZIONE CON SISTEMI ESISTENTI

### 7.1 Integrazione con `ai-task-scheduler.ts` (CRON esistente)

Il CRON job esistente continua a funzionare per i task di tipo `single_call` e `follow_up`. Per i task `ai_task`, viene esteso:

```
processAITasks():
  IF task.task_type === 'ai_task':
    // Nuovo flusso: esegui piano multi-step
    await executeAutonomousTask(task)
  ELSE:
    // Flusso esistente: chiama direttamente
    await initiateVoiceCall(task)
```

### 7.2 Integrazione con VoiceTaskSupervisor

Il VoiceTaskSupervisor già rileva intent durante le chiamate. Viene esteso per:
- Creare task autonomi quando il chiamante richiede analisi/ricerche
- Collegare task creati durante la chiamata al task autonomo padre

### 7.3 Integrazione con Follow-up Decision Engine

Il `human-like-decision-engine.ts` e il `followup-decision-engine.ts` condividono la stessa filosofia: **l'AI decide come farebbe un dipendente umano**. Il Decision Engine autonomo riutilizza:
- `getAIProvider()` per accedere a Gemini
- Pattern retry con exponential backoff
- Struttura di valutazione e logging

### 7.4 Integrazione con Data Analysis Engine

Per task di categoria `analysis`, il Task Executor usa il sistema di Data Analysis esistente:
- `server/ai/data-analysis/query-planner.ts` per pianificare query
- `server/ai/data-analysis/result-explainer.ts` per interpretare risultati
- Output strutturato come insights + recommendations

### 7.5 Integrazione con Email Hub

Per azioni di tipo `email`, usa:
- `server/services/email-hub/smtp-service.ts` per inviare
- `server/ai/email-template-generator.ts` per generare contenuto

### 7.6 Integrazione con WhatsApp

Per azioni di tipo `whatsapp`, usa il sistema WhatsApp esistente per inviare messaggi.

---

## 8. SICUREZZA E GUARDRAILS

### 8.1 Modello di Autorizzazione

Tutti gli endpoint del sistema autonomo usano il middleware esistente:

```typescript
// Autenticazione: JWT token obbligatorio
authenticateToken

// Autorizzazione: solo consultant e super_admin
requireAnyRole(["consultant", "super_admin"])

// Isolamento dati: ogni query filtra per consultant_id
WHERE consultant_id = ${req.user.id}
```

**Regole di accesso:**

| Ruolo | Permessi |
|-------|----------|
| `consultant` | CRUD propri task, settings, rules. Approva/rifiuta proprie proposte. Vede solo propri dati. |
| `super_admin` | Tutto ciò che può consultant + vista globale per debug. NO modifica task altrui. |
| `client` | Nessun accesso al sistema autonomo. |

**Isolamento multi-tenant**: Il `consultant_id` è presente in TUTTE le tabelle del sistema autonomo. Ogni query include `WHERE consultant_id = ?`. Il Proactive Monitor processa ogni consulente in isolamento.

### 8.2 Rate Limiting e Limiti Operativi

| Limite | Default | Configurabile | Enforcement |
|--------|---------|---------------|-------------|
| Chiamate/giorno | 10 | ✅ (ai_autonomy_settings) | Conteggio giornaliero in ai_scheduled_tasks |
| Email/giorno | 20 | ✅ | Conteggio giornaliero in ai_activity_log |
| WhatsApp/giorno | 30 | ✅ | Conteggio giornaliero in ai_activity_log |
| Analisi/giorno | 50 | ✅ | Conteggio giornaliero in ai_activity_log |
| Task simultanei in_progress | 3 | ❌ (hardcoded) | Check prima di executeTask() |
| Retry max per task | 3 | ✅ | Esistente in ai-task-scheduler.ts |
| Orario operativo | 08-20 L-V | ✅ | Check in processAITasks() e proactive-monitor |
| Cooldown per contatto | 7 giorni | ✅ (per regola) | Check in proactive-monitor |
| Gemini API calls/min | 15 RPM | ❌ | gemini-rate-limiter.ts esistente |
| Max proposte pending/consulente | 20 | ❌ (hardcoded) | Check prima di creare proposta |

**Enforcement nel CRON:**

```typescript
// In ai-task-scheduler.ts, prima di eseguire un task autonomo:
async function canExecuteAutonomousTask(consultantId: string): Promise<boolean> {
  // 1. Check orario di lavoro
  const settings = await getAutonomySettings(consultantId);
  if (!isWithinWorkingHours(settings)) return false;

  // 2. Check limiti giornalieri
  const todayCounts = await getTodayActionCounts(consultantId);
  if (todayCounts.calls >= settings.max_daily_calls) return false;

  // 3. Check task simultanei
  const inProgressCount = await getInProgressTaskCount(consultantId);
  if (inProgressCount >= 3) return false;

  return true;
}
```

### 8.3 Azioni Mai Automatiche (Hardcoded)

Indipendentemente dal livello di autonomia (enforcement nel codice, NON configurabile):
- ❌ Eliminare dati del cliente dal database
- ❌ Modificare contratti/fatture/pagamenti
- ❌ Accedere a dati di altri consulenti (isolamento multi-tenant)
- ❌ Inviare dati finanziari sensibili via canali non crittografati
- ❌ Superare i limiti giornalieri configurati
- ❌ Operare fuori dall'orario configurato
- ❌ Creare task con numero di telefono non presente nella rubrica del consulente
- ❌ Chiamare lo stesso contatto più di 2 volte nello stesso giorno

### 8.4 Audit Trail Completo

Ogni azione dell'AI viene loggata in `ai_activity_log` con:

| Campo | Contenuto | Esempio |
|-------|-----------|---------|
| `consultant_id` | Chi | UUID del consulente |
| `event_type` | Tipo azione | `action_executed`, `rule_triggered` |
| `title` | Cosa (human-readable) | "Chiamata check-in a Mario Rossi" |
| `description` | Dettaglio | "Completata in 3:45, cliente soddisfatto" |
| `ai_reasoning` (nel task) | Perché | "Nessun contatto da 33 giorni, regola inattività" |
| `ai_confidence` (nel task) | Quanto sicuro | 0.87 |
| `event_data` | Dati strutturati | `{duration: 225, outcome: "positive"}` |
| `created_at` | Quando | Timestamp UTC |

Il consulente può sempre vedere lo storico completo nel Feed Attività e capire **perché** l'AI ha fatto ogni azione.

---

## 9. PIANO DI IMPLEMENTAZIONE

### Fase 1: Fondamenta (2-3 settimane)
1. Schema DB: Estendere `ai_scheduled_tasks` + creare `ai_autonomy_settings` + `ai_activity_log`
2. Backend: `ai-autonomy-settings` CRUD endpoints
3. Backend: `ai-activity-log` CRUD endpoints
4. Frontend: `AIAutonomySettings` component
5. Frontend: `AIActivityFeed` component
6. Task Executor base: Supporto multi-step per `ai_task`

### Fase 2: Decision Engine (2-3 settimane)
7. Backend: `autonomous-decision-engine.ts` con Gemini integration
8. Backend: Estendere `ai-task-scheduler.ts` per task multi-step
9. Backend: `ai-task-executor.ts` con azioni (analisi, report, call)
10. Frontend: `AITaskExecutionProgress` component
11. Frontend: Dashboard con task attivi e storico

### Fase 3: Proactive Monitor (2-3 settimane)
12. Schema DB: `ai_autonomous_rules` + `ai_action_proposals`
13. Backend: `ai-proactive-monitor.ts` CRON job
14. Backend: Proposals CRUD + approve/reject endpoints
15. Frontend: `AIProposalCard` + approval queue
16. Frontend: `AIRuleEditor` per configurare regole
17. Regole built-in predefinite

### Fase 4: Integrations & Polish (1-2 settimane)
18. Integrazione con Data Analysis Engine
19. Integrazione con Email Hub
20. Notifiche push (badge proposte pendenti)
21. Stats e analytics
22. Testing e-2-e completo

---

## 10. METRICHE DI SUCCESSO

| Metrica | Target |
|---------|--------|
| Task completati con successo | > 85% |
| Tempo medio esecuzione task | < 10 min |
| Proposte approvate vs rifiutate | > 70% approvate |
| Riduzione interventi manuali consulente | > 40% |
| Soddisfazione consulente (feedback) | > 4/5 |
| Zero azioni non autorizzate | 100% |

---

## 11. NOTE TECNICHE

### 11.1 Modelli AI Utilizzati

| Componente | Modello | Motivo |
|-----------|---------|--------|
| Decision Engine | Gemini 2.5 Flash | Veloce, cost-effective, buon reasoning |
| Analisi Complesse | Gemini 2.5 Flash con Thinking | Reasoning profondo |
| Report Generation | Gemini 2.5 Flash | Output strutturato |
| Template Instructions | Gemini 2.5 Flash Lite | Veloce, task semplici |

### 11.2 Compatibilità con Sistema Esistente

- `ai_scheduled_tasks` resta la tabella principale → viene estesa, non sostituita
- `ai-task-scheduler.ts` CRON resta il motore di esecuzione → viene esteso
- Callback system (`/api/voice/call-result`) resta invariato
- `scheduleNextRecurrence()` resta invariato
- Frontend wizard Step 2 (tipo ai_task) resta → viene collegato al nuovo sistema

### 11.3 Dipendenze Esterne

- **Gemini API**: Rate limits da rispettare (RPM/TPM per progetto)
- **FreeSWITCH/VPS**: Per le chiamate vocali
- **SMTP/IMAP**: Per le email
- **Twilio**: Per WhatsApp

---

> **Questo RDP è un documento vivente.** Verrà aggiornato man mano che l'implementazione procede e nuovi requisiti emergono.
