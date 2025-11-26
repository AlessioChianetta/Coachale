import { useState, useEffect } from 'react';
import { Plus, Trash2, AlertTriangle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { BlockContainer } from './BlockContainer';
import type { Checkpoint, ResistanceHandling } from '@shared/script-blocks';

interface BlockCheckpointProps {
  checkpoint: Checkpoint;
  onUpdate?: (checkpoint: Checkpoint) => void;
  readOnly?: boolean;
  nested?: boolean;
}

const deepCopyCheckpoint = (c: Checkpoint): Checkpoint => ({
  ...c,
  checks: [...c.checks],
  resistanceHandling: c.resistanceHandling ? { ...c.resistanceHandling } : undefined,
});

export function BlockCheckpoint({ checkpoint, onUpdate, readOnly = false, nested = false }: BlockCheckpointProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedCheckpoint, setEditedCheckpoint] = useState<Checkpoint>(() => deepCopyCheckpoint(checkpoint));

  useEffect(() => {
    if (!isEditing) {
      setEditedCheckpoint(deepCopyCheckpoint(checkpoint));
    }
  }, [checkpoint, isEditing]);

  const handleEdit = () => {
    setEditedCheckpoint(deepCopyCheckpoint(checkpoint));
    setIsEditing(true);
  };

  const handleSave = () => {
    onUpdate?.(editedCheckpoint);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditedCheckpoint(deepCopyCheckpoint(checkpoint));
    setIsEditing(false);
  };

  const addCheck = () => {
    setEditedCheckpoint({
      ...editedCheckpoint,
      checks: [...editedCheckpoint.checks, ''],
    });
  };

  const removeCheck = (index: number) => {
    const newChecks = [...editedCheckpoint.checks];
    newChecks.splice(index, 1);
    setEditedCheckpoint({ ...editedCheckpoint, checks: newChecks });
  };

  const updateCheck = (index: number, value: string) => {
    const newChecks = [...editedCheckpoint.checks];
    newChecks[index] = value;
    setEditedCheckpoint({ ...editedCheckpoint, checks: newChecks });
  };

  const updateResistance = (field: keyof ResistanceHandling, value: string) => {
    setEditedCheckpoint({
      ...editedCheckpoint,
      resistanceHandling: {
        trigger: editedCheckpoint.resistanceHandling?.trigger || '',
        response: editedCheckpoint.resistanceHandling?.response || '',
        ...editedCheckpoint.resistanceHandling,
        [field]: value,
      },
    });
  };

  const displayCheckpoint = isEditing ? editedCheckpoint : checkpoint;

  return (
    <BlockContainer
      type="checkpoint"
      title={displayCheckpoint.title}
      isEditing={isEditing}
      onEdit={readOnly ? undefined : handleEdit}
      onSave={handleSave}
      onCancel={handleCancel}
      nested={nested}
      defaultExpanded={false}
      headerExtra={
        <Badge variant="outline" className="text-xs">
          {displayCheckpoint.checks.length} verifiche
        </Badge>
      }
    >
      <div className="space-y-4">
        {isEditing ? (
          <div className="grid gap-4">
            <div className="space-y-2">
              <Label htmlFor="checkpoint-title">Titolo</Label>
              <Input
                id="checkpoint-title"
                value={editedCheckpoint.title}
                onChange={(e) => setEditedCheckpoint({ ...editedCheckpoint, title: e.target.value })}
                placeholder="Titolo del checkpoint..."
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Verifiche</Label>
                <Button type="button" variant="outline" size="sm" onClick={addCheck}>
                  <Plus className="h-3 w-3 mr-1" />
                  Aggiungi
                </Button>
              </div>
              <div className="space-y-2">
                {editedCheckpoint.checks.map((check, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <Input
                      value={check}
                      onChange={(e) => updateCheck(index, e.target.value)}
                      placeholder="Cosa verificare..."
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeCheck(index)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-4 border rounded-lg p-4 bg-rose-50/50 dark:bg-rose-950/20">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-rose-600" />
                <h4 className="font-medium text-sm">Gestione Resistenza</h4>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="resistance-trigger">Trigger</Label>
                <Input
                  id="resistance-trigger"
                  value={editedCheckpoint.resistanceHandling?.trigger || ''}
                  onChange={(e) => updateResistance('trigger', e.target.value)}
                  placeholder="Quando attivare la gestione resistenza..."
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="resistance-response">Risposta</Label>
                <Textarea
                  id="resistance-response"
                  value={editedCheckpoint.resistanceHandling?.response || ''}
                  onChange={(e) => updateResistance('response', e.target.value)}
                  placeholder="Come rispondere alla resistenza..."
                  rows={3}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="checkpoint-reminder">Promemoria</Label>
              <Textarea
                id="checkpoint-reminder"
                value={editedCheckpoint.reminder || ''}
                onChange={(e) => setEditedCheckpoint({ ...editedCheckpoint, reminder: e.target.value })}
                placeholder="Promemoria opzionale..."
                rows={2}
              />
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-muted-foreground">Verifiche:</h4>
              <div className="space-y-2">
                {displayCheckpoint.checks.map((check, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <Checkbox disabled checked={false} />
                    <span className="text-sm">{check}</span>
                  </div>
                ))}
              </div>
            </div>

            {displayCheckpoint.resistanceHandling && (
              <div className="border rounded-lg p-3 bg-rose-50/50 dark:bg-rose-950/20">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="h-4 w-4 text-rose-600" />
                  <h5 className="font-medium text-sm">Gestione Resistenza</h5>
                </div>
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">Trigger: </span>
                    {displayCheckpoint.resistanceHandling.trigger}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Risposta: </span>
                    {displayCheckpoint.resistanceHandling.response}
                  </div>
                </div>
              </div>
            )}

            {displayCheckpoint.reminder && (
              <div className="p-2 bg-muted rounded text-sm italic">
                💡 {displayCheckpoint.reminder}
              </div>
            )}
          </div>
        )}
      </div>
    </BlockContainer>
  );
}
