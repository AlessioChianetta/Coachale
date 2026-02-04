# AI Scheduler - Specifica Tecnica Completa

## 📋 Overview

Sistema di schedulazione AI integrato nel Centro Chiamate AI che permette di:
- Programmare chiamate singole future
- Creare task AI ricorrenti (giornalieri/settimanali)
- Gestire retry automatici
- Visualizzare una coda operativa AI

**Filosofia UX**: "Controllo AI operativo" - non un gestionale, ma un pannello di controllo intelligente.

---

## 🗄️ Database Schema

### Tabella: `ai_scheduled_tasks`

```sql
CREATE TABLE ai_scheduled_tasks (
  id VARCHAR(50) PRIMARY KEY DEFAULT 'task_' || EXTRACT(EPOCH FROM NOW())::BIGINT || '_' || SUBSTR(MD5(RANDOM()::TEXT), 1, 8),
  consultant_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Contatto
  contact_name VARCHAR(255),
  contact_phone VARCHAR(50) NOT NULL,
  
  -- Tipo task
  task_type VARCHAR(20) NOT NULL DEFAULT 'single_call',
  -- Valori: 'single_call', 'follow_up', 'ai_task'
  
  -- Istruzione AI (cosa deve fare durante la chiamata)
  ai_instruction TEXT NOT NULL,
  
  -- Scheduling
  scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL,
  timezone VARCHAR(50) DEFAULT 'Europe/Rome',
  
  -- Ricorrenza
  recurrence_type VARCHAR(20) DEFAULT 'once',
  -- Valori: 'once', 'daily', 'weekly', 'custom'
  recurrence_days INTEGER[], -- Per weekly: [1,3,5] = Lun,Mer,Ven (1=Lunedì)
  recurrence_end_date DATE, -- Data fine ricorrenza (opzionale)
  
  -- Retry
  max_attempts INTEGER DEFAULT 1,
  current_attempt INTEGER DEFAULT 0,
  retry_delay_minutes INTEGER DEFAULT 15,
  last_attempt_at TIMESTAMP WITH TIME ZONE,
  next_retry_at TIMESTAMP WITH TIME ZONE,
  
  -- Stato
  status VARCHAR(20) NOT NULL DEFAULT 'scheduled',
  -- Valori: 'scheduled', 'in_progress', 'completed', 'failed', 'paused', 'retry_pending', 'cancelled'
  
  -- Risultato
  result_summary TEXT,
  voice_call_id VARCHAR(100), -- Riferimento a voice_calls se eseguito
  
  -- Template vocale (opzionale)
  voice_template_id VARCHAR(50),
  voice_direction VARCHAR(10) DEFAULT 'outbound',
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  
  -- Indici
  CONSTRAINT valid_task_type CHECK (task_type IN ('single_call', 'follow_up', 'ai_task')),
  CONSTRAINT valid_status CHECK (status IN ('scheduled', 'in_progress', 'completed', 'failed', 'paused', 'retry_pending', 'cancelled')),
  CONSTRAINT valid_recurrence CHECK (recurrence_type IN ('once', 'daily', 'weekly', 'custom'))
);

-- Indici per performance
CREATE INDEX idx_ai_tasks_consultant ON ai_scheduled_tasks(consultant_id);
CREATE INDEX idx_ai_tasks_status ON ai_scheduled_tasks(status);
CREATE INDEX idx_ai_tasks_scheduled ON ai_scheduled_tasks(scheduled_at);
CREATE INDEX idx_ai_tasks_next_execution ON ai_scheduled_tasks(status, scheduled_at) 
  WHERE status IN ('scheduled', 'retry_pending');
```

### Relazioni

```
ai_scheduled_tasks
       │
       ├── consultant_id → users (FK)
       │
       └── voice_call_id → voice_calls (soft reference)
              │
              └── Le chiamate eseguite finiscono in voice_calls (fonte di verità)
```

---

## 🔄 Diagramma di Flusso

```
┌─────────────────────────────────────────────────────────────────────┐
│                        AI SCHEDULER FLOW                              │
└─────────────────────────────────────────────────────────────────────┘

┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   UTENTE     │────▶│   DRAWER     │────▶│  API POST    │
│ Clicca "+""  │     │ Compila form │     │ /ai-tasks    │
└──────────────┘     └──────────────┘     └──────┬───────┘
                                                  │
                                                  ▼
                                          ┌──────────────┐
                                          │   DATABASE   │
                                          │ ai_scheduled │
                                          │   _tasks     │
                                          └──────┬───────┘
                                                  │
                     ┌────────────────────────────┴────────────────────────────┐
                     │                                                          │
                     ▼                                                          ▼
            ┌──────────────┐                                          ┌──────────────┐
            │ CRON SERVICE │                                          │ UI: LISTA    │
            │ ogni 1 min   │                                          │ AI Task Queue│
            └──────┬───────┘                                          └──────────────┘
                   │
                   │ Query: status='scheduled' AND scheduled_at <= NOW()
                   ▼
            ┌──────────────┐
            │   LOCK DB    │ ◀── Mutex anti-duplicazione
            │ (FOR UPDATE) │
            └──────┬───────┘
                   │
                   ▼
            ┌──────────────┐
            │ UPDATE task  │
            │ status →     │
            │ 'in_progress'│
            └──────┬───────┘
                   │
                   ▼
            ┌──────────────┐
            │ CHIAMA API   │────▶ Sistema Voice Call esistente
            │ outbound-call│      (POST /api/voice/outbound/initiate)
            └──────┬───────┘
                   │
         ┌─────────┴─────────┐
         │                   │
         ▼                   ▼
   ┌──────────┐        ┌──────────┐
   │ SUCCESSO │        │ FALLITO  │
   └────┬─────┘        └────┬─────┘
        │                   │
        ▼                   ▼
   ┌──────────┐        ┌──────────────────┐
   │ status → │        │ attempt < max?   │
   │'completed'│       └────┬────────┬────┘
   └────┬─────┘             │        │
        │              SI   │        │ NO
        │                   ▼        ▼
        │            ┌──────────┐ ┌──────────┐
        │            │ status → │ │ status → │
        │            │'retry_   │ │ 'failed' │
        │            │ pending' │ └──────────┘
        │            │next_retry│
        │            │= +delay  │
        │            └──────────┘
        │
        ▼
   ┌──────────────────┐
   │ RICORRENZA?      │
   └────┬────────┬────┘
        │        │
   SI   │        │ NO
        ▼        ▼
   ┌──────────┐  FINE
   │ CREA     │
   │ NUOVO    │
   │ TASK per │
   │ prossima │
   │ data     │
   └──────────┘
```

---

## 🖥️ Backend - Endpoints API

### Base URL: `/api/voice/ai-tasks`

| Metodo | Endpoint | Descrizione |
|--------|----------|-------------|
| GET | `/` | Lista task con paginazione e filtri |
| GET | `/:id` | Dettaglio singolo task |
| POST | `/` | Crea nuovo task |
| PATCH | `/:id` | Modifica task |
| DELETE | `/:id` | Elimina task |
| POST | `/:id/execute` | Esegui subito |
| POST | `/:id/pause` | Metti in pausa |
| POST | `/:id/resume` | Riprendi |
| POST | `/:id/cancel` | Annulla |

### Request/Response Schemas

#### POST `/api/voice/ai-tasks` - Crea Task

```typescript
// Request
interface CreateAITaskRequest {
  contact_name?: string;
  contact_phone: string;
  task_type: 'single_call' | 'follow_up' | 'ai_task';
  ai_instruction: string;
  scheduled_at: string; // ISO datetime
  recurrence_type?: 'once' | 'daily' | 'weekly' | 'custom';
  recurrence_days?: number[]; // [1,2,3,4,5] = Lun-Ven
  recurrence_end_date?: string; // ISO date
  max_attempts?: number; // 1-5
  retry_delay_minutes?: number; // 5, 15, 60
  voice_template_id?: string;
}

// Response
interface AITask {
  id: string;
  consultant_id: string;
  contact_name: string | null;
  contact_phone: string;
  task_type: string;
  ai_instruction: string;
  scheduled_at: string;
  timezone: string;
  recurrence_type: string;
  recurrence_days: number[] | null;
  recurrence_end_date: string | null;
  max_attempts: number;
  current_attempt: number;
  retry_delay_minutes: number;
  status: string;
  result_summary: string | null;
  voice_call_id: string | null;
  created_at: string;
  updated_at: string;
}
```

#### GET `/api/voice/ai-tasks` - Lista Task

```typescript
// Query params
interface ListTasksParams {
  status?: string; // Filtro per stato
  page?: number;
  limit?: number; // Default 20, max 100
  sort?: 'scheduled_at' | 'created_at' | 'status';
  order?: 'asc' | 'desc';
}

// Response
interface ListTasksResponse {
  tasks: AITask[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
```

---

## 🎨 Frontend - Layout UI

### Struttura Pagina Centro Chiamate AI

```
┌─────────────────────────────────────────────────────────────────────┐
│  CENTRO CHIAMATE AI                                    [+ Nuova]    │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐                     │
│  │ Chiamate   │  │ AI Task    │  │ Storico    │                     │
│  │ In Corso   │  │ Queue      │  │            │                     │
│  └────────────┘  └────────────┘  └────────────┘                     │
│       ▲               ▲                                              │
│       │               │                                              │
│    [TAB]           [TAB] ◀── NUOVO                                   │
│                                                                      │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌─ FILTRI RAPIDI ──────────────────────────────────────────────┐   │
│  │  [Tutti] [Programmati] [In Corso] [In Attesa] [Completati]   │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                      │
│  ┌─ AI TASK QUEUE ──────────────────────────────────────────────┐   │
│  │                                                               │   │
│  │  ┌─────────────────────────────────────────────────────────┐ │   │
│  │  │ 📞 Mario Rossi                        🟢 Programmata    │ │   │
│  │  │ +39 333 1234567                       Oggi 15:30        │ │   │
│  │  │ "Ricorda scadenza contratto..."                         │ │   │
│  │  │                              [▶️ Ora] [⏸️] [✏️] [🗑️]    │ │   │
│  │  └─────────────────────────────────────────────────────────┘ │   │
│  │                                                               │   │
│  │  ┌─────────────────────────────────────────────────────────┐ │   │
│  │  │ 🔁 Lead ABC                           🟡 Retry (2/3)    │ │   │
│  │  │ +39 333 9876543                       Retry tra 10min   │ │   │
│  │  │ "Follow-up preventivo inviato..."                       │ │   │
│  │  │                              [▶️ Ora] [⏸️] [✏️] [🗑️]    │ │   │
│  │  └─────────────────────────────────────────────────────────┘ │   │
│  │                                                               │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                      │
│  ┌─ PAGINAZIONE ────────────────────────────────────────────────┐   │
│  │  ◀ Precedente    Pagina 1 di 5    Successivo ▶               │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### Drawer Laterale - Programma Chiamata AI

```
                                    ┌────────────────────────────────┐
                                    │ ✕  PROGRAMMA CHIAMATA AI       │
                                    ├────────────────────────────────┤
                                    │                                │
                                    │ ┌─ CONTATTO ─────────────────┐ │
                                    │ │ Nome (opzionale)           │ │
                                    │ │ ┌──────────────────────┐   │ │
                                    │ │ │ Mario Rossi          │   │ │
                                    │ │ └──────────────────────┘   │ │
                                    │ │                            │ │
                                    │ │ Numero telefono *          │ │
                                    │ │ ┌──────────────────────┐   │ │
                                    │ │ │ +39 333 1234567      │   │ │
                                    │ │ └──────────────────────┘   │ │
                                    │ └────────────────────────────┘ │
                                    │                                │
                                    │ ┌─ TIPO AZIONE ──────────────┐ │
                                    │ │                            │ │
                                    │ │ [📞 Chiamata] [🔁 Follow] [🤖 Task] │
                                    │ │                            │ │
                                    │ └────────────────────────────┘ │
                                    │                                │
                                    │ ┌─ ISTRUZIONE AI ────────────┐ │
                                    │ │ Cosa deve fare l'AI? *     │ │
                                    │ │ ┌──────────────────────┐   │ │
                                    │ │ │ Ricorda la scadenza  │   │ │
                                    │ │ │ del contratto e      │   │ │
                                    │ │ │ proponi rinnovo...   │   │ │
                                    │ │ └──────────────────────┘   │ │
                                    │ └────────────────────────────┘ │
                                    │                                │
                                    │ ┌─ QUANDO ───────────────────┐ │
                                    │ │ Data         Ora           │ │
                                    │ │ ┌─────────┐  ┌─────────┐   │ │
                                    │ │ │ 05/02   │  │ 15:30   │   │ │
                                    │ │ └─────────┘  └─────────┘   │ │
                                    │ │                            │ │
                                    │ │ Frequenza                  │ │
                                    │ │ ┌──────────────────────┐   │ │
                                    │ │ │ Una volta        ▼   │   │ │
                                    │ │ └──────────────────────┘   │ │
                                    │ └────────────────────────────┘ │
                                    │                                │
                                    │ ┌─ ▼ OPZIONI AVANZATE ───────┐ │
                                    │ │ (collapsato per default)   │ │
                                    │ │                            │ │
                                    │ │ Tentativi max: [3]         │ │
                                    │ │ Delay retry: [15 min ▼]    │ │
                                    │ │ Template: [Nessuno ▼]      │ │
                                    │ └────────────────────────────┘ │
                                    │                                │
                                    │ ┌────────────────────────────┐ │
                                    │ │   PROGRAMMA CHIAMATA AI    │ │
                                    │ │          (button)          │ │
                                    │ └────────────────────────────┘ │
                                    │                                │
                                    └────────────────────────────────┘
```

### Stati Badge Colorati

| Stato | Badge | Colore | Icona |
|-------|-------|--------|-------|
| scheduled | Programmata | 🟢 Verde | ⏰ |
| in_progress | In corso | 🔵 Blu | 📞 |
| retry_pending | In attesa di riprovare | 🟡 Giallo | 🔄 |
| failed | Fallita | 🔴 Rosso | ❌ |
| completed | Completata | ⚪ Grigio | ✓ |
| paused | In pausa | 🟠 Arancione | ⏸️ |
| cancelled | Annullata | ⚫ Nero | 🚫 |

### Icone Tipo Task

| Tipo | Icona | Label |
|------|-------|-------|
| single_call | 📞 | Chiamata |
| follow_up | 🔁 | Follow-up |
| ai_task | 🤖 | Task AI |

---

## 📱 Mobile Layout

### Lista Verticale

```
┌─────────────────────────────────┐
│  AI Task Queue            [+]   │ ◀── FAB flottante
├─────────────────────────────────┤
│ ┌─────────────────────────────┐ │
│ │ 📞 Mario Rossi    🟢 15:30  │ │
│ │ Ricorda scadenza...         │ │
│ │ ───────────────────────────  │ │
│ │ [▶️] [⏸️] [✏️] [🗑️]          │ │
│ └─────────────────────────────┘ │
│                                 │
│ ┌─────────────────────────────┐ │
│ │ 🔁 Lead ABC      🟡 Retry   │ │
│ │ Follow-up preventivo...     │ │
│ │ ───────────────────────────  │ │
│ │ [▶️] [⏸️] [✏️] [🗑️]          │ │
│ └─────────────────────────────┘ │
│                                 │
└─────────────────────────────────┘
```

### Bottom Sheet (Creazione Task)

```
┌─────────────────────────────────┐
│ ─────────  (drag handle)        │
│                                 │
│ PROGRAMMA CHIAMATA AI           │
│                                 │
│ Nome                            │
│ ┌─────────────────────────────┐ │
│ │                             │ │
│ └─────────────────────────────┘ │
│                                 │
│ Numero *                        │
│ ┌─────────────────────────────┐ │
│ │ +39                         │ │
│ └─────────────────────────────┘ │
│                                 │
│ [📞] [🔁] [🤖]                  │
│                                 │
│ Cosa deve fare l'AI? *          │
│ ┌─────────────────────────────┐ │
│ │                             │ │
│ │                             │ │
│ └─────────────────────────────┘ │
│                                 │
│ ┌────────────┐ ┌──────────────┐ │
│ │ 📅 Data    │ │ 🕐 Ora       │ │
│ └────────────┘ └──────────────┘ │
│                                 │
│ ▼ Opzioni avanzate              │
│                                 │
│ ┌─────────────────────────────┐ │
│ │   PROGRAMMA CHIAMATA AI     │ │
│ └─────────────────────────────┘ │
│                                 │
└─────────────────────────────────┘
```

---

## ⚙️ Backend Service - TaskSchedulerService

### Architettura

```typescript
// server/services/ai-task-scheduler.ts

class AITaskSchedulerService {
  private isRunning = false;
  private intervalId: NodeJS.Timeout | null = null;
  
  // Avvia il cron (ogni minuto)
  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.intervalId = setInterval(() => this.processTasks(), 60_000);
    log.info('AI Task Scheduler started');
  }
  
  // Ferma il cron
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    log.info('AI Task Scheduler stopped');
  }
  
  // Processa task in scadenza
  async processTasks() {
    // 1. Lock mutex (usa tabella cron_mutex esistente)
    const lockAcquired = await this.acquireLock('ai_task_scheduler');
    if (!lockAcquired) {
      log.debug('AI Task Scheduler: lock not acquired, skipping');
      return;
    }
    
    try {
      // 2. Trova task da eseguire
      const tasks = await db.query(`
        SELECT * FROM ai_scheduled_tasks 
        WHERE status IN ('scheduled', 'retry_pending')
        AND (
          (status = 'scheduled' AND scheduled_at <= NOW())
          OR 
          (status = 'retry_pending' AND next_retry_at <= NOW())
        )
        ORDER BY scheduled_at ASC
        LIMIT 10
        FOR UPDATE SKIP LOCKED
      `);
      
      // 3. Esegui ogni task
      for (const task of tasks) {
        await this.executeTask(task);
      }
    } finally {
      await this.releaseLock('ai_task_scheduler');
    }
  }
  
  // Esegue singolo task
  async executeTask(task: AITask) {
    // 1. Aggiorna stato a in_progress
    await db.query(`
      UPDATE ai_scheduled_tasks 
      SET status = 'in_progress', 
          current_attempt = current_attempt + 1,
          last_attempt_at = NOW(),
          updated_at = NOW()
      WHERE id = $1
    `, [task.id]);
    
    try {
      // 2. Chiama API outbound esistente
      const result = await this.initiateCall(task);
      
      // 3. Gestisci risultato
      if (result.success) {
        await this.handleSuccess(task, result);
      } else {
        await this.handleFailure(task, result);
      }
    } catch (error) {
      await this.handleError(task, error);
    }
  }
  
  // Inizia chiamata usando sistema esistente
  async initiateCall(task: AITask) {
    // Usa endpoint esistente POST /api/voice/outbound/initiate
    // Passa ai_instruction come custom prompt
    return await voiceOutboundService.initiateCall({
      phone: task.contact_phone,
      contactName: task.contact_name,
      customInstruction: task.ai_instruction,
      templateId: task.voice_template_id,
      sourceTaskId: task.id // Per tracciamento
    });
  }
  
  // Gestisci successo
  async handleSuccess(task: AITask, result: CallResult) {
    await db.query(`
      UPDATE ai_scheduled_tasks 
      SET status = 'completed',
          result_summary = $2,
          voice_call_id = $3,
          completed_at = NOW(),
          updated_at = NOW()
      WHERE id = $1
    `, [task.id, result.summary, result.callId]);
    
    // Se ricorrente, crea prossimo task
    if (task.recurrence_type !== 'once') {
      await this.scheduleNextRecurrence(task);
    }
  }
  
  // Gestisci fallimento con retry
  async handleFailure(task: AITask, result: CallResult) {
    const canRetry = task.current_attempt < task.max_attempts;
    
    if (canRetry) {
      const nextRetry = new Date(Date.now() + task.retry_delay_minutes * 60_000);
      await db.query(`
        UPDATE ai_scheduled_tasks 
        SET status = 'retry_pending',
            next_retry_at = $2,
            result_summary = $3,
            updated_at = NOW()
        WHERE id = $1
      `, [task.id, nextRetry, result.reason]);
    } else {
      await db.query(`
        UPDATE ai_scheduled_tasks 
        SET status = 'failed',
            result_summary = $2,
            completed_at = NOW(),
            updated_at = NOW()
        WHERE id = $1
      `, [task.id, result.reason]);
      
      // Se ricorrente, programma comunque prossima
      if (task.recurrence_type !== 'once') {
        await this.scheduleNextRecurrence(task);
      }
    }
  }
  
  // Calcola e crea prossima ricorrenza
  async scheduleNextRecurrence(task: AITask) {
    const nextDate = this.calculateNextDate(task);
    
    if (!nextDate) return; // Fine ricorrenza
    
    if (task.recurrence_end_date && nextDate > new Date(task.recurrence_end_date)) {
      return; // Superata data fine
    }
    
    // Crea nuovo task per prossima occorrenza
    await db.query(`
      INSERT INTO ai_scheduled_tasks (
        consultant_id, contact_name, contact_phone, task_type,
        ai_instruction, scheduled_at, timezone, recurrence_type,
        recurrence_days, recurrence_end_date, max_attempts,
        retry_delay_minutes, voice_template_id, voice_direction
      ) SELECT 
        consultant_id, contact_name, contact_phone, task_type,
        ai_instruction, $2, timezone, recurrence_type,
        recurrence_days, recurrence_end_date, max_attempts,
        retry_delay_minutes, voice_template_id, voice_direction
      FROM ai_scheduled_tasks WHERE id = $1
    `, [task.id, nextDate]);
  }
  
  // Calcola prossima data in base a ricorrenza
  calculateNextDate(task: AITask): Date | null {
    const current = new Date(task.scheduled_at);
    
    switch (task.recurrence_type) {
      case 'daily':
        current.setDate(current.getDate() + 1);
        return current;
        
      case 'weekly':
        if (!task.recurrence_days?.length) {
          current.setDate(current.getDate() + 7);
          return current;
        }
        // Trova prossimo giorno della settimana
        return this.findNextWeekday(current, task.recurrence_days);
        
      case 'custom':
        // Implementazione custom futura
        return null;
        
      default:
        return null;
    }
  }
}
```

---

## 🔗 Integrazione con Sistema Esistente

### Flusso Esecuzione Task → Voice Call

```
ai_scheduled_tasks                 voice_calls (esistente)
       │                                  │
       │ task.status = 'in_progress'      │
       │                                  │
       ▼                                  │
┌──────────────┐                          │
│ TaskScheduler│                          │
│ .executeTask │                          │
└──────┬───────┘                          │
       │                                  │
       │ POST /api/voice/outbound/initiate│
       │ body: {                          │
       │   phone,                         │
       │   contactName,                   │
       │   customInstruction,  ◀── ai_instruction
       │   sourceTaskId        ◀── per tracciamento
       │ }                                │
       │                                  │
       ▼                                  ▼
┌──────────────┐                   ┌──────────────┐
│ Outbound     │ ─────────────────▶│ voice_calls  │
│ Service      │   crea record     │ (fonte verità)│
└──────────────┘                   └──────────────┘
       │                                  │
       │ callId                           │
       ▼                                  │
┌──────────────┐                          │
│ TaskScheduler│                          │
│ .handleResult│                          │
└──────┬───────┘                          │
       │                                  │
       │ UPDATE ai_scheduled_tasks        │
       │ SET voice_call_id = callId       │
       │                                  │
       ▼                                  │
   COMPLETATO ◀───────────────────────────┘
```

---

## 📋 Componenti Frontend

### File Structure

```
client/src/
├── pages/
│   └── consultant-voice-calls.tsx  (modificare - aggiungere tab)
│
├── components/
│   └── voice/
│       ├── ai-task-queue/
│       │   ├── AITaskQueueTab.tsx       # Tab principale
│       │   ├── AITaskList.tsx           # Lista task
│       │   ├── AITaskCard.tsx           # Card singolo task
│       │   ├── AITaskFilters.tsx        # Filtri rapidi
│       │   ├── AITaskStatusBadge.tsx    # Badge stati
│       │   └── AITaskTypeIcon.tsx       # Icone tipo
│       │
│       ├── create-task-drawer/
│       │   ├── CreateTaskDrawer.tsx     # Drawer principale
│       │   ├── ContactSection.tsx       # Sezione contatto
│       │   ├── TaskTypeSelector.tsx     # Selezione tipo
│       │   ├── AIInstructionInput.tsx   # Textarea istruzione
│       │   ├── ScheduleSection.tsx      # Data/ora/frequenza
│       │   └── AdvancedOptions.tsx      # Opzioni collapsabili
│       │
│       └── mobile/
│           ├── AITaskMobileList.tsx     # Lista mobile
│           └── CreateTaskBottomSheet.tsx # Bottom sheet
```

### Componenti Chiave

```typescript
// AITaskQueueTab.tsx
interface AITaskQueueTabProps {
  consultantId: string;
}

export function AITaskQueueTab({ consultantId }: AITaskQueueTabProps) {
  const [tasks, setTasks] = useState<AITask[]>([]);
  const [filter, setFilter] = useState<string>('all');
  const [isDrawerOpen, setDrawerOpen] = useState(false);
  
  // Query con react-query
  const { data, isLoading } = useQuery({
    queryKey: ['ai-tasks', consultantId, filter],
    queryFn: () => fetchAITasks({ consultantId, status: filter }),
    refetchInterval: 30_000 // Refresh ogni 30s
  });
  
  return (
    <div className="space-y-4">
      <AITaskFilters value={filter} onChange={setFilter} />
      <AITaskList tasks={data?.tasks || []} isLoading={isLoading} />
      <CreateTaskDrawer open={isDrawerOpen} onOpenChange={setDrawerOpen} />
    </div>
  );
}
```

---

## ✅ Checklist Implementazione MVP

### Database
- [ ] Creare tabella `ai_scheduled_tasks` con SQL diretto
- [ ] Verificare indici per performance

### Backend
- [ ] Endpoint CRUD `/api/voice/ai-tasks`
- [ ] TaskSchedulerService con cron 1 min
- [ ] Lock mutex anti-duplicazione
- [ ] Integrazione con outbound call esistente

### Frontend
- [ ] Tab "AI Task Queue" nel Centro Chiamate
- [ ] Drawer laterale creazione task
- [ ] Lista task con filtri e azioni
- [ ] Badge stati colorati
- [ ] Toast feedback

### Mobile
- [ ] Bottom sheet creazione
- [ ] Lista verticale responsive
- [ ] FAB bottone "+"

### Testing
- [ ] Test creazione task
- [ ] Test esecuzione schedulata
- [ ] Test retry automatico
- [ ] Test ricorrenza

---

## 🚀 Fase 2 (Post-MVP)

- Preview AI con simulazione Gemini
- Statistiche e analytics
- Export dati
- Webhook notifiche completamento
- Integrazione calendario Google
- Filtri avanzati per data range
