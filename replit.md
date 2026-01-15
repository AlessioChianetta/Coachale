# Overview
This full-stack web application is a comprehensive consultation platform designed to connect consultants and clients. It facilitates exercise assignments, progress tracking, and performance analytics. Key features include an AI assistant for personalized financial insights, advanced client management, robust communication tools, and an extensive AI knowledge base. The platform aims to enhance consultant-client interactions, streamline financial guidance, and improve client outcomes and consultant efficiency. It also incorporates a multi-tier subscription system for AI agents with revenue sharing, an employee licensing system, and a public landing page for lead generation, targeting market growth and consultant empowerment.

# User Preferences
Preferred communication style: Simple, everyday language.
User requested "obsessive-compulsive" attention to detail when verifying what works and what doesn't.

# System Architecture
## Core Technologies
The application is built with a modern stack:
- **Frontend**: React 18, TypeScript, Vite, TanStack React Query, Wouter, shadcn/ui, Tailwind CSS, React Hook Form, Zod.
- **Backend**: Express.js, TypeScript, JWT, bcrypt, PostgreSQL (Drizzle ORM), Multer.

## Data Management
- **Database**: PostgreSQL (Supabase) is used with Drizzle ORM to manage all application data including users, exercises, assignments, submissions, consultations, goals, and analytics.

## Authentication & Authorization
- **Security**: JWT tokens handle client-side authentication, with secure password management via bcrypt.
- **Access Control**: A role-based access control system differentiates between consultant, client, and super_admin roles.
- **Super Admin System**: Features global OAuth, TURN server configurations, and a 3-tier priority system for Gemini API keys.
- **Multi-Profile System**: Users can have multiple roles simultaneously via `user_role_profiles` table. Consultants can enable/disable consultant profiles for their clients via the Clients management page. Dual authorization checks verify ownership through both `users.consultantId` and `user_role_profiles.consultantId` to handle legacy data.

## UI/UX Decisions
- **Design System**: Modern, accessible, and responsive design is achieved using `shadcn/ui` and `Tailwind CSS`.
- **Onboarding**: Interactive guided tours with `Driver.js` provide a smooth onboarding experience.
- **Navigation**: Categorized sidebar navigation for consultants with state persistence enhances usability.
- **Layouts**: Redesigned layouts, such as "Libreria Formativa," prioritize content with a sidebar pattern, redesigned cards, and responsive elements.

## AI Integration & Automation
The platform extensively leverages AI for various functionalities:
- **Financial Insights**: "Percorso Capitale" offers personalized financial insights with graceful degradation and daily pre-fetching.
- **AI Knowledge Base**: Supports document uploads (PDF, DOCX, TXT) and external API integrations for AI context, including text extraction, indexing, and multi-tenant isolation.
- **Semantic Search (RAG)**: Integrates Google's native File Search for semantic document retrieval with per-client toggles and automatic chunking.
- **Consultation Summarization**: "Echo - AI Consultation Summary Agent" generates summary emails and extracts actionable tasks from Fathom transcripts.
- **System Prompt Architecture**: All AI endpoints utilize a `buildSystemPrompt()` function for comprehensive context.
- **Token Optimization**: A hybrid strategy combines intent detection, conditional database queries, caching, and RAG to reduce AI token consumption.
- **Messaging Integration**: Full-featured WhatsApp Business integration via Twilio and Instagram Direct Messaging via Meta Graph API, both powered by AI for responses, rich media, and automation.
- **Sales Automation**: AI sales agents are configurable for different sales phases, featuring dynamic token usage, personality profiling, and validated scripts.
- **Follow-up Automation**: A 100% AI-driven follow-up system guided by consultant preferences.
- **Content Generation**: AI Course Builder, AI University Pathway Generator, and AI Exercise Generator provide tools for automated content creation, including lessons from YouTube videos, university pathways, and multi-language exercises.
- **AI Assistant**: Integrates WhatsApp agents into a ChatGPT-style interface with dynamic model selection, reasoning visualization, instruction presets, and persistent preferences.
- **Conversation Memory**: Comprehensive memory management for AI assistant conversations with daily summaries, cron-based generation, and memory injection into system prompts.
- **Manager Gold Memory**: Gold-exclusive, per-agent AI memory system for managers, with isolated daily summaries and UI for audit.

## Subscription & Licensing
- **Subscription System**: "Dipendenti AI Subscription System" offers multi-tier (Bronze, Silver, Deluxe) AI agent subscriptions with consultant license tracking, revenue sharing, and AI credits.
- **Employee Licenses**: A separate system for consultant team members to track licenses and purchases.
- **Pricing Pages**: Public pricing pages and consultant pricing settings provide flexible configuration.
- **Unified Login**: A single login page with tier-appropriate redirects and welcome emails.
- **Stripe Integration**: Complete Stripe subscription checkout with automatic account provisioning, webhook handling, and Stripe Connect for Italian consultants (destination charges, application fees).
- **Upgrade Flow**: Seamless Bronze/Silver to Gold upgrade process with Stripe Connect, token refresh, and AI-generated personalized welcome messages.

## Referral System
- **"Invita un Amico"**: A complete referral system for both clients and consultants, featuring unique referral codes, tracking, customizable landing pages with AI assistant integration, dynamic qualification fields, automated email invitations, CRM lead creation, and bonus tracking.

## Content Marketing Studio
- **Goal**: Comprehensive content creation and marketing funnel system to support 1M MRR target.
- **Database Tables**: 8 tables (`brand_assets`, `content_ideas`, `content_posts`, `content_folders`, `ad_campaigns`, `content_calendar`, `generated_images`, `content_templates`) with full Drizzle ORM definitions.
- **Backend**: 30+ CRUD endpoints + 5 AI endpoints in `server/routes/content-studio.ts`.
- **AI Services**: `server/services/content-ai-service.ts` provides:
  - `generateContentIdeas()` - AI-powered content idea generation
  - `generatePostCopy()` - Social media copy with hook/body/CTA structure, including `captionCopy` for Instagram-ready text with emojis and [PAUSA] markers for video scripts
  - `generateCampaignContent()` - Full 6-step campaign builder (Hook→Target→Problem→Solution→Proof→CTA)
  - `generateImagePrompt()` - Optimized prompts for image generation
- **Image Generation**: Integration with Google Gemini Imagen 3 (`imagen-3.0-generate-002`) for AI image creation.
- **Hierarchical Folder System**: `content_folders` table with `parent_id` for Project → Folder → Post organization. Supports unlimited nesting with `folder_type` field distinguishing projects from folders.
- **Idea-to-Post Tracking**: `content_ideas` includes `developedPostId` and `status` (new/in_progress/developed/archived) fields. Ideas automatically link to created posts and update status when developed.
- **Frontend Pages** (in `client/src/pages/content-studio/`):
  - Dashboard with KPI stats
  - Ideas generator with AI assistance, status filters (Tutte/Nuove/In Lavorazione/Sviluppate/Archiviate), and "Sviluppata" badges with links to developed posts
  - Posts creator with copy generation and FolderSidebar for hierarchical folder navigation, folder filtering, and move-to-folder functionality
  - Campaign builder with 6-step wizard
  - Visuals generator with Imagen 3
  - Content calendar with scheduling
  - Brand assets settings (colors, voice, social handles)
- **Integration Points**: Campaigns connect to `proactive_leads` for lead generation and `consultations` for booking.

## Lead Nurturing 365 System
- **Purpose**: Automated 365-day email nurturing sequence for proactive leads with AI-generated content.
- **Database Tables**: 4 tables (`lead_nurturing_templates`, `lead_nurturing_config`, `lead_nurturing_logs`, `consultant_email_variables`) + 5 fields on `proactive_leads`.
- **AI Generation**: Uses Gemini 3 Preview via `provider-factory.ts` to generate 365 personalized email templates with SSE progress streaming.
- **Template Variables**: Dynamic placeholders (`{{nome}}`, `{{linkCalendario}}`, `{{linkDisiscrizione}}`, etc.) with XSS sanitization.
- **Cron Scheduler**: Daily email sending at 09:00 Europe/Rome timezone with weekend skip option.
- **GDPR Compliance**: Public unsubscribe endpoint (`/unsubscribe/:token`) with HMAC-SHA256 token validation, styled HTML pages with consultant branding.
- **Backend Services**:
  - `server/services/template-compiler.ts` - Variable compilation with XSS protection
  - `server/services/lead-nurturing-generation-service.ts` - AI batch generation
  - `server/cron/nurturing-scheduler.ts` - Daily sending + weekly log cleanup
  - `server/routes/nurturing-tracking.ts` - Email open/click tracking endpoints
- **API Routes**: Full CRUD at `/api/lead-nurturing/*` for config, templates, variables, analytics.
- **Email Tracking**: Pixel tracking for opens (`/api/nurturing/track/open/:logId`) and click tracking with validated redirects (`/api/nurturing/track/click/:logId/:linkId`).
- **Frontend UI** (in `client/src/pages/consultant-ai-config.tsx` Tab "Nurturing"):
  - Dashboard with 4 KPI cards (emails sent, open rate, click rate, active leads)
  - AI template generation with business description, tone selection, and SSE progress bar
  - Email variables configuration (calendar link, business name, WhatsApp, signature)
  - Templates accordion with search, category filter, and pagination (31/page)
  - Sending settings with enable/disable toggle and skip weekends option
- **Lead Integration** (in `client/src/pages/proactive-leads.tsx`):
  - Email field in lead creation/modification form
  - "Opzioni Email" section with welcome email and nurturing checkboxes
  - Nurturing column in leads table with "Giorno X/365" badge and quick toggle
- **Rate Limiting**: 50 emails/batch with 2s delay, 20h cooldown between emails to same lead.

## Email Hub System
- **Email Management**: A comprehensive email hub for consultants with IMAP/SMTP support, unified inbox, and AI-powered response generation.
- **Provider Flexibility**: Supports various account types (smtp_only, imap_only, full, hybrid) and Italian provider presets.
- **Advanced Features**: Multi-folder support, automatic background synchronization, IMAP IDLE for real-time reception, universal IMAP folder discovery with localized fallback, scalable email import for large mailboxes with SSE progress streaming, and improved IDLE connection reliability.
- **AI Email Capabilities**: Per-account AI configuration for tone, custom instructions, escalation keywords, booking link integration, and language settings.
- **Ticket System**: Automatic ticket creation based on configurable conditions, with priority levels and workflow management.
- **Knowledge Base Integration**: Semantic search of consultant documentation to inform AI responses, with per-account isolated File Search stores and document citation tracking.
- **Email Account Knowledge Base**: Each email account can have its own dedicated knowledge base (via `emailAccountKnowledgeItems` table) with automatic File Search store provisioning. The AI queries both consultant-wide and account-specific stores when generating responses, with source citations tracked in `hubEmailAiEvents.knowledgeDocsUsed`.
- **Webhook Integration**: External system notifications with HMAC SHA-256 signatures and retry logic.
- **Risk Detection**: Escalation keyword matching with optional AI processing halt and automatic ticket creation for high-risk emails.
- **Analytics & Audit**: Comprehensive File Search analytics page with email account audit section showing sync status, missing documents, and per-account sync controls.

# External Dependencies
- **Supabase**: Provides PostgreSQL hosting.
- **Recharts**: Used for data visualization.
- **Date-fns**: Utilized for date manipulation.
- **Radix UI**: Provides accessible UI primitives.
- **Google Fonts**: Inter, Poppins, DM Sans, Fira Code are used for typography.
- **Lucide React**: Provides iconography.
- **Google Gemini API**: Powers various AI-driven features.
- **Percorso Capitale API**: Integrated for financial management system functionalities.
- **Fathom**: Used for AI-powered consultation recording and transcription.
- **Driver.js**: Implements interactive guided tours and onboarding.
- **Twilio API**: Enables WhatsApp Business messaging features.