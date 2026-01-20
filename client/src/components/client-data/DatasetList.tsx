import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  Database,
  Eye,
  MessageSquare,
  Trash2,
  CheckCircle,
  Clock,
  AlertCircle,
  Loader2,
  Plus,
  Settings,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface Dataset {
  id: string;
  name: string;
  originalFilename: string;
  tableName: string;
  status: "pending" | "processing" | "ready" | "error";
  rowCount: number;
  columnMapping: Record<string, any>;
  createdAt: string;
  lastQueriedAt?: string;
  errorMessage?: string;
  analyticsEnabled?: boolean;
}

interface DatasetListProps {
  onSelectDataset: (dataset: Dataset) => void;
  onQueryDataset: (dataset: Dataset) => void;
  onNewDataset: () => void;
  selectedDatasetId?: string;
}

export function DatasetList({
  onSelectDataset,
  onQueryDataset,
  onNewDataset,
  selectedDatasetId,
}: DatasetListProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery<{ success: boolean; data: Dataset[]; count: number }>({
    queryKey: ["/api/client-data/datasets"],
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/client-data/datasets/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/client-data/datasets"] });
      toast({
        title: "Dataset eliminato",
        description: "Il dataset è stato eliminato con successo",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Errore",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const getStatusBadge = (status: Dataset["status"]) => {
    switch (status) {
      case "ready":
        return (
          <Badge className="bg-emerald-100 text-emerald-700 flex items-center gap-1">
            <CheckCircle className="h-3 w-3" />
            Pronto
          </Badge>
        );
      case "processing":
        return (
          <Badge className="bg-blue-100 text-blue-700 flex items-center gap-1">
            <Loader2 className="h-3 w-3 animate-spin" />
            Elaborazione
          </Badge>
        );
      case "pending":
        return (
          <Badge className="bg-amber-100 text-amber-700 flex items-center gap-1">
            <Clock className="h-3 w-3" />
            In attesa
          </Badge>
        );
      case "error":
        return (
          <Badge className="bg-red-100 text-red-700 flex items-center gap-1">
            <AlertCircle className="h-3 w-3" />
            Errore
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("it-IT", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatRowCount = (count: number) => {
    if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
    if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
    return count.toString();
  };

  if (error) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <AlertCircle className="h-12 w-12 mx-auto text-red-500 mb-4" />
          <p className="text-slate-600 dark:text-slate-400">
            Errore nel caricamento dei dataset
          </p>
        </CardContent>
      </Card>
    );
  }

  const datasets = data?.data || [];

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5 text-cyan-600" />
            I Tuoi Dataset
          </CardTitle>
          <CardDescription>
            {datasets.length} dataset caricati
          </CardDescription>
        </div>
        <Button onClick={onNewDataset} className="bg-emerald-600 hover:bg-emerald-700">
          <Plus className="h-4 w-4 mr-2" />
          Nuovo Dataset
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : datasets.length === 0 ? (
          <div className="text-center py-12">
            <Database className="h-16 w-16 mx-auto text-slate-300 dark:text-slate-600 mb-4" />
            <p className="text-lg font-medium text-slate-600 dark:text-slate-400 mb-2">
              Nessun dataset ancora
            </p>
            <p className="text-sm text-slate-500 mb-4">
              Carica il tuo primo file Excel o CSV per iniziare l'analisi
            </p>
            <Button onClick={onNewDataset} className="bg-emerald-600 hover:bg-emerald-700">
              <Plus className="h-4 w-4 mr-2" />
              Carica Dataset
            </Button>
          </div>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Stato</TableHead>
                  <TableHead>Righe</TableHead>
                  <TableHead>Colonne</TableHead>
                  <TableHead>Creato</TableHead>
                  <TableHead className="text-right">Azioni</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {datasets.map((dataset) => (
                  <TableRow
                    key={dataset.id}
                    className={`cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 ${
                      selectedDatasetId === dataset.id ? "bg-cyan-50 dark:bg-cyan-900/20" : ""
                    }`}
                    onClick={() => dataset.status === "ready" && onSelectDataset(dataset)}
                  >
                    <TableCell>
                      <div>
                        <p className="font-medium">{dataset.name}</p>
                        <p className="text-xs text-slate-500">{dataset.originalFilename}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        {getStatusBadge(dataset.status)}
                        {dataset.status === "ready" && !dataset.analyticsEnabled && (
                          <Badge className="bg-amber-100 text-amber-700 flex items-center gap-1 text-xs">
                            <Settings className="h-3 w-3" />
                            Mapping
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="font-mono">
                      {formatRowCount(dataset.rowCount)}
                    </TableCell>
                    <TableCell>
                      {Object.keys(dataset.columnMapping || {}).length}
                    </TableCell>
                    <TableCell className="text-sm text-slate-500">
                      {formatDate(dataset.createdAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => onSelectDataset(dataset)}
                          disabled={dataset.status !== "ready"}
                          title="Visualizza dati"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => onQueryDataset(dataset)}
                          disabled={dataset.status !== "ready"}
                          title="Query AI"
                        >
                          <MessageSquare className="h-4 w-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-red-500 hover:text-red-600 hover:bg-red-50"
                              title="Elimina"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Elimina Dataset</AlertDialogTitle>
                              <AlertDialogDescription>
                                Sei sicuro di voler eliminare "{dataset.name}"? Questa azione non può essere annullata.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Annulla</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => deleteMutation.mutate(dataset.id)}
                                className="bg-red-600 hover:bg-red-700"
                              >
                                Elimina
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
