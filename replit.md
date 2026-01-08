# Overview
This full-stack web application is a consultation platform connecting consultants and clients for exercise assignments, progress tracking, and performance analytics. It features an AI assistant for personalized financial insights, advanced client management, communication tools, and a robust AI knowledge base. The platform aims to enhance consultant-client interactions, streamline financial guidance, and improve client outcomes and consultant efficiency. It also includes a comprehensive multi-tier subscription system for AI agents with revenue sharing, an employee license system, and a public landing page for lead generation.

# User Preferences
Preferred communication style: Simple, everyday language.
User requested "obsessive-compulsive" attention to detail when verifying what works and what doesn't.

# System Architecture
## Core Technologies
- **Frontend**: React 18, TypeScript, Vite, TanStack React Query, Wouter, shadcn/ui, Tailwind CSS, React Hook Form, Zod.
- **Backend**: Express.js, TypeScript, JWT, bcrypt, PostgreSQL (Drizzle ORM), Multer.
## Data Management
- **Database**: PostgreSQL (Supabase) with Drizzle ORM, supporting users, exercises, assignments, submissions, consultations, goals, and analytics.
## Authentication & Authorization
- **JWT tokens** for client-side authentication.
- **Role-based access control** (consultant/client/super_admin).
- **Secure password handling** using bcrypt.
- **Super Admin System**: Centralized management with global OAuth, TURN server configurations, and a 3-tier priority system for Gemini API keys.
## UI/UX Decisions
- Modern, accessible, and responsive design using `shadcn/ui` and `Tailwind CSS`.
- Interactive guided tours via `Driver.js` for onboarding.
- Categorized Sidebar Navigation for consultants with state persistence.
- Redesigned "Libreria Formativa" layout with a Sidebar + Content pattern, redesigned course cards, 4-level deletion protection, responsive action buttons, integrated search, and a compact header.
## AI Integration
- **Percorso Capitale**: Personalized financial insights with graceful degradation and daily pre-fetch.
- **AI Knowledge Base System**: Document uploads (PDF, DOCX, TXT) and external API integrations for AI context, featuring text extraction, indexing, priority-based ranking, and multi-tenant isolation.
- **Gemini File Search Integration (RAG)**: Semantic document retrieval using Google's native File Search with per-client toggles, external document auto-sync, automatic large file chunking, and cross-store isolation.
- **Echo - AI Consultation Summary Agent**: Generates consultation summary emails and extracts actionable tasks from Fathom transcripts with approval workflows.
- **AI System Prompt Architecture**: All AI endpoints use `buildSystemPrompt()` for comprehensive context.
- **Token Optimization Strategy**: Hybrid approach using intent detection, conditional database queries, intent-scoped caching, dynamic exercise scraping limits, and File Search RAG to reduce AI token consumption.
- **WhatsApp Business Integration**: Full-featured WhatsApp messaging via Twilio with AI-powered responses, rich media, and automatic API key rotation, including multi-tenant configuration and Gemini AI responses.
- **Instagram Direct Messaging Integration**: AI sales agents for Instagram DMs via Meta Graph API, supporting reactive messaging, comment-to-DM automation, story replies/mentions, and ice breakers.
- **Per-Agent Google Calendar Integration**: Each WhatsApp agent operates independently with mandatory agent calendars, agent-specific availability settings, and isolated booking data.
- **Sales Agent Configuration**: Configurable AI agent execution for sales phases with dynamic token usage optimization, intelligent personality profiling, and sequentially validated scripts.
- **Checkpoint Validation System**: 3-tier status system (VALIDATED, VAGUE, MISSING) for sales coaching.
- **Gemini Model Configuration**: Dynamic model selection based on provider type and priority for SuperAdmin Gemini Keys for Gemini 3 capabilities.
- **AI-Driven Follow-up Automation System**: 100% AI-driven follow-up system guided by per-consultant preferences.
- **AI Course Builder**: 5-step wizard to generate lessons from YouTube videos with multi-layer transcript extraction, AI lesson generation, SSE progress tracking, draft management, and a Course Theme System.
- **AI University Pathway Generator**: 4-step wizard for AI-powered university pathway creation, including course selection, trimester assignment, pathway details, and optional client assignment.
- **AI Exercise Generator**: Generates exercises from course lessons with multi-language support, adjustable writing styles, automatic or fixed question count, and SSE streaming for progress updates.
- **AI Assistant Agent Integration**: WhatsApp agents can be enabled for use in the AI Assistant interface with per-agent toggles, agent context injection, client sharing, File Search category selection, and ChatGPT-style `aiAssistantPreferences`.
- **AI Assistant Enhanced Features (Gemini/ChatGPT-style)**: Dynamic model selection, thinking/reasoning visualization, instruction preset templates, and persistent AI preferences.
- **Multi-Agent Instagram Architecture**: Each WhatsApp agent can have its own independent Instagram account with per-agent configuration, webhook routing, and integration into the agent wizard and conversations page.
- **Lead Import System (Close CRM style)**: Bulk import leads from Excel, CSV, or Google Sheets with auto-mapping, SHA256 hash deduplication, incremental imports, phone number normalization, and comprehensive Google Sheets integration with automatic polling/sync.
- **SaaS Landing Page (/Sas)**: Public landing page for lead generation with a modern gradient design, featuring Hero section, Features section (AI, Automation, Training), Benefits section with testimonial, Lead capture form, and Login CTA.
- **Dipendenti AI Subscription System**: Multi-tier subscription system for AI agents with Bronze (Free), Silver (Paid), and Deluxe (Premium) tiers, consultant licenses tracking, revenue sharing, monthly invoicing, and AI credits tracking.
- **User Management Dashboard**: "Utenti Registrati" section in Licenze tab with tier-specific user lists, aggregate stats, search, pagination, and user deletion.
- **Public Pricing Page**: Full landing page at `/c/:slug/pricing` with animated hero, feature grid, 3-column pricing cards, comparison table, social proof, FAQ, trust badges, guarantee banner, and final CTA.
- **Consultant Pricing Settings**: 4-tab configuration interface for pricing page (General, Plans, Content, Style).
- **Unified Login System**: Single `/login` page authenticates across all 3 tiers with case-insensitive email matching, tier-appropriate redirects, welcome emails, and manual password reset.
- **Premium Agent Selection System**: Mobile-first interface for Bronze/Silver users to choose their AI agent with per-tier agent configuration.
- **Stripe Subscription Flow**: Complete subscription checkout with monthly/yearly billing, automatic account provisioning, welcome emails, idempotent webhook handling, and proper price display.
- **Stripe Connect Integration**: Complete payment flow with Express accounts for Italian consultants via OAuth onboarding, destination charges model, application fee based on `revenueSharePercentage`, and webhook handling.
- **Employee License System**: Separate licensing model for consultant team members with `isEmployee` flag, employee license tracking, purchase history, and platform Stripe checkout.
- **Bronze→Silver/Gold Upgrade Flow**: Complete subscription upgrade system with Stripe Connect checkout, automatic token refresh (no logout required), UpgradeSuccessDialog with tier-specific celebration, OnboardingWizard with AI-generated personalized welcome message (via Gemini using agent template + brand voice), user preference configuration (writing style, response length, custom instructions), seamless preference integration into AI chat prompts, conversation migration (both managerId and shareId), and intelligent "Account disattivato" handling for upgraded accounts.
- **AI Conversation Memory System**: Comprehensive memory management for AI assistant conversations. Features include: daily summaries (4-6 sentences, 400-600 chars) stored in `ai_daily_summaries` table, automatic nightly generation via cron job at 03:00 Italian time, token usage logging (~40 tokens/summary), memory audit dashboard in "Memoria AI" tab showing coverage per user, generation logs in `ai_memory_generation_logs` for full audit trail, manual generation per-user, and memory context injection into system prompts (NOT File Search) for reliability.
- **Manager Gold Memory System (Gold-Exclusive, Per-Agent Architecture)**: AI memory for Gold tier managers stored in `manager_daily_summaries` table with per-agent isolation via `agent_profile_id` column. Features: separate daily summaries for each agent the Gold user interacts with (instead of aggregated summaries), automatic generation via cron scheduler (hourly) using `generateAllAgentSummariesForManager()`, memory injection into system prompts filtered by current agent context, unique database constraint preventing duplicate summaries per subscription/date/agent, ManagerMemorySheet UI with Brain icon for Gold users, "Dipendenti Gold" section in consultant dashboard with agent breakdown cards and "Visualizza" buttons to view agent-specific summaries, manual memory generation per Gold manager, duplicate protection with existence checks before insert, and tier-gated security ensuring Silver/Bronze users never receive memory context.
- **Referral System ("Invita un Amico")**: Complete referral system for client and consultant referral programs. Features: unique referral codes (FIRSTNAME-XXXX format) stored in `referral_codes` table, referral tracking in `referrals` table with status flow (pending → contacted → appointment_set → closed_won/closed_lost), customizable landing page configuration in `referral_landing_config` table with AI assistant iframe integration, role-based dynamic qualification fields (Imprenditore/Dipendente/Libero Professionista/Studente/Altro) with per-field enabled/required toggles stored in JSONB `qualificationFieldsConfig`, automatic email invitations via consultant SMTP, automatic CRM lead creation via proactive_leads integration with default campaign and agent assignment, bonus tracking and rewards. Premium minimal design for public landing page with floating AI chat button, sandboxed iframe for security, auto-expanding qualification section on validation errors. Routes: `/client/referral` for client invitation interface, `/consultant/referrals` for referral management dashboard, `/consultant/referrals/settings` for landing page, AI assistant, and qualification fields configuration, `/r/:code` public landing page for referred friends.

# External Dependencies
- **Supabase**: PostgreSQL hosting.
- **Recharts**: Data visualization.
- **Date-fns**: Date manipulation.
- **Radix UI**: Accessible UI primitives.
- **Google Fonts**: Inter, Poppins, DM Sans, Fira Code.
- **Lucide React**: Iconography.
- **Google Gemini API**: AI-powered features.
- **Percorso Capitale API**: Financial management system integration.
- **Fathom**: AI-powered consultation recording and transcription.
- **Driver.js**: Interactive guided tours and onboarding.
- **Twilio API**: WhatsApp Business messaging.