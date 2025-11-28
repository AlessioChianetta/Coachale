import React from 'react';
import { useBuilder } from './BuilderContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { Phase, Step, Question } from '@shared/script-blocks';
import { cn } from '@/lib/utils';
import { CheckSquare, Info, MessageSquare, Target, Zap } from 'lucide-react';

function EmptyInspector() {
  return (
    <div className="flex flex-col items-center justify-center h-full p-8 text-center">
      <Info className="h-12 w-12 text-muted-foreground/30 mb-4" />
      <h3 className="font-medium mb-2">Nessun blocco selezionato</h3>
      <p className="text-sm text-muted-foreground">
        Seleziona un blocco nel canvas per vederne e modificarne le proprietà
      </p>
    </div>
  );
}

function PhaseInspectorPanel({ phase }: { phase: Phase }) {
  const builder = useBuilder();

  const handleUpdate = (data: Partial<Phase>) => {
    builder.updatePhase(phase.id, data);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-primary">
        <Target className="h-5 w-5" />
        <span className="font-semibold">Fase {phase.number}</span>
      </div>

      <div className="space-y-3">
        <div>
          <Label htmlFor="phase-name" className="text-xs">Nome Fase</Label>
          <Input
            id="phase-name"
            value={phase.name}
            onChange={(e) => handleUpdate({ name: e.target.value })}
            className="mt-1"
          />
        </div>

        <div>
          <Label htmlFor="phase-description" className="text-xs">Descrizione</Label>
          <Textarea
            id="phase-description"
            value={phase.description || ''}
            onChange={(e) => handleUpdate({ description: e.target.value })}
            className="mt-1 min-h-[80px]"
            placeholder="Obiettivo di questa fase..."
          />
        </div>

        <div>
          <Label htmlFor="phase-transition" className="text-xs">Frase di Transizione</Label>
          <Textarea
            id="phase-transition"
            value={phase.transition || ''}
            onChange={(e) => handleUpdate({ transition: e.target.value })}
            className="mt-1 min-h-[60px]"
            placeholder="Come passare alla fase successiva..."
          />
        </div>
      </div>

      <Separator />

      <div>
        <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
          <Zap className="h-4 w-4" />
          Impostazioni Energia
        </h4>
        <Card className="bg-muted/50">
          <CardContent className="p-3 space-y-2">
            <div>
              <Label className="text-xs">Livello</Label>
              <Select
                value={phase.energy?.level || 'MEDIO'}
                onValueChange={(value) => handleUpdate({
                  energy: { ...phase.energy, level: value, tone: phase.energy?.tone || '', volume: phase.energy?.volume || '', rhythm: phase.energy?.rhythm || '', vocabulary: phase.energy?.vocabulary || [] }
                })}
              >
                <SelectTrigger className="mt-1 h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="BASSO">Basso - Calmo, riflessivo</SelectItem>
                  <SelectItem value="MEDIO">Medio - Professionale, coinvolgente</SelectItem>
                  <SelectItem value="ALTO">Alto - Energico, entusiasta</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Tono</Label>
              <Input
                value={phase.energy?.tone || ''}
                onChange={(e) => handleUpdate({
                  energy: { ...phase.energy, tone: e.target.value, level: phase.energy?.level || 'MEDIO', volume: phase.energy?.volume || '', rhythm: phase.energy?.rhythm || '', vocabulary: phase.energy?.vocabulary || [] }
                })}
                className="mt-1 h-8"
                placeholder="Es: Curioso, empatico..."
              />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="text-xs text-muted-foreground">
        <p>Step contenuti: {phase.steps?.length || 0}</p>
        <p>Domande totali: {phase.steps?.reduce((acc, s) => acc + (s.questions?.length || 0), 0) || 0}</p>
      </div>
    </div>
  );
}

function StepInspectorPanel({ step, phaseId }: { step: Step; phaseId: string }) {
  const builder = useBuilder();

  const handleUpdate = (data: Partial<Step>) => {
    builder.updateStep(phaseId, step.id, data);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
        <CheckSquare className="h-5 w-5" />
        <span className="font-semibold">Step {step.number}</span>
      </div>

      <div className="space-y-3">
        <div>
          <Label htmlFor="step-name" className="text-xs">Nome Step</Label>
          <Input
            id="step-name"
            value={step.name}
            onChange={(e) => handleUpdate({ name: e.target.value })}
            className="mt-1"
          />
        </div>

        <div>
          <Label htmlFor="step-objective" className="text-xs">Obiettivo</Label>
          <Textarea
            id="step-objective"
            value={step.objective || ''}
            onChange={(e) => handleUpdate({ objective: e.target.value })}
            className="mt-1 min-h-[80px]"
            placeholder="Cosa vuoi ottenere in questo step..."
          />
        </div>

        <div>
          <Label htmlFor="step-notes" className="text-xs">Note per l'AI</Label>
          <Textarea
            id="step-notes"
            value={step.notes || ''}
            onChange={(e) => handleUpdate({ notes: e.target.value })}
            className="mt-1 min-h-[60px]"
            placeholder="Istruzioni comportamentali specifiche..."
          />
        </div>
      </div>

      <Separator />

      <div>
        <h4 className="font-medium text-sm mb-2">Funzionalità Avanzate</h4>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-xs">Ladder dei Perché</Label>
              <p className="text-[10px] text-muted-foreground">Approfondimento progressivo</p>
            </div>
            <Switch
              checked={!!step.ladder}
              onCheckedChange={(checked) => {
                if (checked) {
                  handleUpdate({
                    ladder: {
                      title: 'Ladder dei Perché',
                      levels: [
                        { number: 1, name: 'Superficie', question: 'Perché è importante per te?' },
                        { number: 2, name: 'Approfondimento', question: 'E perché questo conta?' },
                        { number: 3, name: 'Valore', question: 'Cosa significherebbe per te?' },
                        { number: 4, name: 'Impatto', question: 'Come cambierebbe la tua situazione?' },
                        { number: 5, name: 'Core', question: 'Cosa ti permetterebbe di fare?' },
                      ]
                    }
                  });
                } else {
                  handleUpdate({ ladder: undefined });
                }
              }}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label className="text-xs">Biscottino</Label>
              <p className="text-[10px] text-muted-foreground">Frase di rinforzo positivo</p>
            </div>
            <Switch
              checked={!!step.biscottino}
              onCheckedChange={(checked) => {
                if (checked) {
                  handleUpdate({
                    biscottino: {
                      trigger: 'Quando il prospect condivide qualcosa di personale',
                      phrase: 'Grazie per aver condiviso questo con me, apprezzo la tua sincerità.'
                    }
                  });
                } else {
                  handleUpdate({ biscottino: undefined });
                }
              }}
            />
          </div>
        </div>
      </div>

      <div className="text-xs text-muted-foreground">
        <p>Domande: {step.questions?.length || 0}</p>
      </div>
    </div>
  );
}

function QuestionInspectorPanel({ question, phaseId, stepId }: { question: Question; phaseId: string; stepId: string }) {
  const builder = useBuilder();

  const handleUpdate = (data: Partial<Question>) => {
    builder.updateQuestion(phaseId, stepId, question.id, data);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-purple-600 dark:text-purple-400">
        <MessageSquare className="h-5 w-5" />
        <span className="font-semibold">Domanda</span>
        {question.isKey && (
          <Badge variant="default" className="text-xs">Chiave</Badge>
        )}
      </div>

      <div className="space-y-3">
        <div>
          <Label htmlFor="question-text" className="text-xs">Testo Domanda</Label>
          <Textarea
            id="question-text"
            value={question.text}
            onChange={(e) => handleUpdate({ text: e.target.value })}
            className="mt-1 min-h-[100px]"
            placeholder="Scrivi la domanda..."
          />
        </div>

        <div>
          <Label htmlFor="question-marker" className="text-xs">Marker (opzionale)</Label>
          <Input
            id="question-marker"
            value={question.marker || ''}
            onChange={(e) => handleUpdate({ marker: e.target.value })}
            className="mt-1"
            placeholder="Es: [BUDGET], [TIMELINE]..."
          />
          <p className="text-[10px] text-muted-foreground mt-1">
            I marker aiutano a categorizzare le risposte
          </p>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <Label className="text-xs">Domanda Chiave</Label>
            <p className="text-[10px] text-muted-foreground">Essenziale per qualificare</p>
          </div>
          <Switch
            checked={question.isKey || false}
            onCheckedChange={(checked) => handleUpdate({ isKey: checked })}
          />
        </div>

        <div>
          <Label htmlFor="question-condition" className="text-xs">Condizione (opzionale)</Label>
          <Input
            id="question-condition"
            value={question.condition || ''}
            onChange={(e) => handleUpdate({ condition: e.target.value })}
            className="mt-1"
            placeholder="Es: SE prospect ha detto X..."
          />
          <p className="text-[10px] text-muted-foreground mt-1">
            Quando porre questa domanda
          </p>
        </div>
      </div>

      <Separator />

      <div>
        <h4 className="font-medium text-sm mb-2">Istruzioni per l'AI</h4>
        <Card className="bg-muted/50">
          <CardContent className="p-3 space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Aspetta risposta completa</Label>
              <Switch
                checked={question.instructions?.wait || false}
                onCheckedChange={(checked) => handleUpdate({
                  instructions: { ...question.instructions, wait: checked }
                })}
              />
            </div>
            {question.instructions?.wait && (
              <div>
                <Label className="text-xs">Dettagli attesa</Label>
                <Input
                  value={question.instructions?.waitDetails || ''}
                  onChange={(e) => handleUpdate({
                    instructions: { ...question.instructions, wait: true, waitDetails: e.target.value }
                  })}
                  className="mt-1 h-8"
                  placeholder="Es: Lascia 3 secondi di silenzio..."
                />
              </div>
            )}
            <div>
              <Label className="text-xs">Come ascoltare</Label>
              <Input
                value={question.instructions?.listen || ''}
                onChange={(e) => handleUpdate({
                  instructions: { ...question.instructions, wait: question.instructions?.wait || false, listen: e.target.value }
                })}
                className="mt-1 h-8"
                placeholder="Es: Cerca menzioni di budget, timeline..."
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export function BlockInspector() {
  const builder = useBuilder();
  const selectedBlock = builder.getSelectedBlock();

  if (!selectedBlock || !builder.selectedBlockType) {
    return (
      <ScrollArea className="h-full">
        <EmptyInspector />
      </ScrollArea>
    );
  }

  const findPhaseIdForStep = (stepId: string): string | null => {
    for (const phase of builder.phases) {
      if (phase.steps?.some(s => s.id === stepId)) {
        return phase.id;
      }
    }
    return null;
  };

  const findIdsForQuestion = (questionId: string): { phaseId: string; stepId: string } | null => {
    for (const phase of builder.phases) {
      for (const step of phase.steps || []) {
        if (step.questions?.some(q => q.id === questionId)) {
          return { phaseId: phase.id, stepId: step.id };
        }
      }
    }
    return null;
  };

  return (
    <ScrollArea className="h-full">
      <div className="p-4">
        {builder.selectedBlockType === 'phase' && (
          <PhaseInspectorPanel phase={selectedBlock as Phase} />
        )}
        {builder.selectedBlockType === 'step' && (() => {
          const phaseId = findPhaseIdForStep(selectedBlock.id);
          return phaseId ? (
            <StepInspectorPanel step={selectedBlock as Step} phaseId={phaseId} />
          ) : null;
        })()}
        {builder.selectedBlockType === 'question' && (() => {
          const ids = findIdsForQuestion(selectedBlock.id);
          return ids ? (
            <QuestionInspectorPanel
              question={selectedBlock as Question}
              phaseId={ids.phaseId}
              stepId={ids.stepId}
            />
          ) : null;
        })()}
      </div>
    </ScrollArea>
  );
}
