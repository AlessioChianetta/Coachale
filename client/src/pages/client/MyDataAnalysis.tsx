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
            <Database className="h-6 w-6 text-cyan-600" />
            <h1 className="text-xl font-semibold">Le Mie Analisi</h1>
          </div>

          {selectedDataset && viewMode !== "list" && (
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="gap-1">
                <FileSpreadsheet className="h-3 w-3" />
                {selectedDataset.name}
              </Badge>
              <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as ViewMode)}>
                <TabsList>
                  <TabsTrigger value="view" className="gap-2">
                    <BarChart3 className="h-4 w-4" />
                    Dati
                  </TabsTrigger>
                  <TabsTrigger value="query" className="gap-2">
                    <MessageSquare className="h-4 w-4" />
                    Query AI
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          )}
        </header>

        <div className="flex-1 overflow-auto p-6">
          {viewMode === "list" && (
            <div className="max-w-4xl mx-auto">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Database className="h-5 w-5 text-cyan-600" />
                    I Tuoi Dataset
                  </CardTitle>
                  <CardDescription>
                    Visualizza e analizza i dataset condivisi dal tuo consulente
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <div className="space-y-3">
                      {[1, 2, 3].map((i) => (
                        <Skeleton key={i} className="h-20 w-full" />
                      ))}
                    </div>
                  ) : readyDatasets.length === 0 ? (
                    <div className="text-center py-12">
                      <Database className="h-16 w-16 mx-auto text-slate-300 dark:text-slate-600 mb-4" />
                      <p className="text-lg font-medium text-slate-600 dark:text-slate-400 mb-2">
                        Nessun dataset disponibile
                      </p>
                      <p className="text-sm text-slate-500">
                        I tuoi dataset appariranno qui quando il consulente li caricherà
                      </p>
                    </div>
                  ) : (
                    <div className="grid gap-4">
                      {readyDatasets.map((dataset) => (
                        <div
                          key={dataset.id}
                          className="border rounded-lg p-4 hover:border-cyan-400 hover:bg-cyan-50/50 dark:hover:bg-cyan-900/20 transition-colors cursor-pointer"
                          onClick={() => handleSelectDataset(dataset)}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex items-start gap-3">
                              <div className="p-2 bg-cyan-100 dark:bg-cyan-900 rounded-lg">
                                <FileSpreadsheet className="h-5 w-5 text-cyan-600" />
                              </div>
                              <div>
                                <h3 className="font-medium">{dataset.name}</h3>
                                <p className="text-sm text-slate-500">
                                  {dataset.originalFilename}
                                </p>
                                <div className="flex items-center gap-3 mt-2 text-xs text-slate-500">
                                  <span className="flex items-center gap-1">
                                    <CheckCircle className="h-3 w-3 text-emerald-500" />
                                    {dataset.rowCount.toLocaleString("it-IT")} righe
                                  </span>
                                  <span className="flex items-center gap-1">
                                    <Clock className="h-3 w-3" />
                                    {formatDate(dataset.createdAt)}
                                  </span>
                                </div>
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleSelectDataset(dataset);
                                }}
                              >
                                <Eye className="h-4 w-4 mr-2" />
                                Visualizza
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleQueryDataset(dataset);
                                }}
                                className="text-purple-600 border-purple-200 hover:bg-purple-50"
                              >
                                <MessageSquare className="h-4 w-4 mr-2" />
                                Query AI
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
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
            <div className="h-full max-w-5xl mx-auto">
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
            <div className="max-w-6xl mx-auto">
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
