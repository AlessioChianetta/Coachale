# Booking System Atomico - Modifiche Database e Codice

## Data: 30 Gennaio 2026

---

## Fase 1: Schema Database

### 1.1 Tabella `pending_bookings`

```sql
CREATE TABLE IF NOT EXISTS pending_bookings (
  token VARCHAR(32) PRIMARY KEY,
  client_id VARCHAR NOT NULL REFERENCES users(id),
  consultant_id VARCHAR NOT NULL REFERENCES users(id),
  start_at TIMESTAMPTZ NOT NULL,
  duration INTEGER NOT NULL DEFAULT 60,
  status VARCHAR(20) NOT NULL DEFAULT 'awaiting_confirm',
  conversation_id VARCHAR,
  public_conversation_id VARCHAR,
  notes TEXT,
  consultation_id VARCHAR REFERENCES consultations(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  confirmed_at TIMESTAMPTZ,
  
  CONSTRAINT pending_bookings_status_check 
    CHECK (status IN ('awaiting_confirm', 'confirmed', 'expired', 'cancelled'))
);
```

### 1.2 Indici

```sql
-- Indice per lookup hasPendingBooking (usato dal classifier)
CREATE INDEX idx_pending_bookings_conversation_status 
  ON pending_bookings(conversation_id, status);

-- Indice per public conversation lookup
CREATE INDEX idx_pending_bookings_public_conversation_status 
  ON pending_bookings(public_conversation_id, status);

-- Partial unique index: un solo hold per slot quando awaiting_confirm
CREATE UNIQUE INDEX idx_pending_bookings_slot_hold 
  ON pending_bookings(consultant_id, start_at) 
  WHERE status = 'awaiting_confirm';
```

### 1.3 Unique Constraint su `consultations` (hard safety)

```sql
-- Previene double booking a livello finale
CREATE UNIQUE INDEX idx_consultations_slot_unique 
  ON consultations(consultant_id, scheduled_at);
```

---

## Fase 2: Refactoring Tool Executor

### 2.1 File: `server/ai/consultation-tool-executor.ts`

**Modifiche:**
- Rimuovere `pendingBookings: Map<string, ...>` (in memoria)
- `proposeBooking`: INSERT su `pending_bookings` in transazione
- `confirmBooking`: UPDATE atomico + INSERT `consultations`
- Gestione `SLOT_TAKEN` con cleanup pending
- Idempotenza: se già confirmed, ritorna stessa consultation
- Fallback senza token: cerca per conversation_id

### 2.2 Timezone handling

- Parse `date` + `time` input come Europe/Rome
- Converti a UTC per storage
- Output: converti da UTC a Europe/Rome per display

---

## Fase 3: AI Service Integration

### 3.1 File: `server/booking/booking-service.ts`

**Nuova funzione:**
```typescript
export async function getPendingBookingState(
  conversationId: string | null,
  publicConversationId: string | null
): Promise<{ token: string; startAt: Date } | null>
```

### 3.2 File: `server/ai-service.ts`

**Modifiche:**
- Chiamare `getPendingBookingState` prima del classifier
- Popolare `hasPendingBooking` e `pendingBookingToken`
- Sticky tool mode: se pending esiste, `isConsultationQuery = true` sempre

### 3.3 File: `server/ai/consultation-intent-classifier.ts`

**Modifiche:**
- Aggiungere context nel prompt: `Context: hasPendingBooking=true`

---

## Fase 4: Cron Job

### 4.1 Expiry automatico

```sql
UPDATE pending_bookings 
SET status = 'expired' 
WHERE status = 'awaiting_confirm' AND expires_at < NOW();
```

Eseguire ogni 2 minuti.

---

## Esecuzione SQL

### Comandi eseguiti:

1. ✅ CREATE TABLE pending_bookings - COMPLETATO
2. ✅ CREATE INDEX idx_pending_bookings_conversation_status - COMPLETATO
3. ✅ CREATE INDEX idx_pending_bookings_public_conversation_status - COMPLETATO
4. ✅ CREATE UNIQUE INDEX idx_pending_bookings_slot_hold - COMPLETATO
5. ✅ CREATE UNIQUE INDEX idx_consultations_slot_unique - COMPLETATO
   - Nota: eliminati 2 duplicati esistenti su 2025-12-15 15:00:00 prima della creazione

---

## Note Implementazione

- Token generato con `crypto.randomBytes(16).toString('hex')` PRIMA dell'INSERT
- `start_at` sempre in UTC (TIMESTAMPTZ)
- `expires_at` = created_at + 10 minuti
- `confirmBooking` verifica anche `expires_at > NOW()` indipendentemente dal cron

---

## Modifiche Codice Completate

### File Modificati:

1. **shared/schema.ts**
   - Aggiunto schema Drizzle `pendingBookings`

2. **server/ai/consultation-tool-executor.ts**
   - Rimossa Map in memoria
   - `proposeBooking`: INSERT su DB con verifica slot
   - `confirmBooking`: UPDATE atomico + INSERT consultation + idempotenza

3. **server/booking/booking-service.ts**
   - Aggiunta funzione `getPendingBookingState()`

4. **server/ai-service.ts**
   - Import `getPendingBookingState`
   - Chiamata prima del classifier
   - Popolato `hasPendingBooking` e `pendingBookingToken`
   - Sticky tool mode quando pending booking esiste

5. **server/ai/consultation-intent-classifier.ts**
   - Aggiunto context `hasPendingBooking` nel prompt

6. **server/cron/pending-booking-expiry.ts** (NUOVO)
   - Cron job per expirare pending ogni 2 minuti

7. **server/index.ts**
   - Avvio del pending booking expiry scheduler

8. **server/booking/booking-flow-service.ts** (NUOVO)
   - Gestione stato flow: `awaiting_slot_selection`, `awaiting_confirm`
   - Funzioni: `setBookingFlowState()`, `getBookingFlowState()`, `clearBookingFlowState()`
   - TTL 15 minuti per auto-expiry

9. **shared/schema.ts** - aiConversations
   - Aggiunte colonne: `activeFlow`, `flowStage`, `flowExpiresAt`

---

## Bug Fix Implementati (2026-01-30)

### 1. conversationId mancante in pending_bookings
- **Problema**: `proposeBooking` non salvava `conversationId` → `getPendingBookingState()` tornava sempre null
- **Fix**: Passato `conversationId` a `executeConsultationTool()` e salvato nell'INSERT

### 2. Mancanza stato tra "slot mostrati" e "pending booking"
- **Problema**: Dopo `getAvailableSlots`, l'utente rispondeva "ok" ma il classifier usciva dal booking flow
- **Fix**: Aggiunto stato `awaiting_slot_selection` in `aiConversations` + `booking-flow-service.ts`

### 3. Regex troppo rigida
- **Problema**: `^ok$` non matchava "ok grazie", "sì va bene"
- **Fix**: Rimossi anchor, usato word boundaries `\b(ok|si|sì|...)\b`

### 4. Fallback tool pericoloso
- **Problema**: Se `filteredTools.length === 0`, esponeva tutti i tool
- **Fix**: Fallback solo a `getAvailableSlots` (tool read-only sicuro)

### 5. booking_confirm senza pending
- **Problema**: Se classifier rilevava `booking_confirm` ma non c'era pending, usciva dal flow
- **Fix**: Se `flowStage === 'awaiting_slot_selection'`, chiede slot invece di uscire

### 6. conversationId sbagliato passato a executeConsultationTool
- **Problema**: Veniva usato `conversationId` dalla request (undefined per nuove conversazioni) invece di `conversation.id`
- **Fix**: Cambiato a `conversation.id` che è l'ID reale della conversazione creata/trovata
- **Risultato**: Ora `setBookingFlowState` riceve l'ID corretto e lo stato `awaiting_slot_selection` viene salvato
