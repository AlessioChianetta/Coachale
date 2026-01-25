# Overview
This full-stack web application is a comprehensive consultation platform connecting consultants and clients. It offers exercise assignments, progress tracking, performance analytics, and an AI assistant for personalized financial insights. The platform aims to enhance interactions, streamline financial guidance, and improve client outcomes and consultant efficiency. It includes a multi-tier subscription system for AI agents with revenue sharing, an employee licensing system, and a public landing page for lead generation, targeting market growth and consultant empowerment.

# User Preferences
Preferred communication style: Simple, everyday language.
User requested "obsessive-compulsive" attention to detail when verifying what works and what doesn't.

# System Architecture
The application uses a modern tech stack: React 18, TypeScript, Vite, and Tailwind CSS for the frontend, and Express.js, TypeScript, JWT, bcrypt, and PostgreSQL (Drizzle ORM) for the backend. Data management is handled by PostgreSQL (Supabase) with Drizzle ORM. Authentication utilizes JWT and bcrypt, featuring a role-based access control system (consultant, client, super_admin) and a multi-profile system.

UI/UX design emphasizes modernity, accessibility, and responsiveness using `shadcn/ui` and `Tailwind CSS`, with interactive guided tours and content-focused layouts. Client management is presented in an enterprise table layout with sorting, pagination, bulk selection, and inline actions.

AI is deeply integrated, providing:
- Personalized financial insights and a semantic search AI knowledge base with multi-tenant isolation.
- Consultation summarization, generating summary emails and tasks from transcripts.
- AI-powered WhatsApp Business and Instagram Direct Messaging integration via Twilio and Meta Graph API.
- Configurable AI sales agents and a 100% AI-driven follow-up system.
- Automated weekly client check-ins via WhatsApp with AI-personalized messages.
- AI tools for generating courses, pathways, and multi-language exercises.
- A ChatGPT-style AI Assistant with dynamic model selection, reasoning visualization, and conversation memory, supported by a hybrid AI context system.
- Token optimization through intent detection, conditional queries, caching, and RAG.

A multi-tier subscription system manages AI agent subscriptions, consultant licenses, revenue sharing, and AI credits, integrating Stripe for payments and provisioning.

The platform includes a Content Marketing Studio with AI-powered tools for idea generation, social media copy, a 6-step campaign builder, AI image generation, and content organization, integrating brand voice and knowledge base context.

A Lead Nurturing 365 System provides an automated 365-day email sequence using AI-generated content and dynamic templates, managed by a cron scheduler with GDPR compliance. The Email Hub supports IMAP/SMTP, unified inboxes, AI-powered response generation, and knowledge base integration.

A "compute-first" data analysis system for structured data (Excel/CSV) separates deterministic calculation (SQL) from AI interpretation. It features efficient Excel parsing, fast imports, dynamic tables with RLS, SSE for progress updates, AI-fallback column discovery, and anti-stampede caching. The Data Analysis Chat UI reuses AI Assistant components for conversation persistence and tool call visualization.

An enterprise-grade Semantic Layer aims to prevent AI hallucinations using predefined metrics, semantic mapping, and a robust pre-validation architecture. This includes an Intent Router Architecture with a 3-layer pipeline (Intent Router, Policy Engine, Execution Agent) and a Pre-Validation Layer with Cardinality Probe, Semantic Contract, Filter Enforcement, and Result Size Guardrail. The Universal Semantic Layer supports any CSV/Excel dataset with 19 logical roles, an alias system, flexible auto-detect patterns, pre-validation, and 7 query engine rules for automatic enhancement.

The Consultant Setup Wizard guides consultants through 4 phases and 23 steps to configure the platform, covering basic infrastructure, WhatsApp & Agents, Content, and Advanced settings, with each step tracking its status.

Key enhancements include:
- A pre-planned 4-week calendar system for weekly check-ins with deterministic time generation and template rotation.
- Improved AI handling for weekly check-ins, directly using `ai.models.generateContent()`.
- Dual-mode check-in architecture (File Search and Fallback).
- Live countdown feature for upcoming weekly check-ins.
- Knowledge Base enhancements: Universal PDF support with Gemini Files API, real-time Google Drive synchronization with a cost-optimized debounce system, and comprehensive sync history tracking.
- Dataset Sync API for external partners, supporting 19 semantic logical roles, HMAC-SHA256 security, webhook endpoints, and scheduling options. External sync sources can now be associated with specific clients.
- Centralized semantic constants for consistency across UI components.
- Data Sync Observability Dashboard providing comprehensive monitoring for all external data sources with health status indicators, push/pull mode visualization, metrics tracking, and daily trend sparklines.
- Enhanced AI Context for Data Analysis: Query planner now dynamically loads available metrics and semantic column mappings, enabling AI to understand dataset-specific columns like "cost" → food_cost.
- Italian-to-English Time Slot Normalization: RULE_4A/4B in query-engine-rules normalizes Italian time slot values (cena→dinner, pranzo→lunch, colazione→breakfast) for both existing time_slot columns and hour-based extraction from order_date.
- Gross Margin Per Document Metric: New primary metric with Italian aliases (margine_medio_scontrino, margin_per_order) for calculating average margin per receipt.
- Intent Follow-Through System: When users confirm AI proposals with "ok", "sì", "va bene", the system automatically extracts the proposed analysis from the assistant's last message and executes it through the full analytics pipeline. Features recursion prevention (_forceAnalytics flag), proposal pattern detection, and analytic content guards.
- Conversation Context Flow: Result-explainer, query-planner, and intent-router all receive conversation history (last 6 messages, 500 chars each) for contextual understanding of user confirmations and follow-up queries.
- Partner Webhook Notification System: Automatic webhook notifications to external partners when clients purchase Gold or Silver licenses via Stripe. Features HMAC-SHA256 signature verification, configurable per-tier notifications, secret key management with regeneration, test webhook functionality, and comprehensive logging with status tracking. UI card in Licenses tab for configuration.

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