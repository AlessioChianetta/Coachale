# Overview
This full-stack web application is a comprehensive consultation platform connecting consultants and clients, primarily leveraging an AI assistant for personalized financial insights. Its purpose is to enhance interactions, streamline financial guidance, and improve client outcomes and consultant efficiency. The platform includes a multi-tier subscription system for AI agents with revenue sharing, an employee licensing system, and a public landing page for lead generation, aiming to be a holistic solution for modern financial consultation.

# User Preferences
Preferred communication style: Simple, everyday language.
User requested "obsessive-compulsive" attention to detail when verifying what works and what doesn't.
User prefers direct SQL for any database modifications (not ORM migrations).

# System Architecture
The application features a modern UI/UX built with React 18, TypeScript, Vite, Tailwind CSS, and `shadcn/ui`, prioritizing accessibility and responsiveness. The backend uses Express.js, TypeScript, JWT, bcrypt, and PostgreSQL (Drizzle ORM), implementing robust role-based access control (consultant, client, super_admin) and a multi-profile system. The UI/UX employs a Revolut-style design system with reusable CSS utilities and shared components, ensuring responsive and accessible UI with proper dark mode support using CSS variables.

**Key Features and Design Patterns:**

*   **AI Integration:** Provides personalized financial insights, multi-tenant semantic search, consultation summarization, and AI-powered integrations (WhatsApp Business, Instagram, X DMs). Includes configurable AI sales agents, automated follow-up and client check-ins, and tools for generating courses and exercises. A ChatGPT-style AI Assistant offers dynamic model selection, reasoning visualization, conversation memory, and a hybrid AI context system with token optimization and RAG. A Consultation Function Calling System with an LLM Intent Classifier ensures intelligent tool usage and guardrails. Knowledge Base enhancement allows custom instructions in AI system prompts.
*   **Subscription & Licensing:** A multi-tier subscription system manages AI agent access, consultant licenses, revenue sharing, and AI credits with Stripe integration.
*   **Content & Marketing Studio:** Features AI tools for content idea generation, social media copy, a 6-step campaign builder, AI image generation, and a Lead Nurturing 365 System with automated AI-generated email sequences. The Email Hub supports IMAP/SMTP, unified inboxes, and AI-powered response generation. A Content Autopilot System automates content scheduling.
*   **Data Analysis:** A "compute-first" system processes structured data, separating deterministic calculation (SQL) from AI interpretation. Includes efficient Excel parsing, dynamic tables with Row Level Security (RLS), Server-Sent Events (SSE), and an enterprise-grade Semantic Layer. A Multi-CSV Join System supports uploading multiple CSV files with automatic relationship detection.
*   **Consultant Workflow:** A 4-phase, 27-step Consultant Setup Wizard guides configuration, alongside configurable monthly consultation limits. An integrated **Accademia di Formazione** LMS at `/consultant/academy` provides dynamically managed lessons organized in modules with progress tracking. A **Client Library** (`/client/library`) uses an Academy-style layout for document and exercise presentation.
*   **Communication & Automation:**
    *   **Voice Telephony (Alessia AI Phone):** Integrates FreeSWITCH with Gemini 2.5 Flash Native Audio for real-time voice AI, automatic caller recognition, call management, and recording. Includes a Direction-Based Voice Template System and AI Task Scheduling for automated calls.
    *   **AI Autonomous Employee (Multi-Role):** A Decision Engine uses Gemini to analyze client context and generate multi-step execution plans with granular real-time activity logging. Guardrails enforce working hours and channel restrictions. Nine specialized AI agents exist, supporting per-role client filtering, dual reasoning modes, post-generation anti-duplication of tasks, configurable AI model selection (Gemini 3 Flash / 3.1 Pro) with thinking levels, and per-role temperature control.
    *   **Hunter Outreach System (Batch Campaigns):** Autonomous lead prospecting pipeline using SerpApi for Google Maps/Search and Firecrawl for enrichment. Hunter groups qualified leads by channel and creates batch tasks, with automated follow-up for failed leads. The UI provides a campaign checklist with progress bars and detailed lead status.
    *   **Assisted Mode (Modalità Assistita):** Allows AI tasks to pause for consultant feedback and context injection.
    *   **Intelligent Document Generation:** Generates dual output (summary and formal document) with dynamic classification and adaptive PDF layouts.
    *   **Voice Supervisors (LLM Architecture):** Real-time transcript analysis for task management and booking.
*   **AI Autonomy UI Structure:** The Dipendenti AI page (`/consultant/ai-autonomy`) uses a unified single tab bar with 8 tabs. It features Kanban UX with scroll-snap columns, drag-to-scroll, prominent status badges, and conversational activity logs where AI employees "talk" to the consultant.
*   **Bidirectional Telegram Bot Integration:** Each AI employee can have its own Telegram bot, supporting 1:1 private and group chats with bidirectional message syncing and an "Open Mode" for AI-driven conversational onboarding.
*   **Global Consultation Store (Marco + Alessia):** Aggregates client consultation notes and email journey documents into a single consultant-specific store, optimized for AI access. Alessia also loads the Global Store, recent WhatsApp conversations, and AI-assistant chat history.
*   **Voice Latency Optimization System:** Implements in-memory caching for voice-critical data, scheduled call query deduplication, single `voiceThinkingBudget` application, first-message barge-in protection, deferred prompt injection, and configurable VAD (Voice Activity Detection). Includes smart DB warmup and WS warmup mode. Alessia Enhanced Intelligence System features persistent client memory, client-specific measurable objectives, automatic post-consultation detection, dynamic call scripts, and an AI-powered feedback loop.
*   **Operational Data File Search Optimization:** Reduces AI chat system prompt token count by syncing operational data as `sourceType: "operational_context"`.
*   **Consultant Detailed Profile:** Stores comprehensive consultant information across 8 sections, integrated into the AI's understanding.
*   **System Robustness:** Includes a 4-week calendar, universal PDF support, real-time Google Drive sync, a Dataset Sync API, a Data Sync Observability Dashboard, an Intent Follow-Through System, a Partner Webhook Notification System, and a Database-Based Cron Mutex. An Anti-Zombie Connection System prevents stale Gemini WebSocket connections.
*   **AI Streaming Architecture:** The system handles streaming responses from Google Gemini API and Vertex AI, mapping SDK chunks to `GeminiStreamChunk` objects and yielding typed SSE events for `code_execution`, `code_execution_result`, `generated_file`, `function_call`, and `thinking`.

*   **Skill Store:** A marketplace for importing and creating AI skills, which are markdown instructions injected into the Gemini AI system prompt. Supports file uploads and code execution.
*   **Lead Scraper:** A dual-engine search via SerpAPI (Google Maps and Google Search) with website enrichment via Firecrawl. Features smart caching, CSV export, CRM lead management with status tracking, notes, and deal values. Includes an AI Sales Agent for generating structured sales reports and AI Keyword Suggestions for search queries. A slide-in chat panel provides conversational interaction.

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
*   **SerpAPI**: Google Maps business data extraction for Lead Scraper.
*   **Firecrawl**: Website scraping for email/contact extraction in Lead Scraper.