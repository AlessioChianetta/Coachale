# Sistema Email Nurturing 365 - Report Completo

## Executive Summary

Sistema email dual-purpose per lead proattivi completamente implementato:
1. **Email di benvenuto automatica** dopo messaggi WhatsApp con hook AI personalizzati
2. **Sistema nurturing annuale** con 365 email generate da AI, invio giornaliero automatico alle 09:00 (Europe/Rome)

---

## Database Schema

### Campi aggiunti a `proactive_leads`

```sql
-- Campi nurturing (già applicati al database)
nurturing_enabled          BOOLEAN DEFAULT false
nurturing_start_date       DATE
nurturing_emails_sent      INTEGER DEFAULT 0
nurturing_last_email_at    TIMESTAMP
nurturing_opt_out_at       TIMESTAMP
```

### Tabella `lead_nurturing_templates`

```typescript
leadNurturingTemplates = pgTable("lead_nurturing_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  consultantId: varchar("consultant_id").references(() => users.id),
  dayNumber: integer("day_number").notNull(),  // 1-365
  subject: text("subject").notNull(),
  body: text("body").notNull(),
  category: text("category"),  // education | tips | motivation | seasonal | cta
  tone: text("tone"),          // professionale | amichevole | motivazionale
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at"),
  updatedAt: timestamp("updated_at"),
});
```

### Tabella `lead_nurturing_config`

```typescript
leadNurturingConfig = pgTable("lead_nurturing_config", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  consultantId: varchar("consultant_id").unique(),
  templatesGenerated: boolean("templates_generated").default(false),
  templatesGeneratedAt: timestamp("templates_generated_at"),
  templatesCount: integer("templates_count").default(0),
  businessDescription: text("business_description"),
  referenceEmail: text("reference_email"),
  preferredTone: text("preferred_tone"),  // professionale | amichevole | motivazionale
  isEnabled: boolean("is_enabled").default(true),
  skipWeekends: boolean("skip_weekends").default(false),
  createdAt: timestamp("created_at"),
  updatedAt: timestamp("updated_at"),
});
```

### Tabella `lead_nurturing_logs`

```typescript
leadNurturingLogs = pgTable("lead_nurturing_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  leadId: varchar("lead_id").references(() => proactiveLeads.id),
  templateId: varchar("template_id").references(() => leadNurturingTemplates.id),
  consultantId: varchar("consultant_id").references(() => users.id),
  dayNumber: integer("day_number").notNull(),
  cycleNumber: integer("cycle_number").default(1),
  status: text("status"),  // sent | failed | skipped
  errorMessage: text("error_message"),
  emailMessageId: text("email_message_id"),
  sentAt: timestamp("sent_at"),
  openedAt: timestamp("opened_at"),
  clickedAt: timestamp("clicked_at"),
  emailTo: text("email_to"),
});
```

### Tabella `consultant_email_variables`

```typescript
consultantEmailVariables = pgTable("consultant_email_variables", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  consultantId: varchar("consultant_id").unique(),
  calendarLink: text("calendar_link"),
  businessName: text("business_name"),
  whatsappNumber: text("whatsapp_number"),
  emailSignature: text("email_signature"),
  customVariables: jsonb("custom_variables").$type<Record<string, string>>(),
  createdAt: timestamp("created_at"),
  updatedAt: timestamp("updated_at"),
});
```

---

## Backend Implementation

### File Creati/Modificati

| File | Descrizione |
|------|-------------|
| `server/services/template-compiler.ts` | Compilatore variabili dinamiche con XSS sanitization |
| `server/services/lead-nurturing-generation-service.ts` | Generazione 365 templates con Gemini 3 Preview + SSE |
| `server/services/proactive-lead-welcome-email.ts` | Email di benvenuto AI con hook personalizzati |
| `server/routes/lead-nurturing.ts` | API REST per config, templates, variables, analytics |
| `server/routes/public-unsubscribe.ts` | Endpoint pubblico GDPR opt-out |
| `server/cron/nurturing-scheduler.ts` | Cron job invio giornaliero 09:00 + cleanup domenicale |

### API Endpoints

#### Lead Nurturing (`/api/lead-nurturing/*`) - Autenticato

| Metodo | Endpoint | Descrizione |
|--------|----------|-------------|
| GET | `/api/lead-nurturing/config` | Ottiene configurazione nurturing |
| PUT | `/api/lead-nurturing/config` | Aggiorna configurazione |
| GET | `/api/lead-nurturing/templates` | Lista tutti i templates (365) |
| GET | `/api/lead-nurturing/templates/:dayNumber` | Template specifico per giorno |
| PUT | `/api/lead-nurturing/templates/:dayNumber` | Modifica template giorno |
| DELETE | `/api/lead-nurturing/templates/:dayNumber` | Disattiva template |
| GET | `/api/lead-nurturing/variables` | Variabili email consultant |
| PUT | `/api/lead-nurturing/variables` | Aggiorna variabili |
| POST | `/api/lead-nurturing/generate` | Genera 365 templates (SSE streaming) |
| GET | `/api/lead-nurturing/analytics` | Statistiche invio/apertura/click |
| POST | `/api/lead-nurturing/test-send/:leadId` | Invio email test a lead |

#### Public Unsubscribe (`/unsubscribe/*`)

| Metodo | Endpoint | Descrizione |
|--------|----------|-------------|
| GET | `/unsubscribe/:token` | Pagina conferma disiscrizione |
| POST | `/unsubscribe/:token` | Processa disiscrizione (GDPR) |

### Variabili Template Supportate

```
{{nome}}              - Nome lead
{{email}}             - Email lead
{{telefono}}          - Telefono lead
{{azienda}}           - Nome azienda consultant
{{linkCalendario}}    - Link prenotazione
{{whatsapp}}          - Numero WhatsApp
{{firma}}             - Firma email
{{giorno}}            - Giorno corrente (1-365)
{{linkDisiscrizione}} - Link opt-out GDPR
{{[customKey]}}       - Variabili personalizzate
```

### Cron Jobs

| Schedule | Timezone | Descrizione |
|----------|----------|-------------|
| `0 9 * * *` | Europe/Rome | Invio email nurturing giornaliero |
| `0 3 * * 0` | Europe/Rome | Cleanup log > 30 giorni (domenica) |

### AI Integration

- **Provider**: Gemini 3 Preview via `provider-factory.ts`
- **Batch generation**: 365 templates in ~10-15 minuti
- **SSE Progress**: Streaming real-time durante generazione
- **Token optimization**: Generazione batch per categoria

### Distribuzione Categories (365 giorni)

| Giorni | Categoria | Focus |
|--------|-----------|-------|
| 1-3 | welcome | Benvenuto e onboarding |
| 4-63 | education | Contenuti formativi |
| 64-123 | value | Valore e benefici |
| 124-183 | trust | Costruzione fiducia |
| 184-243 | engagement | Coinvolgimento attivo |
| 244-303 | conversion | Call-to-action |
| 304-365 | retention | Fidelizzazione |

---

## GDPR Compliance

### Opt-Out Flow

1. Email contiene `{{linkDisiscrizione}}` con token univoco HMAC-signed
2. Utente clicca link → Pagina conferma
3. Server valida signature HMAC-SHA256 del token
4. Utente conferma → `nurturingOptOutAt` viene impostato
5. Lead rimosso automaticamente da sequenza

### Token Generation & Validation (Secure)

```typescript
// Token formato: leadId:consultantId:hmacSignature
const token = generateUnsubscribeToken(leadId, consultantId);
// Esempio: "abc123-def456:xyz789-abc123:Kx9mN2pLqR1s..."

// Validation verifica HMAC signature
function validateUnsubscribeToken(token: string) {
  const [leadId, consultantId, signature] = token.split(":");
  const expectedSignature = crypto
    .createHmac("sha256", UNSUBSCRIBE_SECRET)
    .update(`${leadId}:${consultantId}`)
    .digest("base64url").substring(0, 32);
  return signature === expectedSignature;
}
```

### Security Features

- **HMAC-SHA256**: Token non indovinabile, richiede secret server-side
- **Consultant verification**: Token legato a consultant specifico
- **Signature validation**: Rifiuta token forgiati o modificati

### Rate Limiting

- Welcome emails: max 5/min per lead
- Nurturing batch: max 50/min per consultant
- Cooldown inter-email: min 20 ore

---

## Storage Methods

### Nuovi metodi in `server/storage.ts`

```typescript
// Lead email helper (usa email diretta o da leadInfo)
getLeadEmail(lead: ProactiveLead): string | null

// Email variables CRUD
getEmailVariables(consultantId: string): Promise<ConsultantEmailVariables | null>
upsertEmailVariables(consultantId: string, data: Partial<InsertConsultantEmailVariables>): Promise<ConsultantEmailVariables>

// Nurturing config CRUD
getNurturingConfig(consultantId: string): Promise<LeadNurturingConfig | null>
upsertNurturingConfig(consultantId: string, data: Partial<InsertLeadNurturingConfig>): Promise<LeadNurturingConfig>

// Templates CRUD
getNurturingTemplates(consultantId: string): Promise<LeadNurturingTemplate[]>
getNurturingTemplate(consultantId: string, dayNumber: number): Promise<LeadNurturingTemplate | null>
upsertNurturingTemplate(consultantId: string, dayNumber: number, data: Partial<InsertLeadNurturingTemplate>): Promise<LeadNurturingTemplate>
deleteNurturingTemplates(consultantId: string): Promise<void>

// Logs
createNurturingLog(data: InsertLeadNurturingLog): Promise<LeadNurturingLog>
getNurturingLogs(consultantId: string, options?: { leadId?: string; limit?: number }): Promise<LeadNurturingLog[]>
```

---

## Environment Variables

| Variable | Default | Descrizione |
|----------|---------|-------------|
| `NURTURING_SCHEDULER_ENABLED` | `true` | Abilita/disabilita cron nurturing |
| `UNSUBSCRIBE_SECRET` | (generato) | Secret per token disiscrizione |

---

## Testing Checklist

### 1. Database

```sql
-- Verifica tabelle esistono
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name LIKE '%nurturing%';

-- Verifica campi proactive_leads
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'proactive_leads' 
AND column_name LIKE '%nurturing%';
```

### 2. API Endpoints

```bash
# Test config (autenticato)
curl -X GET http://localhost:5000/api/lead-nurturing/config \
  -H "Authorization: Bearer TOKEN"

# Test unsubscribe (pubblico)
curl -X GET http://localhost:5000/unsubscribe/test-token-123
```

### 3. Cron Job

- Verificare nei log: `"✅ Nurturing scheduler started (09:00 Europe/Rome daily)"`
- Attendere 09:00 Europe/Rome per test reale
- Oppure trigger manuale via API test

### 4. Template Generation

1. Andare su pagina Lead Nurturing (da implementare frontend)
2. Configurare business description e tone
3. Cliccare "Genera 365 Templates"
4. Verificare progress SSE
5. Verificare templates generati

### 5. Email Variables

1. Configurare `calendarLink`, `businessName`, etc.
2. Creare template con `{{linkCalendario}}`
3. Inviare email test
4. Verificare variabili sostituite

### 6. GDPR Unsubscribe

1. Inviare email con link disiscrizione
2. Cliccare link nell'email
3. Verificare pagina conferma
4. Confermare disiscrizione
5. Verificare `nurturingOptOutAt` nel database

---

## Known Issues / TODO

### Da Completare (Priorità Alta)
1. **Frontend UI**: La pagina gestione nurturing nel pannello consultant è da implementare
2. **Email Tracking**: Pixel tracking apertura/click con endpoint dedicati

### Funzionali ma Opzionali
3. **Per-consultant Schedule**: Il cron usa 09:00 Europe/Rome fisso; la config `sendHour/sendMinute/timezone` è nel DB ma non usata dal cron
4. **Welcome Email Auto-trigger**: L'integrazione automatica con WhatsApp è disponibile ma richiede test E2E

### Note Tecniche
- L'errore WebSocket nei browser logs (`wss://localhost:undefined`) è un problema pre-esistente del Vite HMR, non correlato al nurturing system

---

## File Structure

```
server/
├── cron/
│   └── nurturing-scheduler.ts      # Cron job 09:00 + cleanup
├── routes/
│   ├── lead-nurturing.ts           # API REST nurturing
│   └── public-unsubscribe.ts       # Endpoint GDPR pubblico
├── services/
│   ├── template-compiler.ts        # Compilatore variabili
│   ├── lead-nurturing-generation-service.ts  # Generazione AI 365 templates
│   └── proactive-lead-welcome-email.ts       # Welcome email AI
└── storage.ts                      # CRUD methods

shared/
└── schema.ts                       # Tabelle Drizzle ORM

client/
└── src/pages/proactive-leads.tsx   # UI leads (parziale)
```

---

## Changelog

- **v1.1.0** - 2026-01-15 (Current)
  - Fix critico: Validazione HMAC-SHA256 per token unsubscribe
  - Fix: Route paths allineati a `/api/lead-nurturing/*`
  - Export funzione `generateUnsubscribeToken` per riuso cross-module
  
- **v1.0.0** - 2026-01-15
  - Schema database completo (4 tabelle + 5 campi proactive_leads)
  - Backend services (template compiler, generation, welcome email)
  - API REST completa (config, templates, variables, analytics)
  - Cron job nurturing 09:00 Europe/Rome
  - GDPR unsubscribe endpoint pubblico
  - Integrazione Gemini 3 Preview via provider-factory
