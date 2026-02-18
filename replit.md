# Overview
This full-stack web application is a comprehensive consultation platform connecting consultants and clients. Its primary purpose is to leverage an AI assistant for personalized financial insights, enhancing interactions, streamlining financial guidance, and improving client outcomes and consultant efficiency. The platform includes a multi-tier subscription system for AI agents with revenue sharing, an employee licensing system, and a public landing page for lead generation, aiming to be a holistic solution for modern financial consultation.

# User Preferences
Preferred communication style: Simple, everyday language.
User requested "obsessive-compulsive" attention to detail when verifying what works and what doesn't.

# System Architecture
The application features a modern UI/UX built with React 18, TypeScript, Vite, Tailwind CSS, and `shadcn/ui`, prioritizing accessibility and responsiveness. The backend uses Express.js, TypeScript, JWT, bcrypt, and PostgreSQL (Drizzle ORM), implementing a robust role-based access control (consultant, client, super_admin) and multi-profile system.

**Key Features and Design Patterns:**

*   **AI Integration:** Deeply integrated AI provides personalized financial insights, a multi-tenant semantic search knowledge base, consultation summarization, and AI-powered integrations with WhatsApp Business, Instagram, and X (Twitter) DMs. It includes configurable AI sales agents, an AI-driven follow-up system, automated weekly client check-ins, and AI tools for generating courses and exercises. A ChatGPT-style AI Assistant offers dynamic model selection, reasoning visualization, conversation memory, and a hybrid AI context system with token optimization and RAG. A Consultation Function Calling System with an LLM Intent Classifier ensures intelligent tool usage and guardrails. Knowledge Base enhancement allows consultants to inject custom instructions directly into AI system prompts with per-target toggles and specific WhatsApp agent targeting.
*   **Subscription & Licensing:** A multi-tier subscription system manages AI agent access, consultant licenses, revenue sharing, and AI credits, with Stripe integration for payments.
*   **Content & Marketing Studio:** Features AI tools for content idea generation, social media copy, a 6-step campaign builder, AI image generation, and a Lead Nurturing 365 System with automated AI-generated email sequences. The Email Hub supports IMAP/SMTP, unified inboxes, and AI-powered response generation. A Content Autopilot System automates content scheduling.
*   **Data Analysis:** A "compute-first" system processes structured data (Excel/CSV), separating deterministic calculation (SQL) from AI interpretation. It includes efficient Excel parsing, dynamic tables with Row Level Security (RLS), Server-Sent Events (SSE), and an enterprise-grade Semantic Layer with 28 logical roles to prevent AI hallucinations. A Multi-CSV Join System supports uploading 2-10 CSV files simultaneously with automatic relationship detection and creates unified datasets via LEFT JOIN with staging tables.
*   **Consultant Workflow:** A 4-phase, 23-step Consultant Setup Wizard guides configuration, alongside configurable monthly consultation limits.
*   **Communication & Automation:**
    *   **Voice Telephony (Alessia AI Phone):** Integrates FreeSWITCH with Gemini 2.5 Flash Native Audio for real-time voice AI, automatic caller recognition, call management, and recording. Supports both Google AI Studio and Vertex AI.
    *   **Direction-Based Voice Template System:** Provides configurable templates for inbound and outbound calls with a template library and variable interpolation.
    *   **AI Task Scheduling:** An automated system for AI-powered voice calls with a database-backed task queue, retry logic, recurrence options, and a comprehensive REST API and frontend UI.
    *   **AI Autonomous Employee (Multi-Role):** A Decision Engine uses Gemini to analyze client context and generate multi-step execution plans. A Task Executor runs steps with per-step logging. Guardrails enforce working hours, daily limits, and channel restrictions. Eight specialized AI agents (Alessia, Millie, Echo, Nova, Stella, Iris, Marco, Personalizza) each with dedicated data queries, Gemini prompts, and task categories.
    *   **Assisted Mode (Modalità Assistita):** Tasks can run in `autonomous` (fully automatic) or `assisted` mode. In assisted mode, AI pauses after each step, sets status to `waiting_input`, and waits for consultant feedback before resuming. The consultant can review partial results and inject context that guides subsequent steps. Backend uses `execution_mode` + `interaction_history` columns on `ai_scheduled_tasks`, with a `/tasks/:id/resume` endpoint. Frontend provides a toggle during creation and an input area when paused.
    *   **Intelligent Document Generation:** The `generate_report` step now classifies document type (contract, market_research, guide, strategic_report, dossier, brief, analysis) and produces dual output: `summary` for dashboard display and `formal_document` with structured header/body/footer for professional PDF generation. The frontend `generateTaskPDF` function applies adaptive layouts per type (legal articles + signatures for contracts, numbered steps for guides, executive summaries for reports, etc.) with proper margins, dark blue banner headers, page-numbered footers, and backward compatibility for legacy tasks.
    *   **Voice Supervisors (LLM Architecture):** Real-time transcript analysis systems detect and manage reminders/tasks and trigger bookings based on conversational intent, ensuring data completeness and conflict detection.
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