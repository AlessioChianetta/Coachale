import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { CheckCircle, AlertCircle, XCircle, Clock, ArrowDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface VisualFlowRoadmapProps {
  scriptStructure: any;
  conversationDetail: any;
  selectedPhaseId: string | null;
  onSelectPhase: (phaseId: string) => void;
}

export function VisualFlowRoadmap({
  scriptStructure,
  conversationDetail,
  selectedPhaseId,
  onSelectPhase,
}: VisualFlowRoadmapProps) {
  console.log('[VisualFlowRoadmap] Rendering with:', {
    hasScriptStructure: !!scriptStructure,
    hasConversationDetail: !!conversationDetail,
    phaseCount: scriptStructure?.phases?.length || 0,
    reachedPhases: conversationDetail?.phasesReached?.length || 0
  });

  if (!scriptStructure || !scriptStructure.phases) {
    console.error('[VisualFlowRoadmap] Missing scriptStructure');
    return (
      <div className="h-full flex items-center justify-center p-8 text-center">
        <div>
          <p className="text-red-600 font-semibold">Errore: Script structure non disponibile</p>
        </div>
      </div>
    );
  }

  if (!conversationDetail || !conversationDetail.fullTranscript) {
    console.error('[VisualFlowRoadmap] Missing conversationDetail');
    return (
      <div className="h-full flex items-center justify-center p-8 text-center">
        <p className="text-muted-foreground">Caricamento transcript...</p>
      </div>
    );
  }

  const getPhaseTimeRange = (phaseId: string) => {
    const phaseMessages = conversationDetail.fullTranscript.filter(
      (m: any) => m.phase === phaseId
    );
    if (phaseMessages.length === 0) return null;

    const firstMsg = new Date(phaseMessages[0].timestamp);
    const lastMsg = new Date(phaseMessages[phaseMessages.length - 1].timestamp);
    const duration = Math.floor((lastMsg.getTime() - firstMsg.getTime()) / 1000);

    return {
      start: firstMsg.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }),
      end: lastMsg.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }),
      duration: `${Math.floor(duration / 60)}m ${duration % 60}s`,
    };
  };

  const getPhaseStatus = (phaseId: string) => {
    const isReached = conversationDetail.phasesReached.includes(phaseId);
    const isCurrent = conversationDetail.currentPhase === phaseId;

    if (!isReached) return { color: 'border-gray-300 bg-gray-50', icon: XCircle, label: 'Non raggiunto' };
    if (isCurrent) return { color: 'border-yellow-400 bg-yellow-50', icon: Clock, label: 'In corso' };
    return { color: 'border-green-400 bg-green-50', icon: CheckCircle, label: 'Completato' };
  };

  const reachedPhases = scriptStructure.phases.filter((p: any) =>
    conversationDetail.phasesReached.includes(p.id)
  );

  return (
    <div className="h-full flex flex-col bg-background">
      <div className="p-4 border-b bg-card">
        <h2 className="font-semibold text-lg">🗺️ Conversation Journey</h2>
        <p className="text-xs text-muted-foreground mt-1">
          Timeline visivo del percorso di vendita
        </p>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-6 space-y-4">
          <div className="text-center py-2">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-green-100 text-green-800 font-semibold">
              🟢 START
            </div>
          </div>

          {reachedPhases.map((phase: any, idx: number) => {
            const status = getPhaseStatus(phase.id);
            const timeRange = getPhaseTimeRange(phase.id);
            const isSelected = selectedPhaseId === phase.id;
            const ladders = conversationDetail.ladderActivations.filter(
              (l: any) => l.phase === phase.id
            );
            const checkpoints = phase.checkpoints.filter((cp: any) =>
              conversationDetail.checkpointsCompleted.some(
                (c: any) => c.checkpointId === cp.id
              )
            );

            const StatusIcon = status.icon;

            return (
              <div key={phase.id} className="relative">
                {idx > 0 && (
                  <div className="flex justify-center my-2">
                    <ArrowDown className="h-6 w-6 text-muted-foreground" />
                  </div>
                )}

                <Card
                  className={cn(
                    'p-4 cursor-pointer transition-all border-2',
                    status.color,
                    isSelected && 'ring-2 ring-primary'
                  )}
                  onClick={() => onSelectPhase(phase.id)}
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <StatusIcon className={cn('h-5 w-5', status.icon === CheckCircle && 'text-green-600', status.icon === Clock && 'text-yellow-600')} />
                        <div>
                          <div className="font-bold text-sm">
                            FASE {phase.number}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {phase.name}
                          </div>
                        </div>
                      </div>
                      <Badge variant="outline">{status.label}</Badge>
                    </div>

                    {timeRange && (
                      <div className="text-xs text-muted-foreground flex items-center gap-2">
                        <Clock className="h-3 w-3" />
                        {timeRange.start} → {timeRange.end} ({timeRange.duration})
                      </div>
                    )}

                    <div className="flex flex-wrap gap-2 text-xs">
                      {checkpoints.length > 0 && (
                        <div className="flex items-center gap-1 text-green-600">
                          <CheckCircle className="h-3 w-3" />
                          <span>{checkpoints.length} Checkpoint ✓</span>
                        </div>
                      )}
                      {ladders.length > 0 && (
                        <div
                          className={cn(
                            'flex items-center gap-1',
                            ladders.length >= 3 && ladders.length <= 5
                              ? 'text-green-600'
                              : 'text-orange-600'
                          )}
                        >
                          <span>🔍 Ladder: {ladders.length}x</span>
                          {ladders.length > 5 && <span>⚠️</span>}
                        </div>
                      )}
                      {ladders.filter((l: any) => l.wasVague).length > 0 && (
                        <div className="flex items-center gap-1 text-red-600">
                          <AlertCircle className="h-3 w-3" />
                          {ladders.filter((l: any) => l.wasVague).length} Vague
                        </div>
                      )}
                    </div>
                  </div>
                </Card>
              </div>
            );
          })}

          {conversationDetail.phasesReached.length < scriptStructure.phases.length && (
            <div className="text-center py-4">
              <div className="flex justify-center mb-2">
                <ArrowDown className="h-6 w-6 text-muted-foreground" />
              </div>
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-red-100 text-red-800 font-semibold">
                ⏸️ DROP-OFF
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Conversazione interrotta • Completamento: {Math.round(conversationDetail.completionRate * 100)}%
              </p>
            </div>
          )}

          <div className="mt-8 p-4 bg-muted rounded-lg">
            <h3 className="font-semibold mb-3">📊 Summary Metrics</h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <div className="text-muted-foreground">Durata Totale</div>
                <div className="font-semibold">
                  {Math.floor(conversationDetail.totalDuration / 60)}m{' '}
                  {conversationDetail.totalDuration % 60}s
                </div>
              </div>
              <div>
                <div className="text-muted-foreground">Fasi Raggiunte</div>
                <div className="font-semibold">
                  {conversationDetail.phasesReached.length} / {scriptStructure.metadata.totalPhases}
                </div>
              </div>
              <div>
                <div className="text-muted-foreground">Checkpoint</div>
                <div className="font-semibold">
                  {conversationDetail.checkpointsCompleted.length} /{' '}
                  {scriptStructure.metadata.totalCheckpoints}
                </div>
              </div>
              <div>
                <div className="text-muted-foreground">Completamento</div>
                <div className="font-semibold">
                  {Math.round(conversationDetail.completionRate * 100)}%
                </div>
              </div>
            </div>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
