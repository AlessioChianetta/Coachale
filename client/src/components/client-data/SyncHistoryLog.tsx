import { useState, useMemo } from "react";
import {
  useDatasetSyncHistory,
  useDatasetSyncSources,
  SyncHistoryRecord,
  SyncHistoryFilters,
} from "@/hooks/useDatasetSync";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Search, Eye, ChevronLeft, ChevronRight, AlertCircle, CheckCircle2, Clock, ExternalLink, Database } from "lucide-react";
import { useLocation } from "wouter";

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMinutes < 1) return "Adesso";
  if (diffMinutes < 60) return `${diffMinutes} minut${diffMinutes === 1 ? "o" : "i"} fa`;
  if (diffHours < 24) return `${diffHours} or${diffHours === 1 ? "a" : "e"} fa`;
  if (diffDays < 7) return `${diffDays} giorn${diffDays === 1 ? "o" : "i"} fa`;

  return date.toLocaleDateString("it-IT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDuration(ms: number | undefined): string {
  if (!ms) return "-";
  const seconds = (ms / 1000).toFixed(1);
  return `${seconds}s`;
}

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case "completed":
      return (
        <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
          <CheckCircle2 className="h-3 w-3 mr-1" />
          Completato
        </Badge>
      );
    case "failed":
      return (
        <Badge className="bg-red-100 text-red-800 hover:bg-red-100">
          <AlertCircle className="h-3 w-3 mr-1" />
          Fallito
        </Badge>
      );
    case "pending":
    case "processing":
      return (
        <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">
          <Clock className="h-3 w-3 mr-1" />
          In corso
        </Badge>
      );
    default:
      return <Badge variant="secondary">{status}</Badge>;
  }
}

interface SyncHistoryLogProps {
  sourceId?: number;
}

export function SyncHistoryLog({ sourceId }: SyncHistoryLogProps) {
  const [, setLocation] = useLocation();
  const [filters, setFilters] = useState<SyncHistoryFilters>({
    sourceId,
    page: 1,
    pageSize: 10,
  });
  const [pendingFilters, setPendingFilters] = useState<{
    sourceId?: string;
    status?: string;
    dateFrom?: string;
    dateTo?: string;
  }>({
    sourceId: sourceId?.toString() || "",
  });
  const [selectedRecord, setSelectedRecord] = useState<SyncHistoryRecord | null>(null);

  const { data: sourcesData } = useDatasetSyncSources();
  const { data: historyData, isLoading } = useDatasetSyncHistory(filters);

  const sources = sourcesData?.data || [];
  const history = historyData?.data || [];
  const totalPages = historyData?.totalPages || 1;
  const currentPage = historyData?.page || 1;

  const sourceMap = useMemo(() => {
    const map: Record<number, { name: string; targetDatasetId?: number }> = {};
    sources.forEach((s) => {
      map[s.id] = { name: s.name, targetDatasetId: s.target_dataset_id };
    });
    return map;
  }, [sources]);

  const handleSearch = () => {
    setFilters({
      sourceId: pendingFilters.sourceId ? parseInt(pendingFilters.sourceId) : undefined,
      status: pendingFilters.status as SyncHistoryFilters["status"],
      dateFrom: pendingFilters.dateFrom || undefined,
      dateTo: pendingFilters.dateTo || undefined,
      page: 1,
      pageSize: filters.pageSize,
    });
  };

  const handlePageChange = (newPage: number) => {
    setFilters((prev) => ({ ...prev, page: newPage }));
  };

  const handlePageSizeChange = (newSize: string) => {
    setFilters((prev) => ({ ...prev, pageSize: parseInt(newSize), page: 1 }));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Storico Sincronizzazioni</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="space-y-1">
            <label className="text-sm font-medium text-muted-foreground">Sorgente</label>
            <Select
              value={pendingFilters.sourceId || "all"}
              onValueChange={(v) =>
                setPendingFilters((prev) => ({ ...prev, sourceId: v === "all" ? "" : v }))
              }
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Tutte le sorgenti" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tutte le sorgenti</SelectItem>
                {sources.map((source) => (
                  <SelectItem key={source.id} value={source.id.toString()}>
                    {source.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-muted-foreground">Stato</label>
            <Select
              value={pendingFilters.status || "all"}
              onValueChange={(v) =>
                setPendingFilters((prev) => ({ ...prev, status: v === "all" ? "" : v }))
              }
            >
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Tutti gli stati" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tutti gli stati</SelectItem>
                <SelectItem value="completed">Completato</SelectItem>
                <SelectItem value="failed">Fallito</SelectItem>
                <SelectItem value="pending">In attesa</SelectItem>
                <SelectItem value="processing">In elaborazione</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-muted-foreground">Da</label>
            <Input
              type="date"
              className="w-[150px]"
              value={pendingFilters.dateFrom || ""}
              onChange={(e) =>
                setPendingFilters((prev) => ({ ...prev, dateFrom: e.target.value }))
              }
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-muted-foreground">A</label>
            <Input
              type="date"
              className="w-[150px]"
              value={pendingFilters.dateTo || ""}
              onChange={(e) =>
                setPendingFilters((prev) => ({ ...prev, dateTo: e.target.value }))
              }
            />
          </div>

          <Button onClick={handleSearch}>
            <Search className="h-4 w-4 mr-2" />
            Cerca
          </Button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : history.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            Nessuna sincronizzazione registrata
          </div>
        ) : (
          <>
            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data/Ora</TableHead>
                    <TableHead>Sorgente</TableHead>
                    <TableHead>Stato</TableHead>
                    <TableHead className="text-right">Righe Importate</TableHead>
                    <TableHead className="text-right">Inserite</TableHead>
                    <TableHead className="text-right">Aggiornate</TableHead>
                    <TableHead className="text-right">Colonne Mappate</TableHead>
                    <TableHead className="text-right">Durata</TableHead>
                    <TableHead className="text-center">Azioni</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {history.map((record) => (
                    <TableRow
                      key={record.id}
                      className="cursor-pointer"
                      onClick={() => setSelectedRecord(record)}
                    >
                      <TableCell className="font-medium">
                        {formatRelativeTime(record.started_at)}
                      </TableCell>
                      <TableCell>{sourceMap[record.source_id]?.name || `ID: ${record.source_id}`}</TableCell>
                      <TableCell>
                        <StatusBadge status={record.status} />
                      </TableCell>
                      <TableCell className="text-right">
                        {record.status === "failed" ? "-" : record.rows_imported ?? "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        {record.status === "failed" ? "-" : (record.rows_inserted != null && record.rows_inserted > 0 ? record.rows_inserted : "-")}
                      </TableCell>
                      <TableCell className="text-right">
                        {record.status === "failed" ? "-" : (record.rows_updated != null && record.rows_updated > 0 ? record.rows_updated : "-")}
                      </TableCell>
                      <TableCell className="text-right">
                        {record.columns_mapped?.length ?? record.columns_detected ?? "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatDuration(record.duration_ms)}
                      </TableCell>
                      <TableCell className="text-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedRecord(record);
                          }}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Elementi per pagina:</span>
                <Select
                  value={filters.pageSize?.toString() || "10"}
                  onValueChange={handlePageSizeChange}
                >
                  <SelectTrigger className="w-[70px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="25">25</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">
                  Pagina {currentPage} di {totalPages}
                </span>
                <div className="flex gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage <= 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage >= totalPages}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </>
        )}

        <Dialog open={!!selectedRecord} onOpenChange={() => setSelectedRecord(null)}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Dettagli Sincronizzazione</DialogTitle>
              <DialogDescription>
                ID: {selectedRecord?.sync_id}
              </DialogDescription>
            </DialogHeader>
            
            {selectedRecord && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Sorgente</label>
                    <p className="font-medium">
                      {sourceMap[selectedRecord.source_id]?.name || `ID: ${selectedRecord.source_id}`}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Stato</label>
                    <div className="mt-1">
                      <StatusBadge status={selectedRecord.status} />
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Inizio</label>
                    <p>
                      {new Date(selectedRecord.started_at).toLocaleString("it-IT")}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Fine</label>
                    <p>
                      {selectedRecord.completed_at
                        ? new Date(selectedRecord.completed_at).toLocaleString("it-IT")
                        : "-"}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Durata</label>
                    <p>{formatDuration(selectedRecord.duration_ms)}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Attivato da</label>
                    <p className="capitalize">{selectedRecord.triggered_by}</p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Righe Totali</label>
                    <p className="text-lg font-semibold">{selectedRecord.rows_total ?? "-"}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Righe Importate</label>
                    <p className="text-lg font-semibold text-green-600">
                      {selectedRecord.rows_imported ?? "-"}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Righe Saltate</label>
                    <p className="text-lg font-semibold text-yellow-600">
                      {selectedRecord.rows_skipped ?? "-"}
                    </p>
                  </div>
                </div>

                {selectedRecord.file_name && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">File</label>
                    <p>
                      {selectedRecord.file_name}
                      {selectedRecord.file_size_bytes && (
                        <span className="text-muted-foreground ml-2">
                          ({(selectedRecord.file_size_bytes / 1024).toFixed(1)} KB)
                        </span>
                      )}
                    </p>
                  </div>
                )}

                {selectedRecord.columns_mapped && selectedRecord.columns_mapped.length > 0 && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">
                      Colonne Mappate ({selectedRecord.columns_mapped.length})
                    </label>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {selectedRecord.columns_mapped.map((col, idx) => (
                        <Badge key={idx} variant="secondary" className="text-xs">
                          {col}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {selectedRecord.columns_unmapped && selectedRecord.columns_unmapped.length > 0 && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">
                      Colonne Non Mappate ({selectedRecord.columns_unmapped.length})
                    </label>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {selectedRecord.columns_unmapped.map((col, idx) => (
                        <Badge key={idx} variant="outline" className="text-xs text-muted-foreground">
                          {col}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {selectedRecord.status === "completed" && sourceMap[selectedRecord.source_id]?.targetDatasetId && (
                  <div className="pt-2 border-t">
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => {
                        const datasetId = sourceMap[selectedRecord.source_id]?.targetDatasetId;
                        if (datasetId) {
                          setSelectedRecord(null);
                          setLocation(`/consultant/client-data-analysis?datasetId=${datasetId}`);
                        }
                      }}
                    >
                      <Database className="h-4 w-4 mr-2" />
                      Apri Dataset e Configura Mapping
                      <ExternalLink className="h-4 w-4 ml-2" />
                    </Button>
                  </div>
                )}

                {selectedRecord.status === "failed" && selectedRecord.error_message && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                    <label className="text-sm font-medium text-red-800">Errore</label>
                    <p className="text-red-700 mt-1">{selectedRecord.error_message}</p>
                    {selectedRecord.error_code && (
                      <p className="text-xs text-red-500 mt-1">Codice: {selectedRecord.error_code}</p>
                    )}
                  </div>
                )}

                <div>
                  <label className="text-sm font-medium text-muted-foreground">Dati JSON</label>
                  <pre className="mt-1 p-3 bg-slate-100 rounded-lg text-xs overflow-x-auto max-h-[200px]">
                    {JSON.stringify(selectedRecord, null, 2)}
                  </pre>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}

export default SyncHistoryLog;
