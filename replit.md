# Overview
This full-stack web application is a comprehensive consultation platform designed to connect consultants and clients, facilitating exercise assignments, progress tracking, and performance analytics. Its core purpose is to leverage an AI assistant for personalized financial insights, enhancing consultant-client interactions, streamlining financial guidance, and improving overall client outcomes and consultant efficiency. The platform includes a multi-tier subscription system for AI agents with revenue sharing, an employee licensing system, and a public landing page for lead generation, aiming to be a holistic solution for modern financial consultation.

# User Preferences
Preferred communication style: Simple, everyday language.
User requested "obsessive-compulsive" attention to detail when verifying what works and what doesn't.

# System Architecture
The application features a modern UI/UX built with React 18, TypeScript, Vite, Tailwind CSS, and `shadcn/ui`, prioritizing accessibility and responsiveness. The backend is powered by Express.js, TypeScript, JWT, bcrypt, and PostgreSQL (Drizzle ORM), implementing a robust role-based access control (consultant, client, super_admin) and multi-profile system.

**Key Features and Design Patterns:**

*   **AI Integration:** Deeply integrated AI provides personalized financial insights, a multi-tenant semantic search knowledge base, consultation summarization, and AI-powered integrations with WhatsApp Business, Instagram, and X (Twitter) DMs. It includes configurable AI sales agents, a fully AI-driven follow-up system, automated weekly client check-ins, and AI tools for generating courses and exercises. The platform features a ChatGPT-style AI Assistant with dynamic model selection, reasoning visualization, conversation memory, and a hybrid AI context system with token optimization and RAG. A Consultation Function Calling System with an LLM Intent Classifier (Gemini 2.5 Flash Lite) ensures intelligent tool usage, guardrails, and semantic output.
*   **Subscription & Licensing:** A multi-tier subscription system manages AI agent access, consultant licenses, revenue sharing, and AI credits, with Stripe integration for payments.
*   **Content & Marketing Studio:** Features AI tools for content idea generation, social media copy, a 6-step campaign builder, AI image generation, and a Lead Nurturing 365 System with automated AI-generated email sequences. The Email Hub supports IMAP/SMTP, unified inboxes, and AI-powered response generation.
*   **Data Analysis:** A "compute-first" system processes structured data (Excel/CSV), separating deterministic calculation (SQL) from AI interpretation. It includes efficient Excel parsing, dynamic tables with Row Level Security (RLS), Server-Sent Events (SSE), and an enterprise-grade Semantic Layer to prevent AI hallucinations, supporting diverse datasets and query rules.
*   **Consultant Workflow:** A 4-phase, 23-step Consultant Setup Wizard guides configuration, alongside configurable monthly consultation limits.
*   **Communication & Automation:**
    *   **Voice Telephony (Alessia AI Phone):** Integrates FreeSWITCH with Gemini 2.5 Flash Native Audio for real-time voice AI, automatic caller recognition, call management, and recording. Supports both Google AI Studio and Vertex AI with automatic fallback and backend-specific prompt optimization.
    *   **Direction-Based Voice Template System:** Provides separate, configurable templates for inbound and outbound calls with a template library and variable interpolation.
    *   **AI Task Scheduling:** An automated system for AI-powered voice calls with a database-backed task queue, retry logic, recurrence options, and a comprehensive REST API and frontend UI. It includes bidirectional synchronization with `scheduled_voice_calls`.
    *   **AI Autonomous Employee (Phase 2):** A Decision Engine (`autonomous-decision-engine.ts`) uses Gemini to analyze client context and generate multi-step execution plans. A Task Executor (`ai-task-executor.ts`) runs steps (fetch_client_data, analyze_patterns, generate_report, prepare_call, voice_call, send_email, send_whatsapp) with per-step logging. Guardrails enforce working hours, daily limits, channel restrictions. Frontend dashboard shows task progress, stats, and execution plan stepper.
    *   **Voice Supervisors (LLM Architecture):** Real-time transcript analysis systems (Task and Booking Supervisors) using Gemini 2.5 Flash Lite to detect and manage reminders/tasks and trigger bookings based on conversational intent, ensuring data completeness and conflict detection.
*   **System Robustness:** Features include a 4-week calendar system for check-ins, universal PDF support, real-time Google Drive sync, a Dataset Sync API for partners, a Data Sync Observability Dashboard, an Intent Follow-Through System, a Partner Webhook Notification System, and a Database-Based Cron Mutex. An Anti-Zombie Connection System prevents stale Gemini WebSocket connections with `lastActivity` tracking, garbage collection, client heartbeats, and silent session detection.
*   **Content Generation Enhancements:** Includes a Content Studio Platform-Specific Schema Selection with templates, character limits, AI shortening, and writing styles. A Content Autopilot System automates content scheduling with AdVisage AI integration for image generation. AdVisage AI Visual Concept Generator is integrated for generating visual concepts. A Bulk Publish System for Publer enables one-click scheduling. A Content Variety System prevents repetitive AI-generated ads through dynamic pattern and angle rotation, anti-repetition features, and AI compression.

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