# MAPPATURA COMPLETA SIDEBAR CONSULENTE

**Ultima modifica**: Gennaio 2026  
**Versione**: 1.0

---

## SEZIONE: PRINCIPALE

### Dashboard
- **Path**: `/consultant`
- **Nome Sidebar**: `Dashboard`
- **Icona**: `Home` (colore: `text-cyan-500`)
- **Header**: Gradient header con saluto personalizzato ("Buongiorno/Buon pomeriggio/Buonasera"), nome utente e panoramica attività
- **Pulsanti Header**: 
  - **Notifiche (icona campanella)** - alto destra - Mostra notifiche recenti
- **Tab**: Nessuno
- **Contenuto principale**: 
  - KPI Cards: Clienti Attivi, Esercizi da Revisionare, Consulenze Settimana, Clienti Prioritari
  - Sezione "Richiede Attenzione" con link ad azioni urgenti
  - Attività Recente (con pulsante "Vedi tutto")
  - Prossimi Appuntamenti (con pulsante "Calendario")
  - Trend Esercizi (con pulsante "Vedi tutti")
  - Navigazione rapida alle sezioni principali

---

### AI Assistant
- **Path**: `/consultant/ai-assistant`
- **Nome Sidebar**: `AI Assistant`
- **Badge**: Nessuno
- **Icona**: `Sparkles` (colore: `text-teal-500`)
- **Header**: Header minimale, interfaccia chat fullscreen con sidebar conversazioni
- **Pulsanti Header**: 
  - **Nuova Conversazione (+)** - alto sinistra nella sidebar chat - Crea nuova conversazione
  - **Filtro Agenti** - alto sinistra sidebar chat - Filtra conversazioni per agente
  - **Elimina Tutte** - dropdown menu - Elimina tutte le conversazioni
  - **Preferenze AI (icona ingranaggio)** - alto destra - Apre pannello preferenze AI
  - **Gestisci Preferenze Clienti** - alto destra - Gestisce preferenze AI per clienti
- **Tab**: Nessuno (sidebar con lista conversazioni)
- **Contenuto principale**: 
  - Sidebar sinistra con lista conversazioni
  - Area chat principale con messaggi
  - Input area con selezione modello AI e livello thinking
  - Quick Actions suggerite
  - Welcome Screen per nuove conversazioni

---

### Setup Iniziale
- **Path**: `/consultant/setup-wizard`
- **Nome Sidebar**: `Setup Iniziale`
- **Badge**: `NEW`
- **Icona**: `Zap` (colore: `text-emerald-500`)
- **Header**: Header con icona rocket e titolo "Setup Iniziale", progress bar completamento
- **Pulsanti Header**: 
  - **Testa/Configura** - dentro ogni step - Testa o configura singolo step
  - **Refresh** - dentro ogni step - Aggiorna stato step
- **Tab**: Nessuno (wizard a fasi/accordion)
- **Contenuto principale**: 
  - Progress bar globale completamento
  - Fasi collapsabili:
    - Fase 1: Setup Base (Vertex AI, SMTP, Google Calendar, Video Meeting)
    - Fase 2: Lead Acquisition (Importazione lead, WhatsApp AI, Twilio)
    - Fase 3: Knowledge Base (Documenti)
    - Fase 4: AI Agents
    - Fase 5: Content & Campaigns
    - Fase 6: Training & Courses
    - Fase 7: Email Automation
    - Fase 8: Payments
    - Fase 9: Social Media
  - Ogni step ha: StatusBadge, link configurazione, test endpoint

---

## SEZIONE: LAVORO QUOTIDIANO

### Clienti
- **Path**: `/consultant/clients`
- **Nome Sidebar**: `Clienti`
- **Badge**: `12` (numero dinamico)
- **Icona**: `Users` (colore: `text-teal-500`)
- **Header**: Header gradient con titolo "I Tuoi Clienti", conteggio totale, filtri e azioni
- **Pulsanti Header**: 
  - **Nuovo Cliente** - alto destra - Apre dialog creazione nuovo cliente (icona `UserPlus`)
  - **Esporta** - alto destra - Esporta lista clienti (icona `Download`)
  - **Filtro Stato** (dropdown) - alto destra - Filtra per attivi/inattivi/tutti
  - **Cerca** (input) - alto destra - Ricerca clienti per nome/email
- **Tab**: Nessuno
- **Contenuto principale**: 
  - Tabella clienti con colonne: Checkbox, Cliente (avatar + nome), Email, Telefono, Data Registrazione, Stato, Azioni
  - Ogni riga ha:
    - Pulsante Modifica (icona Edit)
    - Menu dropdown con: Visualizza Profilo, Assegna Esercizio, API Keys Cliente, Modifica, Aggiungi/Rimuovi Profilo Consulente, Elimina
  - Paginazione in basso
  - Dialog creazione cliente con campi: Nome, Cognome, Email, Password, Switch "È un dipendente"

---

### Calendario
- **Path**: `/consultant/appointments`
- **Nome Sidebar**: `Calendario`
- **Icona**: `Calendar` (colore: `text-orange-500`)
- **Header**: Header gradient blu-indigo-viola con titolo "Gestione Appuntamenti" e pulsanti
- **Pulsanti Header**: 
  - **Nuova Consulenza** - alto destra - Apre dialog creazione appuntamento (icona `Plus`)
- **Tab** (4 tab):
  - **Mese** (icona `CalendarIcon`) - Vista calendario mensile
  - **Settimana** (icona `Calendar`) - Vista calendario settimanale
  - **Lista** (icona `List`) - Vista lista appuntamenti
  - **Echo** (icona `Mail`) - Vista email riassuntive post-consulenza
- **Contenuto principale**: 
  - Vista calendario con griglia giorni
  - Sidebar laterale con dettaglio giorno selezionato
  - Card appuntamento con: orario, cliente, durata, status, azioni
  - Dialog completamento consulenza con: checkbox follow-up, note, link Fathom
  - Pulsanti per ogni appuntamento: Modifica, Completa, Genera Email
  - Statistiche email mensili nella vista calendario

---

### Task
- **Path**: `/consultant/tasks`
- **Nome Sidebar**: `Task`
- **Icona**: `ListTodo` (colore: `text-rose-500`)
- **Header**: Header gradient blu-indigo con icona ListTodo e titolo "Task Clienti"
- **Pulsanti Header**: 
  - **Nuova Task** - alto destra - Apre dialog creazione task (icona `Plus`)
- **Tab**: Nessuno
- **Contenuto principale**: 
  - 4 Card statistiche: Totale Task, Completate, In Sospeso, Urgenti
  - Card Filtri con:
    - Select Stato (Tutte, Completate, In Sospeso)
    - Select Priorità (Tutte, Urgente, Alta, Media, Bassa)
    - Select Categoria (Tutte, Preparazione, Follow-up, Esercizio, Obiettivo, Promemoria)
    - Input Cerca
  - Sezione "Task in Bozza (da Echo)" con pulsante "Vai a Echo Dashboard"
  - Lista task raggruppate per consulenza
  - Ogni gruppo è espandibile con task singole
  - Dialog creazione task con selezione cliente

---

### Email Journey
- **Path**: `/consultant/ai-config`
- **Nome Sidebar**: `Email Journey`
- **Icona**: `Sparkles` (colore: `text-teal-500`)
- **Header**: Header gradient slate con icona Sparkles e titolo "Centro Controllo Email Automation"
- **Pulsanti Header**: Nessuno nel header principale
- **Tab** (10 tab):
  - **Controllo** (icona `Settings`) - Impostazioni automation generale
  - **Bozze** (icona `FileText`) - Email bozze da approvare
  - **Echo** (icona `Sparkles`) - Email riassuntive consulenze
  - **Riepilogo** (icona `Mail`) - Email di riepilogo
  - **Statistiche** (icona `BarChart3`) - Statistiche email
  - **Clienti** (icona `Users`) - Stato automazione per cliente
  - **Journey** (icona `Route`) - Template email journey
  - **Updates** (icona `Megaphone`) - Email updates/newsletter
  - **Test** (icona `Zap`) - Test invio email
  - **Nurturing** (icona `CalendarDays`) - Email nurturing automatiche
- **Contenuto principale**: 
  - Tab Controllo: Switch automation enabled, configurazione SMTP, frequenza email
  - Tab Bozze: Lista email draft con anteprima, modifica, invio
  - Tab Echo: Email riassuntive post-consulenza
  - Tab Journey: Gestione template con drag & drop ordine
  - Tab Statistiche: Grafici email inviate, tassi apertura, etc.
  - Brand Voice Section integrata

---

### Analisi Dati
- **Path**: `/consultant/client-data-analysis`
- **Nome Sidebar**: `Analisi Dati`
- **Badge**: `NEW`
- **Icona**: `BarChart3` (colore: `text-cyan-600`)
- **Header**: Header dinamico in base alla vista corrente
- **Pulsanti Header**: 
  - **Indietro** - alto sinistra - Torna alla vista precedente (icona `ChevronLeft`)
  - **Nuovo Dataset** - alto destra - Avvia upload nuovo dataset (icona `Upload`)
- **Tab**: Nessuno (navigazione per ViewMode)
- **ViewModes disponibili**:
  - **list** - Lista dataset esistenti
  - **upload** - Upload nuovo file
  - **preview** - Anteprima file caricato
  - **discovery** - Discovery colonne automatica
  - **view** - Visualizzazione dataset
  - **query** - Chat per query naturale sui dati
  - **results** - Risultati query
  - **metrics** - Editor metriche
  - **reconcile** - Report riconciliazione
- **Contenuto principale**: 
  - Lista dataset con: nome, stato, righe, azioni
  - Upload drag & drop per Excel/CSV
  - Anteprima file con selezione foglio
  - Mapping colonne con suggerimenti AI
  - Query chat con linguaggio naturale
  - Visualizzazione risultati con grafici
  - Editor metriche personalizzate

---

## SEZIONE: COMUNICAZIONE

### HUB Lead
- **Path**: `/consultant/lead-hub`
- **Nome Sidebar**: `HUB Lead`
- **Badge**: `HUB`
- **Icona**: `Target` (colore: `text-cyan-600`)
- **Header**: Hero banner gradient viola-indigo con titolo "Il tuo centro di controllo", statistiche lead/campagne/template
- **Pulsanti Header**: Nessuno nel header (azioni nelle card)
- **Tab** (pannello destro):
  - **Assistente** (icona `Bot`) - Chat AI contestuale
  - **Suggerimenti** (icona `Lightbulb`) - Tips per step corrente
- **Contenuto principale**: 
  - Progress Summary con percentuale completamento
  - 5 Step Cards (flow verticale):
    1. **Lead Proattivi** - `/consultant/proactive-leads` - Carica e gestisci contatti
    2. **Campagne** - `/consultant/campaigns` - Organizza lead in campagne
    3. **Template WhatsApp** - `/consultant/whatsapp-templates` - Seleziona template messaggi
    4. **Template Personalizzati** - `/consultant/whatsapp/custom-templates/list` - Crea template su misura
    5. **Automazioni** - `/consultant/automations` - Attiva pilota automatico
  - Ogni card ha pulsante azione hover con icona `ArrowRight`
  - Pannello destro con AI assistant e tips contestuali

---

### I tuoi dipendenti
- **Path**: `/consultant/whatsapp`
- **Nome Sidebar**: `I tuoi dipendenti`
- **Icona**: `Settings` (colore: `text-slate-500`)
- **Header**: Header gradient emerald-teal-cyan con icona MessageSquare e titolo "Dipendenti AI"
- **Pulsanti Header**: 
  - **Chat Agenti** - alto destra - Va a `/consultant/whatsapp-agents-chat` (icona `MessageCircle`)
  - **Nuovo Agente** - alto destra - Crea nuovo agente AI (icona `Plus`)
- **Tab** (5 tab principali):
  - **Agenti Personalizzati** (icona `Bot`) - Lista agenti creati
  - **Agenti di Sistema** (icona `Users`) - Agenti built-in (Millie, Echo, Spec, Stella)
  - **Idee AI** (icona `Lightbulb`) - Suggerimenti nuovi agenti
  - **Dipendenti AI** (icona `Crown`) - Gestione dipendenti
  - **Licenze** (icona `Key`) - Gestione licenze e abbonamenti clienti
- **Tab secondari (in Licenze)**:
  - **Stripe Connect (Revenue Share)** (icona `CreditCard`)
  - **Link Diretto (100% Tuo)** (icona `Link`)
  - Tab tier clienti: **Bronze (Gratuiti)**, **Argento (Abbonati)**, **Oro (Premium)**
- **Contenuto principale**: 
  - Roster agenti personalizzati con card per ogni agente
  - Card agenti sistema (Millie, Echo, Spec, Stella) con avatar, quote, features
  - Ideas carousel per nuovi agenti
  - Gestione dipendenti con statistiche
  - Pannello licenze con Stripe integration
  - Dialog configurazione agente con wizard multi-step

---

### Email Hub
- **Path**: `/consultant/email-hub`
- **Nome Sidebar**: `Email Hub`
- **Icona**: `Mail` (colore: `text-blue-500`)
- **Header**: Layout mailbox con sidebar account e header azioni
- **Pulsanti Header**: 
  - **Nuova Email** (icona `PenSquare`) - alto destra - Apre composer email
  - **Sincronizza** (icona `RefreshCw`) - alto destra - Sincronizza account email
  - **Aggiungi Account** (icona `Plus`) - sidebar sinistra - Aggiunge nuovo account email
  - **Import Wizard** - sidebar - Avvia wizard importazione
- **Tab**: Nessuno (folder navigation nella sidebar)
- **Folder Navigation (sidebar sinistra)**:
  - **Inbox** (icona `Inbox`)
  - **AI Drafts** (icona `Sparkles`)
  - **Starred** (icona `Star`)
  - **Sent** (icona `Send`)
  - **Drafts** (icona `FileText`)
  - **Trash** (icona `Trash2`)
- **Contenuto principale**: 
  - Lista email con: mittente, oggetto, anteprima, data, status AI
  - Dettaglio email con azioni: Rispondi, Inoltra, Archivia, Elimina
  - AI Drafts con confidence score e azioni: Approva, Modifica, Rifiuta, Invia
  - Pannello impostazioni AI per account
  - Knowledge base per account
  - Ticket system integrato
  - AI Events panel
  - Composer email con editor ricco
  - Import wizard per account IMAP/SMTP

---

## SEZIONE: CONTENT STUDIO

### Dashboard (Content Studio)
- **Path**: `/consultant/content-studio`
- **Nome Sidebar**: `Dashboard`
- **Icona**: `LayoutGrid` (colore: `text-purple-500`)

### Idee
- **Path**: `/consultant/content-studio/ideas`
- **Nome Sidebar**: `Idee`
- **Badge**: `AI`
- **Icona**: `Lightbulb` (colore: `text-amber-500`)

### Contenuti
- **Path**: `/consultant/content-studio/posts`
- **Nome Sidebar**: `Contenuti`
- **Icona**: `PenLine` (colore: `text-blue-500`)

### Campagne
- **Path**: `/consultant/content-studio/campaigns`
- **Nome Sidebar**: `Campagne`
- **Icona**: `Target` (colore: `text-rose-500`)

### Visuals
- **Path**: `/consultant/content-studio/visuals`
- **Nome Sidebar**: `Visuals`
- **Badge**: `AI`
- **Icona**: `Image` (colore: `text-teal-500`)

### Calendario
- **Path**: `/consultant/content-studio/calendar`
- **Nome Sidebar**: `Calendario`
- **Icona**: `Calendar` (colore: `text-orange-500`)

### Brand Assets
- **Path**: `/consultant/content-studio/brand`
- **Nome Sidebar**: `Brand Assets`
- **Icona**: `Palette` (colore: `text-violet-500`)

---

## SEZIONE: FORMAZIONE

### Università
- **Path**: `/consultant/university`
- **Nome Sidebar**: `Università`
- **Icona**: `GraduationCap` (colore: `text-amber-500`)

### Esercizi
- **Path**: `/consultant/exercises`
- **Nome Sidebar**: `Esercizi`
- **Icona**: `ClipboardList` (colore: `text-cyan-500`)

### Template
- **Path**: `/consultant/exercise-templates`
- **Nome Sidebar**: `Template`
- **Icona**: `BookOpen` (colore: `text-teal-500`)

### Corsi
- **Path**: `/consultant/library`
- **Nome Sidebar**: `Corsi`
- **Icona**: `BookOpen` (colore: `text-teal-600`)

---

## SEZIONE: BASE DI CONOSCENZA

### Documenti
- **Path**: `/consultant/knowledge-documents`
- **Nome Sidebar**: `Documenti`
- **Icona**: `FileText` (colore: `text-amber-500`)

### API Esterne
- **Path**: `/consultant/knowledge-apis`
- **Nome Sidebar**: `API Esterne`
- **Icona**: `Plug` (colore: `text-cyan-500`)

---

## SEZIONE: IMPOSTAZIONI

### API Keys
- **Path**: `/consultant/api-keys-unified`
- **Nome Sidebar**: `API Keys`
- **Icona**: `Key` (colore: `text-teal-500`)

### Automazioni Pagamento
- **Path**: `/consultant/payment-automations`
- **Nome Sidebar**: `Automazioni Pagamento`
- **Icona**: `CreditCard` (colore: `text-emerald-500`)

---

## SEZIONE: GUIDE

### Centro Guide
- **Path**: `/consultant/guides`
- **Nome Sidebar**: `Centro Guide`
- **Badge**: `HUB`
- **Icona**: `BookOpen` (colore: `text-rose-500`)

---

## SEZIONE: AI AVANZATO

### Consulenze AI
- **Path**: `/consultant/ai-consultations`
- **Nome Sidebar**: `Consulenze AI`
- **Icona**: `Sparkles` (colore: `text-teal-500`)

### File Search
- **Path**: `/consultant/file-search-analytics`
- **Nome Sidebar**: `File Search`
- **Badge**: `RAG`
- **Icona**: `FileSearch` (colore: `text-emerald-500`)

---

## NOTE TECNICHE

### Pattern UI Comuni
1. **Header Gradient**: La maggior parte delle pagine usa header con gradient `from-[color]-600 via-[color]-600 to-[color]-600`
2. **Pulsanti Alto Destra**: I pulsanti azione principali sono posizionati nell'angolo alto destra dell'header
3. **Card Layout**: Contenuti organizzati in Card con `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`
4. **Tab Navigation**: Uso estensivo di `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent` per navigazione interna
5. **Dialog Modali**: Azioni di creazione/modifica usano `Dialog` con form completi
6. **Gradient Buttons**: Pulsanti primari usano `bg-gradient-to-r from-[color]-500 to-[color]-500`

### Componenti Condivisi
- `Sidebar` - Navigazione principale
- `Navbar` - Header mobile con hamburger menu
- `ConsultantAIAssistant` - Componente AI assistant flottante
- `NavigationTabs` - Tabs di navigazione personalizzati
- `WhatsAppLayout` - Layout specifico per pagine WhatsApp

### Sidebar Categories
```javascript
const consultantCategories = [
  { name: "PRINCIPALE", defaultExpanded: true, alwaysVisible: true },
  { name: "LAVORO QUOTIDIANO", defaultExpanded: true },
  { name: "COMUNICAZIONE", defaultExpanded: true },
  { name: "CONTENT STUDIO", defaultExpanded: false },
  { name: "FORMAZIONE", defaultExpanded: false },
  { name: "BASE DI CONOSCENZA", defaultExpanded: false },
  { name: "IMPOSTAZIONI", defaultExpanded: false },
  { name: "GUIDE", defaultExpanded: false },
  { name: "AI AVANZATO", defaultExpanded: false }
];
```

---

## DISCREPANZE TROVATE

### 1. Pagina "I tuoi dipendenti" (`/consultant/whatsapp`)
| Elemento | Guida Dice | Realtà |
|----------|------------|--------|
| **Pulsante conversazioni** | "Tab Link Pubblici" | Si chiama **"Chat Agenti"** |
| **Posizione** | Non specificata | **Alto a DESTRA** nel header verde |

### 2. Sezioni MANCANTI in `consultant-guides.ts`
- ❌ `clientDataAnalysis` (Analisi Dati)
- ❌ `paymentAutomations` (Automazioni Pagamento)

### 3. Sezioni MANCANTI in `MANUALE-COMPLETO.md`
- ❌ CONTENT STUDIO (7 voci)
- ❌ Analisi Dati
- ❌ Automazioni Pagamento
- ❌ Lead Nurturing 365
- ❌ Email Hub nella sidebar
