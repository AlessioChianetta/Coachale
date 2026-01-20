# Overview
This full-stack web application is a comprehensive consultation platform connecting consultants and clients, facilitating exercise assignments, progress tracking, and performance analytics. It offers an AI assistant for personalized financial insights, advanced client management, robust communication tools, and an extensive AI knowledge base. The platform aims to enhance consultant-client interactions, streamline financial guidance, and improve client outcomes and consultant efficiency. It incorporates a multi-tier subscription system for AI agents with revenue sharing, an employee licensing system, and a public landing page for lead generation, targeting market growth and consultant empowerment.

# User Preferences
Preferred communication style: Simple, everyday language.
User requested "obsessive-compulsive" attention to detail when verifying what works and what doesn't.

# System Architecture
## Core Technologies
The application uses React 18, TypeScript, Vite, TanStack React Query, Wouter, shadcn/ui, Tailwind CSS, React Hook Form, and Zod for the frontend. The backend is built with Express.js, TypeScript, JWT, bcrypt, PostgreSQL (Drizzle ORM), and Multer.

## Data Management
PostgreSQL (Supabase) with Drizzle ORM manages all application data.

## Authentication & Authorization
Authentication uses JWT and bcrypt. A role-based access control system supports consultant, client, and super_admin roles, with a multi-profile system allowing granular control for consultants over client profiles.

## UI/UX Decisions
A modern, accessible, and responsive design is achieved using `shadcn/ui` and `Tailwind CSS`. Onboarding includes interactive guided tours. Navigation is categorized with state persistence, and layouts are content-focused.

## AI Integration & Automation
The platform extensively uses AI for:
- **Financial Insights**: Personalized financial analysis.
- **AI Knowledge Base**: Semantic search (RAG) over documents and external APIs with multi-tenant isolation.
- **Consultation Summarization**: Generates summary emails and tasks from transcripts.
- **Messaging Integration**: AI-powered WhatsApp Business and Instagram Direct Messaging via Twilio and Meta Graph API.
- **Sales Automation**: Configurable AI sales agents with dynamic token usage.
- **Follow-up Automation**: 100% AI-driven follow-up system.
- **Content Generation**: AI tools for creating courses, pathways, and multi-language exercises.
- **AI Assistant**: A ChatGPT-style interface with dynamic model selection, reasoning visualization, and conversation memory.
- **Token Optimization**: A hybrid strategy combining intent detection, conditional queries, caching, and RAG to reduce AI token consumption.

## Subscription & Licensing
A multi-tier subscription system offers AI agent subscriptions with consultant license tracking, revenue sharing, and AI credits. An employee licensing system tracks team member licenses. Stripe integration manages subscriptions, provisioning, webhooks, and Stripe Connect. Dual payment channels (Stripe Connect for revenue sharing, Direct Links for 100% consultant commission) are supported with payment channel consistency. Bronze users can securely upgrade via token-based authentication.

## Content Marketing Studio
Provides AI-powered tools for content idea generation, social media copy, a 6-step campaign builder, AI image generation, and content organization with a calendar and brand asset management.

## Lead Nurturing 365 System
An automated 365-day email nurturing sequence uses AI-generated content, brand voice integration, and dynamic templates. A cron scheduler handles daily sending with GDPR compliance and email tracking.

## Email Hub System
A comprehensive email hub for consultants supports IMAP/SMTP, unified inboxes, and AI-powered response generation. Features include multi-folder support, background synchronization, IMAP IDLE, a ticket system, and knowledge base integration.

## Compute-First Data Analysis System
A "compute-first" data analysis system for structured data (Excel/CSV) separates deterministic calculation (SQL) from AI interpretation. Key decisions include efficient Excel parsing, fast imports, dynamic tables with RLS, SSE for progress updates, AI-fallback column discovery, distributed sampling, and anti-stampede caching. It uses a structured JSON output.

### Data Analysis Chat UI
An AI chat interface for data analysis, reusing components from the AI Assistant. It features conversation persistence, tool call visualization, a consultative AI prompt, and unified preference integration.

### Semantic Layer for Anti-Hallucination
An enterprise-grade system eliminates AI hallucinations through predefined metrics, semantic mapping, and a robust pre-validation architecture. It uses logical columns, metric templates, and term mapping to ensure accurate SQL generation and provides business-friendly error messages.

### Intent Router Architecture
A 3-layer pipeline separating intent classification from execution to prevent strategic questions from triggering data analysis tools and hallucinating numbers:

**Layer 1 - Intent Router (intent-router.ts)**
- Uses gemini-2.5-flash-lite for fast, cheap intent classification
- 4 intent types: analytics, strategy, data_preview, conversational
- Returns structured JSON with intent, requires_metrics, suggested_tools, confidence
- **Context-aware classification**: Receives last 5 conversation messages for intelligent drill-down detection
- **Chain-of-Thought reasoning**: AI reasons internally about conversation flow (aggregation → drill-down = analytics)
- Example: User sees "945 piatti" → asks "analizzami i piatti" → correctly classified as analytics, not data_preview

**Layer 2 - Policy Engine (policy-engine.ts)**
- Pure TypeScript rules (no AI calls)
- analytics: allows [execute_metric, aggregate_group, compare_periods, filter_data]
- strategy: allows NO tools (qualitative responses only)
- data_preview: allows [filter_data, get_schema]
- conversational: allows NO tools (fixed responses)

**Layer 3 - Execution Agent (query-planner.ts)**
- Executes approved tools only
- Passes conversation history for context-aware routing
- Strategy responses have hard numeric guard:
  - Detects digits, Italian numerals, Roman numerals, compound forms, ordinals
  - Removes all numeric content or uses fallback response
  - Guarantees strategy responses contain ZERO invented numbers

**Pre-Validation Layer (query-planner.ts + query-executor.ts)**
- **Cardinality Probe**: `getDistinctCount()` distinguishes row_count vs unique_items before queries
- **Semantic Contract**: `detectSemanticContract()` detects "uno per uno/tutti" keywords and BLOCKS limit changes without user consent
- **Filter Enforcement**: `extractFiltersFromQuestion()` extracts mentioned filters (e.g., "categoria food") and injects them into tool calls
- **Result Size Guardrail**: `checkCardinalityBeforeAggregate()` asks for user confirmation if result > 500 rows (top N, export, paginate options)
- Wiring logs: `[WIRING-CHECK]` prefix for debugging execution flow

### Auto Semantic Mapping for CSV Datasets
Automatic detection of column roles (price, cost, quantity, order_date) during CSV upload with confidence scoring. Features include:
- **Auto-detect on upload**: Saves mappings with confidence ≥ 0.70 to dataset_column_semantics table
- **Critical column confirmation**: Requires 1-click confirmation for price/cost/quantity/order_date (even with high confidence)
- **Analytics blocking**: Blocks analytical queries until required semantic mappings are confirmed
- **Semantic resolver integration**: Metric formulas use {placeholder} syntax resolved via confirmed mappings
- **Golden test values**: revenue=21956.62, food_cost=7689.61, order_count=941 for restaurant test dataset

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