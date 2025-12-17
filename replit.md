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
## UI/UX Decisions
- Uses `shadcn/ui` and `Tailwind CSS` for modern, accessible, and responsive design.
- Interactive guided tours via `Driver.js` for onboarding.
- Categorized Sidebar Navigation for consultants with state persistence.
## AI Integration - Percorso Capitale
- Provides personalized financial insights using real-time financial data. Designed for graceful degradation.
## AI Knowledge Base System
- Enables both consultants and clients to upload internal documents (PDF, DOCX, TXT) and configure external API integrations for AI context. Features include automatic text extraction, indexing, priority-based ranking, document preview, optional AI summaries, custom tags, and usage tracking.
- Multi-tenant isolation ensures data privacy.
- Supports a "Focused Document" feature for context-aware AI responses.
- Client Knowledge Base mirrors consultant implementation with identical features.
## Advanced Consultation Management System
- **AI-powered Email Automation**: Generates personalized motivational emails via Google Gemini, requiring consultant approval.
- **AI-Powered Client State Tracking**: Analyzes system context to generate current and ideal client states.
## AI System Prompt Architecture
- All AI endpoints **MUST** use `buildSystemPrompt()` from `server/ai-prompts.ts` as `systemInstruction` for Gemini to ensure comprehensive context.
## Token Optimization Strategy
- Hybrid approach focusing on intent detection, conditional database queries, intent-scoped caching, and dynamic exercise scraping limits to reduce AI token consumption.
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
## Gemini Live API Configuration
- **Model**: `gemini-live-2.5-flash-native-audio` (GA - December 12, 2025)
- **Platform**: Vertex AI
- **Features**: Native audio (30 HD voices, 24 languages), Affective Dialog, improved barge-in, robust function calling, session resumption, proactive audio (preview).
- **Post-Resume Silence**: AI audio output is suppressed after WebSocket reconnection until the user speaks first to prevent erroneous responses.
## Video Copilot Turn-Taking System
- Prevents API bombardment during video meetings via intelligent turn-taking using a state machine and `SpeakerTurnBuffer`. Triggers transcription on silence detection and finalizes turns on speaker change. Reduces API calls through client-side VAD.
## WebRTC/WebSocket Resilience System
- Implements WebSocket heartbeat, exponential backoff reconnection with jitter, and network change detection. Handles visibility changes, monitors connection quality, and ensures participant cleanup.
## Human-Like AI Follow-up System Hardening
- Automatic rejection detection, template-only responses after a template if no reply, reliable template detection, and validation of AI updates. Includes a safety net for max follow-up limits and detailed conversation context detection for AI prompts.

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