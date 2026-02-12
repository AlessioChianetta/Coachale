import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiRequest } from "@/lib/queryClient";
import {
  Link,
  ArrowRight,
  Database,
  Table2,
  CheckCircle,
  AlertTriangle,
  Loader2,
  FileSpreadsheet,
  Unlink,
  Users,
} from "lucide-react";

interface Client {
  id: string;
  username: string;
  firstName?: string;
  lastName?: string;
}

interface FileSchema {
  filename: string;
  filePath: string;
  tableName: string;
  columns: string[];
  sampleValues: Record<string, any[]>;
  rowCount: number;
  delimiter: string;
  encoding: string;
}

interface JoinCandidate {
  sourceFile: string;
  sourceColumn: string;
  targetFile: string;
  targetColumn: string;
  confidence: number;
  matchType: "exact_name" | "overlap_only" | "pk_fk_pattern" | "semantic_match";
  valueOverlapPercent: number;
  joinType: "LEFT" | "INNER";
  explanation: string;
}

interface JoinDetectionResult {
  files: FileSchema[];
  suggestedJoins: JoinCandidate[];
  primaryTable: string;
  joinOrder: string[];
  overallConfidence: number;
  orphanTables?: string[];
}

interface JoinPreviewProps {
  files: FileSchema[];
  joinResult: JoinDetectionResult;
  onConfirm: (name: string, selectedJoins: JoinCandidate[], primaryTable: string, joinOrder: string[], clientId?: string) => void;
  onCancel: () => void;
  isCreating?: boolean;
}

function getConfidenceColor(confidence: number) {
  const pct = confidence * 100;
  if (pct >= 80) return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400";
  if (pct >= 60) return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400";
  return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";
}

function getMatchTypeLabel(matchType: JoinCandidate["matchType"]) {
  switch (matchType) {
    case "exact_name": return "Nome Esatto";
    case "overlap_only": return "Valori Comuni";
    case "pk_fk_pattern": return "PK/FK";
    case "semantic_match": return "Semantico";
  }
}

function getDelimiterLabel(delimiter: string) {
  switch (delimiter) {
    case ",": return "Virgola (,)";
    case ";": return "Punto e virgola (;)";
    case "\t": return "Tab";
    case "|": return "Pipe (|)";
    default: return delimiter;
  }
}

export function JoinPreview({ files, joinResult, onConfirm, onCancel, isCreating }: JoinPreviewProps) {
  const defaultName = useMemo(
    () => `dataset_unificato_${Date.now()}`,
    []
  );
  const [datasetName, setDatasetName] = useState(defaultName);
  const [selectedClientId, setSelectedClientId] = useState("");

  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
    queryFn: () => apiRequest("/api/clients"),
  });

  const handleConfirm = () => {
    const clientId = selectedClientId && selectedClientId !== "__none__" ? selectedClientId : undefined;
    onConfirm(datasetName, joinResult.suggestedJoins, joinResult.primaryTable, joinResult.joinOrder, clientId);
  };

  const noJoins = joinResult.suggestedJoins.length === 0 || joinResult.overallConfidence === 0;
  const hasOrphans = joinResult.orphanTables && joinResult.orphanTables.length > 0;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Link className="h-5 w-5 text-emerald-600" />
              Anteprima Join Automatico
            </div>
            <Badge className={getConfidenceColor(joinResult.overallConfidence)}>
              Confidenza: {Math.round(joinResult.overallConfidence * 100)}%
            </Badge>
          </CardTitle>
        </CardHeader>
      </Card>

      {noJoins && (
        <Card className="border-yellow-300 dark:border-yellow-700">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-yellow-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium text-yellow-800 dark:text-yellow-300">
                  Nessuna relazione rilevata
                </p>
                <p className="text-sm text-yellow-700 dark:text-yellow-400 mt-1">
                  Non sono state trovate relazioni automatiche tra i file. Verifica che i nomi delle colonne
                  corrispondano tra i file (es. "id_prodotto" in entrambi) oppure che ci siano valori in comune.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div>
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-2">
          <Database className="h-4 w-4" />
          File Caricati ({files.length})
        </h3>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {files.map((file) => {
            const isPrimary = file.filename === joinResult.primaryTable;
            const isOrphan = joinResult.orphanTables?.includes(file.filename);
            return (
              <Card
                key={file.filename}
                className={
                  isPrimary
                    ? "border-emerald-400 dark:border-emerald-600"
                    : isOrphan
                    ? "border-orange-300 dark:border-orange-600 opacity-70"
                    : ""
                }
              >
                <CardContent className="pt-4 pb-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <FileSpreadsheet className="h-4 w-4 text-slate-500 flex-shrink-0" />
                      <span className="font-medium text-sm truncate">{file.filename}</span>
                    </div>
                    {isPrimary && (
                      <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400 flex-shrink-0 text-xs">
                        Tabella Fatti
                      </Badge>
                    )}
                    {isOrphan && (
                      <Badge className="bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400 flex-shrink-0 text-xs">
                        Non collegata
                      </Badge>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                    <span>Righe: <strong className="text-slate-700 dark:text-slate-300">{file.rowCount.toLocaleString()}</strong></span>
                    <span>Colonne: <strong className="text-slate-700 dark:text-slate-300">{file.columns.length}</strong></span>
                    <span>Delimitatore: <strong className="text-slate-700 dark:text-slate-300">{getDelimiterLabel(file.delimiter)}</strong></span>
                    <span>Encoding: <strong className="text-slate-700 dark:text-slate-300">{file.encoding}</strong></span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {joinResult.suggestedJoins.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-2">
            <Table2 className="h-4 w-4" />
            Relazioni Selezionate ({joinResult.suggestedJoins.length})
          </h3>
          <div className="space-y-3">
            {joinResult.suggestedJoins.map((join, index) => {
              const confidencePct = Math.round(join.confidence * 100);
              return (
                <Card key={index}>
                  <CardContent className="pt-4 pb-4">
                    <div className="flex items-start gap-3">
                      <div className="pt-1">
                        <CheckCircle className="h-4 w-4 text-emerald-500" />
                      </div>
                      <div className="flex-1 space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium text-sm">{join.sourceFile}</span>
                          <ArrowRight className="h-4 w-4 text-slate-400" />
                          <span className="font-medium text-sm">{join.targetFile}</span>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                          <code className="bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
                            {join.sourceColumn}
                          </code>
                          <span className="text-slate-400">=</span>
                          <code className="bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
                            {join.targetColumn}
                          </code>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge className={`text-xs ${getConfidenceColor(join.confidence)}`}>
                            {confidencePct}%
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            {getMatchTypeLabel(join.matchType)}
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            {join.joinType}
                          </Badge>
                          <span className="text-xs text-slate-500 dark:text-slate-400">
                            Sovrapposizione valori: {join.valueOverlapPercent}%
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 italic">
                          {join.explanation}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {hasOrphans && (
        <Card className="border-orange-300 dark:border-orange-700">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-start gap-3">
              <Unlink className="h-5 w-5 text-orange-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium text-orange-800 dark:text-orange-300 text-sm">
                  Tabelle non collegabili ({joinResult.orphanTables!.length})
                </p>
                <p className="text-xs text-orange-700 dark:text-orange-400 mt-1">
                  Le seguenti tabelle non hanno relazioni valide con la tabella principale e verranno escluse dal dataset unificato:
                </p>
                <div className="flex flex-wrap gap-2 mt-2">
                  {joinResult.orphanTables!.map((name) => (
                    <Badge key={name} variant="outline" className="text-xs text-orange-700 dark:text-orange-400 border-orange-300 dark:border-orange-600">
                      {name}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div>
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-2">
          <CheckCircle className="h-4 w-4" />
          Ordine di Join
        </h3>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex flex-wrap items-center gap-2">
              {joinResult.joinOrder.map((tableName, idx) => (
                <div key={tableName} className="flex items-center gap-2">
                  {idx > 0 && <ArrowRight className="h-4 w-4 text-slate-400" />}
                  <Badge
                    variant={idx === 0 ? "default" : "outline"}
                    className={idx === 0 ? "bg-emerald-600 hover:bg-emerald-600" : ""}
                  >
                    {idx + 1}. {tableName}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div>
        <Label htmlFor="client-select" className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
          <Users className="h-4 w-4" />
          Associa a un cliente (opzionale)
        </Label>
        <Select value={selectedClientId} onValueChange={setSelectedClientId}>
          <SelectTrigger id="client-select" className="mt-2">
            <SelectValue placeholder="Seleziona un cliente (opzionale)" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">Nessun cliente specifico</SelectItem>
            {clients.map((c) => (
              <SelectItem key={c.id} value={String(c.id)}>
                {c.firstName && c.lastName ? `${c.firstName} ${c.lastName}` : c.username}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-slate-500 mt-1">
          Se associ il dataset a un cliente, anche lui potra vederlo e interrogarlo.
        </p>
      </div>

      <div>
        <Label htmlFor="dataset-name" className="text-sm font-semibold text-slate-700 dark:text-slate-300">
          Nome Dataset Unificato
        </Label>
        <Input
          id="dataset-name"
          value={datasetName}
          onChange={(e) => setDatasetName(e.target.value)}
          placeholder="Nome del dataset..."
          className="mt-2"
          disabled={isCreating}
        />
      </div>

      <div className="flex items-center justify-end gap-3 pt-2">
        <Button variant="outline" onClick={onCancel} disabled={isCreating}>
          Annulla
        </Button>
        <Button
          onClick={handleConfirm}
          disabled={isCreating || !datasetName.trim()}
          className="bg-emerald-600 hover:bg-emerald-700 text-white"
        >
          {isCreating ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Creazione in corso...
            </>
          ) : (
            <>
              <Database className="h-4 w-4 mr-2" />
              Crea Dataset Unificato
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
