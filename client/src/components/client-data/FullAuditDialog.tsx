import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Progress } from "@/components/ui/progress";
import {
  FileBarChart,
  Loader2,
  CheckCircle2,
  XCircle,
  SkipForward,
  ChevronDown,
  ChevronRight,
  TrendingUp,
  DollarSign,
  Package,
  Users,
  Calendar,
  CreditCard,
  Lightbulb,
  BarChart3,
  AlertCircle,
  Download,
} from "lucide-react";
import { getAuthHeaders } from "@/lib/auth";

interface AuditStep {
  stepNumber: number;
  title: string;
  status: "pending" | "running" | "completed" | "skipped" | "error";
  data?: any;
  summary?: string;
  charts?: any[];
  insights?: string[];
  error?: string;
  duration?: number;
}

interface FullAuditResult {
  datasetId: number;
  datasetName: string;
  generatedAt: string;
  totalDuration: number;
  steps: AuditStep[];
  executiveSummary: string;
  recommendations: string[];
  success: boolean;
}

interface FullAuditDialogProps {
  datasetId: number;
  datasetName: string;
  disabled?: boolean;
}

const stepIcons: Record<number, React.ReactNode> = {
  1: <BarChart3 className="h-4 w-4" />,
  2: <TrendingUp className="h-4 w-4" />,
  3: <Package className="h-4 w-4" />,
  4: <DollarSign className="h-4 w-4" />,
  5: <Users className="h-4 w-4" />,
  6: <Calendar className="h-4 w-4" />,
  7: <CreditCard className="h-4 w-4" />,
  8: <Lightbulb className="h-4 w-4" />,
};

export function FullAuditDialog({ datasetId, datasetName, disabled }: FullAuditDialogProps) {
  const [open, setOpen] = useState(false);
  const [expandedSteps, setExpandedSteps] = useState<Set<number>>(new Set());

  const auditMutation = useMutation<{ success: boolean; data: FullAuditResult }>({
    mutationFn: async () => {
      const response = await fetch(`/api/client-data/datasets/${datasetId}/full-audit`, {
        method: "POST",
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error("Failed to run audit");
      return response.json();
    },
  });

  const toggleStep = (stepNumber: number) => {
    const newExpanded = new Set(expandedSteps);
    if (newExpanded.has(stepNumber)) {
      newExpanded.delete(stepNumber);
    } else {
      newExpanded.add(stepNumber);
    }
    setExpandedSteps(newExpanded);
  };

  const handleStartAudit = () => {
    setExpandedSteps(new Set());
    auditMutation.mutate();
  };

  const getStatusIcon = (status: AuditStep["status"]) => {
    switch (status) {
      case "completed":
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case "error":
        return <XCircle className="h-4 w-4 text-red-500" />;
      case "skipped":
        return <SkipForward className="h-4 w-4 text-gray-400" />;
      case "running":
        return <Loader2 className="h-4 w-4 text-violet-500 animate-spin" />;
      default:
        return <div className="h-4 w-4 rounded-full border-2 border-gray-300" />;
    }
  };

  const getStatusBadge = (status: AuditStep["status"]) => {
    switch (status) {
      case "completed":
        return <Badge className="bg-green-100 text-green-700 border-green-200">Completato</Badge>;
      case "error":
        return <Badge variant="destructive">Errore</Badge>;
      case "skipped":
        return <Badge variant="secondary">Saltato</Badge>;
      default:
        return null;
    }
  };

  const formatDuration = (ms?: number) => {
    if (!ms) return "";
    return `${(ms / 1000).toFixed(2)}s`;
  };

  const completedSteps = auditMutation.data?.data?.steps.filter((s) => s.status === "completed").length || 0;
  const totalSteps = 8;
  const progress = (completedSteps / totalSteps) * 100;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" disabled={disabled} className="gap-2">
          <FileBarChart className="h-4 w-4" />
          Audit Completo
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileBarChart className="h-5 w-5 text-violet-600" />
            Audit Completo - {datasetName}
          </DialogTitle>
          <DialogDescription>
            Analisi completa del dataset con 8 step automatizzati
          </DialogDescription>
        </DialogHeader>

        {!auditMutation.data && !auditMutation.isPending && (
          <div className="py-8 text-center">
            <FileBarChart className="h-16 w-16 mx-auto text-violet-200 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Genera un Report Completo
            </h3>
            <p className="text-gray-500 mb-6 max-w-md mx-auto">
              L'audit analizzera' fatturato, costi, prodotti, clienti, pattern temporali 
              e generera' raccomandazioni personalizzate.
            </p>
            <Button onClick={handleStartAudit} size="lg" className="gap-2">
              <FileBarChart className="h-5 w-5" />
              Avvia Audit
            </Button>
          </div>
        )}

        {auditMutation.isPending && (
          <div className="py-8 text-center">
            <Loader2 className="h-12 w-12 mx-auto text-violet-600 animate-spin mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Analisi in corso...
            </h3>
            <p className="text-gray-500 mb-4">
              Elaborazione delle 8 sezioni dell'audit
            </p>
            <Progress value={50} className="w-64 mx-auto" />
          </div>
        )}

        {auditMutation.data?.data && (
          <ScrollArea className="flex-1 pr-4">
            <div className="space-y-4">
              <div className="bg-gradient-to-r from-violet-50 to-indigo-50 dark:from-violet-900/20 dark:to-indigo-900/20 p-4 rounded-xl border border-violet-100 dark:border-violet-800">
                <h4 className="font-medium text-violet-900 dark:text-violet-100 mb-2">
                  Riepilogo Esecutivo
                </h4>
                <p className="text-sm text-violet-700 dark:text-violet-300">
                  {auditMutation.data.data.executiveSummary}
                </p>
                <div className="flex items-center gap-4 mt-3 text-xs text-violet-600">
                  <span>Completati: {completedSteps}/{totalSteps} step</span>
                  <span>Durata: {formatDuration(auditMutation.data.data.totalDuration)}</span>
                </div>
                <Progress value={progress} className="mt-2" />
              </div>

              <div className="space-y-2">
                {auditMutation.data.data.steps.map((step) => (
                  <Collapsible
                    key={step.stepNumber}
                    open={expandedSteps.has(step.stepNumber)}
                    onOpenChange={() => toggleStep(step.stepNumber)}
                  >
                    <CollapsibleTrigger asChild>
                      <div
                        className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${
                          step.status === "completed"
                            ? "bg-green-50 border-green-200 hover:bg-green-100 dark:bg-green-900/20 dark:border-green-800"
                            : step.status === "error"
                            ? "bg-red-50 border-red-200 hover:bg-red-100 dark:bg-red-900/20 dark:border-red-800"
                            : step.status === "skipped"
                            ? "bg-gray-50 border-gray-200 hover:bg-gray-100 dark:bg-gray-800/50 dark:border-gray-700"
                            : "bg-white border-gray-200 dark:bg-gray-900 dark:border-gray-700"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          {getStatusIcon(step.status)}
                          <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                            {stepIcons[step.stepNumber]}
                          </div>
                          <div>
                            <div className="font-medium text-gray-900 dark:text-gray-100">
                              {step.stepNumber}. {step.title}
                            </div>
                            {step.summary && (
                              <div className="text-sm text-gray-500 dark:text-gray-400">
                                {step.summary}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {getStatusBadge(step.status)}
                          {step.duration && (
                            <span className="text-xs text-gray-400">
                              {formatDuration(step.duration)}
                            </span>
                          )}
                          {expandedSteps.has(step.stepNumber) ? (
                            <ChevronDown className="h-4 w-4 text-gray-400" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-gray-400" />
                          )}
                        </div>
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="mt-2 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-100 dark:border-gray-700">
                        {step.error && (
                          <div className="flex items-start gap-2 text-red-600 dark:text-red-400 mb-3">
                            <AlertCircle className="h-4 w-4 mt-0.5" />
                            <span className="text-sm">{step.error}</span>
                          </div>
                        )}
                        
                        {step.insights && step.insights.length > 0 && (
                          <div className="space-y-2">
                            <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                              Insights
                            </h5>
                            <ul className="space-y-1">
                              {step.insights.map((insight, idx) => (
                                <li
                                  key={idx}
                                  className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-400"
                                >
                                  <span className="text-violet-500">•</span>
                                  {insight}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {step.charts && step.charts.length > 0 && (
                          <div className="mt-4 space-y-2">
                            <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                              Grafici Disponibili
                            </h5>
                            <div className="flex flex-wrap gap-2">
                              {step.charts.map((chart, idx) => (
                                <Badge
                                  key={idx}
                                  variant="outline"
                                  className="bg-white dark:bg-gray-900"
                                >
                                  {chart.type === "pie" ? "Torta" : chart.type === "bar" ? "Barre" : "Linea"}: {chart.title}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                ))}
              </div>

              {auditMutation.data.data.recommendations.length > 0 && (
                <div className="bg-amber-50 dark:bg-amber-900/20 p-4 rounded-xl border border-amber-200 dark:border-amber-800">
                  <h4 className="font-medium text-amber-900 dark:text-amber-100 mb-3 flex items-center gap-2">
                    <Lightbulb className="h-4 w-4" />
                    Raccomandazioni Strategiche
                  </h4>
                  <ul className="space-y-2">
                    {auditMutation.data.data.recommendations.map((rec, idx) => (
                      <li
                        key={idx}
                        className="flex items-start gap-2 text-sm text-amber-800 dark:text-amber-200"
                      >
                        <span className="font-bold">{idx + 1}.</span>
                        {rec}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </ScrollArea>
        )}

        {auditMutation.data?.data && (
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={handleStartAudit}>
              Rigenera Audit
            </Button>
            <Button variant="default" onClick={() => setOpen(false)}>
              Chiudi
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
