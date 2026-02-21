# RDP - Ristrutturazione Configurazione Voice Multi-Tenant

**Data**: 21/02/2026  
**Obiettivo**: Separare la configurazione Voice in due esperienze: semplice per consultant, tecnica per super_admin.

---

## 1. Contesto e Problema

### Stato Attuale
Il tab "Configurazione" nella pagina `/consultant/voice-calls` mostra a TUTTI gli utenti (inclusi i consultant) dettagli tecnici che non li riguardano:
- Token JWT (REPLIT_SERVICE_TOKEN)
- URL del VPS Bridge
- WS_AUTH_TOKEN
- Template .env per la VPS
- Configurazione FreeSWITCH dialplan
- Comandi SSH per la VPS

### Architettura Multi-Tenant Esistente
Il sistema è già multi-tenant a livello dati:
- Tabella `voice_numbers`: ogni numero ha un `consultant_id`
- Tabella `voice_calls`: ogni chiamata ha un `consultant_id`
- Le query nel `voice-router.ts` filtrano per `consultant_id`
- La tabella `voice_numbers` ha configurazione per-numero: saluto, orari, modalità AI, fallback

### Modello Operativo Scelto
**VPS Centralizzata**: tutti i clienti passano dalla stessa VPS FreeSWITCH gestita dal super_admin. Il consultant NON deve sapere nulla di VPS, FreeSWITCH, token, ESL.

---

## 2. Architettura del Flusso

### Flusso Chiamata In Entrata
```
Chiamante → SIP Trunk → FreeSWITCH → ESL (CHANNEL_PARK)
  → uuid_audio_stream → WebSocket → VPS Bridge Server
  → fetchCallerContext (API Replit) → trova consultant_id dal numero chiamato
  → ReplitWSClient → WebSocket Replit → Gemini AI (con prompt del consultant)
  → Audio risposta → FreeSWITCH → Chiamante
```

### Flusso Chiamata In Uscita
```
Consultant (UI) → API Replit /api/voice/outbound
  → API VPS /outbound/call (con service token)
  → FreeSWITCH originate → SIP Trunk → Destinatario
  → Audio stream → stesso flusso bidirezionale di sopra
```

### Flusso Configurazione
```
Super Admin:
  1. Configura VPS (token, URL bridge, .env, FreeSWITCH)
  2. Assegna numeri DID ai consultant

Consultant:
  1. Vede il suo numero assegnato
  2. Personalizza: saluto, orari, modalità AI, retry
  3. Testa la connessione con un click
```

---

## 3. Componenti del VPS Voice Bridge

### File nella cartella `vps-voice-bridge/src/`:

| File | Funzione |
|------|----------|
| `config.ts` | Carica variabili d'ambiente (.env) per il bridge |
| `voice-bridge-server.ts` | Server WebSocket principale, gestisce connessioni FreeSWITCH |
| `esl-client.ts` | Connessione ESL a FreeSWITCH, intercetta CHANNEL_PARK/HANGUP |
| `replit-ws-client.ts` | Client WebSocket verso Replit per AI (Gemini) |
| `session-manager.ts` | Gestione sessioni chiamata con timeout e stats |
| `caller-context.ts` | Fetch contesto chiamante da API Replit |
| `outbound-handler.ts` | Handler per chiamate in uscita via ESL |
| `audio-converter.ts` | Conversione audio PCM/L16 bidirezionale |
| `background-mixer.ts` | Mix audio di sottofondo durante le chiamate |
| `logger.ts` | Logger strutturato |
| `index.ts` | Entry point |

### Variabili .env del VPS Bridge:
```
WS_HOST=0.0.0.0           # Host del bridge WebSocket
WS_PORT=9090               # Porta del bridge
WS_AUTH_TOKEN=xxx          # Token per autenticare FreeSWITCH

REPLIT_WS_URL=https://...  # URL WebSocket di Replit
REPLIT_API_URL=https://... # URL API di Replit
REPLIT_API_TOKEN=xxx       # Token JWT per autenticare con Replit
REPLIT_SERVICE_TOKEN=xxx   # Token servizio per chiamate outbound

ESL_HOST=127.0.0.1         # FreeSWITCH ESL
ESL_PORT=8021
ESL_PASSWORD=xxx

SIP_GATEWAY=voip_trunk     # Gateway SIP per chiamate uscita
SIP_CALLER_ID=+39xxx       # Caller ID default
```

---

## 4. Modifiche al Codice

### 4.1 Tab "Configurazione" per Consultant (ruolo != super_admin)

**SOSTITUIRE** tutto il contenuto attuale del `<TabsContent value="vps">` con:

#### Card 1: "Il Tuo Numero"
- Mostra il numero assegnato (read-only)
- Badge stato attivo/inattivo
- Link a "Impostazioni Numeri" per modifiche

#### Card 2: "Personalizza il Servizio"
- Messaggio di benvenuto (textarea)
- Orari di attività (select giorno + orario)
- Modalità AI (select: assistenza, prenotazione, informazioni, trasferimento)
- Azione fuori orario (select)

#### Card 3: "Impostazioni Chiamate"
- Max tentativi retry (1-5)
- Intervallo retry (1-30 min)
- Info backoff esponenziale
- Bottone salva

#### Card 4: "Stato Connessione"
- Indicatore verde/rosso dello stato sistema
- Bottone "Testa Connessione" che fa un health check
- Mostra ultima verifica

### 4.2 Tab "Configurazione" per Super Admin (ruolo === super_admin)

Mostra TUTTO quello del consultant PIU':

#### Card 5: "Gestione VPS (Solo Admin)"
- Tutto il contenuto tecnico attuale:
  - Token di servizio (genera/rigenera/salva)
  - URL VPS Bridge
  - WS_AUTH_TOKEN
  - Template .env completo
  - Configurazione FreeSWITCH dialplan
  - Comandi VPS

---

## 5. Cosa NON cambia

- **voice-router.ts**: nessuna modifica
- **voice-call-manager.ts**: nessuna modifica
- **vps-voice-bridge/**: nessuna modifica
- **voice-settings page**: nessuna modifica
- **Schema DB**: nessuna modifica
- **Logica backend**: nessuna modifica

Le modifiche sono SOLO nel frontend del tab Configurazione.

---

## 6. Rischi e Mitigazioni

| Rischio | Mitigazione |
|---------|-------------|
| Rompere la UI esistente | Solo modifica del contenuto dentro `<TabsContent value="vps">`, nessun altro tab toccato |
| Perdere funzionalità admin | Tutto il codice tecnico resta, wrappato in `currentRole === 'super_admin'` |
| State/hooks non funzionanti | Tutti gli useState e mutation esistenti restano inalterati |

---

## 7. Test di Verifica

1. Login come consultant: il tab Configurazione mostra solo la versione semplice
2. Login come super_admin: il tab Configurazione mostra tutto (semplice + tecnico)
3. Le impostazioni retry si salvano correttamente
4. Il bottone "Testa Connessione" funziona
5. Il link a "Impostazioni Numeri" funziona
6. Nessun errore nella console
