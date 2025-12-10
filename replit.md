# Overview
This full-stack web application is a consultation platform connecting consultants with clients. It facilitates exercise assignment, progress tracking, and performance analytics. The platform aims to provide personalized financial insights via an integrated AI assistant, leveraging real-time financial data for context-aware advice, alongside advanced client management and communication tools.

# User Preferences
Preferred communication style: Simple, everyday language.
User requested "obsessive-compulsive" attention to detail when verifying what works and what doesn't.

# System Architecture
## Core Technologies
- **Frontend**: React 18, TypeScript, Vite, TanStack React Query, Wouter, shadcn/ui, Tailwind CSS, React Hook Form, Zod.
- **Backend**: Express.js, TypeScript, JWT, bcrypt, PostgreSQL (Drizzle ORM), Multer.
## Data Management
- **Database**: PostgreSQL (Supabase) with Drizzle ORM (node-postgres adapter) and pgBouncer for connection pooling.
- **Alternative Storage**: CSV and Excel.
- **File Storage**: Dedicated system for exercise attachments and user uploads.
- **Schema**: Supports users, exercises, assignments, submissions, consultations, goals, and analytics.
## Authentication & Authorization
- **JWT tokens** for client-side authentication.
- **Role-based access control** (consultant/client) via middleware.
- **Secure password handling** using bcrypt.
- **Protected API endpoints** with token validation.
## UI/UX Decisions
- Uses `shadcn/ui` and `Tailwind CSS` for a modern, accessible, and responsive design.
- Interactive guided tours via `Driver.js` for onboarding and feature explanation, with Italian localization and custom styling.
- **Categorized Sidebar Navigation** (consultant view): Organizes features into 6 semantic categories with collapsible sections. Sidebar state persists in localStorage.
## AI Integration - Percorso Capitale
- **Purpose**: Provides personalized financial insights by accessing real-time financial data.
- **Data Flow**: AI assistant uses `buildUserContext()` to fetch data via `PercorsoCapitaleClient.getInstance()`.
- **Caching**: L1 (User Context) 5-minute TTL, L2 (API Response) endpoint-specific TTLs.
- **Singleton Pattern**: Ensures a single client instance per user email.
- **Graceful Degradation**: AI assistant remains functional if Percorso Capitale API is unavailable.
## Advanced Consultation Management System
- **AI-powered Email Automation**: Generates personalized motivational emails using Google Gemini, requiring consultant approval. Features per-consultant SMTP and Gemini API key rotation.
- **AI-Powered Client State Tracking**: Generates client current and ideal states from AI analysis of system context.
- **Fathom Integration**: Links for consultation recordings stored in the consultations table.
## AI System Prompt Architecture
- **Critical Rule**: All AI endpoints **MUST** use `buildSystemPrompt()` from `server/ai-prompts.ts` as `systemInstruction` for Gemini, ensuring comprehensive context.
- **Consultation Summary Emails**: `consultations.summaryEmail` must be included in all AI features to maintain context continuity.
## Token Optimization Strategy (Hybrid Approach)
- **Goal**: Reduce AI token consumption by 70-85%.
- **Methodology**: Intent detection, conditional database queries, intent-scoped caching, dynamic exercise scraping limits.
- **Future Scaling (RAG)**: Planned for high document counts/token usage, involving query embedding, vector search, context assembly, and focused AI response generation using Google Gemini Embedding API.
## WhatsApp Business Integration (Via Twilio)
- **Overview**: Full-featured WhatsApp messaging via Twilio API for client/lead conversations with AI-powered responses, rich media, and automatic API key rotation.
- **Key Features**: Multi-tenant config, dual message delivery (webhook + polling fallback), message debouncing, Gemini AI responses with user context, client/lead recognition, API key rotation, rich media processing, real-time dashboard, manual messaging, AI toggle.
- **Objection Detection & Client Profiling**: AI system detects and classifies client objections, maintains dynamic client difficulty profiles, and adapts AI response strategies.
- **Calendar Configuration System**: `ai_availability` and `appointment_availability` settings in `consultant_availability_settings` JSONB field.
- **Proactive Lead Management System**: Automated outreach to cold leads using pre-approved WhatsApp templates.
- **Knowledge Base System**: Dynamic document/knowledge management for WhatsApp AI agents.
- **Database Schema**: 9 tables for WhatsApp config, conversations, messages, API keys, media, stats, and follow-ups. Additional tables for objection tracking, client profiling, availability, calendar sync, appointments, proactive leads, and knowledge items.
## Sales Agent Configuration
- Users can configure which sales phases the AI agent executes (Discovery, Demo).
- Sales Agent AI token usage is optimized through dynamic script loading based on the current phase.
- **Prospect Profiling System**: Intelligent prospect personality profiling during voice calls with dynamic sales strategy adaptation using a hybrid regex and AI intuition approach. Includes sticky archetype logic and 8 behavioral archetypes with specific playbooks. Integrates with TTS for archetype-specific voice parameters.
- AI sales agent follows scripts in strict sequential order, programmatically enforced with validation.
## Human Seller Analytics & Session Persistence
- **Unified Analytics Component**: Single reusable `client-sales-agent-analytics.tsx` serves both AI agents and human sellers
- **Entity Type Detection**: URL path determines entity type (`/client/sales-agents/` → AI, `/client/human-sellers/` → human)
- **Session State Persistence**: `humanSellerMeetingTraining` table stores full session state (transcripts, checkpoints, phases)
- **Debounced Saves**: 5-second debounce prevents excessive database writes during active sessions
- **Recovery on Reconnect**: Sessions automatically restore from database when human seller reconnects
- **API Parity**: Human seller training endpoints match AI agent format for consistent frontend consumption

## Checkpoint Validation System (Sales Coaching)
- **3-Tier Status System**: VALIDATED (green), VAGUE (yellow), MISSING (red)
- **Sticky Validation Logic**: Both VALIDATED and VAGUE statuses are sticky - they NEVER downgrade to a lower status
  - VALIDATED → stays VALIDATED forever (cannot become VAGUE or MISSING)
  - VAGUE → can only upgrade to VALIDATED (cannot become MISSING)
- **State Rehydration**: Frontend sends `request_state_sync` on WebSocket connect; backend broadcasts saved transcripts, checkpoints, script progress, archetype data
- **Manual Checkpoint Validation**: Users can manually validate checkpoint items via UI checkboxes
  - Frontend: `useSalesCoaching.manualValidateCheckpoint` + `useVideoCopilot.sendManualValidateCheckpoint`
  - Backend: `handleManualValidateCheckpoint` with immediate persistence (no debounce)
  - Uses same sticky storage mechanism as AI pipeline (`session.validatedCheckpointItems`)
- **Persistence Flow**: `session.validatedCheckpointItems` → `saveSessionStateImmediate` → `humanSellerMeetingTraining.validatedCheckpointItems`
- **AI Integration**: AI skips already-validated items (line 1661-1663 in sales-manager-agent.ts) and respects sticky validations

## Video Copilot Turn-Taking System
- **Purpose**: Prevent API bombardment (429 errors) during human-to-human video meetings by implementing Fathom-style intelligent turn-taking.
- **Architecture**: State machine with per-meeting TurnState tracking audio buffers per speaker.
- **Key Components**:
  - `SpeakerTurnBuffer`: Accumulates audio chunks, transcript parts, and speaker metadata.
  - `TurnState`: Tracks current/previous speakers, silence timers, and analysis debounce timers.
  - `handleAudioChunk`: Buffers audio instead of immediate transcription.
  - `handleSilenceDetected`: Triggers transcription after 700ms silence.
  - `finalizeTurn`: Completes speaker turn on speaker change.
  - `scheduleAnalysis`: Triggers Sales Manager analysis with 2s debounce after turn exchange.
- **Configuration**: `TURN_TAKING_CONFIG` with tunable thresholds (SILENCE_THRESHOLD_MS=700, ANALYSIS_DEBOUNCE_MS=2000, MAX_TIME_WITHOUT_ANALYSIS_MS=30000).
- **Error Handling**: `withRetry` wrapper with exponential backoff for all Gemini API calls (max 5 retries, 1s-30s delays).
- **Cleanup**: Proper timer and state cleanup in `handleEndSession` prevents memory leaks.
- **Result**: Reduces API calls from ~50/second to 2-3 per conversation turn.
- **Client-Side VAD (Voice Activity Detection)**:
  - **Hook**: `useVADAudioCapture.ts` with Silero VAD neural network via `@ricky0123/vad-web`.
  - **Host Detection**: Silero MicVAD directly on local microphone stream with 500ms pre-roll buffer.
  - **Prospect Detection**: RMS-based VAD fallback using ScriptProcessor (SPEECH_THRESHOLD=0.01, SILENCE_FRAMES=12).
  - **Audio Processing**: 16kHz downsampling for Gemini compatibility, echo cancellation enabled.
  - **Trust-the-Client Pattern**: Server transcribes immediately on `speech_end` event from client VAD (eliminates 1.2s double-wait latency).
  - **WebSocket Events**: `speech_start` / `speech_end` messages with speakerId and speakerName metadata.
  - **Server Handlers**: `handleSpeechStart` (buffer management), `handleSpeechEndFromClient` (immediate transcription with isPartial=false).

# External Dependencies
- **Supabase**: PostgreSQL hosting.
- **Recharts**: Data visualization.
- **Date-fns**: Date manipulation.
- **Radix UI**: Accessible UI primitives.
- **Google Fonts**: Inter, Poppins, DM Sans, Fira Code.
- **Lucide React**: Iconography.
- **Google Gemini API**: AI-powered features (email generation, client state tracking, general AI assistant, objection detection).
- **Percorso Capitale API**: Financial management system integration.
- **Fathom**: AI-powered consultation recording and transcription.
- **Driver.js**: Interactive guided tours and onboarding.
- **Twilio API**: WhatsApp Business messaging.