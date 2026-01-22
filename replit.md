# Overview
This full-stack web application is a comprehensive consultation platform designed to connect consultants and clients. It facilitates exercise assignments, tracks progress, and provides performance analytics. Key features include an AI assistant for personalized financial insights, advanced client management, robust communication tools, and an extensive AI knowledge base. The platform aims to enhance consultant-client interactions, streamline financial guidance, and improve client outcomes and consultant efficiency. It also incorporates a multi-tier subscription system for AI agents with revenue sharing, an employee licensing system, and a public landing page for lead generation, targeting market growth and consultant empowerment.

# User Preferences
Preferred communication style: Simple, everyday language.
User requested "obsessive-compulsive" attention to detail when verifying what works and what doesn't.

# System Architecture
The application is built with a modern tech stack, including React 18, TypeScript, Vite, and Tailwind CSS for the frontend, and Express.js, TypeScript, JWT, bcrypt, and PostgreSQL (Drizzle ORM) for the backend. Data management is handled by PostgreSQL (Supabase) with Drizzle ORM. Authentication uses JWT and bcrypt, with a role-based access control system supporting consultant, client, and super_admin roles, and a multi-profile system for granular control over client profiles.

The UI/UX emphasizes a modern, accessible, and responsive design using `shadcn/ui` and `Tailwind CSS`, featuring interactive guided tours and content-focused layouts. Client management is presented in a compact enterprise table layout with sortable columns, pagination, bulk selection, and inline actions.

AI is extensively integrated throughout the platform, providing:
- Personalized financial insights and a semantic search AI knowledge base with multi-tenant isolation.
- Consultation summarization, generating summary emails and tasks from transcripts.
- AI-powered WhatsApp Business and Instagram Direct Messaging integration via Twilio and Meta Graph API.
- Configurable AI sales agents and a 100% AI-driven follow-up system.
- AI tools for generating courses, pathways, and multi-language exercises.
- A ChatGPT-style AI Assistant with dynamic model selection, reasoning visualization, and conversation memory, supported by a hybrid AI context system combining real-time data and file search documents with hourly automatic synchronization.
- Token optimization strategies combining intent detection, conditional queries, caching, and RAG.

A multi-tier subscription system manages AI agent subscriptions, consultant license tracking, revenue sharing, and AI credits, with Stripe integration for payments, provisioning, and webhooks, supporting dual payment channels.

The platform includes a Content Marketing Studio with AI-powered tools for idea generation, social media copy, a 6-step campaign builder, AI image generation, and content organization. It features a redesigned "Content Studio Ideas - Wizard UI" with a 3-step accordion structure, progress bar, compact pill buttons, and sticky action bar, integrating brand voice and knowledge base context into AI prompts. Reusable brand voice components are used across different sections.

A Lead Nurturing 365 System provides an automated 365-day email sequence using AI-generated content and dynamic templates, managed by a cron scheduler with GDPR compliance. The Email Hub supports IMAP/SMTP, unified inboxes, AI-powered response generation, multi-folder support, and knowledge base integration.

A "compute-first" data analysis system for structured data (Excel/CSV) separates deterministic calculation (SQL) from AI interpretation. It includes efficient Excel parsing, fast imports, dynamic tables with RLS, SSE for progress updates, AI-fallback column discovery, distributed sampling, and anti-stampede caching, outputting structured JSON. The Data Analysis Chat UI reuses AI Assistant components for conversation persistence, tool call visualization, and unified preference integration.

An enterprise-grade Semantic Layer aims to prevent AI hallucinations through predefined metrics, semantic mapping, and a robust pre-validation architecture, using logical columns, metric templates, and term mapping for accurate SQL generation and business-friendly error messages. This includes an Intent Router Architecture with a 3-layer pipeline (Intent Router, Policy Engine, Execution Agent) for intent classification and execution, and a Pre-Validation Layer with Cardinality Probe, Semantic Contract, Filter Enforcement, and Result Size Guardrail. Semantic category filtering and order-by detection ensure accurate and context-aware query generation. The Universal Semantic Layer supports any CSV/Excel dataset with 18 logical roles, an alias system, flexible auto-detect patterns, and pre-validation.

The Consultant Setup Wizard guides consultants through 4 phases and 23 steps to configure the platform, covering basic infrastructure (Vertex AI, Email SMTP, Google Calendar, Twilio + WhatsApp, Instagram Messaging, WhatsApp Templates, Campaigns, Stripe Connect, Email Journey, Email Nurturing 365, Email Hub), WhatsApp & Agents (Inbound, Outbound, Consultative Agents, Public Agent Links, AI-Generated Ideas, Custom WhatsApp Templates), Content (Courses, Exercises, Knowledge Base), and Advanced settings (Summary Emails, Video Meeting via TURN, Lead Import). Each step tracks its status (pending, configured, verified, error) with automatic progress saving.

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