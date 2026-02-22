# RDP - Sistema Comportamento AI per Livelli Agente WhatsApp
## Documento di Progetto Completo

---

## INDICE

1. [Contesto e Obiettivo](#1-contesto-e-obiettivo)
2. [Analisi Stato Attuale](#2-analisi-stato-attuale)
3. [Problemi Identificati](#3-problemi-identificati)
4. [Architettura Target](#4-architettura-target)
5. [Modifiche Database](#5-modifiche-database)
6. [Modifiche Backend](#6-modifiche-backend)
7. [Modifiche Frontend](#7-modifiche-frontend)
8. [Flussi di Lavoro Dettagliati](#8-flussi-di-lavoro-dettagliati)
9. [Piano di Esecuzione](#9-piano-di-esecuzione)

---

## 1. CONTESTO E OBIETTIVO

### Cosa vogliamo ottenere
Ogni consulente ha diversi "Dipendenti AI" (agenti WhatsApp). Alcuni sono agenti standard (es: "Assistenza Clienti") che riconoscono il cliente e gli danno accesso completo ai dati CRM. Altri hanno un sistema a livelli (Bronzo/Argento/Gold) dove gli utenti pagano abbonamenti per accedere.

**Obiettivo**: Differenziare il comportamento AI per ogni livello dell'agente, in modo che:
- Il consulente possa configurare istruzioni diverse per ogni livello
- Un utente Bronzo riceva risposte diverse da un Gold
- Gli agenti standard (senza livelli) continuino a funzionare come oggi
- Le conversazioni web e WhatsApp siano UNIFICATE per gli agenti con livelli

### Due tipi di agente

| Tipo | Livelli | Riconoscimento | Prompt AI |
|------|---------|----------------|-----------|
| **Standard** (es: Assistenza Clienti) | Nessuno (`levels` vuoto/null) | Cliente riconosciuto = accesso CRM completo | `buildSystemPrompt` con userContext |
| **Con Livelli** (es: Coach AI, Mentor) | ["1"], ["2"], ["1","2"], ecc. | Trattato secondo il suo livello, NON come client CRM | `buildWhatsAppAgentPrompt` + overlay per livello |

---

## 2. ANALISI STATO ATTUALE

### 2.1 Storage Messaggi - DUE SISTEMI SEPARATI

```
CANALE WHATSAPP (Twilio):
  Tabelle: whatsapp_conversations + whatsapp_messages
  Logica AI: server/whatsapp/message-processor.ts
  Riconoscimento: classifyParticipant() in webhook-handler.ts

CANALE WEB - Livello 1 (Bronzo):
  Storage: localStorage nel browser (SI PERDE!)
  Logica AI: server/routes/public-ai-chat-router.ts
  Prompt: buildWhatsAppAgentPrompt(agent) - senza dati CRM
  Rate limit: per IP, tabella public_chat_rate_limits

CANALE WEB - Livello 2/3 (Argento/Gold):
  Tabelle: manager_conversations + manager_messages
  Logica AI: server/routes/public-agent-router.ts
  Prompt: buildWhatsAppAgentPrompt(agent) + share instructions
  Auth: JWT con managerUsers/whatsappAgentShares
```

**I messaggi web e WhatsApp NON sono condivisi. Sono due mondi separati.**

### 2.2 Riconoscimento Utente su WhatsApp (OGGI)

File: `server/whatsapp/webhook-handler.ts` riga 523-591

```
classifyParticipant(normalizedPhone, consultantId):
  1. È il proprietario dell'agente? → "consultant"
  2. È un cliente di quel consulente (consultantId match)? → "client"
  3. Email match dal proactive lead? → "client"
  4. Nessun match → "unknown" (lead)
```

Questo avviene per QUALSIASI agente, senza distinzione tra agente standard e agente con livelli.

### 2.3 Costruzione Prompt nel Message Processor (OGGI)

File: `server/whatsapp/message-processor.ts` riga 973-1595

```
if (isValidConsultantAccess):
  → buildConsultantSystemPrompt() con CRM completo

else if (effectiveUserId):  // CLIENT RICONOSCIUTO
  → buildSystemPrompt("assistenza", "finanziario", userContext)
  → + Knowledge base agente
  → + Customer Support mode
  → Accesso a TUTTI i dati CRM del cliente

else:  // LEAD
  → buildLeadSystemPrompt()
  → Gestione appuntamenti, persuasione, conversione
```

### 2.4 Campo `level` nello Schema

File: `shared/schema.ts` riga 2937-2938

```typescript
// Nella tabella consultant_whatsapp_config:
level: text("level").$type<"1" | "2" | "3" | null>(),  // DEPRECATED
levels: text("levels").array().$type<("1" | "2")[]>(),  // Array di livelli attivi
```

---

## 3. PROBLEMI IDENTIFICATI

### P1: Nessuna differenziazione AI per livello
Il system prompt è identico per tutti i livelli. Un Bronzo riceve la stessa qualità di risposta di un Gold (tranne File Search).

### P2: Client riconosciuto = sempre accesso CRM
Quando un cliente Gold scrive su WhatsApp a QUALSIASI agente, viene riconosciuto e riceve il buildSystemPrompt con dati CRM. Questo dovrebbe succedere SOLO per l'agente standard (senza livelli).

### P3: Conversazioni non condivise web/WhatsApp
Un utente che chatta con un agente sulla pagina web ha conversazioni separate da WhatsApp. Dovrebbero essere unificate.

### P4: Livello 1 web usa localStorage
Le conversazioni Bronzo sulla pagina web si perdono (localStorage). Dovrebbero essere persistenti.

---

## 4. ARCHITETTURA TARGET

### 4.1 Nuovo Flusso Decisionale WhatsApp

```
Messaggio WhatsApp arriva
          |
          v
classifyParticipant() identifica chi è (come oggi)
          |
          v
Carica consultantConfig (agente assegnato)
          |
          v
L'agente ha livelli configurati?
(consultantConfig.levels && consultantConfig.levels.length > 0)
          |
    ------+------
    |            |
    NO           SI
    |            |
    v            v
 STANDARD     CON LIVELLI
    |            |
    v            v
[FLUSSO        [NUOVO FLUSSO]
 ATTUALE]      Determina livello utente:
               |
               +--> effectiveUserId presente?
               |    |
               |    +--> Cerca in client_level_subscriptions
               |    |    per consultantId dell'agente
               |    |    |
               |    |    +--> level "3" → GOLD (overlay 1+2+3)
               |    |    +--> level "2" → ARGENTO (overlay 1+2)
               |    |    +--> non trovato → BRONZO (overlay 1 sola)
               |    |
               |    +--> Cerca in bronze_users per email/phone
               |         +--> trovato → BRONZO (overlay 1)
               |
               +--> nessun userId (lead)?
                    +--> BRONZO (overlay 1 di default)
               |
               v
         buildWhatsAppAgentPrompt(agent)
         + levelPromptOverlay1 (SEMPRE)
         + levelPromptOverlay2 (se Argento o Gold)
         + levelPromptOverlay3 (se Gold)
```

### 4.2 Conversazioni Condivise

```
AGENTE STANDARD (senza livelli):
  WhatsApp → whatsapp_conversations/whatsapp_messages (come oggi)
  Web → non applicabile (non ha pagina pubblica)

AGENTE CON LIVELLI:
  WhatsApp → manager_conversations/manager_messages
  Web → manager_conversations/manager_messages (come oggi per L2/L3)
  
  Match: stesso userId (per client) o stesso phoneNumber (per bronze/lead)
```

---

## 5. MODIFICHE DATABASE

### 5.1 Nuove colonne in consultant_whatsapp_config

```sql
ALTER TABLE consultant_whatsapp_config
ADD COLUMN level_prompt_overlay_1 TEXT DEFAULT NULL,
ADD COLUMN level_prompt_overlay_2 TEXT DEFAULT NULL,
ADD COLUMN level_prompt_overlay_3 TEXT DEFAULT NULL;
```

### 5.2 Colonne per linking WhatsApp in manager_conversations

```sql
ALTER TABLE manager_conversations
ADD COLUMN whatsapp_phone VARCHAR DEFAULT NULL,
ADD COLUMN source VARCHAR DEFAULT 'web';
```

---

## 6. MODIFICHE BACKEND

### 6.1 message-processor.ts - Routing condizionale + overlay
### 6.2 message-processor.ts - Conversazioni condivise
### 6.3 public-agent-router.ts - Overlay web L2/L3
### 6.4 public-ai-chat-router.ts - Overlay web L1

---

## 7. MODIFICHE FRONTEND

### 7.1 AgentLevel.tsx - Textarea per overlay per livello

---

## 8. FLUSSI DI LAVORO DETTAGLIATI

### Flusso A: Client → Assistenza Clienti (Standard) = come oggi, CRM completo
### Flusso B: Lead → Coach AI (Con Livelli) = prompt agente + overlay Bronzo, NO CRM
### Flusso C: Client Gold → Coach AI (Con Livelli) = prompt agente + overlay 1+2+3, NO CRM
### Flusso D: Client Gold ha entrambi = conversazioni separate per agentConfigId

---

## 9. PIANO DI ESECUZIONE

| Task | File | Descrizione |
|------|------|-------------|
| 1 | shared/schema.ts | Aggiunta colonne DB |
| 2 | server/whatsapp/message-processor.ts | Routing condizionale |
| 3 | server/whatsapp/message-processor.ts | Determinazione livello utente |
| 4 | server/whatsapp/message-processor.ts + routes | Conversazioni condivise |
| 5 | client/src/components/whatsapp/wizard-steps/AgentLevel.tsx | Frontend textarea |
| 6 | Test end-to-end | Verifica tutti i flussi |
| 7 | Review architect | Sicurezza e coerenza |

---

*Documento generato come mappa di lavoro.*
