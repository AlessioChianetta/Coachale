# RDP — File Search Store Dedicati per Agenti Autonomi e Reparti

## Stato Attuale DB (`file_search_stores`)

| owner_type | count | descrizione |
|---|---|---|
| `consultant` | 4 | 1 store per consulente — condiviso tra AI Assistant clienti + agenti autonomi |
| `client` | 26 | 1 per cliente — dati privati (esercizi, consulenze, KB cliente) |
| `whatsapp_agent` | 8 | 1 per dipendente WhatsApp — store dedicato |
| `email_account` | 2 | 1 per account email |
| `autonomous_agent` | 0 | **MANCANTE** — da creare |
| `department` | 0 | **MANCANTE** — da creare |

### Colonne `file_search_stores`:
- `id` (varchar PK, gen_random_uuid)
- `google_store_name` (text, unique) — nome store su Google
- `display_name` (text) — nome visualizzato
- `description` (text)
- `owner_id` (varchar) — ID del proprietario (consultantId, clientId, agentConfigId, departmentId...)
- `owner_type` (text) — tipo proprietario
- `document_count` (integer, default 0)
- `is_active` (boolean, default true)
- `dynamic_context_auto_sync` (boolean, default true)
- `last_dynamic_context_sync` (timestamp)
- `created_at`, `updated_at` (timestamp)

### Reparti nel DB (`departments`):
- `id`, `consultant_id`, `name`, `color`, `description`, `sort_order`
- Dinamici: ogni consulente crea i suoi
- Attualmente: 2 reparti (entrambi "Vendite" per 2 consulenti diversi)

---

## Schema Modifiche Necessarie

### 1. Schema Drizzle (`shared/schema.ts`)
- **ownerType**: aggiungere `'autonomous_agent'` e `'department'` al tipo union
- Riga ~6917: `ownerType: text("owner_type").$type<"consultant" | "client" | "system" | "whatsapp_agent" | "email_account" | "autonomous_agent" | "department">().notNull()`

### 2. File Search Service (`server/ai/file-search-service.ts`)
- **Riga 46**: Aggiornare interfaccia `ownerType` 
- **Riga 303**: Aggiornare parametro `createStore`
- **Nuova funzione**: `getAutonomousAgentStore(agentId, consultantId)` → cerca store con ownerType='autonomous_agent', ownerId=agentId
- **Nuova funzione**: `getDepartmentStore(departmentId, consultantId)` → cerca store con ownerType='department', ownerId=departmentId
- **`getStoreBreakdownForGeneration`**: Aggiungere condizioni per autonomous_agent e department

### 3. File Search Sync Service (`server/services/file-search-sync-service.ts`)
- **Nuova funzione**: `getOrCreateAutonomousAgentStore(agentId, consultantId)` — pattern identico a `getWhatsappAgentStore` (riga 7095)
- **Nuova funzione**: `getOrCreateDepartmentStore(departmentId, consultantId)`
- **`syncSystemPromptDocumentToFileSearch`**: gestire target='autonomous_agent' → store dedicato agente (NON più consultant store)
- **`syncSystemPromptDocumentToFileSearch`**: gestire target='department' → store dedicato reparto
- **Scheduled sync**: Loop su agenti autonomi e reparti

---

## Flusso SCRITTURA — Dove Sincronizzare

### A) System Prompt Documents → Agenti Autonomi

**File: `server/routes/knowledge-documents.ts`**

#### CREATE (POST /api/consultant/knowledge/system-documents)
- Riga ~1916: Blocco `injection_mode === 'file_search'`
- ATTUALE: `needsConsultantStore = target_client_assistant || hasAutoAgents` → sync su consultant store
- NUOVO: Se `hasAutoAgents`, per OGNI agente abilitato → sync su `getOrCreateAutonomousAgentStore(agentId)`
- `target_client_assistant` → consultant store (invariato)
- Ogni agente autonomo → suo store dedicato

#### UPDATE (PUT /api/consultant/knowledge/system-documents/:id)
- Riga ~2022: Blocco update
- ATTUALE: `needsConsultantStore = target_client_assistant || hasAutoAgents` → sync/remove su consultant
- NUOVO: Per ogni agente, sync/remove dal suo store dedicato
- Se agente disabilitato → rimuovere dal suo store
- Se agente abilitato → sync nel suo store

#### TOGGLE (PATCH /api/consultant/knowledge/system-documents/:id/toggle)  
- Riga ~2179: Blocco toggle
- ATTUALE: come sopra
- NUOVO: Se disattivato → rimuovere da TUTTI gli store agenti
- Se attivato → sync in ogni store agente abilitato

#### DELETE (DELETE /api/consultant/knowledge/system-documents/:id)
- Riga ~2229 circa: Blocco delete
- ATTUALE: rimuove da consultant store
- NUOVO: rimuovere da OGNI store agente autonomo

**File: `server/routes/google-drive.ts`**
- Riga ~713: Blocco import-drive-text
- Stessa logica del CREATE

### B) System Prompt Documents → Reparti

**File: `server/routes/knowledge-documents.ts`**
- Nei 4 blocchi sopra, quando `target_client_mode === 'specific_departments'` e `injection_mode === 'file_search'`:
  - Per ogni `departmentId` in `target_department_ids` → sync su `getOrCreateDepartmentStore(departmentId)`

### C) Scheduled Sync Job
**File: `server/services/file-search-sync-service.ts`**
- Nella funzione di sync schedulata:
  - Per ogni doc con `injection_mode='file_search'` e agenti autonomi → sync negli store agente
  - Per ogni doc con `injection_mode='file_search'` e reparti → sync negli store reparto

---

## Flusso LETTURA — Dove Leggere

### A) Agenti Autonomi (Task Execution)

**File: `server/ai/ai-task-executor.ts`**

#### `loadAgentDocuments()` (riga 104-184)
- ATTUALE (riga 162): `getConsultantOwnStores(consultantId)` → solo consultant stores
- NUOVO: Aggiungere `getAutonomousAgentStore(agentId)` e unire i nomi degli store
- Marco legge da: **consultant store + marco store**

#### `handleSearchPrivateStores()` (riga 458-560)
- ATTUALE (riga 482-484): usa `agentDocs.fileSearchStoreNames` (che contiene solo consultant)
- NUOVO: `agentDocs.fileSearchStoreNames` conterrà sia consultant che agent store
- Ordine: client store (se c'è contact) + agent store + consultant store

### B) Reparti/Dipendenti (AI Assistant)

**File: `server/ai-service.ts`**
- Riga ~808: `getStoreBreakdownForGeneration(userId, userRole, consultantId?)`
- ATTUALE: carica consultant + client + system stores
- NUOVO: Se utente è dipendente con `departmentId` → aggiungere `getDepartmentStore(departmentId)`
- Il dipendente del reparto "Vendite" legge da: **consultant store + client store + department "Vendite" store**

### C) Check-in Personalizzati

**File: `server/ai/checkin-personalization-service.ts`**
- Riga ~85: `getStoreBreakdownForGeneration`
- Se check-in per agente autonomo → aggiungere agent store
- Se check-in per dipendente con reparto → aggiungere department store

### D) WhatsApp (già gestito)
- `message-processor.ts` riga ~1863: usa `getWhatsappAgentStore(consultantConfig.id)` → OK, già dedicato

### E) Email (già gestito)
- `email-ai-service.ts`: usa store `email_account` dedicato → OK

---

## Riepilogo Store per Canale (OBIETTIVO FINALE)

| Canale | Store Letti | Logica |
|---|---|---|
| AI Assistant (consulente) | consultant + system | Invariato |
| AI Assistant (cliente) | client + consultant + system | Invariato |
| AI Assistant (dipendente reparto X) | client + consultant + **department X** + system | NUOVO |
| Dipendente WhatsApp | whatsapp_agent + consultant (Gold) | Invariato |
| Account Email | email_account | Invariato |
| Agente autonomo (es. Marco) | **autonomous_agent Marco** + consultant + client (se contact) | NUOVO |

---

## File da Modificare (Checklist)

- [ ] `shared/schema.ts` — ownerType union type
- [ ] `server/ai/file-search-service.ts` — interfacce, createStore, nuove funzioni get
- [ ] `server/services/file-search-sync-service.ts` — getOrCreate per autonomous_agent e department, sync logic
- [ ] `server/routes/knowledge-documents.ts` — CREATE, UPDATE, TOGGLE, DELETE
- [ ] `server/routes/google-drive.ts` — CREATE import
- [ ] `server/ai/ai-task-executor.ts` — loadAgentDocuments, handleSearchPrivateStores
- [ ] `server/ai-service.ts` — lettura department store per dipendenti
- [ ] `server/ai/checkin-personalization-service.ts` — lettura agent/department store
- [ ] `client/src/pages/consultant-file-search-analytics.tsx` — visualizzazione nuovi store
