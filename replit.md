# 🎯 SALES SCRIPT MIGRATION TO DATABASE - PROJECT STATE

**Last Updated**: 2025-11-26
**Status**: 46.7% COMPLETE (Fases 1-7 ✅ | Fases 8-15 ⏳)
**Mode**: Preparing for handoff to next developer

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
