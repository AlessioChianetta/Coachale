import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import { 
  FileText,
  ExternalLink,
  AlertCircle,
  Loader2,
  Save,
  Bot,
  MessageSquare,
  CheckCircle2,
  XCircle,
  Target,
  Sparkles,
  Plus,
  ChevronDown,
  RefreshCw,
  Clock,
  CheckCircle,
  Pause,
  Lock,
  HelpCircle,
  PenSquare,
  Zap,
  Settings,
  ListChecks
} from "lucide-react";
import { NavigationTabs } from "@/components/ui/navigation-tabs";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import Navbar from "@/components/navbar";
import Sidebar from "@/components/sidebar";
import { ConsultantAIAssistant } from "@/components/ai-assistant/ConsultantAIAssistant";
import { getAuthHeaders } from "@/lib/auth";
import { useIsMobile } from "@/hooks/use-mobile";
import { Link } from "wouter";

interface TwilioTemplate {
  sid: string;
  friendlyName: string | null;
  language: string;
  bodyText: string;
  variables: string[];
  agentId: string;
  agentName: string;
  approvalStatus?: string;
}

interface WhatsAppConfig {
  id: string;
  agentName: string;
  twilioAccountSid: string;
  twilioWhatsappNumber: string;
  autoResponseEnabled: boolean;
  isActive: boolean;
  agentType?: "reactive_lead" | "proactive_setter";
  businessName?: string | null;
  consultantDisplayName?: string | null;
  whatsappTemplates?: {
    openingMessageContentSid?: string;
    followUpGentleContentSid?: string;
    followUpValueContentSid?: string;
    followUpFinalContentSid?: string;
  };
  defaultObiettivi?: string | null;
  defaultDesideri?: string | null;
  defaultUncino?: string | null;
  defaultIdealState?: string | null;
}

interface TemplateAssignment {
  configId: string;
  templateType: 'openingMessageContentSid' | 'followUpGentleContentSid' | 'followUpValueContentSid' | 'followUpFinalContentSid';
  templateSid: string;
}

interface CustomTemplate {
  id: string;
  templateName: string;
  useCase?: string | null;
  templateType?: string | null;
  description?: string | null;
  body?: string | null;
  isActive: boolean;
  activeVersion?: {
    id: string;
    versionNumber: number;
    bodyText: string;
    twilioStatus: string;
  } | null;
}

interface TemplateAssignmentData {
  assignmentId: string;
  templateId: string;
  templateName: string;
  useCase: string;
  priority: number;
}

function CustomTemplateAssignmentSection({ configs, configsLoading }: { configs: WhatsAppConfig[]; configsLoading: boolean }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedTemplates, setSelectedTemplates] = useState<Map<string, Set<string>>>(new Map());
  const [initialAssignments, setInitialAssignments] = useState<Map<string, Set<string>>>(new Map());
  const [loadingAssignments, setLoadingAssignments] = useState<Set<string>>(new Set());

  const { data: customTemplatesData, isLoading: customTemplatesLoading } = useQuery({
    queryKey: ["/api/whatsapp/custom-templates"],
    queryFn: async () => {
      const response = await fetch("/api/whatsapp/custom-templates", {
        headers: getAuthHeaders(),
      });
      if (!response.ok) return { data: [], count: 0 };
      return response.json();
    },
  });

  const customTemplates: CustomTemplate[] = customTemplatesData?.data || [];
  const proactiveAgents = configs.filter(c => c.agentType === 'proactive_setter');

  useEffect(() => {
    const loadAssignments = async () => {
      for (const config of proactiveAgents) {
        if (loadingAssignments.has(config.id)) continue;
        
        setLoadingAssignments(prev => new Set([...prev, config.id]));
        try {
          const response = await fetch(`/api/whatsapp/template-assignments/${config.id}`, {
            headers: getAuthHeaders(),
          });
          if (response.ok) {
            const data = await response.json();
            const assignedIds = new Set((data.assignments || []).map((a: TemplateAssignmentData) => a.templateId));
            setSelectedTemplates(prev => new Map(prev).set(config.id, assignedIds));
            setInitialAssignments(prev => new Map(prev).set(config.id, new Set(assignedIds)));
          }
        } catch (error) {
          console.error("Failed to load assignments for", config.id, error);
        } finally {
          setLoadingAssignments(prev => {
            const newSet = new Set(prev);
            newSet.delete(config.id);
            return newSet;
          });
        }
      }
    };

    if (proactiveAgents.length > 0 && customTemplates.length > 0) {
      loadAssignments();
    }
  }, [proactiveAgents.length, customTemplates.length]);

  const bulkAssignMutation = useMutation({
    mutationFn: async ({ agentConfigId, templateIds }: { agentConfigId: string; templateIds: string[] }) => {
      const response = await fetch("/api/whatsapp/template-assignments/bulk", {
        method: "POST",
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ agentConfigId, templateIds }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to save assignments");
      }
      return response.json();
    },
    onSuccess: (_, variables) => {
      const currentSelected = selectedTemplates.get(variables.agentConfigId) || new Set();
      setInitialAssignments(prev => new Map(prev).set(variables.agentConfigId, new Set(currentSelected)));
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/template-assignments"] });
      toast({
        title: "✅ Template Assegnati",
        description: "I template sono stati assegnati correttamente all'agente.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "❌ Errore",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleTemplateToggle = (configId: string, templateId: string, checked: boolean) => {
    setSelectedTemplates(prev => {
      const newMap = new Map(prev);
      const currentSet = new Set(newMap.get(configId) || []);
      if (checked) {
        currentSet.add(templateId);
      } else {
        currentSet.delete(templateId);
      }
      newMap.set(configId, currentSet);
      return newMap;
    });
  };

  const handleSaveAssignments = (configId: string) => {
    const templateIds = Array.from(selectedTemplates.get(configId) || []);
    bulkAssignMutation.mutate({ agentConfigId: configId, templateIds });
  };

  const hasChanges = (configId: string): boolean => {
    const current = selectedTemplates.get(configId) || new Set();
    const initial = initialAssignments.get(configId) || new Set();
    if (current.size !== initial.size) return true;
    for (const id of current) {
      if (!initial.has(id)) return true;
    }
    return false;
  };

  if (configsLoading || customTemplatesLoading) {
    return (
      <Card className="shadow-xl border-0 bg-white/80 backdrop-blur-sm animate-in slide-in-from-bottom-4 duration-700">
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </CardContent>
      </Card>
    );
  }

  if (proactiveAgents.length === 0) {
    return null;
  }

  return (
    <Card className="shadow-xl border-0 bg-white/80 backdrop-blur-sm animate-in slide-in-from-bottom-4 duration-700">
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <CardTitle className="flex items-center gap-3 text-2xl mb-2">
              <div className="p-2 rounded-lg bg-gradient-to-r from-emerald-500 to-blue-500">
                <ListChecks className="h-6 w-6 text-white" />
              </div>
              Assegnazione Template Personalizzati
              <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-200">
                {proactiveAgents.length} agenti
              </Badge>
              <Badge className="bg-purple-100 text-purple-700 hover:bg-purple-200">
                {customTemplates.length} template
              </Badge>
            </CardTitle>
            <CardDescription className="text-base">
              Seleziona i template personalizzati da assegnare a ciascun agente. Puoi assegnare un numero illimitato di template.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {customTemplates.length === 0 ? (
          <Alert className="border-amber-200 bg-amber-50">
            <AlertCircle className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-amber-800">
              Non hai ancora creato template personalizzati. <a href="/consultant/whatsapp/custom-templates" className="underline font-medium hover:text-amber-900">Crea il tuo primo template</a> per poterlo assegnare agli agenti.
            </AlertDescription>
          </Alert>
        ) : (
          <div className="space-y-6">
            {proactiveAgents.map((config) => {
              const isLoading = loadingAssignments.has(config.id);
              const configSelectedTemplates = selectedTemplates.get(config.id) || new Set();
              
              return (
                <div
                  key={config.id}
                  className="border-2 border-gray-200 rounded-xl p-6 bg-gradient-to-br from-white to-gray-50 hover:shadow-xl hover:border-blue-300 transition-all duration-200"
                >
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="font-semibold text-lg text-gray-900 flex items-center gap-2">
                        <Bot className="h-5 w-5 text-blue-600" />
                        {config.agentName}
                        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300">
                          {configSelectedTemplates.size} assegnati
                        </Badge>
                      </h3>
                      <div className="text-xs text-gray-500 mt-1">
                        <span className="inline-flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3 text-green-600" />
                          Agente Proattivo
                        </span>
                        {' • '}
                        <span>{config.twilioWhatsappNumber}</span>
                      </div>
                    </div>
                    {hasChanges(config.id) && (
                      <Button
                        onClick={() => handleSaveAssignments(config.id)}
                        disabled={bulkAssignMutation.isPending}
                        size="sm"
                      >
                        {bulkAssignMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : (
                          <Save className="h-4 w-4 mr-2" />
                        )}
                        Salva Modifiche
                      </Button>
                    )}
                  </div>

                  {isLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
                      <span className="ml-2 text-gray-500">Caricamento assegnazioni...</span>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {customTemplates.map((template) => {
                        const isSelected = configSelectedTemplates.has(template.id);
                        const displayUseCase = template.useCase || template.templateType || "Generale";
                        
                        return (
                          <label
                            key={template.id}
                            className={`flex items-start gap-3 p-4 rounded-lg border-2 cursor-pointer transition-all duration-200 ${
                              isSelected
                                ? "border-blue-400 bg-blue-50 shadow-md"
                                : "border-gray-200 bg-white hover:border-blue-200 hover:bg-gray-50"
                            }`}
                          >
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={(checked) =>
                                handleTemplateToggle(config.id, template.id, checked === true)
                              }
                              className="mt-1"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-gray-900 truncate">
                                {template.templateName}
                              </div>
                              <div className="flex items-center gap-2 mt-1">
                                <Badge variant="outline" className="text-xs bg-purple-50 text-purple-700 border-purple-300">
                                  {displayUseCase}
                                </Badge>
                                {template.activeVersion && (
                                  <Badge
                                    variant="outline"
                                    className={`text-xs ${
                                      template.activeVersion.twilioStatus === "approved"
                                        ? "bg-green-50 text-green-700 border-green-300"
                                        : template.activeVersion.twilioStatus === "pending"
                                        ? "bg-yellow-50 text-yellow-700 border-yellow-300"
                                        : "bg-gray-50 text-gray-600 border-gray-300"
                                    }`}
                                  >
                                    {template.activeVersion.twilioStatus}
                                  </Badge>
                                )}
                              </div>
                              {template.description && (
                                <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                                  {template.description}
                                </p>
                              )}
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function ConsultantWhatsAppTemplatesPage() {
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [pendingChanges, setPendingChanges] = useState<Map<string, WhatsAppConfig['whatsappTemplates']>>(new Map());
  const [pendingDefaults, setPendingDefaults] = useState<Map<string, {
    defaultObiettivi?: string;
    defaultDesideri?: string;
    defaultUncino?: string;
    defaultIdealState?: string;
  }>>(new Map());
  const [isCreatingTemplates, setIsCreatingTemplates] = useState(false);
  const [createResult, setCreateResult] = useState<any>(null);
  const [selectedConfigForPreview, setSelectedConfigForPreview] = useState<string>("");
  const [collapsedAgents, setCollapsedAgents] = useState<Set<string>>(new Set());

  // Fetch WhatsApp templates from Twilio
  const { data: templatesData, isLoading: templatesLoading, error: templatesError } = useQuery({
    queryKey: ["/api/whatsapp/templates"],
    queryFn: async () => {
      const response = await fetch("/api/whatsapp/templates", {
        headers: getAuthHeaders(),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to fetch templates");
      }
      return response.json();
    },
  });

  // Fetch WhatsApp configs (agents)
  const { data: configsData, isLoading: configsLoading } = useQuery({
    queryKey: ["/api/whatsapp/config"],
    queryFn: async () => {
      const response = await fetch("/api/whatsapp/config", {
        headers: getAuthHeaders(),
      });
      if (!response.ok) {
        throw new Error("Failed to fetch WhatsApp configs");
      }
      return response.json();
    },
  });

  const templates: TwilioTemplate[] = templatesData?.templates || [];
  const configs: WhatsAppConfig[] = configsData?.configs || [];

  // Initialize all agents as collapsed when templates are loaded
  React.useEffect(() => {
    if (templates.length > 0 && collapsedAgents.size === 0) {
      const agentIds = [...new Set(templates.map(t => t.agentId || 'unknown'))];
      setCollapsedAgents(new Set(agentIds));
    }
  }, [templates]);
  const twilioConsoleUrl = templatesData?.twilioConsoleUrl || "https://console.twilio.com/us1/develop/sms/content-editor";

  // Update template assignment mutation
  const updateTemplatesMutation = useMutation({
    mutationFn: async ({ configId, whatsappTemplates }: { configId: string; whatsappTemplates: WhatsAppConfig['whatsappTemplates'] }) => {
      const response = await fetch(`/api/whatsapp/config/${configId}/templates`, {
        method: "PATCH",
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ whatsappTemplates }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to update template assignments");
      }

      return response.json();
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/config"] });
      setPendingChanges(prev => {
        const newMap = new Map(prev);
        newMap.delete(variables.configId);
        return newMap;
      });
      toast({
        title: "✅ Template assegnati",
        description: "I template sono stati assegnati correttamente all'agente.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "❌ Errore",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Update default values mutation
  const updateDefaultsMutation = useMutation({
    mutationFn: async ({ configId, defaults }: { 
      configId: string; 
      defaults: {
        defaultObiettivi?: string;
        defaultDesideri?: string;
        defaultUncino?: string;
        defaultIdealState?: string;
      }
    }) => {
      const response = await fetch(`/api/whatsapp/config/${configId}/defaults`, {
        method: "PATCH",
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify(defaults),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to update default values");
      }

      return response.json();
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/config"] });
      setPendingDefaults(prev => {
        const newMap = new Map(prev);
        newMap.delete(variables.configId);
        return newMap;
      });
      toast({
        title: "✅ Default salvati",
        description: "I valori predefiniti sono stati aggiornati con successo.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "❌ Errore",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Refresh approval status mutation
  const refreshApprovalStatusMutation = useMutation({
    mutationFn: async () => {
      const proactiveAgents = configs.filter(c => c.agentType === 'proactive_setter');
      
      if (proactiveAgents.length === 0) {
        throw new Error("Nessun agente proattivo trovato");
      }

      const results = await Promise.all(
        proactiveAgents.map(async (config) => {
          try {
            const response = await fetch(`/api/whatsapp/templates/${config.id}/approval-status`, {
              headers: getAuthHeaders(),
            });

            if (!response.ok) {
              const errorData = await response.json();
              throw new Error(errorData.message || `Errore per agente ${config.agentName}`);
            }

            return await response.json();
          } catch (error) {
            console.error(`Errore nel fetch dello status per ${config.agentName}:`, error);
            return { error: true, agentName: config.agentName };
          }
        })
      );

      return results;
    },
    onSuccess: (results) => {
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/templates"] });
      
      const errors = results.filter(r => r.error);
      if (errors.length > 0) {
        toast({
          title: "⚠️ Aggiornamento parziale",
          description: `Status aggiornato ma con ${errors.length} errore/i. Controlla i log.`,
        });
      } else {
        toast({
          title: "✅ Status aggiornato",
          description: "Lo status di approvazione dei template è stato aggiornato con successo.",
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: "❌ Errore",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleTemplateChange = (configId: string, templateType: string, templateSid: string) => {
    const config = configs.find(c => c.id === configId);
    if (!config) return;

    const currentTemplates = pendingChanges.get(configId) || config.whatsappTemplates || {};
    const newTemplates = {
      ...currentTemplates,
      [templateType]: templateSid === 'none' ? null : templateSid,
    };

    setPendingChanges(prev => new Map(prev).set(configId, newTemplates));
  };

  const handleSaveChanges = (configId: string) => {
    const templates = pendingChanges.get(configId);
    if (!templates) return;

    updateTemplatesMutation.mutate({ configId, whatsappTemplates: templates });
  };

  const hasChanges = (configId: string) => {
    return pendingChanges.has(configId);
  };

  const handleDefaultChange = (configId: string, field: string, value: string) => {
    const config = configs.find(c => c.id === configId);
    if (!config) return;

    const currentDefaults = pendingDefaults.get(configId) || {
      defaultObiettivi: config.defaultObiettivi || '',
      defaultDesideri: config.defaultDesideri || '',
      defaultUncino: config.defaultUncino || '',
      defaultIdealState: config.defaultIdealState || '',
    };

    const newDefaults = {
      ...currentDefaults,
      [field]: value,
    };

    setPendingDefaults(prev => new Map(prev).set(configId, newDefaults));
  };

  const handleSaveDefaults = (configId: string) => {
    const defaults = pendingDefaults.get(configId);
    if (!defaults) return;

    updateDefaultsMutation.mutate({ configId, defaults });
  };

  const hasDefaultChanges = (configId: string) => {
    return pendingDefaults.has(configId);
  };

  const toggleAgentCollapse = (agentId: string) => {
    setCollapsedAgents(prev => {
      const newSet = new Set(prev);
      if (newSet.has(agentId)) {
        newSet.delete(agentId);
      } else {
        newSet.add(agentId);
      }
      return newSet;
    });
  };

  const getDefaultValue = (configId: string, field: string): string => {
    const pending = pendingDefaults.get(configId);
    if (pending && pending[field as keyof typeof pending] !== undefined) {
      return pending[field as keyof typeof pending] || '';
    }

    const config = configs.find(c => c.id === configId);
    const value = config?.[field as keyof WhatsAppConfig];
    return value ? String(value) : '';
  };

  const handleCreateDefaultTemplates = async () => {
    setIsCreatingTemplates(true);
    setCreateResult(null);

    try {
      const response = await fetch("/api/whatsapp/templates/create-defaults", {
        method: "POST",
        headers: getAuthHeaders(),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to create templates");
      }

      setCreateResult(data);
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/templates"] });

      toast({
        title: "✅ Template creati",
        description: `${data.created.length} template creati, ${data.skipped.length} già esistenti. ${data.note}`,
      });
    } catch (error: any) {
      toast({
        title: "❌ Errore",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsCreatingTemplates(false);
    }
  };

  const getTemplateTypeColor = (friendlyName: string | null): string => {
    const name = (friendlyName || '').toLowerCase();
    if (name.includes('opening') || name.includes('apertura')) return 'bg-blue-500';
    if (name.includes('gentle') || name.includes('gentile')) return 'bg-green-500';
    if (name.includes('value') || name.includes('valore')) return 'bg-purple-500';
    if (name.includes('final') || name.includes('finale')) return 'bg-red-500';
    return 'bg-gray-500';
  };

  const getTemplateTypeLabel = (friendlyName: string | null): string => {
    const name = (friendlyName || '').toLowerCase();
    if (name.includes('opening') || name.includes('apertura')) return 'Apertura';
    if (name.includes('gentle') || name.includes('gentile')) return 'Gentile';
    if (name.includes('value') || name.includes('valore')) return 'Valore';
    if (name.includes('final') || name.includes('finale')) return 'Finale';
    return 'Altro';
  };

  const getApprovalStatusColor = (status?: string): string => {
    if (!status) return 'bg-gray-500';
    const s = status.toLowerCase();
    if (s === 'approved') return 'bg-green-600';
    if (s === 'pending' || s === 'received') return 'bg-yellow-500';
    if (s === 'rejected') return 'bg-red-600';
    if (s === 'paused') return 'bg-orange-500';
    if (s === 'disabled') return 'bg-gray-700';
    return 'bg-gray-500';
  };

  const getApprovalStatusIcon = (status?: string) => {
    if (!status) return HelpCircle;
    const s = status.toLowerCase();
    if (s === 'approved') return CheckCircle;
    if (s === 'pending' || s === 'received') return Clock;
    if (s === 'rejected') return XCircle;
    if (s === 'paused') return Pause;
    if (s === 'disabled') return Lock;
    return HelpCircle;
  };

  const getApprovalStatusLabel = (status?: string): string => {
    if (!status) return 'Sconosciuto';
    const s = status.toLowerCase();
    if (s === 'approved') return 'Approvato';
    if (s === 'pending') return 'In Attesa';
    if (s === 'received') return 'Ricevuto';
    if (s === 'rejected') return 'Rifiutato';
    if (s === 'paused') return 'In Pausa';
    if (s === 'disabled') return 'Disabilitato';
    if (s === 'not_submitted') return 'Non Inviato';
    if (s === 'error') return 'Errore';
    return 'Sconosciuto';
  };

  const getAssignedTemplate = (configId: string, templateType: string): string => {
    const pending = pendingChanges.get(configId);
    if (pending && pending[templateType as keyof typeof pending]) {
      return pending[templateType as keyof typeof pending] || '';
    }

    const config = configs.find(c => c.id === configId);
    if (config?.whatsappTemplates && config.whatsappTemplates[templateType as keyof typeof config.whatsappTemplates]) {
      return config.whatsappTemplates[templateType as keyof typeof config.whatsappTemplates] || '';
    }

    return '';
  };

  const renderTemplatePreview = (body: string, agentId?: string) => {
    // Find the selected config for preview
    const previewConfig = agentId 
      ? configs.find(c => c.id === agentId)
      : configs.find(c => c.id === selectedConfigForPreview) || configs.find(c => c.agentType === 'proactive_setter');

    // ⚠️ NOTA: Questa è solo una preview UI. I messaggi REALI usano i dati del lead/setter
    // ✅ I valori mostrati provengono dai default del setter configurato
    
    // Use default values from the selected setter config, or fallback to generic values
    const nome_lead = "Mario"; // Always static for demo
    const nome_consulente = previewConfig?.consultantDisplayName || previewConfig?.agentName || "Luca";
    const nome_azienda = previewConfig?.businessName || "Orbitale";
    const uncino = previewConfig?.defaultUncino || "ci siamo conosciuti all'evento";
    const stato_ideale = previewConfig?.defaultIdealState || "raddoppiare il fatturato";
    const obiettivi = previewConfig?.defaultObiettivi || "crescita aziendale";
    const desideri = previewConfig?.defaultDesideri || "più tempo libero";
    
    // Replace variables {{1}}, {{2}}, etc. with values from setter config
    let preview = body;
    preview = preview.replace(/\{\{1\}\}/g, `<span class="font-semibold text-blue-600">${nome_lead}</span>`);
    preview = preview.replace(/\{\{2\}\}/g, `<span class="font-semibold text-green-600">${nome_consulente}</span>`);
    preview = preview.replace(/\{\{3\}\}/g, `<span class="font-semibold text-purple-600">${nome_azienda}</span>`);
    preview = preview.replace(/\{\{4\}\}/g, `<span class="font-semibold text-orange-600">${uncino}</span>`);
    preview = preview.replace(/\{\{5\}\}/g, `<span class="font-semibold text-pink-600">${stato_ideale}</span>`);
    preview = preview.replace(/\{\{6\}\}/g, `<span class="font-semibold text-amber-600">${obiettivi}</span>`);
    preview = preview.replace(/\{\{7\}\}/g, `<span class="font-semibold text-rose-600">${desideri}</span>`);
    
    return <div className="text-sm" dangerouslySetInnerHTML={{ __html: preview }} />;
  };

  const extractVariables = (body: string): string[] => {
    const matches = body.match(/\{\{\d+\}\}/g) || [];
    return [...new Set(matches)].sort();
  };

  const approvedTemplates = templates.filter((t: any) => 
    t.friendlyName?.toLowerCase().includes('approved') || 
    !t.friendlyName?.toLowerCase().includes('pending')
  );
  const pendingTemplates = templates.filter((t: any) => 
    t.friendlyName?.toLowerCase().includes('pending')
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
          <div className="container mx-auto p-6 max-w-7xl">
          <div className="space-y-8">
            {/* Navigation Tabs */}
            <NavigationTabs
              tabs={[
                { label: "Template Twilio", href: "/consultant/whatsapp-templates", icon: FileText },
                { label: "Template Personalizzati", href: "/consultant/whatsapp/custom-templates/list", icon: PenSquare },
              ]}
            />

            {/* Hero Header with Gradient */}
            <div className="bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 text-white p-8 md:p-12 rounded-2xl shadow-2xl animate-in fade-in-50 duration-500">
              <div className="flex flex-col md:flex-row items-start md:items-center gap-6 mb-6">
                <div className="p-4 rounded-full bg-white/20 backdrop-blur-sm">
                  <MessageSquare className="h-10 w-10 md:h-12 md:w-12 text-white" />
                </div>
                <div className="flex-1">
                  <h1 className="text-4xl md:text-5xl font-bold mb-2">
                    Template WhatsApp
                  </h1>
                  <p className="text-lg md:text-xl text-blue-100">
                    Gestisci i template approvati da Twilio per l'invio automatico
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row gap-3">
                  <Button
                    onClick={handleCreateDefaultTemplates}
                    disabled={isCreatingTemplates || configsLoading}
                    className="bg-white/20 hover:bg-white/30 text-white border border-white/30 backdrop-blur-sm shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105"
                  >
                    {isCreatingTemplates ? (
                      <>
                        <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                        Creazione...
                      </>
                    ) : (
                      <>
                        <Plus className="h-5 w-5 mr-2" />
                        Crea Template
                      </>
                    )}
                  </Button>
                  <Button
                    onClick={() => window.open(twilioConsoleUrl, '_blank')}
                    className="bg-white text-blue-600 hover:bg-blue-50 shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105"
                  >
                    <ExternalLink className="h-5 w-5 mr-2" />
                    Console Twilio
                  </Button>
                </div>
              </div>

              {/* Quick Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 border border-white/20 hover:bg-white/20 transition-all duration-200">
                  <p className="text-sm text-blue-100 mb-1">Template Totali</p>
                  <p className="text-3xl font-bold">{templates.length}</p>
                </div>
                <div className="bg-emerald-500/20 backdrop-blur-sm rounded-lg p-4 border border-emerald-300/30 hover:bg-emerald-500/30 transition-all duration-200">
                  <p className="text-sm text-emerald-100 mb-1">Approvati</p>
                  <p className="text-3xl font-bold">{approvedTemplates.length}</p>
                </div>
                <div className="bg-amber-500/20 backdrop-blur-sm rounded-lg p-4 border border-amber-300/30 hover:bg-amber-500/30 transition-all duration-200">
                  <p className="text-sm text-amber-100 mb-1">In Attesa</p>
                  <p className="text-3xl font-bold">{pendingTemplates.length}</p>
                </div>
                <div className="bg-purple-500/20 backdrop-blur-sm rounded-lg p-4 border border-purple-300/30 hover:bg-purple-500/30 transition-all duration-200">
                  <p className="text-sm text-purple-100 mb-1">Agenti Attivi</p>
                  <p className="text-3xl font-bold">{configs.filter(c => c.agentType === 'proactive_setter').length}</p>
                </div>
              </div>
            </div>

            {/* Automation System Banner */}
            <Card className="bg-gradient-to-r from-amber-50 to-orange-50 border-amber-200 shadow-lg animate-in fade-in-50 duration-500">
              <CardContent className="py-5">
                <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
                  <div className="p-3 rounded-full bg-amber-100">
                    <Zap className="h-6 w-6 text-amber-600" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg text-gray-900 mb-1">
                      Nuovo Sistema Follow-up Automatico
                    </h3>
                    <p className="text-gray-600 text-sm">
                      I template WhatsApp vengono ora utilizzati dal sistema di automazioni per ricontattare 
                      automaticamente i lead che non rispondono. Configura le regole dalla pagina Automazioni.
                    </p>
                  </div>
                  <Button asChild className="bg-amber-600 hover:bg-amber-700 text-white shadow-md">
                    <Link href="/consultant/automations">
                      <Settings className="h-4 w-4 mr-2" />
                      Configura Automazioni
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Error Alert */}
            {templatesError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  {(templatesError as Error).message}
                </AlertDescription>
              </Alert>
            )}

            {/* Loading State */}
            {(templatesLoading || configsLoading) && (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
              </div>
            )}

            {/* No Templates - Improved Empty State */}
            {!templatesLoading && templates.length === 0 && (
              <Card className="shadow-xl border-2 border-dashed border-gray-300 bg-gradient-to-br from-white to-gray-50 animate-in fade-in-50 duration-500">
                <CardContent className="py-16">
                  <div className="text-center max-w-md mx-auto">
                    <div className="mb-6 relative">
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-32 h-32 bg-gradient-to-r from-blue-400 to-purple-400 rounded-full blur-2xl opacity-20"></div>
                      </div>
                      <FileText className="h-20 w-20 text-gray-400 mx-auto relative z-10" />
                    </div>
                    <h3 className="text-2xl font-bold text-gray-900 mb-3">
                      Nessun Template Trovato
                    </h3>
                    <p className="text-gray-600 mb-6 text-lg">
                      Crea i tuoi template WhatsApp nella Console Twilio per iniziare a inviare messaggi automatici ai tuoi clienti.
                    </p>
                    <Button 
                      onClick={() => window.open(twilioConsoleUrl, '_blank')}
                      size="lg"
                      className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105"
                    >
                      <ExternalLink className="h-5 w-5 mr-2" />
                      Vai alla Console Twilio
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Templates List */}
            {!templatesLoading && templates.length > 0 && (
              <Card className="shadow-xl border-0 bg-white/80 backdrop-blur-sm animate-in slide-in-from-bottom-4 duration-500">
                <CardHeader className="pb-4">
                  <CardTitle className="flex items-center gap-3 text-2xl">
                    <div className="p-2 rounded-lg bg-gradient-to-r from-blue-500 to-purple-500">
                      <FileText className="h-6 w-6 text-white" />
                    </div>
                    Template Disponibili
                    <Badge className="ml-auto bg-blue-100 text-blue-700 hover:bg-blue-200">
                      {templates.length} totali
                    </Badge>
                  </CardTitle>
                  <CardDescription className="text-base">
                    Questi sono i template WhatsApp creati nel tuo account Twilio.
                    Lo stato di approvazione è visibile solo nella Console Twilio.
                  </CardDescription>
                  
                  {/* Setter Selector for Preview */}
                  {configs.filter(c => c.agentType === 'proactive_setter').length > 1 && (
                    <div className="mt-4 p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border border-blue-200">
                      <Label className="text-sm font-semibold text-gray-700 mb-2 block">
                        🎨 Anteprima con dati del Setter:
                      </Label>
                      <Select value={selectedConfigForPreview} onValueChange={setSelectedConfigForPreview}>
                        <SelectTrigger className="bg-white">
                          <SelectValue placeholder="Seleziona un setter per la preview..." />
                        </SelectTrigger>
                        <SelectContent>
                          {configs.filter(c => c.agentType === 'proactive_setter').map((config) => (
                            <SelectItem key={config.id} value={config.id}>
                              {config.agentName} - {config.businessName || 'Nessuna azienda'}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground mt-2">
                        ℹ️ La preview usa i valori predefiniti globali del setter. <strong>Quando crei una campagna</strong>, puoi specificare template e valori personalizzati che sovrascriveranno questi predefiniti per quella campagna specifica.
                      </p>
                    </div>
                  )}
                </CardHeader>
                <CardContent>
                  <div className="space-y-8">
                    {/* Raggruppa template per agente */}
                    {(() => {
                      // Raggruppa i template per agentId
                      const templatesByAgent = templates.reduce((acc, template) => {
                        const agentId = template.agentId || 'unknown';
                        if (!acc[agentId]) {
                          acc[agentId] = [];
                        }
                        acc[agentId].push(template);
                        return acc;
                      }, {} as Record<string, typeof templates>);

                      return Object.entries(templatesByAgent).map(([agentId, agentTemplates]) => {
                        const agentName = agentTemplates[0]?.agentName || 'Agente Sconosciuto';
                        const isCollapsed = collapsedAgents.has(agentId);
                        
                        return (
                          <Collapsible
                            key={agentId}
                            open={!isCollapsed}
                            onOpenChange={() => toggleAgentCollapse(agentId)}
                          >
                            <div className="border-2 border-blue-200 rounded-xl p-6 bg-gradient-to-br from-blue-50/50 to-purple-50/30 shadow-lg">
                              {/* Header Agente */}
                              <CollapsibleTrigger asChild>
                                <div className="mb-6 pb-4 border-b border-blue-200 cursor-pointer hover:bg-blue-50/50 -mx-6 px-6 -mt-6 pt-6 rounded-t-xl transition-colors">
                                  <div className="flex items-center gap-3">
                                    <div className="p-2 rounded-lg bg-gradient-to-r from-blue-500 to-purple-500">
                                      <Bot className="h-5 w-5 text-white" />
                                    </div>
                                    <h3 className="text-xl font-bold text-gray-900">{agentName}</h3>
                                    <Badge variant="outline" className="bg-white shadow-sm">
                                      {agentTemplates.length} template{agentTemplates.length !== 1 ? 's' : ''}
                                    </Badge>
                                    <ChevronDown className={`h-5 w-5 text-gray-600 ml-auto transition-transform duration-200 ${isCollapsed ? '-rotate-90' : ''}`} />
                                  </div>
                                </div>
                              </CollapsibleTrigger>

                              {/* Lista Template per questo agente */}
                              <CollapsibleContent>
                                <div className="space-y-4">
                              {agentTemplates.map((template) => (
                                <div
                                  key={template.sid}
                                  className="border-2 border-gray-200 rounded-xl p-5 bg-white hover:border-blue-300 hover:shadow-xl transition-all duration-200 hover:scale-[1.02]"
                                >
                                  <div className="flex items-start justify-between mb-3">
                                    <div className="flex-1">
                                      <div className="flex items-center gap-2 mb-1">
                                        <Badge className={`${getTemplateTypeColor(template.friendlyName)} text-white`}>
                                          {getTemplateTypeLabel(template.friendlyName)}
                                        </Badge>
                                        <span className="font-semibold text-gray-900">
                                          {template.friendlyName}
                                        </span>
                                      </div>
                                      <div className="text-xs text-gray-500 space-y-1">
                                        <div className="flex items-center gap-2 flex-wrap">
                                          <span>SID: <code className="bg-gray-100 px-1 rounded">{template.sid}</code></span>
                                          {template.approvalStatus && (
                                            <TooltipProvider>
                                              <Tooltip>
                                                <TooltipTrigger asChild>
                                                  <div className="inline-flex">
                                                    <Badge 
                                                      className={`${getApprovalStatusColor(template.approvalStatus)} text-white text-xs px-2 py-0.5 flex items-center gap-1 cursor-help`}
                                                    >
                                                      {React.createElement(getApprovalStatusIcon(template.approvalStatus), { className: "h-3 w-3" })}
                                                      {getApprovalStatusLabel(template.approvalStatus)}
                                                    </Badge>
                                                  </div>
                                                </TooltipTrigger>
                                                <TooltipContent>
                                                  <p>Status approvazione Twilio</p>
                                                </TooltipContent>
                                              </Tooltip>
                                            </TooltipProvider>
                                          )}
                                        </div>
                                        <div>Lingua: {template.language}</div>
                                      </div>
                                    </div>
                                  </div>

                                  {/* Template Body */}
                                  <div className="bg-gray-50 rounded-md p-3 mb-3">
                                    <div className="text-xs text-gray-500 mb-1 font-semibold">Testo del template:</div>
                                    <div className="text-sm text-gray-700 whitespace-pre-wrap">
                                      {template.bodyText}
                                    </div>
                                  </div>

                                  {/* Variables */}
                                  {template.variables.length > 0 && (
                                    <div className="mb-3">
                                      <div className="text-xs text-gray-500 mb-1 font-semibold">Variabili:</div>
                                      <div className="flex flex-wrap gap-1">
                                        {template.variables.map((variable) => (
                                          <Badge key={variable} variant="outline" className="text-xs">
                                            {'{{' + variable + '}}'}
                                          </Badge>
                                        ))}
                                      </div>
                                    </div>
                                  )}

                                  {/* Preview */}
                                  <div className="bg-blue-50 rounded-md p-3 border border-blue-200">
                                    <div className="text-xs text-blue-700 mb-1 font-semibold">
                                      Anteprima con dati {selectedConfigForPreview ? 'del setter selezionato' : 'di esempio'}:
                                    </div>
                                    {renderTemplatePreview(template.bodyText, agentId)}
                                  </div>
                                </div>
                              ))}
                                </div>
                              </CollapsibleContent>
                            </div>
                          </Collapsible>
                        );
                      });
                    })()}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Agent Assignment - Custom Templates with Checkbox Selection */}
            <CustomTemplateAssignmentSection configs={configs} configsLoading={configsLoading} />

            {/* Default Values Configuration */}
            {!configsLoading && configs.filter(c => c.agentType === 'proactive_setter').length > 0 && (
              <Card className="shadow-xl border-0 bg-white/80 backdrop-blur-sm animate-in slide-in-from-bottom-4 duration-900">
                <CardHeader className="pb-4">
                  <CardTitle className="flex items-center gap-3 text-2xl">
                    <div className="p-2 rounded-lg bg-gradient-to-r from-purple-500 to-pink-500">
                      <Target className="h-6 w-6 text-white" />
                    </div>
                    Valori Predefiniti per Lead Proattivi
                  </CardTitle>
                  <CardDescription className="text-base">
                    Configura i valori predefiniti che verranno usati quando importi lead senza specificare obiettivi, desideri, uncino o stato ideale.
                    Questi valori riflettono il tuo posizionamento e chi aiuti.
                    <br/>
                    <strong className="text-amber-600">ℹ️ Nota:</strong> I valori qui configurati sono globali per l'agente. Se vuoi personalizzare i valori per campagne specifiche, usa la sezione "Campagne Marketing".
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {/* Warning Alert */}
                  <Alert className="mb-6 border-blue-200 bg-blue-50">
                    <AlertDescription className="text-sm text-blue-900">
                      <div className="space-y-2">
                        <p className="font-semibold">📌 Come funzionano i Valori Predefiniti nei Template WhatsApp:</p>
                        <ul className="list-disc list-inside space-y-1 ml-2">
                          <li>
                            Questi valori popolano le <strong>variabili dei template</strong> assegnati nella sezione "Assegnazione Template agli Agenti" qui sopra
                          </li>
                          <li>
                            Ad esempio: <code className="bg-blue-100 px-1 rounded">{"{{4}}"}</code> = Uncino Predefinito, <code className="bg-blue-100 px-1 rounded">{"{{5}}"}</code> = Stato Ideale Predefinito
                          </li>
                          <li>
                            <strong className="text-red-600">⚠️ IMPORTANTE:</strong> Se non hai assegnato un template nella sezione qui sopra, il sistema <strong>bloccherà l'invio</strong> e mostrerà un errore nei log. Non verranno più inviati messaggi predefiniti nascosti.
                          </li>
                        </ul>
                      </div>
                    </AlertDescription>
                  </Alert>
                  <div className="space-y-6">
                    {configs.filter(c => c.agentType === 'proactive_setter').map((config) => (
                      <div
                        key={config.id}
                        className="border-2 border-purple-200 rounded-xl p-6 bg-gradient-to-br from-purple-50/50 to-pink-50/30 hover:shadow-xl hover:border-purple-300 transition-all duration-200"
                      >
                        <div className="flex items-center justify-between mb-4">
                          <div>
                            <h3 className="font-semibold text-lg text-gray-900 flex items-center gap-2">
                              <Bot className="h-5 w-5 text-purple-600" />
                              {config.agentName}
                            </h3>
                            <p className="text-xs text-gray-500 mt-1">
                              Personalizza i messaggi predefiniti basati sul tuo posizionamento
                            </p>
                          </div>
                          {hasDefaultChanges(config.id) && (
                            <Button
                              onClick={() => handleSaveDefaults(config.id)}
                              disabled={updateDefaultsMutation.isPending}
                              size="sm"
                            >
                              {updateDefaultsMutation.isPending ? (
                                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                              ) : (
                                <Save className="h-4 w-4 mr-2" />
                              )}
                              Salva Default
                            </Button>
                          )}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                          {/* Obiettivi */}
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <Label htmlFor={`obiettivi-${config.id}`} className="text-sm font-medium">
                                Obiettivi Predefiniti
                              </Label>
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Badge variant="outline" className="bg-gray-100 text-gray-600 border-gray-300 text-xs">
                                      Non usato
                                    </Badge>
                                  </TooltipTrigger>
                                  <TooltipContent side="top" className="max-w-xs">
                                    <p className="text-xs">
                                      Questo campo non è attualmente mappato ad alcuna variabile nei template Twilio.
                                      Verrà salvato nel database ma non sostituirà variabili nei messaggi.
                                    </p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </div>
                            <Textarea
                              id={`obiettivi-${config.id}`}
                              value={getDefaultValue(config.id, 'defaultObiettivi')}
                              onChange={(e) => handleDefaultChange(config.id, 'defaultObiettivi', e.target.value)}
                              placeholder="Es: creare un patrimonio tra 100.000 e 500.000€ in 2-4 anni"
                              className="mt-1 min-h-[80px]"
                            />
                          </div>

                          {/* Desideri */}
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <Label htmlFor={`desideri-${config.id}`} className="text-sm font-medium">
                                Desideri Predefiniti
                              </Label>
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Badge variant="outline" className="bg-gray-100 text-gray-600 border-gray-300 text-xs">
                                      Non usato
                                    </Badge>
                                  </TooltipTrigger>
                                  <TooltipContent side="top" className="max-w-xs">
                                    <p className="text-xs">
                                      Questo campo non è attualmente mappato ad alcuna variabile nei template Twilio.
                                      Verrà salvato nel database ma non sostituirà variabili nei messaggi.
                                    </p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </div>
                            <Textarea
                              id={`desideri-${config.id}`}
                              value={getDefaultValue(config.id, 'defaultDesideri')}
                              onChange={(e) => handleDefaultChange(config.id, 'defaultDesideri', e.target.value)}
                              placeholder="Es: generare una rendita passiva di almeno 2.000€/mese"
                              className="mt-1 min-h-[80px]"
                            />
                          </div>

                          {/* Uncino */}
                          <div>
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <Label htmlFor={`uncino-${config.id}`} className="text-sm font-medium">
                                Uncino Predefinito
                              </Label>
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Badge className="bg-orange-100 text-orange-700 border-orange-300 text-xs hover:bg-orange-200">
                                      {"{{4}}"} Opening
                                    </Badge>
                                  </TooltipTrigger>
                                  <TooltipContent side="top" className="max-w-xs">
                                    <p className="text-xs font-semibold mb-1">Mappato a variabile Twilio:</p>
                                    <ul className="list-disc list-inside text-xs space-y-1">
                                      <li><strong>{"{{4}}"}</strong> nel template <strong>Opening Message</strong></li>
                                    </ul>
                                    <p className="text-xs mt-2 text-gray-600">
                                      Esempio: "Ti scrivo perché [uncino]"
                                    </p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </div>
                            <Textarea
                              id={`uncino-${config.id}`}
                              value={getDefaultValue(config.id, 'defaultUncino')}
                              onChange={(e) => handleDefaultChange(config.id, 'defaultUncino', e.target.value)}
                              placeholder="Es: ho visto che potresti essere interessato a costruire un patrimonio solido"
                              className="mt-1 min-h-[80px]"
                            />
                          </div>

                          {/* Stato Ideale */}
                          <div>
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <Label htmlFor={`idealState-${config.id}`} className="text-sm font-medium">
                                Stato Ideale Predefinito
                              </Label>
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <div className="flex gap-1 flex-wrap">
                                      <Badge className="bg-orange-100 text-orange-700 border-orange-300 text-xs hover:bg-orange-200">
                                        {"{{5}}"} Opening
                                      </Badge>
                                      <Badge className="bg-green-100 text-green-700 border-green-300 text-xs hover:bg-green-200">
                                        {"{{3}}"} Gentle/Value
                                      </Badge>
                                      <Badge className="bg-blue-100 text-blue-700 border-blue-300 text-xs hover:bg-blue-200">
                                        {"{{2}}"} Final
                                      </Badge>
                                    </div>
                                  </TooltipTrigger>
                                  <TooltipContent side="top" className="max-w-xs">
                                    <p className="text-xs font-semibold mb-1">Mappato a variabili Twilio:</p>
                                    <ul className="list-disc list-inside text-xs space-y-1">
                                      <li><strong>{"{{5}}"}</strong> nel template <strong>Opening Message</strong></li>
                                      <li><strong>{"{{3}}"}</strong> nei template <strong>Gentle</strong> e <strong>Value Follow-up</strong></li>
                                      <li><strong>{"{{2}}"}</strong> nel template <strong>Final Follow-up</strong></li>
                                    </ul>
                                    <p className="text-xs mt-2 text-gray-600">
                                      Questo è il campo più usato: presente in TUTTI i template follow-up.
                                    </p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </div>
                            <Textarea
                              id={`idealState-${config.id}`}
                              value={getDefaultValue(config.id, 'defaultIdealState')}
                              onChange={(e) => handleDefaultChange(config.id, 'defaultIdealState', e.target.value)}
                              placeholder="Es: la libertà finanziaria con un patrimonio che lavora al posto tuo"
                              className="mt-1 min-h-[80px]"
                            />
                          </div>
                        </div>

                        {/* Preview del messaggio - WhatsApp Style */}
                        <div className="bg-gradient-to-br from-purple-50 to-blue-50 rounded-lg p-4 border border-purple-200">
                          <div className="flex items-center gap-2 mb-3">
                            <Sparkles className="h-4 w-4 text-purple-600" />
                            <span className="text-sm font-semibold text-purple-900">
                              📱 Anteprima Messaggio Apertura (Live)
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground mb-3">
                            ⚠️ Questa è la preview con i tuoi valori predefiniti. I messaggi REALI useranno i dati del lead specifico.
                          </p>
                          
                          {/* WhatsApp-style bubble */}
                          <div className="bg-[#DCF8C6] text-[#303030] p-4 rounded-lg rounded-tl-none shadow-md max-w-md">
                            <div className="text-sm whitespace-pre-wrap">
                              Ciao <span className="font-semibold text-blue-600">Mario</span>! Sono{' '}
                              <span className="font-semibold text-green-600">
                                {getDefaultValue(config.id, 'consultantDisplayName') || config.agentName}
                              </span>
                              {getDefaultValue(config.id, 'businessName') && (
                                <> dagli uffici di{' '}
                                  <span className="font-semibold text-purple-600">
                                    {getDefaultValue(config.id, 'businessName')}
                                  </span>
                                </>
                              )}
                              .
                              {'\n\n'}
                              Ti scrivo perché{' '}
                              <span className="font-semibold text-orange-600">
                                {getDefaultValue(config.id, 'defaultUncino') || '[uncino]'}
                              </span>
                              .
                              {'\n\n'}
                              Dato che non voglio sprecare il tuo tempo: hai 30 secondi da dedicarmi per capire se possiamo aiutarti a raggiungere{' '}
                              <span className="font-semibold text-pink-600">
                                {getDefaultValue(config.id, 'defaultIdealState') || '[stato ideale]'}
                              </span>
                              ?
                            </div>
                            <p className="text-xs text-right text-gray-500 mt-2">
                              {new Date().toLocaleTimeString("it-IT", {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* No Proactive Agents */}
            {!configsLoading && configs.filter(c => c.agentType === 'proactive_setter').length === 0 && configs.length > 0 && (
              <Card className="shadow-xl border-2 border-dashed border-amber-300 bg-gradient-to-br from-amber-50 to-orange-50 animate-in fade-in-50 duration-500">
                <CardContent className="py-16">
                  <div className="text-center max-w-md mx-auto">
                    <div className="mb-6 relative">
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-32 h-32 bg-gradient-to-r from-amber-400 to-orange-400 rounded-full blur-2xl opacity-20"></div>
                      </div>
                      <Bot className="h-20 w-20 text-amber-500 mx-auto relative z-10" />
                    </div>
                    <h3 className="text-2xl font-bold text-gray-900 mb-3">
                      Nessun Agente Proattivo Configurato
                    </h3>
                    <p className="text-gray-600 mb-6 text-lg">
                      I template WhatsApp possono essere assegnati solo agli agenti di tipo "Setter Proattivo".
                      Crea un agente proattivo nella sezione Configurazione WhatsApp.
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* No Agents */}
            {!configsLoading && configs.length === 0 && (
              <Card className="shadow-xl border-2 border-dashed border-red-300 bg-gradient-to-br from-red-50 to-pink-50 animate-in fade-in-50 duration-500">
                <CardContent className="py-16">
                  <div className="text-center max-w-md mx-auto">
                    <div className="mb-6 relative">
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-32 h-32 bg-gradient-to-r from-red-400 to-pink-400 rounded-full blur-2xl opacity-20"></div>
                      </div>
                      <Bot className="h-20 w-20 text-red-500 mx-auto relative z-10" />
                    </div>
                    <h3 className="text-2xl font-bold text-gray-900 mb-3">
                      Nessun Agente Configurato
                    </h3>
                    <p className="text-gray-600 mb-6 text-lg">
                      Configura almeno un agente WhatsApp di tipo "Setter Proattivo" per assegnare i template.
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
      <ConsultantAIAssistant />
    </div>
    </div>
  );
}
