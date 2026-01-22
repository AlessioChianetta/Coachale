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

### CRM Client Management
Compact enterprise table layout with:
- Sortable columns (name, email, date, exercises, progress)
- Pagination (10/25/50 per page) with navigation controls
- Bulk selection with indeterminate checkbox state
- Inline hover actions (edit, status toggle, dropdown menu)
- Mini avatars (24px) and dense 40px rows

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
- **AI Context System (Hybrid)**: Combines real-time data (consultant-context-builder) with File Search documents for deep historical context:
  - Real-time: Lead metrics, client data, exercises, calendar events
  - File Search: WhatsApp conversation history (200 conversations, 30 days), Lead Hub metrics, AI limitations document
  - Hourly automatic sync (cron at :30) + manual sync button in AI Assistant UI
  - Endpoint: POST /api/ai-assistant/sync-context
  - **Dynamic Context Documents** (sourceType: 'dynamic_context'):
    - 3 auto-generated docs: WhatsApp history, Lead Hub metrics, AI limitations
    - Audit system detects missing/outdated (>24h) with health score impact
    - Settings: Auto-sync toggle in File Search Analytics > Impostazioni > Contesto AI Dinamico
    - Frontend: Visible in Contenuti tab, Audit tab, and dedicated Settings card
- **Token Optimization**: A hybrid strategy combining intent detection, conditional queries, caching, and RAG to reduce AI token consumption.

## Subscription & Licensing
A multi-tier subscription system offers AI agent subscriptions with consultant license tracking, revenue sharing, and AI credits. An employee licensing system tracks team member licenses. Stripe integration manages subscriptions, provisioning, webhooks, and Stripe Connect. Dual payment channels (Stripe Connect for revenue sharing, Direct Links for 100% consultant commission) are supported with payment channel consistency. Bronze users can securely upgrade via token-based authentication.

## Content Marketing Studio
Provides AI-powered tools for content idea generation, social media copy, a 6-step campaign builder, AI image generation, and content organization with a calendar and brand asset management.

### Content Studio Ideas - Wizard UI
Redesigned idea generation form with:
- **3-Step Accordion Structure**: Brand & Target, Objective & Format, Brand Voice & Contesto (collapsed by default)
- **Progress Bar**: Visual completion tracker for required fields (topic, targetAudience, objective)
- **Compact Pill Buttons**: Awareness/Sophistication levels as colored pills instead of cards
- **Sticky Action Bar**: Generate/Save/Load buttons always visible at bottom
- **CSS Grid Animations**: Smooth expand/collapse using grid-rows-[1fr]/grid-rows-[0fr] technique
- **Brand Voice Integration**: Optional toggle to include brand identity (business info, USP, credentials, services) in AI prompts
- **Knowledge Base Integration**: Optional document selector with token counter (50k limit) to enrich AI context

### Reusable Brand Voice Components
Shared components in `client/src/components/brand-voice/`:
- **BrandVoiceSection**: 4 collapsible cards (Business Info, Authority, Credentials, Services) with Import from Agent functionality
- **KnowledgeBaseSelector**: Document picker with checkbox selection and token counter (50k limit warning)
- Used in: Content Studio Ideas, Consultant AI Config page

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

**Semantic Category Filter (ALWAYS, not just ranking) (query-planner.ts)**
- **Problem Fixed**: "Quali pizze sono più profittevoli" was using `product_name ILIKE '%pizza%'` instead of proper category filtering
- **detectCategoryTermInQuestion()**: Detects category terms in ANY query, not just ranking queries
- **SEMANTIC FILTER (PREFERRED)**: When user says "pizze", system injects `category='Pizza'` filter
  - `_semanticCategoryFilter` object contains `{ logicalRole: 'category', value: 'Pizza' }`
  - Resolved to physical column: first tries 'category' logical role, then 'subcategory' as fallback
  - Example: "Quali pizze sono più profittevoli" → `WHERE category = 'Pizza' GROUP BY product_name ORDER BY gross_margin DESC`
- **FALLBACK (ILIKE)**: Only used if no 'category'/'subcategory' column is mapped in dataset
- **CATEGORY_TERMS Dictionary**: Maps user terms to category values (pizze → 'Pizza', bevande → 'Bevande', etc.)

**Semantic Order-By Detection (query-planner.ts)**
- **detectSemanticOrderByMetric()**: Maps user intent keywords to correct ORDER BY metric
- **Keyword → Metric Mapping**:
  - "profittevoli", "margine", "guadagno" → ORDER BY gross_margin DESC
  - "venduti", "quantità", "volume" → ORDER BY quantity DESC
  - "fatturato", "incasso", "ricavo" → ORDER BY revenue DESC
  - "peggiori", "meno venduti" → ASC direction
- **Gated Application**: Only applied when ranking intent detected (più/meno, migliori/peggiori, top N, classifica)
- **Order Enforced**: FILTER → GROUP → AGGREGATE → ORDER → LIMIT (never the reverse)

### Universal Semantic Layer (Enterprise-Grade)
A domain-agnostic semantic layer supporting any CSV/Excel dataset (POS, DDT, invoices, e-commerce, ERP):

**18 Logical Roles:**
- `document_id`: Universal document identifier (DDT, orders, invoices, receipts)
- `line_id`: Line/detail row identifier
- `revenue_amount`: Final revenue per line (post-discount, ready to sum)
- `price`, `cost`, `quantity`: Core financial columns
- `product_id`, `product_name`, `category`: Product data
- `customer_id`, `customer_name`: Customer data
- `supplier_id`, `supplier_name`: Supplier data
- `order_date`, `payment_method`, `status`, `warehouse`, etc.

**Alias System:**
- `document_id` ↔ `order_id` are interchangeable
- Metrics work regardless of which is mapped
- Example: `idddt` (DDT) or `order_id` (POS) both satisfy `{document_id}`

**Flexible Auto-Detect Patterns:**
- Patterns match variations: `prezzofinale`, `prezzofinaleultra`, `prezzo_finale_2`
- No strict ending required (removed $ anchor from regex)
- Italian and English column names supported

**Metrics Use Logical Roles Only:**
- `revenue = SUM({revenue_amount})` - never hard-coded column names
- `document_count = COUNT(DISTINCT {document_id})`
- `ticket_medio = SUM({revenue_amount}) / COUNT(DISTINCT {document_id})`

**Pre-validation:**
- Analytics blocked until core mappings confirmed
- Monetary column warnings prevent wrong revenue calculations
- Clear error messages: "Manca: Importo Fatturato (Totale Riga)"

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