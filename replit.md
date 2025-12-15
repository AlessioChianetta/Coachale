# Overview
This full-stack web application is a consultation platform connecting consultants with clients, facilitating exercise assignment, progress tracking, and performance analytics. It provides personalized financial insights via an integrated AI assistant, leveraging real-time financial data for context-aware advice, alongside advanced client management and communication tools. The platform aims to enhance consultant-client interactions and streamline financial guidance.

# User Preferences
Preferred communication style: Simple, everyday language.
User requested "obsessive-compulsive" attention to detail when verifying what works and what doesn't.

# System Architecture
## Core Technologies
- **Frontend**: React 18, TypeScript, Vite, TanStack React Query, Wouter, shadcn/ui, Tailwind CSS, React Hook Form, Zod.
- **Backend**: Express.js, TypeScript, JWT, bcrypt, PostgreSQL (Drizzle ORM), Multer.
## Data Management
- **Database**: PostgreSQL (Supabase) with Drizzle ORM and pgBouncer.
- **Alternative Storage**: CSV and Excel.
- **Schema**: Supports users, exercises, assignments, submissions, consultations, goals, and analytics.
## Authentication & Authorization
- **JWT tokens** for client-side authentication.
- **Role-based access control** (consultant/client/super_admin) via middleware.
- **Secure password handling** using bcrypt.
- **Super Admin System**: Centralized management of all consultants and clients.
  - Super Admin credentials: `alessioadmin@gmail.com` / `aaa1aaa2`
  - Routes: `/admin`, `/admin/hierarchy`, `/admin/users`, `/admin/settings`
  - APIs: `/api/admin/*` (stats, hierarchy, users, settings, audit-log)
  - Global Google Drive/Calendar OAuth configuration stored in `systemSettings` table
  - Global Video Meeting OAuth configuration stored in `systemSettings` table (centralized for scalability)
  - **Global TURN Server Configuration** stored in `adminTurnConfig` table (centralized for WebRTC)
    - Supports providers: Metered.ca, Twilio, Custom
    - Zero-config for consultants: they automatically inherit admin TURN settings
    - Fallback chain: Consultant config → Admin config → STUN only
    - APIs: `GET/PUT/DELETE /api/admin/turn-config`
  - All admin actions logged in `adminAuditLog` table
  - Consultants receive read-only access to global OAuth settings via `/api/consultant/google-oauth`
## UI/UX Decisions
- Uses `shadcn/ui` and `Tailwind CSS` for modern, accessible, and responsive design.
- Interactive guided tours via `Driver.js` for onboarding.
- Categorized Sidebar Navigation for consultants with state persistence.
## AI Integration - Percorso Capitale
- Provides personalized financial insights using real-time financial data.
- Employs L1/L2 caching and a Singleton pattern for API client instance.
- Designed for graceful degradation if the Percorso Capitale API is unavailable.
## AI Knowledge Base System
- Enables both consultants AND clients to upload internal documents (PDF, DOCX, TXT) and configure external API integrations for AI context.
- AI assistant has full, unfiltered access to all uploaded documents and API data.
- Features automatic text extraction, indexing, priority-based ranking, document preview, optional AI summaries, custom tags, and usage tracking.
- Supports various API authentication types and per-consultant API key encryption.
- Multi-tenant isolation ensures each user only accesses their own knowledge base.
- Integrates knowledge context into AI system prompts without filtering.
- **Focused Document Feature**: Users can click "Chiedimi qualcosa" on a document to open AI Assistant with auto-message and document focus. The `focusedDocument` is passed through the entire pipeline (frontend → API → context builder → AI prompts) to provide context-aware responses.
- **Full CLIENT Parity**: Client Knowledge Base mirrors consultant implementation with identical features: document upload, API integrations, AI prompt injection, usage tracking, priority display, and summary badges.
## Advanced Consultation Management System
- **AI-powered Email Automation**: Generates personalized motivational emails via Google Gemini, requiring consultant approval, with per-consultant SMTP and Gemini API key rotation.
- **AI-Powered Client State Tracking**: Analyzes system context to generate current and ideal client states.
## AI System Prompt Architecture
- All AI endpoints **MUST** use `buildSystemPrompt()` from `server/ai-prompts.ts` as `systemInstruction` for Gemini to ensure comprehensive context.
- `consultations.summaryEmail` is consistently included in AI features for context continuity.
## Token Optimization Strategy
- Hybrid approach focusing on intent detection, conditional database queries, intent-scoped caching, and dynamic exercise scraping limits to reduce AI token consumption.
- Future plans include RAG for high document/token usage.
## WhatsApp Business Integration
- Full-featured WhatsApp messaging via Twilio API for client/lead conversations with AI-powered responses, rich media, and automatic API key rotation.
- Features multi-tenant config, dual message delivery, message debouncing, Gemini AI responses with user context, client/lead recognition, and a real-time dashboard.
- Includes AI-powered objection detection, dynamic client profiling, and proactive lead management.
- Supports dynamic document/knowledge management for WhatsApp AI agents.
- **AI Idea Generation System**: Vertex AI-powered idea generator that creates WhatsApp agent concepts from uploaded documents, URLs, text descriptions, or existing knowledge base documents.
  - Three agent types: `reactive_lead` (inbound), `proactive_setter` (outbound), `informative_advisor` (consultative)
  - Two integration types: `booking` (appointment scheduling), `consultation` (advisory support)
  - Ideas include personality, whoWeHelp, whoWeDontHelp, whatWeDo, howWeDoIt, usp, suggestedInstructions, useCases
  - Saved ideas grouped by date (Today, Yesterday, This Week, Earlier) using date-fns
  - "Create Agent Now" button pre-populates wizard with idea data via `?fromIdea={id}` query param
  - Supports `ai_only` mode to create agents without Twilio configuration
  - Ideas marked as implemented after agent creation with `implementedAgentId` reference
## Sales Agent Configuration
- Users can configure AI agent execution for sales phases (Discovery, Demo).
- Token usage optimized through dynamic script loading based on the current phase.
- **Prospect Profiling System**: Intelligent personality profiling during voice calls with dynamic sales strategy adaptation using a hybrid regex and AI intuition approach, including sticky archetype logic and specific playbooks.
- AI sales agents follow scripts in strict sequential order with programmatic validation.
## Human Seller Analytics & Session Persistence
- Unified analytics component (`client-sales-agent-analytics.tsx`) for both AI agents and human sellers.
- Session state (transcripts, checkpoints, phases) is stored in `humanSellerMeetingTraining` table with debounced saves.
- Sessions automatically restore from the database upon reconnection.
## Checkpoint Validation System (Sales Coaching)
- 3-tier status system (VALIDATED, VAGUE, MISSING) with sticky validation logic (statuses never downgrade).
- Supports manual checkpoint validation via UI and persistence of validated items.
- AI skips already-validated items during its processing.
## Video Copilot Turn-Taking System
- Prevents API bombardment during video meetings via intelligent turn-taking using a state machine and `SpeakerTurnBuffer`.
- Triggers transcription on silence detection and finalizes turns on speaker change.
- Implements debounced analysis triggers and `withRetry` wrapper for Gemini API calls.
- Reduces API calls significantly through client-side VAD (Voice Activity Detection) using Silero VAD neural network and RMS-based fallback, with immediate server transcription on `speech_end` events.
## WebRTC/WebSocket Resilience System
- Implements WebSocket heartbeat, exponential backoff reconnection with jitter, and network change detection.
- Handles visibility changes by checking WebSocket connections and triggering ICE restarts.
- Monitors connection quality using `pc.getStats()` and automatically restarts ICE on disconnected states.
- Ensures participant cleanup on page unload and server-side zombie cleanup.

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