import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import {
  Sparkles,
  TrendingUp,
  AlertTriangle,
  Lightbulb,
  CheckCircle,
  AlertCircle,
  Target,
  Activity,
  MessageSquare,
  GitBranch,
  Flag,
  Calendar,
  FileText,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { formatDistanceToNow } from 'date-fns';
import { it } from 'date-fns/locale';

interface GeminiReportPanelProps {
  conversationDetail: any;
}

export function GeminiReportPanel({ conversationDetail }: GeminiReportPanelProps) {
  const aiAnalysis = conversationDetail?.aiAnalysisResult;

  if (!aiAnalysis) {
    return (
      <div className="h-full flex flex-col bg-muted/30">
        <div className="p-4 border-b bg-card">
          <h2 className="font-semibold text-lg flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-purple-600" />
            Analisi Gemini 2.5 Pro
          </h2>
        </div>
        <div className="flex-1 flex items-center justify-center text-center p-8">
          <div className="max-w-md space-y-4">
            <div className="flex justify-center">
              <div className="h-16 w-16 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                <Sparkles className="h-8 w-8 text-purple-600" />
              </div>
            </div>
            <div>
              <h3 className="font-semibold text-lg mb-2">Nessuna Analisi AI Disponibile</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Questa conversazione non è ancora stata analizzata con Gemini 2.5 Pro.
              </p>
              <p className="text-xs text-muted-foreground">
                Vai al tab "AI Training Assistant" per analizzare questa conversazione specifica.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const { insights, problems, suggestions, strengths, score, analyzedAt, analyzedFiles } = aiAnalysis;

  const getScoreColor = (scoreValue: number) => {
    if (scoreValue >= 80) return 'text-green-600 dark:text-green-400';
    if (scoreValue >= 60) return 'text-yellow-600 dark:text-yellow-400';
    if (scoreValue >= 40) return 'text-orange-600 dark:text-orange-400';
    return 'text-red-600 dark:text-red-400';
  };

  const getProgressColor = (scoreValue: number) => {
    if (scoreValue >= 80) return 'bg-green-500';
    if (scoreValue >= 60) return 'bg-yellow-500';
    if (scoreValue >= 40) return 'bg-orange-500';
    return 'bg-red-500';
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 border-red-300';
      case 'high':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200 border-orange-300';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 border-yellow-300';
      case 'low':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 border-blue-300';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200 border-gray-300';
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <AlertCircle className="h-4 w-4" />;
      case 'high':
        return <AlertTriangle className="h-4 w-4" />;
      case 'medium':
        return <AlertCircle className="h-4 w-4" />;
      case 'low':
        return <AlertCircle className="h-4 w-4" />;
      default:
        return <AlertCircle className="h-4 w-4" />;
    }
  };

  return (
    <div className="h-full flex flex-col bg-muted/30">
      <div className="p-4 border-b bg-card">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-lg flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-purple-600" />
              Analisi Gemini 2.5 Pro
            </h2>
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-2">
              <Calendar className="h-3 w-3" />
              Analizzata {formatDistanceToNow(new Date(analyzedAt), { addSuffix: true, locale: it })}
            </p>
          </div>
          <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
            <Sparkles className="h-3 w-3 mr-1" />
            AI Analysis
          </Badge>
        </div>
        {analyzedFiles && analyzedFiles.length > 0 && (
          <div className="mt-2 text-xs text-muted-foreground flex items-center gap-2">
            <FileText className="h-3 w-3" />
            Confrontata con {analyzedFiles.length} file di training: {analyzedFiles.join(', ')}
          </div>
        )}
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          {/* Overall Score Card */}
          {score && typeof score === 'object' && (
            <Card className="bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-950 dark:to-indigo-950 border-purple-200 dark:border-purple-800">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5 text-purple-600" />
                  Punteggio Complessivo
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Performance Generale
                  </span>
                  <span className={cn('text-3xl font-bold', getScoreColor(score.overall || 0))}>
                    {score.overall || 0}/100
                  </span>
                </div>
                <Progress
                  value={score.overall || 0}
                  className="h-3"
                  indicatorClassName={getProgressColor(score.overall || 0)}
                />

                {/* Detailed Scores */}
                <div className="grid grid-cols-2 gap-4 mt-6">
                  {score.phaseProgression !== undefined && (
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <GitBranch className="h-4 w-4 text-blue-600" />
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          Progressione Fasi
                        </span>
                      </div>
                      <Progress
                        value={score.phaseProgression}
                        className="h-2 mb-1"
                        indicatorClassName={getProgressColor(score.phaseProgression)}
                      />
                      <span className="text-xs text-gray-600 dark:text-gray-400">
                        {score.phaseProgression}/100
                      </span>
                    </div>
                  )}

                  {score.questionQuality !== undefined && (
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <MessageSquare className="h-4 w-4 text-green-600" />
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          Qualità Domande
                        </span>
                      </div>
                      <Progress
                        value={score.questionQuality}
                        className="h-2 mb-1"
                        indicatorClassName={getProgressColor(score.questionQuality)}
                      />
                      <span className="text-xs text-gray-600 dark:text-gray-400">
                        {score.questionQuality}/100
                      </span>
                    </div>
                  )}

                  {score.ladderEffectiveness !== undefined && (
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <Activity className="h-4 w-4 text-purple-600" />
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          Efficacia Ladder
                        </span>
                      </div>
                      <Progress
                        value={score.ladderEffectiveness}
                        className="h-2 mb-1"
                        indicatorClassName={getProgressColor(score.ladderEffectiveness)}
                      />
                      <span className="text-xs text-gray-600 dark:text-gray-400">
                        {score.ladderEffectiveness}/100
                      </span>
                    </div>
                  )}

                  {score.checkpointCompletion !== undefined && (
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <Flag className="h-4 w-4 text-orange-600" />
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          Completamento Checkpoint
                        </span>
                      </div>
                      <Progress
                        value={score.checkpointCompletion}
                        className="h-2 mb-1"
                        indicatorClassName={getProgressColor(score.checkpointCompletion)}
                      />
                      <span className="text-xs text-gray-600 dark:text-gray-400">
                        {score.checkpointCompletion}/100
                      </span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Accordion for Insights, Problems, Suggestions, Strengths */}
          <Accordion type="multiple" className="space-y-3">
            {/* Insights */}
            {insights && insights.length > 0 && (
              <AccordionItem value="insights" className="border rounded-lg px-4 bg-card">
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex items-center gap-3">
                    <TrendingUp className="h-5 w-5 text-blue-600" />
                    <h3 className="font-semibold">Insights Chiave</h3>
                    <Badge variant="outline" className="ml-2">{insights.length}</Badge>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pt-4 space-y-2">
                  {insights.map((insight: any, idx: number) => (
                    <div
                      key={idx}
                      className="flex items-start gap-3 p-3 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800"
                    >
                      <CheckCircle className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                      <p className="text-sm text-gray-700 dark:text-gray-300">
                        {typeof insight === 'string' ? insight : insight.text}
                      </p>
                    </div>
                  ))}
                </AccordionContent>
              </AccordionItem>
            )}

            {/* Problems */}
            {problems && problems.length > 0 && (
              <AccordionItem value="problems" className="border rounded-lg px-4 bg-card">
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex items-center gap-3">
                    <AlertTriangle className="h-5 w-5 text-orange-600" />
                    <h3 className="font-semibold">Problemi Rilevati</h3>
                    <Badge variant="outline" className="ml-2">{problems.length}</Badge>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pt-4 space-y-3">
                  {problems.map((problem: any, idx: number) => (
                    <div key={idx} className="border rounded-lg p-4 bg-gray-50 dark:bg-gray-900">
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="flex items-center gap-2 flex-1">
                          {getSeverityIcon(problem.severity || 'medium')}
                          <h4 className="font-semibold text-gray-900 dark:text-white">
                            {problem.title || problem.category || 'Problema'}
                          </h4>
                        </div>
                        {problem.severity && (
                          <Badge className={cn('text-xs', getSeverityColor(problem.severity))}>
                            {problem.severity.toUpperCase()}
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-gray-700 dark:text-gray-300">
                        {problem.description || problem.text}
                      </p>
                      {problem.evidence && (
                        <div className="mt-2 p-2 bg-gray-100 dark:bg-gray-800 rounded border-l-4 border-orange-500">
                          <p className="text-xs font-mono text-gray-600 dark:text-gray-400">
                            <strong>Evidenza:</strong> {problem.evidence}
                          </p>
                        </div>
                      )}
                    </div>
                  ))}
                </AccordionContent>
              </AccordionItem>
            )}

            {/* Suggestions */}
            {suggestions && suggestions.length > 0 && (
              <AccordionItem value="suggestions" className="border rounded-lg px-4 bg-card">
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex items-center gap-3">
                    <Lightbulb className="h-5 w-5 text-yellow-600" />
                    <h3 className="font-semibold">Suggerimenti</h3>
                    <Badge variant="outline" className="ml-2">{suggestions.length}</Badge>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pt-4 space-y-2">
                  {suggestions.map((suggestion: any, idx: number) => (
                    <div
                      key={idx}
                      className="flex items-start gap-3 p-3 bg-yellow-50 dark:bg-yellow-950 rounded-lg border border-yellow-200 dark:border-yellow-800"
                    >
                      <Lightbulb className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                      <p className="text-sm text-gray-700 dark:text-gray-300">
                        {typeof suggestion === 'string' ? suggestion : suggestion.text}
                      </p>
                    </div>
                  ))}
                </AccordionContent>
              </AccordionItem>
            )}

            {/* Strengths */}
            {strengths && strengths.length > 0 && (
              <AccordionItem value="strengths" className="border rounded-lg px-4 bg-card">
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex items-center gap-3">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    <h3 className="font-semibold">Punti di Forza</h3>
                    <Badge variant="outline" className="ml-2">{strengths.length}</Badge>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pt-4 space-y-2">
                  {strengths.map((strength: any, idx: number) => (
                    <div
                      key={idx}
                      className="flex items-start gap-3 p-3 bg-green-50 dark:bg-green-950 rounded-lg border border-green-200 dark:border-green-800"
                    >
                      <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                      <p className="text-sm text-gray-700 dark:text-gray-300">
                        {typeof strength === 'string' ? strength : strength.text}
                      </p>
                    </div>
                  ))}
                </AccordionContent>
              </AccordionItem>
            )}
          </Accordion>
        </div>
      </ScrollArea>
    </div>
  );
}
