# Overview
This full-stack web application is a comprehensive consultation platform connecting consultants and clients. Its primary purpose is to leverage an AI assistant for personalized financial insights, enhancing interactions, streamlining financial guidance, and improving client outcomes and consultant efficiency. The platform includes a multi-tier subscription system for AI agents with revenue sharing, an employee licensing system, and a public landing page for lead generation, aiming to be a holistic solution for modern financial consultation.

# User Preferences
Preferred communication style: Simple, everyday language.
User requested "obsessive-compulsive" attention to detail when verifying what works and what doesn't.
User prefers direct SQL for any database modifications (not ORM migrations).

# System Architecture
The application features a modern UI/UX built with React 18, TypeScript, Vite, Tailwind CSS, and `shadcn/ui`, prioritizing accessibility and responsiveness. The backend uses Express.js, TypeScript, JWT, bcrypt, and PostgreSQL (Drizzle ORM), implementing a robust role-based access control (consultant, client, super_admin) and multi-profile system.

**Key Features and Design Patterns:**

*   **AI Integration:** Deeply integrated AI provides personalized financial insights, a multi-tenant semantic search knowledge base, consultation summarization, and AI-powered integrations with WhatsApp Business, Instagram, and X (Twitter) DMs. It includes configurable AI sales agents, an AI-driven follow-up system, automated weekly client check-ins, and AI tools for generating courses and exercises. A ChatGPT-style AI Assistant offers dynamic model selection, reasoning visualization, conversation memory, and a hybrid AI context system with token optimization and RAG. A Consultation Function Calling System with an LLM Intent Classifier ensures intelligent tool usage and guardrails. Knowledge Base enhancement allows consultants to inject custom instructions directly into AI system prompts with per-target toggles and specific WhatsApp agent targeting.
*   **Subscription & Licensing:** A multi-tier subscription system manages AI agent access, consultant licenses, revenue sharing, and AI credits, with Stripe integration for payments.
*   **Content & Marketing Studio:** Features AI tools for content idea generation, social media copy, a 6-step campaign builder, AI image generation, and a Lead Nurturing 365 System with automated AI-generated email sequences. The Email Hub supports IMAP/SMTP, unified inboxes, and AI-powered response generation. A Content Autopilot System automates content scheduling.
*   **Data Analysis:** A "compute-first" system processes structured data (Excel/CSV), separating deterministic calculation (SQL) from AI interpretation. It includes efficient Excel parsing, dynamic tables with Row Level Security (RLS), Server-Sent Events (SSE), and an enterprise-grade Semantic Layer with 28 logical roles to prevent AI hallucinations. A Multi-CSV Join System supports uploading 2-10 CSV files simultaneously with automatic relationship detection and creates unified datasets via LEFT JOIN with staging tables.
*   **Consultant Workflow:** A 4-phase, 23-step Consultant Setup Wizard guides configuration, alongside configurable monthly consultation limits.
*   **Communication & Automation:**
    *   **Voice Telephony (Alessia AI Phone):** Integrates FreeSWITCH with Gemini 2.5 Flash Native Audio for real-time voice AI, automatic caller recognition, call management, and recording. Supports both Google AI Studio and Vertex AI. Multi-tenant architecture: VPS bridge URL and service token are centralized in `superadmin_voice_config` table (platform-level), so all consultants share the same VPS infrastructure without individual configuration. Inbound routing uses `voice_numbers` table (calledNumber → consultant lookup). Auth accepts both per-consultant JWT tokens and global superadmin token for cross-consultant routing.
    *   **Direction-Based Voice Template System:** Provides configurable templates for inbound and outbound calls with a template library and variable interpolation.
    *   **AI Task Scheduling:** An automated system for AI-powered voice calls with a database-backed task queue, retry logic, recurrence options, and a comprehensive REST API and frontend UI.
    *   **AI Autonomous Employee (Multi-Role):** A Decision Engine uses Gemini to analyze client context and generate multi-step execution plans. A Task Executor runs steps with per-step logging. Guardrails enforce working hours, daily limits, and channel restrictions. Eight specialized AI agents (Alessia, Millie, Echo, Nova, Stella, Iris, Marco, Personalizza) each with dedicated data queries, Gemini prompts, and task categories. **Per-Role Client Filtering:** Each agent only sees clients as "occupied" if they have pending/completed tasks from the same role, not globally across all agents. **Dual Reasoning Modes:** "Strutturato" mode adds mandatory reasoning sections (observation, reflection, decision, self_review) to the AI prompt output format. "Deep Think" mode uses a multi-step agentic loop (4 Gemini calls: data analysis → priority assessment → task generation → self-review). Reasoning mode selectable globally or per-agent via `reasoning_mode`/`role_reasoning_modes` in `ai_autonomy_settings`. All reasoning data stored in `ai_reasoning_logs` table with full transparency. **Post-Generation Anti-Duplication:** After AI generates tasks, each is compared against existing active tasks for the same role using Jaccard keyword similarity (Italian stop words, threshold 0.35 for same-client, 0.55 for different). **Bulk Task Actions:** Checkbox selection with floating action bar for bulk approve/reject/delete of AI tasks. **Reasoning Dashboard:** Visual timeline at `/consultant/ai-reasoning` and in the ActivityTab showing structured reasoning sections with colored cards per section type and clear action type badges (follow-up, primo contatto, promemoria, etc.).
    *   **Assisted Mode (Modalità Assistita):** Tasks can run in `autonomous` (fully automatic) or `assisted` mode. In assisted mode, AI pauses after each step, sets status to `waiting_input`, and waits for consultant feedback before resuming. The consultant can review partial results and inject context that guides subsequent steps. Backend uses `execution_mode` + `interaction_history` columns on `ai_scheduled_tasks`, with a `/tasks/:id/resume` endpoint. Frontend provides a toggle during creation and an input area when paused.
    *   **Intelligent Document Generation:** The `generate_report` step now classifies document type (contract, market_research, guide, strategic_report, dossier, brief, analysis) and produces dual output: `summary` for dashboard display and `formal_document` with structured header/body/footer for professional PDF generation. The frontend `generateTaskPDF` function applies adaptive layouts per type (legal articles + signatures for contracts, numbered steps for guides, executive summaries for reports, etc.) with proper margins, dark blue banner headers, page-numbered footers, and backward compatibility for legacy tasks.
    *   **Voice Supervisors (LLM Architecture):** Real-time transcript analysis systems detect and manage reminders/tasks and trigger bookings based on conversational intent, ensuring data completeness and conflict detection.
    *   **Orbitale Tools Integration:** Sidebar "STRUMENTI" section embeds 4 external Orbitale tools via iframe (Finanza, CRM, Contract, Locale) at `/consultant/tools/:toolId`, plus NotebookLM as external link. Component: `consultant-orbitale-tool.tsx`.
*   **Bidirectional Telegram Bot Integration:** Each AI employee can have its own Telegram bot. Supports 1:1 private chats (auto-linking on first message) and group chats (@mention detection). Messages sync bidirectionally with the platform's `agent_chat_messages` table. Backend: `server/telegram/telegram-service.ts` (API calls, webhook processing), `server/telegram/telegram-webhook-handler.ts` (Express handler with secret token verification). Database: `telegram_bot_configs` (per-consultant per-role bot tokens, webhook secrets, `open_mode` toggle), `telegram_chat_links` (active chat mappings), `telegram_user_profiles` (onboarding state and user/group context). Frontend: `TelegramConfig.tsx` component in AI employee settings panel. API: CRUD at `/api/ai-autonomy/telegram-config/:roleId`, public webhook at `/api/telegram/webhook/:configId`. Uses `processAgentChatInternal()` exported from `ai-autonomy-router.ts` to share AI response logic with web chat. **Open Mode (Modalità Aperta):** When enabled, anyone can message the bot without activation code. New private users go through AI-driven conversational onboarding where the AI employee conducts a free-form dialogue, decides questions dynamically based on responses, and signals completion with `[ONBOARDING_COMPLETE]` tag. `ROLE_ONBOARDING_PROMPTS` config maps each AI role to personality-specific onboarding system prompts (Marco = provocative coach, Stella = empathetic, Iris = analytical). On completion, two parallel AI calls extract structured JSON profile (`full_profile_json`) and a text summary (`onboarding_summary`). Full conversation history stored in `onboarding_conversation` (JSONB). `getProfileContext()` priority cascade: onboarding_summary → full_profile_json → legacy fields (backward compatible). Safety limit: MAX_ONBOARDING_STEPS = 15 forces completion. Groups have separate onboarding prompts focused on context, members, and objectives. Complete privacy isolation ensures open mode users cannot access consultant data. The gatekeeper flow remains active when open_mode is OFF.
*   **Global Consultation Store (Marco):** A consolidated File Search store (`Store Globale Consulenze Clienti`) aggregates all client consultation notes and email journey documents into a single store per consultant. `syncGlobalConsultationStore()` in `file-search-service.ts` queries all active clients' private stores, extracts consultation/email_journey docs, and re-uploads them with structured anti-hallucination titles (`[CLIENTE: Name] - Type - Date`). Marco's chat (`processAgentChatInternal`) prioritizes the global store (1 File Search slot) with automatic fallback to top 5 individual client stores. Anti-hallucination rules in both chat and autonomous prompts ensure correct client attribution. Frontend settings in `consultant-file-search-analytics.tsx` provide sync controls and document listing with emerald theme.
*   **Operational Data File Search Optimization:** When File Search is active, the consultant AI chat system prompt is reduced from ~125K tokens to ~5-6K tokens. 10 operational document generators sync data (clients, client states, WhatsApp/Twilio templates, config, email, campaigns, calendar, exercises, consultations) to File Search as `sourceType: "operational_context"`. The `buildConsultantContext()` function detects `fileSearchActive` and runs lightweight COUNT queries plus targeted data queries (client names, appointments, client states, autonomous tasks, emails, consultant tasks, AI preferences, integrations status, detailed profile). A `buildLightweightConsultantSystemPrompt()` produces a rich dashboard snapshot with all these sections. Settings are managed per-consultant via `fileSearchSettings` table with individual toggle columns (`autoSyncOperational*`) and a master `operationalSyncEnabled` toggle. The cron scheduler (`dynamic-context-scheduler.ts`) passes operational settings to `syncDynamicDocuments()`. Frontend UI in `consultant-file-search-analytics.tsx` provides toggle controls and content display.
*   **Consultant Detailed Profile:** A `consultant_detailed_profiles` table stores ultra-detailed consultant information across 8 sections: personal info, identity (title, bio, certifications, education), business details (name, type, VAT, address, socials), services (offered, specializations, methodology, tools), target audience (ideal client, sectors, age range, geography), approach (consulting style, initial process, session duration, follow-up), values (core values, mission, vision, USP), and AI context (additional context, tone of voice, topics to avoid). The profile settings page (`consultant-profile-settings.tsx`) uses a tabbed interface. All data is passed to the AI via the lightweight context system.
*   **System Robustness:** Features include a 4-week calendar system for check-ins, universal PDF support, real-time Google Drive sync, a Dataset Sync API, a Data Sync Observability Dashboard, an Intent Follow-Through System, a Partner Webhook Notification System, and a Database-Based Cron Mutex. An Anti-Zombie Connection System prevents stale Gemini WebSocket connections.

# External Dependencies
*   **Supabase**: PostgreSQL hosting.
*   **Recharts**: Data visualization.
*   **Date-fns**: Date manipulation.
*   **Radix UI**: Accessible UI primitives.
*   **Google Fonts**: Inter, Poppins, DM Sans, Fira Code.
*   **Lucide React**: Iconography.

# Mobile & Dark Mode Design System (Revolut-style)

Standard riutilizzabile applicato a tutte le pagine. **Regola fondamentale: MAI `bg-white`/`bg-gray-X` senza `dark:` counterpart — SEMPRE CSS vars (`bg-background`, `bg-card`, `text-foreground`, `border-border`).**

## CSS Utilities (`client/src/index.css` — `@layer components`)
- `.page-container` — padding standard pagina (px-5 sm:px-6 lg:px-8, py-6 sm:py-8, space-y-6 sm:space-y-8)
- `.flat-card` — card base (bg-background, border-border/60, rounded-2xl, shadow-sm)
- `.flat-card-muted` — variante muted (bg-muted/40, border-border/40)
- `.touch-item` — list/nav item touch target (min-h-[44px], flex items-center, gap-3)
- `.section-label` — etichetta sezione (11px, uppercase, tracking-widest, text-muted-foreground)
- `.pb-safe` — safe area iOS bottom (max(1.5rem, env(safe-area-inset-bottom)))
- `.no-scrollbar` — scroll senza barra visibile

## Componenti Condivisi
- `client/src/components/layout/PageLayout.tsx` — wrapper universale (gestisce Navbar + Sidebar + sidebarOpen internamente). Props: `role`, `children`, `className`, `noPadding`
- `client/src/components/ui/kpi-card.tsx` — card metrica (KPICard). Props: `title`, `value`, `icon`, `iconColor`, `iconBg`, `delta`, `deltaPositive`, `onClick`, `pulse`
- `client/src/components/ui/section-header.tsx` — header sezione (SectionHeader). Props: `icon`, `iconColor`, `iconBg`, `title`, `badge`, `action`

## Pagine Aggiornate
- **Navbar** (`client/src/components/navbar.tsx`): h-14, brand logo centrato, avatar utente, CSS vars
- **Sidebar** (`client/src/components/sidebar.tsx`): Sheet w-[85vw] max-w-[320px], touch targets 44px, CSS vars
- **Consultant Dashboard** (`client/src/pages/consultant-dashboard.tsx`): usa PageLayout + KPICard + SectionHeader
- **Client Dashboard** (`client/src/pages/client-dashboard.tsx`): usa PageLayout, rimosso boilerplate sidebar/mobile
*   **Google Gemini API**: Powers AI features.
*   **Percorso Capitale API**: Financial management system.
*   **Fathom**: Consultation recording and transcription.
*   **Driver.js**: Interactive guided tours.
*   **Twilio API**: WhatsApp Business messaging.
*   **X (Twitter) API v2**: Direct message automation and Account Activity webhooks.
*   **Stripe**: Payment processing for subscriptions and licenses.
*   **FreeSWITCH**: Voice telephony integration.
*   **Google Calendar API**: Appointment scheduling.
*   **Publer**: Social media scheduling and publishing.

## Configurazione Multi-Ambiente (Replit + VPS)

Il progetto gira su due ambienti simultaneamente: **Replit (dev)** e **VPS Hostinger (produzione)**.

### Variabili d'ambiente per i Webhook Telegram

| Variabile | Replit | VPS Hostinger |
|---|---|---|
| `TELEGRAM_WEBHOOK_DOMAIN` | NON impostare (lascia vuota) | `tuodominio.com` |
| `REPLIT_DOMAINS` | Auto-set da Replit | Non disponibile |
| `SCHEDULERS_ENABLED` | `true` (default) | `false` |

Su **Replit**: `REPLIT_DOMAINS` viene settato automaticamente dalla piattaforma con il dominio corrente.  
Su **VPS**: aggiungere nel `.env` → `TELEGRAM_WEBHOOK_DOMAIN=tuodominio.com`

### Auto-refresh Webhook all'avvio

All'avvio del server (con 5s di delay), `refreshTelegramWebhooksOnStartup()` in `server/telegram/telegram-service.ts` ri-registra automaticamente tutti i bot Telegram con l'URL del dominio corrente. Questo elimina la necessità di aggiornamento manuale quando si cambia ambiente.