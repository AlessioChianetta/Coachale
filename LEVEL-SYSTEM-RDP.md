# RDP - Sistema Comportamento AI per Livelli Agente WhatsApp
## Documento di Progetto Completo - Versione Ossessiva

---

## INDICE

| # | Sezione | Descrizione |
|---|---------|-------------|
| 1 | [Contesto e Obiettivo](#1-contesto-e-obiettivo) | Perché esiste questo documento |
| 2 | [Glossario Tecnico](#2-glossario-tecnico) | Definizioni precise di ogni termine |
| 3 | [Mappa Tabelle Database Coinvolte](#3-mappa-tabelle-database-coinvolte) | Ogni tabella, colonna, relazione |
| 4 | [Stato Attuale - Flusso WhatsApp](#4-stato-attuale---flusso-whatsapp) | Come funziona OGGI passo per passo |
| 5 | [Stato Attuale - Flusso Web](#5-stato-attuale---flusso-web) | Come funziona OGGI la pagina agente |
| 6 | [Problemi Identificati](#6-problemi-identificati) | Cosa non va e perché |
| 7 | [Architettura Target](#7-architettura-target) | Come deve funzionare DOPO |
| 8 | [Modifiche Database](#8-modifiche-database) | SQL esatto e schema Drizzle |
| 9 | [Modifiche Backend](#9-modifiche-backend) | Ogni file, riga, logica |
| 10 | [Modifiche Frontend](#10-modifiche-frontend) | Layout, componenti, UX |
| 11 | [Scenari di Test](#11-scenari-di-test) | Ogni caso possibile |
| 12 | [File Coinvolti](#12-file-coinvolti) | Indice completo file/righe |
| 13 | [Piano di Esecuzione](#13-piano-di-esecuzione) | Ordine esatto delle task |

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
| **Livello 1 / Bronzo** | Accesso pubblico gratuito con limite messaggi. Utente = lead o `bronze_users` | `bronze_users` tabella |
| **Livello 2 / Argento** | Accesso a pagamento con knowledge base. Utente = `client_level_subscriptions` con level="2" | `client_level_subscriptions.level = "2"` |
| **Livello 3 / Gold** | Accesso completo con File Search. Utente = `client_level_subscriptions` con level="3" | `client_level_subscriptions.level = "3"` |
| **Level Overlay** | Blocco di istruzioni aggiuntive che il consulente scrive per ogni livello. Si SOMMA al prompt base | Nuovo campo `level_prompt_overlay_1/2/3` |
| **classifyParticipant()** | Funzione che identifica chi sta scrivendo su WhatsApp (consultant/client/unknown) | `webhook-handler.ts:523` |
| **buildWhatsAppAgentPrompt()** | Costruisce il prompt base dell'agente (usato dalla pagina web) | `agent-consultant-chat-service.ts` |
| **buildSystemPrompt()** | Costruisce il prompt completo con dati CRM del cliente | `ai-prompts.ts` |
| **buildLeadSystemPrompt()** | Costruisce il prompt per lead con gestione appuntamenti | `message-processor.ts:4435` |
| **managerConversations** | Tabella conversazioni per utenti autenticati sulla pagina web dell'agente | `shared/schema.ts:7366` |
| **managerMessages** | Tabella messaggi dentro le conversazioni manager | `shared/schema.ts:7395` |
| **whatsappConversations** | Tabella conversazioni WhatsApp (via Twilio) | `shared/schema.ts` |
| **whatsappMessages** | Tabella messaggi WhatsApp | `shared/schema.ts` |

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
│ ─── LIVELLI (ESISTENTI) ────────────────────────────────────────────│
│ level                 TEXT ("1"|"2"|"3"|null) [DEPRECATED]           │
│ levels                TEXT[] (["1"], ["2"], ["1","2"]) [ATTIVO]      │
│ public_slug           TEXT UNIQUE (es: "silvia" → /ai/silvia)        │
│ daily_message_limit   INTEGER (default 15)                           │
│ ...                                                                  │
│ ─── NUOVI CAMPI DA AGGIUNGERE ──────────────────────────────────────│
│ level_prompt_overlay_1  TEXT NULL  ← istruzioni Bronzo               │
│ level_prompt_overlay_2  TEXT NULL  ← istruzioni aggiuntive Argento   │
│ level_prompt_overlay_3  TEXT NULL  ← istruzioni aggiuntive Gold      │
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
│ WHERE client_id = :userId                                            │
│   AND consultant_id = :consultantId                                  │
│   AND status = 'active'                                              │
│ LIMIT 1                                                              │
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
│ ...                                                                  │
├──────────────────────────────────────────────────────────────────────┤
│ UNIQUE(consultant_id, email)                                         │
└──────────────────────────────────────────────────────────────────────┘
```

### 3.4 manager_conversations + manager_messages (Chat Web)

```
┌──────────────────────────────────────────────────────────────────────┐
│ manager_conversations                                                │
├──────────────────────────────────────────────────────────────────────┤
│ id                    VARCHAR PK (UUID)                              │
│ manager_id            VARCHAR FK → manager_users.id (NOT NULL)       │
│ share_id              VARCHAR FK → whatsapp_agent_shares.id (NOT NULL)│
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
└──────────────────────────────────────────────────────────────────────┘
```

### 3.5 Relazioni tra tabelle

```
  consultant_whatsapp_config
           │
           │ 1:N
           ▼
  whatsapp_agent_shares ──────────► manager_link_assignments
           │                                    │
           │ 1:N                                │ N:1
           ▼                                    ▼
  manager_conversations ◄────────── manager_users
           │
           │ 1:N
           ▼
  manager_messages

  users ─────────► client_level_subscriptions
    │                      │
    │                      │ level = "2"|"3"|"4"
    │                      │ consultant_id = FK
    │
    └────────────► bronze_users
                          │ consultant_id = FK

  whatsapp_conversations ──────── whatsapp_messages
  (tabella separata, NON collegata a manager_*)
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
│ ┌─ 1. normalizedPhone === "+393500220129"?                           │
│ │     → return { type: "receptionist" }                              │
│ │                                                                    │
│ ├─ 2. SELECT * FROM users WHERE phone_number = :phone                │
│ │     → Trova user con quel telefono?                                │
│ │     │                                                              │
│ │     ├─ user.role="consultant" AND user.id === consultantId?        │
│ │     │   → return { type: "consultant", userId: user.id }           │
│ │     │                                                              │
│ │     ├─ user.consultant_id === consultantId?                        │
│ │     │   → return { type: "client", userId: user.id }               │
│ │     │   *** QUESTO MATCH AVVIENE PER QUALSIASI AGENTE ***         │
│ │     │   *** NON CONTROLLA SE L'AGENTE HA LIVELLI ***              │
│ │     │                                                              │
│ │     └─ user esiste ma diverso consulente?                          │
│ │         → SICUREZZA: tratta come lead (cross-tenant prevention)    │
│ │                                                                    │
│ ├─ 3. Email match da proactive lead?                                 │
│ │     → return { type: "client", userId: user.id }                   │
│ │                                                                    │
│ └─ 4. Nessun match                                                   │
│       → return { type: "unknown", userId: null }                     │
│                                                                      │
│ *** PROBLEMA: Non distingue agente standard da agente con livelli ***│
└──────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────────┐
│ STEP 3: getOrCreateConversation()                                    │
│ File: server/whatsapp/webhook-handler.ts riga 693                    │
│                                                                      │
│ Cerca conversazione esistente per:                                   │
│   phone + consultantId + agentConfigId                               │
│                                                                      │
│ Se non esiste, CREA con:                                             │
│   userId = participant.userId (o null se lead)                       │
│   isLead = (type === "unknown")                                      │
│   agentConfigId = agentConfigId                                      │
│   metadata.participantType = participant.type                        │
│                                                                      │
│ La conversazione viene salvata in whatsapp_conversations             │
└──────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────────┐
│ STEP 4: scheduleMessageProcessing()                                  │
│ File: server/whatsapp/message-processor.ts                           │
│                                                                      │
│ Aspetta batching di messaggi multipli (1-2 sec)                      │
│ Poi chiama processConversation()                                     │
└──────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────────┐
│ STEP 5: processConversation() - Routing del Prompt                   │
│ File: server/whatsapp/message-processor.ts riga 970+                 │
│                                                                      │
│ participantType = conversation.metadata.participantType              │
│ effectiveUserId = conversation.userId                                │
│                                                                      │
│ ┌─────────────────────────────────────────────────────────────┐      │
│ │ RAMO A: isValidConsultantAccess = TRUE                      │      │
│ │ (participantType === "consultant")                          │      │
│ │                                                             │      │
│ │ → buildConsultantContext(consultantId)                       │      │
│ │ → buildConsultantSystemPrompt(consultantContext)             │      │
│ │ → Accesso CRM COMPLETO                                      │      │
│ │ File: consultant-context-builder.ts + ai-service.ts         │      │
│ └─────────────────────────────────────────────────────────────┘      │
│                                                                      │
│ ┌─────────────────────────────────────────────────────────────┐      │
│ │ RAMO B: effectiveUserId PRESENTE                            │      │
│ │ (participantType === "client")                              │      │
│ │                                                             │      │
│ │ → buildUserContext(effectiveUserId)                          │      │
│ │ → buildSystemPrompt("assistenza", "finanziario", userCtx)   │      │
│ │ → Accesso dati CRM del CLIENTE specifico                    │      │
│ │ → + Knowledge base agente (whatsappAgentKnowledgeItems)     │      │
│ │ → + Customer Support mode (se whatsappConciseMode=true)     │      │
│ │ File: ai-prompts.ts + ai-context-builder.ts                 │      │
│ │                                                             │      │
│ │ *** QUESTO RAMO SI ATTIVA PER QUALSIASI AGENTE ***         │      │
│ │ *** SE L'AGENTE HA LIVELLI, IL CLIENT RICEVE COMUNQUE ***  │      │
│ │ *** ACCESSO CRM COMPLETO - QUESTO È IL PROBLEMA ***        │      │
│ └─────────────────────────────────────────────────────────────┘      │
│                                                                      │
│ ┌─────────────────────────────────────────────────────────────┐      │
│ │ RAMO C: NESSUNO (lead)                                      │      │
│ │ (effectiveUserId null, isLead=true)                         │      │
│ │                                                             │      │
│ │ → buildLeadSystemPrompt(consultantConfig, ...)              │      │
│ │ → Gestione appuntamenti, slot calendario                    │      │
│ │ → Persuasione, conversione                                  │      │
│ │ File: message-processor.ts:4435                             │      │
│ └─────────────────────────────────────────────────────────────┘      │
└──────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────────┐
│ STEP 6: File Search Check (riga 1777)                                │
│                                                                      │
│ agentLevel = consultantConfig.level  // "1","2","3",null             │
│ canAccessConsultantStore = (agentLevel === "3")                       │
│                                                                      │
│ Se effectiveUserId:                                                  │
│   → Controlla se è client del consulente                             │
│   → Se sì: clientIsGold = true, canAccessConsultantStore = true      │
│   → File Search ATTIVO per tutti i client riconosciuti               │
│                                                                      │
│ *** Il livello dell'agente influenza SOLO il File Search ***         │
│ *** Non influenza il system prompt usato ***                         │
└──────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────────┐
│ STEP 7: Chiamata Gemini API                                          │
│                                                                      │
│ → Vertex AI (primario) o Google AI Studio (fallback)                 │
│ → systemInstruction: systemPrompt (costruito in Step 5)              │
│ → contents: conversation history + user message                      │
│ → Risposta salvata in whatsapp_messages                              │
│ → Inviata via Twilio WhatsApp                                        │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 5. STATO ATTUALE - FLUSSO WEB

### 5.1 Livello 1 (Bronzo) - Pagina Pubblica

```
╔══════════════════════════════════════════════════════════════════════╗
║  UTENTE VISITA /ai/{slug} (es: /ai/silvia)                          ║
╚══════════════════════════════════════════════════════════════════════╝
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────────┐
│ FRONTEND: client/src/pages/public-ai-chat.tsx                        │
│                                                                      │
│ → GET /api/public/ai/{slug}/info                                     │
│   → Mostra nome agente, limite messaggi                              │
│                                                                      │
│ → Conversazione in localStorage (key: public_ai_chat_{slug}_{date})  │
│   *** SI PERDE AL CAMBIO BROWSER/GIORNO ***                         │
│                                                                      │
│ → POST /api/public/ai/{slug}/chat                                    │
│   Body: { message, conversationHistory }                             │
│   (history dal localStorage!)                                        │
└──────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────────┐
│ BACKEND: server/routes/public-ai-chat-router.ts                      │
│                                                                      │
│ 1. Cerca agente: level="1", publicSlug=slug, isActive=true           │
│ 2. Rate limit per IP (tabella public_chat_rate_limits)               │
│ 3. systemPrompt = await buildWhatsAppAgentPrompt(agent)              │
│    *** NESSUN OVERLAY PER LIVELLO ***                                │
│ 4. Chiama Gemini con history dal client                              │
│ 5. Risponde con { response, remainingMessages }                      │
│                                                                      │
│ *** NESSUNA PERSISTENZA SERVER-SIDE DEI MESSAGGI ***                │
│ *** NESSUNA CONDIVISIONE CON WHATSAPP ***                           │
└──────────────────────────────────────────────────────────────────────┘
```

### 5.2 Livello 2/3 (Argento/Gold) - Pagina Autenticata

```
╔══════════════════════════════════════════════════════════════════════╗
║  UTENTE AUTENTICATO APRE PAGINA AGENTE                              ║
║  (via manager_users + whatsapp_agent_shares JWT)                    ║
╚══════════════════════════════════════════════════════════════════════╝
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────────┐
│ BACKEND: server/routes/public-agent-router.ts                        │
│                                                                      │
│ Autenticazione:                                                      │
│   → JWT contiene: managerId, consultantId, shareId, role             │
│   → role può essere: "bronze", "silver", "gold", "manager"          │
│   → Verifica: managerUsers + managerLinkAssignments + shares         │
│                                                                      │
│ Conversazioni:                                                       │
│   → GET: lista da manager_conversations (per managerId + shareId)    │
│   → POST: crea nuova conversazione in manager_conversations          │
│                                                                      │
│ Invio Messaggio (riga 1080+):                                        │
│   1. Salva messaggio utente in manager_messages                      │
│   2. Carica history da manager_messages (ultimi 20)                  │
│   3. basePrompt = await buildWhatsAppAgentPrompt(agentConfig)        │
│   4. Se share ha agentInstructions → aggiunge al prompt              │
│   5. Se preferences (writingStyle, responseLength) → aggiunge        │
│   6. Chiama Gemini                                                   │
│   7. Salva risposta in manager_messages                              │
│                                                                      │
│ *** NESSUN OVERLAY PER LIVELLO ***                                  │
│ *** MESSAGGI IN manager_messages, NON in whatsapp_messages ***      │
│ *** NESSUNA CONDIVISIONE CON WHATSAPP ***                           │
└──────────────────────────────────────────────────────────────────────┘
```

### 5.3 Riepilogo Storage Conversazioni OGGI

```
┌─────────────────────────────────────────────────────────────────────┐
│                    DOVE VENGONO SALVATI I MESSAGGI                   │
├──────────────┬──────────────────────┬───────────────────────────────┤
│ Canale       │ Tabella              │ Condiviso?                    │
├──────────────┼──────────────────────┼───────────────────────────────┤
│ WhatsApp     │ whatsapp_messages    │ ╳ NO - isolato               │
│ Web L1       │ localStorage         │ ╳ NO - si perde              │
│ Web L2/L3    │ manager_messages     │ ╳ NO - isolato               │
│ AI Assistant │ (altro sistema)      │ ╳ NO - separato              │
├──────────────┴──────────────────────┴───────────────────────────────┤
│ Un utente che chatta web e WhatsApp ha DUE conversazioni separate   │
│ con lo STESSO agente. NON si sovrappongono.                         │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 6. PROBLEMI IDENTIFICATI

### P1: Nessuna differenziazione AI per livello

```
OGGI:
  Utente Bronzo scrive "Ciao" → AI risponde con prompt X
  Utente Gold scrive "Ciao"   → AI risponde con prompt X (IDENTICO!)
  
  La UNICA differenza è File Search (Gold accede ai documenti).
  Ma le istruzioni dell'AI, il tono, la profondità = UGUALI.

DOPO:
  Utente Bronzo → prompt X + overlay Bronzo
                  "Rispondi in modo generico, suggerisci upgrade"
  Utente Argento → prompt X + overlay Bronzo + overlay Argento
                   "Accesso KB, risposte personalizzate"
  Utente Gold → prompt X + overlay Bronzo + overlay Argento + overlay Gold
                "Analisi approfondite, consulenza completa"
```

### P2: Client riconosciuto = sempre accesso CRM (indiscriminato)

```
OGGI - Scenario problematico:

  Cliente Gold scrive su WhatsApp al "Coach AI" (agente CON livelli)
       │
       ▼
  classifyParticipant() → type: "client" (perché ha userId)
       │
       ▼
  message-processor.ts → effectiveUserId PRESENTE
       │
       ▼
  RAMO B: buildSystemPrompt("assistenza", "finanziario", userContext)
       │
       ▼
  *** L'AI accede a TUTTI i dati CRM del cliente ***
  *** Esercizi, appuntamenti, stato finanziario ***
  *** Come se fosse l'ASSISTENZA CLIENTI ***
  *** MA l'agente è il COACH AI - non dovrebbe avere CRM! ***

DOPO:
  Se l'agente ha levels = ["1","2","3"] → NON usare buildSystemPrompt
  Usare buildWhatsAppAgentPrompt + overlay Gold
  Il Coach AI non ha accesso CRM, ha le sue istruzioni specifiche
```

### P3: Conversazioni web/WhatsApp non condivise

```
OGGI:
  Mario chatta con "Coach AI" sul sito web:
    → manager_messages: "Ciao" / "Ciao Mario, come posso aiutarti?"
    
  Mario scrive su WhatsApp allo STESSO "Coach AI":
    → whatsapp_messages: "Ciao" / "Benvenuto! Come posso aiutarti?"
    
  *** Due conversazioni SEPARATE con lo STESSO agente ***
  *** L'AI del WhatsApp non sa cosa si sono detti sul sito ***
  *** L'AI del sito non sa cosa si sono detti su WhatsApp ***

DOPO:
  Mario chatta con "Coach AI" (web O WhatsApp):
    → STESSA conversazione in manager_conversations/manager_messages
    → Se scrive sul web, vede anche i messaggi WhatsApp
    → Se scrive su WhatsApp, l'AI ha il contesto del web
```

### P4: Livello 1 web usa localStorage

```
OGGI:
  Lead visita /ai/silvia e chatta 5 messaggi
  Chiude il browser
  Riapre → conversazione PERSA (localStorage)
  
  Non c'è nessun tracking server-side per L1

DOPO (fase futura, non in questo RDP):
  Possibilità di persistere anche L1 se registrato come bronze_user
```

---

## 7. ARCHITETTURA TARGET

### 7.1 Nuovo Flusso Decisionale WhatsApp - COMPLETO

```
╔══════════════════════════════════════════════════════════════════════╗
║  MESSAGGIO WHATSAPP ARRIVA DA +39XXX...                             ║
╚══════════════════════════════════════════════════════════════════════╝
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────────┐
│ STEP 1-4: Invariati (webhook, classifyParticipant, conversazione)    │
│ Il riconoscimento utente avviene come oggi.                          │
│ La differenza è nel Step 5.                                          │
└──────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────────┐
│ STEP 5: NUOVO ROUTING CONDIZIONALE                                   │
│ File: server/whatsapp/message-processor.ts                           │
│                                                                      │
│ // Prima di costruire il prompt, controlliamo                        │
│ const isLevelAgent = Array.isArray(consultantConfig?.levels)          │
│   && consultantConfig.levels.length > 0;                             │
│                                                                      │
│ ┌──────────────────────────────────────────────┐                     │
│ │ isLevelAgent?                                │                     │
│ └──────────┬──────────────────┬────────────────┘                     │
│            │                  │                                      │
│           NO                 YES                                     │
│            │                  │                                      │
│            ▼                  ▼                                      │
│    ┌───────────────┐  ┌──────────────────────────────────┐           │
│    │ FLUSSO        │  │ NUOVO FLUSSO PER LIVELLI         │           │
│    │ ATTUALE       │  │                                  │           │
│    │ (invariato)   │  │ 1. Determina livello utente      │           │
│    │               │  │ 2. buildWhatsAppAgentPrompt()    │           │
│    │ Rami A/B/C    │  │ 3. + overlay additivi            │           │
│    │ come oggi     │  │ 4. Conversazione condivisa       │           │
│    └───────────────┘  └──────────────────────────────────┘           │
└──────────────────────────────────────────────────────────────────────┘
```

### 7.2 Determinazione Livello Utente (dentro il nuovo flusso)

```
┌──────────────────────────────────────────────────────────────────────┐
│ DETERMINAZIONE LIVELLO UTENTE                                        │
│                                                                      │
│ Input: effectiveUserId, consultantConfig.consultantId                │
│ Output: userLevel (1, 2, o 3)                                       │
│                                                                      │
│ effectiveUserId presente?                                            │
│ ├── SÌ                                                              │
│ │    │                                                              │
│ │    ▼                                                              │
│ │    SELECT level FROM client_level_subscriptions                    │
│ │    WHERE (client_id = :effectiveUserId                             │
│ │           OR client_email = (SELECT email FROM users               │
│ │                              WHERE id = :effectiveUserId))         │
│ │      AND consultant_id = :consultantConfig.consultantId            │
│ │      AND status = 'active'                                         │
│ │    LIMIT 1                                                         │
│ │    │                                                              │
│ │    ├── level = "3" → userLevel = 3 (GOLD)                         │
│ │    ├── level = "2" → userLevel = 2 (ARGENTO)                      │
│ │    └── non trovato → userLevel = 1 (BRONZO di default)             │
│ │                                                                    │
│ └── NO (lead senza userId)                                           │
│      │                                                              │
│      ▼                                                              │
│      userLevel = 1 (BRONZO di default per tutti i lead)              │
│                                                                      │
│ *** Un client riconosciuto ma SENZA abbonamento attivo = Bronzo ***  │
│ *** Un lead sconosciuto = Bronzo ***                                 │
│ *** Solo con abbonamento attivo level "2" o "3" = Argento/Gold ***   │
└──────────────────────────────────────────────────────────────────────┘
```

### 7.3 Costruzione Prompt con Overlay (dentro il nuovo flusso)

```
┌──────────────────────────────────────────────────────────────────────┐
│ COSTRUZIONE PROMPT PER AGENTE CON LIVELLI                            │
│                                                                      │
│ // Step 1: Prompt base dell'agente (identico alla pagina web)        │
│ let systemPrompt = await buildWhatsAppAgentPrompt(consultantConfig); │
│                                                                      │
│ // Step 2: Iniezione overlay additivi                                │
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
│ // Il prompt è quello dell'agente + overlay                          │
│                                                                      │
│ *** L'AI si comporta come sulla pagina web, non come Assistenza ***  │
│ *** Il livello aggiunge istruzioni ma NON dati CRM ***              │
└──────────────────────────────────────────────────────────────────────┘
```

### 7.4 Conversazioni Condivise Web ↔ WhatsApp

```
┌──────────────────────────────────────────────────────────────────────┐
│ CONVERSAZIONE CONDIVISA - AGENTE CON LIVELLI                         │
│                                                                      │
│ Quando arriva messaggio WhatsApp a un agente con livelli:            │
│                                                                      │
│ 1. Il messaggio viene COMUNQUE salvato in whatsapp_messages           │
│    (per mantenere la gestione Twilio esistente)                       │
│                                                                      │
│ 2. IN PIÙ, cerchiamo/creiamo una manager_conversation:               │
│                                                                      │
│    SELECT * FROM manager_conversations                                │
│    WHERE agent_config_id = :agentConfigId                             │
│      AND whatsapp_phone = :normalizedPhone  ← NUOVO CAMPO           │
│    LIMIT 1                                                            │
│                                                                      │
│    Se non esiste → CREATE con:                                        │
│      manager_id: managerId dell'utente (da manager_users)             │
│      share_id: shareId dell'agente (da whatsapp_agent_shares)         │
│      agent_config_id: agentConfigId                                   │
│      whatsapp_phone: normalizedPhone                                  │
│      source: 'whatsapp'                                               │
│                                                                      │
│ 3. Salviamo messaggio utente in manager_messages                      │
│    metadata: { source: 'whatsapp' }                                   │
│                                                                      │
│ 4. Dopo risposta AI, salviamo anche quella in manager_messages        │
│    metadata: { source: 'whatsapp' }                                   │
│                                                                      │
│ 5. La pagina web legge da manager_messages                            │
│    → Vede anche i messaggi da WhatsApp                                │
│                                                                      │
│ ┌──────────────────────────────────────────────────────────┐          │
│ │ ESEMPIO:                                                 │          │
│ │                                                          │          │
│ │ Mario chatta su web:                                     │          │
│ │   manager_messages: "Ciao" (source: web)                 │          │
│ │   manager_messages: "Benvenuto!" (source: web)           │          │
│ │                                                          │          │
│ │ Mario scrive su WhatsApp:                                │          │
│ │   whatsapp_messages: "Ho una domanda" (per Twilio)       │          │
│ │   manager_messages: "Ho una domanda" (source: whatsapp)  │          │
│ │   manager_messages: "Certo, dimmi!" (source: whatsapp)   │          │
│ │                                                          │          │
│ │ Mario torna sul web → vede TUTTI i messaggi:             │          │
│ │   "Ciao" / "Benvenuto!" / "Ho una domanda" / "Certo!"   │          │
│ │                                                          │          │
│ │ L'AI su WhatsApp ha come history TUTTI i messaggi:        │          │
│ │   inclusi quelli dal web → contesto completo              │          │
│ └──────────────────────────────────────────────────────────┘          │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 8. MODIFICHE DATABASE

### 8.1 SQL per consultant_whatsapp_config

```sql
-- Istruzioni AI per livello (testo libero del consulente)
ALTER TABLE consultant_whatsapp_config
ADD COLUMN IF NOT EXISTS level_prompt_overlay_1 TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS level_prompt_overlay_2 TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS level_prompt_overlay_3 TEXT DEFAULT NULL;

COMMENT ON COLUMN consultant_whatsapp_config.level_prompt_overlay_1 
IS 'Istruzioni AI aggiuntive per utenti Bronzo (Level 1). Sempre attive.';

COMMENT ON COLUMN consultant_whatsapp_config.level_prompt_overlay_2 
IS 'Istruzioni AI aggiuntive per utenti Argento (Level 2). Si sommano a Level 1.';

COMMENT ON COLUMN consultant_whatsapp_config.level_prompt_overlay_3 
IS 'Istruzioni AI aggiuntive per utenti Gold (Level 3). Si sommano a Level 1 + 2.';
```

### 8.2 SQL per manager_conversations

```sql
-- Linking WhatsApp ↔ Web conversations
ALTER TABLE manager_conversations
ADD COLUMN IF NOT EXISTS whatsapp_phone VARCHAR DEFAULT NULL,
ADD COLUMN IF NOT EXISTS source VARCHAR DEFAULT 'web';

COMMENT ON COLUMN manager_conversations.whatsapp_phone 
IS 'Numero telefono WhatsApp associato (E.164 format, es: +393501234567)';

COMMENT ON COLUMN manager_conversations.source 
IS 'Origine: web (pagina agente), whatsapp (Twilio), both (messaggi da entrambi)';

-- Indice per lookup veloce da WhatsApp
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

### 9.1 message-processor.ts - Routing condizionale

**Posizione**: Riga ~973, dopo `let systemPrompt: string;`

**Logica**: Aggiungere check `isLevelAgent` PRIMA dei rami A/B/C esistenti

```
ORDINE DEI RAMI (DOPO):

1. isValidConsultantAccess → RAMO A (consulente, invariato)
2. isLevelAgent → NUOVO RAMO (agente con livelli)
3. effectiveUserId → RAMO B (client su agente standard, invariato)  
4. else → RAMO C (lead su agente standard, invariato)
```

### 9.2 message-processor.ts - Conversazioni condivise

**Posizione**: Dopo la risposta AI, nella parte di salvataggio

**Logica**: Se `isLevelAgent`, salva anche in `manager_messages`

### 9.3 message-processor.ts - History condivisa

**Posizione**: Nella parte dove carica la history per la chiamata AI

**Logica**: Se `isLevelAgent`, carica history da `manager_messages` invece che da `whatsapp_messages` (per avere il contesto web)

### 9.4 public-agent-router.ts - Overlay web L2/L3

**Posizione**: Riga ~1137, dopo `buildWhatsAppAgentPrompt(agentConfig)`

**Logica**: Determinare livello dal JWT e aggiungere overlay

### 9.5 public-ai-chat-router.ts - Overlay web L1

**Posizione**: Riga ~174, dopo `buildWhatsAppAgentPrompt(agent)`

**Logica**: Aggiungere overlay Bronzo

---

## 10. MODIFICHE FRONTEND

### 10.1 AgentLevel.tsx - Layout Textarea

```
Per OGNI livello selezionato (hasLevel1, hasLevel2, hasLevel3),
aggiungere dentro la Card esistente:

┌──────────────────────────────────────────────────────────────────────┐
│ ┌─ Card Livello X ─────────────────────────────────────────────────┐ │
│ │                                                                   │ │
│ │ [Contenuto esistente: slug, limiti, info...]                      │ │
│ │                                                                   │ │
│ │ ┌─ Nuova Sezione ──────────────────────────────────────────────┐  │ │
│ │ │ 🧠 Istruzioni AI per Livello {nome}                          │  │ │
│ │ │                                                              │  │ │
│ │ │ Descrizione: "Configura come l'AI si comporta con gli        │  │ │
│ │ │ utenti di questo livello. Queste istruzioni vengono           │  │ │
│ │ │ aggiunte al prompt base dell'agente."                         │  │ │
│ │ │                                                              │  │ │
│ │ │ ┌──────────────────────────────────────────────────────────┐  │  │ │
│ │ │ │ [Textarea - 4 righe]                                     │  │  │ │
│ │ │ │                                                          │  │  │ │
│ │ │ │ Placeholder per L1:                                      │  │  │ │
│ │ │ │ "Es: Rispondi in modo generico e breve. Se l'utente      │  │  │ │
│ │ │ │ chiede analisi dettagliate, suggerisci di fare upgrade    │  │  │ │
│ │ │ │ al livello Argento per risposte personalizzate."          │  │  │ │
│ │ │ │                                                          │  │  │ │
│ │ │ │ Placeholder per L2:                                      │  │  │ │
│ │ │ │ "Es: Puoi accedere alla knowledge base. Fornisci         │  │  │ │
│ │ │ │ risposte personalizzate basate sui documenti.             │  │  │ │
│ │ │ │ Per consulenza completa, suggerisci il livello Gold."     │  │  │ │
│ │ │ │                                                          │  │  │ │
│ │ │ │ Placeholder per L3:                                      │  │  │ │
│ │ │ │ "Es: Accesso completo. Fornisci analisi approfondite,    │  │  │ │
│ │ │ │ report personalizzati, consulenza avanzata. Tratta        │  │  │ │
│ │ │ │ l'utente come un cliente premium."                        │  │  │ │
│ │ │ └──────────────────────────────────────────────────────────┘  │  │ │
│ │ │                                                              │  │ │
│ │ │ Info (solo per L2/L3):                                        │  │ │
│ │ │ "Queste istruzioni si SOMMANO a quelle dei livelli           │  │ │
│ │ │ inferiori. Un utente {nome} riceve: {lista livelli}."         │  │ │
│ │ └──────────────────────────────────────────────────────────────┘  │ │
│ └───────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────┘

onChange:
  L1 textarea → onChange("levelPromptOverlay1", value)
  L2 textarea → onChange("levelPromptOverlay2", value)  
  L3 textarea → onChange("levelPromptOverlay3", value)
```

---

## 11. SCENARI DI TEST

### Test 1: Lead scrive su WhatsApp ad agente CON livelli

```
Setup: Agente "Coach AI" con levels=["1","2"]
       levelPromptOverlay1 = "Rispondi brevemente"
       
Azione: Numero sconosciuto +39333... scrive "Ciao"

Atteso:
  ✅ classifyParticipant → "unknown"
  ✅ isLevelAgent = true (levels=["1","2"])
  ✅ userLevel = 1 (default per lead)
  ✅ systemPrompt = buildWhatsAppAgentPrompt + overlay1
  ✅ NON usa buildLeadSystemPrompt (no appuntamenti)
  ✅ NON usa buildSystemPrompt (no CRM)
  ✅ Messaggio salvato in manager_messages (condivisione web)
```

### Test 2: Client Gold scrive su WhatsApp ad agente CON livelli

```
Setup: Agente "Coach AI" con levels=["1","2","3"]
       levelPromptOverlay1 = "Rispondi brevemente"
       levelPromptOverlay2 = "Accesso KB"
       levelPromptOverlay3 = "Consulenza completa"
       Client con client_level_subscriptions level="3", status="active"

Azione: Client Gold +39350... scrive "Analizza il mio portafoglio"

Atteso:
  ✅ classifyParticipant → "client"
  ✅ isLevelAgent = true
  ✅ effectiveUserId presente
  ✅ SELECT level FROM client_level_subscriptions → "3"
  ✅ userLevel = 3
  ✅ systemPrompt = buildWhatsAppAgentPrompt + overlay1 + overlay2 + overlay3
  ✅ NON usa buildSystemPrompt (no CRM)
  ✅ Messaggio salvato in manager_messages
```

### Test 3: Client Gold scrive su WhatsApp ad agente STANDARD

```
Setup: Agente "Assistenza Clienti" con levels=null
       
Azione: Client Gold +39350... scrive "Quanti esercizi ho?"

Atteso:
  ✅ classifyParticipant → "client"
  ✅ isLevelAgent = false (levels null)
  ✅ effectiveUserId presente → RAMO B attuale
  ✅ buildSystemPrompt("assistenza", "finanziario", userContext)
  ✅ Accesso CRM completo (esercizi, appuntamenti, ecc.)
  ✅ Flusso INVARIATO
```

### Test 4: Client scrive su Web poi su WhatsApp (stesso agente con livelli)

```
Setup: Agente "Coach AI" con levels=["1","2","3"]
       Client Gold autenticato sulla pagina web

Azione 1: Client scrive "Ciao" sul sito web
Atteso 1:
  ✅ Messaggio salvato in manager_messages (source: web)
  ✅ Risposta con overlay Gold

Azione 2: Stesso client scrive "Ho una domanda" su WhatsApp
Atteso 2:
  ✅ Trova manager_conversation esistente (whatsapp_phone match)
  ✅ Messaggio salvato in manager_messages (source: whatsapp)
  ✅ History include messaggi web ("Ciao" / risposta)
  ✅ AI ha contesto completo di entrambi i canali
  ✅ Risposta con overlay Gold

Azione 3: Client torna sul sito web
Atteso 3:
  ✅ Vede TUTTI i messaggi: web + WhatsApp
```

### Test 5: Consulente scrive su WhatsApp (qualsiasi agente)

```
Setup: Qualsiasi agente (standard o con livelli)

Azione: Il consulente proprietario scrive al suo agente

Atteso:
  ✅ classifyParticipant → "consultant"
  ✅ RAMO A: buildConsultantSystemPrompt (CRM completo)
  ✅ Flusso INVARIATO (il consulente ha sempre accesso totale)
```

---

## 12. FILE COINVOLTI

| File | Righe | Tipo Modifica |
|------|-------|---------------|
| `shared/schema.ts` | ~2958 | Aggiunta 3 colonne levelPromptOverlay a consultantWhatsappConfig |
| `shared/schema.ts` | ~7383 | Aggiunta 2 colonne whatsappPhone/source a managerConversations |
| `server/whatsapp/message-processor.ts` | ~973 | Nuovo ramo isLevelAgent prima dei rami B/C |
| `server/whatsapp/message-processor.ts` | ~1777 | Adattamento File Search per agenti con livelli |
| `server/whatsapp/message-processor.ts` | dopo AI | Salvataggio in manager_messages se isLevelAgent |
| `server/routes/public-agent-router.ts` | ~1137 | Overlay per livello nelle risposte web L2/L3 |
| `server/routes/public-ai-chat-router.ts` | ~174 | Overlay Bronzo nelle risposte web L1 |
| `client/src/components/whatsapp/wizard-steps/AgentLevel.tsx` | ~108+ | Textarea per overlay |

---

## 13. PIANO DI ESECUZIONE

| # | Task | File | Dipendenze |
|---|------|------|------------|
| 1 | Schema DB: aggiungere colonne | shared/schema.ts | Nessuna |
| 2 | db:push per sincronizzare | - | Task 1 |
| 3 | Backend: routing isLevelAgent + overlay | message-processor.ts | Task 2 |
| 4 | Backend: determinazione livello utente | message-processor.ts | Task 3 |
| 5 | Backend: conversazioni condivise web/WhatsApp | message-processor.ts | Task 4 |
| 6 | Backend: overlay su public-agent-router | public-agent-router.ts | Task 2 |
| 7 | Backend: overlay su public-ai-chat-router | public-ai-chat-router.ts | Task 2 |
| 8 | Frontend: textarea nel wizard | AgentLevel.tsx | Task 2 |
| 9 | Verifica API salvataggio wizard | routes (whatsapp) | Task 8 |
| 10 | Test end-to-end | Tutti | Task 3-9 |
| 11 | Review architect | Tutti | Task 10 |

---

*Documento ossessivo completo. Ogni sezione si auto-spiega.*
*Questo è la mappa: ogni modifica è tracciata, ogni scenario è coperto.*
*Attendere conferma prima di procedere con l'implementazione.*
