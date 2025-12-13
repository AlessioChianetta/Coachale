import { useEffect } from "react";
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

  // Fetch Twilio templates
  const { data: twilioTemplatesData, isLoading: templatesLoading } = useQuery({
    queryKey: ["/api/whatsapp/templates"],
    queryFn: async () => {
      const response = await fetch("/api/whatsapp/templates", {
        headers: getAuthHeaders(),
      });
      if (!response.ok) {
        if (response.status === 404) return { templates: [] };
        throw new Error("Failed to fetch templates");
      }
      return response.json();
    },
  });

  const allTwilioTemplates = twilioTemplatesData?.templates || [];
  
  // Get assigned template SIDs from selected agent
  const assignedTemplateSids = {
    opening: selectedAgent?.whatsappTemplates?.openingMessageContentSid,
    followup_gentle: selectedAgent?.whatsappTemplates?.followUpGentleContentSid,
    followup_value: selectedAgent?.whatsappTemplates?.followUpValueContentSid,
    followup_final: selectedAgent?.whatsappTemplates?.followUpFinalContentSid,
  };

  // Find the actual template objects
  const assignedTemplates = {
    opening: allTwilioTemplates.find((t: any) => t.sid === assignedTemplateSids.opening),
    followup_gentle: allTwilioTemplates.find((t: any) => t.sid === assignedTemplateSids.followup_gentle),
    followup_value: allTwilioTemplates.find((t: any) => t.sid === assignedTemplateSids.followup_value),
    followup_final: allTwilioTemplates.find((t: any) => t.sid === assignedTemplateSids.followup_final),
  };

  // Function to replace Twilio template variables {{1}}, {{2}}, etc with form values
  const replaceTwilioVariables = (bodyText: string) => {
    if (!bodyText) return "";
    
    // Map Twilio {{1}}, {{2}} to actual values
    const nome_lead = "Mario";
    const nome_consulente = selectedAgent?.consultantDisplayName || selectedAgent?.agentName || "Consulente";
    const nome_azienda = selectedAgent?.businessName || "Orbitale";
    const uncino = watchedValues.hookText || selectedAgent?.defaultUncino || "ci siamo conosciuti all'evento";
    const stato_ideale = watchedValues.idealStateDescription || selectedAgent?.defaultIdealState || "raddoppiare il fatturato";
    const obiettivi = watchedValues.defaultObiettivi || selectedAgent?.defaultObiettivi || "crescita aziendale";
    const desideri = watchedValues.implicitDesires || selectedAgent?.defaultDesideri || "più tempo libero";
    
    let preview = bodyText;
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

  const previewTemplate =
    watchedValues.hookText && watchedValues.idealStateDescription
      ? `Ciao {{leadName}}! 👋\n\nSono {{consultantName}}, ${watchedValues.hookText}.\n\nTi scrivo perché molte persone come te desiderano ${watchedValues.idealStateDescription}.\n\n${watchedValues.defaultObiettivi ? `Obiettivo: ${watchedValues.defaultObiettivi}` : ""}\n\nVuoi che ti racconti di più?`
      : "Configura i campi del form per vedere un'anteprima del messaggio WhatsApp...";

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
                <h3 className="text-sm font-medium">Template WhatsApp Assegnati</h3>
                <p className="text-xs text-muted-foreground">
                  Questi template sono configurati per l'agente selezionato. Le anteprime si aggiornano in base ai campi compilati.
                </p>
                {templatesLoading ? (
                  <div className="text-sm text-muted-foreground">Caricamento template...</div>
                ) : (
                  <>
                    {/* Template Apertura */}
                    {assignedTemplates.opening && (
                      <div className="space-y-2">
                        <div className="text-xs font-medium text-gray-700">Template Apertura</div>
                        <div className="border-2 border-blue-200 rounded-lg p-3 bg-white">
                          <div className="text-sm font-semibold text-blue-900 mb-2">
                            {assignedTemplates.opening.friendlyName}
                          </div>
                          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                            <div className="flex justify-end mb-2">
                              <div className="max-w-[85%]">
                                <div className="bg-green-100 dark:bg-green-900/30 text-gray-900 dark:text-gray-100 rounded-xl rounded-tr-none p-3 shadow-sm">
                                  <p className="text-sm whitespace-pre-wrap break-words">
                                    {replaceTwilioVariables(assignedTemplates.opening.bodyText)}
                                  </p>
                                  <div className="flex items-center justify-end gap-1 text-xs text-muted-foreground mt-1">
                                    <span>ora</span>
                                    <span className="text-green-600">✓✓</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Template Followup Gentile */}
                    {assignedTemplates.followup_gentle && (
                      <div className="space-y-2">
                        <div className="text-xs font-medium text-gray-700">Template Followup Gentile</div>
                        <div className="border-2 border-green-200 rounded-lg p-3 bg-white">
                          <div className="text-sm font-semibold text-green-900 mb-2">
                            {assignedTemplates.followup_gentle.friendlyName}
                          </div>
                          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                            <div className="flex justify-end mb-2">
                              <div className="max-w-[85%]">
                                <div className="bg-green-100 dark:bg-green-900/30 text-gray-900 dark:text-gray-100 rounded-xl rounded-tr-none p-3 shadow-sm">
                                  <p className="text-sm whitespace-pre-wrap break-words">
                                    {replaceTwilioVariables(assignedTemplates.followup_gentle.bodyText)}
                                  </p>
                                  <div className="flex items-center justify-end gap-1 text-xs text-muted-foreground mt-1">
                                    <span>ora</span>
                                    <span className="text-green-600">✓✓</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Template Followup Valore */}
                    {assignedTemplates.followup_value && (
                      <div className="space-y-2">
                        <div className="text-xs font-medium text-gray-700">Template Followup Valore</div>
                        <div className="border-2 border-purple-200 rounded-lg p-3 bg-white">
                          <div className="text-sm font-semibold text-purple-900 mb-2">
                            {assignedTemplates.followup_value.friendlyName}
                          </div>
                          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                            <div className="flex justify-end mb-2">
                              <div className="max-w-[85%]">
                                <div className="bg-green-100 dark:bg-green-900/30 text-gray-900 dark:text-gray-100 rounded-xl rounded-tr-none p-3 shadow-sm">
                                  <p className="text-sm whitespace-pre-wrap break-words">
                                    {replaceTwilioVariables(assignedTemplates.followup_value.bodyText)}
                                  </p>
                                  <div className="flex items-center justify-end gap-1 text-xs text-muted-foreground mt-1">
                                    <span>ora</span>
                                    <span className="text-green-600">✓✓</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Template Followup Finale */}
                    {assignedTemplates.followup_final && (
                      <div className="space-y-2">
                        <div className="text-xs font-medium text-gray-700">Template Followup Finale</div>
                        <div className="border-2 border-red-200 rounded-lg p-3 bg-white">
                          <div className="text-sm font-semibold text-red-900 mb-2">
                            {assignedTemplates.followup_final.friendlyName}
                          </div>
                          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                            <div className="flex justify-end mb-2">
                              <div className="max-w-[85%]">
                                <div className="bg-green-100 dark:bg-green-900/30 text-gray-900 dark:text-gray-100 rounded-xl rounded-tr-none p-3 shadow-sm">
                                  <p className="text-sm whitespace-pre-wrap break-words">
                                    {replaceTwilioVariables(assignedTemplates.followup_final.bodyText)}
                                  </p>
                                  <div className="flex items-center justify-end gap-1 text-xs text-muted-foreground mt-1">
                                    <span>ora</span>
                                    <span className="text-green-600">✓✓</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {!assignedTemplates.opening && !assignedTemplates.followup_gentle && !assignedTemplates.followup_value && !assignedTemplates.followup_final && (
                      <div className="text-sm text-muted-foreground text-center py-4 border-2 border-dashed rounded-lg">
                        <p className="mb-2">⚠️ Nessun template assegnato a questo agente</p>
                        <p className="text-xs">Vai in "Template WhatsApp" per assegnare i template Twilio all'agente</p>
                      </div>
                    )}
                  </>
                )}
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