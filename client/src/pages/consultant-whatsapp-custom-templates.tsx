import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { getAuthHeaders } from "@/lib/auth";
import Navbar from "@/components/navbar";
import Sidebar from "@/components/sidebar";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Save, Loader2, Sparkles, Database, FileCheck, CheckCircle2, Edit } from "lucide-react";
import { useLocation } from "wouter";
import confetti from "canvas-confetti";
import { ConsultantAIAssistant } from "@/components/ai-assistant/ConsultantAIAssistant";
import TemplateMetadataForm from "@/components/whatsapp/template-creator/TemplateMetadataForm";
import TemplateBodyEditor from "@/components/whatsapp/template-creator/TemplateBodyEditor";
import VariableMappingTable from "@/components/whatsapp/template-creator/VariableMappingTable";
import TemplatePreviewPanel from "@/components/whatsapp/template-creator/TemplatePreviewPanel";

interface CatalogVariable {
  id: string;
  variableKey: string;
  variableName: string;
  description: string;
  sourceType: "lead" | "agent_config" | "consultant" | "computed";
  sourcePath: string;
  dataType: string;
}

export default function ConsultantWhatsAppCustomTemplates() {
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();

  // Get template ID from URL for edit mode
  const templateId = new URLSearchParams(window.location.search).get('id');
  const isEditMode = !!templateId;

  const [templateName, setTemplateName] = useState("");
  const [templateType, setTemplateType] = useState<"opening" | "followup_gentle" | "followup_value" | "followup_final" | "">("");
  const [description, setDescription] = useState("");
  const [bodyText, setBodyText] = useState("");

  // Fetch existing template for edit mode
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

  // Populate form fields when existing template is loaded
  useEffect(() => {
    if (existingTemplateData?.data) {
      const template = existingTemplateData.data;
      setTemplateName(template.templateName);
      setTemplateType(template.templateType);
      setDescription(template.description || "");
      setBodyText(template.activeVersion?.bodyText || "");
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
      templateType: string;
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
      handleReset();
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

  const handleSave = () => {
    if (!templateName.trim()) {
      toast({
        title: "⚠️ Nome Richiesto",
        description: "Inserisci un nome per il template.",
        variant: "destructive",
      });
      return;
    }

    if (!templateType) {
      toast({
        title: "⚠️ Tipo Richiesto",
        description: "Seleziona il tipo di template.",
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
        templateType,
        description: description || undefined,
        bodyText,
        variables: variableMappings.map((v) => ({
          variableKey: v.variableKey,
          position: v.position,
        })),
      });
    }
  };

  const handleReset = () => {
    if (isEditMode) {
      navigate("/consultant/whatsapp-templates");
    } else {
      setTemplateName("");
      setTemplateType("");
      setDescription("");
      setBodyText("");
    }
  };

  // Extract variables for preview panel
  const extractedVariables = useMemo(() => {
    return extractVariablesWithPositions(bodyText);
  }, [bodyText, catalog]);

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
          {/* Compact Header Section */}
          <div className="bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 text-white rounded-lg shadow-lg p-4 mb-4">
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
                  {isEditMode ? "Edit Mode" : "Creator Mode"}
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
            <h1 className="text-2xl font-bold mb-1">{isEditMode ? "Modifica Template" : "Crea Template Custom"}</h1>
            <p className="text-blue-100 text-sm">
              Template WhatsApp con variabili personalizzate
            </p>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4 mb-6 animate-in fade-in-50 duration-300">
            <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 border-blue-200 shadow-lg hover:shadow-xl transition-all duration-200">
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

            <Card className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 border-purple-200 shadow-lg hover:shadow-xl transition-all duration-200">
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

            <Card className="bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-900/20 dark:to-emerald-800/20 border-emerald-200 shadow-lg hover:shadow-xl transition-all duration-200">
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

          {/* Metadata Form - Full Width with Shadow */}
          <div className="mb-6 animate-in fade-in-50 duration-300">
            <Card className="shadow-lg hover:shadow-xl transition-shadow duration-200">
              <CardContent className="p-4 md:p-6">
                <TemplateMetadataForm
                  templateName={templateName}
                  templateType={templateType}
                  description={description}
                  onTemplateNameChange={setTemplateName}
                  onTemplateTypeChange={setTemplateType}
                  onDescriptionChange={setDescription}
                  disabled={isEditMode}
                />
              </CardContent>
            </Card>
          </div>

          {catalogLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
            </div>
          ) : (
            <>
              {/* 2-Column Layout: Editor + Sticky Preview */}
              <div className={`grid gap-4 md:gap-6 mb-6 ${isMobile ? "grid-cols-1" : "grid-cols-2"}`}>
                {/* Left Column: Editor */}
                <div className="space-y-4 md:space-y-6 animate-in fade-in-50 duration-300">
                  <Card className="shadow-lg hover:shadow-xl transition-shadow duration-200">
                    <CardContent className="p-4 md:p-6">
                      <TemplateBodyEditor
                        bodyText={bodyText}
                        onBodyTextChange={setBodyText}
                        catalog={catalog}
                      />
                    </CardContent>
                  </Card>

                  <Card className="shadow-lg hover:shadow-xl transition-shadow duration-200">
                    <CardContent className="p-4 md:p-6">
                      <VariableMappingTable bodyText={bodyText} catalog={catalog} />
                    </CardContent>
                  </Card>
                </div>

                {/* Right Column: Sticky Preview Panel */}
                <div className={`space-y-4 animate-in fade-in-50 duration-300 ${isMobile ? "" : "sticky top-20 self-start"}`}>
                  <Card className="shadow-lg hover:shadow-xl transition-shadow duration-200 border-2 border-blue-200">
                    <CardContent className="p-4 md:p-6">
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
                </div>
              </div>
            </>
          )}

          <Separator className="mb-6" />

          {/* Action Buttons with Gradient */}
          <div className="flex items-center justify-end gap-3 animate-in fade-in-50 duration-300">
            <Button
              variant="outline"
              size="lg"
              onClick={handleReset}
              disabled={createTemplateMutation.isPending || updateTemplateMutation.isPending}
              className="px-4 py-2.5 hover:bg-gray-100 transition-colors duration-200"
            >
              {isEditMode ? "Annulla" : "Reset"}
            </Button>
            <Button
              size="lg"
              onClick={handleSave}
              disabled={createTemplateMutation.isPending || updateTemplateMutation.isPending || catalogLoading}
              className="px-4 py-2.5 bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 hover:from-blue-700 hover:via-purple-700 hover:to-indigo-700 text-white shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105"
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
          </div>
        </div>
      </div>
      <ConsultantAIAssistant />
    </div>
    </div>
  );
}
