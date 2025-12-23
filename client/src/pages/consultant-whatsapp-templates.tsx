import React, { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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
  ListChecks,
  AlertTriangle,
  Search,
  Eye,
  RotateCcw,
  Phone,
  Gift,
  Timer,
  Repeat
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
import { cn } from "@/lib/utils";

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
  isProactiveAgent?: boolean;
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
  approvalStatus?: string | null;
  activeVersion?: {
    id: string;
    versionNumber: number;
    bodyText: string;
    twilioStatus: string;
    twilioContentSid?: string | null;
  } | null;
}

interface TemplateAssignmentData {
  assignmentId: string;
  templateId: string;
  templateName: string;
  useCase: string;
  priority: number;
}

interface PreviewVariables {
  nomeLead: string;
  nomeConsulente: string;
  business: string;
  obiettivi: string;
  desideri: string;
}

const getAgentType = (config: WhatsAppConfig): "reactive_lead" | "proactive_setter" => {
  // Fix: Considera proattivo se agentType è 'proactive_setter' OPPURE isProactiveAgent è true
  // Questo allinea con la logica backend: (isProactiveAgent = true OR agentType = 'proactive_setter')
  if (config.agentType === 'proactive_setter' || config.isProactiveAgent === true) {
    return 'proactive_setter';
  }
  return 'reactive_lead';
};

const isAgentProactive = (config: WhatsAppConfig): boolean => {
  return getAgentType(config) === 'proactive_setter';
};

function CustomTemplateAssignmentSection({ configs, configsLoading, selectedAgentId, twilioTemplates = [] }: { configs: WhatsAppConfig[]; configsLoading: boolean; selectedAgentId: string | null; twilioTemplates?: TwilioTemplate[] }) {
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

  const customTemplatesFromDb: CustomTemplate[] = customTemplatesData?.data || [];
  
  // Merge custom templates from DB with Twilio templates, converting Twilio templates to CustomTemplate format
  const twilioAsCustomTemplates: CustomTemplate[] = twilioTemplates
    .filter(t => t.approvalStatus?.toLowerCase() === 'approved')
    .map(t => ({
      id: t.sid,
      templateName: t.friendlyName || t.sid,
      useCase: t.useCase || null,
      templateType: t.templateType || null,
      description: null,
      body: t.bodyText,
      isActive: true,
      approvalStatus: t.approvalStatus,
      activeVersion: {
        id: t.sid,
        versionNumber: 1,
        bodyText: t.bodyText || '',
        twilioStatus: 'approved',
        twilioContentSid: t.sid,
      },
    }));
  
  // Normalize template name for matching: lowercase, remove spaces/underscores/dashes, strip explicit version suffixes
  // Only removes explicit version markers like _v1, _v2, not arbitrary trailing numbers (to preserve "Follow-up Giorno 1")
  const normalizeName = (name: string | null | undefined): string => {
    if (!name) return '';
    return name
      .toLowerCase()
      .replace(/[_\s-]+/g, '')       // Remove spaces, underscores, dashes
      .replace(/v\d+$/i, '');        // Remove only version suffix at end like v1, v2
  };

  // Create Sets for de-duplication: by SID and by normalized name
  const twilioSids = new Set(
    twilioAsCustomTemplates
      .map(t => t.activeVersion?.twilioContentSid)
      .filter(Boolean)
  );
  const twilioNormalizedNames = new Set(
    twilioAsCustomTemplates
      .map(t => normalizeName(t.templateName))
      .filter(Boolean)
  );
  
  // Combine both sources, de-duplicating by twilioContentSid OR normalized name
  // A template from DB is excluded if:
  // 1. Its activeVersion.twilioContentSid matches a Twilio template, OR
  // 2. Its normalized name matches a Twilio template (fallback for legacy records)
  const customTemplates: CustomTemplate[] = [
    ...twilioAsCustomTemplates,
    ...customTemplatesFromDb.filter(ct => {
      const localSid = ct.activeVersion?.twilioContentSid;
      const localNormalizedName = normalizeName(ct.templateName);
      
      // Exclude if SID matches Twilio
      if (localSid && twilioSids.has(localSid)) return false;
      
      // Exclude if normalized name matches Twilio (handles "Riattivazione Setter" vs "riattivazione_setter_v1")
      if (localNormalizedName && twilioNormalizedNames.has(localNormalizedName)) return false;
      
      return true;
    }),
  ];
  const selectedAgent = configs.find(c => c.id === selectedAgentId);
  const isProactiveAgentSelected = selectedAgent ? isAgentProactive(selectedAgent) : false;

  useEffect(() => {
    const loadAssignments = async () => {
      if (!selectedAgentId || !isProactiveAgentSelected) return;
      if (loadingAssignments.has(selectedAgentId)) return;
      
      setLoadingAssignments(prev => new Set([...prev, selectedAgentId]));
      try {
        // Load custom template assignments from DB
        const response = await fetch(`/api/whatsapp/template-assignments/${selectedAgentId}`, {
          headers: getAuthHeaders(),
        });
        
        const assignedIds = new Set<string>();
        
        if (response.ok) {
          const data = await response.json();
          (data.assignments || []).forEach((a: TemplateAssignmentData) => {
            assignedIds.add(a.templateId);
          });
        }
        
        setSelectedTemplates(prev => new Map(prev).set(selectedAgentId, assignedIds));
        setInitialAssignments(prev => new Map(prev).set(selectedAgentId, new Set(assignedIds)));
      } catch (error) {
        console.error("Failed to load assignments for", selectedAgentId, error);
      } finally {
        setLoadingAssignments(prev => {
          const newSet = new Set(prev);
          newSet.delete(selectedAgentId);
          return newSet;
        });
      }
    };

    if (selectedAgentId && isProactiveAgentSelected && customTemplates.length > 0) {
      loadAssignments();
    }
  }, [selectedAgentId, isProactiveAgentSelected, customTemplates.length, configs]);

  const bulkAssignMutation = useMutation({
    mutationFn: async ({ agentConfigId, templateIds }: { agentConfigId: string; templateIds: string[] }) => {
      // Send ALL template IDs (both Twilio HX and custom UUIDs) to the assignments table
      // The backend will handle both types uniformly
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
        throw new Error(error.message || "Failed to save template assignments");
      }
      const result = await response.json();
      
      return { results: [result], assignedCount: result.assignedCount };
    },
    onSuccess: (_, variables) => {
      const currentSelected = selectedTemplates.get(variables.agentConfigId) || new Set();
      setInitialAssignments(prev => new Map(prev).set(variables.agentConfigId, new Set(currentSelected)));
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/template-assignments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/config"] });
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
      <Card className="shadow-xl border-0 bg-white/80 backdrop-blur-sm">
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </CardContent>
      </Card>
    );
  }

  if (!selectedAgentId || !isProactiveAgentSelected) {
    return null;
  }

  const isLoading = loadingAssignments.has(selectedAgentId);
  const configSelectedTemplates = selectedTemplates.get(selectedAgentId) || new Set();
  
  const approvedTemplates = customTemplates.filter(
    (t) => t.approvalStatus?.toLowerCase() === "approved" || t.activeVersion?.twilioStatus?.toLowerCase() === "approved"
  );
  
  const mainTemplate = approvedTemplates.find(t => t.templateType === "opening");
  const otherTemplates = approvedTemplates.filter(t => t.templateType !== "opening");
  
  // Group templates by category for better organization
  const templatesByCategory = useMemo(() => {
    const categories: Record<string, CustomTemplate[]> = {};
    
    otherTemplates.forEach(template => {
      const category = template.useCase || template.templateType || "Generale";
      // Normalize category names for grouping
      const normalizedCategory = category.toLowerCase();
      
      let groupKey = "Generale";
      if (normalizedCategory.includes("setter") || normalizedCategory.includes("proattivo")) {
        groupKey = "Setter";
      } else if (normalizedCategory.includes("receptionist") || normalizedCategory.includes("customer") || normalizedCategory.includes("servizio")) {
        groupKey = "Customer Service";
      } else if (normalizedCategory.includes("follow") || normalizedCategory.includes("riattiv")) {
        groupKey = "Follow-up";
      } else if (normalizedCategory.includes("apertura") || normalizedCategory.includes("primo") || normalizedCategory.includes("benvenuto")) {
        groupKey = "Primo Contatto";
      } else if (normalizedCategory.includes("conferma") || normalizedCategory.includes("appuntamento") || normalizedCategory.includes("booking")) {
        groupKey = "Appuntamenti";
      } else if (category !== "Generale") {
        groupKey = category; // Use original category if not matching known patterns
      }
      
      if (!categories[groupKey]) {
        categories[groupKey] = [];
      }
      categories[groupKey].push(template);
    });
    
    // Sort categories: known categories first, then alphabetically
    const orderedKeys = Object.keys(categories).sort((a, b) => {
      const order = ["Setter", "Customer Service", "Primo Contatto", "Follow-up", "Appuntamenti", "Generale"];
      const aIndex = order.indexOf(a);
      const bIndex = order.indexOf(b);
      if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
      if (aIndex !== -1) return -1;
      if (bIndex !== -1) return 1;
      return a.localeCompare(b);
    });
    
    return { categories, orderedKeys };
  }, [otherTemplates]);
  
  const [openCategories, setOpenCategories] = useState<Set<string>>(new Set(templatesByCategory.orderedKeys));
  
  const assignedNonApprovedTemplates = customTemplates.filter(
    (t) => configSelectedTemplates.has(t.id) && 
           t.approvalStatus?.toLowerCase() !== "approved" && 
           t.activeVersion?.twilioStatus?.toLowerCase() !== "approved"
  );

  if (customTemplates.length === 0) {
    return (
      <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-3 text-xl">
            <div className="p-2 rounded-lg bg-gradient-to-r from-emerald-500 to-blue-500">
              <ListChecks className="h-5 w-5 text-white" />
            </div>
            Template Personalizzati
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert className="border-amber-200 bg-amber-50">
            <AlertCircle className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-amber-800">
              Non hai ancora creato template personalizzati. <a href="/consultant/whatsapp/custom-templates" className="underline font-medium hover:text-amber-900">Crea il tuo primo template</a> per poterlo assegnare agli agenti.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  if (approvedTemplates.length === 0) {
    return (
      <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-3 text-xl">
            <div className="p-2 rounded-lg bg-gradient-to-r from-emerald-500 to-blue-500">
              <ListChecks className="h-5 w-5 text-white" />
            </div>
            Template Personalizzati
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert className="border-amber-200 bg-amber-50">
            <AlertCircle className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-amber-800">
              Nessun template approvato disponibile. Solo i template approvati da Meta possono essere assegnati all'AI. 
              <a href="/consultant/whatsapp/custom-templates/list" className="underline font-medium hover:text-amber-900 ml-1">
                Vai alla lista template
              </a> per verificare lo stato di approvazione.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-3 text-xl">
            <div className="p-2 rounded-lg bg-gradient-to-r from-emerald-500 to-blue-500">
              <ListChecks className="h-5 w-5 text-white" />
            </div>
            Template Personalizzati
            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300">
              {configSelectedTemplates.size} assegnati
            </Badge>
          </CardTitle>
          {hasChanges(selectedAgentId) && (
            <Button
              onClick={() => handleSaveAssignments(selectedAgentId)}
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
        <CardDescription>
          Seleziona i template personalizzati per questo agente (solo approvati)
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
            <span className="ml-2 text-gray-500">Caricamento assegnazioni...</span>
          </div>
        ) : (
          <div className="space-y-6">
            {mainTemplate && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                  <span className="text-sm font-semibold text-gray-700">Template MAIN (Primo Messaggio)</span>
                </div>
                <label
                  key={mainTemplate.id}
                  className={`flex items-start gap-3 p-4 rounded-lg border-2 cursor-pointer transition-all duration-200 ${
                    configSelectedTemplates.has(mainTemplate.id)
                      ? "border-blue-500 bg-blue-100 shadow-lg ring-2 ring-blue-200"
                      : "border-blue-200 bg-blue-50 hover:border-blue-400 hover:shadow-md"
                  }`}
                >
                  <Checkbox
                    checked={configSelectedTemplates.has(mainTemplate.id)}
                    onCheckedChange={(checked) =>
                      handleTemplateToggle(selectedAgentId, mainTemplate.id, checked === true)
                    }
                    className="mt-1"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-gray-900 truncate flex items-center gap-2">
                      {mainTemplate.templateName}
                      <Badge className="bg-blue-600 text-white text-xs">MAIN</Badge>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-300">
                        Approvato
                      </Badge>
                    </div>
                    {mainTemplate.description && (
                      <p className="text-xs text-gray-600 mt-1 line-clamp-2">
                        {mainTemplate.description}
                      </p>
                    )}
                  </div>
                </label>
              </div>
            )}
            
            {otherTemplates.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-purple-500"></div>
                  <span className="text-sm font-semibold text-gray-700">Template per Categoria ({otherTemplates.length} totali)</span>
                </div>
                
                {templatesByCategory.orderedKeys.map((categoryName) => {
                  const categoryTemplates = templatesByCategory.categories[categoryName];
                  const isOpen = openCategories.has(categoryName);
                  const selectedInCategory = categoryTemplates.filter(t => configSelectedTemplates.has(t.id)).length;
                  
                  // Category colors
                  const categoryColors: Record<string, { bg: string; text: string; border: string; icon: string }> = {
                    "Setter": { bg: "bg-orange-50", text: "text-orange-700", border: "border-orange-200", icon: "bg-orange-500" },
                    "Customer Service": { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200", icon: "bg-blue-500" },
                    "Follow-up": { bg: "bg-purple-50", text: "text-purple-700", border: "border-purple-200", icon: "bg-purple-500" },
                    "Primo Contatto": { bg: "bg-green-50", text: "text-green-700", border: "border-green-200", icon: "bg-green-500" },
                    "Appuntamenti": { bg: "bg-pink-50", text: "text-pink-700", border: "border-pink-200", icon: "bg-pink-500" },
                    "Generale": { bg: "bg-gray-50", text: "text-gray-700", border: "border-gray-200", icon: "bg-gray-500" },
                  };
                  
                  const colors = categoryColors[categoryName] || categoryColors["Generale"];
                  
                  return (
                    <Collapsible
                      key={categoryName}
                      open={isOpen}
                      onOpenChange={(open) => {
                        setOpenCategories(prev => {
                          const newSet = new Set(prev);
                          if (open) {
                            newSet.add(categoryName);
                          } else {
                            newSet.delete(categoryName);
                          }
                          return newSet;
                        });
                      }}
                    >
                      <CollapsibleTrigger asChild>
                        <div className={`flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors ${colors.bg} ${colors.border} border hover:opacity-90`}>
                          <div className="flex items-center gap-3">
                            <div className={`w-3 h-3 rounded-full ${colors.icon}`}></div>
                            <span className={`font-semibold ${colors.text}`}>{categoryName}</span>
                            <Badge variant="outline" className={`text-xs ${colors.bg} ${colors.text} ${colors.border}`}>
                              {categoryTemplates.length} template
                            </Badge>
                            {selectedInCategory > 0 && (
                              <Badge className="bg-blue-500 text-white text-xs">
                                {selectedInCategory} selezionati
                              </Badge>
                            )}
                          </div>
                          <ChevronDown className={`h-4 w-4 ${colors.text} transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
                        </div>
                      </CollapsibleTrigger>
                      <CollapsibleContent className="mt-3">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                          {categoryTemplates.map((template) => {
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
                                    handleTemplateToggle(selectedAgentId, template.id, checked === true)
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
                                    <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-300">
                                      Approvato
                                    </Badge>
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
                      </CollapsibleContent>
                    </Collapsible>
                  );
                })}
              </div>
            )}
            
            {assignedNonApprovedTemplates.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-3 h-3 rounded-full bg-red-500"></div>
                  <span className="text-sm font-semibold text-red-700">Template Assegnati Non Approvati ({assignedNonApprovedTemplates.length})</span>
                </div>
                <Alert className="border-red-200 bg-red-50 mb-3">
                  <AlertCircle className="h-4 w-4 text-red-600" />
                  <AlertDescription className="text-red-800 text-sm">
                    Questi template sono attualmente assegnati ma non sono approvati da Meta. Deselezionali per rimuoverli o attendi l'approvazione.
                  </AlertDescription>
                </Alert>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {assignedNonApprovedTemplates.map((template) => {
                    const displayUseCase = template.useCase || template.templateType || "Generale";
                    const status = template.activeVersion?.twilioStatus || "draft";
                    
                    return (
                      <label
                        key={template.id}
                        className="flex items-start gap-3 p-4 rounded-lg border-2 border-red-300 bg-red-50 cursor-pointer transition-all duration-200 hover:border-red-400"
                      >
                        <Checkbox
                          checked={true}
                          onCheckedChange={(checked) =>
                            handleTemplateToggle(selectedAgentId, template.id, checked === true)
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
                            <Badge variant="outline" className={`text-xs ${
                              status === "pending" || status === "pending_approval"
                                ? "bg-yellow-50 text-yellow-700 border-yellow-300"
                                : status === "rejected"
                                ? "bg-red-50 text-red-700 border-red-300"
                                : "bg-gray-50 text-gray-600 border-gray-300"
                            }`}>
                              {status === "pending" || status === "pending_approval" ? "In Attesa" :
                               status === "rejected" ? "Rifiutato" : status}
                            </Badge>
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
              </div>
            )}
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
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [agentSelectorOpen, setAgentSelectorOpen] = useState(false);
  
  const [previewVariables, setPreviewVariables] = useState<PreviewVariables>({
    nomeLead: "Marco Rossi",
    nomeConsulente: "Luca",
    business: "Palestra Fitness",
    obiettivi: "Perdere peso",
    desideri: "Più tempo libero",
  });
  const [selectedPreviewTemplateId, setSelectedPreviewTemplateId] = useState<string | null>(null);

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
  const twilioConsoleUrl = templatesData?.twilioConsoleUrl || "https://console.twilio.com/us1/develop/sms/content-editor";

  useEffect(() => {
    if (configs.length > 0 && !selectedAgentId) {
      const proactiveAgent = configs.find(c => isAgentProactive(c));
      if (proactiveAgent) {
        setSelectedAgentId(proactiveAgent.id);
      } else if (configs[0]) {
        setSelectedAgentId(configs[0].id);
      }
    }
  }, [configs, selectedAgentId]);

  const selectedAgent = useMemo(() => 
    configs.find(c => c.id === selectedAgentId), 
    [configs, selectedAgentId]
  );

  useEffect(() => {
    if (selectedAgent) {
      setPreviewVariables({
        nomeLead: "Marco Rossi",
        nomeConsulente: selectedAgent.consultantDisplayName || selectedAgent.agentName || "Luca",
        business: selectedAgent.businessName || "Palestra Fitness",
        obiettivi: selectedAgent.defaultObiettivi || "Perdere peso",
        desideri: selectedAgent.defaultDesideri || "Più tempo libero",
      });
      setSelectedPreviewTemplateId(null);
    }
  }, [selectedAgent]);

  const agentTemplates = useMemo(() => {
    if (!selectedAgentId) return [];
    const filtered = templates.filter(t => t.agentId === selectedAgentId);
    if (filtered.length === 0) {
      return templates;
    }
    return filtered;
  }, [templates, selectedAgentId]);

  const approvedTemplates = useMemo(() => 
    agentTemplates.filter(t => t.approvalStatus?.toLowerCase() === 'approved'),
    [agentTemplates]
  );

  const getTemplateCount = (configId: string) => {
    const config = configs.find(c => c.id === configId);
    let count = 0;
    if (config?.whatsappTemplates?.openingMessageContentSid) count++;
    if (config?.whatsappTemplates?.followUpGentleContentSid) count++;
    if (config?.whatsappTemplates?.followUpValueContentSid) count++;
    if (config?.whatsappTemplates?.followUpFinalContentSid) count++;
    return count;
  };

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
    const templateChanges = pendingChanges.get(configId);
    if (!templateChanges) return;

    updateTemplatesMutation.mutate({ configId, whatsappTemplates: templateChanges });
  };

  const hasChanges = (configId: string) => {
    return pendingChanges.has(configId);
  };

  const handleSaveDefaults = (configId: string) => {
    const defaults = pendingDefaults.get(configId);
    if (!defaults) return;

    updateDefaultsMutation.mutate({ configId, defaults });
  };

  const hasDefaultChanges = (configId: string) => {
    return pendingDefaults.has(configId);
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

  const handleCreateDefaultTemplates = async () => {
    setIsCreatingTemplates(true);

    try {
      const response = await fetch("/api/whatsapp/templates/create-defaults", {
        method: "POST",
        headers: getAuthHeaders(),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to create templates");
      }

      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/templates"] });

      toast({
        title: "✅ Template creati",
        description: `${data.created.length} template creati, ${data.skipped.length} già esistenti.`,
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

  const getApprovalStatusLabel = (status?: string): string => {
    if (!status) return 'Sconosciuto';
    const s = status.toLowerCase();
    if (s === 'approved') return 'Approvato';
    if (s === 'pending') return 'In Attesa';
    if (s === 'received') return 'Ricevuto';
    if (s === 'rejected') return 'Rifiutato';
    if (s === 'paused') return 'In Pausa';
    if (s === 'disabled') return 'Disabilitato';
    return 'Sconosciuto';
  };

  const renderPreviewMessage = (templateBody: string) => {
    if (!templateBody) return null;
    
    let preview = templateBody;
    
    // Replace numbered placeholders {{1}}, {{2}}, etc.
    preview = preview.replace(/\{\{1\}\}/g, `<span class="font-semibold text-blue-600">${previewVariables.nomeLead}</span>`);
    preview = preview.replace(/\{\{2\}\}/g, `<span class="font-semibold text-green-600">${previewVariables.nomeConsulente}</span>`);
    preview = preview.replace(/\{\{3\}\}/g, `<span class="font-semibold text-purple-600">${previewVariables.business}</span>`);
    preview = preview.replace(/\{\{4\}\}/g, `<span class="font-semibold text-orange-600">${previewVariables.obiettivi}</span>`);
    preview = preview.replace(/\{\{5\}\}/g, `<span class="font-semibold text-pink-600">${previewVariables.desideri}</span>`);
    
    // Replace semantic variables {nome_lead}, {nome_consulente}, {nome_business}, etc.
    preview = preview.replace(/\{nome_lead\}/gi, `<span class="font-semibold text-blue-600">${previewVariables.nomeLead}</span>`);
    preview = preview.replace(/\{nome_consulente\}/gi, `<span class="font-semibold text-green-600">${previewVariables.nomeConsulente}</span>`);
    preview = preview.replace(/\{nome_business\}/gi, `<span class="font-semibold text-purple-600">${previewVariables.business}</span>`);
    preview = preview.replace(/\{business\}/gi, `<span class="font-semibold text-purple-600">${previewVariables.business}</span>`);
    preview = preview.replace(/\{obiettivi\}/gi, `<span class="font-semibold text-orange-600">${previewVariables.obiettivi}</span>`);
    preview = preview.replace(/\{desideri\}/gi, `<span class="font-semibold text-pink-600">${previewVariables.desideri}</span>`);
    
    // Also handle double bracket semantic variables {{nome_lead}}, etc.
    preview = preview.replace(/\{\{nome_lead\}\}/gi, `<span class="font-semibold text-blue-600">${previewVariables.nomeLead}</span>`);
    preview = preview.replace(/\{\{nome_consulente\}\}/gi, `<span class="font-semibold text-green-600">${previewVariables.nomeConsulente}</span>`);
    preview = preview.replace(/\{\{nome_business\}\}/gi, `<span class="font-semibold text-purple-600">${previewVariables.business}</span>`);
    preview = preview.replace(/\{\{business\}\}/gi, `<span class="font-semibold text-purple-600">${previewVariables.business}</span>`);
    preview = preview.replace(/\{\{obiettivi\}\}/gi, `<span class="font-semibold text-orange-600">${previewVariables.obiettivi}</span>`);
    preview = preview.replace(/\{\{desideri\}\}/gi, `<span class="font-semibold text-pink-600">${previewVariables.desideri}</span>`);
    
    return <div className="text-sm whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: preview }} />;
  };

  const openingTemplateAssigned = selectedAgentId ? getAssignedTemplate(selectedAgentId, 'openingMessageContentSid') : '';
  const isOpeningConfigured = !!openingTemplateAssigned && openingTemplateAssigned !== 'none';

  const selectedOpeningTemplate = useMemo(() => 
    agentTemplates.find(t => t.sid === openingTemplateAssigned),
    [agentTemplates, openingTemplateAssigned]
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
            <div className="space-y-6">
              <NavigationTabs
                tabs={[
                  { label: "Template Twilio", href: "/consultant/whatsapp-templates", icon: FileText },
                  { label: "Template Personalizzati", href: "/consultant/whatsapp/custom-templates/list", icon: PenSquare },
                ]}
              />

              <div className="bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 text-white p-6 md:p-8 rounded-2xl shadow-2xl">
                <div className="flex flex-col md:flex-row items-start md:items-center gap-4 mb-4">
                  <div className="p-3 rounded-full bg-white/20 backdrop-blur-sm">
                    <MessageSquare className="h-8 w-8 text-white" />
                  </div>
                  <div className="flex-1">
                    <h1 className="text-3xl md:text-4xl font-bold mb-1">
                      Gestione Template WhatsApp
                    </h1>
                    <p className="text-blue-100">
                      Configura i template per l'invio automatico ai lead
                    </p>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <Button
                      onClick={handleCreateDefaultTemplates}
                      disabled={isCreatingTemplates || configsLoading}
                      className="bg-white/20 hover:bg-white/30 text-white border border-white/30"
                    >
                      {isCreatingTemplates ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Plus className="h-4 w-4 mr-2" />
                      )}
                      Crea Template
                    </Button>
                    <Button
                      onClick={() => window.open(twilioConsoleUrl, '_blank')}
                      className="bg-white text-blue-600 hover:bg-blue-50"
                    >
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Console Twilio
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
                  <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3 border border-white/20">
                    <p className="text-xs text-blue-100 mb-1">Template Totali</p>
                    <p className="text-2xl font-bold">{templates.length}</p>
                  </div>
                  <div className="bg-emerald-500/20 backdrop-blur-sm rounded-lg p-3 border border-emerald-300/30">
                    <p className="text-xs text-emerald-100 mb-1">Approvati</p>
                    <p className="text-2xl font-bold">{templates.filter(t => t.approvalStatus?.toLowerCase() === 'approved').length}</p>
                  </div>
                  <div className="bg-amber-500/20 backdrop-blur-sm rounded-lg p-3 border border-amber-300/30">
                    <p className="text-xs text-amber-100 mb-1">In Attesa</p>
                    <p className="text-2xl font-bold">{templates.filter(t => t.approvalStatus?.toLowerCase() === 'pending').length}</p>
                  </div>
                  <div className="bg-purple-500/20 backdrop-blur-sm rounded-lg p-3 border border-purple-300/30">
                    <p className="text-xs text-purple-100 mb-1">Agenti Attivi</p>
                    <p className="text-2xl font-bold">{configs.filter(c => isAgentProactive(c)).length}</p>
                  </div>
                </div>
              </div>

              {templatesError && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    {(templatesError as Error).message}
                  </AlertDescription>
                </Alert>
              )}

              {(templatesLoading || configsLoading) && (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
                </div>
              )}

              {!templatesLoading && !configsLoading && configs.length > 0 && (
                <>
                  <Card className="shadow-lg border-2 border-blue-200 bg-white/90 backdrop-blur-sm">
                    <CardHeader className="pb-3">
                      <CardTitle className="flex items-center gap-3 text-xl">
                        <div className="p-2 rounded-lg bg-gradient-to-r from-blue-500 to-indigo-500">
                          <Bot className="h-5 w-5 text-white" />
                        </div>
                        Seleziona Agente
                      </CardTitle>
                      <CardDescription>
                        Scegli l'agente per cui configurare i template
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Popover open={agentSelectorOpen} onOpenChange={setAgentSelectorOpen}>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            role="combobox"
                            aria-expanded={agentSelectorOpen}
                            className="w-full justify-between h-auto py-3 px-4"
                          >
                            {selectedAgent ? (
                              <div className="flex items-center gap-3 text-left">
                                <Bot className="h-5 w-5 text-blue-600 shrink-0" />
                                <div className="flex-1 min-w-0">
                                  <div className="font-semibold text-gray-900">{selectedAgent.agentName}</div>
                                  <div className="text-xs text-gray-500 flex items-center gap-2 flex-wrap">
                                    <span className="flex items-center gap-1">
                                      <Phone className="h-3 w-3" />
                                      {selectedAgent.twilioWhatsappNumber}
                                    </span>
                                    <Badge 
                                      variant="outline" 
                                      className={cn(
                                        "text-xs",
                                        isAgentProactive(selectedAgent) 
                                          ? "bg-green-50 text-green-700 border-green-300" 
                                          : "bg-blue-50 text-blue-700 border-blue-300"
                                      )}
                                    >
                                      {isAgentProactive(selectedAgent) ? 'Proattivo' : 'Reattivo'}
                                    </Badge>
                                    <Badge variant="outline" className="text-xs bg-purple-50 text-purple-700 border-purple-300">
                                      {getTemplateCount(selectedAgent.id)} template
                                    </Badge>
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <span className="text-gray-500">Seleziona un agente...</span>
                            )}
                            <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-full p-0" align="start">
                          <Command>
                            <CommandInput placeholder="Cerca agente..." className="h-9" />
                            <CommandList className="max-h-[300px]">
                              <CommandEmpty>Nessun agente trovato.</CommandEmpty>
                              <CommandGroup>
                                {configs.map((config) => (
                                  <CommandItem
                                    key={config.id}
                                    value={config.agentName}
                                    onSelect={() => {
                                      setSelectedAgentId(config.id);
                                      setAgentSelectorOpen(false);
                                    }}
                                    className="flex items-center gap-3 p-3 cursor-pointer"
                                  >
                                    <Bot className={cn(
                                      "h-5 w-5 shrink-0",
                                      config.id === selectedAgentId ? "text-blue-600" : "text-gray-400"
                                    )} />
                                    <div className="flex-1 min-w-0">
                                      <div className="font-medium">{config.agentName}</div>
                                      <div className="text-xs text-gray-500 flex items-center gap-2 flex-wrap">
                                        <span>{config.twilioWhatsappNumber}</span>
                                        <Badge 
                                          variant="outline" 
                                          className={cn(
                                            "text-xs",
                                            isAgentProactive(config) 
                                              ? "bg-green-50 text-green-700 border-green-300" 
                                              : "bg-blue-50 text-blue-700 border-blue-300"
                                          )}
                                        >
                                          {isAgentProactive(config) ? 'Proattivo' : 'Reattivo'}
                                        </Badge>
                                        <span className="text-purple-600">{getTemplateCount(config.id)} template</span>
                                      </div>
                                    </div>
                                    {config.id === selectedAgentId && (
                                      <CheckCircle2 className="h-5 w-5 text-blue-600 shrink-0" />
                                    )}
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                    </CardContent>
                  </Card>

                  {selectedAgentId && selectedAgent && isAgentProactive(selectedAgent) && (
                    <>
                      <Card className={cn(
                        "shadow-xl border-4 bg-white/95 backdrop-blur-sm",
                        isOpeningConfigured 
                          ? "border-green-400" 
                          : "border-red-400 animate-pulse"
                      )}>
                        <CardHeader className="pb-3">
                          <div className="flex items-center justify-between">
                            <CardTitle className="flex items-center gap-3 text-xl">
                              <div className={cn(
                                "p-2 rounded-lg",
                                isOpeningConfigured 
                                  ? "bg-gradient-to-r from-green-500 to-emerald-500" 
                                  : "bg-gradient-to-r from-red-500 to-orange-500"
                              )}>
                                <MessageSquare className="h-5 w-5 text-white" />
                              </div>
                              Messaggio di Apertura
                              <Badge 
                                className={cn(
                                  "text-sm px-3 py-1",
                                  isOpeningConfigured 
                                    ? "bg-green-100 text-green-700 hover:bg-green-200" 
                                    : "bg-red-100 text-red-700 hover:bg-red-200"
                                )}
                              >
                                {isOpeningConfigured ? "🟢 Configurato" : "🔴 Non Configurato"}
                              </Badge>
                            </CardTitle>
                            {hasChanges(selectedAgentId) && (
                              <Button
                                onClick={() => handleSaveChanges(selectedAgentId)}
                                disabled={updateTemplatesMutation.isPending}
                                size="sm"
                              >
                                {updateTemplatesMutation.isPending ? (
                                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                ) : (
                                  <Save className="h-4 w-4 mr-2" />
                                )}
                                Salva
                              </Button>
                            )}
                          </div>
                        </CardHeader>
                        <CardContent>
                          {!isOpeningConfigured && (
                            <Alert className="mb-4 border-red-300 bg-red-50">
                              <AlertTriangle className="h-5 w-5 text-red-600" />
                              <AlertTitle className="text-red-800 font-bold">OBBLIGATORIO</AlertTitle>
                              <AlertDescription className="text-red-700">
                                ATTENZIONE: Senza messaggio di apertura configurato, l'agente NON PUÒ inviare il primo messaggio ai lead!
                              </AlertDescription>
                            </Alert>
                          )}

                          <div className="space-y-4">
                            <div>
                              <Label className="text-sm font-medium mb-2 block">
                                Seleziona il template per il primo messaggio:
                              </Label>
                              <Select
                                value={openingTemplateAssigned || 'none'}
                                onValueChange={(value) => handleTemplateChange(selectedAgentId, 'openingMessageContentSid', value)}
                              >
                                <SelectTrigger className="w-full">
                                  <SelectValue placeholder="Seleziona template apertura..." />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="none">-- Nessun template --</SelectItem>
                                  {agentTemplates
                                    .filter((template) => template.approvalStatus?.toLowerCase() === 'approved')
                                    .map((template) => (
                                      <SelectItem key={template.sid} value={template.sid}>
                                        <div className="flex items-center gap-2">
                                          <span>{template.friendlyName}</span>
                                          <Badge 
                                            variant="outline" 
                                            className="text-xs bg-green-50 text-green-700"
                                          >
                                            Approvato
                                          </Badge>
                                        </div>
                                      </SelectItem>
                                    ))}
                                  {agentTemplates.filter(t => t.approvalStatus?.toLowerCase() !== 'approved').length > 0 && (
                                    <div className="px-2 py-1.5 text-xs text-muted-foreground border-t mt-1">
                                      {agentTemplates.filter(t => t.approvalStatus?.toLowerCase() !== 'approved').length} template non ancora approvati da Meta
                                    </div>
                                  )}
                                </SelectContent>
                              </Select>
                            </div>

                            {selectedOpeningTemplate && (
                              <div className="bg-gray-50 rounded-lg p-4 border">
                                <Label className="text-xs font-medium text-gray-500 mb-2 block">
                                  Testo del template selezionato:
                                </Label>
                                <p className="text-sm text-gray-700 whitespace-pre-wrap">
                                  {selectedOpeningTemplate.bodyText}
                                </p>
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>

                      <CustomTemplateAssignmentSection 
                        configs={configs} 
                        configsLoading={configsLoading} 
                        selectedAgentId={selectedAgentId}
                        twilioTemplates={agentTemplates}
                      />

                      <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm">
                        <CardHeader className="pb-3">
                          <CardTitle className="flex items-center gap-3 text-xl">
                            <div className="p-2 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-500">
                              <Eye className="h-5 w-5 text-white" />
                            </div>
                            Anteprima Interattiva Template
                          </CardTitle>
                          <CardDescription>
                            Seleziona un template e modifica i valori per vedere come apparirà il messaggio
                          </CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <div className="space-y-4">
                              <div>
                                <Label className="text-sm font-medium mb-2 block">
                                  Seleziona Template da Visualizzare
                                </Label>
                                <Select
                                  value={selectedPreviewTemplateId || openingTemplateAssigned || 'none'}
                                  onValueChange={(value) => setSelectedPreviewTemplateId(value === 'none' ? null : value)}
                                >
                                  <SelectTrigger className="w-full">
                                    <SelectValue placeholder="Seleziona un template..." />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="none">-- Seleziona un template --</SelectItem>
                                    {selectedOpeningTemplate && (
                                      <SelectItem value={selectedOpeningTemplate.sid}>
                                        <div className="flex items-center gap-2">
                                          <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-300">
                                            Apertura
                                          </Badge>
                                          <span>{selectedOpeningTemplate.friendlyName}</span>
                                        </div>
                                      </SelectItem>
                                    )}
                                    {agentTemplates
                                      .filter(t => t.sid !== selectedOpeningTemplate?.sid)
                                      .map((template) => (
                                        <SelectItem key={template.sid} value={template.sid}>
                                          <div className="flex items-center gap-2">
                                            <span>{template.friendlyName}</span>
                                            {template.approvalStatus && (
                                              <Badge 
                                                variant="outline" 
                                                className={cn(
                                                  "text-xs",
                                                  template.approvalStatus.toLowerCase() === 'approved' 
                                                    ? "bg-green-50 text-green-700" 
                                                    : "bg-yellow-50 text-yellow-700"
                                                )}
                                              >
                                                {getApprovalStatusLabel(template.approvalStatus)}
                                              </Badge>
                                            )}
                                          </div>
                                        </SelectItem>
                                      ))}
                                  </SelectContent>
                                </Select>
                              </div>

                              <h4 className="font-medium text-gray-700 flex items-center gap-2 pt-2">
                                <Settings className="h-4 w-4" />
                                Variabili del Messaggio
                              </h4>
                              
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                  <Label htmlFor="preview-nome" className="text-sm font-medium">
                                    Nome Lead
                                  </Label>
                                  <Input
                                    id="preview-nome"
                                    value={previewVariables.nomeLead}
                                    onChange={(e) => setPreviewVariables(prev => ({ ...prev, nomeLead: e.target.value }))}
                                    placeholder="Marco Rossi"
                                    className="mt-1"
                                  />
                                </div>
                                <div>
                                  <Label htmlFor="preview-consulente" className="text-sm font-medium">
                                    Nome Consulente
                                  </Label>
                                  <Input
                                    id="preview-consulente"
                                    value={previewVariables.nomeConsulente}
                                    onChange={(e) => setPreviewVariables(prev => ({ ...prev, nomeConsulente: e.target.value }))}
                                    placeholder="Luca"
                                    className="mt-1"
                                  />
                                </div>
                                <div>
                                  <Label htmlFor="preview-business" className="text-sm font-medium">
                                    Business
                                  </Label>
                                  <Input
                                    id="preview-business"
                                    value={previewVariables.business}
                                    onChange={(e) => setPreviewVariables(prev => ({ ...prev, business: e.target.value }))}
                                    placeholder="Palestra Fitness"
                                    className="mt-1"
                                  />
                                </div>
                                <div>
                                  <Label htmlFor="preview-obiettivi" className="text-sm font-medium">
                                    Obiettivi
                                  </Label>
                                  <Input
                                    id="preview-obiettivi"
                                    value={previewVariables.obiettivi}
                                    onChange={(e) => setPreviewVariables(prev => ({ ...prev, obiettivi: e.target.value }))}
                                    placeholder="Perdere peso"
                                    className="mt-1"
                                  />
                                </div>
                                <div className="sm:col-span-2">
                                  <Label htmlFor="preview-desideri" className="text-sm font-medium">
                                    Desideri
                                  </Label>
                                  <Input
                                    id="preview-desideri"
                                    value={previewVariables.desideri}
                                    onChange={(e) => setPreviewVariables(prev => ({ ...prev, desideri: e.target.value }))}
                                    placeholder="Più tempo libero"
                                    className="mt-1"
                                  />
                                </div>
                              </div>

                              <div className="flex gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setPreviewVariables({
                                    nomeLead: "Marco Rossi",
                                    nomeConsulente: selectedAgent?.consultantDisplayName || selectedAgent?.agentName || "Luca",
                                    business: selectedAgent?.businessName || "Palestra Fitness",
                                    obiettivi: selectedAgent?.defaultObiettivi || "Perdere peso",
                                    desideri: selectedAgent?.defaultDesideri || "Più tempo libero",
                                  })}
                                >
                                  <RotateCcw className="h-4 w-4 mr-2" />
                                  Reset Valori
                                </Button>
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        size="sm"
                                        onClick={() => {
                                          if (selectedAgentId) {
                                            const newDefaults = {
                                              defaultObiettivi: previewVariables.obiettivi,
                                              defaultDesideri: previewVariables.desideri,
                                            };
                                            setPendingDefaults(prev => new Map(prev).set(selectedAgentId, newDefaults));
                                            handleSaveDefaults(selectedAgentId);
                                          }
                                        }}
                                        disabled={updateDefaultsMutation.isPending}
                                      >
                                        {updateDefaultsMutation.isPending ? (
                                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                        ) : (
                                          <Save className="h-4 w-4 mr-2" />
                                        )}
                                        Salva come Default
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p>Salva questi valori come predefiniti per questo agente</p>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              </div>
                            </div>

                            <div>
                              <h4 className="font-medium text-gray-700 flex items-center gap-2 mb-3">
                                <MessageSquare className="h-4 w-4" />
                                Anteprima Messaggio
                              </h4>
                              
                              <div className="bg-gradient-to-br from-gray-100 to-gray-200 rounded-xl p-4 min-h-[280px]">
                                {(() => {
                                  const previewTemplateId = selectedPreviewTemplateId || openingTemplateAssigned;
                                  const previewTemplate = agentTemplates.find(t => t.sid === previewTemplateId);
                                  
                                  if (previewTemplate) {
                                    return (
                                      <div className="space-y-3">
                                        <div className="flex items-center gap-2 mb-2">
                                          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-300">
                                            {previewTemplate.friendlyName}
                                          </Badge>
                                        </div>
                                        <div className="bg-[#DCF8C6] text-[#303030] p-4 rounded-lg rounded-tl-none shadow-md max-w-md ml-auto">
                                          {renderPreviewMessage(previewTemplate.bodyText)}
                                          <p className="text-xs text-right text-gray-500 mt-2">
                                            {new Date().toLocaleTimeString("it-IT", {
                                              hour: "2-digit",
                                              minute: "2-digit",
                                            })}
                                            <span className="ml-1">✓✓</span>
                                          </p>
                                        </div>
                                      </div>
                                    );
                                  }
                                  
                                  return (
                                    <div className="flex items-center justify-center h-full text-gray-400">
                                      <div className="text-center">
                                        <MessageSquare className="h-12 w-12 mx-auto mb-2 opacity-50" />
                                        <p>Seleziona un template per vedere l'anteprima</p>
                                      </div>
                                    </div>
                                  );
                                })()}
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </>
                  )}

                  {selectedAgentId && selectedAgent && !isAgentProactive(selectedAgent) && (
                    <Card className="shadow-lg border-2 border-amber-300 bg-gradient-to-br from-amber-50 to-orange-50">
                      <CardContent className="py-12">
                        <div className="text-center max-w-md mx-auto">
                          <Bot className="h-16 w-16 text-amber-500 mx-auto mb-4" />
                          <h3 className="text-xl font-bold text-gray-900 mb-2">
                            Agente Reattivo Selezionato
                          </h3>
                          <p className="text-gray-600 mb-4">
                            Gli agenti reattivi non inviano messaggi proattivi ai lead. 
                            Seleziona un agente proattivo per configurare i template di follow-up.
                          </p>
                          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-300">
                            Questo agente risponde solo ai messaggi in arrivo
                          </Badge>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {!templatesLoading && agentTemplates.length > 0 && (
                    <Collapsible>
                      <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm">
                        <CollapsibleTrigger asChild>
                          <CardHeader className="cursor-pointer hover:bg-gray-50/50 transition-colors">
                            <CardTitle className="flex items-center gap-3 text-lg">
                              <div className="p-2 rounded-lg bg-gradient-to-r from-gray-500 to-slate-500">
                                <FileText className="h-5 w-5 text-white" />
                              </div>
                              Tutti i Template dell'Agente
                              <Badge variant="outline" className="ml-auto">
                                {agentTemplates.length} template
                              </Badge>
                              <ChevronDown className="h-5 w-5 text-gray-500" />
                            </CardTitle>
                          </CardHeader>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <CardContent>
                            <div className="space-y-3">
                              {agentTemplates.map((template) => (
                                <div
                                  key={template.sid}
                                  className="border rounded-lg p-4 bg-gray-50 hover:bg-gray-100 transition-colors"
                                >
                                  <div className="flex items-start justify-between mb-2">
                                    <div>
                                      <span className="font-medium text-gray-900">{template.friendlyName}</span>
                                      <div className="text-xs text-gray-500 mt-1">
                                        SID: <code className="bg-gray-200 px-1 rounded">{template.sid}</code>
                                      </div>
                                    </div>
                                    {template.approvalStatus && (
                                      <Badge className={cn(
                                        "text-xs text-white",
                                        getApprovalStatusColor(template.approvalStatus)
                                      )}>
                                        {getApprovalStatusLabel(template.approvalStatus)}
                                      </Badge>
                                    )}
                                  </div>
                                  <div className="bg-white rounded-md p-3 text-sm text-gray-700 whitespace-pre-wrap border">
                                    {template.bodyText}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </CardContent>
                        </CollapsibleContent>
                      </Card>
                    </Collapsible>
                  )}
                </>
              )}

              {!templatesLoading && !configsLoading && configs.length === 0 && (
                <Card className="shadow-xl border-2 border-dashed border-gray-300 bg-gradient-to-br from-white to-gray-50">
                  <CardContent className="py-16">
                    <div className="text-center max-w-md mx-auto">
                      <Bot className="h-20 w-20 text-gray-400 mx-auto mb-6" />
                      <h3 className="text-2xl font-bold text-gray-900 mb-3">
                        Nessun Agente Configurato
                      </h3>
                      <p className="text-gray-600 mb-6 text-lg">
                        Configura almeno un agente WhatsApp per iniziare a gestire i template.
                      </p>
                      <Button asChild size="lg" className="bg-gradient-to-r from-blue-600 to-purple-600">
                        <Link href="/consultant/whatsapp/agents">
                          <Bot className="h-5 w-5 mr-2" />
                          Configura Agente
                        </Link>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </div>
      </div>
      <ConsultantAIAssistant />
    </div>
  );
}
