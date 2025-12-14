import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { getAuthHeaders } from "@/lib/auth";
import Navbar from "@/components/navbar";
import Sidebar from "@/components/sidebar";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, ArrowRight, Save, Loader2, Sparkles, Database, FileCheck, CheckCircle2, Edit, Wand2, AlertTriangle, MessageSquare, Clock, Send, RotateCcw, PartyPopper, UserX, ShoppingCart, Calendar, Check, Info } from "lucide-react";
import { useLocation } from "wouter";
import confetti from "canvas-confetti";
import { ConsultantAIAssistant } from "@/components/ai-assistant/ConsultantAIAssistant";
import TemplateBodyEditor from "@/components/whatsapp/template-creator/TemplateBodyEditor";
import VariableMappingTable from "@/components/whatsapp/template-creator/VariableMappingTable";
import TemplatePreviewPanel from "@/components/whatsapp/template-creator/TemplatePreviewPanel";
import { cn } from "@/lib/utils";

interface CatalogVariable {
  id: string;
  variableKey: string;
  variableName: string;
  description: string;
  sourceType: "lead" | "agent_config" | "consultant" | "computed";
  sourcePath: string;
  dataType: string;
}

interface ScenarioOption {
  id: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  category: string;
  useCase: string;
  hasDropdown?: boolean;
  dropdownOptions?: { value: string; label: string }[];
}

const SCENARIO_OPTIONS: ScenarioOption[] = [
  {
    id: "primo-contatto",
    icon: <Send className="h-6 w-6" />,
    title: "PRIMO CONTATTO",
    description: "Per scrivere a lead nuovi che non hanno mai ricevuto messaggi",
    category: "Opening",
    useCase: "primo-contatto"
  },
  {
    id: "nessuna-risposta",
    icon: <RotateCcw className="h-6 w-6" />,
    title: "NESSUNA RISPOSTA",
    description: "Quando il lead non risponde dopo un certo tempo",
    category: "Follow-up",
    useCase: "follow-up",
    hasDropdown: true,
    dropdownOptions: [
      { value: "24h", label: "Dopo 24 ore" },
      { value: "48h", label: "Dopo 48 ore" },
      { value: "72h", label: "Dopo 72 ore" },
      { value: "7d", label: "Dopo 7 giorni" }
    ]
  },
  {
    id: "trattativa-bloccata",
    icon: <UserX className="h-6 w-6" />,
    title: "TRATTATIVA BLOCCATA",
    description: "Quando il lead ha mostrato interesse ma si è fermato",
    category: "Stalled",
    useCase: "stalled"
  },
  {
    id: "post-vendita",
    icon: <PartyPopper className="h-6 w-6" />,
    title: "POST-VENDITA",
    description: "Per clienti che hanno già acquistato",
    category: "Customer Success",
    useCase: "customer-success"
  },
  {
    id: "lungo-termine",
    icon: <Calendar className="h-6 w-6" />,
    title: "LUNGO TERMINE",
    description: "Per riattivare lead dopo molto tempo",
    category: "Reactivation",
    useCase: "riattivazione",
    hasDropdown: true,
    dropdownOptions: [
      { value: "30d", label: "Dopo 30 giorni" },
      { value: "60d", label: "Dopo 60 giorni" },
      { value: "90d", label: "Dopo 90 giorni" },
      { value: "365d", label: "Dopo 1 anno" }
    ]
  }
];

const WIZARD_STEPS = [
  { id: "scenario", label: "Scenario", description: "Scegli il contesto" },
  { id: "messaggio", label: "Messaggio", description: "Scrivi il contenuto" },
  { id: "conferma", label: "Conferma", description: "Rivedi e salva" }
];

export default function ConsultantWhatsAppCustomTemplates() {
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();

  const templateId = new URLSearchParams(window.location.search).get('id');
  const isEditMode = !!templateId;

  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(isEditMode ? 2 : 1);
  const [selectedScenario, setSelectedScenario] = useState<string>("");
  const [scenarioDropdownValue, setScenarioDropdownValue] = useState<string>("");
  const [templateName, setTemplateName] = useState("");
  const [useCase, setUseCase] = useState("");
  const [description, setDescription] = useState("");
  const [bodyText, setBodyText] = useState("");
  const [aiPrompt, setAiPrompt] = useState("");

  const { data: existingTemplateData, isLoading: loadingTemplate } = useQuery({
    queryKey: ["/api/whatsapp/custom-templates", templateId],
    queryFn: async () => {
      if (!templateId) return null;
      const response = await fetch(`/api/whatsapp/custom-templates/${templateId}`, {
        headers: getAuthHeaders()
      });
      if (!response.ok) {
        throw new Error("Template non trovato");
      }
      return response.json();
    },
    enabled: !!templateId
  });

  useEffect(() => {
    if (existingTemplateData?.data) {
      const template = existingTemplateData.data;
      setTemplateName(template.templateName);
      setUseCase(template.useCase || template.templateType || "");
      setDescription(template.description || "");
      setBodyText(template.activeVersion?.bodyText || template.body || "");
      const matchingScenario = SCENARIO_OPTIONS.find(s => s.useCase === (template.useCase || template.templateType));
      if (matchingScenario) {
        setSelectedScenario(matchingScenario.id);
      }
    }
  }, [existingTemplateData]);

  const { data: catalogData, isLoading: catalogLoading } = useQuery({
    queryKey: ["/api/whatsapp/custom-templates/catalog"],
    queryFn: async () => {
      const response = await fetch("/api/whatsapp/custom-templates/catalog", {
        headers: getAuthHeaders(),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to fetch variable catalog");
      }
      return response.json();
    },
  });

  const catalog: CatalogVariable[] = catalogData?.data || [];

  const { data: templatesListData } = useQuery({
    queryKey: ["/api/whatsapp/custom-templates"],
    queryFn: async () => {
      const response = await fetch("/api/whatsapp/custom-templates", {
        headers: getAuthHeaders(),
      });
      if (!response.ok) return { data: [], count: 0 };
      return response.json();
    },
  });

  const savedTemplates = templatesListData?.data || [];
  const activeTemplates = savedTemplates.filter((t: any) => t.activeVersion !== null);

  const extractVariablesWithPositions = (text: string) => {
    const regex = /\{([a-zA-Z0-9_]+)\}/g;
    const found: Array<{ key: string; index: number }> = [];
    let match;

    while ((match = regex.exec(text)) !== null) {
      const key = match[1];
      if (!found.some((f) => f.key === key)) {
        found.push({ key, index: match.index });
      }
    }

    found.sort((a, b) => a.index - b.index);

    return found.map((item, idx) => {
      const position = idx + 1;
      const catalogVar = catalog.find((v) => v.variableKey === item.key);

      return {
        variableKey: item.key,
        position,
        variableCatalogId: catalogVar?.id,
        isValid: !!catalogVar,
      };
    });
  };

  const createTemplateMutation = useMutation({
    mutationFn: async (data: {
      templateName: string;
      useCase?: string;
      description?: string;
      bodyText: string;
      variables: Array<{ variableKey: string; position: number }>;
    }) => {
      const response = await fetch("/api/whatsapp/custom-templates", {
        method: "POST",
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create template");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/custom-templates"] });
      
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 }
      });
      
      toast({
        title: "✅ Template Creato",
        description: "Il template custom è stato salvato con successo.",
      });
      navigate("/consultant/whatsapp-templates");
    },
    onError: (error: Error) => {
      toast({
        title: "❌ Errore",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateTemplateMutation = useMutation({
    mutationFn: async (data: {
      templateId: string;
      useCase?: string;
      description?: string;
      bodyText: string;
      variables: Array<{ variableKey: string; position: number }>;
    }) => {
      const response = await fetch(`/api/whatsapp/custom-templates/${data.templateId}`, {
        method: "PUT",
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          useCase: data.useCase,
          description: data.description,
          bodyText: data.bodyText,
          variables: data.variables
        }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Errore durante l'aggiornamento del template");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/custom-templates"] });
      
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 }
      });
      
      toast({
        title: "✅ Template Aggiornato",
        description: "Nuova versione del template creata con successo.",
      });
      navigate("/consultant/whatsapp-templates");
    },
    onError: (error: Error) => {
      toast({
        title: "❌ Errore",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  const generateAIMessageMutation = useMutation({
    mutationFn: async (prompt: string) => {
      const response = await fetch("/api/ai/generate-template-message", {
        method: "POST",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ 
          prompt, 
          scenario: useCase,
          variables: catalog.map(v => v.variableKey)
        })
      });
      if (!response.ok) throw new Error("Errore generazione AI");
      return response.json();
    },
    onSuccess: (data) => {
      setBodyText(data.message || data.data?.message || "");
      toast({ title: "✨ Messaggio generato!", description: "Puoi modificarlo come preferisci." });
    },
    onError: (error: Error) => {
      toast({
        title: "❌ Errore Generazione",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  const handleScenarioSelect = (scenarioId: string) => {
    setSelectedScenario(scenarioId);
    const scenario = SCENARIO_OPTIONS.find(s => s.id === scenarioId);
    if (scenario) {
      setUseCase(scenario.useCase);
    }
    setScenarioDropdownValue("");
  };

  const handleNextStep = () => {
    if (currentStep === 1) {
      if (!selectedScenario) {
        toast({
          title: "⚠️ Seleziona uno Scenario",
          description: "Scegli uno scenario per continuare.",
          variant: "destructive",
        });
        return;
      }
      const scenario = SCENARIO_OPTIONS.find(s => s.id === selectedScenario);
      if (scenario?.hasDropdown && !scenarioDropdownValue) {
        toast({
          title: "⚠️ Seleziona il Tempo",
          description: "Specifica il tempo per questo scenario.",
          variant: "destructive",
        });
        return;
      }
      setCurrentStep(2);
    } else if (currentStep === 2) {
      if (!templateName.trim()) {
        toast({
          title: "⚠️ Nome Richiesto",
          description: "Inserisci un nome per il template.",
          variant: "destructive",
        });
        return;
      }
      if (bodyText.trim().length < 10) {
        toast({
          title: "⚠️ Testo Troppo Corto",
          description: "Il testo del template deve contenere almeno 10 caratteri.",
          variant: "destructive",
        });
        return;
      }
      setCurrentStep(3);
    }
  };

  const handlePrevStep = () => {
    if (currentStep === 2 && !isEditMode) {
      setCurrentStep(1);
    } else if (currentStep === 3) {
      setCurrentStep(2);
    }
  };

  const handleStepClick = (stepIndex: number) => {
    const targetStep = (stepIndex + 1) as 1 | 2 | 3;
    if (targetStep < currentStep) {
      if (isEditMode && targetStep === 1) return;
      setCurrentStep(targetStep);
    }
  };

  const handleSave = () => {
    const variableMappings = extractVariablesWithPositions(bodyText);

    if (variableMappings.length === 0) {
      toast({
        title: "⚠️ Nessuna Variabile",
        description: "Il template deve contenere almeno una variabile dal catalogo.",
        variant: "destructive",
      });
      return;
    }

    const invalidVariables = variableMappings.filter((v) => !v.isValid);
    if (invalidVariables.length > 0) {
      toast({
        title: "⚠️ Variabili Invalide",
        description: `Le seguenti variabili non esistono nel catalogo: ${invalidVariables.map((v) => v.variableKey).join(", ")}`,
        variant: "destructive",
      });
      return;
    }

    if (isEditMode) {
      updateTemplateMutation.mutate({
        templateId: templateId!,
        useCase: useCase || undefined,
        description: description || undefined,
        bodyText,
        variables: variableMappings.map(v => ({
          variableKey: v.variableKey,
          position: v.position
        }))
      });
    } else {
      createTemplateMutation.mutate({
        templateName,
        useCase: useCase || undefined,
        description: description || undefined,
        bodyText,
        variables: variableMappings.map((v) => ({
          variableKey: v.variableKey,
          position: v.position,
        })),
      });
    }
  };

  const extractedVariables = useMemo(() => {
    return extractVariablesWithPositions(bodyText);
  }, [bodyText, catalog]);

  const selectedScenarioData = SCENARIO_OPTIONS.find(s => s.id === selectedScenario);

  const renderStepper = () => (
    <div className="w-full mb-6">
      <div className="flex items-center justify-between max-w-2xl mx-auto">
        {WIZARD_STEPS.map((step, index) => {
          const stepNumber = index + 1;
          const isCompleted = stepNumber < currentStep;
          const isCurrent = stepNumber === currentStep;
          const isClickable = stepNumber <= currentStep && !(isEditMode && stepNumber === 1);

          return (
            <div key={step.id} className="flex items-center flex-1 last:flex-none">
              <div className="flex flex-col items-center flex-1">
                <button
                  onClick={() => isClickable && handleStepClick(index)}
                  disabled={!isClickable}
                  className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold transition-all duration-300",
                    isCompleted && "bg-gradient-to-r from-green-500 to-emerald-500 text-white shadow-lg",
                    isCurrent && "bg-gradient-to-r from-blue-600 to-purple-600 text-white ring-4 ring-blue-200 shadow-lg",
                    !isCompleted && !isCurrent && "bg-gray-200 text-gray-500",
                    isClickable && "cursor-pointer hover:scale-110",
                    !isClickable && "cursor-not-allowed opacity-60"
                  )}
                >
                  {isCompleted ? <Check className="h-5 w-5" /> : stepNumber}
                </button>
                <div className="mt-2 text-center">
                  <p className={cn(
                    "text-sm font-semibold uppercase tracking-wide",
                    isCurrent && "text-blue-600",
                    isCompleted && "text-green-600",
                    !isCurrent && !isCompleted && "text-gray-400"
                  )}>
                    STEP {stepNumber}
                  </p>
                  <p className={cn(
                    "text-xs",
                    isCurrent ? "text-gray-700 font-medium" : "text-gray-500"
                  )}>
                    {step.label}
                  </p>
                </div>
              </div>
              {index < WIZARD_STEPS.length - 1 && (
                <div 
                  className={cn(
                    "h-[3px] flex-1 mx-2 transition-colors rounded-full",
                    index < currentStep - 1 ? "bg-gradient-to-r from-green-500 to-emerald-500" : "bg-gray-200"
                  )}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );

  const renderStep1 = () => (
    <div className="animate-in fade-in-50 duration-300">
      <Card className="shadow-xl border-2">
        <CardHeader className="pb-4">
          <CardTitle className="text-2xl flex items-center gap-2">
            <MessageSquare className="h-6 w-6 text-blue-600" />
            Seleziona lo Scenario
          </CardTitle>
          <CardDescription className="text-base">
            Scegli il contesto in cui verrà utilizzato questo template WhatsApp
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {SCENARIO_OPTIONS.map((scenario) => (
              <Card
                key={scenario.id}
                onClick={() => handleScenarioSelect(scenario.id)}
                className={cn(
                  "cursor-pointer transition-all duration-200 hover:shadow-lg hover:scale-[1.02]",
                  selectedScenario === scenario.id
                    ? "border-2 border-blue-500 bg-blue-50 dark:bg-blue-900/20 ring-2 ring-blue-200"
                    : "border hover:border-blue-300"
                )}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className={cn(
                      "p-3 rounded-lg transition-colors",
                      selectedScenario === scenario.id
                        ? "bg-blue-500 text-white"
                        : "bg-gray-100 text-gray-600 dark:bg-gray-800"
                    )}>
                      {scenario.icon}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-bold text-sm">{scenario.title}</h3>
                        {selectedScenario === scenario.id && (
                          <CheckCircle2 className="h-4 w-4 text-blue-500" />
                        )}
                      </div>
                      <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">
                        {scenario.description}
                      </p>
                      <Badge variant="outline" className="text-xs">
                        {scenario.category}
                      </Badge>
                    </div>
                  </div>
                  
                  {scenario.hasDropdown && selectedScenario === scenario.id && (
                    <div className="mt-4 pt-3 border-t" onClick={(e) => e.stopPropagation()}>
                      <Label className="text-xs font-medium text-gray-600 mb-1.5 block">
                        <Clock className="h-3 w-3 inline mr-1" />
                        Specifica il tempo
                      </Label>
                      <Select value={scenarioDropdownValue} onValueChange={setScenarioDropdownValue}>
                        <SelectTrigger className="h-9">
                          <SelectValue placeholder="Seleziona..." />
                        </SelectTrigger>
                        <SelectContent>
                          {scenario.dropdownOptions?.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const renderStep2 = () => (
    <div className="animate-in fade-in-50 duration-300 space-y-6">
      {isEditMode && (
        <Alert className="border-blue-200 bg-blue-50">
          <Edit className="h-4 w-4 text-blue-600" />
          <AlertDescription className="text-blue-800">
            <strong>Modalità Modifica</strong> - Stai modificando un template esistente. 
            {existingTemplateData?.data?.activeVersion && (
              <span className="ml-2">
                Versione attuale: <Badge variant="outline">v{existingTemplateData.data.activeVersion.versionNumber}</Badge>
              </span>
            )}
          </AlertDescription>
        </Alert>
      )}

      <Card className="shadow-xl border-2">
        <CardHeader className="pb-4">
          <CardTitle className="text-xl flex items-center gap-2">
            <FileCheck className="h-5 w-5 text-purple-600" />
            Dettagli Template
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="template-name">
              Nome Template <span className="text-destructive">*</span>
            </Label>
            <Input
              id="template-name"
              placeholder="Es: Messaggio Apertura Lead Nuovi"
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              maxLength={100}
              disabled={isEditMode}
              className={isEditMode ? "bg-gray-100" : ""}
            />
            <p className="text-xs text-muted-foreground">{templateName.length}/100 caratteri</p>
          </div>

          {selectedScenarioData && (
            <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
              <div className="p-2 rounded-lg bg-blue-100 text-blue-600">
                {selectedScenarioData.icon}
              </div>
              <div>
                <p className="text-sm font-medium">{selectedScenarioData.title}</p>
                <Badge variant="outline" className="text-xs">{selectedScenarioData.category}</Badge>
              </div>
              {scenarioDropdownValue && (
                <Badge className="ml-auto">{scenarioDropdownValue}</Badge>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="shadow-xl border-2 border-purple-200 bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-900/10 dark:to-indigo-900/10">
        <CardHeader className="pb-4">
          <CardTitle className="text-xl flex items-center gap-2">
            <Wand2 className="h-5 w-5 text-purple-600" />
            🪄 Configura con AI
          </CardTitle>
          <CardDescription>
            Descrivi cosa vuoi ottenere e lascia che l'AI generi il messaggio per te
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="ai-prompt">Descrivi cosa vuoi ottenere</Label>
            <Textarea
              id="ai-prompt"
              placeholder="Es: Voglio un messaggio amichevole per presentarmi a un nuovo lead, menzionando i nostri servizi principali e invitandolo a una call gratuita..."
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              rows={3}
              className="bg-white dark:bg-gray-900"
            />
          </div>
          <Button
            onClick={() => generateAIMessageMutation.mutate(aiPrompt)}
            disabled={generateAIMessageMutation.isPending || !aiPrompt.trim()}
            className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white shadow-lg"
          >
            {generateAIMessageMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Generazione in corso...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                🚀 Genera con AI
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {catalogLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
        </div>
      ) : (
        <div className={`grid gap-6 ${isMobile ? "grid-cols-1" : "grid-cols-2"}`}>
          <div className="space-y-6">
            <Card className="shadow-lg">
              <CardContent className="p-4 md:p-6">
                <TemplateBodyEditor
                  bodyText={bodyText}
                  onBodyTextChange={setBodyText}
                  catalog={catalog}
                />
              </CardContent>
            </Card>

            <Card className="shadow-lg">
              <CardContent className="p-4 md:p-6">
                <VariableMappingTable bodyText={bodyText} catalog={catalog} />
              </CardContent>
            </Card>
          </div>

          <div className="space-y-4">
            <Card className="shadow-lg border-2 border-green-200">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Database className="h-5 w-5 text-green-600" />
                  Variabili Disponibili
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto">
                  {catalog.map((v) => (
                    <Badge
                      key={v.id}
                      variant="outline"
                      className="cursor-pointer hover:bg-blue-100 transition-colors"
                      onClick={() => {
                        setBodyText(prev => prev + `{${v.variableKey}}`);
                        toast({ title: "Variabile aggiunta!", description: v.variableName });
                      }}
                    >
                      {`{${v.variableKey}}`}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );

  const renderStep3 = () => (
    <div className="animate-in fade-in-50 duration-300 space-y-6">
      <Card className="shadow-xl border-2">
        <CardHeader className="pb-4">
          <CardTitle className="text-2xl flex items-center gap-2">
            <CheckCircle2 className="h-6 w-6 text-green-600" />
            Conferma e Salva
          </CardTitle>
          <CardDescription className="text-base">
            Rivedi il template prima di salvarlo
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="bg-gray-50">
              <CardContent className="p-4">
                <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Nome Template</p>
                <p className="font-semibold">{templateName || "—"}</p>
              </CardContent>
            </Card>
            <Card className="bg-gray-50">
              <CardContent className="p-4">
                <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Scenario</p>
                <p className="font-semibold flex items-center gap-2">
                  {selectedScenarioData?.icon}
                  {selectedScenarioData?.title || "—"}
                </p>
              </CardContent>
            </Card>
            <Card className="bg-gray-50">
              <CardContent className="p-4">
                <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Categoria</p>
                <Badge variant="outline">{selectedScenarioData?.category || "—"}</Badge>
              </CardContent>
            </Card>
          </div>

          <Alert className="border-amber-200 bg-amber-50">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-amber-800">
              <strong>⚠️ Importante:</strong> I template WhatsApp richiedono approvazione da Meta prima dell'uso. 
              Dopo il salvataggio, il template sarà inviato per la revisione.
            </AlertDescription>
          </Alert>

          <Card className="shadow-lg border-2 border-blue-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-blue-600" />
                Preview Messaggio
              </CardTitle>
            </CardHeader>
            <CardContent>
              <TemplatePreviewPanel
                bodyText={bodyText}
                variables={extractedVariables.map(v => ({
                  variableKey: v.variableKey,
                  position: v.position,
                }))}
                catalog={catalog}
              />
            </CardContent>
          </Card>
        </CardContent>
      </Card>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      {isMobile && <Navbar onMenuClick={() => setSidebarOpen(true)} />}
      <div className={`flex ${isMobile ? 'h-[calc(100vh-80px)]' : 'h-screen'}`}>
        <Sidebar
          role="consultant"
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />
        <div className="flex-1 overflow-y-auto">
          <div className="container mx-auto p-4 md:p-6">
            <div className="bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 text-white rounded-lg shadow-lg p-4 mb-6">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate("/consultant/whatsapp-templates")}
                    className="text-white hover:bg-white/20 hover:text-white"
                  >
                    <ArrowLeft className="h-4 w-4 mr-1" />
                    Indietro
                  </Button>
                  <Badge className="bg-white/20 text-white border-white/30">
                    {isEditMode ? "Edit Mode" : "Wizard Mode"}
                  </Badge>
                  {isEditMode && existingTemplateData?.data?.activeVersion && (
                    <Badge variant="outline" className="bg-white/20 text-white border-white/30">
                      <Edit className="h-3 w-3 mr-1" />
                      v{existingTemplateData.data.activeVersion.versionNumber}
                    </Badge>
                  )}
                </div>
                <Sparkles className="h-6 w-6 text-white" />
              </div>
              <h1 className="text-2xl font-bold mb-1">
                {isEditMode ? "Modifica Template" : "Crea Template Custom"}
              </h1>
              <p className="text-blue-100 text-sm">
                Template WhatsApp con variabili personalizzate • Wizard guidato in 3 step
              </p>
            </div>

            {renderStepper()}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4 mb-6">
              <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 border-blue-200 shadow-lg">
                <CardContent className="p-3 md:p-4 flex items-center gap-3">
                  <div className="p-3 rounded-full bg-blue-500 shadow-lg">
                    <Database className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-300">Variabili Disponibili</p>
                    <p className="text-2xl md:text-3xl font-bold text-blue-600">{catalog.length}</p>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 border-purple-200 shadow-lg">
                <CardContent className="p-3 md:p-4 flex items-center gap-3">
                  <div className="p-3 rounded-full bg-purple-500 shadow-lg">
                    <FileCheck className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-300">Templates Salvati</p>
                    <p className="text-2xl md:text-3xl font-bold text-purple-600">{savedTemplates.length}</p>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-900/20 dark:to-emerald-800/20 border-emerald-200 shadow-lg">
                <CardContent className="p-3 md:p-4 flex items-center gap-3">
                  <div className="p-3 rounded-full bg-emerald-500 shadow-lg">
                    <CheckCircle2 className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-300">Templates Attivi</p>
                    <p className="text-2xl md:text-3xl font-bold text-emerald-600">{activeTemplates.length}</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {loadingTemplate ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
              </div>
            ) : (
              <>
                {currentStep === 1 && renderStep1()}
                {currentStep === 2 && renderStep2()}
                {currentStep === 3 && renderStep3()}
              </>
            )}

            <Separator className="my-6" />

            <div className="flex items-center justify-between">
              <div>
                {(currentStep > 1 && !(isEditMode && currentStep === 2)) && (
                  <Button
                    variant="outline"
                    size="lg"
                    onClick={handlePrevStep}
                    className="px-6"
                  >
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Indietro
                  </Button>
                )}
              </div>
              <div className="flex items-center gap-3">
                {currentStep < 3 && (
                  <Button
                    size="lg"
                    onClick={handleNextStep}
                    className="px-6 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-lg"
                  >
                    Avanti
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                )}
                {currentStep === 3 && (
                  <Button
                    size="lg"
                    onClick={handleSave}
                    disabled={createTemplateMutation.isPending || updateTemplateMutation.isPending || catalogLoading}
                    className="px-6 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white shadow-lg hover:scale-105 transition-all"
                  >
                    {(createTemplateMutation.isPending || updateTemplateMutation.isPending) ? (
                      <>
                        <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                        Salvataggio...
                      </>
                    ) : (
                      <>
                        <Save className="h-5 w-5 mr-2" />
                        {isEditMode ? "Salva Nuova Versione" : "Salva Template"}
                      </>
                    )}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
        <ConsultantAIAssistant />
      </div>
    </div>
  );
}
