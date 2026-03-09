# LEAD MAGNET — ONBOARDING GRATUITO

## Documentazione Tecnica dell'Implementazione

**Versione 2.0 — Marzo 2026**

---

# OVERVIEW

Lead magnet pubblico che permette a chiunque di ricevere un'analisi gratuita del proprio business con AI. Il visitatore compila un form (nome, email, telefono — tutti obbligatori), viene automaticamente creato un account `client` con tier `lead_magnet`, auto-loggato via JWT, e rediretto a `/lead/chat` dove può chattare con Luca (consulente AI) e ricevere un report personalizzato.

**URL Form:** `/onboarding-gratuito`
**URL Dashboard Lead:** `/lead/chat`
**Accesso Form:** Pubblico, nessun login necessario.
**Accesso Dashboard:** Autenticato, solo utenti con `is_lead_magnet = true`.

---

# FLUSSO UTENTE

```
Visitatore arriva sulla landing page /onboarding-gratuito
        ↓
Compila il form: Nome, Email, Telefono (tutti obbligatori)
        ↓
Clic "Inizia la Tua Analisi Gratuita"
        ↓
Backend:
  1. Crea sessione delivery_agent_sessions (is_public=true)
  2. Inserisce lead in proactive_leads
  3. Crea account utente (client, is_lead_magnet=true) o riusa esistente
  4. Genera JWT per auto-login
  5. Invia email con credenziali per accessi futuri
        ↓
Frontend: salva JWT + user → redirect a /lead/chat
        ↓
/lead/chat — Chat con Luca (AI consulente) via endpoint pubblici
        ↓
Luca conduce la discovery in 8 fasi (~5 min):
  1. Chi Sei (tipo business, settore)
  2. I Tuoi Clienti (target, volume, ticket)
  3. Come Lavori Oggi (operatività, bottleneck)
  4. Comunicazione & Canali
  5. Vendita & Acquisizione
  6. Formazione
  7. Team e Struttura
  8. Obiettivi e Priorità
  + Fase 9: Dettagli attività (nome, sito, città)
        ↓
Discovery completa → Appare bottone "Genera il Tuo Report"
        ↓
AI genera report in 2 step:
  Step 1: Analisi critica della conversazione
  Step 2: Report JSON strutturato
  + Business Intelligence (scraping Google Maps + sito web)
        ↓
Report visualizzato nel tab "Report":
  - Lettera personale
  - Diagnosi (dove sei ora + gap analysis)
  - Soluzioni AI consigliate (4-7 pacchetti)
  - Roadmap con timeline
  - Quick Wins (azioni immediate)
        ↓
CTA finale: "Vuoi Implementare Queste Soluzioni? Prenota Consulenza Gratuita"
```

---

# ACCESSO RISTRETTO

Gli utenti con tier `lead_magnet` possono accedere SOLO a `/lead/chat`. Il blocco è implementato a livello globale tramite `AuthGuard`:

- `auth-guard.tsx`: se `user.tier === 'lead_magnet' && location !== '/lead/chat'` → redirect a `/lead/chat`
- `role-based-redirect.tsx`: se `user.tier === 'lead_magnet'` → redirect a `/lead/chat`
- `login.tsx`: dopo login, se `tier === 'lead_magnet'` → redirect a `/lead/chat`

Per accessi futuri, il lead usa le credenziali inviate via email → login standard → redirect automatico a `/lead/chat`.

---

# COSA SUCCEDE CON I DATI DEL LEAD

## 1. Proactive Leads (`/consultant/proactive-leads`)

Al momento della registrazione (form submit), il lead viene inserito nella tabella `proactive_leads`:

| Campo | Valore |
|-------|--------|
| `first_name` | Nome dal form |
| `last_name` | Cognome dal form |
| `phone_number` | Telefono (normalizzato con +39) |
| `email` | Email dal form |
| `source` | `lead_magnet` |
| `status` | `pending` |
| `lead_info.fonte` | "Lead Magnet — Onboarding Gratuito" |
| `lead_info.obiettivi` | "Analisi gratuita AI per il business" |
| `lead_info.lead_magnet_session_id` | ID della sessione di onboarding |

**Se il numero di telefono esiste già:** il profilo viene aggiornato (ON CONFLICT su `consultant_id + phone_number`), non duplicato.

## 2. Account Utente

Al form submit, viene creato un account utente `client` con:

| Campo | Valore |
|-------|--------|
| `username` | `lm_{emailPrefix}_{randomHex4}` |
| `email` | Email dal form |
| `password` | Hash bcrypt di password generata (12 char hex) |
| `role` | `client` |
| `consultant_id` | ID del consulente (o fallback) |
| `is_lead_magnet` | `true` |
| `is_active` | `true` |

**Email duplicata:**
- Se email esiste con `is_lead_magnet=true` → riusa account esistente, aggiorna sessione
- Se email esiste con `is_lead_magnet=false` → riusa account (non sovrascrive), collega sessione
- Se email non esiste → crea nuovo account + invia email con credenziali

## 3. Arricchimento Post-Report

Quando il report viene generato, il lead in `proactive_leads` viene aggiornato:

| Campo | Valore |
|-------|--------|
| `lead_category` | `tiepido` (ha completato l'analisi) |
| `lead_info.tipo_business` | Dal profilo estratto |
| `lead_info.settore` | Dal profilo estratto |
| `lead_info.pain_points` | Lista pain points identificati |
| `lead_info.pacchetti_consigliati` | Nomi dei pacchetti consigliati |
| `consultant_notes` | Riepilogo: business type + pacchetti consigliati |

## 4. Sessione Delivery Agent

La conversazione è salvata nella tabella `delivery_agent_sessions` con:

| Campo | Valore |
|-------|--------|
| `is_public` | `true` |
| `public_token` | UUID univoco per accesso alla sessione |
| `lead_name` | Nome del visitatore |
| `lead_email` | Email del visitatore |
| `lead_phone` | Telefono del visitatore |
| `lead_user_id` | ID dell'account utente creato |
| `consultant_id` | ID di Alessio (owner) |
| `mode` | `onboarding` |

---

# ARCHITETTURA TECNICA

## Database — Colonne

### `delivery_agent_sessions` (colonne aggiunte)

```sql
ALTER TABLE delivery_agent_sessions ADD COLUMN IF NOT EXISTS public_token VARCHAR UNIQUE;
ALTER TABLE delivery_agent_sessions ADD COLUMN IF NOT EXISTS lead_name VARCHAR;
ALTER TABLE delivery_agent_sessions ADD COLUMN IF NOT EXISTS lead_email VARCHAR;
ALTER TABLE delivery_agent_sessions ADD COLUMN IF NOT EXISTS lead_phone VARCHAR;
ALTER TABLE delivery_agent_sessions ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT false;
ALTER TABLE delivery_agent_sessions ADD COLUMN IF NOT EXISTS lead_user_id VARCHAR;
```

### `users` (colonna aggiunta)

```sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_lead_magnet BOOLEAN DEFAULT false;
```

## Backend — API Endpoints

### Pubblici (no auth)

File: `server/routes/public/lead-magnet.ts`

| Endpoint | Metodo | Descrizione |
|----------|--------|-------------|
| `/api/public/lead-magnet/start` | POST | Registra il lead, crea sessione, crea account, genera JWT. Ritorna `{ token, sessionId, authToken, user }`. |
| `/api/public/lead-magnet/:token/session` | GET | Ritorna sessione + messaggi + report (se generato). |
| `/api/public/lead-magnet/:token/chat` | POST | Chat SSE streaming con Luca. Accetta `{ message }`. |
| `/api/public/lead-magnet/:token/generate-report` | POST | Genera report personalizzato con business intelligence. |

### Autenticati (JWT required)

File: `server/routes/lead/session.ts`

| Endpoint | Metodo | Descrizione |
|----------|--------|-------------|
| `/api/lead/my-session` | GET | Ritorna `{ publicToken, sessionId, status, mode }` per l'utente lead_magnet autenticato. |

## getUserTier — Tier `lead_magnet`

In `server/routes.ts`, la funzione `getUserTier(email)` controlla come PRIMO check:
- `SELECT is_lead_magnet FROM users WHERE LOWER(email) = $email`
- Se `is_lead_magnet === true` → ritorna `{ tier: 'lead_magnet' }`

Nel login, se `tierType === 'lead_magnet'`, il JWT include `consultantId` senza richiedere `subscriptionId`.

## System Prompt Pubblico

File: `server/prompts/delivery-agent-prompt.ts` — funzione `getPublicOnboardingPrompt(leadName)`

Differenze rispetto al prompt interno:
- NON menziona "la piattaforma", "i moduli", "setup", "API Key"
- Parla di RISULTATI: "automatizzare le risposte", "non perdere più lead"
- Focus su capire il business e i problemi, non vendere
- Il report fa il collegamento tra problemi e soluzioni
- Stesse 8 fasi di discovery del prompt interno

## Frontend

### Pagina Pubblica — `/onboarding-gratuito`

File: `client/src/pages/public-lead-magnet.tsx`

Dopo form submit:
1. Riceve `{ token, sessionId, authToken, user }` dal backend
2. Salva `authToken` in localStorage via `setToken()`
3. Salva `user` in localStorage via `setAuthUser()`
4. Redirect a `/lead/chat`

### Pagina Lead — `/lead/chat`

File: `client/src/pages/lead-chat.tsx`

- Al mount: chiama `GET /api/lead/my-session` (autenticato)
- Renderizza header con logo SO + nome utente + logout
- PhaseIndicator con lo status della sessione
- Tab bar: Chat / Report
- `DeliveryChat` con prop `publicToken` (usa endpoint pubblici)
- `DeliveryReport` con prop `publicToken` (usa endpoint pubblici, nasconde download PDF)

### Componenti Adattati

**`DeliveryChat.tsx`** — prop `publicToken?: string`
- Quando `publicToken` presente:
  - Load messages: `GET /api/public/lead-magnet/:token/session`
  - Chat: `POST /api/public/lead-magnet/:token/chat`
  - Report gen: `POST /api/public/lead-magnet/:token/generate-report`
  - No auth headers

**`DeliveryReport.tsx`** — prop `publicToken?: string`
- Quando `publicToken` presente:
  - Fetch report: `GET /api/public/lead-magnet/:token/session`
  - Nasconde bottoni "Scarica PDF" e "Condividi"

---

# FILE MODIFICATI/CREATI

| File | Azione |
|------|--------|
| `server/routes/public/lead-magnet.ts` | **MODIFICATO** — Auto-creazione account, JWT, email credenziali, SQL migrations |
| `server/routes/lead/session.ts` | **CREATO** — Endpoint `GET /api/lead/my-session` |
| `server/routes.ts` | **MODIFICATO** — Import + registrazione lead session router, getUserTier con lead_magnet, JWT lead_magnet |
| `server/routes/delivery-agent.ts` | **MODIFICATO** — Schema `ensureTables()` con nuove colonne |
| `server/prompts/delivery-agent-prompt.ts` | **MODIFICATO** — `getPublicOnboardingPrompt()` |
| `client/src/pages/public-lead-magnet.tsx` | **MODIFICATO** — Auto-login + redirect a /lead/chat dopo form submit |
| `client/src/pages/lead-chat.tsx` | **CREATO** — Pagina dashboard lead con DeliveryChat + DeliveryReport |
| `client/src/components/delivery-agent/DeliveryChat.tsx` | **MODIFICATO** — Prop `publicToken`, endpoint switching |
| `client/src/components/delivery-agent/DeliveryReport.tsx` | **MODIFICATO** — Prop `publicToken`, nasconde download/condividi |
| `client/src/components/auth-guard.tsx` | **MODIFICATO** — Blocco globale lead_magnet → /lead/chat |
| `client/src/components/role-based-redirect.tsx` | **MODIFICATO** — Redirect lead_magnet → /lead/chat |
| `client/src/pages/login.tsx` | **MODIFICATO** — Redirect lead_magnet dopo login |
| `client/src/lib/auth.ts` | **MODIFICATO** — Tipo tier include `lead_magnet` |
| `client/src/App.tsx` | **MODIFICATO** — Route `/lead/chat` + lazy import `LeadChat` |

---

# COME USARLO

## Link per le Ads

Inserisci questo URL nelle campagne Facebook/Google Ads:

```
https://tuodominio.com/onboarding-gratuito
```

## Dove vedere i lead

I lead arrivano in: **Sidebar → LEAD → Proactive Leads**

- Source = `lead_magnet`
- Dopo il report: category = `tiepido`, con tutti i dettagli del business

## Monitorare le sessioni

Le sessioni pubbliche sono nella tabella `delivery_agent_sessions` con `is_public = true`.

```sql
SELECT lead_name, lead_email, lead_phone, lead_user_id, status, created_at
FROM delivery_agent_sessions
WHERE is_public = true
ORDER BY created_at DESC;
```

## Monitorare gli account lead_magnet

```sql
SELECT id, username, email, first_name, last_name, created_at
FROM users
WHERE is_lead_magnet = true
ORDER BY created_at DESC;
```
