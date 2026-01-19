import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import Sidebar from "@/components/sidebar";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

import { DatasetUploader } from "@/components/client-data/DatasetUploader";
import { FilePreview } from "@/components/client-data/FilePreview";
import { ColumnDiscoveryPreview } from "@/components/client-data/ColumnDiscoveryPreview";
import { DatasetList } from "@/components/client-data/DatasetList";
import { DatasetViewer } from "@/components/client-data/DatasetViewer";
import { QueryChat } from "@/components/client-data/QueryChat";
import { ResultsDisplay } from "@/components/client-data/ResultsDisplay";
import { MetricEditor } from "@/components/client-data/MetricEditor";
import { ReconciliationReport } from "@/components/client-data/ReconciliationReport";

import {
  Database,
  Upload,
  MessageSquare,
  BarChart3,
  Calculator,
  FileCheck,
  ChevronLeft,
} from "lucide-react";

interface Dataset {
  id: string;
  name: string;
  originalFilename: string;
  tableName: string;
  status: "pending" | "processing" | "ready" | "error";
  rowCount: number;
  columnMapping: Record<string, { displayName: string; dataType: string }>;
  createdAt: string;
}

interface UploadResult {
  filePath: string;
  originalFilename: string;
  fileSize: number;
  format: string;
  sheets: { name: string; rowCount: number; columns: any[]; sampleRows: any[] }[];
}

interface ColumnDefinition {
  originalName: string;
  suggestedName: string;
  displayName: string;
  dataType: "text" | "number" | "date" | "boolean" | "currency" | "percentage";
  description?: string;
  confidence: number;
  sampleValues: any[];
}

type ViewMode = "list" | "upload" | "preview" | "discovery" | "view" | "query" | "results" | "metrics" | "reconcile";

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

export default function ClientDataAnalysis() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const [selectedSheet, setSelectedSheet] = useState<string | null>(null);
  const [selectedDataset, setSelectedDataset] = useState<Dataset | null>(null);
  const [queryResult, setQueryResult] = useState<QueryResult | null>(null);
  const [selectedClientId, setSelectedClientId] = useState<string | undefined>(undefined);
  const [isImporting, setIsImporting] = useState(false);

  const handleUploadComplete = (result: UploadResult, clientId?: string) => {
    setUploadResult(result);
    setSelectedClientId(clientId);
    if (result.sheets.length === 1) {
      setSelectedSheet(result.sheets[0].name);
    }
    setViewMode("preview");
  };

  const handlePreviewConfirm = () => {
    setViewMode("discovery");
  };

  const handleAddMoreFiles = () => {
    setViewMode("upload");
  };

  const handleColumnConfirm = async (columns: ColumnDefinition[], datasetName: string) => {
    if (!uploadResult) return;

    setIsImporting(true);
    try {
      const response = await apiRequest("POST", "/api/client-data/create-and-import", {
        name: datasetName,
        filePath: uploadResult.filePath,
        filename: uploadResult.originalFilename,
        sheetName: selectedSheet,
        columns,
        clientId: selectedClientId,
      });

      if (response.success) {
        toast({
          title: "Dataset creato con successo",
          description: `${response.data.rowCount} righe importate`,
        });
        queryClient.invalidateQueries({ queryKey: ["/api/client-data/datasets"] });
        setViewMode("list");
        setUploadResult(null);
        setSelectedSheet(null);
      }
    } catch (error: any) {
      toast({
        title: "Errore nella creazione",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsImporting(false);
    }
  };

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

  const getColumns = () => {
    if (!selectedDataset?.columnMapping) return [];
    return Object.entries(selectedDataset.columnMapping).map(([name, data]) => ({
      name,
      displayName: data.displayName,
      dataType: data.dataType,
    }));
  };

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-900">
      <Sidebar role="consultant" />

      <main className="flex-1 overflow-hidden flex flex-col">
        <header className="flex-none h-16 border-b bg-white dark:bg-slate-800 flex items-center justify-between px-6">
          <div className="flex items-center gap-3">
            {viewMode !== "list" && (
              <Button variant="ghost" size="icon" onClick={handleBackToList}>
                <ChevronLeft className="h-5 w-5" />
              </Button>
            )}
            <Database className="h-6 w-6 text-cyan-600" />
            <h1 className="text-xl font-semibold">Analisi Dati Cliente</h1>
          </div>

          {selectedDataset && viewMode !== "list" && viewMode !== "upload" && viewMode !== "discovery" && (
            <div className="flex items-center gap-2">
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
                  <TabsTrigger value="metrics" className="gap-2">
                    <Calculator className="h-4 w-4" />
                    Metriche
                  </TabsTrigger>
                  <TabsTrigger value="reconcile" className="gap-2">
                    <FileCheck className="h-4 w-4" />
                    Riconciliazione
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          )}
        </header>

        <div className="flex-1 overflow-auto p-6">
          {viewMode === "list" && (
            <DatasetList
              onSelectDataset={handleSelectDataset}
              onQueryDataset={handleQueryDataset}
              onNewDataset={() => setViewMode("upload")}
              selectedDatasetId={selectedDataset?.id}
            />
          )}

          {viewMode === "upload" && (
            <div className="max-w-2xl mx-auto">
              <DatasetUploader
                onUploadComplete={handleUploadComplete}
                onCancel={() => setViewMode("list")}
              />
            </div>
          )}

          {viewMode === "preview" && uploadResult && (
            <div className="max-w-4xl mx-auto">
              <FilePreview
                uploadResult={uploadResult}
                onConfirm={handlePreviewConfirm}
                onAddMore={handleAddMoreFiles}
                onCancel={() => {
                  setUploadResult(null);
                  setSelectedSheet(null);
                  setViewMode("list");
                }}
              />
            </div>
          )}

          {viewMode === "discovery" && uploadResult && (
            <div className="max-w-4xl mx-auto">
              {uploadResult.sheets.length > 1 && !selectedSheet && (
                <div className="mb-6">
                  <h3 className="text-lg font-medium mb-3">Seleziona un foglio</h3>
                  <div className="grid grid-cols-3 gap-3">
                    {uploadResult.sheets.map((sheet) => (
                      <Button
                        key={sheet.name}
                        variant="outline"
                        onClick={() => setSelectedSheet(sheet.name)}
                        className="h-auto py-4 flex flex-col items-start"
                      >
                        <span className="font-medium">{sheet.name}</span>
                        <span className="text-sm text-slate-500">
                          {sheet.rowCount} righe · {sheet.columns.length} colonne
                        </span>
                      </Button>
                    ))}
                  </div>
                </div>
              )}
              {selectedSheet && (
                <ColumnDiscoveryPreview
                  filePath={uploadResult.filePath}
                  filename={uploadResult.originalFilename}
                  sheetName={selectedSheet}
                  onConfirm={handleColumnConfirm}
                  onCancel={() => {
                    setUploadResult(null);
                    setSelectedSheet(null);
                    setViewMode("list");
                  }}
                  isImporting={isImporting}
                />
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
              <QueryChat
                datasetId={selectedDataset.id}
                datasetName={selectedDataset.name}
                columnMapping={selectedDataset.columnMapping}
                onResultSelect={handleResultSelect}
                onClose={handleBackToList}
              />
            </div>
          )}

          {viewMode === "results" && queryResult && (
            <ResultsDisplay
              result={queryResult}
              onClose={() => setViewMode("query")}
            />
          )}

          {viewMode === "metrics" && selectedDataset && (
            <div className="max-w-4xl mx-auto">
              <MetricEditor
                datasetId={selectedDataset.id}
                columns={getColumns()}
                onSave={(metric) => {
                  toast({
                    title: "Metrica salvata",
                    description: `La metrica "${metric.name}" è stata salvata`,
                  });
                }}
                onCancel={() => setViewMode("view")}
              />
            </div>
          )}

          {viewMode === "reconcile" && selectedDataset && (
            <div className="max-w-4xl mx-auto h-full">
              <ReconciliationReport
                datasetId={selectedDataset.id}
                datasetName={selectedDataset.name}
                onClose={() => setViewMode("view")}
              />
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
