import React from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { ScriptBlockStructure, Phase, Step, Question, ScriptBlock } from '@shared/script-blocks';
import { cn } from '@/lib/utils';
import { Target, CheckSquare, MessageSquare, Plus, Trash2, Zap } from 'lucide-react';

interface EnergySettingsData {
  level: 'BASSO' | 'MEDIO' | 'ALTO';
  tone?: string;
  volume?: string;
  pace?: string;
  vocabulary?: string;
}

interface LadderData {
  hasLadder: boolean;
  levels?: Array<{ level: number; text: string; purpose: string }>;
}

interface BlockEditorProps {
  structure: ScriptBlockStructure;
  selectedBlock: ScriptBlock | null;
  onSelectBlock: (block: ScriptBlock) => void;
  onAddBlock: (type: 'phase' | 'step' | 'question', parentId?: string) => void;
  onDeleteBlock: (blockId: string) => void;
  isEditing: boolean;
  energySettings?: Record<string, EnergySettingsData>;
  ladderOverrides?: Record<string, LadderData>;
  stepQuestions?: Record<string, Array<{ id: string; text: string; order: number }>>;
}

const getEnergyColor = (level?: string) => {
  switch (level) {
    case 'BASSO': return 'bg-blue-500 text-white';
    case 'MEDIO': return 'bg-yellow-500 text-black';
    case 'ALTO': return 'bg-red-500 text-white';
    default: return 'bg-gray-300 text-gray-700';
  }
};

export function BlockEditor({ 
  structure, 
  selectedBlock, 
  onSelectBlock, 
  onAddBlock, 
  onDeleteBlock, 
  isEditing,
  energySettings,
  ladderOverrides,
  stepQuestions
}: BlockEditorProps) {
  
  const handleSelect = (e: React.MouseEvent, block: ScriptBlock) => {
    if (!isEditing) return;
    e.stopPropagation();
    onSelectBlock(block);
  };

  const handleDelete = (e: React.MouseEvent, blockId: string) => {
    e.stopPropagation();
    if (confirm('Sei sicuro di voler eliminare questo blocco e tutto il suo contenuto?')) {
      onDeleteBlock(blockId);
    }
  };

  return (
    <div className="space-y-4">
      {structure.phases.map(phase => {
        const phaseEnergy = energySettings?.[phase.id];
        const hasCheckpoint = !!(phase.checkpoint);
        
        return (
          <Card
            key={phase.id}
            onClick={(e) => handleSelect(e, phase)}
            className={cn(
              isEditing ? 'cursor-pointer' : 'cursor-default',
              'transition-all hover:shadow-md',
              selectedBlock?.id === phase.id && 'ring-2 ring-primary'
            )}
          >
            <CardHeader>
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Target className="h-4 w-4" />
                    Fase {phase.number}: {phase.name}
                    {phaseEnergy && (
                      <Badge className={cn('ml-2 text-xs', getEnergyColor(phaseEnergy.level))}>
                        <Zap className="h-3 w-3 mr-1" />
                        {phaseEnergy.level}
                      </Badge>
                    )}
                    {hasCheckpoint && (
                      <span className="ml-2 text-sm" title="Fase con checkpoint">⛔</span>
                    )}
                  </CardTitle>
                  <CardDescription className="pt-1">{phase.description}</CardDescription>
                </div>
                {isEditing && (
                  <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={(e) => handleDelete(e, phase.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-3 pl-10">
              {(phase.steps || []).map(step => {
                const stepEnergy = energySettings?.[step.id];
                const stepLadder = ladderOverrides?.[step.id];
                const stepQuestionsData = stepQuestions?.[step.id];
                const questionsCount = stepQuestionsData?.length || (step.questions || []).length;
                const hasLadder = stepLadder?.hasLadder || !!(step.ladder);
                
                return (
                  <Card
                    key={step.id}
                    onClick={(e) => handleSelect(e, step)}
                    className={cn(
                      isEditing ? 'cursor-pointer' : 'cursor-default',
                      'transition-all hover:bg-muted/50',
                      selectedBlock?.id === step.id && 'ring-2 ring-indigo-500'
                    )}
                  >
                    <CardHeader className="p-3">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <CardTitle className="flex items-center gap-2 text-sm flex-wrap">
                            <CheckSquare className="h-4 w-4" />
                            <span>Step {step.number}: {step.name}</span>
                            {stepEnergy && (
                              <Badge className={cn('text-xs', getEnergyColor(stepEnergy.level))}>
                                <Zap className="h-3 w-3 mr-1" />
                                {stepEnergy.level}
                              </Badge>
                            )}
                            {hasLadder && (
                              <span className="text-sm" title="Ladder dei Perché">🪜</span>
                            )}
                            {questionsCount > 0 && (
                              <Badge variant="secondary" className="text-xs">
                                <MessageSquare className="h-3 w-3 mr-1" />
                                {questionsCount} {questionsCount === 1 ? 'domanda' : 'domande'}
                              </Badge>
                            )}
                          </CardTitle>
                          {step.objective && <CardDescription className="text-xs pt-1">{step.objective}</CardDescription>}
                        </div>
                        {isEditing && (
                          <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={(e) => handleDelete(e, step.id)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                      </div>
                    </CardHeader>
                    {(step.questions || []).length > 0 && (
                      <CardContent className="space-y-2 p-3 pt-0 pl-8">
                        {(step.questions || []).map(question => (
                          <div
                            key={question.id}
                            onClick={(e) => handleSelect(e, question)}
                            className={cn(
                              'group flex items-start gap-2 relative',
                              isEditing ? 'cursor-pointer' : 'cursor-default',
                              'p-2 rounded text-xs text-muted-foreground transition-all hover:bg-muted',
                              selectedBlock?.id === question.id && 'ring-1 ring-blue-500 bg-blue-500/10 text-blue-900 dark:text-blue-200'
                            )}
                          >
                            <MessageSquare className="h-3 w-3 mt-0.5 shrink-0" />
                            <span className="flex-1">{question.text}</span>
                            {isEditing && (
                              <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0 opacity-0 group-hover:opacity-100" onClick={(e) => handleDelete(e, question.id)}>
                                <Trash2 className="h-3 w-3 text-destructive" />
                              </Button>
                            )}
                          </div>
                        ))}
                      </CardContent>
                    )}
                    {isEditing && (
                      <CardContent className="p-3 pt-0">
                        <Button variant="outline" size="xs" className="w-full border-dashed" onClick={(e) => { e.stopPropagation(); onAddBlock('question', step.id); }}>
                          <Plus className="h-3 w-3 mr-1" /> Aggiungi Domanda
                        </Button>
                      </CardContent>
                    )}
                  </Card>
                );
              })}
              {isEditing && (
                <Button variant="outline" size="sm" className="w-full border-dashed" onClick={(e) => { e.stopPropagation(); onAddBlock('step', phase.id); }}>
                  <Plus className="h-4 w-4 mr-2" /> Aggiungi Step
                </Button>
              )}
            </CardContent>
          </Card>
        );
      })}
      {isEditing && (
        <Button variant="outline" size="lg" className="w-full border-dashed" onClick={() => onAddBlock('phase')}>
          <Plus className="h-5 w-5 mr-2" /> Aggiungi Nuova Fase
        </Button>
      )}
    </div>
  );
}
