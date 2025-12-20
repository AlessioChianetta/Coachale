import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { 
  MessageSquare, 
  Phone,
  Loader2,
  Plus,
  Trash2,
  Sparkles,
  Edit,
  Bot,
  Users,
  Lightbulb,
  MessageCircle,
  BarChart3,
  FileText,
  Zap,
  Database,
  Info,
  Mail,
  ClipboardCheck
} from "lucide-react";
import WhatsAppLayout from "@/components/whatsapp/WhatsAppLayout";
import { getAuthHeaders } from "@/lib/auth";
import { ConsultantAIAssistant } from "@/components/ai-assistant/ConsultantAIAssistant";
import { whatsappAgentIdeas } from "@/data/whatsapp-agent-ideas";

interface WhatsAppConfig {
  id?: string;
  agentName: string;
  twilioAccountSid: string;
  twilioAuthToken: string;
  twilioWhatsappNumber: string;
  autoResponseEnabled: boolean;
  agentType?: "reactive_lead" | "proactive_setter" | "informative_advisor" | "customer_success" | "intake_coordinator";
  integrationMode?: "whatsapp_ai" | "ai_only";
  isProactiveAgent?: boolean;
  businessName?: string;
  aiPersonality?: string;
  isDryRun?: boolean;
}

export default function ConsultantWhatsAppPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [configToDelete, setConfigToDelete] = useState<WhatsAppConfig | null>(null);

  const { data: existingConfigs, isLoading } = useQuery({
    queryKey: ["/api/whatsapp/config"],
    queryFn: async () => {
      const response = await fetch("/api/whatsapp/config", {
        headers: getAuthHeaders(),
      });
      if (!response.ok) {
        if (response.status === 404) return { configs: [] };
        throw new Error("Failed to fetch WhatsApp config");
      }
      return response.json();
    },
  });

  const configs: WhatsAppConfig[] = existingConfigs?.configs || [];
  const activeAgents = configs.filter(c => c.autoResponseEnabled).length;

  const deleteMutation = useMutation({
    mutationFn: async (configId: string) => {
      const response = await fetch(`/api/whatsapp/config/${configId}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to delete configuration");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/config"] });
      setIsDeleteDialogOpen(false);
      setConfigToDelete(null);
      toast({
        title: "✅ Agente eliminato",
        description: "La configurazione dell'agente è stata eliminata con successo.",
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

  const handleAddNew = () => navigate("/consultant/whatsapp/agent/new");
  const handleEdit = (config: WhatsAppConfig) => navigate(`/consultant/whatsapp/agent/${config.id}`);
  const handleChat = (config: WhatsAppConfig) => navigate(`/consultant/whatsapp-agents-chat?agent=${config.id}`);
  const handleDelete = (config: WhatsAppConfig) => {
    setConfigToDelete(config);
    setIsDeleteDialogOpen(true);
  };
  const handleConfirmDelete = () => {
    if (configToDelete?.id) {
      deleteMutation.mutate(configToDelete.id);
    }
  };

  const getAgentTypeBadge = (agentType?: string) => {
    switch (agentType) {
      case "proactive_setter":
        return { label: "🎯 Setter", className: "bg-emerald-100 text-emerald-700 border-emerald-300 dark:bg-emerald-900/30 dark:text-emerald-300" };
      case "informative_advisor":
        return { label: "📚 Educativo", className: "bg-purple-100 text-purple-700 border-purple-300 dark:bg-purple-900/30 dark:text-purple-300" };
      case "customer_success":
        return { label: "💜 Customer Success", className: "bg-pink-100 text-pink-700 border-pink-300 dark:bg-pink-900/30 dark:text-pink-300" };
      case "intake_coordinator":
        return { label: "📋 Intake", className: "bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-900/30 dark:text-amber-300" };
      default:
        return { label: "📞 Receptionist", className: "bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-900/30 dark:text-blue-300" };
    }
  };

  return (
    <WhatsAppLayout 
      title="Gestione Agenti WhatsApp"
      description="Dashboard per gestire i tuoi agenti AI WhatsApp"
      actions={
        <Button onClick={handleAddNew} className="bg-green-600 hover:bg-green-700">
          <Plus className="h-4 w-4 mr-2" />
          Crea Agente
        </Button>
      }
    >
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* QUICK ACCESS SECTION */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Button
            variant="outline"
            className="h-auto py-4 flex items-center gap-3 justify-start hover:bg-blue-50 dark:hover:bg-blue-950/20 border-2"
            onClick={() => navigate("/consultant/whatsapp-conversations")}
          >
            <div className="bg-blue-100 dark:bg-blue-900/30 p-2.5 rounded-lg">
              <MessageSquare className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="text-left">
              <p className="font-semibold">Conversazioni</p>
              <p className="text-xs text-gray-500">Visualizza chat attive</p>
            </div>
          </Button>
          
          <Button
            variant="outline"
            className="h-auto py-4 flex items-center gap-3 justify-start hover:bg-purple-50 dark:hover:bg-purple-950/20 border-2"
            onClick={() => navigate("/consultant/whatsapp-templates")}
          >
            <div className="bg-purple-100 dark:bg-purple-900/30 p-2.5 rounded-lg">
              <FileText className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div className="text-left">
              <p className="font-semibold">Template</p>
              <p className="text-xs text-gray-500">Gestisci template messaggi</p>
            </div>
          </Button>
          
          <Button
            variant="outline"
            className="h-auto py-4 flex items-center gap-3 justify-start hover:bg-orange-50 dark:hover:bg-orange-950/20 border-2"
            onClick={() => navigate("/consultant/file-search-analytics")}
          >
            <div className="bg-orange-100 dark:bg-orange-900/30 p-2.5 rounded-lg">
              <BarChart3 className="h-5 w-5 text-orange-600 dark:text-orange-400" />
            </div>
            <div className="text-left">
              <p className="font-semibold">File Search Analytics</p>
              <p className="text-xs text-gray-500">Statistiche knowledge base</p>
            </div>
          </Button>
        </div>

        {/* STATS CARDS */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20 border-green-200 dark:border-green-800">
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="bg-green-100 dark:bg-green-900/40 p-2 rounded-lg">
                  <Bot className="h-5 w-5 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-green-700 dark:text-green-300">{activeAgents}</p>
                  <p className="text-xs text-green-600 dark:text-green-400">Agenti Attivi</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 border-blue-200 dark:border-blue-800">
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="bg-blue-100 dark:bg-blue-900/40 p-2 rounded-lg">
                  <MessageCircle className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">{configs.length}</p>
                  <p className="text-xs text-blue-600 dark:text-blue-400">Agenti Totali</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-purple-50 to-violet-50 dark:from-purple-950/20 dark:to-violet-950/20 border-purple-200 dark:border-purple-800">
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="bg-purple-100 dark:bg-purple-900/40 p-2 rounded-lg">
                  <Users className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-purple-700 dark:text-purple-300">-</p>
                  <p className="text-xs text-purple-600 dark:text-purple-400">Lead Generati</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20 border-amber-200 dark:border-amber-800">
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="bg-amber-100 dark:bg-amber-900/40 p-2 rounded-lg">
                  <Database className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-amber-700 dark:text-amber-300">-</p>
                  <p className="text-xs text-amber-600 dark:text-amber-400">Token Knowledge</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* TABS SECTION */}
        <Tabs defaultValue="custom" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3 gap-2">
            <TabsTrigger value="custom" className="data-[state=active]:bg-green-100 data-[state=active]:text-green-700">
              <Bot className="h-4 w-4 mr-2" />
              Agenti Personalizzati
            </TabsTrigger>
            <TabsTrigger value="system" className="data-[state=active]:bg-blue-100 data-[state=active]:text-blue-700">
              <Users className="h-4 w-4 mr-2" />
              Agenti di Sistema
            </TabsTrigger>
            <TabsTrigger value="ideas" className="data-[state=active]:bg-purple-100 data-[state=active]:text-purple-700">
              <Lightbulb className="h-4 w-4 mr-2" />
              Idee AI
            </TabsTrigger>
          </TabsList>

          {/* TAB: AGENTI PERSONALIZZATI */}
          <TabsContent value="custom" className="space-y-6">
            {isLoading ? (
              <div className="flex justify-center items-center p-12">
                <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
              </div>
            ) : configs.length === 0 ? (
              <Card className="border-dashed border-2">
                <CardContent className="flex flex-col items-center justify-center p-12">
                  <Bot className="h-16 w-16 text-gray-400 mb-4" />
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                    Nessun agente configurato
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 text-center mb-6">
                    Crea il tuo primo agente WhatsApp AI per iniziare a gestire conversazioni automatizzate.
                  </p>
                  <Button onClick={handleAddNew} className="bg-green-600 hover:bg-green-700">
                    <Plus className="h-4 w-4 mr-2" />
                    Crea Primo Agente
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {configs.map((config) => {
                  const typeBadge = getAgentTypeBadge(config.agentType);
                  return (
                    <Card 
                      key={config.id} 
                      className="group hover:shadow-lg transition-all duration-200 hover:border-green-300 dark:hover:border-green-700"
                    >
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-3">
                            <div className="bg-gradient-to-br from-green-100 to-emerald-100 dark:from-green-900/40 dark:to-emerald-900/40 p-2.5 rounded-xl">
                              <Bot className="h-5 w-5 text-green-600 dark:text-green-400" />
                            </div>
                            <div>
                              <CardTitle className="text-base truncate max-w-[180px]">
                                {config.agentName}
                              </CardTitle>
                              {config.businessName && (
                                <p className="text-xs text-gray-500 truncate max-w-[180px]">
                                  {config.businessName}
                                </p>
                              )}
                            </div>
                          </div>
                          <Badge 
                            className={config.autoResponseEnabled
                              ? "bg-green-100 text-green-700 border-green-300 dark:bg-green-900/30 dark:text-green-300"
                              : "bg-gray-100 text-gray-600 border-gray-300 dark:bg-gray-800 dark:text-gray-400"
                            }
                          >
                            {config.autoResponseEnabled ? "Attivo" : "Pausa"}
                          </Badge>
                        </div>
                        
                        <div className="flex flex-wrap gap-1.5 mt-3">
                          <Badge variant="outline" className={typeBadge.className}>
                            {typeBadge.label}
                          </Badge>
                          {config.isProactiveAgent && (
                            <Badge variant="outline" className="bg-orange-100 text-orange-700 border-orange-300 dark:bg-orange-900/30 dark:text-orange-300">
                              <Zap className="h-3 w-3 mr-1" />
                              Proattivo
                            </Badge>
                          )}
                          {config.integrationMode === "ai_only" && (
                            <Badge variant="outline" className="bg-violet-100 text-violet-700 border-violet-300 dark:bg-violet-900/30 dark:text-violet-300">
                              🤖 Solo AI
                            </Badge>
                          )}
                          {(config.isDryRun ?? true) && (
                            <Badge variant="outline" className="bg-yellow-100 text-yellow-700 border-yellow-300 dark:bg-yellow-900/30 dark:text-yellow-300">
                              🧪 Test
                            </Badge>
                          )}
                        </div>
                      </CardHeader>
                      
                      <CardContent className="pt-0">
                        <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3 mb-4">
                          <div className="flex items-center gap-2 text-sm">
                            <Phone className="h-4 w-4 text-gray-500" />
                            <span className="font-mono text-xs truncate">
                              {config.twilioWhatsappNumber || "Non configurato"}
                            </span>
                          </div>
                          {config.aiPersonality && (
                            <div className="flex items-center gap-2 text-sm mt-2">
                              <Sparkles className="h-4 w-4 text-purple-500" />
                              <span className="text-xs capitalize text-gray-600 dark:text-gray-400">
                                {config.aiPersonality.replace(/_/g, " ")}
                              </span>
                            </div>
                          )}
                        </div>
                        
                        <div className="grid grid-cols-3 gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEdit(config)}
                            className="text-blue-600 border-blue-200 hover:bg-blue-50 dark:text-blue-400 dark:border-blue-800 dark:hover:bg-blue-950/20"
                          >
                            <Edit className="h-4 w-4 mr-1" />
                            Configura
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleChat(config)}
                            className="text-green-600 border-green-200 hover:bg-green-50 dark:text-green-400 dark:border-green-800 dark:hover:bg-green-950/20"
                          >
                            <MessageCircle className="h-4 w-4 mr-1" />
                            Chat
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDelete(config)}
                            className="text-red-600 border-red-200 hover:bg-red-50 dark:text-red-400 dark:border-red-800 dark:hover:bg-red-950/20"
                          >
                            <Trash2 className="h-4 w-4 mr-1" />
                            Elimina
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* TAB: AGENTI DI SISTEMA */}
          <TabsContent value="system" className="space-y-6">
            <Alert className="bg-blue-50 border-blue-200 dark:bg-blue-950/20 dark:border-blue-800">
              <Info className="h-5 w-5 text-blue-600" />
              <AlertDescription>
                <strong>Agenti AI di Sistema</strong><br />
                Questi agenti sono preconfigurati e gestiti automaticamente dal sistema. Non possono essere modificati o eliminati.
              </AlertDescription>
            </Alert>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {/* Millie - AI Email Writer */}
              <Card className="relative overflow-hidden border-2 border-purple-200 dark:border-purple-800 bg-gradient-to-br from-purple-50 via-pink-50 to-white dark:from-purple-950/30 dark:via-pink-950/30 dark:to-gray-900 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 rounded-2xl">
                <CardHeader className="text-center pt-6 pb-3">
                  <CardTitle className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent mb-2">
                    Millie
                  </CardTitle>
                  <p className="text-base font-bold text-purple-700 dark:text-purple-400 mb-4">
                    AI Email Writer
                  </p>
                  <div className="flex justify-center mb-4">
                    <div className="relative">
                      <div className="w-24 h-24 rounded-full bg-gradient-to-br from-purple-100 to-pink-100 dark:from-purple-900/30 dark:to-pink-900/30 flex items-center justify-center shadow-lg">
                        <Mail className="h-12 w-12 text-purple-600 dark:text-purple-400" />
                      </div>
                      <Badge className="absolute -top-1 -right-1 bg-gray-500 text-white text-xs px-2 py-0.5">
                        Sistema
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pb-6 px-6">
                  <div className="space-y-2 mb-4">
                    <div className="bg-white dark:bg-gray-800/80 rounded-lg px-3 py-2 border border-purple-200/50">
                      <p className="text-sm text-gray-800 dark:text-gray-200">✓ Email Giornaliere AI</p>
                    </div>
                    <div className="bg-white dark:bg-gray-800/80 rounded-lg px-3 py-2 border border-purple-200/50">
                      <p className="text-sm text-gray-800 dark:text-gray-200">✓ Personalizzate per Cliente</p>
                    </div>
                    <div className="bg-white dark:bg-gray-800/80 rounded-lg px-3 py-2 border border-purple-200/50">
                      <p className="text-sm text-gray-800 dark:text-gray-200">✓ Journey Automatico</p>
                    </div>
                  </div>
                  <Button
                    className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white"
                    onClick={() => navigate('/consultant/ai-config')}
                  >
                    Gestisci Email Journey
                  </Button>
                </CardContent>
              </Card>

              {/* Echo - AI Consultation Summarizer */}
              <Card className="relative overflow-hidden border-2 border-orange-200 dark:border-orange-800 bg-gradient-to-br from-orange-50 via-amber-50 to-white dark:from-orange-950/30 dark:via-amber-950/30 dark:to-gray-900 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 rounded-2xl">
                <CardHeader className="text-center pt-6 pb-3">
                  <CardTitle className="text-2xl font-bold bg-gradient-to-r from-orange-600 to-amber-600 bg-clip-text text-transparent mb-2">
                    Echo
                  </CardTitle>
                  <p className="text-base font-bold text-orange-700 dark:text-orange-400 mb-4">
                    AI Consultation Summarizer
                  </p>
                  <div className="flex justify-center mb-4">
                    <div className="relative">
                      <div className="w-24 h-24 rounded-full bg-gradient-to-br from-orange-100 to-amber-100 dark:from-orange-900/30 dark:to-amber-900/30 flex items-center justify-center shadow-lg">
                        <ClipboardCheck className="h-12 w-12 text-orange-600 dark:text-orange-400" />
                      </div>
                      <Badge className="absolute -top-1 -right-1 bg-gray-500 text-white text-xs px-2 py-0.5">
                        Sistema
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pb-6 px-6">
                  <div className="space-y-2 mb-4">
                    <div className="bg-white dark:bg-gray-800/80 rounded-lg px-3 py-2 border border-orange-200/50">
                      <p className="text-sm text-gray-800 dark:text-gray-200">✓ Riepiloghi Consulenze AI</p>
                    </div>
                    <div className="bg-white dark:bg-gray-800/80 rounded-lg px-3 py-2 border border-orange-200/50">
                      <p className="text-sm text-gray-800 dark:text-gray-200">✓ Email Personalizzate</p>
                    </div>
                    <div className="bg-white dark:bg-gray-800/80 rounded-lg px-3 py-2 border border-orange-200/50">
                      <p className="text-sm text-gray-800 dark:text-gray-200">✓ Da Trascrizioni Fathom</p>
                    </div>
                  </div>
                  <Button
                    className="w-full bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white"
                    onClick={() => navigate('/consultant/appointments')}
                  >
                    Gestisci Consulenze
                  </Button>
                </CardContent>
              </Card>

              {/* Spec - AI Researcher */}
              <Card className="relative overflow-hidden border-2 border-cyan-200 dark:border-cyan-800 bg-gradient-to-br from-cyan-50 via-blue-50 to-white dark:from-cyan-950/30 dark:via-blue-950/30 dark:to-gray-900 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 rounded-2xl">
                <CardHeader className="text-center pt-6 pb-3">
                  <CardTitle className="text-2xl font-bold bg-gradient-to-r from-cyan-600 to-blue-600 bg-clip-text text-transparent mb-2">
                    Spec
                  </CardTitle>
                  <p className="text-base font-bold text-cyan-700 dark:text-cyan-400 mb-4">
                    AI Researcher
                  </p>
                  <div className="flex justify-center mb-4">
                    <div className="relative">
                      <div className="w-24 h-24 rounded-full bg-gradient-to-br from-cyan-100 to-blue-100 dark:from-cyan-900/30 dark:to-blue-900/30 flex items-center justify-center shadow-lg">
                        <Bot className="h-12 w-12 text-cyan-600 dark:text-cyan-400" />
                      </div>
                      <Badge className="absolute -top-1 -right-1 bg-gray-500 text-white text-xs px-2 py-0.5">
                        Sistema
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pb-6 px-6">
                  <div className="space-y-2 mb-4">
                    <div className="bg-white dark:bg-gray-800/80 rounded-lg px-3 py-2 border border-cyan-200/50">
                      <p className="text-sm text-gray-800 dark:text-gray-200">✓ Supporto Clienti 24/7</p>
                    </div>
                    <div className="bg-white dark:bg-gray-800/80 rounded-lg px-3 py-2 border border-cyan-200/50">
                      <p className="text-sm text-gray-800 dark:text-gray-200">✓ Risposte su Esercizi</p>
                    </div>
                    <div className="bg-white dark:bg-gray-800/80 rounded-lg px-3 py-2 border border-cyan-200/50">
                      <p className="text-sm text-gray-800 dark:text-gray-200">✓ Guida ai Materiali</p>
                    </div>
                  </div>
                  <Button
                    className="w-full bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white"
                    onClick={() => navigate('/client/ai-assistant')}
                  >
                    Area Clienti
                  </Button>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* TAB: IDEE AI */}
          <TabsContent value="ideas" className="space-y-6">
            <Card className="border-green-100 dark:border-green-900/30 bg-gradient-to-br from-green-50/50 to-emerald-50/50 dark:from-green-950/10 dark:to-emerald-950/10">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="bg-green-100 dark:bg-green-900/30 p-2.5 rounded-lg">
                    <Lightbulb className="h-6 w-6 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <CardTitle className="text-xl">Idee per Agenti AI</CardTitle>
                    <CardDescription className="mt-1">
                      13 categorie di business con 130 idee di agenti già pronte all'uso
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Accordion type="single" collapsible className="w-full space-y-2">
                  {whatsappAgentIdeas.map((category) => (
                    <AccordionItem 
                      key={category.id} 
                      value={category.id}
                      className="border border-gray-200 dark:border-gray-700 rounded-lg px-4 bg-white dark:bg-gray-800/50"
                    >
                      <AccordionTrigger className="hover:no-underline py-4">
                        <div className="flex items-center gap-3 text-left">
                          <span className="text-2xl">{category.icon}</span>
                          <div>
                            <h3 className="font-semibold text-base">{category.title}</h3>
                            <p className="text-sm text-gray-600 dark:text-gray-400 font-normal mt-0.5">
                              {category.description}
                            </p>
                          </div>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="pb-4 pt-2">
                        <div className="grid gap-3 sm:grid-cols-2">
                          {category.ideas.map((idea) => (
                            <div
                              key={idea.id}
                              className="group p-3.5 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-green-300 dark:hover:border-green-700 hover:shadow-md transition-all bg-gray-50/50 dark:bg-gray-800/30"
                            >
                              <div className="flex items-start justify-between gap-2 mb-2">
                                <h4 className="font-semibold text-sm text-gray-900 dark:text-white">
                                  {idea.name}
                                </h4>
                                <Badge 
                                  variant="outline" 
                                  className={
                                    idea.agentType === "proactive_setter"
                                      ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 text-xs"
                                      : idea.agentType === "informative_advisor"
                                      ? "bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 text-xs"
                                      : idea.agentType === "customer_success"
                                      ? "bg-pink-50 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400 text-xs"
                                      : idea.agentType === "intake_coordinator"
                                      ? "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 text-xs"
                                      : "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 text-xs"
                                  }
                                >
                                  {idea.agentType === "proactive_setter" ? "Setter" 
                                    : idea.agentType === "informative_advisor" ? "Educativo"
                                    : idea.agentType === "customer_success" ? "Customer Success"
                                    : idea.agentType === "intake_coordinator" ? "Intake"
                                    : "Lead"}
                                </Badge>
                              </div>
                              <p className="text-xs text-gray-600 dark:text-gray-400 mb-2 leading-relaxed">
                                {idea.description}
                              </p>
                              <div className="flex items-center gap-1.5 text-xs">
                                <Sparkles className="h-3 w-3 text-purple-500" />
                                <span className="text-purple-700 dark:text-purple-400 capitalize">
                                  {idea.suggestedPersonality.replace(/_/g, " ")}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </CardContent>
            </Card>

            {/* FUNZIONALITÀ FUTURE */}
            <Card className="border-indigo-100 dark:border-indigo-900/30 bg-gradient-to-br from-indigo-50/50 to-purple-50/50 dark:from-indigo-950/10 dark:to-purple-950/10">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="bg-indigo-100 dark:bg-indigo-900/30 p-2.5 rounded-lg">
                    <Sparkles className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
                  </div>
                  <div>
                    <CardTitle className="text-xl">Funzionalità Future 🚀</CardTitle>
                    <CardDescription className="mt-1">
                      Feature modulari in arrivo per potenziare i tuoi agenti AI
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 md:grid-cols-3">
                  {[
                    { icon: "💳", title: "Payment Collection", desc: "Raccolta pagamenti via Stripe" },
                    { icon: "📋", title: "Quote Generation", desc: "Preventivi automatici" },
                    { icon: "🎁", title: "Loyalty Program", desc: "Programma fedeltà con punti" },
                    { icon: "⭐", title: "Review Collection", desc: "Raccolta recensioni automatica" },
                    { icon: "📍", title: "Geo-Targeting", desc: "Risposte basate su posizione" },
                    { icon: "🔗", title: "Multi-Channel", desc: "Instagram, Telegram, Facebook" },
                  ].map((feature) => (
                    <div key={feature.title} className="p-3 rounded-lg border border-indigo-200 dark:border-indigo-800 bg-white dark:bg-gray-800/50">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-lg">{feature.icon}</span>
                        <h4 className="font-semibold text-sm">{feature.title}</h4>
                      </div>
                      <p className="text-xs text-gray-600 dark:text-gray-400">{feature.desc}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Conferma Eliminazione</AlertDialogTitle>
            <AlertDialogDescription>
              Sei sicuro di voler eliminare l'agente <strong>"{configToDelete?.agentName}"</strong>?
              Questa azione non può essere annullata.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>
              Annulla
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              disabled={deleteMutation.isPending}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleteMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Eliminazione...
                </>
              ) : (
                "Elimina"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ConsultantAIAssistant />
    </WhatsAppLayout>
  );
}
