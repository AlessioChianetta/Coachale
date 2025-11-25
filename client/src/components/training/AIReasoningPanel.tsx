import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle, Lightbulb, Clock, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { mergeConsecutiveMessages } from '@/utils/merge-transcript';

interface AIReasoningPanelProps {
  scriptStructure: any;
  conversationDetail: any;
  selectedPhaseId: string | null;
}

export function AIReasoningPanel({
  scriptStructure,
  conversationDetail,
  selectedPhaseId,
}: AIReasoningPanelProps) {
  console.log('[AIReasoningPanel] Rendering with:', {
    hasScriptStructure: !!scriptStructure,
    hasConversationDetail: !!conversationDetail,
    selectedPhaseId,
    phaseCount: scriptStructure?.phases?.length || 0
  });

  if (!scriptStructure || !scriptStructure.phases) {
    console.error('[AIReasoningPanel] Missing scriptStructure');
    return (
      <div className="h-full flex flex-col bg-muted/30">
        <div className="p-4 border-b bg-card">
          <h2 className="font-semibold text-lg">🧠 AI Analysis</h2>
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
    console.error('[AIReasoningPanel] Missing conversationDetail');
    return (
      <div className="h-full flex flex-col bg-muted/30">
        <div className="p-4 border-b bg-card">
          <h2 className="font-semibold text-lg">🧠 AI Analysis</h2>
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

  const analyzeProblems = () => {
    if (!selectedPhase) return [];

    const problems: Array<{
      title: string;
      description: string;
      severity: 'high' | 'medium' | 'low';
    }> = [];

    const phaseLadders = conversationDetail.ladderActivations.filter(
      (l: any) => l.phase === selectedPhase.id
    );
    const ladderCount = phaseLadders.length;
    const vagueCount = phaseLadders.filter((l: any) => l.wasVague).length;

    if (ladderCount > 5) {
      problems.push({
        title: `Ladder Activations: ${ladderCount}x (Troppi)`,
        description: `L'AI ha attivato il ladder ${ladderCount} volte, superando il range ottimale di 3-5. Questo può far sentire il prospect interrogato. Consiglio: Sii più selettivo nell'attivazione del ladder.`,
        severity: 'high',
      });
    } else if (ladderCount < 3 && ladderCount > 0) {
      problems.push({
        title: `Ladder Activations: ${ladderCount}x (Insufficienti)`,
        description: `Solo ${ladderCount} attivazioni del ladder. Per approfondire i bisogni del prospect, dovresti mirare a 3-5 attivazioni quando le risposte sono vaghe.`,
        severity: 'medium',
      });
    }

    if (vagueCount > 0) {
      problems.push({
        title: `${vagueCount} Risposta${vagueCount > 1 ? 'e' : ''} Vaga Non Approfondita`,
        description: `L'AI ha abbandonato dopo risposte vaghe senza insistere abbastanza. Usa frasi empatiche come "Pensiamoci insieme!" o "Anche solo un esempio..." per incoraggiare il prospect.`,
        severity: 'high',
      });
    }

    const phaseCheckpoints = selectedPhase.checkpoints;
    const completedCheckpoints = conversationDetail.checkpointsCompleted.filter(
      (c: any) =>
        phaseCheckpoints.some((pc: any) => pc.id === c.checkpointId)
    );

    if (phaseCheckpoints.length > 0 && completedCheckpoints.length === 0) {
      problems.push({
        title: 'Nessun Checkpoint Completato',
        description: `Questa fase ha ${phaseCheckpoints.length} checkpoint ma nessuno è stato completato. Assicurati di verificare i requisiti prima di procedere.`,
        severity: 'high',
      });
    }

    return problems;
  };

  const generateSuggestions = () => {
    if (!selectedPhase) return [];

    const suggestions: string[] = [];
    const problems = analyzeProblems();

    problems.forEach((problem) => {
      if (problem.title.includes('Ladder') && problem.title.includes('Troppi')) {
        suggestions.push(
          'Riduci il numero di ladder: Attiva solo quando la risposta è veramente vaga o superficiale.'
        );
        suggestions.push(
          'Migliora la qualità delle domande: Fai domande più specifiche fin dall\'inizio per evitare risposte vaghe.'
        );
      }

      if (problem.title.includes('Vaga')) {
        suggestions.push(
          'Usa frasi empatiche: "Pensiamoci insieme!", "Aiutami a capire", "Anche solo un esempio"'
        );
        suggestions.push(
          'Non arrenderti dopo 1 tentativo: Insisti con empatia quando le risposte sono vaghe.'
        );
      }

      if (problem.title.includes('Checkpoint')) {
        suggestions.push(
          'Verifica sempre i checkpoint prima di procedere alla fase successiva.'
        );
      }
    });

    const phaseLadders = conversationDetail.ladderActivations.filter(
      (l: any) => l.phase === selectedPhase.id
    );
    if (phaseLadders.length >= 3 && phaseLadders.length <= 5) {
      suggestions.push('Ottimo uso del ladder! Mantieni questo approccio bilanciato.');
    }

    return suggestions.length > 0 ? suggestions : ['Nessun suggerimento specifico - Fase gestita correttamente!'];
  };

  const rawFilteredTranscript = conversationDetail.fullTranscript.filter(
    (m: any) => m.phase === selectedPhaseId
  );
  
  const filteredTranscript = mergeConsecutiveMessages(rawFilteredTranscript, { maxTimeGapSeconds: 2 });

  const phaseActivation = conversationDetail.phaseActivations?.find(
    (a: any) => a.phase === selectedPhaseId
  );

  const problems = analyzeProblems();
  const suggestions = generateSuggestions();

  if (!selectedPhase) {
    return (
      <div className="h-full flex flex-col bg-muted/30">
        <div className="p-4 border-b bg-card">
          <h2 className="font-semibold text-lg">🧠 AI Analysis</h2>
        </div>
        <div className="flex-1 flex items-center justify-center text-center p-8">
          <div>
            <p className="text-muted-foreground">
              Seleziona una fase per visualizzare l'analisi AI
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-muted/30">
      <div className="p-4 border-b bg-card">
        <h2 className="font-semibold text-lg">🧠 AI Analysis</h2>
        <p className="text-xs text-muted-foreground mt-1">
          Analisi automatica della fase selezionata
        </p>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          <Card className="p-4">
            <h3 className="font-semibold text-sm mb-2">📌 Informazioni Fase</h3>
            <div className="space-y-2 text-sm">
              <div>
                <span className="text-muted-foreground">Fase:</span>{' '}
                <span className="font-medium">
                  FASE {selectedPhase.number} - {selectedPhase.name}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Tipo:</span>{' '}
                <Badge variant="outline">{selectedPhase.semanticType}</Badge>
              </div>
              <div>
                <span className="text-muted-foreground">Descrizione:</span>{' '}
                <span className="text-xs">{selectedPhase.description}</span>
              </div>
            </div>
          </Card>

          {phaseActivation && (
            <Card className="p-4 bg-indigo-50 dark:bg-indigo-950/30 border-indigo-200 dark:border-indigo-800">
              <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
                🎯 Perché l'AI ha attivato questa fase
              </h3>
              <div className="space-y-3 text-sm">
                <div>
                  <span className="text-muted-foreground font-semibold">Trigger:</span>{' '}
                  <Badge variant="secondary" className="ml-1">
                    {phaseActivation.trigger === 'semantic_match' && '🧠 Match Semantico'}
                    {phaseActivation.trigger === 'keyword_match' && '🔑 Keyword Match'}
                    {phaseActivation.trigger === 'exact_match' && '✅ Match Esatto'}
                    {!['semantic_match', 'keyword_match', 'exact_match'].includes(phaseActivation.trigger) && phaseActivation.trigger}
                  </Badge>
                </div>

                {phaseActivation.similarity !== undefined && (
                  <div>
                    <span className="text-muted-foreground font-semibold">Similarity Score:</span>{' '}
                    <Badge 
                      className={cn(
                        "ml-1",
                        phaseActivation.similarity >= 0.8 && "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100",
                        phaseActivation.similarity >= 0.6 && phaseActivation.similarity < 0.8 && "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100",
                        phaseActivation.similarity < 0.6 && "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-100"
                      )}
                    >
                      {(phaseActivation.similarity * 100).toFixed(1)}%
                    </Badge>
                  </div>
                )}

                {phaseActivation.matchedQuestion && (
                  <div>
                    <span className="text-muted-foreground font-semibold">Domanda Matchata:</span>
                    <div className="mt-1 p-2 bg-white dark:bg-gray-800 rounded border text-xs">
                      "{phaseActivation.matchedQuestion}"
                    </div>
                  </div>
                )}

                {phaseActivation.keywordsMatched && phaseActivation.keywordsMatched.length > 0 && (
                  <div>
                    <span className="text-muted-foreground font-semibold">Keywords Trovate:</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {phaseActivation.keywordsMatched.map((kw: string, idx: number) => (
                        <Badge key={idx} variant="outline" className="text-xs">
                          🔑 {kw}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {phaseActivation.excerpt && (
                  <div>
                    <span className="text-muted-foreground font-semibold">Messaggio Trigger:</span>
                    <div className="mt-1 p-3 bg-white dark:bg-gray-800 rounded border">
                      <p className="text-xs leading-relaxed italic">
                        "{phaseActivation.excerpt}"
                      </p>
                      {phaseActivation.timestamp && (
                        <p className="text-xs text-muted-foreground mt-2">
                          🕒 {new Date(phaseActivation.timestamp).toLocaleString('it-IT')}
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {phaseActivation.reasoning && (
                  <div>
                    <span className="text-muted-foreground font-semibold">Reasoning AI:</span>
                    <div className="mt-1 p-3 bg-blue-50 dark:bg-blue-900/20 rounded border border-blue-200 dark:border-blue-800">
                      <p className="text-xs leading-relaxed">
                        {phaseActivation.reasoning}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </Card>
          )}

          {problems.length > 0 && (
            <div className="space-y-2">
              <h3 className="font-semibold text-sm">⚠️ Problemi Rilevati</h3>
              {problems.map((problem, idx) => (
                <Alert
                  key={idx}
                  variant={problem.severity === 'high' ? 'destructive' : 'default'}
                >
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle className="text-sm">{problem.title}</AlertTitle>
                  <AlertDescription className="text-xs mt-1">
                    {problem.description}
                  </AlertDescription>
                </Alert>
              ))}
            </div>
          )}

          <div className="space-y-2">
            <h3 className="font-semibold text-sm flex items-center gap-2">
              <Lightbulb className="h-4 w-4 text-yellow-600" />
              💡 Suggerimenti per Migliorare
            </h3>
            <Card className="p-4 bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800">
              <ol className="space-y-2 text-sm list-decimal list-inside">
                {suggestions.map((suggestion, idx) => (
                  <li key={idx} className="text-gray-700 dark:text-gray-300">
                    {suggestion}
                  </li>
                ))}
              </ol>
            </Card>
          </div>

          <div className="space-y-2">
            <h3 className="font-semibold text-sm flex items-center gap-2">
              💬 Conversazione (Fase {selectedPhase.number})
            </h3>
            {filteredTranscript.length > 0 ? (
              <div className="space-y-4 max-h-96 overflow-y-auto pr-2 bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4 border border-gray-200 dark:border-gray-800">
                {filteredTranscript.map((msg: any, idx: number) => {
                  const isAI = msg.role === 'assistant';
                  const timestamp = new Date(msg.timestamp);
                  const timeStr = timestamp.toLocaleTimeString('it-IT', {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                  });
                  const phase = msg.phase || selectedPhase.id;

                  return (
                    <div
                      key={idx}
                      className={cn(
                        'flex',
                        isAI ? 'justify-start' : 'justify-end'
                      )}
                    >
                      <div
                        className={cn(
                          'max-w-[85%] rounded-2xl p-3 shadow-sm',
                          isAI
                            ? 'bg-white dark:bg-gray-800 border border-blue-200 dark:border-blue-800'
                            : 'bg-green-500 dark:bg-green-700 text-white'
                        )}
                      >
                        {/* Header: Ruolo + Fase */}
                        <div className="flex items-center gap-2 mb-2 pb-2 border-b border-gray-200 dark:border-gray-700">
                          <Badge 
                            variant={isAI ? 'default' : 'secondary'}
                            className={cn(
                              'text-xs font-semibold',
                              isAI 
                                ? 'bg-blue-600 hover:bg-blue-700 text-white' 
                                : 'bg-green-700 hover:bg-green-800 text-white border-green-800'
                            )}
                          >
                            {isAI ? '🤖 AI Agent' : '👤 Prospect'}
                          </Badge>
                          <Badge 
                            variant="outline" 
                            className={cn(
                              'text-xs',
                              isAI 
                                ? 'bg-blue-50 dark:bg-blue-950 border-blue-300 dark:border-blue-800' 
                                : 'bg-white/20 text-white border-white/30'
                            )}
                          >
                            {phase}
                          </Badge>
                          <span className={cn(
                            'text-xs font-mono ml-auto',
                            isAI 
                              ? 'text-gray-500 dark:text-gray-400' 
                              : 'text-white/70'
                          )}>
                            {timeStr}
                          </span>
                        </div>
                        
                        {/* Contenuto messaggio */}
                        <p className={cn(
                          'text-sm leading-relaxed',
                          isAI 
                            ? 'text-gray-900 dark:text-white' 
                            : 'text-white'
                        )}>
                          {msg.content}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                Nessun messaggio in questa fase
              </p>
            )}
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
