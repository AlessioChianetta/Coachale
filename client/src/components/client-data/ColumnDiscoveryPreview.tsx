import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Check, Edit2, AlertTriangle, Sparkles, Loader2 } from "lucide-react";

interface ColumnDefinition {
  originalName: string;
  suggestedName: string;
  displayName: string;
  dataType: "text" | "number" | "date" | "boolean" | "currency" | "percentage";
  description?: string;
  confidence: number;
  sampleValues: any[];
}

interface DiscoveryResult {
  columns: ColumnDefinition[];
  overallConfidence: number;
  autoConfirmed: boolean;
  templateDetected?: string;
  aiUsed: boolean;
  totalRowCount: number;
  sampleRows: Record<string, any>[];
}

interface ColumnDiscoveryPreviewProps {
  filePath: string;
  filename: string;
  sheetName?: string;
  onConfirm: (columns: ColumnDefinition[], datasetName: string) => void;
  onCancel: () => void;
  isImporting?: boolean;
}

const dataTypes = [
  { value: "text", label: "Testo" },
  { value: "number", label: "Numero" },
  { value: "date", label: "Data" },
  { value: "boolean", label: "Sì/No" },
  { value: "currency", label: "Valuta" },
  { value: "percentage", label: "Percentuale" },
];

function normalizeDataType(backendType: string | null | undefined): ColumnDefinition["dataType"] {
  if (!backendType) {
    return "text";
  }
  
  const lowerType = backendType.toLowerCase().trim();
  
  if (lowerType.includes("timestamp") || lowerType.includes("date") || lowerType.includes("time")) {
    return "date";
  }
  
  if (lowerType.includes("int") || lowerType.includes("numeric") || lowerType.includes("decimal") ||
      lowerType.includes("float") || lowerType.includes("double") || lowerType.includes("real") ||
      lowerType.includes("number") || lowerType === "serial" || lowerType === "bigserial") {
    return "number";
  }
  
  if (lowerType.includes("bool")) {
    return "boolean";
  }
  
  if (lowerType.includes("money") || lowerType.includes("currency")) {
    return "currency";
  }
  
  if (lowerType.includes("percent")) {
    return "percentage";
  }
  
  if (lowerType.includes("text") || lowerType.includes("char") || lowerType.includes("varchar") ||
      lowerType.includes("string")) {
    return "text";
  }
  
  if (["text", "number", "date", "boolean", "currency", "percentage"].includes(lowerType)) {
    return lowerType as ColumnDefinition["dataType"];
  }
  
  console.warn(`[ColumnDiscovery] Unknown data type "${backendType}", defaulting to "text"`);
  return "text";
}

export function ColumnDiscoveryPreview({
  filePath,
  filename,
  sheetName,
  onConfirm,
  onCancel,
  isImporting = false,
}: ColumnDiscoveryPreviewProps) {
  const { toast } = useToast();
  const [columns, setColumns] = useState<ColumnDefinition[]>([]);
  const [discoveryResult, setDiscoveryResult] = useState<DiscoveryResult | null>(null);
  const [editingColumn, setEditingColumn] = useState<string | null>(null);
  const [datasetName, setDatasetName] = useState(
    filename.replace(/\.(xlsx|xls|csv)$/i, "")
  );

  const discoverMutation = useMutation({
    mutationFn: () =>
      apiRequest("POST", "/api/client-data/discover-columns", {
        filePath,
        filename,
        sheetName,
      }),
    onSuccess: (data: any) => {
      if (data.success) {
        setDiscoveryResult(data.data);
        const normalizedColumns = data.data.columns.map((col: any) => ({
          ...col,
          dataType: normalizeDataType(col.dataType),
        }));
        setColumns(normalizedColumns);
        toast({
          title: "Colonne rilevate",
          description: `${data.data.columns.length} colonne trovate con confidenza ${Math.round(data.data.overallConfidence * 100)}%`,
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Errore rilevamento",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleDiscover = () => {
    discoverMutation.mutate();
  };

  const handleColumnChange = (
    originalName: string,
    field: keyof ColumnDefinition,
    value: any
  ) => {
    setColumns((prev) =>
      prev.map((col) =>
        col.originalName === originalName ? { ...col, [field]: value } : col
      )
    );
  };

  const handleConfirm = () => {
    if (!datasetName.trim()) {
      toast({
        title: "Nome richiesto",
        description: "Inserisci un nome per il dataset",
        variant: "destructive",
      });
      return;
    }
    onConfirm(columns, datasetName.trim());
  };

  const getConfidenceBadge = (confidence: number) => {
    if (confidence >= 0.9) {
      return <Badge className="bg-emerald-100 text-emerald-700">Alta</Badge>;
    } else if (confidence >= 0.7) {
      return <Badge className="bg-amber-100 text-amber-700">Media</Badge>;
    } else {
      return <Badge className="bg-red-100 text-red-700">Bassa</Badge>;
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-purple-600" />
          Rilevamento Colonne
        </CardTitle>
        <CardDescription>
          L'AI analizza la struttura del tuo file e suggerisce i tipi di dati
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {!discoveryResult && (
          <div className="text-center py-8">
            <p className="text-slate-600 dark:text-slate-400 mb-4">
              Clicca per avviare l'analisi automatica delle colonne
            </p>
            <Button
              onClick={handleDiscover}
              disabled={discoverMutation.isPending}
              className="bg-purple-600 hover:bg-purple-700"
            >
              {discoverMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Analisi in corso...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Rileva Colonne con AI
                </>
              )}
            </Button>
          </div>
        )}

        {discoveryResult && (
          <>
            <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
              <div>
                <p className="font-medium">Confidenza Complessiva</p>
                <p className="text-sm text-slate-500">
                  {discoveryResult.aiUsed ? "Analisi AI" : "Template rilevato"}
                  {discoveryResult.templateDetected && ` - ${discoveryResult.templateDetected}`}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Progress
                  value={discoveryResult.overallConfidence * 100}
                  className="w-32 h-2"
                />
                <span className="font-medium">
                  {Math.round(discoveryResult.overallConfidence * 100)}%
                </span>
              </div>
            </div>

            <div className="space-y-3">
              <label className="text-sm font-medium">Nome Dataset</label>
              <Input
                value={datasetName}
                onChange={(e) => setDatasetName(e.target.value)}
                placeholder="Es. Vendite Q1 2024"
              />
            </div>

            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Colonna Originale</TableHead>
                    <TableHead>Nome Visualizzato</TableHead>
                    <TableHead>Tipo Dati</TableHead>
                    <TableHead>Confidenza</TableHead>
                    <TableHead>Esempi</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {columns.map((col) => (
                    <TableRow key={col.originalName}>
                      <TableCell className="font-mono text-sm">
                        {col.originalName}
                      </TableCell>
                      <TableCell>
                        {editingColumn === col.originalName ? (
                          <Input
                            value={col.displayName}
                            onChange={(e) =>
                              handleColumnChange(
                                col.originalName,
                                "displayName",
                                e.target.value
                              )
                            }
                            className="w-40"
                            autoFocus
                            onBlur={() => setEditingColumn(null)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") setEditingColumn(null);
                            }}
                          />
                        ) : (
                          <span
                            className="cursor-pointer hover:text-purple-600"
                            onClick={() => setEditingColumn(col.originalName)}
                          >
                            {col.displayName}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Select
                          value={col.dataType}
                          onValueChange={(value) =>
                            handleColumnChange(col.originalName, "dataType", value)
                          }
                        >
                          <SelectTrigger className="w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {dataTypes.map((type) => (
                              <SelectItem key={type.value} value={type.value}>
                                {type.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>{getConfidenceBadge(col.confidence)}</TableCell>
                      <TableCell className="max-w-48 truncate text-sm text-slate-500">
                        {col.sampleValues.slice(0, 3).join(", ")}
                      </TableCell>
                      <TableCell>
                        {col.confidence < 0.7 && (
                          <AlertTriangle className="h-4 w-4 text-amber-500" />
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {discoveryResult.sampleRows.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Anteprima Dati ({discoveryResult.totalRowCount} righe totali)
                </p>
                <div className="border rounded-lg overflow-x-auto max-h-48">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {columns.map((col) => (
                          <TableHead key={col.originalName} className="whitespace-nowrap">
                            {col.displayName}
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {discoveryResult.sampleRows.slice(0, 5).map((row, idx) => (
                        <TableRow key={idx}>
                          {columns.map((col) => (
                            <TableCell key={col.originalName} className="text-sm">
                              {row[col.originalName]?.toString() || "-"}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
      <CardFooter className="flex justify-between">
        <Button variant="outline" onClick={onCancel} disabled={isImporting}>
          Annulla
        </Button>
        {discoveryResult && (
          <Button 
            onClick={handleConfirm} 
            className="bg-emerald-600 hover:bg-emerald-700"
            disabled={isImporting}
          >
            {isImporting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Importazione in corso...
              </>
            ) : (
              <>
                <Check className="h-4 w-4 mr-2" />
                Conferma e Importa
              </>
            )}
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
