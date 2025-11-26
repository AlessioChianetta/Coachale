import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Plus, Trash2 } from 'lucide-react';
import { BlockContainer } from './BlockContainer';
import { BlockStep } from './BlockStep';
import { BlockEnergy } from './BlockEnergy';
import { BlockCheckpoint } from './BlockCheckpoint';
import type { Phase, Step, EnergySettings, Checkpoint, Question, Ladder } from '@shared/script-blocks';

interface BlockPhaseProps {
  phase: Phase;
  onUpdate?: (phase: Phase) => void;
  onDelete?: () => void;
  readOnly?: boolean;
}

const deepCopyQuestion = (q: Question): Question => ({
  ...q,
  instructions: q.instructions ? { 
    ...q.instructions,
    react: q.instructions.react ? [...q.instructions.react] : undefined,
  } : undefined,
});

const deepCopyEnergy = (energy: EnergySettings): EnergySettings => ({
  ...energy,
  vocabulary: energy.vocabulary ? [...energy.vocabulary] : [],
});

const deepCopyLadder = (ladder: Ladder): Ladder => ({
  ...ladder,
  levels: ladder.levels.map(l => ({ ...l })),
  whenToUse: ladder.whenToUse ? [...ladder.whenToUse] : undefined,
  stopWhen: ladder.stopWhen ? [...ladder.stopWhen] : undefined,
});

const deepCopyCheckpoint = (checkpoint: Checkpoint): Checkpoint => ({
  ...checkpoint,
  checks: [...checkpoint.checks],
  resistanceHandling: checkpoint.resistanceHandling ? {
    ...checkpoint.resistanceHandling,
    steps: checkpoint.resistanceHandling.steps ? 
      checkpoint.resistanceHandling.steps.map(s => ({ ...s })) : undefined,
  } : undefined,
});

const deepCopyStep = (step: Step): Step => ({
  ...step,
  questions: step.questions.map(deepCopyQuestion),
  energy: step.energy ? deepCopyEnergy(step.energy) : undefined,
  ladder: step.ladder ? deepCopyLadder(step.ladder) : undefined,
  biscottino: step.biscottino ? { ...step.biscottino } : undefined,
});

const deepCopyPhase = (phase: Phase): Phase => ({
  ...phase,
  steps: phase.steps.map(deepCopyStep),
  energy: phase.energy ? deepCopyEnergy(phase.energy) : undefined,
  checkpoint: phase.checkpoint ? deepCopyCheckpoint(phase.checkpoint) : undefined,
});

export function BlockPhase({ phase, onUpdate, onDelete, readOnly = false }: BlockPhaseProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedPhase, setEditedPhase] = useState<Phase>(() => deepCopyPhase(phase));

  useEffect(() => {
    if (!isEditing) {
      setEditedPhase(deepCopyPhase(phase));
    }
  }, [phase, isEditing]);

  const handleEdit = () => {
    setEditedPhase(deepCopyPhase(phase));
    setIsEditing(true);
  };

  const handleSave = () => {
    onUpdate?.(editedPhase);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditedPhase(deepCopyPhase(phase));
    setIsEditing(false);
  };

  const handleStepUpdate = (index: number, updatedStep: Step) => {
    const newSteps = editedPhase.steps.map(deepCopyStep);
    newSteps[index] = deepCopyStep(updatedStep);
    const newPhase = { ...editedPhase, steps: newSteps };
    setEditedPhase(newPhase);
    if (!isEditing) {
      onUpdate?.(newPhase);
    }
  };

  const handleEnergyUpdate = (energy: EnergySettings) => {
    const newPhase = { ...editedPhase, energy };
    setEditedPhase(newPhase);
    if (!isEditing) {
      onUpdate?.(newPhase);
    }
  };

  const handleCheckpointUpdate = (checkpoint: Checkpoint) => {
    const newPhase = { ...editedPhase, checkpoint };
    setEditedPhase(newPhase);
    if (!isEditing) {
      onUpdate?.(newPhase);
    }
  };

  const addNewStep = () => {
    const maxStepNum = Math.max(0, ...editedPhase.steps.map(s => s.number));
    const newStep: Step = {
      id: `step_${crypto.randomUUID()}`,
      number: maxStepNum + 1,
      name: 'Nuovo Step',
      objective: '',
      questions: [],
    };
    const newPhase = { 
      ...editedPhase, 
      steps: [...editedPhase.steps.map(deepCopyStep), newStep] 
    };
    setEditedPhase(newPhase);
    if (!isEditing) {
      onUpdate?.(newPhase);
    }
  };

  const deleteStep = (stepId: string) => {
    const newPhase = { 
      ...editedPhase, 
      steps: editedPhase.steps.filter(s => s.id !== stepId).map(deepCopyStep)
    };
    setEditedPhase(newPhase);
    if (!isEditing) {
      onUpdate?.(newPhase);
    }
  };

  const displayPhase = isEditing ? editedPhase : phase;

  return (
    <BlockContainer
      type="phase"
      title={`Fase ${displayPhase.number}: ${displayPhase.name}`}
      isEditing={isEditing}
      onEdit={readOnly ? undefined : handleEdit}
      onSave={handleSave}
      onCancel={handleCancel}
      headerExtra={
        <Badge variant="secondary" className="text-xs">
          {displayPhase.steps.length} step
        </Badge>
      }
    >
      <div className="space-y-4">
        {isEditing ? (
          <div className="grid gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="phase-number">Numero Fase</Label>
                <Input
                  id="phase-number"
                  value={editedPhase.number}
                  onChange={(e) => setEditedPhase({ ...editedPhase, number: e.target.value })}
                  placeholder="Es. 1, 2, 3..."
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phase-name">Nome Fase</Label>
                <Input
                  id="phase-name"
                  value={editedPhase.name}
                  onChange={(e) => setEditedPhase({ ...editedPhase, name: e.target.value })}
                  placeholder="Nome della fase"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="phase-description">Descrizione</Label>
              <Textarea
                id="phase-description"
                value={editedPhase.description || ''}
                onChange={(e) => setEditedPhase({ ...editedPhase, description: e.target.value })}
                placeholder="Descrizione della fase..."
                rows={2}
              />
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {displayPhase.description && (
              <p className="text-sm text-muted-foreground">{displayPhase.description}</p>
            )}
          </div>
        )}

        {displayPhase.energy && (
          <BlockEnergy
            energy={displayPhase.energy}
            onUpdate={handleEnergyUpdate}
            readOnly={readOnly}
            nested
          />
        )}

        <div className="space-y-3 mt-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium text-muted-foreground">Steps ({displayPhase.steps.length})</h4>
            {!readOnly && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={addNewStep}
              >
                <Plus className="h-3 w-3 mr-1" />
                Step
              </Button>
            )}
          </div>
          {displayPhase.steps.map((step, index) => (
            <BlockStep
              key={step.id}
              step={step}
              onUpdate={(updatedStep) => handleStepUpdate(index, updatedStep)}
              onDelete={() => deleteStep(step.id)}
              readOnly={readOnly}
            />
          ))}
          {displayPhase.steps.length === 0 && !readOnly && (
            <Button
              variant="outline"
              size="sm"
              className="w-full border-dashed text-muted-foreground hover:text-foreground"
              onClick={addNewStep}
            >
              <Plus className="h-4 w-4 mr-2" />
              Aggiungi il primo Step
            </Button>
          )}
        </div>

        {displayPhase.checkpoint && (
          <BlockCheckpoint
            checkpoint={displayPhase.checkpoint}
            onUpdate={handleCheckpointUpdate}
            readOnly={readOnly}
            nested
          />
        )}

        {displayPhase.transition && (
          <div className="mt-4 p-3 rounded-md bg-cyan-50 dark:bg-cyan-950 border border-cyan-200 dark:border-cyan-800">
            <div className="flex items-center gap-2">
              <span>➡️</span>
              <span className="text-sm font-medium">Transizione</span>
            </div>
            <p className="text-sm mt-1 text-muted-foreground">{displayPhase.transition}</p>
          </div>
        )}
      </div>
    </BlockContainer>
  );
}
