# Overview

This full-stack web application serves as a fitness consultation platform, connecting fitness consultants with clients for exercise assignment, progress tracking, and performance analytics. Its core ambition is to provide personalized financial insights through an integrated AI assistant, leveraging real-time financial data for context-aware advice, alongside advanced client management and communication tools.

# Recent Changes

## November 20, 2025 - AI Consultation System Enhancements
- **Weekly AI Consultations**: Enhanced system for live AI voice consultations with Gemini Live API
  - **Backend Improvements**:
    - Added GET /api/consultations/ai/all endpoint for consultants to view all consultations grouped by client with user joins
    - Added DELETE /api/consultations/ai/:id endpoint to delete incomplete consultations
    - Implemented robust server-side message tracking to prevent transcript loss during disconnects
    - Added auto-save mechanism that persists transcripts even when clients close unexpectedly
    - AI transcript accumulation happens server-side via currentAiTranscript and currentUserTranscript
    - Message reconciliation logic prevents client updates from overwriting server-built history
  - **System Prompt Updates**:
    - Added consultation timing instructions: warnings at 75/85/90 minutes
    - Prefix consulenza with duration info for AI awareness
  - **Frontend Improvements**:
    - Added "Modalità Test" badge visible during test mode sessions
    - Fixed 90-minute timer: separated conversationTotalTimeRef (never reset) from websocketSessionTimeRef (reset on reconnect)
    - Implemented auto-close after 90 minutes when AI uses closing phrases (arrivederci, addio, etc.)
    - Added "Vedi System Prompt" button in SessionTypeSelector cards with dialog showing complete prompts
  - **Architecture**: Server-side tracking is authoritative; client updates merge rather than replace to prevent transcript loss

## November 18, 2025 - Consultation Summary Email Timeout Fix
- **Problem**: ERR_EMPTY_RESPONSE when generating consultation summary emails via POST /api/consultations/:id/generate-summary-email
- **Root Cause**: The endpoint took ~34 seconds (30s AI generation + 2s draft save + 2s consultation update), exceeding HTTP timeout thresholds
- **Solution**: Refactored endpoint to respond immediately after draft save (~32s), then update consultation in background with dedicated error handling
- **Performance Impact**: Client now receives success response in ~32s instead of timing out at ~34s
- **Monitoring**: Added detailed timing logs ([TIMER] prefixed) to track AI generation, draft save, response time, and background update phases
- **UX Improvement**: Added toast notification ("Generazione in corso...") to inform users the process takes 30-40 seconds

# User Preferences

Preferred communication style: Simple, everyday language.
User requested "obsessive-compulsive" attention to detail when verifying what works and what doesn't.

# System Architecture

## Core Technologies
- **Frontend**: React 18, TypeScript, Vite, TanStack React Query, Wouter, shadcn/ui, Tailwind CSS, React Hook Form, Zod.
- **Backend**: Express.js, TypeScript, JWT, bcrypt, PostgreSQL (Drizzle ORM), Multer.

## Data Management
- **Database**: PostgreSQL (Supabase) with Drizzle ORM (node-postgres adapter), pgBouncer transaction pooling for Supabase free tier compatibility.
- **Connection Pool**: Optimized for serverless (max: 2 connections, 5s timeouts, keepalive enabled).
- **Alternative Storage**: CSV and Excel.
- **File Storage**: Dedicated system for exercise attachments and user uploads.
- **Schema**: Supports users, exercises, assignments, submissions, consultations, goals, and analytics.

## Authentication & Authorization
- **JWT tokens** for client-side authentication (localStorage).
- **Role-based access control** (consultant/client) via middleware.
- **Secure password handling** using bcrypt.
- **Protected API endpoints** with token validation.

## UI/UX Decisions
- Uses `shadcn/ui` and `Tailwind CSS` for a modern, accessible, and responsive design.
- Interactive guided tours via `Driver.js` for onboarding and feature explanation, with Italian localization and custom styling.
- **Categorized Sidebar Navigation** (consultant view): Organizes all features into 6 semantic categories with collapsible sections:
  - **PRINCIPALE**: Dashboard, AI Assistant (always expanded by default)
  - **GESTIONE CLIENTI**: Lista Clienti, Stato & Obiettivi, Task & Feedback, Appuntamenti (expanded by default)
  - **FORMAZIONE**: La Mia Università, Esercizi Assegnati, Template Esercizi, Libreria Corsi
  - **COMUNICAZIONE & MARKETING**: WhatsApp (Conversazioni, Agenti AI, Template Custom/Twilio), Email (Task Automatici, Storico Invii), Lead & Campagne, Campagne Marketing
  - **CONFIGURAZIONE**: Configurazione SMTP, AI Email, Setup WhatsApp Agenti, API Settings Lead, Google Calendar, Impostazioni Calendar
  - **RISORSE**: Guide (WhatsApp, Email Marketing, Università, Gestione Clienti, Google Calendar) with "NEW" badges
- Sidebar category state persists in localStorage, ensuring users' preferences are maintained across sessions.

## AI Integration - Percorso Capitale
- **Purpose**: Provides personalized financial insights by accessing real-time financial data (budgets, transactions, investments, goals).
- **Data Flow**: User configured email links to `userFinanceSettings`, AI assistant uses `buildUserContext()` to fetch data via `PercorsoCapitaleClient.getInstance()`.
- **Caching**: L1 (User Context) 5-minute TTL, L2 (API Response) endpoint-specific TTLs.
- **Singleton Pattern**: Ensures a single client instance per user email.
- **Graceful Degradation**: AI assistant remains functional if Percorso Capitale API is unavailable.

## Advanced Consultation Management System
- **AI-powered Email Automation**: Generates personalized motivational emails using Google Gemini, requiring consultant approval. Features per-consultant SMTP and Gemini API key rotation.
- **AI-Powered Client State Tracking**: Generates client current and ideal states from AI analysis of system context (consultations, tasks, exercises, goals).
- **Fathom Integration**: Links for consultation recordings stored in the consultations table, opening Fathom for AI transcription and analysis.

## AI System Prompt Architecture
- **Critical Rule**: All AI endpoints **MUST** use `buildSystemPrompt()` from `server/ai-prompts.ts` as `systemInstruction` for Gemini, ensuring comprehensive context (financial data, exercise transcriptions, roadmap progress, etc.). Custom prompts are forbidden.
- **Consultation Summary Emails**: `consultations.summaryEmail` must be included in ALL AI features (`buildSystemPrompt()`, `generateMotivationalEmail()`, `generateConsultationSummaryEmail()`) to maintain context continuity.

## Token Optimization Strategy (Hybrid Approach)
- **Goal**: Reduce AI token consumption by 70-85% (to 40-75k).
- **Methodology**:
    1. **Intent Detection**: Analyzes user message to determine required data.
    2. **Conditional Database Queries**: Loads only data relevant to detected intent.
    3. **Intent-Scoped Caching**: Caches data per `clientId-intent` with 5-minute TTL.
    4. **Dynamic Exercise Scraping Limits**: Adjusts content limits based on query specificity.
- **Future Scaling (RAG)**: Planned for high document counts/token usage, involving query embedding, vector search (e.g., Supabase pgvector), context assembly, and focused AI response generation using Google Gemini Embedding API.

## WhatsApp Business Integration (Via Twilio)
- **Overview**: Full-featured WhatsApp messaging via Twilio API for client/lead conversations with AI-powered responses, rich media, and automatic API key rotation. Differentiates between clients and leads.
- **Key Features**: Multi-tenant config, dual message delivery (webhook + 90s polling fallback), 4-second message debouncing, Gemini AI responses with user context, client/lead recognition, API key rotation (up to 50 keys, LRU), rich media processing (images/PDFs/audio), real-time dashboard, manual messaging, AI toggle.
- **Message Delivery**: Primary: Twilio webhook (`POST /api/whatsapp/webhook`) for instant delivery (~2s). Fallback: 90-second polling for reliability (optimized for Supabase free tier database limits).
- **Objection Detection & Client Profiling**: AI system detects and classifies client objections (price, time, trust, etc.), maintains dynamic client difficulty profiles (0-10 scale), and adapts AI response strategies (empathetic for difficult clients, direct for easy). Integrates with `message-processor.ts`.
- **Calendar Configuration System**: Separate `ai_availability` and `appointment_availability` settings in `consultant_availability_settings` JSONB field. AI responses respect `ai_availability` (enabled, working days/hours, timezone) to prevent responses outside configured times, while `appointment_availability` governs client booking windows.
- **Proactive Lead Management System**: Automated outreach to cold leads using pre-approved WhatsApp templates. Features configurable default values (objectives, desires, hook, ideal state) based on Metodo ORBITALE positioning, bulk import endpoint (POST /api/proactive-leads/bulk) with batch validation and detailed error reporting, and scheduled follow-up sequences using 4 Italian WhatsApp templates (opening, gentle follow-up, value follow-up, final follow-up) stored as Content SIDs in consultant_whatsapp_config.
- **Knowledge Base System**: Dynamic document/knowledge management for WhatsApp AI agents. Consultants can upload business-specific documents (PDF/DOCX/TXT) or create text blocks with titles via the Brand Voice wizard step. The system extracts and stores document text in the database for persistence, then injects formatted knowledge sections (with titles, types, and source citation instructions) into AI system prompts for both Twilio-based agents (`message-processor.ts`) and internal consultant chat agents (`agent-consultant-chat-service.ts`), working across custom templates and legacy hardcoded templates. Features: modular block UI with drag-and-drop file upload, individual save/delete buttons, document processor service (pdf-parse, mammoth, fs), CRUD API with multipart/form-data support, automatic prompt enrichment with ordered knowledge items.
- **Database Schema**: 9 tables for WhatsApp config, conversations, messages, API keys, media, stats, and follow-ups. Additional tables for `objection_tracking`, `client_objection_profile`, `consultant_availability_settings`, `consultant_calendar_sync`, `appointment_bookings`, `proactive_leads`, and `whatsapp_agent_knowledge_items`. WhatsApp config includes `defaultObiettivi`, `defaultDesideri`, `defaultUncino`, `defaultIdealState` fields for lead defaults and `whatsapp_templates` JSONB for template Content SIDs.

# External Dependencies

- **Supabase**: PostgreSQL hosting with pgBouncer transaction pooling (free tier).
- **Recharts**: Data visualization.
- **Date-fns**: Date manipulation.
- **Radix UI**: Accessible UI primitives (underlying shadcn/ui).
- **Google Fonts**: Inter, Poppins, DM Sans, Fira Code.
- **Lucide React**: Iconography.
- **Google Gemini API**: AI-powered features (email generation, client state tracking, general AI assistant, objection detection).
- **Percorso Capitale API**: Financial management system integration.
- **Fathom**: AI-powered consultation recording and transcription.
- **Driver.js**: Interactive guided tours and onboarding.
- **Twilio API**: WhatsApp Business messaging.