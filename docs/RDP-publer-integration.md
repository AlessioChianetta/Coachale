# RDP: Integrazione Publer API + Fix Anti-Loop Proactive Leads

**Data**: 2026-01-25  
**Versione**: 1.0

---

## 1. FIX URGENTE: Anti-Loop Proactive Leads

### 1.1 Problema Identificato
- Lead con numero invalido (+10967539661) ha generato 84+ tentativi di invio
- Il sistema riprova ogni minuto perché lo stato torna a "pending" dopo fallimento
- Twilio rifiuta il messaggio (non consuma crediti) ma spreca risorse

### 1.2 Soluzione Database
```sql
-- Blocco immediato lead problematico
UPDATE proactive_leads SET status = 'failed' WHERE id = '468da70d-51eb-4333-b956-66b9d55b9134';

-- Aggiungere colonna per tracciare tentativi falliti
ALTER TABLE proactive_leads ADD COLUMN IF NOT EXISTS failed_attempts INTEGER DEFAULT 0;
ALTER TABLE proactive_leads ADD COLUMN IF NOT EXISTS last_error TEXT;
```

### 1.3 Modifiche Backend
**File**: `server/whatsapp/proactive-outreach.ts`
- Incrementare `failed_attempts` ad ogni errore
- Se `failed_attempts >= 3` con stesso errore, marcare come `failed`
- Loggare motivo del blocco in `last_error`

---

## 2. INTEGRAZIONE PUBLER

### 2.1 Overview
Publer è un servizio di scheduling social media. L'integrazione permette di pubblicare contenuti creati nel Content Studio direttamente sui social.

**Base URL**: `https://app.publer.com/api/v1/`  
**Requisito**: Piano Business Publer ($10/mese)

### 2.2 Modifiche Database

```sql
-- Tabella configurazione Publer per consulente
CREATE TABLE IF NOT EXISTS publer_configs (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    consultant_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    api_key_encrypted TEXT,
    workspace_id VARCHAR,
    is_active BOOLEAN DEFAULT false,
    last_sync_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(consultant_id)
);

-- Colonne per tracciare pubblicazione su Publer
ALTER TABLE content_posts ADD COLUMN IF NOT EXISTS publer_post_id VARCHAR;
ALTER TABLE content_posts ADD COLUMN IF NOT EXISTS publer_status VARCHAR; -- draft, scheduled, published, failed
ALTER TABLE content_posts ADD COLUMN IF NOT EXISTS publer_scheduled_at TIMESTAMP;
ALTER TABLE content_posts ADD COLUMN IF NOT EXISTS publer_published_at TIMESTAMP;
ALTER TABLE content_posts ADD COLUMN IF NOT EXISTS publer_error TEXT;

-- Cache account social collegati
CREATE TABLE IF NOT EXISTS publer_accounts (
    id VARCHAR PRIMARY KEY,
    consultant_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    platform VARCHAR NOT NULL, -- instagram, facebook, linkedin, twitter, etc.
    account_name VARCHAR,
    account_username VARCHAR,
    profile_image_url TEXT,
    is_active BOOLEAN DEFAULT true,
    synced_at TIMESTAMP DEFAULT NOW()
);
```

### 2.3 Schema Drizzle (shared/schema.ts)

```typescript
export const publerConfigs = pgTable("publer_configs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  consultantId: varchar("consultant_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  apiKeyEncrypted: text("api_key_encrypted"),
  workspaceId: varchar("workspace_id"),
  isActive: boolean("is_active").default(false),
  lastSyncAt: timestamp("last_sync_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const publerAccounts = pgTable("publer_accounts", {
  id: varchar("id").primaryKey(),
  consultantId: varchar("consultant_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  platform: varchar("platform").notNull(),
  accountName: varchar("account_name"),
  accountUsername: varchar("account_username"),
  profileImageUrl: text("profile_image_url"),
  isActive: boolean("is_active").default(true),
  syncedAt: timestamp("synced_at").defaultNow(),
});
```

### 2.4 Backend Service

**File**: `server/services/publer-service.ts`

```typescript
class PublerService {
  private baseUrl = "https://app.publer.com/api/v1";
  
  // Headers richiesti
  private getHeaders(apiKey: string, workspaceId: string) {
    return {
      "Authorization": `Bearer-API ${apiKey}`,
      "Publer-Workspace-Id": workspaceId,
      "Content-Type": "application/json"
    };
  }
  
  // GET /accounts - Lista account social collegati
  async getAccounts(consultantId: string): Promise<PublerAccount[]>
  
  // POST /media - Upload immagine
  async uploadMedia(consultantId: string, file: Buffer, filename: string): Promise<MediaUploadResult>
  
  // POST /posts/schedule/publish - Crea post schedulato
  async schedulePost(consultantId: string, post: SchedulePostRequest): Promise<SchedulePostResult>
  
  // GET /posts - Lista post esistenti
  async getPosts(consultantId: string, filters?: PostFilters): Promise<PublerPost[]>
}
```

### 2.5 API Routes

**File**: `server/routes/publer.ts`

| Metodo | Endpoint | Descrizione |
|--------|----------|-------------|
| GET | `/api/publer/config` | Ottiene config Publer del consulente |
| PUT | `/api/publer/config` | Salva/aggiorna config Publer |
| GET | `/api/publer/accounts` | Lista account social collegati |
| POST | `/api/publer/accounts/sync` | Forza sync account da Publer |
| POST | `/api/publer/media` | Upload media a Publer |
| POST | `/api/publer/publish` | Pubblica/schedula post |
| GET | `/api/publer/posts` | Lista post pubblicati |

### 2.6 Frontend Components

**File**: `client/src/pages/content-studio/posts.tsx`

Aggiungere:
- Bottone "Pubblica su Publer" nel menu azioni post
- Dialog di pubblicazione con:
  - Selezione account (checkbox multipli)
  - Data/ora schedulazione (o "Pubblica ora")
  - Anteprima per ogni piattaforma
  - Stato pubblicazione (in attesa, pubblicato, fallito)

**File**: `client/src/pages/consultant-api-keys-unified.tsx` (o nuovo tab)

Aggiungere sezione Publer:
- Input API Key (mascherato)
- Input Workspace ID
- Bottone "Testa Connessione"
- Lista account collegati

### 2.7 Flusso Pubblicazione

```
1. Utente crea post in Content Studio
2. Click "Pubblica su Publer"
3. Dialog mostra account disponibili
4. Utente seleziona account e data/ora
5. Se post ha immagini:
   a. Upload immagini a Publer (POST /media)
   b. Ottieni media IDs
6. Crea post schedulato (POST /posts/schedule/publish)
7. Salva publer_post_id e publer_status nel DB
8. Mostra conferma con link a Publer
```

### 2.8 Autenticazione Publer

Headers richiesti per ogni request:
```
Authorization: Bearer-API {API_KEY}
Publer-Workspace-Id: {WORKSPACE_ID}
Content-Type: application/json
```

L'API Key viene cifrata con encryption consulente prima di salvare nel DB.

---

## 3. CHECKLIST IMPLEMENTAZIONE

### Fix Anti-Loop
- [x] Bloccare lead problematico (SQL diretto)
- [x] Aggiungere colonne failed_attempts e last_error (SQL + schema.ts)
- [x] Modificare proactive-outreach.ts per logica max 3 tentativi

### Publer Database
- [ ] Creare tabella publer_configs
- [ ] Creare tabella publer_accounts  
- [ ] Aggiungere colonne publer_* a content_posts
- [ ] Aggiungere schema Drizzle

### Publer Backend
- [ ] Creare server/services/publer-service.ts
- [ ] Creare server/routes/publer.ts
- [ ] Registrare routes in server/routes.ts

### Publer Frontend
- [ ] Sezione config in API Keys page
- [ ] Bottone pubblicazione in posts.tsx
- [ ] Dialog pubblicazione con selezione account
- [ ] Indicatore stato pubblicazione

### Testing
- [ ] Test connessione API
- [ ] Test upload media
- [ ] Test pubblicazione post
- [ ] Test scheduling
