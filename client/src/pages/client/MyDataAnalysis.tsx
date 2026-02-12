import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Sidebar from "@/components/sidebar";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";

import { DatasetViewer } from "@/components/client-data/DatasetViewer";
import { DataAnalysisChat } from "@/components/client-data/DataAnalysisChat";
import { ResultsDisplay } from "@/components/client-data/ResultsDisplay";

import {
  Database,
  BarChart3,
  MessageSquare,
  Eye,
  ChevronLeft,
  FileSpreadsheet,
  CheckCircle,
  Clock,
  Sparkles,
  Table2,
  ArrowRight,
} from "lucide-react";

interface Dataset {
  id: string;
  name: string;
  originalFilename: string;
  status: "pending" | "processing" | "ready" | "error";
  rowCount: number;
  columnMapping: Record<string, { displayName: string; dataType: string }>;
  createdAt: string;
  lastQueriedAt?: string;
}

interface QueryResult {
  success: boolean;
  data?: {
    rows?: any[];
    aggregations?: Record<string, any>;
    chartData?: any[];
    summary?: string;
  };
  explanation?: string;
}

type ViewMode = "list" | "view" | "query" | "results";

export default function MyDataAnalysis() {
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [selectedDataset, setSelectedDataset] = useState<Dataset | null>(null);
  const [queryResult, setQueryResult] = useState<QueryResult | null>(null);

  const { data, isLoading } = useQuery<{ success: boolean; data: Dataset[] }>({
    queryKey: ["/api/client-data/datasets"],
  });

  const datasets = data?.data || [];
  const readyDatasets = datasets.filter((d) => d.status === "ready");

  const handleSelectDataset = (dataset: Dataset) => {
    setSelectedDataset(dataset);
    setViewMode("view");
  };

  const handleQueryDataset = (dataset: Dataset) => {
    setSelectedDataset(dataset);
    setViewMode("query");
  };

  const handleResultSelect = (result: QueryResult) => {
    setQueryResult(result);
    setViewMode("results");
  };

  const handleBackToList = () => {
    setViewMode("list");
    setSelectedDataset(null);
    setQueryResult(null);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("it-IT", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-900">
      <Sidebar role="client" />

      <main className="flex-1 overflow-hidden flex flex-col">
        <header className="flex-none h-16 border-b bg-white dark:bg-slate-800 flex items-center justify-between px-6">
          <div className="flex items-center gap-3">
            {viewMode !== "list" && (
              <Button variant="ghost" size="icon" onClick={handleBackToList}>
                <ChevronLeft className="h-5 w-5" />
              </Button>
            )}
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
              <BarChart3 className="h-4 w-4 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-gray-900 dark:text-white">Le Mie Analisi</h1>
            </div>
          </div>

          {selectedDataset && viewMode !== "list" && (
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-500 dark:text-gray-400 hidden sm:inline">
                {selectedDataset.name}
              </span>
              <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as ViewMode)}>
                <TabsList>
                  <TabsTrigger value="view" className="gap-2">
                    <Table2 className="h-4 w-4" />
                    Dati
                  </TabsTrigger>
                  <TabsTrigger value="query" className="gap-2">
                    <Sparkles className="h-4 w-4" />
                    Analisi AI
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          )}
        </header>

        <div className="flex-1 overflow-auto">
          {viewMode === "list" && (
            <div className="max-w-3xl mx-auto p-6 sm:p-8">
              <div className="mb-8">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
                  I tuoi report
                </h2>
                <p className="text-gray-500 dark:text-gray-400">
                  Seleziona un report per esplorare i dati o chiedere all'assistente AI
                </p>
              </div>

              {isLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-24 w-full rounded-xl" />
                  ))}
                </div>
              ) : readyDatasets.length === 0 ? (
                <div className="text-center py-16">
                  <div className="w-16 h-16 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center mx-auto mb-4">
                    <BarChart3 className="h-8 w-8 text-gray-400" />
                  </div>
                  <p className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    Nessun report disponibile
                  </p>
                  <p className="text-sm text-gray-500 max-w-sm mx-auto">
                    I tuoi report appariranno qui non appena il tuo consulente li avrà preparati per te.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {readyDatasets.map((dataset) => (
                    <div
                      key={dataset.id}
                      className="group bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5 hover:border-violet-300 dark:hover:border-violet-700 hover:shadow-md hover:shadow-violet-100 dark:hover:shadow-violet-900/10 transition-all cursor-pointer"
                      onClick={() => handleQueryDataset(dataset)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-violet-100 to-purple-100 dark:from-violet-900/40 dark:to-purple-900/40 flex items-center justify-center flex-shrink-0">
                            <FileSpreadsheet className="h-5 w-5 text-violet-600 dark:text-violet-400" />
                          </div>
                          <div>
                            <h3 className="font-semibold text-gray-900 dark:text-white group-hover:text-violet-700 dark:group-hover:text-violet-300 transition-colors">
                              {dataset.name}
                            </h3>
                            <div className="flex items-center gap-3 mt-1">
                              <span className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                                <CheckCircle className="h-3 w-3 text-emerald-500" />
                                {dataset.rowCount.toLocaleString("it-IT")} righe
                              </span>
                              <span className="text-xs text-gray-400 dark:text-gray-500">
                                Aggiornato {formatDate(dataset.createdAt)}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-gray-500 hover:text-violet-600 hidden sm:flex"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSelectDataset(dataset);
                            }}
                          >
                            <Table2 className="h-4 w-4 mr-1.5" />
                            Tabella
                          </Button>
                          <div className="w-8 h-8 rounded-lg bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center group-hover:bg-violet-200 dark:group-hover:bg-violet-800/40 transition-colors">
                            <ArrowRight className="h-4 w-4 text-violet-600 dark:text-violet-400" />
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {viewMode === "view" && selectedDataset && (
            <DatasetViewer
              datasetId={selectedDataset.id}
              datasetName={selectedDataset.name}
              onBack={handleBackToList}
            />
          )}

          {viewMode === "query" && selectedDataset && (
            <div className="h-full">
              <DataAnalysisChat
                datasetId={selectedDataset.id}
                datasetName={selectedDataset.name}
                columnMapping={selectedDataset.columnMapping}
                onResultSelect={handleResultSelect}
                onClose={handleBackToList}
              />
            </div>
          )}

          {viewMode === "results" && queryResult && (
            <div className="h-full">
              <ResultsDisplay
                result={queryResult}
                onClose={() => setViewMode("query")}
              />
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
