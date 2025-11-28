import { useState } from 'react';
import { 
  Target, 
  CheckSquare, 
  MessageSquare, 
  Plus, 
  Trash2, 
  ChevronUp, 
  ChevronDown,
  GripVertical,
  Lock,
  Zap,
  Layers,
  Cookie,
  AlertOctagon
} from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import type { ScriptBlockStructure, Phase, Step, Question } from '@shared/script-blocks';
import type { BuilderMode } from '../index';

interface BuilderCanvasProps {
  structure: ScriptBlockStructure;
  selectedBlockId: string | null;
  onSelectBlock: (blockId: string | null) => void;
  onAddBlock: (type: 'phase' | 'step' | 'question', parentId?: string) => void;
  onDeleteBlock: (blockId: string) => void;
  onMoveBlock: (blockId: string, direction: 'up' | 'down') => void;
  mode: BuilderMode;
}

export function BuilderCanvas({
  structure,
  selectedBlockId,
  onSelectBlock,
  onAddBlock,
  onDeleteBlock,
  onMoveBlock,
  mode
}: BuilderCanvasProps) {
  const [expandedPhases, setExpandedPhases] = useState<string[]>(
    structure.phases.map(p => p.id)
  );
  const [expandedSteps, setExpandedSteps] = useState<string[]>([]);

  const togglePhase = (phaseId: string) => {
    setExpandedPhases(prev =>
      prev.includes(phaseId)
        ? prev.filter(id => id !== phaseId)
        : [...prev, phaseId]
    );
  };

  const toggleStep = (stepId: string) => {
    setExpandedSteps(prev =>
      prev.includes(stepId)
        ? prev.filter(id => id !== stepId)
        : [...prev, stepId]
    );
  };

  const handleBlockClick = (e: React.MouseEvent, blockId: string) => {
    e.stopPropagation();
    onSelectBlock(blockId);
  };

  const handleDelete = (e: React.MouseEvent, blockId: string) => {
    e.stopPropagation();
    if (confirm('Sei sicuro di voler eliminare questo blocco?')) {
      onDeleteBlock(blockId);
    }
  };

  return (
    <TooltipProvider>
      <div className="h-full flex flex-col bg-background">
        <div className="p-4 border-b flex items-center justify-between">
          <div>
            <h2 className="font-semibold">{structure.metadata?.name || 'Script'}</h2>
            <p className="text-xs text-muted-foreground">
              {structure.phases.length} fasi • {mode === 'manual' ? 'Modalità Manuale' : mode === 'template' ? 'Da Template' : 'AI-Assisted'}
            </p>
          </div>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => onAddBlock('phase')}
          >
            <Plus className="h-4 w-4 mr-1" />
            Aggiungi Fase
          </Button>
        </div>
        
        <ScrollArea className="flex-1">
          <div className="p-4 space-y-3">
            <Card className="border-2 border-dashed border-green-500/50 bg-green-500/5">
              <CardHeader className="py-3 px-4">
                <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                  <Lock className="h-4 w-4" />
                  <CardTitle className="text-sm font-medium">
                    Sezione Iniziale
                  </CardTitle>
                  <Badge variant="outline" className="text-[10px]">Obbligatoria</Badge>
                </div>
              </CardHeader>
              <CardContent className="py-2 px-4 text-xs text-muted-foreground">
                Apertura, saluto, impostazione della call
              </CardContent>
            </Card>

            <AnimatePresence mode="popLayout">
              {structure.phases.length === 0 ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="border-2 border-dashed rounded-lg p-8 text-center"
                >
                  <Target className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
                  <p className="text-sm text-muted-foreground mb-3">
                    Nessuna fase ancora. Inizia aggiungendo una fase.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onAddBlock('phase')}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Aggiungi Prima Fase
                  </Button>
                </motion.div>
              ) : (
                structure.phases.map((phase, phaseIndex) => (
                  <PhaseBlock
                    key={phase.id}
                    phase={phase}
                    phaseIndex={phaseIndex}
                    totalPhases={structure.phases.length}
                    isSelected={selectedBlockId === phase.id}
                    isExpanded={expandedPhases.includes(phase.id)}
                    expandedSteps={expandedSteps}
                    selectedBlockId={selectedBlockId}
                    onToggle={() => togglePhase(phase.id)}
                    onToggleStep={toggleStep}
                    onClick={(e) => handleBlockClick(e, phase.id)}
                    onStepClick={handleBlockClick}
                    onQuestionClick={handleBlockClick}
                    onDelete={(e) => handleDelete(e, phase.id)}
                    onDeleteStep={handleDelete}
                    onDeleteQuestion={handleDelete}
                    onMoveUp={() => onMoveBlock(phase.id, 'up')}
                    onMoveDown={() => onMoveBlock(phase.id, 'down')}
                    onAddStep={() => onAddBlock('step', phase.id)}
                    onAddQuestion={(stepId) => onAddBlock('question', stepId)}
                  />
                ))
              )}
            </AnimatePresence>

            <Card className="border-2 border-dashed border-red-500/50 bg-red-500/5">
              <CardHeader className="py-3 px-4">
                <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
                  <Lock className="h-4 w-4" />
                  <CardTitle className="text-sm font-medium">
                    Sezione Finale
                  </CardTitle>
                  <Badge variant="outline" className="text-[10px]">Obbligatoria</Badge>
                </div>
              </CardHeader>
              <CardContent className="py-2 px-4 text-xs text-muted-foreground">
                Chiusura, CTA, recap e prossimi passi
              </CardContent>
            </Card>
          </div>
        </ScrollArea>
      </div>
    </TooltipProvider>
  );
}

interface PhaseBlockProps {
  phase: Phase;
  phaseIndex: number;
  totalPhases: number;
  isSelected: boolean;
  isExpanded: boolean;
  expandedSteps: string[];
  selectedBlockId: string | null;
  onToggle: () => void;
  onToggleStep: (stepId: string) => void;
  onClick: (e: React.MouseEvent) => void;
  onStepClick: (e: React.MouseEvent, stepId: string) => void;
  onQuestionClick: (e: React.MouseEvent, questionId: string) => void;
  onDelete: (e: React.MouseEvent) => void;
  onDeleteStep: (e: React.MouseEvent, stepId: string) => void;
  onDeleteQuestion: (e: React.MouseEvent, questionId: string) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onAddStep: () => void;
  onAddQuestion: (stepId: string) => void;
}

function PhaseBlock({
  phase,
  phaseIndex,
  totalPhases,
  isSelected,
  isExpanded,
  expandedSteps,
  selectedBlockId,
  onToggle,
  onToggleStep,
  onClick,
  onStepClick,
  onQuestionClick,
  onDelete,
  onDeleteStep,
  onDeleteQuestion,
  onMoveUp,
  onMoveDown,
  onAddStep,
  onAddQuestion
}: PhaseBlockProps) {
  const stepsCount = phase.steps?.length || 0;
  const hasEnergy = !!phase.energy;
  const hasCheckpoint = !!phase.checkpoint;
  
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
    >
      <Card
        onClick={onClick}
        className={cn(
          'transition-all cursor-pointer hover:shadow-md',
          'border-blue-500/30 bg-blue-500/5',
          isSelected && 'ring-2 ring-blue-500 shadow-lg'
        )}
      >
        <CardHeader className="py-3 px-4">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 shrink-0 cursor-grab"
            >
              <GripVertical className="h-3 w-3 text-muted-foreground" />
            </Button>
            
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 shrink-0"
              onClick={(e) => { e.stopPropagation(); onToggle(); }}
            >
              {isExpanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronUp className="h-4 w-4 rotate-180" />
              )}
            </Button>
            
            <Target className="h-4 w-4 text-blue-500 shrink-0" />
            
            <div className="flex-1 min-w-0">
              <CardTitle className="text-sm font-medium flex items-center gap-2 flex-wrap">
                <span>Fase {phase.number}: {phase.name}</span>
                <Badge variant="outline" className="text-[10px]">
                  {stepsCount} step
                </Badge>
                {hasEnergy && (
                  <Tooltip>
                    <TooltipTrigger>
                      <Badge className="bg-yellow-500/20 text-yellow-600 text-[10px]">
                        <Zap className="h-2.5 w-2.5 mr-0.5" />
                        Energy
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent>
                      Livello: {phase.energy?.level}
                    </TooltipContent>
                  </Tooltip>
                )}
                {hasCheckpoint && (
                  <Tooltip>
                    <TooltipTrigger>
                      <Badge className="bg-orange-500/20 text-orange-600 text-[10px]">
                        <AlertOctagon className="h-2.5 w-2.5 mr-0.5" />
                        Check
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent>
                      Checkpoint presente
                    </TooltipContent>
                  </Tooltip>
                )}
              </CardTitle>
              {phase.description && (
                <p className="text-xs text-muted-foreground mt-1 truncate">
                  {phase.description}
                </p>
              )}
            </div>
            
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={(e) => { e.stopPropagation(); onMoveUp(); }}
                disabled={phaseIndex === 0}
              >
                <ChevronUp className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={(e) => { e.stopPropagation(); onMoveDown(); }}
                disabled={phaseIndex === totalPhases - 1}
              >
                <ChevronDown className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-destructive hover:text-destructive"
                onClick={onDelete}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </CardHeader>
        
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
            >
              <CardContent className="pt-0 pb-3 px-4 pl-14 space-y-2">
                {(phase.steps || []).map((step, stepIndex) => (
                  <StepBlock
                    key={step.id}
                    step={step}
                    stepIndex={stepIndex}
                    isSelected={selectedBlockId === step.id}
                    isExpanded={expandedSteps.includes(step.id)}
                    selectedBlockId={selectedBlockId}
                    onToggle={() => onToggleStep(step.id)}
                    onClick={(e) => onStepClick(e, step.id)}
                    onQuestionClick={onQuestionClick}
                    onDelete={(e) => onDeleteStep(e, step.id)}
                    onDeleteQuestion={onDeleteQuestion}
                    onAddQuestion={() => onAddQuestion(step.id)}
                  />
                ))}
                
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full border-2 border-dashed text-muted-foreground hover:text-foreground"
                  onClick={(e) => { e.stopPropagation(); onAddStep(); }}
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Aggiungi Step
                </Button>
              </CardContent>
            </motion.div>
          )}
        </AnimatePresence>
      </Card>
    </motion.div>
  );
}

interface StepBlockProps {
  step: Step;
  stepIndex: number;
  isSelected: boolean;
  isExpanded: boolean;
  selectedBlockId: string | null;
  onToggle: () => void;
  onClick: (e: React.MouseEvent) => void;
  onQuestionClick: (e: React.MouseEvent, questionId: string) => void;
  onDelete: (e: React.MouseEvent) => void;
  onDeleteQuestion: (e: React.MouseEvent, questionId: string) => void;
  onAddQuestion: () => void;
}

function StepBlock({
  step,
  stepIndex,
  isSelected,
  isExpanded,
  selectedBlockId,
  onToggle,
  onClick,
  onQuestionClick,
  onDelete,
  onDeleteQuestion,
  onAddQuestion
}: StepBlockProps) {
  const questionsCount = step.questions?.length || 0;
  const hasLadder = !!step.ladder;
  const hasBiscottino = !!step.biscottino;
  
  return (
    <Card
      onClick={onClick}
      className={cn(
        'transition-all cursor-pointer hover:bg-accent/50',
        'border-green-500/30 bg-green-500/5',
        isSelected && 'ring-2 ring-green-500'
      )}
    >
      <CardHeader className="py-2 px-3">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5 shrink-0"
            onClick={(e) => { e.stopPropagation(); onToggle(); }}
          >
            {isExpanded ? (
              <ChevronDown className="h-3 w-3" />
            ) : (
              <ChevronUp className="h-3 w-3 rotate-180" />
            )}
          </Button>
          
          <CheckSquare className="h-3.5 w-3.5 text-green-500 shrink-0" />
          
          <div className="flex-1 min-w-0">
            <CardTitle className="text-xs font-medium flex items-center gap-2 flex-wrap">
              <span>Step {step.number}: {step.name}</span>
              <Badge variant="outline" className="text-[9px]">
                {questionsCount} dom.
              </Badge>
              {hasLadder && (
                <Badge className="bg-indigo-500/20 text-indigo-600 text-[9px]">
                  <Layers className="h-2 w-2 mr-0.5" />
                  Ladder
                </Badge>
              )}
              {hasBiscottino && (
                <Badge className="bg-amber-500/20 text-amber-600 text-[9px]">
                  <Cookie className="h-2 w-2 mr-0.5" />
                </Badge>
              )}
            </CardTitle>
          </div>
          
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5 text-destructive hover:text-destructive"
            onClick={onDelete}
          >
            <Trash2 className="h-2.5 w-2.5" />
          </Button>
        </div>
      </CardHeader>
      
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
          >
            <CardContent className="pt-0 pb-2 px-3 pl-10 space-y-1">
              {(step.questions || []).map((question, qIndex) => (
                <QuestionBlock
                  key={question.id}
                  question={question}
                  isSelected={selectedBlockId === question.id}
                  onClick={(e) => onQuestionClick(e, question.id)}
                  onDelete={(e) => onDeleteQuestion(e, question.id)}
                />
              ))}
              
              <Button
                variant="ghost"
                size="sm"
                className="w-full h-7 text-xs border border-dashed text-muted-foreground hover:text-foreground"
                onClick={(e) => { e.stopPropagation(); onAddQuestion(); }}
              >
                <Plus className="h-2.5 w-2.5 mr-1" />
                Domanda
              </Button>
            </CardContent>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}

interface QuestionBlockProps {
  question: Question;
  isSelected: boolean;
  onClick: (e: React.MouseEvent) => void;
  onDelete: (e: React.MouseEvent) => void;
}

function QuestionBlock({ question, isSelected, onClick, onDelete }: QuestionBlockProps) {
  return (
    <div
      onClick={onClick}
      className={cn(
        'flex items-center gap-2 p-2 rounded-md transition-all cursor-pointer',
        'bg-purple-500/5 border border-purple-500/20 hover:bg-purple-500/10',
        isSelected && 'ring-2 ring-purple-500'
      )}
    >
      <MessageSquare className="h-3 w-3 text-purple-500 shrink-0" />
      <p className="flex-1 text-xs truncate">
        {question.text}
      </p>
      {question.isKey && (
        <Badge className="bg-purple-500/20 text-purple-600 text-[9px]">
          Key
        </Badge>
      )}
      <Button
        variant="ghost"
        size="icon"
        className="h-5 w-5 opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive"
        onClick={onDelete}
      >
        <Trash2 className="h-2.5 w-2.5" />
      </Button>
    </div>
  );
}
