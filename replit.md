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
- **Super Admin System**: Centralized management of consultants and clients, with global OAuth and TURN server configurations. All admin actions are logged.
  - **SuperAdmin Gemini API Keys**: Centralized Gemini API key management via `/api/admin/superadmin/gemini-config`. Keys are encrypted and stored in `superadminGeminiConfig` table. Consultants can opt-in via `useSuperadminGemini` field to use centralized keys instead of personal ones. 3-tier priority: SuperAdmin keys → User keys → Environment variable fallback.
## UI/UX Decisions
- Uses `shadcn/ui` and `Tailwind CSS` for modern, accessible, and responsive design.
- Interactive guided tours via `Driver.js` for onboarding.
- Categorized Sidebar Navigation for consultants with state persistence.
## AI Integration - Percorso Capitale
- Provides personalized financial insights using real-time financial data. Designed for graceful degradation.
- **Daily Pre-fetch Scheduler**: Runs at 6:00 AM to warm cache for all users with active finance settings, eliminating per-prompt latency (~16s reduction).
- **External Services Sidebar**: ContractAle, ConOrbitale, CrmAle links + configurable SiteAle URL per user.
## AI Knowledge Base System
- Enables both consultants and clients to upload internal documents (PDF, DOCX, TXT) and configure external API integrations for AI context. Features include automatic text extraction, indexing, priority-based ranking, document preview, optional AI summaries, custom tags, and usage tracking.
- Multi-tenant isolation ensures data privacy.
- Supports a "Focused Document" feature for context-aware AI responses.
- Client Knowledge Base mirrors consultant implementation with identical features.
## Gemini File Search Integration (RAG)
- **Google File Search API**: Implements semantic document retrieval using Google's native File Search capabilities for advanced RAG (Retrieval Augmented Generation).
- **Architecture**:
  - Each consultant has their own FileSearchStore for their documents
  - Clients access their consultant's store + system-wide documents
  - Documents are automatically synced when uploaded to knowledge base
  - **Mixed-role support**: Users who are both consultants AND clients access both their own stores AND their parent consultant's stores
- **Key Components**:
  - `server/ai/file-search-service.ts`: Core service with CRUD operations, chunking config, citation parsing, and 3-tier Gemini API key system (`getClientForUser(userId)`)
  - `server/services/file-search-sync-service.ts`: Auto-syncs libraryDocuments to FileSearchStore with SSE progress events. Supports cascade sync: when library documents sync, linked university lessons auto-update via `syncUniversityLesson(forceUpdate=true)`
  - `server/routes/file-search.ts`: API routes for stores management, sync, and SSE real-time updates. Analytics endpoint uses `isApiKeyConfigured(userId)` for 3-tier key verification
- **Database Tables**: `file_search_stores`, `file_search_documents` for tracking indexed content
- **AI Integration**: FileSearch tool is automatically added to all `generateContent` calls when stores are available, enabling semantic retrieval with automatic citations.
- **Real-time Sync Progress**: SSE endpoint `/api/file-search/sync-events` streams sync progress with heartbeat
- **Hierarchical Analytics UI**: Contents organized by category (Library by type, University by Year>Trimester>Module>Lesson, KB by format, Exercises by category, Consultations by client)
- **Client Documents Page**: Clients can view all AI-accessible documents at `/client/documents`
## Advanced Consultation Management System
- **AI-powered Email Automation**: Generates personalized motivational emails via Google Gemini, requiring consultant approval.
  - **File Search Integration in Emails**: `generateMotivationalEmail` and `generateConsultationSummaryEmail` (in `server/ai/email-template-generator.ts`) automatically switch to Google AI Studio when File Search stores are available, enabling semantic retrieval with Gemini 3 Flash Preview + thinkingConfig. Falls back to normal 3-tier provider system if Google AI Studio is unavailable.
- **AI-Powered Client State Tracking**: Analyzes system context to generate current and ideal client states.
## AI System Prompt Architecture
- All AI endpoints **MUST** use `buildSystemPrompt()` from `server/ai-prompts.ts` as `systemInstruction` for Gemini to ensure comprehensive context.
## Token Optimization Strategy
- Hybrid approach focusing on intent detection, conditional database queries, intent-scoped caching, and dynamic exercise scraping limits to reduce AI token consumption.
- **File Search RAG Token Reduction**: When File Search is enabled (`hasFileSearch=true`), large data sections are excluded from system prompts and retrieved on-demand via semantic search:
  - University lessons: Excluded from prompt, available via RAG
  - Exercises and consultations: Excluded from prompt, available via RAG
  - Financial data (Percorso Capitale): Excluded from prompt, available via RAG
  - This reduces token consumption from ~111k to ~15-20k per request
- **Financial Data Sync**: Client financial data from Percorso Capitale can be synced to the client's private FileSearchStore via `/api/file-search/sync-financial/:clientId`. UI available in File Search Analytics page.
- **Roadmap Removed**: Roadmap data was removed from context builder as it was loaded but never used in prompts.
## WhatsApp Business Integration
- Full-featured WhatsApp messaging via Twilio API with AI-powered responses, rich media, and automatic API key rotation. Includes multi-tenant config, dual message delivery, message debouncing, Gemini AI responses, client/lead recognition, real-time dashboard, objection detection, dynamic client profiling, and proactive lead management.
- Supports dynamic document/knowledge management for WhatsApp AI agents.
- **AI Idea Generation System**: Vertex AI-powered idea generator that creates WhatsApp agent concepts from various inputs, supporting different agent and integration types.
## Sales Agent Configuration
- Users can configure AI agent execution for sales phases (Discovery, Demo), optimizing token usage dynamically.
- **Prospect Profiling System**: Intelligent personality profiling during voice calls with dynamic sales strategy adaptation, including sticky archetype logic and specific playbooks.
- AI sales agents follow strict, sequentially validated scripts.
## Human Seller Analytics & Session Persistence
- Unified analytics for AI agents and human sellers. Session state (transcripts, checkpoints, phases) stored in the database with debounced saves and automatic restoration.
## Checkpoint Validation System (Sales Coaching)
- 3-tier status system (VALIDATED, VAGUE, MISSING) with sticky validation logic and manual validation via UI. AI skips already-validated items.
## Gemini Model Configuration
- **Dynamic Model Selection**: Model is selected based on provider type:
  - **Google AI Studio**: Uses `gemini-3-flash-preview` with `thinkingConfig: { thinkingLevel: "low" }` inside `config` object
  - **Vertex AI**: Uses `gemini-2.5-flash` (stable, as Gemini 3 may not be enabled in all Vertex AI projects)
- **Model Selection Functions** (in `server/ai/provider-factory.ts`):
  - `getModelWithThinking(providerName)`: **RECOMMENDED** - Returns `{ model, useThinking, thinkingLevel }` for full Gemini 3 support
  - `getTextChatModel(providerName)`: Returns model name and useThinking flag
  - `getModelForProviderName(providerName)`: Legacy, returns model name only
- **ThinkingConfig Pattern**: 
  - **Google AI Studio (@google/genai)**: `config: { thinkingConfig: { thinkingLevel } }` (inside config)
  - **Vertex AI adapter**: `generationConfig: { thinkingConfig: { thinkingLevel } }` (inside generationConfig)
- **Live API Model**: `gemini-live-2.5-flash-native-audio` (GA - December 12, 2025) - Gemini 3 NOT supported
- **Platform**: Vertex AI or Google AI Studio (determined by 3-tier priority system)
- **Features**: Native audio (30 HD voices, 24 languages), Affective Dialog, improved barge-in, robust function calling, session resumption, proactive audio (preview).
- **Post-Resume Silence**: AI audio output is suppressed after WebSocket reconnection until the user speaks first to prevent erroneous responses.
- **Exclusions** (intentionally use legacy models for speed/specific use):
  - `server/ai/sales-manager-agent.ts`: Uses `gemini-2.5-flash-lite`
  - `server/ai/step-advancement-agent.ts`: Uses `gemini-2.5-flash-lite`
  - `server/ai/gemini-training-analyzer.ts`: Uses `gemini-2.5-pro`
  - `server/ai/gemini-live-ws-service.ts`: Live API (Gemini 3 not supported)
## Video Copilot Turn-Taking System
- Prevents API bombardment during video meetings via intelligent turn-taking using a state machine and `SpeakerTurnBuffer`. Triggers transcription on silence detection and finalizes turns on speaker change. Reduces API calls through client-side VAD.
## WebRTC/WebSocket Resilience System
- Implements WebSocket heartbeat, exponential backoff reconnection with jitter, and network change detection. Handles visibility changes, monitors connection quality, and ensures participant cleanup.
## AI-Driven Follow-up Automation System
- **100% AI-Driven**: The follow-up system is fully AI-powered without hardcoded rules. The AI acts as an expert sales consultant ("Marco") evaluating each conversation independently.
- **Consultant Preferences**: Table `consultant_ai_preferences` stores per-consultant settings:
  - `maxFollowupsTotal`, `minHoursBetweenFollowups`, `firstFollowupDelayHours`, `templateNoResponseDelayHours`
  - `aggressivenessLevel` (1-10), `persistenceLevel` (1-10)
  - `customInstructions` - free-text field for personalized AI behavior
  - `stopOnFirstNo` - whether to stop immediately on rejection
- **Preference Integration**: Preferences are loaded in `evaluateWithHumanLikeAI()` and included in the AI prompt as guidelines (not rigid rules). The AI maintains decision autonomy.
- **UI**: `AIPreferencesEditor` component in consultant-automations page allows adjusting numeric preferences and custom instructions.
- **Scheduler**: Uses AI-ONLY mode, requiring only active WhatsApp configuration (no database rules needed).
- **Human-Like AI Follow-up System Hardening**: Automatic rejection detection, template-only responses after a template if no reply, reliable template detection, and validation of AI updates. Includes a safety net for max follow-up limits and detailed conversation context detection for AI prompts.

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