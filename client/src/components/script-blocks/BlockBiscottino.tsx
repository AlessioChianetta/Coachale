import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { BlockContainer } from './BlockContainer';
import type { Biscottino } from '@shared/script-blocks';

interface BlockBiscottinoProps {
  biscottino: Biscottino;
  onUpdate?: (biscottino: Biscottino) => void;
  readOnly?: boolean;
  nested?: boolean;
}

const deepCopyBiscottino = (b: Biscottino): Biscottino => ({ ...b });

export function BlockBiscottino({ biscottino, onUpdate, readOnly = false, nested = false }: BlockBiscottinoProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedBiscottino, setEditedBiscottino] = useState<Biscottino>(() => deepCopyBiscottino(biscottino));

  useEffect(() => {
    if (!isEditing) {
      setEditedBiscottino(deepCopyBiscottino(biscottino));
    }
  }, [biscottino, isEditing]);

  const handleEdit = () => {
    setEditedBiscottino(deepCopyBiscottino(biscottino));
    setIsEditing(true);
  };

  const handleSave = () => {
    onUpdate?.(editedBiscottino);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditedBiscottino(deepCopyBiscottino(biscottino));
    setIsEditing(false);
  };

  const displayBiscottino = isEditing ? editedBiscottino : biscottino;

  const phrasePreview = displayBiscottino.phrase.length > 40
    ? displayBiscottino.phrase.substring(0, 40) + '...'
    : displayBiscottino.phrase;

  return (
    <BlockContainer
      type="biscottino"
      title={phrasePreview}
      isEditing={isEditing}
      onEdit={readOnly ? undefined : handleEdit}
      onSave={handleSave}
      onCancel={handleCancel}
      nested={nested}
      defaultExpanded={false}
    >
      <div className="space-y-4">
        {isEditing ? (
          <div className="grid gap-4">
            <div className="space-y-2">
              <Label htmlFor="biscottino-trigger">Trigger (Quando usarlo)</Label>
              <Input
                id="biscottino-trigger"
                value={editedBiscottino.trigger}
                onChange={(e) => setEditedBiscottino({ ...editedBiscottino, trigger: e.target.value })}
                placeholder="Es. Quando il cliente esita..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="biscottino-phrase">Frase (Cosa dire)</Label>
              <Textarea
                id="biscottino-phrase"
                value={editedBiscottino.phrase}
                onChange={(e) => setEditedBiscottino({ ...editedBiscottino, phrase: e.target.value })}
                placeholder="La frase da usare..."
                rows={3}
              />
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-start gap-2">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide shrink-0">
                Trigger:
              </span>
              <span className="text-sm">{displayBiscottino.trigger}</span>
            </div>
            <div className="p-3 rounded-lg bg-amber-100/50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
              <p className="text-sm font-medium">"{displayBiscottino.phrase}"</p>
            </div>
          </div>
        )}
      </div>
    </BlockContainer>
  );
}
