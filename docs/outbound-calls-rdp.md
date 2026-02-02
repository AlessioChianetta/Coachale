# Sistema Chiamate in Uscita (Outbound Calls)

## Stato Attuale: 🔄 In Sviluppo

### Obiettivo
Permettere all'AI di chiamare numeri telefonici programmati, sia immediatamente che a orari specifici.

---

## Architettura

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Frontend      │────▶│   Backend       │────▶│   VPS Bridge    │
│   (React)       │     │   (Express)     │     │   (Node.js)     │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                               │                        │
                               ▼                        ▼
                        ┌─────────────────┐     ┌─────────────────┐
                        │   PostgreSQL    │     │   FreeSWITCH    │
                        │   (scheduled_   │     │   (originate)   │
                        │   voice_calls)  │     └─────────────────┘
                        └─────────────────┘
```

### Flusso Chiamata Immediata
1. Frontend → POST /api/voice/outbound/trigger (numero, ai_mode)
2. Backend → Crea record in scheduled_voice_calls con status='calling'
3. Backend → Chiama VPS endpoint POST /outbound/call
4. VPS → FreeSWITCH originate (chiama il numero)
5. Utente risponde → FreeSWITCH connette audio al bridge
6. Bridge → WebSocket a Replit (come chiamata entrante)
7. AI parla con l'utente

### Flusso Chiamata Programmata
1. Frontend → POST /api/voice/outbound/schedule (numero, scheduled_at, ai_mode)
2. Backend → Crea record con status='pending'
3. Backend → setTimeout per scheduled_at
4. Al timeout → Esegue flusso chiamata immediata
5. Al restart server → Ricarica chiamate pendenti e reimposta timer

---

## Database Schema

### Tabella: `scheduled_voice_calls`

| Campo | Tipo | Descrizione |
|-------|------|-------------|
| id | varchar | UUID primario |
| consultant_id | int | FK a users |
| target_phone | varchar | Numero da chiamare (+39...) |
| scheduled_at | timestamp | Quando chiamare (null = immediata) |
| status | varchar | pending, calling, ringing, talking, completed, failed, cancelled |
| ai_mode | varchar | assistenza, vendita, custom |
| custom_prompt | text | Prompt personalizzato (opzionale) |
| voice_call_id | varchar | FK a voice_calls quando inizia |
| attempts | int | Tentativi effettuati |
| max_attempts | int | Max tentativi (default 3) |
| last_attempt_at | timestamp | Ultimo tentativo |
| error_message | text | Errore se fallita |
| priority | int | Priorità (1-10, default 5) |
| created_at | timestamp | Creazione |
| updated_at | timestamp | Ultimo aggiornamento |

**Indici:**
- `idx_scheduled_calls_pending` su (status, scheduled_at) WHERE status='pending'
- `idx_scheduled_calls_consultant` su (consultant_id)

---

## API Endpoints

### POST /api/voice/outbound/trigger
Chiamata immediata.
```json
Request:
{
  "targetPhone": "+393331234567",
  "aiMode": "assistenza",
  "customPrompt": null
}

Response:
{
  "success": true,
  "callId": "sc_xxx",
  "message": "Chiamata in corso..."
}
```

### POST /api/voice/outbound/schedule
Programma chiamata futura.
```json
Request:
{
  "targetPhone": "+393331234567",
  "scheduledAt": "2026-02-03T15:00:00Z",
  "aiMode": "assistenza",
  "customPrompt": null
}

Response:
{
  "success": true,
  "callId": "sc_xxx",
  "scheduledAt": "2026-02-03T15:00:00Z"
}
```

### GET /api/voice/outbound/scheduled
Lista chiamate programmate.
```json
Response:
{
  "calls": [
    {
      "id": "sc_xxx",
      "targetPhone": "+393331234567",
      "scheduledAt": "2026-02-03T15:00:00Z",
      "status": "pending",
      "aiMode": "assistenza"
    }
  ]
}
```

### DELETE /api/voice/outbound/:id
Cancella chiamata programmata.

---

## VPS Endpoint (da implementare su VPS)

### POST /outbound/call
```json
Request:
{
  "targetPhone": "+393331234567",
  "callbackUrl": "wss://replit-app.com/voice-ws",
  "callId": "sc_xxx",
  "token": "JWT_SERVICE_TOKEN"
}
```

Azioni VPS:
1. Valida token
2. FreeSWITCH: `originate sofia/gateway/trunk/+393331234567 &bridge(user/ai-bridge)`
3. Quando risponde, connette WebSocket con callId

---

## Frontend UI

### Tab "Chiamate in Uscita"
- **Sezione Test**: Input numero + bottone "Chiama Adesso"
- **Sezione Programma**: Form con numero, data/ora, prompt
- **Lista Programmate**: Tabella con stato, azioni (cancella, modifica)

---

## Progresso Implementazione

### ✅ Completato
- [ ] Task 1: Tabella database

### 🔄 In Corso
- [ ] Task 2: Endpoint trigger

### ⏳ Da Fare
- [ ] Task 3: Restart timer
- [ ] Task 4: Frontend tab
- [ ] Task 5: VPS endpoint docs
- [ ] Task 6: Test E2E
- [ ] Task 7: CRUD schedule
- [ ] Task 8: Form programmazione
- [ ] Task 9: Lista programmate
- [ ] Task 10: Review finale

---

## Note Tecniche

### Scalabilità
- Timer in memoria con Map<callId, timeoutId>
- Al restart: query pending calls → reimposta timer
- Rate limiting: max 10 chiamate simultanee per consultant

### Sicurezza
- JWT service token per comunicazione VPS
- Validazione numero telefono (+39, formato E.164)
- Solo consultant può chiamare propri clienti/numeri

### Retry Logic
- Max 3 tentativi
- Backoff: 1 min, 5 min, 15 min
- Stati: failed dopo max_attempts

---

*Ultimo aggiornamento: 02/02/2026*
