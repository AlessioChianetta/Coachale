# 📊 PIANO DETTAGLIATO MIGLIORATO - FASI 8-15 (FRONTEND + ANALYTICS)

**Documento versione**: 2.0
**Data**: 2025-11-26
**Status Backend**: ✅ 100% COMPLETATO (Fasi 1-7)
**Status Frontend**: ⏳ 0% (Fasi 8-15 - QUESTA È LA TUA PARTE)

---

## 📌 PREREQUISITI E DIPENDENZE

### ✅ Backend già completato (NON modificare):
- `server/routes/sales-scripts.ts` - 5 nuovi endpoint (PUT /energy, PUT /ladder, PUT /questions, PUT /biscottini, GET /enhanced)
- `server/ai/sales-script-structure-parser.ts` - Parser potenziato con EnergySettings, LadderLevels, Biscottini
- `server/ai/sales-script-tracker.ts` - Factory method asincrono che carica script da DB
- Database: 4 nuovi campi JSONB in salesScripts + 3 campi tracking in salesConversationTraining

### 🔗 Dipendenze tra frontend fasi:
```
Task 8 (BlockEditor)
    ↓
Task 11 (Mutations) ← Task 9 (PhaseInspector) + Task 10 (StepInspector)
    ↓
Task 12 (ScriptReferencePanel) ← Task 8 output
    ↓
Task 13 (Analytics) + Task 14 (TrainingMap) + Task 15 (GeminiAnalyzer)
```

**⚠️ ORDINE CORRETTO**:
1. Task 8 PRIMA di Task 12 (il display dipende dai badge di Task 8)
2. Task 11 (mutations) PRIMA di Task 9-10 (gli inspector usano le mutations)
3. Task 12 DOPO Task 8 e 11
4. Task 13-15 sono indipendenti e possono partire in parallelo

---

## FASE 8: BlockEditor.tsx - ENERGY BADGE + LADDER INDICATOR

**Durata stimata**: 2 ore
**Priorità**: 🔴 CRITICA (blocking per Task 12)
**Files da modificare**: `client/src/components/script-manager/BlockEditor.tsx`

### Cosa deve fare:
Aggiungere badge visivi per:
1. Energy Level per fase (ALTO/MEDIO/BASSO con colore)
2. Ladder indicator per step (🪜 se hasLadder=true)
3. Step counter "X/Y" per fase
4. Checkpoint indicator ⛔ con numero verifiche

### Step-by-step dettagliato:

#### STEP 1: Struttura HTML della fase
**Dove**: Dentro il rendering della fase (dopo `<h3>{phase.name}</h3>`)

```typescript
// PRIMA (linea ~150):
return (
  <div className="phase-card">
    <h3>{phase.name}</h3>
    {/* steps... */}
  </div>
);

// DOPO (aggiungere):
return (
  <div className="phase-card">
    <div className="phase-header-flex">
      <div className="phase-title-section">
        <h3>{phase.name}</h3>
        <span className="step-counter">
          {currentPhaseSteps.length}/{totalStepsInPhase} steps
        </span>
      </div>
      
      {/* ⭐ NUOVO: Energy Badge */}
      {energyForPhase && (
        <EnergyBadge 
          energy={energyForPhase}
          label="Phase Energy"
        />
      )}
      
      {/* ⭐ NUOVO: Checkpoint Indicator */}
      {phase.checkpoints && phase.checkpoints.length > 0 && (
        <CheckpointBadge 
          count={phase.checkpoints.length}
          totalVerifications={countVerifications(phase.checkpoints)}
        />
      )}
    </div>
    
    {/* Existing steps rendering... */}
  </div>
);
```

#### STEP 2: Creare componente `EnergyBadge.tsx`
**Dove**: `client/src/components/script-manager/EnergyBadge.tsx` (NEW FILE)

```typescript
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface EnergyBadgeProps {
  energy: {
    level?: string;        // "BASSO" | "MEDIO" | "ALTO"
    tone?: string;         // "CALMO" | "SICURO" | "CONFIDENZIALE" | "ENTUSIASTA"
    volume?: string;       // "SOFT" | "NORMAL" | "LOUD"
    pace?: string;         // "LENTO" | "MODERATO" | "VELOCE"
    vocabulary?: string;   // "FORMALE" | "COLLOQUIALE" | "TECNICO"
    reason?: string;
  };
  label?: string;
}

export function EnergyBadge({ energy, label = "Energy" }: EnergyBadgeProps) {
  // Mappa colori per energy level
  const colorMap = {
    'BASSO': 'bg-blue-100 text-blue-800',
    'MEDIO': 'bg-yellow-100 text-yellow-800',
    'ALTO': 'bg-red-100 text-red-800',
  };
  
  const icon = {
    'BASSO': '🔵',
    'MEDIO': '🟡',
    'ALTO': '🔴',
  };

  const tooltipText = `
    ${label}
    Level: ${energy.level || 'N/A'}
    Tone: ${energy.tone || 'N/A'}
    Volume: ${energy.volume || 'N/A'}
    Pace: ${energy.pace || 'N/A'}
    Vocabulary: ${energy.vocabulary || 'N/A'}
    ${energy.reason ? `Reason: ${energy.reason}` : ''}
  `.trim();

  return (
    <Tooltip>
      <TooltipTrigger>
        <Badge 
          className={`${colorMap[energy.level] || 'bg-gray-100'} cursor-help`}
          variant="outline"
        >
          {icon[energy.level] || '⚡'} {energy.level}
        </Badge>
      </TooltipTrigger>
      <TooltipContent>
        <pre className="text-xs whitespace-pre-wrap">{tooltipText}</pre>
      </TooltipContent>
    </Tooltip>
  );
}
```

#### STEP 3: Creare componente `CheckpointBadge.tsx`
**Dove**: `client/src/components/script-manager/CheckpointBadge.tsx` (NEW FILE)

```typescript
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface CheckpointBadgeProps {
  count: number;
  totalVerifications: number;
  description?: string;
}

export function CheckpointBadge({ 
  count, 
  totalVerifications, 
  description 
}: CheckpointBadgeProps) {
  return (
    <Tooltip>
      <TooltipTrigger>
        <Badge 
          className="bg-red-50 text-red-700 border-red-300"
          variant="outline"
        >
          ⛔ {count} checkpoint{count !== 1 ? 's' : ''} ({totalVerifications} check)
        </Badge>
      </TooltipTrigger>
      <TooltipContent>
        <p className="text-xs">
          {count} critical checkpoints with {totalVerifications} verification steps
          {description && ` - ${description}`}
        </p>
      </TooltipContent>
    </Tooltip>
  );
}
```

#### STEP 4: Creare componente `LadderIndicator.tsx`
**Dove**: `client/src/components/script-manager/LadderIndicator.tsx` (NEW FILE)

```typescript
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface LadderIndicatorProps {
  hasLadder: boolean;
  levels?: number;  // Numero di livelli estratti
  stepName?: string;
}

export function LadderIndicator({ hasLadder, levels = 5, stepName }: LadderIndicatorProps) {
  if (!hasLadder) return null;

  return (
    <Tooltip>
      <TooltipTrigger>
        <Badge className="bg-purple-100 text-purple-800" variant="outline">
          🪜 {levels} levels
        </Badge>
      </TooltipTrigger>
      <TooltipContent>
        <p className="text-xs">
          This step has a {levels}-level "Why" ladder
          {stepName && ` for "${stepName}"`}
        </p>
      </TooltipContent>
    </Tooltip>
  );
}
```

#### STEP 5: Integrare nel rendering step
**Dove**: In BlockEditor.tsx, dove renderizzi gli step (linea ~200-250)

```typescript
// PRIMA:
{step.name && <h4>{step.name}</h4>}
{step.objective && <p>{step.objective}</p>}

// DOPO:
<div className="step-header-flex">
  <div>
    <h4>{step.name}</h4>
    {step.objective && <p>{step.objective}</p>}
  </div>
  
  {/* ⭐ NUOVO: Ladder Indicator */}
  {ladderForStep && (
    <LadderIndicator 
      hasLadder={true}
      levels={countLadderLevels(ladderForStep)}
      stepName={step.name}
    />
  )}
  
  {/* ⭐ NUOVO: Questions Counter */}
  {step.questions && step.questions.length > 0 && (
    <Badge variant="secondary" className="ml-2">
      ❓ {step.questions.length} Q
    </Badge>
  )}
</div>
```

#### STEP 6: Helper functions
**Aggiungi in BlockEditor.tsx**:

```typescript
// Numero verifiche da checkpoint
function countVerifications(checkpoints: any[]): number {
  return checkpoints.reduce((sum, cp) => sum + (cp.verifications?.length || 0), 0);
}

// Estrai energy per fase
function getEnergyForPhase(phaseId: string, energySettings: Record<string, any>) {
  return energySettings?.[phaseId] || energySettings?.[`phase_${phaseId}`];
}

// Estrai ladder per step
function getLadderForStep(stepId: string, ladderOverrides: Record<string, any>) {
  return ladderOverrides?.[stepId] || ladderOverrides?.[`step_${stepId}`];
}

// Conta livelli ladder
function countLadderLevels(ladder: any): number {
  return ladder?.levels?.length || 5;
}

// Conta totali
function getTotalStepsInPhase(phases: any[], phaseIndex: number): number {
  return phases[phaseIndex]?.steps?.length || 0;
}
```

#### STEP 7: CSS Styling
**Aggiungi in BlockEditor.tsx o creare `BlockEditor.module.css`**:

```css
.phase-header-flex {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid #e5e7eb;
}

.phase-title-section {
  flex: 1;
}

.step-counter {
  font-size: 0.875rem;
  color: #6b7280;
  margin-left: 8px;
}

.step-header-flex {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 12px;
}

.step-header-flex div {
  flex: 1;
}

.step-header-flex > :last-child {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
}
```

### Test cases:
- [ ] Energy badge mostra colore corretto (BASSO=blu, MEDIO=giallo, ALTO=rosso)
- [ ] Hover badge mostra tooltip con tutti i dettagli energy
- [ ] Ladder indicator appare solo se `hasLadder=true`
- [ ] Checkpoint badge mostra numero corretto
- [ ] Step counter aggiorna quando fasi cambiano
- [ ] Questions counter mostra numero domande

### Success criteria:
- ✅ Tutte le badge visibili e cliccabili
- ✅ Tooltip funzionano correttamente
- ✅ Responsive design (mobile ok)
- ✅ Nessun console error

---

## FASE 9: PhaseInspector.tsx - ENERGY SETTINGS EDITOR

**Durata stimata**: 1.5 ore
**Priorità**: 🟡 ALTA
**Files da modificare**: `client/src/components/script-manager/PhaseInspector.tsx`

### Cosa deve fare:
Aggiungere sezione editabile per Energy Settings della fase

### Step-by-step:

#### STEP 1: Aggiungi stato per energy editing
```typescript
const [editingEnergy, setEditingEnergy] = useState<string | null>(null);
const [energyForm, setEnergyForm] = useState({
  level: 'MEDIO',
  tone: 'SICURO',
  volume: 'NORMAL',
  pace: 'MODERATO',
  vocabulary: 'COLLOQUIALE',
  reason: ''
});
```

#### STEP 2: Struttura HTML della sezione energy
```typescript
<section className="energy-section">
  <div className="section-header">
    <h4>⚡ Energy Settings</h4>
    <button 
      onClick={() => setEditingEnergy(selectedPhaseId)}
      className="btn-edit"
    >
      {editingEnergy === selectedPhaseId ? 'Cancel' : 'Edit'}
    </button>
  </div>

  {editingEnergy === selectedPhaseId ? (
    /* Form editabile */
    <EnergyForm 
      initialValues={currentEnergySettings}
      onSave={handleSaveEnergy}
      onCancel={() => setEditingEnergy(null)}
    />
  ) : (
    /* Display read-only */
    <EnergyDisplay energy={currentEnergySettings} />
  )}
</section>
```

#### STEP 3: Creare componente `EnergyForm.tsx`
```typescript
// NEW FILE: client/src/components/script-manager/EnergyForm.tsx

interface EnergyFormProps {
  initialValues: EnergySettings;
  onSave: (values: EnergySettings) => Promise<void>;
  onCancel: () => void;
}

export function EnergyForm({ initialValues, onSave, onCancel }: EnergyFormProps) {
  const [values, setValues] = useState(initialValues);
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await onSave(values);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="energy-form grid gap-4">
      {/* Level Dropdown */}
      <div className="form-group">
        <label>Energy Level</label>
        <select 
          value={values.level}
          onChange={(e) => setValues({...values, level: e.target.value})}
          className="form-select"
        >
          <option value="BASSO">🔵 BASSO (Low Energy)</option>
          <option value="MEDIO">🟡 MEDIO (Medium Energy)</option>
          <option value="ALTO">🔴 ALTO (High Energy)</option>
        </select>
      </div>

      {/* Tone Dropdown */}
      <div className="form-group">
        <label>Tone</label>
        <select 
          value={values.tone}
          onChange={(e) => setValues({...values, tone: e.target.value})}
          className="form-select"
        >
          <option value="CALMO">CALMO - Calm & Collected</option>
          <option value="SICURO">SICURO - Confident & Sure</option>
          <option value="CONFIDENZIALE">CONFIDENZIALE - Confidential & Serious</option>
          <option value="ENTUSIASTA">ENTUSIASTA - Enthusiastic & Energetic</option>
        </select>
      </div>

      {/* Volume Dropdown */}
      <div className="form-group">
        <label>Volume</label>
        <select 
          value={values.volume}
          onChange={(e) => setValues({...values, volume: e.target.value})}
          className="form-select"
        >
          <option value="SOFT">SOFT - Whisper, intimate</option>
          <option value="NORMAL">NORMAL - Regular speaking</option>
          <option value="LOUD">LOUD - Clear, strong voice</option>
        </select>
      </div>

      {/* Pace Dropdown */}
      <div className="form-group">
        <label>Pace</label>
        <select 
          value={values.pace}
          onChange={(e) => setValues({...values, pace: e.target.value})}
          className="form-select"
        >
          <option value="LENTO">LENTO - Slow & Deliberate</option>
          <option value="MODERATO">MODERATO - Normal pace</option>
          <option value="VELOCE">VELOCE - Fast & Snappy</option>
        </select>
      </div>

      {/* Vocabulary Dropdown */}
      <div className="form-group">
        <label>Vocabulary</label>
        <select 
          value={values.vocabulary}
          onChange={(e) => setValues({...values, vocabulary: e.target.value})}
          className="form-select"
        >
          <option value="FORMALE">FORMALE - Formal, professional</option>
          <option value="COLLOQUIALE">COLLOQUIALE - Conversational, casual</option>
          <option value="TECNICO">TECNICO - Technical, jargon-heavy</option>
        </select>
      </div>

      {/* Reason Textarea */}
      <div className="form-group">
        <label>Reason (optional)</label>
        <textarea 
          value={values.reason || ''}
          onChange={(e) => setValues({...values, reason: e.target.value})}
          placeholder="Why did you choose these settings?"
          className="form-textarea"
          rows={2}
        />
      </div>

      {/* Buttons */}
      <div className="form-actions flex gap-2">
        <button 
          type="submit" 
          disabled={isSaving}
          className="btn btn-primary"
        >
          {isSaving ? 'Saving...' : 'Save Energy Settings'}
        </button>
        <button 
          type="button"
          onClick={onCancel}
          className="btn btn-secondary"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
```

### Test cases:
- [ ] Form mostra valori corretti da DB
- [ ] Tutti i dropdown funzionano
- [ ] Save button chiama corretto endpoint
- [ ] Toast notification mostra success/error
- [ ] Cancel button chiude il form
- [ ] Valori salvati persistono dopo refresh

### Success criteria:
- ✅ Form completo e funzionante
- ✅ Salvataggio a DB
- ✅ Error handling

---

## FASE 10: StepInspector.tsx - LADDER + QUESTIONS EDITOR

**Durata stimata**: 2.5 ore
**Priorità**: 🟡 ALTA
**Files da modificare**: `client/src/components/script-manager/StepInspector.tsx`

### Cosa deve fare:
1. Visualizzare e editare i 5 livelli di ladder
2. Editare domande dello step
3. Editare biscottini

#### STEP 1: Aggiungere sezione Ladder (5 livelli)
```typescript
<section className="ladder-section">
  <div className="section-header">
    <h4>🪜 Why Ladder (5 Levels)</h4>
    <Toggle
      checked={hasLadder}
      onChange={(checked) => setHasLadder(checked)}
      label="Enable Ladder"
    />
  </div>

  {hasLadder && (
    <div className="ladder-levels grid gap-4">
      {[1, 2, 3, 4, 5].map((levelNum) => (
        <LadderLevelCard
          key={levelNum}
          level={levelNum}
          data={ladderLevels[levelNum - 1]}
          onUpdate={(updated) => updateLadderLevel(levelNum, updated)}
        />
      ))}
    </div>
  )}

  <button 
    onClick={handleSaveLadder}
    disabled={isSavingLadder}
    className="btn btn-primary"
  >
    Save Ladder
  </button>
</section>
```

#### STEP 2: Creare `LadderLevelCard.tsx`
```typescript
// NEW FILE: client/src/components/script-manager/LadderLevelCard.tsx

const LADDER_NAMES = [
  'CHIARIFICAZIONE',
  'CONSEGUENZE',
  'IMPATTO EMOTIVO',
  'MOTIVAZIONE PROFONDA',
  'VISION'
];

const LADDER_PURPOSES = [
  'Chiarificare il problema iniziale',
  'Esplorare le conseguenze pratiche',
  'Scoprire l\'impatto emotivo',
  'Trovare la motivazione profonda',
  'Visualizzare il futuro ideale'
];

interface LadderLevelCardProps {
  level: number;
  data?: LadderLevel;
  onUpdate: (data: LadderLevel) => void;
}

export function LadderLevelCard({ level, data, onUpdate }: LadderLevelCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    name: data?.name || LADDER_NAMES[level - 1],
    text: data?.text || '',
    purpose: data?.purpose || LADDER_PURPOSES[level - 1]
  });

  return (
    <div className={`ladder-card level-${level} border rounded-lg p-4`}>
      <div className="flex justify-between items-start mb-2">
        <div>
          <h5 className="font-semibold">{level}. {LADDER_NAMES[level - 1]}</h5>
          <p className="text-xs text-gray-500">{LADDER_PURPOSES[level - 1]}</p>
        </div>
        <button 
          onClick={() => setIsEditing(!isEditing)}
          className="text-xs px-2 py-1 rounded hover:bg-gray-100"
        >
          {isEditing ? 'Done' : 'Edit'}
        </button>
      </div>

      {isEditing ? (
        <div className="form-space grid gap-2">
          <input 
            type="text"
            value={formData.text}
            onChange={(e) => setFormData({...formData, text: e.target.value})}
            placeholder="Enter the 'why' question for this level..."
            className="form-input"
          />
          <textarea 
            value={formData.purpose}
            onChange={(e) => setFormData({...formData, purpose: e.target.value})}
            placeholder="Purpose of this level..."
            className="form-textarea"
            rows={2}
          />
          <button 
            onClick={() => {
              onUpdate(formData);
              setIsEditing(false);
            }}
            className="btn btn-sm btn-primary"
          >
            Update Level
          </button>
        </div>
      ) : (
        <div>
          <p className="text-sm mb-2"><strong>Question:</strong> {formData.text || '(empty)'}</p>
          <p className="text-xs text-gray-600">{formData.purpose}</p>
        </div>
      )}
    </div>
  );
}
```

#### STEP 3: Aggiungere sezione Questions
```typescript
<section className="questions-section mt-8">
  <div className="section-header">
    <h4>❓ Key Questions</h4>
    <button 
      onClick={() => setIsEditingQuestions(!isEditingQuestions)}
      className="btn-edit"
    >
      {isEditingQuestions ? 'Done Editing' : 'Edit'}
    </button>
  </div>

  {isEditingQuestions ? (
    <QuestionsEditor 
      questions={stepQuestions}
      onUpdate={setStepQuestions}
      onSave={handleSaveQuestions}
    />
  ) : (
    <QuestionsList questions={stepQuestions} />
  )}
</section>
```

#### STEP 4: Creare `QuestionsEditor.tsx`
```typescript
// NEW FILE: client/src/components/script-manager/QuestionsEditor.tsx

interface QuestionsEditorProps {
  questions: Question[];
  onUpdate: (questions: Question[]) => void;
  onSave: () => Promise<void>;
}

export function QuestionsEditor({ questions, onUpdate, onSave }: QuestionsEditorProps) {
  const [items, setItems] = useState(questions);
  const [isSaving, setIsSaving] = useState(false);

  const handleAddQuestion = () => {
    const newQ = {
      id: `q_${Date.now()}`,
      text: '',
      order: items.length + 1,
      type: 'general' as const
    };
    setItems([...items, newQ]);
  };

  const handleUpdateQuestion = (index: number, field: string, value: any) => {
    const updated = [...items];
    updated[index] = {...updated[index], [field]: value};
    setItems(updated);
    onUpdate(updated);
  };

  const handleDeleteQuestion = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      onUpdate(items);
      await onSave();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="questions-editor space-y-3">
      {items.map((q, idx) => (
        <div key={q.id} className="question-item flex gap-2 p-3 border rounded">
          <span className="text-sm font-semibold text-gray-500">{idx + 1}.</span>
          <input 
            type="text"
            value={q.text}
            onChange={(e) => handleUpdateQuestion(idx, 'text', e.target.value)}
            placeholder="Enter question..."
            className="flex-1 form-input text-sm"
          />
          <select 
            value={q.type || 'general'}
            onChange={(e) => handleUpdateQuestion(idx, 'type', e.target.value)}
            className="form-select text-sm"
          >
            <option value="general">General</option>
            <option value="discovery">Discovery</option>
            <option value="ladder">Ladder</option>
            <option value="closing">Closing</option>
          </select>
          <button 
            onClick={() => handleDeleteQuestion(idx)}
            className="btn btn-sm btn-danger"
          >
            ✕
          </button>
        </div>
      ))}
      
      <button 
        onClick={handleAddQuestion}
        className="btn btn-sm btn-secondary"
      >
        + Add Question
      </button>

      <div className="flex gap-2 pt-2">
        <button 
          onClick={handleSave}
          disabled={isSaving}
          className="btn btn-primary"
        >
          {isSaving ? 'Saving...' : 'Save Questions'}
        </button>
      </div>
    </div>
  );
}
```

### Test cases:
- [ ] 5 livelli ladder mostrati correttamente
- [ ] Edit mode funziona per ogni livello
- [ ] Domande si aggiungono/cancellano
- [ ] Save button chiama API
- [ ] Valori persistono dopo reload

---

## FASE 11: client-script-manager.tsx - MUTATIONS

**Durata stimata**: 1 ora
**Priorità**: 🟡 ALTA (blocking per Task 9-10)
**Files da modificare**: `client/src/pages/client-script-manager.tsx`

### Cosa deve fare:
Creare useMutation hooks per i 4 PUT endpoint

```typescript
// Aggiungi all'inizio del componente:

const updateEnergyMutation = useMutation({
  mutationFn: async (data: {scriptId: string; phaseOrStepId: string; settings: any}) => {
    const res = await fetch(`/api/sales-scripts/${data.scriptId}/energy`, {
      method: 'PUT',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        phaseOrStepId: data.phaseOrStepId,
        settings: data.settings
      })
    });
    if (!res.ok) throw new Error('Failed to update energy');
    return res.json();
  },
  onSuccess: () => {
    toast.success('Energy settings saved!');
    queryClient.invalidateQueries(['scripts']);
  },
  onError: (error) => {
    toast.error('Failed to save energy settings');
    console.error(error);
  }
});

const updateLadderMutation = useMutation({
  mutationFn: async (data: {scriptId: string; stepId: string; hasLadder: boolean; levels: any[]}) => {
    const res = await fetch(`/api/sales-scripts/${data.scriptId}/ladder`, {
      method: 'PUT',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        stepId: data.stepId,
        hasLadder: data.hasLadder,
        levels: data.levels
      })
    });
    if (!res.ok) throw new Error('Failed to update ladder');
    return res.json();
  },
  onSuccess: () => {
    toast.success('Ladder levels saved!');
    queryClient.invalidateQueries(['scripts']);
  }
});

const updateQuestionsMutation = useMutation({
  mutationFn: async (data: {scriptId: string; stepId: string; questions: any[]}) => {
    const res = await fetch(`/api/sales-scripts/${data.scriptId}/questions`, {
      method: 'PUT',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        stepId: data.stepId,
        questions: data.questions
      })
    });
    if (!res.ok) throw new Error('Failed to update questions');
    return res.json();
  },
  onSuccess: () => {
    toast.success('Questions saved!');
    queryClient.invalidateQueries(['scripts']);
  }
});

const updateBiscottiniMutation = useMutation({
  mutationFn: async (data: {scriptId: string; stepId: string; biscottini: any[]}) => {
    const res = await fetch(`/api/sales-scripts/${data.scriptId}/biscottini`, {
      method: 'PUT',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        stepId: data.stepId,
        biscottini: data.biscottini
      })
    });
    if (!res.ok) throw new Error('Failed to update biscottini');
    return res.json();
  },
  onSuccess: () => {
    toast.success('Biscottini saved!');
    queryClient.invalidateQueries(['scripts']);
  }
});
```

Passa questi alle componenti figlie via context o props:
```typescript
<PhaseInspector 
  onSaveEnergy={(data) => updateEnergyMutation.mutate(data)}
  isLoading={updateEnergyMutation.isPending}
/>
```

---

## FASE 12: ScriptReferencePanel.tsx - DISPLAY

**Durata stimata**: 1.5 ore
**Priorità**: 🟡 ALTA
**Files da modificare**: `client/src/components/script-manager/ScriptReferencePanel.tsx`

### Cosa deve fare:
Mostrare completi:
- Energy badge per fase visibile
- Ladder levels con domande (5 livelli)
- Questions counter
- Checkpoint details

```typescript
// Aggiungere sezioni:

<div className="script-reference-energy">
  <h3>⚡ Energy Overview</h3>
  {currentPhase && energySettings[currentPhase.id] && (
    <EnergyBadge energy={energySettings[currentPhase.id]} />
  )}
</div>

<div className="script-reference-ladder">
  <h3>🪜 Why Ladder</h3>
  {ladderForCurrentStep && (
    <div className="ladder-display">
      {ladderForCurrentStep.levels.map((level, i) => (
        <div key={i} className="ladder-level-display">
          <h5>{level.level}. {level.name}</h5>
          <p>{level.text}</p>
        </div>
      ))}
    </div>
  )}
</div>

<div className="script-reference-questions">
  <h3>❓ Questions</h3>
  <p>{stepQuestions?.length || 0} questions in this step</p>
</div>
```

---

## FASE 13: ANALYTICS - client-sales-agent-analytics.tsx

**Durata stimata**: 2 ore
**Priorità**: 🟢 MEDIA
**Files da modificare**: `client/src/pages/client-sales-agent-analytics.tsx`

### Cosa deve fare:
1. Aggiungi colonna "Script Usato" con `usedScriptName`
2. Aggiungi filtro script type (discovery/demo/objections)
3. Mostra distribution grafico

```typescript
// Aggiungi colonna nella tabella:
{
  accessorKey: "usedScriptName",
  header: "Script Used",
  cell: (info) => {
    const scriptName = info.getValue();
    const scriptType = info.row.original.usedScriptType;
    return (
      <div className="text-sm">
        <span className="font-medium">{scriptName}</span>
        <span className="text-xs text-gray-500 ml-2">({scriptType})</span>
      </div>
    );
  }
}

// Aggiungi filtro:
<select 
  onChange={(e) => setScriptTypeFilter(e.target.value)}
  className="form-select"
>
  <option value="">All Scripts</option>
  <option value="discovery">Discovery</option>
  <option value="demo">Demo</option>
  <option value="objections">Objections</option>
</select>

// Aggiungi chart:
<ScriptUsageChart data={conversationData} />
```

---

## FASE 14: TRAINING MAP - training-map.tsx

**Durata stimata**: 1.5 ore
**Priorità**: 🟢 MEDIA
**Files da modificare**: `client/src/pages/training-map.tsx`

### Cosa deve fare:
Usare `usedScriptSnapshot` al posto dello script corrente

```typescript
// PRIMA:
const scriptData = await fetchScript(agentId); // Carica script ATTUALE

// DOPO:
// Usa script salvato nella conversazione
const scriptData = conversation.usedScriptSnapshot || 
                   await fetchScript(agentId); // Fallback

// Aggiungi warning se script è cambiatoCUITO
if (conversation.usedScriptId !== activeScriptId) {
  showWarning(`Script usato: ${conversation.usedScriptName} (v${conversation.usedScriptVersion})`);
}
```

---

## FASE 15: AI TRAINING - gemini-training-analyzer.ts

**Durata stimata**: 1 ora
**Priorità**: 🟢 MEDIA
**Files da modificare**: `server/ai/gemini-training-analyzer.ts`

### Cosa deve fare:
Carica lo script salvato, non hardcoded

```typescript
// PRIMA:
const script = getObjectionsScript(); // Hardcoded!

// DOPO:
// Prendi da conversazione
const scriptSnapshot = conversation.usedScriptSnapshot;
const script = scriptSnapshot || getObjectionsScript(); // Fallback a script default

// Passa a Gemini analyzer:
const analysis = await analyzeConversation({
  conversation,
  script: scriptSnapshot,
  scriptName: conversation.usedScriptName,
  scriptVersion: conversation.usedScriptVersion
});
```

---

## 📊 SUMMARY TIMELINE

```
OGGI (4-6 ore concentrate):
Task 8  (BlockEditor)        → 2 ore    → Dependency per Task 12
Task 11 (Mutations)          → 1 ora    → Dependency per Task 9-10
Task 9  (PhaseInspector)     → 1.5 ore  → Usa mutations da Task 11
Task 10 (StepInspector)      → 2.5 ore  → Usa mutations da Task 11

DOMANI (2-3 ore):
Task 12 (ScriptReferencePanel) → 1.5 ore
Task 13 (Analytics)            → 2 ore
Task 14 (TrainingMap)          → 1.5 ore  
Task 15 (GeminiAnalyzer)       → 1 ora
```

---

## ⚠️ ERRORI COMUNI DA EVITARE

1. ❌ NON modificare il backend - è già fatto!
2. ❌ NON usare endpoint vecchi `/api/sales-script/` - Usare `/api/sales-scripts/:id/energy` etc.
3. ❌ NON dimenticare di invalidate le queries dopo mutation
4. ❌ NON hardcodare nomi fase/step - Usare i dati dal DB
5. ❌ NON aggiungere colonne al DB - Usare i JSONB fields nuovi
6. ❌ NON importare `sales-scripts-base.ts` nel frontend - Non esiste più lato client

---

## ✅ CHECKLIST PRE-DEPLOYMENT

- [ ] Tutti i 5 test cases di Task 8 passano
- [ ] Mutations non hanno console error
- [ ] BlockEditor badges visibili correttamente
- [ ] PhaseInspector save funziona
- [ ] StepInspector salva ladder correttamente
- [ ] ScriptReferencePanel aggiornato
- [ ] Analytics mostra script name
- [ ] TrainingMap usa usedScriptSnapshot
- [ ] GeminiAnalyzer non erra
- [ ] Nessun 404 su nuovi endpoint
- [ ] Mobile responsive ok
- [ ] Database queries ottimizzate

---

**Buona fortuna! 🚀**
