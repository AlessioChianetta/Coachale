import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Brain, Zap, AlertTriangle, CheckCircle, Loader2, AlertCircle as AlertIcon } from 'lucide-react';
import { useTrainingAnalytics } from '@/hooks/useTrainingAnalytics';
import { formatDistanceToNow } from 'date-fns';
import { it } from 'date-fns/locale';

interface AIReasoningTabProps {
  agentId: string;
}

export function AIReasoningTab({ agentId }: AIReasoningTabProps) {
  const { data, isLoading, error } = useTrainingAnalytics(agentId);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        <span className="ml-2 text-gray-600 dark:text-gray-400">Caricamento analytics...</span>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800">
        <CardContent className="p-6">
          <div className="flex items-center gap-2 text-red-700 dark:text-red-300">
            <AlertIcon className="h-5 w-5" />
            <span>Errore nel caricamento dei dati: {error.message}</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  const contextualResponses = data?.aiReasoning?.contextualResponses || [];
  const totalReasoningEntries = data?.aiReasoning?.totalReasoningEntries || 0;
  const reasoningByType = data?.aiReasoning?.reasoningByType || {};

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                  Risposte Contestuali
                </p>
                <p className="text-3xl font-bold text-gray-900 dark:text-white">
                  {contextualResponses.length}
                </p>
              </div>
              <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
                <Brain className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                  Decisioni AI Totali
                </p>
                <p className="text-3xl font-bold text-gray-900 dark:text-white">
                  {totalReasoningEntries}
                </p>
              </div>
              <div className="w-12 h-12 rounded-full bg-purple-100 dark:bg-purple-900 flex items-center justify-center">
                <Zap className="h-6 w-6 text-purple-600 dark:text-purple-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                  Tipi Decisioni
                </p>
                <p className="text-3xl font-bold text-gray-900 dark:text-white">
                  {Object.keys(reasoningByType).length}
                </p>
              </div>
              <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                <CheckCircle className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-green-600" />
            Timeline Risposte Contestuali (Anti-Robot Mode)
          </CardTitle>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Momenti in cui l'AI ha messo in pausa lo script per rispondere a domande del prospect in modo naturale
          </p>
        </CardHeader>
        <CardContent>
          {contextualResponses.length === 0 ? (
            <div className="text-center py-12">
              <Brain className="h-16 w-16 mx-auto mb-4 text-gray-400" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                Nessuna risposta contestuale registrata
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                Le risposte contestuali appariranno qui quando l'AI risponde a domande del prospect
              </p>
            </div>
          ) : (
            <div className="relative">
              <div className="absolute left-[15px] top-0 bottom-0 w-0.5 bg-gray-200 dark:bg-gray-700" />
              
              <div className="space-y-4">
                {contextualResponses.map((ctx, idx) => (
                  <div key={idx} className="relative pl-10">
                    <div className="absolute left-0 top-1 w-8 h-8 rounded-full bg-white dark:bg-gray-800 border-2 border-green-500 flex items-center justify-center">
                      <Brain className="h-4 w-4 text-green-500" />
                    </div>
                    
                    <Card className="hover:shadow-md transition-shadow">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <Badge className="bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-300">
                                Risposta Contestuale
                              </Badge>
                              <Badge variant="outline" className="text-xs">
                                {ctx.phase}
                              </Badge>
                            </div>
                            <h4 className="font-semibold text-gray-900 dark:text-white">
                              Domanda: {ctx.question}
                            </h4>
                          </div>
                          <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                            {formatDistanceToNow(new Date(ctx.timestamp), {
                              addSuffix: true,
                              locale: it,
                            })}
                          </span>
                        </div>
                        <p className="text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800/50 p-3 rounded">
                          {ctx.response}
                        </p>
                      </CardContent>
                    </Card>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-950 dark:to-blue-950 border-purple-200 dark:border-purple-800">
        <CardContent className="p-4">
          <h4 className="font-semibold mb-3 text-purple-900 dark:text-purple-100">
            Importanza delle Risposte Contestuali
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="bg-white dark:bg-gray-800 p-3 rounded">
              <h5 className="text-sm font-semibold mb-1 flex items-center gap-2 text-green-700 dark:text-green-400">
                <CheckCircle className="h-4 w-4" />
                Perché sono fondamentali
              </h5>
              <p className="text-xs text-gray-700 dark:text-gray-300">
                Le risposte contestuali permettono all'AI di sembrare naturale e non robotica, 
                rispondendo alle domande del prospect invece di ignorarle e seguire rigidamente lo script.
              </p>
            </div>
            <div className="bg-white dark:bg-gray-800 p-3 rounded">
              <h5 className="text-sm font-semibold mb-1 flex items-center gap-2 text-purple-700 dark:text-purple-400">
                <Zap className="h-4 w-4" />
                Come funzionano
              </h5>
              <p className="text-xs text-gray-700 dark:text-gray-300">
                L'AI rileva quando il prospect fa una domanda, mette in pausa lo script, 
                risponde in modo naturale, e poi riprende esattamente da dove aveva interrotto.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
