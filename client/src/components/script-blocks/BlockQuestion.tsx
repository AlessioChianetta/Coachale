import { useState, useEffect } from 'react';
import { Plus, Trash2, Key } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { BlockContainer } from './BlockContainer';
import type { Question } from '@shared/script-blocks';

interface BlockQuestionProps {
  question: Question;
  onUpdate?: (question: Question) => void;
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

export function BlockQuestion({ question, onUpdate, onDelete, readOnly = false }: BlockQuestionProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedQuestion, setEditedQuestion] = useState<Question>(() => deepCopyQuestion(question));

  useEffect(() => {
    if (!isEditing) {
      setEditedQuestion(deepCopyQuestion(question));
    }
  }, [question, isEditing]);

  const handleEdit = () => {
    setEditedQuestion(deepCopyQuestion(question));
    setIsEditing(true);
  };

  const handleSave = () => {
    onUpdate?.(editedQuestion);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditedQuestion(deepCopyQuestion(question));
    setIsEditing(false);
  };

  const addReaction = () => {
    const currentReacts = editedQuestion.instructions?.react || [];
    setEditedQuestion({
      ...editedQuestion,
      instructions: {
        ...editedQuestion.instructions,
        wait: editedQuestion.instructions?.wait ?? false,
        react: [...currentReacts, ''],
      },
    });
  };

  const removeReaction = (index: number) => {
    const newReacts = [...(editedQuestion.instructions?.react || [])];
    newReacts.splice(index, 1);
    setEditedQuestion({
      ...editedQuestion,
      instructions: {
        ...editedQuestion.instructions,
        wait: editedQuestion.instructions?.wait ?? false,
        react: newReacts,
      },
    });
  };

  const updateReaction = (index: number, value: string) => {
    const newReacts = [...(editedQuestion.instructions?.react || [])];
    newReacts[index] = value;
    setEditedQuestion({
      ...editedQuestion,
      instructions: {
        ...editedQuestion.instructions,
        wait: editedQuestion.instructions?.wait ?? false,
        react: newReacts,
      },
    });
  };

  const displayQuestion = isEditing ? editedQuestion : question;

  const questionPreview = displayQuestion.text.length > 60 
    ? displayQuestion.text.substring(0, 60) + '...' 
    : displayQuestion.text;

  return (
    <BlockContainer
      type="question"
      title={questionPreview}
      isEditing={isEditing}
      onEdit={readOnly ? undefined : handleEdit}
      onSave={handleSave}
      onCancel={handleCancel}
      nested
      defaultExpanded={false}
      headerExtra={
        <>
          {displayQuestion.isKey && (
            <Badge variant="default" className="text-xs bg-purple-600">
              <Key className="h-3 w-3 mr-1" />
              Chiave
            </Badge>
          )}
          {displayQuestion.condition && (
            <Badge variant="outline" className="text-xs">
              {displayQuestion.condition}
            </Badge>
          )}
        </>
      }
    >
      <div className="space-y-4">
        {isEditing ? (
          <div className="grid gap-4">
            <div className="space-y-2">
              <Label htmlFor="question-text">Testo Domanda</Label>
              <Textarea
                id="question-text"
                value={editedQuestion.text}
                onChange={(e) => setEditedQuestion({ ...editedQuestion, text: e.target.value })}
                placeholder="Scrivi la domanda..."
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="question-condition">Condizione (opzionale)</Label>
              <Input
                id="question-condition"
                value={editedQuestion.condition || ''}
                onChange={(e) => setEditedQuestion({ ...editedQuestion, condition: e.target.value })}
                placeholder="Es. SE NON È CHIARO"
              />
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="question-wait"
                  checked={editedQuestion.instructions?.wait ?? false}
                  onCheckedChange={(checked) => 
                    setEditedQuestion({
                      ...editedQuestion,
                      instructions: {
                        ...editedQuestion.instructions,
                        wait: checked === true,
                        react: editedQuestion.instructions?.react,
                      },
                    })
                  }
                />
                <Label htmlFor="question-wait" className="text-sm">Aspetta risposta</Label>
              </div>

              <div className="flex items-center gap-2">
                <Checkbox
                  id="question-key"
                  checked={editedQuestion.isKey ?? false}
                  onCheckedChange={(checked) => 
                    setEditedQuestion({ ...editedQuestion, isKey: checked === true })
                  }
                />
                <Label htmlFor="question-key" className="text-sm">È domanda chiave</Label>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="question-listen">Istruzioni Ascolto</Label>
              <Input
                id="question-listen"
                value={editedQuestion.instructions?.listen || ''}
                onChange={(e) => 
                  setEditedQuestion({
                    ...editedQuestion,
                    instructions: {
                      ...editedQuestion.instructions,
                      wait: editedQuestion.instructions?.wait ?? false,
                      listen: e.target.value,
                    },
                  })
                }
                placeholder="Cosa ascoltare nella risposta..."
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Reazioni Suggerite</Label>
                <Button type="button" variant="outline" size="sm" onClick={addReaction}>
                  <Plus className="h-3 w-3 mr-1" />
                  Aggiungi
                </Button>
              </div>
              <div className="space-y-2">
                {(editedQuestion.instructions?.react || []).map((reaction, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <Input
                      value={reaction}
                      onChange={(e) => updateReaction(index, e.target.value)}
                      placeholder="Es. Ottimo!, Capisco..."
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeReaction(index)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm">{displayQuestion.text}</p>
            
            {displayQuestion.instructions && (
              <div className="grid gap-2 text-sm">
                {displayQuestion.instructions.wait && (
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">Aspetta risposta</Badge>
                  </div>
                )}
                {displayQuestion.instructions.listen && (
                  <div className="text-muted-foreground">
                    <span className="font-medium">Ascolta: </span>
                    {displayQuestion.instructions.listen}
                  </div>
                )}
                {displayQuestion.instructions.react && displayQuestion.instructions.react.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    <span className="text-muted-foreground text-xs">Reazioni:</span>
                    {displayQuestion.instructions.react.map((r, i) => (
                      <Badge key={i} variant="secondary" className="text-xs">
                        {r}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </BlockContainer>
  );
}
