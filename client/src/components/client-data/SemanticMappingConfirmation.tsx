import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CheckCircle2,
  AlertTriangle,
  Columns,
  RefreshCw,
  ArrowRight,
  Sparkles,
  TrendingUp,
  Info,
  AlertCircle,
  Bot,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface SemanticMapping {
  id: number;
  physicalColumn: string;
  logicalRole: string;
  confidence: number;
  status: "pending" | "confirmed" | "rejected";
  autoApproved: boolean;
  isCritical: boolean;
  displayName: string;
}

interface SemanticMappingResult {
  datasetId: number;
  analyticsEnabled: boolean;
  mappings: SemanticMapping[];
  pendingCritical: string[];
  missingRequired: string[];
}

interface ColumnStatistics {
  min: number | null;
  max: number | null;
  avg: number | null;
  nullCount: number;
  distinctCount: number;
  totalCount: number;
}

interface ColumnAnalysis {
  physicalColumn: string;
  sampleValues: any[];
  detectedType: string;
  statistics: ColumnStatistics | null;
  suggestedLogicalRole: string | null;
  confidence: number;
  reasoning: string;
  anomalies: string[];
  isCritical: boolean;
}

interface AIMappingSuggestion {
  suggestions: ColumnAnalysis[];
  warnings: string[];
  unmappedColumns: string[];
  analysisTime: number;
}

const LOGICAL_ROLE_OPTIONS = [
  { value: "price", label: "Prezzo di Vendita" },
  { value: "cost", label: "Costo Unitario" },
  { value: "quantity", label: "Quantità" },
  { value: "revenue_amount", label: "Importo Fatturato" },
  { value: "order_date", label: "Data Ordine" },
  { value: "product_name", label: "Nome Prodotto" },
  { value: "category", label: "Categoria" },
  { value: "customer_id", label: "ID Cliente" },
  { value: "document_id", label: "ID Documento" },
  { value: "payment_method", label: "Metodo Pagamento" },
  { value: "tax_rate", label: "Aliquota IVA" },
  { value: "is_sellable", label: "Prodotto Vendibile" },
  { value: "line_id", label: "ID Riga" },
];

const ROLE_FUNCTIONS: Record<string, { label: string; functions: string[] }> = {
  price: { 
    label: "Prezzo di Vendita", 
    functions: ["Fatturato lordo", "Ricavo calcolato", "Food Cost %", "Prezzo medio"] 
  },
  cost: { 
    label: "Costo Unitario", 
    functions: ["Food Cost", "Food Cost %", "Margine lordo", "Margine %", "Analisi profittabilità"] 
  },
  quantity: { 
    label: "Quantità", 
    functions: ["Fatturato", "Food Cost", "Quantità totale", "Margine", "Top prodotti venduti"] 
  },
  revenue_amount: { 
    label: "Importo Fatturato", 
    functions: ["Fatturato totale", "Ticket medio", "Trend vendite", "Analisi per categoria"] 
  },
  order_date: { 
    label: "Data Ordine", 
    functions: ["Trend temporali", "Confronto periodi", "Stagionalità", "Pattern giornalieri"] 
  },
  product_name: { 
    label: "Nome Prodotto", 
    functions: ["Top/Flop prodotti", "Analisi ABC", "Performance per prodotto"] 
  },
  category: { 
    label: "Categoria", 
    functions: ["Breakdown per categoria", "Mix vendite", "Confronto categorie"] 
  },
  customer_id: { 
    label: "ID Cliente", 
    functions: ["Clienti unici", "Frequenza acquisto", "Top clienti", "Analisi RFM"] 
  },
  document_id: { 
    label: "ID Documento", 
    functions: ["Conteggio ordini", "Ticket medio", "Ordini per periodo"] 
  },
  payment_method: { 
    label: "Metodo Pagamento", 
    functions: ["Distribuzione pagamenti", "Preferenze clienti", "Trend metodi"] 
  },
  supplier_name: {
    label: "Fornitore",
    functions: ["Analisi fornitori", "Costi per fornitore", "Volumi acquisto"]
  },
  waiter: {
    label: "Cameriere",
    functions: ["Performance camerieri", "Vendite per operatore", "Confronto staff"]
  },
  discount_amount: {
    label: "Importo Sconto",
    functions: ["Totale sconti", "Impatto sconti su margine"]
  },
  tax_amount: {
    label: "IVA",
    functions: ["Calcolo IVA", "Fatturato netto vs lordo"]
  },
  tax_rate: {
    label: "Aliquota IVA",
    functions: ["Breakdown per aliquota", "Fatturato 10% vs 22%", "Analisi fiscale"]
  },
  is_sellable: {
    label: "Prodotto Vendibile",
    functions: ["Filtro prodotti reali", "Escludi note/modifiche", "Ranking accurati"]
  },
  line_id: {
    label: "ID Riga",
    functions: ["Conteggio righe", "Dettaglio transazioni"]
  },
};

interface SemanticMappingConfirmationProps {
  datasetId: number;
  onConfirmed?: () => void;
}

export function SemanticMappingConfirmation({
  datasetId,
  onConfirmed,
}: SemanticMappingConfirmationProps) {
  const [selectedMappings, setSelectedMappings] = useState<Map<string, string>>(new Map());
  const [showAISuggestions, setShowAISuggestions] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data, isLoading, error, refetch } = useQuery<{ success: boolean; data: SemanticMappingResult }>({
    queryKey: [`/api/client-data/datasets/${datasetId}/semantic-mappings`],
    queryFn: async () => {
      const token = localStorage.getItem("token");
      const response = await fetch(`/api/client-data/datasets/${datasetId}/semantic-mappings`, {
        headers: {
          "Content-Type": "application/json",
          ...(token && { Authorization: `Bearer ${token}` }),
        },
      });
      if (!response.ok) throw new Error("Errore nel caricamento");
      return response.json();
    },
  });

  const { data: aiData, isLoading: aiLoading, refetch: refetchAI } = useQuery<{ success: boolean; data: AIMappingSuggestion }>({
    queryKey: [`/api/client-data/datasets/${datasetId}/ai-mapping-suggestions`],
    queryFn: async () => {
      const token = localStorage.getItem("token");
      const response = await fetch(`/api/client-data/datasets/${datasetId}/ai-mapping-suggestions`, {
        headers: {
          "Content-Type": "application/json",
          ...(token && { Authorization: `Bearer ${token}` }),
        },
      });
      if (!response.ok) throw new Error("Errore nel caricamento suggerimenti AI");
      return response.json();
    },
    enabled: showAISuggestions,
    staleTime: 5 * 60 * 1000,
  });

  const confirmMutation = useMutation({
    mutationFn: async (confirmations: Array<{ physicalColumn: string; logicalRole?: string }>) => {
      const token = localStorage.getItem("token");
      const response = await fetch(`/api/client-data/datasets/${datasetId}/semantic-mappings/confirm`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        body: JSON.stringify({ confirmations }),
      });
      if (!response.ok) throw new Error("Errore nella conferma");
      return response.json();
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: [`/api/client-data/datasets/${datasetId}/semantic-mappings`] });
      queryClient.invalidateQueries({ queryKey: [`/api/client-data/datasets`] });
      setSelectedMappings(new Map());
      toast({
        title: "Mapping confermato",
        description: result.data.analyticsEnabled
          ? "Analytics abilitato! Ora puoi analizzare i tuoi dati."
          : `${result.data.confirmed} colonne confermate.`,
      });
      if (result.data.analyticsEnabled && onConfirmed) {
        onConfirmed();
      }
    },
    onError: () => {
      toast({
        title: "Errore",
        description: "Impossibile confermare il mapping. Riprova.",
        variant: "destructive",
      });
    },
  });

  const mappingResult = data?.data;
  const pendingMappings = mappingResult?.mappings.filter((m) => m.status === "pending") || [];
  const pendingCritical = pendingMappings.filter((m) => m.isCritical);
  const pendingNonCritical = pendingMappings.filter((m) => !m.isCritical);
  const confirmedMappings = mappingResult?.mappings.filter((m) => m.status === "confirmed") || [];
  const aiSuggestions = aiData?.data;

  useEffect(() => {
    if ((pendingMappings.length > 0 || mappingResult?.analyticsEnabled) && !showAISuggestions) {
      setShowAISuggestions(true);
    }
  }, [pendingMappings.length, mappingResult?.analyticsEnabled]);

  const getAISuggestionForColumn = (physicalColumn: string): ColumnAnalysis | undefined => {
    return aiSuggestions?.suggestions.find(s => s.physicalColumn === physicalColumn);
  };

  const toggleMapping = (physicalColumn: string, logicalRole: string) => {
    const newSelected = new Map(selectedMappings);
    if (newSelected.has(physicalColumn)) {
      newSelected.delete(physicalColumn);
    } else {
      newSelected.set(physicalColumn, logicalRole);
    }
    setSelectedMappings(newSelected);
  };

  const updateMappingRole = (physicalColumn: string, newRole: string) => {
    const newSelected = new Map(selectedMappings);
    newSelected.set(physicalColumn, newRole);
    setSelectedMappings(newSelected);
  };

  const handleConfirm = () => {
    if (selectedMappings.size === 0) return;
    const confirmations = Array.from(selectedMappings.entries()).map(([physicalColumn, logicalRole]) => ({
      physicalColumn,
      logicalRole,
    }));
    confirmMutation.mutate(confirmations);
  };

  const handleConfirmAll = () => {
    const confirmations = pendingMappings.map((m) => ({ 
      physicalColumn: m.physicalColumn,
      logicalRole: m.logicalRole,
    }));
    confirmMutation.mutate(confirmations);
  };

  const formatNumber = (num: number | null): string => {
    if (num === null) return "-";
    return num.toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64 mt-2" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-red-500">Errore nel caricamento del mapping</p>
          <Button variant="outline" onClick={() => refetch()} className="mt-4">
            <RefreshCw className="h-4 w-4 mr-2" />
            Riprova
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (mappingResult?.analyticsEnabled && pendingCritical.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              <CardTitle className="text-lg">Mapping Colonne</CardTitle>
            </div>
            {pendingNonCritical.length > 0 && (
              <Button 
                size="sm" 
                onClick={() => {
                  const confirmations = pendingNonCritical.map((m) => ({ 
                    physicalColumn: m.physicalColumn,
                    logicalRole: m.logicalRole,
                  }));
                  confirmMutation.mutate(confirmations);
                }}
                disabled={confirmMutation.isPending}
              >
                {confirmMutation.isPending ? (
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                )}
                Conferma {pendingNonCritical.length} in attesa
              </Button>
            )}
          </div>
          <CardDescription>
            Ecco come le colonne sono mappate per l'AI e quali funzioni abilitano
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="max-h-[500px] overflow-y-auto pr-2">
            {confirmedMappings.length > 0 && (
              <div className="mb-4">
                <h4 className="text-sm font-medium text-green-700 mb-2 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4" />
                  Colonne Confermate ({confirmedMappings.length})
                </h4>
                <div className="space-y-2">
                  {confirmedMappings.map((mapping) => {
                    const roleInfo = ROLE_FUNCTIONS[mapping.logicalRole];
                    return (
                      <div 
                        key={mapping.id}
                        className="p-3 rounded-lg border bg-gradient-to-r from-green-50 to-white"
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-mono text-sm bg-white px-2 py-0.5 rounded border text-gray-700">
                            {mapping.physicalColumn}
                          </span>
                          <ArrowRight className="h-4 w-4 text-gray-400" />
                          <Badge className="bg-green-100 text-green-800 border-green-200">
                            {roleInfo?.label || mapping.displayName}
                          </Badge>
                        </div>
                        {roleInfo?.functions && (
                          <div className="flex items-start gap-2 mt-2">
                            <Sparkles className="h-4 w-4 text-violet-500 mt-0.5 flex-shrink-0" />
                            <div className="flex flex-wrap gap-1">
                              {roleInfo.functions.map((fn, idx) => (
                                <span 
                                  key={idx}
                                  className="text-xs px-2 py-0.5 bg-violet-50 text-violet-700 rounded-full"
                                >
                                  {fn}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {pendingNonCritical.length > 0 && (
              <div className="mb-4">
                <h4 className="text-sm font-medium text-amber-700 mb-2 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  Colonne in Attesa di Conferma ({pendingNonCritical.length})
                </h4>
                <div className="space-y-2">
                  {pendingNonCritical.map((mapping) => {
                    const roleInfo = ROLE_FUNCTIONS[mapping.logicalRole];
                    const isSelected = selectedMappings.has(mapping.physicalColumn);
                    return (
                      <div 
                        key={mapping.id}
                        className={`p-3 rounded-lg border transition-all ${
                          isSelected 
                            ? "bg-violet-50 border-violet-300" 
                            : "bg-amber-50 border-amber-200"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => toggleMapping(mapping.physicalColumn, mapping.logicalRole)}
                          />
                          <span className="font-mono text-sm bg-white px-2 py-0.5 rounded border text-gray-700">
                            {mapping.physicalColumn}
                          </span>
                          <ArrowRight className="h-4 w-4 text-gray-400" />
                          <Select 
                            value={selectedMappings.get(mapping.physicalColumn) || mapping.logicalRole} 
                            onValueChange={(value) => updateMappingRole(mapping.physicalColumn, value)}
                          >
                            <SelectTrigger className="w-[180px] h-8 bg-white">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {LOGICAL_ROLE_OPTIONS.map((opt) => (
                                <SelectItem key={opt.value} value={opt.value}>
                                  {opt.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        {roleInfo?.functions && (
                          <div className="flex items-start gap-2 mt-2 ml-6">
                            <Sparkles className="h-3 w-3 text-violet-500 mt-0.5 flex-shrink-0" />
                            <div className="flex flex-wrap gap-1">
                              {roleInfo.functions.slice(0, 3).map((fn, idx) => (
                                <span 
                                  key={idx}
                                  className="text-xs px-1.5 py-0.5 bg-violet-50 text-violet-600 rounded"
                                >
                                  {fn}
                                </span>
                              ))}
                              {roleInfo.functions.length > 3 && (
                                <span className="text-xs text-gray-400">
                                  +{roleInfo.functions.length - 3}
                                </span>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                
                {selectedMappings.size > 0 && (
                  <div className="flex justify-end mt-3">
                    <Button
                      onClick={handleConfirm}
                      disabled={confirmMutation.isPending}
                      size="sm"
                      className="bg-violet-600 hover:bg-violet-700"
                    >
                      {confirmMutation.isPending ? (
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <CheckCircle2 className="h-4 w-4 mr-2" />
                      )}
                      Conferma {selectedMappings.size} Selezionate
                    </Button>
                  </div>
                )}
              </div>
            )}

            {aiSuggestions?.unmappedColumns && aiSuggestions.unmappedColumns.length > 0 && (
              <div className="mt-4 pt-4 border-t">
                <h4 className="text-sm font-medium text-gray-600 mb-2 flex items-center gap-2">
                  <Columns className="h-4 w-4" />
                  Colonne Non Mappate ({aiSuggestions.unmappedColumns.length})
                </h4>
                <p className="text-xs text-gray-500 mb-2">
                  Queste colonne esistono nel dataset ma non sono utilizzate per l'analisi
                </p>
                <div className="flex flex-wrap gap-1">
                  {aiSuggestions.unmappedColumns.slice(0, 20).map((col) => (
                    <span 
                      key={col}
                      className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded border"
                    >
                      {col}
                    </span>
                  ))}
                  {aiSuggestions.unmappedColumns.length > 20 && (
                    <span className="text-xs text-gray-400 py-1">
                      +{aiSuggestions.unmappedColumns.length - 20} altre
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
          
          {mappingResult.missingRequired && mappingResult.missingRequired.length > 0 && (
            <Alert className="mt-4 bg-amber-50 border-amber-200">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-amber-800">
                <strong>Colonne mancanti:</strong> {mappingResult.missingRequired.join(", ")}
                <br />
                <span className="text-sm">Alcune funzioni avanzate potrebbero non essere disponibili.</span>
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    );
  }

  if (pendingMappings.length === 0 && mappingResult?.mappings.length === 0) {
    return (
      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          Nessuna colonna rilevata automaticamente. Carica un nuovo dataset con colonne standard.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-violet-600" />
              Configurazione Intelligente Colonne
            </CardTitle>
            <CardDescription className="mt-1">
              L'AI ha analizzato i tuoi dati e suggerisce il mapping migliore
            </CardDescription>
          </div>
          {pendingMappings.length > 0 && (
            <Button onClick={handleConfirmAll} disabled={confirmMutation.isPending}>
              {confirmMutation.isPending ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4 mr-2" />
              )}
              Conferma Tutti
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {aiSuggestions?.warnings && aiSuggestions.warnings.length > 0 && (
          <div className="mb-4 space-y-2">
            {aiSuggestions.warnings.map((warning, idx) => (
              <Alert key={idx} className="bg-amber-50 border-amber-200">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                <AlertDescription className="text-amber-800">
                  {warning}
                </AlertDescription>
              </Alert>
            ))}
          </div>
        )}

        {pendingMappings.length > 0 && (
          <ScrollArea className="max-h-[500px]">
            <div className="space-y-4">
              {pendingMappings.map((mapping) => {
                const aiSuggestion = getAISuggestionForColumn(mapping.physicalColumn);
                const isSelected = selectedMappings.has(mapping.physicalColumn);
                const currentRole = selectedMappings.get(mapping.physicalColumn) || mapping.logicalRole;

                return (
                  <div
                    key={mapping.id}
                    className={`p-4 rounded-xl border transition-all ${
                      isSelected 
                        ? "bg-violet-50 border-violet-300 shadow-sm" 
                        : "bg-amber-50 border-amber-200 hover:border-amber-300"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleMapping(mapping.physicalColumn, mapping.logicalRole)}
                        className="mt-1"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono font-medium text-gray-900 bg-white px-2 py-0.5 rounded border">
                            {mapping.physicalColumn}
                          </span>
                          <ArrowRight className="h-4 w-4 text-gray-400 flex-shrink-0" />
                          <Select 
                            value={currentRole} 
                            onValueChange={(value) => updateMappingRole(mapping.physicalColumn, value)}
                          >
                            <SelectTrigger className="w-[200px] bg-white">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {LOGICAL_ROLE_OPTIONS.map((opt) => (
                                <SelectItem key={opt.value} value={opt.value}>
                                  {opt.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {mapping.isCritical && (
                            <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                              Critico
                            </Badge>
                          )}
                        </div>

                        {aiLoading && showAISuggestions ? (
                          <div className="mt-3 flex items-center gap-2 text-sm text-gray-500">
                            <RefreshCw className="h-3 w-3 animate-spin" />
                            Analisi AI in corso...
                          </div>
                        ) : aiSuggestion ? (
                          <div className="mt-3 space-y-2">
                            {aiSuggestion.sampleValues.length > 0 && (
                              <div className="flex items-center gap-2 text-sm">
                                <TrendingUp className="h-3 w-3 text-gray-400" />
                                <span className="text-gray-500">Sample:</span>
                                <span className="font-mono text-gray-700">
                                  {aiSuggestion.sampleValues.slice(0, 4).join(", ")}
                                  {aiSuggestion.sampleValues.length > 4 && "..."}
                                </span>
                              </div>
                            )}

                            {aiSuggestion.statistics && (
                              <div className="flex items-center gap-4 text-sm">
                                <span className="text-gray-500">
                                  Min: <span className="font-medium text-gray-700">{formatNumber(aiSuggestion.statistics.min)}</span>
                                </span>
                                <span className="text-gray-500">
                                  Max: <span className="font-medium text-gray-700">{formatNumber(aiSuggestion.statistics.max)}</span>
                                </span>
                                <span className="text-gray-500">
                                  Media: <span className="font-medium text-gray-700">{formatNumber(aiSuggestion.statistics.avg)}</span>
                                </span>
                              </div>
                            )}

                            {aiSuggestion.reasoning && (
                              <div className="flex items-start gap-2 text-sm bg-violet-50 p-2 rounded-lg border border-violet-100">
                                <Sparkles className="h-4 w-4 text-violet-500 mt-0.5 flex-shrink-0" />
                                <span className="text-violet-800">{aiSuggestion.reasoning}</span>
                              </div>
                            )}

                            {aiSuggestion.anomalies.length > 0 && (
                              <div className="space-y-1">
                                {aiSuggestion.anomalies.map((anomaly, idx) => (
                                  <div key={idx} className="flex items-start gap-2 text-sm bg-amber-50 p-2 rounded-lg border border-amber-100">
                                    <AlertCircle className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
                                    <span className="text-amber-800">{anomaly}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="mt-2 text-sm text-gray-600">
                            Confidenza: {(mapping.confidence * 100).toFixed(0)}%
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}

        {selectedMappings.size > 0 && (
          <div className="flex justify-end pt-4 mt-4 border-t">
            <Button
              onClick={handleConfirm}
              disabled={confirmMutation.isPending}
              size="lg"
              className="bg-violet-600 hover:bg-violet-700"
            >
              {confirmMutation.isPending ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4 mr-2" />
              )}
              Conferma {selectedMappings.size} Selezionate
            </Button>
          </div>
        )}

        {confirmedMappings.length > 0 && (
          <div className="mt-6 pt-4 border-t">
            <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              Colonne Confermate ({confirmedMappings.length})
            </h4>
            <div className="flex flex-wrap gap-2">
              {confirmedMappings.map((mapping) => (
                <Badge key={mapping.id} variant="outline" className="bg-green-50 text-green-700 border-green-200">
                  {mapping.physicalColumn} → {mapping.displayName}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {aiSuggestions && (
          <div className="mt-4 text-xs text-gray-400 text-right">
            Analisi completata in {aiSuggestions.analysisTime}ms
          </div>
        )}
      </CardContent>
    </Card>
  );
}
