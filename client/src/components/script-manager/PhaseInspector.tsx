import React from 'react';
import type { Phase } from '@shared/script-blocks';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Target } from 'lucide-react';

interface PhaseInspectorProps {
  phase: Phase;
  onUpdate: (updatedPhase: Phase) => void;
  isEditing: boolean;
}

export function PhaseInspector({ phase, onUpdate, isEditing }: PhaseInspectorProps) {
  const handleChange = (field: keyof Phase, value: string | number) => {
    if (!isEditing) return;
    onUpdate({ ...phase, [field]: value });
  };

  return (
    <Card className="bg-muted/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            <span>Dettagli Fase</span>
        </CardTitle>
        <CardDescription>
            Modifica le proprietà della fase selezionata.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="phase-number">Numero Fase</Label>
          <Input
            id="phase-number"
            value={phase.number}
            onChange={(e) => handleChange('number', e.target.value)}
            readOnly={!isEditing}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="phase-name">Nome Fase</Label>
          <Input
            id="phase-name"
            value={phase.name}
            onChange={(e) => handleChange('name', e.target.value)}
            readOnly={!isEditing}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="phase-description">Descrizione</Label>
          <Textarea
            id="phase-description"
            value={phase.description}
            onChange={(e) => handleChange('description', e.target.value)}
            rows={4}
            readOnly={!isEditing}
            placeholder="Obiettivo principale di questa fase..."
          />
        </div>
      </CardContent>
    </Card>
  );
}
