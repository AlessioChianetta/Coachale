# Overview
This full-stack web application is a comprehensive consultation platform connecting consultants and clients, primarily leveraging an AI assistant for personalized financial insights. Its purpose is to enhance interactions, streamline financial guidance, and improve client outcomes and consultant efficiency. The platform includes a multi-tier subscription system for AI agents with revenue sharing, an employee licensing system, and a public landing page for lead generation, aiming to be a holistic solution for modern financial consultation.

# User Preferences
Preferred communication style: Simple, everyday language.
User requested "obsessive-compulsive" attention to detail when verifying what works and what doesn't.
User prefers direct SQL for any database modifications (not ORM migrations).

# System Architecture
The application features a modern UI/UX built with React 18, TypeScript, Vite, Tailwind CSS, and `shadcn/ui`, prioritizing accessibility and responsiveness. The backend uses Express.js, TypeScript, JWT, bcrypt, and PostgreSQL (Drizzle ORM), implementing robust role-based access control (consultant, client, super_admin) and a multi-profile system.

**Key Features and Design Patterns:**

*   **AI Integration:** Provides personalized financial insights, multi-tenant semantic search, consultation summarization, and AI-powered integrations (WhatsApp Business, Instagram, X DMs). Includes configurable AI sales agents, automated follow-up and client check-ins, and tools for generating courses and exercises. A ChatGPT-style AI Assistant offers dynamic model selection, reasoning visualization, conversation memory, and a hybrid AI context system with token optimization and RAG. A Consultation Function Calling System with an LLM Intent Classifier ensures intelligent tool usage and guardrails. Knowledge Base enhancement allows custom instructions in AI system prompts.
*   **Subscription & Licensing:** A multi-tier subscription system manages AI agent access, consultant licenses, revenue sharing, and AI credits with Stripe integration.
*   **Content & Marketing Studio:** Features AI tools for content idea generation, social media copy, a 6-step campaign builder, AI image generation, and a Lead Nurturing 365 System with automated AI-generated email sequences. The Email Hub supports IMAP/SMTP, unified inboxes, and AI-powered response generation. A Content Autopilot System automates content scheduling.
*   **Data Analysis:** A "compute-first" system processes structured data, separating deterministic calculation (SQL) from AI interpretation. Includes efficient Excel parsing, dynamic tables with Row Level Security (RLS), Server-Sent Events (SSE), and an enterprise-grade Semantic Layer. A Multi-CSV Join System supports uploading multiple CSV files with automatic relationship detection.
*   **Consultant Workflow:** A 4-phase, 23-step Consultant Setup Wizard guides configuration, alongside configurable monthly consultation limits.
*   **Communication & Automation:**
    *   **Voice Telephony (Alessia AI Phone):** Integrates FreeSWITCH with Gemini 2.5 Flash Native Audio for real-time voice AI, automatic caller recognition, call management, and recording.
    *   **Direction-Based Voice Template System:** Provides configurable templates for inbound and outbound calls.
    *   **AI Task Scheduling:** Automated system for AI-powered voice calls with a database-backed task queue, retry logic, and recurrence options.
    *   **AI Autonomous Employee (Multi-Role):** A Decision Engine uses Gemini to analyze client context and generate multi-step execution plans. A Task Executor runs steps with logging. Guardrails enforce working hours and channel restrictions. Eight specialized AI agents with dedicated data queries, Gemini prompts, and task categories. Supports per-role client filtering, dual reasoning modes ("Strutturato" and "Deep Think"), and post-generation anti-duplication of tasks using Jaccard keyword similarity. Includes bulk task actions and a reasoning dashboard.
    *   **Assisted Mode (Modalità Assistita):** Allows AI tasks to pause for consultant feedback and context injection.
    *   **Intelligent Document Generation:** Generates dual output (summary and formal document) with dynamic classification (contract, market_research, guide, etc.) and adaptive PDF layouts.
    *   **Voice Supervisors (LLM Architecture):** Real-time transcript analysis for task management and booking.
    *   **Orbitale Tools Integration:** Integrates external Orbitale tools via iframe.
*   **Bidirectional Telegram Bot Integration:** Each AI employee can have its own Telegram bot, supporting 1:1 private and group chats with bidirectional message syncing. Includes an "Open Mode" for AI-driven conversational onboarding and structured profile extraction, with privacy isolation.
*   **Global Consultation Store (Marco):** Aggregates client consultation notes and email journey documents into a single consultant-specific store, optimized for AI access with anti-hallucination titles.
*   **Operational Data File Search Optimization:** Reduces AI chat system prompt token count when File Search is active by syncing operational data (clients, templates, configs) as `sourceType: "operational_context"`.
*   **Consultant Detailed Profile:** Stores comprehensive consultant information across 8 sections, including personal info, identity, business details, services, target audience, approach, values, and AI context, all integrated into the AI's understanding.
*   **System Robustness:** Includes a 4-week calendar, universal PDF support, real-time Google Drive sync, a Dataset Sync API, a Data Sync Observability Dashboard, an Intent Follow-Through System, a Partner Webhook Notification System, and a Database-Based Cron Mutex. An Anti-Zombie Connection System prevents stale Gemini WebSocket connections.
*   **Mobile & Dark Mode Design System:** Employs a Revolut-style design system with reusable CSS utilities and shared components, ensuring responsive and accessible UI with proper dark mode support using CSS variables.

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