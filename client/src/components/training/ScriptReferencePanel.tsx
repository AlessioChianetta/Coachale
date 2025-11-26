import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CheckCircle, Circle, AlertCircle, XCircle, Clock, Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState } from 'react';

interface ScriptReferencePanelProps {
  scriptStructure: any;
  conversationDetail: any;
  selectedPhaseId: string | null;
  onSelectPhase: (phaseId: string) => void;
}

export function ScriptReferencePanel({
  scriptStructure,
  conversationDetail,
  selectedPhaseId,
  onSelectPhase,
}: ScriptReferencePanelProps) {
  const [showDetails, setShowDetails] = useState(false);
  
  console.log('[ScriptReferencePanel] Rendering with:', {
    hasScriptStructure: !!scriptStructure,
    hasConversationDetail: !!conversationDetail,
    phaseCount: scriptStructure?.phases?.length || 0,
    selectedPhaseId,
    showDetails
  });

  if (!scriptStructure || !scriptStructure.phases) {
    console.error('[ScriptReferencePanel] Missing scriptStructure or phases');
    return (
      <div className="h-full flex items-center justify-center p-8 text-center">
        <div>
          <p className="text-red-600 font-semibold">Errore: Script structure non disponibile</p>
          <p className="text-sm text-muted-foreground mt-2">Verifica che il file sales-script-structure.json sia presente</p>
        </div>
      </div>
    );
  }

  if (!conversationDetail) {
    console.error('[ScriptReferencePanel] Missing conversationDetail');
    return (
      <div className="h-full flex items-center justify-center p-8 text-center">
        <p className="text-muted-foreground">Caricamento dati conversazione...</p>
      </div>
    );
  }

  const getPhaseStatus = (phaseId: string) => {
    const isReached = conversationDetail.phasesReached.includes(phaseId);
    const isCurrent = conversationDetail.currentPhase === phaseId;
    const hasCheckpoint = scriptStructure.phases
      .find((p: any) => p.id === phaseId)
      ?.checkpoints.some((cp: any) =>
        conversationDetail.checkpointsCompleted.some(
          (completed: any) => completed.checkpointId === cp.id
        )
      );

    if (!isReached) return { icon: Circle, color: 'text-gray-400', label: 'Non raggiunto' };
    if (isCurrent) return { icon: Clock, color: 'text-yellow-500', label: 'In corso' };
    if (hasCheckpoint) return { icon: CheckCircle, color: 'text-green-500', label: 'Completato' };
    return { icon: AlertCircle, color: 'text-orange-500', label: 'Parziale' };
  };

  const getLadderStatus = (phase: any) => {
    const ladders = conversationDetail.ladderActivations.filter(
      (l: any) => l.phase === phase.id
    );
    const count = ladders.length;
    const vagueCount = ladders.filter((l: any) => l.wasVague).length;

    if (count === 0) return null;
    if (count >= 3 && count <= 5 && vagueCount === 0)
      return { color: 'bg-green-100 text-green-800', text: `${count}x ✓` };
    if (count > 5)
      return { color: 'bg-orange-100 text-orange-800', text: `${count}x ⚠️ Alto` };
    if (vagueCount > 0)
      return { color: 'bg-red-100 text-red-800', text: `${count}x (${vagueCount} vague)` };
    return { color: 'bg-yellow-100 text-yellow-800', text: `${count}x` };
  };

  return (
    <div className="h-full flex flex-col bg-muted/30">
      <div className="p-4 border-b bg-card space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-lg flex items-center gap-2">
            📖 Sales Script
            <Badge variant="outline">
              v{scriptStructure.version}
            </Badge>
          </h2>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowDetails(!showDetails)}
            className={cn("gap-2", showDetails && "bg-accent")}
          >
            {showDetails ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            {showDetails ? 'Nascondi domande' : 'Mostra domande'}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          {scriptStructure.metadata.totalPhases} fasi • {scriptStructure.metadata.totalSteps} step •{' '}
          {scriptStructure.metadata.totalCheckpoints} checkpoint
        </p>
      </div>

      <ScrollArea className="flex-1">
        <Accordion type="multiple" className="px-4 py-2">
          {scriptStructure.phases.map((phase: any) => {
            const status = getPhaseStatus(phase.id);
            const ladderStatus = getLadderStatus(phase);
            const isSelected = selectedPhaseId === phase.id;
            const StatusIcon = status.icon;

            return (
              <AccordionItem key={phase.id} value={phase.id}>
                <AccordionTrigger
                  className={cn(
                    'hover:no-underline hover:bg-accent/50 px-3 rounded-md transition-colors',
                    isSelected && 'bg-accent'
                  )}
                  onClick={() => onSelectPhase(phase.id)}
                >
                  <div className="flex items-start gap-2 w-full">
                    <StatusIcon className={cn('h-5 w-5 mt-0.5', status.color)} />
                    <div className="flex-1 text-left">
                      <div className="font-semibold text-sm flex items-center flex-wrap gap-1">
                        FASE {phase.number} - {phase.name}
                        {phase.energySettings && (
                          <Badge className={cn(
                            'text-xs ml-2',
                            phase.energySettings.level === 'ALTO' && 'bg-red-500 text-white',
                            phase.energySettings.level === 'MEDIO' && 'bg-yellow-500 text-black',
                            phase.energySettings.level === 'BASSO' && 'bg-blue-500 text-white'
                          )}>
                            ⚡ {phase.energySettings.level}
                          </Badge>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {phase.description}
                      </div>
                      <div className="flex gap-1 mt-2">
                        <Badge variant="outline" className="text-xs">
                          {status.label}
                        </Badge>
                        {ladderStatus && (
                          <Badge className={cn('text-xs', ladderStatus.color)}>
                            🔍 {ladderStatus.text}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-3 pt-2 space-y-3">
                  {(() => {
                    const phaseActivation = conversationDetail.phaseActivations?.find(
                      (a: any) => a.phase === phase.id
                    );
                    
                    const isReached = conversationDetail.phasesReached.includes(phase.id);
                    
                    if (phaseActivation) {
                      return (
                        <div className="p-4 bg-indigo-50 dark:bg-indigo-950/30 border-2 border-indigo-200 dark:border-indigo-800 rounded-lg">
                          <h4 className="font-semibold text-sm mb-3 flex items-center gap-2">
                            🎯 Perché l'AI ha attivato questa fase
                          </h4>
                          <div className="space-y-2 text-xs">
                            {phaseActivation.reasoning && (
                              <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded border border-blue-200 dark:border-blue-800">
                                <p className="leading-relaxed text-blue-900 dark:text-blue-100">
                                  {phaseActivation.reasoning}
                                </p>
                              </div>
                            )}
                            
                            {phaseActivation.matchedQuestion && (
                              <div>
                                <span className="text-muted-foreground font-semibold">Domanda matchata:</span>
                                <div className="mt-1 p-2 bg-white dark:bg-gray-800 rounded border text-xs italic">
                                  "{phaseActivation.matchedQuestion}"
                                </div>
                              </div>
                            )}
                            
                            {phaseActivation.keywordsMatched && phaseActivation.keywordsMatched.length > 0 && (
                              <div>
                                <span className="text-muted-foreground font-semibold">Keywords:</span>
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {phaseActivation.keywordsMatched.map((kw: string, idx: number) => (
                                    <Badge key={idx} variant="secondary" className="text-xs">
                                      🔑 {kw}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            )}
                            
                            {phaseActivation.similarity !== undefined && (
                              <div className="flex items-center gap-2">
                                <span className="text-muted-foreground font-semibold">Match:</span>
                                <Badge 
                                  className={cn(
                                    "text-xs",
                                    phaseActivation.similarity >= 0.8 && "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100",
                                    phaseActivation.similarity >= 0.6 && phaseActivation.similarity < 0.8 && "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100",
                                    phaseActivation.similarity < 0.6 && "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-100"
                                  )}
                                >
                                  {(phaseActivation.similarity * 100).toFixed(0)}%
                                </Badge>
                              </div>
                            )}
                            
                            {phaseActivation.timestamp && (
                              <div className="text-muted-foreground pt-2 border-t">
                                🕒 {new Date(phaseActivation.timestamp).toLocaleString('it-IT')}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    }
                    
                    // Empty state: nessun ragionamento disponibile
                    return (
                      <div className="p-4 bg-gray-50 dark:bg-gray-900/30 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg">
                        <div className="flex items-start gap-3">
                          <div className="text-2xl">
                            {!isReached ? '🔒' : '💭'}
                          </div>
                          <div>
                            <h4 className="font-semibold text-sm text-gray-700 dark:text-gray-300 mb-1">
                              {!isReached ? 'Fase non ancora raggiunta' : 'Nessun ragionamento AI disponibile'}
                            </h4>
                            <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                              {!isReached 
                                ? 'Questa fase non è stata ancora raggiunta durante la conversazione. I ragionamenti dell\'AI saranno visibili qui quando la fase verrà attivata.'
                                : 'L\'AI ha raggiunto questa fase ma non sono disponibili dati sul ragionamento utilizzato per l\'attivazione. Questo può accadere per fasi raggiunte automaticamente o durante la fase di test iniziale.'
                              }
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                  
                  {phase.steps.map((step: any, idx: number) => (
                    <div
                      key={step.id}
                      className="pl-7 py-2 border-l-2 border-muted-foreground/20"
                    >
                      <div className="text-sm font-medium">
                        Step {step.number}: {step.name}
                      </div>
                      {step.objective && (
                        <div className="text-xs text-muted-foreground mt-1">
                          {step.objective}
                        </div>
                      )}
                      <div className="flex flex-wrap gap-1">
                        {step.hasLadder && (
                          <Badge variant="secondary" className="text-xs mt-2 flex items-center gap-1">
                            🪜 Ladder • {step.ladderLevels?.length || 5} livelli
                          </Badge>
                        )}
                        {step.questions && step.questions.length > 0 && (
                          <Badge variant="outline" className="text-xs mt-2 ml-1">
                            ❓ {step.questions.length} domande
                          </Badge>
                        )}
                      </div>
                      
                      {showDetails && step.questions && step.questions.length > 0 && (
                        <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
                          <div className="text-xs font-semibold text-blue-900 dark:text-blue-100 mb-2">
                            💬 Domande dello script:
                          </div>
                          <ul className="space-y-1.5">
                            {step.questions.map((q: any, qIdx: number) => {
                              // Check if this question was asked
                              const askedQuestion = conversationDetail.questionsAsked?.find((qa: any) => {
                                const questionTextLower = q.text.toLowerCase();
                                const askedTextLower = qa.question.toLowerCase();
                                // Simple similarity check
                                return askedTextLower.includes(questionTextLower.substring(0, 30)) || 
                                       questionTextLower.includes(askedTextLower.substring(0, 30));
                              });
                              
                              return (
                                <li key={qIdx} className="text-xs text-blue-800 dark:text-blue-200 flex items-start gap-2">
                                  <span className="text-blue-600 dark:text-blue-400 font-medium">{qIdx + 1}.</span>
                                  <div className="flex-1">
                                    <div className="flex items-start gap-2">
                                      <span className={cn("flex-1", askedQuestion && "font-semibold")}>
                                        "{q.text}"
                                      </span>
                                      {askedQuestion && (
                                        <Badge variant="secondary" className="text-xs bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">
                                          ✓ Fatta
                                        </Badge>
                                      )}
                                    </div>
                                    {askedQuestion && (
                                      <div className="text-xs text-muted-foreground mt-1">
                                        🕒 {new Date(askedQuestion.timestamp).toLocaleTimeString('it-IT')}
                                      </div>
                                    )}
                                  </div>
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                      )}
                    </div>
                  ))}

                  {phase.checkpoints.map((cp: any) => {
                    const isCompleted = conversationDetail.checkpointsCompleted.some(
                      (c: any) => c.checkpointId === cp.id
                    );

                    return (
                      <div
                        key={cp.id}
                        className={cn(
                          'p-3 rounded-lg border-2 text-sm',
                          isCompleted
                            ? 'bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-800'
                            : 'bg-yellow-50 border-yellow-200 dark:bg-yellow-950/30 dark:border-yellow-800'
                        )}
                      >
                        <div className="font-semibold flex items-center gap-2">
                          {isCompleted ? (
                            <CheckCircle className="h-4 w-4 text-green-600" />
                          ) : (
                            <Clock className="h-4 w-4 text-yellow-600" />
                          )}
                          Checkpoint: {cp.id}
                        </div>
                        <ul className="mt-2 space-y-1 text-xs">
                          {cp.verifications.map((v: string, idx: number) => (
                            <li key={idx} className="flex items-start gap-2">
                              <span className="text-muted-foreground">•</span>
                              <span>{v}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    );
                  })}
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      </ScrollArea>
    </div>
  );
}
