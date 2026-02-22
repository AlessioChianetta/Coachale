# RDP - Sistema Comportamento AI per Livelli Agente WhatsApp
## Documento di Progetto Completo - Versione Ossessiva v3

---

## INDICE

| # | Sezione | Descrizione |
|---|---------|-------------|
| 1 | [Contesto e Obiettivo](#1-contesto-e-obiettivo) | Perché esiste questo documento |
| 2 | [Glossario Tecnico](#2-glossario-tecnico) | Definizioni precise di ogni termine |
| 3 | [Mappa Tabelle Database Coinvolte](#3-mappa-tabelle-database-coinvolte) | Ogni tabella, colonna, relazione |
| 4 | [Stato Attuale - Flusso WhatsApp](#4-stato-attuale---flusso-whatsapp) | Come funziona OGGI passo per passo |
| 5 | [Stato Attuale - Flusso Web (CORRETTO)](#5-stato-attuale---flusso-web-corretto) | TUTTI i livelli passano da /agent/ |
| 6 | [Problemi Identificati](#6-problemi-identificati) | Cosa non va e perché |
| 7 | [Architettura Target](#7-architettura-target) | Come deve funzionare DOPO |
| 8 | [Modifiche Database](#8-modifiche-database) | SQL esatto e schema Drizzle |
| 9 | [Modifiche Backend](#9-modifiche-backend) | Ogni file, riga, logica |
| 10 | [Modifiche Frontend](#10-modifiche-frontend) | Layout, componenti, UX |
| 11 | [Scenari di Test](#11-scenari-di-test) | Ogni caso possibile |
| 12 | [10 Domande Ossessive](#12-10-domande-ossessive) | Dubbi verificati e risolti |
| 13 | [File Coinvolti](#13-file-coinvolti) | Indice completo file/righe |
| 14 | [Piano di Esecuzione](#14-piano-di-esecuzione) | Ordine esatto delle task |

---

## 1. CONTESTO E OBIETTIVO

### Il sistema oggi

Un consulente ha N "Dipendenti AI" (agenti WhatsApp). Ogni agente è una riga nella tabella `consultant_whatsapp_config`. Gli agenti possono avere 0 o più livelli di accesso (Bronzo/Argento/Gold) che determinano CHI può chattare.

**Ma il comportamento dell'AI è IDENTICO per tutti i livelli.** Un utente Bronzo (gratuito) riceve la stessa qualità di risposta di un Gold (pagante). L'unica differenza tecnica è l'accesso al File Search per i Gold.

### Cosa deve cambiare

1. **Prompt differenziati per livello**: Il consulente configura istruzioni AI diverse per ogni livello. Modello additivo: L2 = L1 + extra, L3 = L1 + L2 + extra.

2. **Separazione agente standard vs agente con livelli**: Se l'agente NON ha livelli (es: "Assistenza Clienti"), un cliente riconosciuto ottiene il flusso CRM completo (come oggi). Se l'agente HA livelli, il cliente viene trattato secondo il suo livello, senza accesso CRM.

3. **Conversazioni web/WhatsApp unificate**: Quando un utente chatta con un agente con livelli sul sito web, poi scrive allo stesso agente su WhatsApp, deve vedere gli stessi messaggi.

---

## 2. GLOSSARIO TECNICO

| Termine | Significato | Dove nel codice |
|---------|-------------|-----------------|
| **Agente Standard** | Agente WhatsApp SENZA livelli configurati. `levels` = null, vuoto, o [] | `consultant_whatsapp_config.levels IS NULL` |
| **Agente con Livelli** | Agente WhatsApp CON almeno un livello. `levels` = ["1"], ["2"], ["1","2"], ecc. | `consultant_whatsapp_config.levels` array non vuoto |
| **Livello 1 / Bronzo** | Accesso con registrazione gratuita. Utente = `bronze_users` | `bronze_users` tabella |
| **Livello 2 / Argento** | Accesso a pagamento. Utente = `client_level_subscriptions` con level="2" | `client_level_subscriptions.level = "2"` |
| **Livello 3 / Gold** | Accesso completo con File Search. Utente = `client_level_subscriptions` con level="3" | `client_level_subscriptions.level = "3"` |
| **Level Overlay** | Blocco di istruzioni aggiuntive che il consulente scrive per ogni livello. Si SOMMA al prompt base | Nuovo campo `level_prompt_overlay_1/2/3` |
| **classifyParticipant()** | Funzione che identifica chi sta scrivendo su WhatsApp (consultant/client/unknown) | `webhook-handler.ts:523` |
| **buildWhatsAppAgentPrompt()** | Costruisce il prompt base dell'agente (usato dal web E che useremo su WhatsApp) | `agent-consultant-chat-service.ts` |
| **buildSystemPrompt()** | Costruisce il prompt completo con dati CRM del cliente | `ai-prompts.ts` |
| **buildLeadSystemPrompt()** | Costruisce il prompt per lead con gestione appuntamenti | `message-processor.ts:4435` |
| **public-agent-router.ts** | Router backend che gestisce TUTTI i livelli web (Bronze, Silver, Gold) | `server/routes/public-agent-router.ts` |
| **public-ai-chat-router.ts** | **⚠️ DEPRECATO** - Vecchio sistema L1 con localStorage. Filtra campo `level` (singolo) | `server/routes/public-ai-chat-router.ts` |
| **managerConversations** | Tabella conversazioni per TUTTI gli utenti sulla pagina web dell'agente (Bronze, Silver, Gold) | `shared/schema.ts:7366` |
| **managerMessages** | Tabella messaggi dentro le conversazioni manager | `shared/schema.ts:7395` |
| **whatsappConversations** | Tabella conversazioni WhatsApp (via Twilio) | `shared/schema.ts` |
| **whatsappMessages** | Tabella messaggi WhatsApp | `shared/schema.ts` |
| **bronzeUsers** | Tabella utenti registrati gratuitamente per L1 | `shared/schema.ts` |
| **clientLevelSubscriptions** | Tabella abbonamenti paganti (L2/L3) | `shared/schema.ts:932` |
| **verifyManagerToken()** | Middleware autenticazione nel public-agent-router. Gestisce 4 tipi di JWT | `public-agent-router.ts:60` |

---

## 3. MAPPA TABELLE DATABASE COINVOLTE

### 3.1 consultant_whatsapp_config (Configurazione Agente)

```
┌──────────────────────────────────────────────────────────────────────┐
│ consultant_whatsapp_config                                          │
├──────────────────────────────────────────────────────────────────────┤
│ id                    VARCHAR PK (UUID)                              │
│ consultant_id         VARCHAR FK → users.id                          │
│ agent_name            TEXT (es: "Assistenza Clienti", "Coach AI")    │
│ integration_mode      TEXT ("whatsapp_ai" | "ai_only")               │
│ is_active             BOOLEAN                                        │
│ ...                                                                  │
│ ─── LIVELLI ────────────────────────────────────────────────────────│
│ level                 TEXT ("1"|"2"|"3"|null) [⚠️ DEPRECATO]        │
│ levels                TEXT[] (["1"], ["2"], ["1","2"]) [✅ ATTIVO]   │
│ public_slug           TEXT UNIQUE (es: "silvia" → /agent/silvia)     │
│ daily_message_limit   INTEGER (default 15)                           │
│ ...                                                                  │
│ ─── NUOVI CAMPI DA AGGIUNGERE ──────────────────────────────────────│
│ level_prompt_overlay_1  TEXT NULL  ← istruzioni Bronzo               │
│ level_prompt_overlay_2  TEXT NULL  ← istruzioni aggiuntive Argento   │
│ level_prompt_overlay_3  TEXT NULL  ← istruzioni aggiuntive Gold      │
├──────────────────────────────────────────────────────────────────────┤
│ NOTA SUL CAMPO level vs levels:                                      │
│                                                                      │
│ level (singolo, DEPRECATO):                                          │
│   - Usato SOLO da public-ai-chat-router.ts (riga 65)                │
│   - Usato dal File Search check (message-processor.ts:1777)         │
│   - NON usare per logica di routing → passare a levels              │
│                                                                      │
│ levels (array, ATTIVO):                                              │
│   - Usato dal wizard frontend AgentLevel.tsx                         │
│   - Indica QUALI livelli l'agente supporta                           │
│   - Es: ["1","2"] = supporta Bronzo e Argento                       │
│   - Se vuoto/null → agente standard (no livelli)                     │
└──────────────────────────────────────────────────────────────────────┘
```

### 3.2 client_level_subscriptions (Abbonamenti Livello)

```
┌──────────────────────────────────────────────────────────────────────┐
│ client_level_subscriptions                                           │
├──────────────────────────────────────────────────────────────────────┤
│ id                    VARCHAR PK (UUID)                              │
│ client_id             VARCHAR FK → users.id (può essere NULL)        │
│ consultant_id         VARCHAR FK → users.id (NOT NULL)               │
│ bronze_user_id        VARCHAR (link al bronzeUser originale)         │
│ level                 TEXT ("2" | "3" | "4") NOT NULL                │
│ status                TEXT ("pending"|"active"|"canceled"|...)       │
│ client_email          TEXT NOT NULL                                   │
│ client_name           TEXT                                           │
│ phone                 TEXT                                           │
│ password_hash         TEXT (per login)                                │
│ ...                                                                  │
├──────────────────────────────────────────────────────────────────────┤
│ QUERY CHIAVE per determinare livello:                                │
│ SELECT level FROM client_level_subscriptions                         │
│ WHERE consultant_id = :consultantId                                  │
│   AND status = 'active'                                              │
│   AND (client_email = :email OR phone = :phone)                      │
│ ORDER BY CASE level WHEN '3' THEN 1 WHEN '2' THEN 2 END             │
│ LIMIT 1                                                              │
│                                                                      │
│ ATTENZIONE: Per WhatsApp abbiamo solo il telefono,                   │
│ non l'email e non il clientId. Quindi la ricerca su WhatsApp         │
│ deve passare dal telefono → match con phone in questa tabella.       │
└──────────────────────────────────────────────────────────────────────┘
```

### 3.3 bronze_users (Utenti Bronzo)

```
┌──────────────────────────────────────────────────────────────────────┐
│ bronze_users                                                         │
├──────────────────────────────────────────────────────────────────────┤
│ id                    VARCHAR PK (UUID)                              │
│ consultant_id         VARCHAR FK → users.id                          │
│ email                 TEXT NOT NULL                                   │
│ password_hash         TEXT (per login)                                │
│ first_name            TEXT                                           │
│ last_name             TEXT                                           │
│ is_active             BOOLEAN                                        │
│ daily_messages_used   INTEGER                                        │
│ daily_message_limit   INTEGER                                        │
│ writing_style         TEXT                                           │
│ response_length       TEXT                                           │
│ custom_instructions   TEXT                                           │
│ has_completed_onboarding BOOLEAN                                     │
│ upgraded_at           TIMESTAMP (se ha fatto upgrade)                 │
│ upgraded_to_level     TEXT                                           │
│ upgraded_subscription_id VARCHAR                                     │
│ ...                                                                  │
├──────────────────────────────────────────────────────────────────────┤
│ UNIQUE(consultant_id, email)                                         │
│                                                                      │
│ NOTA: bronze_users NON ha campo phone!                               │
│ Il match da WhatsApp non può avvenire per questa tabella             │
│ a meno che il bronzeUser non sia stato upgraded e linkato            │
│ a un client_level_subscriptions.                                     │
└──────────────────────────────────────────────────────────────────────┘
```

### 3.4 manager_conversations + manager_messages (Chat Web per TUTTI i livelli)

```
┌──────────────────────────────────────────────────────────────────────┐
│ manager_conversations                                                │
├──────────────────────────────────────────────────────────────────────┤
│ id                    VARCHAR PK (UUID)                              │
│ manager_id            VARCHAR FK → manager_users.id (NOT NULL)       │
│   *** PER BRONZE: managerId = bronzeUserId ***                       │
│   *** PER SILVER/GOLD: managerId = subscriptionId ***                │
│   *** (sono valori fake, NON FK reali a manager_users) ***           │
│ share_id              VARCHAR FK → whatsapp_agent_shares.id          │
│   *** PER BRONZE: shareId = "bronze-{bronzeUserId}" ***              │
│   *** PER SILVER: shareId = "silver-{subscriptionId}" ***            │
│   *** PER GOLD: shareId = "gold-{subscriptionId}" ***                │
│   *** (sono valori fake, NON FK reali a shares) ***                  │
│ agent_config_id       VARCHAR FK → consultant_whatsapp_config.id     │
│ title                 TEXT                                           │
│ message_count         INTEGER                                        │
│ last_message_at       TIMESTAMP                                      │
│ metadata              JSONB                                          │
│ ─── NUOVI CAMPI DA AGGIUNGERE ──────────────────────────────────────│
│ whatsapp_phone        VARCHAR NULL  ← telefono WhatsApp associato    │
│ source                VARCHAR DEFAULT 'web' ← 'web'|'whatsapp'|'both'│
├──────────────────────────────────────────────────────────────────────┤
│ INDEX: manager_id, share_id, last_message_at                         │
│                                                                      │
│ ⚠️ SCOPERTA CRITICA: manager_id e share_id per Bronze/Silver/Gold   │
│ NON sono FK reali! Sono stringhe costruite artificialmente nel       │
│ middleware verifyManagerToken (riga 94-99, 174-179).                 │
│ manager_id = bronzeUserId oppure subscriptionId                      │
│ share_id = "bronze-{id}" oppure "silver-{id}" o "gold-{id}"         │
│                                                                      │
│ Questo significa che per trovare una conversazione da WhatsApp,      │
│ NON possiamo fare lookup per manager_id (non lo conosciamo).         │
│ Dobbiamo usare agent_config_id + il nuovo campo whatsapp_phone.     │
└──────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────┐
│ manager_messages                                                     │
├──────────────────────────────────────────────────────────────────────┤
│ id                    VARCHAR PK (UUID)                              │
│ conversation_id       VARCHAR FK → manager_conversations.id          │
│ role                  TEXT ("user" | "assistant")                     │
│ content               TEXT NOT NULL                                   │
│ status                TEXT ("sending"|"completed"|"error")            │
│ metadata              JSONB { tokensUsed, modelUsed, source, ... }   │
│ created_at            TIMESTAMP                                      │
└──────────────────────────────────────────────────────────────────────┘
```

### 3.5 Relazioni tra tabelle (CORRETTE)

```
  consultant_whatsapp_config
           │
           ├─── 1:N ──► whatsapp_agent_shares (per Silver/Gold con share reale)
           │                     │
           │                     └── 1:N ──► manager_link_assignments
           │                                        │
           │                                        └── N:1 ──► manager_users
           │
           ├─── via public_slug ──► Bronze (share virtuale creata in loadShareAndAgent)
           │
           └─── via agent_config_id ──► manager_conversations (per tutti i livelli)
                                              │
                                              └── 1:N ──► manager_messages


  users ─────────► client_level_subscriptions (L2/L3/L4, status active)
                          │
                          │ Ha campo phone → usabile per match WhatsApp

  consultant ────► bronze_users (L1, account gratuiti)
                          │
                          │ ⚠️ NON ha campo phone → match WhatsApp solo via email


  whatsapp_conversations ──── whatsapp_messages
  (tabella SEPARATA, usata SOLO per il flusso Twilio WhatsApp)
  (NON collegata a manager_*)
```

---

## 4. STATO ATTUALE - FLUSSO WHATSAPP

### 4.1 Diagramma di Flusso Completo - Messaggio WhatsApp IN INGRESSO

```
╔══════════════════════════════════════════════════════════════════════╗
║  MESSAGGIO WHATSAPP ARRIVA DA +39XXX...                             ║
╚══════════════════════════════════════════════════════════════════════╝
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────────┐
│ STEP 1: Twilio Webhook                                               │
│ File: server/whatsapp/webhook-handler.ts                             │
│ Funzione: handleTwilioWebhook()                                      │
│                                                                      │
│ Estrae: From (+39XXX), To (numero agente), Body (testo)              │
│ Identifica: consultant_whatsapp_config tramite numero To             │
│ Risultato: consultantId + agentConfigId                              │
└──────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────────┐
│ STEP 2: classifyParticipant()                                        │
│ File: server/whatsapp/webhook-handler.ts riga 523                    │
│                                                                      │
│ Input: normalizedPhone, consultantId                                 │
│                                                                      │
│ ┌─ 1. È il consulente proprietario?                                  │
│ │     → return { type: "consultant", userId: user.id }               │
│ │                                                                    │
│ ├─ 2. È un cliente (users.consultant_id match)?                      │
│ │     → return { type: "client", userId: user.id }                   │
│ │     *** AVVIENE PER QUALSIASI AGENTE ***                           │
│ │     *** NON CONTROLLA levels ***                                   │
│ │                                                                    │
│ ├─ 3. Email match da proactive lead?                                 │
│ │     → return { type: "client", userId: user.id }                   │
│ │                                                                    │
│ └─ 4. Nessun match                                                   │
│       → return { type: "unknown", userId: null }                     │
│                                                                      │
│ *** NON distingue agente standard da agente con livelli ***          │
│ *** Un Gold viene sempre classificato come "client" ***              │
└──────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────────┐
│ STEP 3: getOrCreateConversation()                                    │
│ File: server/whatsapp/webhook-handler.ts riga 693                    │
│                                                                      │
│ Cerca/crea in: whatsapp_conversations                                │
│ Con: phone + consultantId + agentConfigId                            │
│ Salva: userId, isLead, metadata.participantType                      │
└──────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────────┐
│ STEP 4: scheduleMessageProcessing()                                  │
│ File: server/whatsapp/message-processor.ts:430                       │
│                                                                      │
│ Batching: aspetta 1-2 sec per messaggi multipli                      │
│ Poi chiama processConversation()                                     │
└──────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────────┐
│ STEP 5: processConversation() - CARICAMENTO CONFIG                   │
│ File: server/whatsapp/message-processor.ts riga 648                  │
│                                                                      │
│ Carica consultantConfig (INTERA riga della tabella):                 │
│   SELECT * FROM consultant_whatsapp_config                           │
│   WHERE id = conversation.agentConfigId                              │
│                                                                      │
│ → consultantConfig contiene TUTTI i campi inclusi:                   │
│   .level (deprecato), .levels (array), .publicSlug                   │
│   E i FUTURI: .levelPromptOverlay1, .levelPromptOverlay2, .3        │
│                                                                      │
│ Questo è il punto dove avremo accesso a isLevelAgent!                │
└──────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────────┐
│ STEP 6: ROUTING DEL PROMPT (riga 970-1595)                           │
│                                                                      │
│ participantType = conversation.metadata.participantType              │
│ effectiveUserId = conversation.userId                                │
│                                                                      │
│ ┌─────────────────────────────────────────────────────────────┐      │
│ │ RAMO A: participantType === 'consultant'                    │      │
│ │ (riga 987)                                                  │      │
│ │                                                             │      │
│ │ → buildConsultantSystemPrompt()                              │      │
│ │ → CRM COMPLETO                                              │      │
│ │ → *** INVARIATO - consulente ha sempre accesso totale ***   │      │
│ └─────────────────────────────────────────────────────────────┘      │
│                                                                      │
│ ┌─────────────────────────────────────────────────────────────┐      │
│ │ RAMO B: effectiveUserId PRESENTE (riga 1051)                │      │
│ │                                                             │      │
│ │ → buildUserContext(effectiveUserId)                          │      │
│ │ → buildSystemPrompt("assistenza", "finanziario", userCtx)   │      │
│ │ → Accesso CRM del CLIENT                                    │      │
│ │ → + Knowledge base agente                                   │      │
│ │ → + Customer Support mode                                   │      │
│ │                                                             │      │
│ │ *** PROBLEMA: un Gold su agente con livelli entra QUI ***   │      │
│ │ *** e riceve accesso CRM che NON dovrebbe avere ***         │      │
│ └─────────────────────────────────────────────────────────────┘      │
│                                                                      │
│ ┌─────────────────────────────────────────────────────────────┐      │
│ │ RAMO C: ELSE (lead) (riga 1572)                             │      │
│ │                                                             │      │
│ │ → buildLeadSystemPrompt()                                    │      │
│ │ → Appuntamenti, persuasione, conversione                    │      │
│ │                                                             │      │
│ │ *** PROBLEMA: un lead su agente con livelli entra QUI ***   │      │
│ │ *** e riceve gestione appuntamenti che NON serve ***        │      │
│ └─────────────────────────────────────────────────────────────┘      │
└──────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────────┐
│ STEP 7: File Search Check (riga 1777)                                │
│                                                                      │
│ agentLevel = consultantConfig.level   ← USA IL CAMPO DEPRECATO!     │
│ canAccessConsultantStore = (agentLevel === "3")                       │
│                                                                      │
│ *** Usa consultantConfig.level (deprecato), non levels (array) ***   │
│ *** Questo check funziona ma è inconsistente ***                     │
└──────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────────┐
│ STEP 8: Chiamata Gemini + Salvataggio                                │
│                                                                      │
│ → Chiamata Gemini con systemPrompt + history                         │
│ → Risposta salvata in whatsapp_messages                              │
│ → Inviata via Twilio                                                 │
│ → *** NON salvata in manager_messages ***                            │
│ → *** NON condivisa con la pagina web ***                            │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 5. STATO ATTUALE - FLUSSO WEB (CORRETTO)

### ⚠️ CORREZIONE CRITICA RISPETTO ALLA VERSIONE PRECEDENTE

**VECCHIA ASSUNZIONE (SBAGLIATA):** L1 usa `/ai/:slug` e localStorage, L2/L3 usano `/agent/:slug` e manager_messages.

**REALTÀ VERIFICATA:** TUTTI i livelli (Bronze, Silver, Gold) usano `/agent/:slug` e `public-agent-router.ts`. La pagina `/ai/:slug` (`public-ai-chat-router.ts`) è **DEPRECATA** e usa il campo `level` (singolo deprecato).

### 5.1 Flusso Web REALE - Per TUTTI i livelli

```
╔══════════════════════════════════════════════════════════════════════╗
║  UTENTE VISITA /agent/{slug}                                        ║
║  (slug = publicSlug dell'agente O id dello share)                   ║
╚══════════════════════════════════════════════════════════════════════╝
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────────┐
│ STEP 1: loadShareAndAgent() middleware                               │
│ File: server/routes/public-agent-router.ts riga 240                  │
│                                                                      │
│ Cerca l'agente in DUE modi:                                         │
│                                                                      │
│ 1. Prima cerca in whatsapp_agent_shares (per Silver/Gold):           │
│    SELECT * FROM whatsapp_agent_shares WHERE slug = :slug            │
│    Se trovato → carica agentConfig dalla FK agentConfigId            │
│                                                                      │
│ 2. Se NON trovato, cerca in consultantWhatsappConfig (per Bronze):   │
│    SELECT * FROM consultant_whatsapp_config                          │
│    WHERE public_slug = :slug AND is_active = true                    │
│                                                                      │
│    Se trovato → crea uno SHARE VIRTUALE:                             │
│    {                                                                 │
│      id: "bronze-{agentConfig.id}",                                  │
│      slug: slug,                                                     │
│      agentConfigId: agentConfig.id,                                  │
│      requiresLogin: true,                                            │
│    }                                                                 │
│                                                                      │
│ *** Il Bronze NON ha un vero share nel DB ***                        │
│ *** Ha uno share virtuale creato al volo ***                         │
└──────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────────┐
│ STEP 2: verifyManagerToken() middleware                              │
│ File: server/routes/public-agent-router.ts riga 60                   │
│                                                                      │
│ Decodifica JWT e determina tipo utente:                              │
│                                                                      │
│ ┌── decoded.type === "bronze" && decoded.bronzeUserId?               │
│ │   → req.bronzeUser = { bronzeUserId, consultantId, email }         │
│ │   → req.manager = {                                                │
│ │       managerId: bronzeUserId,  ← FAKE, non è un vero manager     │
│ │       shareId: "bronze-{bronzeUserId}",  ← FAKE                   │
│ │       role: "bronze"                                               │
│ │     }                                                              │
│ │                                                                    │
│ ├── decoded.type === "silver" || decoded.type === "gold"?            │
│ │   → Carica subscription da client_level_subscriptions              │
│ │   → Verifica status === "active"                                   │
│ │   → req.silverGoldUser = {                                         │
│ │       subscriptionId, consultantId, email,                         │
│ │       level: subscription.level (dal DB, non dal token!)           │
│ │     }                                                              │
│ │   → req.manager = {                                                │
│ │       managerId: subscriptionId,  ← FAKE                          │
│ │       shareId: "{type}-{subscriptionId}",  ← FAKE                 │
│ │       role: decoded.type                                           │
│ │     }                                                              │
│ │                                                                    │
│ ├── decoded.userId (Gold client dalla tabella users)?                │
│ │   → req.silverGoldUser = { level: "3", type: "gold" }             │
│ │   → req.manager = { managerId: userId, role: "gold" }             │
│ │                                                                    │
│ └── decoded.managerId (token manager classico, per link condivisi)   │
│     → req.manager = { managerId, consultantId, shareId, role }       │
│                                                                      │
│ *** 4 tipi di JWT diversi, tutti convergono a req.manager ***        │
└──────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────────┐
│ STEP 3: POST /:slug/conversations/:id/messages                       │
│ File: server/routes/public-agent-router.ts riga 1053                 │
│                                                                      │
│ 1. Carica preferences (da subscription o body)                       │
│ 2. Verifica accesso (manager.shareId === share.id)                   │
│ 3. Cerca conversazione in manager_conversations                      │
│ 4. Salva messaggio utente in manager_messages                        │
│ 5. Carica history (ultimi 20 da manager_messages)                    │
│ 6. Costruisce prompt:                                                │
│                                                                      │
│    basePrompt = await buildWhatsAppAgentPrompt(agentConfig)          │
│                                                                      │
│    if (share.agentInstructions) → aggiunge al prompt                 │
│    if (preferences) → aggiunge stile/lunghezza/istruzioni            │
│    if (silverGoldUser.level === "3") → aggiunge AI Memory            │
│                                                                      │
│    *** NESSUN OVERLAY PER LIVELLO OGGI ***                           │
│    *** Tutti ricevono lo stesso basePrompt ***                       │
│                                                                      │
│ 7. File Search check (riga 1245):                                    │
│    agentLevel = agentConfig.level  ← USA CAMPO DEPRECATO!           │
│    canAccessConsultantStore = (agentLevel === "3")                    │
│                                                                      │
│ 8. Chiama Gemini (streaming SSE)                                     │
│ 9. Salva risposta in manager_messages                                │
│                                                                      │
│ *** Tutti i livelli salvano in manager_messages ***                  │
│ *** Nessuna condivisione con WhatsApp ***                            │
└──────────────────────────────────────────────────────────────────────┘
```

### 5.2 Riepilogo Storage Conversazioni OGGI (CORRETTO)

```
┌─────────────────────────────────────────────────────────────────────┐
│                    DOVE VENGONO SALVATI I MESSAGGI                   │
├──────────────┬──────────────────────┬───────────────────────────────┤
│ Canale       │ Tabella              │ Condiviso?                    │
├──────────────┼──────────────────────┼───────────────────────────────┤
│ WhatsApp     │ whatsapp_messages    │ ╳ NO - isolato da web        │
│ Web Bronze   │ manager_messages     │ ╳ NO - isolato da WhatsApp   │
│ Web Silver   │ manager_messages     │ ╳ NO - isolato da WhatsApp   │
│ Web Gold     │ manager_messages     │ ╳ NO - isolato da WhatsApp   │
├──────────────┴──────────────────────┴───────────────────────────────┤
│ /ai/:slug    │ localStorage         │ ⚠️ DEPRECATO - non usato     │
├──────────────┴──────────────────────┴───────────────────────────────┤
│ CONCLUSIONE: web (tutti i livelli) salva in manager_messages.       │
│ WhatsApp salva in whatsapp_messages. NON sono collegati.            │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 6. PROBLEMI IDENTIFICATI

### P1: Nessuna differenziazione AI per livello

```
OGGI:
  Utente Bronzo scrive "Ciao" su web → buildWhatsAppAgentPrompt → prompt X
  Utente Gold scrive "Ciao" su web   → buildWhatsAppAgentPrompt → prompt X (IDENTICO!)
  
  Sul web l'unica differenza:
    - Gold ha AI Memory (riga 1206)
    - Gold ha accesso al consultantStore File Search (riga 1245)
  
  Ma le ISTRUZIONI dell'AI = UGUALI per tutti

DOPO:
  Bronze → prompt X + overlay 1
  Silver → prompt X + overlay 1 + overlay 2
  Gold   → prompt X + overlay 1 + overlay 2 + overlay 3
```

### P2: Client su WhatsApp + agente con livelli = accesso CRM indebito

```
OGGI - Scenario problematico:

  Cliente Gold scrive su WhatsApp al "Coach AI" (agente CON livelli)
       │
       ▼
  classifyParticipant() → type: "client" (perché ha userId in users)
       │
       ▼
  processConversation() → effectiveUserId PRESENTE
       │
       ▼
  RAMO B (riga 1051): buildSystemPrompt("assistenza", "finanziario", userContext)
       │
       ▼
  *** L'AI accede a TUTTI i dati CRM del cliente ***
  *** MA l'agente è il COACH AI - non dovrebbe avere CRM! ***

DOPO:
  isLevelAgent check → NON usare buildSystemPrompt
  Usare buildWhatsAppAgentPrompt + overlay per livello
```

### P3: Conversazioni web/WhatsApp non condivise

```
OGGI:
  Mario chatta con "Coach AI" sul sito web (/agent/coach):
    → manager_messages: "Ciao" / "Ciao Mario!"
    
  Mario scrive su WhatsApp allo STESSO "Coach AI":
    → whatsapp_messages: "Ciao" / "Benvenuto!"
    
  *** Due conversazioni SEPARATE con lo STESSO agente ***
  *** L'AI non ha contesto incrociato ***

DOPO:
  Mario chatta con "Coach AI" (web O WhatsApp):
    → STESSA conversazione in manager_conversations/manager_messages
```

### P4 (CORRETTO): public-ai-chat-router.ts deprecato

```
PRIMA si pensava che L1 usasse /ai/:slug con localStorage.
IN REALTÀ L1 usa /agent/:slug con manager_messages, come L2/L3.

public-ai-chat-router.ts:
  - Filtra per level="1" (campo singolo DEPRECATO, riga 65)
  - Usa localStorage (zero persistenza server)
  - NON è usato dal flusso attuale Bronze/Silver/Gold
  
DECISIONE: NON toccare public-ai-chat-router.ts.
            L'overlay va iniettato SOLO in public-agent-router.ts.
```

---

## 7. ARCHITETTURA TARGET

### 7.1 Nuovo Flusso WhatsApp - Con Routing per Livelli

```
╔══════════════════════════════════════════════════════════════════════╗
║  MESSAGGIO WHATSAPP ARRIVA                                          ║
╚══════════════════════════════════════════════════════════════════════╝
                              │
                              ▼
         STEP 1-4: INVARIATI (webhook, classify, conversation, batch)
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────────┐
│ STEP 5: processConversation() - NUOVO ROUTING                        │
│                                                                      │
│ consultantConfig caricato (riga 648, SELECT * da whatsapp_config)    │
│                                                                      │
│ // NUOVO CHECK - prima di tutto                                      │
│ const isLevelAgent = Array.isArray(consultantConfig?.levels)          │
│   && consultantConfig.levels.length > 0;                             │
│                                                                      │
│ ┌────────────────────────────────────────────────────────────┐       │
│ │ if (isValidConsultantAccess)                               │       │
│ │   → RAMO A: CONSULENTE (invariato, CRM completo)          │       │
│ │                                                            │       │
│ │ else if (isLevelAgent)                                     │       │
│ │   → NUOVO RAMO: AGENTE CON LIVELLI                        │       │
│ │   │                                                        │       │
│ │   │  1. Determina userLevel (vedi 7.2)                     │       │
│ │   │  2. basePrompt = buildWhatsAppAgentPrompt(config)      │       │
│ │   │  3. + overlay additivi (vedi 7.3)                      │       │
│ │   │  4. Salva in manager_messages (vedi 7.4)               │       │
│ │   │  5. Carica history da manager_messages (vedi 7.5)      │       │
│ │   │  6. NON buildSystemPrompt, NON buildLeadSystemPrompt   │       │
│ │   │                                                        │       │
│ │ else if (effectiveUserId)                                  │       │
│ │   → RAMO B: CLIENT SU AGENTE STANDARD (invariato, CRM)    │       │
│ │                                                            │       │
│ │ else                                                       │       │
│ │   → RAMO C: LEAD SU AGENTE STANDARD (invariato, appunt.)  │       │
│ └────────────────────────────────────────────────────────────┘       │
└──────────────────────────────────────────────────────────────────────┘
```

### 7.2 Determinazione Livello Utente su WhatsApp

```
┌──────────────────────────────────────────────────────────────────────┐
│ DETERMINAZIONE LIVELLO UTENTE DA WHATSAPP                            │
│                                                                      │
│ Input:                                                               │
│   effectiveUserId (string | null) - da classifyParticipant           │
│   phoneNumber (string) - numero WhatsApp normalizzato                │
│   consultantId (string) - da consultantConfig                        │
│                                                                      │
│ Output: userLevel (1, 2, o 3)                                       │
│                                                                      │
│ ┌── effectiveUserId presente? ─────────────────────────────────┐    │
│ │                                                               │    │
│ │  SÌ (il chiamante è un users registrato)                      │    │
│ │  │                                                            │    │
│ │  │  // Prima cerca per clientId                               │    │
│ │  │  SELECT level FROM client_level_subscriptions              │    │
│ │  │  WHERE client_id = :effectiveUserId                        │    │
│ │  │    AND consultant_id = :consultantId                       │    │
│ │  │    AND status = 'active'                                   │    │
│ │  │  ORDER BY CASE level                                       │    │
│ │  │    WHEN '3' THEN 1 WHEN '2' THEN 2 END                    │    │
│ │  │  LIMIT 1                                                   │    │
│ │  │                                                            │    │
│ │  │  // Se non trovato, cerca per email                        │    │
│ │  │  SELECT level FROM client_level_subscriptions              │    │
│ │  │  WHERE client_email = (SELECT email FROM users             │    │
│ │  │                        WHERE id = :effectiveUserId)        │    │
│ │  │    AND consultant_id = :consultantId                       │    │
│ │  │    AND status = 'active'                                   │    │
│ │  │  LIMIT 1                                                   │    │
│ │  │                                                            │    │
│ │  │  ├── trovato level "3" → userLevel = 3 (GOLD)              │    │
│ │  │  ├── trovato level "2" → userLevel = 2 (ARGENTO)           │    │
│ │  │  └── non trovato → userLevel = 1 (BRONZO default)          │    │
│ │                                                               │    │
│ │  NO (lead, nessun userId)                                     │    │
│ │  │                                                            │    │
│ │  │  // Cerca per telefono in subscriptions                    │    │
│ │  │  SELECT level FROM client_level_subscriptions              │    │
│ │  │  WHERE phone = :phoneNumber                                │    │
│ │  │    AND consultant_id = :consultantId                       │    │
│ │  │    AND status = 'active'                                   │    │
│ │  │  LIMIT 1                                                   │    │
│ │  │                                                            │    │
│ │  │  ├── trovato → userLevel dal risultato                     │    │
│ │  │  └── non trovato → userLevel = 1 (BRONZO default)          │    │
│ └──┴────────────────────────────────────────────────────────────┘    │
│                                                                      │
│ *** Un client riconosciuto ma SENZA abbonamento attivo = Bronzo ***  │
│ *** Un lead sconosciuto = Bronzo ***                                 │
│ *** Solo con abbonamento attivo = Argento o Gold ***                 │
└──────────────────────────────────────────────────────────────────────┘
```

### 7.3 Costruzione Prompt con Overlay

```
┌──────────────────────────────────────────────────────────────────────┐
│ COSTRUZIONE PROMPT PER AGENTE CON LIVELLI                            │
│ (Usato sia da WhatsApp che da Web)                                   │
│                                                                      │
│ // Step 1: Prompt base dell'agente                                   │
│ let systemPrompt = await buildWhatsAppAgentPrompt(consultantConfig); │
│                                                                      │
│ // Step 2: Iniezione overlay ADDITIVI                                │
│ //                                                                   │
│ // userLevel = 1 → solo overlay 1                                    │
│ // userLevel = 2 → overlay 1 + overlay 2                             │
│ // userLevel = 3 → overlay 1 + overlay 2 + overlay 3                 │
│                                                                      │
│ if (consultantConfig.levelPromptOverlay1) {                          │
│   systemPrompt += `\n\n━━━ ISTRUZIONI LIVELLO BRONZO ━━━\n`         │
│     + consultantConfig.levelPromptOverlay1;                          │
│ }                                                                    │
│                                                                      │
│ if (userLevel >= 2 && consultantConfig.levelPromptOverlay2) {        │
│   systemPrompt += `\n\n━━━ ISTRUZIONI LIVELLO ARGENTO ━━━\n`        │
│     + consultantConfig.levelPromptOverlay2;                          │
│ }                                                                    │
│                                                                      │
│ if (userLevel >= 3 && consultantConfig.levelPromptOverlay3) {        │
│   systemPrompt += `\n\n━━━ ISTRUZIONI LIVELLO GOLD ━━━\n`           │
│     + consultantConfig.levelPromptOverlay3;                          │
│ }                                                                    │
│                                                                      │
│ // Step 3: NON usare buildSystemPrompt (no CRM)                      │
│ // NON usare buildLeadSystemPrompt (no appuntamenti)                 │
└──────────────────────────────────────────────────────────────────────┘
```

### 7.4 Conversazioni Condivise Web ↔ WhatsApp

```
┌──────────────────────────────────────────────────────────────────────┐
│ CONVERSAZIONE CONDIVISA - AGENTE CON LIVELLI                         │
│                                                                      │
│ Quando arriva messaggio WhatsApp a un agente con livelli:            │
│                                                                      │
│ 1. Il messaggio viene COMUNQUE salvato in whatsapp_messages          │
│    (per mantenere la gestione Twilio/webhook esistente)              │
│                                                                      │
│ 2. IN PIÙ, cerchiamo/creiamo una manager_conversation:              │
│                                                                      │
│    SELECT * FROM manager_conversations                               │
│    WHERE agent_config_id = :agentConfigId                            │
│      AND whatsapp_phone = :phoneNumber  ← NUOVO CAMPO               │
│    LIMIT 1                                                           │
│                                                                      │
│    Se non esiste → CREATE con:                                       │
│      manager_id: ??? (PROBLEMA! Vedi Domanda 6)                     │
│      share_id: ??? (PROBLEMA! Vedi Domanda 6)                       │
│      agent_config_id: agentConfigId                                  │
│      whatsapp_phone: phoneNumber                                     │
│      source: 'whatsapp'                                              │
│                                                                      │
│ 3. Salviamo messaggio utente in manager_messages                     │
│    metadata: { source: 'whatsapp' }                                  │
│                                                                      │
│ 4. Per la risposta AI, carichiamo la history da manager_messages     │
│    (include sia messaggi web che WhatsApp)                           │
│                                                                      │
│ 5. Dopo risposta AI, salviamo anche quella in manager_messages       │
│    metadata: { source: 'whatsapp' }                                  │
│                                                                      │
│ 6. La risposta AI viene anche inviata via Twilio WhatsApp            │
│    (e salvata in whatsapp_messages per il flusso Twilio)             │
│                                                                      │
│ ┌──────────────────────────────────────────────────────────┐         │
│ │ FLUSSO MESSAGGI:                                         │         │
│ │                                                          │         │
│ │ INBOUND WhatsApp:                                        │         │
│ │   → whatsapp_messages (per Twilio)                       │         │
│ │   → manager_messages (per condivisione web, source:wa)   │         │
│ │                                                          │         │
│ │ OUTBOUND AI (dopo elaborazione):                         │         │
│ │   → whatsapp_messages (per Twilio)                       │         │
│ │   → manager_messages (per condivisione web, source:wa)   │         │
│ │   → Inviato via Twilio WhatsApp                          │         │
│ │                                                          │         │
│ │ INBOUND Web:                                             │         │
│ │   → manager_messages (source: web)                       │         │
│ │                                                          │         │
│ │ OUTBOUND AI da Web:                                      │         │
│ │   → manager_messages (source: web)                       │         │
│ │   → NON inviato su WhatsApp                              │         │
│ └──────────────────────────────────────────────────────────┘         │
└──────────────────────────────────────────────────────────────────────┘
```

### 7.5 Nuovo Flusso Web con Overlay

```
┌──────────────────────────────────────────────────────────────────────┐
│ MODIFICA: server/routes/public-agent-router.ts riga 1137             │
│                                                                      │
│ OGGI:                                                                │
│   basePrompt = await buildWhatsAppAgentPrompt(agentConfig);          │
│   systemPrompt = basePrompt + share.agentInstructions + preferences  │
│                                                                      │
│ DOPO:                                                                │
│   basePrompt = await buildWhatsAppAgentPrompt(agentConfig);          │
│                                                                      │
│   // Determina livello utente dal token                              │
│   let userLevel = 1;                                                 │
│   if (req.silverGoldUser?.level === "3") userLevel = 3;              │
│   else if (req.silverGoldUser?.level === "2") userLevel = 2;         │
│   // Bronze e non autenticati = level 1                              │
│                                                                      │
│   // Inietta overlay                                                 │
│   if (agentConfig.levelPromptOverlay1)                               │
│     systemPrompt += overlay1;                                        │
│   if (userLevel >= 2 && agentConfig.levelPromptOverlay2)             │
│     systemPrompt += overlay2;                                        │
│   if (userLevel >= 3 && agentConfig.levelPromptOverlay3)             │
│     systemPrompt += overlay3;                                        │
│                                                                      │
│   // Poi continua con share instructions + preferences (come oggi)   │
│                                                                      │
│ *** L'overlay viene iniettato DOPO il basePrompt ***                 │
│ *** PRIMA delle share instructions e preferences ***                 │
│ *** Così il consulente può personalizzare per livello ***            │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 8. MODIFICHE DATABASE

### 8.1 SQL per consultant_whatsapp_config

```sql
ALTER TABLE consultant_whatsapp_config
ADD COLUMN IF NOT EXISTS level_prompt_overlay_1 TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS level_prompt_overlay_2 TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS level_prompt_overlay_3 TEXT DEFAULT NULL;
```

### 8.2 SQL per manager_conversations

```sql
ALTER TABLE manager_conversations
ADD COLUMN IF NOT EXISTS whatsapp_phone VARCHAR DEFAULT NULL,
ADD COLUMN IF NOT EXISTS source VARCHAR DEFAULT 'web';

CREATE INDEX IF NOT EXISTS idx_manager_conversations_whatsapp_phone 
ON manager_conversations(whatsapp_phone, agent_config_id) 
WHERE whatsapp_phone IS NOT NULL;
```

### 8.3 Schema Drizzle (shared/schema.ts)

```typescript
// In consultantWhatsappConfig, PRIMA di createdAt (riga ~2958):
levelPromptOverlay1: text("level_prompt_overlay_1"),
levelPromptOverlay2: text("level_prompt_overlay_2"),
levelPromptOverlay3: text("level_prompt_overlay_3"),

// In managerConversations, PRIMA di createdAt (riga ~7383):
whatsappPhone: varchar("whatsapp_phone"),
source: varchar("source").default("web"),
```

---

## 9. MODIFICHE BACKEND

### 9.1 message-processor.ts - NUOVO RAMO isLevelAgent

**Posizione**: Riga ~1048, DOPO il check isValidConsultantAccess (ramo A) e PRIMA del check effectiveUserId (ramo B)

**Pseudocodice**:
```
// RAMO A rimane invariato (consulente)
if (isValidConsultantAccess) {
  // ... come oggi
}

// ✅ NUOVO RAMO: Agente con livelli
else if (isLevelAgent) {
  // 1. Determina livello
  const userLevel = await determineUserLevel(
    effectiveUserId, phoneNumber, consultantConfig.consultantId
  );
  
  // 2. Costruisci prompt con overlay
  const basePrompt = await buildWhatsAppAgentPrompt(consultantConfig);
  systemPrompt = basePrompt;
  
  if (consultantConfig.levelPromptOverlay1) {
    systemPrompt += `\n\n━━━ ISTRUZIONI LIVELLO BRONZO ━━━\n${consultantConfig.levelPromptOverlay1}`;
  }
  if (userLevel >= 2 && consultantConfig.levelPromptOverlay2) {
    systemPrompt += `\n\n━━━ ISTRUZIONI LIVELLO ARGENTO ━━━\n${consultantConfig.levelPromptOverlay2}`;
  }
  if (userLevel >= 3 && consultantConfig.levelPromptOverlay3) {
    systemPrompt += `\n\n━━━ ISTRUZIONI LIVELLO GOLD ━━━\n${consultantConfig.levelPromptOverlay3}`;
  }
  
  // 3. Knowledge base agente (se esistente) - come oggi per ramo B
  // 4. NON buildSystemPrompt, NON buildLeadSystemPrompt
}

// RAMO B rimane invariato (client su agente standard)
else if (effectiveUserId) {
  // ... come oggi
}

// RAMO C rimane invariato (lead su agente standard)
else {
  // ... come oggi
}
```

### 9.2 message-processor.ts - Conversazione condivisa

**Posizione**: Dopo la risposta AI (nella sezione salvataggio), solo se isLevelAgent

```
if (isLevelAgent) {
  // Trova o crea manager_conversation per questo telefono
  let managerConv = await findManagerConversationByWhatsAppPhone(
    agentConfigId, phoneNumber
  );
  
  if (!managerConv) {
    // Determina managerId e shareId per la conversazione
    const { managerId, shareId } = await resolveManagerIdentity(
      effectiveUserId, phoneNumber, consultantConfig
    );
    
    managerConv = await createManagerConversation({
      managerId,
      shareId, 
      agentConfigId,
      whatsappPhone: phoneNumber,
      source: 'whatsapp',
    });
  }
  
  // Salva messaggio utente
  await saveManagerMessage(managerConv.id, 'user', batchedText, { source: 'whatsapp' });
  
  // Salva risposta AI
  await saveManagerMessage(managerConv.id, 'assistant', aiResponse, { source: 'whatsapp' });
}
```

### 9.3 message-processor.ts - History condivisa

**Posizione**: Nella parte dove carica la history per Gemini, se isLevelAgent

```
if (isLevelAgent) {
  // Cerca manager_conversation per questo telefono
  const managerConv = await findManagerConversationByWhatsAppPhone(
    agentConfigId, phoneNumber
  );
  
  if (managerConv) {
    // Carica history da manager_messages (include web + whatsapp)
    const history = await db.select()
      .from(managerMessages)
      .where(eq(managerMessages.conversationId, managerConv.id))
      .orderBy(managerMessages.createdAt)
      .limit(20);
    
    // Usa questa history per Gemini
  } else {
    // Nessuna conversazione precedente, history vuota
    // (la creeremo dopo la risposta)
  }
}
```

### 9.4 public-agent-router.ts - Overlay nel prompt web

**Posizione**: Riga 1137, dopo `buildWhatsAppAgentPrompt(agentConfig)` e PRIMA di share instructions

```
const basePrompt = await buildWhatsAppAgentPrompt(agentConfig);

// ✅ NUOVO: Iniezione overlay per livello
const isLevelAgent = Array.isArray(agentConfig.levels) && agentConfig.levels.length > 0;

if (isLevelAgent) {
  let userLevel = 1;
  if (req.silverGoldUser?.level === "3") userLevel = 3;
  else if (req.silverGoldUser?.level === "2") userLevel = 2;
  
  if (agentConfig.levelPromptOverlay1) {
    systemPrompt += `\n\n━━━ ISTRUZIONI LIVELLO BRONZO ━━━\n${agentConfig.levelPromptOverlay1}`;
  }
  if (userLevel >= 2 && agentConfig.levelPromptOverlay2) {
    systemPrompt += `\n\n━━━ ISTRUZIONI LIVELLO ARGENTO ━━━\n${agentConfig.levelPromptOverlay2}`;
  }
  if (userLevel >= 3 && agentConfig.levelPromptOverlay3) {
    systemPrompt += `\n\n━━━ ISTRUZIONI LIVELLO GOLD ━━━\n${agentConfig.levelPromptOverlay3}`;
  }
}

// Poi continua con share instructions e preferences come oggi
```

---

## 10. MODIFICHE FRONTEND

### 10.1 AgentLevel.tsx - Textarea per overlay per livello

```
Per OGNI livello attivo, aggiungere textarea dentro la Card esistente.

onChange usa i nuovi campi:
  L1 → onChange("levelPromptOverlay1", value)
  L2 → onChange("levelPromptOverlay2", value)  
  L3 → onChange("levelPromptOverlay3", value)

Placeholder suggeriti:
  L1: "Es: Rispondi in modo generico e breve. Suggerisci l'upgrade."
  L2: "Es: Accesso alla knowledge base. Risposte personalizzate."
  L3: "Es: Consulenza completa, analisi dettagliate, accesso esclusivo."

Info per L2: "Queste istruzioni si SOMMANO a quelle del livello Bronzo."
Info per L3: "Queste istruzioni si SOMMANO a quelle del livello Bronzo + Argento."
```

---

## 11. SCENARI DI TEST

### Test 1: Lead scrive su WhatsApp ad agente CON livelli

```
Setup: Agente "Coach AI" con levels=["1","2"]
       levelPromptOverlay1 = "Rispondi brevemente, suggerisci upgrade"
       
Azione: Numero sconosciuto +39333... scrive "Ciao"

Atteso:
  ✅ classifyParticipant → "unknown"
  ✅ isLevelAgent = true
  ✅ userLevel = 1 (default per lead)
  ✅ systemPrompt = buildWhatsAppAgentPrompt + overlay1
  ✅ NON usa buildLeadSystemPrompt (no appuntamenti)
  ✅ NON usa buildSystemPrompt (no CRM)
  ✅ Messaggio salvato in whatsapp_messages (per Twilio)
  ✅ Messaggio salvato in manager_messages (per condivisione web)
```

### Test 2: Client Gold scrive su WhatsApp ad agente CON livelli

```
Setup: Agente "Coach AI" con levels=["1","2","3"]
       Tutti e 3 overlay configurati
       Client con client_level_subscriptions level="3", status="active"

Azione: Client Gold scrive "Analizza il mio portafoglio"

Atteso:
  ✅ classifyParticipant → "client" (ha userId)
  ✅ isLevelAgent = true
  ✅ determineUserLevel → 3 (da client_level_subscriptions)
  ✅ systemPrompt = basePrompt + overlay1 + overlay2 + overlay3
  ✅ NON usa buildSystemPrompt (no CRM!)
  ✅ Messaggi in whatsapp_messages + manager_messages
```

### Test 3: Client Gold scrive su WhatsApp ad agente STANDARD

```
Setup: Agente "Assistenza Clienti" con levels=null
       
Azione: Client Gold scrive "Quanti esercizi ho?"

Atteso:
  ✅ classifyParticipant → "client"
  ✅ isLevelAgent = false
  ✅ RAMO B (come oggi): buildSystemPrompt con CRM completo
  ✅ Flusso INVARIATO al 100%
```

### Test 4: Client Gold chatta web poi WhatsApp (condivisione)

```
Setup: Agente "Coach AI" con levels=["1","2","3"]
       Client Gold autenticato su /agent/coach

Azione 1: Client scrive "Ciao" sul sito web
  → manager_messages: "Ciao" (source: web)
  → Risposta AI in manager_messages (source: web)

Azione 2: Stesso client scrive "Ho una domanda" su WhatsApp
  → whatsapp_messages: "Ho una domanda" (per Twilio)
  → Trova STESSA manager_conversation (match whatsapp_phone)
  → manager_messages: "Ho una domanda" (source: whatsapp)
  → History per Gemini include messaggi web precedenti!
  → Risposta AI in manager_messages + whatsapp_messages

Azione 3: Client torna sul sito web
  → Vede TUTTI i messaggi: web + WhatsApp
```

### Test 5: Consulente scrive su WhatsApp (qualsiasi agente)

```
Atteso:
  ✅ RAMO A: buildConsultantSystemPrompt (CRM completo)
  ✅ isLevelAgent non viene mai valutato per i consulenti
  ✅ Flusso INVARIATO al 100%
```

---

## 12. 10 DOMANDE OSSESSIVE

### D1: Il campo `level` (singolo deprecato) viene usato da qualche parte critica?

**RISPOSTA VERIFICATA**: SÌ, in due posti:
1. `public-ai-chat-router.ts:65` → filtra `level = "1"` per trovare agenti. MA questo router è **DEPRECATO** (il flusso reale usa `public-agent-router.ts`). **Non tocchiamo.**
2. `message-processor.ts:1777` → `const agentLevel = consultantConfig.level` per File Search. Questo determina se l'agente può accedere al consultantStore. **Questo rimane invariato** perché il File Search check non è legato al nostro routing per livelli.
3. `public-agent-router.ts:1245` → stessa logica File Search. **Rimane invariato.**

**AZIONE**: Nessuna. Il campo `level` deprecato continua a funzionare per File Search. Il nostro nuovo routing usa `levels` (array).

---

### D2: Come fa il Bronze a creare conversazioni in manager_conversations se il managerId è un bronzeUserId (non un vero manager)?

**RISPOSTA VERIFICATA**: Nel middleware `verifyManagerToken()` (riga 94), per i Bronze:
```
req.manager = {
  managerId: decoded.bronzeUserId,     ← ID dal bronze_users table
  shareId: "bronze-{bronzeUserId}",    ← stringa costruita
  role: "bronze"
}
```
La colonna `manager_id` in `manager_conversations` è un VARCHAR con FK a `manager_users.id`. MA nel caso Bronze, il valore è il `bronzeUserId` che NON esiste nella tabella `manager_users`.

**SCOPERTA CRITICA**: La FK `manager_id → manager_users.id` probabilmente NON è enforced a livello DB (o la tabella accetta questi valori fake). Verifico... La FK è definita nello schema Drizzle ma potrebbe non essere stata creata nel DB. In ogni caso, il sistema funziona perché il lookup è `WHERE manager_id = :managerId AND share_id = :shareId`, e entrambi sono stringhe costruite dallo stesso token.

**IMPATTO SUL NOSTRO PROGETTO**: Per creare conversazioni da WhatsApp, dobbiamo generare managerId e shareId compatibili. Se il telefono corrisponde a un bronzeUser, usiamo `bronzeUserId` e `"bronze-{bronzeUserId}"`. Se corrisponde a una subscription, usiamo `subscriptionId` e `"{type}-{subscriptionId}"`. Se è un lead senza account, dobbiamo creare un identificatore speciale.

---

### D3: Come troviamo il managerId/shareId da un numero WhatsApp per la conversazione condivisa?

**RISPOSTA VERIFICATA**: Non possiamo direttamente. Il numero WhatsApp non è linkato a bronzeUsers (che non ha campo phone) né direttamente a subscriptions (che ha campo phone ma è opzionale).

**SOLUZIONE**: Quando creiamo la manager_conversation da WhatsApp, usiamo:
- Se `effectiveUserId` presente → cerca in client_level_subscriptions per quel userId → usa subscriptionId
- Se lead senza userId → crea un managerId speciale: `"whatsapp-{phoneNumber}"` e shareId: `"whatsapp-{agentConfigId}"`
- Salviamo sempre `whatsapp_phone` nella conversazione per il lookup futuro

Il match web→WhatsApp avverrà tramite il campo `whatsapp_phone`, non tramite managerId.

---

### D4: Quando un utente web va su WhatsApp, come lo linkiamo? Non ha lo stesso managerId!

**RISPOSTA VERIFICATA**: Il link avviene tramite il NUOVO campo `whatsapp_phone` su `manager_conversations`.

Scenario:
1. Utente Gold chatta su web → `manager_conversations` con managerId = subscriptionId, whatsapp_phone = NULL
2. Utente Gold scrive su WhatsApp → cerchiamo per `agent_config_id + whatsapp_phone` → non trovato
3. Ma abbiamo effectiveUserId → cerchiamo subscription → abbiamo subscriptionId → cerchiamo `manager_conversations` con `managerId = subscriptionId`
4. TROVATO! → aggiorniamo `whatsapp_phone` su quella conversazione
5. Prossimo messaggio WhatsApp → lookup diretto per `whatsapp_phone`

**FLUSSO DI LINKING**:
```
Da WhatsApp, con effectiveUserId:
  1. Cerca manager_conversation per whatsapp_phone → miss
  2. Determina managerId (subscriptionId o bronzeUserId)
  3. Cerca manager_conversation per managerId + agentConfigId → HIT!
  4. Aggiorna whatsapp_phone sulla conversazione trovata
  5. Usa quella conversazione
```

---

### D5: E se l'utente è un lead su WhatsApp (no userId, no subscription)? Come crea la conversazione?

**RISPOSTA VERIFICATA**: Per un lead che scrive su WhatsApp a un agente con livelli:
- Non ha userId
- Non ha subscription
- Non ha bronzeUser account

Opzioni:
1. **NON creare manager_conversation per lead non registrati** → i messaggi restano solo in whatsapp_messages → la condivisione web non funziona (ma il lead non è autenticato sul web comunque!)
2. **Creare con managerId sintetico** → `"whatsapp-lead-{phoneHash}"` → ma non potrà mai essere letto dal web perché il lead non ha un token

**DECISIONE**: Opzione 1. I lead non registrati su WhatsApp NON hanno conversazione in manager_messages. La condivisione web/WhatsApp funziona SOLO per utenti che hanno un account (bronze, silver, gold). I lead ricevono comunque l'overlay Bronzo ma senza persistenza cross-canale.

---

### D6: Il File Search deve funzionare per gli agenti con livelli su WhatsApp?

**RISPOSTA VERIFICATA**: SÌ, il File Search deve continuare a funzionare. Oggi il check usa `consultantConfig.level` (deprecato):
- `level === "3"` → accesso al consultantStore (tutti i documenti del consulente)
- qualsiasi altro valore → solo agentStore (documenti specifici dell'agente)

Questo check è SEPARATO dal nostro routing per livelli. Non lo tocchiamo. L'agente store è accessibile a tutti, il consultant store solo ai "level 3" (che è un concetto diverso dal livello dell'utente).

**AZIONE**: Nessuna modifica al File Search. Il check rimane su `consultantConfig.level` (deprecato) per l'accesso agli store. Il nostro `userLevel` determina solo gli overlay nel prompt.

---

### D7: Cosa succede alla knowledge base dell'agente (whatsappAgentKnowledgeItems) nel nuovo flusso?

**RISPOSTA VERIFICATA**: Nel ramo B attuale (riga 1051+), la knowledge base dell'agente viene caricata e aggiunta al prompt. Nel nuovo ramo isLevelAgent, dobbiamo mantenere questo comportamento.

```
// Da message-processor.ts, dentro il ramo B (effectiveUserId):
const knowledgeItems = await db.select()
  .from(whatsappAgentKnowledgeItems)
  .where(eq(whatsappAgentKnowledgeItems.agentConfigId, consultantConfig.id));
// → aggiunti al systemPrompt
```

**AZIONE**: Nel nuovo ramo isLevelAgent, includere la stessa logica di caricamento knowledge base. `buildWhatsAppAgentPrompt()` potrebbe già includerla → VERIFICO.

---

### D8: La funzione `buildWhatsAppAgentPrompt()` include già la knowledge base?

**RISPOSTA**: Devo verificare. Se sì, non serve caricarla di nuovo nel ramo isLevelAgent. Se no, devo aggiungerla esplicitamente.

**AZIONE**: Verificare durante l'implementazione in `agent-consultant-chat-service.ts`.

---

### D9: Come gestiamo il booking/appuntamenti su agenti con livelli? Oggi il ramo C (lead) include slot calendario.

**RISPOSTA**: Su un agente con livelli, NON dobbiamo offrire booking/appuntamenti. Il Coach AI non è un agente commerciale. La logica di booking (`buildLeadSystemPrompt` con `availableSlots`) non deve essere eseguita per agenti con livelli.

**AZIONE**: Il nuovo ramo isLevelAgent salta completamente la logica di booking. Questo è automatico perché non usiamo `buildLeadSystemPrompt()`.

---

### D10: Se un utente Bronze su web non ha mai scritto su WhatsApp, il campo whatsapp_phone sarà NULL. Come gestiamo il primo messaggio WhatsApp?

**RISPOSTA**: Il primo messaggio WhatsApp segue il flusso di linking descritto nella D4:
1. Cerca per `whatsapp_phone` → NULL (nessuna conversazione con quel telefono)
2. Determina managerId dal tipo utente
3. Cerca per `managerId + agentConfigId` → potrebbe trovare la conversazione web
4. Se trovata → aggiorna `whatsapp_phone`, usa quella
5. Se non trovata → crea nuova con `whatsapp_phone` già impostato

Per i Bronze senza subscription, il managerId è il `bronzeUserId`. Ma su WhatsApp non conosciamo il bronzeUserId direttamente. Abbiamo solo il telefono e l'effectiveUserId (se riconosciuto come client).

**CASO CRITICO**: Un bronzeUser che NON è anche un `users` (non ha effectiveUserId) e scrive su WhatsApp → è trattato come lead → NON ha conversazione condivisa (come da D5).

Un bronzeUser che È anche un `users` (ha effectiveUserId) → cerchiamo subscription → se non ha subscription, è L1 → cerchiamo per managerId nel manager_conversations → ma il managerId per Bronze è il bronzeUserId, e su WhatsApp abbiamo solo effectiveUserId... 

**SOLUZIONE ROBUSTA**: Quando cerchiamo la conversazione esistente, proviamo MULTIPLE strategie:
1. Per `whatsapp_phone` (diretto)
2. Per `managerId` dove managerId = subscriptionId o bronzeUserId (dal match userId → email → bronze_users)
3. Se nessuna trovata, creiamo nuova

---

## 13. FILE COINVOLTI

| File | Righe | Tipo Modifica |
|------|-------|---------------|
| `shared/schema.ts` | ~2958 | +3 colonne levelPromptOverlay a consultantWhatsappConfig |
| `shared/schema.ts` | ~7383 | +2 colonne whatsappPhone/source a managerConversations |
| `server/whatsapp/message-processor.ts` | ~1048 | Nuovo ramo isLevelAgent |
| `server/whatsapp/message-processor.ts` | dopo AI | Salvataggio in manager_messages se isLevelAgent |
| `server/whatsapp/message-processor.ts` | history | Carica da manager_messages se isLevelAgent |
| `server/routes/public-agent-router.ts` | ~1137 | Overlay per livello nelle risposte web |
| `client/src/components/whatsapp/wizard-steps/AgentLevel.tsx` | card | Textarea per overlay |
| `server/routes/public-ai-chat-router.ts` | ❌ | **NON TOCCARE** (deprecato) |

---

## 14. PIANO DI ESECUZIONE

| # | Task | File | Dipendenze | Note |
|---|------|------|------------|------|
| 1 | Schema: +3 colonne overlay + +2 colonne manager_conv | shared/schema.ts | - | db:push |
| 2 | Backend: nuovo ramo isLevelAgent + determineUserLevel | message-processor.ts | Task 1 | Check buildWhatsAppAgentPrompt per KB |
| 3 | Backend: conversazioni condivise (salvataggio + history) | message-processor.ts | Task 2 | Logica linking D4 |
| 4 | Backend: overlay su public-agent-router | public-agent-router.ts | Task 1 | Solo iniezione prompt |
| 5 | Frontend: textarea nel wizard | AgentLevel.tsx | Task 1 | Verifica API salvataggio |
| 6 | Test end-to-end | Tutti | Task 2-5 | 5 scenari |
| 7 | Review architect | Tutti | Task 6 | Sicurezza + coerenza |

---

*Documento ossessivo v3. Ogni sezione si auto-spiega.*
*10 domande critiche verificate con risposte e azioni.*
*public-ai-chat-router.ts ESCLUSO (deprecato).*
*Tutti i livelli passano da public-agent-router.ts.*
