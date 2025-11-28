import React, { useState } from 'react';
import { useBuilder } from './BuilderContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { BlockType, Phase, Step, Question } from '@shared/script-blocks';
import { BLOCK_COLORS, BLOCK_ICONS } from '@shared/script-blocks';
import {
  ChevronDown,
  ChevronRight,
  GripVertical,
  Lock,
  MessageSquare,
  Plus,
  Target,
  Trash2,
  CheckSquare,
  Zap,
} from 'lucide-react';

interface DropZoneProps {
  onDrop: (blockType: BlockType, index?: number) => void;
  children?: React.ReactNode;
  className?: string;
  placeholder?: string;
  acceptTypes?: BlockType[];
}

function DropZone({ onDrop, children, className, placeholder, acceptTypes }: DropZoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    try {
      const data = JSON.parse(e.dataTransfer.getData('application/json'));
      if (data.blockType) {
        if (acceptTypes && !acceptTypes.includes(data.blockType)) {
          return;
        }
        onDrop(data.blockType);
      }
    } catch {
      console.error('Invalid drop data');
    }
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={cn(
        'transition-all duration-200 rounded-lg',
        isDragOver && 'ring-2 ring-primary ring-dashed bg-primary/5',
        className
      )}
    >
      {children || (
        <div className={cn(
          'border-2 border-dashed rounded-lg p-8 text-center transition-colors',
          isDragOver ? 'border-primary bg-primary/5' : 'border-muted-foreground/20'
        )}>
          <p className="text-sm text-muted-foreground">
            {placeholder || 'Trascina qui un blocco'}
          </p>
        </div>
      )}
    </div>
  );
}

interface LockedSectionProps {
  type: 'initial' | 'final';
  title: string;
  description: string;
  children: React.ReactNode;
}

function LockedSection({ type, title, description, children }: LockedSectionProps) {
  const [isOpen, setIsOpen] = useState(true);
  const bgColor = type === 'initial' ? 'bg-emerald-50 dark:bg-emerald-950' : 'bg-rose-50 dark:bg-rose-950';
  const borderColor = type === 'initial' ? 'border-emerald-200 dark:border-emerald-800' : 'border-rose-200 dark:border-rose-800';

  return (
    <Card className={cn('shadow-sm', bgColor, borderColor)}>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <CardHeader className="p-3 cursor-pointer hover:bg-black/5 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Lock className="h-4 w-4 text-muted-foreground" />
                <CardTitle className="text-sm">{title}</CardTitle>
                <Badge variant="outline" className="text-xs">
                  Obbligatorio
                </Badge>
              </div>
              {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </div>
            <CardDescription className="text-xs">{description}</CardDescription>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="p-3 pt-0">
            {children}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

interface PhaseBlockProps {
  phase: Phase;
  phaseIndex: number;
}

function PhaseBlock({ phase, phaseIndex }: PhaseBlockProps) {
  const builder = useBuilder();
  const isSelected = builder.selectedBlockId === phase.id;
  const [isOpen, setIsOpen] = useState(true);
  const stepsCount = phase.steps?.length || 0;

  const handleSelect = (e: React.MouseEvent) => {
    e.stopPropagation();
    builder.selectBlock(phase.id, 'phase');
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Eliminare questa fase e tutti i suoi step?')) {
      builder.deletePhase(phase.id);
    }
  };

  const handleAddStep = (e: React.MouseEvent) => {
    e.stopPropagation();
    builder.addStep(phase.id);
  };

  const handleStepDrop = (blockType: BlockType) => {
    if (blockType === 'step') {
      builder.addStep(phase.id);
    }
  };

  return (
    <TooltipProvider>
      <Card
        onClick={handleSelect}
        className={cn(
          'transition-all cursor-pointer hover:shadow-md',
          isSelected && 'ring-2 ring-primary shadow-md'
        )}
      >
        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
          <CollapsibleTrigger asChild>
            <CardHeader className="p-3 hover:bg-muted/50 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 flex-wrap">
                  <GripVertical className="h-4 w-4 text-muted-foreground/50 cursor-grab" />
                  <Target className="h-4 w-4 text-primary" />
                  <CardTitle className="text-sm font-semibold">
                    Fase {phase.number}: {phase.name}
                  </CardTitle>
                  <Badge variant="outline" className="text-xs font-normal">
                    {stepsCount} step
                  </Badge>
                </div>
                <div className="flex items-center gap-1">
                  {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={handleDelete}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
              {phase.description && (
                <CardDescription className="text-xs pt-1">{phase.description}</CardDescription>
              )}
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="p-3 pt-0 pl-10 space-y-3">
              {(phase.steps || []).map((step, stepIndex) => (
                <StepBlock
                  key={step.id}
                  step={step}
                  phaseId={phase.id}
                  stepIndex={stepIndex}
                />
              ))}

              <DropZone
                onDrop={handleStepDrop}
                acceptTypes={['step']}
                placeholder="Trascina uno Step qui"
                className="min-h-[40px]"
              >
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full border-dashed"
                  onClick={handleAddStep}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Aggiungi Step
                </Button>
              </DropZone>
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>
    </TooltipProvider>
  );
}

interface StepBlockProps {
  step: Step;
  phaseId: string;
  stepIndex: number;
}

function StepBlock({ step, phaseId, stepIndex }: StepBlockProps) {
  const builder = useBuilder();
  const isSelected = builder.selectedBlockId === step.id;
  const [isOpen, setIsOpen] = useState(true);
  const questionsCount = step.questions?.length || 0;

  const handleSelect = (e: React.MouseEvent) => {
    e.stopPropagation();
    builder.selectBlock(step.id, 'step');
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Eliminare questo step e tutte le sue domande?')) {
      builder.deleteStep(phaseId, step.id);
    }
  };

  const handleAddQuestion = (e: React.MouseEvent) => {
    e.stopPropagation();
    builder.addQuestion(phaseId, step.id);
  };

  const handleQuestionDrop = (blockType: BlockType) => {
    if (blockType === 'question') {
      builder.addQuestion(phaseId, step.id);
    }
  };

  return (
    <Card
      onClick={handleSelect}
      className={cn(
        'transition-all cursor-pointer hover:bg-muted/50',
        isSelected && 'ring-2 ring-indigo-500 shadow-md'
      )}
    >
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <CardHeader className="p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 flex-wrap">
                <GripVertical className="h-4 w-4 text-muted-foreground/50 cursor-grab" />
                <CheckSquare className="h-4 w-4 text-indigo-500" />
                <CardTitle className="text-sm font-medium">
                  Step {step.number}: {step.name}
                </CardTitle>
                {questionsCount > 0 && (
                  <Badge variant="secondary" className="text-xs">
                    <MessageSquare className="h-3 w-3 mr-1" />
                    {questionsCount} {questionsCount === 1 ? 'domanda' : 'domande'}
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-1">
                {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={handleDelete}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </div>
            {step.objective && (
              <CardDescription className="text-xs pt-1">{step.objective}</CardDescription>
            )}
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="p-3 pt-0 pl-8 space-y-2">
            {(step.questions || []).map((question, qIndex) => (
              <QuestionBlock
                key={question.id}
                question={question}
                phaseId={phaseId}
                stepId={step.id}
                questionIndex={qIndex}
              />
            ))}

            <DropZone
              onDrop={handleQuestionDrop}
              acceptTypes={['question']}
              placeholder="Trascina una Domanda qui"
              className="min-h-[30px]"
            >
              <Button
                variant="outline"
                size="sm"
                className="w-full border-dashed text-xs"
                onClick={handleAddQuestion}
              >
                <Plus className="h-3 w-3 mr-1" />
                Aggiungi Domanda
              </Button>
            </DropZone>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

interface QuestionBlockProps {
  question: Question;
  phaseId: string;
  stepId: string;
  questionIndex: number;
}

function QuestionBlock({ question, phaseId, stepId, questionIndex }: QuestionBlockProps) {
  const builder = useBuilder();
  const isSelected = builder.selectedBlockId === question.id;

  const handleSelect = (e: React.MouseEvent) => {
    e.stopPropagation();
    builder.selectBlock(question.id, 'question');
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    builder.deleteQuestion(phaseId, stepId, question.id);
  };

  return (
    <div
      onClick={handleSelect}
      className={cn(
        'group flex items-start gap-2 p-2 rounded transition-all cursor-pointer',
        'hover:bg-muted text-sm text-muted-foreground',
        isSelected && 'ring-1 ring-purple-500 bg-purple-500/10 text-purple-900 dark:text-purple-200'
      )}
    >
      <GripVertical className="h-3 w-3 mt-0.5 text-muted-foreground/50 cursor-grab shrink-0" />
      <MessageSquare className="h-3 w-3 mt-0.5 shrink-0" />
      <span className="flex-1 text-xs leading-relaxed">{question.text}</span>
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6 shrink-0 opacity-0 group-hover:opacity-100"
        onClick={handleDelete}
      >
        <Trash2 className="h-3 w-3 text-destructive" />
      </Button>
    </div>
  );
}

export function BuilderCanvas() {
  const builder = useBuilder();

  const handlePhaseDrop = (blockType: BlockType) => {
    if (blockType === 'phase') {
      builder.addPhase();
    }
  };

  return (
    <div className="space-y-4 max-w-4xl mx-auto">
      <LockedSection
        type="initial"
        title="Sezione Iniziale"
        description="Apertura, saluto e impostazione della call (sempre presente)"
      >
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Saluto</label>
            <Textarea
              value={builder.initialSection.greeting}
              onChange={(e) => builder.updateInitialSection({ greeting: e.target.value })}
              className="text-sm min-h-[60px]"
              placeholder="Come saluti il prospect..."
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Introduzione</label>
            <Textarea
              value={builder.initialSection.introduction}
              onChange={(e) => builder.updateInitialSection({ introduction: e.target.value })}
              className="text-sm min-h-[60px]"
              placeholder="Presentazione e contesto..."
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Agenda Setting</label>
            <Textarea
              value={builder.initialSection.agendaSetting}
              onChange={(e) => builder.updateInitialSection({ agendaSetting: e.target.value })}
              className="text-sm min-h-[60px]"
              placeholder="Cosa farete in questa call..."
            />
          </div>
        </div>
      </LockedSection>

      <DropZone
        onDrop={handlePhaseDrop}
        acceptTypes={['phase']}
        className="min-h-[100px]"
      >
        {builder.phases.length > 0 ? (
          <div className="space-y-3">
            {builder.phases.map((phase, index) => (
              <PhaseBlock key={phase.id} phase={phase} phaseIndex={index} />
            ))}
            <Button
              variant="outline"
              size="lg"
              className="w-full border-dashed"
              onClick={() => builder.addPhase()}
            >
              <Plus className="h-5 w-5 mr-2" />
              Aggiungi Nuova Fase
            </Button>
          </div>
        ) : (
          <div className="border-2 border-dashed rounded-lg p-12 text-center">
            <Target className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
            <h3 className="font-medium mb-2">Inizia a costruire il tuo script</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Trascina una "Fase" dalla palette a sinistra, oppure clicca il pulsante qui sotto
            </p>
            <Button onClick={() => builder.addPhase()}>
              <Plus className="h-4 w-4 mr-2" />
              Aggiungi Prima Fase
            </Button>
          </div>
        )}
      </DropZone>

      <LockedSection
        type="final"
        title="Sezione Finale"
        description="Recap, CTA e chiusura della call (sempre presente)"
      >
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Recap</label>
            <Textarea
              value={builder.finalSection.recap}
              onChange={(e) => builder.updateFinalSection({ recap: e.target.value })}
              className="text-sm min-h-[60px]"
              placeholder="Riassunto dei punti chiave..."
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Call to Action</label>
            <Textarea
              value={builder.finalSection.cta}
              onChange={(e) => builder.updateFinalSection({ cta: e.target.value })}
              className="text-sm min-h-[60px]"
              placeholder="Proposta e prossimi passi..."
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Chiusura</label>
            <Textarea
              value={builder.finalSection.closing}
              onChange={(e) => builder.updateFinalSection({ closing: e.target.value })}
              className="text-sm min-h-[60px]"
              placeholder="Saluti finali..."
            />
          </div>
        </div>
      </LockedSection>
    </div>
  );
}
