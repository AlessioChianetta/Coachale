# RDP — Centro di Attivazione (Setup Wizard Redesign)
**Data**: 22 Febbraio 2026  
**File principale**: `client/src/pages/consultant-setup-wizard.tsx` (1928 righe)  
**Impatto DB**: NESSUNO — tutte le scritture usano endpoint esistenti su tabelle esistenti  
**Impatto server**: NESSUNO — zero modifiche backend  
**Impatto altri file frontend**: NESSUNO — la pagina è self-contained

---

## 1. COSA NON CAMBIA (invariato al 100%)

| Elemento | Perché rimane invariato |
|----------|------------------------|
| `OnboardingStatus` interface (righe 83-146) | I 30+ campi booleani sono l'unica fonte di verità per lo stato degli step |
| Query `/api/consultant/onboarding/status` | Unico endpoint che alimenta tutta la pagina |
| `testMutation` + `handleTest()` | Logica di test già funzionante |
| Tutti i blocchi `{activeStep === "smtp" && ...}` (righe 1278-1870) | 15 blocchi di istruzioni specifiche per step, spostati ma non modificati |
| `ChatPanel` + `isOnboardingMode` + pannello AI | Invariato — 4 colonne quando AI mode attivo |
| `CredentialNotesCard` | Componente per note credenziali, invariato |
| `StepCard`, `StepNumberBadge`, `StatusBadge` | Componenti UI step, invariati (piccola aggiunta: badge "Opz." su vertex_ai) |
| `triggerConfetti`, `triggerMiniConfetti` | Animazioni celebrative, invariate |
| `stepNameMap` | Aggiornato solo per vertex_ai → "AI Engine (Gemini)" |
| `statusConfig` | Invariato |
| Tutti `configLink` di tutti gli step | Invariati — "Apri impostazioni complete" porta ancora alle pagine dedicate |

---

## 2. MODIFICHE AL DATABASE

**NESSUNA.** Ogni inline config panel scrive su tabelle già esistenti via endpoint già esistenti:

| Step | Tabella DB | Endpoint write |
|------|-----------|----------------|
| smtp | `users` (smtpHost, smtpPort, smtpUser, smtpPassword, smtpSecure, smtpFromEmail, smtpFromName, smtpEmailTone, smtpEmailSignature) | `POST /api/consultant/smtp-settings` |
| twilio_config | `consultant_whatsapp_configs` (twilioAccountSid, twilioAuthToken, twilioWhatsappNumber) | `POST /api/consultant/twilio-settings` |
| google_calendar | `users` (googleCalendarToken, googleCalendarEmail) | OAuth redirect `POST /api/consultant/calendar/oauth/start` |
| video_meeting | `consultant_turn_configs` (username, password, enabled) | `POST /api/consultant/turn-config` |
| vertex_ai / gemini | `users` (geminiApiKeys, useSuperadminGemini) | `PUT /api/consultant/gemini-preference` + esistente |
| instagram_dm | OAuth Meta / `instagram_configs` | OAuth redirect `GET /api/instagram/oauth/start` |
| stripe_connect | Stripe Connect (account esterno) | Redirect Stripe Connect |

---

## 3. NUOVI TIPI TYPESCRIPT (aggiunti al file, righe 60-82 circa)

```typescript
// --- NUOVI TIPI ---

interface InlineConfigField {
  key: string;
  label: string;
  type: "text" | "password" | "number" | "toggle" | "select" | "textarea";
  placeholder?: string;
  hint?: string;
  options?: { value: string; label: string }[];
  sensitive?: boolean;  // se true: mostra "••••" se già salvato, click per modificare
  required?: boolean;
}

interface InlineConfig {
  getEndpoint: string;
  saveEndpoint: string;
  saveMethod: "POST" | "PUT";
  fields: InlineConfigField[];
  dataMapper: (apiResponse: any) => Record<string, any>;
  payloadMapper: (formState: Record<string, any>) => any;
  oauthStart?: string;         // se presente → bottone OAuth invece del form
  oauthLabel?: string;         // label bottone OAuth
  oauthStatusCheck?: (apiResponse: any) => boolean;  // true = già connesso
  usedBySteps?: string[];      // step IDs che dipendono da queste credenziali
}

// Estensione OnboardingStep (aggiunge 2 campi opzionali)
interface OnboardingStep {
  // ... tutti i campi esistenti ...
  optional?: boolean;         // NUOVO: step non critico (es. vertex_ai)
  inlineConfig?: InlineConfig; // NUOVO: config inline stile Make.com
}

interface Section {
  id: string;
  emoji: string;
  title: string;
  tagline: string;
  color: string;       // es. "blue" — usato per classi Tailwind
  gradient: string;    // es. "from-blue-500 to-cyan-500"
  steps: OnboardingStep[];
}
```

---

## 4. SEZIONI — STRUTTURA DATI COMPLETA

### Sezione 1 — "Acquisisci Clienti" 🚀
**ID**: `acquisition`  
**Color**: `blue`  
**Gradient**: `from-blue-500 to-cyan-500`  
**Tagline**: `"Ricevi lead e gestisci le conversazioni in automatico"`  
**Step nell'ordine di priorità**:

| # | ID step | Titolo | inlineConfig? |
|---|---------|--------|---------------|
| 1 | `twilio_config` | Configurazione Twilio + WhatsApp | ✅ Form inline |
| 2 | `approved_template` | Template WhatsApp Approvato | ❌ Link pagina dedicata |
| 3 | `inbound_agent` | Agente Inbound | ❌ Link pagina dedicata |
| 4 | `public_agent_link` | Link Pubblico Agente | ❌ Link pagina dedicata |
| 5 | `instagram_dm` | Instagram Direct Messaging | ✅ OAuth button |
| 6 | `lead_import` | Import Lead | ❌ Link pagina dedicata |
| 7 | `first_campaign` | Prima Campagna | ❌ Link pagina dedicata |

**inlineConfig `twilio_config`**:
- GET: `/api/consultant/twilio-settings`
- SAVE: `POST /api/consultant/twilio-settings`
- dataMapper: `(d) => ({ accountSid: d.settings?.accountSid || "", authToken: "", whatsappNumber: d.settings?.whatsappNumber || "" })`
- payloadMapper: `(s) => ({ accountSid: s.accountSid, authToken: s.authToken, whatsappNumber: s.whatsappNumber })`
- Campi:
  - `accountSid` | text | "Account SID" | placeholder "ACxxxx..." | hint "Trovalo su console.twilio.com → Dashboard"
  - `authToken` | password | sensitive:true | "Auth Token" | hint "Copia da Twilio console, non viene mai rimostrato per sicurezza"
  - `whatsappNumber` | text | "Numero WhatsApp" | placeholder "whatsapp:+39XXXXXXXXXX" | hint "Include il prefisso paese: whatsapp:+39..."
- usedBySteps: `["approved_template","inbound_agent","outbound_agent","consultative_agent","first_campaign"]`

**inlineConfig `instagram_dm`**:
- GET: `/api/instagram/oauth/status` (o `/api/whatsapp/instagram-configs` per check)
- oauthStart: `/api/instagram/oauth/start`
- oauthLabel: `"Connetti Instagram Business"`
- oauthStatusCheck: `(d) => d?.configs?.length > 0`
- Nota: redirect OAuth Meta, non form inline
- usedBySteps: `[]`

---

### Sezione 2 — "Chiudi e Incassa" 💰
**ID**: `sales`  
**Color**: `violet`  
**Gradient**: `from-violet-500 to-purple-500`  
**Tagline**: `"Converti i lead in clienti paganti"`  

| # | ID step | Titolo | inlineConfig? |
|---|---------|--------|---------------|
| 1 | `stripe_connect` | Stripe Connect | ✅ OAuth button |
| 2 | `outbound_agent` | Agente Outbound | ❌ Link pagina dedicata |
| 3 | `consultative_agent` | Agente Consulenziale | ❌ Link pagina dedicata |
| 4 | `first_summary_email` | Prima Email Riassuntiva | ❌ Link pagina dedicata |
| 5 | `video_meeting` | Video Meeting (TURN) | ✅ Form inline |

**inlineConfig `stripe_connect`**:
- GET: `/api/consultant/stripe-settings`
- oauthStart: `/consultant/whatsapp?tab=licenses` (redirect to Stripe Connect page)
- oauthLabel: `"Collega Stripe per i pagamenti"`
- oauthStatusCheck: `(d) => d?.hasStripeAccount === true`
- Nota: non è vero OAuth ma redirect a pagina con flusso Connect

**inlineConfig `video_meeting`**:
- GET: `/api/consultant/turn-config`
- SAVE: `POST /api/consultant/turn-config`
- dataMapper: `(d) => ({ username: d.config?.username || "", password: "", enabled: d.config?.enabled ?? true })`
- payloadMapper: `(s) => ({ username: s.username, password: s.password, enabled: s.enabled })`
- Campi:
  - `username` | text | "API Key Metered.ca" | hint "Trovala su dashboard.metered.ca → API Keys"
  - `password` | password | sensitive:true | "Secret Key"
  - `enabled` | toggle | "Abilita TURN server"
- usedBySteps: `[]`

---

### Sezione 3 — "AI Operativa" 🤖
**ID**: `ai_ops`  
**Color**: `indigo`  
**Gradient**: `from-indigo-500 to-blue-600`  
**Tagline**: `"La piattaforma lavora per te in autonomia 24/7"`  

| # | ID step | Titolo | inlineConfig? |
|---|---------|--------|---------------|
| 1 | `ai_autonomo` | AI Autonomo | ❌ Link pagina dedicata |
| 2 | `email_journey` | Email Journey | ❌ Link pagina dedicata |
| 3 | `nurturing_emails` | Email Nurturing 365 | ❌ Link pagina dedicata |
| 4 | `email_hub` | Email Hub | ❌ Link pagina dedicata |
| 5 | `voice_calls` | Chiamate Voice (Alessia AI) | ❌ Link pagina dedicata |

Nota: questa sezione non ha config inline perché le funzionalità dipendono da configurazioni di altri step (SMTP per email, Twilio per WhatsApp, Gemini per AI — già configurati nelle sezioni 1 e 5).

---

### Sezione 4 — "Contenuti & Autorità" 📚
**ID**: `content`  
**Color**: `amber`  
**Gradient**: `from-amber-500 to-orange-500`  
**Tagline**: `"Educa i clienti e posizionati come esperto"`  

| # | ID step | Titolo | inlineConfig? |
|---|---------|--------|---------------|
| 1 | `first_course` | Primo Corso | ❌ Link pagina dedicata |
| 2 | `first_exercise` | Primo Esercizio | ❌ Link pagina dedicata |
| 3 | `knowledge_base` | Base di Conoscenza | ❌ Link pagina dedicata |
| 4 | `ai_ideas` | Idee AI Generate | ❌ Link pagina dedicata |
| 5 | `whatsapp_template` | Altri Template WhatsApp | ❌ Link pagina dedicata |

---

### Sezione 5 — "Integrazioni & Sistema" ⚙️
**ID**: `integrations`  
**Color**: `slate`  
**Gradient**: `from-slate-500 to-gray-600`  
**Tagline**: `"Collega gli strumenti di base della piattaforma"`  

| # | ID step | Titolo | optional | inlineConfig? |
|---|---------|--------|----------|---------------|
| 1 | `smtp` | Email SMTP | ❌ | ✅ Form inline |
| 2 | `google_calendar` | Google Calendar | ❌ | ✅ OAuth button |
| 3 | `vertex_ai` | AI Engine (Gemini) | ✅ | ✅ Form inline |

**inlineConfig `smtp`**:
- GET: `/api/consultant/smtp-settings`
- SAVE: `POST /api/consultant/smtp-settings`
- dataMapper: `(d) => ({ host: d.smtpHost||"", port: d.smtpPort||587, secure: d.smtpSecure??true, username: d.smtpUser||"", password: "", fromEmail: d.fromEmail||"", fromName: d.fromName||"" })`
- payloadMapper: `(s) => ({ host:s.host, port:Number(s.port), secure:s.secure, username:s.username, password:s.password, fromEmail:s.fromEmail, fromName:s.fromName })`
- Campi:
  - `host` | text | "Server SMTP" | "smtp.gmail.com" | hint "Gmail: smtp.gmail.com | Outlook: smtp.office365.com"
  - `port` | number | "Porta" | "587" | hint "587 per TLS, 465 per SSL, 25 per non cifrato"
  - `secure` | toggle | "Usa SSL/TLS"
  - `username` | text | "Email o Username" | "tua@email.com"
  - `password` | password | sensitive:true | "Password / App Password" | hint "Gmail: genera App Password su account.google.com/apppasswords"
  - `fromEmail` | text | "Email mittente" | "noreply@tuodominio.com"
  - `fromName` | text | "Nome mittente" | "Il tuo nome o azienda"
- usedBySteps: `["email_journey","nurturing_emails","first_summary_email","email_hub"]`

**inlineConfig `google_calendar`**:
- GET: `/api/consultant/calendar/status`
- oauthStart: `/api/consultant/calendar/oauth/start` (POST, poi redirect Google)
- oauthLabel: `"Connetti Google Calendar"`
- oauthStatusCheck: `(d) => d?.connected === true`
- usedBySteps: `["inbound_agent","outbound_agent","video_meeting"]`
- Nota UI: mostrare email connessa se già configurato (`d.email`)

**inlineConfig `vertex_ai`** (Gemini — opzionale):
- GET: `/api/consultant/gemini-preference`
- SAVE: `PUT /api/consultant/gemini-preference`
- dataMapper: `(d) => ({ useSuperAdmin: d.useSuperAdminGemini ?? true, hasOwnKeys: d.hasOwnGeminiKeys || false })`
- Nota: questo step mostra diversamente — non un form di chiave API raw, ma un toggle "Usa provider condiviso (consigliato)" vs "Usa mie chiavi Gemini"
- Campi:
  - `useSuperAdmin` | toggle | "Usa AI Engine pre-configurato (consigliato)" | hint "Il sistema usa già Google AI Studio pre-configurato. Disattiva solo se vuoi usare un account Gemini personale."
- Se `useSuperAdmin = false`: mostrare link a `/consultant/api-keys-unified?tab=ai` per inserire chiavi proprie
- Banner sopra il form: `"✅ AI già attiva sul tuo account — pre-configurata dal sistema"`
- usedBySteps: `["ai_autonomo","email_journey","nurturing_emails","voice_calls"]`

---

## 5. NUOVI COMPONENTI (creati nello stesso file)

### 5.1 `InlineConfigPanel` (generico)

**Responsabilità**: Pannello collassabile che permette di configurare un servizio direttamente nel wizard.

**Props**:
```typescript
interface InlineConfigPanelProps {
  config: InlineConfig;
  stepId: string;
  onSaveSuccess: () => void;   // chiama refetch() per aggiornare lo status
  testEndpoint?: string;
  testingStep: string | null;
  onTest: (stepId: string, endpoint?: string) => void;
}
```

**Stati interni**:
- `isExpanded: boolean` — aperto/chiuso (default: aperto se step è pending, chiuso se già configurato)
- `formState: Record<string, any>` — valori del form
- `isSaving: boolean`
- `saveSuccess: boolean` — mostra "✓ Salvato" per 2 secondi
- `isAlreadyConfigured: boolean` — derivato dai dati GET
- `sensitiveFieldEditing: Set<string>` — campi password che l'utente sta modificando
- `isLoading: boolean` — durante GET iniziale

**Flusso**:
1. Mount → GET `config.getEndpoint` → `config.dataMapper()` → popola `formState`
2. Se `dataMapper` ritorna valori non-vuoti → `isAlreadyConfigured = true` → pannello collassato con "Già configurato — modifica"
3. Se step pending → `isExpanded = true` automaticamente
4. Submit → `config.payloadMapper(formState)` → `fetch(saveEndpoint, { method: saveMethod, body })` → success → `onSaveSuccess()` (refetch status) → mostra "✓ Salvato"
5. Dopo salvataggio: se `testEndpoint` → mostra "Testa subito →" button inline

**Struttura JSX**:
```
<div className="mt-4 rounded-xl border overflow-hidden">
  
  [HEADER COLLASSABILE]
  ● indicatore colore (verde=configurato, grigio=no)
  "Configura direttamente qui" / "Già configurato — modifica"
  [icona chevron]
  
  [BODY ESPANSO — AnimatePresence]
  
  [SE OAUTH:]
  Card con stato connessione + bottone "Connetti →"
  [email connessa se disponibile]
  
  [SE FORM:]
  Per ogni field:
    Label + hint
    Input / Password / Number / Toggle / Select
    [Per password sensitive: testo "••••••" + link "Modifica" se già configurato e non in editing]
  
  [FOOTER]
  Badge "🔗 Riutilizzato da: Email Journey, Nurturing 365..." (se usedBySteps)
  
  [ACTIONS]
  [Salva credenziali] (disabled se isSaving)
  [Testa subito] (visibile solo dopo saveSuccess, se testEndpoint presente)
  
  [Apri impostazioni complete →] (link piccolo grigio a configLink, sempre visibile)
```

**Gestione campo password sensitive**:
- Se `formState[field.key]` è vuoto ma `isAlreadyConfigured = true`:
  - Mostrare `"••••••••"` in grigio + link "Clicca per modificare"
  - Quando cliccato: `sensitiveFieldEditing.add(field.key)` → mostra Input vuoto per re-inserimento
  - Nota sotto: "Lascia vuoto per mantenere la password salvata"
  - Se rimasto vuoto nel payload: NON includere il campo nella POST (il server mantiene il valore esistente)

---

### 5.2 `InlineField` (sotto-componente)

**Props**: `{ field, value, onChange, isConfigured, isSensitiveEditing, onStartSensitiveEdit }`

**Per tipo**:
- `text`: `<Input className="font-mono text-sm" />`
- `password` + sensitive: placeholder `"••••••••"` → gestione sopra descritta
- `number`: `<Input type="number" />`
- `toggle`: `<div className="flex items-center justify-between"><Label /><Switch /></div>`
- `select`: `<Select><SelectContent>{options.map(...)}</SelectContent></Select>`
- `textarea`: `<Textarea className="font-mono text-xs min-h-[120px]" />`

Sotto ogni field: se `field.hint` → `<p className="text-xs text-muted-foreground mt-1">{field.hint}</p>`

---

### 5.3 `UsedByBadge` (sotto-componente)

```tsx
function UsedByBadge({ stepIds }: { stepIds: string[] }) {
  // Mostra solo se stepIds.length > 0
  return (
    <div className="flex items-start gap-2 text-xs p-2 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-900">
      <LinkIcon className="h-3 w-3 text-blue-500 mt-0.5 flex-shrink-0" />
      <span>
        <span className="font-medium text-blue-700 dark:text-blue-300">Queste credenziali vengono usate anche da:</span>{" "}
        <span className="text-blue-600 dark:text-blue-400">
          {stepIds.map(id => stepNameMap[id]).join(", ")}
        </span>
      </span>
    </div>
  );
}
```

---

### 5.4 `SectionCard` (componente nuovo per la griglia)

**Props**: `{ section: Section; onClick: () => void; isUrgent: boolean }`

**Calcoli interni**:
- `completed = section.steps.filter(s => s.status === "verified").length`
- `total = section.steps.length`
- `pct = Math.round((completed / total) * 100)`
- `urgencyColor = pct < 30 ? "red" : pct < 80 ? "amber" : "emerald"`
- `isComplete = pct === 100`

**JSX**:
```
<motion.div
  whileHover={{ y: -3, boxShadow: "..." }}
  whileTap={{ scale: 0.98 }}
  onClick={onClick}
  className="cursor-pointer rounded-2xl border bg-white dark:bg-slate-900 p-6 flex flex-col gap-4 relative overflow-hidden"
>
  [SFONDO GRADIENTE SOTTILE]
  absolute inset-0 bg-gradient-to-br {section.gradient} opacity-[0.04]
  
  [RIGA HEADER]
  <span className="text-4xl">{section.emoji}</span>
  <div>
    <h2 className="text-lg font-bold">{section.title}</h2>
    <p className="text-xs text-muted-foreground">{section.tagline}</p>
  </div>
  
  [BADGE "⚡ Inizia qui" — pulsante, solo se isUrgent]
  <Badge className="animate-pulse bg-{section.color}-500 text-white">⚡ Inizia qui</Badge>
  
  [SEPARATORE]
  
  [PROGRESS BAR]
  SE isComplete:
    <div className="bg-emerald-50 text-emerald-700 rounded-xl p-3 text-center text-sm font-medium">
      ✓ Sezione completata
    </div>
  ALTRIMENTI:
    <Progress value={pct} className="h-2" indicatorClassName="bg-{urgencyColor}-500" />
    <div className="flex items-center justify-between text-xs">
      <span className="text-muted-foreground">{completed}/{total} completati</span>
      <Badge variant="outline" className="font-mono text-{urgencyColor}-600 border-{urgencyColor}-200 bg-{urgencyColor}-50">
        {pct}%
      </Badge>
    </div>
  
  [BOTTONE]
  <Button size="sm" className="w-full mt-auto bg-gradient-to-r {section.gradient} text-white border-0 hover:opacity-90">
    {isComplete ? "Rivedi ↗" : pct === 0 ? "Inizia →" : "Continua →"}
  </Button>
```

---

### 5.5 `ContextualBanner` (componente nuovo)

**Props**: `{ sections: Section[]; completedSteps: number; totalSteps: number }`

**Logica**:
```typescript
const section1 = sections[0]; // "Acquisisci Clienti"
const section1Pct = calcPct(section1);
const allComplete = completedSteps === totalSteps;
const globalPct = Math.round((completedSteps / totalSteps) * 100);

const config = allComplete
  ? { bg: "emerald", icon: "🎉", title: "Sistema completamente attivato!", text: "La piattaforma lavora per te 24/7. Puoi ora concentrarti sui clienti." }
  : section1Pct < 50
  ? { bg: "blue", icon: "⚡", title: "Inizia da qui per generare i primi lead", text: `Attiva il sistema di acquisizione — ti bastano ~10 minuti. Poi i lead arrivano in automatico.`, cta: "Vai all'acquisizione clienti →", ctaSection: "acquisition" }
  : globalPct >= 70
  ? { bg: "violet", icon: "🔥", title: "Ottimo lavoro! Sei quasi al 100%", text: `Mancano solo ${totalSteps - completedSteps} step per la piena automazione.` }
  : { bg: "indigo", icon: "🚀", title: "La macchina sta girando!", text: "Continua a completare le sezioni per sbloccare tutta l'automazione." };
```

**JSX**:
```
<div className="rounded-2xl p-4 border bg-{config.bg}-50 dark:bg-{config.bg}-900/20 border-{config.bg}-200 flex items-center gap-4">
  <span className="text-3xl">{config.icon}</span>
  <div className="flex-1">
    <p className="font-semibold text-{config.bg}-900 dark:text-{config.bg}-100">{config.title}</p>
    <p className="text-sm text-{config.bg}-700 dark:text-{config.bg}-300 mt-0.5">{config.text}</p>
  </div>
  [SE config.cta]:
    <Button size="sm" onClick={() => setActiveSection(config.ctaSection)} className="shrink-0">
      {config.cta}
    </Button>
  [SE allComplete]:
    [confetti trigger al mount se non già triggerato]
</div>
```

---

## 6. NUOVO LAYOUT — RENDER PRINCIPALE

### 6.1 Stato aggiuntivo nel componente `ConsultantSetupWizard`

```typescript
const [activeSection, setActiveSection] = useState<string | null>(null);
```

**Helper**:
```typescript
const autoSelectStep = (section: Section) => {
  const firstPending = section.steps.find(s => s.status !== "verified");
  setActiveStep(firstPending?.id ?? section.steps[0].id);
  setActiveSection(section.id);
};

const currentSection = activeSection ? sections.find(s => s.id === activeSection) : null;

const urgentSectionId = sections
  .filter(s => {
    const pct = Math.round(s.steps.filter(x => x.status === "verified").length / s.steps.length * 100);
    return pct < 50;
  })
  .sort((a, b) => {
    const pa = a.steps.filter(x => x.status === "verified").length / a.steps.length;
    const pb = b.steps.filter(x => x.status === "verified").length / b.steps.length;
    return pa - pb;
  })[0]?.id ?? null;
```

### 6.2 Header aggiornato

**Titolo**: `"Centro di Attivazione"` (era "Setup Iniziale Piattaforma")  
**Icona header**: `Rocket` → rimane  
**Gradiente titolo**: `from-indigo-600 to-violet-600` → rimane

**Sottotitolo dinamico**:
```typescript
const subtitleText =
  completedSteps === 0 ? "Inizia dall'acquisizione lead — ci vogliono 10 minuti"
  : completedSteps < totalSteps * 0.3 ? "Stai costruendo la macchina — ottimo inizio!"
  : completedSteps < totalSteps * 0.7 ? "Sei a metà — la piattaforma sta prendendo forma"
  : completedSteps < totalSteps ? "Quasi pronto — ancora pochi step e sei al 100%"
  : "Sistema completamente attivato 🎉";
```

**Breadcrumb** (quando `activeSection !== null`):
```
[← Panoramica]  Centro di Attivazione  /  {currentSection.emoji} {currentSection.title}
```
Bottone `"← Panoramica"` → `onClick={() => setActiveSection(null)}`

### 6.3 Vista principale — griglia card (quando `activeSection === null`)

**Struttura**:
```
<div className="flex-1 overflow-auto p-6">
  
  <ContextualBanner sections={sections} ... />
  
  <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4 mt-6">
    {sections.map((section, i) => (
      <motion.div
        key={section.id}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: i * 0.06 }}
      >
        <SectionCard
          section={section}
          onClick={() => autoSelectStep(section)}
          isUrgent={urgentSectionId === section.id}
        />
      </motion.div>
    ))}
  </div>
  
  [STATS GLOBALI IN BASSO]
  <div className="mt-8 grid grid-cols-3 gap-4">
    <StatCard label="Step completati" value={completedSteps} total={totalSteps} />
    <StatCard label="Sezioni attive" value={sections.filter(s => s.steps.some(x => x.status==="verified")).length} total={5} />
    <StatCard label="Step rimanenti" value={totalSteps - completedSteps} />
  </div>

```

**`StatCard`** (piccolo sotto-componente inline):
- Card piccola con valore grande + label piccola + barra progresso opzionale

### 6.4 Vista dettaglio sezione (quando `activeSection !== null`)

**Struttura** (griglia 12 colonne, come attuale):
```
<div className="flex-1 grid grid-cols-12 overflow-hidden min-h-0">

  [SIDEBAR SINISTRA — col-span-4 (o 3 se AI panel aperto)]
  
  <aside className="border-r bg-white dark:bg-slate-900 overflow-hidden flex flex-col">
    
    [HEADER SEZIONE]
    <div className="p-4 border-b"
      style={{ borderTop: `3px solid` }}  ← gradiente colore sezione
    >
      <button onClick={() => setActiveSection(null)} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-3">
        ← Tutte le sezioni
      </button>
      <div className="flex items-center gap-3">
        <span className="text-2xl">{currentSection.emoji}</span>
        <div>
          <h2 className="font-bold text-base">{currentSection.title}</h2>
          <p className="text-xs text-muted-foreground">{currentSection.tagline}</p>
        </div>
      </div>
      [Barra progresso sezione]
      <Progress value={sectionPct} className="mt-3 h-1" />
      <p className="text-xs text-muted-foreground mt-1">
        {sectionCompleted}/{sectionTotal} completati · {sectionPct}%
      </p>
    </div>
    
    [LISTA STEP]
    <ScrollArea className="flex-1 p-3">
      {currentSection.steps.map((step, index) => (
        <motion.div key={step.id} initial={{ opacity:0,x:-20 }} animate={{ opacity:1,x:0 }} transition={{ delay: index*0.04 }}>
          <StepCard   ← componente INVARIATO
            step={step}
            isActive={activeStep === step.id}
            onClick={() => setActiveStep(step.id)}
          />
          [SE step.optional]:
            <Badge className="ml-9 mb-1 text-xs bg-slate-100 text-slate-500">Opzionale</Badge>
        </motion.div>
      ))}
    </ScrollArea>
    
    [NAVIGAZIONE SEZIONI]
    <div className="border-t p-3 flex items-center justify-between">
      {prevSection && (
        <button onClick={() => autoSelectStep(prevSection)} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
          ‹ {prevSection.emoji} {prevSection.title}
        </button>
      )}
      {nextSection && (
        <button onClick={() => autoSelectStep(nextSection)} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 ml-auto">
          {nextSection.emoji} {nextSection.title} ›
        </button>
      )}
    </div>
  </aside>
  
  [PANNELLO DETTAGLIO STEP — col-span-8 (o 5 se AI panel)]
  
  <section className="overflow-auto bg-gradient-to-br ...">
    <div className="p-8">
      <AnimatePresence mode="wait">
        {activeStepData && (
          <motion.div key={activeStepData.id} ...>
            <Card>
              <CardHeader>
                [... INVARIATO ...]
                [SE activeStepData.optional]:
                  <Badge variant="outline" className="text-xs bg-slate-50 text-slate-400">Opzionale</Badge>
              </CardHeader>
              <CardContent>
                [... tutto invariato fino a "Azioni Disponibili" ...]
                
                [NUOVO BLOCCO — "Configurazione Diretta" — PRIMA di "Azioni Disponibili"]
                {activeStepData.id === "vertex_ai" && (
                  <Alert className="bg-emerald-50 border-emerald-200">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    <AlertDescription className="text-emerald-700">
                      ✅ AI già attiva sul tuo account — Google AI Studio pre-configurato dal sistema
                    </AlertDescription>
                  </Alert>
                )}
                
                {activeStepData.inlineConfig && (
                  <div className="space-y-2 mb-4">
                    <h4 className="font-medium text-sm flex items-center gap-2">
                      <Settings className="h-4 w-4" />
                      Configurazione Diretta
                      <Badge variant="outline" className="text-xs text-blue-600 border-blue-200 bg-blue-50">
                        🔗 Stile Make.com
                      </Badge>
                    </h4>
                    <InlineConfigPanel
                      config={activeStepData.inlineConfig}
                      stepId={activeStepData.id}
                      onSaveSuccess={refetch}
                      testEndpoint={activeStepData.testEndpoint}
                      testingStep={testingStep}
                      onTest={handleTest}
                    />
                  </div>
                )}
                
                [... "Azioni Disponibili" INVARIATO ...]
                [... tutti i blocchi {activeStep === "..." && ...} INVARIATI ...]
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  </section>
  
  [PANNELLO AI — INVARIATO]
  {isOnboardingMode && <motion.aside ...><ChatPanel .../></motion.aside>}

</div>
```

---

## 7. MODIFICA STEP `vertex_ai` — DETTAGLIO

**Prima**:
```typescript
{
  id: "vertex_ai",
  stepNumber: 1,
  title: "Vertex AI (Gemini)",
  description: "Configura le credenziali Google Cloud per utilizzare Gemini...",
  status: status?.vertexAiStatus || "pending",
  configLink: "/consultant/api-keys-unified?tab=ai",
  testEndpoint: "/api/consultant/onboarding/test/vertex-ai",
}
```

**Dopo**:
```typescript
{
  id: "vertex_ai",
  stepNumber: 1,  // numero non visibile nella nuova UI, ma mantenuto
  title: "AI Engine (Gemini)",
  description: "Pre-configurato automaticamente. Aggiungi una tua chiave Gemini personale solo se vuoi un account AI dedicato.",
  optional: true,
  status: status?.vertexAiStatus || "verified",  // ← mostrato come verified di default perché già attivo
  configLink: "/consultant/api-keys-unified?tab=ai",
  testEndpoint: "/api/consultant/onboarding/test/vertex-ai",
  inlineConfig: { ... vedi sezione 4 ... }
}
```

**Nota importante su `status`**: Il fatto che vertex_ai appaia "pending" per molti consulenti è fuorviante, perché il sistema usa comunque Google AI Studio del SuperAdmin. L'opzione più corretta è mostrarlo come `"verified"` di default (il sistema AI funziona già), e lasciare la configurazione opzionale per chi vuole usare chiavi proprie. Implementazione: `status: (status?.vertexAiStatus && status.vertexAiStatus !== "pending") ? status.vertexAiStatus : "verified"` — se mai configurato mostra "verified", se ha un errore mostra "error".

**Blocco contestuale `{activeStep === "vertex_ai" && ...}` — sostituito**:
```tsx
{activeStep === "vertex_ai" && (
  <div className="mt-4 space-y-3">
    <Alert className="bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200">
      <CheckCircle2 className="h-4 w-4 text-emerald-500" />
      <AlertDescription>
        <strong className="text-emerald-700">Il motore AI è già attivo</strong> sul tuo account tramite Google AI Studio pre-configurato. Non devi fare nulla.
      </AlertDescription>
    </Alert>
    <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border">
      <h4 className="font-medium text-sm mb-2">Quando aggiungere una chiave personale?</h4>
      <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
        <li>Vuoi avere un limite di utilizzo dedicato al tuo account</li>
        <li>Vuoi usare un modello Gemini specifico</li>
        <li>Il SuperAdmin ti ha chiesto di configurare le tue chiavi</li>
      </ul>
    </div>
    <CredentialNotesCard stepId="vertex_ai" />
  </div>
)}
```

---

## 8. RIMOZIONE CODICE OBSOLETO

Dopo il refactor, le seguenti strutture vengono rimosse o sostituite:

| Struttura | Cosa succede |
|-----------|-------------|
| `interface Phase` | Rimossa (sostituita da `Section`) |
| `const phases: Phase[]` (righe 610-908) | Rimossa, sostituita da `const sections: Section[]` |
| `phaseGradients`, `phaseBgGradients` | Rimossi |
| `function PhaseSection` | Rimossa (sostituita da nuova sidebar dettaglio sezione) |
| `<aside>` sidebar sinistra attuale (righe 1092-1107) | Sostituita dalla logica vista griglia + sidebar sezione |
| `const allSteps = phases.flatMap(...)` | Aggiornato: `sections.flatMap(s => s.steps)` |

---

## 9. AGGIORNAMENTI IMPORT

Import da aggiungere:
```typescript
import { Switch } from "@/components/ui/switch"; // per i toggle nei form inline
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"; // per select
```

Import già presenti che vengono usati (invariati):
- `Settings` (già importato riga 35)
- `LinkIcon` (già importato riga 48)
- `ChevronDown` (già importato riga 27)
- `useQuery` (già importato riga 2)
- `getAuthHeaders` (già importato riga 6)

---

## 10. PIANO DI IMPLEMENTAZIONE — ORDINE ESATTO

1. **Aggiungere tipi** (`InlineConfigField`, `InlineConfig`, estensione `OnboardingStep`, `Section`) → righe 60-82
2. **Aggiungere import** (`Switch`, `Select`, ecc.)
3. **Creare `InlineField`** come funzione separata (senza hook)
4. **Creare `UsedByBadge`** come funzione separata
5. **Creare `InlineConfigPanel`** come funzione con hook (`useQuery`, `useState`)
6. **Creare `SectionCard`** come funzione separata
7. **Creare `ContextualBanner`** come funzione separata (prop `setActiveSection` passata)
8. **Creare `StatCard`** come funzione minima inline
9. **Modificare `vertex_ai` step** nella definizione e blocco contestuale
10. **Sostituire `const phases`** con `const sections`
11. **Aggiungere `useState<string | null>(null)`** per `activeSection`
12. **Aggiungere helper** `autoSelectStep`, `currentSection`, `urgentSectionId`
13. **Aggiornare calcoli** `allSteps`, `completedSteps`, `totalSteps`
14. **Aggiornare header** (titolo, sottotitolo, breadcrumb)
15. **Sostituire il blocco `<div className="flex-1 grid...">` (riga 1091)** con logica condizionale griglia/dettaglio
16. **Aggiungere `InlineConfigPanel`** nel pannello dettaglio step
17. **Rimuovere codice obsoleto** (`PhaseSection`, `Phase`, `phases`, gradient maps)
18. **Test visivo** navigazione griglia → dettaglio → step → form inline → salva → test

---

## 11. GESTIONE ERRORI E EDGE CASES

| Caso | Gestione |
|------|----------|
| GET endpoint fallisce | Mostra "Impossibile caricare la configurazione esistente" con retry button |
| POST salvataggio fallisce | Toast di errore + non chiudere il form |
| Campo password lasciato vuoto su modifica | NON includere nel payload (mantiene valore salvato sul server) |
| OAuth redirect fallisce | Pagina di destinazione già gestisce l'errore |
| Step senza `inlineConfig` | Nessun pannello "Configurazione Diretta" mostrato |
| Tutte le sezioni complete | Confetti + banner verde + messaggio celebrativo |
| `vertex_ai` status = "error" | Mostrare errore ma mantenere badge "Opzionale" |
| Sezione con 0 step completati | Card rossa, badge "⚡ Inizia qui" se è anche quella con pct minimo |

---

## 12. NOTE FINALI

- **Zero modifiche al DB**: confermato — tutti gli endpoint usati già esistono
- **Zero modifiche al server**: confermato
- **Retrocompatibilità**: il `configLink` di ogni step rimane invariato, quindi le pagine dedicate continuano a funzionare normalmente
- **Gestione password**: i campi `authToken`, `smtpPassword`, `turnPassword` non vengono mai ritornati dal server per sicurezza → il campo mostra `"••••••"` se `isAlreadyConfigured`, richiede reinserimento per modificare
- **QueryClient invalidation**: dopo salvataggio inline, chiamare `queryClient.invalidateQueries(["/api/consultant/onboarding/status"])` oltre al `refetch()` diretto
