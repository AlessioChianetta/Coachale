# Overview
This full-stack web application is a comprehensive consultation platform designed to connect consultants and clients. It provides tools for exercise assignments, progress tracking, performance analytics, and leverages an AI assistant for personalized financial insights. The platform aims to enhance consultant-client interactions, streamline financial guidance, and improve client outcomes and consultant efficiency. Key features include a multi-tier subscription system for AI agents with revenue sharing, an employee licensing system, and a public landing page for lead generation, all geared towards market growth and empowering consultants.

# User Preferences
Preferred communication style: Simple, everyday language.
User requested "obsessive-compulsive" attention to detail when verifying what works and what doesn't.

# System Architecture
The application is built with a modern tech stack: React 18, TypeScript, Vite, and Tailwind CSS for the frontend, and Express.js, TypeScript, JWT, bcrypt, and PostgreSQL (Drizzle ORM) for the backend. Data management relies on PostgreSQL (Supabase) with Drizzle ORM. Authentication uses JWT and bcrypt, implementing a role-based access control system (consultant, client, super_admin) and a multi-profile system.

The UI/UX, built with `shadcn/ui` and `Tailwind CSS`, prioritizes modernity, accessibility, and responsiveness, featuring interactive guided tours and content-focused layouts. Client management is presented via an enterprise table layout with sorting, pagination, bulk selection, and inline actions.

AI is deeply integrated, offering:
- Personalized financial insights and a multi-tenant semantic search AI knowledge base.
- Consultation summarization for generating summary emails and tasks from transcripts.
- AI-powered integration with WhatsApp Business, Instagram Direct Messaging, and X (Twitter) DMs.
- Configurable AI sales agents and a fully AI-driven follow-up system.
- Automated weekly client check-ins via WhatsApp with AI-personalized messages.
- AI tools for generating courses, pathways, and multi-language exercises.
- A ChatGPT-style AI Assistant with dynamic model selection, reasoning visualization, conversation memory, and a hybrid AI context system, with token optimization through intent detection, conditional queries, caching, and RAG.
- Consultation Function Calling System with LLM Intent Classifier (Gemini 2.5 Flash Lite), AUTO tool mode for intelligent tool usage, comprehensive guardrails (parameter validation with error_code/suggestion responses), and semantic tool output (next_action_hint, unit fields). Features 3-tier confidence gating (high≥80% auto, medium 50-79% clarify, low<50% ignore), memory safety with context validation (pendingBookingToken checks), trace ID logging for debugging, and robust JSON parsing with `<json>` tag delimiters.

A multi-tier subscription system manages AI agent subscriptions, consultant licenses, revenue sharing, and AI credits, integrating Stripe for payments.

The platform includes a Content Marketing Studio with AI tools for idea generation, social media copy, a 6-step campaign builder, AI image generation, and content organization, all while maintaining brand voice and knowledge base context. A Lead Nurturing 365 System provides an automated 365-day email sequence using AI-generated content and dynamic templates, managed by a cron scheduler. The Email Hub supports IMAP/SMTP, unified inboxes, AI-powered response generation, and knowledge base integration.

A "compute-first" data analysis system processes structured data (Excel/CSV), separating deterministic calculation (SQL) from AI interpretation. It features efficient Excel parsing, fast imports, dynamic tables with Row Level Security (RLS), Server-Sent Events (SSE) for progress updates, AI-fallback column discovery, and anti-stampede caching. The Data Analysis Chat UI reuses AI Assistant components.

An enterprise-grade Semantic Layer is implemented to prevent AI hallucinations using predefined metrics, semantic mapping, and a robust pre-validation architecture. This includes an Intent Router Architecture (Intent Router, Policy Engine, Execution Agent) and a Pre-Validation Layer (Cardinality Probe, Semantic Contract, Filter Enforcement, Result Size Guardrail). This Universal Semantic Layer supports any CSV/Excel dataset with 19 logical roles, an alias system, flexible auto-detect patterns, pre-validation, and 7 query engine rules.

A Consultant Setup Wizard guides consultants through 4 phases and 23 steps for platform configuration. Monthly consultation limits per client can be configured and managed, with AI Assistant integration providing limit-aware responses.

Key enhancements include:
- A 4-week calendar system for weekly check-ins with deterministic time generation and template rotation.
- Universal PDF support and real-time Google Drive synchronization with cost-optimized debouncing for the Knowledge Base.
- A Dataset Sync API for external partners supporting 19 semantic logical roles, HMAC-SHA256 security, and webhook endpoints.
- A Data Sync Observability Dashboard for monitoring external data sources.
- Enhanced AI Context for Data Analysis, dynamically loading metrics and semantic column mappings.
- Intent Follow-Through System for executing AI-proposed analyses from user confirmations.
- Partner Webhook Notification System for Stripe license purchases.
- Database-Based Cron Mutex to prevent duplicate cron job executions.
- X (Twitter) DM Integration for automated messaging and AI-powered responses.
- Content Studio Platform-Specific Schema Selection with 40+ templates, character limit enforcement, AI shortening, and 5 selectable writing styles.
- Content Autopilot System for automated content scheduling with platform-specific frequency, content theme rotation, and full AdVisage AI integration for image generation and publishing.
- AdVisage AI Visual Concept Generator integrated into Content Studio for generating visual concepts, image prompts, and social captions from ad copy.
- Content Variety System to prevent repetitive AI-generated ads:
  - Hook max 125 characters (Meta Ads visibility constraint)
  - 10 hook pattern rotation (domanda, statistica, storia, controintuitivo, problema, curiosità, social proof, us-vs-them, urgenza, provocazione)
  - 4-dimension angle rotation (paura/desiderio, logico/emotivo, 1a/3a persona, diretto/storytelling)
  - 100+ dynamic section instruction variants (3-5 per section) covering all 48 schemas:
    - ADS (24): pain, benefit, obiezione, confutazione, offerta, urgenza, promessa, prova, dimostrazione, nuovoModo, provaSociale, prima, dopo, ponte, vincolo
    - VALORE (20+): mito, percheFalso, regolaVera, cosaAnalizziamo, coseFatteBene, daMigliorare, template, checklist, step1-5, casoReale, lezione, principio
    - FORMAZIONE (34): obiettivo, concettoChiave, esempio, comeApplicarlo, erroreComune, modulo, cosaImparerai, materiali, istruzioni, domanda, risposte, spiegazione, takeaway
    - STORYTELLING (13): situazione, tensione, decisione, risultato, ostacolo, puntoPartenza, azioni, cosaOdiavo, cosaCambiato, comeFarlo, chiSono, miniStoria
    - ENGAGEMENT (11): hotTake, opinione, claim, motivo, perche, domandaFinale, recap, ctaSoft, prossimaMossa, cosaStaiFacendo
  - getRandomSectionGuideline function with camelCase/snake_case normalization and fallback to static guidelines
  - Enhanced anti-repetition with pattern detection, fingerprint analysis, and recommendations
  - Content Topics system with pillar organization and usage tracking
  - AI compression for content exceeding platform limits (90% target, 0.3 temperature for consistency)

# External Dependencies
- **Supabase**: PostgreSQL hosting.
- **Recharts**: Data visualization.
- **Date-fns**: Date manipulation.
- **Radix UI**: Accessible UI primitives.
- **Google Fonts**: Inter, Poppins, DM Sans, Fira Code.
- **Lucide React**: Iconography.
- **Google Gemini API**: Powers AI features.
- **Percorso Capitale API**: Financial management system.
- **Fathom**: Consultation recording and transcription.
- **Driver.js**: Interactive guided tours.
- **Twilio API**: WhatsApp Business messaging.
- **X (Twitter) API v2**: Direct message automation and Account Activity webhooks.