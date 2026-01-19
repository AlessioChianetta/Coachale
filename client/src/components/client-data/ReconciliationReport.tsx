import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  CheckCircle,
  XCircle,
  AlertTriangle,
  Play,
  FileCheck,
  Loader2,
  RefreshCw,
  Download,
  Scale,
} from "lucide-react";

interface ReconciliationTest {
  name: string;
  description: string;
  status: "pass" | "fail" | "warning";
  expected?: any;
  actual?: any;
  difference?: number;
  differencePercent?: number;
  details?: string;
}

interface ReconciliationResult {
  success: boolean;
  datasetId: string;
  datasetName: string;
  runAt: string;
  overallStatus: "pass" | "fail" | "warning";
  passRate: number;
  tests: ReconciliationTest[];
  summary: string;
}

interface ReconciliationReportProps {
  datasetId: string;
  datasetName: string;
  onClose?: () => void;
}

export function ReconciliationReport({ datasetId, datasetName, onClose }: ReconciliationReportProps) {
  const { toast } = useToast();
  const [result, setResult] = useState<ReconciliationResult | null>(null);

  const reconcileMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/client-data/datasets/${datasetId}/reconcile`),
    onSuccess: (data: any) => {
      if (data.success) {
        setResult(data.data);
        toast({
          title: "Riconciliazione completata",
          description: `${data.data.tests.filter((t: ReconciliationTest) => t.status === "pass").length} test superati su ${data.data.tests.length}`,
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Errore riconciliazione",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const getStatusIcon = (status: ReconciliationTest["status"]) => {
    switch (status) {
      case "pass":
        return <CheckCircle className="h-5 w-5 text-emerald-600" />;
      case "fail":
        return <XCircle className="h-5 w-5 text-red-600" />;
      case "warning":
        return <AlertTriangle className="h-5 w-5 text-amber-600" />;
    }
  };

  const getStatusBadge = (status: ReconciliationTest["status"]) => {
    switch (status) {
      case "pass":
        return <Badge className="bg-emerald-100 text-emerald-700">Superato</Badge>;
      case "fail":
        return <Badge className="bg-red-100 text-red-700">Fallito</Badge>;
      case "warning":
        return <Badge className="bg-amber-100 text-amber-700">Attenzione</Badge>;
    }
  };

  const getOverallStatusColor = (status: ReconciliationResult["overallStatus"]) => {
    switch (status) {
      case "pass":
        return "text-emerald-600";
      case "fail":
        return "text-red-600";
      case "warning":
        return "text-amber-600";
    }
  };

  const formatValue = (value: any) => {
    if (value === null || value === undefined) return "-";
    if (typeof value === "number") {
      return new Intl.NumberFormat("it-IT", { maximumFractionDigits: 2 }).format(value);
    }
    return String(value);
  };

  const handleDownloadReport = () => {
    if (!result) return;

    const report = {
      dataset: result.datasetName,
      runAt: result.runAt,
      overallStatus: result.overallStatus,
      passRate: result.passRate,
      summary: result.summary,
      tests: result.tests,
    };

    const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `reconciliation-report-${datasetId}-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="flex-none border-b">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Scale className="h-5 w-5 text-teal-600" />
              Report Riconciliazione
            </CardTitle>
            <CardDescription>
              Verifica l'integrità e la correttezza dei dati in "{datasetName}"
            </CardDescription>
          </div>
          {result && (
            <Button variant="outline" size="sm" onClick={handleDownloadReport}>
              <Download className="h-4 w-4 mr-2" />
              Esporta Report
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="flex-1 overflow-auto p-6">
        {!result ? (
          <div className="text-center py-12">
            <FileCheck className="h-16 w-16 mx-auto text-slate-300 dark:text-slate-600 mb-4" />
            <h3 className="text-lg font-medium mb-2">Test di Riconciliazione</h3>
            <p className="text-sm text-slate-500 mb-6 max-w-md mx-auto">
              Esegui una serie di test automatici per verificare la coerenza dei dati,
              controllare valori anomali e validare le aggregazioni.
            </p>
            <Button
              onClick={() => reconcileMutation.mutate()}
              disabled={reconcileMutation.isPending}
              className="bg-teal-600 hover:bg-teal-700"
            >
              {reconcileMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Esecuzione test...
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 mr-2" />
                  Avvia Riconciliazione
                </>
              )}
            </Button>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
              <div className="flex items-center gap-4">
                <div className={`p-3 rounded-full ${
                  result.overallStatus === "pass" ? "bg-emerald-100" :
                  result.overallStatus === "fail" ? "bg-red-100" : "bg-amber-100"
                }`}>
                  {getStatusIcon(result.overallStatus)}
                </div>
                <div>
                  <p className={`text-lg font-bold ${getOverallStatusColor(result.overallStatus)}`}>
                    {result.overallStatus === "pass" ? "Tutti i Test Superati" :
                     result.overallStatus === "fail" ? "Alcuni Test Falliti" : "Attenzione Richiesta"}
                  </p>
                  <p className="text-sm text-slate-500">{result.summary}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-3xl font-bold">{Math.round(result.passRate)}%</p>
                <p className="text-sm text-slate-500">Tasso Successo</p>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">Dettaglio Test</p>
              <Progress
                value={result.passRate}
                className="h-2"
              />
              <div className="flex gap-4 text-sm">
                <span className="flex items-center gap-1 text-emerald-600">
                  <CheckCircle className="h-4 w-4" />
                  {result.tests.filter(t => t.status === "pass").length} superati
                </span>
                <span className="flex items-center gap-1 text-amber-600">
                  <AlertTriangle className="h-4 w-4" />
                  {result.tests.filter(t => t.status === "warning").length} warning
                </span>
                <span className="flex items-center gap-1 text-red-600">
                  <XCircle className="h-4 w-4" />
                  {result.tests.filter(t => t.status === "fail").length} falliti
                </span>
              </div>
            </div>

            <Accordion type="multiple" className="w-full">
              {result.tests.map((test, idx) => (
                <AccordionItem key={idx} value={`test-${idx}`}>
                  <AccordionTrigger className="hover:no-underline">
                    <div className="flex items-center gap-3">
                      {getStatusIcon(test.status)}
                      <span className="font-medium">{test.name}</span>
                      {getStatusBadge(test.status)}
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="pl-8 space-y-3">
                      <p className="text-sm text-slate-600 dark:text-slate-400">
                        {test.description}
                      </p>
                      {(test.expected !== undefined || test.actual !== undefined) && (
                        <div className="grid grid-cols-2 gap-4 p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                          {test.expected !== undefined && (
                            <div>
                              <p className="text-xs text-slate-500">Atteso</p>
                              <p className="font-mono">{formatValue(test.expected)}</p>
                            </div>
                          )}
                          {test.actual !== undefined && (
                            <div>
                              <p className="text-xs text-slate-500">Effettivo</p>
                              <p className="font-mono">{formatValue(test.actual)}</p>
                            </div>
                          )}
                        </div>
                      )}
                      {test.difference !== undefined && (
                        <div className="flex gap-4 text-sm">
                          <span>Differenza: <strong>{formatValue(test.difference)}</strong></span>
                          {test.differencePercent !== undefined && (
                            <span>({test.differencePercent.toFixed(2)}%)</span>
                          )}
                        </div>
                      )}
                      {test.details && (
                        <p className="text-sm text-slate-500 italic">{test.details}</p>
                      )}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        )}
      </CardContent>

      {result && (
        <CardFooter className="flex-none border-t">
          <div className="flex justify-between w-full">
            <p className="text-xs text-slate-500">
              Eseguito: {new Date(result.runAt).toLocaleString("it-IT")}
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => reconcileMutation.mutate()}
              disabled={reconcileMutation.isPending}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${reconcileMutation.isPending ? "animate-spin" : ""}`} />
              Riesegui Test
            </Button>
          </div>
        </CardFooter>
      )}
    </Card>
  );
}
