# Overview
This full-stack web application is a consultation platform connecting consultants and clients for exercise assignments, progress tracking, and performance analytics. It features an AI assistant for personalized financial insights using real-time data, advanced client management, and communication tools. The platform also includes a robust AI knowledge base system, aiming to enhance consultant-client interactions, streamline financial guidance, and improve client outcomes and consultant efficiency.

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
- **AI Knowledge Base System**: Allows document uploads (PDF, DOCX, TXT) and external API integrations for AI context, featuring text extraction, indexing, priority-based ranking, and multi-tenant isolation.
- **Gemini File Search Integration (RAG)**: Semantic document retrieval using Google's native File Search with per-client toggles, external document auto-sync, and automatic large file chunking.
- **Echo - AI Consultation Summary Agent**: Generates consultation summary emails and extracts actionable tasks from Fathom transcripts with approval workflows.
- **AI System Prompt Architecture**: All AI endpoints use `buildSystemPrompt()` for comprehensive context.
- **Token Optimization Strategy**: Hybrid approach using intent detection, conditional database queries, intent-scoped caching, dynamic exercise scraping limits, and File Search RAG to reduce AI token consumption.
- **WhatsApp Business Integration**: Full-featured WhatsApp messaging via Twilio with AI-powered responses, rich media, and automatic API key rotation, including multi-tenant configuration and Gemini AI responses.
- **Instagram Direct Messaging Integration**: AI sales agents for Instagram DMs via Meta Graph API, supporting reactive messaging, comment-to-DM automation, story replies/mentions, and ice breakers. Includes HMAC verification, rate limiting, encrypted token storage, and a pending message queue.
- **Per-Agent Google Calendar Integration**: Each WhatsApp agent operates independently with mandatory agent calendars, agent-specific availability settings, and isolated booking data.
- **Sales Agent Configuration**: Configurable AI agent execution for sales phases with dynamic token usage optimization, intelligent personality profiling, and sequentially validated scripts.
- **Human Seller Analytics & Session Persistence**: Unified analytics for AI agents and human sellers, with session state storage and restoration.
- **Checkpoint Validation System**: 3-tier status system (VALIDATED, VAGUE, MISSING) for sales coaching.
- **Gemini Model Configuration**: Dynamic model selection based on provider type and priority for SuperAdmin Gemini Keys for Gemini 3 capabilities.
- **Video Copilot Turn-Taking System**: Prevents API bombardment during video meetings via intelligent turn-taking.
- **WebRTC/WebSocket Resilience System**: Implements heartbeat, exponential backoff, and network change detection for robust connectivity.
- **AI-Driven Follow-up Automation System**: 100% AI-driven follow-up system guided by per-consultant preferences while maintaining decision autonomy.
- **Booking Extraction Accumulator Pattern**: Prevents booking data loss during AI re-extraction cycles by progressively accumulating fields across multiple attempts.
- **AI Course Builder**: 5-step wizard to generate lessons from YouTube videos with multi-layer transcript extraction, AI lesson generation, SSE progress tracking, draft management, and a Course Theme System. Supports parallel batch processing, auto-save/resume, `yt-dlp` JavaScript runtime, and transcript failure handling.
- **AI University Pathway Generator**: 4-step wizard for AI-powered university pathway creation, including course selection, trimester assignment, pathway details, and optional client assignment.
- **AI Exercise Generator**: Generates exercises from course lessons with multi-language support, adjustable writing styles, automatic or fixed question count, and SSE streaming for progress updates.
- **AI Assistant Agent Integration**: WhatsApp agents can be enabled for use in the AI Assistant interface with per-agent toggles, agent context injection, client sharing, File Search category selection, and ChatGPT-style `aiAssistantPreferences`. Features a hierarchical AI instruction system with consultant defaults and client overrides.
- **Multi-Agent Instagram Architecture**: Each WhatsApp agent can have its own independent Instagram account with per-agent configuration, webhook routing, and integration into the agent wizard and conversations page.
- **Lead Import System (Close CRM style)**: Bulk import leads from Excel, CSV, or Google Sheets with auto-mapping, SHA256 hash deduplication, incremental imports, and phone number normalization. Features comprehensive Google Sheets integration with automatic polling/sync at configurable intervals (15/30/60 min), full 18-field CRM mapping (firstName, lastName, phone, email, company, obiettivi, desideri, uncino, fonte, address, city, state, postalCode, country, tags, dateOfBirth, website), intelligent column synonym detection, and centralized management in the API Keys page with toggle on/off and delete functionality for configured sheets.
- **SaaS Landing Page (/Sas)**: Public landing page for lead generation with a modern gradient design, featuring Hero section, Features section (AI, Automation, Training), Benefits section with testimonial, Lead capture form (firstName, lastName, email, phone), and Login CTA. Leads are stored in the `landing_leads` table with duplicate email detection.
- **Dipendenti AI Subscription System**: Multi-tier subscription system for AI agents with:
  - **Level 1 (Bronzo/Free)**: Public access via slug with configurable daily message limits, no registration required.
  - **Level 2 (Argento/Paid)**: Authenticated clients with knowledge base access and unlimited messages.
  - **Level 3 (Deluxe/Premium)**: Full software access with AI Manager and dashboard for premium clients.
  - **Consultant Licenses**: Tracked in `consultantLicenses` table with level2Total/Used and level3Total/Used counters (default 20 L2, 10 L3).
  - **Revenue Sharing**: Configurable per-consultant via SuperAdmin (default 50/50 split), stored in `revenueSharePercentage`.
  - **Monthly Invoicing**: `monthlyInvoices` table tracks totalRevenueCents, consultantShareCents, platformShareCents, and aiCreditsCostCents.
  - **AI Credits Tracking**: Fields for tracking AI usage costs (aiCreditsUsed, aiCreditsCostUsd) for future billing.
  - **Public Pricing Page**: Consultant-branded pricing page at `/c/:slug/pricing` with 3-column layout for all tiers.
  - **Security**: Public chat endpoints validate Level 1 agents only, preventing L2/L3 access via public slugs.
  - **SuperAdmin Controls**: "Gestione Licenze Consulenti" card for managing license allocations and revenue share.
  - **Stripe Connect Integration**: Complete payment flow implemented with:
    - Express accounts for Italian consultants via OAuth onboarding
    - Destination charges model: payments go to platform, transfers to consultant minus application fee
    - Application fee based on `revenueSharePercentage` (default 50/50 split)
    - Webhook handling for subscription activation (`checkout.session.completed`)
    - SuperAdmin dashboard with platform-wide transaction overview
    - Consultant subscription list in Stripe Connect tab
    - Keys stored in `superadminStripeConfig` table (encrypted)

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