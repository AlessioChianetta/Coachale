# RDP: Next Evaluation Time
## Requirement Design Process

**Data:** 19 Gennaio 2026  
**Versione:** 1.0  
**Priorità:** Alta (ottimizzazione costi AI + UX)

---

## 1. PROBLEMA

Il CRON di valutazione follow-up gira **ogni 5 minuti, 24/7**.
Di notte, l'AI valuta lo stesso lead 60+ volte e ogni volta dice:
> "È sera/notte, meglio attendere domani mattina"

**Conseguenze:**
- Spreco token AI (costo $$)
- Log pieni di valutazioni ridondanti
- Timeline utente inquinata

---

## 2. SOLUZIONE

Quando l'AI decide "ATTENDI", specifica anche **QUANDO rivalutare**.
Il sistema salva questo timestamp e **non rivaluta** fino a quel momento.

**Esempio:**
```
AI Decision: skip
Reasoning: "È sabato sera, il lead risponderà lunedì"
nextEvaluationAt: "2026-01-20T09:00:00+01:00"
```

Il CRON vede `nextEvaluationAt > now` → SKIP (zero chiamate AI)

---

## 3. ANALISI FILE ESISTENTI

### 3.1 Schema Database (`shared/schema.ts`)

**Tabella esistente:** `conversationStates` (linea 6282)
**Campi rilevanti esistenti:**
- `lastAiEvaluationAt: timestamp` ✓
- `aiRecommendation: text` ✓

**Modifica:** Aggiungere `nextEvaluationAt: timestamp` (nullable)

### 3.2 AI Decision Engine (`server/ai/followup-decision-engine.ts`)

**Interface esistente:** `FollowupDecision` (linee 75-97)
**Prompt JSON format:** (linee 471-488)

**Modifiche:**
1. Aggiungere `nextEvaluationAt?: string` all'interface
2. Aggiungere campo al formato JSON nel prompt
3. Aggiungere istruzioni per quando usarlo

### 3.3 Scheduler (`server/cron/followup-scheduler.ts`)

**Logica esistente cooldown:** (linee 1218-1224)
```typescript
if (minutesSinceLastEval < 5) {
  console.log(`SKIPPED - AI evaluated X min ago (cooldown: 5 min)`);
  continue;
}
```

**Modifiche:**
1. Aggiungere check `nextEvaluationAt` PRIMA del cooldown
2. Log con countdown human-readable
3. Salvare `nextEvaluationAt` dopo decisione AI
4. Resettare su nuovo messaggio inbound

---

## 4. MODIFICHE DETTAGLIATE

### 4.1 DATABASE (SQL diretto)

```sql
ALTER TABLE conversation_states 
ADD COLUMN next_evaluation_at TIMESTAMPTZ DEFAULT NULL;
```

Poi aggiornare `schema.ts` per riflettere il campo.

### 4.2 BACKEND - Interface FollowupDecision

```typescript
// Aggiungere a FollowupDecision (linea ~97)
nextEvaluationAt?: string; // ISO 8601 timestamp
```

### 4.3 BACKEND - Prompt AI

Aggiungere al formato JSON risposta:
```
"nextEvaluationAt": "ISO 8601 timestamp - OBBLIGATORIO se decision è skip/silence/nurturing"
```

Aggiungere istruzioni:
```
## NEXT EVALUATION TIME

Quando decidi skip, silence, o nurturing, DEVI specificare nextEvaluationAt:
- Usa formato ISO 8601 con timezone (es: "2026-01-20T09:00:00+01:00")
- Suggerisci solo orari lavorativi: 07:00-22:00
- Rispetta il giorno: se è venerdì sera → lunedì mattina
- Range validi: minimo 30 minuti, massimo 72 ore

ESEMPI:
- "È sera (22:00)" → nextEvaluationAt: domani 09:00
- "Sabato pomeriggio" → nextEvaluationAt: lunedì 09:00  
- "Ha bisogno di tempo" → nextEvaluationAt: tra 24 ore
```

### 4.4 BACKEND - Scheduler Skip Logic

```typescript
// PRIMA di valutare la conversazione
if (state.nextEvaluationAt) {
  const nextEval = new Date(state.nextEvaluationAt);
  if (now < nextEval) {
    const hoursRemaining = (nextEval.getTime() - now.getTime()) / (1000 * 60 * 60);
    console.log(`⏭️ [CANDIDATE] ${state.conversationId}: SKIPPED - nextEvaluationAt in ${hoursRemaining.toFixed(1)}h (${nextEval.toLocaleString('it-IT')})`);
    continue;
  }
}
```

### 4.5 BACKEND - Salvataggio dopo Decisione

```typescript
// Dopo che AI risponde con skip/silence/nurturing
if (decision.nextEvaluationAt) {
  // Clamping server-side
  let nextEval = new Date(decision.nextEvaluationAt);
  const minEval = new Date(now.getTime() + 30 * 60 * 1000); // +30 min
  const maxEval = new Date(now.getTime() + 72 * 60 * 60 * 1000); // +72h
  
  if (nextEval < minEval) nextEval = minEval;
  if (nextEval > maxEval) nextEval = maxEval;
  
  // Clamp to business hours (08:00-21:00)
  nextEval = clampToBusinessHours(nextEval);
  
  await updateConversationState(conversationId, {
    nextEvaluationAt: nextEval
  });
}
```

### 4.6 BACKEND - Reset su Nuovo Messaggio

In `message-processor.ts`, quando arriva messaggio inbound:
```typescript
// Reset nextEvaluationAt per permettere valutazione immediata
await db.update(conversationStates)
  .set({ nextEvaluationAt: null })
  .where(eq(conversationStates.conversationId, conversationId));
```

---

## 5. EDGE CASES

| Scenario | Comportamento |
|----------|---------------|
| Lead risponde prima di nextEvaluationAt | Reset → valutazione al prossimo CRON |
| Consulente invia manualmente | Reset → valutazione al prossimo CRON |
| AI suggerisce oltre 72h | Clamping a 72h max |
| AI suggerisce meno di 30min | Clamping a 30min min |
| AI suggerisce ora notturna (22-08) | Spostato a 08:00 giorno dopo |
| nextEvaluationAt nel passato | Ignorato, valutazione normale |
| Campo mancante/null | Valutazione normale (compatibilità) |

---

## 6. FRONTEND (Opzionale - Fase 2)

Nella timeline conversazione o card:
- Badge: "⏸️ Prossima valutazione: domani 09:00"
- Se > 24h: warning + bottone "Rivaluta ora"
- Timeline event: "Valutazione AI rimandata"

---

## 7. ROLLBACK PLAN

Se qualcosa va storto:
1. Il campo `nextEvaluationAt` è nullable → sistema funziona senza
2. La logica di skip è un `if` aggiuntivo → commentabile
3. Il prompt AI ha istruzioni aggiuntive → rimuovibili

**Nessun breaking change** - tutto è retrocompatibile.

---

## 8. FILE DA MODIFICARE

| File | Tipo Modifica |
|------|---------------|
| `shared/schema.ts` | +1 campo |
| `server/ai/followup-decision-engine.ts` | +interface field, +prompt section |
| `server/cron/followup-scheduler.ts` | +skip logic, +save logic |
| `server/whatsapp/message-processor.ts` | +reset on inbound |
| (Opzionale) `consultant-automations.tsx` | +badge UI |

---

## 9. TEST PLAN

1. **Unit:** Clamping function (business hours, min/max)
2. **Integration:** AI risponde con nextEvaluationAt valido
3. **E2E:** Scheduler skippa conversazioni con futuro nextEvaluationAt
4. **E2E:** Reset funziona su nuovo messaggio inbound
5. **Logs:** Verificare countdown human-readable

---

## 10. METRICHE SUCCESSO

- **Prima:** 60+ valutazioni/notte per lead silenzioso
- **Dopo:** 0 valutazioni/notte se AI dice "aspetta domani"
- **Risparmio:** ~95% token AI per lead in attesa
