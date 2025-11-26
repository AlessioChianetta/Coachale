import React from 'react';
import type { Step } from '@shared/script-blocks';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { CheckSquare } from 'lucide-react';

interface StepInspectorProps {
  step: Step;
  onUpdate: (updatedStep: Step) => void;
  isEditing: boolean;
}

export function StepInspector({ step, onUpdate, isEditing }: StepInspectorProps) {
  const handleChange = (field: keyof Step, value: string | number) => {
    if (!isEditing) return;
    onUpdate({ ...step, [field]: value });
  };

  return (
    <Card className="bg-muted/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
            <CheckSquare className="h-5 w-5 text-indigo-500" />
            <span>Dettagli Step</span>
        </CardTitle>
        <CardDescription>
            Modifica le proprietà dello step selezionato.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="step-number">Numero Step</Label>
          <Input
            id="step-number"
            value={step.number}
            onChange={(e) => handleChange('number', parseInt(e.target.value) || 0)}
            type="number"
            readOnly={!isEditing}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="step-name">Nome Step</Label>
          <Input
            id="step-name"
            value={step.name}
            onChange={(e) => handleChange('name', e.target.value)}
            readOnly={!isEditing}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="step-objective">Obiettivo</Label>
          <Textarea
            id="step-objective"
            value={step.objective}
            onChange={(e) => handleChange('objective', e.target.value)}
            rows={4}
            readOnly={!isEditing}
            placeholder="Obiettivo specifico di questo step..."
          />
        </div>
      </CardContent>
    </Card>
  );
}
