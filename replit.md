# Overview
This full-stack web application serves as a comprehensive consultation platform, connecting consultants with clients to facilitate exercise assignments, progress tracking, and performance analytics. It integrates an AI assistant for personalized financial insights, leveraging real-time financial data for context-aware advice. The platform also offers advanced client management, communication tools, and a robust AI knowledge base system, aiming to enhance consultant-client interactions and streamline financial guidance for improved client outcomes and consultant efficiency.

# User Preferences
Preferred communication style: Simple, everyday language.
User requested "obsessive-compulsive" attention to detail when verifying what works and what doesn't.

# System Architecture
## Core Technologies
- **Frontend**: React 18, TypeScript, Vite, TanStack React Query, Wouter, shadcn/ui, Tailwind CSS, React Hook Form, Zod.
- **Backend**: Express.js, TypeScript, JWT, bcrypt, PostgreSQL (Drizzle ORM), Multer.
## Data Management
- **Database**: PostgreSQL (Supabase) with Drizzle ORM.
- **Schema**: Supports users, exercises, assignments, submissions, consultations, goals, and analytics.
## Authentication & Authorization
- **JWT tokens** for client-side authentication.
- **Role-based access control** (consultant/client/super_admin) via middleware.
- **Secure password handling** using bcrypt.
- **Super Admin System**: Centralized management with global OAuth and TURN server configurations.
  - **SuperAdmin Gemini API Keys**: Centralized, encrypted key management with a 3-tier priority system (SuperAdmin keys → User keys → Environment variable fallback).
## UI/UX Decisions
- Modern, accessible, and responsive design using `shadcn/ui` and `Tailwind CSS`.
- Interactive guided tours via `Driver.js` for onboarding.
- Categorized Sidebar Navigation for consultants with state persistence.
## AI Integration
- **Percorso Capitale**: Provides personalized financial insights, designed for graceful degradation, with a daily pre-fetch scheduler to warm cache.
- **AI Knowledge Base System**: Allows consultants and clients to upload documents (PDF, DOCX, TXT) and configure external API integrations for AI context. Features include text extraction, indexing, priority-based ranking, and multi-tenant isolation.
- **Gemini File Search Integration (RAG)**: Implements semantic document retrieval using Google's native File Search for advanced RAG. Each consultant has a dedicated `FileSearchStore`, with automatic syncing from library documents and support for mixed-role users. FileSearch tool automatically integrated into `generateContent` calls with citations.
  - **Privacy Isolation (Dec 2025)**: Sensitive client data (consultations, financial data, exercise responses) are stored in CLIENT PRIVATE stores, not consultant shared stores. Consultants can query all their clients' stores, but clients can only see their own store. Uses `getOrCreateClientStore()` with strict fallback prevention. Reset endpoint available at `/api/file-search/reset-stores` for migration.
  - **Mixed-Role User Fix (Dec 2025)**: For Email Condivisa users who are both consultants AND clients of another consultant, AI chat now correctly uses the active profile role (from JWT) instead of database user.role. This ensures mixed-role users see the correct FileSearch store based on their active profile (client store when in client mode, consultant store when in consultant mode).
- **Echo - AI Consultation Summary Agent**: Automatically generates consultation summary emails and extracts actionable tasks from Fathom transcripts, with an approval workflow. Tasks remain `draft` until email approval/sending or saving for AI context.
- **AI System Prompt Architecture**: All AI endpoints use `buildSystemPrompt()` from `server/ai-prompts.ts` as `systemInstruction` for comprehensive context.
- **Token Optimization Strategy**: Hybrid approach using intent detection, conditional database queries, intent-scoped caching, dynamic exercise scraping limits, and File Search RAG to significantly reduce AI token consumption.
- **WhatsApp Business Integration**: Full-featured WhatsApp messaging via Twilio with AI-powered responses, rich media, and automatic API key rotation. Includes multi-tenant configuration, dual message delivery, message debouncing, and Gemini AI responses.
- **Per-Agent Google Calendar Integration (Dec 2025 Refactored)**: Each WhatsApp agent operates with COMPLETE INDEPENDENCE - no fallback to consultant-level settings. Agent calendars are configured in the AgentProfilePanel sidebar (not the wizard). Features include:
  - **Mandatory Agent Calendar**: Booking is disabled for agents without their own calendar connected. `/api/calendar/available-slots` returns 400 error with `AGENT_CONFIG_REQUIRED` code when agentConfigId is not provided.
  - **Agent-Specific Availability Settings**: Each agent has its own timezone, appointment duration, buffer times (before/after), min hours notice, max days ahead, and per-day working hours stored in `consultantWhatsappConfig` table.
  - **Isolated Booking Data**: Available slots calculated from agent-specific `appointmentBookings` (joined with `whatsappConversations` filtered by agentConfigId) + agent's Google Calendar events. Consultant-level tables (`consultations`, `consultantCalendarSync`, `consultantAvailabilitySettings`) are no longer used when agentConfigId is provided.
  - **UI Configuration**: AgentAvailability.tsx provides full configuration UI for all availability settings.
  - OAuth tokens stored per-agent in `consultant_whatsapp_config` table. Requires 5 OAuth redirect URIs in Google Cloud Console (Drive x2, Calendar x2, plus JS origin).
- **Sales Agent Configuration**: Configurable AI agent execution for sales phases (Discovery, Demo) with dynamic token usage optimization, intelligent personality profiling, and sequentially validated scripts.
- **Human Seller Analytics & Session Persistence**: Unified analytics for AI agents and human sellers, with session state (transcripts, checkpoints, phases) stored and restored.
- **Checkpoint Validation System**: 3-tier status system (VALIDATED, VAGUE, MISSING) for sales coaching, with sticky validation logic.
- **Gemini Model Configuration**: Dynamic model selection based on provider type (Google AI Studio uses `gemini-3-flash-preview`, Vertex AI uses `gemini-2.5-flash`). Prioritizes SuperAdmin Gemini Keys for Gemini 3 capabilities. Includes specific exclusions for speed/use cases.
- **Video Copilot Turn-Taking System**: Prevents API bombardment during video meetings via intelligent turn-taking using a state machine and client-side VAD.
- **WebRTC/WebSocket Resilience System**: Implements heartbeat, exponential backoff reconnection, and network change detection for robust connectivity.
- **AI-Driven Follow-up Automation System**: 100% AI-driven follow-up system without hardcoded rules. AI acts as an expert sales consultant, guided by per-consultant preferences (max follow-ups, delay, aggressiveness, custom instructions, etc.) but maintains decision autonomy.
- **Booking Extraction Accumulator Pattern (Dec 2025)**: Prevents booking data loss during AI re-extraction cycles. Uses `booking_extraction_state` table to progressively accumulate extracted fields (date, time, phone, email, name) across multiple extraction attempts. Key features:
  - **Merge Strategy**: New extracted values only overwrite if non-null, preserving previously captured data
  - **Auto-Cleanup**: State marked completed after successful booking creation, auto-expires after 24h of inactivity
  - **Integration**: Applied to both WhatsApp conversations and public link flows via `extractBookingDataFromConversation()` options

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