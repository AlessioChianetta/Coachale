import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Plus, Trash2 } from 'lucide-react';
import { BlockContainer } from './BlockContainer';
import { BlockQuestion } from './BlockQuestion';
import { BlockBiscottino } from './BlockBiscottino';
import { BlockEnergy } from './BlockEnergy';
import { BlockLadder } from './BlockLadder';
import type { Step, Question, Biscottino, EnergySettings, Ladder, LadderLevel } from '@shared/script-blocks';

interface BlockStepProps {
  step: Step;
  onUpdate?: (step: Step) => void;
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

const deepCopyStep = (step: Step): Step => ({
  ...step,
  questions: step.questions.map(deepCopyQuestion),
  energy: step.energy ? deepCopyEnergy(step.energy) : undefined,
  ladder: step.ladder ? deepCopyLadder(step.ladder) : undefined,
  biscottino: step.biscottino ? { ...step.biscottino } : undefined,
});

export function BlockStep({ step, onUpdate, onDelete, readOnly = false }: BlockStepProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedStep, setEditedStep] = useState<Step>(() => deepCopyStep(step));

  useEffect(() => {
    if (!isEditing) {
      setEditedStep(deepCopyStep(step));
    }
  }, [step, isEditing]);

  const handleEdit = () => {
    setEditedStep(deepCopyStep(step));
    setIsEditing(true);
  };

  const handleSave = () => {
    onUpdate?.(editedStep);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditedStep(deepCopyStep(step));
    setIsEditing(false);
  };

  const handleQuestionUpdate = (index: number, updatedQuestion: Question) => {
    const newQuestions = editedStep.questions.map(deepCopyQuestion);
    newQuestions[index] = deepCopyQuestion(updatedQuestion);
    const newStep = { ...editedStep, questions: newQuestions };
    setEditedStep(newStep);
    if (!isEditing) {
      onUpdate?.(newStep);
    }
  };

  const handleBiscottinoUpdate = (biscottino: Biscottino) => {
    const newStep = { ...editedStep, biscottino };
    setEditedStep(newStep);
    if (!isEditing) {
      onUpdate?.(newStep);
    }
  };

  const handleEnergyUpdate = (energy: EnergySettings) => {
    const newStep = { ...editedStep, energy };
    setEditedStep(newStep);
    if (!isEditing) {
      onUpdate?.(newStep);
    }
  };

  const handleLadderUpdate = (ladder: Ladder) => {
    const newStep = { ...editedStep, ladder };
    setEditedStep(newStep);
    if (!isEditing) {
      onUpdate?.(newStep);
    }
  };

  const addNewQuestion = () => {
    const newQuestion: Question = {
      id: `question_${crypto.randomUUID()}`,
      text: 'Nuova domanda?',
    };
    const newStep = { 
      ...editedStep, 
      questions: [...editedStep.questions.map(deepCopyQuestion), newQuestion] 
    };
    setEditedStep(newStep);
    if (!isEditing) {
      onUpdate?.(newStep);
    }
  };

  const deleteQuestion = (questionId: string) => {
    const newStep = { 
      ...editedStep, 
      questions: editedStep.questions.filter(q => q.id !== questionId).map(deepCopyQuestion)
    };
    setEditedStep(newStep);
    if (!isEditing) {
      onUpdate?.(newStep);
    }
  };

  const displayStep = isEditing ? editedStep : step;

  return (
    <BlockContainer
      type="step"
      title={`Step ${displayStep.number}: ${displayStep.name}`}
      isEditing={isEditing}
      onEdit={readOnly ? undefined : handleEdit}
      onSave={handleSave}
      onCancel={handleCancel}
      nested
      headerExtra={
        <Badge variant="secondary" className="text-xs">
          {displayStep.questions.length} domande
        </Badge>
      }
    >
      <div className="space-y-4">
        {isEditing ? (
          <div className="grid gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="step-number">Numero Step</Label>
                <Input
                  id="step-number"
                  type="number"
                  value={editedStep.number}
                  onChange={(e) => setEditedStep({ ...editedStep, number: parseInt(e.target.value) || 0 })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="step-name">Nome Step</Label>
                <Input
                  id="step-name"
                  value={editedStep.name}
                  onChange={(e) => setEditedStep({ ...editedStep, name: e.target.value })}
                  placeholder="Nome dello step"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="step-objective">Obiettivo</Label>
              <Textarea
                id="step-objective"
                value={editedStep.objective}
                onChange={(e) => setEditedStep({ ...editedStep, objective: e.target.value })}
                placeholder="Obiettivo dello step..."
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="step-notes">Note</Label>
              <Textarea
                id="step-notes"
                value={editedStep.notes || ''}
                onChange={(e) => setEditedStep({ ...editedStep, notes: e.target.value })}
                placeholder="Note aggiuntive..."
                rows={2}
              />
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Obiettivo:</span>
              <span className="text-sm text-muted-foreground">{displayStep.objective}</span>
            </div>
            {displayStep.notes && (
              <p className="text-sm text-muted-foreground italic">{displayStep.notes}</p>
            )}
          </div>
        )}

        {displayStep.energy && (
          <BlockEnergy
            energy={displayStep.energy}
            onUpdate={handleEnergyUpdate}
            readOnly={readOnly}
            nested
          />
        )}

        <div className="space-y-2 mt-4">
          <div className="flex items-center justify-between">
            <h5 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Domande ({displayStep.questions.length})
            </h5>
            {!readOnly && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-xs"
                onClick={addNewQuestion}
              >
                <Plus className="h-3 w-3 mr-1" />
                Domanda
              </Button>
            )}
          </div>
          {displayStep.questions.map((question, index) => (
            <BlockQuestion
              key={question.id}
              question={question}
              onUpdate={(updatedQuestion) => handleQuestionUpdate(index, updatedQuestion)}
              onDelete={() => deleteQuestion(question.id)}
              readOnly={readOnly}
            />
          ))}
          {displayStep.questions.length === 0 && !readOnly && (
            <Button
              variant="outline"
              size="sm"
              className="w-full border-dashed text-muted-foreground hover:text-foreground text-xs"
              onClick={addNewQuestion}
            >
              <Plus className="h-3 w-3 mr-1" />
              Aggiungi domanda
            </Button>
          )}
        </div>

        {displayStep.ladder && (
          <BlockLadder
            ladder={displayStep.ladder}
            onUpdate={handleLadderUpdate}
            readOnly={readOnly}
            nested
          />
        )}

        {displayStep.biscottino && (
          <BlockBiscottino
            biscottino={displayStep.biscottino}
            onUpdate={handleBiscottinoUpdate}
            readOnly={readOnly}
            nested
          />
        )}
      </div>
    </BlockContainer>
  );
}
