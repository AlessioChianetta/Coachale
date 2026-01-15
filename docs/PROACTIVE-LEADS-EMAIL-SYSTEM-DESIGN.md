# Sistema Email per Lead Proattivi - Documento di Design

**Versione:** 1.0  
**Data:** Gennaio 2026  
**Autore:** Sistema AI

---

## Indice

1. [Panoramica Generale](#1-panoramica-generale)
2. [Parte 1: Email di Benvenuto Lead Proattivi](#2-parte-1-email-di-benvenuto-lead-proattivi)
3. [Parte 2: Sistema Email Nurturing Annuale (365 giorni)](#3-parte-2-sistema-email-nurturing-annuale-365-giorni)
4. [Schema Database Completo](#4-schema-database-completo)
5. [API Backend](#5-api-backend)
6. [Frontend UI/UX](#6-frontend-uiux)
7. [Variabili Dinamiche](#7-variabili-dinamiche)
8. [Considerazioni Tecniche](#8-considerazioni-tecniche)

---

## 1. Panoramica Generale

Il sistema si compone di due funzionalità complementari per la gestione delle comunicazioni email verso i lead proattivi (non-clienti):

| Funzionalità | Descrizione | Frequenza |
|-------------|-------------|-----------|
| **Email di Benvenuto** | Email semplice inviata insieme al primo messaggio WhatsApp | Una tantum (primo contatto) |
| **Email Nurturing Annuale** | 365 email precompilate di valore, inviate a rotazione | 1 al giorno per 365 giorni |

### Obiettivi Comuni
- Convertire lead in appuntamenti/clienti
- Fornire valore costante senza intervento manuale
- Mantenere il contatto attivo nel tempo
- Guidare verso WhatsApp come canale principale di comunicazione

---

## 2. Parte 1: Email di Benvenuto Lead Proattivi

### 2.1 Diagramma di Flusso

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         CREAZIONE LEAD PROATTIVO                             │
│   (Nome, Telefono, Email*, Obiettivi, Agente WhatsApp, Data Contatto)       │
└────────────────────────────────────┬────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    SCHEDULER: contactSchedule scade                          │
│                         (cron job ogni minuto)                               │
└────────────────────────────────────┬────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                      VERIFICA DATI DISPONIBILI                               │
└─────────────┬───────────────────────────────────────────────┬───────────────┘
              │                                               │
              ▼                                               ▼
┌─────────────────────────────┐                 ┌─────────────────────────────┐
│   📱 INVIO WHATSAPP         │                 │   📧 VERIFICA EMAIL         │
│   (Sistema esistente)       │                 │   Lead ha campo email?      │
│   via Twilio + AI Agent     │                 └──────────────┬──────────────┘
└─────────────────────────────┘                                │
                                                 ┌─────────────┴─────────────┐
                                                 │ NO                       │ SÌ
                                                 ▼                           ▼
                                     ┌──────────────────┐    ┌──────────────────────────┐
                                     │ Skip email       │    │ GENERA EMAIL BENVENUTO   │
                                     │ (solo WhatsApp)  │    │ (Template statico +      │
                                     │ Log: "no_email"  │    │  variabili dinamiche)    │
                                     └──────────────────┘    └────────────┬─────────────┘
                                                                          │
                                                                          ▼
                                                             ┌──────────────────────────┐
                                                             │ RECUPERA DATI AGENTE     │
                                                             │ • Nome consulente        │
                                                             │ • Numero WhatsApp        │
                                                             │ • Email mittente         │
                                                             └────────────┬─────────────┘
                                                                          │
                                                                          ▼
                                                             ┌──────────────────────────┐
                                                             │ COMPILA TEMPLATE         │
                                                             │ • {{nome}} = Nome lead   │
                                                             │ • {{obiettivo}} = Hook   │
                                                             │ • {{consulente}}         │
                                                             │ • {{whatsapp}}           │
                                                             └────────────┬─────────────┘
                                                                          │
                                                                          ▼
                                                             ┌──────────────────────────┐
                                                             │ INVIA EMAIL              │
                                                             │ via Resend/SMTP          │
                                                             └────────────┬─────────────┘
                                                                          │
                                                                          ▼
                                                             ┌──────────────────────────┐
                                                             │ LOG ATTIVITÀ             │
                                                             │ proactive_lead_logs:     │
                                                             │ type="welcome_email"     │
                                                             │ status="sent/failed"     │
                                                             └──────────────────────────┘
```

### 2.2 Struttura Email di Benvenuto

```
┌─────────────────────────────────────────────────────────────────┐
│ DA: nome.consulente@dominio.it                                  │
│ A: lead@email.it                                                │
│ OGGETTO: {{nome}}, ho visto che vuoi {{obiettivo_breve}}        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Ciao {{nome}},                                                 │
│                                                                 │
│  {{hook_personalizzato}}                                        │
│  (2-3 righe basate sugli obiettivi del lead)                   │
│                                                                 │
│  Mi chiamo {{nome_consulente}} e sono specializzato            │
│  nell'aiutare persone come te a raggiungere questo             │
│  tipo di obiettivi.                                            │
│                                                                 │
│  Se vuoi approfondire o hai domande, scrivimi                  │
│  direttamente su WhatsApp al numero:                           │
│                                                                 │
│  📱 {{numero_whatsapp}}                                         │
│                                                                 │
│  Ti rispondo personalmente.                                     │
│                                                                 │
│  A presto,                                                      │
│  {{nome_consulente}}                                            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 2.3 Generazione Hook

L'hook viene generato analizzando il campo `obiettivi` del lead:

| Obiettivo Lead | Hook Generato |
|----------------|---------------|
| "raggiungere 100.000€ di patrimonio" | "So quanto può sembrare lontano l'obiettivo dei 100.000€, ma con la giusta strategia è più vicino di quanto pensi." |
| "investire i miei risparmi" | "Hai dei risparmi che vorresti far fruttare? È il primo passo verso la libertà finanziaria." |
| "pianificare la pensione" | "Pensare al futuro oggi significa vivere sereni domani. La pianificazione pensionistica è fondamentale." |

---

## 3. Parte 2: Sistema Email Nurturing Annuale (365 giorni)

### 3.1 Concetto

Un sistema di **365 email precompilate** (una per ogni giorno dell'anno) che:
- Vengono **generate dall'AI una volta** e salvate nel database
- Sono **email di valore/nurturing** (non promozionali aggressive)
- Contengono **variabili dinamiche** per personalizzazione
- Vengono inviate **a rotazione** (dopo 365 giorni, ricomincia dal giorno 1)
- Obiettivo finale: **prenotare un appuntamento**

### 3.2 Diagramma di Flusso - Generazione Template

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    SEZIONE AI CONFIG > STATISTICHE                          │
│                    "Genera Email Nurturing Annuali"                         │
└────────────────────────────────────┬────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         INPUT CONSULENTE                                     │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ 1. Descrizione attività (obbligatorio)                              │   │
│  │ 2. Email di riferimento con buon copy (obbligatorio)                │   │
│  │ 3. Tono preferito (professionale/amichevole/motivazionale)          │   │
│  │ 4. Variabili da includere (checkbox):                               │   │
│  │    ☑ {{nome}} ☑ {{link_calendario}} ☑ {{nome_azienda}}              │   │
│  │    ☑ {{whatsapp}} ☑ {{email_consulente}} ☑ {{firma}}                │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└────────────────────────────────────┬────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    GENERAZIONE AI (Batch Processing)                         │
│                                                                              │
│  L'AI genera 365 email uniche basate su:                                    │
│  • Stile dell'email di riferimento                                          │
│  • Descrizione attività consulente                                          │
│  • Calendario tematico (vedi sezione 3.3)                                   │
│  • Mix di contenuti nurturing                                               │
│                                                                              │
│  ⏱️ Tempo stimato: ~5-10 minuti (batch da 50 email)                         │
└────────────────────────────────────┬────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    SALVATAGGIO DATABASE                                      │
│                                                                              │
│  Tabella: lead_nurturing_templates                                          │
│  • 365 record (uno per giorno)                                              │
│  • Ogni record: oggetto + corpo email + tipo + variabili                    │
└────────────────────────────────────┬────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    REVIEW & MODIFICA (Opzionale)                             │
│                                                                              │
│  Il consulente può:                                                         │
│  • Visualizzare tutte le 365 email                                          │
│  • Modificare singole email                                                 │
│  • Rigenerare specifiche email                                              │
│  • Attivare/disattivare singoli giorni                                      │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.3 Diagramma di Flusso - Invio Automatico

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         CRON JOB GIORNALIERO                                 │
│                         (ogni giorno alle 09:00)                             │
└────────────────────────────────────┬────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│              RECUPERA LEAD ISCRITTI AL NURTURING                            │
│                                                                              │
│  WHERE nurturing_enabled = true                                             │
│  AND nurturing_start_date <= TODAY                                          │
│  AND (status = 'contacted' OR status = 'pending')                           │
└────────────────────────────────────┬────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    PER OGNI LEAD ATTIVO                                      │
└────────────────────────────────────┬────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                 CALCOLA GIORNO NURTURING                                     │
│                                                                              │
│  giorni_trascorsi = TODAY - nurturing_start_date                            │
│  giorno_template = (giorni_trascorsi % 365) + 1                             │
│                                                                              │
│  Esempio:                                                                   │
│  • Giorno 1 → Template giorno 1                                             │
│  • Giorno 366 → Template giorno 1 (ricomincia)                              │
│  • Giorno 400 → Template giorno 35                                          │
└────────────────────────────────────┬────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                 RECUPERA TEMPLATE GIORNO                                     │
│                                                                              │
│  SELECT * FROM lead_nurturing_templates                                     │
│  WHERE consultant_id = X AND day_number = giorno_template                   │
└────────────────────────────────────┬────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                 COMPILA VARIABILI                                            │
│                                                                              │
│  {{nome}} → lead.firstName                                                  │
│  {{link_calendario}} → consultant.calendarLink                              │
│  {{nome_azienda}} → consultant.businessName                                 │
│  {{whatsapp}} → agent.twilioWhatsappNumber                                  │
│  {{email_consulente}} → consultant.email                                    │
│  {{firma}} → consultant.emailSignature                                      │
└────────────────────────────────────┬────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                      VERIFICA EMAIL LEAD                                     │
└─────────────┬───────────────────────────────────────────────┬───────────────┘
              │ NO EMAIL                                      │ HA EMAIL
              ▼                                               ▼
┌─────────────────────────────┐                 ┌─────────────────────────────┐
│ Skip                        │                 │ INVIA EMAIL                 │
│ Log: "skipped_no_email"     │                 │ via Resend/SMTP             │
└─────────────────────────────┘                 └──────────────┬──────────────┘
                                                               │
                                                               ▼
                                                ┌─────────────────────────────┐
                                                │ LOG INVIO                   │
                                                │ lead_nurturing_logs:        │
                                                │ • lead_id                   │
                                                │ • template_day              │
                                                │ • sent_at                   │
                                                │ • status                    │
                                                └─────────────────────────────┘
```

### 3.4 Calendario Tematico (365 giorni)

Le 365 email sono organizzate per temi/categorie per mantenere varietà e valore:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        DISTRIBUZIONE CONTENUTI                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  📚 EDUCAZIONE FINANZIARIA (30%)         ~110 email                         │
│     • Concetti base investimenti                                            │
│     • Errori comuni da evitare                                              │
│     • Glossario termini                                                     │
│     • Case study anonimi                                                    │
│                                                                              │
│  💡 TIPS & STRATEGIE (25%)               ~91 email                          │
│     • Consigli pratici settimanali                                          │
│     • Mini-guide operative                                                  │
│     • Checklist utili                                                       │
│                                                                              │
│  🎯 MOTIVAZIONALI (20%)                  ~73 email                          │
│     • Storie di successo                                                    │
│     • Citazioni e riflessioni                                               │
│     • Mindset finanziario                                                   │
│                                                                              │
│  📅 STAGIONALI/EVENTI (15%)              ~55 email                          │
│     • Tasse e scadenze fiscali                                              │
│     • Pianificazione fine anno                                              │
│     • Eventi economici                                                      │
│                                                                              │
│  🤝 SOFT CTA (10%)                       ~36 email                          │
│     • Invito a prenotare chiamata                                           │
│     • Offerta consulenza gratuita                                           │
│     • Reminder disponibilità                                                │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.5 Esempio Email Nurturing

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ GIORNO 47 - Categoria: Educazione Finanziaria                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│ OGGETTO: {{nome}}, conosci la regola del 72?                                │
│                                                                              │
│ ─────────────────────────────────────────────────────────────────────────── │
│                                                                              │
│ Ciao {{nome}},                                                              │
│                                                                              │
│ Oggi voglio condividere con te uno strumento semplicissimo                  │
│ che uso spesso per fare calcoli rapidi: la Regola del 72.                   │
│                                                                              │
│ Funziona così: dividi 72 per il tasso di rendimento annuo                   │
│ e ottieni il numero di anni necessari per raddoppiare                       │
│ il tuo capitale.                                                            │
│                                                                              │
│ Esempio pratico:                                                            │
│ • Al 6% annuo → 72/6 = 12 anni per raddoppiare                             │
│ • Al 8% annuo → 72/8 = 9 anni per raddoppiare                              │
│ • Al 4% annuo → 72/4 = 18 anni per raddoppiare                             │
│                                                                              │
│ Semplice, vero?                                                             │
│                                                                              │
│ Se vuoi capire come applicare questa regola ai tuoi                         │
│ risparmi attuali, scrivimi su WhatsApp: {{whatsapp}}                        │
│                                                                              │
│ {{firma}}                                                                   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Schema Database Completo (Drizzle ORM)

### 4.1 Modifiche a Tabella Esistente: `proactive_leads`

```typescript
// File: shared/schema.ts - Modifiche a proactiveLeads

export const proactiveLeads = pgTable("proactive_leads", {
  // ... campi esistenti ...
  
  // ============ NUOVI CAMPI EMAIL ============
  
  // Email diretta del lead (top-level per accesso rapido)
  email: text("email"),
  
  // Email di Benvenuto
  welcomeEmailEnabled: boolean("welcome_email_enabled").default(true),
  welcomeEmailSent: boolean("welcome_email_sent").default(false),
  welcomeEmailSentAt: timestamp("welcome_email_sent_at"),
  welcomeEmailError: text("welcome_email_error"),
  
  // Email Nurturing Annuale
  nurturingEnabled: boolean("nurturing_enabled").default(false),
  nurturingStartDate: date("nurturing_start_date"),
  nurturingEmailsSent: integer("nurturing_emails_sent").default(0),
  nurturingLastEmailAt: timestamp("nurturing_last_email_at"),
  nurturingOptOutAt: timestamp("nurturing_opt_out_at"), // Se lead si disiscrive
  
  // ... campi esistenti ...
});

// Tipi aggiornati
export type ProactiveLead = typeof proactiveLeads.$inferSelect;
```

### 4.2 Nuove Tabelle Drizzle

```typescript
// File: shared/schema.ts - Nuove tabelle

// ============================================================
// LEAD NURTURING TEMPLATES (365 email precompilate)
// ============================================================

export const leadNurturingTemplates = pgTable("lead_nurturing_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  consultantId: varchar("consultant_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  
  // Identificatore giorno (1-365)
  dayNumber: integer("day_number").notNull(),
  
  // Contenuto email
  subject: text("subject").notNull(),
  body: text("body").notNull(),
  
  // Categorizzazione
  category: text("category").$type<
    "education" | "tips" | "motivation" | "seasonal" | "cta"
  >().default("education"),
  tone: text("tone").$type<
    "professionale" | "amichevole" | "motivazionale"
  >().default("professionale"),
  
  // Stato
  isActive: boolean("is_active").default(true).notNull(),
  
  // Audit
  createdAt: timestamp("created_at").default(sql`now()`),
  updatedAt: timestamp("updated_at").default(sql`now()`),
}, (table) => ({
  // Un solo template per giorno per consulente
  uniqueConsultantDay: unique().on(table.consultantId, table.dayNumber),
  // Index per query veloci
  consultantIdx: index("nurturing_templates_consultant_idx").on(table.consultantId),
  dayNumberIdx: index("nurturing_templates_day_idx").on(table.dayNumber),
}));

// ============================================================
// CONFIGURAZIONE NURTURING PER CONSULENTE
// ============================================================

export const leadNurturingConfig = pgTable("lead_nurturing_config", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  consultantId: varchar("consultant_id").references(() => users.id, { onDelete: "cascade" }).notNull().unique(),
  
  // Stato generazione templates
  templatesGenerated: boolean("templates_generated").default(false).notNull(),
  templatesGeneratedAt: timestamp("templates_generated_at"),
  templatesCount: integer("templates_count").default(0).notNull(),
  
  // Input originale (per rigenerazione)
  businessDescription: text("business_description"),
  referenceEmail: text("reference_email"),
  preferredTone: text("preferred_tone").$type<
    "professionale" | "amichevole" | "motivazionale"
  >().default("professionale"),
  
  // Variabili abilitate
  enabledVariables: jsonb("enabled_variables").$type<string[]>()
    .default(sql`'["nome", "link_calendario", "whatsapp", "firma"]'::jsonb`),
  
  // Impostazioni invio
  sendTime: text("send_time").default("09:00"), // HH:MM format
  sendDays: jsonb("send_days").$type<number[]>()
    .default(sql`'[1,2,3,4,5]'::jsonb`), // 1=Lun, 7=Dom
  
  // Stato sistema nurturing
  isActive: boolean("is_active").default(false).notNull(),
  
  // Audit
  createdAt: timestamp("created_at").default(sql`now()`),
  updatedAt: timestamp("updated_at").default(sql`now()`),
});

// ============================================================
// LOG INVII NURTURING
// ============================================================

export const leadNurturingLogs = pgTable("lead_nurturing_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  leadId: varchar("lead_id").references(() => proactiveLeads.id, { onDelete: "cascade" }).notNull(),
  templateId: varchar("template_id").references(() => leadNurturingTemplates.id, { onDelete: "set null" }),
  consultantId: varchar("consultant_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  
  // Giorno e ciclo
  dayNumber: integer("day_number").notNull(),
  cycleNumber: integer("cycle_number").default(1).notNull(), // 1°, 2°, 3° anno...
  
  // Stato invio
  status: text("status").$type<"sent" | "failed" | "skipped">().notNull(),
  errorMessage: text("error_message"),
  
  // Tracking email
  emailMessageId: text("email_message_id"), // ID Resend/SMTP
  sentAt: timestamp("sent_at").default(sql`now()`),
  openedAt: timestamp("opened_at"),
  clickedAt: timestamp("clicked_at"),
  
  // Contenuto inviato (snapshot)
  subjectSent: text("subject_sent"),
  
  createdAt: timestamp("created_at").default(sql`now()`),
}, (table) => ({
  leadIdx: index("nurturing_logs_lead_idx").on(table.leadId),
  consultantIdx: index("nurturing_logs_consultant_idx").on(table.consultantId),
  sentAtIdx: index("nurturing_logs_sent_at_idx").on(table.sentAt),
}));

// ============================================================
// VARIABILI EMAIL CONSULENTE
// ============================================================

export const consultantEmailVariables = pgTable("consultant_email_variables", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  consultantId: varchar("consultant_id").references(() => users.id, { onDelete: "cascade" }).notNull().unique(),
  
  // Variabili standard
  calendarLink: text("calendar_link"),
  businessName: text("business_name"),
  whatsappNumber: text("whatsapp_number"),
  emailSignature: text("email_signature"),
  
  // Variabili personalizzate (key-value)
  customVariables: jsonb("custom_variables").$type<Record<string, string>>()
    .default(sql`'{}'::jsonb`),
  
  createdAt: timestamp("created_at").default(sql`now()`),
  updatedAt: timestamp("updated_at").default(sql`now()`),
});

// ============================================================
// VALIDATION SCHEMAS & TYPES
// ============================================================

export const insertLeadNurturingTemplateSchema = createInsertSchema(leadNurturingTemplates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertLeadNurturingConfigSchema = createInsertSchema(leadNurturingConfig).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertLeadNurturingLogSchema = createInsertSchema(leadNurturingLogs).omit({
  id: true,
  createdAt: true,
});

export const insertConsultantEmailVariablesSchema = createInsertSchema(consultantEmailVariables).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Types
export type LeadNurturingTemplate = typeof leadNurturingTemplates.$inferSelect;
export type InsertLeadNurturingTemplate = z.infer<typeof insertLeadNurturingTemplateSchema>;
export type LeadNurturingConfig = typeof leadNurturingConfig.$inferSelect;
export type InsertLeadNurturingConfig = z.infer<typeof insertLeadNurturingConfigSchema>;
export type LeadNurturingLog = typeof leadNurturingLogs.$inferSelect;
export type InsertLeadNurturingLog = z.infer<typeof insertLeadNurturingLogSchema>;
export type ConsultantEmailVariables = typeof consultantEmailVariables.$inferSelect;
export type InsertConsultantEmailVariables = z.infer<typeof insertConsultantEmailVariablesSchema>;
```

### 4.3 Diagramma ER Dettagliato

```
┌────────────────────────────┐
│          users             │
├────────────────────────────┤
│ id (varchar, PK)           │◄─────────────────────────────────────┐
│ email                      │                                      │
│ firstName                  │                                      │
│ lastName                   │                                      │
│ ...                        │                                      │
└────────────────────────────┘                                      │
         │                                                          │
         │ 1:N                                                      │
         ▼                                                          │
┌────────────────────────────┐     ┌─────────────────────────────┐ │
│    proactive_leads         │     │  lead_nurturing_config      │ │
├────────────────────────────┤     ├─────────────────────────────┤ │
│ id (varchar, PK)           │     │ id (varchar, PK)            │ │
│ consultant_id (FK) ────────┼─────┤ consultant_id (FK, UNIQUE) ─┼─┘
│ agent_config_id (FK)       │     │                             │
│ email              *NEW*   │     │ templates_generated         │
│ welcome_email_enabled *NEW*│     │ business_description        │
│ welcome_email_sent    *NEW*│     │ reference_email             │
│ nurturing_enabled     *NEW*│     │ preferred_tone              │
│ nurturing_start_date  *NEW*│     │ enabled_variables (jsonb)   │
│ nurturing_emails_sent *NEW*│     │ send_time                   │
│ ...                        │     │ send_days (jsonb)           │
└────────────┬───────────────┘     │ is_active                   │
             │                     └─────────────────────────────┘
             │                                   │
             │                                   │ 1:N
             │ 1:N                               ▼
             │              ┌─────────────────────────────────────┐
             │              │    lead_nurturing_templates         │
             │              ├─────────────────────────────────────┤
             │              │ id (varchar, PK)                    │
             │              │ consultant_id (FK) ─────────────────┤
             │              │ day_number (1-365)                  │
             │              │ subject                             │
             │              │ body                                │
             │              │ category                            │
             │              │ tone                                │
             │              │ is_active                           │
             │              │ UNIQUE(consultant_id, day_number)   │
             │              └──────────────┬──────────────────────┘
             │                             │
             ▼                             │
┌────────────────────────────────┐         │
│     lead_nurturing_logs        │◄────────┘
├────────────────────────────────┤
│ id (varchar, PK)               │
│ lead_id (FK) ──────────────────┤
│ template_id (FK)               │
│ consultant_id (FK)             │
│ day_number                     │
│ cycle_number (1, 2, 3...)      │
│ status (sent/failed/skipped)   │
│ email_message_id               │
│ sent_at                        │
│ opened_at                      │
│ clicked_at                     │
└────────────────────────────────┘

┌────────────────────────────────┐
│  consultant_email_variables    │
├────────────────────────────────┤
│ id (varchar, PK)               │
│ consultant_id (FK, UNIQUE) ────┼──► users.id
│ calendar_link                  │
│ business_name                  │
│ whatsapp_number                │
│ email_signature                │
│ custom_variables (jsonb)       │
└────────────────────────────────┘
```

---

## 5. API Backend (Dettagliato)

### 5.1 Endpoints Email Benvenuto

```typescript
// ============================================================
// File: server/routes/proactive-leads.ts (estensione)
// Auth: JWT required, role: consultant
// ============================================================

/**
 * PUT /api/proactive-leads/:leadId
 * Aggiorna lead includendo nuovo campo email
 * 
 * Auth: consultant (owner)
 */
interface UpdateLeadRequest {
  email?: string;                    // NEW: Email del lead
  welcomeEmailEnabled?: boolean;     // NEW: Abilita email benvenuto
  nurturingEnabled?: boolean;        // NEW: Abilita nurturing
  // ... altri campi esistenti
}

/**
 * POST /api/proactive-leads/:leadId/send-welcome-email
 * Invio manuale email benvenuto (per testing o reinvio)
 * 
 * Auth: consultant (owner)
 * Rate limit: 5/min per lead
 */
interface SendWelcomeEmailResponse {
  success: boolean;
  messageId?: string;        // Resend message ID
  error?: string;
  sentAt?: string;
}

// ============================================================
// Integrazione con scheduler esistente
// File: server/services/proactive-outreach-service.ts
// ============================================================

/**
 * Modifica a processScheduledLeads()
 * Dopo invio WhatsApp, se lead.email && lead.welcomeEmailEnabled:
 *   → Invia email benvenuto
 *   → Aggiorna welcomeEmailSent = true, welcomeEmailSentAt = now()
 *   → Log in proactive_lead_activity_logs: eventType = "welcome_email_sent"
 */
```

### 5.2 Endpoints Nurturing Templates (Nuovo File)

```typescript
// ============================================================
// File: server/routes/lead-nurturing.ts (NUOVO)
// Auth: JWT required, role: consultant
// Prefix: /api/lead-nurturing
// ============================================================

import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/auth";

const router = Router();

// Tutte le route richiedono autenticazione consulente
router.use(requireAuth);
router.use(requireRole("consultant"));

// ─────────────────────────────────────────────────────────────
// CONFIGURAZIONE NURTURING
// ─────────────────────────────────────────────────────────────

/**
 * GET /api/lead-nurturing/config
 * Ottiene configurazione nurturing del consulente
 */
interface GetConfigResponse {
  id: string;
  templatesGenerated: boolean;
  templatesGeneratedAt: string | null;
  templatesCount: number;
  businessDescription: string | null;
  referenceEmail: string | null;
  preferredTone: "professionale" | "amichevole" | "motivazionale";
  enabledVariables: string[];
  sendTime: string;           // "HH:MM"
  sendDays: number[];         // [1,2,3,4,5] = Lun-Ven
  isActive: boolean;
}

/**
 * PUT /api/lead-nurturing/config
 * Aggiorna configurazione
 */
interface UpdateConfigRequest {
  sendTime?: string;
  sendDays?: number[];
  isActive?: boolean;
  enabledVariables?: string[];
}

// ─────────────────────────────────────────────────────────────
// GENERAZIONE TEMPLATES AI
// ─────────────────────────────────────────────────────────────

/**
 * POST /api/lead-nurturing/generate
 * Avvia generazione 365 templates con AI
 * 
 * Note: Long-running operation (~5-10 min)
 * Usa SSE per progress tracking
 */
interface GenerateTemplatesRequest {
  businessDescription: string;   // Min 100 caratteri
  referenceEmail: string;        // Min 200 caratteri
  preferredTone: "professionale" | "amichevole" | "motivazionale";
}

interface GenerateTemplatesResponse {
  success: boolean;
  jobId: string;                 // Per tracking status
  estimatedMinutes: number;
}

/**
 * GET /api/lead-nurturing/generate/status
 * SSE endpoint per progress generazione
 * 
 * Events:
 *   - progress: { current: 47, total: 365, percent: 12.9 }
 *   - completed: { templatesGenerated: 365 }
 *   - error: { message: "..." }
 */
interface GenerationProgress {
  current: number;
  total: number;
  percent: number;
  currentCategory: string;
}

// ─────────────────────────────────────────────────────────────
// CRUD TEMPLATES
// ─────────────────────────────────────────────────────────────

/**
 * GET /api/lead-nurturing/templates
 * Lista paginata templates
 */
interface ListTemplatesQuery {
  page?: number;               // default: 1
  limit?: number;              // default: 31, max: 100
  category?: string;           // filter by category
  search?: string;             // search in subject/body
}

interface ListTemplatesResponse {
  templates: LeadNurturingTemplate[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  categoryStats: {
    education: number;
    tips: number;
    motivation: number;
    seasonal: number;
    cta: number;
  };
}

/**
 * GET /api/lead-nurturing/templates/:dayNumber
 * Singolo template per giorno (1-365)
 */

/**
 * PUT /api/lead-nurturing/templates/:dayNumber
 * Modifica template esistente
 */
interface UpdateTemplateRequest {
  subject?: string;
  body?: string;
  category?: "education" | "tips" | "motivation" | "seasonal" | "cta";
  isActive?: boolean;
}

/**
 * POST /api/lead-nurturing/templates/:dayNumber/regenerate
 * Rigenera singolo template con AI
 */
interface RegenerateTemplateRequest {
  customInstructions?: string;  // Istruzioni aggiuntive opzionali
}

/**
 * POST /api/lead-nurturing/templates/:dayNumber/preview
 * Preview template con variabili compilate
 */
interface PreviewTemplateRequest {
  leadId?: string;              // Se fornito, usa dati lead reale
  previewData?: {               // Altrimenti usa dati mock
    nome: string;
    cognome?: string;
  };
}

interface PreviewTemplateResponse {
  subject: string;              // Con {{variabili}} sostituite
  body: string;                 // Con {{variabili}} sostituite
  variablesUsed: string[];      // Lista variabili trovate
}

// ─────────────────────────────────────────────────────────────
// VARIABILI EMAIL
// ─────────────────────────────────────────────────────────────

/**
 * GET /api/lead-nurturing/variables
 * Ottiene variabili configurate
 */
interface GetVariablesResponse {
  calendarLink: string | null;
  businessName: string | null;
  whatsappNumber: string | null;
  emailSignature: string | null;
  customVariables: Record<string, string>;
  availableVariables: Array<{
    key: string;
    description: string;
    example: string;
    source: "lead" | "consultant" | "system";
  }>;
}

/**
 * PUT /api/lead-nurturing/variables
 * Aggiorna variabili
 */
interface UpdateVariablesRequest {
  calendarLink?: string;
  businessName?: string;
  whatsappNumber?: string;
  emailSignature?: string;
  customVariables?: Record<string, string>;
}

// ─────────────────────────────────────────────────────────────
// LEAD NURTURING CONTROL
// ─────────────────────────────────────────────────────────────

/**
 * POST /api/proactive-leads/:leadId/nurturing/start
 * Attiva nurturing per lead specifico
 */
interface StartNurturingRequest {
  startFromDay?: number;        // Default: 1 (inizia dal giorno 1)
}

interface StartNurturingResponse {
  success: boolean;
  startDate: string;
  firstEmailScheduledFor: string;
}

/**
 * POST /api/proactive-leads/:leadId/nurturing/stop
 * Disattiva nurturing
 */
interface StopNurturingResponse {
  success: boolean;
  emailsSentTotal: number;
  lastEmailAt: string | null;
}

/**
 * GET /api/proactive-leads/:leadId/nurturing/status
 * Stato nurturing lead
 */
interface NurturingStatusResponse {
  enabled: boolean;
  startDate: string | null;
  emailsSent: number;
  currentDay: number;           // Giorno corrente nel ciclo (1-365)
  cycleNumber: number;          // Numero ciclo (1, 2, 3...)
  lastEmailAt: string | null;
  nextEmailAt: string | null;   // Prossimo invio previsto
}

// ─────────────────────────────────────────────────────────────
// LOGS & ANALYTICS
// ─────────────────────────────────────────────────────────────

/**
 * GET /api/lead-nurturing/logs
 * Log invii nurturing
 */
interface GetLogsQuery {
  leadId?: string;
  startDate?: string;           // YYYY-MM-DD
  endDate?: string;             // YYYY-MM-DD
  status?: "sent" | "failed" | "skipped";
  page?: number;
  limit?: number;
}

interface GetLogsResponse {
  logs: LeadNurturingLog[];
  pagination: { ... };
  stats: {
    totalSent: number;
    totalFailed: number;
    totalSkipped: number;
    totalOpened: number;
    totalClicked: number;
    openRate: number;           // %
    clickRate: number;          // %
  };
}

/**
 * GET /api/lead-nurturing/analytics
 * Dashboard analytics
 */
interface AnalyticsResponse {
  overview: {
    activeLeads: number;
    emailsSentThisMonth: number;
    avgOpenRate: number;
    avgClickRate: number;
  };
  byDay: Array<{
    date: string;
    sent: number;
    opened: number;
    clicked: number;
  }>;
  topPerformingTemplates: Array<{
    dayNumber: number;
    subject: string;
    openRate: number;
    clickRate: number;
  }>;
}

export default router;
```

### 5.3 Servizi Backend (Dettagliati)

```typescript
// ============================================================
// File: server/services/lead-nurturing-service.ts (NUOVO)
// ============================================================

import { Resend } from "resend";
import { db } from "../db";
import { eq, and, lte, isNull } from "drizzle-orm";
import { 
  proactiveLeads, 
  leadNurturingTemplates, 
  leadNurturingConfig,
  leadNurturingLogs,
  consultantEmailVariables 
} from "../../shared/schema";

export class LeadNurturingService {
  private resend: Resend;
  
  constructor() {
    this.resend = new Resend(process.env.RESEND_API_KEY);
  }
  
  /**
   * Genera 365 templates usando Gemini AI
   * Processo batch per evitare timeout
   */
  async generateTemplates(
    consultantId: string,
    businessDescription: string,
    referenceEmail: string,
    tone: "professionale" | "amichevole" | "motivazionale",
    onProgress?: (progress: GenerationProgress) => void
  ): Promise<{ templatesGenerated: number }> {
    // Implementazione batch: 10 email alla volta
    // Distribuzione per categoria secondo calendario tematico
    // ...
  }
  
  /**
   * Scheduler giornaliero (chiamato da cron)
   * Esegue alle 09:00 (configurabile)
   */
  async processNurturingEmails(): Promise<{
    sent: number;
    skipped: number;
    failed: number;
  }> {
    // 1. Trova tutti i lead con nurturing attivo
    // 2. Per ogni lead, calcola giorno corrente
    // 3. Recupera template per quel giorno
    // 4. Compila variabili e invia
    // 5. Log risultato
    // ...
  }
  
  /**
   * Compila variabili nel template
   */
  compileTemplate(
    template: { subject: string; body: string },
    lead: ProactiveLead,
    variables: ConsultantEmailVariables
  ): { subject: string; body: string } {
    const replacements: Record<string, string> = {
      "{{nome}}": lead.firstName,
      "{{cognome}}": lead.lastName || "",
      "{{email_lead}}": lead.email || "",
      "{{obiettivo}}": lead.leadInfo?.obiettivi || lead.campaignSnapshot?.obiettivi || "",
      "{{link_calendario}}": variables.calendarLink || "",
      "{{nome_azienda}}": variables.businessName || "",
      "{{whatsapp}}": variables.whatsappNumber || "",
      "{{firma}}": variables.emailSignature || "",
      "{{data_oggi}}": new Date().toLocaleDateString("it-IT"),
      ...Object.entries(variables.customVariables || {}).reduce(
        (acc, [key, value]) => ({ ...acc, [`{{${key}}}`]: value }),
        {}
      ),
    };
    
    let subject = template.subject;
    let body = template.body;
    
    for (const [placeholder, value] of Object.entries(replacements)) {
      subject = subject.replaceAll(placeholder, value);
      body = body.replaceAll(placeholder, value);
    }
    
    return { subject, body };
  }
  
  /**
   * Calcola giorno corrente nel ciclo nurturing
   */
  calculateCurrentDay(startDate: Date): { day: number; cycle: number } {
    const today = new Date();
    const diffTime = today.getTime() - startDate.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    const cycle = Math.floor(diffDays / 365) + 1;
    const day = (diffDays % 365) + 1;
    
    return { day, cycle };
  }
}

// ============================================================
// File: server/services/welcome-email-service.ts (NUOVO)
// ============================================================

export class WelcomeEmailService {
  private resend: Resend;
  
  constructor() {
    this.resend = new Resend(process.env.RESEND_API_KEY);
  }
  
  /**
   * Invia email di benvenuto al lead
   */
  async sendWelcomeEmail(
    lead: ProactiveLead,
    agent: WhatsAppAgentConfig,
    consultant: User
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    if (!lead.email) {
      return { success: false, error: "Lead senza email" };
    }
    
    const hook = this.generateHookFromObjectives(
      lead.leadInfo?.obiettivi || 
      lead.campaignSnapshot?.obiettivi || 
      lead.idealState || 
      ""
    );
    
    const template = this.getWelcomeTemplate(lead, agent, consultant, hook);
    
    try {
      const result = await this.resend.emails.send({
        from: `${consultant.firstName} ${consultant.lastName} <${consultant.email}>`,
        to: lead.email,
        subject: template.subject,
        html: template.html,
      });
      
      return { success: true, messageId: result.id };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Genera hook personalizzato basato sugli obiettivi
   */
  generateHookFromObjectives(objectives: string): string {
    // Mapping obiettivi comuni → hook
    const hookMap: Record<string, string> = {
      "100.000": "So quanto può sembrare lontano l'obiettivo dei 100.000€, ma con la giusta strategia è più vicino di quanto pensi.",
      "patrimonio": "Costruire un patrimonio solido richiede pazienza e metodo. Sono qui per aiutarti in questo percorso.",
      "investire": "Hai dei risparmi che vorresti far fruttare? È il primo passo verso la libertà finanziaria.",
      "pensione": "Pensare al futuro oggi significa vivere sereni domani. La pianificazione pensionistica è fondamentale.",
      "risparmi": "Ottimizzare i propri risparmi è un'arte che può cambiarti la vita. Scopriamo insieme come.",
    };
    
    const lowerObj = objectives.toLowerCase();
    for (const [keyword, hook] of Object.entries(hookMap)) {
      if (lowerObj.includes(keyword)) {
        return hook;
      }
    }
    
    // Hook generico se nessun match
    return "Ho visto il tuo interesse e voglio aiutarti a raggiungere i tuoi obiettivi finanziari.";
  }
  
  private getWelcomeTemplate(
    lead: ProactiveLead,
    agent: WhatsAppAgentConfig,
    consultant: User,
    hook: string
  ): { subject: string; html: string } {
    // Template email HTML responsive
    // ...
  }
}
```

### 5.4 Integrazione Cron Jobs

```typescript
// File: server/cron/nurturing-scheduler.ts

import cron from "node-cron";
import { LeadNurturingService } from "../services/lead-nurturing-service";

const nurturingService = new LeadNurturingService();

// Esegue ogni giorno alle 09:00 (ora italiana)
cron.schedule("0 9 * * *", async () => {
  console.log("[NURTURING] Avvio invio email giornaliero...");
  
  try {
    const result = await nurturingService.processNurturingEmails();
    console.log(`[NURTURING] Completato: ${result.sent} inviate, ${result.skipped} saltate, ${result.failed} fallite`);
  } catch (error) {
    console.error("[NURTURING] Errore:", error);
  }
}, {
  timezone: "Europe/Rome"
});

// Cleanup vecchi log (ogni domenica alle 03:00)
cron.schedule("0 3 * * 0", async () => {
  // Mantieni solo ultimi 90 giorni di log
  // ...
});
```

---

## 6. Frontend UI/UX (Mappato a Componenti Esistenti)

### 6.1 Mapping Pagine/Componenti

| Funzionalità | Pagina Esistente | Sezione/Componente |
|-------------|------------------|-------------------|
| Campo email lead | `client/src/pages/proactive-leads.tsx` | Dialog creazione/modifica lead |
| Opzioni email benvenuto | `client/src/pages/proactive-leads.tsx` | Sezione "Opzioni Email" nel form |
| Toggle nurturing per lead | `client/src/pages/proactive-leads.tsx` | Tabella leads + Dialog dettagli |
| Generazione 365 templates | `client/src/pages/consultant-ai-config.tsx` | Tab "Statistiche" → Nuova card |
| Gestione templates | `client/src/pages/consultant-ai-config.tsx` | Tab "Statistiche" → Accordion |
| Configurazione variabili | `client/src/pages/consultant-ai-config.tsx` | Tab "Statistiche" → Card variabili |
| Dashboard nurturing | `client/src/pages/consultant-ai-config.tsx` | Tab "Statistiche" → Card analytics |

### 6.2 State Management

```typescript
// File: client/src/pages/proactive-leads.tsx
// Nuovi stati e query

// Query per lead con campi email
const { data: leadsData } = useQuery({
  queryKey: ["/api/proactive-leads"],
  // Response ora include: email, welcomeEmailEnabled, nurturingEnabled, etc.
});

// Mutation per attivare/disattivare nurturing
const toggleNurturingMutation = useMutation({
  mutationFn: async ({ leadId, enabled }: { leadId: string; enabled: boolean }) => {
    const endpoint = enabled 
      ? `/api/proactive-leads/${leadId}/nurturing/start`
      : `/api/proactive-leads/${leadId}/nurturing/stop`;
    return fetch(endpoint, { method: "POST", headers: getAuthHeaders() });
  },
  onSuccess: () => queryClient.invalidateQueries(["/api/proactive-leads"]),
});

// File: client/src/pages/consultant-ai-config.tsx
// Nuovi stati per nurturing

const { data: nurturingConfig } = useQuery({
  queryKey: ["/api/lead-nurturing/config"],
});

const { data: nurturingTemplates } = useQuery({
  queryKey: ["/api/lead-nurturing/templates"],
  enabled: !!nurturingConfig?.templatesGenerated,
});

const { data: nurturingVariables } = useQuery({
  queryKey: ["/api/lead-nurturing/variables"],
});

const generateTemplatesMutation = useMutation({
  mutationFn: async (data: GenerateTemplatesRequest) => {
    return fetch("/api/lead-nurturing/generate", {
      method: "POST",
      headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
  },
});
```

### 6.3 Modifiche Proactive Leads

#### 6.1.1 Form Creazione/Modifica Lead

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ ╔═══════════════════════════════════════════════════════════════════════╗  │
│ ║  AGGIUNGI NUOVO LEAD                                                  ║  │
│ ╚═══════════════════════════════════════════════════════════════════════╝  │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ 👤 INFORMAZIONI ESSENZIALI                          [Obbligatori]   │   │
│  ├─────────────────────────────────────────────────────────────────────┤   │
│  │                                                                     │   │
│  │  Nome *                          Cognome                            │   │
│  │  ┌─────────────────────────┐    ┌─────────────────────────┐        │   │
│  │  │ Mario                   │    │ Rossi                   │        │   │
│  │  └─────────────────────────┘    └─────────────────────────┘        │   │
│  │                                                                     │   │
│  │  Telefono *                                                         │   │
│  │  ┌─────────────────────────────────────────────────────────┐       │   │
│  │  │ +39 333 1234567                                         │       │   │
│  │  └─────────────────────────────────────────────────────────┘       │   │
│  │                                                                     │   │
│  │  📧 Email (opzionale) ────────── ✨ NEW!                            │   │
│  │  ┌─────────────────────────────────────────────────────────┐       │   │
│  │  │ mario.rossi@email.it                                    │       │   │
│  │  └─────────────────────────────────────────────────────────┘       │   │
│  │  ℹ️ Se fornita, invieremo anche un'email di benvenuto              │   │
│  │                                                                     │   │
│  │  Agente WhatsApp *                                                  │   │
│  │  ┌─────────────────────────────────────────────────────────┐       │   │
│  │  │ 🤖 Agente Vendite - +39 333 9999999             ▼       │       │   │
│  │  └─────────────────────────────────────────────────────────┘       │   │
│  │                                                                     │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ 📬 OPZIONI EMAIL                                    [Opzionale]     │   │  ✨ NEW SECTION!
│  ├─────────────────────────────────────────────────────────────────────┤   │
│  │                                                                     │   │
│  │  ☑ Invia email di benvenuto                                        │   │
│  │    Invia un'email insieme al primo messaggio WhatsApp              │   │
│  │                                                                     │   │
│  │  ☑ Attiva email nurturing (365 giorni)                             │   │
│  │    Invia un'email di valore ogni giorno per un anno                │   │
│  │                                                                     │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  [▼ Dettagli Avanzati]                                                      │
│                                                                              │
│                                        ┌─────────────┐ ┌─────────────┐      │
│                                        │  Annulla    │ │ 💾 Salva    │      │
│                                        └─────────────┘ └─────────────┘      │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 6.2 Sezione AI Config - Statistiche (Nuova Card)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ ╔═══════════════════════════════════════════════════════════════════════╗  │
│ ║ ✨ GENERA EMAIL NURTURING ANNUALI                                     ║  │
│ ║    Crea 365 email di valore per i tuoi lead                          ║  │
│ ╚═══════════════════════════════════════════════════════════════════════╝  │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │ 📝 Descrivi la tua attività *                                        │  │
│  │ ┌────────────────────────────────────────────────────────────────┐  │  │
│  │ │ Sono un consulente finanziario specializzato in pianificazione │  │  │
│  │ │ patrimoniale per famiglie. I miei clienti sono professionisti  │  │  │
│  │ │ con redditi medio-alti che vogliono ottimizzare risparmi...    │  │  │
│  │ └────────────────────────────────────────────────────────────────┘  │  │
│  │ L'AI userà questa descrizione per generare email personalizzate     │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │ ✉️ Email di riferimento (con buon copy) *                            │  │
│  │ ┌────────────────────────────────────────────────────────────────┐  │  │
│  │ │ Ciao {nome},                                                   │  │  │
│  │ │                                                                │  │  │
│  │ │ Oggi voglio parlarti di un concetto che cambia tutto...       │  │  │
│  │ │ [incolla qui un'email che ti rappresenta]                     │  │  │
│  │ └────────────────────────────────────────────────────────────────┘  │  │
│  │ Questa email servirà come riferimento per lo stile di scrittura     │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │ 🎨 Tono preferito                                                    │  │
│  │                                                                      │  │
│  │ ○ Professionale   ● Amichevole   ○ Motivazionale                    │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │ 📎 Variabili da includere                                            │  │
│  │                                                                      │  │
│  │ ☑ {{nome}}           Nome del lead                                  │  │
│  │ ☑ {{link_calendario}} Link per prenotare                           │  │
│  │ ☑ {{whatsapp}}       Numero WhatsApp                                │  │
│  │ ☐ {{nome_azienda}}   Nome della tua azienda                         │  │
│  │ ☑ {{firma}}          Firma email                                    │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                                                                      │  │
│  │  ┌─────────────────────────────────────────────────────────────┐    │  │
│  │  │ ✨ Genera 365 Email Nurturing                                │    │  │
│  │  └─────────────────────────────────────────────────────────────┘    │  │
│  │                                                                      │  │
│  │  ⏱️ Tempo stimato: ~5-10 minuti                                      │  │
│  │  ℹ️ Potrai modificare ogni email dopo la generazione                 │  │
│  │                                                                      │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 6.3 Visualizzazione Templates Generati

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ ╔═══════════════════════════════════════════════════════════════════════╗  │
│ ║ 📅 TEMPLATE EMAIL NURTURING (365 GIORNI)            ✅ 365 generati   ║  │
│ ╚═══════════════════════════════════════════════════════════════════════╝  │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ 🔍 Cerca...          │ Categoria: [Tutte ▼] │ Stato: [Tutti ▼]     │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ 📊 Distribuzione: 📚 110 │ 💡 91 │ 🎯 73 │ 📅 55 │ 🤝 36            │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ ▶ Giorno 1   │ 📚 Educazione │ Benvenuto nel tuo percorso...  ✓    │   │
│  ├─────────────────────────────────────────────────────────────────────┤   │
│  │ ▶ Giorno 2   │ 💡 Tips       │ Il primo passo verso...        ✓    │   │
│  ├─────────────────────────────────────────────────────────────────────┤   │
│  │ ▼ Giorno 3   │ 📚 Educazione │ Conosci la regola del 72?      ✓    │   │
│  │ ┌───────────────────────────────────────────────────────────────┐   │   │
│  │ │ OGGETTO: {{nome}}, conosci la regola del 72?                  │   │   │
│  │ │                                                               │   │   │
│  │ │ Ciao {{nome}},                                                │   │   │
│  │ │                                                               │   │   │
│  │ │ Oggi voglio condividere con te uno strumento                  │   │   │
│  │ │ semplicissimo che uso spesso per fare calcoli rapidi:         │   │   │
│  │ │ la Regola del 72...                                           │   │   │
│  │ │                                                               │   │   │
│  │ │ [Modifica] [Rigenera] [Anteprima] [Disattiva]                 │   │   │
│  │ └───────────────────────────────────────────────────────────────┘   │   │
│  ├─────────────────────────────────────────────────────────────────────┤   │
│  │ ▶ Giorno 4   │ 🎯 Motivazione│ Il mindset del risparmio...    ✓    │   │
│  ├─────────────────────────────────────────────────────────────────────┤   │
│  │ ...                                                                 │   │
│  ├─────────────────────────────────────────────────────────────────────┤   │
│  │ ▶ Giorno 365 │ 🤝 CTA        │ Un anno insieme, e ora?        ✓    │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ ◀ Pagina 1 di 12    │ [1] [2] [3] ... [12] │                   ▶   │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 6.4 Configurazione Variabili

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ ╔═══════════════════════════════════════════════════════════════════════╗  │
│ ║ ⚙️ CONFIGURA VARIABILI EMAIL                                          ║  │
│ ╚═══════════════════════════════════════════════════════════════════════╝  │
│                                                                              │
│  Queste variabili verranno sostituite automaticamente in ogni email.        │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ {{link_calendario}}                                                 │   │
│  │ ┌───────────────────────────────────────────────────────────────┐   │   │
│  │ │ https://calendly.com/mario-consulente/30min                   │   │   │
│  │ └───────────────────────────────────────────────────────────────┘   │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ {{nome_azienda}}                                                    │   │
│  │ ┌───────────────────────────────────────────────────────────────┐   │   │
│  │ │ Studio Rossi Consulenze                                       │   │   │
│  │ └───────────────────────────────────────────────────────────────┘   │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ {{whatsapp}}                                                        │   │
│  │ ┌───────────────────────────────────────────────────────────────┐   │   │
│  │ │ +39 333 9999999                                               │   │   │
│  │ └───────────────────────────────────────────────────────────────┘   │   │
│  │ ℹ️ Preso automaticamente dall'agente WhatsApp                       │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ {{firma}}                                                           │   │
│  │ ┌───────────────────────────────────────────────────────────────┐   │   │
│  │ │ A presto,                                                     │   │   │
│  │ │ Mario Rossi                                                   │   │   │
│  │ │ Consulente Finanziario                                        │   │   │
│  │ │ Tel: +39 333 9999999                                          │   │   │
│  │ └───────────────────────────────────────────────────────────────┘   │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│                                              ┌─────────────────────────┐   │
│                                              │ 💾 Salva Variabili      │   │
│                                              └─────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 6.5 Dashboard Nurturing

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ ╔═══════════════════════════════════════════════════════════════════════╗  │
│ ║ 📊 DASHBOARD NURTURING                                                ║  │
│ ╚═══════════════════════════════════════════════════════════════════════╝  │
│                                                                              │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐              │
│  │ 📧 1,247   │ │ 👁️ 42%     │ │ 🖱️ 8.3%    │ │ 📅 15      │              │
│  │ Email      │ │ Open Rate  │ │ Click Rate │ │ Lead       │              │
│  │ Inviate    │ │            │ │            │ │ Attivi     │              │
│  └────────────┘ └────────────┘ └────────────┘ └────────────┘              │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ 👥 LEAD ISCRITTI AL NURTURING                                       │   │
│  ├─────────────────────────────────────────────────────────────────────┤   │
│  │                                                                     │   │
│  │ ┌───────────────────────────────────────────────────────────────┐   │   │
│  │ │ 👤 Mario Rossi          📧 47/365    Giorno 47    [Disattiva] │   │   │
│  │ │    mario@email.it       ████████░░░░░░░░░░░░░░░░░░░░░ 13%     │   │   │
│  │ └───────────────────────────────────────────────────────────────┘   │   │
│  │                                                                     │   │
│  │ ┌───────────────────────────────────────────────────────────────┐   │   │
│  │ │ 👤 Laura Bianchi        📧 123/365   Giorno 123   [Disattiva] │   │   │
│  │ │    laura@email.it       ██████████████████░░░░░░░░░░░ 34%     │   │   │
│  │ └───────────────────────────────────────────────────────────────┘   │   │
│  │                                                                     │   │
│  │ ┌───────────────────────────────────────────────────────────────┐   │   │
│  │ │ 👤 Giuseppe Verdi       📧 5/365     Giorno 5     [Disattiva] │   │   │
│  │ │    giuseppe@email.it    █░░░░░░░░░░░░░░░░░░░░░░░░░░░░ 1%      │   │   │
│  │ └───────────────────────────────────────────────────────────────┘   │   │
│  │                                                                     │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ ⏰ IMPOSTAZIONI INVIO                                               │   │
│  ├─────────────────────────────────────────────────────────────────────┤   │
│  │                                                                     │   │
│  │ Orario invio: [09:00 ▼]                                             │   │
│  │                                                                     │   │
│  │ Giorni attivi: ☑ Lun ☑ Mar ☑ Mer ☑ Gio ☑ Ven ☐ Sab ☐ Dom          │   │
│  │                                                                     │   │
│  │ Sistema: [● Attivo] [○ In pausa]                                    │   │
│  │                                                                     │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 7. Sistema Variabili Dinamiche (Specifica Completa)

### 7.1 Sintassi e Regole

```typescript
// Sintassi: {{nome_variabile}}
// - Solo caratteri alfanumerici e underscore
// - Case-sensitive
// - Nessuno spazio interno

// VALIDI:
"{{nome}}"
"{{link_calendario}}"
"{{custom_var_1}}"

// NON VALIDI:
"{{ nome }}"       // ❌ Spazi
"{{Nome}}"         // ⚠️ Case diverso (non matcherà {{nome}})
"{{link-calendario}}" // ❌ Trattino non permesso
```

### 7.2 Categorie Variabili

| Categoria | Variabile | Descrizione | Fonte | Fallback |
|-----------|-----------|-------------|-------|----------|
| **Lead** | `{{nome}}` | Nome del lead | `proactive_leads.firstName` | `""` |
| **Lead** | `{{cognome}}` | Cognome del lead | `proactive_leads.lastName` | `""` |
| **Lead** | `{{email_lead}}` | Email del lead | `proactive_leads.email` | `""` |
| **Lead** | `{{obiettivo}}` | Obiettivo principale | `leadInfo.obiettivi` → `campaignSnapshot.obiettivi` → `idealState` | `"i tuoi obiettivi"` |
| **Lead** | `{{telefono}}` | Telefono lead | `proactive_leads.phoneNumber` | `""` |
| **Consulente** | `{{nome_consulente}}` | Nome completo | `users.firstName + " " + users.lastName` | *Obbligatorio* |
| **Consulente** | `{{email_consulente}}` | Email consulente | `users.email` | *Obbligatorio* |
| **Consulente** | `{{link_calendario}}` | Link prenotazione | `consultant_email_variables.calendarLink` | `""` |
| **Consulente** | `{{nome_azienda}}` | Nome azienda | `consultant_email_variables.businessName` | `""` |
| **Consulente** | `{{whatsapp}}` | Numero WhatsApp | `consultantWhatsappConfig.twilioWhatsappNumber` | `""` |
| **Consulente** | `{{firma}}` | Firma email | `consultant_email_variables.emailSignature` | Nome consulente |
| **Sistema** | `{{giorno}}` | Giorno nurturing (1-365) | Calcolato | *Sempre presente* |
| **Sistema** | `{{ciclo}}` | Numero ciclo (1, 2, 3...) | Calcolato | `"1"` |
| **Sistema** | `{{data_oggi}}` | Data formattata IT | `new Date().toLocaleDateString("it-IT")` | *Sempre presente* |
| **Custom** | `{{custom_*}}` | Variabili personalizzate | `consultant_email_variables.customVariables` | `""` |

### 7.3 Validazione e Comportamento

```typescript
// File: server/services/template-compiler.ts

interface CompileOptions {
  template: string;
  variables: Record<string, string>;
  options?: {
    removeUnmatchedPlaceholders?: boolean;  // default: true
    validateRequired?: boolean;             // default: true
    maxLength?: number;                     // default: undefined
  };
}

interface CompileResult {
  text: string;
  variablesUsed: string[];
  variablesMissing: string[];
  warnings: string[];
}

/**
 * Compila template sostituendo variabili
 * 
 * Comportamento:
 * 1. Trova tutti i {{placeholder}} nel template
 * 2. Per ogni placeholder, cerca valore nelle variabili
 * 3. Se trovato, sostituisce
 * 4. Se non trovato e removeUnmatchedPlaceholders=true, rimuove placeholder
 * 5. Se non trovato e removeUnmatchedPlaceholders=false, lascia {{placeholder}}
 * 6. Restituisce risultato con lista variabili usate/mancanti
 */
function compileTemplate(input: CompileOptions): CompileResult {
  const placeholderRegex = /\{\{([a-zA-Z_][a-zA-Z0-9_]*)\}\}/g;
  const variablesUsed: string[] = [];
  const variablesMissing: string[] = [];
  const warnings: string[] = [];
  
  let text = input.template;
  let match: RegExpExecArray | null;
  
  while ((match = placeholderRegex.exec(input.template)) !== null) {
    const placeholder = match[0];
    const varName = match[1];
    
    if (varName in input.variables && input.variables[varName] !== undefined) {
      const value = input.variables[varName];
      text = text.replaceAll(placeholder, value);
      variablesUsed.push(varName);
    } else {
      variablesMissing.push(varName);
      if (input.options?.removeUnmatchedPlaceholders !== false) {
        text = text.replaceAll(placeholder, "");
        warnings.push(`Variabile {{${varName}}} non trovata, rimossa`);
      }
    }
  }
  
  // Validazione lunghezza
  if (input.options?.maxLength && text.length > input.options.maxLength) {
    warnings.push(`Testo eccede lunghezza massima (${text.length}/${input.options.maxLength})`);
  }
  
  return { text, variablesUsed, variablesMissing, warnings };
}
```

### 7.4 Variabili Custom

I consulenti possono definire variabili personalizzate tramite UI:

```typescript
// Esempio configurazione custom
{
  "customVariables": {
    "promo_attuale": "Sconto 20% fino al 31 gennaio",
    "prossimo_webinar": "15 febbraio alle 20:00",
    "link_risorse": "https://risorse.example.com"
  }
}

// Utilizzo nel template
"Approfitta di: {{promo_attuale}}\n\nProssimo webinar: {{prossimo_webinar}}"
```

---

## 8. Considerazioni Tecniche

### 8.1 Performance

- **Generazione 365 template**: Batch processing con 10 email parallele
- **Invio giornaliero**: Cron job con rate limiting (max 50 email/minuto)
- **Caching**: Template compilati cached per 1 ora

### 8.2 Limiti

| Risorsa | Limite |
|---------|--------|
| Template per consulente | 365 (fisso) |
| Lunghezza oggetto email | 150 caratteri |
| Lunghezza corpo email | 5000 caratteri |
| Lead attivi nurturing | Illimitato |
| Email giornaliere | Dipende da piano Resend |

### 8.3 Sicurezza

- Variabili sanitizzate prima dell'inserimento
- Email validate prima dell'invio
- Log audit per ogni operazione
- Rate limiting per prevenire spam

### 8.4 Integrazione Email

Il sistema utilizzerà:
- **Resend** (già integrato) per invio email
- **SMTP consulente** come fallback
- Tracking aperture/click tramite pixel e redirect

### 8.5 Cron Jobs

```
# Email Benvenuto: ogni minuto (insieme a WhatsApp)
* * * * * processProactiveLeads()

# Nurturing Giornaliero: ogni giorno alle 09:00
0 9 * * * processNurturingEmails()

# Cleanup Log: ogni domenica alle 03:00
0 3 * * 0 cleanupOldLogs()
```

---

## 9. Roadmap Implementazione Dettagliata

### Overview Fasi

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        TIMELINE IMPLEMENTAZIONE                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  FASE 1          FASE 2          FASE 3          FASE 4          FASE 5    │
│  ════════        ════════        ════════        ════════        ════════  │
│  Email           Database        Generazione     Scheduler       Dashboard │
│  Benvenuto       Nurturing       Templates       & Invio         Analytics │
│                                                                              │
│  ┌──────┐        ┌──────┐        ┌──────────┐    ┌──────┐        ┌──────┐  │
│  │1-2 gg│───────▶│1 gg  │───────▶│2-3 gg    │───▶│2 gg  │───────▶│1-2 gg│  │
│  └──────┘        └──────┘        └──────────┘    └──────┘        └──────┘  │
│                                                                              │
│  Dipendenze:     Dipendenze:     Dipendenze:     Dipendenze:     Dipendenze:│
│  - Resend API    - Fase 1        - Fase 2        - Fase 2,3      - Fase 4  │
│  - Schema base   - Drizzle       - Gemini API    - Resend        - Logs    │
│                                                                              │
│  TOTALE STIMATO: 7-10 giorni lavorativi                                     │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Fase 1: Email Benvenuto (1-2 giorni)

#### 1.1 Database Migration
```bash
# File: shared/schema.ts
# Aggiungere nuovi campi a proactiveLeads

# Eseguire:
npm run db:push
```

**Campi da aggiungere:**
- `email: text("email")`
- `welcomeEmailEnabled: boolean("welcome_email_enabled").default(true)`
- `welcomeEmailSent: boolean("welcome_email_sent").default(false)`
- `welcomeEmailSentAt: timestamp("welcome_email_sent_at")`
- `welcomeEmailError: text("welcome_email_error")`

#### 1.2 Backend
- [ ] Creare `server/services/welcome-email-service.ts`
- [ ] Modificare `server/routes/proactive-leads.ts` - aggiungere validazione email
- [ ] Modificare `server/services/proactive-outreach-service.ts` - integrare invio email
- [ ] Aggiungere endpoint `POST /api/proactive-leads/:leadId/send-welcome-email`
- [ ] Aggiornare log types in `proactive_lead_activity_logs`

#### 1.3 Frontend
- [ ] Modificare `client/src/pages/proactive-leads.tsx`:
  - Aggiungere campo `email` nel form
  - Aggiungere sezione "Opzioni Email" con checkbox
  - Mostrare stato email benvenuto nella tabella
- [ ] Aggiungere tooltip/help text

#### 1.4 Testing
- [ ] Test invio email con Resend
- [ ] Test hook generation
- [ ] Test integrazione scheduler

---

### Fase 2: Database Nurturing (1 giorno)

#### 2.1 Schema Drizzle
```typescript
// Aggiungere a shared/schema.ts:
// - leadNurturingTemplates
// - leadNurturingConfig
// - leadNurturingLogs
// - consultantEmailVariables
```

#### 2.2 Migration
```bash
npm run db:push
# Verificare creazione tabelle
```

#### 2.3 Storage Methods
- [ ] Creare `server/storage/lead-nurturing-storage.ts` con metodi CRUD
- [ ] Aggiungere relazioni Drizzle

---

### Fase 3: Generazione Templates AI (2-3 giorni)

#### 3.1 Backend
- [ ] Creare `server/routes/lead-nurturing.ts`
- [ ] Creare `server/services/lead-nurturing-generation-service.ts`
- [ ] Implementare batch processing (50 email/batch)
- [ ] Implementare SSE per progress tracking

#### 3.2 Prompt Engineering
- [ ] Creare prompt per ciascuna categoria (education, tips, motivation, seasonal, cta)
- [ ] Definire distribuzione 365 giorni
- [ ] Testare qualità output

#### 3.3 Frontend
- [ ] Aggiungere card "Genera Email Nurturing" in `consultant-ai-config.tsx`
- [ ] Form input: descrizione, email riferimento, tono
- [ ] Progress bar SSE
- [ ] Gestione errori

---

### Fase 4: Scheduler & Invio (2 giorni)

#### 4.1 Cron Job
- [ ] Creare `server/cron/nurturing-scheduler.ts`
- [ ] Configurare esecuzione giornaliera
- [ ] Implementare rate limiting

#### 4.2 Servizio Invio
- [ ] Creare `server/services/lead-nurturing-service.ts`
- [ ] Implementare `compileTemplate()` con tutte le variabili
- [ ] Implementare `calculateCurrentDay()`
- [ ] Gestione errori e retry

#### 4.3 Logging
- [ ] Salvare ogni invio in `lead_nurturing_logs`
- [ ] Tracking aperture (pixel)
- [ ] Tracking click (redirect)

---

### Fase 5: Dashboard & Analytics (1-2 giorni)

#### 5.1 Backend
- [ ] Endpoint `GET /api/lead-nurturing/analytics`
- [ ] Aggregazione statistiche

#### 5.2 Frontend
- [ ] Card dashboard con KPI
- [ ] Lista lead iscritti con progress bar
- [ ] Configurazione orario/giorni invio
- [ ] Toggle attiva/disattiva sistema

---

### Feature Flags

```typescript
// File: server/config/feature-flags.ts

export const FEATURE_FLAGS = {
  // Fase 1
  WELCOME_EMAIL_ENABLED: true,
  
  // Fase 2-5
  NURTURING_SYSTEM_ENABLED: process.env.NURTURING_ENABLED === "true",
  NURTURING_AI_GENERATION_ENABLED: process.env.NURTURING_AI_ENABLED === "true",
  
  // Limiti
  MAX_NURTURING_LEADS_PER_CONSULTANT: 500,
  MAX_DAILY_EMAILS_PER_CONSULTANT: 200,
};
```

---

### Checklist Pre-Deploy

#### Database
- [ ] Backup database esistente
- [ ] Verificare migration non distruttiva
- [ ] Testare rollback plan

#### Integrazioni
- [ ] Verificare Resend API key configurata
- [ ] Verificare limiti Resend (rate limits)
- [ ] Testare invio in ambiente staging

#### Monitoring
- [ ] Logging strutturato per debug
- [ ] Alert su errori invio batch
- [ ] Dashboard per monitorare queue

#### Documentazione
- [ ] Aggiornare replit.md
- [ ] Documentare nuove API
- [ ] Guida utente per consulenti

---

## 10. Integrazione con Sistema Esistente

### 10.1 Registrazione Routes in server/routes.ts

```typescript
// File: server/routes.ts
// Aggiungere import e registrazione nuove route

import leadNurturingRoutes from "./routes/lead-nurturing";

// ... altre route esistenti ...

// Lead Nurturing System
app.use("/api/lead-nurturing", leadNurturingRoutes);
```

### 10.2 Auth Middleware (allineamento con codebase esistente)

```typescript
// Il codebase usa authenticateToken e requireRole
// File: server/routes/lead-nurturing.ts

import { authenticateToken, requireRole } from "../middleware/auth";

const router = Router();

// Applicare middleware esistenti
router.use(authenticateToken);
router.use(requireRole("consultant"));

// ... route definitions ...
```

### 10.3 Integrazione Email-Hub

Le email verranno inviate attraverso l'infrastruttura email-hub esistente:

```typescript
// File: server/services/welcome-email-service.ts
// Usa Resend già configurato (come email-hub)

import { Resend } from "resend";

// Riutilizza la stessa istanza/configurazione
const resend = new Resend(process.env.RESEND_API_KEY);

// Per consulenti con SMTP custom, usare loro configurazione:
async function sendViaConsultantSmtp(
  consultant: User,
  to: string,
  subject: string,
  html: string
) {
  // Se consulente ha SMTP configurato, usa quello
  // Altrimenti fallback a Resend
  
  if (consultant.smtpHost && consultant.smtpUser) {
    // Usa nodemailer con SMTP consulente
    const transporter = nodemailer.createTransport({
      host: consultant.smtpHost,
      port: consultant.smtpPort || 587,
      secure: consultant.smtpSecure || false,
      auth: {
        user: consultant.smtpUser,
        pass: consultant.smtpPassword,
      },
    });
    return transporter.sendMail({ from: consultant.smtpFrom, to, subject, html });
  }
  
  // Fallback Resend
  return resend.emails.send({
    from: `${consultant.firstName} ${consultant.lastName} <noreply@resend.dev>`,
    to,
    subject,
    html,
  });
}
```

---

## 11. GDPR Opt-Out System

### 11.1 Endpoint Pubblico Unsubscribe

```typescript
// File: server/routes/public-unsubscribe.ts
// Route PUBBLICA (no auth) per gestire disiscrizioni

import { Router } from "express";
import { db } from "../db";
import { eq } from "drizzle-orm";
import { proactiveLeads } from "../../shared/schema";
import crypto from "crypto";

const router = Router();

/**
 * GET /unsubscribe/:token
 * Pagina pubblica per conferma disiscrizione
 */
router.get("/:token", async (req, res) => {
  const { token } = req.params;
  
  // Decodifica token (leadId + hash)
  const leadId = decodeUnsubscribeToken(token);
  if (!leadId) {
    return res.status(400).send("Link non valido o scaduto");
  }
  
  // Mostra pagina conferma
  res.send(`
    <html>
      <head><title>Disiscrizione</title></head>
      <body style="font-family: sans-serif; text-align: center; padding: 50px;">
        <h1>Conferma Disiscrizione</h1>
        <p>Sei sicuro di voler smettere di ricevere le nostre email?</p>
        <form method="POST" action="/unsubscribe/${token}">
          <button type="submit" style="padding: 15px 30px; font-size: 16px;">
            Sì, disiscrivimi
          </button>
        </form>
        <p style="color: gray; margin-top: 30px;">
          <a href="/">Annulla</a>
        </p>
      </body>
    </html>
  `);
});

/**
 * POST /unsubscribe/:token
 * Processa disiscrizione
 */
router.post("/:token", async (req, res) => {
  const { token } = req.params;
  
  const leadId = decodeUnsubscribeToken(token);
  if (!leadId) {
    return res.status(400).send("Link non valido o scaduto");
  }
  
  // Aggiorna lead
  await db.update(proactiveLeads)
    .set({
      nurturingEnabled: false,
      nurturingOptOutAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(proactiveLeads.id, leadId));
  
  // Log disiscrizione
  // ...
  
  res.send(`
    <html>
      <head><title>Disiscrizione Completata</title></head>
      <body style="font-family: sans-serif; text-align: center; padding: 50px;">
        <h1>✅ Disiscrizione Completata</h1>
        <p>Non riceverai più email da parte nostra.</p>
        <p style="color: gray;">Puoi chiudere questa pagina.</p>
      </body>
    </html>
  `);
});

// Helper per generare token sicuro
export function generateUnsubscribeToken(leadId: string): string {
  const secret = process.env.UNSUBSCRIBE_SECRET || "default-secret";
  const hash = crypto
    .createHmac("sha256", secret)
    .update(leadId)
    .digest("hex")
    .substring(0, 16);
  return Buffer.from(`${leadId}:${hash}`).toString("base64url");
}

function decodeUnsubscribeToken(token: string): string | null {
  try {
    const decoded = Buffer.from(token, "base64url").toString();
    const [leadId, hash] = decoded.split(":");
    
    // Verifica hash
    const secret = process.env.UNSUBSCRIBE_SECRET || "default-secret";
    const expectedHash = crypto
      .createHmac("sha256", secret)
      .update(leadId)
      .digest("hex")
      .substring(0, 16);
    
    if (hash !== expectedHash) {
      return null;
    }
    
    return leadId;
  } catch {
    return null;
  }
}

export default router;
```

### 11.2 Registrazione Route Pubblica

```typescript
// File: server/routes.ts

import publicUnsubscribeRoutes from "./routes/public-unsubscribe";

// Route pubblica (SENZA auth)
app.use("/unsubscribe", publicUnsubscribeRoutes);
```

### 11.3 Link Unsubscribe in Email Template

```typescript
// File: server/services/lead-nurturing-service.ts

import { generateUnsubscribeToken } from "../routes/public-unsubscribe";

function buildEmailHtml(lead: ProactiveLead, body: string): string {
  const unsubscribeToken = generateUnsubscribeToken(lead.id);
  const unsubscribeUrl = `${process.env.APP_URL}/unsubscribe/${unsubscribeToken}`;
  
  return `
    <!DOCTYPE html>
    <html>
      <body>
        ${body}
        
        <hr style="margin-top: 40px; border: none; border-top: 1px solid #eee;">
        <p style="font-size: 12px; color: #888; text-align: center;">
          Non vuoi più ricevere queste email? 
          <a href="${unsubscribeUrl}">Clicca qui per disiscriverti</a>
        </p>
      </body>
    </html>
  `;
}
```

---

## 12. UI Placement in consultant-ai-config.tsx

### 12.1 Struttura Tab Esistente

```
consultant-ai-config.tsx
├── Tab: "Generale"
├── Tab: "Agenti WhatsApp"
├── Tab: "Statistiche"          ← MODIFICARE QUESTO
│   ├── Card: KPI Email Generate (esistente)
│   ├── Card: Distribuzione Toni (esistente)
│   ├── Card: Personalizza Journey Email (esistente)
│   ├── Card: Template Journey Email 31 gg (esistente)
│   │
│   ├── ═════ NUOVE SEZIONI ═════
│   │
│   ├── Card: "Genera Email Nurturing 365 gg" (NUOVA)
│   │   └── Form: descrizione, email riferimento, tono
│   │   └── Button: Genera + Progress bar
│   │
│   ├── Card: "Template Nurturing 365 gg" (NUOVA)
│   │   └── Accordion con 365 template (paginato)
│   │
│   ├── Card: "Variabili Email" (NUOVA)
│   │   └── Form: link_calendario, nome_azienda, firma, etc.
│   │
│   └── Card: "Dashboard Nurturing" (NUOVA)
│       └── KPI: lead attivi, email inviate, open/click rate
│       └── Lista lead iscritti con progress
│       └── Impostazioni orario/giorni
│
└── Tab: "Clienti"
```

### 12.2 Codice Placement

```tsx
// File: client/src/pages/consultant-ai-config.tsx
// Dentro TabsContent value="statistics"

<TabsContent value="statistics" className="space-y-6">
  {/* Cards esistenti... */}
  
  {/* ═══════════ SEZIONE NURTURING 365 ═══════════ */}
  
  <div className="border-t border-slate-200 dark:border-slate-700 pt-8 mt-8">
    <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
      <Calendar className="h-6 w-6 text-emerald-500" />
      Email Nurturing 365 Giorni
      <Badge className="bg-emerald-100 text-emerald-800">Nuovo</Badge>
    </h2>
    
    {/* Card: Genera Templates */}
    <NurturingGeneratorCard />
    
    {/* Card: Lista Templates */}
    {nurturingConfig?.templatesGenerated && (
      <NurturingTemplatesCard />
    )}
    
    {/* Card: Variabili */}
    <NurturingVariablesCard />
    
    {/* Card: Dashboard */}
    <NurturingDashboardCard />
  </div>
</TabsContent>
```

---

## 13. Considerazioni Sicurezza

### 10.1 Protezione Dati
- Email lead criptate a riposo? (valutare necessità)
- GDPR: opt-out link in ogni email nurturing
- Logging: non loggare contenuto email completo, solo metadata

### 10.2 Rate Limiting
- Max 5 email benvenuto/minuto per lead (prevenire abuse)
- Max 200 email nurturing/giorno per consulente (limiti Resend)
- Backoff esponenziale su errori

### 10.3 Validazione
- Validare formato email prima di salvare
- Sanitizzare variabili custom (XSS prevention in HTML email)
- Verificare ownership lead prima di operazioni

---

*Documento di Design - Sistema Email Lead Proattivi*  
*Versione 1.0 - Gennaio 2026*  
*Ultimo aggiornamento: {{data_oggi}}*
