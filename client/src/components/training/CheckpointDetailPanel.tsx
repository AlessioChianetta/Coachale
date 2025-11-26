import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { CheckCircle, Clock, XCircle, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CheckpointDetailPanelProps {
  scriptStructure: any;
  conversationDetail: any;
  selectedPhaseId: string | null;
}

export function CheckpointDetailPanel({
  scriptStructure,
  conversationDetail,
  selectedPhaseId,
}: CheckpointDetailPanelProps) {
  if (!scriptStructure || !scriptStructure.phases) {
    return (
      <div className="h-full flex flex-col bg-muted/30">
        <div className="p-4 border-b bg-card">
          <h2 className="font-semibold text-lg">🎯 Checkpoint Verification</h2>
        </div>
        <div className="flex-1 flex items-center justify-center text-center p-8">
          <div>
            <p className="text-red-600 font-semibold">Errore: Script structure non disponibile</p>
          </div>
        </div>
      </div>
    );
  }

  if (!conversationDetail) {
    return (
      <div className="h-full flex flex-col bg-muted/30">
        <div className="p-4 border-b bg-card">
          <h2 className="font-semibold text-lg">🎯 Checkpoint Verification</h2>
        </div>
        <div className="flex-1 flex items-center justify-center text-center p-8">
          <p className="text-muted-foreground">Caricamento dati conversazione...</p>
        </div>
      </div>
    );
  }

  const selectedPhase = scriptStructure.phases.find(
    (p: any) => p.id === selectedPhaseId
  );

  if (!selectedPhase) {
    return (
      <div className="h-full flex flex-col bg-muted/30">
        <div className="p-4 border-b bg-card">
          <h2 className="font-semibold text-lg">🎯 Checkpoint Verification</h2>
        </div>
        <div className="flex-1 flex items-center justify-center text-center p-8">
          <div>
            <p className="text-muted-foreground">
              Seleziona una fase per visualizzare i checkpoint
            </p>
          </div>
        </div>
      </div>
    );
  }

  const phaseCheckpoints = selectedPhase.checkpoints || [];

  const highlightKeywords = (text: string, keywords: string[]): JSX.Element => {
    if (!keywords || keywords.length === 0) {
      return <>{text}</>;
    }

    let highlightedText = text;
    const spans: Array<{ start: number; end: number; keyword: string }> = [];

    keywords.forEach(keyword => {
      const regex = new RegExp(`\\b(${keyword})\\b`, 'gi');
      let match;
      while ((match = regex.exec(text)) !== null) {
        spans.push({
          start: match.index,
          end: match.index + match[0].length,
          keyword: match[0]
        });
      }
    });

    spans.sort((a, b) => a.start - b.start);

    const parts: JSX.Element[] = [];
    let lastIndex = 0;

    spans.forEach((span, idx) => {
      if (span.start > lastIndex) {
        parts.push(<span key={`text-${idx}`}>{text.substring(lastIndex, span.start)}</span>);
      }
      parts.push(
        <mark key={`mark-${idx}`} className="bg-yellow-200 dark:bg-yellow-900 font-semibold px-0.5 rounded">
          {span.keyword}
        </mark>
      );
      lastIndex = span.end;
    });

    if (lastIndex < text.length) {
      parts.push(<span key="text-end">{text.substring(lastIndex)}</span>);
    }

    return <>{parts}</>;
  };

  const getStatusIcon = (status: "verified" | "pending" | "failed") => {
    switch (status) {
      case "verified":
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case "pending":
        return <Clock className="h-4 w-4 text-yellow-600" />;
      case "failed":
        return <XCircle className="h-4 w-4 text-red-600" />;
    }
  };

  const getStatusBadge = (status: "verified" | "pending" | "failed") => {
    switch (status) {
      case "verified":
        return <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100 border-green-300">✅ Verificato</Badge>;
      case "pending":
        return <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100 border-yellow-300">⏳ In attesa</Badge>;
      case "failed":
        return <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100 border-red-300">❌ Fallito</Badge>;
    }
  };

  const getCheckpointStatus = (checkpointId: string) => {
    const completed = conversationDetail.checkpointsCompleted.find(
      (c: any) => c.checkpointId === checkpointId
    );
    return completed || null;
  };

  const getTrafficLight = (status?: "completed" | "pending" | "failed") => {
    if (!status || status === "completed") return "🟢";
    if (status === "pending") return "🟡";
    if (status === "failed") return "🔴";
    return "⚪";
  };

  return (
    <div className="h-full flex flex-col bg-muted/30">
      <div className="p-4 border-b bg-card">
        <h2 className="font-semibold text-lg">🎯 Checkpoint Verification</h2>
        <p className="text-xs text-muted-foreground mt-1">
          Sistema a semaforo con evidenze del transcript
        </p>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          <Card className="p-4">
            <h3 className="font-semibold text-sm mb-2">📌 Fase Selezionata</h3>
            <div className="space-y-2 text-sm">
              <div>
                <span className="text-muted-foreground">Fase:</span>{' '}
                <span className="font-medium">
                  FASE {selectedPhase.number} - {selectedPhase.name}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Checkpoint Totali:</span>{' '}
                <Badge variant="outline">{phaseCheckpoints.length}</Badge>
              </div>
            </div>
          </Card>

          {phaseCheckpoints.length === 0 ? (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle className="text-sm">Nessun Checkpoint</AlertTitle>
              <AlertDescription className="text-xs mt-1">
                Questa fase non ha checkpoint configurati.
              </AlertDescription>
            </Alert>
          ) : (
            <div className="space-y-4">
              {phaseCheckpoints.map((checkpoint: any, idx: number) => {
                const checkpointData = getCheckpointStatus(checkpoint.id);
                const hasNewFormat = checkpointData && Array.isArray(checkpointData.verifications) && 
                  checkpointData.verifications.length > 0 &&
                  typeof checkpointData.verifications[0] === 'object' &&
                  'status' in checkpointData.verifications[0];

                const overallStatus = checkpointData?.status || (checkpointData ? "completed" : undefined);
                const trafficLight = getTrafficLight(overallStatus);

                return (
                  <Card key={idx} className="p-4 border-2">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">{trafficLight}</span>
                        <div>
                          <h4 className="font-semibold text-sm">{checkpoint.name}</h4>
                          <p className="text-xs text-muted-foreground">{checkpoint.description}</p>
                        </div>
                      </div>
                      {checkpointData && (
                        <Badge variant="secondary" className="text-xs">
                          {new Date(checkpointData.completedAt).toLocaleString('it-IT')}
                        </Badge>
                      )}
                    </div>

                    {!checkpointData ? (
                      <Alert className="mt-3">
                        <Clock className="h-4 w-4" />
                        <AlertTitle className="text-sm">Non Completato</AlertTitle>
                        <AlertDescription className="text-xs mt-1">
                          Questo checkpoint non è stato ancora completato durante la conversazione.
                        </AlertDescription>
                      </Alert>
                    ) : hasNewFormat ? (
                      <div className="space-y-3 mt-3">
                        <h5 className="text-xs font-semibold text-muted-foreground uppercase">
                          Verifiche ({checkpointData.verifications.length})
                        </h5>
                        {checkpointData.verifications.map((verification: any, vIdx: number) => (
                          <Card 
                            key={vIdx}
                            className={cn(
                              "p-3 border",
                              verification.status === "verified" && "bg-green-50 dark:bg-green-900/10 border-green-300",
                              verification.status === "pending" && "bg-yellow-50 dark:bg-yellow-900/10 border-yellow-300",
                              verification.status === "failed" && "bg-red-50 dark:bg-red-900/10 border-red-300"
                            )}
                          >
                            <div className="flex items-start gap-2">
                              {getStatusIcon(verification.status)}
                              <div className="flex-1 space-y-2">
                                <div className="flex items-center justify-between">
                                  <p className="text-sm font-medium">{verification.requirement}</p>
                                  {getStatusBadge(verification.status)}
                                </div>

                                {verification.evidence && (
                                  <div className="mt-2 space-y-2">
                                    <div className="bg-white dark:bg-gray-800 p-3 rounded border border-gray-200 dark:border-gray-700">
                                      <p className="text-xs font-mono text-muted-foreground mb-1">
                                        📝 Evidence from transcript:
                                      </p>
                                      <p className="text-sm leading-relaxed">
                                        {highlightKeywords(
                                          verification.evidence.excerpt,
                                          verification.evidence.matchedKeywords || []
                                        )}
                                      </p>
                                      <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                                        <span className="flex items-center gap-1">
                                          🕒 {new Date(verification.evidence.timestamp).toLocaleTimeString('it-IT')}
                                        </span>
                                        {verification.evidence.matchedKeywords && verification.evidence.matchedKeywords.length > 0 && (
                                          <span className="flex items-center gap-1">
                                            🔑 Keywords: {verification.evidence.matchedKeywords.join(', ')}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          </Card>
                        ))}
                      </div>
                    ) : (
                      <div className="space-y-2 mt-3">
                        <h5 className="text-xs font-semibold text-muted-foreground uppercase">
                          Verifiche (Legacy Format)
                        </h5>
                        {checkpointData.verifications.map((v: string, vIdx: number) => (
                          <div key={vIdx} className="flex items-center gap-2 text-sm">
                            <CheckCircle className="h-4 w-4 text-green-600" />
                            <span>{v}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
