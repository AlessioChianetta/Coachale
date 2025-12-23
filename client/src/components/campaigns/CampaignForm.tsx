import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { WhatsAppPreview } from "./WhatsAppPreview";
import { useQuery } from "@tanstack/react-query";
import { getAuthHeaders } from "@/lib/auth";
import { Loader2, Megaphone, Target, Users, Zap, HandshakeIcon, StoreIcon } from "lucide-react";

const campaignFormSchema = z.object({
  campaignName: z.string().min(3, "Il nome deve contenere almeno 3 caratteri"),
  campaignType: z.enum(["outbound_ads", "inbound_form", "referral", "recovery", "partner", "walk_in"]),
  leadCategory: z.enum(["freddo", "tiepido", "caldo", "recupero", "referral"]).default("freddo"),
  hookText: z.string().min(1, "L'uncino è obbligatorio"),
  idealStateDescription: z.string().min(1, "Lo stato ideale è obbligatorio"),
  implicitDesires: z.string().min(1, "I desideri impliciti sono obbligatori"),
  defaultObiettivi: z.string().min(1, "Gli obiettivi predefiniti sono obbligatori"),
  preferredAgentConfigId: z.string().min(1, "Seleziona un agente WhatsApp"),
  openingTemplateId: z.string().optional(),
  followupGentleTemplateId: z.string().optional(),
  followupValueTemplateId: z.string().optional(),
  followupFinalTemplateId: z.string().optional(),
});

type CampaignFormData = z.infer<typeof campaignFormSchema>;

interface CampaignFormProps {
  initialData?: Partial<CampaignFormData>;
  onSubmit: (data: CampaignFormData) => void;
  isLoading?: boolean;
}

const campaignTypeOptions = [
  { value: "outbound_ads", label: "Pubblicità Esterna", icon: Megaphone },
  { value: "inbound_form", label: "Form Inbound", icon: Target },
  { value: "referral", label: "Referral", icon: Users },
  { value: "recovery", label: "Recupero", icon: Zap },
  { value: "partner", label: "Partner", icon: HandshakeIcon },
  { value: "walk_in", label: "Walk-In", icon: StoreIcon },
];

const leadCategoryOptions = [
  { value: "freddo", label: "Freddo", color: "text-blue-600" },
  { value: "tiepido", label: "Tiepido", color: "text-yellow-600" },
  { value: "caldo", label: "Caldo", color: "text-red-600" },
  { value: "recupero", label: "Recupero", color: "text-purple-600" },
  { value: "referral", label: "Referral", color: "text-green-600" },
];

export function CampaignForm({ initialData, onSubmit, isLoading }: CampaignFormProps) {
  const form = useForm<CampaignFormData>({
    resolver: zodResolver(campaignFormSchema),
    defaultValues: {
      campaignName: initialData?.campaignName || "",
      campaignType: initialData?.campaignType || "outbound_ads",
      leadCategory: initialData?.leadCategory || "freddo",
      hookText: initialData?.hookText || "",
      idealStateDescription: initialData?.idealStateDescription || "",
      implicitDesires: initialData?.implicitDesires || "",
      defaultObiettivi: initialData?.defaultObiettivi || "",
      preferredAgentConfigId: initialData?.preferredAgentConfigId || "",
      openingTemplateId: initialData?.openingTemplateId || "",
      followupGentleTemplateId: initialData?.followupGentleTemplateId || "",
      followupValueTemplateId: initialData?.followupValueTemplateId || "",
      followupFinalTemplateId: initialData?.followupFinalTemplateId || "",
    },
  });

  const handleFormSubmit = (data: CampaignFormData) => {
    // Convert empty strings to undefined for optional template fields
    const cleanedData = {
      ...data,
      openingTemplateId: data.openingTemplateId || undefined,
      followupGentleTemplateId: data.followupGentleTemplateId || undefined,
      followupValueTemplateId: data.followupValueTemplateId || undefined,
      followupFinalTemplateId: data.followupFinalTemplateId || undefined,
    };
    onSubmit(cleanedData);
  };

  const handleInsertDefaults = () => {
    if (selectedAgent) {
      form.setValue("hookText", selectedAgent.defaultUncino || "");
      form.setValue("idealStateDescription", selectedAgent.defaultIdealState || "");
      form.setValue("implicitDesires", selectedAgent.defaultDesideri || "");
      form.setValue("defaultObiettivi", selectedAgent.defaultObiettivi || "");
    }
  };

  const { data: agentsData, isLoading: agentsLoading } = useQuery({
    queryKey: ["/api/whatsapp/config/proactive"],
    queryFn: async () => {
      const response = await fetch("/api/whatsapp/config/proactive", {
        headers: getAuthHeaders(),
      });
      if (!response.ok) {
        if (response.status === 404) return { configs: [] };
        throw new Error("Failed to fetch proactive WhatsApp agents");
      }
      return response.json();
    },
  });

  // Filter only proactive agents
  const agents = (agentsData?.configs || []).filter((agent: any) => agent.agentType === "proactive_setter");

  const watchedValues = form.watch();
  const selectedAgentId = watchedValues.preferredAgentConfigId;
  const selectedAgent = agents.find((a: any) => a.id === selectedAgentId);

  // Fetch template assignments for selected agent
  const { data: assignmentsData, isLoading: templatesLoading } = useQuery({
    queryKey: ["/api/whatsapp/template-assignments", selectedAgentId],
    queryFn: async () => {
      if (!selectedAgentId) return { assignments: [] };
      const response = await fetch(`/api/whatsapp/template-assignments/${selectedAgentId}`, {
        headers: getAuthHeaders(),
      });
      if (!response.ok) {
        if (response.status === 404) return { assignments: [] };
        throw new Error("Failed to fetch template assignments");
      }
      return response.json();
    },
    enabled: !!selectedAgentId,
  });

  const assignedTemplates = assignmentsData?.assignments || [];
  
  // State for selected template preview
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const selectedTemplate = assignedTemplates.find((t: any) => t.templateId === selectedTemplateId);
  
  // Reset selected template when agent changes
  useEffect(() => {
    setSelectedTemplateId(null);
  }, [selectedAgentId]);
  
  // Group templates by category (supports both new useCase values and legacy slot types)
  const detectCategory = (text: string): string => {
    const normalized = text.toLowerCase();
    // Legacy slot types from old 4-slot system
    if (normalized === "opening" || normalized.includes("apertura") || normalized.includes("primo") || normalized.includes("benvenuto")) return "Primo Contatto";
    if (normalized.startsWith("follow_up") || normalized.includes("follow") || normalized.includes("riattiv") || normalized.includes("ripresa")) return "Follow-up";
    // New template categories
    if (normalized.includes("setter") || normalized.includes("proattivo")) return "Setter";
    if (normalized.includes("appuntament") || normalized.includes("booking")) return "Appuntamenti";
    return "Generale";
  };

  const templatesByCategory = assignedTemplates.reduce((acc: Record<string, any[]>, template: any) => {
    const category = detectCategory(template.useCase || template.templateName || "");
    if (!acc[category]) acc[category] = [];
    acc[category].push(template);
    return acc;
  }, {} as Record<string, any[]>);
  
  const categoryColors: Record<string, { bg: string; text: string; border: string }> = {
    "Setter": { bg: "bg-orange-50", text: "text-orange-700", border: "border-orange-200" },
    "Follow-up": { bg: "bg-purple-50", text: "text-purple-700", border: "border-purple-200" },
    "Primo Contatto": { bg: "bg-green-50", text: "text-green-700", border: "border-green-200" },
    "Appuntamenti": { bg: "bg-pink-50", text: "text-pink-700", border: "border-pink-200" },
    "Generale": { bg: "bg-gray-50", text: "text-gray-700", border: "border-gray-200" },
  };

  // Function to replace template variables ${variable} or {{N}} with form values
  const replaceTemplateVariables = (bodyText: string) => {
    if (!bodyText) return "";
    
    const nome_lead = "Mario";
    const nome_consulente = selectedAgent?.consultantDisplayName || selectedAgent?.agentName || "Consulente";
    const nome_azienda = selectedAgent?.businessName || "";
    const uncino = watchedValues.hookText || selectedAgent?.defaultUncino || "";
    const stato_ideale = watchedValues.idealStateDescription || selectedAgent?.defaultIdealState || "";
    const obiettivi = watchedValues.defaultObiettivi || selectedAgent?.defaultObiettivi || "";
    const desideri = watchedValues.implicitDesires || selectedAgent?.defaultDesideri || "";
    
    let preview = bodyText;
    
    // Replace ${variable} format (custom templates)
    preview = preview.replace(/\$\{nome_lead\}/g, nome_lead);
    preview = preview.replace(/\$\{firstName\}/g, nome_lead);
    preview = preview.replace(/\$\{nome_consulente\}/g, nome_consulente);
    preview = preview.replace(/\$\{consultantDisplayName\}/g, nome_consulente);
    preview = preview.replace(/\$\{nome_azienda\}/g, nome_azienda);
    preview = preview.replace(/\$\{businessName\}/g, nome_azienda);
    preview = preview.replace(/\$\{uncino\}/g, uncino);
    preview = preview.replace(/\$\{stato_ideale\}/g, stato_ideale);
    preview = preview.replace(/\$\{idealState\}/g, stato_ideale);
    preview = preview.replace(/\$\{obiettivi\}/g, obiettivi);
    preview = preview.replace(/\$\{desideri\}/g, desideri);
    
    // Also support {{N}} format for backward compatibility
    preview = preview.replace(/\{\{1\}\}/g, nome_lead);
    preview = preview.replace(/\{\{2\}\}/g, nome_consulente);
    preview = preview.replace(/\{\{3\}\}/g, nome_azienda);
    preview = preview.replace(/\{\{4\}\}/g, uncino);
    preview = preview.replace(/\{\{5\}\}/g, stato_ideale);
    preview = preview.replace(/\{\{6\}\}/g, obiettivi);
    preview = preview.replace(/\{\{7\}\}/g, desideri);
    
    return preview;
  };

  const previewVariables = {
    hook: watchedValues.hookText || "",
    idealState: watchedValues.idealStateDescription || "",
    obiettivi: watchedValues.defaultObiettivi || "",
    desideri: watchedValues.implicitDesires || "",
  };

  // Use selected template body or fallback to generated preview
  const getPreviewTemplate = () => {
    if (selectedTemplate) {
      const bodyText = selectedTemplate.body || selectedTemplate.activeVersion?.bodyText;
      if (bodyText) {
        return replaceTemplateVariables(bodyText);
      }
    }
    // Fallback to auto-generated preview
    if (watchedValues.hookText && watchedValues.idealStateDescription) {
      return `Ciao {{leadName}}! 👋\n\nSono {{consultantName}}, ${watchedValues.hookText}.\n\nTi scrivo perché molte persone come te desiderano ${watchedValues.idealStateDescription}.\n\n${watchedValues.defaultObiettivi ? `Obiettivo: ${watchedValues.defaultObiettivi}` : ""}\n\nVuoi che ti racconti di più?`;
    }
    return "Seleziona un template dalla lista sopra o configura i campi del form per vedere un'anteprima...";
  };

  const previewTemplate = getPreviewTemplate();

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Left Column - Campaign Details */}
          <div className="space-y-4">
            <FormField
              control={form.control}
              name="campaignName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome Campagna *</FormLabel>
                  <FormControl>
                    <Input placeholder="Es: Campagna LinkedIn Q1 2025" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="campaignType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo Campagna *</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleziona tipo" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {campaignTypeOptions.map((option) => {
                        const Icon = option.icon;
                        return (
                          <SelectItem key={option.value} value={option.value}>
                            <div className="flex items-center gap-2">
                              <Icon className="h-4 w-4" />
                              <span>{option.label}</span>
                            </div>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="leadCategory"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Categoria Lead *</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleziona categoria" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {leadCategoryOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${option.color}`} />
                            <span>{option.label}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="preferredAgentConfigId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Agente WhatsApp *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleziona agente" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {agentsLoading ? (
                        <SelectItem value="loading" disabled>
                          Caricamento...
                        </SelectItem>
                      ) : (
                        agents.map((agent: any) => (
                          <SelectItem key={agent.id} value={agent.id}>
                            {agent.agentName} - {agent.twilioWhatsappNumber}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    L'agente da utilizzare per i lead di questa campagna
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {selectedAgentId && (selectedAgent?.defaultUncino || selectedAgent?.defaultIdealState || selectedAgent?.defaultDesideri || selectedAgent?.defaultObiettivi) && (
              <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleInsertDefaults}
                  className="w-full"
                >
                  <Zap className="mr-2 h-4 w-4" />
                  Inserisci Valori Predefiniti dall'Agente
                </Button>
                <p className="text-xs text-muted-foreground mt-2">
                  Compila automaticamente i campi sottostanti con i valori predefiniti configurati nell'agente selezionato
                </p>
              </div>
            )}

            <FormField
              control={form.control}
              name="hookText"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Uncino (Hook) *</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Es: ho visto che sei interessato alla crescita personale"
                      className="min-h-[80px]"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Il gancio principale per catturare l'attenzione
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="idealStateDescription"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Stato Ideale *</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Es: la libertà finanziaria"
                      className="min-h-[80px]"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Lo stato ideale che il lead desidera raggiungere
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="implicitDesires"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Desideri Impliciti *</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Es: generare rendita passiva"
                      className="min-h-[80px]"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    I desideri non detti del lead
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="defaultObiettivi"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Obiettivi Predefiniti *</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Es: creare un patrimonio solido"
                      className="min-h-[80px]"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Gli obiettivi tipici dei lead di questa campagna
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {/* Right Column - Templates & Preview */}
          <div className="space-y-4">
            {!selectedAgentId ? (
              <div className="p-4 bg-muted/50 rounded-lg border-2 border-dashed">
                <p className="text-sm text-muted-foreground text-center">
                  Seleziona un agente WhatsApp per vedere i template
                </p>
              </div>
            ) : (
              <div className="p-4 bg-muted/50 rounded-lg space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium">Template WhatsApp Assegnati</h3>
                  {assignedTemplates.length > 0 && (
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">
                      {assignedTemplates.length} template
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  Template configurati per l'agente selezionato, raggruppati per categoria.
                </p>
                {templatesLoading ? (
                  <div className="text-sm text-muted-foreground">Caricamento template...</div>
                ) : assignedTemplates.length === 0 ? (
                  <div className="text-sm text-muted-foreground text-center py-4 border-2 border-dashed rounded-lg">
                    <p className="mb-2">Nessun template assegnato a questo agente</p>
                    <p className="text-xs">Vai in "Template WhatsApp" per assegnare i template all'agente</p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-[500px] overflow-y-auto">
                    {Object.entries(templatesByCategory).map(([category, templates]) => {
                      const colors = categoryColors[category] || categoryColors["Generale"];
                      return (
                        <div key={category} className={`rounded-lg border ${colors.border} ${colors.bg} p-3`}>
                          <div className="flex items-center gap-2 mb-2">
                            <span className={`font-medium text-sm ${colors.text}`}>{category}</span>
                            <span className={`text-xs ${colors.text} opacity-70`}>
                              ({templates.length} template)
                            </span>
                          </div>
                          <div className="space-y-2">
                            {templates.map((template: any) => {
                              const bodyText = template.body || template.activeVersion?.bodyText || "";
                              const previewText = bodyText ? replaceTemplateVariables(bodyText) : null;
                              const isSelected = selectedTemplateId === template.templateId;
                              
                              return (
                                <div 
                                  key={template.templateId || template.assignmentId} 
                                  className={`bg-white rounded-lg p-3 border-2 cursor-pointer transition-all duration-200 ${
                                    isSelected 
                                      ? "border-blue-500 ring-2 ring-blue-200 shadow-md" 
                                      : "border-gray-100 hover:border-blue-300 hover:shadow-sm"
                                  }`}
                                  onClick={() => setSelectedTemplateId(template.templateId)}
                                >
                                  <div className="flex items-center justify-between mb-1">
                                    <div className="text-xs font-semibold text-gray-800">
                                      {template.templateName}
                                    </div>
                                    {isSelected && (
                                      <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                                        Selezionato
                                      </span>
                                    )}
                                  </div>
                                  {template.useCase && (
                                    <div className="text-xs text-gray-500 mb-2">
                                      {template.useCase}
                                    </div>
                                  )}
                                  {previewText ? (
                                    <div className={`rounded-lg p-2 border ${isSelected ? "bg-blue-50 border-blue-200" : "bg-green-50 border-green-100"}`}>
                                      <p className="text-xs text-gray-700 whitespace-pre-wrap line-clamp-3">
                                        {previewText}
                                      </p>
                                    </div>
                                  ) : template.isTwilioTemplate ? (
                                    <div className="bg-blue-50 rounded-lg p-2 border border-blue-100">
                                      <p className="text-xs text-blue-700">
                                        Template Twilio pre-approvato (anteprima disponibile in "Template WhatsApp")
                                      </p>
                                    </div>
                                  ) : (
                                    <div className="bg-gray-50 rounded-lg p-2 border border-gray-100">
                                      <p className="text-xs text-gray-500 italic">
                                        Anteprima non disponibile
                                      </p>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            <div className="space-y-2">
              {selectedTemplate && (
                <div className="flex items-center justify-between px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg">
                  <span className="text-sm text-blue-800">
                    📋 Anteprima: <strong>{selectedTemplate.templateName}</strong>
                  </span>
                  <button 
                    type="button"
                    onClick={() => setSelectedTemplateId(null)}
                    className="text-xs text-blue-600 hover:text-blue-800 underline"
                  >
                    Deseleziona
                  </button>
                </div>
              )}
              <WhatsAppPreview
                templateBody={previewTemplate}
                variables={previewVariables}
                campaignType={watchedValues.campaignType}
                leadCategory={watchedValues.leadCategory}
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button type="submit" disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {initialData ? "Aggiorna Campagna" : "Crea Campagna"}
          </Button>
        </div>
      </form>
    </Form>
  );
}