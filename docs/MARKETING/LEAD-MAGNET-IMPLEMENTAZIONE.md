# LEAD MAGNET — ONBOARDING GRATUITO

## Documentazione Tecnica dell'Implementazione

**Versione 1.0 — Marzo 2026**

---

# OVERVIEW

Lead magnet pubblico che permette a chiunque di ricevere un'analisi gratuita del proprio business con AI. Il visitatore compila un form (nome, email, telefono — tutti obbligatori), chatta con Luca (consulente AI), e riceve un report personalizzato con le soluzioni AI più adatte alla sua attività.

**URL:** `/onboarding-gratuito`

**Accesso:** Pubblico, nessun login necessario.

---

# FLUSSO UTENTE

```
Visitatore arriva sulla landing page
        ↓
Compila il form: Nome, Email, Telefono (tutti obbligatori)
        ↓
Clic "Inizia la Tua Analisi Gratuita"
        ↓
Si apre la chat con Luca (AI consulente)
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
Report visualizzato inline:
  - Lettera personale
  - Diagnosi (dove sei ora + gap analysis)
  - Soluzioni AI consigliate (4-7 pacchetti)
  - Roadmap con timeline
  - Quick Wins (azioni immediate)
        ↓
CTA finale: "Vuoi Implementare Queste Soluzioni? Prenota Consulenza Gratuita"
```

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

## 2. Arricchimento Post-Report

Quando il report viene generato, il lead in `proactive_leads` viene aggiornato:

| Campo | Valore |
|-------|--------|
| `lead_category` | `tiepido` (ha completato l'analisi) |
| `lead_info.tipo_business` | Dal profilo estratto |
| `lead_info.settore` | Dal profilo estratto |
| `lead_info.pain_points` | Lista pain points identificati |
| `lead_info.pacchetti_consigliati` | Nomi dei pacchetti consigliati |
| `consultant_notes` | Riepilogo: business type + pacchetti consigliati |

## 3. Sessione Delivery Agent

La conversazione è salvata nella tabella `delivery_agent_sessions` con:

| Campo | Valore |
|-------|--------|
| `is_public` | `true` |
| `public_token` | UUID univoco per accesso alla sessione |
| `lead_name` | Nome del visitatore |
| `lead_email` | Email del visitatore |
| `lead_phone` | Telefono del visitatore |
| `consultant_id` | ID di Alessio (owner) |
| `mode` | `onboarding` |

---

# ARCHITETTURA TECNICA

## Database — Colonne aggiunte a `delivery_agent_sessions`

```sql
ALTER TABLE delivery_agent_sessions ADD COLUMN IF NOT EXISTS public_token VARCHAR UNIQUE;
ALTER TABLE delivery_agent_sessions ADD COLUMN IF NOT EXISTS lead_name VARCHAR;
ALTER TABLE delivery_agent_sessions ADD COLUMN IF NOT EXISTS lead_email VARCHAR;
ALTER TABLE delivery_agent_sessions ADD COLUMN IF NOT EXISTS lead_phone VARCHAR;
ALTER TABLE delivery_agent_sessions ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT false;
```

## Backend — API Endpoints Pubblici

File: `server/routes/public/lead-magnet.ts`

Registrato in `server/routes.ts` senza `authenticateToken`.

| Endpoint | Metodo | Descrizione |
|----------|--------|-------------|
| `/api/public/lead-magnet/start` | POST | Registra il lead (nome, email, telefono obbligatori), crea sessione, inserisce in proactive_leads. Ritorna `{ token, sessionId }`. |
| `/api/public/lead-magnet/:token/session` | GET | Ritorna sessione + messaggi + report (se generato). Per riprendere sessioni interrotte. |
| `/api/public/lead-magnet/:token/chat` | POST | Chat SSE streaming con Luca. Accetta `{ message }`. Stream eventi: `delta`, `phase_change`, `complete`, `error`. |
| `/api/public/lead-magnet/:token/generate-report` | POST | Genera report personalizzato. Pipeline: analisi → draft → business intelligence (Google Maps + sito). Aggiorna proactive_leads con dati arricchiti. |

## System Prompt Pubblico

File: `server/prompts/delivery-agent-prompt.ts` — funzione `getPublicOnboardingPrompt(leadName)`

Differenze rispetto al prompt interno:
- NON menziona "la piattaforma", "i moduli", "setup", "API Key"
- Parla di RISULTATI: "automatizzare le risposte", "non perdere più lead"
- Focus su capire il business e i problemi, non vendere
- Il report fa il collegamento tra problemi e soluzioni
- Stesse 8 fasi di discovery del prompt interno

## Frontend — Pagina Pubblica

File: `client/src/pages/public-lead-magnet.tsx`

Route: `/onboarding-gratuito` (in `App.tsx`, fuori da AuthGuard)

**Ottimizzazione PageSpeed:**
- Zero librerie UI esterne (no shadcn, no radix)
- CSS inline (zero file CSS aggiuntivi)
- Nessun font extra caricato
- Lazy loaded via `React.lazy()`
- La landing (fase 1) è puramente HTML statico + 3 input
- Chat e report si montano solo dopo interazione
- Nessuna immagine (SVG inline per il logo)
- Zero animazioni pesanti (solo un CSS spinner per loading)

**3 fasi interne al componente:**
1. `landing` — Form con hero + steps + input fields
2. `chat` — Chat streaming con Luca (SSE)
3. `report` — Report inline con CTA finale

---

# FILE MODIFICATI/CREATI

| File | Azione |
|------|--------|
| `server/routes/public/lead-magnet.ts` | **CREATO** — 4 endpoint API pubblici |
| `server/routes.ts` | **MODIFICATO** — Import + registrazione router |
| `server/routes/delivery-agent.ts` | **MODIFICATO** — Schema `ensureTables()` aggiornato con nuove colonne |
| `server/prompts/delivery-agent-prompt.ts` | **MODIFICATO** — Aggiunta `getPublicOnboardingPrompt()` |
| `client/src/pages/public-lead-magnet.tsx` | **CREATO** — Pagina pubblica lead magnet |
| `client/src/App.tsx` | **MODIFICATO** — Lazy import + route `/onboarding-gratuito` |

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
SELECT lead_name, lead_email, lead_phone, status, created_at
FROM delivery_agent_sessions
WHERE is_public = true
ORDER BY created_at DESC;
```
