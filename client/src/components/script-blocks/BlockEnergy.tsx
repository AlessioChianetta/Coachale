import { useState, useEffect } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { BlockContainer } from './BlockContainer';
import type { EnergySettings } from '@shared/script-blocks';

interface BlockEnergyProps {
  energy: EnergySettings;
  onUpdate?: (energy: EnergySettings) => void;
  readOnly?: boolean;
  nested?: boolean;
}

const ENERGY_LEVELS = ['MASSIMA', 'ALTA', 'MEDIA', 'BASSA'] as const;

const deepCopyEnergy = (e: EnergySettings): EnergySettings => ({
  ...e,
  vocabulary: [...e.vocabulary],
});

export function BlockEnergy({ energy, onUpdate, readOnly = false, nested = false }: BlockEnergyProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedEnergy, setEditedEnergy] = useState<EnergySettings>(() => deepCopyEnergy(energy));

  useEffect(() => {
    if (!isEditing) {
      setEditedEnergy(deepCopyEnergy(energy));
    }
  }, [energy, isEditing]);

  const handleEdit = () => {
    setEditedEnergy(deepCopyEnergy(energy));
    setIsEditing(true);
  };

  const handleSave = () => {
    onUpdate?.(editedEnergy);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditedEnergy(deepCopyEnergy(energy));
    setIsEditing(false);
  };

  const addVocabulary = () => {
    setEditedEnergy({
      ...editedEnergy,
      vocabulary: [...editedEnergy.vocabulary, ''],
    });
  };

  const removeVocabulary = (index: number) => {
    const newVocab = [...editedEnergy.vocabulary];
    newVocab.splice(index, 1);
    setEditedEnergy({ ...editedEnergy, vocabulary: newVocab });
  };

  const updateVocabulary = (index: number, value: string) => {
    const newVocab = [...editedEnergy.vocabulary];
    newVocab[index] = value;
    setEditedEnergy({ ...editedEnergy, vocabulary: newVocab });
  };

  const displayEnergy = isEditing ? editedEnergy : energy;

  const getEnergyColor = (level: string) => {
    switch (level.toUpperCase()) {
      case 'MASSIMA':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      case 'ALTA':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
      case 'MEDIA':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'BASSA':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <BlockContainer
      type="energy"
      title={`Energia: ${displayEnergy.level}`}
      isEditing={isEditing}
      onEdit={readOnly ? undefined : handleEdit}
      onSave={handleSave}
      onCancel={handleCancel}
      nested={nested}
      defaultExpanded={false}
      headerExtra={
        <Badge className={getEnergyColor(displayEnergy.level)}>
          {displayEnergy.level}
        </Badge>
      }
    >
      <div className="space-y-4">
        {isEditing ? (
          <div className="grid gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="energy-level">Livello Energia</Label>
                <Select
                  value={editedEnergy.level}
                  onValueChange={(value) => setEditedEnergy({ ...editedEnergy, level: value })}
                >
                  <SelectTrigger id="energy-level">
                    <SelectValue placeholder="Seleziona livello" />
                  </SelectTrigger>
                  <SelectContent>
                    {ENERGY_LEVELS.map((level) => (
                      <SelectItem key={level} value={level}>
                        {level}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="energy-tone">Tono</Label>
                <Input
                  id="energy-tone"
                  value={editedEnergy.tone}
                  onChange={(e) => setEditedEnergy({ ...editedEnergy, tone: e.target.value })}
                  placeholder="Es. Amichevole, Professionale..."
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="energy-volume">Volume</Label>
                <Input
                  id="energy-volume"
                  value={editedEnergy.volume}
                  onChange={(e) => setEditedEnergy({ ...editedEnergy, volume: e.target.value })}
                  placeholder="Es. Alto, Moderato..."
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="energy-rhythm">Ritmo</Label>
                <Input
                  id="energy-rhythm"
                  value={editedEnergy.rhythm}
                  onChange={(e) => setEditedEnergy({ ...editedEnergy, rhythm: e.target.value })}
                  placeholder="Es. Veloce, Moderato..."
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="energy-inflections">Inflessioni</Label>
                <Input
                  id="energy-inflections"
                  value={editedEnergy.inflections || ''}
                  onChange={(e) => setEditedEnergy({ ...editedEnergy, inflections: e.target.value })}
                  placeholder="Es. Dinamiche..."
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Vocabolario</Label>
                <Button type="button" variant="outline" size="sm" onClick={addVocabulary}>
                  <Plus className="h-3 w-3 mr-1" />
                  Aggiungi
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {editedEnergy.vocabulary.map((word, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <Input
                      value={word}
                      onChange={(e) => updateVocabulary(index, e.target.value)}
                      placeholder="Parola o frase..."
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeVocabulary(index)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="energy-mindset">Mindset</Label>
              <Textarea
                id="energy-mindset"
                value={editedEnergy.mindset || ''}
                onChange={(e) => setEditedEnergy({ ...editedEnergy, mindset: e.target.value })}
                placeholder="Atteggiamento mentale da tenere..."
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="energy-example">Esempio Vocale</Label>
              <Textarea
                id="energy-example"
                value={editedEnergy.example || ''}
                onChange={(e) => setEditedEnergy({ ...editedEnergy, example: e.target.value })}
                placeholder="Esempio di come suonare..."
                rows={2}
              />
            </div>
          </div>
        ) : (
          <div className="grid gap-3 text-sm">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <span className="text-muted-foreground">Tono:</span>
                <p className="font-medium">{displayEnergy.tone}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Volume:</span>
                <p className="font-medium">{displayEnergy.volume}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Ritmo:</span>
                <p className="font-medium">{displayEnergy.rhythm}</p>
              </div>
              {displayEnergy.inflections && (
                <div>
                  <span className="text-muted-foreground">Inflessioni:</span>
                  <p className="font-medium">{displayEnergy.inflections}</p>
                </div>
              )}
            </div>

            {displayEnergy.vocabulary.length > 0 && (
              <div>
                <span className="text-muted-foreground">Vocabolario:</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {displayEnergy.vocabulary.map((word, i) => (
                    <Badge key={i} variant="secondary" className="text-xs">
                      {word}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {displayEnergy.mindset && (
              <div>
                <span className="text-muted-foreground">Mindset:</span>
                <p className="italic">{displayEnergy.mindset}</p>
              </div>
            )}

            {displayEnergy.example && (
              <div>
                <span className="text-muted-foreground">Esempio:</span>
                <p className="italic text-muted-foreground">"{displayEnergy.example}"</p>
              </div>
            )}
          </div>
        )}
      </div>
    </BlockContainer>
  );
}
