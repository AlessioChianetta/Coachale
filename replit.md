# Overview
This full-stack web application serves as a consultation platform, connecting consultants with clients for exercise assignment, progress tracking, and performance analytics. Its core ambition is to provide personalized financial insights through an integrated AI assistant, leveraging real-time financial data for context-aware advice, alongside advanced client management and communication tools.
# Recent Changes
## November 30, 2025 - Sales Agent Token Optimization (~27k → ~8-10k tokens)
- **Goal**: Reduce Sales Agent AI token usage by ~65% through dynamic script loading
- **Phase-Specific Script Loading**:
  - `buildStaticSalesAgentPrompt()` now accepts `currentPhase` parameter
  - Loads ONLY the script for the current phase (discovery/demo/objections)
  - Discovery phase: ~8k tokens | Demo phase: ~10k tokens (includes REC) | Objections: ~9k tokens
- **Database-Only Scripts (NO Fallback)**:
  - Scripts load EXCLUSIVELY from database via `fetchClientScripts()`
  - When no script found, shows "NESSUNO SCRIPT ASSOCIATO" warning
  - Removed all fallback paths to hardcoded scripts in `sales-scripts-base.ts`
  - Template generation routes still use base scripts (for generating templates to save to DB)
- **Discovery REC Integration**:
  - New file: `server/ai/discovery-rec-generator.ts`
  - Auto-generates structured summary at discovery→demo transition using Gemini 2.5 Flash
  - 15+ fields: motivazioneCall, cosAltroHaiProvato, tipoAttivita, statoAttuale, urgenza, decisionMaker, etc.
  - Saved to database in `discoveryRec` JSONB field on `clientSalesConversations` table
  - Loaded and injected into prompt for demo/objections/closing phases
  - Retry logic (2 attempts) with 1s delay between attempts
- **Files Modified**: 
  - `server/ai/sales-agent-prompt-builder.ts` - Phase-specific loading, no fallbacks
  - `server/ai/discovery-rec-generator.ts` - New file for REC generation
  - `server/ai/gemini-live-ws-service.ts` - REC generation at phase transition
  - `shared/schema.ts` - Added `discoveryRec` JSONB column

## November 30, 2025 - Prospect Profiling System ("Fast Reflexes, Slow Brain")
- **New Feature**: Intelligent prospect personality profiling during voice calls with dynamic sales strategy adaptation
- **Hybrid Detection Approach**:
  - **Fast Reflexes (Regex)**: Instant pattern matching (~5ms) for preliminary archetype signals
  - **Slow Brain (AI Intuition)**: Context-aware override using Gemini - AI has final say when conflicts with regex
  - Example: "Il prezzo non è un problema" → AI detects ENTHUSIAST (positive sentiment), overrides regex PRICE_FOCUSED (keyword match)
- **Sticky Archetype Logic** (Anti-Schizofrenia):
  - Archetype change requires: confidence > 0.8 OR 2+ consecutive matching signals
  - Recalculates only every 3-4 turns OR on strong anomaly detection
  - Prevents rapid archetype switching that would confuse the sales agent
- **8 Behavioral Archetypes** with specific playbooks:
  - SKEPTIC: Frame Control, Negative Reverse, social proof
  - BUSY: Ultra-synthesis, "30 secondi" hook, speed-focused
  - PRICE_FOCUSED: ROI framing, value-before-price strategy
  - TECHNICAL: Specifications, data, precise numbers
  - ENTHUSIAST: Guide to closing, maintain momentum
  - INDECISIVE: Decision facilitation, reduce overwhelm
  - DEFENSIVE: Empathy, acknowledgment, barrier reduction
  - NEUTRAL: Discovery questions, active listening
- **Anti-Pattern Detection** (Critical Priority):
  - Repeated questions (Jaccard similarity > 65%) → STOP instruction
  - Ignored requests → Immediate correction
  - Prospect frustration signals → Strategy adjustment
- **Integration with TTS**: Archetype-specific voice parameters (speed, tone, pause) for natural adaptation
- **Output Structure**: profilingResult, archetypeState, and ttsParams added to SalesManagerAnalysis
- **Files Modified**: `shared/archetype-playbooks.ts`, `server/ai/sales-manager-agent.ts`

## November 27, 2025 - Sales Manager Agent Improvements
- **Structured Coaching Feedback**: AI sales agent now receives structured coaching from Sales Manager with clear format:
  - `[COACHING SALES MANAGER]...[FINE COACHING]` format with FASE, STEP, OBIETTIVO, FAI BENE, MIGLIORA, STATO, TI SERVE fields
  - Added section in AI prompt explaining how to read and apply coaching feedback
- **VAD Concatenation Fix**: Fixed fragmented speech chunks that were incorrectly processed:
  - Problem: VAD chunks like "Mol" + "to male." were being overwritten instead of concatenated
  - Solution: Smart detection of cumulative vs fragmented chunks with proper concatenation
  - Handles sentence punctuation (`.!?;:`) correctly - always adds space after sentences
  - Detects partial words (lowercase continuation) and joins without space
- **Tone Analysis Fix**: Improved detection of "AI not responding to questions":
  - Now checks temporal sequence (AI message must come AFTER user question)
  - Expanded list of Italian acknowledgment words (sì, certo, perfetto, ottimo, etc.)
  - Prevents false positives when AI asks a question and user hasn't responded yet
- **Files Modified**: `sales-agent-prompt-builder.ts`, `gemini-live-ws-service.ts`, `sales-manager-agent.ts`

## November 26, 2025 - Sales Script Sequential Navigation Fix
- **Critical Bug Fix**: AI sales agent now follows scripts in strict sequential order (Phase 1 Step 1 → Step 2 → Checkpoint → Phase 2, etc.)
- **Prompt-Side Guidance**:
  - Created `ScriptPosition` interface for tracking exact position (phaseId, stepId, completedPhases)
  - Added dynamic navigation map (`generateNavigationMap()`) showing progress with ✅/➡️ indicators
  - Added next action instructions (`generateNextAction()`) with current step, objective, questions to ask
  - Added META-INSTRUCTIONS "GUIDA RAPIDA" section at prompt start with script structure and rules
  - Optimized prompt from 1318 to 944 lines (-28%) by consolidating duplicate rules
- **Programmatic Enforcement**:
  - Added `getScriptStructure()` public getter for type-safe access (replaced unsafe `as any` cast)
  - Added `isValidStepTransition()` method to validate step/phase order
  - Validation enforces: same-phase step progression (+1 only), phase transitions only from last step
  - First utterance MUST match first step of current phase (blocks starting from step 2+)
  - Blocked transitions logged with detailed reasons and recorded in tracker
- **Files Modified**: `sales-agent-prompt-builder.ts`, `gemini-live-ws-service.ts`, `sales-script-tracker.ts`

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
---

## 📋 PROJECT GOAL
Transform the sales training system from using **hardcoded scripts** (sales-scripts-base.ts) to **dynamically loading scripts from Script Manager database** (salesScripts table). Track which specific script version was used during each conversation, and display complete script data including energy settings, ladder levels, questions, and biscottini.

---

## ✅ COMPLETED WORK (Phases 1-7) - 46.7%

### Phase 1-2: DATABASE SCHEMA ✅
- ✅ Added `used_script_id`, `used_script_name`, `used_script_type` to `salesConversationTraining`
- ✅ Added `energy_settings`, `ladder_overrides`, `step_questions`, `step_biscottini` (JSONB) to `salesScripts`
- ✅ SQL migrations executed (via execute_sql_tool, NOT drizzle-kit)

### Phase 3: PARSER ENHANCEMENT ✅
**File**: `server/ai/sales-script-structure-parser.ts` (+600 lines)
- ✅ New interfaces: Question, EnergySettings, LadderLevel, Biscottino
- ✅ Extract energy (ALTO/MEDIO/BASSO, tone, volume, pace, vocabulary)
- ✅ Parse 5-level ladder (CHIARIFICAZIONE → VISION)
- ✅ Extract questions with types (opening, discovery, ladder, closing, objection)
- ✅ Extract biscottini (rapport, value, agreement)
- ✅ Metadata with totalQuestions, totalLadderSteps, totalBiscottini

### Phase 4: TRACKER DATABASE INTEGRATION ✅
**File**: `server/ai/sales-script-tracker.ts`
- ✅ Factory method: `await SalesScriptTracker.create(conversationId, agentId, initialPhase, logger, clientId, scriptType)`
- ✅ Load script from DB by clientId + scriptType
- ✅ Fallback to JSON if not found
- ✅ Save `usedScriptInfo` (id, name, type, version) to database

### Phase 5-7: API ENDPOINTS ✅
**File**: `server/routes/sales-scripts.ts` (+230 lines)
- ✅ `PUT /api/sales-scripts/:id/energy` - Save energy settings
- ✅ `PUT /api/sales-scripts/:id/ladder` - Save 5 ladder levels
- ✅ `PUT /api/sales-scripts/:id/questions` - Save step questions
- ✅ `PUT /api/sales-scripts/:id/biscottini` - Save step biscottini
- ✅ `GET /api/sales-scripts/:id/enhanced` - Get complete script with all overrides

**All endpoints have**:
- Client authentication (`requireClient`)
- JSONB merge logic (not overwrite)
- Proper error handling & logging
- Toast-friendly response format

---

## ⏳ REMAINING WORK (Phases 8-15) - 53.3%

**→ See PIANO_DETTAGLIATO_FASI_8_15.md for complete step-by-step guide**

### Phase 8: BlockEditor.tsx - Energy Badge + Ladder Indicator (2h)
- [ ] Add energy level badge (ALTO/MEDIO/BASSO with colors)
- [ ] Add ladder indicator (🪜 if hasLadder=true)
- [ ] Show step counter "X/Y" per phase
- [ ] Show checkpoint indicator with verification count

### Phase 9: PhaseInspector.tsx - Energy Editor (1.5h)
- [ ] Create EnergyForm with 5 dropdowns (level, tone, volume, pace, vocabulary)
- [ ] Add optional "reason" textarea
- [ ] Save button calls PUT /api/sales-scripts/:id/energy

### Phase 10: StepInspector.tsx - Ladder + Questions Editor (2.5h)
- [ ] Create LadderLevelCard for all 5 levels (CHIARIFICAZIONE → VISION)
- [ ] Edit mode for each level with text + purpose
- [ ] QuestionsEditor component with add/delete/reorder
- [ ] Questions types (general, discovery, ladder, closing, objection)

### Phase 11: client-script-manager.tsx - Mutations (1h)
- [ ] useMutation for updateEnergySettings
- [ ] useMutation for updateLadderLevels
- [ ] useMutation for updateStepQuestions
- [ ] useMutation for updateStepBiscottini
- [ ] Query invalidation + toast notifications

### Phase 12: ScriptReferencePanel.tsx - Display (1.5h)
- [ ] Show energy badge for current phase
- [ ] Display all 5 ladder levels with questions
- [ ] Show question counter + checkpoint details
- [ ] Read-only display mode

### Phase 13: Analytics - client-sales-agent-analytics.tsx (2h)
- [ ] Add "Script Used" column showing `usedScriptName`
- [ ] Add filter for script type (discovery/demo/objections)
- [ ] Add pie/bar chart for script usage distribution
- [ ] Show script version in tooltip

### Phase 14: Training Map - training-map.tsx (1.5h)
- [ ] Use `usedScriptSnapshot` from conversation (not current script)
- [ ] Show warning if current script differs from used script
- [ ] Display script version + name used during conversation

### Phase 15: AI Training - gemini-training-analyzer.ts (1h)
- [ ] Load script from `conversation.usedScriptSnapshot`
- [ ] Remove hardcoded `sales-scripts-base.ts` reference
- [ ] Pass correct script to Gemini analyzer
- [ ] Fallback to active script if snapshot missing

---

## 📂 KEY FILES MODIFIED

### Backend (COMPLETED ✅)
- `server/routes/sales-scripts.ts` - 5 new endpoints (+230 lines)
- `server/ai/sales-script-structure-parser.ts` - Enhanced parser (+600 lines)
- `server/ai/sales-script-tracker.ts` - Factory method + DB loading
- Database: 7 new JSONB/VARCHAR fields (SQL migrations)

### Frontend (TODO ⏳)
- `client/src/components/script-manager/BlockEditor.tsx`
- `client/src/components/script-manager/PhaseInspector.tsx`
- `client/src/components/script-manager/StepInspector.tsx`
- `client/src/components/script-manager/ScriptReferencePanel.tsx`
- `client/src/pages/client-script-manager.tsx`
- `client/src/pages/client-sales-agent-analytics.tsx`
- `client/src/pages/training-map.tsx`
- `server/ai/gemini-training-analyzer.ts`

### New Components to Create
- `EnergyBadge.tsx` - Display energy with tooltip
- `CheckpointBadge.tsx` - Show checkpoint count
- `LadderIndicator.tsx` - Show 🪜 if ladder exists
- `EnergyForm.tsx` - Edit energy settings
- `LadderLevelCard.tsx` - Edit individual ladder levels
- `QuestionsEditor.tsx` - Add/edit/delete questions

---

## 🔗 API ENDPOINTS (READY)

```bash
# Energy Settings
PUT /api/sales-scripts/:id/energy
  Body: { phaseOrStepId, settings: {level, tone, volume, pace, vocabulary, reason} }

# Ladder Levels  
PUT /api/sales-scripts/:id/ladder
  Body: { stepId, hasLadder, levels: [{level, name, text, purpose}] }

# Questions
PUT /api/sales-scripts/:id/questions
  Body: { stepId, questions: [{id, text, order, type}] }

# Biscottini
PUT /api/sales-scripts/:id/biscottini
  Body: { stepId, biscottini: [{text, type}] }

# Get Complete Script
GET /api/sales-scripts/:id/enhanced
  Returns: script with energySettings, ladderOverrides, stepQuestions, stepBiscottini
```

---

## 🚀 GETTING STARTED FOR NEXT DEVELOPER

1. **Read first**: `PIANO_DETTAGLIATO_FASI_8_15.md` - Complete step-by-step guide
2. **Order matters**: Start with Phase 8 → 11 → 12 → 13-15
3. **Backend is ready**: All 5 endpoints work, mutations ready to call
4. **Use the components**: EnergyBadge, LadderLevelCard, etc. as provided in plan
5. **Test cases**: Each phase has specific test cases - follow them

**Estimated time to complete**: 4-6 hours concentrated frontend work

---

## ⚠️ CRITICAL NOTES FOR NEXT DEVELOPER

- ❌ DO NOT modify backend - it's complete and working
- ❌ DO NOT add new database columns - use the 4 new JSONB fields
- ❌ DO NOT import `sales-scripts-base.ts` in frontend - it's deprecated
- ✅ DO use the new API endpoints (they're designed for this)
- ✅ DO follow the detailed plan in PIANO_DETTAGLIATO_FASI_8_15.md
- ✅ DO run the test cases for each phase

---

## 🎯 SUCCESS CRITERIA

When complete:
- ✅ Frontend shows energy badges for all phases
- ✅ Frontend shows ladder indicators (🪜) for steps with ladders
- ✅ Can edit energy/ladder/questions in PhaseInspector/StepInspector
- ✅ Analytics shows which script was used per conversation
- ✅ TrainingMap uses correct script snapshot (not current script)
- ✅ AI analyzer uses saved script, not hardcoded version
- ✅ All data persists to database
- ✅ No console errors or 404s
- ✅ Mobile responsive design

---

## 📞 CONTEXT FOR HANDOFF

**What was the problem?**
- System only used hardcoded `sales-scripts-base.ts`
- Could not track which script version was active per conversation
- Missing energy settings, complete ladder levels, and biscottini data
- Analytics couldn't show script usage over time

**What was built?**
- Database schema for tracking script usage per conversation
- Enhanced parser to extract all script data (energy, ladder, questions, biscottini)
- API endpoints to save and retrieve script customizations
- Factory method in tracker to load scripts from database dynamically

**What's left?**
- Frontend components to display and edit the new data
- Integration in analytics/training-map/AI analyzer to use saved scripts
- All data flow from backend → frontend → display/edit → back to database

---

**Status**: Ready for Phase 8 🚀  
**Backend**: 100% Complete ✅  
**Frontend**: 0% (7 phases pending) ⏳
