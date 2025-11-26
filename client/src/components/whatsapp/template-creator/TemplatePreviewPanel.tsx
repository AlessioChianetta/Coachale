import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { getAuthHeaders } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Eye, AlertCircle, CheckCircle2, AlertTriangle, MessageSquare } from "lucide-react";

interface CatalogVariable {
  id: string;
  variableKey: string;
  variableName: string;
  description: string;
  sourceType: "lead" | "agent_config" | "consultant" | "computed";
  sourcePath: string;
  dataType: string;
}

interface ResolvedVariable {
  key: string;
  value: string;
  source: "lead" | "sample" | "default" | "fallback";
  missing: boolean;
  catalogEntry?: {
    variableName: string;
    description: string;
    sourceType: string;
    sourcePath: string;
  };
}

interface VariableWarning {
  variable: string;
  reason: string;
}

interface PreviewResult {
  originalText: string;
  renderedText: string;
  variables: ResolvedVariable[];
  warnings: VariableWarning[];
}

interface TemplatePreviewPanelProps {
  bodyText: string;
  variables: Array<{ variableKey: string; position: number }>;
  catalog: CatalogVariable[];
}

export default function TemplatePreviewPanel({
  bodyText,
  variables,
  catalog,
}: TemplatePreviewPanelProps) {
  const { toast } = useToast();
  const [mode, setMode] = useState<"sample" | "lead" | "agent">("agent");
  const [selectedLeadId, setSelectedLeadId] = useState<string>("");
  const [selectedAgentId, setSelectedAgentId] = useState<string>("");
  const [sampleData, setSampleData] = useState<Record<string, string>>({});
  const [previewResult, setPreviewResult] = useState<PreviewResult | null>(null);

  // Load WhatsApp agents
  const { data: agentsData, isLoading: agentsLoading } = useQuery({
    queryKey: ["/api/whatsapp/config"],
    queryFn: async () => {
      const response = await fetch("/api/whatsapp/config", {
        headers: getAuthHeaders()
      });
      if (!response.ok) return { configs: [] };
      return response.json();
    }
  });
  const agents = agentsData?.configs || [];

  // Load proactive leads for dropdown
  const { data: leadsData, isLoading: leadsLoading } = useQuery({
    queryKey: ["/api/proactive-leads"],
    queryFn: async () => {
      const response = await fetch("/api/proactive-leads", {
        headers: getAuthHeaders(),
      });
      if (!response.ok) {
        throw new Error("Failed to fetch leads");
      }
      return response.json();
    },
    enabled: mode === "lead",
  });

  const leads = leadsData?.data || [];

  // Auto-select first agent when agents load
  if (agents.length > 0 && !selectedAgentId && mode === "agent") {
    setSelectedAgentId(agents[0].id);
  }

  // Preview mutation
  const previewMutation = useMutation({
    mutationFn: async (data: {
      bodyText: string;
      variables: Array<{ variableKey: string; position: number }>;
      mode: "sample" | "lead";
      leadId?: string;
      sampleData?: Record<string, string>;
    }) => {
      const response = await fetch("/api/whatsapp/custom-templates/preview-draft", {
        method: "POST",
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to preview template");
      }

      return response.json();
    },
    onSuccess: (result) => {
      setPreviewResult(result.data);
      toast({
        title: "✅ Preview Generata",
        description: "Il template è stato renderizzato con successo.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "❌ Errore Preview",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handlePreview = () => {
    if (!bodyText || bodyText.trim().length === 0) {
      toast({
        title: "⚠️ Testo Mancante",
        description: "Inserisci il testo del template prima di generare la preview.",
        variant: "destructive",
      });
      return;
    }

    if (mode === "lead" && !selectedLeadId) {
      toast({
        title: "⚠️ Lead Non Selezionato",
        description: "Seleziona un lead per generare la preview.",
        variant: "destructive",
      });
      return;
    }

    previewMutation.mutate({
      bodyText,
      variables,
      mode,
      leadId: mode === "lead" ? selectedLeadId : undefined,
      sampleData: mode === "sample" ? sampleData : undefined,
    });
  };

  // Initialize sample data with default values from catalog
  const initializeSampleData = () => {
    const defaults: Record<string, string> = {};
    variables.forEach((v) => {
      const catalogVar = catalog.find((c) => c.variableKey === v.variableKey);
      if (catalogVar && catalogVar.dataType === "string") {
        // Set default fallback values
        if (v.variableKey === "nome_lead") defaults[v.variableKey] = "Mario";
        else if (v.variableKey === "cognome_lead") defaults[v.variableKey] = "Rossi";
        else if (v.variableKey === "nome_consulente") defaults[v.variableKey] = "Luca";
        else if (v.variableKey === "nome_azienda") defaults[v.variableKey] = "Orbitale";
        else if (v.variableKey === "uncino") defaults[v.variableKey] = "ci siamo conosciuti all'evento";
        else if (v.variableKey === "stato_ideale") defaults[v.variableKey] = "raddoppiare il fatturato";
        else if (v.variableKey === "obiettivi") defaults[v.variableKey] = "crescita aziendale";
        else if (v.variableKey === "desideri") defaults[v.variableKey] = "più tempo libero";
        else defaults[v.variableKey] = catalogVar.variableName;
      }
    });
    setSampleData(defaults);
  };

  const handleSampleDataChange = (key: string, value: string) => {
    setSampleData((prev) => ({ ...prev, [key]: value }));
  };

  const getVariableBadgeVariant = (variable: ResolvedVariable) => {
    if (variable.missing) return "destructive";
    if (variable.source === "fallback" || variable.source === "default") return "secondary";
    return "default";
  };

  const getVariableIcon = (variable: ResolvedVariable) => {
    if (variable.missing) return <AlertCircle className="h-3 w-3" />;
    if (variable.source === "fallback" || variable.source === "default") return <AlertTriangle className="h-3 w-3" />;
    return <CheckCircle2 className="h-3 w-3" />;
  };

  // Resolve template with agent data
  const agentPreview = useMemo(() => {
    if (mode !== "agent" || !selectedAgentId || !bodyText) return null;

    const selectedAgent = agents.find(a => a.id === selectedAgentId);
    if (!selectedAgent) return null;

    // Sample data based on agent configuration
    const sampleData: Record<string, string> = {
      nome_lead: "Mario",
      cognome_lead: "Rossi",
      nome_consulente: selectedAgent.consultantDisplayName || "Consulente",
      nome_azienda: selectedAgent.businessName || "Business",
      business_name: selectedAgent.businessName || "Business",
      obiettivi: selectedAgent.defaultObiettivi || "Obiettivi predefiniti",
      desideri: selectedAgent.defaultDesideri || "Desideri predefiniti",
      uncino: selectedAgent.defaultUncino || "Uncino predefinito",
      stato_ideale: selectedAgent.defaultIdealState || "Stato ideale predefinito",
    };

    // Replace {variable} format
    let resolved = bodyText;
    Object.entries(sampleData).forEach(([key, value]) => {
      resolved = resolved.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
    });

    return {
      agent: selectedAgent,
      sampleData,
      resolvedText: resolved
    };
  }, [mode, selectedAgentId, bodyText, agents]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Preview Template Live</CardTitle>
        <CardDescription>
          Visualizza come apparirà il template con dati di esempio o reali
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Mode Selector */}
        <Tabs value={mode} onValueChange={(v) => setMode(v as "sample" | "lead" | "agent")}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="agent">Dati Agente</TabsTrigger>
            <TabsTrigger value="sample">Dati di Esempio</TabsTrigger>
            <TabsTrigger value="lead">Dati Lead Reali</TabsTrigger>
          </TabsList>

          <TabsContent value="agent" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Seleziona Agente WhatsApp</Label>
              <p className="text-xs text-muted-foreground">
                Visualizza come apparirà il template con i dati configurati nell'agente
              </p>
              {agentsLoading ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : agents.length === 0 ? (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Nessun agente WhatsApp configurato. Crea un agente nella sezione Agenti WhatsApp.
                  </AlertDescription>
                </Alert>
              ) : (
                <>
                  <Select value={selectedAgentId} onValueChange={setSelectedAgentId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleziona un agente" />
                    </SelectTrigger>
                    <SelectContent>
                      {agents.map((agent: any) => (
                        <SelectItem key={agent.id} value={agent.id}>
                          {agent.agentName} ({agent.twilioWhatsappNumber})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {agentPreview && (
                    <div className="space-y-4 mt-4">
                      {/* Agent Data Table */}
                      <div className="border rounded-lg overflow-hidden">
                        <table className="w-full">
                          <thead className="bg-muted/50">
                            <tr>
                              <th className="text-left p-3 text-sm font-semibold">Campo</th>
                              <th className="text-left p-3 text-sm font-semibold">Valore dall'Agente</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y">
                            <tr>
                              <td className="p-3 text-sm font-medium">Nome Agente</td>
                              <td className="p-3 text-sm">{agentPreview.agent.agentName}</td>
                            </tr>
                            <tr>
                              <td className="p-3 text-sm font-medium">Numero WhatsApp</td>
                              <td className="p-3 text-sm font-mono">{agentPreview.agent.twilioWhatsappNumber}</td>
                            </tr>
                            <tr>
                              <td className="p-3 text-sm font-medium">Nome Consulente</td>
                              <td className="p-3 text-sm">{agentPreview.agent.consultantDisplayName || <span className="text-muted-foreground italic">Non configurato</span>}</td>
                            </tr>
                            <tr>
                              <td className="p-3 text-sm font-medium">Nome Business</td>
                              <td className="p-3 text-sm">{agentPreview.agent.businessName || <span className="text-muted-foreground italic">Non configurato</span>}</td>
                            </tr>
                            {agentPreview.agent.defaultObiettivi && (
                              <tr>
                                <td className="p-3 text-sm font-medium">Obiettivi Default</td>
                                <td className="p-3 text-sm max-w-md truncate" title={agentPreview.agent.defaultObiettivi}>
                                  {agentPreview.agent.defaultObiettivi}
                                </td>
                              </tr>
                            )}
                            {agentPreview.agent.defaultDesideri && (
                              <tr>
                                <td className="p-3 text-sm font-medium">Desideri Default</td>
                                <td className="p-3 text-sm max-w-md truncate" title={agentPreview.agent.defaultDesideri}>
                                  {agentPreview.agent.defaultDesideri}
                                </td>
                              </tr>
                            )}
                            {agentPreview.agent.defaultUncino && (
                              <tr>
                                <td className="p-3 text-sm font-medium">Uncino Default</td>
                                <td className="p-3 text-sm max-w-md truncate" title={agentPreview.agent.defaultUncino}>
                                  {agentPreview.agent.defaultUncino}
                                </td>
                              </tr>
                            )}
                            {agentPreview.agent.defaultIdealState && (
                              <tr>
                                <td className="p-3 text-sm font-medium">Stato Ideale Default</td>
                                <td className="p-3 text-sm max-w-md truncate" title={agentPreview.agent.defaultIdealState}>
                                  {agentPreview.agent.defaultIdealState}
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>

                      {/* Preview of resolved template */}
                      <div className="space-y-2">
                        <label className="text-sm font-semibold flex items-center gap-2">
                          <MessageSquare className="h-4 w-4" />
                          Anteprima Messaggio (con dati agente)
                        </label>
                        <div className="bg-gradient-to-br from-slate-50 to-blue-50/30 p-4 rounded-lg border border-slate-200/60">
                          <p className="text-sm whitespace-pre-wrap font-mono leading-relaxed">
                            {agentPreview.resolvedText}
                          </p>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          💡 I valori mostrati provengono dalla configurazione dell'agente selezionato. Quando invii il messaggio, verranno sostituiti con i dati reali del lead.
                        </p>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </TabsContent>

          <TabsContent value="sample" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Inserisci Dati di Esempio</Label>
              <p className="text-xs text-muted-foreground">
                Compila i campi per vedere come verranno sostituiti nel template
              </p>
              {variables.length === 0 ? (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Nessuna variabile rilevata nel template. Aggiungi variabili usando il menu "Inserisci Variabile".
                  </AlertDescription>
                </Alert>
              ) : (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={initializeSampleData}
                    className="mb-2"
                  >
                    Usa Valori Predefiniti
                  </Button>
                  <div className="grid gap-3">
                    {variables.map((v) => {
                      const catalogVar = catalog.find((c) => c.variableKey === v.variableKey);
                      return (
                        <div key={v.variableKey} className="space-y-1">
                          <Label htmlFor={`sample-${v.variableKey}`} className="text-xs">
                            {catalogVar?.variableName || v.variableKey}
                          </Label>
                          <Input
                            id={`sample-${v.variableKey}`}
                            placeholder={`Es: ${catalogVar?.description || v.variableKey}`}
                            value={sampleData[v.variableKey] || ""}
                            onChange={(e) => handleSampleDataChange(v.variableKey, e.target.value)}
                            className="text-sm"
                          />
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          </TabsContent>

          <TabsContent value="lead" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="lead-select" className="text-sm font-medium">
                Seleziona Lead
              </Label>
              <p className="text-xs text-muted-foreground">
                Scegli un lead dal database per testare il template con dati reali
              </p>
              {leadsLoading ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : leads.length === 0 ? (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Nessun lead disponibile. Crea un lead nella sezione "Lead Proattivi" per usare questa funzione.
                  </AlertDescription>
                </Alert>
              ) : (
                <Select value={selectedLeadId} onValueChange={setSelectedLeadId}>
                  <SelectTrigger id="lead-select">
                    <SelectValue placeholder="Seleziona un lead" />
                  </SelectTrigger>
                  <SelectContent>
                    {leads.map((lead: any) => (
                      <SelectItem key={lead.id} value={lead.id}>
                        {lead.firstName} {lead.lastName} ({lead.phoneNumber})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </TabsContent>
        </Tabs>

        {/* Preview Button */}
        <Button
          onClick={handlePreview}
          disabled={previewMutation.isPending}
          className="w-full"
        >
          {previewMutation.isPending ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Generazione Preview...
            </>
          ) : (
            <>
              <Eye className="h-4 w-4 mr-2" />
              Genera Preview
            </>
          )}
        </Button>

        {/* Preview Result */}
        {previewResult && (
          <div className="space-y-4">
            {/* WhatsApp-style message bubble */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Messaggio Renderizzato</Label>
              <div className="bg-[#DCF8C6] text-[#303030] p-4 rounded-lg rounded-tl-none shadow-md max-w-sm">
                <p className="text-sm whitespace-pre-wrap break-words">
                  {previewResult.renderedText}
                </p>
                <p className="text-xs text-right text-gray-500 mt-2">
                  {new Date().toLocaleTimeString("it-IT", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
            </div>

            {/* Variables List */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Variabili Risolte</Label>
              <div className="space-y-2">
                {previewResult.variables.map((variable) => (
                  <div
                    key={variable.key}
                    className="flex items-start gap-2 p-2 border rounded-md bg-muted/30"
                  >
                    <div className="flex-shrink-0 mt-0.5">
                      {getVariableIcon(variable)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-mono font-semibold">
                          {`{${variable.key}}`}
                        </span>
                        <Badge
                          variant={getVariableBadgeVariant(variable)}
                          className="text-xs"
                        >
                          {variable.source}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        Valore: <span className="font-medium">{variable.value}</span>
                      </p>
                      {variable.catalogEntry && (
                        <p className="text-xs text-muted-foreground">
                          {variable.catalogEntry.variableName}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Warnings */}
            {previewResult.warnings.length > 0 && (
              <Alert variant="default" className="border-yellow-500 bg-yellow-50">
                <AlertTriangle className="h-4 w-4 text-yellow-600" />
                <AlertDescription>
                  <strong className="text-yellow-800">Avvisi:</strong>
                  <ul className="mt-2 space-y-1">
                    {previewResult.warnings.map((warning, idx) => (
                      <li key={idx} className="text-sm text-yellow-700">
                        <span className="font-mono font-semibold">{warning.variable}</span>
                        : {warning.reason}
                      </li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
