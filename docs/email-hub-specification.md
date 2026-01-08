# EMAIL HUB - SPECIFICA TECNICA COMPLETA

## Indice
1. [Panoramica](#panoramica)
2. [Fasi Implementazione](#fasi-implementazione)
3. [Database Schema](#database-schema)
4. [Backend API](#backend-api)
5. [Frontend Components](#frontend-components)
6. [Sync Services](#sync-services)
7. [AI Integration](#ai-integration)
8. [Security](#security)

---

## Panoramica

Email Hub è un sistema di gestione email integrato con AI per consulenti. Permette di:
- Collegare account email (IMAP, Gmail, Microsoft 365)
- Visualizzare inbox unificato
- Generare risposte automatiche con AI
- Automatizzare azioni tramite regole

### Architettura
```
┌─────────────────────────────────────────────────────────────┐
│                      FRONTEND                                │
│  /consultant/email-hub                                       │
│  ┌──────────┬────────────────────────────────────────────┐  │
│  │ Accounts │  Inbox List  │  Email Detail  │  AI Panel  │  │
│  └──────────┴────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      BACKEND API                             │
│  /api/email-hub/*                                            │
│  ┌──────────┬──────────┬──────────┬──────────┐              │
│  │ Accounts │  Emails  │   Sync   │   AI     │              │
│  └──────────┴──────────┴──────────┴──────────┘              │
└─────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
        ┌──────────┐   ┌──────────┐   ┌──────────┐
        │ Database │   │   IMAP   │   │  Gemini  │
        │ Postgres │   │  Servers │   │    AI    │
        └──────────┘   └──────────┘   └──────────┘
```

---

## Fasi Implementazione

### FASE 1 - MVP (IMAP IDLE)
- [ ] Database: email_accounts, emails, email_ai_responses
- [ ] Backend: CRUD account, inbox, AI draft
- [ ] Sync: IMAP IDLE real-time
- [ ] Frontend: EmailHub page, inbox, detail, AI panel
- [ ] AI: Classificazione + generazione bozze

### FASE 2 - OAuth Integration
- [ ] Database: oauth fields, oauth_providers
- [ ] Backend: OAuth flows Google/Microsoft
- [ ] Sync: Gmail Pub/Sub, Graph webhooks
- [ ] Frontend: OAuth connect buttons

### FASE 3 - Automazione
- [ ] Database: email_rules
- [ ] Backend: Rules CRUD, engine
- [ ] Frontend: RulesEditor, RuleBuilder
- [ ] AI: Auto-reply basato su regole

### FASE 4 - SuperAdmin
- [ ] Database: audit logs, global settings
- [ ] Backend: Admin APIs
- [ ] Frontend: Admin dashboard

---

## Database Schema

### FASE 1 - MVP Tables

```sql
-- ============================================
-- EMAIL_ACCOUNTS - Account email collegati
-- ============================================
CREATE TABLE email_accounts (
  id SERIAL PRIMARY KEY,
  consultant_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Identificazione
  provider VARCHAR(20) NOT NULL DEFAULT 'imap',
  -- Valori: 'imap' | 'gmail_app_password' | 'gmail_oauth' | 'microsoft_oauth'
  display_name VARCHAR(100),
  email_address VARCHAR(255) NOT NULL,
  
  -- IMAP Settings
  imap_host VARCHAR(255),
  imap_port INTEGER DEFAULT 993,
  imap_user VARCHAR(255),
  imap_password TEXT, -- encrypted con AES-256
  imap_tls BOOLEAN DEFAULT true,
  
  -- SMTP Settings
  smtp_host VARCHAR(255),
  smtp_port INTEGER DEFAULT 587,
  smtp_user VARCHAR(255),
  smtp_password TEXT, -- encrypted
  smtp_tls BOOLEAN DEFAULT true,
  
  -- AI Configuration
  auto_reply_mode VARCHAR(20) NOT NULL DEFAULT 'review',
  -- Valori: 'manual' | 'review' | 'auto'
  confidence_threshold REAL DEFAULT 0.8,
  -- Soglia 0.0-1.0 per auto-reply
  ai_tone VARCHAR(20) DEFAULT 'formal',
  -- Valori: 'formal' | 'friendly' | 'professional'
  signature TEXT,
  -- Firma email HTML
  
  -- Sync Status
  last_sync_at TIMESTAMP WITH TIME ZONE,
  sync_status VARCHAR(20) DEFAULT 'idle',
  -- Valori: 'idle' | 'syncing' | 'error' | 'connected'
  sync_error TEXT,
  
  -- State
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  UNIQUE(consultant_id, email_address)
);

CREATE INDEX idx_email_accounts_consultant ON email_accounts(consultant_id);
CREATE INDEX idx_email_accounts_active ON email_accounts(is_active) WHERE is_active = true;

-- ============================================
-- EMAILS - Messaggi email
-- ============================================
CREATE TABLE emails (
  id SERIAL PRIMARY KEY,
  account_id INTEGER NOT NULL REFERENCES email_accounts(id) ON DELETE CASCADE,
  consultant_id INTEGER NOT NULL REFERENCES users(id),
  
  -- Message Identity
  message_id VARCHAR(500) UNIQUE NOT NULL,
  -- RFC 2822 Message-ID
  thread_id VARCHAR(255),
  -- Per raggruppare conversazioni
  in_reply_to VARCHAR(500),
  -- Message-ID del messaggio a cui risponde
  
  -- Headers
  subject TEXT,
  from_name VARCHAR(255),
  from_email VARCHAR(255) NOT NULL,
  to_recipients JSONB NOT NULL DEFAULT '[]',
  -- [{name, email}]
  cc_recipients JSONB DEFAULT '[]',
  bcc_recipients JSONB DEFAULT '[]',
  reply_to VARCHAR(255),
  
  -- Content
  body_html TEXT,
  body_text TEXT,
  snippet VARCHAR(500),
  -- Preview text (primi 200 chars)
  
  -- Attachments
  attachments JSONB DEFAULT '[]',
  -- [{filename, contentType, size, contentId}]
  has_attachments BOOLEAN DEFAULT false,
  
  -- Direction & Status
  direction VARCHAR(10) NOT NULL,
  -- 'inbound' | 'outbound'
  is_read BOOLEAN DEFAULT false,
  is_starred BOOLEAN DEFAULT false,
  is_archived BOOLEAN DEFAULT false,
  
  -- AI Processing
  ai_classification JSONB,
  -- {intent, urgency, sentiment, category, extracted_entities}
  ai_confidence REAL,
  -- 0.0-1.0
  processing_status VARCHAR(30) NOT NULL DEFAULT 'new',
  -- Valori: 'new' | 'pending_ai' | 'ai_processing' | 'ai_draft_ready' | 
  --         'awaiting_review' | 'approved' | 'sent' | 'archived' | 'error'
  
  -- Timestamps
  received_at TIMESTAMP WITH TIME ZONE,
  sent_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Indexes
  CONSTRAINT valid_direction CHECK (direction IN ('inbound', 'outbound'))
);

CREATE INDEX idx_emails_account ON emails(account_id);
CREATE INDEX idx_emails_consultant ON emails(consultant_id);
CREATE INDEX idx_emails_thread ON emails(thread_id);
CREATE INDEX idx_emails_status ON emails(processing_status);
CREATE INDEX idx_emails_received ON emails(received_at DESC);
CREATE INDEX idx_emails_unread ON emails(account_id, is_read) WHERE is_read = false;

-- ============================================
-- EMAIL_AI_RESPONSES - Bozze AI
-- ============================================
CREATE TABLE email_ai_responses (
  id SERIAL PRIMARY KEY,
  email_id INTEGER NOT NULL REFERENCES emails(id) ON DELETE CASCADE,
  
  -- Draft Content
  draft_subject TEXT,
  draft_body_html TEXT,
  draft_body_text TEXT,
  
  -- AI Metadata
  reasoning JSONB,
  -- {thought_process, key_points, tone_used, sources_used}
  confidence REAL,
  -- 0.0-1.0
  model_used VARCHAR(50),
  -- es. 'gemini-1.5-pro'
  tokens_used INTEGER,
  
  -- Status
  status VARCHAR(30) NOT NULL DEFAULT 'draft',
  -- Valori: 'draft' | 'awaiting_review' | 'approved_sent' | 'rejected' | 'auto_sent' | 'edited'
  
  -- Edit tracking
  original_draft TEXT,
  -- Salva originale se modificato
  edited_by INTEGER REFERENCES users(id),
  edit_notes TEXT,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  sent_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_ai_responses_email ON email_ai_responses(email_id);
CREATE INDEX idx_ai_responses_status ON email_ai_responses(status);
```

### FASE 2 - OAuth Extensions

```sql
-- Aggiungi colonne OAuth a email_accounts
ALTER TABLE email_accounts ADD COLUMN auth_type VARCHAR(20) DEFAULT 'password';
-- Valori: 'password' | 'oauth' | 'app_password'

ALTER TABLE email_accounts ADD COLUMN oauth_provider VARCHAR(20);
-- Valori: 'google' | 'microsoft'

ALTER TABLE email_accounts ADD COLUMN oauth_refresh_token TEXT;
-- encrypted
ALTER TABLE email_accounts ADD COLUMN oauth_access_token TEXT;
-- encrypted
ALTER TABLE email_accounts ADD COLUMN oauth_expires_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE email_accounts ADD COLUMN oauth_scopes TEXT[];

-- ============================================
-- OAUTH_PROVIDERS - Config SuperAdmin
-- ============================================
CREATE TABLE oauth_providers (
  id SERIAL PRIMARY KEY,
  provider VARCHAR(20) NOT NULL UNIQUE,
  -- 'google' | 'microsoft'
  
  client_id TEXT NOT NULL,
  client_secret TEXT NOT NULL, -- encrypted
  
  redirect_uri TEXT,
  scopes TEXT[] NOT NULL,
  
  is_enabled BOOLEAN DEFAULT true,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### FASE 3 - Rules Engine

```sql
-- ============================================
-- EMAIL_RULES - Regole automazione
-- ============================================
CREATE TABLE email_rules (
  id SERIAL PRIMARY KEY,
  consultant_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  name VARCHAR(100) NOT NULL,
  description TEXT,
  
  -- Trigger
  trigger_type VARCHAR(30) NOT NULL,
  -- Valori: 'intent' | 'keyword' | 'sender' | 'domain' | 'time' | 'no_reply_sla'
  
  -- Conditions (AND logic within, OR between rules)
  conditions JSONB NOT NULL,
  -- Esempi:
  -- Intent: {intent: 'support_request', min_confidence: 0.7}
  -- Keyword: {keywords: ['fattura', 'pagamento'], match: 'any'}
  -- Sender: {emails: ['vip@client.com'], domains: ['important.com']}
  -- Time: {hours_start: 18, hours_end: 8, days: ['saturday', 'sunday']}
  -- SLA: {hours_without_reply: 24}
  
  -- Action
  action VARCHAR(30) NOT NULL,
  -- Valori: 'auto_reply' | 'tag' | 'folder' | 'escalate' | 'notify' | 'assign'
  
  action_config JSONB NOT NULL DEFAULT '{}',
  -- auto_reply: {use_template: 'out_of_office', override_mode: true}
  -- tag: {tags: ['urgent', 'vip']}
  -- folder: {folder: 'priority'}
  -- escalate: {notify_email: 'manager@company.com', message: '...'}
  -- notify: {channels: ['email', 'push'], message: '...'}
  -- assign: {to_user_id: 123}
  
  -- Priority & State
  priority INTEGER DEFAULT 0,
  -- Higher = evaluated first
  is_active BOOLEAN DEFAULT true,
  stop_processing BOOLEAN DEFAULT false,
  -- Se true, non valuta altre regole dopo match
  
  -- Stats
  times_triggered INTEGER DEFAULT 0,
  last_triggered_at TIMESTAMP WITH TIME ZONE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_email_rules_consultant ON email_rules(consultant_id);
CREATE INDEX idx_email_rules_active ON email_rules(is_active) WHERE is_active = true;
```

### FASE 4 - Audit & Advanced

```sql
-- Aggiungi campi avanzati a emails
ALTER TABLE emails ADD COLUMN client_id INTEGER REFERENCES users(id);
ALTER TABLE emails ADD COLUMN folder VARCHAR(50) DEFAULT 'inbox';
ALTER TABLE emails ADD COLUMN tags TEXT[] DEFAULT '{}';
ALTER TABLE emails ADD COLUMN snoozed_until TIMESTAMP WITH TIME ZONE;
ALTER TABLE emails ADD COLUMN escalated_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE emails ADD COLUMN escalated_to VARCHAR(255);
ALTER TABLE emails ADD COLUMN assigned_to INTEGER REFERENCES users(id);

-- ============================================
-- EMAIL_AUDIT_LOG - Audit trail
-- ============================================
CREATE TABLE email_audit_log (
  id SERIAL PRIMARY KEY,
  
  -- Context
  consultant_id INTEGER REFERENCES users(id),
  email_id INTEGER REFERENCES emails(id),
  account_id INTEGER REFERENCES email_accounts(id),
  
  -- Action
  action VARCHAR(50) NOT NULL,
  -- Valori: 'email_received' | 'ai_draft_generated' | 'draft_approved' | 
  --         'draft_rejected' | 'email_sent' | 'auto_reply_sent' | 
  --         'rule_triggered' | 'escalated' | 'account_connected' | etc.
  
  -- Details
  details JSONB,
  -- Contesto specifico dell'azione
  
  -- Actor
  performed_by VARCHAR(20),
  -- 'system' | 'ai' | 'user'
  user_id INTEGER REFERENCES users(id),
  
  ip_address INET,
  user_agent TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_audit_consultant ON email_audit_log(consultant_id);
CREATE INDEX idx_audit_email ON email_audit_log(email_id);
CREATE INDEX idx_audit_action ON email_audit_log(action);
CREATE INDEX idx_audit_created ON email_audit_log(created_at DESC);

-- ============================================
-- EMAIL_TEMPLATES - Template risposte
-- ============================================
CREATE TABLE email_templates (
  id SERIAL PRIMARY KEY,
  consultant_id INTEGER REFERENCES users(id),
  -- NULL = template globale (SuperAdmin)
  
  name VARCHAR(100) NOT NULL,
  category VARCHAR(50),
  -- 'out_of_office' | 'faq' | 'follow_up' | 'support' | etc.
  
  subject TEXT,
  body_html TEXT NOT NULL,
  body_text TEXT,
  
  -- Variables available: {{client_name}}, {{consultant_name}}, {{date}}, etc.
  variables JSONB DEFAULT '[]',
  
  is_active BOOLEAN DEFAULT true,
  usage_count INTEGER DEFAULT 0,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_templates_consultant ON email_templates(consultant_id);
```

---

## Backend API

### File Structure
```
server/
├── routes/
│   └── email-hub.ts              -- Route definitions
├── services/
│   ├── email-hub/
│   │   ├── account-service.ts    -- Account CRUD
│   │   ├── email-service.ts      -- Email operations
│   │   ├── sync-service.ts       -- IMAP sync (MVP)
│   │   ├── sync-oauth-service.ts -- OAuth sync (Fase 2)
│   │   ├── ai-service.ts         -- AI integration
│   │   └── rules-engine.ts       -- Rules processing (Fase 3)
│   └── encryption.ts             -- Credential encryption
└── types/
    └── email-hub.ts              -- TypeScript types
```

### API Endpoints

#### FASE 1 - MVP

```typescript
// ============================================
// ACCOUNTS
// ============================================

// POST /api/email-hub/accounts
// Crea nuovo account IMAP
Request: {
  display_name: string;
  email_address: string;
  imap_host: string;
  imap_port: number;
  imap_user: string;
  imap_password: string;
  imap_tls: boolean;
  smtp_host: string;
  smtp_port: number;
  smtp_user: string;
  smtp_password: string;
  smtp_tls: boolean;
  auto_reply_mode: 'manual' | 'review' | 'auto';
  confidence_threshold: number;
  ai_tone: string;
  signature?: string;
}
Response: { account: EmailAccount }

// GET /api/email-hub/accounts
// Lista account del consulente
Response: { accounts: EmailAccount[] }

// GET /api/email-hub/accounts/:id
// Dettaglio account
Response: { account: EmailAccount }

// PATCH /api/email-hub/accounts/:id
// Modifica account
Request: Partial<EmailAccount>
Response: { account: EmailAccount }

// DELETE /api/email-hub/accounts/:id
// Elimina account
Response: { success: true }

// POST /api/email-hub/accounts/:id/test
// Test connessione IMAP/SMTP
Response: { 
  imap: { success: boolean, error?: string },
  smtp: { success: boolean, error?: string }
}

// POST /api/email-hub/accounts/:id/sync
// Trigger sync manuale
Response: { success: true, emails_synced: number }

// ============================================
// EMAILS
// ============================================

// GET /api/email-hub/inbox
// Lista email (paginated)
Query: {
  account_id?: number;
  status?: string;
  is_read?: boolean;
  search?: string;
  page?: number;
  limit?: number;
  sort?: 'date_desc' | 'date_asc' | 'urgency';
}
Response: {
  emails: Email[];
  pagination: { page, limit, total, pages }
}

// GET /api/email-hub/emails/:id
// Dettaglio email con thread
Response: {
  email: Email;
  thread: Email[];
  ai_responses: AIResponse[];
}

// PATCH /api/email-hub/emails/:id
// Update email (read, starred, archived)
Request: { is_read?: boolean; is_starred?: boolean; is_archived?: boolean }
Response: { email: Email }

// POST /api/email-hub/emails/:id/draft
// Genera/rigenera bozza AI
Request: { 
  regenerate?: boolean;
  additional_context?: string;
}
Response: { ai_response: AIResponse }

// POST /api/email-hub/emails/:id/approve
// Approva bozza e invia
Request: {
  ai_response_id: number;
  edited_body?: string;  // Se modificata
}
Response: { success: true, sent_email: Email }

// POST /api/email-hub/emails/:id/reject
// Rifiuta bozza
Request: {
  ai_response_id: number;
  reason?: string;
}
Response: { success: true }

// POST /api/email-hub/emails/send
// Invia email manuale (nuova o reply)
Request: {
  account_id: number;
  to: string[];
  cc?: string[];
  subject: string;
  body_html: string;
  in_reply_to?: number;  // email_id se è una risposta
}
Response: { email: Email }

// ============================================
// STATS
// ============================================

// GET /api/email-hub/stats
// Statistiche inbox
Response: {
  total_emails: number;
  unread: number;
  pending_review: number;
  sent_today: number;
  ai_drafts_generated: number;
  ai_drafts_approved: number;
  avg_response_time: number;
}
```

#### FASE 2 - OAuth

```typescript
// GET /api/email-hub/oauth/google/start
// Avvia OAuth Google
Query: { account_id?: number }  // Se linking existing account
Response: Redirect to Google OAuth

// GET /api/email-hub/oauth/google/callback
// Callback OAuth Google
// Gestito internamente, redirect a frontend

// GET /api/email-hub/oauth/microsoft/start
// Avvia OAuth Microsoft
Query: { account_id?: number }
Response: Redirect to Microsoft OAuth

// GET /api/email-hub/oauth/microsoft/callback
// Callback OAuth Microsoft
```

#### FASE 3 - Rules

```typescript
// GET /api/email-hub/rules
// Lista regole
Response: { rules: EmailRule[] }

// POST /api/email-hub/rules
// Crea regola
Request: {
  name: string;
  trigger_type: string;
  conditions: object;
  action: string;
  action_config: object;
  priority?: number;
}
Response: { rule: EmailRule }

// PATCH /api/email-hub/rules/:id
// Modifica regola
Request: Partial<EmailRule>
Response: { rule: EmailRule }

// DELETE /api/email-hub/rules/:id
// Elimina regola
Response: { success: true }

// POST /api/email-hub/rules/:id/test
// Testa regola su email esistenti
Request: { email_ids?: number[] }  // Se vuoto, testa su ultime 50
Response: { 
  matches: { email_id: number, would_trigger: boolean }[] 
}
```

#### FASE 4 - SuperAdmin

```typescript
// GET /api/admin/email-hub/providers
// Lista OAuth providers configurati
Response: { providers: OAuthProvider[] }

// POST /api/admin/email-hub/providers
// Configura OAuth provider
Request: {
  provider: 'google' | 'microsoft';
  client_id: string;
  client_secret: string;
  scopes: string[];
}
Response: { provider: OAuthProvider }

// GET /api/admin/email-hub/stats
// Stats globali
Response: {
  total_accounts: number;
  active_syncs: number;
  emails_today: number;
  ai_usage: object;
}

// GET /api/admin/email-hub/audit
// Audit log
Query: { consultant_id?, action?, from?, to?, page?, limit? }
Response: { logs: AuditLog[], pagination }
```

---

## Frontend Components

### File Structure
```
client/src/
├── pages/
│   └── consultant/
│       └── email-hub/
│           ├── index.tsx           -- Main page
│           ├── accounts.tsx        -- Accounts management
│           └── rules.tsx           -- Rules editor (Fase 3)
├── components/
│   └── email-hub/
│       ├── EmailHubLayout.tsx      -- Layout con sidebar
│       ├── AccountList.tsx         -- Lista account sidebar
│       ├── AccountCard.tsx         -- Card singolo account
│       ├── AddAccountModal.tsx     -- Modal aggiungi IMAP
│       ├── AddAccountOAuth.tsx     -- OAuth buttons (Fase 2)
│       ├── InboxList.tsx           -- Lista email
│       ├── EmailListItem.tsx       -- Singola riga email
│       ├── EmailDetail.tsx         -- Dettaglio email
│       ├── EmailComposer.tsx       -- Composer email
│       ├── AIResponsePanel.tsx     -- Pannello bozza AI
│       ├── ThreadView.tsx          -- Vista thread
│       ├── SearchBar.tsx           -- Ricerca email
│       ├── FilterBar.tsx           -- Filtri
│       ├── SyncStatus.tsx          -- Indicatore sync
│       ├── RuleBuilder.tsx         -- Builder regole (Fase 3)
│       └── StatsCard.tsx           -- Card statistiche
└── hooks/
    └── use-email-hub.ts            -- React Query hooks
```

### Component Specifications

#### EmailHubLayout.tsx
```tsx
// Layout principale a 3 colonne
// Props: children
// 
// ┌────────────┬─────────────────┬────────────────────┐
// │  Sidebar   │   Email List    │   Email Detail     │
// │  (250px)   │    (350px)      │      (flex)        │
// │            │                 │                    │
// │ Accounts   │  InboxList      │  EmailDetail       │
// │ + Stats    │  + Filters      │  + AIPanel         │
// │            │                 │                    │
// └────────────┴─────────────────┴────────────────────┘
```

#### AccountList.tsx
```tsx
// Lista account nella sidebar
// 
// Features:
// - Lista account con icona provider
// - Badge stato sync (verde/rosso/giallo)
// - Contatore email non lette
// - Click per filtrare inbox
// - Pulsante "+ Aggiungi account"
//
// State:
// - selectedAccountId: number | null
// - accounts: EmailAccount[]
```

#### AddAccountModal.tsx
```tsx
// Modal per aggiungere account IMAP
//
// Steps:
// 1. Tipo account (IMAP generico / Gmail App Password)
// 2. Credenziali IMAP (host, port, user, password)
// 3. Credenziali SMTP
// 4. Test connessione
// 5. Impostazioni AI (mode, threshold, tone, signature)
//
// Validation:
// - Email format
// - Port numbers
// - Required fields
// - Test connection before save
```

#### InboxList.tsx
```tsx
// Lista email con infinite scroll
//
// Features:
// - Virtual scrolling per performance
// - Filtri: account, status, read/unread, date range
// - Ricerca full-text
// - Ordinamento: data, urgenza
// - Selezione multipla per azioni batch
// - Pull-to-refresh
//
// Props:
// - accountId?: number
// - onSelectEmail: (id: number) => void
// - selectedEmailId?: number
```

#### EmailDetail.tsx
```tsx
// Dettaglio email selezionata
//
// Tabs:
// 1. Email - Contenuto originale
// 2. AI Response - Bozza generata
// 3. Thread - Conversazione completa
//
// Actions:
// - Mark read/unread
// - Star
// - Archive
// - Reply (apre composer)
// - Forward
//
// AI Section (se processing_status === 'ai_draft_ready'):
// - Mostra bozza AI
// - Confidence badge
// - Reasoning collapsible
// - Approva / Modifica / Rifiuta
```

#### AIResponsePanel.tsx
```tsx
// Pannello gestione risposta AI
//
// States:
// - 'generating' - Spinner + "Generando risposta..."
// - 'ready' - Mostra bozza + azioni
// - 'editing' - Editor attivo
// - 'sending' - Invio in corso
// - 'sent' - Conferma invio
//
// Features:
// - Rich text preview bozza
// - Confidence meter (0-100%)
// - "Perché questa risposta?" - Mostra reasoning
// - Edit inline con TipTap/Slate
// - Rigenera con contesto aggiuntivo
```

#### SearchBar.tsx
```tsx
// Barra ricerca email
//
// Features:
// - Search-as-you-type (debounced 300ms)
// - Ricerca su: subject, from, body
// - Suggestions dropdown
// - Recent searches
// - Advanced search modal
```

### Hooks

```typescript
// hooks/use-email-hub.ts

// Accounts
export function useEmailAccounts() {
  return useQuery({
    queryKey: ['email-hub', 'accounts'],
    queryFn: () => api.get('/api/email-hub/accounts')
  });
}

export function useCreateAccount() {
  return useMutation({
    mutationFn: (data) => api.post('/api/email-hub/accounts', data),
    onSuccess: () => queryClient.invalidateQueries(['email-hub', 'accounts'])
  });
}

// Emails
export function useInbox(filters: InboxFilters) {
  return useInfiniteQuery({
    queryKey: ['email-hub', 'inbox', filters],
    queryFn: ({ pageParam = 1 }) => 
      api.get('/api/email-hub/inbox', { ...filters, page: pageParam }),
    getNextPageParam: (lastPage) => 
      lastPage.pagination.page < lastPage.pagination.pages 
        ? lastPage.pagination.page + 1 
        : undefined
  });
}

export function useEmail(id: number) {
  return useQuery({
    queryKey: ['email-hub', 'email', id],
    queryFn: () => api.get(`/api/email-hub/emails/${id}`)
  });
}

export function useGenerateDraft() {
  return useMutation({
    mutationFn: ({ emailId, regenerate }) => 
      api.post(`/api/email-hub/emails/${emailId}/draft`, { regenerate })
  });
}

export function useApproveDraft() {
  return useMutation({
    mutationFn: ({ emailId, aiResponseId, editedBody }) =>
      api.post(`/api/email-hub/emails/${emailId}/approve`, { 
        ai_response_id: aiResponseId, 
        edited_body: editedBody 
      }),
    onSuccess: () => queryClient.invalidateQueries(['email-hub', 'inbox'])
  });
}

// Stats
export function useEmailStats() {
  return useQuery({
    queryKey: ['email-hub', 'stats'],
    queryFn: () => api.get('/api/email-hub/stats'),
    refetchInterval: 30000 // Refresh ogni 30s
  });
}
```

---

## Sync Services

### FASE 1 - IMAP IDLE Service

```typescript
// server/services/email-hub/sync-service.ts

import Imap from 'imap';
import { simpleParser } from 'mailparser';

interface SyncConnection {
  imap: Imap;
  accountId: number;
  consultantId: number;
  lastSeq: number;
}

class EmailSyncService {
  private connections: Map<number, SyncConnection> = new Map();
  private reconnectAttempts: Map<number, number> = new Map();
  private MAX_RECONNECT_ATTEMPTS = 5;
  private RECONNECT_DELAY = 5000;

  // Avvia sync per un account
  async startSync(accountId: number): Promise<void> {
    const account = await this.getAccount(accountId);
    if (!account || !account.is_active) return;

    // Evita connessioni duplicate
    if (this.connections.has(accountId)) {
      await this.stopSync(accountId);
    }

    const imap = new Imap({
      user: account.imap_user,
      password: await decrypt(account.imap_password),
      host: account.imap_host,
      port: account.imap_port,
      tls: account.imap_tls,
      tlsOptions: { rejectUnauthorized: false },
      keepalive: {
        interval: 10000,
        idleInterval: 300000, // 5 min IDLE refresh
        forceNoop: true
      }
    });

    imap.once('ready', async () => {
      console.log(`[Sync] Account ${accountId} connected`);
      await this.updateSyncStatus(accountId, 'connected');
      
      imap.openBox('INBOX', false, async (err, box) => {
        if (err) {
          console.error(`[Sync] Error opening INBOX:`, err);
          return;
        }

        // Sync iniziale: ultime 50 email
        await this.fetchRecentEmails(imap, account, 50);

        // IMAP IDLE: ascolta nuove email
        imap.on('mail', async (numNew: number) => {
          console.log(`[Sync] ${numNew} new email(s) for account ${accountId}`);
          await this.fetchNewEmails(imap, account, numNew);
        });

        // Gestisci modifiche (flag changes)
        imap.on('update', async (seqno: number, info: any) => {
          console.log(`[Sync] Email ${seqno} updated:`, info);
        });
      });
    });

    imap.once('error', async (err: Error) => {
      console.error(`[Sync] Account ${accountId} error:`, err);
      await this.updateSyncStatus(accountId, 'error', err.message);
      await this.handleReconnect(accountId);
    });

    imap.once('end', async () => {
      console.log(`[Sync] Account ${accountId} disconnected`);
      await this.updateSyncStatus(accountId, 'idle');
      await this.handleReconnect(accountId);
    });

    imap.connect();

    this.connections.set(accountId, {
      imap,
      accountId,
      consultantId: account.consultant_id,
      lastSeq: 0
    });
  }

  // Ferma sync per un account
  async stopSync(accountId: number): Promise<void> {
    const conn = this.connections.get(accountId);
    if (conn) {
      conn.imap.end();
      this.connections.delete(accountId);
    }
    this.reconnectAttempts.delete(accountId);
  }

  // Fetch email recenti
  private async fetchRecentEmails(
    imap: Imap, 
    account: EmailAccount, 
    count: number
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      imap.search(['ALL'], (err, results) => {
        if (err) return reject(err);
        
        const toFetch = results.slice(-count);
        if (toFetch.length === 0) return resolve();

        const fetch = imap.fetch(toFetch, {
          bodies: '',
          struct: true
        });

        fetch.on('message', (msg, seqno) => {
          this.processMessage(msg, seqno, account);
        });

        fetch.once('end', () => {
          this.updateLastSync(account.id);
          resolve();
        });
      });
    });
  }

  // Fetch nuove email (triggered da IDLE)
  private async fetchNewEmails(
    imap: Imap,
    account: EmailAccount,
    count: number
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      imap.search(['UNSEEN'], (err, results) => {
        if (err) return reject(err);
        if (results.length === 0) return resolve();

        const fetch = imap.fetch(results, {
          bodies: '',
          struct: true,
          markSeen: false
        });

        fetch.on('message', (msg, seqno) => {
          this.processMessage(msg, seqno, account);
        });

        fetch.once('end', () => {
          this.updateLastSync(account.id);
          resolve();
        });
      });
    });
  }

  // Processa singolo messaggio
  private async processMessage(
    msg: any, 
    seqno: number, 
    account: EmailAccount
  ): Promise<void> {
    let buffer = '';

    msg.on('body', (stream: any) => {
      stream.on('data', (chunk: Buffer) => {
        buffer += chunk.toString('utf8');
      });
    });

    msg.once('end', async () => {
      try {
        const parsed = await simpleParser(buffer);
        
        // Check duplicati
        const existing = await this.findByMessageId(parsed.messageId);
        if (existing) return;

        // Salva email
        const email = await this.saveEmail({
          account_id: account.id,
          consultant_id: account.consultant_id,
          message_id: parsed.messageId,
          thread_id: this.extractThreadId(parsed),
          in_reply_to: parsed.inReplyTo,
          subject: parsed.subject || '(no subject)',
          from_name: parsed.from?.value[0]?.name || '',
          from_email: parsed.from?.value[0]?.address || '',
          to_recipients: parsed.to?.value || [],
          cc_recipients: parsed.cc?.value || [],
          body_html: parsed.html || '',
          body_text: parsed.text || '',
          snippet: (parsed.text || '').substring(0, 200),
          attachments: this.extractAttachments(parsed.attachments),
          has_attachments: (parsed.attachments?.length || 0) > 0,
          direction: 'inbound',
          received_at: parsed.date || new Date(),
          processing_status: 'new'
        });

        // Trigger AI processing
        await this.triggerAIProcessing(email, account);

      } catch (error) {
        console.error('[Sync] Error processing message:', error);
      }
    });
  }

  // Trigger AI classification e draft
  private async triggerAIProcessing(
    email: Email, 
    account: EmailAccount
  ): Promise<void> {
    // Update status
    await this.updateEmailStatus(email.id, 'pending_ai');

    // Se modalità manual, non generare AI
    if (account.auto_reply_mode === 'manual') {
      await this.updateEmailStatus(email.id, 'awaiting_review');
      return;
    }

    try {
      // Classifica email
      const classification = await aiService.classifyEmail(email);
      await this.updateEmailClassification(email.id, classification);

      // Genera bozza
      const draft = await aiService.generateDraft(email, account, classification);
      await this.saveAIDraft(email.id, draft);

      // Se auto mode e confidence alta, invia
      if (
        account.auto_reply_mode === 'auto' && 
        draft.confidence >= account.confidence_threshold
      ) {
        await this.autoSendDraft(email, draft, account);
      } else {
        await this.updateEmailStatus(email.id, 'ai_draft_ready');
      }

    } catch (error) {
      console.error('[AI] Processing error:', error);
      await this.updateEmailStatus(email.id, 'error');
    }
  }

  // Reconnect logic
  private async handleReconnect(accountId: number): Promise<void> {
    const attempts = this.reconnectAttempts.get(accountId) || 0;
    
    if (attempts >= this.MAX_RECONNECT_ATTEMPTS) {
      console.log(`[Sync] Max reconnect attempts reached for ${accountId}`);
      this.reconnectAttempts.delete(accountId);
      return;
    }

    this.reconnectAttempts.set(accountId, attempts + 1);
    
    setTimeout(async () => {
      console.log(`[Sync] Reconnecting account ${accountId} (attempt ${attempts + 1})`);
      await this.startSync(accountId);
    }, this.RECONNECT_DELAY * (attempts + 1));
  }

  // Avvia sync per tutti gli account attivi
  async startAllSyncs(): Promise<void> {
    const accounts = await this.getActiveAccounts();
    for (const account of accounts) {
      await this.startSync(account.id);
    }
  }

  // Ferma tutti i sync
  async stopAllSyncs(): Promise<void> {
    for (const [accountId] of this.connections) {
      await this.stopSync(accountId);
    }
  }
}

export const emailSyncService = new EmailSyncService();
```

### FASE 2 - OAuth Sync Extensions

```typescript
// server/services/email-hub/sync-oauth-service.ts

import { google } from 'googleapis';
import { Client } from '@microsoft/microsoft-graph-client';

class OAuthSyncService extends EmailSyncService {

  // Gmail Pub/Sub setup
  async setupGmailWatch(account: EmailAccount): Promise<void> {
    const oauth2Client = await this.getGoogleOAuthClient(account);
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    // Registra watch
    const response = await gmail.users.watch({
      userId: 'me',
      requestBody: {
        topicName: process.env.GOOGLE_PUBSUB_TOPIC,
        labelIds: ['INBOX']
      }
    });

    // Salva expiration per renewal
    await this.updateAccountWatchExpiration(
      account.id, 
      new Date(parseInt(response.data.expiration!))
    );

    console.log(`[Gmail] Watch registered for ${account.email_address}`);
  }

  // Handle Gmail Pub/Sub notification
  async handleGmailPush(message: any): Promise<void> {
    const data = JSON.parse(
      Buffer.from(message.data, 'base64').toString()
    );

    const account = await this.findAccountByEmail(data.emailAddress);
    if (!account) return;

    // Fetch changes using history API
    const oauth2Client = await this.getGoogleOAuthClient(account);
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    const history = await gmail.users.history.list({
      userId: 'me',
      startHistoryId: account.last_history_id,
      historyTypes: ['messageAdded']
    });

    if (history.data.history) {
      for (const h of history.data.history) {
        for (const msg of h.messagesAdded || []) {
          await this.fetchGmailMessage(gmail, account, msg.message!.id!);
        }
      }
    }

    // Update history ID
    await this.updateHistoryId(account.id, history.data.historyId);
  }

  // Microsoft Graph webhook setup
  async setupGraphSubscription(account: EmailAccount): Promise<void> {
    const client = await this.getMicrosoftClient(account);

    const subscription = await client
      .api('/subscriptions')
      .post({
        changeType: 'created',
        notificationUrl: `${process.env.BASE_URL}/api/webhooks/microsoft`,
        resource: "/me/mailFolders('Inbox')/messages",
        expirationDateTime: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
        clientState: account.id.toString()
      });

    await this.saveSubscriptionId(account.id, subscription.id);
    console.log(`[Graph] Subscription created for ${account.email_address}`);
  }

  // Handle Microsoft Graph notification
  async handleGraphNotification(notification: any): Promise<void> {
    const accountId = parseInt(notification.clientState);
    const account = await this.getAccount(accountId);
    if (!account) return;

    const client = await this.getMicrosoftClient(account);

    // Fetch the message
    const message = await client
      .api(`/me/messages/${notification.resourceData.id}`)
      .get();

    await this.processGraphMessage(message, account);
  }

  // Token refresh job (cron ogni 5 minuti)
  async refreshExpiringTokens(): Promise<void> {
    const expiringAccounts = await this.getAccountsWithExpiringTokens(10); // 10 min buffer

    for (const account of expiringAccounts) {
      try {
        if (account.oauth_provider === 'google') {
          await this.refreshGoogleToken(account);
        } else if (account.oauth_provider === 'microsoft') {
          await this.refreshMicrosoftToken(account);
        }
      } catch (error) {
        console.error(`[OAuth] Failed to refresh token for ${account.id}:`, error);
        await this.updateSyncStatus(account.id, 'error', 'Token refresh failed');
      }
    }
  }
}

export const oauthSyncService = new OAuthSyncService();
```

---

## AI Integration

### AI Service

```typescript
// server/services/email-hub/ai-service.ts

import { GoogleGenerativeAI } from '@google/generative-ai';

interface EmailClassification {
  intent: 'info_request' | 'support' | 'complaint' | 'sales' | 'spam' | 'other';
  urgency: 'low' | 'medium' | 'high' | 'critical';
  sentiment: 'positive' | 'neutral' | 'negative';
  category: string;
  extracted_entities: {
    client_name?: string;
    order_number?: string;
    dates?: string[];
    amounts?: string[];
  };
  summary: string;
}

interface AIDraft {
  subject: string;
  body_html: string;
  body_text: string;
  reasoning: {
    thought_process: string;
    key_points: string[];
    tone_used: string;
    confidence_factors: string[];
  };
  confidence: number;
}

class EmailAIService {
  private genAI: GoogleGenerativeAI;
  private model: any;

  constructor() {
    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
    this.model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-pro' });
  }

  // Classifica email
  async classifyEmail(email: Email): Promise<EmailClassification> {
    const prompt = `
Analizza questa email e fornisci una classificazione strutturata.

EMAIL:
Da: ${email.from_name} <${email.from_email}>
Oggetto: ${email.subject}
Contenuto:
${email.body_text || this.stripHtml(email.body_html)}

Rispondi SOLO con un JSON valido nel formato:
{
  "intent": "info_request|support|complaint|sales|spam|other",
  "urgency": "low|medium|high|critical",
  "sentiment": "positive|neutral|negative",
  "category": "string descrittiva",
  "extracted_entities": {
    "client_name": "se identificabile",
    "order_number": "se presente",
    "dates": ["date menzionate"],
    "amounts": ["importi menzionati"]
  },
  "summary": "riassunto in 1-2 frasi"
}
`;

    const result = await this.model.generateContent(prompt);
    const text = result.response.text();
    
    // Parse JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('Invalid AI response');
    
    return JSON.parse(jsonMatch[0]);
  }

  // Genera bozza risposta
  async generateDraft(
    email: Email, 
    account: EmailAccount,
    classification: EmailClassification
  ): Promise<AIDraft> {
    // Recupera contesto
    const clientHistory = await this.getClientHistory(email.from_email, account.consultant_id);
    const consultantProfile = await this.getConsultantProfile(account.consultant_id);
    const relevantKnowledge = await this.searchKnowledgeBase(email.subject, email.body_text);

    const prompt = `
Sei un assistente che scrive email per conto di un consulente. 
Genera una risposta professionale all'email seguente.

PROFILO CONSULENTE:
Nome: ${consultantProfile.name}
Tono preferito: ${account.ai_tone}
Firma: ${account.signature || consultantProfile.signature || ''}

EMAIL RICEVUTA:
Da: ${email.from_name} <${email.from_email}>
Oggetto: ${email.subject}
Contenuto:
${email.body_text || this.stripHtml(email.body_html)}

CLASSIFICAZIONE:
- Intent: ${classification.intent}
- Urgenza: ${classification.urgency}
- Sentiment: ${classification.sentiment}
- Riassunto: ${classification.summary}

${clientHistory.length > 0 ? `
STORICO CON QUESTO CLIENTE:
${clientHistory.map(h => `- ${h.date}: ${h.summary}`).join('\n')}
` : ''}

${relevantKnowledge ? `
INFORMAZIONI DALLA KNOWLEDGE BASE:
${relevantKnowledge}
` : ''}

ISTRUZIONI:
1. Rispondi in modo ${account.ai_tone === 'formal' ? 'formale' : 'amichevole ma professionale'}
2. Indirizza i punti principali dell'email
3. Se non hai informazioni sufficienti per rispondere completamente, 
   indica cosa chiedere o verificare
4. Non inventare informazioni specifiche (prezzi, date, etc.)

Rispondi con un JSON:
{
  "subject": "Re: oggetto originale o nuovo oggetto se appropriato",
  "body_html": "risposta in HTML con formattazione",
  "body_text": "risposta in testo semplice",
  "reasoning": {
    "thought_process": "spiegazione del tuo ragionamento",
    "key_points": ["punti chiave affrontati"],
    "tone_used": "tono usato",
    "confidence_factors": ["fattori che influenzano la confidenza"]
  },
  "confidence": 0.0-1.0
}
`;

    const result = await this.model.generateContent(prompt);
    const text = result.response.text();
    
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('Invalid AI response');
    
    const draft = JSON.parse(jsonMatch[0]);
    
    // Aggiungi firma se presente
    if (account.signature) {
      draft.body_html += `<br><br>${account.signature}`;
      draft.body_text += `\n\n${this.stripHtml(account.signature)}`;
    }

    return draft;
  }

  // Helpers
  private stripHtml(html: string): string {
    return html?.replace(/<[^>]*>/g, '') || '';
  }

  private async getClientHistory(email: string, consultantId: number) {
    // Query database per email precedenti con questo client
    return [];
  }

  private async getConsultantProfile(consultantId: number) {
    // Query database per profilo consulente
    return { name: '', signature: '' };
  }

  private async searchKnowledgeBase(subject: string, body: string) {
    // Query knowledge base per documenti rilevanti
    return '';
  }
}

export const emailAIService = new EmailAIService();
```

---

## Security

### Encryption

```typescript
// server/services/encryption.ts

import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const KEY = Buffer.from(process.env.ENCRYPTION_KEY!, 'hex'); // 32 bytes

export function encrypt(text: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag();
  
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

export function decrypt(encryptedText: string): string {
  const [ivHex, authTagHex, encrypted] = encryptedText.split(':');
  
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  
  const decipher = crypto.createDecipheriv(ALGORITHM, KEY, iv);
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}
```

### Multi-tenant Isolation

```typescript
// Middleware per isolamento tenant
export function tenantIsolation(req, res, next) {
  // Aggiungi consultant_id a tutte le query
  req.tenantFilter = {
    consultant_id: req.user.id
  };
  next();
}

// Uso nelle query
async function getEmails(req) {
  return db.query(
    `SELECT * FROM emails 
     WHERE consultant_id = $1 
     ORDER BY received_at DESC`,
    [req.tenantFilter.consultant_id]
  );
}
```

### Rate Limiting

```typescript
// Rate limits per Email Hub
export const emailHubLimits = {
  ai_drafts: {
    window: 60 * 1000, // 1 minuto
    max: 10
  },
  emails_sent: {
    window: 60 * 60 * 1000, // 1 ora
    max: 50
  },
  sync_requests: {
    window: 60 * 1000,
    max: 5
  }
};
```

### Audit Logging

```typescript
// Funzione per audit log
async function auditLog(action: string, context: any) {
  await db.insert(emailAuditLog).values({
    consultant_id: context.consultantId,
    email_id: context.emailId,
    account_id: context.accountId,
    action,
    details: context.details,
    performed_by: context.performedBy,
    user_id: context.userId,
    ip_address: context.ipAddress
  });
}

// Uso
await auditLog('email_sent', {
  consultantId: 123,
  emailId: 456,
  details: { to: 'client@email.com', subject: 'Re: Question' },
  performedBy: 'user',
  userId: 123
});
```

---

## Deployment Checklist

### MVP Launch
- [ ] Database migrations eseguite
- [ ] Environment variables configurate
  - `ENCRYPTION_KEY` (32 bytes hex)
  - `GEMINI_API_KEY`
- [ ] IMAP sync service avviato
- [ ] Frontend deployed
- [ ] Test end-to-end completati

### Fase 2 Launch
- [ ] OAuth providers configurati (SuperAdmin)
  - Google Cloud Console: OAuth app + Pub/Sub
  - Azure Portal: App registration
- [ ] Webhook endpoints pubblici
- [ ] Cron job per token refresh

### Fase 3 Launch
- [ ] Rules engine testato
- [ ] Default rules create

### Fase 4 Launch
- [ ] SuperAdmin dashboard
- [ ] Audit log retention policy
- [ ] Monitoring & alerting

---

## Testing

### Unit Tests
```typescript
// tests/email-hub/ai-service.test.ts
describe('EmailAIService', () => {
  it('should classify support request correctly', async () => {
    const email = { subject: 'Help needed', body_text: 'I have a problem...' };
    const result = await aiService.classifyEmail(email);
    expect(result.intent).toBe('support');
  });
});
```

### Integration Tests
```typescript
// tests/email-hub/sync.test.ts
describe('EmailSyncService', () => {
  it('should connect to IMAP server', async () => {
    const result = await syncService.testConnection(mockAccount);
    expect(result.imap.success).toBe(true);
  });
});
```

### E2E Tests
```typescript
// tests/e2e/email-hub.test.ts
describe('Email Hub E2E', () => {
  it('should receive email and generate AI draft', async () => {
    // Send test email
    // Wait for sync
    // Check AI draft generated
  });
});
```
