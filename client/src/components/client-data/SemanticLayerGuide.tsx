import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  BarChart3,
  Tags,
  AlertTriangle,
  Lightbulb,
  ChevronDown,
  ChevronUp,
  CheckCircle,
  XCircle,
  HelpCircle,
  Layers,
  ArrowDown,
  Settings2,
  Cog,
  Target,
} from "lucide-react";

interface LogicalRole {
  role: string;
  description?: string;
  mapped: boolean;
  physicalColumn: string | null;
}

interface Metric {
  name: string;
  displayName: string;
  description: string;
  unit: string;
  available: boolean;
  missingColumns: string[];
  category: string;
}

interface MetricsSummary {
  totalMetrics: number;
  availableMetrics: number;
  unavailableMetrics: number;
  mappedRoles: string[];
}

interface AvailableMetricsResponse {
  success: boolean;
  data: {
    datasetId: number;
    datasetName: string;
    logicalRoles: LogicalRole[];
    metrics: Metric[];
    summary: MetricsSummary;
  };
}

interface SemanticLayerGuideProps {
  datasetId?: number;
}

const ROLE_DESCRIPTIONS: Record<string, string> = {
  product_id: "Identificatore univoco del prodotto",
  product_name: "Nome del prodotto o articolo",
  category: "Categoria merceologica",
  subcategory: "Sottocategoria del prodotto",
  quantity: "Quantità venduta",
  price: "Prezzo di vendita unitario",
  cost: "Costo di acquisto unitario",
  revenue_amount: "Importo totale fatturato",
  discount_amount: "Sconto applicato",
  discount_percent: "Percentuale di sconto",
  document_id: "Numero documento/scontrino",
  transaction_date: "Data della transazione",
  customer_id: "Identificatore cliente",
  customer_name: "Nome del cliente",
  location: "Punto vendita o location",
  operator_id: "Codice operatore/cassiere",
  operator_name: "Nome operatore",
  payment_method: "Metodo di pagamento",
};

const CATEGORY_LABELS: Record<string, { label: string; icon: string }> = {
  data_quality: { label: "Qualità Dati", icon: "🔍" },
  fatturato: { label: "Fatturato", icon: "💰" },
  conteggio: { label: "Conteggi", icon: "🔢" },
  costi_margini: { label: "Costi e Margini", icon: "📊" },
  menu_engineering: { label: "Menu Engineering", icon: "🍽️" },
  medie: { label: "Medie", icon: "📈" },
  sconti: { label: "Sconti", icon: "🏷️" },
  mix_incidenze: { label: "Mix e Incidenze", icon: "📉" },
};

const GENERIC_ROLES = Object.keys(ROLE_DESCRIPTIONS);

export function SemanticLayerGuide({ datasetId }: SemanticLayerGuideProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [rolesOpen, setRolesOpen] = useState(false);
  const [metricsOpen, setMetricsOpen] = useState(false);
  const [qualityOpen, setQualityOpen] = useState(false);

  const { data, isLoading, error } = useQuery<AvailableMetricsResponse>({
    queryKey: ["available-metrics", datasetId],
    queryFn: async () => {
      const response = await apiRequest(
        "GET",
        `/api/client-data/datasets/${datasetId}/available-metrics`
      );
      return response.data;
    },
    enabled: !!datasetId,
  });

  const renderGenericGuide = () => (
    <Card className="border-slate-200 dark:border-slate-700">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Layers className="h-5 w-5 text-cyan-600" />
            Guida Semantic Layer
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {isExpanded ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>
        </div>
      </CardHeader>
      {isExpanded && (
        <CardContent className="pt-0 space-y-4">
          <div className="bg-gradient-to-r from-cyan-50 to-blue-50 dark:from-cyan-900/20 dark:to-blue-900/20 rounded-lg p-4 border border-cyan-100 dark:border-cyan-800">
            <div className="flex items-center gap-2 mb-3">
              <Target className="h-5 w-5 text-cyan-600" />
              <h4 className="font-semibold text-slate-800 dark:text-slate-200">Come Funziona il Mapping (3 livelli di priorità)</h4>
            </div>
            <div className="space-y-3">
              <div className="flex items-start gap-3 bg-white dark:bg-slate-800 rounded-lg p-3 border-l-4 border-emerald-500">
                <div className="flex-shrink-0 w-7 h-7 rounded-full bg-emerald-100 dark:bg-emerald-900 flex items-center justify-center text-emerald-700 dark:text-emerald-300 font-bold text-sm">1</div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <Settings2 className="h-4 w-4 text-emerald-600" />
                    <span className="font-medium text-emerald-700 dark:text-emerald-400">Tue Regole Personalizzate</span>
                    <Badge variant="outline" className="text-xs bg-emerald-50 text-emerald-700 border-emerald-200">Priorità alta</Badge>
                  </div>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">Sinonimi che crei tu per casi specifici del tuo partner</p>
                </div>
              </div>
              
              <div className="flex justify-center">
                <ArrowDown className="h-4 w-4 text-slate-300" />
              </div>
              
              <div className="flex items-start gap-3 bg-white dark:bg-slate-800 rounded-lg p-3 border-l-4 border-blue-500">
                <div className="flex-shrink-0 w-7 h-7 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-blue-700 dark:text-blue-300 font-bold text-sm">2</div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <Cog className="h-4 w-4 text-blue-600" />
                    <span className="font-medium text-blue-700 dark:text-blue-400">Regole Sistema</span>
                    <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">31 predefinite</Badge>
                  </div>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">Sinonimi italiani riconosciuti automaticamente: <span className="font-mono text-xs bg-slate-100 dark:bg-slate-700 px-1 rounded">qta</span>→quantity, <span className="font-mono text-xs bg-slate-100 dark:bg-slate-700 px-1 rounded">reparto</span>→category</p>
                </div>
              </div>
              
              <div className="flex justify-center">
                <ArrowDown className="h-4 w-4 text-slate-300" />
              </div>
              
              <div className="flex items-start gap-3 bg-white dark:bg-slate-800 rounded-lg p-3 border-l-4 border-cyan-500">
                <div className="flex-shrink-0 w-7 h-7 rounded-full bg-cyan-100 dark:bg-cyan-900 flex items-center justify-center text-cyan-700 dark:text-cyan-300 font-bold text-sm">3</div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <Tags className="h-4 w-4 text-cyan-600" />
                    <span className="font-medium text-cyan-700 dark:text-cyan-400">Ruoli Logici Standard</span>
                    <Badge variant="outline" className="text-xs bg-cyan-50 text-cyan-700 border-cyan-200">20 ruoli</Badge>
                  </div>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">I "ruoli" che l'AI usa per le analisi: <span className="font-mono text-xs bg-slate-100 dark:bg-slate-700 px-1 rounded">revenue_amount</span>, <span className="font-mono text-xs bg-slate-100 dark:bg-slate-700 px-1 rounded">quantity</span>, <span className="font-mono text-xs bg-slate-100 dark:bg-slate-700 px-1 rounded">category</span></p>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="border rounded-lg p-4">
              <h4 className="font-medium flex items-center gap-2 mb-3">
                <Tags className="h-4 w-4 text-cyan-600" />
                Ruoli Logici Disponibili
              </h4>
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {GENERIC_ROLES.map((role) => (
                  <TooltipProvider key={role}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="flex items-center gap-2 text-sm text-slate-500 py-1 hover:bg-slate-50 dark:hover:bg-slate-800 px-2 rounded cursor-help">
                          <HelpCircle className="h-3 w-3" />
                          <span className="font-mono">{role}</span>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{ROLE_DESCRIPTIONS[role]}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                ))}
              </div>
            </div>

            <div className="border rounded-lg p-4">
              <h4 className="font-medium flex items-center gap-2 mb-3">
                <Lightbulb className="h-4 w-4 text-amber-500" />
                Come Iniziare
              </h4>
              <ol className="space-y-2 text-sm text-slate-600 dark:text-slate-400 list-decimal list-inside">
                <li>Carica un dataset CSV o Excel</li>
                <li>Conferma il mapping automatico delle colonne</li>
                <li>Visualizza le metriche sbloccate</li>
                <li>Usa la chat AI per analizzare i dati</li>
              </ol>
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );

  if (!datasetId) {
    return renderGenericGuide();
  }

  if (isLoading) {
    return (
      <Card className="border-slate-200 dark:border-slate-700">
        <CardHeader className="pb-3">
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-4 w-full mb-4" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !data?.success) {
    return renderGenericGuide();
  }

  const { logicalRoles, metrics, summary } = data.data;
  const progressPercent = summary.totalMetrics > 0
    ? (summary.availableMetrics / summary.totalMetrics) * 100
    : 0;

  const metricsByCategory = metrics.reduce((acc, metric) => {
    if (!acc[metric.category]) {
      acc[metric.category] = [];
    }
    acc[metric.category].push(metric);
    return acc;
  }, {} as Record<string, Metric[]>);

  const dataQualityMetrics = metricsByCategory["data_quality"] || [];
  const qualityWarnings = dataQualityMetrics.filter(m => !m.available);

  const mappedRolesCount = logicalRoles.filter(r => r.mapped).length;
  const unmappedRoles = logicalRoles.filter(r => !r.mapped);

  const getSuggestions = () => {
    const suggestions: string[] = [];
    
    const hasCost = logicalRoles.find(r => r.role === "cost")?.mapped;
    const hasPrice = logicalRoles.find(r => r.role === "price")?.mapped;
    const hasQuantity = logicalRoles.find(r => r.role === "quantity")?.mapped;
    
    if (!hasCost && hasPrice && hasQuantity) {
      suggestions.push("Mappa una colonna al ruolo 'cost' per sbloccare le metriche di margine e Food Cost");
    }
    
    if (!logicalRoles.find(r => r.role === "category")?.mapped) {
      suggestions.push("Mappa una colonna al ruolo 'category' per abilitare l'analisi per categoria");
    }
    
    if (!logicalRoles.find(r => r.role === "document_id")?.mapped) {
      suggestions.push("Mappa una colonna al ruolo 'document_id' per calcolare lo scontrino medio");
    }
    
    return suggestions;
  };

  const suggestions = getSuggestions();

  return (
    <Card className="border-slate-200 dark:border-slate-700">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Layers className="h-5 w-5 text-cyan-600" />
            Guida Semantic Layer
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {isExpanded ? "Chiudi" : "Espandi"}
            {isExpanded ? (
              <ChevronUp className="h-4 w-4 ml-1" />
            ) : (
              <ChevronDown className="h-4 w-4 ml-1" />
            )}
          </Button>
        </div>
      </CardHeader>

      {isExpanded && (
        <CardContent className="pt-0 space-y-4">
          <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Progresso Metriche</span>
              <span className="text-sm text-slate-600 dark:text-slate-400">
                {summary.availableMetrics}/{summary.totalMetrics} disponibili
              </span>
            </div>
            <Progress value={progressPercent} className="h-2" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Collapsible open={rolesOpen} onOpenChange={setRolesOpen}>
              <div className="border rounded-lg overflow-hidden">
                <CollapsibleTrigger asChild>
                  <button className="w-full p-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                    <div className="flex items-center gap-2">
                      <Tags className="h-4 w-4 text-cyan-600" />
                      <span className="font-medium">Ruoli Logici</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="outline"
                        className={
                          mappedRolesCount === logicalRoles.length
                            ? "bg-emerald-100 text-emerald-700 border-emerald-200"
                            : "bg-amber-100 text-amber-700 border-amber-200"
                        }
                      >
                        {mappedRolesCount}/{logicalRoles.length}
                      </Badge>
                      {rolesOpen ? (
                        <ChevronUp className="h-4 w-4 text-slate-400" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-slate-400" />
                      )}
                    </div>
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="border-t p-3 max-h-64 overflow-y-auto space-y-1">
                    {logicalRoles.map((role) => (
                      <TooltipProvider key={role.role}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div
                              className={`flex items-center gap-2 text-sm py-1.5 px-2 rounded ${
                                role.mapped
                                  ? "text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20"
                                  : "text-slate-400 dark:text-slate-500"
                              }`}
                            >
                              {role.mapped ? (
                                <CheckCircle className="h-3.5 w-3.5 flex-shrink-0" />
                              ) : (
                                <XCircle className="h-3.5 w-3.5 flex-shrink-0" />
                              )}
                              <span className="font-mono text-xs flex-1">
                                {role.role}
                              </span>
                              {role.mapped && role.physicalColumn && (
                                <span className="text-xs text-slate-500 truncate max-w-20">
                                  ← {role.physicalColumn}
                                </span>
                              )}
                            </div>
                          </TooltipTrigger>
                          <TooltipContent side="right">
                            <p className="font-medium mb-1">{role.role}</p>
                            <p className="text-xs text-slate-400">
                              {ROLE_DESCRIPTIONS[role.role] || "Ruolo logico"}
                            </p>
                            {role.mapped && role.physicalColumn && (
                              <p className="text-xs mt-1 text-emerald-400">
                                Mappato da: {role.physicalColumn}
                              </p>
                            )}
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    ))}
                  </div>
                </CollapsibleContent>
              </div>
            </Collapsible>

            <Collapsible open={metricsOpen} onOpenChange={setMetricsOpen}>
              <div className="border rounded-lg overflow-hidden">
                <CollapsibleTrigger asChild>
                  <button className="w-full p-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                    <div className="flex items-center gap-2">
                      <BarChart3 className="h-4 w-4 text-cyan-600" />
                      <span className="font-medium">Metriche</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="outline"
                        className={
                          summary.unavailableMetrics === 0
                            ? "bg-emerald-100 text-emerald-700 border-emerald-200"
                            : "bg-amber-100 text-amber-700 border-amber-200"
                        }
                      >
                        {summary.availableMetrics} attive
                      </Badge>
                      {metricsOpen ? (
                        <ChevronUp className="h-4 w-4 text-slate-400" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-slate-400" />
                      )}
                    </div>
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="border-t p-3 max-h-64 overflow-y-auto space-y-3">
                    {Object.entries(metricsByCategory)
                      .filter(([cat]) => cat !== "data_quality")
                      .map(([category, categoryMetrics]) => (
                        <div key={category}>
                          <div className="text-xs font-medium text-slate-500 mb-1.5 flex items-center gap-1">
                            <span>{CATEGORY_LABELS[category]?.icon || "📊"}</span>
                            <span>{CATEGORY_LABELS[category]?.label || category}</span>
                          </div>
                          <div className="space-y-1">
                            {categoryMetrics.map((metric) => (
                              <TooltipProvider key={metric.name}>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <div
                                      className={`flex items-center gap-2 text-sm py-1 px-2 rounded ${
                                        metric.available
                                          ? "text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20"
                                          : "text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-900/20"
                                      }`}
                                    >
                                      {metric.available ? (
                                        <CheckCircle className="h-3.5 w-3.5 flex-shrink-0" />
                                      ) : (
                                        <XCircle className="h-3.5 w-3.5 flex-shrink-0" />
                                      )}
                                      <span className="text-xs flex-1 truncate">
                                        {metric.displayName}
                                      </span>
                                    </div>
                                  </TooltipTrigger>
                                  <TooltipContent side="right" className="max-w-xs">
                                    <p className="font-medium mb-1">
                                      {metric.displayName}
                                    </p>
                                    <p className="text-xs text-slate-400 mb-2">
                                      {metric.description}
                                    </p>
                                    {!metric.available && metric.missingColumns.length > 0 && (
                                      <p className="text-xs text-red-400">
                                        Manca: {metric.missingColumns.join(", ")}
                                      </p>
                                    )}
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            ))}
                          </div>
                        </div>
                      ))}
                  </div>
                </CollapsibleContent>
              </div>
            </Collapsible>

            <Collapsible open={qualityOpen} onOpenChange={setQualityOpen}>
              <div className="border rounded-lg overflow-hidden">
                <CollapsibleTrigger asChild>
                  <button className="w-full p-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-amber-500" />
                      <span className="font-medium">Qualità Dati</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {qualityWarnings.length === 0 ? (
                        <Badge
                          variant="outline"
                          className="bg-emerald-100 text-emerald-700 border-emerald-200"
                        >
                          Tutto OK
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="bg-amber-100 text-amber-700 border-amber-200"
                        >
                          {qualityWarnings.length} avvisi
                        </Badge>
                      )}
                      {qualityOpen ? (
                        <ChevronUp className="h-4 w-4 text-slate-400" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-slate-400" />
                      )}
                    </div>
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="border-t p-3 max-h-64 overflow-y-auto">
                    {dataQualityMetrics.length === 0 ? (
                      <p className="text-sm text-slate-500 text-center py-4">
                        Nessuna metrica di qualità disponibile
                      </p>
                    ) : (
                      <div className="space-y-1">
                        {dataQualityMetrics.map((metric) => (
                          <TooltipProvider key={metric.name}>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div
                                  className={`flex items-center gap-2 text-sm py-1.5 px-2 rounded ${
                                    metric.available
                                      ? "text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20"
                                      : "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20"
                                  }`}
                                >
                                  {metric.available ? (
                                    <CheckCircle className="h-3.5 w-3.5 flex-shrink-0" />
                                  ) : (
                                    <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
                                  )}
                                  <span className="text-xs flex-1">
                                    {metric.displayName}
                                  </span>
                                </div>
                              </TooltipTrigger>
                              <TooltipContent side="right">
                                <p className="text-xs">{metric.description}</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        ))}
                      </div>
                    )}
                  </div>
                </CollapsibleContent>
              </div>
            </Collapsible>
          </div>

          {suggestions.length > 0 && (
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <Lightbulb className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div className="space-y-2">
                  <p className="font-medium text-amber-800 dark:text-amber-300 text-sm">
                    Suggerimenti per sbloccare più metriche
                  </p>
                  <ul className="space-y-1">
                    {suggestions.map((suggestion, idx) => (
                      <li
                        key={idx}
                        className="text-sm text-amber-700 dark:text-amber-400 flex items-start gap-2"
                      >
                        <span className="text-amber-500">•</span>
                        {suggestion}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
