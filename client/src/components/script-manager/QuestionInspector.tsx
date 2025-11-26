import React from 'react';
import type { Question } from '@shared/script-blocks';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { MessageSquare } from 'lucide-react';

interface QuestionInspectorProps {
  question: Question;
  onUpdate: (updatedQuestion: Question) => void;
  isEditing: boolean;
}

export function QuestionInspector({ question, onUpdate, isEditing }: QuestionInspectorProps) {
  const handleChange = (field: keyof Question, value: string) => {
    if (!isEditing) return;
    onUpdate({ ...question, [field]: value });
  };

  return (
    <Card className="bg-muted/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-blue-500" />
            <span>Dettagli Domanda</span>
        </CardTitle>
        <CardDescription>
            Modifica il testo e le istruzioni della domanda.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="question-text">Testo della Domanda</Label>
          <Textarea
            id="question-text"
            value={question.text}
            onChange={(e) => handleChange('text', e.target.value)}
            rows={5}
            readOnly={!isEditing}
          />
        </div>
        {/* Potremmo aggiungere qui altri campi, come 'marker' o 'istruzioni' */}
      </CardContent>
    </Card>
  );
}
