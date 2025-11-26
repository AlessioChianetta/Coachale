
import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { getAuthHeaders } from "@/lib/auth";
import { useLocation } from "wouter";
import Navbar from "@/components/navbar";
import Sidebar from "@/components/sidebar";
import { ConsultantAIAssistant } from "@/components/ai-assistant/ConsultantAIAssistant";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertCircle,
  Plus,
  Edit,
  History,
  MoreVertical,
  Eye,
  Copy,
  RotateCcw,
  Trash,
  Loader2,
  FileText,
  MessageSquare,
  Sparkles,
  CheckCircle2,
  Clock,
  XCircle,
  AlertTriangle,
  Filter,
  ExternalLink,
} from "lucide-react";

interface TemplateVersion {
  id: string;
  versionNumber: number;
  bodyText: string;
  twilioContentSid: string | null;
  twilioStatus: "draft" | "pending_approval" | "approved" | "rejected" | null;
  isActive: boolean;
  createdAt: Date;
}

interface CustomTemplate {
  id: string;
  consultantId: string;
  templateName: string;
  templateType: "opening" | "followup_gentle" | "followup_value" | "followup_final";
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
  archivedAt: Date | null;
  activeVersion: TemplateVersion | null;
}

// Helper functions
const getTypeLabel = (type: string) => {
  const labels: Record<string, string> = {
    opening: "Apertura",
    followup_gentle: "Follow-up Gentile",
    followup_value: "Follow-up Valore",
    followup_final: "Follow-up Finale",
  };
  return labels[type] || type;
};

const getTypeConfig = (type: string) => {
  const configs: Record<string, { color: string; gradient: string; icon: string }> = {
    opening: {
      color: "bg-blue-500",
      gradient: "from-blue-500 to-cyan-500",
      icon: "👋",
    },
    followup_gentle: {
      color: "bg-purple-500",
      gradient: "from-purple-500 to-pink-500",
      icon: "💬",
    },
    followup_value: {
      color: "bg-amber-500",
      gradient: "from-amber-500 to-orange-500",
      icon: "💎",
    },
    followup_final: {
      color: "bg-red-500",
      gradient: "from-red-500 to-rose-500",
      icon: "⚡",
    },
  };
  return configs[type] || configs.opening;
};

const getTwilioStatusConfig = (status: string | null) => {
  const configs: Record<string, { label: string; color: string; icon: any }> = {
    draft: {
      label: "Bozza",
      color: "bg-gray-100 text-gray-700 border-gray-200",
      icon: Clock,
    },
    pending_approval: {
      label: "In Approvazione",
      color: "bg-yellow-100 text-yellow-700 border-yellow-200",
      icon: AlertTriangle,
    },
    approved: {
      label: "Approvato",
      color: "bg-green-100 text-green-700 border-green-200",
      icon: CheckCircle2,
    },
    rejected: {
      label: "Rifiutato",
      color: "bg-red-100 text-red-700 border-red-200",
      icon: XCircle,
    },
    not_synced: {
      label: "Non Sincronizzato",
      color: "bg-gray-100 text-gray-700 border-gray-200",
      icon: AlertCircle,
    },
  };
  return configs[status || "not_synced"] || configs.draft;
};

export default function ConsultantWhatsAppCustomTemplatesList() {
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();

  const [selectedType, setSelectedType] = useState<string>("all");
  
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [templateToExport, setTemplateToExport] = useState<string | null>(null);
  const [selectedAgentId, setSelectedAgentId] = useState<string>("");

  // Fetch custom templates
  const { data: templatesData, isLoading, error } = useQuery({
    queryKey: ["/api/whatsapp/custom-templates"],
    queryFn: async () => {
      const response = await fetch("/api/whatsapp/custom-templates", {
        headers: getAuthHeaders(),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to fetch custom templates");
      }
      return response.json();
    },
  });

  const templates: CustomTemplate[] = templatesData?.data || [];

  // Fetch WhatsApp agents
  const { data: agentsData } = useQuery({
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

  // Filter templates based on selected type
  const filteredTemplates = useMemo(() => {
    if (selectedType === "all") {
      return templates;
    }
    return templates.filter((t) => t.templateType === selectedType);
  }, [templates, selectedType]);

  // Calculate stats
  const stats = useMemo(() => {
    return {
      total: templates.length,
      opening: templates.filter((t) => t.templateType === "opening").length,
      followup_gentle: templates.filter((t) => t.templateType === "followup_gentle").length,
      followup_value: templates.filter((t) => t.templateType === "followup_value").length,
      followup_final: templates.filter((t) => t.templateType === "followup_final").length,
      approved: templates.filter((t) => t.activeVersion?.twilioStatus === "approved").length,
      archived: templates.filter((t) => t.archivedAt).length,
    };
  }, [templates]);

  // Archive template mutation
  const archiveMutation = useMutation({
    mutationFn: async (templateId: string) => {
      const response = await fetch(`/api/whatsapp/custom-templates/${templateId}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to archive template");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/custom-templates"] });
      toast({
        title: "✅ Template Archiviato",
        description: "Il template è stato archiviato con successo.",
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

  // Restore template mutation
  const restoreMutation = useMutation({
    mutationFn: async (templateId: string) => {
      const response = await fetch(`/api/whatsapp/custom-templates/${templateId}/restore`, {
        method: "PATCH",
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to restore template");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/custom-templates"] });
      toast({
        title: "✅ Template Ripristinato",
        description: "Il template è stato ripristinato con successo.",
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

  // Export template to Twilio mutation
  const exportMutation = useMutation({
    mutationFn: async ({ templateId, agentConfigId }: { templateId: string; agentConfigId: string }) => {
      const response = await fetch(`/api/whatsapp/custom-templates/${templateId}/export-twilio`, {
        method: "POST",
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ agentConfigId })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to export template to Twilio");
      }

      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/custom-templates"] });
      toast({
        title: "✅ Template Esportato",
        description: data.message || "Il template è stato inviato a Twilio per l'approvazione Meta.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "❌ Errore Export",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Action handlers
  const handleEdit = (templateId: string) => {
    navigate(`/consultant/whatsapp/custom-templates?id=${templateId}`);
  };

  const handleViewVersions = (templateId: string) => {
    toast({
      title: "🚧 In Sviluppo",
      description: "La pagina delle versioni sarà disponibile presto.",
    });
  };

  const handlePreview = (templateId: string) => {
    toast({
      title: "🚧 In Sviluppo",
      description: "L'anteprima sarà disponibile presto.",
    });
  };

  const handleDuplicate = (templateId: string) => {
    toast({
      title: "🚧 In Sviluppo",
      description: "La funzione di duplicazione sarà disponibile presto.",
    });
  };

  const handleArchive = (templateId: string) => {
    archiveMutation.mutate(templateId);
  };

  const handleRestore = (templateId: string) => {
    restoreMutation.mutate(templateId);
  };

  const handleExportToTwilio = (templateId: string) => {
    if (agents.length === 0) {
      toast({
        title: "❌ Errore",
        description: "Configura prima un agente WhatsApp nella sezione Agenti",
        variant: "destructive"
      });
      return;
    }
    if (agents.length === 1) {
      exportMutation.mutate({ templateId, agentConfigId: agents[0].id });
    } else {
      setTemplateToExport(templateId);
      setSelectedAgentId(agents[0].id);
      setExportDialogOpen(true);
    }
  };

  // Empty state
  const showEmptyState = !isLoading && templates.length === 0;
  const showNoResults = !isLoading && templates.length > 0 && filteredTemplates.length === 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-purple-50/20">
      {isMobile && <Navbar onMenuClick={() => setSidebarOpen(true)} />}
      <div className={`flex ${isMobile ? 'h-[calc(100vh-80px)]' : 'h-screen'}`}>
        <Sidebar
          role="consultant"
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />
        <div className="flex-1 overflow-y-auto">
          <div className="container mx-auto p-6 max-w-7xl">
          {/* Modern Header with Gradient */}
          <div className="relative mb-8 overflow-hidden rounded-2xl bg-gradient-to-br from-blue-600 via-purple-600 to-indigo-700 p-8 text-white shadow-2xl">
            <div className="absolute inset-0 bg-grid-white/10 [mask-image:linear-gradient(0deg,transparent,black)]" />
            <div className="relative z-10">
              <div className="flex items-start justify-between gap-4 mb-6">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                      <MessageSquare className="h-6 w-6" />
                    </div>
                    <div>
                      <h1 className="text-3xl font-bold tracking-tight">Template Custom WhatsApp</h1>
                      <p className="text-blue-100 text-sm mt-1">
                        Gestisci i tuoi template personalizzati per WhatsApp Business
                      </p>
                    </div>
                  </div>

                  {/* Stats Pills */}
                  {!showEmptyState && (
                    <div className="flex flex-wrap gap-2 mt-4">
                      <div className="px-3 py-1.5 rounded-full bg-white/20 backdrop-blur-sm text-xs font-medium flex items-center gap-1.5">
                        <FileText className="h-3.5 w-3.5" />
                        <span>{stats.total} totali</span>
                      </div>
                      <div className="px-3 py-1.5 rounded-full bg-green-500/30 backdrop-blur-sm text-xs font-medium flex items-center gap-1.5">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        <span>{stats.approved} approvati</span>
                      </div>
                      {stats.archived > 0 && (
                        <div className="px-3 py-1.5 rounded-full bg-gray-500/30 backdrop-blur-sm text-xs font-medium flex items-center gap-1.5">
                          <Clock className="h-3.5 w-3.5" />
                          <span>{stats.archived} archiviati</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <Button
                  onClick={() => navigate("/consultant/whatsapp/custom-templates")}
                  size="lg"
                  className="bg-white text-blue-600 hover:bg-blue-50 shadow-lg hover:shadow-xl transition-all duration-200"
                >
                  <Plus className="h-5 w-5 mr-2" />
                  Crea Nuovo Template
                </Button>
              </div>
            </div>
          </div>

          {/* Filter Section */}
          {!showEmptyState && (
            <div className="mb-6 bg-white rounded-xl shadow-sm border p-5">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                <div className="flex items-center gap-3 flex-1">
                  <Filter className="h-5 w-5 text-muted-foreground" />
                  <label className="text-sm font-medium text-foreground">Filtra per tipo:</label>
                  <Select value={selectedType} onValueChange={setSelectedType}>
                    <SelectTrigger className="w-[280px] border-2 focus:ring-2 focus:ring-purple-500/20">
                      <SelectValue placeholder="Seleziona tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">
                        <div className="flex items-center gap-2">
                          <Sparkles className="h-4 w-4 text-purple-500" />
                          <span>Tutti i Template ({stats.total})</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="opening">
                        <div className="flex items-center gap-2">
                          <span>👋</span>
                          <span>Apertura ({stats.opening})</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="followup_gentle">
                        <div className="flex items-center gap-2">
                          <span>💬</span>
                          <span>Follow-up Gentile ({stats.followup_gentle})</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="followup_value">
                        <div className="flex items-center gap-2">
                          <span>💎</span>
                          <span>Follow-up Valore ({stats.followup_value})</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="followup_final">
                        <div className="flex items-center gap-2">
                          <span>⚡</span>
                          <span>Follow-up Finale ({stats.followup_final})</span>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {filteredTemplates.length > 0 && (
                  <Badge variant="secondary" className="text-sm">
                    {filteredTemplates.length} risultat{filteredTemplates.length !== 1 ? "i" : "o"}
                  </Badge>
                )}
              </div>
            </div>
          )}

          {/* Loading State */}
          {isLoading && (
            <div className="flex flex-col items-center justify-center py-20">
              <Loader2 className="h-12 w-12 animate-spin text-purple-600 mb-4" />
              <p className="text-sm text-muted-foreground">Caricamento template...</p>
            </div>
          )}

          {/* Error State */}
          {error && (
            <Alert variant="destructive" className="shadow-lg">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Errore nel caricamento dei template: {error.message}
              </AlertDescription>
            </Alert>
          )}

          {/* Empty State - No templates at all */}
          {showEmptyState && (
            <div className="text-center py-20 bg-white rounded-2xl shadow-sm border">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center mx-auto mb-6">
                <FileText className="h-10 w-10 text-white" />
              </div>
              <h2 className="text-2xl font-bold mb-3">Nessun Template Trovato</h2>
              <p className="text-muted-foreground mb-8 max-w-md mx-auto">
                Non hai ancora creato nessun template custom. Inizia creando il tuo primo template personalizzato per WhatsApp Business!
              </p>
              <Button
                onClick={() => navigate("/consultant/whatsapp/custom-templates")}
                size="lg"
                className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
              >
                <Plus className="h-5 w-5 mr-2" />
                Crea il Tuo Primo Template
              </Button>
            </div>
          )}

          {/* No Results State - Filter returns nothing */}
          {showNoResults && (
            <div className="text-center py-20 bg-white rounded-2xl shadow-sm border">
              <AlertCircle className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <h2 className="text-2xl font-semibold mb-2">Nessun Template Trovato</h2>
              <p className="text-muted-foreground mb-6">
                Nessun template trovato per questo tipo. Prova a selezionare un filtro diverso.
              </p>
              <Button variant="outline" onClick={() => setSelectedType("all")}>
                Mostra Tutti i Template
              </Button>
            </div>
          )}

          {/* Templates Grid - Modern Cards */}
          {!isLoading && filteredTemplates.length > 0 && (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {filteredTemplates.map((template) => {
                const typeConfig = getTypeConfig(template.templateType);
                const statusConfig = getTwilioStatusConfig(template.activeVersion?.twilioStatus || null);
                const StatusIcon = statusConfig.icon;

                return (
                  <Card
                    key={template.id}
                    className={`group relative overflow-hidden border-2 transition-all duration-300 hover:shadow-2xl hover:-translate-y-1 ${
                      template.archivedAt ? "opacity-60 hover:opacity-100" : ""
                    }`}
                  >
                    {/* Gradient Header */}
                    <div className={`absolute top-0 left-0 right-0 h-2 bg-gradient-to-r ${typeConfig.gradient}`} />

                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3 flex-1 min-w-0">
                          {/* Icon */}
                          <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${typeConfig.gradient} flex items-center justify-center text-2xl flex-shrink-0 shadow-lg`}>
                            {typeConfig.icon}
                          </div>

                          {/* Title & Description */}
                          <div className="flex-1 min-w-0">
                            <CardTitle className="text-lg truncate group-hover:text-purple-600 transition-colors">
                              {template.templateName}
                            </CardTitle>
                            <CardDescription className="line-clamp-2 text-xs mt-1">
                              {template.description || "Nessuna descrizione"}
                            </CardDescription>
                          </div>
                        </div>

                        {/* More Menu */}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handlePreview(template.id)}>
                              <Eye className="h-4 w-4 mr-2" />
                              Anteprima
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleDuplicate(template.id)}>
                              <Copy className="h-4 w-4 mr-2" />
                              Duplica
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem 
                              onClick={() => handleExportToTwilio(template.id)}
                              disabled={!template.activeVersion || exportMutation.isPending}
                            >
                              <ExternalLink className="h-4 w-4 mr-2" />
                              {exportMutation.isPending ? "Esportazione..." : "Esporta a Twilio"}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            {template.archivedAt ? (
                              <DropdownMenuItem onClick={() => handleRestore(template.id)}>
                                <RotateCcw className="h-4 w-4 mr-2" />
                                Ripristina
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem
                                className="text-destructive"
                                onClick={() => handleArchive(template.id)}
                              >
                                <Trash className="h-4 w-4 mr-2" />
                                Archivia
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>

                      {/* Badges */}
                      <div className="flex flex-wrap gap-2 mt-3">
                        <Badge variant="outline" className={`${typeConfig.color} text-white border-0 shadow-sm`}>
                          {getTypeLabel(template.templateType)}
                        </Badge>
                        {template.archivedAt && (
                          <Badge variant="secondary" className="border">
                            Archiviato
                          </Badge>
                        )}
                      </div>
                    </CardHeader>

                    <CardContent className="pt-0">
                      {/* Active Version Display */}
                      {template.activeVersion ? (
                        <div className="space-y-3">
                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span className="font-medium">Versione v{template.activeVersion.versionNumber}</span>
                            <Badge variant="outline" className={`${statusConfig.color} border text-xs`}>
                              <StatusIcon className="h-3 w-3 mr-1" />
                              {statusConfig.label}
                            </Badge>
                          </div>

                          {/* Message Preview */}
                          <div className="space-y-2">
                            <div className="text-sm bg-gradient-to-br from-slate-50 to-blue-50/30 p-4 rounded-lg border border-slate-200/60 font-mono text-slate-700 leading-relaxed min-h-[100px] break-words whitespace-pre-wrap">
                              {template.activeVersion.bodyText.split(/(\{[a-zA-Z0-9_]+\})/).map((part, idx) => {
                                if (part.match(/^\{[a-zA-Z0-9_]+\}$/)) {
                                  return (
                                    <span key={idx} className="bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-semibold">
                                      {part}
                                    </span>
                                  );
                                }
                                return <span key={idx}>{part}</span>;
                              })}
                            </div>
                            <div className="flex justify-end">
                              <span className="text-xs text-slate-400">
                                {template.activeVersion.bodyText.length} caratteri
                              </span>
                            </div>
                          </div>

                          {/* Action Buttons */}
                          <div className="flex gap-2 pt-2">
                            <Button
                              size="sm"
                              onClick={() => handleEdit(template.id)}
                              className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                            >
                              <Edit className="h-3.5 w-3.5 mr-1.5" />
                              Modifica
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleViewVersions(template.id)}
                              className="flex-1 border-purple-200 hover:bg-purple-50 hover:border-purple-300"
                            >
                              <History className="h-3.5 w-3.5 mr-1.5" />
                              Versioni
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <Alert className="bg-amber-50 border-amber-200">
                          <AlertCircle className="h-4 w-4 text-amber-600" />
                          <AlertDescription className="text-amber-800 text-sm">
                            Nessuna versione attiva
                          </AlertDescription>
                        </Alert>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
        </div>

        {/* Agent Selection Dialog */}
        <Dialog open={exportDialogOpen} onOpenChange={setExportDialogOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Esporta Template a Twilio</DialogTitle>
              <DialogDescription>
                Seleziona l'agente WhatsApp e visualizza l'anteprima del template con i dati dell'agente
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-6">
              {/* Agent Selection */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Agente WhatsApp</label>
                <Select value={selectedAgentId} onValueChange={setSelectedAgentId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleziona agente" />
                  </SelectTrigger>
                  <SelectContent>
                    {agents.map(agent => (
                      <SelectItem key={agent.id} value={agent.id}>
                        {agent.agentName} ({agent.twilioWhatsappNumber})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Preview Table */}
              {selectedAgentId && templateToExport && (() => {
                const template = templates.find(t => t.id === templateToExport);
                const selectedAgent = agents.find(a => a.id === selectedAgentId);
                
                if (!template?.activeVersion || !selectedAgent) return null;

                // Helper function to resolve template variables
                const resolveTemplate = (text: string) => {
                  let resolved = text;
                  
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
                  Object.entries(sampleData).forEach(([key, value]) => {
                    resolved = resolved.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
                  });

                  return resolved;
                };

                const previewText = resolveTemplate(template.activeVersion.bodyText);

                return (
                  <div className="space-y-4">
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
                            <td className="p-3 text-sm">{selectedAgent.agentName}</td>
                          </tr>
                          <tr>
                            <td className="p-3 text-sm font-medium">Numero WhatsApp</td>
                            <td className="p-3 text-sm font-mono">{selectedAgent.twilioWhatsappNumber}</td>
                          </tr>
                          <tr>
                            <td className="p-3 text-sm font-medium">Nome Consulente</td>
                            <td className="p-3 text-sm">{selectedAgent.consultantDisplayName || <span className="text-muted-foreground italic">Non configurato</span>}</td>
                          </tr>
                          <tr>
                            <td className="p-3 text-sm font-medium">Nome Business</td>
                            <td className="p-3 text-sm">{selectedAgent.businessName || <span className="text-muted-foreground italic">Non configurato</span>}</td>
                          </tr>
                          {selectedAgent.defaultObiettivi && (
                            <tr>
                              <td className="p-3 text-sm font-medium">Obiettivi Default</td>
                              <td className="p-3 text-sm max-w-md truncate" title={selectedAgent.defaultObiettivi}>
                                {selectedAgent.defaultObiettivi}
                              </td>
                            </tr>
                          )}
                          {selectedAgent.defaultDesideri && (
                            <tr>
                              <td className="p-3 text-sm font-medium">Desideri Default</td>
                              <td className="p-3 text-sm max-w-md truncate" title={selectedAgent.defaultDesideri}>
                                {selectedAgent.defaultDesideri}
                              </td>
                            </tr>
                          )}
                          {selectedAgent.defaultUncino && (
                            <tr>
                              <td className="p-3 text-sm font-medium">Uncino Default</td>
                              <td className="p-3 text-sm max-w-md truncate" title={selectedAgent.defaultUncino}>
                                {selectedAgent.defaultUncino}
                              </td>
                            </tr>
                          )}
                          {selectedAgent.defaultIdealState && (
                            <tr>
                              <td className="p-3 text-sm font-medium">Stato Ideale Default</td>
                              <td className="p-3 text-sm max-w-md truncate" title={selectedAgent.defaultIdealState}>
                                {selectedAgent.defaultIdealState}
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
                        Anteprima Messaggio (con dati di esempio)
                      </label>
                      <div className="bg-gradient-to-br from-slate-50 to-blue-50/30 p-4 rounded-lg border border-slate-200/60">
                        <p className="text-sm whitespace-pre-wrap font-mono leading-relaxed">
                          {previewText}
                        </p>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        💡 I valori mostrati sono esempi. Quando invii il messaggio, verranno sostituiti con i dati reali del lead.
                      </p>
                    </div>
                  </div>
                );
              })()}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setExportDialogOpen(false)}>
                Annulla
              </Button>
              <Button 
                onClick={() => {
                  exportMutation.mutate({ 
                    templateId: templateToExport!, 
                    agentConfigId: selectedAgentId 
                  });
                  setExportDialogOpen(false);
                }}
                disabled={!selectedAgentId}
              >
                Esporta a Twilio
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <ConsultantAIAssistant />
      </div>
    </div>
  );
}
