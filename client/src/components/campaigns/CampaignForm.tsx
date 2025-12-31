import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { 
  Loader2, Megaphone, Target, Users, Zap, HandshakeIcon, StoreIcon,
  ChevronLeft, ChevronRight, Check, Sparkles, MessageSquare, Settings2, AlertCircle
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";

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
  { value: "outbound_ads", label: "Pubblicità Esterna", icon: Megaphone, description: "Lead da campagne ads" },
  { value: "inbound_form", label: "Form Inbound", icon: Target, description: "Lead da form sul sito" },
  { value: "referral", label: "Referral", icon: Users, description: "Lead da passaparola" },
  { value: "recovery", label: "Recupero", icon: Zap, description: "Lead da ricontattare" },
  { value: "partner", label: "Partner", icon: HandshakeIcon, description: "Lead da partnership" },
  { value: "walk_in", label: "Walk-In", icon: StoreIcon, description: "Lead da punto vendita" },
];

const leadCategoryOptions = [
  { value: "freddo", label: "Freddo", color: "bg-blue-500", description: "Non conosce il brand" },
  { value: "tiepido", label: "Tiepido", color: "bg-yellow-500", description: "Ha mostrato interesse" },
  { value: "caldo", label: "Caldo", color: "bg-red-500", description: "Pronto all'acquisto" },
  { value: "recupero", label: "Recupero", color: "bg-purple-500", description: "Da riattivare" },
  { value: "referral", label: "Referral", color: "bg-green-500", description: "Arriva da referral" },
];

const WIZARD_STEPS = [
  { id: 1, title: "Info Base", icon: Settings2, description: "Nome e tipo campagna" },
  { id: 2, title: "Agente WhatsApp", icon: MessageSquare, description: "Chi contatterà i lead" },
  { id: 3, title: "Personalizzazione", icon: Sparkles, description: "Uncino e messaggi" },
];

export function CampaignForm({ initialData, onSubmit, isLoading }: CampaignFormProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);

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

  const handleFinalSubmit = () => {
    if (currentStep !== WIZARD_STEPS.length) {
      console.warn("Attempted submit before final step");
      return;
    }
    
    const data = form.getValues();
    const cleanedData = {
      ...data,
      openingTemplateId: data.openingTemplateId || undefined,
      followupGentleTemplateId: data.followupGentleTemplateId || undefined,
      followupValueTemplateId: data.followupValueTemplateId || undefined,
      followupFinalTemplateId: data.followupFinalTemplateId || undefined,
    };
    onSubmit(cleanedData);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
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

  const agents = (agentsData?.configs || []).filter((agent: any) => agent.agentType === "proactive_setter");

  const watchedValues = form.watch();
  const selectedAgentId = watchedValues.preferredAgentConfigId;
  const selectedAgent = agents.find((a: any) => a.id === selectedAgentId);

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

  const allAssignedTemplates = assignmentsData?.assignments || [];
  // Filter out Twilio templates (HX prefix) - only show custom templates for campaign selection
  // Twilio templates can't be saved to marketing_campaigns.opening_template_id (FK constraint)
  const assignedTemplates = allAssignedTemplates.filter((t: any) => !t.isTwilioTemplate && !t.templateId?.startsWith('HX'));
  const selectedTemplate = assignedTemplates.find((t: any) => t.templateId === selectedTemplateId);

  useEffect(() => {
    setSelectedTemplateId(null);
    form.setValue("openingTemplateId", "");
    
    // Auto-populate Step 3 fields with agent defaults when agent is selected (if not editing existing campaign)
    if (selectedAgentId && !initialData?.preferredAgentConfigId) {
      const agent = agents.find((a: any) => a.id === selectedAgentId);
      if (agent) {
        // Only set if fields are empty (don't overwrite user input)
        const currentHook = form.getValues("hookText");
        const currentIdeal = form.getValues("idealStateDescription");
        const currentDesires = form.getValues("implicitDesires");
        const currentObiettivi = form.getValues("defaultObiettivi");
        
        if (!currentHook && agent.defaultUncino) form.setValue("hookText", agent.defaultUncino);
        if (!currentIdeal && agent.defaultIdealState) form.setValue("idealStateDescription", agent.defaultIdealState);
        if (!currentDesires && agent.defaultDesideri) form.setValue("implicitDesires", agent.defaultDesideri);
        if (!currentObiettivi && agent.defaultObiettivi) form.setValue("defaultObiettivi", agent.defaultObiettivi);
      }
    }
  }, [selectedAgentId, agents]);

  useEffect(() => {
    form.setValue("openingTemplateId", selectedTemplateId || "");
  }, [selectedTemplateId]);

  useEffect(() => {
    if (initialData?.openingTemplateId && assignedTemplates.length > 0) {
      const exists = assignedTemplates.some((t: any) => t.templateId === initialData.openingTemplateId);
      if (exists) {
        setSelectedTemplateId(initialData.openingTemplateId);
      }
    }
  }, [initialData?.openingTemplateId, assignedTemplates]);

  const handleInsertDefaults = () => {
    if (selectedAgent) {
      form.setValue("hookText", selectedAgent.defaultUncino || "");
      form.setValue("idealStateDescription", selectedAgent.defaultIdealState || "");
      form.setValue("implicitDesires", selectedAgent.defaultDesideri || "");
      form.setValue("defaultObiettivi", selectedAgent.defaultObiettivi || "");
    }
  };

  const detectCategory = (text: string): string => {
    const normalized = text.toLowerCase();
    if (normalized === "opening" || normalized.includes("apertura") || normalized.includes("primo") || normalized.includes("benvenuto")) return "Primo Contatto";
    if (normalized.startsWith("follow_up") || normalized.includes("follow") || normalized.includes("riattiv") || normalized.includes("ripresa")) return "Follow-up";
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

  const getPreviewTemplate = () => {
    if (selectedTemplate) {
      const bodyText = selectedTemplate.body || selectedTemplate.activeVersion?.bodyText;
      if (bodyText) {
        return replaceTemplateVariables(bodyText);
      }
    }
    if (watchedValues.hookText && watchedValues.idealStateDescription) {
      return `Ciao {{leadName}}!\n\nSono {{consultantName}}, ${watchedValues.hookText}.\n\nTi scrivo perché molte persone come te desiderano ${watchedValues.idealStateDescription}.\n\n${watchedValues.defaultObiettivi ? `Obiettivo: ${watchedValues.defaultObiettivi}` : ""}\n\nVuoi che ti racconti di più?`;
    }
    return "Compila i campi a sinistra per vedere l'anteprima del messaggio WhatsApp...";
  };

  const previewTemplate = getPreviewTemplate();

  const canProceed = () => {
    switch (currentStep) {
      case 1:
        return watchedValues.campaignName?.length >= 3 && watchedValues.campaignType && watchedValues.leadCategory;
      case 2:
        // Template is optional if no custom templates are assigned to the agent
        const hasAgent = !!watchedValues.preferredAgentConfigId;
        const hasTemplate = !!watchedValues.openingTemplateId;
        const noTemplatesAvailable = assignedTemplates.length === 0;
        return hasAgent && (hasTemplate || noTemplatesAvailable);
      case 3:
        return watchedValues.hookText && watchedValues.idealStateDescription && watchedValues.implicitDesires && watchedValues.defaultObiettivi;
      default:
        return false;
    }
  };

  const nextStep = () => {
    if (currentStep < WIZARD_STEPS.length && canProceed()) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  return (
    <Form {...form}>
      <div onKeyDown={handleKeyDown} className="h-full">
        <div className="flex gap-6 h-full">
          {/* Left: Wizard Steps & Form */}
          <div className="flex-1 flex flex-col min-w-0">
            {/* Step Indicator */}
            <div className="flex items-center justify-between mb-6 px-1">
              {WIZARD_STEPS.map((step, index) => {
                const StepIcon = step.icon;
                const isCompleted = currentStep > step.id;
                const isCurrent = currentStep === step.id;
                
                return (
                  <div key={step.id} className="flex items-center flex-1">
                    <button
                      type="button"
                      onClick={() => {
                        // Allow backward navigation or staying on current
                        // Forward navigation only if previous steps are completed
                        if (step.id <= currentStep || isCompleted) {
                          setCurrentStep(step.id);
                        }
                      }}
                      disabled={step.id > currentStep && !isCompleted}
                      className={cn(
                        "flex items-center gap-3 p-3 rounded-xl transition-all w-full",
                        isCurrent && "bg-primary/10 ring-2 ring-primary/30",
                        isCompleted && "bg-green-50 dark:bg-green-950/20 cursor-pointer",
                        !isCurrent && !isCompleted && step.id < currentStep && "hover:bg-muted/50 cursor-pointer",
                        step.id > currentStep && !isCompleted && "opacity-50 cursor-not-allowed"
                      )}
                    >
                      <div className={cn(
                        "flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold transition-colors",
                        isCompleted && "bg-green-500 text-white",
                        isCurrent && "bg-primary text-primary-foreground",
                        !isCurrent && !isCompleted && "bg-muted text-muted-foreground"
                      )}>
                        {isCompleted ? <Check className="h-5 w-5" /> : <StepIcon className="h-5 w-5" />}
                      </div>
                      <div className="text-left min-w-0">
                        <p className={cn(
                          "text-sm font-semibold truncate",
                          isCurrent && "text-primary",
                          isCompleted && "text-green-700 dark:text-green-400"
                        )}>
                          {step.title}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">{step.description}</p>
                      </div>
                    </button>
                    {index < WIZARD_STEPS.length - 1 && (
                      <div className={cn(
                        "h-0.5 w-8 mx-2 shrink-0",
                        isCompleted ? "bg-green-500" : "bg-muted"
                      )} />
                    )}
                  </div>
                );
              })}
            </div>

            {/* Step Content */}
            <Card className="flex-1 overflow-auto">
              <CardContent className="p-6">
                {/* Step 1: Info Base */}
                {currentStep === 1 && (
                  <div className="space-y-6 animate-in fade-in duration-300">
                    <div>
                      <h3 className="text-lg font-semibold mb-1">Informazioni Base</h3>
                      <p className="text-sm text-muted-foreground">Dai un nome alla campagna e definisci il tipo di lead</p>
                    </div>

                    <FormField
                      control={form.control}
                      name="campaignName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Nome Campagna *</FormLabel>
                          <FormControl>
                            <Input 
                              placeholder="Es: Campagna LinkedIn Q1 2025" 
                              className="text-lg h-12"
                              {...field} 
                            />
                          </FormControl>
                          <FormDescription>Un nome descrittivo per identificare questa campagna</FormDescription>
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
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-2">
                            {campaignTypeOptions.map((option) => {
                              const Icon = option.icon;
                              const isSelected = field.value === option.value;
                              return (
                                <button
                                  key={option.value}
                                  type="button"
                                  onClick={() => field.onChange(option.value)}
                                  className={cn(
                                    "flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all",
                                    isSelected 
                                      ? "border-primary bg-primary/5 ring-2 ring-primary/20" 
                                      : "border-muted hover:border-primary/50 hover:bg-muted/50"
                                  )}
                                >
                                  <Icon className={cn("h-6 w-6", isSelected ? "text-primary" : "text-muted-foreground")} />
                                  <span className={cn("text-sm font-medium", isSelected && "text-primary")}>{option.label}</span>
                                  <span className="text-xs text-muted-foreground text-center">{option.description}</span>
                                </button>
                              );
                            })}
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="leadCategory"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Temperatura Lead *</FormLabel>
                          <div className="grid grid-cols-5 gap-2 mt-2">
                            {leadCategoryOptions.map((option) => {
                              const isSelected = field.value === option.value;
                              return (
                                <button
                                  key={option.value}
                                  type="button"
                                  onClick={() => field.onChange(option.value)}
                                  className={cn(
                                    "flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all",
                                    isSelected 
                                      ? "border-primary bg-primary/5" 
                                      : "border-muted hover:border-primary/50"
                                  )}
                                >
                                  <div className={cn("w-4 h-4 rounded-full", option.color)} />
                                  <span className={cn("text-xs font-medium", isSelected && "text-primary")}>{option.label}</span>
                                </button>
                              );
                            })}
                          </div>
                          <FormDescription>Quanto è "caldo" il lead quando arriva</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                )}

                {/* Step 2: Agente WhatsApp */}
                {currentStep === 2 && (
                  <div className="space-y-6 animate-in fade-in duration-300">
                    <div>
                      <h3 className="text-lg font-semibold mb-1">Agente WhatsApp</h3>
                      <p className="text-sm text-muted-foreground">Seleziona l'agente che contatterà i lead di questa campagna</p>
                    </div>

                    <FormField
                      control={form.control}
                      name="preferredAgentConfigId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Agente WhatsApp *</FormLabel>
                          {agentsLoading ? (
                            <div className="flex items-center gap-2 p-4 border rounded-lg">
                              <Loader2 className="h-4 w-4 animate-spin" />
                              <span className="text-sm text-muted-foreground">Caricamento agenti...</span>
                            </div>
                          ) : agents.length === 0 ? (
                            <div className="p-4 border-2 border-dashed rounded-lg text-center">
                              <p className="text-sm text-muted-foreground mb-2">Nessun agente WhatsApp configurato</p>
                              <p className="text-xs text-muted-foreground">Vai in "Agenti WhatsApp" per crearne uno</p>
                            </div>
                          ) : (
                            <div className="grid gap-3">
                              {agents.map((agent: any) => {
                                const isSelected = field.value === agent.id;
                                return (
                                  <button
                                    key={agent.id}
                                    type="button"
                                    onClick={() => field.onChange(agent.id)}
                                    className={cn(
                                      "flex items-center gap-4 p-4 rounded-xl border-2 transition-all text-left",
                                      isSelected 
                                        ? "border-primary bg-primary/5 ring-2 ring-primary/20" 
                                        : "border-muted hover:border-primary/50"
                                    )}
                                  >
                                    <div className={cn(
                                      "flex h-12 w-12 items-center justify-center rounded-full",
                                      isSelected ? "bg-primary text-white" : "bg-muted"
                                    )}>
                                      <MessageSquare className="h-6 w-6" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <p className={cn("font-semibold", isSelected && "text-primary")}>{agent.agentName}</p>
                                      <p className="text-sm text-muted-foreground">{agent.twilioWhatsappNumber}</p>
                                    </div>
                                    {isSelected && (
                                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-white">
                                        <Check className="h-4 w-4" />
                                      </div>
                                    )}
                                  </button>
                                );
                              })}
                            </div>
                          )}
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {selectedAgentId && (selectedAgent?.defaultUncino || selectedAgent?.defaultIdealState || selectedAgent?.defaultObiettivi || selectedAgent?.defaultDesideri) && (
                      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4 space-y-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-500 text-white">
                            <Zap className="h-5 w-5" />
                          </div>
                          <div>
                            <p className="font-medium text-blue-900 dark:text-blue-100">Valori predefiniti dell'agente</p>
                            <p className="text-sm text-blue-700 dark:text-blue-300">Questi valori verranno usati per personalizzare i messaggi AI</p>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {selectedAgent?.defaultObiettivi && (
                            <div className="bg-white/80 dark:bg-gray-800/50 rounded-lg p-3 border border-blue-100 dark:border-blue-800">
                              <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 uppercase tracking-wide block mb-1">Obiettivi</span>
                              <p className="text-sm text-gray-800 dark:text-gray-200 line-clamp-2">{selectedAgent.defaultObiettivi}</p>
                            </div>
                          )}
                          {selectedAgent?.defaultDesideri && (
                            <div className="bg-white/80 dark:bg-gray-800/50 rounded-lg p-3 border border-blue-100 dark:border-blue-800">
                              <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 uppercase tracking-wide block mb-1">Desideri</span>
                              <p className="text-sm text-gray-800 dark:text-gray-200 line-clamp-2">{selectedAgent.defaultDesideri}</p>
                            </div>
                          )}
                          {selectedAgent?.defaultUncino && (
                            <div className="bg-white/80 dark:bg-gray-800/50 rounded-lg p-3 border border-blue-100 dark:border-blue-800">
                              <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 uppercase tracking-wide block mb-1">Uncino (Hook)</span>
                              <p className="text-sm text-gray-800 dark:text-gray-200 line-clamp-2">{selectedAgent.defaultUncino}</p>
                            </div>
                          )}
                          {selectedAgent?.defaultIdealState && (
                            <div className="bg-white/80 dark:bg-gray-800/50 rounded-lg p-3 border border-blue-100 dark:border-blue-800">
                              <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 uppercase tracking-wide block mb-1">Stato Ideale</span>
                              <p className="text-sm text-gray-800 dark:text-gray-200 line-clamp-2">{selectedAgent.defaultIdealState}</p>
                            </div>
                          )}
                        </div>

                        <p className="text-xs text-blue-600 dark:text-blue-400 text-center">
                          Questi valori sono stati auto-compilati nello Step 3. Potrai modificarli se necessario.
                        </p>
                      </div>
                    )}

                    {/* Warning when agent has no default values */}
                    {selectedAgentId && !selectedAgent?.defaultUncino && !selectedAgent?.defaultIdealState && !selectedAgent?.defaultObiettivi && !selectedAgent?.defaultDesideri && (
                      <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4">
                        <div className="flex items-start gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 text-amber-600 shrink-0">
                            <AlertCircle className="h-5 w-5" />
                          </div>
                          <div>
                            <p className="font-medium text-amber-900 dark:text-amber-100">Valori predefiniti mancanti</p>
                            <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                              Questo agente non ha valori predefiniti configurati (obiettivi, desideri, uncino, stato ideale). 
                              Dovrai compilarli manualmente nello Step 3 per poter creare la campagna.
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Template Preview in Step 2 */}
                    {selectedAgentId && assignedTemplates.length === 0 && (
                      <div className="mt-4 p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-xl">
                        <div className="flex items-start gap-3">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-100 text-amber-600 shrink-0">
                            <AlertCircle className="h-4 w-4" />
                          </div>
                          <div>
                            <p className="font-medium text-amber-900 dark:text-amber-100 text-sm">Nessun template custom assegnato</p>
                            <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                              Questo agente non ha template custom assegnati. Puoi continuare senza selezionare un template, 
                              oppure vai in "Template WhatsApp" per crearne e assegnarli all'agente.
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                    {selectedAgentId && assignedTemplates.length > 0 && (
                      <div className="mt-4">
                        <p className="text-sm font-medium mb-3">Template Disponibili ({assignedTemplates.length})</p>
                        <p className="text-xs text-muted-foreground mb-3">Clicca su un template per vedere l'anteprima a destra</p>
                        <div className="grid gap-3 max-h-[350px] overflow-y-auto pr-2">
                          {Object.entries(templatesByCategory).map(([category, templates]) => {
                            const colors = categoryColors[category] || categoryColors["Generale"];
                            return (
                              <div key={category} className={cn("rounded-xl border p-4", colors.border, colors.bg)}>
                                <div className="flex items-center gap-2 mb-3">
                                  <span className={cn("text-sm font-semibold", colors.text)}>{category}</span>
                                  <span className={cn("text-xs px-2 py-0.5 rounded-full", colors.bg, colors.text, "border", colors.border)}>
                                    {(templates as any[]).length}
                                  </span>
                                </div>
                                <div className="space-y-2">
                                  {(templates as any[]).map((template: any) => {
                                    const isSelected = selectedTemplateId === template.templateId;
                                    const bodyText = template.body || template.activeVersion?.bodyText || "";
                                    const previewText = bodyText ? replaceTemplateVariables(bodyText) : null;
                                    
                                    return (
                                      <button
                                        key={template.templateId}
                                        type="button"
                                        onClick={() => setSelectedTemplateId(template.templateId)}
                                        className={cn(
                                          "w-full text-left p-3 rounded-lg transition-all",
                                          isSelected 
                                            ? "bg-white border-2 border-primary shadow-md ring-2 ring-primary/20" 
                                            : "bg-white/80 border border-gray-200 hover:bg-white hover:border-primary/50 hover:shadow-sm"
                                        )}
                                      >
                                        <div className="flex items-center justify-between mb-1">
                                          <span className={cn("text-sm font-medium", isSelected && "text-primary")}>
                                            {template.templateName}
                                          </span>
                                          {isSelected && (
                                            <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                                              Selezionato
                                            </span>
                                          )}
                                        </div>
                                        {previewText && (
                                          <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                                            {previewText.substring(0, 100)}...
                                          </p>
                                        )}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Step 3: Personalizzazione */}
                {currentStep === 3 && (
                  <div className="space-y-5 animate-in fade-in duration-300">
                    <div>
                      <h3 className="text-lg font-semibold mb-1">Personalizzazione Messaggi</h3>
                      <p className="text-sm text-muted-foreground">Configura i valori che verranno usati nei template WhatsApp</p>
                    </div>

                    <FormField
                      control={form.control}
                      name="hookText"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center gap-2">
                            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-orange-100 text-orange-600 text-xs font-bold">1</span>
                            Uncino (Hook) *
                          </FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="Es: ho visto che sei interessato alla crescita personale"
                              className="min-h-[80px] resize-none"
                              {...field}
                            />
                          </FormControl>
                          <FormDescription>Il gancio per catturare l'attenzione del lead</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="idealStateDescription"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center gap-2">
                            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-green-100 text-green-600 text-xs font-bold">2</span>
                            Stato Ideale *
                          </FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="Es: la libertà finanziaria"
                              className="min-h-[80px] resize-none"
                              {...field}
                            />
                          </FormControl>
                          <FormDescription>Lo stato ideale che il lead desidera raggiungere</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="implicitDesires"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center gap-2">
                            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-purple-100 text-purple-600 text-xs font-bold">3</span>
                            Desideri Impliciti *
                          </FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="Es: generare rendita passiva"
                              className="min-h-[80px] resize-none"
                              {...field}
                            />
                          </FormControl>
                          <FormDescription>I desideri non detti del lead</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="defaultObiettivi"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center gap-2">
                            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-blue-600 text-xs font-bold">4</span>
                            Obiettivi *
                          </FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="Es: creare un patrimonio solido"
                              className="min-h-[80px] resize-none"
                              {...field}
                            />
                          </FormControl>
                          <FormDescription>Gli obiettivi tipici dei lead di questa campagna</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Navigation Buttons */}
            <div className="flex items-center justify-between mt-4 pt-4 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={prevStep}
                disabled={currentStep === 1}
                className="gap-2"
              >
                <ChevronLeft className="h-4 w-4" />
                Indietro
              </Button>

              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">
                  Step {currentStep} di {WIZARD_STEPS.length}
                </span>
              </div>

              {currentStep < WIZARD_STEPS.length ? (
                <Button
                  type="button"
                  onClick={nextStep}
                  disabled={!canProceed()}
                  className="gap-2"
                >
                  Avanti
                  <ChevronRight className="h-4 w-4" />
                </Button>
              ) : (
                <Button 
                  type="button" 
                  onClick={handleFinalSubmit}
                  disabled={isLoading || !canProceed()} 
                  className="gap-2"
                >
                  {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                  <Check className="h-4 w-4" />
                  {initialData ? "Aggiorna Campagna" : "Crea Campagna"}
                </Button>
              )}
            </div>
          </div>

          {/* Right: Live Preview (Sticky) */}
          <div className="w-[380px] shrink-0 hidden lg:block">
            <div className="sticky top-0 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Anteprima Live</h3>
                {selectedTemplate && (
                  <button
                    type="button"
                    onClick={() => setSelectedTemplateId(null)}
                    className="text-xs text-primary hover:underline"
                  >
                    Deseleziona template
                  </button>
                )}
              </div>
              
              {selectedTemplate && (
                <div className="flex items-center gap-2 px-3 py-2 bg-primary/10 border border-primary/20 rounded-lg">
                  <MessageSquare className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium text-primary truncate">{selectedTemplate.templateName}</span>
                </div>
              )}

              <WhatsAppPreview
                templateBody={previewTemplate}
                variables={previewVariables}
                campaignType={watchedValues.campaignType}
                leadCategory={watchedValues.leadCategory}
              />

              {/* Variable Status */}
              <Card className="border-dashed">
                <CardContent className="p-4">
                  <p className="text-xs font-medium text-muted-foreground mb-3">Stato Variabili</p>
                  <div className="space-y-2">
                    {[
                      { key: "hook", label: "Uncino", value: watchedValues.hookText },
                      { key: "idealState", label: "Stato Ideale", value: watchedValues.idealStateDescription },
                      { key: "desideri", label: "Desideri", value: watchedValues.implicitDesires },
                      { key: "obiettivi", label: "Obiettivi", value: watchedValues.defaultObiettivi },
                    ].map((item) => (
                      <div key={item.key} className="flex items-center gap-2">
                        <div className={cn(
                          "w-2 h-2 rounded-full",
                          item.value ? "bg-green-500" : "bg-gray-300"
                        )} />
                        <span className="text-xs text-muted-foreground">{item.label}</span>
                        {item.value && (
                          <span className="text-xs text-green-600 ml-auto">Configurato</span>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </Form>
  );
}
