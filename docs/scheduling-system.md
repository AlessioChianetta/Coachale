# Sistema di Programmazione Intelligente Task AI

**Data creazione:** 15 Febbraio 2026
**Stato:** In implementazione

---

## 1. Panoramica

Il sistema di programmazione intelligente permette ai dipendenti AI autonomi di suggerire **quando** eseguire le loro azioni (chiamate, WhatsApp, email), dando al consulente la possibilità di confermare o modificare l'orario prima dell'esecuzione.

### Problemi risolti
- **Prima:** `scheduled_at` era sempre `NOW()`, quindi appena approvato il task partiva al ciclo successivo (entro 1 minuto)
- **Dopo:** L'AI suggerisce un orario intelligente basato su calendario, urgenza e orari lavorativi. Il consulente può confermare o cambiare l'orario.

---

## 2. Flusso Completo

### 2.1 Generazione Task (Cron ogni 30 min)

```
Cron (XX:00, XX:30)
    │
    ▼
Per ogni consulente (autonomy >= 2, is_active, dentro orario lavorativo)
    │
    ▼
Per ogni ruolo attivo (8 ruoli)
    │
    ▼
AI genera JSON con scheduled_for + scheduling_reason
    │
    ▼
INSERT ai_scheduled_tasks
  scheduled_at = scheduled_for dall'AI (non più NOW())
  scheduling_reason = motivazione orario
  scheduled_by = 'ai'
  original_scheduled_at = stesso valore (per tracking)
  status = waiting_approval (livello < 4) | scheduled (livello >= 4)
```

### 2.2 Approvazione (Frontend)

```
Card task mostra:
  "📞 Ti chiamerà — previsto oggi 15:30"
  "💬 WhatsApp a Gloria — previsto domani 10:00"
    │
    ▼
Consulente approva:
  [Approva per 15:30]  →  scheduled_at resta, status → 'approved'
       oppure
  [Cambia orario ▼]   →  DateTimePicker → aggiorna scheduled_at
                          scheduled_by = 'consultant'
```

### 2.3 Esecuzione (Cron ogni 1 min)

```
processAITasks() — nessun cambio necessario!
  SELECT WHERE status='scheduled' AND scheduled_at <= NOW()
    │
    ▼
Flusso esistente: status approved → scheduled (quando ora arriva) → in_progress → completed/failed
```

---

## 3. Modifiche al Database

### 3.1 Nuove colonne su `ai_scheduled_tasks`

```sql
ALTER TABLE ai_scheduled_tasks
  ADD COLUMN IF NOT EXISTS scheduling_reason TEXT,
  ADD COLUMN IF NOT EXISTS scheduled_by VARCHAR DEFAULT 'ai',
  ADD COLUMN IF NOT EXISTS original_scheduled_at TIMESTAMPTZ;
```

**Colonne esistenti riutilizzate:**
- `scheduled_at` — Ora diventa l'orario effettivo di esecuzione (prima era sempre NOW())
- `scheduled_datetime` — Usata per task manuali con urgency='programmata', rimane invariata
- `preferred_channel` — Già presente, usata per filtrare nel calendario WhatsApp

**Nuove colonne:**
| Colonna | Tipo | Default | Descrizione |
|---------|------|---------|-------------|
| `scheduling_reason` | TEXT | NULL | Perché l'AI ha scelto quell'orario |
| `scheduled_by` | VARCHAR | 'ai' | Chi ha scelto l'orario: 'ai', 'consultant', 'system' |
| `original_scheduled_at` | TIMESTAMPTZ | NULL | Orario originale suggerito dall'AI (prima di modifica utente) |

---

## 4. Modifiche ai Prompt AI (8 ruoli)

### 4.1 Nuovo JSON output per tutti i ruoli

Aggiunto al template JSON di ogni ruolo:
```json
{
  "scheduled_for": "2026-02-15T15:30",
  "scheduling_reason": "Dopo la consulenza delle 14:00 con altro cliente"
}
```

### 4.2 Istruzioni per suggerire l'orario

Aggiunte alla sezione regole di ogni ruolo:
- Guardare le consulenze in programma ed evitare sovrapposizioni
- Per urgenza "oggi" → slot entro la giornata
- Per urgenza "settimana" → slot nei prossimi 3-5 giorni
- Rispettare l'orario lavorativo del consulente
- **Marco specifico:** controllare l'agenda del consulente per evitare di chiamarlo durante consulenze

### 4.3 Logica di fallback

Se l'AI non fornisce `scheduled_for`:
- urgency = "immediata" → NOW() + 5 min
- urgency = "oggi" → prossima ora piena disponibile
- urgency = "settimana" → domani mattina ore 09:30
- urgency = "normale" → NOW() + 30 min (comportamento legacy)

---

## 5. Modifiche Backend

### 5.1 ai-task-scheduler.ts — Generazione

File: `server/cron/ai-task-scheduler.ts`

**Cambio nel parsing JSON AI (riga ~1810):**
```typescript
// Prima:
// scheduled_at = NOW()

// Dopo:
const scheduledFor = suggestedTask.scheduled_for
  ? new Date(suggestedTask.scheduled_for)
  : computeFallbackSchedule(suggestedTask.urgency);

// INSERT con:
// scheduled_at = scheduledFor
// scheduling_reason = suggestedTask.scheduling_reason
// scheduled_by = 'ai'
// original_scheduled_at = scheduledFor
```

### 5.2 ai-task-scheduler.ts — Esecuzione

**NESSUN CAMBIO NECESSARIO** — il cron già controlla `scheduled_at <= NOW()`.

Unico cambio: il flusso `approved → scheduled` deve rispettare l'orario:
```sql
UPDATE ai_scheduled_tasks
SET status = 'scheduled', updated_at = NOW()
WHERE status = 'approved' AND scheduled_at <= NOW()
```
Questo GIÀ ESISTE (riga 72-76). Funziona automaticamente.

### 5.3 API Endpoints

**PATCH /api/ai-autonomy/tasks/:id/approve** — Aggiornato per accettare `scheduled_at` opzionale:
```typescript
// Body: { scheduled_at?: string }
// Se fornito, aggiorna scheduled_at e imposta scheduled_by = 'consultant'
// Se non fornito, mantiene l'orario suggerito dall'AI
```

**GET /api/ai-autonomy/tasks** — Ritorna anche `scheduling_reason`, `scheduled_by`, `original_scheduled_at`

---

## 6. Modifiche Frontend

### 6.1 DashboardTab — Card task

**Sezione azioni previste** — Mostra orario:
```
Azioni previste:
📞 Ti chiamerà  a te  •  ⏰ Previsto oggi 15:30
💬 WhatsApp a te  •  ⏰ Previsto domani 10:00
```

Con tooltip sulla `scheduling_reason` dell'AI.

### 6.2 DashboardTab — Approvazione

**Pulsante Approva** diventa dropdown/modale:
```
[✅ Approva per 15:30]  [🕐 Cambia orario]
```

"Cambia orario" apre un DateTimePicker inline.

### 6.3 AITask Type

```typescript
// Aggiunte a types.ts
scheduling_reason?: string;
scheduled_by?: string;
original_scheduled_at?: string;
```

---

## 7. Calendario WhatsApp

### 7.1 Posizione

Nuovo tab nella pagina `/consultation/whatsapp`, sezione "I tuoi Dipendenti"

### 7.2 Fonte dati

```sql
SELECT * FROM ai_scheduled_tasks
WHERE preferred_channel = 'whatsapp'
  AND consultant_id = :consultantId
  AND scheduled_at BETWEEN :weekStart AND :weekEnd
ORDER BY scheduled_at ASC
```

### 7.3 Visualizzazione

Vista settimanale con slot orari, colori per agente:
- Echo → verde
- Millie → giallo
- Stella → viola
- Marco → indaco (contatta il consulente)
- Manuale → blu

### 7.4 Interazione

Click su slot vuoto → apre form per nuovo messaggio WhatsApp manuale

---

## 8. Outbound WhatsApp Personalizzato

### 8.1 Posizione

Nuova sezione nella pagina WhatsApp, accessibile da tab o pulsante

### 8.2 Form

| Campo | Tipo | Obbligatorio | Descrizione |
|-------|------|:---:|-------------|
| Numero WhatsApp | Input tel + rubrica | ✅ | Numero destinatario |
| Nome contatto | Input text | ❌ | Auto-compilato da rubrica |
| Obiettivo | Select | ✅ | Appuntamento, follow-up, upgrade, info, supporto, custom |
| Contesto persona | Textarea | ❌ | Chi è, cosa fa, note |
| Istruzioni aggiuntive | Textarea | ❌ | Cosa dire, come |
| Tono | Select | ❌ | Professionale, informale, empatico, persuasivo |
| Programma per | DateTimePicker | ❌ | Default: "Il prima possibile" |
| Agente | Select | ❌ | Quale dipendente WA esegue (default: auto) |

### 8.3 Backend

Crea task in `ai_scheduled_tasks`:
```
preferred_channel: 'whatsapp'
scheduled_at: orario scelto
ai_instruction: obiettivo + contesto + istruzioni compilate
origin_type: 'manual'
task_type: 'ai_task'
scheduled_by: 'consultant'
```

### 8.4 Anteprima AI

Pulsante "Anteprima messaggio" chiama Gemini per generare preview del messaggio che verrà inviato, senza inviarlo.

---

## 9. File coinvolti

| File | Modifica |
|------|----------|
| `server/cron/ai-autonomous-roles.ts` | Prompt 8 ruoli con scheduled_for |
| `server/cron/ai-task-scheduler.ts` | Parsing scheduled_for, fallback, INSERT |
| `server/routes/ai-autonomy-router.ts` | API approve con orario, query con nuovi campi |
| `server/ai/autonomous-decision-engine.ts` | Nessuna modifica |
| `server/ai/ai-task-executor.ts` | Nessuna modifica |
| `client/src/components/autonomy/DashboardTab.tsx` | Card con orario, approvazione con scelta |
| `client/src/components/autonomy/types.ts` | Nuovi campi AITask |
| `client/src/pages/consultant-whatsapp.tsx` | Tab Calendario + Outbound |

---

## 10. Note Marco

Marco è l'unico agente che contatta il **consulente**, non i clienti.
- Le azioni mostrano "Ti chiamerà", "WhatsApp a te", "Email a te"
- Il contact_name nel task è il **soggetto** (il cliente di cui si parla), non il destinatario
- Il telefono del cliente non viene mostrato in evidenza nelle card di Marco
- Marco usa i recapiti del consulente dalla configurazione `marcoContext.consultantPhone/Email/WhatsApp`
