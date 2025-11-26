import { useState, useEffect } from 'react';
import { Plus, Trash2, ArrowDown } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { BlockContainer } from './BlockContainer';
import type { Ladder, LadderLevel } from '@shared/script-blocks';

interface BlockLadderProps {
  ladder: Ladder;
  onUpdate?: (ladder: Ladder) => void;
  readOnly?: boolean;
  nested?: boolean;
}

const deepCopyLadder = (l: Ladder): Ladder => ({
  ...l,
  levels: l.levels.map(level => ({ ...level })),
  whenToUse: l.whenToUse ? [...l.whenToUse] : undefined,
  stopWhen: l.stopWhen ? [...l.stopWhen] : undefined,
});

export function BlockLadder({ ladder, onUpdate, readOnly = false, nested = false }: BlockLadderProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedLadder, setEditedLadder] = useState<Ladder>(() => deepCopyLadder(ladder));

  useEffect(() => {
    if (!isEditing) {
      setEditedLadder(deepCopyLadder(ladder));
    }
  }, [ladder, isEditing]);

  const handleEdit = () => {
    setEditedLadder(deepCopyLadder(ladder));
    setIsEditing(true);
  };

  const handleSave = () => {
    onUpdate?.(editedLadder);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditedLadder(deepCopyLadder(ladder));
    setIsEditing(false);
  };

  const addLevel = () => {
    const newLevel: LadderLevel = {
      number: editedLadder.levels.length + 1,
      name: '',
      question: '',
    };
    setEditedLadder({
      ...editedLadder,
      levels: [...editedLadder.levels, newLevel],
    });
  };

  const removeLevel = (index: number) => {
    const newLevels = editedLadder.levels.filter((_, i) => i !== index);
    const renumbered = newLevels.map((level, i) => ({ ...level, number: i + 1 }));
    setEditedLadder({ ...editedLadder, levels: renumbered });
  };

  const updateLevel = (index: number, field: keyof LadderLevel, value: string | number) => {
    const newLevels = [...editedLadder.levels];
    newLevels[index] = { ...newLevels[index], [field]: value };
    setEditedLadder({ ...editedLadder, levels: newLevels });
  };

  const addWhenToUse = () => {
    setEditedLadder({
      ...editedLadder,
      whenToUse: [...(editedLadder.whenToUse || []), ''],
    });
  };

  const removeWhenToUse = (index: number) => {
    const newArr = [...(editedLadder.whenToUse || [])];
    newArr.splice(index, 1);
    setEditedLadder({ ...editedLadder, whenToUse: newArr });
  };

  const updateWhenToUse = (index: number, value: string) => {
    const newArr = [...(editedLadder.whenToUse || [])];
    newArr[index] = value;
    setEditedLadder({ ...editedLadder, whenToUse: newArr });
  };

  const addStopWhen = () => {
    setEditedLadder({
      ...editedLadder,
      stopWhen: [...(editedLadder.stopWhen || []), ''],
    });
  };

  const removeStopWhen = (index: number) => {
    const newArr = [...(editedLadder.stopWhen || [])];
    newArr.splice(index, 1);
    setEditedLadder({ ...editedLadder, stopWhen: newArr });
  };

  const updateStopWhen = (index: number, value: string) => {
    const newArr = [...(editedLadder.stopWhen || [])];
    newArr[index] = value;
    setEditedLadder({ ...editedLadder, stopWhen: newArr });
  };

  const displayLadder = isEditing ? editedLadder : ladder;

  return (
    <BlockContainer
      type="ladder"
      title={displayLadder.title}
      isEditing={isEditing}
      onEdit={readOnly ? undefined : handleEdit}
      onSave={handleSave}
      onCancel={handleCancel}
      nested={nested}
      defaultExpanded={false}
      headerExtra={
        <Badge variant="outline" className="text-xs">
          {displayLadder.levels.length} livelli
        </Badge>
      }
    >
      <div className="space-y-4">
        {isEditing ? (
          <div className="grid gap-4">
            <div className="space-y-2">
              <Label htmlFor="ladder-title">Titolo</Label>
              <Input
                id="ladder-title"
                value={editedLadder.title}
                onChange={(e) => setEditedLadder({ ...editedLadder, title: e.target.value })}
                placeholder="Titolo del Ladder..."
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Quando usarlo</Label>
                <Button type="button" variant="outline" size="sm" onClick={addWhenToUse}>
                  <Plus className="h-3 w-3 mr-1" />
                  Aggiungi
                </Button>
              </div>
              <div className="space-y-2">
                {(editedLadder.whenToUse || []).map((item, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <Input
                      value={item}
                      onChange={(e) => updateWhenToUse(index, e.target.value)}
                      placeholder="Condizione per usare il ladder..."
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeWhenToUse(index)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Livelli</Label>
                <Button type="button" variant="outline" size="sm" onClick={addLevel}>
                  <Plus className="h-3 w-3 mr-1" />
                  Aggiungi Livello
                </Button>
              </div>
              <div className="space-y-4">
                {editedLadder.levels.map((level, index) => (
                  <div key={index} className="border rounded-lg p-3 space-y-3 bg-background">
                    <div className="flex items-center justify-between">
                      <Badge variant="secondary">Livello {level.number}</Badge>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeLevel(index)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label className="text-xs">Nome</Label>
                        <Input
                          value={level.name}
                          onChange={(e) => updateLevel(index, 'name', e.target.value)}
                          placeholder="Nome livello..."
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Domanda</Label>
                        <Input
                          value={level.question}
                          onChange={(e) => updateLevel(index, 'question', e.target.value)}
                          placeholder="Domanda..."
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Note</Label>
                      <Input
                        value={level.notes || ''}
                        onChange={(e) => updateLevel(index, 'notes', e.target.value)}
                        placeholder="Note opzionali..."
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Quando fermarsi</Label>
                <Button type="button" variant="outline" size="sm" onClick={addStopWhen}>
                  <Plus className="h-3 w-3 mr-1" />
                  Aggiungi
                </Button>
              </div>
              <div className="space-y-2">
                {(editedLadder.stopWhen || []).map((item, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <Input
                      value={item}
                      onChange={(e) => updateStopWhen(index, e.target.value)}
                      placeholder="Condizione per fermarsi..."
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeStopWhen(index)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {displayLadder.whenToUse && displayLadder.whenToUse.length > 0 && (
              <div>
                <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                  Quando usarlo
                </h4>
                <ul className="list-disc list-inside text-sm space-y-1">
                  {displayLadder.whenToUse.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="space-y-3">
              <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Livelli
              </h4>
              {displayLadder.levels.map((level, index) => (
                <div key={index} className="flex items-start gap-3">
                  <div className="flex flex-col items-center">
                    <Badge variant="secondary" className="mb-1">
                      {level.number}
                    </Badge>
                    {index < displayLadder.levels.length - 1 && (
                      <ArrowDown className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-sm">{level.name}</p>
                    <p className="text-sm text-muted-foreground">{level.question}</p>
                    {level.notes && (
                      <p className="text-xs italic text-muted-foreground mt-1">{level.notes}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {displayLadder.stopWhen && displayLadder.stopWhen.length > 0 && (
              <div className="p-3 rounded-lg bg-red-50/50 dark:bg-red-950/20 border border-red-200 dark:border-red-800">
                <h4 className="text-xs font-medium text-red-700 dark:text-red-300 uppercase tracking-wide mb-2">
                  ⛔ Quando fermarsi
                </h4>
                <ul className="list-disc list-inside text-sm space-y-1">
                  {displayLadder.stopWhen.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </BlockContainer>
  );
}
