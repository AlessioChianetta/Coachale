# Overview
This full-stack web application is a comprehensive consultation platform connecting consultants and clients. It facilitates exercise assignments, progress tracking, and performance analytics. Key features include an AI assistant for personalized financial insights, advanced client management, robust communication tools, and an extensive AI knowledge base. The platform aims to enhance consultant-client interactions, streamline financial guidance, and improve client outcomes and consultant efficiency. It incorporates a multi-tier subscription system for AI agents with revenue sharing, an employee licensing system, and a public landing page for lead generation, targeting market growth and consultant empowerment.

# User Preferences
Preferred communication style: Simple, everyday language.
User requested "obsessive-compulsive" attention to detail when verifying what works and what doesn't.

# System Architecture
## Core Technologies
The application is built with React 18, TypeScript, Vite, TanStack React Query, Wouter, shadcn/ui, Tailwind CSS, React Hook Form, Zod for the frontend. The backend uses Express.js, TypeScript, JWT, bcrypt, PostgreSQL (Drizzle ORM), and Multer.

## Data Management
PostgreSQL (Supabase) with Drizzle ORM manages all application data.

## Authentication & Authorization
Authentication uses JWT tokens and bcrypt for secure passwords. A role-based access control system supports consultant, client, and super_admin roles. A multi-profile system allows users to hold multiple roles, with granular control for consultants over client profiles.

## UI/UX Decisions
A modern, accessible, and responsive design is achieved using `shadcn/ui` and `Tailwind CSS`. Onboarding includes interactive guided tours with `Driver.js`. Navigation is categorized with state persistence. Layouts are content-focused with sidebars and responsive elements.

## AI Integration & Automation
The platform heavily leverages AI for diverse functionalities:
- **Financial Insights**: Provides personalized financial insights.
- **AI Knowledge Base**: Supports document uploads and external API integrations for AI context, with semantic search (RAG) using Google's native File Search and multi-tenant isolation.
- **Consultation Summarization**: Generates summary emails and actionable tasks from transcripts.
- **Messaging Integration**: Full-featured WhatsApp Business and Instagram Direct Messaging via Twilio and Meta Graph API, powered by AI for responses and automation.
- **Sales Automation**: Configurable AI sales agents with dynamic token usage and personality profiling.
- **Follow-up Automation**: 100% AI-driven follow-up system based on consultant preferences.
- **Content Generation**: AI tools for creating courses, university pathways, and multi-language exercises.
- **AI Assistant**: A ChatGPT-style interface with dynamic model selection, reasoning visualization, and persistent preferences.
- **Conversation Memory**: Comprehensive memory management for AI assistant conversations with daily summaries and memory injection.
- **Manager Gold Memory**: An exclusive, per-agent AI memory system for managers with isolated daily summaries.
- **System Prompt Architecture**: All AI endpoints utilize a `buildSystemPrompt()` function for comprehensive context.
- **Token Optimization**: A hybrid strategy combines intent detection, conditional database queries, caching, and RAG to reduce AI token consumption.

## Subscription & Licensing
A multi-tier subscription system ("Dipendenti AI Subscription System") offers AI agent subscriptions with consultant license tracking, revenue sharing, and AI credits. An employee licensing system tracks team member licenses. Public and consultant-specific pricing pages are configurable. A unified login with Stripe integration manages subscriptions, automatic provisioning, webhooks, and Stripe Connect for Italian consultants. A seamless upgrade flow (Bronze/Silver to Gold) is implemented.

## Stripe Payment Automations
An automated user provisioning system that creates users when Stripe payments are received. The system supports dual payment channels with commission consistency.

### Dual Payment Channels
1. **Stripe Connect**: Revenue sharing with platform, uses superadmin Stripe keys
2. **Direct Links**: 100% consultant commission, uses consultant's personal Stripe keys

### Payment Channel Consistency
When a user purchases via Direct Link (paymentSource=direct_link), all future upgrades use Direct Links to preserve the 100% commission. The system tracks:
- `paymentSource` field on bronzeUsers (organic, stripe_connect, direct_link)
- `consultantId` stored in localStorage during login for upgrade link resolution

### Direct Links Feature
Consultants can configure auto-generated upgrade payment links in `/consultant/payment-automations`:
- Set prices (monthly/yearly) for Silver, Gold tiers (Bronze is free registration)
- Configure temporary discounts with expiration dates
- System auto-creates Stripe Product/Price/PaymentLink using consultant's keys
- Links stored in `consultant_direct_links` table
- Public endpoint for fetching upgrade links: `/api/stripe-automations/direct-links/public/:consultantId`

**Auto-Automation Creation (January 2026):**
When creating a direct link, the system automatically creates an associated payment automation:
- **Silver**: `createAsClient=false`, `clientLevel="silver"`, `sendWelcomeEmail=true` (tier only, no client role)
- **Gold**: `createAsClient=true`, `clientLevel="gold"`, `sendWelcomeEmail=true` (tier + client role)
- Automations are linked via `directLinkId` field and marked `showOnPricingPage=true`

**Separate Public Pricing Pages (January 2026):**
Two distinct pricing pages to maintain clear separation of payment flows:
- **`/c/:slug/pricing`** (Stripe Connect): Shows Bronze/Silver/Gold tiers with registration form, uses revenue sharing via superadmin Stripe keys (`public-pricing.tsx`)
- **`/c/:slug/direct`** (Direct Links): Shows only Silver/Gold tiers, redirects directly to consultant's Stripe Payment Links for 100% commission (`public-pricing-direct.tsx`)
- Both pages fetch from same endpoint `/api/public/consultant/:slug/pricing` which returns `paymentLinks` object
- Direct Links page shows fallback message when links not configured, directing users to standard pricing page

### Key Features
- **Webhook Integration**: Per-consultant webhook endpoints (`/api/webhooks/stripe/:consultantId`) with signature verification
- **Automatic User Creation**: Parses Stripe checkout session data to create users with cryptographically secure passwords
- **Role Assignment**: Configurable creation as client or consultant with Bronze/Silver/Gold level assignment
- **Gold = Client Rule**: Gold tier ALWAYS creates client role (enforced in both stripe-automations-router and stripe-connect-router webhooks)
- **Password Management**: Temporary passwords stored until user changes them; change-password redirects Gold clients to /client, Bronze/Silver to /c/{slug}/select-agent
- **Welcome Emails**: Step-by-step email templates with clear instructions
- **Audit Logging**: Complete history of all provisioned users with success/failure tracking
- **UI Management**: Dedicated page with descriptive tooltips explaining Client/Consultant roles and Bronze/Silver/Gold levels

## Referral System
A comprehensive "Invita un Amico" referral system for clients and consultants features unique codes, tracking, customizable landing pages with AI, dynamic qualification fields, automated emails, CRM lead creation, and bonus tracking.

## Content Marketing Studio
This system provides tools for content creation and marketing. It includes features for AI-powered content idea generation, social media copy creation, a 6-step campaign builder, AI image generation via Google Gemini Imagen 3, and a hierarchical folder system for content organization. It also offers a content calendar and brand asset management.

## Lead Nurturing 365 System
An automated 365-day email nurturing sequence for proactive leads utilizes AI-generated content. It employs a topic-first approach for generating email content, integrates brand voice data for personalization, and uses dynamic template variables. A cron scheduler handles daily email sending with GDPR-compliant unsubscribe functionality. The system includes email tracking for opens and clicks, and lead integration for nurturing options.

## Email Hub System
A comprehensive email hub for consultants supports IMAP/SMTP, unified inboxes, and AI-powered response generation. It features multi-folder support, automatic background synchronization, IMAP IDLE for real-time reception, and scalable email import. AI email capabilities include per-account configuration for tone and instructions. The system incorporates a ticket system, knowledge base integration for AI responses, webhook integration, risk detection, and analytics. Each email account can have its own dedicated knowledge base.

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